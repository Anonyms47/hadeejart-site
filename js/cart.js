/* ======================================================================
   Hadeej'Art — Panier
   ====================================================================== */

const el = sel => document.querySelector(sel);

/* Les champs libres (couleur, tissu, note) sont saisis par le visiteur :
   on échappe systématiquement avant de les insérer dans du HTML. */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

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
    CART.push(Object.assign({
      key, id, qty: 1,
      price: (opts.price != null ? opts.price : p.price),
      name: p.name,
      img: p.img
    }, opts));
  }
  updateCartUI();
}

function removeFromCart(key) {
  CART = CART.filter(l => l.key !== key);
  updateCartUI();
}

function achatDirect(id) {
  addToCart(id, {});
  /* Différé : sinon le même clic, en continuant sa bulle jusqu'à
     document, déclenche aussitôt la fermeture "clic en dehors" du
     panier (voir bindCartOutsideClose dans ui.js). */
  setTimeout(openCart, 0);
}

function cartTotal() {
  return CART.reduce((s, l) => s + l.price * l.qty, 0);
}

function updateCartUI() {
  const countEl = document.getElementById('cartCount');
  if (countEl) countEl.textContent = CART.reduce((s, l) => s + l.qty, 0);

  const lines = CART.map(l => {
    const bits = [];
    if (l.size) bits.push(l.size);
    if (l.color) bits.push(l.color);
    if (l.tissu) bits.push(l.tissu);
    if (l.optionKimono) bits.push(l.optionKimono === 'avec' ? 'Avec pantalon' : 'Sans pantalon');
    const detail = bits.length ? ' • ' + escapeHtml(bits.join(' • ')) : '';
    const name = escapeHtml(l.name);
    return `
    <div class="line">
      <span>${name}${detail} ×${l.qty}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <b>${formatPrice(l.price * l.qty)}</b>
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
  }).join('') || '<div class="small">Panier vide</div>';

  document.getElementById('cartLines').innerHTML = lines;
  const st = cartTotal();
  document.getElementById('cartSubtotal').textContent = formatPrice(st);
  document.getElementById('cartTotal').textContent = formatPrice(st);
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
