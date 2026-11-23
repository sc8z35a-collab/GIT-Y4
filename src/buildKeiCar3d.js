import * as THREE from 'three';
import { KEI, KEI_PLAN } from './keiData.js';
import { makeSurfaceMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the protagonist's daily-driver Japanese Kei-Van ("KEI-340"):
 * - Exact Legal Kei Dimensions: W 1.48 m × L 3.40 m × H 1.80 m (Ground Y=-0.26 -> Roof Y=+1.54)
 * - Interior: ONLY ONE RHD Driver Seat (助手席レス・完全1人乗り仕様) + Full Walk-In Daily Cargo Bay
 *   (W 580 mm × L 2,140 mm open walk-in alley enterable via Left Sliding Door DK-L or Rear Liftgate DK-R!)
 * - Internally UV-baked static-batched inside a single movable THREE.Group (keiRoot)
 *   for zero per-part runtime draw-call overhead on POCO F7!
 */
export function buildKeiCar3D(ctx) {
  const {
    scene,
    exteriorGroup,
    mat,
    addBox,
    interactiveDoors,
    interactiveProps,
    interiorLights,
  } = ctx;

  const keiRoot = new THREE.Group();
  keiRoot.name = 'MovableDailyKeiVan';
  keiRoot.position.set(KEI.initialPose.cx, 0, KEI.initialPose.cz);
  keiRoot.rotation.y = KEI.initialPose.yaw;
  scene.add(keiRoot);

  // Compact concrete daily-driver parking bay right beside Main Tower North Entrance (World X=2.55..4.55, Z=-5.60..-1.65)
  addBox(exteriorGroup, 2.05, 0.08, 4.00, makeSurfaceMat('paver_granite_grid', 2.05, 4.00), 3.55, -0.30, -3.60, false);
  // Concrete wheel-stop curb at North end of daily bay
  addBox(exteriorGroup, 1.32, 0.09, 0.14, makeSurfaceMat('concrete_clean', 1.32, 0.14), 3.55, -0.22, -5.32, false);

  const keiStatic = new THREE.Group();
  const keiDynamic = new THREE.Group();
  keiRoot.add(keiDynamic);

  const rx = (kx) => kx - KEI.width / 2;   // -0.74 .. +0.74
  const rz = (kz) => kz - KEI.length / 2;  // -1.70 .. +1.70
  const yK = KEI.floorWorldY;              // +0.08
  const yG = KEI.groundY;                  // -0.26
  const yRoofSoffit = yK + KEI.interiorClearH; // +1.46 (Roof top = +1.54 -> exact 1.800m height!)

  const localColliders = [];
  const addLocalCollider = (minX, minZ, maxX, maxZ) => {
    localColliders.push({ minX, minZ, maxX, maxZ });
  };

  function addKBox(parent, w, h, d, material, kx, y, kz, castShadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(rx(kx), y, rz(kz));
    m.castShadow = castShadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Procedural authentic Japanese Yellow Kei-Car License Plate ("森 580 / わ 34-01")
  const makeKeiPlateMat = () => {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: 0xf2c738, roughness: 0.42, metalness: 0.08 });
    }
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#f2c738';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#1d1c16';
    c.lineWidth = 6;
    c.strokeRect(5, 5, 246, 118);
    c.fillStyle = '#2a2822';
    c.beginPath(); c.arc(52, 22, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(204, 22, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#181814';
    c.textAlign = 'center';
    c.font = '700 28px sans-serif';
    c.fillText('森 580', 128, 42);
    c.font = '700 54px monospace';
    c.fillText('34-01', 142, 104);
    c.font = '700 32px sans-serif';
    c.fillText('わ', 40, 96);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.40, metalness: 0.08 });
  };

  // Procedural Japanese Commercial Kei-Van Analog Speedometer & Fuel Cluster (Amber Backlit!)
  const makeKeiGaugeMat = () => {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: 0x17242b, emissive: new THREE.Color(0xe59638), emissiveIntensity: 0.85, roughness: 0.22 });
    }
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 196;
    const c = cv.getContext('2d');
    c.fillStyle = '#101318';
    c.fillRect(0, 0, 512, 196);
    c.strokeStyle = '#333a45';
    c.lineWidth = 6;
    c.strokeRect(4, 4, 504, 188);
    // Main round speedometer (left-center)
    const cx1 = 180;
    const cy1 = 102;
    c.fillStyle = '#191c22';
    c.beginPath(); c.arc(cx1, cy1, 78, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f2a944';
    c.lineWidth = 3;
    c.beginPath(); c.arc(cx1, cy1, 76, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i <= 14; i++) {
      const ang = (Math.PI * 0.78) + (i / 14) * (Math.PI * 1.44);
      const rIn = i % 2 === 0 ? 58 : 65;
      c.strokeStyle = i >= 12 ? '#ef4444' : '#ffd285';
      c.lineWidth = i % 2 === 0 ? 3 : 1.5;
      c.beginPath();
      c.moveTo(cx1 + Math.cos(ang) * rIn, cy1 + Math.sin(ang) * rIn);
      c.lineTo(cx1 + Math.cos(ang) * 73, cy1 + Math.sin(ang) * 73);
      c.stroke();
    }
    // Speedo needle at 0 km/h + hub
    const nAng = Math.PI * 0.78;
    c.strokeStyle = '#ff642e';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx1, cy1);
    c.lineTo(cx1 + Math.cos(nAng) * 58, cy1 + Math.sin(nAng) * 58);
    c.stroke();
    c.fillStyle = '#d4d8df';
    c.beginPath(); c.arc(cx1, cy1, 8, 0, Math.PI * 2); c.fill();
    // Digital ODO readout inside speedo
    c.fillStyle = '#e59638';
    c.fillRect(cx1 - 36, cy1 + 26, 72, 22);
    c.fillStyle = '#14120c';
    c.font = '700 13px monospace';
    c.textAlign = 'center';
    c.fillText('048210', cx1, cy1 + 42);
    c.fillStyle = '#ffd699';
    c.font = '700 13px sans-serif';
    c.fillText('km/h', cx1, cy1 - 24);
    // Secondary Fuel & Temp sub-dial (right)
    const cx2 = 360;
    const cy2 = 104;
    c.fillStyle = '#191c22';
    c.beginPath(); c.arc(cx2, cy2, 62, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f2a944';
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(cx2, cy2, 60, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffd285';
    c.font = '700 16px monospace';
    c.fillText('F   E', cx2, cy2 - 22);
    c.fillText('660cc', cx2, cy2 + 34);
    c.strokeStyle = '#ff642e';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(cx2, cy2 + 4);
    c.lineTo(cx2 - 28, cy2 - 22);
    c.stroke();
    // Green headlamp / gear indicator lamps
    c.fillStyle = '#38d39f';
    c.fillRect(38, 28, 30, 14);
    c.fillStyle = '#f2c738';
    c.fillRect(436, 28, 34, 14);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffb45c),
      emissiveIntensity: 0.95,
      roughness: 0.22,
    });
  };

  // Automotive materials (Commercial Satin Ivory Kei Body + Matte Black Trim + Yellow Kei License Plate!)
  const bodyPaintMat = new THREE.MeshStandardMaterial({ color: 0xd8ddd6, roughness: 0.36, metalness: 0.18 });
  const intSteelMat = new THREE.MeshStandardMaterial({ color: 0xb4bab2, roughness: 0.58, metalness: 0.15 });
  const trimBlackMat = new THREE.MeshStandardMaterial({ color: 0x1e2126, roughness: 0.72, metalness: 0.18 });
  const archBackMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.94, metalness: 0.05 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.92, metalness: 0.04 });
  const steelWheelMat = new THREE.MeshStandardMaterial({ color: 0x7a828c, roughness: 0.38, metalness: 0.65 });
  const plateYellowMat = makeKeiPlateMat();
  const headLensMat = new THREE.MeshStandardMaterial({ color: 0xf6f9ff, emissive: new THREE.Color(0xddeeff), emissiveIntensity: 1.5, roughness: 0.14 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffa630, emissive: new THREE.Color(0xe68414), emissiveIntensity: 1.4, roughness: 0.25 });
  const tailRedMat = new THREE.MeshStandardMaterial({ color: 0xc92626, emissive: new THREE.Color(0xb81a1a), emissiveIntensity: 1.5, roughness: 0.25 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.66, metalness: 0.15 });
  const gaugeMat = makeKeiGaugeMat();
  const domeLedMat = new THREE.MeshStandardMaterial({ color: 0xfff2dc, emissive: new THREE.Color(0xffdfa8), emissiveIntensity: 1.6, roughness: 0.2 });
  const oriconOliveMat = new THREE.MeshStandardMaterial({ color: 0x45543e, roughness: 0.62, metalness: 0.06 });
  const oriconNavyMat = new THREE.MeshStandardMaterial({ color: 0x2c3f59, roughness: 0.62, metalness: 0.06 });
  const coolerGreenMat = new THREE.MeshStandardMaterial({ color: 0x2d5e48, roughness: 0.44, metalness: 0.08 });
  const tarpBlueMat = new THREE.MeshStandardMaterial({ color: 0x234c78, roughness: 0.78, metalness: 0.02 });
  const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xa6855b, roughness: 0.88, metalness: 0.0 });
  const redBoxMat = new THREE.MeshStandardMaterial({ color: 0xa82e24, roughness: 0.48, metalness: 0.12 });
  const seatFabricMat = makeSurfaceMat('fabric_denim', 0.55, 0.55, { color: 0x4b5563 });
  const plyMat = makeSurfaceMat('plywood_attic', 1.4, 2.2);
  const rubberMat = makeSurfaceMat('rubber_black_stud', 1.4, 2.6);
  const crateMat = makeSurfaceMat('crate_wood', 0.45, 0.45);

  function addKWallBox(w, h, d, kx, y, kz, axis, extIsPos = true) {
    const cap = trimBlackMat;
    const ext = bodyPaintMat;
    const inner = intSteelMat;
    let mats;
    if (axis === 'h') {
      // North wall (z=0): -Z (face 5) is ext, +Z (face 4) is inner; South wall (z=3.4): +Z is ext
      mats = extIsPos ? [cap, cap, cap, cap, ext, inner] : [cap, cap, cap, cap, inner, ext];
    } else {
      // East wall (x=1.48): +X (face 0) is ext, -X (face 1) is inner; West wall (x=0): -X is ext
      mats = extIsPos ? [ext, inner, cap, cap, cap, cap] : [inner, ext, cap, cap, cap, cap];
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(rx(kx), y, rz(kz));
    m.castShadow = true;
    m.receiveShadow = true;
    keiStatic.add(m);
    return m;
  }

  function addKWindowFrame(op, wall) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const midO = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const mid = op.pos + op.width / 2;
    const cy = yK + op.sill + op.height / 2;
    const f = 0.024;
    if (isH) {
      addKBox(keiStatic, op.width, f, thick + 0.012, trimBlackMat, mid, yK + op.sill + f / 2, midO, false);
      addKBox(keiStatic, op.width, f, thick + 0.012, trimBlackMat, mid, yK + op.sill + op.height - f / 2, midO, false);
      addKBox(keiStatic, f, Math.max(0.02, op.height - f * 2), thick + 0.012, trimBlackMat, op.pos + f / 2, cy, midO, false);
      addKBox(keiStatic, f, Math.max(0.02, op.height - f * 2), thick + 0.012, trimBlackMat, op.pos + op.width - f / 2, cy, midO, false);
      addKBox(keiStatic, op.width - f * 2, op.height - f * 2, 0.012, mat.glassClear, mid, cy, midO, false);
    } else {
      addKBox(keiStatic, thick + 0.012, f, op.width, trimBlackMat, midO, yK + op.sill + f / 2, mid, false);
      addKBox(keiStatic, thick + 0.012, f, op.width, trimBlackMat, midO, yK + op.sill + op.height - f / 2, mid, false);
      addKBox(keiStatic, thick + 0.012, Math.max(0.02, op.height - f * 2), f, trimBlackMat, midO, cy, op.pos + f / 2, false);
      addKBox(keiStatic, thick + 0.012, Math.max(0.02, op.height - f * 2), f, trimBlackMat, midO, cy, op.pos + op.width - f / 2, false);
      addKBox(keiStatic, 0.012, op.height - f * 2, op.width - f * 2, mat.glassClear, midO, cy, mid, false);
    }
  }

  /**
   * Builds the 3 realistic movable kei-van doors:
   * - DK-D: Right front RHD swing-out door (with half-height window glass + exterior handle)
   * - DK-L: Left exterior sliding cargo door (with window glass + handle, slides rearward along rail!)
   * - DK-R: Top-hinged upward-swinging rear liftgate hatchback (with rear window + yellow kei plate!)
   */
  function addKeiDoor(op, wall) {
    const isH = wall.axis === 'h';
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const midO = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const sillY = yK + (op.sill || 0);
    const doorW = op.width;
    const doorH = op.height;
    const lowerH = 0.68; // Solid lower steel panel (window sits above!)
    const winH = doorH - lowerH - 0.06;
    const leafT = 0.036;
    const makePanel = (w, h, d, m = bodyPaintMat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Dark weatherstrip trim frame around opening (jambs stop below header — zero corner Z-fighting!)
    const jambH = Math.max(0.04, doorH - 0.025);
    if (isH) {
      addKBox(keiStatic, 0.025, jambH, thick + 0.008, trimBlackMat, op.pos + 0.012, sillY + jambH / 2, midO, false);
      addKBox(keiStatic, 0.025, jambH, thick + 0.008, trimBlackMat, op.pos + doorW - 0.012, sillY + jambH / 2, midO, false);
      addKBox(keiStatic, doorW, 0.025, thick + 0.008, trimBlackMat, op.pos + doorW / 2, sillY + doorH - 0.012, midO, false);
    } else {
      addKBox(keiStatic, thick + 0.008, jambH, 0.025, trimBlackMat, midO, sillY + jambH / 2, op.pos + 0.012, false);
      addKBox(keiStatic, thick + 0.008, jambH, 0.025, trimBlackMat, midO, sillY + jambH / 2, op.pos + doorW - 0.012, false);
      addKBox(keiStatic, thick + 0.008, 0.025, doorW, trimBlackMat, midO, sillY + doorH - 0.012, op.pos + doorW / 2, false);
    }

    const pivot = new THREE.Group();
    let hitMesh;

    if (op.type === 'door_liftgate') {
      // Top-hinged Rear Liftgate Hatch DK-R! Pivots UP around X axis at roof top edge!
      const cx = op.pos + doorW / 2;
      pivot.position.set(rx(cx), sillY + doorH, rz(midO));
      // Lower solid panel (hangs downward from top hinge: local y = -doorH .. -doorH + lowerH)
      const lowerMesh = makePanel(doorW - 0.02, lowerH, leafT);
      lowerMesh.position.set(0, -doorH + lowerH / 2, 0);
      lowerMesh.userData.doorId = op.id;
      const topBar = makePanel(doorW - 0.02, 0.06, leafT);
      topBar.position.set(0, -0.03, 0);
      const lPillar = makePanel(0.07, winH, leafT);
      lPillar.position.set(-doorW / 2 + 0.045, -0.06 - winH / 2, 0);
      const rPillar = makePanel(0.07, winH, leafT);
      rPillar.position.set(doorW / 2 - 0.045, -0.06 - winH / 2, 0);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.16, winH, 0.014), mat.glassClear);
      glass.position.set(0, -0.06 - winH / 2, 0);
      glass.userData.doorId = op.id;
      // Rear yellow Kei-Car License Plate ("森 580 / わ 34-01") + black latch handle mounted on tailgate!
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.165, 0.012), plateYellowMat);
      plate.position.set(0, -doorH + 0.24, leafT / 2 + 0.008);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.025), trimBlackMat);
      handle.position.set(0, -doorH + 0.44, leafT / 2 + 0.012);
      hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.02, doorH - 0.02, 0.09),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false }),
      );
      hitMesh.position.set(0, -doorH / 2, 0);
      hitMesh.userData.doorId = op.id;

      pivot.add(lowerMesh, topBar, lPillar, rPillar, glass, plate, handle, hitMesh);
      keiDynamic.add(pivot);

      interactiveDoors.push({
        id: op.id,
        floor: 1,
        building: 'kei',
        isKei: true,
        label: op.label,
        kind: 'liftgate',
        pivot,
        mesh: hitMesh,
        openAngle: -1.42, // Swings UPWARD & OUTWARD (+Z rear lifts up to +Y sky!)
        progress: 0,
        isOpen: false,
        collider: { minX: op.pos, minZ: wall.z1 - 0.04, maxX: op.pos + doorW, maxZ: wall.z2 + 0.04 },
      });
    } else if (op.type === 'door_slide_ext') {
      // Left Exterior Sliding Cargo Door DK-L! Mounted cleanly outboard of the hull & rear slide track!
      const cz = op.pos + doorW / 2;
      pivot.position.set(rx(midO - 0.046), sillY + doorH / 2, rz(cz));
      const lowerMesh = makePanel(leafT, lowerH, doorW - 0.02);
      lowerMesh.position.set(0, -doorH / 2 + lowerH / 2, 0);
      const topBar = makePanel(leafT, 0.06, doorW - 0.02);
      topBar.position.set(0, doorH / 2 - 0.03, 0);
      const fPillar = makePanel(leafT, winH, 0.06);
      fPillar.position.set(0, doorH / 2 - 0.06 - winH / 2, -doorW / 2 + 0.04);
      const bPillar = makePanel(leafT, winH, 0.06);
      bPillar.position.set(0, doorH / 2 - 0.06 - winH / 2, doorW / 2 - 0.04);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.012, winH, doorW - 0.14), mat.glassClear);
      glass.position.set(0, doorH / 2 - 0.06 - winH / 2, 0);
      // Matching lower black rub strip mounted directly on sliding door outer face!
      const doorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.042, doorW - 0.04), trimBlackMat);
      doorStrip.position.set(-leafT / 2 - 0.005, -doorH / 2 + 0.26, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.12), trimBlackMat);
      handle.position.set(-leafT / 2 - 0.012, -0.05, -doorW / 2 + 0.14);
      hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, doorH - 0.02, doorW - 0.02),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false }),
      );
      hitMesh.userData.doorId = op.id;

      pivot.add(lowerMesh, topBar, fPillar, bPillar, glass, doorStrip, handle, hitMesh);
      keiDynamic.add(pivot);

      interactiveDoors.push({
        id: op.id,
        floor: 1,
        building: 'kei',
        isKei: true,
        label: op.label,
        kind: 'pocket',
        axis: 'z',
        pivot,
        mesh: hitMesh,
        closedPos: pivot.position.clone(),
        slideDelta: (op.slideDir || 1) * (doorW - 0.06),
        progress: 0,
        isOpen: false,
        collider: { minX: wall.x1 - 0.04, minZ: op.pos, maxX: wall.x2 + 0.04, maxZ: op.pos + doorW },
      });
    } else {
      // Right Front RHD Driver Swing-Out Door DK-D! Hinged at front edge (op.pos = 0.34), swings outward (+X)!
      pivot.position.set(rx(midO), sillY, rz(op.pos));
      const lowerMesh = makePanel(leafT, lowerH, doorW - 0.02);
      lowerMesh.position.set(0, lowerH / 2, doorW / 2);
      const topBar = makePanel(leafT, 0.055, doorW - 0.02);
      topBar.position.set(0, doorH - 0.028, doorW / 2);
      const fPillar = makePanel(leafT, winH, 0.055);
      fPillar.position.set(0, lowerH + winH / 2, 0.035);
      const bPillar = makePanel(leafT, winH, 0.055);
      bPillar.position.set(0, lowerH + winH / 2, doorW - 0.035);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.012, winH, doorW - 0.13), mat.glassClear);
      glass.position.set(0, lowerH + winH / 2, doorW / 2);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.038, 0.11), trimBlackMat);
      handle.position.set(leafT / 2 + 0.012, 0.62, doorW - 0.14);
      hitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, doorH - 0.02, doorW - 0.02),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false }),
      );
      hitMesh.position.set(0, doorH / 2, doorW / 2);
      hitMesh.userData.doorId = op.id;

      pivot.add(lowerMesh, topBar, fPillar, bPillar, glass, handle, hitMesh);
      keiDynamic.add(pivot);

      interactiveDoors.push({
        id: op.id,
        floor: 1,
        building: 'kei',
        isKei: true,
        label: op.label,
        kind: 'swing',
        pivot,
        mesh: hitMesh,
        openAngle: 1.18, // Swings outward (+X) cleanly around front hinge!
        progress: 0,
        isOpen: false,
        collider: { minX: wall.x1 - 0.04, minZ: op.pos, maxX: wall.x2 + 0.04, maxZ: op.pos + doorW },
      });
    }
  }

  // =========================================================================
  // 1. KEI-VAN CHASSIS, BUMPERS, YELLOW PLATES, LIGHTS, MIRRORS & 4 WHEELS
  // =========================================================================
  // Underbody monocoque chassis & flat cargo floor sub-deck (strictly stacked — zero Z-fighting!)
  addKBox(keiStatic, 1.38, 0.114, 3.30, trimBlackMat, 0.74, yK - 0.062, 1.70, true);
  // Finished interior plywood sub-floor + anti-slip black ribbed cargo mat
  addKBox(keiStatic, 1.36, 0.012, 3.28, plyMat, 0.74, yK + 0.006, 1.70, false);
  addKBox(keiStatic, 1.32, 0.008, 2.12, rubberMat, 0.74, yK + 0.017, 2.25, false);

  // Rugged Matte-Black Commercial Kei Bumpers (Front & Rear)
  addKBox(keiStatic, 1.50, 0.28, 0.10, trimBlackMat, 0.74, yK + 0.09, -0.05, true);
  addKBox(keiStatic, 1.50, 0.24, 0.09, trimBlackMat, 0.74, yK + 0.08, 3.445, true);
  // Front intake grille slats & Yellow Kei License Plate ("森 580 / わ 34-01")
  addKBox(keiStatic, 0.86, 0.12, 0.03, archBackMat, 0.74, yK + 0.34, -0.015, false);
  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.165, 0.016), plateYellowMat);
  frontPlate.position.set(rx(0.74), yK + 0.11, rz(-0.104));
  frontPlate.rotation.y = Math.PI;
  frontPlate.userData.noBatch = true;
  keiDynamic.add(frontPlate);

  // Front Headlights + Amber Turn Indicators + Windshield Wipers
  [0.24, 1.24].forEach((hx) => {
    addKBox(keiStatic, 0.24, 0.14, 0.03, headLensMat, hx, yK + 0.44, -0.015, false);
    addKBox(keiStatic, 0.08, 0.14, 0.03, amberMat, hx < 0.74 ? 0.08 : 1.40, yK + 0.44, -0.015, false);
    addKBox(keiStatic, 0.10, 0.33, 0.03, tailRedMat, hx < 0.74 ? 0.08 : 1.40, yK + 0.335, 3.415, false);
    addKBox(keiStatic, 0.10, 0.10, 0.03, amberMat, hx < 0.74 ? 0.08 : 1.40, yK + 0.56, 3.415, false);
  });
  addKBox(keiStatic, 0.26, 0.035, 0.025, tailRedMat, 0.74, yRoofSoffit + 0.03, 3.412, false);
  [0.44, 1.04].forEach((wx) => {
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.016, 0.016), trimBlackMat);
    wiper.position.set(rx(wx), yK + 0.75, rz(-0.012));
    wiper.rotation.z = 0.14;
    keiStatic.add(wiper);
  });

  // Recessed Left Sliding Door Track Rail & side moldings
  addKBox(keiStatic, 0.012, 0.032, 1.18, trimBlackMat, -0.004, yK + 0.62, 2.70, false);
  addKBox(keiStatic, 0.014, 0.042, 1.12, trimBlackMat, -0.005, yK + 0.28, 0.66, false);
  addKBox(keiStatic, 0.014, 0.042, 1.18, trimBlackMat, -0.005, yK + 0.28, 2.70, false);
  addKBox(keiStatic, 0.018, 0.042, 3.16, trimBlackMat, 1.490, yK + 0.28, 1.70, false);

  // Folding Black Kei Side Mirrors (Left & Right at A-pillars)
  [-0.10, 1.58].forEach((mx) => {
    addKBox(keiStatic, 0.04, 0.18, 0.09, trimBlackMat, mx, yK + 0.90, 0.34, false);
    addKBox(keiStatic, 0.12, 0.025, 0.025, trimBlackMat, mx < 0.5 ? -0.04 : 1.52, yK + 0.86, 0.34, false);
  });

  // Insulated High-Roof Shell
  addKBox(keiStatic, 1.50, KEI.roofThick, 3.42, bodyPaintMat, 0.74, yRoofSoffit + KEI.roofThick / 2, 1.70, true);
  [0.08, 1.40].forEach((rxBar) => {
    addKBox(keiStatic, 0.03, 0.025, 3.12, trimBlackMat, rxBar, yRoofSoffit + KEI.roofThick + 0.014, 1.72, false);
  });
  [0.95, 1.75, 2.55].forEach((ribZ) => {
    addKBox(keiStatic, 1.36, 0.028, 0.045, intSteelMat, 0.74, yRoofSoffit - 0.015, ribZ, false);
  });
  addKBox(keiStatic, 0.12, 0.022, 0.42, domeLedMat, 0.74, yRoofSoffit - 0.012, 1.90, false);

  // Recessed Matte-Black Wheel-Well Arches + Fender Lips
  const buildKeiFender = (sideX, zCenter) => {
    const wallX = sideX < 0.5 ? -0.012 : 1.492;
    const lipX = sideX < 0.5 ? -0.052 : 1.532;
    addKBox(keiStatic, 0.03, 0.36, 0.64, archBackMat, wallX, yK + 0.10, zCenter, false);
    addKBox(keiStatic, 0.11, 0.04, 0.70, trimBlackMat, lipX, yK + 0.29, zCenter, false);
    addKBox(keiStatic, 0.10, 0.28, 0.035, trimBlackMat, lipX, yK + 0.12, zCenter - 0.34, false);
    addKBox(keiStatic, 0.10, 0.28, 0.035, trimBlackMat, lipX, yK + 0.12, zCenter + 0.34, false);
  };
  KEI.axlesZ.forEach((az) => {
    buildKeiFender(0, az);
    buildKeiFender(1.48, az);
  });

  // 4 Rotating 145/80R12 Kei-Van Tires (staggered lug width — zero cross-bar Z-fighting!)
  const wheelMeshes = [];
  const frontSteerPivots = [];
  const tireGeo = new THREE.CylinderGeometry(KEI.wheelRadius, KEI.wheelRadius, KEI.wheelWidth, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(KEI.wheelRadius * 0.55, KEI.wheelRadius * 0.55, KEI.wheelWidth + 0.016, 12);
  rimGeo.rotateZ(Math.PI / 2);

  KEI.axlesZ.forEach((az, axleIdx) => {
    [-0.01, 1.49].forEach((wx) => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(rx(wx), yG + KEI.wheelRadius, rz(az));
      const spinGroup = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, steelWheelMat);
      const lugA = new THREE.Mesh(new THREE.BoxGeometry(KEI.wheelWidth + 0.024, 0.035, 0.18), trimBlackMat);
      const lugB = new THREE.Mesh(new THREE.BoxGeometry(KEI.wheelWidth + 0.019, 0.18, 0.035), trimBlackMat);
      spinGroup.add(tire, rim, lugA, lugB);
      steerPivot.add(spinGroup);
      keiDynamic.add(steerPivot);
      wheelMeshes.push(spinGroup);
      if (axleIdx === 0) frontSteerPivots.push(steerPivot);
    });
  });

  // =========================================================================
  // 2. BUILD EXTERIOR WALL SHELL, WINDOWS & 3 MOVABLE DOORS (DK-D, DK-L, DK-R)
  // =========================================================================
  const wallH = KEI.interiorClearH; // 1.38m
  for (const wall of KEI_PLAN.walls) {
    const isH = wall.axis === 'h';
    const extIsPos = isH ? wall.z1 > 1.5 : wall.x1 > 0.7;
    const start = isH ? wall.x1 : wall.z1;
    const end = isH ? wall.x2 : wall.z2;
    const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
    const centerO = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
    const ops = [...(wall.openings || [])].sort((a, b) => a.pos - b.pos);

    let cursor = start;
    for (const op of ops) {
      if (op.pos > cursor + 0.004) {
        const seg = op.pos - cursor;
        const mid = cursor + seg / 2;
        if (isH) {
          addKWallBox(seg, wallH, thick, mid, yK + wallH / 2, centerO, 'h', extIsPos);
          addLocalCollider(cursor, wall.z1, op.pos, wall.z2);
        } else {
          addKWallBox(thick, wallH, seg, centerO, yK + wallH / 2, mid, 'v', extIsPos);
          addLocalCollider(wall.x1, cursor, wall.x2, op.pos);
        }
      }
      const opMid = op.pos + op.width / 2;
      const opSill = Math.max(0, op.sill || 0);
      const opTop = opSill + op.height;
      if (opSill > 0.04) {
        if (isH) {
          addKWallBox(op.width, opSill, thick, opMid, yK + opSill / 2, centerO, 'h', extIsPos);
          addLocalCollider(op.pos, wall.z1, op.pos + op.width, wall.z2);
        } else {
          addKWallBox(thick, opSill, op.width, centerO, yK + opSill / 2, opMid, 'v', extIsPos);
          addLocalCollider(wall.x1, op.pos, wall.x2, op.pos + op.width);
        }
      }
      if (opTop < wallH - 0.01) {
        const headH = wallH - opTop;
        if (isH) addKWallBox(op.width, headH, thick, opMid, yK + opTop + headH / 2, centerO, 'h', extIsPos);
        else addKWallBox(thick, headH, op.width, centerO, yK + opTop + headH / 2, opMid, 'v', extIsPos);
      }
      if (op.type.startsWith('door')) addKeiDoor(op, wall);
      else addKWindowFrame(op, wall);
      cursor = op.pos + op.width;
    }
    if (end > cursor + 0.004) {
      const seg = end - cursor;
      const mid = cursor + seg / 2;
      if (isH) {
        addKWallBox(seg, wallH, thick, mid, yK + wallH / 2, centerO, 'h', extIsPos);
        addLocalCollider(cursor, wall.z1, end, wall.z2);
      } else {
        addKWallBox(thick, wallH, seg, centerO, yK + wallH / 2, mid, 'v', extIsPos);
        addLocalCollider(wall.x1, cursor, wall.x2, end);
      }
    }
  }

  // =========================================================================
  // 3. SINGLE RHD DRIVER SEAT ONLY (K01) + PASSENGER-DELETE CARGO DECK (K02)
  // =========================================================================
  addKBox(keiStatic, 1.36, 0.38, 0.28, dashMat, 0.74, yK + 0.53, 0.20, true);
  addKBox(keiStatic, 0.34, 0.13, 0.04, gaugeMat, 1.08, yK + 0.74, 0.31, false);
  addKBox(keiStatic, 0.22, 0.16, 0.04, archBackMat, 0.74, yK + 0.62, 0.345, false);
  [0.94, 1.06, 1.18].forEach((px) => {
    addKBox(keiStatic, 0.05, 0.10, 0.02, mat.chrome, px, yK + 0.14, 0.22, false);
  });
  addKBox(keiStatic, 0.025, 0.34, 0.025, mat.darkIron, 0.76, yK + 0.22, 0.58, false);
  addKBox(keiStatic, 0.05, 0.05, 0.05, trimBlackMat, 0.76, yK + 0.40, 0.58, false);
  addKBox(keiStatic, 0.03, 0.04, 0.22, trimBlackMat, 0.76, yK + 0.14, 0.84, false);
  addLocalCollider(0.06, 0.06, 1.42, 0.38);

  addKBox(keiStatic, 0.46, 0.16, 0.44, seatFabricMat, 1.08, yK + 0.26, 0.80, true);
  addKBox(keiStatic, 0.42, 0.16, 0.40, trimBlackMat, 1.08, yK + 0.095, 0.80, false);
  addKBox(keiStatic, 0.44, 0.52, 0.09, seatFabricMat, 1.08, yK + 0.58, 1.00, true);
  addKBox(keiStatic, 0.22, 0.16, 0.07, seatFabricMat, 1.08, yK + 0.94, 1.01, false);
  addKBox(keiStatic, 0.60, 0.035, 0.035, trimBlackMat, 1.09, yK + 0.84, 1.15, false);
  addKBox(keiStatic, 0.035, 0.81, 0.035, trimBlackMat, 0.80, yK + 0.415, 1.15, false);
  addLocalCollider(0.80, 0.56, 1.38, 1.16);

  const steerWheelGroup = new THREE.Group();
  steerWheelGroup.position.set(rx(KEI.steerWheelLocal.x), yK + 0.76, rz(KEI.steerWheelLocal.z));
  steerWheelGroup.rotation.x = 0.52;
  const wheelTorus = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.019, 8, 18), dashMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.036, 10), trimBlackMat);
  wheelHub.rotation.x = Math.PI / 2;
  const wheelSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.024, 0.02), mat.chrome);
  const driveHitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.52, 0.56),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false }),
  );
  driveHitMesh.userData.propId = 'kei_drive';
  steerWheelGroup.add(wheelTorus, wheelHub, wheelSpoke, driveHitMesh);
  keiDynamic.add(steerWheelGroup);

  addKBox(keiStatic, 0.26, 0.24, 0.44, oriconNavyMat, 0.21, yK + 0.14, 0.68, true);
  addKBox(keiStatic, 0.06, 0.06, 0.68, trimBlackMat, 0.12, yK + 0.05, 0.82, false);
  addLocalCollider(0.06, 0.44, 0.36, 0.94);

  // =========================================================================
  // 4. WALK-IN DAILY CARGO BAY (K03: W 580mm OPEN ALLEY + LIVED-IN CARGO!)
  // =========================================================================
  addKBox(keiStatic, 0.18, 0.22, 0.62, intSteelMat, 0.15, yK + 0.13, 2.66, false);
  addKBox(keiStatic, 0.18, 0.22, 0.62, intSteelMat, 1.33, yK + 0.13, 2.66, false);

  addKBox(keiStatic, 0.34, 0.028, 1.88, mat.oak, 1.24, yK + 0.52, 2.30, true);
  addKBox(keiStatic, 0.34, 0.028, 1.88, mat.oak, 1.24, yK + 0.96, 2.30, true);
  [1.38, 2.30, 3.22].forEach((pz) => {
    addKBox(keiStatic, 0.035, 0.915, 0.035, mat.darkIron, 1.08, yK + 0.482, pz, false); // Stops cleanly below top shelf!
  });
  // Daily-driver cargo items on right rack: Folding containers (オリコン), cardboard box, red emergency kit
  addKBox(keiStatic, 0.30, 0.28, 0.46, oriconOliveMat, 1.24, yK + 0.16, 1.66, true); // Floor olive oricon
  addKBox(keiStatic, 0.30, 0.28, 0.46, oriconNavyMat, 1.24, yK + 0.68, 1.66, true);  // Shelf navy oricon
  addKBox(keiStatic, 0.28, 0.26, 0.44, cardboardMat, 1.24, yK + 0.67, 2.28, true);   // Daily parcel box
  addKBox(keiStatic, 0.28, 0.24, 0.38, redBoxMat, 1.24, yK + 0.66, 2.94, false);     // Red emergency kit
  addKBox(keiStatic, 0.28, 0.24, 0.42, crateMat, 1.24, yK + 1.10, 2.15, false);      // Upper wooden crate
  addKBox(keiStatic, 0.02, 0.42, 0.64, makeSurfaceMat('pegboard_wood', 0.64, 0.42), 1.40, yK + 0.74, 2.86, false);
  addLocalCollider(1.05, 1.30, 1.42, 3.28);

  // Left Rear Cargo Zone (aft of Left Sliding Door DK-L: kx = 0.07..0.41, kz = 2.24..3.28)
  addKBox(keiStatic, 0.32, 0.34, 0.48, coolerGreenMat, 0.24, yK + 0.19, 2.52, true); // Daily camp/grocery cooler
  addKBox(keiStatic, 0.32, 0.04, 0.48, mat.whiteMatte, 0.24, yK + 0.37, 2.52, false); // White cooler lid
  addKBox(keiStatic, 0.32, 0.30, 0.44, crateMat, 0.24, yK + 0.17, 3.04, true);       // Rear wood supply crate
  // Rolled blue waterproof tarp resting atop rear crate
  const tarpRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.56, 10), tarpBlueMat);
  tarpRoll.rotation.x = Math.PI / 2;
  tarpRoll.position.set(rx(0.24), yK + 0.42, rz(2.96));
  keiStatic.add(tarpRoll);
  addLocalCollider(0.06, 2.24, 0.42, 3.30);

  // =========================================================================
  // 5. KEI-VAN INTERIOR DOME LIGHT (building='kei') & TWIN LED HEADLIGHTS
  // =========================================================================
  const domeLight = new THREE.PointLight(0xffdfa8, 0, 4.8, 1.45);
  domeLight.position.set(rx(0.74), yRoofSoffit - 0.10, rz(1.85));
  domeLight.visible = false;
  domeLight.userData.building = 'kei';
  keiRoot.add(domeLight);
  interiorLights.push({ name: 'Kei_Dome', floor: 1, zone: 'mid', light: domeLight, baseInt: 2.15 });

  // Twin Front Headlights (SpotLight mounted inside keiRoot, aimed forward along -Z!)
  const headlights = [];
  [0.28, 1.20].forEach((hx) => {
    const spot = new THREE.SpotLight(0xfff4df, 0.0, 28.0, Math.PI * 0.24, 0.48, 1.30);
    spot.position.set(rx(hx), yK + 0.44, rz(-0.10));
    const target = new THREE.Object3D();
    target.position.set(rx(hx), yG - 0.3, rz(-15.0));
    keiRoot.add(spot, target);
    spot.target = target;
    headlights.push(spot);
  });

  // =========================================================================
  // 6. INTERNAL UV-BAKED STATIC BATCHING INSIDE MOVABLE KEI ROOT
  // =========================================================================
  const { batchedGroup: keiBatched, stats: keiBatchStats } = batchStaticGroups([keiStatic]);
  keiRoot.add(keiBatched);

  // Interactive Driving Seat Controller Prop
  const driveProp = {
    id: 'kei_drive',
    floor: 1,
    building: 'kei',
    mesh: driveHitMesh,
    isOn: false,
    getLabel() {
      return this.isOn ? '軽自動車を停車して降りる' : '運転席に乗る（軽自動車を運転する）';
    },
    toggle() {
      // Handled directly by scene3d.js toggleVehicleDrive('kei')!
    },
  };
  interactiveProps.push(driveProp);

  return {
    root: keiRoot,
    pose: { cx: KEI.initialPose.cx, cz: KEI.initialPose.cz, yaw: KEI.initialPose.yaw },
    speed: 0,
    steerAngle: 0,
    headlightsOn: false,
    headlights,
    wheelMeshes,
    frontSteerPivots,
    steerWheelGroup,
    driveProp,
    localColliders,
    batchStats: keiBatchStats,
  };
}
