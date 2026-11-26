import * as THREE from 'three';

/**
 * TERRENO 3.0 Engine — Ultra-High-Definition 2048×1024 Multi-Species Japanese Forest Botanical Atlas
 * & 3 Distinct Seamless 512×512 Species Bark Generators (Fluted Cedar/Beech, White Paper Birch, Red Pine).
 *
 * Atlas UV Layout (2048×1024 = 4×2 grid of 512×512 cells, WebGL flipY=true):
 *   Top Row    [v: 0.50..1.00]:
 *     Col 0 [u: 0.00..0.25] — Ancient Japanese Sugi Cedar Bough (屋久杉・黒杉)
 *     Col 1 [u: 0.25..0.50] — Kiso Hinoki Cypress Layered Fan Spray (木曽檜)
 *     Col 2 [u: 0.50..0.75] — 7-Lobed Palmate Japanese Mountain Maple (イロハモミジ)
 *     Col 3 [u: 0.75..1.00] — Japanese Red Pine Needle Umbrella Cluster (アカマツ)
 *   Bottom Row [v: 0.00..0.50]:
 *     Col 0 [u: 0.00..0.25] — Grand Buna Beech / Giant Zelkova Branch (ブナ・ケヤキ)
 *     Col 1 [u: 0.25..0.50] — Highland White Birch Shimmering Branch (白樺)
 *     Col 2 [u: 0.50..0.75] — Riparian Weeping Willow Cascading Frond (川ヤナギ)
 *     Col 3 [u: 0.75..1.00] — 4-Cell Understory & Forest-Floor Pack:
 *         TL [0.750..0.875, 0.250..0.500] — Lacy Japanese Wood-Fern (イノデ羊歯)
 *         TR [0.875..1.000, 0.250..0.500] — Kumazasa Dwarf Bamboo (クマザサ)
 *         BL [0.750..0.875, 0.000..0.250] — Mountain Shrub & Wildflower Azalea Cluster (低木・野花)
 *         BR [0.875..1.000, 0.000..0.250] — Wild Mountain Grass, Sedge & Susuki Plumes (野草・ススキ)
 */

export const BOTANICAL_UV = {
  sugi:   [0.002, 0.504, 0.248, 0.996],
  hinoki: [0.252, 0.504, 0.498, 0.996],
  maple:  [0.502, 0.504, 0.748, 0.996],
  pine:   [0.752, 0.504, 0.998, 0.996],
  buna:   [0.002, 0.004, 0.248, 0.496],
  birch:  [0.252, 0.004, 0.498, 0.496],
  willow: [0.502, 0.004, 0.748, 0.496],
  fern:   [0.752, 0.253, 0.873, 0.497],
  sasa:   [0.877, 0.253, 0.998, 0.497],
  shrub:  [0.752, 0.003, 0.873, 0.247],
  grass:  [0.877, 0.003, 0.998, 0.247],
};

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * Fast 4-Pass RGB Alpha-Bleed Dilation: guarantees 100% dark-halo-free mipmaps at every distance!
 */
function dilateTransparentRgb(imageData, passes = 4) {
  const { width: w, height: h, data } = imageData;
  const total = w * h;
  const filled = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] > 20) filled[i] = 1;
  }
  const nextRgb = new Uint8Array(total * 3);
  const nextFilled = new Uint8Array(total);

  for (let p = 0; p < passes; p++) {
    nextFilled.set(filled);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = row + x;
        if (filled[idx]) continue;
        let rS = 0, gS = 0, bS = 0, cnt = 0;
        const n0 = idx - 1, n1 = idx + 1, n2 = idx - w, n3 = idx + w;
        if (filled[n0]) { const p4 = n0 * 4; rS += data[p4]; gS += data[p4 + 1]; bS += data[p4 + 2]; cnt++; }
        if (filled[n1]) { const p4 = n1 * 4; rS += data[p4]; gS += data[p4 + 1]; bS += data[p4 + 2]; cnt++; }
        if (filled[n2]) { const p4 = n2 * 4; rS += data[p4]; gS += data[p4 + 1]; bS += data[p4 + 2]; cnt++; }
        if (filled[n3]) { const p4 = n3 * 4; rS += data[p4]; gS += data[p4 + 1]; bS += data[p4 + 2]; cnt++; }
        if (cnt > 0) {
          const o3 = idx * 3;
          nextRgb[o3] = (rS / cnt) | 0;
          nextRgb[o3 + 1] = (gS / cnt) | 0;
          nextRgb[o3 + 2] = (bS / cnt) | 0;
          nextFilled[idx] = 1;
        }
      }
    }
    for (let i = 0; i < total; i++) {
      if (!filled[i] && nextFilled[i]) {
        const p4 = i * 4, o3 = i * 3;
        data[p4] = nextRgb[o3];
        data[p4 + 1] = nextRgb[o3 + 1];
        data[p4 + 2] = nextRgb[o3 + 2];
        filled[i] = 1;
      }
    }
  }
}

function paintSugiShoot(ctx, x0, y0, angle, len, widthScale, rng, lightBias) {
  const steps = Math.max(8, Math.floor(len * 0.20));
  const curve = (rng() - 0.5) * 0.35;
  let cx = x0, cy = y0, ca = angle;
  ctx.save();
  ctx.strokeStyle = 'rgba(72, 48, 30, 0.92)';
  ctx.lineWidth = Math.max(1.2, 2.6 * widthScale);
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
      const needleLen = (11.0 + 16.0 * envelope) * widthScale;
      for (let side = -1; side <= 1; side += 2) {
        const na = p.a + side * (0.42 + rng() * 0.42);
        const nx = p.x + Math.cos(na) * needleLen;
        const ny = p.y + Math.sin(na) * needleLen;
        const mx = (p.x + nx) * 0.5 + Math.cos(p.a) * 3.5;
        const my = (p.y + ny) * 0.5 + Math.sin(p.a) * 3.5;
        const shade = pass === 0 ? 0.65 + 0.25 * t + lightBias * 0.18 : 0.88 + 0.32 * t + lightBias * 0.22 + rng() * 0.12;
        const r = Math.min(245, Math.round((86 + 38 * rng()) * shade));
        const g = Math.min(250, Math.round((146 + 44 * rng()) * shade));
        const b = Math.min(220, Math.round((78 + 28 * rng()) * shade));
        ctx.strokeStyle = `rgba(${r},${g},${b},1.0)`;
        ctx.lineWidth = (pass === 0 ? 4.4 : 2.6) * widthScale * (0.55 + 0.55 * envelope);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(mx, my, nx, ny);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintCellSugi(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.96;
  const spinePts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    spinePts.push({ x: rootX + Math.sin(t * 2.4) * 14.0, y: rootY - t * size * 0.86, t });
  }
  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i], b = spinePts[i + 1];
    ctx.strokeStyle = '#5c3c24';
    ctx.lineWidth = 10.5 * (1.0 - a.t * 0.78);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let i = 1; i < spinePts.length; i++) {
    const pt = spinePts[i];
    const env = Math.sin(Math.pow(pt.t, 0.72) * Math.PI * 0.96 + 0.08);
    const maxLen = size * (0.14 + 0.33 * env);
    for (let side = -1; side <= 1; side += 2) {
      if (pt.t > 0.88 && side === 1) continue;
      const baseAng = -Math.PI * 0.5 + side * (0.48 + (1.0 - pt.t) * 0.52) + (rng() - 0.5) * 0.16;
      const len = maxLen * (0.76 + rng() * 0.34);
      const wScale = 0.72 + 0.42 * env;
      paintSugiShoot(ctx, pt.x, pt.y, baseAng, len, wScale, rng, pt.t * 0.45);
      const subCount = pt.t < 0.72 ? 2 : 1;
      for (let s = 0; s < subCount; s++) {
        const frac = 0.34 + s * 0.30 + rng() * 0.12;
        const bx = pt.x + Math.cos(baseAng) * len * frac;
        const by = pt.y + Math.sin(baseAng) * len * frac;
        paintSugiShoot(ctx, bx, by, baseAng + side * (0.28 + rng() * 0.32) * (s % 2 === 0 ? 1 : -0.85), len * (0.48 + rng() * 0.20), wScale * 0.78, rng, pt.t * 0.6);
      }
    }
  }
  const tip = spinePts[spinePts.length - 1];
  paintSugiShoot(ctx, tip.x, tip.y + 18, -Math.PI * 0.5 + (rng() - 0.5) * 0.14, size * 0.19, 0.86, rng, 0.55);
  ctx.restore();
}

function paintCellHinoki(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.96;
  const spinePts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    spinePts.push({ x: rootX + Math.sin(t * 2.8 - 0.5) * 10.0, y: rootY - t * size * 0.88, t });
  }
  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i], b = spinePts[i + 1];
    ctx.strokeStyle = '#523b2a';
    ctx.lineWidth = 9.0 * (1.0 - a.t * 0.78);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const paintFanPlume = (x0, y0, ang, len, wScale, lightBias) => {
    const steps = Math.max(8, Math.floor(len * 0.22));
    const curve = (rng() - 0.5) * 0.26;
    let cx = x0, cy = y0, ca = ang;
    const pts = [{ x: cx, y: cy, a: ca }];
    const seg = len / steps;
    for (let i = 1; i <= steps; i++) {
      ca += curve / steps;
      cx += Math.cos(ca) * seg;
      cy += Math.sin(ca) * seg;
      pts.push({ x: cx, y: cy, a: ca });
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length; i++) {
        const t = i / Math.max(1, pts.length - 1);
        const p = pts[i];
        const env = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.92 + 0.14);
        const nLen = (12.0 + 18.0 * env) * wScale;
        for (let side = -1; side <= 1; side += 2) {
          const na = p.a + side * (0.44 + rng() * 0.36);
          const nx = p.x + Math.cos(na) * nLen;
          const ny = p.y + Math.sin(na) * nLen;
          const shade = pass === 0 ? 0.66 + 0.26 * t + lightBias * 0.18 : 0.90 + 0.30 * t + lightBias * 0.22 + rng() * 0.12;
          const r = Math.min(242, Math.round((78 + 28 * rng()) * shade));
          const g = Math.min(250, Math.round((146 + 38 * rng()) * shade));
          const b = Math.min(245, Math.round((118 + 32 * rng()) * shade));
          ctx.strokeStyle = `rgba(${r},${g},${b},1.0)`;
          ctx.lineWidth = (pass === 0 ? 5.6 : 3.2) * wScale * (0.58 + 0.50 * env);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        }
      }
    }
  };
  for (let i = 1; i < spinePts.length; i++) {
    const pt = spinePts[i];
    const env = Math.sin(Math.pow(pt.t, 0.70) * Math.PI * 0.96 + 0.10);
    const maxLen = size * (0.15 + 0.34 * env);
    for (let side = -1; side <= 1; side += 2) {
      const baseAng = -Math.PI * 0.5 + side * (0.46 + (1.0 - pt.t) * 0.54) + (rng() - 0.5) * 0.14;
      const len = maxLen * (0.78 + rng() * 0.32);
      const wScale = 0.78 + 0.42 * env;
      paintFanPlume(pt.x, pt.y, baseAng, len, wScale, pt.t * 0.45);
      if (pt.t < 0.76) {
        paintFanPlume(pt.x + Math.cos(baseAng) * len * 0.45, pt.y + Math.sin(baseAng) * len * 0.45, baseAng + side * 0.36, len * 0.56, wScale * 0.82, pt.t * 0.6);
      }
    }
  }
  const tip = spinePts[spinePts.length - 1];
  paintFanPlume(tip.x, tip.y + 18, -Math.PI * 0.5, size * 0.21, 0.90, 0.55);
  ctx.restore();
}

/**
 * Iconic 7-Lobed Palmate Japanese Mountain Maple Leaf (イロハモミジ) — painted in luminous white-warm
 * neutral albedo so per-instance tinting creates vivid crimson, fiery vermilion, golden amber & lime green!
 */
function paintMapleLeaf(ctx, x, y, angle, rad, lum, warmth) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const lobes = [-1.45, -0.92, -0.44, 0.0, 0.44, 0.92, 1.45];
  const lens  = [0.46, 0.72, 0.92, 1.0, 0.92, 0.72, 0.46];
  const r = Math.min(252, Math.round((212 + warmth * 36) * lum));
  const g = Math.min(248, Math.round((186 + (1 - warmth) * 42) * lum));
  const b = Math.min(232, Math.round((152 + (1 - warmth) * 32) * lum));
  ctx.fillStyle = `rgb(${r},${g},${b})`;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i < lobes.length; i++) {
    const a = lobes[i];
    const L = rad * lens[i];
    const wA = a - 0.18;
    const wB = a + 0.18;
    ctx.quadraticCurveTo(Math.cos(wA) * L * 0.55, Math.sin(wA) * L * 0.55, Math.cos(a) * L, Math.sin(a) * L);
    if (i < lobes.length - 1) {
      const midA = (lobes[i] + lobes[i + 1]) * 0.5;
      const notch = rad * 0.28;
      ctx.quadraticCurveTo(Math.cos(wB) * L * 0.55, Math.sin(wB) * L * 0.55, Math.cos(midA) * notch, Math.sin(midA) * notch);
    }
  }
  ctx.closePath();
  ctx.fill();

  // Crisp radiating palmate veins
  ctx.strokeStyle = `rgba(${Math.min(255, r + 28)},${Math.min(255, g + 22)},${Math.min(255, b + 16)},0.58)`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < lobes.length; i++) {
    const a = lobes[i], L = rad * lens[i] * 0.85;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
  }
  ctx.stroke();
  ctx.restore();
}

function paintCellMaple(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.96;
  const twigs = [];
  function growMapleTwig(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#5b3b34' : '#6e4238';
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;
    const branches = depth === 0 ? 6 : 3;
    for (let i = 0; i < branches; i++) {
      const f = 0.22 + (i / Math.max(1, branches - 1)) * 0.74;
      const bx = x + (x2 - x) * f, by = y + (y2 - y) * f;
      const side = i % 2 === 0 ? -1 : 1;
      growMapleTwig(bx, by, ang + side * (0.58 + rng() * 0.28), len * (0.48 + rng() * 0.22), thick * 0.62, depth + 1);
    }
  }
  growMapleTwig(rootX, rootY, -Math.PI * 0.5 + (rng() - 0.5) * 0.08, size * 0.80, 6.0, 0);

  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const cnt = tw.depth === 2 ? 5 : tw.depth === 1 ? 4 : 2;
      for (let i = 0; i < cnt; i++) {
        const f = 0.20 + (i / cnt) * 0.80 + (rng() - 0.5) * 0.08;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 16;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 16;
        const ang = tw.ang + (rng() - 0.5) * 1.9;
        const rad = 22.0 + rng() * 20.0;
        const lum = pass === 0 ? 0.70 + rng() * 0.16 : 0.94 + rng() * 0.18;
        paintMapleLeaf(ctx, lx, ly, ang, rad, lum, 0.35 + rng() * 0.55);
      }
    }
  }
  ctx.restore();
}

/**
 * Japanese Red Pine (アカマツ) — Long radiating paired pine-needle rosette clusters in architectural pads!
 */
function paintCellPine(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.95;

  // Sculptural gnarled reddish-brown pine bough fork
  const tips = [];
  function growPine(x, y, ang, len, thick, depth) {
    const mx = x + Math.cos(ang + (rng() - 0.5) * 0.35) * len * 0.52;
    const my = y + Math.sin(ang + (rng() - 0.5) * 0.35) * len * 0.52;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#7c4830' : '#6c3e28';
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    if (depth >= 1) tips.push({ x: x2, y: y2, ang });
    if (depth >= 2) return;
    const count = depth === 0 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const f = 0.35 + (i / Math.max(1, count - 1)) * 0.62;
      const bx = x + (x2 - x) * f, by = y + (y2 - y) * f;
      const side = (i % 2 === 0 ? -1 : 1);
      growPine(bx, by, ang + side * (0.45 + rng() * 0.42), len * (0.50 + rng() * 0.22), thick * 0.62, depth + 1);
    }
  }
  growPine(rootX, rootY, -Math.PI * 0.5 + (rng() - 0.5) * 0.12, size * 0.72, 9.5, 0);

  // Paint dense starburst pine needle rosettes at every twig tip
  for (let i = 0; i < tips.length; i++) {
    const tp = tips[i];
    for (let pass = 0; pass < 2; pass++) {
      const nNeedles = pass === 0 ? 28 : 22;
      for (let n = 0; n < nNeedles; n++) {
        const na = (n / nNeedles) * Math.PI * 2.0 + (rng() - 0.5) * 0.22;
        const nLen = (36.0 + rng() * 28.0) * (pass === 0 ? 1.0 : 0.84);
        const shade = pass === 0 ? 0.60 + rng() * 0.22 : 0.88 + rng() * 0.28;
        const r = Math.min(238, Math.round((78 + rng() * 28) * shade));
        const g = Math.min(248, Math.round((138 + rng() * 34) * shade));
        const b = Math.min(210, Math.round((82 + rng() * 26) * shade));
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = pass === 0 ? 2.6 : 1.7;
        ctx.beginPath();
        ctx.moveTo(tp.x, tp.y);
        ctx.lineTo(tp.x + Math.cos(na) * nLen, tp.y + Math.sin(na) * nLen);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function paintBeechLeaf(ctx, x, y, angle, len, wid, r, g, b) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, -wid, len, wid);
  grad.addColorStop(0.0, `rgb(${Math.max(0, r - 24)},${Math.max(0, g - 26)},${Math.max(0, b - 18)})`);
  grad.addColorStop(0.55, `rgb(${r},${g},${b})`);
  grad.addColorStop(1.0, `rgb(${Math.min(255, r + 28)},${Math.min(255, g + 30)},${Math.min(255, b + 14)})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(len * 0.08, 0);
  ctx.bezierCurveTo(len * 0.30, -wid * 1.12, len * 0.74, -wid * 0.92, len, 0);
  ctx.bezierCurveTo(len * 0.74, wid * 0.92, len * 0.30, wid * 1.12, len * 0.08, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(${Math.min(255, r + 42)},${Math.min(255, g + 46)},${Math.min(255, b + 20)},0.60)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(len * 0.10, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
  ctx.restore();
}

function paintCellBuna(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.96;
  const twigs = [];
  function growTwig(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#787166' : '#655c50';
    ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;
    const branches = depth === 0 ? 5 : 3;
    for (let i = 0; i < branches; i++) {
      const frac = 0.26 + (i / Math.max(1, branches - 1)) * 0.70;
      growTwig(x + (x2 - x) * frac, y + (y2 - y) * frac, ang + (i % 2 === 0 ? -1 : 1) * ((depth === 0 ? 0.56 : 0.48) + rng() * 0.24), len * (0.50 + rng() * 0.22), thick * 0.62, depth + 1);
    }
  }
  growTwig(rootX, rootY, -Math.PI * 0.5 + (rng() - 0.5) * 0.08, size * 0.78, 7.2, 0);

  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const count = tw.depth === 2 ? 6 : tw.depth === 1 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const f = 0.22 + (i / count) * 0.78 + (rng() - 0.5) * 0.08;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 14.0;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 14.0;
        const side = (i + ti + pass) % 2 === 0 ? -1 : 1;
        const leafLen = 30.0 + rng() * 26.0;
        const lum = pass === 0 ? 0.74 + rng() * 0.16 : 0.96 + rng() * 0.22;
        paintBeechLeaf(ctx, lx, ly, tw.ang + side * (0.45 + rng() * 0.62), leafLen, leafLen * (0.34 + rng() * 0.12),
          Math.min(248, Math.round((136 + rng() * 42) * lum)),
          Math.min(252, Math.round((184 + rng() * 38) * lum)),
          Math.min(200, Math.round((86 + rng() * 26) * lum)));
      }
    }
  }
  ctx.restore();
}

/**
 * Highland White Birch (白樺 / シラカバ) — Airy delicate diamond-shaped birch leaves on pale slender twigs!
 */
function paintCellBirch(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const rootX = ox + size * 0.5, rootY = oy + size * 0.96;
  const twigs = [];
  function growBirch(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#a89f94' : '#7b6b5c';
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
  growBirch(rootX, rootY, -Math.PI * 0.5, size * 0.82, 5.2, 0);

  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const cnt = tw.depth === 2 ? 7 : 4;
      for (let i = 0; i < cnt; i++) {
        const f = 0.18 + (i / cnt) * 0.82;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 18;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 18;
        const ang = tw.ang + (rng() - 0.5) * 1.5;
        const L = 19.0 + rng() * 14.0;
        const W = L * 0.44;
        const lum = pass === 0 ? 0.76 + rng() * 0.16 : 0.98 + rng() * 0.18;
        const r = Math.min(252, Math.round((166 + rng() * 38) * lum));
        const g = Math.min(252, Math.round((206 + rng() * 34) * lum));
        const b = Math.min(185, Math.round((92 + rng() * 26) * lum));
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(ang);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(L * 0.36, -W);
        ctx.lineTo(L, 0);
        ctx.lineTo(L * 0.36, W);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * Riparian Weeping Willow (川ヤナギ) — Long graceful cascading curtains of slender lance leaves!
 */
function paintCellWillow(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, size - 4, size - 4); ctx.clip();
  const topY = oy + size * 0.06;
  const numStrands = 12;
  for (let s = 0; s < numStrands; s++) {
    const frac = (s + 0.5) / numStrands;
    const sx = ox + size * (0.12 + frac * 0.76) + (rng() - 0.5) * 18;
    const len = size * (0.64 + Math.sin(frac * Math.PI) * 0.28);
    const sway = (rng() - 0.5) * 32;
    ctx.strokeStyle = '#6c7c48';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(sx, topY);
    ctx.quadraticCurveTo(sx + sway * 0.5, topY + len * 0.5, sx + sway, topY + len);
    ctx.stroke();

    const leaves = 22;
    for (let i = 0; i < leaves; i++) {
      const t = i / (leaves - 1);
      const px = sx + sway * t * t;
      const py = topY + len * t;
      for (let side = -1; side <= 1; side += 2) {
        const ang = Math.PI * 0.5 + side * (0.30 + rng() * 0.28);
        const lLen = 22.0 + rng() * 14.0;
        const lWid = 3.2 + rng() * 1.8;
        const lum = 0.76 + 0.32 * (1 - t) + rng() * 0.14;
        const r = Math.min(238, Math.round((122 + rng() * 34) * lum));
        const g = Math.min(250, Math.round((186 + rng() * 36) * lum));
        const b = Math.min(198, Math.round((96 + rng() * 24) * lum));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.ellipse(lLen * 0.5, 0, lLen * 0.5, lWid, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * 4-Cell Understory & Forest-Floor Pack: Fern (TL), Kumazasa Bamboo (TR), Mountain Shrub/Wildflowers (BL), Grass/Susuki (BR)
 */
function paintCellUnderstoryPack(ctx, ox, oy, size, rng) {
  const half = size * 0.5;

  // TL: Lacy Pinnate Japanese Wood-Fern (イノデ羊歯)
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + 2, half - 4, half - 4); ctx.clip();
  const fx0 = ox + half * 0.5, fy0 = oy + half * 0.96, fernLen = half * 0.90;
  ctx.strokeStyle = '#4e7634'; ctx.lineWidth = 3.0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.quadraticCurveTo(fx0 + 5, oy + half * 0.48, fx0, oy + half * 0.05); ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const t = 0.08 + (i / 19) * 0.87;
    const px = fx0 + Math.sin(t * Math.PI) * 4.0, py = fy0 - t * fernLen;
    const env = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.96 + 0.08);
    const pLen = half * 0.44 * env, pWid = Math.max(2.4, 7.2 * env);
    for (let side = -1; side <= 1; side += 2) {
      const ang = (side === 1 ? -0.22 : Math.PI + 0.22) - side * t * 0.30;
      const ex = px + Math.cos(ang) * pLen, ey = py + Math.sin(ang) * pLen;
      const shade = 0.80 + 0.34 * t + rng() * 0.12;
      ctx.fillStyle = `rgb(${Math.min(235, Math.round(102 * shade))},${Math.min(248, Math.round(172 * shade))},${Math.min(185, Math.round(70 * shade))})`;
      ctx.beginPath();
      ctx.moveTo(px, py - pWid * 0.4);
      ctx.quadraticCurveTo((px + ex) * 0.5 - Math.sin(ang) * pWid, (py + ey) * 0.5 + Math.cos(ang) * pWid, ex, ey);
      ctx.quadraticCurveTo((px + ex) * 0.5 + Math.sin(ang) * pWid, (py + ey) * 0.5 - Math.cos(ang) * pWid, px, py + pWid * 0.4);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();

  // TR: Kumazasa Dwarf Bamboo (クマザサ) with pale Kumadori margins
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + half + 2, oy + 2, half - 4, half - 4); ctx.clip();
  const sx0 = ox + half + half * 0.5, sy0 = oy + half * 0.96;
  for (let k = 0; k < 15; k++) {
    const spread = ((k / 14) - 0.5) * 1.95 + (rng() - 0.5) * 0.14;
    const ang = -Math.PI * 0.5 + spread;
    const len = half * (0.58 + rng() * 0.34), wid = 12.0 + rng() * 7.0;
    const bx = sx0 + (rng() - 0.5) * 30.0, by = sy0 - rng() * 20.0, droop = spread * 0.45;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    const rimGrad = ctx.createLinearGradient(0, 0, len, 0);
    rimGrad.addColorStop(0.0, '#628e42'); rimGrad.addColorStop(0.55, '#a8b886'); rimGrad.addColorStop(1.0, '#c8cca8');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.32, -wid, len * 0.72, -wid * 0.8 + droop * 14, len, droop * 22);
    ctx.bezierCurveTo(len * 0.72, wid * 0.8 + droop * 14, len * 0.32, wid, 0, 0);
    ctx.closePath(); ctx.fill();
    const lum = 0.76 + rng() * 0.28;
    ctx.fillStyle = `rgb(${Math.min(220, Math.round(88 * lum))},${Math.min(238, Math.round(152 * lum))},${Math.min(175, Math.round(64 * lum))})`;
    ctx.beginPath();
    ctx.moveTo(len * 0.03, 0);
    ctx.bezierCurveTo(len * 0.32, -wid * 0.86, len * 0.70, -wid * 0.70 + droop * 14, len * 0.94, droop * 20);
    ctx.bezierCurveTo(len * 0.70, wid * 0.70 + droop * 14, len * 0.32, wid * 0.86, len * 0.03, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // BL: Forest Understory Shrub & Wild Mountain Azalea/Hydrangea Blossoms (低木・ツツジ・野花)
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + 2, oy + half + 2, half - 4, half - 4); ctx.clip();
  const shX = ox + half * 0.5, shY = oy + size * 0.96;
  for (let b = 0; b < 7; b++) {
    const ba = -Math.PI * 0.5 + ((b / 6) - 0.5) * 1.45;
    const bLen = half * (0.64 + rng() * 0.24);
    const bx2 = shX + Math.cos(ba) * bLen, by2 = shY + Math.sin(ba) * bLen;
    ctx.strokeStyle = '#533c2a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(bx2, by2); ctx.stroke();
    for (let k = 0; k < 10; k++) {
      const f = 0.25 + (k / 9) * 0.75;
      const lx = shX + (bx2 - shX) * f + (rng() - 0.5) * 18;
      const ly = shY + (by2 - shY) * f + (rng() - 0.5) * 18;
      const lum = 0.74 + rng() * 0.34;
      paintBeechLeaf(ctx, lx, ly, ba + (rng() - 0.5) * 1.4, 16 + rng() * 11, 7 + rng() * 4,
        Math.min(230, Math.round(98 * lum)), Math.min(246, Math.round(164 * lum)), Math.min(180, Math.round(74 * lum)));
    }
  }
  // Delicate woodland wildflower blossom accents (soft white/pale-blush florets)
  for (let fl = 0; fl < 14; fl++) {
    const fx = ox + half * (0.20 + rng() * 0.60);
    const fy = oy + half + half * (0.14 + rng() * 0.52);
    const fr = 4.2 + rng() * 3.6;
    ctx.fillStyle = fl % 3 === 0 ? 'rgba(255, 224, 232, 0.95)' : 'rgba(252, 250, 238, 0.95)';
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(pa) * fr * 0.55, fy + Math.sin(pa) * fr * 0.55, fr * 0.48, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f5c249';
    ctx.beginPath(); ctx.arc(fx, fy, fr * 0.28, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // BR: Wild Mountain Sedge, Meadow Grass & Golden Susuki Plumes (山スゲ・ススキ)
  ctx.save();
  ctx.beginPath(); ctx.rect(ox + half + 2, oy + half + 2, half - 4, half - 4); ctx.clip();
  const gx0 = ox + half + half * 0.5, gy0 = oy + size * 0.98;
  for (let k = 0; k < 56; k++) {
    const bx = gx0 + (rng() - 0.5) * half * 0.72, by = gy0;
    const lean = ((bx - gx0) / (half * 0.36)) * 0.58 + (rng() - 0.5) * 0.62;
    const h = half * (0.42 + rng() * 0.54);
    const tipX = bx + Math.sin(lean) * h * 0.96, tipY = by - Math.cos(lean * 0.65) * h;
    const ctrlX = bx + Math.sin(lean * 0.45) * h * 0.42, ctrlY = by - h * 0.56;
    const bw = 4.2 + rng() * 4.4;
    const isDryStraw = rng() > 0.80;
    const lum = 0.74 + rng() * 0.42;
    const r = isDryStraw ? Math.round(176 * lum) : Math.round((98 + rng() * 34) * lum);
    const g = isDryStraw ? Math.round(158 * lum) : Math.round((158 + rng() * 40) * lum);
    const b = isDryStraw ? Math.round(88 * lum) : Math.round((66 + rng() * 24) * lum);
    const grad = ctx.createLinearGradient(bx, by, tipX, tipY);
    grad.addColorStop(0.0, `rgb(${Math.round(r * 0.52)},${Math.round(g * 0.58)},${Math.round(b * 0.45)})`);
    grad.addColorStop(0.55, `rgb(${Math.min(250, r)},${Math.min(252, g)},${Math.min(210, b)})`);
    grad.addColorStop(1.0, `rgb(${Math.min(255, r + 32)},${Math.min(255, g + 28)},${Math.min(220, b + 14)})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(bx - bw, by);
    ctx.quadraticCurveTo(ctrlX - bw * 0.45, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX + bw * 0.45, ctrlY, bx + bw, by);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

let cachedFoliageAtlas = null;
let cachedBarkTexture = null;
let cachedBirchBarkTexture = null;
let cachedPineBarkTexture = null;

export function getBotanicalFoliageAtlas() {
  if (cachedFoliageAtlas) return cachedFoliageAtlas;
  const W = 2048, H = 1024, cell = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const rng = makePrng(20261126);
  // Top row (UV v = 0.5..1.0)
  paintCellSugi(ctx, 0, 0, cell, rng);
  paintCellHinoki(ctx, cell, 0, cell, rng);
  paintCellMaple(ctx, cell * 2, 0, cell, rng);
  paintCellPine(ctx, cell * 3, 0, cell, rng);
  // Bottom row (UV v = 0.0..0.5)
  paintCellBuna(ctx, 0, cell, cell, rng);
  paintCellBirch(ctx, cell, cell, cell, rng);
  paintCellWillow(ctx, cell * 2, cell, cell, rng);
  paintCellUnderstoryPack(ctx, cell * 3, cell, cell, rng);

  const img = ctx.getImageData(0, 0, W, H);
  dilateTransparentRgb(img, 4);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;

  cachedFoliageAtlas = tex;
  return tex;
}

function createPeriodicBarkSampler(rng) {
  const makeGrid = (gx, gy) => {
    const arr = new Float32Array(gx * gy);
    for (let i = 0; i < arr.length; i++) arr[i] = rng();
    return { gx, gy, arr };
  };
  const sampleP = (g, u, v) => {
    const x = u * g.gx, y = v * g.gy;
    const x0 = Math.floor(x) % g.gx, y0 = Math.floor(y) % g.gy;
    const x1 = (x0 + 1) % g.gx, y1 = (y0 + 1) % g.gy;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = g.arr[y0 * g.gx + x0], b = g.arr[y0 * g.gx + x1];
    const c = g.arr[y1 * g.gx + x0], e = g.arr[y1 * g.gx + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
  };
  return { makeGrid, sampleP };
}

export function getBotanicalBarkTexture() {
  if (cachedBarkTexture) return cachedBarkTexture;
  const size = 512;
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
      const furrow = Math.pow(ridge, 1.8) * 0.62 + n2 * 0.25 + n3 * 0.13;
      const base = 92 + furrow * 138;
      const lichenMask = Math.max(0, (lichen - 0.70) * 3.5);
      const idx = (y * size + x) * 4;
      d[idx]     = Math.min(255, Math.round(base * (1 - lichenMask * 0.45) + lichenMask * 115));
      d[idx + 1] = Math.min(255, Math.round(base * 0.96 * (1 - lichenMask * 0.35) + lichenMask * 136));
      d[idx + 2] = Math.min(255, Math.round(base * 0.90 * (1 - lichenMask * 0.45) + lichenMask * 108));
      d[idx + 3] = Math.min(255, Math.round(furrow * 255));
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

/**
 * Iconic Japanese White Paper Birch Bark (白樺): chalk-white papery bark with crisp horizontal charcoal lenticels!
 */
export function getBirchBarkTexture() {
  if (cachedBirchBarkTexture) return cachedBirchBarkTexture;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = makePrng(4455123);

  // Chalky creamy-white papery birch base
  ctx.fillStyle = '#e7e4dc';
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal peeling paper bands
  for (let i = 0; i < 120; i++) {
    const y = rng() * size;
    const h = 3 + rng() * 14;
    const shade = 216 + Math.floor(rng() * 30);
    ctx.fillStyle = `rgba(${shade},${shade - 3},${shade - 10},0.45)`;
    ctx.fillRect(0, y, size, h);
  }
  // Iconic dark horizontal lenticel dashes & knot fissures!
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 14 + rng() * 54;
    const h = 1.6 + rng() * 3.4;
    ctx.fillStyle = rng() < 0.72 ? 'rgba(46, 42, 38, 0.84)' : 'rgba(98, 72, 50, 0.65)';
    ctx.fillRect(x, y, w, h);
    if (x + w > size) ctx.fillRect(x - size, y, w, h);
  }
  // Occasional dark rough diamond branch scars
  for (let i = 0; i < 18; i++) {
    const x = rng() * size, y = rng() * size;
    const rx = 14 + rng() * 18, ry = 8 + rng() * 10;
    ctx.fillStyle = 'rgba(34, 30, 28, 0.90)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedBirchBarkTexture = tex;
  return tex;
}

/**
 * Japanese Red Pine Bark (アカマツ): warm reddish-terracotta tortoiseshell bark scales!
 */
export function getPineBarkTexture() {
  if (cachedPineBarkTexture) return cachedPineBarkTexture;
  const size = 512;
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
      const plate = sampleP(g1, u, v);
      const sub = sampleP(g2, u, v);
      const grain = sampleP(g3, u, v);
      const crack = Math.pow(1.0 - Math.abs(plate * 2.0 - 1.0), 3.6);
      const scaleH = Math.max(0.1, 0.85 - crack * 0.72 + (sub - 0.5) * 0.25);
      const idx = (y * size + x) * 4;
      d[idx]     = Math.min(255, Math.round((158 + grain * 42) * scaleH));
      d[idx + 1] = Math.min(255, Math.round((92 + grain * 28) * scaleH));
      d[idx + 2] = Math.min(255, Math.round((62 + grain * 18) * scaleH));
      d[idx + 3] = Math.min(255, Math.round(scaleH * 255));
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

// =========================================================================
// TERRENO 4.0 EXTENDED BOTANICAL FLORA ATLAS (2048×1024, 4×2) FOR +20 SPECIES!
//   Top Row    [v: 0.50..1.00]:
//     Col 0 — Wild Sakura Blossom Spray (山桜・枝垂れ桜)
//     Col 1 — Golden Ginkgo Fan Cluster (大銀杏)
//     Col 2 — Giant Moso Bamboo Leaf Plume (孟宗竹)
//     Col 3 — Japanese Larch Feathery Needle Spray (カラマツ)
//   Bottom Row [v: 0.00..0.50]:
//     Col 0 — Oak / Zelkova / Katsura Serrated Crown (ミズナラ・ケヤキ・カツラ)
//     Col 1 — Hanging Lavender Wisteria Racemes (山藤)
//     Col 2 — Glossy Camellia & White Magnolia Blooms (ツバキ・コブシ)
//     Col 3 — Alpine Rowan Pinnate Leaf & Scarlet Berry Cluster (ナナカマド)
// =========================================================================

export const EXTENDED_BOTANICAL_UV = {
  sakura:   [0.002, 0.504, 0.248, 0.996],
  ginkgo:   [0.252, 0.504, 0.498, 0.996],
  bamboo:   [0.502, 0.504, 0.748, 0.996],
  larch:    [0.752, 0.504, 0.998, 0.996],
  oak:      [0.002, 0.004, 0.248, 0.496],
  wisteria: [0.252, 0.004, 0.498, 0.496],
  blossom:  [0.502, 0.004, 0.748, 0.496],
  rowan:    [0.752, 0.004, 0.998, 0.496],
};

let cachedExtAtlas = null;
let cachedBambooBark = null;
let cachedSakuraBark = null;

export function getExtendedBotanicalAtlas() {
  if (cachedExtAtlas) return cachedExtAtlas;
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const rng = makePrng(7788991);

  const cell = (col, row, drawFn) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(col * 512, row * 512, 512, 512);
    ctx.clip();
    ctx.translate(col * 512, row * 512);
    drawFn();
    ctx.restore();
  };

  // --- [Top Row, canvas y=0..512 -> UV v=0.5..1.0] ---

  // Col 0: Wild Yamazakura Blossom Spray (delicate clustered cherry blossoms + tender bronze-green young leaves!)
  cell(0, 0, () => {
    ctx.strokeStyle = 'rgba(68, 44, 38, 0.94)';
    ctx.lineCap = 'round';
    for (let b = 0; b < 6; b++) {
      ctx.lineWidth = 6 - b * 0.7;
      ctx.beginPath();
      ctx.moveTo(256, 485);
      ctx.quadraticCurveTo(256 + (b - 2.5) * 56, 310, 256 + (b - 2.5) * 88 + (rng() - 0.5) * 35, 68 + rng() * 140);
      ctx.stroke();
    }
    // Tender bronze-green Yamazakura leaves peeking behind blossoms
    for (let l = 0; l < 65; l++) {
      const cx = 64 + rng() * 384, cy = 54 + rng() * 375;
      if (Math.hypot((cx - 256) / 215, (cy - 235) / 210) > 1.0) continue;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${112 + Math.floor(rng() * 34)}, ${128 + Math.floor(rng() * 36)}, ${76 + Math.floor(rng() * 22)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 14 + rng() * 10, 5 + rng() * 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 210; i++) {
      const cx = 58 + rng() * 396;
      const cy = 44 + rng() * 388;
      if (Math.hypot((cx - 256) / 218, (cy - 235) / 212) > 1.0) continue;
      const r = 7.5 + rng() * 8.5;
      const rot = rng() * Math.PI * 2;
      const sh = 0.84 + rng() * 0.16;
      ctx.fillStyle = `rgb(${Math.round(248 * sh)}, ${Math.round(224 * sh)}, ${Math.round(230 * sh)})`;
      for (let p = 0; p < 5; p++) {
        const a = rot + (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.60, cy + Math.sin(a) * r * 0.60, r * 0.56, r * 0.34, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(208, 142, 158, 0.78)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.19, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Col 1: Golden Ginkgo Biloba Fan Leaf Cluster (distinct twin-lobed fan leaves!)
  cell(1, 0, () => {
    ctx.strokeStyle = 'rgba(92, 74, 48, 0.90)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(256, 488); ctx.lineTo(256, 110); ctx.stroke();
    for (let i = 0; i < 135; i++) {
      const cx = 56 + rng() * 400;
      const cy = 44 + rng() * 395;
      if (Math.hypot((cx - 256) / 220, (cy - 235) / 215) > 1.0) continue;
      const r = 18 + rng() * 20;
      const ang = -Math.PI * 0.5 + (rng() - 0.5) * 2.1;
      const shade = 0.78 + rng() * 0.28;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = `rgb(${Math.min(255, Math.round(244 * shade))}, ${Math.min(255, Math.round(202 * shade))}, ${Math.round(58 * shade)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.78, -0.06);
      ctx.lineTo(r * 0.66, 0);
      ctx.arc(0, 0, r, 0.06, 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // Col 2: Giant Moso Bamboo Delicate Lanceolate Leaf Plumes (slender sweeping bamboo blades!)
  cell(2, 0, () => {
    ctx.strokeStyle = 'rgba(64, 96, 48, 0.92)';
    ctx.lineWidth = 4;
    for (let b = 0; b < 6; b++) {
      const sx = 256 + (b - 2.5) * 28;
      ctx.beginPath();
      ctx.moveTo(sx, 485);
      ctx.quadraticCurveTo(sx + (b - 2.5) * 44, 270, sx + (b - 2.5) * 76, 75 + rng() * 90);
      ctx.stroke();
    }
    for (let i = 0; i < 210; i++) {
      const cx = 64 + rng() * 384;
      const cy = 54 + rng() * 390;
      if (Math.hypot((cx - 256) / 218, (cy - 245) / 210) > 1.0) continue;
      const len = 34 + rng() * 44;
      const w = 4.2 + rng() * 3.8;
      const a = Math.PI * 0.18 + (rng() - 0.5) * 2.4;
      const sh = 0.72 + rng() * 0.36;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = `rgb(${Math.round(92 * sh)}, ${Math.min(245, Math.round(166 * sh))}, ${Math.round(78 * sh)})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.45, -w, len, 0);
      ctx.quadraticCurveTo(len * 0.45, w, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  });

  // Col 3: Japanese Larch (カラマツ) Airy Feathery Golden-Olive Rosette Needle Sprays!
  cell(3, 0, () => {
    ctx.strokeStyle = 'rgba(98, 68, 42, 0.92)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(256, 488); ctx.lineTo(256, 62); ctx.stroke();
    for (let b = 0; b < 9; b++) {
      const y = 90 + b * 42;
      for (const side of [-1, 1]) {
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(256, y);
        ctx.quadraticCurveTo(256 + side * 95, y - 10, 256 + side * (175 - b * 8), y + 22);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 220; i++) {
      const cx = 56 + rng() * 400;
      const cy = 56 + rng() * 392;
      if (Math.hypot((cx - 256) / 215, (cy - 245) / 210) > 1.0) continue;
      const sh = 0.72 + rng() * 0.35;
      ctx.strokeStyle = `rgb(${Math.min(248, Math.round(188 * sh))}, ${Math.min(240, Math.round(174 * sh))}, ${Math.round(74 * sh)})`;
      ctx.lineWidth = 1.9;
      const tufts = 8;
      for (let t = 0; t < tufts; t++) {
        const a = (t / tufts) * Math.PI * 2 + rng() * 0.3;
        const nl = 10 + rng() * 14;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * nl, cy + Math.sin(a) * nl);
        ctx.stroke();
      }
    }
  });

  // --- [Bottom Row, canvas y=512..1024 -> UV v=0.0..0.5] ---

  // Col 0: Oak / Zelkova / Katsura Lobed & Serrated Broadleaf Foliage
  cell(0, 1, () => {
    ctx.strokeStyle = 'rgba(72, 54, 38, 0.90)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(256, 485); ctx.lineTo(256, 95); ctx.stroke();
    for (let i = 0; i < 140; i++) {
      const cx = 54 + rng() * 404;
      const cy = 48 + rng() * 395;
      if (Math.hypot((cx - 256) / 222, (cy - 240) / 215) > 1.0) continue;
      const rx = 18 + rng() * 18;
      const ry = 10 + rng() * 10;
      const a = rng() * Math.PI * 2;
      const sh = 0.70 + rng() * 0.38;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = `rgb(${Math.round(112 * sh)}, ${Math.min(235, Math.round(158 * sh))}, ${Math.round(84 * sh)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${Math.round(92 * sh)}, ${Math.min(215, Math.round(138 * sh))}, ${Math.round(68 * sh)})`;
      ctx.beginPath();
      ctx.ellipse(rx * 0.32, -ry * 0.35, rx * 0.42, ry * 0.42, 0.2, 0, Math.PI * 2);
      ctx.ellipse(rx * 0.32, ry * 0.35, rx * 0.42, ry * 0.42, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // Col 1: Hanging Lavender-Violet Japanese Wisteria (山藤) Cascading Racemes!
  cell(1, 1, () => {
    // Upper green vine leaves
    for (let i = 0; i < 48; i++) {
      const cx = 64 + rng() * 384;
      const cy = 28 + rng() * 125;
      ctx.fillStyle = `rgb(${78 + Math.floor(rng() * 35)}, ${134 + Math.floor(rng() * 42)}, ${66 + Math.floor(rng() * 28)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 18 + rng() * 12, 8 + rng() * 5, (rng() - 0.5) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 11 long cascading tapering wisteria blossom chains!
    for (let c = 0; c < 11; c++) {
      const rx = 52 + c * 40 + (rng() - 0.5) * 14;
      const len = 240 + rng() * 210;
      const sway = (rng() - 0.5) * 28;
      for (let y = 70; y < 70 + len; y += 11) {
        const u = (y - 70) / len;
        const spread = (1.0 - u * 0.72) * 16;
        const x = rx + Math.sin(u * 2.5) * sway;
        for (let f = 0; f < 3; f++) {
          const fx = x + (rng() - 0.5) * spread * 1.5;
          const fy = y + (rng() - 0.5) * 8;
          const rad = (7 + rng() * 5.5) * (1.0 - u * 0.45);
          const bright = 0.76 + (1.0 - u) * 0.22 + rng() * 0.14;
          ctx.fillStyle = `rgb(${Math.min(255, Math.round(176 * bright))}, ${Math.min(255, Math.round(132 * bright))}, ${Math.min(255, Math.round(238 * bright))})`;
          ctx.beginPath();
          ctx.arc(fx, fy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });

  // Col 2: Glossy Camellia & Wild Mountain Magnolia (emerald glossy leaves + jewel-like blossoms!)
  cell(2, 1, () => {
    for (let i = 0; i < 120; i++) {
      const cx = 56 + rng() * 400;
      const cy = 54 + rng() * 395;
      if (Math.hypot((cx - 256) / 220, (cy - 245) / 215) > 1.0) continue;
      const sh = 0.65 + rng() * 0.40;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.fillStyle = `rgb(${Math.round(52 * sh)}, ${Math.round(128 * sh)}, ${Math.round(64 * sh)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22 + rng() * 14, 11 + rng() * 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Luminous star-petalled blossoms
    for (let b = 0; b < 32; b++) {
      const cx = 86 + rng() * 340;
      const cy = 78 + rng() * 340;
      if (Math.hypot((cx - 256) / 195, (cy - 240) / 195) > 1.0) continue;
      const r = 16 + rng() * 14;
      const rot = rng() * Math.PI * 2;
      ctx.fillStyle = 'rgb(252, 246, 242)';
      for (let p = 0; p < 6; p++) {
        const a = rot + (p * Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58, r * 0.55, r * 0.30, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgb(242, 198, 72)';
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Col 3: Alpine Rowan (ナナカマド) Pinnate Scarlet Foliage & Vivid Crimson Berry Clusters!
  cell(3, 1, () => {
    for (let i = 0; i < 150; i++) {
      const cx = 56 + rng() * 400;
      const cy = 50 + rng() * 400;
      if (Math.hypot((cx - 256) / 218, (cy - 245) / 210) > 1.0) continue;
      const a = rng() * Math.PI * 2;
      const sh = 0.72 + rng() * 0.34;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = `rgb(${Math.min(255, Math.round(225 * sh))}, ${Math.round(82 * sh)}, ${Math.round(46 * sh)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20 + rng() * 12, 6 + rng() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Bright vermilion berry clusters
    for (let c = 0; c < 18; c++) {
      const gx = 96 + rng() * 320;
      const gy = 86 + rng() * 320;
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = `rgb(${235 + Math.floor(rng() * 20)}, ${42 + Math.floor(rng() * 30)}, ${32 + Math.floor(rng() * 20)})`;
        ctx.beginPath();
        ctx.arc(gx + (rng() - 0.5) * 28, gy + (rng() - 0.5) * 24, 4.5 + rng() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  const img = ctx.getImageData(0, 0, W, H);
  dilateTransparentRgb(img, 4);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cachedExtAtlas = tex;
  return tex;
}

/**
 * Glossy Segmented Jade-Green Giant Moso Bamboo Culm Bark (孟宗竹): authentic internode rings!
 */
export function getBambooCulmTexture() {
  if (cachedBambooBark) return cachedBambooBark;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const rng = makePrng(512389);
  ctx.fillStyle = '#6c9142';
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(182,212,118,0.14)' : 'rgba(38,62,24,0.14)';
    ctx.fillRect(x, 0, 2, size);
  }
  // Authentic raised pale-chalky & dark nodal bamboo joints every 64px!
  for (let y = 32; y < size; y += 64) {
    ctx.fillStyle = 'rgba(218, 226, 178, 0.72)';
    ctx.fillRect(0, y - 3, size, 3);
    ctx.fillStyle = 'rgba(42, 54, 28, 0.85)';
    ctx.fillRect(0, y, size, 4);
    ctx.fillStyle = 'rgba(164, 192, 108, 0.42)';
    ctx.fillRect(0, y + 4, size, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  cachedBambooBark = tex;
  return tex;
}

/**
 * Glossy Mahogany Japanese Wild Mountain Cherry Bark (山桜): horizontal reddish-silver lenticels!
 */
export function getSakuraBarkTexture() {
  if (cachedSakuraBark) return cachedSakuraBark;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const rng = makePrng(619823);
  ctx.fillStyle = '#563932';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 180; i++) {
    const x = rng() * size, y = rng() * size;
    const w = 14 + rng() * 38, h = 1.5 + rng() * 2.5;
    ctx.fillStyle = rng() < 0.65 ? 'rgba(172, 128, 106, 0.75)' : 'rgba(34, 22, 18, 0.72)';
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

