import * as THREE from 'three';
import { ANNEX, ANNEX_FLOORS, getAnnexAtticCeilingY } from './planData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';

/**
 * Builds the Neighboring 5m × 8m 3-Story + 5-Room Gable Attic House ("ANNEX-40 / 森の離れ")
 * positioned 2.60m West of the Main Tower (World X = -7.60..-2.60, Z = 1.00..9.00):
 * - 1F (0.00): Genkan, Atelier, Wet Room, Gallery, Cafe LDK
 * - 2F (2.75): Library Hall, Gallery, Ryukyu Tatami Guest Room, Master Bedroom
 * - 3F (5.50): 6 All-Pocket-Door Rooms + 3 Walkable 1.00m × 1.60m Forest Balconies (North, West, South)
 * - Attic (8.15..10.95): 6寸 Gable Roof + 5 Distinct Rooms + Iron Safety Stairwell Guardrail
 */
export function buildAnnex3D(ctx) {
  const {
    staticGroup,
    furnitureGroup,
    dynamicGroup,
    exteriorGroup,
    mat,
    addCollider,
    addBox,
    addWallBox,
    addLight,
    addInteractiveDoor,
    addWindowFrame,
    addFramedArt,
    excludeBatch,
    interactiveProps,
  } = ctx;

  const ox = ANNEX.originX; // -7.60
  const oz = ANNEX.originZ; //  1.00
  const wx = (lx) => ox + lx;
  const wz = (lz) => oz + lz;

  // =========================================================================
  // 1. FOUNDATION PLINTH, COURTYARD MOSS PATH & JAPANESE STONE LANTERNS
  // =========================================================================
  const cisternMat = makeSurfaceMat('stone_cistern_grey', 5.2, 0.34);
  const mossPlinthMat = makeSurfaceMat('stone_moss_wall', 8.2, 0.34);
  addBox(staticGroup, 5.04, 0.28, 8.10, cisternMat, wx(2.50), -0.25, wz(4.00), true);
  addBox(staticGroup, 2.75, 0.11, 7.80, cisternMat, wx(1.48), -0.055, wz(4.00), false);
  addBox(staticGroup, 2.15, 0.11, 6.25, cisternMat, wx(3.90), -0.055, wz(4.80), false);
  addBox(staticGroup, 0.06, 0.32, 8.12, mossPlinthMat, wx(-0.06), -0.22, wz(4.00), false);
  addBox(staticGroup, 0.06, 0.32, 8.12, mossPlinthMat, wx(5.06), -0.22, wz(4.00), false);

  // Annex North Entry Porch Slab & Dark Iron Awning Canopy
  addBox(exteriorGroup, 2.10, 0.14, 1.15, makeSurfaceMat('paver_granite_grid', 2.1, 1.15), wx(3.90), -0.22, wz(-0.55), true);
  addBox(exteriorGroup, 2.20, 0.08, 1.05, mat.darkIron, wx(3.90), 2.42, wz(-0.50), true);

  // Connecting Mossy Stepping-Stone Garden Path between Main North Porch & Annex North Porch
  const mossPathMat = makeSurfaceMat('paver_moss_stones', 6.0, 1.5);
  addBox(exteriorGroup, 5.40, 0.10, 1.35, mossPathMat, -1.35, -0.30, -0.45, false);
  addBox(exteriorGroup, 1.35, 0.08, 8.46, mossPathMat, -1.30, -0.31, 4.46, false);

  function addStoneLantern(lx, lz) {
    const stMat = makeSurfaceMat('stone_cistern_grey', 0.4, 0.8);
    addBox(exteriorGroup, 0.28, 0.48, 0.28, stMat, lx, -0.10, lz, true);
    addBox(exteriorGroup, 0.22, 0.24, 0.22, mat.washiGlow, lx, 0.26, lz, false);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 4), stMat);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(lx, 0.46, lz);
    exteriorGroup.add(cap);
    addCollider(1, lx - 0.18, lz - 0.18, lx + 0.18, lz + 0.18);
  }
  addStoneLantern(-2.25, -0.95);
  addStoneLantern(-2.18, 5.40);

  // =========================================================================
  // 2. SLOTTED STRUCTURAL SLABS (2F, 3F, ATTIC) & FLOOR PATCHES
  // =========================================================================
  function addAnnexFloorPatch(lx1, lz1, lx2, lz2, y, texName, extra = {}) {
    const w = lx2 - lx1;
    const d = lz2 - lz1;
    const m = makeSurfaceMat(texName, w, d, extra);
    addBox(staticGroup, w, 0.016, d, m, wx((lx1 + lx2) / 2), y + 0.008, wz((lz1 + lz2) / 2), false);
  }

  function addAnnexSlottedSlab(slabBottomY, slabTopY, ceilTex) {
    const h = slabTopY - slabBottomY;
    const midY = slabBottomY + h / 2;
    const sb = ANNEX.stairLocal;
    const subMat = mat.wallCutCap;
    const ceilMat = makeSurfaceMat(ceilTex, 4.7, 4.5, { roughness: 0.90 });
    const ox1 = 0.010, ox2 = 4.990, oz1 = 0.010, oz2 = 7.990;
    [
      { x1: ox1, x2: ox2, z1: oz1, z2: sb.topZ },
      { x1: ox1, x2: ox2, z1: sb.bottomZ, z2: oz2 },
      { x1: sb.maxX, x2: ox2, z1: sb.topZ, z2: sb.bottomZ },
      { x1: ox1, x2: sb.minX, z1: sb.topZ, z2: sb.bottomZ },
    ].forEach((r) => {
      const w = r.x2 - r.x1;
      const d = r.z2 - r.z1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        [subMat, subMat, subMat, ceilMat, subMat, subMat],
      );
      mesh.position.set(wx((r.x1 + r.x2) / 2), midY, wz((r.z1 + r.z2) / 2));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      staticGroup.add(mesh);
    });
    addBox(staticGroup, 4.90, h * 0.72, 0.036, mat.darkIron, wx(2.5), midY, wz(-0.022), false);
    addBox(staticGroup, 4.90, h * 0.72, 0.036, mat.darkIron, wx(2.5), midY, wz(8.022), false);
    addBox(staticGroup, 0.036, h * 0.72, 7.90, mat.darkIron, wx(-0.022), midY, wz(4.0), false);
    addBox(staticGroup, 0.036, h * 0.72, 7.90, mat.darkIron, wx(5.022), midY, wz(4.0), false);
  }

  addAnnexSlottedSlab(2.50, 2.75, 'ceiling_acoustic'); // 1F ceiling / 2F floor
  addAnnexSlottedSlab(5.25, 5.50, 'wallpaper_white');  // 2F ceiling / 3F floor
  addAnnexSlottedSlab(7.90, 8.15, 'wood_planks_dark'); // 3F ceiling / Attic floor

  // Annex 1F Floors (Y = 0.00)
  addAnnexFloorPatch(2.85, 0.15, 4.85, 1.65, -0.10, 'paver_granite_grid');
  addBox(staticGroup, 0.08, 0.11, 1.50, mat.oak, wx(2.83), -0.045, wz(0.90), false);
  addAnnexFloorPatch(0.15, 0.15, 2.85, 2.15, 0.0, 'terrazzo_white');
  addAnnexFloorPatch(2.85, 1.75, 4.85, 3.95, 0.0, 'tile_checker_stone');
  addAnnexFloorPatch(1.25, 2.15, 2.85, 4.95, 0.0, 'wood_walnut_floor');
  addAnnexFloorPatch(0.15, 4.95, 4.85, 7.85, 0.0, 'wood_walnut_floor');
  addAnnexFloorPatch(0.15, 2.25, 1.15, 4.95, 0.0, 'concrete_clean');

  // Annex 2F Floors (Y = 2.75)
  const y2 = 2.75;
  addAnnexFloorPatch(0.15, 0.15, 4.85, 2.25, y2, 'parquet_oak');
  addAnnexFloorPatch(1.20, 2.25, 2.45, 5.55, y2, 'parquet_oak');
  addAnnexFloorPatch(0.15, 4.95, 1.20, 5.55, y2, 'parquet_oak');
  addAnnexFloorPatch(2.55, 2.35, 4.85, 5.55, y2, 'tatami_ryukyu');
  addAnnexFloorPatch(0.15, 5.65, 4.85, 7.85, y2, 'wood_floor');

  // Annex 3F Floors (Y = 5.50 — 6 Rooms + Central Spine + 3× 1.00m × 1.60m Balconies!)
  const y3 = 5.50;
  addAnnexFloorPatch(0.15, 0.15, 2.15, 1.45, y3, 'carpet_charcoal_tile'); // A301 NW Study
  addAnnexFloorPatch(0.15, 1.55, 2.15, 2.25, y3, 'wood_floor');           // North Stair Landing
  addAnnexFloorPatch(1.25, 2.25, 2.15, 4.95, y3, 'wood_floor');           // Central Spine
  addAnnexFloorPatch(0.15, 4.95, 4.85, 5.65, y3, 'wood_floor');           // South T-Hall & STA3 entry
  addAnnexFloorPatch(2.25, 0.15, 4.85, 2.15, y3, 'wood_floor');           // A302 NE Guest
  addAnnexFloorPatch(2.25, 2.25, 4.85, 3.55, y3, 'parquet_oak');          // A303 East Library
  addAnnexFloorPatch(2.25, 3.65, 4.85, 4.95, y3, 'tatami_ryukyu');        // A304 East Tea Room
  addAnnexFloorPatch(0.15, 5.75, 2.35, 7.85, y3, 'wood_walnut_floor');    // A305 SW Forest Atelier
  addAnnexFloorPatch(2.45, 5.75, 4.85, 7.85, y3, 'wood_floor');           // A306 SE Sky Salon

  // Build ALL 3 Walkable 1.00m × 1.60m Cantilevered Balconies on Annex 3F!
  const railH = 1.10;
  for (const bal of ANNEX.balconies3F) {
    const bw = bal.lx2 - bal.lx1;
    const bd = bal.lz2 - bal.lz1;
    const cx = wx((bal.lx1 + bal.lx2) / 2);
    const cz = wz((bal.lz1 + bal.lz2) / 2);
    addBox(staticGroup, bw + 0.06, 0.15, bd + 0.06, mat.darkIron, cx, y3 - 0.10, cz, true);
    addAnnexFloorPatch(bal.lx1, bal.lz1, bal.lx2, bal.lz2, y3 - 0.02, 'wood_deck');

    const xMin = wx(bal.lx1), xMax = wx(bal.lx2);
    const zMin = wz(bal.lz1), zMax = wz(bal.lz2);

    const addRailingSeg = (sideName) => {
      if (sideName === 'north') {
        const lenX = bal.side === 'west' ? bw - 0.044 : bw + 0.04;
        const offX = bal.side === 'west' ? 0.022 : 0;
        addBox(staticGroup, lenX, 0.042, 0.042, mat.darkIron, cx + offX, y3 + railH, zMin + 0.02, false);
        const g = addBox(dynamicGroup, bw - 0.08, railH - 0.12, 0.018, mat.glassClear, cx, y3 + railH / 2, zMin + 0.02, false);
        g.userData.noBatch = true;
        addCollider(3, xMin - 0.05, zMin - 0.06, xMax + 0.05, zMin + 0.04);
      } else if (sideName === 'south') {
        const lenX = bal.side === 'west' ? bw - 0.044 : bw + 0.04;
        const offX = bal.side === 'west' ? 0.022 : 0;
        addBox(staticGroup, lenX, 0.042, 0.042, mat.darkIron, cx + offX, y3 + railH, zMax - 0.02, false);
        const g = addBox(dynamicGroup, bw - 0.08, railH - 0.12, 0.018, mat.glassClear, cx, y3 + railH / 2, zMax - 0.02, false);
        g.userData.noBatch = true;
        addCollider(3, xMin - 0.05, zMax - 0.04, xMax + 0.05, zMax + 0.06);
      } else if (sideName === 'west') {
        const lenZ = bal.side === 'west' ? bd + 0.04 : bd - 0.044;
        const offZ = bal.side === 'north' ? 0.022 : (bal.side === 'south' ? -0.022 : 0);
        addBox(staticGroup, 0.042, 0.042, lenZ, mat.darkIron, xMin + 0.02, y3 + railH, cz + offZ, false);
        const g = addBox(dynamicGroup, 0.018, railH - 0.12, bd - 0.08, mat.glassClear, xMin + 0.02, y3 + railH / 2, cz, false);
        g.userData.noBatch = true;
        addCollider(3, xMin - 0.06, zMin - 0.05, xMin + 0.04, zMax + 0.05);
      } else if (sideName === 'east') {
        const lenZ = bd - 0.044;
        const offZ = bal.side === 'north' ? 0.022 : -0.022;
        addBox(staticGroup, 0.042, 0.042, lenZ, mat.darkIron, xMax - 0.02, y3 + railH, cz + offZ, false);
        const g = addBox(dynamicGroup, 0.018, railH - 0.12, bd - 0.08, mat.glassClear, xMax - 0.02, y3 + railH / 2, cz, false);
        g.userData.noBatch = true;
        addCollider(3, xMax - 0.04, zMin - 0.05, xMax + 0.06, zMax + 0.05);
      }
    };

    if (bal.side === 'north') {
      addRailingSeg('north'); addRailingSeg('west'); addRailingSeg('east');
    } else if (bal.side === 'south') {
      addRailingSeg('south'); addRailingSeg('west'); addRailingSeg('east');
    } else if (bal.side === 'west') {
      addRailingSeg('west'); addRailingSeg('north'); addRailingSeg('south');
    }
    // 4 Corner iron posts stopped cleanly below top handrail
    const postH = railH - 0.022;
    [[xMin + 0.02, zMin + 0.02], [xMax - 0.02, zMin + 0.02], [xMin + 0.02, zMax - 0.02], [xMax - 0.02, zMax - 0.02]].forEach(([px, pz]) => {
      addBox(staticGroup, 0.038, postH, 0.038, mat.darkIron, px, y3 + postH / 2, pz, false);
    });
    // Compact balcony teak stool
    addBox(furnitureGroup, 0.32, 0.42, 0.32, mat.walnut, cx + (bal.side === 'west' ? 0 : 0.46), y3 + 0.20, cz + (bal.side === 'west' ? 0.46 : 0), false);
  }

  // Annex Attic Floors (Y = 8.15 — 5 Rooms + Stairwell Hatch Corridor)
  const attY = ANNEX.atticBaseY; // 8.15
  addAnnexFloorPatch(0.15, 0.15, 2.15, 1.35, attY, 'wood_scratched_cedar'); // AR01 NW Stargaze Nook
  addAnnexFloorPatch(0.15, 1.45, 2.15, 2.25, attY, 'rubber_black_stud');    // Hatch Landing
  addAnnexFloorPatch(1.20, 2.25, 2.15, 5.55, attY, 'rubber_black_stud');    // Central Hatch Corridor
  addAnnexFloorPatch(2.15, 5.05, 4.85, 5.55, attY, 'rubber_black_stud');    // South T-Hall
  addAnnexFloorPatch(2.25, 0.15, 4.85, 2.55, attY, 'wood_scratched_cedar'); // AR02 NE Archive
  addAnnexFloorPatch(2.25, 2.65, 4.85, 4.95, attY, 'parquet_oak');          // AR03 East Hobby
  addAnnexFloorPatch(0.15, 5.65, 2.35, 7.85, attY, 'wood_walnut_floor');    // AR04 SW Reading
  addAnnexFloorPatch(2.45, 5.65, 4.85, 7.85, attY, 'tatami_aged');          // AR05 SE Secret Tatami

  // =========================================================================
  // 3. STANDARD WALLS FOR ANNEX 1F, 2F, 3F
  // =========================================================================
  function buildAnnexFloorWalls(annexFloor) {
    const fIdx = annexFloor.physicalFloor;
    const baseY = annexFloor.baseY;
    const extWallH = annexFloor.slabTopY - baseY;
    const intWallH = annexFloor.ceilingH != null ? annexFloor.ceilingH : extWallH;

    for (const rawWall of annexFloor.walls) {
      if (rawWall.kind === 'railing') continue;
      const wallH = rawWall.kind === 'ext' ? extWallH : intWallH;

      const isH = rawWall.axis === 'h';
      const wall = {
        ...rawWall,
        x1: wx(rawWall.x1),
        x2: wx(rawWall.x2),
        z1: wz(rawWall.z1),
        z2: wz(rawWall.z2),
      };
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;

      const isMinSide = isH ? rawWall.z1 < 0.2 : rawWall.x1 < 0.2;
      const frontTex = rawWall.kind === 'ext'
        ? (isMinSide ? rawWall.extTex : rawWall.intTex)
        : rawWall.texA;
      const backTex = rawWall.kind === 'ext'
        ? (isMinSide ? rawWall.intTex : rawWall.extTex)
        : rawWall.texB;

      const ops = (rawWall.openings || [])
        .map((op) => ({ ...op, pos: isH ? wx(op.pos) : wz(op.pos) }))
        .sort((a, b) => a.pos - b.pos);

      let cursor = start;
      for (const op of ops) {
        if (op.pos > cursor + 0.005) {
          const segLen = op.pos - cursor;
          const mid = cursor + segLen / 2;
          if (isH) {
            addWallBox(staticGroup, segLen, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
            addCollider(fIdx, cursor, wall.z1, op.pos, wall.z2);
          } else {
            addWallBox(staticGroup, thick, wallH, segLen, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
            addCollider(fIdx, wall.x1, cursor, wall.x2, op.pos);
          }
        }

        const opMid = op.pos + op.width / 2;
        const opSill = Math.max(0, op.sill || 0);
        const opTop = opSill + op.height;

        if (opSill > 0.02) {
          if (isH) {
            addWallBox(staticGroup, op.width, opSill, thick, opMid, baseY + opSill / 2, centerOrtho, frontTex, backTex, 'h');
            addCollider(fIdx, op.pos, wall.z1, op.pos + op.width, wall.z2);
          } else {
            addWallBox(staticGroup, thick, opSill, op.width, centerOrtho, baseY + opSill / 2, opMid, frontTex, backTex, 'v');
            addCollider(fIdx, wall.x1, op.pos, wall.x2, op.pos + op.width);
          }
        } else if (op.type.startsWith('window')) {
          if (isH) addCollider(fIdx, op.pos, wall.z1, op.pos + op.width, wall.z2);
          else addCollider(fIdx, wall.x1, op.pos, wall.x2, op.pos + op.width);
        }

        if (opTop < wallH - 0.01) {
          const headH = wallH - opTop;
          if (isH) {
            addWallBox(staticGroup, op.width, headH, thick, opMid, baseY + opTop + headH / 2, centerOrtho, frontTex, backTex, 'h');
          } else {
            addWallBox(staticGroup, thick, headH, op.width, centerOrtho, baseY + opTop + headH / 2, opMid, frontTex, backTex, 'v');
          }
        }

        if (op.type.startsWith('door')) addInteractiveDoor(fIdx, op, wall, baseY);
        else addWindowFrame(op, wall, baseY);

        cursor = op.pos + op.width;
      }

      if (end > cursor + 0.005) {
        const segLen = end - cursor;
        const mid = cursor + segLen / 2;
        if (isH) {
          addWallBox(staticGroup, segLen, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
          addCollider(fIdx, cursor, wall.z1, end, wall.z2);
        } else {
          addWallBox(staticGroup, thick, wallH, segLen, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
          addCollider(fIdx, wall.x1, cursor, wall.x2, end);
        }
      }
    }
  }

  buildAnnexFloorWalls(ANNEX_FLOORS[0]); // 1F
  buildAnnexFloorWalls(ANNEX_FLOORS[1]); // 2F
  buildAnnexFloorWalls(ANNEX_FLOORS[2]); // 3F

  // =========================================================================
  // 4. ANNEX ATTIC — 6寸 GABLE ROOF (Y = 8.15 .. 10.95 m) + 5 SLOPED-CLIPPED ROOMS!
  // =========================================================================
  const kneeH = ANNEX.atticKneewallH; // 1.40
  const eaveY = ANNEX.atticEaveY;     // 9.55
  const ridgeY = ANNEX.atticRidgeY;   // 10.95
  const atticDef = ANNEX_FLOORS[3];

  // Exterior Kneewalls (West & East)
  addWallBox(staticGroup, 0.15, kneeH, 7.70, wx(0.075), attY + kneeH / 2, wz(4.0), 'yakisugi_deep', 'wainscot_rustic', 'v');
  addWallBox(staticGroup, 0.15, kneeH, 7.70, wx(4.925), attY + kneeH / 2, wz(4.0), 'wainscot_rustic', 'yakisugi_deep', 'v');
  addCollider(4, wx(0.0), wz(0.0), wx(0.16), wz(8.0));
  addCollider(4, wx(4.84), wz(0.0), wx(5.0), wz(8.0));

  // North & South Exterior Gable End Walls
  function buildAnnexGableEnd(lz1, lz2, isNorth, winOpRaw, intTex) {
    const z1 = wz(lz1), z2 = wz(lz2);
    const thick = z2 - z1;
    const cz = (z1 + z2) / 2;
    const extTex = 'yakisugi_deep';
    const frontTex = isNorth ? extTex : intTex;
    const backTex = isNorth ? intTex : extTex;

    const wx1 = winOpRaw.pos;
    const wx2 = winOpRaw.pos + winOpRaw.width;
    const sillY = attY + winOpRaw.sill;
    const winTopY = sillY + winOpRaw.height;

    addWallBox(staticGroup, wx1, kneeH, thick, wx(wx1 / 2), attY + kneeH / 2, cz, frontTex, backTex, 'h');
    addWallBox(staticGroup, 5.0 - wx2, kneeH, thick, wx((wx2 + 5.0) / 2), attY + kneeH / 2, cz, frontTex, backTex, 'h');
    addWallBox(staticGroup, winOpRaw.width, winOpRaw.sill, thick, wx((wx1 + wx2) / 2), attY + winOpRaw.sill / 2, cz, frontTex, backTex, 'h');
    addWindowFrame({ ...winOpRaw, pos: wx(winOpRaw.pos) }, { axis: 'h', z1, z2 }, attY);
    addCollider(4, wx(0.0), z1, wx(5.0), z2);

    const cutTop = Math.min(winTopY, getAnnexAtticCeilingY(wx1) - 0.04, getAnnexAtticCeilingY(wx2) - 0.04);
    const shape = new THREE.Shape();
    shape.moveTo(0, eaveY);
    if (cutTop > eaveY + 0.02) {
      shape.lineTo(wx1, eaveY);
      shape.lineTo(wx1, cutTop);
      shape.lineTo(wx2, cutTop);
      shape.lineTo(wx2, eaveY);
    }
    shape.lineTo(5.0, eaveY);
    shape.lineTo(2.5, ridgeY);
    shape.closePath();

    const extMatG = makeSurfaceMat(extTex, 1.5, 1.5);
    const intMatG = makeSurfaceMat(intTex, 1.5, 1.5);
    const makeFace = (zPos, baseMat, isBack) => {
      const geo = new THREE.ShapeGeometry(shape);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.65, (uv.getY(i) - attY) * 0.65);
      const m = isBack ? baseMat.clone() : baseMat;
      if (isBack) m.side = THREE.BackSide;
      const fm = new THREE.Mesh(geo, m);
      fm.position.set(ox, 0, zPos);
      fm.castShadow = true;
      fm.receiveShadow = true;
      staticGroup.add(fm);
    };
    makeFace(z2, isNorth ? intMatG : extMatG, false);
    makeFace(z1, isNorth ? extMatG : intMatG, true);
  }
  buildAnnexGableEnd(0.0, 0.15, true, atticDef.walls[0].openings[0], 'wood_scratched_cedar');
  buildAnnexGableEnd(7.85, 8.0, false, atticDef.walls[1].openings[0], 'wallpaper_vintage_floral');

  // 6寸 Sloped Charcoal-Slate Gable Roof + Interior Plywood Ceiling + Walnut Ridge/Rafters
  const roofAngle = Math.atan(ANNEX.atticSlope);
  const extRun = 2.50 + 0.45;
  const extSlopeLen = extRun / Math.cos(roofAngle);
  const roofDepth = 8.90;
  const slateRoofMat = makeSurfaceMat('slate_charcoal', extSlopeLen, roofDepth, { roughness: 0.64 });
  const plywoodCeilMat = makeSurfaceMat('plywood_attic', 2.85, 7.70, { roughness: 0.78 });

  [-1, 1].forEach((side) => {
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(extSlopeLen, 0.12, roofDepth), slateRoofMat);
    rMesh.position.set(wx(2.5) + side * (extRun / 2 + 0.025), ridgeY + 0.10 - (extRun / 2) * ANNEX.atticSlope + (side > 0 ? 0.002 : 0), wz(4.0));
    rMesh.rotation.z = -side * roofAngle;
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    staticGroup.add(rMesh);

    const intRun = 2.40;
    const intSlopeLen = intRun / Math.cos(roofAngle);
    const cMesh = new THREE.Mesh(new THREE.BoxGeometry(intSlopeLen, 0.04, 7.72), plywoodCeilMat);
    cMesh.position.set(wx(2.5) + side * (intRun / 2 + 0.025), ridgeY - 0.02 - (intRun / 2) * ANNEX.atticSlope + (side > 0 ? 0.002 : 0), wz(4.0));
    cMesh.rotation.z = -side * roofAngle;
    cMesh.receiveShadow = true;
    staticGroup.add(cMesh);
  });
  addBox(staticGroup, 0.22, 0.09, roofDepth + 0.04, mat.darkIron, wx(2.50), ridgeY + 0.17, wz(4.0), false);

  // Exposed Walnut Ridge Beam & Rafters in Annex Attic
  addBox(staticGroup, 0.12, 0.20, 7.75, mat.walnut, wx(2.50), ridgeY - 0.13, wz(4.0), true);
  for (let rz = 0.65; rz <= 7.55; rz += 1.35) {
    [-1, 1].forEach((side) => {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.10, 0.07), mat.walnut);
      rafter.position.set(wx(2.5) + side * 1.18, ridgeY - 0.10 - 1.18 * ANNEX.atticSlope, wz(rz));
      rafter.rotation.z = -side * roofAngle;
      staticGroup.add(rafter);
    });
  }

  // Interior Partition Walls for all 5 Attic Rooms — clipped cleanly beneath the sloped gable roof!
  function addSlopedCapPanel(lx1, lx2, baseH, lz1, lz2, texNorth, texSouth) {
    if (lx2 - lx1 < 0.02) return;
    const yBase = attY + baseH;
    const pts = [];
    const xs = [lx1];
    if (lx1 < 2.5 && lx2 > 2.5) xs.push(2.5);
    xs.push(lx2);
    const shape = new THREE.Shape();
    shape.moveTo(lx1, yBase);
    shape.lineTo(lx2, yBase);
    for (let i = xs.length - 1; i >= 0; i--) {
      const x = xs[i];
      const topY = Math.max(yBase + 0.01, getAnnexAtticCeilingY(x) - 0.03);
      pts.push([x, topY]);
      shape.lineTo(x, topY);
    }
    shape.closePath();
    const mS = makeSurfaceMat(texSouth, 1.2, 1.2);
    const mN = makeSurfaceMat(texNorth, 1.2, 1.2).clone();
    mN.side = THREE.BackSide;
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.65, (uv.getY(i) - attY) * 0.65);
    const fmS = new THREE.Mesh(geo, mS);
    fmS.position.set(ox, 0, wz(lz2));
    staticGroup.add(fmS);
    const fmN = new THREE.Mesh(geo.clone(), mN);
    fmN.position.set(ox, 0, wz(lz1));
    staticGroup.add(fmN);
  }

  for (const rawWall of atticDef.walls) {
    if (rawWall.kind !== 'int') continue;
    const isH = rawWall.axis === 'h';
    const wall = {
      ...rawWall,
      x1: wx(rawWall.x1), x2: wx(rawWall.x2),
      z1: wz(rawWall.z1), z2: wz(rawWall.z2),
    };
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const ops = (rawWall.openings || []).map((op) => ({ ...op, pos: isH ? wx(op.pos) : wz(op.pos) })).sort((a, b) => a.pos - b.pos);

    if (!isH) {
      // Longitudinal interior wall (constant ceiling height along Z!)
      const lxMid = (rawWall.x1 + rawWall.x2) / 2;
      const wallH = Math.min(2.65, getAnnexAtticCeilingY(lxMid) - attY - 0.04);
      let cursor = wall.z1;
      for (const op of ops) {
        if (op.pos > cursor + 0.005) {
          const seg = op.pos - cursor;
          addWallBox(staticGroup, thick, wallH, seg, centerOrtho, attY + wallH / 2, cursor + seg / 2, rawWall.texA, rawWall.texB, 'v');
          addCollider(4, wall.x1, cursor, wall.x2, op.pos);
        }
        const headH = wallH - op.height;
        if (headH > 0.02) {
          addWallBox(staticGroup, thick, headH, op.width, centerOrtho, attY + op.height + headH / 2, op.pos + op.width / 2, rawWall.texA, rawWall.texB, 'v');
        }
        addInteractiveDoor(4, op, wall, attY);
        cursor = op.pos + op.width;
      }
      if (wall.z2 > cursor + 0.005) {
        const seg = wall.z2 - cursor;
        addWallBox(staticGroup, thick, wallH, seg, centerOrtho, attY + wallH / 2, cursor + seg / 2, rawWall.texA, rawWall.texB, 'v');
        addCollider(4, wall.x1, cursor, wall.x2, wall.z2);
      }
    } else {
      // Transverse interior wall: solid box up to min ceiling height + sloped ShapeGeometry cap right up to roof!
      let cursor = wall.x1;
      for (const op of ops) {
        if (op.pos > cursor + 0.005) {
          const seg = op.pos - cursor;
          const la = cursor - ox, lb = op.pos - ox;
          const rectH = Math.min(getAnnexAtticCeilingY(la), getAnnexAtticCeilingY(lb)) - attY - 0.04;
          addWallBox(staticGroup, seg, rectH, thick, cursor + seg / 2, attY + rectH / 2, centerOrtho, rawWall.texA, rawWall.texB, 'h');
          addSlopedCapPanel(la, lb, rectH - 0.005, rawWall.z1, rawWall.z2, rawWall.texA, rawWall.texB);
          addCollider(4, cursor, wall.z1, op.pos, wall.z2);
        }
        const opLa = op.pos - ox, opLb = op.pos + op.width - ox;
        addSlopedCapPanel(opLa, opLb, op.height, rawWall.z1, rawWall.z2, rawWall.texA, rawWall.texB);
        addInteractiveDoor(4, op, wall, attY);
        cursor = op.pos + op.width;
      }
      if (wall.x2 > cursor + 0.005) {
        const seg = wall.x2 - cursor;
        const la = cursor - ox, lb = wall.x2 - ox;
        const rectH = Math.min(getAnnexAtticCeilingY(la), getAnnexAtticCeilingY(lb)) - attY - 0.04;
        addWallBox(staticGroup, seg, rectH, thick, cursor + seg / 2, attY + rectH / 2, centerOrtho, rawWall.texA, rawWall.texB, 'h');
        addSlopedCapPanel(la, lb, rectH - 0.005, rawWall.z1, rawWall.z2, rawWall.texA, rawWall.texB);
        addCollider(4, cursor, wall.z1, wall.x2, wall.z2);
      }
    }
  }

  // Annex Attic Stairwell Iron & Oak Safety Guardrail (mitered cleanly at corner)
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.darkIron, wx(1.18), attY + 0.96, wz(3.62), false);
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.oak, wx(1.18), attY + 1.01, wz(3.62), false);
  addBox(staticGroup, 1.00, 0.05, 0.05, mat.darkIron, wx(0.655), attY + 0.96, wz(4.98), false);
  addBox(staticGroup, 1.00, 0.05, 0.05, mat.oak, wx(0.655), attY + 1.01, wz(4.98), false);
  for (let lz = 2.30; lz <= 4.98; lz += 0.22) {
    addBox(staticGroup, 0.022, 0.935, 0.022, mat.darkIron, wx(1.18), attY + 0.4675, wz(lz), false);
  }
  for (let lx = 0.22; lx <= 1.08; lx += 0.22) {
    addBox(staticGroup, 0.022, 0.935, 0.022, mat.darkIron, wx(lx), attY + 0.4675, wz(4.98), false);
  }
  addCollider(4, wx(1.14), wz(2.25), wx(1.24), wz(5.04));
  addCollider(4, wx(0.15), wz(4.94), wx(1.24), wz(5.04));

  // Continuous Exterior Corner Pilasters proud of walls & slab bands (0 -> eaveY = 9.55m)
  [[-0.01, -0.01], [5.01, -0.01], [-0.01, 8.01], [5.01, 8.01]].forEach(([lx, lz]) => {
    addBox(staticGroup, 0.08, eaveY, 0.08, mat.darkIron, wx(lx), eaveY / 2, wz(lz), false);
  });

  // =========================================================================
  // 5. 3-FLIGHT STACKED STAIRCASE CORE (STA1: 1F->2F, STA2: 2F->3F, STA3: 3F->Attic)
  // =========================================================================
  function buildAnnexStairFlight(yStart, yEnd, treadTex, closedSoffit = false) {
    const sw = ANNEX.stairWorld;
    const steps = sw.treads;
    const rise = (yEnd - yStart) / steps;
    const run = (sw.bottomZ - sw.topZ) / steps;
    const treadMat = makeSurfaceMat(treadTex, 0.96, 0.25, { roughness: 0.45 });
    const stairW = sw.maxX - sw.minX - 0.04;
    const centerX = (sw.minX + sw.maxX) / 2;

    for (let i = 0; i < steps; i++) {
      const sy = yStart + (i + 1) * rise;
      const sz = sw.bottomZ - (i + 0.5) * run;
      addBox(staticGroup, stairW, 0.045, run + 0.03, treadMat, centerX, sy - 0.022, sz, true);
      addBox(staticGroup, stairW - 0.02, closedSoffit ? rise : rise * 0.46, 0.025, closedSoffit ? mat.walnut : mat.darkIron, centerX, sy - (closedSoffit ? rise / 2 : rise * 0.25), sz + run / 2, false);
    }
    const dy = yEnd - yStart;
    const slopeLen = Math.hypot(sw.bottomZ - sw.topZ, dy);
    const pitchAngle = Math.atan2(dy, sw.bottomZ - sw.topZ);
    const midY = (yStart + yEnd) / 2;
    const midZ = (sw.bottomZ + sw.topZ) / 2;
    [sw.minX + 0.03, sw.maxX - 0.03].forEach((sx) => {
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, slopeLen), mat.darkIron);
      str.position.set(sx, midY - 0.08, midZ);
      str.rotation.x = pitchAngle;
      staticGroup.add(str);
    });
    if (closedSoffit) {
      const sof = new THREE.Mesh(new THREE.BoxGeometry(stairW + 0.02, 0.045, slopeLen), mat.walnut);
      sof.position.set(centerX, midY - 0.14, midZ);
      sof.rotation.x = pitchAngle;
      staticGroup.add(sof);
    }
    const aRail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, slopeLen), mat.oak);
    aRail.position.set(sw.maxX - 0.045, midY + 0.88, midZ);
    aRail.rotation.x = pitchAngle;
    staticGroup.add(aRail);
    const aLed = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.024, slopeLen * 0.92), new THREE.MeshBasicMaterial({ color: 0xffc67c }));
    aLed.position.set(sw.minX + 0.012, midY + 0.22, midZ);
    aLed.rotation.x = pitchAngle;
    staticGroup.add(aLed);
  }
  buildAnnexStairFlight(0.00, 2.75, 'wood_floor', false);
  buildAnnexStairFlight(2.75, 5.50, 'wood_walnut_floor', true);
  buildAnnexStairFlight(5.50, 8.15, 'wood_scratched_cedar', true);

  // =========================================================================
  // 6. INTERIOR FURNISHINGS ACROSS ALL 4 ANNEX LEVELS (1F, 2F, 3F 6-Rooms, Attic 5-Rooms)
  // =========================================================================
  const denimMat = makeSurfaceMat('fabric_denim', 0.55, 0.55);
  const crateMat = makeSurfaceMat('crate_wood', 0.55, 0.55);
  const sofaMat = makeSurfaceMat('fabric_grey_sofa', 1.5, 0.72);
  const burlapMat = makeSurfaceMat('burlap_sack', 0.6, 0.6);

  // --- Annex 1F ---
  addBox(furnitureGroup, 0.68, 0.015, 0.46, makeFrontMat('doormat_coir', { roughness: 0.95 }), wx(3.90), -0.075, wz(0.50), false);
  addBox(furnitureGroup, 0.36, 0.52, 1.05, mat.oak, wx(4.64), 0.16, wz(0.95), true);
  addCollider(1, wx(4.42), wz(0.40), wx(4.85), wz(1.52));

  addBox(furnitureGroup, 1.55, 0.045, 0.68, mat.oak, wx(1.25), 0.76, wz(0.54), true);
  addBox(furnitureGroup, 0.05, 0.74, 0.60, mat.darkIron, wx(0.55), 0.37, wz(0.54), false);
  addBox(furnitureGroup, 0.05, 0.74, 0.60, mat.darkIron, wx(1.95), 0.37, wz(0.54), false);
  addCollider(1, wx(0.45), wz(0.18), wx(2.05), wz(0.90));
  addBox(furnitureGroup, 0.03, 0.85, 1.15, makeSurfaceMat('cork_board', 1.15, 0.85), wx(0.18), 1.38, wz(1.25), false);
  addBox(furnitureGroup, 0.48, 0.48, 0.48, crateMat, wx(0.46), 0.24, wz(1.80), true);

  addBox(furnitureGroup, 0.95, 0.80, 0.48, makeFrontMat('furniture_vanity_base'), wx(3.55), 0.40, wz(2.02), true);
  addBox(furnitureGroup, 0.98, 0.04, 0.50, makeSurfaceMat('marble_white', 0.98, 0.50), wx(3.55), 0.82, wz(2.02), false);
  addBox(furnitureGroup, 0.82, 0.72, 0.03, mat.mirror, wx(3.55), 1.42, wz(1.78), false);
  addCollider(1, wx(3.04), wz(1.76), wx(4.06), wz(2.30));
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, wx(3.55), 0.21, wz(3.52), true);
  addCollider(1, wx(3.30), wz(3.18), wx(3.82), wz(3.90));
  addBox(furnitureGroup, 0.03, 1.55, 0.03, mat.chrome, wx(4.78), 1.25, wz(3.10), false);

  addBox(staticGroup, 0.03, 1.35, 2.05, makeSurfaceMat('tile_caramel_brick', 2.05, 1.35), wx(4.83), 1.45, wz(5.15), false);
  addBox(furnitureGroup, 0.62, 0.84, 1.95, makeSurfaceMat('furniture_kitchen_cab', 1.95, 0.84), wx(4.52), 0.42, wz(5.15), true);
  addBox(furnitureGroup, 0.64, 0.04, 1.98, makeSurfaceMat('marble_white', 1.98, 0.64), wx(4.52), 0.86, wz(5.15), false);
  addCollider(1, wx(4.18), wz(4.14), wx(4.85), wz(6.16));
  addBox(furnitureGroup, 0.86, 0.04, 1.18, mat.oak, wx(2.85), 0.73, wz(5.85), true);
  [[-0.35, -0.48], [0.35, -0.48], [-0.35, 0.48], [0.35, 0.48]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.04, 0.71, 0.04, mat.darkIron, wx(2.85) + dx, 0.355, wz(5.85) + dz, false);
  });
  addBox(furnitureGroup, 0.46, 0.02, 0.34, makeFrontMat('meal_teishoku'), wx(2.85), 0.76, wz(5.85), false);
  addCollider(1, wx(2.38), wz(5.22), wx(3.32), wz(6.48));
  addBox(furnitureGroup, 0.60, 0.38, 1.54, denimMat, wx(0.68), 0.20, wz(6.68), true);
  addBox(furnitureGroup, 0.18, 0.68, 1.56, denimMat, wx(0.28), 0.42, wz(6.68), true);
  addCollider(1, wx(0.16), wz(5.86), wx(1.04), wz(7.50));
  addBox(furnitureGroup, 0.48, 0.035, 0.88, mat.walnut, wx(1.48), 0.36, wz(6.68), true);
  addCollider(1, wx(1.22), wz(6.22), wx(1.74), wz(7.14));
  addFramedArt(furnitureGroup, 'art_posters_trio', 0.92, 0.52, wx(0.18), 1.48, wz(6.68), Math.PI / 2);

  addBox(furnitureGroup, 0.035, 1.42, 0.035, mat.bronze, wx(0.55), 0.71, wz(7.56), false);
  const annexLampMat = mat.washiGlow.clone();
  const annexLampMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.36, 12), annexLampMat);
  annexLampMesh.position.set(wx(0.55), 1.50, wz(7.56));
  annexLampMesh.userData.propId = 'lamp_annex_cafe';
  annexLampMesh.userData.noBatch = true;
  dynamicGroup.add(annexLampMesh);
  excludeBatch.add(annexLampMesh);
  const annexCafeLight = addLight('Annex_Cafe_Lamp', 1, 'cafe', 0xffae56, 2.15, 7.6, wx(1.45), 1.75, wz(6.55));
  annexCafeLight.userData.building = 'annex';
  annexCafeLight.intensity = 0;
  annexCafeLight.visible = false;
  interactiveProps.push({
    id: 'lamp_annex_cafe', floor: 1, mesh: annexLampMesh, isOn: true,
    getLabel() { return this.isOn ? '離れフロアランプを消す' : '離れフロアランプを点ける'; },
    toggle() { this.isOn = !this.isOn; annexLampMat.emissiveIntensity = this.isOn ? 1.9 : 0.08; if (!this.isOn) annexCafeLight.intensity = 0; },
  });

  // --- Annex 2F (Y = 2.75) ---
  addBox(staticGroup, 0.03, 2.40, 2.00, makeSurfaceMat('wood_slats', 2.0, 2.4), wx(4.83), y2 + 1.20, wz(1.15), false);
  addBox(furnitureGroup, 0.38, 1.88, 1.15, makeFrontMat('furniture_bookshelf'), wx(4.62), y2 + 0.94, wz(1.15), true);
  addCollider(2, wx(4.40), wz(0.55), wx(4.85), wz(1.75));
  addBox(furnitureGroup, 1.65, 0.42, 0.38, mat.oak, wx(2.50), y2 + 0.21, wz(0.38), true);
  addCollider(2, wx(1.65), wz(0.16), wx(3.35), wz(0.58));
  addFramedArt(furnitureGroup, 'art_poster_3', 0.46, 0.62, wx(0.18), y2 + 1.45, wz(1.15), Math.PI / 2);

  addBox(furnitureGroup, 0.82, 0.04, 0.82, mat.walnut, wx(3.68), y2 + 0.33, wz(3.90), true);
  addBox(furnitureGroup, 0.64, 0.31, 0.64, mat.walnut, wx(3.68), y2 + 0.155, wz(3.90), false);
  addBox(furnitureGroup, 0.52, 0.07, 0.52, makeFrontMat('zabuton_red'), wx(3.68), y2 + 0.052, wz(3.20), false);
  addBox(furnitureGroup, 0.52, 0.07, 0.52, makeFrontMat('zabuton_red'), wx(3.68), y2 + 0.052, wz(4.60), false);
  addCollider(2, wx(3.24), wz(3.45), wx(4.12), wz(4.35));

  // Annex 2F Master Bedroom (shifted cleanly into lz=5.65..7.85!)
  addBox(furnitureGroup, 2.05, 0.014, 1.98, makeSurfaceMat('carpet_beige', 2.05, 1.98), wx(2.85), y2 + 0.024, wz(6.75), false);
  addBox(furnitureGroup, 1.54, 0.25, 1.88, mat.walnut, wx(3.05), y2 + 0.125, wz(6.70), true);
  addBox(furnitureGroup, 1.48, 0.22, 1.82, makeSurfaceMat('fabric_floral_quilt', 1.48, 1.82), wx(3.05), y2 + 0.36, wz(6.70), true);
  addBox(furnitureGroup, 0.50, 0.13, 0.30, makeFrontMat('fabric_rose_vintage'), wx(2.72), y2 + 0.52, wz(5.96), false);
  addBox(furnitureGroup, 0.50, 0.13, 0.30, makeFrontMat('fabric_sakura'), wx(3.38), y2 + 0.52, wz(5.96), false);
  addCollider(2, wx(2.26), wz(5.74), wx(3.84), wz(7.66));
  addBox(furnitureGroup, 0.52, 1.98, 1.55, makeFrontMat('furniture_wardrobe'), wx(4.56), y2 + 0.99, wz(6.75), true);
  addCollider(2, wx(4.28), wz(5.95), wx(4.85), wz(7.55));

  // --- Annex 3F (Y = 5.50 — 6 Rooms + 3× 1.0m × 1.6m Balconies) ---
  // A301 NW Mini Study
  addBox(furnitureGroup, 1.15, 0.04, 0.52, mat.oak, wx(0.85), y3 + 0.72, wz(0.45), true);
  addBox(furnitureGroup, 0.42, 0.42, 0.42, denimMat, wx(0.85), y3 + 0.21, wz(1.02), true);
  addCollider(3, wx(0.24), wz(0.18), wx(1.46), wz(0.74));
  // A302 NE Forest Guest Room (leaves clear path to North Balcony DA3-B1!)
  addBox(furnitureGroup, 1.10, 0.22, 1.78, mat.oak, wx(4.24), y3 + 0.11, wz(1.18), true);
  addBox(furnitureGroup, 1.04, 0.18, 1.72, makeSurfaceMat('fabric_floral_quilt', 1.04, 1.72), wx(4.24), y3 + 0.30, wz(1.18), true);
  addCollider(3, wx(3.66), wz(0.26), wx(4.82), wz(2.10));
  // A303 East Library
  addBox(furnitureGroup, 1.55, 1.92, 0.36, makeFrontMat('furniture_bookshelf'), wx(3.55), y3 + 0.96, wz(2.44), true);
  addCollider(3, wx(2.75), wz(2.25), wx(4.35), wz(2.64));
  // A304 East Tea & Dressing Room
  addBox(furnitureGroup, 0.68, 0.30, 0.68, mat.walnut, wx(3.65), y3 + 0.15, wz(4.30), true);
  addBox(furnitureGroup, 0.48, 0.06, 0.48, makeFrontMat('zabuton_red'), wx(2.96), y3 + 0.048, wz(4.30), false);
  addCollider(3, wx(3.28), wz(3.94), wx(4.02), wz(4.66));
  // A305 SW Forest Atelier (leaves clear path to West Balcony DA3-B2!)
  addBox(furnitureGroup, 1.15, 0.04, 0.55, mat.oak, wx(1.65), y3 + 0.74, wz(7.52), true);
  addBox(furnitureGroup, 0.03, 0.75, 1.05, makeSurfaceMat('cork_board', 1.05, 0.75), wx(2.33), y3 + 1.38, wz(6.75), false);
  addCollider(3, wx(1.04), wz(7.22), wx(2.26), wz(7.82));
  // A306 SE Sky Salon (leaves clear path to South Balcony DA3-B3!)
  addBox(furnitureGroup, 1.34, 0.34, 0.54, sofaMat, wx(3.95), y3 + 0.18, wz(6.35), true);
  addBox(furnitureGroup, 1.36, 0.58, 0.16, sofaMat, wx(3.95), y3 + 0.36, wz(5.98), true);
  addCollider(3, wx(3.24), wz(5.84), wx(4.66), wz(6.66));
  addFramedArt(furnitureGroup, 'art_poster_2', 0.48, 0.62, wx(4.82), y3 + 1.32, wz(6.75), -Math.PI / 2);

  // --- Annex Attic (Y = 8.15 — 5 Distinct Attic Rooms!) ---
  // AR01 NW Stargaze Nook
  addBox(furnitureGroup, 0.54, 0.07, 0.54, denimMat, wx(0.95), attY + 0.045, wz(0.65), false);
  addBox(furnitureGroup, 0.42, 0.36, 0.42, crateMat, wx(0.45), attY + 0.18, wz(0.45), false);
  // AR02 NE Archive Room
  addBox(furnitureGroup, 0.58, 0.54, 0.58, crateMat, wx(4.35), attY + 0.27, wz(0.75), true);
  addBox(furnitureGroup, 0.52, 0.48, 0.52, crateMat, wx(4.32), attY + 0.78, wz(0.78), true);
  const aSack = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), burlapMat);
  aSack.position.set(wx(4.25), attY + 0.26, wz(1.65));
  furnitureGroup.add(aSack);
  addCollider(4, wx(3.92), wz(0.40), wx(4.78), wz(2.05));
  // AR03 East Hobby Room
  addBox(furnitureGroup, 0.58, 0.72, 1.25, mat.oak, wx(4.48), attY + 0.36, wz(3.75), true);
  addBox(furnitureGroup, 0.03, 0.75, 1.15, makeSurfaceMat('pegboard_wood', 1.15, 0.75), wx(4.82), attY + 0.96, wz(3.75), false);
  addCollider(4, wx(4.15), wz(3.10), wx(4.82), wz(4.42));
  // AR04 SW Reading Room
  addBox(furnitureGroup, 0.38, 1.22, 1.15, makeFrontMat('furniture_bookshelf'), wx(0.40), attY + 0.61, wz(6.75), true);
  addBox(furnitureGroup, 0.76, 0.32, 0.52, mat.walnut, wx(1.45), attY + 0.16, wz(6.75), true);
  addCollider(4, wx(0.18), wz(6.14), wx(0.64), wz(7.36));
  addCollider(4, wx(1.05), wz(6.46), wx(1.85), wz(7.04));
  // AR05 SE Secret Tatami Room + Hanging Washi Lantern
  addBox(furnitureGroup, 0.74, 0.30, 0.54, mat.walnut, wx(3.65), attY + 0.15, wz(6.75), true);
  addBox(furnitureGroup, 0.52, 0.07, 0.52, makeFrontMat('zabuton_red'), wx(3.65), attY + 0.045, wz(7.38), false);
  addCollider(4, wx(3.26), wz(6.46), wx(4.04), wz(7.04));
  const attBulb = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.26, 8), mat.washiGlow);
  attBulb.position.set(wx(3.25), attY + 1.68, wz(6.75));
  furnitureGroup.add(attBulb);

  // =========================================================================
  // 7. ANNEX LIGHTING (Tagged building='annex' for strict POCO F7 <= 6-7 active light budget!)
  // =========================================================================
  const tagAnnex = (lightObj, building = 'annex') => {
    lightObj.userData.building = building;
    if (building === 'annex') {
      lightObj.intensity = 0;
      lightObj.visible = false;
    }
    return lightObj;
  };
  tagAnnex(addLight('Annex_Porch_Lantern', 1, 'courtyard', 0xffb362, 1.95, 9.0, wx(3.90), 2.15, wz(-0.45)), 'both');
  // Annex 1F
  tagAnnex(addLight('Annex_1F_Atelier', 1, 'north', 0xffcfa0, 1.55, 6.4, wx(1.65), 2.10, wz(1.45)), 'annex');
  tagAnnex(addLight('Annex_1F_Wet', 1, 'mid', 0xdceeff, 1.35, 5.2, wx(3.85), 2.05, wz(2.85)), 'annex');
  tagAnnex(addLight('Annex_1F_Dining', 1, 'south', 0xffbe72, 2.05, 7.5, wx(3.15), 1.85, wz(5.95)), 'annex');
  // Annex 2F
  tagAnnex(addLight('Annex_2F_Library', 2, 'north', 0xffc98e, 1.85, 7.0, wx(2.45), y2 + 2.05, wz(1.35)), 'annex');
  tagAnnex(addLight('Annex_2F_Tatami', 2, 'mid', 0xffb86c, 1.75, 6.0, wx(3.65), y2 + 1.85, wz(3.90)), 'annex');
  tagAnnex(addLight('Annex_2F_Master', 2, 'south', 0xffb46b, 2.15, 7.5, wx(2.65), y2 + 1.85, wz(6.75)), 'annex');
  // Annex 3F (6 Rooms + 3 Balconies — 4 balanced lights!)
  tagAnnex(addLight('Annex_3F_North', 3, 'north', 0xffcc92, 1.90, 6.8, wx(2.35), y3 + 2.05, wz(1.15)), 'annex');
  tagAnnex(addLight('Annex_3F_Mid', 3, 'mid', 0xffc482, 1.85, 6.4, wx(3.25), y3 + 2.00, wz(3.60)), 'annex');
  tagAnnex(addLight('Annex_3F_SW', 3, 'south', 0xffba70, 1.95, 6.6, wx(1.25), y3 + 2.00, wz(6.75)), 'annex');
  tagAnnex(addLight('Annex_3F_SE', 3, 'south', 0xffb86a, 1.95, 6.6, wx(3.65), y3 + 2.00, wz(6.75)), 'annex');
  // Annex Attic (5 Rooms — 3 balanced lights!)
  tagAnnex(addLight('Annex_Attic_North', 4, 'north', 0xffc684, 1.95, 6.8, wx(2.25), attY + 1.85, wz(1.35)), 'annex');
  tagAnnex(addLight('Annex_Attic_Mid', 4, 'mid', 0xffbc74, 1.80, 6.2, wx(3.25), attY + 1.80, wz(3.80)), 'annex');
  tagAnnex(addLight('Annex_Attic_South', 4, 'south', 0xffae56, 2.25, 7.4, wx(2.45), attY + 1.75, wz(6.75)), 'annex');
}
