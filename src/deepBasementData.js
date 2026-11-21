/**
 * DEEP BASEMENT EXPANSION — B2F STUDIO + B3F WOODEN SHELTER & FOOD VAULT + B4F CLANDESTINE SYNDICATE LAB + HYPER-REALISTIC MRL ELEVATOR (ELV-1)
 *
 * Vertical Stratigraphy (Exact Non-Overlapping Elevations):
 *   - 1F  (floor =  1): baseY =   0.00 m (CH 2.50 m) — Ground Level + ELV-1 Top MRL Traction Hoist & Landing
 *   - B1F (floor =  0): baseY =  -2.40 m (CH 2.02 m) — Grey Cement 3×7m + 3 Storage Rooms + ST_B2 Down + ELV-1 Stop
 *   - B2F (floor = -1): baseY =  -6.60 m (CH 3.80 m!) — Stair Door DB2-0 -> 10m×10m Wood/Concrete/Mirror Studio
 *                                                       + 2 Direct-Connected 4m×6m Rooms (B202, B203) + ST_B3 + ELV-1 Stop
 *   - B3F (floor = -2): baseY = -10.20 m (CH 2.80 m) — W 520mm (1.3× protagonist Ø400mm) Corridor -> ELV-1 Stop
 *                                                       + 3.2m×12.5m Warm Wooden Shelter (Lounge, Shower, Toilet, Bedroom)
 *                                                       + Rear Vault Door DB3-FD -> 2.0m×6.0m Food Storage Warehouse
 *   - B4F (floor = -3): baseY = -14.20 m (CH 3.55 m!) — ELEVATOR-ONLY ACCESS (4.00m below B3F, zero stairs!)
 *                                                       2.70m×15.50m High-Ceiling Clandestine Gang Research Laboratory
 *                                                       (5 Longitudinal Vault Zones: Airlock -> Chem Lab -> Cyber Ops -> Fab Lab -> Containment Vault)
 */

export const ELEVATOR = {
  id: 'ELV-1',
  name: 'MRL ギヤレス・トラクション式 超精密エレベーター（地下4階極秘研〜地上1階 直通・5停止）',
  // Exact Vertical Hoistway Shaft Footprint penetrating 1F / B1F / B2F / B3F / B4F cleanly (Total shaft H = 18.32 m!)
  shaft: {
    minX: 3.25,
    maxX: 4.85, // W = 1,600 mm
    minZ: 0.85,
    maxZ: 2.65, // D = 1,800 mm
    pitY: -15.60, // 1,400 mm deep reinforced concrete pit below B4F (-14.20m) with dual hydraulic oil buffers + governor tension sheave
    topY: 2.72,   // Machine-Room-Less (MRL) gearless PM traction machine deck inside 1F headroom (2F untouched!)
  },
  // Cab clear interior box (Walkable inside moving cabGroup!)
  cab: {
    minX: 3.36,
    maxX: 4.58, // Inner W = 1,220 mm
    minZ: 1.02,
    maxZ: 2.48, // Inner D = 1,460 mm
    height: 2.24,
  },
  // West-facing Synchronized Center-Opening Sliding Doors (Car Door + Interlocked Hall Door on all 5 floors)
  door: {
    x: 3.25,
    minZ: 1.30,
    maxZ: 2.20, // Clear opening W = 900 mm × H = 2,100 mm
    width: 0.90,
    height: 2.10,
  },
  // 5 Exact Stop Levels (sorted top-to-bottom for COP / HUD button display)
  stops: [
    { floor: 1,  code: '1F', short: '1F 地上直通',  label: '地上 1階（玄関・森へ直結）',           y: 0.00 },
    { floor: 0,  code: 'B1', short: 'B1F 倉庫',     label: '地下1階（セメント倉庫）',             y: -2.40 },
    { floor: -1, code: 'B2', short: 'B2F スタジオ',  label: '地下2階（10×10m スタジオ）',         y: -6.60 },
    { floor: -2, code: 'B3', short: 'B3F シェルター', label: '地下3階（木造シェルター・食料庫）', y: -10.20 },
    { floor: -3, code: 'B4', short: 'B4F 極秘研',   label: '地下4階（極秘研究所・ELV専用）',     y: -14.20, classified: true },
  ],
  maxSpeed: 2.40,    // m/s smooth gearless traction cruise (B4F -> 1F 14.2m smooth S-curve!)
  accel: 1.35,       // m/s^2 peak S-curve acceleration/deceleration
  jerk: 2.60,        // m/s^3 true jerk-limited S-curve ramp for authentic passenger ride feel!
  relevelSpeed: 0.18,// m/s final micro-leveling creep into exact sill flushness (±0.0mm)
  brakeReleaseDuration: 0.22,
  doorDuration: 1.20,
  holdDuration: 7.0,
};

// Enclosed Concrete Staircase ST_B2: B1F (-2.40m) <-> B2F (-6.60m)
// Descends South along West flank of B1F (X=-1.10..-0.10, Z=6.45 -> 9.85), landing directly at Studio Door DB2-0!
export const STAIR_B1_B2 = {
  id: 'ST_B2',
  minX: -1.10,
  maxX: -0.10,
  topZ: 6.45,     // B1F upper threshold (Y = -2.40)
  bottomZ: 9.85,  // B2F lower landing threshold (Y = -6.60)
  topY: -2.40,
  bottomY: -6.60,
  treads: 18,
  upperFloor: 0,
  lowerFloor: -1,
};

// Enclosed Concrete Staircase ST_B3: B2F (-6.60m) <-> B3F (-10.20m)
// Descends South along West flank south of ST_B2 (X=-1.15..-0.15, Z=12.45 -> 15.15), landing at Shelter Door DB3-ST!
export const STAIR_B2_B3 = {
  id: 'ST_B3',
  minX: -1.15,
  maxX: -0.15,
  topZ: 12.45,    // B2F upper threshold (Y = -6.60)
  bottomZ: 15.15, // B3F lower landing threshold (Y = -10.20)
  topY: -6.60,
  bottomY: -10.20,
  treads: 16,
  upperFloor: -1,
  lowerFloor: -2,
};

// =========================================================================
// FLOOR -1 — B2F / 地下2階 (B2FL-6,600, CH 3,800 高天井):
// 階段ドア DB2-0 の先に広がる 10m×10m 木床×コンクリート＆全面鏡スタジオ
// ＋ 直結 4m×6m 接続2室（B202・B203）＋ リアルエレベーター乗場 ELV-1
// =========================================================================
export const FLOOR_B2F = {
  index: 2, // Blueprint sheet index 2 (Sheet 0=B4F, 1=B3F, 2=B2F, 3=B1F, 4=1F...)
  physicalFloor: -1,
  building: 'main',
  code: 'B2F',
  titleJp: '地下2階 平面詳細図（10m×10m 木床・RC＆鏡スタジオ ＋ 4×6m接続2室）',
  subtitle: 'B2FL-6,600・広大天井 CH3,800mm・10×10mスタジオ＋4×6m 2室＋ELV-1直通エレベーター乗場',
  baseY: -6.60,
  ceilingH: 3.80,
  slabTopY: -2.40,
  floorLabel: 'B2FL-6600',
  width: 14.30,
  depth: 17.15,
  isBasement: true,
  isDeepB2: true,
  rooms: [
    {
      id: 'b2_elv_lobby', code: 'B200', floor: -1, nameJp: 'B2F エレベーター前室', nameEn: 'B2F Elevator Lobby',
      x: 1.65, z: 0.85, w: 1.60, d: 2.00, area: 3.20, jo: 1.98, fl: 'B2FL±0', ch: 'CH3200',
      floorTex: 'tile_grey_stone', floorName: '防滑グレーストーン床',
      wallName: '打放しRC壁＋ELV-1 地上直通エレベーター乗場＆大型呼出盤', tint: '#d8dfe6', labelPos: [2.45, 1.85],
      notes: '地上1F・B1F・B3Fへ直通する本格トラクション式エレベーター(ELV-1)乗場。大型発光呼出ボタン完備',
    },
    {
      id: 'b2_studio', code: 'B201', floor: -1, nameJp: 'メインスタジオ（10m×10m・木床＆RC・鏡）', nameEn: '10m×10m Concrete & Mirror Studio',
      x: 0.00, z: 2.85, w: 10.00, d: 10.00, area: 100.00, jo: 61.73, fl: 'B2FL±0', ch: 'CH3800(大空間)',
      floorTex: 'wood_floor', floorName: '無垢オーク・スタジオダンスフローリング',
      wallName: 'Pコン打放しコンクリート擁壁＋壁面大型スタジオミラー＆木製バー', tint: '#f3e5cc', labelPos: [5.00, 7.85],
      notes: 'B1F階段ドア(DB2-0)を開けると広がる内法10m×10m×天井高3.80mの開放スタジオ。北西壁に大型鏡とバー、天井照明レール＆音響バッフル',
    },
    {
      id: 'b2_room1', code: 'B202', floor: -1, nameJp: '音響コントロール＆録音室（4m×6m）', nameEn: '4m×6m Control & Recording Studio',
      x: 10.15, z: 2.85, w: 4.00, d: 6.00, area: 24.00, jo: 14.81, fl: 'B2FL±0', ch: 'CH3200',
      floorTex: 'wood_walnut_floor', floorName: 'ダークウォールナット防音床',
      wallName: '打放しコンクリート＋吸音木製縦格子＋大型防音観察窓', tint: '#e4ded5', labelPos: [12.15, 5.85],
      notes: 'スタジオ東壁から扉(DB2-1)と大型防音ガラスで直結する4m×6m接続室①。ミキシングコンソール・モニタースピーカー・シンセ機材ラック完備',
    },
    {
      id: 'b2_room2', code: 'B203', floor: -1, nameJp: '控室＆機材・トレーニング室（6m×4m）', nameEn: '6m×4m Studio Lounge & Gear Room',
      x: 3.85, z: 13.00, w: 6.00, d: 4.00, area: 24.00, jo: 14.81, fl: 'B2FL±0', ch: 'CH3200',
      floorTex: 'parquet_oak', floorName: 'オーク寄木パーケット床',
      wallName: '打放しRC＋壁面ミラー＋機材ラック＆ラウンジソファ', tint: '#ebe3d5', labelPos: [6.85, 15.00],
      notes: 'スタジオ南壁から防音引戸(DB2-2)で直結する4m×6m接続室②。レザーソファ・機材ケース・ウェイトベンチ・姿見ミラーを配置',
    },
  ],
  walls: [
    // B2F Elevator Lobby North & West Retaining Walls (X=1.50..3.25, Z=0.70..2.85)
    { id: 'WB2_ELV_N', axis: 'h', x1: 1.50, z1: 0.70, x2: 3.30, z2: 0.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_ELV_W', axis: 'v', x1: 1.50, z1: 0.85, x2: 1.65, z2: 2.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    // Main 10m×10m Studio North Concrete Wall (Z=2.70..2.85) — clean 1.50m portal into B200 ELV Lobby at X=1.65..3.15!
    { id: 'WB2_N1', axis: 'h', x1: -0.15, z1: 2.70, x2: 1.65, z2: 2.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_N2', axis: 'h', x1: 3.15, z1: 2.70, x2: 10.15, z2: 2.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    // Main 10m×10m Studio West Concrete Wall (X=-0.15..0.00): Stair Door DB2-0 + B3F Stair Door DB2-3!
    {
      id: 'WB2_W', axis: 'v', x1: -0.15, z1: 2.85, x2: 0.00, z2: 12.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon',
      openings: [
        { id: 'DB2-0', type: 'door_swing', pos: 9.85, width: 1.05, height: 2.30, sill: 0, tex: 'door_walnut', hinge: 'left', swingDir: 1, label: 'DB2-0 スタジオ正面扉（階段室→10×10m空間）' },
        { id: 'DB2-3', type: 'door_swing', pos: 11.45, width: 0.95, height: 2.15, sill: 0, tex: 'exterior_siding_grey', hinge: 'left', swingDir: -1, label: 'DB2-3 地下3階への階段扉' },
      ],
    },
    // Main Studio East Concrete Wall (X=10.00..10.15) dividing B201 <-> B202 (4m×6m Room 1)
    {
      id: 'WB2_E1', axis: 'v', x1: 10.00, z1: 2.85, x2: 10.15, z2: 8.85, kind: 'int', texA: 'concrete_pcon', texB: 'wood_slats',
      openings: [
        { id: 'WB2-OBS', type: 'window', pos: 3.45, width: 1.75, height: 1.35, sill: 0.95, label: 'WB2-OBS 防音スタジオ観察窓' },
        { id: 'DB2-1', type: 'door_swing', pos: 5.75, width: 1.00, height: 2.20, sill: 0, tex: 'door_walnut', hinge: 'left', swingDir: 1, label: 'DB2-1 録音コントロール室扉 (4×6m ①)' },
      ],
    },
    { id: 'WB2_E2', axis: 'v', x1: 10.00, z1: 8.85, x2: 10.15, z2: 13.00, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    // Main Studio South Concrete Wall (Z=12.85..13.00) dividing B201 <-> B203 (6m×4m Room 2)
    { id: 'WB2_S1', axis: 'h', x1: -0.15, z1: 12.85, x2: 3.85, z2: 13.00, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    {
      id: 'WB2_S2', axis: 'h', x1: 3.85, z1: 12.85, x2: 10.00, z2: 13.00, kind: 'int', texA: 'concrete_pcon', texB: 'concrete_pcon',
      openings: [
        { id: 'DB2-2', type: 'door_pocket', pos: 6.30, width: 1.15, height: 2.20, sill: 0, tex: 'door_oak', slideDir: 1, label: 'DB2-2 控室・トレーニング室引戸 (4×6m ②)' },
      ],
    },
    // B202 (4m×6m East Room) Outer Concrete Walls (X=10.15..14.15, Z=2.85..8.85)
    { id: 'WB2_R1N', axis: 'h', x1: 10.15, z1: 2.70, x2: 14.30, z2: 2.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_R1E', axis: 'v', x1: 14.15, z1: 2.85, x2: 14.30, z2: 8.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_R1S', axis: 'h', x1: 10.15, z1: 8.85, x2: 14.30, z2: 9.00, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    // B203 (6m×4m South Room) Outer Concrete Walls (X=3.85..9.85, Z=13.00..17.00)
    { id: 'WB2_R2W', axis: 'v', x1: 3.70, z1: 13.00, x2: 3.85, z2: 17.15, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_R2E', axis: 'v', x1: 9.85, z1: 13.00, x2: 10.00, z2: 17.15, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB2_R2S', axis: 'h', x1: 3.70, z1: 17.00, x2: 10.00, z2: 17.15, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
  ],
  lighting: [
    { type: 'CL', x: 5.00, z: 7.85, label: 'スタジオ中央トラック照明 (3500K)' },
    { type: 'DL', x: 2.50, z: 5.20, label: 'ミラー壁面スポット' },
    { type: 'DL', x: 12.15, z: 5.85, label: 'B202 録音室灯' },
    { type: 'DL', x: 6.85, z: 15.00, label: 'B203 控室灯' },
  ],
  outlets: [
    { x: 0.25, z: 4.50, label: '30Aスタジオ電源' },
    { x: 13.85, z: 5.85, label: '音響アイソレート200V' },
    { x: 9.60, z: 15.00, label: '機材充電2P' },
  ],
  plumbing: [
    { kind: 'vent', x: 9.50, z: 3.30, label: '大型防音換気ダクト' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[-0.60, 10.35], [2.45, 10.35], [2.45, 1.85], [3.60, 1.85]] },
    { kind: 'work', pts: [[5.00, 7.85], [12.15, 5.85]] },
    { kind: 'priv', pts: [[5.00, 7.85], [6.85, 15.00]] },
  ],
};

// =========================================================================
// FLOOR -2 — B3F / 地下3階 (B3FL-10,200, CH 2,800):
// ① 主人公幅1.3倍通路 (W 520 mm) -> 本格リアルエレベーター ELV-1（一気に地上1Fへ直通！）
// ② 木の温かみのあるシェルター室 (3.2m × 12.5m): 居間・シャワー室・トイレ室・寝室内蔵
// ③ 奥の扉 (DB3-FD) の先: 食料備蓄倉庫 (2.0m × 6.0m)
// =========================================================================
export const FLOOR_B3F = {
  index: 1, // Blueprint sheet index 1 (Sheet 0=B4F, 1=B3F, 2=B2F...)
  physicalFloor: -2,
  building: 'main',
  code: 'B3F',
  titleJp: '地下3階 平面詳細図（W520通路→地上直通リアルELV ＋ 木造シェルター3.2×12.5m ＋ 食料倉庫2×6m）',
  subtitle: 'B3FL-10,200・主人公幅1.3倍通路(W520mm)・地上直通MRLトラクションELV・木造シェルター(シャワー/WC/寝室)＋奥扉2×6m食料備蓄庫',
  baseY: -10.20,
  ceilingH: 2.80,
  slabTopY: -6.60,
  floorLabel: 'B3FL-10200',
  width: 5.00,
  depth: 22.40,
  isBasement: true,
  isDeepB3: true,
  corridorWidthMm: 520, // Exact 1.30 × protagonist Ø400 mm!
  rooms: [
    {
      id: 'b3_corridor', code: 'B300', floor: -2, nameJp: '主人公1.3倍幅 地下通路 (W520) → ELV乗場', nameEn: '520mm (1.3×) Elevator Corridor',
      x: 1.34, z: 1.20, w: 1.91, d: 2.40, area: 2.15, jo: 1.33, fl: 'B3FL±0', ch: 'CH2450',
      floorTex: 'metal_grate', floorName: '防滑スチール床＋足元アンバー誘導灯',
      wallName: '主人公幅400mm×1.3倍＝有効幅520mm通路・先頭に地上直通リアルELV-1', tint: '#d4dce4', labelPos: [2.35, 1.75],
      notes: '主人公の当たり判定幅400mmに対し正確に1.3倍の有効幅520mm通路。その先にB3F→地上1Fまで一気に昇降する本格トラクション式エレベーター(ELV-1)を接続',
    },
    {
      id: 'b3_shelter_living', code: 'B301', floor: -2, nameJp: '木の温もりシェルター室（居間・ダイニング）', nameEn: 'Warm Wooden Shelter Living (3.2×12.5m)',
      x: 0.00, z: 3.60, w: 3.20, d: 5.00, area: 21.78, jo: 13.44, fl: 'B3FL±0', ch: 'CH2800',
      floorTex: 'wood_floor', floorName: '無垢ヒノキ＆オーク温もりフローリング',
      wallName: '天然シダー縦羽目板＋暖色間接照明＋暖炉風ヒーター＋空気清浄機', tint: '#f6e7cc', labelPos: [1.60, 6.10],
      notes: '内法3.2m×12.5mの木の温かみあふれる大型地下シェルター主空間。天然木壁・ソファ・木製ダイニング・換気浄化ユニットを装備（中廊下含む）',
    },
    {
      id: 'b3_shower', code: 'B302', floor: -2, nameJp: 'シェルター内 シャワー室', nameEn: 'Shelter Rain Shower Room',
      x: 1.75, z: 8.60, w: 1.45, d: 1.80, area: 2.61, jo: 1.61, fl: 'B3FL-20', ch: 'CH2500',
      floorTex: 'tile_blue_bath', floorName: '防滑ブルー浴室タイル＋排水グレーチング',
      wallName: '防水タイル＋ヒノキ防湿木枠・レインシャワー＆木製ベンチ', tint: '#d4e8f2', labelPos: [2.48, 9.50],
      notes: '3.2×12.5m木造シェルター内に内蔵された独立シャワー室。大型オーバーヘッドレインシャワーと防湿木製ベンチを完備',
    },
    {
      id: 'b3_toilet', code: 'B303', floor: -2, nameJp: 'シェルター内 トイレ室', nameEn: 'Shelter Private Toilet',
      x: 1.75, z: 10.50, w: 1.45, d: 1.60, area: 2.32, jo: 1.43, fl: 'B3FL±0', ch: 'CH2500',
      floorTex: 'tile_beige_grid', floorName: 'ベージュ磁器タイル',
      wallName: '温もり木製腰壁＋タンクレス陶器便器・手洗カウンター＆丸鏡', tint: '#e4efe8', labelPos: [2.48, 11.30],
      notes: '3.2×12.5m木造シェルター内の独立衛生トイレ個室。独立手洗器・丸鏡・静音強制換気完備',
    },
    {
      id: 'b3_bedroom', code: 'B304', floor: -2, nameJp: 'シェルター内 木造寝室', nameEn: 'Shelter Wooden Bedroom',
      x: 0.00, z: 12.20, w: 3.20, d: 3.90, area: 12.48, jo: 7.70, fl: 'B3FL±0', ch: 'CH2750',
      floorTex: 'parquet_oak', floorName: 'オーク寄木フローリング＋ラグ',
      wallName: '温もり杉羽目板＋木製造作クイーンベッド・書斎デスク・奥に備蓄庫扉', tint: '#f3e1c8', labelPos: [1.60, 14.15],
      notes: '3.2×12.5m木造シェルター南奥の安眠木造寝室。西側にB2F階段扉(DB3-ST)、南最奥に2×6m食料備蓄倉庫への気密扉(DB3-FD)を配置',
    },
    {
      id: 'b3_food_vault', code: 'B305', floor: -2, nameJp: '食料備蓄倉庫（2.0m×6.0m）', nameEn: '2m×6m Food Storage Warehouse',
      x: 0.60, z: 16.25, w: 2.00, d: 6.00, area: 12.00, jo: 7.41, fl: 'B3FL±0', ch: 'CH2600',
      floorTex: 'concrete_clean', floorName: '防湿コンクリート保冷土間',
      wallName: '両側大容量木製＆スチール備蓄棚・20L水タンク群・非常食木箱・大型冷凍冷蔵庫', tint: '#e2e6dc', labelPos: [1.60, 19.25],
      notes: 'シェルター室奥の気密扉(DB3-FD)の先にある内法2.0m×6.0mの食料備蓄倉庫。長期備蓄用の食料・飲料水・冷凍庫を左右整然と格納',
    },
  ],
  walls: [
    // --- B300: W 520mm (1.3× protagonist) L-Shaped Corridor -> Elevator Waiting Landing (X=2.65..3.25, Z=1.20..2.30) ---
    // Corridor North Leg: X=1.34..1.86 (W=0.52m), Z=1.49..3.60
    // Corridor East Leg:  X=1.86..2.65, Z=1.49..2.01 (W=0.52m)
    // Elevator Landing:   X=2.65..3.25, Z=1.20..2.30 (faces ELV-1 West Doors at X=3.25, Z=1.30..2.20!)
    { id: 'WB3_C_W',  axis: 'v', x1: 1.22, z1: 1.37, x2: 1.34, z2: 3.60, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_N1', axis: 'h', x1: 1.22, z1: 1.37, x2: 2.65, z2: 1.49, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_N2', axis: 'h', x1: 2.53, z1: 1.08, x2: 3.25, z2: 1.20, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_LN', axis: 'v', x1: 2.53, z1: 1.20, x2: 2.65, z2: 1.49, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_E1', axis: 'v', x1: 1.86, z1: 2.01, x2: 1.98, z2: 3.60, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_S1', axis: 'h', x1: 1.86, z1: 2.01, x2: 2.65, z2: 2.13, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_LS', axis: 'v', x1: 2.53, z1: 2.01, x2: 2.65, z2: 2.42, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB3_C_S2', axis: 'h', x1: 2.53, z1: 2.30, x2: 3.25, z2: 2.42, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },

    // --- 3.20m × 12.50m Warm Wooden Shelter Envelope (X=0.00..3.20, Z=3.60..16.10) ---
    // North Shelter Wall (Z=3.45..3.60) with Door DB3-COR opening cleanly into the W520mm Corridor!
    {
      id: 'WB3_SH_N', axis: 'h', x1: -0.15, z1: 3.45, x2: 3.35, z2: 3.60, kind: 'ext', extTex: 'concrete_pcon', intTex: 'wood_slats',
      openings: [
        { id: 'DB3-COR', type: 'door_swing', pos: 1.34, width: 0.52, height: 2.10, sill: 0, tex: 'door_oak', hinge: 'left', swingDir: 1, label: 'DB3-COR 地下通路扉 (W520→エレベーター)' },
      ],
    },
    // West Shelter Wall (X=-0.15..0.00) with Stair Arrival Door DB3-ST from B2F ST_B3!
    {
      id: 'WB3_SH_W', axis: 'v', x1: -0.15, z1: 3.60, x2: 0.00, z2: 16.10, kind: 'ext', extTex: 'concrete_pcon', intTex: 'wainscot_wood',
      openings: [
        { id: 'DB3-ST', type: 'door_swing', pos: 15.10, width: 0.88, height: 2.10, sill: 0, tex: 'door_walnut', hinge: 'left', swingDir: 1, label: 'DB3-ST B2F階段室連絡扉' },
      ],
    },
    // East Shelter Wall (X=3.20..3.35)
    { id: 'WB3_SH_E', axis: 'v', x1: 3.20, z1: 3.60, x2: 3.35, z2: 16.10, kind: 'ext', extTex: 'concrete_pcon', intTex: 'wainscot_wood', openings: [] },
    // South Shelter Wall (Z=16.10..16.25) with Heavy Insulated Food Vault Door DB3-FD -> 2.0m×6.0m Warehouse!
    {
      id: 'WB3_SH_S', axis: 'h', x1: -0.15, z1: 16.10, x2: 3.35, z2: 16.25, kind: 'int', texA: 'wainscot_wood', texB: 'concrete_clean',
      openings: [
        { id: 'DB3-FD', type: 'door_swing', pos: 1.15, width: 0.90, height: 2.15, sill: 0, tex: 'door_navy', hinge: 'left', swingDir: 1, label: 'DB3-FD 食料備蓄倉庫 気密扉 (2×6m)' },
      ],
    },

    // --- Internal Warm Wooden Partitions inside 3.2m×12.5m Shelter (Shower B302, Toilet B303, Bedroom B304) ---
    { id: 'WB3_SHW_N', axis: 'h', x1: 1.65, z1: 8.50, x2: 3.20, z2: 8.60, kind: 'int', texA: 'wood_slats', texB: 'tile_emerald_gloss', openings: [] },
    { id: 'WB3_SHW_S', axis: 'h', x1: 1.65, z1: 10.40, x2: 3.20, z2: 10.50, kind: 'int', texA: 'tile_emerald_gloss', texB: 'tile_white_small', openings: [] },
    {
      id: 'WB3_WET_W', axis: 'v', x1: 1.65, z1: 8.60, x2: 1.75, z2: 12.10, kind: 'int', texA: 'wainscot_wood', texB: 'tile_white_small',
      openings: [
        { id: 'DB3-SH', type: 'door_pocket', pos: 9.05, width: 0.80, height: 2.05, sill: 0, tex: 'door_glass_white', slideDir: 1, label: 'DB3-SH シェルター シャワー室引戸' },
        { id: 'DB3-WC', type: 'door_pocket', pos: 10.90, width: 0.78, height: 2.05, sill: 0, tex: 'door_oak', slideDir: 1, label: 'DB3-WC シェルター トイレ引戸' },
      ],
    },
    {
      id: 'WB3_BED_N', axis: 'h', x1: 0.00, z1: 12.10, x2: 3.20, z2: 12.20, kind: 'int', texA: 'wood_slats', texB: 'wainscot_wood',
      openings: [
        { id: 'DB3-BD', type: 'door_pocket', pos: 0.35, width: 0.90, height: 2.10, sill: 0, tex: 'door_oak', slideDir: 1, label: 'DB3-BD シェルター 木造寝室引戸' },
      ],
    },

    // --- 2.00m × 6.00m Food Storage Warehouse Envelope (X=0.60..2.60, Z=16.25..22.25) ---
    { id: 'WB3_FD_W', axis: 'v', x1: 0.45, z1: 16.25, x2: 0.60, z2: 22.40, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_clean', openings: [] },
    { id: 'WB3_FD_E', axis: 'v', x1: 2.60, z1: 16.25, x2: 2.75, z2: 22.40, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_clean', openings: [] },
    { id: 'WB3_FD_S', axis: 'h', x1: 0.45, z1: 22.25, x2: 2.75, z2: 22.40, kind: 'ext', extTex: 'concrete_clean', intTex: 'concrete_clean', openings: [] },
  ],
  lighting: [
    { type: 'BL', x: 2.35, z: 1.75, label: 'ELV-1 地下3階乗場灯' },
    { type: 'PL', x: 1.60, z: 5.80, label: '木造シェルター暖色ペンダント' },
    { type: 'DL', x: 2.48, z: 9.50, label: 'シャワー防水灯' },
    { type: 'DL', x: 2.48, z: 11.30, label: 'トイレ灯' },
    { type: 'CV', x: 1.60, z: 14.15, label: '寝室木目間接灯' },
    { type: 'CL', x: 1.60, z: 19.25, label: '食料備蓄庫 LED作業バー' },
  ],
  outlets: [
    { x: 0.18, z: 5.50, label: '非常蓄電100V' },
    { x: 0.18, z: 14.20, label: '枕元USB/100V' },
    { x: 1.60, z: 22.05, label: '冷凍庫専用200V' },
  ],
  plumbing: [
    { kind: 'water', pts: [[3.08, 9.50], [3.08, 11.30]] },
    { kind: 'drain', pts: [[2.48, 9.50], [2.48, 11.30]] },
    { kind: 'vent', x: 0.25, z: 4.10, label: 'HEPA陽圧給気ユニット' },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[3.75, 1.75], [1.60, 1.75], [1.60, 5.80], [0.85, 10.50], [1.60, 14.15], [1.60, 19.25]] },
  ],
};

// =========================================================================
// FLOOR -3 — B4F / 地下4階 (B4FL-14,200 = B3Fより正確に4.00m下, CH 3,550 高天井):
// ★ エレベーター ELV-1 専用到達フロア（階段一切なし・完全独立極秘研究区画）
// ★ 内法 2.70m × 15.50m (41.85 m²) 細長高天井 ギャング極秘研究所（5段階縦貫ゾーニング）
//    Zone 1 (B401): ELV-1直結 生体認証エアロック＆除染前室 (2.70 × 2.40m)
//    Zone 2 (B402): 精密化学・薬理合成ラボ＆ドラフトチャンバー (2.70 × 3.50m)
//    Zone 3 (B403): 電脳・暗号解析＆サイバー戦術司令区画 (2.70 × 3.30m)
//    Zone 4 (B404): 精密CNC機械工作＆ガジェット・ドローン試作室 (2.70 × 3.10m)
//    Zone 5 (B405): 極秘コアサンプル低温封じ込め＆金庫保管室 (2.70 × 2.80m)
// =========================================================================
export const FLOOR_B4F = {
  index: 0, // Blueprint sheet index 0 (Deepest classified floor!)
  physicalFloor: -3,
  building: 'main',
  code: 'B4F',
  titleJp: '地下4階 平面詳細図・縦断面図（ELV専用・2.7m×15.5m ギャング極秘研究所）',
  subtitle: 'B4FL-14,200 (B3Fより4.0m下)・階段なしELV-1専用・高天井CH3,550mm・2.7×15.5m細長5区画極秘R&D施設',
  baseY: -14.20,     // EXACT 4.00 m below B3F (-10.20 m)!
  ceilingH: 3.55,    // Soaring high-ceiling RC ribbed research vault (450 mm seismic isolation slab beneath B3F!)
  slabTopY: -10.20,
  floorLabel: 'B4FL-14200',
  originX: 0.55,
  originZ: 0.85,
  width: 2.70,       // EXACT 2,700 mm clear interior width (X = 0.55 .. 3.25)!
  depth: 15.50,      // EXACT 15,500 mm clear interior length (Z = 0.85 .. 16.35)!
  isBasement: true,
  isDeepB4: true,
  elevatorOnly: true,
  rooms: [
    {
      id: 'b4_airlock', code: 'B401', floor: -3, nameJp: '① 生体認証エアロック＆除染前室 (ELV専用口)', nameEn: 'Biometric Airlock & Decon Entry',
      x: 0.55, z: 0.85, w: 2.70, d: 2.40, area: 6.48, jo: 4.00, fl: 'B4FL±0', ch: 'CH3550',
      floorTex: 'rubber_black_stud', floorName: '帯電防止黒エポキシ＆除染グレーチング',
      wallName: '耐爆RC打放し＋生体認証スキャナー・防護服ロッカー・緊急洗眼シャワー・CCTV', tint: '#d5dde8', labelPos: [1.90, 2.05],
      notes: 'エレベーターELV-1のみから直接到達するB4F専用入口。階段一切なし。頭上エアシャワーノズル・虹彩＆掌紋認証端末・組織極秘紋章プレートを装備',
    },
    {
      id: 'b4_chem_lab', code: 'B402', floor: -3, nameJp: '② 精密化学・薬理合成ラボ', nameEn: 'Chemical & Synthesis Lab',
      x: 0.55, z: 3.35, w: 2.70, d: 3.50, area: 9.45, jo: 5.83, fl: 'B4FL±0', ch: 'CH3550',
      floorTex: 'tile_grey_stone', floorName: '耐薬品防滑グレーラボ床＋中央ピット溝',
      wallName: 'SUSドラフトチャンバー・高圧ガスボンベ(N2/Ar/O2)・顕微鏡・遠心分離機・合成式ボード', tint: '#d3e6e4', labelPos: [1.90, 5.10],
      notes: '西壁に排気ダクト直結ガラスドラフトチャンバー＆蒸留フラスコ群、東壁に耐振石天板ベンチ・光学顕微鏡・遠心分離機・試薬瓶棚・分子合成ホワイトボード',
    },
    {
      id: 'b4_cyber_ops', code: 'B403', floor: -3, nameJp: '③ 電脳解析・暗号＆戦術司令区画', nameEn: 'Cyber Cryptanalysis & Tactical Ops',
      x: 0.55, z: 6.95, w: 2.70, d: 3.30, area: 8.91, jo: 5.50, fl: 'B4FL±0', ch: 'CH3550',
      floorTex: 'tile_grey_stone', floorName: '静電対策ラボフロア＋光ファイバー床ピット',
      wallName: '5画面解析コンソール・42Uサーバーラック3連・オシロスコープ・組織作戦相関ボード', tint: '#d8def0', labelPos: [1.90, 8.60],
      notes: '主人公の主解析デスク。5画面戦術モニター・暗号解読サーバー群・電子工作はんだステーション・東壁に赤糸と地図のギャング作戦相関ボード＆暗号無線機',
    },
    {
      id: 'b4_fab_lab', code: 'B404', floor: -3, nameJp: '④ 精密CNC工作＆ガジェット試作室', nameEn: 'CNC Fabrication & Gadget Prototyping',
      x: 0.55, z: 10.35, w: 2.70, d: 3.10, area: 8.37, jo: 5.17, fl: 'B4FL±0', ch: 'CH3550',
      floorTex: 'concrete_clean', floorName: '重荷重防振コンクリート＋モノレールクレーン下',
      wallName: '5軸CNCフライス盤・UV光造形3Dプリンタ・ドローン試作台・赤ツールチェスト・戦術装備有孔壁', tint: '#e6dfd4', labelPos: [1.90, 11.90],
      notes: '天井I形鋼モノレールホイスト直下の重工作区画。CNC加工機・3Dプリンタ・偵察ドローン試作ベンチ・光学機器/ジャマー/セラミック防弾板の壁面試作ラック',
    },
    {
      id: 'b4_vault', code: 'B405', floor: -3, nameJp: '⑤ 極秘コア封じ込め＆低温金庫室', nameEn: 'Classified Core Containment & Cryo Vault',
      x: 0.55, z: 13.55, w: 2.70, d: 2.80, area: 7.56, jo: 4.67, fl: 'B4FL±0', ch: 'CH3550',
      floorTex: 'rubber_black_stud', floorName: '耐爆装甲床＋発光インジケータグレーチング',
      wallName: '回転発光コア封じ込めポッド(-196℃)・超低温冷凍庫(-80℃)・大型ダイヤル金庫・48kWh独立電源', tint: '#e3d5dc', labelPos: [1.90, 14.95],
      notes: '15.5m細長空間の最奥。装甲扉DB4-4の先に鎮座する極秘研究コア封じ込め装置（稼働切替可能）・超低温保管庫・組織機密金庫・完全オフグリッド48kWh非常電源',
    },
  ],
  walls: [
    // Reinforced 200mm Subterranean Concrete Blast Shell (Clear Interior: X = 0.55..3.25 [2.70m], Z = 0.85..16.35 [15.50m]!)
    { id: 'WB4_N', axis: 'h', x1: 0.35, z1: 0.65, x2: 3.45, z2: 0.85, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB4_S', axis: 'h', x1: 0.35, z1: 16.35, x2: 3.45, z2: 16.55, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    { id: 'WB4_W', axis: 'v', x1: 0.35, z1: 0.85, x2: 0.55, z2: 16.35, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },
    // East Wall starts at Z = 2.65 because Z = 0.85..2.65 is flush with ELV-1 Shaft Front Wall & Door (X=3.25, Z=1.30..2.20)!
    { id: 'WB4_E', axis: 'v', x1: 3.25, z1: 2.65, x2: 3.45, z2: 16.35, kind: 'ext', extTex: 'concrete_pcon', intTex: 'concrete_pcon', openings: [] },

    // 4 High-Ceiling Acoustic Glass & Steel Transverse Bulkheads (Z=3.25, 6.85, 10.25, 13.45) with Aligned 960mm Doors along X=1.50..2.46!
    {
      id: 'WB4_DIV1', axis: 'h', x1: 0.55, z1: 3.25, x2: 3.25, z2: 3.35, kind: 'int', texA: 'concrete_clean', texB: 'concrete_clean',
      openings: [
        { id: 'WB4-G1', type: 'window', pos: 0.65, width: 0.74, height: 1.38, sill: 0.88, label: 'WB4-G1 エアロック観察窓' },
        { id: 'DB4-1', type: 'door_pocket', pos: 1.50, width: 0.96, height: 2.25, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DB4-1 生体認証エアロック気密扉' },
      ],
    },
    {
      id: 'WB4_DIV2', axis: 'h', x1: 0.55, z1: 6.85, x2: 3.25, z2: 6.95, kind: 'int', texA: 'concrete_clean', texB: 'concrete_clean',
      openings: [
        { id: 'WB4-G2', type: 'window', pos: 0.65, width: 0.74, height: 1.38, sill: 0.88, label: 'WB4-G2 化学ラボ防音ガラス窓' },
        { id: 'DB4-2', type: 'door_pocket', pos: 1.50, width: 0.96, height: 2.25, sill: 0, tex: 'door_glass_white', slideDir: -1, label: 'DB4-2 電脳司令室 防音クリーン扉' },
      ],
    },
    {
      id: 'WB4_DIV3', axis: 'h', x1: 0.55, z1: 10.25, x2: 3.25, z2: 10.35, kind: 'int', texA: 'concrete_clean', texB: 'concrete_clean',
      openings: [
        { id: 'WB4-G3', type: 'window', pos: 0.65, width: 0.74, height: 1.38, sill: 0.88, label: 'WB4-G3 精密工作区画 観察窓' },
        { id: 'DB4-3', type: 'door_pocket', pos: 1.50, width: 0.96, height: 2.25, sill: 0, tex: 'exterior_siding_grey', slideDir: -1, label: 'DB4-3 試作工作室 鋼製スライディング扉' },
      ],
    },
    {
      id: 'WB4_DIV4', axis: 'h', x1: 0.55, z1: 13.45, x2: 3.25, z2: 13.55, kind: 'int', texA: 'concrete_pcon', texB: 'concrete_pcon',
      openings: [
        { id: 'WB4-G4', type: 'window', pos: 0.68, width: 0.68, height: 1.18, sill: 1.04, label: 'WB4-G4 耐爆強化ガラス覗窓' },
        { id: 'DB4-4', type: 'door_swing', pos: 1.48, width: 0.98, height: 2.28, sill: 0, tex: 'door_navy', hinge: 'left', swingDir: 1, label: 'DB4-4 極秘コア保管庫 装甲扉' },
      ],
    },
  ],
  lighting: [
    { type: 'CL', x: 1.90, z: 2.05, label: 'B401 除染エアロック灯' },
    { type: 'CL', x: 1.90, z: 5.10, label: 'B402 化学ラボ高演色バー灯' },
    { type: 'DL', x: 1.90, z: 8.60, label: 'B403 電脳戦術司令スポット' },
    { type: 'CL', x: 1.90, z: 11.90, label: 'B404 CNC工作高天井リニア灯' },
    { type: 'PD', x: 1.90, z: 15.00, label: 'B405 コア封じ込め室 警戒・解析灯' },
  ],
  outlets: [
    { x: 0.65, z: 5.10, label: '三相200Vドラフト電源' },
    { x: 0.65, z: 8.60, label: 'UPS無停電サーバー電源' },
    { x: 0.65, z: 11.90, label: 'CNC動力200V' },
    { x: 3.10, z: 15.20, label: '48kWh独立バッテリー幹線' },
  ],
  plumbing: [
    { kind: 'vent', x: 0.78, z: 4.95, label: 'HEPA陰圧排気縦ダクト (15m幹線)' },
    { kind: 'drain', pts: [[1.96, 1.40], [1.96, 15.60]] },
  ],
  flowPaths: [
    { kind: 'entry', pts: [[3.75, 1.75], [1.96, 1.75], [1.96, 5.10], [1.96, 8.60], [1.96, 11.90], [1.96, 14.55]] },
  ],
};

