/* ======================================================================
   Hadeej'Art — Utilitaires partagés (chargé sur toutes les pages, avant
   tout autre script métier)
   ====================================================================== */

/* Les champs libres (couleur, tissu, note, adresse...) sont saisis par le
   visiteur ou viennent de l'admin : on échappe systématiquement avant de
   les insérer dans du HTML. */
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ======================================================================
   Verrou de défilement partagé (compteur de références) : plusieurs
   panneaux (menu mobile, modale détail, modale client, visionneuse plein
   écran) peuvent être ouverts en cascade (ex: la visionneuse depuis la
   fiche produit) ; le défilement de la page ne doit se réactiver que
   lorsque le dernier d'entre eux se ferme.
   ====================================================================== */
let _haScrollLockCount = 0;
function lockBodyScroll() {
  _haScrollLockCount++;
  document.body.classList.add('scroll-locked');
}
function unlockBodyScroll() {
  _haScrollLockCount = Math.max(0, _haScrollLockCount - 1);
  if (_haScrollLockCount === 0) document.body.classList.remove('scroll-locked');
}

/* ======================================================================
   Interception du bouton "retour" (navigateur ou geste téléphone) pour
   les panneaux plein écran / modales : à l'ouverture on empile une entrée
   d'historique factice ; une pression sur "retour" ferme le panneau au
   lieu de quitter la page. Fermer autrement (croix, clic extérieur,
   Échap) consomme discrètement cette entrée pour ne pas polluer
   l'historique réel.
   ====================================================================== */
let _haOverlayHistoryDepth = 0;
let _haSuppressNextPopstate = false;

function pushOverlayHistory() {
  _haOverlayHistoryDepth++;
  try { history.pushState({ haOverlay: _haOverlayHistoryDepth }, ''); } catch (e) { /* contexte sans historique (ex: sandbox) : tant pis */ }
}

/* À appeler quand un panneau se ferme par un moyen autre que le bouton
   "retour" — retire l'entrée d'historique correspondante sans redéclencher
   la fermeture (popstate ignoré une fois). */
function consumeOverlayHistory() {
  if (_haOverlayHistoryDepth <= 0) return;
  _haOverlayHistoryDepth--;
  _haSuppressNextPopstate = true;
  try { history.back(); } catch (e) { _haSuppressNextPopstate = false; }
}

window.addEventListener('popstate', () => {
  if (_haSuppressNextPopstate) { _haSuppressNextPopstate = false; return; }
  if (_haOverlayHistoryDepth > 0) {
    _haOverlayHistoryDepth--;
    if (typeof closeTopmostOverlay === 'function') closeTopmostOverlay(true);
  }
});

/* ======================================================================
   Pas de zoom involontaire (iPhone / Android)
   Safari iOS ignore « user-scalable=no » et « maximum-scale » : le pincement
   à deux doigts et le double appui zoomaient encore la page (notamment dans
   la fiche produit). On bloque donc ces gestes ici, en laissant intacts la
   carte de livraison (Leaflet gère son propre zoom), les champs et les
   boutons (pour ne pas avaler des appuis rapides sur « + » ou « − »).
   ====================================================================== */
(function bindNoZoom() {
  const stop = e => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => document.addEventListener(evt, stop, { passive: false }));
  document.addEventListener('touchmove', e => {
    if ((e.touches && e.touches.length > 1) || (typeof e.scale === 'number' && e.scale !== 1)) {
      if (!(e.target.closest && e.target.closest('.leaflet-container'))) e.preventDefault();
    }
  }, { passive: false });
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    const interactive = e.target.closest && e.target.closest('input, textarea, select, button, a, label, summary, [role="option"], .leaflet-container');
    if (now - lastTap < 350 && !interactive) e.preventDefault();
    lastTap = now;
  }, { passive: false });
})();
