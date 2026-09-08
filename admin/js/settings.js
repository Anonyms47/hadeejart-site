/* ======================================================================
   Hadeej'Art Admin — Paramètres (WhatsApp, instructions de paiement)
   ====================================================================== */

const PAYMENT_METHODS_ADMIN = [
  { key: 'wave', label: 'Wave' },
  { key: 'orange_money', label: 'Orange Money' },
  { key: 'sendwave', label: 'Sendwave' },
  { key: 'taptap_send', label: 'TapTap Send' }
];

async function renderSettings() {
  const el = document.getElementById('section-settings');
  el.innerHTML = `<h2>Paramètres</h2><p class="subtitle">Numéro WhatsApp et instructions affichées pour chaque moyen de paiement.</p><div class="panel" id="settingsPanel">Chargement…</div>`;

  const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
  const host = document.getElementById('settingsPanel');
  if (error) { host.innerHTML = 'Erreur: ' + escapeHtml(error.message); return; }

  const instructions = data.payment_instructions || {};
  host.innerHTML = `
    <div class="field"><label>Numéro WhatsApp (sans le +)</label><input id="setWhatsapp" value="${escapeHtml(data.whatsapp_number)}"></div>
    <h3>Instructions de paiement</h3>
    ${PAYMENT_METHODS_ADMIN.map(m => `
      <div class="field"><label>${escapeHtml(m.label)}</label>
        <input class="pay-instruction" data-key="${m.key}" value="${escapeHtml(instructions[m.key] || '')}" placeholder="ex: Envoyer à 77 xxx xx xx puis indiquer la réf.">
      </div>`).join('')}
    <button class="btn" id="saveSettingsBtn">Enregistrer</button>
  `;

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    const newInstructions = {};
    document.querySelectorAll('.pay-instruction').forEach(inp => { newInstructions[inp.dataset.key] = inp.value.trim(); });
    const { error } = await sb.from('settings').update({
      whatsapp_number: document.getElementById('setWhatsapp').value.trim(),
      payment_instructions: newInstructions,
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    btn.disabled = false;
    if (error) toast('Erreur: ' + error.message, true);
    else toast('Paramètres enregistrés.');
  });
}
