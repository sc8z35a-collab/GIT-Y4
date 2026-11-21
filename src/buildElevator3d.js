import * as THREE from 'three';
import { ELEVATOR } from './deepBasementData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the Hyper-Realistic Mechanical MRL Gearless Traction Elevator ("ELV-1 Mark II"):
 * - Penetrates 5 Floors Vertically: B4F Secret Lab (-14.20m) <-> B3F (-10.20m) <-> B2F (-6.60m) <-> B1F (-2.40m) <-> 1F Ground (0.00m)
 * - Total Vertical Shaft: 18.32 m (Pit -15.60m -> Top MRL Machine Deck +2.72m), Travel: 14.20 m
 * - Extreme Real-World Mechanical Hardware:
 *   * Reinforced Pit (-15.60m) with dual hydraulic oil piston buffers, pit steel ladder, pit stop box & weighted governor tension sheave
 *   * Full-height bolted T-section car guide rails & counterweight guide rails + 1.0m shaft depth scale markers + backlit stencils
 *   * Top Gearless PM Traction Motor with PHYSICALLY MOVING Electromagnetic Dual-Shoe Disc Brake Calipers & Coil LED
 *   * Synchronized Rotating 6-Spoke Main Traction Sheave, Deflector Sheave, Overspeed Governor Pulley & Pit Tension Pulley
 *   * 4 Dynamic Steel Hoist Wire Ropes + Governor Rope Loop + Live Catenary Flat Traveling Control Cable (テールコード) + Compensating Chain
 *   * Opposite-Phase 9-Slab Counterweight with Roller Guide Shoes & Amber Beacon (clearly visible through cab rear panoramic glass!)
 *   * Car Sling with Safety Gear Wedges, 4 Spinning Roller Guide Shoes, 4 Spring-Loaded Rope Hitch Shackles & Visible Door-Operator Crank Linkage
 *   * S-Curve Eased Center-Opening Car Doors + Interlocked Hall Doors on all 5 Floors + Infrared Light-Curtain Safety Edge (Auto-Reopen!)
 *   * Live High-Res CanvasTexture OLED Indicators (Floor, Direction Chevron, Speed m/s, Elevation m, Phase) + 5-Stop 3D COP & Hall Call Panels
 * - True 7-Phase Jerk-Limited S-Curve Motion Physics:
 *   * IDLE_OPEN -> DOOR_CLOSING -> BRAKE_RELEASE -> RUNNING (jerk 2.6m/s³, a_max 1.35m/s², v_max 2.40m/s) -> RELEVELING (micro-leveling + damped settle bounce!) -> DOOR_OPENING -> IDLE_OPEN
 *   * Multi-floor collective call queue + subtle rail-joint & landing spring settle motion coupling for first-person realism!
 */
export function buildElevator3D(ctx) {
  const {
    scene,
    interactiveProps,
    interiorLights,
  } = ctx;

  const S = ELEVATOR.shaft; // minX:3.25, maxX:4.85, minZ:0.85, maxZ:2.65, pitY:-15.60, topY:2.72
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
  elvRoot.name = 'RealTractionElevatorELV1_Mk2';
  scene.add(elvRoot);

  const elvStatic = new THREE.Group();
  const elvDynamic = new THREE.Group();
  elvRoot.add(elvDynamic);

  // --- Dedicated Architectural & Precision Mechanical Materials ---
  const shaftConcMat = makeSurfaceMat('concrete_pcon', 2.0, 5.2);
  const shaftDarkConcMat = makeSurfaceMat('concrete_clean', 2.0, 2.0, { color: 0x565c63 });
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xc2cbd4, roughness: 0.24, metalness: 0.84 });
  const darkStainlessMat = new THREE.MeshStandardMaterial({ color: 0x525a64, roughness: 0.34, metalness: 0.80 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.40, metalness: 0.76 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x909aa4, roughness: 0.34, metalness: 0.86 });
  const flatCableMat = new THREE.MeshStandardMaterial({ color: 0x1e242c, roughness: 0.82, metalness: 0.12 });
  const motorGreenMat = new THREE.MeshStandardMaterial({ color: 0x244642, roughness: 0.42, metalness: 0.50 });
  const brakeRedMat = new THREE.MeshStandardMaterial({ color: 0xc42824, roughness: 0.36, metalness: 0.38 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xebb724, roughness: 0.42, metalness: 0.20 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a35b, roughness: 0.28, metalness: 0.84 });
  const rubberEdgeMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.90, metalness: 0.04 });
  const lightCurtainIdleMat = new THREE.MeshStandardMaterial({ color: 0x1f2830, emissive: new THREE.Color(0x0c3448), emissiveIntensity: 0.45, roughness: 0.3 });
  const lightCurtainWarnMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: new THREE.Color(0xf59e0b), emissiveIntensity: 1.8, roughness: 0.25 });
  const lightCurtainAlertMat = new THREE.MeshStandardMaterial({ color: 0xff5a5a, emissive: new THREE.Color(0xef4444), emissiveIntensity: 2.2, roughness: 0.2 });
  const brakeLedLockedMat = new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: new THREE.Color(0xdc2626), emissiveIntensity: 1.8 });
  const brakeLedOpenMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: new THREE.Color(0x22c55e), emissiveIntensity: 1.8 });
  const graniteFloorMat = makeSurfaceMat('tile_grey_stone', 1.3, 1.5, { color: 0x626770, roughness: 0.34 });
  const walnutPanelMat = makeSurfaceMat('wood_walnut_floor', 1.2, 1.4, { roughness: 0.46 });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0xdce6f0, roughness: 0.05, metalness: 0.95 });
  const obsGlassMat = new THREE.MeshStandardMaterial({
    color: 0xaed0e8,
    roughness: 0.08,
    metalness: 0.14,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const cabCeilGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff8ec,
    emissive: new THREE.Color(0xffe9c7),
    emissiveIntensity: 1.50,
    roughness: 0.24,
  });
  const shaftBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffd599,
    emissive: new THREE.Color(0xff9e3d),
    emissiveIntensity: 1.65,
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

  // Helper: Procedural Glowing Tactile Elevator Button Faceplate Texture
  function makeButtonMat(label, accentHex = '#f5b041', isLit = false, subText = '') {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({
        color: isLit ? 0xffc857 : 0x2a313a,
        emissive: isLit ? 0xf59e0b : 0x11151a,
        emissiveIntensity: isLit ? 1.4 : 0.25,
      });
    }
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = isLit ? '#261a0c' : '#14181e';
    c.fillRect(0, 0, 128, 128);
    // Machined metallic bezel
    c.strokeStyle = isLit ? accentHex : '#64748b';
    c.lineWidth = isLit ? 11 : 6;
    c.beginPath();
    c.arc(64, 64, 52, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = isLit ? '#fff9eb' : '#dbe3ec';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = label.length <= 2 ? '800 42px sans-serif' : '800 28px sans-serif';
    c.fillText(label, 64, subText ? 54 : 65);
    if (subText) {
      c.fillStyle = isLit ? accentHex : '#8aa0b8';
      c.font = '700 17px monospace';
      c.fillText(subText, 64, 92);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(isLit ? accentHex : '#748da8'),
      emissiveIntensity: isLit ? 1.55 : 0.42,
      roughness: 0.26,
      metalness: 0.36,
    });
  }

  // Helper: Manufacturer & Spec Engraved Brass/Steel Nameplate inside Cab COP
  function makeSpecPlaqueMat() {
    if (typeof document === 'undefined') return darkStainlessMat;
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#141920';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#9aa8b8';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 120);
    c.fillStyle = '#38bdf8';
    c.font = '800 24px monospace';
    c.textAlign = 'center';
    c.fillText('MITSU-TECH MRL-900', 128, 36);
    c.fillStyle = '#e2e8f0';
    c.font = '700 20px sans-serif';
    c.fillText('定員 9名 / 積載 600kg', 128, 72);
    c.fillStyle = '#f59e0b';
    c.font = '700 16px monospace';
    c.fillText('1F - B4F [CLASSIFIED LAB]', 128, 104);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x6688aa),
      emissiveIntensity: 0.55,
      roughness: 0.30,
      metalness: 0.60,
    });
  }

  // Helper: Live High-Res Redrawable OLED Digital Floor, Direction, Speed & Depth Display
  function createDigitalIndicator() {
    const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (cv) {
      cv.width = 384;
      cv.height = 128;
    }
    const tex = cv ? new THREE.CanvasTexture(cv) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const matInd = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffc978),
      emissiveIntensity: 1.30,
      roughness: 0.18,
    });
    const redraw = (floorCode, dir, statusText = 'STOP', speedMs = 0, elevM = -10.2) => {
      if (!cv) return;
      const c = cv.getContext('2d');
      c.fillStyle = '#070a0f';
      c.fillRect(0, 0, 384, 128);
      c.strokeStyle = floorCode === 'B4' ? '#dc2626' : '#334155';
      c.lineWidth = 4;
      c.strokeRect(3, 3, 378, 122);

      // Left Directional Glowing Arrow
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 54px monospace';
      if (dir > 0) {
        c.fillStyle = '#38e89e';
        c.fillText('▲', 48, 64);
      } else if (dir < 0) {
        c.fillStyle = '#f97316';
        c.fillText('▼', 48, 64);
      } else {
        c.fillStyle = floorCode === 'B4' ? '#f43f5e' : '#64748b';
        c.fillText('●', 48, 64);
      }

      // Main Crisp Floor Code
      c.fillStyle = floorCode === '1F' ? '#5ef2b3' : (floorCode === 'B4' ? '#ff6b81' : '#ffc459');
      c.font = '800 68px monospace';
      c.fillText(floorCode, 152, 66);

      // Divider
      c.strokeStyle = '#253140';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(228, 16); c.lineTo(228, 112); c.stroke();

      // Right Live Telemetry Readout (Phase + Velocity + Elevation!)
      c.textAlign = 'left';
      c.fillStyle = statusText === 'RUN' ? '#38bdf8' : (statusText === 'LVL' ? '#f59e0b' : '#cbd5e1');
      c.font = '800 22px monospace';
      c.fillText(statusText, 242, 34);
      c.fillStyle = '#94a3b8';
      c.font = '700 20px monospace';
      c.fillText(`${speedMs.toFixed(1)} m/s`, 242, 68);
      c.fillStyle = floorCode === 'B4' ? '#fb7185' : '#eab308';
      c.font = '700 20px monospace';
      c.fillText(`${elevM >= 0 ? '+' : ''}${elevM.toFixed(1)}m`, 242, 100);
      tex.needsUpdate = true;
    };
    redraw('B3', 0, 'OPEN', 0, -10.2);
    return { mat: matInd, redraw };
  }

  // Helper: Backlit Shaft Wall Floor Stencil ("1F", "B1", "B2", "B3", "B4 LAB")
  function makeShaftStencilMat(code, elevText, isClassified = false) {
    if (typeof document === 'undefined') return shaftConcMat;
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = isClassified ? '#1d1216' : '#23282e';
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = isClassified ? '#e11d48' : '#e8b423';
    c.fillRect(0, 0, 256, 12);
    c.fillRect(0, 116, 256, 12);
    c.fillStyle = isClassified ? '#ffe4e6' : '#f2ede2';
    c.textAlign = 'center';
    c.font = '800 54px monospace';
    c.fillText(code, 128, 64);
    c.fillStyle = isClassified ? '#fb7185' : '#e8b423';
    c.font = '700 21px monospace';
    c.fillText(elevText, 128, 100);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(isClassified ? 0x7c1d30 : 0x5a4c32),
      emissiveIntensity: isClassified ? 0.65 : 0.45,
      roughness: 0.70,
    });
  }

  // =========================================================================
  // 1. FULL-HEIGHT 18.32m HOISTWAY CONCRETE SHAFT, DEEP PIT BUFFERS, RAILS & SCALES
  // =========================================================================
  const totalShaftH = S.topY - S.pitY; // 18.32 m!
  const midShaftY = (S.topY + S.pitY) / 2;

  // Deep Pit Concrete Floor (-15.60) & Top Shaft Cap (+2.72)
  addEBox(elvStatic, shaftW + 0.26, 0.24, shaftD + 0.26, shaftDarkConcMat, shaftCx, S.pitY - 0.12, shaftCz);
  addEBox(elvStatic, shaftW + 0.26, 0.08, shaftD + 0.26, shaftDarkConcMat, shaftCx, S.topY + 0.04, shaftCz);
  // East, North, South Full-Height Reinforced Concrete Shaft Walls
  addEBox(elvStatic, 0.16, totalShaftH, shaftD + 0.24, shaftConcMat, S.maxX + 0.08, midShaftY, shaftCz);
  addEBox(elvStatic, shaftW + 0.24, totalShaftH, 0.14, shaftConcMat, shaftCx, midShaftY, S.minZ - 0.07);
  addEBox(elvStatic, shaftW + 0.24, totalShaftH, 0.14, shaftConcMat, shaftCx, midShaftY, S.maxZ + 0.07);

  // West Front Shaft Wall (X = 3.20..3.30): Solid Piers North & South of the 0.90m Door Slot + Solid Inter-Floor Spandrels!
  addEBox(elvStatic, 0.10, totalShaftH, D.minZ - S.minZ + 0.04, shaftConcMat, S.minX - 0.05, midShaftY, (S.minZ + D.minZ) / 2 - 0.02);
  addEBox(elvStatic, 0.10, totalShaftH, S.maxZ - D.maxZ + 0.04, shaftConcMat, S.minX - 0.05, midShaftY, (D.maxZ + S.maxZ) / 2 + 0.02);

  // Vertical Spandrel Segments + Hoistway Mechanical Door Interlock Hooks & Slowdown Limit Cams between all 5 stops!
  const stopYsAsc = [...ELEVATOR.stops].sort((a, b) => a.y - b.y);
  let curY = S.pitY;
  for (const st of stopYsAsc) {
    const segH = st.y - curY;
    if (segH > 0.02) {
      addEBox(elvStatic, 0.10, segH, D.width, shaftConcMat, S.minX - 0.05, curY + segH / 2, doorCz);
    }
    // Mechanical Door Interlock Roller Hook & Floor Leveling Magnetic Inductor Vane inside Hoistway!
    addEBox(elvStatic, 0.06, 0.12, 0.16, safetyYellowMat, S.minX + 0.04, st.y + D.height + 0.06, doorCz + 0.24);
    addEBox(elvStatic, 0.04, 0.34, 0.04, brakeRedMat, S.minX + 0.04, st.y + 0.18, S.minZ + 0.16);
    curY = st.y + D.height;
  }
  // Top Transom Spandrel above 1F Door (Y = 2.10..2.72) — Glass Inspection Window into the Live MRL Drive Machine & Brake!
  addEBox(elvStatic, 0.10, 0.14, D.width, darkStainlessMat, S.minX - 0.05, 2.17, doorCz);
  addEBox(elvStatic, 0.02, 0.46, D.width - 0.06, obsGlassMat, S.minX - 0.05, 2.47, doorCz);

  // Deep Pit (-15.60m) Dual Hydraulic Oil Piston Buffers + Safety Pit Ladder + Pit Stop Switch + Sump Grate!
  const buildHydraulicBuffer = (bx, bz) => {
    addEBox(elvStatic, 0.32, 0.09, 0.32, railSteelMat, bx, S.pitY + 0.045, bz);
    const outerCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.56, 12), brakeRedMat);
    outerCyl.position.set(bx, S.pitY + 0.36, bz);
    elvStatic.add(outerCyl);
    const chromePlunger = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.36, 10), stainlessMat);
    chromePlunger.position.set(bx, S.pitY + 0.72, bz);
    elvStatic.add(chromePlunger);
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 6, 14), safetyYellowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(bx, S.pitY + 0.20 + i * 0.10, bz);
      elvStatic.add(ring);
    }
    const strikePad = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.055, 12), rubberEdgeMat);
    strikePad.position.set(bx, S.pitY + 0.92, bz);
    elvStatic.add(strikePad);
  };
  buildHydraulicBuffer(cabCx, cabCz);
  buildHydraulicBuffer(4.68, cabCz);

  // Pit Steel Access Ladder & Pit Emergency Stop Box
  addEBox(elvStatic, 0.03, 2.40, 0.03, safetyYellowMat, 3.34, S.pitY + 1.20, 0.94);
  addEBox(elvStatic, 0.03, 2.40, 0.03, safetyYellowMat, 3.68, S.pitY + 1.20, 0.94);
  for (let ry = S.pitY + 0.25; ry < S.pitY + 2.35; ry += 0.28) {
    addEBox(elvStatic, 0.34, 0.025, 0.025, safetyYellowMat, 3.51, ry, 0.94);
  }
  addEBox(elvStatic, 0.08, 0.20, 0.12, brakeRedMat, 3.34, S.pitY + 1.45, 1.15);
  addEBox(elvStatic, 0.44, 0.02, 0.44, railSteelMat, 3.70, S.pitY + 0.01, 2.25); // Pit sump grate

  // 2 Full-Height T-Section Car Guide Rails (North Z=0.91, South Z=2.59 at X=cabCx) + Bolted Fishplates & Wall Brackets!
  [S.minZ + 0.06, S.maxZ - 0.06].forEach((rzRail) => {
    const dir = rzRail < shaftCz ? 1 : -1;
    addEBox(elvStatic, 0.11, totalShaftH - 0.25, 0.026, railSteelMat, cabCx, midShaftY, rzRail);
    addEBox(elvStatic, 0.028, totalShaftH - 0.25, 0.078, stainlessMat, cabCx, midShaftY, rzRail + dir * 0.044);
    for (let by = S.pitY + 0.6; by <= S.topY - 0.3; by += 1.35) {
      addEBox(elvStatic, 0.38, 0.055, 0.065, darkStainlessMat, cabCx, by, rzRail - dir * 0.02);
    }
  });
  // 2 Full-Height Counterweight Guide Rails along East Rear Shaft Wall (X = 4.76, Z = 1.24 & 2.26)
  [1.24, 2.26].forEach((czRail) => {
    addEBox(elvStatic, 0.048, totalShaftH - 0.25, 0.048, railSteelMat, 4.76, midShaftY, czRail);
    for (let by = S.pitY + 0.8; by <= S.topY - 0.4; by += 1.50) {
      addEBox(elvStatic, 0.11, 0.045, 0.13, darkStainlessMat, 4.80, by, czRail);
    }
  });

  // 1.0m Depth Scale Horizontal Reference Ticks along East Shaft Wall (gives thrilling sense of speed!)
  for (let my = -14; my <= 1; my += 1) {
    const isMajor = my === 0 || my === -10 || my === -14;
    addEBox(elvStatic, 0.012, isMajor ? 0.032 : 0.016, isMajor ? 0.72 : 0.36, isMajor ? safetyYellowMat : darkStainlessMat, S.maxX - 0.012, my, cabCz);
  }

  // Backlit Stenciled Shaft Floor Markers (1F, B1, B2, B3, B4 LAB) + Caged Inspection Lights!
  ELEVATOR.stops.forEach((st) => {
    const sub = st.classified ? `${st.y.toFixed(1)}m [LAB]` : `${st.y >= 0 ? '+' : ''}${st.y.toFixed(1)}m`;
    const stMat = makeShaftStencilMat(st.code, sub, Boolean(st.classified));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.76), stMat);
    sign.position.set(S.maxX - 0.015, st.y + 1.55, cabCz);
    sign.userData.noBatch = true;
    elvDynamic.add(sign);
  });
  for (let ly = -14.0; ly <= 2.10; ly += 2.65) {
    addEBox(elvStatic, 0.06, 0.22, 0.10, railSteelMat, 4.78, ly, 1.02);
    addEBox(elvStatic, 0.04, 0.16, 0.07, shaftBulbMat, 4.74, ly, 1.02);
  }

  // =========================================================================
  // 2. TOP MRL GEARLESS PM TRACTION DRIVE MACHINE, MOVING BRAKE CALIPERS & GOVERNOR SYSTEM
  // =========================================================================
  const sheaveY = 2.48;
  // Twin Heavy Steel Machine Bed I-Beams & VVVF Inverter Control Cabinet
  addEBox(elvStatic, shaftW - 0.06, 0.095, 0.085, railSteelMat, shaftCx, 2.34, 1.48);
  addEBox(elvStatic, shaftW - 0.06, 0.095, 0.085, railSteelMat, shaftCx, 2.34, 2.02);
  addEBox(elvStatic, 0.18, 0.52, 0.42, darkStainlessMat, S.maxX - 0.14, 2.15, S.maxZ - 0.30); // VVVF Inverter Cabinet

  // Gearless PM Traction Motor Cylinder + Cooling Fins
  const motorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.38, 18), motorGreenMat);
  motorMesh.rotation.x = Math.PI / 2;
  motorMesh.position.set(cabCx - 0.24, sheaveY, cabCz);
  elvStatic.add(motorMesh);
  for (let fi = -2; fi <= 2; fi++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.016, 16), darkStainlessMat);
    fin.rotation.x = Math.PI / 2;
    fin.position.set(cabCx - 0.24, sheaveY, cabCz + fi * 0.065);
    elvStatic.add(fin);
  }

  // PHYSICALLY MOVING Dual-Shoe Electromagnetic Disc Brake Calipers + Status Coil LED!
  const brakeArmL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), brakeRedMat);
  const brakeArmR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), brakeRedMat);
  brakeArmL.position.set(cabCx - 0.24, sheaveY + 0.10, cabCz - 0.21);
  brakeArmR.position.set(cabCx - 0.24, sheaveY + 0.10, cabCz + 0.21);
  const brakeLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), brakeLedLockedMat);
  brakeLedMesh.position.set(cabCx - 0.34, sheaveY + 0.20, cabCz);
  elvDynamic.add(brakeArmL, brakeArmR, brakeLedMesh);

  // Rotating 6-Spoke Grooved Sheave Builder
  const makeGroovedSheave = (radius, spokeCount = 3) => {
    const grp = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.14, 24), darkStainlessMat);
    wheel.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.022, 8, 24), stainlessMat);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.18, 12), brassMat);
    hub.rotation.x = Math.PI / 2;
    grp.add(wheel, rim, hub);
    for (let s = 0; s < spokeCount; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.86, 0.030, 0.155), safetyYellowMat);
      spoke.rotation.z = (s * Math.PI) / spokeCount;
      grp.add(spoke);
    }
    return grp;
  };
  const mainSheave = makeGroovedSheave(0.20, 3);
  mainSheave.position.set(cabCx, sheaveY, cabCz);
  elvDynamic.add(mainSheave);

  const deflectorSheave = makeGroovedSheave(0.15, 2);
  deflectorSheave.position.set(4.68, sheaveY, cabCz);
  elvDynamic.add(deflectorSheave);

  // Top Overspeed Governor Wheel + Pit Tension Sheave & Weighted Tension Arm (-15.20m) + Full Governor Cable Loop!
  const govZ = S.minZ + 0.18;
  const governorWheel = makeGroovedSheave(0.11, 2);
  governorWheel.position.set(cabCx, sheaveY, govZ);
  elvDynamic.add(governorWheel);

  const pitTensionY = S.pitY + 0.42;
  const pitTensionWheel = makeGroovedSheave(0.11, 2);
  pitTensionWheel.position.set(cabCx, pitTensionY, govZ);
  elvDynamic.add(pitTensionWheel);
  addEBox(elvStatic, 0.26, 0.14, 0.14, railSteelMat, cabCx + 0.22, pitTensionY - 0.16, govZ); // Tension weight block
  // Full-height continuous governor steel cable loop (top -> pit)
  const govCableLen = sheaveY - pitTensionY;
  const govCableGeo = new THREE.CylinderGeometry(0.005, 0.005, govCableLen, 5);
  [-0.09, 0.09].forEach((gxOff) => {
    const gc = new THREE.Mesh(govCableGeo, cableMat);
    gc.position.set(cabCx + gxOff, (sheaveY + pitTensionY) * 0.5, govZ);
    elvStatic.add(gc);
  });

  // Horizontal Bridge Ropes spanning Main Drive Sheave -> Deflector Sheave
  [-0.045, -0.015, 0.015, 0.045].forEach((rzOff) => {
    addEBox(elvStatic, 4.68 - cabCx, 0.012, 0.012, cableMat, (cabCx + 4.68) / 2, sheaveY + 0.17, cabCz + rzOff);
  });

  // =========================================================================
  // 3. LIVE MOVING COUNTERWEIGHT (CWT), 4 HOIST ROPES, CATENARY TRAVELING CABLE & COMP CHAIN
  // =========================================================================
  const cwtGroup = new THREE.Group();
  cwtGroup.name = 'ElevatorCounterweight';
  addEBox(cwtGroup, 0.12, 1.84, 0.06, railSteelMat, 0, 0.92, -0.48);
  addEBox(cwtGroup, 0.12, 1.84, 0.06, railSteelMat, 0, 0.92, 0.48);
  addEBox(cwtGroup, 0.16, 0.10, 1.06, safetyYellowMat, 0, 1.82, 0);
  addEBox(cwtGroup, 0.16, 0.10, 1.06, safetyYellowMat, 0, 0.04, 0);
  // 4 Guide Shoes gripping the rear counterweight guide rails + glowing amber counterweight beacon
  [0.10, 1.74].forEach((gy) => {
    [-0.50, 0.50].forEach((gz) => {
      addEBox(cwtGroup, 0.10, 0.14, 0.08, brakeRedMat, 0.05, gy, gz);
    });
  });
  addEBox(cwtGroup, 0.02, 0.06, 0.72, shaftBulbMat, -0.085, 0.92, 0);
  for (let i = 0; i < 9; i++) {
    addEBox(cwtGroup, 0.12, 0.15, 0.88, i % 2 === 0 ? darkStainlessMat : stainlessMat, 0, 0.18 + i * 0.175, 0);
  }
  cwtGroup.position.set(4.68, -4.0, cabCz);
  elvDynamic.add(cwtGroup);

  // 4 Live Scaling Steel Hoist Wire Ropes (Sheave <-> Cab Hitch & Sheave <-> CWT Top)
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

  // Dynamic Flat Traveling Control Cable (テールコード) hanging from Cab Underside -> Mid-Shaft Junction Box (Y = -7.0m)!
  const midJunctionY = -7.00;
  addEBox(elvStatic, 0.08, 0.34, 0.24, darkStainlessMat, S.maxX - 0.05, midJunctionY, S.maxZ - 0.24);
  const travUnitGeo = new THREE.BoxGeometry(0.014, 1.0, 0.075);
  const travWallLeg = new THREE.Mesh(travUnitGeo, flatCableMat);
  travWallLeg.position.set(S.maxX - 0.10, midJunctionY, S.maxZ - 0.24);
  const travCabLeg = new THREE.Mesh(travUnitGeo, flatCableMat);
  travCabLeg.position.set(C.maxX - 0.14, midJunctionY, S.maxZ - 0.24);
  const travLoopArc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 12, Math.PI), flatCableMat);
  travLoopArc.rotation.z = Math.PI;
  travLoopArc.position.set((S.maxX - 0.10 + C.maxX - 0.14) * 0.5, midJunctionY - 1.0, S.maxZ - 0.24);
  elvDynamic.add(travWallLeg, travCabLeg, travLoopArc);

  // Compensating Chain dropping from Cab Underside to Pit Loop
  const compCable = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 6), railSteelMat);
  compCable.position.set(cabCx + 0.30, -10, cabCz);
  elvDynamic.add(compCable);

  // =========================================================================
  // 4. HYPER-DETAILED MOVING ELEVATOR CAB (SLING, ROLLER SHOES, DOOR OPERATOR, COP & GLASS)
  // =========================================================================
  const cabGroup = new THREE.Group();
  cabGroup.name = 'ElevatorCab';
  elvDynamic.add(cabGroup);

  // Heavy Car Sling Safety Plank + Progressive Wedge Safety Gear Housings + Floor Platform
  addEBox(cabGroup, cabW + 0.10, 0.14, cabD + 0.10, railSteelMat, cabCx, -0.07, cabCz);
  // Progressive Wedge Safety Gear Blocks gripping both North & South T-Rails
  [S.minZ + 0.10, S.maxZ - 0.10].forEach((sz) => {
    addEBox(cabGroup, 0.22, 0.18, 0.12, brakeRedMat, cabCx, -0.10, sz);
  });
  // 4 Spinning Spring-Loaded Roller Guide Shoes (Top & Bottom on both T-Rails!)
  const guideRollers = [];
  const rollerGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10);
  [S.minZ + 0.11, S.maxZ - 0.11].forEach((rz) => {
    [-0.12, cabH + 0.16].forEach((ry) => {
      addEBox(cabGroup, 0.20, 0.08, 0.10, safetyYellowMat, cabCx, ry, rz);
      const rMesh = new THREE.Mesh(rollerGeo, rubberEdgeMat);
      rMesh.rotation.x = Math.PI / 2;
      rMesh.position.set(cabCx, ry, rz);
      cabGroup.add(rMesh);
      guideRollers.push(rMesh);
    });
  });

  // Flamed Dark Granite Floor + Brass Perimeter Inlay + Grooved Aluminum Threshold Sill
  addEBox(cabGroup, cabW, 0.02, cabD, graniteFloorMat, cabCx, 0.01, cabCz);
  addEBox(cabGroup, cabW - 0.14, 0.022, 0.02, brassMat, cabCx, 0.011, C.minZ + 0.08);
  addEBox(cabGroup, cabW - 0.14, 0.022, 0.02, brassMat, cabCx, 0.011, C.maxZ - 0.08);
  addEBox(cabGroup, 0.085, 0.024, D.width + 0.08, stainlessMat, C.minX - 0.02, 0.012, doorCz);

  // Structural Roof Cap + Crosshead I-Beam + 4 Individual Spring-Loaded Rope Hitch Shackles!
  addEBox(cabGroup, cabW + 0.08, 0.08, cabD + 0.08, darkStainlessMat, cabCx, cabH + 0.04, cabCz);
  addEBox(cabGroup, 0.20, 0.16, cabD + 0.22, railSteelMat, cabCx, cabH + 0.14, cabCz);
  [-0.045, -0.015, 0.015, 0.045].forEach((rzOff) => {
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), safetyYellowMat);
    spring.position.set(cabCx, cabH + 0.25, cabCz + rzOff);
    cabGroup.add(spring);
  });

  // VISIBLE ANIMATED DOOR OPERATOR MOTOR & CRANK LINKAGE ARM ON CAB FRONT HEADER!
  addEBox(cabGroup, 0.12, 0.12, 0.26, motorGreenMat, C.minX + 0.02, cabH + 0.15, doorCz);
  const doorOpWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 14), safetyYellowMat);
  doorOpWheel.rotation.z = Math.PI / 2;
  doorOpWheel.position.set(C.minX - 0.05, cabH + 0.15, doorCz);
  const doorArmBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.028, 0.36), stainlessMat);
  doorArmBar.position.set(C.minX - 0.06, cabH + 0.15, doorCz);
  cabGroup.add(doorOpWheel, doorArmBar);

  // Architectural Coffered Luminous Ceiling + Ventilation Grille + Mini Security CCTV Dome
  addEBox(cabGroup, cabW - 0.16, 0.03, cabD - 0.20, cabCeilGlowMat, cabCx, cabH - 0.015, cabCz);
  addEBox(cabGroup, cabW - 0.12, 0.045, 0.045, stainlessMat, cabCx, cabH - 0.022, cabCz);
  addEBox(cabGroup, 0.045, 0.045, cabD - 0.18, stainlessMat, cabCx, cabH - 0.022, cabCz);
  const cabCctv = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), rubberEdgeMat);
  cabCctv.position.set(C.maxX - 0.10, cabH - 0.035, C.minZ + 0.10);
  cabGroup.add(cabCctv);

  // Side Walls (North Z=1.02, South Z=2.48): Hairline Stainless Lower + Warm Walnut Upper + Stainless Handrails!
  [C.minZ, C.maxZ].forEach((wz) => {
    const inward = wz < cabCz ? 1 : -1;
    addEBox(cabGroup, cabW, 0.92, 0.04, stainlessMat, cabCx, 0.46, wz - inward * 0.02);
    addEBox(cabGroup, cabW, cabH - 0.92, 0.04, walnutPanelMat, cabCx, 0.92 + (cabH - 0.92) / 2, wz - inward * 0.02);
    addEBox(cabGroup, cabW - 0.04, 0.10, 0.015, darkStainlessMat, cabCx, 0.06, wz + inward * 0.01);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cabW - 0.16, 10), stainlessMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(cabCx, 0.90, wz + inward * 0.065);
    cabGroup.add(bar);
    [-0.42, 0.42].forEach((bxOff) => {
      addEBox(cabGroup, 0.025, 0.025, 0.065, darkStainlessMat, cabCx + bxOff, 0.90, wz + inward * 0.032);
    });
  });
  // Framed Architectural Vanity Mirror on North Wall
  addEBox(cabGroup, 0.78, 0.96, 0.018, stainlessMat, cabCx, 1.52, C.minZ + 0.012);
  addEBox(cabGroup, 0.72, 0.90, 0.014, mirrorGlassMat, cabCx, 1.52, C.minZ + 0.018);

  // Rear East Wall (X = 4.58): Full Panoramic Tempered Shaft Observation Window (H = 0.96..2.12 -> watch CWT, rails, depth ticks & cables!)
  addEBox(cabGroup, 0.04, 0.96, cabD, stainlessMat, C.maxX + 0.02, 0.48, cabCz);
  addEBox(cabGroup, 0.04, cabH - 0.96, 0.18, darkStainlessMat, C.maxX + 0.02, 0.96 + (cabH - 0.96) / 2, C.minZ + 0.09);
  addEBox(cabGroup, 0.04, cabH - 0.96, 0.18, darkStainlessMat, C.maxX + 0.02, 0.96 + (cabH - 0.96) / 2, C.maxZ - 0.09);
  addEBox(cabGroup, 0.04, 0.12, cabD, darkStainlessMat, C.maxX + 0.02, cabH - 0.06, cabCz);
  addEBox(cabGroup, 0.016, 1.16, cabD - 0.36, obsGlassMat, C.maxX + 0.01, 1.54, cabCz);
  addEBox(cabGroup, 0.03, 0.03, cabD - 0.36, stainlessMat, C.maxX, 0.96, cabCz);
  addEBox(cabGroup, 0.03, 0.03, cabD - 0.36, stainlessMat, C.maxX, 2.12, cabCz);
  const rearBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, cabD - 0.24, 10), stainlessMat);
  rearBar.rotation.x = Math.PI / 2;
  rearBar.position.set(C.maxX - 0.065, 0.90, cabCz);
  cabGroup.add(rearBar);

  // Front West Cab Wall Return Panels & Transom Header
  addEBox(cabGroup, 0.04, cabH, D.minZ - C.minZ, stainlessMat, C.minX - 0.02, cabH / 2, (C.minZ + D.minZ) / 2);
  addEBox(cabGroup, 0.04, cabH, C.maxZ - D.maxZ, stainlessMat, C.minX - 0.02, cabH / 2, (D.maxZ + C.maxZ) / 2);
  addEBox(cabGroup, 0.05, cabH - D.height + 0.02, D.width, darkStainlessMat, C.minX - 0.02, D.height + (cabH - D.height) / 2, doorCz);

  // Live High-Res Cab Transom OLED Floor/Speed/Depth Indicator
  const cabIndicator = createDigitalIndicator();
  const cabIndMesh = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.145, 0.44), cabIndicator.mat);
  cabIndMesh.position.set(C.minX + 0.012, D.height + 0.062, doorCz);
  cabGroup.add(cabIndMesh);

  // Synchronized Center-Opening Car Doors with Active Infrared Light-Curtain Safety Edges!
  const leafW = D.width / 2 + 0.01;
  const lightCurtainStrips = [];
  const makeDoorLeaf = (isLeft, hasCurtain = false) => {
    const grp = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.034, D.height - 0.02, leafW), stainlessMat);
    panel.position.set(0, D.height / 2, 0);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.040, D.height - 0.02, 0.026), rubberEdgeMat);
    edge.position.set(0, D.height / 2, isLeft ? leafW / 2 - 0.008 : -leafW / 2 + 0.008);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.72, 0.09), obsGlassMat);
    slit.position.set(0, 1.38, isLeft ? 0.04 : -0.04);
    grp.add(panel, edge, slit);
    if (hasCurtain) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.044, D.height - 0.14, 0.012), lightCurtainIdleMat);
      strip.position.set(0, D.height / 2, isLeft ? leafW / 2 + 0.002 : -leafW / 2 - 0.002);
      grp.add(strip);
      lightCurtainStrips.push(strip);
    }
    return grp;
  };
  const carDoorL = makeDoorLeaf(true, true);
  const carDoorR = makeDoorLeaf(false, true);
  const carDoorLClosedZ = doorCz - leafW / 2;
  const carDoorRClosedZ = doorCz + leafW / 2;
  carDoorL.position.set(C.minX - 0.045, 0, carDoorLClosedZ);
  carDoorR.position.set(C.minX - 0.045, 0, carDoorRClosedZ);
  cabGroup.add(carDoorL, carDoorR);

  // Moving Cab Interior Architectural PointLight
  const cabLight = new THREE.PointLight(0xfff1dc, 0, 6.4, 1.38);
  cabLight.position.set(cabCx, cabH - 0.14, cabCz);
  cabLight.visible = false;
  cabLight.userData.building = 'elevator';
  cabGroup.add(cabLight);
  interiorLights.push({ name: 'ELV_Cab_Light', floor: 1, zone: 'elevator', light: cabLight, baseInt: 2.60 });

  // =========================================================================
  // 5. OVERSIZED 3D CAR OPERATING PANEL (COP) WITH 5 FLOOR BUTTONS (1F..B4) + OPEN/CLOSE
  // =========================================================================
  const copX = C.minX + 0.015;
  const copZ = 2.34;
  addEBox(cabGroup, 0.024, 1.24, 0.255, darkStainlessMat, copX - 0.005, 1.30, copZ);
  addEBox(cabGroup, 0.012, 1.26, 0.275, stainlessMat, copX - 0.010, 1.30, copZ);
  // Engraved Capacity & Model Nameplate at top of COP
  addEBox(cabGroup, 0.022, 0.13, 0.22, makeSpecPlaqueMat(), copX + 0.009, 1.82, copZ);

  const copButtons = new Map();
  const copBtnSpecs = [
    { id: 'elv_btn_1',     floor: 1,    label: '1F',  sub: '地上',  y: 1.66, accent: '#38e89e', prompt: '【1F 地上直通】エレベーターで地上へ' },
    { id: 'elv_btn_0',     floor: 0,    label: 'B1',  sub: '倉庫',  y: 1.52, accent: '#f5b041', prompt: '【B1F 地下1階】セメント倉庫へ' },
    { id: 'elv_btn_-1',    floor: -1,   label: 'B2',  sub: 'ｽﾀｼﾞｵ', y: 1.38, accent: '#f5b041', prompt: '【B2F 地下2階】10×10mスタジオへ' },
    { id: 'elv_btn_-2',    floor: -2,   label: 'B3',  sub: 'ｼｪﾙﾀｰ', y: 1.24, accent: '#f5b041', prompt: '【B3F 地下3階】木造シェルターへ' },
    { id: 'elv_btn_-3',    floor: -3,   label: 'B4',  sub: '極秘研', y: 1.10, accent: '#f43f5e', prompt: '【B4F 地下4階】ギャング極秘研究所へ (ELV専用)' },
    { id: 'elv_btn_open',  floor: null, label: '◀▶',  sub: '',      y: 0.94, accent: '#60a5fa', prompt: 'エレベーター扉を開く (安全延長)', action: 'open' },
    { id: 'elv_btn_close', floor: null, label: '▶◀',  sub: '',      y: 0.80, accent: '#94a3b8', prompt: 'エレベーター扉を閉める', action: 'close' },
  ];

  // Forward-declared hyper-realistic elevator controller
  const controller = {
    cabGroup,
    cwtGroup,
    mainSheave,
    deflectorSheave,
    governorWheel,
    pitTensionWheel,
    cabY: -10.20,          // Starts welcomingly parked at B3F (-10.20m) with doors open
    velocity: 0,
    accel: 0,
    travelDir: 0,          // +1 up, -1 down, 0 idle
    currentStopFloor: -2,
    targetFloor: -2,
    queue: new Set(),      // Multi-floor collective call queue!
    phase: 'IDLE_OPEN',    // 'IDLE_OPEN' | 'DOOR_CLOSING' | 'BRAKE_RELEASE' | 'RUNNING' | 'RELEVELING' | 'DOOR_OPENING' | 'IDLE_CLOSED'
    doorProgress: 1.0,     // 1.0 = fully open, 0.0 = fully closed (raw linear 0..1, S-curve eased visually!)
    phaseTimer: 0,
    holdTimer: ELEVATOR.holdDuration,
    // Authentic Mechanical Ride Feel Outputs (coupled cleanly to camera in scene3d.js!)
    cabSettleOffset: 0,    // Damped vertical spring cushion on brake clamp/release (±4mm)
    settleTimer: 99,
    settleAmp: 0,
    railVibration: 0,      // Subtle rail-joint & traction hum micro-vibration
    lastRailJointIdx: 0,
    lightCurtainAlertTimer: 0,
    // Pending Audio Event Triggers (consumed in scene3d.js)
    chimePending: false,
    chimeDir: 1,
    doorSoundPending: null,   // 'open' | 'close' | null
    brakeSoundPending: null,  // 'release' | 'engage' | null
    buttonBeepPending: false,
    safetyBeepPending: false,
    lastIndKey: '',
    cabLight,
    selectFloor: null,
    callToFloor: null,
    openDoorsNow: null,
    closeDoorsNow: null,
    triggerSafetyReopen: null,
    snapToFloor: null,
    snapMidShaft: null,
    getState: null,
    update: null,
  };

  copBtnSpecs.forEach((spec) => {
    const offMat = makeButtonMat(spec.label, spec.accent, false, spec.sub);
    const onMat = makeButtonMat(spec.label, spec.accent, true, spec.sub);
    const btnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.115, 0.165), offMat);
    btnMesh.position.set(copX + 0.012, spec.y, copZ);
    btnMesh.userData.propId = spec.id;
    cabGroup.add(btnMesh);
    copButtons.set(spec.id, { mesh: btnMesh, offMat, onMat, floor: spec.floor });

    interactiveProps.push({
      id: spec.id,
      floor: 'any_elv',
      building: 'main',
      isElevatorBtn: true,
      mesh: btnMesh,
      getLabel: () => spec.prompt,
      toggle: () => {
        if (spec.floor !== null) controller.selectFloor(spec.floor);
        else if (spec.action === 'close') controller.closeDoorsNow();
        else controller.openDoorsNow();
      },
    });
  });

  // =========================================================================
  // 6. FIVE LANDING STATIONS (1F, B1F, B2F, B3F, B4F): INTERLOCKED HALL DOORS + CALL PANELS
  // =========================================================================
  const landingStations = new Map();
  ELEVATOR.stops.forEach((st) => {
    const y0 = st.y;
    const grp = new THREE.Group();
    elvDynamic.add(grp);

    const frameMat = st.classified ? darkStainlessMat : stainlessMat;
    // Brushed Stainless 3-Sided Portal Jamb Frame & Grooved Threshold Sill
    addEBox(elvStatic, 0.14, D.height + 0.06, 0.08, frameMat, S.minX - 0.05, y0 + D.height / 2 + 0.03, D.minZ - 0.04);
    addEBox(elvStatic, 0.14, D.height + 0.06, 0.08, frameMat, S.minX - 0.05, y0 + D.height / 2 + 0.03, D.maxZ + 0.04);
    addEBox(elvStatic, 0.14, 0.10, D.width + 0.16, frameMat, S.minX - 0.05, y0 + D.height + 0.05, doorCz);
    addEBox(elvStatic, 0.12, 0.024, D.width + 0.08, stainlessMat, S.minX - 0.05, y0 + 0.012, doorCz);

    // Synchronized Center-Opening Hall Doors
    const hallL = makeDoorLeaf(true, false);
    const hallR = makeDoorLeaf(false, false);
    hallL.position.set(S.minX - 0.03, y0, carDoorLClosedZ);
    hallR.position.set(S.minX - 0.03, y0, carDoorRClosedZ);
    grp.add(hallL, hallR);

    // Live High-Res Hall Transom OLED Floor/Speed/Depth Indicator
    const ind = createDigitalIndicator();
    const indBox = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.15, 0.44), ind.mat);
    indBox.position.set(S.minX - 0.115, y0 + D.height + 0.125, doorCz);
    grp.add(indBox);

    // Oversized Glowing Hall Call Button Panel
    const callId = `elv_call_${st.floor}`;
    const callAccent = st.classified ? '#f43f5e' : '#38e89e';
    const callOffMat = makeButtonMat('呼出', callAccent, false, st.code);
    const callOnMat = makeButtonMat('呼出', callAccent, true, st.code);
    addEBox(elvStatic, 0.025, 0.36, 0.23, darkStainlessMat, S.minX - 0.105, y0 + 1.18, 2.36);
    const callMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.195, 0.175), callOffMat);
    callMesh.position.set(S.minX - 0.125, y0 + 1.18, 2.36);
    callMesh.userData.propId = callId;
    grp.add(callMesh);

    interactiveProps.push({
      id: callId,
      floor: st.floor,
      building: 'main',
      isElevatorCall: true,
      mesh: callMesh,
      getLabel: () => (controller.currentStopFloor === st.floor && (controller.phase === 'IDLE_OPEN' || controller.phase === 'IDLE_CLOSED' || controller.phase === 'DOOR_OPENING')
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
  // 7. INTERNAL STATIC BATCHING & 7-PHASE JERK-LIMITED MECHANICAL KINEMATICS ENGINE
  // =========================================================================
  const { batchedGroup: elvBatched, stats: elvBatchStats } = batchStaticGroups([elvStatic]);
  elvRoot.add(elvBatched);

  const getStopByFloor = (f) => ELEVATOR.stops.find((s) => s.floor === f) || ELEVATOR.stops[3];
  const minStopY = -14.20; // B4F Secret Lab!
  const maxStopY = 0.00;   // 1F Ground!
  const midTravelY = (minStopY + maxStopY) * 0.5; // -7.10 m!

  const easeDoorSCurve = (p) => {
    const t = Math.max(0, Math.min(1, p));
    // Smooth S-curve with gentle pneumatic cushion at both open & closed stops
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  function pickNextTargetFromQueue() {
    if (controller.queue.size === 0) return null;
    const curY = controller.cabY;
    const queuedStops = Array.from(controller.queue).map((f) => getStopByFloor(f));
    // Collective scheduling: prefer nearest stop ahead (or currently approaching) in current travel direction, else nearest overall!
    if (controller.travelDir !== 0) {
      const ahead = queuedStops
        .filter((s) => (controller.travelDir > 0 ? s.y >= curY - 0.015 : s.y <= curY + 0.015))
        .sort((a, b) => Math.abs(a.y - curY) - Math.abs(b.y - curY));
      if (ahead.length > 0) return ahead[0].floor;
    }
    queuedStops.sort((a, b) => Math.abs(a.y - curY) - Math.abs(b.y - curY));
    return queuedStops[0].floor;
  }

  function syncMechanicalPose() {
    const visualCabY = controller.cabY + controller.cabSettleOffset;
    cabGroup.position.y = visualCabY;

    // 1. Opposite-Phase Counterweight (exact 1:1 counterweight displacement across full 14.20m stroke!)
    const cwtBottomY = midTravelY - (visualCabY - midTravelY) - 0.90;
    cwtGroup.position.y = Math.max(S.pitY + 0.98, Math.min(S.topY - 2.04, cwtBottomY));

    // 2. Exact Kinematic Rotation of Main Sheave, Deflector, Top Governor, Pit Tension Sheave & Cab Guide Rollers!
    const travelRad = visualCabY / 0.20;
    mainSheave.rotation.z = -travelRad;
    deflectorSheave.rotation.z = -visualCabY / 0.15;
    governorWheel.rotation.z = travelRad * 1.45;
    pitTensionWheel.rotation.z = travelRad * 1.45;
    const rollerAngle = visualCabY / 0.055;
    for (let i = 0; i < guideRollers.length; i++) {
      guideRollers[i].rotation.y = rollerAngle;
    }

    // 3. Physically Moving Electromagnetic Brake Calipers + Brake Coil Status LED!
    const brakeOpen = controller.phase === 'BRAKE_RELEASE' || controller.phase === 'RUNNING' || controller.phase === 'RELEVELING';
    const brakeSpread = brakeOpen ? 0.228 : 0.206;
    brakeArmL.position.z = cabCz - brakeSpread;
    brakeArmR.position.z = cabCz + brakeSpread;
    brakeLedMesh.material = brakeOpen ? brakeLedOpenMat : brakeLedLockedMat;

    // 4. 4 Live Scaling Steel Hoist Wire Ropes (Sheave <-> Cab Hitch & Sheave <-> Counterweight Top)
    const cabHitchY = visualCabY + cabH + 0.26;
    const cabRopeLen = Math.max(0.15, sheaveY - cabHitchY);
    const cabRopeMidY = (sheaveY + cabHitchY) * 0.5;
    for (let i = 0; i < cabRopes.length; i++) {
      cabRopes[i].scale.y = cabRopeLen;
      cabRopes[i].position.y = cabRopeMidY;
    }

    const cwtTopY = cwtGroup.position.y + 1.82;
    const cwtRopeLen = Math.max(0.15, sheaveY - cwtTopY);
    const cwtRopeMidY = (sheaveY + cwtTopY) * 0.5;
    for (let i = 0; i < cwtRopes.length; i++) {
      cwtRopes[i].scale.y = cwtRopeLen;
      cwtRopes[i].position.y = cwtRopeMidY;
    }

    // 5. Live Dynamic Catenary Flat Traveling Cable (テールコード) + Pit Compensating Chain!
    const cabUnderY = visualCabY - 0.12;
    const loopBottomY = Math.max(S.pitY + 0.30, Math.min(midJunctionY, cabUnderY) - 0.95);
    const wallLegLen = Math.max(0.15, midJunctionY - loopBottomY);
    travWallLeg.scale.y = wallLegLen;
    travWallLeg.position.y = loopBottomY + wallLegLen * 0.5;
    const cabLegLen = Math.max(0.15, cabUnderY - loopBottomY);
    travCabLeg.scale.y = cabLegLen;
    travCabLeg.position.y = loopBottomY + cabLegLen * 0.5;
    travLoopArc.position.y = loopBottomY;

    const compLen = Math.max(0.20, cabUnderY - (S.pitY + 0.20));
    compCable.scale.y = compLen;
    compCable.position.y = S.pitY + 0.20 + compLen * 0.5;

    // 6. S-Curve Eased Center-Opening Car Doors + Interlocked Floor Hall Doors + Overhead Door Crank Linkage!
    const easedDoor = easeDoorSCurve(controller.doorProgress);
    const slideOffset = easedDoor * (leafW - 0.02);
    carDoorL.position.z = carDoorLClosedZ - slideOffset;
    carDoorR.position.z = carDoorRClosedZ + slideOffset;
    doorOpWheel.rotation.x = easedDoor * Math.PI * 1.4;
    doorArmBar.rotation.x = Math.sin(easedDoor * Math.PI) * 0.38;

    // Infrared Light-Curtain Safety Edge LED state
    const curtainMat = controller.lightCurtainAlertTimer > 0
      ? lightCurtainAlertMat
      : (controller.phase === 'DOOR_CLOSING' ? lightCurtainWarnMat : lightCurtainIdleMat);
    for (let i = 0; i < lightCurtainStrips.length; i++) {
      lightCurtainStrips[i].material = curtainMat;
    }

    const isMoving = controller.phase === 'RUNNING' || controller.phase === 'RELEVELING' || controller.phase === 'BRAKE_RELEASE';
    landingStations.forEach((stObj, flKey) => {
      const openHere = (flKey === controller.currentStopFloor && !isMoving) ? slideOffset : 0;
      stObj.hallL.position.z = carDoorLClosedZ - openHere;
      stObj.hallR.position.z = carDoorRClosedZ + openHere;
      const callLit = controller.queue.has(flKey) || (controller.targetFloor === flKey && (isMoving || controller.phase === 'DOOR_CLOSING'));
      stObj.callMesh.material = callLit ? stObj.callOnMat : stObj.callOffMat;
    });

    // 7. Update 3D COP Illuminated Floor Buttons (lights up ALL queued targets + active stop!)
    copButtons.forEach((b) => {
      if (b.floor !== null) {
        const isLit = controller.queue.has(b.floor)
          || (b.floor === controller.targetFloor && (isMoving || controller.phase === 'DOOR_CLOSING'))
          || (b.floor === controller.currentStopFloor && !isMoving && controller.queue.size === 0);
        b.mesh.material = isLit ? b.onMat : b.offMat;
      }
    });

    // 8. Live High-Res OLED Digital Indicators (redrawn only on quantized change to save GPU upload bandwidth!)
    let nearest = ELEVATOR.stops[0];
    let bestD = Infinity;
    for (const s of ELEVATOR.stops) {
      const d = Math.abs(s.y - controller.cabY);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    const dir = isMoving
      ? (controller.velocity > 0.02 ? 1 : (controller.velocity < -0.02 ? -1 : controller.travelDir))
      : 0;
    let statusTxt = 'STOP';
    if (controller.phase === 'BRAKE_RELEASE') statusTxt = 'BRK';
    else if (controller.phase === 'RUNNING') statusTxt = 'RUN';
    else if (controller.phase === 'RELEVELING') statusTxt = 'LVL';
    else if (controller.phase === 'DOOR_CLOSING') statusTxt = 'CLOS';
    else if (controller.phase === 'DOOR_OPENING' || controller.phase === 'IDLE_OPEN') statusTxt = 'OPEN';
    else if (controller.phase === 'IDLE_CLOSED') statusTxt = 'LOCK';

    const qSpd = Math.round(Math.abs(controller.velocity) * 10);
    const qElev = Math.round(controller.cabY * 10);
    const indKey = `${nearest.code}|${dir}|${statusTxt}|${qSpd}|${qElev}`;
    if (indKey !== controller.lastIndKey) {
      controller.lastIndKey = indKey;
      cabIndicator.redraw(nearest.code, dir, statusTxt, Math.abs(controller.velocity), controller.cabY);
      landingStations.forEach((stObj) => stObj.indicator.redraw(nearest.code, dir, statusTxt, Math.abs(controller.velocity), controller.cabY));
    }
  }

  controller.selectFloor = (targetFloor) => {
    const stop = getStopByFloor(targetFloor);
    controller.buttonBeepPending = true;
    const isMoving = controller.phase === 'RUNNING' || controller.phase === 'RELEVELING' || controller.phase === 'BRAKE_RELEASE';

    if (stop.floor === controller.currentStopFloor && !isMoving) {
      if (controller.phase !== 'DOOR_OPENING' && controller.doorProgress < 0.99) {
        controller.phase = 'DOOR_OPENING';
        controller.phaseTimer = 0;
        controller.doorSoundPending = 'open';
      }
      controller.holdTimer = ELEVATOR.holdDuration;
      return;
    }

    controller.queue.add(stop.floor);
    const nextFl = pickNextTargetFromQueue();
    if (nextFl !== null) controller.targetFloor = nextFl;

    if (controller.phase === 'IDLE_OPEN' || controller.phase === 'DOOR_OPENING') {
      controller.phase = 'DOOR_CLOSING';
      controller.doorSoundPending = 'close';
    } else if (controller.phase === 'IDLE_CLOSED') {
      controller.phase = 'BRAKE_RELEASE';
      controller.phaseTimer = 0;
      controller.brakeSoundPending = 'release';
      controller.settleAmp = -0.0035;
      controller.settleTimer = 0;
    }
  };

  controller.callToFloor = (floor) => {
    controller.selectFloor(floor);
  };

  controller.openDoorsNow = () => {
    const isMoving = controller.phase === 'RUNNING' || controller.phase === 'RELEVELING' || controller.phase === 'BRAKE_RELEASE';
    if (isMoving) return;
    controller.buttonBeepPending = true;
    if (controller.phase !== 'DOOR_OPENING' && controller.doorProgress < 0.99) {
      controller.phase = 'DOOR_OPENING';
      controller.phaseTimer = 0;
      controller.doorSoundPending = 'open';
    }
    controller.holdTimer = ELEVATOR.holdDuration;
  };

  controller.closeDoorsNow = () => {
    const isMoving = controller.phase === 'RUNNING' || controller.phase === 'RELEVELING' || controller.phase === 'BRAKE_RELEASE';
    if (isMoving || controller.doorProgress <= 0.02) return;
    controller.buttonBeepPending = true;
    controller.phase = 'DOOR_CLOSING';
    controller.doorSoundPending = 'close';
  };

  controller.triggerSafetyReopen = () => {
    if (controller.phase !== 'DOOR_CLOSING') return;
    controller.lightCurtainAlertTimer = 1.25;
    controller.safetyBeepPending = true;
    controller.phase = 'DOOR_OPENING';
    controller.phaseTimer = 0;
    controller.doorSoundPending = 'open';
    controller.holdTimer = Math.max(4.5, ELEVATOR.holdDuration * 0.7);
  };

  controller.snapToFloor = (floor, open = true) => {
    const stop = getStopByFloor(floor);
    controller.cabY = stop.y;
    controller.velocity = 0;
    controller.accel = 0;
    controller.travelDir = 0;
    controller.currentStopFloor = stop.floor;
    controller.targetFloor = stop.floor;
    controller.queue.clear();
    controller.phase = open ? 'IDLE_OPEN' : 'IDLE_CLOSED';
    controller.doorProgress = open ? 1.0 : 0.0;
    controller.holdTimer = ELEVATOR.holdDuration;
    controller.cabSettleOffset = 0;
    controller.railVibration = 0;
    syncMechanicalPose();
  };

  controller.snapMidShaft = (y, targetFloor = 1) => {
    const stop = getStopByFloor(targetFloor);
    controller.cabY = Math.max(minStopY, Math.min(maxStopY, y));
    controller.targetFloor = stop.floor;
    controller.queue.clear();
    controller.queue.add(stop.floor);
    controller.doorProgress = 0.0;
    controller.phase = 'RUNNING';
    controller.travelDir = stop.y >= controller.cabY ? 1 : -1;
    controller.velocity = controller.travelDir * 2.15;
    controller.accel = 0;
    controller.cabSettleOffset = 0;
    syncMechanicalPose();
  };

  controller.getState = () => {
    let nearest = ELEVATOR.stops[0];
    let bestD = Infinity;
    for (const s of ELEVATOR.stops) {
      const d = Math.abs(s.y - controller.cabY);
      if (d < bestD) { bestD = d; nearest = s; }
    }
    const isMoving = controller.phase === 'RUNNING' || controller.phase === 'RELEVELING' || controller.phase === 'BRAKE_RELEASE';
    return {
      cabY: controller.cabY,
      floorCode: nearest.code,
      currentStopFloor: controller.currentStopFloor,
      targetFloor: controller.targetFloor,
      queuedFloors: Array.from(controller.queue),
      phase: controller.phase,
      doorProgress: controller.doorProgress,
      speedMs: Math.abs(controller.velocity),
      accelMs2: controller.accel,
      dir: isMoving ? (Math.sign(controller.velocity) || controller.travelDir) : 0,
      brakeOpen: isMoving,
    };
  };

  controller.update = (dtSec) => {
    const dt = Math.max(0, Math.min(0.05, dtSec));
    if (controller.lightCurtainAlertTimer > 0) {
      controller.lightCurtainAlertTimer = Math.max(0, controller.lightCurtainAlertTimer - dt);
    }

    // Damped harmonic spring settle cushion on brake clamp/release (realistic rope elasticity!)
    if (controller.settleTimer < 0.85) {
      controller.settleTimer += dt;
      controller.cabSettleOffset = controller.settleAmp * Math.exp(-5.8 * controller.settleTimer) * Math.sin(18.5 * controller.settleTimer);
    } else {
      controller.cabSettleOffset = 0;
    }
    controller.railVibration = 0;

    if (controller.phase === 'IDLE_OPEN') {
      controller.velocity = 0;
      controller.accel = 0;
      controller.doorProgress = 1.0;
      const nextFl = pickNextTargetFromQueue();
      if (nextFl !== null && nextFl !== controller.currentStopFloor) {
        controller.targetFloor = nextFl;
        controller.holdTimer -= dt;
        if (controller.holdTimer <= ELEVATOR.holdDuration - 1.2) {
          controller.phase = 'DOOR_CLOSING';
          controller.doorSoundPending = 'close';
        }
      }
    } else if (controller.phase === 'DOOR_CLOSING') {
      controller.velocity = 0;
      controller.accel = 0;
      controller.doorProgress = Math.max(0, controller.doorProgress - dt / ELEVATOR.doorDuration);
      if (controller.doorProgress <= 0.001) {
        controller.doorProgress = 0;
        const nextFl = pickNextTargetFromQueue();
        if (nextFl !== null && nextFl !== controller.currentStopFloor) {
          controller.targetFloor = nextFl;
          controller.travelDir = Math.sign(getStopByFloor(nextFl).y - controller.cabY) || 1;
          controller.phase = 'BRAKE_RELEASE';
          controller.phaseTimer = 0;
          controller.brakeSoundPending = 'release';
          controller.settleAmp = -0.0032 * controller.travelDir;
          controller.settleTimer = 0;
        } else {
          controller.phase = 'IDLE_CLOSED';
        }
      }
    } else if (controller.phase === 'IDLE_CLOSED') {
      controller.velocity = 0;
      controller.accel = 0;
      const nextFl = pickNextTargetFromQueue();
      if (nextFl !== null && nextFl !== controller.currentStopFloor) {
        controller.targetFloor = nextFl;
        controller.travelDir = Math.sign(getStopByFloor(nextFl).y - controller.cabY) || 1;
        controller.phase = 'BRAKE_RELEASE';
        controller.phaseTimer = 0;
        controller.brakeSoundPending = 'release';
        controller.settleAmp = -0.0032 * controller.travelDir;
        controller.settleTimer = 0;
      }
    } else if (controller.phase === 'BRAKE_RELEASE') {
      controller.velocity = 0;
      controller.accel = 0;
      controller.phaseTimer += dt;
      if (controller.phaseTimer >= ELEVATOR.brakeReleaseDuration) {
        controller.phase = 'RUNNING';
        controller.phaseTimer = 0;
      }
    } else if (controller.phase === 'RUNNING') {
      // Allow mid-flight collective stop insertion if a closer stop in the same direction was queued!
      const nextFl = pickNextTargetFromQueue();
      if (nextFl !== null) controller.targetFloor = nextFl;

      const targetY = getStopByFloor(controller.targetFloor).y;
      const dist = targetY - controller.cabY;
      const dir = Math.sign(dist) || controller.travelDir || 1;
      if (!controller.travelDir && Math.abs(dist) > 0.15) controller.travelDir = dir;
      const absDist = Math.abs(dist);

      // True Jerk-Limited S-Curve Braking Envelope:
      // Reserve 0.08m for ultra-smooth zero-overshoot micro-leveling creep (RELEVELING phase!)
      const levelZone = 0.08;
      const brakeDist = Math.max(0, absDist - levelZone);
      const stopSpeed = Math.sqrt(2 * (ELEVATOR.accel * 0.70) * brakeDist);
      const desiredV = Math.max(ELEVATOR.relevelSpeed, Math.min(ELEVATOR.maxSpeed, stopSpeed)) * dir;

      // Compute desired acceleration & slew-limit by JERK (2.60 m/s³) for buttery real-world S-curve ride!
      const vErr = desiredV - controller.velocity;
      const desiredA = Math.max(-ELEVATOR.accel, Math.min(ELEVATOR.accel, vErr * 3.8));
      const maxDa = ELEVATOR.jerk * dt;
      controller.accel += Math.max(-maxDa, Math.min(maxDa, desiredA - controller.accel));
      controller.velocity = Math.max(-ELEVATOR.maxSpeed, Math.min(ELEVATOR.maxSpeed, controller.velocity + controller.accel * dt));
      controller.cabY = Math.max(minStopY, Math.min(maxStopY, controller.cabY + controller.velocity * dt));

      // Subtle guide-rail micro-vibration & 2.5m rail fishplate joint impulse while cruising!
      const spdNorm = Math.abs(controller.velocity) / ELEVATOR.maxSpeed;
      const jointIdx = Math.floor((controller.cabY - minStopY) / 2.5);
      const jointBump = jointIdx !== controller.lastRailJointIdx ? 0.0012 * spdNorm : 0;
      controller.lastRailJointIdx = jointIdx;
      controller.railVibration = Math.sin(controller.cabY * 38.0) * 0.00038 * spdNorm + jointBump;

      if (absDist <= levelZone + 0.015 && Math.abs(controller.velocity) <= 0.55) {
        controller.phase = 'RELEVELING';
        controller.phaseTimer = 0;
      }
    } else if (controller.phase === 'RELEVELING') {
      // Precision Micro-Leveling Creep into exact ±0.0mm Sill Alignment!
      const targetY = getStopByFloor(controller.targetFloor).y;
      const dist = targetY - controller.cabY;
      const absDist = Math.abs(dist);
      const dir = Math.sign(dist);
      const creepV = Math.min(ELEVATOR.relevelSpeed, Math.max(0.06, absDist * 3.2)) * dir;
      controller.velocity += (creepV - controller.velocity) * Math.min(1, dt * 14);
      controller.accel = 0;
      controller.cabY = Math.max(minStopY, Math.min(maxStopY, controller.cabY + controller.velocity * dt));

      if (absDist < 0.008) {
        const arrivalDir = controller.travelDir || 1;
        controller.cabY = targetY;
        controller.velocity = 0;
        controller.accel = 0;
        controller.currentStopFloor = controller.targetFloor;
        controller.queue.delete(controller.currentStopFloor);
        controller.phase = 'DOOR_OPENING';
        controller.phaseTimer = 0;
        // Heavy Electromagnetic Brake Clamp + Damped Rope Elasticity Settle Bounce + Direction Chime!
        controller.brakeSoundPending = 'engage';
        controller.chimePending = true;
        controller.chimeDir = arrivalDir;
        controller.settleAmp = 0.0044 * arrivalDir;
        controller.settleTimer = 0;
        controller.holdTimer = ELEVATOR.holdDuration;
      }
    } else if (controller.phase === 'DOOR_OPENING') {
      controller.velocity = 0;
      controller.accel = 0;
      controller.phaseTimer += dt;
      // Authentic 0.14s mechanical door-clutch interlock unlatch delay before sliding open!
      if (controller.phaseTimer >= 0.14) {
        if (controller.doorProgress < 0.01 && !controller.doorSoundPending) {
          controller.doorSoundPending = 'open';
        }
        controller.doorProgress = Math.min(1, controller.doorProgress + dt / ELEVATOR.doorDuration);
        if (controller.doorProgress >= 0.999) {
          controller.doorProgress = 1.0;
          controller.phase = 'IDLE_OPEN';
          controller.travelDir = 0;
          controller.holdTimer = ELEVATOR.holdDuration;
        }
      }
    }

    syncMechanicalPose();
  };

  // Initialize parked cleanly at B3F (-10.20m) with doors open
  syncMechanicalPose();
  controller.batchStats = elvBatchStats;
  return controller;
}
