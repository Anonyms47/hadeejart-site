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
  renderComingSoon();
}

/* « Sacs et chaussures : produits bientôt disponibles. » — pour toute catégorie
   désactivée ; masqué s'il n'y en a aucune. */
function renderComingSoon() {
  const box = document.getElementById('comingSoon');
  if (!box) return;
  const names = COMING_SOON_CATEGORIES;
  if (!names.length) { box.hidden = true; box.textContent = ''; return; }
  const sep = ' ' + t('and_word') + ' ';
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + sep + names[names.length - 1] : names[0];
  const fn = t('coming_soon_notice');
  box.textContent = typeof fn === 'function' ? fn(list) : String(fn);
  box.hidden = false;
}

function selectCategory(catId) {
  CURRENT_CATEGORY = catId;
  CURRENT_COLLECTION = null;
  renderCategoryFilters();
  renderProducts();
  if (typeof closeAllNavMenus === 'function') closeAllNavMenus();
}

/* Un produit demande-t-il un choix avant l'ajout au panier ? (taille,
   option à prix différent, ou plusieurs couleurs proposées) */
function productNeedsChoice(p) {
  return !!((p.sizes && p.sizes.length) || p.variantOptions || (p.colors && p.colors.length > 1));
}
function productCtaLabel(p) {
  const onlySize = p.sizes && p.sizes.length && !p.variantOptions && !(p.colors && p.colors.length > 1);
  return t(onlySize ? 'choose_size' : 'choose_options');
}
/* Adresse partageable d'un produit (compatible avec tous les liens existants :
   elle ouvre simplement la fiche sur la page d'accueil). */
function productUrl(p) { return 'index.html?produit=' + encodeURIComponent(p.id); }

function bindProductGrid(grid) {
  if (grid._haBound) return;
  grid._haBound = true;
  grid.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; /* nouvel onglet : lien normal */
      e.preventDefault(); openDetail(open.dataset.open); return;
    }
    const add = e.target.closest('[data-add]');
    if (add) addToCart(add.dataset.add, {});
  });
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
  bindProductGrid(grid);
  renderActiveCollectionBanner();

  const list = currentProductList();
  grid.innerHTML = list.map((p, i) => {
    const priceInfo = priceForProduct(p);
    const id = escapeHtml(p.id), name = escapeHtml(p.name), url = escapeHtml(productUrl(p));
    const cta = p.soldOut
      ? `<button type="button" class="btn sm" disabled>${escapeHtml(t('sold_out'))}</button>`
      : productNeedsChoice(p)
        ? `<button type="button" class="btn sm" data-open="${id}">${escapeHtml(productCtaLabel(p))}</button>`
        : `<button type="button" class="btn sm" data-add="${id}">${escapeHtml(t('add'))}</button>`;
    return `
    <article class="card" style="--i:${i}">
      <a class="card-media" href="${url}" data-open="${id}" aria-label="${escapeHtml(t('view_product'))} : ${name}">
        <img src="${escapeHtml(p.img)}" alt="${name}" width="600" height="800" loading="lazy" decoding="async"
             onerror="this.style.objectFit='contain'; this.alt+=t('photo_coming');">
        ${p.soldOut ? `<span class="card-badge">${escapeHtml(t('sold_out'))}</span>` : ''}
      </a>
      <div class="cap">
        <h3><a href="${url}" data-open="${id}">${name}</a></h3>
        <div class="price">${formatMoney(priceInfo.amount, priceInfo.currency)}${priceInfo.isFallback ? ` <span class="small" title="${escapeHtml(t('price_fallback_title'))}">(FCFA)</span>` : ''}</div>
        <div class="row">${cta}</div>
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
  const multi = images.length > 1;
  document.querySelectorAll('#dMedia .gallery-nav').forEach(btn => btn.hidden = !multi);
  updateGalleryCount(images.length);
  const thumbs = document.getElementById('dThumbs');
  if (!thumbs) return;
  if (!multi) {
    thumbs.innerHTML = '';
    thumbs.hidden = true;
    return;
  }
  thumbs.hidden = false;
  thumbs.innerHTML = images.map((src, i) => `
    <button type="button" class="thumb${i === 0 ? ' active' : ''}" onclick="selectGalleryImage(${i})" aria-label="${escapeHtml(t('gallery_photo'))} ${i + 1}">
      <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">
    </button>`).join('');
}

function updateGalleryCount(total) {
  const el = document.getElementById('dGalleryCount');
  if (!el) return;
  if (total > 1) { el.hidden = false; el.textContent = `${CURRENT_GALLERY_INDEX + 1} / ${total}`; }
  else { el.hidden = true; el.textContent = ''; }
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
  updateGalleryCount(images.length);
}

/* Flèches précédent/suivant (clic, clavier ← →, balayage tactile) : passe à
   la photo voisine en bouclant d'un bout à l'autre de la galerie. */
function galleryStep(dir) {
  if (!CURRENT) return;
  const images = (CURRENT.images && CURRENT.images.length) ? CURRENT.images : [CURRENT.img];
  if (images.length <= 1) return;
  selectGalleryImage((CURRENT_GALLERY_INDEX + dir + images.length) % images.length);
}

/* Catégorie + collection(s) du produit (données réelles déjà chargées,
   aucune information inventée). */
function renderDetailMeta(p) {
  const meta = document.getElementById('dMeta');
  if (!meta) return;
  const tags = [];
  const cat = CATEGORIES.find(c => c.id === p.category);
  if (cat) tags.push(`<span class="tag">${escapeHtml(cat.label)}</span>`);
  (p.collectionSlugs || []).forEach(slug => {
    const col = COLLECTIONS.find(c => c.id === slug);
    if (col) tags.push(`<a class="tag tag-collection" href="collection.html?slug=${encodeURIComponent(slug)}">${escapeHtml(col.label)}</a>`);
  });
  meta.innerHTML = tags.length ? `<div class="detail-tags">${tags.join('')}</div>` : '';
}

/* Sélection en cours dans la fiche (taille, couleur, option) : conservée
   quand la langue ou la devise change pendant que la fiche est ouverte. */
let DETAIL_SEL = { size: '', color: '', option: '' };
let _detailReturnFocus = null;
let _detailPrevTitle = '';
let _detailUrlHandled = false;

function detailTextHtml(txt) { return escapeHtml(txt).replace(/\n/g, '<br>'); }

/* Nuancier d'atelier : nom de couleur -> teinte. Deux couleurs reconnues
   dans un même nom ("Noir et blanc") donnent une pastille bicolore ; un nom
   inconnu (motif wax) reçoit un motif tissé neutre, jamais une couleur inventée. */
const WAX_SWATCHES = {
  orange: '#e8792c', bleu: '#2f6fb0', blue: '#2f6fb0', ble: '#2f6fb0',
  rouge: '#c1352a', red: '#c1352a', xonq: '#c1352a',
  vert: '#3f7a45', green: '#3f7a45', wert: '#3f7a45',
  jaune: '#e8c02c', yellow: '#e8c02c', jonn: '#e8c02c',
  noir: '#1d1a17', black: '#1d1a17', 'ñuul': '#1d1a17',
  blanc: '#fdfbf6', white: '#fdfbf6', weex: '#fdfbf6',
  rose: '#e78ea9', pink: '#e78ea9', roos: '#e78ea9',
  violet: '#7a4fa0', purple: '#7a4fa0', vale: '#7a4fa0',
  marron: '#6b4226', brown: '#6b4226', maron: '#6b4226',
  'doré': '#c9a227', gold: '#c9a227', wurus: '#c9a227',
  beige: '#d8c3a0'
};
function swatchBackground(name) {
  const n = String(name || '').toLowerCase();
  const hits = Object.keys(WAX_SWATCHES).map(k => ({ k, i: n.indexOf(k) })).filter(h => h.i >= 0).sort((a, b) => a.i - b.i);
  const cols = []; hits.forEach(h => { const c = WAX_SWATCHES[h.k]; if (!cols.includes(c)) cols.push(c); });
  if (cols.length === 1) return cols[0];
  if (cols.length >= 2) return `linear-gradient(135deg, ${cols[0]} 50%, ${cols[1]} 50%)`;
  return 'repeating-conic-gradient(#D4A359 0 25%, #2a2118 0 50%) 0 0/12px 12px';
}

/* Un seul parcours clavier par groupe (tabindex itinérant) : la flèche choisit, Tab sort du groupe. */
function rovingIndex(items, group) {
  const sel = items.findIndex(it => DETAIL_SEL[group] === it.value && !it.disabled);
  return sel >= 0 ? sel : items.findIndex(it => !it.disabled);
}

function chipGroupHtml(group, items, kind) {
  const rov = rovingIndex(items, group);
  const body = items.map((it, i) => {
    const on = DETAIL_SEL[group] === it.value;
    const common = `type="button" role="radio" aria-checked="${on}" tabindex="${i === rov ? 0 : -1}" data-group="${group}" data-value="${escapeHtml(it.value)}"${it.disabled ? ' disabled' : ''}`;
    if (kind === 'swatch') {
      return `<button ${common} class="opt-chip swatch${on ? ' on' : ''}" aria-label="${escapeHtml(it.label)}" title="${escapeHtml(it.label)}" data-label="${escapeHtml(it.label)}"><span class="swatch-fill" style="background:${swatchBackground(it.label)}"></span></button>`;
    }
    if (kind === 'seg') {
      return `<button ${common} class="opt-chip seg-opt${on ? ' on' : ''}"><span>${escapeHtml(it.label)}</span>${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</button>`;
    }
    return `<button ${common} class="opt-chip${kind === 'size' ? ' size-tag' : ''}${on ? ' on' : ''}">
      <span>${escapeHtml(it.label)}</span>${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</button>`;
  }).join('');
  if (kind === 'seg') return `<div class="seg" role="radiogroup" aria-labelledby="dLegend-${group}"><span class="seg-ind" aria-hidden="true"></span>${body}</div>`;
  return `<div class="opt-chips${kind ? ' opt-' + kind : ''}" role="radiogroup" aria-labelledby="dLegend-${group}">${body}</div>`;
}

/* Position de la pastille dorée du contrôle segmenté (glisse de l'un à l'autre). */
function positionSegments(root) {
  (root || document).querySelectorAll('.seg').forEach(seg => {
    const on = seg.querySelector('.seg-opt.on');
    if (!on || !on.offsetWidth) { seg.classList.remove('has-sel'); return; }
    seg.style.setProperty('--x', on.offsetLeft + 'px');
    seg.style.setProperty('--w', on.offsetWidth + 'px');
    seg.classList.add('has-sel');
  });
}

function detailAddLabel(p) {
  if (p.soldOut) return t('sold_out');
  const info = priceForProduct(p, DETAIL_SEL.option || undefined);
  return t('add_to_cart') + ' • ' + formatMoney(info.amount, info.currency);
}

function setDetailSwatchName() {
  const out = document.getElementById('dSwatchName');
  if (!out) return;
  const on = document.querySelector('#dForm .swatch.on');
  out.textContent = on ? on.dataset.label : '';
}

function updateDetailPrice(p) {
  const priceEl = document.getElementById('dPrice');
  if (!priceEl) return;
  const info = priceForProduct(p, DETAIL_SEL.option || undefined);
  priceEl.innerHTML = escapeHtml(formatMoney(info.amount, info.currency))
    + (info.isFallback ? ` <span class="small">${escapeHtml(t('price_unavailable_in')(CURRENT_CURRENCY))}</span>` : '');
  const lbl = document.querySelector('#dForm .detail-add .lbl');
  if (lbl && !lbl.closest('.detail-add').classList.contains('done')) lbl.textContent = detailAddLabel(p);
}

function detailAvailabilityHtml(p) {
  const lead = p.leadTime ? ` <span class="sep-dot" aria-hidden="true">·</span> <span>${escapeHtml(p.leadTime)}</span>` : '';
  if (p.soldOut) return `<span class="avail-dot off" aria-hidden="true"></span><span>${escapeHtml(t('detail_unavailable'))}</span>`;
  if (p.fulfillment === 'in_stock') return `<span class="avail-dot" aria-hidden="true"></span><span>${escapeHtml(t('detail_in_stock'))}</span>${lead}`;
  if (p.fulfillment === 'made_to_order') return `<span class="avail-dot" aria-hidden="true"></span><span>${escapeHtml(t('detail_made_to_order'))}</span>${lead}`;
  return `<span class="avail-dot" aria-hidden="true"></span><span>${escapeHtml(t('detail_available'))}</span>`
    + (p.leadTime ? lead : ` <span class="sep-dot" aria-hidden="true">·</span> <span>${escapeHtml(t('detail_lead_time'))}</span>`);
}

/* Tarifs de livraison configurés par la boutique (information, jamais ajoutés au total). */
function deliveryZonesText() {
  const z = (SITE_SETTINGS && Array.isArray(SITE_SETTINGS.delivery_zones)) ? SITE_SETTINGS.delivery_zones : [];
  return z.filter(x => x && x.name).map(x => x.name + (x.fee_fcfa != null ? ' : ' + formatMoney(x.fee_fcfa, 'FCFA') : '') + (x.delay ? ' (' + x.delay + ')' : '')).join('\n');
}

function detailSectionsHtml(p) {
  const S = SITE_SETTINGS || {};
  const s = k => pickLang(S, k);
  const rows = [
    ['detail_contents', p.contents], ['detail_cut', p.cut], ['detail_measures', p.measures],
    ['detail_care', p.care], ['detail_lead_time_label', p.leadTime],
    ['size_guide', s('size_guide'), 'dGuide'], ['detail_delivery', [s('delivery_info'), deliveryZonesText()].filter(Boolean).join('\n\n')], ['detail_exchange', s('exchange_info')]
  ].filter(r => r[1] && String(r[1]).trim());
  return rows.map(r => `<details class="detail-acc"${r[2] ? ` id="${r[2]}"` : ''}><summary>${escapeHtml(t(r[0]))}</summary><div class="detail-acc-body">${detailTextHtml(r[1])}</div></details>`).join('');
}

function renderDetailBody(p) {
  const keepNote = (document.getElementById('dNote') || {}).value || '';
  const sizes = (p.sizes && p.sizes.length) ? p.sizes : [];
  const colors = p.colors || [];
  const vo = p.variantOptions;
  const hasGuide = !!pickLang(SITE_SETTINGS || {}, 'size_guide');
  const unavail = p.unavailableSizes || [];

  const parts = [];
  if (sizes.length) {
    parts.push(`<fieldset class="opt" data-field="size"><legend id="dLegend-size">${escapeHtml(t('size_label'))} <span class="req" aria-hidden="true">*</span></legend>
      ${chipGroupHtml('size', sizes.map(sz => ({ value: sz, label: sz, disabled: unavail.includes(sz), sub: unavail.includes(sz) ? t('detail_unavailable_short') : '' })), 'size')}
      <div class="size-foot">${hasGuide ? `<button type="button" class="link-btn" data-guide>${escapeHtml(t('size_guide'))}</button>` : ''}
      <p class="size-note">${escapeHtml(t('size_note'))}</p></div>
      <p class="field-error" id="dErr-size" role="alert" hidden></p></fieldset>`);
  }
  if (colors.length > 1) {
    parts.push(`<fieldset class="opt" data-field="color"><legend id="dLegend-color">${escapeHtml(t('color_label'))} <span class="req" aria-hidden="true">*</span></legend>
      ${chipGroupHtml('color', colors.map(c => ({ value: c, label: c })), 'swatch')}<p class="swatch-name" id="dSwatchName" aria-live="polite"></p><p class="field-error" id="dErr-color" role="alert" hidden></p></fieldset>`);
  } else if (colors.length === 1) {
    parts.push(`<p class="detail-fact"><b>${escapeHtml(t('color_label'))}</b> ${escapeHtml(colors[0])}</p>`);
  }
  if (vo) {
    parts.push(`<fieldset class="opt" data-field="option"><legend id="dLegend-option">${escapeHtml(vo.label)} <span class="req" aria-hidden="true">*</span></legend>
      ${chipGroupHtml('option', vo.choices.map(c => {
        const info = priceForProduct(p, c.value);
        return { value: c.value, label: c.label, sub: formatMoney(info.amount, info.currency) };
      }), (vo.choices.length >= 2 && vo.choices.length <= 4 && vo.choices.every(c => String(c.label).length <= 16)) ? 'seg' : '')}<p class="field-error" id="dErr-option" role="alert" hidden></p></fieldset>`);
  }
  if (p.fabric) parts.push(`<p class="detail-fact"><b>${escapeHtml(t('fabric_label'))}</b> ${escapeHtml(p.fabric)}</p>`);
  parts.push(`<div class="field"><label for="dNote">${escapeHtml(t('note_label'))}</label><input id="dNote" class="input" maxlength="500" autocomplete="off" placeholder="${escapeHtml(t('note_placeholder'))}" value="${escapeHtml(keepNote)}"></div>`);
  parts.push(`<button class="btn detail-add" type="submit"${p.soldOut ? ' disabled' : ''}><span class="lbl">${escapeHtml(detailAddLabel(p))}</span></button>`);

  document.getElementById('dForm').innerHTML = `<form id="dFormEl" novalidate>${parts.join('')}</form>`;
  setDetailSwatchName();
  positionSegments(document.getElementById('dForm'));
  setTimeout(() => positionSegments(document.getElementById('dForm')), 80);
  document.getElementById('dAvail').innerHTML = detailAvailabilityHtml(p);
  const desc = document.getElementById('dDescription');
  desc.hidden = !p.description;
  desc.innerHTML = p.description ? detailTextHtml(p.description) : '';
  document.getElementById('dSections').innerHTML = detailSectionsHtml(p);
  const share = document.getElementById('dShare'); if (share) share.textContent = t('share_link');
  updateDetailPrice(p);
}

function bindDetailForm() {
  const form = document.getElementById('dForm');
  if (!form || form._haBound) return;
  form._haBound = true;
  form.addEventListener('click', e => {
    const chip = e.target.closest('.opt-chip');
    if (chip && CURRENT) { selectDetailChip(chip); return; }
    if (e.target.closest('[data-guide]')) {
      const g = document.getElementById('dGuide');
      if (g) { g.open = true; g.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
  });
  /* Clavier des groupes radio : flèches = choisir, Début/Fin = extrémités (Tab sort du groupe). */
  form.addEventListener('keydown', e => {
    const chip = e.target.closest('.opt-chip');
    if (!chip || !CURRENT) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' };
    if (!(e.key in keys)) return;
    const all = [...form.querySelectorAll('.opt-chip[data-group="' + chip.dataset.group + '"]:not([disabled])')];
    if (!all.length) return;
    e.preventDefault();
    let i = all.indexOf(chip);
    if (keys[e.key] === 'first') i = 0; else if (keys[e.key] === 'last') i = all.length - 1;
    else i = (i + keys[e.key] + all.length) % all.length;
    all[i].focus(); selectDetailChip(all[i]);
  });
  window.addEventListener('resize', () => positionSegments(document.getElementById('dForm')));
  form.addEventListener('submit', e => { e.preventDefault(); addFromDetail(); });
}

function selectDetailChip(chip) {
  const form = document.getElementById('dForm');
  const group = chip.dataset.group;
  DETAIL_SEL[group] = chip.dataset.value;
  form.querySelectorAll('.opt-chip[data-group="' + group + '"]').forEach(b => {
    const on = b === chip; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
  });
  const err = document.getElementById('dErr-' + group);
  if (err) { err.hidden = true; err.textContent = ''; }
  if (group === 'option') updateDetailPrice(CURRENT);
  if (group === 'color') setDetailSwatchName();
  positionSegments(form);
}

function openDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  CURRENT = p;
  /* Un seul choix possible -> présélectionné ; sinon l'acheteur choisit explicitement. */
  DETAIL_SEL = {
    size: (p.sizes && p.sizes.length === 1 && !(p.unavailableSizes || []).includes(p.sizes[0])) ? p.sizes[0] : '',
    color: (p.colors && p.colors.length === 1) ? p.colors[0] : '',
    option: ''
  };

  el('#dName').textContent = p.name;
  renderDetailGallery(p);
  renderDetailMeta(p);
  bindDetailForm();
  const oldNote = document.getElementById('dNote'); if (oldNote) oldNote.value = '';
  renderDetailBody(p);

  const modal = el('#detail');
  if (modal.classList.contains('show')) return; /* déjà ouverte */
  modal.classList.add('show');
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'dName');
  _detailReturnFocus = document.activeElement;
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  if (typeof pushOverlayHistory === 'function') pushOverlayHistory();
  try {
    const u = new URL(location.href); u.searchParams.set('produit', p.id);
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch (e) { /* ignoré */ }
  _detailPrevTitle = document.title; document.title = p.name + ' — Hadeej’Art';
  setTimeout(() => { const c = modal.querySelector('header .close-medal, header .btn'); if (c) c.focus({ preventScroll: true }); }, 40);
}

/* Arrivée directe sur « …?produit=slug » : ouvre la fiche (une seule fois,
   dès que le catalogue est connu) et nettoie l'adresse de base. */
function openDetailFromUrl() {
  if (_detailUrlHandled || !PRODUCTS.length) return;
  _detailUrlHandled = true;
  const id = new URLSearchParams(location.search).get('produit');
  if (!id) return;
  try {
    const u = new URL(location.href); u.searchParams.delete('produit');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch (e) { /* ignoré */ }
  if (PRODUCTS.some(x => x.id === id)) openDetail(id);
}

async function shareCurrentProduct() {
  if (!CURRENT) return;
  const url = new URL(productUrl(CURRENT), location.href).href;
  const btn = document.getElementById('dShare');
  try {
    if (navigator.share) { await navigator.share({ title: CURRENT.name, url }); return; }
    await navigator.clipboard.writeText(url);
    if (btn) { btn.textContent = t('link_copied'); setTimeout(() => { btn.textContent = t('share_link'); }, 2200); }
  } catch (e) { /* partage annulé ou presse-papiers indisponible */ }
}

function closeDetail(viaPopstate) {
  const modal = document.getElementById('detail');
  if (!modal || !modal.classList.contains('show')) return;
  modal.classList.remove('show');
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('produit')) { u.searchParams.delete('produit'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
  } catch (e) { /* ignoré */ }
  if (_detailPrevTitle) { document.title = _detailPrevTitle; _detailPrevTitle = ''; }
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  if (!viaPopstate && typeof consumeOverlayHistory === 'function') consumeOverlayHistory();
  if (_detailReturnFocus && document.contains(_detailReturnFocus) && _detailReturnFocus.focus) _detailReturnFocus.focus({ preventScroll: true });
  _detailReturnFocus = null;
}

function addFromDetail() {
  if (!CURRENT || CURRENT.soldOut) return;
  const p = CURRENT;
  /* Choix nécessaires : erreurs affichées à côté du champ, jamais d'ajout silencieux. */
  const missing = [];
  if (p.sizes && p.sizes.length && !DETAIL_SEL.size) missing.push(['size', 'size_required']);
  if (p.colors && p.colors.length > 1 && !DETAIL_SEL.color) missing.push(['color', 'color_required']);
  if (p.variantOptions && !DETAIL_SEL.option) missing.push(['option', 'option_required']);
  document.querySelectorAll('#dForm .field-error').forEach(e => { e.hidden = true; e.textContent = ''; });
  if (missing.length) {
    missing.forEach(([g, key]) => {
      const err = document.getElementById('dErr-' + g);
      if (err) { err.textContent = t(key); err.hidden = false; }
    });
    const first = document.querySelector('#dForm fieldset[data-field="' + missing[0][0] + '"] .opt-chip:not([disabled])');
    if (first) first.focus();
    return;
  }
  const note = (document.getElementById('dNote') || {}).value || '';
  addToCart(p.id, {
    color: DETAIL_SEL.color, size: DETAIL_SEL.size, tissu: p.fabric || '',
    note: note.trim(), optionKimono: DETAIL_SEL.option
  });
  /* Retour immédiat sur le bouton (✓ Ajouté), puis le panier s'ouvre. */
  const btn = document.querySelector('#dForm .detail-add');
  const lbl = btn && btn.querySelector('.lbl');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (btn && lbl) { btn.classList.add('done'); btn.disabled = true; lbl.textContent = t('added_ok'); }
  setTimeout(() => {
    closeDetail();
    /* Différé : sinon le même clic, en continuant sa bulle jusqu'à document,
       déclenche aussitôt la fermeture "clic en dehors" du panier (voir
       bindCartOutsideClose dans ui.js). */
    setTimeout(openCart, 0);
  }, (btn && lbl) ? (reduce ? 250 : 600) : 0);
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
  if (typeof initCollectionHero === 'function') initCollectionHero();
  if (typeof renderHome === 'function') renderHome();
  if (typeof refreshCartLanguage === 'function') refreshCartLanguage();
  if (typeof refreshMapStatusLabel === 'function') refreshMapStatusLabel();
  if (typeof renderNavMenus === 'function') renderNavMenus();
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
  refreshOpenDetailLabels();
  if (typeof refreshPayTrust === 'function') refreshPayTrust();
}

/* Si la fiche produit est ouverte, ré-affiche textes, prix et options dans
   la nouvelle langue/devise sans effacer la sélection ni la note saisie. */
function refreshOpenDetailLabels() {
  if (!CURRENT || !document.getElementById('detail').classList.contains('show')) return;
  const fresh = PRODUCTS.find(x => x.id === CURRENT.id);
  if (fresh) CURRENT = fresh;
  el('#dName').textContent = CURRENT.name;
  renderDetailMeta(CURRENT);
  renderDetailBody(CURRENT);
}
function onCurrencyChange() {
  renderProducts();
  recomputeCartCurrency();
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
  refreshOpenDetailLabels();
}
