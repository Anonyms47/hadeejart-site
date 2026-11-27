/* ======================================================================
   Hadeej'Art — Générateur de QR code (hors ligne, sans service externe)
   Mode octets, correction d'erreur M, versions 1 à 4 (jusqu'à 62 octets :
   largement assez pour un lien wa.me). qrMatrix(texte) -> tableau de lignes
   de booléens (true = module sombre), ou null si le texte est trop long.
   ====================================================================== */
(function () {
  /* version -> { ec: octets de correction par bloc, blocks: [nb de blocs, octets de données par bloc], total } (niveau M) */
  const VER = { 1: { ec: 10, nb: 1, dc: 16 }, 2: { ec: 16, nb: 1, dc: 28 }, 3: { ec: 26, nb: 1, dc: 44 }, 4: { ec: 18, nb: 2, dc: 32 } };
  const ALIGN = { 1: null, 2: 18, 3: 22, 4: 26 };

  /* Corps de Galois GF(256), polynôme 0x11d */
  const EXP = new Array(512), LOG = new Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function rsGen(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function rsEncode(data, n) {
    const gen = rsGen(n), res = new Array(n).fill(0);
    for (const d of data) {
      const f = d ^ res[0];
      res.shift(); res.push(0);
      if (f) for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f);
    }
    return res;
  }

  function bchFormat(bits5) {
    let v = bits5 << 10;
    for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10);
    return ((bits5 << 10) | v) ^ 0x5412;
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function penalty(m) {
    const n = m.length; let p = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b < n; b++) {
          const cur = pass ? m[b][a] : m[a][b], prev = pass ? m[b - 1][a] : m[a][b - 1];
          if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
    const pat = [true, false, true, true, true, false, true, false, false, false, false], rev = pat.slice().reverse();
    const hit = (get, a, b, q) => q.every((v, i) => get(a, b + i) === v);
    for (let a = 0; a < n; a++) for (let b = 0; b <= n - 11; b++) {
      if (hit((r, c) => m[r][c], a, b, pat) || hit((r, c) => m[r][c], a, b, rev)) p += 40;
      if (hit((c, r) => m[r][c], a, b, pat) || hit((c, r) => m[r][c], a, b, rev)) p += 40;
    }
    let dark = 0; m.forEach(row => row.forEach(v => { if (v) dark++; }));
    p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return p;
  }

  window.qrMatrix = function (text) {
    const bytes = Array.from(unescape(encodeURIComponent(String(text))), ch => ch.charCodeAt(0));
    let ver = 0;
    for (let v = 1; v <= 4; v++) if (bytes.length <= VER[v].dc * VER[v].nb - 2) { ver = v; break; }
    if (!ver) return null;
    const { ec, nb, dc } = VER[ver], total = dc * nb;

    /* Flux de bits : mode octets (0100) + longueur + données + terminateur + bourrage */
    let bits = '0100' + bytes.length.toString(2).padStart(8, '0') + bytes.map(b => b.toString(2).padStart(8, '0')).join('');
    bits += '0'.repeat(Math.min(4, total * 8 - bits.length));
    bits += '0'.repeat((8 - (bits.length % 8)) % 8);
    const cw = bits.match(/.{8}/g).map(s => parseInt(s, 2));
    for (let i = 0; cw.length < total; i++) cw.push(i % 2 ? 0x11 : 0xec);

    const blocks = [];
    for (let b = 0; b < nb; b++) { const d = cw.slice(b * dc, (b + 1) * dc); blocks.push({ d, e: rsEncode(d, ec) }); }
    const out = [];
    for (let i = 0; i < dc; i++) blocks.forEach(b => out.push(b.d[i]));
    for (let i = 0; i < ec; i++) blocks.forEach(b => out.push(b.e[i]));
    const stream = out.map(b => b.toString(2).padStart(8, '0')).join('');

    const n = 17 + 4 * ver;
    const mk = () => Array.from({ length: n }, () => new Array(n).fill(false));
    const mod = mk(), fn = mk();
    const put = (r, c, v) => { if (r >= 0 && c >= 0 && r < n && c < n) { mod[r][c] = v; fn[r][c] = true; } };

    const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)); put(r0 + r, c0 + c, on); } };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { put(6, i, i % 2 === 0); put(i, 6, i % 2 === 0); }
    const a = ALIGN[ver];
    if (a) for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) put(a + r, a + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
    put(4 * ver + 9, 8, true);
    for (let i = 0; i < 9; i++) { if (!fn[8][i]) put(8, i, false); if (!fn[i][8]) put(i, 8, false); }
    for (let i = 0; i < 8; i++) { if (!fn[8][n - 1 - i]) put(8, n - 1 - i, false); if (!fn[n - 1 - i][8]) put(n - 1 - i, 8, false); }

    /* Placement des données en zigzag (de bas en haut, par paires de colonnes) */
    let idx = 0, up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let k = 0; k < n; k++) {
        const r = up ? n - 1 - k : k;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (!fn[r][c]) { mod[r][c] = idx < stream.length ? stream[idx] === '1' : false; idx++; }
        }
      }
      up = !up;
    }

    let best = null, bestP = Infinity;
    for (let mk8 = 0; mk8 < 8; mk8++) {
      const m = mod.map(row => row.slice());
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!fn[r][c] && MASKS[mk8](r, c)) m[r][c] = !m[r][c];
      const f = bchFormat((0 << 3) | mk8); /* niveau M = 00 */
      for (let i = 0; i < 15; i++) {
        const bit = ((f >> i) & 1) === 1;
        if (i < 6) m[i][8] = bit; else if (i < 8) m[i + 1][8] = bit; else m[n - 15 + i][8] = bit;
        if (i < 8) m[8][n - 1 - i] = bit; else if (i < 9) m[8][15 - i] = bit; else m[8][14 - i] = bit;
      }
      const p = penalty(m);
      if (p < bestP) { bestP = p; best = m; }
    }
    return best;
  };
})();
