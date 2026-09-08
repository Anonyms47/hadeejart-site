/* ======================================================================
   Hadeej'Art — Langue (FR / EN / WO)
   L'admin ne saisit qu'en français ; cette structure permet d'afficher un
   contenu traduit (name_en/name_wo, etc.) avec repli automatique sur le
   français quand la traduction n'existe pas encore. Ce fichier couvre
   aussi la traduction exhaustive de l'interface publique (data-i18n).
   ====================================================================== */

const SUPPORTED_LANGS = ['fr', 'en', 'wo'];

let CURRENT_LANG = (localStorage.getItem('ha_lang') || 'fr').toLowerCase();
if (!SUPPORTED_LANGS.includes(CURRENT_LANG)) CURRENT_LANG = 'fr';

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  CURRENT_LANG = lang;
  localStorage.setItem('ha_lang', lang);
  document.documentElement.lang = lang;
  applyStaticTranslations();
  if (typeof onLangChange === 'function') onLangChange();
}

/* Lit row[`${field}_${CURRENT_LANG}`] avec repli sur row[`${field}_fr`]. */
function pickLang(row, field) {
  if (!row) return '';
  const val = row[field + '_' + CURRENT_LANG];
  return (val && String(val).trim()) ? val : (row[field + '_fr'] || '');
}

/* ======================================================================
   Lexique complet de l'interface publique.
   ====================================================================== */
const UI_STRINGS = {
  fr: {
    badge: 'Pièces stylées & authentiquement africaines',
    lang_label: 'Langue', currency_label: 'Devise',
    cart: 'Panier',

    hero_title_html: 'Racontez votre histoire.<br/>Portez l’Afrique.',
    hero_sub: 'Collection Hadeej’Art — Confort, modernité, personnalisation.',
    hero_note_html: 'Astuce : utilisez <b>Détail</b> pour choisir couleur, taille (S–XXL), tissu et une note libre.',
    cta_view_collection: 'Voir la collection', cta_new: 'Nouveautés',

    catalogue: 'Catalogue', all: 'Tous', add: 'Ajouter', buy: 'Acheter', detail: 'Détail',
    no_products: 'Aucun produit dans cette catégorie pour le moment.',
    loading: 'Chargement du catalogue…',
    photo_coming: ' (photo à venir)',
    price_unavailable_in: cur => ` (FCFA — indisponible en ${cur})`,

    cart_title: 'Votre panier', empty_cart: 'Panier vide',
    subtotal: 'Sous-total', total: 'Total', checkout: 'Finaliser',

    detail_default_title: 'Détail', close: 'Fermer', fullscreen_title: 'Voir en plein écran',
    color_label: 'Couleur', color_placeholder: 'ex: Orange',
    size_label: 'Taille',
    fabric_label: 'Tissu', fabric_placeholder: 'ex: Wax',
    note_label: 'Note (facultatif)', note_placeholder: 'ex: manches longues',
    sex_label: 'Sexe', sex_unisex: 'Unisexe', sex_male: 'Homme', sex_female: 'Femme',
    add_to_cart: 'Ajouter au panier',
    variant_with: 'Avec pantalon', variant_without: 'Sans pantalon',

    client_title: 'Mes informations',
    name_label: 'Nom complet', name_placeholder: 'ex: Aïcha Diop',
    phone_label: 'Téléphone (WhatsApp)', phone_placeholder: '77 123 45 67',
    email_label: 'E-mail (facultatif)', email_placeholder: 'vous@exemple.com',
    country_label: 'Pays', country_placeholder: 'Sénégal',
    city_label: 'Ville', city_placeholder: 'Dakar',
    district_label: 'Quartier', district_placeholder: 'Sicap Mbao',
    location_label: 'Localisation de livraison',
    map_search_placeholder: 'Rechercher une adresse…',
    map_search_btn: 'Chercher', map_locate_btn: '📍 Ma position',
    map_status_default: 'Déplacez le repère ou recherchez votre adresse.',
    address_detected_label: 'Adresse détectée',
    address_detected_placeholder: "s'affiche après sélection sur la carte",
    location_note_label: 'Précision libre (repère, étage…)',
    location_note_placeholder: 'ex: portail bleu, 2e étage',
    remember_label: 'Se souvenir de mes informations',
    payment_label: 'Mode de paiement',
    place_order_btn: 'Passer la commande', sending: 'Envoi en cours…',
    invoice_hint: 'Une facture (image) sera générée et partagée sur WhatsApp.',

    map_reverse_searching: 'Recherche de l’adresse…',
    map_address_found: 'Adresse détectée.',
    map_address_not_found: 'Adresse introuvable — précisez avec la note libre.',
    map_address_offline: 'Adresse indisponible (hors ligne ?) — vous pouvez continuer, précisez avec la note libre.',
    map_geo_unavailable: 'Géolocalisation non disponible sur cet appareil.',
    map_locating: 'Localisation en cours…',
    map_geo_denied: 'Localisation refusée. Vous pouvez l’autoriser dans les réglages du navigateur, ou utiliser la recherche / déplacer le repère.',
    map_geo_position_unavailable: 'Position indisponible pour le moment — utilisez la recherche ou déplacez le repère.',
    map_geo_timeout: 'Localisation trop longue à obtenir — utilisez la recherche ou déplacez le repère.',
    map_geo_generic_fail: 'Localisation impossible — utilisez la recherche ou déplacez le repère.',
    map_searching: 'Recherche…', map_no_results: 'Aucun résultat pour cette recherche.',
    map_search_offline: 'Recherche indisponible (hors ligne ?).',

    val_name_required: 'Merci d’indiquer votre nom.',
    val_name_too_long: 'Le nom est trop long.',
    val_phone_required: 'Merci d’indiquer votre téléphone.',
    val_phone_invalid: 'Le numéro de téléphone n’est pas valide.',
    val_email_invalid: 'L’adresse e-mail n’est pas valide.',
    val_cart_empty: 'Votre panier est vide.',
    val_order_rejected_generic: 'Commande refusée. Vérifiez les champs et réessayez.',
    val_whatsapp_redirect_failed: 'Redirection WhatsApp impossible. Vérifiez les champs et réessayez.',

    srv_cart_empty: 'Le panier est vide.',
    srv_name_required: 'Nom client requis.',
    srv_name_too_long: 'Nom trop long (120 caractères maximum).',
    srv_phone_required: 'Téléphone client requis.',
    srv_phone_invalid: 'Format de téléphone invalide.',
    srv_email_too_long: 'E-mail trop long.',
    srv_email_invalid: 'Format d’e-mail invalide.',
    srv_payment_not_allowed: 'Moyen de paiement non autorisé.',
    srv_rate_limited: 'Trop de commandes envoyées récemment avec ce numéro. Merci de réessayer dans quelques minutes.',
    srv_product_unavailable: 'Produit invalide ou indisponible.',
    srv_too_many_items: 'Trop d’articles dans une seule commande',
    srv_size_invalid: 'Taille non valide',
    srv_size_not_available: 'non disponible pour ce produit',
    srv_qty_invalid: 'Quantité invalide',

    privacy_link: 'Politique de confidentialité',
    lightbox_alt: 'Aperçu produit',

    invoice_ref_label: 'Facture · Réf:',
    invoice_order_badge: 'COMMANDE',
    invoice_client_details: 'Détails client',
    invoice_name: 'Nom :', invoice_phone: 'Téléphone :', invoice_place: 'Lieu :',
    invoice_position: 'Position :', invoice_payment: 'Paiement :',
    invoice_articles: 'Articles', invoice_total: 'TOTAL',
    invoice_thanks: 'Merci pour votre confiance — Hadeej’Art · WhatsApp 78-144-43-40',

    wa_new_order: '*Nouvelle commande — Hadeej’Art*',
    wa_ref: 'Réf:', wa_name: 'Nom:', wa_phone: 'Téléphone:', wa_email: 'E-mail:',
    wa_location_line: (country, city, district) => `Pays: ${country} · Ville: ${city} · Quartier: ${district}`,
    wa_address_detected: 'Adresse détectée:', wa_precision: 'Précision:', wa_position: 'Position:',
    wa_articles: '*Articles:*', wa_note: 'Note:', wa_total: 'Total:', wa_payment: 'Paiement:',
    dash: '—'
  },

  en: {
    badge: 'Stylish, authentically African pieces',
    lang_label: 'Language', currency_label: 'Currency',
    cart: 'Cart',

    hero_title_html: 'Tell your story.<br/>Wear Africa.',
    hero_sub: 'Hadeej’Art Collection — Comfort, modern style, personalisation.',
    hero_note_html: 'Tip: use <b>Details</b> to choose colour, size (S–XXL), fabric and a free note.',
    cta_view_collection: 'View the collection', cta_new: 'New arrivals',

    catalogue: 'Catalogue', all: 'All', add: 'Add', buy: 'Buy', detail: 'Details',
    no_products: 'No products in this category yet.',
    loading: 'Loading catalogue…',
    photo_coming: ' (photo coming soon)',
    price_unavailable_in: cur => ` (FCFA — unavailable in ${cur})`,

    cart_title: 'Your cart', empty_cart: 'Cart is empty',
    subtotal: 'Subtotal', total: 'Total', checkout: 'Checkout',

    detail_default_title: 'Details', close: 'Close', fullscreen_title: 'View fullscreen',
    color_label: 'Colour', color_placeholder: 'e.g. Orange',
    size_label: 'Size',
    fabric_label: 'Fabric', fabric_placeholder: 'e.g. Wax',
    note_label: 'Note (optional)', note_placeholder: 'e.g. long sleeves',
    sex_label: 'Gender', sex_unisex: 'Unisex', sex_male: 'Men', sex_female: 'Women',
    add_to_cart: 'Add to cart',
    variant_with: 'With trousers', variant_without: 'Without trousers',

    client_title: 'My details',
    name_label: 'Full name', name_placeholder: 'e.g. Aïcha Diop',
    phone_label: 'Phone (WhatsApp)', phone_placeholder: '77 123 45 67',
    email_label: 'Email (optional)', email_placeholder: 'you@example.com',
    country_label: 'Country', country_placeholder: 'Senegal',
    city_label: 'City', city_placeholder: 'Dakar',
    district_label: 'District', district_placeholder: 'Sicap Mbao',
    location_label: 'Delivery location',
    map_search_placeholder: 'Search for an address…',
    map_search_btn: 'Search', map_locate_btn: '📍 My location',
    map_status_default: 'Move the pin or search for your address.',
    address_detected_label: 'Detected address',
    address_detected_placeholder: 'appears once you pick a spot on the map',
    location_note_label: 'Free note (landmark, floor…)',
    location_note_placeholder: 'e.g. blue gate, 2nd floor',
    remember_label: 'Remember my details',
    payment_label: 'Payment method',
    place_order_btn: 'Place order', sending: 'Sending…',
    invoice_hint: 'An invoice (image) will be generated and shared on WhatsApp.',

    map_reverse_searching: 'Looking up the address…',
    map_address_found: 'Address detected.',
    map_address_not_found: 'Address not found — add detail with the free note.',
    map_address_offline: 'Address unavailable (offline?) — you can continue, add detail with the free note.',
    map_geo_unavailable: 'Geolocation is not available on this device.',
    map_locating: 'Locating…',
    map_geo_denied: 'Location access denied. You can allow it in your browser settings, or use search / move the pin.',
    map_geo_position_unavailable: 'Position unavailable right now — use search or move the pin.',
    map_geo_timeout: 'Location took too long — use search or move the pin.',
    map_geo_generic_fail: 'Could not get your location — use search or move the pin.',
    map_searching: 'Searching…', map_no_results: 'No results for this search.',
    map_search_offline: 'Search unavailable (offline?).',

    val_name_required: 'Please enter your name.',
    val_name_too_long: 'The name is too long.',
    val_phone_required: 'Please enter your phone number.',
    val_phone_invalid: 'The phone number is not valid.',
    val_email_invalid: 'The email address is not valid.',
    val_cart_empty: 'Your cart is empty.',
    val_order_rejected_generic: 'Order refused. Please check the fields and try again.',
    val_whatsapp_redirect_failed: 'Could not redirect to WhatsApp. Please check the fields and try again.',

    srv_cart_empty: 'The cart is empty.',
    srv_name_required: 'Customer name required.',
    srv_name_too_long: 'Name too long (120 characters max).',
    srv_phone_required: 'Customer phone required.',
    srv_phone_invalid: 'Invalid phone format.',
    srv_email_too_long: 'Email too long.',
    srv_email_invalid: 'Invalid email format.',
    srv_payment_not_allowed: 'Payment method not allowed.',
    srv_rate_limited: 'Too many orders sent recently with this number. Please try again in a few minutes.',
    srv_product_unavailable: 'Invalid or unavailable product.',
    srv_too_many_items: 'Too many items in a single order',
    srv_size_invalid: 'Invalid size',
    srv_size_not_available: 'not available for this product',
    srv_qty_invalid: 'Invalid quantity',

    privacy_link: 'Privacy policy',
    lightbox_alt: 'Product preview',

    invoice_ref_label: 'Invoice · Ref:',
    invoice_order_badge: 'ORDER',
    invoice_client_details: 'Customer details',
    invoice_name: 'Name:', invoice_phone: 'Phone:', invoice_place: 'Place:',
    invoice_position: 'Position:', invoice_payment: 'Payment:',
    invoice_articles: 'Items', invoice_total: 'TOTAL',
    invoice_thanks: 'Thank you for your trust — Hadeej’Art · WhatsApp 78-144-43-40',

    wa_new_order: '*New order — Hadeej’Art*',
    wa_ref: 'Ref:', wa_name: 'Name:', wa_phone: 'Phone:', wa_email: 'Email:',
    wa_location_line: (country, city, district) => `Country: ${country} · City: ${city} · District: ${district}`,
    wa_address_detected: 'Detected address:', wa_precision: 'Note:', wa_position: 'Position:',
    wa_articles: '*Items:*', wa_note: 'Note:', wa_total: 'Total:', wa_payment: 'Payment:',
    dash: '—'
  },

  wo: {
    badge: 'Yëf yu rafet, wone askan wi Afrig',
    lang_label: 'Làkk', currency_label: 'Xaalis',
    cart: 'Panier',

    hero_title_html: 'Wax sa taariix.<br/>Solu Afrig.',
    hero_sub: 'Koleksiyoŋ Hadeej’Art — Ndare, taxaw ci jamono, defar ko ni sa neex.',
    hero_note_html: 'Xalaat : jëfandikoo <b>Detay</b> ngir tannal melo, tay (S–XXL), tisu ak leneen mbir.',
    cta_view_collection: 'Xool koleksiyoŋ bi', cta_new: 'Yu bees',

    catalogue: 'Katalog', all: 'Yépp', add: 'Yokk', buy: 'Jënd', detail: 'Detay',
    no_products: 'Amul marsandiis ci wàll bii, léegi.',
    loading: 'Di yëngal katalog bi…',
    photo_coming: ' (nataal dina ñëw)',
    price_unavailable_in: cur => ` (FCFA — amul ci ${cur})`,

    cart_title: 'Sa panier', empty_cart: 'Panier bi neen',
    subtotal: 'Wàll', total: 'Lëpp', checkout: 'Jeexal',

    detail_default_title: 'Detay', close: 'Tëj', fullscreen_title: 'Xool ko bu mag',
    color_label: 'Melo', color_placeholder: 'misaal: Orange',
    size_label: 'Tay',
    fabric_label: 'Tisu', fabric_placeholder: 'misaal: Wax',
    note_label: 'Nott (du obligatwaar)', note_placeholder: 'misaal: loxo yu gudd',
    sex_label: 'Xeet', sex_unisex: 'Ñëpp', sex_male: 'Góor', sex_female: 'Jigéen',
    add_to_cart: 'Yokk ko ci panier bi',
    variant_with: 'Ak tubéey', variant_without: 'Amul tubéey',

    client_title: 'Sama xibaar',
    name_label: 'Tur wu mat', name_placeholder: 'misaal: Aïcha Diop',
    phone_label: 'Telefon (WhatsApp)', phone_placeholder: '77 123 45 67',
    email_label: 'Imeel (du obligatwaar)', email_placeholder: 'yow@misaal.com',
    country_label: 'Réew', country_placeholder: 'Senegaal',
    city_label: 'Dëkk', city_placeholder: 'Dakar',
    district_label: 'Kartye', district_placeholder: 'Sicap Mbao',
    location_label: 'Barab bu ñu yónnee sa yoon',
    map_search_placeholder: 'Seet sa adres…',
    map_search_btn: 'Seet', map_locate_btn: '📍 Sama barab',
    map_status_default: 'Wutal marker bi walla seet sa adres.',
    address_detected_label: 'Adres bi ñu gis',
    address_detected_placeholder: 'dina feeñ bu nga tànn barab ci karte bi',
    location_note_label: 'Leneen mbir (marque, etaas…)',
    location_note_placeholder: 'misaal: porte bu bulo, etaas 2',
    remember_label: 'Fàttaliku sama xibaar yi',
    payment_label: 'Ni ngay fay',
    place_order_btn: 'Yónnee sa commande', sending: 'Di yónnee…',
    invoice_hint: 'Dinañu defar ab nataal facture te yónnee ko ci WhatsApp.',

    map_reverse_searching: 'Di seet adres bi…',
    map_address_found: 'Adres bi gis nañu.',
    map_address_not_found: 'Adres bi gisul — bindal leneen mbir ci nott bi.',
    map_address_offline: 'Adres bi amul (internet dafa dëpp?) — mën nga wéy, bindal ci nott bi.',
    map_geo_unavailable: 'Localisation bi amul ci sa téere bi.',
    map_locating: 'Di seet sa barab…',
    map_geo_denied: 'Bañ nañu localisation bi. Mën nga ubbi ko ci paramet yi, walla jëfandikoo seet walla wutal marker bi.',
    map_geo_position_unavailable: 'Barab bi amul léegi — jëfandikoo seet walla wutal marker bi.',
    map_geo_timeout: 'Lu yàgg lool ngir am sa barab — jëfandikoo seet walla wutal marker bi.',
    map_geo_generic_fail: 'Mënunu am sa barab — jëfandikoo seet walla wutal marker bi.',
    map_searching: 'Di seet…', map_no_results: 'Amul benn resultaa ci seet bi.',
    map_search_offline: 'Seet bi amul (internet dafa dëpp?).',

    val_name_required: 'Bindal sa tur.',
    val_name_too_long: 'Tur wi gudd na lool.',
    val_phone_required: 'Bindal sa numero telefon.',
    val_phone_invalid: 'Numero telefon bi baaxul.',
    val_email_invalid: 'Imeel bi baaxul.',
    val_cart_empty: 'Sa panier neen na.',
    val_order_rejected_generic: 'Bañ nañu commande bi. Xoolaat sa xibaar yi te jéemaat.',
    val_whatsapp_redirect_failed: 'Mënunu dem ci WhatsApp. Xoolaat sa xibaar yi te jéemaat.',

    srv_cart_empty: 'Panier bi neen na.',
    srv_name_required: 'Soxla nañu tur wi.',
    srv_name_too_long: 'Tur wi gudd na lool (120 lëtar bu ëpp).',
    srv_phone_required: 'Soxla nañu numero telefon.',
    srv_phone_invalid: 'Format telefon bi baaxul.',
    srv_email_too_long: 'Imeel bi gudd na lool.',
    srv_email_invalid: 'Format imeel bi baaxul.',
    srv_payment_not_allowed: 'Ni ngay fay du jaay.',
    srv_rate_limited: 'Yónnee nga commande yu bari ci numero bii. Jéemaat lu néew.',
    srv_product_unavailable: 'Marsandiis bi amul walla baaxul.',
    srv_too_many_items: 'Yeneen yu bari ci benn commande',
    srv_size_invalid: 'Tay bi baaxul',
    srv_size_not_available: 'amul ci marsandiis bi',
    srv_qty_invalid: 'Limu bi baaxul',

    privacy_link: 'Politig ci sutura',
    lightbox_alt: 'Nataal marsandiis',

    invoice_ref_label: 'Facture · Ref:',
    invoice_order_badge: 'COMMANDE',
    invoice_client_details: 'Xibaaru client bi',
    invoice_name: 'Tur :', invoice_phone: 'Telefon :', invoice_place: 'Barab :',
    invoice_position: 'Position :', invoice_payment: 'Fay :',
    invoice_articles: 'Yëf yi', invoice_total: 'LËPP',
    invoice_thanks: 'Jërëjëf ci sa wóolo — Hadeej’Art · WhatsApp 78-144-43-40',

    wa_new_order: '*Commande bu bees — Hadeej’Art*',
    wa_ref: 'Ref:', wa_name: 'Tur:', wa_phone: 'Telefon:', wa_email: 'Imeel:',
    wa_location_line: (country, city, district) => `Réew: ${country} · Dëkk: ${city} · Kartye: ${district}`,
    wa_address_detected: 'Adres bi gis:', wa_precision: 'Nott:', wa_position: 'Position:',
    wa_articles: '*Yëf yi:*', wa_note: 'Nott:', wa_total: 'Lëpp:', wa_payment: 'Fay:',
    dash: '—'
  }
};

function t(key) {
  const dict = UI_STRINGS[CURRENT_LANG] || UI_STRINGS.fr;
  const val = dict[key];
  if (typeof val === 'function') return val;
  return val != null ? val : (UI_STRINGS.fr[key] != null ? UI_STRINGS.fr[key] : key);
}

/* Traduit les messages d'erreur renvoyés par le serveur (fonction SQL
   place_order, toujours en français) en repérant leur préfixe connu ;
   conserve la partie variable (ex: "Taille non valide : XXXL"). */
function translateServerError(message) {
  if (!message) return t('val_order_rejected_generic');
  const map = [
    ['Le panier est vide.', 'srv_cart_empty'],
    ['Nom client requis.', 'srv_name_required'],
    ['Nom trop long', 'srv_name_too_long'],
    ['Téléphone client requis.', 'srv_phone_required'],
    ['Format de téléphone invalide.', 'srv_phone_invalid'],
    ['E-mail trop long.', 'srv_email_too_long'],
    ['Format d’e-mail invalide.', 'srv_email_invalid'],
    ['Moyen de paiement non autorisé.', 'srv_payment_not_allowed'],
    ['Trop de commandes envoyées récemment', 'srv_rate_limited'],
    ['Produit invalide ou indisponible.', 'srv_product_unavailable'],
    ['Trop d’articles dans une seule commande', 'srv_too_many_items'],
    ['Taille non valide', 'srv_size_invalid'],
    ['non disponible pour ce produit', 'srv_size_not_available'],
    ['Quantité invalide', 'srv_qty_invalid']
  ];
  for (const [prefix, key] of map) {
    if (message.indexOf(prefix) !== -1) return t(key);
  }
  return message;
}

/* Traduit tout le HTML statique marqué avec data-i18n / data-i18n-html /
   data-i18n-placeholder / data-i18n-title / data-i18n-aria. Appelé au
   chargement et à chaque changement de langue. */
function applyStaticTranslations(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  scope.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  scope.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
  scope.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  scope.querySelectorAll('[data-i18n-alt]').forEach(el => { el.alt = t(el.getAttribute('data-i18n-alt')); });
}
