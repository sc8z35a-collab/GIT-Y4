import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import { evalClosestTributary } from './terrenoGeomorphology.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO 3.0 Engine — Photorealistic Real-World Mountain-Valley Clipmap Renderer:
 *   - 14-Ring Crack-Free GPU Geomorphing Geometry Clipmaps (0.5m underfoot -> 60km mountain horizon)
 *   - Dynamic High-Resolution Local Road, Riverbank & Tributary Detail Map (2m/texel linear -> razor-sharp
 *     mountain forestry roads with twin wheel tracks, mossy verges & wet river cobble beaches — ZERO 58m blur!)
 *   - 4 Toroidal 512×512 PBR Albedo+Height Textures (Old-Growth Forest Humus, Stratified Alps Granite,
 *     Crushed Macadam/Cobbles, Sunlit Mountain Meadow) + 5/8-Step Steep POM + Micro Self-Shadowing
 *   - 5-Octave Inigo Quilez Analytical-Derivative Swiss-Turbulence Alpine Erosion (fbmDeriv)
 *   - True 3-Axis Triplanar Stratified Granite Cliffs + Mossy Rock Ledges + North-Facing Snow Couloirs (残雪)
 *   - Rich Multi-Species Mountain Forest Canopy Mosaic (Sugi, Hinoki, Buna, Crimson Momiji, White Birch, Pine)
 */

const CLIPMAP_HALF = 28;
const CLIPMAP_LEVELS = 14;
const LOCAL_DETAIL_RES = 256;       // 256×256 RGBA8 = 65k texels (<1.5ms bake on mobile!)
const LOCAL_DETAIL_SPAN = 512.0;    // 512m × 512m window centered around player = 2.0m/texel crisp bilinear!

function makeSeededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function qSmoothCpu(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Generate ultra-crisp 512×512 seamless toroidal PBR Albedo(RGB) + MicroHeight(A) CanvasTextures!
 */
function createSeamlessPbrTexture(kind) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const seedMap = { forest: 104729, rock: 224737, gravel: 350377, meadow: 491531 };
  const rand = makeSeededRand(seedMap[kind] || 104729);

  const makeGrid = (g) => {
    const arr = new Float32Array(g * g);
    for (let i = 0; i < arr.length; i++) arr[i] = rand();
    return { g, arr };
  };
  const g1 = makeGrid(8);
  const g2 = makeGrid(16);
  const g3 = makeGrid(32);
  const g4 = makeGrid(64);
  const g5 = makeGrid(128);
  const g6 = makeGrid(256);

  const samplePeriodic = (grid, u, v) => {
    const g = grid.g;
    const x = u * g;
    const y = v * g;
    const x0 = Math.floor(x) % g;
    const y0 = Math.floor(y) % g;
    const x1 = (x0 + 1) % g;
    const y1 = (y0 + 1) % g;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fy * fy * (3 - 2 * fy);
    const a = grid.arr[y0 * g + x0];
    const b = grid.arr[y0 * g + x1];
    const c = grid.arr[y1 * g + x0];
    const e = grid.arr[y1 * g + x1];
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + e) * ux * uz;
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = samplePeriodic(g1, u, v);
      const n2 = samplePeriodic(g2, u, v);
      const n3 = samplePeriodic(g3, u, v);
      const n4 = samplePeriodic(g4, u, v);
      const n5 = samplePeriodic(g5, u, v);
      const n6 = samplePeriodic(g6, u, v);
      const fbm = n1 * 0.28 + n2 * 0.24 + n3 * 0.20 + n4 * 0.14 + n5 * 0.09 + n6 * 0.05;

      let r = 0, g = 0, b = 0, h = fbm;
      if (kind === 'forest') {
        // Real Yakushima / Kamikochi old-growth forest floor: rich humus loam, thick velvety moss mats,
        // warm amber fallen cedar needles, scattered crimson/gold maple leaves, & exposed tiny pebbles
        const mossPatch = clamp01((n1 * 0.44 + n2 * 0.34 + n3 * 0.22 - 0.36) * 3.1);
        const needleMat = clamp01((n4 * 0.50 + n5 * 0.32 + n6 * 0.18 - 0.49) * 3.4);
        const fallenLeaf = clamp01((n3 * 0.42 + n5 * 0.58 - 0.68) * 4.2);
        const pebbleSpeck = Math.max(0, (n5 * 0.6 + n6 * 0.4 - 0.74) * 3.8);
        const grain = (n6 - 0.5) * 34.0;

        const soilR = 46 + fbm * 32 + grain * 0.7;
        const soilG = 38 + fbm * 25 + grain * 0.6;
        const soilB = 26 + fbm * 17 + grain * 0.4;
        const mossR = 36 + n3 * 28 + n5 * 14 + grain * 0.5;
        const mossG = 72 + n2 * 44 + n4 * 22 + grain * 0.8;
        const mossB = 26 + n3 * 16 + grain * 0.4;

        r = soilR * (1 - mossPatch) + mossR * mossPatch + needleMat * 46 + fallenLeaf * 58 + pebbleSpeck * 44;
        g = soilG * (1 - mossPatch) + mossG * mossPatch + needleMat * 24 + fallenLeaf * 24 + pebbleSpeck * 42;
        b = soilB * (1 - mossPatch) + mossB * mossPatch + needleMat * 6  + fallenLeaf * 8  + pebbleSpeck * 38;
        h = clamp01(fbm * 0.48 + mossPatch * 0.26 + needleMat * 0.14 + fallenLeaf * 0.08 + n6 * 0.12);
      } else if (kind === 'rock') {
        // Sharp Stratified Japanese Northern Alps Granite & Andesite with crystalline quartz & lichen
        const ridge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
        const crack1 = Math.pow(1.0 - Math.abs(n3 * 2.0 - 1.0), 4.6);
        const crack2 = Math.pow(1.0 - Math.abs(n4 * 2.0 - 1.0), 5.2);
        const strata = Math.sin((v * 8.0 + n1 * 0.65 + n2 * 0.30) * Math.PI * 2.0) * 0.5 + 0.5;
        const base = 74 + fbm * 58 + strata * 28 - crack1 * 58 - crack2 * 36;
        const quartz = (n5 - 0.5) * 34 + (n6 - 0.5) * 46;
        const lichen = Math.max(0, (n1 * 0.52 + n3 * 0.48 - 0.66) * 3.4);
        r = base + quartz + lichen * 24;
        g = base + quartz * 0.96 + 3 + lichen * 38;
        b = base + quartz * 0.92 + 6 + lichen * 14;
        h = clamp01(0.42 + ridge * 0.36 + strata * 0.18 - crack1 * 0.50 - crack2 * 0.24 + (n6 - 0.5) * 0.14);
      } else if (kind === 'meadow') {
        // Lush Sunlit Mountain Wild Grass Turf, Clover & Dry Golden Susuki Blades (high POM depth!)
        const blade = Math.pow(1.0 - Math.abs(n5 * 2.0 - 1.0), 1.4) * 0.55 + n6 * 0.45;
        const clover = clamp01((n2 * 0.55 + n3 * 0.45 - 0.44) * 3.0);
        const dryThatch = clamp01((n1 * 0.48 + n4 * 0.52 - 0.58) * 3.2);
        const grain = (n6 - 0.5) * 28;
        r = 62 + blade * 32 - clover * 14 + dryThatch * 56 + grain * 0.6;
        g = 96 + blade * 46 + clover * 24 + dryThatch * 28 + grain * 0.8;
        b = 34 + blade * 16 - clover * 6  + dryThatch * 12 + grain * 0.4;
        h = clamp01(0.24 + blade * 0.54 + clover * 0.14 + fbm * 0.16);
      } else {
        // Sharp Crushed Macadam Forestry Road Gravel & Angular River Cobbles (high POM contrast!)
        const cobbleA = Math.pow(1.0 - Math.abs(n4 * 2.0 - 1.0), 1.65);
        const cobbleB = Math.pow(n5 * 0.55 + n6 * 0.45, 1.35);
        const dust = n1 * 0.48 + n2 * 0.52;
        const pebbleH = cobbleA * 0.54 + cobbleB * 0.46;
        const base = 86 + dust * 36 + (pebbleH - 0.42) * 96 + (n6 - 0.5) * 38;
        r = base + 8;
        g = base + 5;
        b = base - 2;
        h = clamp01(0.24 + pebbleH * 0.66 + dust * 0.10);
      }

      const idx = (y * size + x) * 4;
      d[idx] = Math.max(0, Math.min(255, Math.round(r)));
      d[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      d[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      d[idx + 3] = Math.max(0, Math.min(255, Math.round(h * 255)));
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function buildClipmapRingGeometry(half, solid) {
  const minG = -half;
  const maxG = half;
  const holeMin = -half / 2;
  const holeMax = half / 2 + 1;
  const positions = [];
  const indices = [];
  const vMap = new Int32Array((2 * half + 1) * (2 * half + 1)).fill(-1);
  const stride = 2 * half + 1;

  const getVert = (gx, gz) => {
    const key = (gz - minG) * stride + (gx - minG);
    let idx = vMap[key];
    if (idx === -1) {
      idx = positions.length / 3;
      positions.push(gx, 0, gz);
      vMap[key] = idx;
    }
    return idx;
  };

  for (let gz = minG; gz < maxG; gz++) {
    for (let gx = minG; gx < maxG; gx++) {
      if (!solid) {
        if (gx >= holeMin && gx < holeMax && gz >= holeMin && gz < holeMax) continue;
      }
      const a = getVert(gx, gz);
      const b = getVert(gx + 1, gz);
      const c = getVert(gx, gz + 1);
      const d = getVert(gx + 1, gz + 1);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function buildClipmapLTrimGeometry(half, ox, oz) {
  const holeMin = -half / 2;
  const holeMax = half / 2 + 1;
  const innerMinX = holeMin + ox;
  const innerMaxX = innerMinX + half;
  const innerMinZ = holeMin + oz;
  const innerMaxZ = innerMinZ + half;

  const positions = [];
  const indices = [];
  const stride = (holeMax - holeMin) + 1;
  const vMap = new Int32Array(stride * stride).fill(-1);

  const getVert = (gx, gz) => {
    const key = (gz - holeMin) * stride + (gx - holeMin);
    let idx = vMap[key];
    if (idx === -1) {
      idx = positions.length / 3;
      positions.push(gx, 0, gz);
      vMap[key] = idx;
    }
    return idx;
  };

  for (let gz = holeMin; gz < holeMax; gz++) {
    for (let gx = holeMin; gx < holeMax; gx++) {
      if (gx >= innerMinX && gx < innerMaxX && gz >= innerMinZ && gz < innerMaxZ) continue;
      const a = getVert(gx, gz);
      const b = getVert(gx + 1, gz);
      const c = getVert(gx, gz + 1);
      const d = getVert(gx + 1, gz + 1);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uGeoMap;
uniform sampler2D uLocalDetailMap;
uniform vec2 uLocalDetailMin;
uniform float uLocalDetailSpan;
uniform vec2 uWorldMin;
uniform vec2 uWorldMax;
uniform vec2 uWorldSize;
uniform vec2 uAtlasSize;
uniform vec2 uRingOrigin;
uniform float uGridStep;
uniform float uHalfExtent;
uniform float uMorphEnable;
uniform vec2 uCompoundCenter;
uniform float uCompoundFlatR;
uniform float uCompoundGroundY;
uniform vec2 uVillageCenter;
uniform float uVillageFlatR;
uniform float uVillageGroundY;
uniform float uBaseElevationASL;
uniform vec4 uSouthRect;
uniform float uSouthRectY;
uniform float uSouthRectBlend;

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

float sinHash2(vec2 p) {
  return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123);
}

float glslNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sinHash2(i);
  float b = sinHash2(i + vec2(1.0, 0.0));
  float c = sinHash2(i + vec2(0.0, 1.0));
  float d = sinHash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 1:1 BIT-IDENTICAL to terrenoGeomorphology.js evalSharedMicroRelief!
float evalSharedMicroRelief(vec2 xz, float suppressFactor) {
  if (suppressFactor >= 0.999) return 0.0;
  float swell = glslNoise(xz * 0.015 + vec2(-4.2, 11.8)) - 0.5;
  float n1 = glslNoise(xz * 0.046) - 0.5;
  float n2 = glslNoise(xz * 0.145 + vec2(19.3, -7.1)) - 0.5;
  float hummock = glslNoise(xz * 0.34 + vec2(-11.1, 6.4)) - 0.5;
  float micro = swell * 1.15 + n1 * 0.62 + n2 * 0.22 + hummock * 0.08;
  return micro * (1.0 - suppressFactor);
}

float evalSouthRectWeight(vec2 xz) {
  vec2 d = max(max(uSouthRect.xz - xz, xz - uSouthRect.yw), vec2(0.0));
  float dist = length(d);
  float t = clamp(dist / max(uSouthRectBlend, 0.001), 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec4 sampleGeoBilinear(vec2 xz) {
  vec2 gridPos = ((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0);
  gridPos = clamp(gridPos, vec2(0.0), uAtlasSize - 1.0001);
  vec2 i0 = floor(gridPos);
  vec2 f = gridPos - i0;
  vec2 invS = 1.0 / uAtlasSize;
  vec4 c00 = texture2D(uGeoMap, (i0 + vec2(0.5, 0.5)) * invS);
  vec4 c10 = texture2D(uGeoMap, (i0 + vec2(1.5, 0.5)) * invS);
  vec4 c01 = texture2D(uGeoMap, (i0 + vec2(0.5, 1.5)) * invS);
  vec4 c11 = texture2D(uGeoMap, (i0 + vec2(1.5, 1.5)) * invS);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

void main() {
  // 1. Crack-Free Outer 22% Odd-Vertex Horizontal Geomorphing
  vec2 g = position.xz;
  float edgeFrac = max(abs(g.x), abs(g.y)) / uHalfExtent;
  float morph = smoothstep(0.76, 0.995, edgeFrac) * uMorphEnable;
  vec2 odd = abs(mod(g, 2.0));
  vec2 gMorphed = g - odd * morph;

  vec2 xz = uRingOrigin + gMorphed * uGridStep;

  // 2. Sample Geomorphology Atlas + Exact High-Res Local Road Suppression + Shared Micro-Relief
  vec4 geo = sampleGeoBilinear(xz);
  float localRoadSup = 0.0;
  vec2 locUv = (xz - uLocalDetailMin) / uLocalDetailSpan;
  if (locUv.x > 0.02 && locUv.x < 0.98 && locUv.y > 0.02 && locUv.y < 0.98) {
    localRoadSup = texture2D(uLocalDetailMap, locUv).a;
  }
  float suppress = max(geo.a, localRoadSup);
  float y = geo.r + evalSharedMicroRelief(xz, suppress);

  float dComp = length(xz - uCompoundCenter);
  float dVill = length(xz - uVillageCenter);
  if (dComp <= uCompoundFlatR - 2.0) {
    y = uCompoundGroundY;
  } else if (dVill <= uVillageFlatR - 2.0) {
    y = uVillageGroundY;
  } else {
    float sW = evalSouthRectWeight(xz);
    if (sW > 0.0001) {
      y = mix(y, uSouthRectY, sW);
    }
  }

  // 3. Majestic Distant Mountain Range Horizon Skirt beyond 60 km × 60 km world rim
  vec2 over = max(vec2(0.0), max(uWorldMin - xz, xz - uWorldMax));
  float outDist = length(over);
  if (outDist > 0.0) {
    float farRange = (abs(sin(xz.x * 0.00028 + 0.7) * cos(xz.y * 0.00026 - 0.4)) * 220.0
                    + abs(sin((xz.x - xz.y) * 0.00019)) * 140.0) * smoothstep(0.0, 4200.0, outDist);
    float skirtDrop = smoothstep(4500.0, 22000.0, outDist) * 180.0;
    y = y + farRange - skirtDrop;
  }

  vec3 worldPos = vec3(xz.x, y, xz.y);
  vWorldPos = worldPos;
  vGeo = geo;
  vOutRim = smoothstep(0.0, 1400.0, outDist);
  vCamDist = length(worldPos - cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uGeoMap;
uniform sampler2D uHorizonMap;
uniform sampler2D uLocalDetailMap;
uniform vec2 uLocalDetailMin;
uniform float uLocalDetailSpan;
uniform sampler2D uTexForest;
uniform sampler2D uTexRock;
uniform sampler2D uTexGravel;
uniform sampler2D uTexMeadow;

uniform vec2 uWorldMin;
uniform vec2 uWorldMax;
uniform vec2 uWorldSize;
uniform vec2 uAtlasSize;
uniform vec2 uCompoundCenter;
uniform vec2 uVillageCenter;
uniform float uBaseElevationASL;
uniform float uSurfaceSuper;
uniform vec4 uSouthRect;
uniform float uSouthRectY;
uniform float uSouthRectBlend;

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;
#include <logdepthbuf_pars_fragment>

float sinHash2(vec2 p) {
  return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123);
}

float glslNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = sinHash2(i);
  float b = sinHash2(i + vec2(1.0, 0.0));
  float c = sinHash2(i + vec2(0.0, 1.0));
  float d = sinHash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 noiseDeriv(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  float a = sinHash2(i);
  float b = sinHash2(i + vec2(1.0, 0.0));
  float c = sinHash2(i + vec2(0.0, 1.0));
  float d = sinHash2(i + vec2(1.0, 1.0));

  float k0 = a;
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;

  float val = k0 + k1 * u.x + k2 * u.y + k4 * u.x * u.y;
  vec2 grad = du * vec2(k1 + k4 * u.y, k2 + k4 * u.x);
  return vec3(val, grad);
}

// 5-Octave Analytical-Derivative Swiss-Turbulence Alpine Erosion (crisp ridges at EVERY distance!)
vec3 evalAlpineHyperDetail(vec2 xz, float camDist) {
  const mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  const mat2 rotT = mat2(0.80, 0.60, -0.60, 0.80);
  vec2 p = xz * 0.0115;
  mat2 mRot = mat2(1.0, 0.0, 0.0, 1.0);

  float sum = 0.0;
  float amp = 0.56;
  float freq = 1.0;
  vec2 dSum = vec2(0.0);

  float nyquistCutoff = 1.0 / max(1.0, camDist * 0.0020);

  for (int i = 0; i < 5; i++) {
    float octFade = clamp(nyquistCutoff / max(freq * 0.26, 0.001), 0.0, 1.0);
    if (octFade <= 0.02) break;

    vec3 n = noiseDeriv(p + dSum * 0.16);
    float s = n.x * 2.0 - 1.0;
    float ridgeVal = 1.0 - abs(s);
    float ridgeSharp = ridgeVal * ridgeVal;
    float dSign = s >= 0.0 ? -1.0 : 1.0;
    vec2 gLocal = n.yz * (4.0 * ridgeVal * dSign);
    vec2 gWorld = (mRot * gLocal) * (freq * 0.0115);

    float erodeWeight = 1.0 / (1.0 + dot(dSum, dSum) * 16.0);
    sum += amp * ridgeSharp * erodeWeight * octFade;
    dSum += amp * gWorld * erodeWeight * octFade;

    p = rot * p * 2.06 + vec2(17.3, -23.9);
    mRot = mRot * rotT;
    freq *= 2.06;
    amp *= 0.49;
  }

  return vec3(sum, dSum);
}

float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * glslNoise(p);
    p = rot * p * 2.04 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

float evalSharedMicroRelief(vec2 xz, float suppressFactor) {
  if (suppressFactor >= 0.999) return 0.0;
  float swell = glslNoise(xz * 0.015 + vec2(-4.2, 11.8)) - 0.5;
  float n1 = glslNoise(xz * 0.046) - 0.5;
  float n2 = glslNoise(xz * 0.145 + vec2(19.3, -7.1)) - 0.5;
  float hummock = glslNoise(xz * 0.34 + vec2(-11.1, 6.4)) - 0.5;
  float micro = swell * 1.15 + n1 * 0.62 + n2 * 0.22 + hummock * 0.08;
  return micro * (1.0 - suppressFactor);
}

float evalSouthRectWeight(vec2 xz) {
  vec2 d = max(max(uSouthRect.xz - xz, xz - uSouthRect.yw), vec2(0.0));
  float dist = length(d);
  float t = clamp(dist / max(uSouthRectBlend, 0.001), 0.0, 1.0);
  return 1.0 - t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float qSmooth(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void evalRegionWeightsGLSL(vec2 xz, out float wValley, out float wHills, out float wPlateau, out float wWetland, out float wMeadow, out float wSouthPlain) {
  float uX = xz.x + sin(xz.y * 0.00014 + 0.6) * 3600.0 + cos((xz.x + xz.y) * 0.00009) * 1900.0;
  float uZ = xz.y + cos(xz.x * 0.00013 - 0.8) * 3600.0 + sin((xz.x - xz.y) * 0.00008) * 1900.0;
  float rivX = 340.0 + sin(xz.y * 0.00016 + 0.18) * 2800.0 + sin(xz.y * 0.00042 - 0.55) * 950.0
             + cos(xz.y * 0.00009 + 0.35) * 1150.0 - 1205.0 * exp(-(xz.y * xz.y) / (2600.0 * 2600.0));
  float dxRiv = abs(xz.x - rivX);
  float dCenter = length(xz - vec2(400.0, 600.0));

  float v = exp(-(dxRiv * dxRiv) / (6800.0 * 6800.0)) * 0.95 + exp(-(dCenter * dCenter) / (6200.0 * 6200.0)) * 0.85 + 0.14;
  float hi = qSmooth(2800.0, -14500.0, uX) * qSmooth(13500.0, -7500.0, uZ);
  float pl = qSmooth(-1800.0, -17500.0, uZ) * qSmooth(-15000.0, 9500.0, uX);
  float we = qSmooth(2600.0, 15500.0, uX) * qSmooth(-18500.0, -3500.0, uZ) * qSmooth(20500.0, 6500.0, uZ);
  float me = qSmooth(10500.0, -8500.0, uX) * qSmooth(2000.0, 15500.0, uZ) * qSmooth(27500.0, 15000.0, uZ);
  float sp = qSmooth(11500.0, 23000.0, uZ);

  float inv = 1.0 / (v + hi + pl + we + me + sp + 1e-5);
  wValley = v * inv;
  wHills = hi * inv;
  wPlateau = pl * inv;
  wWetland = we * inv;
  wMeadow = me * inv;
  wSouthPlain = sp * inv;
}

vec4 sampleGeoBilinear(vec2 xz) {
  vec2 gridPos = ((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0);
  gridPos = clamp(gridPos, vec2(0.0), uAtlasSize - 1.0001);
  vec2 i0 = floor(gridPos);
  vec2 f = gridPos - i0;
  vec2 invS = 1.0 / uAtlasSize;
  vec4 c00 = texture2D(uGeoMap, (i0 + vec2(0.5, 0.5)) * invS);
  vec4 c10 = texture2D(uGeoMap, (i0 + vec2(1.5, 0.5)) * invS);
  vec4 c01 = texture2D(uGeoMap, (i0 + vec2(0.5, 1.5)) * invS);
  vec4 c11 = texture2D(uGeoMap, (i0 + vec2(1.5, 1.5)) * invS);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

float sampleExactHeight(vec2 xz, float microFade) {
  vec4 g = sampleGeoBilinear(xz);
  float h = g.r + evalSharedMicroRelief(xz, g.a) * microFade;
  float sW = evalSouthRectWeight(xz);
  if (sW > 0.0001) h = mix(h, uSouthRectY, sW);
  return h;
}

vec3 toLinear(vec3 srgb) {
  return pow(max(srgb, vec3(0.0001)), vec3(2.2));
}

vec4 sampleSeamlessPbr(sampler2D tex, vec2 uv, float macroBlend) {
  const mat2 rotA = mat2(0.798635, -0.601815, 0.601815, 0.798635);
  const mat2 rotB = mat2(0.874620,  0.484810, -0.484810, 0.874620);

  vec4 t1 = texture2D(tex, uv);
  vec4 t2 = texture2D(tex, rotA * (uv * 0.618034) + vec2(0.37, 0.71));
  vec4 t3 = texture2D(tex, rotB * (uv * 0.236068) + vec2(0.19, 0.53));

  float hW1 = pow(max(0.05, t1.a + 0.25), 2.2);
  float hW2 = pow(max(0.05, t2.a + 0.25), 2.2);
  vec4 nearMix = (t1 * hW1 + t2 * hW2) / (hW1 + hW2);
  vec4 finalTex = mix(nearMix, t3, clamp(macroBlend, 0.0, 0.75));
  finalTex.rgb = toLinear(finalTex.rgb);
  return finalTex;
}

vec2 computeTerrainPomUv(sampler2D tex, vec2 baseUv, vec3 V, float pomScale, float superMode) {
  if (pomScale <= 0.0005) return baseUv;
  vec2 deltaUv = (-V.xz / max(abs(V.y), 0.34)) * pomScale;
  float steps = superMode > 0.5 ? 8.0 : 5.0;
  float layerStep = 1.0 / steps;
  float curLayer = 0.0;
  vec2 stepUv = deltaUv * layerStep;
  vec2 curUv = baseUv;
  float curH = texture2D(tex, curUv).a;
  float prevH = curH;

  for (int i = 0; i < 8; i++) {
    if (float(i) >= steps || curLayer >= (1.0 - curH)) break;
    prevH = curH;
    curUv -= stepUv;
    curLayer += layerStep;
    curH = texture2D(tex, curUv).a;
  }

  float afterD = (1.0 - curH) - curLayer;
  float beforeD = (1.0 - prevH) - (curLayer - layerStep);
  float w = clamp(afterD / min(-0.0001, afterD - beforeD), 0.0, 1.0);
  return curUv + stepUv * w;
}

vec4 sampleTriplanarGranite(vec3 wp, vec3 N, float scale) {
  vec3 bw = abs(N);
  bw = bw * bw * bw * bw;
  bw /= max(bw.x + bw.y + bw.z, 0.0001);

  float tiltY = wp.y + wp.x * 0.16 - wp.z * 0.07;
  vec4 sx = texture2D(uTexRock, vec2(wp.z, tiltY) * scale);
  vec4 sy = texture2D(uTexRock, wp.xz * scale);
  vec4 sz = texture2D(uTexRock, vec2(wp.x, tiltY) * scale);
  vec4 rock = sx * bw.x + sy * bw.y + sz * bw.z;
  rock.rgb = toLinear(rock.rgb);

  float strata = sin(tiltY * 0.38 + fbm2(wp.xz * 0.032) * 3.0) * 0.5 + 0.5;
  float fineCracks = smoothstep(0.24, 0.74, fbm2(vec2(wp.x * 0.16 + wp.z * 0.14, tiltY * 0.24)));
  float seepage = smoothstep(0.52, 0.85, glslNoise(vec2(wp.x * 0.18 + wp.z * 0.15, tiltY * 0.02)));
  rock.rgb *= (0.56 + 0.42 * strata + 0.24 * fineCracks);
  rock.rgb = mix(rock.rgb, rock.rgb * vec3(0.38, 0.45, 0.40), seepage * 0.52);
  return rock;
}

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  // 0. Exact Basement & NULL EREA Launch Silo Cutouts
  if (vWorldPos.x > -0.16 && vWorldPos.x < 5.16 && vWorldPos.z > -0.16 && vWorldPos.z < 10.16) {
    discard;
  }
  if (vWorldPos.x > -10.02 && vWorldPos.x < 10.02 && vWorldPos.z > 29888.98 && vWorldPos.z < 29931.02) {
    discard;
  }
  if (vWorldPos.x > -26.22 && vWorldPos.x < -23.78 && vWorldPos.z > 29908.78 && vWorldPos.z < 29911.22) {
    discard;
  }

  vec2 xz = vWorldPos.xz;
  float dist = vCamDist;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(uSunDir);

  // 1. Per-Pixel Smooth World Normal
  float stepM = clamp(dist * 0.0064, 0.55, 24.0);
  float microFade = 1.0 - smoothstep(110.0, 440.0, dist);
  float hL = sampleExactHeight(xz - vec2(stepM, 0.0), microFade);
  float hR = sampleExactHeight(xz + vec2(stepM, 0.0), microFade);
  float hD = sampleExactHeight(xz - vec2(0.0, stepM), microFade);
  float hU = sampleExactHeight(xz + vec2(0.0, stepM), microFade);
  vec3 N = normalize(vec3(hL - hR, 2.0 * stepM, hD - hU));

  vec2 horizonUV = (((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
  vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
  float skyViewAO = horz.b;
  float canopyDensity = horz.a * (1.0 - vOutRim * 0.35);

  float wetness = vGeo.g;
  float ridge = vGeo.b;
  float roadPad = vGeo.a;
  float asl = uBaseElevationASL + vWorldPos.y;
  float slopeMacro = 1.0 - clamp(N.y, 0.0, 1.0);

  // 1b. High-Resolution 2.0m/texel Local Road, Wheel-Track & River/Tributary Shoreline Mask!
  float dComp = length(xz - uCompoundCenter);
  float dVill = length(xz - uVillageCenter);
  float isCompoundYard = 1.0 - smoothstep(20.0, 34.0, dComp);
  float isVillageYard  = 1.0 - smoothstep(38.0, 56.0, dVill);
  float isSettledPad   = max(isCompoundYard, isVillageYard);

  vec2 locUv = (xz - uLocalDetailMin) / uLocalDetailSpan;
  float inLocal = step(0.02, locUv.x) * step(locUv.x, 0.98) * step(0.02, locUv.y) * step(locUv.y, 0.98);
  vec4 locDet = inLocal > 0.5 ? texture2D(uLocalDetailMap, clamp(locUv, 0.002, 0.998)) : vec4(0.0);
  float locEdgeFade = smoothstep(0.02, 0.14, min(min(locUv.x, 1.0 - locUv.x), min(locUv.y, 1.0 - locUv.y))) * inLocal;

  float macroRoad = smoothstep(0.36, 0.72, roadPad) * (1.0 - isSettledPad);
  float isRoad = mix(macroRoad, locDet.r * (1.0 - isSettledPad), locEdgeFade);
  float roadLatNorm = locDet.g; // 0 at road center -> 1 at verge
  float localWetBank = locDet.b * locEdgeFade;
  wetness = max(wetness, localWetBank);

  // 2. Crisp Analytical Alpine Erosion Micro-Normal Sculpting (strong on mountain cliffs & ridges!)
  vec3 hyper = evalAlpineHyperDetail(xz, dist);
  float hyperBoost = mix(1.0, 1.24, uSurfaceSuper);
  float hyperDistFade = 1.0 - smoothstep(220.0, 2600.0, dist) * 0.45;
  float hyperStrength = (1.0 - isSettledPad) * (1.0 - isRoad * 0.90)
                      * mix(0.20, 0.92, smoothstep(0.05, 0.36, slopeMacro))
                      * hyperBoost * hyperDistFade;
  N = normalize(N + vec3(-hyper.y, 0.0, -hyper.z) * (hyperStrength * 18.0));

  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  float slopeRad = acos(clamp(N.y, 0.0, 1.0));
  float macroBlend = smoothstep(35.0, 260.0, dist) * 0.58;

  // 3. TR-POM: Steep Parallax Occlusion Mapping (28m standard / 44m SM1.1S Super) + Micro Self-Shadowing!
  float pomDistEnd = mix(28.0, 44.0, uSurfaceSuper);
  float pomDepthBoost = mix(1.0, 1.40, uSurfaceSuper);
  float pomFade = (1.0 - smoothstep(12.0, pomDistEnd, dist)) * (1.0 - slope * 0.55);
  vec2 forestBaseUv = xz * 0.24;
  vec2 gravelBaseUv = xz * 0.36;
  vec2 meadowBaseUv = xz * 0.28;
  vec2 forestUv = pomFade > 0.01 ? computeTerrainPomUv(uTexForest, forestBaseUv, V, 0.024 * pomDepthBoost * pomFade * (1.0 - isSettledPad * 0.4), uSurfaceSuper) : forestBaseUv;
  vec2 gravelUv = pomFade > 0.01 ? computeTerrainPomUv(uTexGravel, gravelBaseUv, V, 0.034 * pomDepthBoost * pomFade, uSurfaceSuper) : gravelBaseUv;
  vec2 meadowUv = pomFade > 0.01 ? computeTerrainPomUv(uTexMeadow, meadowBaseUv, V, 0.022 * pomDepthBoost * pomFade, uSurfaceSuper) : meadowBaseUv;

  vec4 texForest = sampleSeamlessPbr(uTexForest, forestUv, macroBlend);
  vec4 texGravel = sampleSeamlessPbr(uTexGravel, gravelUv, macroBlend);
  vec4 texMeadow = sampleSeamlessPbr(uTexMeadow, meadowUv, macroBlend);
  vec4 texRock   = sampleTriplanarGranite(vWorldPos, N, 0.075);

  float pomMicroShadow = 1.0;
  if (pomFade > 0.02) {
    vec2 sunUvStep = sunDir.xz * 0.014;
    float hHere = mix(texForest.a, texGravel.a, isRoad);
    float hSun  = mix(texture2D(uTexForest, forestUv + sunUvStep).a, texture2D(uTexGravel, gravelUv + sunUvStep).a, isRoad);
    float occl  = clamp((hSun - hHere) * mix(2.7, 3.4, uSurfaceSuper), 0.0, 0.58);
    pomMicroShadow = 1.0 - occl * pomFade;
  }

  float macroVar = fbm2(xz * 0.0018);
  float microVar = fbm2(xz * 0.022);

  // 4. Photorealistic 6-Region Mountain-Valley Ground Materials
  float wValley, wHills, wPlateau, wWetland, wMeadow, wSouthPlain;
  evalRegionWeightsGLSL(xz, wValley, wHills, wPlateau, wWetland, wMeadow, wSouthPlain);

  // Valley old-growth forest floor (mossy humus + needle litter + maple leaf patches!)
  vec3 colValley = mix(texForest.rgb * vec3(0.76, 0.88, 0.58), texMeadow.rgb * vec3(0.68, 0.82, 0.50), smoothstep(0.55, 0.85, macroVar) * 0.35);
  colValley = mix(colValley, vec3(0.018, 0.042, 0.015), 0.18 + 0.14 * macroVar);

  // Western Foothills (rich moss-meadow turf & warm autumn humus)
  vec3 colHills = mix(texMeadow.rgb * vec3(0.74, 0.94, 0.52), texForest.rgb * vec3(0.86, 0.78, 0.48), 0.42 + 0.24 * macroVar);

  // Northern Beech & Birch Highlands (warm golden-amber beech leaf litter & mossy loam)
  vec3 colPlateau = mix(texForest.rgb * vec3(0.95, 0.82, 0.46), texMeadow.rgb * vec3(0.78, 0.86, 0.44), 0.30 + 0.22 * macroVar);

  // Eastern Misty Wetlands & Willow Creeks
  vec3 colWetland = mix(texForest.rgb * vec3(0.44, 0.66, 0.40), vec3(0.014, 0.040, 0.024), 0.38 + 0.22 * wetness);

  // Southwestern Sunlit Susuki Upland Meadows
  vec3 colMeadow = mix(texMeadow.rgb * vec3(1.02, 0.94, 0.54), vec3(0.115, 0.112, 0.036), 0.28 + 0.20 * macroVar);

  // Southern Red-Pine Bluffs & Sandy Loam
  vec3 colSouthPlain = mix(texGravel.rgb * vec3(0.68, 0.60, 0.44), texForest.rgb * vec3(0.78, 0.82, 0.50), 0.58 + 0.22 * macroVar);

  vec3 albedo = colValley * wValley
              + colHills * wHills
              + colPlateau * wPlateau
              + colWetland * wWetland
              + colMeadow * wMeadow
              + colSouthPlain * wSouthPlain;

  // Damp drainage gullies & rich dark mossy swales
  float dampSwale = smoothstep(0.46, 0.86, wetness) * (1.0 - smoothstep(0.25, 0.55, slopeRad));
  albedo = mix(albedo, vec3(0.016, 0.036, 0.018) * (0.74 + 0.52 * texForest.a), dampSwale * 0.44);

  // River & Tributary Wet Cobble Beaches (sharp 2m shoreline transition via uLocalDetailMap.b!)
  float riverCobble = smoothstep(0.56, 0.90, max(wetness * (1.0 - wWetland * 0.50), localWetBank * 1.15));
  float wetShoreBand = smoothstep(0.76, 0.96, max(wetness, localWetBank));
  vec3 colWetCobble = texGravel.rgb * vec3(0.40, 0.42, 0.40) * (0.72 + 0.48 * microVar);
  colWetCobble *= mix(1.0, 0.48, wetShoreBand);
  albedo = mix(albedo, colWetCobble, riverCobble * 0.82);

  // Dramatic Triplanar Stratified Japanese Granite Cliffs & Rocky Mountain Ridges!
  float alpineRockBoost = smoothstep(780.0, 1180.0, asl) * 0.28;
  float rockMask = smoothstep(0.36, 0.66, slopeRad + alpineRockBoost + (texRock.a - 0.5) * 0.14 + ridge * 0.10);
  vec3 colGranite = texRock.rgb * vec3(0.64, 0.66, 0.68);
  // Subtle green moss shelves clinging to flatter horizontal granite cracks below treeline
  float cliffMoss = smoothstep(0.55, 0.85, N.y) * (1.0 - smoothstep(820.0, 1100.0, asl)) * smoothstep(0.42, 0.78, microVar);
  colGranite = mix(colGranite, vec3(0.036, 0.068, 0.028), cliffMoss * 0.48);
  albedo = mix(albedo, colGranite, rockMask * 0.94);

  // Authentic High-Altitude Japanese Alps North-Facing Snow Couloirs (残雪 / 雪渓 above 1060m ASL!)
  float northAspect = clamp(-N.z * 0.65 + 0.35, 0.0, 1.0);
  float snowAlt = smoothstep(1040.0, 1380.0, asl + (fbm2(xz * 0.0022) - 0.5) * 140.0 + northAspect * 95.0);
  float snowSlope = 1.0 - smoothstep(0.62, 0.98, slopeRad);
  float snowMask = clamp(snowAlt * snowSlope * (0.45 + 0.55 * smoothstep(0.38, 0.74, hyper.x)), 0.0, 0.92);
  vec3 colSnow = vec3(0.76, 0.82, 0.90) * (0.86 + 0.14 * texGravel.a);
  albedo = mix(albedo, colSnow, snowMask);

  // Razor-Sharp Real-World Japanese Mountain Forestry Road (Twin Worn Tire Tracks + Mossy Crown + Gravel Verges!)
  if (isRoad > 0.005) {
    // Realistic twin wheel ruts at roadLatNorm ≈ 0.36..0.64, slightly mossy center strip (< 0.18), damp gravel verges (> 0.78)
    float centerCrown = (1.0 - smoothstep(0.06, 0.24, roadLatNorm)) * locEdgeFade;
    float tireTracks = smoothstep(0.18, 0.36, roadLatNorm) * (1.0 - smoothstep(0.62, 0.80, roadLatNorm)) * locEdgeFade;
    float vergeMoss = smoothstep(0.72, 0.98, roadLatNorm) * locEdgeFade;

    vec3 roadBase = texGravel.rgb * vec3(0.46, 0.43, 0.39);
    // Darker compacted weathered asphalt/macadam in the wheel tracks
    vec3 roadTrack = texGravel.rgb * vec3(0.28, 0.28, 0.29);
    vec3 colRoad = mix(roadBase, roadTrack, tireTracks * 0.65);
    // Subtle natural mountain grass/moss tufts on center crown & road shoulders
    colRoad = mix(colRoad, texForest.rgb * vec3(0.62, 0.76, 0.46), centerCrown * 0.30 * (0.5 + 0.5 * microVar) + vergeMoss * 0.58);
    albedo = mix(albedo, colRoad, isRoad * 0.94);
  }

  vec3 colCompYard = mix(texForest.rgb * vec3(0.64, 0.74, 0.48), vec3(0.018, 0.032, 0.015), 0.28);
  albedo = mix(albedo, colCompYard, isCompoundYard * 0.86);
  vec3 colVillageYard = mix(texForest.rgb * vec3(0.68, 0.78, 0.48), texGravel.rgb * vec3(0.42, 0.40, 0.34), 0.24);
  albedo = mix(albedo, colVillageYard, isVillageYard * 0.86);

  // 5. Far-Distance (> 180m .. 60,000m) Rich Multi-Species Japanese Mountain Forest Canopy Mosaic!
  float isNullPad = evalSouthRectWeight(xz);
  float farCanopyBlend = smoothstep(160.0, 440.0, dist) * canopyDensity * (1.0 - rockMask * 0.88) * (1.0 - snowMask) * (1.0 - isRoad * 0.92) * (1.0 - isVillageYard * 0.92) * (1.0 - isNullPad);
  if (farCanopyBlend > 0.01) {
    float c1 = glslNoise(xz * 0.095);
    float c2 = glslNoise(xz * 0.24 + vec2(31.2, -19.7));
    float c3 = glslNoise(xz * 0.022 - vec2(11.4, 22.8));
    float cMaple = glslNoise(xz * 0.038 + vec2(-18.5, 42.1));
    float crownBump = c1 * 0.56 + c2 * 0.28 + c3 * 0.16;

    vec3 colSugiCrown  = mix(vec3(0.010, 0.030, 0.014), vec3(0.026, 0.058, 0.022), crownBump);
    vec3 colBunaCrown  = mix(vec3(0.028, 0.064, 0.016), vec3(0.072, 0.096, 0.024), smoothstep(0.24, 0.84, c3 * 0.6 + c1 * 0.4));
    vec3 colPineCrown  = mix(vec3(0.014, 0.038, 0.020), vec3(0.036, 0.068, 0.028), crownBump);
    // Natural scattered Japanese Maple (モミジ) crimson/amber & White Birch golden patches across hillsides!
    vec3 colMapleCrown = mix(vec3(0.115, 0.056, 0.014), vec3(0.175, 0.042, 0.016), smoothstep(0.45, 0.88, c1));

    vec3 farTreeCol = colSugiCrown * (wValley * 0.65 + wWetland * 0.65)
                    + colBunaCrown * (wPlateau * 0.78 + wHills * 0.68 + wValley * 0.35)
                    + colPineCrown * (wSouthPlain + wMeadow + wHills * 0.32 + wWetland * 0.35);
    float mapleSpot = smoothstep(0.64, 0.86, cMaple) * (1.0 - smoothstep(820.0, 1080.0, asl));
    farTreeCol = mix(farTreeCol, colMapleCrown, mapleSpot * 0.58);
    farTreeCol *= (0.54 + 0.68 * smoothstep(0.18, 0.86, crownBump));

    albedo = mix(albedo, farTreeCol, farCanopyBlend * 0.90);

    float cnX = (glslNoise((xz + vec2(3.5, 0.0)) * 0.095) - c1) * 1.45;
    float cnZ = (glslNoise((xz + vec2(0.0, 3.5)) * 0.095) - c1) * 1.45;
    N = normalize(N + vec3(cnX, 0.0, cnZ) * farCanopyBlend * 0.58);
  }

  // Analytical Near-Field Micro-Normal Perturbation
  float nearDetailFade = 1.0 - smoothstep(28.0, 180.0, dist);
  if (nearDetailFade > 0.01) {
    float fFreq = mix(0.75, 0.42, rockMask);
    vec2 pN = vec2(vWorldPos.x + vWorldPos.y * 0.22, vWorldPos.z - vWorldPos.y * 0.18) * fFreq;
    vec3 nd = noiseDeriv(pN);
    float bumpStr = (0.32 + 0.52 * rockMask + 0.26 * isRoad) * nearDetailFade;
    N = normalize(N + vec3(-nd.y, 0.0, -nd.z) * bumpStr * 1.18);
  }

  // 6. Mountain Horizon Self-Shadowing + TR-KOMOREBI Forest Canopy Dappled Sunlight!
  float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
  float horizonShadow = smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y);
  horizonShadow = mix(1.0, horizonShadow, uHorizonShadowBlend);

  float komorebi = evalKomorebiDapple(vWorldPos, canopyDensity * (1.0 - rockMask * 0.72) * (1.0 - isRoad * 0.52) * (1.0 - isVillageYard), sunDir, dist);

  float NdotL = max(0.0, dot(N, sunDir));
  float wrapAmt = 0.14 * farCanopyBlend;
  float wrapNdotL = max(0.0, (dot(N, sunDir) + wrapAmt) / (1.0 + wrapAmt));

  vec3 directLight = uSunColor * (uSunIntensity * wrapNdotL * horizonShadow * komorebi * pomMicroShadow * 0.94);

  float hemiMix = N.y * 0.5 + 0.5;
  vec3 ambientLight = mix(uHemiGroundColor, uHemiSkyColor, hemiMix) * (uHemiIntensity * (0.42 + 0.58 * skyViewAO) * 0.96);

  vec3 H = normalize(sunDir + V);
  float wetlandSheen = wWetland * smoothstep(0.55, 0.90, wetness) * 0.55;
  float specPow = mix(24.0, 84.0, clamp(wetShoreBand + riverCobble * 0.5 + wetlandSheen + snowMask * 0.4, 0.0, 1.0));
  float specStr = (0.026 + 0.10 * rockMask + 0.22 * riverCobble + 0.36 * wetShoreBand + 0.24 * wetlandSheen + 0.18 * snowMask) * (1.0 - farCanopyBlend * 0.90);
  float spec = pow(max(0.0, dot(N, H)), specPow) * specStr * horizonShadow * komorebi * smoothstep(0.0, 0.12, NdotL);

  float compGlow = max(exp(-dComp * 0.075), exp(-dVill * 0.045) * 0.85) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.22;
  vec3 compWarmBounce = vec3(1.0, 0.74, 0.42) * compGlow;

  vec3 litColor = albedo * (directLight + ambientLight + compWarmBounce) + uSunColor * (spec * uSunIntensity * 0.58);
  litColor += evalTerrenoFlashlight(vWorldPos, N, albedo);

  // 7. Volumetric Sea-of-Clouds Valley Mist & Rayleigh/Mie Aerial Perspective
  vec3 finalColor = applyTerrenoAtmosphere(litColor, vWorldPos, cameraPosition);

  gl_FragColor = vec4(finalColor, 1.0);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SKY_VERTEX_SHADER = /* glsl */ `
precision highp float;
varying vec3 vRayDir;
void main() {
  vRayDir = normalize(position);
  vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + position * 120.0, 1.0);
  gl_Position = vec4(clip.xy, clip.w * 0.999995, clip.w);
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGlow;
uniform vec3 uAerialFogColor;
uniform float uMieStrength;
uniform float uStarIntensity;
uniform float uCloudBrightness;

varying vec3 vRayDir;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float sNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float cloudFbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * sNoise(p);
    p = rot * p * 2.06 + vec2(11.3, 7.9);
    a *= 0.48;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vRayDir);
  vec3 sunDir = normalize(uSunDir);

  float elev = clamp(dir.y, 0.0, 1.0);
  float horizonCurve = pow(1.0 - elev, 2.9);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, horizonCurve);

  float ozoneBand = exp(-pow((elev - 0.24) * 5.2, 2.0));
  vec3 ozoneTint = mix(uSkyZenith * 1.15, uSkyGlow * 0.42 + uSkyZenith * 0.72, uMieStrength);
  sky = mix(sky, ozoneTint, ozoneBand * 0.28);

  if (dir.y < 0.0) {
    sky = mix(uSkyHorizon, uAerialFogColor, smoothstep(0.0, -0.22, dir.y));
  }

  float cosSun = max(0.0, dot(dir, sunDir));
  float wideHalo = pow(cosSun, 4.5) * 0.46 * uMieStrength;
  float tightHalo = pow(cosSun, 36.0) * 0.78 * uMieStrength;
  float sunDisk = smoothstep(0.9988, 0.9995, cosSun);
  sky += uSkyGlow * (wideHalo + tightHalo) + uSunColor * (sunDisk * 2.6);

  if (dir.y > 0.015) {
    vec2 cirrusUV = dir.xz / (dir.y + 0.22) * vec2(0.85, 2.15) + vec2(uTime * 0.0022, -uTime * 0.0010);
    float ci1 = cloudFbm(cirrusUV);
    float ci2 = cloudFbm(cirrusUV * 2.3 + vec2(ci1 * 1.8, -ci1 * 1.2));
    float cirrusMask = smoothstep(0.56, 0.86, ci2) * smoothstep(0.04, 0.24, dir.y) * smoothstep(0.96, 0.45, dir.y);
    vec3 cirrusCol = mix(uSkyHorizon * 1.08, uSkyGlow * 1.25, 0.42 + 0.58 * pow(cosSun, 2.5)) * (0.45 + 0.65 * uCloudBrightness);
    sky = mix(sky, cirrusCol, cirrusMask * 0.42);

    vec2 cloudUV = dir.xz / (dir.y + 0.145) * 1.05;
    vec2 drift = vec2(uTime * 0.0038, uTime * 0.0018);
    float cBase = cloudFbm(cloudUV + drift);
    float cDetail = cloudFbm(cloudUV * 2.55 - drift * 1.3 + vec2(cBase * 0.65));
    float density = smoothstep(0.46, 0.80, cBase * 0.68 + cDetail * 0.32);
    float horizonFade = smoothstep(0.015, 0.16, dir.y) * smoothstep(0.99, 0.58, dir.y);
    float cloudMask = density * horizonFade;

    if (cloudMask > 0.005) {
      vec2 sunStepUV = sunDir.xz / max(sunDir.y + 0.35, 0.35) * 0.11;
      float sunOcc = cloudFbm(cloudUV + drift + sunStepUV);
      float lightTrans = exp(-max(0.0, sunOcc - 0.38) * 3.8);
      float powder = (1.0 - exp(-density * 2.6)) * (0.35 + 0.65 * pow(cosSun, 4.0));
      float rimSilver = pow(cosSun, 8.0) * (1.0 - density * 0.65) * 1.35 * uMieStrength;

      vec3 cloudShadow = mix(uSkyZenith * 1.15, uAerialFogColor * 0.78, 0.52) * (0.55 + 0.55 * uCloudBrightness);
      vec3 cloudSunlit = mix(vec3(0.95, 0.97, 1.0), uSkyGlow * 1.25, 0.55) * (0.32 + 0.88 * uCloudBrightness);
      vec3 cloudCol = mix(cloudShadow, cloudSunlit, clamp(lightTrans * (0.45 + 0.72 * powder), 0.0, 1.0));
      cloudCol += uSkyGlow * (rimSilver * uCloudBrightness);

      float distMelt = smoothstep(0.015, 0.22, dir.y);
      cloudCol = mix(uSkyHorizon, cloudCol, distMelt);
      sky = mix(sky, cloudCol, clamp(cloudMask * 0.86, 0.0, 0.92));
    }
  }

  if (uStarIntensity > 0.01 && dir.y > 0.04) {
    vec2 starUV = dir.xz / (dir.y + 0.45) * 160.0;
    vec2 cell = floor(starUV);
    vec2 f = fract(starUV) - 0.5;
    float rnd = hash21(cell);
    if (rnd > 0.968) {
      float d = length(f);
      float bright = smoothstep(0.24, 0.02, d) * pow((rnd - 0.968) / 0.032, 1.4);
      float twinkle = 0.78 + 0.22 * sin(uTime * (2.2 + rnd * 6.0) + rnd * 91.0);
      vec3 starTint = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.92, 0.78), fract(rnd * 37.0));
      sky += starTint * (bright * twinkle * uStarIntensity * smoothstep(0.04, 0.28, dir.y) * 1.65);
    }
    float mwBand = exp(-pow(abs(dir.x * 0.65 - dir.z * 0.76 + 0.12) * 3.8, 2.0));
    float mwTex = cloudFbm(dir.xz * 4.5);
    sky += vec3(0.055, 0.075, 0.12) * (mwBand * mwTex * uStarIntensity * smoothstep(0.08, 0.42, dir.y));
  }

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createTerrenoClipmap(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Clipmap_14Ring';

  const texForest = createSeamlessPbrTexture('forest');
  const texRock = createSeamlessPbrTexture('rock');
  const texGravel = createSeamlessPbrTexture('gravel');
  const texMeadow = createSeamlessPbrTexture('meadow');

  // Dynamic 256×256 Local Hi-Res Detail Mask (512m × 512m = 2.0m/texel linear!)
  // Eliminates blurry 58.6m macro roads & renders razor-sharp forestry roads + wet river cobble beaches!
  const localDetailData = new Uint8Array(LOCAL_DETAIL_RES * LOCAL_DETAIL_RES * 4);
  const localDetailTex = new THREE.DataTexture(
    localDetailData,
    LOCAL_DETAIL_RES,
    LOCAL_DETAIL_RES,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  localDetailTex.minFilter = THREE.LinearFilter;
  localDetailTex.magFilter = THREE.LinearFilter;
  localDetailTex.wrapS = THREE.ClampToEdgeWrapping;
  localDetailTex.wrapT = THREE.ClampToEdgeWrapping;
  localDetailTex.generateMipmaps = false;

  const localDetailMin = new THREE.Vector2(-999999, -999999);
  let lastLocalCenterX = -999999;
  let lastLocalCenterZ = -999999;

  function bakeLocalDetailWindow(cx, cz) {
    const minX = Math.floor((cx - LOCAL_DETAIL_SPAN * 0.5) / 8.0) * 8.0;
    const minZ = Math.floor((cz - LOCAL_DETAIL_SPAN * 0.5) / 8.0) * 8.0;
    localDetailMin.set(minX, minZ);
    const step = LOCAL_DETAIL_SPAN / LOCAL_DETAIL_RES;

    for (let iz = 0; iz < LOCAL_DETAIL_RES; iz++) {
      const wz = minZ + (iz + 0.5) * step;
      const rv = evalMainRiver(wz);
      const rowOff = iz * LOCAL_DETAIL_RES;
      for (let ix = 0; ix < LOCAL_DETAIL_RES; ix++) {
        const wx = minX + (ix + 0.5) * step;
        const o4 = (rowOff + ix) * 4;

        // 1. Crisp mountain forestry road mask & lateral track coordinate (suppressed inside open riverbed!)
        const dxRiv = Math.abs(wx - rv.x);
        const inOpenRiver = dxRiv < rv.halfWidth * 0.92;
        const rq = geomorph.roadIndex.queryDist(wx, wz);
        let roadMask = 0.0;
        let latNorm = 0.0;
        let roadSup = 0.0;
        if (!inOpenRiver && rq.segIdx >= 0 && rq.dist < rq.width * 0.85 + 3.0) {
          const halfW = rq.width * 0.5;
          roadMask = 1.0 - qSmoothCpu(halfW * 0.72, halfW + 1.8, rq.dist);
          latNorm = clamp01(rq.dist / (halfW + 0.8));
          roadSup = 1.0 - qSmoothCpu(halfW * 0.82, halfW + 3.2, rq.dist);
        }

        // 2. Crisp river & tributary wet cobble bank mask
        let wetBank = 1.0 - qSmoothCpu(rv.halfWidth * 0.82, rv.halfWidth + 14.0, dxRiv);
        if (wetBank < 0.95) {
          const tr = evalClosestTributary(wx, wz);
          if (tr.dist < tr.halfWidth + 10.0) {
            const tWet = 1.0 - qSmoothCpu(tr.halfWidth * 0.75, tr.halfWidth + 9.0, tr.dist);
            if (tWet > wetBank) wetBank = tWet;
          }
        }

        localDetailData[o4]     = (roadMask * 255.0 + 0.5) | 0;
        localDetailData[o4 + 1] = (latNorm * 255.0 + 0.5) | 0;
        localDetailData[o4 + 2] = (wetBank * 255.0 + 0.5) | 0;
        localDetailData[o4 + 3] = (roadSup * 255.0 + 0.5) | 0;
      }
    }
    localDetailTex.needsUpdate = true;
  }

  const solidGeo = buildClipmapRingGeometry(CLIPMAP_HALF, true);
  const hollowGeo = buildClipmapRingGeometry(CLIPMAP_HALF, false);
  const trimGeos = [
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 0, 0),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 1, 0),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 0, 1),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 1, 1),
  ];

  const sr = TERRENO_WORLD.southRect;
  const surfaceSuperUniform = { value: 0.0 };
  const baseUniforms = {
    ...atmoUniforms,
    uGeoMap: { value: geomorph.geoTexture },
    uHorizonMap: { value: geomorph.horizonTexture },
    uLocalDetailMap: { value: localDetailTex },
    uLocalDetailMin: { value: localDetailMin },
    uLocalDetailSpan: { value: LOCAL_DETAIL_SPAN },
    uTexForest: { value: texForest },
    uTexRock: { value: texRock },
    uTexGravel: { value: texGravel },
    uTexMeadow: { value: texMeadow },
    uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
    uWorldMax: { value: new THREE.Vector2(TERRENO_WORLD.maxX, TERRENO_WORLD.maxZ) },
    uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
    uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
    uCompoundCenter: { value: new THREE.Vector2(TERRENO_WORLD.compoundCenterX, TERRENO_WORLD.compoundCenterZ) },
    uCompoundFlatR: { value: TERRENO_WORLD.compoundFlatRadius },
    uCompoundGroundY: { value: TERRENO_WORLD.compoundGroundY },
    uVillageCenter: { value: new THREE.Vector2(TERRENO_WORLD.villageCenterX, TERRENO_WORLD.villageCenterZ) },
    uVillageFlatR: { value: TERRENO_WORLD.villageFlatRadius },
    uVillageGroundY: { value: TERRENO_WORLD.villageGroundY },
    uBaseElevationASL: { value: TERRENO_WORLD.baseElevationASL },
    uSouthRect: { value: new THREE.Vector4(sr.minX, sr.maxX, sr.minZ, sr.maxZ) },
    uSouthRectY: { value: geomorph.southRectY },
    uSouthRectBlend: { value: sr.blend },
    uHalfExtent: { value: CLIPMAP_HALF },
    uSurfaceSuper: surfaceSuperUniform,
  };

  const rings = [];
  for (let L = 0; L < CLIPMAP_LEVELS; L++) {
    const step = 0.5 * Math.pow(2, L);
    const ringUniforms = {
      ...baseUniforms,
      uRingOrigin: { value: new THREE.Vector2(0, 0) },
      uGridStep: { value: step },
      uMorphEnable: { value: L < CLIPMAP_LEVELS - 1 ? 1.0 : 0.0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: ringUniforms,
      vertexShader: TERRAIN_VERTEX_SHADER,
      fragmentShader: TERRAIN_FRAGMENT_SHADER,
      extensions: { derivatives: true },
      side: THREE.FrontSide,
    });

    const ringMesh = new THREE.Mesh(L === 0 ? solidGeo : hollowGeo, mat);
    ringMesh.frustumCulled = false;
    ringMesh.name = `TERRENO_Ring_L${L}`;
    group.add(ringMesh);

    let trimMesh = null;
    if (L > 0) {
      trimMesh = new THREE.Mesh(trimGeos[0], mat);
      trimMesh.frustumCulled = false;
      trimMesh.name = `TERRENO_Trim_L${L}`;
      group.add(trimMesh);
    }

    rings.push({
      level: L,
      step,
      snap: step * 2.0,
      originX: 0,
      originZ: 0,
      uniforms: ringUniforms,
      ringMesh,
      trimMesh,
    });
  }

  const skyGeo = new THREE.SphereGeometry(1.0, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -100;
  skyDome.name = 'TERRENO_SkyDome_90km';
  group.add(skyDome);

  function setSurfaceSuper(enabled, maxAniso = 8) {
    surfaceSuperUniform.value = enabled ? 1.0 : 0.0;
    const aniso = enabled ? Math.min(16, maxAniso) : 4;
    [texForest, texRock, texGravel, texMeadow].forEach((t) => {
      if (t) { t.anisotropy = aniso; t.needsUpdate = true; }
    });
  }

  function update(cameraPos) {
    const camX = cameraPos.x;
    const camZ = cameraPos.z;

    if (Math.hypot(camX - lastLocalCenterX, camZ - lastLocalCenterZ) > 125.0) {
      lastLocalCenterX = camX;
      lastLocalCenterZ = camZ;
      bakeLocalDetailWindow(camX, camZ);
    }

    for (let L = 0; L < CLIPMAP_LEVELS; L++) {
      const r = rings[L];
      const ox = Math.floor(camX / r.snap) * r.snap;
      const oz = Math.floor(camZ / r.snap) * r.snap;
      r.originX = ox;
      r.originZ = oz;
      r.uniforms.uRingOrigin.value.set(ox, oz);

      if (L > 0 && r.trimMesh) {
        const prev = rings[L - 1];
        const dx = Math.round((prev.originX - ox) / r.step);
        const dz = Math.round((prev.originZ - oz) / r.step);
        const trimIdx = (dz > 0 ? 2 : 0) + (dx > 0 ? 1 : 0);
        const targetGeo = trimGeos[trimIdx];
        if (r.trimMesh.geometry !== targetGeo) {
          r.trimMesh.geometry = targetGeo;
        }
      }
    }
  }

  return {
    group,
    skyDome,
    rings,
    setSurfaceSuper,
    update,
  };
}
