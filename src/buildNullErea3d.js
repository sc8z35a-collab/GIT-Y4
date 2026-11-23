import * as THREE from 'three';
import { NULL_EREA, NULL_ELEVATOR, NULL_SILO_MECHANISM } from './airshipData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the entire NULL EREA Underground Airship Complex (SILO-40):
 *  1. Surface Reinforced Launch Apron (96m × 76m flush on southRectY) + Warning Beacons + Control Pedestal + Camper Dock
 *  2. 40m High-Speed Deep-Shaft Linear-Traction Elevator (ELV-NULL / TECNICA EXPRESS-40, 0m <-> -40.0m @ 12.5 m/s)
 *  3. 4-Tier 44-Plate Articulated Mechanical Silo Roof System (16 Louver + 12 Iris Fold + 10 Acoustic Slat + 6 Blast Jaw)
 *  4. Giant 40m Hydraulic Scissor-Truss & Rack-and-Pinion Mega-Lift Platform (19.2m × 40.6m)
 *  5. B40F (-40.0m) Subterranean Hangar Cavern (47m × 54m) + tecnica forces Command Room + 100L Fueling Bay
 */
export function buildNullErea3D(ctx) {
  const {
    scene,
    interactiveProps,
    interiorLights,
    groundY,
  } = ctx;

  const OX = NULL_EREA.originX; // 0.0
  const OZ = NULL_EREA.originZ; // 29910.0
  const GY = groundY;           // Exact terrain height at NULL EREA (southRectY)
  const B40Y = GY - 40.0;       // EXACT -40.00m Underground Hangar Floor!

  const root = new THREE.Group();
  root.name = 'NULL_EREA_SILO40_COMPLEX';
  scene.add(root);

  const staticGrp = new THREE.Group();
  const dynamicGrp = new THREE.Group();
  root.add(dynamicGrp);

  // ---- Shared Aerospace & Industrial Materials ----
  const deckMat = makeSurfaceMat('silo_hazard_deck', 20, 20, { roughness: 0.62, metalness: 0.25 });
  const blastArmorMat = makeSurfaceMat('silo_blast_armor', 3.0, 2.0, { color: 0xc2ccd8, roughness: 0.40, metalness: 0.46 });
  const darkArmorMat = makeSurfaceMat('silo_blast_armor', 2.5, 2.5, { color: 0x64748b, roughness: 0.36, metalness: 0.48 });
  const concreteMat = makeSurfaceMat('concrete_pcon', 6.0, 6.0, { color: 0x7b8591, roughness: 0.82, metalness: 0.08 });
  const epoxyMat = makeSurfaceMat('warehouse_epoxy_floor', 8.0, 12.0, { color: 0x4c5664, roughness: 0.46, metalness: 0.14 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.52 });
  const brushedTiMat = new THREE.MeshStandardMaterial({ color: 0xb0bccb, roughness: 0.28, metalness: 0.72 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8e2ec, roughness: 0.14, metalness: 0.94 });
  const hazardYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.45, metalness: 0.28 });
  const craneYellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.42, metalness: 0.42 });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: new THREE.Color(0x0ea5e9),
    emissiveIntensity: 1.55,
    roughness: 0.25,
  });
  const emeraldGlowMat = new THREE.MeshStandardMaterial({
    color: 0x6ee7b7,
    emissive: new THREE.Color(0x10b981),
    emissiveIntensity: 1.45,
    roughness: 0.25,
  });
  const amberGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.75,
    roughness: 0.25,
  });
  const warmCeilGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xdbeafe),
    emissiveIntensity: 1.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xa5d8f3,
    roughness: 0.08,
    metalness: 0.16,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });

  function addBox(parent, w, h, d, material, x, y, z, shadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function makeSignMat(lines, bg = '#0b121c', border = '#38bdf8', textCol = '#e2e8f0', w = 512, h = 192) {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: 0x1e293b });
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = border;
    c.lineWidth = 6;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const step = (h - 32) / Math.max(1, lines.length);
    lines.forEach((ln, i) => {
      c.fillStyle = ln.color || textCol;
      c.font = ln.font || '800 32px sans-serif';
      c.fillText(ln.text, w * 0.5, 16 + step * (i + 0.5));
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.22,
    });
  }

  function makeButtonMat(label, accentHex = '#38bdf8', isLit = false) {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: isLit ? 0x38bdf8 : 0x1e293b });
    }
    const cv = document.createElement('canvas');
    cv.width = 160;
    cv.height = 160;
    const c = cv.getContext('2d');
    c.fillStyle = isLit ? '#0c2638' : '#121822';
    c.fillRect(0, 0, 160, 160);
    c.strokeStyle = isLit ? accentHex : '#64748b';
    c.lineWidth = isLit ? 12 : 7;
    c.beginPath();
    c.arc(80, 80, 64, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = isLit ? '#ffffff' : '#dbeafe';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const sz = label.length <= 2 ? 46 : (label.length <= 4 ? 32 : 24);
    c.font = `800 ${sz}px sans-serif`;
    c.fillText(label, 80, 82);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(isLit ? accentHex : '#7dd3fc'),
      emissiveIntensity: isLit ? 1.65 : 0.55,
      roughness: 0.28,
      metalness: 0.35,
    });
  }

  function addLight(name, x, y, z, color, intensity, distance, building = 'null_hangar', floor = -40) {
    const l = new THREE.PointLight(color, intensity, distance, 1.5);
    l.position.set(x, y, z);
    l.userData.building = building;
    root.add(l);
    interiorLights.push({ name, floor, zone: building, light: l, baseInt: intensity });
    return l;
  }

  // =========================================================================
  // 1. SURFACE LAUNCH APRON AT NULL EREA (96m × 76m, Flush at GY + 0.025)
  //    Clean non-overlapping panels around 20×42m Silo & 2.4×2.4m ELV Shaft!
  // =========================================================================
  const AP = NULL_EREA.apron;       // X: -48..48, Z: 29872..29948
  const SA = NULL_EREA.siloAperture; // X: -10..10, Z: 29889..29931
  const ES = NULL_ELEVATOR.shaft;    // X: -26.2..-23.8, Z: 29908.8..29911.2
  const slabT = 0.28;
  const slabCenterY = GY + 0.03 - slabT * 0.5;

  function addApronRect(x1, z1, x2, z2) {
    const w = x2 - x1;
    const d = z2 - z1;
    if (w <= 0.01 || d <= 0.01) return;
    const m = makeSurfaceMat('silo_hazard_deck', w * 0.25, d * 0.25, { roughness: 0.60, metalness: 0.24 });
    addBox(staticGrp, w, slabT, d, m, (x1 + x2) * 0.5, slabCenterY, (z1 + z2) * 0.5, false);
  }
  addApronRect(AP.minX, AP.minZ, AP.maxX, SA.minZ);         // North Apron
  addApronRect(AP.minX, SA.maxZ, AP.maxX, AP.maxZ);         // South Apron
  addApronRect(SA.maxX, SA.minZ, AP.maxX, SA.maxZ);         // East Apron (Camper Dock + Refuel!)
  addApronRect(AP.minX, SA.minZ, SA.minX, ES.minZ);         // West-North Apron
  addApronRect(AP.minX, ES.maxZ, SA.minX, SA.maxZ);         // West-South Apron
  addApronRect(ES.maxX, ES.minZ, SA.minX, ES.maxZ);         // Between ELV & Silo
  addApronRect(AP.minX, ES.minZ, ES.minX, ES.maxZ);         // West of ELV

  // Reinforced Perimeter Blast Collar around 20m × 42m Launch Silo Aperture
  const collarH = 0.22;
  const collarW = 0.90;
  addBox(staticGrp, SA.width + collarW * 2, collarH, collarW, darkSteelMat, OX, GY + collarH * 0.5, SA.minZ - collarW * 0.5, false);
  addBox(staticGrp, SA.width + collarW * 2, collarH, collarW, darkSteelMat, OX, GY + collarH * 0.5, SA.maxZ + collarW * 0.5, false);
  addBox(staticGrp, collarW, collarH, SA.length, darkSteelMat, SA.minX - collarW * 0.5, GY + collarH * 0.5, OZ, false);
  addBox(staticGrp, collarW, collarH, SA.length, darkSteelMat, SA.maxX + collarW * 0.5, GY + collarH * 0.5, OZ, false);

  // Hazard Yellow Edge Lines & Surface Deck Stencil Signs
  const stencilNorth = makeSignMat([
    { text: 'NULL EREA  //  TECNICA FORCES', font: '900 34px sans-serif', color: '#38bdf8' },
    { text: 'SILO-40 LAUNCH COMPLEX  •  AIRSHIP K-11', font: '700 22px monospace', color: '#fde68a' },
  ], '#19202a', '#eab308', '#f8fafc', 768, 160);
  const stencilNMesh = new THREE.Mesh(new THREE.PlaneGeometry(18.0, 3.6), stencilNorth);
  stencilNMesh.rotation.x = -Math.PI * 0.5;
  stencilNMesh.position.set(OX, GY + 0.048, SA.minZ - 5.2);
  staticGrp.add(stencilNMesh);

  const stencilDock = makeSignMat([
    { text: 'CAMPER AUTO-DOCK BAY', font: '900 32px sans-serif', color: '#34d399' },
    { text: 'RV / ARMOR-155 SUMMON LANDING ZONE', font: '700 20px monospace', color: '#cbd5e1' },
  ], '#17222b', '#10b981', '#e2e8f0', 640, 160);
  const dockMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 4.0), stencilDock);
  dockMesh.rotation.x = -Math.PI * 0.5;
  dockMesh.position.set(28.0, GY + 0.048, OZ);
  staticGrp.add(dockMesh);

  // Painted Camper Dock Bay Border Lines on East Apron (X: 19..37, Z: 29896..29924)
  addBox(staticGrp, 18.0, 0.02, 0.24, emeraldGlowMat, 28.0, GY + 0.042, 29896.0, false);
  addBox(staticGrp, 18.0, 0.02, 0.24, emeraldGlowMat, 28.0, GY + 0.042, 29924.0, false);
  addBox(staticGrp, 0.24, 0.02, 28.0, emeraldGlowMat, 19.0, GY + 0.042, OZ, false);
  addBox(staticGrp, 0.24, 0.02, 28.0, emeraldGlowMat, 37.0, GY + 0.042, OZ, false);

  // 12 Perimeter Warning Strobe Beacons around Silo Rim (Spinning Amber Beacons when Roof/Lift Moves!)
  const warningBeacons = [];
  const beaconCoords = [
    [-11.2, 29888.0], [0.0, 29887.6], [11.2, 29888.0],
    [-11.2, 29901.0], [11.2, 29901.0],
    [-11.2, 29919.0], [11.2, 29919.0],
    [-11.2, 29932.0], [0.0, 29932.4], [11.2, 29932.0],
    [-11.2, 29910.0], [11.2, 29910.0],
  ];
  beaconCoords.forEach(([bx, bz]) => {
    addBox(staticGrp, 0.36, 1.05, 0.36, darkSteelMat, bx, GY + 0.525, bz, false);
    addBox(staticGrp, 0.42, 0.14, 0.42, hazardYellowMat, bx, GY + 0.98, bz, false);
    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.28, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 0.45,
        roughness: 0.22,
      })
    );
    dome.position.set(bx, GY + 1.18, bz);
    dynamicGrp.add(dome);
    warningBeacons.push(dome);
  });

  // Weather Anemometer / Windsock Mast on NE Apron (X: +15.5, Z: 29884)
  addBox(staticGrp, 0.22, 9.5, 0.22, brushedTiMat, 15.5, GY + 4.75, 29884.0, false);
  const windsock = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 2.8, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.65, side: THREE.DoubleSide })
  );
  windsock.rotation.z = Math.PI * 0.5;
  windsock.position.set(16.9, GY + 9.2, 29884.0);
  dynamicGrp.add(windsock);

  // Surface Silo Launch & Refuel Control Pedestal (X: -14.2, Z: 29910.0)
  addBox(staticGrp, 0.72, 1.38, 1.24, darkSteelMat, -14.2, GY + 0.69, OZ, false);
  const surfPedSign = makeSignMat([
    { text: 'SILO-40 SURFACE CONTROL', font: '800 22px monospace', color: '#38bdf8' },
    { text: '44-PLATE ROOF & 40m LIFT', font: '700 18px sans-serif', color: '#e2e8f0' },
  ], '#0c1522', '#38bdf8', '#ffffff', 384, 128);
  addBox(staticGrp, 0.06, 0.42, 1.05, surfPedSign, -13.84, GY + 1.56, OZ, false);

  const launchBtnOffMat = makeButtonMat('発進昇降', '#38bdf8', false);
  const launchBtnLitMat = makeButtonMat('昇降作動', '#f59e0b', true);
  const surfLaunchBtn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.24), launchBtnOffMat);
  surfLaunchBtn.position.set(-13.82, GY + 1.12, OZ - 0.28);
  surfLaunchBtn.userData.propId = 'null_silo_toggle_surf';
  dynamicGrp.add(surfLaunchBtn);
  interactiveProps.push({
    id: 'null_silo_toggle_surf',
    floor: 1,
    isNullSiloBtn: true,
    mesh: surfLaunchBtn,
    getLabel() { return siloController.getTogglePrompt(); },
  });

  const refuelBtnMat = makeButtonMat('給油100L', '#10b981', true);
  const surfRefuelBtn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.24), refuelBtnMat);
  surfRefuelBtn.position.set(-13.82, GY + 1.12, OZ + 0.28);
  surfRefuelBtn.userData.propId = 'null_refuel_surf';
  dynamicGrp.add(surfRefuelBtn);
  interactiveProps.push({
    id: 'null_refuel_surf',
    floor: 1,
    isK11RefuelBtn: true,
    mesh: surfRefuelBtn,
    getLabel() { return 'K-11 給油 (100L)'; },
  });

  // =========================================================================
  // 2. 40m DEEP LAUNCH SILO SHAFT WALLS & DEPTH STENCILS (B40Y .. GY)
  // =========================================================================
  const shaftH = 40.0;
  const shaftMidY = B40Y + shaftH * 0.5;
  // North & South full 40m vertical shaft walls
  addBox(staticGrp, SA.width + 1.6, shaftH, 0.80, concreteMat, OX, shaftMidY, SA.minZ - 0.42, false);
  addBox(staticGrp, SA.width + 1.6, shaftH, 0.80, concreteMat, OX, shaftMidY, SA.maxZ + 0.42, false);
  // West & East upper shaft walls (from Y = GY - 25.5m up to GY — leaving bottom 14.5m open into B40F Hangar Cavern!)
  const upperWallH = 25.5;
  const upperWallMidY = GY - upperWallH * 0.5;
  addBox(staticGrp, 0.85, upperWallH, SA.length + 0.8, concreteMat, SA.minX - 0.44, upperWallMidY, OZ, false);
  addBox(staticGrp, 0.85, upperWallH, SA.length + 0.8, concreteMat, SA.maxX + 0.44, upperWallMidY, OZ, false);

  // Horizontal Steel Structural Ring Ribs every 4.0m down the 40m shaft
  for (let d = 8; d <= 24; d += 4) {
    const ry = GY - d;
    addBox(staticGrp, SA.width, 0.36, 0.32, darkSteelMat, OX, ry, SA.minZ + 0.08, false);
    addBox(staticGrp, SA.width, 0.36, 0.32, darkSteelMat, OX, ry, SA.maxZ - 0.08, false);
    addBox(staticGrp, 0.32, 0.36, SA.length, darkSteelMat, SA.minX + 0.08, ry, OZ, false);
    addBox(staticGrp, 0.32, 0.36, SA.length, darkSteelMat, SA.maxX - 0.08, ry, OZ, false);
  }

  // Illuminated Depth Markers every 5m (-5m .. -35m) on North & South Shaft Walls
  for (let d = 5; d <= 35; d += 5) {
    const dy = GY - d;
    const dMat = makeSignMat([
      { text: `-${d}m`, font: '900 72px monospace', color: d === 40 ? '#10b981' : '#38bdf8' },
    ], '#0c131d', '#334155', '#38bdf8', 256, 128);
    const pn = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), dMat);
    pn.position.set(OX, dy, SA.minZ + 0.06);
    staticGrp.add(pn);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), dMat);
    ps.rotation.y = Math.PI;
    ps.position.set(OX, dy, SA.maxZ - 0.06);
    staticGrp.add(ps);
  }

  // 4 Massive Vertical Rack-and-Pinion Lift Guide Towers at the 4 Silo Corners (Full 40.0m Tall!)
  const rackCorners = [
    [SA.minX + 0.36, SA.minZ + 0.45],
    [SA.maxX - 0.36, SA.minZ + 0.45],
    [SA.minX + 0.36, SA.maxZ - 0.45],
    [SA.maxX - 0.36, SA.maxZ - 0.45],
  ];
  rackCorners.forEach(([rx, rz]) => {
    addBox(staticGrp, 0.56, shaftH, 0.56, darkSteelMat, rx, shaftMidY, rz, false);
    addBox(staticGrp, 0.22, shaftH, 0.14, brushedTiMat, rx + (rx < 0 ? 0.26 : -0.26), shaftMidY, rz, false);
  });

  // =========================================================================
  // 3. 4-TIER 44-PLATE ARTICULATED MECHANICAL SILO ROOF SYSTEM
  //    Tier 1: 16 Blast Louver Plates  (relY = -0.16)
  //    Tier 2: 12 Hydraulic Iris Fold  (relY = -2.00)
  //    Tier 3: 10 Acoustic Bulkhead    (relY = -4.10)
  //    Tier 4:  6 Heavy Blast Jaws     (relY = -6.40)
  //    TOTAL = 44 INDIVIDUAL ARTICULATED MOVING ARMOR PLATES!
  // =========================================================================
  const roofPlates = {
    tier1: [], // 16 plates
    tier2: [], // 12 plates
    tier3: [], // 10 plates
    tier4: [], // 6 plates
  };

  // Helper to build a chamfered mecha armor leaf with raised rib detailing
  function buildMechaPlate(w, h, d, bodyMat, ribMat, accentMat, sideSign) {
    const g = new THREE.Group();
    addBox(g, w, h, d, bodyMat, 0, 0, 0, false);
    // 2 heavy structural armor reinforcement ribs on top/bottom
    addBox(g, w * 0.88, h + 0.07, d * 0.18, ribMat, 0, 0.01, -d * 0.28, false);
    addBox(g, w * 0.88, h + 0.07, d * 0.18, ribMat, 0, 0.01, d * 0.28, false);
    // Glowing inner lock seam strip facing silo centerline
    const seamX = -sideSign * (w * 0.5 - 0.08);
    const ledMesh = addBox(g, 0.14, h * 0.72, d * 0.86, accentMat, seamX, 0.01, 0, false);
    return { group: g, ledMesh };
  }

  // ---- TIER 1: 16 Surface Armored Blast Louvers (8 West + 8 East) ----
  const t1Count = 8;
  const t1SpanZ = SA.length / t1Count; // 5.25m each
  const t1Y = GY - 0.14;
  for (let i = 0; i < t1Count; i++) {
    const cz = SA.minZ + t1SpanZ * (i + 0.5);
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      const baseX = OX + side * 5.0; // West centered at -5.0, East at +5.0
      pivot.position.set(baseX, t1Y, cz);
      const { group: plate } = buildMechaPlate(9.92, 0.26, t1SpanZ - 0.14, blastArmorMat, darkSteelMat, hazardYellowMat, side);
      pivot.add(plate);
      dynamicGrp.add(pivot);
      roofPlates.tier1.push({ pivot, side, idx: i, baseX, baseY: t1Y });
    });
  }

  // ---- TIER 2: 12 Hydraulic Folding Iris-Blade Armor Plates (6 West + 6 East) ----
  const t2Count = 6;
  const t2SpanZ = SA.length / t2Count; // 7.0m each
  const t2Y = GY - 2.00;
  for (let i = 0; i < t2Count; i++) {
    const cz = SA.minZ + t2SpanZ * (i + 0.5);
    [-1, 1].forEach((side) => {
      // Hinge mounted at outer shaft wall X = ±10.0m!
      const hinge = new THREE.Group();
      hinge.position.set(OX + side * 9.95, t2Y, cz);
      const { group: plate } = buildMechaPlate(9.86, 0.24, t2SpanZ - 0.18, darkArmorMat, brushedTiMat, amberGlowMat, side);
      plate.position.set(-side * 4.93, 0, 0);
      hinge.add(plate);
      // Visible chrome hydraulic piston strut attached to underside of each iris plate
      const piston = addBox(hinge, 3.8, 0.16, 0.16, chromeMat, -side * 2.1, -0.34, 0, false);
      piston.rotation.z = side * 0.24;
      dynamicGrp.add(hinge);
      roofPlates.tier2.push({ hinge, side, idx: i });
    });
  }

  // ---- TIER 3: 10 Pressurized Telescoping Acoustic Bulkhead Slats (5 West + 5 East) ----
  const t3Count = 5;
  const t3SpanZ = SA.length / t3Count; // 8.4m each
  const t3Y = GY - 4.10;
  const t3LedMat = new THREE.MeshStandardMaterial({
    color: 0xf87171,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });
  for (let i = 0; i < t3Count; i++) {
    const cz = SA.minZ + t3SpanZ * (i + 0.5);
    [-1, 1].forEach((side) => {
      const slat = new THREE.Group();
      const baseX = OX + side * 5.0;
      slat.position.set(baseX, t3Y, cz);
      const { group: plate } = buildMechaPlate(9.92, 0.30, t3SpanZ - 0.20, darkSteelMat, blastArmorMat, t3LedMat, side);
      slat.add(plate);
      dynamicGrp.add(slat);
      roofPlates.tier3.push({ slat, side, idx: i, baseX });
    });
  }

  // ---- TIER 4: 6 Heavy Vaulted Blast-Shield Jaw Doors (3 West + 3 East) ----
  const t4Count = 3;
  const t4SpanZ = SA.length / t4Count; // 14.0m each
  const t4Y = GY - 6.40;
  for (let i = 0; i < t4Count; i++) {
    const cz = SA.minZ + t4SpanZ * (i + 0.5);
    [-1, 1].forEach((side) => {
      const jawHinge = new THREE.Group();
      jawHinge.position.set(OX + side * 9.95, t4Y, cz);
      const { group: plate } = buildMechaPlate(9.90, 0.42, t4SpanZ - 0.24, blastArmorMat, darkSteelMat, cyanGlowMat, side);
      plate.position.set(-side * 4.95, 0, 0);
      jawHinge.add(plate);
      // Heavy steel jaw reinforcement ribs & underside hangar floodlight bar
      addBox(jawHinge, 8.6, 0.22, 0.32, brushedTiMat, -side * 4.8, -0.32, 0, false);
      addBox(jawHinge, 6.2, 0.08, 0.38, warmCeilGlowMat, -side * 5.0, -0.24, 0, false);
      dynamicGrp.add(jawHinge);
      roofPlates.tier4.push({ jawHinge, side, idx: i });
    });
  }

  // =========================================================================
  // 4. GIANT 40m HYDRAULIC MEGA-LIFT PLATFORM & SCISSOR-TRUSS MECHANISM
  // =========================================================================
  const LM = NULL_SILO_MECHANISM.lift;
  const liftGroup = new THREE.Group();
  liftGroup.position.set(OX, B40Y, OZ);
  dynamicGrp.add(liftGroup);

  // Main 19.2m × 40.6m × 1.1m Reinforced Titanium Mega-Lift Platform (Top Flush at local Y = 0.0!)
  const liftDeckMat = makeSurfaceMat('silo_hazard_deck', 8.0, 16.0, { roughness: 0.48, metalness: 0.38 });
  addBox(liftGroup, LM.width, LM.thickness, LM.length, liftDeckMat, 0, -LM.thickness * 0.5, 0, false);
  // Perimeter Yellow/Black Hazard Frame & Cyan Runway Guidance Strips
  addBox(liftGroup, LM.width + 0.12, 0.24, 0.48, hazardYellowMat, 0, -0.10, -LM.length * 0.5 + 0.24, false);
  addBox(liftGroup, LM.width + 0.12, 0.24, 0.48, hazardYellowMat, 0, -0.10, LM.length * 0.5 - 0.24, false);
  addBox(liftGroup, 0.48, 0.24, LM.length, hazardYellowMat, -LM.width * 0.5 + 0.24, -0.10, 0, false);
  addBox(liftGroup, 0.48, 0.24, LM.length, hazardYellowMat, LM.width * 0.5 - 0.24, -0.10, 0, false);
  // Twin Illuminated K-11 Runway Center Guides
  addBox(liftGroup, 0.18, 0.04, 34.0, cyanGlowMat, -4.8, 0.02, 0, false);
  addBox(liftGroup, 0.18, 0.04, 34.0, cyanGlowMat, 4.8, 0.02, 0, false);

  // 4 Spinning Corner Pinion Drive Gears engaging the 40m Vertical Racks!
  const pinionGears = [];
  [
    [-LM.width * 0.5 + 0.25, -LM.length * 0.5 + 0.65],
    [LM.width * 0.5 - 0.25, -LM.length * 0.5 + 0.65],
    [-LM.width * 0.5 + 0.25, LM.length * 0.5 - 0.65],
    [LM.width * 0.5 - 0.25, LM.length * 0.5 - 0.65],
  ].forEach(([gx, gz]) => {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 12), craneYellowMat);
    gear.rotation.z = Math.PI * 0.5;
    gear.position.set(gx, -0.45, gz);
    liftGroup.add(gear);
    pinionGears.push(gear);
  });

  // 4 Retractable Skid-Lock Clamp Arms on Lift Deck (lock K-11 during ascent, swing clear for takeoff!)
  const clampArms = [];
  [[-3.6, -5.2], [3.6, -5.2], [-3.6, 5.2], [3.6, 5.2]].forEach(([cx, cz]) => {
    const side = cx < 0 ? -1 : 1;
    const clamp = new THREE.Group();
    clamp.position.set(cx, 0.08, cz);
    addBox(clamp, 0.32, 0.85, 0.55, craneYellowMat, 0, 0.42, 0, false);
    addBox(clamp, 0.85, 0.22, 0.42, darkSteelMat, -side * 0.35, 0.78, 0, false);
    liftGroup.add(clamp);
    clampArms.push({ clamp, side });
  });

  // 4 Giant Multi-Stage Telescoping Hydraulic Lifting Columns (Extending 0 -> 40.0m Underneath Platform!)
  const hydroColumns = [];
  [[-6.8, -13.5], [6.8, -13.5], [-6.8, 13.5], [6.8, 13.5]].forEach(([hx, hz]) => {
    // Base outer casing cylinder anchored at B40Y
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.0, 14), darkSteelMat);
    baseCyl.position.set(OX + hx, B40Y - 0.5, OZ + hz);
    dynamicGrp.add(baseCyl);
    // Gleaming inner telescoping chrome piston rod extending up to liftGroup!
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1.0, 14), chromeMat);
    rod.position.set(OX + hx, B40Y - 0.5, OZ + hz);
    dynamicGrp.add(rod);
    hydroColumns.push({ baseCyl, rod, hx, hz });
  });

  // 4 Pairs (8 Total) Giant Articulated X-Scissor Truss Lifting Arms spanning under the Mega-Lift!
  const scissorPairs = [];
  [-12.0, 12.0].forEach((sz) => {
    [-1, 1].forEach((xSide) => {
      const armA = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 22.0), craneYellowMat);
      const armB = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 22.0), darkSteelMat);
      dynamicGrp.add(armA, armB);
      scissorPairs.push({ armA, armB, xPos: OX + xSide * 6.8, zCenter: OZ + sz });
    });
  });

  // =========================================================================
  // 5. B40F (-40.0m) SUBTERRANEAN HANGAR CAVERN (47m × 54m × H14.5m)
  // =========================================================================
  const HG = NULL_EREA.hangar; // X: -23.5..23.5, Z: 29883..29937, H: 14.5
  const cavH = HG.cavernCeilingH;
  const cavMidY = B40Y + cavH * 0.5;

  // Sub-Lift Pit Floor at -41.5m (directly under the Mega-Lift!)
  addBox(staticGrp, SA.width + 0.8, 0.50, SA.length + 0.8, darkSteelMat, OX, B40Y - 1.45, OZ, false);

  // Underground Hangar Gallery Floors (West Concourse, East Fuel Bay, North & South Aprons at B40Y!)
  addBox(staticGrp, 13.6, 0.40, HG.length, epoxyMat, -16.8, B40Y - 0.20, OZ, false); // West Concourse (-23.6..-10.0)
  addBox(staticGrp, 13.6, 0.40, HG.length, epoxyMat, +16.8, B40Y - 0.20, OZ, false); // East Fuel/Maint (+10.0..+23.6)
  addBox(staticGrp, SA.width, 0.40, 6.2, epoxyMat, OX, B40Y - 0.20, 29886.0, false); // North Strip
  addBox(staticGrp, SA.width, 0.40, 6.2, epoxyMat, OX, B40Y - 0.20, 29934.0, false); // South Strip

  // Hangar Cavern Vaulted Ceiling Slabs over West & East Galleries (Y = B40Y + 14.5m)
  addBox(staticGrp, 13.8, 0.60, HG.length, concreteMat, -16.8, B40Y + cavH + 0.30, OZ, false);
  addBox(staticGrp, 13.8, 0.60, HG.length, concreteMat, +16.8, B40Y + cavH + 0.30, OZ, false);
  addBox(staticGrp, SA.width + 0.8, 0.60, 6.4, concreteMat, OX, B40Y + cavH + 0.30, 29886.0, false);
  addBox(staticGrp, SA.width + 0.8, 0.60, 6.4, concreteMat, OX, B40Y + cavH + 0.30, 29934.0, false);

  // Outer Subterranean Perimeter Concrete Walls (East, North, South, and West with ELV-NULL Door Cutout!)
  addBox(staticGrp, 0.70, cavH, HG.length, concreteMat, HG.maxX + 0.35, cavMidY, OZ, false); // East Wall
  addBox(staticGrp, HG.width + 1.0, cavH, 0.70, concreteMat, OX, cavMidY, HG.minZ - 0.35, false); // North Wall
  addBox(staticGrp, HG.width + 1.0, cavH, 0.70, concreteMat, OX, cavMidY, HG.maxZ + 0.35, false); // South Wall
  // West Wall split cleanly around ELV-NULL East Doorway (Z: 29909.3..29910.7, H: 2.30m)
  addBox(staticGrp, 0.70, cavH, 26.3, concreteMat, HG.minX - 0.35, cavMidY, 29896.15, false); // West-North
  addBox(staticGrp, 0.70, cavH, 26.3, concreteMat, HG.minX - 0.35, cavMidY, 29923.85, false); // West-South
  addBox(staticGrp, 0.70, cavH - 2.32, 1.45, concreteMat, HG.minX - 0.35, B40Y + 2.32 + (cavH - 2.32) * 0.5, OZ, false); // Above ELV door

  // Heavy Ribbed Steel Arch Portal Columns along West & East Galleries every 9.0m
  for (let z = 29888; z <= 29932; z += 8.8) {
    addBox(staticGrp, 0.65, cavH, 0.65, darkSteelMat, -22.9, cavMidY, z, false);
    addBox(staticGrp, 0.65, cavH, 0.65, darkSteelMat, +22.9, cavMidY, z, false);
    addBox(staticGrp, 13.0, 0.55, 0.55, darkSteelMat, -16.8, B40Y + cavH - 0.30, z, false);
    addBox(staticGrp, 13.0, 0.55, 0.55, darkSteelMat, +16.8, B40Y + cavH - 0.30, z, false);
    // Overhead Hangar LED Strip Bars
    addBox(staticGrp, 8.0, 0.12, 0.38, warmCeilGlowMat, -16.8, B40Y + cavH - 0.62, z, false);
    addBox(staticGrp, 8.0, 0.12, 0.38, warmCeilGlowMat, +16.8, B40Y + cavH - 0.62, z, false);
  }

  // Dynamic Retractable Boarding Bridge (Spans X: -10.2 .. -2.3 at Z = 29910 when Lift is at -40m!)
  const boardingBridge = new THREE.Group();
  boardingBridge.position.set(-10.1, B40Y + 0.04, OZ);
  addBox(boardingBridge, 7.8, 0.16, 2.8, brushedTiMat, 3.9, -0.06, 0, false);
  addBox(boardingBridge, 7.8, 0.05, 0.14, cyanGlowMat, 3.9, 0.04, -1.32, false);
  addBox(boardingBridge, 7.8, 0.05, 0.14, cyanGlowMat, 3.9, 0.04, 1.32, false);
  addBox(boardingBridge, 7.8, 0.96, 0.06, glassMat, 3.9, 0.52, -1.34, false);
  addBox(boardingBridge, 7.8, 0.96, 0.06, glassMat, 3.9, 0.52, 1.34, false);
  dynamicGrp.add(boardingBridge);

  // Dynamic Pit Safety Barriers along West & East Shaft Edges at -40m (rise automatically when lift ascends!)
  const safetyBarrierGroup = new THREE.Group();
  addBox(safetyBarrierGroup, 0.14, 1.05, SA.length, hazardYellowMat, -10.25, B40Y - 0.55, OZ, false);
  addBox(safetyBarrierGroup, 0.14, 1.05, SA.length, hazardYellowMat, +10.25, B40Y - 0.55, OZ, false);
  dynamicGrp.add(safetyBarrierGroup);

  // ---- WEST SIDE: TECNICA FORCES COMMAND CONSOLE & MEMORIAL PLAQUE ----
  const cmdBoardMat = makeSignMat([
    { text: 'TECNICA FORCES  —  K-11 COMMAND', font: '900 32px sans-serif', color: '#38bdf8' },
    { text: 'FOUNDER + 9 ELITE ENGINEERS  |  2-YEAR DEVELOPMENT', font: '700 20px monospace', color: '#fde68a' },
    { text: 'MAX 250 km/h • 1L/3km (100L=300km) • 4.5×15×3.2m CABIN', font: '700 18px monospace', color: '#6ee7b7' },
    { text: 'SILO-40 DEPTH: -40.0m  |  44 ARTICULATED BLAST PLATES', font: '700 18px monospace', color: '#e2e8f0' },
  ], '#07111e', '#38bdf8', '#e2e8f0', 768, 256);
  addBox(staticGrp, 0.24, 2.4, 7.2, darkSteelMat, -22.8, B40Y + 2.6, 29903.0, false);
  const cmdScreen = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.15), cmdBoardMat);
  cmdScreen.rotation.y = Math.PI * 0.5;
  cmdScreen.position.set(-22.65, B40Y + 2.6, 29903.0);
  staticGrp.add(cmdScreen);

  // Master Hangar Launch & Lift Control Console (X: -14.2, Z: 29906.0)
  addBox(staticGrp, 1.25, 1.15, 2.8, darkSteelMat, -14.2, B40Y + 0.575, 29906.0, false);
  const hangarLaunchBtn = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.28), launchBtnOffMat);
  hangarLaunchBtn.position.set(-13.55, B40Y + 1.24, 29905.4);
  hangarLaunchBtn.userData.propId = 'null_silo_toggle_b40';
  dynamicGrp.add(hangarLaunchBtn);
  interactiveProps.push({
    id: 'null_silo_toggle_b40',
    floor: -40,
    isNullSiloBtn: true,
    mesh: hangarLaunchBtn,
    getLabel() { return siloController.getTogglePrompt(); },
  });

  const hangarRefuelBtn = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.28), refuelBtnMat);
  hangarRefuelBtn.position.set(-13.55, B40Y + 1.24, 29906.6);
  hangarRefuelBtn.userData.propId = 'null_refuel_b40';
  dynamicGrp.add(hangarRefuelBtn);
  interactiveProps.push({
    id: 'null_refuel_b40',
    floor: -40,
    isK11RefuelBtn: true,
    mesh: hangarRefuelBtn,
    getLabel() { return 'K-11 給油 (100L)'; },
  });

  // ---- EAST SIDE: 100L HYPER-EFFICIENCY FUEL BAY & GANTRY CRANE ----
  [29904.0, 29910.0, 29916.0].forEach((fz) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 6.2, 16), brushedTiMat);
    tank.position.set(19.5, B40Y + 3.1, fz);
    staticGrp.add(tank);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.40, 1.40, 0.36, 16), emeraldGlowMat);
    band.position.set(19.5, B40Y + 4.2, fz);
    staticGrp.add(band);
  });
  const fuelSignMat = makeSignMat([
    { text: 'TF-E11 HYPER-FUEL BAY', font: '900 32px sans-serif', color: '#34d399' },
    { text: '1L = 3.0 km  |  MAX 100.0 L (300 km RANGE)', font: '700 22px monospace', color: '#e2e8f0' },
  ], '#0a1916', '#10b981', '#e2e8f0', 512, 160);
  const fuelSign = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.8), fuelSignMat);
  fuelSign.rotation.y = -Math.PI * 0.5;
  fuelSign.position.set(22.8, B40Y + 7.2, OZ);
  staticGrp.add(fuelSign);

  // Overhead Yellow Industrial Gantry Crane Bridge in East Gallery
  addBox(staticGrp, 12.2, 0.72, 0.82, craneYellowMat, 16.8, B40Y + 11.8, OZ - 6.0, false);
  addBox(staticGrp, 12.2, 0.72, 0.82, craneYellowMat, 16.8, B40Y + 11.8, OZ + 6.0, false);
  addBox(staticGrp, 1.6, 0.9, 2.2, darkSteelMat, 15.0, B40Y + 11.2, OZ - 6.0, false);

  // Hangar Ambient Lights (Curated 5-light budget for POCO F7!)
  addLight('NullHangar_West', -16.5, B40Y + 9.5, OZ, 0xdbeafe, 4.2, 34, 'null_hangar', -40);
  addLight('NullHangar_CenterN', OX, B40Y + 12.5, OZ - 12.0, 0xe0f2fe, 4.8, 38, 'null_hangar', -40);
  addLight('NullHangar_CenterS', OX, B40Y + 12.5, OZ + 12.0, 0xe0f2fe, 4.8, 38, 'null_hangar', -40);
  addLight('NullHangar_East', 16.5, B40Y + 9.5, OZ, 0xd1fae5, 3.8, 34, 'null_hangar', -40);
  addLight('NullHangar_MidShaft', OX, GY - 18.0, OZ, 0xbae6fd, 3.6, 36, 'null_hangar', -40);

  // =========================================================================
  // 6. HIGH-SPEED 40m DEEP-SHAFT ELEVATOR (ELV-NULL / TECNICA EXPRESS-40)
  // =========================================================================
  const E = NULL_ELEVATOR;
  const esCx = E.shaft.cx; // -25.0
  const esCz = E.shaft.cz; // 29910.0
  const elvTopY = GY + 4.40;
  const elvPitY = B40Y - 1.40;
  const elvTotalH = elvTopY - elvPitY;

  // Surface Brutalist Titanium-and-Glass Elevator Pavilion (X: -28.0..-22.2, Z: 29906.8..29913.2)
  const PV = E.pavilion;
  addBox(staticGrp, PV.maxX - PV.minX, 0.34, PV.maxZ - PV.minZ, darkSteelMat, (PV.minX + PV.maxX) * 0.5, GY + PV.height, esCz, false);
  // 4 Pavilion Columns
  [
    [PV.minX + 0.16, PV.minZ + 0.16], [PV.maxX - 0.16, PV.minZ + 0.16],
    [PV.minX + 0.16, PV.maxZ - 0.16], [PV.maxX - 0.16, PV.maxZ - 0.16],
  ].forEach(([px, pz]) => {
    addBox(staticGrp, 0.32, PV.height, 0.32, darkSteelMat, px, GY + PV.height * 0.5, pz, false);
  });
  // Pavilion Back (West), North, South Glazed Walls (East side wide open toward Launch Pad!)
  addBox(staticGrp, 0.18, PV.height, PV.maxZ - PV.minZ - 0.3, concreteMat, PV.minX + 0.09, GY + PV.height * 0.5, esCz, false);
  addBox(staticGrp, PV.maxX - PV.minX - 0.4, PV.height - 0.3, 0.06, glassMat, (PV.minX + PV.maxX) * 0.5, GY + PV.height * 0.5, PV.minZ + 0.12, false);
  addBox(staticGrp, PV.maxX - PV.minX - 0.4, PV.height - 0.3, 0.06, glassMat, (PV.minX + PV.maxX) * 0.5, GY + PV.height * 0.5, PV.maxZ - 0.12, false);

  // Glowing Surface Pavilion Header Sign
  const elvHeaderMat = makeSignMat([
    { text: 'ELV-NULL  //  TECNICA EXPRESS-40', font: '900 28px sans-serif', color: '#38bdf8' },
    { text: 'HIGH-SPEED 40m DROP TO K-11 HANGAR (B40F)', font: '700 18px monospace', color: '#fde68a' },
  ], '#0a121d', '#38bdf8', '#ffffff', 640, 128);
  const elvSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.95), elvHeaderMat);
  elvSignMesh.rotation.y = Math.PI * 0.5;
  elvSignMesh.position.set(PV.maxX + 0.04, GY + PV.height - 0.42, esCz);
  staticGrp.add(elvSignMesh);

  // Full 40m Vertical Armored Glass & Steel Hoistway Shaft (B40Y - 1.4m .. GY + 4.4m)
  [
    [E.shaft.minX + 0.07, E.shaft.minZ + 0.07],
    [E.shaft.maxX - 0.07, E.shaft.minZ + 0.07],
    [E.shaft.minX + 0.07, E.shaft.maxZ - 0.07],
    [E.shaft.maxX - 0.07, E.shaft.maxZ - 0.07],
  ].forEach(([cx, cz]) => {
    addBox(staticGrp, 0.14, elvTotalH, 0.14, darkSteelMat, cx, elvPitY + elvTotalH * 0.5, cz, false);
  });
  // Concrete shaft backing liner (West, North, South) + racing cyan LED guide rails down all 40m!
  addBox(staticGrp, 0.24, elvTotalH, E.shaft.depth + 0.3, concreteMat, E.shaft.minX - 0.14, elvPitY + elvTotalH * 0.5, esCz, false);
  addBox(staticGrp, E.shaft.width + 0.2, elvTotalH, 0.24, concreteMat, esCx, elvPitY + elvTotalH * 0.5, E.shaft.minZ - 0.14, false);
  addBox(staticGrp, E.shaft.width + 0.2, elvTotalH, 0.24, concreteMat, esCx, elvPitY + elvTotalH * 0.5, E.shaft.maxZ + 0.14, false);
  // East shaft wall between -37.5m and -0.2m (leaving GL and B40F East doorways cleanly open!)
  addBox(staticGrp, 0.20, 37.3, E.shaft.depth, concreteMat, E.shaft.maxX + 0.10, B40Y + 2.35 + 37.3 * 0.5, esCz, false);
  // Racing high-speed cyan LED light strips running 40m vertically inside shaft!
  addBox(staticGrp, 0.06, 40.0, 0.06, cyanGlowMat, E.shaft.minX + 0.12, B40Y + 20.0, E.shaft.minZ + 0.12, false);
  addBox(staticGrp, 0.06, 40.0, 0.06, cyanGlowMat, E.shaft.minX + 0.12, B40Y + 20.0, E.shaft.maxZ - 0.12, false);

  // Depth marker rings every 5m inside ELV-NULL shaft so riding 40m down feels exhilarating!
  for (let d = 5; d <= 35; d += 5) {
    const ry = GY - d;
    addBox(staticGrp, E.shaft.width - 0.1, 0.10, 0.10, brushedTiMat, esCx, ry, E.shaft.minZ + 0.08, false);
    addBox(staticGrp, E.shaft.width - 0.1, 0.10, 0.10, brushedTiMat, esCx, ry, E.shaft.maxZ - 0.08, false);
    addBox(staticGrp, 0.08, 0.08, E.shaft.depth - 0.2, amberGlowMat, E.shaft.maxX - 0.05, ry, esCz, false);
  }

  // Landing Sliding Doors at GL (0m) and B40F (-40m) on East face (X = -23.80)
  const elvDoorW = E.door.width; // 1.30m
  const elvDoorH = E.door.height; // 2.24m
  const elvLeafW = elvDoorW * 0.5 - 0.01;
  const elvLandingDoors = {};
  E.stops.forEach((st) => {
    const sy = GY + st.relY;
    const left = addBox(dynamicGrp, 0.05, elvDoorH, elvLeafW, brushedTiMat, E.door.x + 0.03, sy + elvDoorH * 0.5, esCz - elvLeafW * 0.5, false);
    const right = addBox(dynamicGrp, 0.05, elvDoorH, elvLeafW, brushedTiMat, E.door.x + 0.03, sy + elvDoorH * 0.5, esCz + elvLeafW * 0.5, false);
    elvLandingDoors[st.floor] = { left, right };
  });

  // High-Speed Futuristic Elevator Cab (2.04m × 2.04m × 2.50m)
  const cabGroup = new THREE.Group();
  cabGroup.position.set(0, GY, 0);
  dynamicGrp.add(cabGroup);

  const cabW = E.cab.width;
  const cabD = E.cab.depth;
  const cabH = E.cab.height;
  addBox(cabGroup, cabW, 0.12, cabD, darkSteelMat, esCx, -0.06, esCz, false);
  addBox(cabGroup, cabW + 0.06, 0.12, cabD + 0.06, darkSteelMat, esCx, cabH + 0.06, esCz, false);
  addBox(cabGroup, cabW - 0.28, 0.03, cabD - 0.28, warmCeilGlowMat, esCx, cabH - 0.02, esCz, false);
  // Cab walls (Panoramic armored glass on North/South/West so you watch the 40m high-speed drop!)
  addBox(cabGroup, cabW - 0.12, cabH - 0.14, 0.03, glassMat, esCx, cabH * 0.5, E.cab.minZ + 0.02, false);
  addBox(cabGroup, cabW - 0.12, cabH - 0.14, 0.03, glassMat, esCx, cabH * 0.5, E.cab.maxZ - 0.02, false);
  addBox(cabGroup, 0.04, cabH - 0.14, cabD - 0.12, glassMat, E.cab.minX + 0.02, cabH * 0.5, esCz, false);
  // Corner frame mullions & cyan handrail
  [
    [E.cab.minX + 0.03, E.cab.minZ + 0.03], [E.cab.maxX - 0.03, E.cab.minZ + 0.03],
    [E.cab.minX + 0.03, E.cab.maxZ - 0.03], [E.cab.maxX - 0.03, E.cab.maxZ - 0.03],
  ].forEach(([mx, mz]) => {
    addBox(cabGroup, 0.06, cabH, 0.06, darkSteelMat, mx, cabH * 0.5, mz, false);
  });
  addBox(cabGroup, 0.04, 0.04, cabD - 0.30, cyanGlowMat, E.cab.minX + 0.10, 0.94, esCz, false);

  // Cab East Sliding Doors
  const cabDoorLeft = addBox(cabGroup, 0.04, elvDoorH, elvLeafW, brushedTiMat, E.cab.maxX - 0.03, elvDoorH * 0.5, esCz - elvLeafW * 0.5, false);
  const cabDoorRight = addBox(cabGroup, 0.04, elvDoorH, elvLeafW, brushedTiMat, E.cab.maxX - 0.03, elvDoorH * 0.5, esCz + elvLeafW * 0.5, false);

  // Cab Interior Light
  const elvCabLight = new THREE.PointLight(0xe0f2fe, 2.2, 7.5, 1.5);
  elvCabLight.position.set(esCx, cabH - 0.25, esCz);
  elvCabLight.userData.building = 'null_elv';
  cabGroup.add(elvCabLight);
  interiorLights.push({ name: 'ELV_NULL_Cab', floor: 1, zone: 'null_elv', light: elvCabLight, baseInt: 2.2 });

  // Dynamic High-Res OLED Depth & Speed Indicator inside Cab (Mounted on West Wall above handrail)
  const oledCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (oledCanvas) { oledCanvas.width = 384; oledCanvas.height = 128; }
  const oledTex = oledCanvas ? new THREE.CanvasTexture(oledCanvas) : null;
  if (oledTex) oledTex.colorSpace = THREE.SRGBColorSpace;
  const oledMat = oledTex
    ? new THREE.MeshStandardMaterial({ map: oledTex, emissiveMap: oledTex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.0, roughness: 0.2 })
    : new THREE.MeshStandardMaterial({ color: 0x0ea5e9 });
  const oledMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.32), oledMat);
  oledMesh.rotation.y = Math.PI * 0.5;
  oledMesh.position.set(E.cab.minX + 0.07, 1.98, esCz);
  cabGroup.add(oledMesh);

  let lastOledSig = '';
  function drawElvOled(relY, speedMs, phase, targetFloor) {
    if (!oledCanvas || !oledTex) return;
    const depthStr = `${relY >= -0.05 ? ' 0.0' : relY.toFixed(1)}m`;
    const kmhStr = `${Math.round(Math.abs(speedMs) * 3.6)} km/h`;
    const arrow = speedMs > 0.2 ? '▲' : (speedMs < -0.2 ? '▼' : '●');
    const sig = `${depthStr}|${kmhStr}|${arrow}|${phase}`;
    if (sig === lastOledSig) return;
    lastOledSig = sig;
    const c = oledCanvas.getContext('2d');
    c.fillStyle = '#050b14';
    c.fillRect(0, 0, 384, 128);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 376, 120);
    c.fillStyle = '#38bdf8';
    c.font = '900 44px monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`${arrow} ${depthStr}`, 20, 50);
    c.fillStyle = '#fde68a';
    c.font = '700 28px monospace';
    c.textAlign = 'right';
    c.fillText(kmhStr, 364, 50);
    c.fillStyle = '#94a3b8';
    c.font = '700 20px sans-serif';
    c.textAlign = 'center';
    c.fillText(targetFloor === -40 ? 'TECNICA EXPRESS-40 → B40F K-11車庫' : 'TECNICA EXPRESS-40 → GL NULL EREA', 192, 98);
    oledTex.needsUpdate = true;
  }

  // Physical 3D COP Buttons inside Cab (South Interior Panel, super easy to aim/tap!)
  addBox(cabGroup, 0.72, 0.88, 0.06, darkSteelMat, esCx, 1.30, E.cab.maxZ - 0.05, false);
  const elvCopDefs = [
    { id: 'null_elv_btn_gl', floor: 1, label: '0m', accent: '#34d399', x: esCx - 0.16, y: 1.48 },
    { id: 'null_elv_btn_b40', floor: -40, label: '-40m', accent: '#38bdf8', x: esCx + 0.16, y: 1.48 },
    { id: 'null_elv_btn_open', action: 'open', label: '開', accent: '#f59e0b', x: esCx - 0.16, y: 1.12 },
    { id: 'null_elv_btn_close', action: 'close', label: '閉', accent: '#f59e0b', x: esCx + 0.16, y: 1.12 },
  ];
  const elvCopMats = new Map();
  elvCopDefs.forEach((b) => {
    const offMat = makeButtonMat(b.label, b.accent, false);
    const litMat = makeButtonMat(b.label, b.accent, true);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.055), offMat);
    m.position.set(b.x, b.y, E.cab.maxZ - 0.09);
    m.userData.propId = b.id;
    cabGroup.add(m);
    elvCopMats.set(b.id, { mesh: m, offMat, litMat, floor: b.floor });
    interactiveProps.push({
      id: b.id,
      floor: 1,
      isNullElevatorBtn: true,
      targetFloor: b.floor,
      elvAction: b.action || null,
      mesh: m,
      getLabel() { return b.floor === -40 ? '地下40mへ' : (b.floor === 1 ? '地上0mへ' : b.label); },
    });
  });

  // Physical 3D Hall Call Buttons at BOTH GL (0m) and B40F (-40m)
  const elvHallBtns = {};
  E.stops.forEach((st) => {
    const sy = GY + st.relY;
    const offMat = makeButtonMat('呼出', '#38bdf8', false);
    const litMat = makeButtonMat('呼出', '#38bdf8', true);
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.24), offMat);
    cm.position.set(E.door.x + 0.14, sy + 1.28, E.door.maxZ + 0.28);
    cm.userData.propId = `null_elv_call_${st.floor}`;
    dynamicGrp.add(cm);
    elvHallBtns[st.floor] = { mesh: cm, offMat, litMat };
    interactiveProps.push({
      id: `null_elv_call_${st.floor}`,
      floor: st.floor,
      isNullElevatorCall: true,
      callFloor: st.floor,
      mesh: cm,
      getLabel() { return st.floor === -40 ? 'ELV呼出 (地下40m)' : 'ELV呼出 (地上0m)'; },
    });
  });

  // Dynamic Hoist Cables for ELV-NULL
  const elvCables = [];
  [-0.22, 0.0, 0.22].forEach((dz) => {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), brushedTiMat);
    rope.position.set(esCx, GY - 10, esCz + dz);
    dynamicGrp.add(rope);
    elvCables.push(rope);
  });

  // Batch all static geometry cleanly for POCO F7 GPU efficiency!
  const { batchedGroup, stats: batchStats } = batchStaticGroups([staticGrp]);
  root.add(batchedGroup);

  // =========================================================================
  // 7. SMOOTH S-CURVE 40m HIGH-SPEED ELEVATOR CONTROLLER (ELV-NULL)
  // =========================================================================
  const nullElevator = {
    cabGroup,
    groundY: GY,
    b40Y: B40Y,
    cabY: GY,
    prevCabY: GY,
    velY: 0.0,
    currentStopFloor: 1,
    targetFloor: 1,
    phase: 'IDLE_OPEN', // IDLE_OPEN | DOOR_CLOSING | RUNNING | DOOR_OPENING
    doorProgress: 1.0,
    doorHoldTimer: 4.0,
    queuedFloor: null,

    getStopByFloor(fl) {
      return E.stops.find((s) => s.floor === fl) || E.stops[0];
    },

    _syncVisuals() {
      cabGroup.position.y = this.cabY;
      const slide = this.doorProgress * (elvLeafW * 0.94);
      const openHere = this.phase !== 'RUNNING' ? slide : 0;
      cabDoorLeft.position.z = esCz - elvLeafW * 0.5 - openHere;
      cabDoorRight.position.z = esCz + elvLeafW * 0.5 + openHere;
      E.stops.forEach((st) => {
        const ld = elvLandingDoors[st.floor];
        if (!ld) return;
        const s = (st.floor === this.currentStopFloor && this.phase !== 'RUNNING') ? slide : 0;
        ld.left.position.z = esCz - elvLeafW * 0.5 - s;
        ld.right.position.z = esCz + elvLeafW * 0.5 + s;
      });
      const ropeTop = elvTopY - 0.15;
      const ropeBot = this.cabY + cabH + 0.10;
      const ropeLen = Math.max(0.25, ropeTop - ropeBot);
      elvCables.forEach((r) => {
        r.scale.y = ropeLen;
        r.position.y = ropeBot + ropeLen * 0.5;
      });
      elvCopMats.forEach((entry) => {
        const lit = entry.floor !== undefined && entry.floor === this.targetFloor && this.phase !== 'IDLE_OPEN';
        entry.mesh.material = lit ? entry.litMat : entry.offMat;
      });
      E.stops.forEach((st) => {
        const hb = elvHallBtns[st.floor];
        if (!hb) return;
        const lit = this.targetFloor === st.floor && this.phase !== 'IDLE_OPEN';
        hb.mesh.material = lit ? hb.litMat : hb.offMat;
      });
      drawElvOled(this.cabY - GY, this.velY, this.phase, this.targetFloor);
    },

    selectFloor(fl) {
      const st = this.getStopByFloor(fl);
      if (!st) return;
      if (st.floor === this.currentStopFloor && (this.phase === 'IDLE_OPEN' || this.phase === 'DOOR_OPENING')) {
        this.doorHoldTimer = 5.0;
        return;
      }
      if (this.phase === 'RUNNING') {
        this.queuedFloor = st.floor;
        return;
      }
      this.targetFloor = st.floor;
      this.phase = 'DOOR_CLOSING';
      this._syncVisuals();
    },

    callToFloor(fl) {
      this.selectFloor(fl);
    },

    openDoorsNow() {
      if (this.phase === 'RUNNING') return;
      this.phase = 'DOOR_OPENING';
      this.doorHoldTimer = 5.5;
    },

    closeDoorsNow() {
      if (this.phase === 'IDLE_OPEN' || this.phase === 'DOOR_OPENING') {
        if (this.targetFloor !== this.currentStopFloor) this.phase = 'DOOR_CLOSING';
      }
    },

    snapToFloor(fl, open = true) {
      const st = this.getStopByFloor(fl);
      this.currentStopFloor = st.floor;
      this.targetFloor = st.floor;
      this.cabY = GY + st.relY;
      this.prevCabY = this.cabY;
      this.velY = 0;
      this.doorProgress = open ? 1.0 : 0.0;
      this.phase = 'IDLE_OPEN';
      this._syncVisuals();
    },

    update(dt) {
      this.prevCabY = this.cabY;
      if (this.phase === 'DOOR_CLOSING') {
        this.doorProgress = Math.max(0, this.doorProgress - dt * 1.45);
        if (this.doorProgress <= 0.001) {
          this.doorProgress = 0;
          this.phase = 'RUNNING';
        }
      } else if (this.phase === 'RUNNING') {
        const tgt = this.getStopByFloor(this.targetFloor);
        const tgtY = GY + tgt.relY;
        const diff = tgtY - this.cabY;
        const dist = Math.abs(diff);
        const dir = Math.sign(diff);
        // Thrilling 12.5 m/s (45 km/h) linear-traction express profile!
        const desiredV = Math.min(E.maxSpeed, Math.sqrt(Math.max(0, 2 * 4.4 * dist)));
        const targetVel = dir * desiredV;
        const accelStep = E.accel * dt;
        if (Math.abs(targetVel - this.velY) <= accelStep) this.velY = targetVel;
        else this.velY += Math.sign(targetVel - this.velY) * accelStep;
        this.cabY += this.velY * dt;
        if (dist < 0.06 && Math.abs(this.velY) < 0.65) {
          this.cabY = tgtY;
          this.velY = 0;
          this.currentStopFloor = tgt.floor;
          this.phase = 'DOOR_OPENING';
          this.doorHoldTimer = 5.5;
        }
      } else if (this.phase === 'DOOR_OPENING') {
        this.doorProgress = Math.min(1.0, this.doorProgress + dt * 1.35);
        if (this.doorProgress >= 0.999) {
          this.doorProgress = 1.0;
          this.phase = 'IDLE_OPEN';
        }
      } else if (this.phase === 'IDLE_OPEN' && this.queuedFloor !== null && this.queuedFloor !== this.currentStopFloor) {
        this.doorHoldTimer -= dt;
        if (this.doorHoldTimer <= 0) {
          this.targetFloor = this.queuedFloor;
          this.queuedFloor = null;
          this.phase = 'DOOR_CLOSING';
        }
      }
      this._syncVisuals();
      return this.phase !== 'IDLE_OPEN';
    },
  };
  nullElevator.snapToFloor(1, true);

  // =========================================================================
  // 8. 44-PLATE MECHA ROOF & 40m MEGA-LIFT SYNCHRONIZED CHOREOGRAPHY ENGINE
  // =========================================================================
  const easeInOut = (t) => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  };
  const subPhase = (u, t0, t1) => easeInOut((u - t0) / Math.max(0.001, t1 - t0));

  const siloController = {
    groundY: GY,
    b40Y: B40Y,
    roofPlates,
    totalPlateCount: roofPlates.tier1.length + roofPlates.tier2.length + roofPlates.tier3.length + roofPlates.tier4.length,
    state: 'STORED_B40', // 'STORED_B40' | 'LAUNCH_OPENING' | 'SURFACE_READY' | 'STOW_CLOSING'
    seqProgress: 0.0,    // 0.0 = fully sealed at -40m, 1.0 = all 44 plates open & lift locked at 0m!
    roofProgress: 0.0,   // 0..1 aggregate roof openness
    liftProgress: 0.0,   // 0..1 platform elevation (0 = -40m, 1 = 0m surface!)
    liftY: B40Y,
    prevLiftY: B40Y,
    bridgeProgress: 1.0, // 1 = extended at -40m, 0 = retracted
    stageEventPending: null, // 'unlock' | 'roof_open' | 'lift_start' | 'surface_lock' | 'stow_start' | 'roof_close' | null
    _lastSeqBucket: 0,

    getTogglePrompt() {
      if (this.state === 'STORED_B40' || this.state === 'STOW_CLOSING') return '屋根開放・地上へ上昇';
      return '地下40mへ格納・閉鎖';
    },

    isRoofSealed() {
      return this.roofProgress < 0.06;
    },

    isSurfaceReady() {
      return this.liftProgress > 0.992 && this.roofProgress > 0.95;
    },

    startLaunchSequence() {
      if (this.state === 'SURFACE_READY' || this.state === 'LAUNCH_OPENING') return false;
      this.state = 'LAUNCH_OPENING';
      this.stageEventPending = 'unlock';
      return true;
    },

    startStowSequence() {
      if (this.state === 'STORED_B40' || this.state === 'STOW_CLOSING') return false;
      this.state = 'STOW_CLOSING';
      this.stageEventPending = 'stow_start';
      return true;
    },

    toggleSequence() {
      if (this.state === 'STORED_B40' || this.state === 'STOW_CLOSING') {
        return this.startLaunchSequence();
      }
      return this.startStowSequence();
    },

    snapState(open = false) {
      this.state = open ? 'SURFACE_READY' : 'STORED_B40';
      this.seqProgress = open ? 1.0 : 0.0;
      this._applyKinematics(0);
      this.prevLiftY = this.liftY;
    },

    _applyKinematics(elapsed) {
      const u = this.seqProgress;
      // Boarding bridge retracts first (u: 0.00 -> 0.08)
      this.bridgeProgress = 1.0 - subPhase(u, 0.0, 0.08);
      boardingBridge.position.x = -10.1 - (1.0 - this.bridgeProgress) * 8.2;

      // Dynamic -40m pit safety railings rise smoothly as soon as lift leaves -40m!
      const barLift = subPhase(u, 0.25, 0.36);
      safetyBarrierGroup.position.y = barLift * 1.10;

      // ---- 44-PLATE MULTI-LAYER CASCADE ROOF MOTION (u: 0.05 -> 0.68) ----
      // Tier 1 (16 Surface Blast Louvers): Staggered N->S wave: tilt + lift then slide out!
      let rSum = 0;
      roofPlates.tier1.forEach((p) => {
        const stag = (p.idx / 7) * 0.14;
        const pLift = subPhase(u, 0.05 + stag * 0.6, 0.16 + stag * 0.6);
        const pSlide = subPhase(u, 0.13 + stag, 0.34 + stag);
        p.pivot.position.x = p.baseX + p.side * (10.75 * pSlide);
        p.pivot.position.y = p.baseY + 0.56 * pLift * (1.0 - pSlide * 0.35);
        p.pivot.rotation.z = -p.side * (0.26 * pLift * (1.0 - pSlide * 0.65));
        rSum += pSlide;
      });

      // Tier 2 (12 Hydraulic Folding Iris Blades): Staggered center-out 86° upward fold!
      roofPlates.tier2.forEach((p) => {
        const distCenter = Math.abs(p.idx - 2.5) / 2.5;
        const stag = distCenter * 0.11;
        const pFold = subPhase(u, 0.20 + stag, 0.44 + stag);
        p.hinge.rotation.z = -p.side * (Math.PI * 0.478 * pFold);
        rSum += pFold;
      });

      // Tier 3 (10 Pressurized Acoustic Bulkhead Slats): LED shifts red->amber->emerald + lateral retract!
      const t3Gate = subPhase(u, 0.32, 0.56);
      if (t3Gate < 0.12) {
        t3LedMat.color.setHex(0xf87171);
        t3LedMat.emissive.setHex(0xef4444);
      } else if (t3Gate < 0.85) {
        t3LedMat.color.setHex(0xfde047);
        t3LedMat.emissive.setHex(0xf59e0b);
      } else {
        t3LedMat.color.setHex(0x6ee7b7);
        t3LedMat.emissive.setHex(0x10b981);
      }
      roofPlates.tier3.forEach((p) => {
        const stag = (Math.abs(p.idx - 2) / 2) * 0.10;
        const pRetract = subPhase(u, 0.34 + stag, 0.56 + stag);
        p.slat.position.x = p.baseX + p.side * (10.35 * pRetract);
        rSum += pRetract;
      });

      // Tier 4 (6 Heavy Vaulted Blast-Shield Jaws): Deep 92° downward/outward jaw swing!
      roofPlates.tier4.forEach((p) => {
        const stag = (p.idx === 1 ? 0.0 : 0.06);
        const pJaw = subPhase(u, 0.46 + stag, 0.68 + stag);
        p.jawHinge.rotation.z = p.side * (Math.PI * 0.51 * pJaw);
        rSum += pJaw;
      });

      this.roofProgress = rSum / 44.0;

      // ---- GIANT 40m HYDRAULIC MEGA-LIFT ASCENT (u: 0.30 -> 1.00!) ----
      // Notice the awesome dramatic overlap: as Tiers 2-4 swing open and daylight pours in,
      // the giant floor ALREADY starts rising from -40m all the way flush to GL 0m!
      this.liftProgress = subPhase(u, 0.30, 1.00);
      this.liftY = B40Y + this.liftProgress * 40.0;
      liftGroup.position.y = this.liftY;

      // Spin 4 corner pinion gears proportionally to lift travel!
      const gearAngle = this.liftProgress * Math.PI * 26.0;
      pinionGears.forEach((g) => { g.rotation.x = gearAngle; });

      // Skid-lock clamps engage while moving, open outward at 0m surface ready or -40m docked!
      const clampLocked = (this.state === 'LAUNCH_OPENING' || this.state === 'STOW_CLOSING') ? 1.0 : 0.0;
      clampArms.forEach((c) => {
        c.clamp.rotation.z = c.side * (1.0 - clampLocked) * 0.42;
      });

      // Extend 4 Giant Multi-Stage Hydraulic Cylinders & 8 Articulated X-Scissor Trusses!
      const extH = Math.max(0.25, this.liftY - LM.thickness - (B40Y - 1.2));
      hydroColumns.forEach((hc) => {
        const baseH = Math.min(extH, 16.0);
        hc.baseCyl.scale.y = baseH;
        hc.baseCyl.position.y = (B40Y - 1.2) + baseH * 0.5;
        hc.rod.scale.y = extH;
        hc.rod.position.y = (B40Y - 1.2) + extH * 0.5;
      });

      const scSpanH = Math.max(0.6, this.liftProgress * 39.2);
      const halfAngle = Math.asin(Math.min(0.95, scSpanH / 41.2));
      const midY = B40Y - 0.6 + scSpanH * 0.5;
      scissorPairs.forEach((sp) => {
        const armLen = Math.max(2.0, Math.min(41.5, Math.hypot(scSpanH, 14.0)));
        sp.armA.scale.z = armLen / 22.0;
        sp.armB.scale.z = armLen / 22.0;
        sp.armA.position.set(sp.xPos, midY, sp.zCenter);
        sp.armB.position.set(sp.xPos, midY, sp.zCenter);
        sp.armA.rotation.x = halfAngle;
        sp.armB.rotation.x = -halfAngle;
      });

      // Rotate / pulse surface perimeter warning beacons when sequence active!
      const moving = this.state === 'LAUNCH_OPENING' || this.state === 'STOW_CLOSING';
      const pulse = moving ? (0.85 + Math.sin(elapsed * 12.0) * 0.85) : (this.state === 'SURFACE_READY' ? 0.55 : 0.18);
      warningBeacons.forEach((b, idx) => {
        b.material.emissiveIntensity = moving ? (0.4 + Math.max(0, Math.sin(elapsed * 10.0 + idx * 0.8)) * 2.2) : pulse;
      });

      // Update launch button glow on surface & hangar consoles
      const btnMat = moving ? launchBtnLitMat : launchBtnOffMat;
      surfLaunchBtn.material = btnMat;
      hangarLaunchBtn.material = btnMat;
    },

    update(dt, elapsed, wind = null) {
      this.prevLiftY = this.liftY;
      let animating = false;
      if (this.state === 'LAUNCH_OPENING') {
        animating = true;
        this.seqProgress = Math.min(1.0, this.seqProgress + dt / NULL_SILO_MECHANISM.openDurationSec);
        const bucket = this.seqProgress > 0.30 ? 2 : (this.seqProgress > 0.08 ? 1 : 0);
        if (bucket !== this._lastSeqBucket) {
          this._lastSeqBucket = bucket;
          if (bucket === 1) this.stageEventPending = 'roof_open';
          else if (bucket === 2) this.stageEventPending = 'lift_start';
        }
        if (this.seqProgress >= 0.9999) {
          this.seqProgress = 1.0;
          this.state = 'SURFACE_READY';
          this.stageEventPending = 'surface_lock';
        }
      } else if (this.state === 'STOW_CLOSING') {
        animating = true;
        this.seqProgress = Math.max(0.0, this.seqProgress - dt / NULL_SILO_MECHANISM.closeDurationSec);
        const bucket = this.seqProgress < 0.32 ? 0 : 1;
        if (bucket !== this._lastSeqBucket) {
          this._lastSeqBucket = bucket;
          if (bucket === 0) this.stageEventPending = 'roof_close';
        }
        if (this.seqProgress <= 0.0001) {
          this.seqProgress = 0.0;
          this.state = 'STORED_B40';
          this.stageEventPending = 'surface_lock';
        }
      }

      // Gentle windsock animation matching live wind
      if (wind && (Math.abs(wind.x) > 0.2 || Math.abs(wind.z) > 0.2)) {
        windsock.rotation.y = Math.atan2(wind.z, wind.x);
      } else {
        windsock.rotation.y = Math.sin(elapsed * 0.7) * 0.18;
      }

      this._applyKinematics(elapsed);
      return animating;
    },
  };
  siloController.snapState(false);

  return {
    root,
    groundY: GY,
    b40Y: B40Y,
    elevator: nullElevator,
    silo: siloController,
    batchStats,
  };
}
