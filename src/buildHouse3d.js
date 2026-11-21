import * as THREE from 'three';
import { FLOORS, HOUSE, COLUMNS, getAtticCeilingY } from './planData.js';
import { makeSurfaceMat, makeFrontMat, createSharedMaterials } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';
import { injectForestWindShader } from './volumetricAtmosphere.js';

export function buildHouse3D(scene) {
  const mat = createSharedMaterials();

  const root = new THREE.Group();
  root.name = 'Narrow50TowerRoot';
  scene.add(root);

  const staticGroup = new THREE.Group();
  staticGroup.name = 'StaticArchitecture';
  root.add(staticGroup);

  const furnitureGroup = new THREE.Group();
  furnitureGroup.name = 'FurnitureAndProps';
  root.add(furnitureGroup);

  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'InteractiveDoorsAndProps';
  root.add(dynamicGroup);

  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'DeepForestExterior';
  root.add(exteriorGroup);

  const collidersByFloor = [[], [], [], []];
  const treeColliders = [];
  const interactiveDoors = [];
  const interactiveProps = [];
  const interiorLights = [];
  const excludeBatch = new Set();

  function addCollider(floorIdx, minX, minZ, maxX, maxZ) {
    if (floorIdx < 0 || floorIdx > 3) return;
    collidersByFloor[floorIdx].push({
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
    });
  }

  function addBox(parent, w, h, d, material, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addWallBox(parent, w, h, d, x, y, z, frontTex, backTex, axis) {
    const cap = mat.wallCutCap;
    let mats;
    if (axis === 'h') {
      const mNorth = makeSurfaceMat(frontTex, w, h);
      const mSouth = makeSurfaceMat(backTex || frontTex, w, h);
      mats = [cap, cap, cap, cap, mSouth, mNorth];
    } else {
      const mWest = makeSurfaceMat(frontTex, d, h);
      const mEast = makeSurfaceMat(backTex || frontTex, d, h);
      mats = [mEast, mWest, cap, cap, cap, cap];
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addLight(name, floor, zone, color, intensity, distance, x, y, z) {
    const startActive = floor === 0;
    const light = new THREE.PointLight(color, startActive ? intensity : 0, distance, 1.85);
    light.position.set(x, y, z);
    light.castShadow = false;
    light.visible = startActive;
    root.add(light);
    interiorLights.push({ name, floor, zone, light, baseInt: intensity });
    return light;
  }

  function addInteractiveDoor(floorIdx, op, wall, baseY) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const sillY = baseY + (op.sill || 0);
    const doorH = op.height;
    const doorW = op.width;

    const frameMat = op.tex === 'door_navy' ? mat.darkIron : (op.tex === 'door_white' ? mat.creamTrim : mat.walnut);
    const jambT = 0.032;
    if (isH) {
      addBox(staticGroup, jambT, doorH, thick + 0.014, frameMat, op.pos + jambT / 2, sillY + doorH / 2, centerOrtho, false);
      addBox(staticGroup, jambT, doorH, thick + 0.014, frameMat, op.pos + doorW - jambT / 2, sillY + doorH / 2, centerOrtho, false);
      addBox(staticGroup, doorW, jambT, thick + 0.016, frameMat, op.pos + doorW / 2, sillY + doorH - jambT / 2, centerOrtho, false);
    } else {
      addBox(staticGroup, thick + 0.014, doorH, jambT, frameMat, centerOrtho, sillY + doorH / 2, op.pos + jambT / 2, false);
      addBox(staticGroup, thick + 0.014, doorH, jambT, frameMat, centerOrtho, sillY + doorH / 2, op.pos + doorW - jambT / 2, false);
      addBox(staticGroup, thick + 0.016, jambT, doorW, frameMat, centerOrtho, sillY + doorH - jambT / 2, op.pos + doorW / 2, false);
    }

    const panelW = doorW - 0.05;
    const panelH = doorH - 0.03;
    const panelT = 0.038;
    const panelMat = op.tex === 'shoji_grid'
      ? makeSurfaceMat('shoji_grid', panelW, panelH, { clamp: true, roughness: 0.72 })
      : makeFrontMat(op.tex || 'door_oak', { roughness: 0.44 });
    const edgeMat = frameMat;

    const pivot = new THREE.Group();
    dynamicGroup.add(pivot);

    let mesh;
    let entry;

    if (op.type === 'door_swing') {
      const hingeAtStart = op.hinge !== 'right';
      const hingeCoord = hingeAtStart ? op.pos + 0.025 : op.pos + doorW - 0.025;
      const offset = hingeAtStart ? panelW / 2 : -panelW / 2;

      if (isH) {
        pivot.position.set(hingeCoord, sillY, centerOrtho);
        const geo = new THREE.BoxGeometry(panelW, panelH, panelT);
        mesh = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, panelMat, panelMat]);
        mesh.position.set(offset, panelH / 2, 0);
        // Handle
        const hX = hingeAtStart ? panelW - 0.11 : -panelW + 0.11;
        const hMat = op.tex === 'door_navy' ? mat.bronze : mat.chrome;
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.08), hMat);
        h1.position.set(hX, 0.96, 0);
        pivot.add(h1);
      } else {
        pivot.position.set(centerOrtho, sillY, hingeCoord);
        const geo = new THREE.BoxGeometry(panelT, panelH, panelW);
        mesh = new THREE.Mesh(geo, [panelMat, panelMat, edgeMat, edgeMat, edgeMat, edgeMat]);
        mesh.position.set(0, panelH / 2, offset);
        const hZ = hingeAtStart ? panelW - 0.11 : -panelW + 0.11;
        const hMat = mat.chrome;
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.11), hMat);
        h1.position.set(0, 0.96, hZ);
        pivot.add(h1);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.doorId = op.id;
      pivot.add(mesh);

      const openAngle = (op.swingDir || 1) * (hingeAtStart ? -1.42 : 1.42);
      const collider = isH
        ? { minX: op.pos, maxX: op.pos + doorW, minZ: wall.z1 - 0.02, maxZ: wall.z2 + 0.02 }
        : { minX: wall.x1 - 0.02, maxX: wall.x2 + 0.02, minZ: op.pos, maxZ: op.pos + doorW };
      entry = { id: op.id, floor: floorIdx, label: op.label, kind: 'swing', pivot, mesh, openAngle, isOpen: false, progress: 0, collider };
    } else {
      // Pocket / sliding door
      if (isH) {
        pivot.position.set(op.pos + doorW / 2, sillY, centerOrtho);
        const geo = new THREE.BoxGeometry(panelW, panelH, panelT);
        mesh = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, panelMat, panelMat]);
        mesh.position.set(0, panelH / 2, 0);
      } else {
        pivot.position.set(centerOrtho, sillY, op.pos + doorW / 2);
        const geo = new THREE.BoxGeometry(panelT, panelH, panelW);
        mesh = new THREE.Mesh(geo, [panelMat, panelMat, edgeMat, edgeMat, edgeMat, edgeMat]);
        mesh.position.set(0, panelH / 2, 0);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.doorId = op.id;
      pivot.add(mesh);

      const slideDelta = (op.slideDir || 1) * (doorW - 0.08);
      const collider = isH
        ? { minX: op.pos, maxX: op.pos + doorW, minZ: wall.z1 - 0.02, maxZ: wall.z2 + 0.02 }
        : { minX: wall.x1 - 0.02, maxX: wall.x2 + 0.02, minZ: op.pos, maxZ: op.pos + doorW };
      entry = {
        id: op.id, floor: floorIdx, label: op.label, kind: 'pocket',
        axis: isH ? 'x' : 'z',
        closedPos: pivot.position.clone(),
        slideDelta, pivot, mesh, isOpen: false, progress: 0, collider,
      };
    }

    excludeBatch.add(mesh);
    interactiveDoors.push(entry);
  }

  function addWindowFrame(op, wall, baseY) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const w = op.width;
    const h = op.height;
    const sillY = baseY + (op.sill || 0.8);
    const frameT = 0.036;
    const sashMat = mat.darkIron;
    const glassMat = op.type === 'window_frosted' ? mat.glassFrosted : mat.glassClear;

    if (isH) {
      addBox(staticGroup, w, frameT, thick + 0.015, sashMat, op.pos + w / 2, sillY + frameT / 2, centerOrtho, false);
      addBox(staticGroup, w, frameT, thick + 0.015, sashMat, op.pos + w / 2, sillY + h - frameT / 2, centerOrtho, false);
      addBox(staticGroup, frameT, h, thick + 0.015, sashMat, op.pos + frameT / 2, sillY + h / 2, centerOrtho, false);
      addBox(staticGroup, frameT, h, thick + 0.015, sashMat, op.pos + w - frameT / 2, sillY + h / 2, centerOrtho, false);
      if (w >= 1.3) {
        addBox(staticGroup, 0.028, h, thick * 0.65, sashMat, op.pos + w / 2, sillY + h / 2, centerOrtho, false);
      }
      const gMesh = addBox(dynamicGroup, w - 0.06, h - 0.06, 0.014, glassMat, op.pos + w / 2, sillY + h / 2, centerOrtho, false);
      gMesh.userData.noBatch = true;
    } else {
      addBox(staticGroup, thick + 0.015, frameT, w, sashMat, centerOrtho, sillY + frameT / 2, op.pos + w / 2, false);
      addBox(staticGroup, thick + 0.015, frameT, w, sashMat, centerOrtho, sillY + h - frameT / 2, op.pos + w / 2, false);
      addBox(staticGroup, thick + 0.015, h, frameT, sashMat, centerOrtho, sillY + h / 2, op.pos + frameT / 2, false);
      addBox(staticGroup, thick + 0.015, h, frameT, sashMat, centerOrtho, sillY + h / 2, op.pos + w - frameT / 2, false);
      if (w >= 1.2) {
        addBox(staticGroup, thick * 0.65, h, 0.028, sashMat, centerOrtho, sillY + h / 2, op.pos + w / 2, false);
      }
      const gMesh = addBox(dynamicGroup, 0.014, h - 0.06, w - 0.06, glassMat, centerOrtho, sillY + h / 2, op.pos + w / 2, false);
      gMesh.userData.noBatch = true;
    }
  }

  function buildStandardFloorWalls(floorDef) {
    const fIdx = floorDef.index;
    const baseY = floorDef.baseY;
    const wallH = floorDef.slabTopY - baseY; // full floor-to-slab structural height

    for (const wall of floorDef.walls) {
      const isH = wall.axis === 'h';
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;

      const isMinSide = isH ? wall.z1 < 0.2 : wall.x1 < 0.2;
      const frontTex = wall.kind === 'ext'
        ? (isMinSide ? wall.extTex : wall.intTex)
        : wall.texA;
      const backTex = wall.kind === 'ext'
        ? (isMinSide ? wall.intTex : wall.extTex)
        : wall.texB;

      const ops = [...(wall.openings || [])].sort((a, b) => a.pos - b.pos);
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

        // Sill wall below window
        if (opSill > 0.02) {
          if (isH) {
            addWallBox(staticGroup, op.width, opSill, thick, opMid, baseY + opSill / 2, centerOrtho, frontTex, backTex, 'h');
            addCollider(fIdx, op.pos, wall.z1, op.pos + op.width, wall.z2);
          } else {
            addWallBox(staticGroup, thick, opSill, op.width, centerOrtho, baseY + opSill / 2, opMid, frontTex, backTex, 'v');
            addCollider(fIdx, wall.x1, op.pos, wall.x2, op.pos + op.width);
          }
        } else if (op.type.startsWith('window')) {
          // Full-height terrace window still blocks walking through glass
          if (isH) addCollider(fIdx, op.pos, wall.z1, op.pos + op.width, wall.z2);
          else addCollider(fIdx, wall.x1, op.pos, wall.x2, op.pos + op.width);
        }

        // Lintel header above opening
        if (opTop < wallH - 0.01) {
          const headH = wallH - opTop;
          if (isH) {
            addWallBox(staticGroup, op.width, headH, thick, opMid, baseY + opTop + headH / 2, centerOrtho, frontTex, backTex, 'h');
          } else {
            addWallBox(staticGroup, thick, headH, op.width, centerOrtho, baseY + opTop + headH / 2, opMid, frontTex, backTex, 'v');
          }
        }

        if (op.type.startsWith('door')) {
          addInteractiveDoor(fIdx, op, wall, baseY);
        } else {
          addWindowFrame(op, wall, baseY);
        }

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

  // =========================================================================
  // 1. STRUCTURAL SLABS WITH EXACT STAIRWELL CUTOUTS (1F, 2F, 3F, ATTIC)
  // =========================================================================
  // Stone cistern / mossy plinth foundation under 1F
  const plinthMat = makeSurfaceMat('stone_cistern_grey', 5.2, 0.45);
  addBox(staticGroup, 5.16, 0.38, 10.16, plinthMat, 2.5, -0.22, 5.0, true);
  // Mossy stone side skirting strips around base
  const mossPlinthMat = makeSurfaceMat('stone_moss_wall', 10.2, 0.34);
  addBox(staticGroup, 0.05, 0.32, 10.18, mossPlinthMat, -0.07, -0.22, 5.0, false);
  addBox(staticGroup, 0.05, 0.32, 10.18, mossPlinthMat, 5.07, -0.22, 5.0, false);

  // Build structural floor-ceiling slabs for 2F, 3F, and Attic leaving exact stair hole X=0.15..1.15, Z=2.45..5.15
  function addSlottedSlab(slabBottomY, slabTopY, ceilTex) {
    const h = slabTopY - slabBottomY;
    const midY = slabBottomY + h / 2;
    const sb = HOUSE.stairBox;
    const subMat = mat.wallCutCap;
    const cMat = makeSurfaceMat(ceilTex, 4.7, 4.5, { roughness: 0.90 });

    const rects = [
      // North slab
      { x1: 0.0, x2: 5.0, z1: 0.0, z2: sb.topZ },
      // South slab
      { x1: 0.0, x2: 5.0, z1: sb.bottomZ, z2: 10.0 },
      // East of stairwell
      { x1: sb.maxX, x2: 5.0, z1: sb.topZ, z2: sb.bottomZ },
      // West rim of stairwell
      { x1: 0.0, x2: sb.minX, z1: sb.topZ, z2: sb.bottomZ },
    ];
    for (const r of rects) {
      const w = r.x2 - r.x1;
      const d = r.z2 - r.z1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        [subMat, subMat, subMat, cMat, subMat, subMat],
      );
      mesh.position.set((r.x1 + r.x2) / 2, midY, (r.z1 + r.z2) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      staticGroup.add(mesh);
    }
    // Exterior slab fascia band in dark charcoal iron so 3-story floor lines look architectural outside
    addBox(staticGroup, 5.08, h * 0.72, 0.04, mat.darkIron, 2.5, midY, -0.02, false);
    addBox(staticGroup, 5.08, h * 0.72, 0.04, mat.darkIron, 2.5, midY, 10.02, false);
    addBox(staticGroup, 0.04, h * 0.72, 10.08, mat.darkIron, -0.02, midY, 5.0, false);
    addBox(staticGroup, 0.04, h * 0.72, 10.08, mat.darkIron, 5.02, midY, 5.0, false);
  }

  addSlottedSlab(2.50, 2.75, 'ceiling_acoustic'); // 1F ceiling / 2F floor
  addSlottedSlab(5.25, 5.50, 'wallpaper_white');  // 2F ceiling / 3F floor
  addSlottedSlab(7.95, 8.15, 'wood_planks_dark'); // 3F ceiling / Attic floor

  // Helper to lay thin room floor surface finish
  function addFloorPatch(x1, z1, x2, z2, y, texName, extra = {}) {
    const w = x2 - x1;
    const d = z2 - z1;
    const m = makeSurfaceMat(texName, w, d, extra);
    addBox(staticGroup, w, 0.016, d, m, (x1 + x2) / 2, y + 0.008, (z1 + z2) / 2, false);
  }

  // =========================================================================
  // 2. FLOOR FINISHES & WALLS FOR 1F, 2F, 3F
  // =========================================================================
  // 1F Floors
  addFloorPatch(0.15, 0.15, 2.15, 1.35, -0.12, 'terrazzo_white');
  addBox(staticGroup, 2.00, 0.13, 0.08, mat.oak, 1.15, -0.055, 1.35, false); // Agari-kamachi step
  addFloorPatch(0.15, 1.35, 2.15, 2.45, 0.0, 'wood_floor');
  addFloorPatch(1.25, 2.45, 2.15, 5.25, 0.0, 'wood_floor');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, 0.0, 'tile_grey_stone');
  addFloorPatch(2.25, 3.55, 3.35, 5.20, 0.0, 'tile_beige_grid');
  addFloorPatch(3.45, 3.55, 4.85, 5.20, 0.0, 'terrazzo_emerald');
  addFloorPatch(0.15, 5.25, 4.85, 9.85, 0.0, 'wood_floor');
  // 1F Raised Tatami Nook (FL+0.32)
  addBox(staticGroup, 1.40, 0.31, 1.40, mat.oak, 4.15, 0.155, 9.15, true);
  addFloorPatch(3.46, 8.46, 4.84, 9.84, 0.312, 'tatami');
  // 1F Under-stair base floor
  addFloorPatch(0.15, 2.45, 1.15, 5.25, 0.0, 'concrete_clean');

  // 2F Floors (Y = 2.75)
  addFloorPatch(0.15, 0.15, 2.15, 2.45, 2.75, 'wood_walnut_floor');
  addFloorPatch(1.25, 2.45, 2.15, 5.95, 2.75, 'wood_walnut_floor');
  addFloorPatch(0.15, 5.15, 1.25, 5.95, 2.75, 'wood_walnut_floor');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, 2.75, 'carpet_charcoal_tile');
  addFloorPatch(2.25, 3.55, 3.50, 5.95, 2.75, 'terrazzo_white');
  addFloorPatch(3.60, 3.55, 4.85, 5.95, 2.73, 'tile_blue_bath');
  addFloorPatch(0.15, 6.05, 4.85, 9.85, 2.75, 'wood_walnut_floor');

  // 3F Floors (Y = 5.50)
  addFloorPatch(0.15, 0.15, 2.15, 2.45, 5.50, 'parquet_oak');
  addFloorPatch(1.25, 2.45, 2.15, 5.95, 5.50, 'parquet_oak');
  addFloorPatch(0.15, 5.15, 1.25, 5.95, 5.50, 'parquet_oak');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, 5.50, 'tatami_ryukyu');
  addFloorPatch(2.25, 3.55, 3.45, 5.95, 5.50, 'tile_checker_stone');
  addFloorPatch(3.55, 3.55, 4.85, 5.95, 5.50, 'parquet_oak');
  addFloorPatch(0.15, 6.05, 4.85, 9.85, 5.50, 'parquet_oak');

  // Attic Floors (Y = 8.15) — respecting stairwell cutout X=0.15..1.15, Z=2.45..5.15!
  addFloorPatch(0.15, 0.15, 2.15, 2.45, 8.15, 'rubber_black_stud');
  addFloorPatch(1.20, 2.45, 2.15, 5.20, 8.15, 'rubber_black_stud');
  addFloorPatch(2.15, 0.15, 4.85, 5.25, 8.15, 'wood_scratched_cedar');
  addFloorPatch(0.15, 5.20, 4.85, 9.85, 8.15, 'wood_scratched_cedar');
  // Attic South aged tatami reading mat centered under ridge
  addFloorPatch(1.30, 6.15, 3.70, 8.75, 8.165, 'tatami_aged');

  // Build walls for Floors 0, 1, 2
  buildStandardFloorWalls(FLOORS[0]);
  buildStandardFloorWalls(FLOORS[1]);
  buildStandardFloorWalls(FLOORS[2]);

  // =========================================================================
  // 3. STACKED 3-FLIGHT ARCHITECTURAL STAIRCASES (ST1, ST2, ST3)
  // =========================================================================
  function buildStairFlight(flightIdx, yStart, yEnd, treadTex) {
    const sb = HOUSE.stairBox;
    const steps = sb.treads;
    const rise = (yEnd - yStart) / steps;
    const run = (sb.bottomZ - sb.topZ) / steps;
    const treadMat = makeSurfaceMat(treadTex, 0.96, 0.25, { roughness: 0.45 });
    const riserMat = flightIdx === 0 ? mat.darkIron : mat.walnut;
    const stairW = sb.maxX - sb.minX - 0.04;
    const centerX = (sb.minX + sb.maxX) / 2;

    for (let i = 0; i < steps; i++) {
      const sy = yStart + (i + 1) * rise;
      const sz = sb.bottomZ - (i + 0.5) * run;
      // Solid timber tread
      addBox(staticGroup, stairW, 0.045, run + 0.03, treadMat, centerX, sy - 0.022, sz, true);
      // Solid riser backing on ST2/ST3 (and crisp steel kickplate on ST1) so flights look grounded from below
      if (flightIdx > 0) {
        addBox(staticGroup, stairW - 0.02, rise, 0.028, riserMat, centerX, sy - rise / 2, sz + run / 2, false);
      } else {
        addBox(staticGroup, stairW - 0.04, rise * 0.48, 0.02, mat.darkIron, centerX, sy - rise * 0.26, sz + run / 2, false);
      }
    }

    // Slanted dark iron side stringers & East wood handrail
    const dx = sb.bottomZ - sb.topZ;
    const dy = yEnd - yStart;
    const slopeLen = Math.hypot(dx, dy);
    const pitchAngle = Math.atan2(dy, dx);
    const midY = (yStart + yEnd) / 2;
    const midZ = (sb.bottomZ + sb.topZ) / 2;

    [sb.minX + 0.03, sb.maxX - 0.03].forEach((sx) => {
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, slopeLen), mat.darkIron);
      str.position.set(sx, midY - 0.08, midZ);
      str.rotation.x = pitchAngle;
      str.castShadow = true;
      str.receiveShadow = true;
      staticGroup.add(str);
    });
    if (flightIdx > 0) {
      // Smooth walnut architectural soffit closing the underside of upper stair flights cleanly
      const soffit = new THREE.Mesh(new THREE.BoxGeometry(stairW + 0.02, 0.04, slopeLen), mat.walnut);
      soffit.position.set(centerX, midY - 0.14, midZ);
      soffit.rotation.x = pitchAngle;
      staticGroup.add(soffit);
    }

    // East wall warm oak handrail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, slopeLen), mat.oak);
    rail.position.set(sb.maxX - 0.045, midY + 0.88, midZ);
    rail.rotation.x = pitchAngle;
    staticGroup.add(rail);

    // Subtle warm LED stair step guide strip along West wall so dark stair treads are legible & atmospheric
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.025, slopeLen * 0.92),
      new THREE.MeshBasicMaterial({ color: 0xffc67c }),
    );
    ledStrip.position.set(sb.minX + 0.012, midY + 0.22, midZ);
    ledStrip.rotation.x = pitchAngle;
    staticGroup.add(ledStrip);
  }

  buildStairFlight(0, 0.00, 2.75, 'wood_floor');
  buildStairFlight(1, 2.75, 5.50, 'wood_walnut_floor');
  buildStairFlight(2, 5.50, 8.15, 'wood_scratched_cedar');

  // =========================================================================
  // 4. FLOOR 3 — 6寸勾配 GABLE ATTIC ROOF, TRUSSES, WINDOWS & GUARDRAILS
  // =========================================================================
  const attY = HOUSE.atticBaseY; // 8.15
  const kneeH = HOUSE.atticKneewallH; // 1.42
  const eaveY = HOUSE.atticEaveY; // 9.57
  const ridgeY = HOUSE.atticRidgeY; // 10.98

  // West & East Kneewalls (Y = 8.15 .. 9.57)
  addWallBox(staticGroup, 0.15, kneeH, 9.70, 0.075, attY + kneeH / 2, 5.0, 'yakisugi_deep', 'wainscot_rustic', 'v');
  addWallBox(staticGroup, 0.15, kneeH, 9.70, 4.925, attY + kneeH / 2, 5.0, 'wainscot_rustic', 'yakisugi_deep', 'v');
  addCollider(3, 0.0, 0.0, 0.16, 10.0);
  addCollider(3, 4.84, 0.0, 5.0, 10.0);

  // North & South Gable End Walls with centered gable windows (W4-1 & W4-2)
  function buildGableEndWall(z1, z2, isNorth, winOp, intTex) {
    const thick = z2 - z1;
    const cz = (z1 + z2) / 2;
    const extTex = 'yakisugi_deep';
    const frontTex = isNorth ? extTex : intTex;
    const backTex = isNorth ? intTex : extTex;

    // Lower rectangular band up to eaveY (with window cutout)
    const wx1 = winOp.pos;
    const wx2 = winOp.pos + winOp.width;
    const sillY = attY + winOp.sill;
    const winTopY = sillY + winOp.height;

    // Left pier (0 .. wx1)
    addWallBox(staticGroup, wx1, kneeH, thick, wx1 / 2, attY + kneeH / 2, cz, frontTex, backTex, 'h');
    // Right pier (wx2 .. 5.0)
    addWallBox(staticGroup, 5.0 - wx2, kneeH, thick, (wx2 + 5.0) / 2, attY + kneeH / 2, cz, frontTex, backTex, 'h');
    // Under window sill
    addWallBox(staticGroup, winOp.width, winOp.sill, thick, (wx1 + wx2) / 2, attY + winOp.sill / 2, cz, frontTex, backTex, 'h');
    // Window frame & glass
    addWindowFrame(winOp, { axis: 'h', z1, z2 }, attY);
    addCollider(3, 0.0, z1, 5.0, z2);

    // Upper Triangular Gable Wall (Y = eaveY .. ridgeY) traced cleanly around upper window cutout (zero holes, 100% valid triangulation!)
    const cutTop = Math.min(winTopY, getAtticCeilingY(wx1) - 0.04, getAtticCeilingY(wx2) - 0.04);
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

    const extMatGable = makeSurfaceMat(extTex, 1.5, 1.5);
    const intMatGable = makeSurfaceMat(intTex, 1.5, 1.5);

    const makeGableFace = (zPos, baseMat, isBackSide) => {
      const geo = new THREE.ShapeGeometry(shape);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * 0.65, (uv.getY(i) - attY) * 0.65);
      }
      const m = isBackSide ? baseMat.clone() : baseMat;
      if (isBackSide) m.side = THREE.BackSide;
      const faceMesh = new THREE.Mesh(geo, m);
      faceMesh.position.set(0, 0, zPos);
      faceMesh.castShadow = true;
      faceMesh.receiveShadow = true;
      staticGroup.add(faceMesh);
    };

    // +Z face (at z = z2): faces South -> interior on North wall, exterior on South wall
    makeGableFace(z2, isNorth ? intMatGable : extMatGable, false);
    // -Z face (at z = z1): faces North -> exterior on North wall, interior on South wall
    makeGableFace(z1, isNorth ? extMatGable : intMatGable, true);
  }

  buildGableEndWall(0.0, 0.15, true, FLOORS[3].walls[0].openings[0], 'wood_scratched_cedar');
  buildGableEndWall(9.85, 10.0, false, FLOORS[3].walls[1].openings[0], 'wallpaper_vintage_floral');

  // Sloped Gable Roof Planes (Exterior dark slate + Interior attic plywood)
  const roofAngle = Math.atan(HOUSE.atticSlope); // 0.5404 rad (~30.96 deg)
  const extRun = 2.50 + 0.50; // 0.50m exterior eaves overhang
  const extSlopeLen = extRun / Math.cos(roofAngle);
  const roofDepth = 10.90; // 0.45m gable overhang North & South
  const slateRoofMat = makeSurfaceMat('slate_charcoal', extSlopeLen, roofDepth, { roughness: 0.64 });
  const plywoodCeilMat = makeSurfaceMat('plywood_attic', 2.85, 9.70, { roughness: 0.78 });

  [-1, 1].forEach((side) => {
    // Exterior roof slope
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(extSlopeLen, 0.12, roofDepth), slateRoofMat);
    const midX = 2.5 + side * (extRun / 2);
    const midY = ridgeY + 0.10 - (extRun / 2) * HOUSE.atticSlope;
    rMesh.position.set(midX, midY, 5.0);
    rMesh.rotation.z = -side * roofAngle;
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    staticGroup.add(rMesh);

    // Interior warm structural plywood sloped ceiling
    const intRun = 2.40;
    const intSlopeLen = intRun / Math.cos(roofAngle);
    const cMesh = new THREE.Mesh(new THREE.BoxGeometry(intSlopeLen, 0.04, 9.72), plywoodCeilMat);
    cMesh.position.set(2.5 + side * (intRun / 2), ridgeY - 0.02 - (intRun / 2) * HOUSE.atticSlope, 5.0);
    cMesh.rotation.z = -side * roofAngle;
    cMesh.receiveShadow = true;
    staticGroup.add(cMesh);
  });

  // Exposed Walnut Structural Ridge Beam, Rafters & Collar Ties in Attic!
  addBox(staticGroup, 0.14, 0.22, 9.75, mat.walnut, 2.50, ridgeY - 0.14, 5.0, true);
  for (let rz = 0.65; rz <= 9.55; rz += 1.25) {
    [-1, 1].forEach((side) => {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.11, 0.08), mat.walnut);
      rafter.position.set(2.5 + side * 1.18, ridgeY - 0.10 - 1.18 * HOUSE.atticSlope, rz);
      rafter.rotation.z = -side * roofAngle;
      rafter.castShadow = true;
      staticGroup.add(rafter);
    });
    // Horizontal collar tie at Y=10.22m (2.07m above attic floor — completely clear of protagonist head!)
    addBox(staticGroup, 2.35, 0.09, 0.08, mat.walnut, 2.50, 10.22, rz, true);
  }

  // Attic Stairwell Iron Safety Guardrail (East X=1.18, Z=2.45..5.20 & South Z=5.18, X=0.15..1.20)
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.darkIron, 1.18, attY + 0.96, 3.82, false);
  addBox(staticGroup, 0.05, 0.05, 2.78, mat.oak, 1.18, attY + 1.00, 3.82, false);
  addBox(staticGroup, 1.06, 0.05, 0.05, mat.darkIron, 0.68, attY + 0.96, 5.18, false);
  addBox(staticGroup, 1.06, 0.05, 0.05, mat.oak, 0.68, attY + 1.00, 5.18, false);
  for (let bz = 2.50; bz <= 5.18; bz += 0.22) {
    addBox(staticGroup, 0.022, 0.96, 0.022, mat.darkIron, 1.18, attY + 0.48, bz, false);
  }
  for (let bx = 0.22; bx <= 1.18; bx += 0.22) {
    addBox(staticGroup, 0.022, 0.96, 0.022, mat.darkIron, bx, attY + 0.48, 5.18, false);
  }
  addCollider(3, 1.14, 2.45, 1.24, 5.24);
  addCollider(3, 0.15, 5.14, 1.24, 5.24);

  // Attic partial rustic wooden lattice divider between North Storage & South Reading Sanctuary
  addBox(staticGroup, 1.72, 1.38, 0.08, makeSurfaceMat('wood_lattice_dark', 1.72, 1.38), 3.98, attY + 0.69, 5.25, true);
  addBox(staticGroup, 1.72, 1.38, 0.02, makeSurfaceMat('pegboard_wood', 1.72, 1.38), 3.98, attY + 0.69, 5.30, false);
  addCollider(3, 3.10, 5.18, 4.85, 5.33);

  // Continuous Exterior Corner Timber Pilasters (0 -> 9.6m)
  [[0.02, 0.02], [4.98, 0.02], [0.02, 9.98], [4.98, 9.98]].forEach(([cx, cz]) => {
    addBox(staticGroup, 0.10, 9.62, 0.10, mat.darkIron, cx, 4.81, cz, false);
  });

  // =========================================================================
  // 5. DETAILED INTERIOR FURNISHINGS & PROPS ACROSS ALL 4 LEVELS
  // =========================================================================
  function addFramedArt(parent, texName, w, h, x, y, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.025), mat.walnut);
    g.add(frame);
    const art = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), makeFrontMat(texName, { roughness: 0.55 }));
    art.position.z = 0.004;
    g.add(art);
    parent.add(g);
  }

  // ---------- 1F FURNISHING (Y = 0.00) ----------
  // Genkan floating shoe box, coir mat, intercom, pinboard
  addBox(furnitureGroup, 0.34, 0.78, 1.02, makeFrontMat('furniture_chest'), 0.33, 0.42, 0.72, true);
  addCollider(0, 0.15, 0.20, 0.52, 1.24);
  addBox(furnitureGroup, 0.68, 0.015, 0.46, makeFrontMat('doormat_coir', { roughness: 0.95 }), 1.10, -0.108, 0.52, false);
  addFramedArt(furnitureGroup, 'fixture_intercom', 0.18, 0.24, 2.13, 1.42, 1.55, -Math.PI / 2);
  addFramedArt(furnitureGroup, 'fixture_pinboard', 0.55, 0.42, 0.72, 1.45, 2.38, Math.PI);
  addFramedArt(furnitureGroup, 'fixture_meter', 0.26, 0.34, 1.85, 1.72, 0.17, 0);

  // 1F NE Forest Gear & Firewood Room (X=2.25..4.85, Z=0.15..3.45)
  addBox(furnitureGroup, 0.42, 1.85, 1.35, makeSurfaceMat('timber_logs', 1.35, 1.85), 4.62, 0.925, 1.75, true);
  addCollider(0, 4.38, 1.05, 4.85, 2.45);
  addBox(furnitureGroup, 0.03, 1.15, 1.25, makeSurfaceMat('pegboard_wood', 1.25, 1.15), 4.83, 1.35, 2.90, false);
  addBox(furnitureGroup, 0.48, 0.48, 0.48, makeSurfaceMat('crate_wood', 0.5, 0.5), 4.55, 0.24, 3.05, true);
  addBox(furnitureGroup, 0.44, 0.44, 0.44, makeSurfaceMat('crate_wood', 0.5, 0.5), 4.52, 0.70, 3.02, true);
  addBox(furnitureGroup, 0.38, 1.75, 1.05, makeFrontMat('furniture_bookshelf'), 2.45, 0.875, 0.72, true);
  addCollider(0, 2.25, 0.18, 2.66, 1.26);
  addFramedArt(furnitureGroup, 'sign_recycle', 0.30, 0.22, 3.45, 1.32, 3.43, Math.PI);

  // 1F Gallery Art
  addFramedArt(furnitureGroup, 'art_poster_1', 0.42, 0.56, 1.27, 1.42, 3.30, Math.PI / 2);
  addFramedArt(furnitureGroup, 'art_poster_2', 0.42, 0.56, 1.27, 1.42, 4.45, Math.PI / 2);

  // 1F WC (X=2.25..3.35, Z=3.55..5.20)
  addBox(furnitureGroup, 0.02, 0.85, 1.45, makeSurfaceMat('tile_mosaic_mint', 1.45, 0.85), 3.33, 0.95, 4.38, false);
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, 2.85, 0.21, 3.92, true); // Toilet bowl
  addBox(furnitureGroup, 0.38, 0.78, 0.18, mat.ceramic, 2.85, 0.39, 3.66, true); // Tank
  addBox(furnitureGroup, 0.24, 0.14, 0.44, mat.ceramic, 3.20, 0.82, 4.78, false); // Hand basin
  addCollider(0, 2.62, 3.55, 3.12, 4.25);

  // 1F Utility Pantry (X=3.45..4.85, Z=3.55..5.20)
  addBox(furnitureGroup, 0.64, 1.78, 0.66, makeFrontMat('appliance_fridge', { roughness: 0.28, metalness: 0.25 }), 3.80, 0.89, 3.92, true);
  addCollider(0, 3.46, 3.56, 4.14, 4.28);
  addBox(furnitureGroup, 0.48, 0.85, 1.30, mat.oak, 4.58, 0.425, 4.28, true);
  addBox(furnitureGroup, 0.42, 0.04, 0.54, mat.stainless, 4.58, 0.86, 4.48, false);
  addCollider(0, 4.32, 3.60, 4.85, 4.96);

  // 1F LDK (X=0.15..4.85, Z=5.25..9.85)
  // West Wood-Slats TV Feature Wall + 55" TV + Media Console
  addBox(staticGroup, 0.04, 2.48, 2.35, makeSurfaceMat('wood_slats', 2.35, 2.48), 0.18, 1.24, 8.30, false);
  addBox(furnitureGroup, 0.36, 0.38, 1.85, mat.walnut, 0.38, 0.22, 8.30, true);
  addCollider(0, 0.16, 7.36, 0.58, 9.25);
  addBox(furnitureGroup, 0.05, 0.72, 1.24, mat.darkIron, 0.22, 1.18, 8.30, false);
  const tvScreenMat = makeFrontMat('appliance_tv_screen', { roughness: 0.16, emissive: 0x1a2838, emissiveIntensity: 0.35 });
  addBox(furnitureGroup, 0.055, 0.66, 1.18, tvScreenMat, 0.23, 1.18, 8.30, false);

  // Living Rug, 3P Grey Sofa & Oak Coffee Table (facing West TV & South forest window!)
  addBox(furnitureGroup, 1.85, 0.015, 2.15, makeSurfaceMat('carpet_beige', 1.85, 2.15), 1.55, 0.016, 8.30, false);
  const sofaMat = makeSurfaceMat('fabric_grey_sofa', 1.85, 0.82);
  addBox(furnitureGroup, 0.78, 0.38, 1.85, sofaMat, 2.18, 0.20, 8.35, true); // Seat
  addBox(furnitureGroup, 0.20, 0.68, 1.85, sofaMat, 2.48, 0.42, 8.35, true); // Backrest
  addBox(furnitureGroup, 0.78, 0.54, 0.16, sofaMat, 2.18, 0.31, 7.48, true); // North arm
  addBox(furnitureGroup, 0.78, 0.54, 0.16, sofaMat, 2.18, 0.31, 9.22, true); // South arm
  addCollider(0, 1.76, 7.38, 2.60, 9.32);
  // Oak coffee table
  addBox(furnitureGroup, 0.52, 0.035, 0.96, mat.oak, 1.28, 0.36, 8.35, true);
  [[-0.20, -0.40], [0.20, -0.40], [-0.20, 0.40], [0.20, 0.40]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.035, 0.35, 0.035, mat.darkIron, 1.28 + dx, 0.175, 8.35 + dz, false);
  });
  addCollider(0, 1.00, 7.85, 1.56, 8.85);

  // East I-Kitchen (X=4.15..4.84, Z=5.38..8.30) + Caramel Brick Backsplash
  addBox(staticGroup, 0.03, 1.45, 2.85, makeSurfaceMat('tile_caramel_brick', 2.85, 1.45), 4.83, 1.55, 6.85, false);
  addBox(furnitureGroup, 0.64, 0.84, 2.72, makeSurfaceMat('furniture_kitchen_cab', 2.72, 0.84), 4.50, 0.42, 6.85, true);
  addBox(furnitureGroup, 0.66, 0.04, 2.74, makeSurfaceMat('marble_white', 2.74, 0.66), 4.50, 0.86, 6.85, false);
  addBox(furnitureGroup, 0.42, 0.02, 0.62, mat.stainless, 4.48, 0.882, 6.15, false); // Sink
  addBox(furnitureGroup, 0.03, 0.28, 0.03, mat.chrome, 4.72, 1.01, 6.15, false); // Faucet
  addBox(furnitureGroup, 0.46, 0.02, 0.58, mat.darkIron, 4.48, 0.882, 7.45, false); // IH stove
  addBox(furnitureGroup, 0.52, 0.55, 0.78, mat.darkIron, 4.56, 2.22, 7.45, true); // Range hood
  addCollider(0, 4.16, 5.45, 4.85, 8.24);

  // Dining Table & Chairs + Teishoku meal + Wall Clock & Calendar
  addBox(furnitureGroup, 0.80, 0.04, 1.28, mat.oak, 2.95, 0.73, 6.45, true);
  [[-0.32, -0.54], [0.32, -0.54], [-0.32, 0.54], [0.32, 0.54]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.04, 0.71, 0.04, mat.darkIron, 2.95 + dx, 0.355, 6.45 + dz, false);
  });
  addBox(furnitureGroup, 0.46, 0.02, 0.34, makeFrontMat('meal_teishoku'), 2.95, 0.76, 6.45, false);
  // 2 dining chairs
  [6.18, 6.72].forEach((cz) => {
    addBox(furnitureGroup, 0.40, 0.04, 0.40, mat.oak, 2.38, 0.44, cz, true);
    addBox(furnitureGroup, 0.04, 0.42, 0.40, mat.oak, 2.20, 0.64, cz, true);
  });
  addCollider(0, 2.35, 5.78, 3.42, 7.12);
  addFramedArt(furnitureGroup, 'prop_wall_clock', 0.34, 0.34, 2.75, 1.82, 5.32, 0);
  addFramedArt(furnitureGroup, 'prop_calendar', 0.32, 0.44, 3.25, 1.62, 5.32, 0);
  // Dining pendant light fixture
  addBox(furnitureGroup, 0.02, 0.75, 0.02, mat.darkIron, 2.95, 2.12, 6.45, false);
  const pd1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 16), mat.bronze);
  pd1.position.set(2.95, 1.72, 6.45);
  furnitureGroup.add(pd1);
  const pdBulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), mat.warmBulb);
  pdBulb1.position.set(2.95, 1.64, 6.45);
  furnitureGroup.add(pdBulb1);

  // 1F SE Raised Tatami Nook: Ochre plaster wall, Crimson Zabuton & Interactive Washi Paper Lantern!
  addBox(staticGroup, 0.03, 2.18, 1.38, makeSurfaceMat('plaster_ochre', 1.38, 2.18), 4.83, 1.41, 9.15, false);
  addBox(furnitureGroup, 0.56, 0.07, 0.56, makeFrontMat('zabuton_red', { roughness: 0.90 }), 4.02, 0.365, 9.05, false);
  // Interactive Washi Lantern (1F)
  const lantern1Mat = mat.washiGlow.clone();
  const lantern1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.38, 12), lantern1Mat);
  lantern1Mesh.position.set(4.52, 0.52, 8.80);
  lantern1Mesh.userData.propId = 'lantern_1f';
  lantern1Mesh.userData.noBatch = true;
  dynamicGroup.add(lantern1Mesh);
  excludeBatch.add(lantern1Mesh);
  addBox(furnitureGroup, 0.18, 0.03, 0.18, mat.walnut, 4.52, 0.335, 8.80, false);

  const l1Light = addLight('Tatami_Lantern', 0, 'ldk', 0xff9b42, 1.65, 5.2, 4.46, 0.68, 8.85);
  interactiveProps.push({
    id: 'lantern_1f',
    floor: 0,
    mesh: lantern1Mesh,
    isOn: true,
    getLabel() { return this.isOn ? '和紙行灯を消す' : '和紙行灯を点ける'; },
    toggle() {
      this.isOn = !this.isOn;
      lantern1Mat.emissiveIntensity = this.isOn ? 1.85 : 0.08;
      if (!this.isOn) l1Light.intensity = 0;
    },
  });

  // ---------- 2F FURNISHING (Y = 2.75) ----------
  const y2 = 2.75;
  // 2F North Landing bench & poster
  addBox(furnitureGroup, 1.10, 0.42, 0.36, mat.oak, 1.12, y2 + 0.21, 0.36, true);
  addCollider(1, 0.55, 0.16, 1.70, 0.56);
  addFramedArt(furnitureGroup, 'art_poster_3', 0.46, 0.62, 2.13, y2 + 1.45, 0.85, -Math.PI / 2);

  // 2F NE Forest Study (X=2.25..4.85, Z=0.15..3.45)
  addBox(staticGroup, 0.03, 2.48, 3.25, makeSurfaceMat('brick_red_classic', 3.25, 2.48), 4.83, y2 + 1.24, 1.80, false);
  addBox(furnitureGroup, 0.62, 0.045, 1.68, mat.oak, 4.50, y2 + 0.74, 1.75, true); // Studio Desk
  addBox(furnitureGroup, 0.58, 0.72, 0.06, mat.darkIron, 4.50, y2 + 0.36, 0.96, false);
  addBox(furnitureGroup, 0.58, 0.72, 0.06, mat.darkIron, 4.50, y2 + 0.36, 2.54, false);
  addCollider(1, 4.16, 0.88, 4.85, 2.62);
  // Denim chair
  const denimMat = makeSurfaceMat('fabric_denim', 0.5, 0.5);
  addBox(furnitureGroup, 0.46, 0.08, 0.46, denimMat, 3.78, y2 + 0.45, 1.75, true);
  addBox(furnitureGroup, 0.08, 0.46, 0.46, denimMat, 3.58, y2 + 0.68, 1.75, true);
  addBox(furnitureGroup, 0.06, 0.42, 0.06, mat.darkIron, 3.78, y2 + 0.22, 1.75, false);
  // Cork board & Pegboard on walls + Bookshelf
  addBox(furnitureGroup, 0.025, 0.72, 1.15, makeSurfaceMat('cork_board', 1.15, 0.72), 4.82, y2 + 1.48, 1.75, false);
  addBox(furnitureGroup, 1.05, 0.88, 0.025, makeSurfaceMat('pegboard_wood', 1.05, 0.88), 3.45, y2 + 1.45, 3.42, false);
  addBox(furnitureGroup, 1.18, 1.85, 0.38, makeFrontMat('furniture_bookshelf'), 3.15, y2 + 0.925, 3.24, true);
  addCollider(1, 2.54, 3.04, 3.76, 3.45);
  // Interactive Study Desk Lamp
  const studyBulbMat = mat.warmBulb.clone();
  const studyLampMesh = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 12), mat.bronze);
  studyLampMesh.position.set(4.56, y2 + 1.18, 1.18);
  studyLampMesh.userData.propId = 'lamp_study';
  studyLampMesh.userData.noBatch = true;
  dynamicGroup.add(studyLampMesh);
  excludeBatch.add(studyLampMesh);
  addBox(furnitureGroup, 0.03, 0.42, 0.03, mat.bronze, 4.62, y2 + 0.96, 1.18, false);
  const studyLampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), studyBulbMat);
  studyLampBulb.position.set(4.56, y2 + 1.11, 1.18);
  dynamicGroup.add(studyLampBulb);
  excludeBatch.add(studyLampBulb);
  const studyLight = addLight('Study_Desk', 1, 'study', 0xffbe6b, 1.95, 5.8, 4.25, y2 + 1.32, 1.55);
  interactiveProps.push({
    id: 'lamp_study',
    floor: 1,
    mesh: studyLampMesh,
    isOn: true,
    getLabel() { return this.isOn ? '書斎ランプを消す' : '書斎ランプを点ける'; },
    toggle() {
      this.isOn = !this.isOn;
      studyBulbMat.emissiveIntensity = this.isOn ? 2.6 : 0.08;
      if (!this.isOn) studyLight.intensity = 0;
    },
  });

  // 2F Washroom & Laundry (X=2.25..3.50, Z=3.55..5.95)
  addBox(furnitureGroup, 0.88, 0.80, 0.50, makeFrontMat('furniture_vanity_base'), 2.86, y2 + 0.40, 3.82, true);
  addBox(furnitureGroup, 0.92, 0.04, 0.52, makeSurfaceMat('marble_white', 0.92, 0.52), 2.86, y2 + 0.82, 3.82, false);
  addBox(furnitureGroup, 0.82, 0.72, 0.03, mat.mirror, 2.86, y2 + 1.42, 3.58, false);
  addCollider(1, 2.40, 3.55, 3.34, 4.10);
  addBox(furnitureGroup, 0.62, 0.86, 0.62, makeFrontMat('appliance_washer', { roughness: 0.28 }), 2.88, y2 + 0.43, 5.60, true);
  addCollider(1, 2.54, 5.28, 3.22, 5.94);

  // 2F 1317 Unit Bath (X=3.60..4.85, Z=3.55..5.95)
  addBox(staticGroup, 0.03, 2.25, 2.35, makeSurfaceMat('stone_wet_granite', 2.35, 2.25), 4.83, y2 + 1.12, 4.75, false);
  // Deep Soaking Tub on South half of bath
  addBox(furnitureGroup, 1.16, 0.54, 0.82, mat.ceramic, 4.22, y2 + 0.25, 5.48, true);
  addBox(furnitureGroup, 1.04, 0.04, 0.70, mat.water, 4.22, y2 + 0.48, 5.48, false);
  addBox(furnitureGroup, 0.03, 1.45, 0.03, mat.chrome, 4.78, y2 + 1.25, 4.40, false); // Shower rail
  addCollider(1, 3.62, 5.04, 4.84, 5.94);

  // 2F Master Bedroom Suite (X=0.15..4.85, Z=6.05..9.85)
  addBox(staticGroup, 4.65, 2.48, 0.03, makeSurfaceMat('wood_planks_dark', 4.65, 2.48), 2.50, y2 + 1.24, 6.08, false);
  addBox(furnitureGroup, 2.25, 0.015, 2.45, makeSurfaceMat('carpet_beige', 2.25, 2.45), 2.65, y2 + 0.018, 7.65, false);
  // Queen Bed (centered against North headboard wall Z=6.12..8.18, X=2.10..3.65)
  addBox(furnitureGroup, 1.62, 0.26, 2.08, mat.walnut, 2.88, y2 + 0.13, 7.16, true);
  addBox(furnitureGroup, 1.56, 0.24, 2.02, makeSurfaceMat('fabric_floral_quilt', 1.56, 2.02), 2.88, y2 + 0.38, 7.16, true);
  addBox(furnitureGroup, 0.56, 0.14, 0.34, makeFrontMat('fabric_rose_vintage'), 2.52, y2 + 0.55, 6.38, false);
  addBox(furnitureGroup, 0.56, 0.14, 0.34, makeFrontMat('fabric_sakura'), 3.24, y2 + 0.55, 6.38, false);
  addCollider(1, 2.04, 6.10, 3.72, 8.24);
  // Bedside tables + Twin Warm Bedside Lamps
  [1.82, 3.94].forEach((bx) => {
    addBox(furnitureGroup, 0.42, 0.48, 0.42, mat.walnut, bx, y2 + 0.24, 6.36, true);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.22, 12), mat.washiGlow);
    shade.position.set(bx, y2 + 0.66, 6.36);
    furnitureGroup.add(shade);
  });
  // Wardrobe (West wall) & Oak Chest + AC unit
  addBox(furnitureGroup, 0.58, 2.05, 1.95, makeFrontMat('furniture_wardrobe'), 0.46, y2 + 1.025, 7.45, true);
  addCollider(1, 0.15, 6.45, 0.78, 8.45);
  addBox(furnitureGroup, 0.44, 0.82, 0.92, makeFrontMat('furniture_chest'), 4.60, y2 + 0.41, 8.55, true);
  addCollider(1, 4.36, 8.08, 4.85, 9.02);
  addBox(furnitureGroup, 0.82, 0.26, 0.22, makeFrontMat('appliance_ac'), 0.85, y2 + 2.15, 6.20, false);
  // Sheer botanical curtains flanking South panoramic window
  const curtMat = makeSurfaceMat('curtain_botanical', 0.45, 1.85, { roughness: 0.9 });
  addBox(furnitureGroup, 0.34, 1.82, 0.05, curtMat, 0.35, y2 + 1.38, 9.78, false);
  addBox(furnitureGroup, 0.34, 1.82, 0.05, curtMat, 3.12, y2 + 1.38, 9.78, false);

  // ---------- 3F FURNISHING (Y = 5.50) ----------
  const y3 = 5.50;
  // 3F North Landing viewing bench
  addBox(furnitureGroup, 1.10, 0.42, 0.36, mat.walnut, 1.12, y3 + 0.21, 0.36, true);
  addCollider(2, 0.55, 0.16, 1.70, 0.56);

  // 3F NE Ryukyu Tatami Tea & Guest Room (X=2.25..4.85, Z=0.15..3.45)
  // Backlit Washi Paper glowing shoji wall panel on East wall
  const washiGlowPanelMat = makeSurfaceMat('washi_paper', 1.45, 2.05, {
    emissive: 0xffaa55,
    emissiveIntensity: 0.55,
    roughness: 0.88,
  });
  addBox(furnitureGroup, 0.04, 2.05, 1.45, washiGlowPanelMat, 4.81, y3 + 1.15, 1.75, false);
  // Dark wooden lattice frame over shoji
  addBox(furnitureGroup, 0.06, 2.10, 0.05, mat.walnut, 4.80, y3 + 1.15, 1.02, false);
  addBox(furnitureGroup, 0.06, 2.10, 0.05, mat.walnut, 4.80, y3 + 1.15, 2.48, false);
  // Bamboo sudare rolled shade above North window
  addBox(furnitureGroup, 1.55, 0.24, 0.05, makeSurfaceMat('bamboo_sudare', 1.55, 0.24), 3.57, y3 + 2.08, 0.18, false);
  // Chabudai low tea table + crimson zabutons + folded guest futon
  addBox(furnitureGroup, 0.88, 0.04, 0.88, mat.walnut, 3.55, y3 + 0.33, 1.80, true);
  addBox(furnitureGroup, 0.70, 0.31, 0.70, mat.walnut, 3.55, y3 + 0.155, 1.80, false);
  addBox(furnitureGroup, 0.54, 0.07, 0.54, makeFrontMat('zabuton_red'), 2.86, y3 + 0.045, 1.80, false);
  addBox(furnitureGroup, 0.54, 0.07, 0.54, makeFrontMat('zabuton_red'), 4.24, y3 + 0.045, 1.80, false);
  addCollider(2, 3.08, 1.34, 4.02, 2.26);
  // Neatly folded rose vintage guest futon in SE corner of Tea Room
  addBox(furnitureGroup, 0.76, 0.34, 0.96, makeSurfaceMat('fabric_rose_vintage', 0.96, 0.76), 4.42, y3 + 0.17, 2.92, true);
  addCollider(2, 4.02, 2.42, 4.84, 3.42);

  // 3F Powder WC (X=2.25..3.45, Z=3.55..5.95)
  addBox(furnitureGroup, 0.54, 0.82, 1.05, makeSurfaceMat('marble_black', 1.05, 0.82), 3.16, y3 + 0.41, 4.30, true);
  const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.13, 16), mat.ceramic);
  vessel.position.set(3.15, y3 + 0.88, 4.30);
  furnitureGroup.add(vessel);
  addBox(furnitureGroup, 0.03, 0.72, 0.76, mat.mirror, 3.43, y3 + 1.44, 4.30, false);
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, 2.82, y3 + 0.21, 5.50, true);
  addCollider(2, 2.86, 3.74, 3.45, 4.86);
  addCollider(2, 2.58, 5.18, 3.08, 5.92);

  // 3F Archive Closet (X=3.55..4.85, Z=3.55..5.95)
  addBox(furnitureGroup, 0.44, 1.90, 2.15, mat.oak, 4.62, y3 + 0.95, 4.70, true);
  addBox(furnitureGroup, 0.38, 0.34, 0.75, makeFrontMat('folded_clothes'), 4.58, y3 + 1.15, 4.35, false);
  addBox(furnitureGroup, 0.38, 0.36, 0.42, makeSurfaceMat('crate_wood', 0.42, 0.36), 4.58, y3 + 0.55, 5.15, false);
  addCollider(2, 4.36, 3.60, 4.85, 5.82);

  // 3F South Treetop Observatory Atelier & Bar Lounge (X=0.15..4.85, Z=6.05..9.85)
  // Sleek Black Marble Bar Counter (East side X=3.45..4.10, Z=6.75..8.45) + 2 Barstools + Bronze Mesh Pendants
  addBox(furnitureGroup, 0.62, 1.02, 1.72, makeSurfaceMat('marble_black', 1.72, 1.02), 3.78, y3 + 0.51, 7.60, true);
  addCollider(2, 3.44, 6.72, 4.12, 8.48);
  [7.20, 8.00].forEach((bz) => {
    const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.05, 14), mat.walnut);
    stoolTop.position.set(3.12, y3 + 0.70, bz);
    furnitureGroup.add(stoolTop);
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.70, 8), mat.darkIron);
    stoolLeg.position.set(3.12, y3 + 0.35, bz);
    furnitureGroup.add(stoolLeg);
    // Bronze Mesh Pendant hanging from 3F ceiling
    addBox(furnitureGroup, 0.018, 0.72, 0.018, mat.darkIron, 3.78, y3 + 2.10, bz, false);
    const meshShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.24, 14),
      makeSurfaceMat('mesh_bronze_fine', 0.4, 0.3, { emissive: 0xffa64d, emissiveIntensity: 0.75 }),
    );
    meshShade.position.set(3.78, y3 + 1.68, bz);
    furnitureGroup.add(meshShade);
  });
  // Observatory Lounge Sofa facing panoramic South treetops (Z=8.35, facing South!)
  const loungeSofaMat = makeSurfaceMat('fabric_grey_sofa', 1.95, 0.82);
  addBox(furnitureGroup, 1.90, 0.38, 0.80, loungeSofaMat, 1.48, y3 + 0.20, 8.15, true);
  addBox(furnitureGroup, 1.90, 0.68, 0.20, loungeSofaMat, 1.48, y3 + 0.42, 7.82, true);
  addCollider(2, 0.50, 7.72, 2.46, 8.58);
  // Drafting / Art Table along West Dark Brick Wall
  addBox(furnitureGroup, 0.66, 0.045, 1.18, mat.oak, 0.52, y3 + 0.76, 6.85, true);
  addBox(furnitureGroup, 0.60, 0.74, 0.06, mat.darkIron, 0.52, y3 + 0.37, 6.32, false);
  addBox(furnitureGroup, 0.60, 0.74, 0.06, mat.darkIron, 0.52, y3 + 0.37, 7.38, false);
  addCollider(2, 0.16, 6.24, 0.88, 7.46);
  addFramedArt(furnitureGroup, 'art_posters_trio', 0.95, 0.54, 0.18, y3 + 1.56, 6.85, Math.PI / 2);

  // ---------- RF / ATTIC FURNISHING (Y = 8.15) ----------
  const y4 = attY;
  // North Relic Storage Crates, Burlap Sacks, Rope Coil, Crayon House Keepsake Drawing!
  const crateMat = makeSurfaceMat('crate_wood', 0.6, 0.6);
  addBox(furnitureGroup, 0.62, 0.58, 0.62, crateMat, 4.25, y4 + 0.29, 1.35, true);
  addBox(furnitureGroup, 0.54, 0.50, 0.54, crateMat, 4.22, y4 + 0.83, 1.38, true);
  addBox(furnitureGroup, 0.66, 0.54, 0.60, crateMat, 4.22, y4 + 0.27, 2.15, true);
  // Coiled Rope on crate
  const ropeMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.065, 10, 18),
    makeSurfaceMat('rope_coil', 0.5, 0.5),
  );
  ropeMesh.rotation.x = Math.PI / 2;
  ropeMesh.position.set(4.22, y4 + 0.60, 2.15);
  furnitureGroup.add(ropeMesh);
  // Burlap Sacks stacked along East kneewall
  const burlapMat = makeSurfaceMat('burlap_sack', 0.7, 0.7);
  const sack1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), burlapMat);
  sack1.scale.set(1.0, 1.25, 0.85);
  sack1.position.set(4.25, y4 + 0.30, 3.15);
  furnitureGroup.add(sack1);
  const sack2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), burlapMat);
  sack2.scale.set(1.1, 1.0, 0.9);
  sack2.position.set(4.15, y4 + 0.26, 3.68);
  furnitureGroup.add(sack2);
  addCollider(3, 3.85, 0.98, 4.82, 4.00);

  // Childhood keepsake Crayon House drawing pinned on the North storage divider post!
  addFramedArt(furnitureGroup, 'prop_crayon_house', 0.42, 0.34, 3.92, y4 + 0.98, 5.18, Math.PI);

  // South Secret Attic Reading Sanctuary (X=0.15..4.85, Z=5.25..9.85)
  // Low vintage walnut reading table centered on aged tatami mat
  addBox(furnitureGroup, 0.96, 0.04, 0.64, mat.walnut, 2.50, y4 + 0.34, 7.45, true);
  addBox(furnitureGroup, 0.80, 0.32, 0.48, mat.walnut, 2.50, y4 + 0.16, 7.45, false);
  // Floor reading cushions
  addBox(furnitureGroup, 0.56, 0.08, 0.56, makeFrontMat('zabuton_red'), 2.50, y4 + 0.06, 6.72, false);
  addBox(furnitureGroup, 0.56, 0.08, 0.56, denimMat, 2.50, y4 + 0.06, 8.18, false);
  addCollider(3, 1.98, 7.10, 3.02, 7.80);
  // Low Attic eave storage trunks along West & East kneewalls
  addBox(furnitureGroup, 0.54, 0.48, 1.15, crateMat, 0.52, y4 + 0.24, 7.45, true);
  addBox(furnitureGroup, 0.52, 0.46, 1.05, makeFrontMat('furniture_chest'), 4.46, y4 + 0.23, 7.55, true);
  addCollider(3, 0.16, 6.84, 0.84, 8.06);
  addCollider(3, 4.16, 6.98, 4.84, 8.12);

  // Interactive Hanging Iron Attic Lantern suspended from central ridge beam!
  addBox(furnitureGroup, 0.018, 0.92, 0.018, mat.darkIron, 2.50, ridgeY - 0.54, 7.45, false);
  const attLanternMat = mat.washiGlow.clone();
  const attLanternMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.30, 8), attLanternMat);
  attLanternMesh.position.set(2.50, y4 + 1.72, 7.45);
  attLanternMesh.userData.propId = 'lantern_attic';
  attLanternMesh.userData.noBatch = true;
  dynamicGroup.add(attLanternMesh);
  excludeBatch.add(attLanternMesh);
  // Iron lantern cage cap
  const attCap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.10, 8), mat.darkIron);
  attCap.position.set(2.50, y4 + 1.90, 7.45);
  furnitureGroup.add(attCap);

  const atticLight = addLight('Attic_Lantern', 3, 'sanctuary', 0xffa448, 2.85, 9.0, 2.50, y4 + 1.62, 7.45);
  interactiveProps.push({
    id: 'lantern_attic',
    floor: 3,
    mesh: attLanternMesh,
    isOn: true,
    getLabel() { return this.isOn ? '小屋裏ランタンを消す' : '小屋裏ランタンを点ける'; },
    toggle() {
      this.isOn = !this.isOn;
      attLanternMat.emissiveIntensity = this.isOn ? 2.1 : 0.08;
      if (!this.isOn) atticLight.intensity = 0;
    },
  });

  // =========================================================================
  // 6. FLOOR-SCOPED DARK MOODY ATMOSPHERIC LIGHTING (Capped <= 4-5 active!)
  // =========================================================================
  // 1F Lights
  addLight('1F_Dining_Pendant', 0, 'ldk', 0xffbe73, 2.15, 7.5, 2.95, 1.56, 6.45);
  addLight('1F_Living_Cove', 0, 'ldk', 0xffb366, 1.35, 6.8, 1.35, 1.75, 8.20);
  addLight('1F_Hall_Stair', 0, 'north', 0xffcfa0, 1.45, 6.2, 1.35, 2.15, 1.85);
  addLight('1F_Gear_WC', 0, 'north', 0xf6c993, 1.35, 6.0, 3.45, 2.10, 2.25);
  addLight('1F_Porch_Sconce', 0, 'exterior', 0xffb66b, 1.65, 6.5, 1.10, 2.15, -0.35);

  // 2F Lights (Study_Desk already added above)
  addLight('2F_Hall_Stair', 1, 'north', 0xffcfa0, 1.40, 6.4, 1.35, y2 + 2.15, 2.25);
  addLight('2F_Wash_Bath', 1, 'mid', 0xdceeff, 1.55, 5.5, 3.35, y2 + 2.08, 4.75);
  addLight('2F_Master_Suite', 1, 'south', 0xffb66e, 2.10, 7.8, 2.65, y2 + 1.85, 7.45);

  // 3F Lights
  addLight('3F_Hall_Stair', 2, 'north', 0xffcfa0, 1.40, 6.4, 1.35, y3 + 2.10, 2.25);
  addLight('3F_Tea_Shoji', 2, 'north', 0xffb86c, 1.95, 6.2, 3.65, y3 + 1.65, 1.80);
  addLight('3F_Powder_WC', 2, 'mid', 0xd6e8ff, 1.25, 4.8, 2.85, y3 + 2.05, 4.65);
  addLight('3F_Atelier_Bar', 2, 'south', 0xffb260, 2.35, 8.2, 2.85, y3 + 1.85, 7.65);

  // Attic Lights (Attic_Lantern already added above)
  addLight('Attic_Hatch_Bulb', 3, 'north', 0xffc684, 1.55, 6.8, 2.15, y4 + 2.10, 2.35);

  // =========================================================================
  // 7. EXTERIOR ENGAWA, FOREST APPROACH, AC UNIT & TOWERING 16-24m CEDAR FOREST
  // =========================================================================
  // Forest Mulch Ground (96m × 96m)
  const groundMat = makeSurfaceMat('forest_mulch_ground', 96, 96, { roughness: 0.96 });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(2.5, -0.35, 5.0);
  groundMesh.receiveShadow = true;
  exteriorGroup.add(groundMesh);

  // North Mossy Stepping Stone Forest Trail leading to Front Door D1-1
  const mossPathMat = makeSurfaceMat('paver_moss_stones', 2.2, 7.5);
  addBox(exteriorGroup, 2.10, 0.14, 7.50, mossPathMat, 1.12, -0.28, -3.75, false);
  // Porch entry landing slab & overhead dark canopy awning
  addBox(exteriorGroup, 2.20, 0.14, 1.25, makeSurfaceMat('paver_granite_grid', 2.2, 1.25), 1.12, -0.22, -0.62, true);
  addBox(exteriorGroup, 2.30, 0.08, 1.15, mat.darkIron, 1.12, 2.48, -0.58, true);

  // South Wooden Engawa Deck & Mossy Green-Wall Screen
  addBox(exteriorGroup, 4.90, 0.18, 1.35, makeSurfaceMat('wood_deck', 4.90, 1.35), 2.50, -0.14, 10.68, true);
  addBox(exteriorGroup, 0.14, 2.10, 1.30, makeSurfaceMat('green_wall', 1.30, 2.10), 4.92, 0.95, 10.68, true);
  addBox(exteriorGroup, 0.14, 2.10, 1.30, makeSurfaceMat('wood_lattice_dark', 1.30, 2.10), 0.08, 0.95, 10.68, true);

  // Outdoor AC Condenser unit tucked neatly on East plinth
  addBox(exteriorGroup, 0.34, 0.62, 0.78, makeFrontMat('prop_ac_outdoor'), 5.20, 0.02, 2.65, true);

  // Scattered Mossy Cliff Boulders around forest perimeter (strictly outside house)
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rockMossMat = makeSurfaceMat('rock_mossy_cliff', 2.5, 2.5, { roughness: 0.88 });
  const rockWetMat = makeSurfaceMat('rock_wet_black', 2.0, 2.0, { roughness: 0.34 });
  const boulderCoords = [
    [-2.4, -2.6, 0.95, 0.55], [6.8, -1.8, 1.15, 0.65], [-3.2, 4.5, 1.25, 0.72],
    [7.4, 6.2, 1.10, 0.62], [-2.6, 12.6, 1.05, 0.58], [6.9, 12.8, 1.30, 0.78],
    [2.8, 13.8, 0.88, 0.45], [-4.5, 10.2, 1.40, 0.82],
  ];
  boulderCoords.forEach(([bx, bz, sx, sy], i) => {
    const rMesh = new THREE.Mesh(rockGeo, i % 2 === 0 ? rockMossMat : rockWetMat);
    rMesh.position.set(bx, -0.35 + sy * 0.45, bz);
    rMesh.scale.set(sx, sy, sx * 0.88);
    rMesh.rotation.set(i * 0.4, i * 1.1, 0.15);
    rMesh.receiveShadow = true;
    exteriorGroup.add(rMesh);
  });

  // GPU Vertex-Shader Wind-Animated Instanced Towering Old-Growth Japanese Cedars (16m - 24m tall!)
  const windTimeUniform = { value: 0 };
  let seed = 42081;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const treeSpecs = [];
  const attempts = 1100;
  for (let i = 0; i < attempts && treeSpecs.length < 275; i++) {
    const tx = -34 + rand() * 73;
    const tz = -34 + rand() * 78;
    // STRICT ZERO-CLIPPING HOUSE & ROOF EAVE CLEARANCE ENVELOPE:
    // House is X=[0..5], Z=[0..10]. Keeping trunk centers strictly outside X=[-3.25..8.25] & Z=[-3.65..13.65]
    // with slender spire width <= 1.85m guarantees ZERO foliage clipping on 1F, 2F, 3F, or Attic!
    const inHouseClear = tx > -3.25 && tx < 8.25 && tz > -3.65 && tz < 13.65;
    const inTrailClear = tx > -0.6 && tx < 2.9 && tz > -9.0 && tz <= 0.0;
    if (inHouseClear || inTrailClear) continue;

    // Mix of 20% lush mid-story young cedars (5-10m, filling 1F/2F views) and 80% towering ancient cedars (16-25m, enveloping 3F/Attic!)
    const isUnderstory = i % 5 === 0;
    const h = isUnderstory ? (5.2 + rand() * 4.8) : (16.0 + rand() * 9.0);
    const rad = isUnderstory ? (0.11 + rand() * 0.08) : (0.20 + rand() * 0.18);
    const cw = isUnderstory ? (0.95 + rand() * 0.55) : (1.15 + rand() * 0.68);
    treeSpecs.push({ x: tx, z: tz, h, rad, cw, rot: rand() * Math.PI * 2 });
    if (tx > -6 && tx < 11 && tz > -7 && tz < 15) {
      treeColliders.push({ x: tx, z: tz, r: rad + 0.14 });
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.45, 1.0, 1.0, 7);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = makeSurfaceMat('yakisugi_dark', 1.2, 4.5, { color: 0x6b5c4e, roughness: 0.92 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpecs.length);
  trunkInst.castShadow = false;
  trunkInst.receiveShadow = true;

  // 4-tier slender layered old-growth cedar spire canopy (from low 1F boughs all the way to 25m!)
  const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 7);
  coneGeo.translate(0, 0.5, 0);
  const foliageDeepMat = new THREE.MeshStandardMaterial({ color: 0x172b1c, roughness: 0.88, metalness: 0.0 });
  const foliageMidMat = new THREE.MeshStandardMaterial({ color: 0x203b25, roughness: 0.85, metalness: 0.0 });
  injectForestWindShader(foliageDeepMat, windTimeUniform);
  injectForestWindShader(foliageMidMat, windTimeUniform);

  const tier1Inst = new THREE.InstancedMesh(coneGeo, foliageDeepMat, treeSpecs.length);
  const tier2Inst = new THREE.InstancedMesh(coneGeo, foliageMidMat, treeSpecs.length);
  const tier3Inst = new THREE.InstancedMesh(coneGeo, foliageDeepMat, treeSpecs.length);
  const tier4Inst = new THREE.InstancedMesh(coneGeo, foliageMidMat, treeSpecs.length);
  [tier1Inst, tier2Inst, tier3Inst, tier4Inst].forEach((im) => {
    im.castShadow = false;
    im.receiveShadow = true;
  });

  const dummy = new THREE.Object3D();
  treeSpecs.forEach((t, i) => {
    dummy.position.set(t.x, -0.35, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.set(t.rad, t.h * 0.72, t.rad);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    const tiers = [
      [tier1Inst, t.h * 0.14, t.cw * 1.02, t.h * 0.36],
      [tier2Inst, t.h * 0.36, t.cw * 0.85, t.h * 0.32],
      [tier3Inst, t.h * 0.58, t.cw * 0.65, t.h * 0.27],
      [tier4Inst, t.h * 0.78, t.cw * 0.43, t.h * 0.24],
    ];
    for (const [inst, yOff, w, th] of tiers) {
      dummy.position.set(t.x, -0.35 + yOff, t.z);
      dummy.rotation.set(0, t.rot + yOff * 0.3, 0);
      dummy.scale.set(w, th, w);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
  });
  [trunkInst, tier1Inst, tier2Inst, tier3Inst, tier4Inst].forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    exteriorGroup.add(im);
  });

  // Forest Underbrush Ferns (strictly outside X=[-2.0..7.0], Z=[-2.8..12.8])
  const bushGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1a301e, roughness: 0.92 });
  const bushSpecs = [];
  for (let i = 0; i < 240 && bushSpecs.length < 95; i++) {
    const bx = -16 + rand() * 37;
    const bz = -16 + rand() * 42;
    if (bx > -2.0 && bx < 7.0 && bz > -2.8 && bz < 12.8) continue;
    bushSpecs.push({ x: bx, z: bz, s: 0.65 + rand() * 0.95 });
  }
  const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushSpecs.length);
  bushSpecs.forEach((b, i) => {
    dummy.position.set(b.x, -0.20, b.z);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(b.s * 1.25, b.s * 0.58, b.s * 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
  });
  bushInst.instanceMatrix.needsUpdate = true;
  exteriorGroup.add(bushInst);

  // Exterior Moonlit Canopy Fill Lights (non-shadow-casting so forest cedars read richly from 1F–Attic windows!)
  [
    [2.5, 4.5, 16.5, 0x4a73a3, 1.85, 22],
    [2.5, 10.5, 16.5, 0x5682b6, 2.25, 24],
    [2.5, 5.5, -7.5, 0x446894, 1.45, 20],
    [2.5, 10.5, -7.5, 0x4e76a6, 1.85, 22],
  ].forEach(([lx, ly, lz, col, inten, dist]) => {
    const l = new THREE.PointLight(col, inten, dist, 1.4);
    l.position.set(lx, ly, lz);
    exteriorGroup.add(l);
  });

  // Drifting Nocturnal Forest Fireflies spanning 1F ground (Y=0.6m) all the way up to Attic treetops (Y=11.4m)!
  const ffCount = 84;
  const ffPositions = new Float32Array(ffCount * 3);
  const ffSeeds = [];
  for (let i = 0; i < ffCount; i++) {
    let fx, fz;
    do {
      fx = -11 + rand() * 27;
      fz = -11 + rand() * 32;
    } while (fx > -0.6 && fx < 5.6 && fz > -0.6 && fz < 10.6);
    const fy = 0.65 + rand() * 10.8;
    ffPositions[i * 3] = fx;
    ffPositions[i * 3 + 1] = fy;
    ffPositions[i * 3 + 2] = fz;
    ffSeeds.push({ x: fx, y: fy, z: fz, sp: 0.45 + rand() * 0.75, ph: rand() * Math.PI * 2 });
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPositions, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xd9ff8a,
    size: 0.10,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  exteriorGroup.add(fireflies);

  // =========================================================================
  // 8. POCO F7 (ADRENO 825) MATERIAL-BUCKETED STATIC GEOMETRY BATCHING
  // =========================================================================
  const { batchedGroup, stats: batchStats } = batchStaticGroups(
    [staticGroup, furnitureGroup],
    excludeBatch,
  );
  root.add(batchedGroup);

  return {
    root,
    collidersByFloor,
    treeColliders,
    interactiveDoors,
    interactiveProps,
    interiorLights,
    fireflies,
    ffSeeds,
    windTimeUniform,
    batchStats,
  };
}
