import * as THREE from 'three';
import { BOTANICAL_UV, EXTENDED_BOTANICAL_UV } from './terrenoBotanicalAtlas.js';

/**
 * TERRENO 4.0 — +20 Brand-New Real-World Japanese Tree Species & Variations
 * (Combined with the 8 core species -> 28 distinct Japanese woodland species!)
 *
 * Each species features its own distinct unit-height [0..1] 3D wood skeleton (trunk, limbs,
 * root flares, culm clusters, or gnarled alpine stems) + botanical foliage crown cards
 * (using both core & extended 2048×1024 hand-painted Japanese flora atlases) + species-authentic
 * bark material + altitude/biome/landform ecological niche.
 */

function mergeGeos(geos) {
  let totalV = 0, totalI = 0;
  const hasUv = geos.every((g) => Boolean(g.attributes.uv));
  const hasMeta = geos.every((g) => Boolean(g.attributes.aMeta));
  const items = geos.map((g) => {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = hasUv ? g.attributes.uv : null;
    const meta = hasMeta ? g.attributes.aMeta : null;
    const idx = g.index;
    const vc = pos.count;
    const ic = idx ? idx.count : vc;
    totalV += vc;
    totalI += ic;
    return { pos, norm, uv, meta, idx, vc, ic };
  });
  const positions = new Float32Array(totalV * 3);
  const normals = new Float32Array(totalV * 3);
  const uvs = hasUv ? new Float32Array(totalV * 2) : null;
  const metas = hasMeta ? new Float32Array(totalV * 2) : null;
  const indices = new Uint32Array(totalI);
  let vo = 0, io = 0;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    positions.set(it.pos.array, vo * 3);
    normals.set(it.norm.array, vo * 3);
    if (uvs && it.uv) uvs.set(it.uv.array, vo * 2);
    if (metas && it.meta) metas.set(it.meta.array, vo * 2);
    if (it.idx) {
      const s = it.idx.array;
      for (let i = 0; i < s.length; i++) indices[io + i] = s[i] + vo;
    } else {
      for (let i = 0; i < it.vc; i++) indices[io + i] = i + vo;
    }
    vo += it.vc;
    io += it.ic;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (metas) out.setAttribute('aMeta', new THREE.BufferAttribute(metas, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  geos.forEach((g) => g.dispose());
  return out;
}

function limb(ax, ay, az, bx, by, bz, rBot, rTop, segs = 6) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const c = new THREE.CylinderGeometry(rTop, rBot, len, segs, 1);
  c.translate(0, len * 0.5, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  c.applyQuaternion(q);
  c.translate(ax, ay, az);
  return c;
}

function card(opts) {
  const {
    origin, yaw, pitch, roll = 0, width, length, droop = 0.03, cup = 0.014,
    uvRect, crownCenter, aoInner = 0.44, aoOuter = 1.12, segV = 1, tipTaper = 1.0, flipV = false,
  } = opts;
  const segU = 2;
  const pos = [], nrm = [], uv = [], meta = [], idx = [];
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const fwd = [sy * cp, sp, cy * cp];
  const r0 = [cy, 0, -sy];
  const u0 = [-sy * sp, cp, -cy * sp];
  const right = [r0[0] * cr + u0[0] * sr, r0[1] * cr + u0[1] * sr, r0[2] * cr + u0[2] * sr];
  const up = [-r0[0] * sr + u0[0] * cr, -r0[1] * sr + u0[1] * cr, -r0[2] * sr + u0[2] * cr];
  const [uMin, vMin, uMax, vMax] = uvRect;
  const [ox, oy, oz] = origin;
  const [cx, cyC, cz] = crownCenter;

  for (let iv = 0; iv <= segV; iv++) {
    const t = iv / segV;
    const wt = 1.0 + (tipTaper - 1.0) * t;
    for (let iu = 0; iu <= segU; iu++) {
      const s = iu / segU;
      const sw = (s - 0.5) * width * wt;
      const sl = t * length;
      const vc = cup * (1.0 - 4.0 * (s - 0.5) * (s - 0.5));
      const dy = -droop * t * t;
      const px = ox + fwd[0] * sl + right[0] * sw + up[0] * vc;
      const py = oy + fwd[1] * sl + right[1] * sw + up[1] * vc + dy;
      const pz = oz + fwd[2] * sl + right[2] * sw + up[2] * vc;
      pos.push(px, py, pz);

      let nx = px - cx, ny = (py - cyC) * 0.85 + 0.14, nz = pz - cz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx = (nx / nl) * 0.82 + up[0] * 0.18;
      ny = (ny / nl) * 0.82 + up[1] * 0.18;
      nz = (nz / nl) * 0.82 + up[2] * 0.18;
      const fl = Math.hypot(nx, ny, nz) || 1;
      nrm.push(nx / fl, ny / fl, nz / fl);

      const vt = flipV ? (1.0 - t) : t;
      uv.push(uMin + (uMax - uMin) * s, vMin + (vMax - vMin) * vt);
      meta.push(aoInner + (aoOuter - aoInner) * Math.pow(t, 0.72), t * t);
    }
  }
  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu, b = a + 1, c = a + stride, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 2));
  g.setIndex(idx);
  return g;
}

const GA = 2.3999632;

// =========================================================================
// REUSABLE ARCHITECTURAL TRUNK & CROWN GENERATORS FOR 20 DISTINCT SPECIES!
// =========================================================================

function buildSpreadingTree(cfg) {
  const {
    trunkBot = 0.044, trunkTop = 0.022, splitY = 0.36, lean = 0.04,
    limbCount = 5, limbSpan = 0.34, limbTopY = 0.78, multiStem = 1,
    uvRect, cardCount = 26, crownY = 0.70, crownRad = 0.38, cardW = 0.28, cardL = 0.30,
    droop = 0.04, pitchBase = 0.18, flipV = false, segV = 1,
  } = cfg;
  const tParts = [];
  if (multiStem > 1) {
    for (let s = 0; s < multiStem; s++) {
      const a = (s / multiStem) * Math.PI * 2 + 0.3;
      const sx = Math.cos(a) * 0.032, sz = Math.sin(a) * 0.032;
      const mx = Math.cos(a) * 0.09, mz = Math.sin(a) * 0.09;
      tParts.push(limb(sx, 0, sz, mx, splitY, mz, trunkBot * 0.72, trunkTop * 0.75, 6));
      for (let b = 0; b < 3; b++) {
        const ba = a + (b - 1) * 0.75;
        const bx = mx + Math.cos(ba) * limbSpan * 0.72;
        const bz = mz + Math.sin(ba) * limbSpan * 0.72;
        tParts.push(limb(mx, splitY * 0.94, mz, bx, limbTopY - b * 0.04, bz, trunkTop * 0.72, 0.007, 5));
      }
    }
  } else {
    tParts.push(limb(0, 0, 0, lean * 0.5, splitY * 0.52, lean * 0.3, trunkBot * 1.35, trunkBot, 7));
    tParts.push(limb(lean * 0.5, splitY * 0.52, lean * 0.3, lean, splitY, -lean * 0.2, trunkBot, trunkTop, 7));
    for (let i = 0; i < limbCount; i++) {
      const a = i * GA + 0.4;
      const r = limbSpan * (0.72 + (i % 3) * 0.14);
      const y1 = limbTopY - (i % 2) * 0.08;
      tParts.push(limb(lean, splitY * 0.92, -lean * 0.2, lean + Math.cos(a) * r, y1, -lean * 0.2 + Math.sin(a) * r, trunkTop * 0.82, 0.008, 5));
    }
  }

  const fParts = [];
  for (let i = 0; i < cardCount; i++) {
    const t = i / Math.max(1, cardCount - 1);
    const a = i * GA;
    const rad = crownRad * (0.35 + 0.65 * Math.sin(t * Math.PI * 0.85 + 0.2));
    const y = (crownY - 0.22) + t * 0.42;
    const ox = lean + Math.cos(a) * rad * 0.45;
    const oz = -lean * 0.2 + Math.sin(a) * rad * 0.45;
    fParts.push(card({
      origin: [ox, y, oz], yaw: a, pitch: pitchBase + (t - 0.5) * 0.45, roll: ((i % 3) - 1) * 0.16,
      width: cardW * (0.82 + 0.32 * Math.sin(t * Math.PI)),
      length: cardL * (0.82 + 0.30 * Math.sin(t * Math.PI)),
      droop, uvRect, crownCenter: [lean, crownY, 0], segV, flipV,
    }));
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildConiferSpire(cfg) {
  const {
    trunkBot = 0.036, tiers = 7, baseY = 0.20, topY = 0.96, baseRadius = 0.28,
    droop = 0.05, uvRect, cardsPerTier = 5, pitch = -0.14,
  } = cfg;
  const tParts = [
    limb(0, 0, 0, 0, 0.14, 0, trunkBot * 1.45, trunkBot, 7),
    limb(0, 0.14, 0, 0, topY * 0.94, 0, trunkBot, 0.005, 7),
  ];
  const fParts = [];
  for (let tr = 0; tr < tiers; tr++) {
    const u = tr / Math.max(1, tiers - 1);
    const y = baseY + u * (topY - baseY);
    const r = baseRadius * Math.pow(1.0 - u * 0.82, 0.85);
    const nC = Math.max(3, Math.round(cardsPerTier * (1.0 - u * 0.35)));
    for (let k = 0; k < nC; k++) {
      const a = (k / nC) * Math.PI * 2 + tr * 0.9;
      if (k % 2 === 0 && tr < tiers - 1) {
        tParts.push(limb(0, y, 0, Math.sin(a) * r * 0.72, y - r * 0.12, Math.cos(a) * r * 0.72, 0.011 * (1 - u * 0.6), 0.004, 4));
      }
      fParts.push(card({
        origin: [Math.sin(a) * 0.02, y, Math.cos(a) * 0.02],
        yaw: a, pitch: pitch + u * 0.25, roll: ((k % 2) ? 0.12 : -0.12),
        width: r * 1.15, length: r * 1.25, droop: droop * (1.1 - u * 0.5),
        uvRect, crownCenter: [0, (baseY + topY) * 0.52, 0], tipTaper: 0.72,
      }));
    }
  }
  // Crown apex tuft
  for (let k = 0; k < 3; k++) {
    fParts.push(card({
      origin: [0, topY - 0.04, 0], yaw: (k / 3) * Math.PI * 2, pitch: 0.85,
      width: 0.11, length: 0.14, droop: 0.01, uvRect, crownCenter: [0, topY * 0.75, 0], tipTaper: 0.5,
    }));
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildBambooGroveCluster() {
  // #12: Giant Moso Bamboo (孟宗竹) — 6 slender curved jade-green culms with feathery top plumes!
  const tParts = [];
  const fParts = [];
  const stalks = [
    [0.00, 0.00, 1.00, 0.04, 0.02],
    [0.11, 0.08, 0.94, 0.07, 0.06],
    [-0.10, 0.09, 0.90, -0.06, 0.07],
    [0.08, -0.11, 0.86, 0.06, -0.08],
    [-0.12, -0.07, 0.92, -0.08, -0.05],
    [0.02, 0.15, 0.82, 0.02, 0.09],
  ];
  for (let s = 0; s < stalks.length; s++) {
    const [sx, sz, sh, leanX, leanZ] = stalks[s];
    const r = 0.013;
    const mX = sx + leanX * 0.45, mZ = sz + leanZ * 0.45;
    const tX = sx + leanX * 1.35, tZ = sz + leanZ * 1.35;
    tParts.push(limb(sx, 0, sz, mX, sh * 0.52, mZ, r * 1.15, r, 6));
    tParts.push(limb(mX, sh * 0.52, mZ, tX, sh, tZ, r, r * 0.42, 6));
    for (let k = 0; k < 5; k++) {
      const a = k * GA + s * 1.1;
      const y = sh * (0.58 + k * 0.095);
      const u = (y / sh);
      const ox = sx + leanX * (u * 1.25);
      const oz = sz + leanZ * (u * 1.25);
      fParts.push(card({
        origin: [ox, y, oz], yaw: a, pitch: 0.12 + k * 0.08,
        width: 0.24, length: 0.28, droop: 0.09,
        uvRect: EXTENDED_BOTANICAL_UV.bamboo, crownCenter: [0, 0.78, 0], segV: 2,
      }));
    }
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildWeepingCurtainTree(uvRect, trunkBot = 0.042, curtainDrop = 0.34) {
  // #10 Shidare-Sakura (枝垂れ桜) & #23 Wisteria-draped ancient tree (山藤古木)
  const tParts = [
    limb(0, 0, 0, 0.05, 0.32, 0.02, trunkBot * 1.35, trunkBot, 7),
    limb(0.05, 0.32, 0.02, 0.10, 0.56, -0.02, trunkBot, trunkBot * 0.62, 6),
  ];
  const fParts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const bx = 0.10 + Math.cos(a) * 0.32;
    const bz = -0.02 + Math.sin(a) * 0.32;
    tParts.push(limb(0.10, 0.54, -0.02, bx, 0.72 + (i % 2) * 0.07, bz, trunkBot * 0.56, 0.008, 5));
    // Hanging curtain fronds drooping gracefully downward!
    for (let k = 0; k < 4; k++) {
      const ca = a + (k - 1.5) * 0.42;
      const ox = 0.10 + Math.cos(ca) * (0.14 + k * 0.07);
      const oz = -0.02 + Math.sin(ca) * (0.14 + k * 0.07);
      fParts.push(card({
        origin: [ox, 0.76 - k * 0.04, oz],
        yaw: ca, pitch: -0.95, roll: (k % 2 ? 0.14 : -0.14),
        width: 0.22, length: curtainDrop, droop: 0.05,
        uvRect, crownCenter: [0.08, 0.65, 0], segV: 2, flipV: true,
      }));
    }
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildHaimatsuKrummholz() {
  // #19: Alpine Dwarf Stone Pine (ハイマツ) — low prostrate wind-sculpted gnarled alpine cushion!
  const tParts = [];
  const fParts = [];
  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2 + 0.4;
    const r = 0.34 + (s % 2) * 0.10;
    const ex = Math.cos(a) * r, ez = Math.sin(a) * r;
    tParts.push(limb(0, 0.02, 0, ex * 0.6, 0.16, ez * 0.6, 0.032, 0.018, 5));
    tParts.push(limb(ex * 0.6, 0.16, ez * 0.6, ex, 0.30, ez, 0.018, 0.009, 5));
    for (let k = 0; k < 4; k++) {
      const ca = a + (k - 1.5) * 0.55;
      fParts.push(card({
        origin: [ex * 0.65, 0.24 + k * 0.04, ez * 0.65],
        yaw: ca, pitch: 0.22, width: 0.28, length: 0.26, droop: 0.02,
        uvRect: BOTANICAL_UV.pine, crownCenter: [0, 0.28, 0],
      }));
    }
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildKarekigiSnag() {
  // #28: Lightning-Bleached Ancient Silver-Bone Deadwood Snag (白骨古木・枯死巨木)
  const tParts = [
    limb(0, 0, 0, 0.03, 0.28, -0.02, 0.068, 0.044, 7),
    limb(0.03, 0.28, -0.02, -0.02, 0.62, 0.04, 0.044, 0.024, 6),
    limb(-0.02, 0.62, 0.04, 0.05, 0.94, -0.01, 0.024, 0.006, 5), // jagged lightning-split spire tip
    limb(0.02, 0.34, 0.00, 0.24, 0.48, 0.14, 0.022, 0.005, 5),
    limb(0.00, 0.48, 0.02, -0.26, 0.60, -0.10, 0.020, 0.005, 5),
    limb(-0.01, 0.66, 0.03, 0.18, 0.78, -0.18, 0.014, 0.004, 4),
    limb(-0.01, 0.54, 0.03, -0.12, 0.72, 0.22, 0.015, 0.004, 4),
  ];
  // Minimal weathered lichen tufts clinging to 3 dead stubs
  const fParts = [
    card({ origin: [0.16, 0.44, 0.09], yaw: 0.5, pitch: -0.7, width: 0.09, length: 0.12, droop: 0.04, uvRect: BOTANICAL_UV.willow, crownCenter: [0, 0.5, 0], flipV: true }),
    card({ origin: [-0.18, 0.56, -0.06], yaw: 3.4, pitch: -0.7, width: 0.09, length: 0.11, droop: 0.04, uvRect: BOTANICAL_UV.willow, crownCenter: [0, 0.5, 0], flipV: true }),
  ];
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildBroomZelkova() {
  // #14: Cathedral Japanese Keyaki Zelkova (大ケヤキ) — iconic vase/broom silhouette!
  const tParts = [
    limb(0, 0, 0, 0, 0.34, 0, 0.060, 0.042, 8),
  ];
  const fParts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    const midX = Math.cos(a) * 0.15, midZ = Math.sin(a) * 0.15;
    const tipX = Math.cos(a) * 0.36, tipZ = Math.sin(a) * 0.36;
    tParts.push(limb(0, 0.32, 0, midX, 0.62, midZ, 0.026, 0.015, 5));
    tParts.push(limb(midX, 0.62, midZ, tipX, 0.84, tipZ, 0.015, 0.007, 5));
    for (let k = 0; k < 5; k++) {
      const ca = a + (k - 2) * 0.42;
      const r = 0.14 + (k % 3) * 0.10;
      fParts.push(card({
        origin: [Math.cos(ca) * r, 0.68 + (k % 3) * 0.09, Math.sin(ca) * r],
        yaw: ca, pitch: 0.32, width: 0.30, length: 0.30, droop: 0.03,
        uvRect: EXTENDED_BOTANICAL_UV.oak, crownCenter: [0, 0.78, 0],
      }));
    }
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

function buildGinkgoColumn() {
  // #11: Ancient Golden Ginkgo (大銀杏) — tall ribbed columnar trunk + glowing upright golden crown!
  const tParts = [
    limb(0, 0, 0, 0, 0.84, 0, 0.056, 0.012, 8),
  ];
  const fParts = [];
  for (let i = 0; i < 24; i++) {
    const u = i / 23;
    const y = 0.28 + u * 0.68;
    const a = i * GA;
    const r = 0.24 * Math.sin(Math.pow(u, 0.75) * Math.PI * 0.88 + 0.18);
    if (i % 3 === 0) {
      tParts.push(limb(0, y, 0, Math.cos(a) * r * 0.85, y + 0.09, Math.sin(a) * r * 0.85, 0.012, 0.005, 4));
    }
    fParts.push(card({
      origin: [Math.cos(a) * r * 0.35, y, Math.sin(a) * r * 0.35],
      yaw: a, pitch: 0.38, width: 0.25 * (1.0 - u * 0.45), length: 0.26 * (1.0 - u * 0.42),
      droop: 0.015, uvRect: EXTENDED_BOTANICAL_UV.ginkgo, crownCenter: [0, 0.62, 0],
    }));
  }
  return { trunkGeo: mergeGeos(tParts), foliageGeo: mergeGeos(fParts) };
}

/**
 * Complete Definition Table of ALL +20 BRAND-NEW JAPANESE TREE SPECIES (IDs 9..28)!
 */
export const EXTENDED_TREE_SPECIES_V4 = [
  {
    id: 'sakura_yamazakura',
    nameJp: '山桜',
    atlas: 'ext',
    bark: 'sakura',
    cap: 150,
    minH: 9.5, maxH: 16.5, radRatio: 1.12, colliderR: 0.040,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.sakura, limbCount: 6, limbSpan: 0.38, cardCount: 28, cardW: 0.30, cardL: 0.32, droop: 0.03 }),
    colorFn: (v) => [0.58 + v * 0.18, 0.44 + v * 0.14, 0.48 + v * 0.14],
    trunkColorFn: (v) => [0.85 + v * 0.18, 0.78 + v * 0.16, 0.74 + v * 0.14],
  },
  {
    id: 'sakura_shidare',
    nameJp: '枝垂れ桜',
    atlas: 'ext',
    bark: 'sakura',
    cap: 110,
    minH: 8.5, maxH: 14.0, radRatio: 1.15, colliderR: 0.038,
    build: () => buildWeepingCurtainTree(EXTENDED_BOTANICAL_UV.sakura, 0.044, 0.36),
    colorFn: (v) => [0.64 + v * 0.16, 0.46 + v * 0.14, 0.54 + v * 0.14],
    trunkColorFn: (v) => [0.82 + v * 0.16, 0.74 + v * 0.14, 0.70 + v * 0.12],
  },
  {
    id: 'ginkgo_icho',
    nameJp: '大銀杏',
    atlas: 'ext',
    bark: 'buna',
    cap: 120,
    minH: 15.0, maxH: 25.0, radRatio: 0.88, colliderR: 0.044,
    build: buildGinkgoColumn,
    colorFn: (v) => [0.56 + v * 0.20, 0.44 + v * 0.16, 0.08 + v * 0.06],
    trunkColorFn: (v) => [0.76 + v * 0.16, 0.72 + v * 0.14, 0.64 + v * 0.14],
  },
  {
    id: 'bamboo_moso',
    nameJp: '孟宗竹',
    atlas: 'ext',
    bark: 'bamboo',
    cap: 190,
    minH: 11.0, maxH: 18.5, radRatio: 1.05, colliderR: 0.052,
    build: buildBambooGroveCluster,
    colorFn: (v) => [0.18 + v * 0.10, 0.32 + v * 0.14, 0.14 + v * 0.08],
    trunkColorFn: (v) => [0.74 + v * 0.24, 0.88 + v * 0.18, 0.56 + v * 0.18],
  },
  {
    id: 'karamatsu_larch',
    nameJp: 'カラマツ',
    atlas: 'ext',
    bark: 'hinoki',
    cap: 170,
    minH: 15.0, maxH: 26.0, radRatio: 0.86, colliderR: 0.032,
    build: () => buildConiferSpire({ uvRect: EXTENDED_BOTANICAL_UV.larch, tiers: 8, baseRadius: 0.25, droop: 0.06 }),
    colorFn: (v) => (v < 0.65 ? [0.42 + v * 0.22, 0.38 + v * 0.14, 0.12 + v * 0.06] : [0.22 + v * 0.12, 0.30 + v * 0.10, 0.12]),
    trunkColorFn: (v) => [0.86 + v * 0.18, 0.74 + v * 0.16, 0.62 + v * 0.14],
  },
  {
    id: 'keyaki_zelkova',
    nameJp: '大ケヤキ',
    atlas: 'ext',
    bark: 'buna',
    cap: 140,
    minH: 15.5, maxH: 25.5, radRatio: 1.12, colliderR: 0.048,
    build: buildBroomZelkova,
    colorFn: (v) => (v < 0.68 ? [0.16 + v * 0.12, 0.25 + v * 0.12, 0.12 + v * 0.06] : [0.42 + v * 0.18, 0.24 + v * 0.10, 0.09]),
    trunkColorFn: (v) => [0.80 + v * 0.18, 0.78 + v * 0.16, 0.74 + v * 0.14],
  },
  {
    id: 'mizunara_oak',
    nameJp: 'ミズナラ',
    atlas: 'ext',
    bark: 'sugi',
    cap: 150,
    minH: 13.0, maxH: 22.0, radRatio: 1.14, colliderR: 0.046,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.oak, trunkBot: 0.054, limbCount: 6, limbSpan: 0.40, cardCount: 26, cardW: 0.31, cardL: 0.31 }),
    colorFn: (v) => [0.15 + v * 0.14, 0.22 + v * 0.12, 0.11 + v * 0.06],
    trunkColorFn: (v) => [0.76 + v * 0.18, 0.70 + v * 0.16, 0.62 + v * 0.14],
  },
  {
    id: 'kuromatsu_pine',
    nameJp: 'クロマツ',
    atlas: 'core',
    bark: 'sugi',
    cap: 130,
    minH: 11.0, maxH: 20.0, radRatio: 1.18, colliderR: 0.042,
    build: () => buildSpreadingTree({ uvRect: BOTANICAL_UV.pine, trunkBot: 0.050, lean: 0.12, limbCount: 5, limbSpan: 0.42, cardCount: 22, cardW: 0.32, cardL: 0.28, droop: 0.02, pitchBase: 0.04 }),
    colorFn: (v) => [0.09 + v * 0.06, 0.15 + v * 0.07, 0.11 + v * 0.06],
    trunkColorFn: (v) => [0.54 + v * 0.16, 0.52 + v * 0.14, 0.50 + v * 0.14],
  },
  {
    id: 'momi_fir',
    nameJp: 'モミの木',
    atlas: 'core',
    bark: 'sugi',
    cap: 160,
    minH: 17.0, maxH: 29.0, radRatio: 0.90, colliderR: 0.036,
    build: () => buildConiferSpire({ uvRect: BOTANICAL_UV.hinoki, tiers: 9, baseRadius: 0.30, droop: 0.03, pitch: -0.06 }),
    colorFn: (v) => [0.08 + v * 0.05, 0.15 + v * 0.07, 0.15 + v * 0.07],
    trunkColorFn: (v) => [0.76 + v * 0.16, 0.74 + v * 0.14, 0.70 + v * 0.14],
  },
  {
    id: 'tsuga_hemlock',
    nameJp: 'コメツガ',
    atlas: 'core',
    bark: 'hinoki',
    cap: 140,
    minH: 13.0, maxH: 22.0, radRatio: 0.92, colliderR: 0.032,
    build: () => buildConiferSpire({ uvRect: BOTANICAL_UV.sugi, tiers: 8, baseRadius: 0.28, droop: 0.09, pitch: -0.22 }),
    colorFn: (v) => [0.09 + v * 0.06, 0.16 + v * 0.08, 0.13 + v * 0.06],
    trunkColorFn: (v) => [0.80 + v * 0.16, 0.72 + v * 0.14, 0.66 + v * 0.14],
  },
  {
    id: 'haimatsu_dwarf',
    nameJp: 'ハイマツ',
    atlas: 'core',
    bark: 'pine',
    cap: 130,
    minH: 2.8, maxH: 5.5, radRatio: 1.55, colliderR: 0.050,
    build: buildHaimatsuKrummholz,
    colorFn: (v) => [0.10 + v * 0.07, 0.17 + v * 0.08, 0.12 + v * 0.06],
    trunkColorFn: (v) => [0.76 + v * 0.16, 0.70 + v * 0.14, 0.64 + v * 0.12],
  },
  {
    id: 'dakekanba_birch',
    nameJp: 'ダケカンバ',
    atlas: 'core',
    bark: 'birch',
    cap: 120,
    minH: 9.0, maxH: 16.0, radRatio: 1.08, colliderR: 0.036,
    build: () => buildSpreadingTree({ uvRect: BOTANICAL_UV.birch, lean: 0.14, multiStem: 2, limbSpan: 0.34, cardCount: 22, cardW: 0.27, cardL: 0.28 }),
    colorFn: (v) => [0.36 + v * 0.18, 0.34 + v * 0.14, 0.11 + v * 0.06],
    trunkColorFn: (v) => [0.94 + v * 0.08, 0.80 + v * 0.10, 0.68 + v * 0.10],
  },
  {
    id: 'katsura_tree',
    nameJp: '大カツラ',
    atlas: 'ext',
    bark: 'buna',
    cap: 120,
    minH: 15.0, maxH: 25.0, radRatio: 1.14, colliderR: 0.048,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.oak, multiStem: 3, trunkBot: 0.056, limbSpan: 0.38, cardCount: 28, cardW: 0.29, cardL: 0.30 }),
    colorFn: (v) => (v < 0.55 ? [0.18 + v * 0.14, 0.26 + v * 0.12, 0.13 + v * 0.06] : [0.46 + v * 0.18, 0.34 + v * 0.12, 0.12]),
    trunkColorFn: (v) => [0.80 + v * 0.16, 0.76 + v * 0.14, 0.72 + v * 0.14],
  },
  {
    id: 'tochinoki_chestnut',
    nameJp: 'トチノキ',
    atlas: 'core',
    bark: 'buna',
    cap: 110,
    minH: 14.0, maxH: 23.0, radRatio: 1.24, colliderR: 0.048,
    build: () => buildSpreadingTree({ uvRect: BOTANICAL_UV.buna, trunkBot: 0.058, limbCount: 6, limbSpan: 0.44, cardCount: 28, cardW: 0.34, cardL: 0.34, droop: 0.05 }),
    colorFn: (v) => [0.14 + v * 0.10, 0.23 + v * 0.12, 0.10 + v * 0.05],
    trunkColorFn: (v) => [0.74 + v * 0.16, 0.72 + v * 0.14, 0.68 + v * 0.14],
  },
  {
    id: 'fuji_wisteria_tree',
    nameJp: '山藤絡み古木',
    atlas: 'ext',
    bark: 'sugi',
    cap: 110,
    minH: 10.0, maxH: 16.5, radRatio: 1.14, colliderR: 0.042,
    build: () => buildWeepingCurtainTree(EXTENDED_BOTANICAL_UV.wisteria, 0.048, 0.42),
    colorFn: (v) => [0.48 + v * 0.14, 0.44 + v * 0.12, 0.46 + v * 0.12],
    trunkColorFn: (v) => [0.76 + v * 0.16, 0.70 + v * 0.14, 0.64 + v * 0.14],
  },
  {
    id: 'tsubaki_camellia',
    nameJp: 'ヤブツバキ',
    atlas: 'ext',
    bark: 'sakura',
    cap: 120,
    minH: 5.5, maxH: 9.8, radRatio: 1.08, colliderR: 0.032,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.blossom, multiStem: 2, trunkBot: 0.034, splitY: 0.28, limbSpan: 0.32, cardCount: 20, cardW: 0.28, cardL: 0.28 }),
    colorFn: (v) => [0.22 + v * 0.10, 0.24 + v * 0.10, 0.20 + v * 0.08],
    trunkColorFn: (v) => [0.78 + v * 0.16, 0.76 + v * 0.14, 0.74 + v * 0.12],
  },
  {
    id: 'kobushi_magnolia',
    nameJp: 'コブシ',
    atlas: 'ext',
    bark: 'buna',
    cap: 110,
    minH: 8.5, maxH: 14.5, radRatio: 1.06, colliderR: 0.036,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.blossom, limbCount: 5, limbSpan: 0.36, cardCount: 24, cardW: 0.28, cardL: 0.30 }),
    colorFn: (v) => [0.36 + v * 0.12, 0.38 + v * 0.12, 0.34 + v * 0.10],
    trunkColorFn: (v) => [0.88 + v * 0.14, 0.86 + v * 0.14, 0.84 + v * 0.12],
  },
  {
    id: 'nanakamado_rowan',
    nameJp: 'ナナカマド',
    atlas: 'ext',
    bark: 'sakura',
    cap: 130,
    minH: 7.0, maxH: 13.0, radRatio: 1.04, colliderR: 0.032,
    build: () => buildSpreadingTree({ uvRect: EXTENDED_BOTANICAL_UV.rowan, multiStem: 2, limbSpan: 0.32, cardCount: 22, cardW: 0.27, cardL: 0.28 }),
    colorFn: (v) => [0.56 + v * 0.22, 0.22 + v * 0.12, 0.12 + v * 0.06],
    trunkColorFn: (v) => [0.82 + v * 0.16, 0.76 + v * 0.14, 0.72 + v * 0.12],
  },
  {
    id: 'sawara_cypress',
    nameJp: 'サワラ',
    atlas: 'core',
    bark: 'hinoki',
    cap: 130,
    minH: 15.0, maxH: 25.0, radRatio: 0.84, colliderR: 0.034,
    build: () => buildConiferSpire({ uvRect: BOTANICAL_UV.hinoki, tiers: 8, baseRadius: 0.24, droop: 0.07 }),
    colorFn: (v) => [0.10 + v * 0.06, 0.19 + v * 0.08, 0.14 + v * 0.06],
    trunkColorFn: (v) => [0.88 + v * 0.16, 0.72 + v * 0.14, 0.58 + v * 0.12],
  },
  {
    id: 'karekigi_snag',
    nameJp: '白骨古木',
    atlas: 'core',
    bark: 'birch',
    cap: 90,
    minH: 10.0, maxH: 19.5, radRatio: 0.96, colliderR: 0.042,
    build: buildKarekigiSnag,
    colorFn: () => [0.36, 0.42, 0.32],
    trunkColorFn: (v) => [0.76 + v * 0.16, 0.75 + v * 0.15, 0.72 + v * 0.14],
  },
];

/**
 * Ecologically choose one of the 20 new tree species based on elevation, slope, river proximity,
 * landform proximity, and natural micro-grove clustering!
 */
export function pickExtendedSpeciesIndex(wx, wz, elevASL, slope, onRiverBank, landformHit, roll) {
  const lfKind = landformHit ? landformHit.landform.kind : null;

  // High alpine ridges, glacial troughs, horns, arêtes, saddles, nivation hollows & avalanche chutes (> 880m ASL)
  if (
    elevASL > 880 ||
    lfKind === 'alpine_saddle' || lfKind === 'glacial_cirque' ||
    lfKind === 'glacial_u_trough' || lfKind === 'knife_edge_arete' ||
    lfKind === 'glacial_horn_peak' || lfKind === 'lateral_moraine_ridge' ||
    lfKind === 'solifluction_lobe_slope' || lfKind === 'nivation_snow_hollow' ||
    lfKind === 'avalanche_chute_couloir'
  ) {
    if (roll < 0.26) return 10; // haimatsu_dwarf (ハイマツ)
    if (roll < 0.48) return 11; // dakekanba_birch (ダケカンバ)
    if (roll < 0.70) return 4;  // karamatsu_larch (カラマツ)
    if (roll < 0.86) return 17; // nanakamado_rowan (ナナカマド)
    if (roll < 0.94) return 9;  // tsuga_hemlock (コメツガ)
    return 19;                  // karekigi_snag (白骨古木)
  }

  // Peat bogs, backswamps, seepage fens, oxbow lakes, kettle ponds & polje wet basins
  if (
    lfKind === 'peat_bog' || lfKind === 'natural_levee_backswamp' ||
    lfKind === 'alpine_seepage_fen_terrace' || lfKind === 'kettle_hole_ponds' ||
    lfKind === 'karst_polje_flat_basin'
  ) {
    if (roll < 0.42) return 18; // sawara_cypress
    if (roll < 0.68) return 4;  // karamatsu_larch
    if (roll < 0.86) return 11; // dakekanba_birch
    return 19;                  // karekigi_snag
  }

  // Waterfalls, spring alcoves, oxbows, point bars, knickpoints, dammed lakes & riverbanks
  if (
    onRiverBank || lfKind === 'waterfall_multitier' || lfKind === 'waterfall_veil' ||
    lfKind === 'moss_cascade_ravine' || lfKind === 'oxbow_cutoff_lake' ||
    lfKind === 'point_bar_scroll_plain' || lfKind === 'knickpoint_rock_rapids' ||
    lfKind === 'landslide_dammed_lake' || lfKind === 'spring_sapping_alcove'
  ) {
    if (roll < 0.24) return 12; // katsura_tree (大カツラ)
    if (roll < 0.44) return 13; // tochinoki_chestnut (トチノキ)
    if (roll < 0.62) return 1;  // sakura_shidare (枝垂れ桜)
    if (roll < 0.78) return 14; // fuji_wisteria_tree (山藤絡み古木)
    if (roll < 0.90) return 18; // sawara_cypress (サワラ)
    return 15;                  // tsubaki_camellia (ヤブツバキ)
  }

  // Volcanic lava domes, scoria cones, fumaroles, hogbacks, fault scarps, badlands, cliffs & gorges
  if (
    slope > 0.38 || lfKind === 'basalt_cliff' || lfKind === 'granite_hoodoos' ||
    lfKind === 'v_gorge' || lfKind === 'incised_meander_gorge' ||
    lfKind === 'lava_dome_extrusion' || lfKind === 'shield_lava_apron' ||
    lfKind === 'fumarole_sulfur_basin' || lfKind === 'hogback_strike_ridge' ||
    lfKind === 'fault_scarp_step' || lfKind === 'badlands_rilled_gullies' ||
    lfKind === 'scoria_cone' || lfKind === 'roche_moutonnee_knolls'
  ) {
    if (roll < 0.36) return 7;  // kuromatsu_pine (クロマツ)
    if (roll < 0.58) return 19; // karekigi_snag (白骨古木)
    if (roll < 0.78) return 9;  // tsuga_hemlock (コメツガ)
    return 17;                  // nanakamado_rowan (ナナカマド)
  }

  // Natural micro-grove clusters for Moso Bamboo, Yamazakura Cherry, and Golden Ginkgo!
  const bambooCluster = Math.sin(wx * 0.017 + wz * 0.013 + 0.7) * Math.cos(wx * 0.011 - wz * 0.019);
  if (bambooCluster > 0.42 && elevASL < 620 && roll < 0.52) return 3; // bamboo_moso (孟宗竹竹林!)

  const sakuraCluster = Math.cos(wx * 0.014 - wz * 0.016 + 2.1);
  if (sakuraCluster > 0.45 && elevASL < 700 && roll < 0.36) return roll < 0.22 ? 0 : 1; // 山桜 / 枝垂れ桜

  // Balanced rich multi-species montane forest distribution covering ALL 20 new species!
  const idx = Math.floor(roll * 20) % 20;
  return idx;
}
