import * as THREE from 'three';
import {
  ARMOR_CAMPER, ARMOR_CAMPER_PLAN,
  TOW_CONTAINER, TOW_CONTAINER_PLAN,
} from './warehouseAndArmorData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds:
 *   1. ARMOR-155 (15.50m × 3.10m × 4.00m) — 1-Story Heavy Steel-Armored Expedition Camper
 *      with Warm Wooden Secret-Base Interior (ZERO layout overlap with CAMPER-75!),
 *      minimal slit windows + motorized IRON STORM SHUTTERS, 8×8 chassis, & rear tow pintle.
 *   2. CON-24 (2.00m × 4.00m × 3.00m) — Walk-In Steel ISO Warehouse Container Trailer
 *      that couples cleanly behind ARMOR-155 (max 1 trailer) with articulated towing kinematics!
 */
export function buildArmorCamperAndContainer3D(ctx) {
  const {
    scene,
    mat,
    interactiveDoors,
    interactiveProps,
    interiorLights,
  } = ctx;

  // =========================================================================
  // PART 1: ARMOR-155 (W 3.10m × L 15.50m × H 4.00m, 1-Story Secret Base)
  // =========================================================================
  const W = ARMOR_CAMPER.width;        // 3.10
  const L = ARMOR_CAMPER.length;       // 15.50
  const yFloor = ARMOR_CAMPER.floorWorldY;     // +0.62
  const yGround = ARMOR_CAMPER.groundY;        // -0.32
  const clearH = ARMOR_CAMPER.interiorClearH;  // 2.76 -> ceiling at 3.38, roof top at 3.68 (Total H = 4.000m!)
  const yRoof = ARMOR_CAMPER.roofTopWorldY;    // +3.68

  const armorRoot = new THREE.Group();
  armorRoot.name = 'MovableArmorCamper_ARMOR155';
  armorRoot.position.set(ARMOR_CAMPER.initialPose.cx, 0, ARMOR_CAMPER.initialPose.cz);
  armorRoot.rotation.y = ARMOR_CAMPER.initialPose.yaw;
  scene.add(armorRoot);

  const aStatic = new THREE.Group();
  const aDynamic = new THREE.Group();
  armorRoot.add(aDynamic);

  const rx = (lx) => lx - W * 0.5;
  const rz = (lz) => lz - L * 0.5;

  const localColliders = [];
  const addACol = (minX, minZ, maxX, maxZ) => {
    localColliders.push({
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
    });
  };

  const armorSteelMat = makeSurfaceMat('armor_steel_plate', 2.4, 2.4);
  const darkArmorTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e2329, roughness: 0.44, metalness: 0.80 });
  const heavyIronMat = new THREE.MeshStandardMaterial({ color: 0x161a1f, roughness: 0.52, metalness: 0.78 });
  const shutterMat = makeSurfaceMat('iron_shutter_slat', 1.6, 0.8);
  const cedarMat = makeSurfaceMat('secret_cedar_plank', 2.4, 2.4);
  const walnutMat = makeSurfaceMat('wood_walnut_floor', 2.2, 2.2, { roughness: 0.42 });
  const hinokiMat = makeSurfaceMat('wood_slats', 1.6, 2.2, { color: 0xecd9b6, roughness: 0.46 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5c341d, roughness: 0.62, metalness: 0.04 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb86a3a, roughness: 0.28, metalness: 0.84 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a04d, roughness: 0.28, metalness: 0.86 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.92, metalness: 0.04 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x3b434d, roughness: 0.36, metalness: 0.78 });
  const warmCoveMat = new THREE.MeshStandardMaterial({
    color: 0xffdfaa,
    emissive: new THREE.Color(0xff9c38),
    emissiveIntensity: 1.75,
    roughness: 0.3,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6b22,
    emissive: new THREE.Color(0xff4800),
    emissiveIntensity: 2.8,
    roughness: 0.4,
  });
  const navScreenMat = new THREE.MeshStandardMaterial({
    color: 0x0b2220,
    emissive: new THREE.Color(0x10b981),
    emissiveIntensity: 1.05,
    roughness: 0.2,
  });
  const headlampMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e6,
    emissive: new THREE.Color(0xfff1cc),
    emissiveIntensity: 2.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 1.6,
  });
  const bathWaterMat = new THREE.MeshStandardMaterial({
    color: 0x4ca6a8,
    roughness: 0.12,
    metalness: 0.14,
    transparent: true,
    opacity: 0.78,
  });

  function addABox(parent, w, h, d, material, lx, y, lz, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(rx(lx), y, rz(lz));
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addAWallBox(w, h, d, lx, y, lz, frontTex, backTex, axis) {
    const faceA = makeSurfaceMat(frontTex, axis === 'h' ? w : d, h);
    const faceB = makeSurfaceMat(backTex, axis === 'h' ? w : d, h);
    const cap = darkArmorTrimMat;
    const mats = axis === 'h'
      ? [cap, cap, cap, cap, faceB, faceA]
      : [faceB, faceA, cap, cap, cap, cap];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(rx(lx), y, rz(lz));
    m.castShadow = true;
    m.receiveShadow = true;
    aStatic.add(m);
    return m;
  }

  // ---- 1A. HEAVY 8×8 ARMORED CHASSIS, BUMPERS, BULLBAR, AXLES & WHEELS ----
  // Main armored chassis underbelly tub (ground clearance ~0.58m!)
  addABox(aStatic, W - 0.18, 0.36, L - 0.40, heavyIronMat, W / 2, yFloor - 0.18, L / 2, true);
  // Heavy sloped ballistic front ram bumper & steel bullbar cage
  addABox(aStatic, W + 0.08, 0.48, 0.36, heavyIronMat, W / 2, yFloor + 0.04, -0.14, true);
  addABox(aStatic, W - 0.10, 0.10, 0.10, darkArmorTrimMat, W / 2, yFloor + 0.85, -0.26, false);
  [0.35, 1.05, 2.05, 2.75].forEach((bx) => {
    addABox(aStatic, 0.09, 0.65, 0.09, darkArmorTrimMat, bx, yFloor + 0.52, -0.24, false);
  });
  // Rear heavy steel impact bumper + integrated Tow Pintle Hitch Mount!
  addABox(aStatic, W + 0.06, 0.42, 0.32, heavyIronMat, W / 2, yFloor - 0.02, L + 0.12, true);
  addABox(aStatic, 0.24, 0.20, 0.48, darkArmorTrimMat, W / 2, yFloor - 0.14, L + 0.34, false);
  const hitchBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat.chrome);
  hitchBall.position.set(0, yFloor - 0.02, rz(ARMOR_CAMPER.hitchLocalZ));
  aStatic.add(hitchBall);

  // Side armored rock-slider steel skirts & retractable entry step box under DAM-1 (lz = 13.95..14.87)
  addABox(aStatic, 0.14, 0.28, L - 1.2, heavyIronMat, 0.05, yFloor - 0.16, L / 2, false);
  addABox(aStatic, 0.14, 0.28, L - 1.2, heavyIronMat, W - 0.05, yFloor - 0.16, L / 2, false);
  // Steel boarding steps on West side leading up into DAM-1 airlock (ground -0.32 -> floor +0.62)
  addABox(aStatic, 0.46, 0.06, 1.04, makeSurfaceMat('metal_grate', 0.46, 1.04), -0.23, yFloor - 0.32, 14.41, false);
  addABox(aStatic, 0.46, 0.06, 1.04, makeSurfaceMat('metal_grate', 0.46, 1.04), -0.26, yFloor - 0.62, 14.41, false);

  // 8×8 Heavy Off-Road Wheels (Front 2 axles steer, all 8 spin!)
  const wheelMeshes = [];
  const frontSteerPivots = [];
  const wRad = ARMOR_CAMPER.wheelRadius; // 0.56m
  const wW = ARMOR_CAMPER.wheelWidth;    // 0.36m
  ARMOR_CAMPER.axlesZ.forEach((az, aIdx) => {
    // Heavy solid axle beam across chassis
    addABox(aStatic, W - 0.40, 0.18, 0.20, heavyIronMat, W / 2, yGround + wRad, az, false);
    // Steel wheel-arch armor flare
    [0.06, W - 0.06].forEach((fx) => {
      addABox(aStatic, 0.24, 0.14, 1.38, darkArmorTrimMat, fx, yFloor + 0.14, az, false);
    });
    [0.24, W - 0.24].forEach((wx) => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(rx(wx), yGround + wRad, rz(az));
      aDynamic.add(steerPivot);
      if (aIdx < 2) frontSteerPivots.push(steerPivot);

      const spinGrp = new THREE.Group();
      steerPivot.add(spinGrp);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wRad, wRad, wW, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spinGrp.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wRad * 0.54, wRad * 0.54, wW + 0.02, 12), rimMat);
      hub.rotation.z = Math.PI / 2;
      spinGrp.add(hub);
      // Heavy lug spoke bar so rotation is crisp and visible
      const lug = new THREE.Mesh(new THREE.BoxGeometry(wW + 0.04, 0.08, wRad * 0.88), darkArmorTrimMat);
      spinGrp.add(lug);
      wheelMeshes.push(spinGrp);
    });
  });

  // High-Output Armored LED Storm Headlights + Roof Lightbar + Rear Taillights
  [0.52, W - 0.52].forEach((hx) => {
    addABox(aStatic, 0.34, 0.16, 0.08, headlampMat, hx, yFloor + 0.56, -0.02, false);
    addABox(aStatic, 0.32, 0.14, 0.08, taillightMat, hx, yFloor + 0.48, L + 0.02, false);
  });
  addABox(aStatic, 1.70, 0.10, 0.12, headlampMat, W / 2, yRoof + 0.08, 0.42, false);

  const headlights = [];
  [0.75, W - 0.75].forEach((hx) => {
    const spot = new THREE.SpotLight(0xfff5e0, 0.0, 56.0, Math.PI * 0.28, 0.48, 1.2);
    spot.position.set(rx(hx), yFloor + 0.65, rz(0.0));
    const tgt = new THREE.Object3D();
    tgt.position.set(rx(hx), yFloor - 1.2, rz(-24.0));
    armorRoot.add(spot);
    armorRoot.add(tgt);
    spot.target = tgt;
    headlights.push(spot);
  });

  // ---- 1B. FLOOR DECK, ARMORED STEEL SHELL WALLS, MINIMAL SLIT WINDOWS & MOTORIZED IRON SHUTTERS ----
  // Interior warm cedar/walnut floor deck (A01..A05 wood, A06 steel airlock grate — cleanly disjoint!)
  addABox(aStatic, W - 0.16, 0.08, 13.38, makeSurfaceMat('secret_cedar_plank', W - 0.16, 13.38), W / 2, yFloor - 0.04, 6.79, false);
  addABox(aStatic, W - 0.16, 0.08, 1.90, makeSurfaceMat('metal_grate', W - 0.16, 1.90), W / 2, yFloor - 0.04, 14.44, false);
  // Armored Steel Roof Slab (yFloor+clearH .. yRoof) + Cedar Interior Ceiling strictly inside exterior walls!
  addABox(aStatic, W, 0.14, L, armorSteelMat, W / 2, yRoof - 0.07, L / 2, true);
  addABox(aStatic, W - 0.26, 0.05, L - 0.26, cedarMat, W / 2, yFloor + clearH + 0.025, L / 2, false);
  // Roof Expedition Steel Railings, Solar Panels, Satellite Radar Dome & Insulated Wood-Stove Chimney!
  addABox(aStatic, 0.06, 0.24, L - 1.2, darkArmorTrimMat, 0.14, yRoof + 0.12, L / 2, false);
  addABox(aStatic, 0.06, 0.24, L - 1.2, darkArmorTrimMat, W - 0.14, yRoof + 0.12, L / 2, false);
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x16243b, roughness: 0.18, metalness: 0.65 });
  [2.6, 6.2, 9.8, 13.2].forEach((sz) => {
    addABox(aStatic, 2.20, 0.05, 2.60, solarMat, W / 2, yRoof + 0.04, sz, false);
  });
  // Wood-stove insulated stainless steel chimney stack at lz=4.80
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.52, 12), mat.chrome);
  chimney.position.set(rx(0.42), yRoof + 0.26, rz(4.80));
  aStatic.add(chimney);

  // Build Walls + Panoramic Armored Windshield + Motorized IRON SHUTTERS + Doors directly from ARMOR_CAMPER_PLAN!
  const ironShutters = [];
  const extWallH = yRoof - 0.142 - yFloor;
  const intWallH = clearH - 0.006;

  ARMOR_CAMPER_PLAN.walls.forEach((wall) => {
    const isH = wall.axis === 'h';
    const wallH = wall.kind === 'ext' ? extWallH : intWallH;
    const wallStart = isH ? wall.x1 : wall.z1;
    const wallEnd = isH ? wall.x2 : wall.z2;
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const midOrtho = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const isFarExt = wall.kind === 'ext' && (wall.id === 'WAM_E' || wall.id === 'WAM_S');
    const frontTex = wall.kind === 'ext' ? (isFarExt ? wall.intTex : wall.extTex) : wall.texA;
    const backTex = wall.kind === 'ext' ? (isFarExt ? wall.extTex : wall.intTex) : wall.texB;
    const ops = [...(wall.openings || [])].sort((a, b) => a.pos - b.pos);

    let cur = wallStart;
    ops.forEach((op) => {
      if (op.pos > cur + 0.005) {
        const segLen = op.pos - cur;
        const segMid = cur + segLen / 2;
        if (isH) {
          addAWallBox(segLen, wallH, thick, segMid, yFloor + wallH / 2, midOrtho, frontTex, backTex, 'h');
          addACol(cur, wall.z1, op.pos, wall.z2);
        } else {
          addAWallBox(thick, wallH, segLen, midOrtho, yFloor + wallH / 2, segMid, frontTex, backTex, 'v');
          addACol(wall.x1, cur, wall.x2, op.pos);
        }
      }
      // Sill below opening
      const sill = op.sill || 0;
      if (sill > 0.01) {
        const mid = op.pos + op.width / 2;
        if (isH) {
          addAWallBox(op.width, sill, thick, mid, yFloor + sill / 2, midOrtho, frontTex, backTex, 'h');
          addACol(op.pos, wall.z1, op.pos + op.width, wall.z2);
        } else {
          addAWallBox(thick, sill, op.width, midOrtho, yFloor + sill / 2, mid, frontTex, backTex, 'v');
          addACol(wall.x1, op.pos, wall.x2, op.pos + op.width);
        }
      }
      // Header above opening
      const topH = wallH - (sill + op.height);
      if (topH > 0.01) {
        const mid = op.pos + op.width / 2;
        const cy = yFloor + sill + op.height + topH / 2;
        if (isH) addAWallBox(op.width, topH, thick, mid, cy, midOrtho, frontTex, backTex, 'h');
        else addAWallBox(thick, topH, op.width, midOrtho, cy, mid, frontTex, backTex, 'v');
      }

      // Opening details: Window + Motorized IRON SHUTTER OR Interactive Door!
      if (op.type === 'window') {
        const mid = op.pos + op.width / 2;
        const cy = yFloor + sill + op.height / 2;
        if (isH) {
          addABox(aStatic, op.width - 0.04, op.height - 0.04, 0.025, mat.glassClear, mid, cy, midOrtho, false);
          addABox(aStatic, op.width + 0.08, 0.06, thick + 0.08, darkArmorTrimMat, mid, yFloor + sill + op.height + 0.032, midOrtho, false);
          addABox(aStatic, op.width + 0.08, 0.05, thick + 0.06, darkArmorTrimMat, mid, yFloor + sill - 0.026, midOrtho, false);
          if (op.hasIronShutter) {
            const shMesh = new THREE.Mesh(new THREE.BoxGeometry(op.width + 0.04, op.height + 0.04, 0.045), shutterMat);
            const openY = yFloor + sill + op.height + op.height * 0.46;
            const closedY = cy;
            shMesh.position.set(rx(mid), openY, rz(midOrtho - thick * 0.5 - 0.04));
            shMesh.scale.y = 0.08;
            aDynamic.add(shMesh);
            ironShutters.push({ mesh: shMesh, openY, closedY, fullH: op.height + 0.04 });
          }
        } else {
          addABox(aStatic, 0.025, op.height - 0.04, op.width - 0.04, mat.glassClear, midOrtho, cy, mid, false);
          addABox(aStatic, thick + 0.08, 0.06, op.width + 0.08, darkArmorTrimMat, midOrtho, yFloor + sill + op.height + 0.032, mid, false);
          addABox(aStatic, thick + 0.06, 0.05, op.width + 0.08, darkArmorTrimMat, midOrtho, yFloor + sill - 0.026, mid, false);
          if (op.hasIronShutter) {
            const shMesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, op.height + 0.04, op.width + 0.04), shutterMat);
            const sideSign = midOrtho < W * 0.5 ? -1 : 1;
            const openY = yFloor + sill + op.height + op.height * 0.46;
            const closedY = cy;
            shMesh.position.set(rx(midOrtho + sideSign * (thick * 0.5 + 0.04)), openY, rz(mid));
            shMesh.scale.y = 0.08;
            aDynamic.add(shMesh);
            ironShutters.push({ mesh: shMesh, openY, closedY, fullH: op.height + 0.04 });
          }
        }
      } else if (op.type === 'door_swing' || op.type === 'door_pocket') {
        const doorH = op.height;
        const doorW = op.width;
        const panelMat = op.tex === 'armor_steel_plate' ? armorSteelMat : makeFrontMat(op.tex || 'door_walnut', { roughness: 0.45 });
        const pivot = new THREE.Group();
        aDynamic.add(pivot);
        let leafMesh;
        if (op.type === 'door_swing') {
          const hingeCoord = op.pos + 0.02;
          if (isH) {
            pivot.position.set(rx(hingeCoord), yFloor, rz(midOrtho));
            leafMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.04, doorH - 0.03, 0.055), panelMat);
            leafMesh.position.set((doorW - 0.04) / 2, (doorH - 0.03) / 2, 0);
          } else {
            pivot.position.set(rx(midOrtho), yFloor, rz(hingeCoord));
            leafMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, doorH - 0.03, doorW - 0.04), panelMat);
            leafMesh.position.set(0, (doorH - 0.03) / 2, (doorW - 0.04) / 2);
          }
          leafMesh.userData.doorId = op.id;
          pivot.add(leafMesh);
          interactiveDoors.push({
            id: op.id,
            floor: 1,
            isArmor: true,
            kind: 'swing',
            label: op.label,
            pivot,
            mesh: leafMesh,
            openAngle: (op.swingDir || 1) * Math.PI * 0.52,
            isOpen: false,
            progress: 0,
            collider: isH
              ? { minX: op.pos, maxX: op.pos + doorW, minZ: wall.z1 - 0.04, maxZ: wall.z2 + 0.04 }
              : { minX: wall.x1 - 0.04, maxX: wall.x2 + 0.04, minZ: op.pos, maxZ: op.pos + doorW },
            localCenter: isH ? { lx: op.pos + doorW / 2, lz: midOrtho } : { lx: midOrtho, lz: op.pos + doorW / 2 },
            center: new THREE.Vector3(),
          });
        } else {
          // Sliding pocket / timber barn door
          const slideDelta = (op.slideDir || 1) * (doorW - 0.06);
          if (isH) {
            pivot.position.set(rx(op.pos + doorW / 2), yFloor + doorH / 2, rz(midOrtho));
            leafMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.04, doorH - 0.03, 0.05), panelMat);
          } else {
            pivot.position.set(rx(midOrtho), yFloor + doorH / 2, rz(op.pos + doorW / 2));
            leafMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, doorH - 0.03, doorW - 0.04), panelMat);
          }
          leafMesh.userData.doorId = op.id;
          pivot.add(leafMesh);
          interactiveDoors.push({
            id: op.id,
            floor: 1,
            isArmor: true,
            kind: 'pocket',
            axis: isH ? 'x' : 'z',
            label: op.label,
            pivot,
            mesh: leafMesh,
            closedPos: pivot.position.clone(),
            slideDelta,
            isOpen: false,
            progress: 0,
            collider: isH
              ? { minX: op.pos, maxX: op.pos + doorW, minZ: wall.z1 - 0.04, maxZ: wall.z2 + 0.04 }
              : { minX: wall.x1 - 0.04, maxX: wall.x2 + 0.04, minZ: op.pos, maxZ: op.pos + doorW },
            localCenter: isH ? { lx: op.pos + doorW / 2, lz: midOrtho } : { lx: midOrtho, lz: op.pos + doorW / 2 },
            center: new THREE.Vector3(),
          });
        }
      }
      cur = op.pos + op.width;
    });

    if (cur < wallEnd - 0.005) {
      const segLen = wallEnd - cur;
      const segMid = cur + segLen / 2;
      if (isH) {
        addAWallBox(segLen, wallH, thick, segMid, yFloor + wallH / 2, midOrtho, frontTex, backTex, 'h');
        addACol(cur, wall.z1, wallEnd, wall.z2);
      } else {
        addAWallBox(thick, wallH, segLen, midOrtho, yFloor + wallH / 2, segMid, frontTex, backTex, 'v');
        addACol(wall.x1, cur, wall.x2, wallEnd);
      }
    }
  });

  // ---- 1C. WARM WOODEN SECRET-BASE INTERIOR (6 COMPLETELY ORIGINAL ZONES!) ----
  // Exposed Curved Dark-Walnut Timber Ceiling Ribs (vertical posts stop cleanly below top beams — zero corner Z-fighting!)
  for (let zRib = 2.6; zRib <= 13.4; zRib += 1.35) {
    addABox(aStatic, W - 0.26, 0.14, 0.10, walnutMat, W / 2, yFloor + clearH - 0.075, zRib, false);
    addABox(aStatic, 0.10, clearH - 0.15, 0.10, walnutMat, 0.18, yFloor + (clearH - 0.15) / 2, zRib, false);
    addABox(aStatic, 0.10, clearH - 0.15, 0.10, walnutMat, W - 0.18, yFloor + (clearH - 0.15) / 2, zRib, false);
  }
  // Continuous warm amber indirect LED cove bars tucked beneath ceiling eaves
  addABox(aStatic, 0.04, 0.04, 10.6, warmCoveMat, 0.25, yFloor + clearH - 0.22, 8.0, false);
  addABox(aStatic, 0.04, 0.04, 10.6, warmCoveMat, W - 0.25, yFloor + clearH - 0.22, 8.0, false);

  // ZONE A01: Armored Command Cockpit (z = 0.12..2.50)
  // Full-width low-profile tactical dash + compact route computer display (clear windshield sightline!)
  addABox(aStatic, W - 0.30, 0.84, 0.60, darkArmorTrimMat, W / 2, yFloor + 0.42, 0.45, false);
  addABox(aStatic, W - 0.32, 0.05, 0.56, walnutMat, W / 2, yFloor + 0.865, 0.47, false);
  addABox(aStatic, 0.64, 0.22, 0.04, navScreenMat, W / 2, yFloor + 0.99, 0.38, false); // Low-profile nav display below sightline
  addACol(0.14, 0.14, W - 0.14, 0.80);

  // Driver Captain Seat (Port X=0.88, Z=1.38) + Co-Pilot Seat (Starboard X=2.22, Z=1.38)
  [0.88, 2.22].forEach((sx) => {
    addABox(aStatic, 0.62, 0.40, 0.58, heavyIronMat, sx, yFloor + 0.20, 1.44, false);
    addABox(aStatic, 0.60, 0.14, 0.56, leatherMat, sx, yFloor + 0.475, 1.44, false);
    addABox(aStatic, 0.58, 0.74, 0.14, leatherMat, sx, yFloor + 0.90, 1.71, false);
  });
  addACol(1.90, 1.12, 2.58, 1.82);

  // Interactive Steering Wheel (Press [E] or Tap to Drive ARMOR-155!)
  const steerWheelGroup = new THREE.Group();
  steerWheelGroup.position.set(rx(0.88), yFloor + 0.96, rz(0.86));
  steerWheelGroup.rotation.x = 0.42;
  aDynamic.add(steerWheelGroup);
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 10, 22), darkArmorTrimMat);
  steerWheelGroup.add(wheelRing);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), brassMat);
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.userData.propId = 'armor_drive';
  steerWheelGroup.add(wheelHub);
  wheelRing.userData.propId = 'armor_drive';

  const driveProp = {
    id: 'armor_drive',
    floor: 1,
    isArmor: true,
    mesh: wheelRing,
    isOn: false,
    getLabel() { return this.isOn ? '降車' : '運転'; },
  };
  interactiveProps.push(driveProp);

  // Physical 3D Motorized Iron Shutter Toggle Button inside Cockpit (X=0.22, Y=1.24, Z=1.22)
  const shutterBtnMatOpen = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: new THREE.Color(0x38bdf8), emissiveIntensity: 0.9 });
  const shutterBtnMatClosed = new THREE.MeshStandardMaterial({ color: 0x7c2d12, emissive: new THREE.Color(0xf97316), emissiveIntensity: 1.5 });
  const shutterBtnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.16), shutterBtnMatOpen);
  shutterBtnMesh.position.set(rx(0.18), yFloor + 1.24, rz(1.22));
  shutterBtnMesh.userData.propId = 'armor_shutter';
  aDynamic.add(shutterBtnMesh);

  const armorState = {
    shuttersClosed: false,
    shutterProgress: 0,
    toggleShutters(force = null) {
      this.shuttersClosed = force !== null ? Boolean(force) : !this.shuttersClosed;
      shutterBtnMesh.material = this.shuttersClosed ? shutterBtnMatClosed : shutterBtnMatOpen;
      return this.shuttersClosed;
    },
    updateShutters(dt) {
      const target = this.shuttersClosed ? 1 : 0;
      if (Math.abs(this.shutterProgress - target) > 0.002) {
        this.shutterProgress += (target - this.shutterProgress) * Math.min(1, dt * 4.5);
        if (Math.abs(this.shutterProgress - target) < 0.005) this.shutterProgress = target;
        ironShutters.forEach((sh) => {
          const p = Math.max(0.06, this.shutterProgress);
          sh.mesh.scale.y = p;
          sh.mesh.position.y = sh.openY + (sh.closedY - sh.openY) * this.shutterProgress;
        });
      }
    },
  };

  interactiveProps.push({
    id: 'armor_shutter',
    floor: 1,
    isArmor: true,
    mesh: shutterBtnMesh,
    getLabel() { return armorState.shuttersClosed ? '鉄シャッター開' : '鉄シャッター閉'; },
    toggle() { armorState.toggleShutters(); },
  });

  // ZONE A02: Windowless Cedar Secret-Base Lounge & Cast-Iron Wood Stove (z = 2.50..5.80)
  // Cast-iron wood-burning stove on slate hearth pad (Port side X=0.45, Z=4.80)
  addABox(aStatic, 0.72, 0.04, 0.78, makeSurfaceMat('slate_charcoal', 0.72, 0.78), 0.48, yFloor + 0.022, 4.80, false);
  addABox(aStatic, 0.48, 0.64, 0.44, heavyIronMat, 0.46, yFloor + 0.365, 4.80, true);
  addABox(aStatic, 0.04, 0.24, 0.24, emberMat, 0.71, yFloor + 0.42, 4.80, false);
  const fluePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, clearH - 0.68, 10), heavyIronMat);
  fluePipe.position.set(rx(0.42), yFloor + 0.685 + (clearH - 0.68) / 2, rz(4.80));
  aStatic.add(fluePipe);
  addACol(0.14, 4.40, 0.86, 5.20);

  // Built-in Starboard U-Shaped Cedar & Saddle-Leather Sunken Pit Lounge (disjoint mitered corners — zero Z-fighting!)
  addABox(aStatic, 0.64, 0.44, 0.56, cedarMat, 2.05, yFloor + 0.22, 2.95, true);
  addABox(aStatic, 0.62, 0.12, 0.52, leatherMat, 2.05, yFloor + 0.502, 2.95, false);
  addABox(aStatic, 0.58, 0.44, 2.98, cedarMat, 2.66, yFloor + 0.22, 4.17, true);
  addABox(aStatic, 0.54, 0.12, 2.92, leatherMat, 2.66, yFloor + 0.502, 4.17, false);
  addABox(aStatic, 0.12, 0.52, 2.90, leatherMat, 2.90, yFloor + 0.825, 4.17, false);
  addABox(aStatic, 0.64, 0.44, 0.56, cedarMat, 2.05, yFloor + 0.22, 5.38, true);
  addABox(aStatic, 0.62, 0.12, 0.52, leatherMat, 2.05, yFloor + 0.502, 5.38, false);
  // Solid Walnut Expedition Chart Table inside U-Pit
  addABox(aStatic, 0.74, 0.05, 1.42, walnutMat, 1.98, yFloor + 0.74, 4.18, true);
  addABox(aStatic, 0.12, 0.72, 0.12, heavyIronMat, 2.02, yFloor + 0.36, 4.18, false);
  // Brass expedition table lantern on chart table
  const lanternBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 10), warmCoveMat);
  lanternBody.position.set(rx(2.02), yFloor + 0.88, rz(4.18));
  aStatic.add(lanternBody);
  addACol(1.62, 2.68, 2.96, 5.66);

  // Port Wall Secret-Base Pegboard Gear Rack & Cedar Bookshelf (X=0.14..0.52, Z=2.70..4.25)
  addABox(aStatic, 0.32, 2.15, 1.42, walnutMat, 0.28, yFloor + 1.08, 3.45, false);
  addABox(aStatic, 0.04, 1.15, 1.32, makeSurfaceMat('pegboard_wood', 1.32, 1.15), 0.44, yFloor + 1.45, 3.45, false);
  addACol(0.14, 2.70, 0.50, 4.22);

  // ZONE A03: Timber Butcher-Block Galley & Copper Espresso Counter (z = 5.80..8.60)
  // Starboard Thick Walnut Butcher-Block Galley Counter (X=2.24..2.96, Z=5.95..8.45)
  addABox(aStatic, 0.68, 0.86, 2.48, cedarMat, 2.60, yFloor + 0.43, 7.20, true);
  addABox(aStatic, 0.72, 0.06, 2.52, walnutMat, 2.60, yFloor + 0.89, 7.20, false);
  // Hammered copper sink basin & brass gooseneck faucet + 2-burner iron stove
  addABox(aStatic, 0.44, 0.04, 0.52, copperMat, 2.58, yFloor + 0.93, 6.65, false);
  addABox(aStatic, 0.46, 0.04, 0.62, heavyIronMat, 2.58, yFloor + 0.93, 7.75, false);
  // Overhead brass pot rack & cedar upper cabinets
  addABox(aStatic, 0.42, 0.58, 2.38, walnutMat, 2.74, yFloor + 2.12, 7.20, false);
  addACol(2.22, 5.92, 2.96, 8.48);

  // Port Tall Knotty-Cedar Pantry & Expedition Cold Chest (X=0.14..0.72, Z=6.05..8.25)
  addABox(aStatic, 0.54, 2.25, 1.10, cedarMat, 0.40, yFloor + 1.12, 6.62, true);
  addABox(aStatic, 0.54, 1.65, 0.92, darkArmorTrimMat, 0.40, yFloor + 0.82, 7.75, true); // Heavy gunmetal expedition fridge
  addACol(0.14, 6.02, 0.72, 8.26);

  // ZONE A04: Hinoki Steam-Soak Wet Bath Pod (Starboard X=1.48..2.98, Z=8.60..10.60)
  addABox(aStatic, 1.46, 0.05, 1.88, makeSurfaceMat('wood_deck', 1.46, 1.88), 2.22, yFloor + 0.025, 9.60, false);
  // Deep compact hinoki soaking tub along South side of pod (Z=9.75..10.50)
  addABox(aStatic, 1.38, 0.62, 0.74, hinokiMat, 2.24, yFloor + 0.31, 10.14, true);
  addABox(aStatic, 1.24, 0.04, 0.60, bathWaterMat, 2.24, yFloor + 0.56, 10.14, false);
  // Brass vanity & marine toilet along North side (Z=8.72..9.24)
  addABox(aStatic, 0.48, 0.82, 0.54, hinokiMat, 2.70, yFloor + 0.41, 8.98, false);
  addABox(aStatic, 0.30, 0.06, 0.34, copperMat, 2.68, yFloor + 0.85, 8.98, false);
  addABox(aStatic, 0.42, 0.42, 0.44, mat.ceramic, 1.90, yFloor + 0.21, 8.92, false);
  addACol(1.52, 9.74, 2.96, 10.54);
  addACol(2.44, 8.66, 2.96, 9.30);

  // ZONE A05: Vaulted Secret Bunk Cave & Chart Study (z = 10.60..13.50)
  // Starboard Recessed Arched Cedar King Bunk Cave (X=1.50..2.96, Z=10.85..13.28)
  addABox(aStatic, 1.44, 0.54, 2.24, cedarMat, 2.24, yFloor + 0.27, 12.06, true); // Platform base w/ under-bed drawers
  addABox(aStatic, 1.36, 0.24, 2.14, makeSurfaceMat('fabric_floral_quilt', 1.36, 2.14, { color: 0xd8c8b0 }), 2.24, yFloor + 0.66, 12.06, true);
  addABox(aStatic, 0.54, 0.14, 0.38, leatherMat, 1.98, yFloor + 0.84, 11.24, false);
  addABox(aStatic, 0.54, 0.14, 0.38, leatherMat, 2.54, yFloor + 0.84, 11.24, false);
  // Cozy cedar bunk-cave overhead canopy valance + brass reading sconce
  addABox(aStatic, 1.48, 0.32, 2.34, walnutMat, 2.24, yFloor + 2.24, 12.06, false);
  addABox(aStatic, 0.08, 0.14, 0.14, warmCoveMat, 2.90, yFloor + 1.36, 11.45, false);
  addACol(1.48, 10.90, 2.96, 13.22);

  // Port Fold-Down Walnut Study Desk & Reading Stool beneath tiny rear slit window (X=0.14..0.72, Z=11.15..12.60)
  addABox(aStatic, 0.54, 0.05, 1.32, walnutMat, 0.40, yFloor + 0.76, 11.88, false);
  addACol(0.14, 11.18, 0.68, 12.56);

  // ZONE A06: Rear Steel Blast Airlock & Container Hitch Control Panel (z = 13.50..15.38)
  addABox(aStatic, 0.62, 2.10, 1.38, darkArmorTrimMat, 2.64, yFloor + 1.05, 14.44, true); // Storm gear steel locker
  addACol(2.30, 13.72, 2.96, 15.16);

  // Physical 3D Hitch / Unhitch Control Button (Mounted cleanly inside Rear Airlock AND Cockpit!)
  const hitchBtnMatOff = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: new THREE.Color(0x64748b), emissiveIntensity: 0.7 });
  const hitchBtnMatOn = new THREE.MeshStandardMaterial({ color: 0x064e3b, emissive: new THREE.Color(0x10b981), emissiveIntensity: 1.6 });

  const hitchBtnRear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.18), hitchBtnMatOff);
  hitchBtnRear.position.set(rx(2.26), yFloor + 1.35, rz(14.10));
  hitchBtnRear.userData.propId = 'armor_hitch';
  aDynamic.add(hitchBtnRear);

  const hitchBtnCab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.16), hitchBtnMatOff);
  hitchBtnCab.position.set(rx(0.18), yFloor + 1.24, rz(1.48));
  hitchBtnCab.userData.propId = 'armor_hitch_cab';
  aDynamic.add(hitchBtnCab);

  const setHitchVisual = (hitched) => {
    const m = hitched ? hitchBtnMatOn : hitchBtnMatOff;
    hitchBtnRear.material = m;
    hitchBtnCab.material = m;
  };

  interactiveProps.push(
    {
      id: 'armor_hitch',
      floor: 1,
      isArmor: true,
      mesh: hitchBtnRear,
      isOn: false,
      getLabel() { return this.isOn ? 'コンテナ切離' : 'コンテナ連結'; },
    },
    {
      id: 'armor_hitch_cab',
      floor: 1,
      isArmor: true,
      mesh: hitchBtnCab,
      isOn: false,
      getLabel() { return this.isOn ? 'コンテナ切離' : 'コンテナ連結'; },
    },
  );

  // Warm Secret-Base Interior Point Lights (toggled efficiently by adaptive light manager!)
  [
    { name: 'Armor_Lounge_Fire', color: 0xffa855, int: 2.2, dist: 9.0, x: 1.55, y: yFloor + 2.15, z: 4.30 },
    { name: 'Armor_Galley_Warm', color: 0xffc680, int: 1.9, dist: 8.5, x: 1.55, y: yFloor + 2.25, z: 7.40 },
    { name: 'Armor_Bunk_Warm',   color: 0xffb366, int: 1.8, dist: 8.5, x: 1.55, y: yFloor + 2.15, z: 12.10 },
  ].forEach((ld) => {
    const pt = new THREE.PointLight(ld.color, 0, ld.dist, 1.6);
    pt.position.set(rx(ld.x), ld.y, rz(ld.z));
    pt.visible = false;
    armorRoot.add(pt);
    interiorLights.push({ name: ld.name, floor: 1, zone: 'armor', light: pt, baseInt: ld.int });
  });

  const { batchedGroup: armorBatched, stats: armorStats } = batchStaticGroups([aStatic]);
  armorRoot.add(armorBatched);

  // =========================================================================
  // PART 2: CON-24 TOWABLE CARGO CONTAINER TRAILER (W 2.00m × L 4.00m × H 3.00m)
  // =========================================================================
  const TW = TOW_CONTAINER.width;       // 2.00
  const TL = TOW_CONTAINER.length;      // 4.00
  const tyFloor = TOW_CONTAINER.floorWorldY;     // +0.42
  const tyGround = TOW_CONTAINER.groundY;        // -0.32
  const tClearH = TOW_CONTAINER.interiorClearH;  // 2.18 -> Roof top at 2.68 (Total H = 3.000m!)
  const tyRoof = TOW_CONTAINER.roofTopWorldY;    // +2.68

  const trailerRoot = new THREE.Group();
  trailerRoot.name = 'TowableContainer_CON24';
  trailerRoot.position.set(TOW_CONTAINER.initialPose.cx, 0, TOW_CONTAINER.initialPose.cz);
  trailerRoot.rotation.y = TOW_CONTAINER.initialPose.yaw;
  scene.add(trailerRoot);

  const tStatic = new THREE.Group();
  const tDynamic = new THREE.Group();
  trailerRoot.add(tDynamic);

  const trx = (lx) => lx - TW * 0.5;
  const trz = (lz) => lz - TL * 0.5;
  const trailerColliders = [];
  const addTCol = (minX, minZ, maxX, maxZ) => trailerColliders.push({ minX, minZ, maxX, maxZ });

  function addTBox(parent, w, h, d, material, lx, y, lz, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(trx(lx), y, trz(lz));
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  const contWallMat = makeSurfaceMat('container_corrugated', 4.0, 2.26);
  const contEndMat = makeSurfaceMat('container_corrugated', 2.0, 2.26);
  const contRoofMat = makeSurfaceMat('container_corrugated', 2.0, 4.0, { color: 0x455048 });
  const contFloorMat = makeSurfaceMat('wood_deck', 1.84, 3.84);
  const crateMat = makeSurfaceMat('crate_wood', 0.6, 0.5);
  const jerryRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45, metalness: 0.35 });

  // Steel trailer chassis frame + A-frame heavy drawbar tongue extending forward (-Z)
  addTBox(tStatic, TW - 0.10, 0.16, TL - 0.10, heavyIronMat, TW / 2, tyFloor - 0.10, TL / 2, true);
  // A-frame steel drawbar arms converging to front hitch coupler ring (at lz = -drawbarLength)
  [-0.36, 0.36].forEach((sideOff) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, TOW_CONTAINER.drawbarLength + 0.15), heavyIronMat);
    arm.position.set(sideOff * 0.48, tyFloor - 0.12, trz(-TOW_CONTAINER.drawbarLength * 0.48));
    arm.rotation.y = sideOff < 0 ? -0.26 : 0.26;
    tStatic.add(arm);
  });
  // Front coupler lunette ring
  const couplerRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16), mat.chrome);
  couplerRing.rotation.x = Math.PI / 2;
  couplerRing.position.set(0, tyFloor - 0.08, trz(-TOW_CONTAINER.drawbarLength));
  tStatic.add(couplerRing);

  // Retractable front support jockey leg (retracts upward cleanly when hitched!)
  const jockeyLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.66, 8), darkArmorTrimMat);
  jockeyLeg.position.set(0, tyGround + 0.33, trz(-0.72));
  tDynamic.add(jockeyLeg);

  // Tandem Off-Road Trailer Axles & 4 Wheels
  const trailerWheelMeshes = [];
  const twR = TOW_CONTAINER.wheelRadius;
  const twW = TOW_CONTAINER.wheelWidth;
  TOW_CONTAINER.axlesZ.forEach((az) => {
    addTBox(tStatic, TW - 0.24, 0.12, 0.12, heavyIronMat, TW / 2, tyGround + twR, az, false);
    [0.14, TW - 0.14].forEach((wx) => {
      const wGrp = new THREE.Group();
      wGrp.position.set(trx(wx), tyGround + twR, trz(az));
      tDynamic.add(wGrp);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(twR, twR, twW, 18), tireMat);
      t.rotation.z = Math.PI / 2;
      t.castShadow = true;
      wGrp.add(t);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(twR * 0.52, twR * 0.52, twW + 0.02, 10), rimMat);
      h.rotation.z = Math.PI / 2;
      wGrp.add(h);
      trailerWheelMeshes.push(wGrp);
    });
  });

  // ISO Corrugated Container Box (walls stop cleanly below roof slab — zero roof-edge Z-fighting!)
  const boxH = tyRoof - tyFloor; // 2.26m
  const cWallH = boxH - 0.084;
  addTBox(tStatic, TW - 0.16, 0.06, TL - 0.16, contFloorMat, TW / 2, tyFloor - 0.03, TL / 2, false);
  addTBox(tStatic, TW, 0.08, TL, contRoofMat, TW / 2, tyRoof - 0.04, TL / 2, true);
  // Front wall (lz = 0.04)
  addTBox(tStatic, TW, cWallH, 0.08, contEndMat, TW / 2, tyFloor + cWallH / 2, 0.04, true);
  addTCol(0, 0, TW, 0.09);
  // West & East corrugated walls
  addTBox(tStatic, 0.08, cWallH, TL - 0.162, contWallMat, 0.04, tyFloor + cWallH / 2, TL / 2, true);
  addTBox(tStatic, 0.08, cWallH, TL - 0.162, contWallMat, TW - 0.04, tyFloor + cWallH / 2, TL / 2, true);
  addTCol(0, 0, 0.09, TL);
  addTCol(TW - 0.09, 0, TW, TL);
  // Rear corner piers flanking wide cargo door (lx = 0.35..1.65)
  addTBox(tStatic, 0.35, cWallH, 0.08, contEndMat, 0.175, tyFloor + cWallH / 2, TL - 0.04, true);
  addTBox(tStatic, 0.35, cWallH, 0.08, contEndMat, TW - 0.175, tyFloor + cWallH / 2, TL - 0.04, true);
  addTBox(tStatic, 1.30, Math.max(0.04, cWallH - 2.04), 0.08, contEndMat, TW / 2, tyFloor + 2.04 + Math.max(0.04, cWallH - 2.04) / 2, TL - 0.04, false);
  addTCol(0, TL - 0.09, 0.35, TL);
  addTCol(TW - 0.35, TL - 0.09, TW, TL);
  // Rear safety taillights on container
  [0.20, TW - 0.20].forEach((tx) => {
    addTBox(tStatic, 0.18, 0.08, 0.06, taillightMat, tx, tyFloor - 0.08, TL + 0.02, false);
  });

  // Rear Heavy Cargo Swing Door (DCT-1, Auto-Open/Close!)
  const contDoorPivot = new THREE.Group();
  contDoorPivot.position.set(trx(0.37), tyFloor, trz(TL - 0.04));
  tDynamic.add(contDoorPivot);
  const contDoorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.00, 0.06), contEndMat);
  contDoorLeaf.position.set(0.63, 1.00, 0);
  contDoorLeaf.userData.doorId = 'DCT-1';
  contDoorPivot.add(contDoorLeaf);
  // Steel locking cam bars on container door
  [0.32, 0.94].forEach((bx) => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.88, 8), mat.chrome);
    bar.position.set(bx, 1.00, 0.045);
    contDoorPivot.add(bar);
  });
  interactiveDoors.push({
    id: 'DCT-1',
    floor: 1,
    isContainer: true,
    kind: 'swing',
    label: 'コンテナ後部鉄扉',
    pivot: contDoorPivot,
    mesh: contDoorLeaf,
    openAngle: Math.PI * 0.62,
    isOpen: false,
    progress: 0,
    collider: { minX: 0.35, maxX: 1.65, minZ: TL - 0.10, maxZ: TL + 0.04 },
    localCenter: { lx: 1.00, lz: TL - 0.04 },
    center: new THREE.Vector3(),
  });

  // Walk-In Cargo Container Shelving, Crates, Jerrycans & Backup Generator along West/East Walls (leaving 0.92m central aisle!)
  [0.30, TW - 0.30].forEach((sx) => {
    [0.62, 1.32].forEach((sh) => {
      addTBox(tStatic, 0.42, 0.04, 2.95, darkArmorTrimMat, sx, tyFloor + sh, 1.75, false);
    });
    [0.32, 1.75, 3.18].forEach((sz) => {
      addTBox(tStatic, 0.05, 1.82, 0.05, darkArmorTrimMat, sx, tyFloor + 0.91, sz, false);
    });
  });
  // Expedition wooden crates & fuel jerrycans on shelves
  addTBox(tStatic, 0.36, 0.42, 0.56, crateMat, 0.30, tyFloor + 0.24, 1.00, false);
  addTBox(tStatic, 0.36, 0.42, 0.56, crateMat, 0.30, tyFloor + 0.85, 1.80, false);
  addTBox(tStatic, 0.36, 0.42, 0.56, crateMat, TW - 0.30, tyFloor + 0.85, 1.10, false);
  [2.35, 2.68, 3.00].forEach((jz) => {
    addTBox(tStatic, 0.22, 0.42, 0.28, jerryRedMat, TW - 0.30, tyFloor + 0.22, jz, false);
  });
  addTCol(0.08, 0.25, 0.52, 3.25);
  addTCol(TW - 0.52, 0.25, TW - 0.08, 3.25);

  // Interior LED strip on container ceiling
  addTBox(tStatic, 0.16, 0.04, 1.40, warmCoveMat, TW / 2, tyFloor + tClearH - 0.02, TL / 2, false);

  const { batchedGroup: trailerBatched, stats: trailerStats } = batchStaticGroups([tStatic]);
  trailerRoot.add(trailerBatched);

  return {
    armorCamper: {
      root: armorRoot,
      pose: {
        cx: ARMOR_CAMPER.initialPose.cx,
        cz: ARMOR_CAMPER.initialPose.cz,
        yaw: ARMOR_CAMPER.initialPose.yaw,
        y: 0,
      },
      speed: 0,
      velX: 0,
      velZ: 0,
      steerAngle: 0,
      suspLift: 0,
      suspVelY: 0,
      headlightsOn: false,
      headlights,
      wheelMeshes,
      frontSteerPivots,
      steerWheelGroup,
      driveProp,
      localColliders,
      shutters: armorState,
      hitchBtnRear,
      hitchBtnCab,
      setHitchVisual,
      batchStats: armorStats,
    },
    towContainer: {
      root: trailerRoot,
      pose: {
        cx: TOW_CONTAINER.initialPose.cx,
        cz: TOW_CONTAINER.initialPose.cz,
        yaw: TOW_CONTAINER.initialPose.yaw,
        y: 0,
      },
      hitched: false,
      jockeyLeg,
      wheelMeshes: trailerWheelMeshes,
      localColliders: trailerColliders,
      batchStats: trailerStats,
    },
  };
}
