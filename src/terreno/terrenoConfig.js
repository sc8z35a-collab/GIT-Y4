/**
 * TERRENO Engine — Master World Configuration (5,000 m × 19,000 m = 95.0 km²)
 * Japanese Deep-Mountain Watershed, Forestry Road Network, 4 Atmosphere Presets, & Landmarks.
 */

export const TERRENO_WORLD = {
  width: 5000,         // 5.0 km East–West  (X ∈ [-2500, +2500])
  depth: 19000,        // 19.0 km North–South (Z ∈ [-6500, +12500])
  minX: -2500,
  maxX: 2500,
  minZ: -6500,
  maxZ: 12500,
  // Atlas resolution (786,432 cells: ~9.77m × 12.37m macro grid, <140ms CPU bake!)
  atlasW: 512,
  atlasH: 1536,
  // Local compound ground Y (-0.35m) maps to real Japanese mountain elevation +520.0m ASL
  compoundGroundY: -0.35,
  baseElevationASL: 520.35,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  compoundFlatRadius: 26.0,
  compoundBlendRadius: 175.0,
  // Playable movement bounds (keep 40m inset from outer map rim)
  playMinX: -2460,
  playMaxX: 2460,
  playMinZ: -6460,
  playMaxZ: 12460,
};

/**
 * Main 19 km Carved Gorge River Centerline X(z) and Water Surface Elevation Y_water(z).
 * Flows continuously downhill from North Alpine Headwaters (Z=-6500) past NARROW-50 (X≈+195m, Z=0)
 * down to South Emerald Canyon Outflow (Z=+12500).
 */
export function evalMainRiver(z) {
  const t = (z - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth; // 0 (North) -> 1 (South)
  // Smooth multi-harmonic natural river meander keeping compound terrace safely on west bank
  const x =
    195.0
    + Math.sin(z * 0.00072 + 0.18) * 340.0
    + Math.sin(z * 0.00185 - 0.95) * 145.0
    + Math.cos(z * 0.00034 + 0.55) * 190.0
    - 180.0 * Math.exp(-((z * z) / (900.0 * 900.0))); // keep gorge ~195m east of compound at Z=0

  // Riverbed profile: realistic concave longitudinal profile (steep headwaters -> broad lower gorge)
  const bedY =
    155.0 * Math.pow(1.0 - t, 1.55)
    - 145.0 * Math.pow(t, 0.92)
    - 28.0 * Math.exp(-((z * z) / (1800.0 * 1800.0)))
    - 12.0;

  // River channel half-width widens organically downstream (14m headwaters -> 42m south gorge)
  const halfWidth = 14.0 + 28.0 * Math.pow(t, 0.85) + Math.sin(z * 0.0021) * 3.5;
  const waterDepth = 2.2 + 2.6 * t;
  return { x, bedY, waterY: bedY + waterDepth, halfWidth, waterDepth };
}

/**
 * 7 Major Tributary Mountain Valleys (支流沢) draining East & West ridges into the Main River.
 * Each entry defines junction Z, bank side (-1 West / +1 East), azimuth angle, length, & gorge depth.
 */
export const TRIBUTARIES = [
  { id: 'trib_n1', nameJp: '北奥源流沢',     z0: -4800, side: -1, dirX: -0.94, dirZ: -0.34, len: 2200, depth: 82, width: 58 },
  { id: 'trib_n2', nameJp: '雲海霧沢',       z0: -2950, side:  1, dirX:  0.92, dirZ: -0.39, len: 2150, depth: 92, width: 62 },
  { id: 'trib_c1', nameJp: '苔杉西沢',       z0:  -780, side: -1, dirX: -0.96, dirZ: -0.28, len: 2100, depth: 66, width: 50 },
  { id: 'trib_c2', nameJp: '朝霧東沢',       z0:  1650, side:  1, dirX:  0.93, dirZ:  0.36, len: 2250, depth: 98, width: 65 },
  { id: 'trib_s1', nameJp: '黒岳ブナ渓沢',   z0:  4850, side: -1, dirX: -0.91, dirZ:  0.41, len: 2350, depth: 112, width: 72 },
  { id: 'trib_s2', nameJp: '白雲滝沢',       z0:  7950, side:  1, dirX:  0.90, dirZ:  0.43, len: 2300, depth: 124, width: 76 },
  { id: 'trib_s3', nameJp: '南渓翡翠沢',     z0: 10300, side: -1, dirX: -0.95, dirZ:  0.31, len: 2200, depth: 96, width: 68 },
];

/**
 * Tectonic Mountain Peaks framing the 5km × 19km Japanese Alpine Watershed.
 * Placed deliberately to build 5+ overlapping misty silhouettes in North & South panoramas!
 */
export const MOUNTAIN_PEAKS = [
  // North Alpine Massif
  { nameJp: '北奥山',     x:  1320, z: -5350, height: 920,  rx: 1450, rz: 2100, sharpness: 1.25 },
  { nameJp: '西森岳',     x: -1650, z: -3650, height: 800,  rx: 1380, rz: 1950, sharpness: 1.18 },
  { nameJp: '雲海峰',     x:  1580, z: -1850, height: 690,  rx: 1280, rz: 1750, sharpness: 1.15 },
  // Central Gorge Flanking Spurs (gentle natural rise away from NARROW-50!)
  { nameJp: '古杉西嶺',   x: -1580, z:   650, height: 590,  rx: 1250, rz: 1650, sharpness: 1.12 },
  { nameJp: '朝霧岳',     x:  1520, z:  2150, height: 710,  rx: 1320, rz: 1950, sharpness: 1.22 },
  { nameJp: '翡翠尾根',   x: -1540, z:  3850, height: 680,  rx: 1280, rz: 1850, sharpness: 1.15 },
  // South High Alpine Massif (Visible across 12 km straight out of NARROW-50 6F Sky Terrace!)
  { nameJp: '黒岳',       x: -1380, z:  6750, height: 860,  rx: 1450, rz: 2250, sharpness: 1.28 },
  { nameJp: '深緑東岳',   x:  1660, z:  6200, height: 790,  rx: 1350, rz: 2100, sharpness: 1.20 },
  { nameJp: '白雲峰',     x:  1240, z: 10650, height: 1360, rx: 1650, rz: 2550, sharpness: 1.32 },
  { nameJp: '南アルプス嶺', x: -1450, z: 10900, height: 1120, rx: 1550, rz: 2400, sharpness: 1.28 },
];

/**
 * 19 km Graded Mountain Forestry Road (奥山林道) Control Polyline (Catmull-Rom smooth spline).
 * Connects directly to NARROW-50 North Driveway (X=1.5, Z=-12) so CAMPER-75 & KEI-340 can drive
 * smoothly North to Unkai Pass & South along the terraced western gorge rim!
 */
export const FOREST_ROAD_POINTS = [
  // North Alpine Climb from NARROW-50 driveway -> Unkai Pass -> North Headwaters
  [-520, -5850],
  [-240, -5100],
  [ 420, -4550],
  [ 860, -4150], // Unkai Overlook Pass switchback!
  [ 340, -3550],
  [-320, -2950], // Birch Switchback
  [-540, -2250],
  [-260, -1450],
  [-110,  -680],
  [ -28,  -210],
  [   1.5, -16], // Connects directly to NARROW-50 North Driveway!
  // Loop gracefully West around Compound (keeps entire yard & Annex untouched!)
  [ -34,   -8],
  [ -42,   24],
  [ -95,  140],
  [-165,  520],
  [-260, 1280],
  [-420, 2350],
  [-340, 3550],
  [-680, 4950],
  [-920, 6250], // Kurodake Buna Beech Ridge Road
  [-620, 7850],
  [-240, 9450],
  [ 220, 10850],
  [ 580, 11850],
];

/**
 * 6 Curated Scenic Landmarks across the 5km × 19km Mountain Watershed (click-to-teleport & telemetry!).
 */
export const TERRENO_LANDMARKS = [
  {
    id: 'compound',
    code: 'BASE',
    nameJp: '母屋 NARROW-50 拠点',
    desc: '標高 +520m 中腹河岸段丘（5拠点・地下4層・車両待機所）',
    x: -1.8,
    z: -14.5,
    yaw: Math.PI + 0.12, // Look South toward house & 12km mountain range
    pitch: 0.03,
  },
  {
    id: 'gorge_river',
    code: 'GORGE',
    nameJp: '黒杉渓谷・翡翠淵',
    desc: '本流渓谷の清流・苔巨岩・急流白波（拠点南東 240m）',
    x: evalMainRiver(220).x - evalMainRiver(220).halfWidth - 1.8,
    z: 220,
    yaw: Math.PI + 0.18, // Unobstructed shoreline view straight down the sparkling emerald gorge!
    pitch: -0.06,
  },
  {
    id: 'birch_road',
    code: 'ROAD',
    nameJp: '奥山林道・白樺ヘアピン',
    desc: '幅7.5m砕石林道・スギ＆ブナ混交林ドライブ名所（北 2.9km）',
    x: -320,
    z: -2950,
    yaw: Math.PI * 0.88,
    pitch: -0.04,
  },
  {
    id: 'unkai_pass',
    code: 'PASS',
    nameJp: '雲海展望峠（中腹尾根）',
    desc: '16km先まで連なる雲海と多層連峰を一望する絶景峠（北 4.2km）',
    x: 860,
    z: -4150,
    yaw: Math.PI + 0.16, // Look South across the entire 16km valley!
    pitch: -0.10,
  },
  {
    id: 'kurodake_beech',
    code: 'BUNA',
    nameJp: '黒岳・ブナ原生林尾根',
    desc: '山地帯ブナ・ミズナラ原生林とクマザサ尾根（南 6.3km）',
    x: -920,
    z: 6250,
    yaw: -0.62, // Look NE through the golden-green Buna forest toward distant valley ridges!
    pitch: -0.03,
  },
  {
    id: 'shirakumo_summit',
    code: 'PEAK',
    nameJp: '白雲峰・アルプス花崗岩稜',
    desc: '森林限界超えの花崗岩峰・5km×19km全景パノラマ（南 10.7km）',
    x: 1240,
    z: 10650,
    yaw: 0.30, // Stand atop bare alpine granite summit crest looking 17km North across the entire watershed!
    pitch: -0.11,
  },
];

/**
 * 4 Physically-Calibrated Japanese Mountain Atmosphere & Time-of-Day Presets.
 * Default 'night' preserves NARROW-50's iconic moonlit forest mood while revealing crisp 19km peaks;
 * 'dawn', 'day', and 'dusk' showcase breathtaking sea-of-clouds, Rayleigh blue ridges, and alpenglow!
 */
export const ATMOSPHERE_PRESETS = {
  night: {
    id: 'night',
    labelJp: '月夜',
    fullNameJp: '月夜の深森（NARROW-50標準）',
    sunDir: [-0.34, 0.44, 0.83],          // Silver moon high in South-West sky
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
    valleyFogDensity: 0.00055,
    valleyFogFalloff: 0.0085,
    valleyFogBaseY: -55.0,
    aerialDensity: 0.000105,
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
    sunDir: [0.84, 0.23, 0.49],           // Low golden morning sun rising over East ridges!
    sunColor: [1.0, 0.72, 0.46],
    sunIntensity: 2.85,
    hemiSky: 0x7b98c2,
    hemiGround: 0x262824,
    hemiIntensity: 0.62,
    skyZenith: [0.11, 0.22, 0.44],
    skyHorizon: [0.88, 0.56, 0.38],
    skyGlow: [1.0, 0.74, 0.44],
    valleyFogColor: [0.86, 0.78, 0.72],   // Glowing pearlescent Sea-of-Clouds (雲海)!
    aerialFogColor: [0.46, 0.54, 0.72],
    valleyFogDensity: 0.00145,
    valleyFogFalloff: 0.0092,
    valleyFogBaseY: -10.0,
    aerialDensity: 0.000095,
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
    sunDir: [0.42, 0.74, 0.52],           // Crisp Japanese mountain midday sun
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 3.15,
    hemiSky: 0x89b8e6,
    hemiGround: 0x2b3a28,
    hemiIntensity: 0.78,
    skyZenith: [0.16, 0.38, 0.74],
    skyHorizon: [0.64, 0.79, 0.92],
    skyGlow: [1.0, 0.95, 0.84],
    valleyFogColor: [0.68, 0.80, 0.88],
    aerialFogColor: [0.44, 0.62, 0.84],   // Classic Japanese blue mountain haze (遠山霞)
    valleyFogDensity: 0.00038,
    valleyFogFalloff: 0.0082,
    valleyFogBaseY: -40.0,
    aerialDensity: 0.000088,
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
    sunDir: [-0.84, 0.21, 0.50],          // Dramatic West sunset casting long alpine shadows!
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
    valleyFogDensity: 0.00095,
    valleyFogFalloff: 0.0088,
    valleyFogBaseY: -25.0,
    aerialDensity: 0.000108,
    mieStrength: 0.85,
    starIntensity: 0.22,
    cloudBrightness: 0.75,
    exposure: 1.08,
    horizonShadowBlend: 0.90,
    useEastHorizon: 0.0,
  },
};

export const ATMOSPHERE_ORDER = ['night', 'dawn', 'day', 'dusk'];
