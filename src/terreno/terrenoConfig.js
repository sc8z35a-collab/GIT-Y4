import { VILLAGE } from '../villageData.js';

/**
 * TERRENO 3.0 Engine — Master World Configuration (60,000 m × 60,000 m = 3,600.0 km²)
 * Photorealistic Japanese Mountain-Valley & Old-Growth Forest Watershed (inspired by Kamikochi,
 * Yakushima, Kurobe & Okutama):
 *   - 18 Sculpted Alpine & Foothill Mountain Massifs (rising 240m..1,420m above the central valley!)
 *   - Winding Valley & Mountain Forestry Roads (ZERO artificial flat chessboard grid!)
 *   - Meandering Emerald Mountain River (黒杉川) & 12 Cascading Mountain Tributaries
 *   - Full 3D Architectural River & Stream Bridges across EVERY crossing (100% driveable!)
 *   - Tight Natural Terraces for NARROW-50 Compound, Suginosato 5-House Village, & NULL EREA
 */

export const TERRENO_WORLD = {
  width: 60000,         // 60.0 km East–West  (X ∈ [-30000, +30000])
  depth: 60000,         // 60.0 km North–South (Z ∈ [-30000, +30000])
  minX: -30000,
  maxX: 30000,
  minZ: -30000,
  maxZ: 30000,
  // 1024×1024 Float32 macro geomorphology atlas (paired with 1.0m-resolution dynamic local detail map!)
  atlasW: 1024,
  atlasH: 1024,
  // Local compound ground Y (-0.35m) maps to natural river-valley elevation +320.0m ASL
  compoundGroundY: -0.35,
  baseElevationASL: 320.35,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  // Tight natural terrace — real forested slopes & foothills begin right outside the yard!
  compoundFlatRadius: 29.0,
  compoundBlendRadius: 76.0,
  // Suginosato 5-House Village natural river-terrace lock
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
    blend: 14.0,
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
 * Main 60 km Meandering Emerald Mountain River Centerline X(z) and Water Surface Elevation Y_water(z).
 * Flows downhill from Northern Alpine Gorge (Z=-30000) past NARROW-50 (X≈+220m, Z=0)
 * and Suginosato Village (Z=+1280, X≈+1460m) toward the Southern Foothill Valley (Z=+30000).
 */
export function evalMainRiver(z) {
  const t = clamp01((z - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth); // 0 (North) -> 1 (South)
  const x =
    340.0
    + Math.sin(z * 0.00016 + 0.18) * 2800.0
    + Math.sin(z * 0.00042 - 0.55) * 950.0
    + Math.cos(z * 0.00009 + 0.35) * 1150.0
    - 1205.0 * Math.exp(-((z * z) / (2600.0 * 2600.0)));

  // Authentic alpine valley river gradient: +24m in North -> -24m in South, passing ~-5.2m bed at Z=0
  const bedY = 22.0 * (1.0 - t) - 24.0 * t - 4.2;

  // River channel half-width widens organically downstream (18m mountain torrent -> 56m broad valley river)
  const halfWidth = 18.0 + 38.0 * Math.pow(t, 0.92) + Math.sin(z * 0.00085) * 5.0;
  const waterDepth = 2.1 + 2.4 * t;
  return { x, bedY, waterY: bedY + waterDepth, halfWidth, waterDepth };
}

/**
 * 18 Sculpted Real-World Japanese Mountain Massifs, Volcanic Spires & Forested Ridges!
 * Placed organically around the valley corridors so:
 *   - Stepping outside NARROW-50 immediately reveals dramatic layered forested peaks (320m..680m!)
 *   - Distant horizons showcase majestic 900m..1,420m alpine granite peaks with snow couloirs!
 *   - Every valley road & river bridge passes naturally through scenic mountain passes & saddles.
 */
export const MOUNTAIN_PEAKS = [
  // Immediate Dramatic Valley Walls framing NARROW-50 & Suginosato Village (visible right from spawn!)
  { id: 'pk_kurosugi_w',  nameJp: '黒杉西岳',   x:  -1180, z:   -620, height:  310, radiusX: 1150, radiusZ:  980, ridgeAngle:  0.42, sharpness: 1.18 },
  { id: 'pk_suginomine',  nameJp: '杉ノ峰',     x:   1620, z:   -480, height:  365, radiusX: 1280, radiusZ: 1150, ridgeAngle: -0.35, sharpness: 1.22 },
  { id: 'pk_shirakaba_sw',nameJp: '白樺山',     x:  -1520, z:   1650, height:  340, radiusX: 1320, radiusZ: 1220, ridgeAngle:  0.85, sharpness: 1.15 },
  { id: 'pk_momiji_e',    nameJp: '紅葉ヶ岳',   x:   2750, z:   2250, height:  410, radiusX: 1550, radiusZ: 1400, ridgeAngle: -0.62, sharpness: 1.24 },
  { id: 'pk_okutani_n',   nameJp: '奥谷岳',     x:   -950, z:  -3250, height:  470, radiusX: 1750, radiusZ: 1600, ridgeAngle:  0.22, sharpness: 1.28 },
  { id: 'pk_kiri_e',      nameJp: '霧見山',     x:   2250, z:  -3100, height:  445, radiusX: 1650, radiusZ: 1520, ridgeAngle: -0.48, sharpness: 1.20 },

  // Mid-Range Alpine Massifs (3..14 km — majestic skyline layers with subalpine ridges & cliffs!)
  { id: 'pk_hakuun',      nameJp: '白雲岳',     x:  -6400, z:  -8800, height:  940, radiusX: 4600, radiusZ: 4200, ridgeAngle:  0.55, sharpness: 1.38 },
  { id: 'pk_yakumo',      nameJp: '八雲連峰',   x:   7200, z:  -9600, height: 1020, radiusX: 5200, radiusZ: 4600, ridgeAngle: -0.32, sharpness: 1.42 },
  { id: 'pk_asagiri',     nameJp: '朝霧岳',     x:  -7800, z:   5800, height:  820, radiusX: 4400, radiusZ: 4100, ridgeAngle:  0.74, sharpness: 1.32 },
  { id: 'pk_suigo_ridge', nameJp: '水郷連山',   x:  11200, z:   8400, height:  680, radiusX: 4800, radiusZ: 4400, ridgeAngle: -0.58, sharpness: 1.25 },
  { id: 'pk_minami_dake', nameJp: '南杉岳',     x:  -5400, z:  16200, height:  790, radiusX: 4500, radiusZ: 4000, ridgeAngle:  0.28, sharpness: 1.30 },
  { id: 'pk_takanashi',   nameJp: '鷹ノ巣山',   x:   8400, z:  17600, height:  720, radiusX: 4400, radiusZ: 3900, ridgeAngle: -0.44, sharpness: 1.26 },

  // Grand Outer Japanese Alps Cathedral Peaks (14..26 km — snow-couloir granite titans on the horizon!)
  { id: 'pk_kita_alps_w', nameJp: '北辰槍ヶ岳', x: -16800, z: -20500, height: 1380, radiusX: 7400, radiusZ: 6800, ridgeAngle:  0.38, sharpness: 1.52 },
  { id: 'pk_kita_alps_e', nameJp: '東天穂高岳', x:  15600, z: -21200, height: 1420, radiusX: 7600, radiusZ: 6900, ridgeAngle: -0.46, sharpness: 1.55 },
  { id: 'pk_west_giant',  nameJp: '西嶺大岳',   x: -21800, z:  -2400, height: 1180, radiusX: 6800, radiusZ: 6400, ridgeAngle:  0.18, sharpness: 1.44 },
  { id: 'pk_east_giant',  nameJp: '東雲高峰',   x:  21400, z:  -4600, height: 1090, radiusX: 6500, radiusZ: 6000, ridgeAngle: -0.64, sharpness: 1.40 },
  { id: 'pk_sw_alps',     nameJp: '南西剣岳',   x: -19500, z:  19200, height: 1120, radiusX: 6600, radiusZ: 6100, ridgeAngle:  0.52, sharpness: 1.42 },
  { id: 'pk_se_alps',     nameJp: '南東霧島峰', x:  19800, z:  20400, height:  960, radiusX: 6200, radiusZ: 5800, ridgeAngle: -0.38, sharpness: 1.35 },
];

/**
 * Continuous C2-smooth regional biome weights across the 60 km × 60 km mountain-forest watershed.
 *   - valley:     Lush mixed Cedar/Hinoki/Maple/Beech river valley & mossy gorge floors
 *   - hills:      Dramatic forested western mountain foothills, birch groves & rocky spurs
 *   - plateau:    Ancient northern Buna Beech, White Birch & Maple highland forest
 *   - wetland:    Misty eastern mountain-basin marshlands, willow creeks & tranquil pools
 *   - meadow:     Sunlit southwestern alpine-foothill susuki meadows & open pine ridges
 *   - southPlain: Southern forested foothill valley, red-pine bluffs & alluvial terraces
 */
export function evalRegionWeights(wx, wz) {
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
 * 12 Cascading Mountain Tributary Streams (渓流・支流) carving forested valleys into 黒杉川.
 */
export const TRIBUTARIES = [
  { id: 'trib_n1', nameJp: '白樺北渓流',   z0: -23500, side: -1, dirX: -0.94, dirZ: -0.34, len: 14000, depth: 26, width: 92 },
  { id: 'trib_n2', nameJp: 'ブナ台地東沢', z0: -19000, side:  1, dirX:  0.93, dirZ: -0.37, len: 15000, depth: 28, width: 102 },
  { id: 'trib_n3', nameJp: '奥谷北せせらぎ',z0: -12500, side: -1, dirX: -0.95, dirZ: -0.31, len: 13500, depth: 22, width: 88 },
  { id: 'trib_n4', nameJp: '朝露東渓流',   z0:  -7200, side:  1, dirX:  0.94, dirZ: -0.34, len: 14500, depth: 22, width: 94 },
  { id: 'trib_c1', nameJp: '西山清流沢',   z0:  -2600, side: -1, dirX: -0.96, dirZ: -0.28, len: 14000, depth: 18, width: 84 },
  { id: 'trib_c2', nameJp: '水郷東渓谷流', z0:   1800, side:  1, dirX:  0.95, dirZ:  0.31, len: 15500, depth: 16, width: 105 },
  { id: 'trib_c3', nameJp: '杉ノ郷西小川', z0:   5800, side: -1, dirX: -0.95, dirZ:  0.31, len: 14000, depth: 18, width: 88 },
  { id: 'trib_c4', nameJp: '紅葉東沢',     z0:   9800, side:  1, dirX:  0.93, dirZ:  0.36, len: 15000, depth: 16, width: 108 },
  { id: 'trib_s1', nameJp: '草原西渓流',   z0:  14200, side: -1, dirX: -0.92, dirZ:  0.39, len: 14500, depth: 18, width: 94 },
  { id: 'trib_s2', nameJp: '南東湖沼沢',   z0:  17800, side:  1, dirX:  0.91, dirZ:  0.41, len: 14000, depth: 16, width: 100 },
  { id: 'trib_s3', nameJp: 'ススキ原小川', z0:  21500, side: -1, dirX: -0.94, dirZ:  0.34, len: 13500, depth: 15, width: 92 },
  { id: 'trib_s4', nameJp: '松原南清流',   z0:  24600, side:  1, dirX:  0.93, dirZ:  0.36, len: 13000, depth: 14, width: 96 },
];

/**
 * Organic, Sinuous Japanese Mountain Forestry & Valley Road Network (16 Scenic Routes).
 * Abolishes the old artificial straight chessboard highways:
 *   - Every road snakes organically along river terraces, forested saddles, and mountain contours
 *   - Roads NEVER run longitudinally inside riverbeds — EVERY river crossing occurs cleanly via a
 *     real 3D Architectural Bridge (steel arch/truss or mountain timber-steel composite bridge)!
 *   - Includes an immediate scenic NARROW-50 -> Kurosugi Great Bridge -> East Bank Forest route!
 */
export const ROAD_NETWORK = [
  // 0. Central Valley Winding Trunk Road (NARROW-50 <-> Suginosato Village <-> North Pass <-> NULL EREA)
  // Hugs the sculpted West riverbank terrace and crosses Kurosugi River ONLY via crisp 3D Bridges!
  {
    id: 'road_main_ns',
    nameJp: '黒杉渓谷本道',
    width: 8.6,
    points: [
      [-1650, -27800],
      [-1250, -24200],
      [-1420, -20600],
      [-2320, -16500],
      [-1640, -12400],
      [ -920,  -8600],
      [-1040,  -5600],
      [ -940,  -2850],
      [ -680,  -1250],
      [ -290,   -480],
      [  -82,   -185],
      [    1.5,  -18], // NARROW-50 North Driveway
      [  -34,     -8],
      [  -48,     32],
      [  -92,    155],
      [   78,    480],
      [  410,    840],
      [  720,   1140],
      [  788,   1280], // Suginosato 5-House Village West Entrance
      [  765,   1460],
      [  620,   2020],
      [  260,   3280],
      [ -260,   5820],
      [ -890,   9200],
      [-1260,  14800],
      [-1150,  19600],
      [-1920,  21750],
      [ -620,  21820], // Crisp perpendicular bridge crossing Kurosugi River at Z≈21790!
      [  480,  24200],
      [  920,  27400],
      [   28,  29840], // Smooth scenic descent into NULL EREA!
    ],
  },
  // 1. NARROW-50 Immediate Scenic River-Bridge Spur (Crosses Kurosugi River via Kurosugi Ohashi Grand Bridge at Z≈-34!)
  {
    id: 'road_home_bridge_east',
    nameJp: '黒杉大橋・東岸森林道',
    width: 8.4,
    points: [
      [    1.5,   -18],
      [   78,     -28],
      [  390,     -44], // Crosses Kurosugi River cleanly via Kurosugi Ohashi Grand Bridge!
      [  760,    -120],
      [ 1240,    -260],
      [ 2180,    -520],
      [ 3650,    -440],
      [ 5400,    -180],
      [ 7800,    -420],
      [11200,    -880],
      [14800,    -540],
      [18200,    -420],
      [22600,    -760],
      [26800,    -340],
    ],
  },
  // 2. Central West Mountain Pass Road (Winds organically up from NARROW-50 into Western Hills)
  {
    id: 'road_center_west',
    nameJp: '西嶺もみじ峠道',
    width: 8.2,
    points: [
      [  -92,    155],
      [ -780,    420],
      [-1920,    960],
      [-3600,   1480],
      [-5800,   1240],
      [-8400,    480],
      [-11600,  -460],
      [-14800,  -720],
      [-17500,  -380],
      [-21200,  -860],
      [-25600,  -450],
    ],
  },
  // 3. Suginosato Village -> Kurosugi East Bridge -> Misty Wetland Sanctuary Road
  {
    id: 'road_village_east',
    nameJp: '杉ノ郷橋・水郷渓谷道',
    width: 8.4,
    points: [
      [  788,   1280],
      [ 1140,   1410],
      [ 1880,   1620], // Crosses Kurosugi River cleanly via Suginosato Bridge!
      [ 3150,   1940],
      [ 4850,   2380],
      [ 7400,   2880],
      [10600,   3520],
      [14200,   4220],
      [17200,   4800],
      [21600,   5760],
      [26200,   6720],
    ],
  },
  // 4. Northern Beech Highland Pass (East-West winding forestry road crossing Kurosugi Gorge Bridge)
  {
    id: 'road_ew_north_plateau',
    nameJp: '北部ブナ峠横断林道',
    width: 8.2,
    points: [
      [-25400, -16200],
      [-20800, -17100],
      [-16800, -16200],
      [-11400, -15400],
      [ -6200, -16400],
      [ -2320, -16500],
      [ -1250, -16520], // Crosses Kurosugi River cleanly at X≈-1823 via North Gorge Arch Bridge!
      [  2600, -16100],
      [  6800, -15600],
      [ 11800, -16400],
      [ 17400, -16200],
      [ 22400, -15500],
      [ 26200, -16200],
    ],
  },
  // 5. Southern Susuki Meadow Valley Route (Crosses Kurosugi River via Susuki Bridge)
  {
    id: 'road_ew_south_meadow',
    nameJp: '南部ススキ高原渓谷道',
    width: 8.2,
    points: [
      [-25400, 14600],
      [-20800, 15200],
      [-16800, 14600],
      [-11800, 13900],
      [ -6600, 14800],
      [ -1260, 14800],
      [  2200, 14500], // Crosses Kurosugi River at X≈+1228 via Susuki Valley Bridge!
      [  6200, 14200],
      [ 11600, 15000],
      [ 17400, 14600],
      [ 22400, 15300],
      [ 25800, 14800],
    ],
  },
  // 6. Far-North Alpine Birch Forest Scenic Route
  {
    id: 'road_ew_far_north',
    nameJp: '最北白樺パノラマ林道',
    width: 7.8,
    points: [
      [-24200, -24400],
      [-18600, -25200],
      [-12600, -24200],
      [ -6800, -24900],
      [ -1150, -24200],
      [  4200, -24800], // Crosses Kurosugi River at X≈+2640 via Shirakaba North Bridge!
      [ 10400, -24200],
      [ 17400, -24800],
      [ 24200, -24100],
    ],
  },
  // 7. Southern Red-Pine Valley Crossway
  {
    id: 'road_ew_south_pine',
    nameJp: '南部アカマツ渓流道',
    width: 8.0,
    points: [
      [-23800, 23800],
      [-17800, 24400],
      [-11800, 23600],
      [ -6200, 24200],
      [ -1600, 24250], // Crosses Kurosugi River at X≈-2990 via Akamatsu Bridge!
      [   480, 24200],
      [  6800, 23600],
      [ 13200, 24400],
      [ 19200, 23800],
      [ 23800, 24200],
    ],
  },
  // 8. Scenic Inner Valley Loop Ring (Connects East & West Banks with 2 Grand River Bridges!)
  {
    id: 'road_inner_ring',
    nameJp: '黒杉渓谷周遊ループ',
    width: 8.2,
    points: [
      [ -920,  -8600],
      [  220,  -8580], // Crosses Kurosugi River cleanly at X≈-408 via North Ring Arch Bridge!
      [ 3400,  -8100],
      [ 7400,  -5200],
      [ 8800,   -420],
      [ 8200,   4100],
      [ 5400,   7800],
      [ 2100,   8800], // Crosses Kurosugi River cleanly via South Ring Bridge!
      [ -890,   9200],
      [-4800,   8200],
      [-8200,   4200],
      [-8600,    480],
      [-7600,  -4600],
      [-3800,  -7800],
      [ -920,  -8600],
    ],
  },
  // 9. West Foothill Forest Winding Route (North-South through Western Mountains)
  {
    id: 'road_ns_west_hills',
    nameJp: '西山麓ブナ林道',
    width: 8.0,
    points: [
      [-16800, -25200],
      [-17800, -20600],
      [-16800, -16200],
      [-15400, -10400],
      [-16800,  -5200],
      [-17500,   -380],
      [-16200,   4600],
      [-17600,   9800],
      [-16800,  14600],
      [-15800,  19800],
      [-17200,  24800],
    ],
  },
  // 10. East Wetland & Lake Scenic Route (North-South through Eastern Mountains)
  {
    id: 'road_ns_east_wetland',
    nameJp: '東水郷・湖畔森林道',
    width: 8.0,
    points: [
      [17400, -24800],
      [18200, -20200],
      [17400, -16200],
      [16400, -10400],
      [17800,  -5200],
      [18200,   -420],
      [17200,   4800],
      [18200,   9800],
      [17400,  14600],
      [16600,  19800],
      [17800,  24400],
    ],
  },
  // 11. West Bank Riverside Forestry Track (Follows Kurosugi River West Terraces)
  {
    id: 'road_river_west',
    nameJp: '黒杉川・西岸林道',
    width: 7.8,
    points: [
      [-3600, -20800],
      [-3400, -15400],
      [-3200,  -9800],
      [-2800,  -4400],
      [-1920,    960],
      [-3200,   6600],
      [-4200,  12200],
      [-4800,  18000],
      [-4400,  23600],
    ],
  },
  // 12. East Bank Riverside Forestry Track (Follows Kurosugi River East Terraces — linked via multiple bridges!)
  {
    id: 'road_river_east',
    nameJp: '黒杉川・東岸せせらぎ林道',
    width: 7.8,
    points: [
      [ 4600, -20400],
      [ 5200, -15000],
      [ 4800,  -9400],
      [ 3650,   -440],
      [ 3150,   1940],
      [ 4950,   5400],
      [ 5400,   7800],
      [ 5800,  12800],
      [ 6200,  18400],
      [ 5400,  23600],
    ],
  },
  // 13. Mid-North Gorge Bridge Connector (Crosses Kurosugi River cleanly at Z≈-5550!)
  {
    id: 'road_bridge_mid_north',
    nameJp: '奥谷渓谷橋連絡道',
    width: 8.0,
    points: [
      [-2800, -4400],
      [-1650, -5100],
      [-1040, -5600],
      [  220, -5520], // Crisp perpendicular bridge crossing Kurosugi River at X≈-599!
      [ 2100, -5150],
      [ 4400, -4400],
    ],
  },
  // 14. Mid-South Gorge Bridge Connector (Crosses Kurosugi River at Z≈+5500!)
  {
    id: 'road_bridge_mid_south',
    nameJp: '紅葉大橋・南東連絡道',
    width: 8.0,
    points: [
      [  -260,  5820],
      [  2100,  5600],
      [  4950,  5400], // Crosses Kurosugi River at X≈+4480 via Momiji Ohashi Bridge!
      [  8600,  7600],
      [ 13200, 11800],
      [ 17400, 14600],
    ],
  },
  // 15. South-West Susuki & South-East Forest Connector
  {
    id: 'road_diag_sw',
    nameJp: '南西ススキ峠道',
    width: 7.8,
    points: [
      [  -260,  5820],
      [ -4200,  8400],
      [ -8600, 11400],
      [-12800, 13900],
      [-16800, 14600],
      [-20400, 19400],
      [-23800, 23800],
    ],
  },
];

// Backward-compatible export for modules referencing the primary trunk road
export const FOREST_ROAD_POINTS = ROAD_NETWORK[0].points;

/**
 * 9 Curated Scenic Landmarks across the 60 km × 60 km Real-World Mountain-Forest Watershed.
 */
export const TERRENO_LANDMARKS = [
  {
    id: 'compound',
    code: 'BASE',
    nameJp: '母屋 NARROW-50 拠点',
    desc: '標高 +320m 黒杉渓谷拠点（5拠点・地下4層・車両待機所）',
    x: -1.8,
    z: -14.5,
    yaw: Math.PI + 0.12,
    pitch: 0.02,
  },
  {
    id: 'village',
    code: 'VLG',
    nameJp: '杉ノ郷 集落（5棟の里）',
    desc: '標高 +319m 渓谷河岸段丘に佇む5軒の古民家・石畳広場・水場・鎮守の社',
    x: VILLAGE.centerX - 24.5,
    z: VILLAGE.centerZ + 0.2,
    yaw: -Math.PI * 0.5,
    pitch: -0.02,
  },
  {
    id: 'gorge_river',
    code: 'BRIDGE',
    nameJp: '黒杉大橋・清流渓谷',
    desc: '母屋すぐ東の黒杉川に架かるアーチ大橋と清流河原（拠点東 220m）',
    x: evalMainRiver(-35).x - evalMainRiver(-35).halfWidth - 18.0,
    z: -35,
    yaw: -Math.PI * 0.5,
    pitch: -0.04,
  },
  {
    id: 'north_plateau',
    code: 'NORTH',
    nameJp: '北部ブナ・白樺峠',
    desc: '広大な原生ブナ・白樺・紅葉の渓谷高地林道（北 16.5km）',
    x: -1050,
    z: -16500,
    yaw: Math.PI,
    pitch: -0.03,
  },
  {
    id: 'west_hills',
    code: 'HILLS',
    nameJp: '西嶺もみじ山麓',
    desc: '深い山並みと紅葉・白樺が織りなす西方の山岳森林（西 17.5km）',
    x: -17500,
    z: -380,
    yaw: -Math.PI * 0.5,
    pitch: -0.04,
  },
  {
    id: 'east_wetland',
    code: 'MARSH',
    nameJp: '東水郷・霧の湿原と柳沢',
    desc: '静かな山間の湿原と川ヤナギが揺れる水郷地帯（東 17.2km）',
    x: 17200,
    z: 4800,
    yaw: Math.PI * 0.45,
    pitch: -0.03,
  },
  {
    id: 'sw_prairie',
    code: 'PLAIN',
    nameJp: '南西ススキ高原',
    desc: '山裾に広がる黄金色のススキ高原と赤松尾根（南西 19km）',
    x: -12800,
    z: 13900,
    yaw: -0.65,
    pitch: -0.02,
  },
  {
    id: 'south_pines',
    code: 'SOUTH',
    nameJp: '南部アカマツ渓谷',
    desc: '赤松と清流が連なる南部の山麓渓谷道（南 24km）',
    x: 480,
    z: 24200,
    yaw: 0.10,
    pitch: -0.02,
  },
  {
    id: 'null_erea',
    code: 'NULL',
    nameJp: 'NULL EREA・地下40m飛行船基地 SILO-40',
    desc: '南端空白地帯 NULL EREA（40m高速ELV・4層44枚可動屋根・巨大高昇機・飛行船K-11格納庫）',
    x: -20.5,
    z: 29910.0,
    yaw: -Math.PI * 0.5,
    pitch: -0.04,
  },
];

/**
 * 4 Physically-Calibrated Mountain-Valley Atmosphere & Time-of-Day Presets.
 */
export const ATMOSPHERE_PRESETS = {
  night: {
    id: 'night',
    labelJp: '月夜',
    fullNameJp: '月夜の山岳原生林（NARROW-50標準）',
    sunDir: [-0.34, 0.44, 0.83],
    sunColor: [0.56, 0.72, 0.96],
    sunIntensity: 1.48,
    hemiSky: 0x2c4b72,
    hemiGround: 0x0b100e,
    hemiIntensity: 0.26,
    skyZenith: [0.015, 0.032, 0.068],
    skyHorizon: [0.065, 0.118, 0.195],
    skyGlow: [0.22, 0.34, 0.54],
    valleyFogColor: [0.075, 0.135, 0.215],
    aerialFogColor: [0.048, 0.088, 0.158],
    valleyFogDensity: 0.00028,
    valleyFogFalloff: 0.014,
    valleyFogBaseY: -10.0,
    aerialDensity: 0.000048,
    mieStrength: 0.34,
    starIntensity: 1.0,
    cloudBrightness: 0.20,
    exposure: 1.12,
    horizonShadowBlend: 0.65,
    useEastHorizon: 0.0,
  },
  dawn: {
    id: 'dawn',
    labelJp: '朝霧',
    fullNameJp: '夜明け・朝霧の日本アルプス渓谷',
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
    valleyFogDensity: 0.00068,
    valleyFogFalloff: 0.016,
    valleyFogBaseY: 4.0,
    aerialDensity: 0.000046,
    mieStrength: 0.78,
    starIntensity: 0.08,
    cloudBrightness: 0.92,
    exposure: 1.06,
    horizonShadowBlend: 0.82,
    useEastHorizon: 1.0,
  },
  day: {
    id: 'day',
    labelJp: '深緑',
    fullNameJp: '晴天の深い山岳原生林と渓谷',
    sunDir: [0.44, 0.72, 0.54],
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 3.18,
    hemiSky: 0x89b8e6,
    hemiGround: 0x2a3926,
    hemiIntensity: 0.82,
    skyZenith: [0.15, 0.37, 0.74],
    skyHorizon: [0.64, 0.79, 0.92],
    skyGlow: [1.0, 0.95, 0.84],
    valleyFogColor: [0.68, 0.80, 0.89],
    aerialFogColor: [0.44, 0.62, 0.84],
    valleyFogDensity: 0.00022,
    valleyFogFalloff: 0.014,
    valleyFogBaseY: -4.0,
    aerialDensity: 0.000042,
    mieStrength: 0.44,
    starIntensity: 0.0,
    cloudBrightness: 1.0,
    exposure: 1.00,
    horizonShadowBlend: 0.78,
    useEastHorizon: 1.0,
  },
  dusk: {
    id: 'dusk',
    labelJp: '夕映',
    fullNameJp: '黄昏の山並みと紅葉渓谷',
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
    valleyFogDensity: 0.00046,
    valleyFogFalloff: 0.015,
    valleyFogBaseY: 0.0,
    aerialDensity: 0.000050,
    mieStrength: 0.85,
    starIntensity: 0.22,
    cloudBrightness: 0.75,
    exposure: 1.08,
    horizonShadowBlend: 0.84,
    useEastHorizon: 0.0,
  },
};

export const ATMOSPHERE_ORDER = ['night', 'dawn', 'day', 'dusk'];
