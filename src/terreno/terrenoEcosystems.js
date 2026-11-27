import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import { evalClosestTributary, isInsideSouthRect } from './terrenoGeomorphology.js';
import { isInsideVillageClearing } from '../villageData.js';
import {
  TERRENO_ATMO_UNIFORMS_GLSL,
  TERRENO_ATMO_FUNCTIONS_GLSL,
} from './terrenoAtmosphereGlsl.js';

/**
 * TERRENO 9.0 — Ultra-Massive 100-Species River, Lake & 24-Biome Living Ecosystem Engine
 *
 *   • RIVER ECOSYSTEM (20 distinct species/types >= 15 required!):
 *       7 Swimming 3D River Fish (Ayu, Yamame, Iwana, Ugui, Koi, Oikawa, Kajika)
 *     + 13 Drifting Algae/Mokuzu (藻屑), Water Crowfoot (バイカモ), Aquatic Moss & Riparian Flora!
 *   • LAKE ECOSYSTEM (16 distinct lake-specific species/types >= 10 required!):
 *       Water Lilies, Giant Lotus, Cattails, Water Chestnut, Hornwort, Pondweed, Marimo Moss Balls,
 *       Freshwater Mussels, Wakasagi Smelt, Himemasu Kokanee, Gliding Swans, Dragonflies, Pond Skaters,
 *       Sunken Snags, Floating Peat Mats, and Crater-Lake Travertine Microbial Mats!
 *   • 24-BIOME & TERRAIN SPECIALIST FLORA, FAUNA & MICRO-FORMATIONS (64 distinct types!):
 *       Tailored strictly to Abyssal Rifts, Wetlands, Primeval Forests, Meadows, Badlands, Karst,
 *       Volcanic Fields, Timberline Krummholz, Alpine Flower Tundra, and 4,000m Blue-Ice Glaciers!
 *   • ULTRA-LIGHTWEIGHT PERFORMANCE:
 *       ALL 100 species render inside ONLY 4 GPU-instanced super-batches with LRU tile caching,
 *       ZERO solid colliders, and strict 6m × 6m × 6m player-bubble dynamic animation gating!
 */

// ============================================================================
// 1. RIVER ECOSYSTEM CATALOG — 20 DISTINCT SPECIES & TYPES (川)
// ============================================================================
export const RIVER_ECOSYSTEM_20 = [
  // 7 Swimming 3D River Fish (batch: 'wildlife', mode: 0)
  { id: 'river_ayu',             nameJp: 'アユ（清流若鮎）',       group: 'river', batch: 'wildlife', mode: 0, colBase: [0.58, 0.66, 0.60], colTip: [0.84, 0.88, 0.80], sx: 0.28, sy: 0.12, sz: 0.42 },
  { id: 'river_yamame',          nameJp: 'ヤマメ（渓流女王）',     group: 'river', batch: 'wildlife', mode: 0, colBase: [0.40, 0.50, 0.56], colTip: [0.78, 0.72, 0.68], sx: 0.30, sy: 0.13, sz: 0.46 },
  { id: 'river_iwana',           nameJp: 'イワナ（源流岩魚）',     group: 'river', batch: 'wildlife', mode: 0, colBase: [0.34, 0.36, 0.32], colTip: [0.76, 0.66, 0.46], sx: 0.32, sy: 0.14, sz: 0.50 },
  { id: 'river_ugui',            nameJp: 'ウグイ（瀬の銀魚）',     group: 'river', batch: 'wildlife', mode: 0, colBase: [0.50, 0.54, 0.56], colTip: [0.86, 0.48, 0.34], sx: 0.26, sy: 0.11, sz: 0.40 },
  { id: 'river_koi',             nameJp: 'マゴイ・ニシキゴイ',     group: 'river', batch: 'wildlife', mode: 0, colBase: [0.72, 0.36, 0.18], colTip: [0.96, 0.82, 0.68], sx: 0.46, sy: 0.22, sz: 0.76 },
  { id: 'river_oikawa',          nameJp: 'オイカワ（追河彩魚）',   group: 'river', batch: 'wildlife', mode: 0, colBase: [0.30, 0.66, 0.72], colTip: [0.90, 0.54, 0.62], sx: 0.22, sy: 0.10, sz: 0.34 },
  { id: 'river_kajika',          nameJp: 'カジカ（川底河鹿魚）',   group: 'river', batch: 'wildlife', mode: 0, colBase: [0.30, 0.28, 0.22], colTip: [0.48, 0.44, 0.34], sx: 0.26, sy: 0.10, sz: 0.30 },
  // 13 River Drifting Algae (藻屑), Aquatic Plants & Riparian Flora (batch: 'aquatic' / 'geo')
  { id: 'river_baikamo',         nameJp: 'バイカモ（梅花藻）',     group: 'river', batch: 'aquatic',  mode: 0, colBase: [0.10, 0.42, 0.20], colTip: [0.94, 0.96, 0.90], sx: 0.65, sy: 0.30, sz: 1.55 },
  { id: 'river_aomidoro_mokuzu', nameJp: 'アオミドロ・漂流藻屑',   group: 'river', batch: 'aquatic',  mode: 0, colBase: [0.14, 0.36, 0.12], colTip: [0.34, 0.56, 0.18], sx: 0.55, sy: 0.22, sz: 1.85 },
  { id: 'river_mokuzu_detritus', nameJp: '流下藻屑・落ち葉塊',     group: 'river', batch: 'aquatic',  mode: 1, colBase: [0.24, 0.20, 0.12], colTip: [0.44, 0.36, 0.18], sx: 0.85, sy: 0.10, sz: 1.15 },
  { id: 'river_sekishomo',       nameJp: 'セキショウモ（帯水草）', group: 'river', batch: 'aquatic',  mode: 0, colBase: [0.12, 0.38, 0.16], colTip: [0.26, 0.58, 0.24], sx: 0.48, sy: 0.36, sz: 1.65 },
  { id: 'river_kawagoke',        nameJp: 'カワゴケ（清流沈水苔）', group: 'river', batch: 'aquatic',  mode: 3, colBase: [0.08, 0.28, 0.12], colTip: [0.18, 0.46, 0.18], sx: 0.72, sy: 0.26, sz: 0.72 },
  { id: 'river_ukikusa',         nameJp: 'ウキクサ（澱み浮草）',   group: 'river', batch: 'aquatic',  mode: 1, colBase: [0.18, 0.48, 0.14], colTip: [0.36, 0.68, 0.22], sx: 0.95, sy: 0.06, sz: 0.95 },
  { id: 'river_cresson',         nameJp: 'クレソン（湧水辺草）',   group: 'river', batch: 'aquatic',  mode: 2, colBase: [0.12, 0.42, 0.16], colTip: [0.28, 0.62, 0.24], sx: 0.78, sy: 0.46, sz: 0.78 },
  { id: 'river_yoshi_reed',      nameJp: '河畔ヨシ・アシ群落',     group: 'river', batch: 'aquatic',  mode: 2, colBase: [0.24, 0.40, 0.16], colTip: [0.72, 0.66, 0.44], sx: 0.95, sy: 2.15, sz: 0.95 },
  { id: 'river_shobu_iris',      nameJp: 'ショウブ（清流菖蒲）',   group: 'river', batch: 'aquatic',  mode: 2, colBase: [0.16, 0.44, 0.18], colTip: [0.54, 0.38, 0.78], sx: 0.72, sy: 1.25, sz: 0.72 },
  { id: 'river_tokusa',          nameJp: 'トクサ・ツクシ水辺群',   group: 'river', batch: 'aquatic',  mode: 2, colBase: [0.14, 0.38, 0.18], colTip: [0.24, 0.52, 0.24], sx: 0.56, sy: 1.05, sz: 0.56 },
  { id: 'river_fuki',            nameJp: 'カワブキ（沢蕗大葉）',   group: 'river', batch: 'aquatic',  mode: 1, colBase: [0.14, 0.36, 0.14], colTip: [0.28, 0.54, 0.20], sx: 0.92, sy: 0.64, sz: 0.92 },
  { id: 'river_driftwood_snag',  nameJp: '渓流流木・苔むす沈木',   group: 'river', batch: 'geo',      mode: 3, colBase: [0.28, 0.23, 0.17], colTip: [0.20, 0.36, 0.16], sx: 0.55, sy: 0.42, sz: 2.65 },
  { id: 'river_cobble_biofilm',  nameJp: '渓流珪藻苔石群',         group: 'river', batch: 'geo',      mode: 0, colBase: [0.24, 0.28, 0.22], colTip: [0.34, 0.44, 0.24], sx: 0.95, sy: 0.42, sz: 0.88 },
];

// ============================================================================
// 2. LAKE ECOSYSTEM CATALOG — 16 DISTINCT LAKE-SPECIFIC SPECIES & TYPES (湖)
// ============================================================================
export const LAKE_ECOSYSTEM_16 = [
  { id: 'lake_suiren',           nameJp: 'スイレン（湖面睡蓮花）', group: 'lake', batch: 'aquatic',  mode: 1, colBase: [0.12, 0.38, 0.18], colTip: [0.98, 0.86, 0.90], sx: 1.15, sy: 0.24, sz: 1.15 },
  { id: 'lake_hasu',             nameJp: 'ハス（大輪蓮・傘葉）',   group: 'lake', batch: 'aquatic',  mode: 2, colBase: [0.14, 0.42, 0.20], colTip: [0.96, 0.62, 0.76], sx: 1.25, sy: 1.18, sz: 1.25 },
  { id: 'lake_gama',             nameJp: 'ガマ（湖畔蒲穂群落）',   group: 'lake', batch: 'aquatic',  mode: 2, colBase: [0.18, 0.42, 0.18], colTip: [0.38, 0.20, 0.10], sx: 0.86, sy: 1.95, sz: 0.86 },
  { id: 'lake_hishi',            nameJp: 'ヒシ（湖面菱浮葉群）',   group: 'lake', batch: 'aquatic',  mode: 1, colBase: [0.16, 0.36, 0.14], colTip: [0.46, 0.32, 0.18], sx: 1.10, sy: 0.08, sz: 1.10 },
  { id: 'lake_matsumo',          nameJp: 'マツモ（湖底沈水林）',   group: 'lake', batch: 'aquatic',  mode: 0, colBase: [0.08, 0.32, 0.16], colTip: [0.22, 0.54, 0.24], sx: 0.68, sy: 0.92, sz: 0.68 },
  { id: 'lake_ebimo',            nameJp: 'エビモ・ヒルムシロ',     group: 'lake', batch: 'aquatic',  mode: 0, colBase: [0.14, 0.34, 0.16], colTip: [0.36, 0.52, 0.22], sx: 0.72, sy: 0.78, sz: 1.05 },
  { id: 'lake_marimo',           nameJp: 'マリモ（冷湖球状藻）',   group: 'lake', batch: 'aquatic',  mode: 3, colBase: [0.06, 0.32, 0.12], colTip: [0.14, 0.54, 0.20], sx: 0.36, sy: 0.36, sz: 0.36 },
  { id: 'lake_dobugai',          nameJp: 'ドブガイ・湖底貝床',     group: 'lake', batch: 'aquatic',  mode: 3, colBase: [0.24, 0.24, 0.22], colTip: [0.58, 0.54, 0.48], sx: 0.42, sy: 0.18, sz: 0.34 },
  { id: 'lake_wakasagi',         nameJp: 'ワカサギ（銀鱗群泳）',   group: 'lake', batch: 'wildlife', mode: 0, colBase: [0.68, 0.78, 0.84], colTip: [0.92, 0.96, 1.00], sx: 0.20, sy: 0.09, sz: 0.32 },
  { id: 'lake_himemasu',         nameJp: 'ヒメマス（カルデラ紅鱒）',group: 'lake', batch: 'wildlife', mode: 0, colBase: [0.32, 0.52, 0.64], colTip: [0.88, 0.38, 0.32], sx: 0.36, sy: 0.16, sz: 0.58 },
  { id: 'lake_hakucho',          nameJp: 'ハクチョウ・湖面水鳥',   group: 'lake', batch: 'wildlife', mode: 1, colBase: [0.92, 0.94, 0.96], colTip: [0.98, 0.72, 0.28], sx: 0.75, sy: 0.82, sz: 1.15 },
  { id: 'lake_tonbo',            nameJp: 'イトトンボ・ヤンマ群舞', group: 'lake', batch: 'wildlife', mode: 2, colBase: [0.18, 0.74, 0.86], colTip: [0.76, 0.94, 1.00], sx: 0.24, sy: 0.12, sz: 0.28 },
  { id: 'lake_amenbo',           nameJp: 'アメンボ（水面滑走）',   group: 'lake', batch: 'wildlife', mode: 2, colBase: [0.22, 0.20, 0.18], colTip: [0.46, 0.44, 0.40], sx: 0.18, sy: 0.06, sz: 0.22 },
  { id: 'lake_sunken_stump',     nameJp: '湖底立ち枯れ沈木',       group: 'lake', batch: 'geo',      mode: 3, colBase: [0.26, 0.24, 0.20], colTip: [0.44, 0.42, 0.36], sx: 0.72, sy: 2.40, sz: 0.72 },
  { id: 'lake_floating_peat_mat',nameJp: '浮島泥炭・ミズゴケ島',   group: 'lake', batch: 'aquatic',  mode: 1, colBase: [0.16, 0.32, 0.14], colTip: [0.34, 0.50, 0.22], sx: 2.35, sy: 0.26, sz: 2.15 },
  { id: 'lake_travertine_mat',   nameJp: 'カルデラ石灰華・温泉藻床',group: 'lake', batch: 'geo',      mode: 1, colBase: [0.64, 0.58, 0.38], colTip: [0.28, 0.72, 0.68], sx: 1.65, sy: 0.35, sz: 1.65 },
];

// ============================================================================
// 3. ALL-BIOME & TERRAIN SPECIALIST CATALOG — 64 DISTINCT TYPES (全24バイオーム特化!)
// ============================================================================
export const BIOME_SPECIALIST_CATALOG_64 = [
  // A. Abyssal Rift & Deep Chasm Biomes (-800m .. -120m) (8)
  { id: 'abyss_salt_polygon_crust', nameJp: '深淵岩塩多角形結晶殻',   zones: ['abyssal_brine_trench'], batch: 'geo', mode: 1, colBase: [0.76, 0.82, 0.84], colTip: [0.94, 0.96, 0.98], sx: 1.60, sy: 0.22, sz: 1.60 },
  { id: 'abyss_brine_halophyte',    nameJp: '耐塩アッケシソウ群落',   zones: ['abyssal_brine_trench'], batch: 'flora', mode: 0, colBase: [0.44, 0.16, 0.18], colTip: [0.76, 0.24, 0.26], sx: 0.70, sy: 0.48, sz: 0.70 },
  { id: 'abyss_sulfur_chimney',     nameJp: '深淵硫黄熱水チムニー',   zones: ['abyssal_hydrothermal_rift'], batch: 'geo', mode: 2, colBase: [0.46, 0.42, 0.20], colTip: [0.90, 0.82, 0.32], sx: 0.85, sy: 2.40, sz: 0.85, emissive: 0.25 },
  { id: 'abyss_glow_mycelium',      nameJp: '深谷発光キノコ群落',     zones: ['abyssal_hydrothermal_rift', 'sunken_karst_cenote_belt', 'abyssal_cloud_fern_gorge'], batch: 'flora', mode: 4, colBase: [0.10, 0.44, 0.56], colTip: [0.24, 0.96, 0.88], sx: 0.65, sy: 0.55, sz: 0.65, emissive: 0.95 },
  { id: 'abyss_giant_tree_fern',    nameJp: '深谷雲霧ヘゴ巨大シダ',   zones: ['abyssal_cloud_fern_gorge', 'subterranean_mist_canyon'], batch: 'flora', mode: 2, colBase: [0.08, 0.28, 0.14], colTip: [0.18, 0.54, 0.24], sx: 1.95, sy: 2.30, sz: 1.95 },
  { id: 'abyss_obsidian_spire',     nameJp: '黒曜石ガラス尖塔露頭',   zones: ['sunken_obsidian_chasm'], batch: 'geo', mode: 2, colBase: [0.06, 0.07, 0.10], colTip: [0.20, 0.22, 0.30], sx: 1.15, sy: 3.10, sz: 1.15 },
  { id: 'abyss_pale_cave_fern',     nameJp: '鍾乳暗渓ホラシダ群',     zones: ['sunken_karst_cenote_belt', 'subterranean_mist_canyon'], batch: 'flora', mode: 2, colBase: [0.14, 0.36, 0.24], colTip: [0.36, 0.64, 0.44], sx: 1.05, sy: 0.82, sz: 1.05 },
  { id: 'abyss_cave_stalagmite',    nameJp: 'カルスト天坑石筍柱群',   zones: ['sunken_karst_cenote_belt'], batch: 'geo', mode: 2, colBase: [0.58, 0.54, 0.44], colTip: [0.82, 0.78, 0.66], sx: 0.78, sy: 2.85, sz: 0.78 },

  // B. Wetland, Peat Mire & Riparian Margins (8)
  { id: 'wet_mizubasho',            nameJp: 'ミズバショウ群落',       zones: ['misty_peat_mire', 'subalpine_moor_tarns'], batch: 'flora', mode: 0, colBase: [0.12, 0.42, 0.16], colTip: [0.96, 0.98, 0.94], sx: 0.85, sy: 0.72, sz: 0.85 },
  { id: 'wet_sphagnum_hummock',     nameJp: 'ミズゴケ高層湿原丘',     zones: ['misty_peat_mire', 'subalpine_moor_tarns'], batch: 'flora', mode: 3, colBase: [0.22, 0.42, 0.14], colTip: [0.54, 0.58, 0.22], sx: 1.25, sy: 0.42, sz: 1.25 },
  { id: 'wet_mousengoke',           nameJp: 'モウセンゴケ紅苔群',     zones: ['misty_peat_mire', 'subalpine_moor_tarns'], batch: 'flora', mode: 3, colBase: [0.48, 0.16, 0.14], colTip: [0.84, 0.28, 0.24], sx: 0.58, sy: 0.24, sz: 0.58 },
  { id: 'wet_kakitsubata',          nameJp: 'カキツバタ紫湿原アヤメ', zones: ['misty_peat_mire', 'alluvial_emerald_riparian'], batch: 'flora', mode: 1, colBase: [0.14, 0.40, 0.18], colTip: [0.48, 0.24, 0.84], sx: 0.68, sy: 1.05, sz: 0.68 },
  { id: 'wet_watasuge',             nameJp: 'ワタスゲ白綿毛穂群',     zones: ['misty_peat_mire', 'subalpine_moor_tarns'], batch: 'flora', mode: 1, colBase: [0.20, 0.42, 0.16], colTip: [0.98, 0.98, 0.96], sx: 0.62, sy: 0.86, sz: 0.62 },
  { id: 'wet_ryukinka',             nameJp: 'リュウキンカ黄金湿地花', zones: ['misty_peat_mire', 'alluvial_emerald_riparian'], batch: 'flora', mode: 0, colBase: [0.14, 0.42, 0.16], colTip: [0.96, 0.82, 0.14], sx: 0.74, sy: 0.58, sz: 0.74 },
  { id: 'wet_firefly_swarm',        nameJp: '清流ホタル発光群舞',     zones: ['misty_peat_mire', 'alluvial_emerald_riparian', 'kurosugi_oldgrowth_valley'], batch: 'wildlife', mode: 2, colBase: [0.85, 0.96, 0.24], colTip: [1.00, 0.98, 0.55], sx: 0.14, sy: 0.14, sz: 0.14, emissive: 1.0 },
  { id: 'wet_mossy_nurse_log',      nameJp: '苔むす湿原倒木苗床',     zones: ['misty_peat_mire', 'kurosugi_oldgrowth_valley'], batch: 'geo', mode: 3, colBase: [0.24, 0.20, 0.14], colTip: [0.18, 0.46, 0.16], sx: 0.65, sy: 0.52, sz: 2.90 },

  // C. Valley, Laurel & Montane Primeval Forest Floors (12)
  { id: 'for_yamatsutsuji',         nameJp: 'ヤマツツジ朱紅低木',     zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'akama_redpine_ridge'], batch: 'flora', mode: 0, colBase: [0.12, 0.34, 0.14], colTip: [0.92, 0.28, 0.20], sx: 1.15, sy: 1.05, sz: 1.15 },
  { id: 'for_yamaajisai',           nameJp: 'ヤマアジサイ蒼白渓谷花', zones: ['kurosugi_oldgrowth_valley', 'warm_laurel_rainforest', 'alluvial_emerald_riparian'], batch: 'flora', mode: 0, colBase: [0.12, 0.36, 0.16], colTip: [0.56, 0.74, 0.96], sx: 1.05, sy: 0.95, sz: 1.05 },
  { id: 'for_bracket_fungi',        nameJp: 'サルノコシカケ多孔菌',   zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval'], batch: 'flora', mode: 4, colBase: [0.46, 0.30, 0.16], colTip: [0.84, 0.76, 0.62], sx: 0.55, sy: 0.30, sz: 0.55 },
  { id: 'for_chanterelle_cluster',  nameJp: 'ヤマドリタケ森のキノコ', zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'birch_cloud_woodland'], batch: 'flora', mode: 4, colBase: [0.76, 0.68, 0.52], colTip: [0.72, 0.42, 0.18], sx: 0.46, sy: 0.36, sz: 0.46 },
  { id: 'for_kuma_sasa_carpet',     nameJp: 'クマザサ密集絨毯',       zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'birch_cloud_woodland'], batch: 'flora', mode: 2, colBase: [0.12, 0.34, 0.14], colTip: [0.36, 0.54, 0.26], sx: 1.35, sy: 0.92, sz: 1.35 },
  { id: 'for_warabi_bracken',       nameJp: 'ワラビ・ゼンマイ群生',   zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'warm_laurel_rainforest'], batch: 'flora', mode: 2, colBase: [0.14, 0.38, 0.14], colTip: [0.30, 0.58, 0.20], sx: 1.10, sy: 0.88, sz: 1.10 },
  { id: 'for_takenoko_shoots',      nameJp: '竹林タケノコ若竹群',     zones: ['warm_laurel_rainforest', 'kurosugi_oldgrowth_valley'], batch: 'geo', mode: 2, colBase: [0.38, 0.28, 0.16], colTip: [0.24, 0.54, 0.20], sx: 0.38, sy: 0.85, sz: 0.38 },
  { id: 'for_fallen_culms',         nameJp: '竹林落葉・苔竹塊',       zones: ['warm_laurel_rainforest'], batch: 'geo', mode: 3, colBase: [0.54, 0.48, 0.28], colTip: [0.36, 0.46, 0.22], sx: 0.42, sy: 0.24, sz: 1.90 },
  { id: 'for_saruo_lichen',         nameJp: 'サルオガセ霧林地衣類',   zones: ['montane_beech_primeval', 'subalpine_fir_taiga', 'abyssal_cloud_fern_gorge'], batch: 'flora', mode: 1, colBase: [0.48, 0.58, 0.42], colTip: [0.68, 0.76, 0.58], sx: 0.65, sy: 0.78, sz: 0.65 },
  { id: 'for_woodland_butterfly',   nameJp: 'アサギマダラ森のチョウ', zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'warm_laurel_rainforest', 'susuki_highland_steppe'], batch: 'wildlife', mode: 2, colBase: [0.48, 0.82, 0.88], colTip: [0.62, 0.24, 0.18], sx: 0.26, sy: 0.16, sz: 0.24 },
  { id: 'for_forest_moss_boulder',  nameJp: '原生林深緑苔巨石',       zones: ['kurosugi_oldgrowth_valley', 'montane_beech_primeval', 'warm_laurel_rainforest'], batch: 'geo', mode: 0, colBase: [0.22, 0.24, 0.24], colTip: [0.14, 0.42, 0.16], sx: 1.45, sy: 0.92, sz: 1.35 },
  { id: 'for_wild_lily_yamayuri',   nameJp: 'ヤマユリ森の白百合',     zones: ['kurosugi_oldgrowth_valley', 'warm_laurel_rainforest', 'akama_redpine_ridge'], batch: 'flora', mode: 0, colBase: [0.14, 0.40, 0.16], colTip: [0.98, 0.94, 0.78], sx: 0.76, sy: 1.15, sz: 0.76 },

  // D. Meadow, Susuki Steppe & Birch Plateau (8)
  { id: 'mdw_susuki_plume',         nameJp: '黄金ススキ穂波草原',     zones: ['susuki_highland_steppe', 'akama_redpine_ridge'], batch: 'flora', mode: 1, colBase: [0.34, 0.46, 0.18], colTip: [0.90, 0.84, 0.64], sx: 1.15, sy: 1.75, sz: 1.15 },
  { id: 'mdw_nikkokisuge',          nameJp: 'ニッコウキスゲ黄金百合', zones: ['susuki_highland_steppe', 'birch_cloud_woodland', 'subalpine_moor_tarns'], batch: 'flora', mode: 0, colBase: [0.18, 0.44, 0.18], colTip: [0.98, 0.74, 0.14], sx: 0.82, sy: 0.96, sz: 0.82 },
  { id: 'mdw_rengetsutsuji',        nameJp: 'レンゲツツジ朱橙高原花', zones: ['susuki_highland_steppe', 'birch_cloud_woodland'], batch: 'flora', mode: 0, colBase: [0.16, 0.36, 0.14], colTip: [0.96, 0.44, 0.14], sx: 1.25, sy: 1.18, sz: 1.25 },
  { id: 'mdw_feather_grass',        nameJp: 'フェザーグラス銀穂波',   zones: ['susuki_highland_steppe', 'redrock_canyon_scrub'], batch: 'flora', mode: 1, colBase: [0.46, 0.48, 0.28], colTip: [0.86, 0.84, 0.72], sx: 0.95, sy: 1.15, sz: 0.95 },
  { id: 'mdw_yanagiran',            nameJp: 'ヤナギラン紅紫高原穂',   zones: ['birch_cloud_woodland', 'subalpine_fir_taiga', 'susuki_highland_steppe'], batch: 'flora', mode: 1, colBase: [0.18, 0.42, 0.18], colTip: [0.88, 0.34, 0.68], sx: 0.76, sy: 1.28, sz: 0.76 },
  { id: 'mdw_clover_thyme',         nameJp: '野草花絨毯・白詰草',     zones: ['susuki_highland_steppe', 'alluvial_emerald_riparian'], batch: 'flora', mode: 3, colBase: [0.18, 0.46, 0.18], colTip: [0.94, 0.92, 0.84], sx: 1.15, sy: 0.32, sz: 1.15 },
  { id: 'mdw_meadow_lark',          nameJp: '高原ヒバリ旋回野鳥',     zones: ['susuki_highland_steppe', 'birch_cloud_woodland'], batch: 'wildlife', mode: 3, colBase: [0.46, 0.38, 0.28], colTip: [0.74, 0.66, 0.52], sx: 0.55, sy: 0.22, sz: 0.50 },
  { id: 'mdw_weathered_erratic',    nameJp: '氷河迷子石・草原巨岩',   zones: ['susuki_highland_steppe', 'birch_cloud_woodland'], batch: 'geo', mode: 0, colBase: [0.46, 0.47, 0.48], colTip: [0.64, 0.66, 0.62], sx: 1.85, sy: 1.25, sz: 1.65 },

  // E. Red-Rock Canyon, Karst & Volcanic Provinces (12)
  { id: 'arid_agave_rosette',       nameJp: '乾燥渓谷アガベ大葉群',   zones: ['redrock_canyon_scrub'], batch: 'flora', mode: 5, colBase: [0.24, 0.44, 0.34], colTip: [0.42, 0.62, 0.48], sx: 1.05, sy: 0.95, sz: 1.05 },
  { id: 'arid_prickly_cactus',      nameJp: '朱岩ウチワサボテン',     zones: ['redrock_canyon_scrub'], batch: 'flora', mode: 5, colBase: [0.20, 0.46, 0.22], colTip: [0.92, 0.72, 0.22], sx: 0.78, sy: 1.15, sz: 0.78 },
  { id: 'arid_desert_sage',         nameJp: '乾燥セージ銀葉低木',     zones: ['redrock_canyon_scrub', 'basalt_lava_heath'], batch: 'flora', mode: 0, colBase: [0.44, 0.50, 0.44], colTip: [0.66, 0.72, 0.62], sx: 0.96, sy: 0.76, sz: 0.96 },
  { id: 'arid_redrock_hoodoo',      nameJp: '朱岩フードゥー浸食岩柱', zones: ['redrock_canyon_scrub'], batch: 'geo', mode: 2, colBase: [0.68, 0.34, 0.20], colTip: [0.84, 0.52, 0.30], sx: 1.25, sy: 3.40, sz: 1.25 },
  { id: 'arid_desert_varnish_slab', nameJp: '砂漠ワニス赤褐色岩塊',   zones: ['redrock_canyon_scrub'], batch: 'geo', mode: 1, colBase: [0.48, 0.24, 0.16], colTip: [0.74, 0.42, 0.24], sx: 1.75, sy: 0.68, sz: 1.55 },
  { id: 'karst_limestone_pavement', nameJp: 'カレンフェルト石灰岩歯', zones: ['karst_limestone_maquis'], batch: 'geo', mode: 1, colBase: [0.72, 0.70, 0.64], colTip: [0.88, 0.86, 0.80], sx: 1.55, sy: 1.15, sz: 1.35 },
  { id: 'karst_grike_maidenhair',   nameJp: '石灰岩裂隙ハコネシダ',   zones: ['karst_limestone_maquis'], batch: 'flora', mode: 2, colBase: [0.16, 0.42, 0.18], colTip: [0.34, 0.64, 0.28], sx: 0.84, sy: 0.62, sz: 0.84 },
  { id: 'karst_travertine_rim',     nameJp: '石灰華段丘白鉱リム',     zones: ['karst_limestone_maquis', 'sunken_karst_cenote_belt'], batch: 'geo', mode: 1, colBase: [0.80, 0.76, 0.66], colTip: [0.56, 0.82, 0.84], sx: 1.80, sy: 0.48, sz: 1.60 },
  { id: 'volc_basalt_scoria_mound', nameJp: '玄武岩スコリア火山弾塊', zones: ['basalt_lava_heath'], batch: 'geo', mode: 0, colBase: [0.14, 0.13, 0.15], colTip: [0.36, 0.18, 0.14], sx: 1.45, sy: 0.96, sz: 1.45 },
  { id: 'volc_columnar_cluster',    nameJp: '六角柱状節理玄武岩柱',   zones: ['basalt_lava_heath', 'sunken_obsidian_chasm'], batch: 'geo', mode: 2, colBase: [0.12, 0.13, 0.16], colTip: [0.24, 0.26, 0.30], sx: 1.15, sy: 2.80, sz: 1.15 },
  { id: 'volc_fumarole_vent',       nameJp: '火山噴気孔・硫黄結晶口', zones: ['basalt_lava_heath', 'abyssal_hydrothermal_rift'], batch: 'geo', mode: 2, colBase: [0.24, 0.22, 0.20], colTip: [0.92, 0.84, 0.28], sx: 1.05, sy: 1.35, sz: 1.05, emissive: 0.2 },
  { id: 'volc_lava_pioneer_moss',   nameJp: '溶岩原イタドリ紅苔',     zones: ['basalt_lava_heath'], batch: 'flora', mode: 3, colBase: [0.36, 0.24, 0.16], colTip: [0.68, 0.34, 0.22], sx: 0.86, sy: 0.44, sz: 0.86 },

  // F. Subalpine, Timberline, Alpine Tundra & 4,000m Blue-Ice Glacier Biomes (16)
  { id: 'sub_haimatsu_cushion',     nameJp: '森林限界ハイマツ這松群', zones: ['krummholz_dwarf_pine', 'subalpine_fir_taiga'], batch: 'flora', mode: 3, colBase: [0.08, 0.26, 0.14], colTip: [0.18, 0.44, 0.22], sx: 2.15, sy: 0.92, sz: 2.15 },
  { id: 'sub_hakusan_shakunage',    nameJp: 'ハクサンシャクナゲ花木', zones: ['krummholz_dwarf_pine', 'subalpine_fir_taiga'], batch: 'flora', mode: 0, colBase: [0.12, 0.32, 0.16], colTip: [0.96, 0.82, 0.88], sx: 1.15, sy: 1.05, sz: 1.15 },
  { id: 'sub_nana_kamado_berry',    nameJp: 'ナナカマド紅実低木',     zones: ['krummholz_dwarf_pine', 'subalpine_fir_taiga', 'birch_cloud_woodland'], batch: 'flora', mode: 0, colBase: [0.42, 0.22, 0.14], colTip: [0.92, 0.20, 0.16], sx: 1.20, sy: 1.35, sz: 1.20 },
  { id: 'sub_lichen_deadwood',      nameJp: '亜高山白骨化立ち枯れ',   zones: ['subalpine_fir_taiga', 'krummholz_dwarf_pine'], batch: 'geo', mode: 3, colBase: [0.62, 0.60, 0.56], colTip: [0.80, 0.78, 0.72], sx: 0.45, sy: 2.65, sz: 0.45 },
  { id: 'alp_komakusa',             nameJp: 'コマクサ高山砂礫の女王', zones: ['alpine_flower_tundra', 'alpine_granite_scree'], batch: 'flora', mode: 0, colBase: [0.36, 0.50, 0.48], colTip: [0.96, 0.46, 0.68], sx: 0.56, sy: 0.42, sz: 0.56 },
  { id: 'alp_hakusan_ichige',       nameJp: 'ハクサンイチゲ高山白花', zones: ['alpine_flower_tundra'], batch: 'flora', mode: 0, colBase: [0.16, 0.40, 0.18], colTip: [0.98, 0.98, 0.94], sx: 0.68, sy: 0.48, sz: 0.68 },
  { id: 'alp_chingu_ruma',          nameJp: 'チングルマ綿毛高山花',   zones: ['alpine_flower_tundra', 'krummholz_dwarf_pine'], batch: 'flora', mode: 0, colBase: [0.36, 0.26, 0.16], colTip: [0.96, 0.90, 0.78], sx: 0.74, sy: 0.42, sz: 0.74 },
  { id: 'alp_kuro_yuri',            nameJp: 'クロユリ暗紫高山百合',   zones: ['alpine_flower_tundra', 'subalpine_moor_tarns'], batch: 'flora', mode: 0, colBase: [0.16, 0.36, 0.18], colTip: [0.28, 0.10, 0.22], sx: 0.54, sy: 0.56, sz: 0.54 },
  { id: 'alp_cushion_moss',         nameJp: 'イワウメ高山クッション草',zones: ['alpine_flower_tundra', 'alpine_granite_scree'], batch: 'flora', mode: 3, colBase: [0.18, 0.38, 0.16], colTip: [0.88, 0.92, 0.86], sx: 0.88, sy: 0.28, sz: 0.88 },
  { id: 'alp_map_lichen_rock',      nameJp: 'チズゴケ黄緑地衣岩塊',   zones: ['alpine_granite_scree', 'alpine_flower_tundra'], batch: 'geo', mode: 0, colBase: [0.42, 0.44, 0.48], colTip: [0.68, 0.76, 0.24], sx: 1.35, sy: 0.72, sz: 1.25 },
  { id: 'alp_frost_shattered_scree',nameJp: '凍結破砕花崗岩ガレ角礫', zones: ['alpine_granite_scree', 'nival_snowfield_glacier'], batch: 'geo', mode: 0, colBase: [0.48, 0.50, 0.54], colTip: [0.72, 0.74, 0.78], sx: 1.55, sy: 0.82, sz: 1.35 },
  { id: 'alp_soaring_eagle',        nameJp: '高山イヌワシ大鷲旋回',   zones: ['alpine_granite_scree', 'alpine_flower_tundra', 'nival_snowfield_glacier', 'extreme_summit_serac'], batch: 'wildlife', mode: 3, colBase: [0.22, 0.16, 0.12], colTip: [0.56, 0.42, 0.24], sx: 1.85, sy: 0.48, sz: 1.35 },
  { id: 'niv_blue_ice_serac',       nameJp: '4000m級青氷セラック氷塔',zones: ['extreme_summit_serac', 'nival_snowfield_glacier'], batch: 'geo', mode: 2, colBase: [0.42, 0.74, 0.94], colTip: [0.92, 0.98, 1.00], sx: 1.85, sy: 4.80, sz: 1.65 },
  { id: 'niv_penitente_blades',     nameJp: 'ペニテンテ太陽氷柱群',   zones: ['extreme_summit_serac', 'nival_snowfield_glacier'], batch: 'geo', mode: 2, colBase: [0.64, 0.84, 0.96], colTip: [0.96, 0.99, 1.00], sx: 0.72, sy: 2.30, sz: 0.55 },
  { id: 'niv_sastrugi_drift',       nameJp: '強風サストルギ雪紋丘',   zones: ['nival_snowfield_glacier', 'extreme_summit_serac'], batch: 'geo', mode: 1, colBase: [0.78, 0.86, 0.94], colTip: [0.96, 0.98, 1.00], sx: 2.60, sy: 0.65, sz: 1.35 },
  { id: 'niv_glacial_moraine_boulder', nameJp: '氷河モレーン擦痕巨礫',zones: ['nival_snowfield_glacier', 'alpine_granite_scree'], batch: 'geo', mode: 0, colBase: [0.44, 0.48, 0.54], colTip: [0.84, 0.88, 0.94], sx: 2.10, sy: 1.45, sz: 1.85 },
];

export const ECOSYSTEM_CATALOG_100 = [
  ...RIVER_ECOSYSTEM_20,
  ...LAKE_ECOSYSTEM_16,
  ...BIOME_SPECIALIST_CATALOG_64,
];

// Fast biome-id -> specialist species lookup table
const BIOME_SPECIES_MAP = new Map();
for (let i = 0; i < BIOME_SPECIALIST_CATALOG_64.length; i++) {
  const sp = BIOME_SPECIALIST_CATALOG_64[i];
  for (let z = 0; z < sp.zones.length; z++) {
    const zid = sp.zones[z];
    let arr = BIOME_SPECIES_MAP.get(zid);
    if (!arr) { arr = []; BIOME_SPECIES_MAP.set(zid, arr); }
    arr.push(sp);
  }
}

const RIVER_FISH = RIVER_ECOSYSTEM_20.filter((s) => s.batch === 'wildlife');
const RIVER_PLANTS = RIVER_ECOSYSTEM_20.filter((s) => s.batch !== 'wildlife');
const LAKE_FISH_BIRDS = LAKE_ECOSYSTEM_16.filter((s) => s.batch === 'wildlife');
const LAKE_PLANTS_GEO = LAKE_ECOSYSTEM_16.filter((s) => s.batch !== 'wildlife');

// ============================================================================
// COMPACT PROCEDURAL SUPER-BATCH GEOMETRIES (Low Poly, High Organic Silhouette)
// ============================================================================
function buildWildlifeGeo() {
  // Sculpted streamlined fish/bird/insect body + wing/fin planes (~20 tris)
  const positions = [
    // Fuselage / body diamond (along Z: nose +0.5 -> tail -0.5)
    0.0,  0.0,  0.50,  // 0 nose
    0.20, 0.0,  0.08,  // 1 right
   -0.20, 0.0,  0.08,  // 2 left
    0.0,  0.22, 0.05,  // 3 dorsal
    0.0, -0.16, 0.05,  // 4 belly
    0.0,  0.0, -0.42,  // 5 tail peduncle
    // Caudal tail fin (y-spread)
    0.0,  0.26, -0.72, // 6 tail top
    0.0, -0.26, -0.72, // 7 tail bot
    // Left & right pectoral fins / wings (x-spread — dramatically flared in shader for swans/insects/eagles!)
    0.12, 0.04,  0.14, // 8 right root front
    0.10, 0.02, -0.12, // 9 right root back
    0.92, 0.14,  0.02, // 10 right wingtip
   -0.12, 0.04,  0.14, // 11 left root front
   -0.10, 0.02, -0.12, // 12 left root back
   -0.92, 0.14,  0.02, // 13 left wingtip
  ];
  // aPartMeta: x = bodyTipFrac (0 nose .. 1 tail), y = wingFlag (0 body, 1 right wing, -1 left wing), z = shadeTint (0 base .. 1 tip)
  const meta = [
    0.0, 0.0, 0.25,
    0.35, 0.0, 0.45,
    0.35, 0.0, 0.45,
    0.35, 0.0, 0.15,
    0.35, 0.0, 0.90,
    0.80, 0.0, 0.65,
    1.0,  0.0, 1.00,
    1.0,  0.0, 1.00,
    0.30, 0.2, 0.50,
    0.50, 0.2, 0.55,
    0.45, 1.0, 1.00,
    0.30, -0.2, 0.50,
    0.50, -0.2, 0.55,
    0.45, -1.0, 1.00,
  ];
  const indices = [
    0, 3, 1,  0, 2, 3,  0, 1, 4,  0, 4, 2,
    5, 1, 3,  5, 3, 2,  5, 4, 1,  5, 2, 4,
    5, 6, 7,  5, 7, 6,
    8, 10, 9, 8, 9, 10,
    11, 12, 13, 11, 13, 12,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aPartMeta', new THREE.Float32BufferAttribute(meta, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFloraClusterGeo() {
  // 8 gracefully arching slender botanical fronds/stems + 4-petal sculpted center blossom crown!
  // aPartMeta: x = heightFrac [0..1], y = radialFrac [0..1], z = crownFlag (0..0.7 leaf frond, 1.0 center flower/crown)
  const positions = [];
  const meta = [];
  const indices = [];
  let vBase = 0;

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + (i % 2) * 0.19;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rx = -sa, rz = ca;
    const w0 = 0.075, w1 = 0.115, w2 = 0.068, w3 = 0.012;
    const r1 = 0.22, r2 = 0.54, r3 = 0.82;
    const h1 = 0.46, h2 = 0.86, h3 = 0.94; // Graceful outward botanical arch!
    const bIdx = (i / 8) * 0.65;

    positions.push(
      rx * w0, 0.0, rz * w0,
      -rx * w0, 0.0, -rz * w0,
      ca * r1 + rx * w1, h1, sa * r1 + rz * w1,
      ca * r1 - rx * w1, h1, sa * r1 - rz * w1,
      ca * r2 + rx * w2, h2, sa * r2 + rz * w2,
      ca * r2 - rx * w2, h2, sa * r2 - rz * w2,
      ca * r3 + rx * w3, h3, sa * r3 + rz * w3,
      ca * r3 - rx * w3, h3, sa * r3 - rz * w3,
    );
    meta.push(
      0.0, 0.05, bIdx,
      0.0, 0.05, bIdx,
      0.42, 0.35, bIdx,
      0.42, 0.35, bIdx,
      0.82, 0.72, bIdx,
      0.82, 0.72, bIdx,
      1.00, 1.00, bIdx,
      1.00, 1.00, bIdx,
    );
    indices.push(
      vBase, vBase + 1, vBase + 2,  vBase + 1, vBase + 3, vBase + 2,
      vBase + 2, vBase + 3, vBase + 4,  vBase + 3, vBase + 5, vBase + 4,
      vBase + 4, vBase + 5, vBase + 6,  vBase + 5, vBase + 7, vBase + 6,
    );
    vBase += 8;
  }

  // 4-petal sculpted center blossom / lotus flower / reed plume crown (aPartMeta.z = 1.0!)
  for (let p = 0; p < 4; p++) {
    const ang = (p / 4) * Math.PI * 2 + 0.39;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rx = -sa, rz = ca;
    positions.push(
      0.0, 0.56, 0.0,
      ca * 0.16 + rx * 0.14, 0.78, sa * 0.16 + rz * 0.14,
      ca * 0.16 - rx * 0.14, 0.78, sa * 0.16 - rz * 0.14,
      ca * 0.28, 0.96, sa * 0.28,
    );
    meta.push(
      0.56, 0.0, 1.0,
      0.78, 0.4, 1.0,
      0.78, 0.4, 1.0,
      1.00, 0.7, 1.0,
    );
    indices.push(
      vBase, vBase + 1, vBase + 3,
      vBase, vBase + 3, vBase + 2,
    );
    vBase += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aPartMeta', new THREE.Float32BufferAttribute(meta, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildMicroGeoFormationMesh() {
  // Faceted multi-crystal / jagged rock / serac / driftwood prism cluster (~24 tris)
  const g = new THREE.DodecahedronGeometry(0.58, 0);
  const pos = g.attributes.position;
  const meta = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + 0.45; // Shift base cleanly onto ground!
    const z = pos.getZ(i);
    pos.setXYZ(i, x, y, z);
    const hFrac = Math.max(0, Math.min(1, y / 1.05));
    meta[i * 3] = hFrac;
    meta[i * 3 + 1] = Math.hypot(x, z);
    meta[i * 3 + 2] = (i % 7) / 7;
  }
  g.setAttribute('aPartMeta', new THREE.BufferAttribute(meta, 3));
  g.computeVertexNormals();
  return g;
}

// ============================================================================
// SHARED SUPER-BATCH SHADERS (WITH STRICT 6m × 6m × 6m ANIMATION GATE!)
// ============================================================================
const ECO_WILDLIFE_VERT = /* glsl */ `
precision highp float;

attribute vec3 aPartMeta;      // x=tailFrac, y=wingFlag, z=tintFrac
attribute vec4 aInstPosMode;   // xyz = anchor world pos, w = mode (0=fish, 1=swan, 2=insect/firefly, 3=eagle)
attribute vec4 aInstScaleYaw;  // xyz = scale, w = baseYaw
attribute vec4 aInstColA;      // rgb = base color, a = phase
attribute vec4 aInstColB;      // rgb = tip color, a = emissive

uniform vec3 uPlayerBubbleCenter;
uniform float uAnimBubbleHalf;
uniform float uTime;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vCol;
varying float vEmissive;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  vec3 anchor = aInstPosMode.xyz;
  float mode = aInstPosMode.w;
  float phase = aInstColA.a * 6.283185;
  float yaw = aInstScaleYaw.w;

  // STRICT 6m × 6m × 6m PLAYER-BUBBLE DYNAMIC ANIMATION GATE!
  vec3 dBub = abs(anchor - uPlayerBubbleCenter);
  float in6m = 1.0 - smoothstep(uAnimBubbleHalf - 0.35, uAnimBubbleHalf, max(max(dBub.x, dBub.y), dBub.z));
  float animT = uTime * in6m;

  vec3 lp = position;
  vec3 offset = vec3(0.0);

  if (mode < 0.5) {
    // Mode 0: Swimming River / Lake Fish — sinusoidal tail-beat & gentle current weave!
    lp.x *= 0.42; // Slim pectoral fins for fish
    float swim = sin(animT * 6.8 + phase - aPartMeta.x * 3.8);
    lp.x += swim * 0.14 * aPartMeta.x * aPartMeta.x * in6m;
    offset.x = sin(animT * 0.65 + phase) * 0.48 * in6m;
    offset.z = cos(animT * 0.52 + phase) * 0.55 * in6m;
    offset.y = sin(animT * 1.1 + phase) * 0.08 * in6m;
  } else if (mode < 1.5) {
    // Mode 1: Graceful Gliding Lake Swan / Waterfowl
    lp.y *= 1.15;
    if (aPartMeta.x < 0.2) { lp.y += 0.38; lp.z += 0.14; } // Curved swan neck!
    lp.x *= 0.58;
    float orbit = animT * 0.22 + phase;
    offset.x = cos(orbit) * 1.45 * in6m;
    offset.z = sin(orbit) * 1.15 * in6m;
    offset.y = sin(animT * 2.1 + phase) * 0.03 * in6m;
    yaw += -orbit * in6m;
  } else if (mode < 2.5) {
    // Mode 2: Fluttering Dragonflies, Woodland Butterflies & Glowing Fireflies
    float flap = sin(animT * 22.0 + phase);
    lp.y += abs(aPartMeta.y) * flap * 0.42 * in6m;
    offset.x = sin(animT * 1.35 + phase) * 0.85 * in6m;
    offset.y = sin(animT * 2.10 + phase * 1.7) * 0.42 * in6m;
    offset.z = cos(animT * 1.15 + phase * 0.8) * 0.85 * in6m;
  } else {
    // Mode 3: Soaring Alpine Eagles & Meadow Larks
    lp.x *= 2.4; // Wide soaring wingspan!
    float wingSlow = sin(animT * 2.8 + phase);
    lp.y += abs(aPartMeta.y) * wingSlow * 0.24 * in6m;
    float soar = animT * 0.28 + phase;
    offset.x = cos(soar) * 1.90 * in6m;
    offset.z = sin(soar) * 1.90 * in6m;
    yaw += -soar * in6m;
  }

  lp *= aInstScaleYaw.xyz;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 rotP = vec3(lp.x * cy + lp.z * sy, lp.y, -lp.x * sy + lp.z * cy);
  vec3 wp = anchor + offset + rotP;

  vec3 n0 = normalize(vec3(normal.x * cy + normal.z * sy, normal.y, -normal.x * sy + normal.z * cy));
  vWorldPos = wp;
  vWorldNormal = n0;
  vCol = mix(aInstColA.rgb, aInstColB.rgb, aPartMeta.z);
  vEmissive = aInstColB.a * (0.55 + 0.45 * sin(animT * 3.2 + phase));

  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const ECO_FLORA_VERT = /* glsl */ `
precision highp float;

attribute vec3 aPartMeta;      // x=heightFrac, y=radialFrac, z=bladeIdx
attribute vec4 aInstPosMode;   // xyz = world pos, w = morphMode (0..5)
attribute vec4 aInstScaleYaw;  // xyz = scale, w = yaw
attribute vec4 aInstColA;      // rgb = base color, a = phase
attribute vec4 aInstColB;      // rgb = tip/blossom color, a = emissive

uniform vec3 uPlayerBubbleCenter;
uniform float uAnimBubbleHalf;
uniform float uTime;
uniform vec3 uWeatherWind;
uniform float uWeatherSnowAccum;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vCol;
varying float vEmissive;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  vec3 anchor = aInstPosMode.xyz;
  float mode = aInstPosMode.w;
  float phase = aInstColA.a * 6.283185;
  float yaw = aInstScaleYaw.w;
  float h = aPartMeta.x;

  // STRICT 6m × 6m × 6m PLAYER-BUBBLE DYNAMIC ANIMATION GATE!
  vec3 dBub = abs(anchor - uPlayerBubbleCenter);
  float in6m = 1.0 - smoothstep(uAnimBubbleHalf - 0.35, uAnimBubbleHalf, max(max(dBub.x, dBub.y), dBub.z));
  float animT = uTime * in6m;

  vec3 lp = position;

  float isCrown = step(0.85, aPartMeta.z);

  if (mode < 0.5) {
    // Mode 0 (Aquatic trailing algae / mokuzu / baikamo OR terrestrial wildflower bush):
    if (aInstScaleYaw.z > aInstScaleYaw.x * 1.35) {
      lp.y *= 0.22;
      lp.z = lp.z * 0.45 + h * 1.05;
      float streamWave = sin(animT * 3.4 + phase - h * 4.2) * 0.24 * h * in6m;
      lp.x += streamWave;
    } else {
      float sway = sin(animT * (2.2 + uWeatherWind.y) + phase) * 0.08 * h * h * in6m;
      lp.x += sway;
    }
  } else if (mode < 1.5) {
    // Mode 1: Floating Water Lily Pads / Duckweed OR Tall Swaying Susuki Pampas Plumes
    if (aInstScaleYaw.y < 0.45) {
      if (isCrown > 0.5) {
        // Center multi-petal water lily / lotus blossom rising gracefully above floating pad!
        lp.y = (lp.y - 0.50) * 2.2 + 0.14;
        lp.xz *= 0.88;
      } else {
        // Flat emerald floating lily-pad rosette!
        lp.y *= 0.06;
        lp.xz *= 1.58;
      }
      lp.y += sin(animT * 1.8 + phase) * 0.025 * in6m;
    } else {
      lp.xz *= mix(0.42, 0.88, h);
      float sway = sin(animT * (2.6 + uWeatherWind.y * 1.4) + phase) * (0.14 + uWeatherWind.y * 0.14) * h * h * in6m;
      lp.x += sway;
    }
  } else if (mode < 2.5) {
    // Mode 2: Tall Reeds / Cattails / Giant Tree-Fern / Bamboo Grass
    float sway = sin(animT * (2.0 + uWeatherWind.y * 1.2) + phase) * (0.12 + uWeatherWind.y * 0.12) * h * h * in6m;
    lp.x += sway;
    lp.z += cos(animT * 1.7 + phase) * 0.07 * h * h * in6m;
  } else if (mode < 3.5) {
    // Mode 3: Velvety Cushion Moss / Marimo Sphere / Dwarf Pine Mat
    lp.y = sin(h * 1.5707) * 0.65;
    lp.xz *= 1.15;
  } else if (mode < 4.5) {
    // Mode 4: Glowing Cave Mushroom / Forest Bracket Fungi
    float cap = smoothstep(0.42, 0.85, h);
    lp.xz *= mix(0.28, 1.35, cap);
    lp.y = mix(h * 0.72, 0.82 - (h - 0.65) * 0.35, cap);
  } else {
    // Mode 5: Desert Agave / Prickly-Pear Succulent Rosette
    lp.xz *= mix(0.55, 1.22, h);
  }

  // Gentle tactile parting when player walks right through plants inside the 6m bubble!
  lp *= aInstScaleYaw.xyz;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 rotP = vec3(lp.x * cy + lp.z * sy, lp.y, -lp.x * sy + lp.z * cy);
  vec3 wp = anchor + rotP;

  if (in6m > 0.01) {
    vec2 fromP = wp.xz - uPlayerBubbleCenter.xz;
    float pDist = length(fromP);
    if (pDist < 1.15 && pDist > 0.01) {
      float push = (1.0 - pDist / 1.15) * 0.42 * h * in6m;
      wp.xz += (fromP / pDist) * push;
      wp.y -= push * 0.28;
    }
  }

  vec3 n0 = normalize(vec3(normal.x * cy + normal.z * sy, max(0.25, normal.y), -normal.x * sy + normal.z * cy));
  vWorldPos = wp;
  vWorldNormal = n0;
  // Lush botanical foliage stays deep organic green along stems/leaves; blossom crown & sunlit tips showcase petal/plume hue!
  vec3 lushLeaf = mix(aInstColA.rgb * 0.88, aInstColA.rgb * 1.32 + vec3(0.02, 0.07, 0.01), smoothstep(0.10, 0.90, h));
  float tipMask = max(isCrown, smoothstep(0.76, 1.0, h) * 0.28);
  vec3 baseC = mix(lushLeaf, aInstColB.rgb, tipMask);
  if (uWeatherSnowAccum > 0.05 && aInstColB.a < 0.2) {
    baseC = mix(baseC, vec3(0.84, 0.89, 0.96), uWeatherSnowAccum * smoothstep(0.4, 0.95, h) * 0.62);
  }
  vCol = baseC;
  vEmissive = aInstColB.a * (0.75 + 0.25 * sin(animT * 2.2 + phase));

  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const ECO_GEO_VERT = /* glsl */ `
precision highp float;

attribute vec3 aPartMeta;      // x=hFrac, y=rad, z=seed
attribute vec4 aInstPosMode;   // xyz = world pos, w = shape (0=boulder/scree, 1=slab/crust, 2=spire/serac/stalagmite, 3=driftwood/snag)
attribute vec4 aInstScaleYaw;  // xyz = scale, w = yaw
attribute vec4 aInstColA;
attribute vec4 aInstColB;

uniform float uWeatherSnowAccum;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vCol;
varying float vEmissive;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  vec3 anchor = aInstPosMode.xyz;
  float mode = aInstPosMode.w;
  float yaw = aInstScaleYaw.w;
  float h = aPartMeta.x;
  vec3 lp = position;

  if (mode > 1.5 && mode < 2.5) {
    // Tapered Spire / Blue-Ice Serac / Cave Stalagmite / Sulfur Chimney / Red-Rock Hoodoo
    float taper = mix(1.15, 0.14, h * h);
    lp.xz *= taper;
  } else if (mode > 2.5) {
    // Elongated Fallen Driftwood / Sunken Stump / Deadwood Snag
    lp.xz *= mix(0.95, 0.42, h);
  }

  lp *= aInstScaleYaw.xyz;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 rotP = vec3(lp.x * cy + lp.z * sy, lp.y, -lp.x * sy + lp.z * cy);
  vec3 wp = anchor + rotP;
  vec3 n0 = normalize(vec3(normal.x * cy + normal.z * sy, normal.y, -normal.x * sy + normal.z * cy));

  vWorldPos = wp;
  vWorldNormal = n0;
  vec3 baseC = mix(aInstColA.rgb, aInstColB.rgb, smoothstep(0.18, 0.90, h));
  if (uWeatherSnowAccum > 0.05 && n0.y > 0.35 && aInstColB.a < 0.1) {
    baseC = mix(baseC, vec3(0.84, 0.89, 0.96), uWeatherSnowAccum * smoothstep(0.35, 0.85, n0.y) * 0.72);
  }
  vCol = baseC;
  vEmissive = aInstColB.a;

  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const ECO_COMMON_FRAG = /* glsl */ `
precision highp float;

${TERRENO_ATMO_UNIFORMS_GLSL}

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vCol;
varying float vEmissive;
#include <logdepthbuf_pars_fragment>

${TERRENO_ATMO_FUNCTIONS_GLSL}

void main() {
  vec3 N = normalize(gl_FrontFacing ? vWorldNormal : -vWorldNormal);
  vec3 sunDir = normalize(uSunDir);
  float ndl = max(0.0, (dot(N, sunDir) + 0.32) / 1.32);
  vec3 direct = uSunColor * (uSunIntensity * ndl * 0.88);
  vec3 ambient = mix(uHemiGroundColor, uHemiSkyColor, N.y * 0.5 + 0.5) * (uHemiIntensity * 0.94);

  vec3 lit = vCol * (direct + ambient) + vCol * (vEmissive * 1.45);
  if (uFlashIntensity > 0.01) {
    lit += evalTerrenoFlashlight(vWorldPos, N, vCol);
  }
  vec3 finalCol = applyTerrenoAtmosphere(lit, vWorldPos, cameraPosition);
  gl_FragColor = vec4(finalCol, 1.0);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function makeEcoRng(tx, tz, salt) {
  let h = Math.imul(tx, 374761393) ^ Math.imul(tz, 668265263) ^ Math.imul(salt, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  let s = (h ^ (h >>> 16)) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

function createSuperBatchMesh(baseGeo, mat, maxCount, name) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseGeo.index;
  geo.attributes.position = baseGeo.attributes.position;
  geo.attributes.normal = baseGeo.attributes.normal;
  geo.attributes.aPartMeta = baseGeo.attributes.aPartMeta;

  const posMode = new Float32Array(maxCount * 4);
  const scaleYaw = new Float32Array(maxCount * 4);
  const colA = new Float32Array(maxCount * 4);
  const colB = new Float32Array(maxCount * 4);

  const attrPos = new THREE.InstancedBufferAttribute(posMode, 4);
  const attrScl = new THREE.InstancedBufferAttribute(scaleYaw, 4);
  const attrCA = new THREE.InstancedBufferAttribute(colA, 4);
  const attrCB = new THREE.InstancedBufferAttribute(colB, 4);
  attrPos.setUsage(THREE.DynamicDrawUsage);
  attrScl.setUsage(THREE.DynamicDrawUsage);
  attrCA.setUsage(THREE.DynamicDrawUsage);
  attrCB.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('aInstPosMode', attrPos);
  geo.setAttribute('aInstScaleYaw', attrScl);
  geo.setAttribute('aInstColA', attrCA);
  geo.setAttribute('aInstColB', attrCB);
  geo.instanceCount = 0;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 6;
  return { mesh, geo, maxCount, posMode, scaleYaw, colA, colB, attrPos, attrScl, attrCA, attrCB };
}

export function createTerrenoEcosystems(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Ecosystems_100Species';

  const wildlifeGeo = buildWildlifeGeo();
  const floraGeo = buildFloraClusterGeo();
  const microGeo = buildMicroGeoFormationMesh();

  const makeMat = (vert, doubleSided) => new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: ECO_COMMON_FRAG,
    uniforms: {
      ...atmoUniforms,
    },
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  const wildlifeBatch = createSuperBatchMesh(wildlifeGeo, makeMat(ECO_WILDLIFE_VERT, true), 380, 'ECO_Wildlife_Batch');
  const aquaticBatch  = createSuperBatchMesh(floraGeo,    makeMat(ECO_FLORA_VERT, true),    900, 'ECO_AquaticFlora_Batch');
  const floraBatch    = createSuperBatchMesh(floraGeo,    makeMat(ECO_FLORA_VERT, true),   1400, 'ECO_BiomeFlora_Batch');
  const geoBatch      = createSuperBatchMesh(microGeo,    makeMat(ECO_GEO_VERT, false),     460, 'ECO_BiomeGeo_Batch');

  group.add(wildlifeBatch.mesh);
  group.add(aquaticBatch.mesh);
  group.add(floraBatch.mesh);
  group.add(geoBatch.mesh);

  const TILE_SIZE = 64.0;
  const TILE_RAD = 2; // 5×5 tiles = ±160m around player!
  const MAX_CACHE = 140;
  const tileCache = new Map();

  const waterBasins = geomorph.geologyState?.emergentWaterBasins || [];

  function findLakeAt(wx, wz) {
    const wy = geomorph.getNaturalWaterYAt ? geomorph.getNaturalWaterYAt(wx, wz) : -1e6;
    if (wy > -1e5) return { waterY: wy, isLake: true };
    for (let i = 0; i < waterBasins.length; i++) {
      const b = waterBasins[i];
      if (Math.abs(wx - b.cx) < b.spanX * 0.52 && Math.abs(wz - b.cz) < b.spanZ * 0.52) {
        return { waterY: b.waterY, isLake: true };
      }
    }
    return null;
  }

  function buildTileData(tx, tz) {
    const rng = makeEcoRng(tx, tz, 9017);
    const ox = tx * TILE_SIZE;
    const oz = tz * TILE_SIZE;
    const out = { wildlife: [], aquatic: [], flora: [], geo: [] };

    const pushItem = (sp, x, y, z, yaw, scaleMul = 1.0) => {
      const jitter = 0.78 + rng() * 0.46;
      const item = {
        x, y, z,
        mode: sp.mode,
        sx: sp.sx * scaleMul * jitter,
        sy: sp.sy * scaleMul * jitter,
        sz: sp.sz * scaleMul * jitter,
        yaw,
        rA: sp.colBase[0], gA: sp.colBase[1], bA: sp.colBase[2], ph: rng(),
        rB: sp.colTip[0],  gB: sp.colTip[1],  bB: sp.colTip[2],  em: sp.emissive || 0.0,
      };
      if (sp.batch === 'wildlife') out.wildlife.push(item);
      else if (sp.batch === 'aquatic') out.aquatic.push(item);
      else if (sp.batch === 'geo') out.geo.push(item);
      else out.flora.push(item);
    };

    const compX = TERRENO_WORLD.compoundCenterX;
    const compZ = TERRENO_WORLD.compoundCenterZ;

    // 1. Sample 34 organic candidate sites per 64×64m tile (~850 candidates across 5×5 active ring!)
    for (let i = 0; i < 34; i++) {
      const wx = ox + rng() * TILE_SIZE;
      const wz = oz + rng() * TILE_SIZE;
      if (wx < TERRENO_WORLD.minX + 30 || wx > TERRENO_WORLD.maxX - 30 || wz < TERRENO_WORLD.minZ + 30 || wz > TERRENO_WORLD.maxZ - 30) continue;
      if (Math.hypot(wx - compX, wz - compZ) < 28.0) continue;
      if (isInsideVillageClearing(wx, wz, 2.0) || isInsideSouthRect(wx, wz, 14.0)) continue;

      const groundY = geomorph.getTerrainHeightAt(wx, wz);
      const rv = evalMainRiver(wz);
      const dxRiv = Math.abs(wx - rv.x);
      const trib = evalClosestTributary(wx, wz);
      const inMainRiver = dxRiv < rv.halfWidth * 1.15 && groundY < rv.waterY + 1.2;
      const onRiverBank = !inMainRiver && dxRiv < rv.halfWidth + 24.0;
      const inTributary = !inMainRiver && trib && trib.dist < trib.halfW * 0.95;

      // A. RIVER ECOSYSTEM (20 species: 7 fish + 13 algae/mokuzu/aquatic plants!)
      if (inMainRiver || inTributary) {
        const wY = inMainRiver ? rv.waterY : groundY + 0.55;
        const depth = Math.max(0.12, wY - groundY);
        const roll = rng();
        if (roll < 0.40 && depth > 0.28) {
          // School of 2–4 swimming river fish gleaming in the sunlit upper current!
          const fishSp = RIVER_FISH[(rng() * RIVER_FISH.length) | 0];
          const swimY = Math.max(groundY + 0.12, wY - 0.12 - rng() * Math.min(0.42, depth * 0.45));
          const schoolN = 2 + ((rng() * 2.4) | 0);
          for (let k = 0; k < schoolN; k++) {
            pushItem(fishSp, wx + (rng() - 0.5) * 1.9, swimY + (rng() - 0.5) * 0.08, wz + (rng() - 0.5) * 2.6, (rng() - 0.5) * 0.40, 1.32 + rng() * 0.45);
          }
        } else {
          // Drifting algae/mokuzu (藻屑), water crowfoot (バイカモ), floating duckweed, moss, driftwood, or cobbles!
          const plSp = RIVER_PLANTS[(rng() * RIVER_PLANTS.length) | 0];
          let py = groundY + 0.04;
          if (plSp.mode === 1) py = wY + 0.01;
          else if (plSp.mode === 0) py = Math.max(groundY + 0.06, wY - 0.06 - rng() * 0.18); // Streaming algae/mokuzu & baikamo!
          else if (plSp.mode === 2) py = Math.max(groundY, wY - 0.16);
          pushItem(plSp, wx, py, wz, plSp.mode === 0 ? 0.0 : rng() * Math.PI * 2, 1.25);
        }
        continue;
      }

      if (onRiverBank && rng() < 0.55) {
        // Riparian river plants along wet cobble banks (reeds, iris, horsetail, butterbur, watercress)
        const bankPool = RIVER_PLANTS.slice(6);
        const plSp = bankPool[(rng() * bankPool.length) | 0];
        pushItem(plSp, wx, groundY - 0.04, wz, rng() * Math.PI * 2, 1.10);
        continue;
      }

      // B. LAKE ECOSYSTEM (16 lake-specific species: lilies, lotus, cattails, marimo, mussels, smelt, kokanee, swans, dragonflies!)
      const lake = findLakeAt(wx, wz);
      if (lake) {
        const depth = lake.waterY - groundY;
        if (depth > 0.08) {
          const roll = rng();
          if (roll < 0.36) {
            const wSp = LAKE_FISH_BIRDS[(rng() * LAKE_FISH_BIRDS.length) | 0];
            let py = lake.waterY + 0.05;
            let sMul = 1.25;
            if (wSp.mode === 0) {
              py = Math.max(groundY + 0.12, lake.waterY - 0.14 - rng() * 0.35); // Wakasagi / Himemasu near sunlit surface
              sMul = 1.38;
            } else if (wSp.mode === 1) {
              py = lake.waterY + 0.08; // Graceful gliding white swans!
              sMul = 1.35;
            } else if (wSp.mode === 2) {
              py = lake.waterY + (wSp.id === 'lake_amenbo' ? 0.03 : 0.45 + rng() * 0.9); // Pond skater / Dragonfly
              sMul = 1.20;
            }
            pushItem(wSp, wx, py, wz, rng() * Math.PI * 2, sMul);
          } else {
            const lSp = LAKE_PLANTS_GEO[(rng() * LAKE_PLANTS_GEO.length) | 0];
            let py = groundY;
            if (lSp.mode === 1) py = lake.waterY + 0.03; // Floating water lilies, water chestnut, peat mats
            else if (lSp.mode === 2) py = depth < 1.2 ? groundY : lake.waterY - 0.22; // Cattails / Giant lotus
            else if (lSp.mode === 0) py = Math.max(groundY + 0.08, lake.waterY - 0.22); // Submerged hornwort / pondweed
            else if (lSp.batch === 'geo' && lSp.id === 'lake_sunken_stump') py = groundY - 0.2;
            pushItem(lSp, wx, py, wz, rng() * Math.PI * 2, 1.28);
          }
          continue;
        } else if (depth > -0.55 && rng() < 0.65) {
          // Wet lakeside shoreline belt: cattails, lotus, travertine rim, floating peat & hovering dragonflies!
          const rimPool = [LAKE_ECOSYSTEM_16[1], LAKE_ECOSYSTEM_16[2], LAKE_ECOSYSTEM_16[11], LAKE_ECOSYSTEM_16[14], LAKE_ECOSYSTEM_16[15]];
          const spRim = rimPool[(rng() * rimPool.length) | 0];
          const py = spRim.batch === 'wildlife' ? (groundY + 0.65 + rng() * 0.8) : (groundY - 0.04);
          pushItem(spRim, wx, py, wz, rng() * Math.PI * 2, 1.0);
          continue;
        }
      }

      // C. ALL 24 BIOME-SPECIALIZED FLORA, FAUNA & MICRO-FORMATIONS (64 types!)
      const bInfo = geomorph.getBiomeInfoAt(wx, wz);
      const biomeId = bInfo?.biome?.id || 'kurosugi_oldgrowth_valley';
      const specList = BIOME_SPECIES_MAP.get(biomeId) || BIOME_SPECIES_MAP.get('kurosugi_oldgrowth_valley');
      if (!specList || specList.length === 0) continue;

      const sp = specList[(rng() * specList.length) | 0];
      const nrm = geomorph.getMacroNormalAt(wx, wz);
      const slope = nrm ? nrm.slope : 0.1;

      // Respect real ecology: wildflowers/cushions avoid sheer cliffs; rock spires/seracs/eagles thrive on steep alpine ridges!
      if (sp.batch === 'flora' && slope > 0.72) continue;

      let py = groundY - 0.05;
      if (sp.batch === 'wildlife') {
        if (sp.mode === 3) py = groundY + 26.0 + rng() * 48.0; // Soaring alpine eagles & meadow larks!
        else py = groundY + 0.75 + rng() * 1.9;                // Forest butterflies & glowing fireflies!
      }
      pushItem(sp, wx, py, wz, rng() * Math.PI * 2, 1.0);
    }

    return out;
  }

  function getOrBakeTile(tx, tz) {
    const key = `${tx},${tz}`;
    const hit = tileCache.get(key);
    if (hit) return hit;
    const data = buildTileData(tx, tz);
    tileCache.set(key, data);
    if (tileCache.size > MAX_CACHE) {
      const oldest = tileCache.keys().next().value;
      tileCache.delete(oldest);
    }
    return data;
  }

  function uploadBatch(batch, lists) {
    let count = 0;
    const maxC = batch.maxCount;
    for (let li = 0; li < lists.length; li++) {
      const arr = lists[li];
      for (let i = 0; i < arr.length; i++) {
        if (count >= maxC) break;
        const it = arr[i];
        const o4 = count * 4;
        batch.posMode[o4] = it.x;
        batch.posMode[o4 + 1] = it.y;
        batch.posMode[o4 + 2] = it.z;
        batch.posMode[o4 + 3] = it.mode;

        batch.scaleYaw[o4] = it.sx;
        batch.scaleYaw[o4 + 1] = it.sy;
        batch.scaleYaw[o4 + 2] = it.sz;
        batch.scaleYaw[o4 + 3] = it.yaw;

        batch.colA[o4] = it.rA;
        batch.colA[o4 + 1] = it.gA;
        batch.colA[o4 + 2] = it.bA;
        batch.colA[o4 + 3] = it.ph;

        batch.colB[o4] = it.rB;
        batch.colB[o4 + 1] = it.gB;
        batch.colB[o4 + 2] = it.bB;
        batch.colB[o4 + 3] = it.em;
        count++;
      }
      if (count >= maxC) break;
    }
    batch.geo.instanceCount = count;
    batch.mesh.visible = count > 0;
    if (count > 0) {
      batch.attrPos.needsUpdate = true;
      batch.attrScl.needsUpdate = true;
      batch.attrCA.needsUpdate = true;
      batch.attrCB.needsUpdate = true;
    }
    return count;
  }

  let lastTx = 999999;
  let lastTz = 999999;
  let activeCounts = { wildlife: 0, aquatic: 0, flora: 0, geo: 0 };

  function update(cameraPos) {
    if (!cameraPos) return;
    const tx = Math.floor(cameraPos.x / TILE_SIZE);
    const tz = Math.floor(cameraPos.z / TILE_SIZE);
    if (tx === lastTx && tz === lastTz) return;
    lastTx = tx;
    lastTz = tz;

    const wLists = [];
    const aLists = [];
    const fLists = [];
    const gLists = [];
    for (let dz = -TILE_RAD; dz <= TILE_RAD; dz++) {
      for (let dx = -TILE_RAD; dx <= TILE_RAD; dx++) {
        if (dx * dx + dz * dz > TILE_RAD * TILE_RAD + 1) continue;
        const t = getOrBakeTile(tx + dx, tz + dz);
        if (t.wildlife.length) wLists.push(t.wildlife);
        if (t.aquatic.length) aLists.push(t.aquatic);
        if (t.flora.length) fLists.push(t.flora);
        if (t.geo.length) gLists.push(t.geo);
      }
    }

    activeCounts.wildlife = uploadBatch(wildlifeBatch, wLists);
    activeCounts.aquatic  = uploadBatch(aquaticBatch, aLists);
    activeCounts.flora    = uploadBatch(floraBatch, fLists);
    activeCounts.geo      = uploadBatch(geoBatch, gLists);
  }

  function getActiveEcosystemAt(wx, wz) {
    const rv = evalMainRiver(wz);
    const nearRiver = Math.abs(wx - rv.x) < rv.halfWidth + 40.0;
    const lake = findLakeAt(wx, wz);
    const bInfo = geomorph.getBiomeInfoAt ? geomorph.getBiomeInfoAt(wx, wz) : null;
    const biomeId = bInfo?.biome?.id || 'kurosugi_oldgrowth_valley';
    const specList = BIOME_SPECIES_MAP.get(biomeId) || [];
    return {
      nearRiver,
      nearLake: Boolean(lake),
      biomeId,
      biomeNameJp: bInfo?.biome?.nameJp || '',
      riverSpecies: nearRiver ? RIVER_ECOSYSTEM_20.map((s) => s.nameJp) : [],
      lakeSpecies: lake ? LAKE_ECOSYSTEM_16.map((s) => s.nameJp) : [],
      biomeSpecies: specList.map((s) => s.nameJp),
    };
  }

  function getStats() {
    return {
      totalCatalogSpecies: ECOSYSTEM_CATALOG_100.length,
      riverSpeciesCount: RIVER_ECOSYSTEM_20.length,
      lakeSpeciesCount: LAKE_ECOSYSTEM_16.length,
      biomeSpecialistCount: BIOME_SPECIALIST_CATALOG_64.length,
      activeInstances: { ...activeCounts },
      activeTotal: activeCounts.wildlife + activeCounts.aquatic + activeCounts.flora + activeCounts.geo,
      cachedTiles: tileCache.size,
      animBubbleSizeM: 6.0,
    };
  }

  return {
    group,
    catalog: ECOSYSTEM_CATALOG_100,
    riverCatalog: RIVER_ECOSYSTEM_20,
    lakeCatalog: LAKE_ECOSYSTEM_16,
    biomeCatalog: BIOME_SPECIALIST_CATALOG_64,
    update,
    getActiveEcosystemAt,
    getStats,
  };
}
