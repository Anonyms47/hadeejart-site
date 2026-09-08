/* ======================================================================
   Hadeej'Art — Catalogue (grille produits, filtre catégories, détail)
   ====================================================================== */

let CURRENT_CATEGORY = 'tous';
let CURRENT = null;

function productsInCategory(catId) {
  if (catId === 'tous') return PRODUCTS;
  return PRODUCTS.filter(p => p.category === catId);
}

function renderCategoryFilters() {
  const bar = document.getElementById('categoryFilters');
  if (!bar) return;
  bar.innerHTML = CATEGORIES.map(c => `
    <button type="button" class="chip${c.id === CURRENT_CATEGORY ? ' active' : ''}"
            data-cat="${escapeHtml(c.id)}" onclick="selectCategory('${escapeHtml(c.id)}')">${escapeHtml(c.label)}</button>
  `).join('');
}

function selectCategory(catId) {
  CURRENT_CATEGORY = catId;
  renderCategoryFilters();
  renderProducts();
}

function renderProducts() {
  const grid = el('#productGrid');
  if (!grid) return;

  if (!CATALOG_LOADED && !PRODUCTS.length) {
    grid.className = 'catalogue-skeleton';
    grid.innerHTML = Array.from({ length: 8 }).map((_, i) => `<div class="skeleton-card" style="--i:${i}"></div>`).join('')
      + `<p class="small" style="grid-column:1/-1">${escapeHtml(t('loading'))}</p>`;
    return;
  }
  grid.className = 'grid';

  const list = productsInCategory(CURRENT_CATEGORY);
  grid.innerHTML = list.map((p, i) => {
    const priceInfo = priceForProduct(p);
    return `
    <article class="card" style="--i:${i}">
      <img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async"
           onerror="this.style.objectFit='contain'; this.alt+=t('photo_coming');">
      <div class="cap">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="price">${formatMoney(priceInfo.amount, priceInfo.currency)}${priceInfo.isFallback ? ' <span class="small">(FCFA)</span>' : ''}</div>
        <div class="row">
          <button class="btn sm icon" onclick="addToCart('${escapeHtml(p.id)}', {})">🧺 ${escapeHtml(t('add'))}</button>
          <button class="btn sm ghost" onclick="achatDirect('${escapeHtml(p.id)}')">${escapeHtml(t('buy'))}</button>
          <button class="btn sm ghost" onclick="openDetail('${escapeHtml(p.id)}')">${escapeHtml(t('detail'))}</button>
        </div>
      </div>
    </article>`;
  }).join('') || `<p class="small">${escapeHtml(t('no_products'))}</p>`;
}

/* ====== DÉTAIL ====== */
function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  CURRENT = p;

  el('#dName').textContent = p.name;
  el('#dImg').src = p.img;
  el('#dImg').alt = p.name;
  if (el('#dColor')) el('#dColor').value = '';
  if (el('#dTissu')) el('#dTissu').value = p.fabric || '';
  if (el('#dNote'))  el('#dNote').value = '';
  if (el('#dSize')) {
    const sizeSel = el('#dSize');
    const sizes = (p.sizes && p.sizes.length) ? p.sizes : SIZES;
    sizeSel.innerHTML = sizes.map(s => `<option>${escapeHtml(s)}</option>`).join('');
    sizeSel.value = sizes.includes('M') ? 'M' : sizes[0];
  }
  if (el('#dSexe')) el('#dSexe').selectedIndex = 0; /* "Unisexe" est toujours la 1re option, quelle que soit la langue */

  const priceInfo = priceForProduct(p);
  const priceEl = document.getElementById('dPrice');
  if (priceEl) priceEl.textContent = formatMoney(priceInfo.amount, priceInfo.currency) + (priceInfo.isFallback ? t('price_unavailable_in')(CURRENT_CURRENCY) : '');

  const optBox = document.getElementById('detailOptions');
  const sexeEl = document.getElementById('dSexe');
  const sexeField = sexeEl ? (sexeEl.closest('.field') || sexeEl.parentElement) : null;
  const gendered = isGenderedProduct(p);

  if (optBox) {
    if (p.variantOptions) {
      const vo = p.variantOptions;
      optBox.innerHTML = `<label for="${escapeHtml(vo.id)}">${escapeHtml(vo.label)}</label>` +
        `<select id="${escapeHtml(vo.id)}" class="input">` +
        vo.choices.map(c => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('') +
        `</select>`;
      optBox.style.display = '';
    } else {
      optBox.innerHTML = '';
      optBox.style.display = 'none';
    }
  }
  if (sexeField) sexeField.style.display = gendered ? 'none' : '';

  el('#detail').classList.add('show');
}

function closeDetail() {
  document.getElementById('detail').classList.remove('show');
}

function addFromDetail() {
  if (!CURRENT) return;
  const productId = CURRENT.id;
  const color = el('#dColor') ? el('#dColor').value.trim() : '';
  const size  = el('#dSize')  ? el('#dSize').value  : '';
  const tissu = el('#dTissu') ? el('#dTissu').value.trim() : '';
  const note  = el('#dNote')  ? el('#dNote').value.trim()  : '';

  const gendered = isGenderedProduct(CURRENT);
  const sexe = gendered ? '' : (el('#dSexe') ? el('#dSexe').value : '');

  let optionKimono = '';
  if (CURRENT.variantOptions) {
    const sel = document.getElementById(CURRENT.variantOptions.id);
    optionKimono = sel ? (sel.value || '') : '';
  }

  addToCart(productId, { color, size, sexe, tissu, note, optionKimono });
  closeDetail();
  /* Différé : voir la note dans achatDirect() (cart.js). */
  setTimeout(openCart, 0);
}

function scrollToCatalogue() {
  document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' });
}

function openImageFullscreen(src) {
  document.getElementById('imgViewerImg').src = src;
  document.getElementById('imgViewer').classList.add('show');
}
function closeImageViewer() {
  document.getElementById('imgViewer').classList.remove('show');
}

/* Rafraîchit l'affichage quand la langue ou la devise change, sans
   re-télécharger le catalogue. */
function onLangChange() {
  refreshCatalogLabels();
  renderCategoryFilters();
  renderProducts();
  if (typeof refreshCartLanguage === 'function') refreshCartLanguage();
  if (typeof refreshMapStatusLabel === 'function') refreshMapStatusLabel();
  refreshOpenDetailLabels();
}

/* Si la fiche produit est ouverte, ré-affiche nom/prix/option dans la
   nouvelle langue sans effacer ce que le visiteur a déjà saisi. */
function refreshOpenDetailLabels() {
  if (!CURRENT || !document.getElementById('detail').classList.contains('show')) return;
  el('#dName').textContent = CURRENT.name;
  const priceInfo = priceForProduct(CURRENT);
  const priceEl = document.getElementById('dPrice');
  if (priceEl) priceEl.textContent = formatMoney(priceInfo.amount, priceInfo.currency) + (priceInfo.isFallback ? t('price_unavailable_in')(CURRENT_CURRENCY) : '');
  if (CURRENT.variantOptions) {
    const optLabel = document.querySelector('#detailOptions label');
    if (optLabel) optLabel.textContent = CURRENT.variantOptions.label;
    const sel = document.getElementById(CURRENT.variantOptions.id);
    if (sel) {
      [...sel.options].forEach((opt, i) => { opt.textContent = CURRENT.variantOptions.choices[i].label; });
    }
  }
}
function onCurrencyChange() {
  renderProducts();
  recomputeCartCurrency();
}
