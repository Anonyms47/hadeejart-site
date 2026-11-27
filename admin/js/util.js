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

/* Lien WhatsApp « click to chat » : chiffres uniquement, message pré-rempli */
function waLink(phone, message) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length < 8) return '';
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
