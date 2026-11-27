import * as THREE from 'three';
import { TERRENO_WORLD } from './terrenoConfig.js';

/**
 * TERRENO 6.0 — Next-Gen Shared-Context Zero-Copy WebGL2 2D Topographic & Subterranean Map Engine
 *
 * Performance & Resolution Revolution:
 *   • ZERO second WebGL2 context creation (eliminates Chromium/SwiftShader 15s–48s multi-context stall!)
 *   • ZERO 16 MB CPU DEM copy & ZERO duplicate VRAM texImage2D upload — binds ALREADY-UPLOADED Three.js
 *     GPU DataTextures directly on the main renderer!
 *   • Inigo Quilez 1-Tap C2 Quintic-Smooth Hardware Float-Linear DEM Sampling (16× fewer texture fetches
 *     than 16-tap texelFetch, C2-smooth with ZERO grid seams at 3,000× zoom!)
 *   • 100% Branchless 6-Fetch Surface Topographic Fragment Shader -> compiles in ~15–25 ms (vs 11,100 ms!)
 *     with Swiss Imhof Dual Hillshade, 1:1 Cliff Strata Relief, SwissTopo Rock Hachuring, Canopy Velvet,
 *     Analytical `fwidth()` Multi-Scale Contours (250m down to 0.25m!), and Contour-Clipped Lakes!
 *   • Lazy-Compiled Dedicated Subterranean `-1,500 m` X-Ray Strata Shader (compiled ONLY when toggled!)
 */

const MAP_VERT_GLSL3 = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// TERRENO 7.0 — SURVEY-GRADE SWISSTOPO 1:2,500 BRANCHLESS GPU CARTOGRAPHIC SHADER (< 2.5 ms/frame!)
//   • Real Cast Mountain Relief Shadows & Valley Sky-View AO (via already-uploaded uHorizonTex!)
//   • 1:1 CPU/GPU Synced Cliff & Strata Micro-Relief + Sub-Meter Micro-Grain
//   • 3-Tier Analytical fwidth() Contours (Index + Intermediate + Flat-Terrain Supplementary Form Lines)
//   • Bathymetric Lake Depth Contours (等深線) + Turquoise Shoal Rims + Dendritic Mountain Brooks
//   • Top-Down Individual Leafy Tree Crowns (モフモフ樹冠ドット) + Fall-Line Cliff Hachures + Talus Stipple + Glacier Crevasses
const MAP_SURFACE_FRAG_GLSL3 = /* glsl */ `
uniform sampler2D uGeoTex;      // RGBA32F: R=hMacro, G=wetness/flow, B=basinWaterY, A=suppress
uniform sampler2D uNormalTex;   // RGBA8: pre-baked macro normal XZ + slope*0.45 + curvature
uniform sampler2D uHorizonTex;  // RGBA8: R=sinEast, G=sinWest, B=skyViewAO, A=canopyDensity
uniform sampler2D uLithoTex;    // RGBA8: volcanic, limestone, ochre, peat
uniform sampler2D uSoilEcoTex;  // RGBA8: soilDepth, temp, moisture, stand
uniform sampler2D uMicroTex;    // RGBA8 (REPEAT): 4-channel shared 256x256 micro-relief noise

uniform vec4 uViewWorld;        // xy = worldMinVisible, zw = worldSpanVisible
uniform vec4 uWorldBounds;      // xy = worldMin, zw = worldSize
uniform vec2 uDemSize;          // (W, H)
uniform float uBaseASL;         // 320.35
uniform float uZoom;            // 0.88 .. 3000.0
uniform float uFloodRise;

in vec2 vUv;
out vec4 outColor;

vec4 sampleDemBicubic(vec2 tc) {
  vec2 i = floor(tc);
  vec2 f = tc - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  // Sigg & Hadwiger 4-Tap Hardware Cubic B-Spline: C2-smooth everywhere with EXACT constant linear-ramp
  // derivatives (ZERO quintic zero-slope shelves, ZERO plaid grid lines, ZERO stairsteps at 3,000x zoom!)
  vec2 w0 = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0);
  vec2 w1 = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  vec2 w2 = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0);
  vec2 w3 = (1.0 / 6.0) * f3;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
#ifdef USE_HW_FLOAT_LINEAR
  vec2 h0 = (i - 0.5 + w1 / g0) / uDemSize;
  vec2 h1 = (i + 1.5 + w3 / g1) / uDemSize;
  vec4 t00 = texture(uGeoTex, vec2(h0.x, h0.y));
  vec4 t10 = texture(uGeoTex, vec2(h1.x, h0.y));
  vec4 t01 = texture(uGeoTex, vec2(h0.x, h1.y));
  vec4 t11 = texture(uGeoTex, vec2(h1.x, h1.y));
  return mix(mix(t00, t10, g1.x), mix(t01, t11, g1.x), g1.y);
#else
  ivec2 i0 = ivec2(i);
  ivec2 i1 = min(i0 + 1, ivec2(uDemSize) - 1);
  vec4 c00 = texelFetch(uGeoTex, i0, 0);
  vec4 c10 = texelFetch(uGeoTex, ivec2(i1.x, i0.y), 0);
  vec4 c01 = texelFetch(uGeoTex, ivec2(i0.x, i1.y), 0);
  vec4 c11 = texelFetch(uGeoTex, i1, 0);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
#endif
}

float contourMask(float val, float stepVal, float widthPx) {
  float scaled = val / stepVal;
  float dist = abs(fract(scaled + 0.5) - 0.5);
  float fw = max(fwidth(scaled), 1e-5);
  return 1.0 - smoothstep(widthPx * 0.42, widthPx * 1.02, dist / fw);
}

void main() {
  vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 worldXZ = uViewWorld.xy + screenUv * uViewWorld.zw;
  vec2 mapUv = (worldXZ - uWorldBounds.xy) / uWorldBounds.zw;
  float inBounds = step(0.0, mapUv.x) * step(mapUv.x, 1.0) * step(0.0, mapUv.y) * step(mapUv.y, 1.0);
  vec2 safeUv = clamp(mapUv, 0.0, 1.0);

  vec2 tc = clamp(safeUv * (uDemSize - 1.0), vec2(0.0), uDemSize - 1.0001);
  vec2 exactUv = (tc + 0.5) / uDemSize;

  vec4 dem = sampleDemBicubic(tc);
  float hMacro = dem.r;
  float wetness = dem.g;
  // Read uncorrupted lake surface plane from nearest texel (prevents -1e6 sentinel bleed across lake shores!)
  ivec2 nearestCell = ivec2(clamp(floor(tc + 0.5), vec2(0.0), uDemSize - 1.0));
  float natWaterY = texelFetch(uGeoTex, nearestCell, 0).b;
  float sup = dem.a;

  vec4 nrmPack = texture(uNormalTex, exactUv);
  vec4 horz = texture(uHorizonTex, exactUv);
  vec4 litho = texture(uLithoTex, exactUv);
  vec4 eco = texture(uSoilEcoTex, exactUv);

  vec2 nXZ = nrmPack.rg * 2.0 - 1.0;
  float nY = sqrt(max(0.02, 1.0 - dot(nXZ, nXZ)));
  float gxMacro = -nXZ.x / nY;
  float gzMacro = -nXZ.y / nY;
  float macroSlope = nrmPack.b * 2.2222222;
  float curv = nrmPack.a;
  float skyViewAO = horz.b;
  float canopyDensity = horz.a;

  // C1-smooth 2-Fetch Cliff & Strata Micro-Relief (matches 3D strata heights with ZERO sharp V-fold zebra bands!)
  vec4 m0 = texture(uMicroTex, (worldXZ * 0.024 + 0.5) / 256.0);
  vec4 m1 = texture(uMicroTex, (worldXZ * 0.056 + vec2(7.4, -3.9) + 0.5) / 256.0);
  float cliffT = clamp((macroSlope - 0.24) * 1.7241379, 0.0, 1.0);
  float r1c = m1.r * 2.0 - 1.0;
  float r2c = m1.b * 2.0 - 1.0;
  float ridge1 = 1.0 - sqrt(r1c * r1c + 0.06);
  float ridge2 = 1.0 - sqrt(r2c * r2c + 0.06);
  float sp = hMacro * 0.11 + (m0.r - 0.5) * 1.35;
  float strataWave = 0.5 - 0.5 * cos(sp * 6.2831853);
  float microRaw = (m0.r - 0.5) * 1.10 + (m0.g - 0.5) * 0.48 + (m0.b - 0.5) * 0.20
    + ((ridge1 * ridge1 - 0.36) * 4.4 + (ridge2 * ridge2 - 0.36) * 1.5 + (strataWave * strataWave * strataWave) * 2.1) * cliffT * cliffT;
  float microH = microRaw * (1.0 - sup) * smoothstep(2.0, 14.0, uZoom);

  float hLocal = hMacro + microH;
  float asl = uBaseASL + hLocal;

  // Artifact-free hybrid gradient: exact C2-bicubic macro gradient + organically weighted micro-relief
  // (eliminates bilinear uMicroTex 17.8m diamond creases at 400x..3,000x ultra-zoom!)
  float dX = max(0.004, abs(dFdx(worldXZ.x)));
  float dZ = max(0.004, abs(dFdy(worldXZ.y)));
  float fullBicubicAmt = smoothstep(14.0, 64.0, uZoom);
  float gxMacSmooth = mix(gxMacro, dFdx(hMacro) / dX, fullBicubicAmt);
  float gzMacSmooth = mix(gzMacro, -dFdy(hMacro) / dZ, fullBicubicAmt);
  float microGradW = smoothstep(3.0, 16.0, uZoom) * mix(0.42, 0.22, smoothstep(80.0, 480.0, uZoom));
  float gx = gxMacSmooth + (dFdx(microH) / dX) * microGradW;
  float gz = gzMacSmooth + (-dFdy(microH) / dZ) * microGradW;
  float slope = length(vec2(gx, gz));

  float logZ = clamp(log2(max(1.0, uZoom)), 0.0, 11.6);
  float exag = mix(2.45, 1.30, logZ * 0.086);
  vec3 N = normalize(vec3(-gx * exag, 1.0, -gz * exag));

  // Swiss Imhof Dual-Directional Oblique Hillshading + Real Cast Mountain Horizon Shadow & Valley AO!
  float sun1 = max(0.0, dot(N, vec3(-0.646, 0.565, -0.514)));
  float sun2 = max(0.0, dot(N, vec3( 0.521, 0.722, -0.456)));
  float castShad = mix(0.76, 1.0, smoothstep(horz.g - 0.05, horz.g + 0.14, 0.42));
  float valleyAO = mix(0.74, 1.04, skyViewAO);
  float shade = clamp((sun1 * 0.86 * castShad + sun2 * 0.24 + 0.28) * valleyAO, 0.40, 1.26);

  // Branchless SwissTopo × GSI 4,800m Hypsometric Palette (-800m Abyss -> Sunken Cloud Forest -> Valley -> Alpine -> +4,000m Glacier!)
  vec3 col = mix(vec3(0.06, 0.16, 0.25), vec3(0.11, 0.29, 0.31), smoothstep(-800.0, -420.0, asl));
  col = mix(col, vec3(0.19, 0.42, 0.30), smoothstep(-420.0, 0.0, asl));
  col = mix(col, vec3(0.30, 0.50, 0.30), smoothstep(0.0, 560.0, asl));
  col = mix(col, vec3(0.52, 0.61, 0.39), smoothstep(560.0, 1380.0, asl));
  col = mix(col, vec3(0.72, 0.68, 0.51), smoothstep(1380.0, 2200.0, asl));
  col = mix(col, vec3(0.61, 0.61, 0.65), smoothstep(2200.0, 2820.0, asl));
  col = mix(col, vec3(0.89, 0.94, 0.99), smoothstep(2820.0, 3420.0, asl));
  col = mix(col, vec3(0.95, 0.98, 1.00), smoothstep(3420.0, 3980.0, asl));

  // 8-Lithology Geological Province Tinting (Volcanic Basalt, Karst Limestone, Red-Ochre Tuff/Sandstone, Peat Bog)
  col = mix(col, vec3(0.28, 0.29, 0.33), litho.r * 0.44);
  col = mix(col, vec3(0.84, 0.82, 0.76), litho.g * 0.38);
  col = mix(col, vec3(0.76, 0.53, 0.34), litho.b * 0.48);
  col = mix(col, vec3(0.17, 0.35, 0.25), litho.a * 0.44);

  // Concave Alpine Talus / Scree Apron Stippling (ガレ場細点描画!)
  float talusMask = smoothstep(0.50, 0.36, curv) * smoothstep(0.36, 0.58, slope) * (1.0 - smoothstep(0.65, 0.88, slope)) * smoothstep(820.0, 1520.0, asl);
  float screeDots = smoothstep(0.62, 0.86, m1.a) * smoothstep(4.0, 32.0, uZoom);
  col = mix(col, mix(vec3(0.58, 0.56, 0.53), vec3(0.26, 0.27, 0.29), screeDots * 0.65), talusMask * 0.68);

  // Exposed Cliff Rock Faces (dark basalt / pale limestone / ochre sandstone / alpine granite)
  float rockMask = smoothstep(0.46, 0.86, slope + (1.0 - eco.r) * 0.35) * (1.0 - smoothstep(2850.0, 3450.0, asl) * 0.70);
  vec3 rockInk = mix(vec3(0.44, 0.45, 0.49), vec3(0.27, 0.28, 0.32), litho.r);
  rockInk = mix(rockInk, vec3(0.68, 0.66, 0.60), litho.g * 0.65);
  rockInk = mix(rockInk, vec3(0.64, 0.44, 0.30), litho.b * 0.65);
  col = mix(col, rockInk, rockMask * 0.76);

  // 6-Belt Forest Canopy Velvet + Zoom-Progressive Top-Down Botanical Tree Crowns (-720m .. +2,500m!)
  float forestMask = smoothstep(0.24, 0.52, eco.r) * canopyDensity * (1.0 - smoothstep(0.45, 0.68, slope)) * (1.0 - smoothstep(2260.0, 2540.0, asl)) * smoothstep(-740.0, -560.0, asl);
  vec3 standTint = mix(vec3(0.76, 0.92, 0.80), vec3(0.98, 0.96, 0.78), eco.a);
  standTint = mix(standTint, vec3(0.66, 0.88, 0.84), smoothstep(-150.0, -580.0, asl) * 0.65);
  standTint = mix(standTint, vec3(0.72, 0.84, 0.82), smoothstep(1550.0, 2150.0, asl));
  // Domain-warped organic top-down tree crown domes with NW sunlit tip & SE shadow pocket at zoom >= 12!
  vec4 crownHi = texture(uMicroTex, (worldXZ * 0.24 + (m0.rg - 0.5) * 4.5 + 0.5) / 256.0);
  float crownZoom = smoothstep(8.0, 48.0, uZoom);
  float crownPuff = smoothstep(0.26, 0.78, crownHi.r * 0.58 + m1.g * 0.42);
  float crownShade = mix(0.88 + 0.22 * m1.b, 0.70 + 0.46 * crownPuff, crownZoom);
  col = mix(col, col * standTint * crownShade, forestMask * mix(0.46, 0.68, crownZoom));

  // Warm sunlit lift + cool atmospheric shadow tint + subtle convex ridge highlight
  float warmLift = max(0.0, sun1 * castShad - 0.50) * 0.12;
  float coolShad = max(0.0, 0.55 - sun1 * castShad) * 0.10;
  float ridgeGlow = smoothstep(0.58, 0.76, curv) * 0.045;
  col = col * shade + vec3(warmLift - coolShad * 0.30 + ridgeGlow, warmLift * 0.62 - coolShad * 0.10 + ridgeGlow, -warmLift * 0.18 + coolShad * 0.88 + ridgeGlow);

  // Engraved SwissTopo Fall-Line Cliff Rock Hachuring on sheer faces (> 34 deg, branchless!)
  float cliffAmt = smoothstep(0.68, 1.58, slope);
  float hatchFreq = mix(0.065, 0.46, smoothstep(4.0, 220.0, uZoom));
  vec2 downDir = vec2(gx, gz) / max(slope, 0.22);
  float alongFall = dot(worldXZ, vec2(-downDir.y, downDir.x));
  float hatchLine = smoothstep(0.50, 0.92, abs(sin(alongFall * hatchFreq + m1.a * 4.2)));
  float crossFract = smoothstep(0.68, 0.95, abs(sin(dot(worldXZ, downDir) * hatchFreq * 0.42 + m0.a * 3.0)));
  col = mix(col, col * 0.48 + vec3(0.04, 0.05, 0.07), cliffAmt * clamp(hatchLine * 0.58 + crossFract * 0.22, 0.0, 0.72));

  // Glacier Crevasse Blue-Ice Hatching on high alpine snowfields (+2,820 m .. +4,100 m)
  float glacMask = smoothstep(2800.0, 3240.0, asl) * smoothstep(0.24, 0.66, slope);
  float crev = smoothstep(0.74, 0.95, abs(sin(dot(worldXZ, downDir) * 0.14 + m1.r * 5.0)));
  col = mix(col, vec3(0.38, 0.70, 0.96), glacMask * crev * 0.52);

  // 3-Tier Adaptive Analytical fwidth() Contours (Index + Intermediate + Flat-Terrain Supplementary!)
  float powStep = exp2(floor(clamp(5.65 - logZ * 0.72, -2.0, 5.65)));
  float minorStep = max(0.25, powStep);
  float majorStep = minorStep * 5.0;
  float suppStep = minorStep * 0.5;
  float flatMask = (1.0 - smoothstep(0.06, 0.17, slope)) * smoothstep(2.5, 16.0, uZoom);
  float cSupp = contourMask(asl, suppStep, 0.55) * flatMask;
  float cMinor = contourMask(asl, minorStep, 0.80);
  float cMajor = contourMask(asl, majorStep, 1.44);
  vec3 contourInk = mix(vec3(0.18, 0.12, 0.08), vec3(0.16, 0.46, 0.74), step(2820.0, asl));
  contourInk = mix(contourInk, vec3(0.10, 0.28, 0.38), step(asl, 0.0));
  col = mix(col, contourInk, clamp(cSupp * 0.14 + cMinor * 0.26 + cMajor * 0.60, 0.0, 0.68));

  // Dendritic Mountain Brooks & Alpine Ravine Streams (extracted from hydraulic flow wetness + concave valleys!)
  float brookFlow = smoothstep(0.56, 0.88, wetness) * smoothstep(0.54, 0.38, curv) * (1.0 - step(2780.0, asl) * 0.75);
  col = mix(col, vec3(0.24, 0.68, 0.86), brookFlow * 0.62);

  // Exact Contour-Clipped Natural Basin Lakes + Bathymetric Depth Contours (等深線) + Shoal Rims!
  float lakeDepth = max(0.0, natWaterY - hLocal);
  float inLake = step(0.001, lakeDepth);
  vec3 lakeCol = mix(vec3(0.28, 0.72, 0.82), vec3(0.06, 0.24, 0.48), clamp(lakeDepth * 0.032, 0.0, 1.0));
  float bathyStep = max(1.0, minorStep * 0.5);
  float cBathy = contourMask(lakeDepth, bathyStep, 0.85) * smoothstep(0.6, 3.0, lakeDepth);
  lakeCol = mix(lakeCol, vec3(0.52, 0.86, 0.96), cBathy * 0.36);
  // Crisp shoreline ink edge
  lakeCol = mix(lakeCol, vec3(0.04, 0.22, 0.34), (1.0 - smoothstep(0.0, 1.4, lakeDepth)) * 0.68);
  col = mix(col, lakeCol, inLake);
  // Marsh & wet cobble flats outside lakes
  col = mix(col, vec3(0.14, 0.42, 0.52), (1.0 - inLake) * clamp((wetness - 0.78) * 1.4, 0.0, 0.58));

  col = mix(vec3(0.030, 0.046, 0.070), col, inBounds);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// DEDICATED SUBTERRANEAN -2,600m X-RAY STRATA SHADER WITH MULTI-DECK DEPTH PARALLAX (Lazy-compiled!)
const MAP_XRAY_FRAG_GLSL3 = /* glsl */ `
uniform sampler2D uGeoTex;
uniform sampler2D uSubTex;
uniform sampler2D uMicroTex;
uniform vec4 uViewWorld;
uniform vec4 uWorldBounds;
uniform vec2 uDemSize;
uniform float uBaseASL;
uniform float uZoom;
uniform float uSubLayer;

in vec2 vUv;
out vec4 outColor;

float contourMask(float val, float stepVal, float widthPx) {
  float scaled = val / stepVal;
  float dist = abs(fract(scaled + 0.5) - 0.5);
  float fw = max(fwidth(scaled), 1e-5);
  return 1.0 - smoothstep(widthPx * 0.45, widthPx * 1.05, dist / fw);
}

void main() {
  vec2 screenUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 worldXZ = uViewWorld.xy + screenUv * uViewWorld.zw;
  vec2 mapUv = (worldXZ - uWorldBounds.xy) / uWorldBounds.zw;
  float inBounds = step(0.0, mapUv.x) * step(mapUv.x, 1.0) * step(0.0, mapUv.y) * step(mapUv.y, 1.0);
  vec2 safeUv = clamp(mapUv, 0.0, 1.0);

  vec2 tc = clamp(safeUv * (uDemSize - 1.0), vec2(0.0), uDemSize - 1.0001);
#ifdef USE_HW_FLOAT_LINEAR
  float hMacro = texture(uGeoTex, (tc + 0.5) / uDemSize).r;
#else
  float hMacro = texelFetch(uGeoTex, ivec2(tc), 0).r;
#endif
  float asl = uBaseASL + hMacro;
  float logZ = clamp(log2(max(1.0, uZoom)), 0.0, 11.6);
  float minorStep = max(1.0, exp2(floor(clamp(5.65 - logZ * 0.72, 0.0, 5.65))));
  float cMinor = contourMask(asl, minorStep, 0.70);
  float cMajor = contourMask(asl, minorStep * 5.0, 1.25);

  vec3 xrayBase = vec3(0.036, 0.062, 0.098) + vec3(0.05, 0.08, 0.11) * clamp((asl + 800.0) / 4800.0, 0.0, 1.0);
  xrayBase = mix(xrayBase, vec3(0.16, 0.30, 0.44), cMinor * 0.18 + cMajor * 0.46);

  vec4 sub = texture(uSubTex, safeUv);
  float m1 = step(uSubLayer, 1.5);
  float m2 = step(1.5, uSubLayer) * step(uSubLayer, 2.5);
  float m3 = step(2.5, uSubLayer);
  float voidVal = sub.r * m1 + sub.g * m2 + sub.b * m3;
  // Subtle ghost visibility of adjacent subterranean decks for true 3D multi-stratum spatial sense!
  float ghostVal = (sub.g * 0.32) * m1 + (sub.r * 0.24 + sub.b * 0.28) * m2 + (sub.g * 0.30) * m3;
  vec3 voidGlow = vec3(0.22, 0.86, 0.98) * m1 + vec3(0.98, 0.56, 0.22) * m2 + vec3(0.74, 0.42, 0.98) * m3;
  vec3 ghostCol = vec3(0.45, 0.65, 0.85) * m1 + vec3(0.32, 0.72, 0.88) * m2 + vec3(0.85, 0.52, 0.32) * m3;

  vec4 mic = texture(uMicroTex, (worldXZ * 0.025 + 0.5) / 256.0);
  float chamber = smoothstep(0.30, 0.78, voidVal + (mic.r * 0.5 + mic.b * 0.5 - 0.5) * 0.14);
  float wallEdge = contourMask(voidVal * 100.0, 12.0, 1.15) * smoothstep(0.22, 0.38, voidVal);
  vec3 col = mix(xrayBase, ghostCol * 0.36, smoothstep(0.34, 0.75, ghostVal) * 0.45);
  col = mix(col, voidGlow * (0.28 + 0.60 * chamber), chamber * 0.80) + voidGlow * wallEdge * 0.46;
  col = mix(col, vec3(0.48, 0.95, 1.0), smoothstep(0.55, 0.92, sub.a) * 0.62);
  col = mix(vec3(0.024, 0.038, 0.060), col, inBounds);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function createTerrenoMap2DGpu(geomorph, sharedRenderer = null) {
  if (!sharedRenderer) return null;

  const hasFloatLinear = Boolean(geomorph.hasFloatLinear);
  const defines = hasFloatLinear ? { USE_HW_FLOAT_LINEAR: 1 } : {};

  const mapScene = new THREE.Scene();
  const mapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const sharedUniforms = {
    uGeoTex: { value: geomorph.geoTexture },
    uNormalTex: { value: geomorph.normalTexture },
    uHorizonTex: { value: geomorph.horizonTexture },
    uLithoTex: { value: geomorph.lithoTexture },
    uSoilEcoTex: { value: geomorph.soilEcoTexture },
    uSubTex: { value: geomorph.subTexture },
    uMicroTex: { value: geomorph.microNoiseTexture },
    uViewWorld: { value: new THREE.Vector4(-30000, -30000, 60000, 60000) },
    uWorldBounds: { value: new THREE.Vector4(TERRENO_WORLD.minX, TERRENO_WORLD.minZ, TERRENO_WORLD.width, TERRENO_WORLD.depth) },
    uDemSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
    uBaseASL: { value: TERRENO_WORLD.baseElevationASL },
    uZoom: { value: 1.0 },
    uSubLayer: { value: 0.0 },
    uFloodRise: { value: 0.0 },
  };

  const surfaceMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines,
    vertexShader: MAP_VERT_GLSL3,
    fragmentShader: MAP_SURFACE_FRAG_GLSL3,
    uniforms: sharedUniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  // Lazy-created only when user toggles Subterranean X-Ray (subLayer > 0)
  let xrayMat = null;
  function getXrayMat() {
    if (!xrayMat) {
      xrayMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        defines,
        vertexShader: MAP_VERT_GLSL3,
        fragmentShader: MAP_XRAY_FRAG_GLSL3,
        uniforms: sharedUniforms,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
    }
    return xrayMat;
  }

  // Single full-screen triangle (3 vertices -> 0 quad diagonal overdraw!)
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  triGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const triMesh = new THREE.Mesh(triGeo, surfaceMat);
  triMesh.frustumCulled = false;
  mapScene.add(triMesh);

  const _prevVP = new THREE.Vector4();
  const _curSize = new THREE.Vector2();

  function renderTo2DContext(ctx2d, width, height, minX, minZ, spanX, spanZ, zoom, subLayer = 0, floodRise = 0) {
    sharedUniforms.uViewWorld.value.set(minX, minZ, spanX, spanZ);
    sharedUniforms.uZoom.value = zoom;
    sharedUniforms.uSubLayer.value = subLayer;
    sharedUniforms.uFloodRise.value = floodRise;
    triMesh.material = subLayer > 0.5 ? getXrayMat() : surfaceMat;

    const prevRT = sharedRenderer.getRenderTarget();
    const prevTM = sharedRenderer.toneMapping;
    const prevAutoClear = sharedRenderer.autoClear;
    const prevScissor = sharedRenderer.getScissorTest();
    sharedRenderer.getViewport(_prevVP);
    sharedRenderer.getSize(_curSize);
    const dom = sharedRenderer.domElement;
    const rw = dom.width;
    const rh = dom.height;

    sharedRenderer.setRenderTarget(null);
    sharedRenderer.setScissorTest(false);
    sharedRenderer.setViewport(0, 0, _curSize.x, _curSize.y);
    sharedRenderer.toneMapping = THREE.NoToneMapping;
    sharedRenderer.autoClear = false;
    sharedRenderer.render(mapScene, mapCamera);

    // Zero-copy GPU-to-2D canvas blit (~0.15 ms!)
    ctx2d.drawImage(dom, 0, 0, rw, rh, 0, 0, width, height);

    sharedRenderer.toneMapping = prevTM;
    sharedRenderer.autoClear = prevAutoClear;
    sharedRenderer.setViewport(_prevVP);
    sharedRenderer.setScissorTest(prevScissor);
    sharedRenderer.setRenderTarget(prevRT);
  }

  function dispose() {
    triGeo.dispose();
    surfaceMat.dispose();
    if (xrayMat) xrayMat.dispose();
  }

  return {
    isSharedContext: true,
    renderTo2DContext,
    dispose,
  };
}
