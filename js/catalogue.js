/* ======================================================================
   Hadeej'Art — Catalogue (grille produits, filtre catégories, détail)
   ====================================================================== */

let CURRENT_CATEGORY = 'tous';
let CURRENT_COLLECTION = null;
let CURRENT = null;

function productsInCategory(catId) {
  if (catId === 'tous') return PRODUCTS;
  return PRODUCTS.filter(p => p.category === catId);
}

/* Liste affichée dans la grille : une collection choisie dans le menu
   "Collections" prime sur le filtre de catégorie (les deux ne se
   combinent pas, pour rester simple et lisible pour la cliente). */
function currentProductList() {
  if (CURRENT_COLLECTION) return PRODUCTS.filter(p => (p.collectionSlugs || []).includes(CURRENT_COLLECTION));
  return productsInCategory(CURRENT_CATEGORY);
}

function selectCollection(slug) {
  CURRENT_COLLECTION = slug;
  CURRENT_CATEGORY = 'tous';
  renderCategoryFilters();
  renderProducts();
  scrollToCatalogue();
  if (typeof closeAllNavMenus === 'function') closeAllNavMenus();
}

function clearCollectionFilter() {
  CURRENT_COLLECTION = null;
  renderProducts();
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
  CURRENT_COLLECTION = null;
  renderCategoryFilters();
  renderProducts();
  if (typeof closeAllNavMenus === 'function') closeAllNavMenus();
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
  renderActiveCollectionBanner();

  const list = currentProductList();
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
          <button class="btn sm ghost" onclick="openDetail('${escapeHtml(p.id)}')">${escapeHtml(t('detail'))}</button>
        </div>
      </div>
    </article>`;
  }).join('') || `<p class="small">${escapeHtml(t('no_products'))}</p>`;
}

/* Bandeau au-dessus de la grille quand une collection est sélectionnée
   depuis le menu "Collections", avec un bouton pour revenir au catalogue
   complet. */
function renderActiveCollectionBanner() {
  const host = document.getElementById('activeCollectionBanner');
  if (!host) return;
  if (!CURRENT_COLLECTION) { host.innerHTML = ''; host.hidden = true; return; }
  const col = COLLECTIONS.find(c => c.id === CURRENT_COLLECTION);
  const label = col ? col.label : CURRENT_COLLECTION;
  host.hidden = false;
  host.innerHTML = `
    <span>${escapeHtml(t('active_collection_label'))} <b>${escapeHtml(label)}</b></span>
    <button type="button" class="btn ghost sm" onclick="clearCollectionFilter()">${escapeHtml(t('clear_filter'))}</button>
  `;
}

/* ====== DÉTAIL ====== */
let CURRENT_GALLERY_INDEX = 0;

/* Galerie : toutes les images du produit (repli sur l'image principale
   seule si une seule photo). La bande de vignettes n'est affichée que
   s'il y a plus d'une image. */
function renderDetailGallery(p) {
  const images = (p.images && p.images.length) ? p.images : [p.img];
  CURRENT_GALLERY_INDEX = 0;
  const mainImg = el('#dImg');
  if (mainImg) { mainImg.src = images[0]; mainImg.alt = p.name; }
  const thumbs = document.getElementById('dThumbs');
  if (!thumbs) return;
  if (images.length <= 1) {
    thumbs.innerHTML = '';
    thumbs.hidden = true;
    return;
  }
  thumbs.hidden = false;
  thumbs.innerHTML = images.map((src, i) => `
    <button type="button" class="thumb${i === 0 ? ' active' : ''}" onclick="selectGalleryImage(${i})">
      <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">
    </button>`).join('');
}

function selectGalleryImage(i) {
  if (!CURRENT) return;
  const images = (CURRENT.images && CURRENT.images.length) ? CURRENT.images : [CURRENT.img];
  if (i < 0 || i >= images.length) return;
  CURRENT_GALLERY_INDEX = i;
  const mainImg = el('#dImg');
  if (mainImg) {
    mainImg.src = images[i];
    mainImg.classList.remove('switching');
    void mainImg.offsetWidth; /* relance l'animation de fondu même si elle vient de jouer */
    mainImg.classList.add('switching');
  }
  document.querySelectorAll('#dThumbs .thumb').forEach((btn, idx) => btn.classList.toggle('active', idx === i));
}

/* Catégorie + collection(s) du produit (données réelles déjà chargées,
   aucune information inventée) et une ligne de disponibilité honnête :
   un produit affiché est par définition publié donc disponible, et le
   délai réel est communiqué par WhatsApp après la commande (cf. CGV) —
   on ne peut pas afficher un délai précis que le site n'a jamais connu. */
function renderDetailMeta(p) {
  const meta = document.getElementById('dMeta');
  if (!meta) return;
  const tags = [];
  const cat = CATEGORIES.find(c => c.id === p.category);
  if (cat) tags.push(`<span class="tag">${escapeHtml(cat.label)}</span>`);
  (p.collectionSlugs || []).forEach(slug => {
    const col = COLLECTIONS.find(c => c.id === slug);
    if (col) tags.push(`<span class="tag tag-collection">${escapeHtml(col.label)}</span>`);
  });
  meta.innerHTML = tags.length ? `<div class="detail-tags">${tags.join('')}</div>` : '';
}

function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  CURRENT = p;

  el('#dName').textContent = p.name;
  renderDetailGallery(p);
  renderDetailMeta(p);
  if (el('#dColor')) el('#dColor').value = '';
  if (el('#dTissu')) el('#dTissu').value = p.fabric || '';
  if (el('#dNote'))  el('#dNote').value = '';
  if (el('#dSize')) {
    const sizeSel = el('#dSize');
    const sizes = (p.sizes && p.sizes.length) ? p.sizes : SIZES;
    sizeSel.innerHTML = sizes.map(s => `<option>${escapeHtml(s)}</option>`).join('');
    sizeSel.value = sizes.includes('M') ? 'M' : sizes[0];
    if (typeof enhanceSelect === 'function') enhanceSelect(sizeSel);
    if (typeof refreshEpicSelect === 'function') refreshEpicSelect(sizeSel);
  }
  if (el('#dSexe')) {
    const sexeSel = el('#dSexe');
    sexeSel.selectedIndex = 0; /* "Unisexe" est toujours la 1re option, quelle que soit la langue */
    if (typeof enhanceSelect === 'function') enhanceSelect(sexeSel);
    if (typeof refreshEpicSelect === 'function') refreshEpicSelect(sexeSel);
  }

  const priceInfo = priceForProduct(p);
  const priceEl = document.getElementById('dPrice');
  if (priceEl) priceEl.textContent = formatMoney(priceInfo.amount, priceInfo.currency) + (priceInfo.isFallback ? t('price_unavailable_in')(CURRENT_CURRENCY) : '');

  const optBox = document.getElementById('detailOptions');
  const sexeEl = document.getElementById('dSexe');
  const sexeField = sexeEl ? (sexeEl.closest('.field') || sexeEl.parentElement) : null;
  const gendered = isGenderedProduct(p);

  if (optBox) {
    /* La liste "épique" d'un éventuel select précédent vit dans <body>
       (portail), pas dans optBox : la détruire explicitement avant de
       jeter son support, sinon elle resterait orpheline dans le DOM. */
    const prevSelect = optBox.querySelector('select');
    if (prevSelect && prevSelect._epicDestroy) prevSelect._epicDestroy();
    if (p.variantOptions) {
      const vo = p.variantOptions;
      optBox.innerHTML = `<label for="${escapeHtml(vo.id)}">${escapeHtml(vo.label)}</label>` +
        `<select id="${escapeHtml(vo.id)}" class="input">` +
        vo.choices.map(c => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('') +
        `</select>`;
      optBox.style.display = '';
      const variantSel = document.getElementById(vo.id);
      if (variantSel && typeof enhanceSelect === 'function') enhanceSelect(variantSel);
    } else {
      optBox.innerHTML = '';
      optBox.style.display = 'none';
    }
  }
  if (sexeField) sexeField.style.display = gendered ? 'none' : '';

  const modal = el('#detail');
  if (modal.classList.contains('show')) return; /* déjà ouverte (ex: ré-ouverte pour un autre produit sans passer par une fermeture) */
  modal.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (typeof pushOverlayHistory === 'function') pushOverlayHistory();
}

function closeDetail(viaPopstate) {
  const modal = document.getElementById('detail');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
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
  /* Différé : sinon le même clic, en continuant sa bulle jusqu'à document,
     déclenche aussitôt la fermeture "clic en dehors" du panier (voir
     bindCartOutsideClose dans ui.js). */
  setTimeout(openCart, 0);
}

function scrollToCatalogue() {
  document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' });
}

function openImageFullscreen(src) {
  const viewer = document.getElementById('imgViewer');
  if (viewer.classList.contains('show')) { document.getElementById('imgViewerImg').src = src; return; }
  document.getElementById('imgViewerImg').src = src;
  viewer.classList.add('show');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (typeof pushOverlayHistory === 'function') pushOverlayHistory();
}
function closeImageViewer(viaPopstate) {
  const viewer = document.getElementById('imgViewer');
  if (!viewer || !viewer.classList.contains('show')) return;
  viewer.classList.remove('show');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
}

/* Rafraîchit l'affichage quand la langue ou la devise change, sans
   re-télécharger le catalogue. */
function onLangChange() {
  refreshCatalogLabels();
  renderCategoryFilters();
  renderProducts();
  if (typeof refreshCartLanguage === 'function') refreshCartLanguage();
  if (typeof refreshMapStatusLabel === 'function') refreshMapStatusLabel();
  if (typeof renderNavMenus === 'function') renderNavMenus();
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
  refreshOpenDetailLabels();
}

/* Si la fiche produit est ouverte, ré-affiche nom/prix/option dans la
   nouvelle langue sans effacer ce que le visiteur a déjà saisi. */
function refreshOpenDetailLabels() {
  if (!CURRENT || !document.getElementById('detail').classList.contains('show')) return;
  el('#dName').textContent = CURRENT.name;
  renderDetailMeta(CURRENT);
  const priceInfo = priceForProduct(CURRENT);
  const priceEl = document.getElementById('dPrice');
  if (priceEl) priceEl.textContent = formatMoney(priceInfo.amount, priceInfo.currency) + (priceInfo.isFallback ? t('price_unavailable_in')(CURRENT_CURRENCY) : '');
  if (CURRENT.variantOptions) {
    const optLabel = document.querySelector('#detailOptions label');
    if (optLabel) optLabel.textContent = CURRENT.variantOptions.label;
    const sel = document.getElementById(CURRENT.variantOptions.id);
    if (sel) {
      [...sel.options].forEach((opt, i) => { opt.textContent = CURRENT.variantOptions.choices[i].label; });
      if (typeof refreshEpicSelect === 'function') refreshEpicSelect(sel);
    }
  }
  /* Les options d'Unisexe/Homme/Femme sont traduites via [data-i18n] par
     applyStaticTranslations() ; le libellé affiché sur le bouton "épique"
     (déjà mis en cache dans l'ancienne langue) doit être resynchronisé. */
  const sexeSel = document.getElementById('dSexe');
  if (sexeSel && typeof refreshEpicSelect === 'function') refreshEpicSelect(sexeSel);
}
function onCurrencyChange() {
  renderProducts();
  recomputeCartCurrency();
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
  refreshOpenDetailLabels();
}
