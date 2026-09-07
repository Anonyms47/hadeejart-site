/* ======================================================================
   Hadeej'Art — Génération de la facture (canvas -> image) + partage WhatsApp
   ====================================================================== */

let CANVAS, INV, NAT_W, NAT_H;

function initInvoiceCanvas() {
  CANVAS = document.getElementById('inv');
  INV = CANVAS.getContext('2d');
  NAT_W = CANVAS.width;
  NAT_H = CANVAS.height;
}

function RRect(x, y, w, h, r) {
  INV.beginPath();
  INV.moveTo(x + r, y);
  INV.arcTo(x + w, y, x + w, y + h, r);
  INV.arcTo(x + w, y + h, x, y + h, r);
  INV.arcTo(x, y + h, x, y, r);
  INV.arcTo(x, y, x + w, y, r);
  INV.closePath();
}
function line(x1, y1, x2, y2, c, w) {
  INV.strokeStyle = c; INV.lineWidth = w;
  INV.beginPath(); INV.moveTo(x1, y1); INV.lineTo(x2, y2); INV.stroke();
}
function text(str, x, y, fs = 16, fw = '600', c = '#2b1e12', align = 'left') {
  INV.font = `${fw} ${fs}px Poppins`;
  INV.fillStyle = c;
  INV.textAlign = align;
  INV.fillText(str, x, y);
}

async function buildInvoiceImage() {
  INV.clearRect(0, 0, NAT_W, NAT_H);

  const PAD = 36;
  INV.fillStyle = "#F7E1D3"; RRect(10, 10, NAT_W - 20, NAT_H - 20, 20); INV.fill();
  INV.strokeStyle = "#00000010"; INV.lineWidth = 1; RRect(10, 10, NAT_W - 20, NAT_H - 20, 20); INV.stroke();

  INV.save(); INV.globalAlpha = .05; INV.rotate(-Math.PI / 180 * 8);
  for (let y = -300; y < NAT_H + 300; y += 140) { line(-300, y, NAT_W + 300, y, "#cf7a2a", 7); }
  INV.restore();

  INV.save(); INV.globalAlpha = .05; INV.fillStyle = "#9e5317";
  INV.font = "800 66px Poppins";
  for (let i = 180; i < NAT_H; i += 210) { INV.fillText("Hadeej’Art", 220, i); }
  INV.restore();

  const headerX = PAD - 8, headerY = 34, headerW = NAT_W - (PAD * 2) + 16, headerH = 110;
  INV.fillStyle = "#ffffff"; RRect(headerX, headerY, headerW, headerH, 12); INV.fill();
  INV.strokeStyle = "#00000010"; INV.lineWidth = 1; RRect(headerX, headerY, headerW, headerH, 12); INV.stroke();

  INV.save(); INV.beginPath(); INV.arc(headerX + 46, headerY + 55, 26, 0, Math.PI * 2); INV.closePath(); INV.clip();
  INV.fillStyle = "#f4cdb7"; INV.fillRect(headerX + 18, headerY + 27, 56, 56);
  INV.restore();

  text("Hadeej’Art", headerX + 90, headerY + 56, 40, "800", "#2b1e12", "left");
  /* Réutilise la réf. serveur (place_order) si déjà connue ; sinon repli local (ex: mode hors-ligne). */
  const orderId = window.LAST_INVOICE_ID || ("HA-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  window.LAST_INVOICE_ID = orderId;
  text("Facture · Réf: " + orderId, headerX + 90, headerY + 86, 18, "700", "#9e5317", "left");

  INV.save(); INV.translate(headerX + headerW - 70, headerY + 38); INV.rotate(-Math.PI / 180 * 12);
  INV.strokeStyle = "#2AA06A"; INV.lineWidth = 8; INV.strokeRect(-100, -22, 200, 44);
  text("COMMANDE", 0, 8, 22, "800", "#2AA06A", "center"); INV.restore();

  const val = id => (document.getElementById(id) || {}).value || "";
  const name = val('cName');
  const phone = val('cPhone');
  const country = val('cCountry');
  const city = val('cCity');
  const district = val('cDistrict');
  const loc = (typeof getDeliveryLocation === 'function') ? getDeliveryLocation() : {};
  const payValue = (document.getElementById('cPay') || {}).value;
  const pay = PAYMENT_LABELS[payValue] || payValue || '';

  const left = PAD, right = NAT_W - PAD;
  text("Détails client", left, 176, 24, "800", "#2b1e12", "left");
  text("Nom : " + name, left, 202, 18, "600", "#2b1e12", "left");
  text("Téléphone : " + phone, left, 224, 18, "600", "#2b1e12", "left");
  text("Lieu : " + [district, city, country].filter(Boolean).join(', '), left, 246, 18, "600", "#2b1e12", "left");
  text("Position : " + (loc.address || (loc.lat != null ? (loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4)) : '—')), left, 268, 16, "600", "#2b1e12", "left");
  text("Paiement : " + pay, left, 290, 16, "700", "#6f5a4a", "left");

  text("Articles", left, 322, 24, "800", "#2b1e12", "left");

  let y = 348;
  CART.forEach(it => {
    const bits = [];
    if (it.size) bits.push(it.size);
    if (it.color) bits.push(it.color);
    const row = `• ${it.name}${bits.length ? "  ·  " + bits.join(' · ') : ""}  ×${it.qty} — ${formatMoney(it.price * it.qty, it.currency)}`;
    text(row, left, y, 18, "700", "#2b1e12", "left");
    y += 30;
  });

  y += 10;
  const cardW = NAT_W - PAD * 2, cardH = 120, cardX = left, cardY = y;
  INV.fillStyle = "#ffffff"; RRect(cardX, cardY, cardW, cardH, 12); INV.fill();
  INV.strokeStyle = "#00000010"; INV.lineWidth = 1; RRect(cardX, cardY, cardW, cardH, 12); INV.stroke();

  INV.fillStyle = "#B43D2A"; RRect(cardX, cardY + cardH - 48, cardW, 48, 12); INV.fill();
  text("TOTAL", cardX + 20, cardY + cardH - 16, 22, "900", "#ffffff", "left");
  const totalsText = formatCartTotals();
  window.LAST_INVOICE_TOTAL = totalsText;
  text(totalsText, cardX + cardW - 24, cardY + cardH - 16, 24, "900", "#ffffff", "right");

  text("Merci pour votre confiance — Hadeej’Art · WhatsApp 78-144-43-40",
       left, NAT_H - 36, 14, "700", "#6f5a4a", "left");
}

function invoiceBlob() {
  return new Promise(resolve => CANVAS.toBlob(b => resolve(b), 'image/png', 1));
}

/* Tente un partage natif (mobile) de l'image + récap ; retourne true si le
   partage a effectivement eu lieu, false sinon (l'appelant doit alors
   proposer le fallback WhatsApp Web avec le message texte). */
async function shareInvoiceWhatsApp(messageBuilder) {
  try {
    const blob = await invoiceBlob();
    if (!blob) return false;
    const file = new File([blob], `facture_${window.LAST_INVOICE_ID || 'HA'}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: messageBuilder ? messageBuilder() : '' });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Partage facture impossible:', err);
    return false;
  }
}
