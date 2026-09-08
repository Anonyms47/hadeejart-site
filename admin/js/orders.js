/* ======================================================================
   Hadeej'Art Admin — Commandes
   ====================================================================== */

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const ORDER_STATUS_LABELS = { pending: 'En attente', confirmed: 'Confirmée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' };

async function renderOrders() {
  const el = document.getElementById('section-orders');
  el.innerHTML = `<h2>Commandes</h2><p class="subtitle">Commandes passées via le site public (WhatsApp).</p>
    <div class="panel">
      <div class="panel-head">
        <h3>Toutes les commandes</h3>
        <select id="filterOrderStatus">
          <option value="">Tous statuts</option>
          ${ORDER_STATUSES.map(s => `<option value="${s}">${ORDER_STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div id="ordersList">Chargement…</div>
    </div>`;
  document.getElementById('filterOrderStatus').addEventListener('change', loadOrdersList);
  await loadOrdersList();
}

async function loadOrdersList() {
  const status = document.getElementById('filterOrderStatus').value;
  let q = sb.from('orders').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  const host = document.getElementById('ordersList');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  host.innerHTML = `<table><thead><tr><th>Réf</th><th>Client</th><th>Lieu</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Date</th><th></th></tr></thead>
    <tbody>${data.map(o => `
      <tr>
        <td>${escapeHtml(o.order_ref)}</td>
        <td>${escapeHtml(o.customer_name)}<br><span class="badge" style="background:#f3f3f3">${escapeHtml(o.customer_phone)}</span></td>
        <td>${escapeHtml([o.district, o.city, o.country].filter(Boolean).join(', ') || '—')}</td>
        <td>${formatMoney(o.total_amount, o.currency)}</td>
        <td>${escapeHtml(o.payment_method)}</td>
        <td><span class="badge ${escapeHtml(o.status)}">${ORDER_STATUS_LABELS[o.status] || o.status}</span></td>
        <td>${fmtDate(o.created_at)}</td>
        <td><button class="btn ghost sm" data-view="${o.id}">Détail</button></td>
      </tr>`).join('') || '<tr><td colspan="8">Aucune commande.</td></tr>'}</tbody></table>`;

  host.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openOrderDetail(btn.dataset.view)));
}

async function openOrderDetail(id) {
  const [{ data: order }, { data: items }] = await Promise.all([
    sb.from('orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id)
  ]);
  if (!order) { toast('Commande introuvable.', true); return; }

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
      <p style="text-align:right;font-weight:800;margin-top:10px">Total : ${formatMoney(order.total_amount, order.currency)}</p>
      <div class="field"><label>Statut</label>
        <select id="orderStatusSelect">
          ${ORDER_STATUSES.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${ORDER_STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="foot">
      <button class="btn ghost" id="closeOrderBtn">Fermer</button>
      <button class="btn" id="saveOrderStatusBtn">Mettre à jour le statut</button>
    </div>
  `);

  overlay.querySelector('#closeOrderModal').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#closeOrderBtn').addEventListener('click', () => closeModal(overlay));
  overlay.querySelector('#saveOrderStatusBtn').addEventListener('click', async () => {
    const newStatus = overlay.querySelector('#orderStatusSelect').value;
    const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) toast('Erreur: ' + error.message, true);
    else { toast('Statut mis à jour.'); closeModal(overlay); loadOrdersList(); }
  });
}
