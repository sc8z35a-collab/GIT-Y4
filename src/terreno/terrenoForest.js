import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';
import {
  getBotanicalFoliageAtlas,
  getBotanicalBarkTexture,
} from './terrenoBotanicalAtlas.js';

/**
 * TERRENO Engine v2 — Breakthroughs TR-BOTANICA + TR-GROUNDCOVER + TR-KOMOREBI:
 * Photorealistic Japanese Mountain Forest & Dense Understory Streamer across 5km × 19km!
 *
 * Major v2 Architectural Leaps:
 *   1. True 3D Multi-Branch Woody Skeletons (tapered trunks, root flares, & projecting limbs)
 *      textured with 512×512 seamless fluted Cedar & Silver-Beech Bark!
 *   2. Curved, V-Cupped Alpha-Cutout Botanical Branch Cards sampling the 1024×1024 TR-BOTANICA
 *      Atlas (Sugi Cedar boughs, Abies/Hinoki sprays, serrated Buna Beech leafy twigs)
 *      with SpeedTree-Grade Spherical Normal Transfer (Normal Bending), Baked Crown AO,
 *      Coverage-Preserving Distance Alpha-Test, & Dual-Sided Subsurface Backlit Translucency!
 *   3. Dense Near-Field Groundcover Carpet Streamer (32m micro-tiles, 0..50m):
 *      - 3,200+ Wild Mountain Sedge & Forest Grass Tufts (lining forest floors & road verges!)
 *      - 1,200+ Kumazasa Dwarf Bamboo Clumps with authentic pale Kumadori margins (クマザサ)
 *      - 1,400+ Lacy Pinnate Japanese Wood-Fern Rosettes (イノデ羊歯)
 *   4. Star-Crossed Alpha-Cutout Botanical Mid-Distance Treeline Impostors (160m..1,550m)
 *      anchored deeply via exact getHeightAt() — ZERO cones, ZERO broccoli spheres, ZERO floating trees!
 *   5. Unified Sun-Aligned Animated Forest Canopy Komorebi (木漏れ日) across trunks, boulders, & groundcover!
 */

const NEAR_TILE_SIZE = 64.0;
const NEAR_TILE_RADIUS = 3;    // 7×7 tiles = ±224m full 3D botanical trees
const DETAIL_TILE_RADIUS = 1;  // 3×3 tiles = ±96m boulders, logs & lacy ferns
const GROUND_TILE_SIZE = 32.0;
const GROUND_TILE_RADIUS = 1;  // 3×3 micro-tiles = ±48m ultra-dense grass & Kumazasa carpet
const MID_TILE_SIZE = 128.0;
const MID_TILE_RADIUS = 11;    // 23×23 tiles = ±1,472m ragged alpha-cutout botanical treelines

// Exact UV rectangles inside the 1024×1024 TR-BOTANICA Atlas (2px inset avoids mipmap bleed)
const UV_SUGI  = [0.005, 0.505, 0.495, 0.995];
const UV_ABIES = [0.505, 0.505, 0.995, 0.995];
const UV_BUNA  = [0.005, 0.005, 0.495, 0.495];
const UV_FERN  = [0.504, 0.004, 0.746, 0.496];
const UV_SASA  = [0.754, 0.254, 0.996, 0.496];
const UV_GRASS = [0.754, 0.004, 0.996, 0.246];

function makeTileRng(tx, tz, salt) {
  let h = Math.imul(tx, 374761393) ^ Math.imul(tz, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  let s = (h ^ (h >>> 16)) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

function mergeGeometriesFull(geos) {
  let totalVerts = 0;
  let totalIndices = 0;
  const hasUv = geos.every((g) => Boolean(g.attributes.uv));
  const hasMeta = geos.every((g) => Boolean(g.attributes.aMeta));

  const normalized = geos.map((geom) => {
    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;
    const uv = hasUv ? geom.attributes.uv : null;
    const meta = hasMeta ? geom.attributes.aMeta : null;
    const idx = geom.index;
    const vCount = pos.count;
    const iCount = idx ? idx.count : vCount;
    totalVerts += vCount;
    totalIndices += iCount;
    return { pos, norm, uv, meta, idx, vCount, iCount };
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = hasUv ? new Float32Array(totalVerts * 2) : null;
  const metas = hasMeta ? new Float32Array(totalVerts * 2) : null;
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (let k = 0; k < normalized.length; k++) {
    const item = normalized[k];
    positions.set(item.pos.array, vOffset * 3);
    normals.set(item.norm.array, vOffset * 3);
    if (uvs && item.uv) uvs.set(item.uv.array, vOffset * 2);
    if (metas && item.meta) metas.set(item.meta.array, vOffset * 2);
    if (item.idx) {
      const src = item.idx.array;
      for (let i = 0; i < src.length; i++) indices[iOffset + i] = src[i] + vOffset;
    } else {
      for (let i = 0; i < item.vCount; i++) indices[iOffset + i] = i + vOffset;
    }
    vOffset += item.vCount;
    iOffset += item.iCount;
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

function perturbGeometry(geo, amount, yMin = -999, seed = 11) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y <= yMin) continue;
    const n1 = Math.sin(x * 4.3 + y * 2.9 + z * 4.7 + seed);
    const n2 = Math.cos(x * 5.7 - y * 3.3 + z * 3.1 + seed * 1.7);
    const n3 = Math.sin(x * 3.1 + y * 5.1 - z * 3.9 + seed * 2.3);
    pos.setXYZ(i, x + n1 * amount, y + n2 * amount * 0.45, z + n3 * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a 2×2 Curved, Drooping, V-Cupped Botanical Foliage Branch Card with
 * SpeedTree-Grade Spherical Crown Normal Transfer (Normal Bending) & Baked Crown AO!
 */
function buildCurvedBotanicalCard(opts) {
  const {
    origin,          // [x, y, z] branch socket anchor
    yaw,             // azimuth radians
    pitch,           // upward/downward tilt radians (0 = horizontal outward, +PI/2 = straight up)
    roll = 0,        // twist around branch axis
    width,           // lateral card width
    length,          // radial bough length
    droop = 0.03,    // downward parabolic bough arch at tip
    cup = 0.015,     // slight V-cup cross-section so card looks 3D even edge-on
    uvRect,          // [u0, v0, u1, v1]
    crownCenter,     // [cx, cy, cz] for spherical normal transfer
    aoInner = 0.42,
    aoOuter = 1.12,
    flutterBase = 0.0,
    flutterTip = 1.0,
    segV = 1,
    tipTaper = 1.0,
  } = opts;

  const segU = 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const metas = [];
  const indices = [];

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const cosR = Math.cos(roll), sinR = Math.sin(roll);

  // Branch local frame: fwd along bough, right across width, up perpendicular
  const fwd = [sinY * cosP, sinP, cosY * cosP];
  const r0  = [cosY, 0, -sinY];
  const u0  = [-sinY * sinP, cosP, -cosY * sinP];
  const right = [
    r0[0] * cosR + u0[0] * sinR,
    r0[1] * cosR + u0[1] * sinR,
    r0[2] * cosR + u0[2] * sinR,
  ];
  const up = [
    -r0[0] * sinR + u0[0] * cosR,
    -r0[1] * sinR + u0[1] * cosR,
    -r0[2] * sinR + u0[2] * cosR,
  ];

  const [uMin, vMin, uMax, vMax] = uvRect;
  const [ox, oy, oz] = origin;
  const [cx, cy, cz] = crownCenter;

  for (let iv = 0; iv <= segV; iv++) {
    const t = iv / segV;
    const wTaper = 1.0 + (tipTaper - 1.0) * t;
    for (let iu = 0; iu <= segU; iu++) {
      const s = iu / segU;
      const sw = (s - 0.5) * width * wTaper;
      const sl = t * length;
      const vCup = cup * (1.0 - 4.0 * (s - 0.5) * (s - 0.5));
      const dY = -droop * t * t;

      const px = ox + fwd[0] * sl + right[0] * sw + up[0] * vCup;
      const py = oy + fwd[1] * sl + right[1] * sw + up[1] * vCup + dY;
      const pz = oz + fwd[2] * sl + right[2] * sw + up[2] * vCup;
      positions.push(px, py, pz);

      let nx = px - cx;
      let ny = (py - cy) * 0.85 + 0.14;
      let nz = pz - cz;
      const nl = Math.hypot(nx, ny, nz) || 1.0;
      nx = (nx / nl) * 0.82 + up[0] * 0.18;
      ny = (ny / nl) * 0.82 + up[1] * 0.18;
      nz = (nz / nl) * 0.82 + up[2] * 0.18;
      const fl = Math.hypot(nx, ny, nz) || 1.0;
      normals.push(nx / fl, ny / fl, nz / fl);

      uvs.push(uMin + (uMax - uMin) * s, vMin + (vMax - vMin) * t);
      const ao = aoInner + (aoOuter - aoInner) * Math.pow(t, 0.72) * (0.86 + 0.14 * Math.abs(s - 0.5) * 2.0);
      const flt = flutterBase + (flutterTip - flutterBase) * t * t;
      metas.push(ao, flt);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aMeta', new THREE.Float32BufferAttribute(metas, 2));
  geo.setIndex(indices);
  return geo;
}

// Helper to orient a woody branch cylinder from point A to point B
function buildWoodLimb(ax, ay, az, bx, by, bz, rBottom, rTop, radialSegs = 6) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const cyl = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegs, 1);
  cyl.translate(0, len * 0.5, 0);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cyl.applyQuaternion(quat);
  cyl.translate(ax, ay, az);
  return cyl;
}

// ---- 1. ANCIENT JAPANESE SUGI CEDAR (屋久杉・黒杉) — Woody Skeleton + Tapered Drooping Bough Cards ----

function buildSugiTrunkGeo() {
  const parts = [];
  const main = new THREE.CylinderGeometry(0.005, 0.032, 0.90, 8, 4);
  main.translate(0, 0.45, 0);
  parts.push(main);
  const root = new THREE.CylinderGeometry(0.030, 0.056, 0.14, 8, 1);
  root.translate(0, 0.05, 0);
  parts.push(root);
  const golden = 2.3999632;
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const y0 = 0.28 + t * 0.46;
    const ang = i * golden;
    const len = (0.140 - t * 0.068);
    const bx = Math.sin(ang) * len;
    const bz = Math.cos(ang) * len;
    const by = y0 - len * 0.24;
    parts.push(buildWoodLimb(0, y0, 0, bx, by, bz, 0.009 * (1 - t * 0.4), 0.003, 5));
  }
  return mergeGeometriesFull(parts);
}

function buildSugiFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.56, 0];
  const golden = 2.3999632;

  // 8 organic staggered cedar whorls with deep internal shadow cavities & crisp tapering apex!
  const whorls = [
    { y: 0.25, count: 6, len: 0.235, wid: 0.20, pitch: -0.24, droop: 0.064, ao: 0.24 },
    { y: 0.35, count: 6, len: 0.215, wid: 0.19, pitch: -0.18, droop: 0.056, ao: 0.30 },
    { y: 0.45, count: 6, len: 0.190, wid: 0.175, pitch: -0.12, droop: 0.048, ao: 0.38 },
    { y: 0.55, count: 5, len: 0.165, wid: 0.155, pitch: -0.05, droop: 0.040, ao: 0.46 },
    { y: 0.65, count: 5, len: 0.140, wid: 0.135, pitch: 0.04, droop: 0.032, ao: 0.54 },
    { y: 0.74, count: 4, len: 0.112, wid: 0.112, pitch: 0.16, droop: 0.024, ao: 0.62 },
    { y: 0.82, count: 4, len: 0.084, wid: 0.086, pitch: 0.32, droop: 0.015, ao: 0.70 },
    { y: 0.89, count: 3, len: 0.062, wid: 0.066, pitch: 0.52, droop: 0.008, ao: 0.76 },
  ];

  let idx = 0;
  for (let wi = 0; wi < whorls.length; wi++) {
    const w = whorls[wi];
    for (let k = 0; k < w.count; k++) {
      const yaw = (k / w.count) * Math.PI * 2.0 + wi * golden * 0.7 + Math.sin(idx * 3.1) * 0.22;
      const yOff = Math.cos(idx * 2.3) * 0.018;
      const lenVar = 0.86 + 0.28 * (0.5 + 0.5 * Math.sin(idx * 4.7));
      const roll = ((k + wi) % 2 === 0 ? 1 : -1) * (0.28 + (idx % 3) * 0.12);
      parts.push(buildCurvedBotanicalCard({
        origin: [Math.sin(yaw) * 0.014, w.y + yOff, Math.cos(yaw) * 0.014],
        yaw,
        pitch: w.pitch + Math.sin(idx * 1.7) * 0.09,
        roll,
        width: w.wid * lenVar,
        length: w.len * lenVar,
        droop: w.droop,
        cup: 0.022,
        uvRect: UV_SUGI,
        crownCenter,
        aoInner: w.ao,
        aoOuter: Math.min(1.14, w.ao + 0.62),
        flutterBase: 0.08,
        flutterTip: 1.0,
      }));
      if (wi <= 4 && k % 2 === 0) {
        parts.push(buildCurvedBotanicalCard({
          origin: [Math.sin(yaw + 0.18) * 0.02, w.y + yOff + 0.015, Math.cos(yaw + 0.18) * 0.02],
          yaw: yaw + 0.18,
          pitch: w.pitch + 0.14,
          roll: roll + 1.12,
          width: w.wid * 0.76 * lenVar,
          length: w.len * 0.84 * lenVar,
          droop: w.droop * 0.75,
          cup: 0.014,
          uvRect: UV_SUGI,
          crownCenter,
          aoInner: w.ao * 0.88,
          aoOuter: Math.min(1.10, w.ao + 0.56),
          flutterBase: 0.08,
          flutterTip: 0.95,
        }));
      }
      idx++;
    }
  }

  // 3 Sharply Tapered Vertical Feathery Cedar Spire Leader Cards (authentic pointed Sugi crown!)
  for (let a = 0; a < 3; a++) {
    const yaw = (a / 3) * Math.PI + 0.25;
    parts.push(buildCurvedBotanicalCard({
      origin: [0, 0.86, 0],
      yaw,
      pitch: Math.PI * 0.5 - 0.03,
      roll: 0,
      width: 0.082,
      length: 0.175,
      droop: 0.0,
      cup: 0.010,
      uvRect: UV_SUGI,
      crownCenter,
      aoInner: 0.68,
      aoOuter: 1.15,
      flutterBase: 0.25,
      flutterTip: 1.0,
      tipTaper: 0.22,
    }));
  }

  return mergeGeometriesFull(parts);
}

// ---- 2. SUBALPINE ABIES / HINOKI CYPRESS (シラビソ・檜) ----

function buildAbiesTrunkGeo() {
  const parts = [];
  const main = new THREE.CylinderGeometry(0.005, 0.028, 0.88, 7, 3);
  main.translate(0, 0.44, 0);
  parts.push(main);
  const golden = 2.3999632;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const y0 = 0.24 + t * 0.48;
    const ang = i * golden + 0.6;
    const len = 0.12 - t * 0.055;
    parts.push(buildWoodLimb(0, y0, 0, Math.sin(ang) * len, y0 - len * 0.18, Math.cos(ang) * len, 0.008 * (1 - t * 0.4), 0.003, 5));
  }
  return mergeGeometriesFull(parts);
}

function buildAbiesFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.56, 0];
  const golden = 2.3999632;

  const whorls = [
    { y: 0.22, count: 6, len: 0.21, wid: 0.18, pitch: -0.18, droop: 0.048, ao: 0.26 },
    { y: 0.34, count: 5, len: 0.19, wid: 0.17, pitch: -0.12, droop: 0.042, ao: 0.34 },
    { y: 0.46, count: 5, len: 0.165, wid: 0.15, pitch: -0.05, droop: 0.036, ao: 0.44 },
    { y: 0.58, count: 5, len: 0.140, wid: 0.130, pitch: 0.04, droop: 0.030, ao: 0.54 },
    { y: 0.69, count: 4, len: 0.112, wid: 0.108, pitch: 0.16, droop: 0.022, ao: 0.64 },
    { y: 0.79, count: 4, len: 0.084, wid: 0.084, pitch: 0.32, droop: 0.014, ao: 0.72 },
    { y: 0.88, count: 3, len: 0.058, wid: 0.062, pitch: 0.52, droop: 0.008, ao: 0.78 },
  ];

  let idx = 0;
  for (let wi = 0; wi < whorls.length; wi++) {
    const w = whorls[wi];
    for (let k = 0; k < w.count; k++) {
      const yaw = (k / w.count) * Math.PI * 2.0 + wi * golden;
      const roll = ((k + wi) % 2 === 0 ? 1 : -1) * 0.34;
      const lenVar = 0.88 + 0.24 * (0.5 + 0.5 * Math.cos(idx * 3.9));
      parts.push(buildCurvedBotanicalCard({
        origin: [Math.sin(yaw) * 0.012, w.y + Math.sin(idx * 2.1) * 0.016, Math.cos(yaw) * 0.012],
        yaw,
        pitch: w.pitch + Math.cos(idx * 1.9) * 0.08,
        roll,
        width: w.wid * lenVar,
        length: w.len * lenVar,
        droop: w.droop,
        cup: 0.018,
        uvRect: UV_ABIES,
        crownCenter,
        aoInner: w.ao,
        aoOuter: Math.min(1.14, w.ao + 0.58),
      }));
      if (wi <= 5 && k % 2 === 0) {
        parts.push(buildCurvedBotanicalCard({
          origin: [Math.sin(yaw + 0.22) * 0.015, w.y + 0.012, Math.cos(yaw + 0.22) * 0.015],
          yaw: yaw + 0.22,
          pitch: w.pitch + 0.18,
          roll: roll + 1.08,
          width: w.wid * 0.86 * lenVar,
          length: w.len * 0.90 * lenVar,
          droop: w.droop * 0.75,
          cup: 0.016,
          uvRect: UV_ABIES,
          crownCenter,
          aoInner: w.ao * 0.9,
          aoOuter: Math.min(1.12, w.ao + 0.56),
        }));
      }
      idx++;
    }
  }
  for (let a = 0; a < 3; a++) {
    parts.push(buildCurvedBotanicalCard({
      origin: [0, 0.86, 0],
      yaw: (a / 3) * Math.PI,
      pitch: Math.PI * 0.5 - 0.03,
      roll: 0,
      width: 0.072,
      length: 0.165,
      droop: 0.0,
      cup: 0.01,
      uvRect: UV_ABIES,
      crownCenter,
      aoInner: 0.70,
      aoOuter: 1.15,
      tipTaper: 0.20,
    }));
  }
  return mergeGeometriesFull(parts);
}

// ---- 3. MONTANE BUNA BEECH / MIZUNARA OAK (ブナ・ミズナラ) — True Multi-Forking Pale-Silver Skeleton + Lacy Leafy Canopy! ----

const BUNA_BRANCH_NODES = [
  { x:  0.00, y: 0.78, z:  0.00, spread: 0.24, count: 5, ao: 0.58 },
  { x: -0.17, y: 0.67, z:  0.08, spread: 0.21, count: 4, ao: 0.44 },
  { x:  0.18, y: 0.69, z:  0.10, spread: 0.22, count: 4, ao: 0.46 },
  { x:  0.03, y: 0.66, z: -0.18, spread: 0.21, count: 4, ao: 0.42 },
  { x: -0.12, y: 0.74, z: -0.13, spread: 0.19, count: 4, ao: 0.54 },
  { x:  0.13, y: 0.75, z: -0.09, spread: 0.19, count: 4, ao: 0.56 },
  { x: -0.06, y: 0.84, z:  0.06, spread: 0.18, count: 4, ao: 0.70 },
  { x:  0.08, y: 0.83, z:  0.01, spread: 0.17, count: 4, ao: 0.72 },
  { x: -0.22, y: 0.58, z: -0.04, spread: 0.17, count: 4, ao: 0.36 },
  { x:  0.22, y: 0.60, z: -0.02, spread: 0.17, count: 4, ao: 0.38 },
];

function buildBunaTrunkGeo() {
  const parts = [];
  parts.push(buildWoodLimb(0, 0, 0, 0.005, 0.16, -0.004, 0.052, 0.035, 8));
  parts.push(buildWoodLimb(0.005, 0.15, -0.004, 0.0, 0.46, 0.006, 0.035, 0.023, 8));

  const forks = [
    [0.0, 0.44, 0.006, -0.17, 0.67,  0.08, 0.019, 0.008],
    [0.0, 0.45, 0.006,  0.18, 0.69,  0.10, 0.019, 0.008],
    [0.0, 0.43, 0.006,  0.03, 0.66, -0.18, 0.018, 0.008],
    [0.0, 0.46, 0.006, -0.12, 0.74, -0.13, 0.015, 0.007],
    [0.0, 0.46, 0.006,  0.13, 0.75, -0.09, 0.015, 0.007],
    [0.0, 0.46, 0.006,  0.00, 0.78,  0.00, 0.017, 0.008],
    [-0.10, 0.58, 0.05, -0.22, 0.58, -0.04, 0.010, 0.004],
    [ 0.11, 0.59, 0.06,  0.22, 0.60, -0.02, 0.010, 0.004],
    [ 0.00, 0.68, 0.00, -0.06, 0.84,  0.06, 0.010, 0.004],
    [ 0.00, 0.69, 0.00,  0.08, 0.83,  0.01, 0.010, 0.004],
  ];
  for (let i = 0; i < forks.length; i++) {
    const f = forks[i];
    parts.push(buildWoodLimb(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 6));
  }
  return mergeGeometriesFull(parts);
}

function buildBunaFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.64, 0];
  let idx = 0;

  for (let ni = 0; ni < BUNA_BRANCH_NODES.length; ni++) {
    const nd = BUNA_BRANCH_NODES[ni];
    for (let k = 0; k < nd.count; k++) {
      const yaw = (k / nd.count) * Math.PI * 2.0 + ni * 1.17;
      const pitch = -0.12 + (k % 3) * 0.34 + Math.sin(idx * 2.3) * 0.16;
      const roll = ((k + ni) % 2 === 0 ? 1 : -1) * (0.38 + (k % 3) * 0.36);
      parts.push(buildCurvedBotanicalCard({
        origin: [
          nd.x - Math.sin(yaw) * 0.03,
          nd.y - 0.02 + Math.cos(idx * 1.7) * 0.025,
          nd.z - Math.cos(yaw) * 0.03,
        ],
        yaw,
        pitch,
        roll,
        width: nd.spread * 1.12,
        length: nd.spread * 1.18,
        droop: 0.035,
        cup: 0.026,
        uvRect: UV_BUNA,
        crownCenter,
        aoInner: nd.ao,
        aoOuter: Math.min(1.16, nd.ao + 0.56),
        flutterBase: 0.15,
        flutterTip: 1.0,
      }));
      idx++;
    }
  }
  return mergeGeometriesFull(parts);
}

// ---- 4. MID-DISTANCE ALPHA-CUTOUT BOTANICAL STAR-CARD IMPOSTORS (Tapered Conifer Spires!) ----

function buildStarImpostorGeo(uvRect, width, height, yStart, topTaper = 0.26) {
  const parts = [];
  const [uMin, vMin, uMax, vMax] = uvRect;
  const crownCenter = [0, yStart + height * 0.45, 0];

  for (let p = 0; p < 3; p++) {
    const ang = (p / 3) * Math.PI;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const hwB = width * 0.5;
    const hwT = width * 0.5 * topTaper;
    const positions = [
      -hwB * cosA, yStart,          -hwB * sinA,
       hwB * cosA, yStart,           hwB * sinA,
      -hwT * cosA, yStart + height, -hwT * sinA,
       hwT * cosA, yStart + height,  hwT * sinA,
    ];
    const normals = [];
    for (let v = 0; v < 4; v++) {
      let nx = positions[v * 3] - crownCenter[0];
      let ny = (positions[v * 3 + 1] - crownCenter[1]) * 0.75 + 0.35;
      let nz = positions[v * 3 + 2] - crownCenter[2];
      const l = Math.hypot(nx, ny, nz) || 1.0;
      normals.push(nx / l, ny / l, nz / l);
    }
    const uvs = [uMin, vMin, uMax, vMin, uMin, vMax, uMax, vMax];
    const metas = [0.36, 0.0, 0.36, 0.0, 1.12, 0.3, 1.12, 0.3];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(metas, 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    parts.push(g);
  }
  return mergeGeometriesFull(parts);
}

// ---- 5. UNDERSTORY LACY JAPANESE WOOD-FERN, KUMAZASA DWARF BAMBOO, & WILD MOUNTAIN GRASS ----

function buildFernGeo() {
  const parts = [];
  const crownCenter = [0, 0.10, 0];
  for (let i = 0; i < 7; i++) {
    const yaw = (i / 7) * Math.PI * 2.0 + (i % 2) * 0.24;
    parts.push(buildCurvedBotanicalCard({
      origin: [0, 0.02, 0],
      yaw,
      pitch: 0.62 + (i % 3) * 0.14,
      roll: (i % 2 === 0 ? 1 : -1) * 0.08,
      width: 0.44,
      length: 1.02,
      droop: 0.42,
      cup: 0.055,
      uvRect: UV_FERN,
      crownCenter,
      aoInner: 0.40,
      aoOuter: 1.12,
      flutterBase: 0.05,
      flutterTip: 1.0,
      segV: 2,
    }));
  }
  return mergeGeometriesFull(parts);
}

function buildGroundClumpGeo(uvRect, cardW, cardH, splayPitch) {
  const parts = [];
  const [uMin, vMin, uMax, vMax] = uvRect;
  for (let p = 0; p < 3; p++) {
    const ang = (p / 3) * Math.PI + 0.18;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const hw = cardW * 0.5;
    const leanX = -sinA * cardH * splayPitch;
    const leanZ =  cosA * cardH * splayPitch;

    const positions = [
      -hw * cosA,         -0.04, -hw * sinA,
       hw * cosA,         -0.04,  hw * sinA,
      -hw * cosA + leanX, cardH, -hw * sinA + leanZ,
       hw * cosA + leanX, cardH,  hw * sinA + leanZ,
    ];
    // Upward-biased soft terrain normals so grass tufts blend seamlessly with forest floor lighting!
    const normals = [
      -sinA * 0.25, 0.96, cosA * 0.25,
      -sinA * 0.25, 0.96, cosA * 0.25,
      -sinA * 0.35, 0.93, cosA * 0.35,
      -sinA * 0.35, 0.93, cosA * 0.35,
    ];
    const uvs = [uMin, vMin, uMax, vMin, uMin, vMax, uMax, vMax];
    const metas = [0.38, 0.0, 0.38, 0.0, 1.14, 1.0, 1.14, 1.0];

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(metas, 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    parts.push(g);
  }
  return mergeGeometriesFull(parts);
}

function buildBoulderGeo() {
  const rock = new THREE.SphereGeometry(1.0, 14, 10);
  rock.scale(1.18, 0.64, 0.96);
  perturbGeometry(rock, 0.16, -2.0, 191);
  rock.translate(0, 0.28, 0);
  return rock;
}

function buildNurseLogGeo() {
  const log = new THREE.CylinderGeometry(0.20, 0.28, 4.2, 8, 3);
  log.rotateZ(Math.PI * 0.5);
  perturbGeometry(log, 0.032, -5.0, 211);
  log.translate(0, 0.16, 0);
  return log;
}

// ---- Photorealistic TR-BOTANICA Alpha-Cutout Foliage ShaderMaterial ----

function createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, opts) {
  const {
    swayAmp = 0.018,
    flutterAmp = 0.012,
    isMidImpostor = false,
    fadeStart = 0.0,
    fadeEnd = 0.0,
    baseTint = [1, 1, 1],
    sssStrength = 0.42,
    useKomorebi = false,
  } = opts;

  const vert = /* glsl */ `
    precision highp float;

    attribute vec2 aMeta; // x: baked crown AO, y: leaf flutter weight

    uniform float uTime;
    uniform float uSwayAmp;
    uniform float uFlutterAmp;
    uniform float uIsMidImpostor;
    uniform float uFadeStart;
    uniform float uFadeEnd;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vAo;
    varying float vCamDist;

    void main() {
      vec3 localPos = position;
      vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

      // 1. Primary Trunk/Bough Sway + Secondary High-Frequency Leaf-Tip Flutter!
      float phase = instOrigin.x * 0.13 + instOrigin.z * 0.17 + uTime * 1.48;
      if (uSwayAmp > 0.0001) {
        float hFactor = clamp(localPos.y, 0.0, 1.3);
        float gust = sin(phase) * 0.65 + sin(phase * 2.25 + 1.4) * 0.35;
        localPos.x += gust * uSwayAmp * hFactor * hFactor;
        localPos.z += cos(phase * 0.82) * uSwayAmp * 0.65 * hFactor * hFactor;
      }
      if (uFlutterAmp > 0.0001) {
        float flPhase = uTime * 3.8 + (localPos.x * 19.0 + localPos.z * 23.0) + instOrigin.x * 0.5;
        localPos.y += sin(flPhase) * uFlutterAmp * aMeta.y;
        localPos.x += cos(flPhase * 1.15) * uFlutterAmp * 0.7 * aMeta.y;
      }

      vec4 wp = modelMatrix * instanceMatrix * vec4(localPos, 1.0);
      float camDist = length(wp.xyz - cameraPosition);

      // Seamless LOD scaling for Mid-Distance Treeline Impostors & Near-Field Groundcover Carpet
      if (uIsMidImpostor > 0.5) {
        float fadeIn = smoothstep(155.0, 225.0, camDist);
        float fadeOut = 1.0 - smoothstep(1150.0, 1520.0, camDist);
        wp.xyz = mix(instOrigin, wp.xyz, fadeIn * fadeOut);
      } else if (uFadeEnd > 1.0) {
        float fadeOut = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
        wp.xyz = mix(instOrigin, wp.xyz, fadeOut);
      }

      vWorldPos = wp.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vUv = uv;
      vAo = aMeta.x;
      vCamDist = camDist;
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = vec3(1.0);
      #endif

      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const frag = /* glsl */ `
    precision highp float;

    uniform sampler2D uFoliageAtlas;
    uniform sampler2D uHorizonMap;
    uniform vec2 uWorldMin;
    uniform vec2 uWorldSize;
    uniform vec2 uAtlasSize;
    uniform vec3 uBaseTint;
    uniform float uIsMidImpostor;
    uniform float uFadeEnd;
    uniform float uSssStrength;
    uniform float uUseKomorebi;

    ${TERRENO_ATMO_UNIFORMS_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vAo;
    varying float vCamDist;

    ${TERRENO_ATMO_FUNCTIONS_GLSL}

    void main() {
      if (uIsMidImpostor > 0.5 && (vCamDist < 155.0 || vCamDist > 1520.0)) discard;
      if (uFadeEnd > 1.0 && vCamDist > uFadeEnd) discard;

      vec4 tex = texture2D(uFoliageAtlas, vUv);

      // Valve/UE5 Coverage-Preserving Alpha Cutout:
      // Sharp crisp needles & serrated leaves close up (0.44), lowered gently with distance (0.22)
      // so mipmaps NEVER thin distant tree crowns into skeletal sticks!
      float alphaCut = uIsMidImpostor > 0.5
        ? 0.24
        : mix(0.44, 0.23, smoothstep(14.0, 125.0, vCamDist));
      if (tex.a < alphaCut) discard;

      // Exact Linearization of procedural sRGB canvas botanical atlas (zero pastel double-gamma!)
      vec3 texLinear = pow(max(tex.rgb, vec3(0.0001)), vec3(2.2));
      vec3 albedo = texLinear * uBaseTint * vColor * vAo;

      // IMPORTANT SpeedTree Normal-Transfer Rule:
      // Keep the pre-transferred smooth spherical crown normal (do NOT invert on back-faces!)
      vec3 N = normalize(vWorldNormal);
      vec3 sunDir = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;
      float canopyDensity = horz.a;

      // Optional Komorebi forest-floor dappled sunlight on grass, Kumazasa bamboo, & ferns!
      float komorebi = uUseKomorebi > 0.5
        ? evalKomorebiDapple(vWorldPos, canopyDensity, sunDir, vCamDist)
        : 1.0;

      // Soft botanical wrap-diffuse shading across leafy volume
      float ndl = max(0.0, (dot(N, sunDir) + 0.36) / 1.36);
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * komorebi * 0.92);

      // Physically-based Backlit Subsurface Leaf Translucency (sun shining right through thin leaves!)
      float backScatter = pow(clamp(dot(-V, sunDir), 0.0, 1.0), 2.8) * (0.35 + 0.65 * clamp(vAo, 0.2, 1.2));
      float thinRim = pow(1.0 - abs(dot(N, V)), 2.0) * max(0.0, dot(sunDir, vec3(0.0, 1.0, 0.0)) + 0.35) * 0.22;
      vec3 sssTint = vec3(0.62, 0.95, 0.26);
      direct += uSunColor * sssTint * ((backScatter + thinRim) * uSunIntensity * horizonShadow * komorebi * uSssStrength);

      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.42 + 0.58 * skyViewAO) * 0.96);

      float dComp = length(vWorldPos.xz - vec2(1.5, 3.5));
      float compWarm = exp(-dComp * 0.065) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.20;

      vec3 lit = albedo * (direct + ambient + vec3(1.0, 0.74, 0.44) * compWarm);

      // Subtle waxy leaf cuticle specular highlight catching morning/midday mountain sun
      vec3 H = normalize(sunDir + V);
      float leafSpec = pow(max(0.0, dot(N, H)), 28.0) * 0.065 * horizonShadow * komorebi * (1.0 - uIsMidImpostor);
      lit += uSunColor * (leafSpec * uSunIntensity * 0.55);

      lit += evalTerrenoFlashlight(vWorldPos, N, albedo);

      // Fast 1-Tap Horizon-Shadowed Volumetric Sea-of-Clouds + Rayleigh/Mie Aerial Perspective!
      vec3 finalCol = applyTerrenoAtmosphereFast(lit, vWorldPos, cameraPosition);

      gl_FragColor = vec4(finalCol, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmoUniforms,
      uFoliageAtlas: { value: foliageAtlas },
      uHorizonMap: { value: geomorph.horizonTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
      uBaseTint: { value: new THREE.Color(baseTint[0], baseTint[1], baseTint[2]) },
      uSwayAmp: { value: swayAmp },
      uFlutterAmp: { value: flutterAmp },
      uIsMidImpostor: { value: isMidImpostor ? 1.0 : 0.0 },
      uFadeStart: { value: fadeStart },
      uFadeEnd: { value: fadeEnd },
      uSssStrength: { value: sssStrength },
      uUseKomorebi: { value: useKomorebi ? 1.0 : 0.0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
  });
}

// ---- Photorealistic Fluted Bark, Mossy Boulder, & Nurse Log ShaderMaterial ----

function createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, opts) {
  const {
    isRock = false,
    swayAmp = 0.0,
    baseColor = [1, 1, 1],
  } = opts;

  const vert = /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform float uSwayAmp;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;

    void main() {
      vec3 localPos = position;
      vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

      if (uSwayAmp > 0.0001) {
        float hFactor = clamp(localPos.y, 0.0, 1.2);
        float phase = instOrigin.x * 0.13 + instOrigin.z * 0.17 + uTime * 1.48;
        float gust = sin(phase) * 0.65 + sin(phase * 2.25 + 1.4) * 0.35;
        localPos.x += gust * uSwayAmp * hFactor * hFactor;
        localPos.z += cos(phase * 0.82) * uSwayAmp * 0.65 * hFactor * hFactor;
      }

      vec4 wp = modelMatrix * instanceMatrix * vec4(localPos, 1.0);
      vWorldPos = wp.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = vec3(1.0);
      #endif
      vLocalY = localPos.y;
      vCamDist = length(wp.xyz - cameraPosition);

      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const frag = /* glsl */ `
    precision highp float;

    uniform sampler2D uBarkTex;
    uniform sampler2D uHorizonMap;
    uniform vec2 uWorldMin;
    uniform vec2 uWorldSize;
    uniform vec2 uAtlasSize;
    uniform vec3 uBaseTint;
    uniform float uIsRock;

    ${TERRENO_ATMO_UNIFORMS_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;

    float eHash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float eNoise3(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(eHash(i + vec3(0,0,0)), eHash(i + vec3(1,0,0)), f.x),
            mix(eHash(i + vec3(0,1,0)), eHash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(eHash(i + vec3(0,0,1)), eHash(i + vec3(1,0,1)), f.x),
            mix(eHash(i + vec3(0,1,1)), eHash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    ${TERRENO_ATMO_FUNCTIONS_GLSL}

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 sunDir = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;
      float canopyDensity = horz.a;

      vec3 albedo = uBaseTint * vColor;
      float detailFade = 1.0 - smoothstep(35.0, 180.0, vCamDist);

      float mossMaskRock = 0.0;
      if (uIsRock > 0.5) {
        // Fine crystalline granite grain + dark mineral fissures + velvety matte Yakushima moss cap!
        float r1 = eNoise3(vWorldPos * 2.4);
        float r2 = eNoise3(vWorldPos * 8.5);
        float r3 = eNoise3(vWorldPos * 22.0);
        float crack = smoothstep(0.28, 0.65, abs(r1 - 0.5) * 2.0);
        float rockShade = (0.48 + 0.42 * r2 + 0.22 * r3) * (0.58 + 0.42 * crack);
        float mossTop = smoothstep(0.36, 0.76, N.y + (r1 - 0.5) * 0.28);
        mossMaskRock = mossTop;
        vec3 mossCol = vec3(0.015, 0.044, 0.014) * (0.64 + 0.48 * r2 + 0.24 * r3);
        albedo = mix(albedo * rockShade, mossCol, mossTop * 0.82);
        if (detailFade > 0.01) {
          vec3 rg = vec3(
            eNoise3(vWorldPos * 6.5 + vec3(0.14, 0.0, 0.0)) - r2,
            0.0,
            eNoise3(vWorldPos * 6.5 + vec3(0.0, 0.0, 0.14)) - r2
          );
          N = normalize(N + rg * (0.95 * detailFade));
        }
      } else {
        // 512×512 Fluted Cedar / Silver Beech Bark Texture + Relief Normal Perturbation + Root Moss!
        vec2 barkUv = vec2(vUv.x * 2.5, vLocalY * 7.5);
        vec4 bTex = texture2D(uBarkTex, barkUv);
        vec3 bLin = pow(max(bTex.rgb, vec3(0.0001)), vec3(2.2));
        float barkAO = mix(0.45, 1.06, clamp(vLocalY * 1.5, 0.0, 1.0));
        albedo = albedo * (0.35 + 1.45 * bLin) * barkAO;

        if (detailFade > 0.01) {
          float bR = texture2D(uBarkTex, barkUv + vec2(0.015, 0.0)).a - bTex.a;
          float bU = texture2D(uBarkTex, barkUv + vec2(0.0, 0.015)).a - bTex.a;
          vec3 T = normalize(vec3(-N.z, 0.0, N.x + 0.0001));
          N = normalize(N + (T * (-bR) + vec3(0.0, -bU, 0.0)) * (1.85 * detailFade));
        }

        // Damp emerald moss creeping up lower 24% of ancient trunks (stronger on cool North side!)
        float northFactor = 0.65 + 0.35 * clamp(-N.z, 0.0, 1.0);
        float trunkMoss = (1.0 - smoothstep(0.02, 0.24, vLocalY)) * smoothstep(0.32, 0.68, bTex.a * northFactor);
        albedo = mix(albedo, vec3(0.015, 0.044, 0.015), trunkMoss * 0.78);
      }

      float komorebi = evalKomorebiDapple(vWorldPos, canopyDensity, sunDir, vCamDist);
      float ndl = max(0.0, (dot(N, sunDir) + 0.06) / 1.06);
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * komorebi * 0.90);

      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.42 + 0.58 * skyViewAO) * 0.95);

      float dComp = length(vWorldPos.xz - vec2(1.5, 3.5));
      float compWarm = exp(-dComp * 0.065) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.20;

      vec3 lit = albedo * (direct + ambient + vec3(1.0, 0.74, 0.44) * compWarm);

      if (uIsRock > 0.5) {
        vec3 H = normalize(sunDir + V);
        // Velvety moss stays authentically matte; exposed mineral granite catches subtle natural glint!
        float spec = pow(max(0.0, dot(N, H)), 42.0) * 0.14 * (1.0 - mossMaskRock * 0.92) * horizonShadow * komorebi;
        lit += uSunColor * (spec * uSunIntensity * 0.44);
      }

      lit += evalTerrenoFlashlight(vWorldPos, N, albedo);
      vec3 finalCol = applyTerrenoAtmosphereFast(lit, vWorldPos, cameraPosition);

      gl_FragColor = vec4(finalCol, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmoUniforms,
      uBarkTex: { value: barkTex },
      uHorizonMap: { value: geomorph.horizonTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
      uBaseTint: { value: new THREE.Color(baseColor[0], baseColor[1], baseColor[2]) },
      uSwayAmp: { value: swayAmp },
      uIsRock: { value: isRock ? 1.0 : 0.0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.FrontSide,
  });
}

function isInsideCompoundClearing(x, z, extraMargin = 0.0) {
  if (x > -12.5 - extraMargin && x < 14.5 + extraMargin && z > -15.5 - extraMargin && z < 15.5 + extraMargin) {
    return true;
  }
  if (x > -6.0 - extraMargin && x < 8.0 + extraMargin && z > -28.0 - extraMargin && z <= -14.0) {
    return true;
  }
  return false;
}

// Keep ONLY actual building footprints, vehicle pads, & stone walkways clear — let soft grass frame boulders & yard edges!
function isInsideCompoundPaving(x, z) {
  // Main Tower + Annex + Storage + Camper-75 footprints
  if (x > -9.6 && x < 11.4 && z > -5.5 && z < 12.2) return true;
  // Front entry walkway + Kei-340 concrete pad + approach path
  if (x > -4.6 && x < 5.6 && z > -12.8 && z <= -5.0) return true;
  return false;
}

export function createTerrenoForest(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_EcologicalForest_Streamer';

  const foliageAtlas = getBotanicalFoliageAtlas();
  const barkTex = getBotanicalBarkTexture();

  const CAP_SUGI = 2100;
  const CAP_ABIES = 1500;
  const CAP_BUNA = 1400;
  const CAP_FERN = 1500;
  const CAP_GRASS = 3200;
  const CAP_SASA = 1200;
  const CAP_BOULDER = 620;
  const CAP_LOG = 200;
  const CAP_MID_CONIFER = 4200;
  const CAP_MID_BROAD = 2600;

  // Materials
  const matBarkSugi = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { baseColor: [0.095, 0.056, 0.036], swayAmp: 0.004 });
  const matBarkBuna = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { baseColor: [0.27, 0.26, 0.23], swayAmp: 0.004 });
  const matBoulder  = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { isRock: true, baseColor: [0.105, 0.112, 0.118] });
  const matLog      = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { isRock: true, baseColor: [0.068, 0.044, 0.028] });

  const matTreeFoliage = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.014,
    flutterAmp: 0.011,
    sssStrength: 0.36,
  });
  const matFern = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.065,
    flutterAmp: 0.028,
    fadeStart: 50.0,
    fadeEnd: 78.0,
    sssStrength: 0.50,
    useKomorebi: true,
  });
  const matGroundGrass = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.095,
    flutterAmp: 0.036,
    fadeStart: 30.0,
    fadeEnd: 46.0,
    sssStrength: 0.46,
    useKomorebi: true,
  });
  const matGroundSasa = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.072,
    flutterAmp: 0.028,
    fadeStart: 36.0,
    fadeEnd: 52.0,
    sssStrength: 0.44,
    useKomorebi: true,
  });
  const matMidImpostor = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.0,
    flutterAmp: 0.0,
    isMidImpostor: true,
    sssStrength: 0.22,
  });

  function makeInstanced(geo, mat, cap, name) {
    const im = new THREE.InstancedMesh(geo, mat, cap);
    im.count = 0;
    im.frustumCulled = false;
    im.name = name;
    const tmpCol = new THREE.Color(1, 1, 1);
    for (let i = 0; i < cap; i++) im.setColorAt(i, tmpCol);
    im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  }

  const imSugiTrunk = makeInstanced(buildSugiTrunkGeo(), matBarkSugi, CAP_SUGI, 'ECO_Sugi_Trunks');
  const imSugiLeaf  = makeInstanced(buildSugiFoliageGeo(), matTreeFoliage, CAP_SUGI, 'ECO_Sugi_Foliage');
  const imAbiesTrunk = makeInstanced(buildAbiesTrunkGeo(), matBarkSugi, CAP_ABIES, 'ECO_Abies_Trunks');
  const imAbiesLeaf  = makeInstanced(buildAbiesFoliageGeo(), matTreeFoliage, CAP_ABIES, 'ECO_Abies_Foliage');
  const imBunaTrunk = makeInstanced(buildBunaTrunkGeo(), matBarkBuna, CAP_BUNA, 'ECO_Buna_Trunks');
  const imBunaLeaf  = makeInstanced(buildBunaFoliageGeo(), matTreeFoliage, CAP_BUNA, 'ECO_Buna_Foliage');

  const imFern    = makeInstanced(buildFernGeo(), matFern, CAP_FERN, 'ECO_Wood_Ferns');
  const imGrass   = makeInstanced(buildGroundClumpGeo(UV_GRASS, 0.88, 0.56, 0.14), matGroundGrass, CAP_GRASS, 'ECO_Wild_Grass');
  const imSasa    = makeInstanced(buildGroundClumpGeo(UV_SASA, 1.18, 0.84, 0.16), matGroundSasa, CAP_SASA, 'ECO_Kumazasa_Bamboo');
  const imBoulder = makeInstanced(buildBoulderGeo(), matBoulder, CAP_BOULDER, 'ECO_Mossy_Boulders');
  const imLog     = makeInstanced(buildNurseLogGeo(), matLog, CAP_LOG, 'ECO_Nurse_Logs');

  const imMidConifer = makeInstanced(buildStarImpostorGeo(UV_SUGI, 0.44, 0.94, 0.08, 0.18), matMidImpostor, CAP_MID_CONIFER, 'ECO_Mid_Conifers');
  const imMidBroad   = makeInstanced(buildStarImpostorGeo(UV_BUNA, 0.54, 0.72, 0.24, 0.84), matMidImpostor, CAP_MID_BROAD, 'ECO_Mid_Broadleaf');

  const dummyObj = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  let lastNearTx = 999999, lastNearTz = 999999;
  let lastGroundTx = 999999, lastGroundTz = 999999;
  let lastMidTx = 999999, lastMidTz = 999999;
  let localColliders = [];
  let stats = { sugi: 0, abies: 0, buna: 0, ferns: 0, grass: 0, sasa: 0, boulders: 0, logs: 0, midConifers: 0, midBroad: 0 };

  function rebuildNearForest(centerTx, centerTz) {
    let nSugi = 0, nAbies = 0, nBuna = 0, nFern = 0, nBoulder = 0, nLog = 0;
    const newColliders = [];

    for (let dtz = -NEAR_TILE_RADIUS; dtz <= NEAR_TILE_RADIUS; dtz++) {
      for (let dtx = -NEAR_TILE_RADIUS; dtx <= NEAR_TILE_RADIUS; dtx++) {
        const tx = centerTx + dtx;
        const tz = centerTz + dtz;
        const tileX0 = tx * NEAR_TILE_SIZE;
        const tileZ0 = tz * NEAR_TILE_SIZE;

        if (
          tileX0 + NEAR_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
          tileZ0 + NEAR_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
        ) continue;

        const isDetailTile = Math.abs(dtx) <= DETAIL_TILE_RADIUS && Math.abs(dtz) <= DETAIL_TILE_RADIUS;
        const rng = makeTileRng(tx, tz, 9011);

        // --- 1. Trees (46 stems per 64m×64m tile) ---
        for (let c = 0; c < 46; c++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 12 || wx > TERRENO_WORLD.maxX - 12 || wz < TERRENO_WORLD.minZ + 12 || wz > TERRENO_WORLD.maxZ - 12) continue;

          if (isInsideCompoundClearing(wx, wz, 1.0)) continue;

          // Keep widened 19km Forestry Road 100% unobstructed for CAMPER-75 & KEI-340!
          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < 8.2) continue;

          // Keep wide 19km River Channel + 1.38x ribbon skirt completely clear of tree trunks!
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.45 + 6.5) continue;

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          const y = geomorph.getHeightAt(wx, wz);
          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1420.0) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 2.2);
          if (nrm.slope > 0.78) continue;

          if (asl > 1270.0 && rng() < (asl - 1270.0) / 155.0) continue;

          const in6fVistaCorridor = wx > -9.0 && wx < 13.0 && wz >= 10.0 && wz < 46.0;
          if (in6fVistaCorridor && rng() < 0.45) continue;

          const spRoll = rng();
          let species = 0;
          if (asl < 780.0) {
            species = spRoll < 0.72 ? 0 : (spRoll < 0.92 ? 1 : 2);
          } else if (asl < 1140.0) {
            const bunaProb = 0.56 - geo.wetness * 0.25;
            if (spRoll < bunaProb) species = 2;
            else if (spRoll < bunaProb + 0.26) species = 0;
            else species = 1;
          } else {
            species = spRoll < 0.82 ? 1 : 2;
          }

          const yaw = rng() * Math.PI * 2.0;
          const leanX = (rng() - 0.5) * 0.055;
          const leanZ = (rng() - 0.5) * 0.055;
          let altScale = asl > 1220.0 ? Math.max(0.45, 1.0 - (asl - 1220.0) / 340.0) : 1.0;
          if (in6fVistaCorridor) altScale *= 0.42;

          if (species === 0 && nSugi < CAP_SUGI) {
            const h = (18.5 + rng() * 16.5) * altScale;
            const rS = h * (0.94 + rng() * 0.24);
            dummyObj.position.set(wx, y - 0.48, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imSugiTrunk.setMatrixAt(nSugi, dummyObj.matrix);
            imSugiLeaf.setMatrixAt(nSugi, dummyObj.matrix);
            const gVar = rng();
            // Deep authentic Yakushima ancient Japanese Cedar evergreen linear reflectance!
            tmpColor.setRGB(0.095 + gVar * 0.068, 0.105 + gVar * 0.065, 0.118 + gVar * 0.068);
            imSugiLeaf.setColorAt(nSugi, tmpColor);
            tmpColor.setRGB(0.84 + gVar * 0.26, 0.80 + gVar * 0.22, 0.76 + gVar * 0.20);
            imSugiTrunk.setColorAt(nSugi, tmpColor);
            nSugi++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.42, h * 0.028) });
          } else if (species === 1 && nAbies < CAP_ABIES) {
            const h = (13.5 + rng() * 13.0) * altScale;
            const rS = h * (0.90 + rng() * 0.24);
            dummyObj.position.set(wx, y - 0.42, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imAbiesTrunk.setMatrixAt(nAbies, dummyObj.matrix);
            imAbiesLeaf.setMatrixAt(nAbies, dummyObj.matrix);
            const gVar = rng();
            tmpColor.setRGB(0.090 + gVar * 0.060, 0.112 + gVar * 0.068, 0.142 + gVar * 0.075);
            imAbiesLeaf.setColorAt(nAbies, tmpColor);
            tmpColor.setRGB(0.82 + gVar * 0.25, 0.82 + gVar * 0.20, 0.80 + gVar * 0.20);
            imAbiesTrunk.setColorAt(nAbies, tmpColor);
            nAbies++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.38, h * 0.026) });
          } else if (species === 2 && nBuna < CAP_BUNA) {
            const h = (14.0 + rng() * 11.5) * altScale;
            const rS = h * (0.98 + rng() * 0.30);
            dummyObj.position.set(wx, y - 0.42, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imBunaTrunk.setMatrixAt(nBuna, dummyObj.matrix);
            imBunaLeaf.setMatrixAt(nBuna, dummyObj.matrix);
            const tint = rng();
            if (tint < 0.66) {
              tmpColor.setRGB(0.13 + tint * 0.12, 0.16 + tint * 0.11, 0.14 + tint * 0.09);
            } else if (tint < 0.89) {
              tmpColor.setRGB(0.24 + (tint - 0.66) * 0.32, 0.22 + (tint - 0.66) * 0.16, 0.13);
            } else {
              tmpColor.setRGB(0.44, 0.20, 0.10);
            }
            imBunaLeaf.setColorAt(nBuna, tmpColor);
            tmpColor.setRGB(0.88 + tint * 0.18, 0.88 + tint * 0.18, 0.84 + tint * 0.16);
            imBunaTrunk.setColorAt(nBuna, tmpColor);
            nBuna++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.45, h * 0.032) });
          }
        }

        if (!isDetailTile) continue;

        // 2a. Lacy Pinnate Japanese Wood-Ferns (イノデ羊歯)
        for (let f = 0; f < 165 && nFern < CAP_FERN; f++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (isInsideCompoundPaving(wx, wz)) continue;
          if (geomorph.roadIndex.queryDist(wx, wz).dist < 4.6) continue;
          const rv = evalMainRiver(wz);
          const y = geomorph.getHeightAt(wx, wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.16 || y < rv.waterY + 0.35) continue;

          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1410.0) continue;
          const nrm = geomorph.getNormalAt(wx, wz, 1.5);
          if (nrm.slope > 0.66) continue;

          const sc = 0.72 + rng() * 1.05;
          dummyObj.position.set(wx, y - 0.04, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
          dummyObj.scale.set(sc, sc * (0.78 + rng() * 0.38), sc);
          dummyObj.updateMatrix();
          imFern.setMatrixAt(nFern, dummyObj.matrix);
          const fv = rng();
          tmpColor.setRGB(0.14 + fv * 0.12, 0.17 + fv * 0.12, 0.13 + fv * 0.08);
          imFern.setColorAt(nFern, tmpColor);
          nFern++;
        }

        // 2b. Deeply Embedded Mossy Granite Boulders (STRICT slope < 0.52 -> ZERO floating rocks!)
        for (let b = 0; b < 42 && nBoulder < CAP_BOULDER; b++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, 1.5)) continue;
          if (geomorph.roadIndex.queryDist(wx, wz).dist < 7.8) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 2.2);
          if (nrm.slope > 0.52) continue;

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          const rv = evalMainRiver(wz);
          const distRiv = Math.abs(wx - rv.x);
          const nearRiver = distRiv > rv.halfWidth * 0.85 && distRiv < rv.halfWidth * 1.55 + 16.0;
          if (!nearRiver && geo.wetness < 0.36 && rng() > 0.24) continue;

          const y = geomorph.getHeightAt(wx, wz);
          const rScale = nearRiver ? (1.05 + rng() * 2.15) : (0.70 + rng() * 1.45);
          dummyObj.position.set(wx, y - rScale * 0.46, wz);
          dummyObj.rotation.set((rng() - 0.5) * 0.28, rng() * Math.PI * 2, (rng() - 0.5) * 0.28);
          dummyObj.scale.set(rScale, rScale * (0.62 + rng() * 0.42), rScale * (0.82 + rng() * 0.38));
          dummyObj.updateMatrix();
          imBoulder.setMatrixAt(nBoulder, dummyObj.matrix);
          const bv = 0.78 + rng() * 0.36;
          tmpColor.setRGB(bv, bv * 1.02, bv * 1.05);
          imBoulder.setColorAt(nBoulder, tmpColor);
          nBoulder++;
          if (rScale > 0.90) newColliders.push({ x: wx, z: wz, r: rScale * 0.85 });
        }

        // 2c. Fallen Mossy Nurse Logs (gentle forest floor only)
        for (let l = 0; l < 6 && nLog < CAP_LOG; l++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, 3.0)) continue;
          if (geomorph.roadIndex.queryDist(wx, wz).dist < 8.0) continue;
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.42 + 6.0) continue;
          const y = geomorph.getHeightAt(wx, wz);
          if (TERRENO_WORLD.baseElevationASL + y > 1280.0) continue;
          const nrm = geomorph.getNormalAt(wx, wz, 2.0);
          if (nrm.slope > 0.34) continue;

          const sc = 0.75 + rng() * 0.90;
          dummyObj.position.set(wx, y - 0.04, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.10);
          dummyObj.scale.set(sc, sc, sc);
          dummyObj.updateMatrix();
          imLog.setMatrixAt(nLog, dummyObj.matrix);
          const lv = 0.78 + rng() * 0.32;
          tmpColor.setRGB(lv, lv * 0.96, lv * 0.90);
          imLog.setColorAt(nLog, tmpColor);
          nLog++;
        }
      }
    }

    imSugiTrunk.count = nSugi;
    imSugiLeaf.count = nSugi;
    imAbiesTrunk.count = nAbies;
    imAbiesLeaf.count = nAbies;
    imBunaTrunk.count = nBuna;
    imBunaLeaf.count = nBuna;
    imFern.count = nFern;
    imBoulder.count = nBoulder;
    imLog.count = nLog;

    [imSugiTrunk, imSugiLeaf, imAbiesTrunk, imAbiesLeaf, imBunaTrunk, imBunaLeaf, imFern, imBoulder, imLog].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });

    localColliders = newColliders;
    stats.sugi = nSugi;
    stats.abies = nAbies;
    stats.buna = nBuna;
    stats.ferns = nFern;
    stats.boulders = nBoulder;
    stats.logs = nLog;
  }

  // ---- BREAKTHROUGH TR-GROUNDCOVER: Ultra-Dense Near-Field Grass, Sedge & Kumazasa Carpet (32m micro-tiles!) ----
  function rebuildGroundCover(centerGx, centerGz) {
    let nGrass = 0, nSasa = 0;

    for (let dgz = -GROUND_TILE_RADIUS; dgz <= GROUND_TILE_RADIUS; dgz++) {
      for (let dgx = -GROUND_TILE_RADIUS; dgx <= GROUND_TILE_RADIUS; dgx++) {
        const gx = centerGx + dgx;
        const gz = centerGz + dgz;
        const tileX0 = gx * GROUND_TILE_SIZE;
        const tileZ0 = gz * GROUND_TILE_SIZE;

        if (
          tileX0 + GROUND_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
          tileZ0 + GROUND_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
        ) continue;

        const rng = makeTileRng(gx, gz, 55109);

        // 1. Wild Mountain Sedge & Forest Grass Tufts (350 attempts per 32m×32m micro-tile!)
        for (let i = 0; i < 350 && nGrass < CAP_GRASS; i++) {
          const wx = tileX0 + rng() * GROUND_TILE_SIZE;
          const wz = tileZ0 + rng() * GROUND_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 6 || wx > TERRENO_WORLD.maxX - 6 || wz < TERRENO_WORLD.minZ + 6 || wz > TERRENO_WORLD.maxZ - 6) continue;
          if (isInsideCompoundPaving(wx, wz)) continue;

          // Allow lush grass right up to the Forestry Road verge (dist > 4.2m)!
          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < 4.2) continue;

          const rv = evalMainRiver(wz);
          const y = geomorph.getHeightAt(wx, wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.12 || y < rv.waterY + 0.18) continue;

          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1495.0) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 1.2);
          if (nrm.slope > 0.62) continue;

          const inOuterYard = isInsideCompoundClearing(wx, wz, 2.0);
          const scXZ = inOuterYard ? (0.48 + rng() * 0.45) : (0.78 + rng() * 1.05);
          const scY  = inOuterYard ? (0.36 + rng() * 0.36) : (0.72 + rng() * 0.95);

          dummyObj.position.set(wx, y - 0.04, wz);
          dummyObj.rotation.set(nrm.z * 0.38, rng() * Math.PI * 2.0, -nrm.x * 0.38);
          dummyObj.scale.set(scXZ, scY, scXZ);
          dummyObj.updateMatrix();
          imGrass.setMatrixAt(nGrass, dummyObj.matrix);

          const v = rng();
          if (asl > 1180.0) {
            tmpColor.setRGB(0.24 + v * 0.16, 0.22 + v * 0.14, 0.13 + v * 0.08);
          } else {
            tmpColor.setRGB(0.14 + v * 0.13, 0.17 + v * 0.13, 0.12 + v * 0.08);
          }
          imGrass.setColorAt(nGrass, tmpColor);
          nGrass++;
        }

        // 2. Kumazasa Dwarf Bamboo Thickets (クマザサ)
        for (let i = 0; i < 130 && nSasa < CAP_SASA; i++) {
          const wx = tileX0 + rng() * GROUND_TILE_SIZE;
          const wz = tileZ0 + rng() * GROUND_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, -0.5)) continue;

          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < 4.7) continue;

          const rv = evalMainRiver(wz);
          const y = geomorph.getHeightAt(wx, wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.18 || y < rv.waterY + 0.35) continue;

          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1385.0) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 1.4);
          if (nrm.slope > 0.58) continue;

          const cluster = Math.sin(wx * 0.11 + wz * 0.09) * Math.cos(wx * 0.07 - wz * 0.13);
          if (cluster < -0.15 && asl < 1020.0) continue;

          const sc = 0.72 + rng() * 0.92;
          dummyObj.position.set(wx, y - 0.05, wz);
          dummyObj.rotation.set(nrm.z * 0.32, rng() * Math.PI * 2.0, -nrm.x * 0.32);
          dummyObj.scale.set(sc, sc * (0.78 + rng() * 0.42), sc);
          dummyObj.updateMatrix();
          imSasa.setMatrixAt(nSasa, dummyObj.matrix);

          const v = rng();
          tmpColor.setRGB(0.20 + v * 0.16, 0.22 + v * 0.15, 0.16 + v * 0.10);
          imSasa.setColorAt(nSasa, tmpColor);
          nSasa++;
        }
      }
    }

    imGrass.count = nGrass;
    imSasa.count = nSasa;
    imGrass.instanceMatrix.needsUpdate = true;
    imGrass.instanceColor.needsUpdate = true;
    imSasa.instanceMatrix.needsUpdate = true;
    imSasa.instanceColor.needsUpdate = true;
    stats.grass = nGrass;
    stats.sasa = nSasa;
  }

  function rebuildMidImpostors(centerTx, centerTz) {
    let nCon = 0, nBrd = 0;

    for (let dtz = -MID_TILE_RADIUS; dtz <= MID_TILE_RADIUS; dtz++) {
      for (let dtx = -MID_TILE_RADIUS; dtx <= MID_TILE_RADIUS; dtx++) {
        const r2 = dtx * dtx + dtz * dtz;
        if (r2 < 1 || r2 > MID_TILE_RADIUS * MID_TILE_RADIUS + 4) continue;

        const tx = centerTx + dtx;
        const tz = centerTz + dtz;
        const tileX0 = tx * MID_TILE_SIZE;
        const tileZ0 = tz * MID_TILE_SIZE;

        if (
          tileX0 + MID_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
          tileZ0 + MID_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
        ) continue;

        const rng = makeTileRng(tx, tz, 4421);
        for (let k = 0; k < 22; k++) {
          const wx = tileX0 + rng() * MID_TILE_SIZE;
          const wz = tileZ0 + rng() * MID_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 10 || wx > TERRENO_WORLD.maxX - 10 || wz < TERRENO_WORLD.minZ + 10 || wz > TERRENO_WORLD.maxZ - 10) continue;
          if (isInsideCompoundClearing(wx, wz, 2.0)) continue;

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          if (geo.roadPad > 0.35) continue;
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.45 + 6.0) continue;

          // Use exact getHeightAt() & deep anchor (-2.6m) so ZERO impostors ever float above distant ridges!
          const y = geomorph.getHeightAt(wx, wz);
          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1410.0) continue;
          const nrm = geomorph.getNormalAt(wx, wz, 4.0);
          if (nrm.slope > 0.76) continue;

          const isBroad = asl > 770.0 && asl < 1210.0 && rng() < 0.55;
          const h = (21.0 + rng() * 17.0) * (asl > 1250.0 ? 0.70 : 1.0);
          const wS = h * (1.05 + rng() * 0.38);
          dummyObj.position.set(wx, y - 2.6, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
          dummyObj.scale.set(wS, h, wS);
          dummyObj.updateMatrix();

          const v = rng();
          if (isBroad && nBrd < CAP_MID_BROAD) {
            imMidBroad.setMatrixAt(nBrd, dummyObj.matrix);
            if (v < 0.78) tmpColor.setRGB(0.15 + v * 0.14, 0.18 + v * 0.13, 0.15 + v * 0.08);
            else tmpColor.setRGB(0.42, 0.20, 0.11);
            imMidBroad.setColorAt(nBrd, tmpColor);
            nBrd++;
          } else if (nCon < CAP_MID_CONIFER) {
            imMidConifer.setMatrixAt(nCon, dummyObj.matrix);
            tmpColor.setRGB(0.10 + v * 0.07, 0.11 + v * 0.07, 0.12 + v * 0.07);
            imMidConifer.setColorAt(nCon, tmpColor);
            nCon++;
          }
        }
      }
    }

    imMidConifer.count = nCon;
    imMidBroad.count = nBrd;
    imMidConifer.instanceMatrix.needsUpdate = true;
    imMidConifer.instanceColor.needsUpdate = true;
    imMidBroad.instanceMatrix.needsUpdate = true;
    imMidBroad.instanceColor.needsUpdate = true;

    stats.midConifers = nCon;
    stats.midBroad = nBrd;
  }

  function update(cameraPos) {
    const ntx = Math.floor(cameraPos.x / NEAR_TILE_SIZE);
    const ntz = Math.floor(cameraPos.z / NEAR_TILE_SIZE);
    if (ntx !== lastNearTx || ntz !== lastNearTz) {
      lastNearTx = ntx;
      lastNearTz = ntz;
      rebuildNearForest(ntx, ntz);
    }

    const gtx = Math.floor(cameraPos.x / GROUND_TILE_SIZE);
    const gtz = Math.floor(cameraPos.z / GROUND_TILE_SIZE);
    if (gtx !== lastGroundTx || gtz !== lastGroundTz) {
      lastGroundTx = gtx;
      lastGroundTz = gtz;
      rebuildGroundCover(gtx, gtz);
    }

    const mtx = Math.floor(cameraPos.x / MID_TILE_SIZE);
    const mtz = Math.floor(cameraPos.z / MID_TILE_SIZE);
    if (mtx !== lastMidTx || mtz !== lastMidTz) {
      lastMidTx = mtx;
      lastMidTz = mtz;
      rebuildMidImpostors(mtx, mtz);
    }
  }

  function getLocalColliders() {
    return localColliders;
  }

  function getStats() {
    return { ...stats };
  }

  return {
    group,
    update,
    getLocalColliders,
    getStats,
  };
}
