/* ======================================================================
   Hadeej'Art — Facture (canvas -> image PNG téléchargeable, partagée sur WhatsApp)
   Identité « Ébène, Lin & Or Safran » : bandeau ébène avec le logo cerclé d'or,
   cartes client / livraison sans aucune coupure de texte, lignes de création
   avec vignette et pastilles de variantes, QR code WhatsApp, total en pastille
   ébène et or. Hauteur automatique (aucun vide quand le panier est court),
   format étroit pensé pour l'aperçu WhatsApp. Tout le texte suit la langue du site.

   Typographie : la police décorative (Kenia) ne sert que pour « HADEEJ'ART » et
   « FACTURE ». Tous les montants, numéros et dates sont dessinés en chiffres
   tabulaires (chaque chiffre occupe la même largeur) : les colonnes s'alignent
   et aucun chiffre ne change de police.
   ====================================================================== */

let CANVAS, INV, NAT_W, NAT_H;

/* Mise en page en unités « logiques » (480 de large), dessinée à 2,25x :
   image finale de 1080 px de large, nette sur un écran de téléphone. */
const INV_LW = 480, INV_SC = 2.25;

const INV_COLORS = {
  ebony: '#110F0D', gold: '#D4A359', goldDeep: '#8B6A2B', copper: '#C86D44',
  linen: '#FAF6EE', card: '#FFFFFF', cream: '#F6F1E7', ink: '#1d1812', dim: '#6F665B',
  line: 'rgba(17,15,13,.08)'
};
const INV_FONT = {
  display: '"Kenia", "Fraunces", Georgia, serif',
  sans: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif'
};

function initInvoiceCanvas() {
  CANVAS = document.getElementById('inv');
  INV = CANVAS.getContext('2d');
  NAT_W = CANVAS.width;
  NAT_H = CANVAS.height;
}

/* ---------- Primitives de dessin ---------- */
function invFont(o) { return `${o.style || ''} ${o.weight || 500} ${o.size || 13}px ${o.family || INV_FONT.sans}`.trim(); }
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
  INV.font = invFont(o);
  INV.fillStyle = o.color || INV_COLORS.ink;
  INV.textAlign = o.align || 'left';
  INV.textBaseline = 'alphabetic';
  try { INV.letterSpacing = o.spacing || '0px'; } catch (e) { /* non supporté : ignoré */ }
  INV.fillText(str, x, y);
  try { INV.letterSpacing = '0px'; } catch (e) {}
}
/* Chiffres tabulaires : chaque chiffre occupe la largeur du plus large, quelle
   que soit la police (le canvas ne sait pas activer « tnum »). */
function invNumWidth(str, o = {}) {
  INV.font = invFont(o);
  let dw = 0; for (const d of '0123456789') dw = Math.max(dw, INV.measureText(d).width);
  return [...String(str)].reduce((s, ch) => s + (/\d/.test(ch) ? dw : INV.measureText(ch).width), 0);
}
function invNum(str, x, y, o = {}) {
  INV.font = invFont(o);
  let dw = 0; for (const d of '0123456789') dw = Math.max(dw, INV.measureText(d).width);
  const chars = [...String(str)];
  const widths = chars.map(ch => /\d/.test(ch) ? dw : INV.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === 'right' ? x - total : (o.align === 'center' ? x - total / 2 : x);
  INV.fillStyle = o.color || INV_COLORS.ink;
  INV.textAlign = 'left'; INV.textBaseline = 'alphabetic';
  chars.forEach((ch, i) => { INV.fillText(ch, cx + (/\d/.test(ch) ? (dw - INV.measureText(ch).width) / 2 : 0), y); cx += widths[i]; });
  return total;
}
/* Découpe un texte en lignes qui tiennent dans maxW. JAMAIS de coupure par « … » :
   un mot plus large que la ligne (coordonnées, lien) est cassé caractère par caractère. */
function invWrap(str, maxW, o = {}) {
  INV.font = invFont(o);
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const pushBroken = w => {
    let piece = '';
    for (const ch of w) {
      if (INV.measureText(piece + ch).width > maxW && piece) { lines.push(piece); piece = ch; } else piece += ch;
    }
    return piece;
  };
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (INV.measureText(test).width <= maxW) { cur = test; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    cur = INV.measureText(w).width > maxW ? pushBroken(w) : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function invCard(x, y, w, h, r = 10) {
  INV.save();
  INV.shadowColor = 'rgba(17,15,13,.07)'; INV.shadowBlur = 10; INV.shadowOffsetY = 2;
  INV.fillStyle = INV_COLORS.card; invRR(x, y, w, h, r); INV.fill();
  INV.restore();
  INV.strokeStyle = INV_COLORS.line; INV.lineWidth = 1; invRR(x + .5, y + .5, w - 1, h - 1, r); INV.stroke();
}
/* Pastille à plusieurs parties : [{ t, weight, size, color }] */
function invPillW(parts, padX = 8) {
  let w = padX * 2;
  parts.forEach(p => { INV.font = invFont(p); w += INV.measureText(p.t).width + (p.gap || 0); });
  return w;
}
function invPill(x, y, parts, o = {}) {
  const h = o.h || 17, padX = o.padX || 8, w = invPillW(parts, padX);
  INV.fillStyle = o.fill || 'rgba(212,163,89,.14)'; invRR(x, y, w, h, h / 2); INV.fill();
  if (o.stroke) { INV.strokeStyle = o.stroke; INV.lineWidth = o.lw || 1; invRR(x + .5, y + .5, w - 1, h - 1, h / 2); INV.stroke(); }
  let cx = x + padX;
  parts.forEach(p => {
    INV.font = invFont(p); INV.fillStyle = p.color || INV_COLORS.ink; INV.textAlign = 'left'; INV.textBaseline = 'alphabetic';
    INV.fillText(p.t, cx, y + h / 2 + (p.size || 10) * 0.35);
    cx += INV.measureText(p.t).width + (p.gap || 0);
  });
  return w;
}

/* Ruban géométrique « wax » : or, ébène, cuivre */
function invRibbon(y, h) {
  INV.fillStyle = INV_COLORS.ebony; INV.fillRect(0, y, INV_LW, h);
  const cell = 16;
  for (let x = 0; x < INV_LW + cell; x += cell) {
    INV.fillStyle = INV_COLORS.gold;
    INV.beginPath(); INV.moveTo(x, y + h); INV.lineTo(x + cell / 2, y); INV.lineTo(x + cell, y + h); INV.closePath(); INV.fill();
    INV.fillStyle = INV_COLORS.copper;
    INV.beginPath(); INV.moveTo(x + cell / 2, y); INV.lineTo(x + cell * 1.5, y); INV.lineTo(x + cell, y + h); INV.closePath(); INV.fill();
    INV.fillStyle = INV_COLORS.ebony;
    INV.beginPath(); INV.moveTo(x + cell / 2, y + h * .38); INV.lineTo(x + cell / 2 + 2.2, y + h * .66); INV.lineTo(x + cell / 2, y + h * .94); INV.lineTo(x + cell / 2 - 2.2, y + h * .66); INV.closePath(); INV.fill();
  }
}

function invDiamond(cx, cy, r, color) {
  INV.fillStyle = color; INV.beginPath();
  INV.moveTo(cx, cy - r); INV.lineTo(cx + r, cy); INV.lineTo(cx, cy + r); INV.lineTo(cx - r, cy); INV.closePath(); INV.fill();
}
/* Texte courbé le long d'un cercle (tampon de l'atelier) */
function invArcText(str, cx, cy, r, o = {}) {
  const chars = [...str], step = (Math.PI * 2) / chars.length;
  INV.font = invFont(o); INV.fillStyle = o.color || INV_COLORS.ink; INV.textAlign = 'center'; INV.textBaseline = 'alphabetic';
  chars.forEach((ch, i) => { INV.save(); INV.translate(cx, cy); INV.rotate((o.start || 0) + i * step); INV.fillText(ch, 0, -r); INV.restore(); });
}
function invStamp(cx, cy, R) {
  const C = INV_COLORS;
  INV.save(); INV.globalAlpha = .13; INV.translate(cx, cy); INV.rotate(-0.17);
  INV.strokeStyle = C.goldDeep; INV.lineWidth = 1.4; INV.beginPath(); INV.arc(0, 0, R, 0, Math.PI * 2); INV.stroke();
  INV.lineWidth = .8; INV.beginPath(); INV.arc(0, 0, R - 5, 0, Math.PI * 2); INV.stroke();
  INV.beginPath(); INV.arc(0, 0, R - 21, 0, Math.PI * 2); INV.stroke();
  invArcText('HADEEJ’ART · ATELIER DAKAR · ', 0, 0, R - 12.5, { weight: 800, size: 8, color: C.goldDeep, start: -0.1 });
  invText('H’A', 0, 8, { family: INV_FONT.display, size: 22, color: C.goldDeep, align: 'center' });
  INV.restore();
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
/* Téléphone du client, lisible : +221 77 123 45 67. Le préfixe +221 n'est ajouté
   que pour un numéro sénégalais à 9 chiffres (pays vide ou Sénégal) ; sinon on
   garde ce que la personne a saisi. */
function invCustomerPhone(raw, country) {
  const txt = String(raw || '').trim();
  const d = txt.replace(/\D/g, '');
  const sn = !country || /s[ée]n[ée]gal/i.test(country);
  if (d.length === 12 && d.startsWith('221')) return invFormatPhone(d);
  if (d.length === 9 && sn && /^7/.test(d)) return '+221 ' + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7)].join(' ');
  return txt;
}

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
        document.fonts.load('400 24px "DM Sans"'), document.fonts.load('500 24px "DM Sans"'), document.fonts.load('600 24px "DM Sans"'), document.fonts.load('700 24px "DM Sans"'), document.fonts.load('800 24px "DM Sans"'),
        document.fonts.load('italic 400 24px "DM Sans"'), document.fonts.load('italic 500 24px "DM Sans"'), document.fonts.load('400 24px "Kenia"')
      ]);
    }
  } catch (e) { /* repli : polices de secours */ }

  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  const name = val('cName'), email = val('cEmail');
  const country = val('cCountry');
  const phone = invCustomerPhone(val('cPhone'), country);
  const loc = (typeof getDeliveryLocation === 'function') ? getDeliveryLocation() : {};
  const payValue = val('cPay');
  const pay = (typeof PAYMENT_LABELS !== 'undefined' && PAYMENT_LABELS[payValue]) || payValue || '';
  /* Numéro de secours (commande non enregistrée, ex : réseau coupé) : même forme HA-JJMMAA-…
     mais lettre Z + 3 chiffres, pour ne jamais ressembler à un vrai numéro (A1, A2…). */
  const _n = new Date(), _p = x => String(x).padStart(2, '0');
  const orderId = window.LAST_INVOICE_ID || (`HA-${_p(_n.getDate())}${_p(_n.getMonth() + 1)}${_p(_n.getFullYear() % 100)}-Z${Math.floor(100 + Math.random() * 900)}`);
  window.LAST_INVOICE_ID = orderId;
  const view = window.INVOICE_VIEW || cartOrderView();
  const totalsText = formatMoney(view.total, view.currency);
  window.LAST_INVOICE_TOTAL = totalsText;
  const locale = CURRENT_LANG === 'en' ? 'en-GB' : 'fr-FR';
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' });
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });

  const [logo, instruction, ...thumbs] = await Promise.all([
    invLoadImage('images/logo.png'), invPaymentInstruction(payValue), ...view.lines.map(l => invLoadImage(l.img))
  ]);

  const d = {
    name, phone, email, pay, orderId, totalsText, dateStr, timeStr, logo, instruction, thumbs, lines: view.lines, loc,
    district: val('cDistrict'), city: val('cCity'), country,
    qr: (typeof qrMatrix === 'function') ? qrMatrix('https://wa.me/' + SITE_WA_NUMBER) : null
  };

  /* Passe 1 : mesure de la hauteur sur un canvas haut ; passe 2 : dessin à la hauteur exacte. */
  let SC = INV_SC;
  const prep = h => {
    CANVAS.width = Math.round(INV_LW * SC); CANVAS.height = Math.round(h * SC);
    INV = CANVAS.getContext('2d');
    INV.setTransform(SC, 0, 0, SC, 0, 0);
    INV.textBaseline = 'alphabetic';
  };
  prep(4000);
  const H = Math.ceil(invRender(d, 4000));
  /* Très gros panier : on réduit la définition pour rester sous les limites des
     téléphones (≈ 16 millions de pixels sur iPhone) et garder une image légère. */
  const MAXPX = 9e6;
  if (INV_LW * SC * H * SC > MAXPX) SC = Math.max(1.2, Math.sqrt(MAXPX / (INV_LW * H)));
  prep(H);
  invRender(d, H);
  NAT_W = CANVAS.width; NAT_H = CANVAS.height;
}

/* Dessine toute la facture et renvoie sa hauteur logique. */
function invRender(d, canvasH) {
  const W = INV_LW, P = 22, CW = W - P * 2, C = INV_COLORS, F = INV_FONT;
  const ZONES = { sex: { male: 'sex_male', female: 'sex_female', unisex: 'sex_unisex' } };

  /* --- Fond lin + trame tissée très discrète --- */
  INV.fillStyle = C.linen; INV.fillRect(0, 0, W, canvasH);
  INV.save();
  INV.setTransform(1, 0, 0, 1, 0, 0);
  const tile = document.createElement('canvas'); tile.width = tile.height = 6;
  const tc = tile.getContext('2d');
  tc.fillStyle = 'rgba(139,106,43,.045)'; tc.fillRect(0, 0, 6, 1); tc.fillRect(0, 3, 6, 1);
  tc.fillStyle = 'rgba(139,106,43,.03)'; tc.fillRect(0, 0, 1, 6); tc.fillRect(3, 0, 1, 6);
  INV.fillStyle = INV.createPattern(tile, 'repeat'); INV.fillRect(0, 0, CANVAS.width, CANVAS.height);
  INV.restore();

  /* --- Bandeau ébène --- */
  const HT = 8, HH = 118, HC = HT + (HH - 6) / 2;   /* HC : milieu visuel du bandeau */
  INV.fillStyle = C.ebony; INV.fillRect(0, HT, W, HH);
  INV.save(); INV.globalAlpha = .05; INV.strokeStyle = C.cream; INV.lineWidth = 3;
  INV.beginPath(); INV.rect(0, HT, W, HH); INV.clip();
  for (let x = -HH; x < W + HH; x += 14) { INV.beginPath(); INV.moveTo(x, HT + HH); INV.lineTo(x + HH, HT); INV.stroke(); }
  INV.restore();

  const lcx = P + 30, lcy = HC;
  const glow = INV.createRadialGradient(lcx, lcy, 6, lcx, lcy, 150);
  glow.addColorStop(0, 'rgba(212,163,89,.30)'); glow.addColorStop(1, 'rgba(212,163,89,0)');
  INV.fillStyle = glow; INV.fillRect(0, HT, W, HH);
  INV.strokeStyle = C.gold; INV.lineWidth = 2.5; INV.beginPath(); INV.arc(lcx, lcy, 30, 0, Math.PI * 2); INV.stroke();
  INV.fillStyle = '#FFF7F1'; INV.beginPath(); INV.arc(lcx, lcy, 27.5, 0, Math.PI * 2); INV.fill();
  if (d.logo) { INV.save(); INV.beginPath(); INV.arc(lcx, lcy, 27, 0, Math.PI * 2); INV.clip(); INV.drawImage(d.logo, lcx - 27, lcy - 27, 54, 54); INV.restore(); }
  else invText('H', lcx, lcy + 9, { family: F.display, size: 26, color: C.goldDeep, align: 'center' });

  const bx = lcx + 30 + 14;
  invText('HADEEJ’ART', bx, lcy - 8, { family: F.display, size: 25, weight: 400, color: C.cream });
  invText(t('footer_tagline'), bx, lcy + 10, { style: 'italic', weight: 500, size: 12.5, color: C.gold });
  invText('ATELIER DAKAR · SÉNÉGAL', bx, lcy + 27, { weight: 600, size: 8.5, color: 'rgba(246,241,231,.62)', spacing: '1.6px' });

  const rx = W - P;
  invText(t('invoice_title'), rx, HC - 18, { family: F.display, size: 27, weight: 400, color: C.gold, align: 'right' });
  invText(t('invoice_number_label').toUpperCase(), rx, HC + 1, { weight: 700, size: 8, color: 'rgba(246,241,231,.62)', align: 'right', spacing: '1.6px' });
  invNum(d.orderId, rx, HC + 20, { weight: 800, size: 16, color: C.cream, align: 'right' });
  invNum(`${d.dateStr} · ${d.timeStr}`, rx, HC + 36, { weight: 500, size: 10.5, color: 'rgba(246,241,231,.82)', align: 'right' });

  /* double filet d'or et losange, comme une étiquette de couture */
  INV.fillStyle = C.gold; INV.fillRect(0, HT + HH - 4, W, 1.2); INV.fillRect(0, HT + HH - 7.5, W, .6);
  invDiamond(W / 2, HT + HH - 3.4, 5.2, C.ebony); invDiamond(W / 2, HT + HH - 3.4, 3.4, C.gold);
  invRibbon(0, 8);

  let y = HT + HH + 22;

  /* --- Cartes client / livraison --- */
  const gap = 12, cardW = (CW - gap) / 2, padL = 17, padR = 12, tw = cardW - padL - padR;
  const lbl = { weight: 800, size: 8.5, color: C.goldDeep, spacing: '1.4px' };
  const sub = { weight: 700, size: 7.5, color: C.dim, spacing: '1.2px' };

  const nameLines = invWrap(d.name || t('dash'), tw, { weight: 800, size: 14.5 });
  const mailLines = d.email ? invWrap(d.email, tw, { weight: 500, size: 10.5 }) : [];
  const place = [d.district, d.city, d.country].filter(Boolean).join(', ');
  const placeLines = invWrap(place || t('dash'), tw, { weight: 700, size: 12.5 });
  const addr = d.loc.address || (d.loc.lat != null ? `${d.loc.lat.toFixed(5)}, ${d.loc.lng.toFixed(5)}` : '');
  const addrLines = addr ? invWrap(addr, tw, { weight: 500, size: 11 }) : [];
  const noteLines = d.loc.note ? invWrap(t('invoice_note') + ' ' + d.loc.note, tw, { style: 'italic', weight: 600, size: 10.5 }) : [];

  /* Hauteur des contenus (depuis le haut des capitales de la 1re ligne) : la carte en dépend,
     avec une marge réelle en haut et en bas — jamais de pastille collée au bord. */
  const nL = nameLines.length, mL = mailLines.length;
  const leftBody = (d.pay ? 18 * nL + 14 * mL + 52 : (mL ? 18 * nL + 14 * mL + 18 : 18 * nL + 16)) - 3;
  const pL = placeLines.length, aL = Math.max(addrLines.length, 1), qL = noteLines.length;
  const s2L = 21 + 16 * pL, lastL = qL ? s2L + 14 + 14 * aL + 2 + 14 * (qL - 1) : s2L + 14 + 14 * (aL - 1);
  const rightBody = lastL + 3 + 6;
  const CARD_HEAD = 30, CARD_PAD = 16;
  const cardH = Math.max(CARD_HEAD + leftBody + CARD_PAD * 2, CARD_HEAD + rightBody + CARD_PAD * 2, 112);

  const drawCardShell = (x, title) => {
    invCard(x, y, cardW, cardH);
    INV.save(); invRR(x, y, cardW, cardH, 10); INV.clip(); INV.fillStyle = C.gold; INV.fillRect(x, y, 3, cardH); INV.restore();
    invText(title.toUpperCase(), x + padL, y + 20, lbl);
  };
  drawCardShell(P, t('invoice_client_pay'));
  {
    const capTop = y + CARD_HEAD + Math.max(0, ((cardH - CARD_HEAD) - leftBody) / 2);
    let cy = capTop + 10;
    nameLines.forEach(s => { invText(s, P + padL, cy, { weight: 800, size: 14.5 }); cy += 18; });
    invNum(d.phone || t('dash'), P + padL, cy, { weight: 700, size: 12.5 }); cy += 18;
    mailLines.forEach(s => { invText(s, P + padL, cy - 2, { weight: 500, size: 10.5, color: C.dim }); cy += 14; });
    if (d.pay) { cy += 2; invPill(P + padL, cy - 1, [{ t: d.pay, weight: 800, size: 11, color: C.ebony }], { h: 20, padX: 11, fill: 'rgba(212,163,89,.2)', stroke: C.gold }); }
  }

  const x2 = P + cardW + gap;
  drawCardShell(x2, t('invoice_address_title'));
  {
    const capTop = y + CARD_HEAD + Math.max(0, ((cardH - CARD_HEAD) - rightBody) / 2);
    let cy = capTop + 6;
    invText((t('district_label') + ' / ' + t('city_label')).toUpperCase(), x2 + padL, cy, sub); cy += 15;
    placeLines.forEach(s => { invText(s, x2 + padL, cy, { weight: 700, size: 12.5 }); cy += 16; });
    cy += 6;
    invText(t('invoice_address_gps').toUpperCase(), x2 + padL, cy, sub); cy += 14;
    if (addrLines.length) addrLines.forEach(s => { invText(s, x2 + padL, cy, { weight: 500, size: 11, color: C.ink }); cy += 14; });
    else { invText(t('dash'), x2 + padL, cy, { size: 11, color: C.dim }); cy += 14; }
    if (noteLines.length) { cy += 2; noteLines.forEach(s => { invText(s, x2 + padL, cy, { style: 'italic', weight: 600, size: 10.5, color: C.goldDeep }); cy += 14; }); }
  }

  y += cardH + 18;

  /* --- Lignes de création --- */
  const HEAD = 28, ROWPAD = 11, TH = 48;
  const textX = P + 12 + TH + 11;
  const priceR = P + CW - 12, qtyC = priceR - 94 - 18;
  const textW = qtyC - 22 - textX;
  const rows = d.lines.map((it, i) => {
    const nameL = invWrap(it.name, textW, { weight: 700, size: 13.5 });
    const variants = [];
    if (it.size) variants.push([t('size_label'), it.size]);
    if (it.tissu) variants.push([t('fabric_label'), it.tissu]);
    if (it.color) variants.push([t('color_label'), it.color]);
    if (it.optionKimono) variants.push([t('detail_cut'), variantChoiceLabel(it.id, it.optionKimono)]);
    if (it.sexe) variants.push([t('sex_label'), ZONES.sex[it.sexe] ? t(ZONES.sex[it.sexe]) : it.sexe]);
    /* pastilles en flux : retour à la ligne automatique, sans jamais couper */
    const placed = []; let px = 0, py = 0;
    variants.forEach(([k, v]) => {
      const parts = [{ t: k + ' ', size: 8.5, weight: 600, color: C.dim }, { t: String(v), size: 10, weight: 800, color: C.ebony }];
      INV.font = invFont(parts[1]);
      const maxVal = textW - 16 - (INV.measureText(parts[0].t).width || 0);
      let w = invPillW(parts, 7);
      let vt = String(v);
      if (w > textW) { /* valeur très longue : la pastille occupe toute la largeur sur plusieurs lignes */
        const vl = invWrap(vt, Math.max(40, maxVal), { size: 10, weight: 800 });
        placed.push({ multi: true, k, lines: vl, x: 0, y: py + (px ? 21 : 0) });
        py += (px ? 21 : 0) + 4 + vl.length * 13 + 4; px = 0; return;
      }
      if (px + w > textW && px > 0) { px = 0; py += 21; }
      placed.push({ parts, x: px, y: py, w }); px += w + 5;
    });
    const pillsH = placed.length ? (placed.some(p => p.multi) ? py : py + 17) + 5 : 0;
    const noteL = it.note ? invWrap(t('invoice_free_note') + ' : ' + it.note, textW, { style: 'italic', weight: 600, size: 10.5 }) : [];
    const noteH = noteL.length ? 3 + noteL.length * 14 : 0;
    const blockH = nameL.length * 17 + (pillsH ? 3 + pillsH : 0) + noteH;
    return { it, i, nameL, placed, pillsH, noteL, noteH, h: Math.max(TH, blockH) + ROWPAD * 2 };
  });
  const itemsH = rows.reduce((s, r) => s + r.h, 0);
  const tableY = y;

  invCard(P, tableY, CW, HEAD + itemsH + 4);
  INV.fillStyle = C.ebony; invRR(P, tableY, CW, HEAD, 10); INV.fill(); INV.fillRect(P, tableY + HEAD - 10, CW, 10);
  const th = { weight: 800, size: 8.5, color: C.gold, spacing: '1.5px' };
  invText(t('invoice_col_creation').toUpperCase(), P + 12, tableY + 18, th);
  invText(t('invoice_col_qty').toUpperCase(), qtyC, tableY + 18, { ...th, align: 'center' });
  invText(t('invoice_col_total').toUpperCase(), priceR, tableY + 18, { ...th, align: 'right' });

  let ry = tableY + HEAD;
  rows.forEach(r => {
    if (r.i > 0) { INV.strokeStyle = C.line; INV.lineWidth = 1; INV.beginPath(); INV.moveTo(P + 12, ry + .5); INV.lineTo(P + CW - 12, ry + .5); INV.stroke(); }
    const ty = ry + ROWPAD;
    if (d.thumbs[r.i]) invCover(d.thumbs[r.i], P + 12, ty, TH, TH, 8);
    else { INV.fillStyle = '#F1E7D6'; invRR(P + 12, ty, TH, TH, 8); INV.fill(); invText('H', P + 12 + TH / 2, ty + TH / 2 + 9, { family: F.display, size: 24, color: C.goldDeep, align: 'center' }); }
    INV.strokeStyle = C.line; INV.lineWidth = 1; invRR(P + 12.5, ty + .5, TH - 1, TH - 1, 8); INV.stroke();
    INV.fillStyle = C.ebony; INV.beginPath(); INV.arc(P + 14, ty + 2, 8.5, 0, Math.PI * 2); INV.fill();
    INV.strokeStyle = C.gold; INV.lineWidth = 1; INV.beginPath(); INV.arc(P + 14, ty + 2, 8.5, 0, Math.PI * 2); INV.stroke();
    invNum(String(r.i + 1), P + 14, ty + 5.2, { weight: 800, size: 9.5, color: C.gold, align: 'center' });

    let by = ry + ROWPAD + 12;
    r.nameL.forEach(s => { invText(s, textX, by, { weight: 700, size: 13.5 }); by += 17; });
    if (r.placed.length) {
      by += 0;
      const base = by - 8;
      r.placed.forEach(p => {
        if (p.multi) {
          invText(p.k, textX, base + p.y + 10, { size: 8.5, weight: 600, color: C.dim });
          p.lines.forEach((s, j) => invText(s, textX, base + p.y + 22 + j * 13, { size: 10, weight: 800, color: C.ebony }));
        } else invPill(textX + p.x, base + p.y, p.parts, { h: 17, padX: 7, fill: 'rgba(212,163,89,.15)', stroke: 'rgba(212,163,89,.55)' });
      });
      by = base + r.pillsH + 8;
    }
    r.noteL.forEach(s => { invText(s, textX, by, { style: 'italic', weight: 600, size: 10.5, color: C.goldDeep }); by += 14; });

    const midY = ry + ROWPAD + TH / 2;
    INV.fillStyle = C.ebony; invRR(qtyC - 17, midY - 10, 34, 20, 10); INV.fill();
    invNum('×' + r.it.qty, qtyC, midY + 4, { weight: 800, size: 11.5, color: C.gold, align: 'center' });
    const unit = r.it.qty > 1;
    invNum(formatMoney(r.it.price * r.it.qty, r.it.currency), priceR, midY + (unit ? -1 : 5), { weight: 800, size: 13, color: C.ebony, align: 'right' });
    if (unit) invNum(formatMoney(r.it.price, r.it.currency) + ' / ' + t('cart_unit'), priceR, midY + 13, { weight: 500, size: 9, color: C.dim, align: 'right' });
    ry += r.h;
  });
  y = tableY + HEAD + itemsH + 4 + 18;

  /* --- Validation WhatsApp (gauche) et totaux (droite) --- */
  const rightW = 196, leftW = CW - rightW - gap, QR = 88, GAPQ = 14;
  const noteTxtW = leftW - 28 - QR - GAPQ;
  const qrNote = invWrap(t('invoice_qr_note'), Math.max(70, noteTxtW), { weight: 500, size: 10.5 });
  INV.font = invFont({ weight: 500, size: 10.5 });
  const noteRealW = Math.max(...qrNote.map(s => INV.measureText(s).width));
  const insLines = d.instruction ? invWrap(d.instruction, leftW - 28, { weight: 500, size: 10 }) : [];
  const scanLines = invWrap(t('invoice_scan'), QR + 10, { weight: 600, size: 8.5, style: 'italic' });
  const qrBlock = QR + 5 + scanLines.length * 10.5;
  const noteBlockH = qrNote.length * 14.5;
  const mainH = Math.max(qrBlock, noteBlockH);
  const groupH = mainH + (insLines.length ? 14 + insLines.length * 13.5 : 0);
  const leftBoxH = 34 + groupH + 18;

  /* totaux */
  const feeLines = invWrap(t('invoice_delivery_confirmed'), rightW - 4, { weight: 600, size: 10.5, style: 'italic' });
  const sumH = 16 + 18 + 12 + 14 + feeLines.length * 13 + 14;
  const TOTAL_H = 62;
  const rightBoxH = sumH + TOTAL_H;
  const boxH = Math.max(leftBoxH, rightBoxH);

  /* carte de validation, bordure cousue */
  INV.save();
  const vbg = INV.createLinearGradient(P, y, P + leftW, y + boxH);
  vbg.addColorStop(0, 'rgba(255,255,255,.85)'); vbg.addColorStop(1, 'rgba(244,228,196,.45)');
  INV.fillStyle = vbg; invRR(P, y, leftW, boxH, 12); INV.fill();
  INV.strokeStyle = C.gold; INV.lineWidth = 1; INV.setLineDash([4, 3]); invRR(P + .5, y + .5, leftW - 1, boxH - 1, 12); INV.stroke();
  INV.restore();
  const vcx = P + leftW / 2, vTitle = t('invoice_validation').toUpperCase();
  INV.font = invFont(lbl); try { INV.letterSpacing = '1.4px'; } catch (e) {}
  const vtw = INV.measureText(vTitle).width; try { INV.letterSpacing = '0px'; } catch (e) {}
  invText(vTitle, vcx + 0.7, y + 21, { ...lbl, align: 'center' });
  invDiamond(vcx - vtw / 2 - 11, y + 18, 2.6, C.gold); invDiamond(vcx + vtw / 2 + 11, y + 18, 2.6, C.gold);
  INV.strokeStyle = 'rgba(212,163,89,.6)'; INV.lineWidth = 1;
  INV.beginPath(); INV.moveTo(P + 16, y + 18.5); INV.lineTo(vcx - vtw / 2 - 20, y + 18.5); INV.moveTo(vcx + vtw / 2 + 20, y + 18.5); INV.lineTo(P + leftW - 16, y + 18.5); INV.stroke();

  const groupW = QR + GAPQ + noteRealW;
  const gx = P + (leftW - groupW) / 2;
  const qy = y + 32 + Math.max(0, ((boxH - 32 - 14) - groupH) / 2);
  if (d.qr) {
    INV.save(); INV.shadowColor = 'rgba(17,15,13,.14)'; INV.shadowBlur = 8; INV.shadowOffsetY = 2;
    INV.fillStyle = '#fff'; invRR(gx, qy, QR, QR, 7); INV.fill(); INV.restore();
    INV.strokeStyle = C.line; INV.lineWidth = 1; invRR(gx + .5, qy + .5, QR - 1, QR - 1, 7); INV.stroke();
    const n = d.qr.length, cell = (QR - 16) / n;
    const m0 = gx + 8, my0 = qy + 8;
    INV.strokeStyle = C.gold; INV.lineWidth = 2; INV.lineCap = 'round';
    [[gx, qy], [gx + QR, qy], [gx, qy + QR], [gx + QR, qy + QR]].forEach(([bx2, by2], k) => {
      const sx = k % 2 ? -1 : 1, sy3 = k > 1 ? -1 : 1;
      INV.beginPath(); INV.moveTo(bx2 - sx * 3, by2 - sy3 * 3 + sy3 * 9); INV.lineTo(bx2 - sx * 3, by2 - sy3 * 3); INV.lineTo(bx2 - sx * 3 + sx * 9, by2 - sy3 * 3); INV.stroke();
    });
    INV.lineCap = 'butt';
    scanLines.forEach((s, i) => invText(s, gx + QR / 2, qy + QR + 15 + i * 10.5, { style: 'italic', weight: 600, size: 8.5, color: C.goldDeep, align: 'center' }));
    INV.fillStyle = C.ebony;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (d.qr[r][c]) INV.fillRect(m0 + c * cell, my0 + r * cell, cell + .35, cell + .35);
  }
  const nTop = qy + Math.max(0, (QR - noteBlockH) / 2);
  qrNote.forEach((s, i) => invText(s, gx + QR + GAPQ, nTop + 10 + i * 14.5, { weight: 500, size: 10.5, color: C.ink }));
  if (insLines.length) {
    const iy = qy + mainH + 14 + 9;
    insLines.forEach((s, i) => invText(s, vcx, iy + i * 13.5, { weight: 500, size: 10, color: C.dim, align: 'center' }));
  }

  /* totaux */
  const tx = P + leftW + gap;
  let sy2 = y + 16;
  invText(t('invoice_subtotal'), tx, sy2 + 3, { weight: 600, size: 11, color: C.dim });
  invNum(d.totalsText, tx + rightW, sy2 + 3, { weight: 800, size: 12, color: C.ebony, align: 'right' });
  sy2 += 24;
  INV.strokeStyle = C.line; INV.beginPath(); INV.moveTo(tx, sy2 - 8.5); INV.lineTo(tx + rightW, sy2 - 8.5); INV.stroke();
  invText(t('invoice_delivery_fee'), tx, sy2 + 4, { weight: 600, size: 11, color: C.dim });
  feeLines.forEach((s, i) => invText(s, tx, sy2 + 19 + i * 13, { style: 'italic', weight: 600, size: 10.5, color: C.goldDeep }));

  const totY = y + boxH - TOTAL_H;
  INV.save(); INV.shadowColor = 'rgba(17,15,13,.28)'; INV.shadowBlur = 14; INV.shadowOffsetY = 5;
  const tbg = INV.createLinearGradient(tx, totY, tx + rightW, totY + TOTAL_H);
  tbg.addColorStop(0, '#26201a'); tbg.addColorStop(.55, C.ebony); tbg.addColorStop(1, '#070605');
  INV.fillStyle = tbg; invRR(tx, totY, rightW, TOTAL_H, 14); INV.fill(); INV.restore();
  const tgold = INV.createLinearGradient(tx, totY, tx + rightW, totY + TOTAL_H);
  tgold.addColorStop(0, '#f3dba5'); tgold.addColorStop(.35, C.gold); tgold.addColorStop(.7, '#9a7434'); tgold.addColorStop(1, '#e8c98a');
  INV.strokeStyle = tgold; INV.lineWidth = 2; invRR(tx + 1, totY + 1, rightW - 2, TOTAL_H - 2, 13); INV.stroke();
  INV.strokeStyle = 'rgba(246,241,231,.10)'; INV.lineWidth = 1; invRR(tx + 4.5, totY + 4.5, rightW - 9, TOTAL_H - 9, 10); INV.stroke();
  invText(t('invoice_total'), tx + 14, totY + 21, { weight: 800, size: 9.5, color: C.gold, spacing: '2px' });
  let tsz = 24;
  while (invNumWidth(d.totalsText, { weight: 800, size: tsz }) > rightW - 28 && tsz > 12) tsz -= 1;
  invNum(d.totalsText, tx + rightW - 14, totY + TOTAL_H - 15, { weight: 800, size: tsz, color: C.cream, align: 'right' });

  y += boxH + 22;

  /* --- Pied de page : texte centré entre les pointillés et le ruban du bas --- */
  INV.strokeStyle = 'rgba(212,163,89,.7)'; INV.lineWidth = 1; INV.setLineDash([3, 4]);
  INV.beginPath(); INV.moveTo(P + 40, y + .5); INV.lineTo(W - P - 40, y + .5); INV.stroke(); INV.setLineDash([]);
  const divY = y;
  const retLines = invWrap(t('invoice_returns_note'), CW - 30, { weight: 500, size: 9 });
  const footTextH = 52 + 12 * (retLines.length - 1);
  const FOOT = Math.max(footTextH + 48, 104);
  invStamp(W / 2, divY + FOOT / 2, 46);
  let fy = divY + (FOOT - footTextH) / 2 + 11;
  invText(t('invoice_thanks_line'), W / 2, fy, { style: 'italic', weight: 600, size: 15, color: C.ebony, align: 'center' });
  fy += 20;
  invNum('WhatsApp ' + invFormatPhone(SITE_WA_NUMBER) + '  ·  hadeejart.store', W / 2, fy, { weight: 800, size: 11.5, color: C.ebony, align: 'center' });
  fy += 6;
  retLines.forEach(s => { fy += 12; invText(s, W / 2, fy, { weight: 500, size: 9, color: C.dim, align: 'center' }); });
  y = divY + FOOT;
  invRibbon(y, 8);
  return y + 8;
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
