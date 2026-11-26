/**
 * TERRENO 5.0 — Continuous Geomorphological Terrain Engine (62 Natural Earth Landform Processes)
 *
 * Architectural Principle:
 *  - ZERO "theme-park landmark spots" stamped mechanically one-by-one.
 *  - ZERO artificial-looking 3D primitive "natural structures" (no cylinders, toruses, tubes, cones,
 *    boxes, icosahedron boulders, or detached waterfall cards).
 *  - Instead, ALL 62 real-world geomorphological processes (22 upgraded legacy types + 40 brand-new
 *    ultra-natural Earth terrain types) operate as CONTINUOUS GEOLOGICAL FIELDS & MULTI-OCCURRENCE
 *    PHYSICAL OPERATORS embedded directly into the 60 km × 60 km DEM heightfield, coupled to:
 *      • Tectonic strike, fault belts, folding phases & horizontal bedrock strata
 *      • Volcanic arc provinces (calderas, maars, lava domes, shield tongues, ignimbrite, lahars, fumaroles)
 *      • Pleistocene glacial altitude & aspect envelopes across all 18 alpine massifs
 *      • Kurosugi Main River + all 12 mountain tributaries (meanders, oxbows, levees, knickpoints, spurs)
 *      • Soluble limestone karst belts & groundwater seepage horizons
 *      • Mass-wasting, badlands rilling, avalanche couloirs & post-geology hydraulic/thermal erosion
 *  - Simultaneously bakes:
 *      1. 1024×1024 Float32 Heightfield (seamlessly fused via post-geology D8 erosion + 34° talus relaxation)
 *      2. 1024×1024 RGBA8 Geological Lithology Atlas (R: Volcanic/Basalt, G: Limestone/Pumice,
 *         B: Ochre/Badlands/Landslide/Sulfur, A: Peat/Fen/Backswamp/Wet-Silt)
 *      3. 1024×1024 Float32 Natural Basin Water Table (`basinWaterY`: strictly tucked BELOW eroded rims
 *         so every natural lake, oxbow, maar, tarn, kettle pond & dammed lake has a 100% organic contour shore!)
 *      4. 1024×1024 Uint8 Dominant Landform Map (`dominantKindId`: 1..62) & multi-occurrence emergent registry
 */

import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  TRIBUTARIES,
  evalMainRiver,
  evalRegionWeights,
} from './terrenoConfig.js';

// ============================================================================
// FAST DETERMINISTIC MULTI-OCTAVE & DOMAIN-WARPED NOISE PRIMITIVES
// ============================================================================
function clamp01(v) {
  return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v);
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3.0 - 2.0 * t);
}

function quintic(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function hash2i(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}

function vnoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = hash2i(ix, iz);
  const b = hash2i(ix + 1, iz);
  const c = hash2i(ix, iz + 1);
  const d = hash2i(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm3(x, z) {
  return (
    vnoise(x, z) * 0.54 +
    vnoise(x * 2.03 + 17.3, z * 2.03 - 11.7) * 0.30 +
    vnoise(x * 4.11 - 29.1, z * 4.11 + 37.9) * 0.16
  );
}

function ridged3(x, z) {
  const n1 = 1.0 - Math.abs(vnoise(x, z) * 2.0 - 1.0);
  const n2 = 1.0 - Math.abs(vnoise(x * 2.07 + 9.4, z * 2.07 - 14.2) * 2.0 - 1.0);
  const n3 = 1.0 - Math.abs(vnoise(x * 4.19 - 21.8, z * 4.19 + 18.6) * 2.0 - 1.0);
  return n1 * n1 * 0.56 + n2 * n2 * 0.30 + n3 * n3 * 0.14;
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

// ============================================================================
// MASTER CATALOG: ALL 62 CONTINUOUS REAL-WORLD GEOMORPHOLOGICAL PROCESSES
// (Indices 1..22 = Legacy 22 Re-Engineered as Natural Continuous Processes;
//  Indices 23..62 = 40 BRAND-NEW Ultra-Natural Geomorphological Variations!)
// ============================================================================
export const GEOLOGY_PROCESS_CATALOG_62 = [
  // --- Legacy 22 Upgraded into Continuous Organic Multi-Occurrence Engine Processes ---
  { index: 1,  id: 'waterfall_multitier',       kind: 'waterfall_multitier',       category: 'fluvial',  isNewV5: false, nameJp: '段瀑・急崖滝地形',           shortJp: '段瀑急崖',     hasWaterfall: true },
  { index: 2,  id: 'waterfall_veil',            kind: 'waterfall_veil',            category: 'fluvial',  isNewV5: false, nameJp: '潜流瀑・湧水懸崖地形',       shortJp: '潜流瀑崖',     hasWaterfall: true },
  { index: 3,  id: 'v_gorge',                   kind: 'v_gorge',                   category: 'fluvial',  isNewV5: false, nameJp: 'V字渓谷・大峡谷',            shortJp: 'V字大峡谷' },
  { index: 4,  id: 'basalt_cliff',              kind: 'basalt_cliff',              category: 'volcano',  isNewV5: false, nameJp: '玄武岩急崖・溶岩断崖',       shortJp: '玄武岩断崖' },
  { index: 5,  id: 'natural_arch',              kind: 'natural_arch',              category: 'tectonic', isNewV5: false, nameJp: '侵食岩門峠・岩稜切通し',     shortJp: '侵食岩峠' },
  { index: 6,  id: 'river_terraces',            kind: 'river_terraces',            category: 'fluvial',  isNewV5: false, nameJp: '蛇行河岸段丘',               shortJp: '河岸段丘' },
  { index: 7,  id: 'drumlin_hills',             kind: 'drumlin_hills',             category: 'glacial',  isNewV5: false, nameJp: '流線型ドラムリン丘陵群',     shortJp: 'ドラムリン丘' },
  { index: 8,  id: 'volcanic_mesa',             kind: 'volcanic_mesa',             category: 'volcano',  isNewV5: false, nameJp: '開析溶岩台地（メサ）',       shortJp: '溶岩メサ台地' },
  { index: 9,  id: 'caldera_lake',              kind: 'caldera_lake',              category: 'volcano',  isNewV5: false, nameJp: 'カルデラ火口湖',             shortJp: 'カルデラ湖',   hasLake: true },
  { index: 10, id: 'glacial_cirque',            kind: 'glacial_cirque',            category: 'glacial',  isNewV5: false, nameJp: '氷河圏谷カール＆氷河湖',     shortJp: '氷河カール湖', hasLake: true },
  { index: 11, id: 'karst_doline',              kind: 'karst_doline',              category: 'karst',    isNewV5: false, nameJp: 'カルスト・ドリーネ陥没群',   shortJp: 'カルスト凹地' },
  { index: 12, id: 'cave_grotto',               kind: 'cave_grotto',               category: 'karst',    isNewV5: false, nameJp: '石灰岩陥没岩窟・湧水凹崖',   shortJp: '石灰岩凹崖' },
  { index: 13, id: 'travertine_onsen',          kind: 'travertine_onsen',          category: 'volcano',  isNewV5: false, nameJp: '石灰華地熱段丘・湧出緩斜面', shortJp: '石灰華地熱帯', hasHotSpring: true },
  { index: 14, id: 'alluvial_fan',              kind: 'alluvial_fan',              category: 'fluvial',  isNewV5: false, nameJp: '網状扇状地・礫原デルタ',     shortJp: '網状扇状地' },
  { index: 15, id: 'peat_bog',                  kind: 'peat_bog',                  category: 'wetland',  isNewV5: false, nameJp: '高層湿原・池塘盆地',         shortJp: '高層湿原',     hasBogPools: true },
  { index: 16, id: 'granite_hoodoos',           kind: 'granite_hoodoos',           category: 'erosion',  isNewV5: false, nameJp: '差別侵食花崗岩岩稜トア',     shortJp: '花崗岩トア' },
  { index: 17, id: 'talus_chute',               kind: 'talus_chute',               category: 'erosion',  isNewV5: false, nameJp: '花崗岩崖錐・大ガレ場斜面',   shortJp: '大ガレ場崖錐' },
  { index: 18, id: 'cuesta_ridge',              kind: 'cuesta_ridge',              category: 'tectonic', isNewV5: false, nameJp: 'ケスタ非対称断層傾動崖',     shortJp: 'ケスタ傾動崖' },
  { index: 19, id: 'alpine_saddle',             kind: 'alpine_saddle',             category: 'glacial',  isNewV5: false, nameJp: '高山鞍部・大峠コル',         shortJp: '高山鞍部峠' },
  { index: 20, id: 'scoria_cone',               kind: 'scoria_cone',               category: 'volcano',  isNewV5: false, nameJp: '開析スコリア丘・寄生火山',   shortJp: 'スコリア丘' },
  { index: 21, id: 'braided_island',            kind: 'braided_island',            category: 'fluvial',  isNewV5: false, nameJp: '河川網状中洲・砂礫州',       shortJp: '河川砂礫中洲' },
  { index: 22, id: 'moss_cascade_ravine',       kind: 'moss_cascade_ravine',       category: 'fluvial',  isNewV5: false, nameJp: '階段状ナメ滝苔渓',           shortJp: '苔渓ナメ滝',   hasWaterfall: true },

  // --- 40 BRAND-NEW ULTRA-NATURAL GEOMORPHOLOGICAL VARIATIONS (V5 Continuous Engine) ---
  // Group A: Fluvial & River-Valley Geomorphology (9)
  { index: 23, id: 'oxbow_cutoff_lake',         kind: 'oxbow_cutoff_lake',         category: 'fluvial',  isNewV5: true,  nameJp: '三日月湖・旧河道湿地',           shortJp: '三日月湖',     hasLake: true },
  { index: 24, id: 'incised_meander_gorge',     kind: 'incised_meander_gorge',     category: 'fluvial',  isNewV5: true,  nameJp: '穿入蛇行渓谷（屈曲峡谷）',       shortJp: '穿入蛇行谷' },
  { index: 25, id: 'point_bar_scroll_plain',    kind: 'point_bar_scroll_plain',    category: 'fluvial',  isNewV5: true,  nameJp: 'ポイントバー・曲流州原',         shortJp: '曲流州原' },
  { index: 26, id: 'natural_levee_backswamp',   kind: 'natural_levee_backswamp',   category: 'fluvial',  isNewV5: true,  nameJp: '自然堤防と後背湿地',             shortJp: '後背湿地帯',   hasBogPools: true },
  { index: 27, id: 'knickpoint_rock_rapids',    kind: 'knickpoint_rock_rapids',    category: 'fluvial',  isNewV5: true,  nameJp: '遷急点・早瀬岩床渓谷',           shortJp: '遷急点早瀬',   hasWaterfall: true },
  { index: 28, id: 'hanging_tributary_valley',  kind: 'hanging_tributary_valley',  category: 'fluvial',  isNewV5: true,  nameJp: '懸谷（ハンギングバレー）',       shortJp: '懸谷トラフ' },
  { index: 29, id: 'dry_paleochannel_valley',   kind: 'dry_paleochannel_valley',   category: 'fluvial',  isNewV5: true,  nameJp: '枯れ川・旧流路窪地（水無川）',   shortJp: '旧流路枯れ川' },
  { index: 30, id: 'compound_bajada_apron',     kind: 'compound_bajada_apron',     category: 'fluvial',  isNewV5: true,  nameJp: 'バハダ複合扇状地（合流礫原）',   shortJp: 'バハダ礫原' },
  { index: 31, id: 'interlocking_valley_spurs', kind: 'interlocking_valley_spurs', category: 'fluvial',  isNewV5: true,  nameJp: '噛み合い尾根渓谷',               shortJp: '噛み合い渓谷' },

  // Group B: Glacial & Periglacial Alpine Geomorphology (8)
  { index: 32, id: 'glacial_u_trough',          kind: 'glacial_u_trough',          category: 'glacial',  isNewV5: true,  nameJp: 'U字谷（氷食谷）',                shortJp: '氷食U字谷' },
  { index: 33, id: 'knife_edge_arete',          kind: 'knife_edge_arete',          category: 'glacial',  isNewV5: true,  nameJp: 'アレート（痩せ尾根・鋸歯稜線）', shortJp: '鋸歯アレート' },
  { index: 34, id: 'glacial_horn_peak',         kind: 'glacial_horn_peak',         category: 'glacial',  isNewV5: true,  nameJp: 'ホルン（氷食尖峰）',             shortJp: '氷食ホルン峰' },
  { index: 35, id: 'lateral_moraine_ridge',     kind: 'lateral_moraine_ridge',     category: 'glacial',  isNewV5: true,  nameJp: '側堆石堤（ラテラルモレーン）',   shortJp: '側堆石堤' },
  { index: 36, id: 'kettle_hole_ponds',         kind: 'kettle_hole_ponds',         category: 'glacial',  isNewV5: true,  nameJp: 'ケトルホール群（氷塊融解小沼）', shortJp: 'ケトル小沼群', hasLake: true },
  { index: 37, id: 'roche_moutonnee_knolls',    kind: 'roche_moutonnee_knolls',    category: 'glacial',  isNewV5: true,  nameJp: '羊背岩丘群（ロッシュ・ムトネ）', shortJp: '羊背岩丘群' },
  { index: 38, id: 'solifluction_lobe_slope',   kind: 'solifluction_lobe_slope',   category: 'glacial',  isNewV5: true,  nameJp: '周氷河ソリフラクション緩斜面',   shortJp: '周氷河緩斜面' },
  { index: 39, id: 'nivation_snow_hollow',      kind: 'nivation_snow_hollow',      category: 'glacial',  isNewV5: true,  nameJp: '雪食凹地・雪渓カール',           shortJp: '雪食雪渓窪地' },

  // Group C: Volcanic & Geothermal Geomorphology (7)
  { index: 40, id: 'maar_crater_lake',          kind: 'maar_crater_lake',          category: 'volcano',  isNewV5: true,  nameJp: 'マール爆発火口湖',               shortJp: 'マール火口湖', hasLake: true },
  { index: 41, id: 'lava_dome_extrusion',       kind: 'lava_dome_extrusion',       category: 'volcano',  isNewV5: true,  nameJp: '溶岩ドーム（鐘状火山丘）',       shortJp: '溶岩ドーム' },
  { index: 42, id: 'ignimbrite_sheet_bench',    kind: 'ignimbrite_sheet_bench',    category: 'volcano',  isNewV5: true,  nameJp: '火砕流台地（開析シラス台地）',   shortJp: '火砕流台地' },
  { index: 43, id: 'shield_lava_apron',         kind: 'shield_lava_apron',         category: 'volcano',  isNewV5: true,  nameJp: '玄武岩溶岩流舌（溶岩原）',       shortJp: '玄武岩溶岩原' },
  { index: 44, id: 'tuff_ring_amphitheater',    kind: 'tuff_ring_amphitheater',    category: 'volcano',  isNewV5: true,  nameJp: 'タフリング凝灰岩火口輪',         shortJp: 'タフリング輪' },
  { index: 45, id: 'lahar_debris_lobe',         kind: 'lahar_debris_lobe',         category: 'volcano',  isNewV5: true,  nameJp: '火山泥流（ラハール）堆積斜面',   shortJp: 'ラハール斜面' },
  { index: 46, id: 'fumarole_sulfur_basin',     kind: 'fumarole_sulfur_basin',     category: 'volcano',  isNewV5: true,  nameJp: '硫気変質荒原・噴気窪地',         shortJp: '硫気変質窪地', hasHotSpring: true },

  // Group D: Tectonic & Structural Geomorphology (6)
  { index: 47, id: 'fault_scarp_step',          kind: 'fault_scarp_step',          category: 'tectonic', isNewV5: true,  nameJp: '活断層崖（断層変位段差）',       shortJp: '活断層崖' },
  { index: 48, id: 'graben_rift_trough',        kind: 'graben_rift_trough',        category: 'tectonic', isNewV5: true,  nameJp: '地溝帯（グラーベン構造谷）',     shortJp: '地溝構造谷' },
  { index: 49, id: 'hogback_strike_ridge',      kind: 'hogback_strike_ridge',      category: 'tectonic', isNewV5: true,  nameJp: 'ホッグバック（急傾斜岩脈尾根）', shortJp: 'ホッグバック' },
  { index: 50, id: 'anticline_folded_dome',     kind: 'anticline_folded_dome',     category: 'tectonic', isNewV5: true,  nameJp: '背斜褶曲ドーム丘陵',             shortJp: '背斜褶曲丘' },
  { index: 51, id: 'fault_line_wind_gap',       kind: 'fault_line_wind_gap',       category: 'tectonic', isNewV5: true,  nameJp: '断層鞍部・風隙（ウィンドギャップ）', shortJp: '断層風隙峠' },
  { index: 52, id: 'structural_bench_steps',    kind: 'structural_bench_steps',    category: 'tectonic', isNewV5: true,  nameJp: '構造段丘（水平互層ベンチ）',     shortJp: '構造互層段丘' },

  // Group E: Erosional, Slope & Mass-Wasting Geomorphology (6)
  { index: 53, id: 'landslide_scar_hummocks',   kind: 'landslide_scar_hummocks',   category: 'erosion',  isNewV5: true,  nameJp: '地すべり滑落崖と流れ山丘群',     shortJp: '地すべり崩壊' },
  { index: 54, id: 'landslide_dammed_lake',     kind: 'landslide_dammed_lake',     category: 'erosion',  isNewV5: true,  nameJp: '天然堰止湖（崩壊せき止め湖）',   shortJp: '天然堰止湖',   hasLake: true },
  { index: 55, id: 'badlands_rilled_gullies',   kind: 'badlands_rilled_gullies',   category: 'erosion',  isNewV5: true,  nameJp: '悪地浸食ガリー斜面（バッドランド）', shortJp: '悪地ガリー' },
  { index: 56, id: 'avalanche_chute_couloir',   kind: 'avalanche_chute_couloir',   category: 'erosion',  isNewV5: true,  nameJp: '雪崩シュート・急峻ルンゼ',       shortJp: '雪崩ルンゼ' },
  { index: 57, id: 'debris_flow_levee_cone',    kind: 'debris_flow_levee_cone',    category: 'erosion',  isNewV5: true,  nameJp: '土石流扇状微地形（礫堤チャネル）', shortJp: '土石流礫堤' },
  { index: 58, id: 'pediment_inselberg_knoll',  kind: 'pediment_inselberg_knoll',  category: 'erosion',  isNewV5: true,  nameJp: 'ペディメント緩斜面と残丘',       shortJp: 'ペディメント残丘' },

  // Group F: Karst, Groundwater & Wetland Geomorphology (4)
  { index: 59, id: 'karst_polje_flat_basin',    kind: 'karst_polje_flat_basin',    category: 'karst',    isNewV5: true,  nameJp: 'ポリエ（カルスト大閉塞盆地）',   shortJp: 'カルストポリエ', hasBogPools: true },
  { index: 60, id: 'karst_uvala_compound',      kind: 'karst_uvala_compound',      category: 'karst',    isNewV5: true,  nameJp: 'ウバーレ（複合ドリーネ連穴）',   shortJp: 'ウバーレ連穴' },
  { index: 61, id: 'spring_sapping_alcove',     kind: 'spring_sapping_alcove',     category: 'karst',    isNewV5: true,  nameJp: '湧水侵食アンフィシアター',       shortJp: '湧水凹湾谷',   hasWaterfall: true },
  { index: 62, id: 'alpine_seepage_fen_terrace',kind: 'alpine_seepage_fen_terrace',category: 'wetland',  isNewV5: true,  nameJp: '傾斜湿原・湧水フェン',           shortJp: '湧水傾斜湿原', hasBogPools: true },
];

export const GEOLOGY_BY_INDEX = new Map(GEOLOGY_PROCESS_CATALOG_62.map((g) => [g.index, g]));
export const GEOLOGY_BY_ID = new Map(GEOLOGY_PROCESS_CATALOG_62.map((g) => [g.id, g]));

// ============================================================================
// CONTINUOUS GEOLOGICAL PROVINCE FIELDS (NO SINGLE-SPOT SILOS!)
// ============================================================================
export function evalGeologicalProvinces(wx, wz) {
  // Large-scale warped geological province coordinates
  const dux = (vnoise(wx * 0.000095 + 3.2, wz * 0.000095 - 5.1) - 0.5) * 4800.0;
  const duz = (vnoise(wx * 0.000095 - 7.4, wz * 0.000095 + 2.8) - 0.5) * 4800.0;
  const gx = wx + dux;
  const gz = wz + duz;

  // Volcanic arc belt sweeping NW -> NE -> SE across outer & mid volcanic massifs
  const vField = fbm3(gx * 0.000085 + 11.2, gz * 0.000085 - 8.4);
  const volcanic = smoothstep(0.46, 0.72, vField);

  // Soluble Paleozoic Limestone Karst belt (predominant in E / SE / mid-east foothills & patchy NW)
  const kField = fbm3(gx * 0.000092 - 19.5, gz * 0.000092 + 14.3);
  const karst = smoothstep(0.50, 0.74, kField) * (1.0 - volcanic * 0.65);

  // Folded Sedimentary & Active Fault Belt (W / central flanks / N-E strike ridges)
  const tField = fbm3(gx * 0.000105 + 27.1, gz * 0.000105 + 6.9);
  const tectonic = smoothstep(0.42, 0.70, tField);

  // Weak Clay-Tuff / Mass-Wasting Susceptibility Field (drives badlands, landslides, debris flows)
  const eField = fbm3(gx * 0.000115 - 33.4, gz * 0.000115 - 22.1);
  const erodible = smoothstep(0.48, 0.73, eField);

  // Glacial Outwash & Periglacial Belt (high latitude/elevation + broad SW/NW foothills)
  const gField = fbm3(gx * 0.000090 + 41.0, gz * 0.000090 - 31.0);
  const glacialBelt = smoothstep(0.45, 0.72, gField);

  // Regional groundwater / wetland moisture province
  const rw = evalRegionWeights(wx, wz);
  const wetlandProv = clamp01(rw.wetland * 1.15 + smoothstep(0.56, 0.78, fbm3(gx * 0.00011 + 5.5, gz * 0.00011 + 29.0)) * 0.65);

  return { volcanic, karst, tectonic, erodible, glacialBelt, wetlandProv, rw };
}

// ============================================================================
// PROCEDURAL MULTI-OCCURRENCE FEATURE FIELD GENERATOR
// (Spawns organic recurring suites of discrete landforms across geological provinces,
//  rivers, tributaries, and alpine massifs — NEVER 1 hardcoded landmark per type!)
// ============================================================================
function generateMultiOccurrenceGeologyFeatures(sampleGrid, roadIndex) {
  const rng = makeRng(20261126);
  const features = [];
  const compX = TERRENO_WORLD.compoundCenterX;
  const compZ = TERRENO_WORLD.compoundCenterZ;
  const villX = TERRENO_WORLD.villageCenterX;
  const villZ = TERRENO_WORLD.villageCenterZ;

  const isSafeFromSettlements = (wx, wz, minDistComp = 210, minDistVill = 260) => {
    if (Math.hypot(wx - compX, wz - compZ) < minDistComp) return false;
    if (Math.hypot(wx - villX, wz - villZ) < minDistVill) return false;
    if (wz > 28200 && Math.abs(wx) < 900) return false; // Protect NULL EREA
    if (Math.abs(wx) > 27600 || Math.abs(wz) > 27600) return false;
    return true;
  };

  const pushFeature = (kindIndex, wx, wz, radius, angle, extra = {}) => {
    const meta = GEOLOGY_BY_INDEX.get(kindIndex);
    if (!meta) return;
    features.push({
      kindIndex,
      id: meta.id,
      kind: meta.kind,
      nameJp: meta.nameJp,
      shortJp: meta.shortJp,
      category: meta.category,
      hasLake: Boolean(meta.hasLake || extra.hasLake),
      hasWaterfall: Boolean(meta.hasWaterfall || extra.hasWaterfall),
      hasHotSpring: Boolean(meta.hasHotSpring || extra.hasHotSpring),
      hasBogPools: Boolean(meta.hasBogPools || extra.hasBogPools),
      x: wx,
      z: wz,
      radius,
      angle,
      seed: Math.floor(rng() * 100000),
      ...extra,
    });
  };

  // --------------------------------------------------------------------------
  // A. RIVER-COUPLED NATURAL RECURRING FLUVIAL FEATURES (Along entire 60km Kurosugi River!)
  // --------------------------------------------------------------------------
  // Multiple natural Oxbow Cutoff Lakes (#23), Braided Cobble Islands (#21), Point Bars (#25)
  const oxbowZs = [-14200, -4800, 1950, 7400, 13200, 19100];
  for (let i = 0; i < oxbowZs.length; i++) {
    const z0 = oxbowZs[i] + (rng() - 0.5) * 600;
    const rv = evalMainRiver(z0);
    const rvP = evalMainRiver(z0 + 400);
    const rvM = evalMainRiver(z0 - 400);
    // Natural outer bend side of meander!
    const curv = (rvP.x - 2 * rv.x + rvM.x);
    const side = curv >= 0 ? -1 : 1;
    const ox = rv.x + side * (rv.halfWidth + 135 + rng() * 110);
    const oz = z0;
    if (!isSafeFromSettlements(ox, oz, 380, 420)) continue;
    const rq = roadIndex.queryDist(ox, oz);
    if (rq.segIdx >= 0 && rq.dist < 165) continue;
    pushFeature(23, ox, oz, 240 + rng() * 120, Math.atan2(rvP.z - rvM.z, rvP.x - rvM.x) + (side > 0 ? 0 : Math.PI), {
      side, riverWaterY: rv.waterY, hasLake: true, lakeKind: 'oxbow',
    });
  }

  // Multiple natural Braided River Cobble Islands (#21) inside wider reaches of Kurosugi River
  const islandZs = [-10400, -3400, 1240, 4850, 11400, 17200, 23200];
  for (let i = 0; i < islandZs.length; i++) {
    const z0 = islandZs[i];
    const rv = evalMainRiver(z0);
    pushFeature(21, rv.x + (rng() - 0.5) * 8, z0, 145 + rng() * 55, 0, { riverWaterY: rv.waterY });
  }

  // Multiple natural V-Gorges (#3) & Incised Meander Canyons (#24) where Kurosugi River cuts mountain constrictions
  const gorgeZs = [-18200, -11200, -1850, 3850, 15400];
  for (let i = 0; i < gorgeZs.length; i++) {
    const z0 = gorgeZs[i];
    const rv = evalMainRiver(z0);
    pushFeature(i % 2 === 0 ? 3 : 24, rv.x, z0, 720 + rng() * 280, (rng() - 0.5) * 0.25);
  }

  // --------------------------------------------------------------------------
  // B. TRIBUTARY-COUPLED NATURAL RECURRING FEATURES (Across ALL 12 Mountain Tributaries!)
  // --------------------------------------------------------------------------
  for (let ti = 0; ti < TRIBUTARIES.length; ti++) {
    const tr = TRIBUTARIES[ti];
    const rv = evalMainRiver(tr.z0);
    const ang = Math.atan2(tr.dirZ, tr.dirX);
    const px = -tr.dirZ;
    const pz = tr.dirX;

    // 1. Alluvial Fan (#14) or Compound Bajada (#30) where tributary exits mountain flank into valley
    const fanD = 750 + rng() * 550;
    const fx = rv.x + tr.dirX * fanD;
    const fz = tr.z0 + tr.dirZ * fanD;
    if (isSafeFromSettlements(fx, fz, 320, 340)) {
      pushFeature(ti % 2 === 0 ? 14 : 30, fx, fz, 540 + rng() * 240, ang + Math.PI);
    }

    // 2. Knickpoint Rock Rapids (#27) / Multi-tier Waterfall Cliff (#1) / Veil Spring Cliff (#2) / Mossy Cascade (#22) along mid tributary
    const kpD = 2600 + rng() * 2800;
    const kpx = rv.x + tr.dirX * kpD;
    const kpz = tr.z0 + tr.dirZ * kpD;
    if (isSafeFromSettlements(kpx, kpz, 260, 260)) {
      const kCycle = [27, 1, 22, 2];
      const kKind = kCycle[ti % 4];
      pushFeature(kKind, kpx, kpz, 220 + rng() * 110, ang + Math.PI, {
        cliffHeight: 24 + rng() * 22, hasWaterfall: true,
      });
    }

    // 3. Hanging Tributary Valley (#28) or Interlocking Valley Spurs (#31) or Landslide-Dammed Lake (#54) upper reach
    const upD = 6200 + rng() * 3400;
    const ux = rv.x + tr.dirX * upD + px * (rng() - 0.5) * 280;
    const uz = tr.z0 + tr.dirZ * upD + pz * (rng() - 0.5) * 280;
    if (isSafeFromSettlements(ux, uz, 400, 400)) {
      if (ti % 3 === 0) {
        pushFeature(54, ux, uz, 460 + rng() * 160, ang + Math.PI, { hasLake: true, lakeKind: 'dammed' });
      } else if (ti % 3 === 1) {
        pushFeature(28, ux, uz, 620 + rng() * 220, ang + Math.PI);
      } else {
        pushFeature(31, ux, uz, 740 + rng() * 240, ang);
      }
    }

    // 4. Debris-Flow Levee Cone (#57) along steep side-ravine mouth
    const dfD = 4200 + rng() * 3000;
    const dfx = rv.x + tr.dirX * dfD + px * (ti % 2 === 0 ? 480 : -480);
    const dfz = tr.z0 + tr.dirZ * dfD + pz * (ti % 2 === 0 ? 480 : -480);
    if (isSafeFromSettlements(dfx, dfz, 340, 340)) {
      pushFeature(57, dfx, dfz, 320 + rng() * 140, ang + (ti % 2 === 0 ? -1.4 : 1.4));
    }
  }

  // --------------------------------------------------------------------------
  // C. ALPINE MASSIF-COUPLED GLACIAL & EROSIONAL FEATURES (Across ALL 18 Mountain Massifs!)
  // --------------------------------------------------------------------------
  for (let pi = 0; pi < MOUNTAIN_PEAKS.length; pi++) {
    const pk = MOUNTAIN_PEAKS[pi];
    const isHigh = pk.height >= 680;
    const isVeryHigh = pk.height >= 920;

    // 1. Glacial Horn Peak (#34) + Knife-Edge Arête (#33) on all towering alpine summits
    if (isVeryHigh) {
      pushFeature(34, pk.x, pk.z, Math.min(pk.radiusX, pk.radiusZ) * 0.42, pk.ridgeAngle);
      pushFeature(33, pk.x + Math.cos(pk.ridgeAngle) * pk.radiusX * 0.36, pk.z + Math.sin(pk.ridgeAngle) * pk.radiusZ * 0.36,
        pk.radiusX * 0.44, pk.ridgeAngle);
    }

    // 2. Glacial Cirque & Tarn Lake (#10) + Lateral Moraine (#35) + Glacial U-Trough (#32) on north/NE/E flanks!
    if (isHigh) {
      const cAng = -Math.PI * 0.35 + (rng() - 0.5) * 0.9; // N-to-E snow-preserving aspects!
      const cx = pk.x + Math.cos(cAng) * pk.radiusX * 0.38;
      const cz = pk.z + Math.sin(cAng) * pk.radiusZ * 0.38;
      if (isSafeFromSettlements(cx, cz, 450, 450)) {
        pushFeature(10, cx, cz, 580 + rng() * 240, cAng, { hasLake: true, lakeKind: 'tarn' });
        // Descending Glacial U-Trough (#32) + Lateral Moraine (#35) directly downslope from cirque!
        const tx = cx + Math.cos(cAng) * 950;
        const tz = cz + Math.sin(cAng) * 950;
        if (isSafeFromSettlements(tx, tz, 450, 450)) {
          pushFeature(32, tx, tz, 820 + rng() * 280, cAng);
          pushFeature(35, tx - Math.sin(cAng) * 320, tz + Math.cos(cAng) * 320, 620 + rng() * 200, cAng);
        }
      }
    }

    // 3. Avalanche Chute Couloirs (#56) & Talus Scree Chutes (#17) on steep mountain flanks
    const avAng = pk.ridgeAngle + Math.PI * 0.5 + (rng() - 0.5) * 0.7;
    const ax = pk.x + Math.cos(avAng) * pk.radiusX * 0.42;
    const az = pk.z + Math.sin(avAng) * pk.radiusZ * 0.42;
    if (isSafeFromSettlements(ax, az, 320, 340)) {
      pushFeature(pi % 2 === 0 ? 56 : 17, ax, az, 380 + rng() * 220, avAng);
    }

    // 4. Nivation Snow Hollows (#39) on shaded northern shoulders of mid/high peaks
    if (pk.height >= 440) {
      const nx = pk.x + (rng() - 0.5) * pk.radiusX * 0.28;
      const nz = pk.z - pk.radiusZ * 0.34;
      if (isSafeFromSettlements(nx, nz, 400, 400)) {
        pushFeature(39, nx, nz, 320 + rng() * 180, -Math.PI * 0.5 + (rng() - 0.5) * 0.5);
      }
    }
  }

  // --------------------------------------------------------------------------
  // D. STRATIFIED POISSON MULTI-OCCURRENCE GEOLOGICAL FIELD SAMPLER (60km × 60km)
  //    Spawns natural recurring suites of volcanic, karst, tectonic, wetland, glacial &
  //    erosional landforms organically wherever the geological province matches!
  // --------------------------------------------------------------------------
  // 1. Immediate Valley & Mid-Ring (0.35 km .. 4.5 km from NARROW-50) so players explore
  //    extraordinary natural geology right from spawn (ZERO artificial props!)
  const valleySeeds = [
    // Near-valley organic cascade cliffs, spring alcoves, basalt scarps, geothermal slopes,
    // landslide scars, dry paleochannels, oxbow/seepage fens, structural benches, fault wind gaps
    { k: 1,  x: -285,  z: -340,  r: 195, a: 0.48, extra: { cliffHeight: 34, hasWaterfall: true } }, // Natural terraced waterfall cliff
    { k: 2,  x: 365,   z: 520,   r: 175, a: -2.3, extra: { cliffHeight: 24, hasWaterfall: true } }, // Spring veil cliff
    { k: 22, x: 410,   z: -490,  r: 210, a: -2.4, extra: { hasWaterfall: true } },                   // Mossy stepped cascade ravine
    { k: 4,  x: -510,  z: 245,   r: 250, a: 0.18, extra: { cliffHeight: 42 } },                     // Basalt escarpment cliff
    { k: 5,  x: 590,   z: -245,  r: 210, a: 0.55 },                                                  // Eroded granite pass
    { k: 12, x: -640,  z: 740,   r: 205, a: -0.65 },                                                 // Collapsed karst hollow alcove
    { k: 13, x: 820,   z: 930,   r: 265, a: -2.35, extra: { hasHotSpring: true } },                 // Natural geothermal travertine slope
    { k: 61, x: -720,  z: -680,  r: 240, a: 0.72, extra: { hasWaterfall: true } },                  // Spring-sapping theater alcove
    { k: 53, x: 1080,  z: 460,   r: 360, a: -2.65 },                                                // Landslide headscarp & hummocks
    { k: 29, x: -940,  z: 1120,  r: 420, a: 0.42 },                                                 // Dry paleochannel cobble valley
    { k: 23, x: Math.round(evalMainRiver(1980).x - 175), z: 1980, r: 295, a: 0.35, extra: { hasLake: true, lakeKind: 'oxbow', riverWaterY: evalMainRiver(1980).waterY } }, // Near-valley Oxbow cutoff lake!
    { k: 62, x: 1420,  z: -860,  r: 380, a: -2.8, extra: { hasBogPools: true } },                   // Alpine seepage fen terrace
    { k: 47, x: -1680, z: -220,  r: 680, a: 0.24 },                                                 // Active fault scarp step
    { k: 55, x: 1850,  z: 1480,  r: 480, a: -1.8 },                                                 // Badlands rilled gully slope
    { k: 40, x: -2380, z: -1580, r: 580, a: 0.2, extra: { hasLake: true, lakeKind: 'maar' } },      // Near-range Maar explosion crater lake!
    { k: 41, x: 2680,  z: -1950, r: 540, a: -0.6 },                                                 // Viscous dacite Lava Dome!
    { k: 46, x: -2650, z: 2150,  r: 420, a: 0.9, extra: { hasHotSpring: true } },                   // Fumarole sulfur hydrothermal basin!
    { k: 54, x: 2420,  z: -3200, r: 560, a: -2.1, extra: { hasLake: true, lakeKind: 'dammed' } },   // Landslide-dammed mountain lake!
    { k: 59, x: 2950,  z: 2450,  r: 780, a: 0.32, extra: { hasBogPools: true } },                   // Karst polje enclosed flat basin!
    { k: 60, x: 2180,  z: 2780,  r: 480, a: -0.4 },                                                 // Karst uvala compound depression!
    { k: 51, x: -1250, z: -2100, r: 460, a: 1.2 },                                                  // Fault-line wind gap!
    { k: 36, x: -2920, z: 980,   r: 520, a: 0.5, extra: { hasLake: true, lakeKind: 'kettle' } },    // Kettle hole ponds!
    { k: 49, x: -2150, z: -3100, r: 740, a: 0.68 },                                                 // Hogback strike ridge!
    { k: 58, x: 3250,  z: 720,   r: 680, a: -0.25 },                                                // Pediment & inselberg knoll!
    { k: 43, x: 3650,  z: -1280, r: 840, a: -2.9 },                                                 // Basalt shield lava tongue!
    { k: 44, x: -3850, z: -2650, r: 720, a: 0.45 },                                                 // Volcanic tuff ring amphitheater!
    { k: 45, x: 3820,  z: -3850, r: 880, a: -2.4 },                                                 // Lahar mudflow debris lobe!
    { k: 48, x: -3400, z: 3350,  r: 1050, a: 0.38 },                                                // Tectonic graben rift trough!
    { k: 50, x: 3920,  z: 3650,  r: 920, a: -0.52 },                                                // Anticline folded dome!
    { k: 42, x: 4850,  z: -2450, r: 1280, a: 0.25 },                                                // Dissected ignimbrite sheet bench!
  ];
  for (let i = 0; i < valleySeeds.length; i++) {
    const s = valleySeeds[i];
    if (isSafeFromSettlements(s.x, s.z, 220, 260)) {
      pushFeature(s.k, s.x, s.z, s.r, s.a, s.extra || {});
    }
  }

  // 2. Broad 60 km × 60 km Organic Multi-Occurrence Geological Field Grid (11×11 jittered cells = 121 regions!)
  //    Each region inspects `evalGeologicalProvinces(wx, wz)` and naturally spawns the authentic
  //    landforms belonging to that geological province — so EVERY landform recurs organically in MANY places!
  const gridN = 11;
  const step = 5200;
  for (let gz = 0; gz < gridN; gz++) {
    for (let gx = 0; gx < gridN; gx++) {
      const wx = -26000 + gx * step + (rng() - 0.5) * step * 0.72;
      const wz = -26000 + gz * step + (rng() - 0.5) * step * 0.72;
      if (!isSafeFromSettlements(wx, wz, 2200, 2000)) continue;
      // Avoid overwriting main river channel center with closed craters
      const rv = evalMainRiver(wz);
      const nearRiver = Math.abs(wx - rv.x) < rv.halfWidth + 550;
      const prov = evalGeologicalProvinces(wx, wz);
      const roll = rng();
      const ang = rng() * Math.PI * 2;
      const rScale = 0.85 + rng() * 0.55;

      if (nearRiver) {
        // Floodplain & valley margin recurring processes!
        const rPick = roll < 0.35 ? 6 : (roll < 0.68 ? 25 : 26); // river_terraces, point_bar, natural_levee_backswamp
        pushFeature(rPick, wx + (wx > rv.x ? 260 : -260), wz, 620 * rScale, ang,
          rPick === 26 ? { hasBogPools: true } : {});
        continue;
      }

      // Select authentic geological genesis based on dominant local Earth province!
      if (prov.volcanic > 0.42 && roll < 0.62) {
        const sub = rng();
        if (sub < 0.12) {
          pushFeature(9, wx, wz, 1280 * rScale, ang, { rimHeight: 220 + rng() * 80, hasLake: true, lakeKind: 'caldera' });
        } else if (sub < 0.24) {
          pushFeature(40, wx, wz, 620 * rScale, ang, { hasLake: true, lakeKind: 'maar' });
        } else if (sub < 0.36) {
          pushFeature(20, wx, wz, 820 * rScale, ang, { coneHeight: 240 + rng() * 110 });
        } else if (sub < 0.47) {
          pushFeature(41, wx, wz, 560 * rScale, ang); // lava_dome_extrusion
        } else if (sub < 0.58) {
          pushFeature(8, wx, wz, 980 * rScale, ang, { mesaHeight: 115 + rng() * 55 }); // volcanic_mesa
        } else if (sub < 0.68) {
          pushFeature(42, wx, wz, 1320 * rScale, ang); // ignimbrite_sheet_bench
        } else if (sub < 0.77) {
          pushFeature(43, wx, wz, 920 * rScale, ang); // shield_lava_apron
        } else if (sub < 0.84) {
          pushFeature(44, wx, wz, 760 * rScale, ang); // tuff_ring_amphitheater
        } else if (sub < 0.90) {
          pushFeature(45, wx, wz, 960 * rScale, ang); // lahar_debris_lobe
        } else if (sub < 0.95) {
          pushFeature(4, wx, wz, 520 * rScale, ang, { cliffHeight: 42 + rng() * 24 }); // basalt_cliff
        } else {
          pushFeature(rng() < 0.5 ? 46 : 13, wx, wz, 460 * rScale, ang, { hasHotSpring: true }); // fumarole or travertine
        }
      } else if (prov.karst > 0.36 && roll < 0.68) {
        const sub = rng();
        if (sub < 0.30) {
          pushFeature(11, wx, wz, 880 * rScale, ang); // karst_doline
        } else if (sub < 0.56) {
          pushFeature(59, wx, wz, 960 * rScale, ang, { hasBogPools: true }); // karst_polje_flat_basin
        } else if (sub < 0.78) {
          pushFeature(60, wx, wz, 620 * rScale, ang); // karst_uvala_compound
        } else if (sub < 0.90) {
          pushFeature(61, wx, wz, 340 * rScale, ang, { hasWaterfall: true }); // spring_sapping_alcove
        } else {
          pushFeature(12, wx, wz, 280 * rScale, ang); // cave_grotto (natural collapse alcove)
        }
      } else if (prov.wetlandProv > 0.44 && roll < 0.55) {
        const sub = rng();
        if (sub < 0.42) {
          pushFeature(15, wx, wz, 980 * rScale, ang, { hasBogPools: true }); // peat_bog
        } else if (sub < 0.74) {
          pushFeature(62, wx, wz, 640 * rScale, ang, { hasBogPools: true }); // alpine_seepage_fen_terrace
        } else {
          pushFeature(36, wx, wz, 580 * rScale, ang, { hasLake: true, lakeKind: 'kettle' }); // kettle_hole_ponds
        }
      } else if (prov.tectonic > 0.38 && roll < 0.66) {
        const sub = rng();
        if (sub < 0.16) {
          pushFeature(47, wx, wz, 1150 * rScale, ang); // fault_scarp_step
        } else if (sub < 0.31) {
          pushFeature(48, wx, wz, 1250 * rScale, ang); // graben_rift_trough
        } else if (sub < 0.46) {
          pushFeature(49, wx, wz, 960 * rScale, ang); // hogback_strike_ridge
        } else if (sub < 0.60) {
          pushFeature(50, wx, wz, 1080 * rScale, ang); // anticline_folded_dome
        } else if (sub < 0.73) {
          pushFeature(18, wx, wz, 980 * rScale, ang); // cuesta_ridge
        } else if (sub < 0.84) {
          pushFeature(51, wx, wz, 640 * rScale, ang); // fault_line_wind_gap
        } else if (sub < 0.93) {
          pushFeature(19, wx, wz, 880 * rScale, ang); // alpine_saddle
        } else {
          pushFeature(5, wx, wz, 420 * rScale, ang); // eroded rock pass
        }
      } else {
        // Glacial foothill / erosional / mass-wasting natural mix!
        const sub = rng();
        if (sub < 0.18) {
          pushFeature(53, wx, wz, 640 * rScale, ang); // landslide_scar_hummocks
        } else if (sub < 0.34) {
          pushFeature(55, wx, wz, 760 * rScale, ang); // badlands_rilled_gullies
        } else if (sub < 0.50) {
          pushFeature(58, wx, wz, 880 * rScale, ang); // pediment_inselberg_knoll
        } else if (sub < 0.64) {
          pushFeature(7, wx, wz, 1180 * rScale, ang); // drumlin_hills
        } else if (sub < 0.78) {
          pushFeature(37, wx, wz, 720 * rScale, ang); // roche_moutonnee_knolls
        } else if (sub < 0.90) {
          pushFeature(29, wx, wz, 680 * rScale, ang); // dry_paleochannel_valley
        } else {
          pushFeature(16, wx, wz, 460 * rScale, ang); // granite_hoodoos (natural tor outcrops)
        }
      }
    }
  }

  // Record base elevation before sculpting
  for (let i = 0; i < features.length; i++) {
    features[i].preBaseY = sampleGrid(features[i].x, features[i].z);
  }
  return features;
}

// ============================================================================
// MASTER ENGINE EXECUTION: CONTINUOUS GEOMORPHOLOGICAL SYNTHESIS PASS
// ============================================================================
export function runContinuousGeologyEngine({
  heights,
  W,
  H,
  roadMaskArr,
  roadIndex,
  riverRowX,
  riverRowHW,
  riverRowWaterY,
}) {
  const N = W * H;
  const minX = TERRENO_WORLD.minX;
  const minZ = TERRENO_WORLD.minZ;
  const compX = TERRENO_WORLD.compoundCenterX;
  const compZ = TERRENO_WORLD.compoundCenterZ;
  const villX = TERRENO_WORLD.villageCenterX;
  const villZ = TERRENO_WORLD.villageCenterZ;

  // 4-Channel Geological Lithology Accumulator (0..1 per channel)
  // R: Volcanic / Basalt / Scoria / Lava Ash
  // G: Limestone / Karst / Travertine / Pumice
  // B: Ochre Clay / Badlands / Landslide Raw Earth / Sulfur Alteration
  // A: Saturated Peat / Fen / Backswamp Mud / Wet Cobble-Silt
  const lithoR = new Float32Array(N);
  const lithoG = new Float32Array(N);
  const lithoB = new Float32Array(N);
  const lithoA = new Float32Array(N);

  // Natural closed-basin water table elevation (-1e6 = dry)
  const basinWaterY = new Float32Array(N);
  basinWaterY.fill(-1e6);

  // Dominant geomorphological landform type (1..62) & strength score per cell
  const dominantKindId = new Uint8Array(N);
  const dominantScore = new Float32Array(N);

  const registerDominant = (idx, kindId, score) => {
    if (score > dominantScore[idx]) {
      dominantScore[idx] = score;
      dominantKindId[idx] = kindId;
    }
  };

  const sampleGrid = (wx, wz) => {
    const fx = ((wx - minX) / TERRENO_WORLD.width) * (W - 1);
    const fz = ((wz - minZ) / TERRENO_WORLD.depth) * (H - 1);
    const ix = Math.max(0, Math.min(W - 2, Math.floor(fx)));
    const iz = Math.max(0, Math.min(H - 2, Math.floor(fz)));
    const tx = fx - ix;
    const tz = fz - iz;
    const h00 = heights[iz * W + ix];
    const h10 = heights[iz * W + ix + 1];
    const h01 = heights[(iz + 1) * W + ix];
    const h11 = heights[(iz + 1) * W + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };

  // =========================================================================
  // PHASE A: GLOBAL CONTINUOUS FIELD OPERATORS (Across EVERY cell of 60km × 60km!)
  //   Applies continuously occurring Earth landforms directly from geology,
  //   elevation, slope, aspect, strata, and river curvature!
  //   - #52 Structural Bench Steps (horizontal alternating hard/soft strata)
  //   - #38 Solifluction Lobe Slopes (subalpine freeze-thaw creep steps)
  //   - #25 Point Bar Scroll Plains & #26 Natural Levees/Backswamps along Kurosugi River
  //   - #6  Meandering Fluvial River Terraces along Kurosugi Valley flanks
  //   - #16 Natural Weathered Granite Tor Ridges on sharp granite crests
  //   - #17 Concave Alpine Talus Aprons at cliff bases
  //   - #33 Knife-Edge Alpine Arête sharpening at high alpine crests
  // =========================================================================
  const cellX = TERRENO_WORLD.width / (W - 1);
  const cellZ = TERRENO_WORLD.depth / (H - 1);
  const inv2X = 0.5 / cellX;
  const inv2Z = 0.5 / cellZ;

  // Snapshot base heights for clean gradient & aspect readings
  const baseSnap = new Float32Array(heights);

  // Precompute smooth low-frequency geological province fields (wavelength ~11km) on a 128×128 LUT
  // for ~6× faster DEM bake with zero loss in geological fidelity!
  const PG = 128;
  const provVolc = new Float32Array(PG * PG);
  const provKarst = new Float32Array(PG * PG);
  const provTect = new Float32Array(PG * PG);
  const provGlac = new Float32Array(PG * PG);
  const provWet = new Float32Array(PG * PG);
  for (let pz = 0; pz < PG; pz++) {
    const wz = minZ + (pz / (PG - 1)) * TERRENO_WORLD.depth;
    const pRow = pz * PG;
    for (let px = 0; px < PG; px++) {
      const wx = minX + (px / (PG - 1)) * TERRENO_WORLD.width;
      const pv = evalGeologicalProvinces(wx, wz);
      provVolc[pRow + px] = pv.volcanic;
      provKarst[pRow + px] = pv.karst;
      provTect[pRow + px] = pv.tectonic;
      provGlac[pRow + px] = pv.glacialBelt;
      provWet[pRow + px] = pv.wetlandProv;
    }
  }
  const pgScaleX = (PG - 1) / (W - 1);
  const pgScaleZ = (PG - 1) / (H - 1);

  for (let iz = 1; iz < H - 1; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const row = iz * W;
    const rivX = riverRowX[iz];
    const rivHW = riverRowHW[iz];
    const rivWaterY = riverRowWaterY[iz];
    // Local river bend curvature (drives point bars inside bends & cutbanks outside!)
    const rivXm = riverRowX[Math.max(0, iz - 4)];
    const rivXp = riverRowX[Math.min(H - 1, iz + 4)];
    const rivCurv = (rivXp - 2.0 * rivX + rivXm) / (16.0 * cellZ); // signed bend!

    const gzf = iz * pgScaleZ;
    const gz0 = Math.min(PG - 2, Math.floor(gzf));
    const gtz = gzf - gz0;
    const pRow0 = gz0 * PG;
    const pRow1 = (gz0 + 1) * PG;

    for (let ix = 1; ix < W - 1; ix++) {
      const idx = row + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;

      // Protect immediate NARROW-50, Suginosato Village, NULL EREA & roads
      const dComp = Math.hypot(wx - compX, wz - compZ);
      const dVill = Math.hypot(wx - villX, wz - villZ);
      const padProt = quintic(40.0, 110.0, dComp) * quintic(52.0, 130.0, dVill);
      const nullProt = wz > 29400 && Math.abs(wx) < 350 ? 0.0 : 1.0;
      const roadProt = 1.0 - Math.min(0.94, (roadMaskArr[idx] || 0) * 1.18);
      const protect = padProt * nullProt * roadProt;
      if (protect <= 0.002) continue;

      const h0 = baseSnap[idx];
      const asl = TERRENO_WORLD.baseElevationASL + h0;
      const gx = (baseSnap[idx + 1] - baseSnap[idx - 1]) * inv2X;
      const gz = (baseSnap[idx + W] - baseSnap[idx - W]) * inv2Z;
      const slope = Math.hypot(gx, gz);

      // O(1) bilinear province lookup from 128×128 LUT!
      const gxf = ix * pgScaleX;
      const gx0 = Math.min(PG - 2, Math.floor(gxf));
      const gtx = gxf - gx0;
      const i00 = pRow0 + gx0, i10 = i00 + 1, i01 = pRow1 + gx0, i11 = i01 + 1;
      const w00 = (1.0 - gtx) * (1.0 - gtz);
      const w10 = gtx * (1.0 - gtz);
      const w01 = (1.0 - gtx) * gtz;
      const w11 = gtx * gtz;
      const pVolc = provVolc[i00] * w00 + provVolc[i10] * w10 + provVolc[i01] * w01 + provVolc[i11] * w11;
      const pKarst = provKarst[i00] * w00 + provKarst[i10] * w10 + provKarst[i01] * w01 + provKarst[i11] * w11;
      const pTect = provTect[i00] * w00 + provTect[i10] * w10 + provTect[i01] * w01 + provTect[i11] * w11;
      const pGlac = provGlac[i00] * w00 + provGlac[i10] * w10 + provGlac[i01] * w01 + provGlac[i11] * w11;
      const pWet = provWet[i00] * w00 + provWet[i10] * w10 + provWet[i01] * w01 + provWet[i11] * w11;

      // Base regional lithology undertone (subtle natural variation across the 60km watershed!)
      lithoR[idx] = Math.max(lithoR[idx], pVolc * 0.24 * smoothstep(0.18, 0.55, slope));
      lithoG[idx] = Math.max(lithoG[idx], pKarst * 0.26 * smoothstep(0.12, 0.48, slope));
      lithoA[idx] = Math.max(lithoA[idx], pWet * 0.30 * (1.0 - smoothstep(0.06, 0.22, slope)));

      let dh = 0.0;

      // 1. #52 STRUCTURAL BENCH STEPS (水平互層ベンチ): natural eroded horizontal strata on tectonic slopes!
      if (pTect > 0.35 && slope > 0.14 && slope < 0.62 && asl > 420 && asl < 1120) {
        const strataWarp = (vnoise(wx * 0.00055, wz * 0.00055) - 0.5) * 28.0;
        const bedPhase = (h0 + strataWarp) / 36.0;
        const frac = bedPhase - Math.floor(bedPhase);
        const bench = (smoothstep(0.15, 0.36, frac) - frac) * 9.5;
        const wBench = smoothstep(0.35, 0.68, pTect) * smoothstep(0.14, 0.26, slope) * (1.0 - smoothstep(0.45, 0.62, slope));
        dh += bench * wBench;
        if (wBench > 0.28) registerDominant(idx, 52, wBench * 0.65);
      }

      // 2. #38 SOLIFLUCTION LOBE SLOPES (周氷河ソリフラクション緩斜面): subalpine freeze-thaw soil creep!
      if (asl > 740 && asl < 1260 && slope > 0.07 && slope < 0.34 && pGlac > 0.25) {
        const creepWarp = vnoise(wx * 0.0022 + 5.1, wz * 0.0022 - 3.7) * 6.0;
        const lobePhase = (h0 * 0.14 + creepWarp);
        const lobe = Math.sin(lobePhase * Math.PI * 2.0) * 1.45;
        const wSol = smoothstep(740, 880, asl) * (1.0 - smoothstep(1120, 1260, asl))
          * smoothstep(0.07, 0.14, slope) * (1.0 - smoothstep(0.24, 0.34, slope))
          * smoothstep(0.25, 0.55, pGlac);
        dh += lobe * wSol;
        if (wSol > 0.22) registerDominant(idx, 38, wSol * 0.62);
      }

      // 3. #33 KNIFE-EDGE ALPINE ARÊTES (アレート痩せ尾根) + #16 NATURAL GRANITE TORS (花崗岩トア)
      if (asl > 960) {
        const lap = (baseSnap[idx - 1] + baseSnap[idx + 1] + baseSnap[idx - W] + baseSnap[idx + W]) * 0.25 - h0;
        if (lap < -1.8) {
          const ridgeStrength = clamp01((-lap - 1.8) * 0.14);
          const serrate = (ridged3(wx * 0.0028, wz * 0.0028) - 0.35) * 18.0;
          const wArete = smoothstep(960, 1180, asl) * ridgeStrength;
          dh += (serrate + ridgeStrength * 14.0) * wArete;
          if (wArete > 0.22) registerDominant(idx, 33, wArete * 0.85);
        }
      } else if (asl > 560 && slope > 0.32) {
        const lap = (baseSnap[idx - 1] + baseSnap[idx + 1] + baseSnap[idx - W] + baseSnap[idx + W]) * 0.25 - h0;
        if (lap < -2.4 && pVolc < 0.45 && pKarst < 0.45) {
          const torCrag = ridged3(wx * 0.0038 + 4.2, wz * 0.0038 - 7.1) * 11.5;
          const wTor = clamp01((-lap - 2.4) * 0.12);
          dh += torCrag * wTor;
          if (wTor > 0.25) registerDominant(idx, 16, wTor * 0.58);
        }
      }

      // 4. CONTINUOUS FLUVIAL FLOODPLAIN MORPHOLOGY ALONG ENTIRE 60km KUROSUGI RIVER!
      //    - #26 Natural Levee & Backswamp (mid/lower reaches)
      //    - #25 Point Bar Scroll Plains (inside river bends!)
      //    - #6  Meandering Organic River Terraces (valley flanks!)
      const dxRivSigned = wx - rivX;
      const dxRiv = Math.abs(dxRivSigned);
      if (dxRiv > rivHW + 14.0 && dxRiv < rivHW + 680.0) {
        const warpEdge = (vnoise(wx * 0.0011 + 8.3, wz * 0.0011 - 4.9) - 0.5) * 85.0;
        const dEff = dxRiv + warpEdge;

        // #25 Point-bar arcuate scroll ridges on the INSIDE of river bends
        const insideBend = (dxRivSigned * rivCurv) < 0 ? 1.0 : 0.0;
        const bendMag = clamp01(Math.abs(rivCurv) * 620.0);
        if (insideBend > 0.5 && bendMag > 0.15 && dEff > rivHW + 18.0 && dEff < rivHW + 260.0) {
          const scrollEnv = Math.sin(clamp01((dEff - rivHW - 18.0) / 240.0) * Math.PI);
          const scrollWave = Math.sin((dEff * 0.095) + vnoise(wx * 0.004, wz * 0.004) * 2.5) * 1.65;
          dh += scrollWave * scrollEnv * bendMag;
          lithoA[idx] = Math.max(lithoA[idx], scrollEnv * bendMag * 0.35);
          if (scrollEnv * bendMag > 0.26) registerDominant(idx, 25, scrollEnv * bendMag * 0.68);
        }

        // #26 Natural Levee (subtle raised bank crest) + Backswamp (damp trough behind levee) on broader valley floor
        if (wz > -4000 && dEff > rivHW + 22.0 && dEff < rivHW + 380.0 && slope < 0.16) {
          const leveeRidge = Math.exp(-Math.pow((dEff - (rivHW + 58.0)) / 36.0, 2.0)) * 2.4;
          const backswamp = Math.exp(-Math.pow((dEff - (rivHW + 195.0)) / 82.0, 2.0)) * -3.1;
          const wLB = smoothstep(-4000, 6000, wz) * (1.0 - smoothstep(0.08, 0.16, slope));
          dh += (leveeRidge + backswamp) * wLB;
          if (backswamp < -0.8 && wLB > 0.32) {
            lithoA[idx] = Math.max(lithoA[idx], 0.52 * wLB);
            registerDominant(idx, 26, wLB * 0.66);
          }
        }

        // #6 Organic Meandering Multi-Level Fluvial River Terraces (ZERO straight ruler steps!)
        if (dEff > rivHW + 140.0 && dEff < rivHW + 620.0 && slope < 0.38) {
          const tNorm = clamp01((dEff - (rivHW + 140.0)) / 460.0);
          const gullyBreak = 0.65 + 0.35 * vnoise(wx * 0.0025, wz * 0.0025);
          const steps = (smoothstep(0.14, 0.28, tNorm) * 11.0 + smoothstep(0.52, 0.66, tNorm) * 14.0) * gullyBreak;
          const tEnv = Math.sin(tNorm * Math.PI) * smoothstep(0.28, 0.72, vnoise(wz * 0.00028 + 3.1, dxRivSigned > 0 ? 1.7 : -2.3));
          dh += steps * tEnv * 0.55;
          if (tEnv > 0.35) registerDominant(idx, 6, tEnv * 0.56);
        }
      }

      if (dh !== 0.0) {
        heights[idx] += dh * protect;
      }
    }
  }

  // =========================================================================
  // PHASE B: MULTI-OCCURRENCE GEOLOGICAL OPERATORS (All Discrete/Regional Suites!)
  //   Every single feature is domain-warped by multi-octave noise -> ZERO geometric circles,
  //   ZERO grids, ZERO bicycle spokes, ZERO ruler stairs!
  // =========================================================================
  const features = generateMultiOccurrenceGeologyFeatures(sampleGrid, roadIndex);
  const emergentWaterBasins = [];
  const emergentVaporSites = [];

  for (let fi = 0; fi < features.length; fi++) {
    const f = features[fi];
    const R = f.radius * 1.32;
    const ix0 = Math.max(2, Math.floor(((f.x - R - minX) / TERRENO_WORLD.width) * (W - 1)));
    const ix1 = Math.min(W - 3, Math.ceil(((f.x + R - minX) / TERRENO_WORLD.width) * (W - 1)));
    const iz0 = Math.max(2, Math.floor(((f.z - R - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const iz1 = Math.min(H - 3, Math.ceil(((f.z + R - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const cosA = Math.cos(f.angle || 0);
    const sinA = Math.sin(f.angle || 0);
    const seedOff = (f.seed % 997) * 0.17;

    // Pre-compute natural rim elevation for closed water-holding basins so water sits STRICTLY
    // below the real eroded rim (GUARANTEED 100% organic terrain-clipped shoreline!)
    let basinTargetWaterY = -1e6;
    if (f.hasLake || f.hasBogPools) {
      let minRimY = Infinity;
      let sumRimY = 0;
      const rimSamples = 16;
      const rimR = f.kind === 'caldera_lake' ? f.radius * 0.52
        : (f.kind === 'maar_crater_lake' ? f.radius * 0.58
          : (f.kind === 'oxbow_cutoff_lake' ? f.radius * 0.65
            : (f.kind === 'landslide_dammed_lake' ? f.radius * 0.50
              : f.radius * 0.48)));
      for (let s = 0; s < rimSamples; s++) {
        const a = (s / rimSamples) * Math.PI * 2;
        const sy = sampleGrid(f.x + Math.cos(a) * rimR, f.z + Math.sin(a) * rimR);
        if (sy < minRimY) minRimY = sy;
        sumRimY += sy;
      }
      const meanRimY = sumRimY / rimSamples;
      if (f.kind === 'caldera_lake') {
        basinTargetWaterY = meanRimY + 12.0; // rim gets raised +220m, center carved -65m below meanRimY
      } else if (f.kind === 'glacial_cirque') {
        basinTargetWaterY = minRimY - 6.0;
      } else if (f.kind === 'maar_crater_lake') {
        basinTargetWaterY = minRimY - 8.5;
      } else if (f.kind === 'oxbow_cutoff_lake') {
        basinTargetWaterY = (f.riverWaterY !== undefined ? f.riverWaterY + 0.6 : minRimY - 3.2);
      } else if (f.kind === 'landslide_dammed_lake') {
        basinTargetWaterY = minRimY - 4.5;
      } else if (f.kind === 'kettle_hole_ponds') {
        basinTargetWaterY = minRimY - 4.2;
      } else if (f.kind === 'peat_bog' || f.kind === 'karst_polje_flat_basin' || f.kind === 'alpine_seepage_fen_terrace') {
        basinTargetWaterY = minRimY - 3.4;
      }
    }

    let waterCellCount = 0;
    let waterMinX = Infinity, waterMaxX = -Infinity, waterMinZ = Infinity, waterMaxZ = -Infinity;

    for (let iz = iz0; iz <= iz1; iz++) {
      const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
      const dz = wz - f.z;
      const row = iz * W;
      for (let ix = ix0; ix <= ix1; ix++) {
        const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
        const dx = wx - f.x;
        const dist = Math.hypot(dx, dz);
        if (dist > R) continue;

        const dComp = Math.hypot(wx - compX, wz - compZ);
        const dVill = Math.hypot(wx - villX, wz - villZ);
        const padProt = quintic(40.0, 105.0, dComp) * quintic(52.0, 125.0, dVill);
        const idx = row + ix;
        const roadProt = 1.0 - Math.min(0.95, (roadMaskArr[idx] || 0) * 1.18);
        const nullProt = wz > 29400 && Math.abs(wx) < 380 ? 0.0 : 1.0;
        const protect = padProt * roadProt * nullProt;
        if (protect <= 0.002) continue;

        // Organic Multi-Octave Domain Warp + natural axial elongation -> ZERO geometric circularity!
        const wFreq = 2.4 / Math.max(140.0, f.radius);
        const warpA = (fbm3(wx * wFreq + seedOff, wz * wFreq - seedOff) - 0.5) * f.radius * 0.44;
        const warpB = (fbm3(wx * wFreq - seedOff * 1.4, wz * wFreq + seedOff * 1.1) - 0.5) * f.radius * 0.44;
        const rawLx = dx * cosA + dz * sinA;
        const rawLz = -dx * sinA + dz * cosA;
        const axisRatio = 0.84 + ((f.seed % 37) / 37.0) * 0.34;
        const lx = rawLx + warpA;
        const lz = rawLz * axisRatio + warpB;
        const wDist = Math.hypot(lx, lz);
        const u = wDist / f.radius;
        const falloff = 1.0 - quintic(0.50, 1.18, dist / f.radius);
        if (falloff <= 0.001) continue;

        let dh = 0.0;
        let domWeight = 0.0;
        let setWater = false;
        let localWaterY = basinTargetWaterY;

        switch (f.kindIndex) {
          // --- #1 WATERFALL MULTITIER CLIFF (Pure heightfield stepped wet granite headwall + recessed pool!) ---
          case 1: {
            const backWall = smoothstep(14.0, -48.0, lx) * (1.0 - quintic(0.38, 1.02, Math.abs(lz) / (f.radius * 0.85)));
            const microCrag = 0.82 + 0.36 * ridged3(wx * 0.015, wz * 0.015);
            const stepProf = backWall * 0.72 + (smoothstep(0.24, 0.36, backWall) + smoothstep(0.58, 0.70, backWall)) * 0.14;
            const bowl = (1.0 - smoothstep(0.0, f.radius * 0.34, Math.hypot(lx - f.radius * 0.22, lz))) * -7.5;
            dh = (stepProf * (f.cliffHeight || 34) * microCrag + bowl) * falloff;
            lithoA[idx] = Math.max(lithoA[idx], (backWall * 0.55 + Math.max(0, -bowl * 0.12)) * falloff);
            domWeight = Math.max(backWall, Math.max(0, -bowl * 0.14)) * falloff;
            break;
          }
          // --- #2 WATERFALL VEIL AMPHITHEATER CLIFF ---
          case 2: {
            const backWall = smoothstep(10.0, -42.0, lx) * (1.0 - quintic(0.38, 0.98, Math.abs(lz) / (f.radius * 0.84)));
            const bowl = (1.0 - smoothstep(0.0, f.radius * 0.32, Math.hypot(lx - f.radius * 0.18, lz))) * -5.2;
            dh = (backWall * (f.cliffHeight || 24) + bowl) * falloff;
            lithoA[idx] = Math.max(lithoA[idx], backWall * 0.65 * falloff);
            domWeight = backWall * falloff;
            break;
          }
          // --- #3 V-SHAPED RIVER GORGE ---
          case 3: {
            const rv = evalMainRiver(wz);
            const dRiv = Math.abs(wx - rv.x);
            const span = 1.0 - quintic(0.25, 1.0, Math.abs(dz) / f.radius);
            const wallBand = smoothstep(rv.halfWidth + 16.0, rv.halfWidth + 145.0, dRiv)
              * (1.0 - smoothstep(rv.halfWidth + 240.0, rv.halfWidth + 540.0, dRiv));
            const crag = 0.74 + 0.52 * ridged3(wx * 0.008, wz * 0.008);
            dh = wallBand * span * 88.0 * crag;
            domWeight = wallBand * span;
            break;
          }
          // --- #4 BASALT ESCARPMENT CLIFF (Pure volcanic rock cliff, ZERO CylinderGeometry!) ---
          case 4: {
            const scarp = smoothstep(22.0, -34.0, lx);
            const wMask = 1.0 - quintic(0.48, 1.02, Math.abs(lz) / f.radius);
            const vertRib = 0.85 + 0.30 * ridged3(wx * 0.018, wz * 0.018);
            dh = scarp * wMask * (f.cliffHeight || 44) * vertRib * falloff;
            lithoR[idx] = Math.max(lithoR[idx], scarp * wMask * 0.88 * falloff);
            domWeight = scarp * wMask * falloff;
            break;
          }
          // --- #5 ERODED ROCK PASS / WIND RIDGE (Replaces artificial tube arch with 100% real rock pass!) ---
          case 5: {
            const lat = Math.abs(lz);
            const twinSpurs = Math.exp(-Math.pow((lat - f.radius * 0.34) / (f.radius * 0.24), 2.0) - Math.pow(lx / (f.radius * 0.32), 2.0));
            const notch = Math.exp(-Math.pow(lat / (f.radius * 0.18), 2.0) - Math.pow(lx / (f.radius * 0.36), 2.0));
            dh = (twinSpurs * 34.0 * (0.8 + 0.4 * ridged3(wx * 0.014, wz * 0.014)) - notch * 6.5) * falloff;
            domWeight = Math.max(twinSpurs, notch) * falloff;
            break;
          }
          // --- #6 RIVER TERRACES (Organic curved multi-bench fluvial terraces) ---
          case 6: {
            const ramp = clamp01((lx + f.radius * 0.72) / (f.radius * 1.44));
            const gullyCut = 0.72 + 0.28 * fbm3(wx * 0.003, wz * 0.003);
            const steps = (smoothstep(0.16, 0.27, ramp) * 14.0 + smoothstep(0.46, 0.58, ramp) * 18.0 + smoothstep(0.75, 0.86, ramp) * 20.0) * gullyCut;
            const lat = 1.0 - quintic(0.50, 1.02, Math.abs(lz) / f.radius);
            dh = steps * lat * falloff;
            domWeight = lat * falloff * 0.85;
            break;
          }
          // --- #7 DRUMLIN HILLS (Domain-warped asymmetric streamlined glacial hills — ZERO sin*cos grid!) ---
          case 7: {
            const sx = lx * 0.0026 + seedOff;
            const sz = lz * 0.0054 - seedOff;
            const dNoise = fbm3(sx, sz);
            const dRidge = ridged3(sx * 0.9 + 4.1, sz * 1.15 - 2.3);
            const mound = Math.pow(clamp01((dNoise * 0.55 + dRidge * 0.45 - 0.24) * 1.45), 1.65);
            dh = mound * 62.0 * falloff;
            domWeight = mound * falloff;
            break;
          }
          // --- #8 VOLCANIC MESA (Deeply embayed flat-topped lava tableland) ---
          case 8: {
            const plateau = 1.0 - smoothstep(0.54, 0.82, u);
            const rimBand = smoothstep(0.48, 0.72, u) * (1.0 - smoothstep(0.76, 0.96, u));
            const capTex = (fbm3(wx * 0.0035, wz * 0.0035) - 0.5) * 6.5;
            dh = plateau * ((f.mesaHeight || 128) + capTex) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], (rimBand * 0.85 + plateau * 0.45) * falloff);
            domWeight = Math.max(plateau, rimBand) * falloff;
            break;
          }
          // --- #9 VOLCANIC CALDERA & CRATER LAKE (Organic breached crater + recessed terrain-clipped lake!) ---
          case 9: {
            const rimRing = Math.exp(-Math.pow((u - 0.58) / 0.17, 2.0)) * (f.rimHeight || 235) * (0.78 + 0.44 * ridged3(wx * 0.0018, wz * 0.0018));
            const innerFloor = (1.0 - smoothstep(0.0, 0.46, u)) * -78.0;
            const centralDome = Math.exp(-Math.pow(u / 0.10, 2.0)) * 58.0;
            dh = (rimRing + innerFloor + centralDome) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], smoothstep(0.28, 0.72, u) * 0.78 * falloff);
            domWeight = falloff;
            if (u < 0.48) setWater = true;
            break;
          }
          // --- #10 GLACIAL CIRQUE & ALPINE TARN LAKE ---
          case 10: {
            const backArc = smoothstep(0.22, -0.42, lx / f.radius);
            const headwall = backArc * Math.exp(-Math.pow((u - 0.64) / 0.22, 2.0)) * 165.0 * (0.8 + 0.4 * ridged3(wx * 0.003, wz * 0.003));
            const tarnBowl = (1.0 - smoothstep(0.0, 0.44, Math.hypot(lx - f.radius * 0.08, lz) / f.radius)) * -42.0;
            const moraine = smoothstep(0.18, 0.56, lx / f.radius) * Math.exp(-Math.pow((u - 0.56) / 0.15, 2.0)) * 26.0;
            dh = (headwall + tarnBowl + moraine) * falloff;
            domWeight = falloff;
            if (tarnBowl < -4.0) setWater = true;
            break;
          }
          // --- #11 KARST DOLINE SINKHOLE FIELD (Domain-warped irregular compound limestone hollows!) ---
          case 11: {
            const table = (1.0 - smoothstep(0.55, 0.98, u)) * 36.0;
            const kCell = vnoise(lx * 0.0048 + seedOff, lz * 0.0048 - seedOff);
            const pit = Math.pow(clamp01((0.44 - kCell) / 0.44), 1.85) * -32.0;
            dh = (table + pit) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], (0.55 + clamp01(-pit * 0.03) * 0.40) * falloff);
            domWeight = falloff * 0.9;
            break;
          }
          // --- #12 COLLAPSED KARST HOLLOW / GROTTO ALCOVE (Pure heightfield overhang recess, ZERO fake cones!) ---
          case 12: {
            const cliff = smoothstep(18.0, -45.0, lx) * (1.0 - quintic(0.40, 0.96, Math.abs(lz) / (f.radius * 0.85)));
            const sink = (1.0 - smoothstep(0.0, f.radius * 0.42, Math.hypot(lx - 14, lz))) * -14.0;
            dh = (cliff * 32.0 + sink) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.72 * falloff);
            lithoA[idx] = Math.max(lithoA[idx], clamp01(-sink * 0.08) * 0.55 * falloff);
            domWeight = Math.max(cliff, clamp01(-sink * 0.1)) * falloff;
            break;
          }
          // --- #13 NATURAL GEOTHERMAL TRAVERTINE SEEPAGE SLOPE (ZERO circular cylinders/toruses!) ---
          case 13: {
            const ramp = clamp01((lx + f.radius * 0.65) / (f.radius * 1.30));
            // Contour-warped sinuous organic mineral sinter ledges
            const sinterWave = Math.sin(ramp * Math.PI * 10.0 + fbm3(wx * 0.015, wz * 0.015) * 4.5) * 1.9;
            const lat = 1.0 - quintic(0.38, 0.94, Math.abs(lz) / (f.radius * 0.75));
            dh = (ramp * 14.0 + sinterWave) * lat * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.85 * lat * falloff);
            lithoA[idx] = Math.max(lithoA[idx], 0.45 * lat * falloff);
            domWeight = lat * falloff;
            break;
          }
          // --- #14 BRAIDED ALLUVIAL FAN (Noise-braided gravel cone — ZERO bicycle spokes!) ---
          case 14: {
            const cone = Math.max(0.0, 1.0 - u) * 34.0 * smoothstep(-f.radius * 0.35, f.radius * 0.35, lx);
            const braid = (ridged3(lx * 0.0042 + seedOff, lz * 0.0085 - seedOff) - 0.42) * 5.5 * (1.0 - u);
            dh = (cone + braid) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.32 * (1.0 - u) * falloff);
            domWeight = (1.0 - u) * falloff;
            break;
          }
          // --- #15 HIGHLAND PEAT BOG & IRREGULAR BOG POOLS (ZERO boardwalk, ZERO floating circles!) ---
          case 15: {
            const bogFlat = (1.0 - smoothstep(0.32, 0.88, u)) * falloff;
            const poolNoise = fbm3(wx * 0.0042 + seedOff, wz * 0.0042 - seedOff);
            const microBasin = smoothstep(0.50, 0.28, poolNoise) * -5.2;
            const targetH = basinTargetWaterY + 2.2 + microBasin;
            heights[idx] = heights[idx] * (1.0 - bogFlat * protect * 0.80) + targetH * (bogFlat * protect * 0.80);
            lithoA[idx] = Math.max(lithoA[idx], bogFlat * 0.88);
            domWeight = bogFlat;
            if (bogFlat > 0.32 && microBasin < -1.8) setWater = true;
            break;
          }
          // --- #16 GRANITE TOR OUTCROP DOME ---
          case 16: {
            const dome = (1.0 - smoothstep(0.15, 0.94, u)) * 38.0 * (0.65 + 0.70 * ridged3(wx * 0.008, wz * 0.008));
            dh = dome * falloff;
            domWeight = falloff * 0.9;
            break;
          }
          // --- #17 GRANITE TALUS SCREE CHUTE ---
          case 17: {
            const head = smoothstep(f.radius * 0.12, -f.radius * 0.45, lx) * 82.0;
            const chute = Math.exp(-Math.pow(lz / (f.radius * 0.28 + Math.max(0, lx) * 0.38), 2.0));
            const scree = (fbm3(wx * 0.018, wz * 0.018) - 0.5) * 6.0;
            dh = (head + scree) * chute * falloff;
            lithoG[idx] = Math.max(lithoG[idx], chute * 0.42 * falloff);
            domWeight = chute * falloff;
            break;
          }
          // --- #18 CUESTA ASYMMETRIC FAULT-SCARP RIDGE ---
          case 18: {
            const wMask = 1.0 - quintic(0.45, 1.0, Math.abs(lz) / f.radius);
            const prof = lx < 0 ? smoothstep(-f.radius * 0.28, -f.radius * 0.03, lx) : Math.max(0.0, 1.0 - lx / (f.radius * 0.92));
            dh = prof * wMask * 118.0 * (0.85 + 0.30 * fbm3(wx * 0.004, wz * 0.004)) * falloff;
            domWeight = prof * wMask * falloff;
            break;
          }
          // --- #19 ALPINE SADDLE / COL PASS ---
          case 19: {
            const pL = Math.exp(-Math.pow((lz - f.radius * 0.46) / (f.radius * 0.28), 2.0) - Math.pow(lx / (f.radius * 0.35), 2.0));
            const pR = Math.exp(-Math.pow((lz + f.radius * 0.46) / (f.radius * 0.28), 2.0) - Math.pow(lx / (f.radius * 0.35), 2.0));
            const col = Math.exp(-Math.pow(lz / (f.radius * 0.56), 2.0) - Math.pow(lx / (f.radius * 0.26), 2.0)) * 0.42;
            dh = ((pL + pR) * 145.0 + col * 92.0) * falloff;
            domWeight = Math.max(pL + pR, col) * falloff;
            break;
          }
          // --- #20 BREACHED VOLCANIC SCORIA CONE ---
          case 20: {
            const cone = Math.max(0.0, 1.0 - u / 0.88) * (f.coneHeight || 265);
            const crater = (1.0 - smoothstep(0.0, 0.24, u)) * -74.0;
            const breach = smoothstep(0.0, 0.48, lx / f.radius) * Math.exp(-Math.pow(lz / (f.radius * 0.14), 2.0)) * -44.0 * Math.max(0, 1.0 - u);
            dh = (cone + crater + breach) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], Math.max(0, 1.0 - u * 0.9) * 0.92 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #21 BRAIDED RIVER COBBLE ISLAND ---
          case 21: {
            const isl = Math.exp(-Math.pow(lx / 22.0, 2.0) - Math.pow(lz / (f.radius * 0.52), 2.0));
            dh = isl * 3.8;
            lithoA[idx] = Math.max(lithoA[idx], isl * 0.65);
            domWeight = isl;
            break;
          }
          // --- #22 MOSSY STEPPED CASCADE RAVINE ---
          case 22: {
            const along = clamp01((lx + f.radius * 0.65) / (f.radius * 1.30));
            const lat = 1.0 - quintic(0.32, 0.92, Math.abs(lz) / (f.radius * 0.62));
            const steps = (smoothstep(0.14, 0.22, along) + smoothstep(0.36, 0.44, along) + smoothstep(0.58, 0.66, along) + smoothstep(0.80, 0.88, along)) * 4.5;
            const chCut = Math.exp(-Math.pow(lz / (f.radius * 0.14), 2.0)) * -4.2;
            dh = (steps * lat + chCut) * falloff;
            lithoA[idx] = Math.max(lithoA[idx], lat * 0.62 * falloff);
            domWeight = lat * falloff;
            break;
          }

          // ===================================================================
          // 40 BRAND-NEW ULTRA-NATURAL GEOMORPHOLOGICAL PROCESSES (#23 .. #62)
          // ===================================================================

          // --- #23 OXBOW CUTOFF LAKE (三日月湖・旧河道湿地) ---
          case 23: {
            // Horseshoe crescent channel carved organically into floodplain
            const rArc = Math.hypot(lx, lz) / (f.radius * 0.56);
            const theta = Math.atan2(lz, lx);
            const arcAngleMask = smoothstep(-2.4, -1.75, theta) * (1.0 - smoothstep(1.75, 2.4, theta));
            const chBand = Math.exp(-Math.pow((rArc - 1.0) / 0.24, 2.0)) * arcAngleMask;
            const innerBar = Math.exp(-Math.pow(rArc / 0.52, 2.0)) * 2.4;
            const oxTarget = basinTargetWaterY - 4.8 * chBand + 2.8 * (1.0 - chBand) + innerBar;
            const blend = clamp01((chBand * 0.92 + (1.0 - smoothstep(0.4, 1.0, u)) * 0.45) * falloff);
            heights[idx] = heights[idx] * (1.0 - blend * protect) + oxTarget * (blend * protect);
            lithoA[idx] = Math.max(lithoA[idx], (chBand * 0.85 + innerBar * 0.15) * falloff);
            domWeight = Math.max(chBand, blend * 0.7);
            if (chBand > 0.22) setWater = true;
            break;
          }
          // --- #24 INCISED MEANDER GORGE (穿入蛇行渓谷) ---
          case 24: {
            const sCurve = Math.sin(lx * (Math.PI * 2.4 / f.radius)) * f.radius * 0.22;
            const dCh = lz - sCurve;
            const absCh = Math.abs(dCh);
            // Asymmetric undercut outer cliff vs gentle slip-off inner spur!
            const outerSide = (dCh * Math.cos(lx * (Math.PI * 2.4 / f.radius))) > 0 ? 1.0 : 0.0;
            const canyonCut = (1.0 - smoothstep(f.radius * 0.08, f.radius * (outerSide > 0.5 ? 0.24 : 0.42), absCh)) * -64.0;
            const rimLift = smoothstep(f.radius * 0.16, f.radius * 0.36, absCh) * (1.0 - smoothstep(f.radius * 0.48, f.radius * 0.86, absCh)) * 48.0;
            dh = (canyonCut + rimLift) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #25 POINT BAR SCROLL PLAIN (曲流州原) ---
          case 25: {
            const env = (1.0 - smoothstep(0.35, 0.95, u)) * falloff;
            const bars = Math.sin(u * 26.0 + fbm3(wx * 0.004, wz * 0.004) * 3.2) * 2.8;
            dh = bars * env;
            lithoA[idx] = Math.max(lithoA[idx], env * 0.48);
            domWeight = env;
            break;
          }
          // --- #26 NATURAL LEVEE & BACKSWAMP (自然堤防と後背湿地) ---
          case 26: {
            const levee = Math.exp(-Math.pow((lx + f.radius * 0.35) / (f.radius * 0.16), 2.0)) * 5.2;
            const swamp = Math.exp(-Math.pow((lx - f.radius * 0.18) / (f.radius * 0.36), 2.0)) * -5.8;
            const lat = 1.0 - quintic(0.45, 0.98, Math.abs(lz) / f.radius);
            dh = (levee + swamp) * lat * falloff;
            lithoA[idx] = Math.max(lithoA[idx], clamp01(-swamp * 0.15) * lat * falloff);
            domWeight = lat * falloff;
            if (swamp < -2.2 && lat > 0.4) setWater = true;
            break;
          }
          // --- #27 KNICKPOINT ROCK RAPIDS (遷急点・早瀬岩床渓谷) ---
          case 27: {
            const step = smoothstep(f.radius * 0.22, -f.radius * 0.25, lx) * (f.cliffHeight || 32);
            const ch = Math.exp(-Math.pow(lz / (f.radius * 0.22), 2.0));
            const ledges = Math.sin(lx * 0.08 + ridged3(wx * 0.02, wz * 0.02) * 3.0) * 2.8 * ch;
            dh = (step * (1.0 - ch * 0.28) + ledges - ch * 8.5) * falloff;
            lithoA[idx] = Math.max(lithoA[idx], ch * 0.65 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #28 HANGING TRIBUTARY VALLEY (懸谷・ハンギングバレー) ---
          case 28: {
            const troughWall = smoothstep(f.radius * 0.18, f.radius * 0.56, Math.abs(lz)) * 68.0;
            const hangingStep = smoothstep(f.radius * 0.12, -f.radius * 0.28, lx) * 54.0;
            const troughFloor = (1.0 - smoothstep(0.0, f.radius * 0.32, Math.abs(lz))) * -18.0;
            dh = (troughWall * smoothstep(f.radius * 0.35, -f.radius * 0.2, lx) + hangingStep + troughFloor) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #29 DRY PALEOCHANNEL VALLEY (枯れ川・旧流路窪地) ---
          case 29: {
            const meander = Math.sin(lx * (Math.PI * 2.8 / f.radius) + seedOff) * f.radius * 0.20;
            const dCh = Math.abs(lz - meander);
            const trench = (1.0 - smoothstep(f.radius * 0.04, f.radius * 0.16, dCh)) * -14.5;
            const bank = smoothstep(f.radius * 0.12, f.radius * 0.24, dCh) * (1.0 - smoothstep(f.radius * 0.28, f.radius * 0.45, dCh)) * 4.5;
            dh = (trench + bank) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], clamp01(-trench * 0.05) * 0.48 * falloff);
            domWeight = clamp01(-trench * 0.08 + bank * 0.1) * falloff;
            break;
          }
          // --- #30 COMPOUND BAJADA APRON (バハダ複合扇状地) ---
          case 30: {
            // 3 coalescing adjacent gravel fans sweeping down from mountain mouths
            let fanH = 0;
            for (let b = -1; b <= 1; b++) {
              const dFan = Math.hypot(lx + f.radius * 0.28, lz - b * f.radius * 0.38);
              fanH = Math.max(fanH, Math.max(0.0, 1.0 - dFan / (f.radius * 0.72)) * 34.0);
            }
            const rill = (ridged3(wx * 0.005, wz * 0.005) - 0.4) * 3.8;
            dh = (fanH + rill) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.36 * falloff);
            domWeight = falloff * 0.88;
            break;
          }
          // --- #31 INTERLOCKING VALLEY SPURS (噛み合い尾根渓谷) ---
          case 31: {
            const zig = Math.sin(lx * (Math.PI * 3.5 / f.radius) + seedOff) * f.radius * 0.18;
            const dValley = Math.abs(lz - zig);
            const vCut = (1.0 - smoothstep(f.radius * 0.05, f.radius * 0.28, dValley)) * -44.0;
            const spurL = Math.max(0, Math.sin(lx * (Math.PI * 3.5 / f.radius) + seedOff)) * smoothstep(f.radius * 0.10, f.radius * 0.45, lz - zig);
            const spurR = Math.max(0, -Math.sin(lx * (Math.PI * 3.5 / f.radius) + seedOff)) * smoothstep(f.radius * 0.10, f.radius * 0.45, zig - lz);
            dh = (vCut + (spurL + spurR) * 58.0) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #32 GLACIAL U-SHAPED TROUGH (U字谷・氷食谷) ---
          case 32: {
            const zNorm = Math.abs(lz) / (f.radius * 0.46);
            // Classic parabolic U-valley profile (y ~ z^2.4) with truncated steep flanks!
            const uBowl = zNorm < 1.0 ? (Math.pow(zNorm, 2.4) - 1.0) * 76.0 : 0.0;
            const wallLip = smoothstep(0.75, 1.12, zNorm) * (1.0 - smoothstep(1.25, 1.85, zNorm)) * 52.0;
            dh = (uBowl + wallLip) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #33 KNIFE-EDGE ALPINE ARÊTE (アレート痩せ尾根) ---
          case 33: {
            const spine = Math.exp(-Math.pow(lz / (f.radius * 0.16), 2.0)) * (1.0 - quintic(0.45, 0.98, Math.abs(lx) / f.radius));
            const serration = 0.72 + 0.56 * ridged3(wx * 0.0045, wz * 0.0045);
            const flankCarve = smoothstep(f.radius * 0.12, f.radius * 0.42, Math.abs(lz)) * (1.0 - smoothstep(f.radius * 0.55, f.radius * 0.95, Math.abs(lz))) * -38.0;
            dh = (spine * 115.0 * serration + flankCarve) * falloff;
            domWeight = Math.max(spine, falloff * 0.7);
            break;
          }
          // --- #34 GLACIAL HORN PEAK (ホルン氷食尖峰) ---
          case 34: {
            const ang = Math.atan2(lz, lx);
            // 3 converging concave glacial faces meeting in 3 sharp pyramidal ridges!
            const triRidge = Math.pow(0.5 + 0.5 * Math.cos(ang * 3.0 + seedOff), 1.8);
            const spire = Math.pow(Math.max(0.0, 1.0 - u), 1.45) * (135.0 + triRidge * 95.0);
            const couloir = (1.0 - triRidge) * smoothstep(0.15, 0.55, u) * (1.0 - smoothstep(0.65, 0.95, u)) * -42.0;
            dh = (spire + couloir) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #35 LATERAL MORAINE RIDGE (側堆石堤・ラテラルモレーン) ---
          case 35: {
            const ridge = Math.exp(-Math.pow(lz / (f.radius * 0.14), 2.0)) * (1.0 - quintic(0.50, 0.98, Math.abs(lx) / f.radius));
            const tillVar = 0.80 + 0.40 * fbm3(wx * 0.005, wz * 0.005);
            dh = ridge * 38.0 * tillVar * falloff;
            lithoG[idx] = Math.max(lithoG[idx], ridge * 0.35 * falloff);
            domWeight = ridge * falloff;
            break;
          }
          // --- #36 KETTLE HOLE PONDS (ケトルホール群・氷塊融解小沼) ---
          case 36: {
            const outwash = (1.0 - smoothstep(0.45, 0.95, u)) * falloff;
            const kField = fbm3(wx * 0.0055 + seedOff, wz * 0.0055 - seedOff);
            const hummock = (fbm3(wx * 0.0085 - seedOff, wz * 0.0085 + seedOff) - 0.5) * 14.0;
            const kettlePit = smoothstep(0.44, 0.24, kField) * -19.0;
            dh = (hummock + kettlePit) * outwash;
            lithoA[idx] = Math.max(lithoA[idx], smoothstep(0.48, 0.26, kField) * 0.72 * outwash);
            domWeight = outwash;
            if (kettlePit < -6.5 && outwash > 0.35) setWater = true;
            break;
          }
          // --- #37 ROCHE MOUTONNÉE KNOLLS (羊背岩丘群・ロッシュムトネ) ---
          case 37: {
            // Ice-flow-aligned asymmetric bedrock humps: gentle smooth upstream ramp, plucked steep downstream cliff!
            const phaseX = lx * 0.0065 + seedOff;
            const phaseZ = lz * 0.0075 - seedOff;
            const cellX0 = phaseX - Math.floor(phaseX);
            // Asymmetric sawtooth-smooth profile (smooth ramp 0..0.72, steep plucked face 0.72..1.0)
            const asym = cellX0 < 0.72 ? smoothstep(0.0, 0.72, cellX0) : (1.0 - smoothstep(0.72, 0.98, cellX0));
            const latBlob = smoothstep(0.32, 0.78, vnoise(phaseX * 0.65, phaseZ));
            dh = asym * latBlob * 36.0 * falloff;
            domWeight = asym * latBlob * falloff;
            break;
          }
          // --- #39 NIVATION SNOW HOLLOW (雪食凹地・雪渓カール) ---
          case 39: {
            const bowl = Math.exp(-Math.pow(u / 0.58, 2.0)) * -26.0;
            const backRim = smoothstep(0.15, -0.45, lx / f.radius) * Math.exp(-Math.pow((u - 0.62) / 0.22, 2.0)) * 34.0;
            dh = (bowl + backRim) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #40 MAAR EXPLOSION CRATER LAKE (マール爆発火口湖) ---
          case 40: {
            // Broad flat tephra rampart surrounding deep phreatomagmatic crater lake!
            const rimRing = Math.exp(-Math.pow((u - 0.64) / 0.18, 2.0)) * 32.0 * (0.82 + 0.36 * fbm3(wx * 0.004, wz * 0.004));
            const pit = (1.0 - smoothstep(0.36, 0.58, u)) * -44.0;
            dh = (rimRing + pit) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], smoothstep(0.30, 0.85, u) * 0.68 * falloff);
            domWeight = falloff;
            if (u < 0.52) setWater = true;
            break;
          }
          // --- #41 VISCOUS LAVA DOME EXTRUSION (溶岩ドーム・鐘状火山丘) ---
          case 41: {
            // Steep-walled bell dome + rugged spine carapace + basal talus collar
            const bell = Math.pow(Math.max(0.0, 1.0 - Math.pow(u / 0.68, 2.4)), 0.72) * 145.0;
            const carapace = ridged3(wx * 0.0085 + seedOff, wz * 0.0085) * 18.0 * smoothstep(0.65, 0.15, u);
            const talus = smoothstep(0.45, 0.72, u) * (1.0 - smoothstep(0.75, 1.0, u)) * 28.0;
            dh = (bell + carapace + talus) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], (1.0 - smoothstep(0.60, 0.98, u)) * 0.82 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #42 IGNIMBRITE PYROCLASTIC SHEET BENCH (火砕流台地・開析シラス台地) ---
          case 42: {
            // Broad tilted flat volcanic ash tableland deeply dissected by sharp dendritic erosion valleys!
            const sheet = (1.0 - smoothstep(0.68, 0.98, u)) * (68.0 - lx * 0.022);
            const gullyNet = Math.pow(clamp01(1.0 - ridged3(wx * 0.0032 + seedOff, wz * 0.0032 - seedOff)), 2.2);
            const deepCut = smoothstep(0.28, 0.72, gullyNet) * -46.0;
            dh = (sheet + deepCut) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.64 * falloff); // Pale Shirasu volcanic pumice-tuff!
            domWeight = falloff;
            break;
          }
          // --- #43 BASALT SHIELD LAVA TONGUE (玄武岩溶岩流舌・溶岩原) ---
          case 43: {
            const along = clamp01((lx + f.radius * 0.75) / (f.radius * 1.50));
            const width = f.radius * (0.22 + 0.16 * Math.sin(along * Math.PI));
            const latNorm = Math.abs(lz) / width;
            const lobe = (1.0 - smoothstep(0.65, 1.02, latNorm)) * (1.0 - smoothstep(0.84, 1.0, along)) * smoothstep(0.0, 0.12, along);
            const pressureRidges = Math.sin(along * 42.0 - latNorm * 4.0) * 2.4;
            const sideLevee = smoothstep(0.60, 0.84, latNorm) * (1.0 - smoothstep(0.86, 1.04, latNorm)) * 5.5;
            dh = (lobe * (16.0 + pressureRidges) + sideLevee * smoothstep(0.05, 0.2, along) * (1.0 - smoothstep(0.85, 1.0, along))) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], Math.max(lobe, sideLevee * 0.18) * 0.95 * falloff);
            domWeight = Math.max(lobe, sideLevee * 0.2) * falloff;
            break;
          }
          // --- #44 TUFF RING AMPHITHEATER (タフリング凝灰岩火口輪) ---
          case 44: {
            // Wind-asymmetric shallow wide tephra ring
            const windAsym = 0.65 + 0.55 * smoothstep(-0.6, 0.6, lx / f.radius);
            const ring = Math.exp(-Math.pow((u - 0.62) / 0.19, 2.0)) * 58.0 * windAsym;
            const radialGully = (ridged3(wx * 0.0055, wz * 0.0055) - 0.5) * 9.0;
            const saucer = (1.0 - smoothstep(0.0, 0.45, u)) * -18.0;
            dh = (ring + saucer + radialGully * smoothstep(0.35, 0.85, u)) * falloff;
            lithoB[idx] = Math.max(lithoB[idx], 0.46 * falloff);
            lithoR[idx] = Math.max(lithoR[idx], 0.35 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #45 LAHAR VOLCANIC MUDFLOW LOBE (火山泥流ラハール堆積緩斜面) ---
          case 45: {
            const along = clamp01((lx + f.radius * 0.72) / (f.radius * 1.44));
            const spread = f.radius * (0.16 + along * 0.38);
            const lobe = (1.0 - smoothstep(0.55, 1.05, Math.abs(lz) / spread)) * (1.0 - smoothstep(0.80, 1.0, along));
            const hummocks = (fbm3(wx * 0.009 + seedOff, wz * 0.009) - 0.35) * 14.0;
            dh = lobe * (18.0 * (1.0 - along * 0.6) + hummocks) * falloff;
            lithoR[idx] = Math.max(lithoR[idx], lobe * 0.55 * falloff);
            lithoB[idx] = Math.max(lithoB[idx], lobe * 0.42 * falloff);
            domWeight = lobe * falloff;
            break;
          }
          // --- #46 FUMAROLE SULFUR HYDROTHERMAL BASIN (硫気変質荒原・噴気窪地) ---
          case 46: {
            const bowl = (1.0 - smoothstep(0.18, 0.82, u)) * -18.0;
            const roughCrag = (fbm3(wx * 0.012 + seedOff, wz * 0.012) - 0.5) * 11.0;
            dh = (bowl + roughCrag) * falloff;
            lithoB[idx] = Math.max(lithoB[idx], (1.0 - smoothstep(0.25, 0.88, u)) * 0.96 * falloff);
            lithoG[idx] = Math.max(lithoG[idx], (1.0 - smoothstep(0.18, 0.72, u)) * 0.58 * falloff); // Bleached acid-sulfate clay!
            domWeight = falloff;
            break;
          }
          // --- #47 ACTIVE FAULT SCARP STEP (活断層崖・断層変位段差) ---
          case 47: {
            const scarpStep = smoothstep(f.radius * 0.08, -f.radius * 0.08, lz) * 64.0;
            const strikeMask = 1.0 - quintic(0.45, 0.98, Math.abs(lx) / f.radius);
            const facetCut = (1.0 - ridged3(wx * 0.0048, wz * 0.0048)) * 12.0;
            dh = (scarpStep - facetCut * smoothstep(0.0, f.radius * 0.25, Math.abs(lz))) * strikeMask * falloff;
            domWeight = strikeMask * falloff;
            break;
          }
          // --- #48 GRABEN RIFT TROUGH (地溝帯・グラーベン構造谷) ---
          case 48: {
            const strikeMask = 1.0 - quintic(0.48, 0.98, Math.abs(lx) / f.radius);
            const trough = (1.0 - smoothstep(f.radius * 0.18, f.radius * 0.30, Math.abs(lz))) * -56.0;
            const horstShoulder = smoothstep(f.radius * 0.24, f.radius * 0.38, Math.abs(lz))
              * (1.0 - smoothstep(f.radius * 0.56, f.radius * 0.88, Math.abs(lz))) * 42.0;
            dh = (trough + horstShoulder) * strikeMask * falloff;
            domWeight = strikeMask * falloff;
            break;
          }
          // --- #49 HOGBACK STRIKE RIDGE (ホッグバック急傾斜岩脈尾根) ---
          case 49: {
            const strikeMask = 1.0 - quintic(0.45, 0.98, Math.abs(lx) / f.radius);
            // Sharp steep symmetrical protruding rock stratum ridge!
            const fin = Math.pow(Math.max(0.0, 1.0 - Math.abs(lz) / (f.radius * 0.24)), 2.2) * 112.0;
            const crag = 0.82 + 0.36 * ridged3(wx * 0.006, wz * 0.006);
            dh = fin * crag * strikeMask * falloff;
            domWeight = strikeMask * Math.max(fin / 90.0, 0.3) * falloff;
            break;
          }
          // --- #50 ANTICLINE FOLDED DOME (背斜褶曲ドーム丘陵) ---
          case 50: {
            const ellip = Math.hypot(lx / (f.radius * 0.88), lz / (f.radius * 0.52));
            const arch = Math.pow(Math.max(0.0, 1.0 - ellip), 1.35) * 96.0;
            // Concentric eroded bedding ribs encircling the breached core!
            const strataRib = Math.sin(ellip * Math.PI * 7.0) * 7.5 * smoothstep(0.18, 0.45, ellip) * (1.0 - smoothstep(0.75, 1.0, ellip));
            const coreBreach = Math.exp(-Math.pow(ellip / 0.24, 2.0)) * -24.0;
            dh = (arch + strataRib + coreBreach) * falloff;
            domWeight = falloff;
            break;
          }
          // --- #51 FAULT-LINE WIND GAP (断層鞍部・風隙ウィンドギャップ) ---
          case 51: {
            const ridgeAxis = Math.exp(-Math.pow(lx / (f.radius * 0.34), 2.0)) * (1.0 - quintic(0.50, 0.98, Math.abs(lz) / f.radius));
            const windNotch = Math.exp(-Math.pow(lz / (f.radius * 0.16), 2.0));
            dh = (ridgeAxis * (1.0 - windNotch * 0.82) * 105.0 - windNotch * 22.0) * falloff;
            domWeight = Math.max(ridgeAxis, windNotch) * falloff;
            break;
          }
          // --- #53 LANDSLIDE HEADSCARP & HUMMOCKY TOE (地すべり滑落崖と流れ山丘群) ---
          case 53: {
            // Crescent concave failure scar upslope (lx < 0) + tumbled hummocky depositional lobe downslope (lx > 0)!
            const scarDist = Math.hypot(lx + f.radius * 0.28, lz) / (f.radius * 0.38);
            const headScar = (1.0 - smoothstep(0.45, 0.95, scarDist)) * -36.0;
            const toeDist = Math.hypot(lx - f.radius * 0.26, lz) / (f.radius * 0.48);
            const toeEnv = 1.0 - smoothstep(0.35, 0.95, toeDist);
            const hummocks = (0.45 + 0.95 * fbm3(wx * 0.011 + seedOff, wz * 0.011 - seedOff)) * 28.0;
            dh = (headScar + toeEnv * hummocks) * falloff;
            lithoB[idx] = Math.max(lithoB[idx], (clamp01(-headScar * 0.03) * 0.88 + toeEnv * 0.52) * falloff);
            domWeight = falloff;
            break;
          }
          // --- #54 LANDSLIDE-DAMMED MOUNTAIN LAKE (天然堰止湖) ---
          case 54: {
            // Hummocky rockslide barrier across lx > +0.25*R impounding an elongated valley lake at lx < +0.18*R!
            const damToe = Math.exp(-Math.pow((lx - f.radius * 0.30) / (f.radius * 0.18), 2.0) - Math.pow(lz / (f.radius * 0.44), 2.0)) * 38.0 * (0.75 + 0.5 * fbm3(wx * 0.012, wz * 0.012));
            const lakeChannel = smoothstep(f.radius * 0.24, f.radius * 0.02, lx) * (1.0 - smoothstep(-f.radius * 0.72, -f.radius * 0.95, lx))
              * (1.0 - smoothstep(f.radius * 0.14, f.radius * 0.36, Math.abs(lz)));
            dh = (damToe - lakeChannel * 34.0) * falloff;
            lithoB[idx] = Math.max(lithoB[idx], clamp01(damToe * 0.025) * 0.72 * falloff);
            lithoA[idx] = Math.max(lithoA[idx], lakeChannel * 0.55 * falloff);
            domWeight = falloff;
            if (lakeChannel > 0.28) setWater = true;
            break;
          }
          // --- #55 BADLANDS RILLED GULLY SLOPE (悪地浸食ガリー斜面・バッドランド) ---
          case 55: {
            // Dense branching dendritic sharp ridges & V-shaped rain rills in soft clay-tuff!
            const rill1 = ridged3(wx * 0.0082 + seedOff, wz * 0.0082 - seedOff);
            const rill2 = ridged3(wx * 0.0175 - seedOff, wz * 0.0175 + seedOff);
            const badEnv = (1.0 - smoothstep(0.45, 0.98, u)) * falloff;
            dh = ((rill1 * 0.65 + rill2 * 0.35) * 44.0 - 16.0) * badEnv;
            lithoB[idx] = Math.max(lithoB[idx], badEnv * 0.90);
            domWeight = badEnv;
            break;
          }
          // --- #56 AVALANCHE CHUTE COULOIR (雪崩シュート・急峻ルンゼ) ---
          case 56: {
            const along = clamp01((lx + f.radius * 0.75) / (f.radius * 1.50));
            const chuteW = f.radius * (0.11 + 0.14 * along * along);
            const trough = Math.exp(-Math.pow(lz / chuteW, 2.0)) * (1.0 - smoothstep(0.75, 0.98, along)) * -28.0;
            const debrisCone = smoothstep(0.62, 0.88, along) * (1.0 - smoothstep(0.88, 1.0, along))
              * Math.exp(-Math.pow(lz / (f.radius * 0.34), 2.0)) * 22.0;
            dh = (trough + debrisCone) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], clamp01((-trough + debrisCone) * 0.025) * 0.45 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #57 DEBRIS-FLOW LEVEE CONE (土石流扇状微地形・礫堤チャネル) ---
          case 57: {
            const along = clamp01((lx + f.radius * 0.65) / (f.radius * 1.35));
            const chW = f.radius * (0.09 + along * 0.16);
            const dAbs = Math.abs(lz);
            const chCut = (1.0 - smoothstep(0.0, chW, dAbs)) * -10.5 * (1.0 - along * 0.5);
            const leveePair = Math.exp(-Math.pow((dAbs - chW * 1.25) / (chW * 0.55), 2.0)) * 9.5 * (1.0 - smoothstep(0.72, 1.0, along));
            const lobeEnd = smoothstep(0.58, 0.86, along) * (1.0 - smoothstep(0.86, 1.0, along)) * Math.exp(-Math.pow(dAbs / (f.radius * 0.36), 2.0)) * 12.0;
            dh = (chCut + leveePair + lobeEnd) * falloff;
            lithoB[idx] = Math.max(lithoB[idx], clamp01((leveePair + lobeEnd) * 0.05) * 0.55 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #58 PEDIMENT RAMP & INSELBERG RESIDUAL KNOLL (ペディメント緩斜面と残丘) ---
          case 58: {
            // Smooth concave eroded bedrock ramp sweeping gently up into an isolated steep granite inselberg!
            const ramp = Math.pow(Math.max(0.0, 1.0 - u), 2.2) * 32.0;
            const inselberg = Math.pow(Math.max(0.0, 1.0 - u / 0.28), 1.25) * 94.0 * (0.82 + 0.36 * ridged3(wx * 0.008, wz * 0.008));
            dh = (ramp + inselberg) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], smoothstep(0.24, 0.68, u) * 0.34 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #59 KARST POLJE ENCLOSED FLAT BASIN (ポリエ・カルスト大閉塞盆地) ---
          case 59: {
            const poljeFloor = (1.0 - smoothstep(0.46, 0.72, u)) * falloff;
            const limestoneRim = smoothstep(0.55, 0.76, u) * (1.0 - smoothstep(0.82, 1.08, u)) * 54.0;
            const targetFloor = basinTargetWaterY + 1.8 + (fbm3(wx * 0.004, wz * 0.004) - 0.5) * 4.2;
            heights[idx] = heights[idx] * (1.0 - poljeFloor * protect * 0.84) + targetFloor * (poljeFloor * protect * 0.84);
            dh = limestoneRim * falloff;
            lithoG[idx] = Math.max(lithoG[idx], limestoneRim * 0.016 * falloff);
            lithoA[idx] = Math.max(lithoA[idx], poljeFloor * 0.62);
            domWeight = falloff;
            if (poljeFloor > 0.45 && targetFloor < basinTargetWaterY + 0.1) setWater = true;
            break;
          }
          // --- #60 KARST UVALA COMPOUND DEPRESSION (ウバーレ・複合ドリーネ連穴) ---
          case 60: {
            const p1 = Math.hypot(lx - f.radius * 0.24, lz - f.radius * 0.08) / (f.radius * 0.42);
            const p2 = Math.hypot(lx + f.radius * 0.24, lz + f.radius * 0.08) / (f.radius * 0.38);
            const p3 = Math.hypot(lx, lz + f.radius * 0.22) / (f.radius * 0.34);
            const sink = (Math.pow(Math.max(0, 1.0 - p1), 1.7) + Math.pow(Math.max(0, 1.0 - p2), 1.7) + Math.pow(Math.max(0, 1.0 - p3), 1.7)) * -32.0;
            const rim = smoothstep(0.52, 0.78, u) * (1.0 - smoothstep(0.84, 1.05, u)) * 22.0;
            dh = (sink + rim) * falloff;
            lithoG[idx] = Math.max(lithoG[idx], 0.76 * falloff);
            domWeight = falloff;
            break;
          }
          // --- #61 SPRING-SAPPING THEATER ALCOVE (湧水侵食アンフィシアター) ---
          case 61: {
            // Steep horseshoe headwall carved backward by groundwater seepage + flat damp valley floor!
            const backWall = smoothstep(f.radius * 0.14, -f.radius * 0.46, lx) * (1.0 - quintic(0.38, 0.96, Math.abs(lz) / (f.radius * 0.82)));
            const floorCut = smoothstep(-f.radius * 0.32, f.radius * 0.15, lx) * Math.exp(-Math.pow(lz / (f.radius * 0.32), 2.0)) * -18.0;
            dh = (backWall * 44.0 + floorCut) * falloff;
            lithoA[idx] = Math.max(lithoA[idx], (clamp01(-floorCut * 0.06) * 0.85 + backWall * 0.35) * falloff);
            domWeight = falloff;
            break;
          }
          // --- #62 ALPINE SEEPAGE FEN TERRACE (傾斜湿原・湧水フェン) ---
          case 62: {
            // Gently sloping groundwater-saturated mossy terrace with subtle horizontal contour pools
            const fenEnv = (1.0 - smoothstep(0.38, 0.94, u)) * falloff;
            const bench = Math.sin((lx / f.radius) * Math.PI * 5.0 + fbm3(wx * 0.008, wz * 0.008) * 3.0) * 2.1;
            const microDip = smoothstep(0.45, 0.25, fbm3(wx * 0.007 + seedOff, wz * 0.007)) * -3.6;
            dh = (bench + microDip) * fenEnv;
            lithoA[idx] = Math.max(lithoA[idx], fenEnv * 0.90);
            domWeight = fenEnv;
            if (microDip < -2.2 && fenEnv > 0.42) setWater = true;
            break;
          }
        }

        if (dh !== 0.0) {
          heights[idx] += dh * protect;
        }
        if (domWeight > 0.08) {
          registerDominant(idx, f.kindIndex, domWeight);
        }
        if (setWater && protect > 0.55 && localWaterY > -1e5) {
          if (localWaterY > basinWaterY[idx]) {
            basinWaterY[idx] = localWaterY;
          }
          if (heights[idx] < localWaterY) {
            waterCellCount++;
            if (wx < waterMinX) waterMinX = wx;
            if (wx > waterMaxX) waterMaxX = wx;
            if (wz < waterMinZ) waterMinZ = wz;
            if (wz > waterMaxZ) waterMaxZ = wz;
          }
        }
      }
    }

    // Register genuine submerged natural basins for terrain-clipped water rendering!
    if ((f.hasLake || f.hasBogPools) && waterCellCount >= 2 && basinTargetWaterY > -1e5) {
      emergentWaterBasins.push({
        id: `${f.id}_${fi}`,
        kindIndex: f.kindIndex,
        kind: f.kind,
        nameJp: f.nameJp,
        shortJp: f.shortJp,
        cx: (waterMinX + waterMaxX) * 0.5,
        cz: (waterMinZ + waterMaxZ) * 0.5,
        spanX: Math.max(120, (waterMaxX - waterMinX) + 180),
        spanZ: Math.max(120, (waterMaxZ - waterMinZ) + 180),
        waterY: basinTargetWaterY,
        lakeKind: f.lakeKind || (f.hasBogPools ? 'bog' : 'lake'),
      });
    }

    // Register active hydrothermal/fumarole zones for ultra-subtle ground-hugging natural vapor
    if (f.hasHotSpring) {
      emergentVaporSites.push({
        id: `${f.id}_${fi}`,
        kindIndex: f.kindIndex,
        kind: f.kind,
        x: f.x,
        z: f.z,
        radius: f.radius * 0.45,
      });
    }
  }

  // Pack 1024×1024 RGBA8 Geological Lithology Texture Buffer
  const lithoRGBA = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const o4 = i * 4;
    lithoRGBA[o4]     = Math.min(255, Math.max(0, Math.round(lithoR[i] * 255)));
    lithoRGBA[o4 + 1] = Math.min(255, Math.max(0, Math.round(lithoG[i] * 255)));
    lithoRGBA[o4 + 2] = Math.min(255, Math.max(0, Math.round(lithoB[i] * 255)));
    lithoRGBA[o4 + 3] = Math.min(255, Math.max(0, Math.round(lithoA[i] * 255)));
  }

  // Gather per-process coverage stats across the 60 km × 60 km world (verifies multi-occurrence!)
  const processCellCounts = new Int32Array(63);
  for (let i = 0; i < N; i++) {
    const k = dominantKindId[i];
    if (k >= 1 && k <= 62) processCellCounts[k]++;
  }
  const activeProcessCount = (() => {
    let c = 0;
    for (let k = 1; k <= 62; k++) if (processCellCounts[k] > 0) c++;
    return c;
  })();

  // Build curated emergent regional labels (one representative regional label per prominent feature,
  // preserving clean spacing so the 2D map looks like an authentic GSI topographic survey!)
  const featureOccurrenceCounts = {};
  for (let i = 0; i < features.length; i++) {
    const id = features[i].id;
    featureOccurrenceCounts[id] = (featureOccurrenceCounts[id] || 0) + 1;
  }

  return {
    catalog: GEOLOGY_PROCESS_CATALOG_62,
    features,
    emergentWaterBasins,
    emergentVaporSites,
    lithoRGBA,
    basinWaterY,
    dominantKindId,
    processCellCounts,
    activeProcessCount,
    featureOccurrenceCounts,
  };
}
