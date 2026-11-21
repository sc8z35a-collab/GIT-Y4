import * as THREE from 'three';
import { FLOORS, HOUSE, getAtticCeilingY } from './planData.js';
import { makeSurfaceMat, makeFrontMat, createSharedMaterials } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';
import { injectForestWindShader } from './volumetricAtmosphere.js';
import { buildAnnex3D } from './buildAnnex3d.js';
import { buildStorage3D } from './buildStorage3d.js';
import { buildCamper3D } from './buildCamper3d.js';
import { buildKeiCar3D } from './buildKeiCar3d.js';

export function buildHouse3D(scene) {
  const mat = createSharedMaterials();

  const root = new THREE.Group();
  root.name = 'Narrow50Tower8LevelRoot';
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

  // 8 levels: 0=B1F, 1=1F, 2=2F, 3=3F, 4=4F, 5=5F, 6=6F, 7=RF/Attic
  const collidersByFloor = [[], [], [], [], [], [], [], []];
  const treeColliders = [];
  const boulderColliders = [];
  const interactiveDoors = [];
  const interactiveProps = [];
  const interiorLights = [];
  const excludeBatch = new Set();

  function addCollider(floorIdx, minX, minZ, maxX, maxZ) {
    if (floorIdx < 0 || floorIdx >= collidersByFloor.length) return;
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
    const startActive = floor === HOUSE.spawnFloor;
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

    const frameMat = op.tex === 'door_navy' || op.tex === 'exterior_siding_grey'
      ? mat.darkIron
      : (op.tex === 'door_white' ? mat.creamTrim : mat.walnut);
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
      : makeFrontMat(op.tex || 'door_oak', { roughness: op.tex === 'exterior_siding_grey' ? 0.58 : 0.44, metalness: op.tex === 'exterior_siding_grey' ? 0.35 : 0.05 });
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
        const hX = hingeAtStart ? panelW - 0.11 : -panelW + 0.11;
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.08), op.tex === 'door_navy' ? mat.bronze : mat.chrome);
        h1.position.set(hX, 0.94, 0);
        pivot.add(h1);
      } else {
        pivot.position.set(centerOrtho, sillY, hingeCoord);
        const geo = new THREE.BoxGeometry(panelT, panelH, panelW);
        mesh = new THREE.Mesh(geo, [panelMat, panelMat, edgeMat, edgeMat, edgeMat, edgeMat]);
        mesh.position.set(0, panelH / 2, offset);
        const hZ = hingeAtStart ? panelW - 0.11 : -panelW + 0.11;
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.11), mat.chrome);
        h1.position.set(0, 0.94, hZ);
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
    const wallH = floorDef.slabTopY - baseY;

    for (const wall of floorDef.walls) {
      const isH = wall.axis === 'h';
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;

      const isMinSide = isH ? wall.z1 < 3.0 : wall.x1 < 0.2;
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
  // 1. STRUCTURAL SLABS WITH EXACT STAIRWELL CUTOUTS (B1F, 1F, 2F, 3F, 4F, RF)
  // =========================================================================
  function addSlottedSlab(slabBottomY, slabTopY, ceilTex, addExteriorBand = true) {
    const h = slabTopY - slabBottomY;
    const midY = slabBottomY + h / 2;
    const sb = HOUSE.stairBox;
    const subMat = mat.wallCutCap;
    const cMat = makeSurfaceMat(ceilTex, 4.7, 4.5, { roughness: 0.90 });

    const rects = [
      { x1: 0.0, x2: 5.0, z1: 0.0, z2: sb.topZ },
      { x1: 0.0, x2: 5.0, z1: sb.bottomZ, z2: 10.0 },
      { x1: sb.maxX, x2: 5.0, z1: sb.topZ, z2: sb.bottomZ },
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
    if (addExteriorBand) {
      addBox(staticGroup, 5.08, h * 0.72, 0.04, mat.darkIron, 2.5, midY, -0.02, false);
      addBox(staticGroup, 5.08, h * 0.72, 0.04, mat.darkIron, 2.5, midY, 10.02, false);
      addBox(staticGroup, 0.04, h * 0.72, 10.08, mat.darkIron, -0.02, midY, 5.0, false);
      addBox(staticGroup, 0.04, h * 0.72, 10.08, mat.darkIron, 5.02, midY, 5.0, false);
    }
  }

  // B1F Base Concrete Foundation Slab (solid bottom at Y=-2.40m)
  const b1SlabMat = makeSurfaceMat('concrete_clean', 5.0, 7.6, { roughness: 0.88 });
  addBox(staticGroup, 5.20, 0.24, 7.80, b1SlabMat, 2.50, -2.52, 6.15, false);

  // Exterior Foundation Plinth Skirt around perimeter (never blocks ST0 stairwell cutout!)
  const cisternMat = makeSurfaceMat('stone_cistern_grey', 5.2, 0.42);
  const mossPlinthMat = makeSurfaceMat('stone_moss_wall', 10.2, 0.38);
  addBox(staticGroup, 5.16, 0.40, 0.14, cisternMat, 2.50, -0.20, -0.05, false);
  addBox(staticGroup, 5.16, 0.40, 0.14, cisternMat, 2.50, -0.20, 10.05, false);
  addBox(staticGroup, 0.14, 0.40, 10.20, mossPlinthMat, -0.05, -0.20, 5.00, false);
  addBox(staticGroup, 0.14, 0.40, 10.20, mossPlinthMat, 5.05, -0.20, 5.00, false);

  // Slotted Structural Slabs leaving exact stairwell void X=0.15..1.15, Z=2.45..5.15
  addSlottedSlab(-0.38, 0.00, 'concrete_clean', false); // B1F low cement ceiling (CH 2.02m) / 1F floor!
  addSlottedSlab(2.50, 2.75, 'ceiling_acoustic', true); // 1F ceiling / 2F floor
  addSlottedSlab(5.25, 5.50, 'wallpaper_white', true);  // 2F ceiling / 3F floor
  addSlottedSlab(7.95, 8.15, 'wood_planks_dark', true); // 3F ceiling / 4F floor
  addSlottedSlab(10.30, 10.50, 'ceiling_acoustic', true); // 4F slightly low ceiling (CH 2.15m) / 5F floor
  addSlottedSlab(13.05, 13.25, 'wood_planks_dark', true); // 5F lofted wellness/studio ceiling (CH 2.55m) / 6F floor!
  addSlottedSlab(15.90, 16.10, 'ceiling_acoustic', true); // 6F crown penthouse ceiling (CH 2.65m) / Attic floor!

  function addFloorPatch(x1, z1, x2, z2, y, texName, extra = {}) {
    const w = x2 - x1;
    const d = z2 - z1;
    const m = makeSurfaceMat(texName, w, d, extra);
    addBox(staticGroup, w, 0.016, d, m, (x1 + x2) / 2, y + 0.008, (z1 + z2) / 2, false);
  }

  // =========================================================================
  // 2. FLOOR FINISHES & WALLS FOR B1F, 1F, 2F, 3F, 4F, 5F, 6F
  // =========================================================================
  // B1F Grey Cement Floors (Y = -2.40) + Exposed Low Concrete Ceiling Beams
  const yb = -2.40;
  addFloorPatch(0.15, 2.45, 4.85, 9.85, yb, 'concrete_clean', { roughness: 0.88 });
  // Drainage metal grate channel along East edge of 3m×7m hall
  addFloorPatch(2.94, 3.00, 3.12, 9.65, yb + 0.006, 'metal_grate', { roughness: 0.46, metalness: 0.65 });
  // Low heavy cast-in-place concrete beams across B1F ceiling (emphasizing narrow low bunker ceiling!)
  const beamMat = makeSurfaceMat('concrete_pcon', 4.7, 0.22);
  [3.50, 5.45, 7.45, 9.20].forEach((bz) => {
    addBox(staticGroup, 4.70, 0.14, 0.22, beamMat, 2.50, -0.45, bz, false);
  });

  // 1F Floors (Y = 0.00) — respecting stairwell cutout X=0.15..1.15, Z=2.45..5.15!
  addFloorPatch(0.15, 0.15, 2.15, 1.35, -0.12, 'terrazzo_white');
  addBox(staticGroup, 2.00, 0.13, 0.08, mat.oak, 1.15, -0.055, 1.35, false);
  addFloorPatch(0.15, 1.35, 2.15, 2.45, 0.0, 'wood_floor');
  addFloorPatch(1.25, 2.45, 2.15, 5.25, 0.0, 'wood_floor');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, 0.0, 'tile_grey_stone');
  addFloorPatch(2.25, 3.55, 3.35, 5.20, 0.0, 'tile_beige_grid');
  addFloorPatch(3.45, 3.55, 4.85, 5.20, 0.0, 'terrazzo_emerald');
  addFloorPatch(0.15, 5.15, 4.85, 9.85, 0.0, 'wood_floor');
  addBox(staticGroup, 1.40, 0.31, 1.40, mat.oak, 4.15, 0.155, 9.15, true);
  addFloorPatch(3.46, 8.46, 4.84, 9.84, 0.312, 'tatami');

  // 2F Floors (Y = 2.75)
  const y2 = 2.75;
  addFloorPatch(0.15, 0.15, 2.15, 2.45, y2, 'wood_walnut_floor');
  addFloorPatch(1.25, 2.45, 2.15, 5.95, y2, 'wood_walnut_floor');
  addFloorPatch(0.15, 5.15, 1.25, 5.95, y2, 'wood_walnut_floor');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, y2, 'carpet_charcoal_tile');
  addFloorPatch(2.25, 3.55, 3.50, 5.95, y2, 'terrazzo_white');
  addFloorPatch(3.60, 3.55, 4.85, 5.95, y2 - 0.02, 'tile_blue_bath');
  addFloorPatch(0.15, 6.05, 4.85, 9.85, y2, 'wood_walnut_floor');

  // 3F Floors (Y = 5.50)
  const y3 = 5.50;
  addFloorPatch(0.15, 0.15, 2.15, 2.45, y3, 'parquet_oak');
  addFloorPatch(1.25, 2.45, 2.15, 5.95, y3, 'parquet_oak');
  addFloorPatch(0.15, 5.15, 1.25, 5.95, y3, 'parquet_oak');
  addFloorPatch(2.25, 0.15, 4.85, 3.45, y3, 'tatami_ryukyu');
  addFloorPatch(2.25, 3.55, 3.45, 5.95, y3, 'tile_checker_stone');
  addFloorPatch(3.55, 3.55, 4.85, 5.95, y3, 'parquet_oak');
  addFloorPatch(0.15, 6.05, 4.85, 9.85, y3, 'parquet_oak');

  // 4F Floors (Y = 8.15) — Pro Designer 5 Rooms + 1m×2m Forest Balcony
  const y4f = 8.15;
  addFloorPatch(0.15, 0.15, 2.15, 1.55, y4f, 'carpet_charcoal_tile'); // 4R01 Listening Room
  addFloorPatch(0.15, 1.55, 2.15, 2.45, y4f, 'wood_floor');           // North Stair Landing
  addFloorPatch(1.25, 2.45, 2.15, 5.95, y4f, 'wood_floor');           // Compact Spine
  addFloorPatch(0.15, 5.15, 1.25, 5.95, y4f, 'wood_floor');           // South Vestibule
  addFloorPatch(2.25, 0.15, 4.85, 3.45, y4f, 'wood_floor');           // 4R02 Guest Bedroom
  addFloorPatch(2.25, 3.55, 4.85, 5.95, y4f, 'parquet_oak');          // 4R03 Dressing Studio
  addFloorPatch(0.15, 6.05, 2.45, 9.85, y4f, 'wood_walnut_floor');    // 4R04 Treetop Library
  addFloorPatch(2.45, 6.05, 4.85, 9.85, y4f, 'wood_floor');           // 4R05 Sky Lounge

  // 4F Cantilevered 1.00m × 2.00m Forest Canopy Balcony (X=2.65..4.65, Z=10.00..11.00)
  const bal = HOUSE.balcony4F;
  const balW = bal.maxX - bal.minX; // 2.00m
  const balD = bal.maxZ - bal.minZ; // 1.00m
  const balCX = (bal.minX + bal.maxX) / 2; // 3.65m
  const balCZ = (bal.minZ + bal.maxZ) / 2; // 10.50m
  addBox(staticGroup, balW + 0.08, 0.16, balD + 0.06, mat.darkIron, balCX, y4f - 0.10, balCZ, true);
  // Structural steel diagonal cantilever struts beneath 4F balcony
  [bal.minX + 0.14, bal.maxX - 0.14].forEach((bx) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 1.08), mat.darkIron);
    strut.position.set(bx, y4f - 0.34, bal.minZ + 0.44);
    strut.rotation.x = -0.34;
    staticGroup.add(strut);
  });
  addFloorPatch(bal.minX, bal.minZ, bal.maxX, bal.maxZ, y4f - 0.02, 'wood_deck');
  // Balcony sleek iron & tempered glass balustrade railing (H = 1.10m)
  const railH = 1.10;
  // Top handrails
  addBox(staticGroup, balW + 0.04, 0.045, 0.045, mat.darkIron, balCX, y4f + railH, bal.maxZ - 0.02, false);
  addBox(staticGroup, 0.045, 0.045, balD + 0.04, mat.darkIron, bal.minX + 0.02, y4f + railH, balCZ, false);
  addBox(staticGroup, 0.045, 0.045, balD + 0.04, mat.darkIron, bal.maxX - 0.02, y4f + railH, balCZ, false);
  // Corner & intermediate posts
  [[bal.minX + 0.02, bal.minZ + 0.02], [bal.minX + 0.02, bal.maxZ - 0.02], [balCX, bal.maxZ - 0.02], [bal.maxX - 0.02, bal.maxZ - 0.02], [bal.maxX - 0.02, bal.minZ + 0.02]].forEach(([px, pz]) => {
    addBox(staticGroup, 0.04, railH, 0.04, mat.darkIron, px, y4f + railH / 2, pz, false);
  });
  // Tempered glass balustrade panels
  const gBalS = addBox(dynamicGroup, balW - 0.08, railH - 0.12, 0.018, mat.glassClear, balCX, y4f + railH / 2, bal.maxZ - 0.02, false);
  const gBalW = addBox(dynamicGroup, 0.018, railH - 0.12, balD - 0.08, mat.glassClear, bal.minX + 0.02, y4f + railH / 2, balCZ, false);
  const gBalE = addBox(dynamicGroup, 0.018, railH - 0.12, balD - 0.08, mat.glassClear, bal.maxX - 0.02, y4f + railH / 2, balCZ, false);
  [gBalS, gBalW, gBalE].forEach((g) => { g.userData.noBatch = true; });
  // Balcony safety colliders on Floor 4
  addCollider(4, bal.minX - 0.06, bal.minZ, bal.minX + 0.04, bal.maxZ + 0.06);
  addCollider(4, bal.maxX - 0.04, bal.minZ, bal.maxX + 0.06, bal.maxZ + 0.06);
  addCollider(4, bal.minX - 0.06, bal.maxZ - 0.04, bal.maxX + 0.06, bal.maxZ + 0.08);

  // 5F Floors (Y = 10.50, CH 2.55m) — Architect's Studio, Hinoki Sauna & Sky Bath, Botanical Conservatory + West Spa Deck!
  const y5f = 10.50;
  addFloorPatch(0.15, 0.15, 2.15, 2.45, y5f, 'terrazzo_white');         // 5R01 Botanical Landing
  addFloorPatch(1.25, 2.45, 2.15, 5.95, y5f, 'terrazzo_white');         // 5R06 Gallery Spine
  addFloorPatch(0.15, 5.15, 1.25, 5.95, y5f, 'terrazzo_white');         // South Stair Vestibule
  addFloorPatch(2.25, 0.15, 4.85, 3.45, y5f, 'parquet_oak');            // 5R02 Architect's Model Studio
  addFloorPatch(2.25, 3.55, 3.50, 5.95, y5f, 'wood_deck');              // 5R03 Hinoki Finnish Sauna
  addFloorPatch(3.60, 3.55, 4.85, 5.95, y5f - 0.02, 'stone_wet_granite'); // 5R04 Canopy Hinoki Sky Bath
  addFloorPatch(0.15, 6.05, 2.55, 9.85, y5f, 'wood_floor');             // 5R05 Conservatory West Tea Lounge
  addFloorPatch(2.55, 6.05, 4.85, 9.85, y5f, 'terrazzo_emerald');       // 5R05 Conservatory East Botanical Zone
  // Flush brass inlay threshold dividing oak tea deck & emerald terrazzo botanical zone
  addBox(staticGroup, 0.025, 0.018, 3.80, mat.bronze, 2.55, y5f + 0.009, 7.95, false);

  // 5F Cantilevered 1.00m × 2.60m West Canopy Spa Cool-Down Deck (X=-1.00..0.00, Z=6.20..8.80)
  const bal5 = HOUSE.balcony5F;
  const b5W = bal5.maxX - bal5.minX; // 1.00m
  const b5D = bal5.maxZ - bal5.minZ; // 2.60m
  const b5CX = (bal5.minX + bal5.maxX) / 2; // -0.50m
  const b5CZ = (bal5.minZ + bal5.maxZ) / 2; // 7.50m
  addBox(staticGroup, b5W + 0.06, 0.16, b5D + 0.08, mat.darkIron, b5CX, y5f - 0.10, b5CZ, true);
  // Exposed diagonal steel cantilever brackets supporting 5F West Deck
  [bal5.minZ + 0.18, b5CZ, bal5.maxZ - 0.18].forEach((bz) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.10, 0.08), mat.darkIron);
    strut.position.set(-0.46, y5f - 0.34, bz);
    strut.rotation.z = -0.34;
    staticGroup.add(strut);
  });
  addFloorPatch(bal5.minX, bal5.minZ, bal5.maxX, bal5.maxZ, y5f - 0.02, 'wood_deck');
  // 5F West Deck sleek iron + tempered glass balustrade (H = 1.10m)
  addBox(staticGroup, 0.045, 0.045, b5D + 0.04, mat.darkIron, bal5.minX + 0.02, y5f + railH, b5CZ, false);
  addBox(staticGroup, b5W + 0.04, 0.045, 0.045, mat.darkIron, b5CX, y5f + railH, bal5.minZ + 0.02, false);
  addBox(staticGroup, b5W + 0.04, 0.045, 0.045, mat.darkIron, b5CX, y5f + railH, bal5.maxZ - 0.02, false);
  [[bal5.maxX - 0.02, bal5.minZ + 0.02], [bal5.minX + 0.02, bal5.minZ + 0.02], [bal5.minX + 0.02, b5CZ], [bal5.minX + 0.02, bal5.maxZ - 0.02], [bal5.maxX - 0.02, bal5.maxZ - 0.02]].forEach(([px, pz]) => {
    addBox(staticGroup, 0.04, railH, 0.04, mat.darkIron, px, y5f + railH / 2, pz, false);
  });
  const gBal5W = addBox(dynamicGroup, 0.018, railH - 0.12, b5D - 0.08, mat.glassClear, bal5.minX + 0.02, y5f + railH / 2, b5CZ, false);
  const gBal5N = addBox(dynamicGroup, b5W - 0.08, railH - 0.12, 0.018, mat.glassClear, b5CX, y5f + railH / 2, bal5.minZ + 0.02, false);
  const gBal5S = addBox(dynamicGroup, b5W - 0.08, railH - 0.12, 0.018, mat.glassClear, b5CX, y5f + railH / 2, bal5.maxZ - 0.02, false);
  [gBal5W, gBal5N, gBal5S].forEach((g) => { g.userData.noBatch = true; });
  // 5F West Deck safety colliders
  addCollider(5, bal5.minX - 0.08, bal5.minZ - 0.06, bal5.minX + 0.04, bal5.maxZ + 0.06);
  addCollider(5, bal5.minX - 0.06, bal5.minZ - 0.06, bal5.maxX, bal5.minZ + 0.04);
  addCollider(5, bal5.minX - 0.06, bal5.maxZ - 0.04, bal5.maxX, bal5.maxZ + 0.06);

  // 6F Floors (Y = 13.25, CH 2.65m) — Crown Sky Penthouse, Starlight Tatami, Sky Powder, Wine/Coffee Cellar, Observatory Salon + Full-Width Sky Terrace!
  const y6f = 13.25;
  addFloorPatch(0.15, 0.15, 2.15, 2.45, y6f, 'wood_walnut_floor');      // 6R01 Star-Chart Landing
  addFloorPatch(1.25, 2.45, 2.15, 5.95, y6f, 'wood_walnut_floor');      // 6R06 Crown Gallery Spine
  addFloorPatch(0.15, 5.15, 1.25, 5.95, y6f, 'wood_walnut_floor');      // South Stair Vestibule
  // 6R02 Authentic Japanese Ita-no-ma walnut border framing central Ryukyu tatami mat field
  addFloorPatch(2.25, 0.15, 4.85, 3.45, y6f, 'wood_walnut_floor');
  addFloorPatch(2.55, 0.45, 4.55, 3.15, y6f + 0.006, 'tatami_ryukyu');
  addFloorPatch(2.25, 3.55, 3.45, 5.95, y6f, 'marble_black');           // 6R03 Sky Powder WC
  addFloorPatch(3.55, 3.55, 4.85, 5.95, y6f, 'tile_checker_stone');     // 6R04 Wine & Coffee Cellar
  addFloorPatch(0.15, 6.05, 4.85, 9.85, y6f, 'wood_walnut_floor');      // 6R05 Observatory Salon & Espresso Bar

  // 6F Full-Width Cantilevered South Sky Observatory Terrace (X=0.20..4.80, Z=10.00..11.10 -> 4.60m × 1.10m!)
  const bal6 = HOUSE.balcony6F;
  const b6W = bal6.maxX - bal6.minX; // 4.60m
  const b6D = bal6.maxZ - bal6.minZ; // 1.10m
  const b6CX = (bal6.minX + bal6.maxX) / 2; // 2.50m
  const b6CZ = (bal6.minZ + bal6.maxZ) / 2; // 10.55m
  addBox(staticGroup, b6W + 0.10, 0.18, b6D + 0.08, mat.darkIron, b6CX, y6f - 0.11, b6CZ, true);
  // 4 Structural tapered steel outrigger brackets under 6F Crown Sky Terrace
  [0.42, 1.80, 3.20, 4.58].forEach((bx) => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 1.18), mat.darkIron);
    strut.position.set(bx, y6f - 0.38, bal6.minZ + 0.48);
    strut.rotation.x = -0.36;
    staticGroup.add(strut);
  });
  addFloorPatch(bal6.minX, bal6.minZ, bal6.maxX, bal6.maxZ, y6f - 0.02, 'wood_deck');
  // 6F Sky Terrace frameless-style dark iron + tempered glass balustrade (H = 1.10m)
  addBox(staticGroup, b6W + 0.04, 0.045, 0.045, mat.darkIron, b6CX, y6f + railH, bal6.maxZ - 0.02, false);
  addBox(staticGroup, 0.045, 0.045, b6D + 0.04, mat.darkIron, bal6.minX + 0.02, y6f + railH, b6CZ, false);
  addBox(staticGroup, 0.045, 0.045, b6D + 0.04, mat.darkIron, bal6.maxX - 0.02, y6f + railH, b6CZ, false);
  [
    [bal6.minX + 0.02, bal6.minZ + 0.02], [bal6.minX + 0.02, bal6.maxZ - 0.02],
    [1.35, bal6.maxZ - 0.02], [2.50, bal6.maxZ - 0.02], [3.65, bal6.maxZ - 0.02],
    [bal6.maxX - 0.02, bal6.maxZ - 0.02], [bal6.maxX - 0.02, bal6.minZ + 0.02],
  ].forEach(([px, pz]) => {
    addBox(staticGroup, 0.042, railH, 0.042, mat.darkIron, px, y6f + railH / 2, pz, false);
  });
  const gBal6S = addBox(dynamicGroup, b6W - 0.08, railH - 0.12, 0.018, mat.glassClear, b6CX, y6f + railH / 2, bal6.maxZ - 0.02, false);
  const gBal6W = addBox(dynamicGroup, 0.018, railH - 0.12, b6D - 0.08, mat.glassClear, bal6.minX + 0.02, y6f + railH / 2, b6CZ, false);
  const gBal6E = addBox(dynamicGroup, 0.018, railH - 0.12, b6D - 0.08, mat.glassClear, bal6.maxX - 0.02, y6f + railH / 2, b6CZ, false);
  [gBal6S, gBal6W, gBal6E].forEach((g) => { g.userData.noBatch = true; });
  // 6F Overhead Architectural Steel & Cedar Louver Sky Pergola (Y = 15.85m, shadows moonlight across terrace!)
  const pergY = y6f + 2.60;
  addBox(staticGroup, b6W + 0.10, 0.09, 0.08, mat.darkIron, b6CX, pergY, bal6.maxZ - 0.04, true);
  addBox(staticGroup, 0.08, 0.09, b6D + 0.06, mat.darkIron, bal6.minX + 0.04, pergY, b6CZ, true);
  addBox(staticGroup, 0.08, 0.09, b6D + 0.06, mat.darkIron, bal6.maxX - 0.04, pergY, b6CZ, true);
  // Corner pergola tie posts rising cleanly from outer railing corners to pergola beam
  [bal6.minX + 0.04, bal6.maxX - 0.04].forEach((px) => {
    addBox(staticGroup, 0.055, 2.60, 0.055, mat.darkIron, px, y6f + 1.30, bal6.maxZ - 0.04, false);
  });
  for (let lx = bal6.minX + 0.36; lx <= bal6.maxX - 0.32; lx += 0.39) {
    addBox(staticGroup, 0.045, 0.075, b6D - 0.08, mat.walnut, lx, pergY, b6CZ, true);
  }
  // 6F Sky Terrace safety colliders
  addCollider(6, bal6.minX - 0.06, bal6.minZ, bal6.minX + 0.04, bal6.maxZ + 0.06);
  addCollider(6, bal6.maxX - 0.04, bal6.minZ, bal6.maxX + 0.06, bal6.maxZ + 0.06);
  addCollider(6, bal6.minX - 0.06, bal6.maxZ - 0.04, bal6.maxX + 0.06, bal6.maxZ + 0.08);

  // Attic Floors (Y = 16.10, Floor Index 7 = HOUSE.atticFloor)
  const attY = HOUSE.atticBaseY; // 16.10
  const attFloorIdx = HOUSE.atticFloor; // 7
  addFloorPatch(0.15, 0.15, 2.15, 2.45, attY, 'rubber_black_stud');
  addFloorPatch(1.20, 2.45, 2.15, 5.20, attY, 'rubber_black_stud');
  addFloorPatch(2.15, 0.15, 4.85, 5.25, attY, 'wood_scratched_cedar');
  addFloorPatch(0.15, 5.20, 4.85, 9.85, attY, 'wood_scratched_cedar');
  addFloorPatch(1.30, 6.15, 3.70, 8.75, attY + 0.015, 'tatami_aged');

  // Build Walls for Floors 0 (B1F), 1 (1F), 2 (2F), 3 (3F), 4 (4F), 5 (5F), 6 (6F)
  for (let fi = 0; fi < attFloorIdx; fi++) {
    buildStandardFloorWalls(FLOORS[fi]);
  }

  // =========================================================================
  // 3. STACKED 7-FLIGHT ARCHITECTURAL STAIRCASES (ST0, ST1, ST2, ST3, ST4, ST5, ST6)
  // =========================================================================
  function buildStairFlight(flightIdx, yStart, yEnd, treadTex, isConcrete = false) {
    const sb = HOUSE.stairBox;
    const steps = sb.treads;
    const rise = (yEnd - yStart) / steps;
    const run = (sb.bottomZ - sb.topZ) / steps;
    const treadMat = makeSurfaceMat(treadTex, 0.96, 0.25, { roughness: isConcrete ? 0.88 : 0.45 });
    const riserMat = isConcrete ? treadMat : (flightIdx === 1 ? mat.darkIron : mat.walnut);
    const stairW = sb.maxX - sb.minX - 0.04;
    const centerX = (sb.minX + sb.maxX) / 2;

    for (let i = 0; i < steps; i++) {
      const sy = yStart + (i + 1) * rise;
      const sz = sb.bottomZ - (i + 0.5) * run;
      addBox(staticGroup, stairW, isConcrete ? 0.08 : 0.045, run + 0.03, treadMat, centerX, sy - (isConcrete ? 0.04 : 0.022), sz, true);
      if (isConcrete || flightIdx > 1) {
        addBox(staticGroup, stairW - 0.01, rise, 0.032, riserMat, centerX, sy - rise / 2, sz + run / 2, false);
      } else {
        addBox(staticGroup, stairW - 0.04, rise * 0.48, 0.02, mat.darkIron, centerX, sy - rise * 0.26, sz + run / 2, false);
      }
    }

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
    if (flightIdx > 1 || isConcrete) {
      const soffit = new THREE.Mesh(new THREE.BoxGeometry(stairW + 0.02, 0.045, slopeLen), isConcrete ? treadMat : mat.walnut);
      soffit.position.set(centerX, midY - 0.14, midZ);
      soffit.rotation.x = pitchAngle;
      staticGroup.add(soffit);
    }

    // Handrail along East wall
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, slopeLen), isConcrete ? mat.darkIron : mat.oak);
    rail.position.set(sb.maxX - 0.045, midY + 0.88, midZ);
    rail.rotation.x = pitchAngle;
    staticGroup.add(rail);

    // Subtle step guide LED strip along West wall (dim cool-amber in basement, warm oak upstairs)
    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.024, slopeLen * 0.92),
      new THREE.MeshBasicMaterial({ color: isConcrete ? 0x9eb8cc : 0xffc67c }),
    );
    ledStrip.position.set(sb.minX + 0.012, midY + 0.22, midZ);
    ledStrip.rotation.x = pitchAngle;
    staticGroup.add(ledStrip);
  }

  buildStairFlight(0, -2.40, 0.00, 'concrete_clean', true);        // ST0: B1F <-> 1F (Grey Cement!)
  buildStairFlight(1, 0.00, 2.75, 'wood_floor', false);            // ST1: 1F <-> 2F
  buildStairFlight(2, 2.75, 5.50, 'wood_walnut_floor', false);     // ST2: 2F <-> 3F
  buildStairFlight(3, 5.50, 8.15, 'parquet_oak', false);           // ST3: 3F <-> 4F
  buildStairFlight(4, 8.15, 10.50, 'wood_floor', false);           // ST4: 4F <-> 5F
  buildStairFlight(5, 10.50, 13.25, 'wood_walnut_floor', false);   // ST5: 5F <-> 6F
  buildStairFlight(6, 13.25, 16.10, 'wood_scratched_cedar', false);// ST6: 6F <-> Attic RF!

  // Sleek dark-iron portal header on 1F Entry Hall marking entrance down ST0 into B1F
  addBox(staticGroup, 1.02, 0.08, 0.08, mat.darkIron, 0.65, 2.15, 2.45, false);

  // Architectural Brass Floor-Level Identification Plaques & Ceiling Smoke Detectors across all 8 levels!
  const plaqueFloorYs = [-2.40, 0.00, 2.75, 5.50, 8.15, 10.50, 13.25];
  plaqueFloorYs.forEach((fy, idx) => {
    // Sleek brushed-bronze floor plaque on RC core wall facing North landing / corridor
    addBox(staticGroup, 0.015, 0.16, 0.12, mat.bronze, 1.26, fy + 1.56, 2.72, false);
    addBox(staticGroup, 0.018, 0.025, 0.08, mat.darkIron, 1.263, fy + 1.56, 2.72, false);
    // Low-profile ceiling smoke/heat sensor puck in central gallery spine (Japanese 6-story fire code!)
    if (idx >= 1) {
      const ch = FLOORS[idx].ceilingH;
      const detector = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.024, 12), mat.whiteMatte);
      detector.position.set(1.70, fy + ch - 0.015, 3.85);
      staticGroup.add(detector);
    }
  });

  // =========================================================================
  // 4. FLOOR 7 — 6寸勾配 GABLE ATTIC ROOF (Y = 16.10 .. 18.93 m + LIGHTNING MAST)
  // =========================================================================
  const kneeH = HOUSE.atticKneewallH; // 1.42
  const eaveY = HOUSE.atticEaveY;     // 17.52
  const ridgeY = HOUSE.atticRidgeY;   // 18.93

  addWallBox(staticGroup, 0.15, kneeH, 9.70, 0.075, attY + kneeH / 2, 5.0, 'yakisugi_deep', 'wainscot_rustic', 'v');
  addWallBox(staticGroup, 0.15, kneeH, 9.70, 4.925, attY + kneeH / 2, 5.0, 'wainscot_rustic', 'yakisugi_deep', 'v');
  addCollider(attFloorIdx, 0.0, 0.0, 0.16, 10.0);
  addCollider(attFloorIdx, 4.84, 0.0, 5.0, 10.0);

  function buildGableEndWall(z1, z2, isNorth, winOp, intTex) {
    const thick = z2 - z1;
    const cz = (z1 + z2) / 2;
    const extTex = 'yakisugi_deep';
    const frontTex = isNorth ? extTex : intTex;
    const backTex = isNorth ? intTex : extTex;

    const wx1 = winOp.pos;
    const wx2 = winOp.pos + winOp.width;
    const sillY = attY + winOp.sill;
    const winTopY = sillY + winOp.height;

    addWallBox(staticGroup, wx1, kneeH, thick, wx1 / 2, attY + kneeH / 2, cz, frontTex, backTex, 'h');
    addWallBox(staticGroup, 5.0 - wx2, kneeH, thick, (wx2 + 5.0) / 2, attY + kneeH / 2, cz, frontTex, backTex, 'h');
    addWallBox(staticGroup, winOp.width, winOp.sill, thick, (wx1 + wx2) / 2, attY + winOp.sill / 2, cz, frontTex, backTex, 'h');
    addWindowFrame(winOp, { axis: 'h', z1, z2 }, attY);
    addCollider(attFloorIdx, 0.0, z1, 5.0, z2);

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

    makeGableFace(z2, isNorth ? intMatGable : extMatGable, false);
    makeGableFace(z1, isNorth ? extMatGable : intMatGable, true);
  }

  buildGableEndWall(0.0, 0.15, true, FLOORS[attFloorIdx].walls[0].openings[0], 'wood_scratched_cedar');
  buildGableEndWall(9.85, 10.0, false, FLOORS[attFloorIdx].walls[1].openings[0], 'wallpaper_vintage_floral');

  const roofAngle = Math.atan(HOUSE.atticSlope);
  const extRun = 2.50 + 0.50;
  const extSlopeLen = extRun / Math.cos(roofAngle);
  const roofDepth = 10.90;
  const slateRoofMat = makeSurfaceMat('slate_charcoal', extSlopeLen, roofDepth, { roughness: 0.64 });
  const plywoodCeilMat = makeSurfaceMat('plywood_attic', 2.85, 9.70, { roughness: 0.78 });

  [-1, 1].forEach((side) => {
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(extSlopeLen, 0.12, roofDepth), slateRoofMat);
    rMesh.position.set(2.5 + side * (extRun / 2), ridgeY + 0.10 - (extRun / 2) * HOUSE.atticSlope, 5.0);
    rMesh.rotation.z = -side * roofAngle;
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    staticGroup.add(rMesh);

    const intRun = 2.40;
    const intSlopeLen = intRun / Math.cos(roofAngle);
    const cMesh = new THREE.Mesh(new THREE.BoxGeometry(intSlopeLen, 0.04, 9.72), plywoodCeilMat);
    cMesh.position.set(2.5 + side * (intRun / 2), ridgeY - 0.02 - (intRun / 2) * HOUSE.atticSlope, 5.0);
    cMesh.rotation.z = -side * roofAngle;
    cMesh.receiveShadow = true;
    staticGroup.add(cMesh);
  });

  // Rooftop Architectural Ridge Cap, Ventilation Louvers, & 6-Story Lightning Protection / Anemometer Mast (Y=18.93..20.42m)
  addBox(staticGroup, 0.24, 0.10, roofDepth + 0.04, mat.darkIron, 2.50, ridgeY + 0.18, 5.0, false);
  [1.80, 8.20].forEach((vz) => {
    addBox(staticGroup, 0.34, 0.18, 1.30, mat.darkIron, 2.50, ridgeY + 0.28, vz, false);
    addBox(staticGroup, 0.36, 0.04, 1.36, mat.bronze, 2.50, ridgeY + 0.38, vz, false);
  });
  // Lightning Rod + Weather Anemometer Mast on South Ridge Crown (code-compliant for ~20m tower!)
  const lightningMast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 1.48, 8), mat.chrome);
  lightningMast.position.set(2.50, ridgeY + 0.92, 9.25);
  staticGroup.add(lightningMast);
  const lightningTip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 8), mat.bronze);
  lightningTip.position.set(2.50, ridgeY + 1.72, 9.25);
  staticGroup.add(lightningTip);
  addBox(staticGroup, 0.42, 0.02, 0.02, mat.chrome, 2.50, ridgeY + 1.32, 9.25, false);
  addBox(staticGroup, 0.02, 0.02, 0.42, mat.chrome, 2.50, ridgeY + 1.32, 9.25, false);

  // Exposed Walnut Structural Ridge Beam, Rafters & Collar Ties in Attic
  addBox(staticGroup, 0.14, 0.22, 9.75, mat.walnut, 2.50, ridgeY - 0.14, 5.0, true);
  for (let rz = 0.65; rz <= 9.55; rz += 1.25) {
    [-1, 1].forEach((side) => {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.11, 0.08), mat.walnut);
      rafter.position.set(2.5 + side * 1.18, ridgeY - 0.10 - 1.18 * HOUSE.atticSlope, rz);
      rafter.rotation.z = -side * roofAngle;
      rafter.castShadow = true;
      staticGroup.add(rafter);
    });
    addBox(staticGroup, 2.35, 0.09, 0.08, mat.walnut, 2.50, attY + 2.07, rz, true);
  }

  // Attic Stairwell Iron Safety Guardrail
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
  addCollider(attFloorIdx, 1.14, 2.45, 1.24, 5.24);
  addCollider(attFloorIdx, 0.15, 5.14, 1.24, 5.24);

  addBox(staticGroup, 1.72, 1.38, 0.08, makeSurfaceMat('wood_lattice_dark', 1.72, 1.38), 3.98, attY + 0.69, 5.25, true);
  addBox(staticGroup, 1.72, 1.38, 0.02, makeSurfaceMat('pegboard_wood', 1.72, 1.38), 3.98, attY + 0.69, 5.30, false);
  addCollider(attFloorIdx, 3.10, 5.18, 4.85, 5.33);

  // Continuous 6-Story SRC Exterior Corner Steel Pilasters (0 -> 17.56m, full 6-story height!)
  [[0.02, 0.02], [4.98, 0.02], [0.02, 9.98], [4.98, 9.98]].forEach(([cx, cz]) => {
    addBox(staticGroup, 0.12, 17.56, 0.12, mat.darkIron, cx, 8.78, cz, false);
  });
  // Intermediate Structural Facade Steel Mullion Columns aligned to Grid Axes (Y3=2.45, Y5=5.25, X3=2.20)
  [[0.00, 2.45], [0.00, 5.25], [5.00, 2.45], [5.00, 5.25]].forEach(([cx, cz]) => {
    addBox(staticGroup, 0.07, 16.10, 0.08, mat.darkIron, cx, 8.05, cz, false);
  });
  // Architectural Exterior Seismic Tension X-Bracing across Stair-Core Structural Bay (Z=2.45..5.25 on 4F, 5F, 6F!)
  [[8.15, 10.50], [10.50, 13.25], [13.25, 16.10]].forEach(([yLo, yHi]) => {
    const dy = yHi - yLo;
    const dz = 2.80;
    const diagLen = Math.hypot(dy, dz);
    const diagAng = Math.atan2(dy, dz);
    const midY = (yLo + yHi) / 2;
    [-0.035, 5.035].forEach((fx) => {
      [1, -1].forEach((sgn) => {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.045, diagLen), mat.darkIron);
        brace.position.set(fx, midY, 3.85);
        brace.rotation.x = sgn * diagAng;
        staticGroup.add(brace);
      });
      // Center gusset node plate
      addBox(staticGroup, 0.042, 0.16, 0.16, mat.bronze, fx, midY, 3.85, false);
    });
  });
  // Exterior Vertical Cedar/Bronze Architectural Sun-Shading Louvers framing 5F & 6F North/South Facades
  for (let lz = 0; lz < 4; lz++) {
    addBox(staticGroup, 0.045, 5.50, 0.14, mat.bronze, 2.18 + lz * 0.12, 13.25, -0.05, false);
  }
  // Vertical MEP Plumbing Stack Vent Cap exiting roof over East wet zone (X=3.52, Z=4.80)
  const ventStack = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.55, 10), mat.darkIron);
  ventStack.position.set(3.52, getAtticCeilingY(3.52) + 0.30, 4.80);
  staticGroup.add(ventStack);
  const ventCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 10), mat.darkIron);
  ventCap.position.set(3.52, getAtticCeilingY(3.52) + 0.60, 4.80);
  staticGroup.add(ventCap);

  // =========================================================================
  // 5. DETAILED INTERIOR FURNISHINGS & PROPS ACROSS ALL 6 LEVELS
  // =========================================================================
  function addFramedArt(parent, texName, w, h, x, y, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.025), mat.walnut));
    const art = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), makeFrontMat(texName, { roughness: 0.55 }));
    art.position.z = 0.004;
    g.add(art);
    parent.add(g);
  }

  const crateMat = makeSurfaceMat('crate_wood', 0.55, 0.55);
  const burlapMat = makeSurfaceMat('burlap_sack', 0.6, 0.6);
  const steelRackMat = new THREE.MeshStandardMaterial({ color: 0x5c636b, roughness: 0.48, metalness: 0.62 });
  const shelfDeckMat = new THREE.MeshStandardMaterial({ color: 0x737a82, roughness: 0.58, metalness: 0.42 });
  const cartonMat = new THREE.MeshStandardMaterial({ color: 0x8f7758, roughness: 0.88, metalness: 0.02 });
  const denimMat = makeSurfaceMat('fabric_denim', 0.5, 0.5);

  // ---------- B1F FURNISHING (Y = -2.40, CH = 2.02m): 3 STORAGE ROOMS × EXACTLY 5 WAREHOUSE RACKS EACH! ----------
  /**
   * Builds a realistic 4-tier industrial grey steel warehouse rack (W0.66 × D0.34 × H1.74m)
   * stocked with crates/cartons, rotated cleanly along either X or Z wall.
   */
  function addWarehouseRack(cx, cz, alongZ, seedOffset) {
    const rackW = alongZ ? 0.34 : 0.66;
    const rackD = alongZ ? 0.66 : 0.34;
    const rackH = 1.74;
    const hw = rackW / 2 - 0.018;
    const hd = rackD / 2 - 0.018;
    // 4 steel angle posts
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([dx, dz]) => {
      addBox(furnitureGroup, 0.028, rackH, 0.028, steelRackMat, cx + dx, yb + rackH / 2, cz + dz, false);
    });
    // 4 horizontal steel shelf levels
    const shelfYs = [0.16, 0.64, 1.12, 1.62];
    shelfYs.forEach((sy, lvl) => {
      addBox(furnitureGroup, rackW, 0.028, rackD, shelfDeckMat, cx, yb + sy, cz, false);
      // Place varied crates/storage boxes on shelves so every rack looks genuinely stocked
      if ((lvl + seedOffset) % 2 === 0) {
        const bw = alongZ ? 0.24 : 0.25;
        const bd = alongZ ? 0.25 : 0.24;
        const off = alongZ ? [0, -0.14] : [-0.14, 0];
        addBox(furnitureGroup, bw, 0.26, bd, lvl % 2 === 0 ? crateMat : cartonMat, cx + off[0], yb + sy + 0.145, cz + off[1], false);
      }
      if ((lvl + seedOffset) % 3 !== 1) {
        const bw = alongZ ? 0.24 : 0.24;
        const bd = alongZ ? 0.24 : 0.24;
        const off = alongZ ? [0, 0.15] : [0.15, 0];
        addBox(furnitureGroup, bw, 0.22, bd, lvl === 2 ? cartonMat : crateMat, cx + off[0], yb + sy + 0.125, cz + off[1], false);
      }
    });
    addCollider(0, cx - rackW / 2 - 0.02, cz - rackD / 2 - 0.02, cx + rackW / 2 + 0.02, cz + rackD / 2 + 0.02);
  }

  // Furnish ALL 3 Basement Storage Rooms (B02, B03, B04) with EXACTLY 5 WAREHOUSE RACKS EACH (= 15 racks total!)
  const b1StorageZones = [
    { z1: 2.85, z2: 5.10, id: 1 },
    { z1: 5.20, z2: 7.45, id: 2 },
    { z1: 7.55, z2: 9.85, id: 3 },
  ];
  b1StorageZones.forEach((sz, rIdx) => {
    const midZ = (sz.z1 + sz.z2) / 2;
    // Racks 1, 2, 3 lined up cleanly along the East wall (X = 4.66)
    addWarehouseRack(4.65, sz.z1 + 0.37, true, rIdx * 5 + 0);
    addWarehouseRack(4.65, midZ, true, rIdx * 5 + 1);
    addWarehouseRack(4.65, sz.z2 - 0.37, true, rIdx * 5 + 2);
    // Rack 4 along North side wall (X = 3.92, Z = z1 + 0.19)
    addWarehouseRack(3.92, sz.z1 + 0.20, false, rIdx * 5 + 3);
    // Rack 5 along South side wall (X = 3.92, Z = z2 - 0.19)
    addWarehouseRack(3.92, sz.z2 - 0.20, false, rIdx * 5 + 4);
  });

  // B1F Main 3m×7m Concrete Hall Details: exposed ceiling conduit pipes, dim caged bulkhead fixtures, ventilation grille
  addBox(furnitureGroup, 0.04, 0.04, 6.80, mat.darkIron, 3.08, -0.44, 6.35, false); // Steel electrical conduit pipe
  addBox(furnitureGroup, 0.04, 0.04, 6.80, mat.darkIron, 0.22, -0.44, 6.35, false);
  // Two dim caged industrial bulkhead lamps mounted to low concrete ceiling (giving eerie sparse basement glow)
  const dimBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b8,
    emissive: new THREE.Color(0xffb466),
    emissiveIntensity: 1.35,
    roughness: 0.35,
  });
  [5.65, 8.55].forEach((lz) => {
    addBox(furnitureGroup, 0.22, 0.06, 0.14, mat.darkIron, 1.75, -0.40, lz, false);
    addBox(furnitureGroup, 0.16, 0.05, 0.10, dimBulbMat, 1.75, -0.44, lz, false);
  });
  // Subtle concrete pillar / electrical box on South basement wall
  addBox(furnitureGroup, 0.42, 0.56, 0.12, mat.darkIron, 0.72, yb + 1.25, 9.78, false);

  // ---------- 1F FURNISHING (Y = 0.00, Floor Index 1) ----------
  addBox(furnitureGroup, 0.34, 0.78, 1.02, makeFrontMat('furniture_chest'), 0.33, 0.42, 0.72, true);
  addCollider(1, 0.15, 0.20, 0.52, 1.24);
  addBox(furnitureGroup, 0.68, 0.015, 0.46, makeFrontMat('doormat_coir', { roughness: 0.95 }), 1.10, -0.108, 0.52, false);
  addFramedArt(furnitureGroup, 'fixture_intercom', 0.18, 0.24, 2.13, 1.42, 1.55, -Math.PI / 2);
  addFramedArt(furnitureGroup, 'fixture_meter', 0.26, 0.34, 1.85, 1.72, 0.17, 0);

  // 1F NE Forest Gear & Firewood Room
  addBox(furnitureGroup, 0.42, 1.85, 1.35, makeSurfaceMat('timber_logs', 1.35, 1.85), 4.62, 0.925, 1.75, true);
  addCollider(1, 4.38, 1.05, 4.85, 2.45);
  addBox(furnitureGroup, 0.03, 1.15, 1.25, makeSurfaceMat('pegboard_wood', 1.25, 1.15), 4.83, 1.35, 2.90, false);
  addBox(furnitureGroup, 0.48, 0.48, 0.48, crateMat, 4.55, 0.24, 3.05, true);
  addBox(furnitureGroup, 0.44, 0.44, 0.44, crateMat, 4.52, 0.70, 3.02, true);
  addBox(furnitureGroup, 0.38, 1.75, 1.05, makeFrontMat('furniture_bookshelf'), 2.45, 0.875, 0.72, true);
  addCollider(1, 2.25, 0.18, 2.66, 1.26);
  addFramedArt(furnitureGroup, 'sign_recycle', 0.30, 0.22, 3.45, 1.32, 3.43, Math.PI);

  addFramedArt(furnitureGroup, 'art_poster_1', 0.42, 0.56, 1.27, 1.42, 3.30, Math.PI / 2);
  addFramedArt(furnitureGroup, 'art_poster_2', 0.42, 0.56, 1.27, 1.42, 4.45, Math.PI / 2);

  // 1F WC
  addBox(furnitureGroup, 0.02, 0.85, 1.45, makeSurfaceMat('tile_mosaic_mint', 1.45, 0.85), 3.33, 0.95, 4.38, false);
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, 2.85, 0.21, 3.92, true);
  addBox(furnitureGroup, 0.38, 0.78, 0.18, mat.ceramic, 2.85, 0.39, 3.66, true);
  addBox(furnitureGroup, 0.24, 0.14, 0.44, mat.ceramic, 3.20, 0.82, 4.78, false);
  addCollider(1, 2.62, 3.55, 3.12, 4.25);

  // 1F Utility Pantry
  addBox(furnitureGroup, 0.64, 1.78, 0.66, makeFrontMat('appliance_fridge', { roughness: 0.28, metalness: 0.25 }), 3.80, 0.89, 3.92, true);
  addCollider(1, 3.46, 3.56, 4.14, 4.28);
  addBox(furnitureGroup, 0.48, 0.85, 1.30, mat.oak, 4.58, 0.425, 4.28, true);
  addBox(furnitureGroup, 0.42, 0.04, 0.54, mat.stainless, 4.58, 0.86, 4.48, false);
  addCollider(1, 4.32, 3.60, 4.85, 4.96);

  // 1F LDK
  addBox(staticGroup, 0.04, 2.48, 2.35, makeSurfaceMat('wood_slats', 2.35, 2.48), 0.18, 1.24, 8.30, false);
  addBox(furnitureGroup, 0.36, 0.38, 1.85, mat.walnut, 0.38, 0.22, 8.30, true);
  addCollider(1, 0.16, 7.36, 0.58, 9.25);
  addBox(furnitureGroup, 0.05, 0.72, 1.24, mat.darkIron, 0.22, 1.18, 8.30, false);
  const tvScreenMat = makeFrontMat('appliance_tv_screen', { roughness: 0.16, emissive: 0x1a2838, emissiveIntensity: 0.35 });
  addBox(furnitureGroup, 0.055, 0.66, 1.18, tvScreenMat, 0.23, 1.18, 8.30, false);

  addBox(furnitureGroup, 1.85, 0.015, 2.15, makeSurfaceMat('carpet_beige', 1.85, 2.15), 1.55, 0.016, 8.30, false);
  const sofaMat = makeSurfaceMat('fabric_grey_sofa', 1.85, 0.82);
  addBox(furnitureGroup, 0.78, 0.38, 1.85, sofaMat, 2.18, 0.20, 8.35, true);
  addBox(furnitureGroup, 0.20, 0.68, 1.85, sofaMat, 2.48, 0.42, 8.35, true);
  addBox(furnitureGroup, 0.78, 0.54, 0.16, sofaMat, 2.18, 0.31, 7.48, true);
  addBox(furnitureGroup, 0.78, 0.54, 0.16, sofaMat, 2.18, 0.31, 9.22, true);
  addCollider(1, 1.76, 7.38, 2.60, 9.32);

  addBox(furnitureGroup, 0.52, 0.035, 0.96, mat.oak, 1.28, 0.36, 8.35, true);
  [[-0.20, -0.40], [0.20, -0.40], [-0.20, 0.40], [0.20, 0.40]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.035, 0.35, 0.035, mat.darkIron, 1.28 + dx, 0.175, 8.35 + dz, false);
  });
  addCollider(1, 1.00, 7.85, 1.56, 8.85);

  addBox(staticGroup, 0.03, 1.45, 2.85, makeSurfaceMat('tile_caramel_brick', 2.85, 1.45), 4.83, 1.55, 6.85, false);
  addBox(furnitureGroup, 0.64, 0.84, 2.72, makeSurfaceMat('furniture_kitchen_cab', 2.72, 0.84), 4.50, 0.42, 6.85, true);
  addBox(furnitureGroup, 0.66, 0.04, 2.74, makeSurfaceMat('marble_white', 2.74, 0.66), 4.50, 0.86, 6.85, false);
  addBox(furnitureGroup, 0.42, 0.02, 0.62, mat.stainless, 4.48, 0.882, 6.15, false);
  addBox(furnitureGroup, 0.03, 0.28, 0.03, mat.chrome, 4.72, 1.01, 6.15, false);
  addBox(furnitureGroup, 0.46, 0.02, 0.58, mat.darkIron, 4.48, 0.882, 7.45, false);
  addBox(furnitureGroup, 0.52, 0.55, 0.78, mat.darkIron, 4.56, 2.22, 7.45, true);
  addCollider(1, 4.16, 5.45, 4.85, 8.24);

  addBox(furnitureGroup, 0.80, 0.04, 1.28, mat.oak, 2.95, 0.73, 6.45, true);
  [[-0.32, -0.54], [0.32, -0.54], [-0.32, 0.54], [0.32, 0.54]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.04, 0.71, 0.04, mat.darkIron, 2.95 + dx, 0.355, 6.45 + dz, false);
  });
  addBox(furnitureGroup, 0.46, 0.02, 0.34, makeFrontMat('meal_teishoku'), 2.95, 0.76, 6.45, false);
  [6.18, 6.72].forEach((cz) => {
    addBox(furnitureGroup, 0.40, 0.04, 0.40, mat.oak, 2.38, 0.44, cz, true);
    addBox(furnitureGroup, 0.04, 0.42, 0.40, mat.oak, 2.20, 0.64, cz, true);
  });
  addCollider(1, 2.35, 5.78, 3.42, 7.12);
  addFramedArt(furnitureGroup, 'prop_wall_clock', 0.34, 0.34, 2.75, 1.82, 5.32, 0);
  addFramedArt(furnitureGroup, 'prop_calendar', 0.32, 0.44, 3.25, 1.62, 5.32, 0);
  addBox(furnitureGroup, 0.02, 0.75, 0.02, mat.darkIron, 2.95, 2.12, 6.45, false);
  const pd1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 16), mat.bronze);
  pd1.position.set(2.95, 1.72, 6.45);
  furnitureGroup.add(pd1);
  const pdBulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), mat.warmBulb);
  pdBulb1.position.set(2.95, 1.64, 6.45);
  furnitureGroup.add(pdBulb1);

  // 1F SE Raised Tatami Nook + Interactive Washi Lantern
  addBox(staticGroup, 0.03, 2.18, 1.38, makeSurfaceMat('plaster_ochre', 1.38, 2.18), 4.83, 1.41, 9.15, false);
  addBox(furnitureGroup, 0.56, 0.07, 0.56, makeFrontMat('zabuton_red', { roughness: 0.90 }), 4.02, 0.365, 9.05, false);
  const lantern1Mat = mat.washiGlow.clone();
  const lantern1Mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.38, 12), lantern1Mat);
  lantern1Mesh.position.set(4.52, 0.52, 8.80);
  lantern1Mesh.userData.propId = 'lantern_1f';
  lantern1Mesh.userData.noBatch = true;
  dynamicGroup.add(lantern1Mesh);
  excludeBatch.add(lantern1Mesh);
  addBox(furnitureGroup, 0.18, 0.03, 0.18, mat.walnut, 4.52, 0.335, 8.80, false);

  const l1Light = addLight('Tatami_Lantern', 1, 'ldk', 0xff9b42, 1.65, 5.2, 4.46, 0.68, 8.85);
  interactiveProps.push({
    id: 'lantern_1f', floor: 1, mesh: lantern1Mesh, isOn: true,
    getLabel() { return this.isOn ? '和紙行灯を消す' : '和紙行灯を点ける'; },
    toggle() { this.isOn = !this.isOn; lantern1Mat.emissiveIntensity = this.isOn ? 1.85 : 0.08; if (!this.isOn) l1Light.intensity = 0; },
  });

  // ---------- 2F FURNISHING (Y = 2.75, Floor Index 2) ----------
  addBox(furnitureGroup, 1.10, 0.42, 0.36, mat.oak, 1.12, y2 + 0.21, 0.36, true);
  addCollider(2, 0.55, 0.16, 1.70, 0.56);
  addFramedArt(furnitureGroup, 'art_poster_3', 0.46, 0.62, 2.13, y2 + 1.45, 0.85, -Math.PI / 2);

  addBox(staticGroup, 0.03, 2.48, 3.25, makeSurfaceMat('brick_red_classic', 3.25, 2.48), 4.83, y2 + 1.24, 1.80, false);
  addBox(furnitureGroup, 0.62, 0.045, 1.68, mat.oak, 4.50, y2 + 0.74, 1.75, true);
  addBox(furnitureGroup, 0.58, 0.72, 0.06, mat.darkIron, 4.50, y2 + 0.36, 0.96, false);
  addBox(furnitureGroup, 0.58, 0.72, 0.06, mat.darkIron, 4.50, y2 + 0.36, 2.54, false);
  addCollider(2, 4.16, 0.88, 4.85, 2.62);
  addBox(furnitureGroup, 0.46, 0.08, 0.46, denimMat, 3.78, y2 + 0.45, 1.75, true);
  addBox(furnitureGroup, 0.08, 0.46, 0.46, denimMat, 3.58, y2 + 0.68, 1.75, true);
  addBox(furnitureGroup, 0.06, 0.42, 0.06, mat.darkIron, 3.78, y2 + 0.22, 1.75, false);
  addBox(furnitureGroup, 0.025, 0.72, 1.15, makeSurfaceMat('cork_board', 1.15, 0.72), 4.82, y2 + 1.48, 1.75, false);
  addBox(furnitureGroup, 1.05, 0.88, 0.025, makeSurfaceMat('pegboard_wood', 1.05, 0.88), 3.45, y2 + 1.45, 3.42, false);
  addBox(furnitureGroup, 1.18, 1.85, 0.38, makeFrontMat('furniture_bookshelf'), 3.15, y2 + 0.925, 3.24, true);
  addCollider(2, 2.54, 3.04, 3.76, 3.45);

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
  const studyLight = addLight('Study_Desk', 2, 'study', 0xffbe6b, 1.95, 5.8, 4.25, y2 + 1.32, 1.55);
  interactiveProps.push({
    id: 'lamp_study', floor: 2, mesh: studyLampMesh, isOn: true,
    getLabel() { return this.isOn ? '書斎ランプを消す' : '書斎ランプを点ける'; },
    toggle() { this.isOn = !this.isOn; studyBulbMat.emissiveIntensity = this.isOn ? 2.6 : 0.08; if (!this.isOn) studyLight.intensity = 0; },
  });

  // 2F Washroom & Bath
  addBox(furnitureGroup, 0.88, 0.80, 0.50, makeFrontMat('furniture_vanity_base'), 2.86, y2 + 0.40, 3.82, true);
  addBox(furnitureGroup, 0.92, 0.04, 0.52, makeSurfaceMat('marble_white', 0.92, 0.52), 2.86, y2 + 0.82, 3.82, false);
  addBox(furnitureGroup, 0.82, 0.72, 0.03, mat.mirror, 2.86, y2 + 1.42, 3.58, false);
  addCollider(2, 2.40, 3.55, 3.34, 4.10);
  addBox(furnitureGroup, 0.62, 0.86, 0.62, makeFrontMat('appliance_washer', { roughness: 0.28 }), 2.88, y2 + 0.43, 5.60, true);
  addCollider(2, 2.54, 5.28, 3.22, 5.94);

  addBox(staticGroup, 0.03, 2.25, 2.35, makeSurfaceMat('stone_wet_granite', 2.35, 2.25), 4.83, y2 + 1.12, 4.75, false);
  addBox(furnitureGroup, 1.16, 0.54, 0.82, mat.ceramic, 4.22, y2 + 0.25, 5.48, true);
  addBox(furnitureGroup, 1.04, 0.04, 0.70, mat.water, 4.22, y2 + 0.48, 5.48, false);
  addBox(furnitureGroup, 0.03, 1.45, 0.03, mat.chrome, 4.78, y2 + 1.25, 4.40, false);
  addCollider(2, 3.62, 5.04, 4.84, 5.94);

  // 2F Master Bedroom Suite
  addBox(staticGroup, 4.65, 2.48, 0.03, makeSurfaceMat('wood_planks_dark', 4.65, 2.48), 2.50, y2 + 1.24, 6.08, false);
  addBox(furnitureGroup, 2.25, 0.015, 2.45, makeSurfaceMat('carpet_beige', 2.25, 2.45), 2.65, y2 + 0.018, 7.65, false);
  addBox(furnitureGroup, 1.62, 0.26, 2.08, mat.walnut, 2.88, y2 + 0.13, 7.16, true);
  addBox(furnitureGroup, 1.56, 0.24, 2.02, makeSurfaceMat('fabric_floral_quilt', 1.56, 2.02), 2.88, y2 + 0.38, 7.16, true);
  addBox(furnitureGroup, 0.56, 0.14, 0.34, makeFrontMat('fabric_rose_vintage'), 2.52, y2 + 0.55, 6.38, false);
  addBox(furnitureGroup, 0.56, 0.14, 0.34, makeFrontMat('fabric_sakura'), 3.24, y2 + 0.55, 6.38, false);
  addCollider(2, 2.04, 6.10, 3.72, 8.24);
  [1.82, 3.94].forEach((bx) => {
    addBox(furnitureGroup, 0.42, 0.48, 0.42, mat.walnut, bx, y2 + 0.24, 6.36, true);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.22, 12), mat.washiGlow);
    shade.position.set(bx, y2 + 0.66, 6.36);
    furnitureGroup.add(shade);
  });
  addBox(furnitureGroup, 0.58, 2.05, 1.95, makeFrontMat('furniture_wardrobe'), 0.46, y2 + 1.025, 7.45, true);
  addCollider(2, 0.15, 6.45, 0.78, 8.45);
  addBox(furnitureGroup, 0.44, 0.82, 0.92, makeFrontMat('furniture_chest'), 4.60, y2 + 0.41, 8.55, true);
  addCollider(2, 4.36, 8.08, 4.85, 9.02);
  addBox(furnitureGroup, 0.82, 0.26, 0.22, makeFrontMat('appliance_ac'), 0.85, y2 + 2.15, 6.20, false);
  const curtMat = makeSurfaceMat('curtain_botanical', 0.45, 1.85, { roughness: 0.9 });
  addBox(furnitureGroup, 0.34, 1.82, 0.05, curtMat, 0.35, y2 + 1.38, 9.78, false);
  addBox(furnitureGroup, 0.34, 1.82, 0.05, curtMat, 3.12, y2 + 1.38, 9.78, false);

  // ---------- 3F FURNISHING (Y = 5.50, Floor Index 3) ----------
  addBox(furnitureGroup, 1.10, 0.42, 0.36, mat.walnut, 1.12, y3 + 0.21, 0.36, true);
  addCollider(3, 0.55, 0.16, 1.70, 0.56);

  const washiGlowPanelMat = makeSurfaceMat('washi_paper', 1.45, 2.05, { emissive: 0xffaa55, emissiveIntensity: 0.55, roughness: 0.88 });
  addBox(furnitureGroup, 0.04, 2.05, 1.45, washiGlowPanelMat, 4.81, y3 + 1.15, 1.75, false);
  addBox(furnitureGroup, 0.06, 2.10, 0.05, mat.walnut, 4.80, y3 + 1.15, 1.02, false);
  addBox(furnitureGroup, 0.06, 2.10, 0.05, mat.walnut, 4.80, y3 + 1.15, 2.48, false);
  addBox(furnitureGroup, 1.55, 0.24, 0.05, makeSurfaceMat('bamboo_sudare', 1.55, 0.24), 3.57, y3 + 2.08, 0.18, false);
  addBox(furnitureGroup, 0.88, 0.04, 0.88, mat.walnut, 3.55, y3 + 0.33, 1.80, true);
  addBox(furnitureGroup, 0.70, 0.31, 0.70, mat.walnut, 3.55, y3 + 0.155, 1.80, false);
  addBox(furnitureGroup, 0.54, 0.07, 0.54, makeFrontMat('zabuton_red'), 2.86, y3 + 0.045, 1.80, false);
  addBox(furnitureGroup, 0.54, 0.07, 0.54, makeFrontMat('zabuton_red'), 4.24, y3 + 0.045, 1.80, false);
  addCollider(3, 3.08, 1.34, 4.02, 2.26);
  addBox(furnitureGroup, 0.76, 0.34, 0.96, makeSurfaceMat('fabric_rose_vintage', 0.96, 0.76), 4.42, y3 + 0.17, 2.92, true);
  addCollider(3, 4.02, 2.42, 4.84, 3.42);

  addBox(furnitureGroup, 0.54, 0.82, 1.05, makeSurfaceMat('marble_black', 1.05, 0.82), 3.16, y3 + 0.41, 4.30, true);
  const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.13, 16), mat.ceramic);
  vessel.position.set(3.15, y3 + 0.88, 4.30);
  furnitureGroup.add(vessel);
  addBox(furnitureGroup, 0.03, 0.72, 0.76, mat.mirror, 3.43, y3 + 1.44, 4.30, false);
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, 2.82, y3 + 0.21, 5.50, true);
  addCollider(3, 2.86, 3.74, 3.45, 4.86);
  addCollider(3, 2.58, 5.18, 3.08, 5.92);

  addBox(furnitureGroup, 0.44, 1.90, 2.15, mat.oak, 4.62, y3 + 0.95, 4.70, true);
  addBox(furnitureGroup, 0.38, 0.34, 0.75, makeFrontMat('folded_clothes'), 4.58, y3 + 1.15, 4.35, false);
  addBox(furnitureGroup, 0.38, 0.36, 0.42, crateMat, 4.58, y3 + 0.55, 5.15, false);
  addCollider(3, 4.36, 3.60, 4.85, 5.82);

  addBox(furnitureGroup, 0.62, 1.02, 1.72, makeSurfaceMat('marble_black', 1.72, 1.02), 3.78, y3 + 0.51, 7.60, true);
  addCollider(3, 3.44, 6.72, 4.12, 8.48);
  [7.20, 8.00].forEach((bz) => {
    const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.05, 14), mat.walnut);
    stoolTop.position.set(3.12, y3 + 0.70, bz);
    furnitureGroup.add(stoolTop);
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.70, 8), mat.darkIron);
    stoolLeg.position.set(3.12, y3 + 0.35, bz);
    furnitureGroup.add(stoolLeg);
    addBox(furnitureGroup, 0.018, 0.72, 0.018, mat.darkIron, 3.78, y3 + 2.10, bz, false);
    const meshShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.24, 14),
      makeSurfaceMat('mesh_bronze_fine', 0.4, 0.3, { emissive: 0xffa64d, emissiveIntensity: 0.75 }),
    );
    meshShade.position.set(3.78, y3 + 1.68, bz);
    furnitureGroup.add(meshShade);
  });
  const loungeSofaMat = makeSurfaceMat('fabric_grey_sofa', 1.95, 0.82);
  addBox(furnitureGroup, 1.90, 0.38, 0.80, loungeSofaMat, 1.48, y3 + 0.20, 8.15, true);
  addBox(furnitureGroup, 1.90, 0.68, 0.20, loungeSofaMat, 1.48, y3 + 0.42, 7.82, true);
  addCollider(3, 0.50, 7.72, 2.46, 8.58);
  addBox(furnitureGroup, 0.66, 0.045, 1.18, mat.oak, 0.52, y3 + 0.76, 6.85, true);
  addBox(furnitureGroup, 0.60, 0.74, 0.06, mat.darkIron, 0.52, y3 + 0.37, 6.32, false);
  addBox(furnitureGroup, 0.60, 0.74, 0.06, mat.darkIron, 0.52, y3 + 0.37, 7.38, false);
  addCollider(3, 0.16, 6.24, 0.88, 7.46);
  addFramedArt(furnitureGroup, 'art_posters_trio', 0.95, 0.54, 0.18, y3 + 1.56, 6.85, Math.PI / 2);

  // ---------- 4F FURNISHING (Y = 8.15, CH = 2.15m, Floor Index 4 — PRO-DESIGNER 5 ROOMS + 1×2m BALCONY!) ----------
  // Room 1: 4R01 NW Listening & Cinema Room (X=0.15..2.15, Z=0.15..1.55)
  addBox(staticGroup, 0.03, 2.12, 1.32, makeSurfaceMat('wood_slats', 1.32, 2.12), 0.18, y4f + 1.06, 0.82, false);
  addBox(furnitureGroup, 0.36, 0.48, 0.98, mat.walnut, 0.38, y4f + 0.24, 0.82, true); // Hi-Fi Turntable Console
  addBox(furnitureGroup, 0.28, 0.06, 0.36, mat.darkIron, 0.38, y4f + 0.51, 0.82, false); // Turntable deck
  addBox(furnitureGroup, 0.22, 0.42, 0.22, mat.walnut, 0.38, y4f + 0.70, 0.42, false); // Studio Monitor L
  addBox(furnitureGroup, 0.22, 0.42, 0.22, mat.walnut, 0.38, y4f + 0.70, 1.22, false); // Studio Monitor R
  addBox(furnitureGroup, 0.62, 0.34, 1.05, denimMat, 1.72, y4f + 0.17, 0.78, true); // Listening Low Lounge Seat
  addCollider(4, 0.15, 0.28, 0.60, 1.36);

  // Room 2: 4R02 NE Minimal Guest Bedroom (X=2.25..4.85, Z=0.15..3.45)
  addBox(furnitureGroup, 1.22, 0.22, 1.98, mat.oak, 4.18, y4f + 0.11, 1.65, true); // Low-profile platform bed (maximizes 2.15m CH feel!)
  addBox(furnitureGroup, 1.16, 0.18, 1.92, makeSurfaceMat('fabric_floral_quilt', 1.16, 1.92), 4.18, y4f + 0.30, 1.65, true);
  addBox(furnitureGroup, 0.52, 0.12, 0.32, makeFrontMat('fabric_sakura'), 4.18, y4f + 0.44, 0.86, false);
  addCollider(4, 3.54, 0.64, 4.82, 2.66);
  addBox(furnitureGroup, 1.05, 1.92, 0.44, makeFrontMat('furniture_wardrobe'), 2.86, y4f + 0.96, 3.22, true);
  addCollider(4, 2.30, 2.98, 3.42, 3.45);
  addFramedArt(furnitureGroup, 'art_poster_1', 0.44, 0.56, 3.12, y4f + 1.28, 0.18, 0);

  // Room 3: 4R03 Mid-East Walk-in Dressing & Vanity Studio (X=2.25..4.85, Z=3.55..5.95)
  addBox(furnitureGroup, 1.85, 1.96, 0.42, makeFrontMat('furniture_wardrobe'), 3.65, y4f + 0.98, 3.78, true); // Slim full-width wardrobe
  addCollider(4, 2.68, 3.55, 4.62, 4.02);
  addBox(furnitureGroup, 1.45, 0.74, 0.42, makeSurfaceMat('marble_white', 1.45, 0.42), 3.65, y4f + 0.37, 5.72, true); // Vanity Desk
  addBox(furnitureGroup, 1.25, 0.82, 0.03, mat.mirror, 3.65, y4f + 1.24, 5.92, false); // Backlit Mirror
  addBox(furnitureGroup, 0.38, 0.42, 0.38, denimMat, 3.65, y4f + 0.21, 5.18, true); // Ottoman
  addCollider(4, 2.90, 5.48, 4.42, 5.94);

  // Room 4: 4R04 SW Treetop Library & Study (X=0.15..2.40, Z=6.05..9.85)
  addBox(furnitureGroup, 0.36, 1.96, 1.45, makeFrontMat('furniture_bookshelf'), 0.35, y4f + 0.98, 6.82, true);
  addBox(furnitureGroup, 0.36, 1.96, 1.15, makeFrontMat('furniture_bookshelf'), 0.35, y4f + 0.98, 9.15, true);
  addCollider(4, 0.15, 6.08, 0.56, 7.56);
  addCollider(4, 0.15, 8.54, 0.56, 9.76);
  // Minimalist corner reading desk beneath South window W4F-5
  addBox(furnitureGroup, 1.38, 0.04, 0.56, mat.oak, 1.42, y4f + 0.72, 9.52, true);
  addBox(furnitureGroup, 0.04, 0.70, 0.52, mat.darkIron, 0.78, y4f + 0.35, 9.52, false);
  addBox(furnitureGroup, 0.04, 0.70, 0.52, mat.darkIron, 2.06, y4f + 0.35, 9.52, false);
  addCollider(4, 0.72, 9.22, 2.14, 9.84);
  addBox(furnitureGroup, 0.44, 0.44, 0.44, denimMat, 1.42, y4f + 0.22, 8.82, true);

  // Room 5: 4R05 SE Sky Lounge opening directly onto 1m×2m Forest Balcony (X=2.50..4.85, Z=6.05..9.85)
  addBox(furnitureGroup, 1.75, 0.015, 1.95, makeSurfaceMat('carpet_beige', 1.75, 1.95), 3.68, y4f + 0.016, 7.95, false);
  addBox(furnitureGroup, 1.48, 0.34, 0.74, sofaMat, 3.92, y4f + 0.18, 6.65, true); // Designer Low Sofa
  addBox(furnitureGroup, 1.48, 0.60, 0.18, sofaMat, 3.92, y4f + 0.36, 6.32, true);
  addCollider(4, 3.14, 6.18, 4.72, 7.06);
  addBox(furnitureGroup, 0.86, 0.035, 0.54, makeSurfaceMat('marble_white', 0.86, 0.54), 3.85, y4f + 0.35, 7.68, true); // Sculptural Low Table
  addBox(furnitureGroup, 0.68, 0.33, 0.36, mat.oak, 3.85, y4f + 0.165, 7.68, false);
  addCollider(4, 3.38, 7.38, 4.32, 7.98);
  addFramedArt(furnitureGroup, 'art_poster_2', 0.52, 0.68, 4.82, y4f + 1.24, 6.65, -Math.PI / 2);

  // 4F Balcony Outdoor Accent Stool & Exterior Wall Sconce
  addBox(furnitureGroup, 0.36, 0.44, 0.36, mat.walnut, 4.35, y4f + 0.20, 10.50, true);
  const balSconceBulb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.08), mat.washiGlow);
  balSconceBulb.position.set(2.92, y4f + 1.55, 10.04);
  furnitureGroup.add(balSconceBulb);

  // =========================================================================
  // MICRO-PROP ARTISAN HELPERS FOR ULTRA-PRECISION 5F & 6F INTERIORS
  // =========================================================================
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.95 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: new THREE.Color(0xff3c00), emissiveIntensity: 1.9, roughness: 0.45 });
  const growLedMat = new THREE.MeshStandardMaterial({ color: 0xffd6ec, emissive: new THREE.Color(0xff9ad0), emissiveIntensity: 1.45, roughness: 0.3 });
  const amberGlassMat = new THREE.MeshStandardMaterial({ color: 0xb86d28, roughness: 0.16, metalness: 0.12 });
  const wineGreenMat = new THREE.MeshStandardMaterial({ color: 0x1e4a2b, roughness: 0.14, metalness: 0.10 });
  const wineRedMat = new THREE.MeshStandardMaterial({ color: 0x4a1621, roughness: 0.14, metalness: 0.10 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc26e44, roughness: 0.24, metalness: 0.86 });
  const fireRedMat = new THREE.MeshStandardMaterial({ color: 0xb82820, roughness: 0.32, metalness: 0.35 });
  const blueprintPaperMat = new THREE.MeshStandardMaterial({ color: 0xdbe9f6, roughness: 0.86, metalness: 0.0 });
  const bookNavyMat = new THREE.MeshStandardMaterial({ color: 0x243447, roughness: 0.78 });
  const bookOchreMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3b, roughness: 0.78 });
  const lensCoatMat = new THREE.MeshStandardMaterial({ color: 0x3b76a8, roughness: 0.08, metalness: 0.72 });

  function addPottedPlant(px, py, pz, scale = 1.0, potMat = mat.terracotta) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.08 * scale, 0.16 * scale, 10), potMat);
    pot.position.set(px, py + 0.08 * scale, pz);
    furnitureGroup.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.10 * scale, 0.10 * scale, 0.02 * scale, 10), soilMat);
    soil.position.set(px, py + 0.155 * scale, pz);
    furnitureGroup.add(soil);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * scale, 0.018 * scale, 0.18 * scale, 6), mat.walnut);
    stem.position.set(px, py + 0.24 * scale, pz);
    furnitureGroup.add(stem);
    [[0, 0.34, 0, 0.13], [-0.08, 0.28, 0.06, 0.095], [0.08, 0.29, -0.05, 0.09]].forEach(([ox, oy, oz, r], idx) => {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(r * scale, 0), idx % 2 === 0 ? mat.foliage : mat.foliageLight);
      leaf.position.set(px + ox * scale, py + oy * scale, pz + oz * scale);
      leaf.scale.set(1.15, 0.72, 1.15);
      furnitureGroup.add(leaf);
    });
  }

  function addFireExtinguisherNiche(x, y, z) {
    addBox(furnitureGroup, 0.06, 0.62, 0.26, mat.darkIron, x, y + 0.36, z, false);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 10), fireRedMat);
    body.position.set(x + 0.02, y + 0.24, z);
    furnitureGroup.add(body);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.08, 8), mat.darkIron);
    valve.position.set(x + 0.02, y + 0.46, z);
    furnitureGroup.add(valve);
  }

  // ---------- 5F FURNISHING (Y = 10.50, CH = 2.55m, Floor Index 5 — STUDIO, SAUNA, SKY BATH, CONSERVATORY & WEST DECK!) ----------
  // 5R01: North Botanical Landing — Slatted Oak Planter Bench & Bonsai Collection
  addBox(furnitureGroup, 1.35, 0.38, 0.36, mat.oak, 1.08, y5f + 0.19, 0.36, true);
  addBox(furnitureGroup, 1.35, 0.04, 0.38, mat.walnut, 1.08, y5f + 0.39, 0.36, false);
  addPottedPlant(0.62, y5f + 0.41, 0.36, 1.05, mat.terracotta);
  addPottedPlant(1.10, y5f + 0.41, 0.36, 0.82, mat.ceramic);
  addPottedPlant(1.54, y5f + 0.41, 0.36, 0.95, mat.terracotta);
  addCollider(5, 0.38, 0.16, 1.78, 0.56);
  addFramedArt(furnitureGroup, 'art_poster_3', 0.48, 0.64, 2.13, y5f + 1.48, 0.72, -Math.PI / 2);
  addFireExtinguisherNiche(1.27, y5f, 4.65);

  // 5R02: NE Architect's Model & Drafting Studio (X=2.25..4.85, Z=0.15..3.45)
  // Tilted Architectural Drafting Table beneath North Panorama Window W5-2
  const draftTop = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.04, 0.74), mat.oak);
  draftTop.position.set(3.65, y5f + 0.80, 0.58);
  draftTop.rotation.x = 0.14;
  draftTop.castShadow = true;
  draftTop.receiveShadow = true;
  furnitureGroup.add(draftTop);
  // Crisp Blueprint Drawing Sheet & Brass T-Square Ruler resting right on angled drafting board!
  const bpSheet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.008, 0.56), blueprintPaperMat);
  bpSheet.position.set(3.58, y5f + 0.826, 0.58);
  bpSheet.rotation.x = 0.14;
  furnitureGroup.add(bpSheet);
  const tSqHead = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.28), mat.walnut);
  tSqHead.position.set(2.90, y5f + 0.832, 0.58);
  tSqHead.rotation.x = 0.14;
  furnitureGroup.add(tSqHead);
  const tSqBlade = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.01, 0.045), mat.bronze);
  tSqBlade.position.set(3.35, y5f + 0.834, 0.58);
  tSqBlade.rotation.x = 0.14;
  furnitureGroup.add(tSqBlade);
  // Pencil cup & colored scale ruler on corner of drafting desk
  const penCup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.09, 10), mat.walnut);
  penCup.position.set(4.28, y5f + 0.84, 0.36);
  furnitureGroup.add(penCup);
  // Steel trestle legs for drafting table
  [2.96, 4.34].forEach((lx) => {
    addBox(furnitureGroup, 0.045, 0.76, 0.62, mat.darkIron, lx, y5f + 0.38, 0.58, false);
  });
  addBox(furnitureGroup, 1.36, 0.04, 0.04, mat.darkIron, 3.65, y5f + 0.22, 0.58, false);
  addCollider(5, 2.82, 0.18, 4.48, 0.96);
  // Architect's Swivel Drafting Stool
  const stSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.05, 14), denimMat);
  stSeat.position.set(3.65, y5f + 0.56, 1.24);
  furnitureGroup.add(stSeat);
  const stPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.54, 8), mat.darkIron);
  stPost.position.set(3.65, y5f + 0.28, 1.24);
  furnitureGroup.add(stPost);
  const stRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 16), mat.chrome);
  stRing.rotation.x = Math.PI / 2;
  stRing.position.set(3.65, y5f + 0.22, 1.24);
  furnitureGroup.add(stRing);
  addCollider(5, 3.46, 1.06, 3.84, 1.42);

  // Interactive [E] Brass Articulating Architect's Desk Lamp on 5F Drafting Table!
  const draftBulbMat = mat.warmBulb.clone();
  addBox(furnitureGroup, 0.026, 0.38, 0.026, mat.bronze, 4.30, y5f + 0.96, 0.72, false);
  addBox(furnitureGroup, 0.26, 0.024, 0.024, mat.bronze, 4.18, y5f + 1.15, 0.72, false);
  const draftLampMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 14), mat.bronze);
  draftLampMesh.position.set(4.06, y5f + 1.10, 0.72);
  draftLampMesh.userData.propId = 'lamp_5f_drafting';
  draftLampMesh.userData.noBatch = true;
  dynamicGroup.add(draftLampMesh);
  excludeBatch.add(draftLampMesh);
  const draftLampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), draftBulbMat);
  draftLampBulb.position.set(4.06, y5f + 1.04, 0.72);
  dynamicGroup.add(draftLampBulb);
  excludeBatch.add(draftLampBulb);
  const studioDraftLight = addLight('5F_Studio_Drafting', 5, 'north', 0xffe0aa, 2.05, 6.8, 3.65, y5f + 1.55, 1.15);
  interactiveProps.push({
    id: 'lamp_5f_drafting', floor: 5, mesh: draftLampMesh, isOn: true,
    getLabel() { return this.isOn ? '製図デスク灯を消す' : '製図デスク灯を点ける'; },
    toggle() { this.isOn = !this.isOn; draftBulbMat.emissiveIntensity = this.isOn ? 2.6 : 0.08; if (!this.isOn) studioDraftLight.intensity = 0; },
  });

  // HERO SHOWPIECE: 1/50 Miniature Architectural Scale Model of the 6-Story NARROW-50 Tower on Walnut Museum Plinth!
  addBox(furnitureGroup, 0.64, 0.84, 0.82, mat.walnut, 4.46, y5f + 0.42, 2.12, true);
  addBox(furnitureGroup, 0.60, 0.03, 0.78, mat.foliage, 4.46, y5f + 0.855, 2.12, false); // Tiny site topography base
  // Tiny 6-story NARROW-50 Tower (5m×10m×18.9m @ 1/50 = 0.10m × 0.20m × 0.38m!)
  addBox(furnitureGroup, 0.10, 0.34, 0.20, mat.whiteMatte, 4.48, y5f + 1.04, 2.12, false);
  // Tiny horizontal floor bands + 4F/5F/6F miniature balconies
  for (let mf = 0; mf < 6; mf++) {
    addBox(furnitureGroup, 0.106, 0.008, 0.206, mat.darkIron, 4.48, y5f + 0.88 + mf * 0.055, 2.12, false);
  }
  addBox(furnitureGroup, 0.04, 0.012, 0.025, mat.oak, 4.50, y5f + 1.04, 2.23, false); // Mini 4F balcony
  addBox(furnitureGroup, 0.025, 0.012, 0.055, mat.oak, 4.41, y5f + 1.10, 2.16, false); // Mini 5F West deck
  addBox(furnitureGroup, 0.095, 0.012, 0.025, mat.oak, 4.48, y5f + 1.15, 2.23, false); // Mini 6F Sky terrace
  // Mini pitched gable roof on 1/50 model
  const miniRoof = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.06, 4), mat.darkIron);
  miniRoof.rotation.y = Math.PI / 4;
  miniRoof.scale.set(0.95, 1.0, 1.85);
  miniRoof.position.set(4.48, y5f + 1.24, 2.12);
  furnitureGroup.add(miniRoof);
  // Tiny neighboring Annex model & miniature forest cones on the site plinth!
  addBox(furnitureGroup, 0.095, 0.20, 0.16, mat.oakLight, 4.30, y5f + 0.97, 2.12, false);
  [[4.25, 1.84], [4.62, 1.86], [4.64, 2.38], [4.26, 2.38]].forEach(([tx, tz]) => {
    const miniTree = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 6), mat.foliageLight);
    miniTree.position.set(tx, y5f + 0.96, tz);
    furnitureGroup.add(miniTree);
  });
  addCollider(5, 4.10, 1.68, 4.84, 2.56);

  // Flat-File 5-Drawer Blueprint Cabinet along South Studio Wall + Rolled Blueprint Tube Rack + Material Sample Board
  addBox(furnitureGroup, 1.38, 0.78, 0.54, mat.oak, 3.24, y5f + 0.39, 3.16, true);
  for (let di = 0; di < 5; di++) {
    addBox(furnitureGroup, 1.28, 0.12, 0.02, mat.oakLight, 3.24, y5f + 0.11 + di * 0.145, 2.885, false);
    addBox(furnitureGroup, 0.18, 0.018, 0.026, mat.bronze, 3.24, y5f + 0.11 + di * 0.145, 2.87, false);
  }
  addBox(furnitureGroup, 1.42, 0.03, 0.56, makeSurfaceMat('marble_white', 1.42, 0.56), 3.24, y5f + 0.795, 3.16, false);
  addBox(furnitureGroup, 0.28, 0.04, 0.22, bookNavyMat, 2.85, y5f + 0.83, 3.14, false);
  addBox(furnitureGroup, 0.26, 0.035, 0.20, bookOchreMat, 2.88, y5f + 0.865, 3.16, false);
  // Pegboard + Architectural Material Swatch Board mounted above Flat-File Cabinet
  addBox(furnitureGroup, 1.32, 0.86, 0.025, makeSurfaceMat('pegboard_wood', 1.32, 0.86), 3.24, y5f + 1.50, 3.43, false);
  [mat.oak, mat.walnut, mat.bronze, mat.terracotta, mat.ceramic, mat.darkIron].forEach((swMat, si) => {
    addBox(furnitureGroup, 0.14, 0.14, 0.03, swMat, 2.74 + si * 0.20, y5f + 1.56, 3.41, false);
  });
  addCollider(5, 2.52, 2.86, 3.98, 3.45);
  // Rolled Blueprint Tube Stand in SE corner of Studio
  addBox(furnitureGroup, 0.42, 0.48, 0.38, mat.walnut, 4.54, y5f + 0.24, 3.20, true);
  [[4.42, 3.14], [4.54, 3.12], [4.66, 3.16], [4.48, 3.26], [4.61, 3.25]].forEach(([rx, rz], ri) => {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.72 + (ri % 2) * 0.12, 10), blueprintPaperMat);
    roll.position.set(rx, y5f + 0.52, rz);
    roll.rotation.z = (ri - 2) * 0.05;
    furnitureGroup.add(roll);
  });
  addCollider(5, 4.30, 2.98, 4.80, 3.44);

  // 5R03: Hinoki Finnish Dry Sauna (X=2.25..3.50, Z=3.55..5.95)
  addBox(staticGroup, 0.03, 2.28, 2.36, makeSurfaceMat('wood_slats', 2.36, 2.28), 2.28, y5f + 1.14, 4.75, false);
  addBox(staticGroup, 1.22, 2.28, 0.03, makeSurfaceMat('wood_slats', 1.22, 2.28), 2.88, y5f + 1.14, 5.92, false);
  // Two-Tier Cantilevered Hinoki Sauna Benches along South Wall + Warm Under-Bench Strip
  addBox(furnitureGroup, 1.18, 0.055, 0.40, mat.oakLight, 2.88, y5f + 0.44, 5.18, true);
  addBox(furnitureGroup, 1.18, 0.055, 0.52, mat.oakLight, 2.88, y5f + 0.86, 5.64, true);
  addBox(furnitureGroup, 1.18, 0.24, 0.04, mat.oak, 2.88, y5f + 1.24, 5.88, false); // Backrest slat
  addBox(furnitureGroup, 1.10, 0.02, 0.02, mat.washiGlow, 2.88, y5f + 0.81, 5.39, false); // Under-bench warm cove
  addCollider(5, 2.26, 4.98, 3.49, 5.94);
  // Electric Finnish Sauna Stove + Glowing Volcanic Sauna Stones + Löyly Bucket & Ladle
  addBox(furnitureGroup, 0.42, 0.68, 0.36, mat.darkIron, 3.20, y5f + 0.34, 3.78, true);
  addBox(furnitureGroup, 0.34, 0.06, 0.28, emberMat, 3.20, y5f + 0.67, 3.78, false);
  for (let si = 0; si < 8; si++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), mat.wallCutCap);
    stone.position.set(3.08 + (si % 4) * 0.08, y5f + 0.72 + (si >= 4 ? 0.04 : 0), 3.71 + Math.floor(si / 4) * 0.13);
    furnitureGroup.add(stone);
  }
  const loylyBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.20, 12), mat.oak);
  loylyBucket.position.set(2.58, y5f + 0.10, 3.76);
  furnitureGroup.add(loylyBucket);
  const loylyLadle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6), mat.oakLight);
  loylyLadle.position.set(2.62, y5f + 0.22, 3.76);
  loylyLadle.rotation.z = -0.45;
  furnitureGroup.add(loylyLadle);
  // Wall Sandglass Timer (oak frame + glass bulbs) & Brass Thermo-Hygrometer (brass bezel + white dial + needle)
  addBox(furnitureGroup, 0.06, 0.22, 0.025, mat.oak, 2.68, y5f + 1.48, 3.57, false);
  const sgTop = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.065, 8), mat.washiGlow);
  sgTop.rotation.x = Math.PI;
  sgTop.position.set(2.68, y5f + 1.515, 3.588);
  furnitureGroup.add(sgTop);
  const sgBot = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.065, 8), mat.washiGlow);
  sgBot.position.set(2.68, y5f + 1.445, 3.588);
  furnitureGroup.add(sgBot);
  const thermoDial = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.022, 16), mat.bronze);
  thermoDial.rotation.x = Math.PI / 2;
  thermoDial.position.set(2.96, y5f + 1.54, 3.57);
  furnitureGroup.add(thermoDial);
  const thermoFace = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.025, 16), mat.ceramic);
  thermoFace.rotation.x = Math.PI / 2;
  thermoFace.position.set(2.96, y5f + 1.54, 3.574);
  furnitureGroup.add(thermoFace);
  addBox(furnitureGroup, 0.045, 0.008, 0.008, mat.darkIron, 2.978, y5f + 1.552, 3.59, false);
  addCollider(5, 2.38, 3.56, 3.46, 4.02);

  // 5R04: Canopy Hinoki & Black Granite Sky Bath (X=3.60..4.85, Z=3.55..5.95)
  addBox(staticGroup, 0.03, 2.32, 2.36, makeSurfaceMat('stone_wet_granite', 2.36, 2.32), 4.83, y5f + 1.15, 4.75, false);
  // Deep Hinoki-Rimmed Black Granite Soaking Tub beneath East Canopy Window W5-5 (hollow 4-rail Hinoki rim revealing open water!)
  addBox(furnitureGroup, 1.18, 0.52, 0.90, makeSurfaceMat('stone_wet_granite', 1.18, 0.90), 4.22, y5f + 0.24, 5.46, true);
  // 4-sided hollow Hinoki timber coping rim framing the open shimmering bath water
  addBox(furnitureGroup, 1.22, 0.075, 0.085, mat.oakLight, 4.22, y5f + 0.54, 5.04, false); // North rim
  addBox(furnitureGroup, 1.22, 0.075, 0.085, mat.oakLight, 4.22, y5f + 0.54, 5.88, false); // South rim
  addBox(furnitureGroup, 0.085, 0.075, 0.78, mat.oakLight, 3.65, y5f + 0.54, 5.46, false); // West rim
  addBox(furnitureGroup, 0.085, 0.075, 0.78, mat.oakLight, 4.79, y5f + 0.54, 5.46, false); // East rim
  // Open shimmering turquoise hot-spring water surface clearly visible inside the Hinoki frame!
  addBox(furnitureGroup, 1.05, 0.04, 0.75, mat.water, 4.22, y5f + 0.515, 5.46, false);
  // Floating Hinoki Bath Tray + Ceramic Sake Cup + Brass Waterfall Spout
  addBox(furnitureGroup, 0.20, 0.025, 0.80, mat.oakLight, 3.94, y5f + 0.59, 5.46, false);
  const bathCup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.06, 10), mat.ceramic);
  bathCup.position.set(3.94, y5f + 0.63, 5.36);
  furnitureGroup.add(bathCup);
  addBox(furnitureGroup, 0.18, 0.038, 0.055, mat.bronze, 4.74, y5f + 0.74, 5.46, false);
  addCollider(5, 3.62, 5.00, 4.84, 5.94);
  // Overhead Rain Shower Column + Hinoki Bath Stool & Wooden Washbasin + Amenity Niche Bottles
  addBox(furnitureGroup, 0.03, 1.65, 0.03, mat.chrome, 4.76, y5f + 1.32, 3.88, false);
  const rainHead = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14), mat.chrome);
  rainHead.position.set(4.58, y5f + 2.12, 3.88);
  furnitureGroup.add(rainHead);
  addBox(furnitureGroup, 0.30, 0.24, 0.22, mat.oakLight, 4.54, y5f + 0.10, 3.78, true); // Hinoki stool
  const bathWashTub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.10, 12), mat.oakLight);
  bathWashTub.position.set(4.54, y5f + 0.27, 3.78);
  furnitureGroup.add(bathWashTub);
  // Recessed Amenity Shelf with 3 Botanical Soap/Oil Bottles
  addBox(furnitureGroup, 0.12, 0.025, 0.52, mat.oakLight, 4.76, y5f + 1.06, 4.65, false);
  [amberGlassMat, wineGreenMat, mat.ceramic].forEach((bm, bi) => {
    const btl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 10), bm);
    btl.position.set(4.75, y5f + 1.14, 4.48 + bi * 0.15);
    furnitureGroup.add(btl);
  });

  // 5R05: South Botanical Conservatory & Herbal Tea Lab (X=0.15..4.85, Z=6.05..9.85)
  // Exposed Architectural Walnut Ceiling Pergola Beams aligned to structural bays
  [6.95, 8.15, 9.35].forEach((bz) => {
    addBox(staticGroup, 4.70, 0.14, 0.10, mat.walnut, 2.50, y5f + 2.48, bz, false);
  });
  // Living Vertical Moss/Fern Green Wall on East Wall
  addBox(staticGroup, 0.04, 2.45, 2.35, makeSurfaceMat('green_wall', 2.35, 2.45), 4.82, y5f + 1.24, 8.15, false);
  // 3-Tier Steel & Oak Botanical Grow Rack along North-East Conservatory Wall with Full-Spectrum Grow LEDs!
  [2.92, 4.64].forEach((gx) => {
    [6.14, 6.56].forEach((gz) => {
      addBox(furnitureGroup, 0.032, 1.92, 0.032, mat.darkIron, gx, y5f + 0.96, gz, false);
    });
  });
  [0.24, 0.88, 1.52].forEach((sy, lvl) => {
    addBox(furnitureGroup, 1.78, 0.035, 0.46, mat.oak, 3.78, y5f + sy, 6.35, true);
    addBox(furnitureGroup, 1.62, 0.018, 0.04, growLedMat, 3.78, y5f + sy + 0.56, 6.35, false);
    addPottedPlant(3.22, y5f + sy + 0.02, 6.35, 0.88, lvl % 2 === 0 ? mat.terracotta : mat.ceramic);
    addPottedPlant(3.78, y5f + sy + 0.02, 6.35, 0.96, mat.terracotta);
    addPottedPlant(4.32, y5f + sy + 0.02, 6.35, 0.84, mat.ceramic);
  });
  addCollider(5, 2.82, 6.06, 4.72, 6.65);

  // Botanical Apothecary & Herbal Tea Marble Counter along East Wall
  addBox(furnitureGroup, 0.62, 0.84, 1.92, mat.walnut, 4.50, y5f + 0.42, 8.18, true);
  addBox(furnitureGroup, 0.65, 0.04, 1.96, makeSurfaceMat('marble_white', 1.96, 0.65), 4.50, y5f + 0.86, 8.18, false);
  // 6 Miniature Apothecary Glass Herb Jars + Mortar & Pestle + Copper Watering Can + Brass Gooseneck Kettle!
  for (let ji = 0; ji < 6; ji++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.11 + (ji % 2) * 0.03, 10), ji % 2 === 0 ? amberGlassMat : wineGreenMat);
    jar.position.set(4.64, y5f + 0.94, 7.38 + ji * 0.14);
    furnitureGroup.add(jar);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.025, 8), mat.oak);
    cork.position.set(4.64, y5f + 1.01 + (ji % 2) * 0.015, 7.38 + ji * 0.14);
    furnitureGroup.add(cork);
  }
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.048, 0.075, 12), mat.ceramic);
  mortar.position.set(4.38, y5f + 0.92, 8.35);
  furnitureGroup.add(mortar);
  const copperCan = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 0.18, 12), copperMat);
  copperCan.position.set(4.42, y5f + 0.97, 8.85);
  furnitureGroup.add(copperCan);
  const canSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.22, 8), copperMat);
  canSpout.position.set(4.30, y5f + 1.01, 8.76);
  canSpout.rotation.z = 0.72;
  furnitureGroup.add(canSpout);
  addCollider(5, 4.14, 7.16, 4.84, 9.18);

  // Botanical Tea Table & Cast-Iron Teapot (Tetsubin) + 2 Oak Stools
  addBox(furnitureGroup, 0.88, 0.04, 0.64, mat.oak, 3.10, y5f + 0.70, 8.40, true);
  [[-0.36, -0.24], [0.36, -0.24], [-0.36, 0.24], [0.36, 0.24]].forEach(([dx, dz]) => {
    addBox(furnitureGroup, 0.036, 0.68, 0.036, mat.darkIron, 3.10 + dx, y5f + 0.34, 8.40 + dz, false);
  });
  const tetsubin = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mat.darkIron);
  tetsubin.scale.set(1.0, 0.72, 1.0);
  tetsubin.position.set(3.10, y5f + 0.78, 8.40);
  furnitureGroup.add(tetsubin);
  [2.92, 3.28].forEach((cx) => {
    const tc = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.055, 10), mat.ceramic);
    tc.position.set(cx, y5f + 0.75, 8.46);
    furnitureGroup.add(tc);
  });
  addCollider(5, 2.62, 8.02, 3.58, 8.78);

  // SW Cool-Down Lounger, Woven Rug, Teak Side Table & Interactive [E] Tall Washi Floor Lantern!
  addBox(furnitureGroup, 1.65, 0.015, 1.85, makeSurfaceMat('carpet_beige', 1.65, 1.85), 1.32, y5f + 0.016, 8.95, false);
  addBox(furnitureGroup, 0.86, 0.32, 0.74, mat.oak, 1.10, y5f + 0.16, 9.04, true);
  addBox(furnitureGroup, 0.82, 0.14, 0.70, denimMat, 1.10, y5f + 0.36, 9.04, true);
  addBox(furnitureGroup, 0.82, 0.56, 0.16, denimMat, 1.10, y5f + 0.62, 9.36, true);
  addCollider(5, 0.62, 8.62, 1.58, 9.48);
  const teakSide = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.44, 14), mat.walnut);
  teakSide.position.set(2.02, y5f + 0.22, 9.12);
  furnitureGroup.add(teakSide);
  const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.052, 0.20, 10), mat.glassClear);
  carafe.position.set(2.02, y5f + 0.54, 9.12);
  carafe.userData.noBatch = true;
  dynamicGroup.add(carafe);

  const consLanternMat = mat.washiGlow.clone();
  const consLanternMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 1.08, 12), consLanternMat);
  consLanternMesh.position.set(0.46, y5f + 0.62, 9.52);
  consLanternMesh.userData.propId = 'lamp_5f_conservatory';
  consLanternMesh.userData.noBatch = true;
  dynamicGroup.add(consLanternMesh);
  excludeBatch.add(consLanternMesh);
  addBox(furnitureGroup, 0.24, 0.06, 0.24, mat.walnut, 0.46, y5f + 0.04, 9.52, false);
  const consLight = addLight('5F_Conservatory_Lamp', 5, 'south', 0xffaa50, 2.05, 7.6, 1.35, y5f + 1.45, 8.65);
  interactiveProps.push({
    id: 'lamp_5f_conservatory', floor: 5, mesh: consLanternMesh, isOn: true,
    getLabel() { return this.isOn ? '温室和紙フロア灯を消す' : '温室和紙フロア灯を点ける'; },
    toggle() { this.isOn = !this.isOn; consLanternMat.emissiveIntensity = this.isOn ? 1.85 : 0.08; if (!this.isOn) consLight.intensity = 0; },
  });

  // 5R07: 5F West Canopy Spa Cool-Down Deck Outdoor Furniture & Sconce
  addBox(furnitureGroup, 0.56, 0.42, 0.46, mat.oak, -0.56, y5f + 0.19, 6.52, true);
  addCollider(5, -0.92, 6.22, -0.20, 6.80);
  addBox(furnitureGroup, 0.36, 0.44, 0.36, mat.walnut, -0.58, y5f + 0.20, 8.50, true);
  const deck5Lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.20, 10), mat.washiGlow);
  deck5Lantern.position.set(-0.58, y5f + 0.52, 8.50);
  furnitureGroup.add(deck5Lantern);
  const deck5Sconce = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), mat.washiGlow);
  deck5Sconce.position.set(-0.04, y5f + 1.65, 6.62);
  furnitureGroup.add(deck5Sconce);

  // ---------- 6F FURNISHING (Y = 13.25, CH = 2.65m, Floor Index 6 — CROWN SKY PENTHOUSE & OBSERVATORY!) ----------
  // 6R01: North Star-Chart Gallery Console + Brass Binoculars + Stacked Atlases
  addBox(furnitureGroup, 1.24, 0.78, 0.34, mat.walnut, 1.10, y6f + 0.39, 0.35, true);
  addBox(furnitureGroup, 1.28, 0.03, 0.36, makeSurfaceMat('marble_black', 1.28, 0.36), 1.10, y6f + 0.795, 0.35, false);
  // Brass Field Binoculars + Stacked Star Atlases + Brass Compass on Console
  [-0.045, 0.045].forEach((bx) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.16, 10), mat.bronze);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.84 + bx, y6f + 0.84, 0.35);
    furnitureGroup.add(barrel);
  });
  addBox(furnitureGroup, 0.26, 0.04, 0.20, bookNavyMat, 1.32, y6f + 0.83, 0.35, false);
  addBox(furnitureGroup, 0.24, 0.035, 0.18, bookOchreMat, 1.34, y6f + 0.865, 0.36, false);
  const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), mat.bronze);
  compass.position.set(1.10, y6f + 0.82, 0.35);
  furnitureGroup.add(compass);
  addCollider(6, 0.45, 0.16, 1.75, 0.55);
  addFramedArt(furnitureGroup, 'art_poster_1', 0.46, 0.62, 2.13, y6f + 1.52, 0.72, -Math.PI / 2);
  addFireExtinguisherNiche(1.27, y6f, 4.65);

  // 6R02: NE Starlight Tatami Alcove & Meditative Sky-Bedroom (X=2.25..4.85, Z=0.15..3.45)
  // Built-in Corner Window Daybed Platform tucked into NE Panorama Windows
  addBox(furnitureGroup, 1.34, 0.28, 1.96, mat.walnut, 4.14, y6f + 0.14, 1.20, true);
  addBox(furnitureGroup, 1.26, 0.20, 1.88, makeSurfaceMat('fabric_floral_quilt', 1.26, 1.88), 4.14, y6f + 0.37, 1.20, true);
  addBox(furnitureGroup, 0.52, 0.14, 0.32, makeFrontMat('fabric_sakura'), 3.88, y6f + 0.52, 0.48, false);
  addBox(furnitureGroup, 0.52, 0.14, 0.32, denimMat, 4.42, y6f + 0.52, 0.48, false);
  addCollider(6, 3.42, 0.18, 4.84, 2.20);
  // Low Walnut Writing Table (Fuzukue) with Open Book, Matcha Bowl, Brass Incense Burner & Red Zabuton!
  addBox(furnitureGroup, 1.06, 0.04, 0.56, mat.walnut, 3.40, y6f + 0.36, 3.08, true);
  [2.94, 3.86].forEach((lx) => {
    addBox(furnitureGroup, 0.05, 0.34, 0.48, mat.walnut, lx, y6f + 0.17, 3.08, false);
  });
  addBox(furnitureGroup, 0.28, 0.025, 0.22, blueprintPaperMat, 3.24, y6f + 0.395, 3.08, false); // Open journal
  const matchaBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.036, 0.065, 12), mat.darkIron);
  matchaBowl.position.set(3.64, y6f + 0.415, 3.02);
  furnitureGroup.add(matchaBowl);
  const koro = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.05, 10), mat.bronze);
  koro.position.set(3.74, y6f + 0.405, 3.20);
  furnitureGroup.add(koro);
  const koroEmber = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), emberMat);
  koroEmber.position.set(3.74, y6f + 0.435, 3.20);
  furnitureGroup.add(koroEmber);
  addBox(furnitureGroup, 0.54, 0.07, 0.54, makeFrontMat('zabuton_red'), 3.40, y6f + 0.045, 2.48, false);
  addCollider(6, 2.82, 2.75, 3.98, 3.42);
  // Recessed Tokonoma Display Plinth with Ceramic Ikebana Vase & Cedar Sprig + Hanging Scroll
  addBox(furnitureGroup, 0.40, 0.12, 0.68, mat.walnut, 4.62, y6f + 0.06, 3.02, true);
  const ikebanaVase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.24, 12), mat.ceramic);
  ikebanaVase.position.set(4.62, y6f + 0.24, 3.02);
  furnitureGroup.add(ikebanaVase);
  const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 7), mat.foliage);
  sprig.position.set(4.60, y6f + 0.46, 3.02);
  sprig.rotation.z = 0.24;
  furnitureGroup.add(sprig);
  addFramedArt(furnitureGroup, 'art_poster_2', 0.44, 0.88, 4.82, y6f + 1.48, 3.02, -Math.PI / 2);

  // 6R03: 6F Sky Powder Room & WC (X=2.25..3.45, Z=3.55..5.95)
  addBox(furnitureGroup, 0.50, 0.18, 1.06, makeSurfaceMat('marble_black', 1.06, 0.50), 3.18, y6f + 0.74, 4.24, true);
  const vessel6 = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.14, 16), mat.ceramic);
  vessel6.position.set(3.16, y6f + 0.90, 4.24);
  furnitureGroup.add(vessel6);
  addBox(furnitureGroup, 0.03, 0.24, 0.03, mat.bronze, 3.36, y6f + 0.95, 4.24, false); // Tall brass faucet
  addBox(furnitureGroup, 0.11, 0.025, 0.025, mat.bronze, 3.31, y6f + 1.06, 4.24, false);
  // Backlit Oval Vanity Mirror + Amber Soap Bottle + Reed Diffuser
  const ovalHalo = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 20), mat.washiGlow);
  ovalHalo.rotation.z = Math.PI / 2;
  ovalHalo.scale.set(1.25, 1.0, 0.88);
  ovalHalo.position.set(3.43, y6f + 1.50, 4.24);
  furnitureGroup.add(ovalHalo);
  const ovalMir = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20), mat.mirror);
  ovalMir.rotation.z = Math.PI / 2;
  ovalMir.scale.set(1.25, 1.0, 0.88);
  ovalMir.position.set(3.42, y6f + 1.50, 4.24);
  furnitureGroup.add(ovalMir);
  const soap6 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), amberGlassMat);
  soap6.position.set(3.20, y6f + 0.89, 3.84);
  furnitureGroup.add(soap6);
  const diff6 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.10, 10), mat.ceramic);
  diff6.position.set(3.20, y6f + 0.88, 4.62);
  furnitureGroup.add(diff6);
  addBox(furnitureGroup, 0.42, 0.42, 0.62, mat.ceramic, 2.82, y6f + 0.21, 5.52, true);
  addCollider(6, 2.90, 3.65, 3.45, 4.80);
  addCollider(6, 2.58, 5.18, 3.08, 5.92);

  // 6R04: Wine & Home-Roasted Coffee Cellar (X=3.55..4.85, Z=3.55..5.95)
  // Full-Height Walnut Wine Bottle Lattice Rack stocked with 12 Miniature 3D Wine Bottles!
  addBox(furnitureGroup, 0.36, 2.15, 1.92, mat.walnut, 4.64, y6f + 1.075, 4.58, true);
  for (let row = 0; row < 4; row++) {
    addBox(furnitureGroup, 0.38, 0.03, 1.90, mat.oak, 4.63, y6f + 0.38 + row * 0.42, 4.58, false);
    for (let col = 0; col < 3; col++) {
      const bz = 3.92 + col * 0.62 + (row % 2) * 0.14;
      const by = y6f + 0.46 + row * 0.42;
      const bMat = (row + col) % 2 === 0 ? wineGreenMat : wineRedMat;
      const wBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 10), bMat);
      wBody.rotation.z = Math.PI / 2;
      wBody.position.set(4.56, by, bz);
      furnitureGroup.add(wBody);
      const wNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.09, 8), mat.bronze);
      wNeck.rotation.z = Math.PI / 2;
      wNeck.position.set(4.42, by, bz);
      furnitureGroup.add(wNeck);
    }
  }
  addCollider(6, 4.42, 3.60, 4.84, 5.58);
  // Climate-Controlled Glass-Front Wine Cooler + Coffee Roasting Tins along North Wall
  addBox(furnitureGroup, 0.62, 1.32, 0.54, mat.darkIron, 3.94, y6f + 0.66, 3.86, true);
  const coolerGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 1.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x1b3348, emissive: 0x3b76a8, emissiveIntensity: 0.48, roughness: 0.15 }),
  );
  coolerGlow.position.set(3.94, y6f + 0.66, 4.135);
  furnitureGroup.add(coolerGlow);
  [3.74, 3.94, 4.14].forEach((tx, ti) => {
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10), ti === 1 ? copperMat : mat.bronze);
    tin.position.set(tx, y6f + 1.39, 3.86);
    furnitureGroup.add(tin);
  });
  addCollider(6, 3.60, 3.56, 4.28, 4.16);

  // 6R05: HERO CROWN ROOM — Sky Panorama Observatory Salon & Espresso Bar (X=0.15..4.85, Z=6.05..9.85, CH 2.65m!)
  // Exposed SRC Hybrid Steel-and-Walnut Roof-Transfer Beams across full 4.70m width
  [6.90, 8.10, 9.30].forEach((bz) => {
    addBox(staticGroup, 4.70, 0.16, 0.12, mat.walnut, 2.50, y6f + 2.55, bz, false);
    addBox(staticGroup, 4.70, 0.03, 0.15, mat.darkIron, 2.50, y6f + 2.46, bz, false);
  });

  // HERO SHOWPIECE 1: Authentic Brass & Walnut Equatorial Astronomical Telescope on Hardwood Tripod!
  const telX = 1.48;
  const telZ = 9.32;
  // 3 Angled Hardwood Tripod Legs meeting at Mounting Hub (Y = +1.08m)
  [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((ang) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.014, 1.18, 8), mat.walnut);
    leg.position.set(telX + Math.cos(ang) * 0.22, y6f + 0.54, telZ + Math.sin(ang) * 0.22);
    leg.rotation.z = Math.cos(ang) * 0.34;
    leg.rotation.x = -Math.sin(ang) * 0.34;
    leg.castShadow = true;
    furnitureGroup.add(leg);
  });
  // Equatorial Mount Head + Counterweight Rod & Iron Disc
  const eqHead = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.18, 12), mat.darkIron);
  eqHead.position.set(telX, y6f + 1.14, telZ);
  furnitureGroup.add(eqHead);
  const cwBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), mat.chrome);
  cwBar.position.set(telX - 0.16, y6f + 1.10, telZ);
  cwBar.rotation.z = 1.15;
  furnitureGroup.add(cwBar);
  const cwWeight = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 12), mat.darkIron);
  cwWeight.position.set(telX - 0.26, y6f + 1.04, telZ);
  cwWeight.rotation.z = 1.15;
  furnitureGroup.add(cwWeight);
  // Main Brushed-Brass Optical Refractor Tube angled gracefully UP toward the South moonlit sky!
  const telGroup = new THREE.Group();
  telGroup.position.set(telX, y6f + 1.28, telZ);
  telGroup.rotation.set(-0.46, 0.12, 0);
  const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, 1.06, 16), mat.bronze);
  mainTube.rotation.x = Math.PI / 2;
  mainTube.castShadow = true;
  telGroup.add(mainTube);
  const dewShield = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.068, 0.24, 16), mat.bronze);
  dewShield.rotation.x = Math.PI / 2;
  dewShield.position.z = 0.56;
  telGroup.add(dewShield);
  const objLens = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 16), lensCoatMat);
  objLens.rotation.x = Math.PI / 2;
  objLens.position.z = 0.65;
  telGroup.add(objLens);
  const finder = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 10), mat.bronze);
  finder.rotation.x = Math.PI / 2;
  finder.position.set(0.065, 0.065, -0.10);
  telGroup.add(finder);
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 10), mat.darkIron);
  eyepiece.position.set(0, 0.06, -0.56);
  telGroup.add(eyepiece);
  furnitureGroup.add(telGroup);
  addCollider(6, 1.20, 9.04, 1.76, 9.60);
  // Star-Atlas Lectern beside Telescope
  addBox(furnitureGroup, 0.05, 0.96, 0.05, mat.walnut, 0.50, y6f + 0.48, 9.38, false);
  addBox(furnitureGroup, 0.32, 0.04, 0.32, mat.walnut, 0.50, y6f + 0.02, 9.38, false);
  const lecternDesk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.34), mat.walnut);
  lecternDesk.position.set(0.50, y6f + 0.98, 9.38);
  lecternDesk.rotation.x = -0.35;
  furnitureGroup.add(lecternDesk);
  const starMap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.01, 0.28), blueprintPaperMat);
  starMap.position.set(0.50, y6f + 1.00, 9.37);
  starMap.rotation.x = -0.35;
  furnitureGroup.add(starMap);
  addCollider(6, 0.26, 9.14, 0.74, 9.62);

  // HERO SHOWPIECE 2: Suspended Modern Sculptural Steel Hearth Fireplace (Interactive [E] Toggle!)
  const hearthX = 0.52;
  const hearthZ = 8.20;
  const hearthPad = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 18), makeSurfaceMat('slate_charcoal', 0.8, 0.8));
  hearthPad.position.set(hearthX, y6f + 0.02, hearthZ);
  furnitureGroup.add(hearthPad);
  const fluePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.56, 14), mat.darkIron);
  fluePipe.position.set(hearthX, y6f + 1.88, hearthZ);
  furnitureGroup.add(fluePipe);
  const fireHood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.48, 16), mat.darkIron);
  fireHood.position.set(hearthX, y6f + 0.96, hearthZ);
  furnitureGroup.add(fireHood);
  const fireBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.18, 0.18, 16), mat.darkIron);
  fireBowl.position.set(hearthX, y6f + 0.46, hearthZ);
  fireBowl.userData.propId = 'fireplace_6f';
  fireBowl.userData.noBatch = true;
  dynamicGroup.add(fireBowl);
  excludeBatch.add(fireBowl);
  const hearthFlameMat = emberMat.clone();
  const hearthFlameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 10), hearthFlameMat);
  hearthFlameMesh.position.set(hearthX, y6f + 0.64, hearthZ);
  hearthFlameMesh.userData.noBatch = true;
  dynamicGroup.add(hearthFlameMesh);
  excludeBatch.add(hearthFlameMesh);
  const hearthLight = addLight('6F_Hearth_Fire', 6, 'south', 0xff7b2e, 2.25, 7.2, hearthX + 0.22, y6f + 0.78, hearthZ);
  interactiveProps.push({
    id: 'fireplace_6f', floor: 6, mesh: fireBowl, isOn: true,
    getLabel() { return this.isOn ? '吊り暖炉の火を消す' : '吊り暖炉に火を灯す'; },
    toggle() {
      this.isOn = !this.isOn;
      hearthFlameMat.emissiveIntensity = this.isOn ? 2.1 : 0.04;
      hearthFlameMesh.visible = this.isOn;
      if (!this.isOn) hearthLight.intensity = 0;
    },
  });
  addCollider(6, 0.22, 7.90, 0.82, 8.50);

  // Designer South-Facing Sky Lounge Sofa + Woven Salon Rug + Black Marble Coffee Table with Espresso Cups & Monograph!
  addBox(furnitureGroup, 2.25, 0.015, 2.20, makeSurfaceMat('carpet_beige', 2.25, 2.20), 1.75, y6f + 0.016, 7.95, false);
  addBox(furnitureGroup, 1.66, 0.36, 0.72, sofaMat, 1.75, y6f + 0.19, 7.42, true);
  addBox(furnitureGroup, 1.66, 0.64, 0.18, sofaMat, 1.75, y6f + 0.40, 7.12, true);
  addBox(furnitureGroup, 0.14, 0.52, 0.72, sofaMat, 0.98, y6f + 0.28, 7.42, true);
  addBox(furnitureGroup, 0.14, 0.52, 0.72, sofaMat, 2.52, y6f + 0.28, 7.42, true);
  // 3 Accent Throw Pillows
  addBox(furnitureGroup, 0.34, 0.30, 0.12, denimMat, 1.24, y6f + 0.48, 7.26, false);
  addBox(furnitureGroup, 0.34, 0.30, 0.12, makeFrontMat('fabric_sakura'), 1.75, y6f + 0.48, 7.26, false);
  addBox(furnitureGroup, 0.34, 0.30, 0.12, makeFrontMat('fabric_rose_vintage'), 2.26, y6f + 0.48, 7.26, false);
  addCollider(6, 0.88, 7.02, 2.62, 7.82);

  addBox(furnitureGroup, 1.14, 0.04, 0.52, makeSurfaceMat('marble_black', 1.14, 0.52), 1.75, y6f + 0.36, 8.40, true);
  addBox(furnitureGroup, 0.92, 0.34, 0.34, mat.walnut, 1.75, y6f + 0.17, 8.40, false);
  // Open Architecture Monograph + 2 Ceramic Espresso Cups & Saucers + Brass Candlestick + Miniature Bonsai!
  addBox(furnitureGroup, 0.32, 0.03, 0.24, bookNavyMat, 1.44, y6f + 0.395, 8.40, false);
  [1.82, 1.98].forEach((cx) => {
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.01, 12), mat.ceramic);
    saucer.position.set(cx, y6f + 0.386, 8.34);
    furnitureGroup.add(saucer);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.052, 10), mat.ceramic);
    cup.position.set(cx, y6f + 0.415, 8.34);
    furnitureGroup.add(cup);
  });
  addPottedPlant(2.18, y6f + 0.38, 8.44, 0.55, mat.ceramic);
  addCollider(6, 1.15, 8.12, 2.35, 8.68);

  // HERO SHOWPIECE 3: 6F Italian Dual-Boiler Espresso & Pour-Over Sky Bar along East Wall!
  addBox(furnitureGroup, 0.62, 0.96, 1.84, mat.walnut, 4.50, y6f + 0.48, 7.42, true);
  addBox(furnitureGroup, 0.66, 0.045, 1.88, makeSurfaceMat('marble_white', 1.88, 0.66), 4.50, y6f + 0.98, 7.42, false);
  // Chrome Dual-Boiler Italian Espresso Machine (Grouphead, Portafilter Handle, Steam Wand, Twin Gauges!)
  addBox(furnitureGroup, 0.34, 0.36, 0.32, mat.chrome, 4.56, y6f + 1.18, 7.12, true);
  addBox(furnitureGroup, 0.10, 0.08, 0.12, mat.chrome, 4.36, y6f + 1.20, 7.12, false); // E61 Grouphead
  addBox(furnitureGroup, 0.14, 0.026, 0.026, mat.walnut, 4.26, y6f + 1.14, 7.12, false); // Portafilter handle
  addBox(furnitureGroup, 0.28, 0.03, 0.28, mat.darkIron, 4.44, y6f + 1.02, 7.12, false); // Drip tray
  // Conical Burr Coffee Grinder with Bean Hopper
  addBox(furnitureGroup, 0.16, 0.24, 0.16, mat.darkIron, 4.56, y6f + 1.12, 7.50, false);
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.035, 0.16, 12), amberGlassMat);
  hopper.position.set(4.56, y6f + 1.32, 7.50);
  furnitureGroup.add(hopper);
  // 3 Glass Coffee-Bean Canisters + Pour-Over Glass Server
  [7.78, 7.94, 8.10].forEach((cz, ci) => {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14 + (ci % 2) * 0.03, 10), amberGlassMat);
    can.position.set(4.62, y6f + 1.08, cz);
    furnitureGroup.add(can);
  });
  addCollider(6, 4.14, 6.46, 4.84, 8.38);
  // 2 Walnut & Dark-Iron Bar Stools + Dual Suspended Brass Globe Pendant Lamps
  [6.98, 7.86].forEach((bz) => {
    const sTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.045, 14), mat.walnut);
    sTop.position.set(3.82, y6f + 0.68, bz);
    furnitureGroup.add(sTop);
    const sLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.038, 0.66, 8), mat.darkIron);
    sLeg.position.set(3.82, y6f + 0.33, bz);
    furnitureGroup.add(sLeg);
    addCollider(6, 3.66, bz - 0.16, 3.98, bz + 0.16);
    addBox(furnitureGroup, 0.016, 0.78, 0.016, mat.bronze, 4.24, y6f + 2.24, bz, false);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), mat.washiGlow);
    globe.position.set(4.24, y6f + 1.82, bz);
    furnitureGroup.add(globe);
  });

  // Hi-Fi Vinyl Turntable Console + Upright LP Record Sleeves + Pair of Oak Audiophile Speakers along North Salon Wall!
  addBox(furnitureGroup, 1.04, 0.64, 0.36, mat.walnut, 2.95, y6f + 0.32, 6.26, true);
  addBox(furnitureGroup, 0.42, 0.06, 0.32, mat.darkIron, 2.74, y6f + 0.67, 6.26, false);
  const lpPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.012, 16), mat.wallCutCap);
  lpPlatter.position.set(2.74, y6f + 0.708, 6.26);
  furnitureGroup.add(lpPlatter);
  const lpLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 12), mat.terracotta);
  lpLabel.position.set(2.74, y6f + 0.71, 6.26);
  furnitureGroup.add(lpLabel);
  // Upright LP Vinyl Sleeves + Oak Floorstanding Speakers flanking console
  [bookNavyMat, bookOchreMat, mat.terracotta, denimMat, mat.oakLight].forEach((lm, li) => {
    addBox(furnitureGroup, 0.025, 0.30, 0.28, lm, 3.10 + li * 0.05, y6f + 0.79, 6.26, false);
  });
  [2.32, 3.58].forEach((sx) => {
    addBox(furnitureGroup, 0.22, 0.92, 0.26, mat.oak, sx, y6f + 0.46, 6.24, true);
    const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 12), mat.darkIron);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(sx, y6f + 0.66, 6.37);
    furnitureGroup.add(woofer);
  });
  addFramedArt(furnitureGroup, 'art_posters_trio', 0.96, 0.54, 2.95, y6f + 1.66, 6.08, 0);
  addCollider(6, 2.20, 6.06, 3.70, 6.46);

  // 6R07: Full-Width South Sky Observatory Terrace Outdoor Props (X=0.20..4.80, Z=10.00..11.10)
  // West & East Cedar Planter Boxes with Sculpted Evergreen Forest Shrubs
  addBox(furnitureGroup, 0.42, 0.42, 0.68, mat.walnut, 0.48, y6f + 0.19, 10.52, true);
  addPottedPlant(0.48, y6f + 0.32, 10.36, 1.05, mat.walnut);
  addPottedPlant(0.48, y6f + 0.32, 10.68, 0.95, mat.walnut);
  addCollider(6, 0.22, 10.14, 0.72, 10.92);

  // Horizon Spotting Scope / Observation Binocular Post at West Terrace Viewpoint
  const scopePost = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 1.24, 10), mat.darkIron);
  scopePost.position.set(1.05, y6f + 0.60, 10.78);
  furnitureGroup.add(scopePost);
  const scopeHead = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.28, 12), mat.bronze);
  scopeHead.rotation.x = Math.PI / 2 - 0.18;
  scopeHead.position.set(1.05, y6f + 1.26, 10.82);
  furnitureGroup.add(scopeHead);

  // East Terrace Outdoor Café Set: Round White Marble Bistro Table + Glowing Hurricane Lantern + 2 Wine Glasses + Teak Lounge Chair!
  const bistroTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 16), makeSurfaceMat('marble_white', 0.5, 0.5));
  bistroTop.position.set(4.22, y6f + 0.68, 10.52);
  furnitureGroup.add(bistroTop);
  const bistroLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.66, 10), mat.darkIron);
  bistroLeg.position.set(4.22, y6f + 0.34, 10.52);
  furnitureGroup.add(bistroLeg);
  const skyLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.18, 10), mat.washiGlow);
  skyLantern.position.set(4.22, y6f + 0.79, 10.52);
  furnitureGroup.add(skyLantern);
  addBox(furnitureGroup, 0.44, 0.42, 0.40, mat.oak, 4.30, y6f + 0.19, 10.18, true);
  addBox(furnitureGroup, 0.44, 0.38, 0.06, mat.oak, 4.30, y6f + 0.58, 10.02, false);
  addPottedPlant(4.60, y6f + 0.02, 10.82, 1.15, mat.terracotta);
  addCollider(6, 3.96, 10.08, 4.78, 11.04);
  // Dual Waterproof Architectural Sconces flanking 6F Sky Terrace Wall
  [0.95, 4.10].forEach((sx) => {
    addBox(furnitureGroup, 0.14, 0.22, 0.08, mat.washiGlow, sx, y6f + 1.72, 10.04, false);
  });

  // ---------- RF / ATTIC FURNISHING (Y = 16.10, Floor Index 7 = attFloorIdx) ----------
  const yAtt = attY;
  addBox(furnitureGroup, 0.62, 0.58, 0.62, crateMat, 4.25, yAtt + 0.29, 1.35, true);
  addBox(furnitureGroup, 0.54, 0.50, 0.54, crateMat, 4.22, yAtt + 0.83, 1.38, true);
  addBox(furnitureGroup, 0.66, 0.54, 0.60, crateMat, 4.22, yAtt + 0.27, 2.15, true);
  const ropeMesh = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.065, 10, 18), makeSurfaceMat('rope_coil', 0.5, 0.5));
  ropeMesh.rotation.x = Math.PI / 2;
  ropeMesh.position.set(4.22, yAtt + 0.60, 2.15);
  furnitureGroup.add(ropeMesh);
  const sack1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), burlapMat);
  sack1.scale.set(1.0, 1.25, 0.85);
  sack1.position.set(4.25, yAtt + 0.30, 3.15);
  furnitureGroup.add(sack1);
  const sack2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), burlapMat);
  sack2.scale.set(1.1, 1.0, 0.9);
  sack2.position.set(4.15, yAtt + 0.26, 3.68);
  furnitureGroup.add(sack2);
  addCollider(attFloorIdx, 3.85, 0.98, 4.82, 4.00);
  addFramedArt(furnitureGroup, 'prop_crayon_house', 0.42, 0.34, 3.92, yAtt + 0.98, 5.18, Math.PI);

  addBox(furnitureGroup, 0.96, 0.04, 0.64, mat.walnut, 2.50, yAtt + 0.34, 7.45, true);
  addBox(furnitureGroup, 0.80, 0.32, 0.48, mat.walnut, 2.50, yAtt + 0.16, 7.45, false);
  addBox(furnitureGroup, 0.56, 0.08, 0.56, makeFrontMat('zabuton_red'), 2.50, yAtt + 0.06, 6.72, false);
  addBox(furnitureGroup, 0.56, 0.08, 0.56, denimMat, 2.50, yAtt + 0.06, 8.18, false);
  addCollider(attFloorIdx, 1.98, 7.10, 3.02, 7.80);
  addBox(furnitureGroup, 0.54, 0.48, 1.15, crateMat, 0.52, yAtt + 0.24, 7.45, true);
  addBox(furnitureGroup, 0.52, 0.46, 1.05, makeFrontMat('furniture_chest'), 4.46, yAtt + 0.23, 7.55, true);
  addCollider(attFloorIdx, 0.16, 6.84, 0.84, 8.06);
  addCollider(attFloorIdx, 4.16, 6.98, 4.84, 8.12);

  addBox(furnitureGroup, 0.018, 0.92, 0.018, mat.darkIron, 2.50, ridgeY - 0.54, 7.45, false);
  const attLanternMat = mat.washiGlow.clone();
  const attLanternMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.30, 8), attLanternMat);
  attLanternMesh.position.set(2.50, yAtt + 1.72, 7.45);
  attLanternMesh.userData.propId = 'lantern_attic';
  attLanternMesh.userData.noBatch = true;
  dynamicGroup.add(attLanternMesh);
  excludeBatch.add(attLanternMesh);
  const attCap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.10, 8), mat.darkIron);
  attCap.position.set(2.50, yAtt + 1.90, 7.45);
  furnitureGroup.add(attCap);

  const atticLight = addLight('Attic_Lantern', attFloorIdx, 'sanctuary', 0xffa448, 2.85, 9.0, 2.50, yAtt + 1.62, 7.45);
  interactiveProps.push({
    id: 'lantern_attic', floor: attFloorIdx, mesh: attLanternMesh, isOn: true,
    getLabel() { return this.isOn ? '小屋裏ランタンを消す' : '小屋裏ランタンを点ける'; },
    toggle() { this.isOn = !this.isOn; attLanternMat.emissiveIntensity = this.isOn ? 2.1 : 0.08; if (!this.isOn) atticLight.intensity = 0; },
  });

  // =========================================================================
  // 6. FLOOR-SCOPED ATMOSPHERIC LIGHTING ACROSS ALL 8 LEVELS (<= 5-6 active!)
  // =========================================================================
  // B1F (Floor 0): Sparse dim bunker lighting ("明かりが少し") — eerie low-lit cement atmosphere!
  addLight('B1F_Dim_Main', 0, 'main', 0xd6cfc2, 0.72, 5.8, 1.75, yb + 1.78, 5.65);
  addLight('B1F_Dim_Deep', 0, 'main', 0xc9c2b6, 0.58, 5.4, 1.75, yb + 1.78, 8.55);
  addLight('B1F_Storage_Bleed', 0, 'storage', 0xbfc8d1, 0.42, 4.2, 4.00, yb + 1.78, 6.32);

  // 1F (Floor 1)
  addLight('1F_Dining_Pendant', 1, 'ldk', 0xffbe73, 2.15, 7.5, 2.95, 1.56, 6.45);
  addLight('1F_Living_Cove', 1, 'ldk', 0xffb366, 1.35, 6.8, 1.35, 1.75, 8.20);
  addLight('1F_Hall_Stair', 1, 'north', 0xffcfa0, 1.45, 6.2, 1.35, 2.15, 1.85);
  addLight('1F_Gear_WC', 1, 'north', 0xf6c993, 1.35, 6.0, 3.45, 2.10, 2.25);
  addLight('1F_Porch_Sconce', 1, 'exterior', 0xffb66b, 1.65, 6.5, 1.10, 2.15, -0.35);

  // 2F (Floor 2)
  addLight('2F_Hall_Stair', 2, 'north', 0xffcfa0, 1.40, 6.4, 1.35, y2 + 2.15, 2.25);
  addLight('2F_Wash_Bath', 2, 'mid', 0xdceeff, 1.55, 5.5, 3.35, y2 + 2.08, 4.75);
  addLight('2F_Master_Suite', 2, 'south', 0xffb66e, 2.10, 7.8, 2.65, y2 + 1.85, 7.45);

  // 3F (Floor 3)
  addLight('3F_Hall_Stair', 3, 'north', 0xffcfa0, 1.40, 6.4, 1.35, y3 + 2.10, 2.25);
  addLight('3F_Tea_Shoji', 3, 'north', 0xffb86c, 1.95, 6.2, 3.65, y3 + 1.65, 1.80);
  addLight('3F_Powder_WC', 3, 'mid', 0xd6e8ff, 1.25, 4.8, 2.85, y3 + 2.05, 4.65);
  addLight('3F_Atelier_Bar', 3, 'south', 0xffb260, 2.35, 8.2, 2.85, y3 + 1.85, 7.65);

  // 4F (Floor 4 — Low-CH 2.15m Architectural Warmth + Balcony Glow)
  addLight('4F_North_Rooms', 4, 'north', 0xffc688, 1.75, 6.5, 2.55, y4f + 1.85, 1.55);
  addLight('4F_Dressing_Mid', 4, 'mid', 0xffe0bc, 1.65, 5.8, 3.35, y4f + 1.85, 4.75);
  addLight('4F_Library_SW', 4, 'south', 0xffbd75, 1.85, 6.4, 1.35, y4f + 1.82, 7.90);
  addLight('4F_SkyLounge_SE', 4, 'south', 0xffb86a, 2.05, 7.0, 3.65, y4f + 1.82, 8.15);
  addLight('4F_Balcony_Sconce', 4, 'balcony', 0xffae58, 1.35, 5.5, 3.50, y4f + 1.60, 10.45);

  // 5F (Floor 5 — 5 Active Budget: Studio Drafting + Hall/Sauna + Sky Bath + Conservatory Grow/Lamp + West Deck!)
  addLight('5F_Hall_Sauna', 5, 'north', 0xffc686, 1.60, 6.5, 1.65, y5f + 2.15, 2.45);
  addLight('5F_Sauna_Bath', 5, 'mid', 0xffb470, 1.85, 6.2, 3.55, y5f + 2.00, 4.75);
  addLight('5F_Conservatory_Grow', 5, 'south', 0xffd2e6, 1.85, 7.2, 3.75, y5f + 2.05, 7.35);
  addLight('5F_WestDeck_Sconce', 5, 'balcony', 0xffb262, 1.45, 5.8, -0.45, y5f + 1.72, 7.50);

  // 6F (Floor 6 — 5 Active Budget: Starlight Landing/Alcove + Powder/Cellar + Espresso Bar + Interactive Hearth + Full-Width Sky Terrace!)
  addLight('6F_Hall_Alcove', 6, 'north', 0xffca8f, 1.75, 7.0, 2.55, y6f + 2.25, 1.70);
  addLight('6F_Powder_Cellar', 6, 'mid', 0xdcecff, 1.55, 5.8, 3.35, y6f + 2.15, 4.65);
  addLight('6F_SkySalon_Bar', 6, 'south', 0xffbe74, 2.35, 8.5, 3.45, y6f + 2.18, 7.55);
  addLight('6F_SkyTerrace_Lantern', 6, 'balcony', 0xffb05c, 1.65, 6.8, 2.55, y6f + 1.82, 10.55);

  // Attic (Floor 7 = attFloorIdx)
  addLight('Attic_Hatch_Bulb', attFloorIdx, 'north', 0xffc684, 1.55, 6.8, 2.15, yAtt + 2.10, 2.35);

  // =========================================================================
  // 7. EXTERIOR FOREST GROUND (WITH EXACT 5m×10m HOUSE CUTOUT!) & 22-34m CEDARS
  // =========================================================================
  // Build exterior forest ground as 4 surrounding quads so it NEVER cuts across B1F / ST0!
  function addGroundQuad(x1, z1, x2, z2) {
    const w = x2 - x1;
    const d = z2 - z1;
    const m = makeSurfaceMat('forest_mulch_ground', w, d, { roughness: 0.96 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x1 + x2) / 2, -0.35, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    exteriorGroup.add(mesh);
  }
  addGroundQuad(-48, -48, 53, 0);    // North of house
  addGroundQuad(-48, 10, 53, 58);    // South of house
  addGroundQuad(-48, 0, 0, 10);      // West of house
  addGroundQuad(5, 0, 53, 10);       // East of house

  // North Mossy Stepping Stone Approach & Porch Canopy
  addBox(exteriorGroup, 2.10, 0.14, 7.50, makeSurfaceMat('paver_moss_stones', 2.2, 7.5), 1.12, -0.28, -3.75, false);
  addBox(exteriorGroup, 2.20, 0.14, 1.25, makeSurfaceMat('paver_granite_grid', 2.2, 1.25), 1.12, -0.22, -0.62, true);
  addBox(exteriorGroup, 2.30, 0.08, 1.15, mat.darkIron, 1.12, 2.48, -0.58, true);

  // South Engawa Deck & Green-Wall Privacy Screen + Outdoor AC Condenser
  addBox(exteriorGroup, 4.90, 0.18, 1.35, makeSurfaceMat('wood_deck', 4.90, 1.35), 2.50, -0.14, 10.68, true);
  addBox(exteriorGroup, 0.14, 2.10, 1.30, makeSurfaceMat('green_wall', 1.30, 2.10), 4.92, 0.95, 10.68, true);
  addBox(exteriorGroup, 0.14, 2.10, 1.30, makeSurfaceMat('wood_lattice_dark', 1.30, 2.10), 0.08, 0.95, 10.68, true);
  addBox(exteriorGroup, 0.34, 0.62, 0.78, makeFrontMat('prop_ac_outdoor'), 5.20, 0.02, 2.65, true);

  // Mossy Cliff Boulders (positioned safely outside all 3 buildings AND the Giant Camper drive bay!)
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rockMossMat = makeSurfaceMat('rock_mossy_cliff', 2.5, 2.5, { roughness: 0.88 });
  const rockWetMat = makeSurfaceMat('rock_wet_black', 2.0, 2.0, { roughness: 0.34 });
  [
    [-5.8, -2.5, 0.95, 0.55], [12.4, -2.6, 1.15, 0.65], [-10.2, 4.8, 1.25, 0.72],
    [13.4, 6.8, 1.15, 0.64], [-2.6, 12.6, 1.05, 0.58], [12.5, 13.0, 1.30, 0.78],
    [2.8, 14.0, 0.88, 0.45], [-9.2, 11.0, 1.40, 0.82],
  ].forEach(([bx, bz, sx, sy], i) => {
    const rMesh = new THREE.Mesh(rockGeo, i % 2 === 0 ? rockMossMat : rockWetMat);
    rMesh.position.set(bx, -0.35 + sy * 0.45, bz);
    rMesh.scale.set(sx, sy, sx * 0.88);
    rMesh.rotation.set(i * 0.4, i * 1.1, 0.15);
    rMesh.receiveShadow = true;
    exteriorGroup.add(rMesh);
    boulderColliders.push({ x: bx, z: bz, r: sx * 0.88 });
  });

  // GPU Wind-Animated Instanced Towering Ancient Cedars (22m - 34m tall enveloping the 6-story 18.93m tower + compound!)
  const windTimeUniform = { value: 0 };
  let seed = 42081;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const treeSpecs = [];
  const attempts = 1550;
  for (let i = 0; i < attempts && treeSpecs.length < 305; i++) {
    const tx = -42 + rand() * 88;
    const tz = -35 + rand() * 82;
    // Clear Main Tower, Annex + Balconies, Concrete Warehouse + STS1, Giant Camper Bay (6.4..9.1, 2..9.5), AND North/East Forest Drive Track!
    const inHouseClear = tx > -11.60 && tx < 13.00 && tz > -4.60 && tz < 14.20;
    const inDriveClearing = tx > -10.50 && tx < 13.50 && tz > -14.50 && tz <= -4.0;
    if (inHouseClear || inDriveClearing) continue;

    const isUnderstory = i % 5 === 0;
    const h = isUnderstory ? (6.5 + rand() * 7.0) : (22.0 + rand() * 12.0); // up to 34m ancient forest giants framing 6F sky terrace!
    const rad = isUnderstory ? (0.12 + rand() * 0.08) : (0.24 + rand() * 0.19);
    const cw = isUnderstory ? (0.95 + rand() * 0.55) : (1.25 + rand() * 0.78);
    treeSpecs.push({ x: tx, z: tz, h, rad, cw, rot: rand() * Math.PI * 2 });
    if (tx > -19 && tx < 20 && tz > -19 && tz < 19) {
      treeColliders.push({ x: tx, z: tz, r: rad + 0.14 });
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.42, 1.0, 1.0, 7);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = makeSurfaceMat('yakisugi_dark', 1.2, 5.2, { color: 0x6b5c4e, roughness: 0.92 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpecs.length);
  trunkInst.castShadow = false;
  trunkInst.receiveShadow = true;

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
      [tier1Inst, t.h * 0.13, t.cw * 1.02, t.h * 0.36],
      [tier2Inst, t.h * 0.35, t.cw * 0.85, t.h * 0.32],
      [tier3Inst, t.h * 0.57, t.cw * 0.65, t.h * 0.27],
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

  // Forest Underbrush Ferns (excluding all 3 buildings + Camper parking bay & drive clearing)
  const bushGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1a301e, roughness: 0.92 });
  const bushSpecs = [];
  for (let i = 0; i < 320 && bushSpecs.length < 105; i++) {
    const bx = -22 + rand() * 48;
    const bz = -18 + rand() * 44;
    if (bx > -10.4 && bx < 12.6 && bz > -13.5 && bz < 12.8) continue;
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

  // Exterior Moonlit Canopy Fill Lights spanning all 6-story Main Tower + Annex + Warehouse + Vehicles
  [
    [2.5, 4.5, 16.5, 0x4a73a3, 1.85, 22],
    [2.5, 13.5, 17.8, 0x5c8ac0, 2.45, 28],
    [2.5, 19.2, 16.5, 0x6696cc, 2.15, 28],
    [2.5, 5.5, -7.5, 0x446894, 1.45, 20],
    [2.5, 15.0, -8.5, 0x5682b8, 2.25, 28],
    [-5.2, 7.8, 13.8, 0x4a73a3, 1.85, 24],
    [-5.2, 7.6, -4.8, 0x446894, 1.65, 22],
    [10.2, 5.8, -4.2, 0x4a73a3, 1.75, 24],
    [11.2, 6.2, 6.2, 0x4a73a3, 1.85, 24],
  ].forEach(([lx, ly, lz, col, inten, dist]) => {
    const l = new THREE.PointLight(col, inten, dist, 1.4);
    l.position.set(lx, ly, lz);
    exteriorGroup.add(l);
  });

  // Drifting Midnight Forest Fireflies across the compound clearing (rising up to 19m past 5F/6F Sky Terraces!)
  const ffCount = 136;
  const ffPositions = new Float32Array(ffCount * 3);
  const ffSeeds = [];
  for (let i = 0; i < ffCount; i++) {
    let fx, fz;
    do {
      fx = -16 + rand() * 36;
      fz = -13 + rand() * 36;
    } while (
      (fx > -1.3 && fx < 5.4 && fz > -0.4 && fz < 11.4) ||
      (fx > -8.8 && fx < -2.2 && fz > -0.2 && fz < 9.4) ||
      (fx > 6.1 && fx < 9.6 && fz > -2.2 && fz < 9.8)
    );
    const fy = 0.65 + rand() * 18.6;
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
  // 8. NEIGHBORING 5m × 8m 3-STORY + 5-ROOM ATTIC HOUSE (ANNEX-40 / 森の離れ)
  // =========================================================================
  buildAnnex3D({
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
  });

  // =========================================================================
  // 9. SEPARATE 3RD BUILDING: 2m × 2m 2-STORY CONCRETE WAREHOUSE (STORAGE-4)
  // =========================================================================
  buildStorage3D({
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
  });

  // =========================================================================
  // 10. MOVABLE GIANT EXPEDITION CAMPER (CAMPER-75: 2.7m × 7.5m × H3.4m)
  // =========================================================================
  const camper = buildCamper3D({
    scene,
    exteriorGroup,
    mat,
    addBox,
    interactiveDoors,
    interactiveProps,
    interiorLights,
  });

  // =========================================================================
  // 10b. MOVABLE DAILY-DRIVER KEI-VAN (KEI-340: 3.40m × 1.48m × H1.80m)
  // =========================================================================
  const kei = buildKeiCar3D({
    scene,
    exteriorGroup,
    mat,
    addBox,
    interactiveDoors,
    interactiveProps,
    interiorLights,
  });

  // =========================================================================
  // 11. POCO F7 (ADRENO 825) UV-BAKED CANONICAL STATIC GEOMETRY BATCHING
  // =========================================================================
  const { batchedGroup, stats: batchStats } = batchStaticGroups(
    [staticGroup, furnitureGroup],
    excludeBatch,
  );
  root.add(batchedGroup);

  // Combine batching stats across static buildings + movable camper + movable kei-van
  const combinedBefore = batchStats.beforeMeshes + camper.batchStats.beforeMeshes + kei.batchStats.beforeMeshes;
  const combinedAfter = batchStats.afterDrawCalls + camper.batchStats.afterDrawCalls + kei.batchStats.afterDrawCalls;
  const combinedBatchStats = {
    beforeMeshes: combinedBefore,
    afterDrawCalls: combinedAfter,
    reductionPct: combinedBefore > 0 ? Math.round(((combinedBefore - combinedAfter) / combinedBefore) * 100) : 0,
    totalTriangles: batchStats.totalTriangles + camper.batchStats.totalTriangles + kei.batchStats.totalTriangles,
  };

  return {
    root,
    collidersByFloor,
    treeColliders,
    boulderColliders,
    interactiveDoors,
    interactiveProps,
    interiorLights,
    fireflies,
    ffSeeds,
    windTimeUniform,
    camper,
    kei,
    batchStats: combinedBatchStats,
  };
}
