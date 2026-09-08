/* ======================================================================
   Hadeej'Art — Accès Supabase (site public)
   Requêtes REST brutes (pas de dépendance supplémentaire) + cache local
   "stale-while-revalidate" pour ne pas ralentir l'affichage.
   ====================================================================== */

const CATALOG_CACHE_KEY = 'ha_catalog_cache_v2';
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000; /* 10 min */

function supabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY
  };
}

async function fetchCategories() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&order=sort_order.asc`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) throw new Error('Erreur chargement catégories: ' + res.status);
  return res.json();
}

async function fetchProducts() {
  const select = encodeURIComponent(
    '*,categories(slug,name_fr,name_en,name_wo),' +
    'product_images(image_url,sort_order,is_primary,alt_fr),' +
    'product_collections(collections(slug,name_fr))'
  );
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=${select}&status=eq.published&order=sort_order.asc`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) throw new Error('Erreur chargement produits: ' + res.status);
  return res.json();
}

/* Uniquement les collections publiées par l'admin : aucune collection
   fictive ou précréée côté site public. */
async function fetchCollections() {
  const select = encodeURIComponent('id,slug,name_fr,name_en,name_wo,cover_image_url');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/collections?select=${select}&status=eq.published&order=created_at.asc`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) throw new Error('Erreur chargement collections: ' + res.status);
  return res.json();
}

function readCatalogCache() {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt) return null;
    return parsed;
  } catch (e) { return null; }
}

function writeCatalogCache(categories, products, collections) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ categories, products, collections, savedAt: Date.now() }));
  } catch (e) { /* stockage indisponible : tant pis, pas bloquant */ }
}

/* Charge le catalogue : affiche immédiatement le cache local s'il existe
   (même périmé) pour un rendu instantané, puis revalide en tâche de fond
   et ré-affiche si les données ont changé. */
async function loadCatalog(onUpdate) {
  const cached = readCatalogCache();
  if (cached) {
    applyCatalogData(cached.categories, cached.products, cached.collections);
    if (onUpdate) onUpdate();
  }

  const isFresh = cached && (Date.now() - cached.savedAt) < CATALOG_CACHE_TTL_MS;
  if (isFresh) return;

  try {
    const [categories, products, collections] = await Promise.all([fetchCategories(), fetchProducts(), fetchCollections()]);
    writeCatalogCache(categories, products, collections);
    applyCatalogData(categories, products, collections);
    if (onUpdate) onUpdate();
  } catch (err) {
    console.error('loadCatalog:', err);
    if (!cached && onUpdate) onUpdate(); /* déclenche l'affichage de l'état vide/erreur */
  }
}

/* Passe commande via la fonction serveur place_order (calcule les prix
   côté base, ne fait jamais confiance aux montants envoyés par le client). */
async function placeOrderRemote(payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, supabaseHeaders()),
    body: JSON.stringify({ payload })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.hint)) || ('Erreur serveur (' + res.status + ')');
    const err = new Error(msg);
    /* Distingue un rejet volontaire (validation, anti-abus) d'une panne
       réseau : seul le second cas justifie un repli silencieux sur
       WhatsApp seul (voir haOrder() dans checkout.js). */
    err.isValidation = true;
    throw err;
  }
  return data;
}
