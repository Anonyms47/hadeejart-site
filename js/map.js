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

/* Nominatim (serveur public gratuit) n'accepte qu'une requête par seconde et
   répond 429 au-delà : toutes les requêtes passent donc par cette file, qui
   les espace de 1,1 s et retente une fois en cas de 429. */
let _nominatimChain = Promise.resolve();
let _nominatimLast = 0;
function nominatimFetch(url) {
  const run = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = _nominatimLast + 1100 - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      _nominatimLast = Date.now();
      const res = await fetch(url);
      if (res.status === 429 && attempt === 0) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return res;
    }
  };
  const p = _nominatimChain.then(run, run);
  _nominatimChain = p.catch(() => {});
  return p;
}

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
    const res = await nominatimFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${CURRENT_LANG === 'en' ? 'en' : 'fr'}`);
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

  bindLocateButton();
  bindAddressSearch();

  moveMarker(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, true);
}

/* ======================================================================
   Localisation : position de l'appareil
   - exige un contexte sécurisé (https ou localhost) : sans cela le
     navigateur refuse la géolocalisation, quel que soit le réglage ;
   - obtient d'abord une position approximative rapide (réseau/Wi-Fi), puis
     l'affine avec le GPS pendant quelques secondes en gardant la meilleure
     précision (une seule demande à haute précision échoue souvent sur
     ordinateur ou en intérieur) ;
   - trace le cercle d'incertitude et l'annonce en mètres.
   ====================================================================== */
let accuracyCircle = null;
let locateWatchId = null;
let locateTimer = null;

function stopLocating() {
  if (locateWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(locateWatchId);
  locateWatchId = null;
  clearTimeout(locateTimer);
  const btn = document.getElementById('btnLocateMe');
  if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
}

function showAccuracy(lat, lng, meters) {
  if (!deliveryMap || typeof L === 'undefined') return;
  if (accuracyCircle) accuracyCircle.remove();
  accuracyCircle = L.circle([lat, lng], { radius: Math.max(meters, 5), color: '#9e5317', weight: 1.5, fillColor: '#d47a2c', fillOpacity: 0.15, interactive: false }).addTo(deliveryMap);
}

function applyDevicePosition(pos, final) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  const zoom = accuracy <= 60 ? 18 : accuracy <= 300 ? 17 : accuracy <= 1500 ? 15 : 13;
  deliveryMap.setView([lat, lng], zoom);
  showAccuracy(lat, lng, accuracy);
  moveMarker(lat, lng, !final);
  const fn = t('map_geo_found');
  lastMapStatusKey = 'map_geo_found';
  const el = document.getElementById('mapStatus');
  if (el) el.textContent = typeof fn === 'function' ? fn(Math.round(accuracy)) : String(fn);
}

function geoErrorKey(err) {
  if (err && err.code === 1) return 'map_geo_denied';
  if (err && err.code === 2) return 'map_geo_position_unavailable';
  if (err && err.code === 3) return 'map_geo_timeout';
  return 'map_geo_generic_fail';
}

function locateMe() {
  if (!window.isSecureContext) { setMapStatus('map_geo_insecure'); return; }
  if (!navigator.geolocation) { setMapStatus('map_geo_unavailable'); return; }
  stopLocating();
  setMapStatus('map_locating');
  const btn = document.getElementById('btnLocateMe');
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }

  let best = null;
  let failed = 0;
  const onFix = pos => {
    if (!best || pos.coords.accuracy < best.coords.accuracy) {
      best = pos;
      applyDevicePosition(pos, false);
      /* Dès la première position, le bouton redevient utilisable : l'affinage
         continue en arrière-plan sans faire attendre le visiteur. */
      const b = document.getElementById('btnLocateMe');
      if (b) { b.disabled = false; b.removeAttribute('aria-busy'); }
    }
    if (pos.coords.accuracy <= 25) finish();
  };
  const onErr = err => {
    failed++;
    /* Refus explicite : inutile d'attendre l'autre demande. Sinon on n'affiche
       l'erreur que si les deux demandes (rapide + précise) ont échoué. */
    if (!best && (err.code === 1 || failed >= 2)) { stopLocating(); setMapStatus(geoErrorKey(err)); }
  };
  const finish = () => {
    const chosen = best;
    stopLocating();
    if (chosen) { applyDevicePosition(chosen, true); }
  };

  /* 1) position approximative rapide */
  navigator.geolocation.getCurrentPosition(onFix, onErr, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  /* 2) affinage GPS pendant ~12 s */
  locateWatchId = navigator.geolocation.watchPosition(onFix, onErr, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  locateTimer = setTimeout(() => { if (best) finish(); else { stopLocating(); setMapStatus('map_geo_timeout'); } }, 12000);
}

function bindLocateButton() {
  const locateBtn = document.getElementById('btnLocateMe');
  if (locateBtn) locateBtn.addEventListener('click', locateMe);
  /* Prévient tout de suite si l'autorisation a déjà été refusée ou si la page
     n'est pas sécurisée, plutôt que d'attendre un clic qui échouera. */
  if (!window.isSecureContext) { setMapStatus('map_geo_insecure'); return; }
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(st => {
      if (st.state === 'denied') setMapStatus('map_geo_denied');
    }).catch(() => {});
  }
}

/* ======================================================================
   Recherche d'adresse (Nominatim)
   - jusqu'à 6 résultats affichés en liste : on choisit le bon au lieu de
     subir le premier ;
   - champ vide : la requête est composée avec quartier / ville / pays déjà
     saisis dans le formulaire ;
   - si rien n'est trouvé, on retente en ajoutant la ville puis le pays
     (les rues et repères du Sénégal sont souvent mieux indexés ainsi) ;
   - résultats dans la langue du site, avec un biais vers Dakar.
   Nominatim interdit l'auto-complétion à chaque frappe : la recherche ne
   part donc qu'au clic sur « Chercher » ou sur Entrée.
   ====================================================================== */
function fieldValue(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function guessCountryCode() {
  const c = fieldValue('cCountry').toLowerCase();
  if (!c) return 'sn';
  if (/s[ée]n[ée]gal|senegaal/.test(c)) return 'sn';
  return '';
}

function searchAttempts(q) {
  const list = [q];
  const city = fieldValue('cCity'), country = fieldValue('cCountry') || 'Sénégal';
  const low = q.toLowerCase();
  if (city && !low.includes(city.toLowerCase())) list.push(`${q}, ${city}`);
  if (!low.includes(country.toLowerCase())) list.push(`${q}, ${city ? city + ', ' : ''}${country}`);
  return [...new Set(list)];
}

async function nominatimSearch(q) {
  const params = new URLSearchParams({
    format: 'jsonv2', limit: '6', addressdetails: '1', dedupe: '1', q,
    'accept-language': CURRENT_LANG === 'en' ? 'en' : 'fr'
  });
  const cc = guessCountryCode();
  if (cc) params.set('countrycodes', cc);
  /* Biais (non exclusif) vers la région de Dakar */
  params.set('viewbox', '-17.75,14.95,-16.85,14.55');
  const res = await nominatimFetch('https://nominatim.openstreetmap.org/search?' + params.toString());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function clearSearchResults() {
  const box = document.getElementById('mapResults');
  if (box) { box.innerHTML = ''; box.hidden = true; }
}

function chooseSearchResult(r) {
  const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
  deliveryMap.setView([lat, lng], 17);
  if (accuracyCircle) { accuracyCircle.remove(); accuracyCircle = null; }
  moveMarker(lat, lng, true);
  deliveryInteracted = true;
  deliveryState.address = r.display_name || '';
  const addrEl = document.getElementById('locAddress');
  if (addrEl) addrEl.value = deliveryState.address;
  setMapStatus('map_result_chosen');
}

function renderSearchResults(results) {
  const box = document.getElementById('mapResults');
  if (!box) return;
  box.innerHTML = '';
  results.forEach((r, i) => {
    const parts = (r.display_name || '').split(',').map(x => x.trim());
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.className = 'map-result';
    const main = document.createElement('strong'); main.textContent = parts[0] || r.display_name;
    const rest = document.createElement('span'); rest.textContent = parts.slice(1, 4).join(', ');
    li.append(main, rest);
    const pick = () => { chooseSearchResult(r); [...box.children].forEach(c => c.setAttribute('aria-selected', 'false')); li.setAttribute('aria-selected', 'true'); };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    box.appendChild(li);
  });
  box.hidden = results.length < 2; /* un seul résultat : inutile d'afficher une liste */
}

async function runAddressSearch() {
  const input = document.getElementById('mapSearch');
  let q = (input.value || '').trim();
  if (!q) {
    q = [fieldValue('cDistrict'), fieldValue('cCity'), fieldValue('cCountry')].filter(Boolean).join(', ');
    if (q) input.value = q;
  }
  if (!q) { setMapStatus('map_search_empty'); input.focus(); return; }
  setMapStatus('map_searching');
  clearSearchResults();
  const btn = document.getElementById('btnMapSearch');
  if (btn) btn.disabled = true;
  try {
    let results = [];
    for (const attempt of searchAttempts(q)) {
      results = await nominatimSearch(attempt);
      if (results && results.length) break;
    }
    if (!results || !results.length) { setMapStatus('map_no_results'); return; }
    chooseSearchResult(results[0]);
    renderSearchResults(results);
    if (results.length > 1) setMapStatus('map_search_pick');
  } catch (err) {
    console.warn('search:', err);
    setMapStatus('map_search_offline');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindAddressSearch() {
  const searchInput = document.getElementById('mapSearch');
  const searchBtn = document.getElementById('btnMapSearch');
  if (searchBtn) searchBtn.addEventListener('click', runAddressSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runAddressSearch(); } });
    searchInput.addEventListener('input', clearSearchResults);
  }
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
