import { VILLAGE } from '../villageData.js';

/**
 * TERRENO 2.0 Engine — Master World Configuration (60,000 m × 60,000 m = 3,600.0 km²)
 * Seamless Non-Mountainous Japanese Countryside & Nature Watershed (Rolling Hills, Alluvial River Plains,
 * Broadleaf Beech/Birch Plateaus, Misty Wetlands & Reed Marshes, Sunlit Susuki Grasslands, Southern Pine Flats),
 * 21 Natural Terrain-Conforming Roads, Suginosato 5-House Village, 4 Atmosphere Presets, & 8 Landmarks.
 */

export const TERRENO_WORLD = {
  width: 60000,         // 60.0 km East–West  (X ∈ [-30000, +30000])
  depth: 60000,         // 60.0 km North–South (Z ∈ [-30000, +30000])
  minX: -30000,
  maxX: 30000,
  minZ: -30000,
  maxZ: 30000,
  // Balanced 1024×1024 macro atlas (1,048,576 cells: ~58.6m grid, fast mobile WebGL2 bake!)
  atlasW: 1024,
  atlasH: 1024,
  // Local compound ground Y (-0.35m) maps to natural river-plain elevation +120.0m ASL
  compoundGroundY: -0.35,
  baseElevationASL: 120.35,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  compoundFlatRadius: 34.0,
  compoundBlendRadius: 150.0,
  // Suginosato 5-House Village natural river-plain terrace lock (exact CPU-GPU parity, zero hill carving!)
  villageCenterX: VILLAGE.centerX,
  villageCenterZ: VILLAGE.centerZ,
  villageGroundY: VILLAGE.groundY,
  villageFlatRadius: VILLAGE.flatRadius,
  villageBlendRadius: VILLAGE.blendRadius,
  // Playable movement bounds (40m inset from outer map rim)
  playMinX: -29960,
  playMaxX: 29960,
  playMinZ: -29960,
  playMaxZ: 29960,
  southRect: {
    minX: -150.0,
    maxX: 150.0,
    minZ: 29860.0,
    maxZ: 29960.0,
    blend: 8.0,
  },
};

function clamp01(v) {
  return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v);
}

function smoothstepQ(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Main 60 km Gentle Meandering River Centerline X(z) and Water Surface Elevation Y_water(z).
 * Flows gently downhill across the 60 km × 60 km countryside from North Woodland Plateau (Z=-30000)
 * past NARROW-50 (X≈+220m, Z=0) and Suginosato Village (Z=+1280, X≈+1460m) to the Southern Plains (Z=+30000).
 */
export function evalMainRiver(z) {
  const t = clamp01((z - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth); // 0 (North) -> 1 (South)
  const x =
    340.0
    + Math.sin(z * 0.00016 + 0.18) * 2800.0
    + Math.sin(z * 0.00042 - 0.55) * 950.0
    + Math.cos(z * 0.00009 + 0.35) * 1150.0
    - 1205.0 * Math.exp(-((z * z) / (2600.0 * 2600.0)));

  // Gentle natural lowland-to-upland riverbed gradient across 60 km (no deep canyons!)
  const bedY = 16.0 * (1.0 - t) - 18.0 * t - 4.2;

  // River channel half-width widens naturally downstream (20m northern stream -> 68m broad southern river)
  const halfWidth = 20.0 + 48.0 * Math.pow(t, 0.90) + Math.sin(z * 0.0008) * 6.0;
  const waterDepth = 2.0 + 2.6 * t;
  return { x, bedY, waterY: bedY + waterDepth, halfWidth, waterDepth };
}

/**
 * Continuous C2-smooth regional biome weights across the 60 km × 60 km non-mountainous world.
 * Guarantees seamless organic transitions between:
 *   - valley:     Central alluvial river plain & cedar/hinoki woods
 *   - hills:      Rolling green hills & pastoral uplands (West / NW)
 *   - plateau:    Broadleaf beech & birch woodland plateau (North / NE)
 *   - wetland:    Misty wetlands, reed marshes & tranquil shallow pools (East)
 *   - meadow:     Expansive sunlit susuki grasslands & prairies (SW / Mid-South)
 *   - southPlain: Broad southern alluvial plains & pine flats (Far South)
 */
export function evalRegionWeights(wx, wz) {
  // Organic 18 km macro domain warp so region boundaries meander naturally with zero seams
  const uX = wx + Math.sin(wz * 0.00014 + 0.6) * 3600.0 + Math.cos((wx + wz) * 0.00009) * 1900.0;
  const uZ = wz + Math.cos(wx * 0.00013 - 0.8) * 3600.0 + Math.sin((wx - wz) * 0.00008) * 1900.0;

  const rv = evalMainRiver(wz);
  const dxRiv = Math.abs(wx - rv.x);
  const dCenter = Math.hypot(wx - 400.0, wz - 600.0);

  let valley = Math.exp(-(dxRiv * dxRiv) / (6800.0 * 6800.0)) * 0.95
    + Math.exp(-(dCenter * dCenter) / (6200.0 * 6200.0)) * 0.85;
  const hills = smoothstepQ(2800.0, -14500.0, uX) * smoothstepQ(13500.0, -7500.0, uZ);
  const plateau = smoothstepQ(-1800.0, -17500.0, uZ) * smoothstepQ(-15000.0, 9500.0, uX);
  const wetland = smoothstepQ(2600.0, 15500.0, uX)
    * smoothstepQ(-18500.0, -3500.0, uZ)
    * smoothstepQ(20500.0, 6500.0, uZ);
  const meadow = smoothstepQ(10500.0, -8500.0, uX)
    * smoothstepQ(2000.0, 15500.0, uZ)
    * smoothstepQ(27500.0, 15000.0, uZ);
  const southPlain = smoothstepQ(11500.0, 23000.0, uZ);

  // Subtle base weight guarantees smooth partition of unity everywhere
  valley += 0.14;
  const sum = valley + hills + plateau + wetland + meadow + southPlain + 1e-6;
  const inv = 1.0 / sum;
  return {
    valley: valley * inv,
    hills: hills * inv,
    plateau: plateau * inv,
    wetland: wetland * inv,
    meadow: meadow * inv,
    southPlain: southPlain * inv,
  };
}

/**
 * 12 Gentle Lowland & Countryside Tributary Streams (小川・支流) feeding the 60 km Main River.
 * Shallow, softly banked rural waterways — zero steep canyon carving!
 */
export const TRIBUTARIES = [
  { id: 'trib_n1', nameJp: '白樺北小川',   z0: -23500, side: -1, dirX: -0.94, dirZ: -0.34, len: 14000, depth: 9,  width: 95 },
  { id: 'trib_n2', nameJp: 'ブナ台地東流', z0: -19000, side:  1, dirX:  0.93, dirZ: -0.37, len: 15000, depth: 10, width: 105 },
  { id: 'trib_n3', nameJp: '北森せせらぎ', z0: -12500, side: -1, dirX: -0.95, dirZ: -0.31, len: 13500, depth: 8,  width: 90 },
  { id: 'trib_n4', nameJp: '朝露東小川',   z0:  -7200, side:  1, dirX:  0.94, dirZ: -0.34, len: 14500, depth: 8,  width: 96 },
  { id: 'trib_c1', nameJp: '西丘陵清流',   z0:  -2600, side: -1, dirX: -0.96, dirZ: -0.28, len: 14000, depth: 7,  width: 86 },
  { id: 'trib_c2', nameJp: '水郷湿原水路', z0:   1800, side:  1, dirX:  0.95, dirZ:  0.31, len: 15500, depth: 6,  width: 110 },
  { id: 'trib_c3', nameJp: '杉ノ郷西小川', z0:   5800, side: -1, dirX: -0.95, dirZ:  0.31, len: 14000, depth: 7,  width: 90 },
  { id: 'trib_c4', nameJp: '葦原東水路',   z0:   9800, side:  1, dirX:  0.93, dirZ:  0.36, len: 15000, depth: 6,  width: 115 },
  { id: 'trib_s1', nameJp: '草原西せせらぎ', z0: 14200, side: -1, dirX: -0.92, dirZ:  0.39, len: 14500, depth: 7,  width: 96 },
  { id: 'trib_s2', nameJp: '南東湖沼流',   z0:  17800, side:  1, dirX:  0.91, dirZ:  0.41, len: 14000, depth: 6,  width: 105 },
  { id: 'trib_s3', nameJp: 'ススキ原小川', z0:  21500, side: -1, dirX: -0.94, dirZ:  0.34, len: 13500, depth: 6,  width: 98 },
  { id: 'trib_s4', nameJp: '松原南水路',   z0:  24600, side:  1, dirX:  0.93, dirZ:  0.36, len: 13000, depth: 5,  width: 104 },
];

// Mountain peaks are intentionally disabled — replaced by rolling hills, plateaus, wetlands, grasslands, & plains.
export const MOUNTAIN_PEAKS = [];

/**
 * 21 Natural Terrain-Conforming Roads across the 60 km × 60 km (3,600 km²) World:
 *   - Road 0: Main Central North–South Trunk Road (existing road extended cleanly across 60 km)
 *   - Roads 1..20: 20 Additional Interconnected Country, Woodland, Riverside, Wetland, Meadow & Plateau Roads!
 * ZERO terrain cutting/carving: every road drapes organically along natural gentle contours.
 */
export const ROAD_NETWORK = [
  // 0. Main Trunk N–S Road (Central spine passing NARROW-50 & Suginosato Village)
  {
    id: 'road_main_ns',
    nameJp: '中央幹線道',
    width: 11.0,
    points: [
      [-1800, -28200],
      [-1200, -24200],
      [ -650, -19800],
      [  420, -16500],
      [  880, -12400],
      [  220,  -8600],
      [ -680,  -5550],
      [ -420,  -2850],
      [ -180,  -1250],
      [  -55,   -420],
      [    1.5,  -16], // NARROW-50 North Driveway
      [  -34,     -8],
      [  -42,     24],
      [  -88,    145],
      [   65,    460],
      [  420,    840],
      [  735,   1140],
      [  788,   1280], // Suginosato 5-House Village West Entrance
      [  772,   1420],
      [  610,   1950],
      [  240,   3200],
      [ -280,   5800],
      [ -920,   9200],
      [-1280,  14800],
      [ -760,  19600],
      [  640,  24200],
      [ 1450,  27600],
    ],
  },
  // 1. Central East–West Grand Route (Crosses full 60 km E–W just north of NARROW-50)
  {
    id: 'road_ew_central',
    nameJp: '東西中央横断道',
    width: 10.5,
    points: [
      [-28000,  -450],
      [-23200,  -820],
      [-17500,  -380],
      [-11800,  -950],
      [ -6200,  -520],
      [ -1800,  -420],
      [   -55,  -420],
      [  2400,  -580],
      [  7600,  -320],
      [ 12800,  -860],
      [ 17800,  -420],
      [ 23400,  -680],
      [ 28000,  -280],
    ],
  },
  // 2. Northern Woodland Plateau East–West Route
  {
    id: 'road_ew_north_plateau',
    nameJp: '北部台地横断道',
    width: 10.0,
    points: [
      [-27400, -16200],
      [-22000, -17100],
      [-17200, -16500],
      [-11200, -15800],
      [ -5400, -16900],
      [   420, -16500],
      [  6400, -15900],
      [ 12200, -16800],
      [ 17800, -16300],
      [ 23200, -15600],
      [ 27400, -16400],
    ],
  },
  // 3. Southern Susuki Grassland East–West Route
  {
    id: 'road_ew_south_meadow',
    nameJp: '南部大草原横断道',
    width: 10.0,
    points: [
      [-27400, 14600],
      [-22200, 15400],
      [-17400, 14900],
      [-11600, 14200],
      [ -6200, 15100],
      [ -1280, 14800],
      [  5400, 14400],
      [ 11800, 15200],
      [ 17800, 14700],
      [ 23000, 15500],
      [ 27400, 14900],
    ],
  },
  // 4. Far-North Woodland Panorama Avenue
  {
    id: 'road_ew_far_north',
    nameJp: '最北森林パノラマ道',
    width: 9.5,
    points: [
      [-25200, -24800],
      [-19400, -25600],
      [-13200, -24600],
      [ -7200, -25400],
      [ -1200, -24200],
      [  5200, -25100],
      [ 11800, -24500],
      [ 18200, -25300],
      [ 25000, -24400],
    ],
  },
  // 5. Southern Pine-Flats Crossway (stays comfortably north of southern boundary)
  {
    id: 'road_ew_south_pine',
    nameJp: '南部松原横断道',
    width: 9.5,
    points: [
      [-24800, 24000],
      [-18800, 24700],
      [-12600, 23800],
      [ -6400, 24500],
      [   640, 24200],
      [  7200, 23700],
      [ 13600, 24600],
      [ 19400, 23900],
      [ 24800, 24400],
    ],
  },
  // 6. West Rolling Hills North–South Route
  {
    id: 'road_ns_west_hills',
    nameJp: '西丘陵縦貫道',
    width: 10.0,
    points: [
      [-17200, -26800],
      [-18100, -21800],
      [-17200, -16500],
      [-16400, -10800],
      [-17900,  -5600],
      [-17500,   -380],
      [-16800,   4600],
      [-18200,   9800],
      [-17400,  14900],
      [-16600,  20200],
      [-17800,  26200],
    ],
  },
  // 7. East Wetlands & Lakes North–South Route
  {
    id: 'road_ns_east_wetland',
    nameJp: '東水郷縦貫道',
    width: 10.0,
    points: [
      [17800, -26800],
      [18600, -21600],
      [17800, -16300],
      [17100, -10600],
      [18400,  -5400],
      [17800,   -420],
      [17200,   4800],
      [18500,   9900],
      [17800,  14700],
      [17000,  20100],
      [18100,  26200],
    ],
  },
  // 8. Far-West Meadow Corridor
  {
    id: 'road_ns_far_west',
    nameJp: '最西牧野縦貫道',
    width: 9.0,
    points: [
      [-25200, -24800],
      [-26400, -19200],
      [-25600, -12400],
      [-26800,  -6200],
      [-26000,   -450],
      [-26600,   6400],
      [-25400,  13200],
      [-26400,  19400],
      [-24800,  24000],
    ],
  },
  // 9. Far-East Lakeside Corridor
  {
    id: 'road_ns_far_east',
    nameJp: '最東湖畔縦貫道',
    width: 9.0,
    points: [
      [25000, -24400],
      [26300, -18800],
      [25600, -12000],
      [26600,  -5800],
      [26000,   -280],
      [26500,   6800],
      [25500,  13400],
      [26200,  19200],
      [24800,  24400],
    ],
  },
  // 10. Village-to-East-Wetlands Scenic Lane
  {
    id: 'road_village_east',
    nameJp: '杉ノ郷・東湿原連絡道',
    width: 9.2,
    points: [
      [  788,  1280],
      [ 1650,  1620],
      [ 3600,  2150],
      [ 6800,  2750],
      [10400,  3450],
      [14200,  4200],
      [17200,  4800],
      [21800,  5800],
      [26500,  6800],
    ],
  },
  // 11. Central-to-West-Hills Scenic Lane
  {
    id: 'road_center_west',
    nameJp: '中央・西丘陵連絡道',
    width: 9.2,
    points: [
      [  -88,   145],
      [-1850,  1120],
      [-4600,  2180],
      [-8200,  3100],
      [-12400, 3950],
      [-16800, 4600],
      [-21600, 5600],
      [-26600, 6400],
    ],
  },
  // 12. NW Birch Grove Diagonal
  {
    id: 'road_diag_nw',
    nameJp: '北西白樺めぐり道',
    width: 9.0,
    points: [
      [ -680,  -5550],
      [-4200,  -8400],
      [-8600, -11600],
      [-13200, -14800],
      [-17200, -16500],
      [-21500, -20600],
      [-25200, -24800],
    ],
  },
  // 13. NE Beech Plateau Diagonal
  {
    id: 'road_diag_ne',
    nameJp: '北東ブナ台地道',
    width: 9.0,
    points: [
      [  220,  -8600],
      [ 4600, -11200],
      [ 9200, -13800],
      [13800, -15800],
      [17800, -16300],
      [21600, -20200],
      [25000, -24400],
    ],
  },
  // 14. SW Susuki Prairie Diagonal
  {
    id: 'road_diag_sw',
    nameJp: '南西ススキ草原道',
    width: 9.0,
    points: [
      [ -280,   5800],
      [-4400,   8600],
      [-8800,  11600],
      [-13200, 14200],
      [-17400, 14900],
      [-21200, 19600],
      [-24800, 24000],
    ],
  },
  // 15. SE River-Plain Diagonal
  {
    id: 'road_diag_se',
    nameJp: '南東河岸平野道',
    width: 9.0,
    points: [
      [  610,   1950],
      [ 4800,   5800],
      [ 9400,   9800],
      [13800,  13200],
      [17800,  14700],
      [21400,  19500],
      [24800,  24400],
    ],
  },
  // 16. Inner Regional Scenic Ring Road (~8.5 km radius loop around Central Valley)
  {
    id: 'road_inner_ring',
    nameJp: '中央環状ドライブ道',
    width: 9.5,
    points: [
      [  220,  -8600],
      [ 5400,  -7800],
      [ 8800,  -4600],
      [ 9600,   -320],
      [ 8600,   4200],
      [ 5200,   8200],
      [ -920,   9200],
      [-5800,   8100],
      [-8900,   4100],
      [-9400,   -620],
      [-8400,  -4900],
      [-4800,  -7900],
      [  220,  -8600],
    ],
  },
  // 17. West Riverside Scenic Track
  {
    id: 'road_river_west',
    nameJp: '黒杉川・西岸リバーサイド道',
    width: 8.8,
    points: [
      [-4600, -21000],
      [-4200, -15400],
      [-3900,  -9800],
      [-3400,  -4400],
      [-2600,   1200],
      [-3800,   6800],
      [-4800,  12400],
      [-5400,  18200],
      [-4600,  23800],
    ],
  },
  // 18. East Riverside Meadow Lane
  {
    id: 'road_river_east',
    nameJp: '黒杉川・東岸せせらぎ道',
    width: 8.8,
    points: [
      [ 5400, -20800],
      [ 5800, -15200],
      [ 5400,  -9600],
      [ 4800,  -4200],
      [ 4400,   1600],
      [ 5200,   7200],
      [ 6000,  12800],
      [ 6400,  18600],
      [ 5600,  23800],
    ],
  },
  // 19. North-West Rolling Hills Loop
  {
    id: 'road_nw_hills_loop',
    nameJp: '北西丘陵パノラマループ',
    width: 8.8,
    points: [
      [-11200, -15800],
      [ -8600, -19600],
      [-11800, -22800],
      [-16400, -21400],
      [-17200, -16500],
      [-14600, -12400],
      [-10200, -12200],
      [-11200, -15800],
    ],
  },
  // 20. South-East Marsh & Meadow Scenic Branch
  {
    id: 'road_se_marsh_loop',
    nameJp: '南東水辺と草原の周遊道',
    width: 8.8,
    points: [
      [11800, 15200],
      [ 9200, 19200],
      [12600, 22400],
      [16800, 20800],
      [17800, 14700],
      [15200, 10800],
      [11200, 11400],
      [11800, 15200],
    ],
  },
];

// Backward-compatible export for modules referencing the primary trunk road
export const FOREST_ROAD_POINTS = ROAD_NETWORK[0].points;

/**
 * 8 Curated Scenic Landmarks across the 60 km × 60 km (3,600 km²) Non-Mountainous Landscape.
 */
export const TERRENO_LANDMARKS = [
  {
    id: 'compound',
    code: 'BASE',
    nameJp: '母屋 NARROW-50 拠点',
    desc: '標高 +120m 中央清流平野（5拠点・地下4層・車両待機所）',
    x: -1.8,
    z: -14.5,
    yaw: Math.PI + 0.12,
    pitch: 0.02,
  },
  {
    id: 'village',
    code: 'VLG',
    nameJp: '杉ノ郷 集落（5棟の里）',
    desc: '標高 +119m 河岸平野に佇む5軒の家・石畳広場・水場・鎮守の社（南東 1.5km）',
    x: VILLAGE.centerX - 24.5,
    z: VILLAGE.centerZ + 0.2,
    yaw: -Math.PI * 0.5,
    pitch: -0.02,
  },
  {
    id: 'gorge_river',
    code: 'RIVER',
    nameJp: '黒杉川・清流河原',
    desc: 'ゆったり蛇行する清流と草原河原（拠点東 220m）',
    x: evalMainRiver(220).x - evalMainRiver(220).halfWidth - 6.0,
    z: 220,
    yaw: Math.PI + 0.18,
    pitch: -0.04,
  },
  {
    id: 'north_plateau',
    code: 'NORTH',
    nameJp: '北部ブナ・白樺の森林台地',
    desc: '広大な落葉広葉樹林と穏やかな台地ロード（北 16.5km）',
    x: 420,
    z: -16500,
    yaw: Math.PI,
    pitch: -0.03,
  },
  {
    id: 'west_hills',
    code: 'HILLS',
    nameJp: '西方のなだらか緑の丘陵',
    desc: '緩やかな起伏が連なる牧歌的な丘陵地帯（西 17.5km）',
    x: -17500,
    z: -380,
    yaw: -Math.PI * 0.5,
    pitch: -0.04,
  },
  {
    id: 'east_wetland',
    code: 'MARSH',
    nameJp: '東水郷・霧の湿原と葦原',
    desc: '静かな水辺と湿原草原が広がる水郷地帯（東 17.8km）',
    x: 17800,
    z: 4800,
    yaw: Math.PI * 0.45,
    pitch: -0.03,
  },
  {
    id: 'sw_prairie',
    code: 'PLAIN',
    nameJp: '南西ススキ大草原',
    desc: '地平線まで見渡せる広大な黄金色の草原（南西 19km）',
    x: -13200,
    z: 14200,
    yaw: -0.65,
    pitch: -0.02,
  },
  {
    id: 'south_pines',
    code: 'SOUTH',
    nameJp: '南部沖積平野・松原原野',
    desc: '南へ広がる穏やかな松林と砂壌土の大平野（南 24km）',
    x: 640,
    z: 24200,
    yaw: 0.10,
    pitch: -0.02,
  },
];

/**
 * 4 Physically-Calibrated Countryside Atmosphere & Time-of-Day Presets (tuned for 60 km × 60 km horizons).
 */
export const ATMOSPHERE_PRESETS = {
  night: {
    id: 'night',
    labelJp: '月夜',
    fullNameJp: '月夜の森と草原（NARROW-50標準）',
    sunDir: [-0.34, 0.44, 0.83],
    sunColor: [0.56, 0.72, 0.96],
    sunIntensity: 1.48,
    hemiSky: 0x2c4b72,
    hemiGround: 0x0b100e,
    hemiIntensity: 0.25,
    skyZenith: [0.015, 0.032, 0.068],
    skyHorizon: [0.065, 0.118, 0.195],
    skyGlow: [0.22, 0.34, 0.54],
    valleyFogColor: [0.075, 0.135, 0.215],
    aerialFogColor: [0.048, 0.088, 0.158],
    valleyFogDensity: 0.00024,
    valleyFogFalloff: 0.018,
    valleyFogBaseY: -18.0,
    aerialDensity: 0.000046,
    mieStrength: 0.32,
    starIntensity: 1.0,
    cloudBrightness: 0.20,
    exposure: 1.12,
    horizonShadowBlend: 0.55,
    useEastHorizon: 0.0,
  },
  dawn: {
    id: 'dawn',
    labelJp: '朝霧',
    fullNameJp: '夜明け・朝霧の田園と丘陵',
    sunDir: [0.84, 0.23, 0.49],
    sunColor: [1.0, 0.72, 0.46],
    sunIntensity: 2.85,
    hemiSky: 0x7b98c2,
    hemiGround: 0x262824,
    hemiIntensity: 0.64,
    skyZenith: [0.11, 0.22, 0.44],
    skyHorizon: [0.88, 0.56, 0.38],
    skyGlow: [1.0, 0.74, 0.44],
    valleyFogColor: [0.86, 0.78, 0.72],
    aerialFogColor: [0.46, 0.54, 0.72],
    valleyFogDensity: 0.00062,
    valleyFogFalloff: 0.022,
    valleyFogBaseY: -8.0,
    aerialDensity: 0.000044,
    mieStrength: 0.78,
    starIntensity: 0.08,
    cloudBrightness: 0.92,
    exposure: 1.06,
    horizonShadowBlend: 0.78,
    useEastHorizon: 1.0,
  },
  day: {
    id: 'day',
    labelJp: '深緑',
    fullNameJp: '晴天の広大な平野と丘陵',
    sunDir: [0.42, 0.74, 0.52],
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 3.15,
    hemiSky: 0x89b8e6,
    hemiGround: 0x2b3a28,
    hemiIntensity: 0.80,
    skyZenith: [0.16, 0.38, 0.74],
    skyHorizon: [0.64, 0.79, 0.92],
    skyGlow: [1.0, 0.95, 0.84],
    valleyFogColor: [0.68, 0.80, 0.88],
    aerialFogColor: [0.44, 0.62, 0.84],
    valleyFogDensity: 0.00016,
    valleyFogFalloff: 0.018,
    valleyFogBaseY: -16.0,
    aerialDensity: 0.000038,
    mieStrength: 0.42,
    starIntensity: 0.0,
    cloudBrightness: 1.0,
    exposure: 1.00,
    horizonShadowBlend: 0.72,
    useEastHorizon: 1.0,
  },
  dusk: {
    id: 'dusk',
    labelJp: '夕映',
    fullNameJp: '黄昏の草原と水辺の夕映え',
    sunDir: [-0.84, 0.21, 0.50],
    sunColor: [1.0, 0.50, 0.28],
    sunIntensity: 2.65,
    hemiSky: 0x5c4c78,
    hemiGround: 0x201818,
    hemiIntensity: 0.50,
    skyZenith: [0.09, 0.11, 0.28],
    skyHorizon: [0.90, 0.42, 0.26],
    skyGlow: [1.0, 0.52, 0.24],
    valleyFogColor: [0.56, 0.42, 0.54],
    aerialFogColor: [0.36, 0.28, 0.44],
    valleyFogDensity: 0.00042,
    valleyFogFalloff: 0.020,
    valleyFogBaseY: -12.0,
    aerialDensity: 0.000048,
    mieStrength: 0.85,
    starIntensity: 0.22,
    cloudBrightness: 0.75,
    exposure: 1.08,
    horizonShadowBlend: 0.80,
    useEastHorizon: 0.0,
  },
};

export const ATMOSPHERE_ORDER = ['night', 'dawn', 'day', 'dusk'];
