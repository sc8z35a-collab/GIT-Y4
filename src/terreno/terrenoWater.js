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
 * TERRENO Engine v2 — Breakthrough TR-HYDRO v2:
 * Photorealistic Kamikochi-Grade Crystal-Clear Emerald Mountain River (黒杉川) & 7 Cascading Tributaries!
 *   - True Refracted Underwater Mossy Granite Cobble Bed + Dual-Layer Animated Voronoi Caustics
 *   - Physical Beer-Lambert RGB Spectral Extinction (exp(-vec3(0.98, 0.24, 0.30) * opticalPath))
 *   - 3-Octave Analytical Directional Wavelets + Distance-Filtered Variance-to-Roughness GGX Sparkle
 *   - True F0=0.02 Schlick Fresnel with Deep Gorge Forest Canopy + Sky Horizon Reflection
 *   - Mountain Horizon Self-Shadowing & Streaky Advected Aerated Whitewater Rapids Ribbons
 *   - Exact Shared TERRENO Volumetric Sea-of-Clouds (雲海) + Rayleigh/Mie Aerial Perspective
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
  float midFactor = 1.0 - abs(aWaterMeta.y);
  float heave = sin(aWaterMeta.x * 0.42 - uTime * 3.8) * 0.048
              + cos(aWaterMeta.x * 0.95 + aWaterMeta.y * 5.2 - uTime * 5.1) * 0.022;
  pos.y += heave * midFactor * clamp(aWaterMeta.z * 0.5, 0.0, 1.0);

  vWorldPos = pos;
  vWaterMeta = aWaterMeta;
  vFlowTangent = normalize(normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uGeoMap;

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec4 vWaterMeta;
varying vec3 vFlowTangent;

float wHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 wHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 wNoiseDeriv(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  float a = wHash(i);
  float b = wHash(i + vec2(1.0, 0.0));
  float c = wHash(i + vec2(0.0, 1.0));
  float d = wHash(i + vec2(1.0, 1.0));

  float k0 = a;
  float k1 = b - a;
  float k2 = c - a;
  float k4 = a - b - c + d;
  return vec3(k0 + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * vec2(k1 + k4 * u.y, k2 + k4 * u.x));
}

float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
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

// 4-Tap Bilinear Terrain Bed Sampler for smooth 1mm shoreline depth feathering!
float sampleBedMacro(vec2 xz) {
  vec2 gp = clamp(((xz - uAtmoWorldMin) / uAtmoWorldSize) * (uAtmoAtlasSize - 1.0), vec2(0.0), uAtmoAtlasSize - 1.0001);
  vec2 i0 = floor(gp);
  vec2 f = gp - i0;
  vec2 invS = 1.0 / uAtmoAtlasSize;
  float h00 = texture2D(uGeoMap, (i0 + vec2(0.5, 0.5)) * invS).r;
  float h10 = texture2D(uGeoMap, (i0 + vec2(1.5, 0.5)) * invS).r;
  float h01 = texture2D(uGeoMap, (i0 + vec2(0.5, 1.5)) * invS).r;
  float h11 = texture2D(uGeoMap, (i0 + vec2(1.5, 1.5)) * invS).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}

// Returns vec2(minDist, cellHash) — for domed rounded stones, fade stone mask to 0 before cell boundary!
vec2 wVoronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  float id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = wHash2(n + g) * 0.78 + 0.11;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        id = o.x;
      }
    }
  }
  return vec2(sqrt(md), id);
}

float ggxSpec(vec3 N, vec3 V, vec3 L, float roughness) {
  vec3 H = normalize(L + V);
  float ndh = max(0.0, dot(N, H));
  float ndv = max(0.001, dot(N, V));
  float ndl = max(0.0, dot(N, L));
  float a = roughness * roughness;
  float a2 = a * a;
  float denom = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * denom * denom + 0.0001);
  float k = (roughness + 1.0);
  k = (k * k) * 0.125;
  float G = (ndv / (ndv * (1.0 - k) + k)) * (ndl / (ndl * (1.0 - k) + k));
  return (D * G) / (4.0 * ndv * ndl + 0.001) * ndl;
}

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  float flowDist = vWaterMeta.x;
  float crossT = vWaterMeta.y;
  float localSlope = vWaterMeta.w;

  // Per-pixel smooth riverbed depth (eliminates coarse ribbon triangle edges!)
  float geoBedY = sampleBedMacro(vWorldPos.xz);
  float pixelDepth = max(0.0, vWorldPos.y - geoBedY);
  float depth = mix(vWaterMeta.z, pixelDepth, 0.65);

  float shoreAlpha = smoothstep(0.02, 0.30, depth) * (1.0 - smoothstep(0.84, 1.0, abs(crossT)));
  if (shoreAlpha <= 0.01) discard;

  vec3 toCam = cameraPosition - vWorldPos;
  float camDist = length(toCam);
  vec3 V = toCam / max(camDist, 0.0001);
  vec3 sunDir = normalize(uSunDir);

  // Mountain Horizon Shadowing + Gorge Sky-View AO directly on the river!
  vec2 hUV = (((vWorldPos.xz - uAtmoWorldMin) / uAtmoWorldSize) * (uAtmoAtlasSize - 1.0) + 0.5) / uAtmoAtlasSize;
  vec4 horz = texture2D(uAtmoHorizonMap, clamp(hUV, 0.0005, 0.9995));
  float horzSin = mix(horz.g, horz.r, uUseEastHorizon);
  float horizonShadow = mix(1.0, smoothstep(horzSin - 0.04, horzSin + 0.09, sunDir.y), uHorizonShadowBlend);
  float skyViewAO = horz.b;

  vec3 T = normalize(vec3(vFlowTangent.x, 0.0, vFlowTangent.z));
  vec3 B = normalize(vec3(-T.z, 0.0, T.x));

  // 1. CRISP ISOTROPIC WORLD-SPACE ALPINE STREAM RIPPLES (せせらぎ — 3 Rotated Wave Trains!)
  float flowSpeed = 1.65 + clamp(localSlope * 26.0, 0.0, 5.2);
  vec2 pMetric = vec2(dot(vWorldPos.xz, B.xz), dot(vWorldPos.xz, T.xz));
  float adv1 = uTime * flowSpeed * 0.62;
  float adv2 = uTime * flowSpeed * 1.02;
  float adv3 = uTime * flowSpeed * 1.48;

  const mat2 rotW1  = mat2( 0.8988, -0.4384,  0.4384, 0.8988);
  const mat2 rotW1T = mat2( 0.8988,  0.4384, -0.4384, 0.8988);
  const mat2 rotW2  = mat2( 0.8572,  0.5150, -0.5150, 0.8572);
  const mat2 rotW2T = mat2( 0.8572, -0.5150,  0.5150, 0.8572);
  const mat2 rotW3  = mat2( 0.4695, -0.8829,  0.8829, 0.4695);
  const mat2 rotW3T = mat2( 0.4695,  0.8829, -0.8829, 0.4695);

  vec2 uvW1 = rotW1 * (pMetric - vec2(0.0, adv1)) * 0.78;
  vec2 uvW2 = rotW2 * (pMetric - vec2(0.0, adv2)) * 2.10 + vec2(7.3, -11.4);
  vec2 uvW3 = rotW3 * (pMetric - vec2(0.0, adv3)) * 5.10 + vec2(-15.2, 4.9);

  float midFade   = 1.0 - smoothstep(38.0, 220.0, camDist);
  float microFade = 1.0 - smoothstep(12.0, 68.0, camDist);

  vec3 d1 = wNoiseDeriv(uvW1);
  vec3 d2 = midFade   > 0.01 ? wNoiseDeriv(uvW2) : vec3(0.5, 0.0, 0.0);
  vec3 d3 = microFade > 0.01 ? wNoiseDeriv(uvW3) : vec3(0.5, 0.0, 0.0);

  vec2 g1 = rotW1T * d1.yz * 0.14;
  vec2 g2 = rotW2T * d2.yz * (0.12 * midFade);
  vec2 g3 = rotW3T * d3.yz * (0.085 * microFade);
  vec2 gradBT = g1 + g2 + g3;

  float turbBoost = 1.0 + clamp(localSlope * 16.0, 0.0, 1.35) + smoothstep(0.60, 0.05, depth) * 0.38;
  vec3 N = normalize(vec3(0.0, 1.0, 0.0) - B * (gradBT.x * turbBoost) - T * (gradBT.y * turbBoost));

  float roughness = mix(0.058, 0.21, 1.0 - microFade * 0.72) + clamp(localSlope * 1.8, 0.0, 0.12);

  // 2. ROUNDED ORGANIC KAMIKOCHI RIVER COBBLES + DOMAIN-WARPED UNDERWATER CAUSTICS!
  //    (Zero flat Voronoi polygon edges — rounded stones emerge cleanly out of dark gravel silt!)
  vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, 0.72) * (uHemiIntensity * (0.48 + 0.52 * skyViewAO));
  vec3 bedColor = vec3(0.018, 0.034, 0.028);
  float bedFade = 1.0 - smoothstep(42.0, 155.0, camDist);

  if (bedFade > 0.01 && depth < 4.4) {
    vec2 refrXZ = vWorldPos.xz + N.xz * clamp(depth * 0.42, 0.03, 0.95);
    // Silt & submerged mossy sand continuous substrate
    float siltN = wFbm(refrXZ * 1.35);
    vec3 substrate = mix(vec3(0.024, 0.030, 0.026), vec3(0.032, 0.056, 0.030), smoothstep(0.35, 0.78, siltN));

    // Rounded river cobbles (~20cm) + fine gravel pebbles (~8cm): mask drops to 0.0 BEFORE Voronoi cell border!
    vec2 cobBig = wVoronoi(refrXZ * 4.6 + vec2(siltN * 0.35));
    vec2 cobSm  = wVoronoi(refrXZ * 10.8 + vec2(11.3, -7.2));
    float stoneMaskBig = smoothstep(0.42, 0.14, cobBig.x);
    float stoneMaskSm  = smoothstep(0.44, 0.16, cobSm.x);
    vec3 colBigStone = mix(vec3(0.055, 0.058, 0.055), vec3(0.165, 0.158, 0.142), cobBig.y) * (0.62 + 0.55 * stoneMaskBig);
    vec3 colSmStone  = mix(vec3(0.048, 0.050, 0.048), vec3(0.135, 0.130, 0.118), cobSm.y) * (0.65 + 0.48 * stoneMaskSm);

    vec3 pebbleBase = mix(substrate, colSmStone, stoneMaskSm * 0.72);
    pebbleBase = mix(pebbleBase, colBigStone, stoneMaskBig * 0.82);

    // Organically domain-warped dual-layer sunlight refraction caustics (水底コースティクス)!
    vec2 cWarp = vec2(wNoise(pMetric * 1.45), wNoise(pMetric * 1.45 + vec2(9.2, -6.7))) * 0.58;
    vec2 cUV1 = (pMetric - vec2(0.0, adv1 * 0.75)) * 1.25 + cWarp + N.xz * 0.55;
    vec2 cUV2 = rotW2 * (pMetric - vec2(0.0, adv2 * 0.55)) * 1.85 - cWarp * 0.7 - N.xz * 0.40;
    float cv1 = wVoronoi(cUV1).x;
    float cv2 = wVoronoi(cUV2).x;
    float causticNet = pow(clamp(cv1 * 0.54 + cv2 * 0.46, 0.0, 1.0), 3.6) * 4.8;
    float causticDepthFade = smoothstep(0.03, 0.24, depth) * exp(-depth * 0.50);

    vec3 bedDirect = uSunColor * (uSunIntensity * horizonShadow * (0.50 + causticNet * causticDepthFade * 1.85));
    bedColor = pebbleBase * (bedDirect + ambient * 0.90);
  } else {
    bedColor *= (uSunColor * (uSunIntensity * horizonShadow * 0.35) + ambient);
  }

  // 3. TRUE PHYSICAL BEER-LAMBERT SPECTRAL EXTINCTION (Kamikochi Crystal Emerald-Jade!)
  float cosViewUp = clamp(V.y, 0.28, 1.0);
  float opticalPath = depth / cosViewUp;
  vec3 transmittance = exp(-vec3(0.86, 0.21, 0.26) * opticalPath);

  float ndl = max(0.0, dot(N, sunDir));
  vec3 waterScatterAlbedo = vec3(0.006, 0.064, 0.058);
  vec3 volumeScatter = waterScatterAlbedo * (uSunColor * (uSunIntensity * horizonShadow * (0.28 + 0.58 * ndl)) + ambient * 1.05);
  vec3 refractedCol = bedColor * transmittance + volumeScatter * (1.0 - transmittance);

  // 4. TRUE F0=0.02 SCHLICK FRESNEL + DEEP GORGE FOREST CANOPY & SKY REFLECTION
  float cosV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  vec3 R = reflect(-V, N);
  float reflY = clamp(R.y, 0.0, 1.0);

  vec3 skyRefl = mix(uSkyHorizon * 0.80, uSkyZenith * 1.08, pow(reflY, 0.68));
  vec3 gorgeCanopyRefl = vec3(0.011, 0.028, 0.016) * (0.55 + uHemiIntensity * 1.20)
                       + uSunColor * (uSunIntensity * horizonShadow * 0.016);
  float wallMask = 1.0 - smoothstep(0.14, 0.42, reflY + (1.0 - abs(crossT)) * 0.12);
  vec3 envRefl = mix(skyRefl, gorgeCanopyRefl, wallMask * 0.82);

  vec3 col = mix(refractedCol, envRefl, clamp(fresnel * 0.86, 0.02, 0.84));

  // 5. Crisp GGX Solar / Lunar Diamond Water Sparkle across flowing wavelets!
  float specGgx = ggxSpec(N, V, sunDir, roughness);
  col += uSunColor * (uSunIntensity * horizonShadow * specGgx * 0.92);

  // 6. ISOTROPIC ORGANIC AERATED WHITEWATER FOAM (Lacy Rocky Shore & Riffle Patches)
  vec2 foamUV1 = rotW1 * (pMetric - vec2(0.0, adv1 * 0.9)) * 0.72;
  vec2 foamUV2 = rotW2 * (pMetric - vec2(0.0, adv2 * 0.7)) * 1.85;
  float foamCell = wFbm(foamUV1) * 0.65 + wNoise(foamUV2) * 0.35;
  float shoreEdge = smoothstep(0.42, 0.04, depth) * smoothstep(0.48, 0.80, foamCell);
  float rapidPatch = smoothstep(0.015, 0.062, localSlope) * smoothstep(0.46, 0.80, foamCell * 0.72 + d2.x * 0.28);
  float crestCap   = smoothstep(0.74, 0.94, d1.x * 0.5 + d2.x * 0.5) * clamp(localSlope * 18.0, 0.0, 0.55);
  float foamMask   = clamp(max(shoreEdge * 0.70, max(rapidPatch * 0.82, crestCap)), 0.0, 0.86);

  vec3 foamLit = (uSunColor * (uSunIntensity * horizonShadow * (0.38 + 0.46 * ndl)) + uHemiSkyColor * (uHemiIntensity * 0.84))
               * vec3(0.68, 0.73, 0.75);
  col = mix(col, foamLit, foamMask);

  col += evalTerrenoFlashlight(vWorldPos, N, mix(vec3(0.18, 0.34, 0.30), vec3(0.85, 0.90, 0.92), foamMask));

  // 7. Exact Shared TERRENO Volumetric Sea-of-Clouds (雲海) + Rayleigh/Mie Aerial Perspective!
  col = applyTerrenoAtmosphere(col, vWorldPos, cameraPosition);

  float edgeNoise = smoothstep(0.02, 0.32, depth + (d1.x - 0.5) * 0.14);
  float depthOpacity = 1.0 - exp(-depth * 2.2);
  float finalAlpha = clamp(max(shoreAlpha * edgeNoise * (0.52 + 0.46 * depthOpacity + fresnel * 0.40), foamMask * 0.90), 0.0, 0.98);
  gl_FragColor = vec4(col, finalAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildMainRiverGeometry(geomorph) {
  const segsZ = 1600;
  const segsX = 16;
  const zMin = TERRENO_WORLD.minZ + 20;
  const zMax = TERRENO_WORLD.maxZ - 20;
  const dz = (zMax - zMin) / segsZ;

  const positions = [];
  const normals = [];
  const metas = [];
  const indices = [];

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
    const bx = -ftz;
    const bz = ftx;
    const slope = Math.max(0.005, (pPrev.waterY - pNext.waterY) / Math.max(1.0, pNext.flowDist - pPrev.flowDist));

    const ribbonHW = p.halfWidth * 1.38;
    for (let j = 0; j <= segsX; j++) {
      const crossT = (j / segsX) * 2.0 - 1.0;
      const wx = p.x + bx * crossT * ribbonHW;
      const wz = p.z + bz * crossT * ribbonHW;
      const bedY = geomorph.getHeightAt(wx, wz);
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
  const segs = 72;
  const segsX = 4;
  const rv0 = evalMainRiver(tr.z0);
  const startLen = tr.len * 0.72;

  const pts = [];
  let accumDist = 0.0;
  for (let i = 0; i <= segs; i++) {
    const u = 1.0 - i / segs;
    const along = u * startLen;
    const meander = Math.sin(along * 0.0028 + ti * 2.1) * 95.0 + Math.cos(along * 0.0072) * 32.0;
    const perpX = -tr.dirZ;
    const perpZ = tr.dirX;
    const wx = rv0.x + tr.dirX * along + perpX * meander;
    const wz = tr.z0 + tr.dirZ * along + perpZ * meander;
    const terrainY = geomorph.getHeightAt(wx, wz);
    if (i > 0) {
      accumDist += Math.hypot(wx - pts[i - 1].x, wz - pts[i - 1].z);
    }
    const hw = Math.max(5.5, tr.width * 0.22 * (1.25 - 0.60 * u));
    pts.push({ x: wx, z: wz, y: terrainY + 0.72, hw, flowDist: accumDist });
  }
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y > pts[i - 1].y - 0.1) {
      pts[i].y = pts[i - 1].y - 0.1;
    }
  }
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
  group.name = 'TERRENO_Hydrology_40km';

  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      ...atmoUniforms,
      uGeoMap: { value: geomorph.geoTexture },
    },
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
