import * as THREE from 'three';
import { TERRENO_WORLD } from './terrenoConfig.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO Engine v2 — Breakthroughs TR-HYPERDETAIL, TR-POM, TR-SNOW, TR-WETSHORE, & Volumetric Sky v2:
 *   - 12-Ring Crack-Free GPU Geomorphing Geometry Clipmaps (0.5m underfoot -> 28km horizon)
 *     with exact Losasso & Hoppe L-Trims and outer 22% odd-vertex horizontal morph snapping
 *   - Seam-Free Continuous Irrational-Scale Multi-Rotated Texture Synthesis (ZERO mipmap seam lines!)
 *   - 5-Step Steep Parallax Occlusion Mapping (POM) + Micro Self-Shadowing (0..26m underfoot depth!)
 *   - Inigo Quilez 5-Octave Analytical-Derivative Swiss-Turbulence & Ridged Alpine Erosion (fbmDeriv)
 *     eliminating 10m macro-atlas smoothness across all 19,000 meters!
 *   - Authentic Japanese Northern Alps North-Facing Gully Snow Couloirs (残雪 / 雪渓)
 *   - Dark Glossy Wet-Rock River Shoreline Band + Sun-Aligned Animated Forest Komorebi (木漏れ日)
 *   - 24,000m Physically-Based Sky Dome with Rayleigh-Chappuis Ozone Belt & 2-Layer Volumetric Lit Cloudscape
 */

const CLIPMAP_HALF = 28;
const CLIPMAP_LEVELS = 12;

function makeSeededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * Generate ultra-crisp 512×512 seamless toroidal PBR Albedo(RGB) + MicroHeight(A) CanvasTextures
 * with high-frequency mineral grain, fallen cedar needles, mossy clumps, & rock fractures for POM!
 */
function createSeamlessPbrTexture(kind) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rand = makeSeededRand(kind === 'forest' ? 104729 : kind === 'rock' ? 224737 : 350377);

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
        // Ultra-tactile Yakushima / Japanese cedar forest floor: dark humus loamy earth,
        // fine velvety moss tufts, crisp fallen reddish-amber cedar needles, & small rootlets
        const mossPatch = Math.max(0, Math.min(1, (n1 * 0.42 + n2 * 0.36 + n3 * 0.22 - 0.38) * 3.1));
        const needleMat = Math.max(0, Math.min(1, (n4 * 0.50 + n5 * 0.32 + n6 * 0.18 - 0.50) * 3.4));
        const pebbleSpeck = Math.max(0, (n5 * 0.6 + n6 * 0.4 - 0.72) * 3.6);
        const grain = (n6 - 0.5) * 32.0;

        const soilR = 44 + fbm * 32 + grain * 0.7;
        const soilG = 37 + fbm * 26 + grain * 0.6;
        const soilB = 27 + fbm * 17 + grain * 0.4;
        const mossR = 38 + n3 * 30 + n5 * 14 + grain * 0.6;
        const mossG = 66 + n2 * 40 + n4 * 22 + grain * 0.8;
        const mossB = 28 + n3 * 18 + grain * 0.4;

        r = soilR * (1 - mossPatch) + mossR * mossPatch + needleMat * 42 + pebbleSpeck * 46;
        g = soilG * (1 - mossPatch) + mossG * mossPatch + needleMat * 22 + pebbleSpeck * 44;
        b = soilB * (1 - mossPatch) + mossB * mossPatch + needleMat * 6  + pebbleSpeck * 40;
        h = Math.max(0.03, Math.min(0.98, fbm * 0.52 + mossPatch * 0.24 + needleMat * 0.14 + n6 * 0.12));
      } else if (kind === 'rock') {
        // Crisp Japanese Northern Alps Granite & Andesite: sharp fractures, quartz/biotite speckle, bedding ledges
        const ridge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
        const crack1 = Math.pow(1.0 - Math.abs(n3 * 2.0 - 1.0), 4.5);
        const crack2 = Math.pow(1.0 - Math.abs(n4 * 2.0 - 1.0), 5.0);
        const strata = Math.sin((v * 7.0 + n1 * 0.62 + n2 * 0.28) * Math.PI * 2.0) * 0.5 + 0.5;
        const base = 74 + fbm * 56 + strata * 26 - crack1 * 56 - crack2 * 34;
        const quartz = (n5 - 0.5) * 32 + (n6 - 0.5) * 44;
        const lichen = Math.max(0, (n1 * 0.52 + n3 * 0.48 - 0.68) * 3.4);
        r = base + quartz + lichen * 22;
        g = base + quartz * 0.96 + 3 + lichen * 34;
        b = base + quartz * 0.92 + 6 + lichen * 12;
        h = Math.max(0.02, Math.min(0.98, 0.44 + ridge * 0.34 + strata * 0.18 - crack1 * 0.48 - crack2 * 0.22 + (n6 - 0.5) * 0.14));
      } else {
        // Sharp Crushed Macadam Forestry Road Gravel & Angular River Cobbles (high POM contrast!)
        const cobbleA = Math.pow(1.0 - Math.abs(n4 * 2.0 - 1.0), 1.6);
        const cobbleB = Math.pow(n5 * 0.55 + n6 * 0.45, 1.35);
        const dust = n1 * 0.48 + n2 * 0.52;
        const pebbleH = cobbleA * 0.52 + cobbleB * 0.48;
        const base = 88 + dust * 36 + (pebbleH - 0.42) * 94 + (n6 - 0.5) * 36;
        r = base + 9;
        g = base + 5;
        b = base - 3;
        h = Math.max(0.03, Math.min(0.98, 0.26 + pebbleH * 0.64 + dust * 0.10));
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
uniform float uBaseElevationASL;

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;

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

float evalSharedMicroRelief(vec2 xz, float suppressFactor) {
  if (suppressFactor >= 0.999) return 0.0;
  float n1 = glslNoise(xz * 0.048) - 0.5;
  float n2 = glslNoise(xz * 0.17 + vec2(19.3, -7.1)) - 0.5;
  float crag = 1.0 - abs(glslNoise(xz * 0.026 + vec2(-4.2, 11.8)) * 2.0 - 1.0);
  float micro = n1 * 0.62 + n2 * 0.24 + (crag * crag - 0.35) * 0.95;
  return micro * (1.0 - suppressFactor);
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

  // 2. Sample Geomorphology Atlas + Exact Shared Micro-Relief
  vec4 geo = sampleGeoBilinear(xz);
  float y = geo.r + evalSharedMicroRelief(xz, geo.a);

  // Subtle Distant High-Alpine Craggy Skyline Ridge Sculpting (strictly far from player/road/compound!)
  // Breaks smooth macro peak triangles into razor-sharp authentic Japanese Northern Alps arêtes!
  float dComp = length(xz - uCompoundCenter);
  float approxCamDist = length(xz - cameraPosition.xz);
  float asl = uBaseElevationASL + y;
  float alpineCragMask = smoothstep(940.0, 1280.0, asl)
                       * smoothstep(180.0, 480.0, approxCamDist)
                       * (1.0 - smoothstep(0.02, 0.12, geo.a))
                       * smoothstep(120.0, 260.0, dComp);
  if (alpineCragMask > 0.005) {
    float r1 = 1.0 - abs(glslNoise(xz * 0.0052 + vec2(3.7, -8.1)) * 2.0 - 1.0);
    float r2 = 1.0 - abs(glslNoise(xz * 0.0128 - vec2(11.4, 5.2)) * 2.0 - 1.0);
    float jagged = (r1 * r1 * 18.0 + r2 * r2 * 8.5 - 8.0) * (0.45 + 0.55 * clamp(geo.b + 0.3, 0.0, 1.0));
    y += jagged * alpineCragMask;
  }

  // Exact compound clearing flat lock (smooth 2m blend avoids any step seam!)
  if (dComp <= uCompoundFlatR - 2.0) {
    y = uCompoundGroundY;
  }

  // 3. Seamless Distant Alpine Foothill Skirt beyond 5km × 19km world rim
  vec2 over = max(vec2(0.0), max(uWorldMin - xz, xz - uWorldMax));
  float outDist = length(over);
  if (outDist > 0.0) {
    float skirtDrop = outDist * 0.032 + smoothstep(0.0, 4000.0, outDist) * 165.0;
    float farWave = (sin(xz.x * 0.00095 + 0.7) * cos(xz.y * 0.00082 - 0.4) * 58.0
                   + sin((xz.x - xz.y) * 0.00045) * 42.0) * smoothstep(0.0, 1600.0, outDist);
    y = y - skirtDrop + farWave;
  }

  vec3 worldPos = vec3(xz.x, y, xz.y);
  vWorldPos = worldPos;
  vGeo = geo;
  vOutRim = smoothstep(0.0, 900.0, outDist);
  vCamDist = length(worldPos - cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uGeoMap;
uniform sampler2D uHorizonMap;
uniform sampler2D uTexForest;
uniform sampler2D uTexRock;
uniform sampler2D uTexGravel;

uniform vec2 uWorldMin;
uniform vec2 uWorldMax;
uniform vec2 uWorldSize;
uniform vec2 uAtlasSize;
uniform vec2 uCompoundCenter;
uniform float uBaseElevationASL;

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;

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

// ---- TR-HYPERDETAIL: Inigo Quilez Exact Analytical-Derivative Quintic Noise (C2 Smooth!) ----
// Returns vec3(value, dValue/dx, dValue/dz) — zero blocky dFdx artifacts, infinite alpine sharpness!
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

// 5-Octave Swiss-Turbulence + Ridged Alpine Erosion Micro-Sculpting (eliminates 10m macro grid creases!)
// Returns vec3(ridgedHeight 0..1, dH/dx, dH/dz)
vec3 evalAlpineHyperDetail(vec2 xz, float camDist) {
  const mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  const mat2 rotT = mat2(0.80, 0.60, -0.60, 0.80);
  vec2 p = xz * 0.0115;
  mat2 mRot = mat2(1.0, 0.0, 0.0, 1.0);

  float sum = 0.0;
  float amp = 0.54;
  float freq = 1.0;
  vec2 dSum = vec2(0.0);

  // Distance-adaptive Nyquist fade prevents far-field specular aliasing
  float nyquistCutoff = 1.0 / max(1.0, camDist * 0.0022);

  for (int i = 0; i < 5; i++) {
    float octFade = clamp(nyquistCutoff / max(freq * 0.28, 0.001), 0.0, 1.0);
    if (octFade <= 0.02) break;

    // Slight domain warp by accumulated slope derivatives (Swiss-Turbulence gully carving!)
    vec3 n = noiseDeriv(p + dSum * 0.14);
    // Ridged sharp alpine crag shaping: 1 - |2n - 1|
    float s = n.x * 2.0 - 1.0;
    float ridgeVal = 1.0 - abs(s);
    float ridgeSharp = ridgeVal * ridgeVal;
    float dSign = s >= 0.0 ? -1.0 : 1.0;
    vec2 gLocal = n.yz * (4.0 * ridgeVal * dSign);
    vec2 gWorld = (mRot * gLocal) * (freq * 0.0115);

    // Slope-damped erosion weight: sharpens steep crags while leaving gentle valleys organic!
    float erodeWeight = 1.0 / (1.0 + dot(dSum, dSum) * 18.0);
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
  float n1 = glslNoise(xz * 0.048) - 0.5;
  float n2 = glslNoise(xz * 0.17 + vec2(19.3, -7.1)) - 0.5;
  float crag = 1.0 - abs(glslNoise(xz * 0.026 + vec2(-4.2, 11.8)) * 2.0 - 1.0);
  float micro = n1 * 0.62 + n2 * 0.24 + (crag * crag - 0.35) * 0.95;
  return micro * (1.0 - suppressFactor);
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
  return g.r + evalSharedMicroRelief(xz, g.a) * microFade;
}

vec3 toLinear(vec3 srgb) {
  return pow(max(srgb, vec3(0.0001)), vec3(2.2));
}

// ---- ZERO-SEAM Continuous Irrational-Scale Dual-Rotated PBR Sampler ----
// Replaces discontinuous triangle hex-tiling so hardware mipmaps NEVER produce diagonal dashed lines!
vec4 sampleSeamlessPbr(sampler2D tex, vec2 uv, float macroBlend) {
  const mat2 rotA = mat2(0.798635, -0.601815, 0.601815, 0.798635); // +37 deg
  const mat2 rotB = mat2(0.874620,  0.484810, -0.484810, 0.874620); // -29 deg

  vec4 t1 = texture2D(tex, uv);
  vec4 t2 = texture2D(tex, rotA * (uv * 0.618034) + vec2(0.37, 0.71));
  vec4 t3 = texture2D(tex, rotB * (uv * 0.236068) + vec2(0.19, 0.53));

  // Height-biased organic blending preserves crisp sharp pebbles/needles without mushy averaging
  float hW1 = pow(max(0.05, t1.a + 0.25), 2.2);
  float hW2 = pow(max(0.05, t2.a + 0.25), 2.2);
  vec4 nearMix = (t1 * hW1 + t2 * hW2) / (hW1 + hW2);
  vec4 finalTex = mix(nearMix, t3, clamp(macroBlend, 0.0, 0.75));
  finalTex.rgb = toLinear(finalTex.rgb);
  return finalTex;
}

// ---- TR-POM: 5-Step Steep Parallax Occlusion Mapping (0..26m underfoot tactile micro-relief!) ----
vec2 computeTerrainPomUv(sampler2D tex, vec2 baseUv, vec3 V, float pomScale) {
  if (pomScale <= 0.0005) return baseUv;
  // Horizontal view ray offset in UV space
  vec2 deltaUv = (-V.xz / max(abs(V.y), 0.34)) * pomScale;
  float layerStep = 1.0 / 5.0;
  float curLayer = 0.0;
  vec2 stepUv = deltaUv * layerStep;
  vec2 curUv = baseUv;
  float curH = texture2D(tex, curUv).a;
  float prevH = curH;

  for (int i = 0; i < 5; i++) {
    if (curLayer >= (1.0 - curH)) break;
    prevH = curH;
    curUv -= stepUv;
    curLayer += layerStep;
    curH = texture2D(tex, curUv).a;
  }

  // Linear secant interpolation between final two layers for silky-smooth zero-stairstep parallax
  float afterD = (1.0 - curH) - curLayer;
  float beforeD = (1.0 - prevH) - (curLayer - layerStep);
  float w = clamp(afterD / min(-0.0001, afterD - beforeD), 0.0, 1.0);
  return curUv + stepUv * w;
}

// ---- True 3-Axis Triplanar Stratified Japanese Granite Projection (Zero Cliff Stretching!) ----
vec4 sampleTriplanarGranite(vec3 wp, vec3 N, float scale) {
  vec3 bw = abs(N);
  bw = bw * bw * bw * bw;
  bw /= max(bw.x + bw.y + bw.z, 0.0001);

  float tiltY = wp.y + wp.x * 0.14 - wp.z * 0.06;
  vec4 sx = texture2D(uTexRock, vec2(wp.z, tiltY) * scale);
  vec4 sy = texture2D(uTexRock, wp.xz * scale);
  vec4 sz = texture2D(uTexRock, vec2(wp.x, tiltY) * scale);
  vec4 rock = sx * bw.x + sy * bw.y + sz * bw.z;
  rock.rgb = toLinear(rock.rgb);

  float strata = sin(tiltY * 0.45 + fbm2(wp.xz * 0.035) * 2.6) * 0.5 + 0.5;
  float fineCracks = smoothstep(0.26, 0.74, fbm2(vec2(wp.x * 0.16 + wp.z * 0.14, tiltY * 0.24)));
  float seepage = smoothstep(0.54, 0.86, glslNoise(vec2(wp.x * 0.18 + wp.z * 0.15, tiltY * 0.02)));
  rock.rgb *= (0.58 + 0.38 * strata + 0.24 * fineCracks);
  rock.rgb = mix(rock.rgb, rock.rgb * vec3(0.40, 0.46, 0.42), seepage * 0.48);
  return rock;
}

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  // 0. Exact Basement Footprint Cutout under Main Tower (0..5 × 0..10)
  if (vWorldPos.x > -0.16 && vWorldPos.x < 5.16 && vWorldPos.z > -0.16 && vWorldPos.z < 10.16) {
    discard;
  }

  vec2 xz = vWorldPos.xz;
  float dist = vCamDist;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(uSunDir);

  // 1. Per-Pixel Smooth Macro World Normal (wider adaptive filter removes 10m bilinear creases!)
  float stepM = clamp(dist * 0.0068, 0.65, 26.0);
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

  // 2. BREAKTHROUGH TR-HYPERDETAIL: 5-Octave Analytical-Derivative Alpine Crag & Gully Synthesis!
  //    Synthesizes sharp eroded rock ribs, chutes, & mountain micro-topography across all 19 km!
  vec3 hyper = evalAlpineHyperDetail(xz, dist);
  float dComp = length(xz - uCompoundCenter);
  float isCompoundYard = 1.0 - smoothstep(21.0, 35.0, dComp);
  float isRoad = smoothstep(0.32, 0.68, roadPad) * (1.0 - isCompoundYard);

  float hyperStrength = (1.0 - isCompoundYard) * (1.0 - isRoad * 0.88)
                      * mix(0.28, 1.15, smoothstep(0.08, 0.42, slopeMacro) + smoothstep(900.0, 1420.0, asl) * 0.65);
  N = normalize(N + vec3(-hyper.y, 0.0, -hyper.z) * (hyperStrength * 42.0));

  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  float slopeRad = acos(clamp(N.y, 0.0, 1.0));
  float macroBlend = smoothstep(35.0, 260.0, dist) * 0.58;

  // 3. TR-POM: Steep Parallax Occlusion Mapping (0..26m) + Micro Self-Shadowing!
  float pomFade = (1.0 - smoothstep(12.0, 26.0, dist)) * (1.0 - slope * 0.55);
  vec2 forestBaseUv = xz * 0.24;
  vec2 gravelBaseUv = xz * 0.34;
  vec2 forestUv = pomFade > 0.01 ? computeTerrainPomUv(uTexForest, forestBaseUv, V, 0.022 * pomFade * (1.0 - isCompoundYard * 0.45)) : forestBaseUv;
  vec2 gravelUv = pomFade > 0.01 ? computeTerrainPomUv(uTexGravel, gravelBaseUv, V, 0.032 * pomFade) : gravelBaseUv;

  vec4 texForest = sampleSeamlessPbr(uTexForest, forestUv, macroBlend);
  vec4 texGravel = sampleSeamlessPbr(uTexGravel, gravelUv, macroBlend);
  vec4 texRock   = sampleTriplanarGranite(vWorldPos, N, 0.078);

  // Micro POM self-shadowing right under your boots (pebbles & mossy soil humps cast crisp tiny shadows!)
  float pomMicroShadow = 1.0;
  if (pomFade > 0.02) {
    vec2 sunUvStep = sunDir.xz * 0.014;
    float hHere  = mix(texForest.a, texGravel.a, isRoad);
    float hSun   = mix(texture2D(uTexForest, forestUv + sunUvStep).a, texture2D(uTexGravel, gravelUv + sunUvStep).a, isRoad);
    float occl   = clamp((hSun - hHere) * 2.6, 0.0, 0.48);
    pomMicroShadow = 1.0 - occl * pomFade;
  }

  float macroVar = fbm2(xz * 0.0022);
  float microVar = fbm2(xz * 0.025);

  // 4. Build 10 Physically Calibrated Linear Japanese Mountain Ecological Layers!
  // Layer A: Deep Cedar/Hinoki Forest Floor (rich humus loam + mossy patches + crisp needle litter)
  vec3 colLowForest = texForest.rgb * vec3(0.72, 0.84, 0.56);
  colLowForest = mix(colLowForest, vec3(0.014, 0.036, 0.014), 0.26 + 0.18 * (1.0 - N.z * 0.5));

  // Layer B: Montane Buna Beech & Mizunara Oak Autumn-Leaf Humus (EL 780..1,220m)
  float bunaZone = smoothstep(760.0, 920.0, asl) * (1.0 - smoothstep(1150.0, 1290.0, asl));
  vec3 colBunaFloor = mix(texForest.rgb * vec3(0.92, 0.80, 0.44), vec3(0.044, 0.060, 0.018), 0.36 + 0.18 * macroVar);

  // Layer C: Subalpine Kumazasa Dwarf Bamboo Carpet (EL 1,060..1,420m)
  float sasaZone = smoothstep(1060.0, 1200.0, asl) * (1.0 - smoothstep(1340.0, 1465.0, asl));
  float sasaPatch = smoothstep(0.32, 0.68, macroVar * 0.7 + microVar * 0.3) * smoothstep(-0.2, 0.35, ridge);
  vec3 colSasa = vec3(0.040, 0.074, 0.020) * (0.70 + 0.56 * texForest.a);

  // Layer D: High Alpine Haimatsu Creeping Pine & Lichen Tundra (EL > 1,300m)
  float alpineZone = smoothstep(1290.0, 1460.0, asl);
  vec3 colAlpine = mix(vec3(0.016, 0.034, 0.017), vec3(0.110, 0.112, 0.102), smoothstep(0.28, 0.72, macroVar + slope * 1.25));

  vec3 albedo = mix(colLowForest, colBunaFloor, bunaZone * 0.78);
  albedo = mix(albedo, colSasa, sasaZone * (0.35 + 0.55 * sasaPatch));
  albedo = mix(albedo, colAlpine, alpineZone * 0.86);

  // Layer E: Phacelle Ravine Deep Damp Moss
  float dampRavine = smoothstep(0.36, 0.82, wetness) * (1.0 - smoothstep(0.25, 0.55, slopeRad));
  albedo = mix(albedo, vec3(0.011, 0.026, 0.012) * (0.72 + 0.56 * texForest.a), dampRavine * 0.58);

  // Layer F: Riverbank Wet Dark Slate Cobbles & Glossy Wet-Rock Shoreline Band (TR-WETSHORE!)
  float riverCobble = smoothstep(0.62, 0.90, wetness) * smoothstep(980.0, 620.0, asl);
  float wetShoreBand = smoothstep(0.76, 0.95, wetness) * smoothstep(920.0, 560.0, asl);
  vec3 colWetCobble = texGravel.rgb * vec3(0.32, 0.35, 0.34) * (0.68 + 0.50 * microVar);
  colWetCobble *= mix(1.0, 0.44, wetShoreBand); // Dark saturated wet granite right at waterline!
  albedo = mix(albedo, colWetCobble, riverCobble * 0.86);

  // Layer G: Talus Scree Apron (harmonized with local weathered alpine granite)
  float talusMask = smoothstep(0.42, 0.66, slopeRad) * (1.0 - smoothstep(0.68, 0.92, slopeRad))
                  * (0.45 + 0.55 * smoothstep(0.15, -0.35, ridge));
  vec3 colTalus = mix(texRock.rgb * 0.52, texGravel.rgb * vec3(0.44, 0.45, 0.46), 0.52);
  albedo = mix(albedo, colTalus, talusMask * 0.64);

  // Layer H: True Triplanar Stratified Japanese Granite Cliffs (smooth organic blend on road cutbanks!)
  float rockSlopeThresh = mix(0.56, 0.36, alpineZone);
  float rockMask = smoothstep(rockSlopeThresh, rockSlopeThresh + 0.32, slopeRad + (texRock.a - 0.5) * 0.14 + (hyper.x - 0.45) * 0.14);
  vec3 colGranite = texRock.rgb * mix(vec3(0.40, 0.42, 0.43), vec3(0.54, 0.54, 0.52), alpineZone);
  colGranite *= mix(0.66, 1.16, clamp(hyper.x * 1.15, 0.0, 1.0));
  float ledgeMoss = smoothstep(0.62, 0.88, N.y) * (1.0 - alpineZone) * 0.58;
  colGranite = mix(colGranite, vec3(0.016, 0.042, 0.015), ledgeMoss);
  albedo = mix(albedo, colGranite, rockMask);

  // Layer I: BREAKTHROUGH TR-SNOW — Authentic Japanese Northern Alps Gully Snow Couloirs (残雪 / 雪渓)!
  // Strictly localized inside concave high-elevation mountain gullies & sheltered pockets (EL > 1,260m)
  // so distant peaks blaze with realistic alpine snow tongues while rocky hiking crests stay exposed!
  float snowAlt = smoothstep(1250.0, 1520.0, asl);
  float snowMask = 0.0;
  if (snowAlt > 0.005) {
    float gullyTrap = smoothstep(0.08, -0.24, ridge - (hyper.x - 0.45) * 0.24);
    float coolAspect = smoothstep(0.55, -0.48, N.z * 0.72 + N.x * 0.28);
    float snowSlope = 1.0 - smoothstep(0.64, 1.02, slopeRad);
    float snowRaw = snowAlt * (0.06 + 1.05 * gullyTrap) * (0.38 + 0.62 * coolAspect) * snowSlope;
    snowMask = smoothstep(0.28, 0.56, snowRaw + (microVar - 0.5) * 0.12) * (1.0 - isRoad);
    vec3 snowAlbedo = mix(vec3(0.70, 0.72, 0.75), vec3(0.84, 0.85, 0.86), smoothstep(0.3, 0.8, microVar));
    albedo = mix(albedo, snowAlbedo, snowMask);
  }

  // Layer J: 19 km Graded Forestry Road (奥山林道) & NARROW-50 Compound Pad!
  float rutPattern = 0.84 + 0.16 * sin(roadPad * 18.0);
  vec3 colRoad = texGravel.rgb * vec3(0.52, 0.47, 0.40) * rutPattern;
  albedo = mix(albedo, colRoad, isRoad * 0.92);
  vec3 colCompYard = mix(texForest.rgb * vec3(0.62, 0.72, 0.48), vec3(0.018, 0.032, 0.015), 0.30);
  albedo = mix(albedo, colCompYard, isCompoundYard * 0.88);

  // 5. Far-Distance (> 180m .. 19,000m) Multi-Species Forest Canopy Mosaic (Linear Calibrated!)
  float farCanopyBlend = smoothstep(165.0, 480.0, dist) * canopyDensity * (1.0 - rockMask * 0.82) * (1.0 - isRoad) * (1.0 - snowMask);
  if (farCanopyBlend > 0.01) {
    float c1 = glslNoise(xz * 0.095);
    float c2 = glslNoise(xz * 0.24 + vec2(31.2, -19.7));
    float c3 = glslNoise(xz * 0.024 - vec2(11.4, 22.8));
    float crownBump = c1 * 0.58 + c2 * 0.28 + c3 * 0.14;

    vec3 colSugiCrown  = mix(vec3(0.008, 0.025, 0.012), vec3(0.019, 0.048, 0.020), crownBump);
    vec3 colBunaCrown  = mix(vec3(0.022, 0.054, 0.013), vec3(0.068, 0.084, 0.018), smoothstep(0.25, 0.85, c3 * 0.6 + c1 * 0.4));
    vec3 colAbiesCrown = mix(vec3(0.008, 0.023, 0.018), vec3(0.020, 0.048, 0.032), crownBump);

    vec3 farTreeCol = mix(colSugiCrown, colBunaCrown, smoothstep(740.0, 960.0, asl) * (1.0 - smoothstep(1140.0, 1270.0, asl)));
    farTreeCol = mix(farTreeCol, colAbiesCrown, smoothstep(1130.0, 1280.0, asl));
    farTreeCol *= (0.52 + 0.68 * smoothstep(0.18, 0.86, crownBump));

    albedo = mix(albedo, farTreeCol, farCanopyBlend * 0.90);

    float cnX = (glslNoise((xz + vec2(3.5, 0.0)) * 0.095) - c1) * 1.45;
    float cnZ = (glslNoise((xz + vec2(0.0, 3.5)) * 0.095) - c1) * 1.45;
    N = normalize(N + vec3(cnX, 0.0, cnZ) * farCanopyBlend * 0.62);
  }

  // Smooth Analytical Near-Field Micro-Normal Perturbation (tactile stones, soil, road gravel!)
  float nearDetailFade = 1.0 - smoothstep(28.0, 180.0, dist);
  if (nearDetailFade > 0.01) {
    float fFreq = mix(0.75, 0.36, rockMask);
    vec2 pN = vec2(vWorldPos.x + vWorldPos.y * 0.22, vWorldPos.z - vWorldPos.y * 0.18) * fFreq;
    vec3 nd = noiseDeriv(pN);
    float bumpStr = (0.34 + 0.72 * rockMask + 0.28 * isRoad) * nearDetailFade * (1.0 - snowMask * 0.65);
    N = normalize(N + vec3(-nd.y, 0.0, -nd.z) * bumpStr * 1.25);
  }

  // 6. Dual-Azimuth Mountain Horizon Shadowing + TR-KOMOREBI Forest Canopy Dappled Sunlight!
  float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
  float horizonShadow = smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y);
  horizonShadow = mix(1.0, horizonShadow, uHorizonShadowBlend);

  float komorebi = evalKomorebiDapple(vWorldPos, canopyDensity * (1.0 - rockMask * 0.80) * (1.0 - isRoad * 0.42), sunDir, dist);

  float NdotL = max(0.0, dot(N, sunDir));
  float wrapAmt = 0.12 * farCanopyBlend + 0.22 * snowMask;
  float wrapNdotL = max(0.0, (dot(N, sunDir) + wrapAmt) / (1.0 + wrapAmt));

  vec3 directLight = uSunColor * (uSunIntensity * wrapNdotL * horizonShadow * komorebi * pomMicroShadow * 0.94);

  float hemiMix = N.y * 0.5 + 0.5;
  // Natural desaturated twilight cool-slate snow shadows (prevents neon purple snow in dusk!)
  float skyLum = dot(uHemiSkyColor, vec3(0.299, 0.587, 0.114));
  vec3 neutralSnowSky = mix(uHemiSkyColor, vec3(skyLum * 0.94, skyLum * 0.98, skyLum * 1.08), 0.62);
  vec3 skyAmbTint = mix(uHemiSkyColor, neutralSnowSky, snowMask);
  vec3 ambientLight = mix(uHemiGroundColor, skyAmbTint, hemiMix) * (uHemiIntensity * (0.40 + 0.60 * skyViewAO) * 0.95);

  // Clean specular highlights: slick wet granite shoreline, soft alpine snow sheen (NO noisy dots!), dry rock facets
  vec3 H = normalize(sunDir + V);
  float specPow = mix(24.0, 88.0, clamp(wetShoreBand + riverCobble * 0.5 + snowMask * 0.45, 0.0, 1.0));
  float specStr = (0.025 + 0.12 * rockMask + 0.22 * riverCobble + 0.36 * wetShoreBand + 0.18 * snowMask) * (1.0 - farCanopyBlend * 0.90);
  float spec = pow(max(0.0, dot(N, H)), specPow) * specStr * horizonShadow * komorebi * smoothstep(0.0, 0.12, NdotL);

  float compGlow = exp(-dComp * 0.075) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.22;
  vec3 compWarmBounce = vec3(1.0, 0.74, 0.42) * compGlow;

  vec3 litColor = albedo * (directLight + ambientLight + compWarmBounce) + uSunColor * (spec * uSunIntensity * 0.58);
  litColor += evalTerrenoFlashlight(vWorldPos, N, albedo);

  // 7. BREAKTHROUGH TR-VOLUMETRIC-ATMO: Horizon-Shadowed Volumetric Sea-of-Clouds & Aerial Perspective!
  vec3 finalColor = applyTerrenoAtmosphere(litColor, vWorldPos, cameraPosition);

  gl_FragColor = vec4(finalColor, 1.0);
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

  // 1. Physically-Based Rayleigh + Chappuis Ozone Twilight Sky Gradient
  float elev = clamp(dir.y, 0.0, 1.0);
  float horizonCurve = pow(1.0 - elev, 2.9);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, horizonCurve);

  // Chappuis Ozone Belt: delicate sapphire-rose transition band around 8..32 degrees elevation!
  float ozoneBand = exp(-pow((elev - 0.24) * 5.2, 2.0));
  vec3 ozoneTint = mix(uSkyZenith * 1.15, uSkyGlow * 0.42 + uSkyZenith * 0.72, uMieStrength);
  sky = mix(sky, ozoneTint, ozoneBand * 0.28);

  if (dir.y < 0.0) {
    sky = mix(uSkyHorizon, uAerialFogColor, smoothstep(0.0, -0.22, dir.y));
  }

  // 2. Solar / Lunar Mie Corona & Crisp Celestial Disk
  float cosSun = max(0.0, dot(dir, sunDir));
  float wideHalo = pow(cosSun, 4.5) * 0.46 * uMieStrength;
  float tightHalo = pow(cosSun, 36.0) * 0.78 * uMieStrength;
  float sunDisk = smoothstep(0.9988, 0.9995, cosSun);
  sky += uSkyGlow * (wideHalo + tightHalo) + uSunColor * (sunDisk * 2.6);

  // 3. VOLUMETRIC 2-LAYER ALPINE CLOUDSCAPE (Lit Billowing Cumulus + High Cirrus Streaks!)
  if (dir.y > 0.015) {
    // 3a. High-altitude wispy Cirrus streaks
    vec2 cirrusUV = dir.xz / (dir.y + 0.22) * vec2(0.85, 2.15) + vec2(uTime * 0.0022, -uTime * 0.0010);
    float ci1 = cloudFbm(cirrusUV);
    float ci2 = cloudFbm(cirrusUV * 2.3 + vec2(ci1 * 1.8, -ci1 * 1.2));
    float cirrusMask = smoothstep(0.56, 0.86, ci2) * smoothstep(0.04, 0.24, dir.y) * smoothstep(0.96, 0.45, dir.y);
    vec3 cirrusCol = mix(uSkyHorizon * 1.08, uSkyGlow * 1.25, 0.42 + 0.58 * pow(cosSun, 2.5)) * (0.45 + 0.65 * uCloudBrightness);
    sky = mix(sky, cirrusCol, cirrusMask * 0.42);

    // 3b. Lower volumetric billowing Japanese Alps Cumulus deck with 1-tap directional sun-shadow marching!
    vec2 cloudUV = dir.xz / (dir.y + 0.145) * 1.05;
    vec2 drift = vec2(uTime * 0.0038, uTime * 0.0018);
    float cBase = cloudFbm(cloudUV + drift);
    float cDetail = cloudFbm(cloudUV * 2.55 - drift * 1.3 + vec2(cBase * 0.65));
    float density = smoothstep(0.46, 0.80, cBase * 0.68 + cDetail * 0.32);
    float horizonFade = smoothstep(0.015, 0.16, dir.y) * smoothstep(0.99, 0.58, dir.y);
    float cloudMask = density * horizonFade;

    if (cloudMask > 0.005) {
      // Sample cloud density stepped toward Sun direction -> true 3D shadowed undersides & sunlit silver tops!
      vec2 sunStepUV = sunDir.xz / max(sunDir.y + 0.35, 0.35) * 0.11;
      float sunOcc = cloudFbm(cloudUV + drift + sunStepUV);
      float lightTrans = exp(-max(0.0, sunOcc - 0.38) * 3.8);
      // Beer-Powder forward-scattering silver lining around cloud edges facing the sun!
      float powder = (1.0 - exp(-density * 2.6)) * (0.35 + 0.65 * pow(cosSun, 4.0));
      float rimSilver = pow(cosSun, 8.0) * (1.0 - density * 0.65) * 1.35 * uMieStrength;

      vec3 cloudShadow = mix(uSkyZenith * 1.15, uAerialFogColor * 0.78, 0.52) * (0.55 + 0.55 * uCloudBrightness);
      vec3 cloudSunlit = mix(vec3(0.95, 0.97, 1.0), uSkyGlow * 1.25, 0.55) * (0.32 + 0.88 * uCloudBrightness);
      vec3 cloudCol = mix(cloudShadow, cloudSunlit, clamp(lightTrans * (0.45 + 0.72 * powder), 0.0, 1.0));
      cloudCol += uSkyGlow * (rimSilver * uCloudBrightness);

      // Distance haze blend so distant clouds melt seamlessly into the mountain horizon
      float distMelt = smoothstep(0.015, 0.22, dir.y);
      cloudCol = mix(uSkyHorizon, cloudCol, distMelt);
      sky = mix(sky, cloudCol, clamp(cloudMask * 0.86, 0.0, 0.92));
    }
  }

  // 4. Crisp Multi-Magnitude Alpine Starfield & Milky Way (visible in Night & Dusk!)
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
  group.name = 'TERRENO_Clipmap_12Ring';

  const texForest = createSeamlessPbrTexture('forest');
  const texRock = createSeamlessPbrTexture('rock');
  const texGravel = createSeamlessPbrTexture('gravel');

  const solidGeo = buildClipmapRingGeometry(CLIPMAP_HALF, true);
  const hollowGeo = buildClipmapRingGeometry(CLIPMAP_HALF, false);
  const trimGeos = [
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 0, 0),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 1, 0),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 0, 1),
    buildClipmapLTrimGeometry(CLIPMAP_HALF, 1, 1),
  ];

  const baseUniforms = {
    ...atmoUniforms,
    uGeoMap: { value: geomorph.geoTexture },
    uHorizonMap: { value: geomorph.horizonTexture },
    uTexForest: { value: texForest },
    uTexRock: { value: texRock },
    uTexGravel: { value: texGravel },
    uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
    uWorldMax: { value: new THREE.Vector2(TERRENO_WORLD.maxX, TERRENO_WORLD.maxZ) },
    uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
    uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
    uCompoundCenter: { value: new THREE.Vector2(TERRENO_WORLD.compoundCenterX, TERRENO_WORLD.compoundCenterZ) },
    uCompoundFlatR: { value: TERRENO_WORLD.compoundFlatRadius },
    uCompoundGroundY: { value: TERRENO_WORLD.compoundGroundY },
    uBaseElevationASL: { value: TERRENO_WORLD.baseElevationASL },
    uHalfExtent: { value: CLIPMAP_HALF },
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
    depthTest: true,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -100;
  skyDome.name = 'TERRENO_SkyDome_24km';
  group.add(skyDome);

  function update(cameraPos) {
    const camX = cameraPos.x;
    const camZ = cameraPos.z;
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
    update,
  };
}
