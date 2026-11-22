import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO Engine — Breakthrough 8 (TR-ECO):
 * Camera-Centered Deterministic Zero-GC Ecological Forest Streamer across 5km × 19km!
 *
 * Upgraded with:
 *   - True Linear-Space Physically Calibrated Japanese Botanical Albedos (zero pastel washout!)
 *   - Multi-Whorl Serrated Ancient Sugi Cedar, Feathery Subalpine Abies, & Smooth Multi-Lobe Buna Beech
 *   - Per-Pixel 3D World-Space Procedural Needle/Leaf Clump, Fluted Cedar Bark, & Granite Micro-Fissure Detail
 *   - Slope-Guarded Deeply Embedded Mossy Granite Boulders (ZERO floating rocks anywhere!)
 *   - 6,400+ Mid-Distance (170m..1,550m) Instanced 3D Treeline Impostors
 */

const NEAR_TILE_SIZE = 64.0;
const NEAR_TILE_RADIUS = 3;   // 7×7 tiles = ±224m full 3D forest around camera
const DETAIL_TILE_RADIUS = 1; // 3×3 tiles = ±96m ferns, mossy boulders & nurse logs
const MID_TILE_SIZE = 128.0;
const MID_TILE_RADIUS = 11;   // 23×23 tiles = ±1,472m 3D treeline silhouettes on ridges

function makeTileRng(tx, tz, salt) {
  let h = Math.imul(tx, 374761393) ^ Math.imul(tz, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  let s = (h ^ (h >>> 16)) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

function mergeGeometriesSimple(geos) {
  let totalVerts = 0;
  let totalIndices = 0;
  const normalized = geos.map((geom) => {
    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;
    const idx = geom.index;
    const vCount = pos.count;
    const iCount = idx ? idx.count : vCount;
    totalVerts += vCount;
    totalIndices += iCount;
    return { pos, norm, idx, vCount, iCount };
  });

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (let k = 0; k < normalized.length; k++) {
    const item = normalized[k];
    positions.set(item.pos.array, vOffset * 3);
    normals.set(item.norm.array, vOffset * 3);
    if (item.idx) {
      const src = item.idx.array;
      for (let i = 0; i < src.length; i++) {
        indices[iOffset + i] = src[i] + vOffset;
      }
    } else {
      for (let i = 0; i < item.vCount; i++) {
        indices[iOffset + i] = i + vOffset;
      }
    }
    vOffset += item.vCount;
    iOffset += item.iCount;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
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

// Convert non-indexed geometry to smooth indexed vertices so spheres/boulders look naturally organic (not flat faceted!)
function makeSmoothIndexedSphere(radius, detail) {
  const g = new THREE.SphereGeometry(radius, detail * 6, detail * 4);
  return g;
}

// ---- Procedural Authentic Japanese Botanical Geometries ----

function buildSugiTrunkGeo() {
  const main = new THREE.CylinderGeometry(0.008, 0.032, 0.88, 8, 3);
  main.translate(0, 0.44, 0);
  const root = new THREE.CylinderGeometry(0.030, 0.052, 0.14, 8, 1);
  root.translate(0, 0.05, 0);
  return mergeGeometriesSimple([main, root]);
}

function buildSugiFoliageGeo() {
  // 8 ragged, drooping, organically serrated Japanese Ancient Cedar bough whorls!
  const tiers = [
    { y: 0.28, r: 0.165, h: 0.16, ox:  0.010, oz: -0.008 },
    { y: 0.39, r: 0.155, h: 0.16, ox: -0.012, oz:  0.010 },
    { y: 0.50, r: 0.142, h: 0.16, ox:  0.008, oz:  0.012 },
    { y: 0.60, r: 0.128, h: 0.15, ox: -0.009, oz: -0.007 },
    { y: 0.70, r: 0.110, h: 0.15, ox:  0.006, oz: -0.010 },
    { y: 0.79, r: 0.090, h: 0.14, ox: -0.005, oz:  0.006 },
    { y: 0.88, r: 0.068, h: 0.13, ox:  0.004, oz:  0.003 },
    { y: 0.96, r: 0.042, h: 0.12, ox:  0.000, oz:  0.000 },
  ];
  const parts = tiers.map((t, idx) => {
    const c = new THREE.ConeGeometry(t.r, t.h, 11, 2);
    c.translate(t.ox, t.y, t.oz);
    const pos = c.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const rad = Math.hypot(px - t.ox, pz - t.oz);
      if (rad > 0.008) {
        const ang = Math.atan2(pz - t.oz, px - t.ox);
        // Multi-harmonic serrated bough fronds breaking up the cone silhouette!
        const frond = 1.0 + 0.24 * Math.sin(ang * 5.0 + idx * 1.9) + 0.14 * Math.cos(ang * 8.0 - idx * 2.3);
        const droop = -0.036 * Math.pow(rad / t.r, 1.35) + 0.012 * Math.sin(ang * 4.0 + idx);
        pos.setXYZ(i, t.ox + (px - t.ox) * frond, py + droop, t.oz + (pz - t.oz) * frond);
      }
    }
    c.computeVertexNormals();
    return c;
  });
  return mergeGeometriesSimple(parts);
}

function buildAbiesTrunkGeo() {
  const main = new THREE.CylinderGeometry(0.008, 0.028, 0.88, 7, 2);
  main.translate(0, 0.44, 0);
  return main;
}

function buildAbiesFoliageGeo() {
  // 6 feathery subalpine Shirabiso / Hinoki drooping whorls
  const tiers = [
    { y: 0.24, r: 0.165, h: 0.18 },
    { y: 0.39, r: 0.148, h: 0.18 },
    { y: 0.54, r: 0.128, h: 0.17 },
    { y: 0.68, r: 0.104, h: 0.16 },
    { y: 0.81, r: 0.076, h: 0.15 },
    { y: 0.93, r: 0.044, h: 0.15 },
  ];
  const parts = tiers.map((t, idx) => {
    const c = new THREE.ConeGeometry(t.r, t.h, 10, 2);
    c.translate(0, t.y, 0);
    const pos = c.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const rad = Math.hypot(px, pz);
      if (rad > 0.008) {
        const ang = Math.atan2(pz, px);
        const f = 1.0 + 0.22 * Math.sin(ang * 6.0 + idx * 2.1);
        const dr = -0.028 * (rad / t.r);
        pos.setXYZ(i, px * f, py + dr, pz * f);
      }
    }
    c.computeVertexNormals();
    return c;
  });
  return mergeGeometriesSimple(parts);
}

function buildBunaTrunkGeo() {
  const stem = new THREE.CylinderGeometry(0.022, 0.042, 0.48, 8, 2);
  stem.translate(0, 0.24, 0);
  const b1 = new THREE.CylinderGeometry(0.009, 0.020, 0.36, 6, 1);
  b1.rotateZ(0.42);
  b1.translate(-0.07, 0.56, 0.03);
  const b2 = new THREE.CylinderGeometry(0.009, 0.020, 0.38, 6, 1);
  b2.rotateZ(-0.38);
  b2.rotateX(0.24);
  b2.translate(0.07, 0.57, 0.05);
  const b3 = new THREE.CylinderGeometry(0.008, 0.018, 0.34, 6, 1);
  b3.rotateX(-0.44);
  b3.translate(0.01, 0.55, -0.07);
  return mergeGeometriesSimple([stem, b1, b2, b3]);
}

function buildBunaFoliageGeo() {
  // Smooth organic 6-lobe Japanese Beech leafy canopy (smooth normals -> ZERO polygonal crystal facets!)
  const lobes = [
    { x:  0.00, y: 0.81, z:  0.00, rx: 0.24, ry: 0.16, rz: 0.23 },
    { x: -0.17, y: 0.69, z:  0.07, rx: 0.20, ry: 0.14, rz: 0.19 },
    { x:  0.18, y: 0.71, z:  0.09, rx: 0.21, ry: 0.14, rz: 0.18 },
    { x:  0.04, y: 0.68, z: -0.17, rx: 0.20, ry: 0.14, rz: 0.20 },
    { x: -0.11, y: 0.76, z: -0.12, rx: 0.18, ry: 0.13, rz: 0.17 },
    { x:  0.10, y: 0.78, z: -0.06, rx: 0.16, ry: 0.12, rz: 0.16 },
  ];
  const parts = lobes.map((lb, idx) => {
    const s = makeSmoothIndexedSphere(1.0, 2);
    s.scale(lb.rx, lb.ry, lb.rz);
    s.translate(lb.x, lb.y, lb.z);
    perturbGeometry(s, 0.024, 0.45, 73 + idx * 13);
    return s;
  });
  return mergeGeometriesSimple(parts);
}

function buildMidConiferImpostorGeo() {
  const low = new THREE.ConeGeometry(0.20, 0.52, 6, 1);
  low.translate(0, 0.40, 0);
  const top = new THREE.ConeGeometry(0.13, 0.52, 6, 1);
  top.translate(0, 0.74, 0);
  return mergeGeometriesSimple([low, top]);
}

function buildMidBroadleafImpostorGeo() {
  const dome = makeSmoothIndexedSphere(0.30, 1);
  dome.scale(1.18, 0.78, 1.12);
  dome.translate(0, 0.68, 0);
  return dome;
}

function buildFernGeo() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2.0 + (i % 2) * 0.22;
    const frond = new THREE.PlaneGeometry(0.28, 1.0, 1, 3);
    const pos = frond.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const px = pos.getX(v);
      const py = pos.getY(v) + 0.5;
      const t = py;
      const taper = Math.sin(Math.pow(t, 0.75) * Math.PI);
      const archY = Math.sin(t * Math.PI * 0.68) * 0.68;
      const archZ = t * 0.92;
      pos.setXYZ(v, px * taper, archY, archZ);
    }
    frond.rotateY(ang);
    frond.computeVertexNormals();
    parts.push(frond);
  }
  return mergeGeometriesSimple(parts);
}

function buildBoulderGeo() {
  // Smooth organic sculpted granite boulder (NO low-poly gem facets!)
  const rock = makeSmoothIndexedSphere(1.0, 2);
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

// ---- Photorealistic Per-Pixel Botanical/Bark/Granite Ecological ShaderMaterial ----

function createTerrenoEcoMaterial(geomorph, atmoUniforms, opts) {
  const {
    isFoliage = false,
    isMidImpostor = false,
    isRock = false,
    swayAmp = 0.0,
    doubleSide = false,
    baseColor = [1, 1, 1],
  } = opts;

  const vert = /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform float uSwayAmp;
    uniform float uIsMidImpostor;

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    varying vec3 vColor;
    varying float vLocalY;
    varying float vCamDist;

    void main() {
      vec3 localPos = position;
      vec3 localNormal = normal;
      vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);

      if (uSwayAmp > 0.0001) {
        float hFactor = clamp(localPos.y, 0.0, 1.2);
        float phase = instOrigin.x * 0.13 + instOrigin.z * 0.17 + uTime * 1.45;
        float gust = sin(phase) * 0.65 + sin(phase * 2.3 + 1.4) * 0.35;
        localPos.x += gust * uSwayAmp * hFactor * hFactor;
        localPos.z += cos(phase * 0.82) * uSwayAmp * 0.65 * hFactor * hFactor;
      }

      vec4 wp = modelMatrix * instanceMatrix * vec4(localPos, 1.0);
      float camDist = length(wp.xyz - cameraPosition);
      if (uIsMidImpostor > 0.5) {
        float fadeIn = smoothstep(155.0, 220.0, camDist);
        float fadeOut = 1.0 - smoothstep(1150.0, 1520.0, camDist);
        float s = fadeIn * fadeOut;
        wp.xyz = mix(instOrigin, wp.xyz, s);
      }

      vWorldPos = wp.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * localNormal);
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = vec3(1.0);
      #endif
      vLocalY = localPos.y;
      vCamDist = camDist;

      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const frag = /* glsl */ `
    precision highp float;

    uniform sampler2D uHorizonMap;
    uniform vec2 uWorldMin;
    uniform vec2 uWorldSize;
    uniform vec2 uAtlasSize;
    uniform vec3 uBaseTint;
    uniform float uIsFoliage;
    uniform float uIsRock;
    uniform float uIsMidImpostor;

    ${TERRENO_ATMO_UNIFORMS_GLSL}

    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
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
      if (uIsMidImpostor > 0.5 && (vCamDist < 155.0 || vCamDist > 1520.0)) {
        discard;
      }

      vec3 N = normalize(vWorldNormal);
      if (!gl_FrontFacing) N = -N;
      vec3 sunDir = normalize(uSunDir);
      vec3 V = normalize(cameraPosition - vWorldPos);

      vec2 horizonUV = (((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize;
      vec4 horz = texture2D(uHorizonMap, clamp(horizonUV, 0.0005, 0.9995));
      float horizonSin = mix(horz.g, horz.r, uUseEastHorizon);
      float horizonShadow = mix(1.0, smoothstep(horizonSin - 0.045, horizonSin + 0.095, sunDir.y), uHorizonShadowBlend);
      float skyViewAO = horz.b;

      vec3 albedo = uBaseTint * vColor;
      float detailFade = 1.0 - smoothstep(45.0, 210.0, vCamDist);

      if (uIsFoliage > 0.5) {
        // Per-pixel 3D needle-spray & leaf-cluster procedural texture + internal shadow cavities!
        float f1 = eNoise3(vWorldPos * 1.45);
        float f2 = eNoise3(vWorldPos * 4.80 + vec3(7.3, -3.1, 4.9));
        float clump = f1 * 0.62 + f2 * 0.38;
        float crownAO = mix(0.32, 1.18, clamp(vLocalY, 0.0, 1.0));
        float cavity = mix(0.45, 1.32, smoothstep(0.20, 0.84, clump));
        albedo *= crownAO * mix(1.0, cavity, 0.55 + 0.45 * detailFade);

        // Micro-normal leaf spray perturbation (eliminates plastic flat-shaded cone look!)
        if (detailFade > 0.01 && uIsMidImpostor < 0.5) {
          vec3 g = vec3(
            eNoise3(vWorldPos * 3.6 + vec3(0.25, 0.0, 0.0)) - f2,
            eNoise3(vWorldPos * 3.6 + vec3(0.0, 0.25, 0.0)) - f2,
            eNoise3(vWorldPos * 3.6 + vec3(0.0, 0.0, 0.25)) - f2
          );
          N = normalize(N + g * (0.95 * detailFade));
        }
      } else if (uIsRock > 0.5) {
        // Crisp granite grain + fissure cracks + deep velvety Japanese moss blanket on top!
        float r1 = eNoise3(vWorldPos * 2.4);
        float r2 = eNoise3(vWorldPos * 8.5);
        float crack = smoothstep(0.28, 0.65, abs(r1 - 0.5) * 2.0);
        float rockShade = (0.58 + 0.48 * r2) * (0.62 + 0.38 * crack);
        float mossTop = smoothstep(0.36, 0.78, N.y + (r1 - 0.5) * 0.28);
        vec3 mossCol = vec3(0.016, 0.048, 0.015) * (0.72 + 0.56 * r2);
        albedo = mix(albedo * rockShade, mossCol, mossTop * 0.80);
        if (detailFade > 0.01) {
          vec3 rg = vec3(
            eNoise3(vWorldPos * 5.0 + vec3(0.18, 0.0, 0.0)) - r2,
            0.0,
            eNoise3(vWorldPos * 5.0 + vec3(0.0, 0.0, 0.18)) - r2
          );
          N = normalize(N + rg * (0.85 * detailFade));
        }
      } else {
        // Vertical fluted Japanese cedar/beech bark grooves + mossy trunk base!
        float barkGrain = eNoise3(vec3(vWorldPos.x * 9.5, vWorldPos.y * 1.4, vWorldPos.z * 9.5));
        float barkFine = eNoise3(vec3(vWorldPos.x * 24.0, vWorldPos.y * 4.0, vWorldPos.z * 24.0));
        float barkAO = mix(0.45, 1.05, clamp(vLocalY * 1.6, 0.0, 1.0));
        albedo *= barkAO * (0.55 + 0.55 * barkGrain + 0.22 * barkFine);
        // Damp forest moss creeping up the lower 20% of trunks
        float trunkMoss = (1.0 - smoothstep(0.02, 0.22, vLocalY)) * smoothstep(0.38, 0.72, barkGrain);
        albedo = mix(albedo, vec3(0.015, 0.044, 0.015), trunkMoss * 0.72);
      }

      float wrap = uIsFoliage > 0.5 ? 0.32 : 0.06;
      float ndl = max(0.0, (dot(N, sunDir) + wrap) / (1.0 + wrap));
      vec3 direct = uSunColor * (uSunIntensity * ndl * horizonShadow * 0.90);

      // Subsurface sunlight translucency glowing through mountain leaves & needles!
      if (uIsFoliage > 0.5) {
        float backLight = pow(max(0.0, dot(-V, sunDir)), 3.2) * (0.30 + 0.70 * clamp(vLocalY, 0.0, 1.0));
        direct += uSunColor * vec3(0.55, 0.85, 0.28) * (backLight * uSunIntensity * horizonShadow * 0.28);
      }

      float hemiT = N.y * 0.5 + 0.5;
      vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, hemiT) * (uHemiIntensity * (0.42 + 0.58 * skyViewAO) * 0.95);

      float dComp = length(vWorldPos.xz - vec2(1.5, 3.5));
      float compWarm = exp(-dComp * 0.065) * (1.0 - smoothstep(0.35, 0.75, uHemiIntensity)) * 0.20;

      vec3 lit = albedo * (direct + ambient + vec3(1.0, 0.74, 0.44) * compWarm);

      if (uIsRock > 0.5) {
        vec3 H = normalize(sunDir + V);
        float spec = pow(max(0.0, dot(N, H)), 32.0) * 0.14 * horizonShadow;
        lit += uSunColor * (spec * uSunIntensity * 0.45);
      }

      lit += evalTerrenoFlashlight(vWorldPos, N, albedo);

      // Exact Shared TERRENO Exponential Height Fog (雲海) + Rayleigh/Mie Aerial Perspective!
      vec3 finalCol = applyTerrenoAtmosphere(lit, vWorldPos, cameraPosition);

      gl_FragColor = vec4(finalCol, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmoUniforms,
      uHorizonMap: { value: geomorph.horizonTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
      uBaseTint: { value: new THREE.Color(baseColor[0], baseColor[1], baseColor[2]) },
      uSwayAmp: { value: swayAmp },
      uIsFoliage: { value: isFoliage ? 1.0 : 0.0 },
      uIsRock: { value: isRock ? 1.0 : 0.0 },
      uIsMidImpostor: { value: isMidImpostor ? 1.0 : 0.0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
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

export function createTerrenoForest(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_EcologicalForest_Streamer';

  const CAP_SUGI = 2200;
  const CAP_ABIES = 1600;
  const CAP_BUNA = 1500;
  const CAP_FERN = 2000;
  const CAP_BOULDER = 650;
  const CAP_LOG = 220;
  const CAP_MID_CONIFER = 4200;
  const CAP_MID_BROAD = 2600;

  // Physically calibrated Linear base tints (dark wet cedar bark, pale silver beech, slate granite!)
  const matBarkSugi = createTerrenoEcoMaterial(geomorph, atmoUniforms, { baseColor: [0.075, 0.046, 0.030], swayAmp: 0.004 });
  const matBarkBuna = createTerrenoEcoMaterial(geomorph, atmoUniforms, { baseColor: [0.22, 0.215, 0.195], swayAmp: 0.004 });
  const matFoliage = createTerrenoEcoMaterial(geomorph, atmoUniforms, { isFoliage: true, swayAmp: 0.016 });
  const matFern = createTerrenoEcoMaterial(geomorph, atmoUniforms, { isFoliage: true, swayAmp: 0.085, doubleSide: true });
  const matBoulder = createTerrenoEcoMaterial(geomorph, atmoUniforms, { isRock: true, baseColor: [0.105, 0.112, 0.118] });
  const matLog = createTerrenoEcoMaterial(geomorph, atmoUniforms, { isRock: true, baseColor: [0.068, 0.044, 0.028] });
  const matMidImpostor = createTerrenoEcoMaterial(geomorph, atmoUniforms, { isFoliage: true, isMidImpostor: true, swayAmp: 0.0 });

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
  const imSugiLeaf = makeInstanced(buildSugiFoliageGeo(), matFoliage, CAP_SUGI, 'ECO_Sugi_Foliage');
  const imAbiesTrunk = makeInstanced(buildAbiesTrunkGeo(), matBarkSugi, CAP_ABIES, 'ECO_Abies_Trunks');
  const imAbiesLeaf = makeInstanced(buildAbiesFoliageGeo(), matFoliage, CAP_ABIES, 'ECO_Abies_Foliage');
  const imBunaTrunk = makeInstanced(buildBunaTrunkGeo(), matBarkBuna, CAP_BUNA, 'ECO_Buna_Trunks');
  const imBunaLeaf = makeInstanced(buildBunaFoliageGeo(), matFoliage, CAP_BUNA, 'ECO_Buna_Foliage');
  const imFern = makeInstanced(buildFernGeo(), matFern, CAP_FERN, 'ECO_Mountain_Ferns');
  const imBoulder = makeInstanced(buildBoulderGeo(), matBoulder, CAP_BOULDER, 'ECO_Mossy_Boulders');
  const imLog = makeInstanced(buildNurseLogGeo(), matLog, CAP_LOG, 'ECO_Nurse_Logs');
  const imMidConifer = makeInstanced(buildMidConiferImpostorGeo(), matMidImpostor, CAP_MID_CONIFER, 'ECO_Mid_Conifers');
  const imMidBroad = makeInstanced(buildMidBroadleafImpostorGeo(), matMidImpostor, CAP_MID_BROAD, 'ECO_Mid_Broadleaf');

  const dummyObj = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  let lastNearTx = 999999, lastNearTz = 999999;
  let lastMidTx = 999999, lastMidTz = 999999;
  let localColliders = [];
  let stats = { sugi: 0, abies: 0, buna: 0, ferns: 0, boulders: 0, logs: 0, midConifers: 0, midBroad: 0 };

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

        // --- 1. Trees (48 stems per 64m×64m tile) ---
        for (let c = 0; c < 48; c++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (wx < TERRENO_WORLD.minX + 12 || wx > TERRENO_WORLD.maxX - 12 || wz < TERRENO_WORLD.minZ + 12 || wz > TERRENO_WORLD.maxZ - 12) continue;

          if (isInsideCompoundClearing(wx, wz, 1.0)) continue;

          // Keep widened 19km Forestry Road 100% unobstructed for CAMPER-75 & KEI-340!
          const rq = geomorph.roadIndex.queryDist(wx, wz);
          if (rq.dist < 8.0) continue;

          // Keep wide 19km River Channel & scenic gravel bank clear of tall tree trunks
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth + 5.5) continue;

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          const y = geomorph.getHeightAt(wx, wz);
          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1420.0) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 2.2);
          if (nrm.slope > 0.78) continue;

          if (asl > 1270.0 && rng() < (asl - 1270.0) / 155.0) continue;

          // Keep scenic South vista corridor open for 6F Sky Terrace (understory trees only right at Z=+10..44)
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
          const leanX = (rng() - 0.5) * 0.05;
          const leanZ = (rng() - 0.5) * 0.05;
          let altScale = asl > 1220.0 ? Math.max(0.45, 1.0 - (asl - 1220.0) / 340.0) : 1.0;
          if (in6fVistaCorridor) altScale *= 0.42; // Keep treetops right below 6F Sky Terrace rail!

          if (species === 0 && nSugi < CAP_SUGI) {
            const h = (18.0 + rng() * 16.5) * altScale;
            const rS = h * (0.90 + rng() * 0.24);
            dummyObj.position.set(wx, y - 0.45, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imSugiTrunk.setMatrixAt(nSugi, dummyObj.matrix);
            imSugiLeaf.setMatrixAt(nSugi, dummyObj.matrix);
            const gVar = rng();
            // Deep authentic Japanese Sugi Cedar linear reflectance!
            tmpColor.setRGB(0.011 + gVar * 0.014, 0.036 + gVar * 0.028, 0.015 + gVar * 0.012);
            imSugiLeaf.setColorAt(nSugi, tmpColor);
            tmpColor.setRGB(0.85 + gVar * 0.25, 0.80 + gVar * 0.20, 0.75 + gVar * 0.20);
            imSugiTrunk.setColorAt(nSugi, tmpColor);
            nSugi++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.42, h * 0.028) });
          } else if (species === 1 && nAbies < CAP_ABIES) {
            const h = (13.0 + rng() * 13.0) * altScale;
            const rS = h * (0.86 + rng() * 0.24);
            dummyObj.position.set(wx, y - 0.40, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imAbiesTrunk.setMatrixAt(nAbies, dummyObj.matrix);
            imAbiesLeaf.setMatrixAt(nAbies, dummyObj.matrix);
            const gVar = rng();
            tmpColor.setRGB(0.012 + gVar * 0.014, 0.042 + gVar * 0.030, 0.024 + gVar * 0.016);
            imAbiesLeaf.setColorAt(nAbies, tmpColor);
            tmpColor.setRGB(0.82 + gVar * 0.25, 0.82 + gVar * 0.20, 0.80 + gVar * 0.20);
            imAbiesTrunk.setColorAt(nAbies, tmpColor);
            nAbies++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.38, h * 0.026) });
          } else if (species === 2 && nBuna < CAP_BUNA) {
            const h = (13.5 + rng() * 11.0) * altScale;
            const rS = h * (0.94 + rng() * 0.30);
            dummyObj.position.set(wx, y - 0.40, wz);
            dummyObj.rotation.set(leanX, yaw, leanZ);
            dummyObj.scale.set(rS, h, rS);
            dummyObj.updateMatrix();
            imBunaTrunk.setMatrixAt(nBuna, dummyObj.matrix);
            imBunaLeaf.setMatrixAt(nBuna, dummyObj.matrix);
            const tint = rng();
            if (tint < 0.68) {
              tmpColor.setRGB(0.028 + tint * 0.032, 0.064 + tint * 0.042, 0.014 + tint * 0.010);
            } else if (tint < 0.90) {
              tmpColor.setRGB(0.058 + (tint - 0.68) * 0.095, 0.088 + (tint - 0.68) * 0.045, 0.015);
            } else {
              tmpColor.setRGB(0.115, 0.062, 0.014); // Warm autumn-gold Japanese beech accent!
            }
            imBunaLeaf.setColorAt(nBuna, tmpColor);
            tmpColor.setRGB(0.88 + tint * 0.18, 0.88 + tint * 0.18, 0.84 + tint * 0.16);
            imBunaTrunk.setColorAt(nBuna, tmpColor);
            nBuna++;
            if (isDetailTile) newColliders.push({ x: wx, z: wz, r: Math.max(0.45, h * 0.032) });
          }
        }

        if (!isDetailTile) continue;

        // 2a. Swaying Japanese Mountain Ferns & Kumazasa Bamboo
        for (let f = 0; f < 130 && nFern < CAP_FERN; f++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, -1.5)) continue;
          if (geomorph.roadIndex.queryDist(wx, wz).dist < 5.0) continue;
          const rv = evalMainRiver(wz);
          if (Math.abs(wx - rv.x) < rv.halfWidth + 1.2) continue;

          const y = geomorph.getHeightAt(wx, wz);
          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1420.0) continue;
          const nrm = geomorph.getNormalAt(wx, wz, 1.5);
          if (nrm.slope > 0.68) continue;

          const sc = 0.72 + rng() * 1.15;
          dummyObj.position.set(wx, y - 0.06, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
          dummyObj.scale.set(sc, sc * (0.75 + rng() * 0.45), sc);
          dummyObj.updateMatrix();
          imFern.setMatrixAt(nFern, dummyObj.matrix);
          const fv = rng();
          if (asl > 1050.0) {
            tmpColor.setRGB(0.036 + fv * 0.028, 0.082 + fv * 0.042, 0.016 + fv * 0.010);
          } else {
            tmpColor.setRGB(0.018 + fv * 0.018, 0.056 + fv * 0.038, 0.014 + fv * 0.010);
          }
          imFern.setColorAt(nFern, tmpColor);
          nFern++;
        }

        // 2b. Deeply Embedded Mossy Granite Boulders (STRICT slope < 0.52 -> ZERO floating boulders!)
        for (let b = 0; b < 42 && nBoulder < CAP_BOULDER; b++) {
          const wx = tileX0 + rng() * NEAR_TILE_SIZE;
          const wz = tileZ0 + rng() * NEAR_TILE_SIZE;
          if (isInsideCompoundClearing(wx, wz, 1.5)) continue;
          if (geomorph.roadIndex.queryDist(wx, wz).dist < 7.8) continue;

          const nrm = geomorph.getNormalAt(wx, wz, 2.2);
          if (nrm.slope > 0.52) continue; // NEVER place boulders on steep cliffs where they could jut out!

          const geo = geomorph.sampleGeoBilinear(wx, wz);
          const rv = evalMainRiver(wz);
          const distRiv = Math.abs(wx - rv.x);
          const nearRiver = distRiv > rv.halfWidth * 0.78 && distRiv < rv.halfWidth + 16.0;
          if (!nearRiver && geo.wetness < 0.36 && rng() > 0.24) continue;

          const y = geomorph.getHeightAt(wx, wz);
          const rScale = nearRiver ? (1.05 + rng() * 2.15) : (0.70 + rng() * 1.45);
          // Embed 44% deep into terrain so base is ALWAYS 100% grounded!
          dummyObj.position.set(wx, y - rScale * 0.44, wz);
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
          if (Math.abs(wx - rv.x) < rv.halfWidth + 6.0) continue;
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
          if (Math.abs(wx - rv.x) < rv.halfWidth + 5.0) continue;

          const y = geo.hMacro;
          const asl = TERRENO_WORLD.baseElevationASL + y;
          if (asl > 1420.0) continue;
          const nrm = geomorph.getNormalAt(wx, wz, 4.0);
          if (nrm.slope > 0.82) continue;

          const isBroad = asl > 770.0 && asl < 1210.0 && rng() < 0.55;
          const h = (22.0 + rng() * 18.0) * (asl > 1250.0 ? 0.72 : 1.0);
          const wS = h * (1.10 + rng() * 0.42);
          dummyObj.position.set(wx, y - 1.8, wz);
          dummyObj.rotation.set(0, rng() * Math.PI * 2, 0);
          dummyObj.scale.set(wS, h, wS);
          dummyObj.updateMatrix();

          const v = rng();
          if (isBroad && nBrd < CAP_MID_BROAD) {
            imMidBroad.setMatrixAt(nBrd, dummyObj.matrix);
            if (v < 0.78) tmpColor.setRGB(0.026 + v * 0.032, 0.058 + v * 0.038, 0.014 + v * 0.008);
            else tmpColor.setRGB(0.095, 0.064, 0.015);
            imMidBroad.setColorAt(nBrd, tmpColor);
            nBrd++;
          } else if (nCon < CAP_MID_CONIFER) {
            imMidConifer.setMatrixAt(nCon, dummyObj.matrix);
            tmpColor.setRGB(0.010 + v * 0.012, 0.032 + v * 0.024, 0.016 + v * 0.012);
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
