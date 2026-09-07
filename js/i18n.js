/* ======================================================================
   Hadeej'Art — Langue (FR / EN / WO)
   L'admin ne saisit qu'en français ; cette structure permet d'afficher un
   contenu traduit (name_en/name_wo, etc.) avec repli automatique sur le
   français quand la traduction n'existe pas encore.
   ====================================================================== */

const SUPPORTED_LANGS = ['fr', 'en', 'wo'];

let CURRENT_LANG = (localStorage.getItem('ha_lang') || 'fr').toLowerCase();
if (!SUPPORTED_LANGS.includes(CURRENT_LANG)) CURRENT_LANG = 'fr';

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  CURRENT_LANG = lang;
  localStorage.setItem('ha_lang', lang);
  document.documentElement.lang = lang;
  if (typeof onLangChange === 'function') onLangChange();
}

/* Lit row[`${field}_${CURRENT_LANG}`] avec repli sur row[`${field}_fr`]. */
function pickLang(row, field) {
  if (!row) return '';
  const val = row[field + '_' + CURRENT_LANG];
  return (val && String(val).trim()) ? val : (row[field + '_fr'] || '');
}

/* Petit lexique pour les libellés fixes de l'interface publique. */
const UI_STRINGS = {
  fr: {
    catalogue: 'Catalogue', all: 'Tous', add: 'Ajouter', buy: 'Acheter', detail: 'Détail',
    cart: 'Panier', empty_cart: 'Panier vide', subtotal: 'Sous-total', total: 'Total',
    checkout: 'Finaliser', no_products: 'Aucun produit dans cette catégorie pour le moment.',
    loading: 'Chargement du catalogue…'
  },
  en: {
    catalogue: 'Catalogue', all: 'All', add: 'Add', buy: 'Buy', detail: 'Details',
    cart: 'Cart', empty_cart: 'Cart is empty', subtotal: 'Subtotal', total: 'Total',
    checkout: 'Checkout', no_products: 'No products in this category yet.',
    loading: 'Loading catalogue…'
  },
  wo: {
    catalogue: 'Marsandiis', all: 'Yépp', add: 'Yokk', buy: 'Jënd', detail: 'Njàng',
    cart: 'Panier', empty_cart: 'Panier neen', subtotal: 'Wàll', total: 'Lëpp',
    checkout: 'Jeexal', no_products: 'Amul marsandiis ci wàll bii.',
    loading: 'Yëngal katalog…'
  }
};

function t(key) {
  const dict = UI_STRINGS[CURRENT_LANG] || UI_STRINGS.fr;
  return dict[key] || UI_STRINGS.fr[key] || key;
}
