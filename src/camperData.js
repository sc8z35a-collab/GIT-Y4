/**
 * CAMPER-75 / 巨大オーバーランド・キャンピングカー (2.70m × 7.50m × H3.40m)
 * Detailed 2-Level Architectural & Mechanical CAD Specification:
 * - Exact Outer Dimensions: W 2,700 mm × L 7,500 mm × H 3,400 mm (Ground Y=-0.26 -> Roof Y=+3.14)
 * - 1F High Ceiling: CH 3,020 mm soaring central atrium (CH 1,980 mm under Front/Rear/Bridge Lofts)
 * - Ultra-Tight Central Corridor: Exact W 460 mm (player diameter 400 mm -> 30 mm clearance/side!)
 * - 1F: 14 Distinct Rooms (Cockpit, Seating, Kitchen, Bath, Shower, Toilet, Bedroom, Closet,
 *       Storage, Armored Shelter, + 4 Utility/Ops Rooms: Comms, Laundry, Power, Medical/Repair)
 * - 2F: 2 Expansive Loft Rooms (Front Sky-Bunk Loft CL01 + Rear Observation & Cargo Loft CL02)
 *       connected by West Glass-Railed Loft Skybridge CL00 & Rear Ship's Ladder STC1.
 * - Movable Vehicle with Strict OBB World Collision & Local-Space Interior Collision.
 */

export const CAMPER = {
  name: 'CAMPER-75 / 巨大オーバーランド・キャンピングカー (2.7×7.5×H3.4m)',
  subtitle: '2,700 × 7,500 × H3,400 mm（6輪駆動移動拠点｜1F 高天井CH3,020・全14室・極狭廊下W460｜2F ロフト2室）',
  width: 2.70,
  length: 7.50,
  height: 3.40,
  // Initial parked center pose beside Main Tower (World X = 6.40..9.10, Z = 2.00..9.50)
  initialPose: {
    cx: 7.75,
    cz: 5.75,
    yaw: 0.0, // 0 = Front Cockpit facing North (-Z)
  },
  groundY: -0.26,     // Tire contact plane on gravel/concrete pad
  chassisClearY: 0.30, // Ground to 1F floor top (+0.30m -> World Y = +0.04m)
  floor1WorldY: 0.04,
  loftUnderY: 1.98,   // Clear 1F ceiling beneath 2F lofts
  loftDeckThick: 0.06,
  loft2LocalY: 2.04,  // Relative to floor1WorldY -> World Y = +2.08m
  loft2WorldY: 2.08,
  loftClearH: 0.98,   // 2F loft headroom (0.98m -> roof soffit at +3.06m world)
  centralClearH: 3.02, // Soaring 1F central atrium ceiling height (3,020 mm!)
  roofThick: 0.08,    // Roof top at World Y = +3.14m (Total height = 3.14 - (-0.26) = 3.400 m EXACT!)
  corridorLocal: {
    minX: 1.07,
    maxX: 1.63, // Comfortable 560 mm clear width (+100 mm wider than before, 80 mm/side for Ø400 mm protagonist!)
  },
  // Rear ship's ladder / steep loft stair STC1 (1F Y=0.04 -> 2F Y=2.08)
  stairLocal: {
    minX: 1.07,
    maxX: 1.63,
    bottomZ: 6.66, // 1F north entry
    topZ: 6.96,    // 2F south rear landing (vz=6.96..7.43 = 470mm deep clear exit!)
    treads: 9,
  },
  // Axle Z positions (local vz) for 6-wheel overland expedition chassis
  axlesZ: [1.15, 5.15, 6.25],
  wheelRadius: 0.40,
  wheelWidth: 0.28,
  gridAxes: {
    x: [
      { id: 'CX1', pos: 0.035, label: '0' },
      { id: 'CX2', pos: 1.050, label: '1,015' },
      { id: 'CX3', pos: 1.650, label: '1,615' },
      { id: 'CX4', pos: 2.665, label: '2,630' },
    ],
    z: [
      { id: 'CY1', pos: 0.035, label: '0' },
      { id: 'CY2', pos: 1.230, label: '1,195' },
      { id: 'CY3', pos: 2.150, label: '2,115' },
      { id: 'CY4', pos: 2.830, label: '2,795' },
      { id: 'CY5', pos: 3.670, label: '3,635' },
      { id: 'CY6', pos: 4.510, label: '4,475' },
      { id: 'CY7', pos: 5.270, label: '5,235' },
      { id: 'CY8', pos: 6.060, label: '6,025' },
      { id: 'CY9', pos: 7.465, label: '7,430' },
    ],
  },
};

export const CAMPER_1F = {
  index: 14,
  physicalFloor: 1,
  building: 'camper',
  code: 'キャンピング1F',
  titleJp: '巨大キャンピングカー 1階 平面詳細図（全14室・W560拡幅廊下・高天井）',
  subtitle: '2,700×7,500×H3,400mm・1F全14室＋拡幅W560廊下＋中央吹抜高天井CH3,020・運転走行対応',
  baseY: CAMPER.floor1WorldY,
  ceilingH: CAMPER.centralClearH,
  slabTopY: CAMPER.loft2WorldY,
  floorLabel: 'C1FL+300',
  width: CAMPER.width,
  depth: CAMPER.length,
  isCamper: true,
  camperLevel: 1,
  rooms: [
    // --- FRONT CAB (1) ---
    {
      id: 'c1_cockpit', code: 'C01', building: 'camper', floor: 1, nameJp: '① 運転室（コックピット）', nameEn: 'Driver Cockpit',
      x: 0.07, z: 0.07, w: 2.56, d: 1.14, area: 2.92, jo: 1.80, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'rubber_black_stud', floorName: '防滑スタッドラバー床',
      wallName: 'パノラマフロントガラス・計器盤・運転席[E]走行可', tint: '#d5dde6', labelPos: [1.35, 0.64],
      notes: 'ハンドルに[E]で乗車し厳格な当たり判定で森の中を自走可能。左右キャプテンシート・計器クラスター',
    },
    // --- CENTRAL CORRIDOR & ENTRY AIRLOCK ---
    {
      id: 'c1_corridor', code: 'C00', building: 'camper', floor: 1, nameJp: '拡幅中央廊下 (W560)', nameEn: '560mm Central Corridor',
      x: 1.07, z: 1.25, w: 0.56, d: 5.41, area: 3.03, jo: 1.87, fl: 'C1FL±0', ch: 'CH3020(吹抜)',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット長尺床',
      wallName: '幅560mm（主人公幅400mm・左右余裕80mm）・天窓高天井', tint: '#f3e7d5', labelPos: [1.35, 3.95],
      notes: '旧W460から+100mm拡幅した有効幅560mmの中央スパイン廊下。中央部は天井高3,020mmの開放吹抜＆天窓',
    },
    {
      id: 'c1_entry', code: 'C00E', building: 'camper', floor: 1, nameJp: '乗降ステップ前室', nameEn: 'Entry Airlock',
      x: 0.07, z: 2.17, w: 1.00, d: 0.64, area: 0.64, jo: 0.40, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'metal_grate', floorName: '防滑アルミ縞鋼板',
      wallName: '西側外開RV扉(DC-1)＋格納スチールステップ', tint: '#dfe4e8', labelPos: [0.55, 2.49],
      notes: '母屋側から格納ステップを上って直接乗り込む気密エントリー前室',
    },
    // --- WEST WING ROOMS (6) ---
    {
      id: 'c1_seating', code: 'C02', building: 'camper', floor: 1, nameJp: '② 座席室（ダイネット）', nameEn: 'Passenger Seating Lounge',
      x: 0.07, z: 1.25, w: 0.96, d: 0.88, area: 0.84, jo: 0.52, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'wood_floor', floorName: 'オーク複合フローリング',
      wallName: '対面クッション座席・折畳オーク卓・西展望窓', tint: '#f4e7d3', labelPos: [0.55, 1.69],
      notes: '走行・休憩用の独立座席室。対面デニムシートと折畳式トラベルテーブルを内蔵',
    },
    {
      id: 'c1_kitchen', code: 'C03', building: 'camper', floor: 1, nameJp: '③ キッチン（ギャレー）', nameEn: 'Galley Kitchen',
      x: 0.07, z: 2.85, w: 0.96, d: 0.80, area: 0.77, jo: 0.47, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'tile_checker_stone', floorName: '耐水市松ストーン床',
      wallName: '2口IH・ステンレスシンク・小型冷蔵庫・吊戸棚', tint: '#f7ead2', labelPos: [0.55, 3.25],
      notes: '船舶規格のコンパクトギャレー。給水180Lタンク直結シンク・IHクッカー・吊棚完備',
    },
    {
      id: 'c1_bath', code: 'C04', building: 'camper', floor: 1, nameJp: '④ お風呂（深型浴槽）', nameEn: 'Compact Soaking Bath',
      x: 0.07, z: 3.69, w: 0.96, d: 0.80, area: 0.77, jo: 0.47, fl: 'C1FL-20', ch: 'CH1980',
      floorTex: 'tile_blue_bath', floorName: '防滑ブルー浴室タイル',
      wallName: 'エメラルド艶タイル・深型浸かり浴槽・曇り換気窓', tint: '#d4e8f2', labelPos: [0.55, 4.09],
      notes: 'シャワー室と完全分離した専用のお風呂室。深型バスタブにボイラー給湯を完備',
    },
    {
      id: 'c1_shower', code: 'C05', building: 'camper', floor: 1, nameJp: '⑤ シャワー室', nameEn: 'Walk-In Rain Shower',
      x: 0.07, z: 4.53, w: 0.96, d: 0.72, area: 0.69, jo: 0.43, fl: 'C1FL-20', ch: 'CH1980',
      floorTex: 'tile_blue_bath', floorName: '防滑ブルータイル＋排水グレーチング',
      wallName: '防水コバルトタイル・天井レインシャワーヘッド', tint: '#cfe4f5', labelPos: [0.55, 4.89],
      notes: 'お風呂とは別室の独立シャワールーム。レインシャワーとアルミ排水溝付き',
    },
    {
      id: 'c1_toilet', code: 'C06', building: 'camper', floor: 1, nameJp: '⑥ トイレ室', nameEn: 'Marine RV Toilet',
      x: 0.07, z: 5.29, w: 0.96, d: 0.75, area: 0.72, jo: 0.44, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'tile_beige_grid', floorName: 'ベージュ磁器タイル',
      wallName: 'カセット式RV陶器便器・小型手洗器・鏡', tint: '#e4efe8', labelPos: [0.55, 5.66],
      notes: '完全個室の衛生トイレ室。脱臭換気ファン・手洗器・ミラーを装備',
    },
    {
      id: 'c1_shelter', code: 'C10', building: 'camper', floor: 1, nameJp: '⑩ シェルター室（装甲）', nameEn: 'Armored Panic Shelter',
      x: 0.07, z: 6.08, w: 0.96, d: 1.35, area: 1.30, jo: 0.80, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'concrete_clean', floorName: '防振鋼板＋高密度樹脂床',
      wallName: '無窓装甲鋼板・重鋼製引戸(DC-10)・空気浄化装置・非常食', tint: '#c5cbd1', labelPos: [0.55, 6.75],
      notes: '外壁無窓・補強鋼板＆鉛遮蔽の緊急シェルター室。空気清浄機・非常用備蓄・赤橙非常灯',
    },
    // --- EAST WING ROOMS (7) ---
    {
      id: 'c1_comms', code: 'C11', building: 'camper', floor: 1, nameJp: '⑪ 通信・ナビ制御室 (他①)', nameEn: 'Comms & Nav Ops',
      x: 1.67, z: 1.25, w: 0.96, d: 0.80, area: 0.77, jo: 0.47, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'carpet_charcoal_tile', floorName: '帯電防止チャコール床',
      wallName: '衛星通信機・レーダー卓・壁面モニタ', tint: '#d8dee6', labelPos: [2.15, 1.65],
      notes: 'その他4部屋①：深森圏外でも衛星通信・気象監視・周辺レーダー運用を行う制御室',
    },
    {
      id: 'c1_closet', code: 'C08', building: 'camper', floor: 1, nameJp: '⑧ クローゼット室', nameEn: 'Walk-In Closet',
      x: 1.67, z: 2.09, w: 0.96, d: 0.76, area: 0.73, jo: 0.45, fl: 'C1FL±0', ch: 'CH2450(吹抜連)',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット',
      wallName: 'ハンガーパイプ・畳み衣類棚・姿見ミラー', tint: '#efe5d6', labelPos: [2.15, 2.47],
      notes: '防寒着・装備服を掛けるハンガーバーと衣類棚・全身鏡を備えたウォークインクローゼット',
    },
    {
      id: 'c1_storage', code: 'C09', building: 'camper', floor: 1, nameJp: '⑨ 保管室（装備庫）', nameEn: 'Expedition Storage',
      x: 1.67, z: 2.89, w: 0.96, d: 0.80, area: 0.77, jo: 0.47, fl: 'C1FL±0', ch: 'CH2450(吹抜連)',
      floorTex: 'rubber_black_stud', floorName: '重荷重スタッドゴム床',
      wallName: '3段スチールラック・木箱・麻袋・ロープ保管', tint: '#d8d7d2', labelPos: [2.15, 3.29],
      notes: '長期遠征用の備品・食料木箱・工具コンテナを固定収納する専用保管室',
    },
    {
      id: 'c1_laundry', code: 'C12', building: 'camper', floor: 1, nameJp: '⑫ ランドリー乾燥室 (他②)', nameEn: 'Laundry & Drying',
      x: 1.67, z: 3.73, w: 0.96, d: 0.76, area: 0.73, jo: 0.45, fl: 'C1FL±0', ch: 'CH2450(吹抜連)',
      floorTex: 'terrazzo_white', floorName: '白テラゾー耐水床',
      wallName: '縦型ドラム洗濯乾燥機・作業カウンター・乾燥バー', tint: '#e1ebe6', labelPos: [2.15, 4.11],
      notes: 'その他4部屋②：独立したランドリー＆除湿乾燥室。長期森暮らしの衣類ケアを完結',
    },
    {
      id: 'c1_power', code: 'C13', building: 'camper', floor: 1, nameJp: '⑬ 発電・蓄電池室 (他③)', nameEn: 'Power & Battery Vault',
      x: 1.67, z: 4.53, w: 0.96, d: 0.72, area: 0.69, jo: 0.43, fl: 'C1FL±0', ch: 'CH2450(吹抜連)',
      floorTex: 'metal_grate', floorName: '絶縁鋼板グレーチング床',
      wallName: '20kWh LiFePO4蓄電池・ソーラーインバータ・分電盤', tint: '#d5dbe0', labelPos: [2.15, 4.89],
      notes: 'その他4部屋③：屋上ソーラー発電と20kWhリン酸鉄リチウム蓄電池・静音発電機を集中管理',
    },
    {
      id: 'c1_medical', code: 'C14', building: 'camper', floor: 1, nameJp: '⑭ 応急・工作整備室 (他④)', nameEn: 'Medical & Field Repair',
      x: 1.67, z: 5.29, w: 0.96, d: 0.75, area: 0.72, jo: 0.44, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'tile_grey_stone', floorName: '耐薬品グレーストーン床',
      wallName: '救急キャビネット・有孔ボード工具壁・整備作業台', tint: '#e9e4dc', labelPos: [2.15, 5.66],
      notes: 'その他4部屋④：応急処置キットと車両整備ワークベンチを兼ねたフィールドリペア室',
    },
    {
      id: 'c1_bedroom', code: 'C07', building: 'camper', floor: 1, nameJp: '⑦ 1F 寝室（個室キャビン）', nameEn: '1F Cabin Bedroom',
      x: 1.67, z: 6.08, w: 0.96, d: 1.35, area: 1.30, jo: 0.80, fl: 'C1FL±0', ch: 'CH1980',
      floorTex: 'wood_floor', floorName: 'ライトオーク床＋ラグ',
      wallName: '造作キャビンベッド・読書ブラケット・東＆南窓', tint: '#f3e5d2', labelPos: [2.15, 6.75],
      notes: '2面窓付きの完全個室1F寝室。造作ベッド下収納と暖色間接灯を備えた安眠キャビン',
    },
  ],
  walls: [
    // Exterior 70mm Armored FRP/Aluminum Shell
    {
      id: 'WC_N', axis: 'h', x1: 0.00, z1: 0.00, x2: 2.70, z2: 0.07, kind: 'ext', extTex: 'exterior_siding_grey', intTex: 'panel_white_vert',
      openings: [
        { id: 'WC-FW', type: 'window', pos: 0.18, width: 2.34, height: 1.02, sill: 0.88, label: 'WC-FW パノラマフロントガラス' },
      ],
    },
    {
      id: 'WC_S', axis: 'h', x1: 0.00, z1: 7.43, x2: 2.70, z2: 7.50, kind: 'ext', extTex: 'exterior_siding_grey', intTex: 'wainscot_wood',
      openings: [
        { id: 'WC-RW1', type: 'window', pos: 1.82, width: 0.62, height: 0.72, sill: 0.96, label: 'WC-RW1 寝室リア窓' },
      ],
    },
    {
      id: 'WC_W', axis: 'v', x1: 0.00, z1: 0.07, x2: 0.07, z2: 7.43, kind: 'ext', extTex: 'exterior_siding_grey', intTex: 'panel_white_vert',
      openings: [
        { id: 'WC-W1', type: 'window', pos: 0.22, width: 0.82, height: 0.92, sill: 0.92, label: 'WC-W1 運転席左窓' },
        { id: 'WC-W2', type: 'window', pos: 1.38, width: 0.62, height: 0.86, sill: 0.88, label: 'WC-W2 座席室西窓' },
        { id: 'DC-1', type: 'door_swing', pos: 2.20, width: 0.58, height: 1.90, sill: 0, tex: 'door_navy', hinge: 'left', swingDir: -1, label: 'DC-1 キャンピングカー乗降扉' },
        { id: 'WC-W3', type: 'window', pos: 3.02, width: 0.48, height: 0.60, sill: 1.14, label: 'WC-W3 キッチン小窓' },
        { id: 'WC-W4', type: 'window_frosted', pos: 3.88, width: 0.44, height: 0.44, sill: 1.34, label: 'WC-W4 お風呂換気窓' },
      ],
    },
    {
      id: 'WC_E', axis: 'v', x1: 2.63, z1: 0.07, x2: 2.70, z2: 7.43, kind: 'ext', extTex: 'exterior_siding_grey', intTex: 'panel_white_vert',
      openings: [
        { id: 'WC-E1', type: 'window', pos: 0.22, width: 0.82, height: 0.92, sill: 0.92, label: 'WC-E1 運転室右窓' },
        { id: 'WC-E2', type: 'window', pos: 1.40, width: 0.52, height: 0.66, sill: 1.08, label: 'WC-E2 通信室東窓' },
        { id: 'WC-E3', type: 'window_frosted', pos: 3.05, width: 0.48, height: 0.36, sill: 1.45, label: 'WC-E3 保管室換気窓' },
        { id: 'WC-E4', type: 'window', pos: 5.45, width: 0.46, height: 0.56, sill: 1.18, label: 'WC-E4 応急整備室窓' },
        { id: 'WC-E5', type: 'window', pos: 6.35, width: 0.82, height: 0.86, sill: 0.88, label: 'WC-E5 1F寝室東窓' },
      ],
    },
    // Cockpit Bulkhead (vz=1.21..1.25)
    {
      id: 'WC_CAB_S', axis: 'h', x1: 0.07, z1: 1.21, x2: 2.63, z2: 1.25, kind: 'int', wallH: 1.98, texA: 'panel_white_vert', texB: 'wood_slats',
      openings: [
        { id: 'DC-01', type: 'door_pocket', pos: 1.07, width: 0.56, height: 1.88, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DC-01 運転室引戸' },
      ],
    },
    // West Corridor Bulkheads (vx=1.03..1.07, widened 560mm clear spine!)
    {
      id: 'WC_COR_WN', axis: 'v', x1: 1.03, z1: 1.25, x2: 1.07, z2: 2.17, kind: 'int', wallH: 1.98, texA: 'wainscot_wood', texB: 'wood_slats',
      openings: [
        { id: 'DC-02', type: 'door_pocket', pos: 1.42, width: 0.56, height: 1.88, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DC-02 座席室引戸' },
      ],
    },
    {
      id: 'WC_COR_WS', axis: 'v', x1: 1.03, z1: 2.81, x2: 1.07, z2: 7.43, kind: 'int', wallH: 1.98, texA: 'panel_white_vert', texB: 'wood_slats',
      openings: [
        { id: 'DC-03', type: 'door_pocket', pos: 2.97, width: 0.56, height: 1.88, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DC-03 キッチン引戸' },
        { id: 'DC-04', type: 'door_pocket', pos: 3.81, width: 0.56, height: 1.88, sill: 0, tex: 'door_white', slideDir: -1, label: 'DC-04 お風呂引戸' },
        { id: 'DC-05', type: 'door_pocket', pos: 4.61, width: 0.56, height: 1.88, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DC-05 シャワー室引戸' },
        { id: 'DC-06', type: 'door_pocket', pos: 5.39, width: 0.56, height: 1.88, sill: 0, tex: 'door_white', slideDir: -1, label: 'DC-06 トイレ引戸' },
        { id: 'DC-10', type: 'door_pocket', pos: 6.12, width: 0.52, height: 1.88, sill: 0, tex: 'exterior_siding_grey', slideDir: 1, label: 'DC-10 シェルター装甲引戸' },
      ],
    },
    // East Corridor Bulkhead (vx=1.63..1.67) — split in 3 zones so central atrium rooms get taller 2.45m walls!
    {
      id: 'WC_COR_EN', axis: 'v', x1: 1.63, z1: 1.25, x2: 1.67, z2: 2.09, kind: 'int', wallH: 1.98, texA: 'wood_slats', texB: 'panel_white_vert',
      openings: [
        { id: 'DC-11', type: 'door_pocket', pos: 1.37, width: 0.56, height: 1.88, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DC-11 通信・ナビ室引戸' },
      ],
    },
    {
      id: 'WC_COR_EM', axis: 'v', x1: 1.63, z1: 2.09, x2: 1.67, z2: 5.25, kind: 'int', wallH: 2.45, texA: 'wood_slats', texB: 'panel_white_vert',
      openings: [
        { id: 'DC-08', type: 'door_pocket', pos: 2.19, width: 0.56, height: 1.92, sill: 0, tex: 'door_oak', slideDir: -1, label: 'DC-08 クローゼット引戸' },
        { id: 'DC-09', type: 'door_pocket', pos: 3.01, width: 0.56, height: 1.92, sill: 0, tex: 'door_walnut', slideDir: -1, label: 'DC-09 保管室引戸' },
        { id: 'DC-12', type: 'door_pocket', pos: 3.83, width: 0.56, height: 1.92, sill: 0, tex: 'door_white', slideDir: -1, label: 'DC-12 ランドリー引戸' },
        { id: 'DC-13', type: 'door_pocket', pos: 4.61, width: 0.56, height: 1.92, sill: 0, tex: 'exterior_siding_grey', slideDir: -1, label: 'DC-13 発電・蓄電池室引戸' },
      ],
    },
    {
      id: 'WC_COR_ES', axis: 'v', x1: 1.63, z1: 5.25, x2: 1.67, z2: 7.43, kind: 'int', wallH: 1.98, texA: 'wood_slats', texB: 'wainscot_wood',
      openings: [
        { id: 'DC-14', type: 'door_pocket', pos: 5.39, width: 0.56, height: 1.88, sill: 0, tex: 'door_white', slideDir: -1, label: 'DC-14 応急・工作室引戸' },
        { id: 'DC-07', type: 'door_pocket', pos: 6.12, width: 0.52, height: 1.88, sill: 0, tex: 'door_walnut', slideDir: 1, label: 'DC-07 1F寝室引戸' },
      ],
    },
    // West Wing Cross-Partitions (vx=0.07..1.03, height 1.98m beneath 2F Loft & Skybridge)
    { id: 'WC_WD1', axis: 'h', x1: 0.07, z1: 2.13, x2: 1.03, z2: 2.17, kind: 'int', wallH: 1.98, texA: 'wainscot_wood', texB: 'panel_white_vert', openings: [] },
    { id: 'WC_WD2', axis: 'h', x1: 0.07, z1: 2.81, x2: 1.03, z2: 2.85, kind: 'int', wallH: 1.98, texA: 'panel_white_vert', texB: 'tile_white_small', openings: [] },
    { id: 'WC_WD3', axis: 'h', x1: 0.07, z1: 3.65, x2: 1.03, z2: 3.69, kind: 'int', wallH: 1.98, texA: 'tile_white_small', texB: 'tile_emerald_gloss', openings: [] },
    { id: 'WC_WD4', axis: 'h', x1: 0.07, z1: 4.49, x2: 1.03, z2: 4.53, kind: 'int', wallH: 1.98, texA: 'tile_emerald_gloss', texB: 'tile_cobalt_mosaic', openings: [] },
    { id: 'WC_WD5', axis: 'h', x1: 0.07, z1: 5.25, x2: 1.03, z2: 5.29, kind: 'int', wallH: 1.98, texA: 'tile_cobalt_mosaic', texB: 'panel_white_vert', openings: [] },
    { id: 'WC_WD6', axis: 'h', x1: 0.07, z1: 6.04, x2: 1.03, z2: 6.08, kind: 'int', wallH: 1.98, texA: 'panel_white_vert', texB: 'concrete_pcon', openings: [] },
    // East Wing Cross-Partitions (vx=1.67..2.63)
    { id: 'WC_ED1', axis: 'h', x1: 1.67, z1: 2.05, x2: 2.63, z2: 2.09, kind: 'int', wallH: 1.98, texA: 'panel_white_vert', texB: 'wainscot_wood', openings: [] },
    { id: 'WC_ED2', axis: 'h', x1: 1.67, z1: 2.85, x2: 2.63, z2: 2.89, kind: 'int', wallH: 2.45, texA: 'wainscot_wood', texB: 'wood_scratched_cedar', openings: [] },
    { id: 'WC_ED3', axis: 'h', x1: 1.67, z1: 3.69, x2: 2.63, z2: 3.73, kind: 'int', wallH: 2.45, texA: 'wood_scratched_cedar', texB: 'panel_white_vert', openings: [] },
    { id: 'WC_ED4', axis: 'h', x1: 1.67, z1: 4.49, x2: 2.63, z2: 4.53, kind: 'int', wallH: 2.45, texA: 'panel_white_vert', texB: 'concrete_pcon', openings: [] },
    { id: 'WC_ED5', axis: 'h', x1: 1.67, z1: 5.25, x2: 2.63, z2: 5.29, kind: 'int', wallH: 1.98, texA: 'concrete_pcon', texB: 'pegboard_wood', openings: [] },
    { id: 'WC_ED6', axis: 'h', x1: 1.67, z1: 6.04, x2: 2.63, z2: 6.08, kind: 'int', wallH: 1.98, texA: 'pegboard_wood', texB: 'wainscot_wood', openings: [] },
  ],
  stairUp: { id: 'STC1', label: 'UP 2Fロフトへ', dir: 'south' },
  stairDown: null,
  lighting: [
    { type: 'DL', x: 1.35, z: 0.65, label: 'DL-C01 運転室灯' },
    { type: 'CL', x: 1.35, z: 2.50, label: 'CL-C02 高天井吹抜灯' },
    { type: 'CL', x: 1.35, z: 4.20, label: 'CL-C03 高天井天窓灯' },
    { type: 'BH', x: 0.55, z: 6.75, label: 'BH-C10 シェルター非常灯' },
    { type: 'DL', x: 2.15, z: 6.75, label: 'DL-C07 1F寝室灯' },
  ],
  switches: [
    { x: 0.96, z: 2.25, label: 'SWC1' },
    { x: 1.56, z: 6.00, label: 'SWC2' },
  ],
  outlets: [
    { x: 0.16, z: 3.25, label: 'IH/200V' },
    { x: 2.52, z: 1.65, label: '衛星電源' },
    { x: 2.52, z: 4.89, label: '20kWh盤' },
    { x: 0.16, z: 6.75, label: 'UPS非常' },
  ],
  plumbing: [
    { kind: 'water', pts: [[0.14, 3.25], [0.14, 4.09], [0.14, 4.89], [0.14, 5.66]] },
    { kind: 'drain', pts: [[0.45, 3.25], [0.45, 5.66], [2.15, 4.11]] },
    { kind: 'vent', x: 0.55, z: 6.40, label: 'HEPA換気' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[-0.45, 2.49], [1.35, 2.49], [1.35, 0.72]] },
    { kind: 'priv', pts: [[1.35, 2.49], [1.35, 6.85]] },
    { kind: 'work', pts: [[1.35, 3.25], [0.55, 3.25]] },
  ],
};

export const CAMPER_2F = {
  index: 15,
  physicalFloor: 2,
  building: 'camper',
  code: 'キャンピング2F',
  titleJp: '巨大キャンピングカー 2階 ロフト平面詳細図（ロフト2室＋吹抜キャットウォーク）',
  subtitle: 'C2FL+2,340（ロフト天井高 CH980）・前方スカイ寝台ロフト＋後方展望収納ロフト・中央1F高天井吹抜(CH3,020)',
  baseY: CAMPER.loft2WorldY,
  ceilingH: CAMPER.loftClearH,
  slabTopY: CAMPER.loft2WorldY + CAMPER.loftClearH,
  floorLabel: 'C2FL+2340',
  width: CAMPER.width,
  depth: CAMPER.length,
  isCamper: true,
  camperLevel: 2,
  rooms: [
    {
      id: 'c2_loft_front', code: 'CL01', building: 'camper', floor: 2, nameJp: '① 2F 前方スカイ寝台ロフト', nameEn: 'Front Sky-Bunk Loft',
      x: 0.07, z: 0.07, w: 2.56, d: 2.10, area: 5.38, jo: 3.32, fl: 'C2FL±0', ch: 'CH980(ロフト)',
      floorTex: 'carpet_beige', floorName: '防音ベージュカーペット＋大型マット',
      wallName: '上部パノラマ天窓・両側スリット窓・落下防止アイアン手摺', tint: '#f3e9d6', labelPos: [1.35, 1.12],
      notes: '運転室・座席室・通信室の上部全面を使う広大な就寝ロフト。天窓から森の梢と夜空を一望',
    },
    {
      id: 'c2_skybridge', code: 'CL00', building: 'camper', floor: 2, nameJp: '2F ロフト連絡ブリッジ', nameEn: 'Loft Glass Skybridge',
      x: 0.07, z: 2.17, w: 1.00, d: 3.08, area: 3.08, jo: 1.90, fl: 'C2FL±0', ch: 'CH980(ロフト)',
      floorTex: 'wood_walnut_floor', floorName: 'ウォールナット化粧床',
      wallName: '強化ガラス＆アイアン手摺（東側1F高天井吹抜 CH3,020を見下ろす）', tint: '#ece1ce', labelPos: [0.55, 3.71],
      notes: '2つのロフト部屋を直結する西側空中通路。東側の1F拡幅W560廊下と高天井吹抜を見下ろす開放設計',
    },
    {
      id: 'c2_loft_rear', code: 'CL02', building: 'camper', floor: 2, nameJp: '② 2F 後方展望＆収納ロフト', nameEn: 'Rear Observation & Gear Loft',
      x: 0.07, z: 5.25, w: 2.56, d: 2.18, area: 5.33, jo: 3.29, fl: 'C2FL±0', ch: 'CH980(ロフト)',
      floorTex: 'tatami_ryukyu', floorName: '琉球半帖畳＋遠征ギア収納床',
      wallName: 'リアパノラマ展望窓・木箱コンテナ・座卓・STC1階段ハッチ柵', tint: '#dce6d4', labelPos: [1.35, 6.02],
      notes: '1F後方の寝室・シェルター上部に設けた第2のロフト室。和モダン展望ラウンジ兼大型ギア保管ロフト',
    },
  ],
  walls: [
    // Exterior Upper Perimeter Walls (CH 980mm with upper panoramic clerestory windows)
    {
      id: 'WC2_N', axis: 'h', x1: 0.00, z1: 0.00, x2: 2.70, z2: 0.07, kind: 'ext', wallH: 0.98, extTex: 'exterior_siding_grey', intTex: 'plywood_attic',
      openings: [
        { id: 'WC2-FW', type: 'window', pos: 0.45, width: 1.80, height: 0.46, sill: 0.28, label: 'WC2-FW 前方ロフトパノラマ窓' },
      ],
    },
    {
      id: 'WC2_S', axis: 'h', x1: 0.00, z1: 7.43, x2: 2.70, z2: 7.50, kind: 'ext', wallH: 0.98, extTex: 'exterior_siding_grey', intTex: 'plywood_attic',
      openings: [
        { id: 'WC2-RW', type: 'window', pos: 0.45, width: 1.80, height: 0.48, sill: 0.28, label: 'WC2-RW 後方ロフト展望窓' },
      ],
    },
    {
      id: 'WC2_W', axis: 'v', x1: 0.00, z1: 0.07, x2: 0.07, z2: 7.43, kind: 'ext', wallH: 0.98, extTex: 'exterior_siding_grey', intTex: 'plywood_attic',
      openings: [
        { id: 'WC2-W1', type: 'window', pos: 0.55, width: 1.15, height: 0.42, sill: 0.30, label: 'WC2-W1 前ロフト西窓' },
        { id: 'WC2-W2', type: 'window', pos: 2.75, width: 1.95, height: 0.44, sill: 0.30, label: 'WC2-W2 ブリッジ高窓' },
        { id: 'WC2-W3', type: 'window', pos: 5.75, width: 1.15, height: 0.42, sill: 0.30, label: 'WC2-W3 後ロフト西窓' },
      ],
    },
    {
      id: 'WC2_E', axis: 'v', x1: 2.63, z1: 0.07, x2: 2.70, z2: 7.43, kind: 'ext', wallH: 0.98, extTex: 'exterior_siding_grey', intTex: 'plywood_attic',
      openings: [
        { id: 'WC2-E1', type: 'window', pos: 0.55, width: 1.15, height: 0.42, sill: 0.30, label: 'WC2-E1 前ロフト東窓' },
        { id: 'WC2-E2', type: 'window', pos: 2.75, width: 1.95, height: 0.44, sill: 0.30, label: 'WC2-E2 吹抜高窓' },
        { id: 'WC2-E3', type: 'window', pos: 5.75, width: 1.15, height: 0.42, sill: 0.30, label: 'WC2-E3 後ロフト東窓' },
      ],
    },
    // Loft Safety Railings along Double-Height Void & Stairwell Hatch
    { id: 'WC2_RAIL_F', axis: 'h', x1: 1.07, z1: 2.13, x2: 2.63, z2: 2.17, kind: 'railing', openings: [] },
    { id: 'WC2_RAIL_B', axis: 'v', x1: 1.03, z1: 2.17, x2: 1.07, z2: 5.25, kind: 'railing', openings: [] },
    { id: 'WC2_RAIL_R', axis: 'h', x1: 1.07, z1: 5.25, x2: 2.63, z2: 5.29, kind: 'railing', openings: [] },
    { id: 'WC2_HATCH_W', axis: 'v', x1: 1.03, z1: 6.50, x2: 1.07, z2: 6.96, kind: 'railing', openings: [] },
    { id: 'WC2_HATCH_E', axis: 'v', x1: 1.63, z1: 6.50, x2: 1.67, z2: 6.96, kind: 'railing', openings: [] },
    { id: 'WC2_HATCH_N', axis: 'h', x1: 1.03, z1: 6.50, x2: 1.67, z2: 6.54, kind: 'railing', openings: [] },
  ],
  stairUp: null,
  stairDown: { id: 'STC1', label: 'DN 1Fへ', dir: 'north' },
  lighting: [
    { type: 'CV', x: 1.35, z: 1.12, label: 'CV-CL01 前ロフト間接灯' },
    { type: 'CV', x: 0.55, z: 3.71, label: 'CV-CL00 ブリッジ間接灯' },
    { type: 'LN', x: 1.35, z: 6.02, label: 'LN-CL02 後ロフト和紙灯' },
  ],
  switches: [{ x: 0.94, z: 5.38, label: 'SWCL1' }],
  outlets: [
    { x: 0.16, z: 1.12, label: 'USB-C/100V' },
    { x: 2.52, z: 6.02, label: 'USB-C/100V' },
  ],
  plumbing: [
    { kind: 'vent', x: 1.35, z: 3.70, label: 'ルーフ換気扇' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[1.35, 7.18], [0.58, 7.18], [0.58, 1.15], [1.65, 1.15]] },
  ],
};

export const CAMPER_SHEETS = [CAMPER_1F, CAMPER_2F];
