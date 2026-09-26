/* ======================================================================
   Hadeej'Art — Point d'entrée léger pour les pages de contenu (Notre
   histoire, Collections, Journal, Contact, FAQ, pages légales...).
   N'a besoin ni du panier ni du catalogue complet : seulement des
   catégories/collections pour les menus, et de la traduction.
   ====================================================================== */

/* setLang()/setCurrency() (i18n.js/currency.js) appellent onLangChange()/
   onCurrencyChange() s'ils existent. Sur le catalogue, catalogue.js les
   définit déjà (avec toute la logique produits) ; sur une page de
   contenu, catalogue.js n'est pas chargé donc on fournit ici la version
   légère : ré-affiche les menus (leurs libellés viennent de t()) et
   prévient la page (grille collections, date localisée...). */
function onLangChange() {
  /* Recalcule d'abord les libellés catégories/collections dans la nouvelle
     langue (sinon menus, pied de page et grille gardaient l'ancienne). */
  if (typeof refreshCatalogLabels === 'function') refreshCatalogLabels();
  if (typeof renderNavMenus === 'function') renderNavMenus();
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
  if (typeof onNavDataLoaded === 'function') onNavDataLoaded();
  if (typeof initPageContent === 'function') initPageContent();
}
function onCurrencyChange() {
  if (typeof syncLangCurrencyControls === 'function') syncLangCurrencyControls();
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = CURRENT_LANG;
  applyStaticTranslations();

  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (typeof bindHeaderScrollShadow === 'function') bindHeaderScrollShadow();
  if (typeof initNav === 'function') initNav();

  if (typeof loadNavData === 'function') {
    loadNavData(() => {
      if (typeof renderNavMenus === 'function') renderNavMenus();
      if (typeof onNavDataLoaded === 'function') onNavDataLoaded();
    });
  }

  /* Point d'extension optionnel pour une page spécifique (ex: la grille
     de la page Collections), défini par un <script> inline avant page.js. */
  if (typeof initPageContent === 'function') initPageContent();
});
