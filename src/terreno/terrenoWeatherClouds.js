import * as THREE from 'three';
import { TERRENO_WORLD } from './terrenoConfig.js';

/**
 * TERRENO 9.0 — Truly Floating 3D Multi-Layer Volumetric Clouds & Real Dynamic Weather Engine
 *
 * Breakthroughs:
 *   1. TRULY FLOATING 3D MULTI-LAYER VOLUMETRIC CLOUDS (1 single InstancedMesh draw call, 0.00 ms CPU/frame!):
 *      - 5 authentic meteorological cloud altitudes floating in true 3D world space:
 *          • Layer 0: Valley Mist & Rift Stratus Decks (+260..+680m local / +580..+1,000m ASL)
 *          • Layer 1: Sculpted Sunlit Cumulus Humilis & Mediocris (+1,050..+1,950m local)
 *          • Layer 2: Orographic Lenticular & Peak Cap Clouds (+2,450..+3,600m local — hugging 4,000m summits!)
 *          • Layer 3: Towering Cumulonimbus Storm Anvils (+1,650..+3,550m local — expand & darken in storms!)
 *          • Layer 4: High-Altitude Sunlit Cirrus Ice-Crystal Veils (+4,100..+4,750m local)
 *      - You can look up at drifting clouds casting real moving ground shadows, climb into mountain clouds,
 *        AND fly Airship K-11 right THROUGH and ABOVE the floating cloud decks with soft fly-through fade!
 *      - Beer-Lambert powder optical depth + dual-lobe Henyey-Greenstein silver lining + cauliflower FBM edge erosion!
 *
 *   2. REAL PHYSICAL METEOROLOGICAL WEATHER SYSTEM (13 distinct weather types + Dynamic Auto-Cycle!):
 *      - Real lapse-rate local temperature (`-6.5°C / 1,000m`), barometric pressure (hPa), humidity (%),
 *        wind speed/direction/gusts, dynamic terrain wetness/snow accumulation, and AUTOMATIC altitude-dependent
 *        rain <-> sleet <-> snow phase transition across the -800m .. +4,000m elevation range!
 *      - Unified GPU Precipitation Volume (1 draw call when active, 0 when clear):
 *        Rain streaks, swirling 3D snowflakes, bouncing hail pellets, and desert ochre sand/dust!
 *      - 3D Optical Sky Phenomena (1 draw call when active, 0 otherwise):
 *        Anti-solar Spectral Rainbow Arch (天気雨) & Undulating Volumetric Aurora Borealis Curtains (オーロラ)!
 */

export const WEATHER_TYPES = [
  {
    id: 'clear',
    nameJp: '快晴',
    descJp: '澄み渡る青空と点在する高積雲',
    cloudCoverage: 0.24,
    cloudDarkness: 0.04,
    stormTower: 0.0,
    valleyMist: 0.08,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 0.72,
    sunMult: 1.08,
    hemiMult: 1.04,
    windSpeedMs: 2.6,
    windDirDeg: 245,
    seaLevelTempC: 21.0,
    freezingLevelM: 3250,
    pressureHpa: 1024,
    humidity: 0.42,
    wetness: 0.0,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [1.0, 1.0, 1.0],
  },
  {
    id: 'partly_cloudy',
    nameJp: '晴れ・浮雲',
    descJp: '立体的な積雲が流れ山肌に雲影が走る穏やかな空',
    cloudCoverage: 0.50,
    cloudDarkness: 0.10,
    stormTower: 0.08,
    valleyMist: 0.22,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 1.0,
    sunMult: 1.0,
    hemiMult: 1.0,
    windSpeedMs: 4.8,
    windDirDeg: 235,
    seaLevelTempC: 19.0,
    freezingLevelM: 2950,
    pressureHpa: 1017,
    humidity: 0.56,
    wetness: 0.0,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [1.0, 1.0, 1.0],
  },
  {
    id: 'overcast',
    nameJp: '曇天・層雲',
    descJp: '重厚な銀灰色の層積雲が峰を覆う静かな曇天',
    cloudCoverage: 0.86,
    cloudDarkness: 0.44,
    stormTower: 0.25,
    valleyMist: 0.48,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 1.65,
    sunMult: 0.48,
    hemiMult: 0.88,
    windSpeedMs: 7.4,
    windDirDeg: 210,
    seaLevelTempC: 15.0,
    freezingLevelM: 2450,
    pressureHpa: 1007,
    humidity: 0.78,
    wetness: 0.14,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.80, 0.84, 0.88],
  },
  {
    id: 'valley_mist',
    nameJp: '渓谷濃霧・雲海',
    descJp: '渓谷と深淵裂谷を白銀の雲海と濃霧が満たす幻想気象',
    cloudCoverage: 0.66,
    cloudDarkness: 0.22,
    stormTower: 0.10,
    valleyMist: 1.0,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 3.6,
    sunMult: 0.72,
    hemiMult: 0.96,
    windSpeedMs: 2.0,
    windDirDeg: 185,
    seaLevelTempC: 13.5,
    freezingLevelM: 2400,
    pressureHpa: 1015,
    humidity: 0.96,
    wetness: 0.34,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.90, 0.94, 0.98],
  },
  {
    id: 'sunshower',
    nameJp: '天気雨・虹',
    descJp: '黄金の陽光が雨粒を照らし山谷に大きな虹が架かる',
    cloudCoverage: 0.48,
    cloudDarkness: 0.16,
    stormTower: 0.22,
    valleyMist: 0.36,
    rainRate: 0.48,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 1.25,
    sunMult: 0.96,
    hemiMult: 1.05,
    windSpeedMs: 5.5,
    windDirDeg: 255,
    seaLevelTempC: 18.0,
    freezingLevelM: 2800,
    pressureHpa: 1011,
    humidity: 0.84,
    wetness: 0.56,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 1.0,
    auroraStrength: 0.0,
    skyTint: [1.04, 0.99, 0.94],
  },
  {
    id: 'light_rain',
    nameJp: '小雨・霧雨',
    descJp: '森と岩肌をしっとり濡らす穏やかな山の通り雨',
    cloudCoverage: 0.82,
    cloudDarkness: 0.52,
    stormTower: 0.36,
    valleyMist: 0.65,
    rainRate: 0.55,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 2.1,
    sunMult: 0.42,
    hemiMult: 0.80,
    windSpeedMs: 8.2,
    windDirDeg: 225,
    seaLevelTempC: 14.0,
    freezingLevelM: 2250,
    pressureHpa: 1003,
    humidity: 0.92,
    wetness: 0.72,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.74, 0.80, 0.86],
  },
  {
    id: 'heavy_rain',
    nameJp: '本降り・豪雨',
    descJp: '厚い雨雲から激しい斜め雨が降り注ぎ地表が艶めく',
    cloudCoverage: 0.95,
    cloudDarkness: 0.74,
    stormTower: 0.68,
    valleyMist: 0.82,
    rainRate: 0.96,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 2.95,
    sunMult: 0.28,
    hemiMult: 0.68,
    windSpeedMs: 15.5,
    windDirDeg: 230,
    seaLevelTempC: 12.5,
    freezingLevelM: 2050,
    pressureHpa: 994,
    humidity: 0.98,
    wetness: 0.96,
    snowAccum: 0.0,
    lightningRate: 0.06,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.60, 0.68, 0.76],
  },
  {
    id: 'thunderstorm',
    nameJp: '雷雨・積乱雲',
    descJp: '巨大積乱雲が轟き稲妻と強風・豪雨が山岳を揺らす',
    cloudCoverage: 0.98,
    cloudDarkness: 0.90,
    stormTower: 1.0,
    valleyMist: 0.88,
    rainRate: 1.0,
    snowRate: 0.0,
    hailRate: 0.16,
    dustRate: 0.0,
    fogMult: 3.3,
    sunMult: 0.22,
    hemiMult: 0.56,
    windSpeedMs: 24.0,
    windDirDeg: 240,
    seaLevelTempC: 11.5,
    freezingLevelM: 1950,
    pressureHpa: 982,
    humidity: 0.99,
    wetness: 1.0,
    snowAccum: 0.0,
    lightningRate: 1.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.46, 0.54, 0.64],
  },
  {
    id: 'snowfall',
    nameJp: '降雪・粉雪',
    descJp: '静かに舞い落ちる粉雪が山林と岩稜を白銀に染める',
    cloudCoverage: 0.84,
    cloudDarkness: 0.30,
    stormTower: 0.22,
    valleyMist: 0.55,
    rainRate: 0.0,
    snowRate: 0.76,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 2.2,
    sunMult: 0.56,
    hemiMult: 0.96,
    windSpeedMs: 5.4,
    windDirDeg: 315,
    seaLevelTempC: -1.5,
    freezingLevelM: -950,
    pressureHpa: 1004,
    humidity: 0.86,
    wetness: 0.18,
    snowAccum: 0.78,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.88, 0.92, 0.98],
  },
  {
    id: 'blizzard',
    nameJp: '猛吹雪',
    descJp: '強風が雪煙を横に薙ぎ払う極寒アルプスホワイトアウト',
    cloudCoverage: 0.96,
    cloudDarkness: 0.52,
    stormTower: 0.58,
    valleyMist: 0.94,
    rainRate: 0.0,
    snowRate: 1.0,
    hailRate: 0.12,
    dustRate: 0.0,
    fogMult: 4.4,
    sunMult: 0.34,
    hemiMult: 0.84,
    windSpeedMs: 31.0,
    windDirDeg: 330,
    seaLevelTempC: -9.5,
    freezingLevelM: -1200,
    pressureHpa: 978,
    humidity: 0.94,
    wetness: 0.12,
    snowAccum: 1.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.82, 0.88, 0.96],
  },
  {
    id: 'hail',
    nameJp: '雹・霰',
    descJp: '寒冷前線に伴う氷粒の驟雨と冷たい突風',
    cloudCoverage: 0.90,
    cloudDarkness: 0.68,
    stormTower: 0.78,
    valleyMist: 0.58,
    rainRate: 0.32,
    snowRate: 0.14,
    hailRate: 0.92,
    dustRate: 0.0,
    fogMult: 2.3,
    sunMult: 0.36,
    hemiMult: 0.76,
    windSpeedMs: 18.5,
    windDirDeg: 295,
    seaLevelTempC: 3.5,
    freezingLevelM: 750,
    pressureHpa: 992,
    humidity: 0.88,
    wetness: 0.74,
    snowAccum: 0.28,
    lightningRate: 0.28,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [0.68, 0.75, 0.84],
  },
  {
    id: 'sand_haze',
    nameJp: '黄砂・砂塵',
    descJp: '琥珀色の乾いた砂塵が岩峡と高原を覆う大陸風',
    cloudCoverage: 0.44,
    cloudDarkness: 0.26,
    stormTower: 0.12,
    valleyMist: 0.72,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.92,
    fogMult: 3.1,
    sunMult: 0.78,
    hemiMult: 0.88,
    windSpeedMs: 19.0,
    windDirDeg: 278,
    seaLevelTempC: 27.5,
    freezingLevelM: 4200,
    pressureHpa: 1009,
    humidity: 0.24,
    wetness: 0.0,
    snowAccum: 0.0,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 0.0,
    skyTint: [1.14, 0.92, 0.68],
  },
  {
    id: 'aurora',
    nameJp: 'オーロラ・極光',
    descJp: '4000m峰の彼方に緑紫の立体オーロラカーテンが揺らめく',
    cloudCoverage: 0.20,
    cloudDarkness: 0.10,
    stormTower: 0.0,
    valleyMist: 0.16,
    rainRate: 0.0,
    snowRate: 0.0,
    hailRate: 0.0,
    dustRate: 0.0,
    fogMult: 0.78,
    sunMult: 0.24,
    hemiMult: 0.48,
    windSpeedMs: 3.2,
    windDirDeg: 15,
    seaLevelTempC: 1.5,
    freezingLevelM: 1150,
    pressureHpa: 1022,
    humidity: 0.48,
    wetness: 0.0,
    snowAccum: 0.42,
    lightningRate: 0.0,
    rainbowStrength: 0.0,
    auroraStrength: 1.0,
    skyTint: [0.15, 0.23, 0.39],
  },
];

export const WEATHER_BY_ID = new Map(WEATHER_TYPES.map((w) => [w.id, w]));

// ============================================================================
// 1. TRULY FLOATING 3D MULTI-LAYER VOLUMETRIC CLOUD SHADER (1 Draw Call!)
// ============================================================================
const CLOUD_VERT = /* glsl */ `
precision highp float;

attribute vec4 aCloudAnchor;  // xyz = base wrapped position in 3D world (x,z in [-0.5..0.5]*domain, y = local altitude), w = layerId (0..4)
attribute vec4 aCloudShape;   // x = radiusX, y = radiusY, z = seed/phase, w = lobeHeightBias (-1 base .. +1 sunlit crown)

uniform vec3 uCamPos;
uniform vec2 uCloudWindOffset;
uniform float uCloudCoverage;
uniform float uStormTower;
uniform float uValleyMist;
uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vLobeBias;
varying float vLayer;
varying float vSeed;
varying float vCamDist;
varying float vVisFade;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  vUv = uv;
  float layer = aCloudAnchor.w;
  float seed = aCloudShape.z;
  vLayer = layer;
  vSeed = seed;
  vLobeBias = aCloudShape.w;

  // Domain wraps seamlessly around camera in 3D world space -> clouds truly float at real altitudes forever!
  float domain = layer < 0.5 ? 16000.0 : (layer > 3.5 ? 34000.0 : 26000.0);
  float windMult = layer < 0.5 ? 0.45 : (layer < 1.5 ? 1.0 : (layer < 2.5 ? 0.35 : (layer < 3.5 ? 1.35 : 1.75)));

  // Layer 2 (orographic peak caps) stays weakly tethered near mountains; others advect freely with real wind!
  vec2 rawXZ = aCloudAnchor.xz + uCloudWindOffset * windMult;
  vec2 relXZ = mod(rawXZ - uCamPos.xz + domain * 0.5, domain) - domain * 0.5;
  vec2 worldXZ = uCamPos.xz + relXZ;

  // Real vertical buoyancy & cumulonimbus convective tower expansion during rain/storms!
  float bob = sin(uTime * 0.08 + seed * 6.2831) * 18.0;
  float worldY = aCloudAnchor.y + bob;
  if (layer > 2.5 && layer < 3.5) {
    // Cumulonimbus anvils puff vertically taller when stormTower ramps up!
    worldY += max(0.0, aCloudShape.w) * uStormTower * 780.0;
  }

  // Coverage gating: cull excess cloud clusters cleanly offscreen when weather is clear
  float layerThresh = 0.0;
  if (layer < 0.5) {
    layerThresh = (1.0 - uValleyMist) * 0.92;
  } else if (layer < 1.5) {
    layerThresh = (1.0 - uCloudCoverage) * 0.92;
  } else if (layer < 2.5) {
    layerThresh = (1.0 - max(uCloudCoverage, 0.32)) * 0.85;
  } else if (layer < 3.5) {
    layerThresh = 1.0 - clamp(uStormTower * 1.15, 0.0, 1.0);
  } else {
    layerThresh = (1.0 - clamp(uCloudCoverage * 0.85 + 0.18, 0.0, 1.0)) * 0.80;
  }

  float keep = smoothstep(layerThresh - 0.14, layerThresh + 0.14, fract(seed * 7.13));
  if (keep < 0.01) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vVisFade = 0.0;
    vCamDist = 99999.0;
    vWorldPos = vec3(0.0);
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
    return;
  }

  vec3 center = vec3(worldXZ.x, worldY, worldXZ.y);
  float camDist = length(center - uCamPos);
  vCamDist = camDist;

  // Radial domain-edge fade so clouds materialize softly at the 13km horizon (ZERO pop-in!)
  float horizR = length(relXZ) / (domain * 0.48);
  float edgeFade = 1.0 - smoothstep(0.68, 0.98, horizR);
  // Soft proximity fly-through envelope when flying K-11 right inside a floating 3D cloud!
  float nearFade = smoothstep(28.0, 220.0, camDist);
  vVisFade = keep * edgeFade * nearFade;

  // Camera-facing spherical-billboard lobe expanded in true 3D world space!
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // Blend slight world-up alignment for broad flat cumulus bases & cirrus sheets so looking from above feels 3D!
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  vec3 billboardUp = normalize(mix(camUp, worldUp, layer < 0.5 || layer > 3.5 ? 0.18 : 0.34));

  float growth = 0.72 + 0.46 * uCloudCoverage + (layer > 2.5 && layer < 3.5 ? uStormTower * 0.42 : 0.0);
  float rx = aCloudShape.x * growth;
  float ry = aCloudShape.y * growth;

  vec3 worldPos = center + camRight * (position.x * rx) + billboardUp * (position.y * ry);
  vWorldPos = worldPos;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uMicroNoiseTex;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGlow;
uniform vec3 uAerialFogColor;
uniform float uCloudBrightness;
uniform float uCloudDarkness;
uniform float uWeatherLightning;
uniform float uWeatherDust;
uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vLobeBias;
varying float vLayer;
varying float vSeed;
varying float vCamDist;
varying float vVisFade;
#include <logdepthbuf_pars_fragment>

float cHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float cValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = cHash21(i);
  float b = cHash21(i + vec2(1.0, 0.0));
  float c = cHash21(i + vec2(0.0, 1.0));
  float d = cHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float cFbm4(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * cValueNoise(p);
    p = rot * p * 2.04 + vec2(17.3, 9.2);
    a *= 0.48;
  }
  return v;
}

void main() {
  if (vVisFade < 0.01) discard;

  vec2 q = vUv * 2.0 - 1.0;
  // Slightly flatter cloud bottom for authentic convective condensation-level flat bases on cumulus!
  float flatBottom = (vLayer > 0.5 && vLayer < 3.5 && q.y < 0.0) ? 1.32 : 1.0;
  float r = length(vec2(q.x, q.y * flatBottom));
  if (r >= 1.0) discard;

  // True 4-octave rotated domain-warped smooth FBM cauliflower sculpting (ZERO ovals, ZERO circular rims!)
  vec2 uvScale = vLayer > 3.5 ? vec2(1.45, 5.20) : (vLayer < 0.5 ? vec2(1.65, 2.80) : vec2(2.35, 2.15));
  vec2 baseUv = q * uvScale + vec2(vSeed * 37.3, vSeed * 19.7);
  vec2 drift = vec2(uTime * 0.025, -uTime * 0.012);
  float warp = cFbm4(baseUv * 1.10 + drift);
  float billowRaw = cFbm4(baseUv * 1.95 + vec2(warp * 1.35, -warp * 1.05) - drift * 0.65);
  float wispRaw = cValueNoise(baseUv * 6.2 + vec2(billowRaw * 2.0));

  // Stretch central-limit FBM cleanly to full [0..1] dynamic range so deep sky bays carve organically into every cloud!
  float billow = smoothstep(0.24, 0.76, billowRaw * 0.84 + wispRaw * 0.16);
  float radialDrop = smoothstep(0.0, 1.0, r);
  float density = billow - radialDrop * radialDrop * (vLayer > 3.5 ? 1.15 : 1.08);
  float eroded = smoothstep(0.05, 0.52, density) * smoothstep(1.0, 0.78, r);
  float layerAlpha = vLayer < 0.5 ? 0.52 : (vLayer > 3.5 ? 0.34 : 0.90);
  float alpha = eroded * layerAlpha * vVisFade;
  if (alpha < 0.014) discard;

  // Physical Beer-Lambert Powder + Dual-Lobe Henyey-Greenstein Silver Lining!
  vec3 viewDir = normalize(vWorldPos - cameraPosition);
  vec3 sunDir = normalize(uSunDir);
  float cosTheta = dot(viewDir, sunDir);
  float hgFwd = (1.0 - 0.66 * 0.66) / pow(max(0.08, 1.0 + 0.66 * 0.66 - 2.0 * 0.66 * cosTheta), 1.5) * 0.16;
  float hgBack = (1.0 - 0.24 * 0.24) / pow(max(0.12, 1.0 + 0.24 * 0.24 + 2.0 * 0.24 * cosTheta), 1.5) * 0.25;
  float phase = clamp(0.68 + hgFwd + hgBack, 0.45, 2.25);

  // Sculptural 3D cumulus puff lighting (bright sunlit cauliflower crown vs cool shaded condensation base!)
  float puffH = clamp(q.y * 0.62 + vLobeBias * 0.38 + (billow - 0.5) * 0.95, -1.0, 1.0);
  float sunAlign = clamp(0.42 + 0.58 * (puffH * (0.48 + 0.52 * sunDir.y) + q.x * sunDir.x * 0.44), 0.0, 1.0);
  float opticalDepth = eroded * (1.45 + uCloudDarkness * 2.1);
  float beer = exp(-opticalDepth * (1.0 - sunAlign * 0.72));
  float powder = 1.0 - exp(-opticalDepth * 2.6);
  float scatter = clamp(mix(beer, beer * powder * 2.15, 0.48) * phase, 0.0, 1.55);

  // Silver-lining translucent rim along thin sunlit cloud wisps
  float silverRim = smoothstep(0.05, 0.44, eroded) * (1.0 - smoothstep(0.38, 0.86, eroded)) * pow(max(0.0, cosTheta), 3.2) * (1.0 - uCloudDarkness * 0.48);

  // Color synthesis synced to time-of-day (night/dawn/day/dusk) + storm darkening + dust haze + internal lightning!
  vec3 shadowBase = mix(uSkyZenith * 0.68 + uAerialFogColor * 0.34, vec3(0.09, 0.12, 0.17), uCloudDarkness * 0.82);
  vec3 litCrown = mix(vec3(1.00, 0.995, 0.985), uSkyGlow * 1.22, 0.32) * (0.30 + 0.82 * uCloudBrightness);
  litCrown = mix(litCrown, litCrown * vec3(0.54, 0.60, 0.68), uCloudDarkness * 0.72);

  vec3 cloudCol = mix(shadowBase, litCrown, clamp(smoothstep(0.12, 0.88, scatter * (0.36 + 0.74 * sunAlign)), 0.0, 1.0));
  cloudCol += uSunColor * (silverRim * 0.95 * (0.35 + 0.65 * uCloudBrightness));

  // Warm ochre dust tint during sandstorms
  if (uWeatherDust > 0.02) {
    cloudCol = mix(cloudCol, vec3(0.76, 0.58, 0.38) * (0.45 + 0.55 * uCloudBrightness), uWeatherDust * 0.55);
  }
  // Vivid internal electric cumulonimbus illumination during lightning flashes!
  if (uWeatherLightning > 0.02) {
    float boltBoost = (vLayer > 2.5 && vLayer < 3.5) ? 1.4 : 0.65;
    cloudCol += vec3(0.68, 0.82, 1.0) * (uWeatherLightning * boltBoost * (0.55 + 0.45 * billow));
  }

  // Distance aerial perspective blend seamlessly into horizon sky
  float horizFog = 1.0 - exp(-vCamDist * 0.000058);
  cloudCol = mix(cloudCol, mix(uAerialFogColor, uSkyHorizon, 0.65), clamp(horizFog * 0.74, 0.0, 0.80));

  gl_FragColor = vec4(cloudCol, alpha);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ============================================================================
// 2. UNIFIED GPU PRECIPITATION VOLUME (Rain + Altitude-Aware Snow + Hail + Dust)
// ============================================================================
const PRECIP_VERT = /* glsl */ `
precision highp float;

attribute vec3 aSeed;   // [0..1]^3 wrap coords
attribute vec2 aQuad;   // [-1..+1, 0..1]

uniform vec3 uCamPos;
uniform float uTime;
uniform vec3 uWind;          // xz = wind velocity (m/s), y = gust
uniform float uRainRate;
uniform float uSnowRate;
uniform float uHailRate;
uniform float uDustRate;
uniform float uFreezingLocalY; // Local Y above which rain physically freezes into swirling snow!
uniform float uLightning;

varying vec2 vQuad;
varying float vAlpha;
varying float vMode;  // 0 = rain, 1 = snow, 2 = hail, 3 = dust
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  float totalRate = max(max(uRainRate, uSnowRate), max(uHailRate, uDustRate));
  if (totalRate < 0.015) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    vMode = 0.0;
    vQuad = aQuad;
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
    return;
  }

  // Determine particle physical phase using local altitude & active weather rates!
  float mode = 0.0;
  float activeStrength = uRainRate;
  if (uDustRate > 0.15) {
    mode = 3.0;
    activeStrength = uDustRate;
  } else if (uHailRate > 0.35 && aSeed.z < uHailRate * 0.78) {
    mode = 2.0;
    activeStrength = uHailRate;
  } else if (uSnowRate > 0.08) {
    mode = 1.0;
    activeStrength = uSnowRate;
  }

  // TERRENO 9.0 Ultra-Lightweight Strict 6m × 6m × 6m Dynamic Precipitation Bubble around player!
  vec3 box = vec3(6.0, 6.0, 6.0);
  float fallSpeed = 23.0 + aSeed.x * 8.0;
  vec2 driftXZ = uWind.xz;

  // Check if camera/particle altitude is above freezing level -> rain automatically becomes alpine snow!
  if (mode < 0.5 && (uCamPos.y + (aSeed.y - 0.5) * box.y) > uFreezingLocalY) {
    mode = 1.0;
    activeStrength = max(uRainRate, uSnowRate);
  }

  if (mode > 0.5 && mode < 1.5) {
    // Swirling buoyant 3D snowflakes!
    fallSpeed = 2.1 + aSeed.x * 1.5;
    driftXZ = uWind.xz * 0.48 + vec2(sin(uTime * 1.4 + aSeed.z * 25.0), cos(uTime * 1.2 + aSeed.x * 21.0)) * 1.65;
  } else if (mode > 1.5 && mode < 2.5) {
    // Fast-falling icy hail pellets!
    fallSpeed = 30.0 + aSeed.x * 7.0;
    driftXZ = uWind.xz * 0.85;
  } else if (mode > 2.5) {
    // Wind-driven horizontal desert ochre sand & dust motes!
    fallSpeed = 0.65 + aSeed.x * 0.55;
    driftXZ = uWind.xz * 0.95;
  }

  // Thin out particle count proportionally to intensity so light drizzle stays delicate & authentic
  if (aSeed.z > clamp(activeStrength * 0.85, 0.0, 1.0)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    vMode = mode;
    vQuad = aQuad;
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
    return;
  }

  vec3 worldOffset = vec3(
    fract(aSeed.x + (driftXZ.x * uTime) / box.x - uCamPos.x / box.x) - 0.5,
    fract(aSeed.y - (fallSpeed * uTime) / box.y - uCamPos.y / box.y) - 0.5,
    fract(aSeed.z + (driftXZ.y * uTime) / box.z - uCamPos.z / box.z) - 0.5
  ) * box;

  vec3 basePos = uCamPos + worldOffset;
  vec3 toCam = normalize(uCamPos - basePos);
  vec3 vel = normalize(vec3(driftXZ.x, -fallSpeed, driftXZ.y));
  vec3 right = normalize(cross(vel, toCam));
  vec3 upAxis = vel;

  float pW = 0.008;
  float pL = 0.36 + activeStrength * 0.28;
  if (mode > 0.5 && mode < 1.5) {
    // Soft round snowflakes (billboarded!)
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    right = camRight;
    upAxis = camUp;
    pW = 0.024 + aSeed.x * 0.022;
    pL = pW * 2.0;
  } else if (mode > 1.5 && mode < 2.5) {
    // Compact gleaming hailstones
    pW = 0.018 + aSeed.x * 0.012;
    pL = 0.065;
  } else if (mode > 2.5) {
    // Soft suspended dust wisps
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    right = camRight;
    upAxis = camUp;
    pW = 0.048 + aSeed.x * 0.055;
    pL = pW * 1.4;
  }

  vec3 pos = basePos + right * (aQuad.x * pW) + upAxis * ((aQuad.y - 0.5) * pL);
  float dist = length(worldOffset);
  float distFade = (1.0 - smoothstep(2.2, 3.0, max(max(abs(worldOffset.x), abs(worldOffset.y)), abs(worldOffset.z)))) * smoothstep(0.45, 1.0, dist);
  vAlpha = distFade * activeStrength * (mode > 0.5 && mode < 1.5 ? 0.82 : (mode > 2.5 ? 0.28 : 0.52));
  vMode = mode;
  vQuad = aQuad;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const PRECIP_FRAG = /* glsl */ `
precision highp float;
uniform float uLightning;
uniform vec3 uSunColor;
uniform float uCloudBrightness;

varying vec2 vQuad;
varying float vAlpha;
varying float vMode;
#include <logdepthbuf_pars_fragment>

void main() {
  if (vAlpha < 0.01) discard;
  vec2 c = vec2(vQuad.x, vQuad.y * 2.0 - 1.0);
  float r2 = dot(c, c);
  float shape = 1.0;
  vec3 col = vec3(0.74, 0.82, 0.90);

  if (vMode < 0.5) {
    // Crisp tapered raindrop streak
    shape = (1.0 - abs(c.x)) * (1.0 - abs(c.y));
    col = mix(vec3(0.72, 0.80, 0.90), vec3(0.98, 0.99, 1.0), clamp(uLightning + uCloudBrightness * 0.35, 0.0, 1.0));
  } else if (vMode < 1.5) {
    // Soft luminous 3D snowflake crystal
    if (r2 > 1.0) discard;
    shape = pow(1.0 - r2, 1.6);
    col = mix(vec3(0.84, 0.90, 0.98), vec3(1.0, 1.0, 1.0), 0.55 + 0.45 * uCloudBrightness);
  } else if (vMode < 2.5) {
    // Hard gleaming ice hail pellet
    if (r2 > 1.0) discard;
    shape = smoothstep(1.0, 0.25, r2);
    col = vec3(0.88, 0.95, 1.0);
  } else {
    // Soft ochre desert sand/dust mote
    if (r2 > 1.0) discard;
    shape = pow(1.0 - r2, 2.2);
    col = vec3(0.82, 0.64, 0.42) * (0.45 + 0.55 * uCloudBrightness);
  }

  float a = vAlpha * shape;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
  #include <logdepthbuf_fragment>
}
`;

// ============================================================================
// 3. 3D SKY PHENOMENA: SPECTRAL RAINBOW ARCH & VOLUMETRIC AURORA BOREALIS
// ============================================================================
const PHENOM_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const PHENOM_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uRainbowStrength;
uniform float uAuroraStrength;
uniform sampler2D uMicroNoiseTex;

varying vec2 vUv;
varying vec3 vWorldPos;
#include <logdepthbuf_pars_fragment>

vec3 spectralColor(float t) {
  // Smooth physical 7-band rainbow spectrum (violet -> indigo -> blue -> cyan -> green -> yellow -> red)
  vec3 c = vec3(
    smoothstep(0.45, 0.85, t) + smoothstep(0.18, 0.0, t) * 0.35,
    sin(clamp(t, 0.0, 1.0) * 3.14159265),
    1.0 - smoothstep(0.28, 0.72, t)
  );
  return clamp(c, 0.0, 1.0);
}

void main() {
  if (uRainbowStrength > 0.02) {
    // Primary + faint secondary double spectral rainbow arch!
    float arcFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    float band1 = smoothstep(0.18, 0.34, vUv.y) * smoothstep(0.68, 0.50, vUv.y);
    float t1 = clamp((vUv.y - 0.22) / 0.42, 0.0, 1.0);
    float band2 = smoothstep(0.74, 0.82, vUv.y) * smoothstep(0.98, 0.89, vUv.y) * 0.32;
    float t2 = 1.0 - clamp((vUv.y - 0.74) / 0.24, 0.0, 1.0);
    vec3 col = spectralColor(t1) * band1 + spectralColor(t2) * band2;
    float a = (band1 * 0.42 + band2 * 0.28) * arcFade * uRainbowStrength;
    if (a < 0.008) discard;
    gl_FragColor = vec4(col, a);
    #include <logdepthbuf_fragment>
    return;
  }

  if (uAuroraStrength > 0.02) {
    // Silky undulating vertical geomagnetic-field aurora curtains (ZERO white-noise speckle!)
    float u = vUv.x;
    float v = vUv.y;
    float fold1 = sin(u * 14.0 + uTime * 0.35 + sin(u * 6.0 - uTime * 0.22) * 1.4);
    float fold2 = sin(u * 34.0 - uTime * 0.52 + fold1 * 2.1);
    float fold3 = sin(u * 78.0 + uTime * 0.85 + fold2 * 1.3);
    float rayStripes = clamp(0.45 + 0.28 * fold1 + 0.20 * fold2 + 0.14 * fold3, 0.0, 1.0);
    rayStripes = pow(rayStripes, 1.45);
    // Crisp luminous lower aurora ionization rim fading gracefully upward into violet ionosphere!
    float lowerEdge = v + 0.08 * fold1;
    float vertProfile = smoothstep(0.02, 0.22, lowerEdge) * pow(clamp(1.0 - lowerEdge, 0.0, 1.0), 1.05);
    float edgeFade = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);

    vec3 colLow  = vec3(0.08, 1.00, 0.56); // Oxygen 557.7 nm luminous emerald green
    vec3 colMid  = vec3(0.12, 0.84, 0.98); // High cyan-turquoise transition
    vec3 colHigh = vec3(0.76, 0.24, 0.98); // Upper 630 nm violet-magenta crown
    vec3 col = mix(colLow, colMid, smoothstep(0.24, 0.56, v));
    col = mix(col, colHigh, smoothstep(0.50, 0.88, v));

    float a = rayStripes * vertProfile * edgeFade * uAuroraStrength * 0.94;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col * 1.75, a);
    #include <logdepthbuf_fragment>
    return;
  }

  discard;
}
`;

function buildFloatingCloudsMesh(microNoiseTexture, atmoUniforms) {
  // 520 sculpted 3D volumetric lobes grouped into authentic multi-lobe cloud formations across 5 altitude layers!
  const TOTAL_LOBES = 520;
  const quadGeo = new THREE.PlaneGeometry(2.0, 2.0, 1, 1);
  const anchors = new Float32Array(TOTAL_LOBES * 4);
  const shapes = new Float32Array(TOTAL_LOBES * 4);

  let s = 20260901;
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };

  let idx = 0;
  const pushLobe = (x, y, z, layer, rx, ry, seed, bias) => {
    if (idx >= TOTAL_LOBES) return;
    const o4 = idx * 4;
    anchors[o4] = x;
    anchors[o4 + 1] = y;
    anchors[o4 + 2] = z;
    anchors[o4 + 3] = layer;
    shapes[o4] = rx;
    shapes[o4 + 1] = ry;
    shapes[o4 + 2] = seed;
    shapes[o4 + 3] = bias;
    idx++;
  };

  // Layer 0: Valley Mist & Rift Stratus Decks (18 formations × 4 lobes = 72 lobes at y = 240..660m local)
  for (let c = 0; c < 18; c++) {
    const cx = (rng() - 0.5) * 15000.0;
    const cz = (rng() - 0.5) * 15000.0;
    const cy = 240.0 + rng() * 420.0;
    const seed = rng();
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + seed * 5.0;
      const dist = (0.2 + rng() * 0.8) * 520.0;
      pushLobe(cx + Math.cos(ang) * dist, cy + (rng() - 0.5) * 65.0, cz + Math.sin(ang) * dist, 0.0, 560 + rng() * 380, 130 + rng() * 90, seed + k * 0.013, (rng() - 0.5) * 0.6);
    }
  }

  // Layer 1: Sculpted Sunlit Cumulus Humilis & Mediocris (34 multi-lobe 3D cloud clusters × 8 lobes = 272 lobes at y = 1,050..1,950m local!)
  for (let c = 0; c < 34; c++) {
    const cx = (rng() - 0.5) * 25000.0;
    const cz = (rng() - 0.5) * 25000.0;
    const cy = 1080.0 + rng() * 820.0;
    const seed = rng();
    const scale = 0.72 + rng() * 0.85;
    // 4 broad flat-bottom base lobes
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + seed * 6.28;
      const d = (240 + rng() * 260) * scale;
      pushLobe(cx + Math.cos(ang) * d, cy - 35.0 * scale, cz + Math.sin(ang) * d, 1.0, (440 + rng() * 220) * scale, (210 + rng() * 95) * scale, seed + k * 0.007, -0.65);
    }
    // 3 billowy mid-body lobes
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI * 2 + seed * 3.1 + 0.5;
      const d = (120 + rng() * 170) * scale;
      pushLobe(cx + Math.cos(ang) * d, cy + (95 + rng() * 90) * scale, cz + Math.sin(ang) * d, 1.0, (380 + rng() * 190) * scale, (240 + rng() * 110) * scale, seed + (k + 4) * 0.007, 0.25);
    }
    // 1 luminous cauliflower crown turret
    pushLobe(cx + (rng() - 0.5) * 140 * scale, cy + (210 + rng() * 120) * scale, cz + (rng() - 0.5) * 140 * scale, 1.0, (310 + rng() * 150) * scale, (250 + rng() * 120) * scale, seed + 0.06, 0.95);
  }

  // Layer 2: Orographic Lenticular & Summit Cap Clouds (12 clusters × 5 lobes = 60 lobes at y = 2,450..3,600m local!)
  for (let c = 0; c < 12; c++) {
    const cx = (rng() - 0.5) * 24000.0;
    const cz = (rng() - 0.5) * 24000.0;
    const cy = 2480.0 + rng() * 1080.0;
    const seed = rng();
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 + seed * 4.0;
      const d = k === 0 ? 0 : (280 + rng() * 260);
      pushLobe(cx + Math.cos(ang) * d, cy + (k === 0 ? 75 : -20 + rng() * 45), cz + Math.sin(ang) * d, 2.0, 620 + rng() * 340, 155 + rng() * 85, seed + k * 0.01, k === 0 ? 0.85 : -0.2);
    }
  }

  // Layer 3: Towering Cumulonimbus Storm Anvils (12 towers × 6 lobes = 72 lobes at y = 1,450..3,200m local!)
  for (let c = 0; c < 12; c++) {
    const cx = (rng() - 0.5) * 24000.0;
    const cz = (rng() - 0.5) * 24000.0;
    const cy = 1480.0 + rng() * 450.0;
    const seed = rng();
    for (let k = 0; k < 6; k++) {
      const hFrac = k / 5.0; // 0 dark brooding base -> 1 high glowing anvil top
      const spread = hFrac > 0.7 ? 420.0 : 240.0;
      const ang = k * 2.1 + seed * 6.0;
      pushLobe(
        cx + Math.cos(ang) * spread * (0.4 + rng() * 0.6),
        cy + hFrac * 1250.0,
        cz + Math.sin(ang) * spread * (0.4 + rng() * 0.6),
        3.0,
        (hFrac > 0.7 ? 780 : 540) + rng() * 240,
        (hFrac > 0.7 ? 260 : 380) + rng() * 140,
        seed + k * 0.011,
        hFrac * 2.0 - 1.0,
      );
    }
  }

  // Layer 4: High-Altitude Sunlit Cirrus Ice-Crystal Veils (remaining 44 lobes at y = 4,100..4,750m local!)
  while (idx < TOTAL_LOBES) {
    const cx = (rng() - 0.5) * 32000.0;
    const cz = (rng() - 0.5) * 32000.0;
    const cy = 4120.0 + rng() * 620.0;
    const seed = rng();
    pushLobe(cx, cy, cz, 4.0, 1450 + rng() * 950, 260 + rng() * 140, seed, 0.75);
  }

  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.index = quadGeo.index;
  instGeo.attributes.position = quadGeo.attributes.position;
  instGeo.attributes.uv = quadGeo.attributes.uv;
  instGeo.setAttribute('aCloudAnchor', new THREE.InstancedBufferAttribute(anchors, 4));
  instGeo.setAttribute('aCloudShape', new THREE.InstancedBufferAttribute(shapes, 4));
  instGeo.instanceCount = TOTAL_LOBES;

  const mat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uMicroNoiseTex: { value: microNoiseTexture },
      uCamPos: { value: new THREE.Vector3() },
      uCloudWindOffset: atmoUniforms.uCloudWindOffset,
      uCloudCoverage: atmoUniforms.uCloudCoverage,
      uStormTower: { value: 0.08 },
      uValleyMist: { value: 0.22 },
      uTime: atmoUniforms.uTime,
      uSunDir: atmoUniforms.uSunDir,
      uSunColor: atmoUniforms.uSunColor,
      uSkyZenith: atmoUniforms.uSkyZenith,
      uSkyHorizon: atmoUniforms.uSkyHorizon,
      uSkyGlow: atmoUniforms.uSkyGlow,
      uAerialFogColor: atmoUniforms.uAerialFogColor,
      uCloudBrightness: atmoUniforms.uCloudBrightness,
      uCloudDarkness: { value: 0.10 },
      uWeatherLightning: atmoUniforms.uWeatherLightning,
      uWeatherDust: atmoUniforms.uWeatherDust,
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(instGeo, mat);
  mesh.name = 'TERRENO_Floating3DVolumetricClouds';
  mesh.frustumCulled = false;
  mesh.renderOrder = 14;
  return { mesh, mat };
}

function buildPrecipitationVolume(atmoUniforms, count = 3000) {
  const verts = count * 4;
  const tris = count * 2;
  const positions = new Float32Array(verts * 3);
  const seeds = new Float32Array(verts * 3);
  const quads = new Float32Array(verts * 2);
  const indices = new Uint32Array(tris * 3);

  let s = 5510923;
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
  const corners = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
  for (let i = 0; i < count; i++) {
    const sx = rng(), sy = rng(), sz = rng();
    const v0 = i * 4;
    for (let k = 0; k < 4; k++) {
      const vi = v0 + k;
      seeds[vi * 3] = sx;
      seeds[vi * 3 + 1] = sy;
      seeds[vi * 3 + 2] = sz;
      quads[vi * 2] = corners[k][0];
      quads[vi * 2 + 1] = corners[k][1];
    }
    const i0 = i * 6;
    indices[i0] = v0;
    indices[i0 + 1] = v0 + 1;
    indices[i0 + 2] = v0 + 2;
    indices[i0 + 3] = v0;
    indices[i0 + 4] = v0 + 2;
    indices[i0 + 5] = v0 + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aQuad', new THREE.BufferAttribute(quads, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: PRECIP_VERT,
    fragmentShader: PRECIP_FRAG,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
      uTime: atmoUniforms.uTime,
      uWind: atmoUniforms.uWeatherWind,
      uRainRate: { value: 0.0 },
      uSnowRate: { value: 0.0 },
      uHailRate: { value: 0.0 },
      uDustRate: { value: 0.0 },
      uFreezingLocalY: { value: 2630.0 },
      uLightning: atmoUniforms.uWeatherLightning,
      uSunColor: atmoUniforms.uSunColor,
      uCloudBrightness: atmoUniforms.uCloudBrightness,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'TERRENO_WeatherPrecipitationVolume';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 24;
  return { mesh, mat };
}

function buildSkyPhenomenaMesh(microNoiseTexture, atmoUniforms) {
  // Curved giant sky arch/curtain ribbon positioned dynamically around the camera for Rainbows & Aurora Borealis!
  const segU = 40;
  const segV = 4;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const rad = 5200.0 + v * 1250.0;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const ang = (u - 0.5) * Math.PI * 0.92;
      const x = Math.sin(ang) * rad;
      const y = Math.cos(ang) * rad * 0.62 - 600.0;
      const z = -6200.0 + Math.cos(ang * 1.4) * 900.0;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    vertexShader: PHENOM_VERT,
    fragmentShader: PHENOM_FRAG,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uRainbowStrength: { value: 0.0 },
      uAuroraStrength: { value: 0.0 },
      uMicroNoiseTex: { value: microNoiseTexture },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'TERRENO_SkyPhenomena_RainbowAurora';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 15;
  return { mesh, mat };
}

export function createTerrenoWeatherClouds(geomorph, atmoUniforms, storm) {
  const group = new THREE.Group();
  group.name = 'TERRENO_3DCloudsAndWeather';

  const clouds = buildFloatingCloudsMesh(geomorph.microNoiseTexture, atmoUniforms);
  const precip = buildPrecipitationVolume(atmoUniforms, 3000);
  const phenom = buildSkyPhenomenaMesh(geomorph.microNoiseTexture, atmoUniforms);
  group.add(clouds.mesh);
  group.add(precip.mesh);
  group.add(phenom.mesh);

  // Forked 3D Lightning Bolt (visible ONLY on flashes during thunderstorm/hail!)
  const boltVerts = new Float32Array(18 * 3);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltVerts, 3));
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.0 });
  const boltLine = new THREE.Line(boltGeo, boltMat);
  boltLine.frustumCulled = false;
  boltLine.visible = false;
  boltLine.renderOrder = 26;
  group.add(boltLine);

  // Snapshot of base Time-Of-Day atmosphere so weather modulates cleanly without drift!
  const baseAtmo = {
    sunIntensity: atmoUniforms.uSunIntensity.value,
    hemiIntensity: atmoUniforms.uHemiIntensity.value,
    skyZenith: atmoUniforms.uSkyZenith.value.clone(),
    skyHorizon: atmoUniforms.uSkyHorizon.value.clone(),
    skyGlow: atmoUniforms.uSkyGlow.value.clone(),
    valleyFogColor: atmoUniforms.uValleyFogColor.value.clone(),
    aerialFogColor: atmoUniforms.uAerialFogColor.value.clone(),
    valleyFogDensity: atmoUniforms.uValleyFogDensity.value,
    aerialDensity: atmoUniforms.uAerialDensity.value,
    cloudBrightness: atmoUniforms.uCloudBrightness.value,
  };

  function captureBaseAtmosphere() {
    baseAtmo.sunIntensity = atmoUniforms.uSunIntensity.value;
    baseAtmo.hemiIntensity = atmoUniforms.uHemiIntensity.value;
    baseAtmo.skyZenith.copy(atmoUniforms.uSkyZenith.value);
    baseAtmo.skyHorizon.copy(atmoUniforms.uSkyHorizon.value);
    baseAtmo.skyGlow.copy(atmoUniforms.uSkyGlow.value);
    baseAtmo.valleyFogColor.copy(atmoUniforms.uValleyFogColor.value);
    baseAtmo.aerialFogColor.copy(atmoUniforms.uAerialFogColor.value);
    baseAtmo.valleyFogDensity = atmoUniforms.uValleyFogDensity.value;
    baseAtmo.aerialDensity = atmoUniforms.uAerialDensity.value;
    baseAtmo.cloudBrightness = atmoUniforms.uCloudBrightness.value;
  }

  let currentId = 'partly_cloudy';
  let targetPreset = WEATHER_BY_ID.get(currentId);
  let autoCycle = false;
  let autoCycleTimer = 180.0;
  let thunderCallback = null;

  // Live smoothly interpolated meteorological state
  const state = {
    cloudCoverage: targetPreset.cloudCoverage,
    cloudDarkness: targetPreset.cloudDarkness,
    stormTower: targetPreset.stormTower,
    valleyMist: targetPreset.valleyMist,
    rainRate: targetPreset.rainRate,
    snowRate: targetPreset.snowRate,
    hailRate: targetPreset.hailRate,
    dustRate: targetPreset.dustRate,
    fogMult: targetPreset.fogMult,
    sunMult: targetPreset.sunMult,
    hemiMult: targetPreset.hemiMult,
    windSpeedMs: targetPreset.windSpeedMs,
    windDirRad: (targetPreset.windDirDeg * Math.PI) / 180.0,
    seaLevelTempC: targetPreset.seaLevelTempC,
    freezingLevelM: targetPreset.freezingLevelM,
    pressureHpa: targetPreset.pressureHpa,
    humidity: targetPreset.humidity,
    wetness: targetPreset.wetness,
    snowAccum: targetPreset.snowAccum,
    lightningRate: targetPreset.lightningRate,
    rainbowStrength: targetPreset.rainbowStrength,
    auroraStrength: targetPreset.auroraStrength,
    skyTintR: targetPreset.skyTint[0],
    skyTintG: targetPreset.skyTint[1],
    skyTintB: targetPreset.skyTint[2],
    lightningFlash: 0.0,
    nextBoltSec: 4.5,
  };

  let windOffsetX = 0.0;
  let windOffsetZ = 0.0;
  const _tmpCol = new THREE.Color();

  function setWeather(id, instant = false) {
    if (id === 'auto') {
      autoCycle = true;
      autoCycleTimer = 120.0;
      return getState(0);
    }
    const p = WEATHER_BY_ID.get(id);
    if (!p) return getState(0);
    currentId = p.id;
    targetPreset = p;
    if (instant) {
      state.cloudCoverage = p.cloudCoverage;
      state.cloudDarkness = p.cloudDarkness;
      state.stormTower = p.stormTower;
      state.valleyMist = p.valleyMist;
      state.rainRate = p.rainRate;
      state.snowRate = p.snowRate;
      state.hailRate = p.hailRate;
      state.dustRate = p.dustRate;
      state.fogMult = p.fogMult;
      state.sunMult = p.sunMult;
      state.hemiMult = p.hemiMult;
      state.windSpeedMs = p.windSpeedMs;
      state.windDirRad = (p.windDirDeg * Math.PI) / 180.0;
      state.seaLevelTempC = p.seaLevelTempC;
      state.freezingLevelM = p.freezingLevelM;
      state.pressureHpa = p.pressureHpa;
      state.humidity = p.humidity;
      state.wetness = p.wetness;
      state.snowAccum = p.snowAccum;
      state.lightningRate = p.lightningRate;
      state.rainbowStrength = p.rainbowStrength;
      state.auroraStrength = p.auroraStrength;
      state.skyTintR = p.skyTint[0];
      state.skyTintG = p.skyTint[1];
      state.skyTintB = p.skyTint[2];
    }
    if (storm && storm.setStormEnabled) {
      const shouldStorm = p.id === 'thunderstorm';
      if (storm.isStormEnabled() !== shouldStorm) {
        storm.setStormEnabled(shouldStorm, instant);
      }
    }
    return getState(0);
  }

  function cycleWeather(instant = false) {
    const idx = WEATHER_TYPES.findIndex((w) => w.id === currentId);
    const next = WEATHER_TYPES[(idx + 1) % WEATHER_TYPES.length];
    autoCycle = false;
    return setWeather(next.id, instant);
  }

  function setAutoCycle(enabled) {
    autoCycle = Boolean(enabled);
    return autoCycle;
  }

  function triggerLightning(camPos) {
    state.lightningFlash = 1.0;
    const ang = Math.random() * Math.PI * 2;
    const dist = 320 + Math.random() * 1400;
    const bx = camPos.x + Math.cos(ang) * dist;
    const bz = camPos.z + Math.sin(ang) * dist;
    const gY = geomorph.getTerrainHeightAt ? geomorph.getTerrainHeightAt(bx, bz) : 0;
    const topY = Math.max(gY + 1100, 1450);
    const arr = boltGeo.attributes.position.array;
    for (let i = 0; i < 18; i++) {
      const f = i / 17;
      const jitter = Math.sin(f * Math.PI) * 58.0;
      arr[i * 3] = bx + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 1] = topY - f * (topY - gY);
      arr[i * 3 + 2] = bz + (Math.random() - 0.5) * jitter;
    }
    boltGeo.attributes.position.needsUpdate = true;
    boltLine.visible = true;
    if (thunderCallback) thunderCallback(dist);
  }

  const AUTO_SEQUENCE = [
    'clear', 'partly_cloudy', 'valley_mist', 'overcast', 'sunshower',
    'light_rain', 'heavy_rain', 'thunderstorm', 'partly_cloudy', 'snowfall', 'clear',
  ];
  let autoStep = 1;

  function update(cameraPos, dt, elapsed) {
    if (autoCycle) {
      autoCycleTimer -= dt;
      if (autoCycleTimer <= 0) {
        autoStep = (autoStep + 1) % AUTO_SEQUENCE.length;
        setWeather(AUTO_SEQUENCE[autoStep], false);
        autoCycleTimer = 140.0 + Math.random() * 90.0;
      }
    }

    const p = targetPreset;
    const k = Math.min(1.0, dt * 0.45);
    const kSlow = Math.min(1.0, dt * 0.22);

    state.cloudCoverage += (p.cloudCoverage - state.cloudCoverage) * k;
    state.cloudDarkness += (p.cloudDarkness - state.cloudDarkness) * k;
    state.stormTower += (p.stormTower - state.stormTower) * k;
    state.valleyMist += (p.valleyMist - state.valleyMist) * k;
    state.rainRate += (p.rainRate - state.rainRate) * k;
    state.snowRate += (p.snowRate - state.snowRate) * k;
    state.hailRate += (p.hailRate - state.hailRate) * k;
    state.dustRate += (p.dustRate - state.dustRate) * k;
    state.fogMult += (p.fogMult - state.fogMult) * k;
    state.sunMult += (p.sunMult - state.sunMult) * k;
    state.hemiMult += (p.hemiMult - state.hemiMult) * k;
    state.windSpeedMs += (p.windSpeedMs - state.windSpeedMs) * k;
    const targetDir = (p.windDirDeg * Math.PI) / 180.0;
    state.windDirRad += Math.atan2(Math.sin(targetDir - state.windDirRad), Math.cos(targetDir - state.windDirRad)) * k;
    state.seaLevelTempC += (p.seaLevelTempC - state.seaLevelTempC) * kSlow;
    state.freezingLevelM += (p.freezingLevelM - state.freezingLevelM) * kSlow;
    state.pressureHpa += (p.pressureHpa - state.pressureHpa) * kSlow;
    state.humidity += (p.humidity - state.humidity) * kSlow;
    state.wetness += (p.wetness - state.wetness) * kSlow;
    state.snowAccum += (p.snowAccum - state.snowAccum) * kSlow;
    state.lightningRate += (p.lightningRate - state.lightningRate) * k;
    state.rainbowStrength += (p.rainbowStrength - state.rainbowStrength) * k;
    state.auroraStrength += (p.auroraStrength - state.auroraStrength) * k;
    state.skyTintR += (p.skyTint[0] - state.skyTintR) * k;
    state.skyTintG += (p.skyTint[1] - state.skyTintG) * k;
    state.skyTintB += (p.skyTint[2] - state.skyTintB) * k;

    // Gusting real wind vector (drifts 3D clouds, bends forest canopy, slants rain/snow!)
    const gust = 1.0 + Math.sin(elapsed * 0.72) * 0.24 + Math.cos(elapsed * 1.85) * 0.14;
    const wx = Math.cos(state.windDirRad) * state.windSpeedMs * gust;
    const wz = Math.sin(state.windDirRad) * state.windSpeedMs * gust;
    windOffsetX += wx * dt * 2.8;
    windOffsetZ += wz * dt * 2.8;

    // Lightning cadence during active thunderstorms / hail squalls
    if (state.lightningRate > 0.05 && cameraPos) {
      state.nextBoltSec -= dt;
      if (state.nextBoltSec <= 0) {
        triggerLightning(cameraPos);
        state.nextBoltSec = (3.0 + Math.random() * 6.5) / Math.max(0.25, state.lightningRate);
      }
    }
    state.lightningFlash = Math.max(0.0, state.lightningFlash - dt * 4.5);
    if (state.lightningFlash > 0.06) {
      boltLine.visible = true;
      boltMat.opacity = state.lightningFlash * 0.95;
    } else {
      boltLine.visible = false;
    }

    // Push shared weather uniforms to ALL shaders (Clipmap Terrain, Forest Canopy, Clouds, Water!)
    atmoUniforms.uWeatherWetness.value = state.wetness;
    atmoUniforms.uWeatherSnowAccum.value = state.snowAccum;
    atmoUniforms.uWeatherWind.value.set(wx, Math.min(1.8, (state.windSpeedMs * gust) / 14.0), wz);
    atmoUniforms.uCloudCoverage.value = state.cloudCoverage;
    atmoUniforms.uCloudWindOffset.value.set(windOffsetX, windOffsetZ);
    atmoUniforms.uWeatherLightning.value = Math.max(state.lightningFlash, storm ? storm.getLightningFlash() : 0.0);
    atmoUniforms.uWeatherDust.value = state.dustRate;

    // Modulate shared atmosphere smoothly (only when storm isn't overriding directly)
    const stormActive = storm && storm.getIntensity() > 0.02;
    if (!stormActive) {
      const lBoost = state.lightningFlash * 2.1;
      atmoUniforms.uSunIntensity.value = baseAtmo.sunIntensity * state.sunMult + lBoost;
      atmoUniforms.uHemiIntensity.value = baseAtmo.hemiIntensity * state.hemiMult + lBoost * 0.4;
      atmoUniforms.uValleyFogDensity.value = baseAtmo.valleyFogDensity * state.fogMult;
      atmoUniforms.uAerialDensity.value = baseAtmo.aerialDensity * (0.7 + 0.3 * state.fogMult + state.dustRate * 2.2);
      atmoUniforms.uCloudBrightness.value = baseAtmo.cloudBrightness * (1.0 - state.cloudDarkness * 0.55) + lBoost * 0.25;

      _tmpCol.setRGB(state.skyTintR, state.skyTintG, state.skyTintB);
      atmoUniforms.uSkyZenith.value.copy(baseAtmo.skyZenith).multiply(_tmpCol);
      atmoUniforms.uSkyHorizon.value.copy(baseAtmo.skyHorizon).multiply(_tmpCol);
      atmoUniforms.uValleyFogColor.value.copy(baseAtmo.valleyFogColor).multiply(_tmpCol);
      atmoUniforms.uAerialFogColor.value.copy(baseAtmo.aerialFogColor).multiply(_tmpCol);
      if (state.dustRate > 0.05) {
        const dustCol = new THREE.Color(0.74, 0.54, 0.34);
        atmoUniforms.uValleyFogColor.value.lerp(dustCol, state.dustRate * 0.58);
        atmoUniforms.uAerialFogColor.value.lerp(dustCol, state.dustRate * 0.55);
        atmoUniforms.uSkyHorizon.value.lerp(dustCol, state.dustRate * 0.45);
      }
    }

    // Update Floating 3D Volumetric Clouds uniforms
    if (cameraPos) clouds.mat.uniforms.uCamPos.value.copy(cameraPos);
    clouds.mat.uniforms.uStormTower.value = state.stormTower;
    clouds.mat.uniforms.uValleyMist.value = state.valleyMist;
    clouds.mat.uniforms.uCloudDarkness.value = state.cloudDarkness;

    // Update GPU Precipitation Volume (avoid double-drawing rain when storm's own rain mesh is active!)
    const effRain = stormActive ? 0.0 : state.rainRate;
    const anyPrecip = effRain > 0.015 || state.snowRate > 0.015 || state.hailRate > 0.015 || state.dustRate > 0.015;
    precip.mesh.visible = anyPrecip;
    if (anyPrecip && cameraPos) {
      precip.mat.uniforms.uCamPos.value.copy(cameraPos);
      precip.mat.uniforms.uRainRate.value = effRain;
      precip.mat.uniforms.uSnowRate.value = state.snowRate;
      precip.mat.uniforms.uHailRate.value = state.hailRate;
      precip.mat.uniforms.uDustRate.value = state.dustRate;
      precip.mat.uniforms.uFreezingLocalY.value = state.freezingLevelM - TERRENO_WORLD.baseElevationASL;
    }

    // Update 3D Spectral Rainbow Arch / Volumetric Aurora Borealis Curtain
    const anyPhenom = state.rainbowStrength > 0.02 || state.auroraStrength > 0.02;
    phenom.mesh.visible = anyPhenom;
    if (anyPhenom && cameraPos) {
      phenom.mat.uniforms.uRainbowStrength.value = state.rainbowStrength;
      phenom.mat.uniforms.uAuroraStrength.value = state.auroraStrength;
      if (state.rainbowStrength > 0.02) {
        // Orient rainbow strictly anti-solar across the mountain sky at natural 14-26 deg elevation!
        const sd = atmoUniforms.uSunDir.value;
        phenom.mesh.position.set(cameraPos.x, cameraPos.y - 1350.0, cameraPos.z);
        phenom.mesh.rotation.set(0, Math.atan2(sd.x, sd.z), 0);
      } else {
        // Aurora Borealis drapes majestically high above the northern 4,000m Alpine massif!
        phenom.mesh.position.set(cameraPos.x, cameraPos.y - 820.0, cameraPos.z);
        phenom.mesh.rotation.set(0.0, 0.0, 0.0);
      }
      phenom.mesh.updateMatrixWorld(true);
    }
  }

  function getState(localY = 0) {
    const asl = TERRENO_WORLD.baseElevationASL + localY;
    const localTempC = Math.round((state.seaLevelTempC - (asl / 1000.0) * 6.5) * 10) / 10;
    const freezingAtAlt = asl >= state.freezingLevelM;
    return {
      id: currentId,
      nameJp: targetPreset.nameJp,
      descJp: targetPreset.descJp,
      autoCycle,
      localTempC,
      seaLevelTempC: Math.round(state.seaLevelTempC * 10) / 10,
      freezingLevelM: Math.round(state.freezingLevelM),
      pressureHpa: Math.round(state.pressureHpa),
      humidityPct: Math.round(state.humidity * 100),
      windSpeedMs: Math.round(state.windSpeedMs * 10) / 10,
      windDirDeg: Math.round(((state.windDirRad * 180) / Math.PI + 360) % 360),
      cloudCoveragePct: Math.round(state.cloudCoverage * 100),
      wetness: Math.round(state.wetness * 100) / 100,
      snowAccum: Math.round(state.snowAccum * 100) / 100,
      rainRate: freezingAtAlt ? 0 : Math.round(state.rainRate * 100) / 100,
      snowRate: Math.round((freezingAtAlt ? Math.max(state.snowRate, state.rainRate) : state.snowRate) * 100) / 100,
      hailRate: Math.round(state.hailRate * 100) / 100,
      dustRate: Math.round(state.dustRate * 100) / 100,
      rainbowStrength: Math.round(state.rainbowStrength * 100) / 100,
      auroraStrength: Math.round(state.auroraStrength * 100) / 100,
      cloudLobeCount: 520,
      cloudLayers: 5,
      weatherTypeCount: WEATHER_TYPES.length,
    };
  }

  return {
    group,
    catalog: WEATHER_TYPES,
    setWeather,
    cycleWeather,
    setAutoCycle,
    captureBaseAtmosphere,
    setThunderCallback: (cb) => { thunderCallback = cb; },
    getState,
    getWeatherId: () => currentId,
    isAutoCycle: () => autoCycle,
    update,
  };
}
