/**
 * Single Source of Truth — NULL EREA Underground Airship Base (B40F / -40.0m),
 * High-Speed 40m Express Elevator (ELV-NULL / TECNICA EXPRESS-40),
 * 4-Tier 44-Plate Articulated Mechanical Launch Silo Roof & 40m Hydraulic Mega-Lift (SILO-40),
 * & Flagship Live-In High-Speed Airship "K-11" developed by "tecnica forces"
 * (Company Founder + 9 Hand-Picked Elite Volunteer Engineers, 2-Year Development, 4 Technological Breakthroughs).
 */

// =========================================================================
// 1. NULL EREA SITE COORDINATES (Aligned 1:1 with TERRENO_WORLD.southRect)
//    southRect: X ∈ [-150, +150] (300m W), Z ∈ [29860, 29960] (100m D)
//    Center: (0.0, 29910.0)
// =========================================================================
export const NULL_EREA = {
  id: 'null_erea',
  name: 'NULL EREA / 地下40m 飛行船極秘基地 SILO-40',
  subtitle: '南端空白地帯 NULL EREA（300m×100m）｜ 40m高速エレベーター ＋ 4層44枚メカ可動屋根 ＋ 巨大高昇機 ＋ 地下40m格納庫',
  originX: 0.0,
  originZ: 29910.0,
  // Surface Reinforced Titanium-Concrete Apron (flush at southRectY + 0.02)
  apron: {
    minX: -48.0,
    maxX: 48.0,
    minZ: 29872.0,
    maxZ: 29948.0,
  },
  // Open Launch Silo Aperture (Terrain fragment shader discards pixels strictly inside this well!)
  siloAperture: {
    minX: -10.0,
    maxX: 10.0,
    minZ: 29889.0,
    maxZ: 29931.0,
    width: 20.0,
    length: 42.0,
    depth: 40.0, // EXACT 40.00 m underground!
  },
  // High-Speed 40m Elevator Shaft Cutout (West of Silo)
  elvCutout: {
    minX: -26.25,
    maxX: -23.75,
    minZ: 29908.75,
    maxZ: 29911.25,
  },
  // Underground Hangar Cavern Outer Envelope at B40F (Y = groundY - 40.0m)
  hangar: {
    minX: -23.5,
    maxX: 23.5,
    minZ: 29883.0,
    maxZ: 29937.0,
    width: 47.0,
    length: 54.0,
    cavernCeilingH: 14.5, // Tall vaulted cavern roof opening to central 40m launch shaft
    depthY: -40.0,        // Exact -40.00 m below surface groundY!
  },
  // Surface Camper Staging / Docking Apron (East of Silo — safe flat pad for RV & ARMOR-155)
  camperDock: {
    cx: 28.0,
    cz: 29910.0,
    minX: 16.0,
    maxX: 44.0,
    minZ: 29888.0,
    maxZ: 29932.0,
  },
  // Surface & Hangar Refueling Zones (100L Max)
  refuelRadius: 68.0,
  homeRefuelCenter: { x: 1.5, z: 3.5, radius: 75.0 },
};

// =========================================================================
// 2. HIGH-SPEED 40m DEEP-SHAFT ELEVATOR — ELV-NULL (TECNICA EXPRESS-40)
//    Connects Surface Pavilion (GL 0.0m) <-> Underground Hangar (B40F -40.0m)
// =========================================================================
export const NULL_ELEVATOR = {
  id: 'ELV-NULL',
  nameJp: '地下40m直通 高速リニアエレベーター (ELV-NULL / TECNICA EXPRESS-40)',
  shaft: {
    minX: -26.20,
    maxX: -23.80,
    minZ: 29908.80,
    maxZ: 29911.20,
    width: 2.40,
    depth: 2.40,
    cx: -25.00,
    cz: 29910.00,
    travelM: 40.00,
  },
  cab: {
    minX: -26.02,
    maxX: -23.98,
    minZ: 29908.98,
    maxZ: 29911.02,
    width: 2.04,
    depth: 2.04,
    height: 2.50,
    cx: -25.00,
    cz: 29910.00,
  },
  door: {
    x: -23.80, // East face opening toward Surface Launch Apron & B40F West Concourse
    minZ: 29909.35,
    maxZ: 29910.65,
    width: 1.30,
    height: 2.24,
  },
  pavilion: {
    minX: -28.00,
    maxX: -22.20,
    minZ: 29906.80,
    maxZ: 29913.20,
    height: 4.40,
  },
  maxSpeed: 12.5, // 45 km/h high-speed linear-assisted plunge!
  accel: 5.5,
  stops: [
    { floor: 1,   code: 'GL',   labelJp: '地上 0m (NULL EREA)', relY: 0.0 },
    { floor: -40, code: 'B40F', labelJp: '地下40m (K-11車庫)',  relY: -40.0 },
  ],
};

// =========================================================================
// 3. 4-TIER 44-PLATE ARTICULATED MECHANICAL ROOF & 40m MEGA-LIFT SPEC
// =========================================================================
export const NULL_SILO_MECHANISM = {
  totalPlates: 44,
  tiers: [
    {
      tier: 1,
      nameJp: '第1層：地上装甲ブラスト・ルーバー屋根（16枚・左右8連）',
      relY: -0.16,
      pairs: 8,
      plates: 16,
      motionJp: '油圧ロック解除→+16°チルト上昇→南北波状カスケード水平展開',
    },
    {
      tier: 2,
      nameJp: '第2層：油圧アイリス折畳み装甲プレート（12枚・左右6連）',
      relY: -2.00,
      pairs: 6,
      plates: 12,
      motionJp: '油圧シリンダ伸長連動→86°垂直跳ね上げ格納ポケット収容',
    },
    {
      tier: 3,
      nameJp: '第3層：防音・気圧隔壁テレスコピック・スラット（10枚・左右5連）',
      relY: -4.10,
      pairs: 5,
      plates: 10,
      motionJp: '減圧LED青緑切替→中央起点交互テレスコピック左右引込',
    },
    {
      tier: 4,
      nameJp: '第4層：深部重装甲ブラスト・ジョー扉（6枚・左右3連）',
      relY: -6.40,
      pairs: 3,
      plates: 6,
      motionJp: '重油圧アンラッチ→92°下方外開スイング完全開口',
    },
  ],
  lift: {
    width: 19.20,
    length: 40.60,
    thickness: 1.10,
    travelM: 40.00,
    scissorStages: 4,
    rackTowers: 4,
    capacityTons: 120,
  },
  openDurationSec: 14.5,
  closeDurationSec: 14.0,
};

// =========================================================================
// 4. FLAGSHIP LIVE-IN HIGH-SPEED AIRSHIP "K-11" (TECNICA FORCES)
// =========================================================================
export const AIRSHIP_K11 = {
  id: 'k11',
  code: 'K-11',
  name: '飛行船「K-11」 / TECNICA FORCES FLAGSHIP AIRSHIP',
  teamName: 'tecnica forces',
  loreJp: '機械技術系企業の設立者である主人公が、有志の精鋭社員9名を引き抜いて結成した特別技術部隊「tecnica forces」（総勢10名）が、2年の歳月を費やして完成させた初の住み込み可能・高速長距離飛行船。',
  devDurationYears: 2,
  teamSize: 10, // Founder + 9 elite volunteer engineers
  engineName: 'TF-E11 独自高効率ロータリー・ターボハイブリッド推進機関',
  // Exact 4 Technological Breakthroughs
  breakthroughs: [
    {
      num: '01',
      titleJp: '超効率飛行時間・独自設計機関「TF-E11」',
      specJp: '1Lあたり 3.0 km 飛行（給油上限 100.0 L ＝ 最大航続 300.0 km）｜車庫または自宅で給油',
    },
    {
      num: '02',
      titleJp: '広大な完全住み込み可能キャビン空間',
      specJp: '有効室内寸 幅 4.50 m × 長 15.00 m × 高 3.20 m（床面積 67.50 m²・気積 216.0 m³・全6区画）',
    },
    {
      num: '03',
      titleJp: 'マップ自由地点マーク完全自動飛行＆無風250km/h',
      specJp: '無風時最高速度 250 km/h（69.44 m/s・実風抵抗物理演算）｜2D/3Dマップ任意地点へ自動航行',
    },
    {
      num: '04',
      titleJp: '自律キャンピングカー呼出システム（到達厳密検証＋自律スタック修正）',
      specJp: 'K-11現在地（高度除外 X,Z）へ指定RV/装甲RVを無人自動呼出｜河川・到達不能地を数学的に排除しスタック時は自律修正して必着',
    },
  ],
  // Walkable Live-In Cabin (Gondola) — EXACT 4.50m × 15.00m × 3.20m interior!
  cabin: {
    interiorWidth: 4.50,    // EXACT 4.5m!
    interiorLength: 15.00,  // EXACT 15.0m!
    interiorHeight: 3.20,   // EXACT 3.2m!
    wallThick: 0.15,
    outerWidth: 4.80,       // 4.50 + 0.15*2
    outerLength: 15.60,     // 15.00 + 0.30*2
    floorLocalY: 0.65,      // Above landing skid ground plane (localY = 0.0)
    ceilingLocalY: 3.85,    // 0.65 + 3.20 = 3.85m EXACT!
    minX: 0.15,
    maxX: 4.65,
    minZ: 0.30,
    maxZ: 15.30,
  },
  // Overall Aerodynamic Rigid Envelope & Nacelle Envelope Dimensions
  hull: {
    overallLength: 34.00,   // Low-drag Sears-Haack rigid composite fuselage
    envelopeWidth: 9.20,    // Main rigid composite lifting body beam
    totalSpan: 11.60,       // Including twin outboard vectoring ducted-fan nacelles
    overallHeight: 11.80,   // From landing skid bottom (0.0) to envelope crown (+11.80m)
    envelopeCenterY: 7.95,  // Bottom at 4.10m (> 4.03m cabin roof deck -> zero cabin ceiling intrusion!)
    envelopeRadiusY: 3.85,
    envelopeRadiusX: 4.60,
  },
  // Flight Performance & Fuel Constants
  maxSpeedKmh: 250.0,            // EXACT 250 km/h zero wind!
  maxSpeedMs: 250.0 / 3.6,       // 69.4444 m/s
  kmPerLiter: 3.0,               // EXACT 1L = 3km!
  maxFuelL: 100.0,               // EXACT 100L max tank!
  maxRangeKm: 300.0,             // 100L × 3km/L = 300km!
  maxAltitudeAGL: 420.0,
  cruiseAltitudeAGL: 78.0,
  pilotSeatLocal: { x: 2.40, z: 1.55 },
  initialPose: {
    cx: NULL_EREA.originX,
    cz: NULL_EREA.originZ,
    yaw: 0.0, // Facing North (-Z) toward 60km countryside & NARROW-50 Home Base
  },
  gridAxes: {
    x: [
      { id: 'KX1', pos: 0.15, label: '0' },
      { id: 'KX2', pos: 2.40, label: '2,250' },
      { id: 'KX3', pos: 4.65, label: '4,500' },
    ],
    z: [
      { id: 'KZ1', pos: 0.30, label: '0' },
      { id: 'KZ2', pos: 3.50, label: '3,200' },
      { id: 'KZ3', pos: 6.90, label: '6,600' },
      { id: 'KZ4', pos: 9.70, label: '9,400' },
      { id: 'KZ5', pos: 12.30, label: '12,000' },
      { id: 'KZ6', pos: 15.30, label: '15,000' },
    ],
  },
};

// =========================================================================
// 5. BLUEPRINT SHEET 23 — NULL EREA 地下40m 飛行船格納庫＆44枚可動屋根＆高速ELV
// =========================================================================
export const NULL_HANGAR_PLAN = {
  index: 23,
  physicalFloor: -40,
  building: 'null_hangar',
  code: 'NULL車庫',
  titleJp: 'NULL EREA 地下40m 飛行船格納庫「SILO-40」・44枚多層開閉屋根・40m高速ELV 総合設計図',
  subtitle: '地下-40,000mm 格納庫平面(47×54m) ＋ 地上発進パッド＆4層44枚メカ屋根展開図 ＋ 全高40m昇降立坑縦断面図 A-A\'',
  baseY: -40.0,
  ceilingH: 14.5,
  slabTopY: 0.0,
  floorLabel: 'B40FL-40,000',
  width: 47.0,
  depth: 54.0,
  isNullHangar: true,
  rooms: [
    {
      id: 'nh_lift', code: 'S01', building: 'null_hangar', floor: -40,
      nameJp: '中央 巨大高昇機発進プラットフォーム (K-11格納)',
      nameEn: 'Central 40m Hydraulic Mega-Lift Deck',
      x: 13.5, z: 6.0, w: 20.0, d: 42.0, area: 840.0, jo: 518.5, fl: 'B40FL±0 → GL±0', ch: 'CH40,000(昇降立坑)',
      floorTex: 'silo_hazard_deck', floorName: '耐荷重120t チタン縞鋼板高昇機デッキ',
      wallName: '4隅ラック＆ピニオン昇降塔・8基シザー油圧トラス・4層44枚メカ屋根直下', tint: '#d4dde6', labelPos: [23.5, 27.0],
      notes: '地下40mから地上0mまで飛行船K-11を積載して垂直上昇する巨大高昇機。上部4層44枚の厳重メカ装甲屋根と完全連動',
    },
    {
      id: 'nh_concourse', code: 'S02', building: 'null_hangar', floor: -40,
      nameJp: '西コンコース＆高速ELV到着エアロック',
      nameEn: 'West Concourse & Express-40 Airlock',
      x: 0.5, z: 20.0, w: 12.8, d: 14.0, area: 179.2, jo: 110.6, fl: 'B40FL±0', ch: 'CH5,200',
      floorTex: 'warehouse_epoxy_floor', floorName: '防塵耐油エポキシコンクリート＋誘導LEDライン',
      wallName: 'ELV-NULL 40m高速昇降口・可動搭乗ブリッジ・気密ガラス隔壁', tint: '#dce4ec', labelPos: [6.8, 27.0],
      notes: '地上NULL EREAから最高45km/hで地下40mへ直結降下する高速エレベーター到着ロビー。可動ブリッジでK-11へ直結',
    },
    {
      id: 'nh_command', code: 'S03', building: 'null_hangar', floor: -40,
      nameJp: 'tecnica forces 技術司令室＆発進管制卓',
      nameEn: 'tecnica forces Launch Command & R&D',
      x: 0.5, z: 5.0, w: 12.8, d: 15.0, area: 192.0, jo: 118.5, fl: 'B40FL±0', ch: 'CH5,200',
      floorTex: 'warehouse_epoxy_floor', floorName: '帯電防止技術床パネル',
      wallName: '44枚屋根連動管制盤・4大ブレイクスルー解析壁・創設者＋精鋭9名記念銘板', tint: '#d5e2ee', labelPos: [6.8, 12.5],
      notes: '主人公と有志9名の精鋭技術部隊「tecnica forces」が2年間K-11を極秘開発した中枢司令区画。昇降発進スイッチ完備',
    },
    {
      id: 'nh_fuel', code: 'S04', building: 'null_hangar', floor: -40,
      nameJp: '東 100L高効率燃料給油ベイ＆重機整備ギャラリー',
      nameEn: 'East TF-E11 100L Fueling & Maintenance Bay',
      x: 33.7, z: 6.0, w: 12.8, d: 42.0, area: 537.6, jo: 331.9, fl: 'B40FL±0', ch: 'CH14,500',
      floorTex: 'warehouse_epoxy_floor', floorName: '防爆耐油コンクリート＋側溝グレーチング',
      wallName: 'TF-E11専用燃料タンク群(100L満タン給油装置)・天井走行クレーン・予備プロペラ架台', tint: '#d8e3dc', labelPos: [40.1, 27.0],
      notes: '1L=3km走行する独自エンジン専用の高圧給油ステーション（最大100L）。K-11格納時はワンタッチ/自動で満タン補給',
    },
  ],
  walls: [],
  lighting: [],
  switches: [],
  outlets: [],
  plumbing: [],
  flowPaths: [],
};

// =========================================================================
// 6. BLUEPRINT SHEET 24 — 飛行船「K-11」(TECNICA FORCES) 総合設計図面
// =========================================================================
export const AIRSHIP_K11_PLAN = {
  index: 24,
  physicalFloor: 1,
  building: 'k11',
  code: 'K-11',
  titleJp: '飛行船「K-11」(TECNICA FORCES) 総合設計三面図・住み込み空間(4.5×15×3.2m)詳細平面図',
  subtitle: '室内 W4,500×L15,000×H3,200mm (67.5m²) ｜ 全長34.0m×全幅11.6m×全高11.8m ｜ 無風250km/h・1L/3km(100L)・自動航行・RV呼出',
  baseY: AIRSHIP_K11.cabin.floorLocalY,
  ceilingH: AIRSHIP_K11.cabin.interiorHeight,
  slabTopY: AIRSHIP_K11.cabin.ceilingLocalY,
  floorLabel: 'KFL+650',
  width: AIRSHIP_K11.cabin.outerWidth,
  depth: AIRSHIP_K11.cabin.outerLength,
  isAirshipK11: true,
  rooms: [
    {
      id: 'k11_bridge', code: 'K01', building: 'k11', floor: 1,
      nameJp: '① パノラマ操縦ブリッジ＆自動航行司令室',
      nameEn: 'Panoramic Flight Bridge & Autopilot Deck',
      x: 0.15, z: 0.30, w: 4.50, d: 3.20, area: 14.40, jo: 8.89, fl: 'KFL±0', ch: 'CH3,200',
      floorTex: 'airship_cabin_teak', floorName: '航空チーク無垢デッキ＋チタン見切',
      wallName: '270°パノラマ強化防風キャノピー・操縦席[E]・MFD計器盤・RV自動呼出端末・tecnica forces銘板', tint: '#dce9f2', labelPos: [2.40, 1.90],
      notes: '無風250km/h操縦・マップ自由地点自動航行・キャンピングカー現在地呼出を一元制御する最前部パノラマブリッジ',
    },
    {
      id: 'k11_lounge', code: 'K02', building: 'k11', floor: 1,
      nameJp: '② 展望リビングラウンジ＆作戦マップサロン',
      nameEn: 'Panorama Observation Lounge & Salon',
      x: 0.15, z: 3.50, w: 4.50, d: 3.40, area: 15.30, jo: 9.44, fl: 'KFL±0', ch: 'CH3,200',
      floorTex: 'airship_cabin_teak', floorName: '航空チーク無垢＋防振ウールラグ',
      wallName: '両舷フルハイト展望窓・L字本革航空ソファ・ホログラム地形テーブル・書棚', tint: '#ebe3d5', labelPos: [2.40, 5.20],
      notes: '幅4.5m×天井高3.2mの圧倒的開放感。自動飛行中も船内を自由に歩き回り、上空から60×60kmの大自然を一望できる',
    },
    {
      id: 'k11_galley', code: 'K03', building: 'k11', floor: 1,
      nameJp: '③ 住み込み航空ギャレー＆ダイニングバー',
      nameEn: 'Live-In Aerospace Galley & Dining',
      x: 0.15, z: 6.90, w: 4.50, d: 2.80, area: 12.60, jo: 7.78, fl: 'KFL±0', ch: 'CH3,200',
      floorTex: 'airship_cabin_teak', floorName: '耐水チーク＆ヘアラインステンレス',
      wallName: 'IHコンロ・エスプレッソマシン・航空冷蔵庫・食料パントリー・4人掛けダイニング', tint: '#efe5d1', labelPos: [2.40, 8.30],
      notes: '長期住み込み飛行を支える本格キッチン＆ダイニング区画。最大300kmの連続航行中も温かい食事と珈琲を楽しめる',
    },
    {
      id: 'k11_master', code: 'K04', building: 'k11', floor: 1,
      nameJp: '④ 住み込み主寝室＆設計ワークデスク',
      nameEn: 'Master Live-In Quarters & Drafting Desk',
      x: 0.15, z: 9.70, w: 2.75, d: 2.60, area: 7.15, jo: 4.41, fl: 'KFL±0', ch: 'CH3,200',
      floorTex: 'airship_cabin_teak', floorName: '航空チーク無垢＋防音カーペット',
      wallName: 'クイーン航空ベッド・製図/制御デスク・衣類ロッカー・調光読書灯', tint: '#e6dccb', labelPos: [1.52, 11.00],
      notes: '主人公が長期住み込み生活を送るためのプライベート寝室。静粛な防音構造と製図ワークスペースを完備',
    },
    {
      id: 'k11_bath', code: 'K05', building: 'k11', floor: 1,
      nameJp: '⑤ 加圧シャワー＆航空洗面・トイレポッド',
      nameEn: 'Pressurized Shower & Lavatory Pod',
      x: 3.00, z: 9.70, w: 1.65, d: 2.60, area: 4.29, jo: 2.65, fl: 'KFL-20', ch: 'CH2,850',
      floorTex: 'tile_bath', floorName: '防滑セラミックデッキ＋循環排水パン',
      wallName: 'ガラスシャワーブース・温水洗面化粧台・真空式航空トイレ・防湿スライド扉(DK11-B)', tint: '#d5e4e8', labelPos: [3.82, 11.00],
      notes: '完全住み込み仕様の中核となる水回りユニット。循環浄水システムにより長期遠征でも快適な入浴が可能',
    },
    {
      id: 'k11_engine', code: 'K06', building: 'k11', floor: 1,
      nameJp: '⑥ TF-E11機関展望室・100L燃料タンク＆乗降エアロック',
      nameEn: 'TF-E11 Engine Gallery, 100L Tank & Airlock',
      x: 0.15, z: 12.30, w: 4.50, d: 3.00, area: 13.50, jo: 8.33, fl: 'KFL±0', ch: 'CH3,200',
      floorTex: 'metal_grate', floorName: 'チタン防滑グレーチング＋整備ハッチ',
      wallName: 'TF-E11超高効率機関(1L/3km)ガラス視認窓・100L燃料サイトゲージ・左舷ハッチ(DK11-W)・後部タラップ(DK11-R)', tint: '#d5dde4', labelPos: [2.40, 13.80],
      notes: 'ブレイクスルー①の核「TF-E11独自機関」と100L燃料タンクを間近に望む後部機械室＆着陸時自動展開タラップ',
    },
  ],
  walls: [],
  lighting: [],
  switches: [],
  outlets: [],
  plumbing: [],
  flowPaths: [],
};
