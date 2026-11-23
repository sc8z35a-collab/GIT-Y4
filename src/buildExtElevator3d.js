import * as THREE from 'three';
import { EXT_ELEVATOR, HOUSE } from './planData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds ELV-EXT — Exterior Panoramic Steel-and-Glass Express Elevator
 * Mounted outside the West facade of Main Tower (X = -1.55..0.00, Z = 0.35..1.85),
 * ascending 16.10m directly from the exterior moss courtyard (1F Ground Y=0.00)
 * straight into the RF Attic (Y=16.10m) via a zinc-clad architectural gable dormer!
 *
 * Operated strictly via physical 3D in-world COP & Hall Call buttons (ZERO overlay HUD!).
 */
export function buildExtElevator3D(ctx) {
  const {
    scene,
    interactiveProps,
    interiorLights,
  } = ctx;

  const S = EXT_ELEVATOR.shaft; // minX:-1.55, maxX:0.00, minZ:0.35, maxZ:1.85, pitY:-0.60, topY:19.35
  const C = EXT_ELEVATOR.cab;   // minX:-1.43, maxX:-0.14, minZ:0.47, maxZ:1.73, H:2.22
  const shaftW = S.maxX - S.minX;
  const shaftD = S.maxZ - S.minZ;
  const shaftCx = (S.minX + S.maxX) * 0.5; // -0.775
  const shaftCz = (S.minZ + S.maxZ) * 0.5; // 1.10
  const cabW = C.maxX - C.minX;            // 1.29
  const cabD = C.maxZ - C.minZ;            // 1.26
  const cabH = C.height;                   // 2.22
  const cabCx = (C.minX + C.maxX) * 0.5;   // -0.785
  const cabCz = (C.minZ + C.maxZ) * 0.5;   // 1.10
  const doorCz = 1.10;
  const doorW = 0.90;
  const doorH = 2.04;

  const root = new THREE.Group();
  root.name = 'ExteriorAtticElevator_ELV_EXT';
  scene.add(root);

  const eStatic = new THREE.Group();
  const eDynamic = new THREE.Group();
  root.add(eDynamic);

  const blackSteelMat = new THREE.MeshStandardMaterial({ color: 0x1d232a, roughness: 0.38, metalness: 0.80 });
  const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xc2cbd4, roughness: 0.24, metalness: 0.84 });
  const darkStainlessMat = new THREE.MeshStandardMaterial({ color: 0x4b535d, roughness: 0.34, metalness: 0.80 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.34, metalness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a35b, roughness: 0.28, metalness: 0.84 });
  const oakDeckMat = makeSurfaceMat('wood_floor', 1.3, 1.3, { roughness: 0.44 });
  const graniteStepMat = makeSurfaceMat('paver_granite_grid', 1.2, 1.4);
  const zincDormerMat = makeSurfaceMat('warehouse_corrugated_steel', 1.8, 2.2, { color: 0x414952, roughness: 0.48, metalness: 0.68 });
  const glassShaftMat = new THREE.MeshStandardMaterial({
    color: 0xaed4ec,
    roughness: 0.08,
    metalness: 0.14,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const cabCeilGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff8eb,
    emissive: new THREE.Color(0xffe7c2),
    emissiveIntensity: 1.45,
  });

  function addBox(parent, w, h, d, material, x, y, z, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function makeButtonMat(label, accentHex = '#38bdf8', isLit = false) {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: isLit ? 0x38bdf8 : 0x262d36 });
    }
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = isLit ? '#102430' : '#14181e';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = isLit ? accentHex : '#64748b';
    c.lineWidth = isLit ? 12 : 6;
    c.beginPath();
    c.arc(64, 64, 52, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = isLit ? '#ffffff' : '#dce4ee';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = label.length <= 2 ? '800 44px sans-serif' : '800 30px sans-serif';
    c.fillText(label, 64, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(isLit ? accentHex : '#748da8'),
      emissiveIntensity: isLit ? 1.65 : 0.48,
      roughness: 0.28,
      metalness: 0.35,
    });
  }

  // ---- 1. EXTERIOR STRUCTURAL STEEL GLASS TOWER HOISTWAY (Y = -0.50 .. +19.35m) ----
  const totalH = S.topY - S.pitY;
  // Concrete base pit & exterior stone boarding steps on West Courtyard (Y = -0.35 -> 0.00)
  addBox(eStatic, shaftW + 0.16, 0.30, shaftD + 0.16, makeSurfaceMat('concrete_clean', 1.8, 1.8), shaftCx, -0.48, shaftCz, false);
  // Gentle 2-tier exterior stone boarding terrace leading cleanly onto West ground door
  addBox(eStatic, 0.42, 0.24, 1.32, graniteStepMat, S.minX - 0.21, -0.12, doorCz, false);
  addBox(eStatic, 0.28, 0.12, 1.32, graniteStepMat, S.minX - 0.52, -0.26, doorCz, false);

  // 4 Vertical Steel Corner H-Columns rising full 19.95m up the outside of Main Tower!
  [
    [S.minX + 0.05, S.minZ + 0.05],
    [S.maxX - 0.05, S.minZ + 0.05],
    [S.minX + 0.05, S.maxZ - 0.05],
    [S.maxX - 0.05, S.maxZ - 0.05],
  ].forEach(([cx, cz]) => {
    addBox(eStatic, 0.11, totalH, 0.11, blackSteelMat, cx, S.pitY + totalH * 0.5, cz, true);
  });

  // Horizontal Steel Structural Tie Beams at every floor height (stopped cleanly between corner H-columns — ZERO corner Z-fighting!)
  const tieYs = [0.00, 2.75, 5.50, 8.15, 10.50, 13.25, 16.10, 18.40, S.topY];
  tieYs.forEach((ty) => {
    addBox(eStatic, shaftW - 0.22, 0.095, 0.085, blackSteelMat, shaftCx, ty, S.minZ + 0.05, false);
    addBox(eStatic, shaftW - 0.22, 0.095, 0.085, blackSteelMat, shaftCx, ty, S.maxZ - 0.05, false);
    addBox(eStatic, 0.085, 0.095, shaftD - 0.22, blackSteelMat, S.minX + 0.05, ty, shaftCz, false);
    addBox(eStatic, 0.085, 0.095, shaftD - 0.22, blackSteelMat, S.maxX - 0.05, ty, shaftCz, false);
  });

  // Panoramic Tempered Glass Shaft Glazing Panels (North, South, & West above ground door!)
  addBox(eStatic, shaftW - 0.22, totalH - 0.4, 0.018, glassShaftMat, shaftCx, S.pitY + totalH * 0.5, S.minZ + 0.04, false);
  addBox(eStatic, shaftW - 0.22, totalH - 0.4, 0.018, glassShaftMat, shaftCx, S.pitY + totalH * 0.5, S.maxZ - 0.04, false);
  addBox(eStatic, 0.018, S.topY - 2.20, shaftD - 0.22, glassShaftMat, S.minX + 0.04, 2.20 + (S.topY - 2.20) * 0.5, shaftCz, false);

  // Top MRL Traction Motor Housing Cap & Sheave Beam (Y = 18.85..19.45m)
  addBox(eStatic, shaftW + 0.12, 0.14, shaftD + 0.12, blackSteelMat, shaftCx, S.topY + 0.12, shaftCz, true);
  const topMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.52, 16), new THREE.MeshStandardMaterial({ color: 0x244642, roughness: 0.4, metalness: 0.55 }));
  topMotor.rotation.z = Math.PI / 2;
  topMotor.position.set(shaftCx, S.topY - 0.34, shaftCz);
  eStatic.add(topMotor);

  // Vertical T-Section Guide Rails (North & South inside shaft)
  addBox(eStatic, 0.06, totalH - 0.3, 0.06, darkStainlessMat, cabCx, S.pitY + totalH * 0.5, S.minZ + 0.11, false);
  addBox(eStatic, 0.06, totalH - 0.3, 0.06, darkStainlessMat, cabCx, S.pitY + totalH * 0.5, S.maxZ - 0.11, false);

  // ---- 2. ARCHITECTURAL ZINC-CLAD ATTIC DORMER AT RF (Y = 16.10..18.45m, X = 0.00..1.45, Z = 0.35..1.85) ----
  const yRF = HOUSE.atticBaseY; // 16.10
  const dormH = 2.24;
  addBox(eStatic, 1.38, dormH, 0.10, zincDormerMat, 0.69, yRF + dormH * 0.5, 0.38, true);
  addBox(eStatic, 1.38, dormH, 0.10, zincDormerMat, 0.69, yRF + dormH * 0.5, 1.82, true);
  addBox(eStatic, 1.56, 0.10, 1.62, zincDormerMat, 0.72, yRF + dormH + 0.055, 1.10, true);
  // Stainless landing portal jambs (cleanly stopped below header, East portal strictly West of Main Tower X=0.00!)
  const buildPortalFrame = (px, py) => {
    addBox(eStatic, 0.085, doorH, 0.11, darkStainlessMat, px, py + doorH * 0.5, doorCz - doorW * 0.5 - 0.055, false);
    addBox(eStatic, 0.085, doorH, 0.11, darkStainlessMat, px, py + doorH * 0.5, doorCz + doorW * 0.5 + 0.055, false);
    addBox(eStatic, 0.090, 0.14, doorW + 0.22, darkStainlessMat, px, py + doorH + 0.072, doorCz, false);
  };
  buildPortalFrame(S.minX + 0.045, 0.00);
  buildPortalFrame(S.maxX - 0.055, yRF);

  // ---- 3. INTERLOCKED LANDING DOORS (Ground 1F West & Attic RF East) ----
  const landingDoors = {};
  EXT_ELEVATOR.stops.forEach((st) => {
    const px = st.doorSide === 'west' ? S.minX + 0.05 : S.maxX - 0.055;
    const leafW = doorW * 0.5 - 0.01;
    const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.035, doorH - 0.02, leafW), stainlessMat);
    const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.035, doorH - 0.02, leafW), stainlessMat);
    leftLeaf.position.set(px, st.y + doorH * 0.5, doorCz - leafW * 0.5);
    rightLeaf.position.set(px, st.y + doorH * 0.5, doorCz + leafW * 0.5);
    eDynamic.add(leftLeaf, rightLeaf);
    landingDoors[st.floor] = { leftLeaf, rightLeaf, leafW };
  });

  // ---- 4. MOVING PANORAMIC GLASS-AND-OAK CAB + PHYSICAL 3D COP BUTTONS ----
  const cabGroup = new THREE.Group();
  cabGroup.position.set(0, 0.0, 0);
  eDynamic.add(cabGroup);

  // Cab floor platform (oak deck) & ceiling slab (with cleanly offset warm luminous soffit)
  addBox(cabGroup, cabW, 0.09, cabD, oakDeckMat, cabCx, -0.046, cabCz, false);
  addBox(cabGroup, cabW + 0.04, 0.09, cabD + 0.04, blackSteelMat, cabCx, cabH + 0.046, cabCz, false);
  addBox(cabGroup, cabW - 0.22, 0.022, cabD - 0.22, cabCeilGlowMat, cabCx, cabH - 0.015, cabCz, false);
  // Cab corner mullions (cleanly bounded between floor & ceiling — zero slab fighting!)
  [
    [C.minX + 0.03, C.minZ + 0.03], [C.maxX - 0.03, C.minZ + 0.03],
    [C.minX + 0.03, C.maxZ - 0.03], [C.maxX - 0.03, C.maxZ - 0.03],
  ].forEach(([mx, mz]) => {
    addBox(cabGroup, 0.048, cabH - 0.006, 0.048, blackSteelMat, mx, cabH * 0.5, mz, false);
  });
  addBox(cabGroup, cabW - 0.12, cabH - 0.14, 0.018, glassShaftMat, cabCx, cabH * 0.5, C.minZ + 0.02, false);
  addBox(cabGroup, cabW - 0.12, cabH - 0.14, 0.018, glassShaftMat, cabCx, cabH * 0.5, C.maxZ - 0.02, false);
  addBox(cabGroup, cabW - 0.24, 0.032, 0.032, brassMat, cabCx, 0.92, C.minZ + 0.08, false);
  addBox(cabGroup, cabW - 0.24, 0.032, 0.032, brassMat, cabCx, 0.92, C.maxZ - 0.08, false);

  // Cab Dual Sliding Doors (West for 1F Ground exit, East for RF Attic exit!)
  const cabLeafW = doorW * 0.5 - 0.01;
  const cabDoors = {
    west: {
      left: addBox(cabGroup, 0.03, doorH - 0.02, cabLeafW, stainlessMat, C.minX + 0.02, doorH * 0.5, doorCz - cabLeafW * 0.5, false),
      right: addBox(cabGroup, 0.03, doorH - 0.02, cabLeafW, stainlessMat, C.minX + 0.02, doorH * 0.5, doorCz + cabLeafW * 0.5, false),
    },
    east: {
      left: addBox(cabGroup, 0.03, doorH - 0.02, cabLeafW, stainlessMat, C.maxX - 0.02, doorH * 0.5, doorCz - cabLeafW * 0.5, false),
      right: addBox(cabGroup, 0.03, doorH - 0.02, cabLeafW, stainlessMat, C.maxX - 0.02, doorH * 0.5, doorCz + cabLeafW * 0.5, false),
    },
  };

  // Cab interior warm light
  const cabLight = new THREE.PointLight(0xffe8c4, 1.35, 5.5, 1.6);
  cabLight.position.set(cabCx, cabH - 0.20, cabCz);
  cabGroup.add(cabLight);
  interiorLights.push({ name: 'ELV_EXT_Cab', floor: 1, zone: 'ext_elv', light: cabLight, baseInt: 1.35 });

  // Moving Opposite-Phase Counterweight & Dynamic Steel Hoist Cables
  const cwtGroup = new THREE.Group();
  eDynamic.add(cwtGroup);
  addBox(cwtGroup, 0.72, 1.65, 0.14, darkStainlessMat, cabCx, 0.85, S.minZ + 0.14, false);
  const hoistCables = [];
  [-0.14, 0.0, 0.14].forEach((dx) => {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), cableMat);
    rope.position.set(cabCx + dx, 10.0, cabCz);
    eDynamic.add(rope);
    hoistCables.push(rope);
  });

  // ---- 5. PHYSICAL 3D COP PANEL INSIDE CAB (Mounted on South Interior Mullion, Easy Direct Tap!) ----
  addBox(cabGroup, 0.44, 0.92, 0.04, blackSteelMat, cabCx, 1.24, C.maxZ - 0.05, false);

  const copDefs = [
    { id: 'ext_elv_btn_rf', floor: 7, label: 'RF', accent: '#38bdf8', x: cabCx - 0.09, y: 1.44 },
    { id: 'ext_elv_btn_1f', floor: 1, label: '1F', accent: '#34d399', x: cabCx + 0.09, y: 1.44 },
    { id: 'ext_elv_btn_open', action: 'open', label: '開', accent: '#f59e0b', x: cabCx - 0.09, y: 1.06 },
    { id: 'ext_elv_btn_close', action: 'close', label: '閉', accent: '#f59e0b', x: cabCx + 0.09, y: 1.06 },
  ];

  const copButtonMats = new Map();
  copDefs.forEach((b) => {
    const offMat = makeButtonMat(b.label, b.accent, false);
    const litMat = makeButtonMat(b.label, b.accent, true);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.045), offMat);
    mesh.position.set(b.x, b.y, C.maxZ - 0.08);
    mesh.userData.propId = b.id;
    cabGroup.add(mesh);
    copButtonMats.set(b.id, { mesh, offMat, litMat, floor: b.floor });

    interactiveProps.push({
      id: b.id,
      floor: 1,
      isExtElevatorBtn: true,
      targetFloor: b.floor,
      elvAction: b.action || null,
      mesh,
      getLabel() { return b.label; },
    });
  });

  // Physical 3D Hall Call Buttons at 1F Ground Exterior (X=-1.58, Z=1.68) AND RF Attic (X=0.17, Z=1.68)
  const hallCallButtons = {};
  EXT_ELEVATOR.stops.forEach((st) => {
    const bx = st.doorSide === 'west' ? S.minX - 0.02 : S.maxX + 0.17;
    const offMat = makeButtonMat('呼出', '#38bdf8', false);
    const litMat = makeButtonMat('呼出', '#38bdf8', true);
    const callMesh = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.19, 0.19), offMat);
    callMesh.position.set(bx, st.y + 1.24, S.maxZ - 0.16);
    callMesh.userData.propId = `ext_elv_call_${st.floor}`;
    eDynamic.add(callMesh);
    hallCallButtons[st.floor] = { mesh: callMesh, offMat, litMat };

    interactiveProps.push({
      id: `ext_elv_call_${st.floor}`,
      floor: st.floor,
      isExtElevatorCall: true,
      callFloor: st.floor,
      mesh: callMesh,
      getLabel() { return '呼出'; },
    });
  });

  const { batchedGroup, stats: batchStats } = batchStaticGroups([eStatic]);
  root.add(batchedGroup);

  // ---- 6. SMOOTH S-CURVE MOTION CONTROLLER ----
  const state = {
    cabGroup,
    cabY: 0.0,
    prevCabY: 0.0,
    velY: 0.0,
    currentStopFloor: 1,
    targetFloor: 1,
    phase: 'IDLE_OPEN', // IDLE_OPEN | DOOR_CLOSING | RUNNING | DOOR_OPENING
    doorProgress: 1.0,
    doorHoldTimer: 4.5,
    queuedFloor: null,
    batchStats,

    getStopByFloor(fl) {
      return EXT_ELEVATOR.stops.find((s) => s.floor === fl) || EXT_ELEVATOR.stops[0];
    },

    _syncButtonGlow() {
      copButtonMats.forEach((entry) => {
        const lit = entry.floor !== undefined && (entry.floor === this.targetFloor && this.phase !== 'IDLE_OPEN');
        entry.mesh.material = lit ? entry.litMat : entry.offMat;
      });
      EXT_ELEVATOR.stops.forEach((st) => {
        const hb = hallCallButtons[st.floor];
        if (!hb) return;
        const lit = this.targetFloor === st.floor && this.phase !== 'IDLE_OPEN';
        hb.mesh.material = lit ? hb.litMat : hb.offMat;
      });
    },

    _syncDoorMeshes() {
      const stop = this.getStopByFloor(this.currentStopFloor);
      const slide = this.doorProgress * (cabLeafW * 0.94);

      // Only open the door side that matches the current stop floor!
      const westSlide = (stop.doorSide === 'west' && this.phase !== 'RUNNING') ? slide : 0;
      const eastSlide = (stop.doorSide === 'east' && this.phase !== 'RUNNING') ? slide : 0;

      cabDoors.west.left.position.z = doorCz - cabLeafW * 0.5 - westSlide;
      cabDoors.west.right.position.z = doorCz + cabLeafW * 0.5 + westSlide;
      cabDoors.east.left.position.z = doorCz - cabLeafW * 0.5 - eastSlide;
      cabDoors.east.right.position.z = doorCz + cabLeafW * 0.5 + eastSlide;

      EXT_ELEVATOR.stops.forEach((st) => {
        const ld = landingDoors[st.floor];
        if (!ld) return;
        const s = (st.floor === this.currentStopFloor && this.phase !== 'RUNNING') ? slide : 0;
        ld.leftLeaf.position.z = doorCz - ld.leafW * 0.5 - s;
        ld.rightLeaf.position.z = doorCz + ld.leafW * 0.5 + s;
      });
    },

    _syncMechanics() {
      cabGroup.position.y = this.cabY;
      // Counterweight travels opposite phase across 0..16.10m
      const cwtY = 16.10 - this.cabY;
      cwtGroup.position.y = cwtY;
      const ropeTop = S.topY - 0.34;
      const ropeBottom = this.cabY + cabH + 0.08;
      const ropeLen = Math.max(0.25, ropeTop - ropeBottom);
      hoistCables.forEach((r) => {
        r.scale.y = ropeLen;
        r.position.y = ropeBottom + ropeLen * 0.5;
      });
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
      this._syncButtonGlow();
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
        if (this.targetFloor !== this.currentStopFloor) {
          this.phase = 'DOOR_CLOSING';
        }
      }
    },

    snapToFloor(fl, open = true) {
      const st = this.getStopByFloor(fl);
      this.currentStopFloor = st.floor;
      this.targetFloor = st.floor;
      this.cabY = st.y;
      this.prevCabY = st.y;
      this.velY = 0;
      this.doorProgress = open ? 1.0 : 0.0;
      this.phase = 'IDLE_OPEN';
      this._syncMechanics();
      this._syncDoorMeshes();
      this._syncButtonGlow();
    },

    update(dt) {
      this.prevCabY = this.cabY;
      if (this.phase === 'DOOR_CLOSING') {
        this.doorProgress = Math.max(0, this.doorProgress - dt * 1.15);
        if (this.doorProgress <= 0.001) {
          this.doorProgress = 0;
          this.phase = 'RUNNING';
        }
      } else if (this.phase === 'RUNNING') {
        const tgt = this.getStopByFloor(this.targetFloor);
        const diff = tgt.y - this.cabY;
        const dist = Math.abs(diff);
        const dir = Math.sign(diff);
        const maxSpeed = 3.10;
        const decel = 1.65;
        const desiredV = Math.min(maxSpeed, Math.sqrt(Math.max(0, 2 * decel * dist)));
        const targetVel = dir * desiredV;
        const accelStep = 2.4 * dt;
        if (Math.abs(targetVel - this.velY) <= accelStep) this.velY = targetVel;
        else this.velY += Math.sign(targetVel - this.velY) * accelStep;

        this.cabY += this.velY * dt;
        if (dist < 0.035 && Math.abs(this.velY) < 0.35) {
          this.cabY = tgt.y;
          this.velY = 0;
          this.currentStopFloor = tgt.floor;
          this.phase = 'DOOR_OPENING';
          this.doorHoldTimer = 5.5;
        }
      } else if (this.phase === 'DOOR_OPENING') {
        this.doorProgress = Math.min(1.0, this.doorProgress + dt * 1.10);
        if (this.doorProgress >= 0.999) {
          this.doorProgress = 1.0;
          this.phase = 'IDLE_OPEN';
          this._syncButtonGlow();
        }
      } else if (this.phase === 'IDLE_OPEN') {
        if (this.queuedFloor !== null && this.queuedFloor !== this.currentStopFloor) {
          this.doorHoldTimer -= dt;
          if (this.doorHoldTimer <= 0) {
            this.targetFloor = this.queuedFloor;
            this.queuedFloor = null;
            this.phase = 'DOOR_CLOSING';
            this._syncButtonGlow();
          }
        }
      }
      this._syncMechanics();
      this._syncDoorMeshes();
      return this.phase !== 'IDLE_OPEN';
    },
  };

  state.snapToFloor(1, true);
  return state;
}
