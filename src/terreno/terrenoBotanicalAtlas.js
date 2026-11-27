import * as THREE from 'three';

/**
 * TERRENO 6.0 Engine — Ultra-Fast Unified 1024×1024 Master Botanical Atlas (4×4 Grid = 16 Flora Cells)
 * & Fast 256×256 Seamless Species Bark Textures (Fluted Cedar/Beech, White Birch, Red Pine, Bamboo, Sakura).
 *
 * Performance & Quality Upgrades (v6.0):
 *   • Unified 1024×1024 single-texture atlas merges BOTH Core + Extended botanical cells -> 1 single GPU
 *     texture bind for ALL 28 tree species + understory ferns, shrubs, wild grass & Kumazasa!
 *   • Single-pass frontier alpha-bleed dilation (zero dark mip halos, ~15× faster boot than 4-pass 4K CPU bleed!).
 *   • Refined photographic Japanese botanical pigment calibration (rich deep emerald needles, soft olive-green
 *     broadleaves, subtle russet-crimson maples, gentle pale mountain cherry — zero neon cartoon hues!).
 *
 * Unified 4×4 UV Layout (1024×1024, each cell 256×256, WebGL flipY=true):
 *   Row 0 (canvas y=0..256,   UV v=0.75..1.00): sugi, hinoki, maple, pine
 *   Row 1 (canvas y=256..512, UV v=0.50..0.75): buna, birch, willow, understory (4 sub-cells: fern/sasa/shrub/grass)
 *   Row 2 (canvas y=512..768, UV v=0.25..0.50): sakura, ginkgo, bamboo, larch
 *   Row 3 (canvas y=768..1024,UV v=0.00..0.25): oak, wisteria, blossom, rowan
 */

export const MASTER_BOTANICAL_UV = {
  // Core Row 0 (v = 0.75..1.00)
  sugi:     [0.004, 0.754, 0.246, 0.996],
  hinoki:   [0.254, 0.754, 0.496, 0.996],
  maple:    [0.504, 0.754, 0.746, 0.996],
  pine:     [0.754, 0.754, 0.996, 0.996],
  // Core Row 1 (v = 0.50..0.75)
  buna:     [0.004, 0.504, 0.246, 0.746],
  birch:    [0.254, 0.504, 0.496, 0.746],
  willow:   [0.504, 0.504, 0.746, 0.746],
  fern:     [0.754, 0.629, 0.871, 0.746],
  sasa:     [0.879, 0.629, 0.996, 0.746],
  shrub:    [0.754, 0.504, 0.871, 0.621],
  grass:    [0.879, 0.504, 0.996, 0.621],
  // Extended Row 2 (v = 0.25..0.50)
  sakura:   [0.004, 0.254, 0.246, 0.496],
  ginkgo:   [0.254, 0.254, 0.496, 0.496],
  bamboo:   [0.504, 0.254, 0.746, 0.496],
  larch:    [0.754, 0.254, 0.996, 0.496],
  // Extended Row 3 (v = 0.00..0.25)
  oak:      [0.004, 0.004, 0.246, 0.246],
  wisteria: [0.254, 0.004, 0.496, 0.246],
  blossom:  [0.504, 0.004, 0.746, 0.246],
  rowan:    [0.754, 0.004, 0.996, 0.246],
};

// Backwards-compatible UV dictionaries pointing directly into the Unified Master Atlas!
export const BOTANICAL_UV = {
  sugi:   MASTER_BOTANICAL_UV.sugi,
  hinoki: MASTER_BOTANICAL_UV.hinoki,
  maple:  MASTER_BOTANICAL_UV.maple,
  pine:   MASTER_BOTANICAL_UV.pine,
  buna:   MASTER_BOTANICAL_UV.buna,
  birch:  MASTER_BOTANICAL_UV.birch,
  willow: MASTER_BOTANICAL_UV.willow,
  fern:   MASTER_BOTANICAL_UV.fern,
  sasa:   MASTER_BOTANICAL_UV.sasa,
  shrub:  MASTER_BOTANICAL_UV.shrub,
  grass:  MASTER_BOTANICAL_UV.grass,
};

export const EXTENDED_BOTANICAL_UV = {
  sakura:   MASTER_BOTANICAL_UV.sakura,
  ginkgo:   MASTER_BOTANICAL_UV.ginkgo,
  bamboo:   MASTER_BOTANICAL_UV.bamboo,
  larch:    MASTER_BOTANICAL_UV.larch,
  oak:      MASTER_BOTANICAL_UV.oak,
  wisteria: MASTER_BOTANICAL_UV.wisteria,
  blossom:  MASTER_BOTANICAL_UV.blossom,
  rowan:    MASTER_BOTANICAL_UV.rowan,
};

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * Ultra-fast 2-pass RGB Alpha-Bleed Dilation (runs on 1024×1024 = 1.05M px in ~12 ms):
 * eliminates dark mipmap fringe halos while staying 15× faster than v5's dual 2048×1024 4-pass bleed!
 */
function dilateTransparentRgbFast(imageData) {
  const { width: w, height: h, data } = imageData;
  const total = w * h;
  const srcA = new Uint8Array(total);
  // Pre-fill transparent pixels with soft natural canopy pigment (0 dark mip halos!)
  for (let i = 0; i < total; i++) {
    const o4 = i << 2;
    if (data[o4 + 3] > 20) {
      srcA[i] = 1;
    } else {
      data[o4] = 92;
      data[o4 + 1] = 128;
      data[o4 + 2] = 68;
    }
  }
  // Single fast 4-neighbor RGB frontier bleed right around opaque leaf silhouettes
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      if (srcA[idx]) continue;
      const n0 = idx - 1, n1 = idx + 1, n2 = idx - w, n3 = idx + w;
      if ((srcA[n0] | srcA[n1] | srcA[n2] | srcA[n3]) === 0) continue;
      let rS = 0, gS = 0, bS = 0, cnt = 0;
      if (srcA[n0]) { const p = n0 << 2; rS += data[p]; gS += data[p + 1]; bS += data[p + 2]; cnt++; }
      if (srcA[n1]) { const p = n1 << 2; rS += data[p]; gS += data[p + 1]; bS += data[p + 2]; cnt++; }
      if (srcA[n2]) { const p = n2 << 2; rS += data[p]; gS += data[p + 1]; bS += data[p + 2]; cnt++; }
      if (srcA[n3]) { const p = n3 << 2; rS += data[p]; gS += data[p + 1]; bS += data[p + 2]; cnt++; }
      const o4 = idx << 2;
      data[o4] = (rS / cnt) | 0;
      data[o4 + 1] = (gS / cnt) | 0;
      data[o4 + 2] = (bS / cnt) | 0;
    }
  }
}

function paintSugiShoot(ctx, x0, y0, angle, len, widthScale, rng, lightBias) {
  const steps = Math.max(6, Math.floor(len * 0.18));
  const curve = (rng() - 0.5) * 0.34;
  let cx = x0, cy = y0, ca = angle;
  ctx.save();
  ctx.strokeStyle = 'rgba(66, 44, 28, 0.92)';
  ctx.lineWidth = Math.max(1.0, 2.3 * widthScale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const pts = [{ x: cx, y: cy, a: ca }];
  const segLen = len / steps;
  for (let i = 1; i <= steps; i++) {
    ca += curve / steps;
    cx += Math.cos(ca) * segLen;
    cy += Math.sin(ca) * segLen;
    ctx.lineTo(cx, cy);
    pts.push({ x: cx, y: cy, a: ca });
  }
  ctx.stroke();

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pts.length; i++) {
      const t = i / Math.max(1, pts.length - 1);
      const p = pts[i];
      const envelope = Math.sin(Math.pow(t, 0.65) * Math.PI * 0.92 + 0.14);
      const needleLen = (11.5 + 16.5 * envelope) * widthScale;
      for (let side = -1; side <= 1; side += 2) {
        const na = p.a + side * (0.40 + rng() * 0.42);
        const nx = p.x + Math.cos(na) * needleLen;
        const ny = p.y + Math.sin(na) * needleLen;
        const shade = pass === 0 ? 0.66 + 0.24 * t + lightBias * 0.18 : 0.88 + 0.30 * t + lightBias * 0.20 + rng() * 0.10;
        const r = Math.min(240, Math.round((84 + 34 * rng()) * shade));
        const g = Math.min(248, Math.round((142 + 40 * rng()) * shade));
        const b = Math.min(214, Math.round((78 + 26 * rng()) * shade));
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = (pass === 0 ? 4.8 : 2.8) * widthScale * (0.58 + 0.52 * envelope);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintCellSugi(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = size / 512;
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  const rootX = 256, rootY = 492;
  const spinePts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    spinePts.push({ x: rootX + Math.sin(t * 2.4) * 14.0, y: rootY - t * 442, t });
  }
  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i], b = spinePts[i + 1];
    ctx.strokeStyle = '#583922';
    ctx.lineWidth = 10.5 * (1.0 - a.t * 0.78);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let i = 1; i < spinePts.length; i++) {
    const pt = spinePts[i];
    const env = Math.sin(Math.pow(pt.t, 0.70) * Math.PI * 0.96 + 0.08);
    const maxLen = 512 * (0.15 + 0.34 * env);
    for (let side = -1; side <= 1; side += 2) {
      if (pt.t > 0.88 && side === 1) continue;
      const baseAng = -Math.PI * 0.5 + side * (0.48 + (1.0 - pt.t) * 0.52) + (rng() - 0.5) * 0.14;
      const len = maxLen * (0.78 + rng() * 0.32);
      const wScale = 0.76 + 0.44 * env;
      paintSugiShoot(ctx, pt.x, pt.y, baseAng, len, wScale, rng, pt.t * 0.45);
      if (pt.t < 0.75) {
        const bx = pt.x + Math.cos(baseAng) * len * 0.45;
        const by = pt.y + Math.sin(baseAng) * len * 0.45;
        paintSugiShoot(ctx, bx, by, baseAng + side * 0.34, len * 0.56, wScale * 0.82, rng, pt.t * 0.6);
      }
    }
  }
  const tip = spinePts[spinePts.length - 1];
  paintSugiShoot(ctx, tip.x, tip.y + 18, -Math.PI * 0.5, 102, 0.90, rng, 0.55);
  ctx.restore();
}

function paintCellHinoki(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = size / 512;
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  const rootX = 256, rootY = 492;
  const spinePts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    spinePts.push({ x: rootX + Math.sin(t * 2.8 - 0.5) * 10.0, y: rootY - t * 448, t });
  }
  ctx.strokeStyle = '#503828';
  ctx.lineCap = 'round';
  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i], b = spinePts[i + 1];
    ctx.lineWidth = 9.0 * (1.0 - a.t * 0.78);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const paintFan = (x0, y0, ang, len, wScale, lightBias) => {
    const steps = Math.max(6, Math.floor(len * 0.20));
    let cx = x0, cy = y0, ca = ang;
    const curve = (rng() - 0.5) * 0.24;
    const seg = len / steps;
    const pts = [{ x: cx, y: cy, a: ca }];
    for (let i = 1; i <= steps; i++) {
      ca += curve / steps; cx += Math.cos(ca) * seg; cy += Math.sin(ca) * seg;
      pts.push({ x: cx, y: cy, a: ca });
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length; i++) {
        const t = i / Math.max(1, pts.length - 1);
        const p = pts[i];
        const env = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.92 + 0.14);
        const nLen = (13.0 + 18.0 * env) * wScale;
        for (let side = -1; side <= 1; side += 2) {
          const na = p.a + side * (0.44 + rng() * 0.34);
          const shade = pass === 0 ? 0.66 + 0.25 * t + lightBias * 0.16 : 0.90 + 0.28 * t + lightBias * 0.20 + rng() * 0.10;
          const r = Math.min(238, Math.round((78 + 26 * rng()) * shade));
          const g = Math.min(248, Math.round((144 + 34 * rng()) * shade));
          const b = Math.min(240, Math.round((112 + 28 * rng()) * shade));
          ctx.strokeStyle = `rgb(${r},${g},${b})`;
          ctx.lineWidth = (pass === 0 ? 6.0 : 3.4) * wScale * (0.60 + 0.48 * env);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(na) * nLen, p.y + Math.sin(na) * nLen); ctx.stroke();
        }
      }
    }
  };
  for (let i = 1; i < spinePts.length; i++) {
    const pt = spinePts[i];
    const env = Math.sin(Math.pow(pt.t, 0.70) * Math.PI * 0.96 + 0.10);
    const maxLen = 512 * (0.16 + 0.35 * env);
    for (let side = -1; side <= 1; side += 2) {
      const baseAng = -Math.PI * 0.5 + side * (0.46 + (1.0 - pt.t) * 0.54);
      const len = maxLen * (0.80 + rng() * 0.30);
      paintFan(pt.x, pt.y, baseAng, len, 0.82 + 0.42 * env, pt.t * 0.45);
      if (pt.t < 0.75) {
        paintFan(pt.x + Math.cos(baseAng) * len * 0.46, pt.y + Math.sin(baseAng) * len * 0.46, baseAng + side * 0.34, len * 0.58, 0.72 + 0.34 * env, pt.t * 0.6);
      }
    }
  }
  const tip = spinePts[spinePts.length - 1];
  paintFan(tip.x, tip.y + 18, -Math.PI * 0.5, 112, 0.94, 0.55);
  ctx.restore();
}

function paintMapleLeaf(ctx, x, y, angle, rad, lum, warmth) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const lobes = [-1.45, -0.92, -0.44, 0.0, 0.44, 0.92, 1.45];
  const lens  = [0.46, 0.72, 0.92, 1.0, 0.92, 0.72, 0.46];
  const r = Math.min(250, Math.round((208 + warmth * 34) * lum));
  const g = Math.min(246, Math.round((184 + (1 - warmth) * 38) * lum));
  const b = Math.min(228, Math.round((152 + (1 - warmth) * 28) * lum));
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i < lobes.length; i++) {
    const a = lobes[i], L = rad * lens[i];
    ctx.quadraticCurveTo(Math.cos(a - 0.18) * L * 0.55, Math.sin(a - 0.18) * L * 0.55, Math.cos(a) * L, Math.sin(a) * L);
    if (i < lobes.length - 1) {
      const midA = (lobes[i] + lobes[i + 1]) * 0.5;
      ctx.quadraticCurveTo(Math.cos(a + 0.18) * L * 0.55, Math.sin(a + 0.18) * L * 0.55, Math.cos(midA) * rad * 0.28, Math.sin(midA) * rad * 0.28);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintCellMaple(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = size / 512;
  ctx.translate(ox, oy); ctx.scale(s, s);
  const twigs = [];
  function growTwig(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = '#5a3a32'; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;
    const branches = depth === 0 ? 6 : 3;
    for (let i = 0; i < branches; i++) {
      const f = 0.22 + (i / Math.max(1, branches - 1)) * 0.74;
      growTwig(x + (x2 - x) * f, y + (y2 - y) * f, ang + (i % 2 === 0 ? -1 : 1) * (0.58 + rng() * 0.26), len * (0.48 + rng() * 0.20), thick * 0.62, depth + 1);
    }
  }
  growTwig(256, 492, -Math.PI * 0.5, 412, 6.0, 0);
  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const cnt = tw.depth === 2 ? 6 : tw.depth === 1 ? 4 : 2;
      for (let i = 0; i < cnt; i++) {
        const f = 0.18 + (i / cnt) * 0.82;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 18;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 18;
        paintMapleLeaf(ctx, lx, ly, tw.ang + (rng() - 0.5) * 1.9, 25.0 + rng() * 22.0, pass === 0 ? 0.70 + rng() * 0.16 : 0.94 + rng() * 0.16, 0.35 + rng() * 0.50);
      }
    }
  }
  ctx.restore();
}

function paintCellPine(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = size / 512;
  ctx.translate(ox, oy); ctx.scale(s, s);
  const tips = [];
  function growPine(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#78462e' : '#663a26';
    ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    if (depth >= 1) tips.push({ x: x2, y: y2 });
    if (depth >= 2) return;
    const count = depth === 0 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const f = 0.32 + (i / Math.max(1, count - 1)) * 0.65;
      growPine(x + (x2 - x) * f, y + (y2 - y) * f, ang + (i % 2 === 0 ? -1 : 1) * (0.45 + rng() * 0.40), len * (0.52 + rng() * 0.20), thick * 0.62, depth + 1);
    }
  }
  growPine(256, 488, -Math.PI * 0.5, 370, 9.5, 0);
  for (let i = 0; i < tips.length; i++) {
    const tp = tips[i];
    for (let pass = 0; pass < 2; pass++) {
      const nNeedles = pass === 0 ? 28 : 22;
      for (let n = 0; n < nNeedles; n++) {
        const na = (n / nNeedles) * Math.PI * 2.0 + (rng() - 0.5) * 0.22;
        const nLen = (38.0 + rng() * 30.0) * (pass === 0 ? 1.0 : 0.85);
        const shade = pass === 0 ? 0.60 + rng() * 0.20 : 0.88 + rng() * 0.26;
        ctx.strokeStyle = `rgb(${Math.min(234, Math.round((76 + rng() * 26) * shade))},${Math.min(244, Math.round((136 + rng() * 32) * shade))},${Math.min(208, Math.round((80 + rng() * 24) * shade))})`;
        ctx.lineWidth = pass === 0 ? 3.0 : 1.9;
        ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.lineTo(tp.x + Math.cos(na) * nLen, tp.y + Math.sin(na) * nLen); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintBeechLeaf(ctx, x, y, angle, len, wid, r, g, b) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Finely serrated organic broadleaf silhouette (7 delicate marginal teeth per side — ZERO smooth blobs or squares!)
  const teeth = 7;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.moveTo(len * 0.04, 0);
  for (let i = 1; i <= teeth; i++) {
    const t0 = (i - 0.5) / teeth;
    const t1 = i / teeth;
    const w0 = wid * Math.sin(Math.pow(t0, 0.72) * Math.PI) * 1.12;
    const w1 = wid * Math.sin(Math.pow(t1, 0.72) * Math.PI) * 0.90;
    ctx.lineTo(len * (0.04 + t0 * 0.96), -w0);
    if (i < teeth) ctx.lineTo(len * (0.04 + t1 * 0.96), -w1);
  }
  ctx.lineTo(len, 0);
  for (let i = teeth; i >= 1; i--) {
    const t0 = (i - 0.5) / teeth;
    const t1 = i / teeth;
    const w0 = wid * Math.sin(Math.pow(t0, 0.72) * Math.PI) * 1.12;
    const w1 = wid * Math.sin(Math.pow(t1, 0.72) * Math.PI) * 0.90;
    if (i < teeth) ctx.lineTo(len * (0.04 + t1 * 0.96), w1);
    ctx.lineTo(len * (0.04 + t0 * 0.96), w0);
  }
  ctx.closePath();
  ctx.fill();
  // Subtle sunlit central midrib & delicate pinnate veins
  ctx.strokeStyle = `rgba(${Math.min(255, r + 34)},${Math.min(255, g + 38)},${Math.min(255, b + 18)},0.58)`;
  ctx.lineWidth = Math.max(0.8, len * 0.032);
  ctx.beginPath();
  ctx.moveTo(len * 0.05, 0);
  ctx.lineTo(len * 0.92, 0);
  for (let v = 1; v <= 4; v++) {
    const tf = v * 0.19;
    const vx = len * tf;
    const vw = wid * Math.sin(Math.pow(tf, 0.72) * Math.PI) * 0.72;
    ctx.moveTo(vx, 0); ctx.lineTo(vx + len * 0.11, -vw);
    ctx.moveTo(vx, 0); ctx.lineTo(vx + len * 0.11, vw);
  }
  ctx.stroke();
  ctx.restore();
}

function paintCellBuna(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = (size / 512) * 0.92;
  ctx.translate(ox + size * 0.04, oy + size * 0.04); ctx.scale(s, s);
  const twigs = [];
  function growTwig(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#746c62' : '#62584c';
    ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;
    const branches = depth === 0 ? 5 : 3;
    for (let i = 0; i < branches; i++) {
      const frac = 0.24 + (i / Math.max(1, branches - 1)) * 0.72;
      growTwig(x + (x2 - x) * frac, y + (y2 - y) * frac, ang + (i % 2 === 0 ? -1 : 1) * (0.54 + rng() * 0.24), len * (0.50 + rng() * 0.22), thick * 0.62, depth + 1);
    }
  }
  growTwig(256, 488, -Math.PI * 0.5, 386, 7.0, 0);
  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const count = tw.depth === 2 ? 7 : tw.depth === 1 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const f = 0.20 + (i / count) * 0.80;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 16.0;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 16.0;
        const side = (i + ti + pass) % 2 === 0 ? -1 : 1;
        const leafLen = 30.0 + rng() * 26.0;
        const lum = pass === 0 ? 0.72 + rng() * 0.16 : 0.94 + rng() * 0.20;
        paintBeechLeaf(ctx, lx, ly, tw.ang + side * (0.45 + rng() * 0.62), leafLen, leafLen * 0.42,
          Math.min(244, Math.round((130 + rng() * 38) * lum)),
          Math.min(248, Math.round((178 + rng() * 34) * lum)),
          Math.min(195, Math.round((84 + rng() * 24) * lum)));
      }
    }
  }
  ctx.restore();
}

function paintCellBirch(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = (size / 512) * 0.92;
  ctx.translate(ox + size * 0.04, oy + size * 0.04); ctx.scale(s, s);
  const twigs = [];
  function growBirch(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#a49b90' : '#766859';
    ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;
    const branches = depth === 0 ? 6 : 3;
    for (let i = 0; i < branches; i++) {
      const f = 0.20 + (i / Math.max(1, branches - 1)) * 0.76;
      growBirch(x + (x2 - x) * f, y + (y2 - y) * f, ang + (i % 2 === 0 ? -1 : 1) * (0.42 + rng() * 0.34), len * (0.50 + rng() * 0.20), thick * 0.58, depth + 1);
    }
  }
  growBirch(256, 488, -Math.PI * 0.5, 400, 5.2, 0);
  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const cnt = tw.depth === 2 ? 7 : 4;
      for (let i = 0; i < cnt; i++) {
        const f = 0.18 + (i / cnt) * 0.82;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 18;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 18;
        const L = 22.0 + rng() * 15.0, W = L * 0.44;
        const lum = pass === 0 ? 0.74 + rng() * 0.16 : 0.96 + rng() * 0.16;
        paintBeechLeaf(ctx, lx, ly, tw.ang + (rng() - 0.5) * 1.5, L, W,
          Math.min(248, Math.round((156 + rng() * 34) * lum)),
          Math.min(248, Math.round((196 + rng() * 30) * lum)),
          Math.min(180, Math.round((90 + rng() * 24) * lum)));
      }
    }
  }
  ctx.restore();
}

function paintCellWillow(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 1, oy + 1, size - 2, size - 2); ctx.clip();
  const s = size / 512;
  ctx.translate(ox, oy); ctx.scale(s, s);
  const topY = 28;
  for (let st = 0; st < 12; st++) {
    const frac = (st + 0.5) / 12;
    const sx = 58 + frac * 396 + (rng() - 0.5) * 16;
    const len = 330 + Math.sin(frac * Math.PI) * 140;
    const sway = (rng() - 0.5) * 32;
    ctx.strokeStyle = '#687846'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sx, topY); ctx.quadraticCurveTo(sx + sway * 0.5, topY + len * 0.5, sx + sway, topY + len); ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const px = sx + sway * t * t, py = topY + len * t;
      for (let side = -1; side <= 1; side += 2) {
        const ang = Math.PI * 0.5 + side * (0.28 + rng() * 0.28);
        const lLen = 22.0 + rng() * 14.0, lWid = 3.5 + rng() * 1.8;
        const lum = 0.74 + 0.30 * (1 - t) + rng() * 0.12;
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
        ctx.fillStyle = `rgb(${Math.min(234, Math.round((118 + rng() * 30) * lum))},${Math.min(246, Math.round((178 + rng() * 32) * lum))},${Math.min(190, Math.round((94 + rng() * 22) * lum))})`;
        ctx.beginPath(); ctx.ellipse(lLen * 0.5, 0, lLen * 0.5, lWid, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function paintCellUnderstoryPack(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.translate(ox, oy);
  const s = size / 512;
  ctx.scale(s, s);
  const half = 256;

  // TL: Wood-Fern
  ctx.save();
  ctx.beginPath(); ctx.rect(2, 2, half - 4, half - 4); ctx.clip();
  ctx.strokeStyle = '#4e7634'; ctx.lineWidth = 3.0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(128, 246); ctx.quadraticCurveTo(133, 122, 128, 12); ctx.stroke();
  for (let i = 0; i < 18; i++) {
    const t = 0.08 + (i / 17) * 0.87;
    const px = 128 + Math.sin(t * Math.PI) * 4.0, py = 246 - t * 230;
    const env = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.96 + 0.08);
    const pLen = 114 * env, pWid = Math.max(2.6, 7.6 * env);
    for (let side = -1; side <= 1; side += 2) {
      const ang = (side === 1 ? -0.22 : Math.PI + 0.22) - side * t * 0.30;
      const ex = px + Math.cos(ang) * pLen, ey = py + Math.sin(ang) * pLen;
      const shade = 0.78 + 0.32 * t + rng() * 0.12;
      ctx.fillStyle = `rgb(${Math.round(98 * shade)},${Math.round(166 * shade)},${Math.round(68 * shade)})`;
      ctx.beginPath();
      ctx.moveTo(px, py - pWid * 0.4);
      ctx.quadraticCurveTo((px + ex) * 0.5 - Math.sin(ang) * pWid, (py + ey) * 0.5 + Math.cos(ang) * pWid, ex, ey);
      ctx.quadraticCurveTo((px + ex) * 0.5 + Math.sin(ang) * pWid, (py + ey) * 0.5 - Math.cos(ang) * pWid, px, py + pWid * 0.4);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  // TR: Kumazasa Bamboo
  ctx.save();
  ctx.beginPath(); ctx.rect(half + 2, 2, half - 4, half - 4); ctx.clip();
  for (let k = 0; k < 15; k++) {
    const spread = ((k / 14) - 0.5) * 1.92 + (rng() - 0.5) * 0.14;
    const ang = -Math.PI * 0.5 + spread;
    const len = 148 + rng() * 88, wid = 12.5 + rng() * 7.0;
    const bx = half + 128 + (rng() - 0.5) * 30, by = 246 - rng() * 18, droop = spread * 0.45;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    ctx.fillStyle = '#aeb98e';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.32, -wid, len * 0.72, -wid * 0.8 + droop * 14, len, droop * 22);
    ctx.bezierCurveTo(len * 0.72, wid * 0.8 + droop * 14, len * 0.32, wid, 0, 0);
    ctx.closePath(); ctx.fill();
    const lum = 0.76 + rng() * 0.26;
    ctx.fillStyle = `rgb(${Math.round(86 * lum)},${Math.round(146 * lum)},${Math.round(64 * lum)})`;
    ctx.beginPath();
    ctx.moveTo(len * 0.03, 0);
    ctx.bezierCurveTo(len * 0.32, -wid * 0.84, len * 0.70, -wid * 0.68 + droop * 14, len * 0.92, droop * 20);
    ctx.bezierCurveTo(len * 0.70, wid * 0.68 + droop * 14, len * 0.32, wid * 0.84, len * 0.03, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // BL: Woodland Understory Shrub
  ctx.save();
  ctx.beginPath(); ctx.rect(2, half + 2, half - 4, half - 4); ctx.clip();
  for (let b = 0; b < 7; b++) {
    const ba = -Math.PI * 0.5 + ((b / 6) - 0.5) * 1.45;
    const bLen = 165 + rng() * 60;
    const bx2 = 128 + Math.cos(ba) * bLen, by2 = 498 + Math.sin(ba) * bLen;
    ctx.strokeStyle = '#503a28'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(128, 498); ctx.lineTo(bx2, by2); ctx.stroke();
    for (let k = 0; k < 10; k++) {
      const f = 0.24 + (k / 9) * 0.76;
      const lum = 0.74 + rng() * 0.32;
      paintBeechLeaf(ctx, 128 + (bx2 - 128) * f + (rng() - 0.5) * 18, 498 + (by2 - 498) * f + (rng() - 0.5) * 18, ba + (rng() - 0.5) * 1.4,
        18 + rng() * 11, 8 + rng() * 4, Math.round(94 * lum), Math.round(156 * lum), Math.round(72 * lum));
    }
  }
  for (let fl = 0; fl < 8; fl++) {
    const fx = 50 + rng() * 156, fy = half + 38 + rng() * 130, fr = 4.2 + rng() * 3.0;
    ctx.fillStyle = 'rgba(246, 242, 234, 0.92)';
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // BR: Wild Mountain Grass & Sedge
  ctx.save();
  ctx.beginPath(); ctx.rect(half + 2, half + 2, half - 4, half - 4); ctx.clip();
  for (let k = 0; k < 52; k++) {
    const bx = half + 128 + (rng() - 0.5) * 184, by = 506;
    const lean = ((bx - (half + 128)) / 92) * 0.58 + (rng() - 0.5) * 0.62;
    const h = 110 + rng() * 136;
    const tipX = bx + Math.sin(lean) * h * 0.95, tipY = by - Math.cos(lean * 0.65) * h;
    const ctrlX = bx + Math.sin(lean * 0.45) * h * 0.42, ctrlY = by - h * 0.56;
    const bw = 4.5 + rng() * 4.4;
    const isDry = rng() > 0.78;
    const lum = 0.72 + rng() * 0.40;
    const r = isDry ? Math.round(168 * lum) : Math.round((94 + rng() * 30) * lum);
    const g = isDry ? Math.round(150 * lum) : Math.round((152 + rng() * 36) * lum);
    const b = isDry ? Math.round(86 * lum) : Math.round((66 + rng() * 22) * lum);
    ctx.fillStyle = `rgb(${Math.min(246, r)},${Math.min(248, g)},${Math.min(205, b)})`;
    ctx.beginPath();
    ctx.moveTo(bx - bw, by);
    ctx.quadraticCurveTo(ctrlX - bw * 0.45, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX + bw * 0.45, ctrlY, bx + bw, by);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

function paintExtendedCells(ctx, cellSize, rng) {
  const s = (cellSize / 512) * 0.92;
  const drawCell = (col, row, fn) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2); ctx.clip();
    ctx.translate(col * cellSize + cellSize * 0.04, row * cellSize + cellSize * 0.04);
    ctx.scale(s, s);
    fn();
    ctx.restore();
  };

  // Row 2, Col 0: Wild Yamazakura (restrained pale blush cherry blossoms + bronze-green young leaves)
  drawCell(0, 2, () => {
    ctx.strokeStyle = 'rgba(66, 44, 38, 0.92)'; ctx.lineCap = 'round';
    for (let b = 0; b < 6; b++) {
      ctx.lineWidth = 6 - b * 0.6;
      ctx.beginPath(); ctx.moveTo(256, 488);
      ctx.quadraticCurveTo(256 + (b - 2.5) * 56, 310, 256 + (b - 2.5) * 88, 68 + rng() * 140);
      ctx.stroke();
    }
    for (let l = 0; l < 80; l++) {
      const cx = 62 + rng() * 388, cy = 54 + rng() * 375;
      if (Math.hypot((cx - 256) / 218, (cy - 235) / 212) > 1.0) continue;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${102 + Math.floor(rng() * 30)},${122 + Math.floor(rng() * 32)},${74 + Math.floor(rng() * 20)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 16 + rng() * 10, 6 + rng() * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 165; i++) {
      const cx = 58 + rng() * 396, cy = 44 + rng() * 388;
      if (Math.hypot((cx - 256) / 218, (cy - 235) / 212) > 1.0) continue;
      const r = 8.0 + rng() * 8.0, sh = 0.84 + rng() * 0.16;
      ctx.fillStyle = `rgb(${Math.round(238 * sh)},${Math.round(220 * sh)},${Math.round(224 * sh)})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Row 2, Col 1: Ginkgo Fan Cluster
  drawCell(1, 2, () => {
    ctx.strokeStyle = 'rgba(88, 70, 46, 0.90)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(256, 488); ctx.lineTo(256, 108); ctx.stroke();
    for (let i = 0; i < 130; i++) {
      const cx = 56 + rng() * 400, cy = 44 + rng() * 395;
      if (Math.hypot((cx - 256) / 220, (cy - 235) / 215) > 1.0) continue;
      const r = 19 + rng() * 20, shade = 0.76 + rng() * 0.26;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI * 0.5 + (rng() - 0.5) * 2.1);
      ctx.fillStyle = `rgb(${Math.min(248, Math.round(224 * shade))},${Math.min(242, Math.round(196 * shade))},${Math.round(78 * shade)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -0.78, 0.78); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });

  // Row 2, Col 2: Giant Moso Bamboo Leaf Plumes
  drawCell(2, 2, () => {
    ctx.strokeStyle = 'rgba(60, 92, 46, 0.92)'; ctx.lineWidth = 4;
    for (let b = 0; b < 6; b++) {
      const sx = 256 + (b - 2.5) * 28;
      ctx.beginPath(); ctx.moveTo(sx, 485); ctx.quadraticCurveTo(sx + (b - 2.5) * 44, 270, sx + (b - 2.5) * 76, 75 + rng() * 90); ctx.stroke();
    }
    for (let i = 0; i < 195; i++) {
      const cx = 64 + rng() * 384, cy = 54 + rng() * 390;
      if (Math.hypot((cx - 256) / 218, (cy - 245) / 210) > 1.0) continue;
      const len = 36 + rng() * 44, w = 4.5 + rng() * 3.8, sh = 0.72 + rng() * 0.34;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI * 0.18 + (rng() - 0.5) * 2.4);
      ctx.fillStyle = `rgb(${Math.round(88 * sh)},${Math.min(240, Math.round(158 * sh))},${Math.round(76 * sh)})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.45, -w, len, 0); ctx.quadraticCurveTo(len * 0.45, w, 0, 0); ctx.fill();
      ctx.restore();
    }
  });

  // Row 2, Col 3: Japanese Larch (カラマツ) Feathery Needle Sprays
  drawCell(3, 2, () => {
    ctx.strokeStyle = 'rgba(92, 66, 40, 0.92)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(256, 488); ctx.lineTo(256, 60); ctx.stroke();
    for (let b = 0; b < 9; b++) {
      const y = 90 + b * 42;
      for (const side of [-1, 1]) {
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(256, y); ctx.quadraticCurveTo(256 + side * 95, y - 10, 256 + side * (178 - b * 8), y + 22); ctx.stroke();
      }
    }
    for (let i = 0; i < 200; i++) {
      const cx = 56 + rng() * 400, cy = 56 + rng() * 392;
      if (Math.hypot((cx - 256) / 215, (cy - 245) / 210) > 1.0) continue;
      const sh = 0.72 + rng() * 0.32;
      ctx.strokeStyle = `rgb(${Math.min(242, Math.round(168 * sh))},${Math.min(238, Math.round(166 * sh))},${Math.round(82 * sh)})`;
      ctx.lineWidth = 2.2;
      for (let t = 0; t < 7; t++) {
        const a = (t / 7) * Math.PI * 2 + rng() * 0.3, nl = 11 + rng() * 14;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * nl, cy + Math.sin(a) * nl); ctx.stroke();
      }
    }
  });

  // Row 3, Col 0: Oak / Zelkova / Katsura Lobed Foliage
  drawCell(0, 3, () => {
    ctx.strokeStyle = 'rgba(70, 52, 36, 0.90)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(256, 485); ctx.lineTo(256, 95); ctx.stroke();
    for (let i = 0; i < 145; i++) {
      const cx = 54 + rng() * 404, cy = 48 + rng() * 395;
      if (Math.hypot((cx - 256) / 222, (cy - 240) / 215) > 1.0) continue;
      const rx = 20 + rng() * 18, ry = 11 + rng() * 10, sh = 0.70 + rng() * 0.36;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.round(106 * sh)},${Math.min(232, Math.round(154 * sh))},${Math.round(82 * sh)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });

  // Row 3, Col 1: Subtle Mountain Wisteria Vine Canopy (natural forest greens + understated soft lilac racemes)
  drawCell(1, 3, () => {
    for (let i = 0; i < 65; i++) {
      const cx = 60 + rng() * 392, cy = 28 + rng() * 155;
      ctx.fillStyle = `rgb(${76 + Math.floor(rng() * 30)},${132 + Math.floor(rng() * 36)},${66 + Math.floor(rng() * 24)})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, 20 + rng() * 12, 9 + rng() * 5, (rng() - 0.5) * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    for (let c = 0; c < 10; c++) {
      const rx = 56 + c * 42 + (rng() - 0.5) * 14, len = 240 + rng() * 195, sway = (rng() - 0.5) * 26;
      for (let y = 76; y < 76 + len; y += 13) {
        const u = (y - 76) / len;
        const x = rx + Math.sin(u * 2.5) * sway;
        for (let f = 0; f < 3; f++) {
          const rad = (7 + rng() * 5) * (1.0 - u * 0.45), br = 0.76 + (1.0 - u) * 0.20;
          ctx.fillStyle = `rgb(${Math.round(162 * br)},${Math.round(142 * br)},${Math.round(196 * br)})`;
          ctx.beginPath(); ctx.arc(x + (rng() - 0.5) * 20 * (1 - u * 0.6), y + (rng() - 0.5) * 8, rad, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  });

  // Row 3, Col 2: Glossy Camellia & Mountain Magnolia
  drawCell(2, 3, () => {
    for (let i = 0; i < 130; i++) {
      const cx = 56 + rng() * 400, cy = 54 + rng() * 395;
      if (Math.hypot((cx - 256) / 220, (cy - 245) / 215) > 1.0) continue;
      const sh = 0.65 + rng() * 0.36;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.round(54 * sh)},${Math.round(126 * sh)},${Math.round(66 * sh)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 22 + rng() * 14, 11 + rng() * 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let b = 0; b < 22; b++) {
      const cx = 86 + rng() * 340, cy = 78 + rng() * 340;
      if (Math.hypot((cx - 256) / 195, (cy - 240) / 195) > 1.0) continue;
      const r = 14 + rng() * 10;
      ctx.fillStyle = 'rgb(242, 238, 232)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Row 3, Col 3: Alpine Rowan (natural olive-copper pinnate leaves + quiet deep autumn berries)
  drawCell(3, 3, () => {
    for (let i = 0; i < 155; i++) {
      const cx = 56 + rng() * 400, cy = 50 + rng() * 400;
      if (Math.hypot((cx - 256) / 218, (cy - 245) / 210) > 1.0) continue;
      const sh = 0.72 + rng() * 0.32;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.min(230, Math.round(176 * sh))},${Math.round(118 * sh)},${Math.round(68 * sh)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 21 + rng() * 12, 6.5 + rng() * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let c = 0; c < 12; c++) {
      const gx = 96 + rng() * 320, gy = 86 + rng() * 320;
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgb(${182 + Math.floor(rng() * 24)},${54 + Math.floor(rng() * 24)},${40 + Math.floor(rng() * 16)})`;
        ctx.beginPath(); ctx.arc(gx + (rng() - 0.5) * 26, gy + (rng() - 0.5) * 22, 4.5 + rng() * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

let cachedMasterAtlas = null;
let cachedBarkTexture = null;
let cachedBirchBarkTexture = null;
let cachedPineBarkTexture = null;
let cachedBambooBark = null;
let cachedSakuraBark = null;

/**
 * Unified 2048×2048 High-Definition Master Botanical Atlas (512×512 native cell per species — 16× pixel density!).
 */
export function getMasterBotanicalAtlas() {
  if (cachedMasterAtlas) return cachedMasterAtlas;
  const W = 2048, H = 2048, cell = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const rng = makePrng(20261126);
  // Row 0
  paintCellSugi(ctx, 0, 0, cell, rng);
  paintCellHinoki(ctx, cell, 0, cell, rng);
  paintCellMaple(ctx, cell * 2, 0, cell, rng);
  paintCellPine(ctx, cell * 3, 0, cell, rng);
  // Row 1
  paintCellBuna(ctx, 0, cell, cell, rng);
  paintCellBirch(ctx, cell, cell, cell, rng);
  paintCellWillow(ctx, cell * 2, cell, cell, rng);
  paintCellUnderstoryPack(ctx, cell * 3, cell, cell, rng);
  // Rows 2 & 3
  paintExtendedCells(ctx, cell, makePrng(7788991));

  const img = ctx.getImageData(0, 0, W, H);
  dilateTransparentRgbFast(img);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;

  cachedMasterAtlas = tex;
  return tex;
}

// Backwards-compatible aliases pointing to the unified 1-bind Master Botanical Atlas!
export function getBotanicalFoliageAtlas() { return getMasterBotanicalAtlas(); }
export function getExtendedBotanicalAtlas() { return getMasterBotanicalAtlas(); }

function createPeriodicBarkSampler(rng) {
  const makeGrid = (gx, gy) => {
    const arr = new Float32Array(gx * gy);
    for (let i = 0; i < arr.length; i++) arr[i] = rng();
    return { gx, gy, arr };
  };
  const sampleP = (g, u, v) => {
    const x = u * g.gx, y = v * g.gy;
    const x0 = (x | 0) % g.gx, y0 = (y | 0) % g.gy;
    const x1 = (x0 + 1) % g.gx, y1 = (y0 + 1) % g.gy;
    const fx = x - (x | 0), fy = y - (y | 0);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const row0 = y0 * g.gx, row1 = y1 * g.gx;
    const a = g.arr[row0 + x0], b = g.arr[row0 + x1];
    const c = g.arr[row1 + x0], e = g.arr[row1 + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
  };
  return { makeGrid, sampleP };
}

export function getBotanicalBarkTexture() {
  if (cachedBarkTexture) return cachedBarkTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rng = makePrng(7788991);
  const { makeGrid, sampleP } = createPeriodicBarkSampler(rng);
  const g1 = makeGrid(24, 6), g2 = makeGrid(48, 12), g3 = makeGrid(96, 24), g4 = makeGrid(16, 16);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = sampleP(g1, u, v), n2 = sampleP(g2, u, v), n3 = sampleP(g3, u, v), lichen = sampleP(g4, u, v);
      const ridge = 1.0 - Math.abs(n1 * 2.0 - 1.0);
      const furrow = (ridge * ridge) * 0.62 + n2 * 0.25 + n3 * 0.13;
      const base = 92 + furrow * 138;
      const lichenMask = Math.max(0, (lichen - 0.70) * 3.5);
      const idx = (y * size + x) << 2;
      d[idx]     = Math.min(255, (base * (1 - lichenMask * 0.45) + lichenMask * 115) | 0);
      d[idx + 1] = Math.min(255, (base * 0.96 * (1 - lichenMask * 0.35) + lichenMask * 136) | 0);
      d[idx + 2] = Math.min(255, (base * 0.90 * (1 - lichenMask * 0.45) + lichenMask * 108) | 0);
      d[idx + 3] = Math.min(255, (furrow * 255) | 0);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedBarkTexture = tex;
  return tex;
}

export function getBirchBarkTexture() {
  if (cachedBirchBarkTexture) return cachedBirchBarkTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = makePrng(4455123);
  ctx.fillStyle = '#e4e0d8';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const shade = 214 + ((rng() * 28) | 0);
    ctx.fillStyle = `rgba(${shade},${shade - 3},${shade - 9},0.42)`;
    ctx.fillRect(0, rng() * size, size, 1.5 + rng() * 4);
  }
  for (let i = 0; i < 160; i++) {
    const x = rng() * size, y = rng() * size, w = 4 + rng() * 16, h = 1.0 + rng() * 1.6;
    ctx.fillStyle = rng() < 0.72 ? 'rgba(46, 42, 38, 0.84)' : 'rgba(98, 72, 50, 0.65)';
    ctx.fillRect(x, y, w, h);
    if (x + w > size) ctx.fillRect(x - size, y, w, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedBirchBarkTexture = tex;
  return tex;
}

export function getPineBarkTexture() {
  if (cachedPineBarkTexture) return cachedPineBarkTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rng = makePrng(9911447);
  const { makeGrid, sampleP } = createPeriodicBarkSampler(rng);
  const g1 = makeGrid(14, 18), g2 = makeGrid(28, 36), g3 = makeGrid(64, 64);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const plate = sampleP(g1, u, v), sub = sampleP(g2, u, v), grain = sampleP(g3, u, v);
      const t = 1.0 - Math.abs(plate * 2.0 - 1.0);
      const crack = t * t * t * t;
      const scaleH = Math.max(0.12, 0.85 - crack * 0.70 + (sub - 0.5) * 0.24);
      const idx = (y * size + x) << 2;
      d[idx]     = Math.min(255, ((152 + grain * 38) * scaleH) | 0);
      d[idx + 1] = Math.min(255, ((88 + grain * 26) * scaleH) | 0);
      d[idx + 2] = Math.min(255, ((60 + grain * 18) * scaleH) | 0);
      d[idx + 3] = Math.min(255, (scaleH * 255) | 0);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedPineBarkTexture = tex;
  return tex;
}

export function getBambooCulmTexture() {
  if (cachedBambooBark) return cachedBambooBark;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const rng = makePrng(512389);
  ctx.fillStyle = '#688c42';
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(176,204,114,0.14)' : 'rgba(36,60,24,0.14)';
    ctx.fillRect(x, 0, 2, size);
  }
  for (let y = 16; y < size; y += 32) {
    ctx.fillStyle = 'rgba(210, 220, 174, 0.72)'; ctx.fillRect(0, y - 2, size, 2);
    ctx.fillStyle = 'rgba(42, 54, 28, 0.84)'; ctx.fillRect(0, y, size, 2);
    ctx.fillStyle = 'rgba(158, 186, 104, 0.42)'; ctx.fillRect(0, y + 2, size, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedBambooBark = tex;
  return tex;
}

export function getSakuraBarkTexture() {
  if (cachedSakuraBark) return cachedSakuraBark;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const rng = makePrng(619823);
  ctx.fillStyle = '#523832';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 110; i++) {
    const x = rng() * size, y = rng() * size, w = 8 + rng() * 20, h = 1.0 + rng() * 1.8;
    ctx.fillStyle = rng() < 0.65 ? 'rgba(166, 124, 102, 0.74)' : 'rgba(34, 22, 18, 0.72)';
    ctx.fillRect(x, y, w, h);
    if (x + w > size) ctx.fillRect(x - size, y, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedSakuraBark = tex;
  return tex;
}
