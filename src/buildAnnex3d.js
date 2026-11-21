import * as THREE from 'three';
import { ANNEX, ANNEX_FLOORS } from './planData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';

/**
 * Builds the Neighboring 5m × 8m 2-Story House ("ANNEX-40 / 森の離れ")
 * positioned 2.60m West of the Main Tower (World X = -7.60..-2.60, Z = 1.00..9.00),
 * connected via a lantern-lit mossy stepping-stone courtyard path, 100% walkable on 1F & 2F.
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
  // Foundation plinth top at Y=-0.11 so sunken Genkan floor (Y=-0.10) sits cleanly with zero z-fighting
  const cisternMat = makeSurfaceMat('stone_cistern_grey', 5.2, 0.34);
  const mossPlinthMat = makeSurfaceMat('stone_moss_wall', 8.2, 0.34);
  addBox(staticGroup, 5.14, 0.28, 8.14, cisternMat, wx(2.50), -0.25, wz(4.00), true);
  // Concrete sub-slab (Y=-0.11..0.00) beneath non-genkan 1F floor regions
  addBox(staticGroup, 2.75, 0.11, 7.80, cisternMat, wx(1.48), -0.055, wz(4.00), false);
  addBox(staticGroup, 2.15, 0.11, 6.25, cisternMat, wx(3.90), -0.055, wz(4.80), false);
  addBox(staticGroup, 0.06, 0.32, 8.16, mossPlinthMat, wx(-0.07), -0.22, wz(4.00), false);
  addBox(staticGroup, 0.06, 0.32, 8.16, mossPlinthMat, wx(5.07), -0.22, wz(4.00), false);

  // Annex North Entry Porch Slab & Dark Iron Awning Canopy (aligned with DA-1 at lx=3.45..4.35, wz=1.00)
  addBox(exteriorGroup, 2.10, 0.14, 1.15, makeSurfaceMat('paver_granite_grid', 2.1, 1.15), wx(3.90), -0.22, wz(-0.55), true);
  addBox(exteriorGroup, 2.20, 0.08, 1.05, mat.darkIron, wx(3.90), 2.42, wz(-0.50), true);

  // Connecting Mossy Stepping-Stone Garden Path between Main North Porch (X=1.10, Z=-0.62) and Annex North Porch (X=-3.70, Z=0.45)!
  const mossPathMat = makeSurfaceMat('paver_moss_stones', 6.0, 1.5);
  addBox(exteriorGroup, 5.40, 0.10, 1.35, mossPathMat, -1.35, -0.30, -0.45, false);
  // Courtyard stepping path running South down the 2.60m alley between the two houses!
  addBox(exteriorGroup, 1.35, 0.08, 8.60, mossPathMat, -1.30, -0.31, 4.40, false);

  // Two Traditional Glowing Japanese Stone Garden Lanterns (石灯籠) guiding the courtyard path!
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
  // 2. ANNEX SLABS, FLOORS, WALLS, STAIRCASE (STA1) & SHED ROOF (片流れ屋根)
  // =========================================================================
  function addAnnexFloorPatch(lx1, lz1, lx2, lz2, y, texName, extra = {}) {
    const w = lx2 - lx1;
    const d = lz2 - lz1;
    const m = makeSurfaceMat(texName, w, d, extra);
    addBox(staticGroup, w, 0.016, d, m, wx((lx1 + lx2) / 2), y + 0.008, wz((lz1 + lz2) / 2), false);
  }

  // Annex 1F Floors (Y = 0.00)
  addAnnexFloorPatch(2.85, 0.15, 4.85, 1.65, -0.10, 'paver_granite_grid'); // Genkan Doma
  addBox(staticGroup, 0.08, 0.11, 1.50, mat.oak, wx(2.83), -0.045, wz(0.90), false); // Agari-kamachi step
  addAnnexFloorPatch(0.15, 0.15, 2.85, 2.15, 0.0, 'terrazzo_white');       // North Atelier
  addAnnexFloorPatch(2.85, 1.75, 4.85, 3.95, 0.0, 'tile_checker_stone');   // Wet Bath/WC
  addAnnexFloorPatch(1.25, 2.15, 2.85, 4.95, 0.0, 'wood_walnut_floor');    // Gallery
  addAnnexFloorPatch(0.15, 4.95, 4.85, 7.85, 0.0, 'wood_walnut_floor');    // Cafe LDK
  addAnnexFloorPatch(0.15, 2.25, 1.15, 4.95, 0.0, 'concrete_clean');       // Under stair

  // Annex 2F Slotted Structural Slab (Y = 2.50..2.75) leaving EXACT stair cutout lx=0.15..1.15, lz=2.25..4.95
  const sb = ANNEX.stairLocal;
  const subMat = mat.wallCutCap;
  const ceil1Mat = makeSurfaceMat('ceiling_acoustic', 4.7, 4.5, { roughness: 0.90 });
  [
    { x1: 0.0, x2: 5.0, z1: 0.0, z2: sb.topZ },
    { x1: 0.0, x2: 5.0, z1: sb.bottomZ, z2: 8.0 },
    { x1: sb.maxX, x2: 5.0, z1: sb.topZ, z2: sb.bottomZ },
    { x1: 0.0, x2: sb.minX, z1: sb.topZ, z2: sb.bottomZ },
  ].forEach((r) => {
    const w = r.x2 - r.x1;
    const d = r.z2 - r.z1;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.25, d),
      [subMat, subMat, subMat, ceil1Mat, subMat, subMat],
    );
    mesh.position.set(wx((r.x1 + r.x2) / 2), 2.625, wz((r.z1 + r.z2) / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    staticGroup.add(mesh);
  });
  // Dark iron exterior belt band between Annex 1F & 2F
  addBox(staticGroup, 5.08, 0.18, 0.04, mat.darkIron, wx(2.5), 2.625, wz(-0.02), false);
  addBox(staticGroup, 5.08, 0.18, 0.04, mat.darkIron, wx(2.5), 2.625, wz(8.02), false);
  addBox(staticGroup, 0.04, 0.18, 8.08, mat.darkIron, wx(-0.02), 2.625, wz(4.0), false);
  addBox(staticGroup, 0.04, 0.18, 8.08, mat.darkIron, wx(5.02), 2.625, wz(4.0), false);

  // Annex 2F Floors (Y = 2.75)
  const y2 = 2.75;
  addAnnexFloorPatch(0.15, 0.15, 4.85, 2.25, y2, 'parquet_oak');       // North Library Hall
  addAnnexFloorPatch(1.20, 2.25, 2.45, 5.05, y2, 'parquet_oak');       // Corridor
  addAnnexFloorPatch(2.55, 2.35, 4.85, 5.05, y2, 'tatami_ryukyu');     // Tatami Guest Room
  addAnnexFloorPatch(0.15, 5.15, 4.85, 7.85, y2, 'wood_floor');        // South Master Bedroom

  // Annex 2F Ceiling & Modern Japanese Shed Roof (片流れ屋根: West Y=5.45m -> East Y=6.35m)
  const ceil2Mat = makeSurfaceMat('wood_planks_dark', 4.8, 7.8, { roughness: 0.72 });
  addBox(staticGroup, 5.00, 0.20, 8.00, ceil2Mat, wx(2.50), 5.35, wz(4.00), false);

  // Sloped exterior shed roof plane (charcoal slate) with 0.45m eaves overhang!
  const roofRise = ANNEX.ridgeEastY - ANNEX.eaveWestY; // 0.90m over 5.0m (slope 0.18)
  const shedAngle = Math.atan2(roofRise, 5.0);
  const shedSpan = 5.90 / Math.cos(shedAngle);
  const shedRoofMat = makeSurfaceMat('slate_charcoal', shedSpan, 8.90, { roughness: 0.64 });
  const shedMesh = new THREE.Mesh(new THREE.BoxGeometry(shedSpan, 0.16, 8.90), shedRoofMat);
  shedMesh.position.set(wx(2.50), (ANNEX.eaveWestY + ANNEX.ridgeEastY) / 2 + 0.06, wz(4.00));
  shedMesh.rotation.z = shedAngle; // Higher on East (+X), lower on West (-X)
  shedMesh.castShadow = true;
  shedMesh.receiveShadow = true;
  staticGroup.add(shedMesh);

  // East Clerestory Fascia Fill & North/South Triangular Shed Spandrels
  addBox(staticGroup, 0.15, roofRise, 8.00, makeSurfaceMat('yakisugi_deep', 8.0, roofRise), wx(4.925), ANNEX.eaveWestY + roofRise / 2, wz(4.00), true);
  const triShape = new THREE.Shape();
  triShape.moveTo(0, ANNEX.eaveWestY + 0.002);
  triShape.lineTo(5.0, ANNEX.eaveWestY + 0.002);
  triShape.lineTo(5.0, ANNEX.ridgeEastY);
  triShape.closePath();
  const yakiMat = makeSurfaceMat('yakisugi_deep', 1.0, 1.0);
  const yakiBack = yakiMat.clone();
  yakiBack.side = THREE.BackSide;
  // South & North shed roof triangular gable spandrels with world-consistent UV scale
  const triGeoS = new THREE.ShapeGeometry(triShape);
  const triUV = triGeoS.attributes.uv;
  for (let i = 0; i < triUV.count; i++) {
    triUV.setXY(i, triUV.getX(i) * 0.55, (triUV.getY(i) - ANNEX.eaveWestY) * 0.55);
  }
  const sSpandrel = new THREE.Mesh(triGeoS, yakiMat);
  sSpandrel.position.set(ox, 0, wz(8.00));
  staticGroup.add(sSpandrel);
  const nSpandrel = new THREE.Mesh(triGeoS.clone(), yakiBack);
  nSpandrel.position.set(ox, 0, wz(0.00));
  staticGroup.add(nSpandrel);

  // Exterior corner pilasters
  [[0.02, 0.02], [4.98, 0.02], [0.02, 7.98], [4.98, 7.98]].forEach(([lx, lz]) => {
    const h = lx > 2.5 ? ANNEX.ridgeEastY : ANNEX.eaveWestY;
    addBox(staticGroup, 0.10, h, 0.10, mat.darkIron, wx(lx), h / 2, wz(lz), false);
  });

  // Build Annex 1F & Annex 2F Walls/Doors/Windows translated into World Coordinates
  function buildAnnexFloorWalls(annexFloor) {
    const fIdx = annexFloor.physicalFloor; // 1 for Annex 1F, 2 for Annex 2F
    const baseY = annexFloor.baseY;
    const wallH = annexFloor.slabTopY - baseY;

    for (const rawWall of annexFloor.walls) {
      if (rawWall.kind === 'railing') continue; // Built explicitly as architectural iron balusters below

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

  buildAnnexFloorWalls(ANNEX_FLOORS[0]);
  buildAnnexFloorWalls(ANNEX_FLOORS[1]);

  // Annex Staircase STA1 (1F 0.00 -> 2F 2.75, world X=-7.45..-6.45, Z=5.95 -> 3.25)
  const sw = ANNEX.stairWorld;
  const steps = sw.treads;
  const rise = 2.75 / steps;
  const run = (sw.bottomZ - sw.topZ) / steps;
  const treadMat = makeSurfaceMat('wood_floor', 0.96, 0.25, { roughness: 0.45 });
  const stairW = sw.maxX - sw.minX - 0.04;
  const centerX = (sw.minX + sw.maxX) / 2;
  for (let i = 0; i < steps; i++) {
    const sy = (i + 1) * rise;
    const sz = sw.bottomZ - (i + 0.5) * run;
    addBox(staticGroup, stairW, 0.045, run + 0.03, treadMat, centerX, sy - 0.022, sz, true);
    addBox(staticGroup, stairW - 0.04, rise * 0.46, 0.02, mat.darkIron, centerX, sy - rise * 0.25, sz + run / 2, false);
  }
  const slopeLen = Math.hypot(sw.bottomZ - sw.topZ, 2.75);
  const pitchAngle = Math.atan2(2.75, sw.bottomZ - sw.topZ);
  const midZ = (sw.bottomZ + sw.topZ) / 2;
  [sw.minX + 0.03, sw.maxX - 0.03].forEach((sx) => {
    const str = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, slopeLen), mat.darkIron);
    str.position.set(sx, 1.30, midZ);
    str.rotation.x = pitchAngle;
    staticGroup.add(str);
  });
  const aRail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, slopeLen), mat.oak);
  aRail.position.set(sw.maxX - 0.045, 2.25, midZ);
  aRail.rotation.x = pitchAngle;
  staticGroup.add(aRail);
  const aLed = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.024, slopeLen * 0.92), new THREE.MeshBasicMaterial({ color: 0xffc67c }));
  aLed.position.set(sw.minX + 0.012, 1.60, midZ);
  aLed.rotation.x = pitchAngle;
  staticGroup.add(aLed);

  // Annex 2F Stairwell Iron & Oak Safety Guardrail
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.darkIron, wx(1.18), y2 + 0.96, wz(3.62), false);
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.oak, wx(1.18), y2 + 1.00, wz(3.62), false);
  addBox(staticGroup, 1.06, 0.05, 0.05, mat.darkIron, wx(0.68), y2 + 0.96, wz(4.98), false);
  addBox(staticGroup, 1.06, 0.05, 0.05, mat.oak, wx(0.68), y2 + 1.00, wz(4.98), false);
  for (let lz = 2.30; lz <= 4.98; lz += 0.22) {
    addBox(staticGroup, 0.022, 0.96, 0.022, mat.darkIron, wx(1.18), y2 + 0.48, wz(lz), false);
  }
  for (let lx = 0.22; lx <= 1.18; lx += 0.22) {
    addBox(staticGroup, 0.022, 0.96, 0.022, mat.darkIron, wx(lx), y2 + 0.48, wz(4.98), false);
  }
  addCollider(2, wx(1.14), wz(2.25), wx(1.24), wz(5.04));
  addCollider(2, wx(0.15), wz(4.94), wx(1.24), wz(5.04));

  // =========================================================================
  // 3. ANNEX 1F & 2F INTERIOR FURNISHINGS
  // =========================================================================
  const denimMat = makeSurfaceMat('fabric_denim', 0.55, 0.55);
  const crateMat = makeSurfaceMat('crate_wood', 0.55, 0.55);

  // --- Annex 1F ---
  // A101 Genkan: coir mat, floating shoe bench
  addBox(furnitureGroup, 0.68, 0.015, 0.46, makeFrontMat('doormat_coir', { roughness: 0.95 }), wx(3.90), -0.09, wz(0.50), false);
  addBox(furnitureGroup, 0.36, 0.52, 1.05, mat.oak, wx(4.64), 0.16, wz(0.95), true);
  addCollider(1, wx(4.42), wz(0.40), wx(4.85), wz(1.52));

  // A102 North Atelier: oak workbench, corkboard, timber crates
  addBox(furnitureGroup, 1.55, 0.045, 0.68, mat.oak, wx(1.25), 0.76, wz(0.54), true);
  addBox(furnitureGroup, 0.05, 0.74, 0.60, mat.darkIron, wx(0.55), 0.37, wz(0.54), false);
  addBox(furnitureGroup, 0.05, 0.74, 0.60, mat.darkIron, wx(1.95), 0.37, wz(0.54), false);
  addCollider(1, wx(0.45), wz(0.18), wx(2.05), wz(0.90));
  addBox(furnitureGroup, 0.03, 0.85, 1.15, makeSurfaceMat('cork_board', 1.15, 0.85), wx(0.18), 1.38, wz(1.25), false);
  addBox(furnitureGroup, 0.48, 0.48, 0.48, crateMat, wx(0.46), 0.24, wz(1.80), true);

  // A103 Wet Room (WC / Vanity / Shower)
  addBox(furnitureGroup, 0.95, 0.80, 0.48, makeFrontMat('furniture_vanity_base'), wx(3.55), 0.40, wz(2.02), true);
  addBox(furnitureGroup, 0.98, 0.04, 0.50, makeSurfaceMat('marble_white', 0.98, 0.50), wx(3.55), 0.82, wz(2.02), false);
  addBox(furnitureGroup, 0.82, 0.72, 0.03, mat.mirror, wx(3.55), 1.42, wz(1.78), false);
  addCollider(1, wx(3.04), wz(1.76), wx(4.06), wz(2.30));
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, wx(3.55), 0.21, wz(3.52), true);
  addCollider(1, wx(3.30), wz(3.18), wx(3.82), wz(3.90));
  addBox(furnitureGroup, 0.03, 1.55, 0.03, mat.chrome, wx(4.78), 1.25, wz(3.10), false); // Shower rail

  // A105 Cafe Living & Kitchen (X_local=0.15..4.85, Z_local=4.95..7.85)
  // East Compact Cafe Kitchen (lx=4.18..4.84, lz=4.12..6.55)
  addBox(staticGroup, 0.03, 1.35, 2.05, makeSurfaceMat('tile_caramel_brick', 2.05, 1.35), wx(4.83), 1.45, wz(5.15), false);
  addBox(furnitureGroup, 0.62, 0.84, 1.95, makeSurfaceMat('furniture_kitchen_cab', 1.95, 0.84), wx(4.52), 0.42, wz(5.15), true);
  addBox(furnitureGroup, 0.64, 0.04, 1.98, makeSurfaceMat('marble_white', 1.98, 0.64), wx(4.52), 0.86, wz(5.15), false);
  addCollider(1, wx(4.18), wz(4.14), wx(4.85), wz(6.16));
  // Dining Table & Meal
  addBox(furnitureGroup, 0.86, 0.04, 1.18, mat.oak, wx(2.85), 0.73, wz(5.85), true);
  [[-0.35, -0.48], [0.35, -0.48], [-0.35, 0.48], [0.35, 0.48]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.04, 0.71, 0.04, mat.darkIron, wx(2.85) + dx, 0.355, wz(5.85) + dz, false);
  });
  addBox(furnitureGroup, 0.46, 0.02, 0.34, makeFrontMat('meal_teishoku'), wx(2.85), 0.76, wz(5.85), false);
  addCollider(1, wx(2.38), wz(5.22), wx(3.32), wz(6.48));
  // 2P Denim Lounge Sofa along West Classic Red Brick Wall + Coffee Table (90cm clearance to STA1 bottom!)
  addBox(furnitureGroup, 0.76, 0.38, 1.56, denimMat, wx(0.62), 0.20, wz(6.68), true);
  addBox(furnitureGroup, 0.18, 0.68, 1.56, denimMat, wx(0.28), 0.42, wz(6.68), true);
  addCollider(1, wx(0.16), wz(5.86), wx(1.04), wz(7.50));
  addBox(furnitureGroup, 0.48, 0.035, 0.88, mat.walnut, wx(1.48), 0.36, wz(6.68), true);
  addCollider(1, wx(1.22), wz(6.22), wx(1.74), wz(7.14));
  addFramedArt(furnitureGroup, 'art_posters_trio', 0.92, 0.52, wx(0.18), 1.48, wz(6.68), Math.PI / 2);

  // Interactive Warm Cafe Floor Lamp in Annex 1F SW corner!
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
  // A201 North Library Hall: wood slats feature, twin oak bookcases, window bench
  addBox(staticGroup, 0.03, 2.40, 2.00, makeSurfaceMat('wood_slats', 2.0, 2.4), wx(4.83), y2 + 1.20, wz(1.15), false);
  addBox(furnitureGroup, 0.38, 1.88, 1.15, makeFrontMat('furniture_bookshelf'), wx(4.62), y2 + 0.94, wz(1.15), true);
  addCollider(2, wx(4.40), wz(0.55), wx(4.85), wz(1.75));
  addBox(furnitureGroup, 1.65, 0.42, 0.38, mat.oak, wx(2.50), y2 + 0.21, wz(0.38), true);
  addCollider(2, wx(1.65), wz(0.16), wx(3.35), wz(0.58));
  addFramedArt(furnitureGroup, 'art_poster_3', 0.46, 0.62, wx(0.18), y2 + 1.45, wz(1.15), Math.PI / 2);

  // A203 East Tatami Guest Room: walnut chabudai, crimson zabuton, folded rose futon
  addBox(furnitureGroup, 0.82, 0.04, 0.82, mat.walnut, wx(3.68), y2 + 0.33, wz(3.65), true);
  addBox(furnitureGroup, 0.64, 0.31, 0.64, mat.walnut, wx(3.68), y2 + 0.155, wz(3.65), false);
  addBox(furnitureGroup, 0.52, 0.07, 0.52, makeFrontMat('zabuton_red'), wx(3.68), y2 + 0.045, wz(2.96), false);
  addBox(furnitureGroup, 0.52, 0.07, 0.52, makeFrontMat('zabuton_red'), wx(3.68), y2 + 0.045, wz(4.34), false);
  addCollider(2, wx(3.24), wz(3.20), wx(4.12), wz(4.10));

  // A204 South Forest Master Bedroom: queen bed, bedside lamps, oak wardrobe, chest
  addBox(furnitureGroup, 2.05, 0.015, 2.15, makeSurfaceMat('carpet_beige', 2.05, 2.15), wx(2.60), y2 + 0.016, wz(6.50), false);
  addBox(furnitureGroup, 1.56, 0.25, 1.98, mat.walnut, wx(2.95), y2 + 0.125, wz(6.35), true);
  addBox(furnitureGroup, 1.50, 0.22, 1.92, makeSurfaceMat('fabric_floral_quilt', 1.50, 1.92), wx(2.95), y2 + 0.36, wz(6.35), true);
  addBox(furnitureGroup, 0.52, 0.13, 0.32, makeFrontMat('fabric_rose_vintage'), wx(2.60), y2 + 0.52, wz(5.58), false);
  addBox(furnitureGroup, 0.52, 0.13, 0.32, makeFrontMat('fabric_sakura'), wx(3.30), y2 + 0.52, wz(5.58), false);
  addCollider(2, wx(2.14), wz(5.32), wx(3.76), wz(7.38));
  [1.92, 3.98].forEach((lx) => {
    addBox(furnitureGroup, 0.38, 0.46, 0.38, mat.walnut, wx(lx), y2 + 0.23, wz(5.52), true);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.20, 10), mat.washiGlow);
    sh.position.set(wx(lx), y2 + 0.62, wz(5.52));
    furnitureGroup.add(sh);
  });
  addBox(furnitureGroup, 0.54, 1.98, 1.65, makeFrontMat('furniture_wardrobe'), wx(4.56), y2 + 0.99, wz(6.65), true);
  addCollider(2, wx(4.26), wz(5.80), wx(4.85), wz(7.50));

  // =========================================================================
  // 4. ANNEX LIGHTING (Tagged building='annex' for strict POCO F7 <= 6-7 light budget!)
  // =========================================================================
  const tagAnnex = (lightObj, building = 'annex') => {
    lightObj.userData.building = building;
    if (building === 'annex') {
      lightObj.intensity = 0;
      lightObj.visible = false;
    }
    return lightObj;
  };
  // Courtyard lantern & Annex porch glow (building='both' so it glows warmly across the forest courtyard!)
  tagAnnex(addLight('Annex_Porch_Lantern', 1, 'courtyard', 0xffb362, 1.95, 9.0, wx(3.90), 2.15, wz(-0.45)), 'both');
  // Annex 1F interior lights
  tagAnnex(addLight('Annex_1F_Atelier', 1, 'north', 0xffcfa0, 1.55, 6.4, wx(1.65), 2.10, wz(1.45)), 'annex');
  tagAnnex(addLight('Annex_1F_Wet', 1, 'mid', 0xdceeff, 1.35, 5.2, wx(3.85), 2.05, wz(2.85)), 'annex');
  tagAnnex(addLight('Annex_1F_Dining', 1, 'south', 0xffbe72, 2.05, 7.5, wx(3.15), 1.85, wz(5.95)), 'annex');
  // Annex 2F interior lights
  tagAnnex(addLight('Annex_2F_Library', 2, 'north', 0xffc98e, 1.85, 7.0, wx(2.45), y2 + 2.05, wz(1.35)), 'annex');
  tagAnnex(addLight('Annex_2F_Tatami', 2, 'mid', 0xffb86c, 1.75, 6.0, wx(3.65), y2 + 1.85, wz(3.65)), 'annex');
  tagAnnex(addLight('Annex_2F_Master', 2, 'south', 0xffb46b, 2.15, 7.5, wx(2.65), y2 + 1.85, wz(6.45)), 'annex');
}
