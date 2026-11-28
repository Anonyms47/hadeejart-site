/* ======================================================================
   Hadeej'Art — Commande en 3 étapes (coordonnées -> livraison ->
   récapitulatif), enregistrement Supabase puis confirmation WhatsApp.
   Principes :
   - rien n'est jamais « payé » sur le site : le paiement se règle avec la
     boutique après confirmation sur WhatsApp ;
   - le serveur (place_order) revérifie prix, disponibilité et options ;
   - un double clic ou un renvoi n'enregistre qu'UNE commande (clé
     d'idempotence conservée jusqu'au succès) ;
   - les erreurs s'affichent à côté des champs, les saisies survivent au
     retour en arrière.
   ====================================================================== */

const PAYMENT_LABELS = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  sendwave: 'Sendwave',
  taptap_send: 'TapTap Send'
};

let CO_STEP = 1;
let _coReturnFocus = null;
let _coSending = false;
const CO_LAST_ORDER_KEY = 'ha_last_order';

const $co = id => document.getElementById(id);
const coVal = id => (($co(id) || {}).value || '').trim();

function openClient() {
  if (!CART.length) { openCart(); return; }
  if (typeof cartHasIssues === 'function' && cartHasIssues()) { openCart(); return; }
  const modal = $co('client');
  if (modal.classList.contains('show')) return;
  /* Le tiroir du panier laisse la place à la fiche de commande. */
  if (typeof closeCart === 'function') closeCart();
  _coReturnFocus = document.activeElement;
  modal.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (typeof pushOverlayHistory === 'function') pushOverlayHistory();
  coClearErrors();
  goToStep(1);
}

function closeClient(viaPopstate) {
  const modal = $co('client');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
  const back = _coReturnFocus && document.contains(_coReturnFocus) ? _coReturnFocus : $co('cartBtn');
  _coReturnFocus = null;
  if (back && back.focus) back.focus({ preventScroll: true });
}

/* ====== Mémorisation des infos client (opt-in) ====== */
function restoreClientInfo() {
  let u = null;
  try { u = JSON.parse(localStorage.getItem('ha_user') || 'null'); } catch (e) { u = null; }
  if (!u || typeof u !== 'object') return;
  const setVal = (id, val) => { const e = $co(id); if (e) e.value = typeof val === 'string' ? val.slice(0, 200) : ''; };
  setVal('cName', u.name); setVal('cPhone', u.phone); setVal('cEmail', u.email);
  setVal('cCountry', u.country); setVal('cCity', u.city); setVal('cDistrict', u.district);
  const remember = $co('cRemember'); if (remember) remember.checked = true;
  selectPaymentMethodByValue(u.pay || 'wave');
}

function saveClientInfoIfAsked() {
  const remember = $co('cRemember');
  try {
    if (remember && remember.checked) {
      localStorage.setItem('ha_user', JSON.stringify({
        name: coVal('cName'), phone: coVal('cPhone'), email: coVal('cEmail'),
        country: coVal('cCountry'), city: coVal('cCity'), district: coVal('cDistrict'),
        pay: coVal('cPay') || 'wave'
      }));
    } else localStorage.removeItem('ha_user');
  } catch (e) { /* stockage indisponible */ }
}

/* ====== Moyen de paiement (chips) ====== */
function selectPaymentMethodByValue(value) {
  const grid = $co('payGrid');
  if (!grid) return;
  const btn = grid.querySelector(`.pay-card[data-method="${CSS.escape(value)}"]`) || grid.querySelector('.pay-card');
  if (btn) setPaymentMethod(btn);
}
function setPaymentMethod(btn) {
  const grid = $co('payGrid'), out = $co('cPay');
  if (!grid || !btn) return;
  grid.querySelectorAll('.pay-card').forEach(b => { b.setAttribute('aria-checked', 'false'); b.tabIndex = -1; });
  btn.setAttribute('aria-checked', 'true'); btn.tabIndex = 0;
  if (out) out.value = btn.dataset.method || 'wave';
  refreshPayTrust();
}
/* Micro-texte de réassurance propre au moyen choisi (aucune promesse hors
   de ce que fait réellement la boutique : détails donnés sur WhatsApp). */
function refreshPayTrust() {
  const el = $co('payTrust'), out = $co('cPay');
  if (el && out) el.textContent = t('pay_trust_' + (out.value || 'wave'));
}
function bindPaymentGrid() {
  const grid = $co('payGrid');
  if (!grid) return;
  grid.addEventListener('click', e => { const btn = e.target.closest('.pay-card'); if (btn) setPaymentMethod(btn); });
  grid.addEventListener('keydown', e => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!move) return;
    const cards = [...grid.querySelectorAll('.pay-card')];
    const i = cards.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = cards[(i + move + cards.length) % cards.length];
    next.focus(); setPaymentMethod(next);
  });
  refreshPayTrust();
}

/* ====== Champs : erreurs en ligne, téléphone ====== */
function coSetError(id, msg) {
  const input = $co(id), err = $co('err-' + id);
  if (!input) return;
  if (msg) { input.setAttribute('aria-invalid', 'true'); if (err) { err.textContent = msg; err.hidden = false; } }
  else { input.removeAttribute('aria-invalid'); if (err) { err.textContent = ''; err.hidden = true; } }
}
function coClearErrors() {
  ['cName', 'cPhone', 'cEmail', 'cCity', 'cDistrict'].forEach(id => coSetError(id, ''));
  const e = $co('coError'); if (e) { e.hidden = true; e.textContent = ''; }
  const f = $co('coWaFallback'); if (f) f.hidden = true;
}

/* Numéros acceptés : local sénégalais à 9 chiffres (77 123 45 67), ou
   international (+221…, 00221…) de 9 à 15 chiffres. */
/* Chiffres d'autres écritures (arabe-indien ٠١٢, persan ۰۱۲, pleine largeur ０１２) et
   espaces / tirets typographiques -> caractères ASCII : un clavier arabe ou asiatique
   produit des numéros valides que le serveur (ASCII seulement) refuserait sinon. */
function normalizePhoneChars(s) {
  return String(s || '')
    .replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[\uFF10-\uFF19]/g, c => String(c.charCodeAt(0) - 0xFF10))
    .replace(/[\uFF0B]/g, '+')
    .replace(/[\u00A0\u2007\u202F\u3000]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-');
}
function phoneDigits(raw) { return String(raw || '').replace(/\D/g, ''); }
function phoneIsValid(raw) {
  raw = normalizePhoneChars(raw);
  if (!/^[0-9+ ().-]{6,30}$/.test(raw)) return false;
  let d = phoneDigits(raw);
  if (/^\s*00/.test(raw)) d = d.slice(2);
  return d.length >= 9 && d.length <= 15;
}
function formatPhoneForDisplay(raw) {
  raw = normalizePhoneChars(raw);
  const d = phoneDigits(raw);
  if (!/^\s*\+/.test(raw) && d.length === 9) return d.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
  return raw.trim();
}

function validateStep(n) {
  let ok = true, first = null;
  const fail = (id, key) => { coSetError(id, t(key)); ok = false; if (!first) first = id; };
  if (n === 1) {
    const phoneEl = $co('cPhone'); if (phoneEl) phoneEl.value = normalizePhoneChars(phoneEl.value).trim();
    const name = coVal('cName'), phone = coVal('cPhone'), email = coVal('cEmail');
    coSetError('cName', ''); coSetError('cPhone', ''); coSetError('cEmail', '');
    if (!name) fail('cName', 'val_name_required'); else if (name.length > 120) fail('cName', 'val_name_too_long');
    if (!phone) fail('cPhone', 'val_phone_required'); else if (!phoneIsValid(phone)) fail('cPhone', 'val_phone_invalid');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('cEmail', 'val_email_invalid');
  }
  if (n === 2) {
    coSetError('cCity', ''); coSetError('cDistrict', '');
    if (!coVal('cCity')) fail('cCity', 'val_city_required');
    if (!coVal('cDistrict') && (!coVal('cCountry') || /s[ée]n[ée]gal/i.test(coVal('cCountry')))) fail('cDistrict', 'val_district_required');
  }
  if (!ok && first) { const el = $co(first); if (el) el.focus(); }
  return ok;
}

/* ====== Étapes ====== */
function goToStep(n) {
  CO_STEP = n;
  document.querySelectorAll('#coForm .co-step').forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
  document.querySelectorAll('#coSteps li').forEach(li => {
    const k = Number(li.dataset.step);
    li.classList.toggle('current', k === n); li.classList.toggle('done', k < n);
    if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  $co('coBack').hidden = n === 1;
  $co('coNext').hidden = n === 3;
  $co('btnOrder').hidden = n !== 3;
  $co('coSendHint').hidden = n !== 3;
  if (n === 2) {
    let z = $co('coZones');
    const txt = typeof deliveryZonesText === 'function' ? deliveryZonesText() : '';
    if (!z && txt) { z = document.createElement('p'); z.id = 'coZones'; z.className = 'co-note'; document.querySelector('#coForm .co-step[data-step="2"] .co-map').before(z); }
    if (z) { z.hidden = !txt; z.innerHTML = txt ? '<b>' + escapeHtml(t('detail_delivery')) + '</b><br>' + escapeHtml(txt).replace(/\n/g, '<br>') : ''; }
  }
  if (n === 3) renderCheckoutSummary();
  const sheet = document.querySelector('#client .sheet'); if (sheet) sheet.scrollTop = 0;
  const target = document.querySelector('#coForm .co-step[data-step="' + n + '"] input, #btnOrder');
  const focus = n === 3 ? $co('btnOrder') : target;
  if (focus && focus.focus) setTimeout(() => focus.focus({ preventScroll: true }), 30);
}

function renderCheckoutSummary() {
  const view = cartOrderView();
  $co('coRecap').innerHTML = view.lines.map(l => {
    const bits = [];
    if (l.size) bits.push(l.size);
    if (l.color) bits.push(l.color);
    if (l.optionKimono) bits.push(variantChoiceLabel(l.id, l.optionKimono));
    if (l.tissu) bits.push(l.tissu);
    if (l.note) bits.push(t('wa_note') + ' ' + l.note);
    return `<li class="co-line">
      <span class="co-thumb">${l.img ? `<img src="${escapeHtml(l.img)}" alt="" loading="lazy">` : ''}</span>
      <span class="co-line-info"><b>${escapeHtml(l.name)}</b>${bits.length ? `<small>${escapeHtml(bits.join(' · '))}</small>` : ''}<small>× ${l.qty}</small></span>
      <span class="co-line-price">${escapeHtml(formatMoney(l.price * l.qty, l.currency))}</span></li>`;
  }).join('');
  $co('coTotal').textContent = formatMoney(view.total, view.currency);
  const note = $co('coCurrencyNote');
  note.hidden = !view.mixed;
  note.textContent = view.mixed ? t('cart_notice_fcfa') : '';
  const place = [coVal('cDistrict'), coVal('cCity'), coVal('cCountry')].filter(Boolean).join(', ');
  const hint = coVal('locNote');
  $co('coAddress').innerHTML = `<b>${escapeHtml(coVal('cName'))}</b> · ${escapeHtml(coVal('cPhone'))}<br>${escapeHtml(place)}${hint ? '<br>' + escapeHtml(hint) : ''}`
    + ` <button type="button" class="link-btn" id="coEdit">${escapeHtml(t('step_edit'))}</button>`;
  const edit = $co('coEdit'); if (edit) edit.addEventListener('click', () => goToStep(1));
}

function bindCheckoutSteps() {
  const next = $co('coNext'), back = $co('coBack'), mapBtn = $co('btnShowMap'), phone = $co('cPhone');
  if (!next) return;
  next.addEventListener('click', () => { if (validateStep(CO_STEP)) goToStep(CO_STEP + 1); });
  back.addEventListener('click', () => goToStep(Math.max(1, CO_STEP - 1)));
  $co('coForm').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      e.preventDefault();
      if (CO_STEP < 3 && validateStep(CO_STEP)) goToStep(CO_STEP + 1);
    }
  });
  if (phone) phone.addEventListener('blur', () => { if (phoneIsValid(phone.value)) phone.value = formatPhoneForDisplay(phone.value); });
  ['cName', 'cPhone', 'cEmail', 'cCity', 'cDistrict'].forEach(id => { const el = $co(id); if (el) el.addEventListener('input', () => coSetError(id, '')); });
  if (mapBtn) mapBtn.addEventListener('click', toggleDeliveryMap);
  const fb = $co('coWaFallback'); if (fb) fb.addEventListener('click', () => { if (window._coFallbackUrl) window.open(window._coFallbackUrl, '_blank'); });
}

/* Carte facultative : Leaflet n'est téléchargé qu'au premier affichage. */
async function toggleDeliveryMap() {
  const btn = $co('btnShowMap'), box = $co('coMapBox');
  const open = box.hidden;
  box.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (!open) return;
  try {
    await loadLeaflet();
    initDeliveryMap();
    if (typeof deliveryMap !== 'undefined' && deliveryMap) setTimeout(() => deliveryMap.invalidateSize(), 120);
  } catch (e) {
    setMapStatus('map_load_failed');
  }
}

/* ====== Message WhatsApp / récapitulatif ====== */
function buildOrderSummary(orderRef, location, view) {
  view = view || cartOrderView();
  const pay = PAYMENT_LABELS[coVal('cPay')] || 'Wave';
  const lines = [];
  if (orderRef) lines.push(t('wa_ref') + ' ' + orderRef);
  lines.push(t('wa_name') + ' ' + (coVal('cName') || 'Client'));
  lines.push(t('wa_phone') + ' ' + coVal('cPhone'));
  if (coVal('cEmail')) lines.push(t('wa_email') + ' ' + coVal('cEmail'));
  lines.push(t('wa_location_line')(coVal('cCountry') || t('dash'), coVal('cCity') || t('dash'), coVal('cDistrict') || t('dash')));
  if (location && location.note) lines.push(t('wa_precision') + ' ' + location.note);
  if (location && location.lat != null) {
    lines.push(t('wa_address_detected') + ' ' + (location.address || t('dash')));
    lines.push(t('wa_position') + ' ' + location.mapsLink);
  }
  lines.push(t('wa_articles'));
  view.lines.forEach(l => {
    const bits = [];
    if (l.size) bits.push(l.size);
    if (l.color) bits.push(l.color);
    if (l.tissu) bits.push(l.tissu);
    if (l.optionKimono) bits.push(variantChoiceLabel(l.id, l.optionKimono));
    if (l.note) bits.push(t('wa_note') + ' ' + l.note);
    lines.push('- ' + l.name + (bits.length ? ' (' + bits.join(', ') + ')' : '') + ' × ' + l.qty + ' — ' + formatMoney(l.price * l.qty, l.currency));
  });
  lines.push(t('wa_total_items') + ' ' + formatMoney(view.total, view.currency));
  lines.push(t('wa_payment') + ' ' + pay);
  return lines.join('\n');
}
function buildOrderMessage(orderRef, location, view) {
  return t('wa_new_order') + '\n' + buildOrderSummary(orderRef, location, view);
}

/* Lien WhatsApp : au-delà de ~3500 caractères (gros panier) certains navigateurs ou
   applications tronquent ou refusent le lien : on envoie alors un message court ;
   le détail complet est dans la facture image et le récapitulatif copiable. */
function waOrderUrl(fullText, view, orderRef) {
  const url = `https://wa.me/${SITE_WA_NUMBER}?text=${encodeURIComponent(fullText)}`;
  if (url.length <= 3500) return url;
  const short = [t('wa_new_order'), orderRef ? t('wa_ref') + ' ' + orderRef : '', t('wa_name') + ' ' + (coVal('cName') || 'Client'),
    t('wa_phone') + ' ' + coVal('cPhone'), t('wa_total_items') + ' ' + formatMoney(view.total, view.currency),
    t('wa_payment') + ' ' + (PAYMENT_LABELS[coVal('cPay')] || 'Wave'), t('wa_invoice_note')].filter(Boolean).join('\n');
  return `https://wa.me/${SITE_WA_NUMBER}?text=${encodeURIComponent(short)}`;
}

/* ====== Envoi ====== */
function newIdemKey() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* repli */ }
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}
/* La même clé sert pour toute nouvelle tentative portant sur le MÊME
   panier et les mêmes coordonnées : un renvoi après coupure réseau (ou un
   double clic) ne crée jamais deux commandes. */
function idemKeyFor(payload) {
  const sig = JSON.stringify([payload.items, payload.customer, payload.currency]);
  try {
    const raw = sessionStorage.getItem('ha_idem');
    if (raw) { const o = JSON.parse(raw); if (o.sig === sig) return o.key; }
    const key = newIdemKey();
    sessionStorage.setItem('ha_idem', JSON.stringify({ sig, key }));
    return key;
  } catch (e) { return newIdemKey(); }
}

function setSending(on) {
  _coSending = on;
  const btn = $co('btnOrder');
  if (!btn) return;
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  btn.textContent = on ? t('sending') : t('place_order_btn');
  ['coBack'].forEach(id => { const b = $co(id); if (b) b.disabled = on; });
}

function showCoError(msg, canFallback) {
  const box = $co('coError');
  box.textContent = msg; box.hidden = false;
  const fb = $co('coWaFallback'); if (fb) fb.hidden = !canFallback;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function haOrder() {
  if (_coSending) return false;               /* double clic : ignoré */
  if (!CART.length) { showCoError(t('val_cart_empty')); return false; }
  if (cartHasIssues()) { closeClient(); openCart(); return false; }
  if (!validateStep(1)) { goToStep(1); return false; }
  if (!validateStep(2)) { goToStep(2); return false; }

  setSending(true);
  $co('coError').hidden = true;
  const fb = $co('coWaFallback'); if (fb) fb.hidden = true;

  try {
    saveClientInfoIfAsked();
    const location = (typeof getDeliveryLocation === 'function') ? getDeliveryLocation() : {};
    const view = cartOrderView();

    const payload = {
      customer: { name: coVal('cName'), phone: coVal('cPhone'), email: coVal('cEmail'), country: coVal('cCountry'), city: coVal('cCity'), district: coVal('cDistrict') },
      location: { lat: location.lat, lng: location.lng, address: location.address, note: location.note, maps_link: location.mapsLink },
      payment_method: coVal('cPay') || 'wave',
      currency: view.currency,
      items: view.lines.map(l => ({
        product_id: (PRODUCTS.find(p => p.id === l.id) || {})._dbId,
        size: l.size, color: l.color, fabric: l.tissu, note: l.note,
        option_kimono: l.optionKimono, qty: l.qty
      }))
    };
    payload.idempotency_key = idemKeyFor(payload);

    window.LAST_INVOICE_ID = null;
    window.LAST_INVOICE_BLOB = null;
    let result;
    try {
      result = await placeOrderRemote(payload);
    } catch (err) {
      console.error('placeOrderRemote:', err);
      const message = err.isValidation ? translateServerError(err.message) : t('co_network_error');
      /* Panne réseau : on garde panier et saisies, on propose de réessayer
         (même clé : aucun doublon) ou de passer directement par WhatsApp. */
      window._coFallbackUrl = waOrderUrl(buildOrderMessage(null, location, view), view, null);
      showCoError(message, !err.isValidation);
      return false;
    }

    const orderRef = result && result.order_ref;
    window.LAST_INVOICE_ID = orderRef;
    const summary = buildOrderSummary(orderRef, location, view);
    const waUrl = waOrderUrl(t('wa_new_order') + '\n' + summary + '\n' + t('wa_invoice_note'), view, orderRef);
    const record = { ref: orderRef, waUrl, summary, total: formatMoney(view.total, view.currency), at: Date.now() };
    window.LAST_ORDER = record;
    try { localStorage.setItem(CO_LAST_ORDER_KEY, JSON.stringify(record)); sessionStorage.removeItem('ha_idem'); } catch (e) { /* ignoré */ }

    /* Confirmation immédiate : la référence et le récapitulatif s'affichent
       sans attendre la facture image (confort optionnel, générée ensuite). */
    window.INVOICE_VIEW = view;
    closeClient(true);
    if (typeof clearCart === 'function') clearCart();
    openOrderDone(true);

    /* WhatsApp peut être bloqué : la confirmation reste affichée avec la
       référence, le récapitulatif copiable et un bouton dédié. */
    try { window.open(waUrl, '_blank'); } catch (e) { /* le bouton prend le relais */ }

    (async () => {
      try {
        if (typeof buildInvoiceImage === 'function') await buildInvoiceImage();
        window.LAST_INVOICE_BLOB = (typeof invoiceBlob === 'function') ? await invoiceBlob() : null;
        refreshOrderDonePreview();
        if (typeof downloadInvoice === 'function') await downloadInvoice();
      } catch (e) { console.warn('facture:', e); }
    })();
    return true;
  } catch (err) {
    console.error('haOrder error:', err);
    showCoError(t('co_unexpected_error'));
    return false;
  } finally {
    setSending(false);
  }
}

/* ====== Écran de confirmation après commande ====== */
let _orderDoneUrl = null;

function refreshOrderDonePreview() {
  const img = $co('odPreview');
  if (!img) return;
  if (_orderDoneUrl) URL.revokeObjectURL(_orderDoneUrl);
  _orderDoneUrl = window.LAST_INVOICE_BLOB ? URL.createObjectURL(window.LAST_INVOICE_BLOB) : null;
  img.src = _orderDoneUrl || '';
  img.hidden = !_orderDoneUrl;
}

function openOrderDone(reuseHistory) {
  const modal = $co('orderDone');
  if (!modal) return;
  const order = window.LAST_ORDER || {};
  const refEl = $co('odRef'); if (refEl) refEl.textContent = order.ref || '';
  const sum = $co('odSummary'); if (sum) sum.textContent = (order.summary || '') + (order.total ? '' : '');
  refreshOrderDonePreview();
  const wa = $co('odWhatsapp'); if (wa) wa.href = order.waUrl || `https://wa.me/${SITE_WA_NUMBER}`;
  const copy = $co('odCopy'); if (copy) copy.textContent = t('order_done_copy');
  modal.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (!reuseHistory && typeof pushOverlayHistory === 'function') pushOverlayHistory();
  if (wa) setTimeout(() => wa.focus({ preventScroll: true }), 60);
}

function closeOrderDone(viaPopstate) {
  const modal = $co('orderDone');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
}

function orderDoneBackToShop() {
  closeOrderDone();
  if (typeof scrollToCatalogue === 'function' && $co('catalogue')) scrollToCatalogue();
}

async function copyText(text, btn, doneKey, idleKey) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) { btn.textContent = t(doneKey); setTimeout(() => { btn.textContent = t(idleKey); }, 2200); }
  } catch (e) { return false; }
  return true;
}
async function orderDoneCopyRef() {
  const ok = await copyText((window.LAST_ORDER || {}).ref || '', $co('odCopy'), 'order_done_copied', 'order_done_copy');
  if (!ok) { const el = $co('odRef'); if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } }
}
async function orderDoneCopySummary() {
  const o = window.LAST_ORDER || {};
  const text = (o.ref ? o.ref + '\n' : '') + (o.summary || '');
  const ok = await copyText(text, $co('odCopySummary'), 'order_done_copied', 'od_copy_summary');
  if (!ok) { const el = $co('odSummary'); if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); } }
}
