/**
 * Single Source of Truth — Giant Vehicle Warehouse (10m×20m×4.5m),
 * Armored Wooden Secret-Base Camper (15.5m×3.1m×4.0m, 1-Story),
 * Towable Cargo Container Trailer (2.0m×4.0m×3.0m),
 * & Exterior Attic Express Elevator (ELV-EXT: 1F Ground <-> RF Attic).
 */

// =========================================================================
// 1. GIANT VEHICLE WAREHOUSE — GARAGE-200 (10.00m × 20.00m × H4.50m)
// Positioned East of Compound on expanded level apron:
//   World X = 12.00 .. 22.00 m (Width 10,000 mm)
//   World Z = -6.00 .. +14.00 m (Length 20,000 mm)
//   Slab Y = -0.32 m -> Roof Eave/Parapet Y = +4.18 m (Total Height 4,500 mm EXACT!)
// =========================================================================
export const GARAGE = {
  name: 'GARAGE-200 / 巨大スチール車庫・整備倉庫 (10.0m×20.0m×H4.5m)',
  subtitle: '10,000 × 20,000 × H4,500 mm（鉄骨H形鋼門型フレーム・ガルバリウム折板・防塵エポキシ土間・大型電動シャッター前後2基）',
  originX: 12.00,
  originZ: -6.00,
  width: 10.00,
  depth: 20.00,
  height: 4.50,
  floorY: -0.32,
  clearH: 4.28,
  roofTopY: 4.18,
  gridAxes: {
    x: [
      { id: 'GX1', pos: 0.125, label: '0' },
      { id: 'GX2', pos: 5.800, label: '5,675' },
      { id: 'GX3', pos: 9.875, label: '9,750' },
    ],
    z: [
      { id: 'GY1', pos: 0.125, label: '0' },
      { id: 'GY2', pos: 5.000, label: '4,875' },
      { id: 'GY3', pos: 10.000, label: '9,875' },
      { id: 'GY4', pos: 15.000, label: '14,875' },
      { id: 'GY5', pos: 19.875, label: '19,750' },
    ],
  },
  columns: [
    [0.125, 0.125], [9.875, 0.125],
    [0.125, 5.000], [9.875, 5.000],
    [0.125, 10.000], [9.875, 10.000],
    [0.125, 15.000], [9.875, 15.000],
    [0.125, 19.875], [9.875, 19.875],
  ],
};

export const GARAGE_PLAN = {
  index: 20,
  physicalFloor: 1,
  building: 'garage',
  code: '車庫',
  titleJp: '巨大車倉庫（10.0m×20.0m×H4.5m）平面詳細図',
  subtitle: 'W10,000×L20,000×H4,500mm・鉄骨門型ラーメン構造・ARMOR-155格納レーン＋けん引コンテナ整備ベイ＋工具工房',
  baseY: GARAGE.floorY,
  ceilingH: GARAGE.clearH,
  slabTopY: GARAGE.roofTopY,
  floorLabel: 'GFL-320',
  width: GARAGE.width,
  depth: GARAGE.depth,
  isGarage: true,
  rooms: [
    {
      id: 'g_bay1', code: 'G01', building: 'garage', floor: 1, nameJp: '第1主車両格納レーン (15.5m装甲車)', nameEn: 'Main Armored Vehicle Bay',
      x: 0.25, z: 0.25, w: 5.55, d: 19.50, area: 108.23, jo: 66.81, fl: 'GFL±0', ch: 'CH4280',
      floorTex: 'warehouse_epoxy_floor', floorName: '防塵グレーエポキシ耐油コンクリート',
      wallName: 'ガルバリウム角波鋼板＋H形鋼鉄骨フレーム＋天井トラス', tint: '#d8dee4', labelPos: [3.05, 9.80],
      notes: '幅5.55m×全長19.5mの貫通格納レーン。前後W5,800×H4,250電動大型スチールシャッター（自動開閉）完備',
    },
    {
      id: 'g_bay2', code: 'G02', building: 'garage', floor: 1, nameJp: '第2コンテナ・予備車両整備ベイ', nameEn: 'Container & Aux Bay',
      x: 5.80, z: 6.00, w: 3.95, d: 13.75, area: 54.31, jo: 33.52, fl: 'GFL±0', ch: 'CH4280',
      floorTex: 'warehouse_epoxy_floor', floorName: '耐荷重エポキシ土間＋排水グレーチング',
      wallName: '角波鋼板・タイヤラック・コンプレッサー・非常用燃料保管', tint: '#cfd7df', labelPos: [7.78, 12.80],
      notes: '2×4×3m けん引コンテナ（CON-24）常駐ベイ。油圧ジャッキ・予備オフロードタイヤ・発電機を備える',
    },
    {
      id: 'g_workshop', code: 'G03', building: 'garage', floor: 1, nameJp: '北東・重機整備ワークベンチ＆資材棚', nameEn: 'Heavy Mechanic Workshop',
      x: 5.80, z: 0.25, w: 3.95, d: 5.75, area: 22.71, jo: 14.02, fl: 'GFL±0', ch: 'CH4280',
      floorTex: 'warehouse_epoxy_floor', floorName: '防塵エポキシ＋防振ラバーマット',
      wallName: '鋼製ワークベンチ・ロールキャビネット・4段重量スチール棚・ドラム缶架台', tint: '#dde2e7', labelPos: [7.78, 3.10],
      notes: '溶接・車両整備用スチール作業台、大型エアツール壁、予備部品重量ラック、200V産業用電源完備',
    },
  ],
  walls: [
    {
      id: 'WG_N', axis: 'h', x1: 0, z1: 0, x2: 10.0, z2: 0.24, kind: 'ext', extTex: 'warehouse_corrugated_steel', intTex: 'warehouse_corrugated_steel',
      openings: [
        { id: 'DG-N', type: 'door_rollup', pos: 0.85, width: 5.80, height: 4.22, sill: 0, tex: 'iron_shutter_slat', label: 'DG-N 北大型電動シャッター (W5800×H4220)' },
      ],
    },
    {
      id: 'WG_S', axis: 'h', x1: 0, z1: 19.76, x2: 10.0, z2: 20.0, kind: 'ext', extTex: 'warehouse_corrugated_steel', intTex: 'warehouse_corrugated_steel',
      openings: [
        { id: 'DG-S', type: 'door_rollup', pos: 0.85, width: 5.80, height: 4.22, sill: 0, tex: 'iron_shutter_slat', label: 'DG-S 南貫通電動シャッター (W5800×H4220)' },
      ],
    },
    {
      id: 'WG_W', axis: 'v', x1: 0, z1: 0.24, x2: 0.24, z2: 19.76, kind: 'ext', extTex: 'warehouse_corrugated_steel', intTex: 'warehouse_corrugated_steel',
      openings: [
        { id: 'DG-W', type: 'door_swing', pos: 7.50, width: 1.00, height: 2.15, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: 1, label: 'DG-W 母屋側汎用スチール扉' },
        { id: 'WG-1', type: 'window_high', pos: 2.00, width: 3.80, height: 0.65, sill: 3.30, label: 'WG-1 西高窓採光帯' },
        { id: 'WG-2', type: 'window_high', pos: 12.20, width: 4.80, height: 0.65, sill: 3.30, label: 'WG-2 西南高窓採光帯' },
      ],
    },
    {
      id: 'WG_E', axis: 'v', x1: 9.76, z1: 0.24, x2: 10.0, z2: 19.76, kind: 'ext', extTex: 'warehouse_corrugated_steel', intTex: 'warehouse_corrugated_steel',
      openings: [
        { id: 'WG-3', type: 'window_high', pos: 2.00, width: 4.80, height: 0.65, sill: 3.30, label: 'WG-3 東北高窓採光帯' },
        { id: 'WG-4', type: 'window_high', pos: 12.20, width: 4.80, height: 0.65, sill: 3.30, label: 'WG-4 東南高窓採光帯' },
      ],
    },
  ],
  lighting: [
    { type: 'HB', x: 3.0, z: 4.0, label: 'HB-G01 高天井LED 150W' },
    { type: 'HB', x: 3.0, z: 10.0, label: 'HB-G02 高天井LED 150W' },
    { type: 'HB', x: 3.0, z: 16.0, label: 'HB-G03 高天井LED 150W' },
    { type: 'HB', x: 7.8, z: 4.0, label: 'HB-G04 作業灯LED' },
    { type: 'HB', x: 7.8, z: 12.0, label: 'HB-G05 コンテナベイLED' },
  ],
  switches: [{ x: 0.45, z: 7.20, label: 'SWG1' }],
  outlets: [
    { x: 9.55, z: 2.50, label: '3相200V' },
    { x: 9.55, z: 10.00, label: 'EV/充電200V' },
  ],
  plumbing: [
    { kind: 'drain', pts: [[3.00, 1.50], [3.00, 18.50]] },
    { kind: 'vent', x: 9.60, z: 18.00, label: '大型有圧換気扇' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[3.75, -1.20], [3.75, 21.20]] },
    { kind: 'work', pts: [[-1.00, 8.00], [7.80, 8.00], [7.80, 3.00]] },
  ],
};

// =========================================================================
// 2. ARMORED WOODEN SECRET-BASE CAMPER — ARMOR-155 (15.50m × 3.10m × H4.00m)
// 1-Story Heavy Steel-Armored Expedition Fortress with Warm Cedar Secret-Base Interior:
//   - Outer Dimensions: W 3,100 mm × L 15,500 mm × H 4,000 mm (EXACT!)
//   - Ground Y = -0.32 -> Cabin Floor Top = +0.62 m (Chassis clearance 0.94m, 8×8 axles!)
//   - Interior Vaulted Clear Ceiling: CH 2,760 mm -> Roof Top = +3.68 m (Total H = 4.000m!)
//   - Exterior: Heavy bolted gunmetal steel armor + minimal slit windows + motorized IRON SHUTTERS!
//   - Interior: 100% Warm Wooden Secret Base (Cedar/Walnut, Wood-Burning Stove, Sunken Pit Lounge,
//     Butcher-Block Galley, Hinoki Steam Wet Pod, Vaulted Bunk Cave, Rear Blast Airlock & Tow Hitch)
//     ZERO structural/room overlap with existing CAMPER-75!
// =========================================================================
export const ARMOR_CAMPER = {
  name: 'ARMOR-155 / 装甲秘密基地キャンピングカー (3.1×15.5×H4.0m)',
  subtitle: '3,100 × 15,500 × H4,000 mm（1階建8×8重装甲鉄外装・電動鉄シャッター・木製秘密基地内装・コンテナけん引＆自律走行対応）',
  width: 3.10,
  length: 15.50,
  height: 4.00,
  // Parked inside Giant Vehicle Warehouse Bay 1 (World X = 14.05..17.15, Z = -4.55..+10.95)
  initialPose: {
    cx: 15.60,
    cz: 3.20,
    yaw: 0.0, // Facing North (-Z) straight toward North Garage Gate!
  },
  groundY: -0.32,
  chassisClearY: 0.94,      // Ground (-0.32) to interior wood deck (+0.62)
  floorWorldY: 0.62,
  interiorClearH: 2.76,     // Tall vaulted timber secret-base headroom!
  roofTopWorldY: 3.68,      // 3.68 - (-0.32) = 4.000 m EXACT!
  wheelRadius: 0.56,
  wheelWidth: 0.36,
  // 8×8 heavy off-road military expedition axles (front 2 steer, rear 2 drive!)
  axlesZ: [2.10, 4.10, 11.40, 13.30],
  hitchLocalZ: 15.85,       // Rear heavy tow pintle ball position (0.35m behind rear bumper)
  driverSeatLocal: { x: 0.88, z: 1.38 },
  gridAxes: {
    x: [
      { id: 'AX1', pos: 0.08, label: '0' },
      { id: 'AX2', pos: 1.55, label: '1,470' },
      { id: 'AX3', pos: 3.02, label: '2,940' },
    ],
    z: [
      { id: 'AZ1', pos: 0.08, label: '0' },
      { id: 'AZ2', pos: 2.50, label: '2,420' },
      { id: 'AZ3', pos: 5.80, label: '5,720' },
      { id: 'AZ4', pos: 8.60, label: '8,520' },
      { id: 'AZ5', pos: 10.60, label: '10,520' },
      { id: 'AZ6', pos: 13.50, label: '13,420' },
      { id: 'AZ7', pos: 15.42, label: '15,340' },
    ],
  },
};

export const ARMOR_CAMPER_PLAN = {
  index: 21,
  physicalFloor: 1,
  building: 'armor',
  code: '装甲RV',
  titleJp: '装甲キャンピングカー ARMOR-155（3.1m×15.5m×H4.0m・1階建）平面詳細図',
  subtitle: '重装甲鉄外装＋電動鉄シャッター＋温もり木製秘密基地6ゾーン（既存RVと構造非重複・自動運転＆コンテナけん引）',
  baseY: ARMOR_CAMPER.floorWorldY,
  ceilingH: ARMOR_CAMPER.interiorClearH,
  slabTopY: ARMOR_CAMPER.roofTopWorldY,
  floorLabel: 'AFL+940',
  width: ARMOR_CAMPER.width,
  depth: ARMOR_CAMPER.length,
  isArmorCamper: true,
  rooms: [
    {
      id: 'am_bridge', code: 'A01', building: 'armor', floor: 1, nameJp: '① 装甲操縦ブリッジ＆自律航法卓', nameEn: 'Armored Command Bridge',
      x: 0.12, z: 0.12, w: 2.86, d: 2.38, area: 6.81, jo: 4.20, fl: 'AFL±0', ch: 'CH2550',
      floorTex: 'wood_walnut_floor', floorName: '重厚ウォールナット無垢板＋防振鉄縁',
      wallName: '傾斜防弾スリット窓（電動鉄シャッター付）・自律経路探索コンソール・運転席', tint: '#d9d3c7', labelPos: [1.55, 1.30],
      notes: '自動経路探索コンピューター内蔵ブリッジ。鉄シャッター閉鎖ボタン＆運転席[E]・極厚鉄装甲で山奥の落石衝撃も遮断',
    },
    {
      id: 'am_hearth_lounge', code: 'A02', building: 'armor', floor: 1, nameJp: '② 薪ストーブ＆杉板秘密基地ラウンジ（無窓）', nameEn: 'Windowless Cedar Secret Lounge',
      x: 0.12, z: 2.50, w: 2.86, d: 3.30, area: 9.44, jo: 5.83, fl: 'AFL±0', ch: 'CH2760',
      floorTex: 'secret_cedar_plank', floorName: '温もり蜜蝋杉無垢フローリング',
      wallName: '無窓杉羽目板＋アーチ木梁・鋳鉄薪ストーブ・U字革張りピットソファ・装備有孔壁', tint: '#eadac0', labelPos: [1.55, 4.15],
      notes: '窓を排し圧倒的な隠れ家感を生む木製秘密基地ラウンジ。鋳鉄薪ストーブの暖かな炎と地図卓を囲むU字ピット',
    },
    {
      id: 'am_timber_galley', code: 'A03', building: 'armor', floor: 1, nameJp: '③ 栗無垢キッチン＆珈琲バー', nameEn: 'Timber Hearth Galley',
      x: 0.12, z: 5.80, w: 2.86, d: 2.80, area: 8.01, jo: 4.94, fl: 'AFL±0', ch: 'CH2760',
      floorTex: 'secret_cedar_plank', floorName: '蜜蝋杉板＋真鍮見切',
      wallName: 'ウォールナット厚板カウンター・銅シンク・真鍮吊り鍋ラック・大型杉パントリー', tint: '#f0dfc2', labelPos: [1.55, 7.20],
      notes: '長期山籠り対応の本格木製キッチン。東側に幅広ブッチャーブロック調理台、西側に食料木棚と保冷庫',
    },
    {
      id: 'am_hinoki_pod', code: 'A04', building: 'armor', floor: 1, nameJp: '④ 檜スチーム浴＆真鍮洗面ポッド', nameEn: 'Hinoki Wet Bath Pod',
      x: 1.48, z: 8.60, w: 1.50, d: 2.00, area: 3.00, jo: 1.85, fl: 'AFL-20', ch: 'CH2400',
      floorTex: 'wood_deck', floorName: '防水檜スノコ＋御影石パン',
      wallName: '総檜羽目板＋木製バーンドア(DAM-2)・深型檜桶・真鍮水栓・船舶トイレ', tint: '#e4d8c0', labelPos: [2.23, 9.60],
      notes: '西側オフセット通路(W1,280mm)に面した総檜ポッド。嵐の山奥でも温かい湯と木の香りで寛げる秘密の浴室',
    },
    {
      id: 'am_bunk_cave', code: 'A05', building: 'armor', floor: 1, nameJp: '⑤ アーチ杉板の秘密寝室＆海図書斎', nameEn: 'Vaulted Secret Bunk Cave',
      x: 0.12, z: 10.60, w: 2.86, d: 2.90, area: 8.29, jo: 5.12, fl: 'AFL±0', ch: 'CH2760',
      floorTex: 'secret_cedar_plank', floorName: '蜜蝋杉板＋ウールラグ',
      wallName: '木製アーチ籠もりキング寝台・床下鋼製抽斗・折畳海図デスク・極小スリット窓（鉄シャッター付）', tint: '#e5d3b7', labelPos: [1.55, 12.05],
      notes: '洞窟のような木製アーチ寝台と暖色ブラケット灯に包まれる最深部の秘密宿泊室。最小限の防弾スリット窓に鉄シャッター完備',
    },
    {
      id: 'am_airlock', code: 'A06', building: 'armor', floor: 1, nameJp: '⑥ 後部装甲エアロック＆コンテナ連結室', nameEn: 'Rear Steel Airlock & Hitch Bay',
      x: 0.12, z: 13.50, w: 2.86, d: 1.88, area: 5.38, jo: 3.32, fl: 'AFL±0', ch: 'CH2600',
      floorTex: 'metal_grate', floorName: '防滑縞鋼板＋排水ピット',
      wallName: '重鋼板隔壁扉(DAM-3)・雨具防寒ロッカー・コンテナ連結スイッチ・後部乗降鉄扉(DAM-1)', tint: '#cfd5dc', labelPos: [1.55, 14.44],
      notes: '嵐や泥を完全に遮断する鉄製後部エアロック。2×4×3m倉庫コンテナのワンタッチ連結/切離制御盤と乗降階段を内蔵',
    },
  ],
  walls: [
    // Heavy steel exterior armor shell (0.12m thick ballistic laminated steel + timber thermal lining!)
    {
      id: 'WAM_N', axis: 'h', x1: 0, z1: 0, x2: 3.10, z2: 0.12, kind: 'ext', extTex: 'armor_steel_plate', intTex: 'secret_cedar_plank',
      openings: [
        { id: 'WAM-WIN-F', type: 'window', pos: 0.35, width: 2.40, height: 0.68, sill: 1.24, hasIronShutter: true, label: '防弾フロントスリット窓（電動鉄シャッター付）' },
      ],
    },
    {
      id: 'WAM_S', axis: 'h', x1: 0, z1: 15.38, x2: 3.10, z2: 15.50, kind: 'ext', extTex: 'armor_steel_plate', intTex: 'armor_steel_plate',
      openings: [
        { id: 'DAM-R', type: 'door_swing', pos: 1.05, width: 1.00, height: 2.10, sill: 0, tex: 'armor_steel_plate', hinge: 'left', swingDir: 1, label: 'DAM-R 後部装甲ハッチ扉' },
      ],
    },
    {
      id: 'WAM_W', axis: 'v', x1: 0, z1: 0.12, x2: 0.12, z2: 15.38, kind: 'ext', extTex: 'armor_steel_plate', intTex: 'secret_cedar_plank',
      openings: [
        // Minimal slit windows ONLY (2 tiny ballistic viewports with motorized iron shutters!) + side entry door
        { id: 'DAM-1', type: 'door_swing', pos: 13.95, width: 0.92, height: 2.08, sill: 0, tex: 'armor_steel_plate', hinge: 'left', swingDir: -1, label: 'DAM-1 装甲側面エアロック扉' },
        { id: 'WAM-WIN-W1', type: 'window', pos: 0.70, width: 0.90, height: 0.56, sill: 1.32, hasIronShutter: true, label: '運転席側スリット窓（鉄シャッター付）' },
        { id: 'WAM-WIN-W2', type: 'window', pos: 11.45, width: 0.85, height: 0.36, sill: 1.56, hasIronShutter: true, label: '寝室極小スリット窓（鉄シャッター付）' },
      ],
    },
    {
      id: 'WAM_E', axis: 'v', x1: 2.98, z1: 0.12, x2: 3.10, z2: 15.38, kind: 'ext', extTex: 'armor_steel_plate', intTex: 'secret_cedar_plank',
      openings: [
        { id: 'WAM-WIN-E1', type: 'window', pos: 0.70, width: 0.90, height: 0.56, sill: 1.32, hasIronShutter: true, label: '助手席側スリット窓（鉄シャッター付）' },
        { id: 'WAM-WIN-E2', type: 'window', pos: 6.75, width: 0.78, height: 0.36, sill: 1.58, hasIronShutter: true, label: '調理台極小スリット窓（鉄シャッター付）' },
      ],
    },
    // Interior Timber & Blast Bulkheads (Asymmetric secret-base flow!)
    {
      id: 'WAM_B1', axis: 'h', x1: 0.12, z1: 2.45, x2: 2.98, z2: 2.55, kind: 'int', texA: 'secret_cedar_plank', texB: 'secret_cedar_plank',
      openings: [
        { id: 'DAM-C1', type: 'opening', pos: 1.05, width: 1.00, height: 2.20, sill: 0, label: '操縦席↔秘密ラウンジ木アーチ開口' },
      ],
    },
    { id: 'WAM_POD_N', axis: 'h', x1: 1.42, z1: 8.55, x2: 2.98, z2: 8.65, kind: 'int', texA: 'secret_cedar_plank', texB: 'wood_slats', openings: [] },
    { id: 'WAM_POD_S', axis: 'h', x1: 1.42, z1: 10.55, x2: 2.98, z2: 10.65, kind: 'int', texA: 'wood_slats', texB: 'secret_cedar_plank', openings: [] },
    {
      id: 'WAM_POD_W', axis: 'v', x1: 1.38, z1: 8.65, x2: 1.48, z2: 10.55, kind: 'int', texA: 'secret_cedar_plank', texB: 'wood_slats',
      openings: [
        { id: 'DAM-2', type: 'door_pocket', pos: 9.15, width: 0.80, height: 2.02, sill: 0, tex: 'door_walnut', slideDir: -1, label: 'DAM-2 檜浴室木製バーンドア' },
      ],
    },
    {
      id: 'WAM_AIR_N', axis: 'h', x1: 0.12, z1: 13.44, x2: 2.98, z2: 13.56, kind: 'int', texA: 'secret_cedar_plank', texB: 'armor_steel_plate',
      openings: [
        { id: 'DAM-3', type: 'door_pocket', pos: 0.55, width: 0.90, height: 2.08, sill: 0, tex: 'armor_steel_plate', slideDir: 1, label: 'DAM-3 装甲気密隔壁スライド扉' },
      ],
    },
  ],
  lighting: [
    { type: 'DL', x: 1.55, z: 1.30, label: 'DL-A01 ブリッジ赤/暖光灯' },
    { type: 'LN', x: 1.55, z: 4.15, label: 'LN-A02 薪ストーブ＆真鍮吊灯' },
    { type: 'PD', x: 1.55, z: 7.20, label: 'PD-A03 栗キッチン間接灯' },
    { type: 'BL', x: 2.20, z: 9.60, label: 'BL-A04 檜浴室防湿灯' },
    { type: 'LN', x: 1.55, z: 12.05, label: 'LN-A05 寝室洞窟読書灯' },
    { type: 'BH', x: 1.55, z: 14.44, label: 'BH-A06 エアロック防爆灯' },
  ],
  switches: [
    { x: 0.30, z: 1.80, label: 'SHUTTER' },
    { x: 2.75, z: 14.00, label: 'HITCH' },
  ],
  outlets: [
    { x: 2.82, z: 4.20, label: '24V/100V' },
    { x: 2.82, z: 7.20, label: 'IH/200V' },
    { x: 0.28, z: 12.20, label: 'USB/2P' },
  ],
  plumbing: [
    { kind: 'water', pts: [[2.70, 7.00], [2.70, 9.60]] },
    { kind: 'drain', pts: [[2.50, 7.40], [2.50, 10.20]] },
    { kind: 'vent', x: 1.55, z: 4.80, label: '薪ストーブ断熱煙突' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[-0.50, 14.40], [1.00, 14.40], [1.00, 12.00], [0.75, 9.60], [1.20, 7.20], [1.55, 4.15], [1.55, 1.35]] },
  ],
};

// =========================================================================
// 3. TOWABLE STEEL WAREHOUSE CONTAINER TRAILER — CON-24 (2.00m × 4.00m × H3.00m)
// Detachable heavy-duty off-road cargo container (max 1 hitched behind ARMOR-155!)
// =========================================================================
export const TOW_CONTAINER = {
  name: 'CON-24 / けん引式倉庫コンテナ (2.0×4.0×H3.0m)',
  subtitle: '2,000 × 4,000 × H3,000 mm（ISO波型鋼板・タンデムオフロード車軸・ARMOR-155後部連結けん引＆単独設置対応）',
  width: 2.00,
  length: 4.00,
  height: 3.00,
  // Parked neatly inside Giant Vehicle Warehouse Bay 2 (World X = 18.85..20.85, Z = 4.50..8.50)
  initialPose: {
    cx: 19.85,
    cz: 6.50,
    yaw: 0.0,
  },
  groundY: -0.32,
  floorWorldY: 0.42,       // Trailer deck height (+0.74m above ground -> Box H 2.26m -> Roof +2.68m -> Total H = 3.000m!)
  interiorClearH: 2.18,
  roofTopWorldY: 2.68,
  drawbarLength: 1.25,     // Heavy steel A-frame tow tongue extending forward of container front wall
  wheelRadius: 0.42,
  wheelWidth: 0.26,
  axlesZ: [1.95, 2.95],
  gridAxes: {
    x: [
      { id: 'TX1', pos: 0.06, label: '0' },
      { id: 'TX2', pos: 1.94, label: '1,880' },
    ],
    z: [
      { id: 'TY1', pos: 0.06, label: '0' },
      { id: 'TY2', pos: 2.00, label: '1,940' },
      { id: 'TY3', pos: 3.94, label: '3,880' },
    ],
  },
};

export const TOW_CONTAINER_PLAN = {
  index: 22,
  physicalFloor: 1,
  building: 'container',
  code: 'コンテナ',
  titleJp: '外付けけん引倉庫コンテナ CON-24（2.0m×4.0m×H3.0m）平面詳細図',
  subtitle: 'W2,000×L4,000×H3,000mm・ARMOR-155後部最大1台けん引対応・両開コンテナ鉄扉＆重量備蓄ラック完備',
  baseY: TOW_CONTAINER.floorWorldY,
  ceilingH: TOW_CONTAINER.interiorClearH,
  slabTopY: TOW_CONTAINER.roofTopWorldY,
  floorLabel: 'TFL+740',
  width: TOW_CONTAINER.width,
  depth: TOW_CONTAINER.length,
  isContainer: true,
  rooms: [
    {
      id: 'con_cargo', code: 'CT01', building: 'container', floor: 1, nameJp: '移動式スチール倉庫コンテナ室', nameEn: 'Towable Steel Cargo Vault',
      x: 0.08, z: 0.08, w: 1.84, d: 3.84, area: 7.07, jo: 4.36, fl: 'TFL±0', ch: 'CH2180',
      floorTex: 'wood_deck', floorName: '重荷重アピトン合板フローリング',
      wallName: '耐候ISOコルゲート鋼板・左右3段耐震スチール棚・非常発電機・燃料タンク', tint: '#cfd8d4', labelPos: [1.00, 2.00],
      notes: 'ARMOR-155の後部ピントルフックに最大1台連結して山岳走行可能。任意の地点に切離し設置して自動帰還目標にも設定可',
    },
  ],
  walls: [
    { id: 'WCT_N', axis: 'h', x1: 0, z1: 0, x2: 2.00, z2: 0.08, kind: 'ext', extTex: 'container_corrugated', intTex: 'container_corrugated', openings: [] },
    {
      id: 'WCT_S', axis: 'h', x1: 0, z1: 3.92, x2: 2.00, z2: 4.00, kind: 'ext', extTex: 'container_corrugated', intTex: 'container_corrugated',
      openings: [
        { id: 'DCT-1', type: 'door_swing', pos: 0.35, width: 1.30, height: 2.04, sill: 0, tex: 'container_corrugated', hinge: 'left', swingDir: 1, label: 'DCT-1 コンテナ後部重鋼製扉' },
      ],
    },
    { id: 'WCT_W', axis: 'v', x1: 0, z1: 0.08, x2: 0.08, z2: 3.92, kind: 'ext', extTex: 'container_corrugated', intTex: 'container_corrugated', openings: [] },
    { id: 'WCT_E', axis: 'v', x1: 1.92, z1: 0.08, x2: 2.00, z2: 3.92, kind: 'ext', extTex: 'container_corrugated', intTex: 'container_corrugated', openings: [] },
  ],
  lighting: [
    { type: 'BH', x: 1.00, z: 2.00, label: 'BH-CT01 コンテナ防塵LED' },
  ],
  switches: [{ x: 0.18, z: 3.75, label: 'SWCT' }],
  outlets: [{ x: 1.80, z: 0.50, label: '発電出力100V' }],
  plumbing: [],
  flowPaths: [
    { kind: 'entry', pts: [[1.00, 4.60], [1.00, 1.80]] },
  ],
};

// =========================================================================
// 4. EXTERIOR ATTIC EXPRESS ELEVATOR — ELV-EXT (1F Exterior Courtyard <-> RF Attic)
// Mounted cleanly on the West exterior facade of Main Tower (X = -1.55..0.00, Z = 0.35..1.85)
// Connects ground moss courtyard directly to RF Attic (Y = 16.10m) via zinc-clad gable dormer!
// =========================================================================
export const EXT_ELEVATOR = {
  id: 'ELV-EXT',
  nameJp: '外部パノラマ屋根裏直通エレベーター (1F屋外↔屋根裏RF)',
  shaft: {
    minX: -1.55,
    maxX: 0.00,
    minZ: 0.35,
    maxZ: 1.85,
    pitY: -0.60,
    topY: 19.35,
  },
  cab: {
    minX: -1.43,
    maxX: -0.14,
    minZ: 0.47,
    maxZ: 1.73,
    height: 2.22,
  },
  groundDoor: {
    x: -1.55,
    minZ: 0.65,
    maxZ: 1.55,
    width: 0.90,
    height: 2.08,
  },
  atticDoor: {
    x: 0.00,
    minZ: 0.65,
    maxZ: 1.55,
    width: 0.90,
    height: 2.04,
  },
  stops: [
    { floor: 1, code: '1F', labelJp: '1F 屋外', y: 0.00, doorSide: 'west' },
    { floor: 7, code: 'RF', labelJp: '屋根裏', y: 16.10, doorSide: 'east' },
  ],
};
