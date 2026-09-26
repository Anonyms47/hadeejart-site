/* ======================================================================
   Hadeej'Art Admin — Traduction automatique (FR -> EN / WO)
   La personne qui crée un produit, une catégorie ou une collection n'a qu'à
   écrire en français : les versions anglaise et wolof sont créées à
   l'enregistrement puis stockées en base (le site public reste rapide et
   n'appelle aucun service externe).

   Règles :
   - un champ vide est traduit ;
   - si le texte français change, la traduction est refaite… sauf si vous
     l'avez corrigée à la main (elle est alors conservée) ;
   - si le service est indisponible, le champ reste vide : le site affiche
     alors le français, sans rien casser.

   Service utilisé : point d'accès public de Google Traduction (sans clé),
   avec repli sur MyMemory pour l'anglais seulement (sa traduction wolof est
   trop peu fiable). Les traductions machine, surtout en wolof, restent
   à relire pour les textes importants.
   ====================================================================== */
const TR_CACHE_KEY = 'ha_admin_tr_cache_v1';
let _trCache = null;

function trCacheLoad() {
  if (_trCache) return _trCache;
  try { _trCache = JSON.parse(localStorage.getItem(TR_CACHE_KEY) || '{}'); } catch (e) { _trCache = {}; }
  return _trCache;
}
function trCacheSave() {
  try {
    const keys = Object.keys(_trCache);
    if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(k => delete _trCache[k]);
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify(_trCache));
  } catch (e) { /* stockage indisponible : sans importance */ }
}

async function trFetchJson(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms || 6000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

/* Traduit un texte français ; renvoie '' si impossible. target : 'en' ou 'wo'. */
async function translateText(text, target) {
  const src = String(text || '').trim();
  if (!src) return '';
  const cache = trCacheLoad();
  const key = target + '|' + src;
  if (cache[key]) return cache[key];

  let out = '';
  try {
    const j = await trFetchJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${target}&dt=t&q=${encodeURIComponent(src)}`);
    out = (j[0] || []).map(p => p[0]).join('').trim();
  } catch (e) { out = ''; }

  if (!out && target === 'en') {
    try {
      const j = await trFetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(src)}&langpair=fr|en`);
      if (j && j.responseStatus === 200 && j.responseData) out = String(j.responseData.translatedText || '').trim();
    } catch (e) { out = ''; }
  }
  /* Une « traduction » identique à la source est acceptée (ex : « Wax »). */
  if (out) { cache[key] = out; trCacheSave(); }
  return out;
}

/* Décide de la valeur finale d'un champ traduit.
   current     : ce qui est dans le champ au moment de l'enregistrement
   origFr/origTarget : valeurs enregistrées avant la modification */
async function resolveTranslation(fr, target, current, origFr, origTarget) {
  const cur = String(current || '').trim();
  const frNow = String(fr || '').trim();
  if (!frNow) return cur || null;
  const edited = cur && cur !== String(origTarget || '').trim();   /* corrigée à la main */
  if (edited) return cur;
  const frChanged = frNow !== String(origFr || '').trim();
  if (!cur || frChanged) {
    const tr = await translateText(frNow, target);
    return tr || cur || null;
  }
  return cur;
}
