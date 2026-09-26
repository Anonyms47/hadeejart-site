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

    if (typeof buildInvoiceImage === 'function') await buildInvoiceImage();

    let shared = false;
    if (typeof shareInvoiceWhatsApp === 'function') {
      shared = await shareInvoiceWhatsApp(() => buildOrderMessage(orderRef, location));
    }
    if (!shared) {
      const msg = encodeURIComponent(buildOrderMessage(orderRef, location));
      const waUrl = `https://wa.me/${SITE_WA_NUMBER}?text=${msg}`;
      /* Après plusieurs étapes asynchrones (enregistrement, facture), certains
         navigateurs mobiles bloquent l'ouverture d'une nouvelle fenêtre : on
         bascule alors sur la page courante, la commande étant déjà enregistrée. */
      const popup = window.open(waUrl, '_blank');
      if (!popup) window.location.href = waUrl;
    }

    closeClient();
    return true;
  } catch (err) {
    console.error('haOrder error:', err);
    alert(t('val_whatsapp_redirect_failed'));
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('place_order_btn'); }
  }
}
