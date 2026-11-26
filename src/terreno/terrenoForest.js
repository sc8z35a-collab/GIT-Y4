import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver, evalRegionWeights } from './terrenoConfig.js';
import { isInsideSouthRect, evalClosestTributary } from './terrenoGeomorphology.js';
import { isInsideVillageClearing, isInsideVillagePaving } from '../villageData.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';
import {
  BOTANICAL_UV,
  getBotanicalFoliageAtlas,
  getBotanicalBarkTexture,
  getBirchBarkTexture,
  getPineBarkTexture,
} from './terrenoBotanicalAtlas.js';

/**
 * TERRENO Engine 3.0 — Living Multi-Species Japanese Mountain Forest & Understory Ecosystem
 *
 * Completely replaces the monotonous single-look conifer grid with an authentic 8-species
 * Japanese montane & riparian woodland:
 *   1. Ancient Sugi Cedar (黒杉・屋久杉) — tall fluted reddish cedar spire (18–34m)
 *   2. Kiso Hinoki Cypress (木曽檜) — graceful layered pagoda fans & warm cinnamon bark (14–26m)
 *   3. Grand Buna Beech / Giant Zelkova (ブナ・ケヤキ) — cathedral spreading silvery dome (14–25m)
 *   4. Japanese Mountain Maple (イロハモミジ) — sinuous multi-stem dark trunk, 7-lobed palmate
 *      leaves in fresh emerald, sunlit amber-gold, fiery vermilion, and deep scarlet crimson (7–15m)
 *   5. Highland White Paper Birch (白樺) — gleaming chalk-white lenticel bark, twin-stem airy
 *      shimmering lime-gold crowns (11–21m)
 *   6. Japanese Red Pine (アカマツ) — gnarled leaning terracotta tortoise-shell bark with
 *      sculptural asymmetric bonsai-like horizontal needle cloud pads (11–21m)
 *   7. Riparian Weeping Willow (川ヤナギ) — leaning streamside trunks with cascading pendulous
 *      curtains lining Kurosugi River and all 12 mountain tributary valleys (7–13m)
 *   8. Woodland Understory Shrubs & Mountain Azaleas (低木・山ツツジ) + Weathered Mossy Stumps
 *      + Wood-Ferns + Kumazasa Bamboo + Wild Mountain Grass & Susuki + Mossy Boulders + Nurse Logs
 *
 *   • Bare-earth placement via `geomorph.getTerrainHeightAt` and strict 3D bridge/ramp exclusion
 *     via `geomorph.queryBridgeAt` so NO tree, shrub, or boulder ever intersects a bridge!
 *   • Authentic alpine elevation zonation & treeline (conifer/mixed valley → montane beech/birch
 *     → subalpine krummholz → bare granite summits & snow couloirs above ~1,160m ASL).
 *   • 4-group mid-distance botanical impostors (160m..1,780m) preserving species color mosaics
 *     across surrounding valley ridges and mountain slopes!
 */

const NEAR_TILE_SIZE = 64.0;
const NEAR_TILE_RADIUS = 3;    // 7×7 tiles = ±224m full 3D 8-species forest
const DETAIL_TILE_RADIUS = 1;  // 3×3 tiles = ±96m boulders, logs, stumps, shrubs & ferns
const GROUND_TILE_SIZE = 32.0;
const GROUND_TILE_RADIUS = 1;  // 3×3 micro-tiles = ±48m ultra-dense grass & Kumazasa carpet
const MID_TILE_SIZE = 128.0;
const MID_TILE_RADIUS = 12;    // 25×25 tiles = ±1,600m ragged multi-species alpine treelines

const UV_SUGI   = BOTANICAL_UV.sugi;
const UV_HINOKI = BOTANICAL_UV.hinoki;
const UV_MAPLE  = BOTANICAL_UV.maple;
const UV_PINE   = BOTANICAL_UV.pine;
const UV_BUNA   = BOTANICAL_UV.buna;
const UV_BIRCH  = BOTANICAL_UV.birch;
const UV_WILLOW = BOTANICAL_UV.willow;
const UV_FERN   = BOTANICAL_UV.fern;
const UV_SASA   = BOTANICAL_UV.sasa;
const UV_SHRUB  = BOTANICAL_UV.shrub;
const UV_GRASS  = BOTANICAL_UV.grass;

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
 * Curved, Drooping, V-Cupped Botanical Foliage Branch Card with
 * SpeedTree-Grade Spherical Crown Normal Transfer & Baked Crown AO.
 */
function buildCurvedBotanicalCard(opts) {
  const {
    origin,
    yaw,
    pitch,
    roll = 0,
    width,
    length,
    droop = 0.03,
    cup = 0.015,
    uvRect,
    crownCenter,
    aoInner = 0.42,
    aoOuter = 1.12,
    flutterBase = 0.0,
    flutterTip = 1.0,
    segV = 1,
    tipTaper = 1.0,
    flipV = false,
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

      const vt = flipV ? (1.0 - t) : t;
      uvs.push(uMin + (uMax - uMin) * s, vMin + (vMax - vMin) * vt);
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

// ============================================================================
// SPECIES 1: ANCIENT JAPANESE SUGI CEDAR (黒杉・屋久杉) — Tall Spire
// ============================================================================
function buildSugiTrunkGeo() {
  const parts = [];
  const main = new THREE.CylinderGeometry(0.005, 0.032, 0.90, 8, 4);
  main.translate(0, 0.45, 0);
  parts.push(main);
  const root = new THREE.CylinderGeometry(0.030, 0.058, 0.14, 8, 1);
  root.translate(0, 0.05, 0);
  parts.push(root);
  const golden = 2.3999632;
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const y0 = 0.28 + t * 0.46;
    const ang = i * golden;
    const len = 0.14 - t * 0.068;
    parts.push(buildWoodLimb(0, y0, 0, Math.sin(ang) * len, y0 - len * 0.24, Math.cos(ang) * len, 0.009 * (1 - t * 0.4), 0.003, 5));
  }
  return mergeGeometriesFull(parts);
}

function buildSugiFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.56, 0];
  const golden = 2.3999632;
  const whorls = [
    { y: 0.25, count: 6, len: 0.235, wid: 0.20,  pitch: -0.24, droop: 0.064, ao: 0.24 },
    { y: 0.35, count: 6, len: 0.215, wid: 0.19,  pitch: -0.18, droop: 0.056, ao: 0.30 },
    { y: 0.45, count: 6, len: 0.190, wid: 0.175, pitch: -0.12, droop: 0.048, ao: 0.38 },
    { y: 0.55, count: 5, len: 0.165, wid: 0.155, pitch: -0.05, droop: 0.040, ao: 0.46 },
    { y: 0.65, count: 5, len: 0.140, wid: 0.135, pitch:  0.04, droop: 0.032, ao: 0.54 },
    { y: 0.74, count: 4, len: 0.112, wid: 0.112, pitch:  0.16, droop: 0.024, ao: 0.62 },
    { y: 0.82, count: 4, len: 0.084, wid: 0.086, pitch:  0.32, droop: 0.015, ao: 0.70 },
    { y: 0.89, count: 3, len: 0.062, wid: 0.066, pitch:  0.52, droop: 0.008, ao: 0.76 },
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
        yaw, pitch: w.pitch + Math.sin(idx * 1.7) * 0.09, roll,
        width: w.wid * lenVar, length: w.len * lenVar, droop: w.droop, cup: 0.022,
        uvRect: UV_SUGI, crownCenter, aoInner: w.ao, aoOuter: Math.min(1.14, w.ao + 0.62),
        flutterBase: 0.08, flutterTip: 1.0,
      }));
      if (wi <= 4 && k % 2 === 0) {
        parts.push(buildCurvedBotanicalCard({
          origin: [Math.sin(yaw + 0.18) * 0.02, w.y + yOff + 0.015, Math.cos(yaw + 0.18) * 0.02],
          yaw: yaw + 0.18, pitch: w.pitch + 0.14, roll: roll + 1.12,
          width: w.wid * 0.76 * lenVar, length: w.len * 0.84 * lenVar, droop: w.droop * 0.75, cup: 0.014,
          uvRect: UV_SUGI, crownCenter, aoInner: w.ao * 0.88, aoOuter: Math.min(1.10, w.ao + 0.56),
          flutterBase: 0.08, flutterTip: 0.95,
        }));
      }
      idx++;
    }
  }
  for (let a = 0; a < 3; a++) {
    parts.push(buildCurvedBotanicalCard({
      origin: [0, 0.86, 0], yaw: (a / 3) * Math.PI + 0.25, pitch: Math.PI * 0.5 - 0.03,
      width: 0.082, length: 0.175, droop: 0.0, cup: 0.010,
      uvRect: UV_SUGI, crownCenter, aoInner: 0.68, aoOuter: 1.15,
      flutterBase: 0.25, flutterTip: 1.0, tipTaper: 0.22,
    }));
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 2: KISO HINOKI CYPRESS (木曽檜) — Layered Architectural Fan Tiers
// ============================================================================
function buildHinokiTrunkGeo() {
  const parts = [];
  const main = new THREE.CylinderGeometry(0.005, 0.027, 0.88, 7, 3);
  main.translate(0, 0.44, 0);
  parts.push(main);
  const root = new THREE.CylinderGeometry(0.026, 0.044, 0.12, 7, 1);
  root.translate(0, 0.05, 0);
  parts.push(root);
  const golden = 2.3999632;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y0 = 0.22 + t * 0.54;
    const ang = i * golden + 0.6;
    const len = 0.14 - t * 0.07;
    parts.push(buildWoodLimb(0, y0, 0, Math.sin(ang) * len, y0 + len * 0.04, Math.cos(ang) * len, 0.0075 * (1 - t * 0.4), 0.0025, 5));
  }
  return mergeGeometriesFull(parts);
}

function buildHinokiFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.56, 0];
  const golden = 2.3999632;
  // Distinct wide horizontal pagoda fan layers with upturned tips!
  const tiers = [
    { y: 0.22, count: 6, len: 0.25, wid: 0.22, pitch: -0.05, droop: 0.020, ao: 0.26 },
    { y: 0.35, count: 6, len: 0.22, wid: 0.20, pitch: -0.02, droop: 0.018, ao: 0.36 },
    { y: 0.48, count: 5, len: 0.19, wid: 0.17, pitch:  0.02, droop: 0.015, ao: 0.46 },
    { y: 0.60, count: 5, len: 0.155, wid: 0.145, pitch: 0.08, droop: 0.012, ao: 0.56 },
    { y: 0.72, count: 4, len: 0.12, wid: 0.115, pitch: 0.18, droop: 0.009, ao: 0.66 },
    { y: 0.82, count: 4, len: 0.085, wid: 0.085, pitch: 0.34, droop: 0.006, ao: 0.74 },
  ];
  let idx = 0;
  for (let ti = 0; ti < tiers.length; ti++) {
    const w = tiers[ti];
    for (let k = 0; k < w.count; k++) {
      const yaw = (k / w.count) * Math.PI * 2.0 + ti * golden;
      const roll = ((k + ti) % 2 === 0 ? 1 : -1) * 0.18;
      const lenVar = 0.88 + 0.24 * (0.5 + 0.5 * Math.cos(idx * 3.9));
      parts.push(buildCurvedBotanicalCard({
        origin: [Math.sin(yaw) * 0.012, w.y + Math.sin(idx * 2.1) * 0.014, Math.cos(yaw) * 0.012],
        yaw, pitch: w.pitch + Math.cos(idx * 1.9) * 0.06, roll,
        width: w.wid * lenVar, length: w.len * lenVar, droop: w.droop, cup: -0.018,
        uvRect: UV_HINOKI, crownCenter, aoInner: w.ao, aoOuter: Math.min(1.14, w.ao + 0.58),
      }));
      idx++;
    }
  }
  for (let a = 0; a < 3; a++) {
    parts.push(buildCurvedBotanicalCard({
      origin: [0, 0.85, 0], yaw: (a / 3) * Math.PI, pitch: Math.PI * 0.5 - 0.05,
      width: 0.085, length: 0.155, droop: 0.0, cup: 0.01,
      uvRect: UV_HINOKI, crownCenter, aoInner: 0.72, aoOuter: 1.15, tipTaper: 0.30,
    }));
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 3: GRAND BUNA BEECH / ZELKOVA (ブナ・ケヤキ) — Cathedral Spreading Dome
// ============================================================================
const BUNA_BRANCH_NODES = [
  { x:  0.00, y: 0.80, z:  0.00, spread: 0.25, count: 5, ao: 0.58 },
  { x: -0.19, y: 0.67, z:  0.09, spread: 0.22, count: 4, ao: 0.44 },
  { x:  0.20, y: 0.69, z:  0.11, spread: 0.23, count: 4, ao: 0.46 },
  { x:  0.03, y: 0.66, z: -0.20, spread: 0.22, count: 4, ao: 0.42 },
  { x: -0.14, y: 0.75, z: -0.14, spread: 0.20, count: 4, ao: 0.54 },
  { x:  0.14, y: 0.76, z: -0.10, spread: 0.20, count: 4, ao: 0.56 },
  { x: -0.07, y: 0.86, z:  0.07, spread: 0.19, count: 4, ao: 0.70 },
  { x:  0.09, y: 0.85, z:  0.01, spread: 0.18, count: 4, ao: 0.72 },
  { x: -0.24, y: 0.58, z: -0.05, spread: 0.18, count: 4, ao: 0.36 },
  { x:  0.24, y: 0.60, z: -0.02, spread: 0.18, count: 4, ao: 0.38 },
];

function buildBunaTrunkGeo() {
  const parts = [];
  parts.push(buildWoodLimb(0, 0, 0, 0.006, 0.16, -0.004, 0.054, 0.036, 8));
  parts.push(buildWoodLimb(0.006, 0.15, -0.004, 0.0, 0.46, 0.006, 0.036, 0.024, 8));
  const forks = [
    [0.0, 0.44, 0.006, -0.19, 0.67,  0.09, 0.020, 0.008],
    [0.0, 0.45, 0.006,  0.20, 0.69,  0.11, 0.020, 0.008],
    [0.0, 0.43, 0.006,  0.03, 0.66, -0.20, 0.019, 0.008],
    [0.0, 0.46, 0.006, -0.14, 0.75, -0.14, 0.015, 0.007],
    [0.0, 0.46, 0.006,  0.14, 0.76, -0.10, 0.015, 0.007],
    [0.0, 0.46, 0.006,  0.00, 0.80,  0.00, 0.017, 0.008],
    [-0.11, 0.58, 0.05, -0.24, 0.58, -0.05, 0.010, 0.004],
    [ 0.12, 0.59, 0.06,  0.24, 0.60, -0.02, 0.010, 0.004],
    [ 0.00, 0.69, 0.00, -0.07, 0.86,  0.07, 0.010, 0.004],
    [ 0.00, 0.70, 0.00,  0.09, 0.85,  0.01, 0.010, 0.004],
  ];
  for (let i = 0; i < forks.length; i++) {
    const f = forks[i];
    parts.push(buildWoodLimb(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 6));
  }
  return mergeGeometriesFull(parts);
}

function buildBunaFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.65, 0];
  let idx = 0;
  for (let ni = 0; ni < BUNA_BRANCH_NODES.length; ni++) {
    const nd = BUNA_BRANCH_NODES[ni];
    for (let k = 0; k < nd.count; k++) {
      const yaw = (k / nd.count) * Math.PI * 2.0 + ni * 1.17;
      const pitch = -0.12 + (k % 3) * 0.34 + Math.sin(idx * 2.3) * 0.16;
      const roll = ((k + ni) % 2 === 0 ? 1 : -1) * (0.38 + (k % 3) * 0.36);
      parts.push(buildCurvedBotanicalCard({
        origin: [nd.x - Math.sin(yaw) * 0.03, nd.y - 0.02 + Math.cos(idx * 1.7) * 0.025, nd.z - Math.cos(yaw) * 0.03],
        yaw, pitch, roll,
        width: nd.spread * 1.14, length: nd.spread * 1.20, droop: 0.035, cup: 0.026,
        uvRect: UV_BUNA, crownCenter, aoInner: nd.ao, aoOuter: Math.min(1.16, nd.ao + 0.56),
        flutterBase: 0.15, flutterTip: 1.0,
      }));
      idx++;
    }
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 4: JAPANESE MOUNTAIN MAPLE (イロハモミジ) — Sinuous Multi-Stem Layered Canopy
// ============================================================================
const MAPLE_NODES = [
  { x: -0.22, y: 0.56, z:  0.14, spread: 0.25, count: 4, ao: 0.42 },
  { x:  0.24, y: 0.62, z:  0.08, spread: 0.26, count: 4, ao: 0.48 },
  { x:  0.02, y: 0.58, z: -0.24, spread: 0.25, count: 4, ao: 0.44 },
  { x: -0.16, y: 0.74, z: -0.12, spread: 0.24, count: 4, ao: 0.58 },
  { x:  0.16, y: 0.78, z: -0.06, spread: 0.24, count: 4, ao: 0.62 },
  { x: -0.04, y: 0.84, z:  0.12, spread: 0.23, count: 4, ao: 0.68 },
  { x:  0.05, y: 0.90, z: -0.02, spread: 0.21, count: 4, ao: 0.76 },
  { x: -0.32, y: 0.48, z: -0.06, spread: 0.21, count: 3, ao: 0.36 },
  { x:  0.32, y: 0.52, z: -0.12, spread: 0.21, count: 3, ao: 0.38 },
];

function buildMapleTrunkGeo() {
  const parts = [];
  // Short sinuous root-flared base forking low into 3 graceful curving Japanese maple stems!
  parts.push(buildWoodLimb(0, 0, 0, 0.015, 0.18, 0.01, 0.042, 0.028, 7));
  // Stem A (west-south graceful arch)
  parts.push(buildWoodLimb(0.015, 0.16, 0.01, -0.11, 0.38, 0.08, 0.021, 0.013, 6));
  parts.push(buildWoodLimb(-0.11, 0.37, 0.08, -0.22, 0.56, 0.14, 0.013, 0.006, 5));
  parts.push(buildWoodLimb(-0.11, 0.37, 0.08, -0.32, 0.48, -0.06, 0.011, 0.005, 5));
  parts.push(buildWoodLimb(-0.11, 0.37, 0.08, -0.16, 0.74, -0.12, 0.012, 0.005, 5));
  // Stem B (east-high arching crown)
  parts.push(buildWoodLimb(0.015, 0.16, 0.01, 0.12, 0.42, 0.05, 0.021, 0.013, 6));
  parts.push(buildWoodLimb(0.12, 0.41, 0.05, 0.24, 0.62, 0.08, 0.013, 0.006, 5));
  parts.push(buildWoodLimb(0.12, 0.41, 0.05, 0.32, 0.52, -0.12, 0.011, 0.005, 5));
  parts.push(buildWoodLimb(0.12, 0.41, 0.05, 0.16, 0.78, -0.06, 0.012, 0.005, 5));
  parts.push(buildWoodLimb(0.12, 0.41, 0.05, 0.05, 0.90, -0.02, 0.010, 0.004, 5));
  // Stem C (north spreading stem)
  parts.push(buildWoodLimb(0.015, 0.17, 0.01, 0.01, 0.40, -0.13, 0.018, 0.011, 6));
  parts.push(buildWoodLimb(0.01, 0.39, -0.13, 0.02, 0.58, -0.24, 0.011, 0.005, 5));
  parts.push(buildWoodLimb(0.01, 0.39, -0.13, -0.04, 0.84, 0.12, 0.010, 0.004, 5));
  return mergeGeometriesFull(parts);
}

function buildMapleFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.64, 0];
  let idx = 0;
  // Airy horizontal layered maple foliage clouds with delicate drooping palmate tips!
  for (let ni = 0; ni < MAPLE_NODES.length; ni++) {
    const nd = MAPLE_NODES[ni];
    for (let k = 0; k < nd.count; k++) {
      const yaw = (k / nd.count) * Math.PI * 2.0 + ni * 1.41;
      const pitch = -0.10 + (k % 2) * 0.24 + Math.sin(idx * 2.1) * 0.10;
      const roll = ((k + ni) % 2 === 0 ? 1 : -1) * (0.22 + (k % 3) * 0.18);
      parts.push(buildCurvedBotanicalCard({
        origin: [nd.x - Math.sin(yaw) * 0.02, nd.y - 0.015 + Math.cos(idx * 1.9) * 0.018, nd.z - Math.cos(yaw) * 0.02],
        yaw, pitch, roll,
        width: nd.spread * 1.24, length: nd.spread * 1.18, droop: 0.046, cup: 0.018,
        uvRect: UV_MAPLE, crownCenter, aoInner: nd.ao, aoOuter: Math.min(1.18, nd.ao + 0.56),
        flutterBase: 0.18, flutterTip: 1.0,
      }));
      idx++;
    }
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 5: HIGHLAND WHITE PAPER BIRCH (白樺) — Gleaming Twin-Stem White Trunks
// ============================================================================
function buildBirchTrunkGeo() {
  const parts = [];
  // Iconic slender gently curving twin white birch trunks (very natural in Japanese highlands!)
  // Main tall stem
  parts.push(buildWoodLimb(-0.012, 0.0, 0.0, -0.028, 0.34, 0.018, 0.026, 0.018, 7));
  parts.push(buildWoodLimb(-0.028, 0.33, 0.018, -0.015, 0.66, 0.024, 0.018, 0.010, 6));
  parts.push(buildWoodLimb(-0.015, 0.65, 0.024,  0.005, 0.91, 0.010, 0.010, 0.003, 5));
  // Companion leaning twin stem
  parts.push(buildWoodLimb(0.018, 0.0, -0.008, 0.068, 0.30, -0.032, 0.020, 0.014, 6));
  parts.push(buildWoodLimb(0.068, 0.29, -0.032, 0.095, 0.60, -0.046, 0.014, 0.007, 6));
  parts.push(buildWoodLimb(0.095, 0.59, -0.046, 0.110, 0.82, -0.052, 0.007, 0.003, 5));
  // Ascending slender upper twigs
  const limbs = [
    [-0.022, 0.48, 0.02, -0.15, 0.66,  0.09, 0.007, 0.003],
    [-0.018, 0.54, 0.02, -0.12, 0.74, -0.10, 0.007, 0.003],
    [-0.010, 0.68, 0.02,  0.09, 0.84,  0.11, 0.006, 0.002],
    [ 0.085, 0.52, -0.04,  0.20, 0.68,  0.04, 0.007, 0.003],
    [ 0.095, 0.60, -0.05,  0.16, 0.76, -0.16, 0.006, 0.002],
  ];
  for (let i = 0; i < limbs.length; i++) {
    const f = limbs[i];
    parts.push(buildWoodLimb(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 5));
  }
  return mergeGeometriesFull(parts);
}

function buildBirchFoliageGeo() {
  const parts = [];
  const crownCenter = [0.03, 0.72, 0];
  const nodes = [
    { x: -0.01, y: 0.86, z:  0.01, wid: 0.21, len: 0.22, n: 4, ao: 0.68 },
    { x: -0.12, y: 0.68, z:  0.08, wid: 0.20, len: 0.21, n: 4, ao: 0.50 },
    { x: -0.10, y: 0.75, z: -0.09, wid: 0.19, len: 0.20, n: 4, ao: 0.56 },
    { x:  0.07, y: 0.82, z:  0.09, wid: 0.19, len: 0.20, n: 4, ao: 0.62 },
    { x:  0.11, y: 0.79, z: -0.05, wid: 0.20, len: 0.21, n: 4, ao: 0.60 },
    { x:  0.18, y: 0.67, z:  0.03, wid: 0.19, len: 0.20, n: 4, ao: 0.48 },
    { x:  0.14, y: 0.74, z: -0.14, wid: 0.18, len: 0.19, n: 3, ao: 0.54 },
    { x:  0.02, y: 0.56, z: -0.02, wid: 0.19, len: 0.20, n: 4, ao: 0.42 },
  ];
  let idx = 0;
  for (let ni = 0; ni < nodes.length; ni++) {
    const nd = nodes[ni];
    for (let k = 0; k < nd.n; k++) {
      const yaw = (k / nd.n) * Math.PI * 2.0 + ni * 1.33;
      const pitch = -0.16 + (k % 3) * 0.28 + Math.sin(idx * 2.7) * 0.12;
      const roll = ((k + ni) % 2 === 0 ? 1 : -1) * (0.34 + (k % 2) * 0.30);
      parts.push(buildCurvedBotanicalCard({
        origin: [nd.x, nd.y, nd.z],
        yaw, pitch, roll,
        width: nd.wid, length: nd.len, droop: 0.055, cup: 0.020,
        uvRect: UV_BIRCH, crownCenter, aoInner: nd.ao, aoOuter: Math.min(1.18, nd.ao + 0.54),
        flutterBase: 0.22, flutterTip: 1.0,
      }));
      idx++;
    }
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 6: JAPANESE RED PINE (アカマツ) — Sculptural Twisted Trunk + Horizontal Cloud Pads
// ============================================================================
const PINE_PADS = [
  { x: -0.26, y: 0.68, z:  0.12, spread: 0.24, count: 5, ao: 0.44 },
  { x:  0.28, y: 0.74, z: -0.08, spread: 0.25, count: 5, ao: 0.50 },
  { x:  0.04, y: 0.78, z:  0.22, spread: 0.22, count: 4, ao: 0.54 },
  { x: -0.12, y: 0.84, z: -0.18, spread: 0.23, count: 5, ao: 0.62 },
  { x:  0.12, y: 0.89, z:  0.04, spread: 0.24, count: 5, ao: 0.70 },
  { x: -0.02, y: 0.94, z: -0.02, spread: 0.21, count: 4, ao: 0.78 },
];

function buildPineTrunkGeo() {
  const parts = [];
  // Iconic gnarled S-curving Akamatsu pine trunk (bare lower 55%, sculptural high limbs!)
  parts.push(buildWoodLimb(0.0, 0.0, 0.0, 0.04, 0.22, 0.02, 0.044, 0.032, 7));
  parts.push(buildWoodLimb(0.04, 0.21, 0.02, 0.085, 0.46, -0.015, 0.032, 0.024, 7));
  parts.push(buildWoodLimb(0.085, 0.45, -0.015, 0.035, 0.68, 0.015, 0.024, 0.018, 6));
  parts.push(buildWoodLimb(0.035, 0.67, 0.015, -0.01, 0.88, -0.01, 0.018, 0.010, 6));
  // Wide gnarled horizontal-reaching pine boughs
  const boughs = [
    [ 0.04, 0.62,  0.01, -0.14, 0.64,  0.08, 0.016, 0.011],
    [-0.14, 0.64,  0.08, -0.26, 0.68,  0.12, 0.011, 0.006],
    [ 0.04, 0.66,  0.01,  0.18, 0.70, -0.05, 0.016, 0.010],
    [ 0.18, 0.70, -0.05,  0.28, 0.74, -0.08, 0.010, 0.005],
    [ 0.02, 0.72,  0.01,  0.04, 0.78,  0.22, 0.013, 0.006],
    [ 0.00, 0.78,  0.00, -0.12, 0.84, -0.18, 0.012, 0.005],
    [-0.01, 0.84, -0.01,  0.12, 0.89,  0.04, 0.011, 0.005],
    [-0.01, 0.87, -0.01, -0.02, 0.94, -0.02, 0.010, 0.005],
  ];
  for (let i = 0; i < boughs.length; i++) {
    const f = boughs[i];
    parts.push(buildWoodLimb(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 5));
  }
  return mergeGeometriesFull(parts);
}

function buildPineFoliageGeo() {
  const parts = [];
  const crownCenter = [0, 0.80, 0];
  let idx = 0;
  // Flat wide bonsai-like pine needle umbrella pads!
  for (let pi = 0; pi < PINE_PADS.length; pi++) {
    const pad = PINE_PADS[pi];
    for (let k = 0; k < pad.count; k++) {
      const yaw = (k / pad.count) * Math.PI * 2.0 + pi * 1.1;
      const pitch = -0.04 + (k % 2) * 0.14;
      const roll = ((k + pi) % 2 === 0 ? 1 : -1) * 0.16;
      parts.push(buildCurvedBotanicalCard({
        origin: [pad.x - Math.sin(yaw) * 0.02, pad.y - 0.01 + (k % 2) * 0.022, pad.z - Math.cos(yaw) * 0.02],
        yaw, pitch, roll,
        width: pad.spread * 1.25, length: pad.spread * 1.12, droop: 0.018, cup: -0.024,
        uvRect: UV_PINE, crownCenter, aoInner: pad.ao, aoOuter: Math.min(1.16, pad.ao + 0.56),
        flutterBase: 0.06, flutterTip: 0.72,
      }));
      idx++;
    }
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 7: RIPARIAN WEEPING WILLOW (川ヤナギ) — Leaning Trunk + Cascading Drapes
// ============================================================================
function buildWillowTrunkGeo() {
  const parts = [];
  // Gently leaning riverside trunk forking into arching weeping boughs
  parts.push(buildWoodLimb(0.0, 0.0, 0.0, 0.06, 0.24, 0.03, 0.056, 0.038, 7));
  parts.push(buildWoodLimb(0.06, 0.23, 0.03, 0.11, 0.50, 0.05, 0.038, 0.024, 7));
  const arches = [
    [0.10, 0.48, 0.04, -0.14, 0.72,  0.14, 0.018, 0.008],
    [0.10, 0.49, 0.04,  0.30, 0.74,  0.12, 0.018, 0.008],
    [0.10, 0.48, 0.04,  0.14, 0.76, -0.18, 0.017, 0.008],
    [0.10, 0.50, 0.04, -0.06, 0.80, -0.12, 0.015, 0.007],
    [0.11, 0.50, 0.05,  0.18, 0.86,  0.04, 0.016, 0.007],
  ];
  for (let i = 0; i < arches.length; i++) {
    const f = arches[i];
    parts.push(buildWoodLimb(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], 5));
  }
  return mergeGeometriesFull(parts);
}

function buildWillowFoliageGeo() {
  const parts = [];
  const crownCenter = [0.10, 0.62, 0.04];
  // Outer ring of cascading pendulous willow curtains hanging gracefully down!
  const anchors = [
    { x: -0.14, y: 0.74, z:  0.14, r: 0.22, drop: 0.52 },
    { x:  0.30, y: 0.75, z:  0.12, r: 0.24, drop: 0.56 },
    { x:  0.14, y: 0.77, z: -0.18, r: 0.22, drop: 0.52 },
    { x: -0.06, y: 0.82, z: -0.12, r: 0.21, drop: 0.48 },
    { x:  0.18, y: 0.88, z:  0.04, r: 0.24, drop: 0.50 },
    { x:  0.04, y: 0.82, z:  0.22, r: 0.20, drop: 0.48 },
    { x:  0.28, y: 0.72, z: -0.08, r: 0.20, drop: 0.50 },
  ];
  for (let ai = 0; ai < anchors.length; ai++) {
    const an = anchors[ai];
    for (let k = 0; k < 4; k++) {
      const yaw = (k / 4) * Math.PI * 2.0 + ai * 0.9;
      // Pitch downward (-1.22 rad ≈ -70°) so the willow fronds drape vertically like waterfalls!
      // flipV=true puts the painted top attachment stem at the branch anchor and leaf tips hanging down!
      parts.push(buildCurvedBotanicalCard({
        origin: [an.x + Math.sin(yaw) * 0.06, an.y, an.z + Math.cos(yaw) * 0.06],
        yaw,
        pitch: -1.16 - (k % 2) * 0.16,
        roll: ((k + ai) % 2 === 0 ? 1 : -1) * 0.22,
        width: an.r * 1.12,
        length: an.drop,
        droop: 0.06,
        cup: 0.022,
        uvRect: UV_WILLOW,
        crownCenter,
        aoInner: 0.62,
        aoOuter: 1.06,
        flutterBase: 0.14,
        flutterTip: 1.0,
        segV: 2,
        flipV: true,
      }));
    }
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// SPECIES 8: WOODLAND FLOWERING SHRUBS / MOUNTAIN AZALEAS (低木・山ツツジ) & MOSSY STUMPS
// ============================================================================
function buildShrubGeo() {
  const parts = [];
  const crownCenter = [0, 0.55, 0];
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2.0 + (i % 2) * 0.28;
    const isUpper = i >= 6;
    parts.push(buildCurvedBotanicalCard({
      origin: [Math.sin(yaw) * 0.12, isUpper ? 0.42 : 0.14, Math.cos(yaw) * 0.12],
      yaw,
      pitch: isUpper ? 0.64 : 0.22 + (i % 3) * 0.14,
      roll: ((i % 2) === 0 ? 1 : -1) * 0.28,
      width: isUpper ? 0.96 : 1.08,
      length: isUpper ? 0.92 : 1.05,
      droop: 0.22,
      cup: 0.08,
      uvRect: UV_SHRUB,
      crownCenter,
      aoInner: 0.36,
      aoOuter: 1.14,
      flutterBase: 0.08,
      flutterTip: 0.85,
      segV: 1,
    }));
  }
  return mergeGeometriesFull(parts);
}

function buildStumpGeo() {
  const parts = [];
  const body = new THREE.CylinderGeometry(0.42, 0.64, 0.92, 10, 3);
  body.translate(0, 0.40, 0);
  perturbGeometry(body, 0.045, -1.0, 317);
  parts.push(body);
  // Flared organic roots hugging the forest floor
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push(buildWoodLimb(Math.sin(a) * 0.28, 0.22, Math.cos(a) * 0.28, Math.sin(a) * 0.92, -0.10, Math.cos(a) * 0.92, 0.16, 0.06, 5));
  }
  return mergeGeometriesFull(parts);
}

// ============================================================================
// MID-DISTANCE ALPHA-CUTOUT BOTANICAL STAR-CARD IMPOSTORS (4 Species Groups!)
// ============================================================================
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

// ============================================================================
// GROUNDCOVER: WOOD-FERNS, KUMAZASA BAMBOO, WILD GRASS, BOULDERS & NURSE LOGS
// ============================================================================
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

// ============================================================================
// PHOTOREALISTIC BOTANICAL SHADER MATERIALS
// ============================================================================
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

    attribute vec2 aMeta;

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
    #ifdef USE_LOGDEPTHBUF
      varying float vFragDepth;
      varying float vIsPerspective;
    #endif

    void main() {
      vec3 localPos = position;
      vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

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

      if (uIsMidImpostor > 0.5) {
        float fadeIn = smoothstep(155.0, 225.0, camDist);
        float fadeOut = 1.0 - smoothstep(1380.0, 1780.0, camDist);
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
      #ifdef USE_LOGDEPTHBUF
        vFragDepth = 1.0 + gl_Position.w;
        vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
      #endif
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
    #include <logdepthbuf_pars_fragment>

    ${TERRENO_ATMO_FUNCTIONS_GLSL}

    void main() {
      if (uIsMidImpostor > 0.5 && (vCamDist < 155.0 || vCamDist > 1780.0)) discard;
      if (uFadeEnd > 1.0 && vCamDist > uFadeEnd) discard;

      vec4 tex = texture2D(uFoliageAtlas, vUv);
      float alphaCut = uIsMidImpostor > 0.5
        ? 0.24
        : mix(0.44, 0.23, smoothstep(14.0, 125.0, vCamDist));
      if (tex.a < alphaCut) discard;

      vec3 texLinear = pow(max(tex.rgb, vec3(0.0001)), vec3(2.2));
      vec3 albedo = texLinear * uBaseTint * vColor * vAo;

      vec3 N = normalize(vWorldNormal);
      vec3 sunDir = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;
      float canopyDensity = horz.a;

      float komorebi = uUseKomorebi > 0.5
        ? evalKomorebiDapple(vWorldPos, canopyDensity, sunDir, vCamDist)
        : 1.0;

      float ndl = max(0.0, (dot(N, sunDir) + 0.36) / 1.36);
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * komorebi * 0.92);

      // Species-aware warm sunlit subsurface scattering (lets crimson maples & emerald leaves glow naturally!)
      float backScatter = pow(clamp(dot(-V, sunDir), 0.0, 1.0), 2.8) * (0.35 + 0.65 * clamp(vAo, 0.2, 1.2));
      float thinRim = pow(1.0 - abs(dot(N, V)), 2.0) * max(0.0, dot(sunDir, vec3(0.0, 1.0, 0.0)) + 0.35) * 0.22;
      vec3 sssTint = mix(vec3(0.62, 0.95, 0.26), vec3(1.15, 0.58, 0.22), clamp((vColor.r - vColor.g) * 3.5, 0.0, 1.0));
      direct += uSunColor * sssTint * ((backScatter + thinRim) * uSunIntensity * horizonShadow * komorebi * uSssStrength);

      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.42 + 0.58 * skyViewAO) * 0.96);

      float dComp = length(vWorldPos.xz - vec2(1.5, 3.5));
      float compWarm = exp(-dComp * 0.065) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.20;

      vec3 lit = albedo * (direct + ambient + vec3(1.0, 0.74, 0.44) * compWarm);

      vec3 H = normalize(sunDir + V);
      float leafSpec = pow(max(0.0, dot(N, H)), 28.0) * 0.065 * horizonShadow * komorebi * (1.0 - uIsMidImpostor);
      lit += uSunColor * (leafSpec * uSunIntensity * 0.55);

      lit += evalTerrenoFlashlight(vWorldPos, N, albedo);

      vec3 finalCol = applyTerrenoAtmosphereFast(lit, vWorldPos, cameraPosition);

      gl_FragColor = vec4(finalCol, 1.0);
      #include <logdepthbuf_fragment>
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

function createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, opts) {
  const {
    isRock = false,
    swayAmp = 0.0,
    baseColor = [1, 1, 1],
    barkUvScale = [2.5, 7.5],
    barkMossAmt = 0.78,
    useDirectBark = false,
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
    #ifdef USE_LOGDEPTHBUF
      varying float vFragDepth;
      varying float vIsPerspective;
    #endif

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
      #ifdef USE_LOGDEPTHBUF
        vFragDepth = 1.0 + gl_Position.w;
        vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
      #endif
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
    uniform vec2 uBarkUvScale;
    uniform float uBarkMossAmt;
    uniform float uUseDirectBark;

    ${TERRENO_ATMO_UNIFORMS_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;
    #include <logdepthbuf_pars_fragment>

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
        vec2 barkUv = vec2(vUv.x * uBarkUvScale.x, vLocalY * uBarkUvScale.y);
        vec4 bTex = texture2D(uBarkTex, barkUv);
        vec3 bLin = pow(max(bTex.rgb, vec3(0.0001)), vec3(2.2));
        float barkAO = mix(0.50, 1.06, clamp(vLocalY * 1.5, 0.0, 1.0));
        vec3 barkFactor = uUseDirectBark > 0.5 ? bLin : (0.35 + 1.45 * bLin);
        albedo = albedo * barkFactor * barkAO;

        if (detailFade > 0.01) {
          float bR = texture2D(uBarkTex, barkUv + vec2(0.015, 0.0)).a - bTex.a;
          float bU = texture2D(uBarkTex, barkUv + vec2(0.0, 0.015)).a - bTex.a;
          vec3 T = normalize(vec3(-N.z, 0.0, N.x + 0.0001));
          N = normalize(N + (T * (-bR) + vec3(0.0, -bU, 0.0)) * (1.85 * detailFade));
        }

        float northFactor = 0.65 + 0.35 * clamp(-N.z, 0.0, 1.0);
        float trunkMoss = (1.0 - smoothstep(0.02, 0.24, vLocalY)) * smoothstep(0.32, 0.68, bTex.a * northFactor);
        albedo = mix(albedo, vec3(0.015, 0.044, 0.015), trunkMoss * uBarkMossAmt);
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
        float spec = pow(max(0.0, dot(N, H)), 42.0) * 0.14 * (1.0 - mossMaskRock * 0.92) * horizonShadow * komorebi;
        lit += uSunColor * (spec * uSunIntensity * 0.44);
      }

      lit += evalTerrenoFlashlight(vWorldPos, N, albedo);
      vec3 finalCol = applyTerrenoAtmosphereFast(lit, vWorldPos, cameraPosition);

      gl_FragColor = vec4(finalCol, 1.0);
      #include <logdepthbuf_fragment>
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
      uBarkUvScale: { value: new THREE.Vector2(barkUvScale[0], barkUvScale[1]) },
      uBarkMossAmt: { value: barkMossAmt },
      uUseDirectBark: { value: useDirectBark ? 1.0 : 0.0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.FrontSide,
  });
}

function isInsideCompoundClearing(x, z, extraMargin = 0.0) {
  if (x > -12.5 - extraMargin && x < 26.5 + extraMargin && z > -16.5 - extraMargin && z < 20.5 + extraMargin) {
    return true;
  }
  if (x > -6.0 - extraMargin && x < 23.0 + extraMargin && z > -28.0 - extraMargin && z <= -15.5) {
    return true;
  }
  if (isInsideVillageClearing(x, z, extraMargin)) {
    return true;
  }
  return false;
}

function isInsideCompoundPaving(x, z) {
  if (x > -9.6 && x < 23.4 && z > -11.5 && z < 16.5) return true;
  if (x > -4.6 && x < 19.8 && z > -16.5 && z <= -11.0) return true;
  if (x > -4.6 && x < 5.6 && z > -12.8 && z <= -5.0) return true;
  if (isInsideVillagePaving(x, z)) return true;
  return false;
}

export function createTerrenoForest(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_EcologicalForest_Streamer';

  const foliageAtlas = getBotanicalFoliageAtlas();
  const barkTex = getBotanicalBarkTexture();
  const birchBarkTex = getBirchBarkTexture();
  const pineBarkTex = getPineBarkTexture();

  const CAP_SUGI   = 1150;
  const CAP_HINOKI = 820;
  const CAP_BUNA   = 1050;
  const CAP_MAPLE  = 860;
  const CAP_BIRCH  = 780;
  const CAP_PINE   = 760;
  const CAP_WILLOW = 380;
  const CAP_SHRUB  = 980;
  const CAP_STUMP  = 180;
  const CAP_FERN   = 1500;
  const CAP_GRASS  = 3200;
  const CAP_SASA   = 1200;
  const CAP_BOULDER = 640;
  const CAP_LOG    = 200;

  const CAP_MID_CONIFER = 3200;
  const CAP_MID_BROAD   = 2200;
  const CAP_MID_MAPLE   = 1300;
  const CAP_MID_PINE    = 1100;

  // Distinct species-authentic bark materials
  const matBarkSugi   = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { baseColor: [0.095, 0.056, 0.036], swayAmp: 0.004 });
  const matBarkHinoki = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { baseColor: [0.140, 0.082, 0.048], swayAmp: 0.004 });
  const matBarkBuna   = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { baseColor: [0.24, 0.23, 0.21], swayAmp: 0.004 });
  const matBarkBirch  = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, birchBarkTex, {
    baseColor: [0.64, 0.62, 0.58], swayAmp: 0.005, barkUvScale: [2.4, 6.2], barkMossAmt: 0.28, useDirectBark: true,
  });
  const matBarkPine   = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, pineBarkTex, {
    baseColor: [0.36, 0.26, 0.20], swayAmp: 0.004, barkUvScale: [2.0, 5.2], barkMossAmt: 0.45, useDirectBark: true,
  });
  const matBoulder = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { isRock: true, baseColor: [0.105, 0.112, 0.118] });
  const matLog     = createTerrenoSolidEcoMaterial(geomorph, atmoUniforms, barkTex, { isRock: true, baseColor: [0.068, 0.044, 0.028] });

  const matTreeFoliage = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.015, flutterAmp: 0.012, sssStrength: 0.38,
  });
  const matWillowFoliage = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.024, flutterAmp: 0.020, sssStrength: 0.46,
  });
  const matShrub = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.042, flutterAmp: 0.022, fadeStart: 62.0, fadeEnd: 94.0, sssStrength: 0.46, useKomorebi: true,
  });
  const matFern = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.065, flutterAmp: 0.028, fadeStart: 50.0, fadeEnd: 78.0, sssStrength: 0.50, useKomorebi: true,
  });
  const matGroundGrass = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.095, flutterAmp: 0.036, fadeStart: 30.0, fadeEnd: 46.0, sssStrength: 0.46, useKomorebi: true,
  });
  const matGroundSasa = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.072, flutterAmp: 0.028, fadeStart: 36.0, fadeEnd: 52.0, sssStrength: 0.44, useKomorebi: true,
  });
  const matMidImpostor = createBotanicalFoliageMaterial(geomorph, atmoUniforms, foliageAtlas, {
    swayAmp: 0.0, flutterAmp: 0.0, isMidImpostor: true, sssStrength: 0.24,
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

  // 7 Full-Canopy 3D Tree Species
  const imSugiTrunk   = makeInstanced(buildSugiTrunkGeo(),   matBarkSugi,   CAP_SUGI,   'ECO_Sugi_Trunks');
  const imSugiLeaf    = makeInstanced(buildSugiFoliageGeo(), matTreeFoliage, CAP_SUGI,   'ECO_Sugi_Foliage');
  const imHinokiTrunk = makeInstanced(buildHinokiTrunkGeo(), matBarkHinoki, CAP_HINOKI, 'ECO_Hinoki_Trunks');
  const imHinokiLeaf  = makeInstanced(buildHinokiFoliageGeo(), matTreeFoliage, CAP_HINOKI, 'ECO_Hinoki_Foliage');
  const imBunaTrunk   = makeInstanced(buildBunaTrunkGeo(),   matBarkBuna,   CAP_BUNA,   'ECO_Buna_Trunks');
  const imBunaLeaf    = makeInstanced(buildBunaFoliageGeo(), matTreeFoliage, CAP_BUNA,   'ECO_Buna_Foliage');
  const imMapleTrunk  = makeInstanced(buildMapleTrunkGeo(),  matBarkBuna,   CAP_MAPLE,  'ECO_Maple_Trunks');
  const imMapleLeaf   = makeInstanced(buildMapleFoliageGeo(), matTreeFoliage, CAP_MAPLE, 'ECO_Maple_Foliage');
  const imBirchTrunk  = makeInstanced(buildBirchTrunkGeo(),  matBarkBirch,  CAP_BIRCH,  'ECO_Birch_Trunks');
  const imBirchLeaf   = makeInstanced(buildBirchFoliageGeo(), matTreeFoliage, CAP_BIRCH, 'ECO_Birch_Foliage');
  const imPineTrunk   = makeInstanced(buildPineTrunkGeo(),   matBarkPine,   CAP_PINE,   'ECO_Pine_Trunks');
  const imPineLeaf    = makeInstanced(buildPineFoliageGeo(), matTreeFoliage, CAP_PINE,  'ECO_Pine_Foliage');
  const imWillowTrunk = makeInstanced(buildWillowTrunkGeo(), matBarkBuna,   CAP_WILLOW, 'ECO_Willow_Trunks');
  const imWillowLeaf  = makeInstanced(buildWillowFoliageGeo(), matWillowFoliage, CAP_WILLOW, 'ECO_Willow_Foliage');

  // Understory Midstory Shrubs, Mossy Stumps, Ferns, Grass, Kumazasa, Boulders & Nurse Logs
  const imShrub   = makeInstanced(buildShrubGeo(),   matShrub,       CAP_SHRUB,   'ECO_Azalea_Shrubs');
  const imStump   = makeInstanced(buildStumpGeo(),   matBarkSugi,    CAP_STUMP,   'ECO_Mossy_Stumps');
  const imFern    = makeInstanced(buildFernGeo(),    matFern,        CAP_FERN,    'ECO_Wood_Ferns');
  const imGrass   = makeInstanced(buildGroundClumpGeo(UV_GRASS, 0.88, 0.56, 0.14), matGroundGrass, CAP_GRASS, 'ECO_Wild_Grass');
  const imSasa    = makeInstanced(buildGroundClumpGeo(UV_SASA, 1.18, 0.84, 0.16), matGroundSasa,  CAP_SASA,  'ECO_Kumazasa_Bamboo');
  const imBoulder = makeInstanced(buildBoulderGeo(), matBoulder,     CAP_BOULDER, 'ECO_Mossy_Boulders');
  const imLog     = makeInstanced(buildNurseLogGeo(), matLog,        CAP_LOG,     'ECO_Nurse_Logs');

  // 4-Species Mid-Distance Treeline Impostors
  const imMidConifer = makeInstanced(buildStarImpostorGeo(UV_SUGI,  0.44, 0.94, 0.08, 0.18), matMidImpostor, CAP_MID_CONIFER, 'ECO_Mid_Conifers');
  const imMidBroad   = makeInstanced(buildStarImpostorGeo(UV_BUNA,  0.56, 0.72, 0.24, 0.84), matMidImpostor, CAP_MID_BROAD,   'ECO_Mid_Broadleaf');
  const imMidMaple   = makeInstanced(buildStarImpostorGeo(UV_MAPLE, 0.56, 0.68, 0.22, 0.86), matMidImpostor, CAP_MID_MAPLE,   'ECO_Mid_MapleBirch');
  const imMidPine    = makeInstanced(buildStarImpostorGeo(UV_PINE,  0.60, 0.64, 0.34, 0.96), matMidImpostor, CAP_MID_PINE,    'ECO_Mid_Pines');

  const dummyObj = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  let lastNearTx = 999999, lastNearTz = 999999;
  let lastGroundTx = 999999, lastGroundTz = 999999;
  let lastMidTx = 999999, lastMidTz = 999999;
  let localColliders = [];
  let localShrubColliders = [];
  let mergedLocalColliders = [];
  const remoteTileColliderCache = new Map();
  let stats = {
    sugi: 0, hinoki: 0, abies: 0, buna: 0, maple: 0, birch: 0, pine: 0, willow: 0,
    shrubs: 0, stumps: 0, ferns: 0, grass: 0, sasa: 0, boulders: 0, logs: 0,
    midConifers: 0, midBroad: 0, midMaple: 0, midPine: 0,
  };

  function syncMergedColliders() {
    mergedLocalColliders = localShrubColliders.length > 0
      ? localColliders.concat(localShrubColliders)
      : localColliders;
  }

  function getGroundY(wx, wz) {
    return typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(wx, wz)
      : geomorph.getHeightAt(wx, wz);
  }

  function isOnBridge(wx, wz, margin = 4.5) {
    return typeof geomorph.queryBridgeAt === 'function' && Boolean(geomorph.queryBridgeAt(wx, wz, margin));
  }

  // Ecological keep-probability combining regional biomes + real Japanese alpine treeline!
  function evalForestKeepProb(wx, wz, y, rw) {
    const elevASL = TERRENO_WORLD.baseElevationASL + y;
    if (elevASL > 1190) return 0.0;
    const treelineFade = elevASL > 920 ? Math.max(0.0, 1.0 - (elevASL - 920) / 270.0) : 1.0;

    const grove = 0.5 + 0.5 * Math.sin(wx * 0.0014 + Math.cos(wz * 0.0011) * 1.4) * Math.cos(wz * 0.0013 - wx * 0.0008);
    const regional =
      rw.valley * 0.96 +
      rw.plateau * 0.94 +
      rw.hills * (0.48 + 0.48 * grove) +
      rw.wetland * (0.18 + 0.34 * grove) +
      rw.meadow * (0.14 + 0.32 * grove) +
      rw.southPlain * (0.36 + 0.44 * grove);
    return Math.min(1.0, regional * treelineFade);
  }

  /**
   * Rich 6-species upland ecological community selector (+ Willow separately along waterbanks).
   * Guarantees vivid, natural real-world species variety right around NARROW-50 & across all mountains!
   * Returns: 0=Sugi, 1=Hinoki, 2=Buna, 3=Maple, 4=Birch, 5=Red Pine
   */
  function pickUplandSpecies(wx, wz, y, slope, rw, spRoll) {
    const elevASL = TERRENO_WORLD.baseElevationASL + y;

    // Micro-patch clustering so small organic groves of White Birch, Crimson Maple, & Red Pine form naturally
    const birchGrove = 0.5 + 0.5 * Math.sin(wx * 0.011 + wz * 0.009 + 1.2);
    const mapleGrove = 0.5 + 0.5 * Math.cos(wx * 0.013 - wz * 0.011 + 2.4);
    const pineRidge  = Math.min(1.0, Math.max(0.0, (slope - 0.14) * 2.2) + 0.25 * (0.5 + 0.5 * Math.sin(wx * 0.008 - wz * 0.012)));

    // Subalpine belt (> 910m ASL): hardy Red Pine, White Birch & Hinoki krummholz
    if (elevASL > 910) {
      if (spRoll < 0.42) return 5; // Red/Alpine Pine
      if (spRoll < 0.76) return 4; // Highland Birch
      return 1;                    // Subalpine Hinoki
    }

    // Weight each of the 6 iconic Japanese species based on elevation, slope & biome
    const wSugi   = (0.24 * rw.valley + 0.16 * rw.hills + 0.12 * rw.plateau + 0.28 * rw.southPlain + 0.14 * rw.wetland + 0.10 * rw.meadow) * (elevASL < 760 ? 1.0 : 0.45);
    const wHinoki = 0.14 * rw.valley + 0.16 * rw.hills + 0.14 * rw.plateau + 0.14 * rw.southPlain + 0.12 * rw.wetland + 0.10 * rw.meadow;
    const wBuna   = 0.18 * rw.valley + 0.24 * rw.hills + 0.30 * rw.plateau + 0.14 * rw.southPlain + 0.20 * rw.wetland + 0.22 * rw.meadow;
    const wMaple  = (0.17 * rw.valley + 0.16 * rw.hills + 0.18 * rw.plateau + 0.16 * rw.southPlain + 0.22 * rw.wetland + 0.18 * rw.meadow) * (0.72 + 0.56 * mapleGrove);
    const wBirch  = (0.14 * rw.valley + 0.15 * rw.hills + 0.16 * rw.plateau + 0.12 * rw.southPlain + 0.20 * rw.wetland + 0.26 * rw.meadow) * (0.68 + 0.64 * birchGrove) * (elevASL > 520 ? 1.25 : 1.0);
    const wPine   = (0.13 * rw.valley + 0.15 * rw.hills + 0.12 * rw.plateau + 0.16 * rw.southPlain + 0.12 * rw.wetland + 0.14 * rw.meadow) * (0.70 + 0.75 * pineRidge);

    const sum = wSugi + wHinoki + wBuna + wMaple + wBirch + wPine;
    let r = spRoll * sum;
    if ((r -= wSugi)   < 0) return 0;
    if ((r -= wHinoki) < 0) return 1;
    if ((r -= wBuna)   < 0) return 2;
    if ((r -= wMaple)  < 0) return 3;
    if ((r -= wBirch)  < 0) return 4;
    return 5;
  }

  function generateNearTile(tx, tz, isDetailTile, emitVisuals, outCounters, outColliders) {
    const tileX0 = tx * NEAR_TILE_SIZE;
    const tileZ0 = tz * NEAR_TILE_SIZE;
    if (
      tileX0 + NEAR_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
      tileZ0 + NEAR_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
    ) return;

    const rng = makeTileRng(tx, tz, 9011);

    // --- 1. Multi-Species Woodland Canopy Trees (48 candidate stems per 64m×64m tile) ---
    for (let c = 0; c < 48; c++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (wx < TERRENO_WORLD.minX + 12 || wx > TERRENO_WORLD.maxX - 12 || wz < TERRENO_WORLD.minZ + 12 || wz > TERRENO_WORLD.maxZ - 12) continue;
      if (isInsideCompoundClearing(wx, wz, 1.0)) continue;
      if (isInsideSouthRect(wx, wz, 3.0)) continue;
      if (isOnBridge(wx, wz, 5.2)) continue;

      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 3.0) continue;

      const rv = evalMainRiver(wz);
      const distMainRiv = Math.abs(wx - rv.x);
      const trib = evalClosestTributary(wx, wz);
      const inMainChannel = distMainRiv < rv.halfWidth * 1.15 + 1.8;
      const inTribChannel = trib && trib.dist < trib.width * 0.52 + 1.2;
      if (inMainChannel || inTribChannel) continue;

      const onRiverBank =
        (distMainRiv >= rv.halfWidth * 1.15 + 1.8 && distMainRiv < rv.halfWidth * 1.48 + 9.5) ||
        (trib && trib.dist >= trib.width * 0.52 + 1.2 && trib.dist < trib.width * 0.52 + 7.5);

      const y = getGroundY(wx, wz);
      const rw = evalRegionWeights(wx, wz);
      const keepProb = onRiverBank ? 0.85 : evalForestKeepProb(wx, wz, y, rw);
      if (rng() > keepProb) continue;

      const nrm = geomorph.getNormalAt(wx, wz, 2.2);
      if (nrm.slope > 0.76) continue;

      const in6fVistaCorridor = wx > -9.0 && wx < 13.0 && wz >= 10.0 && wz < 46.0;
      if (in6fVistaCorridor && rng() < 0.42) continue;

      const spRoll = rng();
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      const isWillow = onRiverBank && elevASL < 760 && spRoll < 0.58;
      const species = isWillow ? 6 : pickUplandSpecies(wx, wz, y, nrm.slope, rw, spRoll);

      const yaw = isWillow
        ? Math.atan2(rv.x - wx, (rng() - 0.5) * 6.0) + (rng() - 0.5) * 0.65
        : rng() * Math.PI * 2.0;
      const leanX = (rng() - 0.5) * 0.06;
      const leanZ = (rng() - 0.5) * 0.06;
      const alpineShrink = elevASL > 900 ? Math.max(0.42, 1.0 - (elevASL - 900) / 360.0) : 1.0;
      let sizeScale = (0.88 + rw.valley * 0.14 + rw.plateau * 0.10 - rw.wetland * 0.14) * alpineShrink;
      if (in6fVistaCorridor) sizeScale *= 0.48;

      if (species === 0) {
        // SUGI CEDAR (黒杉)
        const h = (18.0 + rng() * 15.5) * sizeScale;
        const rS = h * (0.94 + rng() * 0.24);
        const gVar = rng();
        if (emitVisuals && outCounters.nSugi < CAP_SUGI) {
          dummyObj.position.set(wx, y - 0.48, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imSugiTrunk.setMatrixAt(outCounters.nSugi, dummyObj.matrix);
          imSugiLeaf.setMatrixAt(outCounters.nSugi, dummyObj.matrix);
          tmpColor.setRGB(0.095 + gVar * 0.065, 0.112 + gVar * 0.066, 0.115 + gVar * 0.060);
          imSugiLeaf.setColorAt(outCounters.nSugi, tmpColor);
          tmpColor.setRGB(0.84 + gVar * 0.26, 0.80 + gVar * 0.22, 0.76 + gVar * 0.20);
          imSugiTrunk.setColorAt(outCounters.nSugi, tmpColor);
          outCounters.nSugi++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.28, rS * 0.038), kind: 'tree', height: h });
        }
      } else if (species === 1) {
        // KISO HINOKI CYPRESS (木曽檜)
        const h = (14.0 + rng() * 12.0) * sizeScale;
        const rS = h * (0.92 + rng() * 0.24);
        const gVar = rng();
        if (emitVisuals && outCounters.nHinoki < CAP_HINOKI) {
          dummyObj.position.set(wx, y - 0.42, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imHinokiTrunk.setMatrixAt(outCounters.nHinoki, dummyObj.matrix);
          imHinokiLeaf.setMatrixAt(outCounters.nHinoki, dummyObj.matrix);
          tmpColor.setRGB(0.115 + gVar * 0.068, 0.145 + gVar * 0.072, 0.125 + gVar * 0.062);
          imHinokiLeaf.setColorAt(outCounters.nHinoki, tmpColor);
          tmpColor.setRGB(0.88 + gVar * 0.22, 0.82 + gVar * 0.18, 0.74 + gVar * 0.16);
          imHinokiTrunk.setColorAt(outCounters.nHinoki, tmpColor);
          outCounters.nHinoki++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.22, rS * 0.028), kind: 'tree', height: h });
        }
      } else if (species === 2) {
        // GRAND BUNA BEECH / ZELKOVA (ブナ・ケヤキ)
        const h = (14.0 + rng() * 11.5) * sizeScale;
        const rS = h * (1.00 + rng() * 0.28);
        const tint = rng();
        if (emitVisuals && outCounters.nBuna < CAP_BUNA) {
          dummyObj.position.set(wx, y - 0.42, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imBunaTrunk.setMatrixAt(outCounters.nBuna, dummyObj.matrix);
          imBunaLeaf.setMatrixAt(outCounters.nBuna, dummyObj.matrix);
          if (tint < 0.72) {
            tmpColor.setRGB(0.13 + tint * 0.11, 0.18 + tint * 0.10, 0.12 + tint * 0.07);
          } else {
            tmpColor.setRGB(0.26 + (tint - 0.72) * 0.28, 0.23 + (tint - 0.72) * 0.14, 0.11);
          }
          imBunaLeaf.setColorAt(outCounters.nBuna, tmpColor);
          tmpColor.setRGB(0.92 + tint * 0.18, 0.92 + tint * 0.16, 0.88 + tint * 0.16);
          imBunaTrunk.setColorAt(outCounters.nBuna, tmpColor);
          outCounters.nBuna++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.30, rS * 0.044), kind: 'tree', height: h });
        }
      } else if (species === 3) {
        // JAPANESE MOUNTAIN MAPLE (イロハモミジ) — Crimson, Vermilion, Gold & Fresh Mountain Green!
        const h = (8.0 + rng() * 7.8) * sizeScale;
        const rS = h * (1.06 + rng() * 0.28);
        const hue = rng();
        if (emitVisuals && outCounters.nMaple < CAP_MAPLE) {
          dummyObj.position.set(wx, y - 0.34, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imMapleTrunk.setMatrixAt(outCounters.nMaple, dummyObj.matrix);
          imMapleLeaf.setMatrixAt(outCounters.nMaple, dummyObj.matrix);
          if (hue < 0.32) {
            // Deep Japanese Crimson Scarlet Momiji (深紅モミジ)
            tmpColor.setRGB(0.28 + hue * 0.24, 0.045 + hue * 0.06, 0.028);
          } else if (hue < 0.56) {
            // Fiery Vermilion-Orange Momiji (朱紅カエデ)
            tmpColor.setRGB(0.32, 0.105 + (hue - 0.32) * 0.22, 0.032);
          } else if (hue < 0.76) {
            // Sunlit Golden-Amber Maple (黄金カエデ)
            tmpColor.setRGB(0.28, 0.20 + (hue - 0.56) * 0.18, 0.048);
          } else {
            // Fresh Sun-Dappled Mountain Green Maple (青モミジ)
            tmpColor.setRGB(0.092 + (hue - 0.76) * 0.18, 0.175 + (hue - 0.76) * 0.16, 0.068);
          }
          imMapleLeaf.setColorAt(outCounters.nMaple, tmpColor);
          // Dark smooth olive-charcoal maple bark
          tmpColor.setRGB(0.42 + hue * 0.14, 0.38 + hue * 0.12, 0.35 + hue * 0.10);
          imMapleTrunk.setColorAt(outCounters.nMaple, tmpColor);
          outCounters.nMaple++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.22, rS * 0.036), kind: 'tree', height: h });
        }
      } else if (species === 4) {
        // HIGHLAND WHITE PAPER BIRCH (白樺)
        const h = (11.5 + rng() * 9.5) * sizeScale;
        const rS = h * (0.94 + rng() * 0.24);
        const bv = rng();
        if (emitVisuals && outCounters.nBirch < CAP_BIRCH) {
          dummyObj.position.set(wx, y - 0.36, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imBirchTrunk.setMatrixAt(outCounters.nBirch, dummyObj.matrix);
          imBirchLeaf.setMatrixAt(outCounters.nBirch, dummyObj.matrix);
          if (bv < 0.76) {
            // Luminous highland fresh birch lime-emerald
            tmpColor.setRGB(0.16 + bv * 0.10, 0.22 + bv * 0.09, 0.12 + bv * 0.06);
          } else {
            // Sunlit golden highland birch
            tmpColor.setRGB(0.32, 0.26, 0.09);
          }
          imBirchLeaf.setColorAt(outCounters.nBirch, tmpColor);
          tmpColor.setRGB(0.92 + bv * 0.12, 0.91 + bv * 0.12, 0.89 + bv * 0.12);
          imBirchTrunk.setColorAt(outCounters.nBirch, tmpColor);
          outCounters.nBirch++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.20, rS * 0.028), kind: 'tree', height: h });
        }
      } else if (species === 5) {
        // JAPANESE RED PINE (アカマツ) — Sculptural Twisted Terracotta Bark + Cloud Pads
        const h = (11.5 + rng() * 10.0) * sizeScale;
        const rS = h * (0.96 + rng() * 0.28);
        const pv = rng();
        if (emitVisuals && outCounters.nPine < CAP_PINE) {
          dummyObj.position.set(wx, y - 0.42, wz);
          dummyObj.rotation.set(leanX * 1.4, yaw, leanZ * 1.4);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imPineTrunk.setMatrixAt(outCounters.nPine, dummyObj.matrix);
          imPineLeaf.setMatrixAt(outCounters.nPine, dummyObj.matrix);
          tmpColor.setRGB(0.13 + pv * 0.07, 0.16 + pv * 0.07, 0.12 + pv * 0.06);
          imPineLeaf.setColorAt(outCounters.nPine, tmpColor);
          tmpColor.setRGB(0.94 + pv * 0.16, 0.84 + pv * 0.14, 0.76 + pv * 0.12);
          imPineTrunk.setColorAt(outCounters.nPine, tmpColor);
          outCounters.nPine++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.24, rS * 0.036), kind: 'tree', height: h });
        }
      } else {
        // RIPARIAN WEEPING WILLOW (川ヤナギ) — Cascading Streamside Curtains
        const h = (7.5 + rng() * 5.8) * Math.min(1.08, sizeScale + 0.06);
        const rS = h * (1.02 + rng() * 0.24);
        const wv = rng();
        if (emitVisuals && outCounters.nWillow < CAP_WILLOW) {
          dummyObj.position.set(wx, y - 0.35, wz);
          dummyObj.rotation.set(leanX, yaw, leanZ);
          dummyObj.scale.set(rS, h, rS);
          dummyObj.updateMatrix();
          imWillowTrunk.setMatrixAt(outCounters.nWillow, dummyObj.matrix);
          imWillowLeaf.setMatrixAt(outCounters.nWillow, dummyObj.matrix);
          tmpColor.setRGB(0.15 + wv * 0.08, 0.21 + wv * 0.09, 0.12 + wv * 0.06);
          imWillowLeaf.setColorAt(outCounters.nWillow, tmpColor);
          tmpColor.setRGB(0.56 + wv * 0.18, 0.53 + wv * 0.16, 0.46 + wv * 0.14);
          imWillowTrunk.setColorAt(outCounters.nWillow, tmpColor);
          outCounters.nWillow++;
        }
        if (isDetailTile) {
          outColliders.push({ x: wx, z: wz, r: Math.max(0.24, rS * 0.042), kind: 'tree', height: h });
        }
      }
    }

    if (!isDetailTile) return;

    // --- 2a. Woodland Flowering Shrubs & Mountain Azaleas (低木・山ツツジ) ---
    for (let s = 0; s < 96; s++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 0.4) || isInsideSouthRect(wx, wz, 2.5)) continue;
      if (isOnBridge(wx, wz, 3.2)) continue;
      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 1.4) continue;
      const rv = evalMainRiver(wz);
      const y = getGroundY(wx, wz);
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      if (elevASL > 1060) continue;
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.12 || y < rv.waterY + 0.35) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 1.5);
      if (nrm.slope > 0.64) continue;

      const sc = 0.78 + rng() * 1.15;
      const scY = sc * (0.82 + rng() * 0.46);
      const rotY = rng() * Math.PI * 2;
      const sv = rng();
      if (emitVisuals && outCounters.nShrub < CAP_SHRUB) {
        dummyObj.position.set(wx, y - 0.12, wz);
        dummyObj.rotation.set(nrm.z * 0.22, rotY, -nrm.x * 0.22);
        dummyObj.scale.set(sc, scY, sc);
        dummyObj.updateMatrix();
        imShrub.setMatrixAt(outCounters.nShrub, dummyObj.matrix);
        tmpColor.setRGB(0.17 + sv * 0.12, 0.21 + sv * 0.12, 0.15 + sv * 0.08);
        imShrub.setColorAt(outCounters.nShrub, tmpColor);
        outCounters.nShrub++;
      }
      if (sc >= 1.55) {
        outColliders.push({ x: wx, z: wz, r: sc * 0.22, kind: 'shrub', height: scY * 0.9 });
      }
    }

    // --- 2b. Lacy Pinnate Japanese Wood-Ferns (イノデ羊歯) ---
    for (let f = 0; f < 165; f++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundPaving(wx, wz) || isInsideSouthRect(wx, wz, 2.0)) continue;
      if (isOnBridge(wx, wz, 2.8)) continue;
      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 0.6) continue;
      const rv = evalMainRiver(wz);
      const y = getGroundY(wx, wz);
      if (TERRENO_WORLD.baseElevationASL + y > 1050) continue;
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.16 || y < rv.waterY + 0.35) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 1.5);
      if (nrm.slope > 0.66) continue;
      const sc = 0.72 + rng() * 1.05;
      const rotY = rng() * Math.PI * 2;
      const scY = sc * (0.78 + rng() * 0.38);
      const fv = rng();
      if (emitVisuals && outCounters.nFern < CAP_FERN) {
        dummyObj.position.set(wx, y - 0.04, wz);
        dummyObj.rotation.set(0, rotY, 0);
        dummyObj.scale.set(sc, scY, sc);
        dummyObj.updateMatrix();
        imFern.setMatrixAt(outCounters.nFern, dummyObj.matrix);
        tmpColor.setRGB(0.14 + fv * 0.12, 0.17 + fv * 0.12, 0.13 + fv * 0.08);
        imFern.setColorAt(outCounters.nFern, tmpColor);
        outCounters.nFern++;
      }
    }

    // --- 2c. Deeply Embedded Mossy Granite Boulders ---
    for (let b = 0; b < 44; b++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 1.5) || isInsideSouthRect(wx, wz, 3.0)) continue;
      if (isOnBridge(wx, wz, 5.2)) continue;
      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 3.0) continue;

      const nrm = geomorph.getNormalAt(wx, wz, 2.2);
      if (nrm.slope > 0.58) continue;

      const geo = geomorph.sampleGeoBilinear(wx, wz);
      const rv = evalMainRiver(wz);
      const distRiv = Math.abs(wx - rv.x);
      const trib = evalClosestTributary(wx, wz);
      const nearWater =
        (distRiv > rv.halfWidth * 0.85 && distRiv < rv.halfWidth * 1.55 + 16.0) ||
        (trib && trib.dist < trib.width * 0.8 + 8.0);
      if (!nearWater && geo.wetness < 0.38 && nrm.slope < 0.32 && rng() > 0.22) continue;

      const y = getGroundY(wx, wz);
      const rScale = nearWater ? (1.05 + rng() * 2.05) : (0.70 + rng() * 1.45);
      const scaleY = rScale * (0.62 + rng() * 0.40);
      const scaleZ = rScale * (0.82 + rng() * 0.36);
      const rotX = (rng() - 0.5) * 0.24;
      const rotY = rng() * Math.PI * 2;
      const rotZ = (rng() - 0.5) * 0.24;
      const bv = 0.78 + rng() * 0.36;

      if (emitVisuals && outCounters.nBoulder < CAP_BOULDER) {
        dummyObj.position.set(wx, y - rScale * 0.46, wz);
        dummyObj.rotation.set(rotX, rotY, rotZ);
        dummyObj.scale.set(rScale, scaleY, scaleZ);
        dummyObj.updateMatrix();
        imBoulder.setMatrixAt(outCounters.nBoulder, dummyObj.matrix);
        tmpColor.setRGB(bv, bv * 1.02, bv * 1.05);
        imBoulder.setColorAt(outCounters.nBoulder, tmpColor);
        outCounters.nBoulder++;
      }

      const protrudeH = 0.92 * scaleY - rScale * 0.46;
      if (protrudeH > 0.20) {
        const yNorm = Math.max(-0.85, Math.min(0.85, ((0.46 * rScale) / Math.max(0.1, scaleY) - 0.28) / 0.64));
        const sliceF = Math.sqrt(Math.max(0.36, 1.0 - yNorm * yNorm * 0.65));
        const rx = 1.14 * rScale * sliceF;
        const rz = 0.94 * scaleZ * sliceF;
        outColliders.push({
          x: wx, z: wz, r: Math.max(rx, rz), rx, rz, yaw: rotY, kind: 'boulder', height: protrudeH,
        });
      }
    }

    // --- 2d. Fallen Mossy Nurse Logs & Weathered Tree Stumps ---
    for (let l = 0; l < 6; l++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 3.0) || isInsideSouthRect(wx, wz, 4.0)) continue;
      if (isOnBridge(wx, wz, 5.2)) continue;
      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 3.2) continue;
      const rv = evalMainRiver(wz);
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.42 + 6.0) continue;
      const rw = evalRegionWeights(wx, wz);
      if (rw.meadow + rw.wetland > 0.68) continue;
      const y = getGroundY(wx, wz);
      if (TERRENO_WORLD.baseElevationASL + y > 960) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 2.0);
      if (nrm.slope > 0.34) continue;

      const sc = 0.75 + rng() * 0.85;
      const logYaw = rng() * Math.PI * 2;
      const logTilt = (rng() - 0.5) * 0.10;
      const lv = 0.78 + rng() * 0.32;

      if (emitVisuals && outCounters.nLog < CAP_LOG) {
        dummyObj.position.set(wx, y - 0.04, wz);
        dummyObj.rotation.set(0, logYaw, logTilt);
        dummyObj.scale.set(sc, sc, sc);
        dummyObj.updateMatrix();
        imLog.setMatrixAt(outCounters.nLog, dummyObj.matrix);
        tmpColor.setRGB(lv, lv * 0.96, lv * 0.90);
        imLog.setColorAt(outCounters.nLog, tmpColor);
        outCounters.nLog++;
      }

      const halfLen = 2.04 * sc;
      const cosY = Math.cos(logYaw);
      const sinY = Math.sin(logYaw);
      outColliders.push({
        x: wx, z: wz,
        ax: wx - cosY * halfLen, az: wz + sinY * halfLen,
        bx: wx + cosY * halfLen, bz: wz - sinY * halfLen,
        r: sc * 0.27, kind: 'log', height: sc * 0.42,
      });
    }

    for (let st = 0; st < 7; st++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 1.5) || isInsideSouthRect(wx, wz, 3.0)) continue;
      if (isOnBridge(wx, wz, 4.5)) continue;
      const rq = geomorph.roadIndex.queryDist(wx, wz);
      if (rq.dist < rq.width * 0.5 + 2.4) continue;
      const rv = evalMainRiver(wz);
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.25 + 4.0) continue;
      const y = getGroundY(wx, wz);
      if (TERRENO_WORLD.baseElevationASL + y > 950) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 1.6);
      if (nrm.slope > 0.45) continue;

      const sc = 0.65 + rng() * 0.85;
      const rotY = rng() * Math.PI * 2;
      const sv = 0.74 + rng() * 0.30;
      if (emitVisuals && outCounters.nStump < CAP_STUMP) {
        dummyObj.position.set(wx, y - 0.08, wz);
        dummyObj.rotation.set(nrm.z * 0.25, rotY, -nrm.x * 0.25);
        dummyObj.scale.set(sc, sc * (0.7 + rng() * 0.45), sc);
        dummyObj.updateMatrix();
        imStump.setMatrixAt(outCounters.nStump, dummyObj.matrix);
        tmpColor.setRGB(sv, sv * 0.92, sv * 0.84);
        imStump.setColorAt(outCounters.nStump, tmpColor);
        outCounters.nStump++;
      }
      outColliders.push({ x: wx, z: wz, r: sc * 0.52, kind: 'tree', height: sc * 0.9 });
    }
  }

  function rebuildNearForest(centerTx, centerTz) {
    const counters = {
      nSugi: 0, nHinoki: 0, nBuna: 0, nMaple: 0, nBirch: 0, nPine: 0, nWillow: 0,
      nShrub: 0, nStump: 0, nFern: 0, nBoulder: 0, nLog: 0,
    };
    const newColliders = [];

    for (let dtz = -NEAR_TILE_RADIUS; dtz <= NEAR_TILE_RADIUS; dtz++) {
      for (let dtx = -NEAR_TILE_RADIUS; dtx <= NEAR_TILE_RADIUS; dtx++) {
        const tx = centerTx + dtx;
        const tz = centerTz + dtz;
        const isDetailTile = Math.abs(dtx) <= DETAIL_TILE_RADIUS && Math.abs(dtz) <= DETAIL_TILE_RADIUS;
        generateNearTile(tx, tz, isDetailTile, true, counters, newColliders);
      }
    }

    imSugiTrunk.count   = counters.nSugi;
    imSugiLeaf.count    = counters.nSugi;
    imHinokiTrunk.count = counters.nHinoki;
    imHinokiLeaf.count  = counters.nHinoki;
    imBunaTrunk.count   = counters.nBuna;
    imBunaLeaf.count    = counters.nBuna;
    imMapleTrunk.count  = counters.nMaple;
    imMapleLeaf.count   = counters.nMaple;
    imBirchTrunk.count  = counters.nBirch;
    imBirchLeaf.count   = counters.nBirch;
    imPineTrunk.count   = counters.nPine;
    imPineLeaf.count    = counters.nPine;
    imWillowTrunk.count = counters.nWillow;
    imWillowLeaf.count  = counters.nWillow;
    imShrub.count       = counters.nShrub;
    imStump.count       = counters.nStump;
    imFern.count        = counters.nFern;
    imBoulder.count     = counters.nBoulder;
    imLog.count         = counters.nLog;

    [
      imSugiTrunk, imSugiLeaf, imHinokiTrunk, imHinokiLeaf,
      imBunaTrunk, imBunaLeaf, imMapleTrunk, imMapleLeaf,
      imBirchTrunk, imBirchLeaf, imPineTrunk, imPineLeaf,
      imWillowTrunk, imWillowLeaf, imShrub, imStump, imFern, imBoulder, imLog,
    ].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });

    localColliders = newColliders;
    syncMergedColliders();
    stats.sugi = counters.nSugi;
    stats.hinoki = counters.nHinoki;
    stats.abies = counters.nHinoki; // backwards-compatible stats key
    stats.buna = counters.nBuna;
    stats.maple = counters.nMaple;
    stats.birch = counters.nBirch;
    stats.pine = counters.nPine;
    stats.willow = counters.nWillow;
    stats.shrubs = counters.nShrub;
    stats.stumps = counters.nStump;
    stats.ferns = counters.nFern;
    stats.boulders = counters.nBoulder;
    stats.logs = counters.nLog;
  }

  function rebuildGroundCover(centerGx, centerGz) {
    let nGrass = 0, nSasa = 0;
    const newShrubCols = [];

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

        // 1. Wild Grass, Prairie Susuki & Forest Sedge
        for (let i = 0; i < 350 && nGrass < CAP_GRASS; i++) {
          const wx = tileX0 + rng() * GROUND_TILE_SIZE;
          const wz = tileZ0 + rng() * GROUND_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 6 || wx > TERRENO_WORLD.maxX - 6 || wz < TERRENO_WORLD.minZ + 6 || wz > TERRENO_WORLD.maxZ - 6) continue;
          if (isInsideCompoundPaving(wx, wz) || isInsideSouthRect(wx, wz, 1.5)) continue;
          if (isOnBridge(wx, wz, 2.2)) continue;

          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < rq.width * 0.5 + 0.5) continue;

          const rv = evalMainRiver(wz);
          const y = getGroundY(wx, wz);
          if (TERRENO_WORLD.baseElevationASL + y > 1120) continue;
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.12 || y < rv.waterY + 0.16) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 1.2);
          if (nrm.slope > 0.62) continue;

          const rw = evalRegionWeights(wx, wz);
          const inOuterYard = isInsideCompoundClearing(wx, wz, 2.0);
          const prairieTall = 1.0 + rw.meadow * 0.55 + rw.wetland * 0.42;
          const scXZ = inOuterYard ? (0.48 + rng() * 0.45) : (0.78 + rng() * 1.05);
          const scY  = inOuterYard ? (0.36 + rng() * 0.36) : (0.72 + rng() * 0.95) * prairieTall;

          dummyObj.position.set(wx, y - 0.04, wz);
          dummyObj.rotation.set(nrm.z * 0.38, rng() * Math.PI * 2.0, -nrm.x * 0.38);
          dummyObj.scale.set(scXZ, scY, scXZ);
          dummyObj.updateMatrix();
          imGrass.setMatrixAt(nGrass, dummyObj.matrix);

          const v = rng();
          const goldMix = rw.meadow * 0.85 + rw.southPlain * 0.35;
          const rCol = (0.14 + v * 0.13) * (1 - goldMix) + (0.28 + v * 0.16) * goldMix;
          const gCol = (0.18 + v * 0.13) * (1 - goldMix) + (0.25 + v * 0.14) * goldMix;
          const bCol = (0.11 + v * 0.07) * (1 - goldMix) + (0.11 + v * 0.06) * goldMix;
          tmpColor.setRGB(rCol, gCol, bCol);
          imGrass.setColorAt(nGrass, tmpColor);
          nGrass++;
        }

        // 2. Kumazasa Bamboo & Dense Wetland Reed Thickets
        for (let i = 0; i < 130 && nSasa < CAP_SASA; i++) {
          const wx = tileX0 + rng() * GROUND_TILE_SIZE;
          const wz = tileZ0 + rng() * GROUND_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, -0.5) || isInsideSouthRect(wx, wz, 1.5)) continue;
          if (isOnBridge(wx, wz, 2.6)) continue;

          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < rq.width * 0.5 + 0.9) continue;

          const rv = evalMainRiver(wz);
          const y = getGroundY(wx, wz);
          if (TERRENO_WORLD.baseElevationASL + y > 1060) continue;
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.16 || y < rv.waterY + 0.25) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 1.4);
          if (nrm.slope > 0.58) continue;

          const rw = evalRegionWeights(wx, wz);
          const cluster = Math.sin(wx * 0.11 + wz * 0.09) * Math.cos(wx * 0.07 - wz * 0.13);
          if (cluster < -0.15 && rw.wetland < 0.35) continue;

          const sc = 0.72 + rng() * 0.92;
          const scY = sc * (0.78 + rng() * 0.42 + rw.wetland * 0.35);
          dummyObj.position.set(wx, y - 0.05, wz);
          dummyObj.rotation.set(nrm.z * 0.32, rng() * Math.PI * 2.0, -nrm.x * 0.32);
          dummyObj.scale.set(sc, scY, sc);
          dummyObj.updateMatrix();
          imSasa.setMatrixAt(nSasa, dummyObj.matrix);

          const v = rng();
          tmpColor.setRGB(0.19 + v * 0.15, 0.22 + v * 0.15, 0.15 + v * 0.09);
          imSasa.setColorAt(nSasa, tmpColor);
          nSasa++;

          if (sc >= 1.25 && Math.abs(dgx) <= 1 && Math.abs(dgz) <= 1) {
            newShrubCols.push({ x: wx, z: wz, r: sc * 0.24, kind: 'shrub', height: scY * 0.75 });
          }
        }
      }
    }

    imGrass.count = nGrass;
    imSasa.count = nSasa;
    imGrass.instanceMatrix.needsUpdate = true;
    imGrass.instanceColor.needsUpdate = true;
    imSasa.instanceMatrix.needsUpdate = true;
    imSasa.instanceColor.needsUpdate = true;
    localShrubColliders = newShrubCols;
    syncMergedColliders();
    stats.grass = nGrass;
    stats.sasa = nSasa;
  }

  // 4-Species Mid-Distance Botanical Impostor Canopy across valley & mountain walls (160m..1,780m)
  function rebuildMidImpostors(centerTx, centerTz) {
    let nCon = 0, nBrd = 0, nMap = 0, nPin = 0;

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
        for (let k = 0; k < 24; k++) {
          const wx = tileX0 + rng() * MID_TILE_SIZE;
          const wz = tileZ0 + rng() * MID_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 10 || wx > TERRENO_WORLD.maxX - 10 || wz < TERRENO_WORLD.minZ + 10 || wz > TERRENO_WORLD.maxZ - 10) continue;
          if (isInsideCompoundClearing(wx, wz, 2.0) || isInsideSouthRect(wx, wz, 6.0)) continue;
          if (isOnBridge(wx, wz, 7.0)) continue;

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          if (geo.roadPad > 0.28) continue;
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth * 1.45 + 6.0) continue;

          const y = getGroundY(wx, wz);
          const rw = evalRegionWeights(wx, wz);
          if (rng() > evalForestKeepProb(wx, wz, y, rw)) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 4.0);
          if (nrm.slope > 0.74) continue;

          const sp = pickUplandSpecies(wx, wz, y, nrm.slope, rw, rng());
          const elevASL = TERRENO_WORLD.baseElevationASL + y;
          const alpineShrink = elevASL > 900 ? Math.max(0.45, 1.0 - (elevASL - 900) / 360.0) : 1.0;
          const h = (18.5 + rng() * 16.5) * alpineShrink;
          const wS = h * (1.06 + rng() * 0.36);

          dummyObj.position.set(wx, y - 2.6, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
          dummyObj.scale.set(wS, h, wS);
          dummyObj.updateMatrix();

          const v = rng();
          if ((sp === 0 || sp === 1) && nCon < CAP_MID_CONIFER) {
            imMidConifer.setMatrixAt(nCon, dummyObj.matrix);
            tmpColor.setRGB(0.10 + v * 0.07, 0.125 + v * 0.07, 0.12 + v * 0.06);
            imMidConifer.setColorAt(nCon, tmpColor);
            nCon++;
          } else if (sp === 2 && nBrd < CAP_MID_BROAD) {
            imMidBroad.setMatrixAt(nBrd, dummyObj.matrix);
            tmpColor.setRGB(0.14 + v * 0.13, 0.19 + v * 0.12, 0.12 + v * 0.07);
            imMidBroad.setColorAt(nBrd, tmpColor);
            nBrd++;
          } else if ((sp === 3 || sp === 4) && nMap < CAP_MID_MAPLE) {
            imMidMaple.setMatrixAt(nMap, dummyObj.matrix);
            if (sp === 3) {
              if (v < 0.45) tmpColor.setRGB(0.28 + v * 0.18, 0.065, 0.032);
              else if (v < 0.78) tmpColor.setRGB(0.30, 0.17, 0.045);
              else tmpColor.setRGB(0.12, 0.19, 0.08);
            } else {
              // Luminous birch green / gold accent across distant slopes
              tmpColor.setRGB(0.21 + v * 0.12, 0.25 + v * 0.08, 0.12);
            }
            imMidMaple.setColorAt(nMap, tmpColor);
            nMap++;
          } else if (nPin < CAP_MID_PINE) {
            imMidPine.setMatrixAt(nPin, dummyObj.matrix);
            tmpColor.setRGB(0.13 + v * 0.07, 0.16 + v * 0.07, 0.12 + v * 0.06);
            imMidPine.setColorAt(nPin, tmpColor);
            nPin++;
          }
        }
      }
    }

    imMidConifer.count = nCon;
    imMidBroad.count   = nBrd;
    imMidMaple.count   = nMap;
    imMidPine.count    = nPin;
    [imMidConifer, imMidBroad, imMidMaple, imMidPine].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    });

    stats.midConifers = nCon;
    stats.midBroad = nBrd;
    stats.midMaple = nMap;
    stats.midPine = nPin;
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

  function getCollidersNear(wx, wz) {
    const ntx = Math.floor(wx / NEAR_TILE_SIZE);
    const ntz = Math.floor(wz / NEAR_TILE_SIZE);
    if (Math.abs(ntx - lastNearTx) <= DETAIL_TILE_RADIUS && Math.abs(ntz - lastNearTz) <= DETAIL_TILE_RADIUS) {
      return mergedLocalColliders;
    }
    const cacheKey = `${ntx},${ntz}`;
    let cached = remoteTileColliderCache.get(cacheKey);
    if (!cached) {
      cached = [];
      const dummyC = {
        nSugi: 0, nHinoki: 0, nBuna: 0, nMaple: 0, nBirch: 0, nPine: 0, nWillow: 0,
        nShrub: 0, nStump: 0, nFern: 0, nBoulder: 0, nLog: 0,
      };
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          generateNearTile(ntx + dx, ntz + dz, true, false, dummyC, cached);
        }
      }
      if (remoteTileColliderCache.size > 36) {
        const firstKey = remoteTileColliderCache.keys().next().value;
        remoteTileColliderCache.delete(firstKey);
      }
      remoteTileColliderCache.set(cacheKey, cached);
    }
    return cached;
  }

  function ensureCollidersAt(wx, wz) {
    return getCollidersNear(wx, wz);
  }

  function setSurfaceSuper(enabled, maxAniso = 8) {
    const aniso = enabled ? Math.min(16, maxAniso) : 4;
    [foliageAtlas, barkTex, birchBarkTex, pineBarkTex].forEach((t) => {
      if (t) { t.anisotropy = aniso; t.needsUpdate = true; }
    });
  }

  function getLocalColliders() {
    return mergedLocalColliders;
  }

  function getStats() {
    return { ...stats };
  }

  return {
    group,
    update,
    ensureCollidersAt,
    getCollidersNear,
    setSurfaceSuper,
    getLocalColliders,
    getStats,
  };
}
