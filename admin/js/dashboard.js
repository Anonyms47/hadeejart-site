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

  /* Montants : calculés à partir des vraies commandes. « Encaissé » = paiement
     marqué « Reçu » par la boutique ; le reste est « à encaisser » (commandes
     non annulées dont le paiement n'est pas reçu). Une devise à la fois :
     jamais de somme mêlant FCFA, EUR et USD. */
  const { data: money, error: moneyErr } = await sb.from('orders').select('*');
  const sums = { paid: {}, due: {} };
  const hasPay = !moneyErr && (money || []).length && Object.prototype.hasOwnProperty.call(money[0], 'payment_status');
  if (hasPay) (money || []).forEach(o => {
    if (o.status === 'cancelled' || o.payment_status === 'refunded') return;
    const bucket = o.payment_status === 'received' ? sums.paid : sums.due;
    bucket[o.currency] = (bucket[o.currency] || 0) + Number(o.total_amount || 0);
  });
  const fmtSums = o => Object.keys(o).length ? Object.entries(o).map(([c, v]) => formatMoney(v, c)).join(' + ') : '0';

  document.getElementById('statGrid').innerHTML = [
    ['Produits', productCount || 0],
    ['Publiés', publishedCount || 0],
    ['Collections', collectionCount || 0],
    ['Commandes', orderCount || 0],
    ['En attente', pendingCount || 0],
    ...(hasPay ? [['Encaissé (paiements reçus)', fmtSums(sums.paid)], ['À encaisser (non payé)', fmtSums(sums.due)]] : [])
  ].map(([label, n]) => `<div class="stat-card"><div class="n">${typeof n === 'number' ? n : escapeHtml(n)}</div><div class="l">${escapeHtml(label)}</div></div>`).join('');

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
