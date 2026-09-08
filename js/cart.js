/* ======================================================================
   Hadeej'Art — Panier
   ====================================================================== */

const el = sel => document.querySelector(sel);

let CART = [];

function cartLineKey(id, opts) {
  opts = opts || {};
  return [id, opts.color || '', opts.size || '', opts.sexe || '', opts.optionKimono || '', opts.tissu || '', opts.note || ''].join('|');
}

function addToCart(id, opts) {
  opts = opts || {};
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) { console.warn('addToCart: produit introuvable', id); return; }
  const key = cartLineKey(id, opts);
  const found = CART.find(l => l.key === key);
  if (found) {
    found.qty++;
  } else {
    const priceInfo = priceForProduct(p, opts.optionKimono);
    CART.push(Object.assign({
      key, id, qty: 1,
      price: priceInfo.amount,
      currency: priceInfo.currency,
      name: p.name,
      img: p.img
    }, opts));
  }
  updateCartUI();
  if (typeof bumpCartIcon === 'function') bumpCartIcon();
}

/* Recalcule le prix de chaque ligne dans la devise active (appelé quand
   le visiteur change de devise après avoir déjà rempli son panier). */
function recomputeCartCurrency() {
  CART.forEach(l => {
    const p = PRODUCTS.find(x => x.id === l.id);
    if (!p) return;
    const priceInfo = priceForProduct(p, l.optionKimono);
    l.price = priceInfo.amount;
    l.currency = priceInfo.currency;
  });
  updateCartUI();
}

/* Ré-affiche chaque ligne déjà présente dans le panier avec le nom
   traduit dans la nouvelle langue (le nom est figé au moment de l'ajout
   sinon, y compris dans le message WhatsApp et la facture). */
function refreshCartLanguage() {
  CART.forEach(l => {
    const p = PRODUCTS.find(x => x.id === l.id);
    if (p) l.name = p.name;
  });
  updateCartUI();
}

function removeFromCart(key) {
  CART = CART.filter(l => l.key !== key);
  updateCartUI();
}

/* Certaines lignes peuvent retomber en FCFA si le produit n'a pas de prix
   dans la devise active : on ne mélange jamais deux devises dans un seul
   total (sinon les nombres n'ont plus de sens). On regroupe donc par
   devise réellement utilisée par chaque ligne. */
function cartTotalsByCurrency() {
  const totals = {};
  CART.forEach(l => {
    const cur = l.currency || CURRENT_CURRENCY;
    totals[cur] = (totals[cur] || 0) + l.price * l.qty;
  });
  return totals;
}

function cartTotal() {
  const totals = cartTotalsByCurrency();
  return totals[CURRENT_CURRENCY] || 0;
}

function formatCartTotals() {
  const totals = cartTotalsByCurrency();
  const currencies = Object.keys(totals);
  if (!currencies.length) return formatPrice(0);
  return currencies.map(c => formatMoney(totals[c], c)).join(' + ');
}

function updateCartUI() {
  const countEl = document.getElementById('cartCount');
  if (countEl) countEl.textContent = CART.reduce((s, l) => s + l.qty, 0);

  const lines = CART.map(l => {
    const bits = [];
    if (l.size) bits.push(l.size);
    if (l.color) bits.push(l.color);
    if (l.tissu) bits.push(l.tissu);
    if (l.optionKimono) bits.push(variantChoiceLabel(l.id, l.optionKimono));
    const detail = bits.length ? ' • ' + escapeHtml(bits.join(' • ')) : '';
    const name = escapeHtml(l.name);
    return `
    <div class="line">
      <span>${name}${detail} ×${l.qty}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <b>${formatMoney(l.price * l.qty, l.currency)}</b>
        <button class="trash" aria-label="Supprimer ${name}" title="Supprimer"
                data-key="${escapeHtml(l.key)}">
          <svg viewBox="0 0 24 24">
            <path d="M3 6h18M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </span>
    </div>`;
  }).join('') || `<div class="small">${escapeHtml(t('empty_cart'))}</div>`;

  document.getElementById('cartLines').innerHTML = lines;
  const totalsText = formatCartTotals();
  document.getElementById('cartSubtotal').textContent = totalsText;
  document.getElementById('cartTotal').textContent = totalsText;
}

function bindCartLineActions() {
  const lines = document.getElementById('cartLines');
  if (!lines) return;
  lines.addEventListener('click', e => {
    const btn = e.target.closest('.trash');
    if (btn) removeFromCart(btn.dataset.key);
  });
}

function openCart() {
  document.getElementById('cartPanel').classList.add('show');
}
function closeCart() {
  document.getElementById('cartPanel').classList.remove('show');
}
function toggleCart() {
  document.getElementById('cartPanel').classList.toggle('show');
}
