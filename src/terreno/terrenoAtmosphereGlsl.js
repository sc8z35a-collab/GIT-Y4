import * as THREE from 'three';
import { ATMOSPHERE_PRESETS, TERRENO_WORLD } from './terrenoConfig.js';

/**
 * TERRENO Engine v2 — Breakthrough TR-VOLUMETRIC-ATMO & TR-KOMOREBI:
 *   1. Exact Analytical Exponential Height-Fog Integral + 5-Step Horizon-Map Volumetric
 *      Sea-of-Clouds (雲海) & Sunbeam God-Ray Ray-Marcher!
 *      Samples the precomputed dual-azimuth Mountain Horizon Atlas along the view ray so
 *      sunlit valley mist billows glow creamy gold while shadowed gorges stay deep atmospheric indigo!
 *   2. Multi-Layer Rayleigh Blue Mountain Haze (遠山霞) + Dual-Lobe Henyey-Greenstein Mie Scattering
 *   3. Sun-Aligned Animated Forest Canopy Dappled Sunlight (木漏れ日 / TR-KOMOREBI) shared
 *      across Terrain, Mossy Boulders, Nurse Logs, Bark, Ferns, Grass, and Kumazasa Bamboo!
 */

export function createSharedAtmosphereUniforms(initialPresetId = 'night', geomorph = null) {
  const p = ATMOSPHERE_PRESETS[initialPresetId] || ATMOSPHERE_PRESETS.night;
  const sunVec = new THREE.Vector3(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();
  return {
    uTime: { value: 0.0 },
    uSunDir: { value: sunVec },
    uSunColor: { value: new THREE.Color(p.sunColor[0], p.sunColor[1], p.sunColor[2]) },
    uSunIntensity: { value: p.sunIntensity },
    uHemiSkyColor: { value: new THREE.Color(p.hemiSky) },
    uHemiGroundColor: { value: new THREE.Color(p.hemiGround) },
    uHemiIntensity: { value: p.hemiIntensity },
    uSkyZenith: { value: new THREE.Color(p.skyZenith[0], p.skyZenith[1], p.skyZenith[2]) },
    uSkyHorizon: { value: new THREE.Color(p.skyHorizon[0], p.skyHorizon[1], p.skyHorizon[2]) },
    uSkyGlow: { value: new THREE.Color(p.skyGlow[0], p.skyGlow[1], p.skyGlow[2]) },
    uValleyFogColor: { value: new THREE.Color(p.valleyFogColor[0], p.valleyFogColor[1], p.valleyFogColor[2]) },
    uAerialFogColor: { value: new THREE.Color(p.aerialFogColor[0], p.aerialFogColor[1], p.aerialFogColor[2]) },
    uValleyFogDensity: { value: p.valleyFogDensity },
    uValleyFogFalloff: { value: p.valleyFogFalloff },
    uValleyFogBaseY: { value: p.valleyFogBaseY },
    uAerialDensity: { value: p.aerialDensity },
    uMieStrength: { value: p.mieStrength },
    uStarIntensity: { value: p.starIntensity },
    uCloudBrightness: { value: p.cloudBrightness },
    uHorizonShadowBlend: { value: p.horizonShadowBlend },
    uUseEastHorizon: { value: p.useEastHorizon },
    // Shared Mountain Horizon Atlas for Volumetric Valley God-Rays & Cloud-Sea Self-Shadowing!
    uAtmoHorizonMap: { value: geomorph ? geomorph.horizonTexture : null },
    uAtmoWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
    uAtmoWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
    uAtmoAtlasSize: { value: new THREE.Vector2(geomorph ? geomorph.W : 512, geomorph ? geomorph.H : 1536) },
    // Player flashlight cone (for seamless night exploration outdoors!)
    uFlashPos: { value: new THREE.Vector3(0, -999, 0) },
    uFlashDir: { value: new THREE.Vector3(0, 0, -1) },
    uFlashIntensity: { value: 0.0 },
    // TERRENO 9.0 Shared Live Weather & 3D Floating Cloud Shadow Uniforms
    uWeatherWetness: { value: 0.0 },
    uWeatherSnowAccum: { value: 0.0 },
    uWeatherWind: { value: new THREE.Vector3(3.2, 0.35, 2.2) },
    uCloudCoverage: { value: 0.50 },
    uCloudWindOffset: { value: new THREE.Vector2(0.0, 0.0) },
    uWeatherLightning: { value: 0.0 },
    uWeatherDust: { value: 0.0 },
    // TERRENO 9.0 Ultra-Lightweight Strict 6m × 6m × 6m Dynamic Animation Bubble (±3.0m around player!)
    uPlayerBubbleCenter: { value: new THREE.Vector3(0.0, 1.2, 0.0) },
    uAnimBubbleHalf: { value: 3.0 },
  };
}

export function applyAtmospherePresetToUniforms(u, presetId) {
  const p = ATMOSPHERE_PRESETS[presetId] || ATMOSPHERE_PRESETS.night;
  u.uSunDir.value.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();
  u.uSunColor.value.setRGB(p.sunColor[0], p.sunColor[1], p.sunColor[2]);
  u.uSunIntensity.value = p.sunIntensity;
  u.uHemiSkyColor.value.setHex(p.hemiSky);
  u.uHemiGroundColor.value.setHex(p.hemiGround);
  u.uHemiIntensity.value = p.hemiIntensity;
  u.uSkyZenith.value.setRGB(p.skyZenith[0], p.skyZenith[1], p.skyZenith[2]);
  u.uSkyHorizon.value.setRGB(p.skyHorizon[0], p.skyHorizon[1], p.skyHorizon[2]);
  u.uSkyGlow.value.setRGB(p.skyGlow[0], p.skyGlow[1], p.skyGlow[2]);
  u.uValleyFogColor.value.setRGB(p.valleyFogColor[0], p.valleyFogColor[1], p.valleyFogColor[2]);
  u.uAerialFogColor.value.setRGB(p.aerialFogColor[0], p.aerialFogColor[1], p.aerialFogColor[2]);
  u.uValleyFogDensity.value = p.valleyFogDensity;
  u.uValleyFogFalloff.value = p.valleyFogFalloff;
  u.uValleyFogBaseY.value = p.valleyFogBaseY;
  u.uAerialDensity.value = p.aerialDensity;
  u.uMieStrength.value = p.mieStrength;
  u.uStarIntensity.value = p.starIntensity;
  u.uCloudBrightness.value = p.cloudBrightness;
  u.uHorizonShadowBlend.value = p.horizonShadowBlend;
  u.uUseEastHorizon.value = p.useEastHorizon;
  return p;
}

export const TERRENO_ATMO_UNIFORMS_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uHemiSkyColor;
uniform vec3 uHemiGroundColor;
uniform float uHemiIntensity;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGlow;
uniform vec3 uValleyFogColor;
uniform vec3 uAerialFogColor;
uniform float uValleyFogDensity;
uniform float uValleyFogFalloff;
uniform float uValleyFogBaseY;
uniform float uAerialDensity;
uniform float uMieStrength;
uniform float uHorizonShadowBlend;
uniform float uUseEastHorizon;
uniform sampler2D uAtmoHorizonMap;
uniform vec2 uAtmoWorldMin;
uniform vec2 uAtmoWorldSize;
uniform vec2 uAtmoAtlasSize;
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashIntensity;
uniform float uWeatherWetness;
uniform float uWeatherSnowAccum;
uniform vec3 uWeatherWind;
uniform float uCloudCoverage;
uniform vec2 uCloudWindOffset;
uniform float uWeatherLightning;
uniform float uWeatherDust;
uniform vec3 uPlayerBubbleCenter;
uniform float uAnimBubbleHalf;
`;

export const TERRENO_ATMO_FUNCTIONS_GLSL = /* glsl */ `
float atmoHash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float atmoNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(atmoHash21(i), atmoHash21(i + vec2(1.0, 0.0)), u.x),
    mix(atmoHash21(i + vec2(0.0, 1.0)), atmoHash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fast 2-octave drifting billowing valley cloud-sea noise (雲海)
float atmoCloudSeaDensity(vec3 p) {
  vec2 drift = vec2(uTime * 3.8, -uTime * 1.9);
  float n1 = atmoNoise2((p.xz + drift) * 0.00135);
  float n2 = atmoNoise2((p.xz * 2.15 - drift * 1.4) * 0.00165 + vec2(p.y * 0.012, -p.y * 0.009));
  float billow = smoothstep(0.28, 0.84, n1 * 0.65 + n2 * 0.35);
  return billow;
}

// TR-KOMOREBI: Sun-Aligned Animated Forest Canopy Dappled Sunlight (木漏れ日)!
// Returns direct-sunlight transmission factor (0.28 deep bough shade .. 1.18 luminous golden sun fleck)
float evalKomorebiDapple(vec3 worldPos, float canopyDensity, vec3 sunDir, float camDist) {
  float distFade = 1.0 - smoothstep(65.0, 185.0, camDist);
  float activeCanopy = smoothstep(0.14, 0.55, canopyDensity) * distFade;
  if (activeCanopy <= 0.005) return 1.0;

  // Keep NARROW-50 central sunlit courtyard lightly open, dappling naturally into surrounding cedar ring
  float dComp = length(worldPos.xz - vec2(1.5, 3.5));
  activeCanopy *= smoothstep(11.0, 26.0, dComp);
  if (activeCanopy <= 0.005) return 1.0;

  vec2 sunProj = worldPos.xz + sunDir.xz / max(sunDir.y, 0.24) * 11.5;
  vec2 windShift = vec2(sin(uTime * 0.72 + sunProj.y * 0.08), cos(uTime * 0.58 + sunProj.x * 0.08)) * 0.42;
  vec2 p = sunProj + windShift;

  float crownGap = atmoNoise2(p * 0.16);
  float twigGap  = atmoNoise2(p * 0.54 + vec2(17.3, -11.9));
  float leafFleck = atmoNoise2(p * 1.45 - vec2(4.7, 23.1));

  float rawLight = crownGap * 0.52 + twigGap * 0.33 + leafFleck * 0.15;
  // Crisp pools of golden sunlight breaking through velvety shadowed Japanese cedar groves
  float dapple = mix(0.26, 1.24, smoothstep(0.36, 0.70, rawLight));
  return mix(1.0, dapple, activeCanopy * 0.86);
}

// Exact Analytical Exponential Height-Fog + 5-Step Horizon-Shadowed Volumetric Sea-of-Clouds (雲海) & God-Rays!
vec3 applyTerrenoAtmosphere(vec3 surfaceCol, vec3 worldPos, vec3 camPos) {
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 rayDir = toFrag / max(dist, 0.0001);
  vec3 sunDir = normalize(uSunDir);

  // 1. Exact Analytical Exponential Height-Fog Integral baseline
  float B = max(uValleyFogFalloff, 0.0005);
  float y0 = camPos.y - uValleyFogBaseY;
  float y1 = worldPos.y - uValleyFogBaseY;
  float dy = y1 - y0;
  float e0 = exp(-clamp(B * y0, -3.5, 22.0));
  float e1 = exp(-clamp(B * y1, -3.5, 22.0));
  float tauValley;
  if (abs(B * dy) > 0.002) {
    tauValley = uValleyFogDensity * dist * (e0 - e1) / (B * dy);
  } else {
    tauValley = uValleyFogDensity * dist * 0.5 * (e0 + e1);
  }
  tauValley = clamp(tauValley, 0.0, 12.0);
  float valleyFog = 1.0 - exp(-tauValley);

  // 2. Long-range Rayleigh Blue Mountain Aerial Perspective (遠山霞 across 2km..19km ridges!)
  float avgAlt = max(0.0, 0.5 * (camPos.y + worldPos.y));
  float altThin = exp(-avgAlt * 0.00052);
  float tauAerial = uAerialDensity * dist * altThin;
  float aerialFog = 1.0 - exp(-clamp(tauAerial, 0.0, 8.0));

  // 3. Forward Henyey-Greenstein Dual-Lobe Mie Scattering
  float cosTheta = max(0.0, dot(rayDir, sunDir));
  float miePhase = pow(cosTheta, 4.5) * 0.58 + pow(cosTheta, 24.0) * 0.62;
  vec3 mieTint = uSkyGlow * (miePhase * uMieStrength);

  // 4. BREAKTHROUGH TR-VOLUMETRIC-ATMO: 5-Step Horizon-Map Volumetric Sea-of-Clouds & God-Ray March!
  //    Active beyond 75m so near-field fillrate stays ultra-fast while 100m..18km valleys bloom with 3D cloud wisps!
  float volWeight = smoothstep(75.0, 320.0, dist);
  vec3 volScatter = vec3(0.0);
  float volTrans = 1.0;
  float avgSunVis = 0.72;

  if (volWeight > 0.01) {
    float marchDist = min(dist, 24000.0);
    float dStep = marchDist / 5.0;
    // Screen-space interleaved gradient dither removes any 5-step banding cleanly
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float sunVisSum = 0.0;

    for (int i = 0; i < 5; i++) {
      float t = (float(i) + 0.18 + jitter * 0.68) * dStep;
      vec3 sp = camPos + rayDir * t;

      // Altitude envelope for gentle drifting lowland & valley mist
      float hRel = sp.y - uValleyFogBaseY;
      float altBand = exp(-max(0.0, hRel) * B * 0.92) * smoothstep(-140.0, 25.0, hRel);
      float billow = atmoCloudSeaDensity(sp);

      // Query precomputed Horizon Shadow Atlas
      vec2 hUV = (((sp.xz - uAtmoWorldMin) / uAtmoWorldSize) * (uAtmoAtlasSize - 1.0) + 0.5) / uAtmoAtlasSize;
      vec4 hz = texture2D(uAtmoHorizonMap, clamp(hUV, 0.001, 0.999));
      float horzSin = mix(hz.g, hz.r, uUseEastHorizon);
      float sunVis = mix(1.0, smoothstep(horzSin - 0.035, horzSin + 0.085, sunDir.y), uHorizonShadowBlend);
      sunVisSum += sunVis;

      float sigma = uValleyFogDensity * altBand * billow * 1.45;
      float segExt = 1.0 - exp(-sigma * dStep);

      vec3 shadowMistCol = mix(uAerialFogColor * 0.72, uValleyFogColor * 0.52, 0.45);
      vec3 sunlitMistCol = uValleyFogColor * 1.14 + mieTint * 0.82;
      vec3 stepCol = mix(shadowMistCol, sunlitMistCol, sunVis);

      volScatter += volTrans * stepCol * segExt;
      volTrans *= (1.0 - segExt * 0.82);
    }
    avgSunVis = sunVisSum * 0.2;
  }

  vec3 shadowedValley = mix(uAerialFogColor * 0.74, uValleyFogColor * 0.58, 0.50);
  vec3 sunlitValley   = uValleyFogColor * 1.06 + mieTint * 0.58;
  vec3 valleyCol = mix(shadowedValley, sunlitValley, mix(0.68, avgSunVis, volWeight));

  vec3 col = mix(surfaceCol, valleyCol, valleyFog * 0.86);
  col = mix(col, col * volTrans + volScatter, volWeight * 0.88);

  // Distant horizons blend seamlessly into sky across 60 km countryside
  float horizonBlend = smoothstep(10000.0, 54000.0, dist);
  vec3 aerialCol = mix(uAerialFogColor, uSkyHorizon, horizonBlend * 0.62) + mieTint * 0.74;
  col = mix(col, aerialCol, aerialFog);

  return col;
}

// Fast 1-Tap Volumetric Atmosphere for High-Overdraw Alpha-Cutout Foliage, Grass & Impostors (4x Mobile GPU Speedup!)
vec3 applyTerrenoAtmosphereFast(vec3 surfaceCol, vec3 worldPos, vec3 camPos) {
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 rayDir = toFrag / max(dist, 0.0001);
  vec3 sunDir = normalize(uSunDir);

  float B = max(uValleyFogFalloff, 0.0005);
  float y0 = camPos.y - uValleyFogBaseY;
  float y1 = worldPos.y - uValleyFogBaseY;
  float dy = y1 - y0;
  float e0 = exp(-clamp(B * y0, -3.5, 22.0));
  float e1 = exp(-clamp(B * y1, -3.5, 22.0));
  float tauValley = abs(B * dy) > 0.002
    ? uValleyFogDensity * dist * (e0 - e1) / (B * dy)
    : uValleyFogDensity * dist * 0.5 * (e0 + e1);
  float valleyFog = 1.0 - exp(-clamp(tauValley, 0.0, 12.0));

  float avgAlt = max(0.0, 0.5 * (camPos.y + worldPos.y));
  float tauAerial = uAerialDensity * dist * exp(-avgAlt * 0.00052);
  float aerialFog = 1.0 - exp(-clamp(tauAerial, 0.0, 8.0));

  float cosTheta = max(0.0, dot(rayDir, sunDir));
  float miePhase = pow(cosTheta, 4.5) * 0.58 + pow(cosTheta, 24.0) * 0.62;
  vec3 mieTint = uSkyGlow * (miePhase * uMieStrength);

  float sunVis = 0.72;
  if (dist > 75.0) {
    vec3 midP = 0.5 * (camPos + worldPos);
    vec2 hUV = (((midP.xz - uAtmoWorldMin) / uAtmoWorldSize) * (uAtmoAtlasSize - 1.0) + 0.5) / uAtmoAtlasSize;
    vec4 hz = texture2D(uAtmoHorizonMap, clamp(hUV, 0.001, 0.999));
    float horzSin = mix(hz.g, hz.r, uUseEastHorizon);
    sunVis = mix(1.0, smoothstep(horzSin - 0.035, horzSin + 0.085, sunDir.y), uHorizonShadowBlend);
  }
  vec3 shadowedValley = mix(uAerialFogColor * 0.74, uValleyFogColor * 0.58, 0.50);
  vec3 sunlitValley   = uValleyFogColor * 1.08 + mieTint * 0.60;
  vec3 valleyCol = mix(shadowedValley, sunlitValley, sunVis);

  vec3 col = mix(surfaceCol, valleyCol, valleyFog * 0.92);
  float horizonBlend = smoothstep(10000.0, 54000.0, dist);
  vec3 aerialCol = mix(uAerialFogColor, uSkyHorizon, horizonBlend * 0.62) + mieTint * 0.74;
  col = mix(col, aerialCol, aerialFog);
  return col;
}

// Smooth Outdoor Flashlight Beam Contribution (matches NARROW-50's [F] tactical torch!)
vec3 evalTerrenoFlashlight(vec3 worldPos, vec3 N, vec3 albedo) {
  if (uFlashIntensity <= 0.001) return vec3(0.0);
  vec3 L = uFlashPos - worldPos;
  float d = length(L);
  if (d > 58.0) return vec3(0.0);
  vec3 lDir = L / max(d, 0.001);
  float spotCos = dot(-lDir, normalize(uFlashDir));
  float cone = smoothstep(0.76, 0.94, spotCos);
  float atten = 1.0 / (1.0 + 0.025 * d + 0.0065 * d * d);
  float ndl = max(0.0, dot(N, lDir));
  return albedo * vec3(1.0, 0.94, 0.82) * (uFlashIntensity * cone * atten * ndl * 0.95);
}
`;
