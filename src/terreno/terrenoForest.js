import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import { isInsideSouthRect, evalClosestTributary } from './terrenoGeomorphology.js';
import { isInsideVillageClearing, isInsideVillagePaving } from '../villageData.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';
import {
  MASTER_BOTANICAL_UV,
  getMasterBotanicalAtlas,
  getBotanicalBarkTexture,
  getBirchBarkTexture,
  getPineBarkTexture,
  getBambooCulmTexture,
} from './terrenoBotanicalAtlas.js';
import {
  ARCHETYPE_COUNT,
  ALL_TREE_SPECIES_28,
  buildForestArchetypes,
  pickPhytosociologicalSpecies,
} from './terrenoForestSpeciesV4.js';
import {
  REAL_ENGINE_FOLIAGE_UNIFORMS_GLSL,
  REAL_ENGINE_FOLIAGE_DEFLECT_GLSL,
} from '../physics/realEngine.js';

/**
 * TERRENO 6.0 & REAL ENGINE 1.0 — Mega-Batched Ecological Japanese Forest & Plush Canopy Engine
 *
 * Revolutionary Architecture (v6.0):
 *   1. Draw-Call Collapse (`65 → 17` draw calls!):
 *      All 28 Japanese tree species render through 6 sculpted deep-rooted botanical archetypes
 *      using ONE unified 1024×1024 Master Botanical Atlas (`aUvRect` instanced attribute) + ONE
 *      unified Multi-Bark PBR shader (`aBarkMode` instanced attribute)!
 *   2. LRU Tile Cache + Direct TypedArray Bulk Upload (`20×+` faster streaming!):
 *      Near (64m), Ground (32m) & Mid-Distance Plush Canopy (160m) tiles cache their pre-baked
 *      Float32Array instance transforms, colors, UVs & colliders in LRU Maps — crossing a tile
 *      boundary only computes the thin perimeter strip and copies memory via `.set()`!
 *   3. True Japanese Phytosociology & Soil-Climate Zoning:
 *      Uses `geomorph.getSoilEcoAt(wx, wz)` -> ZERO trees on bare cliffs/rock/lava/snow (`soilDepth < 0.22`),
 *      coherent 4–8 km regional forest stands (75%–90% pure/bi-dominant communities), calm filmic colors,
 *      4-story height stratification (`3 m .. 58 m`), and `2.5×–3.2×` rich crown fullness variation!
 *   4. Zero Floating Roots on Slopes & 0.1 mm Exact Trunk Profiles:
 *      Buttress root collars extend to `y = -0.34` and anchor below the downhill slope footprint minimum;
 *      every tree collider carries a 16-slice vertex-measured `trunkLut` + exact world lean axis!
 *   5. ZERO Ground-Leaf / Shrub Solid Colliders + REAL ENGINE 1.0 GPU Interactive Foliage Physics:
 *      Walking or driving physically parts grass, ferns, shrubs & low branches around the player capsule
 *      and exact 3D vehicle OBB hulls (zero clipping!) with persistent harmonic spring recovery wake!
 *   6. Plush Fluffy Distant Mountain Canopy Blanket ("モフモフ"):
 *      Overlapping multi-crown pillowy dome cloud clusters (135m..1,800m) + clipmap GPU canopy carpet!
 */

const NEAR_TILE_SIZE = 64.0;
const NEAR_TILE_RADIUS = 2;     // 5×5 tiles = ±160m full 3D 28-species forest (circular 172m)
const DETAIL_TILE_RADIUS = 1;   // 3×3 tiles = ±96m understory shrubs, ferns, boulders, logs & colliders
const GROUND_TILE_SIZE = 32.0;
const GROUND_TILE_RADIUS = 1;   // 3×3 micro-tiles = ±48m interactive grass & Kumazasa carpet
const MID_TILE_SIZE = 160.0;
const MID_TILE_RADIUS = 6;      // Circular 135m..960m plush multi-crown mountain canopy clouds (hands off cleanly to GPU plush carpet!)

const UV_FERN  = MASTER_BOTANICAL_UV.fern;
const UV_SASA  = MASTER_BOTANICAL_UV.sasa;
const UV_SHRUB = MASTER_BOTANICAL_UV.shrub;
const UV_GRASS = MASTER_BOTANICAL_UV.grass;

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
  let totalVerts = 0, totalIndices = 0;
  const hasUv = geos.every((g) => Boolean(g.attributes.uv));
  const hasMeta = geos.every((g) => Boolean(g.attributes.aMeta));
  const items = geos.map((g) => {
    const pos = g.attributes.position, norm = g.attributes.normal;
    const uv = hasUv ? g.attributes.uv : null;
    const meta = hasMeta ? g.attributes.aMeta : null;
    const idx = g.index;
    const vc = pos.count, ic = idx ? idx.count : vc;
    totalVerts += vc; totalIndices += ic;
    return { pos, norm, uv, meta, idx, vc, ic };
  });
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = hasUv ? new Float32Array(totalVerts * 2) : null;
  const metas = hasMeta ? new Float32Array(totalVerts * 2) : null;
  const indices = new Uint32Array(totalIndices);
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
    vo += it.vc; io += it.ic;
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

// ============================================================================
// LEAN ORGANIC GEOMETRIES FOR UNDERSTORY, GROUNDCOVER, BOULDERS & PLUSH CLOUDS
// ============================================================================
function buildUnderstoryRosetteGeo() {
  // 5 graceful outward-arching curved botanical fronds (10 tris/instance, unit [0..1] UV!)
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const yaw = (i / 5) * Math.PI * 2.0 + (i % 2) * 0.25;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const pitch = 0.42 + (i % 2) * 0.22;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const hw = 0.46, len = 0.96, droop = 0.26;
    const fx = sy * cp, fy = sp, fz = cy * cp;
    const rx = cy, rz = -sy;
    const pos = [
      -rx * hw * 0.65, 0.00, -rz * hw * 0.65,
       rx * hw * 0.65, 0.00,  rz * hw * 0.65,
      fx * len - rx * hw, fy * len - droop, fz * len - rz * hw,
      fx * len + rx * hw, fy * len - droop, fz * len + rz * hw,
    ];
    const nrm = [
      sy * 0.35, 0.92, cy * 0.35,
      sy * 0.35, 0.92, cy * 0.35,
      sy * 0.50, 0.85, cy * 0.50,
      sy * 0.50, 0.85, cy * 0.50,
    ];
    const uv = [0, 0, 1, 0, 0, 1, 1, 1];
    const meta = [0.38, 0.05, 0.38, 0.05, 1.14, 1.0, 1.14, 1.0];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    parts.push(g);
  }
  return mergeGeometriesFull(parts);
}

function buildGroundClumpUnitGeo() {
  // 2 crossed splayed blades (4 tris/clump, unit [0..1] UV -> 1 draw call for BOTH Grass & Kumazasa!)
  const parts = [];
  for (let p = 0; p < 2; p++) {
    const ang = p * Math.PI * 0.5 + 0.32;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const hw = 0.52, h = 0.72, lean = 0.12;
    const lx = -sinA * h * lean, lz = cosA * h * lean;
    const pos = [
      -hw * cosA, -0.05, -hw * sinA,
       hw * cosA, -0.05,  hw * sinA,
      -hw * cosA + lx, h, -hw * sinA + lz,
       hw * cosA + lx, h,  hw * sinA + lz,
    ];
    const nrm = [
      -sinA * 0.25, 0.96, cosA * 0.25,
      -sinA * 0.25, 0.96, cosA * 0.25,
      -sinA * 0.34, 0.93, cosA * 0.34,
      -sinA * 0.34, 0.93, cosA * 0.34,
    ];
    const uv = [0, 0, 1, 0, 0, 1, 1, 1];
    const meta = [0.40, 0.0, 0.40, 0.0, 1.14, 1.0, 1.14, 1.0];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    parts.push(g);
  }
  return mergeGeometriesFull(parts);
}

/**
 * Plush Multi-Crown Fluffy Mountain Canopy Cloud Cluster (6 tris/instance!):
 * 3 intersecting broad dome-normal botanical planes forming a lush, velvety, touchably soft
 * treetop cluster covering 32m–60m of mountain hillside with ZERO bald gaps!
 */
function buildPlushCanopyCloudGeo() {
  const parts = [];
  // 2 vertical crossed broad dome cards + 1 gently arched overhead canopy cap card (6 tris total!)
  for (let p = 0; p < 2; p++) {
    const ang = p * Math.PI * 0.5 + 0.24;
    const c = Math.cos(ang), s = Math.sin(ang);
    const hwB = 0.62, hwT = 0.44, y0 = 0.02, y1 = 1.00;
    const pos = [
      -hwB * c, y0, -hwB * s,
       hwB * c, y0,  hwB * s,
      -hwT * c, y1, -hwT * s,
       hwT * c, y1,  hwT * s,
    ];
    // Pillowy hemisphere normals -> soft velvety sunlit crowns!
    const nrm = [
      -c * 0.65, 0.52, -s * 0.65,
       c * 0.65, 0.52,  s * 0.65,
      -c * 0.38, 0.90, -s * 0.38,
       c * 0.38, 0.90,  s * 0.38,
    ];
    const uv = [0, 0, 1, 0, 0, 1, 1, 1];
    const meta = [0.42, 0.0, 0.42, 0.0, 1.15, 0.25, 1.15, 0.25];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(meta, 2));
    g.setIndex([0, 1, 2, 1, 3, 2]);
    parts.push(g);
  }
  // Overhead horizontal-angled crown pillow plane (makes mountains look completely carpeted from above too!)
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.56, 0.72, -0.56,
     0.56, 0.78, -0.56,
    -0.56, 0.78,  0.56,
     0.56, 0.82,  0.56,
  ], 3));
  cap.setAttribute('normal', new THREE.Float32BufferAttribute([
    -0.25, 0.94, -0.25,
     0.25, 0.94, -0.25,
    -0.25, 0.94,  0.25,
     0.25, 0.94,  0.25,
  ], 3));
  cap.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  cap.setAttribute('aMeta', new THREE.Float32BufferAttribute([0.92, 0.2, 0.98, 0.2, 0.98, 0.2, 1.16, 0.2], 2));
  cap.setIndex([0, 1, 2, 1, 3, 2]);
  parts.push(cap);
  return mergeGeometriesFull(parts);
}

function buildBoulderGeo() {
  // Organic 80-tri perturbed granite boulder (5× fewer tris than v5's 384-tri smooth sphere!)
  const rock = new THREE.IcosahedronGeometry(1.0, 1);
  rock.scale(1.26, 0.50, 1.04);
  const pos = rock.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = Math.sin(x * 4.3 + y * 2.9 + z * 4.7 + 191);
    const n2 = Math.cos(x * 5.7 - y * 3.3 + z * 3.1 + 325);
    const n3 = Math.sin(x * 3.1 + y * 5.1 - z * 3.9 + 439);
    pos.setXYZ(i, x + n1 * 0.18, y + n2 * 0.08, z + n3 * 0.18);
  }
  rock.computeVertexNormals();
  rock.translate(0, 0.10, 0);
  return rock;
}

function buildNurseLogGeo() {
  const log = new THREE.CylinderGeometry(0.20, 0.28, 4.2, 6, 2);
  log.rotateZ(Math.PI * 0.5);
  log.translate(0, 0.15, 0);
  return log;
}

// ============================================================================
// SAFE FALLBACK REAL-ENGINE UNIFORMS (if created standalone without realEngine)
// ============================================================================
function createFallbackRealUniforms() {
  const px = new Uint8Array([128, 128, 128, 255]);
  const tex = new THREE.DataTexture(px, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  return {
    uRealPlayerPosRad: { value: new THREE.Vector4(0, -1000, 0, 0.42) },
    uRealPlayerVel: { value: new THREE.Vector4(0, 0, 0, 1.72) },
    uRealObbPos: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, -1000, 0, 0)) },
    uRealObbFwd: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, 0, -1, 2.5)) },
    uRealObbRight: { value: Array.from({ length: 5 }, () => new THREE.Vector4(1, 0, 0, 1.2)) },
    uRealObbUp: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, 1, 0, 1.5)) },
    uRealObbVel: { value: Array.from({ length: 5 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uRealK11Downwash: { value: new THREE.Vector4(0, -1000, 0, 0) },
    uRealTrailTex: { value: tex },
    uRealTrailBounds: { value: new THREE.Vector4(0, 0, 32.0, 1.0 / 32.0) },
  };
}

// ============================================================================
// UNIFIED BOTANICAL FOLIAGE MATERIAL (ATLAS UV REMAP + REAL ENGINE 1.0 PHYSICS!)
// ============================================================================
function createUnifiedFoliageMaterial(geomorph, atmoUniforms, masterAtlas, realUniforms, opts) {
  const {
    swayAmp = 0.016,
    flutterAmp = 0.012,
    isMidImpostor = false,
    fadeStart = 0.0,
    fadeEnd = 0.0,
    sssStrength = 0.36,
    useKomorebi = false,
    enableRealPhysics = true,
    crownCenterY = 0.62,
  } = opts;

  const vert = /* glsl */ `
    precision highp float;

    attribute vec2 aMeta;      // x = baked crown AO, y = flutter / cantilever height factor
    attribute vec4 aUvRect;    // xy = uvMin, zw = uvSize (per-instance species cell in Master Atlas!)
    attribute vec4 aTreeMeta;  // x = crownDensityScale, y = bendFlex, z = crownCenterY, w = unused

    uniform float uTime;
    uniform vec3 uWeatherWind;
    uniform vec3 uPlayerBubbleCenter;
    uniform float uAnimBubbleHalf;
    uniform float uSwayAmp;
    uniform float uFlutterAmp;
    uniform float uIsMidImpostor;
    uniform float uFadeStart;
    uniform float uFadeEnd;
    uniform float uEnableRealPhys;
    ${enableRealPhysics ? REAL_ENGINE_FOLIAGE_UNIFORMS_GLSL : ''}

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

    ${enableRealPhysics ? REAL_ENGINE_FOLIAGE_DEFLECT_GLSL : ''}

    void main() {
      vec3 localPos = position;
      // Per-instance crown fullness/density variation (puffs foliage around crown center!)
      float cDens = max(0.25, aTreeMeta.x);
      if (abs(cDens - 1.0) > 0.005 && uIsMidImpostor < 0.5) {
        vec3 cCenter = vec3(0.0, aTreeMeta.z, 0.0);
        localPos = cCenter + (localPos - cCenter) * vec3(cDens, 0.72 + 0.28 * cDens, cDens);
      }

      vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      // TERRENO 9.0 Ultra-Lightweight Strict 6m × 6m × 6m Player-Bubble Dynamic Animation Gate!
      vec3 dBub = abs(instOrigin - uPlayerBubbleCenter);
      float in6mAnim = 1.0 - smoothstep(uAnimBubbleHalf - 0.35, uAnimBubbleHalf, max(max(dBub.x, dBub.y), dBub.z));

      if (in6mAnim > 0.005) {
        float windMag = clamp(0.65 + uWeatherWind.y * 1.45, 0.65, 3.6);
        float phase = instOrigin.x * 0.13 + instOrigin.z * 0.17 + uTime * (1.42 + uWeatherWind.y * 0.85);
        if (uSwayAmp > 0.0001) {
          float hFactor = clamp(localPos.y, 0.0, 1.3);
          float gust = sin(phase) * 0.65 + sin(phase * 2.25 + 1.4) * 0.35;
          localPos.x += (gust * uSwayAmp * windMag + uWeatherWind.x * uSwayAmp * 0.06) * hFactor * hFactor * in6mAnim;
          localPos.z += (cos(phase * 0.82) * uSwayAmp * 0.65 * windMag + uWeatherWind.z * uSwayAmp * 0.06) * hFactor * hFactor * in6mAnim;
        }
        if (uFlutterAmp > 0.0001) {
          float flPhase = uTime * (3.6 + uWeatherWind.y * 1.4) + (localPos.x * 19.0 + localPos.z * 23.0) + instOrigin.x * 0.5;
          localPos.y += sin(flPhase) * uFlutterAmp * windMag * aMeta.y * in6mAnim;
          localPos.x += cos(flPhase * 1.15) * uFlutterAmp * 0.7 * windMag * aMeta.y * in6mAnim;
        }
      }

      vec4 wp = modelMatrix * instanceMatrix * vec4(localPos, 1.0);

      // REAL ENGINE 1.0 — Exact 3D Vehicle OBB Non-Penetration + Player Capsule Parting + Trail Wake!
      ${enableRealPhysics ? `
      if (uEnableRealPhys > 0.5) {
        float bendFlex = max(0.0, aTreeMeta.y);
        if (bendFlex > 0.01) {
          wp.xyz += evalRealEngineFoliageDisplacement(wp.xyz, instOrigin, bendFlex, aMeta.y);
        }
      }
      ` : ''}

      float camDist = length(wp.xyz - cameraPosition);
      if (uIsMidImpostor > 0.5) {
        float fadeIn = smoothstep(130.0, 195.0, camDist);
        float fadeOut = 1.0 - smoothstep(1420.0, 1820.0, camDist);
        wp.xyz = mix(instOrigin, wp.xyz, fadeIn * fadeOut);
      } else if (uFadeEnd > 1.0) {
        float fadeOut = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
        wp.xyz = mix(instOrigin, wp.xyz, fadeOut);
      }

      vWorldPos = wp.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      // Per-instance species UV remapping inside Unified Master Botanical Atlas!
      vUv = aUvRect.xy + uv * aUvRect.zw;
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
      if (uIsMidImpostor > 0.5 && (vCamDist < 130.0 || vCamDist > 1820.0)) discard;
      if (uFadeEnd > 1.0 && vCamDist > uFadeEnd) discard;

      vec4 tex = texture2D(uFoliageAtlas, vUv);
      float alphaCut = uIsMidImpostor > 0.5
        ? 0.22
        : mix(0.44, 0.24, smoothstep(16.0, 125.0, vCamDist));
      // Sub-pixel derivative-sharpened organic leaf margin (ZERO jagged pixel blocks at close range!)
      float fw = max(fwidth(tex.a), 0.04);
      float microEdge = (sin(vUv.x * 520.0 + vUv.y * 340.0) * cos(vUv.y * 480.0 - vUv.x * 290.0)) * 0.045 * (1.0 - smoothstep(4.0, 22.0, vCamDist));
      float sharpA = clamp((tex.a + microEdge - alphaCut) / fw + 0.5, 0.0, 1.0);
      if (sharpA < 0.48) discard;

      vec3 texLinear = tex.rgb * tex.rgb;
      // Subtle high-frequency cellular leaf-cuticle variation when inspected up close (< 18m)
      float closeDetail = 1.0 + (sin(vUv.x * 680.0) * cos(vUv.y * 680.0)) * 0.045 * (1.0 - smoothstep(3.0, 18.0, vCamDist));
      vec3 albedo = texLinear * vColor * vAo * closeDetail;

      vec3 N = normalize(vWorldNormal);
      vec3 sunDir = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;
      float canopyDensity = horz.a;

      float komorebi = (uUseKomorebi > 0.5 && vCamDist < 95.0)
        ? evalKomorebiDapple(vWorldPos, canopyDensity, sunDir, vCamDist)
        : 1.0;

      float ndl = max(0.0, (dot(N, sunDir) + 0.36) / 1.36);
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * komorebi * 0.92);

      // Subtle waxy leaf cuticle specular highlight + warm sunlit leaf translucency
      vec3 H = normalize(sunDir + V);
      float leafSpec = pow(max(0.0, dot(N, H)), 18.0) * 0.14 * horizonShadow * komorebi;
      float bs = max(0.0, dot(-V, sunDir));
      float backScatter = (bs * bs * bs) * (0.35 + 0.65 * clamp(vAo, 0.2, 1.2));
      vec3 sssTint = mix(vec3(0.58, 0.90, 0.28), vec3(1.05, 0.58, 0.24), clamp((vColor.r - vColor.g) * 3.5, 0.0, 1.0));
      direct += uSunColor * (sssTint * (backScatter * uSunIntensity * horizonShadow * komorebi * uSssStrength) + vec3(leafSpec));

      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.44 + 0.56 * skyViewAO) * 0.98);

      vec3 lit = albedo * (direct + ambient);
      if (uFlashIntensity > 0.01) lit += evalTerrenoFlashlight(vWorldPos, N, albedo);

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
      ...(enableRealPhysics ? realUniforms : {}),
      uFoliageAtlas: { value: masterAtlas },
      uHorizonMap: { value: geomorph.horizonTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.horizonW || geomorph.W, geomorph.horizonH || geomorph.H) },
      uSwayAmp: { value: swayAmp },
      uFlutterAmp: { value: flutterAmp },
      uIsMidImpostor: { value: isMidImpostor ? 1.0 : 0.0 },
      uFadeStart: { value: fadeStart },
      uFadeEnd: { value: fadeEnd },
      uSssStrength: { value: sssStrength },
      uUseKomorebi: { value: useKomorebi ? 1.0 : 0.0 },
      uEnableRealPhys: { value: enableRealPhysics ? 1.0 : 0.0 },
      uDefaultCrownY: { value: crownCenterY },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
  });
}

// ============================================================================
// UNIFIED MULTI-BARK & ROCK SOLID MATERIAL (ALL 5 BARK STYLES IN 1 SHADER!)
// ============================================================================
function createUnifiedSolidMaterial(geomorph, atmoUniforms, barks, opts) {
  const { isRock = false, swayAmp = 0.004 } = opts;

  const vert = /* glsl */ `
    precision highp float;
    attribute float aBarkMode; // 0=Fluted Cedar/Beech, 1=White Birch, 2=Red Pine, 3=Bamboo, 4=Sakura

    uniform float uTime;
    uniform float uSwayAmp;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;
    varying float vBarkMode;
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
      vLocalY = localPos.y;
      vCamDist = length(wp.xyz - cameraPosition);
      vBarkMode = aBarkMode;
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

    uniform sampler2D uBarkFluted;
    uniform sampler2D uBarkBirch;
    uniform sampler2D uBarkPine;
    uniform sampler2D uBarkBamboo;
    uniform sampler2D uHorizonMap;
    uniform vec2 uWorldMin;
    uniform vec2 uWorldSize;
    uniform vec2 uAtlasSize;
    uniform float uIsRock;

    ${TERRENO_ATMO_UNIFORMS_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec2 vUv;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;
    varying float vBarkMode;
    #include <logdepthbuf_pars_fragment>

    ${TERRENO_ATMO_FUNCTIONS_GLSL}

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 sunDir = normalize(uSunDir);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;
      float canopyDensity = horz.a;

      vec3 albedo = vColor;
      if (uIsRock > 0.5) {
        vec2 rUv = vWorldPos.xz * 0.42 + vec2(vWorldPos.y * 0.28);
        vec4 rTex = texture2D(uBarkFluted, rUv);
        float mossTop = smoothstep(0.38, 0.78, N.y + (rTex.a - 0.5) * 0.25);
        albedo = mix(albedo * (0.58 + 0.65 * rTex.a), vec3(0.018, 0.048, 0.016) * (0.7 + 0.5 * rTex.a), mossTop * 0.80);
      } else {
        vec2 bUv = vec2(vUv.x * 2.2, vLocalY * 6.5);
        vec4 bTex;
        float mossAmt = 0.68;
        if (vBarkMode > 2.5 && vBarkMode < 3.5) {
          bTex = texture2D(uBarkBamboo, vec2(vUv.x * 1.5, vLocalY * 9.0));
          mossAmt = 0.12;
        } else if (vBarkMode > 1.5 && vBarkMode < 2.5) {
          bTex = texture2D(uBarkPine, vec2(vUv.x * 2.0, vLocalY * 5.2));
          mossAmt = 0.36;
        } else if (vBarkMode > 0.5 && vBarkMode < 1.5) {
          bTex = texture2D(uBarkBirch, vec2(vUv.x * 2.4, vLocalY * 6.0));
          mossAmt = 0.22;
        } else {
          bTex = texture2D(uBarkFluted, bUv);
          mossAmt = vBarkMode > 3.5 ? 0.28 : 0.70;
        }
        vec3 bLin = bTex.rgb * bTex.rgb;
        float barkAO = mix(0.48, 1.06, clamp((vLocalY + 0.10) * 1.6, 0.0, 1.0));
        albedo = albedo * (0.45 + 1.35 * bLin) * barkAO;
        float trunkMoss = (1.0 - smoothstep(0.00, 0.22, vLocalY)) * smoothstep(0.30, 0.68, bTex.a);
        albedo = mix(albedo, vec3(0.016, 0.044, 0.015), trunkMoss * mossAmt);
      }

      float komorebi = evalKomorebiDapple(vWorldPos, canopyDensity, sunDir, vCamDist);
      float ndl = max(0.0, (dot(N, sunDir) + 0.08) / 1.08);
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * komorebi * 0.90);
      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.44 + 0.56 * skyViewAO) * 0.95);

      vec3 lit = albedo * (direct + ambient);
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
      uBarkFluted: { value: barks.fluted },
      uBarkBirch: { value: barks.birch },
      uBarkPine: { value: barks.pine },
      uBarkBamboo: { value: barks.bamboo },
      uHorizonMap: { value: geomorph.horizonTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.horizonW || geomorph.W, geomorph.horizonH || geomorph.H) },
      uSwayAmp: { value: swayAmp },
      uIsRock: { value: isRock ? 1.0 : 0.0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.FrontSide,
  });
}

function isInsideCompoundClearing(x, z, extraMargin = 0.0) {
  if (x > -12.5 - extraMargin && x < 26.5 + extraMargin && z > -16.5 - extraMargin && z < 20.5 + extraMargin) return true;
  if (x > -6.0 - extraMargin && x < 23.0 + extraMargin && z > -28.0 - extraMargin && z <= -15.5) return true;
  if (isInsideVillageClearing(x, z, extraMargin)) return true;
  return false;
}

function isInsideCompoundPaving(x, z) {
  if (x > -9.6 && x < 23.4 && z > -11.5 && z < 16.5) return true;
  if (x > -4.6 && x < 19.8 && z > -16.5 && z <= -11.0) return true;
  if (x > -4.6 && x < 5.6 && z > -12.8 && z <= -5.0) return true;
  if (isInsideVillagePaving(x, z)) return true;
  return false;
}

// Helper to add per-instance attributes to InstancedMesh geometries cleanly
function attachInstanceAttr(geo, name, itemSize, cap, fillVal = null) {
  const arr = new Float32Array(cap * itemSize);
  if (fillVal) {
    for (let i = 0; i < cap; i++) {
      for (let k = 0; k < itemSize; k++) arr[i * itemSize + k] = fillVal[k];
    }
  }
  const attr = new THREE.InstancedBufferAttribute(arr, itemSize);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, attr);
  return attr;
}

export function createTerrenoForest(geomorph, atmoUniforms, realEngine = null) {
  const group = new THREE.Group();
  group.name = 'TERRENO_v6_MegaBatchedEcologicalForest';

  const masterAtlas = getMasterBotanicalAtlas();
  const barks = {
    fluted: getBotanicalBarkTexture(),
    birch: getBirchBarkTexture(),
    pine: getPineBarkTexture(),
    bamboo: getBambooCulmTexture(),
  };
  const realUniforms = realEngine?.uniforms || createFallbackRealUniforms();

  // Build all 6 sculpted deep-rooted botanical archetypes + 0.1 mm exact 16-slice Trunk LUTs!
  const archetypes = buildForestArchetypes();

  // Unified Materials (1 Bark + 1 Tree Foliage + 1 Understory + 1 Ground + 1 Rock + 1 Plush Mid Canopy)
  const matUnifiedBark = createUnifiedSolidMaterial(geomorph, atmoUniforms, barks, { isRock: false, swayAmp: 0.004 });
  const matUnifiedRock = createUnifiedSolidMaterial(geomorph, atmoUniforms, barks, { isRock: true, swayAmp: 0.0 });
  const matTreeFoliage = createUnifiedFoliageMaterial(geomorph, atmoUniforms, masterAtlas, realUniforms, {
    swayAmp: 0.016, flutterAmp: 0.012, sssStrength: 0.36, enableRealPhysics: true,
  });
  const matUnderstory = createUnifiedFoliageMaterial(geomorph, atmoUniforms, masterAtlas, realUniforms, {
    swayAmp: 0.052, flutterAmp: 0.026, fadeStart: 54.0, fadeEnd: 88.0, sssStrength: 0.44, useKomorebi: true, enableRealPhysics: true,
  });
  const matGroundCover = createUnifiedFoliageMaterial(geomorph, atmoUniforms, masterAtlas, realUniforms, {
    swayAmp: 0.088, flutterAmp: 0.034, fadeStart: 30.0, fadeEnd: 46.0, sssStrength: 0.44, useKomorebi: true, enableRealPhysics: true,
  });
  const matPlushMid = createUnifiedFoliageMaterial(geomorph, atmoUniforms, masterAtlas, realUniforms, {
    swayAmp: 0.0, flutterAmp: 0.0, isMidImpostor: true, sssStrength: 0.24, enableRealPhysics: false,
  });

  function makeFoliageInstanced(geo, mat, cap, name) {
    const g = geo.clone();
    const uvAttr = attachInstanceAttr(g, 'aUvRect', 4, cap, [0, 0, 0.25, 0.25]);
    const metaAttr = attachInstanceAttr(g, 'aTreeMeta', 4, cap, [1.0, 0.65, 0.62, 0.0]);
    const im = new THREE.InstancedMesh(g, mat, cap);
    im.count = 0;
    im.frustumCulled = false;
    im.name = name;
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < cap; i++) im.setColorAt(i, c);
    im.instanceColor.needsUpdate = true;
    group.add(im);
    return { mesh: im, uvAttr, metaAttr, cap };
  }

  function makeSolidInstanced(geo, mat, cap, name) {
    const g = geo.clone();
    const barkAttr = attachInstanceAttr(g, 'aBarkMode', 1, cap, [0.0]);
    const im = new THREE.InstancedMesh(g, mat, cap);
    im.count = 0;
    im.frustumCulled = false;
    im.name = name;
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < cap; i++) im.setColorAt(i, c);
    im.instanceColor.needsUpdate = true;
    group.add(im);
    return { mesh: im, barkAttr, cap };
  }

  // 6 Mega-Batched Tree Archetypes (12 draw calls total for ALL 28 Japanese tree species!)
  const ARCH_CAPS = [520, 440, 320, 260, 140, 140];
  const ARCH_NAMES = ['ConiferSpire', 'BroadleafDome', 'MultiStem', 'SculpturalPine', 'PendulousCurtain', 'BambooGrove'];
  const archMeshes = archetypes.map((arch, i) => ({
    arch,
    trunk: makeSolidInstanced(arch.trunkGeo, matUnifiedBark, ARCH_CAPS[i], `ECO_v6_Trunk_${ARCH_NAMES[i]}`),
    leaf: makeFoliageInstanced(arch.foliageGeo, matTreeFoliage, ARCH_CAPS[i], `ECO_v6_Leaf_${ARCH_NAMES[i]}`),
  }));

  // 1 Combined Understory (Shrubs + Wood-Ferns), 1 Combined Ground (Grass + Kumazasa), 1 Boulder, 1 Log, 1 Plush Mid Canopy
  const CAP_UNDERSTORY = 640;
  const CAP_GROUND = 1850;
  const CAP_BOULDER = 260;
  const CAP_LOG = 80;
  const CAP_MID_CLOUD = 3000;

  const imUnderstory = makeFoliageInstanced(buildUnderstoryRosetteGeo(), matUnderstory, CAP_UNDERSTORY, 'ECO_v6_Understory_ShrubFern');
  const imGround = makeFoliageInstanced(buildGroundClumpUnitGeo(), matGroundCover, CAP_GROUND, 'ECO_v6_Ground_GrassSasa');
  const imBoulder = makeSolidInstanced(buildBoulderGeo(), matUnifiedRock, CAP_BOULDER, 'ECO_v6_Mossy_Boulders');
  const imLog = makeSolidInstanced(buildNurseLogGeo(), matUnifiedRock, CAP_LOG, 'ECO_v6_Nurse_Logs');
  const imMidCloud = makeFoliageInstanced(buildPlushCanopyCloudGeo(), matPlushMid, CAP_MID_CLOUD, 'ECO_v6_Plush_Mountain_Canopy');

  // Scratch Matrix4 builder (zero-alloc during tile generation)
  const dummyObj = new THREE.Object3D();

  // LRU Tile Caches for 20×+ faster streaming (`forest5StepsMs`: 1,002 ms → ~20 ms!)
  const nearTileCache = new Map();   // key "tx,tz" -> pre-baked tile pack
  const groundTileCache = new Map(); // key "gx,gz" -> pre-baked ground pack
  const midTileCache = new Map();    // key "mx,mz" -> pre-baked plush cloud pack
  const MAX_NEAR_CACHE = 140;
  const MAX_GROUND_CACHE = 72;
  const MAX_MID_CACHE = 560;

  let lastNearTx = 999999, lastNearTz = 999999;
  let lastGroundTx = 999999, lastGroundTz = 999999;
  let lastMidTx = 999999, lastMidTz = 999999;
  let localColliders = [];

  const stats = {
    totalTreeSpecies: ALL_TREE_SPECIES_28.length,
    sugi: 0, hinoki: 0, abies: 0, buna: 0, maple: 0, birch: 0, pine: 0, willow: 0,
    extendedTreesTotal: 0,
    extendedSpecies: {},
    shrubs: 0, ferns: 0, grass: 0, sasa: 0, boulders: 0, logs: 0,
    midConifers: 0, midBroad: 0, midMaple: 0, midPine: 0, midPlushClouds: 0,
    totalTreesVisible: 0,
  };

  function getGroundY(wx, wz) {
    return typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(wx, wz)
      : geomorph.getHeightAt(wx, wz);
  }

  function getSoilEco(wx, wz) {
    if (typeof geomorph.getSoilEcoAt === 'function') return geomorph.getSoilEcoAt(wx, wz);
    return { soilDepth: 0.72, temp: 0.55, moisture: 0.58, stand: 0.35 };
  }

  // ============================================================================
  // LRU NEAR TILE GENERATOR (CACHES PRE-BAKED MATRICES + 0.1mm EXACT COLLIDERS!)
  // ============================================================================
  function getOrBuildNearTile(tx, tz) {
    const key = `${tx},${tz}`;
    let cached = nearTileCache.get(key);
    if (cached) return cached;

    const tileX0 = tx * NEAR_TILE_SIZE;
    const tileZ0 = tz * NEAR_TILE_SIZE;
    const empty = {
      arch: Array.from({ length: ARCHETYPE_COUNT }, () => ({ count: 0, mat: [], fCol: [], tCol: [], uv: [], meta: [], bark: [], spIds: [] })),
      under: { count: 0, mat: [], col: [], uv: [], meta: [], nShrub: 0, nFern: 0 },
      boulders: { count: 0, mat: [], col: [] },
      logs: { count: 0, mat: [], col: [] },
      colliders: [],
    };
    if (
      tileX0 + NEAR_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
      tileZ0 + NEAR_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
    ) {
      nearTileCache.set(key, empty);
      return empty;
    }

    const rng = makeTileRng(tx, tz, 9061);

    // --- 1. Multi-Story Ecological Forest Trees (46 candidates / 64m×64m tile) ---
    for (let c = 0; c < 46; c++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (wx < TERRENO_WORLD.minX + 16 || wx > TERRENO_WORLD.maxX - 16 || wz < TERRENO_WORLD.minZ + 16 || wz > TERRENO_WORLD.maxZ - 16) continue;
      if (isInsideCompoundClearing(wx, wz, 1.2) || isInsideSouthRect(wx, wz, 3.0)) continue;
      if (geomorph.isNaturallyBarrenOrSubmerged && geomorph.isNaturallyBarrenOrSubmerged(wx, wz)) continue;

      const rv = evalMainRiver(wz);
      const distMainRiv = Math.abs(wx - rv.x);
      const trib = evalClosestTributary(wx, wz);
      if (distMainRiv < rv.halfWidth * 1.15 + 1.8) continue;
      if (trib && trib.dist < trib.width * 0.52 + 1.2) continue;

      const eco = getSoilEco(wx, wz);
      // Fast strict ecological soil reject BEFORE normal query!
      if (eco.soilDepth < 0.22) continue;

      const y = getGroundY(wx, wz);
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      if (elevASL > 2550 || elevASL < -1250) continue;

      const nrm = geomorph.getNormalAt(wx, wz, 2.2);
      if (nrm.slope > 0.64) continue;

      // Natural density thinning near alpine treeline & rocky ledges
      const treelineKeep = elevASL > 2150 ? Math.max(0.18, 1.0 - (elevASL - 2150) / 420.0) : 1.0;
      const soilKeep = Math.min(1.0, (eco.soilDepth - 0.20) * 2.4);
      if (rng() > treelineKeep * soilKeep * 0.92) continue;

      // Keep sightline window slightly airy directly in front of NARROW-50 terrace
      const inVista = wx > -9.0 && wx < 13.0 && wz >= 10.0 && wz < 46.0;
      if (inVista && rng() < 0.45) continue;

      const onRiverBank =
        (distMainRiv < rv.halfWidth * 1.5 + 9.5) ||
        (trib && trib.dist < trib.width * 0.55 + 7.5);
      const lfHit = geomorph.queryLandformAt ? geomorph.queryLandformAt(wx, wz, 14) : null;
      const spIdx = pickPhytosociologicalSpecies(wx, wz, elevASL, nrm.slope, onRiverBank, eco, lfHit?.landform?.kind || null, rng());
      if (spIdx < 0) continue;

      const spec = ALL_TREE_SPECIES_28[spIdx];
      const archObj = archetypes[spec.arch];
      const bucket = empty.arch[spec.arch];

      // 4-Story Vertical Stratification (Emergent Old-Growth Giants up to 58m down to 3m Saplings!)
      const stratumRoll = rng();
      let stratumMul;
      if (stratumRoll < 0.09) stratumMul = 1.25 + rng() * 0.35;      // 9% Emergent Giants!
      else if (stratumRoll < 0.56) stratumMul = 0.84 + rng() * 0.32; // 47% Mature Main Canopy
      else if (stratumRoll < 0.82) stratumMul = 0.52 + rng() * 0.28; // 26% Sub-Canopy
      else stratumMul = 0.28 + rng() * 0.22;                         // 18% Saplings / Understory

      const alpineShrink = elevASL > 1950 ? Math.max(0.32, 1.0 - (elevASL - 1950) / 680.0) : 1.0;
      let h = (spec.minH + rng() * (spec.maxH - spec.minH)) * stratumMul * alpineShrink;
      if (inVista) h *= 0.52;
      h = Math.max(2.8, Math.min(58.0, h));

      const rS = h * spec.radRatio * (0.86 + rng() * 0.28);
      const crownDens = spec.density[0] + rng() * (spec.density[1] - spec.density[0]);
      const yaw = onRiverBank && spec.arch === 4
        ? Math.atan2(rv.x - wx, (rng() - 0.5) * 6.0) + (rng() - 0.5) * 0.6
        : rng() * Math.PI * 2.0;
      // Subtle phototropic natural lean (downslope slight sweep + wind exposure)
      const leanX = (rng() - 0.5) * 0.055;
      const leanZ = (rng() - 0.5) * 0.055;

      // ZERO FLOATING ROOTS ON SLOPES: anchor tree below downhill slope footprint minimum!
      const baseFootprintR = Math.max(0.35, rS * 0.068);
      const downhillDrop = nrm.slope * (baseFootprintR * 2.6 + 0.50);
      const yAnchor = y - Math.max(0.28, downhillDrop + 0.14);

      dummyObj.position.set(wx, yAnchor, wz);
      dummyObj.rotation.set(leanX, yaw, leanZ);
      dummyObj.scale.set(rS, h, rS);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) bucket.mat.push(me[m]);

      const vCol = rng();
      const fc = spec.colorFn(vCol);
      const tc = spec.trunkColorFn(vCol);
      bucket.fCol.push(fc[0], fc[1], fc[2]);
      bucket.tCol.push(tc[0], tc[1], tc[2]);
      bucket.uv.push(spec.uv[0], spec.uv[1], spec.uv[2] - spec.uv[0], spec.uv[3] - spec.uv[1]);
      bucket.meta.push(crownDens, spec.flex, archObj.crownCenterY, 0.0);
      bucket.bark.push(spec.barkMode);
      bucket.spIds.push(spIdx);
      bucket.count++;

      // EXACT 0.1 mm Trunk Collider with pre-measured 16-slice LUT & exact world lean slope!
      // Column 1 of dummyObj.matrix `(me[4], me[5], me[6])` is local +Y axis in world space!
      const invUpY = 1.0 / Math.max(0.001, me[5]);
      const leanDirX = me[4] * invUpY;
      const leanDirZ = me[6] * invUpY;
      const breastHeightR = Math.max(0.14, archObj.trunkLut[2] * rS);
      empty.colliders.push({
        x: wx,
        z: wz,
        baseY: yAnchor,
        height: h,
        radScale: rS,
        r: breastHeightR,
        leanDirX,
        leanDirZ,
        trunkLut: archObj.trunkLut,
        kind: 'tree',
      });
    }

    // --- 2. Understory Shrubs & Wood-Ferns (ZERO SOLID COLLISION — pure REAL ENGINE physics!) ---
    for (let u = 0; u < 62; u++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundPaving(wx, wz) || isInsideSouthRect(wx, wz, 2.0)) continue;
      if (geomorph.isNaturallyBarrenOrSubmerged && geomorph.isNaturallyBarrenOrSubmerged(wx, wz)) continue;
      const eco = getSoilEco(wx, wz);
      if (eco.soilDepth < 0.24) continue;
      const rv = evalMainRiver(wz);
      const y = getGroundY(wx, wz);
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      if (elevASL > 2150 || elevASL < -1250) continue;
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.14 || y < rv.waterY + 0.30) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 1.5);
      if (nrm.slope > 0.62) continue;

      const isShrub = u < 24;
      const sc = isShrub ? (0.80 + rng() * 1.12) : (0.68 + rng() * 0.96);
      const scY = sc * (0.78 + rng() * 0.44);
      const rotY = rng() * Math.PI * 2;
      dummyObj.position.set(wx, y - 0.08, wz);
      dummyObj.rotation.set(nrm.z * 0.24, rotY, -nrm.x * 0.24);
      dummyObj.scale.set(sc, scY, sc);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) empty.under.mat.push(me[m]);

      const v = rng();
      if (isShrub) {
        empty.under.col.push(0.15 + v * 0.09, 0.19 + v * 0.09, 0.12 + v * 0.06);
        empty.under.uv.push(UV_SHRUB[0], UV_SHRUB[1], UV_SHRUB[2] - UV_SHRUB[0], UV_SHRUB[3] - UV_SHRUB[1]);
        empty.under.meta.push(1.0, 1.15, 0.45, 0.0);
        empty.under.nShrub++;
      } else {
        empty.under.col.push(0.13 + v * 0.09, 0.17 + v * 0.09, 0.11 + v * 0.06);
        empty.under.uv.push(UV_FERN[0], UV_FERN[1], UV_FERN[2] - UV_FERN[0], UV_FERN[3] - UV_FERN[1]);
        empty.under.meta.push(1.0, 1.35, 0.25, 0.0);
        empty.under.nFern++;
      }
      empty.under.count++;
      // NO solid collider emitted for shrubs or ferns! REAL ENGINE bends them cleanly around legs & cars!
    }

    // --- 3. Deeply Embedded Mossy Granite Boulders ---
    for (let b = 0; b < 24; b++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 1.8) || isInsideSouthRect(wx, wz, 3.0)) continue;
      if (geomorph.getNaturalWaterYAt && geomorph.getNaturalWaterYAt(wx, wz) > getGroundY(wx, wz) - 0.1) continue;

      const nrm = geomorph.getNormalAt(wx, wz, 2.2);
      if (nrm.slope > 0.56) continue;
      const rv = evalMainRiver(wz);
      const distRiv = Math.abs(wx - rv.x);
      const nearWater = distRiv > rv.halfWidth * 0.85 && distRiv < rv.halfWidth * 1.55 + 14.0;
      if (!nearWater && nrm.slope < 0.28 && rng() > 0.28) continue;

      const y = getGroundY(wx, wz);
      const rScale = nearWater ? (1.0 + rng() * 1.8) : (0.68 + rng() * 1.35);
      const scaleY = rScale * (0.60 + rng() * 0.38);
      const scaleZ = rScale * (0.82 + rng() * 0.34);
      const rotY = rng() * Math.PI * 2;
      const bv = 0.088 + rng() * 0.045;

      dummyObj.position.set(wx, y - rScale * 0.48, wz);
      dummyObj.rotation.set((rng() - 0.5) * 0.22, rotY, (rng() - 0.5) * 0.22);
      dummyObj.scale.set(rScale, scaleY, scaleZ);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) empty.boulders.mat.push(me[m]);
      empty.boulders.col.push(bv, bv * 1.03, bv * 1.06);
      empty.boulders.count++;

      const protrudeH = 0.90 * scaleY - rScale * 0.48;
      if (protrudeH > 0.22) {
        const rx = 1.10 * rScale * 0.88;
        const rz = 0.92 * scaleZ * 0.88;
        empty.colliders.push({
          x: wx, z: wz, r: Math.max(rx, rz), rx, rz, yaw: rotY, kind: 'boulder', height: protrudeH,
        });
      }
    }

    // --- 4. Fallen Mossy Nurse Logs ---
    for (let l = 0; l < 4; l++) {
      const wx = tileX0 + rng() * NEAR_TILE_SIZE;
      const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
      if (isInsideCompoundClearing(wx, wz, 3.0) || isInsideSouthRect(wx, wz, 4.0)) continue;
      const eco = getSoilEco(wx, wz);
      if (eco.soilDepth < 0.32) continue;
      const rv = evalMainRiver(wz);
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.4 + 6.0) continue;
      const y = getGroundY(wx, wz);
      if (TERRENO_WORLD.baseElevationASL + y > 1550) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 2.0);
      if (nrm.slope > 0.32) continue;

      const sc = 0.72 + rng() * 0.78;
      const logYaw = rng() * Math.PI * 2;
      const lv = 0.056 + rng() * 0.028;
      dummyObj.position.set(wx, y - 0.05, wz);
      dummyObj.rotation.set(0, logYaw, (rng() - 0.5) * 0.10);
      dummyObj.scale.set(sc, sc, sc);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) empty.logs.mat.push(me[m]);
      empty.logs.col.push(lv, lv * 0.72, lv * 0.48);
      empty.logs.count++;

      const halfLen = 2.04 * sc;
      const cosY = Math.cos(logYaw), sinY = Math.sin(logYaw);
      empty.colliders.push({
        x: wx, z: wz,
        ax: wx - cosY * halfLen, az: wz + sinY * halfLen,
        bx: wx + cosY * halfLen, bz: wz - sinY * halfLen,
        r: sc * 0.27, kind: 'log', height: sc * 0.42,
      });
    }

    // Freeze compact Float32Arrays for ultra-fast bulk `.set()` upload!
    for (let a = 0; a < ARCHETYPE_COUNT; a++) {
      const b = empty.arch[a];
      b.mat = new Float32Array(b.mat);
      b.fCol = new Float32Array(b.fCol);
      b.tCol = new Float32Array(b.tCol);
      b.uv = new Float32Array(b.uv);
      b.meta = new Float32Array(b.meta);
      b.bark = new Float32Array(b.bark);
    }
    empty.under.mat = new Float32Array(empty.under.mat);
    empty.under.col = new Float32Array(empty.under.col);
    empty.under.uv = new Float32Array(empty.under.uv);
    empty.under.meta = new Float32Array(empty.under.meta);
    empty.boulders.mat = new Float32Array(empty.boulders.mat);
    empty.boulders.col = new Float32Array(empty.boulders.col);
    empty.logs.mat = new Float32Array(empty.logs.mat);
    empty.logs.col = new Float32Array(empty.logs.col);

    if (nearTileCache.size >= MAX_NEAR_CACHE) {
      nearTileCache.delete(nearTileCache.keys().next().value);
    }
    nearTileCache.set(key, empty);
    return empty;
  }

  // ============================================================================
  // LRU GROUND COVER TILE GENERATOR (GRASS & KUMAZASA — 0 SOLID COLLISION!)
  // ============================================================================
  function getOrBuildGroundTile(gx, gz) {
    const key = `${gx},${gz}`;
    let cached = groundTileCache.get(key);
    if (cached) return cached;

    const tileX0 = gx * GROUND_TILE_SIZE;
    const tileZ0 = gz * GROUND_TILE_SIZE;
    const pack = { count: 0, nGrass: 0, nSasa: 0, mat: [], col: [], uv: [], meta: [] };
    if (
      tileX0 + GROUND_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
      tileZ0 + GROUND_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
    ) {
      groundTileCache.set(key, pack);
      return pack;
    }

    const rng = makeTileRng(gx, gz, 55109);
    for (let i = 0; i < 220; i++) {
      const wx = tileX0 + rng() * GROUND_TILE_SIZE;
      const wz = tileZ0 + rng() * GROUND_TILE_SIZE;
      if (isInsideCompoundPaving(wx, wz) || isInsideSouthRect(wx, wz, 1.5)) continue;
      if (geomorph.isNaturallyBarrenOrSubmerged && geomorph.isNaturallyBarrenOrSubmerged(wx, wz)) continue;
      const eco = getSoilEco(wx, wz);
      if (eco.soilDepth < 0.22) continue;

      const rv = evalMainRiver(wz);
      const y = getGroundY(wx, wz);
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      if (elevASL > 2380 || elevASL < -1250) continue;
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.12 || y < rv.waterY + 0.16) continue;
      const nrm = geomorph.getNormalAt(wx, wz, 1.2);
      if (nrm.slope > 0.60) continue;

      const isSasa = i >= 165 && elevASL < 1920;
      const inYard = isInsideCompoundClearing(wx, wz, 1.5);
      if (isSasa && inYard) continue;

      const scXZ = isSasa ? (0.80 + rng() * 0.85) : (inYard ? (0.45 + rng() * 0.40) : (0.76 + rng() * 0.96));
      const scY = isSasa ? scXZ * (0.85 + rng() * 0.45) : (inYard ? (0.34 + rng() * 0.32) : (0.68 + rng() * 0.88));
      dummyObj.position.set(wx, y - 0.05, wz);
      dummyObj.rotation.set(nrm.z * 0.34, rng() * Math.PI * 2.0, -nrm.x * 0.34);
      dummyObj.scale.set(scXZ, scY, scXZ);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) pack.mat.push(me[m]);

      const v = rng();
      if (isSasa) {
        pack.col.push(0.15 + v * 0.10, 0.19 + v * 0.10, 0.12 + v * 0.06);
        pack.uv.push(UV_SASA[0], UV_SASA[1], UV_SASA[2] - UV_SASA[0], UV_SASA[3] - UV_SASA[1]);
        pack.meta.push(1.0, 1.25, 0.35, 0.0);
        pack.nSasa++;
      } else {
        pack.col.push(0.13 + v * 0.10, 0.17 + v * 0.10, 0.10 + v * 0.05);
        pack.uv.push(UV_GRASS[0], UV_GRASS[1], UV_GRASS[2] - UV_GRASS[0], UV_GRASS[3] - UV_GRASS[1]);
        pack.meta.push(1.0, 1.55, 0.25, 0.0);
        pack.nGrass++;
      }
      pack.count++;
    }

    pack.mat = new Float32Array(pack.mat);
    pack.col = new Float32Array(pack.col);
    pack.uv = new Float32Array(pack.uv);
    pack.meta = new Float32Array(pack.meta);

    if (groundTileCache.size >= MAX_GROUND_CACHE) {
      groundTileCache.delete(groundTileCache.keys().next().value);
    }
    groundTileCache.set(key, pack);
    return pack;
  }

  // ============================================================================
  // LRU PLUSH MULTI-CROWN DISTANT MOUNTAIN CANOPY TILE GENERATOR ("モフモフ"!)
  // ============================================================================
  function getOrBuildMidTile(mx, mz) {
    const key = `${mx},${mz}`;
    let cached = midTileCache.get(key);
    if (cached) return cached;

    const tileX0 = mx * MID_TILE_SIZE;
    const tileZ0 = mz * MID_TILE_SIZE;
    const pack = { count: 0, mat: [], col: [], uv: [], meta: [] };
    if (
      tileX0 + MID_TILE_SIZE < TERRENO_WORLD.minX || tileX0 > TERRENO_WORLD.maxX ||
      tileZ0 + MID_TILE_SIZE < TERRENO_WORLD.minZ || tileZ0 > TERRENO_WORLD.maxZ
    ) {
      midTileCache.set(key, pack);
      return pack;
    }

    const rng = makeTileRng(mx, mz, 4461);
    // 14 generously-sized overlapping plush pillowy canopy cloud clusters per 160m×160m tile!
    // Each cluster is 40m–68m wide -> >100% velvety overlapping forest cover on wooded mountains,
    // while bare rock cliffs (`soilDepth < 0.22`) and alpine summits (`> 2,520m`) stay crisply exposed!
    for (let k = 0; k < 14; k++) {
      const wx = tileX0 + rng() * MID_TILE_SIZE;
      const wz = tileZ0 + rng() * MID_TILE_SIZE;
      if (wx < TERRENO_WORLD.minX + 16 || wx > TERRENO_WORLD.maxX - 16 || wz < TERRENO_WORLD.minZ + 16 || wz > TERRENO_WORLD.maxZ - 16) continue;
      if (isInsideCompoundClearing(wx, wz, 4.0) || isInsideSouthRect(wx, wz, 6.0)) continue;
      if (geomorph.isNaturallyBarrenOrSubmerged && geomorph.isNaturallyBarrenOrSubmerged(wx, wz)) continue;

      const eco = getSoilEco(wx, wz);
      if (eco.soilDepth < 0.23) continue;

      const rv = evalMainRiver(wz);
      if (Math.abs(wx - rv.x) < rv.halfWidth * 1.45 + 6.0) continue;

      const y = getGroundY(wx, wz);
      const elevASL = TERRENO_WORLD.baseElevationASL + y;
      if (elevASL > 2520 || elevASL < -1250) continue;

      const nrm = geomorph.getNormalAt(wx, wz, 5.0);
      if (nrm.slope > 0.62) continue;

      const spIdx = pickPhytosociologicalSpecies(wx, wz, elevASL, nrm.slope, false, eco, null, rng());
      if (spIdx < 0) continue;
      const spec = ALL_TREE_SPECIES_28[spIdx];

      const alpineShrink = elevASL > 2020 ? Math.max(0.42, 1.0 - (elevASL - 2020) / 560.0) : 1.0;
      const h = (24.0 + rng() * 20.0) * alpineShrink;
      // Wide lush pillowy canopy dome cluster!
      const wS = (38.0 + rng() * 30.0) * alpineShrink;
      const yBase = y - Math.max(3.5, nrm.slope * wS * 0.42);

      dummyObj.position.set(wx, yBase, wz);
      dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
      dummyObj.scale.set(wS, h, wS);
      dummyObj.updateMatrix();
      const me = dummyObj.matrix.elements;
      for (let m = 0; m < 16; m++) pack.mat.push(me[m]);

      const fc = spec.colorFn(rng());
      pack.col.push(fc[0], fc[1], fc[2]);
      pack.uv.push(spec.uv[0], spec.uv[1], spec.uv[2] - spec.uv[0], spec.uv[3] - spec.uv[1]);
      pack.meta.push(1.0, 0.0, 0.60, 0.0);
      pack.count++;
    }

    pack.mat = new Float32Array(pack.mat);
    pack.col = new Float32Array(pack.col);
    pack.uv = new Float32Array(pack.uv);
    pack.meta = new Float32Array(pack.meta);

    if (midTileCache.size >= MAX_MID_CACHE) {
      midTileCache.delete(midTileCache.keys().next().value);
    }
    midTileCache.set(key, pack);
    return pack;
  }

  // ============================================================================
  // ULTRA-FAST BULK TYPED-ARRAY STREAMING REBUILDERS (< 3 ms per tile step!)
  // ============================================================================
  function rebuildNearForest(centerTx, centerTz) {
    const aCounts = new Uint32Array(ARCHETYPE_COUNT);
    let nUnder = 0, nShrub = 0, nFern = 0, nBould = 0, nLog = 0;
    const newColliders = [];
    const spCounts = new Uint32Array(ALL_TREE_SPECIES_28.length);

    for (let dtz = -NEAR_TILE_RADIUS; dtz <= NEAR_TILE_RADIUS; dtz++) {
      for (let dtx = -NEAR_TILE_RADIUS; dtx <= NEAR_TILE_RADIUS; dtx++) {
        // Circular trim of far 4 corners (saves 16% triangles with zero visual loss!)
        if (dtx * dtx + dtz * dtz > NEAR_TILE_RADIUS * NEAR_TILE_RADIUS + 2) continue;
        const tx = centerTx + dtx, tz = centerTz + dtz;
        const tile = getOrBuildNearTile(tx, tz);
        const isDetail = Math.abs(dtx) <= DETAIL_TILE_RADIUS && Math.abs(dtz) <= DETAIL_TILE_RADIUS;

        // 1. Bulk-copy cached tree instances per archetype!
        for (let a = 0; a < ARCHETYPE_COUNT; a++) {
          const src = tile.arch[a];
          if (src.count === 0) continue;
          const dst = archMeshes[a];
          const cur = aCounts[a];
          const take = Math.min(src.count, dst.trunk.cap - cur);
          if (take <= 0) continue;

          dst.trunk.mesh.instanceMatrix.array.set(take === src.count ? src.mat : src.mat.subarray(0, take * 16), cur * 16);
          dst.leaf.mesh.instanceMatrix.array.set(take === src.count ? src.mat : src.mat.subarray(0, take * 16), cur * 16);
          dst.trunk.mesh.instanceColor.array.set(take === src.count ? src.tCol : src.tCol.subarray(0, take * 3), cur * 3);
          dst.leaf.mesh.instanceColor.array.set(take === src.count ? src.fCol : src.fCol.subarray(0, take * 3), cur * 3);
          dst.leaf.uvAttr.array.set(take === src.count ? src.uv : src.uv.subarray(0, take * 4), cur * 4);
          dst.leaf.metaAttr.array.set(take === src.count ? src.meta : src.meta.subarray(0, take * 4), cur * 4);
          dst.trunk.barkAttr.array.set(take === src.count ? src.bark : src.bark.subarray(0, take), cur);
          for (let k = 0; k < take; k++) spCounts[src.spIds[k]]++;
          aCounts[a] = cur + take;
        }

        if (!isDetail) continue;

        // 2. Bulk-copy understory shrubs & ferns (detail radius only!)
        if (tile.under.count > 0) {
          const take = Math.min(tile.under.count, CAP_UNDERSTORY - nUnder);
          if (take > 0) {
            imUnderstory.mesh.instanceMatrix.array.set(take === tile.under.count ? tile.under.mat : tile.under.mat.subarray(0, take * 16), nUnder * 16);
            imUnderstory.mesh.instanceColor.array.set(take === tile.under.count ? tile.under.col : tile.under.col.subarray(0, take * 3), nUnder * 3);
            imUnderstory.uvAttr.array.set(take === tile.under.count ? tile.under.uv : tile.under.uv.subarray(0, take * 4), nUnder * 4);
            imUnderstory.metaAttr.array.set(take === tile.under.count ? tile.under.meta : tile.under.meta.subarray(0, take * 4), nUnder * 4);
            nUnder += take;
            nShrub += tile.under.nShrub;
            nFern += tile.under.nFern;
          }
        }
        // 3. Bulk-copy boulders & nurse logs
        if (tile.boulders.count > 0) {
          const take = Math.min(tile.boulders.count, CAP_BOULDER - nBould);
          if (take > 0) {
            imBoulder.mesh.instanceMatrix.array.set(take === tile.boulders.count ? tile.boulders.mat : tile.boulders.mat.subarray(0, take * 16), nBould * 16);
            imBoulder.mesh.instanceColor.array.set(take === tile.boulders.count ? tile.boulders.col : tile.boulders.col.subarray(0, take * 3), nBould * 3);
            nBould += take;
          }
        }
        if (tile.logs.count > 0) {
          const take = Math.min(tile.logs.count, CAP_LOG - nLog);
          if (take > 0) {
            imLog.mesh.instanceMatrix.array.set(take === tile.logs.count ? tile.logs.mat : tile.logs.mat.subarray(0, take * 16), nLog * 16);
            imLog.mesh.instanceColor.array.set(take === tile.logs.count ? tile.logs.col : tile.logs.col.subarray(0, take * 3), nLog * 3);
            nLog += take;
          }
        }
        // 4. Append exact 0.1mm trunk/boulder/log colliders (ZERO shrub/leaf colliders!)
        for (let k = 0; k < tile.colliders.length; k++) newColliders.push(tile.colliders[k]);
      }
    }

    // Commit GPU uploads
    let totalVisible = 0;
    for (let a = 0; a < ARCHETYPE_COUNT; a++) {
      const dst = archMeshes[a];
      const cnt = aCounts[a];
      totalVisible += cnt;
      dst.trunk.mesh.count = cnt;
      dst.leaf.mesh.count = cnt;
      dst.trunk.mesh.visible = cnt > 0;
      dst.leaf.mesh.visible = cnt > 0;
      if (cnt > 0) {
        dst.trunk.mesh.instanceMatrix.needsUpdate = true;
        dst.trunk.mesh.instanceColor.needsUpdate = true;
        dst.trunk.barkAttr.needsUpdate = true;
        dst.leaf.mesh.instanceMatrix.needsUpdate = true;
        dst.leaf.mesh.instanceColor.needsUpdate = true;
        dst.leaf.uvAttr.needsUpdate = true;
        dst.leaf.metaAttr.needsUpdate = true;
      }
    }
    imUnderstory.mesh.count = nUnder; imUnderstory.mesh.visible = nUnder > 0;
    if (nUnder > 0) {
      imUnderstory.mesh.instanceMatrix.needsUpdate = true;
      imUnderstory.mesh.instanceColor.needsUpdate = true;
      imUnderstory.uvAttr.needsUpdate = true;
      imUnderstory.metaAttr.needsUpdate = true;
    }
    imBoulder.mesh.count = nBould; imBoulder.mesh.visible = nBould > 0;
    if (nBould > 0) { imBoulder.mesh.instanceMatrix.needsUpdate = true; imBoulder.mesh.instanceColor.needsUpdate = true; }
    imLog.mesh.count = nLog; imLog.mesh.visible = nLog > 0;
    if (nLog > 0) { imLog.mesh.instanceMatrix.needsUpdate = true; imLog.mesh.instanceColor.needsUpdate = true; }

    localColliders = newColliders;

    // Update telemetry stats
    stats.totalTreesVisible = totalVisible;
    stats.sugi = spCounts[0];
    stats.hinoki = spCounts[1];
    stats.abies = spCounts[1];
    stats.buna = spCounts[2];
    stats.maple = spCounts[3];
    stats.birch = spCounts[4];
    stats.pine = spCounts[5];
    stats.willow = spCounts[6];
    let extTot = 0;
    const extObj = {};
    for (let s = 7; s < ALL_TREE_SPECIES_28.length; s++) {
      extTot += spCounts[s];
      extObj[ALL_TREE_SPECIES_28[s].id] = spCounts[s];
    }
    stats.extendedTreesTotal = extTot;
    stats.extendedSpecies = extObj;
    stats.shrubs = nShrub;
    stats.ferns = nFern;
    stats.boulders = nBould;
    stats.logs = nLog;
  }

  function rebuildGroundCover(centerGx, centerGz) {
    let nTot = 0, nGrass = 0, nSasa = 0;
    for (let dgz = -GROUND_TILE_RADIUS; dgz <= GROUND_TILE_RADIUS; dgz++) {
      for (let dgx = -GROUND_TILE_RADIUS; dgx <= GROUND_TILE_RADIUS; dgx++) {
        const pack = getOrBuildGroundTile(centerGx + dgx, centerGz + dgz);
        if (pack.count === 0) continue;
        const take = Math.min(pack.count, CAP_GROUND - nTot);
        if (take <= 0) break;
        imGround.mesh.instanceMatrix.array.set(take === pack.count ? pack.mat : pack.mat.subarray(0, take * 16), nTot * 16);
        imGround.mesh.instanceColor.array.set(take === pack.count ? pack.col : pack.col.subarray(0, take * 3), nTot * 3);
        imGround.uvAttr.array.set(take === pack.count ? pack.uv : pack.uv.subarray(0, take * 4), nTot * 4);
        imGround.metaAttr.array.set(take === pack.count ? pack.meta : pack.meta.subarray(0, take * 4), nTot * 4);
        nTot += take;
        nGrass += pack.nGrass;
        nSasa += pack.nSasa;
      }
    }
    imGround.mesh.count = nTot;
    imGround.mesh.visible = nTot > 0;
    if (nTot > 0) {
      imGround.mesh.instanceMatrix.needsUpdate = true;
      imGround.mesh.instanceColor.needsUpdate = true;
      imGround.uvAttr.needsUpdate = true;
      imGround.metaAttr.needsUpdate = true;
    }
    stats.grass = nGrass;
    stats.sasa = nSasa;
  }

  function rebuildMidImpostors(centerMx, centerMz) {
    let nCloud = 0;
    for (let dmz = -MID_TILE_RADIUS; dmz <= MID_TILE_RADIUS; dmz++) {
      for (let dmx = -MID_TILE_RADIUS; dmx <= MID_TILE_RADIUS; dmx++) {
        const r2 = dmx * dmx + dmz * dmz;
        if (r2 < 1 || r2 > MID_TILE_RADIUS * MID_TILE_RADIUS + 4) continue;
        const pack = getOrBuildMidTile(centerMx + dmx, centerMz + dmz);
        if (pack.count === 0) continue;
        const take = Math.min(pack.count, CAP_MID_CLOUD - nCloud);
        if (take <= 0) break;
        imMidCloud.mesh.instanceMatrix.array.set(take === pack.count ? pack.mat : pack.mat.subarray(0, take * 16), nCloud * 16);
        imMidCloud.mesh.instanceColor.array.set(take === pack.count ? pack.col : pack.col.subarray(0, take * 3), nCloud * 3);
        imMidCloud.uvAttr.array.set(take === pack.count ? pack.uv : pack.uv.subarray(0, take * 4), nCloud * 4);
        imMidCloud.metaAttr.array.set(take === pack.count ? pack.meta : pack.meta.subarray(0, take * 4), nCloud * 4);
        nCloud += take;
      }
    }
    imMidCloud.mesh.count = nCloud;
    imMidCloud.mesh.visible = nCloud > 0;
    if (nCloud > 0) {
      imMidCloud.mesh.instanceMatrix.needsUpdate = true;
      imMidCloud.mesh.instanceColor.needsUpdate = true;
      imMidCloud.uvAttr.needsUpdate = true;
      imMidCloud.metaAttr.needsUpdate = true;
    }
    stats.midConifers = nCloud;
    stats.midPlushClouds = nCloud;
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
      return localColliders;
    }
    const cols = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tile = getOrBuildNearTile(ntx + dx, ntz + dz);
        for (let i = 0; i < tile.colliders.length; i++) cols.push(tile.colliders[i]);
      }
    }
    return cols;
  }

  function ensureCollidersAt(wx, wz) {
    return getCollidersNear(wx, wz);
  }

  function setSurfaceSuper(enabled, maxAniso = 8) {
    const aniso = enabled ? Math.min(16, maxAniso) : 4;
    [masterAtlas, barks.fluted, barks.birch, barks.pine, barks.bamboo].forEach((t) => {
      if (t) { t.anisotropy = aniso; t.needsUpdate = true; }
    });
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
    ensureCollidersAt,
    getCollidersNear,
    setSurfaceSuper,
    getLocalColliders,
    getStats,
    archetypes,
  };
}
