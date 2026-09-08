/* ======================================================================
   Hadeej'Art Admin — Catégories
   Taxonomie fixe (6 catégories imposées par le cahier des charges) :
   l'admin peut seulement modifier les libellés traduits, pas en créer
   ou en supprimer. Les collections, elles, sont libres (voir collections.js).
   ====================================================================== */

async function renderCategories() {
  const el = document.getElementById('section-categories');
  el.innerHTML = `<h2>Catégories</h2><p class="subtitle">Liste fixe (Pantalons, Robes, Kimonos, Combinaisons, Sacs, Chaussures) — seuls les libellés sont modifiables.</p><div class="panel" id="catPanel">Chargement…</div>`;

  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) { document.getElementById('catPanel').innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  document.getElementById('catPanel').innerHTML = `
    <table>
      <thead><tr><th>Slug</th><th>FR</th><th>EN</th><th>WO</th><th></th></tr></thead>
      <tbody>${data.map(c => `
        <tr data-id="${c.id}">
          <td><code>${escapeHtml(c.slug)}</code></td>
          <td><input class="cat-fr" value="${escapeHtml(c.name_fr || '')}"></td>
          <td><input class="cat-en" value="${escapeHtml(c.name_en || '')}"></td>
          <td><input class="cat-wo" value="${escapeHtml(c.name_wo || '')}"></td>
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
        name_wo: tr.querySelector('.cat-wo').value.trim() || null
      };
      const { error } = await sb.from('categories').update(payload).eq('id', id);
      if (error) toast('Erreur: ' + error.message, true);
      else toast('Catégorie mise à jour.');
    });
  });
}
