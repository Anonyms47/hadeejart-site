/* ======================================================================
   Hadeej'Art Admin — Navigation & bootstrap
   Chaque écran a son adresse (#orders, #products…) : le bouton Précédent,
   l'actualisation de la page et les favoris ramènent au bon écran.
   ====================================================================== */

const SECTION_RENDERERS = {
  dashboard: renderDashboard,
  orders: renderOrders,
  products: renderProducts,
  categories: renderCategories,
  collections: renderCollections,
  customers: renderCustomers,
  newsletter: renderNewsletter,
  settings: renderSettings
};

/* Filtre pré-appliqué quand on arrive depuis une tuile du dashboard */
let SECTION_PRESET = '';

function goToSection(name, preset, fromHash) {
  if (!SECTION_RENDERERS[name]) name = 'dashboard';
  SECTION_PRESET = preset || '';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById('section-' + name).classList.remove('hidden');
  if (!fromHash && location.hash !== '#' + name) { try { history.pushState(null, '', '#' + name); } catch (e) { location.hash = name; } }
  document.title = 'Hadeej’Art — ' + (document.querySelector(`.nav-item[data-section="${name}"] .nav-label`) || { textContent: 'Administration' }).textContent;
  window.scrollTo(0, 0);
  SECTION_RENDERERS[name]();
}

/* Pastille « n à traiter » sur Commandes */
async function updateNavBadges(orders) {
  if (!orders) { const r = await sb.from('orders').select('status'); orders = r.data || []; }
  const n = orders.filter(o => o.status === 'pending').length;
  const b = document.getElementById('badgeOrders');
  if (b) { b.textContent = n > 99 ? '99+' : String(n); b.hidden = !n; }
}

function onAdminReady() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => goToSection(btn.dataset.section));
  });
  window.addEventListener('popstate', () => goToSection(location.hash.slice(1) || 'dashboard', '', true));
  goToSection(location.hash.slice(1) || 'dashboard', '', true);
  updateNavBadges();
  /* Les pastilles se rafraîchissent quand l'onglet reprend le focus. */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateNavBadges(); });
}

document.addEventListener('DOMContentLoaded', initAuth);
