/* ======================================================================
   Hadeej'Art — Comportements d'interface généraux
   ====================================================================== */

/* Ombre de l'en-tête au scroll */
function bindHeaderScrollShadow() {
  const h = document.getElementById('siteHeader');
  if (!h) return;
  document.addEventListener('scroll', () => {
    if (window.scrollY > 8) h.classList.add('scrolled');
    else h.classList.remove('scrolled');
  });
}

/* Ferme le panier si on clique/touche en dehors, ou avec Échap */
function bindCartOutsideClose() {
  const panel = document.getElementById('cartPanel');
  const btn = document.getElementById('cartBtn');
  if (!panel || !btn) return;

  function maybeClose(e) {
    if (!panel.classList.contains('show')) return;
    const t = e.target;
    if (!panel.contains(t) && !btn.contains(t)) panel.classList.remove('show');
  }
  ['pointerdown', 'click', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, maybeClose, { passive: true });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('show')) panel.classList.remove('show');
  });
}
