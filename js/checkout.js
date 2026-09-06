/* ======================================================================
   Hadeej'Art — Client, moyen de paiement, commande WhatsApp
   ====================================================================== */

const SITE_WA_NUMBER = '781444340'; /* numéro WhatsApp (sans +) */

function openClient() {
  if (!CART.length) { openCart(); return; }
  document.getElementById('client').classList.add('show');
}
function closeClient() {
  document.getElementById('client').classList.remove('show');
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
    setVal('cAddr', u.addr);
    const remember = document.getElementById('cRemember');
    if (remember) remember.checked = true;
    selectPaymentMethodByName(u.pay || 'Espèces');
  } catch (e) { /* ignore données corrompues */ }
}

function saveClientInfoIfAsked() {
  const remember = document.getElementById('cRemember');
  if (remember && remember.checked) {
    localStorage.setItem('ha_user', JSON.stringify({
      name: (document.getElementById('cName') || {}).value || '',
      phone: (document.getElementById('cPhone') || {}).value || '',
      addr: (document.getElementById('cAddr') || {}).value || '',
      pay: (document.getElementById('cPay') || {}).value || 'Espèces'
    }));
  } else {
    localStorage.removeItem('ha_user');
  }
}

/* ====== Moyen de paiement (chips) ====== */
function selectPaymentMethodByName(name) {
  const grid = document.getElementById('payGrid');
  if (!grid) return;
  const btn = grid.querySelector(`.pay-card[data-method="${CSS.escape(name)}"]`) || grid.querySelector('.pay-card');
  if (btn) setPaymentMethod(btn);
}

function setPaymentMethod(btn) {
  const grid = document.getElementById('payGrid');
  const out = document.getElementById('cPay');
  if (!grid || !btn) return;
  grid.querySelectorAll('.pay-card').forEach(b => b.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', 'true');
  if (out) out.value = btn.dataset.method || 'Espèces';
}

function bindPaymentGrid() {
  const grid = document.getElementById('payGrid');
  if (!grid) return;
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.pay-card');
    if (btn) setPaymentMethod(btn);
  });
}

/* ====== Commande -> WhatsApp ====== */
function buildOrderMessage() {
  const name  = (document.getElementById('cName')  || {}).value.trim() || 'Client';
  const phone = (document.getElementById('cPhone') || {}).value.trim() || '';
  const addr  = (document.getElementById('cAddr')  || {}).value.trim() || '';
  const pay   = (document.getElementById('cPay')   || {}).value || 'Espèces';
  const total = cartTotal();

  const lines = [];
  lines.push('*Nouvelle commande — Hadeej’Art*');
  lines.push('Nom: ' + name);
  lines.push('Téléphone: ' + phone);
  lines.push('Adresse de livraison: ' + (addr || '—'));
  if (CART.length) {
    lines.push('*Articles:*');
    CART.forEach(l => {
      const bits = [];
      if (l.size) bits.push(l.size);
      if (l.color) bits.push(l.color);
      if (l.tissu) bits.push(l.tissu);
      if (l.optionKimono) bits.push(l.optionKimono === 'avec' ? 'Avec pantalon' : 'Sans pantalon');
      if (l.note) bits.push('Note: ' + l.note);
      const detail = bits.length ? ' (' + bits.join(', ') + ')' : '';
      lines.push('- ' + l.name + detail + ' × ' + l.qty + ' — ' + formatPrice(l.price * l.qty));
    });
  }
  lines.push('Total: ' + formatPrice(total));
  lines.push('Paiement: ' + pay);
  if (window.LAST_INVOICE_ID) lines.push('Réf. facture: ' + window.LAST_INVOICE_ID);
  return lines.join('\n');
}

async function haOrder() {
  if (!CART.length) {
    alert('Votre panier est vide.');
    return false;
  }
  try {
    saveClientInfoIfAsked();

    /* Génère la facture image puis tente un partage direct (mobile),
       sinon on télécharge l'image et on ouvre WhatsApp avec le récap texte. */
    let shared = false;
    if (typeof buildInvoiceImage === 'function') {
      await buildInvoiceImage();
      if (typeof shareInvoiceWhatsApp === 'function') {
        shared = await shareInvoiceWhatsApp();
      }
    }

    if (!shared) {
      const msg = encodeURIComponent(buildOrderMessage());
      window.open(`https://wa.me/${SITE_WA_NUMBER}?text=${msg}`, '_blank');
    }

    closeClient();
    return true;
  } catch (err) {
    console.error('haOrder error:', err);
    alert("Redirection WhatsApp impossible. Vérifiez les champs et réessayez.");
    return false;
  }
}
