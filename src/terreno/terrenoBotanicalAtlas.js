import * as THREE from 'three';

/**
 * TERRENO Engine v2 — Breakthrough TR-BOTANICA:
 * Procedural 1024×1024 High-Definition Botanical Foliage Alpha-Cutout Atlas &
 * 512×512 Seamless Fluted Cedar/Beech Bark Texture Generator.
 *
 * Atlas UV Layout (Standard WebGL flipY=true -> UV (0,0) = bottom-left, UV (1,1) = top-right):
 *   Canvas Top-Left     [0..512,   0..512]   -> UV [0.0..0.5, 0.5..1.0] : Q0 — Ancient Japanese Sugi Cedar Bough Spray (杉枝葉)
 *   Canvas Top-Right    [512..1024,0..512]   -> UV [0.5..1.0, 0.5..1.0] : Q1 — Subalpine Abies / Hinoki Cypress Fan (檜・シラビソ)
 *   Canvas Bottom-Left  [0..512,   512..1024]-> UV [0.0..0.5, 0.0..0.5] : Q2 — Montane Buna Beech Leafy Branch (ブナ・ミズナラ枝葉)
 *   Canvas Bottom-Right [512..1024,512..1024]-> UV [0.5..1.0, 0.0..0.5] : Q3 — Understory Pack:
 *       - Left half   [512..768,  512..1024] -> UV [0.50..0.75, 0.00..0.50] : Q3A — Japanese Wood-Fern Pinnate Frond (イノデ羊歯)
 *       - Upper-right [768..1024, 512..768]  -> UV [0.75..1.00, 0.25..0.50] : Q3B — Kumazasa Dwarf Bamboo Clump (クマザサ)
 *       - Lower-right [768..1024, 768..1024] -> UV [0.75..1.00, 0.00..0.25] : Q3C — Wild Mountain Sedge & Grass Tuft (山スゲ・野草)
 *
 * Includes a 5-pass morphological RGB alpha-bleed dilation so mipmaps & bilinear filtering
 * NEVER show dark outline halos around transparent botanical edges!
 */

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * 5-Pass RGB Alpha-Bleed Dilation: propagates nearest opaque foliage RGB colors
 * outward into transparent (alpha === 0) pixels so bilinear filtering and mipmaps
 * produce 100% halo-free crisp silhouettes at every viewing distance!
 */
function dilateTransparentRgb(imageData, passes = 5) {
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
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (filled[idx]) continue;
        let rSum = 0, gSum = 0, bSum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const nIdx = ny * w + nx;
            if (filled[nIdx]) {
              const p4 = nIdx * 4;
              rSum += data[p4];
              gSum += data[p4 + 1];
              bSum += data[p4 + 2];
              cnt++;
            }
          }
        }
        if (cnt > 0) {
          const o3 = idx * 3;
          nextRgb[o3] = Math.round(rSum / cnt);
          nextRgb[o3 + 1] = Math.round(gSum / cnt);
          nextRgb[o3 + 2] = Math.round(bSum / cnt);
          nextFilled[idx] = 1;
        }
      }
    }
    for (let i = 0; i < total; i++) {
      if (!filled[i] && nextFilled[i]) {
        const p4 = i * 4;
        const o3 = i * 3;
        data[p4] = nextRgb[o3];
        data[p4 + 1] = nextRgb[o3 + 1];
        data[p4 + 2] = nextRgb[o3 + 2];
        filled[i] = 1;
      }
    }
  }
}

/**
 * Draw a single curved Japanese Cedar (Sugi) needle shoot tuft:
 * dozens of tiny crisp dark-to-sunlit curved needles radiating along a feathery twiglet.
 */
function paintSugiShoot(ctx, x0, y0, angle, len, widthScale, rng, lightBias) {
  const steps = Math.max(8, Math.floor(len * 0.22));
  const curve = (rng() - 0.5) * 0.35;
  let cx = x0;
  let cy = y0;
  let ca = angle;

  // Fine inner twig line
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

  // Layered needle plumes along shoot (back dark layer -> rich mid emerald -> sunlit bright tips)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pts.length; i++) {
      const t = i / Math.max(1, pts.length - 1);
      const p = pts[i];
      const envelope = Math.sin(Math.pow(t, 0.65) * Math.PI * 0.92 + 0.14);
      const needleLen = (11.0 + 16.0 * envelope) * widthScale;

      for (let side = -1; side <= 1; side += 2) {
        const spread = side * (0.42 + rng() * 0.42);
        const na = p.a + spread;
        const nx = p.x + Math.cos(na) * needleLen;
        const ny = p.y + Math.sin(na) * needleLen;
        const mx = (p.x + nx) * 0.5 + Math.cos(p.a) * 3.5;
        const my = (p.y + ny) * 0.5 + Math.sin(p.a) * 3.5;

        const shade = pass === 0
          ? 0.62 + 0.26 * t + lightBias * 0.18
          : 0.85 + 0.32 * t + lightBias * 0.24 + rng() * 0.12;
        const r = Math.min(245, Math.round((78 + 38 * rng()) * shade));
        const g = Math.min(250, Math.round((136 + 44 * rng()) * shade));
        const b = Math.min(220, Math.round((72 + 28 * rng()) * shade));

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

function paintQuadrantSugi(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + 2, oy + 2, size - 4, size - 4);
  ctx.clip();

  const rootX = ox + size * 0.5;
  const rootY = oy + size * 0.96;

  // Main woody reddish-brown Sugi cedar bough stem
  const spinePts = [];
  let sx = rootX, sy = rootY;
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = rootX + Math.sin(t * 2.4) * 14.0;
    const y = rootY - t * size * 0.86;
    spinePts.push({ x, y, t });
  }

  // Draw tapered central branch
  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i];
    const b = spinePts[i + 1];
    ctx.strokeStyle = '#5c3c24';
    ctx.lineWidth = 10.5 * (1.0 - a.t * 0.78);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Paint 22 drooping feathery lateral Cedar boughlets + sub-sprays with airy open sky gaps!
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

      // Sub-shoots branching off the main lateral boughlet
      const subCount = pt.t < 0.72 ? 2 : 1;
      for (let s = 0; s < subCount; s++) {
        const frac = 0.34 + s * 0.30 + rng() * 0.12;
        const bx = pt.x + Math.cos(baseAng) * len * frac;
        const by = pt.y + Math.sin(baseAng) * len * frac;
        const subAng = baseAng + side * (0.28 + rng() * 0.32) * (s % 2 === 0 ? 1 : -0.85);
        paintSugiShoot(ctx, bx, by, subAng, len * (0.48 + rng() * 0.20), wScale * 0.78, rng, pt.t * 0.6);
      }
    }
  }

  // Leader tip feathery plume
  const tip = spinePts[spinePts.length - 1];
  paintSugiShoot(ctx, tip.x, tip.y + 18, -Math.PI * 0.5 + (rng() - 0.5) * 0.14, size * 0.19, 0.86, rng, 0.55);

  ctx.restore();
}

function paintQuadrantAbies(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + 2, oy + 2, size - 4, size - 4);
  ctx.clip();

  const rootX = ox + size * 0.5;
  const rootY = oy + size * 0.96;

  // Build organic tapering spine points for lush subalpine Shirabiso / Hinoki bough
  const spinePts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const x = rootX + Math.sin(t * 2.8 - 0.5) * 10.0;
    const y = rootY - t * size * 0.88;
    spinePts.push({ x, y, t });
  }

  for (let i = 0; i < spinePts.length - 1; i++) {
    const a = spinePts[i], b = spinePts[i + 1];
    ctx.strokeStyle = '#523b2a';
    ctx.lineWidth = 9.0 * (1.0 - a.t * 0.78);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Paint lush, full, layered silvery-jade Shirabiso / Hinoki feathery sprays (ZERO bare stick silhouettes!)
  const paintAbiesPlume = (x0, y0, ang, len, wScale, lightBias) => {
    const steps = Math.max(8, Math.floor(len * 0.24));
    const curve = (rng() - 0.5) * 0.28;
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
          const shade = pass === 0
            ? 0.64 + 0.26 * t + lightBias * 0.18
            : 0.88 + 0.30 * t + lightBias * 0.22 + rng() * 0.12;
          const r = Math.min(242, Math.round((74 + 28 * rng()) * shade));
          const g = Math.min(250, Math.round((138 + 38 * rng()) * shade));
          const b = Math.min(242, Math.round((106 + 32 * rng()) * shade));
          ctx.strokeStyle = `rgba(${r},${g},${b},1.0)`;
          ctx.lineWidth = (pass === 0 ? 5.6 : 3.2) * wScale * (0.58 + 0.50 * env);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(nx, ny);
          ctx.stroke();
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
      paintAbiesPlume(pt.x, pt.y, baseAng, len, wScale, pt.t * 0.45);
      if (pt.t < 0.76) {
        const bx = pt.x + Math.cos(baseAng) * len * 0.45;
        const by = pt.y + Math.sin(baseAng) * len * 0.45;
        paintAbiesPlume(bx, by, baseAng + side * 0.36, len * 0.56, wScale * 0.82, pt.t * 0.6);
      }
    }
  }
  const tip = spinePts[spinePts.length - 1];
  paintAbiesPlume(tip.x, tip.y + 18, -Math.PI * 0.5, size * 0.21, 0.90, 0.55);
  ctx.restore();
}

/**
 * Draw a single crisp serrated Japanese Buna Beech leaf with central midrib & lateral veins!
 */
function paintBeechLeaf(ctx, x, y, angle, len, wid, r, g, b) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Petiole (tiny leaf stalk)
  ctx.strokeStyle = `rgba(${Math.round(r * 0.65)},${Math.round(g * 0.72)},${Math.round(b * 0.55)},1.0)`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.12, 0);
  ctx.stroke();

  // Slightly scalloped ovate beech blade
  const grad = ctx.createLinearGradient(0, -wid, len, wid);
  grad.addColorStop(0.0, `rgb(${Math.max(0, r - 24)},${Math.max(0, g - 26)},${Math.max(0, b - 18)})`);
  grad.addColorStop(0.55, `rgb(${r},${g},${b})`);
  grad.addColorStop(1.0, `rgb(${Math.min(255, r + 28)},${Math.min(255, g + 30)},${Math.min(255, b + 14)})`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(len * 0.10, 0);
  ctx.bezierCurveTo(len * 0.30, -wid * 1.12, len * 0.74, -wid * 0.92, len, 0);
  ctx.bezierCurveTo(len * 0.74, wid * 0.92, len * 0.30, wid * 1.12, len * 0.10, 0);
  ctx.closePath();
  ctx.fill();

  // Bright central midrib + subtle lateral veins (characteristic of Japanese Fagus crenata!)
  ctx.strokeStyle = `rgba(${Math.min(255, r + 42)},${Math.min(255, g + 46)},${Math.min(255, b + 20)},0.62)`;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(len * 0.12, 0);
  ctx.lineTo(len * 0.92, 0);
  ctx.stroke();

  ctx.lineWidth = 0.85;
  for (let v = 0.28; v <= 0.78; v += 0.16) {
    const vx = len * v;
    const vw = wid * Math.sin(v * Math.PI) * 0.72;
    ctx.beginPath();
    ctx.moveTo(vx, 0);
    ctx.lineTo(vx + len * 0.11, -vw);
    ctx.moveTo(vx, 0);
    ctx.lineTo(vx + len * 0.11, vw);
    ctx.stroke();
  }
  ctx.restore();
}

function paintQuadrantBuna(ctx, ox, oy, size, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + 2, oy + 2, size - 4, size - 4);
  ctx.clip();

  const rootX = ox + size * 0.5;
  const rootY = oy + size * 0.96;

  // Recursive woody beech twig skeleton with graceful branching forks!
  const twigs = [];
  function growTwig(x, y, ang, len, thick, depth) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = depth === 0 ? '#787166' : '#655c50';
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    twigs.push({ x1: x, y1: y, x2, y2, ang, depth });
    if (depth >= 2) return;

    const branches = depth === 0 ? 5 : 3;
    for (let i = 0; i < branches; i++) {
      const frac = 0.26 + (i / Math.max(1, branches - 1)) * 0.70;
      const bx = x + (x2 - x) * frac;
      const by = y + (y2 - y) * frac;
      const side = i % 2 === 0 ? -1 : 1;
      const spread = (depth === 0 ? 0.56 : 0.48) + rng() * 0.24;
      growTwig(bx, by, ang + side * spread, len * (0.50 + rng() * 0.22), thick * 0.62, depth + 1);
    }
  }
  growTwig(rootX, rootY, -Math.PI * 0.5 + (rng() - 0.5) * 0.08, size * 0.78, 7.2, 0);

  // Populate 110+ individual serrated beech leaves along twigs, leaving 35% airy sky gaps (木漏れ日)!
  for (let pass = 0; pass < 2; pass++) {
    for (let ti = 0; ti < twigs.length; ti++) {
      const tw = twigs[ti];
      const count = tw.depth === 2 ? 6 : tw.depth === 1 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const f = 0.22 + (i / count) * 0.78 + (rng() - 0.5) * 0.08;
        const lx = tw.x1 + (tw.x2 - tw.x1) * f + (rng() - 0.5) * 14.0;
        const ly = tw.y1 + (tw.y2 - tw.y1) * f + (rng() - 0.5) * 14.0;
        const side = (i + ti + pass) % 2 === 0 ? -1 : 1;
        const leafAng = tw.ang + side * (0.45 + rng() * 0.62);
        const leafLen = 30.0 + rng() * 26.0;
        const leafWid = leafLen * (0.34 + rng() * 0.12);

        // Keep bright neutral-green luminance so per-instance color tinting yields vivid deep summer & autumn gold!
        const lum = pass === 0 ? 0.74 + rng() * 0.16 : 0.96 + rng() * 0.22;
        const r = Math.min(248, Math.round((132 + rng() * 42) * lum));
        const g = Math.min(252, Math.round((178 + rng() * 38) * lum));
        const b = Math.min(200, Math.round((84 + rng() * 26) * lum));
        paintBeechLeaf(ctx, lx, ly, leafAng, leafLen, leafWid, r, g, b);
      }
    }
  }
  ctx.restore();
}

function paintQuadrantUnderstory(ctx, ox, oy, size, rng) {
  const half = size * 0.5;

  // --- Q3A: Left Half [ox..ox+half, oy..oy+size] — Lacy Pinnate Japanese Wood-Fern Frond (イノデ羊歯) ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + 2, oy + 2, half - 4, size - 4);
  ctx.clip();

  const fx0 = ox + half * 0.5;
  const fy0 = oy + size * 0.97;
  const fernLen = size * 0.92;

  // Central arching rachis stem
  ctx.strokeStyle = '#4e7634';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx0, fy0);
  ctx.quadraticCurveTo(fx0 + 7, oy + size * 0.48, fx0, oy + size * 0.05);
  ctx.stroke();

  // 26 pairs of finely serrated pinnate leaflets (羽片) tapering cleanly to tip!
  const pairs = 26;
  for (let i = 0; i < pairs; i++) {
    const t = 0.08 + (i / (pairs - 1)) * 0.87;
    const px = fx0 + Math.sin(t * Math.PI) * 5.0;
    const py = fy0 - t * fernLen;
    const env = Math.sin(Math.pow(t, 0.62) * Math.PI * 0.96 + 0.08);
    const pinnaLen = half * 0.44 * env;
    const pinnaWid = Math.max(3.2, 10.5 * env);

    for (let side = -1; side <= 1; side += 2) {
      const ang = (side === 1 ? -0.22 : Math.PI + 0.22) - side * t * 0.32;
      const ex = px + Math.cos(ang) * pinnaLen;
      const ey = py + Math.sin(ang) * pinnaLen;

      const shade = 0.78 + 0.34 * t + rng() * 0.12;
      const r = Math.min(235, Math.round(98 * shade));
      const g = Math.min(248, Math.round(166 * shade));
      const b = Math.min(185, Math.round(68 * shade));

      // Sub-lobes along each pinna for true lacy fern silhouette!
      const lobes = Math.max(3, Math.floor(pinnaLen / 11.0));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(px, py - pinnaWid * 0.35);
      for (let l = 1; l <= lobes; l++) {
        const lf = l / lobes;
        const lx = px + (ex - px) * lf;
        const ly = py + (ey - py) * lf;
        const lw = pinnaWid * (1.0 - lf * 0.72);
        ctx.lineTo(lx - Math.sin(ang) * lw, ly + Math.cos(ang) * lw);
        ctx.lineTo(lx - Math.sin(ang) * lw * 0.35, ly + Math.cos(ang) * lw * 0.35);
      }
      ctx.lineTo(ex, ey);
      for (let l = lobes; l >= 1; l--) {
        const lf = l / lobes;
        const lx = px + (ex - px) * lf;
        const ly = py + (ey - py) * lf;
        const lw = pinnaWid * (1.0 - lf * 0.72);
        ctx.lineTo(lx + Math.sin(ang) * lw * 0.35, ly - Math.cos(ang) * lw * 0.35);
        ctx.lineTo(lx + Math.sin(ang) * lw, ly - Math.cos(ang) * lw);
      }
      ctx.closePath();
      ctx.fill();

      // Delicate central leaflet vein
      ctx.strokeStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(220, b + 20)},0.65)`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- Q3B: Upper-Right [ox+half..ox+size, oy..oy+half] — Kumazasa Dwarf Bamboo (クマザサ) ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + half + 2, oy + 2, half - 4, half - 4);
  ctx.clip();

  const sx0 = ox + half + half * 0.5;
  const sy0 = oy + half * 0.96;

  // Slender bamboo culms & 15 broad arching Kumazasa leaves with iconic pale white Kumadori (隈取り) edges!
  for (let k = 0; k < 15; k++) {
    const spread = ((k / 14) - 0.5) * 1.95 + (rng() - 0.5) * 0.14;
    const ang = -Math.PI * 0.5 + spread;
    const len = half * (0.58 + rng() * 0.34);
    const wid = 13.0 + rng() * 7.5;
    const bx = sx0 + (rng() - 0.5) * 34.0;
    const by = sy0 - rng() * 24.0;
    const droop = spread * 0.45;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);

    // Delicate authentic Kumadori weathered pale-olive leaf rim
    const rimGrad = ctx.createLinearGradient(0, 0, len, 0);
    rimGrad.addColorStop(0.0, '#628e42');
    rimGrad.addColorStop(0.55, '#a8b886');
    rimGrad.addColorStop(1.0, '#c8cca8');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.32, -wid, len * 0.72, -wid * 0.8 + droop * 14, len, droop * 22);
    ctx.bezierCurveTo(len * 0.72, wid * 0.8 + droop * 14, len * 0.32, wid, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Rich glossy emerald bamboo blade interior (delicate thin kumadori border!)
    const lum = 0.76 + rng() * 0.28;
    const r = Math.min(220, Math.round(86 * lum));
    const g = Math.min(238, Math.round(148 * lum));
    const b = Math.min(175, Math.round(62 * lum));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.moveTo(len * 0.03, 0);
    ctx.bezierCurveTo(len * 0.32, -wid * 0.86, len * 0.70, -wid * 0.70 + droop * 14, len * 0.94, droop * 20);
    ctx.bezierCurveTo(len * 0.70, wid * 0.70 + droop * 14, len * 0.32, wid * 0.86, len * 0.03, 0);
    ctx.closePath();
    ctx.fill();

    // Pale central bamboo midrib
    ctx.strokeStyle = 'rgba(218, 232, 178, 0.78)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(len * 0.04, 0);
    ctx.quadraticCurveTo(len * 0.50, droop * 6, len * 0.95, droop * 21);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();

  // --- Q3C: Lower-Right [ox+half..ox+size, oy+half..oy+size] — Wild Mountain Grass & Sedge Tuft (山スゲ) ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox + half + 2, oy + half + 2, half - 4, half - 4);
  ctx.clip();

  const gx0 = ox + half + half * 0.5;
  const gy0 = oy + size * 0.98;

  for (let k = 0; k < 56; k++) {
    const bx = gx0 + (rng() - 0.5) * half * 0.72;
    const by = gy0;
    const lean = ((bx - gx0) / (half * 0.36)) * 0.58 + (rng() - 0.5) * 0.62;
    const h = half * (0.42 + rng() * 0.54);
    const tipX = bx + Math.sin(lean) * h * 0.96;
    const tipY = by - Math.cos(lean * 0.65) * h;
    const ctrlX = bx + Math.sin(lean * 0.45) * h * 0.42;
    const ctrlY = by - h * 0.56;
    const bw = 4.4 + rng() * 4.8;

    const isDryStraw = rng() > 0.84;
    const lum = 0.72 + rng() * 0.42;
    const r = isDryStraw ? Math.round(168 * lum) : Math.round((96 + rng() * 32) * lum);
    const g = isDryStraw ? Math.round(152 * lum) : Math.round((154 + rng() * 40) * lum);
    const b = isDryStraw ? Math.round(86 * lum) : Math.round((64 + rng() * 24) * lum);

    const grad = ctx.createLinearGradient(bx, by, tipX, tipY);
    grad.addColorStop(0.0, `rgb(${Math.round(r * 0.52)},${Math.round(g * 0.58)},${Math.round(b * 0.45)})`);
    grad.addColorStop(0.55, `rgb(${Math.min(250, r)},${Math.min(252, g)},${Math.min(210, b)})`);
    grad.addColorStop(1.0, `rgb(${Math.min(255, r + 32)},${Math.min(255, g + 28)},${Math.min(220, b + 14)})`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(bx - bw, by);
    ctx.quadraticCurveTo(ctrlX - bw * 0.45, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX + bw * 0.45, ctrlY, bx + bw, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

let cachedFoliageAtlas = null;
let cachedBarkTexture = null;

/**
 * Create (and cache) the 1024×1024 High-Definition Procedural Botanical Alpha-Cutout Atlas.
 */
export function getBotanicalFoliageAtlas() {
  if (cachedFoliageAtlas) return cachedFoliageAtlas;

  const size = 1024;
  const half = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rng = makePrng(20261122);
  paintQuadrantSugi(ctx, 0, 0, half, rng);
  paintQuadrantAbies(ctx, half, 0, half, rng);
  paintQuadrantBuna(ctx, 0, half, half, rng);
  paintQuadrantUnderstory(ctx, half, half, half, rng);

  // Critical anti-halo morphological color bleed into transparent pixels!
  const img = ctx.getImageData(0, 0, size, size);
  dilateTransparentRgb(img, 5);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  // Raw sRGB stored on canvas -> we explicitly linearize via pow(rgb, 2.2) inside GLSL!
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;

  cachedFoliageAtlas = tex;
  return tex;
}

/**
 * Create (and cache) a 512×512 seamless vertical fluted Cedar/Beech Bark PBR Albedo(RGB) + Relief(A) texture.
 */
export function getBotanicalBarkTexture() {
  if (cachedBarkTexture) return cachedBarkTexture;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rng = makePrng(7788991);

  // Periodic vertical fluted bark noise pyramids (high horizontal frequency, elongated vertically!)
  const makeGrid = (gx, gy) => {
    const arr = new Float32Array(gx * gy);
    for (let i = 0; i < arr.length; i++) arr[i] = rng();
    return { gx, gy, arr };
  };
  const g1 = makeGrid(24, 6);
  const g2 = makeGrid(48, 12);
  const g3 = makeGrid(96, 24);
  const g4 = makeGrid(16, 16);

  const sampleP = (g, u, v) => {
    const x = u * g.gx;
    const y = v * g.gy;
    const x0 = Math.floor(x) % g.gx;
    const y0 = Math.floor(y) % g.gy;
    const x1 = (x0 + 1) % g.gx;
    const y1 = (y0 + 1) % g.gy;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = g.arr[y0 * g.gx + x0];
    const b = g.arr[y0 * g.gx + x1];
    const c = g.arr[y1 * g.gx + x0];
    const e = g.arr[y1 * g.gx + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = sampleP(g1, u, v);
      const n2 = sampleP(g2, u, v);
      const n3 = sampleP(g3, u, v);
      const lichen = sampleP(g4, u, v);

      // Sharp fibrous cedar bark ridges & deep vertical shadow furrows
      const ridge = 1.0 - Math.abs(n1 * 2.0 - 1.0);
      const furrow = Math.pow(ridge, 1.8) * 0.62 + n2 * 0.25 + n3 * 0.13;
      const base = 92 + furrow * 138;
      const lichenMask = Math.max(0, (lichen - 0.72) * 3.5);

      const idx = (y * size + x) * 4;
      d[idx] = Math.min(255, Math.round(base * (1 - lichenMask * 0.45) + lichenMask * 115));
      d[idx + 1] = Math.min(255, Math.round(base * 0.96 * (1 - lichenMask * 0.35) + lichenMask * 132));
      d[idx + 2] = Math.min(255, Math.round(base * 0.90 * (1 - lichenMask * 0.45) + lichenMask * 108));
      d[idx + 3] = Math.min(255, Math.round(furrow * 255));
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;

  cachedBarkTexture = tex;
  return tex;
}
