import { VILLAGE } from '../villageData.js';

/**
 * TERRENO 6.0 Engine — Master World Configuration (60,000 m × 60,000 m = 3,600.0 km²)
 *
 * Authentic Unspoiled Real-World Tectonic Mountain-Valley, Rift-Trench & Deep Subterranean World:
 *   - 100% Roadless Wilderness (ROAD_NETWORK completely removed — ZERO artificial road grids!)
 *   - Asymmetric Tectonic Orogenic Mountain Chains, Fault-Block Massifs & Curved Volcanic Arcs
 *     (ZERO evenly-spaced mountain cones!)
 *   - Extreme Real-World Vertical Relief:
 *       • Surface Terrain: -500 m ASL (Sunken Tectonic Rift Abyss) .. +2,500 m ASL (Glacial Cathedral Summits)
 *       • Deep Subterranean World: Down to -1,500 m (Karst Cenotes -> Basalt Lava Tubes -> Abyssal Geothermal Chasms)
 *   - 2048×2048 Float32 Macro DEM (29.3 m/cell) paired with CPU/GPU 1:1 Cliff-Fracture Sculpting
 *   - Meandering Emerald Mountain River (黒杉川), 12 Cascading Tributaries & Natural Shallow Cobble Fords
 */

export const TERRENO_WORLD = {
  width: 60000,         // 60.0 km East–West  (X ∈ [-30000, +30000])
  depth: 60000,         // 60.0 km North–South (Z ∈ [-30000, +30000])
  minX: -30000,
  maxX: 30000,
  minZ: -30000,
  maxZ: 30000,
  // 512×512 Float32 macro geomorphology atlas paired with GPU Catmull-Rom bicubic + 0.5m 1:1 cliff-fracture sculpting!
  atlasW: 512,
  atlasH: 512,
  // Local compound ground Y (-0.35m) maps to natural river-valley elevation +320.0m ASL
  // Surface ASL spans [-500m .. +2,500m] -> local Y spans [-820m .. +2,180m]
  // Subterranean strata extend down to -1,500m below sea level!
  compoundGroundY: -0.35,
  baseElevationASL: 320.35,
  minSurfaceASL: -500.0,
  maxSurfaceASL: 2500.0,
  maxSubterraneanDepthM: -1500.0,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  // Tight natural terrace — wild cliffs, forested foothills & ravines begin right outside the yard!
  compoundFlatRadius: 27.0,
  compoundBlendRadius: 68.0,
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
 * and Suginosato Village (Z=+1280, X≈+1460m) toward the Southern Valley (Z=+30000).
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
 * Natural Shallow River Cobble Fords (自然渡河浅瀬) along Kurosugi River.
 * Replaces artificial asphalt bridges in the 100% roadless TERRENO 6.0 wilderness:
 * vehicles & explorers can wade across shallow cobble bars (depth ~0.35m..0.52m)
 * with REAL ENGINE aquatic drag & buoyancy physics!
 */
export const NATURAL_FORDS = [
  { id: 'ford_kurosugi_home',  nameJp: '黒杉川・本拠前浅瀬', z: -42,    halfLen: 42 },
  { id: 'ford_suginosato',     nameJp: '杉ノ郷・河原渡瀬',   z: 1320,   halfLen: 48 },
  { id: 'ford_okutani_n',      nameJp: '奥谷・礫原浅瀬',     z: -3650,  halfLen: 46 },
  { id: 'ford_shirakaba_n',    nameJp: '白樺渓・清流瀬',     z: -11200, halfLen: 52 },
  { id: 'ford_kita_gorge',     nameJp: '北辰渓谷・岩床瀬',   z: -21400, halfLen: 50 },
  { id: 'ford_momiji_s',       nameJp: '紅葉谷・中洲渡瀬',   z: 5900,   halfLen: 54 },
  { id: 'ford_suigo_mid',      nameJp: '水郷・広河原浅瀬',   z: 13400,  halfLen: 58 },
  { id: 'ford_minami_braid',   nameJp: '南杉・網状礫原瀬',   z: 21800,  halfLen: 64 },
];

export function evalFordFactor(z) {
  let best = 0.0;
  for (let i = 0; i < NATURAL_FORDS.length; i++) {
    const f = NATURAL_FORDS[i];
    const dz = Math.abs(z - f.z);
    if (dz < f.halfLen * 2.2) {
      const w = 1.0 - smoothstepQ(f.halfLen * 0.55, f.halfLen * 2.2, dz);
      if (w > best) best = w;
    }
  }
  return best;
}

/**
 * Asymmetric Real-World Tectonic Orogenic Belts & Sunken Rift Trenches!
 * Completely abolishes the old symmetric 2×3 / concentric-circle peak grid:
 *   - Curved NW -> N -> NE Grand Alpine Thrust Belt rising up to +2,500 m ASL with sheer N/W walls
 *   - Clustered Western Fault-Block Escarpments & Dissected Spurs (+1,100 m .. +1,980 m ASL)
 *   - Eastern Volcanic Arc & Caldera Massif Chain (+1,250 m .. +2,140 m ASL)
 *   - Dramatic SSW -> SE Tectonic Rift Trench & Abyssal Karst Gorge plunging down to -500 m ASL!
 *   - Wide organic asymmetric forested basins, wetlands & broad open valleys between ranges!
 */
export const OROGENIC_CHAINS = [
  // 1. GRAND NORTHERN-NW ALPINE THRUST SPINE (Curved arc rising to +2,500m ASL — jagged granite cathedral walls!)
  {
    id: 'chain_north_alps',
    nameJp: '北辰アルプス主稜脈',
    kind: 'thrust_range',
    sign: 1,
    cliffSide: 1,       // Steep asymmetric thrust face on South-East side!
    asymmetry: 0.42,
    ridgeSharpness: 1.85,
    nodes: [
      [-28500, -14200, 1480, 6200],
      [-23200, -18400, 1920, 6600],
      [-17600, -22800, 2180, 7100], // ~+2,500m ASL Cathedral Peak!
      [-10400, -24600, 2060, 6400],
      [ -4200, -21200, 1680, 5600],
      [  2800, -23800, 1960, 6200],
      [  9600, -25400, 2140, 6800], // ~+2,470m ASL Twin Glacier Spine!
      [ 16400, -22100, 1840, 5900],
      [ 23800, -19200, 1420, 5400],
    ],
  },
  // 2. WESTERN FOLDED ESCARPMENT & SUB-SPINE (Sweeping NNW -> WSW fractured granite escarpments!)
  {
    id: 'chain_west_escarpment',
    nameJp: '西嶺断層傾動山脈',
    kind: 'fault_block',
    sign: 1,
    cliffSide: -1,      // Sheer west-facing fault scarp, rugged eastern dip slope
    asymmetry: 0.48,
    ridgeSharpness: 1.65,
    nodes: [
      [-24800,  -9200, 1520, 5400],
      [-20600,  -4100, 1680, 5200],
      [-16900,   1800, 1340, 4800],
      [-21400,   7600, 1590, 5100],
      [-26200,  14400, 1380, 4900],
    ],
  },
  // 3. IMMEDIATE VALLEY CRAG SPURS (Asymmetric dramatic cliffs & forested ridges framing NARROW-50!)
  {
    id: 'chain_kurosugi_west_crag',
    nameJp: '黒杉西絶壁尾根',
    kind: 'cliff_spur',
    sign: 1,
    cliffSide: 1,
    asymmetry: 0.55,
    ridgeSharpness: 1.78,
    nodes: [
      [ -1450,  -2200,  640, 1750],
      [ -2950,   -680,  890, 2100],
      [ -5400,  -1950, 1180, 2900],
      [ -9200,  -5600, 1440, 3800],
      [-12600, -11400, 1620, 4400],
    ],
  },
  {
    id: 'chain_yakumo_east_spur',
    nameJp: '八雲東連稜',
    kind: 'cliff_spur',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.46,
    ridgeSharpness: 1.62,
    nodes: [
      [  2150,  -1350,  580, 1680],
      [  4900,  -3800,  940, 2450],
      [  8600,  -7900, 1320, 3400],
      [ 11400, -13800, 1580, 4100],
    ],
  },
  // 4. EASTERN VOLCANIC ARC & BASALT PLATEAU CHAIN (Irregular clustered volcanic highlands, leaving wide east wetlands!)
  {
    id: 'chain_east_volcanic_arc',
    nameJp: '東雲火山弧・溶岩断崖帯',
    kind: 'volcanic_arc',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.36,
    ridgeSharpness: 1.54,
    nodes: [
      [ 24200, -11800, 1480, 4600],
      [ 21800,  -5200, 1760, 4900],
      [ 25400,   1600, 1380, 4300],
      [ 22600,  11200, 1520, 4700],
      [ 17200,  18800, 1290, 4500],
    ],
  },
  // 5. DEEP TECTONIC RIFT TRENCH & ABYSSAL GORGE (Plunging cleanly down to -500 m ASL — 3,000 m world relief!)
  {
    id: 'trench_south_abyss',
    nameJp: '南西大裂谷・アビサル地溝帯',
    kind: 'rift_trench',
    sign: -1,
    cliffSide: 1,
    asymmetry: 0.30,
    ridgeSharpness: 2.15,
    nodes: [
      [-15800,  12400,  520, 2600],
      [-11200,  16800,  780, 2900],
      [ -7400,  21400,  860, 3100], // Drops surface to ~-500m ASL!
      [ -3200,  24200,  640, 2600],
      [  4800,  22800,  720, 2800],
      [ 10600,  24800,  810, 2950], // Secondary eastern abyssal canyon ~-480m ASL!
    ],
  },
  // 6. SECONDARY NORTHERN-WEST KARST RIFT CHASM (Sunken -320m..-450m gorge slicing between western ranges!)
  {
    id: 'trench_west_karst_chasm',
    nameJp: '西渓カルスト深淵峡',
    kind: 'rift_trench',
    sign: -1,
    cliffSide: -1,
    asymmetry: 0.35,
    ridgeSharpness: 2.25,
    nodes: [
      [-12400,   4200,  560, 1850],
      [ -9200,   7800,  740, 2100],
      [ -6400,  10600,  620, 1950],
    ],
  },
];

/**
 * Natural Asymmetric Named Summit & Abyss Landmarks aligned organically along OROGENIC_CHAINS
 * (Used for cartographic 2D map peak elevation callouts — ZERO uniform grid placement!).
 */
export const MOUNTAIN_PEAKS = [
  { id: 'pk_hokushin_yari', nameJp: '北辰槍ヶ岳',     x: -17600, z: -22800, height: 2180, isAbyss: false },
  { id: 'pk_tenryu_hotaka', nameJp: '天龍穂高岳',     x:   9600, z: -25400, height: 2140, isAbyss: false },
  { id: 'pk_kurogane_dake', nameJp: '黒鉄主峰',       x: -10400, z: -24600, height: 2060, isAbyss: false },
  { id: 'pk_hakuhou_mine',  nameJp: '白鳳氷壁岳',     x: -23200, z: -18400, height: 1920, isAbyss: false },
  { id: 'pk_shinonome_volc',nameJp: '東雲火山大岳',   x:  21800, z:  -5200, height: 1760, isAbyss: false },
  { id: 'pk_seirei_scarp',  nameJp: '西嶺大断崖峰',   x: -20600, z:  -4100, height: 1680, isAbyss: false },
  { id: 'pk_yakumo_ridge',  nameJp: '八雲北壁岳',     x:  11400, z: -13800, height: 1580, isAbyss: false },
  { id: 'pk_nishimine_s',   nameJp: '西剣断層岳',     x: -21400, z:   7600, height: 1590, isAbyss: false },
  { id: 'pk_kurosugi_crag', nameJp: '黒杉大岩壁',     x:  -5400, z:  -1950, height: 1180, isAbyss: false },
  { id: 'pk_kirishima_se',  nameJp: '霧島外輪岳',     x:  22600, z:  11200, height: 1520, isAbyss: false },
  { id: 'pk_kurosugi_w',    nameJp: '黒杉西絶壁',     x:  -2950, z:   -680, height:  890, isAbyss: false },
  { id: 'pk_yakumo_e',      nameJp: '杉ノ峰東壁',     x:   4900, z:  -3800, height:  940, isAbyss: false },
  { id: 'ab_minami_rift',   nameJp: '南西アビサル地溝',x:  -7400, z:  21400, height: -860, isAbyss: true  },
  { id: 'ab_tobu_trench',   nameJp: '南東深淵大裂谷', x:  10600, z:  24800, height: -810, isAbyss: true  },
  { id: 'ab_seikei_chasm',  nameJp: '西渓カルスト深淵',x:  -9200, z:   7800, height: -740, isAbyss: true  },
];

/**
 * Natural Subterranean Cave / Tiankeng Shaft / Lava-Tube Portals connecting the Surface
 * seamlessly to the Multi-Strata -1,500m Natural Underground World!
 */
export const SUBTERRANEAN_PORTALS = [
  {
    id: 'sub_portal_kurosugi_cenote',
    nameJp: '黒杉天坑・カルスト大縦穴',
    kind: 'tiankeng_shaft',
    x: -680,
    z: 620,
    radius: 34.0,
    targetDepthM: -340.0,
    stratum: 'karst',
  },
  {
    id: 'sub_portal_west_rift',
    nameJp: '西渓大裂谷・深部地底口',
    kind: 'rift_cavern',
    x: -9180,
    z: 7780,
    radius: 42.0,
    targetDepthM: -920.0,
    stratum: 'tectonic',
  },
  {
    id: 'sub_portal_east_lavatube',
    nameJp: '東雲溶岩洞・玄武岩大空洞口',
    kind: 'lava_tube',
    x: 15800,
    z: -4200,
    radius: 38.0,
    targetDepthM: -680.0,
    stratum: 'volcanic',
  },
  {
    id: 'sub_portal_abyss_1500',
    nameJp: '南西アビサル最深坑（-1,500m）',
    kind: 'abyssal_chasm',
    x: -7380,
    z: 21380,
    radius: 48.0,
    targetDepthM: -1500.0,
    stratum: 'abyssal',
  },
  {
    id: 'sub_portal_north_blind',
    nameJp: '北辰盲谷・地底大河吸込口',
    kind: 'blind_valley',
    x: 3400,
    z: -12400,
    radius: 36.0,
    targetDepthM: -520.0,
    stratum: 'phreatic',
  },
  {
    id: 'sub_portal_se_geothermal',
    nameJp: '南東地熱結晶縦坑（-1,420m）',
    kind: 'geothermal_shaft',
    x: 10580,
    z: 24760,
    radius: 44.0,
    targetDepthM: -1420.0,
    stratum: 'geothermal',
  },
];

/**
 * Continuous C2-smooth regional biome weights across the 60 km × 60 km watershed.
 * Driven by natural river corridors, warped watersheds, and asymmetric geology.
 */
export function evalRegionWeights(wx, wz) {
  const uX = wx + Math.sin(wz * 0.00014 + 0.6) * 3600.0 + Math.cos((wx + wz) * 0.00009) * 1900.0;
  const uZ = wz + Math.cos(wx * 0.00013 - 0.8) * 3600.0 + Math.sin((wx - wz) * 0.00008) * 1900.0;

  const rv = evalMainRiver(wz);
  const dxRiv = Math.abs(wx - rv.x);
  const dCenter = Math.hypot(wx - 400.0, wz - 600.0);

  const valley = Math.exp(-(dxRiv * dxRiv) / (6800.0 * 6800.0)) * 0.95
    + Math.exp(-(dCenter * dCenter) / (6200.0 * 6200.0)) * 0.85 + 0.14;
  const hills = smoothstepQ(2800.0, -14500.0, uX) * smoothstepQ(13500.0, -7500.0, uZ);
  const plateau = smoothstepQ(-1800.0, -17500.0, uZ) * smoothstepQ(-15000.0, 9500.0, uX);
  const wetland = smoothstepQ(2600.0, 15500.0, uX)
    * smoothstepQ(-18500.0, -3500.0, uZ)
    * smoothstepQ(20500.0, 6500.0, uZ);
  const meadow = smoothstepQ(10500.0, -8500.0, uX)
    * smoothstepQ(2000.0, 15500.0, uZ)
    * smoothstepQ(27500.0, 15000.0, uZ);
  const southPlain = smoothstepQ(11500.0, 23000.0, uZ);

  const inv = 1.0 / (valley + hills + plateau + wetland + meadow + southPlain + 1e-6);
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
 * 12 Cascading Mountain Tributary Streams (渓流・支流) carving wild gorges into 黒杉川.
 */
export const TRIBUTARIES = [
  { id: 'trib_n1', nameJp: '白樺北渓流',    z0: -23500, side: -1, dirX: -0.94, dirZ: -0.34, len: 14000, depth: 36, width: 92 },
  { id: 'trib_n2', nameJp: 'ブナ台地東沢',  z0: -19000, side:  1, dirX:  0.93, dirZ: -0.37, len: 15000, depth: 38, width: 102 },
  { id: 'trib_n3', nameJp: '奥谷北せせらぎ', z0: -12500, side: -1, dirX: -0.95, dirZ: -0.31, len: 13500, depth: 30, width: 88 },
  { id: 'trib_n4', nameJp: '朝露東渓流',    z0:  -7200, side:  1, dirX:  0.94, dirZ: -0.34, len: 14500, depth: 28, width: 94 },
  { id: 'trib_c1', nameJp: '西山清流沢',    z0:  -2600, side: -1, dirX: -0.96, dirZ: -0.28, len: 14000, depth: 26, width: 84 },
  { id: 'trib_c2', nameJp: '水郷東渓谷流',  z0:   1800, side:  1, dirX:  0.95, dirZ:  0.31, len: 15500, depth: 22, width: 105 },
  { id: 'trib_c3', nameJp: '杉ノ郷西小川',  z0:   5800, side: -1, dirX: -0.95, dirZ:  0.31, len: 14000, depth: 24, width: 88 },
  { id: 'trib_c4', nameJp: '紅葉東沢',      z0:   9800, side:  1, dirX:  0.93, dirZ:  0.36, len: 15000, depth: 20, width: 108 },
  { id: 'trib_s1', nameJp: '草原西渓流',    z0:  14200, side: -1, dirX: -0.92, dirZ:  0.39, len: 14500, depth: 26, width: 94 },
  { id: 'trib_s2', nameJp: '南東湖沼沢',    z0:  17800, side:  1, dirX:  0.91, dirZ:  0.41, len: 14000, depth: 24, width: 100 },
  { id: 'trib_s3', nameJp: 'ススキ原小川',  z0:  21500, side: -1, dirX: -0.94, dirZ:  0.34, len: 13500, depth: 22, width: 92 },
  { id: 'trib_s4', nameJp: '松原南清流',    z0:  24600, side:  1, dirX:  0.93, dirZ:  0.36, len: 13000, depth: 18, width: 96 },
];

/**
 * TERRENO 6.0 — 100% Roadless Unspoiled Wilderness!
 * All artificial highways & forestry roads have been permanently removed.
 */
export const ROAD_NETWORK = [];

/**
 * Curated Natural Exploration Landmarks across the 60 km × 60 km wilderness (-500m..+2,500m & -1,500m underground).
 */
export const TERRENO_LANDMARKS = [
  {
    id: 'home',
    code: 'HOME',
    nameJp: 'NARROW-50 拠点（黒杉原生渓谷）',
    desc: '標高 +320m 道路ゼロの手つかず原生林と大岩壁に抱かれた拠点',
    x: 1.5,
    z: -16.0,
    yaw: 0.0,
    pitch: -0.02,
  },
  {
    id: 'village',
    code: 'VLG',
    nameJp: '杉ノ郷 集落（5棟の里）',
    desc: '標高 +319m 黒杉川河岸段丘に佇む5軒の古民家と鎮守の社',
    x: VILLAGE.centerX - 24.5,
    z: VILLAGE.centerZ + 0.2,
    yaw: -Math.PI * 0.5,
    pitch: -0.02,
  },
  {
    id: 'kurosugi_ford',
    code: 'FORD',
    nameJp: '黒杉川・清流渡河浅瀬',
    desc: '車両で自然渡河できる澄んだ礫原の浅瀬（拠点東 210m）',
    x: evalMainRiver(-42).x - evalMainRiver(-42).halfWidth - 16.0,
    z: -42,
    yaw: -Math.PI * 0.5,
    pitch: -0.04,
  },
  {
    id: 'north_alps',
    code: 'ALPS',
    nameJp: '北辰槍ヶ岳・氷河大岩壁 (+2,500m)',
    desc: '標高 +2,500m級 切り立つ花崗岩大絶壁と懸垂氷河の主稜線',
    x: -17200,
    z: -21400,
    yaw: 0.2,
    pitch: 0.14,
  },
  {
    id: 'west_escarpment',
    code: 'CLIFF',
    nameJp: '西嶺断層大絶壁',
    desc: '75°〜88°に直立する傾動断層崖と原生ブナ純林帯',
    x: -18800,
    z: -3600,
    yaw: -Math.PI * 0.45,
    pitch: 0.10,
  },
  {
    id: 'south_abyss',
    code: 'ABYSS',
    nameJp: '南西アビサル地溝谷 (-500m)',
    desc: '標高 -500m まで階段状に切れ込む巨大テクトニクス裂谷＆地下-1,500m最深坑口',
    x: -7380,
    z: 21380,
    yaw: -0.4,
    pitch: -0.18,
  },
  {
    id: 'kurosugi_cenote',
    code: 'CAVE',
    nameJp: '黒杉天坑・地下カルスト大縦穴',
    desc: '地表から地下 -340m 鍾乳洞回廊へ直結する巨大陥没縦穴',
    x: -680,
    z: 620,
    yaw: 0.3,
    pitch: -0.22,
  },
  {
    id: 'east_wetland',
    code: 'MARSH',
    nameJp: '東水郷・霧の湿原と火山弧',
    desc: '静かな山間湿原の奥にそびえる東雲火山断崖帯',
    x: 15200,
    z: 3600,
    yaw: Math.PI * 0.45,
    pitch: -0.02,
  },
  {
    id: 'null_erea',
    code: 'NULL',
    nameJp: 'NULL EREA・地下40m飛行船基地 SILO-40',
    desc: '南端空白地帯 NULL EREA（40m高速ELV・4層44枚可動屋根・飛行船K-11格納庫）',
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
    valleyFogDensity: 0.00024,
    valleyFogFalloff: 0.009,
    valleyFogBaseY: -120.0,
    aerialDensity: 0.000038,
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
    valleyFogDensity: 0.00055,
    valleyFogFalloff: 0.010,
    valleyFogBaseY: -40.0,
    aerialDensity: 0.000036,
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
    valleyFogDensity: 0.00018,
    valleyFogFalloff: 0.0085,
    valleyFogBaseY: -60.0,
    aerialDensity: 0.000034,
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
    valleyFogDensity: 0.00038,
    valleyFogFalloff: 0.009,
    valleyFogBaseY: -40.0,
    aerialDensity: 0.000040,
    mieStrength: 0.85,
    starIntensity: 0.22,
    cloudBrightness: 0.75,
    exposure: 1.08,
    horizonShadowBlend: 0.84,
    useEastHorizon: 0.0,
  },
};

export const ATMOSPHERE_ORDER = ['night', 'dawn', 'day', 'dusk'];
