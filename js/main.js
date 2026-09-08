/* ======================================================================
   Hadeej'Art — Point d'entrée : câble tous les modules au chargement
   ====================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = CURRENT_LANG;
  applyStaticTranslations();
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  initInvoiceCanvas();
  renderCategoryFilters();
  renderProducts();
  updateCartUI();

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
