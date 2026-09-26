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

/* ---------- Construction ---------- */
async function buildInvoiceImage() {
  /* Le canvas ne déclenche pas le chargement des polices web : on les charge
     explicitement (toutes graisses utilisées) avant de dessiner. */
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('400 24px "DM Sans"'), document.fonts.load('700 24px "DM Sans"'), document.fonts.load('800 24px "DM Sans"'),
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
  const dateStr = now.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' +
    now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const [logo, ...thumbs] = await Promise.all([invLoadImage('images/logo.png'), ...CART.map(l => invLoadImage(l.img))]);

  const W = 1240, M = 70, CW = W - M * 2;
  const ROW_H = 118;

  /* --- Mesures (pour adapter la hauteur) --- */
  CANVAS.width = W; CANVAS.height = 400; /* contexte de mesure */
  INV = CANVAS.getContext('2d');
  const cardW = (CW - 30) / 2;
  const leftLines = [
    { t: name || t('dash'), o: { family: INV_FONT.serif, weight: 700, size: 34, color: INV_COLORS.ink }, gap: 46 },
    { t: phone, o: { size: 26, weight: 600 }, gap: 38 },
    ...(email ? [{ t: email, o: { size: 24, weight: 500, color: INV_COLORS.dim }, gap: 36 }] : [])
  ];
  const addrLines = invWrap(loc.address || (loc.lat != null ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ''), cardW - 70, { size: 22, weight: 500 }, 3);
  const noteLines = loc.note ? invWrap(t('invoice_note') + ' ' + loc.note, cardW - 70, { size: 22, weight: 500, style: 'italic' }, 2) : [];
  const placeLines = invWrap(place || t('dash'), cardW - 70, { size: 26, weight: 600 }, 2);
  const leftH = 92 + leftLines.reduce((s, l) => s + l.gap, 0) + 14;
  const rightH = 92 + placeLines.length * 34 + addrLines.length * 30 + noteLines.length * 30 + 84;
  const cardH = Math.max(leftH, rightH, 250);

  const itemsH = CART.length * ROW_H;
  const HEADER_H = 320;
  const infoY = HEADER_H + 60;
  const tableY = infoY + cardH + 60;
  const totalsY = tableY + 76 + itemsH + 44;
  const footerY = totalsY + 250;
  const H = Math.max(1754, footerY + 300);

  CANVAS.width = W; CANVAS.height = H;
  INV = CANVAS.getContext('2d');
  NAT_W = W; NAT_H = H;
  INV.textBaseline = 'alphabetic';

  /* --- Fond papier + trame de points --- */
  INV.fillStyle = INV_COLORS.cream; INV.fillRect(0, 0, W, H);
  INV.fillStyle = 'rgba(158,83,23,.06)';
  for (let y = 30; y < H; y += 42) for (let x = ((y / 42) % 2) * 21 + 20; x < W; x += 42) { INV.beginPath(); INV.arc(x, y, 2.2, 0, Math.PI * 2); INV.fill(); }

  /* --- Bandeau sombre --- */
  const g = INV.createLinearGradient(0, 0, W, HEADER_H);
  g.addColorStop(0, '#2b1c10'); g.addColorStop(1, '#170e06');
  INV.fillStyle = g; INV.fillRect(0, 0, W, HEADER_H);
  INV.save(); INV.globalAlpha = .07; INV.strokeStyle = '#f5e8d8'; INV.lineWidth = 6;
  for (let x = -HEADER_H; x < W + HEADER_H; x += 26) { INV.beginPath(); INV.moveTo(x, HEADER_H); INV.lineTo(x + HEADER_H, 0); INV.stroke(); }
  INV.restore();
  invWeave(HEADER_H, 24);

  /* Logo dans un médaillon */
  const lx = M + 70, ly = 150;
  INV.fillStyle = INV_COLORS.safran; INV.beginPath(); INV.arc(lx, ly, 78, 0, Math.PI * 2); INV.fill();
  INV.fillStyle = '#fff'; INV.beginPath(); INV.arc(lx, ly, 70, 0, Math.PI * 2); INV.fill();
  if (logo) { INV.save(); INV.beginPath(); INV.arc(lx, ly, 68, 0, Math.PI * 2); INV.clip(); INV.drawImage(logo, lx - 68, ly - 68, 136, 136); INV.restore(); }
  else invText('H', lx, ly + 22, { family: INV_FONT.display, size: 64, color: INV_COLORS.brown, align: 'center' });

  invText('Hadeej’Art', lx + 110, ly - 6, { family: INV_FONT.display, size: 68, color: '#f5e8d8' });
  invText(t('footer_tagline'), lx + 112, ly + 44, { family: INV_FONT.serif, style: 'italic', weight: 400, size: 30, color: INV_COLORS.safran });

  invText(t('invoice_title'), W - M, 128, { family: INV_FONT.display, size: 74, color: INV_COLORS.safran, align: 'right' });
  invText(orderId, W - M, 182, { weight: 800, size: 38, color: '#fff', align: 'right', spacing: '1px' });
  invText(dateStr, W - M, 226, { weight: 500, size: 24, color: 'rgba(245,232,216,.75)', align: 'right' });

  /* --- Cartes client / livraison --- */
  const drawCard = (x, title) => {
    INV.save(); invShadow(28); INV.fillStyle = '#fff'; invRR(x, infoY, cardW, cardH, 24); INV.fill(); INV.restore();
    INV.fillStyle = INV_COLORS.safran; invRR(x, infoY + 26, 9, cardH - 52, 5); INV.fill();
    invText(title.toUpperCase(), x + 40, infoY + 54, { weight: 800, size: 20, color: INV_COLORS.brown, spacing: '3px' });
    INV.strokeStyle = INV_COLORS.line; INV.lineWidth = 2; INV.setLineDash([8, 8]);
    INV.beginPath(); INV.moveTo(x + 40, infoY + 72); INV.lineTo(x + cardW - 34, infoY + 72); INV.stroke(); INV.setLineDash([]);
  };
  drawCard(M, t('invoice_client_details'));
  let cy = infoY + 118;
  leftLines.forEach(l => { invText(l.t, M + 40, cy, l.o); cy += l.gap; });

  const rx = M + cardW + 30;
  drawCard(rx, t('invoice_delivery_details'));
  cy = infoY + 116;
  placeLines.forEach(s => { invText(s, rx + 40, cy, { size: 26, weight: 600 }); cy += 34; });
  cy += 4;
  addrLines.forEach(s => { invText(s, rx + 40, cy, { size: 22, weight: 500, color: INV_COLORS.dim }); cy += 30; });
  noteLines.forEach(s => { invText(s, rx + 40, cy, { size: 22, weight: 500, style: 'italic', color: INV_COLORS.brown }); cy += 30; });
  /* Pastille du moyen de paiement */
  if (pay) {
    const py = infoY + cardH - 74;
    const label = t('invoice_payment');
    INV.font = `600 22px ${INV_FONT.sans}`;
    const lw = INV.measureText(label).width + 16;
    invText(label, rx + 40, py + 31, { weight: 600, size: 22, color: INV_COLORS.dim });
    INV.font = `800 24px ${INV_FONT.sans}`;
    const pw = INV.measureText(pay).width + 52, px = rx + 40 + lw;
    const pg = INV.createLinearGradient(px, py, px + pw, py);
    pg.addColorStop(0, INV_COLORS.brand); pg.addColorStop(1, INV_COLORS.brown);
    INV.fillStyle = pg; invRR(px, py, pw, 46, 23); INV.fill();
    invText(pay, px + pw / 2, py + 31, { weight: 800, size: 24, color: '#fff', align: 'center' });
  }

  /* --- Tableau des articles --- */
  const colQty = M + CW - 420, colUnit = M + CW - 236, colTot = M + CW - 26;
  INV.save(); invShadow(20); INV.fillStyle = '#fff'; invRR(M, tableY, CW, 76 + itemsH + 6, 24); INV.fill(); INV.restore();
  INV.fillStyle = INV_COLORS.ink; invRR(M, tableY, CW, 76, 24); INV.fill();
  INV.fillRect(M, tableY + 40, CW, 36);
  const th = { weight: 800, size: 20, color: INV_COLORS.safran, spacing: '3px' };
  invText(t('invoice_col_item').toUpperCase(), M + 34, tableY + 47, th);
  invText(t('invoice_col_qty').toUpperCase(), colQty, tableY + 47, { ...th, align: 'center' });
  invText(t('invoice_col_unit').toUpperCase(), colUnit, tableY + 47, { ...th, align: 'right' });
  invText(t('invoice_col_total').toUpperCase(), colTot, tableY + 47, { ...th, align: 'right' });

  CART.forEach((it, i) => {
    const ry = tableY + 76 + i * ROW_H;
    if (i % 2 === 1) { INV.fillStyle = INV_COLORS.rose; INV.fillRect(M, ry, CW, ROW_H); }
    if (i > 0) { INV.strokeStyle = INV_COLORS.line; INV.lineWidth = 1.5; INV.beginPath(); INV.moveTo(M + 24, ry); INV.lineTo(M + CW - 24, ry); INV.stroke(); }
    /* Vignette */
    const tx = M + 30, ty = ry + 12, tw = 72, th2 = ROW_H - 24;
    if (thumbs[i]) invCover(thumbs[i], tx, ty, tw, th2, 12);
    else { INV.fillStyle = INV_COLORS.sand; invRR(tx, ty, tw, th2, 12); INV.fill(); invText('H', tx + tw / 2, ty + th2 / 2 + 14, { family: INV_FONT.display, size: 40, color: INV_COLORS.brown, align: 'center' }); }
    /* Nom + détails */
    const nx = tx + tw + 26, nmax = colQty - 90 - nx;
    const nameLines = invWrap(it.name, nmax, { family: INV_FONT.serif, weight: 700, size: 27 }, 2);
    const bits = [];
    if (it.size) bits.push(it.size);
    if (it.color) bits.push(it.color);
    if (it.tissu) bits.push(it.tissu);
    if (it.optionKimono) bits.push(variantChoiceLabel(it.id, it.optionKimono));
    const detLines = bits.length ? invWrap(bits.join('  ·  '), nmax, { size: 21, weight: 600 }, nameLines.length === 1 ? 2 : 1) : [];
    const blockH = nameLines.length * 33 + detLines.length * 28;
    let by = ry + (ROW_H - blockH) / 2 + 26;
    nameLines.forEach(s => { invText(s, nx, by, { family: INV_FONT.serif, weight: 700, size: 27 }); by += 33; });
    detLines.forEach(s => { invText(s, nx, by - 2, { size: 21, weight: 600, color: INV_COLORS.dim }); by += 28; });
    /* Quantité, prix */
    INV.fillStyle = INV_COLORS.sand; invRR(colQty - 34, ry + ROW_H / 2 - 22, 68, 44, 22); INV.fill();
    invText('×' + it.qty, colQty, ry + ROW_H / 2 + 9, { weight: 800, size: 25, color: INV_COLORS.brown, align: 'center' });
    invText(formatMoney(it.price, it.currency), colUnit, ry + ROW_H / 2 + 8, { size: 22, weight: 500, color: INV_COLORS.dim, align: 'right' });
    invText(formatMoney(it.price * it.qty, it.currency), colTot, ry + ROW_H / 2 + 9, { weight: 800, size: 26, align: 'right' });
  });

  /* --- Totaux --- */
  const tw2 = 560, tx2 = M + CW - tw2;
  invText(t('subtotal'), tx2 + 30, totalsY + 34, { size: 24, weight: 600, color: INV_COLORS.dim });
  invText(totalsText, tx2 + tw2 - 30, totalsY + 34, { size: 24, weight: 700, align: 'right' });
  INV.save(); invShadow(30, 'rgba(143,47,10,.35)', 10);
  const tg = INV.createLinearGradient(tx2, totalsY + 62, tx2 + tw2, totalsY + 62 + 118);
  tg.addColorStop(0, INV_COLORS.terracotta); tg.addColorStop(1, '#8F2F0A');
  INV.fillStyle = tg; invRR(tx2, totalsY + 62, tw2, 118, 26); INV.fill(); INV.restore();
  invText(t('invoice_total'), tx2 + 34, totalsY + 134, { weight: 800, size: 26, color: 'rgba(255,255,255,.85)', spacing: '4px' });
  INV.font = `800 44px ${INV_FONT.serif}`;
  const totalFont = INV.measureText(totalsText).width > tw2 - 240 ? 32 : 44;
  invText(totalsText, tx2 + tw2 - 34, totalsY + 140, { family: INV_FONT.serif, weight: 800, size: totalFont, color: '#fff', align: 'right' });

  /* Note à gauche des totaux */
  const noteX = M, noteW = tx2 - M - 40;
  INV.strokeStyle = INV_COLORS.brand; INV.lineWidth = 3; INV.setLineDash([10, 9]); invRR(noteX, totalsY + 10, noteW, 170, 22); INV.stroke(); INV.setLineDash([]);
  invText(t('invoice_next_title'), noteX + 32, totalsY + 60, { weight: 800, size: 22, color: INV_COLORS.brown, spacing: '2px' });
  invWrap(t('invoice_wa_note'), noteW - 64, { size: 23, weight: 500 }, 4).forEach((s, i) => invText(s, noteX + 32, totalsY + 100 + i * 32, { size: 23, weight: 500, color: INV_COLORS.ink }));

  /* --- Pied de page --- */
  const fy = H - 290;
  invWeave(fy, 20);
  invText(t('invoice_thanks_title'), W / 2, fy + 100, { family: INV_FONT.serif, style: 'italic', weight: 500, size: 44, color: INV_COLORS.brown, align: 'center' });
  invText('WhatsApp ' + invFormatPhone(SITE_WA_NUMBER) + '   ·   hadeejart.store', W / 2, fy + 160, { weight: 700, size: 28, align: 'center' });
  invText(t('footer_tagline') + ' — Dakar, Sénégal', W / 2, fy + 204, { family: INV_FONT.display, size: 30, color: INV_COLORS.brand, align: 'center' });
  invWeave(H - 34, 34);
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
