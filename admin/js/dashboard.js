/* ======================================================================
   Hadeej'Art Admin — Dashboard : ce qu'il faut faire maintenant, puis les chiffres
   ====================================================================== */

let DASH_DAYS = 30;

async function renderDashboard() {
  const el = document.getElementById('section-dashboard');
  const hello = CURRENT_ADMIN && (CURRENT_ADMIN.full_name || '').split(' ')[0];
  el.innerHTML = `
    <div class="page-head">
      <div><h2>${hello ? 'Bonjour ' + escapeHtml(hello) : 'Dashboard'}</h2><p class="subtitle">Ce qui demande votre attention, puis les chiffres de la boutique.</p></div>
      <button class="btn ghost sm" id="dashRefresh">↻ Actualiser</button>
    </div>
    <div class="todo-grid" id="todoGrid"><p>Chargement…</p></div>
    <div class="stat-grid" id="statGrid"></div>
    <div class="panel">
      <div class="panel-head"><h3>Activité</h3>
        <div class="seg" id="dashRange" role="group" aria-label="Période">
          ${[7, 30, 90].map(d => `<button type="button" data-days="${d}" class="${d === DASH_DAYS ? 'on' : ''}">${d} jours</button>`).join('')}
        </div>
      </div>
      <div id="dashChart">Chargement…</div>
    </div>
    <div class="dash-cols">
      <div class="panel"><div class="panel-head"><h3>Produits les plus commandés</h3></div><div id="topProducts">Chargement…</div></div>
      <div class="panel"><div class="panel-head"><h3>Dernières commandes</h3><button class="btn ghost sm" id="dashAllOrders">Tout voir</button></div><div id="recentOrders">Chargement…</div></div>
    </div>`;

  document.getElementById('dashRefresh').addEventListener('click', renderDashboard);
  document.getElementById('dashAllOrders').addEventListener('click', () => goToSection('orders'));
  document.querySelectorAll('#dashRange button').forEach(b => b.addEventListener('click', () => { DASH_DAYS = +b.dataset.days; renderDashboard(); }));

  const [ordersRes, prodRes, subRes, itemsRes] = await Promise.all([
    sb.from('orders').select('*').order('created_at', { ascending: false }),
    sb.from('products').select('id, status'),
    sb.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
    sb.from('order_items').select('order_id, product_name, qty, line_total')
  ]);
  const orders = ordersRes.data || [];
  const products = prodRes.data || [];
  const hasPay = orders.length ? Object.prototype.hasOwnProperty.call(orders[0], 'payment_status') : false;
  const live = orders.filter(o => o.status !== 'cancelled');

  /* ---- À traiter ---- */
  const pending = orders.filter(o => o.status === 'pending').length;
  const toShip = orders.filter(o => o.status === 'confirmed').length;
  const unpaid = hasPay ? live.filter(o => (o.payment_status || 'expected') === 'expected' && o.status !== 'pending').length : 0;
  const drafts = products.filter(p => p.status === 'draft').length;
  const tile = (n, label, hint, cls, go) => `<button type="button" class="todo ${n ? cls : 'zero'}" data-go="${go}"><span class="n">${n}</span><span class="t"><b>${label}</b><small>${hint}</small></span></button>`;
  document.getElementById('todoGrid').innerHTML = [
    tile(pending, 'À confirmer', 'Nouvelles commandes en attente', 'hot', 'orders:pending'),
    tile(toShip, 'À expédier', 'Confirmées, pas encore parties', 'warm', 'orders:confirmed'),
    hasPay ? tile(unpaid, 'Paiement à vérifier', 'Confirmées, paiement pas encore reçu', 'warm', 'orders:unpaid') : '',
    tile(drafts, 'Brouillons', 'Produits non publiés', 'calm', 'products:')
  ].join('');
  document.querySelectorAll('#todoGrid [data-go]').forEach(b => b.addEventListener('click', () => {
    const [sec, preset] = b.dataset.go.split(':');
    goToSection(sec, preset || '');
  }));

  /* ---- Chiffres : une devise à la fois, jamais de somme mêlant les devises ---- */
  const sums = { paid: {}, due: {} };
  if (hasPay) live.forEach(o => {
    if (o.payment_status === 'refunded') return;
    const bucket = o.payment_status === 'received' ? sums.paid : sums.due;
    bucket[o.currency] = (bucket[o.currency] || 0) + Number(o.total_amount || 0);
  });
  const fmtSums = o => Object.keys(o).length ? Object.entries(o).map(([c, v]) => formatMoney(v, c)).join(' + ') : '0';
  const published = products.filter(p => p.status === 'published').length;
  document.getElementById('statGrid').innerHTML = [
    ['Commandes', orders.length],
    ['Produits publiés', `${published} / ${products.length}`],
    ...(subRes.error ? [] : [['Abonnés au Carnet', subRes.count || 0]]),
    ...(hasPay ? [['Encaissé', fmtSums(sums.paid)], ['À encaisser', fmtSums(sums.due)]] : [])
  ].map(([label, n]) => `<div class="stat-card"><div class="n">${escapeHtml(n)}</div><div class="l">${escapeHtml(label)}</div></div>`).join('');

  /* ---- Activité : commandes par jour sur la période ---- */
  const days = [];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (DASH_DAYS - 1));
  for (let i = 0; i < DASH_DAYS; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
  const key = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const perDay = {}; const periodOrders = [];
  live.forEach(o => { const d = new Date(o.created_at); if (d >= start) { perDay[key(d)] = (perDay[key(d)] || 0) + 1; periodOrders.push(o); } });
  const max = Math.max(1, ...Object.values(perDay));
  const periodTotals = {};
  periodOrders.forEach(o => { periodTotals[o.currency] = (periodTotals[o.currency] || 0) + Number(o.total_amount || 0); });
  document.getElementById('dashChart').innerHTML = `
    <p class="chart-sum"><b>${periodOrders.length}</b> commande${periodOrders.length > 1 ? 's' : ''} · ${Object.keys(periodTotals).length ? Object.entries(periodTotals).map(([c, v]) => formatMoney(v, c)).join(' + ') : '0'} <small>(hors annulées)</small></p>
    <div class="bars" role="img" aria-label="Commandes par jour sur ${DASH_DAYS} jours">
      ${days.map(d => { const n = perDay[key(d)] || 0; return `<div class="bar" title="${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${n} commande${n > 1 ? 's' : ''}"><i style="height:${n ? Math.max(8, Math.round(n / max * 100)) : 3}%" class="${n ? 'on' : ''}"></i></div>`; }).join('')}
    </div>
    <div class="bars-axis"><span>${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>Aujourd’hui</span></div>`;

  /* ---- Top produits (période) ---- */
  const inPeriod = new Set(periodOrders.map(o => o.id));
  const agg = {};
  (itemsRes.data || []).forEach(it => { if (inPeriod.has(it.order_id)) { const a = agg[it.product_name] || (agg[it.product_name] = { qty: 0 }); a.qty += Number(it.qty || 0); } });
  const top = Object.entries(agg).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const topMax = top.length ? top[0][1].qty : 1;
  document.getElementById('topProducts').innerHTML = top.length ? top.map(([name, a]) => `
    <div class="rank"><span class="rank-name">${escapeHtml(name)}</span><span class="rank-bar"><i style="width:${Math.round(a.qty / topMax * 100)}%"></i></span><b>${a.qty}</b></div>`).join('')
    : '<p class="hint">Aucune commande sur cette période.</p>';

  /* ---- Dernières commandes (clic = détail) ---- */
  const rows = orders.slice(0, 6).map(o => `
    <tr class="clickable" data-open="${o.id}">
      <td>${escapeHtml(o.order_ref)}</td><td>${escapeHtml(o.customer_name)}</td>
      <td>${formatMoney(o.total_amount, o.currency)}</td>
      <td><span class="badge ${escapeHtml(o.status)}">${escapeHtml(ORDER_STATUS_LABELS[o.status] || o.status)}</span></td>
      <td>${fmtDate(o.created_at)}</td>
    </tr>`).join('') || '<tr><td colspan="5">Aucune commande.</td></tr>';
  document.getElementById('recentOrders').innerHTML = `<table><thead><tr><th>Réf</th><th>Client</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>`;
  document.querySelectorAll('#recentOrders [data-open]').forEach(tr => tr.addEventListener('click', () => openOrderDetail(tr.dataset.open)));

  updateNavBadges(orders);
}
