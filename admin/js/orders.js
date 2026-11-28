/* ======================================================================
   Hadeej'Art Admin — Commandes
   ====================================================================== */

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };
/* Paiement : distinct du statut commercial/livraison. Une commande n'est
   « payée » que lorsque la boutique l'a elle-même marquée « Reçu ». */
const PAYMENT_STATUSES = ['expected', 'received', 'refunded'];
const PAYMENT_STATUS_LABELS = { expected: 'Attendu', received: 'Reçu', refunded: 'Remboursé' };
let ORDERS_UNPAID_MODE = false;   /* tuile « Paiement à vérifier » du dashboard */
let ORDERS_VIEW = [];            /* liste affichée (pour l'export) */
const NEXT_STEP = { pending: ['confirmed', 'Confirmer'], confirmed: ['shipped', 'Expédier'], shipped: ['delivered', 'Livrée ✓'] };
const PAYMENT_METHOD_LABELS = { wave: 'Wave', orange_money: 'Orange Money', sendwave: 'Sendwave', taptap_send: 'TapTap Send' };

async function renderOrders() {
  const el = document.getElementById('section-orders');
  el.innerHTML = `<h2>Commandes</h2><p class="subtitle">Commandes passées via le site public (WhatsApp).</p>
    <div class="panel">
      <div class="panel-head">
        <h3 id="ordersTitle">Toutes les commandes</h3>
        <div class="toolbar">
        <button class="btn ghost sm" id="ordersExport">⬇ Exporter (CSV)</button>
        <input id="filterOrderSearch" type="search" placeholder="Rechercher (réf, nom, téléphone)" aria-label="Rechercher une commande" style="min-width:200px">
        <div class="ord-filters" id="ordFilters"><button type="button" class="ord-filters-btn" id="ordFiltersBtn" aria-expanded="false" aria-controls="ordFiltersBody">Filtres</button><div class="ord-filters-body" id="ordFiltersBody">
        <select id="filterOrderPay" aria-label="Filtrer par paiement">
          <option value="">Tous paiements</option>
          ${PAYMENT_STATUSES.map(s => `<option value="${s}">Paiement : ${PAYMENT_STATUS_LABELS[s]}</option>`).join('')}
        </select>
        <input type="hidden" id="filterOrderStatus" value="">
        <select id="filterOrderYear"><option value="">Toutes années</option></select>
        <select id="filterOrderMonth">
          <option value="">Tous les mois</option>
          ${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
        </select>
        </div></div>
        </div>
      </div>
      <div class="tabs" id="orderTabs" role="tablist" aria-label="Filtrer par statut"></div>
      <div id="ordersChip"></div>
      <div id="ordersList"><span class="skel-lines"><i></i><i></i><i></i></span></div>
    </div>`;
  ORDERS_UNPAID_MODE = false;
  if (SECTION_PRESET === 'pending' || SECTION_PRESET === 'confirmed') document.getElementById('filterOrderStatus').value = SECTION_PRESET;
  if (SECTION_PRESET === 'unpaid') ORDERS_UNPAID_MODE = true;
  document.getElementById('ordersExport').addEventListener('click', exportOrdersCsv);
  document.getElementById('ordFiltersBtn').addEventListener('click', e => {
    const box = document.getElementById('ordFilters'), open = !box.classList.contains('open');
    box.classList.toggle('open', open); e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('orderTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    ORDERS_UNPAID_MODE = false;
    const f = document.getElementById('filterOrderStatus'); f.value = t.dataset.st; f.dispatchEvent(new Event('change'));
  });
  const { data: first } = await sb.from('orders').select('created_at').order('created_at').limit(1);
  const y0 = first && first[0] ? new Date(first[0].created_at).getFullYear() : new Date().getFullYear();
  const ySel = document.getElementById('filterOrderYear');
  for (let y = new Date().getFullYear(); y >= y0; y--) ySel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
  ['filterOrderStatus', 'filterOrderYear', 'filterOrderMonth', 'filterOrderPay'].forEach(id => document.getElementById(id).addEventListener('change', loadOrdersList));
  let searchTimer = null;
  document.getElementById('filterOrderSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadOrdersList, 250); });
  await loadOrdersList();
}

async function refreshOrderTabs() {
  const host = document.getElementById('orderTabs'); if (!host) return;
  const { data } = await sb.from('orders').select('status');
  const counts = {}; (data || []).forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
  const cur = document.getElementById('filterOrderStatus').value;
  host.innerHTML = [['', 'Toutes', (data || []).length]].concat(ORDER_STATUSES.map(st => [st, ORDER_STATUS_LABELS[st], counts[st] || 0]))
    .map(([st, label, n]) => `<button type="button" class="tab ${st === cur && !ORDERS_UNPAID_MODE ? 'on' : ''}" data-st="${st}" role="tab" aria-selected="${st === cur}">${label}<span class="c">${n}</span></button>`).join('');
}

async function loadOrdersList() {
  refreshOrderTabs();
  const status = document.getElementById('filterOrderStatus').value;
  let q = sb.from('orders').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const year = +document.getElementById('filterOrderYear').value;
  const month = +document.getElementById('filterOrderMonth').value;
  if (year && month) q = q.gte('created_at', new Date(year, month - 1, 1).toISOString()).lt('created_at', new Date(year, month, 1).toISOString());
  else if (year) q = q.gte('created_at', new Date(year, 0, 1).toISOString()).lt('created_at', new Date(year + 1, 0, 1).toISOString());
  else if (month) q = q.order('created_at', { ascending: false }); /* mois seul : filtré ci-dessous */
  let { data, error } = await q;
  const host = document.getElementById('ordersList');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }
  if (month && !year) data = data.filter(o => new Date(o.created_at).getMonth() + 1 === month);
  if (ORDERS_UNPAID_MODE) data = data.filter(o => o.status !== 'cancelled' && o.status !== 'pending' && (o.payment_status || 'expected') === 'expected');
  const chip = document.getElementById('ordersChip');
  chip.innerHTML = ORDERS_UNPAID_MODE ? '<p class="filter-chip">Paiement à vérifier <button type="button" id="chipOff" aria-label="Retirer ce filtre">✕</button></p>' : '';
  if (ORDERS_UNPAID_MODE) document.getElementById('chipOff').addEventListener('click', () => { ORDERS_UNPAID_MODE = false; loadOrdersList(); });
  const pay = document.getElementById('filterOrderPay').value;
  if (pay) data = data.filter(o => (o.payment_status || 'expected') === pay);
  const term = document.getElementById('filterOrderSearch').value.trim().toLowerCase();
  if (term) data = data.filter(o => [o.order_ref, o.customer_name, o.customer_phone, o.city, o.district].some(v => String(v || '').toLowerCase().includes(term)));

  ORDERS_VIEW = data;
  /* Notes laissées par les clients (une note par article + la précision de livraison) : visibles dès la liste */
  const notesBy = {};
  try {
    const r = await sb.from('order_items').select('order_id,note').not('note', 'is', null).neq('note', '');
    (r.data || []).forEach(x => { if (x.note) (notesBy[x.order_id] = notesBy[x.order_id] || []).push(x.note); });
  } catch (e) { /* facultatif */ }
  document.getElementById('ordersTitle').textContent = data.length + ' commande' + (data.length > 1 ? 's' : '');
  const payBadge = o => {
    const ps = o.payment_status || 'expected';
    return `<span class="badge ${ps === 'received' ? 'delivered' : (ps === 'refunded' ? 'cancelled' : 'pending')}">${ps === 'received' ? '✓ Payée' : (ps === 'refunded' ? 'Remboursée' : 'Paiement attendu')}</span>`;
  };
  host.innerHTML = data.length ? `<div class="ord-grid">${data.map((o, i) => {
    const next = NEXT_STEP[o.status];
    const wa = waLink(o.customer_phone, `Bonjour ${o.customer_name || ''}, ici Hadeej’Art au sujet de votre commande ${o.order_ref}.`, o.country);
    return `
    <article class="ord st-${escapeHtml(o.status)}" data-open="${o.id}" tabindex="0" aria-label="Commande ${escapeHtml(o.order_ref)}" style="animation-delay:${Math.min(i, 10) * 35}ms">
      <header class="ord-top"><span class="ord-ref">${prettyRef(o.order_ref)}</span><span class="ord-when">${escapeHtml(fmtWhen(o.created_at))}</span></header>
      <div class="ord-who"><b>${escapeHtml(o.customer_name)}</b><span class="ord-tel">${escapeHtml(prettyPhone(o.customer_phone, o.country))}</span></div>
      ${(() => { const ns = (notesBy[o.id] || []).concat(o.location_note ? [o.location_note] : []); return ns.length ? `<p class="ord-note" title="${escapeHtml(ns.join(' · '))}"><span aria-hidden="true">📝</span> <span>${escapeHtml(ns[0])}${ns.length > 1 ? ' <b>+' + (ns.length - 1) + '</b>' : ''}</span></p>` : ''; })()}
      <div class="ord-mid"><span class="ord-total">${formatMoney(o.total_amount, o.currency)}</span>
        <span class="ord-pills"><span class="badge ${escapeHtml(o.status)}">${ORDER_STATUS_LABELS[o.status] || escapeHtml(o.status)}</span>${payBadge(o)}</span></div>
      <div class="ord-act">
        ${next ? `<button class="btn sm" data-next="${o.id}" data-to="${next[0]}">${next[1]}</button>` : ''}
        ${wa ? `<a class="btn ghost sm" href="${escapeHtml(wa)}" target="_blank" rel="noopener" title="Écrire au client sur WhatsApp">WhatsApp</a>` : ''}
        <button class="btn ghost sm" data-view="${o.id}">Détail</button>
      </div>
    </article>`; }).join('')}</div>`
    : `<div class="empty"><span class="big">🧾</span><b>Aucune commande ici</b><p>Les commandes passées sur le site apparaîtront dans cette liste.</p></div>`;

  host.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', async e => {
    e.stopPropagation();
    btn.disabled = true;
    const { error: er } = await sb.from('orders').update({ status: btn.dataset.to }).eq('id', btn.dataset.next);
    if (er) { toast('Erreur: ' + er.message, true); btn.disabled = false; return; }
    toast('Statut : ' + ORDER_STATUS_LABELS[btn.dataset.to] + '.');
    loadOrdersList(); updateNavBadges();
  }));
  host.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openOrderDetail(btn.dataset.view); }));
  host.querySelectorAll('a.btn').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
  /* toute la carte ouvre le détail (souris, doigt ou clavier) */
  host.querySelectorAll('.ord[data-open]').forEach(card => {
    card.addEventListener('click', () => openOrderDetail(card.dataset.open));
    card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); openOrderDetail(card.dataset.open); } });
  });
}

function exportOrdersCsv() {
  if (!ORDERS_VIEW.length) { toast('Aucune commande à exporter.', true); return; }
  downloadCsv(`commandes-${todayStamp()}.csv`, [['Référence', 'Date', 'Client', 'Téléphone', 'E-mail', 'Pays', 'Ville', 'Quartier', 'Total articles', 'Devise', 'Moyen de paiement', 'Paiement', 'Statut']]
    .concat(ORDERS_VIEW.map(o => [o.order_ref, (o.created_at || '').slice(0, 10), o.customer_name, o.customer_phone, o.customer_email || '', o.country || '', o.city || '', o.district || '',
      o.total_amount, o.currency, PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method, PAYMENT_STATUS_LABELS[o.payment_status || 'expected'], ORDER_STATUS_LABELS[o.status] || o.status])));
}

async function openOrderDetail(id) {
  const [{ data: order }, { data: items }, histRes] = await Promise.all([
    sb.from('orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id),
    sb.from('order_status_history').select('*').eq('order_id', id).order('changed_at', { ascending: false })
  ]);
  if (!order) { toast('Commande introuvable.', true); return; }
  const history = histRes && !histRes.error ? histRes.data : [];
  const hasPay = Object.prototype.hasOwnProperty.call(order, 'payment_status'); /* colonne présente = migration appliquée */
  const lines = items || [];

  /* vignettes et libellés d'options des produits commandés (facultatif : sans réponse, on s'en passe) */
  const pids = [...new Set(lines.map(l => l.product_id).filter(Boolean))];
  const thumbBy = {}, optBy = {};
  if (pids.length) {
    try {
      const [im, pr] = await Promise.all([
        sb.from('product_images').select('product_id,image_url,is_primary,sort_order').in('product_id', pids),
        sb.from('products').select('id,variant_options').in('id', pids)
      ]);
      (im.data || []).sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0))
        .forEach(r => { if (!thumbBy[r.product_id]) thumbBy[r.product_id] = r.image_url; });
      (pr.data || []).forEach(r => { if (r.variant_options && r.variant_options.choices) optBy[r.id] = Object.fromEntries(r.variant_options.choices.map(c => [c.value, c.label_fr || c.value])); });
    } catch (e) { /* ignoré */ }
  }

  const tel = prettyPhone(order.customer_phone, order.country);
  const intl = intlPhone(order.customer_phone, order.country);
  const wa = waLink(order.customer_phone, 'Bonjour ' + (order.customer_name || '') + ', ici Hadeej’Art au sujet de votre commande ' + order.order_ref + '.', order.country);
  const place = [order.district, order.city, order.country].filter(Boolean).join(', ');
  const ps = order.payment_status || 'expected';
  const payLabel = ps === 'received' ? '✓ Payée' : (ps === 'refunded' ? 'Remboursée' : 'Paiement attendu');
  const placed = (() => { try { return new Date(order.created_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }); } catch (e) { return ''; } })();

  const flow = ['pending', 'confirmed', 'shipped', 'delivered'];
  const at = flow.indexOf(order.status);
  const steps = order.status === 'cancelled'
    ? '<p class="od-cancel">✕ Commande annulée</p>'
    : `<ol class="od-steps" aria-label="Avancement de la commande">${flow.map((s, i) => `<li class="${i < at ? 'done' : (i === at ? 'now' : '')}"><i>${i < at ? '✓' : i + 1}</i><span>${ORDER_STATUS_LABELS[s]}</span></li>`).join('')}</ol>`;

  const itemHtml = lines.map(it => {
    const optLabel = it.option_kimono ? ((optBy[it.product_id] || {})[it.option_kimono] || it.option_kimono) : '';
    const pills = [['Taille', it.size], ['Tissu', it.fabric], ['Couleur', it.color], ['Option', optLabel]].filter(x => x[1])
      .map(([k, v]) => `<span class="od-pill"><small>${k}</small> ${escapeHtml(v)}</span>`).join('');
    return `<li class="od-item">
      <span class="od-thumb">${thumbBy[it.product_id] ? `<img src="${escapeHtml(assetUrl(thumbBy[it.product_id]))}" alt="" loading="lazy">` : '🧵'}</span>
      <div class="od-item-main"><b>${escapeHtml(it.product_name)}</b>${pills ? `<div class="od-pills">${pills}</div>` : ''}${it.note ? `<p class="od-note"><span aria-hidden="true">📝</span> <span><small>Note du client</small>${escapeHtml(it.note)}</span></p>` : ''}</div>
      <div class="od-item-price"><span class="od-qty">×${it.qty}</span><b>${formatMoney(it.line_total, order.currency)}</b></div></li>`;
  }).join('');

  const kindLabel = h => (h.kind === 'payment' ? PAYMENT_STATUS_LABELS : ORDER_STATUS_LABELS);
  const histHtml = history && history.length ? `<ol class="od-timeline">${history.map(h => `<li><span class="dot"></span><div><b>${h.kind === 'payment' ? 'Paiement' : 'Statut'} : ${escapeHtml(kindLabel(h)[h.to_value] || h.to_value)}</b>
      <small>${h.from_value ? 'avant : ' + escapeHtml(kindLabel(h)[h.from_value] || h.from_value) + ' · ' : ''}${escapeHtml(fmtWhen(h.changed_at))}</small></div></li>`).join('')}</ol>` : '<p class="hint">Aucun changement enregistré pour le moment.</p>';

  const overlay = openModal(`
    <header class="od-head">
      <div class="od-title"><small>COMMANDE</small><h3>${prettyRef(order.order_ref)}</h3>
        <p class="od-meta">${escapeHtml(placed)}</p>
        <p class="od-badges"><span class="badge ${escapeHtml(order.status)}">${ORDER_STATUS_LABELS[order.status] || escapeHtml(order.status)}</span>
          <span class="badge ${ps === 'received' ? 'delivered' : (ps === 'refunded' ? 'cancelled' : 'pending')}">${payLabel}</span></p></div>
      <div class="od-head-act"><button class="icon-btn" id="copyOrderBtn" title="Copier le récapitulatif" aria-label="Copier le récapitulatif">⧉</button><button class="icon-btn" id="closeOrderModal" aria-label="Fermer">✕</button></div>
    </header>
    <div class="body od-body">
      ${steps}
      <section class="od-card"><h4>Client</h4>
        <p class="od-name">${escapeHtml(order.customer_name)}</p>
        <p class="od-tel">${escapeHtml(tel)}</p>
        ${order.customer_email ? `<p class="od-mail"><a href="mailto:${escapeHtml(order.customer_email)}">${escapeHtml(order.customer_email)}</a></p>` : ''}
        <div class="od-actions">
          ${wa ? `<a class="btn sm" href="${escapeHtml(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${intl ? `<a class="btn ghost sm" href="tel:+${intl}">Appeler</a>` : ''}
        </div></section>
      <section class="od-card"><h4>Livraison</h4>
        <p class="od-place">${escapeHtml(place || '—')}</p>
        ${order.location_address ? `<p class="od-line"><small>Adresse détectée</small>${escapeHtml(order.location_address)}</p>` : ''}
        ${order.location_note ? `<p class="od-line"><small>Précision du client</small>${escapeHtml(order.location_note)}</p>` : ''}
        ${order.maps_link ? `<div class="od-actions"><a class="btn ghost sm" href="${escapeHtml(order.maps_link)}" target="_blank" rel="noopener">Voir sur Google Maps ↗</a></div>` : ''}</section>
      <section class="od-card"><h4>Articles <span class="od-count">${lines.reduce((s, l) => s + Number(l.qty || 0), 0)}</span></h4>
        <ul class="od-items">${itemHtml || '<li class="hint">Aucun article.</li>'}</ul>
        <div class="od-total"><span>Total des articles <small>(hors livraison)</small></span><b>${formatMoney(order.total_amount, order.currency)}</b></div>
        <p class="od-pay">Moyen choisi : <b>${escapeHtml(PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method)}</b> · Devise : <b>${escapeHtml(order.currency)}</b></p></section>
      <section class="od-card"><h4>Suivi</h4>
        <div class="grid-2">
          <div class="field"><label>Statut de la commande</label>
            <select id="orderStatusSelect">${ORDER_STATUSES.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${ORDER_STATUS_LABELS[s]}</option>`).join('')}</select></div>
          ${hasPay ? `<div class="field"><label>Paiement</label>
            <select id="orderPaySelect">${PAYMENT_STATUSES.map(s => `<option value="${s}" ${ps === s ? 'selected' : ''}>${PAYMENT_STATUS_LABELS[s]}</option>`).join('')}</select>
            <p class="hint">Ne passez « Reçu » qu’après avoir réellement encaissé.</p></div>` : ''}
        </div>
        ${hasPay ? `<div class="field"><label>Note interne <small>(visible par vous seul)</small></label><textarea id="orderNote" rows="2">${escapeHtml(order.internal_note || '')}</textarea></div>` : '<p class="hint">Suivi du paiement et historique : appliquez la migration SQL (supabase/migrations).</p>'}</section>
      <section class="od-card"><h4>Historique</h4>${histHtml}</section>
    </div>
    <div class="foot">
      <button class="btn danger ghost-danger" id="deleteOrderBtn">Supprimer</button>
      <button class="btn" id="saveOrderStatusBtn">Enregistrer</button>
    </div>
  `);
  overlay.querySelector('.modal-box').classList.add('od-modal');

  overlay.querySelector('#closeOrderModal').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#copyOrderBtn').addEventListener('click', async () => {
    const txt = [`Commande ${order.order_ref}`, `Client : ${order.customer_name} · ${tel}`, `Livraison : ${place || '—'}${order.location_address ? ' · ' + order.location_address : ''}`,
      ...lines.map(l => `- ${l.product_name} ×${l.qty}${[l.size, l.fabric, l.color].filter(Boolean).length ? ' (' + [l.size, l.fabric, l.color].filter(Boolean).join(', ') + ')' : ''} — ${formatMoney(l.line_total, order.currency)}`),
      `Total (hors livraison) : ${formatMoney(order.total_amount, order.currency)}`, `Paiement : ${PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method}`].join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Récapitulatif copié.'); } catch (e) { prompt('Copiez le récapitulatif :', txt); }
  });
  overlay.querySelector('#deleteOrderBtn').addEventListener('click', async () => { if (await deleteOrder(id, order.order_ref)) closeModal(overlay); });
  overlay.querySelector('#saveOrderStatusBtn').addEventListener('click', async () => {
    const newStatus = overlay.querySelector('#orderStatusSelect').value;
    const patch = { status: newStatus };
    if (hasPay) {
      patch.payment_status = overlay.querySelector('#orderPaySelect').value;
      patch.internal_note = overlay.querySelector('#orderNote').value.trim() || null;
      if (patch.payment_status === 'refunded' && order.payment_status !== 'refunded' && !confirm('Marquer cette commande comme remboursée ?')) return;
    }
    const { error } = await sb.from('orders').update(patch).eq('id', id);
    if (error) toast('Erreur: ' + error.message, true);
    else { toast('Commande mise à jour.'); closeModal(overlay); if (document.getElementById('ordersList')) loadOrdersList(); updateNavBadges(); }
  });
}

async function deleteOrder(id, ref) {
  if (!confirm(`Supprimer définitivement la commande ${ref} et ses articles ?

Cette action est irréversible.`)) return false;
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { toast('Erreur: ' + error.message, true); return false; }
  toast('Commande supprimée.');
  if (document.getElementById('ordersList')) loadOrdersList();
  updateNavBadges();
  return true;
}
