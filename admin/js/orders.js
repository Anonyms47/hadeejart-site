/* ======================================================================
   Hadeej'Art Admin — Commandes
   ====================================================================== */

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };
/* Paiement : distinct du statut commercial/livraison. Une commande n'est
   « payée » que lorsque la boutique l'a elle-même marquée « Reçu ». */
const PAYMENT_STATUSES = ['expected', 'received', 'refunded'];
const PAYMENT_STATUS_LABELS = { expected: 'Attendu', received: 'Reçu', refunded: 'Remboursé' };
const PAYMENT_METHOD_LABELS = { wave: 'Wave', orange_money: 'Orange Money', sendwave: 'Sendwave', taptap_send: 'TapTap Send' };

async function renderOrders() {
  const el = document.getElementById('section-orders');
  el.innerHTML = `<h2>Commandes</h2><p class="subtitle">Commandes passées via le site public (WhatsApp).</p>
    <div class="panel">
      <div class="panel-head">
        <h3>Toutes les commandes</h3>
        <input id="filterOrderSearch" type="search" placeholder="Rechercher (réf, nom, téléphone)" aria-label="Rechercher une commande" style="min-width:200px">
        <select id="filterOrderPay" aria-label="Filtrer par paiement">
          <option value="">Tous paiements</option>
          ${PAYMENT_STATUSES.map(s => `<option value="${s}">Paiement : ${PAYMENT_STATUS_LABELS[s]}</option>`).join('')}
        </select>
        <select id="filterOrderStatus">
          <option value="">Tous statuts</option>
          ${ORDER_STATUSES.map(s => `<option value="${s}">${ORDER_STATUS_LABELS[s]}</option>`).join('')}
        </select>
        <select id="filterOrderYear"><option value="">Toutes années</option></select>
        <select id="filterOrderMonth">
          <option value="">Tous les mois</option>
          ${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}
        </select>
      </div>
      <div id="ordersList">Chargement…</div>
    </div>`;
  const { data: first } = await sb.from('orders').select('created_at').order('created_at').limit(1);
  const y0 = first && first[0] ? new Date(first[0].created_at).getFullYear() : new Date().getFullYear();
  const ySel = document.getElementById('filterOrderYear');
  for (let y = new Date().getFullYear(); y >= y0; y--) ySel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
  ['filterOrderStatus', 'filterOrderYear', 'filterOrderMonth', 'filterOrderPay'].forEach(id => document.getElementById(id).addEventListener('change', loadOrdersList));
  let searchTimer = null;
  document.getElementById('filterOrderSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadOrdersList, 250); });
  await loadOrdersList();
}

async function loadOrdersList() {
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
  const pay = document.getElementById('filterOrderPay').value;
  if (pay) data = data.filter(o => (o.payment_status || 'expected') === pay);
  const term = document.getElementById('filterOrderSearch').value.trim().toLowerCase();
  if (term) data = data.filter(o => [o.order_ref, o.customer_name, o.customer_phone, o.city, o.district].some(v => String(v || '').toLowerCase().includes(term)));

  host.innerHTML = `<table><thead><tr><th>Réf</th><th>Client</th><th>Total</th><th>Moyen</th><th>Paiement</th><th>Statut</th><th>Date</th><th></th></tr></thead>
    <tbody>${data.map(o => `
      <tr>
        <td>${escapeHtml(o.order_ref)}</td>
        <td>${escapeHtml(o.customer_name)}<br><span class="badge" style="background:#f3f3f3">${escapeHtml(o.customer_phone)}</span></td>
        <td>${formatMoney(o.total_amount, o.currency)}</td>
        <td>${escapeHtml(PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method)}</td>
        <td><span class="badge ${(o.payment_status || 'expected') === 'received' ? 'delivered' : (o.payment_status === 'refunded' ? 'cancelled' : 'pending')}">${PAYMENT_STATUS_LABELS[o.payment_status || 'expected']}</span></td>
        <td><span class="badge ${escapeHtml(o.status)}">${ORDER_STATUS_LABELS[o.status] || o.status}</span></td>
        <td>${fmtDate(o.created_at)}</td>
        <td><button class="btn ghost sm" data-view="${o.id}">Détail</button> <button class="btn danger sm" data-del="${o.id}" data-ref="${escapeHtml(o.order_ref)}">Supprimer</button></td>
      </tr>`).join('') || '<tr><td colspan="8">Aucune commande.</td></tr>'}</tbody></table>`;

  host.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => deleteOrder(btn.dataset.del, btn.dataset.ref)));
  host.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openOrderDetail(btn.dataset.view)));
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

  const overlay = openModal(`
    <header><h3>Commande ${escapeHtml(order.order_ref)}</h3><button class="icon-btn" id="closeOrderModal">✕</button></header>
    <div class="body">
      <p><b>${escapeHtml(order.customer_name)}</b> · ${escapeHtml(order.customer_phone)} ${order.customer_email ? '· ' + escapeHtml(order.customer_email) : ''}</p>
      <p>Lieu : ${escapeHtml([order.district, order.city, order.country].filter(Boolean).join(', ') || '—')}</p>
      ${order.location_address ? `<p>Adresse détectée : ${escapeHtml(order.location_address)}</p>` : ''}
      ${order.location_note ? `<p>Précision : ${escapeHtml(order.location_note)}</p>` : ''}
      ${order.maps_link ? `<p><a href="${escapeHtml(order.maps_link)}" target="_blank" rel="noopener">Voir sur Google Maps ↗</a></p>` : ''}
      <p>Paiement : ${escapeHtml(order.payment_method)} · Devise : ${escapeHtml(order.currency)}</p>
      <table><thead><tr><th>Article</th><th>Détails</th><th>Qté</th><th>Total</th></tr></thead>
        <tbody>${(items || []).map(it => `
          <tr>
            <td>${escapeHtml(it.product_name)}</td>
            <td>${escapeHtml([it.size, it.color, it.fabric, it.option_kimono, it.note].filter(Boolean).join(' · '))}</td>
            <td>${it.qty}</td>
            <td>${formatMoney(it.line_total, order.currency)}</td>
          </tr>`).join('')}</tbody></table>
      <p style="text-align:right;font-weight:800;margin-top:10px">Total articles (hors livraison) : ${formatMoney(order.total_amount, order.currency)}</p>
      <div class="grid-2">
        <div class="field"><label>Statut de la commande</label>
          <select id="orderStatusSelect">
            ${ORDER_STATUSES.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${ORDER_STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
        ${hasPay ? `<div class="field"><label>Paiement</label>
          <select id="orderPaySelect">
            ${PAYMENT_STATUSES.map(s => `<option value="${s}" ${(order.payment_status || 'expected') === s ? 'selected' : ''}>${PAYMENT_STATUS_LABELS[s]}</option>`).join('')}
          </select>
          <p class="hint">Moyen choisi par le client : ${escapeHtml(PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method)}. Ne passez « Reçu » qu’après avoir réellement encaissé.</p>
        </div>` : ''}
      </div>
      ${hasPay ? `<div class="field"><label>Note interne</label><textarea id="orderNote" rows="2">${escapeHtml(order.internal_note || '')}</textarea></div>` : '<p class="hint">Suivi du paiement et historique : appliquez la migration SQL (supabase/migrations).</p>'}
      ${history && history.length ? `<details><summary><b>Historique</b></summary><ul style="margin:8px 0 0;padding-left:18px">${history.map(h => `<li>${fmtDate(h.changed_at)} — ${h.kind === 'payment' ? 'Paiement' : 'Statut'} : ${escapeHtml(((h.kind === 'payment' ? PAYMENT_STATUS_LABELS : ORDER_STATUS_LABELS)[h.from_value] || h.from_value || '—'))} → <b>${escapeHtml(((h.kind === 'payment' ? PAYMENT_STATUS_LABELS : ORDER_STATUS_LABELS)[h.to_value] || h.to_value))}</b></li>`).join('')}</ul></details>` : ''}
    </div>
    <div class="foot">
      <button class="btn danger" id="deleteOrderBtn">Supprimer</button>
      <button class="btn ghost" id="closeOrderBtn">Fermer</button>
      <button class="btn" id="saveOrderStatusBtn">Enregistrer</button>
    </div>
  `);

  overlay.querySelector('#closeOrderModal').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#closeOrderBtn').addEventListener('click', () => closeModal(overlay));
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
    else { toast('Statut mis à jour.'); closeModal(overlay); loadOrdersList(); }
  });
}

async function deleteOrder(id, ref) {
  if (!confirm(`Supprimer définitivement la commande ${ref} et ses articles ?

Cette action est irréversible.`)) return false;
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { toast('Erreur: ' + error.message, true); return false; }
  toast('Commande supprimée.');
  loadOrdersList();
  return true;
}
