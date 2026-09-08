/* ======================================================================
   Hadeej'Art Admin — Dashboard
   ====================================================================== */

async function renderDashboard() {
  const el = document.getElementById('section-dashboard');
  el.innerHTML = `<h2>Dashboard</h2><p class="subtitle">Vue d’ensemble de la boutique</p><div class="stat-grid" id="statGrid"><p>Chargement…</p></div>
  <div class="panel"><div class="panel-head"><h3>Dernières commandes</h3></div><div id="recentOrders">Chargement…</div></div>`;

  const [{ count: productCount }, { count: publishedCount }, { count: collectionCount },
         { count: orderCount }, { count: pendingCount }, { data: recent }] = await Promise.all([
    sb.from('products').select('id', { count: 'exact', head: true }),
    sb.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    sb.from('collections').select('id', { count: 'exact', head: true }),
    sb.from('orders').select('id', { count: 'exact', head: true }),
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('orders').select('order_ref,customer_name,total_amount,currency,status,created_at').order('created_at', { ascending: false }).limit(6)
  ]);

  document.getElementById('statGrid').innerHTML = [
    ['Produits', productCount || 0],
    ['Publiés', publishedCount || 0],
    ['Collections', collectionCount || 0],
    ['Commandes', orderCount || 0],
    ['En attente', pendingCount || 0]
  ].map(([label, n]) => `<div class="stat-card"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`).join('');

  const rows = (recent || []).map(o => `
    <tr>
      <td>${escapeHtml(o.order_ref)}</td>
      <td>${escapeHtml(o.customer_name)}</td>
      <td>${formatMoney(o.total_amount, o.currency)}</td>
      <td><span class="badge ${escapeHtml(o.status)}">${escapeHtml(o.status)}</span></td>
      <td>${fmtDate(o.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="5">Aucune commande.</td></tr>';

  document.getElementById('recentOrders').innerHTML = `
    <table><thead><tr><th>Réf</th><th>Client</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}
