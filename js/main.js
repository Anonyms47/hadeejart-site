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

  renderCategoryFilters();
  renderProducts();
  initCollectionHero();
  updateCartUI();
  if (qCollection || qCategory) {
    setTimeout(() => { const c = document.getElementById('catalogue'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }, 60);
  }

  bindHeaderScrollShadow();
  bindCartOutsideClose();
  bindCartLineActions();
  bindPaymentGrid();
  /* Le câblage langue/devise du header (change + widget "épique") est
     centralisé dans initNav() (nav.js), partagé par toutes les pages —
     voir bindHeaderLangCurrency(). */
  restoreClientInfo();
  if (typeof initNav === 'function') initNav();
  if (typeof enhanceAutocomplete === 'function') {
    enhanceAutocomplete(document.getElementById('dColor'), 'suggest_colors');
    enhanceAutocomplete(document.getElementById('dTissu'), 'suggest_fabrics');
    enhanceAutocomplete(document.getElementById('cCountry'), 'suggest_countries');
    enhanceAutocomplete(document.getElementById('cCity'), 'suggest_cities');
    enhanceAutocomplete(document.getElementById('cDistrict'), 'suggest_districts');
  }

  const orderBtn = document.getElementById('btnOrder');
  if (orderBtn) orderBtn.addEventListener('click', e => { e.preventDefault(); haOrder(); });

  loadCatalog(() => {
    renderCategoryFilters();
    renderProducts();
    initCollectionHero();
    recomputeCartCurrency();
    if (typeof renderNavMenus === 'function') renderNavMenus();
    hidePageLoader();
  });
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
  if (coverEl) {
    coverEl.hidden = !col.cover;
    const bg = document.getElementById('collHeroCoverBg');
    const img = document.getElementById('collHeroCoverImg');
    if (bg) bg.style.backgroundImage = col.cover ? `url('${col.cover}')` : '';
    if (img) { img.src = col.cover || ''; img.alt = col.label; }
  }
  if (descEl) { descEl.hidden = !col.description; descEl.textContent = col.description || ''; }
}
