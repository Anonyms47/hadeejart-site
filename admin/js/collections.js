/* ======================================================================
   Hadeej'Art Admin — Collections (créées librement, produits multiples)
   ====================================================================== */

async function renderCollections() {
  const el = document.getElementById('section-collections');
  el.innerHTML = `<h2>Collections</h2><p class="subtitle">Créez autant de collections que nécessaire ; un produit peut appartenir à plusieurs collections.</p>
    <div class="panel">
      <div class="panel-head"><h3>Toutes les collections</h3><button class="btn sm" id="btnNewCollection">+ Nouvelle collection</button></div>
      <div id="collectionsList">Chargement…</div>
    </div>`;

  document.getElementById('btnNewCollection').addEventListener('click', () => openCollectionForm(null));
  await loadCollectionsList();
}

async function loadCollectionsList() {
  const { data, error } = await sb.from('collections')
    .select('*, product_collections(product_id)')
    .order('created_at', { ascending: false });
  const host = document.getElementById('collectionsList');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  host.innerHTML = `<table><thead><tr><th>Nom</th><th>Statut</th><th>Produits</th><th></th></tr></thead>
    <tbody>${data.map(c => `
      <tr>
        <td>${escapeHtml(c.name_fr)}</td>
        <td><span class="badge ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
        <td>${(c.product_collections || []).length}</td>
        <td class="row-actions">
          <button class="btn ghost sm" data-edit="${c.id}">Modifier</button>
          ${c.status !== 'archived' ? `<button class="btn ghost sm" data-archive="${c.id}">Archiver</button>` : ''}
          <button class="btn danger sm" data-delete="${c.id}">Supprimer</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="4">Aucune collection pour le moment.</td></tr>'}</tbody></table>`;

  host.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openCollectionForm(btn.dataset.edit)));
  host.querySelectorAll('[data-archive]').forEach(btn => btn.addEventListener('click', () => archiveCollection(btn.dataset.archive)));
  host.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteCollection(btn.dataset.delete)));
}

async function archiveCollection(id) {
  const { error } = await sb.from('collections').update({ status: 'archived' }).eq('id', id);
  if (error) toast('Erreur: ' + error.message, true);
  else { toast('Collection archivée (masquée du site, conservée).'); loadCollectionsList(); }
}

async function deleteCollection(id) {
  const { count, error: countErr } = await sb.from('product_collections').select('product_id', { count: 'exact', head: true }).eq('collection_id', id);
  if (countErr) { toast('Erreur: ' + countErr.message, true); return; }

  if (count > 0) {
    if (!confirm(`Cette collection contient encore ${count} produit(s). Préférez l’archiver plutôt que de la supprimer ?\n\nOK = archiver · Annuler = ne rien faire`)) return;
    await archiveCollection(id);
    return;
  }

  if (!confirm('Supprimer définitivement cette collection vide ?')) return;
  const { error } = await sb.from('collections').delete().eq('id', id);
  if (error) toast('Erreur: ' + error.message, true);
  else { toast('Collection supprimée.'); loadCollectionsList(); }
}

async function openCollectionForm(id) {
  let row = { name_fr: '', name_en: '', name_wo: '', description_fr: '', status: 'draft', cover_image_url: '' };
  let linkedIds = [];
  if (id) {
    const { data } = await sb.from('collections').select('*, product_collections(product_id)').eq('id', id).single();
    if (data) { row = data; linkedIds = (data.product_collections || []).map(pc => pc.product_id); }
  }
  const { data: allProducts } = await sb.from('products').select('id, slug, name_fr').order('name_fr');

  const overlay = openModal(`
    <header><h3>${id ? 'Modifier' : 'Nouvelle'} collection</h3><button class="icon-btn" id="closeCollModal">✕</button></header>
    <div class="body">
      <div class="field"><label>Nom (FR)</label><input id="colNameFr" value="${escapeHtml(row.name_fr)}"></div>
      <div class="grid-2">
        <div class="field"><label>Nom (EN)</label><input id="colNameEn" value="${escapeHtml(row.name_en || '')}"></div>
        <div class="field"><label>Nom (WO)</label><input id="colNameWo" value="${escapeHtml(row.name_wo || '')}"></div>
      </div>
      <div class="field"><label>Description (FR)</label><textarea id="colDesc" rows="3">${escapeHtml(row.description_fr || '')}</textarea></div>
      <div class="grid-2">
        <div class="field"><label>Statut</label>
          <select id="colStatus">
            <option value="draft" ${row.status === 'draft' ? 'selected' : ''}>Brouillon</option>
            <option value="published" ${row.status === 'published' ? 'selected' : ''}>Publiée</option>
            <option value="archived" ${row.status === 'archived' ? 'selected' : ''}>Archivée</option>
          </select>
        </div>
        <div class="field"><label>Image de couverture</label>
          <input type="file" id="colCoverFile" accept="image/*">
          ${row.cover_image_url ? `<img src="${escapeHtml(row.cover_image_url)}" class="thumb" style="margin-top:6px">` : ''}
        </div>
      </div>
      <div class="field"><label>Produits associés</label>
        <div id="colProductsList" style="max-height:200px;overflow:auto;border:1px solid #eee;border-radius:10px;padding:8px">
          ${(allProducts || []).map(p => `
            <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-weight:400">
              <input type="checkbox" value="${p.id}" ${linkedIds.includes(p.id) ? 'checked' : ''}> ${escapeHtml(p.name_fr)}
            </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="foot">
      <button class="btn ghost" id="cancelCollBtn">Annuler</button>
      <button class="btn" id="saveCollBtn">Enregistrer</button>
    </div>
  `);

  overlay.querySelector('#closeCollModal').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#cancelCollBtn').addEventListener('click', () => closeModal(overlay));

  overlay.querySelector('#saveCollBtn').addEventListener('click', async () => {
    const saveBtn = overlay.querySelector('#saveCollBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
    try {
      const nameFr = overlay.querySelector('#colNameFr').value.trim();
      if (!nameFr) { toast('Le nom (FR) est requis.', true); return; }

      let coverUrl = row.cover_image_url || null;
      const file = overlay.querySelector('#colCoverFile').files[0];
      if (file) coverUrl = await uploadProductImage(file, 'collections');

      const payload = {
        name_fr: nameFr,
        name_en: overlay.querySelector('#colNameEn').value.trim() || null,
        name_wo: overlay.querySelector('#colNameWo').value.trim() || null,
        description_fr: overlay.querySelector('#colDesc').value.trim() || null,
        status: overlay.querySelector('#colStatus').value,
        cover_image_url: coverUrl,
        slug: slugify(nameFr) + '-' + Date.now().toString(36).slice(-4)
      };
      if (id) delete payload.slug; /* on ne change pas le slug d'une collection existante */

      let collectionId = id;
      if (id) {
        const { error } = await sb.from('collections').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await sb.from('collections').insert(payload).select('id').single();
        if (error) throw error;
        collectionId = inserted.id;
      }

      const selectedIds = [...overlay.querySelectorAll('#colProductsList input:checked')].map(i => i.value);
      await sb.from('product_collections').delete().eq('collection_id', collectionId);
      if (selectedIds.length) {
        await sb.from('product_collections').insert(selectedIds.map(pid => ({ product_id: pid, collection_id: collectionId })));
      }

      toast('Collection enregistrée.');
      closeModal(overlay);
      loadCollectionsList();
    } catch (err) {
      toast('Erreur: ' + err.message, true);
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
    }
  });
}
