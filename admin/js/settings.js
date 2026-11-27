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
    <h3>Textes commerciaux (affichés sur les fiches produit)</h3>
    ${'delivery_info_fr' in data ? `
    <p class="hint">Rédigez en français : l’anglais et le wolof sont créés à l’enregistrement. Une zone vide n’est pas affichée sur le site — n’indiquez que des règles que vous appliquez réellement.</p>
    <div class="field"><label>Livraison (règles, zones, délais)</label><textarea id="setDelivery" rows="3">${escapeHtml(data.delivery_info_fr || '')}</textarea></div>
    <div class="field"><label>Échange et retour</label><textarea id="setExchange" rows="3">${escapeHtml(data.exchange_info_fr || '')}</textarea></div>
    <div class="field"><label>Guide des tailles</label><textarea id="setSizeGuide" rows="4" placeholder="Vos mesures réelles (ex : M = tour de poitrine …)">${escapeHtml(data.size_guide_fr || '')}</textarea></div>
    <div class="field"><label>Zones et frais de livraison (une zone par ligne : Nom | frais FCFA | délai)</label>
      <textarea id="setZones" rows="3" placeholder="Dakar | 2000 | 24-48 h">${escapeHtml((data.delivery_zones || []).map(z => [z.name, z.fee_fcfa, z.delay].join(' | ')).join('\n'))}</textarea>
      <p class="hint">Affichés à titre d’information sur le site ; le total de la commande reste « hors livraison » tant que les frais ne sont pas confirmés avec le client.</p></div>
    ` : '<p class="hint">Disponible après application de la migration SQL (supabase/migrations/20261127_commerce_upgrade.sql).</p>'}
    <button class="btn" id="saveSettingsBtn">Enregistrer</button>
  `;

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    const newInstructions = {};
    document.querySelectorAll('.pay-instruction').forEach(inp => { newInstructions[inp.dataset.key] = inp.value.trim(); });
    const patch = {
      whatsapp_number: document.getElementById('setWhatsapp').value.trim(),
      payment_instructions: newInstructions,
      updated_at: new Date().toISOString()
    };
    if (document.getElementById('setDelivery')) {
      for (const [key, id] of [['delivery_info', 'setDelivery'], ['exchange_info', 'setExchange'], ['size_guide', 'setSizeGuide']]) {
        const fr = document.getElementById(id).value.trim();
        const [en, wo] = await Promise.all([
          resolveTranslation(fr, 'en', data[key + '_en'], data[key + '_fr'], data[key + '_en']),
          resolveTranslation(fr, 'wo', data[key + '_wo'], data[key + '_fr'], data[key + '_wo'])
        ]);
        patch[key + '_fr'] = fr || null; patch[key + '_en'] = fr ? en : null; patch[key + '_wo'] = fr ? wo : null;
      }
      patch.delivery_zones = document.getElementById('setZones').value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(a => a[0])
        .map(a => ({ name: a[0], fee_fcfa: Number(String(a[1] || '').replace(/\s/g, '')) || null, delay: a[2] || '' }));
    }
    const { error } = await sb.from('settings').update(patch).eq('id', 1);
    btn.disabled = false;
    if (error) toast('Erreur: ' + error.message, true);
    else toast('Paramètres enregistrés.');
  });
}
