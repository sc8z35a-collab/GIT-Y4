import * as THREE from 'three';
import { CAMPER, CAMPER_1F, CAMPER_2F } from './camperData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the Movable Giant Overland Expedition Camper ("CAMPER-75"):
 * - Exact outer dimensions: W 2.70 m × L 7.50 m × H 3.40 m (Ground Y=-0.26 -> Roof Y=+3.14)
 * - 1F High Ceiling: CH 3.02 m soaring skylight atrium + CH 1.98 m under lofts
 * - Exact 460 mm ultra-tight corridor + 14 distinct 1F rooms + 2 expansive 2F Loft rooms
 * - Internally UV-baked static-batched inside a single movable THREE.Group (camperRoot)
 *   so driving all 14 rooms + 2 lofts costs zero extra draw calls on POCO F7!
 */
export function buildCamper3D(ctx) {
  const {
    scene,
    exteriorGroup,
    mat,
    addBox,
    interactiveDoors,
    interactiveProps,
    interiorLights,
  } = ctx;

  const camperRoot = new THREE.Group();
  camperRoot.name = 'MovableGiantCamper';
  camperRoot.position.set(CAMPER.initialPose.cx, 0, CAMPER.initialPose.cz);
  camperRoot.rotation.y = CAMPER.initialPose.yaw;
  scene.add(camperRoot);

  // Parking concrete/gravel pad beside Main Tower (World X=6.0..9.6, Z=1.6..10.2)
  addBox(exteriorGroup, 3.80, 0.08, 8.60, makeSurfaceMat('paver_granite_grid', 3.8, 8.6), 7.80, -0.30, 5.85, false);
  // Connecting walkway from Main East side / North path to Camper West entry steps
  addBox(exteriorGroup, 1.45, 0.08, 2.20, makeSurfaceMat('paver_granite_grid', 1.45, 2.20), 5.65, -0.30, 4.45, false);

  const camperStatic = new THREE.Group();
  const camperDynamic = new THREE.Group();
  camperRoot.add(camperDynamic);

  const rx = (lx) => lx - CAMPER.width / 2;   // -1.35 .. +1.35
  const rz = (lz) => lz - CAMPER.length / 2;  // -3.75 .. +3.75
  const y1 = CAMPER.floor1WorldY;             // +0.04
  const y2 = CAMPER.loft2WorldY;              // +2.08
  const yGround = CAMPER.groundY;             // -0.26

  const localCollidersByLevel = { 1: [], 2: [] };
  const addLocalCollider = (level, minX, minZ, maxX, maxZ) => {
    localCollidersByLevel[level].push({ minX, minZ, maxX, maxZ });
  };

  function addCBox(parent, w, h, d, material, lx, y, lz, castShadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(rx(lx), y, rz(lz));
    m.castShadow = castShadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addCWallBox(w, h, d, lx, y, lz, frontTex, backTex, axis) {
    const faceA = makeSurfaceMat(frontTex, axis === 'h' ? w : d, h);
    const faceB = makeSurfaceMat(backTex, axis === 'h' ? w : d, h);
    const cap = mat.wallCutCap;
    const mats = axis === 'h'
      ? [cap, cap, cap, cap, faceB, faceA]
      : [faceB, faceA, cap, cap, cap, cap];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(rx(lx), y, rz(lz));
    m.castShadow = true;
    m.receiveShadow = true;
    camperStatic.add(m);
    return m;
  }

  function addCWindowFrame(op, wall, baseY) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const midOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const opMid = op.pos + op.width / 2;
    const cy = baseY + (op.sill || 0) + op.height / 2;
    const frameW = 0.032;
    const glassMat = op.type === 'window_frosted' ? mat.glassFrosted : mat.glassClear;
    if (isH) {
      addCBox(camperStatic, op.width, frameW, thick + 0.014, mat.darkIron, opMid, baseY + op.sill + frameW / 2, midOrtho, false);
      addCBox(camperStatic, op.width, frameW, thick + 0.014, mat.darkIron, opMid, baseY + op.sill + op.height - frameW / 2, midOrtho, false);
      addCBox(camperStatic, frameW, op.height, thick + 0.014, mat.darkIron, op.pos + frameW / 2, cy, midOrtho, false);
      addCBox(camperStatic, frameW, op.height, thick + 0.014, mat.darkIron, op.pos + op.width - frameW / 2, cy, midOrtho, false);
      addCBox(camperStatic, op.width - frameW * 2, op.height - frameW * 2, 0.014, glassMat, opMid, cy, midOrtho, false);
    } else {
      addCBox(camperStatic, thick + 0.014, frameW, op.width, mat.darkIron, midOrtho, baseY + op.sill + frameW / 2, opMid, false);
      addCBox(camperStatic, thick + 0.014, frameW, op.width, mat.darkIron, midOrtho, baseY + op.sill + op.height - frameW / 2, opMid, false);
      addCBox(camperStatic, thick + 0.014, op.height, frameW, mat.darkIron, midOrtho, cy, op.pos + frameW / 2, false);
      addCBox(camperStatic, thick + 0.014, op.height, frameW, mat.darkIron, midOrtho, cy, op.pos + op.width - frameW / 2, false);
      addCBox(camperStatic, 0.014, op.height - frameW * 2, op.width - frameW * 2, glassMat, midOrtho, cy, opMid, false);
    }
  }

  function addCamperDoor(level, op, wall, baseY) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const midOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const sillY = baseY + (op.sill || 0);
    const doorH = op.height;
    const doorW = op.width;
    const leafT = 0.032;

    // Trim frame
    if (isH) {
      addCBox(camperStatic, 0.03, doorH, thick + 0.012, mat.darkIron, op.pos + 0.015, sillY + doorH / 2, midOrtho, false);
      addCBox(camperStatic, 0.03, doorH, thick + 0.012, mat.darkIron, op.pos + doorW - 0.015, sillY + doorH / 2, midOrtho, false);
      addCBox(camperStatic, doorW, 0.03, thick + 0.012, mat.darkIron, op.pos + doorW / 2, sillY + doorH - 0.015, midOrtho, false);
    } else {
      addCBox(camperStatic, thick + 0.012, doorH, 0.03, mat.darkIron, midOrtho, sillY + doorH / 2, op.pos + 0.015, false);
      addCBox(camperStatic, thick + 0.012, doorH, 0.03, mat.darkIron, midOrtho, sillY + doorH / 2, op.pos + doorW - 0.015, false);
      addCBox(camperStatic, thick + 0.012, 0.03, doorW, mat.darkIron, midOrtho, sillY + doorH - 0.015, op.pos + doorW / 2, false);
    }

    const leafMat = makeFrontMat(op.tex || 'door_oak', { roughness: 0.45 });
    const pivot = new THREE.Group();
    let leafMesh;

    if (op.type === 'door_swing') {
      const hingeAtStart = op.hinge !== 'right';
      const hx = isH ? (hingeAtStart ? op.pos : op.pos + doorW) : midOrtho;
      const hz = isH ? midOrtho : (hingeAtStart ? op.pos : op.pos + doorW);
      pivot.position.set(rx(hx), sillY, rz(hz));

      const geo = isH ? new THREE.BoxGeometry(doorW - 0.02, doorH - 0.02, leafT) : new THREE.BoxGeometry(leafT, doorH - 0.02, doorW - 0.02);
      leafMesh = new THREE.Mesh(geo, leafMat);
      const off = (hingeAtStart ? 1 : -1) * (doorW / 2);
      leafMesh.position.set(isH ? off : 0, doorH / 2, isH ? 0 : off);
      leafMesh.castShadow = true;
      leafMesh.userData.doorId = op.id;
      pivot.add(leafMesh);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.055), mat.chrome);
      handle.position.set(isH ? (hingeAtStart ? doorW - 0.09 : -doorW + 0.09) : 0, 0.96, isH ? 0 : (hingeAtStart ? doorW - 0.09 : -doorW + 0.09));
      pivot.add(handle);
      camperDynamic.add(pivot);

      const dir = op.swingDir || 1;
      const openAngle = isH
        ? (hingeAtStart ? -dir * Math.PI * 0.50 : dir * Math.PI * 0.50)
        : (hingeAtStart ? dir * Math.PI * 0.50 : -dir * Math.PI * 0.50);

      interactiveDoors.push({
        id: op.id,
        floor: level,
        building: 'camper',
        isCamper: true,
        label: op.label,
        kind: 'swing',
        pivot,
        mesh: leafMesh,
        openAngle,
        progress: 0,
        isOpen: false,
        collider: isH
          ? { minX: op.pos, minZ: wall.z1 - 0.03, maxX: op.pos + doorW, maxZ: wall.z2 + 0.03 }
          : { minX: wall.x1 - 0.03, minZ: op.pos, maxX: wall.x2 + 0.03, maxZ: op.pos + doorW },
      });
    } else {
      const cx = isH ? op.pos + doorW / 2 : midOrtho;
      const cz = isH ? midOrtho : op.pos + doorW / 2;
      pivot.position.set(rx(cx), sillY + doorH / 2, rz(cz));
      const geo = isH ? new THREE.BoxGeometry(doorW - 0.015, doorH - 0.02, leafT) : new THREE.BoxGeometry(leafT, doorH - 0.02, doorW - 0.015);
      leafMesh = new THREE.Mesh(geo, leafMat);
      leafMesh.castShadow = false;
      leafMesh.userData.doorId = op.id;
      pivot.add(leafMesh);
      camperDynamic.add(pivot);

      interactiveDoors.push({
        id: op.id,
        floor: level,
        building: 'camper',
        isCamper: true,
        label: op.label,
        kind: 'pocket',
        axis: isH ? 'x' : 'z',
        pivot,
        mesh: leafMesh,
        closedPos: pivot.position.clone(),
        slideDelta: (op.slideDir || 1) * (doorW - 0.05),
        progress: 0,
        isOpen: false,
        collider: isH
          ? { minX: op.pos, minZ: wall.z1 - 0.02, maxX: op.pos + doorW, maxZ: wall.z2 + 0.02 }
          : { minX: wall.x1 - 0.02, minZ: op.pos, maxX: wall.x2 + 0.02, maxZ: op.pos + doorW },
      });
    }
  }

  // =========================================================================
  // 1. EXPEDITION CHASSIS, 6-WHEEL ROTATING TIRES, BUMPERS & ROOF SOLAR RACK
  // =========================================================================
  const armorDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a312c, roughness: 0.56, metalness: 0.34 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.92, metalness: 0.04 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x5c646d, roughness: 0.34, metalness: 0.72 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x15253a, roughness: 0.22, metalness: 0.65 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: new THREE.Color(0xff9422), emissiveIntensity: 2.2, roughness: 0.25 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd92b2b, emissive: new THREE.Color(0xc41818), emissiveIntensity: 1.8, roughness: 0.28 });
  const headLensMat = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, emissive: new THREE.Color(0xdbeeff), emissiveIntensity: 1.6, roughness: 0.15 });

  // Heavy steel chassis frame rails + underbody water/fuel tanks (yGround+0.16 .. y1)
  addCBox(camperStatic, 2.46, 0.18, 7.34, armorDarkMat, 1.35, y1 - 0.09, 3.75, true);
  // Lower rock-slider armored skirt bands between front & rear axles (vz=2.15..4.55)
  addCBox(camperStatic, 0.08, 0.22, 2.40, armorDarkMat, 0.02, y1 + 0.01, 3.35, true);
  addCBox(camperStatic, 0.08, 0.22, 2.40, armorDarkMat, 2.68, y1 + 0.01, 3.35, true);

  // Heavy Steel Expedition Front Bull-Bar Bumper & Rear Spare Tire Carrier
  addCBox(camperStatic, 2.74, 0.34, 0.16, armorDarkMat, 1.35, y1 + 0.16, -0.08, true);
  addCBox(camperStatic, 2.24, 0.06, 0.06, mat.darkIron, 1.35, y1 + 0.62, -0.14, false);
  addCBox(camperStatic, 0.06, 0.44, 0.06, mat.darkIron, 0.55, y1 + 0.40, -0.14, false);
  addCBox(camperStatic, 0.06, 0.44, 0.06, mat.darkIron, 2.15, y1 + 0.40, -0.14, false);
  addCBox(camperStatic, 2.74, 0.28, 0.14, armorDarkMat, 1.35, y1 + 0.12, 7.57, true);

  // Exterior Headlights (front), Brake Taillights (rear), Roof Amber Expedition Marker Bar
  [0.34, 2.36].forEach((hx) => {
    addCBox(camperStatic, 0.36, 0.16, 0.04, headLensMat, hx, y1 + 0.46, -0.02, false);
    addCBox(camperStatic, 0.32, 0.14, 0.04, tailMat, hx, y1 + 0.48, 7.52, false);
    addCBox(camperStatic, 0.12, 0.08, 0.04, amberMat, hx, y2 + 0.96, -0.02, false);
  });
  addCBox(camperStatic, 0.95, 0.07, 0.07, headLensMat, 1.35, y2 + 1.02, -0.02, false); // Roof LED light bar

  // Side Mirrors (Left & Right at front cab)
  [-0.18, 2.88].forEach((mx) => {
    addCBox(camperStatic, 0.06, 0.28, 0.12, armorDarkMat, mx, y1 + 1.38, 0.35, false);
    addCBox(camperStatic, 0.22, 0.03, 0.03, mat.darkIron, mx > 1 ? 2.76 : -0.06, y1 + 1.38, 0.35, false);
  });

  // Fold-Down Galvanized Steel Entry Steps outside DC-1 (West side vx=-0.34..0.00, vz=2.20..2.78)
  const grateMat = makeSurfaceMat('metal_grate', 0.6, 0.35);
  addCBox(camperStatic, 0.32, 0.035, 0.58, grateMat, -0.16, y1 - 0.14, 2.49, false);
  addCBox(camperStatic, 0.18, 0.035, 0.58, grateMat, -0.09, y1 - 0.03, 2.49, false);

  // Matte-Black Armored Wheel-Well Arches & Fender Flares (100% clean tire clearance — zero hull clipping!)
  const archBackMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.95, metalness: 0.05 });
  const buildFenderArch = (lxSide, zCenter, spanZ) => {
    const sign = lxSide < 1 ? -1 : 1;
    const wallX = lxSide < 1 ? -0.015 : 2.715;
    const flareX = lxSide < 1 ? -0.085 : 2.785;
    // Matte-black recessed wheel-well backing panel on exterior hull behind tires
    addCBox(camperStatic, 0.04, 0.62, spanZ, archBackMat, wallX, y1 + 0.27, zCenter, false);
    // Heavy upper fender flare lip protruding over tire tread
    addCBox(camperStatic, 0.19, 0.065, spanZ + 0.14, armorDarkMat, flareX, y1 + 0.60, zCenter, true);
    // Angled front & rear mudguard end-caps
    addCBox(camperStatic, 0.18, 0.56, 0.06, armorDarkMat, flareX, y1 + 0.30, zCenter - spanZ / 2 - 0.04, false);
    addCBox(camperStatic, 0.18, 0.56, 0.06, armorDarkMat, flareX, y1 + 0.30, zCenter + spanZ / 2 + 0.04, false);
    // Side amber marker light on fender flare
    addCBox(camperStatic, 0.03, 0.04, 0.10, amberMat, flareX + sign * 0.09, y1 + 0.60, zCenter, false);
  };
  [0, 2.70].forEach((side) => {
    buildFenderArch(side, CAMPER.axlesZ[0], 1.00); // Front steering axle arch
    buildFenderArch(side, (CAMPER.axlesZ[1] + CAMPER.axlesZ[2]) / 2, 2.02); // Twin rear bogie tandem arch!
  });

  // 6 Rotating Off-Road Expedition Tires (3 Axles: Front steer + Twin Rear Dualies, wide-track outside hull!)
  const wheelMeshes = [];
  const frontSteerPivots = [];
  const tireW = 0.24;
  const tireGeo = new THREE.CylinderGeometry(CAMPER.wheelRadius, CAMPER.wheelRadius, tireW, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(CAMPER.wheelRadius * 0.52, CAMPER.wheelRadius * 0.52, tireW + 0.018, 12);
  rimGeo.rotateZ(Math.PI / 2);

  CAMPER.axlesZ.forEach((az, axleIdx) => {
    [-0.04, 2.74].forEach((wx) => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(rx(wx), yGround + CAMPER.wheelRadius, rz(az));
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      const lugA = new THREE.Mesh(new THREE.BoxGeometry(tireW + 0.026, 0.055, 0.28), mat.darkIron);
      const lugB = new THREE.Mesh(new THREE.BoxGeometry(tireW + 0.026, 0.28, 0.055), mat.darkIron);
      spinGroup.add(tire, rim, lugA, lugB);
      steerPivot.add(spinGroup);
      camperDynamic.add(steerPivot);
      wheelMeshes.push(spinGroup);
      if (axleIdx === 0) frontSteerPivots.push(steerPivot);
    });
  });

  // Mounted Rear Spare Expedition Wheel on back bumper
  const spareTire = new THREE.Mesh(tireGeo, tireMat);
  spareTire.rotation.y = Math.PI / 2;
  spareTire.position.set(rx(0.68), y1 + 0.85, rz(7.62));
  camperStatic.add(spareTire);

  // =========================================================================
  // 2. FLOORS, 2F LOFT DECKS, SOARING CH 3.02m SKYLIGHT ROOF & SOLAR PANELS
  // =========================================================================
  // 1F Room-Specific Finished Floor Panels
  for (const r of CAMPER_1F.rooms) {
    const fMat = makeSurfaceMat(r.floorTex, r.w, r.d);
    const yOff = r.fl === 'C1FL-20' ? -0.015 : 0.008;
    addCBox(camperStatic, r.w, 0.016, r.d, fMat, r.x + r.w / 2, y1 + yOff, r.z + r.d / 2, false);
  }
  // 2F Loft Structural Honeycomb Decks (thickness 60mm -> Y = y2-0.06 .. y2)
  // Front Loft Deck (CL01: full width 0.07..2.63, vz = 0.07..2.17)
  const deckMat = makeSurfaceMat('wood_walnut_floor', 2.5, 2.2);
  addCBox(camperStatic, 2.56, 0.06, 2.10, deckMat, 1.35, y2 - 0.03, 1.12, true);
  // West Loft Skybridge Deck (CL00: vx = 0.07..1.12, vz = 2.17..5.25 -> leaves vx=1.12..2.63 OPEN to CH 3.02m!)
  addCBox(camperStatic, 1.05, 0.06, 3.08, deckMat, 0.595, y2 - 0.03, 3.71, true);
  // Rear Loft Deck (CL02: vz = 5.25..7.43, slotted cleanly around STC1 stair hatch vx=1.12..1.58, vz=6.54..6.96!)
  addCBox(camperStatic, 2.56, 0.06, 1.29, deckMat, 1.35, y2 - 0.03, 5.895, true);  // North of hatch (5.25..6.54)
  addCBox(camperStatic, 1.05, 0.06, 0.42, deckMat, 0.595, y2 - 0.03, 6.75, true);  // West of hatch
  addCBox(camperStatic, 1.05, 0.06, 0.42, deckMat, 2.105, y2 - 0.03, 6.75, true);  // East of hatch
  addCBox(camperStatic, 2.56, 0.06, 0.47, deckMat, 1.35, y2 - 0.03, 7.195, true);  // South top landing (6.96..7.43)

  // 2F Loft Finish Carpets / Tatami
  addCBox(camperStatic, 2.54, 0.014, 2.08, makeSurfaceMat('carpet_beige', 2.54, 2.08), 1.35, y2 + 0.007, 1.12, false);
  addCBox(camperStatic, 2.54, 0.014, 1.25, makeSurfaceMat('tatami_ryukyu', 2.54, 1.25), 1.35, y2 + 0.007, 5.895, false);

  // Full-Length Insulated Aluminum Roof Shell (Y = +3.06 .. +3.14 -> EXACT 3.400m total height!)
  // Slotted with TWO central panoramic skylights over the soaring CH 3.02m Atrium & Front Loft!
  const roofExtMat = makeSurfaceMat('slate_charcoal', 2.7, 7.5);
  const roofIntMat = makeSurfaceMat('plywood_attic', 2.6, 7.4);
  const yRoof = y2 + CAMPER.loftClearH; // +3.06m (Roof top at +3.14m!)
  addCBox(camperStatic, 2.74, 0.08, 0.90, roofExtMat, 1.35, yRoof + 0.04, 0.45, true); // Front cap
  addCBox(camperStatic, 2.74, 0.08, 1.00, roofExtMat, 1.35, yRoof + 0.04, 2.30, true); // Mid-front
  addCBox(camperStatic, 2.74, 0.08, 2.75, roofExtMat, 1.35, yRoof + 0.04, 6.125, true); // Rear half
  // Left/Right roof rails flanking Skylight 1 (Front Loft vz=0.90..1.80) & Skylight 2 (Central Atrium vz=2.80..4.75)
  [0.36, 2.34].forEach((sx) => {
    addCBox(camperStatic, 0.72, 0.08, 0.90, roofExtMat, sx, yRoof + 0.04, 1.35, true);
    addCBox(camperStatic, 0.72, 0.08, 1.95, roofExtMat, sx, yRoof + 0.04, 3.775, true);
  });
  // Skylight clear glass panels + oak ceiling ribs across the soaring CH 3.02m atrium!
  addCBox(camperStatic, 1.26, 0.025, 0.90, mat.glassClear, 1.35, yRoof + 0.05, 1.35, false);
  addCBox(camperStatic, 1.26, 0.025, 1.95, mat.glassClear, 1.35, yRoof + 0.05, 3.775, false);
  addCBox(camperStatic, 2.56, 0.015, 2.70, roofIntMat, 1.35, yRoof - 0.008, 6.08, false);
  for (let ribZ = 2.40; ribZ <= 5.00; ribZ += 0.52) {
    addCBox(camperStatic, 2.56, 0.05, 0.055, mat.walnut, 1.35, yRoof - 0.025, ribZ, false);
  }
  // Roof Solar Panel Array (Rear roof) & Expedition Rack Rails
  addCBox(camperStatic, 1.85, 0.035, 1.95, solarMat, 1.35, yRoof + 0.10, 6.05, false);
  [0.10, 2.60].forEach((rxBar) => {
    addCBox(camperStatic, 0.04, 0.08, 7.20, mat.darkIron, rxBar, yRoof + 0.11, 3.75, false);
  });

  // =========================================================================
  // 3. BUILD ALL 1F WALLS (14 ROOMS + 460mm CORRIDOR) & 2F LOFT WALLS/RAILINGS
  // =========================================================================
  function buildCamperWalls(floorDef, level) {
    const baseY = floorDef.baseY;
    for (const wall of floorDef.walls) {
      if (wall.kind === 'railing') {
        const isH = wall.axis === 'h';
        const len = isH ? wall.x2 - wall.x1 : wall.z2 - wall.z1;
        const cx = (wall.x1 + wall.x2) / 2;
        const cz = (wall.z1 + wall.z2) / 2;
        const railH = 0.54; // Sleek loft safety balustrade beneath CH 0.98m roof
        if (isH) {
          addCBox(camperStatic, len, 0.035, 0.035, mat.darkIron, cx, baseY + railH, cz, false);
          addCBox(camperStatic, len, 0.03, 0.04, mat.oak, cx, baseY + railH + 0.025, cz, false);
          addCBox(camperStatic, len, railH - 0.06, 0.015, mat.glassClear, cx, baseY + railH / 2, cz, false);
        } else {
          addCBox(camperStatic, 0.035, 0.035, len, mat.darkIron, cx, baseY + railH, cz, false);
          addCBox(camperStatic, 0.04, 0.03, len, mat.oak, cx, baseY + railH + 0.025, cz, false);
          addCBox(camperStatic, 0.015, railH - 0.06, len, mat.glassClear, cx, baseY + railH / 2, cz, false);
        }
        addLocalCollider(level, wall.x1 - 0.02, wall.z1 - 0.02, wall.x2 + 0.02, wall.z2 + 0.02);
        continue;
      }

      const isH = wall.axis === 'h';
      const wallH = wall.wallH || (level === 1 && wall.kind === 'ext' ? CAMPER.loft2LocalY : floorDef.ceilingH);
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
      const frontTex = wall.extTex || wall.texA;
      const backTex = wall.intTex || wall.texB;
      const ops = [...(wall.openings || [])].sort((a, b) => a.pos - b.pos);

      let cursor = start;
      for (const op of ops) {
        if (op.pos > cursor + 0.004) {
          const seg = op.pos - cursor;
          const mid = cursor + seg / 2;
          if (isH) {
            addCWallBox(seg, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
            addLocalCollider(level, cursor, wall.z1, op.pos, wall.z2);
          } else {
            addCWallBox(thick, wallH, seg, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
            addLocalCollider(level, wall.x1, cursor, wall.x2, op.pos);
          }
        }
        const opMid = op.pos + op.width / 2;
        const opSill = Math.max(0, op.sill || 0);
        const opTop = opSill + op.height;
        if (opSill > 0.02) {
          if (isH) {
            addCWallBox(op.width, opSill, thick, opMid, baseY + opSill / 2, centerOrtho, frontTex, backTex, 'h');
            addLocalCollider(level, op.pos, wall.z1, op.pos + op.width, wall.z2);
          } else {
            addCWallBox(thick, opSill, op.width, centerOrtho, baseY + opSill / 2, opMid, frontTex, backTex, 'v');
            addLocalCollider(level, wall.x1, op.pos, wall.x2, op.pos + op.width);
          }
        }
        if (opTop < wallH - 0.01) {
          const headH = wallH - opTop;
          if (isH) addCWallBox(op.width, headH, thick, opMid, baseY + opTop + headH / 2, centerOrtho, frontTex, backTex, 'h');
          else addCWallBox(thick, headH, op.width, centerOrtho, baseY + opTop + headH / 2, opMid, frontTex, backTex, 'v');
        }
        if (op.type.startsWith('door')) addCamperDoor(level, op, wall, baseY);
        else addCWindowFrame(op, wall, baseY);
        cursor = op.pos + op.width;
      }
      if (end > cursor + 0.004) {
        const seg = end - cursor;
        const mid = cursor + seg / 2;
        if (isH) {
          addCWallBox(seg, wallH, thick, mid, baseY + wallH / 2, centerOrtho, frontTex, backTex, 'h');
          addLocalCollider(level, cursor, wall.z1, end, wall.z2);
        } else {
          addCWallBox(thick, wallH, seg, centerOrtho, baseY + wallH / 2, mid, frontTex, backTex, 'v');
          addLocalCollider(level, wall.x1, cursor, wall.x2, end);
        }
      }
    }
  }

  buildCamperWalls(CAMPER_1F, 1);
  buildCamperWalls(CAMPER_2F, 2);

  // Exterior Armored Upper Fascia Band (hiding 2F loft deck seam cleanly outside)
  addCBox(camperStatic, 2.74, 0.08, 0.05, armorDarkMat, 1.35, y2 - 0.02, -0.01, false);
  addCBox(camperStatic, 2.74, 0.08, 0.05, armorDarkMat, 1.35, y2 - 0.02, 7.51, false);
  addCBox(camperStatic, 0.05, 0.08, 7.52, armorDarkMat, -0.01, y2 - 0.02, 3.75, false);
  addCBox(camperStatic, 0.05, 0.08, 7.52, armorDarkMat, 2.71, y2 - 0.02, 3.75, false);

  // =========================================================================
  // 4. REAR LOFT SHIP'S LADDER / STAIR (STC1: 1F Y=0.04 -> 2F Y=2.08)
  // =========================================================================
  const st = CAMPER.stairLocal; // vx=1.12..1.58, vz=6.66 -> 6.96
  const stRise = (y2 - y1) / st.treads;
  const stRun = (st.topZ - st.bottomZ) / st.treads;
  const stW = st.maxX - st.minX - 0.04;
  const stCX = (st.minX + st.maxX) / 2;
  for (let i = 0; i < st.treads; i++) {
    const ty = y1 + (i + 0.5) * stRise;
    const tz = st.bottomZ + (i + 0.5) * stRun;
    addCBox(camperStatic, stW, 0.032, 0.14, mat.oak, stCX, ty, tz, false);
  }
  const stSlopeLen = Math.hypot(st.topZ - st.bottomZ, y2 - y1);
  const stAngle = Math.atan2(y2 - y1, st.topZ - st.bottomZ);
  [st.minX + 0.025, st.maxX - 0.025].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.08, stSlopeLen), mat.darkIron);
    rail.position.set(rx(sx), (y1 + y2) / 2, rz((st.bottomZ + st.topZ) / 2));
    rail.rotation.x = -stAngle;
    camperStatic.add(rail);
  });

  // =========================================================================
  // 5. DETAILED 14-ROOM 1F + 2-LOFT 2F INTERIOR FURNISHINGS & INTERACTIVE CAB
  // =========================================================================
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.62, metalness: 0.25 });
  const screenGlowMat = new THREE.MeshStandardMaterial({ color: 0x0d2638, emissive: new THREE.Color(0x134d70), emissiveIntensity: 0.72, roughness: 0.18 });
  const greenLedMat = new THREE.MeshStandardMaterial({ color: 0x269e5c, emissive: new THREE.Color(0x187d45), emissiveIntensity: 0.95, roughness: 0.25 });
  const redAlertMat = new THREE.MeshStandardMaterial({ color: 0xd94426, emissive: new THREE.Color(0xc22b0e), emissiveIntensity: 1.35, roughness: 0.25 });
  const denimMat = makeSurfaceMat('fabric_denim', 0.6, 0.6);
  const crateMat = makeSurfaceMat('crate_wood', 0.45, 0.45);
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x5c636b, roughness: 0.48, metalness: 0.62 });

  // --- C01: Cockpit (運転室) + Interactive Steering Wheel! ---
  addCBox(camperStatic, 2.48, 0.88, 0.36, dashMat, 1.35, y1 + 0.44, 0.26, true);
  addCBox(camperStatic, 0.56, 0.14, 0.04, screenGlowMat, 0.72, y1 + 0.94, 0.37, false); // Instrument cluster
  addCBox(camperStatic, 0.42, 0.22, 0.04, screenGlowMat, 1.35, y1 + 0.94, 0.35, false); // Center GPS nav display
  addLocalCollider(1, 0.07, 0.07, 2.63, 0.46);
  // Captain's Driver Seat (left) & Co-Pilot Seat (right)
  [0.72, 1.98].forEach((sx) => {
    addCBox(camperStatic, 0.52, 0.42, 0.46, denimMat, sx, y1 + 0.21, 0.80, true);
    addCBox(camperStatic, 0.50, 0.56, 0.10, denimMat, sx, y1 + 0.68, 1.00, true);
  });
  // Interactive Steering Wheel Pivot (rotates visually when steering + [E] enters Driving Mode!)
  const steerWheelGroup = new THREE.Group();
  steerWheelGroup.position.set(rx(0.72), y1 + 0.96, rz(0.51));
  steerWheelGroup.rotation.x = 0.48;
  const wheelTorus = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 18), dashMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10), mat.chrome);
  wheelHub.rotation.x = Math.PI / 2;
  const wheelSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.028, 0.024), mat.darkIron);
  // Large invisible raycast collider box around steering column & driver seat so aiming at cockpit wheel is effortless!
  const driveHitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.52, 0.48),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false }),
  );
  driveHitMesh.userData.propId = 'camper_drive';
  steerWheelGroup.add(wheelTorus, wheelHub, wheelSpoke, driveHitMesh);
  camperDynamic.add(steerWheelGroup);

  // --- C02: Seating Lounge (座席室) ---
  addCBox(camperStatic, 0.42, 0.42, 0.80, denimMat, 0.30, y1 + 0.21, 1.69, true);
  addCBox(camperStatic, 0.10, 0.54, 0.80, denimMat, 0.13, y1 + 0.62, 1.69, false);
  addCBox(camperStatic, 0.32, 0.035, 0.56, mat.oak, 0.66, y1 + 0.66, 1.69, false);
  addLocalCollider(1, 0.08, 1.28, 0.52, 2.10);

  // --- C03: Galley Kitchen (キッチン) ---
  addCBox(camperStatic, 0.40, 0.82, 0.76, mat.oak, 0.28, y1 + 0.41, 3.25, true);
  addCBox(camperStatic, 0.34, 0.03, 0.32, mat.stainless, 0.28, y1 + 0.83, 3.06, false); // Sink
  addCBox(camperStatic, 0.30, 0.025, 0.28, dashMat, 0.28, y1 + 0.835, 3.44, false); // 2-burner IH
  addCBox(camperStatic, 0.30, 0.42, 0.76, mat.oakLight, 0.23, y1 + 1.68, 3.25, false); // Overhead cabinet
  addLocalCollider(1, 0.08, 2.86, 0.49, 3.64);

  // --- C04: Deep Soaking Bath (お風呂) ---
  addCBox(camperStatic, 0.48, 0.52, 0.76, mat.ceramic, 0.32, y1 + 0.26, 4.09, true);
  addCBox(camperStatic, 0.38, 0.03, 0.66, mat.water, 0.32, y1 + 0.48, 4.09, false); // Warm bath water!
  addCBox(camperStatic, 0.08, 0.08, 0.08, mat.chrome, 0.14, y1 + 0.68, 4.09, false);
  addLocalCollider(1, 0.08, 3.70, 0.56, 4.48);

  // --- C05: Independent Rain Shower (シャワー) ---
  addCBox(camperStatic, 0.24, 0.02, 0.24, mat.chrome, 0.38, y1 + 1.88, 4.89, false); // Overhead rain head
  addCBox(camperStatic, 0.04, 1.86, 0.04, mat.chrome, 0.12, y1 + 0.94, 4.89, false); // Shower riser pipe
  addCBox(camperStatic, 0.28, 0.015, 0.28, grateMat, 0.42, y1 - 0.004, 4.89, false); // Drain grate

  // --- C06: Marine RV Toilet (トイレ) ---
  addCBox(camperStatic, 0.38, 0.40, 0.46, mat.ceramic, 0.30, y1 + 0.20, 5.66, true);
  addCBox(camperStatic, 0.16, 0.72, 0.34, mat.ceramic, 0.16, y1 + 0.36, 5.66, false);
  addCBox(camperStatic, 0.22, 0.10, 0.30, mat.ceramic, 0.20, y1 + 0.82, 5.92, false); // Mini sink
  addLocalCollider(1, 0.08, 5.42, 0.50, 5.90);

  // --- C10: Armored Panic Shelter (シェルター室) ---
  // Heavy riveted steel plating on interior West & South walls + emergency ration rack + HEPA air unit + red-amber beacon
  const armorPlateMat = makeSurfaceMat('concrete_pcon', 1.2, 1.9, { color: 0x828c96, roughness: 0.62, metalness: 0.45 });
  addCBox(camperStatic, 0.03, 1.96, 1.32, armorPlateMat, 0.09, y1 + 0.98, 6.75, false);
  addCBox(camperStatic, 0.98, 1.96, 0.03, armorPlateMat, 0.58, y1 + 0.98, 7.40, false);
  addCBox(camperStatic, 0.42, 0.44, 0.72, steelMat, 0.30, y1 + 0.22, 7.02, true); // Armored bench / locker
  addCBox(camperStatic, 0.32, 0.52, 0.42, crateMat, 0.28, y1 + 0.70, 7.15, false); // Emergency rations
  addCBox(camperStatic, 0.24, 0.32, 0.16, mat.darkIron, 0.58, y1 + 1.56, 7.34, false); // HEPA scrubber
  addCBox(camperStatic, 0.12, 0.08, 0.08, redAlertMat, 0.58, y1 + 1.86, 7.34, false); // Emergency beacon
  addLocalCollider(1, 0.08, 6.66, 0.54, 7.40);

  // --- C11: Comms & Satellite Ops (その他① 通信・ナビ制御室) ---
  addCBox(camperStatic, 0.38, 0.74, 0.74, dashMat, 2.42, y1 + 0.37, 1.65, true);
  addCBox(camperStatic, 0.04, 0.32, 0.58, screenGlowMat, 2.58, y1 + 1.12, 1.65, false); // Satellite radar screen
  addCBox(camperStatic, 0.24, 0.16, 0.36, steelMat, 2.44, y1 + 0.82, 1.48, false); // Ham radio transceiver
  addLocalCollider(1, 2.22, 1.27, 2.62, 2.03);

  // --- C08: Walk-In Closet (クローゼット) ---
  addCBox(camperStatic, 0.36, 1.72, 0.72, makeFrontMat('folded_clothes'), 2.43, y1 + 0.86, 2.47, true);
  addCBox(camperStatic, 0.03, 1.48, 0.46, mat.mirror, 2.20, y1 + 0.96, 2.11, false);
  addLocalCollider(1, 2.23, 2.10, 2.62, 2.84);

  // --- C09: Gear & Supply Storage (保管室) ---
  addCBox(camperStatic, 0.36, 1.68, 0.74, steelMat, 2.43, y1 + 0.84, 3.29, true);
  addCBox(camperStatic, 0.28, 0.28, 0.32, crateMat, 2.38, y1 + 0.48, 3.12, false);
  addCBox(camperStatic, 0.28, 0.28, 0.32, crateMat, 2.38, y1 + 1.12, 3.45, false);
  addLocalCollider(1, 2.23, 2.90, 2.62, 3.68);

  // --- C12: Laundry & Drying Room (その他② ランドリー乾燥室) ---
  addCBox(camperStatic, 0.42, 0.88, 0.56, mat.whiteMatte, 2.40, y1 + 0.44, 4.11, true); // Drum washer/dryer
  addCBox(camperStatic, 0.04, 0.34, 0.34, mat.darkIron, 2.18, y1 + 0.48, 4.11, false); // Drum door ring
  addCBox(camperStatic, 0.36, 0.04, 0.70, mat.oak, 2.43, y1 + 0.92, 4.11, false); // Folding top
  addLocalCollider(1, 2.17, 3.76, 2.62, 4.46);

  // --- C13: Power & Battery Vault (その他③ 発電・蓄電池室) ---
  addCBox(camperStatic, 0.38, 1.38, 0.66, steelMat, 2.42, y1 + 0.69, 4.89, true); // 20kWh LiFePO4 rack
  addCBox(camperStatic, 0.04, 0.14, 0.34, greenLedMat, 2.22, y1 + 1.18, 4.89, false); // Charge status LEDs
  addLocalCollider(1, 2.22, 4.55, 2.62, 5.23);

  // --- C14: Medical & Field Repair (その他④ 応急・工作整備室) ---
  addCBox(camperStatic, 0.38, 0.78, 0.70, mat.oak, 2.42, y1 + 0.39, 5.66, true); // Workbench
  addCBox(camperStatic, 0.03, 0.56, 0.64, makeSurfaceMat('pegboard_wood', 0.64, 0.56), 2.60, y1 + 1.24, 5.66, false);
  addCBox(camperStatic, 0.24, 0.30, 0.28, mat.whiteMatte, 2.46, y1 + 1.56, 5.44, false); // First-aid kit
  addCBox(camperStatic, 0.04, 0.12, 0.04, redAlertMat, 2.33, y1 + 1.56, 5.44, false); // Red medical cross V
  addCBox(camperStatic, 0.04, 0.04, 0.12, redAlertMat, 2.33, y1 + 1.56, 5.44, false); // Red medical cross H
  addLocalCollider(1, 2.22, 5.31, 2.62, 6.02);

  // --- C07: 1F Cabin Bedroom (寝室) ---
  const quiltMat = makeSurfaceMat('fabric_floral_quilt', 0.9, 0.8);
  addCBox(camperStatic, 0.94, 0.36, 0.68, mat.oak, 2.12, y1 + 0.18, 7.06, true); // Built-in cabin bed frame
  addCBox(camperStatic, 0.90, 0.14, 0.64, quiltMat, 2.12, y1 + 0.42, 7.06, false); // Mattress & quilt
  addCBox(camperStatic, 0.24, 0.10, 0.46, mat.whiteMatte, 2.44, y1 + 0.52, 7.06, false); // Pillow
  addLocalCollider(1, 1.64, 6.70, 2.62, 7.42);

  // --- 2F LOFT ROOM 1 (CL01 前方スカイ寝台ロフト) ---
  addCBox(camperStatic, 1.52, 0.14, 1.72, quiltMat, 1.82, y2 + 0.07, 1.04, false); // King sky-bunk mattress (walk/crawl right onto it!)
  addCBox(camperStatic, 0.42, 0.10, 0.26, mat.whiteMatte, 1.52, y2 + 0.18, 0.32, false);
  addCBox(camperStatic, 0.42, 0.10, 0.26, mat.whiteMatte, 2.12, y2 + 0.18, 0.32, false);
  addCBox(camperStatic, 0.38, 0.34, 0.52, crateMat, 0.32, y2 + 0.17, 0.42, false); // Bedside gear crate
  addLocalCollider(2, 0.08, 0.08, 0.54, 0.72);

  // --- 2F LOFT ROOM 2 (CL02 後方展望＆収納ロフト) ---
  addCBox(camperStatic, 0.68, 0.24, 0.48, mat.walnut, 2.02, y2 + 0.12, 5.95, true); // Low loft lounge table
  addCBox(camperStatic, 0.44, 0.06, 0.44, makeFrontMat('zabuton_red'), 2.02, y2 + 0.04, 6.45, false);
  addCBox(camperStatic, 0.48, 0.42, 0.48, crateMat, 0.38, y2 + 0.21, 5.65, true); // Expedition cargo bin
  addCBox(camperStatic, 0.46, 0.38, 0.46, crateMat, 0.38, y2 + 0.19, 6.20, true);
  addLocalCollider(2, 0.08, 5.36, 0.66, 6.48);
  addLocalCollider(2, 1.66, 5.68, 2.38, 6.22);

  // =========================================================================
  // 6. CAMPER LIGHTING (building='camper', <= 5 active lights + Twin Headlights!)
  // =========================================================================
  function addCamperLight(name, level, zone, color, intensity, distance, lx, y, lz) {
    const l = new THREE.PointLight(color, 0, distance, 1.45);
    l.position.set(rx(lx), y, rz(lz));
    l.visible = false;
    l.userData.building = 'camper';
    camperRoot.add(l);
    interiorLights.push({ name, floor: level, zone, light: l, baseInt: intensity });
    return l;
  }

  // 1F Lights (4 balanced lights covering Cockpit, High-Ceiling Atrium, Rear Cabins, and Porch Step!)
  addCamperLight('Camper_1F_Cockpit', 1, 'north', 0xc9e2ff, 1.55, 5.2, 1.35, y1 + 1.82, 0.75);
  addCamperLight('Camper_1F_Atrium',  1, 'mid',   0xffcf94, 2.35, 7.6, 1.35, yRoof - 0.18, 3.60);
  addCamperLight('Camper_1F_Rear',    1, 'south', 0xffbc75, 1.75, 5.8, 1.35, y1 + 1.82, 6.35);
  addCamperLight('Camper_Ext_Step',   1, 'exterior', 0xffbe72, 1.35, 5.2, -0.45, y1 + 1.75, 2.49);
  // 2F Loft Lights (2 warm loft lights + Atrium bleed)
  addCamperLight('Camper_2F_Front',   2, 'north', 0xffc888, 1.85, 5.6, 1.35, y2 + 0.84, 1.15);
  addCamperLight('Camper_2F_Rear',    2, 'south', 0xffb86c, 1.85, 5.6, 1.35, y2 + 0.84, 6.10);

  // Twin High-Beam LED Driving Headlights (mounted to camperRoot, aimed forward along -Z!)
  const headlights = [];
  [0.45, 2.25].forEach((hx) => {
    const spot = new THREE.SpotLight(0xeef6ff, 0.0, 34.0, Math.PI * 0.24, 0.45, 1.25);
    spot.position.set(rx(hx), y1 + 0.56, rz(-0.12));
    const target = new THREE.Object3D();
    target.position.set(rx(hx), yGround - 0.4, rz(-18.0));
    camperRoot.add(spot, target);
    spot.target = target;
    headlights.push(spot);
  });

  // =========================================================================
  // 7. INTERNAL UV-BAKED STATIC BATCHING INSIDE MOVABLE CAMPER ROOT
  // =========================================================================
  const { batchedGroup: camperBatched, stats: camperBatchStats } = batchStaticGroups([camperStatic]);
  camperRoot.add(camperBatched);

  // Interactive Driving Seat Controller Prop
  const driveProp = {
    id: 'camper_drive',
    floor: 1,
    building: 'camper',
    mesh: driveHitMesh,
    isOn: false,
    getLabel() {
      return this.isOn ? 'キャンピングカーを停車して降りる' : '運転席に乗る（キャンピングカーを動かす）';
    },
    toggle() {
      // Handled directly by scene3d.js toggleCamperDrive()!
    },
  };
  interactiveProps.push(driveProp);

  return {
    root: camperRoot,
    pose: { cx: CAMPER.initialPose.cx, cz: CAMPER.initialPose.cz, yaw: CAMPER.initialPose.yaw },
    speed: 0,
    steerAngle: 0,
    headlightsOn: false,
    headlights,
    wheelMeshes,
    frontSteerPivots,
    steerWheelGroup,
    driveProp,
    localCollidersByLevel,
    batchStats: camperBatchStats,
  };
}
