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

function setMapStatus(msg) {
  const el = document.getElementById('mapStatus');
  if (el) el.textContent = msg;
}

async function reverseGeocode(lat, lng) {
  try {
    setMapStatus('Recherche de l’adresse…');
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
    const data = await res.json();
    deliveryState.address = (data && data.display_name) || '';
    const addrEl = document.getElementById('locAddress');
    if (addrEl) addrEl.value = deliveryState.address;
    setMapStatus(deliveryState.address ? 'Adresse détectée.' : 'Adresse introuvable — précisez avec la note libre.');
  } catch (err) {
    console.warn('reverseGeocode:', err);
    setMapStatus('Adresse indisponible (hors ligne ?) — vous pouvez continuer, précisez avec la note libre.');
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

  deliveryMap = L.map(container, { attributionControl: true }).setView(
    [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 12
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(deliveryMap);

  deliveryMarker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], { draggable: true }).addTo(deliveryMap);
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
      if (!navigator.geolocation) { setMapStatus('Géolocalisation non disponible sur cet appareil.'); return; }
      setMapStatus('Localisation en cours…');
      navigator.geolocation.getCurrentPosition(
        pos => { deliveryMap.setView([pos.coords.latitude, pos.coords.longitude], 15); moveMarker(pos.coords.latitude, pos.coords.longitude); },
        err => {
          const messages = {
            1: 'Localisation refusée. Vous pouvez l’autoriser dans les réglages du navigateur, ou utiliser la recherche / déplacer le repère.',
            2: 'Position indisponible pour le moment — utilisez la recherche ou déplacez le repère.',
            3: 'Localisation trop longue à obtenir — utilisez la recherche ou déplacez le repère.'
          };
          setMapStatus(messages[err.code] || 'Localisation impossible — utilisez la recherche ou déplacez le repère.');
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
    setMapStatus('Recherche…');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (results && results.length) {
        const r = results[0];
        deliveryMap.setView([r.lat, r.lon], 15);
        moveMarker(parseFloat(r.lat), parseFloat(r.lon));
      } else {
        setMapStatus('Aucun résultat pour cette recherche.');
      }
    } catch (err) {
      setMapStatus('Recherche indisponible (hors ligne ?).');
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
