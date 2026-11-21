/**
 * Single Source of Truth — NARROW-50 TOWER
 * 5.00m × 10.00m 3-Story + Gable Attic (3階建て + 屋根裏部屋) Compact Deep-Forest Residence
 *
 * Coordinate System:
 *   X: 0.00m (West exterior) -> 5.00m (East exterior)
 *   Z: 0.00m (North exterior / Deep Forest Trail) -> 10.00m (South exterior / Moonlit Cedar Clearing)
 *   Y:
 *     - Floor 0 (1F): baseY = 0.00m (CH 2.50m, Slab Top 2.75m, Doma -0.12m, Tatami +0.32m)
 *     - Floor 1 (2F): baseY = 2.75m (CH 2.50m, Slab Top 5.50m, Bath -0.02m)
 *     - Floor 2 (3F): baseY = 5.50m (CH 2.45m, Slab Top 8.15m)
 *     - Floor 3 (RF/屋根裏): baseY = 8.15m (Kneewall H 1.42m @ Y=9.57m, 6寸勾配 Ridge @ X=2.50m, Y=10.98m)
 *
 * Every coordinate drives BOTH the 3D WebGL scene AND the 4-Level 1/50 JIS CAD Blueprint.
 */

export const HOUSE = {
  name: 'NARROW-50 TOWER / 深い森の3階建て+屋根裏「樹冠と格子の塔屋」',
  subtitle: '5,000 × 10,000 mm（3階建+6寸勾配切妻小屋裏｜延床 150.00 m² + 小屋裏有効 28.50 m²）',
  width: 5.0,
  depth: 10.0,
  extWallThick: 0.15,
  intWallThick: 0.10,
  domaLevel: -0.12,
  tatamiLevel: 0.32,
  atticBaseY: 8.15,
  atticKneewallH: 1.42,
  atticEaveY: 9.57,
  atticRidgeY: 10.98,
  atticSlope: 0.60, // Exact Japanese 6寸勾配 (rise 6 / run 10)
  totalAreaM2: 150.0,
  atticUsableM2: 28.5,
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

// Structural Grid Axes (通り芯) shared vertically across all 4 levels
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
    { id: 'Y2', pos: 1.400, label: '1,325' },
    { id: 'Y3', pos: 2.450, label: '2,375' },
    { id: 'Y4', pos: 3.500, label: '3,425' },
    { id: 'Y5', pos: 5.250, label: '5,175' },
    { id: 'Y6', pos: 6.000, label: '5,925' },
    { id: 'Y7', pos: 9.925, label: '9,850' },
  ],
};

// Continuous Structural 120×120mm Timber Columns (通し柱・管柱)
export const COLUMNS = [
  [0.075, 0.075], [2.200, 0.075], [3.500, 0.075], [4.925, 0.075],
  [0.075, 2.450], [1.200, 2.450], [2.200, 2.450], [4.925, 2.450],
  [0.075, 3.500], [2.200, 3.500], [3.500, 3.500], [4.925, 3.500],
  [0.075, 5.250], [1.200, 5.250], [2.200, 5.250], [3.500, 5.250], [4.925, 5.250],
  [0.075, 6.000], [2.200, 6.000], [3.500, 6.000], [4.925, 6.000],
  [0.075, 9.925], [3.500, 9.925], [4.925, 9.925],
];

// =========================================================================
// FLOOR 0 — 1F (FL±0.00, CH 2.50m): 森の玄関・道具室・水回り・大開放LDK
// =========================================================================
const FLOOR_1F = {
  index: 0,
  code: '1F',
  titleJp: '1階 平面詳細図',
  subtitle: '玄関土間・森の道具室・LDK・小上がり畳ヌック・1F→2Fリビング階段',
  baseY: 0.0,
  ceilingH: 2.50,
  slabTopY: 2.75,
  floorLabel: '1FL±0',
  rooms: [
    {
      id: 'f1_genkan', code: '1R01', floor: 0, nameJp: '玄関土間', nameEn: 'Genkan Doma',
      x: 0.15, z: 0.15, w: 2.00, d: 1.20, area: 2.40, jo: 1.48, fl: 'FL-120', ch: 'CH2500',
      floorTex: 'terrazzo_white', floorName: '白テラゾー石調タイル',
      wallName: '織物調白クロス + 杉板型枠RCコア', tint: '#e4e7ea', labelPos: [1.15, 0.78],
      notes: '上がり框H120mm、フロート下駄箱＋足元間接照明、外アプローチ苔石舗装',
    },
    {
      id: 'f1_hall', code: '1R02', floor: 0, nameJp: '玄関ホール・階段下収納', nameEn: 'Entry Hall',
      x: 0.15, z: 1.35, w: 2.00, d: 1.10, area: 2.20, jo: 1.36, fl: 'FL±0', ch: 'CH2450',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '杉板型枠コンクリート＋白クロス', tint: '#f3e5d0', labelPos: [1.15, 1.90],
      notes: '階段下コート収納・分電盤・インターホン・道具室直結動線',
    },
    {
      id: 'f1_gear', code: '1R03', floor: 0, nameJp: '森の道具室・薪パントリー', nameEn: 'Forest Gear Room',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'tile_grey_stone', floorName: '濃灰スレート石調タイル',
      wallName: '傷刻み杉板＋有孔ボード＋本棚', tint: '#e2e1dd', labelPos: [3.55, 1.80],
      notes: '森暮らしの薪棚・木箱収納・有孔ボード工具壁・北森ビュー窓',
    },
    {
      id: 'f1_passage', code: '1R04', floor: 0, nameJp: '1F ギャラリー廊下', nameEn: '1F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 2.80, area: 2.52, jo: 1.55, fl: 'FL±0', ch: 'CH2450',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '杉板型枠RC階段コア壁＋アート額', tint: '#f5ead8', labelPos: [1.70, 3.85],
      notes: '階段コア沿い有効幅900mm、1Fトイレ＆LDKへ一直線アクセス',
    },
    {
      id: 'f1_wc', code: '1R05', floor: 0, nameJp: '1F トイレ', nameEn: '1F WC',
      x: 2.25, z: 3.55, w: 1.10, d: 1.65, area: 1.82, jo: 1.12, fl: 'FL±0', ch: 'CH2350',
      floorTex: 'tile_beige_grid', floorName: 'ベージュ磁器質タイル',
      wallName: '白クロス＋ミントモザイクタイル', tint: '#e5eee8', labelPos: [2.80, 4.35],
      notes: 'タンクレストイレ・独立手洗器・廊下干渉ゼロの引戸',
    },
    {
      id: 'f1_utility', code: '1R06', floor: 0, nameJp: '食品庫・土間水栓室', nameEn: 'Pantry Utility',
      x: 3.45, z: 3.55, w: 1.40, d: 1.65, area: 2.31, jo: 1.43, fl: 'FL±0', ch: 'CH2350',
      floorTex: 'terrazzo_emerald', floorName: 'エメラルドテラゾー',
      wallName: '白小口タイル＋可動食品棚', tint: '#dfebe4', labelPos: [4.15, 4.35],
      notes: 'キッチン北裏のパントリー・大型冷蔵庫・泥落としシンク',
    },
    {
      id: 'f1_ldk', code: '1R07', floor: 0, nameJp: 'LDK（リビング・ダイニング）', nameEn: '1F LDK',
      x: 0.15, z: 5.25, w: 4.70, d: 4.60, area: 19.66, jo: 12.14, fl: 'FL±0', ch: 'CH2500',
      floorTex: 'wood_floor', floorName: '天然オーク複合フローリング',
      wallName: '木縦格子TV壁(西)＋キャラメル煉瓦タイル(東)', tint: '#f7ecd8', labelPos: [2.00, 7.60],
      notes: '幅4.7m全幅LDK・壁掛け55型TV・I型キッチン・南大開口縁側デッキ',
    },
    {
      id: 'f1_tatami', code: '1R08', floor: 0, nameJp: '小上がり畳ヌック', nameEn: 'Tatami Nook',
      x: 3.45, z: 8.45, w: 1.40, d: 1.40, area: 1.96, jo: 1.21, fl: 'FL+320', ch: 'CH2180',
      floorTex: 'tatami', floorName: '縁無し半帖畳',
      wallName: '黄土色漆喰＋和紙行灯', tint: '#dfe7ca', labelPos: [4.15, 9.15],
      notes: 'FL+320小上がり、和紙ランタン点灯可能・南森の月明かり特等席',
    },
  ],
  walls: [
    // Exterior Perimeter
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
    // Interior Walls
    { id: 'W1_ST_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.25, z2: 5.15, kind: 'int', texA: 'concrete_cedar_form', texB: 'concrete_cedar_form', openings: [] },
    { id: 'W1_ST_N', axis: 'h', x1: 0.15, z1: 2.40, x2: 1.25, z2: 2.50, kind: 'int', texA: 'concrete_cedar_form', texB: 'wallpaper_white', openings: [] },
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
  stairDown: null,
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
// FLOOR 1 — 2F (FL+2,750, CH 2.50m): 森の書斎・水回り/浴室・主寝室スイート
// =========================================================================
const FLOOR_2F = {
  index: 1,
  code: '2F',
  titleJp: '2階 平面詳細図',
  subtitle: '森の書斎・洗面ランドリー・1317浴室・主寝室スイート・ST1/ST2階段コア',
  baseY: 2.75,
  ceilingH: 2.50,
  slabTopY: 5.50,
  floorLabel: '2FL+2750',
  rooms: [
    {
      id: 'f2_landing', code: '2R01', floor: 1, nameJp: '2F 北階段ホール', nameEn: '2F North Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '2FL±0', ch: 'CH2500',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット無垢調フローリング',
      wallName: '織物調白クロス＋北森展望窓', tint: '#ebd9c2', labelPos: [1.15, 1.30],
      notes: '1Fからの階段上り口。北側の森を額縁状に切り取る高窓ベンチ',
    },
    {
      id: 'f2_study', code: '2R02', floor: 1, nameJp: '森の書斎・ワークスタジオ', nameEn: 'Forest Study',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '2FL±0', ch: 'CH2500',
      floorTex: 'carpet_charcoal_tile', floorName: 'チャコールタイルカーペット',
      wallName: '赤煉瓦(東)＋打放RC(北)＋コルク/有孔ボード', tint: '#dbd9d6', labelPos: [3.55, 1.80],
      notes: '静寂のリモートワーク＆読書書斎。造作デスク・有孔ボード・コルクボード',
    },
    {
      id: 'f2_gallery', code: '2R03', floor: 1, nameJp: '2F 中央ギャラリー・階段前室', nameEn: '2F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '2FL±0', ch: 'CH2450',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナットフローリング',
      wallName: '木製腰壁＋杉板RC階段壁', tint: '#eedecc', labelPos: [1.70, 4.15],
      notes: 'ST2(3Fへ)昇降前室・水回り・主寝室を結ぶ2F回遊スパイン',
    },
    {
      id: 'f2_washroom', code: '2R04', floor: 1, nameJp: '洗面脱衣・ランドリー', nameEn: 'Washroom & Laundry',
      x: 2.25, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '2FL±0', ch: 'CH2350',
      floorTex: 'terrazzo_white', floorName: '白テラゾー防水床',
      wallName: 'エメラルド光沢タイル＋白大理石造作洗面', tint: '#dcebdf', labelPos: [2.88, 4.75],
      notes: 'W900大理石カウンター洗面＋間接光鏡＋ドラム式洗濯乾燥機',
    },
    {
      id: 'f2_bath', code: '2R05', floor: 1, nameJp: '1317 森見ユニットバス', nameEn: '1317 Unit Bath',
      x: 3.60, z: 3.55, w: 1.25, d: 2.40, area: 3.00, jo: 1.85, fl: '2FL-20', ch: 'CH2250',
      floorTex: 'tile_blue_bath', floorName: '防滑ブルー石調バスタイル',
      wallName: '濡れ御影石パネル＋白小口タイル', tint: '#d5e4ee', labelPos: [4.22, 4.75],
      notes: '2階プライベートバスルーム。東高窓から深夜の杉木立を望む',
    },
    {
      id: 'f2_bedroom', code: '2R06', floor: 1, nameJp: '主寝室スイート', nameEn: 'Master Bedroom Suite',
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
    // Interior
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
// FLOOR 2 — 3F (FL+5,500, CH 2.45m): 琉球畳茶室・パウダー・樹冠展望アトリエ
// =========================================================================
const FLOOR_3F = {
  index: 2,
  code: '3F',
  titleJp: '3階 平面詳細図',
  subtitle: '琉球畳茶室客間・コバルトパウダーWC・納戸・樹冠展望アトリエバー・ST3屋根裏階段',
  baseY: 5.50,
  ceilingH: 2.45,
  slabTopY: 8.15,
  floorLabel: '3FL+5500',
  rooms: [
    {
      id: 'f3_landing', code: '3R01', floor: 2, nameJp: '3F 北階段ホール', nameEn: '3F North Landing',
      x: 0.15, z: 0.15, w: 2.00, d: 2.30, area: 4.60, jo: 2.84, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '白漆喰＋杉樹冠ピクチャーウィンドウ', tint: '#f0e2c9', labelPos: [1.15, 1.30],
      notes: '地上6.5mの樹冠目線ホール。北側の老杉梢を見下ろす',
    },
    {
      id: 'f3_tearoom', code: '3R02', floor: 2, nameJp: '琉球畳の茶室・客間', nameEn: 'Ryukyu Tatami Room',
      x: 2.25, z: 0.15, w: 2.60, d: 3.30, area: 8.58, jo: 5.30, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳(市松敷)',
      wallName: 'セージグリーン漆喰＋バックライト和紙障子', tint: '#dce6d4', labelPos: [3.55, 1.80],
      notes: '和紙障子と簾が月光を濾す静謐な和モダン客間。ちゃぶ台＋来客布団',
    },
    {
      id: 'f3_gallery', code: '3R03', floor: 2, nameJp: '3F ギャラリー・屋根裏階段前室', nameEn: '3F Gallery',
      x: 1.25, z: 2.45, w: 0.90, d: 3.50, area: 3.95, jo: 2.44, fl: '3FL±0', ch: 'CH2450',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: '濃茶腰板＋杉板RCコア壁', tint: '#f3e7d2', labelPos: [1.70, 4.15],
      notes: 'ST3(屋根裏部屋へ)昇降前室。アトリエと茶室を繋ぐ3階回廊',
    },
    {
      id: 'f3_powder', code: '3R04', floor: 2, nameJp: '3F パウダー・トイレ', nameEn: '3F Powder WC',
      x: 2.25, z: 3.55, w: 1.20, d: 2.40, area: 2.88, jo: 1.78, fl: '3FL±0', ch: 'CH2350',
      floorTex: 'tile_checker_stone', floorName: '市松ストーンタイル',
      wallName: 'コバルトモザイクタイル＋黒大理石カウンター', tint: '#d8e2ee', labelPos: [2.85, 4.75],
      notes: 'ホテルライクな3F専用パウダールーム＆トイレ。黒大理石ボウル洗面',
    },
    {
      id: 'f3_archive', code: '3R05', floor: 2, nameJp: '樹冠アーカイブ納戸', nameEn: 'Archive Closet',
      x: 3.55, z: 3.55, w: 1.30, d: 2.40, area: 3.12, jo: 1.93, fl: '3FL±0', ch: 'CH2350',
      floorTex: 'parquet_oak', floorName: 'オークパーケット',
      wallName: 'スレートブルーパネル＋有孔収納壁', tint: '#dee3ea', labelPos: [4.20, 4.75],
      notes: '季節衣類・画材・蔵書の大容量ウォークイン納戸',
    },
    {
      id: 'f3_atelier', code: '3R06', floor: 2, nameJp: '樹冠展望アトリエ・バーラウンジ', nameEn: 'Treetop Atelier Lounge',
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
    // Interior
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
  stairUp: { id: 'ST3', label: 'UP 屋根裏へ (13段)', dir: 'north' },
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
// FLOOR 3 — RF / 屋根裏部屋 (FL+8,150, 6寸勾配 軒1,420〜棟2,830)
// =========================================================================
const FLOOR_RF = {
  index: 3,
  code: '屋根裏',
  titleJp: '屋根裏部屋（小屋裏）平面詳細図',
  subtitle: '6寸勾配切妻小屋裏・鉄柵吹抜ハッチ・北保管庫・南秘密の読書室（有効床 28.50 m²）',
  baseY: 8.15,
  ceilingH: 2.83, // Peak ridge height at X=2.50m
  slabTopY: 10.98,
  floorLabel: 'RFL+8150',
  isAttic: true,
  rooms: [
    {
      id: 'f4_hatch', code: 'RF01', floor: 3, nameJp: '屋根裏ハッチ・鉄柵回廊', nameEn: 'Attic Hatch Gallery',
      x: 0.15, z: 0.15, w: 2.00, d: 5.10, area: 7.50, jo: 4.63, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'rubber_black_stud', floorName: '黒スタッド防滑ゴム床',
      wallName: 'ラスティック腰板＋無垢垂木表し', tint: '#d8d7d3', labelPos: [1.65, 1.35],
      notes: '3Fからの階段上がり口。黒アイアン安全柵から階下階段吹抜を見下ろす',
    },
    {
      id: 'f4_storage', code: 'RF02', floor: 3, nameJp: '北・小屋裏保管庫', nameEn: 'North Relic Storage',
      x: 2.15, z: 0.15, w: 2.70, d: 5.10, area: 13.77, jo: 8.50, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'wood_scratched_cedar', floorName: '古杉フローリング',
      wallName: '構造合板切妻勾配天井＋木箱・麻袋・ロープ', tint: '#e4d8c4', labelPos: [3.45, 2.55],
      notes: '木箱・麻袋・ロープ・思い出のクレヨン画を収めた静かな小屋裏倉庫',
    },
    {
      id: 'f4_sanctuary', code: 'RF03', floor: 3, nameJp: '南・秘密の小屋裏読書室', nameEn: 'Secret Attic Sanctuary',
      x: 0.15, z: 5.25, w: 4.70, d: 4.60, area: 21.62, jo: 13.35, fl: 'RFL±0', ch: 'CH1420〜2830',
      floorTex: 'tatami_aged', floorName: '古畳＋古杉板張',
      wallName: 'レトロ花柄クロス妻壁＋有孔ボード＋吊りランタン', tint: '#e6dec9', labelPos: [2.50, 7.55],
      notes: '棟木直下の秘密基地。吊りアイアンランタンと南妻三角窓から月夜の森を一望',
    },
  ],
  walls: [
    // Attic Gable End & Kneewall Perimeter (handled specially in 3D gable builder, exact CAD footprint here)
    {
      id: 'W4_N', axis: 'h', x1: 0, z1: 0, x2: 5.0, z2: 0.15, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wood_scratched_cedar',
      openings: [
        { id: 'W4-1', type: 'window', pos: 1.80, width: 1.40, height: 1.35, sill: 0.65, label: 'W4-1 北切妻妻窓' },
      ],
    },
    {
      id: 'W4_S', axis: 'h', x1: 0, z1: 9.85, x2: 5.0, z2: 10.0, kind: 'ext', extTex: 'yakisugi_deep', intTex: 'wallpaper_vintage_floral',
      openings: [
        { id: 'W4-2', type: 'window', pos: 1.70, width: 1.60, height: 1.45, sill: 0.60, label: 'W4-2 南切妻展望窓' },
      ],
    },
    { id: 'W4_W', axis: 'v', x1: 0, z1: 0.15, x2: 0.15, z2: 9.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    { id: 'W4_E', axis: 'v', x1: 4.85, z1: 0.15, x2: 5.0, z2: 9.85, kind: 'ext_knee', extTex: 'yakisugi_deep', intTex: 'wainscot_rustic', openings: [] },
    // Guardrails around ST3 hatch & partial truss lattice divider
    { id: 'W4_RAIL_E', axis: 'v', x1: 1.15, z1: 2.45, x2: 1.24, z2: 5.24, kind: 'railing', openings: [] },
    { id: 'W4_RAIL_S', axis: 'h', x1: 0.15, z1: 5.15, x2: 1.24, z2: 5.24, kind: 'railing', openings: [] },
    { id: 'W4_DIV_E', axis: 'h', x1: 3.10, z1: 5.20, x2: 4.85, z2: 5.30, kind: 'low_screen', texA: 'wood_lattice_dark', texB: 'pegboard_wood', openings: [] },
  ],
  stairUp: null,
  stairDown: { id: 'ST3', label: 'DN 3Fへ', dir: 'south' },
  lighting: [
    { type: 'BL', x: 1.65, z: 1.50, label: 'BL-401 小屋裏ハッチ灯' },
    { type: 'PD', x: 3.10, z: 2.50, label: 'PD-402 倉庫裸電球' },
    { type: 'LN', x: 2.50, z: 7.45, label: 'LN-403 吊り小屋裏ランタン' },
  ],
  switches: [
    { x: 1.32, z: 2.30, label: 'SW41' },
    { x: 2.95, z: 5.38, label: 'SW42' },
  ],
  outlets: [
    { x: 3.15, z: 5.38, label: '読書灯2P' },
    { x: 2.50, z: 9.70, label: '窓際2P' },
  ],
  plumbing: [
    { kind: 'vent', x: 2.50, z: 0.40, label: '棟換気(北)' },
    { kind: 'vent', x: 2.50, z: 9.60, label: '棟換気(南)' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[0.65, 2.25], [1.95, 1.80], [2.25, 5.50], [2.50, 7.60]] },
    { kind: 'work', pts: [[1.95, 1.80], [3.35, 2.20]] },
  ],
};

export const FLOORS = [FLOOR_1F, FLOOR_2F, FLOOR_3F, FLOOR_RF];

// Backwards-compatible flattened list of all rooms across 4 levels
export const ALL_ROOMS = FLOORS.flatMap((f) => f.rooms);
export const ROOMS = FLOOR_1F.rooms;
export const WALLS = FLOOR_1F.walls;

// Architectural Finish Schedule spanning all 4 levels & exterior (referencing all key original + newly added materials)
export const FINISH_SCHEDULE = [
  { floor: '外部', room: '基礎・外壁・森道', floorTex: 'paver_moss_stones', floorName: '苔石アプローチ・森腐葉土', wallTex: 'yakisugi_deep', wallName: '深焼杉板(東西)・漆喰(南北)', accentTex: 'stone_moss_wall', accentName: '苔むす石積基礎・濡れ岩' },
  { floor: '1F', room: '玄関・廊下・階段コア', floorTex: 'terrazzo_white', floorName: '白テラゾー / オーク床', wallTex: 'concrete_cedar_form', wallName: '杉板型枠RCコア壁', accentTex: 'door_navy', accentName: 'ネイビー玄関ドア' },
  { floor: '1F', room: '森の道具室・水回り', floorTex: 'tile_grey_stone', floorName: 'スレート石 / 緑テラゾー', wallTex: 'wood_scratched_cedar', wallName: '古杉板・有孔ボード', accentTex: 'timber_logs', accentName: '積薪・ミントタイル' },
  { floor: '1F', room: 'LDK・小上がり畳', floorTex: 'wood_floor', floorName: 'オーク床 / 縁無半帖畳', wallTex: 'wood_slats', wallName: '木縦格子TV壁・黄土漆喰', accentTex: 'tile_caramel_brick', accentName: 'キャラメル煉瓦キッチン' },
  { floor: '2F', room: '森の書斎・スタジオ', floorTex: 'carpet_charcoal_tile', floorName: 'チャコールタイルカーペット', wallTex: 'brick_red_classic', wallName: '赤煉瓦＋打放RC(Pコン)', accentTex: 'cork_board', accentName: 'コルク＆有孔ボード' },
  { floor: '2F', room: '洗面・1317ユニットバス', floorTex: 'tile_blue_bath', floorName: '白テラゾー / 防滑青タイル', wallTex: 'tile_emerald_gloss', wallName: 'エメラルド艶タイル・濡れ御影', accentTex: 'marble_white', accentName: '白大理石造作洗面' },
  { floor: '2F', room: '主寝室スイート', floorTex: 'wood_walnut_floor', floorName: 'ウォールナット床＋ラグ', wallTex: 'plaster_beige', wallName: '珪藻土ベージュ＋濃木壁', accentTex: 'fabric_rose_vintage', accentName: '花柄キルト・ローズ枕' },
  { floor: '3F', room: '琉球畳茶室・パウダー', floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳 / 市松石タイル', wallTex: 'plaster_sage', wallName: 'セージ漆喰 / コバルトモザイク', accentTex: 'washi_paper', accentName: 'バックライト和紙障子' },
  { floor: '3F', room: '樹冠展望アトリエバー', floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット', wallTex: 'brick_aged_dark', wallName: '古暗煉瓦＋スレート納戸', accentTex: 'marble_black', accentName: '黒大理石バー・真鍮網灯' },
  { floor: '屋根裏', room: '小屋裏ハッチ・倉庫', floorTex: 'rubber_black_stud', floorName: '黒スタッドゴム / 古杉板', wallTex: 'plywood_attic', wallName: '合板6寸勾配天井・垂木表し', accentTex: 'crate_wood', accentName: '木箱・麻袋・ロープ' },
  { floor: '屋根裏', room: '南・秘密の小屋裏読書室', floorTex: 'tatami_aged', floorName: '古畳＋古杉縁板', wallTex: 'wallpaper_vintage_floral', wallName: 'レトロ花柄妻壁・ラスティック腰板', accentTex: 'pegboard_wood', accentName: '有孔棚・吊り鉄ランタン' },
];

export const OPENING_SCHEDULE = [
  { code: 'D1-1', kind: '1F 断熱玄関ドア', size: 'W900×H2250', spec: 'ネイビー木目断熱扉・スマートキー・森ポーチ直結' },
  { code: 'D1-2〜4', kind: '1F 室内扉・引戸', size: 'W750〜850×H2050', spec: 'ウォールナット片開 / 白引戸 / オークパントリー引戸' },
  { code: 'D2-1〜4', kind: '2F 室内・浴室扉', size: 'W720〜800×H2050', spec: '書斎オーク扉 / 洗面引戸 / 浴室ガラス扉 / 主寝室濃木扉' },
  { code: 'D3-1〜4', kind: '3F 和洋建具', size: 'W750〜850×H2100', spec: '茶室障子引戸 / パウダー引戸 / アトリエ格子ガラス扉 / 納戸引戸' },
  { code: 'ST1〜3', kind: '3層積層直階段', size: 'W1000×踏面207×13段', spec: '1F→2F→3F→屋根裏 連続直階段（有効天井高2,550mm確保）' },
  { code: 'W1-2', kind: '1F 南掃き出し大窓', size: 'W2550×H2220', spec: 'Low-Eトリプルガラス・縁側デッキ＆深い森へ開放' },
  { code: 'W2-5 / W3-4', kind: '2F/3F 樹冠パノラマ窓', size: 'W2550×H1720', spec: '老杉の樹冠中層〜上層を額縁状に切り取る大開口サッシ' },
  { code: 'W4-1 / W4-2', kind: '屋根裏 南北切妻窓', size: 'W1600×H1450', spec: '6寸勾配妻面の頂部展望窓・月明かりと梢の風を採り込む' },
];
