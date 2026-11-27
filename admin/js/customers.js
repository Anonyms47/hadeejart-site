/* ======================================================================
   Hadeej'Art Admin — Clients (agrégés depuis les commandes)
   ====================================================================== */

async function renderCustomers() {
  const el = document.getElementById('section-customers');
  el.innerHTML = `<div class="page-head"><div><h2>Clients</h2><p class="subtitle">Vue agrégée à partir des commandes (hors annulées). Cliquez sur WhatsApp pour leur écrire.</p></div></div>
    <div class="panel">
      <div class="panel-head"><h3 id="custCount">Clients</h3>
        <div><input id="custSearch" type="search" placeholder="Rechercher (nom, téléphone, ville)" aria-label="Rechercher un client">
        <button class="btn sm" id="custExport">⬇ Exporter (CSV)</button></div></div>
      <div id="customersPanel"><span class="skel-lines"><i></i><i></i><i></i></span></div></div>`;

  const { data, error } = await sb.from('orders').select('customer_name, customer_phone, customer_email, city, country, total_amount, currency, created_at, status');
  const host = document.getElementById('customersPanel');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  const byKey = {};
  (data || []).filter(o => o.status !== 'cancelled').forEach(o => {
    const key = String(o.customer_phone || '').replace(/\D/g, '') || o.customer_name;
    if (!byKey[key]) byKey[key] = { name: o.customer_name, phone: o.customer_phone, email: o.customer_email, city: o.city, country: o.country, orders: 0, totals: {}, lastOrder: o.created_at };
    const c = byKey[key];
    c.orders++;
    c.totals[o.currency] = (c.totals[o.currency] || 0) + Number(o.total_amount || 0);
    if (o.created_at > c.lastOrder) { c.lastOrder = o.created_at; c.name = o.customer_name; c.email = o.customer_email || c.email; }
  });
  const all = Object.values(byKey).sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
  let view = all;
  const spent = c => Object.entries(c.totals).map(([cur, n]) => formatMoney(n, cur)).join(' + ');

  function draw() {
    const term = document.getElementById('custSearch').value;
    view = all.filter(c => matchesTerm(term, [c.name, c.phone, c.email, c.city, c.country]));
    document.getElementById('custCount').textContent = `${view.length} client${view.length > 1 ? 's' : ''}` + (view.length !== all.length ? ` sur ${all.length}` : '') + ` · ${all.filter(c => c.orders > 1).length} fidèle${all.filter(c => c.orders > 1).length > 1 ? 's' : ''}`;
    host.innerHTML = `<table><thead><tr><th>Nom</th><th>Téléphone</th><th>Ville</th><th>Commandes</th><th>Total dépensé</th><th>Dernière commande</th><th></th></tr></thead>
      <tbody>${view.map(c => {
        const wa = waLink(c.phone, 'Bonjour ' + (c.name || '') + ', ici Hadeej’Art 🧵');
        return `<tr>
          <td>${escapeHtml(c.name)}${c.orders > 1 ? ' <span class="badge delivered">Fidèle</span>' : ''}</td>
          <td>${escapeHtml(c.phone || '—')}</td>
          <td>${escapeHtml([c.city, c.country].filter(Boolean).join(', ') || '—')}</td>
          <td>${c.orders}</td><td>${spent(c)}</td><td>${fmtDate(c.lastOrder)}</td>
          <td class="row-actions">${wa ? `<a class="btn ghost sm" href="${escapeHtml(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</td>
        </tr>`; }).join('') || '<tr><td colspan="7">Aucun client.</td></tr>'}</tbody></table>`;
  }
  document.getElementById('custSearch').addEventListener('input', debounce(draw, 200));
  document.getElementById('custExport').addEventListener('click', () => {
    downloadCsv(`clients-${todayStamp()}.csv`, [['Nom', 'Téléphone', 'E-mail', 'Ville', 'Pays', 'Commandes', 'Total dépensé', 'Dernière commande']]
      .concat(view.map(c => [c.name, c.phone || '', c.email || '', c.city || '', c.country || '', c.orders, spent(c), (c.lastOrder || '').slice(0, 10)])));
  });
  draw();
}
