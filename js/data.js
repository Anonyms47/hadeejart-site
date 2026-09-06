/* ======================================================================
   Hadeej'Art — Données produits & catégories
   Ce fichier est le point unique de vérité pour le catalogue.
   Il est conçu pour être remplacé plus tard par un appel à une API/admin
   (chaque produit garde déjà : category, sizes, fabric, colors) sans
   changer le reste du code (catalogue.js / cart.js lisent uniquement
   ces structures).
   ====================================================================== */

/* Catégories cibles (certaines n'ont pas encore de produit : c'est prévu,
   l'admin futur pourra en ajouter sans toucher au code). */
const CATEGORIES = [
  { id: 'tous',         label: 'Tous' },
  { id: 'pantalons',    label: 'Pantalons' },
  { id: 'robes',        label: 'Robes' },
  { id: 'kimonos',      label: 'Kimonos' },
  { id: 'combinaisons', label: 'Combinaisons' },
  { id: 'sacs',         label: 'Sacs' },
  { id: 'chaussures',   label: 'Chaussures' },
  { id: 'accessoires',  label: 'Accessoires' }
];

/* Tailles standard proposées à la commande */
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/* Devise d'affichage par défaut. La conversion EUR/USD est une étape
   future : formatPrice() est le seul endroit à modifier le jour où
   plusieurs devises seront actives (voir README d'architecture). */
const CURRENCY = 'FCFA';
function formatPrice(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' ' + CURRENCY;
}

/* ====== PRODUITS ======
   sizes  : tailles disponibles pour ce produit
   fabric : tissu par défaut (l'acheteur peut préciser une note libre)
   colors : couleurs suggérées (l'acheteur peut aussi taper une couleur libre) */
const PRODUCTS = [
  { id: 'boob', name: 'Boob (bob africain)', price: 2500, img: 'images/boob.jpg',
    category: 'accessoires', sizes: ['S','M','L'], fabric: 'Wax', colors: ['Orange','Multicolore'] },

  { id: 'ensemble-pantalon-boob-homme', name: 'Ensemble Pantalon + Boob (Homme)', price: 5000, img: 'images/ensemble-pantalon-boob.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true },

  { id: 'ensemble-pantalon-boob-femme', name: 'Ensemble Pantalon + Boob (Femme)', price: 6000, img: 'images/ensemble-pantalon-boob.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true },

  { id: 'pantalon', name: 'Pantalon', price: 3000, img: 'images/pantalon.jpg',
    category: 'pantalons', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'kimono-versace', name: 'Kimono en Versace', price: 10000, img: 'images/kimono-versace.jpg',
    category: 'kimonos', sizes: SIZES, fabric: 'Versace', colors: [] },

  { id: 'kimono-court', name: 'Kimono Court', price: 6000, img: 'images/kimono-court.jpg',
    category: 'kimonos', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'ensemble-kimono-homme', name: 'Ensemble Kimono Homme', price: 10000, img: 'images/ensemble-kimono-homme.jpg',
    category: 'kimonos', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true,
    variantOptions: { id: 'optionKimono', label: 'Option', choices: [
      { value: 'avec', label: 'Avec pantalon', price: 12000 },
      { value: 'sans', label: 'Sans pantalon', price: 10000 }
    ]}},

  { id: 'kimono-long', name: 'Kimono Long', price: 8000, img: 'images/kimono-long.jpg',
    category: 'kimonos', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'ensemble-short', name: 'Ensemble Short', price: 8000, img: 'images/ensemble-short.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'pantalon-kimono-court-ens', name: 'Pantalon + Kimono Court (ensemble)', price: 12000, img: 'images/pantalon-kimono-court.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'bas-large-chemise-top-ens', name: 'Bas Large + Chemise Top (ensemble)', price: 10000, img: 'images/bas-large-chemise-top.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'ensemble-chemise-pantalon-homme', name: 'Ensemble Chemise + Pantalon pour Homme', price: 10000, img: 'images/ensemble-chemise-pantalon-homme.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true },

  { id: 'ensemble-short-homme', name: 'Ensemble short pour Homme', price: 8000, img: 'images/ensemble-short-homme.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true },

  { id: 'pantalon-bas-large', name: 'Pantalon bas large', price: 3000, img: 'images/pantalon-bas-large.jpg',
    category: 'pantalons', sizes: SIZES, fabric: 'Wax', colors: [] },

  { id: 'ensemble-chemise-pantalons-femme', name: 'Ensemble chemise et pantalons pour Femme', price: 10000, img: 'images/ensemble-chemise-pantalons-femme.jpg',
    category: 'combinaisons', sizes: SIZES, fabric: 'Wax', colors: [], gendered: true }
];

/* Un produit est "genré" (masculin/féminin déjà dans son nom) : on masque
   alors le champ Sexe dans le détail, au lieu de le proposer en plus. */
function isGenderedProduct(p) {
  if (!p) return false;
  if (p.gendered) return true;
  const t = ((p.id || '') + ' ' + (p.name || '')).toLowerCase();
  return t.includes('homme') || t.includes('femme');
}
