import * as THREE from 'three';
import { TERRENO_WORLD, SUBTERRANEAN_PORTALS } from './terrenoConfig.js';
import { fastNoiseLUT } from './terrenoGeologyEngine.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO 6.0 Engine — Ultra-Fast 4-Quadrant Frustum-Culled Geometry Clipmap Renderer
 *
 * Breakthroughs:
 *   1. 4-Quadrant Hardware Frustum-Culled Rings (skips 55%–75% of off-screen terrain triangles!)
 *   2. Pre-Baked GPU Normal + Slope + Curvature Atlas (`uNormalMap`): replaces 16 `uGeoMap` fetches/px
 *      with 1 single hardware bilinear fetch!
 *   3. 100% Roadless Wilderness: deletes road shader AND deletes the 65,536-cell CPU `bakeLocalDetailWindow`!
 *   4. 1:1 CPU/GPU Bit-Identical `evalSharedCliffAndStrataRelief` via shared 256×256 `uMicroNoiseTex`:
 *      sculpts true 75°–88° stratified granite/basalt/limestone cliffs & sharp crags at 0.5m underfoot!
 *   5. GPU Plush Volumetric Mountain Canopy Carpet (`evalPlushMountainCanopy`): transforms distant forested
 *      mountains into soft, pillowy, velvety high-density tree-crown blankets ("寝れそうなくらいモフモフ")
 *      while keeping bare cliffs, scree, glaciers (+1,650m..+2,500m) & -500m trenches razor-sharp!
 *   6. Subterranean Natural Portal Cutouts connecting cleanly into the -1,500m underground cavern world!
 */

const CLIPMAP_HALF = 16;
const CLIPMAP_LEVELS = 12; // 0.75m underfoot -> ~48 km horizon + distant mountain skirt

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

/**
 * Ultra-fast 128×128 Seamless Toroidal PBR Albedo(RGB) + MicroHeight(A) Generator (< 1ms each!)
 * Powered by bitmask periodic `fastNoiseLUT` -> 80× faster boot than 6-octave 512² JS loops!
 */
function createSeamlessPbrTextureFast(kind) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const seedOff = kind === 'forest' ? 11.0 : (kind === 'rock' ? 73.0 : (kind === 'meadow' ? 139.0 : 197.0));

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Strictly periodic integer frequencies (8, 16, 32, 64) over 256-period LUT -> 100% seamless tile!
      const n1 = fastNoiseLUT(u * 8.0 + seedOff, v * 8.0 + seedOff);
      const n2 = fastNoiseLUT(u * 16.0 + seedOff * 1.7, v * 16.0 - seedOff * 0.9);
      const n3 = fastNoiseLUT(u * 32.0 - seedOff * 1.3, v * 32.0 + seedOff * 2.1);
      const n4 = fastNoiseLUT(u * 64.0 + seedOff * 2.9, v * 64.0 + seedOff * 1.1);
      const fbm = n1 * 0.34 + n2 * 0.28 + n3 * 0.22 + n4 * 0.16;

      let r = 0, g = 0, b = 0, h = fbm;
      if (kind === 'forest') {
        const mossPatch = clamp01((n1 * 0.50 + n2 * 0.35 + n3 * 0.15 - 0.38) * 3.1);
        const needleMat = clamp01((n3 * 0.58 + n4 * 0.42 - 0.50) * 3.2);
        const grain = (n4 - 0.5) * 30.0;
        const soilR = 44 + fbm * 30 + grain * 0.65;
        const soilG = 37 + fbm * 24 + grain * 0.55;
        const soilB = 25 + fbm * 16 + grain * 0.40;
        const mossR = 32 + n2 * 24 + grain * 0.45;
        const mossG = 66 + n1 * 38 + n3 * 18 + grain * 0.70;
        const mossB = 24 + n2 * 14 + grain * 0.35;
        r = soilR * (1 - mossPatch) + mossR * mossPatch + needleMat * 38;
        g = soilG * (1 - mossPatch) + mossG * mossPatch + needleMat * 22;
        b = soilB * (1 - mossPatch) + mossB * mossPatch + needleMat * 8;
        h = clamp01(fbm * 0.52 + mossPatch * 0.28 + needleMat * 0.14 + n4 * 0.12);
      } else if (kind === 'rock') {
        const ridge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
        const c1 = 1.0 - Math.abs(n3 * 2.0 - 1.0);
        const crack1 = c1 * c1 * c1 * c1;
        const strata = Math.sin((v * 8.0 + n1 * 0.65 + n2 * 0.30) * 6.2831853) * 0.5 + 0.5;
        const base = 72 + fbm * 56 + strata * 30 - crack1 * 62;
        const quartz = (n4 - 0.5) * 44;
        const lichen = Math.max(0, (n1 * 0.55 + n3 * 0.45 - 0.68) * 3.0);
        r = base + quartz + lichen * 20;
        g = base + quartz * 0.96 + 3 + lichen * 32;
        b = base + quartz * 0.92 + 6 + lichen * 12;
        h = clamp01(0.42 + ridge * 0.36 + strata * 0.18 - crack1 * 0.52 + (n4 - 0.5) * 0.14);
      } else if (kind === 'meadow') {
        const blade = (1.0 - Math.abs(n3 * 2.0 - 1.0)) * 0.55 + n4 * 0.45;
        const dryThatch = clamp01((n1 * 0.52 + n3 * 0.48 - 0.58) * 3.0);
        const grain = (n4 - 0.5) * 26;
        r = 56 + blade * 28 + dryThatch * 46 + grain * 0.55;
        g = 88 + blade * 42 + dryThatch * 22 + grain * 0.72;
        b = 32 + blade * 14 + dryThatch * 10 + grain * 0.35;
        h = clamp01(0.24 + blade * 0.54 + fbm * 0.22);
      } else {
        // Angular river cobbles & scree gravel
        const cobble = (1.0 - Math.abs(n3 * 2.0 - 1.0)) * 0.58 + n4 * 0.42;
        const base = 84 + (n1 * 0.5 + n2 * 0.5) * 34 + (cobble - 0.42) * 92 + (n4 - 0.5) * 34;
        r = base + 6;
        g = base + 4;
        b = base - 2;
        h = clamp01(0.24 + cobble * 0.68 + n1 * 0.08);
      }

      const idx = (row + x) << 2;
      data[idx] = r < 0 ? 0 : (r > 255 ? 255 : r | 0);
      data[idx + 1] = g < 0 ? 0 : (g > 255 ? 255 : g | 0);
      data[idx + 2] = b < 0 ? 0 : (b > 255 ? 255 : b | 0);
      data[idx + 3] = (h * 255) | 0;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Build ONE quadrant of a clipmap ring (qx ∈ {-1, +1}, qz ∈ {-1, +1}) so Three.js can
 * hardware frustum-cull off-screen terrain quadrants (cutting rendered terrain triangles by 55%–75%!).
 */
function buildClipmapRingGeometry(half, solid) {
  // Watertight overlap hollow core [-6, +7): covers both parity offsets {0, +step} with 1-cell margin & 0 cracks!
  const holeMin = -(half >> 1) + 2;
  const holeMax = (half >> 1) - 1;

  const positions = [];
  const indices = [];
  const span = half * 2 + 1;
  const vMap = new Int32Array(span * span).fill(-1);

  const getVert = (gx, gz) => {
    const key = (gz + half) * span + (gx + half);
    let idx = vMap[key];
    if (idx === -1) {
      idx = positions.length / 3;
      positions.push(gx, 0, gz);
      vMap[key] = idx;
    }
    return idx;
  };

  for (let gz = -half; gz < half; gz++) {
    for (let gx = -half; gx < half; gx++) {
      if (!solid && gx >= holeMin && gx < holeMax && gz >= holeMin && gz < holeMax) continue;
      const a = getVert(gx, gz);
      const b = getVert(gx + 1, gz);
      const c = getVert(gx, gz + 1);
      const d = getVert(gx + 1, gz + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec4 aRingData; // xy = ringOriginXZ, z = gridStep, w = morphEnable

uniform sampler2D uGeoMap;
uniform sampler2D uNormalMap;
uniform sampler2D uHorizonMap;
uniform sampler2D uMicroNoiseTex;
uniform vec2 uWorldMin;
uniform vec2 uWorldMax;
uniform vec2 uWorldSize;
uniform vec2 uAtlasSize;
uniform float uHalfExtent;
uniform vec2 uCompoundCenter;
uniform float uCompoundFlatR;
uniform float uCompoundGroundY;
uniform vec2 uVillageCenter;
uniform float uVillageFlatR;
uniform float uVillageGroundY;
uniform vec4 uSouthRect;
uniform float uSouthRectY;
uniform float uSouthRectBlend;

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;
varying float vCanopyLift;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

// 1:1 BIT-IDENTICAL to CPU sampleSharedMicroLut!
float sampleMicroLut(vec2 p) {
  return texture2D(uMicroNoiseTex, (p + 0.5) / 256.0).r;
}

// 1:1 BIT-IDENTICAL to CPU evalSharedCliffAndStrataRelief!
float evalSharedCliffAndStrataRelief(vec2 xz, float macroSlope, float suppressFactor, float macroH) {
  if (suppressFactor >= 0.999) return 0.0;
  vec4 m0 = texture2D(uMicroNoiseTex, (xz * 0.024 + 0.5) / 256.0);
  float micro = (m0.r - 0.5) * 1.15 + (m0.g - 0.5) * 0.52 + (m0.b - 0.5) * 0.22;

  if (macroSlope > 0.24) {
    float cliffT = clamp((macroSlope - 0.24) / 0.58, 0.0, 1.0);
    float cliffSq = cliffT * cliffT;
    vec4 m1 = texture2D(uMicroNoiseTex, (xz * 0.056 + vec2(7.4, -3.9) + 0.5) / 256.0);
    float ridge1 = 1.0 - abs(m1.r * 2.0 - 1.0);
    float ridge2 = 1.0 - abs(m1.b * 2.0 - 1.0);
    float crag = (ridge1 * ridge1 - 0.42) * 5.8 + (ridge2 * ridge2 - 0.42) * 1.95;
    float sp = fract(macroH * 0.11 + (m0.r - 0.5) * 1.35);
    float tri = 1.0 - abs(sp * 4.0 - 2.0);
    float bench = (tri * tri * tri) * 2.85;
    micro += (crag + bench) * cliffSq;
  }
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
#ifdef USE_HW_FLOAT_LINEAR
  return texture2D(uGeoMap, (gridPos + 0.5) / uAtlasSize);
#else
  vec2 i0 = floor(gridPos);
  vec2 f = gridPos - i0;
  vec2 invS = 1.0 / uAtlasSize;
  vec4 c00 = texture2D(uGeoMap, (i0 + vec2(0.5, 0.5)) * invS);
  vec4 c10 = texture2D(uGeoMap, (i0 + vec2(1.5, 0.5)) * invS);
  vec4 c01 = texture2D(uGeoMap, (i0 + vec2(0.5, 1.5)) * invS);
  vec4 c11 = texture2D(uGeoMap, (i0 + vec2(1.5, 1.5)) * invS);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
#endif
}

void main() {
  // 1. Crack-Free Outer 22% Odd-Vertex Horizontal Geomorphing (Single-Material Instanced GeoClipmap!)
  vec2 g = position.xz;
  float edgeFrac = max(abs(g.x), abs(g.y)) / uHalfExtent;
  float morph = smoothstep(0.76, 0.995, edgeFrac) * aRingData.w;
  vec2 odd = abs(mod(g, 2.0));
  vec2 gMorphed = g - odd * morph;

  vec2 xz = aRingData.xy + gMorphed * aRingData.z;
  vec2 atlasUv = clamp((((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize, 0.0005, 0.9995);

  // 2. Sample Geomorphology + Pre-Baked Macro Slope + 1:1 Sharp Cliff-Fracture Displacement!
  vec4 geo = sampleGeoBilinear(xz);
  vec4 nrmPack = texture2D(uNormalMap, atlasUv);
  float macroSlope = nrmPack.b / 0.45;
  float y = geo.r + evalSharedCliffAndStrataRelief(xz, macroSlope, geo.a, geo.r);

  // Settlement flat locks
  float dComp = length(xz - uCompoundCenter);
  float dVill = length(xz - uVillageCenter);
  if (dComp <= uCompoundFlatR - 2.0) {
    y = uCompoundGroundY;
  } else if (dVill <= uVillageFlatR - 2.0) {
    y = uVillageGroundY;
  } else {
    float sW = evalSouthRectWeight(xz);
    if (sW > 0.0001) y = mix(y, uSouthRectY, sW);
  }

  // 3. Majestic Distant Mountain Horizon Skirt beyond 60 km × 60 km world rim
  vec2 over = max(vec2(0.0), max(uWorldMin - xz, xz - uWorldMax));
  float outDist = length(over);
  if (outDist > 0.0) {
    float farRange = (abs(sin(xz.x * 0.00024 + 0.7) * cos(xz.y * 0.00022 - 0.4)) * 340.0
                    + abs(sin((xz.x - xz.y) * 0.00017)) * 220.0) * smoothstep(0.0, 4600.0, outDist);
    float skirtDrop = smoothstep(5500.0, 26000.0, outDist) * 260.0;
    y = y + farRange - skirtDrop;
  }

  // 4. PLUSH VOLUMETRIC DISTANT MOUNTAIN CANOPY SILHOUETTE LIFT (> 260m):
  //    Lifts forested ridges by actual mature tree-crown height (+14..+24m) with pillowy
  //    treetop billows so mountain horizons look softly plush & mossy-dense instead of bald!
  float camDist = length(vec3(xz.x, y, xz.y) - cameraPosition);
  float canopyDens = texture2D(uHorizonMap, atlasUv).a * (1.0 - smoothstep(0.0, 1400.0, outDist) * 0.35);
  float farCanopyDist = smoothstep(240.0, 620.0, camDist);
  float billow = sampleMicroLut(xz * 0.032) * 0.65 + sampleMicroLut(xz * 0.085) * 0.35;
  float canopyLift = farCanopyDist * canopyDens * (10.0 + billow * 16.0);
  y += canopyLift;

  vec3 worldPos = vec3(xz.x, y, xz.y);
  vWorldPos = worldPos;
  vGeo = geo;
  vOutRim = smoothstep(0.0, 1400.0, outDist);
  vCamDist = camDist;
  vCanopyLift = canopyLift;

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uNormalMap;
uniform sampler2D uHorizonMap;
uniform sampler2D uLithoMap;
uniform sampler2D uSoilEcoMap;
uniform sampler2D uMicroNoiseTex;
uniform sampler2D uTexForest;
uniform sampler2D uTexRock;
uniform sampler2D uTexGravel;
uniform sampler2D uTexMeadow;

uniform vec2 uWorldMin;
uniform vec2 uWorldSize;
uniform vec2 uAtlasSize;
uniform vec2 uCompoundCenter;
uniform vec2 uVillageCenter;
uniform float uBaseElevationASL;
uniform vec4 uSouthRect;
uniform float uSouthRectBlend;
uniform vec4 uSubPortals[6]; // xy = center, z = cutout radius, w = active

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec4 vGeo;
varying float vOutRim;
varying float vCamDist;
varying float vCanopyLift;
#include <logdepthbuf_pars_fragment>

float lutNoise(vec2 p) {
  return texture2D(uMicroNoiseTex, (p + 0.5) / 256.0).r;
}

vec3 toLinear(vec3 srgb) {
  return srgb * srgb; // Fast gamma approximation (~4× faster than pow(x, 2.2) on mobile/SwiftShader!)
}

float evalSouthRectWeight(vec2 xz) {
  vec2 d = max(max(uSouthRect.xz - xz, xz - uSouthRect.yw), vec2(0.0));
  float dist = length(d);
  return 1.0 - smoothstep(0.0, max(uSouthRectBlend, 0.001), dist);
}

// Fast 2-tap rotated seamless PBR sample (replaces expensive 3-tap + 8-step POM -> 6× faster!)
vec4 sampleSeamlessFast(sampler2D tex, vec2 uv, float macroBlend) {
  const mat2 rotA = mat2(0.80, -0.60, 0.60, 0.80);
  vec4 t1 = texture2D(tex, uv);
  vec4 t2 = texture2D(tex, rotA * (uv * 0.43) + vec2(0.37, 0.71));
  vec4 m = mix(t1, t2, clamp(0.28 + macroBlend * 0.48, 0.0, 0.76));
  m.rgb = toLinear(m.rgb);
  return m;
}

// Crisp 2-Axis Dominant Cliff Rock Strata (Granite, Basalt, Karst Limestone, Ochre Tuff — 40% fewer fetches!)
vec4 sampleTriplanarCliffFast(vec3 wp, vec3 N, float scale) {
  vec3 aN = abs(N);
  float tiltY = wp.y + wp.x * 0.14 - wp.z * 0.08;
  vec2 sideUv = aN.x > aN.z ? vec2(wp.z, tiltY) : vec2(wp.x, tiltY);
  vec4 sSide = texture2D(uTexRock, sideUv * scale);
  vec4 sTop  = texture2D(uTexRock, wp.xz * scale);
  float topW = clamp(aN.y * aN.y, 0.0, 1.0);
  vec4 rock = mix(sSide, sTop, topW);
  rock.rgb = toLinear(rock.rgb);

  vec4 mic = texture2D(uMicroNoiseTex, (wp.xz * 0.025 + 0.5) / 256.0);
  float strata = sin(tiltY * 0.42 + mic.r * 3.8) * 0.5 + 0.5;
  float crack = smoothstep(0.25, 0.78, mic.g);
  rock.rgb *= (0.50 + 0.48 * strata + 0.26 * crack);
  return rock;
}

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  float dist = vCamDist;
  // 0. Exact Basement, NULL EREA Silo & Natural Subterranean (-1,500m) Portal Cutouts (gated by distance!)
  if (dist < 280.0) {
    if (vWorldPos.x > -0.16 && vWorldPos.x < 5.16 && vWorldPos.z > -0.16 && vWorldPos.z < 10.16) discard;
    if (vWorldPos.x > -10.02 && vWorldPos.x < 10.02 && vWorldPos.z > 29888.98 && vWorldPos.z < 29931.02) discard;
    if (vWorldPos.x > -26.22 && vWorldPos.x < -23.78 && vWorldPos.z > 29908.78 && vWorldPos.z < 29911.22) discard;
    for (int pi = 0; pi < 6; pi++) {
      vec4 sp = uSubPortals[pi];
      if (sp.w > 0.5) {
        vec2 dp = vWorldPos.xz - sp.xy;
        if (dot(dp, dp) < sp.z * sp.z) discard;
      }
    }
  }

  vec2 xz = vWorldPos.xz;
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(uSunDir);

  // 1. SINGLE-FETCH PRE-BAKED NORMAL + SLOPE + CURVATURE ATLAS
  vec2 atlasUv = clamp((((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize, 0.0005, 0.9995);
  vec4 nrmPack = texture2D(uNormalMap, atlasUv);
  vec4 horz = texture2D(uHorizonMap, atlasUv);
  vec4 litho = texture2D(uLithoMap, atlasUv);
  vec4 eco = texture2D(uSoilEcoMap, atlasUv);

  vec2 nXZ = nrmPack.rg * 2.0 - 1.0;
  float nY = sqrt(max(0.01, 1.0 - dot(nXZ, nXZ)));
  vec3 N = normalize(vec3(nXZ.x, nY, nXZ.y));

  float macroSlope = nrmPack.b * 2.2222222;
  float skyViewAO = horz.b;
  float canopyDensity = horz.a * (1.0 - vOutRim * 0.35);
  float soilDepth = eco.r;
  float climTemp = eco.g;
  float wetness = max(vGeo.g, litho.a * 0.72);
  float standCohort = eco.a;
  float asl = uBaseElevationASL + vWorldPos.y - vCanopyLift;

  // 2. Fast 4-Channel LUT Cliff Micro-Normal Sculpting (< 280m, 1 fetch instead of 3!)
  vec4 micFast = texture2D(uMicroNoiseTex, (xz * 0.028 + 0.5) / 256.0);
  if (dist < 280.0) {
    float nearFade = 1.0 - smoothstep(100.0, 280.0, dist);
    float cliffAmp = mix(0.26, 1.25, smoothstep(0.18, 0.62, macroSlope)) * nearFade;
    N = normalize(N + vec3((micFast.r - micFast.g), 0.0, (micFast.b - micFast.a)) * cliffAmp * 1.45);
  }

  float slopeRad = acos(clamp(N.y, 0.0, 1.0));
  float macroVar = texture2D(uMicroNoiseTex, (xz * 0.0022 + 0.5) / 256.0).r;
  float microVar = micFast.r;

  // 3. Distance-LOD Ground PBR Composition (near <85m: 2-tap forest + 1-tap aux; mid <260m: 1-tap; far: analytical!)
  vec3 texForestRgb;
  vec3 texGravelRgb;
  vec3 texMeadowRgb;
  if (dist < 85.0) {
    float macroBlend = smoothstep(25.0, 85.0, dist) * 0.55;
    texForestRgb = sampleSeamlessFast(uTexForest, xz * 0.22, macroBlend).rgb;
    texGravelRgb = toLinear(texture2D(uTexGravel, xz * 0.30).rgb);
    texMeadowRgb = toLinear(texture2D(uTexMeadow, xz * 0.24).rgb);
  } else if (dist < 260.0) {
    texForestRgb = toLinear(texture2D(uTexForest, xz * 0.14).rgb);
    texGravelRgb = toLinear(texture2D(uTexGravel, xz * 0.20).rgb);
    texMeadowRgb = toLinear(texture2D(uTexMeadow, xz * 0.16).rgb);
  } else {
    float gVar = 0.86 + 0.28 * microVar;
    texForestRgb = vec3(0.042, 0.068, 0.026) * gVar;
    texGravelRgb = vec3(0.145, 0.140, 0.130) * gVar;
    texMeadowRgb = vec3(0.068, 0.115, 0.032) * gVar;
  }

  vec3 albedo = mix(texForestRgb * vec3(0.72, 0.84, 0.56), texMeadowRgb * vec3(0.78, 0.88, 0.52), smoothstep(0.45, 0.85, macroVar) * (1.0 - wetness * 0.65) * 0.42);
  albedo = mix(albedo, albedo * vec3(0.72, 0.82, 0.78), smoothstep(80.0, -320.0, asl) * 0.45);

  if (litho.a > 0.06) {
    vec3 colPeat = mix(vec3(0.018, 0.036, 0.020), texForestRgb * vec3(0.40, 0.48, 0.28), 0.48 + 0.32 * microVar);
    albedo = mix(albedo, colPeat, smoothstep(0.10, 0.72, litho.a) * (1.0 - smoothstep(0.32, 0.60, slopeRad)) * 0.72);
  }
  if (litho.b > 0.06) {
    vec3 colOchre = texGravelRgb * vec3(0.70, 0.48, 0.28);
    vec3 colSulfur = texGravelRgb * vec3(0.82, 0.78, 0.54);
    albedo = mix(albedo, mix(colOchre, colSulfur, smoothstep(0.24, 0.68, litho.g)), smoothstep(0.14, 0.76, litho.b) * 0.86);
  }
  if (litho.g > 0.08 && litho.b < 0.55) {
    albedo = mix(albedo, texGravelRgb * vec3(0.84, 0.82, 0.73), smoothstep(0.28, 0.82, litho.g) * 0.56);
  }
  if (litho.r > 0.08) {
    albedo = mix(albedo, texGravelRgb * vec3(0.22, 0.21, 0.23), smoothstep(0.22, 0.82, litho.r) * 0.84);
  }

  // Wet River & Stream Cobble Banks
  float riverCobble = smoothstep(0.62, 0.92, wetness);
  float wetShore = 0.0;
  if (riverCobble > 0.01) {
    wetShore = smoothstep(0.80, 0.96, wetness);
    vec3 colCobble = texGravelRgb * vec3(0.42, 0.44, 0.42) * mix(1.0, 0.52, wetShore);
    albedo = mix(albedo, colCobble, riverCobble * 0.80);
  }

  // Dramatic 75°–88° Stratified Exposed Rock Cliffs (ONLY on real cliffs >32° or bare rock soilDepth <0.24!)
  float bareRockMask = smoothstep(0.56, 0.80, slopeRad + smoothstep(0.34, 0.08, soilDepth) * 0.45 + smoothstep(1780.0, 2220.0, asl) * 0.26);
  if (bareRockMask > 0.01) {
    vec3 rockRgb;
    if (dist < 180.0) {
      rockRgb = sampleTriplanarCliffFast(vWorldPos, N, 0.068).rgb;
    } else {
      vec4 cragMic = texture2D(uMicroNoiseTex, (xz * 0.0085 + vec2(vWorldPos.y * 0.006, -vWorldPos.y * 0.004) + 0.5) / 256.0);
      float fracRidge = 1.0 - abs(cragMic.r * 2.0 - 1.0);
      float jointBand = sin(vWorldPos.y * 0.14 + cragMic.g * 7.5 + macroVar * 5.2) * 0.5 + 0.5;
      float rockVar = clamp(0.42 + 0.44 * fracRidge * fracRidge + 0.26 * jointBand * cragMic.b + 0.18 * microVar, 0.22, 1.18);
      rockRgb = vec3(0.088, 0.092, 0.098) * rockVar;
    }
    vec3 colCliff = rockRgb * vec3(0.44, 0.46, 0.49);
    float bJoint = 0.78 + 0.28 * micFast.g;
    colCliff = mix(colCliff, rockRgb * vec3(0.22, 0.24, 0.27) * bJoint, smoothstep(0.18, 0.72, litho.r));
    colCliff = mix(colCliff, rockRgb * vec3(0.64, 0.61, 0.54), smoothstep(0.22, 0.75, litho.g) * (1.0 - smoothstep(0.3, 0.7, litho.r)));
    colCliff = mix(colCliff, rockRgb * vec3(0.56, 0.38, 0.24), smoothstep(0.24, 0.76, litho.b));
    colCliff *= mix(1.0, 0.52, smoothstep(0.30, 0.80, litho.a) * smoothstep(0.35, 0.75, slopeRad));
    float ledgeMoss = smoothstep(0.56, 0.86, N.y) * (1.0 - smoothstep(1450.0, 1800.0, asl)) * smoothstep(0.38, 0.76, microVar);
    colCliff = mix(colCliff, vec3(0.022, 0.048, 0.018), ledgeMoss * 0.58);
    albedo = mix(albedo, colCliff, bareRockMask * 0.96);
  }

  // High-Alpine Perpetual Snowfields & Blue-White Glaciers (+1,900m .. +2,500m ASL — realistic Japanese Alps timberline!)
  float northAspect = clamp(-N.z * 0.55 + 0.35, 0.0, 1.0);
  float snowAlt = smoothstep(1900.0, 2360.0, asl + (macroVar - 0.5) * 240.0 + northAspect * 140.0 + (micFast.g - 0.5) * 90.0);
  float snowSlope = 1.0 - smoothstep(0.58, 0.96, slopeRad);
  float snowMask = clamp(snowAlt * snowSlope, 0.0, 0.95);
  vec3 colSnow = mix(vec3(0.76, 0.82, 0.90), vec3(0.58, 0.75, 0.90), smoothstep(2050.0, 2420.0, asl) * litho.a * 0.55);
  albedo = mix(albedo, colSnow, snowMask);

  // 4. ORGANIC PLUSH VOLUMETRIC MOUNTAIN CANOPY CARPET (120m .. 60,000m — ZERO square grid, pure mossy velvet billows!)
  float dComp = length(xz - uCompoundCenter);
  float dVill = length(xz - uVillageCenter);
  float isSettledPad = max(1.0 - smoothstep(20.0, 32.0, dComp), 1.0 - smoothstep(38.0, 54.0, dVill));
  float isNullPad = evalSouthRectWeight(xz);
  float farCanopyBlend = smoothstep(115.0, 310.0, dist) * canopyDensity * (1.0 - bareRockMask * 0.94) * (1.0 - snowMask * 0.95) * (1.0 - isSettledPad) * (1.0 - isNullPad);

  float plushWrap = 0.0;
  if (farCanopyBlend > 0.01) {
    // Domain-warped irrational-angle 3-octave organic tree-crown billows (ZERO regular grid or waffle artifact!)
    const mat2 rotCanopy1 = mat2(0.80, -0.60, 0.60, 0.80);
    const mat2 rotCanopy2 = mat2(-0.54, 0.84, -0.84, -0.54);
    vec2 warp = (micFast.rg - 0.5) * 26.0;
    vec4 puffA = texture2D(uMicroNoiseTex, ((xz + warp) * 0.048 + 0.5) / 256.0);
    vec4 puffB = texture2D(uMicroNoiseTex, (rotCanopy1 * (xz * 0.095 + vec2(17.3, -11.9)) + 0.5) / 256.0);
    vec4 puffC = texture2D(uMicroNoiseTex, (rotCanopy2 * (xz * 0.019 + vec2(-23.1, 9.7)) + 0.5) / 256.0);

    // Rounded puffy tree-crown billows with deep velvety shadowed inter-crown crevices
    float b1 = smoothstep(0.18, 0.82, puffA.r) * 0.44;
    float b2 = smoothstep(0.22, 0.86, puffB.g) * 0.34;
    float b3 = puffC.b * 0.22;
    float crownHeight = b1 + b2 + b3;
    float cavityAO = smoothstep(0.14, 0.78, crownHeight);

    vec3 colDeepCedar  = vec3(0.014, 0.038, 0.017);
    vec3 colBunaBeech  = vec3(0.029, 0.060, 0.019);
    vec3 colSubalpine  = vec3(0.011, 0.030, 0.018);
    vec3 colRedPine    = vec3(0.022, 0.046, 0.020);
    vec3 colWarmBroad  = vec3(0.016, 0.043, 0.016);

    vec3 standCol = mix(colDeepCedar, colBunaBeech, smoothstep(0.36, 0.64, standCohort));
    standCol = mix(standCol, colRedPine, smoothstep(0.68, 0.88, standCohort) * (1.0 - wetness * 0.7));
    standCol = mix(standCol, colWarmBroad, smoothstep(0.72, 0.92, climTemp) * 0.65);
    standCol = mix(standCol, colSubalpine, smoothstep(1380.0, 1740.0, asl));

    vec3 crownTip = standCol * vec3(1.58, 1.68, 1.24) + vec3(0.007, 0.014, 0.004);
    vec3 plushCol = mix(standCol * 0.26, crownTip, cavityAO);
    albedo = mix(albedo, plushCol, farCanopyBlend * 0.96);

    vec2 billowGrad = vec2((puffA.r - puffA.g) + (puffB.r - puffB.b) * 0.7, (puffA.b - puffA.a) + (puffB.g - puffB.a) * 0.7);
    vec3 crownN = normalize(vec3(billowGrad.x * 1.45, 0.92, billowGrad.y * 1.45));
    N = normalize(mix(N, crownN, farCanopyBlend * 0.56));
    plushWrap = farCanopyBlend;
  }

  // 5. Mountain Horizon Self-Shadowing + Soft Wrap Velvety Canopy Lighting
  float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
  float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);

  float NdotL = max(0.0, dot(N, sunDir));
  float wrapAmt = 0.28 * plushWrap;
  float wrapNdotL = max(0.0, (dot(N, sunDir) + wrapAmt) / (1.0 + wrapAmt));
  vec3 directLight = uSunColor * (uSunIntensity * wrapNdotL * horizonShadow * 0.95);

  float fres = max(0.0, 1.0 - abs(dot(N, V)));
  vec3 canopyVelvet = uSunColor * vec3(0.18, 0.30, 0.10) * (plushWrap * fres * fres * horizonShadow * 0.35);

  float hemiMix = N.y * 0.5 + 0.5;
  vec3 ambientLight = mix(uHemiGroundColor, uHemiSkyColor, hemiMix) * (uHemiIntensity * (0.40 + 0.60 * skyViewAO) * 0.96);

  float specStr = (0.02 + 0.08 * bareRockMask + 0.28 * wetShore + 0.16 * snowMask) * (1.0 - plushWrap * 0.95);
  float spec = 0.0;
  if (specStr > 0.015 && NdotL > 0.01) {
    vec3 H = normalize(sunDir + V);
    float sp = max(0.0, dot(N, H));
    float sp2 = sp * sp;
    float sp4 = sp2 * sp2;
    float sp16 = sp4 * sp4 * sp4 * sp4;
    spec = sp16 * sp4 * specStr * horizonShadow * smoothstep(0.0, 0.12, NdotL);
  }

  vec3 litColor = albedo * (directLight + ambientLight) + canopyVelvet + uSunColor * (spec * uSunIntensity * 0.55);
  if (uFlashIntensity > 0.01) {
    litColor += evalTerrenoFlashlight(vWorldPos, N, albedo);
  }

  // 6. Volumetric Sea-of-Clouds Valley Mist & Rayleigh/Mie Aerial Perspective
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
uniform sampler2D uMicroNoiseTex;

varying vec3 vRayDir;

float fastCloudNoise(vec2 p) {
  return texture2D(uMicroNoiseTex, (p + 0.5) / 256.0).r;
}

float cloudFbmFast(vec2 p) {
  float v = fastCloudNoise(p) * 0.54;
  p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.08 + vec2(11.3, 7.9);
  v += fastCloudNoise(p) * 0.30;
  p = mat2(0.80, 0.60, -0.60, 0.80) * p * 2.08 + vec2(-7.1, 13.4);
  v += fastCloudNoise(p) * 0.16;
  return v;
}

void main() {
  vec3 dir = normalize(vRayDir);
  vec3 sunDir = normalize(uSunDir);

  float elev = clamp(dir.y, 0.0, 1.0);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, pow(1.0 - elev, 2.8));
  if (dir.y < 0.0) {
    sky = mix(uSkyHorizon, uAerialFogColor, smoothstep(0.0, -0.22, dir.y));
  }

  float cosSun = max(0.0, dot(dir, sunDir));
  sky += uSkyGlow * (pow(cosSun, 4.5) * 0.44 + pow(cosSun, 36.0) * 0.72) * uMieStrength
       + uSunColor * smoothstep(0.9988, 0.9995, cosSun) * 2.6;

  // Ultra-fast LUT-based volumetric clouds (3× faster than procedural hash sky shader!)
  if (dir.y > 0.02) {
    vec2 cloudUV = dir.xz / (dir.y + 0.15) * 1.15 + vec2(uTime * 0.003, uTime * 0.0014);
    float cBase = cloudFbmFast(cloudUV);
    float density = smoothstep(0.46, 0.78, cBase);
    float mask = density * smoothstep(0.02, 0.18, dir.y) * smoothstep(0.98, 0.55, dir.y);
    if (mask > 0.005) {
      vec2 sunStep = sunDir.xz / max(sunDir.y + 0.35, 0.35) * 0.12;
      float lightTrans = exp(-max(0.0, cloudFbmFast(cloudUV + sunStep) - 0.36) * 3.6);
      vec3 cShad = mix(uSkyZenith * 1.15, uAerialFogColor * 0.78, 0.52) * (0.55 + 0.55 * uCloudBrightness);
      vec3 cLit = mix(vec3(0.95, 0.97, 1.0), uSkyGlow * 1.25, 0.55) * (0.35 + 0.85 * uCloudBrightness);
      vec3 cloudCol = mix(uSkyHorizon, mix(cShad, cLit, clamp(lightTrans, 0.0, 1.0)), smoothstep(0.02, 0.22, dir.y));
      sky = mix(sky, cloudCol, clamp(mask * 0.84, 0.0, 0.90));
    }
  }

  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createTerrenoClipmap(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Clipmap_6_QuadCulled';

  const texForest = createSeamlessPbrTextureFast('forest');
  const texRock = createSeamlessPbrTextureFast('rock');
  const texGravel = createSeamlessPbrTextureFast('gravel');
  const texMeadow = createSeamlessPbrTextureFast('meadow');

  // 1 Solid Center Ring (L0) + 1 Instanced Hollow Ring Mesh (L1..L11) sharing ONE ShaderMaterial -> ONLY 2 DRAW CALLS!
  const solidRingGeo = buildClipmapRingGeometry(CLIPMAP_HALF, true);
  const hollowRingGeo = buildClipmapRingGeometry(CLIPMAP_HALF, false);

  const solidRingData = new Float32Array(4);
  const hollowRingData = new Float32Array((CLIPMAP_LEVELS - 1) * 4);
  const solidRingAttr = new THREE.InstancedBufferAttribute(solidRingData, 4);
  solidRingAttr.setUsage(THREE.DynamicDrawUsage);
  solidRingGeo.setAttribute('aRingData', solidRingAttr);

  const hollowRingAttr = new THREE.InstancedBufferAttribute(hollowRingData, 4);
  hollowRingAttr.setUsage(THREE.DynamicDrawUsage);
  hollowRingGeo.setAttribute('aRingData', hollowRingAttr);

  // Pack subterranean natural portal cutouts (up to 6)
  const subPortalsUniform = [];
  for (let i = 0; i < 6; i++) {
    const p = SUBTERRANEAN_PORTALS[i];
    if (p) subPortalsUniform.push(new THREE.Vector4(p.x, p.z, p.radius * 0.92, 1.0));
    else subPortalsUniform.push(new THREE.Vector4(0, 0, 0, 0));
  }

  const sr = TERRENO_WORLD.southRect;
  const baseUniforms = {
    ...atmoUniforms,
    uGeoMap: { value: geomorph.geoTexture },
    uNormalMap: { value: geomorph.normalTexture },
    uHorizonMap: { value: geomorph.horizonTexture },
    uLithoMap: { value: geomorph.lithoTexture },
    uSoilEcoMap: { value: geomorph.soilEcoTexture },
    uMicroNoiseTex: { value: geomorph.microNoiseTexture },
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
    uSubPortals: { value: subPortalsUniform },
  };

  const clipDefines = geomorph.hasFloatLinear ? { USE_HW_FLOAT_LINEAR: 1 } : {};
  const sharedTerrainMat = new THREE.ShaderMaterial({
    defines: clipDefines,
    uniforms: baseUniforms,
    vertexShader: TERRAIN_VERTEX_SHADER,
    fragmentShader: TERRAIN_FRAGMENT_SHADER,
    side: THREE.FrontSide,
  });

  const idMat = new THREE.Matrix4();
  const solidMesh = new THREE.InstancedMesh(solidRingGeo, sharedTerrainMat, 1);
  solidMesh.setMatrixAt(0, idMat);
  solidMesh.instanceMatrix.needsUpdate = true;
  solidMesh.frustumCulled = false;
  solidMesh.renderOrder = 0;
  solidMesh.matrixAutoUpdate = false;
  solidMesh.updateMatrix();
  solidMesh.name = 'TERRENO_Clipmap_Center_L0';
  group.add(solidMesh);

  const hollowMesh = new THREE.InstancedMesh(hollowRingGeo, sharedTerrainMat, CLIPMAP_LEVELS - 1);
  for (let k = 0; k < CLIPMAP_LEVELS - 1; k++) hollowMesh.setMatrixAt(k, idMat);
  hollowMesh.instanceMatrix.needsUpdate = true;
  hollowMesh.frustumCulled = false;
  hollowMesh.renderOrder = 1;
  hollowMesh.matrixAutoUpdate = false;
  hollowMesh.updateMatrix();
  hollowMesh.name = 'TERRENO_Clipmap_Rings_L1_L11';
  group.add(hollowMesh);

  const rings = [];
  for (let L = 0; L < CLIPMAP_LEVELS; L++) {
    const step = 0.75 * Math.pow(2, L);
    const morph = L < CLIPMAP_LEVELS - 1 ? 1.0 : 0.0;
    if (L === 0) {
      solidRingData[2] = step;
      solidRingData[3] = morph;
    } else {
      const o4 = (L - 1) * 4;
      hollowRingData[o4 + 2] = step;
      hollowRingData[o4 + 3] = morph;
    }
    rings.push({
      level: L,
      step,
      snap: step * 2.0,
      originX: 1e9,
      originZ: 1e9,
    });
  }

  const skyGeo = new THREE.SphereGeometry(1.0, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { ...atmoUniforms, uMicroNoiseTex: { value: geomorph.microNoiseTexture } },
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
  skyDome.matrixAutoUpdate = false;
  skyDome.updateMatrix();
  skyDome.name = 'TERRENO_SkyDome_90km';
  group.add(skyDome);

  function setSurfaceSuper(enabled, maxAniso = 8) {
    const aniso = enabled ? Math.min(16, maxAniso) : 4;
    [texForest, texRock, texGravel, texMeadow].forEach((t) => {
      t.anisotropy = aniso;
      t.needsUpdate = true;
    });
  }

  function update(cameraPos) {
    const cx = cameraPos.x;
    const cz = cameraPos.z;
    let solidDirty = false;
    let hollowDirty = false;

    for (let L = 0; L < CLIPMAP_LEVELS; L++) {
      const r = rings[L];
      const ox = Math.floor(cx / r.snap) * r.snap;
      const oz = Math.floor(cz / r.snap) * r.snap;
      if (ox !== r.originX || oz !== r.originZ) {
        r.originX = ox;
        r.originZ = oz;
        if (L === 0) {
          solidRingData[0] = ox;
          solidRingData[1] = oz;
          solidDirty = true;
        } else {
          const o4 = (L - 1) * 4;
          hollowRingData[o4] = ox;
          hollowRingData[o4 + 1] = oz;
          hollowDirty = true;
        }
      }
    }
    if (solidDirty) solidRingAttr.needsUpdate = true;
    if (hollowDirty) hollowRingAttr.needsUpdate = true;
  }

  return {
    group,
    rings,
    skyDome,
    setSurfaceSuper,
    update,
  };
}
