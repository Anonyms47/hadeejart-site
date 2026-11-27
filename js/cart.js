/* ======================================================================
   Hadeej'Art — Panier
   ====================================================================== */

const el = sel => document.querySelector(sel);

let CART = [];
let _cartLastAddedKey = null; /* ligne à mettre en avant au prochain rendu */
let _cartLocked = false;      /* le tiroir tient-il actuellement le verrou de défilement ? */
let _cartReturnFocus = null;  /* élément qui avait le focus avant l'ouverture */
let _cartNotices = [];        /* messages à afficher dans le panier (prix changé, article retiré…) */

/* ====== Persistance du panier (localStorage) ======
   Le panier survit à la navigation entre pages et au rechargement. Les
   données stockées ne sont JAMAIS dignes de confiance : elles sont
   revalidées à la lecture (forme, bornes) puis rapprochées du catalogue
   réel (reconcileCart), et le serveur recalcule de toute façon prix et
   disponibilité à l'envoi (place_order). */
const CART_STORAGE_KEY = 'ha_cart_v1';
const CART_TEXT_FIELDS = ['color', 'size', 'sexe', 'optionKimono', 'tissu', 'note'];

function saveCart() {
  try {
    if (!CART.length) localStorage.removeItem(CART_STORAGE_KEY);
    else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(CART.map(l => {
      const o = { key: l.key, id: l.id, qty: l.qty, price: l.price, currency: l.currency, name: l.name, img: l.img };
      CART_TEXT_FIELDS.forEach(f => { if (l[f]) o[f] = l[f]; });
      return o;
    })));
  } catch (e) { /* stockage indisponible (navigation privée…) : le panier reste en mémoire */ }
}

function sanitizeCartLine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const id = str(raw.id, 120);
  const qty = Math.floor(Number(raw.qty));
  const price = Number(raw.price);
  if (!id || !(qty >= 1) || !Number.isFinite(price) || price < 0) return null;
  const line = {
    id, qty: Math.min(qty, 50), price,
    currency: SUPPORTED_CURRENCIES.includes(raw.currency) ? raw.currency : 'FCFA',
    name: str(raw.name, 200) || id,
    img: /^(https:\/\/|images\/)/.test(raw.img || '') ? str(raw.img, 600) : ''
  };
  CART_TEXT_FIELDS.forEach(f => { line[f] = str(raw[f], f === 'note' ? 500 : 120); });
  line.key = cartLineKey(id, line);
  return line;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('format');
    const seen = new Set();
    CART = arr.slice(0, 30).map(sanitizeCartLine).filter(l => l && !seen.has(l.key) && seen.add(l.key));
  } catch (e) {
    CART = [];
    try { localStorage.removeItem(CART_STORAGE_KEY); } catch (e2) { /* ignoré */ }
  }
}

/* Problème bloquant d'une ligne (taille/option manquante ou retirée du
   catalogue, produit épuisé) ; chaîne vide si la ligne est commandable. */
function cartLineIssue(l) {
  const p = PRODUCTS.find(x => x.id === l.id);
  if (!p) return PRODUCTS.length ? 'gone' : '';
  if (p.soldOut) return 'soldout';
  if (p.sizes && p.sizes.length) {
    if (!l.size) return 'size';
    if (!p.sizes.includes(l.size) || (p.unavailableSizes || []).includes(l.size)) return 'size_unavailable';
  }
  if (p.variantOptions) {
    if (!l.optionKimono) return 'option';
    if (!p.variantOptions.choices.some(c => c.value === l.optionKimono)) return 'option';
  }
  return '';
}

function cartHasIssues() { return CART.some(l => cartLineIssue(l)); }

/* Rapproche le panier du catalogue frais : retire les produits supprimés,
   met à jour nom/photo/prix et prévient le visiteur de tout changement. */
function reconcileCart() {
  if (!CART.length || !PRODUCTS.length) return;
  const notices = [];
  CART = CART.filter(l => {
    if (PRODUCTS.some(x => x.id === l.id)) return true;
    notices.push(t('cart_notice_removed')(l.name));
    return false;
  });
  CART.forEach(l => {
    const p = PRODUCTS.find(x => x.id === l.id);
    l.name = p.name;
    if (p.img) l.img = p.img;
    const info = priceForProduct(p, l.optionKimono);
    if (l.optionKimono && !(p.variantOptions && p.variantOptions.choices.some(c => c.value === l.optionKimono))) return;
    if (info.amount !== l.price || info.currency !== l.currency) {
      if (l.price && info.amount !== l.price && info.currency === l.currency) notices.push(t('cart_notice_price')(l.name));
      l.price = info.amount; l.currency = info.currency;
    }
  });
  if (notices.length) _cartNotices = _cartNotices.concat(notices);
  updateCartUI();
}

/* Devise réelle de la commande : jamais deux devises mélangées et aucune
   conversion inventée. Si un article n'a pas de prix dans la devise
   choisie, toute la commande repasse en FCFA (le prix FCFA est toujours
   renseigné) et le visiteur en est prévenu avant l'envoi. */
function cartOrderCurrency() {
  const cur = new Set(CART.map(l => l.currency || CURRENT_CURRENCY));
  return cur.size === 1 ? [...cur][0] : 'FCFA';
}
/* Vue de la commande telle qu'elle sera réellement envoyée : lignes, devise
   unique et total des ARTICLES (la livraison n'est jamais incluse ici). */
function cartOrderView() {
  const cur = cartOrderCurrency();
  const lines = CART.map(l => {
    if ((l.currency || CURRENT_CURRENCY) === cur) return l;
    const p = PRODUCTS.find(x => x.id === l.id);
    const info = p ? priceForProduct(p, l.optionKimono, cur) : { amount: l.price, currency: cur };
    return Object.assign({}, l, { price: info.amount, currency: info.currency });
  });
  return { currency: cur, lines, total: lines.reduce((s, l) => s + l.price * l.qty, 0), mixed: cartMixedCurrencies() };
}
function cartMixedCurrencies() { return new Set(CART.map(l => l.currency || CURRENT_CURRENCY)).size > 1; }

function cartLineKey(id, opts) {
  opts = opts || {};
  return [id, opts.color || '', opts.size || '', opts.sexe || '', opts.optionKimono || '', opts.tissu || '', opts.note || ''].join('|');
}

function addToCart(id, opts) {
  opts = opts || {};
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) { console.warn('addToCart: produit introuvable', id); return; }
  const key = cartLineKey(id, opts);
  _cartLastAddedKey = key;
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

/* Vide le panier (après une commande enregistrée). */
function clearCart() {
  CART = [];
  _cartLastAddedKey = null;
  updateCartUI();
  closeCart();
}

function cartItemCount() {
  return CART.reduce((s, l) => s + l.qty, 0);
}

/* Modifie la quantité d'une ligne (0 ou moins = retrait). Plafonné à 50,
   comme la validation côté serveur (place_order). */
function setCartQty(key, qty) {
  const line = CART.find(l => l.key === key);
  if (!line) return;
  if (qty <= 0) { removeFromCart(key); return; }
  line.qty = Math.min(qty, 50);
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

/* Illustration de l'état vide : un cabas wax, dessiné en SVG (aucune image
   externe, hérite des couleurs de la marque). */
const CART_EMPTY_SVG = `
<svg class="cart-empty-art" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="cartWax" width="26" height="26" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" fill="#1f3a5f"/>
      <circle cx="13" cy="13" r="9.5" fill="#f2b90c"/><circle cx="13" cy="13" r="6" fill="#fff7f1"/>
      <circle cx="13" cy="13" r="2.6" fill="#b5432a"/>
    </pattern>
  </defs>
  <ellipse cx="80" cy="138" rx="52" ry="7" fill="#2b1e12" opacity=".12"/>
  <path d="M52 62C52 22 108 22 108 62" fill="none" stroke="#7a4b21" stroke-width="7" stroke-linecap="round"/>
  <path d="M34 58h92l10 76H24z" fill="url(#cartWax)" stroke="#2b1e12" stroke-width="3" stroke-linejoin="round"/>
  <path d="M34 58h92l1.6 12H32.400z" fill="#7a4b21" stroke="#2b1e12" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="80" cy="66" r="3.4" fill="#f2b90c"/>
</svg>`;

const CART_TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

function cartLineHtml(l, i) {
  const issue = cartLineIssue(l);
  const chips = [];
  if (l.size) chips.push(l.size);
  if (l.color) chips.push(l.color);
  if (l.tissu) chips.push(l.tissu);
  if (l.optionKimono) chips.push(variantChoiceLabel(l.id, l.optionKimono));
  const name = escapeHtml(l.name);
  const key = escapeHtml(l.key);
  const thumb = l.img
    ? `<img src="${escapeHtml(l.img)}" alt="" loading="lazy">`
    : `<span class="cart-thumb-ph" aria-hidden="true">H</span>`;
  const unit = l.qty > 1
    ? `<span class="cart-unit">${escapeHtml(formatMoney(l.price, l.currency))} / ${escapeHtml(t('cart_unit'))}</span>`
    : '';
  return `
    <article class="cart-line${l.key === _cartLastAddedKey ? ' is-new' : ''}" data-key="${key}" style="--i:${i}">
      <div class="cart-thumb">${thumb}</div>
      <div class="cart-info">
        <h5 class="cart-name">${name}</h5>
        ${chips.length ? `<ul class="cart-chips">${chips.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
        ${issue ? `<p class="cart-issue" role="alert">${escapeHtml(t('cart_issue_' + issue))} <button type="button" class="cart-issue-fix" data-act="fix" data-key="${key}">${escapeHtml(t('cart_issue_fix'))}</button></p>` : ''}
        <div class="cart-line-foot">
          <div class="qty" role="group" aria-label="${escapeHtml(t('cart_qty_label'))}">
            <button type="button" class="qty-btn" data-act="dec" data-key="${key}" aria-label="${escapeHtml(t('cart_qty_dec'))}">&minus;</button>
            <output class="qty-val" aria-live="polite">${l.qty}</output>
            <button type="button" class="qty-btn" data-act="inc" data-key="${key}" aria-label="${escapeHtml(t('cart_qty_inc'))}">+</button>
          </div>
          <div class="cart-price"><b>${escapeHtml(formatMoney(l.price * l.qty, l.currency))}</b>${unit}</div>
        </div>
      </div>
      <button type="button" class="cart-remove" data-act="remove" data-key="${key}"
              aria-label="${escapeHtml(t('cart_remove'))} : ${name}" title="${escapeHtml(t('cart_remove'))}">${CART_TRASH_SVG}</button>
    </article>`;
}

function cartEmptyHtml() {
  return `
    <div class="cart-empty">
      ${CART_EMPTY_SVG}
      <h5>${escapeHtml(t('cart_empty_title'))}</h5>
      <p>${escapeHtml(t('cart_empty_text'))}</p>
      <button type="button" class="btn" data-act="shop">${escapeHtml(t('cart_empty_cta'))}</button>
    </div>`;
}

function updateCartUI() {
  saveCart();
  const count = cartItemCount();
  const countEl = document.getElementById('cartCount');
  if (countEl) countEl.textContent = count;

  const panel = document.getElementById('cartPanel');
  if (panel) panel.classList.toggle('is-empty', !CART.length);
  const chip = document.getElementById('cartCountChip');
  if (chip) {
    chip.hidden = !count;
    chip.textContent = count + ' ' + t(count === 1 ? 'cart_item_one' : 'cart_item_many');
  }

  const host = document.getElementById('cartLines');
  if (!host) return;

  /* Le rendu remplace tout le contenu : on retient l'élément actif pour
     rendre le focus au même bouton (sinon le clavier est renvoyé en haut
     de page à chaque « + » ou « − »). */
  const active = document.activeElement;
  const focused = active && host.contains(active) && active.dataset && active.dataset.act
    ? { key: active.dataset.key, act: active.dataset.act } : null;

  host.innerHTML = CART.length ? CART.map(cartLineHtml).join('') : cartEmptyHtml();
  _cartLastAddedKey = null;

  if (focused) {
    const target = [...host.querySelectorAll('[data-act][data-key]')].find(b => b.dataset.key === focused.key && b.dataset.act === focused.act)
      || host.querySelector('.qty-btn, .cart-remove');
    if (target) target.focus({ preventScroll: true });
  }

  /* Total des articles uniquement : la livraison n'est pas connue ici. */
  const view = cartOrderView();
  const totalsText = CART.length ? formatMoney(view.total, view.currency) : formatPrice(0);
  const tot = document.getElementById('cartTotal');
  if (tot) tot.textContent = totalsText;

  const notices = document.getElementById('cartNotices');
  if (notices) {
    const msgs = _cartNotices.slice();
    if (cartMixedCurrencies()) msgs.push(t('cart_notice_fcfa'));
    notices.innerHTML = msgs.map(m => `<p class="cart-notice">${escapeHtml(m)}</p>`).join('');
    notices.hidden = !msgs.length;
  }
  const checkout = document.querySelector('#cartFoot .cart-checkout');
  if (checkout) {
    const blocked = !CART.length || cartHasIssues();
    checkout.disabled = blocked;
    checkout.setAttribute('aria-disabled', blocked ? 'true' : 'false');
  }
}

function bindCartLineActions() {
  const host = document.getElementById('cartLines');
  if (!host) return;
  host.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const key = btn.dataset.key;
    const line = CART.find(l => l.key === key);
    switch (btn.dataset.act) {
      case 'inc': if (line) setCartQty(key, line.qty + 1); break;
      case 'dec': if (line) setCartQty(key, line.qty - 1); break;
      case 'remove': {
        const row = btn.closest('.cart-line');
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (row && !reduce) { row.classList.add('is-leaving'); setTimeout(() => removeFromCart(key), 220); }
        else removeFromCart(key);
        break;
      }
      case 'fix': {
        const issue = line ? cartLineIssue(line) : '';
        if (issue === 'gone' && line) removeFromCart(key);
        else if (line && typeof openDetail === 'function') { closeCart(); removeFromCart(key); openDetail(line.id); }
        break;
      }
      case 'shop': cartGoShop(); break;
    }
  });
}

/* Depuis l'état vide : referme le tiroir et amène au catalogue. */
function cartGoShop() {
  closeCart();
  if (typeof scrollToCatalogue === 'function' && document.getElementById('catalogue')) scrollToCatalogue();
}

function isCartOpen() {
  const panel = document.getElementById('cartPanel');
  return !!(panel && panel.classList.contains('show'));
}

function openCart() {
  const panel = document.getElementById('cartPanel');
  const overlay = document.getElementById('cartOverlay');
  if (!panel || panel.classList.contains('show')) return;
  _cartReturnFocus = document.activeElement;
  panel.classList.add('opening');
  setTimeout(() => panel.classList.remove('opening'), 1100);
  panel.classList.add('show');
  if (overlay) overlay.classList.add('show');
  panel.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('cartBtn');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  if (!_cartLocked && typeof lockBodyScroll === 'function') { lockBodyScroll(); _cartLocked = true; }
  const closeBtn = document.getElementById('cartClose');
  if (closeBtn) setTimeout(() => closeBtn.focus({ preventScroll: true }), 30);
}

function closeCart() {
  const panel = document.getElementById('cartPanel');
  const overlay = document.getElementById('cartOverlay');
  if (!panel || !panel.classList.contains('show')) return;
  if (_cartNotices.length) { _cartNotices = []; updateCartUI(); }
  panel.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
  panel.setAttribute('aria-hidden', 'true');
  const btn = document.getElementById('cartBtn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (_cartLocked && typeof unlockBodyScroll === 'function') { unlockBodyScroll(); _cartLocked = false; }
  const back = _cartReturnFocus && document.contains(_cartReturnFocus) ? _cartReturnFocus : btn;
  _cartReturnFocus = null;
  if (back && back.focus) back.focus({ preventScroll: true });
}

function toggleCart() {
  if (isCartOpen()) closeCart(); else openCart();
}