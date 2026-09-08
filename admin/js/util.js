/* ======================================================================
   Hadeej'Art Admin — Utilitaires partagés
   ====================================================================== */

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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
  try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return iso; }
}
