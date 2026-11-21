/**
 * Single Source of Truth — NARROW-50 TOWER (8-LEVEL 6-STORY EDITION: B1F + 1F–6F + GABLE ATTIC)
 * 5.00m × 10.00m Ultra-Precision Deep-Forest SRC Hybrid Pencil Tower
 *
 * Vertical Stack (8 Levels / Total Ridge +18.93m + Lightning Mast +20.4m):
 *   - Floor 0 (B1F / 地下1階):   baseY = -2.40m (CH 2.02m, Slab Top  0.00m) — Grey cement bunker, 3m×7m hall + 3 storage rooms × 5 racks
 *   - Floor 1 (1F  / 1階):       baseY =  0.00m (CH 2.50m, Slab Top  2.75m) — Genkan, Gear Room, WC, Pantry, Open LDK, Raised Tatami
 *   - Floor 2 (2F  / 2階):       baseY =  2.75m (CH 2.50m, Slab Top  5.50m) — Forest Study, Washroom, 1317 Unit Bath, Master Suite
 *   - Floor 3 (3F  / 3階):       baseY =  5.50m (CH 2.45m, Slab Top  8.15m) — Ryukyu Tea Room, Cobalt Powder WC, Archive, Treetop Atelier
 *   - Floor 4 (4F  / 4階):       baseY =  8.15m (CH 2.15m, Slab Top 10.50m) — Pro-designer 5 rooms maximizing floor area + 1m×2m SE Balcony
 *   - Floor 5 (5F  / 5階):       baseY = 10.50m (CH 2.55m, Slab Top 13.25m) — Architect's Model Studio, Hinoki Sauna & Sky Bath, Botanical Conservatory + 1.0×2.6m West Spa Deck
 *   - Floor 6 (6F  / 6階):       baseY = 13.25m (CH 2.65m, Slab Top 16.10m) — Crown Sky Penthouse: Starlight Tatami Alcove, Sky Powder, Wine/Coffee Cellar, Equatorial Observatory Salon & Espresso Bar + 4.6×1.1m Full-Width South Sky Terrace
 *   - Floor 7 (RF  / 屋根裏部屋): baseY = 16.10m (Kneewall 1.42m @ 17.52m, 6寸勾配 Ridge @ X=2.50m, Y=18.93m) — Hatch, Relic Storage, Sanctuary
 */

export const HOUSE = {
  name: 'NARROW-50 TOWER / 深い森の地下1階＋6階建て＋屋根裏「樹冠と天空の6層SRC塔屋」',
  subtitle: '5,000 × 10,000 mm（SRC複合制振構造｜B1F 3×7m+倉庫3室 + 地上6階 300m² + 4F/5F/6Fバルコニー3基 + 6寸勾配屋根裏）',
  width: 5.0,
  depth: 10.0,
  extWallThick: 0.15,
  intWallThick: 0.10,
  domaLevel: -0.12,
  tatamiLevel: 0.32,
  spawnFloor: 1, // 1F (index 1 in FLOORS)
  atticFloor: 7, // RF / 屋根裏部屋 (index 7 in FLOORS)
  atticBaseY: 16.10,
  atticKneewallH: 1.42,
  atticEaveY: 17.52,
  atticRidgeY: 18.93,
  atticSlope: 0.60, // Exact Japanese 6寸勾配
  balcony4F: {
    minX: 2.65,
    maxX: 4.65, // 2,000 mm wide
    minZ: 10.00,
    maxZ: 11.00, // 1,000 mm deep
  },
  balcony5F: {
    minX: -1.00,
    maxX: 0.00, // 1,000 mm cantilevered West over courtyard (clears Annex roof eave by 1.15m H / 1.20m V!)
    minZ: 6.20,
    maxZ: 8.80, // 2,600 mm wide
  },
  balcony6F: {
    minX: 0.20,
    maxX: 4.80, // 4,600 mm full-width crown sky terrace
    minZ: 10.00,
    maxZ: 11.10, // 1,100 mm deep
  },
  stairBox: {
    minX: 0.15,
    maxX: 1.15,
    topZ: 2.45,     // North upper landing
    bottomZ: 5.15,  // South lower entry
    treads: 13,
  },
};

export function getAtticCeilingY(x) {
  return HOUSE.atticRidgeY - HOUSE.atticSlope * Math.abs(x - HOUSE.width / 2);
}

// Structural Grid Axes (通り芯) shared vertically across all 6 levels
export const GRID_AXES = {
  x: [
    { id: 'X1', pos: 0.075, label: '0' },
    { id: 'X2', pos: 1.200, label: '1,125' },
    { id: 'X3', pos: 2.200, label: '2,125' },
    { id: 'X4', pos: 3.500, label: '3,425' },
    { id: 'X5', pos: 4.925, label: '4,850' },
  ],
  z: [
    { id: 'Y1', pos: 0.075, label: '0' },
    { id: 'Y2', pos: 1.500, label: '1,425' },
    { id: 'Y3', pos: 2.450, label: '2,375' },
    { id: 'Y4', pos: 3.500, label: '3,425' },
    { id: 'Y5', pos: 5.250, label: '5,175' },
    { id: 'Y6', pos: 6.000, label: '5,925' },
    { id: 'Y7', pos: 9.925, label: '9,850' },
  ],
};

// Continuous Structural 120×120mm Timber/RC Columns
export const COLUMNS = [
  [0.075, 0.075], [2.200, 0.075], [3.500, 0.075], [4.925, 0.075],
  [0.075, 2.450], [1.200, 2.450], [2.200, 2.450], [4.925, 2.450],
  [0.075, 3.500], [2.200, 3.500], [3.500, 3.500], [4.925, 3.500],
  [0.075, 5.250], [1.200, 5.250], [2.200, 5.250], [3.500, 5.250], [4.925, 5.250],
  [0.075, 6.000], [2.200, 6.000], [3.500, 6.000], [4.925, 6.000],
  [0.075, 9.925], [3.500, 9.925], [4.925, 9.925],
];

// =========================================================================
// FLOOR 0 — B1F / 地下1階 (B1FL-2,400, CH 2,020): 低天井灰色セメント地下室
// 3m×7m 主空間 (1室) ＋ 倉庫3室（各室 倉庫棚5基・計15基）
// =========================================================================
const FLOOR_B1F = {
  index: 0,
  code: 'B1F',
  titleJp: '地下1階 平面詳細図',
  subtitle: '低天井灰色セメント地下室 (CH2,020)・3m×7m主空間＋倉庫3室（各室 倉庫棚5基・計15基）・薄暗い作業灯',
  baseY: -2.40,
  ceilingH: 2.02,
  slabTopY: 0.00,
  floorLabel: 'B1FL-2400',
  isBasement: true,
  rooms: [
    {
      id: 'b1_hall', code: 'B01', floor: 0, nameJp: '地下セメント主空間 (3m×7m)', nameEn: '3m×7m Cement Main Hall',
      x: 0.15, z: 2.85, w: 3.00, d: 7.00, area: 21.00, jo: 12.96, fl: 'B1FL±0', ch: 'CH2020',
      floorTex: 'concrete_clean', floorName: '金鏝押え灰色セメント土間',
      wallName: '打放し灰色セメント擁壁＋低天井RC梁', tint: '#d4d6d8', labelPos: [1.85, 7.20],
      notes: '内法3,000×7,000mmの単一セメント空間。低天井2,020mm・排水溝グレーチング・薄暗い防湿バルクヘッド灯',
    },
    {
      id: 'b1_store1', code: 'B02', floor: 0, nameJp: '地下倉庫 1（棚5基）', nameEn: 'Storage Room 1 (5 Racks)',
      x: 3.25, z: 2.85, w: 1.60, d: 2.25, area: 3.60, jo: 2.22, fl: 'B1FL±0', ch: 'CH2020',
      floorTex: 'concrete_clean', floorName: '灰色セメント土間',
      wallName: '灰色セメント擁壁＋スチール倉庫棚×5基', tint: '#cacdd0', labelPos: [4.05, 3.98],
      notes: '東壁3基＋北壁1基＋南壁1基＝計5基のスチール倉庫棚をコの字配置（中央歩行幅1,200mm確保）',
    },
    {
      id: 'b1_store2', code: 'B03', floor: 0, nameJp: '地下倉庫 2（棚5基）', nameEn: 'Storage Room 2 (5 Racks)',
      x: 3.25, z: 5.20, w: 1.60, d: 2.25, area: 3.60, jo: 2.22, fl: 'B1FL±0', ch: 'CH2020',
      floorTex: 'concrete_clean', floorName: '灰色セメント土間',
      wallName: '灰色セメント擁壁＋スチール倉庫棚×5基', tint: '#c5c8cc', labelPos: [4.05, 6.32],
      notes: '非常備蓄・工具ケース保管室。東壁3基＋北壁1基＋南壁1基＝計5基の倉庫棚',
    },
    {
      id: 'b1_store3', code: 'B04', floor: 0, nameJp: '地下倉庫 3（棚5基）', nameEn: 'Storage Room 3 (5 Racks)',
      x: 3.25, z: 7.55, w: 1.60, d: 2.30, area: 3.68, jo: 2.27, fl: 'B1FL±0', ch: 'CH2020',
      floorTex: 'concrete_clean', floorName: '灰色セメント土間',
      wallName: '灰色セメント擁壁＋スチール倉庫棚×5基', tint: '#c0c4c8', labelPos: [4.05, 8.70],
      notes: 'アーカイブ木箱・資材保管室。東壁3基＋北壁1基＋南壁1基＝計5基の倉庫棚',
    },
  ],
  walls: [
    // Subterranean Grey Cement Retaining Envelope (Z=2.85..10.00 + Stair shaft Z=2.30..2.85)
    { id: 'WB_N_ST', axis: 'h', x1: 0, z1: 2.30, x2: 1.25, z2: 2.45, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB_N_MAIN', axis: 'h', x1: 1.15, z1: 2.70, x2: 5.00, z2: 2.85, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.00, z2: 10.00, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB_W', axis: 'v', x1: 0, z1: 2.45, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB_E', axis: 'v', x1: 4.85, z1: 2.85, x2: 5.00, z2: 9.85, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_clean', openings: [] },
    // Concrete Stair Core Wall
    { id: 'WB_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_pcon', openings: [] },
    // Storage Corridor Wall separating 3m×7m Main Space (X=0.15..3.15) from 3 Storage Rooms (X=3.25..4.85)
    {
      id: 'WB_STR_V', axis: 'v', x1: 3.15, z1: 2.85, x2: 3.25, z2: 9.85, kind: 'int', texA: 'concrete_pcon', texB: 'concrete_clean',
      openings: [
        { id: 'DB-1', type: 'door_swing', pos: 3.60, width: 0.75, height: 1.88, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DB-1 地下倉庫1 鉄扉' },
        { id: 'DB-2', type: 'door_swing', pos: 5.95, width: 0.75, height: 1.88, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DB-2 地下倉庫2 鉄扉' },
        { id: 'DB-3', type: 'door_swing', pos: 8.30, width: 0.75, height: 1.88, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DB-3 地下倉庫3 鉄扉' },
      ],
    },
    // Partitions between Storage 1 / 2 / 3
    { id: 'WB_DIV1', axis: 'h', x1: 3.25, z1: 5.10, x2: 4.85, z2: 5.20, kind: 'int', texA: 'concrete_clean', texB: 'concrete_clean', openings: [] },
    { id: 'WB_DIV2', axis: 'h', x1: 3.25, z1: 7.45, x2: 4.85, z2: 7.55, kind: 'int', texA: 'concrete_clean', texB: 'concrete_clean', openings: [] },
  ],
  stairUp: { id: 'ST0', label: 'UP 1Fへ (13段)', dir: 'north' },
  stairDown: null,
  lighting: [
    { type: 'BL', x: 1.75, z: 5.65, label: 'BL-B01 地下薄明バルクヘッド' },
    { type: 'BL', x: 1.75, z: 8.55, label: 'BL-B02 地下奥薄明作業灯' },
  ],
  switches: [
    { x: 1.32, z: 5.22, label: 'SW-B1' },
  ],
  outlets: [
    { x: 3.10, z: 5.45, label: 'WP防滴2P' },
    { x: 0.25, z: 8.60, label: '除湿機2P' },
  ],
  plumbing: [
    { kind: 'drain', pts: [[0.55, 6.20], [2.85, 6.20], [2.85, 9.50]] },
    { kind: 'vent', x: 2.60, z: 9.60, label: '強制地下換気' },
  ],
  flowPaths: [
    { kind: 'priv', pts: [[0.65, 5.25], [2.15, 5.85], [2.15, 4.00], [3.65, 4.00]] },
    { kind: 'work', pts: [[2.15, 5.85], [2.15, 6.32], [3.65, 6.32]] },
    { kind: 'work', pts: [[2.15, 6.32], [2.15, 8.68], [3.65, 8.68]] },
  ],
};

// =========================================================================
// FLOOR 1 — 1F (FL±0.00, CH 2.50m): 森の玄関・道具室・水回り・大開放LDK
// =========================================================================
const FLOOR_1F = {
  index: 1,
  code: '1F',
  titleJp: '1階 平面詳細図',
  subtitle: '玄関土間・森の道具室・LDK・小上がり畳ヌック・ST0地下階段＆ST1リビング階段',
  baseY: 0.0,
  ceilingH: 2.50,
  slabTopY: 2.75,
  floorLabel: '1FL±0',
  rooms: [
    {
      id: 'f1_genkan', code: '1R01', floor: 1, nameJp: '玄関土間', nameEn: 'Genkan Doma',
      x: 0.15, z: 0.15, w: 2.00, d: 1.20, area: 2.40, jo: 1.48, fl: 'FL-120', ch: 'CH2500',
      floorTex: 'terrazzo_white', floorName: '白テラゾー石調タイル',
      wallName: '織物調白クロス + 杉板型枠RCコア', tint: '#e4e7ea', labelPos: [1.15, 0.78],
      notes: '上がり框H120mm、フロート下駄箱＋足元間接照明、外アプローチ苔石舗装',
    },
    {
      id: 'f1_hall', code: '1R02', floor: 1, nameJp: '玄関ホール・地下階段口', nameEn: 'Entry Hall',
      x: 0.15, z: 1.35, w: 2.00, d: 1.10, area: 2.20, jo: 1.36, fl: 'FL±0', ch: 'CH2450',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '杉板型枠コンクリート＋白クロス', tint: '#f3e5d0', labelPos: [1.15, 1.90],
      notes: '南側ST0より地下1階セメント倉庫へ直結。道具室・LDKへスムーズ接続',
    },
    {
      id: 'f1_gear', code: '1R03', floor: 1, nameJp: '森の道具室・薪パントリー', nameEn: 'Forest Gear Room',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'tile_grey_stone', floorName: '濃灰スレート石調タイル',
      wallName: '傷刻み杉板＋有孔ボード＋本棚', tint: '#e2e1dd', labelPos: [3.55, 1.80],
      notes: '森暮らしの薪棚・木箱収納・有孔ボード工具壁・北森ビュー窓',
    },
    {
      id: 'f1_passage', code: '1R04', floor: 1, nameJp: '1F ギャラリー廊下', nameEn: '1F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 2.80, area: 2.52, jo: 1.55, fl: 'FL±0', ch: 'CH2450',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '杉板型枠RC階段コア壁＋アート額', tint: '#f5ead8', labelPos: [1.70, 3.85],
      notes: '階段コア沿い有効幅900mm、1Fトイレ＆LDKへ一直線アクセス',
    },
    {
      id: 'f1_wc', code: '1R05', floor: 1, nameJp: '1F トイレ', nameEn: '1F WC',
      x: 2.25, z: 3.55, w: 1.10, d: 1.65, area: 1.82, jo: 1.12, fl: 'FL±0', ch: 'CH2350',
      floorTex: 'tile_beige_grid', floorName: 'ベージュ磁器質タイル',
      wallName: '白クロス＋ミントモザイクタイル', tint: '#e5eee8', labelPos: [2.80, 4.35],
      notes: 'タンクレストイレ・独立手洗器・廊下干渉ゼロの引戸',
    },
    {
      id: 'f1_utility', code: '1R06', floor: 1, nameJp: '食品庫・土間水栓室', nameEn: 'Pantry Utility',
      x: 3.45, z: 3.55, w: 1.40, d: 1.65, area: 2.31, jo: 1.43, fl: 'FL±0', ch: 'CH2350',
      floorTex: 'terrazzo_emerald', floorName: 'エメラルドテラゾー',
      wallName: '白小口タイル＋可動食品棚', tint: '#dfebe4', labelPos: [4.15, 4.35],
      notes: 'キッチン北裏のパントリー・大型冷蔵庫・泥落としシンク',
    },
    {
      id: 'f1_ldk', code: '1R07', floor: 1, nameJp: 'LDK（リビング・ダイニング）', nameEn: '1F LDK',
      x: 0.15, z: 5.25, w: 4.70, d: 4.60, area: 19.66, jo: 12.14, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '木縦格子TV壁(西)＋キャラメル煉瓦タイル(東)', tint: '#f7ecd8', labelPos: [2.00, 7.60],
      notes: '幅4.7m全幅LDK・壁掛け55型TV・I型キッチン・南大開口縁側デッキ',
    },
    {
      id: 'f1_tatami', code: '1R08', floor: 1, nameJp: '小上がり畳ヌック', nameEn: 'Tatami Nook',
      x: 3.45, z: 8.45, w: 1.40, d: 1.40, area: 1.96, jo: 1.21, fl: 'FL+320', ch: 'CH2180',
      floorTex: 'tatami', floorName: '縁無し半帖畳',
      wallName: '黄土色漆喰＋和紙行灯', tint: '#dfe7ca', labelPos: [4.15, 9.15],
      notes: 'FL+320小上がり、和紙ランタン点灯可能・南森の月明かり特等席',
    },
  ],
  walls: [
    {
      id: 'W1_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'D1-1', type: 'door_swing', pos: 0.65, width: 0.90, height: 2.25, sill: -0.12, tex: 'door_navy', hinge: 'left', swingDir: 1, label: 'D1-1 玄関ドア (W900)' },
        { id: 'W1-1', type: 'window', pos: 2.80, width: 1.55, height: 1.35, sill: 0.85, label: 'W1-1 道具室北窓' },
      ],
    },
    {
      id: 'W1_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'W1-2', type: 'window_terrace', pos: 0.50, width: 2.55, height: 2.22, sill: 0.04, label: 'W1-2 南掃き出し大開口' },
        { id: 'W1-3', type: 'window', pos: 3.65, width: 1.00, height: 1.55, sill: 0.65, label: 'W1-3 畳ヌック南窓' },
      ],
    },
    {
      id: 'W1_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_white',
      openings: [
        { id: 'W1-4', type: 'window_high', pos: 3.30, width: 1.15, height: 0.60, sill: 1.75, label: 'W1-4 階段高窓' },
        { id: 'W1-5', type: 'window', pos: 6.20, width: 0.95, height: 1.10, sill: 1.05, label: 'W1-5 西森スリット窓' },
      ],
    },
    {
      id: 'W1_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_white',
      openings: [
        { id: 'W1-6', type: 'window_frosted', pos: 3.95, width: 0.85, height: 0.85, sill: 1.25, label: 'W1-6 ユーティリティ窓' },
        { id: 'W1-7', type: 'window', pos: 6.25, width: 1.05, height: 1.05, sill: 1.10, label: 'W1-7 キッチン森窓' },
      ],
    },
    // Interior Walls (W1_ST_N removed so ST0 descends openly from 1F Entry Hall into B1F!)
    { id: 'W1_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_cedar_form', openings: [] },
    {
      id: 'W1_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.25, kind: 'int', texA: 'wallpaper_white', texB: 'wood_scratched_cedar',
      openings: [
        { id: 'D1-2', type: 'door_swing', pos: 1.55, width: 0.80, height: 2.05, sill: 0, tex: 'door_walnut', hinge: 'left', swingDir: 1, label: 'D1-2 道具室ドア' },
        { id: 'D1-3', type: 'door_pocket', pos: 3.95, width: 0.75, height: 2.05, sill: 0, tex: 'door_white', slideDir: -1, label: 'D1-3 1Fトイレ引戸' },
      ],
    },
    { id: 'W1_GEAR_S', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'wood_scratched_cedar', texB: 'wallpaper_white', openings: [] },
    { id: 'W1_WC_E', axis: 'v', x1: 3.35, z1: 3.55, x2: 3.45, z2: 5.20, kind: 'int', texA: 'wallpaper_white', texB: 'tile_white_small', openings: [] },
    {
      id: 'W1_WET_S', axis: 'h', x1: 2.25, z1: 5.20, x2: 4.85, z2: 5.30, kind: 'int', texA: 'tile_white_small', texB: 'wallpaper_white',
      openings: [
        { id: 'D1-4', type: 'door_pocket', pos: 3.70, width: 0.85, height: 2.05, sill: 0, tex: 'door_oak', slideDir: -1, label: 'D1-4 パントリー引戸' },
      ],
    },
  ],
  stairUp: { id: 'ST1', label: 'UP 2Fへ (13段)', dir: 'north' },
  stairDown: { id: 'ST0', label: 'DN B1Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 0.75, label: 'DL-101 玄関センサー' },
    { type: 'DL', x: 1.70, z: 3.85, label: 'DL-102 廊下ダウンライト' },
    { type: 'CL', x: 3.55, z: 1.80, label: 'CL-103 道具室作業灯' },
    { type: 'DL', x: 2.80, z: 4.35, label: 'DL-104 1Fトイレ灯' },
    { type: 'DL', x: 4.15, z: 4.35, label: 'DL-105 パントリー灯' },
    { type: 'PD', x: 2.85, z: 7.45, label: 'PD-106 ダイニングペンダント' },
    { type: 'CV', x: 0.65, z: 7.75, label: 'CV-107 TV格子間接照明' },
    { type: 'LN', x: 4.15, z: 9.15, label: 'LN-108 和紙行灯' },
  ],
  switches: [
    { x: 1.65, z: 1.42, label: 'SW1' },
    { x: 2.12, z: 3.80, label: 'SW2' },
    { x: 2.32, z: 5.38, label: 'SW3' },
  ],
  outlets: [
    { x: 0.25, z: 7.50, label: 'TV/LAN' },
    { x: 4.72, z: 6.40, label: 'IH 200V' },
    { x: 4.72, z: 4.20, label: 'REF' },
    { x: 3.25, z: 4.70, label: 'WC' },
    { x: 4.72, z: 1.80, label: '2P' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 4.40], [4.15, 4.40], [2.80, 4.40]] },
    { kind: 'water', pts: [[4.15, 4.40], [4.45, 6.75]] },
    { kind: 'drain', pts: [[2.80, 4.80], [4.15, 4.80], [4.95, 4.80]] },
    { kind: 'vent', x: 2.80, z: 3.85, label: '24h換気' },
    { kind: 'vent', x: 4.65, z: 6.00, label: 'レンジフード' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[1.10, -0.35], [1.10, 1.85], [1.70, 2.40], [1.70, 5.60], [1.90, 7.40]] },
    { kind: 'priv', pts: [[1.90, 5.65], [0.65, 5.45], [0.65, 2.65]] },
    { kind: 'work', pts: [[3.95, 6.80], [4.10, 4.60], [3.40, 2.00]] },
  ],
};

// =========================================================================
// FLOOR 2 — 2F (FL+2,750, CH 2.50m): 森の書斎・水回り/浴室・主寝室スイート
// =========================================================================
const FLOOR_2F = {
  index: 2,
  code: '2F',
  titleJp: '2階 平面詳細図',
  subtitle: '森の書斎・洗面ランドリー・1317浴室・主寝室スイート・ST1/ST2階段コア',
  baseY: 2.75,
  ceilingH: 2.50,
  slabTopY: 5.50,
  floorLabel: '2FL+2750',
  rooms: [
    {
      id: 'f2_landing', code: '2R01', floor: 2, nameJp: '2F 北階段ホール', nameEn: '2F North Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '2FL±0', ch: 'CH2500',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット無垢調フローリング',
      wallName: '織物調白クロス＋北森展望窓', tint: '#ebd9c2', labelPos: [1.15, 1.30],
      notes: '1Fからの階段上り口。北側の森を額縁状に切り取る高窓ベンチ',
    },
    {
      id: 'f2_study', code: '2R02', floor: 2, nameJp: '森の書斎・ワークスタジオ', nameEn: 'Forest Study',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '2FL±0', ch: 'CH2500',
      floorTex: 'carpet_charcoal_tile', floorName: 'チャコールタイルカーペット',
      wallName: '赤煉瓦(東)＋打放RC(北)＋コルク/有孔ボード', tint: '#dbd9d6', labelPos: [3.55, 1.80],
      notes: '静寂のリモートワーク＆読書書斎。造作デスク・有孔ボード・コルクボード',
    },
    {
      id: 'f2_gallery', code: '2R03', floor: 2, nameJp: '2F 中央ギャラリー・階段前室', nameEn: '2F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '2FL±0', ch: 'CH2450',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナットフローリング',
      wallName: '木製腰壁＋杉板RC階段壁', tint: '#eedecc', labelPos: [1.70, 4.15],
      notes: 'ST2(3Fへ)昇降前室・水回り・主寝室を結ぶ2F回遊スパイン',
    },
    {
      id: 'f2_washroom', code: '2R04', floor: 2, nameJp: '洗面脱衣・ランドリー', nameEn: 'Washroom & Laundry',
      x: 2.25, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '2FL±0', ch: 'CH2350',
      floorTex: 'terrazzo_white', floorName: '白テラゾー防水床',
      wallName: 'エメラルド光沢タイル＋白大理石造作洗面', tint: '#dcebdf', labelPos: [2.88, 4.75],
      notes: 'W900大理石カウンター洗面＋間接光鏡＋ドラム式洗濯乾燥機',
    },
    {
      id: 'f2_bath', code: '2R05', floor: 2, nameJp: '1317 森見ユニットバス', nameEn: '1317 Unit Bath',
      x: 3.60, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '2FL-20', ch: 'CH2250',
      floorTex: 'tile_blue_bath', floorName: '防滑ブルー石調バスタイル',
      wallName: '濡れ御影石パネル＋白小口タイル', tint: '#d5e4ee', labelPos: [4.22, 4.75],
      notes: '2階プライベートバスルーム。東高窓から深夜の杉木立を望む',
    },
    {
      id: 'f2_bedroom', code: '2R06', floor: 2, nameJp: '主寝室スイート', nameEn: 'Master Bedroom Suite',
      x: 0.15, z: 6.05, w: 4.70, d: 3.80, area: 17.86, jo: 11.02, fl: '2FL±0', ch: 'CH2500',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床＋ベージュラグ',
      wallName: '珪藻土ベージュ＋濃木ヘッドボード壁', tint: '#eee1cf', labelPos: [2.45, 7.90],
      notes: '11帖全幅スイート。クイーンベッド・W2050クローゼット・南樹冠パノラマ窓',
    },
  ],
  walls: [
    {
      id: 'W2_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'concrete_pcon',
      openings: [
        { id: 'W2-1', type: 'window', pos: 0.55, width: 1.15, height: 1.45, sill: 0.75, label: 'W2-1 2F北ホール窓' },
        { id: 'W2-2', type: 'window', pos: 2.80, width: 1.55, height: 1.40, sill: 0.80, label: 'W2-2 書斎北森窓' },
      ],
    },
    {
      id: 'W2_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'plaster_beige',
      openings: [
        { id: 'W2-5', type: 'window', pos: 0.50, width: 2.45, height: 1.65, sill: 0.55, label: 'W2-5 主寝室南大窓' },
        { id: 'W2-6', type: 'window', pos: 3.35, width: 1.15, height: 1.55, sill: 0.65, label: 'W2-6 主寝室東寄り窓' },
      ],
    },
    {
      id: 'W2_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_woven',
      openings: [
        { id: 'W2-3', type: 'window', pos: 5.25, width: 0.65, height: 1.35, sill: 0.85, label: 'W2-3 階段前室西窓' },
        { id: 'W2-7', type: 'window', pos: 7.20, width: 1.10, height: 1.25, sill: 0.90, label: 'W2-7 寝室西森窓' },
      ],
    },
    {
      id: 'W2_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_beige',
      openings: [
        { id: 'W2-4', type: 'window_frosted', pos: 4.25, width: 0.90, height: 0.70, sill: 1.35, label: 'W2-4 浴室高窓' },
        { id: 'W2-8', type: 'window', pos: 7.15, width: 1.05, height: 1.25, sill: 0.90, label: 'W2-8 寝室東森窓' },
      ],
    },
    { id: 'W2_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'wainscot_wood', openings: [] },
    {
      id: 'W2_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.95, kind: 'int', texA: 'wallpaper_woven', texB: 'brick_red_classic',
      openings: [
        { id: 'D2-1', type: 'door_swing', pos: 1.55, width: 0.80, height: 2.05, sill: 0, tex: 'door_oak', hinge: 'left', swingDir: 1, label: 'D2-1 書斎ドア' },
        { id: 'D2-2', type: 'door_pocket', pos: 4.10, width: 0.80, height: 2.05, sill: 0, tex: 'door_white', slideDir: -1, label: 'D2-2 洗面引戸' },
      ],
    },
    { id: 'W2_STD_S', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'brick_red_classic', texB: 'tile_emerald_gloss', openings: [] },
    {
      id: 'W2_BATH_V', axis: 'v', x1: 3.50, z1: 3.55, x2: 3.60, z2: 5.95, kind: 'int', texA: 'tile_emerald_gloss', texB: 'tile_white_small',
      openings: [
        { id: 'D2-3', type: 'door_swing', pos: 4.15, width: 0.72, height: 2.00, sill: 0, tex: 'door_glass_white', hinge: 'left', swingDir: 1, label: 'D2-3 浴室ガラス扉' },
      ],
    },
    {
      id: 'W2_BED_N', axis: 'h', x1: 0.15, z1: 5.95, x2: 4.85, z2: 6.05, kind: 'int', texA: 'wallpaper_woven', texB: 'plaster_beige',
      openings: [
        { id: 'D2-4', type: 'door_swing', pos: 1.30, width: 0.80, height: 2.10, sill: 0, tex: 'door_walnut', hinge: 'left', swingDir: 1, label: 'D2-4 主寝室ドア' },
      ],
    },
  ],
  stairUp: { id: 'ST2', label: 'UP 3Fへ (13段)', dir: 'north' },
  stairDown: { id: 'ST1', label: 'DN 1Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 1.25, label: 'DL-201 2Fホール灯' },
    { type: 'PD', x: 3.65, z: 1.65, label: 'PD-202 書斎デスク灯' },
    { type: 'DL', x: 1.70, z: 4.25, label: 'DL-203 2F廊下灯' },
    { type: 'BL', x: 2.88, z: 4.75, label: 'BL-204 洗面間接光' },
    { type: 'DL', x: 4.22, z: 4.75, label: 'DL-205 浴室防湿灯' },
    { type: 'BL', x: 1.65, z: 7.45, label: 'BL-206 寝室ベッドサイド灯' },
    { type: 'DL', x: 3.40, z: 8.20, label: 'DL-207 主寝室間接灯' },
  ],
  switches: [
    { x: 2.08, z: 1.40, label: 'SW21' },
    { x: 2.08, z: 4.00, label: 'SW22' },
    { x: 1.22, z: 6.18, label: 'SW23' },
  ],
  outlets: [
    { x: 4.72, z: 1.45, label: 'PC/LAN' },
    { x: 2.40, z: 5.55, label: 'WP洗濯' },
    { x: 4.70, z: 7.45, label: 'USB/2P' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 4.75], [4.25, 4.75], [2.88, 4.75]] },
    { kind: 'drain', pts: [[2.88, 5.45], [4.25, 5.45], [4.95, 5.45]] },
    { kind: 'vent', x: 4.22, z: 4.00, label: '浴室乾燥換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.35], [1.70, 2.00], [1.70, 5.55], [1.70, 7.20]] },
    { kind: 'priv', pts: [[1.70, 5.55], [0.65, 5.55], [0.65, 2.65]] },
    { kind: 'work', pts: [[1.70, 4.50], [2.88, 4.50], [4.10, 4.50]] },
  ],
};

// =========================================================================
// FLOOR 3 — 3F (FL+5,500, CH 2.45m): 琉球畳茶室・パウダー・樹冠展望アトリエ
// =========================================================================
const FLOOR_3F = {
  index: 3,
  code: '3F',
  titleJp: '3階 平面詳細図',
  subtitle: '琉球畳茶室客間・コバルトパウダーWC・納戸・樹冠展望アトリエバー・ST3 4F階段',
  baseY: 5.50,
  ceilingH: 2.45,
  slabTopY: 8.15,
  floorLabel: '3FL+5500',
  rooms: [
    {
      id: 'f3_landing', code: '3R01', floor: 3, nameJp: '3F 北階段ホール', nameEn: '3F North Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '白漆喰＋杉樹冠ピクチャーウィンドウ', tint: '#f0e2c9', labelPos: [1.15, 1.30],
      notes: '地上6.5mの樹冠目線ホール。北側の老杉梢を見下ろす',
    },
    {
      id: 'f3_tearoom', code: '3R02', floor: 3, nameJp: '琉球畳の茶室・客間', nameEn: 'Ryukyu Tatami Room',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳(市松敷)',
      wallName: 'セージグリーン漆喰＋バックライト和紙障子', tint: '#dce6d4', labelPos: [3.55, 1.80],
      notes: '和紙障子と簾が月光を濾す静謐な和モダン客間。ちゃぶ台＋来客布団',
    },
    {
      id: 'f3_gallery', code: '3R03', floor: 3, nameJp: '3F ギャラリー・階段前室', nameEn: '3F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '濃茶腰板＋杉板RCコア壁', tint: '#f3e7d2', labelPos: [1.70, 4.15],
      notes: 'ST3(4Fへ)昇降前室。アトリエと茶室を繋ぐ3階回廊',
    },
    {
      id: 'f3_powder', code: '3R04', floor: 3, nameJp: '3F パウダー・トイレ', nameEn: '3F Powder WC',
      x: 2.25, z: 3.55, w: 1.20, d: 2.40, area: 2.88, jo: 1.78, fl: '3FL±0', ch: 'CH2350',
      floorTex: 'tile_checker_stone', floorName: '市松ストーンタイル',
      wallName: 'コバルトモザイクタイル＋黒大理石カウンター', tint: '#d8e2ee', labelPos: [2.85, 4.75],
      notes: 'ホテルライクな3F専用パウダールーム＆トイレ。黒大理石ボウル洗面',
    },
    {
      id: 'f3_archive', code: '3R05', floor: 3, nameJp: '樹冠アーカイブ納戸', nameEn: 'Archive Closet',
      x: 3.55, z: 3.55, w: 1.30, d: 2.40, area: 3.12, jo: 1.93, fl: '3FL±0', ch: 'CH2350',
      floorTex: 'parquet_oak', floorName: 'オークパーケット',
      wallName: 'スレートブルーパネル＋有孔収納壁', tint: '#dee3ea', labelPos: [4.20, 4.75],
      notes: '季節衣類・画材・蔵書の大容量ウォークイン納戸',
    },
    {
      id: 'f3_atelier', code: '3R06', floor: 3, nameJp: '樹冠展望アトリエ・バーラウンジ', nameEn: 'Treetop Atelier Lounge',
      x: 0.15, z: 6.05, w: 4.70, d: 3.80, area: 17.86, jo: 11.02, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '古赤黒煉瓦(西)＋黒大理石バーカウンター', tint: '#efe0c8', labelPos: [2.45, 7.90],
      notes: '地上7mの老杉の梢に浮かぶ展望ラウンジ＆バー。真鍮メッシュペンダント灯',
    },
  ],
  walls: [
    {
      id: 'W3_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'plaster_sage',
      openings: [
        { id: 'W3-1', type: 'window', pos: 0.55, width: 1.15, height: 1.45, sill: 0.72, label: 'W3-1 3F北展望窓' },
        { id: 'W3-2', type: 'window', pos: 2.80, width: 1.55, height: 1.35, sill: 0.78, label: 'W3-2 茶室障子北窓' },
      ],
    },
    {
      id: 'W3_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'W3-4', type: 'window', pos: 0.45, width: 2.55, height: 1.72, sill: 0.48, label: 'W3-4 樹冠パノラマ大窓' },
        { id: 'W3-5', type: 'window', pos: 3.35, width: 1.25, height: 1.65, sill: 0.52, label: 'W3-5 アトリエ南東窓' },
      ],
    },
    {
      id: 'W3_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'brick_aged_dark',
      openings: [
        { id: 'W3-3', type: 'window', pos: 5.25, width: 0.65, height: 1.35, sill: 0.80, label: 'W3-3 3F階段前室窓' },
        { id: 'W3-6', type: 'window', pos: 7.15, width: 1.25, height: 1.35, sill: 0.80, label: 'W3-6 アトリエ西樹冠窓' },
      ],
    },
    {
      id: 'W3_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_sage',
      openings: [
        { id: 'W3-7', type: 'window', pos: 7.15, width: 1.20, height: 1.35, sill: 0.80, label: 'W3-7 アトリエ東樹冠窓' },
      ],
    },
    { id: 'W3_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'wainscot_rustic', openings: [] },
    {
      id: 'W3_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.95, kind: 'int', texA: 'wallpaper_white', texB: 'plaster_sage',
      openings: [
        { id: 'D3-1', type: 'door_pocket', pos: 1.55, width: 0.85, height: 2.05, sill: 0, tex: 'shoji_grid', slideDir: -1, label: 'D3-1 茶室障子引戸' },
        { id: 'D3-2', type: 'door_pocket', pos: 4.05, width: 0.75, height: 2.05, sill: 0, tex: 'door_white', slideDir: -1, label: 'D3-2 3Fパウダー引戸' },
      ],
    },
    { id: 'W3_TEA_S', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'plaster_sage', texB: 'tile_cobalt_mosaic', openings: [] },
    { id: 'W3_POW_E', axis: 'v', x1: 3.45, z1: 3.55, x2: 3.55, z2: 5.95, kind: 'int', texA: 'tile_cobalt_mosaic', texB: 'panel_slate_blue', openings: [] },
    {
      id: 'W3_AT_N', axis: 'h', x1: 0.15, z1: 5.95, x2: 4.85, z2: 6.05, kind: 'int', texA: 'wallpaper_white', texB: 'brick_aged_dark',
      openings: [
        { id: 'D3-3', type: 'door_swing', pos: 1.30, width: 0.80, height: 2.10, sill: 0, tex: 'door_glass_white', hinge: 'left', swingDir: 1, label: 'D3-3 アトリエガラス扉' },
        { id: 'D3-4', type: 'door_pocket', pos: 3.80, width: 0.75, height: 2.05, sill: 0, tex: 'door_oak', slideDir: -1, label: 'D3-4 納戸引戸' },
      ],
    },
  ],
  stairUp: { id: 'ST3', label: 'UP 4Fへ (13段)', dir: 'north' },
  stairDown: { id: 'ST2', label: 'DN 2Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 1.25, label: 'DL-301 3Fホール灯' },
    { type: 'LN', x: 3.55, z: 1.80, label: 'LN-302 茶室和紙照明' },
    { type: 'DL', x: 1.70, z: 4.25, label: 'DL-303 3F回廊灯' },
    { type: 'BL', x: 2.85, z: 4.75, label: 'BL-304 パウダー鏡灯' },
    { type: 'PD', x: 3.65, z: 7.15, label: 'PD-305 真鍮バーペンダント' },
    { type: 'CV', x: 1.45, z: 8.20, label: 'CV-306 展望ラウンジ間接灯' },
  ],
  switches: [
    { x: 2.08, z: 1.42, label: 'SW31' },
    { x: 2.08, z: 3.90, label: 'SW32' },
    { x: 1.22, z: 6.18, label: 'SW33' },
  ],
  outlets: [
    { x: 4.70, z: 1.50, label: '茶室2P' },
    { x: 2.35, z: 4.80, label: 'WC/洗面' },
    { x: 4.70, z: 7.20, label: 'BAR 2P' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 4.75], [2.85, 4.75]] },
    { kind: 'drain', pts: [[2.85, 5.25], [4.95, 5.25]] },
    { kind: 'vent', x: 2.85, z: 3.85, label: '24h換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.35], [1.70, 2.00], [1.70, 5.55], [1.70, 7.35]] },
    { kind: 'priv', pts: [[1.70, 5.55], [0.65, 5.55], [0.65, 2.65]] },
    { kind: 'work', pts: [[1.70, 2.00], [3.40, 2.00]] },
  ],
};

// =========================================================================
// FLOOR 4 — 4F (4FL+8,150, CH 2.15m 少し低めのデザイナーズ天井):
// プロデザイナー監修「5部屋（有効室効率77.4%）＋ 1m×2m 樹冠バルコニー」
// 全引戸採用によるデッドスペースゼロ設計＋対角視線抜け
// =========================================================================
const FLOOR_4F = {
  index: 4,
  code: '4F',
  titleJp: '4階 平面詳細図（プロ監修5室＋1×2mバルコニー）',
  subtitle: '少し低めの水平強調天井(CH2,150)・全引戸で居室面積最大化の5室構成＋南東1,000×2,000mm樹冠バルコニー',
  baseY: 8.15,
  ceilingH: 2.15,
  slabTopY: 10.50,
  floorLabel: '4FL+8150',
  hasBalcony: true,
  rooms: [
    {
      id: 'f4_listening', code: '4R01', floor: 4, nameJp: '① 北西・リスニング＆シネマ室', nameEn: 'NW Listening Room',
      x: 0.15, z: 0.15, w: 2.00, d: 1.40, area: 2.80, jo: 1.73, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'carpet_charcoal_tile', floorName: '吸音チャコールカーペット',
      wallName: '木縦格子吸音壁＋白漆喰＋ガラス引戸', tint: '#dcdad5', labelPos: [1.15, 0.85],
      notes: '低天井2,150mmの籠もり感を活かした専用音響リスニング＆ミニシアター室（引戸で廊下死角ゼロ）',
    },
    {
      id: 'f4_guest', code: '4R02', floor: 4, nameJp: '② 北東・ミニマルゲスト寝室', nameEn: 'NE Minimal Guest Bedroom',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'wood_floor', floorName: 'ライトオーク複合フローリング',
      wallName: 'トラバーチン調石壁＋白織物クロス', tint: '#f2e8d9', labelPos: [3.55, 1.80],
      notes: 'ローベッドと壁埋込収納で2,150mm天井でも圧迫感ゼロ。北樹冠パノラマ窓',
    },
    {
      id: 'f4_dressing', code: '4R03', floor: 4, nameJp: '③ 東中・ドレス＆パウダースタジオ', nameEn: 'Dressing & Vanity Studio',
      x: 2.25, z: 3.55, w: 2.60, d: 2.40, area: 6.24, jo: 3.85, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '白縦パネル＋間接照明大型ミラー＋造作ワードローブ', tint: '#ece6dc', labelPos: [3.55, 4.75],
      notes: 'ホテルスイート級ウォークインドレス室。全壁面を薄型造作棚にして中央動線を最大化',
    },
    {
      id: 'f4_library', code: '4R04', floor: 4, nameJp: '④ 南西・樹冠ライブラリー＆書斎', nameEn: 'SW Treetop Library',
      x: 0.15, z: 6.05, w: 2.25, d: 3.80, area: 8.55, jo: 5.28, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床',
      wallName: '壁面フル造作書棚＋木腰板＋コーナーデスク', tint: '#e8dccb', labelPos: [1.28, 7.90],
      notes: '南東ラウンジと大開口ガラス引戸(D4-5)で連続させ、実面積以上の広がりを生むデザイナーズ書斎',
    },
    {
      id: 'f4_skylounge', code: '4R05', floor: 4, nameJp: '⑤ 南東・スカイラウンジ', nameEn: 'SE Sky Lounge',
      x: 2.50, z: 6.05, w: 2.35, d: 3.80, area: 8.93, jo: 5.51, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'wood_floor', floorName: 'ライトオーク＋ベージュラグ',
      wallName: 'トラバーチン＋クリーム煉瓦＋バルコニー大開口', tint: '#f5ead6', labelPos: [3.68, 7.90],
      notes: '地上9mの樹冠スカイラウンジ。南側ガラス引戸(D4-6)から1m×2mバルコニーへそのまま出られる特等室',
    },
    {
      id: 'f4_gallery', code: '4R06', floor: 4, nameJp: '4F 中央コンパクトギャラリー', nameEn: '4F Compact Spine',
      x: 1.25, z: 1.55, w: 0.90, d: 4.40, area: 4.86, jo: 3.00, fl: '4FL±0', ch: 'CH2150',
      floorTex: 'wood_floor', floorName: 'ライトオークフローリング',
      wallName: '白漆喰＋杉板RC階段壁（最小幅900mm集中動線）', tint: '#f4ece0', labelPos: [1.70, 3.85],
      notes: '廊下を最小幅900mmに集約し、全5室の床面積を極大化（居室効率77.4%）',
    },
    {
      id: 'f4_balcony', code: '4R07', floor: 4, nameJp: '4F 樹冠バルコニー (1m×2m)', nameEn: '1m×2m Canopy Balcony',
      x: 2.65, z: 10.00, w: 2.00, d: 1.00, area: 2.00, jo: 1.23, fl: '4FL-40', ch: '屋外開放',
      floorTex: 'wood_deck', floorName: '耐候ウッドデッキ張',
      wallName: '黒アイアン＋強化ガラス手摺 H1,100', tint: '#e4d5be', labelPos: [3.65, 10.50],
      notes: 'W2,000×D1,000mm（1m×2m）の片持ち樹冠バルコニー。地上9mで老杉の梢と深夜の風を直に体感',
    },
  ],
  walls: [
    {
      id: 'W4F_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'W4F-1', type: 'window', pos: 0.55, width: 1.15, height: 1.15, sill: 0.78, label: 'W4F-1 リスニング北窓' },
        { id: 'W4F-2', type: 'window', pos: 2.80, width: 1.55, height: 1.20, sill: 0.72, label: 'W4F-2 ゲスト寝室北窓' },
      ],
    },
    {
      id: 'W4F_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'travertine',
      openings: [
        { id: 'W4F-5', type: 'window', pos: 0.45, width: 1.65, height: 1.38, sill: 0.55, label: 'W4F-5 ライブラリー南窓' },
        { id: 'D4-6', type: 'door_pocket', pos: 3.15, width: 1.05, height: 1.98, sill: 0.0, tex: 'door_glass_white', slideDir: -1, label: 'D4-6 バルコニー掃出引戸' },
      ],
    },
    {
      id: 'W4F_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_white',
      openings: [
        { id: 'W4F-3', type: 'window', pos: 5.25, width: 0.65, height: 1.18, sill: 0.75, label: 'W4F-3 階段前室西窓' },
        { id: 'W4F-4', type: 'window', pos: 7.20, width: 1.25, height: 1.22, sill: 0.72, label: 'W4F-4 書斎西樹冠窓' },
      ],
    },
    {
      id: 'W4F_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'brick_cream',
      openings: [
        { id: 'W4F-6', type: 'window', pos: 4.35, width: 0.85, height: 1.12, sill: 0.80, label: 'W4F-6 ドレス室東窓' },
        { id: 'W4F-7', type: 'window', pos: 7.20, width: 1.25, height: 1.25, sill: 0.70, label: 'W4F-7 ラウンジ東樹冠窓' },
      ],
    },
    // Interior Walls — ALL Pocket Doors (Zero Swing Dead Space!)
    { id: 'W4F_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'wallpaper_white', openings: [] },
    {
      id: 'W4F_NW_S', axis: 'h', x1: 0.15, z1: 1.50, x2: 2.15, z2: 1.60, kind: 'int', texA: 'wood_slats', texB: 'wallpaper_white',
      openings: [
        { id: 'D4-1', type: 'door_pocket', pos: 1.28, width: 0.78, height: 1.96, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'D4-1 リスニング室引戸' },
      ],
    },
    {
      id: 'W4F_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.95, kind: 'int', texA: 'wallpaper_white', texB: 'travertine',
      openings: [
        { id: 'D4-2', type: 'door_pocket', pos: 1.68, width: 0.76, height: 1.96, sill: 0, tex: 'door_oak', slideDir: 1, label: 'D4-2 ゲスト寝室引戸' },
        { id: 'D4-3', type: 'door_pocket', pos: 4.20, width: 0.76, height: 1.96, sill: 0, tex: 'door_white', slideDir: -1, label: 'D4-3 ドレス室引戸' },
      ],
    },
    { id: 'W4F_E_DIV', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'travertine', texB: 'panel_white_vert', openings: [] },
    {
      id: 'W4F_S_N', axis: 'h', x1: 0.15, z1: 5.95, x2: 4.85, z2: 6.05, kind: 'int', texA: 'wallpaper_white', texB: 'travertine',
      openings: [
        { id: 'D4-4', type: 'door_pocket', pos: 1.30, width: 0.80, height: 1.96, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'D4-4 ライブラリー引戸' },
      ],
    },
    {
      id: 'W4F_S_MID', axis: 'v', x1: 2.40, z1: 6.05, x2: 2.50, z2: 9.85, kind: 'int', texA: 'wainscot_wood', texB: 'travertine',
      openings: [
        { id: 'D4-5', type: 'door_pocket', pos: 6.32, width: 0.92, height: 1.98, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'D4-5 スカイラウンジ引戸' },
      ],
    },
  ],
  stairUp: { id: 'ST4', label: 'UP 5Fへ (13段)', dir: 'north' },
  stairDown: { id: 'ST3', label: 'DN 3Fへ', dir: 'south' },
  lighting: [
    { type: 'CV', x: 1.15, z: 0.85, label: 'CV-401 リスニング間接灯' },
    { type: 'DL', x: 3.55, z: 1.80, label: 'DL-402 ゲスト寝室灯' },
    { type: 'BL', x: 3.55, z: 4.75, label: 'BL-403 ドレス鏡灯' },
    { type: 'DL', x: 1.28, z: 7.90, label: 'DL-404 ライブラリー灯' },
    { type: 'PD', x: 3.68, z: 7.90, label: 'PD-405 ラウンジ低天井灯' },
    { type: 'BL', x: 3.65, z: 10.15, label: 'BL-406 バルコニー防雨灯' },
  ],
  switches: [
    { x: 1.24, z: 1.68, label: 'SW401' },
    { x: 2.08, z: 4.10, label: 'SW402' },
    { x: 2.58, z: 9.72, label: 'SW403' },
  ],
  outlets: [
    { x: 0.25, z: 0.85, label: 'AV/LAN' },
    { x: 4.70, z: 1.80, label: 'USB/2P' },
    { x: 0.25, z: 8.50, label: 'PC 2P' },
    { x: 4.55, z: 10.05, label: 'WP屋外' },
  ],
  plumbing: [
    { kind: 'drain', pts: [[2.75, 10.85], [4.55, 10.85]] },
    { kind: 'vent', x: 3.55, z: 3.85, label: '24h換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.35], [1.70, 2.05], [1.70, 5.55], [1.70, 7.00], [3.65, 7.00], [3.65, 10.45]] },
    { kind: 'priv', pts: [[1.70, 5.55], [0.65, 5.55], [0.65, 2.65]] },
    { kind: 'work', pts: [[1.70, 2.05], [3.20, 2.05]] },
  ],
};

// =========================================================================
// FLOOR 5 — 5F (5FL+10,500, CH 2.55m 圧縮→解放の樹冠スパ・温室・設計工房階):
// 縦配管シャフト直上配置の檜フィンランドサウナ＆展望風呂＋建築模型設計室＋
// ボタニカル温室薬草ラボ＋西・樹冠外気浴デッキ(1.0m×2.6m)
// =========================================================================
const FLOOR_5F = {
  index: 5,
  code: '5F',
  titleJp: '5階 平面詳細図（建築模型工房・檜サウナ展望風呂・ボタニカル温室＋西外気浴デッキ）',
  subtitle: '4F低天井(CH2,150)からの解放空間(CH2,550)・設備縦PS直上のサウナ＆展望浴・1.0×2.6m西樹冠外気浴デッキ',
  baseY: 10.50,
  ceilingH: 2.55,
  slabTopY: 13.25,
  floorLabel: '5FL+10500',
  hasBalcony5F: true,
  rooms: [
    {
      id: 'f5_landing', code: '5R01', floor: 5, nameJp: '5F 北植栽ギャラリー・階段ホール', nameEn: '5F Botanical Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '5FL±0', ch: 'CH2550',
      floorTex: 'terrazzo_white', floorName: '白テラゾー石調床',
      wallName: '白漆喰＋杉板RC耐震コア＋造作植栽ベンチ', tint: '#eceae4', labelPos: [1.15, 1.30],
      notes: '地上11.5mの樹冠目線ホール。北窓沿い造作プランターベンチと盆栽・シダ植栽ギャラリー',
    },
    {
      id: 'f5_studio', code: '5R02', floor: 5, nameJp: '北東・建築設計アトリエ＆模型工房', nameEn: 'Architect Model Studio',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '5FL±0', ch: 'CH2550',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: 'Pコン打放RC＋有孔工具壁＋素材サンプルボード', tint: '#efe5d6', labelPos: [3.55, 1.80],
      notes: '傾斜製図台（T定規・真鍮デスク灯[E]点灯可）・本邸1/50精密建築模型展示台・図面フラットケース・図面筒ラック完備',
    },
    {
      id: 'f5_sauna', code: '5R03', floor: 5, nameJp: '東中・檜フィンランドドライサウナ', nameEn: 'Hinoki Finnish Sauna',
      x: 2.25, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '5FL±0', ch: 'CH2300',
      floorTex: 'wood_deck', floorName: '檜スノコ防水デッキ',
      wallName: '檜縦羽目板＋赤熱サウナストーブ＋2段ベンチ', tint: '#ebd8bd', labelPos: [2.88, 4.75],
      notes: 'ロウリュ用赤熱火山石ストーブ・桶＆柄杓・砂時計・温湿度計・間接光付2段檜ベンチ。直結ガラス引戸で展望浴室へ',
    },
    {
      id: 'f5_skybath', code: '5R04', floor: 5, nameJp: '東中・樹冠露天風 檜＆御影石スパ浴室', nameEn: 'Canopy Hinoki Sky Bath',
      x: 3.60, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '5FL-20', ch: 'CH2350',
      floorTex: 'stone_wet_granite', floorName: '防滑黒御影石タイル',
      wallName: '濡れ黒御影石＋エメラルド艶タイル＋東樹冠展望窓', tint: '#d3e4e7', labelPos: [4.22, 4.75],
      notes: '1F〜3F設備縦シャフト直上の地上11m展望風呂。檜縁深型浴槽・真鍮吐水口・レインシャワー・檜風呂椅子＆湯桶',
    },
    {
      id: 'f5_conservatory', code: '5R05', floor: 5, nameJp: '南・樹冠ボタニカル温室＆薬草茶ラボ', nameEn: 'Botanical Conservatory & Tea Lab',
      x: 0.15, z: 6.05, w: 4.70, d: 3.80, area: 17.86, jo: 11.02, fl: '5FL±0', ch: 'CH2550',
      floorTex: 'terrazzo_emerald', floorName: 'エメラルドテラゾー(東)＋オーク床(西)',
      wallName: '緑化モスウォール(東)＋珪藻土＋天井ウォールナット梁', tint: '#dfebe1', labelPos: [2.55, 7.80],
      notes: '3段LED植物育成ラック・薬草調合大理石カウンター（乳鉢/標本瓶/銅ジョウロ）・外気浴リクライナー・和紙フロア灯[E]・西外気浴デッキ直結',
    },
    {
      id: 'f5_gallery', code: '5R06', floor: 5, nameJp: '5F 中央ギャラリー・階段前室', nameEn: '5F Gallery Spine',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '5FL±0', ch: 'CH2550',
      floorTex: 'terrazzo_white', floorName: '白テラゾー石調床',
      wallName: '杉板RC耐震コア壁＋消火器ニッチ＋真鍮階数プレート', tint: '#f0eee8', labelPos: [1.70, 4.15],
      notes: 'ST5(6F天空階へ)昇降前室。サウナ・工房・温室を最短で結ぶ5Fスパイン',
    },
    {
      id: 'f5_westdeck', code: '5R07', floor: 5, nameJp: '5F 西・樹冠外気浴スパデッキ (1.0×2.6m)', nameEn: 'West Canopy Spa Deck',
      x: -1.00, z: 6.20, w: 1.00, d: 2.60, area: 2.60, jo: 1.60, fl: '5FL-40', ch: '屋外開放',
      floorTex: 'wood_deck', floorName: '耐候レッドシダーデッキ',
      wallName: '片持ちH鋼ブラケット＋強化ガラス手摺 H1,100', tint: '#e4d5be', labelPos: [-0.50, 7.50],
      notes: '隣棟屋根軒先より1.2m上空に張り出すW1,000×D2,600mm西側外気浴デッキ。サウナ後の整いベンチ＆ランタン完備',
    },
  ],
  walls: [
    {
      id: 'W5F_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'concrete_pcon',
      openings: [
        { id: 'W5-1', type: 'window', pos: 0.50, width: 1.25, height: 1.50, sill: 0.72, label: 'W5-1 5F北植栽ホール窓' },
        { id: 'W5-2', type: 'window', pos: 2.75, width: 1.65, height: 1.48, sill: 0.78, label: 'W5-2 設計工房北パノラマ窓' },
      ],
    },
    {
      id: 'W5F_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'plaster_beige',
      openings: [
        { id: 'W5-6', type: 'window', pos: 0.45, width: 2.10, height: 1.85, sill: 0.45, label: 'W5-6 温室南西パノラマ大窓' },
        { id: 'W5-7', type: 'window', pos: 2.95, width: 1.60, height: 1.85, sill: 0.45, label: 'W5-7 温室南東樹冠大窓' },
      ],
    },
    {
      id: 'W5F_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_beige',
      openings: [
        { id: 'W5-3', type: 'window', pos: 5.25, width: 0.65, height: 1.40, sill: 0.80, label: 'W5-3 5F階段前室西窓' },
        { id: 'D5-5', type: 'door_pocket', pos: 6.95, width: 1.05, height: 2.10, sill: 0.0, tex: 'door_glass_white', slideDir: 1, label: 'D5-5 西外気浴デッキ引戸' },
      ],
    },
    {
      id: 'W5F_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_sage',
      openings: [
        { id: 'W5-8', type: 'window', pos: 0.85, width: 1.15, height: 1.35, sill: 0.82, label: 'W5-8 設計工房東森窓' },
        { id: 'W5-5', type: 'window', pos: 4.15, width: 1.20, height: 1.05, sill: 1.10, label: 'W5-5 檜展望風呂東窓' },
        { id: 'W5-9', type: 'window', pos: 7.45, width: 1.15, height: 1.25, sill: 0.95, label: 'W5-9 薬草カウンター東窓' },
      ],
    },
    { id: 'W5F_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_cedar_form', openings: [] },
    {
      id: 'W5F_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.95, kind: 'int', texA: 'shikkui_white', texB: 'plaster_sage',
      openings: [
        { id: 'D5-1', type: 'door_pocket', pos: 1.45, width: 0.82, height: 2.10, sill: 0, tex: 'door_oak', slideDir: -1, label: 'D5-1 建築設計工房引戸' },
        { id: 'D5-2', type: 'door_pocket', pos: 4.10, width: 0.80, height: 2.05, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'D5-2 檜サウナガラス引戸' },
      ],
    },
    { id: 'W5F_STD_S', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'plaster_sage', texB: 'wood_slats', openings: [] },
    {
      id: 'W5F_SPA_V', axis: 'v', x1: 3.50, z1: 3.55, x2: 3.60, z2: 5.95, kind: 'int', texA: 'wood_slats', texB: 'tile_emerald_gloss',
      openings: [
        { id: 'D5-3', type: 'door_pocket', pos: 4.10, width: 0.74, height: 2.02, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'D5-3 展望浴室ガラス引戸' },
      ],
    },
    {
      id: 'W5F_CON_N', axis: 'h', x1: 0.15, z1: 5.95, x2: 4.85, z2: 6.05, kind: 'int', texA: 'shikkui_white', texB: 'plaster_beige',
      openings: [
        { id: 'D5-4', type: 'door_pocket', pos: 1.30, width: 0.84, height: 2.12, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'D5-4 ボタニカル温室引戸' },
      ],
    },
  ],
  stairUp: { id: 'ST5', label: 'UP 6Fへ (13段)', dir: 'north' },
  stairDown: { id: 'ST4', label: 'DN 4Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 1.30, label: 'DL-501 5F植栽ホール灯' },
    { type: 'PD', x: 3.65, z: 0.75, label: 'PD-502 製図デスク真鍮灯' },
    { type: 'CV', x: 2.88, z: 4.95, label: 'CV-503 サウナ間接灯' },
    { type: 'DL', x: 4.22, z: 4.75, label: 'DL-504 檜展望風呂防湿灯' },
    { type: 'CV', x: 3.75, z: 6.38, label: 'CV-505 植物育成フルスペクトルLED' },
    { type: 'LN', x: 0.55, z: 9.45, label: 'LN-506 温室和紙フロア灯' },
    { type: 'BL', x: -0.25, z: 7.50, label: 'BL-507 西デッキ防雨灯' },
  ],
  switches: [
    { x: 2.08, z: 1.35, label: 'SW501' },
    { x: 2.08, z: 4.00, label: 'SW502' },
    { x: 1.22, z: 6.18, label: 'SW503' },
  ],
  outlets: [
    { x: 4.70, z: 0.65, label: '製図/PC 2P' },
    { x: 3.15, z: 3.65, label: 'SAUNA 200V' },
    { x: 4.70, z: 6.35, label: '育成LED 2P' },
    { x: 4.70, z: 8.15, label: 'WP茶ラボ' },
    { x: -0.05, z: 8.45, label: 'WP屋外' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 4.75], [4.22, 4.75], [4.45, 7.80]] },
    { kind: 'drain', pts: [[2.88, 5.45], [4.22, 5.45], [4.95, 5.45]] },
    { kind: 'drain', pts: [[-0.85, 6.35], [-0.85, 8.65]] },
    { kind: 'vent', x: 4.22, z: 3.90, label: 'サウナ/浴乾燥換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.35], [1.70, 2.00], [1.70, 5.55], [1.70, 7.45], [-0.45, 7.45]] },
    { kind: 'priv', pts: [[1.70, 5.55], [0.65, 5.55], [0.65, 2.65]] },
    { kind: 'work', pts: [[1.70, 4.50], [2.88, 4.50], [4.15, 4.50]] },
  ],
};

// =========================================================================
// FLOOR 6 — 6F (6FL+13,250, CH 2.65m 最高層ペントハウス＆森林展望天文階):
// 星図ギャラリー・星見琉球畳アルコーブ・6F天空パウダーWC・ワイン＆珈琲セラー・
// 赤道儀天体望遠鏡＆吊り暖炉＆エスプレッソバー展望サロン＋南全幅スカイテラス(4.6×1.1m)
// =========================================================================
const FLOOR_6F = {
  index: 6,
  code: '6F',
  titleJp: '6階 平面詳細図（天空ペントハウス・赤道儀天文サロン・エスプレッソバー＋全幅スカイテラス）',
  subtitle: '最高層パノラマ高天井(CH2,650・SRC複合梁現し)・星見畳寝室・ワイン珈琲セラー・4.6×1.1m全幅スカイテラス',
  baseY: 13.25,
  ceilingH: 2.65,
  slabTopY: 16.10,
  floorLabel: '6FL+13250',
  hasBalcony6F: true,
  rooms: [
    {
      id: 'f6_landing', code: '6R01', floor: 6, nameJp: '6F 北・星図ギャラリー＆階段ホール', nameEn: '6F Star-Chart Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '6FL±0', ch: 'CH2650',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット無垢調床',
      wallName: 'スレートブルーパネル＋白漆喰＋星図コンソール', tint: '#e4ded6', labelPos: [1.15, 1.30],
      notes: '地上14mの天空ホール。北側パノラマ窓と双眼鏡・星図コンソール・6F真鍮階数プレート',
    },
    {
      id: 'f6_staralcove', code: '6R02', floor: 6, nameJp: '北東・星見琉球畳アルコーブ＆瞑想寝室', nameEn: 'NE Starlight Tatami Alcove',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '6FL±0', ch: 'CH2650',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳＋ウォールナット板の間縁',
      wallName: 'セージ漆喰＋濃木格子＋床の間ニッチ＋北東2面樹冠窓', tint: '#dce5d6', labelPos: [3.55, 1.80],
      notes: '北東コーナー大窓沿いの天空デイベッド・文机（茶碗/香炉/開本）・床の間生け花ニッチを備えた静謐な最上階和室',
    },
    {
      id: 'f6_powder', code: '6R03', floor: 6, nameJp: '6F 天空パウダールーム＆WC', nameEn: '6F Sky Powder WC',
      x: 2.25, z: 3.55, w: 1.20, d: 2.40, area: 2.88, jo: 1.78, fl: '6FL±0', ch: 'CH2400',
      floorTex: 'marble_black', floorName: '黒大理石ポリッシュタイル',
      wallName: 'トラバーチン＋コバルトモザイク＋間接照明楕円ミラー', tint: '#d9dfe8', labelPos: [2.85, 4.75],
      notes: 'B1F〜6F連続縦配管シャフト頂部の最上階ホテルライク・パウダールーム。黒大理石フロート洗面＆真鍮水栓',
    },
    {
      id: 'f6_cellar', code: '6R04', floor: 6, nameJp: 'ワイン＆自家焙煎珈琲セラー室', nameEn: 'Wine & Coffee Cellar',
      x: 3.55, z: 3.55, w: 1.30, d: 2.40, area: 3.12, jo: 1.93, fl: '6FL±0', ch: 'CH2400',
      floorTex: 'tile_checker_stone', floorName: '市松ストーンタイル',
      wallName: '古暗煉瓦＋ウォールナットボトル格子棚＋ワインセラー', tint: '#e4ddd5', labelPos: [4.20, 4.75],
      notes: 'サロン直結の専用ワイン＆珈琲豆貯蔵庫。3Dワインボトル格子棚・ガラス低温ワインクーラー・焙煎キャニスター',
    },
    {
      id: 'f6_observatory', code: '6R05', floor: 6, nameJp: '南・天空パノラマ天文サロン＆エスプレッソバー', nameEn: 'Crown Observatory Salon & Espresso Bar',
      x: 0.15, z: 6.05, w: 4.70, d: 3.80, area: 17.86, jo: 11.02, fl: '6FL±0', ch: 'CH2650',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床＋大判サロンラグ',
      wallName: '黒大理石＋白漆喰＋SRC複合天井化粧梁＋3面パノラマ窓', tint: '#f1e6d5', labelPos: [2.35, 7.65],
      notes: '本邸の頂点空間。真鍮赤道儀天体望遠鏡・吊り下げモダン暖炉[E]・イタリア製デュアルボイラーエスプレッソバー・LPレコードターンテーブル',
    },
    {
      id: 'f6_gallery', code: '6R06', floor: 6, nameJp: '6F 中央ギャラリー・屋根裏階段前室', nameEn: '6F Crown Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '6FL±0', ch: 'CH2650',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット無垢調床',
      wallName: '杉板RC耐震コア壁＋コートニッチ＋ST6屋根裏階段口', tint: '#ece3d5', labelPos: [1.70, 4.15],
      notes: 'ST6(屋根裏部屋 RF+16,100へ)最終昇降口。ギャラリー照明と消火器収納を一体化',
    },
    {
      id: 'f6_skyterrace', code: '6R07', floor: 6, nameJp: '6F 南・全幅スカイ展望テラス (4.6×1.1m)', nameEn: 'Full-Width South Sky Terrace',
      x: 0.20, z: 10.00, w: 4.60, d: 1.10, area: 5.06, jo: 3.12, fl: '6FL-40', ch: 'パーゴラ開放',
      floorTex: 'wood_deck', floorName: '耐候レッドシダーデッキ',
      wallName: '片持ちH鋼＋強化ガラス手摺 H1,100＋上部木鉄パーゴラ', tint: '#e4d5be', labelPos: [2.50, 10.55],
      notes: '地上14m・幅4,600×奥行1,100mmの全幅クラウン展望テラス。双眼鏡ポスト・大理石カフェ卓＆ランタン・常緑プランター・月光ルーバーパーゴラ',
    },
  ],
  walls: [
    {
      id: 'W6F_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'panel_slate_blue',
      openings: [
        { id: 'W6-1', type: 'window', pos: 0.50, width: 1.25, height: 1.60, sill: 0.72, label: 'W6-1 6F北星図パノラマ窓' },
        { id: 'W6-2', type: 'window', pos: 2.75, width: 1.65, height: 1.55, sill: 0.75, label: 'W6-2 星見畳アルコーブ北窓' },
      ],
    },
    {
      id: 'W6F_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'shikkui_white',
      openings: [
        { id: 'W6-7', type: 'window', pos: 0.40, width: 2.00, height: 2.15, sill: 0.25, label: 'W6-7 天文パノラマフルハイト窓' },
        { id: 'D6-5', type: 'door_pocket', pos: 2.60, width: 1.10, height: 2.20, sill: 0.0, tex: 'door_glass_white', slideDir: 1, label: 'D6-5 全幅スカイテラス引戸' },
      ],
    },
    {
      id: 'W6F_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'shikkui_white',
      openings: [
        { id: 'W6-3', type: 'window', pos: 5.25, width: 0.65, height: 1.50, sill: 0.78, label: 'W6-3 6F階段前室西窓' },
        { id: 'W6-5', type: 'window', pos: 6.80, width: 1.85, height: 1.65, sill: 0.68, label: 'W6-5 天文サロン西樹冠大窓' },
      ],
    },
    {
      id: 'W6F_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_sage',
      openings: [
        { id: 'W6-8', type: 'window', pos: 0.70, width: 1.35, height: 1.50, sill: 0.75, label: 'W6-8 星見畳アルコーブ東窓' },
        { id: 'W6-4', type: 'window_frosted', pos: 4.35, width: 0.75, height: 0.65, sill: 1.55, label: 'W6-4 ワインセラー高窓' },
        { id: 'W6-6', type: 'window', pos: 7.00, width: 1.65, height: 1.55, sill: 0.85, label: 'W6-6 エスプレッソバー東窓' },
      ],
    },
    { id: 'W6F_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_cedar_form', openings: [] },
    {
      id: 'W6F_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 5.95, kind: 'int', texA: 'shikkui_white', texB: 'plaster_sage',
      openings: [
        { id: 'D6-1', type: 'door_pocket', pos: 1.45, width: 0.82, height: 2.12, sill: 0, tex: 'shoji_grid', slideDir: -1, label: 'D6-1 星見畳室障子引戸' },
        { id: 'D6-2', type: 'door_pocket', pos: 4.05, width: 0.76, height: 2.10, sill: 0, tex: 'door_walnut', slideDir: 1, label: 'D6-2 6Fパウダー引戸' },
      ],
    },
    { id: 'W6F_NE_S', axis: 'h', x1: 2.25, z1: 3.45, x2: 4.85, z2: 3.55, kind: 'int', texA: 'plaster_sage', texB: 'travertine', openings: [] },
    { id: 'W6F_POW_E', axis: 'v', x1: 3.45, z1: 3.55, x2: 3.55, z2: 5.95, kind: 'int', texA: 'tile_cobalt_mosaic', texB: 'brick_aged_dark', openings: [] },
    {
      id: 'W6F_SAL_N', axis: 'h', x1: 0.15, z1: 5.95, x2: 4.85, z2: 6.05, kind: 'int', texA: 'shikkui_white', texB: 'marble_black',
      openings: [
        { id: 'D6-4', type: 'door_pocket', pos: 1.30, width: 0.84, height: 2.16, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'D6-4 天文サロンガラス引戸' },
        { id: 'D6-3', type: 'door_pocket', pos: 3.78, width: 0.78, height: 2.12, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'D6-3 ワインセラー引戸' },
      ],
    },
  ],
  stairUp: { id: 'ST6', label: 'UP 屋根裏へ (13段)', dir: 'north' },
  stairDown: { id: 'ST5', label: 'DN 5Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 1.30, label: 'DL-601 6F星図ホール灯' },
    { type: 'LN', x: 3.55, z: 2.25, label: 'LN-602 星見畳床の間灯' },
    { type: 'BL', x: 2.85, z: 4.25, label: 'BL-603 天空楕円ミラー灯' },
    { type: 'DL', x: 4.15, z: 4.75, label: 'DL-604 セラー間接灯' },
    { type: 'PD', x: 4.18, z: 7.42, label: 'PD-605 エスプレッソバー真鍮灯' },
    { type: 'CV', x: 1.75, z: 7.80, label: 'CV-606 天文サロン梁間接灯' },
    { type: 'LN', x: 0.52, z: 8.20, label: 'LN-607 吊り下げ暖炉炎光' },
    { type: 'BL', x: 2.50, z: 10.20, label: 'BL-608 全幅テラス防雨灯' },
  ],
  switches: [
    { x: 2.08, z: 1.35, label: 'SW601' },
    { x: 2.08, z: 3.95, label: 'SW602' },
    { x: 1.22, z: 6.18, label: 'SW603' },
    { x: 2.45, z: 9.72, label: 'SW604' },
  ],
  outlets: [
    { x: 4.70, z: 2.80, label: 'USB/2P' },
    { x: 2.35, z: 4.80, label: 'WC/洗面' },
    { x: 3.70, z: 3.70, label: 'ワイン庫2P' },
    { x: 4.70, z: 7.40, label: 'ESPRESSO 200V' },
    { x: 3.15, z: 6.18, label: 'Hi-Fi/LP' },
    { x: 4.55, z: 10.08, label: 'WP屋外' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 4.75], [3.15, 4.75], [4.45, 7.25]] },
    { kind: 'drain', pts: [[2.85, 5.25], [4.95, 5.25]] },
    { kind: 'drain', pts: [[0.35, 10.95], [4.65, 10.95]] },
    { kind: 'vent', x: 2.85, z: 3.85, label: '縦PS頂部換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.35], [1.70, 2.00], [1.70, 5.55], [1.70, 6.65], [3.15, 6.65], [3.15, 10.55]] },
    { kind: 'priv', pts: [[1.70, 5.55], [0.65, 5.55], [0.65, 2.65]] },
    { kind: 'work', pts: [[3.15, 6.65], [4.15, 5.25]] },
  ],
};

// =========================================================================
// FLOOR 7 — RF / 屋根裏部屋 (RFL+16,100, 6寸勾配 軒17,520〜棟18,930 + 避雷針20,400)
// =========================================================================
const FLOOR_RF = {
  index: 7,
  code: '屋根裏',
  titleJp: '屋根裏部屋（小屋裏）平面詳細図',
  subtitle: '6寸勾配切妻小屋裏(地上16.1〜18.9m)・鉄柵吹抜ハッチ・北保管庫・南秘密の読書室（有効床 28.50 m²）',
  baseY: 16.10,
  ceilingH: 2.83,
  slabTopY: 18.93,
  floorLabel: 'RFL+16100',
  isAttic: true,
  rooms: [
    {
      id: 'rf_hatch', code: 'RF01', floor: 7, nameJp: '屋根裏ハッチ・鉄柵回廊', nameEn: 'Attic Hatch Gallery',
      x: 0.15, z: 0.15, w: 2.00, d: 5.10, area: 7.50, jo: 4.63, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'rubber_black_stud', floorName: '黒スタッド防滑ゴム床',
      wallName: 'ラスティック腰板＋無垢垂木表し', tint: '#d8d7d3', labelPos: [1.65, 1.35],
      notes: '6Fからの最終階段ST6上がり口。黒アイアン安全柵から階下階段吹抜を見下ろす',
    },
    {
      id: 'rf_storage', code: 'RF02', floor: 7, nameJp: '北・小屋裏保管庫', nameEn: 'North Relic Storage',
      x: 2.15, z: 0.15, w: 2.70, d: 5.10, area: 13.77, jo: 8.50, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'wood_scratched_cedar', floorName: '古杉フローリング',
      wallName: '構造合板切妻勾配天井＋木箱・麻袋・ロープ', tint: '#e4d8c4', labelPos: [3.45, 2.55],
      notes: '木箱・麻袋・ロープ・思い出のクレヨン画を収めた静かな小屋裏倉庫',
    },
    {
      id: 'rf_sanctuary', code: 'RF03', floor: 7, nameJp: '南・秘密の小屋裏読書室', nameEn: 'Secret Attic Sanctuary',
      x: 0.15, z: 5.25, w: 4.70, d: 4.60, area: 21.62, jo: 13.35, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'tatami_aged', floorName: '古畳＋古杉板張',
      wallName: 'レトロ花柄クロス妻壁＋有孔ボード＋吊りランタン', tint: '#e6dec9', labelPos: [2.50, 7.55],
      notes: '地上17m棟木直下の秘密基地。吊りアイアンランタンと南妻三角窓から老杉の梢海を一望',
    },
  ],
  walls: [
    {
      id: 'WRF_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wood_scratched_cedar',
      openings: [
        { id: 'WRF-1', type: 'window', pos: 1.80, width: 1.40, height: 1.35, sill: 0.65, label: 'WRF-1 北切妻妻窓' },
      ],
    },
    {
      id: 'WRF_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_vintage_floral',
      openings: [
        { id: 'WRF-2', type: 'window', pos: 1.70, width: 1.60, height: 1.45, sill: 0.60, label: 'WRF-2 南切妻展望窓' },
      ],
    },
    { id: 'WRF_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    { id: 'WRF_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    { id: 'WRF_RAIL_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.24, z2: 5.24, kind: 'railing', openings: [] },
    { id: 'WRF_RAIL_S', axis: 'h', x1: 0.15, z1: 5.15, x2: 1.24, z2: 5.24, kind: 'railing', openings: [] },
    { id: 'WRF_DIV_E', axis: 'h', x1: 3.10, z1: 5.20, x2: 4.85, z2: 5.30, kind: 'low_screen', texA: 'wood_lattice_dark', texB: 'pegboard_wood', openings: [] },
  ],
  stairUp: null,
  stairDown: { id: 'ST6', label: 'DN 6Fへ', dir: 'south' },
  lighting: [
    { type: 'BL', x: 1.65, z: 1.50, label: 'BL-701 小屋裏ハッチ灯' },
    { type: 'PD', x: 3.10, z: 2.50, label: 'PD-702 倉庫裸電球' },
    { type: 'LN', x: 2.50, z: 7.45, label: 'LN-703 吊り小屋裏ランタン' },
  ],
  switches: [
    { x: 1.32, z: 2.30, label: 'SW71' },
    { x: 2.95, z: 5.38, label: 'SW72' },
  ],
  outlets: [
    { x: 3.15, z: 5.38, label: '読書灯2P' },
    { x: 2.50, z: 9.70, label: '窓際2P' },
  ],
  plumbing: [
    { kind: 'vent', x: 2.50, z: 0.40, label: '棟換気(北)' },
    { kind: 'vent', x: 2.50, z: 9.60, label: '棟換気(南)・避雷接地' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.25], [1.95, 1.80], [2.25, 5.50], [2.50, 7.60]] },
    { kind: 'work', pts: [[1.95, 1.80], [3.35, 2.20]] },
  ],
};

// =========================================================================
// NEIGHBORING HOUSE — ANNEX-40 / 隣棟「森の離れ」（5.00m × 8.00m 3階建＋屋根裏部屋）
// Positioned 2.60m West of Main Tower across a lantern-lit moss courtyard:
//   World X = -7.60 .. -2.60 m (width 5,000 mm)
//   World Z =  1.00 ..  9.00 m (depth 8,000 mm)
//   4 Levels: 1F (0.00) -> 2F (2.75) -> 3F (5.50, 6 rooms + 3× 1×1.6m balconies) -> Attic (8.15..10.95, 5 rooms)
// =========================================================================
export const ANNEX = {
  name: 'ANNEX-40 / 隣棟「森の離れ」（5m×8m 3階建＋屋根裏部屋）',
  subtitle: '5,000 × 8,000 mm（木造3階建＋6寸勾配5室屋根裏｜3F 6室＋1×1.6mバルコニー×3｜母屋西2.6m隣接）',
  originX: -7.60,
  originZ: 1.00,
  width: 5.0,
  depth: 8.0,
  atticBaseY: 8.15,
  atticKneewallH: 1.40,
  atticEaveY: 9.55,
  atticRidgeY: 10.95,
  atticSlope: 0.56,
  // 3 Walkable 1.00m × 1.60m Cantilevered Balconies on Annex 3F (Local & World coords)
  balconies3F: [
    { id: 'ABAL-1', nameJp: '北バルコニー (1.0×1.6m)', side: 'north', lx1: 2.85, lx2: 4.45, lz1: -1.00, lz2: 0.00 },
    { id: 'ABAL-2', nameJp: '西バルコニー (1.0×1.6m)', side: 'west',  lx1: -1.00, lx2: 0.00, lz1: 5.95, lz2: 7.55 },
    { id: 'ABAL-3', nameJp: '南バルコニー (1.0×1.6m)', side: 'south', lx1: 2.85, lx2: 4.45, lz1: 8.00, lz2: 9.00 },
  ],
  stairLocal: {
    minX: 0.15,
    maxX: 1.15,
    topZ: 2.25,     // North upper landing (world Z = 3.25)
    bottomZ: 4.95,  // South lower entry   (world Z = 5.95)
    treads: 13,
  },
  stairWorld: {
    minX: -7.45,
    maxX: -6.45,
    topZ: 3.25,
    bottomZ: 5.95,
    treads: 13,
  },
  gridAxes: {
    x: [
      { id: 'AX1', pos: 0.075, label: '0' },
      { id: 'AX2', pos: 1.200, label: '1,125' },
      { id: 'AX3', pos: 2.200, label: '2,125' },
      { id: 'AX4', pos: 4.925, label: '4,850' },
    ],
    z: [
      { id: 'AY1', pos: 0.075, label: '0' },
      { id: 'AY2', pos: 1.500, label: '1,425' },
      { id: 'AY3', pos: 2.250, label: '2,175' },
      { id: 'AY4', pos: 3.600, label: '3,525' },
      { id: 'AY5', pos: 5.000, label: '4,925' },
      { id: 'AY6', pos: 5.700, label: '5,625' },
      { id: 'AY7', pos: 7.925, label: '7,850' },
    ],
  },
  columns: [
    [0.075, 0.075], [2.200, 0.075], [4.925, 0.075],
    [0.075, 2.250], [1.200, 2.250], [2.200, 2.250], [4.925, 2.250],
    [0.075, 5.000], [1.200, 5.000], [2.200, 5.000], [4.925, 5.000],
    [0.075, 7.925], [2.400, 7.925], [4.925, 7.925],
  ],
};

/**
 * Exact interior gable ceiling height at local X in Annex Attic (Y = 8.15..10.95m).
 */
export function getAnnexAtticCeilingY(lx) {
  const distFromCenter = Math.abs(lx - ANNEX.width / 2);
  return Math.max(ANNEX.atticEaveY, ANNEX.atticRidgeY - distFromCenter * ANNEX.atticSlope);
}

const ANNEX_1F = {
  index: 8,
  physicalFloor: 1,
  building: 'annex',
  code: '隣棟1F',
  titleJp: '隣棟（5m×8m 3階建＋屋根裏）1階 平面詳細図',
  subtitle: '土間玄関・北アトリエ・シャワー洗面WC・森のカフェLDK・STA1直階段（母屋西2.6m隣接）',
  baseY: 0.0,
  ceilingH: 2.50,
  slabTopY: 2.75,
  floorLabel: 'A1FL±0',
  width: 5.0,
  depth: 8.0,
  rooms: [
    {
      id: 'a1_genkan', code: 'A101', building: 'annex', floor: 1, nameJp: '離れ・土間玄関', nameEn: 'Annex Entry',
      x: 2.85, z: 0.15, w: 2.00, d: 1.50, area: 3.00, jo: 1.85, fl: 'FL-100', ch: 'CH2500',
      floorTex: 'paver_granite_grid', floorName: '御影石グリッド土間',
      wallName: '漆喰白壁＋中庭苔石アプローチ直結', tint: '#e4e7ea', labelPos: [3.85, 0.90],
      notes: '母屋玄関から苔石小径と石灯籠を通って直結する離れ玄関（W900オーク断熱扉 DA-1）',
    },
    {
      id: 'a1_atelier', code: 'A102', building: 'annex', floor: 1, nameJp: '離れ・北アトリエ土間', nameEn: 'Annex North Atelier',
      x: 0.15, z: 0.15, w: 2.60, d: 2.00, area: 5.20, jo: 3.21, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'terrazzo_white', floorName: '白テラゾー',
      wallName: 'Pコン打放しRC＋コルクボード作業壁', tint: '#eae7e1', labelPos: [1.45, 1.15],
      notes: 'クラフト作業台・木箱棚を備えた北森ビューの土間アトリエ',
    },
    {
      id: 'a1_wet', code: 'A103', building: 'annex', floor: 1, nameJp: '離れ・洗面・WC・シャワー', nameEn: 'Annex Wet Bath',
      x: 2.85, z: 1.75, w: 2.00, d: 2.20, area: 4.40, jo: 2.72, fl: 'FL±0', ch: 'CH2350',
      floorTex: 'tile_checker_stone', floorName: '市松ストーンタイル',
      wallName: 'エメラルド艶タイル＋白大理石洗面', tint: '#dceae5', labelPos: [3.85, 2.85],
      notes: '独立居住・ゲスト滞在可能な洗面・トイレ・シャワールーム一体水回り',
    },
    {
      id: 'a1_hall', code: 'A104', building: 'annex', floor: 1, nameJp: '離れ・階段ギャラリー', nameEn: 'Annex Gallery',
      x: 1.25, z: 2.15, w: 1.50, d: 2.80, area: 4.20, jo: 2.59, fl: 'FL±0', ch: 'CH2450',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床',
      wallName: '杉板RC階段壁＋アートポスター', tint: '#efe0cb', labelPos: [2.00, 3.55],
      notes: '玄関・アトリエ・水回り・カフェリビングを結ぶ離れ中央ホール',
    },
    {
      id: 'a1_cafe_ldk', code: 'A105', building: 'annex', floor: 1, nameJp: '離れ・森のカフェLDK', nameEn: 'Annex Cafe LDK',
      x: 0.15, z: 4.95, w: 4.70, d: 2.90, area: 13.63, jo: 8.41, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット無垢調床',
      wallName: '赤煉瓦アクセント壁(西)＋キャラメル煉瓦カフェキッチン(東)', tint: '#f3e4cd', labelPos: [2.50, 6.40],
      notes: '幅4.7m開放カフェリビング。デニム2Pソファ・ダイニング卓・中庭＆南森大窓・フロアランプ点灯可',
    },
  ],
  walls: [
    {
      id: 'WA1_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'concrete_pcon',
      openings: [
        { id: 'WA1-1', type: 'window', pos: 0.65, width: 1.45, height: 1.35, sill: 0.85, label: 'WA1-1 離れ北アトリエ窓' },
        { id: 'DA-1', type: 'door_swing', pos: 3.45, width: 0.90, height: 2.22, sill: -0.10, tex: 'door_oak', hinge: 'left', swingDir: 1, label: 'DA-1 離れ玄関ドア (W900)' },
      ],
    },
    {
      id: 'WA1_S', axis: 'h', x1: 0, z1: 7.85, x2: 5.0, z2: 8.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'WA1-3', type: 'window_terrace', pos: 0.65, width: 2.45, height: 2.15, sill: 0.08, label: 'WA1-3 離れ南森大開口' },
        { id: 'WA1-5', type: 'window', pos: 3.55, width: 0.95, height: 1.35, sill: 0.80, label: 'WA1-5 カフェ南東窓' },
      ],
    },
    {
      id: 'WA1_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 7.85, kind: 'ext', extTex: 'brick_aged_dark', intTex: 'brick_red_classic',
      openings: [
        { id: 'WA1-2', type: 'window_high', pos: 3.00, width: 1.10, height: 0.65, sill: 1.70, label: 'WA1-2 離れ階段高窓' },
      ],
    },
    {
      id: 'WA1_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 7.85, kind: 'ext', extTex: 'shikkui_white', intTex: 'wallpaper_white',
      openings: [
        { id: 'WA1-6', type: 'window_frosted', pos: 2.45, width: 0.85, height: 0.85, sill: 1.30, label: 'WA1-6 離れ水回り窓' },
        { id: 'WA1-4', type: 'window', pos: 5.45, width: 1.45, height: 1.45, sill: 0.72, label: 'WA1-4 中庭・母屋ビュー窓' },
      ],
    },
    { id: 'WA1_ST_E', axis: 'v', x1: 1.15, z1: 2.20, x2: 1.25, z2: 4.95, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_cedar_form', openings: [] },
    { id: 'WA1_ST_N', axis: 'h', x1: 0.15, z1: 2.20, x2: 1.15, z2: 2.30, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_pcon', openings: [] },
    { id: 'WA1_GEN_S', axis: 'h', x1: 2.85, z1: 1.65, x2: 4.85, z2: 1.75, kind: 'int', texA: 'wallpaper_white', texB: 'tile_emerald_gloss', openings: [] },
    {
      id: 'WA1_WET_W', axis: 'v', x1: 2.75, z1: 1.65, x2: 2.85, z2: 4.05, kind: 'int', texA: 'wallpaper_white', texB: 'tile_emerald_gloss',
      openings: [
        { id: 'DA-2', type: 'door_pocket', pos: 2.35, width: 0.78, height: 2.02, sill: 0, tex: 'door_white', slideDir: 1, label: 'DA-2 離れ水回り引戸' },
      ],
    },
    { id: 'WA1_WET_S', axis: 'h', x1: 2.85, z1: 3.95, x2: 4.85, z2: 4.05, kind: 'int', texA: 'tile_emerald_gloss', texB: 'wallpaper_white', openings: [] },
  ],
  stairUp: { id: 'STA1', label: 'UP 隣棟2Fへ (13段)', dir: 'north' },
  stairDown: null,
  lighting: [
    { type: 'DL', x: 3.85, z: 0.90, label: 'DL-A101 離れ玄関灯' },
    { type: 'CL', x: 1.45, z: 1.15, label: 'CL-A102 アトリエ作業灯' },
    { type: 'BL', x: 3.85, z: 2.85, label: 'BL-A103 水回り鏡灯' },
    { type: 'PD', x: 2.65, z: 6.25, label: 'PD-A104 カフェペンダント' },
    { type: 'LN', x: 0.65, z: 7.25, label: 'LN-A105 カフェフロアランプ' },
  ],
  switches: [
    { x: 2.95, z: 1.55, label: 'SWA1' },
    { x: 2.68, z: 4.12, label: 'SWA2' },
  ],
  outlets: [
    { x: 0.25, z: 1.15, label: '作業2P' },
    { x: 4.72, z: 5.55, label: 'IH/家電' },
    { x: 0.25, z: 6.50, label: '2P' },
  ],
  plumbing: [
    { kind: 'water', pts: [[4.95, 2.85], [3.85, 2.85], [4.45, 5.45]] },
    { kind: 'drain', pts: [[3.85, 3.45], [4.95, 3.45]] },
    { kind: 'vent', x: 3.85, z: 2.15, label: '24h換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[3.90, -0.35], [3.85, 0.95], [2.10, 1.45], [2.10, 5.75]] },
    { kind: 'priv', pts: [[2.10, 5.45], [0.65, 5.45], [0.65, 2.45]] },
  ],
};

const ANNEX_2F = {
  index: 9,
  physicalFloor: 2,
  building: 'annex',
  code: '隣棟2F',
  titleJp: '隣棟（5m×8m 3階建＋屋根裏）2階 平面詳細図',
  subtitle: '北書庫ホール・STA2階段前室・東和モダン畳客室・南森見主寝室（3Fへ連続階段接続）',
  baseY: 2.75,
  ceilingH: 2.50,
  slabTopY: 5.50,
  floorLabel: 'A2FL+2750',
  width: 5.0,
  depth: 8.0,
  rooms: [
    {
      id: 'a2_library', code: 'A201', building: 'annex', floor: 2, nameJp: '離れ2F 北書庫・階段ホール', nameEn: 'Annex 2F Library Hall',
      x: 0.15, z: 0.15, w: 4.70, d: 2.10, area: 9.87, jo: 6.09, fl: 'A2FL±0', ch: 'CH2500',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '木縦格子＋珪藻土ベージュ＋造作本棚', tint: '#f0e2ca', labelPos: [2.65, 1.15],
      notes: '1Fから上がる開放ライブラリーホール。北側の老杉林を望む読書ベンチ',
    },
    {
      id: 'a2_corridor', code: 'A202', building: 'annex', floor: 2, nameJp: '離れ2F 階段ギャラリー前室', nameEn: 'Annex 2F Corridor',
      x: 1.25, z: 2.25, w: 1.20, d: 3.30, area: 4.56, jo: 2.81, fl: 'A2FL±0', ch: 'CH2500',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '杉板RC階段壁＋3F直階段 STA2 昇降口', tint: '#f3e8d5', labelPos: [1.85, 3.85],
      notes: '南側前室からSTA2直階段で隣棟3F（6室＋3バルコニー）へ連続昇降',
    },
    {
      id: 'a2_tatami', code: 'A203', building: 'annex', floor: 2, nameJp: '離れ2F 和モダン畳客室', nameEn: 'Annex 2F Tatami Room',
      x: 2.55, z: 2.35, w: 2.30, d: 3.20, area: 7.36, jo: 4.54, fl: 'A2FL±0', ch: 'CH2500',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳',
      wallName: 'セージグリーン漆喰＋障子引戸(DA-3)', tint: '#dce6d4', labelPos: [3.70, 3.90],
      notes: '東中庭窓から母屋4階建の灯りを望む静謐な畳ゲスト室',
    },
    {
      id: 'a2_bedroom', code: 'A204', building: 'annex', floor: 2, nameJp: '離れ2F 森見主寝室', nameEn: 'Annex 2F Master Bedroom',
      x: 0.15, z: 5.65, w: 4.70, d: 2.20, area: 10.34, jo: 6.38, fl: 'A2FL±0', ch: 'CH2500',
      floorTex: 'wood_floor', floorName: 'オーク複合フローリング＋ラグ',
      wallName: 'レトロ花柄アクセント壁＋木製腰壁', tint: '#eee1d1', labelPos: [2.50, 6.75],
      notes: '6.4帖の離れ主寝室。クイーンベッド・造作収納・南西2面老杉森ビュー',
    },
  ],
  walls: [
    {
      id: 'WA2_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_beige',
      openings: [
        { id: 'WA2-1', type: 'window', pos: 1.55, width: 1.95, height: 1.38, sill: 0.78, label: 'WA2-1 書庫北森パノラマ窓' },
      ],
    },
    {
      id: 'WA2_S', axis: 'h', x1: 0, z1: 7.85, x2: 5.0, z2: 8.0, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_vintage_floral',
      openings: [
        { id: 'WA2-3', type: 'window', pos: 0.75, width: 2.35, height: 1.52, sill: 0.62, label: 'WA2-3 離れ寝室南大窓' },
      ],
    },
    {
      id: 'WA2_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 7.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wainscot_wood',
      openings: [
        { id: 'WA2-4', type: 'window', pos: 6.10, width: 1.15, height: 1.25, sill: 0.85, label: 'WA2-4 離れ寝室西森窓' },
      ],
    },
    {
      id: 'WA2_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 7.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_sage',
      openings: [
        { id: 'WA2-2', type: 'window', pos: 3.15, width: 1.35, height: 1.35, sill: 0.78, label: 'WA2-2 母屋ビュー東窓' },
      ],
    },
    { id: 'WA2_ST_E', axis: 'v', x1: 1.15, z1: 2.25, x2: 1.25, z2: 4.95, kind: 'int', texA: 'concrete_cedar_form', texB: 'wallpaper_white', openings: [] },
    { id: 'WA2_TAT_N', axis: 'h', x1: 2.55, z1: 2.25, x2: 4.85, z2: 2.35, kind: 'int', texA: 'plaster_beige', texB: 'plaster_sage', openings: [] },
    {
      id: 'WA2_TAT_W', axis: 'v', x1: 2.45, z1: 2.25, x2: 2.55, z2: 5.55, kind: 'int', texA: 'wallpaper_white', texB: 'plaster_sage',
      openings: [
        { id: 'DA-3', type: 'door_pocket', pos: 3.15, width: 0.82, height: 2.02, sill: 0, tex: 'shoji_grid', slideDir: -1, label: 'DA-3 畳客室障子引戸' },
      ],
    },
    {
      id: 'WA2_BED_N', axis: 'h', x1: 0.15, z1: 5.55, x2: 4.85, z2: 5.65, kind: 'int', texA: 'wallpaper_white', texB: 'wallpaper_vintage_floral',
      openings: [
        { id: 'DA-4', type: 'door_pocket', pos: 1.35, width: 0.82, height: 2.05, sill: 0, tex: 'door_walnut', slideDir: 1, label: 'DA-4 離れ主寝室引戸' },
      ],
    },
  ],
  stairUp: { id: 'STA2', label: 'UP 隣棟3Fへ (13段)', dir: 'north' },
  stairDown: { id: 'STA1', label: 'DN 隣棟1Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 2.50, z: 1.15, label: 'DL-A201 書庫ホール灯' },
    { type: 'LN', x: 3.70, z: 3.90, label: 'LN-A202 畳客室和紙灯' },
    { type: 'BL', x: 2.50, z: 6.75, label: 'BL-A203 離れ寝室間接灯' },
  ],
  switches: [
    { x: 1.32, z: 2.12, label: 'SWA21' },
    { x: 1.32, z: 5.45, label: 'SWA22' },
  ],
  outlets: [
    { x: 4.70, z: 1.15, label: '書庫2P' },
    { x: 4.70, z: 6.75, label: 'USB/2P' },
  ],
  plumbing: [
    { kind: 'vent', x: 3.70, z: 2.65, label: '24h換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.05], [1.85, 1.75], [1.85, 5.25], [0.65, 5.25], [0.65, 2.55]] },
    { kind: 'work', pts: [[1.85, 3.55], [3.55, 3.55]] },
  ],
};

// =========================================================================
// ANNEX 3F — 6 ROOMS + 3× (1.00m × 1.60m) WALKABLE BALCONIES (A3FL+5,500)
// =========================================================================
const ANNEX_3F = {
  index: 10,
  physicalFloor: 3,
  building: 'annex',
  code: '隣棟3F',
  titleJp: '隣棟（5m×8m）3階 平面詳細図（6室＋1m×1.6mバルコニー×3）',
  subtitle: '全室引戸6部屋＋北・西・南 3方向 1,000×1,600mm 樹冠バルコニー＋屋根裏直階段 STA3',
  baseY: 5.50,
  ceilingH: 2.40,
  slabTopY: 8.15,
  floorLabel: 'A3FL+5500',
  width: 5.0,
  depth: 8.0,
  hasAnnexBalconies: true,
  rooms: [
    {
      id: 'a3_study', code: 'A301', building: 'annex', floor: 3, nameJp: '① 北西・ミニ書斎室', nameEn: '3F NW Study',
      x: 0.15, z: 0.15, w: 2.00, d: 1.30, area: 2.60, jo: 1.60, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'carpet_charcoal_tile', floorName: 'チャコールタイルカーペット',
      wallName: '木縦格子＋白漆喰・集中デスク', tint: '#dcdad5', labelPos: [1.15, 0.80],
      notes: '北森を見下ろす静かな独立ワークスペース（引戸 DA3-1）',
    },
    {
      id: 'a3_guest', code: 'A302', building: 'annex', floor: 3, nameJp: '② 北東・フォレストゲスト室', nameEn: '3F NE Guest Room',
      x: 2.25, z: 0.15, w: 2.60, d: 2.00, area: 5.20, jo: 3.21, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'wood_floor', floorName: 'ライトオーク複合床',
      wallName: 'トラバーチン調石壁＋北バルコニー大開口', tint: '#f2e8d9', labelPos: [3.55, 1.15],
      notes: '北バルコニー（1.0×1.6m）へガラス引戸 DA3-B1 で直接出られるゲスト個室',
    },
    {
      id: 'a3_library', code: 'A303', building: 'annex', floor: 3, nameJp: '③ 東中・樹冠書庫ルーム', nameEn: '3F East Library',
      x: 2.25, z: 2.25, w: 2.60, d: 1.30, area: 3.38, jo: 2.09, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '造作書棚＋白パネル＋東中庭ビュー窓', tint: '#ece6dc', labelPos: [3.55, 2.90],
      notes: '壁面造作書棚と読書スツールを備えた東向きプライベート書庫',
    },
    {
      id: 'a3_tea', code: 'A304', building: 'annex', floor: 3, nameJp: '④ 東・茶小間＆ドレス室', nameEn: '3F East Tea & Dressing',
      x: 2.25, z: 3.65, w: 2.60, d: 1.30, area: 3.38, jo: 2.09, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳',
      wallName: 'セージ漆喰＋造作ドレッサー＋母屋ビュー窓', tint: '#dce6d4', labelPos: [3.55, 4.30],
      notes: '琉球畳敷きの静謐な茶小間兼パウダールーム',
    },
    {
      id: 'a3_atelier', code: 'A305', building: 'annex', floor: 3, nameJp: '⑤ 南西・森のアトリエ室', nameEn: '3F SW Forest Atelier',
      x: 0.15, z: 5.75, w: 2.20, d: 2.10, area: 4.62, jo: 2.85, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床',
      wallName: '赤煉瓦アクセント＋西バルコニー掃出窓', tint: '#e8dccb', labelPos: [1.25, 6.80],
      notes: '西バルコニー（1.0×1.6m）へガラス引戸 DA3-B2 で直結する樹冠アトリエ',
    },
    {
      id: 'a3_salon', code: 'A306', building: 'annex', floor: 3, nameJp: '⑥ 南東・スカイサロン室', nameEn: '3F SE Sky Salon',
      x: 2.45, z: 5.75, w: 2.40, d: 2.10, area: 5.04, jo: 3.11, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'wood_floor', floorName: 'ライトオーク＋ラグ',
      wallName: 'クリーム煉瓦＋南バルコニー大開口', tint: '#f5ead6', labelPos: [3.65, 6.80],
      notes: '南バルコニー（1.0×1.6m）へガラス引戸 DA3-B3 で直結する展望サロン',
    },
    {
      id: 'a3_hall', code: 'A300', building: 'annex', floor: 3, nameJp: '3F 集中ギャラリー廊下', nameEn: '3F Central Spine',
      x: 1.25, z: 1.55, w: 0.90, d: 4.10, area: 4.82, jo: 2.98, fl: 'A3FL±0', ch: 'CH2400',
      floorTex: 'wood_floor', floorName: 'ライトオーク床',
      wallName: '白漆喰＋STA3屋根裏階段口', tint: '#f4ece0', labelPos: [1.70, 3.60],
      notes: '全6室と屋根裏階段 STA3 を最短距離で繋ぐT字集中廊下',
    },
    {
      id: 'a3_bal_n', code: 'ABAL-1', building: 'annex', floor: 3, nameJp: '北バルコニー (1×1.6m)', nameEn: 'North Balcony 1×1.6m',
      x: 2.85, z: -1.00, w: 1.60, d: 1.00, area: 1.60, jo: 0.99, fl: 'A3FL-40', ch: '屋外',
      floorTex: 'wood_deck', floorName: '耐候ウッドデッキ',
      wallName: '黒アイアン＋強化ガラス手摺 H1,100', tint: '#e4d5be', labelPos: [3.65, -0.50],
      notes: '1,000×1,600mm 北樹冠バルコニー（A302より直結）',
    },
    {
      id: 'a3_bal_w', code: 'ABAL-2', building: 'annex', floor: 3, nameJp: '西バルコニー (1×1.6m)', nameEn: 'West Balcony 1×1.6m',
      x: -1.00, z: 5.95, w: 1.00, d: 1.60, area: 1.60, jo: 0.99, fl: 'A3FL-40', ch: '屋外',
      floorTex: 'wood_deck', floorName: '耐候ウッドデッキ',
      wallName: '黒アイアン＋強化ガラス手摺 H1,100', tint: '#e4d5be', labelPos: [-0.50, 6.75],
      notes: '1,000×1,600mm 西老杉森バルコニー（A305より直結）',
    },
    {
      id: 'a3_bal_s', code: 'ABAL-3', building: 'annex', floor: 3, nameJp: '南バルコニー (1×1.6m)', nameEn: 'South Balcony 1×1.6m',
      x: 2.85, z: 8.00, w: 1.60, d: 1.00, area: 1.60, jo: 0.99, fl: 'A3FL-40', ch: '屋外',
      floorTex: 'wood_deck', floorName: '耐候ウッドデッキ',
      wallName: '黒アイアン＋強化ガラス手摺 H1,100', tint: '#e4d5be', labelPos: [3.65, 8.50],
      notes: '1,000×1,600mm 南樹冠バルコニー（A306より直結）',
    },
  ],
  walls: [
    {
      id: 'WA3_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'shikkui_white', intTex: 'travertine',
      openings: [
        { id: 'WA3-1', type: 'window', pos: 0.55, width: 1.10, height: 1.20, sill: 0.78, label: 'WA3-1 北西書斎窓' },
        { id: 'DA3-B1', type: 'door_pocket', pos: 3.15, width: 0.96, height: 2.02, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DA3-B1 北バルコニー引戸' },
      ],
    },
    {
      id: 'WA3_S', axis: 'h', x1: 0, z1: 7.85, x2: 5.0, z2: 8.0, kind: 'ext', extTex: 'shikkui_white', intTex: 'brick_cream',
      openings: [
        { id: 'WA3-5', type: 'window', pos: 0.55, width: 1.35, height: 1.35, sill: 0.72, label: 'WA3-5 アトリエ南窓' },
        { id: 'DA3-B3', type: 'door_pocket', pos: 3.15, width: 0.96, height: 2.02, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DA3-B3 南バルコニー引戸' },
      ],
    },
    {
      id: 'WA3_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 7.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'brick_red_classic',
      openings: [
        { id: 'WA3-2', type: 'window_high', pos: 3.00, width: 1.10, height: 0.70, sill: 1.55, label: 'WA3-2 3F階段高窓' },
        { id: 'DA3-B2', type: 'door_pocket', pos: 6.25, width: 0.96, height: 2.02, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DA3-B2 西バルコニー引戸' },
      ],
    },
    {
      id: 'WA3_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 7.85, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'plaster_sage',
      openings: [
        { id: 'WA3-3', type: 'window', pos: 2.55, width: 0.80, height: 1.15, sill: 0.80, label: 'WA3-3 書庫東中庭窓' },
        { id: 'WA3-4', type: 'window', pos: 3.95, width: 0.80, height: 1.15, sill: 0.80, label: 'WA3-4 茶小間東中庭窓' },
        { id: 'WA3-6', type: 'window', pos: 5.10, width: 0.50, height: 1.15, sill: 0.80, label: 'WA3-6 廊下東小窓' },
      ],
    },
    // Interior Partition Walls (ALL Pocket Doors, zero overlapping corners!)
    { id: 'WA3_ST_E', axis: 'v', x1: 1.15, z1: 2.25, x2: 1.25, z2: 4.95, kind: 'int', texA: 'concrete_cedar_form', texB: 'wallpaper_white', openings: [] },
    {
      id: 'WA3_R1_S', axis: 'h', x1: 0.15, z1: 1.45, x2: 2.15, z2: 1.55, kind: 'int', texA: 'wood_slats', texB: 'wallpaper_white',
      openings: [
        { id: 'DA3-1', type: 'door_pocket', pos: 1.30, width: 0.74, height: 1.98, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DA3-1 北西書斎引戸' },
      ],
    },
    {
      id: 'WA3_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 4.95, kind: 'int', texA: 'wallpaper_white', texB: 'travertine',
      openings: [
        { id: 'DA3-2', type: 'door_pocket', pos: 1.32, width: 0.72, height: 1.98, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DA3-2 ゲスト室引戸' },
        { id: 'DA3-3', type: 'door_pocket', pos: 2.58, width: 0.72, height: 1.98, sill: 0, tex: 'door_white', slideDir: -1, label: 'DA3-3 書庫ルーム引戸' },
        { id: 'DA3-4', type: 'door_pocket', pos: 3.98, width: 0.72, height: 1.98, sill: 0, tex: 'shoji_grid', slideDir: -1, label: 'DA3-4 茶小間障子引戸' },
      ],
    },
    { id: 'WA3_E_DIV1', axis: 'h', x1: 2.25, z1: 2.15, x2: 4.85, z2: 2.25, kind: 'int', texA: 'travertine', texB: 'panel_white_vert', openings: [] },
    { id: 'WA3_E_DIV2', axis: 'h', x1: 2.25, z1: 3.55, x2: 4.85, z2: 3.65, kind: 'int', texA: 'panel_white_vert', texB: 'plaster_sage', openings: [] },
    { id: 'WA3_E_DIV3', axis: 'h', x1: 2.15, z1: 4.95, x2: 4.85, z2: 5.05, kind: 'int', texA: 'plaster_sage', texB: 'wallpaper_white', openings: [] },
    {
      id: 'WA3_S_N', axis: 'h', x1: 0.15, z1: 5.65, x2: 4.85, z2: 5.75, kind: 'int', texA: 'wallpaper_white', texB: 'brick_cream',
      openings: [
        { id: 'DA3-5', type: 'door_pocket', pos: 1.30, width: 0.76, height: 1.98, sill: 0, tex: 'door_walnut', slideDir: -1, label: 'DA3-5 森アトリエ引戸' },
        { id: 'DA3-6', type: 'door_pocket', pos: 2.60, width: 0.76, height: 1.98, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'DA3-6 スカイサロン引戸' },
      ],
    },
    { id: 'WA3_S_MID', axis: 'v', x1: 2.35, z1: 5.75, x2: 2.45, z2: 7.85, kind: 'int', texA: 'wainscot_wood', texB: 'brick_cream', openings: [] },
  ],
  stairUp: { id: 'STA3', label: 'UP 隣棟屋根裏へ (13段)', dir: 'north' },
  stairDown: { id: 'STA2', label: 'DN 隣棟2Fへ', dir: 'south' },
  lighting: [
    { type: 'DL', x: 1.15, z: 0.80, label: 'DL-A301 北西書斎灯' },
    { type: 'DL', x: 3.55, z: 1.15, label: 'DL-A302 ゲスト室灯' },
    { type: 'CL', x: 3.55, z: 2.90, label: 'CL-A303 書庫灯' },
    { type: 'LN', x: 3.55, z: 4.30, label: 'LN-A304 茶小間灯' },
    { type: 'PD', x: 1.25, z: 6.80, label: 'PD-A305 アトリエ灯' },
    { type: 'PD', x: 3.65, z: 6.80, label: 'PD-A306 サロン灯' },
  ],
  switches: [
    { x: 1.25, z: 1.62, label: 'SWA31' },
    { x: 2.08, z: 5.15, label: 'SWA32' },
  ],
  outlets: [
    { x: 0.25, z: 0.80, label: 'PC 2P' },
    { x: 4.70, z: 1.15, label: 'USB/2P' },
    { x: 0.25, z: 7.40, label: '2P' },
    { x: 4.70, z: 7.40, label: 'WP屋外' },
  ],
  plumbing: [
    { kind: 'vent', x: 3.55, z: 3.85, label: '24h換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.05], [1.70, 1.85], [1.70, 5.35], [3.65, 5.35], [3.65, 8.45]] },
    { kind: 'work', pts: [[1.70, 5.35], [1.25, 6.75], [-0.45, 6.75]] },
    { kind: 'priv', pts: [[1.70, 1.85], [3.65, 1.45], [3.65, -0.45]] },
  ],
};

// =========================================================================
// ANNEX ATTIC / 隣棟 屋根裏部屋 — 5 DISTINCT ROOMS UNDER 6寸 GABLE ROOF (ARFL+8,150)
// =========================================================================
const ANNEX_ATTIC = {
  index: 11,
  physicalFloor: 4,
  building: 'annex',
  code: '隣棟屋根裏',
  titleJp: '隣棟（5m×8m）屋根裏部屋 平面詳細図（全5部屋・6寸勾配）',
  subtitle: '6寸勾配切妻小屋裏（軒1,400〜棟2,800）・鉄柵吹抜回廊＋独立5部屋（全引戸）',
  baseY: 8.15,
  ceilingH: 2.80,
  slabTopY: 10.95,
  floorLabel: 'ARFL+8150',
  width: 5.0,
  depth: 8.0,
  isAttic: true,
  rooms: [
    {
      id: 'ar_nook', code: 'AR01', building: 'annex', floor: 4, nameJp: '① 小屋裏・北西星見ノック', nameEn: 'Attic NW Stargaze Nook',
      x: 0.15, z: 0.15, w: 2.00, d: 1.20, area: 2.40, jo: 1.48, fl: 'ARFL±0', ch: 'CH1400〜2600',
      floorTex: 'wood_scratched_cedar', floorName: '古杉板フローリング',
      wallName: '構造合板勾配天井＋北切妻展望窓', tint: '#e4d8c4', labelPos: [1.15, 0.75],
      notes: '北切妻窓から樹冠と夜空を眺める静かな小屋裏小室',
    },
    {
      id: 'ar_archive', code: 'AR02', building: 'annex', floor: 4, nameJp: '② 小屋裏・北東アーカイブ室', nameEn: 'Attic NE Archive Room',
      x: 2.25, z: 0.15, w: 2.60, d: 2.40, area: 6.24, jo: 3.85, fl: 'ARFL±0', ch: 'CH1400〜2800',
      floorTex: 'wood_scratched_cedar', floorName: '古杉板フローリング',
      wallName: '木箱・麻袋・古書シェルフ＋ラスティック腰板', tint: '#e2d5bf', labelPos: [3.55, 1.35],
      notes: '思い出の木箱や蔵書を収める小屋裏アーカイブ室',
    },
    {
      id: 'ar_hobby', code: 'AR03', building: 'annex', floor: 4, nameJp: '③ 小屋裏・東中ホビールーム', nameEn: 'Attic East Hobby Room',
      x: 2.25, z: 2.65, w: 2.60, d: 2.30, area: 5.98, jo: 3.69, fl: 'ARFL±0', ch: 'CH1400〜2800',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '有孔ボード工作壁＋作業デスク', tint: '#e8decb', labelPos: [3.55, 3.80],
      notes: 'クラフト・模型製作に没頭できる屋根裏ホビールーム',
    },
    {
      id: 'ar_books', code: 'AR04', building: 'annex', floor: 4, nameJp: '④ 小屋裏・南西古書読書室', nameEn: 'Attic SW Reading Room',
      x: 0.15, z: 5.65, w: 2.20, d: 2.20, area: 4.84, jo: 2.99, fl: 'ARFL±0', ch: 'CH1400〜2800',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床',
      wallName: 'レトロ花柄妻壁＋壁面書棚＋読書座卓', tint: '#e6d8c5', labelPos: [1.25, 6.75],
      notes: '南切妻窓の光が差し込む秘密の古書読書室',
    },
    {
      id: 'ar_tatami', code: 'AR05', building: 'annex', floor: 4, nameJp: '⑤ 小屋裏・南東秘密の畳室', nameEn: 'Attic SE Secret Tatami',
      x: 2.45, z: 5.65, w: 2.40, d: 2.20, area: 5.28, jo: 3.26, fl: 'ARFL±0', ch: 'CH1400〜2800',
      floorTex: 'tatami_aged', floorName: '古畳敷き',
      wallName: 'レトロ花柄妻壁＋和紙ランタン＋座布団', tint: '#dfe4ca', labelPos: [3.65, 6.75],
      notes: '古畳と和紙灯りに包まれた屋根裏最奥の隠れ家和室',
    },
    {
      id: 'ar_hall', code: 'AR00', building: 'annex', floor: 4, nameJp: '屋根裏 鉄柵吹抜回廊', nameEn: 'Attic Hatch Gallery',
      x: 1.25, z: 1.45, w: 0.90, d: 4.10, area: 4.75, jo: 2.93, fl: 'ARFL±0', ch: 'CH2100〜2800',
      floorTex: 'rubber_black_stud', floorName: '黒スタッド防滑ゴム床',
      wallName: 'アイアン安全柵（STA3吹抜）＋現し棟木', tint: '#d8d7d3', labelPos: [1.70, 3.55],
      notes: '全5つの屋根裏個室へ繋がる棟木直下の中央回廊',
    },
  ],
  walls: [
    {
      id: 'WAR_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wood_scratched_cedar',
      openings: [
        { id: 'WAR-1', type: 'window', pos: 1.85, width: 1.30, height: 1.25, sill: 0.62, label: 'WAR-1 隣棟北切妻窓' },
      ],
    },
    {
      id: 'WAR_S', axis: 'h', x1: 0, z1: 7.85, x2: 5.0, z2: 8.0, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_vintage_floral',
      openings: [
        { id: 'WAR-2', type: 'window', pos: 1.80, width: 1.40, height: 1.30, sill: 0.60, label: 'WAR-2 隣棟南切妻窓' },
      ],
    },
    { id: 'WAR_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 7.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    { id: 'WAR_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 7.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    { id: 'WAR_RAIL_E', axis: 'v', x1: 1.15, z1: 2.25, x2: 1.24, z2: 5.04, kind: 'railing', openings: [] },
    { id: 'WAR_RAIL_S', axis: 'h', x1: 0.15, z1: 4.95, x2: 1.24, z2: 5.04, kind: 'railing', openings: [] },
    // 5-Room Attic Interior Walls (built clipped cleanly beneath 6寸 gable roof!)
    {
      id: 'WAR_R1_S', axis: 'h', x1: 0.15, z1: 1.35, x2: 2.15, z2: 1.45, kind: 'int', texA: 'wood_scratched_cedar', texB: 'wainscot_rustic',
      openings: [
        { id: 'DAR-1', type: 'door_pocket', pos: 1.30, width: 0.72, height: 1.74, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DAR-1 星見ノック引戸' },
      ],
    },
    {
      id: 'WAR_MID_V', axis: 'v', x1: 2.15, z1: 0.15, x2: 2.25, z2: 4.95, kind: 'int', texA: 'wainscot_rustic', texB: 'wood_scratched_cedar',
      openings: [
        { id: 'DAR-2', type: 'door_pocket', pos: 1.55, width: 0.72, height: 1.74, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DAR-2 アーカイブ室引戸' },
        { id: 'DAR-3', type: 'door_pocket', pos: 3.45, width: 0.72, height: 1.74, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DAR-3 ホビー室引戸' },
      ],
    },
    { id: 'WAR_E_DIV1', axis: 'h', x1: 2.25, z1: 2.55, x2: 4.85, z2: 2.65, kind: 'int', texA: 'wood_scratched_cedar', texB: 'pegboard_wood', openings: [] },
    { id: 'WAR_E_DIV2', axis: 'h', x1: 2.15, z1: 4.95, x2: 4.85, z2: 5.05, kind: 'int', texA: 'pegboard_wood', texB: 'wainscot_rustic', openings: [] },
    {
      id: 'WAR_S_N', axis: 'h', x1: 0.15, z1: 5.55, x2: 4.85, z2: 5.65, kind: 'int', texA: 'wainscot_rustic', texB: 'wallpaper_vintage_floral',
      openings: [
        { id: 'DAR-4', type: 'door_pocket', pos: 1.30, width: 0.74, height: 1.74, sill: 0, tex: 'door_walnut', slideDir: -1, label: 'DAR-4 古書読書室引戸' },
        { id: 'DAR-5', type: 'door_pocket', pos: 2.60, width: 0.74, height: 1.74, sill: 0, tex: 'shoji_grid', slideDir: 1, label: 'DAR-5 秘密の畳室引戸' },
      ],
    },
    { id: 'WAR_S_MID', axis: 'v', x1: 2.35, z1: 5.65, x2: 2.45, z2: 7.85, kind: 'int', texA: 'wainscot_rustic', texB: 'wallpaper_vintage_floral', openings: [] },
  ],
  stairUp: null,
  stairDown: { id: 'STA3', label: 'DN 隣棟3Fへ', dir: 'south' },
  lighting: [
    { type: 'BL', x: 1.70, z: 1.70, label: 'BL-AR01 小屋裏北灯' },
    { type: 'PD', x: 3.55, z: 3.80, label: 'PD-AR02 ホビー灯' },
    { type: 'LN', x: 2.50, z: 6.75, label: 'LN-AR03 南屋根裏ランタン' },
  ],
  switches: [
    { x: 1.32, z: 2.15, label: 'SWAR1' },
    { x: 2.05, z: 5.42, label: 'SWAR2' },
  ],
  outlets: [
    { x: 3.55, z: 2.75, label: '工作2P' },
    { x: 1.25, z: 7.65, label: '読書2P' },
  ],
  plumbing: [
    { kind: 'vent', x: 2.50, z: 0.40, label: '棟換気(北)' },
    { kind: 'vent', x: 2.50, z: 7.60, label: '棟換気(南)' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.05], [1.70, 1.85], [1.70, 5.30], [3.35, 5.30], [3.35, 6.65]] },
    { kind: 'work', pts: [[1.70, 3.80], [3.55, 3.80]] },
  ],
};

// =========================================================================
// 3RD BUILDING — STORAGE-4 / コンクリート倉庫棟 (2.00m × 2.00m 2階建・低天井・計4部屋)
// Positioned East of Main Tower (World X = 6.60 .. 8.60 m, Z = -1.20 .. 0.80 m)
// Low-ceiling cast-in-place grey concrete bunker (CH 1,920mm each floor, 2F at Y = 2.12m)
// Exterior galvanized steel stair STS1 (X = 8.60..9.40, Z = 0.80 -> -1.20) + 2F catwalk landing!
// =========================================================================
export const STORAGE = {
  name: 'STORAGE-4 / コンクリート倉庫棟（2m×2m 2階建・計4室）',
  subtitle: '2,000 × 2,000 mm（低天井 CH1,920 灰色RC打放し2階建｜1F 2室＋2F 2室＝計4室｜母屋東1.6m別棟）',
  originX: 6.60,
  originZ: -1.20,
  width: 2.0,
  depth: 2.0,
  ceilingH: 1.92,
  floor2Y: 2.12,
  roofTopY: 4.28,
  stairWorld: {
    minX: 8.60,
    maxX: 9.40,
    topZ: -1.20,   // North upper landing at Y=2.12m
    bottomZ: 0.80, // South ground entry at Y=0.00m
    treads: 11,
  },
  landing2FWorld: {
    minX: 7.00,
    maxX: 9.40,
    minZ: -1.96,
    maxZ: -1.20,
  },
  gridAxes: {
    x: [
      { id: 'SX1', pos: 0.05, label: '0' },
      { id: 'SX2', pos: 1.95, label: '1,900' },
    ],
    z: [
      { id: 'SY1', pos: 0.05, label: '0' },
      { id: 'SY2', pos: 1.00, label: '950' },
      { id: 'SY3', pos: 1.95, label: '1,900' },
    ],
  },
  columns: [
    [0.05, 0.05], [1.95, 0.05],
    [0.05, 1.00], [1.95, 1.00],
    [0.05, 1.95], [1.95, 1.95],
  ],
};

const STORAGE_1F = {
  index: 12,
  physicalFloor: 1,
  building: 'storage',
  code: '倉庫1F',
  titleJp: 'コンクリート倉庫棟（2m×2m・低天井）1階 平面詳細図',
  subtitle: '灰色RC打放しコンクリート固め（CH1,920）・1F 倉庫2室（S101・S102）＋外階段 STS1',
  baseY: 0.0,
  ceilingH: 1.92,
  slabTopY: 2.12,
  floorLabel: 'S1FL±0',
  width: 2.0,
  depth: 2.0,
  isConcreteStorage: true,
  rooms: [
    {
      id: 's1_north', code: 'S101', building: 'storage', floor: 1, nameJp: '倉庫1F・北コンクリート室 (1/4)', nameEn: 'Storage 1F North',
      x: 0.10, z: 0.10, w: 1.80, d: 0.86, area: 1.55, jo: 0.96, fl: 'S1FL±0', ch: 'CH1920',
      floorTex: 'concrete_clean', floorName: '金鏝押え灰色コンクリート',
      wallName: 'Pコン打放しコンクリート固め・重鋼製扉 DS-1', tint: '#ced2d6', labelPos: [1.00, 0.53],
      notes: '2×2mコンクリート棟の1F北倉庫。低天井1,920mm・スチール棚＆木箱収容',
    },
    {
      id: 's1_south', code: 'S102', building: 'storage', floor: 1, nameJp: '倉庫1F・南コンクリート室 (2/4)', nameEn: 'Storage 1F South',
      x: 0.10, z: 1.04, w: 1.80, d: 0.86, area: 1.55, jo: 0.96, fl: 'S1FL±0', ch: 'CH1920',
      floorTex: 'concrete_clean', floorName: '金鏝押え灰色コンクリート',
      wallName: 'Pコン打放しコンクリート固め・鋼製引戸 DS-12', tint: '#c5cacf', labelPos: [1.00, 1.47],
      notes: 'DS-12引戸で北室から直結する1F南倉庫。重備品・木箱・工具棚',
    },
  ],
  walls: [
    { id: 'WS1_N', axis: 'h', x1: 0, z1: 0, x2: 2.0, z2: 0.10, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WS1_S', axis: 'h', x1: 0, z1: 1.90, x2: 2.0, z2: 2.0, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    {
      id: 'WS1_W', axis: 'v', x1: 0, z1: 0.10, x2: 0.10, z2: 1.90, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon',
      openings: [
        { id: 'DS-1', type: 'door_swing', pos: 0.18, width: 0.72, height: 1.76, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DS-1 倉庫1F鋼製扉' },
      ],
    },
    {
      id: 'WS1_E', axis: 'v', x1: 1.90, z1: 0.10, x2: 2.0, z2: 1.90, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon',
      openings: [
        { id: 'WS1-1', type: 'window_frosted', pos: 0.25, width: 0.55, height: 0.28, sill: 1.48, label: 'WS1-1 換気スリット窓' },
        { id: 'WS1-2', type: 'window_frosted', pos: 1.20, width: 0.55, height: 0.28, sill: 1.48, label: 'WS1-2 換気スリット窓' },
      ],
    },
    {
      id: 'WS1_DIV', axis: 'h', x1: 0.10, z1: 0.96, x2: 1.90, z2: 1.04, kind: 'int', texA: 'concrete_pcon', texB: 'concrete_pcon',
      openings: [
        { id: 'DS-12', type: 'door_pocket', pos: 0.22, width: 0.70, height: 1.76, sill: 0, tex: 'exterior_siding_grey', slideDir: 1, label: 'DS-12 倉庫1F間仕切鉄引戸' },
      ],
    },
  ],
  stairUp: { id: 'STS1', label: 'UP 倉庫2Fへ (外階段)', dir: 'north' },
  stairDown: null,
  lighting: [
    { type: 'BH', x: 0.95, z: 0.53, label: 'BH-S101 防湿バルクヘッド灯' },
    { type: 'BH', x: 0.95, z: 1.47, label: 'BH-S102 防湿バルクヘッド灯' },
  ],
  switches: [{ x: 0.18, z: 0.88, label: 'SWS1' }],
  outlets: [{ x: 1.82, z: 0.53, label: '防雨2P' }],
  plumbing: [{ kind: 'vent', x: 1.80, z: 1.47, label: '排気ガラリ' }],
  flowPaths: [
    { kind: 'entry', pts: [[-0.45, 0.54], [0.58, 0.54], [0.58, 1.47]] },
    { kind: 'work', pts: [[2.40, 2.00], [2.40, 0.00]] },
  ],
};

const STORAGE_2F = {
  index: 13,
  physicalFloor: 2,
  building: 'storage',
  code: '倉庫2F',
  titleJp: 'コンクリート倉庫棟（2m×2m・低天井）2階 平面詳細図',
  subtitle: '灰色RC打放しコンクリート固め（CH1,920）・2F 倉庫2室（S201・S202 / 計4室完成）＋鋼製踊場',
  baseY: 2.12,
  ceilingH: 1.92,
  slabTopY: 4.28,
  floorLabel: 'S2FL+2120',
  width: 2.0,
  depth: 2.0,
  isConcreteStorage: true,
  rooms: [
    {
      id: 's2_north', code: 'S201', building: 'storage', floor: 2, nameJp: '倉庫2F・北コンクリート室 (3/4)', nameEn: 'Storage 2F North',
      x: 0.10, z: 0.10, w: 1.80, d: 0.86, area: 1.55, jo: 0.96, fl: 'S2FL±0', ch: 'CH1920',
      floorTex: 'concrete_clean', floorName: '金鏝押え灰色コンクリート',
      wallName: 'Pコン打放しコンクリート固め・2F鋼製扉 DS-2', tint: '#ced2d6', labelPos: [1.00, 0.53],
      notes: '外階段 STS1→2F鋼製踊場から入る2F北倉庫。低天井1,920mm・棚＆麻袋',
    },
    {
      id: 's2_south', code: 'S202', building: 'storage', floor: 2, nameJp: '倉庫2F・南コンクリート室 (4/4)', nameEn: 'Storage 2F South',
      x: 0.10, z: 1.04, w: 1.80, d: 0.86, area: 1.55, jo: 0.96, fl: 'S2FL±0', ch: 'CH1920',
      floorTex: 'concrete_clean', floorName: '金鏝押え灰色コンクリート',
      wallName: 'Pコン打放しコンクリート固め・鋼製引戸 DS-22', tint: '#c5cacf', labelPos: [1.00, 1.47],
      notes: 'DS-22引戸で直結する4番目のコンクリート倉庫室。完全密閉保管室',
    },
  ],
  walls: [
    {
      id: 'WS2_N', axis: 'h', x1: 0, z1: 0, x2: 2.0, z2: 0.10, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon',
      openings: [
        { id: 'DS-2', type: 'door_swing', pos: 0.55, width: 0.72, height: 1.76, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DS-2 倉庫2F鋼製扉' },
      ],
    },
    { id: 'WS2_S', axis: 'h', x1: 0, z1: 1.90, x2: 2.0, z2: 2.0, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WS2_W', axis: 'v', x1: 0, z1: 0.10, x2: 0.10, z2: 1.90, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    {
      id: 'WS2_E', axis: 'v', x1: 1.90, z1: 0.10, x2: 2.0, z2: 1.90, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon',
      openings: [
        { id: 'WS2-1', type: 'window_frosted', pos: 0.25, width: 0.55, height: 0.28, sill: 1.48, label: 'WS2-1 2F換気スリット窓' },
        { id: 'WS2-2', type: 'window_frosted', pos: 1.20, width: 0.55, height: 0.28, sill: 1.48, label: 'WS2-2 2F換気スリット窓' },
      ],
    },
    {
      id: 'WS2_DIV', axis: 'h', x1: 0.10, z1: 0.96, x2: 1.90, z2: 1.04, kind: 'int', texA: 'concrete_pcon', texB: 'concrete_pcon',
      openings: [
        { id: 'DS-22', type: 'door_pocket', pos: 0.22, width: 0.70, height: 1.76, sill: 0, tex: 'exterior_siding_grey', slideDir: 1, label: 'DS-22 倉庫2F間仕切鉄引戸' },
      ],
    },
  ],
  stairUp: null,
  stairDown: { id: 'STS1', label: 'DN 倉庫1Fへ (外階段)', dir: 'south' },
  lighting: [
    { type: 'BH', x: 0.95, z: 0.53, label: 'BH-S201 2Fバルクヘッド灯' },
    { type: 'BH', x: 0.95, z: 1.47, label: 'BH-S202 2Fバルクヘッド灯' },
  ],
  switches: [{ x: 1.36, z: 0.18, label: 'SWS2' }],
  outlets: [{ x: 1.82, z: 0.53, label: '防雨2P' }],
  plumbing: [{ kind: 'vent', x: 1.80, z: 1.47, label: '排気ガラリ' }],
  flowPaths: [
    { kind: 'entry', pts: [[2.40, -0.35], [0.91, -0.35], [0.91, 0.53], [0.58, 1.47]] },
  ],
};

import { CAMPER, CAMPER_SHEETS } from './camperData.js';
import { KEI, KEI_PLAN } from './keiData.js';
export { CAMPER, CAMPER_SHEETS, KEI, KEI_PLAN };

export const FLOORS = [FLOOR_B1F, FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_4F, FLOOR_5F, FLOOR_6F, FLOOR_RF];
export const ANNEX_FLOORS = [ANNEX_1F, ANNEX_2F, ANNEX_3F, ANNEX_ATTIC];
export const STORAGE_FLOORS = [STORAGE_1F, STORAGE_2F];
export const SHEET_OFFSETS = {
  main: 0,
  annex: FLOORS.length,
  storage: FLOORS.length + ANNEX_FLOORS.length,
  camper: FLOORS.length + ANNEX_FLOORS.length + STORAGE_FLOORS.length,
  kei: FLOORS.length + ANNEX_FLOORS.length + STORAGE_FLOORS.length + CAMPER_SHEETS.length,
};
export const BLUEPRINT_SHEETS = [...FLOORS, ...ANNEX_FLOORS, ...STORAGE_FLOORS, ...CAMPER_SHEETS, KEI_PLAN];
export const ALL_ROOMS = BLUEPRINT_SHEETS.flatMap((f) => f.rooms);
export const ROOMS = FLOOR_1F.rooms;
export const WALLS = FLOOR_1F.walls;

export const FINISH_SCHEDULE = [
  { floor: '外部', room: '基礎・SRC外壁・制振ブレース・森道', floorTex: 'paver_moss_stones', floorName: '苔石アプローチ・中庭小径・コンクリート歩道', wallTex: 'yakisugi_deep', wallName: '深焼杉板・漆喰・SRC鉄骨帯・制振ブレース・RC打放(倉庫)', accentTex: 'stone_moss_wall', accentName: '苔石基礎・避雷針マスト・木鉄パーゴラ' },
  { floor: '母屋B1F', room: '地下3×7m主空間＋倉庫3室', floorTex: 'concrete_clean', floorName: '金鏝押え灰色セメント土間', wallTex: 'concrete_pcon', wallName: '灰色RC打放擁壁 (CH2,020)', accentTex: 'metal_grate', accentName: '排水溝・倉庫棚15基' },
  { floor: '母屋1〜3F', room: '玄関・LDK・書斎・茶室・バー', floorTex: 'wood_floor', floorName: '白テラゾー / オーク / 琉球畳', wallTex: 'wood_slats', wallName: '杉板RC・赤煉瓦・セージ漆喰', accentTex: 'marble_black', accentName: '黒大理石バー・和紙障子' },
  { floor: '母屋4F', room: 'プロ監修5室＋1×2m南東バルコニー', floorTex: 'parquet_oak', floorName: 'オーク / ウォールナット / ウッドデッキ', wallTex: 'travertine', wallName: 'トラバーチン・縦木格子 (CH2,150)', accentTex: 'wood_deck', accentName: '1×2m樹冠バルコニー・全引戸' },
  { floor: '母屋5F', room: '建築模型工房・檜サウナ展望風呂・ボタニカル温室', floorTex: 'terrazzo_emerald', floorName: '白テラゾー / オーク寄木 / 檜スノコ / 緑テラゾー', wallTex: 'green_wall', wallName: 'PコンRC・檜羽目板・濡御影石・緑化壁 (CH2,550)', accentTex: 'wood_deck', accentName: '1.0×2.6m西外気浴デッキ・1/50模型' },
  { floor: '母屋6F', room: '天空ペントハウス・赤道儀天文サロン・珈琲バー', floorTex: 'wood_walnut_floor', floorName: 'ウォールナット / 琉球畳 / 黒大理石 / 市松石', wallTex: 'marble_black', wallName: '白漆喰・スレートブルー・古暗煉瓦・SRC梁現し (CH2,650)', accentTex: 'metal_bronze', accentName: '4.6×1.1m全幅スカイテラス・望遠鏡・吊暖炉' },
  { floor: '母屋RF', room: '6寸勾配屋根裏部屋 (地上16.1〜18.9m)', floorTex: 'tatami_aged', floorName: '防滑ゴム / 古杉板 / 古畳', wallTex: 'plywood_attic', wallName: '構造合板6寸勾配天井・レトロ花柄妻壁', accentTex: 'crate_wood', accentName: '現し棟木・吊りランタン・避雷針' },
  { floor: '隣棟1〜2F', room: '離れ(5×8m) カフェLDK・書庫・畳・寝室', floorTex: 'wood_walnut_floor', floorName: '御影石 / 白テラゾー / ウォールナット / 畳', wallTex: 'brick_red_classic', wallName: 'PコンRC・赤煉瓦・セージ漆喰・花柄', accentTex: 'fabric_denim', accentName: 'デニムソファ・カフェキッチン' },
  { floor: '隣棟3F', room: '離れ3F 6室＋1×1.6mバルコニー×3', floorTex: 'parquet_oak', floorName: 'オーク寄木 / カーペット / 琉球畳 / デッキ', wallTex: 'brick_cream', wallName: 'トラバーチン・クリーム煉瓦・セージ漆喰', accentTex: 'wood_deck', accentName: '北・西・南 3方向バルコニー' },
  { floor: '隣棟屋根裏', room: '離れ屋根裏 全5部屋（6寸勾配）', floorTex: 'wood_scratched_cedar', floorName: '古杉板 / 寄木 / 古畳 / スタッドゴム', wallTex: 'plywood_attic', wallName: '構造合板切妻勾配天井・有孔ボード', accentTex: 'crate_wood', accentName: '現し垂木・木箱・和紙ランタン' },
  { floor: '倉庫棟1〜2F', room: '別棟2×2m 灰色RC倉庫（計4室）', floorTex: 'concrete_clean', floorName: '金鏝押え灰色コンクリート', wallTex: 'concrete_pcon', wallName: '低天井コンクリート固め (CH1,920)', accentTex: 'metal_grate', accentName: '外鉄骨階段・スチール棚・鋼製扉' },
  { floor: 'RV 1F', room: '巨大キャンピングカー1F 全14室＋極狭廊下', floorTex: 'wood_walnut_floor', floorName: 'ウォールナット / 防滑ゴム / 浴室タイル', wallTex: 'exterior_siding_grey', wallName: '断熱装甲FRP外装・木縦格子・装甲シェルター', accentTex: 'tile_emerald_gloss', accentName: '高天井CH3,020天窓・W460廊下' },
  { floor: 'RV 2F', room: '巨大キャンピングカー2F ロフト2室＋ブリッジ', floorTex: 'carpet_beige', floorName: '防音ベージュカーペット / 琉球半帖畳', wallTex: 'plywood_attic', wallName: '構造合板ロフト内装・上部パノラマ窓', accentTex: 'wood_walnut_floor', accentName: '強化ガラス手摺吹抜・STC1梯子' },
  { floor: '軽バン', room: '日常使い軽自動車(3.40×1.48×1.80m・1席+荷室)', floorTex: 'rubber_black_stud', floorName: '荷室防滑リブゴム＋コンパネ合板下地', wallTex: 'panel_white_vert', wallName: '商用アイボリー鋼板外装・合板DIY内張', accentTex: 'crate_wood', accentName: 'RHD1席のみ・DIY2段棚・オリコン' },
];

export const OPENING_SCHEDULE = [
  { code: 'DB-1〜3 / ST0〜6', kind: '母屋 地下鉄扉・7層積層階段コア', size: 'W750〜1000', spec: '母屋 B1F↔1F↔2F↔3F↔4F↔5F↔6F↔屋根裏(8層) 連続積層直階段＆RC耐震コア' },
  { code: 'D5-1〜5 / W5-1〜9', kind: '母屋 5F全引戸＋西外気浴デッキ戸', size: 'W740〜1050×H2100', spec: '設計工房・檜サウナ・展望風呂・温室全引戸＋西1.0×2.6mスパデッキ掃出ガラス引戸' },
  { code: 'D6-1〜5 / W6-1〜8', kind: '母屋 6F全引戸＋全幅スカイテラス戸', size: 'W760〜1100×H2200', spec: '星見畳障子・天空パウダー・ワインセラー・天文サロン全引戸＋南4.6×1.1m全幅テラス戸' },
  { code: 'DA-1〜4 / STA1〜3', kind: '隣棟 1〜2F建具・3層積層階段', size: 'W780〜1000', spec: 'オーク玄関扉(DA-1)・STA1〜STA3(1F↔2F↔3F↔屋根裏)' },
  { code: 'DA3-1〜6 / B1〜3', kind: '隣棟 3F全引戸＋3バルコニー戸', size: 'W720〜960×H2020', spec: '6部屋全引戸＋北/西/南 1×1.6mバルコニー掃出ガラス引戸×3' },
  { code: 'DAR-1〜5', kind: '隣棟 屋根裏 5部屋引戸', size: 'W720〜740×H1740', spec: '6寸勾配小屋裏対応 ローハイト引戸×5（全5室独立アクセス）' },
  { code: 'DS-1〜22 / STS1', kind: 'コンクリート倉庫棟 鋼製扉・外階段', size: 'W700〜720×H1760', spec: '低天井RC倉庫 1F/2F外開鋼製扉・間仕切鉄引戸・外鉄骨階段(11段)' },
  { code: 'DC-1〜14 / STC1', kind: '巨大キャンピングカー全15扉・ロフト梯子', size: 'W460〜580×H1880', spec: '外開RV扉(DC-1)・14室全引戸(装甲扉DC-10含む)・STC1ロフト階段(9段)' },
  { code: 'DK-D / DK-L / DK-R', kind: '日常使い軽バン 運転席扉・スライド・跳上ハッチ', size: 'W800〜1180×H1300', spec: '右運転席外開(DK-D)・左外スライド荷室扉(DK-L)・リア跳上ハッチ(DK-R)' },
];




