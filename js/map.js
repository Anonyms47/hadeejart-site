/* ======================================================================
   Hadeej'Art — Carte de livraison interactive (Leaflet + OpenStreetMap)
   Pas de clé API : recherche et géocodage inverse via Nominatim (usage
   raisonnable, cf. note dans le rapport livré). Le lien Google Maps est
   généré à partir des coordonnées choisies, sans dépendre de l'API Google.
   ====================================================================== */

const DEFAULT_MAP_CENTER = { lat: 14.7167, lng: -17.4677 }; /* Dakar */

let deliveryMap = null;
let deliveryMarker = null;
let deliveryState = { lat: null, lng: null, address: '' };
let deliveryInteracted = false; /* true seulement après une action volontaire du visiteur */
let reverseGeocodeTimer = null;

function mapsLinkFor(lat, lng) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

let lastMapStatusKey = 'map_status_default';
function setMapStatus(key) {
  lastMapStatusKey = key;
  const el = document.getElementById('mapStatus');
  if (el) el.textContent = t(key);
}
/* Ré-applique le dernier message affiché dans la nouvelle langue (voir
   onLangChange() dans catalogue.js). */
function refreshMapStatusLabel() {
  const el = document.getElementById('mapStatus');
  if (el) el.textContent = t(lastMapStatusKey);
  /* Contrôles de la carte : re-libellés dans la langue courante. */
  const setLabel = (sel, key) => document.querySelectorAll(sel).forEach(n => { n.title = t(key); n.setAttribute('aria-label', t(key)); });
  setLabel('.leaflet-control-zoom-in', 'map_zoom_in');
  setLabel('.leaflet-control-zoom-out', 'map_zoom_out');
  document.querySelectorAll('.leaflet-marker-icon').forEach(n => { n.title = t('map_marker'); n.alt = t('map_marker'); });
}

async function reverseGeocode(lat, lng) {
  try {
    setMapStatus('map_reverse_searching');
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
    const data = await res.json();
    deliveryState.address = (data && data.display_name) || '';
    const addrEl = document.getElementById('locAddress');
    if (addrEl) addrEl.value = deliveryState.address;
    setMapStatus(deliveryState.address ? 'map_address_found' : 'map_address_not_found');
  } catch (err) {
    console.warn('reverseGeocode:', err);
    setMapStatus('map_address_offline');
  }
}

function moveMarker(lat, lng, skipReverse) {
  if (!skipReverse) deliveryInteracted = true;
  deliveryState.lat = lat;
  deliveryState.lng = lng;
  if (deliveryMarker) deliveryMarker.setLatLng([lat, lng]);
  if (deliveryMap) deliveryMap.panTo([lat, lng]);
  const latEl = document.getElementById('locLat');
  const lngEl = document.getElementById('locLng');
  if (latEl) latEl.value = lat.toFixed(6);
  if (lngEl) lngEl.value = lng.toFixed(6);

  clearTimeout(reverseGeocodeTimer);
  if (!skipReverse) reverseGeocodeTimer = setTimeout(() => reverseGeocode(lat, lng), 500);
}

function initDeliveryMap() {
  const container = document.getElementById('deliveryMap');
  if (!container || typeof L === 'undefined' || deliveryMap) return;

  /* Contrôles créés à la main : leurs libellés par défaut sont en anglais
     (« Zoom in », « Marker », préfixe Leaflet...) quelle que soit la langue. */
  deliveryMap = L.map(container, { attributionControl: false, zoomControl: false }).setView(
    [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 12
  );
  L.control.zoom({ zoomInTitle: t('map_zoom_in'), zoomOutTitle: t('map_zoom_out') }).addTo(deliveryMap);
  L.control.attribution({ prefix: false }).addTo(deliveryMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(deliveryMap);

  deliveryMarker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], { draggable: true, alt: t('map_marker'), title: t('map_marker') }).addTo(deliveryMap);
  deliveryMarker.on('dragend', () => {
    const pos = deliveryMarker.getLatLng();
    moveMarker(pos.lat, pos.lng);
  });
  deliveryMap.on('click', e => moveMarker(e.latlng.lat, e.latlng.lng));

  /* Recentre correctement si la carte s'ouvre dans une modale masquée
     au moment de son initialisation (taille 0 sinon). */
  setTimeout(() => deliveryMap.invalidateSize(), 200);

  const locateBtn = document.getElementById('btnLocateMe');
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) { setMapStatus('map_geo_unavailable'); return; }
      setMapStatus('map_locating');
      navigator.geolocation.getCurrentPosition(
        pos => { deliveryMap.setView([pos.coords.latitude, pos.coords.longitude], 15); moveMarker(pos.coords.latitude, pos.coords.longitude); },
        err => {
          const keys = { 1: 'map_geo_denied', 2: 'map_geo_position_unavailable', 3: 'map_geo_timeout' };
          setMapStatus(keys[err.code] || 'map_geo_generic_fail');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  const searchInput = document.getElementById('mapSearch');
  const searchBtn = document.getElementById('btnMapSearch');
  async function runSearch() {
    const q = (searchInput.value || '').trim();
    if (!q) return;
    setMapStatus('map_searching');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (results && results.length) {
        const r = results[0];
        deliveryMap.setView([r.lat, r.lon], 15);
        moveMarker(parseFloat(r.lat), parseFloat(r.lon));
      } else {
        setMapStatus('map_no_results');
      }
    } catch (err) {
      setMapStatus('map_search_offline');
    }
  }
  if (searchBtn) searchBtn.addEventListener('click', runSearch);
  if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });

  moveMarker(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, true);
}

function getDeliveryLocation() {
  const noteEl = document.getElementById('locNote');
  if (!deliveryInteracted || deliveryState.lat == null) {
    return { lat: null, lng: null, address: '', note: noteEl ? noteEl.value.trim() : '', mapsLink: '' };
  }
  return {
    lat: deliveryState.lat,
    lng: deliveryState.lng,
    address: deliveryState.address,
    note: noteEl ? noteEl.value.trim() : '',
    mapsLink: mapsLinkFor(deliveryState.lat, deliveryState.lng)
  };
}
