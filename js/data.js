/* ======================================================================
   Hadeej'Art — État catalogue (alimenté par Supabase, voir js/api.js)
   Ce fichier ne contient plus de données statiques : il expose l'état
   courant (CATEGORIES, PRODUCTS) et les mêmes helpers qu'avant, pour que
   cart.js / catalogue.js / checkout.js / invoice.js n'aient rien à
   connaître de Supabase.
   ====================================================================== */

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/* "Tous" + les 6 catégories chargées depuis la base (voir api.js). */
let CATEGORIES = [{ id: 'tous', label: t('all') }];
let PRODUCTS = [];
let CATALOG_LOADED = false;
let RAW_CATEGORIES = [];
let RAW_PRODUCTS = [];

/* Libellé traduit d'un choix de variante (ex: "Avec pantalon" / "With
   trousers" / "Ak tubéey") à partir du produit et de la valeur technique
   stockée dans la ligne de panier. Repli sur la valeur brute si inconnue. */
function variantChoiceLabel(productId, value) {
  if (!value) return '';
  const p = PRODUCTS.find(x => x.id === productId);
  const choice = p && p.variantOptions && p.variantOptions.choices.find(c => c.value === value);
  return choice ? choice.label : value;
}

function isGenderedProduct(p) {
  if (!p) return false;
  if (p.gendered) return true;
  const txt = ((p.id || '') + ' ' + (p.name || '')).toLowerCase();
  return txt.includes('homme') || txt.includes('femme');
}

/* Reçoit les lignes brutes Supabase (categories, products avec leurs
   images/collections jointes) et les transforme dans la forme attendue
   par le reste du site. Appelé par api.js, et de nouveau à chaque
   changement de langue pour ré-appliquer les libellés traduits. */
function applyCatalogData(categoryRows, productRows) {
  RAW_CATEGORIES = categoryRows || RAW_CATEGORIES;
  RAW_PRODUCTS = productRows || RAW_PRODUCTS;
  categoryRows = RAW_CATEGORIES;
  productRows = RAW_PRODUCTS;

  CATEGORIES = [{ id: 'tous', label: t('all') }].concat(
    (categoryRows || []).map(c => ({ id: c.slug, label: pickLang(c, 'name'), _row: c }))
  );

  PRODUCTS = (productRows || []).map(p => {
    const images = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const primary = images.find(i => i.is_primary) || images[0];
    const variantOptions = p.variant_options ? {
      id: p.variant_options.id,
      label: pickLang(p.variant_options, 'label'),
      choices: (p.variant_options.choices || []).map(c => ({
        value: c.value,
        label: pickLang(c, 'label'),
        prices: { FCFA: c.price_fcfa, EUR: c.price_eur, USD: c.price_usd }
      }))
    } : null;

    return {
      id: p.slug,
      _dbId: p.id,
      name: pickLang(p, 'name'),
      fabric: pickLang(p, 'fabric'),
      img: primary ? primary.image_url : '',
      images: images.map(i => i.image_url),
      category: p.categories ? p.categories.slug : null,
      sizes: (p.sizes && p.sizes.length) ? p.sizes : SIZES,
      colors: p.colors || [],
      gendered: !!p.gendered,
      variantOptions,
      prices: { FCFA: p.price_fcfa, EUR: p.price_eur, USD: p.price_usd },
      collectionSlugs: (p.product_collections || []).map(pc => pc.collections && pc.collections.slug).filter(Boolean)
    };
  });

  CATALOG_LOADED = true;
}

/* Ré-applique les libellés dans la langue courante sans re-télécharger le
   catalogue (utilisé quand le visiteur change de langue). */
function refreshCatalogLabels() {
  if (RAW_CATEGORIES.length || RAW_PRODUCTS.length) applyCatalogData();
}
