/* ======================================================================
   Hadeej'Art Admin — Utilitaires partagés
   ====================================================================== */

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* Les images du site public sont enregistrées avec un chemin relatif à la racine
   (ex. « images/pantalon.jpg ») : depuis /admin/, il faut remonter d'un niveau.
   Les URL absolues (Supabase Storage, https://…) restent inchangées. */
function assetUrl(u) {
  const s = String(u || '');
  return /^(https?:|data:|blob:|\/)/i.test(s) ? s : '../' + s;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatMoney(n, cur) {
  const num = Number(n || 0);
  if (cur === 'FCFA' || !cur) return num.toLocaleString('fr-FR') + ' FCFA';
  const symbol = cur === 'EUR' ? '€' : (cur === 'USD' ? '$' : cur);
  return num.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + symbol;
}

function toast(message, isError) {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal(overlay) {
  if (overlay && overlay.remove) overlay.remove();
}

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
  catch (e) { return iso; }
}

/* ---------- Confort admin : exports, WhatsApp, recherche, fenêtres ---------- */

/* Export CSV compatible Excel (BOM UTF-8, séparateur « ; », cellules protégées
   contre l'injection de formule). rows = tableau de tableaux. */
function downloadCsv(filename, rows) {
  const cell = v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* Indicatifs téléphoniques par pays (noms en français, sans accents, minuscules). */
const DIAL_CODES = { senegal: '221', mali: '223', "cote d'ivoire": '225', guinee: '224', mauritanie: '222', gambie: '220', 'burkina faso': '226',
  benin: '229', togo: '228', niger: '227', cameroun: '237', gabon: '241', congo: '242', 'guinee-bissau': '245', maroc: '212', algerie: '213', tunisie: '216',
  france: '33', belgique: '32', suisse: '41', luxembourg: '352', allemagne: '49', italie: '39', espagne: '34', portugal: '351', 'pays-bas': '31',
  'royaume-uni': '44', irlande: '353', 'etats-unis': '1', usa: '1', canada: '1', bresil: '55', chine: '86', japon: '81', 'arabie saoudite': '966',
  'emirats arabes unis': '971', qatar: '974', turquie: '90' };
function _plain(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/* Numéro -> chiffres au format international pour wa.me, ou '' si on ne peut pas
   le déterminer sans risque (mieux vaut aucun lien qu'un lien vers un inconnu).
   - « + » ou « 00 » : déjà international ;
   - sinon, l'indicatif du pays de la commande (zéro de tête retiré) ;
   - sinon, 9 chiffres commençant par 7 = numéro sénégalais (marché de la boutique). */
function intlPhone(raw, country) {
  const txt = String(raw || '').replace(/[\u0660-\u0669]/g, c => c.charCodeAt(0) - 0x0660).replace(/[\u06F0-\u06F9]/g, c => c.charCodeAt(0) - 0x06F0).replace(/[\uFF10-\uFF19]/g, c => c.charCodeAt(0) - 0xFF10).trim();
  let d = txt.replace(/\D/g, '');
  if (!d) return '';
  if (/^\+/.test(txt)) return d.length >= 8 && d.length <= 15 ? d : '';
  if (/^00/.test(d)) { d = d.slice(2); return d.length >= 8 && d.length <= 15 ? d : ''; }
  const dial = DIAL_CODES[_plain(country)];
  if (dial) {
    if (d.startsWith(dial) && d.length >= dial.length + 7) return d;
    d = d.replace(/^0+/, '');
    return d.length >= 6 && (dial.length + d.length) <= 15 ? dial + d : '';
  }
  if (d.length === 9 && d[0] === '7') return '221' + d;
  if (d.length === 12 && d.startsWith('221')) return d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}

/* Lien WhatsApp « click to chat » : numéro international, message pré-rempli */
function waLink(phone, message, country) {
  const d = intlPhone(phone, country);
  if (!d) return '';
  return 'https://wa.me/' + d + (message ? '?text=' + encodeURIComponent(message) : '');
}

function debounce(fn, ms) {
  let t = null;
  return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms || 250); };
}

function todayStamp() { return new Date().toISOString().slice(0, 10); }

function fmtDateTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return iso; }
}

/* Échap ferme la fenêtre ouverte (la plus récente) */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelectorAll('.modal-overlay');
  if (open.length) open[open.length - 1].remove();
});

/* Barre de recherche + compteur réutilisables : retourne une fonction de filtre */
function matchesTerm(term, values) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return true;
  return values.some(v => String(v == null ? '' : v).toLowerCase().includes(t));
}
