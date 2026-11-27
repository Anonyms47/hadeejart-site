/* ======================================================================
   Hadeej'Art Admin — Produits (CRUD, images, variantes, catégories)
   ====================================================================== */

let PRODUCTS_CATEGORIES_CACHE = [];
let PRODUCTS_VIEW = (() => { try { return localStorage.getItem('ha_admin_pview') || 'cards'; } catch (e) { return 'cards'; } })();
const PRODUCT_STATUS_LABELS = { published: 'Publié', draft: 'Brouillon', archived: 'Archivé' };

/* Redimensionne et compresse une photo avant l'envoi : les photos de téléphone
   pèsent 3 à 10 Mo et 4000 px de large, ce qui ralentirait le site pour tous
   les visiteurs. On garde 1800 px maximum (largement net sur un écran de
   téléphone ou d'ordinateur) en JPEG qualité 86 — en général 200 à 500 Ko.
   Les images déjà légères et les GIF sont envoyés tels quels. */
const IMAGE_MAX_SIDE = 1800;
const IMAGE_SKIP_UNDER = 700 * 1024;

async function prepareImage(file) {
  if (file.type === 'image/gif') return file;
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch (e) { return file; }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= IMAGE_MAX_SIDE && file.size <= IMAGE_SKIP_UNDER) { bitmap.close && bitmap.close(); return file; }
  const scale = Math.min(1, IMAGE_MAX_SIDE / longest);
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';           /* fond blanc : le JPEG n'a pas de transparence */
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close && bitmap.close();
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.86));
  if (!blob || blob.size >= file.size) return file;   /* pas de gain : on garde l'original */
  const base = String(file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], base + '.jpg', { type: 'image/jpeg' });
}

async function uploadProductImage(originalFile, folder) {
  const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!okTypes.includes(originalFile.type)) throw new Error('Format d’image non supporté (jpg, png, webp, gif).');
  if (originalFile.size > 25 * 1024 * 1024) throw new Error('Image trop lourde (25 Mo max avant compression).');

  const file = await prepareImage(originalFile);
  if (file.size > 5 * 1024 * 1024) throw new Error('Image encore trop lourde après compression (5 Mo max).');

  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const base = slugify(String(file.name || 'photo').replace(/\.[^.]+$/, '')) || 'photo';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${ext}`;
  const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '31536000' });
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
        <div class="toolbar">
          <div class="view-toggle" role="group" aria-label="Affichage"><button type="button" id="viewCards" aria-label="Cartes" title="Cartes">▦</button><button type="button" id="viewList" aria-label="Liste" title="Liste">☰</button></div>
          <input id="filterProductSearch" type="search" placeholder="Rechercher un produit" aria-label="Rechercher un produit">
          <select id="filterProductStatus" aria-label="Filtrer par statut"><option value="">Tous statuts</option><option value="published">Publiés</option><option value="draft">Brouillons</option><option value="archived">Archivés</option></select>
          <select id="filterCategory"><option value="">Toutes catégories</option></select>
          <button class="btn sm" id="btnNewProduct">+ Nouveau produit</button>
        </div>
      </div>
      <div id="productsList"><span class="skel-lines"><i></i><i></i><i></i></span></div>
    </div>`;

  const { data: cats } = await sb.from('categories').select('id, slug, name_fr').order('sort_order');
  PRODUCTS_CATEGORIES_CACHE = cats || [];
  document.getElementById('filterCategory').innerHTML += PRODUCTS_CATEGORIES_CACHE.map(c => `<option value="${c.id}">${escapeHtml(c.name_fr)}</option>`).join('');
  document.getElementById('filterCategory').addEventListener('change', loadProductsList);
  document.getElementById('filterProductStatus').addEventListener('change', loadProductsList);
  const setView = v => { PRODUCTS_VIEW = v; try { localStorage.setItem('ha_admin_pview', v); } catch (e) {} loadProductsList(); };
  document.getElementById('viewCards').addEventListener('click', () => setView('cards'));
  document.getElementById('viewList').addEventListener('click', () => setView('list'));
  document.getElementById('filterProductSearch').addEventListener('input', debounce(loadProductsList, 200));
  document.getElementById('btnNewProduct').addEventListener('click', () => openProductForm(null));

  await loadProductsList();
}

async function loadProductsList() {
  const catFilter = document.getElementById('filterCategory').value;
  let q = sb.from('products').select('*, categories(name_fr), product_images(image_url, is_primary, sort_order)').order('sort_order');
  if (catFilter) q = q.eq('category_id', catFilter);
  let { data, error } = await q;
  const host = document.getElementById('productsList');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }
  const stFilter = document.getElementById('filterProductStatus').value;
  const term = document.getElementById('filterProductSearch').value;
  data = data.filter(p => (!stFilter || p.status === stFilter) && matchesTerm(term, [p.name_fr, p.name_en, p.slug]));

  document.getElementById('viewCards').classList.toggle('on', PRODUCTS_VIEW === 'cards');
  document.getElementById('viewList').classList.toggle('on', PRODUCTS_VIEW !== 'cards');
  if (!data.length) {
    host.innerHTML = '<div class="empty"><span class="big">🧺</span><b>Aucun produit</b><p>Aucun résultat pour ces filtres.</p></div>';
  } else if (PRODUCTS_VIEW === 'cards') {
    host.innerHTML = `<div class="prod-grid">${data.map((p, i) => {
      const imgs = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order);
      const primary = imgs.find(x => x.is_primary) || imgs[0];
      return `<article class="prod-card" style="animation-delay:${Math.min(i, 14) * 35}ms">
        <div class="prod-img">${primary ? `<img loading="lazy" alt="" src="${escapeHtml(assetUrl(primary.image_url))}">` : '🧵'}<span class="badge ${escapeHtml(p.status)}">${escapeHtml(PRODUCT_STATUS_LABELS[p.status] || p.status)}</span></div>
        <div class="prod-body"><b>${escapeHtml(p.name_fr)}</b><small>${p.categories ? escapeHtml(p.categories.name_fr) : '—'}</small><span class="prod-price">${formatMoney(p.price_fcfa, 'FCFA')}</span>
          <div class="prod-actions">
            ${p.status === 'draft' ? `<button class="btn" data-publish="${p.id}">Publier</button>` : (p.status === 'published' ? `<button class="btn ghost" data-unpublish="${p.id}">Dépublier</button>` : '')}
            <button class="btn ghost" data-edit="${p.id}">Modifier</button>
          </div>
          <div class="prod-more">
            <button type="button" data-preview="${p.id}">Aperçu</button>
            <button type="button" data-dup="${p.id}">Dupliquer</button>
            ${p.status !== 'archived' ? `<button type="button" data-archive="${p.id}">Archiver</button>` : ''}
            <button type="button" class="del" data-delete="${p.id}">Supprimer</button>
          </div></div></article>`; }).join('')}</div>`;
  } else
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
        <td><span class="badge ${escapeHtml(p.status)}">${escapeHtml(PRODUCT_STATUS_LABELS[p.status] || p.status)}</span></td>
        <td class="row-actions">
          ${p.status === 'draft' ? `<button class="btn sm" data-publish="${p.id}">Publier</button>` : (p.status === 'published' ? `<button class="btn ghost sm" data-unpublish="${p.id}">Dépublier</button>` : '')}
          <button class="btn ghost sm" data-edit="${p.id}">Modifier</button>
          <button class="btn ghost sm" data-preview="${p.id}">Aperçu</button>
          <button class="btn ghost sm" data-dup="${p.id}">Dupliquer</button>
          ${p.status !== 'archived' ? `<button class="btn ghost sm" data-archive="${p.id}">Archiver</button>` : ''}
          <button class="btn danger sm" data-delete="${p.id}">Supprimer</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Aucun produit.</td></tr>'}</tbody></table>`;

  const setStatus = (attr, status, msg) => host.querySelectorAll('[' + attr + ']').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    const { error: e } = await sb.from('products').update({ status }).eq('id', btn.getAttribute(attr));
    if (e) { toast('Erreur: ' + e.message, true); btn.disabled = false; return; }
    toast(msg); loadProductsList();
  }));
  setStatus('data-publish', 'published', 'Produit publié : visible sur le site.');
  setStatus('data-unpublish', 'draft', 'Produit repassé en brouillon.');
  host.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openProductForm(btn.dataset.edit)));
  host.querySelectorAll('[data-preview]').forEach(btn => btn.addEventListener('click', () => previewProduct(btn.dataset.preview)));
  host.querySelectorAll('[data-dup]').forEach(btn => btn.addEventListener('click', () => duplicateProduct(btn.dataset.dup)));
  host.querySelectorAll('[data-archive]').forEach(btn => btn.addEventListener('click', () => archiveProduct(btn.dataset.archive)));
  host.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
}

/* Duplique un produit en BROUILLON (photos et collections reliées, aucun
   fichier recopié : les photos pointent vers les mêmes originaux). */
async function duplicateProduct(id) {
  if (!confirm('Dupliquer ce produit ? La copie sera créée en brouillon.')) return;
  const { data: src, error } = await sb.from('products').select('*, product_images(image_url, is_primary, sort_order, alt_fr), product_collections(collection_id)').eq('id', id).single();
  if (error || !src) { toast('Erreur: ' + ((error && error.message) || 'produit introuvable'), true); return; }
  const copy = Object.assign({}, src);
  ['id', 'created_at', 'updated_at', 'product_images', 'product_collections'].forEach(k => delete copy[k]);
  copy.name_fr = src.name_fr + ' (copie)'; copy.name_en = src.name_en ? src.name_en + ' (copy)' : null; copy.name_wo = src.name_wo ? src.name_wo + ' (copie)' : null;
  copy.slug = slugify(src.name_fr) + '-' + Date.now().toString(36).slice(-5);
  copy.status = 'draft';
  const { data: ins, error: e2 } = await sb.from('products').insert(copy).select('id').single();
  if (e2) { toast('Erreur: ' + e2.message, true); return; }
  if ((src.product_images || []).length) await sb.from('product_images').insert(src.product_images.map(i => ({ product_id: ins.id, image_url: i.image_url, is_primary: i.is_primary, sort_order: i.sort_order, alt_fr: i.alt_fr })));
  if ((src.product_collections || []).length) await sb.from('product_collections').insert(src.product_collections.map(c => ({ product_id: ins.id, collection_id: c.collection_id })));
  toast('Copie créée en brouillon.'); loadProductsList();
}

/* Aperçu approximatif de la fiche publique, y compris pour un brouillon. */
async function previewProduct(id) {
  const { data: p } = await sb.from('products').select('*, product_images(image_url, is_primary, sort_order)').eq('id', id).single();
  if (!p) return;
  const imgs = (p.product_images || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const sec = (label, v) => v ? `<details open><summary><b>${label}</b></summary><p style="white-space:pre-wrap;margin:6px 0 12px">${escapeHtml(v)}</p></details>` : '';
  const overlay = openModal(`
    <header><h3>Aperçu — ${escapeHtml(p.name_fr)}</h3><button class="icon-btn" id="closePrev">✕</button></header>
    <div class="body">
      <p class="hint">Aperçu simplifié de la fiche publique (statut : <b>${escapeHtml(p.status)}</b>${p.status !== 'published' ? ' — invisible sur le site tant qu’il n’est pas publié' : ''}).</p>
      ${imgs.length ? `<div style="display:flex;gap:8px;overflow:auto;margin-bottom:12px">${imgs.map(i => `<img src="${escapeHtml(assetUrl(i.image_url))}" style="height:220px;border-radius:12px">`).join('')}</div>` : '<p><em>Aucune photo</em></p>'}
      <p style="font-size:22px;font-weight:800;margin:0 0 8px">${formatMoney(p.price_fcfa, 'FCFA')}</p>
      <p>${p.sold_out ? '<b style="color:#a3261a">Indisponible</b>' : (p.fulfillment === 'in_stock' ? 'En stock' : p.fulfillment === 'made_to_order' ? 'Confection sur commande' : 'Disponible')}</p>
      <p><b>Tailles :</b> ${(p.sizes || []).map(sz => (p.unavailable_sizes || []).includes(sz) ? `<s>${sz}</s>` : sz).join(' · ') || '—'}</p>
      ${p.colors && p.colors.length ? `<p><b>Couleurs :</b> ${p.colors.map(escapeHtml).join(', ')}</p>` : ''}
      ${p.fabric_fr ? `<p><b>Tissu :</b> ${escapeHtml(p.fabric_fr)}</p>` : ''}
      ${sec('Description', p.description_fr)}${sec('Contenu de l’ensemble', p.contents_fr)}${sec('Coupe', p.cut_fr)}${sec('Mesures', p.measures_text)}${sec('Entretien', p.care_fr)}${sec('Délai', p.lead_time_fr)}
    </div>
    <div class="foot"><button class="btn ghost" id="closePrev2">Fermer</button></div>`);
  overlay.querySelector('#closePrev').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#closePrev2').addEventListener('click', () => closeModal(overlay));
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
      <details class="translations">
        <summary>Traductions anglais et wolof <small>(automatiques)</small></summary>
        <p class="hint">Écrivez seulement en français : l’anglais et le wolof sont créés tout seuls à l’enregistrement. Corrigez-les ici si besoin, votre correction est alors conservée.</p>
        <div class="grid-2">
          <div class="field"><label>Nom (EN)</label><input id="pNameEn" value="${escapeHtml(row.name_en || '')}" placeholder="Automatique"></div>
          <div class="field"><label>Nom (WO)</label><input id="pNameWo" value="${escapeHtml(row.name_wo || '')}" placeholder="Automatique"></div>
        </div>
      </details>
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

      <div class="field"><label>Tailles temporairement indisponibles</label>
        <p class="hint">Cochées : la taille est affichée barrée et ne peut pas être commandée (le serveur la refuse aussi).</p>
        <div style="display:flex;gap:14px;flex-wrap:wrap">
          ${allSizes.map(sz => `<label style="font-weight:400"><input type="checkbox" class="p-unavail" value="${sz}" ${(row.unavailable_sizes || []).includes(sz) ? 'checked' : ''}> ${sz}</label>`).join('')}
        </div>
      </div>
      <div class="field"><label style="font-weight:400"><input type="checkbox" id="pSoldOut" ${row.sold_out ? 'checked' : ''}> Produit indisponible (affiché « Indisponible », non commandable)</label></div>

      <details class="translations" ${row.description_fr || row.contents_fr || row.care_fr || row.lead_time_fr || row.cut_fr || row.measures_text || row.fulfillment ? 'open' : ''}>
        <summary>Fiche produit détaillée <small>(facultatif — les sections vides sont masquées sur le site)</small></summary>
        <p class="hint">Ne renseignez que ce que vous savez : rien n’est inventé ni affiché par défaut. Le texte français est traduit automatiquement en anglais et wolof à l’enregistrement.</p>
        <div class="field"><label>Disponibilité</label>
          <select id="pFulfillment">
            <option value="">— Non précisé —</option>
            <option value="in_stock" ${row.fulfillment === 'in_stock' ? 'selected' : ''}>En stock</option>
            <option value="made_to_order" ${row.fulfillment === 'made_to_order' ? 'selected' : ''}>Confection sur commande</option>
          </select></div>
        <div class="field"><label>Description</label><textarea id="pDescFr" rows="3">${escapeHtml(row.description_fr || '')}</textarea></div>
        <div class="field"><label>Contenu de l’ensemble</label><textarea id="pContentsFr" rows="2" placeholder="ex : chemise + pantalon">${escapeHtml(row.contents_fr || '')}</textarea></div>
        <div class="grid-2">
          <div class="field"><label>Coupe</label><input id="pCutFr" value="${escapeHtml(row.cut_fr || '')}"></div>
          <div class="field"><label>Délai (texte libre)</label><input id="pLeadFr" value="${escapeHtml(row.lead_time_fr || '')}" placeholder="ex : à confirmer sur WhatsApp"></div>
        </div>
        <div class="field"><label>Mesures</label><textarea id="pMeasures" rows="2">${escapeHtml(row.measures_text || '')}</textarea></div>
        <div class="field"><label>Entretien</label><textarea id="pCareFr" rows="2">${escapeHtml(row.care_fr || '')}</textarea></div>
      </details>

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
        <p class="hint">Plusieurs photos possibles. Glissez une vignette pour changer l’ordre · l’étoile ★ marque la photo principale (affichée en premier sur le site).</p>
        <div class="image-grid" id="pImageGrid">
          ${images.map(img => `<div class="img-item" draggable="true" data-id="${img.id}">
            <img src="${escapeHtml(assetUrl(img.image_url))}">
            <button type="button" class="img-star${img.is_primary ? ' active' : ''}" data-id="${img.id}" title="Définir comme photo principale">★</button>
            <button type="button" class="rm-img" data-id="${img.id}" title="Retirer">✕</button>
          </div>`).join('')}
        </div>
        <label class="btn ghost sm" for="pImageFiles" style="display:inline-block;margin-top:10px;cursor:pointer">+ Ajouter des photos</label>
        <input type="file" id="pImageFiles" accept="image/*" multiple style="display:none">
        <div class="image-grid" id="pImageGridNew"></div>
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

  /* Étoile : marque une image existante comme principale (une seule à la fois). */
  overlay.querySelectorAll('.img-star').forEach(btn => btn.addEventListener('click', async () => {
    const grid = overlay.querySelector('#pImageGrid');
    await sb.from('product_images').update({ is_primary: false }).eq('product_id', id);
    await sb.from('product_images').update({ is_primary: true }).eq('id', btn.dataset.id);
    grid.querySelectorAll('.img-star').forEach(b => b.classList.toggle('active', b === btn));
    toast('Photo principale mise à jour.');
  }));

  /* Réordonner par glisser-déposer : l'ordre visuel devient sort_order au survol/dépôt. */
  bindImageDragReorder(overlay.querySelector('#pImageGrid'));

  /* Photos à ajouter : sélectionnées maintenant, envoyées à l'enregistrement.
     On garde notre propre liste (plutôt que input.files) pour permettre de
     retirer un fichier de la sélection avant l'envoi. */
  let pendingFiles = [];
  const newGrid = overlay.querySelector('#pImageGridNew');
  function renderPendingPreviews() {
    newGrid.innerHTML = pendingFiles.map((f, i) => `<div class="img-item pending" data-i="${i}">
      <img src="${URL.createObjectURL(f)}"><button type="button" class="rm-img" data-i="${i}" title="Retirer">✕</button>
    </div>`).join('');
    newGrid.querySelectorAll('.rm-img').forEach(btn => btn.addEventListener('click', () => {
      pendingFiles.splice(+btn.dataset.i, 1);
      renderPendingPreviews();
    }));
  }
  overlay.querySelector('#pImageFiles').addEventListener('change', e => {
    pendingFiles = pendingFiles.concat([...e.target.files]);
    renderPendingPreviews();
    e.target.value = '';
  });

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
        const oldVo = row.variant_options || {};
        const oldChoices = (oldVo.choices || []);
        const choices = await Promise.all([...overlay.querySelectorAll('.variant-choice')].map(async r => {
          const value = r.querySelector('.vc-value').value.trim();
          const labelFr = r.querySelector('.vc-label').value.trim();
          const old = oldChoices.find(c => c.value === value) || {};
          return {
            value,
            label_fr: labelFr,
            label_en: await resolveTranslation(labelFr, 'en', old.label_en, old.label_fr, old.label_en),
            label_wo: await resolveTranslation(labelFr, 'wo', old.label_wo, old.label_fr, old.label_wo),
            price_fcfa: parseFloat(r.querySelector('.vc-fcfa').value) || null,
            price_eur: parseFloat(r.querySelector('.vc-eur').value) || null,
            price_usd: parseFloat(r.querySelector('.vc-usd').value) || null
          };
        }));
        const valid = choices.filter(c => c.value);
        if (valid.length) {
          const voFr = overlay.querySelector('#voLabel').value.trim() || 'Option';
          variantOptions = {
            id: 'optionKimono', label_fr: voFr,
            label_en: await resolveTranslation(voFr, 'en', oldVo.label_en, oldVo.label_fr, oldVo.label_en),
            label_wo: await resolveTranslation(voFr, 'wo', oldVo.label_wo, oldVo.label_fr, oldVo.label_wo),
            choices: valid
          };
        }
      }

      /* Traductions automatiques (voir js/translate.js) */
      const fabricFr = overlay.querySelector('#pFabricFr').value.trim();
      const [nameEn, nameWo, fabricEn, fabricWo] = await Promise.all([
        resolveTranslation(nameFr, 'en', overlay.querySelector('#pNameEn').value, row.name_fr, row.name_en),
        resolveTranslation(nameFr, 'wo', overlay.querySelector('#pNameWo').value, row.name_fr, row.name_wo),
        resolveTranslation(fabricFr, 'en', row.fabric_en, row.fabric_fr, row.fabric_en),
        resolveTranslation(fabricFr, 'wo', row.fabric_wo, row.fabric_fr, row.fabric_wo)
      ]);

      const payload = {
        name_fr: nameFr,
        name_en: nameEn,
        name_wo: nameWo,
        fabric_fr: fabricFr || null,
        fabric_en: fabricFr ? fabricEn : null,
        fabric_wo: fabricFr ? fabricWo : null,
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

      /* Champs étendus (migration 20261127) : traduits puis ajoutés. Si la base
         n'a pas encore ces colonnes, on enregistre le reste et on le signale. */
      const tx = async (frVal, key) => {
        const [en, wo] = await Promise.all([
          resolveTranslation(frVal, 'en', row[key + '_en'], row[key + '_fr'], row[key + '_en']),
          resolveTranslation(frVal, 'wo', row[key + '_wo'], row[key + '_fr'], row[key + '_wo'])
        ]);
        return { [key + '_fr']: frVal || null, [key + '_en']: frVal ? en : null, [key + '_wo']: frVal ? wo : null };
      };
      const q = sel => overlay.querySelector(sel).value.trim();
      const extra = Object.assign({},
        await tx(q('#pDescFr'), 'description'), await tx(q('#pContentsFr'), 'contents'),
        await tx(q('#pCareFr'), 'care'), await tx(q('#pLeadFr'), 'lead_time'),
        {
          cut_fr: q('#pCutFr') || null, measures_text: q('#pMeasures') || null,
          fulfillment: overlay.querySelector('#pFulfillment').value || null,
          sold_out: overlay.querySelector('#pSoldOut').checked,
          unavailable_sizes: [...overlay.querySelectorAll('.p-unavail:checked')].map(c => c.value)
        });
      const isMissingColumn = e => e && /column|schema cache/i.test(e.message || '');
      let extendedSaved = true;

      let productId = id;
      if (id) {
        let { error } = await sb.from('products').update(Object.assign({}, payload, extra)).eq('id', id);
        if (isMissingColumn(error)) { extendedSaved = false; ({ error } = await sb.from('products').update(payload).eq('id', id)); }
        if (error) throw error;
      } else {
        payload.slug = slugify(nameFr) + '-' + Date.now().toString(36).slice(-5);
        let { data: inserted, error } = await sb.from('products').insert(Object.assign({}, payload, extra)).select('id').single();
        if (isMissingColumn(error)) { extendedSaved = false; ({ data: inserted, error } = await sb.from('products').insert(payload).select('id').single()); }
        if (error) throw error;
        productId = inserted.id;
      }
      if (!extendedSaved) toast('Enregistré, mais les champs étendus nécessitent la migration SQL (supabase/migrations).', true);

      if (pendingFiles.length) {
        const { data: existingImgs } = await sb.from('product_images').select('id').eq('product_id', productId);
        let sortBase = (existingImgs || []).length;
        for (const file of pendingFiles) {
          const url = await uploadProductImage(file, `products/${productId}`);
          const isFirstEver = sortBase === 0;
          await sb.from('product_images').insert({
            product_id: productId, image_url: url, sort_order: sortBase++,
            is_primary: isFirstEver, alt_fr: nameFr
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

/* Glisser-déposer des vignettes d'images existantes pour changer leur ordre.
   Support souris uniquement (glisser-déposer HTML5) ; l'ordre est enregistré
   dès le dépôt, pas seulement à l'enregistrement du produit. */
function bindImageDragReorder(grid) {
  if (!grid) return;
  let dragged = null;
  grid.querySelectorAll('.img-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', () => { dragged = item; item.classList.add('dragging'); });
    item.addEventListener('dragend', () => { dragged = null; item.classList.remove('dragging'); });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const items = [...grid.querySelectorAll('.img-item[draggable="true"]')];
      const from = items.indexOf(dragged), to = items.indexOf(item);
      if (from < to) item.after(dragged); else item.before(dragged);
    });
    item.addEventListener('drop', async e => {
      e.preventDefault();
      const ids = [...grid.querySelectorAll('.img-item[draggable="true"]')].map(n => n.dataset.id);
      await Promise.all(ids.map((imgId, i) => sb.from('product_images').update({ sort_order: i }).eq('id', imgId)));
      toast('Ordre des photos mis à jour.');
    });
  });
}

function bindChoiceRemovers(overlay) {
  overlay.querySelectorAll('.remove-choice').forEach(btn => {
    btn.onclick = () => btn.closest('.variant-choice').remove();
  });
}
