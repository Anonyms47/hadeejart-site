/* ======================================================================
   Hadeej'Art — Point d'entrée : câble tous les modules au chargement
   ====================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = CURRENT_LANG;
  applyStaticTranslations();
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  initInvoiceCanvas();

  /* Arrivée depuis un lien "index.html?category=..." (menu Boutique d'une
     autre page) ou sur la page dédiée d'une collection ("collection.html
     ?slug=..." — voir initCollectionHero) : on préselectionne le filtre
     avant même le premier rendu. "?collection=" reste lu pour les anciens
     liens déjà partagés. */
  const params = new URLSearchParams(location.search);
  const qCollection = params.get('slug') || params.get('collection');
  const qCategory = params.get('category');
  if (qCollection) CURRENT_COLLECTION = qCollection;
  else if (qCategory) CURRENT_CATEGORY = qCategory;

  loadCart(); /* panier persistant : AVANT le premier updateCartUI (qui écrit le stockage) */
  renderCategoryFilters();
  renderProducts();
  renderHome();
  initCollectionHero();
  updateCartUI();
  openDetailFromUrl();
  if (qCollection || qCategory) {
    setTimeout(() => { const c = document.getElementById('catalogue'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }, 60);
  }

  bindHeaderScrollShadow();
  bindCartOutsideClose();
  bindCartLineActions();
  bindPaymentGrid();
  bindCheckoutSteps();
  /* Le câblage langue/devise du header (change + widget "épique") est
     centralisé dans initNav() (nav.js), partagé par toutes les pages —
     voir bindHeaderLangCurrency(). */
  restoreClientInfo();
  if (typeof initNav === 'function') initNav();
  if (typeof enhanceAutocomplete === 'function') {
    enhanceAutocomplete(document.getElementById('cCountry'), 'suggest_countries');
    enhanceAutocomplete(document.getElementById('cCity'), 'suggest_cities');
    enhanceAutocomplete(document.getElementById('cDistrict'), 'suggest_districts');
  }

  const orderBtn = document.getElementById('btnOrder');
  if (orderBtn) orderBtn.addEventListener('click', e => { e.preventDefault(); haOrder(); });

  window.__onCatalog = () => {
    renderCategoryFilters();
    renderProducts();
    renderHome();
    initCollectionHero();
    reconcileCart();
    recomputeCartCurrency();
    renderProductsJsonLd();
    if (typeof renderNavMenus === 'function') renderNavMenus();
    openDetailFromUrl();
    hidePageLoader();
  };
  loadCatalog(window.__onCatalog);
});

/* Remplit la bannière de la page dédiée d'une collection (collection.html) :
   sans effet ailleurs, où #collHeroTitle n'existe pas. Appelé au chargement
   et après le téléchargement du catalogue (COLLECTIONS n'est connu qu'à ce
   moment-là) ainsi qu'au changement de langue (voir onLangChange). */
function initCollectionHero() {
  const titleEl = document.getElementById('collHeroTitle');
  if (!titleEl || !CURRENT_COLLECTION) return;
  const col = COLLECTIONS.find(c => c.id === CURRENT_COLLECTION);
  const descEl = document.getElementById('collHeroDesc');
  const coverEl = document.getElementById('collHeroCover');
  if (!col) {
    if (!CATALOG_LOADED) return; /* catalogue pas encore chargé : rien à conclure */
    titleEl.textContent = t('collection_not_found_title');
    if (descEl) { descEl.hidden = false; descEl.textContent = t('collection_not_found_text'); }
    if (coverEl) coverEl.hidden = true;
    return;
  }
  titleEl.textContent = col.label;
  document.title = col.label + ' — Hadeej’Art';
  /* Adresse canonique propre à cette collection (la page est générée côté navigateur). */
  let canon = document.querySelector('link[rel="canonical"]');
  if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
  canon.href = 'https://hadeejart.store/collection.html?slug=' + encodeURIComponent(col.id);
  const md = document.querySelector('meta[name="description"]');
  if (md) md.content = (col.description || ('Hadeej’Art — ' + col.label + ' : pièces wax de la collection.')).slice(0, 300);
  if (coverEl) {
    coverEl.hidden = !col.cover;
    const bg = document.getElementById('collHeroCoverBg');
    const img = document.getElementById('collHeroCoverImg');
    if (bg) bg.style.backgroundImage = col.cover ? `url('${col.cover}')` : '';
    if (img) { img.src = col.cover || ''; img.alt = col.label; }
  }
  if (descEl) { descEl.hidden = !col.description; descEl.textContent = col.description || ''; }
}


/* Accueil : photo forte de la collection mise en avant (vraie photo, jamais
   retouchée ; le cadrage se fait en CSS) et bande des collections publiées.
   Sans effet sur les autres pages. */
function renderHome() {
  const photo = document.getElementById('heroPhoto');
  if (!photo) return;
  const col = COLLECTIONS.find(c => c.cover);
  const prod = PRODUCTS.find(p => p.img);
  const src = col ? col.cover : (prod ? prod.img : '');
  const img = document.getElementById('heroImg');
  if (src) {
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = col ? col.label : (prod ? prod.name : '');
    photo.hidden = false;
  } else photo.hidden = true;
  const kicker = document.getElementById('heroKicker');
  const cta = document.getElementById('heroCta');
  if (col) {
    kicker.textContent = t('hero_kicker')(col.label); kicker.hidden = false;
    cta.textContent = t('cta_discover')(col.label);
    cta.href = 'collection.html?slug=' + encodeURIComponent(col.id);
    cta.onclick = null;
  } else {
    kicker.hidden = true;
    cta.textContent = t('cta_view_collection'); cta.href = '#catalogue';
    cta.onclick = () => { scrollToCatalogue(); return false; };
  }
  const sec = document.getElementById('homeCollections'), row = document.getElementById('homeColRow');
  if (sec && row) {
    sec.hidden = !COLLECTIONS.length;
    row.innerHTML = COLLECTIONS.slice(0, 6).map(c => `
      <a class="collection-card" href="collection.html?slug=${encodeURIComponent(c.id)}">
        <div class="cover">${c.cover ? `<div class="cover-bg" style="background-image:url('${escapeHtml(c.cover)}')"></div><img src="${escapeHtml(c.cover)}" alt="" loading="lazy" decoding="async">` : ''}</div>
        <div class="body"><h3>${escapeHtml(c.label)}</h3></div>
      </a>`).join('');
  }
}
