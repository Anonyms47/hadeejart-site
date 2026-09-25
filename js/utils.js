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
