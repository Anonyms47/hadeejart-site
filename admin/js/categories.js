/* ======================================================================
   Hadeej'Art Admin — Catégories
   Créer, renommer, réordonner, masquer (« bientôt disponible ») et supprimer
   (seulement si aucun produit n'y est rangé). Écrivez le nom en français :
   l'anglais et le wolof se créent tout seuls (modifiables).
   Le menu « Boutique » et les filtres du site public se mettent à jour seuls.
   ====================================================================== */

async function renderCategories() {
  const el = document.getElementById('section-categories');
  el.innerHTML = `
    <div class="page-head"><div><h2>Catégories</h2>
      <p class="subtitle">Les rayons de la boutique. Une catégorie masquée est annoncée « bientôt disponible » sur le site.</p></div></div>
    <div class="panel">
      <div class="panel-head"><h3>✨ Nouvelle catégorie</h3></div>
      <form id="catNewForm" class="cat-new" autocomplete="off">
        <div class="field"><label for="catNewName">Nom (en français)</label>
          <input id="catNewName" required maxlength="60" placeholder="ex : Boubous, Accessoires, Enfants…"></div>
        <label class="switch"><input type="checkbox" id="catNewActive" checked><i></i><span>Visible tout de suite</span></label>
        <button class="btn" id="catNewBtn" type="submit">+ Créer</button>
      </form>
      <p class="hint cat-new-hint">Le nom anglais et le nom wolof sont créés automatiquement ; vous pourrez les corriger ci-dessous.</p>
    </div>
    <div id="catPanel"><span class="skel-lines"><i></i><i></i><i></i></span></div>`;

  document.getElementById('catNewForm').addEventListener('submit', createCategory);
  await loadCategories();
}

async function loadCategories() {
  const host = document.getElementById('catPanel');
  const { data, error } = await sb.from('categories').select('*, products(id)').order('sort_order');
  if (error) { host.innerHTML = '<div class="panel">Erreur : ' + escapeHtml(error.message) + '</div>'; return; }
  const cats = data || [];

  if (!cats.length) {
    host.innerHTML = `<div class="panel"><div class="empty"><span class="big">🏷️</span><b>Aucune catégorie</b><p>Créez votre première catégorie ci-dessus (ex : Boubous).</p></div></div>`;
    return;
  }

  host.innerHTML = `<div class="cat-grid">${cats.map((c, i) => {
    const n = (c.products || []).length;
    const on = c.active !== false;
    return `
    <article class="cat-card ${on ? '' : 'off'}" data-id="${c.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
      <div class="cat-top">
        <span class="cat-ico" aria-hidden="true">${escapeHtml((c.name_fr || '?').trim().charAt(0).toUpperCase())}</span>
        <div class="cat-title"><input class="cat-fr" value="${escapeHtml(c.name_fr || '')}" aria-label="Nom en français" maxlength="60">
          <p class="cat-slug">/${escapeHtml(c.slug)} · ${n} produit${n > 1 ? 's' : ''}</p></div>
      </div>
      <div class="cat-langs">
        <div><label>English</label><input class="cat-en" value="${escapeHtml(c.name_en || '')}" placeholder="Automatique"></div>
        <div><label>Wolof</label><input class="cat-wo" value="${escapeHtml(c.name_wo || '')}" placeholder="Automatique"></div>
      </div>
      <div class="cat-actions">
        <label class="switch"><input type="checkbox" class="cat-active" ${on ? 'checked' : ''}><i></i><span>${on ? 'Visible' : 'Masquée'}</span></label>
        <span class="grow"></span>
        <button type="button" class="mini cat-up" aria-label="Monter" title="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="mini cat-down" aria-label="Descendre" title="Descendre" ${i === cats.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
      <div class="cat-actions">
        <button type="button" class="btn sm cat-save">Enregistrer</button>
        <button type="button" class="btn danger sm cat-del" ${n ? 'disabled' : ''} title="${n ? 'Impossible : des produits sont rangés ici' : 'Supprimer cette catégorie'}">Supprimer</button>
      </div>
    </article>`;
  }).join('')}</div>`;

  host.querySelectorAll('.cat-card').forEach(card => {
    const id = card.dataset.id;
    const idx = cats.findIndex(x => x.id === id);
    const orig = cats[idx];
    const sw = card.querySelector('.cat-active');
    sw.addEventListener('change', () => { card.classList.toggle('off', !sw.checked); sw.parentNode.querySelector('span').textContent = sw.checked ? 'Visible' : 'Masquée'; });

    card.querySelector('.cat-save').addEventListener('click', async e => {
      const btn = e.currentTarget;
      const fr = card.querySelector('.cat-fr').value.trim();
      if (!fr) { toast('Le nom français est obligatoire.', true); return; }
      btn.disabled = true;
      const [nameEn, nameWo] = await Promise.all([
        resolveTranslation(fr, 'en', card.querySelector('.cat-en').value, orig.name_fr, orig.name_en),
        resolveTranslation(fr, 'wo', card.querySelector('.cat-wo').value, orig.name_fr, orig.name_wo)
      ]);
      const { error: err } = await sb.from('categories').update({ name_fr: fr, name_en: nameEn, name_wo: nameWo, active: sw.checked }).eq('id', id);
      btn.disabled = false;
      if (err) { toast('Erreur : ' + err.message, true); return; }
      card.querySelector('.cat-en').value = nameEn || ''; card.querySelector('.cat-wo').value = nameWo || '';
      Object.assign(orig, { name_fr: fr, name_en: nameEn, name_wo: nameWo, active: sw.checked });
      card.querySelector('.cat-ico').textContent = fr.charAt(0).toUpperCase();
      toast('Catégorie enregistrée.');
    });

    const move = async dir => {
      const other = cats[idx + dir];
      if (!other) return;
      const [a, b] = await Promise.all([
        sb.from('categories').update({ sort_order: other.sort_order }).eq('id', orig.id),
        sb.from('categories').update({ sort_order: orig.sort_order }).eq('id', other.id)
      ]);
      if (a.error || b.error) { toast('Erreur : ' + ((a.error || b.error).message), true); return; }
      loadCategories();
    };
    card.querySelector('.cat-up').addEventListener('click', () => move(-1));
    card.querySelector('.cat-down').addEventListener('click', () => move(1));

    card.querySelector('.cat-del').addEventListener('click', async () => {
      if (!confirm(`Supprimer la catégorie « ${orig.name_fr} » ?\n\nElle disparaîtra du site. Cette action est irréversible.`)) return;
      const { error: err } = await sb.from('categories').delete().eq('id', id);
      if (err) { toast('Suppression impossible : ' + err.message, true); return; }
      toast('Catégorie supprimée.'); loadCategories();
    });
  });
}

async function createCategory(e) {
  e.preventDefault();
  const nameEl = document.getElementById('catNewName');
  const btn = document.getElementById('catNewBtn');
  const fr = nameEl.value.trim();
  const base = slugify(fr) || 'categorie';   /* noms en arabe, chinois… : identifiant de secours, unique grâce au suffixe ci-dessous */
  if (!fr) { toast('Donnez un nom à la catégorie.', true); return; }
  btn.disabled = true; btn.textContent = 'Création…';
  try {
    const { data: existing, error: e1 } = await sb.from('categories').select('slug, name_fr, sort_order');
    if (e1) throw e1;
    const list = existing || [];
    if (list.some(c => String(c.name_fr || '').trim().toLowerCase() === fr.toLowerCase())) { toast('Cette catégorie existe déjà.', true); return; }
    const taken = new Set(list.map(c => c.slug));
    let slug = base, k = 2;
    while (taken.has(slug)) slug = base + '-' + k++;
    const [nameEn, nameWo] = await Promise.all([resolveTranslation(fr, 'en', '', null, null), resolveTranslation(fr, 'wo', '', null, null)]);
    const sort = list.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) + 1;
    const { error: e2 } = await sb.from('categories').insert({ slug, name_fr: fr, name_en: nameEn, name_wo: nameWo, sort_order: sort, active: document.getElementById('catNewActive').checked });
    if (e2) throw e2;
    nameEl.value = '';
    toast(`Catégorie « ${fr} » créée.`);
    await loadCategories();
  } catch (err) {
    toast('Erreur : ' + (err.message || err), true);
  } finally {
    btn.disabled = false; btn.textContent = '+ Créer';
  }
}
