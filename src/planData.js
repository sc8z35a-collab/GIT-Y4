/**
 * Single Source of Truth — 5.00m × 10.00m (50.00 m² / 15.13坪) 1LDK Compact Residence
 * Coordinate System:
 *   X: 0.00m (West exterior) -> 5.00m (East exterior)
 *   Z: 0.00m (North exterior / Street) -> 10.00m (South exterior / Sunny Garden)
 *   Y: 0.00m (Main interior finished floor FL±0), Genkan Doma FL-120 (-0.12m), Tatami Nook FL+320 (+0.32m)
 *
 * Every coordinate drives BOTH the 3D WebGL scene and the 2D Architectural CAD Blueprint.
 */

export const HOUSE = {
  name: 'NARROW-50 / 狭小平屋 1LDK「光と格子の家」',
  subtitle: '5,000 × 10,000 mm (50.00 m² / 15.13 坪) — 木造軸組工法・平屋建 1LDK + 小上がり畳ヌック',
  width: 5.0,
  depth: 10.0,
  wallHeight: 2.65,
  ceilingMain: 2.50,
  ceilingWet: 2.35,
  ceilingBath: 2.25,
  extWallThick: 0.15,
  intWallThick: 0.10,
  domaLevel: -0.12,
  tatamiLevel: 0.32,
  storageRatioPct: 11.6,
};

// Structural Grid Axes (通り芯)
export const GRID_AXES = {
  x: [
    { id: 'X1', pos: 0.075, label: '0' },
    { id: 'X2', pos: 1.150, label: '1,075' },
    { id: 'X3', pos: 1.600, label: '1,525' },
    { id: 'X4', pos: 2.050, label: '1,975' },
    { id: 'X5', pos: 3.500, label: '3,425' },
    { id: 'X6', pos: 4.925, label: '4,850' },
  ],
  z: [
    { id: 'Y1', pos: 0.075, label: '0' },
    { id: 'Y2', pos: 1.450, label: '1,375' },
    { id: 'Y3', pos: 3.500, label: '3,425' },
    { id: 'Y4', pos: 5.300, label: '5,225' },
    { id: 'Y5', pos: 7.500, label: '7,425' },
    { id: 'Y6', pos: 9.925, label: '9,850' },
  ],
};

// Structural 105×105mm Timber Columns (通し柱・管柱)
export const COLUMNS = [
  // North exterior
  [0.075, 0.075], [1.600, 0.075], [3.500, 0.075], [4.925, 0.075],
  // Mid-North (Y3)
  [0.075, 3.500], [1.150, 3.500], [1.600, 3.500], [2.050, 3.500], [3.500, 3.500], [4.925, 3.500],
  // Mid-South (Y4)
  [0.075, 5.300], [1.150, 5.300], [2.050, 5.300], [3.500, 5.300], [4.925, 5.300],
  // LDK mid span (Y5)
  [0.075, 7.500], [4.925, 7.500],
  // South exterior (Y6)
  [0.075, 9.925], [3.500, 9.925], [4.925, 9.925],
];

// Rooms with exact net bounds, areas, levels, finishes, and CAD display metadata
export const ROOMS = [
  {
    id: 'genkan',
    code: 'R01',
    nameJp: '玄関土間',
    nameEn: 'Genkan Entry',
    x: 0.15, z: 0.15, w: 1.40, d: 1.30,
    area: 1.82, jo: 1.12,
    fl: 'FL-120', ch: 'CH2470',
    floorTex: 'terrazzo_white',
    floorName: '白テラゾー石調タイル',
    wallName: '織物調白クロス + 下駄箱間接照明',
    ceilName: '白ビニールクロス',
    tint: '#e6e8ea',
    labelPos: [0.95, 0.80],
    notes: '上がり框 H120mm (バリアフリー配慮)、フロート下駄箱下LED間接照明',
  },
  {
    id: 'hall',
    code: 'R02',
    nameJp: '玄関ホール・クローク',
    nameEn: 'Entry Hall',
    x: 0.15, z: 1.45, w: 1.40, d: 2.00,
    area: 2.80, jo: 1.73,
    fl: 'FL±0', ch: 'CH2350',
    floorTex: 'wood_floor',
    floorName: '天然オーク複合フローリング',
    wallName: '織物調白クロス + 玄関コートクローク',
    ceilName: '白ビニールクロス (点検口付)',
    tint: '#f3e5d0',
    labelPos: [1.05, 2.35],
    notes: 'コートクローク D450×W1050、分電盤・メモボード設置',
  },
  {
    id: 'bedroom',
    code: 'R03',
    nameJp: '主寝室',
    nameEn: 'Master Bedroom',
    x: 1.65, z: 0.15, w: 3.20, d: 3.30,
    area: 10.56, jo: 6.52,
    fl: 'FL±0', ch: 'CH2500',
    floorTex: 'wood_floor',
    floorName: 'オークフローリング + ループラグ',
    wallName: '珪藻土調ベージュ(東アクセント) + 白クロス',
    ceilName: '白ビニールクロス',
    tint: '#efe2ce',
    labelPos: [2.85, 1.85],
    notes: 'ダブルベッド W1450 + 造作3枚扉クローゼット W2000×D650 + チェスト',
  },
  {
    id: 'passage',
    code: 'R04',
    nameJp: 'ギャラリー廊下',
    nameEn: 'Gallery Passage',
    x: 0.15, z: 3.55, w: 0.95, d: 1.70,
    area: 1.62, jo: 1.00,
    fl: 'FL±0', ch: 'CH2350',
    floorTex: 'wood_floor',
    floorName: '天然オーク複合フローリング',
    wallName: '木製腰壁(西) + 織物調白クロス',
    ceilName: '吸音ジプトーン + 点検口',
    tint: '#f5ead8',
    labelPos: [0.62, 4.40],
    notes: '有効幅950mm、高窓採光・腰壁アートギャラリー、トイレ引戸アクセス',
  },
  {
    id: 'wc',
    code: 'R05',
    nameJp: 'トイレ',
    nameEn: 'Toilet / WC',
    x: 1.20, z: 3.55, w: 0.80, d: 1.30,
    area: 1.04, jo: 0.64,
    fl: 'FL±0', ch: 'CH2350',
    floorTex: 'tile_beige_grid',
    floorName: 'ベージュ磁器質タイル',
    wallName: '白クロス + ミントモザイクタイル(手洗部)',
    ceilName: '白ビニールクロス (24h換気扇)',
    tint: '#e6efe9',
    labelPos: [1.60, 4.30],
    notes: 'タンクレスウォシュレット、独立手洗器、引き戸(廊下干渉ゼロ)',
  },
  {
    id: 'pantry',
    code: 'R05b',
    nameJp: 'パントリー',
    nameEn: 'Pantry Niche',
    x: 1.20, z: 4.95, w: 0.80, d: 0.40,
    area: 0.32, jo: 0.20,
    fl: 'FL±0', ch: 'CH2350',
    floorTex: 'wood_floor',
    floorName: 'オークフローリング',
    wallName: '白縦パネル + オーク可動棚',
    ceilName: '白クロス',
    tint: '#ede3d2',
    labelPos: [1.60, 5.15],
    notes: 'トイレ南側の隙間400mmを活かした埋込カフェ・パントリー収納',
  },
  {
    id: 'washroom',
    code: 'R06',
    nameJp: '洗面脱衣・ランドリー',
    nameEn: 'Washroom & Laundry',
    x: 2.10, z: 3.55, w: 1.35, d: 1.70,
    area: 2.30, jo: 1.42,
    fl: 'FL±0', ch: 'CH2350',
    floorTex: 'terrazzo_white',
    floorName: '白テラゾー耐水タイル',
    wallName: '白大判タイル(腰下) + モザイク(洗面) + 白クロス',
    ceilName: '白パネル + 点検口',
    tint: '#e4eef4',
    labelPos: [2.78, 4.75],
    notes: '洗面化粧台W700 + ドラム式洗濯機W620並列、キッチンから1歩の最短家事動線',
  },
  {
    id: 'bath',
    code: 'R07',
    nameJp: 'ユニットバス (1317)',
    nameEn: 'Unit Bath',
    x: 3.55, z: 3.55, w: 1.30, d: 1.70,
    area: 2.21, jo: 1.36,
    fl: 'FL-20', ch: 'CH2250',
    floorTex: 'tile_grey_stone',
    floorName: 'ノンスリップ灰石調タイル',
    wallName: '白小角タイル + 水色タイル(浴槽面アクセント)',
    ceilName: '防湿パネル (浴室換気乾燥機)',
    tint: '#d9ebf5',
    labelPos: [4.20, 4.75],
    notes: '1317ゆったり浴槽、東側換気小窓、木製風呂椅子・桶、浴室乾燥機',
  },
  {
    id: 'ldk',
    code: 'R08',
    nameJp: 'LDK (リビング・ダイニング・キッチン)',
    nameEn: 'Open LDK',
    x: 0.15, z: 5.35, w: 4.70, d: 4.50,
    area: 21.15, jo: 13.06,
    fl: 'FL±0', ch: 'CH2500',
    floorTex: 'wood_floor',
    floorName: 'オークフローリング + ベージュタイル(キッチン部)',
    wallName: 'ウッドスラット(西TV面) + 飴色タイル(キッチン) + 織物白クロス',
    ceilName: '白ビニールクロス (CH2500開放天井)',
    tint: '#f7ecda',
    labelPos: [2.25, 7.45],
    notes: '南側W2500掃き出し窓、I型キッチンW2200、4人掛ダイニング、小上がり畳ヌック併設',
  },
  {
    id: 'tatami_nook',
    code: 'R08b',
    nameJp: '小上がり畳ヌック',
    nameEn: 'Raised Tatami Nook',
    x: 3.55, z: 8.55, w: 1.30, d: 1.30,
    area: 1.69, jo: 1.04,
    fl: 'FL+320', ch: 'CH2500',
    floorTex: 'tatami',
    floorName: '本畳 (緑縁付) + 下部引出収納',
    wallName: '珪藻土調ベージュ + 南東コーナー2面採光窓',
    ceilName: '白ビニールクロス',
    tint: '#e2ead2',
    labelPos: [4.20, 9.20],
    notes: 'LDK内小上がり H320mm (下部大容量引出収納×2)、座布団・ちゃぶ台・行灯',
  },
];

// Wall Definitions (each wall has start/end, thickness, height, exterior flag, openings)
// axis: 'x' (horizontal wall along X at fixed Z center) or 'z' (vertical wall along Z at fixed X center)
export const WALLS = [
  {
    id: 'EXT-N', name: '北側外壁', axis: 'x', pos: 0.075, start: 0.0, end: 5.0,
    thick: 0.15, height: 2.65, exterior: true,
    extTex: 'shikkui_white', intTex: 'wallpaper_woven',
    openings: [
      { id: 'D1', type: 'door', subtype: 'swing_out', start: 0.50, end: 1.40, sill: -0.12, top: 2.08, hinge: 'start', swingDir: -1, tex: 'door_navy', label: '玄関ドア W900×H2200 (断熱鋼製・ネイビー)' },
      { id: 'W1', type: 'window', subtype: 'sliding', start: 2.55, end: 4.15, sill: 0.90, top: 2.10, tex: 'window_sky', label: '主寝室 引違窓 W1600×H1200' },
    ],
  },
  {
    id: 'EXT-S', name: '南側外壁', axis: 'x', pos: 9.925, start: 0.0, end: 5.0,
    thick: 0.15, height: 2.65, exterior: true,
    extTex: 'shikkui_white', intTex: 'wallpaper_woven',
    openings: [
      { id: 'W2', type: 'window', subtype: 'terrace', start: 0.75, end: 3.25, sill: 0.05, top: 2.15, tex: 'window_sky', label: 'LDK 掃き出しテラス窓 W2500×H2100 (Low-E複層)' },
      { id: 'W3', type: 'window', subtype: 'picture', start: 3.70, end: 4.65, sill: 0.65, top: 2.10, tex: 'window_sky', label: '畳ヌック 南面窓 W950×H1450' },
    ],
  },
  {
    id: 'EXT-W', name: '西側外壁', axis: 'z', pos: 0.075, start: 0.15, end: 9.85,
    thick: 0.15, height: 2.65, exterior: true,
    extTex: 'yakisugi_dark', intTex: 'wallpaper_woven',
    openings: [
      { id: 'W4', type: 'window', subtype: 'frosted', start: 3.90, end: 4.70, sill: 1.65, top: 2.15, tex: 'window_frosted', label: '廊下 ハイサイド換気窓 W800×H500 (型板ガラス)' },
    ],
  },
  {
    id: 'EXT-E', name: '東側外壁', axis: 'z', pos: 4.925, start: 0.15, end: 9.85,
    thick: 0.15, height: 2.65, exterior: true,
    extTex: 'yakisugi_dark', intTex: 'wallpaper_woven',
    openings: [
      { id: 'W5', type: 'window', subtype: 'frosted', start: 4.00, end: 4.60, sill: 1.50, top: 2.10, tex: 'window_frosted', label: '浴室 換気小窓 W600×H600 (型板ガラス)' },
      { id: 'W6', type: 'window', subtype: 'frosted', start: 6.50, end: 7.40, sill: 1.25, top: 1.95, tex: 'window_frosted', label: 'キッチン 手元採光窓 W900×H700' },
      { id: 'W7', type: 'window', subtype: 'picture', start: 8.75, end: 9.55, sill: 0.65, top: 2.10, tex: 'window_sky', label: '畳ヌック 東面コーナー窓 W800×H1450' },
    ],
  },
  // Interior partitions
  {
    id: 'INT-A-V', name: '玄関ホール/主寝室 間仕切', axis: 'z', pos: 1.60, start: 0.15, end: 3.45,
    thick: 0.10, height: 2.50, exterior: false,
    intTex: 'wallpaper_woven',
    openings: [
      { id: 'D2', type: 'door', subtype: 'swing_in', start: 2.55, end: 3.35, sill: 0.0, top: 2.10, hinge: 'end', swingDir: 1, tex: 'door_oak', label: '主寝室ドア W800×H2100 (ナチュラルオーク)' },
    ],
  },
  {
    id: 'INT-AB-H', name: '主寝室/水回りコア 間仕切', axis: 'x', pos: 3.50, start: 1.10, end: 4.85,
    thick: 0.10, height: 2.50, exterior: false,
    intTex: 'wallpaper_white',
    openings: [],
  },
  {
    id: 'INT-B-V1', name: '廊下/トイレ 間仕切', axis: 'z', pos: 1.15, start: 3.55, end: 5.25,
    thick: 0.10, height: 2.35, exterior: false,
    intTex: 'wallpaper_woven',
    openings: [
      { id: 'D4', type: 'door', subtype: 'pocket', start: 4.00, end: 4.70, sill: 0.0, top: 2.05, slideDir: -1, tex: 'door_oak', label: 'トイレ引き戸 W700×H2050 (上吊ポケット式)' },
    ],
  },
  {
    id: 'INT-B-V2', name: 'トイレ/洗面室 配管壁', axis: 'z', pos: 2.05, start: 3.55, end: 5.25,
    thick: 0.10, height: 2.35, exterior: false,
    intTex: 'wallpaper_white',
    openings: [],
  },
  {
    id: 'INT-B-V3', name: '洗面室/浴室 間仕切', axis: 'z', pos: 3.50, start: 3.55, end: 5.25,
    thick: 0.10, height: 2.35, exterior: false,
    intTex: 'wallpaper_white',
    openings: [
      { id: 'D6', type: 'door', subtype: 'swing_in', start: 4.45, end: 5.15, sill: 0.0, top: 2.00, hinge: 'end', swingDir: 1, tex: 'door_glass_white', label: '浴室ドア W700×H2000 (防湿樹脂框・型板ガラス)' },
    ],
  },
  {
    id: 'INT-WC-S', name: 'トイレ背面/パントリー奥壁', axis: 'x', pos: 4.90, start: 1.20, end: 2.00,
    thick: 0.10, height: 2.35, exterior: false,
    intTex: 'wallpaper_white',
    openings: [],
  },
  {
    id: 'INT-BC-H1', name: '廊下/LDK 間仕切(西)', axis: 'x', pos: 5.30, start: 0.15, end: 1.20,
    thick: 0.10, height: 2.50, exterior: false,
    intTex: 'wallpaper_woven',
    openings: [
      { id: 'D3', type: 'door', subtype: 'swing_in', start: 0.20, end: 1.05, sill: 0.0, top: 2.10, hinge: 'start', swingDir: 1, tex: 'door_glass_white', label: 'リビング採光ドア W850×H2100 (白框・かすみガラス)' },
    ],
  },
  {
    id: 'INT-BC-H2', name: '水回り/LDK 間仕切(東)', axis: 'x', pos: 5.30, start: 2.00, end: 4.85,
    thick: 0.10, height: 2.50, exterior: false,
    intTex: 'wallpaper_woven',
    openings: [
      { id: 'D5', type: 'door', subtype: 'pocket', start: 2.35, end: 3.10, sill: 0.0, top: 2.05, slideDir: 1, tex: 'door_oak', label: '洗面脱衣室 引き戸 W750×H2050 (上吊ポケット式)' },
    ],
  },
];

// Door & Window Schedule (建具表)
export const OPENING_SCHEDULE = [
  { code: 'D1', kind: '玄関ドア', size: 'W900 × H2,200', spec: '断熱鋼製片開き(外開)・ネイビー・ポスト/覗き穴付', room: '玄関土間' },
  { code: 'D2', kind: '室内ドア', size: 'W800 × H2,100', spec: '木質フラッシュ片開き・ナチュラルオーク', room: '廊下↔主寝室' },
  { code: 'D3', kind: 'リビングドア', size: 'W850 × H2,100', spec: '採光ガラス入片開き・ホワイト框', room: '廊下↔LDK' },
  { code: 'D4', kind: 'トイレ引戸', size: 'W700 × H2,050', spec: '上吊ポケット引戸・表示錠付・オーク', room: '廊下↔トイレ' },
  { code: 'D5', kind: '洗面室引戸', size: 'W750 × H2,050', spec: '上吊ポケット引戸・鍵付・オーク', room: 'LDK↔洗面脱衣室' },
  { code: 'D6', kind: '浴室ドア', size: 'W700 × H2,000', spec: '耐水框・半透明強化ガラス片開き', room: '洗面室↔浴室' },
  { code: 'W1', kind: '引違い窓', size: 'W1,600 × H1,200', spec: 'アルミ樹脂複合サッシ・Low-E複層ガラス (FL+900)', room: '主寝室(北)' },
  { code: 'W2', kind: '掃き出し窓', size: 'W2,500 × H2,100', spec: 'ワイド引違いテラスサッシ・Low-E複層 (FL+50)', room: 'LDK(南)' },
  { code: 'W3', kind: '景観腰窓', size: 'W950 × H1,450', spec: 'FIX+すべり出し複合窓 (FL+650)', room: '畳ヌック(南)' },
  { code: 'W4', kind: '高窓', size: 'W800 × H500', spec: '横すべり出し・型板ガラス (FL+1650)', room: '廊下(西)' },
  { code: 'W5', kind: '浴室小窓', size: 'W600 × H600', spec: '4分割型板ガラス・換気サッシ (FL+1500)', room: '浴室(東)' },
  { code: 'W6', kind: 'キッチン窓', size: 'W900 × H700', spec: '手元採光換気サッシ (FL+1250)', room: 'キッチン(東)' },
  { code: 'W7', kind: 'コーナー窓', size: 'W800 × H1,450', spec: '縦すべり出し・Low-E複層 (FL+650)', room: '畳ヌック(東)' },
];

// Furniture & Fixed Equipment Registry (2D CAD footprint + 3D exact position)
// [x, z, w, d] = top-left (west, north) and width (X), depth (Z) in meters
export const FURNITURE = [
  // Genkan & Entry Hall
  { id: 'shoe_box', room: 'genkan', name: 'フロート下駄箱', x: 0.15, z: 0.22, w: 0.35, d: 1.18, h: 0.98, cat: 'storage' },
  { id: 'doormat', room: 'genkan', name: '玄関マット', x: 0.56, z: -0.62, w: 0.78, d: 0.46, h: 0.02, cat: 'decor' },
  { id: 'coat_closet', room: 'hall', name: '玄関クローク', x: 0.15, z: 1.62, w: 0.45, d: 1.10, h: 2.25, cat: 'storage' },

  // Master Bedroom
  { id: 'double_bed', room: 'bedroom', name: 'ダブルベッド (1450×2050)', x: 2.78, z: 0.72, w: 2.05, d: 1.45, h: 0.52, cat: 'bed' },
  { id: 'nightstand_n', room: 'bedroom', name: 'サイドテーブル(北)', x: 4.38, z: 0.25, w: 0.42, d: 0.40, h: 0.52, cat: 'table' },
  { id: 'nightstand_s', room: 'bedroom', name: 'サイドテーブル(南)', x: 4.38, z: 2.23, w: 0.42, d: 0.40, h: 0.52, cat: 'table' },
  { id: 'wardrobe', room: 'bedroom', name: '造作クローゼット (3枚扉)', x: 2.75, z: 2.80, w: 2.05, d: 0.65, h: 2.28, cat: 'storage' },
  { id: 'chest', room: 'bedroom', name: 'オーク3段チェスト', x: 1.67, z: 0.48, w: 0.45, d: 0.90, h: 0.85, cat: 'storage' },
  { id: 'ac_bed', room: 'bedroom', name: 'エアコン(寝室)', x: 1.75, z: 0.16, w: 0.76, d: 0.22, h: 0.28, cat: 'appliance' },

  // WC
  { id: 'toilet', room: 'wc', name: 'タンクレスWC', x: 1.38, z: 3.58, w: 0.44, d: 0.68, h: 0.55, cat: 'plumbing' },
  { id: 'wc_basin', room: 'wc', name: '独立手洗器', x: 1.78, z: 4.35, w: 0.20, d: 0.40, h: 0.82, cat: 'plumbing' },

  // Pantry Niche
  { id: 'pantry_cab', room: 'pantry', name: 'パントリー・カフェ収納', x: 1.22, z: 4.97, w: 0.76, d: 0.36, h: 2.20, cat: 'storage' },

  // Washroom & Laundry
  { id: 'vanity', room: 'washroom', name: '洗面化粧台 W700', x: 2.12, z: 3.57, w: 0.70, d: 0.52, h: 0.80, cat: 'plumbing' },
  { id: 'washer', room: 'washroom', name: 'ドラム式洗濯乾燥機', x: 2.84, z: 3.57, w: 0.60, d: 0.62, h: 0.98, cat: 'appliance' },

  // Unit Bath (1317)
  { id: 'bathtub', room: 'bath', name: 'ゆったり浴槽 (1260×750)', x: 3.57, z: 3.57, w: 1.26, d: 0.76, h: 0.55, cat: 'plumbing' },
  { id: 'bath_stool', room: 'bath', name: '木製風呂椅子・桶', x: 4.38, z: 4.68, w: 0.32, d: 0.28, h: 0.28, cat: 'plumbing' },

  // LDK — Kitchen (East Wall)
  { id: 'fridge', room: 'ldk', name: '2ドア冷蔵庫', x: 4.20, z: 5.38, w: 0.64, d: 0.64, h: 1.75, cat: 'appliance' },
  { id: 'kitchen_unit', room: 'ldk', name: 'I型システムキッチン W2200', x: 4.20, z: 6.08, w: 0.65, d: 2.20, h: 0.85, cat: 'kitchen' },

  // LDK — Dining
  { id: 'dining_table', room: 'ldk', name: 'オークダイニングテーブル', x: 1.85, z: 6.28, w: 1.35, d: 0.80, h: 0.72, cat: 'table' },
  { id: 'chair_1', room: 'ldk', name: 'ダイニングチェア', x: 2.02, z: 5.88, w: 0.44, d: 0.44, h: 0.78, cat: 'seating' },
  { id: 'chair_2', room: 'ldk', name: 'ダイニングチェア', x: 2.60, z: 5.88, w: 0.44, d: 0.44, h: 0.78, cat: 'seating' },
  { id: 'chair_3', room: 'ldk', name: 'ダイニングチェア', x: 2.02, z: 7.04, w: 0.44, d: 0.44, h: 0.78, cat: 'seating' },
  { id: 'chair_4', room: 'ldk', name: 'ダイニングチェア', x: 2.60, z: 7.04, w: 0.44, d: 0.44, h: 0.78, cat: 'seating' },

  // LDK — Living Lounge
  { id: 'lattice_screen', room: 'ldk', name: '木製縦格子スクリーン', x: 1.13, z: 5.36, w: 0.06, d: 0.68, h: 2.50, cat: 'architectural' },
  { id: 'bookshelf', room: 'ldk', name: 'オーク4段オープン本棚', x: 0.16, z: 6.32, w: 0.34, d: 0.88, h: 1.48, cat: 'storage' },
  { id: 'tv_board', room: 'ldk', name: 'フロートTVボード W1800', x: 0.16, z: 7.55, w: 0.40, d: 1.80, h: 0.42, cat: 'storage' },
  { id: 'tv_unit', room: 'ldk', name: '55型4Kテレビ', x: 0.24, z: 7.82, w: 0.12, d: 1.24, h: 0.76, cat: 'appliance' },
  { id: 'coffee_table', room: 'ldk', name: 'ローテーブル', x: 1.22, z: 7.95, w: 0.55, d: 1.00, h: 0.38, cat: 'table' },
  { id: 'sofa', room: 'ldk', name: '3人掛けファブリックソファ', x: 2.28, z: 7.62, w: 0.84, d: 1.75, h: 0.78, cat: 'seating' },
  { id: 'ac_ldk', room: 'ldk', name: 'エアコン(LDK)', x: 3.30, z: 5.36, w: 0.82, d: 0.24, h: 0.29, cat: 'appliance' },

  // LDK — Raised Tatami Nook (SE)
  { id: 'tatami_stage', room: 'tatami_nook', name: '小上がり畳ベンチ (収納付)', x: 3.55, z: 8.55, w: 1.30, d: 1.30, h: 0.32, cat: 'tatami' },
  { id: 'chabudai', room: 'tatami_nook', name: '丸ちゃぶ台', x: 3.92, z: 8.92, w: 0.52, d: 0.52, h: 0.28, cat: 'table' },
  { id: 'plant_living', room: 'ldk', name: '観葉植物 (フィカス)', x: 0.28, z: 9.40, w: 0.38, d: 0.38, h: 1.45, cat: 'decor' },
];

// Lighting Fixtures & Switch Circuits (電気照明・スイッチ配線図データ)
export const LIGHTING = [
  { id: 'L1', type: 'downlight', label: 'DL1 (人感センサー)', x: 0.90, z: 0.82, y: 2.34, color: '#fff3dc', power: 0.8, sw: 'S1' },
  { id: 'L2', type: 'cove', label: '下駄箱間接LED', x: 0.35, z: 0.80, y: 0.15, color: '#ffcf86', power: 0.5, sw: 'S1' },
  { id: 'L3', type: 'downlight', label: 'DL2 (ホール)', x: 0.95, z: 2.40, y: 2.34, color: '#fff1d6', power: 0.7, sw: 'S1' },
  { id: 'L4', type: 'downlight', label: 'DL3 (廊下)', x: 0.62, z: 4.40, y: 2.34, color: '#fff1d6', power: 0.7, sw: 'S2' },
  { id: 'L5', type: 'ceiling', label: 'CL1 (寝室シーリング)', x: 3.25, z: 1.55, y: 2.46, color: '#fff4e0', power: 1.2, sw: 'S3' },
  { id: 'L6', type: 'lamp', label: 'ベッドサイド灯×2', x: 4.58, z: 0.45, y: 0.80, color: '#ffcb7c', power: 0.6, sw: 'S3' },
  { id: 'L7', type: 'downlight', label: 'DL4 (トイレ)', x: 1.60, z: 4.20, y: 2.34, color: '#fff6e8', power: 0.6, sw: 'S4' },
  { id: 'L8', type: 'downlight', label: 'DL5 (洗面)', x: 2.75, z: 4.35, y: 2.34, color: '#f7fbff', power: 0.9, sw: 'S5' },
  { id: 'L9', type: 'bath_light', label: 'BL1 (防湿浴室灯)', x: 4.20, z: 4.40, y: 2.24, color: '#eef7ff', power: 0.9, sw: 'S5' },
  { id: 'L10', type: 'pendant', label: 'PD1 (ダイニング吊灯)', x: 2.25, z: 6.68, y: 1.58, color: '#ffd592', power: 1.0, sw: 'S6' },
  { id: 'L11', type: 'pendant', label: 'PD2 (ダイニング吊灯)', x: 2.82, z: 6.68, y: 1.58, color: '#ffd592', power: 1.0, sw: 'S6' },
  { id: 'L12', type: 'downlight', label: 'DL6 (キッチン手元)', x: 4.05, z: 7.15, y: 2.48, color: '#fff8ec', power: 1.0, sw: 'S7' },
  { id: 'L13', type: 'downlight', label: 'DL7 (リビング主灯)', x: 1.65, z: 8.45, y: 2.48, color: '#fff1d8', power: 1.2, sw: 'S8' },
  { id: 'L14', type: 'cove', label: 'スラット壁間接LED', x: 0.22, z: 8.45, y: 1.85, color: '#ffc978', power: 0.7, sw: 'S8' },
  { id: 'L15', type: 'lantern', label: '和紙行灯 (畳ヌック)', x: 4.55, z: 9.52, y: 0.65, color: '#ffbe66', power: 0.7, sw: 'S8' },
];

export const SWITCHES = [
  { id: 'S1', x: 1.50, z: 1.55, label: '玄関・ホール (3路)', targets: ['L1', 'L2', 'L3'] },
  { id: 'S2', x: 0.22, z: 5.15, label: '廊下 (3路)', targets: ['L4'] },
  { id: 'S3', x: 1.72, z: 2.45, label: '主寝室 (調光)', targets: ['L5', 'L6'] },
  { id: 'S4', x: 1.06, z: 4.82, label: 'トイレ・換気連動', targets: ['L7'] },
  { id: 'S5', x: 2.22, z: 5.18, label: '洗面・浴室乾燥', targets: ['L8', 'L9'] },
  { id: 'S6', x: 1.10, z: 5.42, label: 'ダイニング (調光)', targets: ['L10', 'L11'] },
  { id: 'S7', x: 4.78, z: 6.02, label: 'キッチン手元灯', targets: ['L12'] },
  { id: 'S8', x: 1.10, z: 5.65, label: 'リビング・間接・行灯', targets: ['L13', 'L14', 'L15'] },
];

// Power Outlets & Weak Current (コンセント・TV・LAN)
export const OUTLETS = [
  { x: 0.22, z: 1.25, code: '2E', label: '玄関足元' },
  { x: 4.78, z: 0.45, code: '2E+USB', label: 'ベッド北枕元' },
  { x: 4.78, z: 2.45, code: '2E+USB', label: 'ベッド南枕元' },
  { x: 1.72, z: 0.85, code: '2E+LAN', label: 'チェスト横' },
  { x: 1.90, z: 0.22, code: 'AC', label: '寝室AC (H2200)' },
  { x: 1.92, z: 3.70, code: '1E', label: 'ウォシュレット専用' },
  { x: 2.45, z: 3.64, code: 'WP2E', label: '洗面台防滴' },
  { x: 3.15, z: 3.64, code: '2E(接地)', label: '洗濯機専用(H1100)' },
  { x: 1.60, z: 5.02, code: '2E', label: 'パントリー家電用' },
  { x: 4.76, z: 5.65, code: '2E(接地)', label: '冷蔵庫専用(H1800)' },
  { x: 4.76, z: 7.15, code: '2E×2', label: 'キッチン調理家電' },
  { x: 4.76, z: 7.90, code: 'IH200V', label: 'IHクッキングヒーター専用' },
  { x: 3.65, z: 5.42, code: 'AC200V', label: 'LDK AC (H2200)' },
  { x: 0.24, z: 8.45, code: '4E+TV+LAN', label: 'TV・マルチメディア' },
  { x: 2.65, z: 9.76, code: '2E', label: 'ソファ横充電用' },
  { x: 4.76, z: 9.52, code: '2E', label: '畳ヌック行灯・PC用' },
];

// Plumbing & Ventilation Schematic (給排水・換気ダクト計画)
export const PLUMBING = {
  // Cold water (blue), Hot water (red), Drainage (green), Exhaust ducts (amber dashed)
  cold: [
    [[0.0, 4.20], [1.60, 4.20], [1.60, 3.66]],
    [[1.60, 4.20], [1.88, 4.52]],
    [[1.60, 3.66], [2.45, 3.66], [3.15, 3.66], [4.20, 3.66], [4.20, 4.35]],
    [[4.20, 4.35], [4.65, 4.35], [4.65, 6.50]],
  ],
  hot: [
    [[4.95, 4.30], [4.20, 4.30], [4.20, 3.74], [2.45, 3.74]],
    [[4.65, 4.30], [4.72, 6.50]],
  ],
  drain: [
    [[1.60, 3.75], [2.05, 3.75], [2.05, 4.85], [3.50, 4.85], [4.60, 4.85], [4.60, 6.50]],
    [[2.45, 3.85], [2.45, 4.85]],
    [[3.15, 3.85], [3.15, 4.85]],
    [[4.20, 4.65], [4.20, 4.85]],
  ],
  exhaust: [
    { from: [1.60, 4.10], to: [0.05, 4.10], label: 'トイレ24h局所換気' },
    { from: [4.20, 4.40], to: [4.95, 4.40], label: '浴室換気乾燥ダクト' },
    { from: [4.55, 7.88], to: [4.95, 7.88], label: 'レンジフード排気 φ150' },
  ],
};

// Circulation & Housework Flow Paths (生活動線・家事動線)
export const FLOW_PATHS = [
  {
    id: 'entry_to_ldk',
    label: '帰宅・来客メイン動線 (玄関→廊下→LDK)',
    color: '#c25e28',
    points: [[0.95, -0.30], [0.95, 1.90], [0.65, 3.70], [0.65, 5.80], [1.65, 6.60], [1.85, 8.20]],
  },
  {
    id: 'housework',
    label: '最短家事動線 (キッチン↔洗面ランドリー 1.8m)',
    color: '#1d7a8c',
    points: [[3.80, 6.60], [2.75, 5.60], [2.75, 4.45], [3.10, 4.25]],
  },
  {
    id: 'private_night',
    label: 'プライベート動線 (主寝室↔トイレ・洗面)',
    color: '#6b4fa1',
    points: [[2.55, 2.25], [2.10, 2.95], [1.20, 2.95], [0.78, 3.65], [1.35, 4.35]],
  },
];

// Architectural Finish Schedule (内部仕上表 — links directly to sliced user textures!)
export const FINISH_SCHEDULE = [
  { room: '玄関土間', floor: '白テラゾータイル', floorTex: 'terrazzo_white', wall: '織物調白クロス', wallTex: 'wallpaper_woven', accent: 'ネイビー断熱ドア', accentTex: 'door_navy' },
  { room: '玄関ホール・廊下', floor: '天然オークフローリング', floorTex: 'wood_floor', wall: '木製腰壁 + 織物白クロス', wallTex: 'wainscot_wood', accent: '天井点検口・吸音天井', accentTex: 'ceiling_hatch' },
  { room: '主寝室 (6.5帖)', floor: 'オーク床 + ループラグ', floorTex: 'carpet_beige', wall: '珪藻土調ベージュ壁', wallTex: 'plaster_beige', accent: '花柄キルト寝具・桜クッション', accentTex: 'fabric_floral_quilt' },
  { room: 'トイレ (WC)', floor: 'ベージュ磁器質タイル', floorTex: 'tile_beige_grid', wall: '白ビニールクロス', wallTex: 'wallpaper_white', accent: 'ミントモザイク手洗壁', accentTex: 'tile_mosaic_mint' },
  { room: '洗面脱衣・ランドリー', floor: '白テラゾー耐水タイル', floorTex: 'terrazzo_white', wall: '白大判磁器タイル', wallTex: 'tile_white_large', accent: '白大理石・洗面化粧台', accentTex: 'marble_white' },
  { room: 'ユニットバス (1317)', floor: '灰石調ノンスリップタイル', floorTex: 'tile_grey_stone', wall: '白小角タイル', wallTex: 'tile_white_small', accent: '水色浴室タイル(浴槽面)', accentTex: 'tile_blue_bath' },
  { room: 'LDK・キッチン', floor: '天然オーク + キッチンタイル', floorTex: 'wood_floor', wall: 'ウッドスラット壁(TV面)', wallTex: 'wood_slats', accent: '飴色釉薬タイル(キッチン)', accentTex: 'tile_caramel_brick' },
  { room: '小上がり畳ヌック', floor: '本畳 (緑縁付)', floorTex: 'tatami', wall: '珪藻土調ベージュ壁', wallTex: 'plaster_beige', accent: '臙脂色座布団・木縦格子', accentTex: 'zabuton_red' },
  { room: '外観・南ウッドデッキ', floor: 'ウォルナット縁側デッキ', floorTex: 'wood_deck', wall: '焼杉板(東西) × 漆喰(南北)', wallTex: 'yakisugi_dark', accent: '壁面緑化グリーンウォール', accentTex: 'green_wall' },
];
