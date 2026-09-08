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
