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
  // Surface ASL spans [-800m .. +4,000m] -> 4,800m Ultra-Quality Continental Relief! Local Y spans [-1,120.35m .. +3,679.65m]
  // Subterranean realm strictly spans [-801m .. -1,900m] below sea level (1,099m stratified deep underworld)!
  compoundGroundY: -0.35,
  baseElevationASL: 320.35,
  minSurfaceASL: -800.0,
  maxSurfaceASL: 4000.0,
  subterraneanTopASL: -801.0,
  maxSubterraneanDepthM: -1900.0,
  compoundCenterX: 1.5,
  compoundCenterZ: 3.5,
  // Tight natural terrace — wild cliffs, forested foothills & ravines rise right outside the yard!
  compoundFlatRadius: 24.0,
  compoundBlendRadius: 56.0,
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
 * TERRENO 8.0 — 12 Interlocking Continental Orogenic Belts, Interior Highland Ridges & -2,000m Abyssal Rift Trenches!
 *   - Grand Alpine Giant Northern Thrust Cordillera rising cleanly to +4,100 m ASL!
 *   - Western Folded Escarpment, Interior Hogback Spurs, Central-East Volcanic Plateaus & Red-Rock Mesas
 *   - Multi-Tiered -2,000 m Abyssal Tectonic Rift Trenches & Deep Sunken Cloud-Forest Chasms (6,100 m Total Relief!)
 */
export const OROGENIC_CHAINS = [
  // 1. GRAND NORTHERN-NW ALPINE THRUST SPINE (Rising cleanly to +4,000 m ASL — Matterhorn/Mont-Blanc glaciated cathedral spires!)
  {
    id: 'chain_north_alps',
    nameJp: '北辰アルプス主稜脈',
    kind: 'thrust_range',
    sign: 1,
    cliffSide: 1,
    asymmetry: 0.44,
    ridgeSharpness: 1.94,
    nodes: [
      [-28500, -14200, 2620, 7000],
      [-23200, -18400, 3360, 7400],
      [-17600, -22800, 4120, 8100], // ~+4,000m ASL Glacial Cathedral Giant!
      [-10400, -24600, 3680, 7200],
      [ -4200, -21200, 2880, 6400],
      [  2800, -23800, 3440, 7000],
      [  9600, -25400, 4080, 7800], // ~+3,998m ASL Twin Glacier Spine!
      [ 16400, -22100, 3200, 6700],
      [ 23800, -19200, 2520, 6200],
    ],
  },
  // 2. WESTERN FOLDED ESCARPMENT & CORDILLERA (+2,500 m .. +3,350 m ASL)
  {
    id: 'chain_west_escarpment',
    nameJp: '西嶺断層傾動山脈',
    kind: 'fault_block',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.48,
    ridgeSharpness: 1.74,
    nodes: [
      [-24800,  -9200, 2740, 6200],
      [-20600,  -4100, 3080, 6000],
      [-16900,   1800, 2360, 5400],
      [-21400,   7600, 2860, 5800],
      [-26200,  14400, 2420, 5600],
    ],
  },
  // 3. IMMEDIATE VALLEY CRAG SPURS (Dramatic interlocking cliffs & forested mountain ribs right near NARROW-50!)
  {
    id: 'chain_kurosugi_west_crag',
    nameJp: '黒杉西絶壁尾根',
    kind: 'cliff_spur',
    sign: 1,
    cliffSide: 1,
    asymmetry: 0.56,
    ridgeSharpness: 1.84,
    nodes: [
      [ -1220,  -1950,  940, 1950],
      [ -2950,   -680, 1420, 2450],
      [ -5400,  -1950, 1960, 3500],
      [ -9200,  -5600, 2480, 4500],
      [-12600, -11400, 2940, 5200],
    ],
  },
  {
    id: 'chain_yakumo_east_spur',
    nameJp: '八雲東連稜',
    kind: 'cliff_spur',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.48,
    ridgeSharpness: 1.68,
    nodes: [
      [  1880,  -1250,  860, 1900],
      [  4900,  -3800, 1520, 2900],
      [  8600,  -7900, 2260, 4000],
      [ 11400, -13800, 2840, 4900],
    ],
  },
  // 4. EASTERN VOLCANIC ARC & STRATOVOLCANO CORDILLERA (+2,300 m .. +3,650 m ASL)
  {
    id: 'chain_east_volcanic_arc',
    nameJp: '東雲火山弧・溶岩断崖帯',
    kind: 'volcanic_arc',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.38,
    ridgeSharpness: 1.66,
    nodes: [
      [ 24200, -11800, 2680, 5400],
      [ 21800,  -5200, 3360, 5800], // ~+3,650m Stratovolcano Giant!
      [ 25400,   1600, 2520, 5000],
      [ 22600,  11200, 2840, 5500],
      [ 17200,  18800, 2340, 5200],
    ],
  },
  // 5. INTERIOR FOLDED HIGHLAND SPINE — CENTRAL-EAST (Breaks up old flat eastern plain with dramatic volcanic mesas & canyons!)
  {
    id: 'chain_central_east_highlands',
    nameJp: '蒼霧中央高原・火山段丘脈',
    kind: 'folded_highland',
    sign: 1,
    cliffSide: 1,
    asymmetry: 0.45,
    ridgeSharpness: 1.60,
    nodes: [
      [  5400,   3200,  840, 2650],
      [  9800,   1400, 1340, 3500],
      [ 14400,   4600, 1680, 3900],
      [ 12800,  10400, 1260, 3400],
      [  7800,  13200, 1020, 2950],
    ],
  },
  // 6. INTERIOR NORTHERN-CENTRAL INTERLOCKING SPUR (Carves dramatic dendritic mountain corridors north of NARROW-50!)
  {
    id: 'chain_north_central_ribs',
    nameJp: '白樺連峰・褶曲支稜帯',
    kind: 'folded_highland',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.50,
    ridgeSharpness: 1.74,
    nodes: [
      [ -4800,  -9200, 1280, 3150],
      [ -1800, -13600, 1740, 3500],
      [  3600, -15800, 1980, 3700],
      [  6200, -11200, 1480, 3100],
    ],
  },
  // 7. INTERIOR SOUTH-WEST RED-ROCK MESA & HOGBACK BELT (+1,000 m .. +1,950 m ASL framing the abyssal rift!)
  {
    id: 'chain_sw_hogback_mesa',
    nameJp: '朱岩メサ・ホッグバック連崖',
    kind: 'fault_block',
    sign: 1,
    cliffSide: 1,
    asymmetry: 0.54,
    ridgeSharpness: 1.82,
    nodes: [
      [ -4600,   3400,  880, 2250],
      [ -8400,   1200, 1360, 2800],
      [-13600,  -1400, 1680, 3300],
      [-14800,   8800, 1480, 3200],
    ],
  },
  // 8. SOUTHERN RIM ESCARPMENT (Dramatic flanking cliffs framing the -800m Southern Rift!)
  {
    id: 'chain_south_flank_scarp',
    nameJp: '南嶺裂谷外縁断崖脈',
    kind: 'cliff_spur',
    sign: 1,
    cliffSide: -1,
    asymmetry: 0.52,
    ridgeSharpness: 1.80,
    nodes: [
      [-19800,  19600, 1560, 4000],
      [-14200,  25600, 1880, 4200],
      [  4200,  16400,  980, 2850],
      [ 16800,  25400, 1740, 4100],
    ],
  },
  // 9. DEEP TECTONIC RIFT TRENCH & -800 m ABYSSAL CHASM (4,800 m TOTAL SURFACE RELIEF!)
  {
    id: 'trench_south_abyss',
    nameJp: '南西大裂谷・最深-800m地溝帯',
    kind: 'rift_trench',
    sign: -1,
    cliffSide: 1,
    asymmetry: 0.34,
    ridgeSharpness: 2.25,
    nodes: [
      [-16400,  12200,  720, 3200],
      [-11400,  16800, 1120, 3600],
      [ -7400,  21400, 1580, 3900], // Plunges surface cleanly down to -799..-800 m ASL!
      [ -3200,  24200, 1060, 3200],
      [  4800,  22800, 1180, 3400],
      [ 10600,  24800, 1500, 3700], // Secondary SE Abyssal Trench ~-795 m ASL!
    ],
  },
  // 10. WESTERN KARST ABYSSAL CHASM (Plunging cleanly down to -660 m ASL!)
  {
    id: 'trench_west_karst_chasm',
    nameJp: '西渓カルスト深淵大峡谷',
    kind: 'rift_trench',
    sign: -1,
    cliffSide: -1,
    asymmetry: 0.38,
    ridgeSharpness: 2.30,
    nodes: [
      [-12400,   4200,  680, 2200],
      [ -9200,   7800,  980, 2550],
      [ -6400,  10600,  760, 2300],
    ],
  },
  // 11. EASTERN SUNKEN RIA & VOLCANIC GRABEN CHASM (Plunging down to -560 m ASL between East Highlands & Volcanic Arc!)
  {
    id: 'trench_east_graben',
    nameJp: '東雲沈降地溝・雲霧深峡',
    kind: 'rift_trench',
    sign: -1,
    cliffSide: 1,
    asymmetry: 0.36,
    ridgeSharpness: 2.15,
    nodes: [
      [ 16800,  -9600,  620, 2100],
      [ 18200,  -2200,  840, 2350],
      [ 17400,   6400,  720, 2250],
    ],
  },
];

/**
 * Natural Asymmetric Named Summit & Abyss Landmarks aligned organically along OROGENIC_CHAINS
 * (Surface: -800 m Abyssal Trenches .. +4,000 m Glaciated Cathedral Giants!).
 */
export const MOUNTAIN_PEAKS = [
  { id: 'pk_hokushin_yari', nameJp: '北辰槍ヶ岳',       x: -17600, z: -22800, height: 3960, isAbyss: false },
  { id: 'pk_tenryu_hotaka', nameJp: '天龍穂高岳',       x:   9600, z: -25400, height: 3920, isAbyss: false },
  { id: 'pk_kurogane_dake', nameJp: '黒鉄主峰',         x: -10400, z: -24600, height: 3600, isAbyss: false },
  { id: 'pk_hakuhou_mine',  nameJp: '白鳳氷壁岳',       x: -23200, z: -18400, height: 3360, isAbyss: false },
  { id: 'pk_shinonome_volc',nameJp: '東雲火山大岳',     x:  21800, z:  -5200, height: 3360, isAbyss: false },
  { id: 'pk_seirei_scarp',  nameJp: '西嶺大断崖峰',     x: -20600, z:  -4100, height: 3080, isAbyss: false },
  { id: 'pk_yakumo_ridge',  nameJp: '八雲北壁岳',       x:  11400, z: -13800, height: 2840, isAbyss: false },
  { id: 'pk_nishimine_s',   nameJp: '西剣断層岳',       x: -21400, z:   7600, height: 2860, isAbyss: false },
  { id: 'pk_kirishima_se',  nameJp: '霧島外輪岳',       x:  22600, z:  11200, height: 2840, isAbyss: false },
  { id: 'pk_kurosugi_nw',   nameJp: '黒杉北稜主峰',     x: -12600, z: -11400, height: 2940, isAbyss: false },
  { id: 'pk_kurosugi_crag', nameJp: '黒杉大岩壁',       x:  -5400, z:  -1950, height: 1960, isAbyss: false },
  { id: 'pk_shirakaba_n',   nameJp: '白樺褶曲岳',       x:   3600, z: -15800, height: 1980, isAbyss: false },
  { id: 'pk_aogiri_mesa',   nameJp: '蒼霧玄武岩台岳',   x:  14400, z:   4600, height: 1680, isAbyss: false },
  { id: 'pk_akaiwa_mesa',   nameJp: '朱岩ホッグバック', x: -13600, z:  -1400, height: 1680, isAbyss: false },
  { id: 'pk_nanrei_scarp',  nameJp: '南嶺外輪絶壁',     x: -14200, z:  25600, height: 1880, isAbyss: false },
  { id: 'pk_kurosugi_w',    nameJp: '黒杉西絶壁',       x:  -2950, z:   -680, height: 1420, isAbyss: false },
  { id: 'pk_yakumo_e',      nameJp: '杉ノ峰東壁',       x:   4900, z:  -3800, height: 1520, isAbyss: false },
  { id: 'pk_suigo_volc',    nameJp: '東水郷火山丘',     x:   9800, z:   1400, height: 1340, isAbyss: false },
  { id: 'pk_sw_hogback',    nameJp: '紅岩断崖嶺',       x:  -8400, z:   1200, height: 1360, isAbyss: false },
  { id: 'pk_minami_ridge',  nameJp: '南東裂谷外峰',     x:  16800, z:  25400, height: 1740, isAbyss: false },
  { id: 'ab_minami_rift',   nameJp: '南西アビサル地溝底', x: -7400, z: 21400, height: -1120, isAbyss: true },
  { id: 'ab_tobu_trench',   nameJp: '南東最深大裂谷',   x:  10600, z:  24800, height: -1100, isAbyss: true  },
  { id: 'ab_seikei_chasm',  nameJp: '西渓カルスト深淵', x:  -9200, z:   7800, height:  -980, isAbyss: true  },
  { id: 'ab_sw_gorge',      nameJp: '南西雲霧深峡',     x: -11400, z:  16800, height:  -940, isAbyss: true  },
  { id: 'ab_east_graben',   nameJp: '東雲沈降深谷',     x:  18200, z:  -2200, height:  -880, isAbyss: true  },
  { id: 'ab_se_rift_mid',   nameJp: '南央裂谷底',       x:   4800, z:  22800, height:  -960, isAbyss: true  },
];

/**
 * Natural Subterranean Cave / Tiankeng Shaft / Lava-Tube Portals connecting the Surface (-800..+4,000m)
 * seamlessly to the Multi-Strata Subterranean World strictly spanning -801m .. -1,900m ASL!
 */
export const SUBTERRANEAN_PORTALS = [
  {
    id: 'sub_portal_kurosugi_cenote',
    nameJp: '黒杉天坑・カルスト地下洞（-980m）',
    kind: 'tiankeng_shaft',
    x: -680,
    z: 620,
    radius: 34.0,
    topDepthM: -801.0,
    targetDepthM: -980.0,
    stratum: 'karst',
  },
  {
    id: 'sub_portal_west_rift',
    nameJp: '西渓大裂谷・深部地底口（-1,580m）',
    kind: 'rift_cavern',
    x: -9180,
    z: 7780,
    radius: 42.0,
    topDepthM: -801.0,
    targetDepthM: -1580.0,
    stratum: 'tectonic',
  },
  {
    id: 'sub_portal_east_lavatube',
    nameJp: '東雲溶岩洞・玄武岩大空洞（-1,260m）',
    kind: 'lava_tube',
    x: 15800,
    z: -4200,
    radius: 38.0,
    topDepthM: -801.0,
    targetDepthM: -1260.0,
    stratum: 'volcanic',
  },
  {
    id: 'sub_portal_abyss_1500',
    nameJp: '南西アビサル最深坑（-1,900m）',
    kind: 'abyssal_chasm',
    x: -7380,
    z: 21380,
    radius: 48.0,
    topDepthM: -801.0,
    targetDepthM: -1900.0,
    stratum: 'abyssal',
  },
  {
    id: 'sub_portal_north_blind',
    nameJp: '北辰盲谷・地底大河吸込口（-1,140m）',
    kind: 'blind_valley',
    x: 3400,
    z: -12400,
    radius: 36.0,
    topDepthM: -801.0,
    targetDepthM: -1140.0,
    stratum: 'phreatic',
  },
  {
    id: 'sub_portal_se_geothermal',
    nameJp: '南東地熱結晶縦坑（-1,780m）',
    kind: 'geothermal_shaft',
    x: 10580,
    z: 24760,
    radius: 44.0,
    topDepthM: -801.0,
    targetDepthM: -1780.0,
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
    nameJp: '北辰槍ヶ岳・氷河大岩壁 (+4,000m)',
    desc: '標高 +4,000m級 切り立つ花崗岩大絶壁とセラック氷河・浮遊雲海を貫く主稜線',
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
    nameJp: '南西アビサル地溝谷 (-800m)',
    desc: '地上最深 -800m の階段状テクトニクス裂谷＆地下 -801m〜-1,900m 最深縦坑口',
    x: -7380,
    z: 21380,
    yaw: -0.4,
    pitch: -0.18,
  },
  {
    id: 'kurosugi_cenote',
    code: 'CAVE',
    nameJp: '黒杉天坑・地下カルスト大縦穴',
    desc: '地表から地下 -801m〜-980m 鍾乳洞回廊へ直結する巨大陥没縦穴',
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
