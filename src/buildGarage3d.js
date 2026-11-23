import * as THREE from 'three';
import { GARAGE, GARAGE_PLAN } from './warehouseAndArmorData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds GARAGE-200 — Giant 10.0m × 20.0m × 4.5m Industrial Steel Vehicle Warehouse
 * Positioned at World X = 12.00..22.00, Z = -6.00..+14.00, Slab Y = -0.32 -> Roof Y = +4.18 (H=4.50m EXACT!).
 * Includes H-beam steel portal frames, roof trusses, corrugated galvanized cladding, epoxy slab with
 * painted bay stripes & floor drain grates, motorized North/South 5.8m roll-up shutters (auto-open for
 * vehicles & player!), mechanic workbench, red tool chest, air compressor, tire rack, & overhead crane rail.
 */
export function buildGarage3D(ctx) {
  const {
    scene,
    exteriorGroup,
    mat,
    addCollider,
    interactiveDoors,
    interiorLights,
  } = ctx;

  const ox = GARAGE.originX; // 12.00
  const oz = GARAGE.originZ; // -6.00
  const W = GARAGE.width;    // 10.00
  const D = GARAGE.depth;    // 20.00
  const H = GARAGE.height;   // 4.50
  const y0 = GARAGE.floorY;  // -0.32
  const yTop = GARAGE.roofTopY; // +4.18

  const garageRoot = new THREE.Group();
  garageRoot.name = 'GiantVehicleWarehouse_GARAGE200';
  scene.add(garageRoot);

  const gStatic = new THREE.Group();
  const gDynamic = new THREE.Group();
  garageRoot.add(gDynamic);

  const steelBeamMat = new THREE.MeshStandardMaterial({ color: 0x2a323b, roughness: 0.44, metalness: 0.74 });
  const roofDeckMat = makeSurfaceMat('warehouse_corrugated_steel', 10.0, 20.0, { color: 0x626c76, roughness: 0.52, metalness: 0.65 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.46, metalness: 0.18 });
  const craneYellowMat = new THREE.MeshStandardMaterial({ color: 0xd99b06, roughness: 0.42, metalness: 0.42 });
  const redChestMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.34, metalness: 0.45 });
  const blueCompMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.38, metalness: 0.52 });
  const drumGreenMat = new THREE.MeshStandardMaterial({ color: 0x2f5a44, roughness: 0.48, metalness: 0.42 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x191c20, roughness: 0.90, metalness: 0.05 });
  const skylightMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    emissive: new THREE.Color(0xbcd6ee),
    emissiveIntensity: 0.25,
    roughness: 0.28,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
  });
  const highBayLedMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    emissive: new THREE.Color(0xeef6ff),
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  function addGBox(parent, w, h, d, material, lx, y, lz, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(ox + lx, y, oz + lz);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // 1. Reinforced Concrete Slab + North/South Drive-In Aprons + West Walkway to Main House
  addGBox(gStatic, W + 0.4, 0.12, D + 0.4, makeSurfaceMat('warehouse_epoxy_floor', W, D), W / 2, y0 - 0.06, D / 2, false);
  // North approach concrete apron connecting toward forestry road (stopped cleanly at slab North edge lz=-0.20)
  addGBox(exteriorGroup, 8.6, 0.07, 8.4, makeSurfaceMat('concrete_clean', 8.6, 8.4, { color: 0x7a8086 }), 4.4, y0 - 0.05, -4.41, false);
  // South exit concrete apron (started cleanly at slab South edge lz=D+0.20)
  addGBox(exteriorGroup, 7.6, 0.07, 4.8, makeSurfaceMat('concrete_clean', 7.6, 4.8, { color: 0x7a8086 }), 3.9, y0 - 0.05, D + 2.61, false);
  // West walkway linking personnel door DG-W toward Main House & Concrete Storage
  addGBox(exteriorGroup, 2.9, 0.06, 2.0, makeSurfaceMat('paver_granite_grid', 2.9, 2.0), -1.66, y0 - 0.04, 8.0, false);

  // Yellow industrial floor safety stripes separating Bay 1 (ARMOR-155) & Bay 2 (CON-24 + Workshop)
  addGBox(gStatic, 0.12, 0.008, D - 1.2, safetyYellowMat, 5.80, y0 + 0.006, D / 2, false);
  addGBox(gStatic, 0.10, 0.008, D - 1.2, safetyYellowMat, 0.72, y0 + 0.006, D / 2, false);
  addGBox(gStatic, 0.10, 0.008, 12.6, safetyYellowMat, 9.25, y0 + 0.006, 12.8, false);
  // Central drainage grate strip down Bay 1
  addGBox(gStatic, 0.28, 0.01, D - 2.4, makeSurfaceMat('metal_grate', 0.28, D - 2.4), 3.60, y0 + 0.007, D / 2, false);
  // Heavy rubber/yellow wheel stop chocks in Bay 2
  addGBox(gStatic, 1.85, 0.12, 0.18, safetyYellowMat, 7.85, y0 + 0.065, 9.85, false);

  // 2. Structural H-Beam Steel Portal Frames (5 bays @ 5m centers, inset strictly inside corrugated exterior walls)
  const frameZs = [0.36, 5.0, 10.0, 15.0, 19.64];
  frameZs.forEach((fz) => {
    // Left & Right H-beam steel columns (lx=0.35 and W-0.35 clear of 0.24m wall thickness!)
    addGBox(gStatic, 0.20, H - 0.28, 0.20, steelBeamMat, 0.35, y0 + (H - 0.28) / 2, fz, true);
    addGBox(gStatic, 0.20, H - 0.28, 0.20, steelBeamMat, W - 0.35, y0 + (H - 0.28) / 2, fz, true);
    // Horizontal steel roof girder spanning between interior columns
    addGBox(gStatic, W - 0.50, 0.22, 0.18, steelBeamMat, W / 2, yTop - 0.16, fz, true);
    // Corner haunch knee braces for authentic warehouse industrial look
    [0.72, W - 0.72].forEach((bx) => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.09, 0.09), steelBeamMat);
      brace.position.set(ox + bx, yTop - 0.56, oz + fz);
      brace.rotation.z = bx < W / 2 ? 0.72 : -0.72;
      gStatic.add(brace);
    });
  });

  // Longitudinal steel purlins + roof corrugated deck
  [1.6, 3.8, 6.2, 8.4].forEach((px) => {
    addGBox(gStatic, 0.10, 0.10, D - 0.52, steelBeamMat, px, yTop - 0.10, D / 2, false);
  });
  addGBox(gStatic, W + 0.30, 0.10, D + 0.30, roofDeckMat, W / 2, yTop, D / 2, true);

  // Overhead Yellow Industrial 3-Ton Monorail Bridge Crane Beam spanning at Z=11.0m
  addGBox(gStatic, W - 0.55, 0.24, 0.18, craneYellowMat, W / 2, yTop - 0.42, 11.0, false);
  addGBox(gStatic, 0.46, 0.32, 0.38, steelBeamMat, 3.60, yTop - 0.66, 11.0, false);

  // 3. Corrugated Galvanized Steel Exterior Walls with Clerestory Daylight Strips & Gate Openings
  const wallH = H - 0.08;
  const addCorrugatedSegment = (w, h, d, lx, cy, lz) => {
    const u = Math.max(w, d);
    const wMat = makeSurfaceMat('warehouse_corrugated_steel', u, h);
    addGBox(gStatic, w, h, d, wMat, lx, cy, lz, true);
  };

  // --- North & South End Walls (with giant 5.80m × 4.22m Roll-Up Gate Openings at lx = 0.85..6.65!) ---
  const gateX1 = 0.85;
  const gateX2 = 6.65;
  const gateW = gateX2 - gateX1; // 5.80m
  const gateH = 4.22;
  [0.12, D - 0.12].forEach((ez, endIdx) => {
    // Left pier (0..0.85)
    addCorrugatedSegment(gateX1, wallH, 0.24, gateX1 / 2, y0 + wallH / 2, ez);
    // Right solid wall (6.65..10.0)
    addCorrugatedSegment(W - gateX2, wallH, 0.24, (gateX2 + W) / 2, y0 + wallH / 2, ez);
    // Header lintel above gate (y0+4.22 .. y0+4.42)
    addCorrugatedSegment(gateW, wallH - gateH, 0.24, (gateX1 + gateX2) / 2, y0 + gateH + (wallH - gateH) / 2, ez);
    // Steel gate guide jambs & yellow hazard bumper bollards
    [gateX1, gateX2].forEach((gx) => {
      const jambOff = gx === gateX1 ? 0.04 : -0.04;
      addGBox(gStatic, 0.08, gateH, 0.28, steelBeamMat, gx + jambOff, y0 + gateH / 2, ez, false);
      const bollardZ = endIdx === 0 ? -0.35 : D + 0.35;
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.92, 10), safetyYellowMat);
      bollard.position.set(ox + gx + (gx < 3 ? -0.18 : 0.18), y0 + 0.46, oz + bollardZ);
      gStatic.add(bollard);
    });
    // Cylindrical galvanized shutter housing drum box right above doorway
    addGBox(gStatic, gateW + 0.24, 0.34, 0.32, steelBeamMat, (gateX1 + gateX2) / 2, y0 + gateH + 0.08, ez + (endIdx === 0 ? 0.30 : -0.30), false);

    // Motorized Rolling Steel Overhead Shutter Leaf (auto-opens upward for protagonist & vehicles!)
    const doorId = endIdx === 0 ? 'DG-N' : 'DG-S';
    const shutterPivot = new THREE.Group();
    shutterPivot.position.set(ox + (gateX1 + gateX2) / 2, y0 + gateH / 2, oz + ez);
    gDynamic.add(shutterPivot);

    const shutterMat = makeSurfaceMat('iron_shutter_slat', gateW, gateH);
    const shutterMesh = new THREE.Mesh(new THREE.BoxGeometry(gateW - 0.06, gateH - 0.04, 0.07), shutterMat);
    shutterMesh.castShadow = true;
    shutterMesh.receiveShadow = true;
    shutterMesh.userData.doorId = doorId;
    shutterPivot.add(shutterMesh);
    // Yellow/black safety bottom edge bar on shutter
    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(gateW - 0.06, 0.14, 0.09), safetyYellowMat);
    bottomBar.position.set(0, -gateH / 2 + 0.09, 0);
    shutterPivot.add(bottomBar);

    interactiveDoors.push({
      id: doorId,
      floor: 1,
      isGarageGate: true,
      kind: 'rollup',
      label: endIdx === 0 ? '北大型車庫シャッター' : '南大型車庫シャッター',
      pivot: shutterPivot,
      mesh: shutterMesh,
      closedY: y0 + gateH / 2,
      openLiftY: gateH - 0.22,
      isOpen: false,
      progress: 0,
      collider: {
        minX: ox + gateX1,
        maxX: ox + gateX2,
        minZ: oz + ez - 0.18,
        maxZ: oz + ez + 0.18,
      },
      center: new THREE.Vector3(ox + (gateX1 + gateX2) / 2, y0 + 1.2, oz + ez),
    });
  });

  // --- West Wall (lx = 0.12, with Pedestrian Steel Door DG-W at lz = 7.50..8.50 + High Clerestory Windows) ---
  const pedZ1 = 7.50, pedZ2 = 8.50, pedH = 2.15;
  addCorrugatedSegment(0.24, 3.30, pedZ1 - 0.24, 0.12, y0 + 1.65, 0.24 + (pedZ1 - 0.24) / 2);
  addCorrugatedSegment(0.24, 3.30 - pedH, pedZ2 - pedZ1, 0.12, y0 + pedH + (3.30 - pedH) / 2, (pedZ1 + pedZ2) / 2);
  addCorrugatedSegment(0.24, 3.30, D - 0.24 - pedZ2, 0.12, y0 + 1.65, pedZ2 + (D - 0.24 - pedZ2) / 2);
  // Upper clerestory translucent polycarbonate daylight band along West wall (y0+3.30..y0+3.95)
  addGBox(gStatic, 0.06, 0.65, D - 0.60, skylightMat, 0.12, y0 + 3.62, D / 2, false);
  addCorrugatedSegment(0.24, wallH - 3.95, D - 0.48, 0.12, y0 + 3.95 + (wallH - 3.95) / 2, D / 2);

  // Interactive West Pedestrian Steel Door (DG-W)
  const pedPivot = new THREE.Group();
  pedPivot.position.set(ox + 0.12, y0, oz + pedZ1 + 0.02);
  gDynamic.add(pedPivot);
  const pedLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, pedH - 0.04, 0.96),
    makeSurfaceMat('exterior_siding_grey', 0.96, pedH, { roughness: 0.48, metalness: 0.55 })
  );
  pedLeaf.position.set(0, (pedH - 0.04) / 2, 0.48);
  pedLeaf.castShadow = true;
  pedLeaf.receiveShadow = true;
  pedLeaf.userData.doorId = 'DG-W';
  pedPivot.add(pedLeaf);
  const pedHandle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.12), mat.chrome);
  pedHandle.position.set(0, 0.96, 0.84);
  pedPivot.add(pedHandle);
  interactiveDoors.push({
    id: 'DG-W',
    floor: 1,
    kind: 'swing',
    label: '車庫スチール通用扉',
    pivot: pedPivot,
    mesh: pedLeaf,
    openAngle: Math.PI * 0.52,
    isOpen: false,
    progress: 0,
    collider: { minX: ox - 0.05, maxX: ox + 0.28, minZ: oz + pedZ1, maxZ: oz + pedZ2 },
    center: new THREE.Vector3(ox + 0.12, y0 + 1.0, oz + (pedZ1 + pedZ2) / 2),
  });

  // --- East Solid Wall (lx = 9.88) + Upper Clerestory Daylight Strip ---
  addCorrugatedSegment(0.24, 3.30, D - 0.48, W - 0.12, y0 + 1.65, D / 2);
  addGBox(gStatic, 0.06, 0.65, D - 0.60, skylightMat, W - 0.12, y0 + 3.62, D / 2, false);
  addCorrugatedSegment(0.24, wallH - 3.95, D - 0.48, W - 0.12, y0 + 3.95 + (wallH - 3.95) / 2, D / 2);

  // 4. Industrial High-Bay LED Lighting Fixtures + Practical Lights
  const lightCoords = [
    [3.4, 4.0], [3.4, 10.0], [3.4, 16.0],
    [7.8, 3.5], [7.8, 12.0],
  ];
  lightCoords.forEach(([lx, lz], idx) => {
    addGBox(gStatic, 0.55, 0.08, 0.55, steelBeamMat, lx, yTop - 0.26, lz, false);
    addGBox(gStatic, 0.46, 0.03, 0.46, highBayLedMat, lx, yTop - 0.31, lz, false);
    if (idx === 1 || idx === 3) {
      const pt = new THREE.PointLight(0xeef5ff, 2.2, 16.0, 1.55);
      pt.position.set(ox + lx, yTop - 0.50, oz + lz);
      garageRoot.add(pt);
      interiorLights.push({ name: `Garage_HB_${idx}`, floor: 1, zone: 'garage', light: pt, baseInt: 2.2 });
    }
  });

  // 5. Authentic Warehouse Mechanic Workshop Props (NE Corner: lx = 6.2..9.65, lz = 0.4..5.6)
  // Heavy Steel Mechanic Workbench + Butcher-Block Top + Vise
  addGBox(gStatic, 0.85, 0.06, 3.20, mat.oak, 9.28, y0 + 0.90, 2.40, true);
  [0.95, 2.40, 3.85].forEach((bz) => {
    addGBox(gStatic, 0.78, 0.88, 0.08, steelBeamMat, 9.28, y0 + 0.44, bz, false);
  });
  addGBox(gStatic, 0.80, 0.04, 3.12, steelBeamMat, 9.28, y0 + 0.26, 2.40, false);
  addGBox(gStatic, 0.22, 0.18, 0.26, blueCompMat, 8.98, y0 + 1.02, 1.45, false); // Bench vise
  // Wall Pegboard Tool Rack above Workbench
  addGBox(gStatic, 0.04, 1.15, 2.95, makeSurfaceMat('pegboard_wood', 2.95, 1.15), 9.72, y0 + 1.72, 2.40, false);

  // Red Rolling Mechanic Tool Chest
  addGBox(gStatic, 0.62, 1.05, 1.12, redChestMat, 9.32, y0 + 0.56, 4.75, true);
  for (let dr = 0; dr < 5; dr++) {
    addGBox(gStatic, 0.03, 0.025, 0.92, mat.chrome, 9.00, y0 + 0.26 + dr * 0.17, 4.75, false);
  }

  // Vertical Blue Industrial Air Compressor Tank
  const compTank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.38, 14), blueCompMat);
  compTank.position.set(ox + 9.30, y0 + 0.74, oz + 5.75);
  compTank.castShadow = true;
  gStatic.add(compTank);

  // 4-Tier Heavy Industrial Pallet / Parts Racking along North-East wall (lx = 6.9..9.6, lz = 0.55)
  addGBox(gStatic, 2.45, 0.05, 0.72, steelBeamMat, 8.05, y0 + 0.50, 0.62, false);
  addGBox(gStatic, 2.45, 0.05, 0.72, steelBeamMat, 8.05, y0 + 1.25, 0.62, false);
  addGBox(gStatic, 2.45, 0.05, 0.72, steelBeamMat, 8.05, y0 + 2.05, 0.62, false);
  [6.85, 8.05, 9.25].forEach((rx) => {
    addGBox(gStatic, 0.07, 2.45, 0.72, steelBeamMat, rx, y0 + 1.22, 0.62, false);
  });
  // Crates & spare parts boxes on racks
  addGBox(gStatic, 0.58, 0.42, 0.52, makeSurfaceMat('crate_wood', 0.58, 0.42), 7.42, y0 + 0.74, 0.62, false);
  addGBox(gStatic, 0.58, 0.42, 0.52, makeSurfaceMat('crate_wood', 0.58, 0.42), 8.62, y0 + 0.74, 0.62, false);
  addGBox(gStatic, 0.62, 0.46, 0.50, redChestMat, 7.45, y0 + 1.50, 0.62, false);
  addGBox(gStatic, 0.54, 0.38, 0.48, safetyYellowMat, 8.55, y0 + 1.46, 0.62, false);

  // Industrial Steel Oil Drums & Spare Giant Off-Road Tires along SE wall
  [16.6, 17.35, 18.1].forEach((dz, i) => {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14), i === 1 ? redChestMat : drumGreenMat);
    drum.position.set(ox + 9.34, y0 + 0.44, oz + dz);
    drum.castShadow = true;
    gStatic.add(drum);
  });
  // Spare off-road tires racked neatly at SE wall (lz = 13.5..15.6)
  for (let ti = 0; ti < 4; ti++) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.30, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(ox + 9.35, y0 + 0.52, oz + 13.6 + ti * 0.48);
    gStatic.add(tire);
  }

  // 6. Strict Player & Vehicle Perimeter Wall Colliders (ZERO Invisible Obstructions inside Bays!)
  const vehicleWallObstacles = [
    // North wall piers flanking DG-N (lx = 0..0.85 and lx = 6.65..10.0)
    { minX: ox, maxX: ox + gateX1, minZ: oz, maxZ: oz + 0.28 },
    { minX: ox + gateX2, maxX: ox + W, minZ: oz, maxZ: oz + 0.28 },
    // South wall piers flanking DG-S
    { minX: ox, maxX: ox + gateX1, minZ: oz + D - 0.28, maxZ: oz + D },
    { minX: ox + gateX2, maxX: ox + W, minZ: oz + D - 0.28, maxZ: oz + D },
    // West wall segments flanking DG-W
    { minX: ox, maxX: ox + 0.28, minZ: oz, maxZ: oz + pedZ1 },
    { minX: ox, maxX: ox + 0.28, minZ: oz + pedZ2, maxZ: oz + D },
    // East solid wall
    { minX: ox + W - 0.28, maxX: ox + W, minZ: oz, maxZ: oz + D },
    // NE workshop bench + shelves + compressor + SE drums/tires
    { minX: ox + 6.75, maxX: ox + W - 0.24, minZ: oz + 0.24, maxZ: oz + 1.05 },
    { minX: ox + 8.78, maxX: ox + W - 0.24, minZ: oz + 0.80, maxZ: oz + 6.20 },
    { minX: ox + 8.90, maxX: ox + W - 0.24, minZ: oz + 13.0, maxZ: oz + 18.7 },
  ];
  vehicleWallObstacles.forEach((b) => addCollider(1, b.minX, b.minZ, b.maxX, b.maxZ));

  const { batchedGroup, stats: batchStats } = batchStaticGroups([gStatic]);
  garageRoot.add(batchedGroup);

  return {
    root: garageRoot,
    vehicleWallObstacles,
    batchStats,
  };
}
