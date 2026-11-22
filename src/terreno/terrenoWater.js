import * as THREE from 'three';
import {
  TERRENO_WORLD,
  TRIBUTARIES,
  evalMainRiver,
} from './terrenoConfig.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO Engine — Breakthrough 7 (TR-HYDRO):
 * Slope-Conforming 19 km Main Gorge River (黒杉川) + 6 Cascading Tributary Mountain Streams (支流沢).
 * Features:
 *   - Vertex-baked true water depth & local longitudinal slope from the geomorphology solver
 *   - Downhill advected dual-phase capillary & turbulent flow normals
 *   - Beer-Lambert Japanese emerald/jade clear-water depth absorption
 *   - Slope- & shoreline-driven aerated whitewater rapids foam
 *   - Schlick Fresnel atmospheric sky reflection, crisp solar/lunar specular glint & flashlight bounce
 *   - Exact shared TERRENO Exponential Height Fog (雲海) + Rayleigh/Mie Aerial Perspective
 */

const WATER_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec4 aWaterMeta; // x: flowDist(m), y: crossT(-1..+1), z: depth(m), w: slope

uniform float uTime;

varying vec3 vWorldPos;
varying vec4 vWaterMeta;
varying vec3 vFlowTangent;

void main() {
  vec3 pos = position;
  // Subtle physical surface wave heave on rapids (stronger in deeper/faster mid-channel)
  float midFactor = 1.0 - abs(aWaterMeta.y);
  float heave = sin(aWaterMeta.x * 0.42 - uTime * 3.8) * 0.055
              + cos(aWaterMeta.x * 0.95 + aWaterMeta.y * 5.2 - uTime * 5.1) * 0.025;
  pos.y += heave * midFactor * clamp(aWaterMeta.z * 0.5, 0.0, 1.0);

  vWorldPos = pos;
  vWaterMeta = aWaterMeta;
  vFlowTangent = normalize(normal); // normal attribute stores unit downhill flow direction!
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec4 vWaterMeta;
varying vec3 vFlowTangent;

float wHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
    mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float wFbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 m = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * wNoise(p);
    p = m * p * 2.05 + vec2(13.7, 29.1);
    a *= 0.48;
  }
  return v;
}

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  float flowDist = vWaterMeta.x;
  float crossT = vWaterMeta.y;
  float depth = max(0.0, vWaterMeta.z);
  float localSlope = vWaterMeta.w;

  // Discard dry outer skirt gently so shoreline merges organically into wet mossy riverbanks!
  float shoreAlpha = smoothstep(0.01, 0.34, depth) * (1.0 - smoothstep(0.84, 1.0, abs(crossT)));
  if (shoreAlpha <= 0.01) discard;

  // Build local river surface frame (T = downhill flow, B = cross-channel)
  vec3 T = normalize(vec3(vFlowTangent.x, 0.0, vFlowTangent.z));
  vec3 B = normalize(vec3(-T.z, 0.0, T.x));

  // Dual-phase downhill advected ripples (faster in steep riffles & cascades!)
  float flowSpeed = 2.6 + clamp(localSlope * 28.0, 0.0, 6.5);
  vec2 uv1 = vec2(crossT * 5.5, flowDist * 0.24 - uTime * flowSpeed * 0.42);
  vec2 uv2 = vec2(crossT * 11.0 + 4.3, flowDist * 0.58 - uTime * flowSpeed * 0.68);
  float r1 = wFbm(uv1);
  float r2 = wFbm(uv2);

  // Finite-difference ripple slope for crisp dynamic water normal!
  float eps = 0.14;
  float rx = (wFbm(uv1 + vec2(eps, 0.0)) - r1) * 1.15 + (wFbm(uv2 + vec2(eps, 0.0)) - r2) * 0.75;
  float rz = (wFbm(uv1 + vec2(0.0, eps)) - r1) * 1.15 + (wFbm(uv2 + vec2(0.0, eps)) - r2) * 0.75;
  float rippleStrength = 0.32 + clamp(localSlope * 3.8, 0.0, 0.45);
  vec3 N = normalize(vec3(0.0, 1.0, 0.0) + B * (rx * rippleStrength) + T * (rz * rippleStrength));

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 sunDir = normalize(uSunDir);

  // 1. Beer-Lambert Clear Japanese Mountain River Emerald/Jade Absorption (Linear PBR!)
  vec3 shallowJade = vec3(0.032, 0.145, 0.135);
  vec3 deepEmerald = vec3(0.007, 0.042, 0.048);
  float depthT = 1.0 - exp(-depth * 0.72);
  vec3 waterBody = mix(shallowJade, deepEmerald, depthT);

  // Light water body by sun + hemisphere sky ambient
  float ndl = max(0.0, dot(N, sunDir));
  vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, 0.72) * (uHemiIntensity * 0.95);
  vec3 litBody = waterBody * (uSunColor * (uSunIntensity * (0.28 + 0.58 * ndl)) + ambient);

  // 2. Schlick Fresnel Sky & Mountain Horizon Reflection
  float cosV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.03 + 0.97 * pow(1.0 - cosV, 4.2);
  vec3 R = reflect(-V, N);
  float skyElev = clamp(R.y, 0.0, 1.0);
  vec3 reflCol = mix(uSkyHorizon, uSkyZenith, pow(skyElev, 0.72)) * 0.68;
  reflCol = mix(reflCol, vec3(0.014, 0.032, 0.022) * (0.6 + uHemiIntensity), (1.0 - skyElev) * 0.42);

  vec3 col = mix(litBody, reflCol, clamp(fresnel * 0.80, 0.06, 0.86));

  // 3. Crisp Solar / Lunar Specular Sparkle across flowing ripples!
  vec3 H = normalize(sunDir + V);
  float specTight = pow(max(0.0, dot(N, H)), 140.0) * 1.9;
  float specBroad = pow(max(0.0, dot(N, H)), 24.0) * 0.20;
  col += uSunColor * (uSunIntensity * (specTight + specBroad));

  // 4. Slope- & Bank-Driven Aerated Whitewater Rapids Foam (急流白波!)
  float foamNoise = wFbm(vec2(crossT * 7.5, flowDist * 0.35 - uTime * flowSpeed * 0.52));
  float shoreFoam = smoothstep(0.72, 0.06, depth) * smoothstep(0.35, 0.70, foamNoise);
  float rapidFoam = smoothstep(0.010, 0.065, localSlope) * smoothstep(0.34, 0.70, foamNoise * 0.7 + r2 * 0.3);
  float foamMask = clamp(max(shoreFoam * 0.76, rapidFoam * 0.92), 0.0, 0.92);
  vec3 foamCol = (uSunColor * (uSunIntensity * (0.34 + 0.42 * ndl)) + uHemiSkyColor * (uHemiIntensity * 0.82)) * vec3(0.56, 0.62, 0.65);
  col = mix(col, foamCol, foamMask);

  // Flashlight glint on night rapids
  col += evalTerrenoFlashlight(vWorldPos, N, mix(waterBody * 1.4, vec3(0.85, 0.9, 0.92), foamMask));

  // 5. Exact Shared TERRENO Exponential Height Fog (雲海) + Rayleigh/Mie Aerial Perspective!
  col = applyTerrenoAtmosphere(col, vWorldPos, cameraPosition);

  float finalAlpha = clamp(max(shoreAlpha * (0.66 + 0.32 * depthT + fresnel * 0.25), foamMask * 0.92), 0.0, 0.96);
  gl_FragColor = vec4(col, finalAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildMainRiverGeometry(geomorph) {
  const segsZ = 380;
  const segsX = 6;
  const zMin = TERRENO_WORLD.minZ + 20;
  const zMax = TERRENO_WORLD.maxZ - 20;
  const dz = (zMax - zMin) / segsZ;

  const positions = [];
  const normals = []; // store downhill unit flow tangent!
  const metas = [];
  const indices = [];

  // Precompute centerline samples
  const centerPts = [];
  let accumDist = 0.0;
  for (let i = 0; i <= segsZ; i++) {
    const z = zMin + i * dz;
    const rv = evalMainRiver(z);
    if (i > 0) {
      const prev = centerPts[i - 1];
      accumDist += Math.hypot(rv.x - prev.x, z - prev.z);
    }
    centerPts.push({ x: rv.x, z, waterY: rv.waterY, halfWidth: rv.halfWidth, flowDist: accumDist });
  }

  for (let i = 0; i <= segsZ; i++) {
    const p = centerPts[i];
    const pPrev = centerPts[Math.max(0, i - 1)];
    const pNext = centerPts[Math.min(segsZ, i + 1)];
    const tx = pNext.x - pPrev.x;
    const tz = pNext.z - pPrev.z;
    const tLen = Math.hypot(tx, tz) || 1.0;
    const ftx = tx / tLen;
    const ftz = tz / tLen;
    // Cross-river perpendicular (right bank)
    const bx = -ftz;
    const bz = ftx;
    // Longitudinal downhill slope
    const slope = Math.max(0.004, (pPrev.waterY - pNext.waterY) / Math.max(1.0, pNext.flowDist - pPrev.flowDist));

    // Slightly wider than open channel (1.38x) so edges tuck cleanly into sculpted banks!
    const ribbonHW = p.halfWidth * 1.38;
    for (let j = 0; j <= segsX; j++) {
      const crossT = (j / segsX) * 2.0 - 1.0; // -1 .. +1
      const wx = p.x + bx * crossT * ribbonHW;
      const wz = p.z + bz * crossT * ribbonHW;
      const bedY = geomorph.getHeightAt(wx, wz);
      // Keep water slightly above lowest center bed even where erosion tweaked micro-relief
      const centerBed = geomorph.getHeightAt(p.x, p.z);
      const safeWaterY = Math.max(p.waterY, centerBed + 1.15);
      const depth = Math.max(0.0, safeWaterY - bedY);

      positions.push(wx, safeWaterY, wz);
      normals.push(ftx, 0.0, ftz);
      metas.push(p.flowDist, crossT, depth, slope);
    }
  }

  const rowStride = segsX + 1;
  for (let i = 0; i < segsZ; i++) {
    for (let j = 0; j < segsX; j++) {
      const a = i * rowStride + j;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('aWaterMeta', new THREE.Float32BufferAttribute(metas, 4));
  geo.setIndex(indices);
  return geo;
}

function buildTributaryGeometry(geomorph, tr, ti) {
  const segs = 46;
  const segsX = 4;
  const rv0 = evalMainRiver(tr.z0);
  const startLen = tr.len * 0.72; // Start high in the moist upper ravine where mountain stream emerges

  const pts = [];
  let accumDist = 0.0;
  for (let i = 0; i <= segs; i++) {
    // March DOWNHILL from headwater (u=1) to main river junction (u=0)
    const u = 1.0 - i / segs;
    const along = u * startLen;
    const meander = Math.sin(along * 0.0045 + ti * 2.1) * 52.0 + Math.cos(along * 0.011) * 18.0;
    const perpX = -tr.dirZ;
    const perpZ = tr.dirX;
    const wx = rv0.x + tr.dirX * along + perpX * meander;
    const wz = tr.z0 + tr.dirZ * along + perpZ * meander;
    const terrainY = geomorph.getHeightAt(wx, wz);
    if (i > 0) {
      accumDist += Math.hypot(wx - pts[i - 1].x, wz - pts[i - 1].z);
    }
    const hw = Math.max(4.5, tr.width * 0.22 * (1.2 - 0.65 * u));
    pts.push({ x: wx, z: wz, y: terrainY + 0.68, hw, flowDist: accumDist });
  }
  // Enforce smooth monotonic downhill profile for tributary cascades
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y > pts[i - 1].y - 0.1) {
      pts[i].y = pts[i - 1].y - 0.1;
    }
  }
  // Smoothly join main river elevation at mouth
  pts[pts.length - 1].y = rv0.waterY - 0.15;

  const positions = [];
  const normals = [];
  const metas = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const p = pts[i];
    const pPrev = pts[Math.max(0, i - 1)];
    const pNext = pts[Math.min(segs, i + 1)];
    const tx = pNext.x - pPrev.x;
    const tz = pNext.z - pPrev.z;
    const tLen = Math.hypot(tx, tz) || 1.0;
    const ftx = tx / tLen;
    const ftz = tz / tLen;
    const bx = -ftz;
    const bz = ftx;
    const slope = Math.max(0.028, (pPrev.y - pNext.y) / Math.max(1.0, pNext.flowDist - pPrev.flowDist));

    for (let j = 0; j <= segsX; j++) {
      const crossT = (j / segsX) * 2.0 - 1.0;
      const wx = p.x + bx * crossT * p.hw;
      const wz = p.z + bz * crossT * p.hw;
      const bedY = geomorph.getHeightAt(wx, wz);
      const depth = Math.max(0.0, p.y - bedY + (1.0 - Math.abs(crossT)) * 0.45);
      positions.push(wx, p.y, wz);
      normals.push(ftx, 0.0, ftz);
      metas.push(p.flowDist, crossT, depth, slope);
    }
  }

  const rowStride = segsX + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < segsX; j++) {
      const a = i * rowStride + j;
      const b = a + 1;
      const c = a + rowStride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('aWaterMeta', new THREE.Float32BufferAttribute(metas, 4));
  geo.setIndex(indices);
  return geo;
}

export function createTerrenoWater(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Hydrology_19km';

  const waterMat = new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mainRiverGeo = buildMainRiverGeometry(geomorph);
  const mainRiverMesh = new THREE.Mesh(mainRiverGeo, waterMat);
  mainRiverMesh.name = 'TERRENO_MainRiver_Kurosugigawa';
  mainRiverMesh.renderOrder = 2;
  mainRiverMesh.frustumCulled = false;
  group.add(mainRiverMesh);

  // Add cascading tributary streams (skip trib_c1 close behind compound if very steep, keep all 6 iconic gorges!)
  TRIBUTARIES.forEach((tr, ti) => {
    const tribGeo = buildTributaryGeometry(geomorph, tr, ti);
    const tribMesh = new THREE.Mesh(tribGeo, waterMat);
    tribMesh.name = `TERRENO_Tributary_${tr.id}`;
    tribMesh.renderOrder = 2;
    group.add(tribMesh);
  });

  return {
    group,
    material: waterMat,
  };
}
