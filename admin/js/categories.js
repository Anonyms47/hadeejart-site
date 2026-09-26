/* ======================================================================
   Hadeej'Art Admin — Catégories
   Catégories : l'admin modifie les libellés traduits et peut MASQUER une
   catégorie (« bientôt disponible ») ; il n'en crée ni n'en supprime. Les collections, elles, sont libres (voir collections.js).
   ====================================================================== */

async function renderCategories() {
  const el = document.getElementById('section-categories');
  el.innerHTML = `<h2>Catégories</h2><p class="subtitle">Modifiez les libellés, ou décochez « Visible » pour masquer une catégorie du site : elle est alors annoncée comme « bientôt disponible ».</p><div class="panel" id="catPanel">Chargement…</div>`;

  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) { document.getElementById('catPanel').innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  document.getElementById('catPanel').innerHTML = `
    <table>
      <thead><tr><th>Slug</th><th>FR</th><th>EN</th><th>WO</th><th>Visible sur le site</th><th></th></tr></thead>
      <tbody>${data.map(c => `
        <tr data-id="${c.id}">
          <td><code>${escapeHtml(c.slug)}</code></td>
          <td><input class="cat-fr" value="${escapeHtml(c.name_fr || '')}"></td>
          <td><input class="cat-en" value="${escapeHtml(c.name_en || '')}"></td>
          <td><input class="cat-wo" value="${escapeHtml(c.name_wo || '')}"></td>
          <td><label class="cat-visible"><input type="checkbox" class="cat-active" ${c.active === false ? '' : 'checked'}> Visible</label></td>
          <td><button class="btn sm cat-save">Enregistrer</button></td>
        </tr>`).join('')}</tbody>
    </table>`;

  document.querySelectorAll('.cat-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const id = tr.dataset.id;
      const payload = {
        name_fr: tr.querySelector('.cat-fr').value.trim(),
        name_en: tr.querySelector('.cat-en').value.trim() || null,
        name_wo: tr.querySelector('.cat-wo').value.trim() || null,
        active: tr.querySelector('.cat-active').checked
      };
      const { error } = await sb.from('categories').update(payload).eq('id', id);
      if (error) toast('Erreur: ' + error.message, true);
      else toast('Catégorie mise à jour.');
    });
  });
}
