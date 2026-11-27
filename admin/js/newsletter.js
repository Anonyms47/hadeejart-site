/* ======================================================================
   Hadeej'Art Admin — Carnet de Tissus (inscrits depuis le pied de page du site)
   Contacts e-mail ou WhatsApp : recherche, filtre, export CSV, contact direct.
   ====================================================================== */

async function renderNewsletter() {
  const el = document.getElementById('section-newsletter');
  el.innerHTML = `
    <div class="page-head"><div><h2>Carnet de Tissus</h2><p class="subtitle">Personnes qui ont demandé à être prévenues des nouveaux tissus et éditions limitées.</p></div></div>
    <div class="panel">
      <div class="panel-head">
        <h3 id="nlCount">Inscrits</h3>
        <div>
          <input id="nlSearch" type="search" placeholder="Rechercher" aria-label="Rechercher un inscrit">
          <select id="nlKind" aria-label="Type de contact">
            <option value="">E-mail et WhatsApp</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option>
          </select>
          <button class="btn ghost sm" id="nlCopy">Copier les e-mails</button>
          <button class="btn sm" id="nlExport">⬇ Exporter (CSV)</button>
        </div>
      </div>
      <div id="nlList"><span class="skel-lines"><i></i><i></i><i></i></span></div>
    </div>`;

  const { data, error } = await sb.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
  const host = document.getElementById('nlList');
  if (error) {
    host.innerHTML = /relation|does not exist|schema cache/i.test(error.message)
      ? '<p class="hint">Cette fonction nécessite la migration SQL <code>supabase/migrations/20261128_newsletter.sql</code> (table des inscrits). Appliquez-la dans Supabase, puis rechargez.</p>'
      : 'Erreur : ' + escapeHtml(error.message);
    ['nlSearch', 'nlKind', 'nlCopy', 'nlExport'].forEach(id => { const n = document.getElementById(id); if (n) n.disabled = true; });
    return;
  }
  let all = data || [];
  let view = all;

  function draw() {
    const term = document.getElementById('nlSearch').value;
    const kind = document.getElementById('nlKind').value;
    view = all.filter(s => (!kind || s.kind === kind) && matchesTerm(term, [s.contact, s.lang]));
    const mails = all.filter(s => s.kind === 'email').length;
    document.getElementById('nlCount').textContent = `${view.length} inscrit${view.length > 1 ? 's' : ''}` + (view.length !== all.length ? ` sur ${all.length}` : ` · ${mails} e-mail, ${all.length - mails} WhatsApp`);
    host.innerHTML = `<table><thead><tr><th>Contact</th><th>Type</th><th>Langue</th><th>Inscrit le</th><th></th></tr></thead><tbody>
      ${view.map(s => {
        const act = s.kind === 'email'
          ? `<a class="btn ghost sm" href="mailto:${escapeHtml(s.contact)}">Écrire</a>`
          : (waLink(s.contact) ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="${escapeHtml(waLink(s.contact, 'Bonjour ! Du nouveau chez Hadeej’Art 🧵'))}">WhatsApp</a>` : '');
        return `<tr><td>${escapeHtml(s.kind === 'whatsapp' ? '+' + s.contact : s.contact)}</td>
          <td><span class="badge ${s.kind === 'email' ? 'confirmed' : 'delivered'}">${s.kind === 'email' ? 'E-mail' : 'WhatsApp'}</span></td>
          <td>${escapeHtml((s.lang || '—').toUpperCase())}</td><td>${fmtDate(s.created_at)}</td>
          <td class="row-actions">${act} <button class="btn danger sm" data-del="${s.id}">Retirer</button></td></tr>`;
      }).join('') || `<tr><td colspan="5">${all.length ? 'Aucun résultat.' : 'Aucun inscrit pour le moment.'}</td></tr>`}</tbody></table>`;
    host.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const s = all.find(x => x.id === b.dataset.del);
      if (!s || !confirm('Retirer ce contact du Carnet de Tissus ?\n\n' + s.contact)) return;
      const { error: e } = await sb.from('newsletter_subscribers').delete().eq('id', s.id);
      if (e) { toast('Erreur : ' + e.message, true); return; }
      all = all.filter(x => x.id !== s.id); toast('Contact retiré.'); draw();
    }));
  }

  document.getElementById('nlSearch').addEventListener('input', debounce(draw, 200));
  document.getElementById('nlKind').addEventListener('change', draw);
  document.getElementById('nlExport').addEventListener('click', () => {
    downloadCsv(`carnet-de-tissus-${todayStamp()}.csv`, [['Type', 'Contact', 'Langue', 'Inscrit le']]
      .concat(view.map(s => [s.kind === 'email' ? 'E-mail' : 'WhatsApp', s.kind === 'whatsapp' ? '+' + s.contact : s.contact, s.lang || '', (s.created_at || '').slice(0, 10)])));
  });
  document.getElementById('nlCopy').addEventListener('click', async () => {
    const list = view.filter(s => s.kind === 'email').map(s => s.contact).join(', ');
    if (!list) { toast('Aucun e-mail dans la liste affichée.', true); return; }
    try { await navigator.clipboard.writeText(list); toast('E-mails copiés.'); } catch (e) { prompt('Copiez les e-mails :', list); }
  });
  draw();
}
