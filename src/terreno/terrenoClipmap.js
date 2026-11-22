import * as THREE from 'three';
import { TERRENO_WORLD } from './terrenoConfig.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO Engine — Breakthrough 3, 5 & 6:
 *   - 12-Ring Crack-Free GPU Geomorphing Geometry Clipmaps (0.5m underfoot -> 28km horizon)
 *     with exact Losasso & Hoppe L-Trims and outer 22% odd-vertex horizontal morph snapping!
 *   - Morten Mikkelsen (JCGT 2022) Stochastic Hex-Tiling + True 3-Axis Triplanar Stratified Granite
 *   - 9 Japanese Mountain Ecological Layers + Far-Distance Multi-Species Forest Canopy Normal/Color Mosaic
 *   - Dual-Azimuth Precomputed Mountain Horizon Shadows + 8-Dir Sky-View AO
 *   - 24,000 m Procedural Atmospheric Sky Dome (Rayleigh, Mie Halo, Drifting Alpine Clouds, Starfield)
 */

const CLIPMAP_HALF = 28; // 56×56 cells per ring (inner hole [-14..+15])
const CLIPMAP_LEVELS = 12; // L=0 (0.5m) .. L=11 (1024m, outer ±28.7km covers full 19km from any rim!)

// Fast deterministic PRNG for seamless procedural PBR ground textures
function makeSeededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

/**
 * Generate a 512×512 seamless toroidal PBR Albedo(RGB) + MicroHeight(A) CanvasTexture.
 * Zero external image fetches, crisp millimeter detail under Mikkelsen Hex-Tiling!
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

  // Build seamless 2D periodic value noise pyramid (tileable at 8, 16, 32, 64, 128 freqs)
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
      const fbm = n1 * 0.34 + n2 * 0.28 + n3 * 0.20 + n4 * 0.12 + n5 * 0.06;

      let r = 0, g = 0, b = 0, h = fbm;
      if (kind === 'forest') {
        // Rich Japanese cedar forest floor: dark humus soil, lush moss tufts, amber fallen needles
        const mossPatch = Math.max(0, Math.min(1, (n1 * 0.6 + n2 * 0.4 - 0.36) * 2.9));
        const needleSpec = Math.max(0, Math.min(1, (n4 * 0.65 + n5 * 0.35 - 0.56) * 3.8));
        const soilR = 46 + fbm * 34;
        const soilG = 40 + fbm * 28;
        const soilB = 30 + fbm * 18;
        const mossR = 44 + n3 * 36;
        const mossG = 78 + n2 * 48 + n4 * 16;
        const mossB = 34 + n3 * 22;
        r = soilR * (1 - mossPatch) + mossR * mossPatch + needleSpec * 34;
        g = soilG * (1 - mossPatch) + mossG * mossPatch + needleSpec * 18;
        b = soilB * (1 - mossPatch) + mossB * mossPatch + needleSpec * 4;
        h = fbm * 0.65 + mossPatch * 0.25 + n5 * 0.10;
      } else if (kind === 'rock') {
        // Stratified Japanese Granite & Metamorphic Schist with dark fissures & pale quartz grain
        const ridge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
        const crack = Math.pow(1.0 - Math.abs(n3 * 2.0 - 1.0), 4.0);
        const strata = Math.sin((v * 6.0 + n1 * 0.65 + n2 * 0.25) * Math.PI * 2.0) * 0.5 + 0.5;
        const base = 78 + fbm * 58 + strata * 24 - crack * 52;
        const speck = (n5 - 0.5) * 36;
        const lichen = Math.max(0, (n1 * 0.55 + n3 * 0.45 - 0.66) * 3.2);
        r = base + speck + lichen * 18;
        g = base + speck * 0.96 + 3 + lichen * 34;
        b = base + speck * 0.92 + 7 + lichen * 10;
        h = Math.max(0.02, Math.min(0.98, 0.45 + ridge * 0.35 + strata * 0.18 - crack * 0.48));
      } else {
        // Crushed Forestry Road Macadam Gravel & River Cobble Grain
        const pebble = Math.pow(n4 * 0.55 + n5 * 0.45, 1.35);
        const dust = n1 * 0.5 + n2 * 0.5;
        const base = 96 + dust * 38 + (pebble - 0.38) * 76;
        r = base + 8;
        g = base + 5;
        b = base - 2;
        h = Math.max(0.05, Math.min(0.98, 0.35 + pebble * 0.55 + dust * 0.10));
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
  tex.colorSpace = THREE.NoColorSpace; // Keep raw linear RGB+Height for direct shader math!
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build a flat integer-grid Clipmap Ring BufferGeometry (positions store (gx, 0, gz) in integer ring cells!).
 * - solid=true (Ring 0): full [-HALF, +HALF] × [-HALF, +HALF]
 * - solid=false (Rings 1..11): [-HALF, +HALF]^2 minus permanent hole (-14, +15) × (-14, +15)
 */
function buildClipmapRingGeometry(half, solid) {
  const minG = -half;
  const maxG = half;
  const holeMin = -half / 2;       // -14
  const holeMax = half / 2 + 1;    // +15
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
        // Quad covers [gx, gx+1] × [gz, gz+1]. Skip if inside permanent hole [-14, +15) × [-14, +15).
        if (gx >= holeMin && gx < holeMax && gz >= holeMin && gz < holeMax) {
          continue;
        }
      }
      const a = getVert(gx, gz);
      const b = getVert(gx + 1, gz);
      const c = getVert(gx, gz + 1);
      const d = getVert(gx + 1, gz + 1);
      // Upward-facing (+Y normal) CCW winding when viewed from +Y looking down (-Y):
      // (gx, gz) -> (gx, gz+1) -> (gx+1, gz) has cross (0,0,1) x (1,0,0) = (0,+1,0)
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Build one of the 4 exact Losasso & Hoppe L-Trim BufferGeometries filling the 1-cell border
 * inside Ring L's permanent hole [-14, +15] around Ring L-1's shifted footprint.
 * Guarantees 100% consistent +Y upward front-facing winding for all 4 (ox, oz) ∈ {0,1}×{0,1}!
 */
function buildClipmapLTrimGeometry(half, ox, oz) {
  const holeMin = -half / 2;    // -14
  const holeMax = half / 2 + 1; // +15
  // Ring L-1 sits at [holeMin + ox, holeMin + ox + half] (width = half = 28)
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
      // Skip cells covered by Ring L-1
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

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;

// Bit-exact match with terrenoGeomorphology.js CPU evalSharedMicroRelief()
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

// 4-Tap IEEE-754 Exact Bilinear Sampler for RGBA32F NearestFilter DataTexture (Zero WebGL2 extensions!)
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
  // 1. Crack-Free Outer 22% Odd-Vertex Horizontal Geomorphing (0.000mm T-junctions!)
  vec2 g = position.xz;
  float edgeFrac = max(abs(g.x), abs(g.y)) / uHalfExtent;
  float morph = smoothstep(0.76, 0.995, edgeFrac) * uMorphEnable;
  vec2 odd = abs(mod(g, 2.0));
  vec2 gMorphed = g - odd * morph;

  vec2 xz = uRingOrigin + gMorphed * uGridStep;

  // 2. Sample Geomorphology Atlas + Exact Shared Micro-Relief
  vec4 geo = sampleGeoBilinear(xz);
  float y = geo.r + evalSharedMicroRelief(xz, geo.a);

  // Exact compound clearing flat lock (parity with CPU getHeightAt)
  float dComp = length(xz - uCompoundCenter);
  if (dComp <= uCompoundFlatR - 2.0) {
    y = uCompoundGroundY;
  }

  // 3. Seamless Distant Alpine Foothill Skirt beyond 5km × 19km world rim (zero floating cut-off edge!)
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

// ---- Shared Noise & Geomorphology Samplers (for ultra-crisp per-pixel normals!) ----
float sinHash2(vec2 p) {
  return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
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

// Convert procedural sRGB canvas texture to true Linear RGB (eliminates double-gamma washout!)
vec3 toLinear(vec3 srgb) {
  return pow(max(srgb, vec3(0.0001)), vec3(2.2));
}

// ---- Morten Mikkelsen (JCGT 2022) Stochastic Hex-Tiling (Zero Visible Repetition!) ----
vec4 sampleHexTile(sampler2D tex, vec2 uv, float distFade) {
  if (distFade <= 0.01) {
    vec4 s0 = texture2D(tex, uv);
    return vec4(toLinear(s0.rgb), s0.a);
  }
  const mat2 M = mat2(1.0, 0.0, -0.57735027, 1.15470054);
  vec2 s = M * uv;
  vec2 si = floor(s);
  vec2 sf = fract(s);

  vec2 v1, v2, v3;
  vec3 w;
  if (sf.x > sf.y) {
    v1 = si;
    v2 = si + vec2(1.0, 0.0);
    v3 = si + vec2(1.0, 1.0);
    w = vec3(1.0 - sf.x, sf.x - sf.y, sf.y);
  } else {
    v1 = si;
    v2 = si + vec2(0.0, 1.0);
    v3 = si + vec2(1.0, 1.0);
    w = vec3(1.0 - sf.y, sf.y - sf.x, sf.x);
  }

  vec2 h1 = hash22(v1);
  vec2 h2 = hash22(v2);
  vec2 h3 = hash22(v3);

  float a1 = h1.x * 6.2831853;
  float a2 = h2.x * 6.2831853;
  float a3 = h3.x * 6.2831853;
  mat2 r1 = mat2(cos(a1), -sin(a1), sin(a1), cos(a1));
  mat2 r2 = mat2(cos(a2), -sin(a2), sin(a2), cos(a2));
  mat2 r3 = mat2(cos(a3), -sin(a3), sin(a3), cos(a3));

  vec4 t1 = texture2D(tex, r1 * (uv + h1 * 7.3));
  vec4 t2 = texture2D(tex, r2 * (uv + h2 * 7.3));
  vec4 t3 = texture2D(tex, r3 * (uv + h3 * 7.3));

  vec3 hw = w * (vec3(0.22) + vec3(t1.a, t2.a, t3.a));
  hw = hw * hw * hw;
  hw /= max(hw.x + hw.y + hw.z, 0.0001);

  vec4 hexCol = t1 * hw.x + t2 * hw.y + t3 * hw.z;
  hexCol.rgb = toLinear(hexCol.rgb);
  if (distFade >= 0.99) return hexCol;
  vec4 plain = texture2D(tex, uv);
  plain.rgb = toLinear(plain.rgb);
  return mix(plain, hexCol, distFade);
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

  // Authentic dark Japanese granite/andesite bedding ledges & mineral seepage
  float strata = sin(tiltY * 0.45 + fbm2(wp.xz * 0.035) * 2.6) * 0.5 + 0.5;
  float fineCracks = smoothstep(0.28, 0.72, fbm2(vec2(wp.x * 0.16 + wp.z * 0.14, tiltY * 0.24)));
  float seepage = smoothstep(0.54, 0.86, glslNoise(vec2(wp.x * 0.18 + wp.z * 0.15, tiltY * 0.02)));
  rock.rgb *= (0.62 + 0.36 * strata + 0.22 * fineCracks);
  rock.rgb = mix(rock.rgb, rock.rgb * vec3(0.42, 0.48, 0.44), seepage * 0.48);
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

  // 1. Per-Pixel Analytical World Normal (smooth adaptive finite-difference step!)
  float stepM = clamp(dist * 0.0045, 0.55, 16.0);
  float microFade = 1.0 - smoothstep(120.0, 480.0, dist);
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
  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  float slopeRad = acos(clamp(N.y, 0.0, 1.0));
  float hexFade = 1.0 - smoothstep(160.0, 340.0, dist);

  // 2. Sample Linearized Stochastic Hex-Tiled & Triplanar Base PBR Textures
  vec4 texForest = sampleHexTile(uTexForest, xz * 0.16, hexFade);
  vec3 texForestMacro = toLinear(texture2D(uTexForest, xz * 0.018).rgb);
  vec4 texGravel = sampleHexTile(uTexGravel, xz * 0.25, hexFade);
  vec4 texRock = sampleTriplanarGranite(vWorldPos, N, 0.072);

  float macroVar = fbm2(xz * 0.0022);
  float microVar = fbm2(xz * 0.022);

  // 3. Build 9 Physically Calibrated Linear Japanese Mountain Ecological Layers!
  // Layer A: Deep Cedar/Hinoki Forest Floor (rich dark humus + velvety yakushima moss)
  vec3 colLowForest = mix(texForest.rgb, texForestMacro, 0.30) * vec3(0.68, 0.84, 0.56);
  colLowForest = mix(colLowForest, vec3(0.014, 0.040, 0.015), 0.32 + 0.22 * (1.0 - N.z * 0.5));

  // Layer B: Montane Buna Beech & Mizunara Oak Humus (EL 780..1,220m)
  float bunaZone = smoothstep(760.0, 920.0, asl) * (1.0 - smoothstep(1150.0, 1290.0, asl));
  vec3 colBunaFloor = mix(texForest.rgb * vec3(0.88, 0.82, 0.48), vec3(0.042, 0.062, 0.018), 0.38 + 0.18 * macroVar);

  // Layer C: Subalpine Kumazasa Dwarf Bamboo Carpet (EL 1,060..1,420m)
  float sasaZone = smoothstep(1060.0, 1200.0, asl) * (1.0 - smoothstep(1340.0, 1465.0, asl));
  float sasaPatch = smoothstep(0.32, 0.68, macroVar * 0.7 + microVar * 0.3) * smoothstep(-0.2, 0.35, ridge);
  vec3 colSasa = vec3(0.042, 0.078, 0.020) * (0.72 + 0.52 * texForest.a);

  // Layer D: High Alpine Haimatsu Creeping Pine & Lichen Tundra (EL > 1,340m)
  float alpineZone = smoothstep(1320.0, 1470.0, asl);
  vec3 colAlpine = mix(vec3(0.018, 0.038, 0.018), vec3(0.115, 0.118, 0.106), smoothstep(0.32, 0.72, macroVar + slope * 1.3));

  vec3 albedo = mix(colLowForest, colBunaFloor, bunaZone * 0.78);
  albedo = mix(albedo, colSasa, sasaZone * (0.35 + 0.55 * sasaPatch));
  albedo = mix(albedo, colAlpine, alpineZone * 0.85);

  // Layer E: Phacelle Ravine Deep Damp Moss
  float dampRavine = smoothstep(0.36, 0.82, wetness) * (1.0 - smoothstep(0.25, 0.55, slopeRad));
  albedo = mix(albedo, vec3(0.012, 0.028, 0.012) * (0.72 + 0.56 * texForest.a), dampRavine * 0.60);

  // Layer F: Riverbank Wet Dark Slate Cobbles & Mossy Shore
  float riverCobble = smoothstep(0.65, 0.92, wetness) * smoothstep(980.0, 620.0, asl);
  vec3 colWetCobble = texGravel.rgb * vec3(0.34, 0.38, 0.36) * (0.68 + 0.50 * microVar);
  albedo = mix(albedo, colWetCobble, riverCobble * 0.84);

  // Layer G: Talus Scree Apron
  float talusMask = smoothstep(0.44, 0.68, slopeRad) * (1.0 - smoothstep(0.68, 0.92, slopeRad)) * (0.45 + 0.55 * smoothstep(0.15, -0.35, ridge));
  vec3 colTalus = texGravel.rgb * vec3(0.46, 0.47, 0.48);
  albedo = mix(albedo, colTalus, talusMask * 0.68);

  // Layer H: True Triplanar Stratified Japanese Granite Cliffs (authentic dark volcanic/granitic slate!)
  float rockSlopeThresh = mix(0.56, 0.36, alpineZone);
  float rockMask = smoothstep(rockSlopeThresh, rockSlopeThresh + 0.24, slopeRad + (texRock.a - 0.5) * 0.14);
  vec3 colGranite = texRock.rgb * mix(vec3(0.46, 0.48, 0.50), vec3(0.64, 0.63, 0.60), alpineZone);
  float ledgeMoss = smoothstep(0.64, 0.90, N.y) * (1.0 - alpineZone) * 0.58;
  colGranite = mix(colGranite, vec3(0.018, 0.044, 0.016), ledgeMoss);
  albedo = mix(albedo, colGranite, rockMask);

  // Layer I: 19 km Graded Forestry Road (奥山林道) & NARROW-50 Compound Pad!
  float dComp = length(xz - uCompoundCenter);
  float isCompoundYard = 1.0 - smoothstep(22.0, 36.0, dComp);
  float isRoad = smoothstep(0.32, 0.68, roadPad) * (1.0 - isCompoundYard);
  float rutPattern = 0.82 + 0.18 * sin(roadPad * 18.0);
  vec3 colRoad = texGravel.rgb * vec3(0.52, 0.48, 0.41) * rutPattern;
  albedo = mix(albedo, colRoad, isRoad * 0.92);
  vec3 colCompYard = mix(texForest.rgb * vec3(0.58, 0.72, 0.48), vec3(0.016, 0.032, 0.015), 0.38);
  albedo = mix(albedo, colCompYard, isCompoundYard * 0.88);

  // 4. BREAKTHROUGH: Far-Distance (> 180m .. 19,000m) Multi-Species Forest Canopy Illusion (Linear Calibrated!)
  float farCanopyBlend = smoothstep(160.0, 480.0, dist) * canopyDensity * (1.0 - rockMask * 0.82) * (1.0 - isRoad);
  if (farCanopyBlend > 0.01) {
    float c1 = glslNoise(xz * 0.095);
    float c2 = glslNoise(xz * 0.24 + vec2(31.2, -19.7));
    float c3 = glslNoise(xz * 0.024 - vec2(11.4, 22.8));
    float crownBump = c1 * 0.58 + c2 * 0.28 + c3 * 0.14;

    // Authentic linear Japanese alpine canopy palette (velvety deep cedar + rich olive-gold buna!)
    vec3 colSugiCrown = mix(vec3(0.008, 0.026, 0.013), vec3(0.020, 0.052, 0.022), crownBump);
    vec3 colBunaCrown = mix(vec3(0.024, 0.058, 0.014), vec3(0.072, 0.088, 0.018), smoothstep(0.25, 0.85, c3 * 0.6 + c1 * 0.4));
    vec3 colAbiesCrown = mix(vec3(0.009, 0.024, 0.019), vec3(0.022, 0.052, 0.034), crownBump);

    vec3 farTreeCol = mix(colSugiCrown, colBunaCrown, smoothstep(740.0, 960.0, asl) * (1.0 - smoothstep(1140.0, 1270.0, asl)));
    farTreeCol = mix(farTreeCol, colAbiesCrown, smoothstep(1130.0, 1280.0, asl));
    farTreeCol *= (0.55 + 0.65 * smoothstep(0.20, 0.85, crownBump));

    albedo = mix(albedo, farTreeCol, farCanopyBlend * 0.90);

    // Smooth analytical treetop dome normals catching raking Dawn/Dusk mountain sun!
    float cnX = (glslNoise((xz + vec2(3.5, 0.0)) * 0.095) - c1) * 1.35;
    float cnZ = (glslNoise((xz + vec2(0.0, 3.5)) * 0.095) - c1) * 1.35;
    N = normalize(N + vec3(cnX, 0.0, cnZ) * farCanopyBlend * 0.60);
  }

  // Smooth Analytical Micro-Normal Perturbation (ZERO blocky 2×2 dFdx/dFdy artifacts at ANY distance!)
  float nearDetailFade = 1.0 - smoothstep(35.0, 220.0, dist);
  if (nearDetailFade > 0.01) {
    float fFreq = mix(0.65, 0.34, rockMask);
    vec2 pN = vec2(vWorldPos.x + vWorldPos.y * 0.25, vWorldPos.z - vWorldPos.y * 0.20) * fFreq;
    float m0 = fbm2(pN);
    float mX = fbm2(pN + vec2(0.18, 0.0)) - m0;
    float mZ = fbm2(pN + vec2(0.0, 0.18)) - m0;
    float bumpStr = (0.28 + 0.65 * rockMask + 0.22 * isRoad) * nearDetailFade;
    N = normalize(N + vec3(-mX, 0.0, -mZ) * bumpStr * 2.2);
  }

  // 5. BREAKTHROUGH 4: Dual-Azimuth Mountain Horizon Shadowing + Physically Calibrated Lighting!
  vec3 sunDir = normalize(uSunDir);
  float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
  float horizonShadow = smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y);
  horizonShadow = mix(1.0, horizonShadow, uHorizonShadowBlend);

  float NdotL = max(0.0, dot(N, sunDir));
  float wrapNdotL = max(0.0, (dot(N, sunDir) + 0.12 * farCanopyBlend) / (1.0 + 0.12 * farCanopyBlend));

  vec3 directLight = uSunColor * (uSunIntensity * wrapNdotL * horizonShadow * 0.92);

  float hemiMix = N.y * 0.5 + 0.5;
  vec3 ambientLight = mix(uHemiGroundColor, uHemiSkyColor, hemiMix) * (uHemiIntensity * (0.40 + 0.60 * skyViewAO) * 0.95);

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(sunDir + V);
  float specPow = mix(22.0, 76.0, riverCobble + wetness * 0.35);
  float specStr = (0.025 + 0.12 * rockMask + 0.28 * riverCobble) * (1.0 - farCanopyBlend * 0.90);
  float spec = pow(max(0.0, dot(N, H)), specPow) * specStr * horizonShadow * smoothstep(0.0, 0.12, NdotL);

  float compGlow = exp(-dComp * 0.075) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.22;
  vec3 compWarmBounce = vec3(1.0, 0.74, 0.42) * compGlow;

  vec3 litColor = albedo * (directLight + ambientLight + compWarmBounce) + uSunColor * (spec * uSunIntensity * 0.55);
  litColor += evalTerrenoFlashlight(vWorldPos, N, albedo);

  // 6. BREAKTHROUGH 6: Exact Analytical Exponential Height Fog (雲海) + Rayleigh/Mie Aerial Perspective!
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
  for (int i = 0; i < 4; i++) {
    v += a * sNoise(p);
    p = rot * p * 2.08 + vec2(11.3, 7.9);
    a *= 0.48;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vRayDir);
  vec3 sunDir = normalize(uSunDir);

  // 1. Rayleigh Zenith-to-Horizon Sky Gradient
  float elev = clamp(dir.y, 0.0, 1.0);
  float horizonCurve = pow(1.0 - elev, 2.85);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, horizonCurve);

  // Below horizon softly blends into mountain haze so valley gaps never show black void
  if (dir.y < 0.0) {
    sky = mix(uSkyHorizon, uAerialFogColor, smoothstep(0.0, -0.22, dir.y));
  }

  // 2. Solar / Lunar Mie Corona & Crisp Celestial Disk
  float cosSun = max(0.0, dot(dir, sunDir));
  float wideHalo = pow(cosSun, 5.0) * 0.45 * uMieStrength;
  float tightHalo = pow(cosSun, 42.0) * 0.75 * uMieStrength;
  float sunDisk = smoothstep(0.9988, 0.9995, cosSun);
  sky += uSkyGlow * (wideHalo + tightHalo) + uSunColor * (sunDisk * 2.4);

  // 3. Procedural Drifting Japanese Alpine Cirrus & Cumulus Cloud Deck
  if (dir.y > 0.02) {
    vec2 cloudUV = dir.xz / (dir.y + 0.16) * 1.15;
    vec2 drift = vec2(uTime * 0.0045, uTime * 0.0022);
    float cBase = cloudFbm(cloudUV + drift);
    float cDetail = cloudFbm(cloudUV * 2.4 - drift * 1.4);
    float cloudMask = smoothstep(0.46, 0.78, cBase * 0.72 + cDetail * 0.28);
    // Fade clouds cleanly toward the horizon for crisp atmospheric depth
    cloudMask *= smoothstep(0.02, 0.18, dir.y) * smoothstep(0.98, 0.55, dir.y);

    // Silver/golden cloud edge rim facing Sun/Moon
    float rimLight = pow(cosSun, 3.0) * 0.75 + 0.25;
    vec3 cloudDark = mix(uSkyZenith * 1.35, uSkyHorizon * 0.72, 0.55);
    vec3 cloudLit = mix(uSkyHorizon * 1.05, uSkyGlow * 1.18, 0.52 * rimLight) * uCloudBrightness;
    vec3 cloudCol = mix(cloudDark, cloudLit, smoothstep(0.35, 0.85, cDetail) * 0.65 + 0.35 * rimLight);
    sky = mix(sky, cloudCol, cloudMask * 0.72);
  }

  // 4. Crisp Multi-Magnitude Alpine Starfield (visible in Night & Dusk!)
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
    // Subtle Milky Way diagonal glow across night zenith
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

  // Generate 3 seamless procedural 512×512 PBR textures once
  const texForest = createSeamlessPbrTexture('forest');
  const texRock = createSeamlessPbrTexture('rock');
  const texGravel = createSeamlessPbrTexture('gravel');

  // Shared Ring geometries (1 solid for L=0, 1 hollow for L=1..11, 4 exact L-Trims)
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
      // L-Trim shares the exact same ShaderMaterial & origin as Ring L (morph=0 inside inner hole!)
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

  // 24,000 m Procedural Atmospheric Sky Dome
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
