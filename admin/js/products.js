/* ======================================================================
   Hadeej'Art Admin — Produits (CRUD, images, variantes, catégories)
   ====================================================================== */

let PRODUCTS_CATEGORIES_CACHE = [];

async function uploadProductImage(file, folder) {
  const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!okTypes.includes(file.type)) throw new Error('Format d’image non supporté (jpg, png, webp, gif).');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo max).');

  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(file.name)}`;
  const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

async function renderProducts() {
  const el = document.getElementById('section-products');
  el.innerHTML = `<h2>Produits</h2><p class="subtitle">Catalogue administrable — visible côté public une fois publié.</p>
    <div class="panel">
      <div class="panel-head">
        <h3>Tous les produits</h3>
        <div style="display:flex;gap:8px">
          <select id="filterCategory"><option value="">Toutes catégories</option></select>
          <button class="btn sm" id="btnNewProduct">+ Nouveau produit</button>
        </div>
      </div>
      <div id="productsList">Chargement…</div>
    </div>`;

  const { data: cats } = await sb.from('categories').select('id, slug, name_fr').order('sort_order');
  PRODUCTS_CATEGORIES_CACHE = cats || [];
  document.getElementById('filterCategory').innerHTML += PRODUCTS_CATEGORIES_CACHE.map(c => `<option value="${c.id}">${escapeHtml(c.name_fr)}</option>`).join('');
  document.getElementById('filterCategory').addEventListener('change', loadProductsList);
  document.getElementById('btnNewProduct').addEventListener('click', () => openProductForm(null));

  await loadProductsList();
}

async function loadProductsList() {
  const catFilter = document.getElementById('filterCategory').value;
  let q = sb.from('products').select('*, categories(name_fr), product_images(image_url, is_primary, sort_order)').order('sort_order');
  if (catFilter) q = q.eq('category_id', catFilter);
  const { data, error } = await q;
  const host = document.getElementById('productsList');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  host.innerHTML = `<table><thead><tr><th></th><th>Nom</th><th>Catégorie</th><th>Prix FCFA</th><th>Statut</th><th></th></tr></thead>
    <tbody>${data.map(p => {
      const imgs = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const primary = imgs.find(i => i.is_primary) || imgs[0];
      return `
      <tr>
        <td>${primary ? `<img class="thumb" src="${escapeHtml(assetUrl(primary.image_url))}">` : ''}</td>
        <td>${escapeHtml(p.name_fr)}</td>
        <td>${p.categories ? escapeHtml(p.categories.name_fr) : '<em>—</em>'}</td>
        <td>${formatMoney(p.price_fcfa, 'FCFA')}</td>
        <td><span class="badge ${escapeHtml(p.status)}">${escapeHtml(p.status)}</span></td>
        <td class="row-actions">
          <button class="btn ghost sm" data-edit="${p.id}">Modifier</button>
          ${p.status !== 'archived' ? `<button class="btn ghost sm" data-archive="${p.id}">Archiver</button>` : ''}
          <button class="btn danger sm" data-delete="${p.id}">Supprimer</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Aucun produit.</td></tr>'}</tbody></table>`;

  host.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openProductForm(btn.dataset.edit)));
  host.querySelectorAll('[data-archive]').forEach(btn => btn.addEventListener('click', () => archiveProduct(btn.dataset.archive)));
  host.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
}

async function archiveProduct(id) {
  const { error } = await sb.from('products').update({ status: 'archived' }).eq('id', id);
  if (error) toast('Erreur: ' + error.message, true);
  else { toast('Produit archivé (masqué du site, historique conservé).'); loadProductsList(); }
}

/* Règle de suppression d'un produit :
   - présent dans une commande EN COURS (en attente, confirmée, expédiée) : impossible
     (on propose l'archivage) — la base de données l'interdit aussi ;
   - présent seulement dans des commandes TERMINÉES (livrées, annulées) : possible ;
     ces commandes restent enregistrées telles quelles (nom, taille, couleur, quantité,
     prix sont conservés dans chaque ligne de commande). */
const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'shipped'];
const FINISHED_ORDER_STATUSES = ['delivered', 'cancelled'];

async function countProductOrders(productId, statuses) {
  return sb.from('order_items')
    .select('id, orders!inner(status)', { count: 'exact', head: true })
    .eq('product_id', productId)
    .in('orders.status', statuses);
}

async function deleteProduct(id) {
  const active = await countProductOrders(id, ACTIVE_ORDER_STATUSES);
  if (active.error) { toast('Erreur: ' + active.error.message, true); return; }

  if (active.count > 0) {
    if (!confirm(`Ce produit figure dans ${active.count} commande(s) en cours (en attente, confirmée ou expédiée) : il ne peut pas être supprimé pour l’instant.

Vous pourrez le supprimer quand ces commandes seront livrées ou annulées.

L’archiver en attendant (masqué du site, conservé) ?`)) return;
    await archiveProduct(id);
    return;
  }

  const finished = await countProductOrders(id, FINISHED_ORDER_STATUSES);
  const done = finished.error ? 0 : (finished.count || 0);
  const msg = done > 0
    ? `Supprimer définitivement ce produit ?

Il figure dans ${done} commande(s) terminée(s) : elles restent enregistrées telles quelles (nom, taille, couleur, quantité et prix conservés).

Action irréversible.`
    : 'Supprimer définitivement ce produit ? (aucune commande ne le référence, action irréversible)';
  if (!confirm(msg)) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) toast('Erreur: ' + error.message, true);
  else { toast('Produit supprimé.'); loadProductsList(); }
}

function variantChoiceRowHtml(choice) {
  choice = choice || { value: '', label_fr: '', price_fcfa: '', price_eur: '', price_usd: '' };
  return `<div class="grid-2 variant-choice" style="border:1px solid #eee;border-radius:8px;padding:8px;margin-bottom:8px;position:relative">
    <div class="field"><label>Valeur (technique)</label><input class="vc-value" value="${escapeHtml(choice.value)}" placeholder="avec"></div>
    <div class="field"><label>Libellé (FR)</label><input class="vc-label" value="${escapeHtml(choice.label_fr)}" placeholder="Avec pantalon"></div>
    <div class="field"><label>Prix FCFA</label><input class="vc-fcfa" type="number" value="${choice.price_fcfa}"></div>
    <div class="field"><label>Prix EUR</label><input class="vc-eur" type="number" value="${choice.price_eur}"></div>
    <div class="field"><label>Prix USD</label><input class="vc-usd" type="number" value="${choice.price_usd}"></div>
    <button type="button" class="btn danger sm remove-choice" style="align-self:start">Retirer</button>
  </div>`;
}

async function openProductForm(id) {
  let row = {
    name_fr: '', name_en: '', name_wo: '', fabric_fr: '', fabric_en: '', fabric_wo: '',
    category_id: '', colors: [], sizes: ['S', 'M', 'L', 'XL', 'XXL'], gendered: false,
    price_fcfa: '', price_eur: '', price_usd: '', status: 'draft', variant_options: null
  };
  let images = [];
  if (id) {
    const { data } = await sb.from('products').select('*, product_images(id, image_url, is_primary, sort_order)').eq('id', id).single();
    if (data) { row = data; images = (data.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order); }
  }
  const allSizes = ['S', 'M', 'L', 'XL', 'XXL'];

  const overlay = openModal(`
    <header><h3>${id ? 'Modifier' : 'Nouveau'} produit</h3><button class="icon-btn" id="closeProdModal">✕</button></header>
    <div class="body">
      <div class="field"><label>Nom (FR) *</label><input id="pNameFr" value="${escapeHtml(row.name_fr)}"></div>
      <div class="grid-2">
        <div class="field"><label>Nom (EN)</label><input id="pNameEn" value="${escapeHtml(row.name_en || '')}"></div>
        <div class="field"><label>Nom (WO)</label><input id="pNameWo" value="${escapeHtml(row.name_wo || '')}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Catégorie</label>
          <select id="pCategory"><option value="">— Aucune —</option>
            ${PRODUCTS_CATEGORIES_CACHE.map(c => `<option value="${c.id}" ${row.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name_fr)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Statut</label>
          <select id="pStatus">
            <option value="draft" ${row.status === 'draft' ? 'selected' : ''}>Brouillon</option>
            <option value="published" ${row.status === 'published' ? 'selected' : ''}>Publié</option>
            <option value="archived" ${row.status === 'archived' ? 'selected' : ''}>Archivé</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Tissu (FR)</label><input id="pFabricFr" value="${escapeHtml(row.fabric_fr || '')}" placeholder="Wax"></div>
        <div class="field"><label>Couleurs suggérées (séparées par virgule)</label><input id="pColors" value="${escapeHtml((row.colors || []).join(', '))}" placeholder="Orange, Bleu"></div>
      </div>
      <div class="field"><label>Tailles disponibles</label>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          ${allSizes.map(s => `<label style="font-weight:400"><input type="checkbox" class="p-size" value="${s}" ${(row.sizes || []).includes(s) ? 'checked' : ''}> ${s}</label>`).join('')}
        </div>
      </div>
      <div class="field"><label style="font-weight:400"><input type="checkbox" id="pGendered" ${row.gendered ? 'checked' : ''}> Produit genré (Homme/Femme déjà dans le nom)</label></div>

      <div class="grid-2">
        <div class="field"><label>Prix FCFA *</label><input id="pPriceFcfa" type="number" value="${row.price_fcfa}"></div>
        <div class="field"><label>Prix EUR</label><input id="pPriceEur" type="number" value="${row.price_eur ?? ''}"></div>
      </div>
      <div class="field" style="max-width:calc(50% - 7px)"><label>Prix USD</label><input id="pPriceUsd" type="number" value="${row.price_usd ?? ''}"></div>

      <div class="field">
        <label style="font-weight:400"><input type="checkbox" id="pHasVariant" ${row.variant_options ? 'checked' : ''}> Ce produit a une option avec prix différents (ex: avec/sans pantalon)</label>
        <div id="variantBox" style="${row.variant_options ? '' : 'display:none'};margin-top:8px">
          <div class="field"><label>Libellé de l’option (FR)</label><input id="voLabel" value="${escapeHtml(row.variant_options?.label_fr || 'Option')}"></div>
          <div id="voChoices">${(row.variant_options?.choices || [{}, {}]).map(variantChoiceRowHtml).join('')}</div>
          <button type="button" class="btn ghost sm" id="addChoiceBtn">+ Ajouter un choix</button>
        </div>
      </div>

      <div class="field"><label>Images</label>
        <input type="file" id="pImageFiles" accept="image/*" multiple>
        <div class="image-grid" id="pImageGrid">
          ${images.map(img => `<div class="img-item" data-id="${img.id}"><img src="${escapeHtml(assetUrl(img.image_url))}"><button type="button" class="rm-img" data-id="${img.id}">✕</button></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="foot">
      <button class="btn ghost" id="cancelProdBtn">Annuler</button>
      <button class="btn" id="saveProdBtn">Enregistrer</button>
    </div>
  `);

  overlay.querySelector('#closeProdModal').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#cancelProdBtn').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#pHasVariant').addEventListener('change', e => {
    overlay.querySelector('#variantBox').style.display = e.target.checked ? '' : 'none';
  });
  overlay.querySelector('#addChoiceBtn').addEventListener('click', () => {
    overlay.querySelector('#voChoices').insertAdjacentHTML('beforeend', variantChoiceRowHtml());
    bindChoiceRemovers(overlay);
  });
  bindChoiceRemovers(overlay);

  overlay.querySelectorAll('.rm-img').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Retirer cette image ?')) return;
    await sb.from('product_images').delete().eq('id', btn.dataset.id);
    btn.closest('.img-item').remove();
  }));

  overlay.querySelector('#saveProdBtn').addEventListener('click', async () => {
    const saveBtn = overlay.querySelector('#saveProdBtn');
    saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement…';
    try {
      const nameFr = overlay.querySelector('#pNameFr').value.trim();
      const priceFcfa = parseFloat(overlay.querySelector('#pPriceFcfa').value);
      if (!nameFr) throw new Error('Le nom (FR) est requis.');
      if (!priceFcfa && priceFcfa !== 0) throw new Error('Le prix FCFA est requis.');

      const sizes = [...overlay.querySelectorAll('.p-size:checked')].map(c => c.value);
      const colors = overlay.querySelector('#pColors').value.split(',').map(s => s.trim()).filter(Boolean);

      let variantOptions = null;
      if (overlay.querySelector('#pHasVariant').checked) {
        const choices = [...overlay.querySelectorAll('.variant-choice')].map(row => ({
          value: row.querySelector('.vc-value').value.trim(),
          label_fr: row.querySelector('.vc-label').value.trim(),
          price_fcfa: parseFloat(row.querySelector('.vc-fcfa').value) || null,
          price_eur: parseFloat(row.querySelector('.vc-eur').value) || null,
          price_usd: parseFloat(row.querySelector('.vc-usd').value) || null
        })).filter(c => c.value);
        if (choices.length) {
          variantOptions = { id: 'optionKimono', label_fr: overlay.querySelector('#voLabel').value.trim() || 'Option', choices };
        }
      }

      const payload = {
        name_fr: nameFr,
        name_en: overlay.querySelector('#pNameEn').value.trim() || null,
        name_wo: overlay.querySelector('#pNameWo').value.trim() || null,
        fabric_fr: overlay.querySelector('#pFabricFr').value.trim() || null,
        category_id: overlay.querySelector('#pCategory').value || null,
        status: overlay.querySelector('#pStatus').value,
        colors, sizes,
        gendered: overlay.querySelector('#pGendered').checked,
        price_fcfa: priceFcfa,
        price_eur: overlay.querySelector('#pPriceEur').value ? parseFloat(overlay.querySelector('#pPriceEur').value) : null,
        price_usd: overlay.querySelector('#pPriceUsd').value ? parseFloat(overlay.querySelector('#pPriceUsd').value) : null,
        variant_options: variantOptions,
        updated_at: new Date().toISOString()
      };

      let productId = id;
      if (id) {
        const { error } = await sb.from('products').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        payload.slug = slugify(nameFr) + '-' + Date.now().toString(36).slice(-5);
        const { data: inserted, error } = await sb.from('products').insert(payload).select('id').single();
        if (error) throw error;
        productId = inserted.id;
      }

      const files = overlay.querySelector('#pImageFiles').files;
      if (files && files.length) {
        const { data: existingImgs } = await sb.from('product_images').select('id').eq('product_id', productId);
        let sortBase = (existingImgs || []).length;
        for (const file of files) {
          const url = await uploadProductImage(file, `products/${productId}`);
          await sb.from('product_images').insert({
            product_id: productId, image_url: url, sort_order: sortBase++,
            is_primary: sortBase === 1, alt_fr: nameFr
          });
        }
      }

      toast('Produit enregistré.');
      closeModal(overlay);
      loadProductsList();
    } catch (err) {
      toast('Erreur: ' + err.message, true);
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer';
    }
  });
}

function bindChoiceRemovers(overlay) {
  overlay.querySelectorAll('.remove-choice').forEach(btn => {
    btn.onclick = () => btn.closest('.variant-choice').remove();
  });
}
