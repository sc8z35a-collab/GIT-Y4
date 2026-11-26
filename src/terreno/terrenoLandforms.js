/**
 * TERRENO 4.0 — 22 Major Real-World Geomorphological Landforms & Natural Locations
 *
 * Moves far beyond plain FBM height variation ("強弱しかない地形") by embedding 22 authentic
 * tectonic, volcanic, fluvial, glacial, karst, and erosional Earth landforms directly into
 * the 60 km × 60 km heightfield AND providing exact metadata for bespoke 3D geological &
 * hydrological formations (animated waterfalls, columnar basalt cliffs, natural stone arches,
 * caldera crater lakes, glacial cirque tarns, karst limestone dolines, mossy caves, steaming
 * travertine hot-spring terraces, highland bog pools, granite hoodoo spires, river terraces, etc.).
 *
 * Placement guarantees:
 *  - Zero interference with NARROW-50 compound, Suginosato Village, NULL EREA, or the 37 bridges.
 *  - Iconic formations (3-tier waterfall, veil waterfall, mossy cascade ravine, basalt cliff,
 *    natural stone arch, mossy cave grotto, travertine hot springs) sit within 300m–1.2km of
 *    NARROW-50 for immediate exploration, while macro landforms span the 60 km × 60 km basin.
 */

import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';

function smoothstep(e0, e1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - e0) / (e1 - e0)));
  return t * t * (3.0 - 2.0 * t);
}

function quintic(e0, e1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - e0) / (e1 - e0)));
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function hash2f(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2f(ix, iz);
  const b = hash2f(ix + 1, iz);
  const c = hash2f(ix, iz + 1);
  const d = hash2f(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * All 22 Major Real-World Landforms & Natural Locations!
 */
export const MAJOR_LANDFORMS_22 = [
  // 1. Multi-Tier Waterfall & Plunge Pool (Right near NARROW-50 for immediate wonder!)
  {
    id: 'waterfall_kurosugi_otaki',
    index: 1,
    kind: 'waterfall_multitier',
    category: 'water',
    nameJp: '黒杉大滝（三段瀑布）',
    shortJp: '黒杉大滝',
    x: -225,
    z: -285,
    radius: 125,
    angle: 0.42, // waterfall faces SE toward NARROW-50 valley
    cliffHeight: 36,
    poolRadius: 30,
    minZoomMap: 2.0,
    hasWaterfall: true,
    clearTreesRadius: 68,
  },
  // 2. Curtain Veil Spring Waterfall (Near Suginosato Village!)
  {
    id: 'waterfall_shiraito_veil',
    index: 2,
    kind: 'waterfall_veil',
    category: 'water',
    nameJp: '白糸の繊滝（潜流瀑）',
    shortJp: '白糸の滝',
    x: 295,
    z: 485,
    radius: 105,
    angle: -2.35, // faces NW toward Suginosato valley
    cliffHeight: 22,
    poolRadius: 26,
    minZoomMap: 2.8,
    hasWaterfall: true,
    clearTreesRadius: 58,
  },
  // 3. Deep V-Shaped River Gorge Canyon
  {
    id: 'gorge_kurosugi_v_canyon',
    index: 3,
    kind: 'v_gorge',
    category: 'valley',
    nameJp: '黒杉大峡谷（V字渓谷）',
    shortJp: '黒杉大峡谷',
    x: 95,
    z: -1680,
    radius: 620,
    angle: 0.08,
    minZoomMap: 1.5,
    clearTreesRadius: 0,
  },
  // 4. Columnar Basalt Escarpment Cliff (Dramatic vertical cliff near NARROW-50!)
  {
    id: 'cliff_basalt_columns',
    index: 4,
    kind: 'basalt_cliff',
    category: 'cliff',
    nameJp: '玄武洞・柱状節理の大断崖',
    shortJp: '玄武洞断崖',
    x: -435,
    z: 195,
    radius: 175,
    angle: 0.15, // cliff faces East toward valley
    cliffHeight: 46,
    minZoomMap: 2.5,
    clearTreesRadius: 64,
  },
  // 5. Natural Eroded Stone Arch (Drive/Walk-under monumental rock span!)
  {
    id: 'arch_tenryu_rockbridge',
    index: 5,
    kind: 'natural_arch',
    category: 'rock',
    nameJp: '天龍の天然石橋（岩門）',
    shortJp: '天龍岩門',
    x: 520,
    z: -210,
    radius: 125,
    angle: 0.55,
    archSpan: 34,
    archHeight: 25,
    minZoomMap: 2.8,
    clearTreesRadius: 62,
  },
  // 6. Fluvial River Terraces (3 Crisp Stepped Floodplain Benches!)
  {
    id: 'terrace_river_steps',
    index: 6,
    kind: 'river_terraces',
    category: 'terrace',
    nameJp: '黒杉河岸段丘（三段段丘）',
    shortJp: '黒杉河岸段丘',
    x: -780,
    z: -980,
    radius: 560,
    angle: 0.25,
    minZoomMap: 1.8,
    clearTreesRadius: 0,
  },
  // 7. Rolling Drumlin Hills (Teardrop glacial hills)
  {
    id: 'hills_drumlin_meadow',
    index: 7,
    kind: 'drumlin_hills',
    category: 'hill',
    nameJp: '朝露の波状丘陵（ドラムリン丘）',
    shortJp: '朝露波状丘陵',
    x: -2450,
    z: 1480,
    radius: 1250,
    angle: 0.62,
    minZoomMap: 1.4,
    clearTreesRadius: 0,
  },
  // 8. Flat-Topped Volcanic Mesa / Lava Plateau
  {
    id: 'plateau_obsidian_mesa',
    index: 8,
    kind: 'volcanic_mesa',
    category: 'plateau',
    nameJp: '黒曜の溶岩台地（メサ）',
    shortJp: '黒曜溶岩台地',
    x: 3450,
    z: -2550,
    radius: 980,
    mesaHeight: 132,
    angle: -0.35,
    minZoomMap: 1.4,
    clearTreesRadius: 0,
  },
  // 9. Volcanic Caldera & Deep Sapphire Crater Lake
  {
    id: 'caldera_crater_lake',
    index: 9,
    kind: 'caldera_lake',
    category: 'volcano_water',
    nameJp: '蒼天カルデラ火口湖',
    shortJp: '蒼天カルデラ湖',
    x: -7150,
    z: -6350,
    radius: 1380,
    lakeRadius: 560,
    rimHeight: 245,
    lakeElevOffset: 108,
    minZoomMap: 0.88,
    hasLake: true,
    clearTreesRadius: 590,
  },
  // 10. Glacial Cirque Amphitheater & Turquoise Alpine Tarn Lake
  {
    id: 'cirque_alpine_tarn',
    index: 10,
    kind: 'glacial_cirque',
    category: 'alpine_water',
    nameJp: '白雲カール氷河圏谷＆氷河湖',
    shortJp: '白雲氷河湖',
    x: -3620,
    z: -3240,
    radius: 680,
    lakeRadius: 215,
    angle: 0.78, // opens SE
    minZoomMap: 1.6,
    hasLake: true,
    clearTreesRadius: 235,
  },
  // 11. Karst Limestone Doline Sinkhole Field & White Lapies Pinnacles
  {
    id: 'karst_doline_sinkhole',
    index: 11,
    kind: 'karst_doline',
    category: 'karst',
    nameJp: '秋芳カルスト・ドリーネ凹地',
    shortJp: '秋芳カルスト',
    x: 2480,
    z: 2180,
    radius: 860,
    angle: 0.3,
    minZoomMap: 1.6,
    clearTreesRadius: 95,
  },
  // 12. Mossy Limestone Grotto & Vaulted Cave Mouth
  {
    id: 'cave_moss_grotto',
    index: 12,
    kind: 'cave_grotto',
    category: 'cave',
    nameJp: '苔生す鍾乳洞窟・岩窟',
    shortJp: '苔の鍾乳洞窟',
    x: -575,
    z: 675,
    radius: 130,
    angle: -0.65, // opens NE
    minZoomMap: 2.5,
    clearTreesRadius: 52,
  },
  // 13. Geothermal Travertine Sinter Terraces (Steaming Turquoise Pools!)
  {
    id: 'travertine_onsen_terraces',
    index: 13,
    kind: 'travertine_onsen',
    category: 'onsen',
    nameJp: '白湯の石灰華段丘（秘湯棚田池）',
    shortJp: '白湯石灰華段丘',
    x: 755,
    z: 885,
    radius: 155,
    angle: -2.4,
    minZoomMap: 2.0,
    hasHotSpring: true,
    clearTreesRadius: 72,
  },
  // 14. Braided Alluvial Fan Delta
  {
    id: 'alluvial_fan_delta',
    index: 14,
    kind: 'alluvial_fan',
    category: 'fluvial',
    nameJp: '大沢扇状地・礫原デルタ',
    shortJp: '大沢扇状地',
    x: 1140,
    z: -480,
    radius: 640,
    angle: 3.02, // fans West into Kurosugi valley
    minZoomMap: 1.8,
    clearTreesRadius: 65,
  },
  // 15. Highland Peat Bog & Mirror Bog-Pools (Ozegahara-style)
  {
    id: 'wetland_peat_marsh',
    index: 15,
    kind: 'peat_bog',
    category: 'wetland',
    nameJp: '霧ヶ原・高層湿原＆池塘群',
    shortJp: '霧ヶ原高層湿原',
    x: 4620,
    z: 2420,
    radius: 920,
    bogRadius: 420,
    minZoomMap: 1.8,
    hasBogPools: true,
    clearTreesRadius: 340,
  },
  // 16. Granite Monolith Tors & Hoodoo Spires
  {
    id: 'hoodoo_granite_spires',
    index: 16,
    kind: 'granite_hoodoos',
    category: 'rock',
    nameJp: '天狗の奇岩群・花崗岩石柱塔',
    shortJp: '天狗奇岩群',
    x: -1440,
    z: -430,
    radius: 280,
    angle: 0.4,
    minZoomMap: 1.9,
    clearTreesRadius: 60,
  },
  // 17. Steep Granite Boulder Scree & Talus Chute
  {
    id: 'talus_boulder_chute',
    index: 17,
    kind: 'talus_chute',
    category: 'cliff',
    nameJp: '大ガレ場・花崗岩の崖錐斜面',
    shortJp: '大ガレ場崖錐',
    x: -1160,
    z: 1210,
    radius: 360,
    angle: 0.35,
    minZoomMap: 2.0,
    clearTreesRadius: 95,
  },
  // 18. Asymmetric Cuesta Fault-Scarp Ridge
  {
    id: 'cuesta_escarpment_ridge',
    index: 18,
    kind: 'cuesta_ridge',
    category: 'cliff',
    nameJp: '紅岩ケスタ断層崖',
    shortJp: '紅岩ケスタ崖',
    x: 1960,
    z: -1360,
    radius: 780,
    angle: 0.18,
    minZoomMap: 1.5,
    clearTreesRadius: 0,
  },
  // 19. High-Altitude Wind-Carved Alpine Saddle / Col Pass
  {
    id: 'saddle_alpine_pass',
    index: 19,
    kind: 'alpine_saddle',
    category: 'alpine',
    nameJp: '雲海の大峠（鞍部コル）',
    shortJp: '雲海の大峠',
    x: -4420,
    z: 4220,
    radius: 820,
    angle: -0.52,
    minZoomMap: 1.2,
    clearTreesRadius: 0,
  },
  // 20. Breached Volcanic Scoria / Cinder Cone
  {
    id: 'volcanic_scoria_cone',
    index: 20,
    kind: 'scoria_cone',
    category: 'volcano',
    nameJp: '黒岳スコリア丘（寄生火山）',
    shortJp: '黒岳スコリア丘',
    x: 6820,
    z: -7180,
    radius: 880,
    coneHeight: 290,
    minZoomMap: 1.0,
    clearTreesRadius: 210,
  },
  // 21. Braided River Sandbar & Cobble Island (Right inside Kurosugi River!)
  {
    id: 'river_braided_island',
    index: 21,
    kind: 'braided_island',
    category: 'fluvial',
    nameJp: '翡翠中洲の砂礫島',
    shortJp: '翡翠中洲島',
    x: 0, // resolved dynamically to evalMainRiver(1240).x
    z: 1240,
    radius: 175,
    angle: 0.0,
    minZoomMap: 2.6,
    clearTreesRadius: 0,
  },
  // 22. Mossy Stepped Bedrock Cascade Ravine (Intimate paradise near NARROW-50!)
  {
    id: 'ravine_moss_cascade',
    index: 22,
    kind: 'moss_cascade_ravine',
    category: 'water',
    nameJp: '幽玄の苔渓（階段状ナメ滝渓谷）',
    shortJp: '幽玄の苔渓',
    x: 340,
    z: -420,
    radius: 135,
    angle: -2.45, // cascades SW toward Kurosugi River
    minZoomMap: 2.4,
    hasWaterfall: true,
    clearTreesRadius: 26,
  },
];

// Snap braided river island x dynamically onto Kurosugi River centerline
{
  const isl = MAJOR_LANDFORMS_22.find((l) => l.id === 'river_braided_island');
  if (isl) {
    const rv = evalMainRiver(isl.z);
    isl.x = Math.round(rv.x);
  }
}

/**
 * Evaluate the height delta AND surface protection weights for all 22 landforms
 * directly into the 1024×1024 geomorphology heightfield!
 *
 * Notice how each landform uses its own authentic geological math:
 *  - Stepped terrace risers (river_terraces)
 *  - Flat-topped sharp escarpment tableland (volcanic_mesa)
 *  - Crater rim + deep recessed lake caldera + central dome (caldera_lake)
 *  - Armchair glacial cirque backwall + overdeepened tarn basin + terminal moraine (glacial_cirque)
 *  - Funnel karst doline depressions (karst_doline)
 *  - Asymmetric steep scarp / gentle dip slope (cuesta_ridge)
 *  - Twin-peak saddle pass (alpine_saddle)
 *  - Breached cinder cone (scoria_cone)
 *  - Rhythmic elongated teardrop drumlins (drumlin_hills)
 *  - Dramatic amphitheater waterfall headwalls + plunge pool basins (waterfall_multitier, waterfall_veil)
 *  - Steep incised V-canyon walls (v_gorge)
 *  - Flat elevated wetland bog basin (peat_bog)
 */
export function applyLandformsToHeightfield(heights, W, H, roadMaskArr) {
  const minX = TERRENO_WORLD.minX;
  const minZ = TERRENO_WORLD.minZ;
  const compX = TERRENO_WORLD.compoundCenterX;
  const compZ = TERRENO_WORLD.compoundCenterZ;
  const villX = TERRENO_WORLD.villageCenterX;
  const villZ = TERRENO_WORLD.villageCenterZ;

  // Store resolved base heights on each landform so 3D geological landmarks align to millimeter precision!
  const sampleGrid = (wx, wz) => {
    const fx = ((wx - minX) / TERRENO_WORLD.width) * (W - 1);
    const fz = ((wz - minZ) / TERRENO_WORLD.depth) * (H - 1);
    const ix = Math.max(0, Math.min(W - 2, Math.floor(fx)));
    const iz = Math.max(0, Math.min(H - 2, Math.floor(fz)));
    const tx = fx - ix, tz = fz - iz;
    const h00 = heights[iz * W + ix];
    const h10 = heights[iz * W + ix + 1];
    const h01 = heights[(iz + 1) * W + ix];
    const h11 = heights[(iz + 1) * W + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };

  for (let li = 0; li < MAJOR_LANDFORMS_22.length; li++) {
    const lf = MAJOR_LANDFORMS_22[li];
    lf.preBaseY = sampleGrid(lf.x, lf.z);

    const R = lf.radius * 1.25;
    const ix0 = Math.max(1, Math.floor(((lf.x - R - minX) / TERRENO_WORLD.width) * (W - 1)));
    const ix1 = Math.min(W - 2, Math.ceil(((lf.x + R - minX) / TERRENO_WORLD.width) * (W - 1)));
    const iz0 = Math.max(1, Math.floor(((lf.z - R - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const iz1 = Math.min(H - 2, Math.ceil(((lf.z + R - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const cosA = Math.cos(lf.angle || 0);
    const sinA = Math.sin(lf.angle || 0);

    for (let iz = iz0; iz <= iz1; iz++) {
      const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
      const dz = wz - lf.z;
      const row = iz * W;
      for (let ix = ix0; ix <= ix1; ix++) {
        const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
        const dx = wx - lf.x;
        const dist = Math.hypot(dx, dz);
        if (dist > R) continue;

        // Strictly protect NARROW-50 compound, Suginosato village & road corridors!
        const dComp = Math.hypot(wx - compX, wz - compZ);
        const dVill = Math.hypot(wx - villX, wz - villZ);
        const padProtect = quintic(36.0, 95.0, dComp) * quintic(48.0, 115.0, dVill);
        const idx = row + ix;
        const roadProt = 1.0 - Math.min(0.92, (roadMaskArr[idx] || 0) * 1.15);
        const protect = padProtect * roadProt;
        if (protect <= 0.001) continue;

        // Local rotated frame: lx = forward (facing direction), lz = lateral
        const lx = dx * cosA + dz * sinA;
        const lz = -dx * sinA + dz * cosA;
        const u = dist / lf.radius;
        const falloff = 1.0 - quintic(0.55, 1.18, u);
        let dh = 0.0;

        switch (lf.kind) {
          case 'waterfall_multitier': {
            // Back half (lx < 0) rises into a dramatic 34m terraced headwall; front (lx > 0) carves a plunge pool!
            const backWall = smoothstep(8.0, -34.0, lx) * (1.0 - quintic(0.45, 1.05, Math.abs(lz) / (lf.radius * 0.85)));
            const tierSteps = Math.floor(backWall * 3.0) * 0.14 + backWall * 0.86;
            const poolBowl = (1.0 - smoothstep(0.0, lf.poolRadius * 1.35, Math.hypot(lx - 18.0, lz))) * -5.2;
            dh = (tierSteps * (lf.cliffHeight || 34) + poolBowl) * falloff;
            break;
          }
          case 'waterfall_veil': {
            // Semi-circular mossy horseshoe amphitheater cliff + shallow emerald basin
            const backWall = smoothstep(4.0, -28.0, lx) * (1.0 - quintic(0.42, 1.0, Math.abs(lz) / (lf.radius * 0.82)));
            const poolBowl = (1.0 - smoothstep(0.0, lf.poolRadius * 1.25, Math.hypot(lx - 14.0, lz))) * -3.2;
            dh = (backWall * (lf.cliffHeight || 20) + poolBowl) * falloff;
            break;
          }
          case 'v_gorge': {
            // Steep dramatic V-shaped gorge walls flanking Kurosugi River
            const rv = evalMainRiver(wz);
            const dRiv = Math.abs(wx - rv.x);
            const gorgeSpan = 1.0 - quintic(0.25, 1.0, Math.abs(dz) / lf.radius);
            const wallBand = smoothstep(rv.halfWidth + 14.0, rv.halfWidth + 125.0, dRiv)
              * (1.0 - smoothstep(rv.halfWidth + 195.0, rv.halfWidth + 460.0, dRiv));
            const crag = 0.78 + 0.44 * noise2(wx * 0.012, wz * 0.012);
            dh = wallBand * gorgeSpan * 92.0 * crag;
            break;
          }
          case 'basalt_cliff': {
            // Sharp vertical cliff riser on western side with flat volcanic bench behind it!
            const scarp = smoothstep(18.0, -26.0, lx);
            const widthMask = 1.0 - quintic(0.55, 1.05, Math.abs(lz) / lf.radius);
            const rough = 0.88 + 0.24 * noise2(wx * 0.025, wz * 0.025);
            dh = scarp * widthMask * (lf.cliffHeight || 44) * rough * falloff;
            break;
          }
          case 'natural_arch': {
            // Twin rock abutments flanking a clear walkthrough saddle underneath the 3D stone arch!
            const lateral = Math.abs(lz);
            const leftButt = Math.exp(-Math.pow((lateral - 26.0) / 22.0, 2.0) - Math.pow(lx / 28.0, 2.0));
            const centerClear = Math.exp(-Math.pow(lateral / 14.0, 2.0) - Math.pow(lx / 24.0, 2.0));
            dh = (leftButt * 22.0 - centerClear * 2.5) * falloff;
            break;
          }
          case 'river_terraces': {
            // Classic 3-step Japanese fluvial river terraces with flat treads & crisp steep risers!
            const ramp = clamp01((lx + lf.radius * 0.75) / (lf.radius * 1.5));
            const s1 = smoothstep(0.18, 0.26, ramp);
            const s2 = smoothstep(0.48, 0.56, ramp);
            const s3 = smoothstep(0.76, 0.84, ramp);
            const benchH = (s1 * 18.0 + s2 * 22.0 + s3 * 24.0);
            const latMask = 1.0 - quintic(0.55, 1.05, Math.abs(lz) / lf.radius);
            dh = benchH * latMask * falloff;
            break;
          }
          case 'drumlin_hills': {
            // Rhythmic swarm of smooth teardrop-shaped rolling green drumlin hills!
            const d1 = Math.sin(lx * 0.0085) * Math.cos(lz * 0.0155);
            const d2 = Math.sin(lx * 0.0052 + 1.4) * Math.cos(lz * 0.0105 - 0.8);
            const mounds = Math.pow(Math.max(0.0, d1 * 0.55 + d2 * 0.45 + 0.35), 1.45);
            dh = mounds * 56.0 * falloff;
            break;
          }
          case 'volcanic_mesa': {
            // Flat-topped volcanic tableland bounded by sharp cliff walls (steep rim, dead-flat top!)
            const ang = Math.atan2(lz, lx);
            const rimWarp = 1.0 + 0.14 * Math.sin(ang * 3.0 + 0.7) + 0.08 * Math.cos(ang * 5.0 - 1.1);
            const rEff = dist / (lf.radius * 0.68 * rimWarp);
            const plateau = 1.0 - smoothstep(0.74, 0.98, rEff);
            const microCap = (noise2(wx * 0.008, wz * 0.008) - 0.5) * 4.5;
            dh = plateau * ((lf.mesaHeight || 132) + microCap);
            break;
          }
          case 'caldera_lake': {
            // Dramatic ring volcanic caldera rim surrounding deep sunken crater lake + mini central cone!
            const rNorm = dist / lf.radius;
            const ang = Math.atan2(lz, lx);
            const rimJag = 0.88 + 0.24 * noise2(Math.cos(ang) * 3.5 + 4, Math.sin(ang) * 3.5 + 4);
            const rimRing = Math.exp(-Math.pow((rNorm - 0.58) / 0.18, 2.0)) * (lf.rimHeight || 245) * rimJag;
            const innerBowl = (1.0 - smoothstep(0.32, 0.56, rNorm)) * 55.0; // elevated caldera floor
            const lakePit = (1.0 - smoothstep(0.0, lf.lakeRadius / lf.radius, rNorm)) * -68.0;
            const centralIsle = Math.exp(-Math.pow(rNorm / 0.085, 2.0)) * 52.0;
            dh = (rimRing + innerBowl + lakePit + centralIsle) * (1.0 - quintic(0.82, 1.18, rNorm));
            break;
          }
          case 'glacial_cirque': {
            // Horseshoe glacial armchair backwall (lx < 0) + overdeepened tarn basin + moraine ridge (lx > 0)!
            const rNorm = dist / lf.radius;
            const backArc = smoothstep(0.25, -0.45, lx / lf.radius);
            const headwall = backArc * Math.exp(-Math.pow((rNorm - 0.66) / 0.22, 2.0)) * 185.0;
            const tarnBasin = (1.0 - smoothstep(0.0, (lf.lakeRadius * 1.15) / lf.radius, Math.hypot(lx - 45, lz) / lf.radius)) * -34.0;
            const moraine = smoothstep(0.15, 0.55, lx / lf.radius) * Math.exp(-Math.pow((rNorm - 0.58) / 0.14, 2.0)) * 28.0;
            dh = (headwall + tarnBasin + moraine) * falloff;
            break;
          }
          case 'karst_doline': {
            // Elevated pale limestone karst tableland pitted with 5 funnel-shaped sinkhole dolines!
            const table = (1.0 - smoothstep(0.55, 0.98, u)) * 42.0;
            let pit = 0;
            const pits = [[0, 0, 115, 28], [-210, 160, 95, 22], [220, -140, 105, 24], [-180, -200, 88, 19], [160, 210, 92, 21]];
            for (let p = 0; p < pits.length; p++) {
              const dp = Math.hypot(dx - pits[p][0], dz - pits[p][1]);
              if (dp < pits[p][2]) {
                const f = 1.0 - dp / pits[p][2];
                pit -= f * f * pits[p][3];
              }
            }
            dh = (table + pit) * falloff;
            break;
          }
          case 'cave_grotto': {
            // Recessed rocky hollow pocket backed by a steep mossy overhang cliff!
            const backCliff = smoothstep(14.0, -32.0, lx) * (1.0 - quintic(0.45, 1.0, Math.abs(lz) / (lf.radius * 0.85)));
            const hollow = (1.0 - smoothstep(0.0, 28.0, Math.hypot(lx - 8, lz))) * -3.5;
            dh = (backCliff * 28.0 + hollow) * falloff;
            break;
          }
          case 'travertine_onsen': {
            // Gentle 5-tier stepped geothermal travertine sinter terraces descending the hillside!
            const slopeU = clamp01((lx + 85.0) / 170.0);
            const steps = (
              smoothstep(0.14, 0.20, slopeU) +
              smoothstep(0.32, 0.38, slopeU) +
              smoothstep(0.50, 0.56, slopeU) +
              smoothstep(0.68, 0.74, slopeU) +
              smoothstep(0.84, 0.90, slopeU)
            ) * 3.8;
            const lat = 1.0 - quintic(0.45, 0.95, Math.abs(lz) / (lf.radius * 0.72));
            dh = steps * lat * falloff;
            break;
          }
          case 'alluvial_fan': {
            // Smooth radial gravel cone fanning cleanly out from eastern canyon mouth
            const cone = Math.max(0.0, 1.0 - u) * 36.0 * smoothstep(-140.0, 180.0, lx);
            const braid = Math.sin(Math.atan2(lz, lx + 280.0) * 18.0) * 2.2 * (1.0 - u);
            dh = (cone + braid) * falloff;
            break;
          }
          case 'peat_bog': {
            // Gently flatten upland hollow into a serene flat Ozegahara-style peat moorland basin!
            const bogFlat = 1.0 - smoothstep(0.38, 0.88, dist / lf.radius);
            const targetH = lf.preBaseY - 12.0;
            heights[idx] = heights[idx] * (1.0 - bogFlat * protect * 0.82) + targetH * (bogFlat * protect * 0.82);
            dh = 0.0;
            break;
          }
          case 'granite_hoodoos': {
            // Craggy eroded bedrock dome supporting the 16 towering 3D granite spires!
            const dome = (1.0 - smoothstep(0.15, 0.95, u)) * 34.0 * (0.82 + 0.36 * noise2(wx * 0.02, wz * 0.02));
            dh = dome * falloff;
            break;
          }
          case 'talus_chute': {
            // Steep cliff headwall transitioning into a smooth 31° concave granite boulder scree apron
            const head = smoothstep(35.0, -140.0, lx) * 85.0;
            const chute = Math.exp(-Math.pow(lz / (90.0 + Math.max(0, lx) * 0.42), 2.0));
            const screeWave = (noise2(wx * 0.04, wz * 0.04) - 0.5) * 4.5;
            dh = (head + screeWave) * chute * falloff;
            break;
          }
          case 'cuesta_ridge': {
            // Classic asymmetric Cuesta: steep 55° cliff scarp on west (lx < 0), long gentle dip slope east (lx > 0)!
            const ridgeW = 1.0 - quintic(0.45, 1.0, Math.abs(lz) / lf.radius);
            let prof = 0;
            if (lx < 0) {
              prof = smoothstep(-190.0, -18.0, lx);
            } else {
              prof = Math.max(0.0, 1.0 - lx / (lf.radius * 0.92));
            }
            dh = prof * ridgeW * 128.0 * falloff;
            break;
          }
          case 'alpine_saddle': {
            // Twin high flanking peaks with a crisp U-shaped mountain pass / col directly between them!
            const peakL = Math.exp(-Math.pow((lz - 380.0) / 240.0, 2.0) - Math.pow(lx / 290.0, 2.0));
            const peakR = Math.exp(-Math.pow((lz + 380.0) / 240.0, 2.0) - Math.pow(lx / 290.0, 2.0));
            const colBridge = Math.exp(-Math.pow(lz / 460.0, 2.0) - Math.pow(lx / 210.0, 2.0)) * 0.42;
            dh = ((peakL + peakR) * 165.0 + colBridge * 110.0) * falloff;
            break;
          }
          case 'scoria_cone': {
            // Steep symmetrical dark volcanic cinder cone with a breached summit crater!
            const rNorm = dist / (lf.radius * 0.85);
            const cone = Math.max(0.0, 1.0 - rNorm) * (lf.coneHeight || 290);
            const crater = (1.0 - smoothstep(0.0, 0.24, rNorm)) * -78.0;
            const breach = smoothstep(0.0, 0.45, lx / lf.radius) * Math.exp(-Math.pow(lz / 110.0, 2.0)) * -42.0 * (1.0 - rNorm);
            dh = (cone + crater + breach) * falloff;
            break;
          }
          case 'braided_island': {
            // Streamlined teardrop sandbar/cobble island splitting Kurosugi River cleanly!
            const islandMask = Math.exp(-Math.pow(lx / 24.0, 2.0) - Math.pow(lz / 82.0, 2.0));
            dh = islandMask * 4.2;
            break;
          }
          case 'moss_cascade_ravine': {
            // Intimate 6-step mossy bedrock cascade staircase descending toward Kurosugi River!
            const along = clamp01((lx + 68.0) / 136.0);
            const lat = 1.0 - quintic(0.32, 0.88, Math.abs(lz) / 72.0);
            const steps = (
              smoothstep(0.12, 0.17, along) +
              smoothstep(0.28, 0.33, along) +
              smoothstep(0.44, 0.49, along) +
              smoothstep(0.60, 0.65, along) +
              smoothstep(0.76, 0.81, along)
            ) * 3.6;
            const channelCut = Math.exp(-Math.pow(lz / 13.0, 2.0)) * -2.2;
            dh = (steps * lat + channelCut) * falloff;
            break;
          }
        }

        if (dh !== 0.0) {
          heights[idx] += dh * protect;
        }
      }
    }
  }
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

/**
 * Fast spatial query returning the closest active landform at (wx, wz) or null.
 */
export function queryLandformAt(wx, wz, extraMargin = 0) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < MAJOR_LANDFORMS_22.length; i++) {
    const lf = MAJOR_LANDFORMS_22[i];
    const r = lf.radius + extraMargin;
    const dx = wx - lf.x;
    const dz = wz - lf.z;
    if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
    const d = Math.hypot(dx, dz);
    if (d <= r && d < bestDist) {
      bestDist = d;
      best = lf;
    }
  }
  return best ? { landform: best, dist: bestDist } : null;
}

/**
 * Check if a point (wx, wz) lies inside a landform water body, plunge pool, or cave clearing
 * where trees should not spawn.
 */
export function isInsideLandformTreeExclusion(wx, wz) {
  for (let i = 0; i < MAJOR_LANDFORMS_22.length; i++) {
    const lf = MAJOR_LANDFORMS_22[i];
    const cr = lf.clearTreesRadius || 0;
    if (cr <= 0) continue;
    const dx = wx - lf.x;
    const dz = wz - lf.z;
    if (Math.abs(dx) > cr || Math.abs(dz) > cr) continue;
    if (dx * dx + dz * dz < cr * cr) return lf;
  }
  return null;
}

/**
 * Compute distance to nearest animated waterfall / cascade for spatial roaring waterfall audio!
 */
export function getClosestWaterfallDist(wx, wz) {
  let best = 9999;
  for (let i = 0; i < MAJOR_LANDFORMS_22.length; i++) {
    const lf = MAJOR_LANDFORMS_22[i];
    if (!lf.hasWaterfall) continue;
    const d = Math.hypot(wx - lf.x, wz - lf.z);
    if (d < best) best = d;
  }
  return best;
}
