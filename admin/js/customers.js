/* ======================================================================
   Hadeej'Art Admin — Clients (agrégés depuis les commandes)
   ====================================================================== */

async function renderCustomers() {
  const el = document.getElementById('section-customers');
  el.innerHTML = `<h2>Clients</h2><p class="subtitle">Vue agrégée à partir des commandes passées.</p><div class="panel" id="customersPanel">Chargement…</div>`;

  const { data, error } = await sb.from('orders').select('customer_name, customer_phone, customer_email, city, country, total_amount, currency, created_at');
  const host = document.getElementById('customersPanel');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  const byPhone = {};
  (data || []).forEach(o => {
    const key = o.customer_phone || o.customer_name;
    if (!byPhone[key]) byPhone[key] = { name: o.customer_name, phone: o.customer_phone, email: o.customer_email, city: o.city, country: o.country, orders: 0, totals: {}, lastOrder: o.created_at };
    const c = byPhone[key];
    c.orders++;
    c.totals[o.currency] = (c.totals[o.currency] || 0) + Number(o.total_amount || 0);
    if (o.created_at > c.lastOrder) c.lastOrder = o.created_at;
  });
  const rows = Object.values(byPhone).sort((a, b) => b.orders - a.orders);

  host.innerHTML = `<table><thead><tr><th>Nom</th><th>Téléphone</th><th>Ville</th><th>Commandes</th><th>Total dépensé</th><th>Dernière commande</th></tr></thead>
    <tbody>${rows.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone || '—')}</td>
        <td>${escapeHtml([c.city, c.country].filter(Boolean).join(', ') || '—')}</td>
        <td>${c.orders}</td>
        <td>${Object.entries(c.totals).map(([cur, n]) => formatMoney(n, cur)).join(' + ')}</td>
        <td>${fmtDate(c.lastOrder)}</td>
      </tr>`).join('') || '<tr><td colspan="6">Aucun client pour le moment.</td></tr>'}</tbody></table>`;
}
