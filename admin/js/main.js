/* ======================================================================
   Hadeej'Art Admin — Navigation & bootstrap
   ====================================================================== */

const SECTION_RENDERERS = {
  dashboard: renderDashboard,
  products: renderProducts,
  categories: renderCategories,
  collections: renderCollections,
  orders: renderOrders,
  customers: renderCustomers,
  settings: renderSettings
};

function goToSection(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name).classList.remove('hidden');
  const fn = SECTION_RENDERERS[name];
  if (fn) fn();
}

function onAdminReady() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => goToSection(btn.dataset.section));
  });
  goToSection('dashboard');
}

document.addEventListener('DOMContentLoaded', initAuth);
