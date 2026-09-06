/* ======================================================================
   Hadeej'Art — Point d'entrée : câble tous les modules au chargement
   ====================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initInvoiceCanvas();
  renderCategoryFilters();
  renderProducts();
  updateCartUI();

  bindHeaderScrollShadow();
  bindCartOutsideClose();
  bindCartLineActions();
  bindPaymentGrid();
  restoreClientInfo();

  const orderBtn = document.getElementById('btnOrder');
  if (orderBtn) orderBtn.addEventListener('click', e => { e.preventDefault(); haOrder(); });
});
