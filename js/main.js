/* ======================================================================
   Hadeej'Art — Point d'entrée : câble tous les modules au chargement
   ====================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = CURRENT_LANG;
  applyStaticTranslations();
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  initInvoiceCanvas();

  /* Arrivée depuis un lien "index.html?category=..." ou "?collection=..."
     (menu Boutique/Collections d'une autre page, ou lien partagé) : on
     préselectionne le filtre avant même le premier rendu. */
  const params = new URLSearchParams(location.search);
  const qCollection = params.get('collection');
  const qCategory = params.get('category');
  if (qCollection) CURRENT_COLLECTION = qCollection;
  else if (qCategory) CURRENT_CATEGORY = qCategory;

  renderCategoryFilters();
  renderProducts();
  updateCartUI();
  if (qCollection || qCategory) {
    setTimeout(() => { const c = document.getElementById('catalogue'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }, 60);
  }

  bindHeaderScrollShadow();
  bindCartOutsideClose();
  bindCartLineActions();
  bindPaymentGrid();
  bindCurrencySelector();
  bindLangSelector();
  restoreClientInfo();
  if (typeof initNav === 'function') initNav();

  const orderBtn = document.getElementById('btnOrder');
  if (orderBtn) orderBtn.addEventListener('click', e => { e.preventDefault(); haOrder(); });

  loadCatalog(() => {
    renderCategoryFilters();
    renderProducts();
    recomputeCartCurrency();
    if (typeof renderNavMenus === 'function') renderNavMenus();
  });
});
