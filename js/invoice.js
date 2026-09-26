/* ======================================================================
   Hadeej'Art — Facture (canvas -> image PNG téléchargeable)
   Mise en page « maison de couture » : bandeau sombre avec le logo, lisière
   tissée, cartes client / livraison, tableau des articles avec vignettes,
   total en évidence et pied de page chaleureux. La hauteur s'adapte au
   nombre d'articles. Tout le texte suit la langue du site.
   ====================================================================== */

let CANVAS, INV, NAT_W, NAT_H;

const INV_COLORS = {
  ink: '#2b1c10', dark: '#1d1208', brown: '#9e5317', brand: '#d47a2c', safran: '#F2B90C',
  cream: '#FFF7F1', sand: '#F6D7C4', rose: '#FFF1E4', terracotta: '#B43D2A', dim: '#7a624f', line: '#EAD5C3'
};
const INV_FONT = {
  display: '"Kenia", "Fraunces", Georgia, serif',
  serif: '"Fraunces", Georgia, serif',
  sans: '"DM Sans", system-ui, sans-serif'
};

function initInvoiceCanvas() {
  CANVAS = document.getElementById('inv');
  INV = CANVAS.getContext('2d');
  NAT_W = CANVAS.width;
  NAT_H = CANVAS.height;
}

/* ---------- Primitives de dessin ---------- */
function invRR(x, y, w, h, r) {
  INV.beginPath();
  INV.moveTo(x + r, y);
  INV.arcTo(x + w, y, x + w, y + h, r);
  INV.arcTo(x + w, y + h, x, y + h, r);
  INV.arcTo(x, y + h, x, y, r);
  INV.arcTo(x, y, x + w, y, r);
  INV.closePath();
}
function invText(str, x, y, o = {}) {
  INV.font = `${o.style || ''} ${o.weight || 500} ${o.size || 24}px ${o.family || INV_FONT.sans}`.trim();
  INV.fillStyle = o.color || INV_COLORS.ink;
  INV.textAlign = o.align || 'left';
  INV.textBaseline = 'alphabetic';
  try { INV.letterSpacing = o.spacing || '0px'; } catch (e) { /* non supporté : ignoré */ }
  INV.fillText(str, x, y);
  try { INV.letterSpacing = '0px'; } catch (e) {}
}
/* Découpe un texte en lignes qui tiennent dans maxW (au plus maxLines, avec …) */
function invWrap(str, maxW, o = {}, maxLines = 99) {
  INV.font = `${o.style || ''} ${o.weight || 500} ${o.size || 24}px ${o.family || INV_FONT.sans}`.trim();
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (INV.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && INV.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}
function invShadow(blur, color = 'rgba(80,40,10,.18)', dy = 6) {
  INV.shadowColor = color; INV.shadowBlur = blur; INV.shadowOffsetY = dy;
}
function invNoShadow() { INV.shadowColor = 'transparent'; INV.shadowBlur = 0; INV.shadowOffsetY = 0; }

/* Lisière tissée (même langage que les bandes du site) */
function invWeave(y, h) {
  const cols = [INV_COLORS.brown, INV_COLORS.brand, '#f1b37f'];
  const step = 44;
  for (let x = 0, i = 0; x < NAT_W; x += step, i++) {
    INV.fillStyle = cols[i % 3];
    INV.fillRect(x, y, step, h);
  }
  INV.fillStyle = 'rgba(255,255,255,.55)';
  for (let x = step / 2; x < NAT_W; x += step * 2) {
    INV.beginPath(); INV.arc(x, y + h / 2, h * 0.18, 0, Math.PI * 2); INV.fill();
  }
}

function invLoadImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    try {
      if (/^https?:/i.test(src) && new URL(src, location.href).origin !== location.origin) img.crossOrigin = 'anonymous';
    } catch (e) { /* URL invalide : chargement tenté tel quel */ }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function invCover(img, x, y, w, h, r) {
  INV.save();
  invRR(x, y, w, h, r); INV.clip();
  const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
  const s = Math.max(w / iw, h / ih);
  INV.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  INV.restore();
}

function invFormatPhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  return d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : (d ? '+' + d : '');
}

/* ---------- Construction ----------
   Format A4 à 150 dpi (1240 × 1754 px), lisible d'un coup d'œil, même sur
   un écran de téléphone : corps de texte à 28-32 px, titres à 24 px en
   capitales espacées, montants à 32-64 px. Si la commande compte tant
   d'articles qu'ils ne tiennent plus sur une page, la page s'allonge. */
const INV_A4_W = 1240, INV_A4_H = 1754;

/* Consigne de paiement rédigée par la boutique (admin, table settings) pour le
   moyen choisi ; chaîne vide si absente ou si le réseau ne répond pas. */
async function invPaymentInstruction(method) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=payment_instructions&id=eq.1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }, signal: ctl.signal
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const rows = await res.json();
    const ins = rows && rows[0] && rows[0].payment_instructions;
    return (ins && ins[method] ? String(ins[method]) : '').trim();
  } catch (e) { return ''; }
}

async function buildInvoiceImage() {
  /* Le canvas ne déclenche pas le chargement des polices web : on les charge
     explicitement (toutes graisses utilisées) avant de dessiner. */
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('400 24px "DM Sans"'), document.fonts.load('600 24px "DM Sans"'), document.fonts.load('700 24px "DM Sans"'), document.fonts.load('800 24px "DM Sans"'),
        document.fonts.load('700 24px "Fraunces"'), document.fonts.load('italic 400 24px "Fraunces"'), document.fonts.load('400 24px "Kenia"')
      ]);
    }
  } catch (e) { /* repli : polices de secours */ }

  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  const name = val('cName'), phone = val('cPhone'), email = val('cEmail');
  const place = [val('cDistrict'), val('cCity'), val('cCountry')].filter(Boolean).join(', ');
  const loc = (typeof getDeliveryLocation === 'function') ? getDeliveryLocation() : {};
  const payValue = val('cPay');
  const pay = (typeof PAYMENT_LABELS !== 'undefined' && PAYMENT_LABELS[payValue]) || payValue || '';
  const orderId = window.LAST_INVOICE_ID || ('HA-' + Math.random().toString(36).slice(2, 8).toUpperCase());
  window.LAST_INVOICE_ID = orderId;
  const totalsText = formatCartTotals();
  window.LAST_INVOICE_TOTAL = totalsText;
  const locale = CURRENT_LANG === 'en' ? 'en-GB' : 'fr-FR';
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const [logo, instruction, ...thumbs] = await Promise.all([
    invLoadImage('images/logo.png'), invPaymentInstruction(payValue), ...CART.map(l => invLoadImage(l.img))
  ]);

  const W = INV_A4_W, M = 64, CW = W - M * 2;
  const F = INV_FONT;

  /* --- Mesures : on dessine d'abord sur un canvas de mesure --- */
  CANVAS.width = W; CANVAS.height = 400;
  INV = CANVAS.getContext('2d');
  const cardW = (CW - 32) / 2;
  const innerW = cardW - 76;

  const nameLines = invWrap(name || t('dash'), innerW, { family: F.serif, weight: 700, size: 42 }, 2);
  const phoneStr = phone || t('dash');
  const emailLines = email ? invWrap(email, innerW, { size: 28, weight: 500 }, 2) : [];
  const leftH = 104 + nameLines.length * 52 + 46 + emailLines.length * 38 + 26;

  const placeLines = invWrap(place || t('dash'), innerW, { size: 32, weight: 700 }, 2);
  const addrLines = invWrap(loc.address || (loc.lat != null ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ''), innerW, { size: 26, weight: 500 }, 3);
  const noteLines = loc.note ? invWrap(t('invoice_note') + ' ' + loc.note, innerW, { size: 26, weight: 600, style: 'italic' }, 2) : [];
  const rightH = 104 + placeLines.length * 42 + addrLines.length * 34 + noteLines.length * 34 + 96;
  const cardH = Math.max(leftH, rightH, 280);

  const HEADER_H = 316;
  const infoY = HEADER_H + 24 + 40;
  const tableY = infoY + cardH + 44;
  const TABLE_HEAD = 84, FOOT_H = 250, TOTALS_H = 250;
  const footerTop0 = INV_A4_H - FOOT_H;
  /* Hauteur de ligne : tout tient sur l'A4 tant que possible (max 126 px). */
  const availRows = footerTop0 - 36 - TOTALS_H - 30 - (tableY + TABLE_HEAD);
  const ROW_H = Math.max(96, Math.min(126, Math.floor(availRows / Math.max(CART.length, 1))));
  const itemsH = CART.length * ROW_H;
  const totalsY = tableY + TABLE_HEAD + itemsH + 36;
  const H = Math.max(INV_A4_H, totalsY + TOTALS_H + 30 + FOOT_H);

  CANVAS.width = W; CANVAS.height = H;
  INV = CANVAS.getContext('2d');
  NAT_W = W; NAT_H = H;
  INV.textBaseline = 'alphabetic';

  /* --- Fond papier + trame de points --- */
  INV.fillStyle = INV_COLORS.cream; INV.fillRect(0, 0, W, H);
  INV.fillStyle = 'rgba(158,83,23,.055)';
  for (let y = 30; y < H; y += 42) for (let x = ((y / 42) % 2) * 21 + 20; x < W; x += 42) { INV.beginPath(); INV.arc(x, y, 2.2, 0, Math.PI * 2); INV.fill(); }

  /* --- Bandeau sombre --- */
  const g = INV.createLinearGradient(0, 0, W, HEADER_H);
  g.addColorStop(0, '#2b1c10'); g.addColorStop(1, '#170e06');
  INV.fillStyle = g; INV.fillRect(0, 0, W, HEADER_H);
  INV.save(); INV.globalAlpha = .07; INV.strokeStyle = '#f5e8d8'; INV.lineWidth = 6;
  for (let x = -HEADER_H; x < W + HEADER_H; x += 26) { INV.beginPath(); INV.moveTo(x, HEADER_H); INV.lineTo(x + HEADER_H, 0); INV.stroke(); }
  INV.restore();
  invWeave(HEADER_H, 24);

  const lx = M + 74, ly = 150;
  INV.fillStyle = INV_COLORS.safran; INV.beginPath(); INV.arc(lx, ly, 82, 0, Math.PI * 2); INV.fill();
  INV.fillStyle = '#fff'; INV.beginPath(); INV.arc(lx, ly, 74, 0, Math.PI * 2); INV.fill();
  if (logo) { INV.save(); INV.beginPath(); INV.arc(lx, ly, 72, 0, Math.PI * 2); INV.clip(); INV.drawImage(logo, lx - 72, ly - 72, 144, 144); INV.restore(); }
  else invText('H', lx, ly + 24, { family: F.display, size: 68, color: INV_COLORS.brown, align: 'center' });

  invText('Hadeej’Art', lx + 116, ly - 4, { family: F.display, size: 76, color: '#f5e8d8' });
  invText(t('footer_tagline'), lx + 118, ly + 50, { family: F.serif, style: 'italic', weight: 400, size: 34, color: INV_COLORS.safran });
  invText('Dakar · Sénégal', lx + 118, ly + 96, { weight: 600, size: 24, color: 'rgba(245,232,216,.7)', spacing: '3px' });

  invText(t('invoice_title'), W - M, 118, { family: F.display, size: 88, color: INV_COLORS.safran, align: 'right' });
  invText(t('invoice_number_label').toUpperCase(), W - M, 168, { weight: 700, size: 22, color: 'rgba(245,232,216,.7)', align: 'right', spacing: '3px' });
  invText(orderId, W - M, 218, { weight: 800, size: 48, color: '#fff', align: 'right', spacing: '1px' });
  invText(`${dateStr} · ${timeStr}`, W - M, 262, { weight: 500, size: 26, color: 'rgba(245,232,216,.8)', align: 'right' });

  /* --- Cartes client / livraison --- */
  const drawCard = (x, title) => {
    INV.save(); invShadow(28); INV.fillStyle = '#fff'; invRR(x, infoY, cardW, cardH, 26); INV.fill(); INV.restore();
    INV.fillStyle = INV_COLORS.safran; invRR(x, infoY + 28, 10, cardH - 56, 5); INV.fill();
    invText(title.toUpperCase(), x + 40, infoY + 56, { weight: 800, size: 24, color: INV_COLORS.brown, spacing: '3px' });
    INV.strokeStyle = INV_COLORS.line; INV.lineWidth = 2; INV.setLineDash([8, 8]);
    INV.beginPath(); INV.moveTo(x + 40, infoY + 76); INV.lineTo(x + cardW - 36, infoY + 76); INV.stroke(); INV.setLineDash([]);
  };
  drawCard(M, t('invoice_client_details'));
  let cy = infoY + 134;
  nameLines.forEach(s => { invText(s, M + 40, cy, { family: F.serif, weight: 700, size: 42 }); cy += 52; });
  cy += -2;
  invText(phoneStr, M + 40, cy, { size: 34, weight: 700 }); cy += 46;
  emailLines.forEach(s => { invText(s, M + 40, cy, { size: 28, weight: 500, color: INV_COLORS.dim }); cy += 38; });

  const rx = M + cardW + 32;
  drawCard(rx, t('invoice_delivery_details'));
  cy = infoY + 128;
  placeLines.forEach(s => { invText(s, rx + 40, cy, { size: 32, weight: 700 }); cy += 42; });
  cy += 2;
  addrLines.forEach(s => { invText(s, rx + 40, cy, { size: 26, weight: 500, color: INV_COLORS.dim }); cy += 34; });
  noteLines.forEach(s => { invText(s, rx + 40, cy, { size: 26, weight: 600, style: 'italic', color: INV_COLORS.brown }); cy += 34; });
  if (pay) {
    const py = infoY + cardH - 78;
    const label = t('invoice_payment');
    INV.font = `600 26px ${F.sans}`;
    const lw = INV.measureText(label).width + 18;
    invText(label, rx + 40, py + 34, { weight: 600, size: 26, color: INV_COLORS.dim });
    INV.font = `800 28px ${F.sans}`;
    const pw = INV.measureText(pay).width + 60, px = rx + 40 + lw;
    const pg = INV.createLinearGradient(px, py, px + pw, py);
    pg.addColorStop(0, INV_COLORS.brand); pg.addColorStop(1, INV_COLORS.brown);
    INV.fillStyle = pg; invRR(px, py, pw, 50, 25); INV.fill();
    invText(pay, px + pw / 2, py + 35, { weight: 800, size: 28, color: '#fff', align: 'center' });
  }

  /* --- Tableau des articles --- */
  const colQty = M + CW - 330, colTot = M + CW - 28;
  INV.save(); invShadow(20); INV.fillStyle = '#fff'; invRR(M, tableY, CW, TABLE_HEAD + itemsH + 8, 26); INV.fill(); INV.restore();
  INV.fillStyle = INV_COLORS.ink; invRR(M, tableY, CW, TABLE_HEAD, 26); INV.fill();
  INV.fillRect(M, tableY + 44, CW, TABLE_HEAD - 44);
  const th = { weight: 800, size: 22, color: INV_COLORS.safran, spacing: '3px' };
  invText(t('invoice_col_item').toUpperCase(), M + 36, tableY + 52, th);
  invText(t('invoice_col_qty').toUpperCase(), colQty, tableY + 52, { ...th, align: 'center' });
  invText(t('invoice_col_total').toUpperCase(), colTot, tableY + 52, { ...th, align: 'right' });

  CART.forEach((it, i) => {
    const ry = tableY + TABLE_HEAD + i * ROW_H;
    if (i % 2 === 1) { INV.fillStyle = INV_COLORS.rose; INV.fillRect(M, ry, CW, ROW_H); }
    if (i > 0) { INV.strokeStyle = INV_COLORS.line; INV.lineWidth = 1.5; INV.beginPath(); INV.moveTo(M + 24, ry); INV.lineTo(M + CW - 24, ry); INV.stroke(); }
    const th2 = ROW_H - 24, tw = Math.round(th2 * 0.78), tx = M + 30, ty = ry + 12;
    if (thumbs[i]) invCover(thumbs[i], tx, ty, tw, th2, 12);
    else { INV.fillStyle = INV_COLORS.sand; invRR(tx, ty, tw, th2, 12); INV.fill(); invText('H', tx + tw / 2, ty + th2 / 2 + 14, { family: F.display, size: 40, color: INV_COLORS.brown, align: 'center' }); }
    const nx = tx + tw + 26, nmax = colQty - 70 - nx;
    const nameL = invWrap(it.name, nmax, { family: F.serif, weight: 700, size: 32 }, 2);
    const bits = [];
    if (it.size) bits.push(it.size);
    if (it.color) bits.push(it.color);
    if (it.tissu) bits.push(it.tissu);
    if (it.optionKimono) bits.push(variantChoiceLabel(it.id, it.optionKimono));
    const detL = bits.length ? invWrap(bits.join('  ·  '), nmax, { size: 25, weight: 600 }, nameL.length === 1 ? 2 : 1) : [];
    const blockH = nameL.length * 38 + detL.length * 32;
    let by = ry + (ROW_H - blockH) / 2 + 29;
    nameL.forEach(s => { invText(s, nx, by, { family: F.serif, weight: 700, size: 32 }); by += 38; });
    detL.forEach(s => { invText(s, nx, by - 2, { size: 25, weight: 600, color: INV_COLORS.dim }); by += 32; });
    INV.fillStyle = INV_COLORS.sand; invRR(colQty - 38, ry + ROW_H / 2 - 25, 76, 50, 25); INV.fill();
    invText('×' + it.qty, colQty, ry + ROW_H / 2 + 10, { weight: 800, size: 30, color: INV_COLORS.brown, align: 'center' });
    /* Montant de la ligne, et prix unitaire en dessous dès 2 exemplaires */
    const hasUnit = it.qty > 1;
    invText(formatMoney(it.price * it.qty, it.currency), colTot, ry + ROW_H / 2 + (hasUnit ? 2 : 10), { weight: 800, size: 30, align: 'right' });
    if (hasUnit) invText(formatMoney(it.price, it.currency) + ' / ' + t('cart_unit'), colTot, ry + ROW_H / 2 + 34, { size: 22, weight: 500, color: INV_COLORS.dim, align: 'right' });
  });

  /* --- Totaux (à droite) et consignes de paiement (à gauche) --- */
  const tw2 = 600, tx2 = M + CW - tw2;
  invText(t('subtotal'), tx2 + 30, totalsY + 38, { size: 28, weight: 600, color: INV_COLORS.dim });
  invText(totalsText, tx2 + tw2 - 30, totalsY + 38, { size: 30, weight: 800, align: 'right' });
  INV.save(); invShadow(30, 'rgba(143,47,10,.35)', 10);
  const tg = INV.createLinearGradient(tx2, totalsY + 70, tx2 + tw2, totalsY + 70 + 140);
  tg.addColorStop(0, INV_COLORS.terracotta); tg.addColorStop(1, '#8F2F0A');
  INV.fillStyle = tg; invRR(tx2, totalsY + 70, tw2, 140, 28); INV.fill(); INV.restore();
  invText(t('invoice_total'), tx2 + 36, totalsY + 152, { weight: 800, size: 30, color: 'rgba(255,255,255,.88)', spacing: '4px' });
  INV.font = `800 60px ${F.serif}`;
  const totalSize = INV.measureText(totalsText).width > tw2 - 250 ? 40 : 60;
  invText(totalsText, tx2 + tw2 - 36, totalsY + 158, { family: F.serif, weight: 800, size: totalSize, color: '#fff', align: 'right' });

  const noteX = M, noteW = tx2 - M - 40, noteY = totalsY + 6, noteH = TOTALS_H - 36;
  INV.strokeStyle = INV_COLORS.brand; INV.lineWidth = 3; INV.setLineDash([10, 9]); invRR(noteX, noteY, noteW, noteH, 24); INV.stroke(); INV.setLineDash([]);
  invText(t('invoice_how_to_pay').toUpperCase(), noteX + 34, noteY + 52, { weight: 800, size: 24, color: INV_COLORS.brown, spacing: '3px' });
  const guide = (instruction ? instruction + ' ' : '') + t('invoice_wa_note');
  invWrap(guide, noteW - 68, { size: 26, weight: 500 }, 5).forEach((s, i) => invText(s, noteX + 34, noteY + 96 + i * 36, { size: 26, weight: 500 }));

  /* --- Pied de page --- */
  const fy = H - FOOT_H;
  invWeave(fy, 20);
  invText(t('invoice_thanks_title'), W / 2, fy + 92, { family: F.serif, style: 'italic', weight: 600, size: 52, color: INV_COLORS.brown, align: 'center' });
  invText('WhatsApp ' + invFormatPhone(SITE_WA_NUMBER) + '   ·   hadeejart.store', W / 2, fy + 148, { weight: 800, size: 34, align: 'center' });
  invText(t('invoice_returns_note'), W / 2, fy + 190, { size: 23, weight: 500, color: INV_COLORS.dim, align: 'center' });
  invWeave(H - 30, 30);
}

function invoiceBlob() {
  return new Promise(resolve => CANVAS.toBlob(b => resolve(b), 'image/png', 1));
}

/* Télécharge la facture (fichier PNG). Le blob est conservé pour permettre un
   second téléchargement depuis l'écran de confirmation. */
async function downloadInvoice() {
  let blob = window.LAST_INVOICE_BLOB;
  if (!blob) { blob = await invoiceBlob(); window.LAST_INVOICE_BLOB = blob; }
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Facture-${window.LAST_INVOICE_ID || 'Hadeej-Art'}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return true;
}
