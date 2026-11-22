/**
 * Suginosato Mountain Village (杉ノ郷集落 — 5-House Traditional Japanese Mountain Hamlet)
 * Single source of truth shared by TERRENO 1.1 geomorphology, forest exclusion, 3D/2D maps,
 * 3D architectural builder (buildVillage3d.js), and first-person / vehicle physics (scene3d.js).
 */

const CENTER_X = 820.0;
const CENTER_Z = 1280.0;
const GROUND_Y = -6.0; // +514.35m ASL sunlit river-bend mountain terrace overlooking Kurosugigawa gorge

export const VILLAGE = {
  id: 'village',
  nameJp: '杉ノ郷集落',
  subtitleJp: '標高 +514m 河岸段丘の5棟集落',
  centerX: CENTER_X,
  centerZ: CENTER_Z,
  groundY: GROUND_Y,
  flatRadius: 56.0,
  blendRadius: 195.0,
  // Main stone village lane & central plaza (relative to centerX, centerZ)
  lane: { minX: CENTER_X - 34.0, maxX: CENTER_X + 28.5, minZ: CENTER_Z - 3.6, maxZ: CENTER_Z + 3.6 },
  plaza: { minX: CENTER_X - 6.0, maxX: CENTER_X + 12.0, minZ: CENTER_Z - 7.5, maxZ: CENTER_Z + 7.5 },
  parking: { minX: CENTER_X - 30.0, maxX: CENTER_X - 19.5, minZ: CENTER_Z + 4.0, maxZ: CENTER_Z + 10.2 },
  well: { x: CENTER_X + 2.0, z: CENTER_Z + 0.0, r: 1.55 },
  shrine: { x: CENTER_X + 30.5, z: CENTER_Z + 0.5 },
  garden: { minX: CENTER_X + 14.5, maxX: CENTER_X + 23.5, minZ: CENTER_Z + 10.0, maxZ: CENTER_Z + 16.5 },
  signpost: { x: CENTER_X - 24.5, z: CENTER_Z - 4.8 },
};

/**
 * 5 Distinct Enterable Houses forming Suginosato Mountain Village (杉ノ郷集落).
 * Each house has exact world origin (ox, oz), dimensions (w, d), roof geometry,
 * exterior/interior palettes, floor heights, interactive door metadata, and room zones.
 */
export const VILLAGE_HOUSES = [
  {
    id: 'v1_kominka',
    code: 'V1',
    nameJp: '1号棟 庄屋・古民家',
    style: 'kominka',
    ox: CENTER_X - 17.5,
    oz: CENTER_Z - 19.0,
    w: 9.0,
    d: 6.5,
    facing: 'south',
    eaveH: 3.05,
    ridgeH: 5.55,
    domaY: GROUND_Y + 0.14,
    floorY: GROUND_Y + 0.34,
    porch: { minX: CENTER_X - 17.1, maxX: CENTER_X - 11.9, minZ: CENTER_Z - 12.5, maxZ: CENTER_Z - 11.35, y: GROUND_Y + 0.24 },
    extLowerTex: 'yakisugi_deep',
    extUpperTex: 'shikkui_white',
    roofTex: 'slate_charcoal',
    door: { id: 'DV1-1', label: '庄屋・古民家 玄関引戸', side: 'south', pos: 6.35, width: 1.30, height: 2.05, type: 'door_pocket', tex: 'wood_lattice_dark', slideDir: -1 },
    innerDoor: { id: 'DV1-2', label: '古民家 座敷障子戸', axis: 'v', coord: 2.85, pos: 2.40, width: 1.15, height: 1.95, type: 'door_pocket', tex: 'shoji_grid', slideDir: 1 },
    rooms: [
      { id: 'v1_doma', code: 'V1土間', nameJp: '1号棟 庄屋古民家・土間玄関', lx1: 5.4, lx2: 9.0, lz1: 0.0, lz2: 6.5, floor: 'doma', surface: 'tile' },
      { id: 'v1_irori', code: 'V1囲炉裏', nameJp: '1号棟 庄屋古民家・囲炉裏の間', lx1: 2.85, lx2: 5.4, lz1: 0.0, lz2: 6.5, floor: 'main', surface: 'wood' },
      { id: 'v1_tatami', code: 'V1座敷', nameJp: '1号棟 庄屋古民家・奥座敷', lx1: 0.0, lx2: 2.85, lz1: 0.0, lz2: 6.5, floor: 'main', surface: 'tatami' },
    ],
  },
  {
    id: 'v2_teahouse',
    code: 'V2',
    nameJp: '2号棟 茶房・渓流庵',
    style: 'teahouse',
    ox: CENTER_X + 2.5,
    oz: CENTER_Z - 18.5,
    w: 7.6,
    d: 5.8,
    facing: 'south',
    eaveH: 2.95,
    ridgeH: 4.95,
    domaY: GROUND_Y + 0.16,
    floorY: GROUND_Y + 0.34,
    porch: { minX: CENTER_X + 2.7, maxX: CENTER_X + 9.9, minZ: CENTER_Z - 12.7, maxZ: CENTER_Z - 11.7, y: GROUND_Y + 0.12 },
    extLowerTex: 'wood_slats',
    extUpperTex: 'plaster_ochre',
    roofTex: 'slate_charcoal',
    door: { id: 'DV2-1', label: '茶房・渓流庵 入口引戸', side: 'south', pos: 3.15, width: 1.35, height: 2.05, type: 'door_pocket', tex: 'door_glass_white', slideDir: 1 },
    rooms: [
      { id: 'v2_tatami', code: 'V2小上り', nameJp: '2号棟 茶房渓流庵・畳小上がり', lx1: 0.0, lx2: 2.55, lz1: 0.0, lz2: 5.8, floor: 'main', surface: 'tatami' },
      { id: 'v2_hall', code: 'V2茶房', nameJp: '2号棟 茶房渓流庵・囲炉裏茶席', lx1: 2.55, lx2: 7.6, lz1: 0.0, lz2: 5.8, floor: 'doma', surface: 'wood' },
    ],
  },
  {
    id: 'v3_woodshop',
    code: 'V3',
    nameJp: '3号棟 木工・林業小屋',
    style: 'woodshop',
    ox: CENTER_X - 18.0,
    oz: CENTER_Z + 10.5,
    w: 7.4,
    d: 5.6,
    facing: 'north',
    eaveH: 2.90,
    ridgeH: 4.85,
    domaY: GROUND_Y + 0.14,
    floorY: GROUND_Y + 0.34,
    porch: { minX: CENTER_X - 17.8, maxX: CENTER_X - 13.6, minZ: CENTER_Z + 9.5, maxZ: CENTER_Z + 10.5, y: GROUND_Y + 0.10 },
    extLowerTex: 'wood_weathered_grey',
    extUpperTex: 'wood_scratched_cedar',
    roofTex: 'slate_charcoal',
    door: { id: 'DV3-1', label: '木工小屋 工房引戸', side: 'north', pos: 1.45, width: 1.30, height: 2.05, type: 'door_pocket', tex: 'door_walnut', slideDir: 1 },
    innerDoor: { id: 'DV3-2', label: '林業小屋 居室扉', axis: 'v', coord: 4.05, pos: 2.15, width: 0.95, height: 1.98, type: 'door_swing', tex: 'door_oak', hinge: 'left', swingDir: 1 },
    rooms: [
      { id: 'v3_shop', code: 'V3工房', nameJp: '3号棟 木工林業小屋・木工作業場', lx1: 0.0, lx2: 4.05, lz1: 0.0, lz2: 5.6, floor: 'doma', surface: 'tile' },
      { id: 'v3_living', code: 'V3居室', nameJp: '3号棟 木工林業小屋・杉板居間', lx1: 4.05, lx2: 7.4, lz1: 0.0, lz2: 5.6, floor: 'main', surface: 'wood' },
    ],
  },
  {
    id: 'v4_moss_house',
    code: 'V4',
    nameJp: '4号棟 山荘・苔庭の家',
    style: 'mountain_home',
    ox: CENTER_X + 4.5,
    oz: CENTER_Z + 11.0,
    w: 7.8,
    d: 6.0,
    facing: 'north',
    eaveH: 2.95,
    ridgeH: 5.00,
    domaY: GROUND_Y + 0.14,
    floorY: GROUND_Y + 0.34,
    porch: { minX: CENTER_X + 5.5, maxX: CENTER_X + 8.0, minZ: CENTER_Z + 9.9, maxZ: CENTER_Z + 11.0, y: GROUND_Y + 0.12 },
    extLowerTex: 'stone_cistern_grey',
    extUpperTex: 'plaster_sage',
    roofTex: 'slate_charcoal',
    door: { id: 'DV4-1', label: '苔庭の山荘 玄関扉', side: 'north', pos: 1.55, width: 1.12, height: 2.05, type: 'door_swing', tex: 'door_oak', hinge: 'left', swingDir: 1 },
    innerDoor: { id: 'DV4-2', label: '山荘 寝室引戸', axis: 'v', coord: 4.65, pos: 2.35, width: 1.05, height: 1.98, type: 'door_pocket', tex: 'shoji_grid', slideDir: 1 },
    rooms: [
      { id: 'v4_genkan', code: 'V4玄関', nameJp: '4号棟 山荘苔庭の家・玄関土間', lx1: 0.0, lx2: 2.9, lz1: 0.0, lz2: 1.95, floor: 'doma', surface: 'tile' },
      { id: 'v4_living', code: 'V4居間', nameJp: '4号棟 山荘苔庭の家・居間ダイニング', lx1: 0.0, lx2: 4.65, lz1: 1.95, lz2: 6.0, floor: 'main', surface: 'wood' },
      { id: 'v4_living_hall', code: 'V4廊下', nameJp: '4号棟 山荘苔庭の家・北側廊下', lx1: 2.9, lx2: 4.65, lz1: 0.0, lz2: 1.95, floor: 'main', surface: 'wood' },
      { id: 'v4_bedroom', code: 'V4寝室', nameJp: '4号棟 山荘苔庭の家・畳寝室', lx1: 4.65, lx2: 7.8, lz1: 0.0, lz2: 6.0, floor: 'main', surface: 'tatami' },
    ],
  },
  {
    id: 'v5_kura',
    code: 'V5',
    nameJp: '5号棟 蔵造り・石倉の民家',
    style: 'kura',
    ox: CENTER_X + 18.0,
    oz: CENTER_Z - 14.0,
    w: 6.8,
    d: 5.6,
    facing: 'south',
    eaveH: 3.20,
    ridgeH: 5.45,
    domaY: GROUND_Y + 0.14,
    floorY: GROUND_Y + 0.34,
    porch: { minX: CENTER_X + 20.3, maxX: CENTER_X + 22.7, minZ: CENTER_Z - 8.4, maxZ: CENTER_Z - 7.35, y: GROUND_Y + 0.12 },
    extLowerTex: 'stone_grey_block',
    extUpperTex: 'shikkui_white',
    roofTex: 'slate_charcoal',
    door: { id: 'DV5-1', label: '蔵造り民家 重厚引戸', side: 'south', pos: 2.80, width: 1.22, height: 2.05, type: 'door_pocket', tex: 'door_navy', slideDir: 1 },
    rooms: [
      { id: 'v5_store', code: 'V5石倉', nameJp: '5号棟 蔵造り民家・石倉土間', lx1: 0.0, lx2: 6.8, lz1: 3.15, lz2: 5.6, floor: 'doma', surface: 'tile' },
      { id: 'v5_study', code: 'V5書斎', nameJp: '5号棟 蔵造り民家・胡桃の書斎居間', lx1: 0.0, lx2: 6.8, lz1: 0.0, lz2: 3.15, floor: 'main', surface: 'wood' },
    ],
  },
];

// Ground-level static AABBs for vehicle collision around Suginosato Village
export const VILLAGE_VEHICLE_OBSTACLES = [
  ...VILLAGE_HOUSES.map((h) => ({
    minX: h.ox - 0.12,
    maxX: h.ox + h.w + 0.12,
    minZ: h.oz - 0.12,
    maxZ: h.oz + h.d + 0.12,
  })),
  // Covered spring well in central plaza
  {
    minX: VILLAGE.well.x - 1.65,
    maxX: VILLAGE.well.x + 1.65,
    minZ: VILLAGE.well.z - 1.65,
    maxZ: VILLAGE.well.z + 1.65,
  },
  // Vegetable garden low fence
  {
    minX: VILLAGE.garden.minX - 0.2,
    maxX: VILLAGE.garden.maxX + 0.2,
    minZ: VILLAGE.garden.minZ - 0.2,
    maxZ: VILLAGE.garden.maxZ + 0.2,
  },
  // Eastern Torii & Mountain Shrine
  {
    minX: VILLAGE.shrine.x - 1.8,
    maxX: VILLAGE.shrine.x + 3.8,
    minZ: VILLAGE.shrine.z - 2.6,
    maxZ: VILLAGE.shrine.z + 2.6,
  },
  // Entry signpost & wooden noticeboard
  {
    minX: VILLAGE.signpost.x - 1.6,
    maxX: VILLAGE.signpost.x + 1.6,
    minZ: VILLAGE.signpost.z - 0.8,
    maxZ: VILLAGE.signpost.z + 0.8,
  },
];

/**
 * Returns true if (wx, wz) lies inside the village residential clearing where tall forest trees,
 * large boulders, and nurse logs must not spawn.
 */
export function isInsideVillageClearing(wx, wz, extraMargin = 0.0) {
  const dx = wx - VILLAGE.centerX;
  const dz = wz - VILLAGE.centerZ;
  // Elliptical village terrace clearing (matches flat terrace + cozy cedar tree perimeter!)
  const rx = 44.0 + extraMargin;
  const rz = 32.0 + extraMargin;
  if ((dx * dx) / (rx * rx) + (dz * dz) / (rz * rz) <= 1.0) return true;
  // Keep West approach connector to Forestry Road cleanly open
  if (dx >= -44.0 - extraMargin && dx <= -24.0 && dz >= -10.0 - extraMargin && dz <= 14.0 + extraMargin) {
    return true;
  }
  return false;
}

/**
 * Returns true if (wx, wz) lies on a house interior/porch, stone lane, plaza, parking pad, or shrine floor
 * where tall grass & ferns should not poke through.
 */
export function isInsideVillagePaving(wx, wz) {
  const dx = wx - VILLAGE.centerX;
  const dz = wz - VILLAGE.centerZ;
  if (Math.abs(dx) > 48 || Math.abs(dz) > 36) return false;

  // Main stone lane, central plaza, parking pad, & garden
  if (wx >= VILLAGE.lane.minX && wx <= VILLAGE.lane.maxX && wz >= VILLAGE.lane.minZ && wz <= VILLAGE.lane.maxZ) return true;
  if (wx >= VILLAGE.plaza.minX && wx <= VILLAGE.plaza.maxX && wz >= VILLAGE.plaza.minZ && wz <= VILLAGE.plaza.maxZ) return true;
  if (wx >= VILLAGE.parking.minX && wx <= VILLAGE.parking.maxX && wz >= VILLAGE.parking.minZ && wz <= VILLAGE.parking.maxZ) return true;
  if (wx >= VILLAGE.garden.minX - 0.4 && wx <= VILLAGE.garden.maxX + 0.4 && wz >= VILLAGE.garden.minZ - 0.4 && wz <= VILLAGE.garden.maxZ + 0.4) return true;
  if (wx >= VILLAGE.shrine.x - 2.6 && wx <= VILLAGE.shrine.x + 4.4 && wz >= VILLAGE.shrine.z - 2.8 && wz <= VILLAGE.shrine.z + 2.8) return true;

  for (let i = 0; i < VILLAGE_HOUSES.length; i++) {
    const h = VILLAGE_HOUSES[i];
    if (wx >= h.ox - 0.8 && wx <= h.ox + h.w + 0.8 && wz >= h.oz - 0.8 && wz <= h.oz + h.d + 0.8) {
      return true;
    }
    if (h.porch && wx >= h.porch.minX - 0.4 && wx <= h.porch.maxX + 0.4 && wz >= h.porch.minZ - 0.4 && wz <= h.porch.maxZ + 0.4) {
      return true;
    }
    // Front stepping-stone path connecting each house porch to the main village lane
    const pathMinX = h.ox + (h.door ? h.door.pos - 0.7 : h.w * 0.35);
    const pathMaxX = h.ox + (h.door ? h.door.pos + h.door.width + 0.7 : h.w * 0.65);
    if (h.facing === 'south') {
      if (wx >= pathMinX && wx <= pathMaxX && wz >= h.oz + h.d && wz <= VILLAGE.lane.minZ + 0.5) return true;
    } else {
      if (wx >= pathMinX && wx <= pathMaxX && wz >= VILLAGE.lane.maxZ - 0.5 && wz <= h.oz) return true;
    }
  }
  return false;
}

/**
 * Fast spatial lookup: returns { house, room, lx, lz, floorY, surface, onPorch } if (wx, wz)
 * is inside one of the 5 village houses or on its entry porch; null otherwise.
 */
export function queryVillageHouseAt(wx, wz) {
  if (Math.abs(wx - VILLAGE.centerX) > 40.0 || Math.abs(wz - VILLAGE.centerZ) > 30.0) return null;

  for (let i = 0; i < VILLAGE_HOUSES.length; i++) {
    const h = VILLAGE_HOUSES[i];
    const lx = wx - h.ox;
    const lz = wz - h.oz;
    if (lx >= 0.0 && lx <= h.w && lz >= 0.0 && lz <= h.d) {
      let matched = h.rooms[0];
      for (let r = 0; r < h.rooms.length; r++) {
        const rm = h.rooms[r];
        if (lx >= rm.lx1 && lx <= rm.lx2 && lz >= rm.lz1 && lz <= rm.lz2) {
          matched = rm;
          break;
        }
      }
      return {
        house: h,
        room: matched,
        lx,
        lz,
        floorY: matched.floor === 'doma' ? h.domaY : h.floorY,
        surface: matched.surface,
        onPorch: false,
      };
    }
    if (h.porch && wx >= h.porch.minX && wx <= h.porch.maxX && wz >= h.porch.minZ && wz <= h.porch.maxZ) {
      return {
        house: h,
        room: { id: `${h.id}_porch`, code: `${h.code}縁側`, nameJp: `${h.nameJp}・縁側ポーチ` },
        lx,
        lz,
        floorY: h.porch.y,
        surface: 'wood',
        onPorch: true,
      };
    }
  }
  return null;
}

/**
 * Returns true if (wx, wz) is anywhere inside the Suginosato Village settlement precinct.
 */
export function isInVillagePrecinct(wx, wz) {
  return Math.hypot(wx - VILLAGE.centerX, wz - VILLAGE.centerZ) <= 52.0;
}
