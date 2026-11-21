import * as THREE from 'three';
import { ELEVATOR } from './deepBasementData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the Ultra-Realistic Mechanical MRL Gearless Traction Elevator ("ELV-1"):
 * - Penetrates 4 Floors Vertically: B3F (-10.20m) <-> B2F (-6.60m) <-> B1F (-2.40m) <-> 1F Ground (0.00m)
 * - Real Moving Mechanics:
 *   * Full-height concrete hoistway shaft (-11.40m pit -> +2.70m MRL machine deck)
 *   * Dual pit helical oil spring buffers + steel pit ladder + backlit shaft floor stencils
 *   * Full-height bolted T-section car guide rails & counterweight guide rails
 *   * Top Gearless PM Traction Motor + Rotating Main Drive Sheave + Deflector Sheave + Brake Caliper
 *   * 4 Dynamic Steel Hoist Wire Ropes scaling live between sheaves, cab roof, and counterweight
 *   * Counterweight (CWT) moving in exact opposite direction to the cab (visible through cab rear observation glass!)
 *   * Dual-Synchronized Center-Opening Sliding Doors (Cab Door + Mechanically Interlocked Landing Doors)
 *   * Live CanvasTexture Digital LED Floor & Arrow Indicators (inside cab + all 4 landing transoms)
 *   * Oversized glowing 3D Car Operating Panel (COP) & Hall Call Buttons (HOP)
 */
export function buildElevator3D(ctx) {
  const {
    scene,
    mat,
    interactiveProps,
    interiorLights,
  } = ctx;

  const S = ELEVATOR.shaft; // minX:3.25, maxX:4.85, minZ:0.85, maxZ:2.65
  const C = ELEVATOR.cab;   // minX:3.36, maxX:4.58, minZ:1.02, maxZ:2.48, H:2.24
  const D = ELEVATOR.door;  // x:3.25, minZ:1.30, maxZ:2.20, W:0.90, H:2.10
  const shaftW = S.maxX - S.minX;
  const shaftD = S.maxZ - S.minZ;
  const shaftCx = (S.minX + S.maxX) / 2;
  const shaftCz = (S.minZ + S.maxZ) / 2;
  const doorCz = (D.minZ + D.maxZ) / 2; // 1.75
  const cabCx = (C.minX + C.maxX) / 2;  // 3.97
  const cabCz = (C.minZ + C.maxZ) / 2;  // 1.75
  const cabW = C.maxX - C.minX;         // 1.22
  const cabD = C.maxZ - C.minZ;         // 1.46
  const cabH = C.height;                // 2.24

  const elvRoot = new THREE.Group();
  elvRoot.name = 'RealTractionElevatorELV1';
  scene.add(elvRoot);

  const elvStatic = new THREE.Group();
  const elvDynamic = new THREE.Group();
  elvRoot.add(elvDynamic);

  // --- Dedicated Architectural & Mechanical Elevator Materials ---
  const shaftConcMat = makeSurfaceMat('concrete_pcon', 2.0, 4.0);
  const shaftDarkConcMat = makeSurfaceMat('concrete_clean', 2.0, 2.0, { color: 0x62676d });
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xbcc4cc, roughness: 0.26, metalness: 0.82 });
  const darkStainlessMat = new THREE.MeshStandardMaterial({ color: 0x5c646d, roughness: 0.34, metalness: 0.78 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.42, metalness: 0.74 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x8e969e, roughness: 0.36, metalness: 0.85 });
  const motorGreenMat = new THREE.MeshStandardMaterial({ color: 0x2c4b47, roughness: 0.45, metalness: 0.48 });
  const brakeRedMat = new THREE.MeshStandardMaterial({ color: 0xb82824, roughness: 0.38, metalness: 0.35 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xe8b423, roughness: 0.44, metalness: 0.18 });
  const rubberEdgeMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.90, metalness: 0.04 });
  const graniteFloorMat = makeSurfaceMat('tile_grey_stone', 1.3, 1.5, { color: 0x6e737a, roughness: 0.36 });
  const walnutPanelMat = makeSurfaceMat('wood_walnut_floor', 1.2, 1.4, { roughness: 0.48 });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0xdce6f0, roughness: 0.06, metalness: 0.94 });
  const obsGlassMat = new THREE.MeshStandardMaterial({
    color: 0xaed0e8,
    roughness: 0.10,
    metalness: 0.12,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const cabCeilGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff8ec,
    emissive: new THREE.Color(0xffe9c7),
    emissiveIntensity: 1.45,
    roughness: 0.25,
  });
  const shaftBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd599,
    emissive: new THREE.Color(0xff9e3d),
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });

  function addEBox(parent, w, h, d, material, x, y, z, castShadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Helper: Procedural Glowing Button Faceplate Texture (Large Readable Labels!)
  function makeButtonMat(label, accentHex = '#f5b041', isLit = false) {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: isLit ? 0xffc857 : 0x2a313a, emissive: isLit ? 0xf59e0b : 0x11151a, emissiveIntensity: isLit ? 1.4 : 0.25 });
    }
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = isLit ? '#2b1e08' : '#181c22';
    c.fillRect(0, 0, 128, 128);
    // Illuminated tactile ring
    c.strokeStyle = isLit ? accentHex : '#738294';
    c.lineWidth = isLit ? 12 : 7;
    c.beginPath();
    c.arc(64, 64, 52, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = isLit ? '#fff5dc' : '#dbe3ec';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = label.length <= 2 ? '800 44px sans-serif' : '800 32px sans-serif';
    c.fillText(label, 64, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(isLit ? accentHex : '#7890a8'),
      emissiveIntensity: isLit ? 1.45 : 0.45,
      roughness: 0.28,
      metalness: 0.35,
    });
  }

  // Helper: Live Redrawable LED Digital Position & Direction Display (CanvasTexture)
  function createDigitalIndicator() {
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = 256;
      cv.height = 96;
    }
    const tex = cv ? new THREE.CanvasTexture(cv) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const matInd = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffb84d),
      emissiveIntensity: 1.25,
      roughness: 0.2,
    });
    const redraw = (floorCode, dir, statusText = '') => {
      if (!cv) return;
      const c = cv.getContext('2d');
      c.fillStyle = '#090c10';
      c.fillRect(0, 0, 256, 96);
      c.strokeStyle = '#36414f';
      c.lineWidth = 4;
      c.strokeRect(3, 3, 250, 90);
      // Up / Down directional glowing arrow (left side)
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 44px monospace';
      if (dir > 0) {
        c.fillStyle = '#38e89e';
        c.fillText('▲', 44, 48);
      } else if (dir < 0) {
        c.fillStyle = '#f97316';
        c.fillText('▼', 44, 48);
      } else {
        c.fillStyle = '#536273';
        c.fillText('●', 44, 48);
      }
      // Crisp 7-seg/dot-matrix style floor code
      c.fillStyle = floorCode === '1F' ? '#5ef2b3' : '#ffc459';
      c.font = '800 54px monospace';
      c.fillText(floorCode, 134, 49);
      // Mini status badge (right)
      c.fillStyle = '#9db3c9';
      c.font = '700 18px monospace';
      c.fillText(statusText || 'STOP', 216, 48);
      tex.needsUpdate = true;
    };
    redraw('B3', 0, 'OPEN');
    return { mat: matInd, redraw };
  }

  // Helper: Backlit Shaft Wall Floor Stencil ("1F", "B1", "B2", "B3") visible through cab glass!
  function makeShaftStencilMat(code, elevText) {
    if (typeof document === 'undefined') return shaftConcMat;
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#25292e';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#e8b423';
    c.fillRect(0, 0, 256, 12);
    c.fillRect(0, 116, 256, 12);
    c.fillStyle = '#f2ede2';
    c.textAlign = 'center';
    c.font = '800 56px monospace';
    c.fillText(code, 128, 66);
    c.fillStyle = '#e8b423';
    c.font = '700 22px monospace';
    c.fillText(elevText, 128, 102);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x5a4c32),
      emissiveIntensity: 0.45,
      roughness: 0.72,
    });
  }

  // =========================================================================
  // 1. FULL-HEIGHT HOISTWAY CONCRETE SHAFT, PIT BUFFERS & STEEL GUIDE RAILS
  // =========================================================================
  const totalShaftH = S.topY - S.pitY; // 14.10 m!
  const midShaftY = (S.topY + S.pitY) / 2;

  // Pit concrete floor (-11.40) & Top shaft cap (+2.70)
  addEBox(elvStatic, shaftW + 0.24, 0.20, shaftD + 0.24, shaftDarkConcMat, shaftCx, S.pitY - 0.10, shaftCz);
  addEBox(elvStatic, shaftW + 0.24, 0.08, shaftD + 0.24, shaftDarkConcMat, shaftCx, S.topY + 0.04, shaftCz);
  // East, North, South full-height concrete shaft walls
  addEBox(elvStatic, 0.14, totalShaftH, shaftD + 0.20, shaftConcMat, S.maxX + 0.07, midShaftY, shaftCz);
  addEBox(elvStatic, shaftW + 0.20, totalShaftH, 0.12, shaftConcMat, shaftCx, midShaftY, S.minZ - 0.06);
  addEBox(elvStatic, shaftW + 0.20, totalShaftH, 0.12, shaftConcMat, shaftCx, midShaftY, S.maxZ + 0.06);

  // West front shaft wall (X = 3.15..3.25): solid piers North & South of the 0.90m door slot + solid inter-floor spandrels!
  addEBox(elvStatic, 0.10, totalShaftH, D.minZ - S.minZ + 0.04, shaftConcMat, S.minX - 0.05, midShaftY, (S.minZ + D.minZ) / 2 - 0.02);
  addEBox(elvStatic, 0.10, totalShaftH, S.maxZ - D.maxZ + 0.04, shaftConcMat, S.minX - 0.05, midShaftY, (D.maxZ + S.maxZ) / 2 + 0.02);
  // Vertical spandrel segments between the 4 door openings along Z = 1.30..2.20
  const stopYsAsc = [...ELEVATOR.stops].sort((a, b) => a.y - b.y);
  let curY = S.pitY;
  for (const st of stopYsAsc) {
    const segH = st.y - curY;
    if (segH > 0.02) {
      addEBox(elvStatic, 0.10, segH, D.width, shaftConcMat, S.minX - 0.05, curY + segH / 2, doorCz);
    }
    curY = st.y + D.height;
  }
  // Top transom spandrel above 1F door (Y = 2.10..2.70) — framed with glass inspection window into the MRL Drive Sheave!
  addEBox(elvStatic, 0.10, 0.14, D.width, darkStainlessMat, S.minX - 0.05, 2.17, doorCz);
  addEBox(elvStatic, 0.02, 0.44, D.width - 0.06, obsGlassMat, S.minX - 0.05, 2.46, doorCz);

  // Pit Helical Oil Spring Buffers (Cab Buffer + Counterweight Buffer) & Pit Safety Ladder
  const buildSpringBuffer = (bx, bz) => {
    addEBox(elvStatic, 0.28, 0.08, 0.28, railSteelMat, bx, S.pitY + 0.04, bz);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.62, 12), brakeRedMat);
    cyl.position.set(bx, S.pitY + 0.38, bz);
    elvStatic.add(cyl);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.016, 6, 14), safetyYellowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(bx, S.pitY + 0.22 + i * 0.10, bz);
      elvStatic.add(ring);
    }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), rubberEdgeMat);
    pad.position.set(bx, S.pitY + 0.72, bz);
    elvStatic.add(pad);
  };
  buildSpringBuffer(cabCx, cabCz);
  buildSpringBuffer(4.70, cabCz);

  // Pit Steel Ladder on North-West Shaft Corner
  addEBox(elvStatic, 0.03, 2.20, 0.03, safetyYellowMat, 3.34, S.pitY + 1.10, 0.94);
  addEBox(elvStatic, 0.03, 2.20, 0.03, safetyYellowMat, 3.68, S.pitY + 1.10, 0.94);
  for (let ry = S.pitY + 0.25; ry < S.pitY + 2.15; ry += 0.28) {
    addEBox(elvStatic, 0.34, 0.025, 0.025, safetyYellowMat, 3.51, ry, 0.94);
  }

  // 2 Main T-Section Car Guide Rails (North Z=0.90, South Z=2.60 at X=cabCx) + Bolted Wall Brackets!
  [S.minZ + 0.06, S.maxZ - 0.06].forEach((rzRail) => {
    const dir = rzRail < shaftCz ? 1 : -1;
    // T-rail base flange + machined nose
    addEBox(elvStatic, 0.11, totalShaftH - 0.25, 0.024, railSteelMat, cabCx, midShaftY, rzRail);
    addEBox(elvStatic, 0.026, totalShaftH - 0.25, 0.075, stainlessMat, cabCx, midShaftY, rzRail + dir * 0.042);
    for (let by = S.pitY + 0.6; by <= S.topY - 0.3; by += 1.35) {
      addEBox(elvStatic, 0.34, 0.05, 0.06, darkStainlessMat, cabCx, by, rzRail - dir * 0.02);
    }
  });
  // 2 Counterweight Guide Rails along East Rear Shaft Wall (X = 4.74, Z = 1.24 & 2.26)
  [1.24, 2.26].forEach((czRail) => {
    addEBox(elvStatic, 0.045, totalShaftH - 0.25, 0.045, railSteelMat, 4.76, midShaftY, czRail);
    for (let by = S.pitY + 0.8; by <= S.topY - 0.4; by += 1.50) {
      addEBox(elvStatic, 0.10, 0.04, 0.12, darkStainlessMat, 4.80, by, czRail);
    }
  });

  // Backlit Stenciled Shaft Floor Markers + Caged Warm Inspection Lights along East Shaft Wall!
  ELEVATOR.stops.forEach((st) => {
    const stMat = makeShaftStencilMat(st.code, `${st.y >= 0 ? '+' : ''}${st.y.toFixed(1)}m`);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.72), stMat);
    sign.position.set(S.maxX - 0.015, st.y + 1.55, cabCz);
    sign.userData.noBatch = true;
    elvDynamic.add(sign);
  });
  for (let ly = -9.60; ly <= 2.10; ly += 2.60) {
    addEBox(elvStatic, 0.06, 0.22, 0.10, railSteelMat, 4.78, ly, 1.02);
    addEBox(elvStatic, 0.04, 0.16, 0.07, shaftBulbMat, 4.74, ly, 1.02);
  }

  // =========================================================================
  // 2. TOP MRL GEARLESS TRACTION DRIVE MACHINE (Y = +2.38 .. +2.66m)
  // =========================================================================
  const sheaveY = 2.48;
  // Twin Heavy Steel Machine Bed I-Beams
  addEBox(elvStatic, shaftW - 0.06, 0.09, 0.08, railSteelMat, shaftCx, 2.34, 1.48);
  addEBox(elvStatic, shaftW - 0.06, 0.09, 0.08, railSteelMat, shaftCx, 2.34, 2.02);
  // Gearless PM Traction Motor Cylinder + Electromagnetic Red Brake Caliper
  const motorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 16), motorGreenMat);
  motorMesh.rotation.x = Math.PI / 2;
  motorMesh.position.set(cabCx - 0.22, sheaveY, cabCz);
  elvStatic.add(motorMesh);
  addEBox(elvStatic, 0.14, 0.18, 0.22, brakeRedMat, cabCx - 0.18, sheaveY + 0.08, cabCz - 0.22);

  // Rotating Main Drive Sheave (above Cab centerline X=cabCx) & Deflector Sheave (above Counterweight X=4.70)
  const makeGroovedSheave = (radius) => {
    const grp = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.14, 20), darkStainlessMat);
    wheel.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.022, 8, 20), stainlessMat);
    const spokeA = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.85, 0.035, 0.155), safetyYellowMat);
    const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.035, radius * 1.85, 0.155), safetyYellowMat);
    grp.add(wheel, rim, spokeA, spokeB);
    return grp;
  };
  const mainSheave = makeGroovedSheave(0.20);
  mainSheave.position.set(cabCx, sheaveY, cabCz);
  elvDynamic.add(mainSheave);

  const deflectorSheave = makeGroovedSheave(0.15);
  deflectorSheave.position.set(4.68, sheaveY, cabCz);
  elvDynamic.add(deflectorSheave);

  // Overspeed Governor Pulley (Safety Mechanism)
  const governorWheel = makeGroovedSheave(0.11);
  governorWheel.position.set(cabCx, sheaveY, S.minZ + 0.18);
  elvDynamic.add(governorWheel);

  // Horizontal Bridge Ropes spanning Main Drive Sheave -> Deflector Sheave
  [-0.045, -0.015, 0.015, 0.045].forEach((rzOff) => {
    addEBox(elvStatic, 4.68 - cabCx, 0.012, 0.012, cableMat, (cabCx + 4.68) / 2, sheaveY + 0.17, cabCz + rzOff);
  });

  // =========================================================================
  // 3. LIVE MOVING COUNTERWEIGHT (CWT) & 4 DYNAMIC STEEL HOIST WIRE ROPES
  // =========================================================================
  const cwtGroup = new THREE.Group();
  cwtGroup.name = 'ElevatorCounterweight';
  // Heavy steel vertical counterweight frame (height 1.80m, centered at local y = 0..1.80)
  addEBox(cwtGroup, 0.12, 1.82, 0.06, railSteelMat, 0, 0.91, -0.48);
  addEBox(cwtGroup, 0.12, 1.82, 0.06, railSteelMat, 0, 0.91, 0.48);
  addEBox(cwtGroup, 0.16, 0.10, 1.04, safetyYellowMat, 0, 1.80, 0);
  addEBox(cwtGroup, 0.16, 0.10, 1.04, safetyYellowMat, 0, 0.04, 0);
  // 4 Guide Shoes gripping the rear counterweight guide rails + glowing amber counterweight status marker
  [0.10, 1.72].forEach((gy) => {
    [-0.50, 0.50].forEach((gz) => {
      addEBox(cwtGroup, 0.10, 0.14, 0.08, brakeRedMat, 0.05, gy, gz);
    });
  });
  addEBox(cwtGroup, 0.02, 0.06, 0.72, shaftBulbMat, -0.085, 0.92, 0);
  // 9 Stacked Cast-Iron Counterweight Filler Slabs
  for (let i = 0; i < 9; i++) {
    addEBox(cwtGroup, 0.12, 0.15, 0.88, i % 2 === 0 ? darkStainlessMat : stainlessMat, 0, 0.18 + i * 0.175, 0);
  }
  cwtGroup.position.set(4.68, -1.0, cabCz);
  elvDynamic.add(cwtGroup);

  // 4 Live Scaling Wire Ropes (Unit-height cylinders scaled every frame between top sheaves and Cab/CWT!)
  const unitRopeGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6);
  const cabRopes = [];
  const cwtRopes = [];
  [-0.045, -0.015, 0.015, 0.045].forEach((rzOff) => {
    const rCab = new THREE.Mesh(unitRopeGeo, cableMat);
    rCab.position.set(cabCx, 0, cabCz + rzOff);
    elvDynamic.add(rCab);
    cabRopes.push(rCab);

    const rCwt = new THREE.Mesh(unitRopeGeo, cableMat);
    rCwt.position.set(4.68, 0, cabCz + rzOff);
    elvDynamic.add(rCwt);
    cwtRopes.push(rCwt);
  });

  // =========================================================================
  // 4. ULTRA-DETAILED MOVING ELEVATOR CAB (cabGroup)
  // =========================================================================
  const cabGroup = new THREE.Group();
  cabGroup.name = 'ElevatorCab';
  elvDynamic.add(cabGroup);

  // Structural Floor Platform + Flamed Dark Granite Finish + Stainless Grooved Threshold Sill
  addEBox(cabGroup, cabW + 0.08, 0.12, cabD + 0.08, railSteelMat, cabCx, -0.06, cabCz);
  addEBox(cabGroup, cabW, 0.02, cabD, graniteFloorMat, cabCx, 0.01, cabCz);
  addEBox(cabGroup, 0.08, 0.024, D.width + 0.06, stainlessMat, C.minX - 0.02, 0.012, doorCz);

  // Structural Roof Cap + Heavy Dark-Iron Crosshead Sling Beam + 4-Rope Hitch Shackle Plate
  addEBox(cabGroup, cabW + 0.08, 0.08, cabD + 0.08, darkStainlessMat, cabCx, cabH + 0.04, cabCz);
  addEBox(cabGroup, 0.18, 0.14, cabD + 0.22, railSteelMat, cabCx, cabH + 0.14, cabCz); // Crosshead beam
  addEBox(cabGroup, 0.16, 0.08, 0.20, safetyYellowMat, cabCx, cabH + 0.24, cabCz);    // 4-rope hitch block
  // Architectural Luminous Frosted Diffuser Ceiling Panel
  addEBox(cabGroup, cabW - 0.18, 0.03, cabD - 0.22, cabCeilGlowMat, cabCx, cabH - 0.015, cabCz);
  addEBox(cabGroup, cabW - 0.14, 0.04, 0.04, stainlessMat, cabCx, cabH - 0.02, cabCz); // Center ceiling mullion

  // Side Walls (North Z=1.02, South Z=2.48): Brushed Hairline Stainless Lower + Warm Walnut Upper + Stainless Handrails!
  [C.minZ, C.maxZ].forEach((wz) => {
    const inward = wz < cabCz ? 1 : -1;
    addEBox(cabGroup, cabW, 0.92, 0.04, stainlessMat, cabCx, 0.46, wz - inward * 0.02);
    addEBox(cabGroup, cabW, cabH - 0.92, 0.04, walnutPanelMat, cabCx, 0.92 + (cabH - 0.92) / 2, wz - inward * 0.02);
    // Stainless baseboard kickplate & wrap-around tubular handrail (H = 0.90m)
    addEBox(cabGroup, cabW - 0.04, 0.10, 0.015, darkStainlessMat, cabCx, 0.06, wz + inward * 0.01);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cabW - 0.16, 10), stainlessMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(cabCx, 0.90, wz + inward * 0.065);
    cabGroup.add(bar);
    [-0.42, 0.42].forEach((bxOff) => {
      addEBox(cabGroup, 0.025, 0.025, 0.065, darkStainlessMat, cabCx + bxOff, 0.90, wz + inward * 0.032);
    });
  });
  // Framed Architectural Vanity Mirror mounted on North Cab Wall (Z = 1.02)
  addEBox(cabGroup, 0.78, 0.96, 0.018, stainlessMat, cabCx, 1.52, C.minZ + 0.012);
  addEBox(cabGroup, 0.72, 0.90, 0.014, mirrorGlassMat, cabCx, 1.52, C.minZ + 0.018);

  // Rear East Cab Wall (X = 4.58): Lower Stainless + FULL PANORAMIC SHAFT OBSERVATION GLASS (H=0.96..2.12 -> watch CWT & ropes!)
  addEBox(cabGroup, 0.04, 0.96, cabD, stainlessMat, C.maxX + 0.02, 0.48, cabCz);
  addEBox(cabGroup, 0.04, cabH - 0.96, 0.18, darkStainlessMat, C.maxX + 0.02, 0.96 + (cabH - 0.96) / 2, C.minZ + 0.09);
  addEBox(cabGroup, 0.04, cabH - 0.96, 0.18, darkStainlessMat, C.maxX + 0.02, 0.96 + (cabH - 0.96) / 2, C.maxZ - 0.09);
  addEBox(cabGroup, 0.04, 0.12, cabD, darkStainlessMat, C.maxX + 0.02, cabH - 0.06, cabCz);
  // Crystal-Clear Floor-to-Transom Shaft Observation Window (H = 0.96..2.12)
  addEBox(cabGroup, 0.016, 1.16, cabD - 0.36, obsGlassMat, C.maxX + 0.01, 1.54, cabCz);
  addEBox(cabGroup, 0.03, 0.03, cabD - 0.36, stainlessMat, C.maxX, 0.96, cabCz);
  addEBox(cabGroup, 0.03, 0.03, cabD - 0.36, stainlessMat, C.maxX, 2.12, cabCz);
  // Rear Stainless Handrail
  const rearBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cabD - 0.24, 10), stainlessMat);
  rearBar.rotation.x = Math.PI / 2;
  rearBar.position.set(C.maxX - 0.065, 0.90, cabCz);
  cabGroup.add(rearBar);

  // Front West Cab Wall Return Panels flanking the 0.90m Door Opening (Z = 1.02..1.30 & 2.20..2.48) + Transom Header
  addEBox(cabGroup, 0.04, cabH, D.minZ - C.minZ, stainlessMat, C.minX - 0.02, cabH / 2, (C.minZ + D.minZ) / 2);
  addEBox(cabGroup, 0.04, cabH, C.maxZ - D.maxZ, stainlessMat, C.minX - 0.02, cabH / 2, (D.maxZ + C.maxZ) / 2);
  addEBox(cabGroup, 0.05, cabH - D.height + 0.02, D.width, darkStainlessMat, C.minX - 0.02, D.height + (cabH - D.height) / 2, doorCz);

  // Live Cab Transom Digital Floor Indicator (visible inside cab above door!)
  const cabIndicator = createDigitalIndicator();
  const cabIndMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.38), cabIndicator.mat);
  cabIndMesh.position.set(C.minX + 0.012, D.height + 0.06, doorCz);
  cabGroup.add(cabIndMesh);

  // Synchronized Center-Opening Car Doors (Left Z=1.30..1.75, Right Z=1.75..2.20)
  const leafW = D.width / 2 + 0.01;
  const makeDoorLeaf = (isLeft) => {
    const grp = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.034, D.height - 0.02, leafW), stainlessMat);
    panel.position.set(0, D.height / 2, 0);
    // Rubber safety-edge sensor bumper at center meeting edge
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.038, D.height - 0.02, 0.024), rubberEdgeMat);
    edge.position.set(0, D.height / 2, isLeft ? leafW / 2 - 0.008 : -leafW / 2 + 0.008);
    // Sleek vertical tinted vision window slit
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.72, 0.09), obsGlassMat);
    slit.position.set(0, 1.38, isLeft ? 0.04 : -0.04);
    grp.add(panel, edge, slit);
    return grp;
  };
  const carDoorL = makeDoorLeaf(true);
  const carDoorR = makeDoorLeaf(false);
  const carDoorLClosedZ = doorCz - leafW / 2;
  const carDoorRClosedZ = doorCz + leafW / 2;
  carDoorL.position.set(C.minX - 0.045, 0, carDoorLClosedZ);
  carDoorR.position.set(C.minX - 0.045, 0, carDoorRClosedZ);
  cabGroup.add(carDoorL, carDoorR);

  // Moving Cab Interior Architectural PointLight (attached directly to cabGroup!)
  const cabLight = new THREE.PointLight(0xfff1dc, 0, 6.2, 1.40);
  cabLight.position.set(cabCx, cabH - 0.14, cabCz);
  cabLight.visible = false;
  cabLight.userData.building = 'elevator';
  cabGroup.add(cabLight);
  interiorLights.push({ name: 'ELV_Cab_Light', floor: 1, zone: 'elevator', light: cabLight, baseInt: 2.55 });

  // =========================================================================
  // 5. OVERSIZED 3D CAR OPERATING PANEL (COP) INSIDE CAB (Big Tactile Buttons!)
  // =========================================================================
  const copX = C.minX + 0.015;
  const copZ = 2.34;
  addEBox(cabGroup, 0.024, 1.06, 0.25, darkStainlessMat, copX - 0.005, 1.32, copZ);
  addEBox(cabGroup, 0.012, 1.08, 0.27, stainlessMat, copX - 0.010, 1.32, copZ);
  // Luminous MRL-600 Capacity & Emergency Intercom Header Plate at top of COP
  addEBox(cabGroup, 0.022, 0.12, 0.18, makeButtonMat('ELV', '#60a5fa', true), copX + 0.010, 1.72, copZ);

  const copButtons = new Map();
  const copBtnSpecs = [
    { id: 'elv_btn_1',     floor: 1,  label: '1F', y: 1.54, accent: '#38e89e', prompt: '【1F 地上直通】エレベーターで一気に地上へ' },
    { id: 'elv_btn_0',     floor: 0,  label: 'B1', y: 1.39, accent: '#f5b041', prompt: '【B1F 地下1階】倉庫フロアへ移動' },
    { id: 'elv_btn_-1',    floor: -1, label: 'B2', y: 1.24, accent: '#f5b041', prompt: '【B2F 地下2階】10×10mスタジオへ移動' },
    { id: 'elv_btn_-2',    floor: -2, label: 'B3', y: 1.09, accent: '#f5b041', prompt: '【B3F 地下3階】木造シェルターへ移動' },
    { id: 'elv_btn_open',  floor: null, label: '◀▶', y: 0.93, accent: '#60a5fa', prompt: 'エレベーター扉を開く' },
  ];

  // Forward-declared controller object filled right below
  const controller = {
    cabGroup,
    cwtGroup,
    mainSheave,
    deflectorSheave,
    governorWheel,
    cabY: -10.20, // Starts ready & waiting at B3F (-10.20m) right at the end of the W520mm corridor!
    velocity: 0,
    currentStopFloor: -2,
    targetFloor: -2,
    phase: 'IDLE_OPEN', // 'IDLE_OPEN' | 'CLOSING' | 'MOVING' | 'OPENING'
    doorProgress: 1.0,  // 1.0 = fully open, 0.0 = fully closed
    holdTimer: 0,
    chimePending: false,
    doorSoundPending: null, // 'open' | 'close' | null
    buttonBeepPending: false,
    lastIndKey: '',
    cabLight,
    selectFloor: null,
    callToFloor: null,
    openDoorsNow: null,
    closeDoorsNow: null,
    getState: null,
    update: null,
  };

  copBtnSpecs.forEach((spec) => {
    const offMat = makeButtonMat(spec.label, spec.accent, false);
    const onMat = makeButtonMat(spec.label, spec.accent, true);
    const btnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.115, 0.155), offMat);
    btnMesh.position.set(copX + 0.012, spec.y, copZ);
    btnMesh.userData.propId = spec.id;
    cabGroup.add(btnMesh);
    copButtons.set(spec.id, { mesh: btnMesh, offMat, onMat, floor: spec.floor });

    interactiveProps.push({
      id: spec.id,
      floor: 'any_elv', // Always raycastable from inside cab regardless of floor!
      building: 'main',
      isElevatorBtn: true,
      mesh: btnMesh,
      getLabel: () => spec.prompt,
      toggle: () => {
        if (spec.floor !== null) controller.selectFloor(spec.floor);
        else controller.openDoorsNow();
      },
    });
  });

  // =========================================================================
  // 6. FOUR LANDING STATIONS (1F, B1F, B2F, B3F): SYNCHRONIZED HALL DOORS + BIG CALL BUTTONS
  // =========================================================================
  const landingStations = new Map();
  ELEVATOR.stops.forEach((st) => {
    const y0 = st.y;
    const grp = new THREE.Group();
    elvDynamic.add(grp);

    // Brushed Stainless 3-Sided Portal Jamb Frame & Grooved Threshold Sill
    addEBox(elvStatic, 0.14, D.height + 0.06, 0.08, stainlessMat, S.minX - 0.05, y0 + D.height / 2 + 0.03, D.minZ - 0.04);
    addEBox(elvStatic, 0.14, D.height + 0.06, 0.08, stainlessMat, S.minX - 0.05, y0 + D.height / 2 + 0.03, D.maxZ + 0.04);
    addEBox(elvStatic, 0.14, 0.10, D.width + 0.16, stainlessMat, S.minX - 0.05, y0 + D.height + 0.05, doorCz);
    addEBox(elvStatic, 0.12, 0.022, D.width + 0.08, stainlessMat, S.minX - 0.05, y0 + 0.011, doorCz);

    // Synchronized Center-Opening Hall Doors
    const hallL = makeDoorLeaf(true);
    const hallR = makeDoorLeaf(false);
    hallL.position.set(S.minX - 0.03, y0, carDoorLClosedZ);
    hallR.position.set(S.minX - 0.03, y0, carDoorRClosedZ);
    grp.add(hallL, hallR);

    // Live Hall Transom Digital Floor Indicator (facing West -X toward waiting landing)
    const ind = createDigitalIndicator();
    const indBox = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.40), ind.mat);
    indBox.position.set(S.minX - 0.115, y0 + D.height + 0.12, doorCz);
    grp.add(indBox);

    // OVERSIZED Glowing Hall Call Button Panel (right beside door at Z = 2.34, easy to hit!)
    const callId = `elv_call_${st.floor}`;
    const callOffMat = makeButtonMat('呼出', '#38e89e', false);
    const callOnMat = makeButtonMat('呼出', '#38e89e', true);
    addEBox(elvStatic, 0.025, 0.34, 0.22, darkStainlessMat, S.minX - 0.105, y0 + 1.18, 2.36);
    const callMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.19, 0.17), callOffMat);
    callMesh.position.set(S.minX - 0.125, y0 + 1.18, 2.36);
    callMesh.userData.propId = callId;
    grp.add(callMesh);

    interactiveProps.push({
      id: callId,
      floor: st.floor,
      building: 'main',
      isElevatorCall: true,
      mesh: callMesh,
      getLabel: () => (controller.currentStopFloor === st.floor && controller.phase !== 'MOVING'
        ? `エレベーター扉を開く（${st.code} 待機中）`
        : `エレベーターを呼ぶ（現在 ${ELEVATOR.stops.find((x) => x.floor === controller.currentStopFloor)?.code || 'B3'} → ${st.code}）`),
      toggle: () => controller.callToFloor(st.floor),
    });

    landingStations.set(st.floor, {
      stop: st,
      hallL,
      hallR,
      indicator: ind,
      callMesh,
      callOffMat,
      callOnMat,
    });
  });

  // =========================================================================
  // 7. INTERNAL STATIC BATCHING & REAL-TIME MECHANICAL PHYSICS ENGINE
  // =========================================================================
  const { batchedGroup: elvBatched, stats: elvBatchStats } = batchStaticGroups([elvStatic]);
  elvRoot.add(elvBatched);

  const getStopByFloor = (f) => ELEVATOR.stops.find((s) => s.floor === f) || ELEVATOR.stops[ELEVATOR.stops.length - 1];
  const minStopY = -10.20;
  const maxStopY = 0.00;
  const midTravelY = (minStopY + maxStopY) * 0.5; // -5.10 m

  function syncMechanicalPose() {
    cabGroup.position.y = controller.cabY;

    // Counterweight moves in exact opposite vertical phase to the Cab!
    const cwtBottomY = midTravelY - (controller.cabY - midTravelY) - 0.90;
    cwtGroup.position.y = Math.max(S.pitY + 0.78, Math.min(S.topY - 2.02, cwtBottomY));

    // Rotating Main Drive Sheave, Deflector Sheave & Overspeed Governor Wheel!
    const travelRad = controller.cabY / 0.20;
    mainSheave.rotation.z = -travelRad;
    deflectorSheave.rotation.z = -controller.cabY / 0.15;
    governorWheel.rotation.z = travelRad * 1.4;

    // 4 Live Scaling Steel Hoist Wire Ropes (Sheave <-> Cab Hitch & Sheave <-> Counterweight Top!)
    const cabHitchY = controller.cabY + cabH + 0.24;
    const cabRopeLen = Math.max(0.15, sheaveY - cabHitchY);
    const cabRopeMidY = (sheaveY + cabHitchY) * 0.5;
    cabRopes.forEach((r) => {
      r.scale.y = cabRopeLen;
      r.position.y = cabRopeMidY;
    });

    const cwtTopY = cwtGroup.position.y + 1.80;
    const cwtRopeLen = Math.max(0.15, sheaveY - cwtTopY);
    const cwtRopeMidY = (sheaveY + cwtTopY) * 0.5;
    cwtRopes.forEach((r) => {
      r.scale.y = cwtRopeLen;
      r.position.y = cwtRopeMidY;
    });

    // Synchronized Center-Opening Car Door + Mechanically Interlocked Landing Door
    const slideOffset = controller.doorProgress * (leafW - 0.02);
    carDoorL.position.z = carDoorLClosedZ - slideOffset;
    carDoorR.position.z = carDoorRClosedZ + slideOffset;

    landingStations.forEach((stObj, flKey) => {
      const openHere = (flKey === controller.currentStopFloor && controller.phase !== 'MOVING') ? slideOffset : 0;
      stObj.hallL.position.z = carDoorLClosedZ - openHere;
      stObj.hallR.position.z = carDoorRClosedZ + openHere;
      const callLit = controller.targetFloor === flKey && (controller.phase === 'MOVING' || controller.phase === 'CLOSING');
      stObj.callMesh.material = callLit ? stObj.callOnMat : stObj.callOffMat;
    });

    // Update 3D COP Button Illumination
    copButtons.forEach((b) => {
      if (b.floor !== null) {
        const isLit = b.floor === controller.targetFloor && (controller.phase !== 'IDLE_OPEN' || b.floor === controller.currentStopFloor);
        b.mesh.material = isLit ? b.onMat : b.offMat;
      }
    });

    // Redraw Live CanvasTexture Digital Indicators ONLY when floor/dir/phase changes!
    let nearest = ELEVATOR.stops[0];
    let bestD = Infinity;
    for (const s of ELEVATOR.stops) {
      const d = Math.abs(s.y - controller.cabY);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    const dir = controller.phase === 'MOVING'
      ? (controller.velocity > 0.02 ? 1 : (controller.velocity < -0.02 ? -1 : 0))
      : 0;
    const statusTxt = controller.phase === 'MOVING'
      ? (dir > 0 ? 'UP' : 'DN')
      : (controller.phase === 'CLOSING' ? 'CLOS' : (controller.doorProgress > 0.6 ? 'OPEN' : 'STOP'));
    const indKey = `${nearest.code}|${dir}|${statusTxt}`;
    if (indKey !== controller.lastIndKey) {
      controller.lastIndKey = indKey;
      cabIndicator.redraw(nearest.code, dir, statusTxt);
      landingStations.forEach((stObj) => stObj.indicator.redraw(nearest.code, dir, statusTxt));
    }
  }

  controller.selectFloor = (targetFloor) => {
    const stop = getStopByFloor(targetFloor);
    controller.buttonBeepPending = true;
    controller.targetFloor = stop.floor;
    if (stop.floor === controller.currentStopFloor && controller.phase !== 'MOVING') {
      if (controller.phase !== 'OPENING' && controller.doorProgress < 0.99) {
        controller.phase = 'OPENING';
        controller.doorSoundPending = 'open';
      }
      controller.holdTimer = ELEVATOR.holdDuration;
      return;
    }
    if (controller.phase === 'IDLE_OPEN' || controller.phase === 'OPENING') {
      controller.phase = 'CLOSING';
      controller.doorSoundPending = 'close';
    } else if (controller.phase === 'MOVING') {
      // Allow mid-flight target retargeting smoothly!
      controller.targetFloor = stop.floor;
    }
  };

  controller.callToFloor = (floor) => {
    controller.selectFloor(floor);
  };

  controller.openDoorsNow = () => {
    if (controller.phase === 'MOVING') return;
    controller.buttonBeepPending = true;
    controller.phase = 'OPENING';
    controller.doorSoundPending = 'open';
    controller.holdTimer = ELEVATOR.holdDuration;
  };

  controller.closeDoorsNow = () => {
    if (controller.phase === 'MOVING' || controller.doorProgress <= 0.02) return;
    controller.buttonBeepPending = true;
    controller.phase = 'CLOSING';
    controller.doorSoundPending = 'close';
  };

  controller.snapToFloor = (floor, open = true) => {
    const stop = getStopByFloor(floor);
    controller.cabY = stop.y;
    controller.velocity = 0;
    controller.currentStopFloor = stop.floor;
    controller.targetFloor = stop.floor;
    controller.phase = open ? 'IDLE_OPEN' : 'IDLE_CLOSED';
    controller.doorProgress = open ? 1.0 : 0.0;
    controller.holdTimer = ELEVATOR.holdDuration;
    syncMechanicalPose();
  };

  controller.snapMidShaft = (y, targetFloor = 1) => {
    const stop = getStopByFloor(targetFloor);
    controller.cabY = Math.max(minStopY, Math.min(maxStopY, y));
    controller.targetFloor = stop.floor;
    controller.doorProgress = 0.0;
    controller.phase = 'MOVING';
    controller.velocity = stop.y >= controller.cabY ? 1.95 : -1.95;
    syncMechanicalPose();
  };

  controller.getState = () => {
    let nearest = ELEVATOR.stops[0];
    let bestD = Infinity;
    for (const s of ELEVATOR.stops) {
      const d = Math.abs(s.y - controller.cabY);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    return {
      cabY: controller.cabY,
      floorCode: nearest.code,
      currentStopFloor: controller.currentStopFloor,
      targetFloor: controller.targetFloor,
      phase: controller.phase,
      doorProgress: controller.doorProgress,
      speedMs: Math.abs(controller.velocity),
      dir: controller.phase === 'MOVING' ? Math.sign(controller.velocity) : 0,
    };
  };

  controller.update = (dtSec) => {
    const dt = Math.max(0, Math.min(0.05, dtSec));
    if (controller.phase === 'IDLE_OPEN') {
      controller.velocity = 0;
      controller.doorProgress = 1.0;
      if (controller.targetFloor !== controller.currentStopFloor) {
        controller.phase = 'CLOSING';
        controller.doorSoundPending = 'close';
      }
    } else if (controller.phase === 'CLOSING') {
      controller.velocity = 0;
      controller.doorProgress = Math.max(0, controller.doorProgress - dt / ELEVATOR.doorDuration);
      if (controller.doorProgress <= 0.001) {
        controller.doorProgress = 0;
        if (controller.targetFloor !== controller.currentStopFloor) {
          controller.phase = 'MOVING';
        } else {
          // Stay closed momentarily or remain closed until called
          controller.phase = 'IDLE_CLOSED';
        }
      }
    } else if (controller.phase === 'IDLE_CLOSED') {
      controller.velocity = 0;
      if (controller.targetFloor !== controller.currentStopFloor) {
        controller.phase = 'MOVING';
      }
    } else if (controller.phase === 'MOVING') {
      const targetY = getStopByFloor(controller.targetFloor).y;
      const dist = targetY - controller.cabY;
      const dir = Math.sign(dist);
      const absDist = Math.abs(dist);
      // Smooth S-curve braking envelope: v_stop = sqrt(2 * accel * dist)
      const brakeSpeed = Math.sqrt(2 * ELEVATOR.accel * absDist);
      const desiredSpeed = Math.min(ELEVATOR.maxSpeed, brakeSpeed) * dir;
      const dv = desiredSpeed - controller.velocity;
      const maxDv = ELEVATOR.accel * 1.35 * dt;
      controller.velocity = Math.max(-ELEVATOR.maxSpeed, Math.min(ELEVATOR.maxSpeed, controller.velocity + Math.max(-maxDv, Math.min(maxDv, dv))));
      controller.cabY = Math.max(minStopY, Math.min(maxStopY, controller.cabY + controller.velocity * dt));

      if (absDist < 0.025 && Math.abs(controller.velocity) < 0.25) {
        controller.cabY = targetY;
        controller.velocity = 0;
        controller.currentStopFloor = controller.targetFloor;
        controller.phase = 'OPENING';
        controller.chimePending = true;
        controller.doorSoundPending = 'open';
        controller.holdTimer = ELEVATOR.holdDuration;
      }
    } else if (controller.phase === 'OPENING') {
      controller.velocity = 0;
      controller.doorProgress = Math.min(1, controller.doorProgress + dt / ELEVATOR.doorDuration);
      if (controller.doorProgress >= 0.999) {
        controller.doorProgress = 1.0;
        controller.phase = 'IDLE_OPEN';
      }
    }

    syncMechanicalPose();
  };

  // Initialize parked cleanly at B3F (-10.20m) with doors welcomingly open!
  syncMechanicalPose();
  controller.batchStats = elvBatchStats;
  return controller;
}
