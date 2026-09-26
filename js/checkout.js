/* ======================================================================
   Hadeej'Art — Client, moyen de paiement, commande WhatsApp
   ====================================================================== */

const PAYMENT_LABELS = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  sendwave: 'Sendwave',
  taptap_send: 'TapTap Send'
};

function openClient() {
  if (!CART.length) { openCart(); return; }
  const modal = document.getElementById('client');
  if (modal.classList.contains('show')) return;
  /* Le tiroir du panier laisse la place à la fiche client. */
  if (typeof closeCart === 'function') closeCart();
  modal.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (typeof pushOverlayHistory === 'function') pushOverlayHistory();
  setTimeout(() => { if (typeof initDeliveryMap === 'function') initDeliveryMap(); }, 50);
}
function closeClient(viaPopstate) {
  const modal = document.getElementById('client');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
}

/* ====== Mémorisation des infos client (opt-in) ====== */
function restoreClientInfo() {
  const s = localStorage.getItem('ha_user');
  if (!s) return;
  try {
    const u = JSON.parse(s);
    const setVal = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
    setVal('cName', u.name);
    setVal('cPhone', u.phone);
    setVal('cEmail', u.email);
    setVal('cCountry', u.country);
    setVal('cCity', u.city);
    setVal('cDistrict', u.district);
    const remember = document.getElementById('cRemember');
    if (remember) remember.checked = true;
    selectPaymentMethodByValue(u.pay || 'wave');
  } catch (e) { /* ignore données corrompues */ }
}

function saveClientInfoIfAsked() {
  const remember = document.getElementById('cRemember');
  const val = id => (document.getElementById(id) || {}).value || '';
  if (remember && remember.checked) {
    localStorage.setItem('ha_user', JSON.stringify({
      name: val('cName'), phone: val('cPhone'), email: val('cEmail'),
      country: val('cCountry'), city: val('cCity'), district: val('cDistrict'),
      pay: (document.getElementById('cPay') || {}).value || 'wave'
    }));
  } else {
    localStorage.removeItem('ha_user');
  }
}

/* ====== Moyen de paiement (chips) ====== */
function selectPaymentMethodByValue(value) {
  const grid = document.getElementById('payGrid');
  if (!grid) return;
  const btn = grid.querySelector(`.pay-card[data-method="${CSS.escape(value)}"]`) || grid.querySelector('.pay-card');
  if (btn) setPaymentMethod(btn);
}

function setPaymentMethod(btn) {
  const grid = document.getElementById('payGrid');
  const out = document.getElementById('cPay');
  if (!grid || !btn) return;
  grid.querySelectorAll('.pay-card').forEach(b => b.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', 'true');
  if (out) out.value = btn.dataset.method || 'wave';
}

function bindPaymentGrid() {
  const grid = document.getElementById('payGrid');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.pay-card');
    if (btn) setPaymentMethod(btn);
  });
}

/* ====== Commande -> Supabase + WhatsApp ====== */
function buildOrderMessage(orderRef, location) {
  const name  = (document.getElementById('cName')  || {}).value.trim() || 'Client';
  const phone = (document.getElementById('cPhone') || {}).value.trim() || '';
  const email = (document.getElementById('cEmail') || {}).value.trim() || '';
  const country = (document.getElementById('cCountry') || {}).value.trim() || t('dash');
  const city = (document.getElementById('cCity') || {}).value.trim() || t('dash');
  const district = (document.getElementById('cDistrict') || {}).value.trim() || t('dash');
  const pay = PAYMENT_LABELS[(document.getElementById('cPay') || {}).value] || 'Wave';

  const lines = [];
  lines.push(t('wa_new_order'));
  if (orderRef) lines.push(t('wa_ref') + ' ' + orderRef);
  lines.push(t('wa_name') + ' ' + name);
  lines.push(t('wa_phone') + ' ' + phone);
  if (email) lines.push(t('wa_email') + ' ' + email);
  lines.push(t('wa_location_line')(country, city, district));
  if (location && location.lat != null) {
    lines.push(t('wa_address_detected') + ' ' + (location.address || t('dash')));
    if (location.note) lines.push(t('wa_precision') + ' ' + location.note);
    lines.push(t('wa_position') + ' ' + location.mapsLink);
  }
  if (CART.length) {
    lines.push(t('wa_articles'));
    CART.forEach(l => {
      const bits = [];
      if (l.size) bits.push(l.size);
      if (l.color) bits.push(l.color);
      if (l.tissu) bits.push(l.tissu);
      if (l.optionKimono) bits.push(variantChoiceLabel(l.id, l.optionKimono));
      if (l.note) bits.push(t('wa_note') + ' ' + l.note);
      const detail = bits.length ? ' (' + bits.join(', ') + ')' : '';
      lines.push('- ' + l.name + detail + ' × ' + l.qty + ' — ' + formatMoney(l.price * l.qty, l.currency));
    });
  }
  lines.push(t('wa_total') + ' ' + formatCartTotals());
  lines.push(t('wa_payment') + ' ' + pay);
  return lines.join('\n');
}

function validateCheckoutForm() {
  const name = (document.getElementById('cName') || {}).value.trim();
  const phone = (document.getElementById('cPhone') || {}).value.trim();
  const email = (document.getElementById('cEmail') || {}).value.trim();
  if (!name) { alert(t('val_name_required')); return false; }
  if (name.length > 120) { alert(t('val_name_too_long')); return false; }
  if (!phone) { alert(t('val_phone_required')); return false; }
  if (!/^[0-9+ ().-]{6,30}$/.test(phone)) { alert(t('val_phone_invalid')); return false; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert(t('val_email_invalid')); return false; }
  return true;
}

async function haOrder() {
  if (!CART.length) { alert(t('val_cart_empty')); return false; }
  if (!validateCheckoutForm()) return false;

  const btn = document.getElementById('btnOrder');
  if (btn) { btn.disabled = true; btn.textContent = t('sending'); }

  try {
    saveClientInfoIfAsked();
    const location = (typeof getDeliveryLocation === 'function') ? getDeliveryLocation() : {};
    const val = id => (document.getElementById(id) || {}).value.trim();

    const payload = {
      customer: { name: val('cName'), phone: val('cPhone'), email: val('cEmail'), country: val('cCountry'), city: val('cCity'), district: val('cDistrict') },
      location: { lat: location.lat, lng: location.lng, address: location.address, note: location.note, maps_link: location.mapsLink },
      payment_method: (document.getElementById('cPay') || {}).value || 'wave',
      currency: CURRENT_CURRENCY,
      items: CART.map(l => ({
        product_id: (PRODUCTS.find(p => p.id === l.id) || {})._dbId,
        size: l.size, color: l.color, fabric: l.tissu, note: l.note,
        option_kimono: l.optionKimono, qty: l.qty
      }))
    };

    /* Nouvelle commande : on repart d'une référence et d'une facture vierges
       (sinon une commande hors-ligne réutiliserait celles de la précédente). */
    window.LAST_INVOICE_ID = null;
    window.LAST_INVOICE_BLOB = null;
    let orderRef = null;
    try {
      const result = await placeOrderRemote(payload);
      orderRef = result && result.order_ref;
      window.LAST_INVOICE_ID = orderRef;
    } catch (err) {
      console.error('placeOrderRemote:', err);
      if (err.isValidation) {
        /* Rejet volontaire du serveur (champ invalide, anti-abus...) :
           on arrête tout, la vendeuse ne doit pas recevoir de commande
           WhatsApp sans enregistrement correspondant côté Supabase. */
        alert(translateServerError(err.message));
        return false;
      }
      /* Panne réseau réelle (hors-ligne, etc.) : on continue quand même
         vers WhatsApp, qui reste la source de vérité opérationnelle. */
    }

    /* Message WhatsApp composé AVANT de vider le panier. Il part vers le
       numéro de Hadeej'Art (jamais vers un contact au choix). */
    const message = buildOrderMessage(orderRef, location) + '\n' + t('wa_invoice_note');
    const waUrl = `https://wa.me/${SITE_WA_NUMBER}?text=${encodeURIComponent(message)}`;
    const ref = orderRef || window.LAST_INVOICE_ID;

    if (typeof buildInvoiceImage === 'function') await buildInvoiceImage();
    window.LAST_INVOICE_BLOB = (typeof invoiceBlob === 'function') ? await invoiceBlob() : null;

    /* 1) télécharge la facture, 2) vide le panier, 3) écran de confirmation
       avec le numéro de commande, 4) ouvre WhatsApp vers Hadeej'Art. */
    if (typeof downloadInvoice === 'function') await downloadInvoice();
    window.LAST_ORDER = { ref, waUrl };

    /* Passage de relais d'historique : la fiche client cède son entrée
       d'historique à l'écran de confirmation (sinon le « retour » du navigateur,
       asynchrone, dépilerait la nouvelle entrée et pourrait faire quitter la page). */
    closeClient(true);
    if (typeof clearCart === 'function') clearCart();
    openOrderDone(true);

    /* Certains navigateurs mobiles bloquent l'ouverture automatique après
       des étapes asynchrones : le bouton « Confirmer sur WhatsApp » de
       l'écran de confirmation prend alors le relais. */
    try { window.open(waUrl, '_blank'); } catch (e) { /* bloqué : le bouton suffit */ }
    return true;
  } catch (err) {
    console.error('haOrder error:', err);
    alert(t('val_whatsapp_redirect_failed'));
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('place_order_btn'); }
  }
}

/* ====== Écran de confirmation après commande ====== */
let _orderDoneUrl = null;

function openOrderDone(reuseHistory) {
  const modal = document.getElementById('orderDone');
  if (!modal) return;
  const order = window.LAST_ORDER || {};
  const refEl = document.getElementById('odRef');
  if (refEl) refEl.textContent = order.ref || '';
  const img = document.getElementById('odPreview');
  if (img) {
    if (_orderDoneUrl) URL.revokeObjectURL(_orderDoneUrl);
    _orderDoneUrl = window.LAST_INVOICE_BLOB ? URL.createObjectURL(window.LAST_INVOICE_BLOB) : null;
    img.src = _orderDoneUrl || '';
    img.hidden = !_orderDoneUrl;
  }
  const wa = document.getElementById('odWhatsapp');
  if (wa) wa.href = order.waUrl || `https://wa.me/${SITE_WA_NUMBER}`;
  const copy = document.getElementById('odCopy');
  if (copy) copy.textContent = t('order_done_copy');
  modal.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (!reuseHistory && typeof pushOverlayHistory === 'function') pushOverlayHistory();
  const first = document.getElementById('odWhatsapp');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
}

function closeOrderDone(viaPopstate) {
  const modal = document.getElementById('orderDone');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
}

/* Retour à la boutique : ferme la confirmation et remonte au catalogue. */
function orderDoneBackToShop() {
  closeOrderDone();
  if (typeof scrollToCatalogue === 'function' && document.getElementById('catalogue')) scrollToCatalogue();
}

async function orderDoneCopyRef() {
  const ref = (window.LAST_ORDER || {}).ref || '';
  const btn = document.getElementById('odCopy');
  try {
    await navigator.clipboard.writeText(ref);
    if (btn) { btn.textContent = t('order_done_copied'); setTimeout(() => { btn.textContent = t('order_done_copy'); }, 2200); }
  } catch (e) {
    /* Presse-papiers indisponible : sélectionne le texte pour une copie manuelle */
    const el = document.getElementById('odRef');
    if (el && window.getSelection) { const r = document.createRange(); r.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }
}
