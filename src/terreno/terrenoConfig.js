import { VILLAGE } from '../villageData.js';

/**
 * TERRENO 1.1 Engine — Master World Configuration (15,000 m × 40,000 m = 600.0 km²)
 * Japanese Deep-Mountain Alpine Watershed, 40 km Forestry Road Network, Suginosato 5-House Village,
 * 4 Atmosphere Presets, & 8 Scenic Landmarks.
 */

export const TERRENO_WORLD = {
  width: 15000,         // 15.0 km East–West  (X ∈ [-7500, +7500])
  depth: 40000,         // 40.0 km North–South (Z ∈ [-14000, +26000])
  minX: -7500,
  maxX: 7500,
  minZ: -14000,
  maxZ: 26000,
  // Fast high-precision macro atlas (983,040 cells: ~23.5m × 26.0m grid, fast mobile WebGL2 bake!)
  atlasW: 640,
  atlasH: 1536,
  // Local compound ground Y (-0.35m) maps to real Japanese mountain elevation +520.0m ASL
  compoundGroundY: -0.35,
  baseElevationASL: 520.35,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  compoundFlatRadius: 36.0,
  compoundBlendRadius: 195.0,
  // Suginosato 5-House Mountain Village Terrace Lock (exact CPU-GPU parity!)
  villageCenterX: VILLAGE.centerX,
  villageCenterZ: VILLAGE.centerZ,
  villageGroundY: VILLAGE.groundY,
  villageFlatRadius: VILLAGE.flatRadius,
  villageBlendRadius: VILLAGE.blendRadius,
  // Playable movement bounds (keep 40m inset from outer map rim)
  playMinX: -7460,
  playMaxX: 7460,
  playMinZ: -13960,
  playMaxZ: 25960,
};

/**
 * Main 40 km Carved Gorge River Centerline X(z) and Water Surface Elevation Y_water(z).
 * Flows strictly downhill from North Alpine Headwaters (Z=-14000, +717m ASL) past NARROW-50 (X≈+185m, Z=0)
 * and Suginosato 5-House Village (Z=+1280, River X≈+1205m) down to South Emerald Grand Canyon (Z=+26000, +267m ASL).
 */
export function evalMainRiver(z) {
  const t = Math.max(0.0, Math.min(1.0, (z - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth)); // 0 (North) -> 1 (South)
  // Broad organic multi-harmonic meander sweeping ±2.3 km across the 15 km × 40 km alpine valley
  const x =
    240.0
    + Math.sin(z * 0.00024 + 0.10) * 1420.0
    + Math.sin(z * 0.00068 - 0.62) * 540.0
    + Math.cos(z * 0.00014 + 0.45) * 680.0
    - 495.0 * Math.exp(-((z * z) / (1700.0 * 1700.0))); // keeps gorge ~185m east of NARROW-50 at Z=0

  // Strictly monotonic concave longitudinal riverbed profile across full 40 km
  const bedY =
    235.0 * Math.pow(1.0 - t, 1.55)
    - 215.0 * Math.pow(t, 0.92)
    - 12.0 * Math.exp(-((z * z) / (3200.0 * 3200.0)))
    - 38.0;

  // River channel half-width widens organically downstream (16m alpine headwaters -> 56m grand south canyon)
  const halfWidth = 16.0 + 40.0 * Math.pow(t, 0.85) + Math.sin(z * 0.0014) * 4.5;
  const waterDepth = 2.4 + 3.4 * t;
  return { x, bedY, waterY: bedY + waterDepth, halfWidth, waterDepth };
}

/**
 * 16 Major Tributary Mountain Valleys (支流沢) draining the 15 km East & West alpine massifs
 * into the 40 km Main Gorge River (黒杉川).
 */
export const TRIBUTARIES = [
  // Far North Alpine Headwaters (Z = -13,000 .. -6,000)
  { id: 'trib_n0', nameJp: '北アルプス氷河沢', z0: -11600, side: -1, dirX: -0.94, dirZ: -0.34, len: 5600, depth: 128, width: 78 },
  { id: 'trib_n1', nameJp: '北東霧氷沢',       z0:  -9600, side:  1, dirX:  0.93, dirZ: -0.37, len: 5800, depth: 132, width: 82 },
  { id: 'trib_n2', nameJp: '北奥源流沢',       z0:  -7200, side: -1, dirX: -0.95, dirZ: -0.31, len: 5400, depth: 112, width: 72 },
  { id: 'trib_n3', nameJp: '雲海霧沢',         z0:  -4600, side:  1, dirX:  0.92, dirZ: -0.39, len: 5500, depth: 118, width: 74 },
  // Central Watershed flanking NARROW-50 & Suginosato Village (Z = -2,400 .. +4,600)
  { id: 'trib_c1', nameJp: '苔杉西沢',         z0:  -1450, side: -1, dirX: -0.96, dirZ: -0.28, len: 5200, depth:  96, width: 64 },
  { id: 'trib_c2', nameJp: '朝霧東沢',         z0:    720, side:  1, dirX:  0.93, dirZ:  0.36, len: 5100, depth: 108, width: 68 },
  { id: 'trib_c3', nameJp: '杉ノ郷清流沢',     z0:   2850, side: -1, dirX: -0.95, dirZ:  0.31, len: 5800, depth: 116, width: 74 },
  { id: 'trib_c4', nameJp: '深緑東渓沢',       z0:   4900, side:  1, dirX:  0.92, dirZ:  0.39, len: 4900, depth: 122, width: 76 },
  // Mid-South Montane Gorges (Z = +7,000 .. +15,000)
  { id: 'trib_s1', nameJp: '黒岳ブナ渓沢',     z0:   7600, side: -1, dirX: -0.91, dirZ:  0.41, len: 6200, depth: 136, width: 82 },
  { id: 'trib_s2', nameJp: '翡翠滝沢',         z0:  10200, side:  1, dirX:  0.90, dirZ:  0.43, len: 5600, depth: 142, width: 84 },
  { id: 'trib_s3', nameJp: '西アルプス大沢',   z0:  12800, side: -1, dirX: -0.94, dirZ:  0.34, len: 6000, depth: 148, width: 86 },
  { id: 'trib_s4', nameJp: '白雲滝沢',         z0:  15400, side:  1, dirX:  0.91, dirZ:  0.41, len: 5900, depth: 154, width: 88 },
  // Far South Grand Alpine Canyon (Z = +17,500 .. +24,500)
  { id: 'trib_s5', nameJp: '雷鳥渓谷西沢',     z0:  18200, side: -1, dirX: -0.93, dirZ:  0.36, len: 5200, depth: 144, width: 84 },
  { id: 'trib_s6', nameJp: '剣ヶ嶺東沢',       z0:  20600, side:  1, dirX:  0.90, dirZ:  0.44, len: 6400, depth: 162, width: 92 },
  { id: 'trib_s7', nameJp: '南渓翡翠大沢',     z0:  22800, side: -1, dirX: -0.95, dirZ:  0.31, len: 5600, depth: 138, width: 84 },
  { id: 'trib_s8', nameJp: '蒼穹南東沢',       z0:  24400, side:  1, dirX:  0.92, dirZ:  0.39, len: 5800, depth: 146, width: 86 },
];

/**
 * 24 Tectonic Mountain Peaks framing the 15 km × 40 km (600 km²) Japanese Alpine Watershed.
 * Built in double-tier Eastern & Western chains (inner forested spurs + soaring outer 2,000m+ granite spines)
 * so every panorama reveals 5+ overlapping misty mountain silhouettes!
 */
export const MOUNTAIN_PEAKS = [
  // Far North High Alpine Massif (Z = -13,000 .. -6,000)
  { nameJp: '北アルプス主峰', x: -4600, z: -12400, height: 1020, rx: 2250, rz: 2800, sharpness: 1.32 },
  { nameJp: '白雪岳',         x:  4400, z: -11800, height: 1080, rx: 2300, rz: 2900, sharpness: 1.34 },
  { nameJp: '霧氷嶺',         x: -1850, z: -10200, height:  820, rx: 1850, rz: 2300, sharpness: 1.24 },
  { nameJp: '北奥山',         x:  2850, z:  -8400, height:  900, rx: 1950, rz: 2450, sharpness: 1.26 },
  { nameJp: '西森大岳',       x: -5400, z:  -6800, height:  980, rx: 2200, rz: 2700, sharpness: 1.28 },
  { nameJp: '雲海峰',         x:  5200, z:  -5200, height:  960, rx: 2150, rz: 2600, sharpness: 1.26 },

  // Inner Northern & Central Flanking Spurs (gentle natural rise around NARROW-50 & Suginosato Village!)
  { nameJp: '古杉西嶺',       x: -2450, z:  -2400, height:  620, rx: 1750, rz: 2250, sharpness: 1.16 },
  { nameJp: '朝霧東岳',       x:  2950, z:  -1200, height:  700, rx: 1850, rz: 2350, sharpness: 1.20 },
  { nameJp: '霧ヶ峰西嶺',     x: -5550, z:    850, height:  980, rx: 2250, rz: 2800, sharpness: 1.26 },
  { nameJp: '杉ノ郷見晴岳',   x:  4850, z:   2200, height:  920, rx: 2150, rz: 2650, sharpness: 1.25 },
  { nameJp: '翡翠西尾根',     x: -2350, z:   3600, height:  680, rx: 1750, rz: 2300, sharpness: 1.18 },
  { nameJp: '深緑東嶺',       x:  5650, z:   6400, height: 1020, rx: 2250, rz: 2750, sharpness: 1.28 },

  // Mid-South Dramatic Montane & Subalpine Chains (Z = +6,000 .. +16,000)
  { nameJp: '黒岳',           x: -4450, z:   8400, height:  990, rx: 2200, rz: 2800, sharpness: 1.28 },
  { nameJp: 'ブナ大嶺',       x: -1750, z:   9600, height:  740, rx: 1750, rz: 2350, sharpness: 1.22 },
  { nameJp: '蒼渓東岳',       x:  3450, z:  11200, height:  940, rx: 2050, rz: 2600, sharpness: 1.26 },
  { nameJp: '西アルプス嶺',   x: -5600, z:  13800, height: 1120, rx: 2350, rz: 2950, sharpness: 1.32 },
  { nameJp: '星見東峰',       x:  5400, z:  15200, height: 1080, rx: 2300, rz: 2850, sharpness: 1.30 },
  { nameJp: '翠巒中岳',       x: -2250, z:  16600, height:  860, rx: 1900, rz: 2450, sharpness: 1.24 },

  // Far South Towering Japanese Northern Alps Skyline (Z = +18,500 .. +25,200)
  { nameJp: '雷鳥岳',         x: -4950, z:  20200, height: 1180, rx: 2400, rz: 3000, sharpness: 1.34 },
  { nameJp: '白雲峰',         x:  2850, z:  21400, height: 1320, rx: 2550, rz: 3150, sharpness: 1.36 },
  { nameJp: '剣ヶ嶺',         x:  5650, z:  22200, height: 1180, rx: 2300, rz: 2900, sharpness: 1.32 },
  { nameJp: '南アルプス大峰', x: -3450, z:  24200, height: 1240, rx: 2450, rz: 3000, sharpness: 1.34 },
  { nameJp: '南東雲海岳',     x:  1650, z:  24800, height: 1120, rx: 2200, rz: 2700, sharpness: 1.30 },
  { nameJp: '西端雪渓峰',     x: -6100, z:  24400, height: 1140, rx: 2150, rz: 2650, sharpness: 1.30 },
];

/**
 * 40 km Graded Mountain Forestry Road (奥山林道) Control Polyline (Catmull-Rom smooth spline).
 * Connects North Alpine Headwaters -> Unkai Overlook Pass -> NARROW-50 North Driveway (1.5, -16) ->
 * Suginosato 5-House Village West Entrance (788, 1280) -> Kurodake Beech Ridge -> South Grand Alps!
 */
export const FOREST_ROAD_POINTS = [
  // Far North Headwaters Climb -> Unkai Pass
  [-1420, -13100],
  [ -680, -11800],
  [  240, -10600],
  [  920,  -9450], // Unkai Overlook Pass (北展望峠)
  [  320,  -8100],
  [ -580,  -6850],
  [-1120,  -5550], // Birch Switchback Hairpin
  [ -740,  -4150],
  [ -420,  -2850],
  [ -210,  -1550],
  [  -85,   -580],
  [  -24,   -180],
  [    1.5,  -16], // Connects directly to NARROW-50 North Driveway!
  // Loop gracefully West around NARROW-50 Compound (keeps entire yard & Annex untouched!)
  [  -34,     -8],
  [  -42,     24],
  [  -88,    145],
  [   65,    460],
  [  420,    840],
  [  735,   1140],
  [  788,   1280], // Connects directly to Suginosato 5-House Village West Entrance & Parking Bay!
  [  772,   1420],
  [  610,   1880],
  [  280,   2650],
  [ -120,   3850],
  [ -540,   5450],
  [-1080,   7250],
  [-1620,   9250], // Kurodake Buna Beech Ridge Road
  [-1340,  11400],
  [ -780,  13650],
  [ -320,  16100],
  [  380,  18650],
  [  980,  21250],
  [  720,  23450],
  [  280,  24950],
];

/**
 * 8 Curated Scenic Landmarks across the 15 km × 40 km (600 km²) Mountain Watershed.
 */
export const TERRENO_LANDMARKS = [
  {
    id: 'compound',
    code: 'BASE',
    nameJp: '母屋 NARROW-50 拠点',
    desc: '標高 +520m 中腹河岸段丘（5拠点・地下4層・車両待機所）',
    x: -1.8,
    z: -14.5,
    yaw: Math.PI + 0.12, // Look South toward house & 26km mountain range
    pitch: 0.03,
  },
  {
    id: 'village',
    code: 'VLG',
    nameJp: '杉ノ郷 集落（5棟の里）',
    desc: '標高 +514m 河岸段丘に佇む5軒の家・石畳広場・水場・山の社（南東 1.5km）',
    x: VILLAGE.centerX - 24.5,
    z: VILLAGE.centerZ + 0.2,
    yaw: -Math.PI * 0.5, // Look straight East down the sunlit stone village lane framed by all 5 houses!
    pitch: -0.02,
  },
  {
    id: 'gorge_river',
    code: 'GORGE',
    nameJp: '黒杉渓谷・翡翠淵',
    desc: '本流渓谷の清流・苔巨岩・急流白波（拠点南東 370m）',
    x: evalMainRiver(220).x - evalMainRiver(220).halfWidth - 2.2,
    z: 220,
    yaw: Math.PI + 0.18,
    pitch: -0.06,
  },
  {
    id: 'birch_road',
    code: 'ROAD',
    nameJp: '奥山林道・白樺ヘアピン',
    desc: '幅9m砕石林道・スギ＆ブナ混交林ドライブ名所（北 5.6km）',
    x: -1120,
    z: -5550,
    yaw: Math.PI * 0.88,
    pitch: -0.04,
  },
  {
    id: 'unkai_pass',
    code: 'PASS',
    nameJp: '雲海展望峠（北尾根）',
    desc: '30km先まで連なる雲海と多層連峰を一望する絶景峠（北 9.5km）',
    x: 920,
    z: -9450,
    yaw: Math.PI + 0.10, // Look South across the entire 35km watershed!
    pitch: -0.08,
  },
  {
    id: 'west_alpine',
    code: 'WEST',
    nameJp: '霧ヶ峰・西アルプス尾根',
    desc: '15km東西幅を象徴する西方高山帯パノラマ尾根（西 5.2km）',
    x: -5180,
    z: 850,
    yaw: -Math.PI * 0.48, // Look East across the entire 15km alpine valley & river gorge!
    pitch: -0.09,
  },
  {
    id: 'kurodake_beech',
    code: 'BUNA',
    nameJp: '黒岳・ブナ原生林尾根',
    desc: '山地帯ブナ・ミズナラ原生林とクマザサ尾根（南 9.3km）',
    x: -1620,
    z: 9250,
    yaw: -0.52,
    pitch: -0.03,
  },
  {
    id: 'shirakumo_summit',
    code: 'PEAK',
    nameJp: '白雲峰・アルプス花崗岩稜',
    desc: '森林限界超えの2,000m級花崗岩峰・15km×40km全景パノラマ（南 21.5km）',
    x: 2850,
    z: 21400,
    yaw: 0.14, // Stand atop bare alpine granite summit crest looking 35km North across the 15×40km watershed!
    pitch: -0.09,
  },
];

/**
 * 4 Physically-Calibrated Japanese Mountain Atmosphere & Time-of-Day Presets (tuned for 15km × 40km visibility).
 */
export const ATMOSPHERE_PRESETS = {
  night: {
    id: 'night',
    labelJp: '月夜',
    fullNameJp: '月夜の深森（NARROW-50標準）',
    sunDir: [-0.34, 0.44, 0.83],
    sunColor: [0.56, 0.72, 0.96],
    sunIntensity: 1.48,
    hemiSky: 0x2c4b72,
    hemiGround: 0x0b100e,
    hemiIntensity: 0.24,
    skyZenith: [0.015, 0.032, 0.068],
    skyHorizon: [0.065, 0.118, 0.195],
    skyGlow: [0.22, 0.34, 0.54],
    valleyFogColor: [0.075, 0.135, 0.215],
    aerialFogColor: [0.048, 0.088, 0.158],
    valleyFogDensity: 0.00042,
    valleyFogFalloff: 0.0078,
    valleyFogBaseY: -65.0,
    aerialDensity: 0.000072,
    mieStrength: 0.32,
    starIntensity: 1.0,
    cloudBrightness: 0.20,
    exposure: 1.12,
    horizonShadowBlend: 0.65,
    useEastHorizon: 0.0,
  },
  dawn: {
    id: 'dawn',
    labelJp: '朝霧',
    fullNameJp: '夜明け・雲海アルペングロー',
    sunDir: [0.84, 0.23, 0.49],
    sunColor: [1.0, 0.72, 0.46],
    sunIntensity: 2.85,
    hemiSky: 0x7b98c2,
    hemiGround: 0x262824,
    hemiIntensity: 0.62,
    skyZenith: [0.11, 0.22, 0.44],
    skyHorizon: [0.88, 0.56, 0.38],
    skyGlow: [1.0, 0.74, 0.44],
    valleyFogColor: [0.86, 0.78, 0.72],
    aerialFogColor: [0.46, 0.54, 0.72],
    valleyFogDensity: 0.00115,
    valleyFogFalloff: 0.0082,
    valleyFogBaseY: -15.0,
    aerialDensity: 0.000068,
    mieStrength: 0.78,
    starIntensity: 0.08,
    cloudBrightness: 0.92,
    exposure: 1.06,
    horizonShadowBlend: 0.88,
    useEastHorizon: 1.0,
  },
  day: {
    id: 'day',
    labelJp: '深緑',
    fullNameJp: '白昼の奥山・木漏れ日',
    sunDir: [0.42, 0.74, 0.52],
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 3.15,
    hemiSky: 0x89b8e6,
    hemiGround: 0x2b3a28,
    hemiIntensity: 0.78,
    skyZenith: [0.16, 0.38, 0.74],
    skyHorizon: [0.64, 0.79, 0.92],
    skyGlow: [1.0, 0.95, 0.84],
    valleyFogColor: [0.68, 0.80, 0.88],
    aerialFogColor: [0.44, 0.62, 0.84],
    valleyFogDensity: 0.00028,
    valleyFogFalloff: 0.0074,
    valleyFogBaseY: -50.0,
    aerialDensity: 0.000058,
    mieStrength: 0.42,
    starIntensity: 0.0,
    cloudBrightness: 1.0,
    exposure: 1.00,
    horizonShadowBlend: 0.82,
    useEastHorizon: 1.0,
  },
  dusk: {
    id: 'dusk',
    labelJp: '夕映',
    fullNameJp: '逢魔時・紅蓮のアルプス夕映え',
    sunDir: [-0.84, 0.21, 0.50],
    sunColor: [1.0, 0.50, 0.28],
    sunIntensity: 2.65,
    hemiSky: 0x5c4c78,
    hemiGround: 0x201818,
    hemiIntensity: 0.48,
    skyZenith: [0.09, 0.11, 0.28],
    skyHorizon: [0.90, 0.42, 0.26],
    skyGlow: [1.0, 0.52, 0.24],
    valleyFogColor: [0.56, 0.42, 0.54],
    aerialFogColor: [0.36, 0.28, 0.44],
    valleyFogDensity: 0.00075,
    valleyFogFalloff: 0.0078,
    valleyFogBaseY: -30.0,
    aerialDensity: 0.000074,
    mieStrength: 0.85,
    starIntensity: 0.22,
    cloudBrightness: 0.75,
    exposure: 1.08,
    horizonShadowBlend: 0.90,
    useEastHorizon: 0.0,
  },
};

export const ATMOSPHERE_ORDER = ['night', 'dawn', 'day', 'dusk'];
