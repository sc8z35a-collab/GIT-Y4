import * as THREE from 'three';
import { STORAGE, STORAGE_FLOORS } from './planData.js';
import { makeSurfaceMat } from './textures.js';

/**
 * Builds the Separate 3rd Building ("STORAGE-4 / コンクリート倉庫棟"):
 * Exact 2.00m × 2.00m 2-Story Low-Ceiling (CH 1,920mm) Solid Grey Concrete Warehouse
 * containing 4 distinct storage rooms total (2 on 1F: S101/S102 + 2 on 2F: S201/S202),
 * connected via a concrete stepping path East of Main Tower & exterior steel stair STS1!
 */
export function buildStorage3D(ctx) {
  const {
    staticGroup,
    furnitureGroup,
    exteriorGroup,
    mat,
    addCollider,
    addBox,
    addWallBox,
    addLight,
    addInteractiveDoor,
    addWindowFrame,
  } = ctx;

  const ox = STORAGE.originX; // 6.60
  const oz = STORAGE.originZ; // -1.20
  const wx = (lx) => ox + lx;
  const wz = (lz) => oz + lz;
  const y2 = STORAGE.floor2Y; // 2.12

  // =========================================================================
  // 1. HEAVY CAST-IN-PLACE CONCRETE FOUNDATION, APPROACH PATH & SLABS
  // =========================================================================
  const concPadMat = makeSurfaceMat('concrete_clean', 2.4, 2.4, { roughness: 0.90 });
  const concWallMat = makeSurfaceMat('concrete_pcon', 2.2, 2.2, { roughness: 0.86 });
  const grateMat = makeSurfaceMat('metal_grate', 1.2, 1.2, { roughness: 0.45, metalness: 0.65 });

  // Solid Concrete Plinth Pad (exact 2.12 × 2.12 base supporting 2m×2m concrete walls)
  addBox(staticGroup, 2.12, 0.36, 2.12, concPadMat, wx(1.00), -0.18, wz(1.00), true);

  // Concrete Stepping Path from Main North Porch (X=2.20) East to Warehouse 1F Door DS-1 (X=6.60) & South around to STS1!
  addBox(exteriorGroup, 4.40, 0.08, 1.05, makeSurfaceMat('paver_granite_grid', 4.40, 1.05), 4.40, -0.30, -0.68, false);
  addBox(exteriorGroup, 1.05, 0.08, 0.82, makeSurfaceMat('paver_granite_grid', 1.05, 0.82), 6.08, -0.30, 0.27, false);
  addBox(exteriorGroup, 3.84, 0.08, 0.92, makeSurfaceMat('paver_granite_grid', 3.84, 0.92), 7.47, -0.30, 1.15, false);

  // 1F Floor & 2F Solid Concrete Floor Slab (Y = 1.92 .. 2.12 -> exact CH 1.92m!)
  addBox(staticGroup, 1.84, 0.016, 1.84, concPadMat, wx(1.00), 0.008, wz(1.00), false);
  addBox(staticGroup, 2.04, 0.20, 2.04, concWallMat, wx(1.00), 2.02, wz(1.00), true);
  addBox(staticGroup, 1.84, 0.016, 1.84, concPadMat, wx(1.00), y2 + 0.008, wz(1.00), false);

  // Solid Concrete Roof Slab (Y = 4.04 .. 4.28 -> exact CH 1.92m!) + Bunker Parapet Walls (Y = 4.28 .. 4.44)
  addBox(staticGroup, 2.08, 0.24, 2.08, concWallMat, wx(1.00), 4.16, wz(1.00), true);
  addBox(staticGroup, 2.08, 0.16, 0.12, concWallMat, wx(1.00), 4.36, wz(0.02), false);
  addBox(staticGroup, 2.08, 0.16, 0.12, concWallMat, wx(1.00), 4.36, wz(1.98), false);
  addBox(staticGroup, 0.12, 0.16, 1.84, concWallMat, wx(0.02), 4.36, wz(1.00), false);
  addBox(staticGroup, 0.12, 0.16, 1.84, concWallMat, wx(1.98), 4.36, wz(1.00), false);

  // Low exposed concrete beam across center of each floor ceiling
  addBox(staticGroup, 1.82, 0.10, 0.14, concWallMat, wx(1.00), 1.87, wz(1.00), false);
  addBox(staticGroup, 1.82, 0.10, 0.14, concWallMat, wx(1.00), y2 + 1.87, wz(1.00), false);

  // =========================================================================
  // 2. CONCRETE WALLS, STEEL DOORS (DS-1, DS-12, DS-2, DS-22) & SLIT WINDOWS
  // =========================================================================
  function buildStorageFloorWalls(floorDef) {
    const fIdx = floorDef.physicalFloor;
    const baseY = floorDef.baseY;
    const wallH = floorDef.ceilingH; // Exact low-ceiling 1.92m!

    for (const rawWall of floorDef.walls) {
      const isH = rawWall.axis === 'h';
      const wall = {
        ...rawWall,
        x1: wx(rawWall.x1), x2: wx(rawWall.x2),
        z1: wz(rawWall.z1), z2: wz(rawWall.z2),
      };
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
      const frontTex = rawWall.extTex || rawWall.texA;
      const backTex = rawWall.intTex || rawWall.texB;

      const ops = (rawWall.openings || [])
        .map((op) => ({ ...op, pos: isH ? wx(op.pos) : wz(op.pos) }))
        .sort((a, b) => a.pos - b.pos);

      let cursor = start;
      for (const op of ops) {
        if (op.pos > cursor + 0.005) {
          const seg = op.pos - cursor;
          const mid = cursor + seg / 2;
          if (isH) {
            addWallBox(staticGroup, seg, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
            addCollider(fIdx, cursor, wall.z1, op.pos, wall.z2);
          } else {
            addWallBox(staticGroup, thick, wallH, seg, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
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
        }
        if (opTop < wallH - 0.01) {
          const headH = wallH - opTop;
          if (isH) addWallBox(staticGroup, op.width, headH, thick, opMid, baseY + opTop + headH / 2, centerOrtho, frontTex, backTex, 'h');
          else addWallBox(staticGroup, thick, headH, op.width, centerOrtho, baseY + opTop + headH / 2, opMid, frontTex, backTex, 'v');
        }
        if (op.type.startsWith('door')) addInteractiveDoor(fIdx, op, wall, baseY);
        else addWindowFrame(op, wall, baseY);

        cursor = op.pos + op.width;
      }
      if (end > cursor + 0.005) {
        const seg = end - cursor;
        const mid = cursor + seg / 2;
        if (isH) {
          addWallBox(staticGroup, seg, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
          addCollider(fIdx, cursor, wall.z1, end, wall.z2);
        } else {
          addWallBox(staticGroup, thick, wallH, seg, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
          addCollider(fIdx, wall.x1, cursor, wall.x2, end);
        }
      }
    }
  }

  buildStorageFloorWalls(STORAGE_FLOORS[0]); // 1F (Rooms 1 & 2)
  buildStorageFloorWalls(STORAGE_FLOORS[1]); // 2F (Rooms 3 & 4)

  // =========================================================================
  // 3. EXTERIOR INDUSTRIAL STEEL STAIRCASE (STS1) + 2F STEEL GRATING LANDING
  // =========================================================================
  const sw = STORAGE.stairWorld; // X=8.60..9.40, Z=0.80 -> -1.20, Y=0.00 -> 2.12
  const steps = sw.treads;
  const rise = y2 / steps;
  const run = (sw.bottomZ - sw.topZ) / steps;
  const stairW = sw.maxX - sw.minX - 0.04;
  const centerX = (sw.minX + sw.maxX) / 2;

  for (let i = 0; i < steps; i++) {
    const sy = (i + 1) * rise;
    const sz = sw.bottomZ - (i + 0.5) * run;
    addBox(staticGroup, stairW, 0.04, run + 0.02, grateMat, centerX, sy - 0.02, sz, true);
  }
  const slopeLen = Math.hypot(sw.bottomZ - sw.topZ, y2);
  const pitchAngle = Math.atan2(y2, sw.bottomZ - sw.topZ);
  const midZ = (sw.bottomZ + sw.topZ) / 2;
  [sw.minX + 0.025, sw.maxX - 0.025].forEach((sx) => {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, slopeLen), mat.darkIron);
    str.position.set(sx, y2 / 2 - 0.06, midZ);
    str.rotation.x = pitchAngle;
    staticGroup.add(str);
  });
  // Outer East steel stair handrail & safety posts
  const sRail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, slopeLen), mat.darkIron);
  sRail.position.set(sw.maxX - 0.025, y2 / 2 + 0.90, midZ);
  sRail.rotation.x = pitchAngle;
  staticGroup.add(sRail);
  [sw.bottomZ, midZ, sw.topZ].forEach((pz, idx) => {
    const py = idx === 0 ? 0.0 : (idx === 1 ? y2 / 2 : y2);
    addBox(staticGroup, 0.035, 0.88, 0.035, mat.darkIron, sw.maxX - 0.025, py + 0.44, pz, false);
  });

  // 2F Exterior Steel Grating Catwalk Landing (X=7.00..9.40, Z=-1.96..-1.225 at Y=2.12)
  const ld = STORAGE.landing2FWorld;
  const ldW = ld.maxX - ld.minX;
  const ldD = ld.maxZ - ld.minZ - 0.025;
  const ldCX = (ld.minX + ld.maxX) / 2;
  const ldCZ = (ld.minZ + ld.maxZ - 0.025) / 2;
  addBox(staticGroup, ldW, 0.08, ldD, grateMat, ldCX, y2 - 0.04, ldCZ, true);
  // 2 Steel support columns down to ground
  addBox(staticGroup, 0.07, y2 + 0.22, 0.07, mat.darkIron, ld.minX + 0.05, (y2 - 0.34) / 2, ld.minZ + 0.05, true);
  addBox(staticGroup, 0.07, y2 + 0.22, 0.07, mat.darkIron, ld.maxX - 0.05, (y2 - 0.34) / 2, ld.minZ + 0.05, true);
  addCollider(1, ld.minX, ld.minZ, ld.minX + 0.12, ld.minZ + 0.12);
  addCollider(1, ld.maxX - 0.12, ld.minZ, ld.maxX, ld.minZ + 0.12);

  // 2F Landing Industrial Steel Guardrails (North, West, East sides, mitered cleanly)
  const lrH = 1.04;
  const lrPostH = lrH - 0.022;
  addBox(staticGroup, ldW, 0.038, 0.038, mat.darkIron, ldCX, y2 + lrH, ld.minZ + 0.02, false);
  addBox(staticGroup, ldW - 0.06, 0.025, 0.025, mat.darkIron, ldCX, y2 + lrH * 0.52, ld.minZ + 0.02, false);
  addBox(staticGroup, 0.038, 0.038, ldD - 0.04, mat.darkIron, ld.minX + 0.02, y2 + lrH, ldCZ + 0.02, false);
  addBox(staticGroup, 0.038, 0.038, ldD - 0.04, mat.darkIron, ld.maxX - 0.02, y2 + lrH, ldCZ + 0.02, false);
  [[ld.minX + 0.02, ld.minZ + 0.02], [ldCX, ld.minZ + 0.02], [ld.maxX - 0.02, ld.minZ + 0.02], [ld.minX + 0.02, ld.maxZ - 0.04]].forEach(([px, pz]) => {
    addBox(staticGroup, 0.036, lrPostH, 0.036, mat.darkIron, px, y2 + lrPostH / 2, pz, false);
  });
  // Safety colliders around 2F landing (leave stair top entry X=8.60..9.40 at Z=ld.maxZ completely open!)
  addCollider(2, ld.minX - 0.06, ld.minZ - 0.06, ld.maxX + 0.06, ld.minZ + 0.04);
  addCollider(2, ld.minX - 0.06, ld.minZ, ld.minX + 0.04, ld.maxZ + 0.04);
  addCollider(2, ld.maxX - 0.04, ld.minZ, ld.maxX + 0.06, ld.maxZ + 0.04);

  // =========================================================================
  // 4. INTERIOR INDUSTRIAL SHELVES, CRATES & CAGED BULKHEAD LIGHTS (4 ROOMS)
  // =========================================================================
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x5c636b, roughness: 0.48, metalness: 0.62 });
  const shelfDeckMat = new THREE.MeshStandardMaterial({ color: 0x737a82, roughness: 0.58, metalness: 0.42 });
  const crateMat = makeSurfaceMat('crate_wood', 0.45, 0.45);
  const cartonMat = new THREE.MeshStandardMaterial({ color: 0x8f7758, roughness: 0.88, metalness: 0.02 });
  const dimBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b8,
    emissive: new THREE.Color(0xffb466),
    emissiveIntensity: 1.45,
    roughness: 0.35,
  });

  function addCompactStorageShelf(fIdx, baseY, lcx, lcz, seedIdx) {
    // Compact 3-tier industrial steel shelf along East wall (W 0.28 × D 0.68 × H 1.56m)
    const rw = 0.28, rd = 0.68, rh = 1.56;
    const cx = wx(lcx), cz = wz(lcz);
    [[-0.12, -0.32], [0.12, -0.32], [-0.12, 0.32], [0.12, 0.32]].forEach(([dx, dz]) => {
      addBox(furnitureGroup, 0.024, rh, 0.024, steelMat, cx + dx, baseY + rh / 2, cz + dz, false);
    });
    [0.18, 0.72, 1.28].forEach((sy, lvl) => {
      addBox(furnitureGroup, rw, 0.024, rd, shelfDeckMat, cx, baseY + sy, cz, false);
      addBox(furnitureGroup, 0.20, 0.22, 0.24, (lvl + seedIdx) % 2 === 0 ? crateMat : cartonMat, cx, baseY + sy + 0.12, cz - 0.15, false);
      addBox(furnitureGroup, 0.20, 0.18, 0.22, (lvl + seedIdx) % 2 === 1 ? crateMat : cartonMat, cx, baseY + sy + 0.10, cz + 0.16, false);
    });
    addCollider(fIdx, cx - rw / 2 - 0.02, cz - rd / 2 - 0.02, cx + rw / 2 + 0.02, cz + rd / 2 + 0.02);
  }

  // Furnish ALL 4 Concrete Rooms (S101, S102 on 1F; S201, S202 on 2F)
  addCompactStorageShelf(1, 0.00, 1.72, 0.53, 0); // Room 1 (S101)
  addCompactStorageShelf(1, 0.00, 1.72, 1.47, 1); // Room 2 (S102)
  addCompactStorageShelf(2, y2,   1.72, 0.53, 2); // Room 3 (S201)
  addCompactStorageShelf(2, y2,   1.72, 1.47, 3); // Room 4 (S202)

  // Low ceiling caged industrial bulkhead fixtures in all 4 concrete rooms + 2 exterior doorway sconces
  [[0.00, 0.53], [0.00, 1.47], [y2, 0.53], [y2, 1.47]].forEach(([by, lz]) => {
    addBox(furnitureGroup, 0.20, 0.05, 0.12, mat.darkIron, wx(0.95), by + 1.89, wz(lz), false);
    addBox(furnitureGroup, 0.14, 0.04, 0.09, dimBulbMat, wx(0.95), by + 1.86, wz(lz), false);
  });
  // Exterior wall caged lights above DS-1 (West wall) & DS-2 (North 2F landing)
  addBox(exteriorGroup, 0.08, 0.16, 0.12, dimBulbMat, wx(-0.04), 1.80, wz(0.54), false);
  addBox(exteriorGroup, 0.12, 0.16, 0.08, dimBulbMat, wx(0.92), y2 + 1.80, wz(-0.04), false);

  // =========================================================================
  // 5. CONCRETE WAREHOUSE LIGHTING (building='storage' for strict POCO F7 budget!)
  // =========================================================================
  const tagStorage = (lightObj) => {
    lightObj.userData.building = 'storage';
    lightObj.intensity = 0;
    lightObj.visible = false;
    return lightObj;
  };
  tagStorage(addLight('Storage_1F_North', 1, 'main', 0xd6cfc2, 1.10, 4.2, wx(0.95), 1.70, wz(0.53)));
  tagStorage(addLight('Storage_1F_South', 1, 'main', 0xc9c2b6, 1.05, 4.2, wx(0.95), 1.70, wz(1.47)));
  tagStorage(addLight('Storage_Ext_Glow', 1, 'exterior', 0xffbe72, 1.45, 6.2, wx(-0.45), 1.80, wz(0.54)));
  tagStorage(addLight('Storage_2F_North', 2, 'main', 0xd6cfc2, 1.10, 4.2, wx(0.95), y2 + 1.70, wz(0.53)));
  tagStorage(addLight('Storage_2F_South', 2, 'main', 0xc9c2b6, 1.05, 4.2, wx(0.95), y2 + 1.70, wz(1.47)));
  tagStorage(addLight('Storage_2F_Land',  2, 'exterior', 0xffbe72, 1.35, 5.8, wx(1.25), y2 + 1.75, wz(-0.55)));
}
