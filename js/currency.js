/* ======================================================================
   Hadeej'Art — Devise (FCFA / EUR / USD)
   Prix saisis manuellement par produit côté admin : AUCUNE conversion
   automatique n'est appliquée ici. Si un produit n'a pas de prix dans la
   devise choisie, on affiche son prix FCFA (toujours obligatoire) avec
   une mention explicite, plutôt que d'inventer un taux de change.
   La devise est indépendante de la langue (stockage distinct).
   ====================================================================== */

const SUPPORTED_CURRENCIES = ['FCFA', 'EUR', 'USD'];
const CURRENCY_SYMBOLS = { FCFA: 'FCFA', EUR: '€', USD: '$' };

let CURRENT_CURRENCY = (localStorage.getItem('ha_currency') || 'FCFA').toUpperCase();
if (!SUPPORTED_CURRENCIES.includes(CURRENT_CURRENCY)) CURRENT_CURRENCY = 'FCFA';

function setCurrency(cur) {
  if (!SUPPORTED_CURRENCIES.includes(cur)) return;
  CURRENT_CURRENCY = cur;
  localStorage.setItem('ha_currency', cur);
  if (typeof onCurrencyChange === 'function') onCurrencyChange();
}

/* Retourne { amount, currency, isFallback } pour un produit donné, en
   tenant compte d'une éventuelle option de variante (ex: kimono avec/sans
   pantalon) qui porte ses propres prix par devise. */
function priceForProduct(product, optionValue) {
  let prices = product && product.prices; // { FCFA, EUR, USD }
  if (optionValue && product && product.variantOptions) {
    const choice = product.variantOptions.choices.find(c => c.value === optionValue);
    if (choice && choice.prices) prices = choice.prices;
  }
  if (!prices) return { amount: 0, currency: 'FCFA', isFallback: false };

  const direct = prices[CURRENT_CURRENCY];
  if (direct != null) return { amount: direct, currency: CURRENT_CURRENCY, isFallback: false };
  return { amount: prices.FCFA, currency: 'FCFA', isFallback: true };
}

function formatMoney(amount, currency) {
  const cur = currency || CURRENT_CURRENCY;
  const n = Number(amount || 0);
  const formatted = cur === 'FCFA'
    ? n.toLocaleString('fr-FR')
    : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return cur === 'FCFA' ? `${formatted} FCFA` : `${formatted} ${CURRENCY_SYMBOLS[cur] || cur}`;
}

/* formatPrice() est utilisé tel quel par cart.js/invoice.js (contrat
   conservé) : il formate désormais dans la devise actuellement choisie
   par le visiteur plutôt qu'en FCFA figé. */
function formatPrice(n) {
  return formatMoney(n, CURRENT_CURRENCY);
}
