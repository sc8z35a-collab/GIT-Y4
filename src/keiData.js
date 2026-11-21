/**
 * KEI-340 / 主人公の日常使い軽バン（1人乗りカーゴ仕様・3.40m × 1.48m × H1.80m）
 * Ultra-Detailed Japanese Kei-Van Architectural & Mechanical CAD Specification:
 * - Exact Legal Kei Dimensions: W 1,480 mm × L 3,400 mm × H 1,800 mm (Ground Y=-0.26 -> Roof Y=+1.54)
 * - Interior Cargo Floor: KFL = GL+340 mm (World Y = +0.08 m)
 * - Interior High-Roof Headroom: CH 1,380 mm (Roof Soffit Y=+1.46, Roof Shell 80 mm -> Top Y=+1.54)
 * - Single RHD Driver Seat ONLY (助手席レス・完全1人乗り仕様) + Walk-In Daily Cargo Bay
 *   (W 580 mm × L 2,140 mm clear protagonist walk-in alley via Left Sliding Door DK-L & Rear Liftgate DK-R!)
 * - Strict 2D SAT OBB-vs-AABB, OBB-vs-OBB (Camper), and OBB-vs-Circle (Trees/Boulders/Lanterns) Driving Collision.
 */

export const KEI = {
  name: 'KEI-340 / 主人公の日常使い軽自動車（1人乗りカーゴ軽バン）',
  subtitle: '全幅 1,480 × 全長 3,400 × 全高 1,800 mm（運転席1脚のみ＋乗車・進入可能フル荷室｜SAT厳格当たり判定自走）',
  width: 1.48,
  length: 3.40,
  height: 1.80,
  // Initial daily-driver parked pose right outside Main Tower North Entrance (World X=2.81..4.29, Z=-5.30..-1.90)
  initialPose: {
    cx: 3.55,
    cz: -3.60,
    yaw: 0.0, // 0 = Front facing North (-Z) toward forest driveway
  },
  groundY: -0.26,     // Tire contact plane on gravel/concrete carport pad
  floorClearY: 0.34,  // Ground to flat cargo floor top (+340mm -> World Y = +0.08m)
  floorWorldY: 0.08,
  interiorClearH: 1.38, // High-roof kei-van interior ceiling height (1,380 mm)
  roofThick: 0.08,    // Roof top at World Y = +1.54m (Total height = 1.54 - (-0.26) = 1.800 m EXACT!)
  axlesZ: [0.68, 2.66], // Front steering axle + Rear drive axle (Wheelbase WB = 1,980 mm)
  wheelRadius: 0.27,  // 145/80R12 rugged kei-van tire (Ø540 mm)
  wheelWidth: 0.16,
  trackWidth: 1.30,
  driverSeatLocal: { x: 1.08, z: 0.84 }, // Authentic Japanese RHD single seat!
  steerWheelLocal: { x: 1.08, z: 0.46 },
  gridAxes: {
    x: [
      { id: 'KX1', pos: 0.030, label: '0' },
      { id: 'KX2', pos: 0.440, label: '410' },
      { id: 'KX3', pos: 1.040, label: '1,010' },
      { id: 'KX4', pos: 1.450, label: '1,420' },
    ],
    z: [
      { id: 'KY1', pos: 0.030, label: '0' },
      { id: 'KY2', pos: 0.420, label: '390' },
      { id: 'KY3', pos: 1.180, label: '1,150' },
      { id: 'KY4', pos: 2.120, label: '2,090' },
      { id: 'KY5', pos: 3.370, label: '3,340' },
    ],
  },
  specs: [
    ['車体寸法 (L×W×H)', '3,400 × 1,480 × 1,800 mm'],
    ['軸距 / 輪距 (WB/T)', '1,980 mm / 1,300 mm'],
    ['室内荷室長×幅×高', '2,140(長尺2,900) × 1,360 × 1,380 mm'],
    ['乗車定員 / 座席構成', '1名（RHD運転席のみ・助手席撤去）'],
    ['荷室床面地上高', 'KFL +340 mm（フラット低床）'],
    ['車両重量 / 最大積載', '890 kg / 350 kg（荷室容積 3.52 m³）'],
    ['原動機 / 最小回転半径', '658cc 直3 DOHC / 4.1 m'],
    ['タイヤ / 衝突判定', '145/80R12 / 2D SAT OBB 3分割掃引'],
  ],
};

export const KEI_PLAN = {
  index: 17,
  physicalFloor: 1,
  building: 'kei',
  code: '軽バン',
  titleJp: '主人公の日常使い軽自動車 精密車両設計図（運転席1脚＋進入可能フル荷室）',
  subtitle: '3,400×1,480×H1,800mm・完全1人乗り(助手席レス)・左スライド扉＆リアハッチ進入可・SAT厳格衝突自走',
  baseY: KEI.floorWorldY,
  ceilingH: KEI.interiorClearH,
  slabTopY: KEI.floorWorldY + KEI.interiorClearH + KEI.roofThick,
  floorLabel: 'KFL+340',
  width: KEI.width,
  depth: KEI.length,
  isKei: true,
  rooms: [
    {
      id: 'k_driver', code: 'K01', building: 'kei', floor: 1, nameJp: '運転席（唯一の1席・RHD）', nameEn: 'Single Driver Seat',
      x: 0.74, z: 0.06, w: 0.68, d: 1.12, area: 0.76, jo: 0.47, fl: 'KFL±0', ch: 'CH1380',
      floorTex: 'rubber_black_stud', floorName: '防滑ラバーフロアマット',
      wallName: '右ハンドル[E]運転可・アナログ計器・シフト・ペダル・Aピラー', tint: '#d7e0ea', labelPos: [1.08, 0.72],
      notes: '車内唯一の座席。ハンドルに[E]で乗車し660cc軽自動車として厳格なSAT当たり判定付きで森を走行可能',
    },
    {
      id: 'k_front_cargo', code: 'K02', building: 'kei', floor: 1, nameJp: '助手席レス長尺荷室', nameEn: 'Passenger-Delete Cargo Deck',
      x: 0.06, z: 0.40, w: 0.68, d: 0.78, area: 0.53, jo: 0.33, fl: 'KFL±0', ch: 'CH1380',
      floorTex: 'plywood_attic', floorName: 'コンパネ合板フラット荷床',
      wallName: '助手席完全撤去・日常工具トート・長尺物積載＆車内ウォークスルー', tint: '#f2e6d3', labelPos: [0.40, 0.79],
      notes: '助手席を撤去して荷室床をフロント足元まで拡張。左スライド扉から運転席横へ通り抜け・長尺積載可能',
    },
    {
      id: 'k_cargo_bay', code: 'K03', building: 'kei', floor: 1, nameJp: 'メイン進入可能荷室（日常積載）', nameEn: 'Walk-In Daily Cargo Bay',
      x: 0.06, z: 1.18, w: 1.36, d: 2.14, area: 2.91, jo: 1.80, fl: 'KFL±0', ch: 'CH1380',
      floorTex: 'rubber_black_stud', floorName: '荷室防滑リブマット＋合板下地',
      wallName: '中央進入通路W580mm・右2段DIY棚＆オリコン・左クーラー＆装備箱', tint: '#ebe3d5', labelPos: [0.74, 2.25],
      notes: '左スライド扉(DK-L)とリア跳上ハッチ(DK-R)の2方向から主人公が実際にしゃがみ姿勢で奥まで進入できるフルフラット荷室',
    },
  ],
  walls: [
    // Front nose bulkhead (kz = 0.00..0.06) with wide windshield above dash (sill 0.72, h 0.58)
    {
      id: 'WK_N', axis: 'h', x1: 0.00, z1: 0.00, x2: 1.48, z2: 0.06, kind: 'ext',
      extTex: 'panel_white_vert', intTex: 'panel_white_vert',
      openings: [
        { id: 'WK-WS', type: 'window', pos: 0.10, width: 1.28, height: 0.56, sill: 0.72, label: 'WK-WS フロントガラス' },
      ],
    },
    // Rear tailgate wall (kz = 3.34..3.40) with full-width upward-swinging liftgate DK-R (W 1,180mm!)
    {
      id: 'WK_S', axis: 'h', x1: 0.00, z1: 3.34, x2: 1.48, z2: 3.40, kind: 'ext',
      extTex: 'panel_white_vert', intTex: 'plywood_attic',
      openings: [
        { id: 'DK-R', type: 'door_liftgate', pos: 0.15, width: 1.18, height: 1.30, sill: 0.02, tex: 'panel_white_vert', label: 'DK-R リア跳上ハッチ扉' },
      ],
    },
    // Left side wall (kx = 0.00..0.06): front fixed window + wide Left Sliding Cargo Door DK-L + rear cargo window
    {
      id: 'WK_W', axis: 'v', x1: 0.00, z1: 0.06, x2: 0.06, z2: 3.34, kind: 'ext',
      extTex: 'panel_white_vert', intTex: 'plywood_attic',
      openings: [
        { id: 'WK-L1', type: 'window', pos: 0.24, width: 0.74, height: 0.54, sill: 0.72, label: 'WK-L1 左前窓' },
        { id: 'DK-L', type: 'door_slide_ext', pos: 1.24, width: 0.84, height: 1.30, sill: 0.02, tex: 'panel_white_vert', slideDir: 1, label: 'DK-L 左スライド荷室扉' },
        { id: 'WK-L2', type: 'window', pos: 2.34, width: 0.74, height: 0.48, sill: 0.78, label: 'WK-L2 左荷室リア窓' },
      ],
    },
    // Right side wall (kx = 1.42..1.48): RHD Driver Swing Door DK-D + mid/rear cargo windows
    {
      id: 'WK_E', axis: 'v', x1: 1.42, z1: 0.06, x2: 1.48, z2: 3.34, kind: 'ext',
      extTex: 'panel_white_vert', intTex: 'plywood_attic',
      openings: [
        { id: 'DK-D', type: 'door_swing', pos: 0.34, width: 0.80, height: 1.30, sill: 0.02, tex: 'panel_white_vert', hinge: 'left', swingDir: 1, label: 'DK-D 運転席ドア' },
        { id: 'WK-R1', type: 'window', pos: 1.34, width: 0.72, height: 0.48, sill: 0.78, label: 'WK-R1 右荷室中窓' },
        { id: 'WK-R2', type: 'window', pos: 2.34, width: 0.74, height: 0.48, sill: 0.78, label: 'WK-R2 右荷室リア窓' },
      ],
    },
  ],
  lighting: [
    { x: 0.74, z: 1.85, type: 'led_bar', label: '荷室LEDバー (3000K)' },
    { x: 1.08, z: 0.65, type: 'dl', label: 'マップランプ' },
  ],
  outlets: [
    { x: 0.88, z: 0.38, label: 'DC12Vシガー' },
    { x: 1.38, z: 2.20, label: 'AC100Vインバータ' },
  ],
  plumbing: [],
  flowPaths: [
    { id: 'entry_left', color: '#c25e28', label: '左スライド扉進入', pts: [[-0.42, 1.66], [0.74, 1.66], [0.74, 2.55]] },
    { id: 'entry_rear', color: '#1d7a8c', label: 'リアハッチ進入', pts: [[0.74, 3.82], [0.74, 2.55], [0.74, 1.45]] },
    { id: 'driver_access', color: '#6b4fa1', label: '運転席アクセス', pts: [[1.92, 0.78], [1.08, 0.78]] },
  ],
};
