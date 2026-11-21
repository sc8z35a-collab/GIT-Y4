import * as THREE from 'three';
import { FLOOR_B2F, FLOOR_B3F, STAIR_B1_B2, STAIR_B2_B3 } from './deepBasementData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the entire Deep Basement Expansion:
 * 1) B1F Elevator Vestibule + Enclosed Concrete Stair ST_B2 (B1F -> B2F Studio Door DB2-0)
 * 2) B2F (Y = -6.60m, CH = 3.80m): 10m×10m Wood-Floor + Concrete & Full-Mirror Studio (B201)
 *    + Direct-Connected 4m×6m Control/Recording Room (B202) + 6m×4m Lounge/Gear Room (B203)
 *    + Enclosed Concrete Stair ST_B3 (B2F -> B3F Shelter Door DB3-ST)
 * 3) B3F (Y = -10.20m, CH = 2.80m): W 520mm (1.3× protagonist Ø400mm) Narrow Elevator Corridor (B300)
 *    + 3.2m×12.5m Warm Wooden Shelter (Living B301, Shower B302, Toilet B303, Bedroom B304)
 *    + Rear Vault Door DB3-FD -> 2.0m×6.0m Food Storage Warehouse (B305)
 */
export function buildDeepBasement3D(ctx) {
  const {
    scene,
    mat,
    addCollider,
    addInteractiveDoor,
    interiorLights,
  } = ctx;

  const deepRoot = new THREE.Group();
  deepRoot.name = 'DeepBasementB2B3Root';
  scene.add(deepRoot);

  const deepStatic = new THREE.Group();
  const deepDynamic = new THREE.Group();
  deepRoot.add(deepDynamic);

  function addDBox(parent, w, h, d, material, x, y, z, shadow = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addDWallBox(w, h, d, x, y, z, frontTex, backTex, axis) {
    const cap = mat.wallCutCap;
    let mats;
    if (axis === 'h') {
      const mN = makeSurfaceMat(frontTex, w, h);
      const mS = makeSurfaceMat(backTex || frontTex, w, h);
      mats = [cap, cap, cap, cap, mS, mN];
    } else {
      const mW = makeSurfaceMat(frontTex, d, h);
      const mE = makeSurfaceMat(backTex || frontTex, d, h);
      mats = [mE, mW, cap, cap, cap, cap];
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(x, y, z);
    m.castShadow = false;
    m.receiveShadow = true;
    deepStatic.add(m);
    return m;
  }

  function addDLight(name, floor, zone, color, intensity, distance, x, y, z) {
    const light = new THREE.PointLight(color, 0, distance, 1.55);
    light.position.set(x, y, z);
    light.castShadow = false;
    light.visible = false;
    light.userData.building = 'main';
    deepRoot.add(light);
    interiorLights.push({ name, floor, zone, light, baseInt: intensity });
    return light;
  }

  // Procedural Realistic Architectural Studio Mirror Material (Subtle diagonal glass sheen + brushed reflection!)
  const makeStudioMirrorMat = () => {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: 0xcfdbe6, roughness: 0.05, metalness: 0.94 });
    }
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 512;
    const c = cv.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 256, 512);
    grad.addColorStop(0, '#9eb4c7');
    grad.addColorStop(0.32, '#d8e6f2');
    grad.addColorStop(0.48, '#eef5fb');
    grad.addColorStop(0.54, '#bacad9');
    grad.addColorStop(0.85, '#8a9eb0');
    grad.addColorStop(1, '#c3d3e0');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 512);
    // Crisp architectural mirror diagonal light reflections
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath(); c.moveTo(0, 120); c.lineTo(130, 0); c.lineTo(185, 0); c.lineTo(0, 175); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(50, 512); c.lineTo(256, 300); c.lineTo(256, 345); c.lineTo(95, 512); c.closePath(); c.fill();
    // Subtle studio floor warm reflection glow near bottom of mirror
    const fGrad = c.createLinearGradient(0, 380, 0, 512);
    fGrad.addColorStop(0, 'rgba(196,154,108,0.0)');
    fGrad.addColorStop(1, 'rgba(196,154,108,0.34)');
    c.fillStyle = fGrad;
    c.fillRect(0, 380, 256, 132);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0x3a4a5a),
      emissiveIntensity: 0.28,
      roughness: 0.06,
      metalness: 0.90,
    });
  };

  const studioMirrorMat = makeStudioMirrorMat();
  const concPconMat = makeSurfaceMat('concrete_pcon', 2.4, 2.4);
  const concCleanMat = makeSurfaceMat('concrete_clean', 2.0, 2.0);
  const studioTrackGlow = new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: new THREE.Color(0xffdfa6), emissiveIntensity: 1.5, roughness: 0.25 });
  const warmGlowMat = new THREE.MeshStandardMaterial({ color: 0xffd7a1, emissive: new THREE.Color(0xffa94d), emissiveIntensity: 1.55, roughness: 0.3 });
  const hearthGlowMat = new THREE.MeshStandardMaterial({ color: 0xff8c3a, emissive: new THREE.Color(0xff5e1a), emissiveIntensity: 2.0, roughness: 0.35 });
  const amberStripMat = new THREE.MeshStandardMaterial({ color: 0xffc864, emissive: new THREE.Color(0xf59e0b), emissiveIntensity: 1.7, roughness: 0.2 });
  const waterJugMat = new THREE.MeshStandardMaterial({ color: 0x3b82b6, roughness: 0.32, metalness: 0.08 });
  const crateMat = makeSurfaceMat('crate_wood', 0.5, 0.5);
  const riceSackMat = new THREE.MeshStandardMaterial({ color: 0xc8b28e, roughness: 0.92, metalness: 0.0 });
  const rationBoxMat = new THREE.MeshStandardMaterial({ color: 0xa68356, roughness: 0.86, metalness: 0.0 });
  const greenCanMat = new THREE.MeshStandardMaterial({ color: 0x4b5c43, roughness: 0.52, metalness: 0.16 });
  const redCanMat = new THREE.MeshStandardMaterial({ color: 0xa4342a, roughness: 0.45, metalness: 0.2 });
  const denimMat = makeSurfaceMat('fabric_denim', 1.2, 1.2, { color: 0x4b5c6e });
  const warmTimberMat = makeSurfaceMat('wood_slats', 1.4, 1.4);
  const hinokiMat = makeSurfaceMat('wood_floor', 1.4, 1.4);
  const darkSpeakerMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.72, metalness: 0.18 });
  const screenGlowMat = new THREE.MeshStandardMaterial({ color: 0x22384a, emissive: new THREE.Color(0x38bdf8), emissiveIntensity: 0.65, roughness: 0.2 });

  // Helper to build wall list with exact openings & colliders for B2F (-1) & B3F (-2)
  function buildDeepWalls(floorDef, defaultWallH) {
    const floorIdx = floorDef.physicalFloor;
    const baseY = floorDef.baseY;
    for (const wall of floorDef.walls) {
      const isH = wall.axis === 'h';
      const start = isH ? wall.x1 : wall.z1;
      const end = isH ? wall.x2 : wall.z2;
      const thick = isH ? wall.z2 - wall.z1 : wall.x2 - wall.x1;
      const centerO = isH ? (wall.z1 + wall.z2) / 2 : (wall.x1 + wall.x2) / 2;
      const wallH = wall.wallH || defaultWallH;
      const texFront = wall.kind.startsWith('ext') ? wall.extTex : wall.texA;
      const texBack = wall.kind.startsWith('ext') ? wall.intTex : wall.texB;
      const ops = [...(wall.openings || [])].sort((a, b) => a.pos - b.pos);

      let cursor = start;
      for (const op of ops) {
        if (op.pos > cursor + 0.005) {
          const seg = op.pos - cursor;
          const mid = cursor + seg / 2;
          if (isH) {
            addDWallBox(seg, wallH, thick, mid, baseY + wallH / 2, centerO, texFront, texBack, 'h');
            addCollider(floorIdx, cursor, wall.z1, op.pos, wall.z2);
          } else {
            addDWallBox(thick, wallH, seg, centerO, baseY + wallH / 2, mid, texFront, texBack, 'v');
            addCollider(floorIdx, wall.x1, cursor, wall.x2, op.pos);
          }
        }
        const opMid = op.pos + op.width / 2;
        const opSill = Math.max(0, op.sill || 0);
        const opTop = opSill + op.height;
        if (opSill > 0.02) {
          if (isH) {
            addDWallBox(op.width, opSill, thick, opMid, baseY + opSill / 2, centerO, texFront, texBack, 'h');
            addCollider(floorIdx, op.pos, wall.z1, op.pos + op.width, wall.z2);
          } else {
            addDWallBox(thick, opSill, op.width, centerO, baseY + opSill / 2, opMid, texFront, texBack, 'v');
            addCollider(floorIdx, wall.x1, op.pos, wall.x2, op.pos + op.width);
          }
        }
        if (opTop < wallH - 0.01) {
          const headH = wallH - opTop;
          if (isH) addDWallBox(op.width, headH, thick, opMid, baseY + opTop + headH / 2, centerO, texFront, texBack, 'h');
          else addDWallBox(thick, headH, op.width, centerO, baseY + opTop + headH / 2, opMid, texFront, texBack, 'v');
        }
        if (op.type.startsWith('door')) {
          addInteractiveDoor(floorIdx, op, wall, baseY);
        } else {
          // Double-glazed acoustic studio observation window!
          const cy = baseY + opSill + op.height / 2;
          const f = 0.04;
          if (isH) {
            addDBox(deepStatic, op.width, f, thick + 0.02, mat.darkIron, opMid, baseY + opSill + f / 2, centerO);
            addDBox(deepStatic, op.width, f, thick + 0.02, mat.darkIron, opMid, baseY + opTop - f / 2, centerO);
            addDBox(deepStatic, op.width - f * 2, op.height - f * 2, 0.024, mat.glassClear, opMid, cy, centerO);
          } else {
            addDBox(deepStatic, thick + 0.02, f, op.width, mat.darkIron, centerO, baseY + opSill + f / 2, opMid);
            addDBox(deepStatic, thick + 0.02, f, op.width, mat.darkIron, centerO, baseY + opTop - f / 2, opMid);
            addDBox(deepStatic, 0.024, op.height - f * 2, op.width - f * 2, mat.glassClear, centerO, cy, opMid);
          }
        }
        cursor = op.pos + op.width;
      }
      if (end > cursor + 0.005) {
        const seg = end - cursor;
        const mid = cursor + seg / 2;
        if (isH) {
          addDWallBox(seg, wallH, thick, mid, baseY + wallH / 2, centerO, texFront, texBack, 'h');
          addCollider(floorIdx, cursor, wall.z1, end, wall.z2);
        } else {
          addDWallBox(thick, wallH, seg, centerO, baseY + wallH / 2, mid, texFront, texBack, 'v');
          addCollider(floorIdx, wall.x1, cursor, wall.x2, end);
        }
      }
    }
  }

  // Helper to build enclosed concrete deep-basement stair flight (ST_B2 & ST_B3)
  function buildEnclosedDeepStair(st, landingZ0, landingZ1, lowerVestZ0, lowerVestZ1) {
    const w = st.maxX - st.minX;
    const cx = (st.minX + st.maxX) / 2;
    const totalH = st.topY - st.bottomY;
    const runD = st.bottomZ - st.topZ;
    const stepD = runD / st.treads;
    const stepH = totalH / st.treads;

    // Upper landing slab (at upperFloor Y)
    addDBox(deepStatic, w + 0.30, 0.16, landingZ1 - landingZ0, concCleanMat, cx + 0.08, st.topY - 0.08, (landingZ0 + landingZ1) / 2);
    // Lower vestibule floor slab (at lowerFloor Y)
    addDBox(deepStatic, w + 0.30, 0.20, lowerVestZ1 - lowerVestZ0, concCleanMat, cx + 0.08, st.bottomY - 0.10, (lowerVestZ0 + lowerVestZ1) / 2);

    // Individual solid concrete treads descending South (Z = topZ -> bottomZ)
    for (let i = 0; i < st.treads; i++) {
      const ty = st.topY - (i + 0.5) * stepH;
      const tz = st.topZ + (i + 0.5) * stepD;
      addDBox(deepStatic, w, stepH + 0.14, stepD + 0.04, concCleanMat, cx, ty - 0.07, tz);
      // Warm non-slip nosing accent every step
      addDBox(deepStatic, w - 0.04, 0.015, 0.03, mat.darkIron, cx, st.topY - i * stepH - 0.008, st.topZ + i * stepD + 0.02);
    }

    // Enclosed concrete stairwell shell (West wall, North cap, South cap, East wall along run, Sloped ceiling)
    const fullTop = st.topY + 2.35;
    const fullBot = st.bottomY - 0.20;
    const fullH = fullTop - fullBot;
    const midY = (fullTop + fullBot) / 2;
    const zMin = landingZ0 - 0.12;
    const zMax = lowerVestZ1 + 0.12;
    addDBox(deepStatic, 0.14, fullH, zMax - zMin, concPconMat, st.minX - 0.07, midY, (zMin + zMax) / 2);
    addDBox(deepStatic, w + 0.24, fullH, 0.14, concPconMat, cx, midY, zMin + 0.07);
    addDBox(deepStatic, w + 0.24, fullH, 0.14, concPconMat, cx, midY, zMax - 0.07);
    // East divider wall along the sloped middle section
    addDBox(deepStatic, 0.14, fullH, st.bottomZ - st.topZ, concPconMat, st.maxX + 0.07, midY, (st.topZ + st.bottomZ) / 2);
    // Ceilings over upper landing & lower vestibule + sloped soffit
    addDBox(deepStatic, w + 0.20, 0.14, zMax - zMin, concPconMat, cx, fullTop, (zMin + zMax) / 2);

    // Steel pipe handrail along West wall of stairs
    const railLen = Math.hypot(runD, totalH);
    const railAng = Math.atan2(totalH, runD);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, railLen, 8), mat.darkIron);
    rail.rotation.x = Math.PI / 2 - railAng;
    rail.position.set(st.minX + 0.07, (st.topY + st.bottomY) / 2 + 0.90, (st.topZ + st.bottomZ) / 2);
    deepStatic.add(rail);

    // Subtle amber step wall sconce midway down stairwell
    addDBox(deepStatic, 0.05, 0.14, 0.22, warmGlowMat, st.minX + 0.03, (st.topY + st.bottomY) / 2 + 1.45, (st.topZ + st.bottomZ) / 2);

    // Colliders for upper landing (upperFloor) & lower vestibule (lowerFloor)
    addCollider(st.upperFloor, st.minX - 0.15, zMin, st.minX, zMax);
    addCollider(st.upperFloor, st.minX - 0.15, zMin, st.maxX + 0.15, landingZ0);
    addCollider(st.lowerFloor, st.minX - 0.15, zMin, st.minX, zMax);
    addCollider(st.lowerFloor, st.minX - 0.15, lowerVestZ1, st.maxX + 0.15, zMax);
    addCollider(st.lowerFloor, st.maxX, st.topZ, st.maxX + 0.15, st.bottomZ);
  }

  // =========================================================================
  // 1. B1F ELEVATOR VESTIBULE (X=1.95..3.25, Z=0.85..2.85) + STAIR ST_B2
  // =========================================================================
  const yB1 = -2.40;
  // B1F Elevator Vestibule connecting B01 North Wall (X=2.05..3.05, Z=2.70..2.85) -> ELV-1 Door (X=3.25, Z=1.30..2.20)
  addDBox(deepStatic, 1.35, 0.16, 2.05, concCleanMat, 2.60, yB1 - 0.08, 1.85);
  addDBox(deepStatic, 1.35, 0.14, 2.05, concPconMat, 2.60, yB1 + 2.09, 1.85);
  addDWallBox(1.45, 2.02, 0.14, 2.55, yB1 + 1.01, 0.78, 'concrete_pcon', 'concrete_pcon', 'h');
  addDWallBox(0.14, 2.02, 2.00, 1.88, yB1 + 1.01, 1.85, 'concrete_pcon', 'concrete_pcon', 'v');
  addCollider(0, 1.80, 0.70, 3.25, 0.85);
  addCollider(0, 1.80, 0.85, 1.95, 2.85);
  // Subtle illuminated sign over B1F -> B2F stair portal
  addDBox(deepStatic, 0.03, 0.14, 0.65, amberStripMat, 0.17, yB1 + 1.94, 6.00);

  // Build ST_B2 (B1F -2.40m -> B2F -6.60m, landing right in front of Studio Door DB2-0!)
  buildEnclosedDeepStair(STAIR_B1_B2, 5.55, 6.45, 9.85, 10.95);

  // =========================================================================
  // 2. B2F: 10m×10m WOOD-FLOOR + CONCRETE & MIRROR HIGH-CEILING STUDIO + 2 × (4m×6m) ROOMS
  // =========================================================================
  const yB2 = FLOOR_B2F.baseY; // -6.60 m
  const hB2 = FLOOR_B2F.ceilingH; // 3.80 m!

  // Structural Floor Slabs & Finished Flooring for B2F
  // B200 ELV Lobby (1.65..3.25, 0.85..2.85) + Seamless Portal Header up to B201 3.80m Ceiling
  addDBox(deepStatic, 1.85, 0.24, 2.25, concCleanMat, 2.45, yB2 - 0.12, 1.85);
  addDBox(deepStatic, 1.60, 0.02, 2.00, makeSurfaceMat('tile_grey_stone', 1.6, 2.0), 2.45, yB2 + 0.01, 1.85);
  addDBox(deepStatic, 1.90, 0.24, 2.25, concPconMat, 2.45, yB2 + 3.32, 1.85);
  addDWallBox(1.54, hB2 - 2.55, 0.15, 2.40, yB2 + 2.55 + (hB2 - 2.55) / 2, 2.775, 'concrete_pcon', 'concrete_pcon', 'h');
  addDBox(deepStatic, 1.54, 0.04, 0.18, mat.darkIron, 2.40, yB2 + 2.55, 2.775);

  // B201 Main 10m×10m Wood-Floor Studio (X=0.00..10.00, Z=2.85..12.85, CH=3.80m!)
  addDBox(deepStatic, 10.30, 0.28, 10.30, concCleanMat, 5.00, yB2 - 0.14, 7.85);
  addDBox(deepStatic, 10.00, 0.024, 10.00, makeSurfaceMat('wood_floor', 10.0, 10.0), 5.00, yB2 + 0.012, 7.85);
  // High Concrete Ceiling (Y = -2.80m -> exact CH 3.80m!) + Dramatic Architectural Concrete Ceiling Beams!
  addDBox(deepStatic, 10.30, 0.36, 10.30, concPconMat, 5.00, yB2 + hB2 + 0.18, 7.85);
  [4.85, 7.85, 10.85].forEach((bz) => {
    addDBox(deepStatic, 10.00, 0.28, 0.26, concPconMat, 5.00, yB2 + hB2 - 0.14, bz);
  });
  [3.35, 6.65].forEach((bx) => {
    addDBox(deepStatic, 0.24, 0.24, 10.00, concPconMat, bx, yB2 + hB2 - 0.12, 7.85);
  });
  // Suspended Studio Lighting Rails + Warm-White Architectural Acoustic Ceiling Baffles!
  [4.10, 7.85, 11.40].forEach((tz) => {
    addDBox(deepStatic, 8.20, 0.045, 0.06, mat.darkIron, 5.00, yB2 + hB2 - 0.42, tz);
    for (let sx = 1.60; sx <= 8.40; sx += 1.70) {
      addDBox(deepStatic, 0.12, 0.14, 0.12, mat.darkIron, sx, yB2 + hB2 - 0.50, tz);
      addDBox(deepStatic, 0.09, 0.03, 0.09, studioTrackGlow, sx, yB2 + hB2 - 0.57, tz);
    }
  });
  // Suspended Warm-Wood Acoustic Ceiling Clouds
  [2.50, 7.50].forEach((cxCloud) => {
    [5.85, 9.65].forEach((czCloud) => {
      addDBox(deepStatic, 2.20, 0.05, 1.15, warmTimberMat, cxCloud, yB2 + hB2 - 0.32, czCloud);
    });
  });

  // B202 East 4m×6m Control & Recording Room (X=10.15..14.15, Z=2.85..8.85, CH=3.20m)
  addDBox(deepStatic, 4.30, 0.26, 6.30, concCleanMat, 12.15, yB2 - 0.13, 5.85);
  addDBox(deepStatic, 4.00, 0.022, 6.00, makeSurfaceMat('wood_walnut_floor', 4.0, 6.0), 12.15, yB2 + 0.011, 5.85);
  addDBox(deepStatic, 4.30, 0.30, 6.30, concPconMat, 12.15, yB2 + 3.35, 5.85);

  // B203 South 6m×4m Lounge & Training Room (X=3.85..9.85, Z=13.00..17.00, CH=3.20m)
  addDBox(deepStatic, 6.30, 0.26, 4.30, concCleanMat, 6.85, yB2 - 0.13, 15.00);
  addDBox(deepStatic, 6.00, 0.022, 4.00, makeSurfaceMat('parquet_oak', 6.0, 4.0), 6.85, yB2 + 0.011, 15.00);
  addDBox(deepStatic, 6.30, 0.30, 4.30, concPconMat, 6.85, yB2 + 3.35, 15.00);

  // Build All B2F Concrete Walls, Acoustic Window & Doors (DB2-0, DB2-1, DB2-2, DB2-3!)
  buildDeepWalls(FLOOR_B2F, hB2);

  // --- B201 MASSIVE FLOOR-TO-CEILING STUDIO MIRRORS & WOODEN BARRES ON CONCRETE WALLS! ---
  // North Concrete Wall Studio Mirrors (X = 3.35..9.75, 4 large bays × 1.54m wide × 2.65m tall!)
  for (let i = 0; i < 4; i++) {
    const mx = 4.15 + i * 1.58;
    addDBox(deepStatic, 1.54, 2.68, 0.025, mat.chrome, mx, yB2 + 1.48, 2.865);
    addDBox(deepStatic, 1.48, 2.62, 0.016, studioMirrorMat, mx, yB2 + 1.48, 2.880);
  }
  // Full-length Twin-Tier Oak Ballet/Studio Barre along North Mirror Wall
  [0.86, 1.12].forEach((bh) => {
    const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 6.30, 10), mat.oak);
    barre.rotation.z = Math.PI / 2;
    barre.position.set(6.52, yB2 + bh, 3.04);
    deepStatic.add(barre);
  });
  for (let bx = 3.60; bx <= 9.50; bx += 1.45) {
    addDBox(deepStatic, 0.03, 0.03, 0.18, mat.darkIron, bx, yB2 + 0.86, 2.95);
    addDBox(deepStatic, 0.03, 0.03, 0.18, mat.darkIron, bx, yB2 + 1.12, 2.95);
  }

  // West Concrete Wall Studio Mirrors (Z = 3.15..9.45, right beside DB2-0 studio entrance!)
  for (let i = 0; i < 4; i++) {
    const mz = 3.95 + i * 1.56;
    addDBox(deepStatic, 0.025, 2.68, 1.52, mat.chrome, 0.015, yB2 + 1.48, mz);
    addDBox(deepStatic, 0.016, 2.62, 1.46, studioMirrorMat, 0.030, yB2 + 1.48, mz);
  }
  [0.86, 1.12].forEach((bh) => {
    const barreW = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 6.15, 10), mat.oak);
    barreW.rotation.x = Math.PI / 2;
    barreW.position.set(0.19, yB2 + bh, 6.28);
    deepStatic.add(barreW);
  });
  for (let bz = 3.45; bz <= 9.15; bz += 1.42) {
    addDBox(deepStatic, 0.18, 0.03, 0.03, mat.darkIron, 0.10, yB2 + 0.86, bz);
    addDBox(deepStatic, 0.18, 0.03, 0.03, mat.darkIron, 0.10, yB2 + 1.12, bz);
  }

  // B201 Pro Studio Perimeter Props (Leaves huge 8.5m×8.5m center oak dance/studio floor completely open!)
  // Twin Pro PA Monitor Speaker Stacks on East Corners
  [3.35, 8.35].forEach((sz) => {
    addDBox(deepStatic, 0.50, 1.15, 0.46, darkSpeakerMat, 9.65, yB2 + 0.58, sz);
    addDBox(deepStatic, 0.02, 0.36, 0.36, mat.darkIron, 9.39, yB2 + 0.82, sz);
    addCollider(-1, 9.35, sz - 0.25, 9.95, sz + 0.25);
  });
  // Wood Acoustic Slat Diffuser Panels on South-East & South-West Concrete Walls
  addDBox(deepStatic, 0.04, 2.50, 3.20, warmTimberMat, 9.97, yB2 + 1.55, 10.85);
  addDBox(deepStatic, 2.80, 2.50, 0.04, warmTimberMat, 2.10, yB2 + 1.55, 12.82);
  // Studio Leather Bench + Key-Light Tripod on South-West Side
  addDBox(deepStatic, 1.85, 0.44, 0.52, denimMat, 2.15, yB2 + 0.22, 12.25);
  addCollider(-1, 1.20, 11.95, 3.10, 12.55);
  // Wall-mounted Mat & Equipment Rack on East-South Wall
  addDBox(deepStatic, 0.38, 1.55, 1.40, mat.darkIron, 9.75, yB2 + 0.78, 10.85);
  addCollider(-1, 9.52, 10.12, 9.98, 11.58);

  // --- B202 (4m×6m) AUDIO CONTROL & RECORDING ROOM PROPS ---
  // Mixing Console Desk facing Observation Window WB2-OBS into B201
  addDBox(deepStatic, 0.88, 0.78, 2.15, mat.walnut, 11.05, yB2 + 0.39, 4.32);
  addDBox(deepStatic, 0.52, 0.10, 1.65, darkSpeakerMat, 11.05, yB2 + 0.83, 4.32);
  addDBox(deepStatic, 0.05, 0.36, 0.62, screenGlowMat, 10.72, yB2 + 1.06, 3.92);
  addDBox(deepStatic, 0.05, 0.36, 0.62, screenGlowMat, 10.72, yB2 + 1.06, 4.72);
  addCollider(-1, 10.58, 3.22, 11.52, 5.42);
  // Outboard 19" Synth & Audio Rack + Acoustic Slat Back Wall
  addDBox(deepStatic, 0.58, 1.82, 1.85, darkSpeakerMat, 13.80, yB2 + 0.91, 4.60);
  addDBox(deepStatic, 0.04, 2.40, 2.60, warmTimberMat, 14.12, yB2 + 1.45, 7.10);
  addDBox(deepStatic, 0.65, 0.76, 1.55, mat.oak, 13.75, yB2 + 0.38, 7.25); // Keyboard / Synth Workstation
  addCollider(-1, 13.40, 3.65, 14.15, 8.15);

  // --- B203 (6m×4m) STUDIO LOUNGE, GEAR & TRAINING ROOM PROPS ---
  // Wall Mirror along South Concrete Wall
  addDBox(deepStatic, 3.20, 2.10, 0.02, studioMirrorMat, 6.85, yB2 + 1.25, 16.97);
  // Leather/Denim Lounge Sofa + Oak Low Table (West-South)
  addDBox(deepStatic, 2.10, 0.44, 0.82, denimMat, 5.45, yB2 + 0.22, 16.20);
  addDBox(deepStatic, 2.10, 0.72, 0.18, denimMat, 5.45, yB2 + 0.46, 16.58);
  addDBox(deepStatic, 1.25, 0.36, 0.62, mat.oak, 5.45, yB2 + 0.18, 15.15);
  addCollider(-1, 4.35, 14.80, 6.55, 16.70);
  // Heavy Equipment Rack & Flight Cases (East Wall)
  addDBox(deepStatic, 0.52, 1.95, 2.85, mat.darkIron, 9.52, yB2 + 0.98, 15.00);
  addDBox(deepStatic, 0.42, 0.36, 0.64, crateMat, 9.50, yB2 + 0.62, 14.20);
  addDBox(deepStatic, 0.42, 0.36, 0.64, darkSpeakerMat, 9.50, yB2 + 1.22, 15.65);
  addCollider(-1, 9.22, 13.55, 9.85, 16.45);
  // Fitness Weight Bench + Dumbbell Rack (West Wall)
  addDBox(deepStatic, 0.44, 0.44, 1.28, darkSpeakerMat, 4.55, yB2 + 0.22, 14.05);
  addCollider(-1, 4.25, 13.35, 4.88, 14.75);

  // Build ST_B3 (B2F -6.60m -> B3F -10.20m, descending to Shelter Door DB3-ST!)
  buildEnclosedDeepStair(STAIR_B2_B3, 11.45, 12.45, 15.15, 16.05);

  // =========================================================================
  // 3. B3F: W 520mm (1.3×) CORRIDOR -> ELV-1 + 3.2×12.5m WARM WOODEN SHELTER + 2×6m FOOD VAULT
  // =========================================================================
  const yB3 = FLOOR_B3F.baseY; // -10.20 m
  const hB3 = FLOOR_B3F.ceilingH; // 2.80 m

  // --- B300: W 520mm (1.3× Protagonist) Corridor Floor, Ceiling & Amber Baseboard Guide Strips ---
  addDBox(deepStatic, 2.15, 0.24, 2.65, concCleanMat, 2.25, yB3 - 0.12, 2.35);
  addDBox(deepStatic, 0.56, 0.02, 2.20, makeSurfaceMat('metal_grate', 0.6, 2.2), 1.60, yB3 + 0.01, 2.55);
  addDBox(deepStatic, 1.50, 0.02, 0.56, makeSurfaceMat('metal_grate', 1.5, 0.6), 2.55, yB3 + 0.01, 1.75);
  addDBox(deepStatic, 0.65, 0.02, 1.15, makeSurfaceMat('tile_grey_stone', 0.7, 1.2), 2.95, yB3 + 0.01, 1.75);
  addDBox(deepStatic, 2.25, 0.24, 2.75, concPconMat, 2.25, yB3 + 2.58, 2.35);
  // Warm Amber Recessed Baseboard Guide LED Strips along the 520mm corridor leading right to ELV-1!
  addDBox(deepStatic, 0.018, 0.032, 1.85, amberStripMat, 1.355, yB3 + 0.08, 2.52);
  addDBox(deepStatic, 0.018, 0.032, 1.45, amberStripMat, 1.845, yB3 + 0.08, 2.80);
  addDBox(deepStatic, 0.85, 0.032, 0.018, amberStripMat, 2.22, yB3 + 0.08, 1.505);
  addDBox(deepStatic, 0.75, 0.032, 0.018, amberStripMat, 2.22, yB3 + 0.08, 1.995);
  // Overhead industrial steel ventilation pipes inside the tight 520mm corridor
  const corrPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.90, 8), mat.darkIron);
  corrPipe.rotation.x = Math.PI / 2;
  corrPipe.position.set(1.60, yB3 + 2.34, 2.50);
  deepStatic.add(corrPipe);

  // --- B301..B304: 3.20m × 12.50m WARM WOODEN SHELTER FLOOR & EXPOSED TIMBER CEILING ---
  addDBox(deepStatic, 3.50, 0.26, 12.80, concCleanMat, 1.60, yB3 - 0.13, 9.85);
  // Warm Hinoki/Oak Wood Flooring across Living + Gallery + Bedroom
  addDBox(deepStatic, 3.20, 0.022, 5.00, makeSurfaceMat('wood_floor', 3.2, 5.0), 1.60, yB3 + 0.011, 6.10);
  addDBox(deepStatic, 1.65, 0.022, 3.55, makeSurfaceMat('wood_floor', 1.7, 3.6), 0.825, yB3 + 0.011, 10.35);
  addDBox(deepStatic, 3.20, 0.022, 3.90, makeSurfaceMat('parquet_oak', 3.2, 3.9), 1.60, yB3 + 0.011, 14.15);
  // Shower & Toilet waterproof tile floors
  addDBox(deepStatic, 1.45, 0.018, 1.80, makeSurfaceMat('tile_blue_bath', 1.45, 1.8), 2.475, yB3 - 0.005, 9.50);
  addDBox(deepStatic, 1.45, 0.020, 1.60, makeSurfaceMat('tile_beige_grid', 1.45, 1.6), 2.475, yB3 + 0.010, 11.30);
  // Warm Wood Plank Ceiling + Exposed Structural Timber Ceiling Joists every 1.25m!
  addDBox(deepStatic, 3.50, 0.26, 12.80, makeSurfaceMat('plywood_attic', 3.5, 12.8), 1.60, yB3 + hB3 + 0.13, 9.85);
  for (let jz = 4.20; jz <= 15.60; jz += 1.25) {
    addDBox(deepStatic, 3.20, 0.14, 0.12, mat.walnut, 1.60, yB3 + hB3 - 0.07, jz);
  }
  // Warm Wooden Acoustic Slat Feature Wall along West Wall of Living Lounge
  addDBox(deepStatic, 0.04, 2.65, 4.60, warmTimberMat, 0.03, yB3 + 1.34, 6.10);

  // --- B305: 2.00m × 6.00m FOOD STORAGE WAREHOUSE SLAB & CEILING (X=0.60..2.60, Z=16.25..22.25) ---
  addDBox(deepStatic, 2.30, 0.26, 6.30, concCleanMat, 1.60, yB3 - 0.13, 19.25);
  addDBox(deepStatic, 2.30, 0.24, 6.30, concPconMat, 1.60, yB3 + 2.72, 19.25);

  // Build All B3F Walls & Doors (DB3-COR, DB3-ST, DB3-SH, DB3-WC, DB3-BD, DB3-FD!)
  buildDeepWalls(FLOOR_B3F, hB3);

  // --- B301 WARM WOODEN SHELTER LIVING FURNITURE (X=0.00..3.20, Z=3.60..8.60) ---
  // Glowing Hearth-Style Electric Shelter Stove (NW corner)
  addDBox(deepStatic, 0.54, 0.78, 0.48, mat.darkIron, 0.35, yB3 + 0.39, 4.25);
  addDBox(deepStatic, 0.03, 0.32, 0.32, hearthGlowMat, 0.63, yB3 + 0.42, 4.25);
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.02, 10), mat.darkIron);
  flue.position.set(0.35, yB3 + 1.78, 4.25);
  deepStatic.add(flue);
  addCollider(-2, 0.04, 3.92, 0.68, 4.58);

  // HEPA Positive-Pressure Air Filtration Unit (NE corner)
  addDBox(deepStatic, 0.56, 1.55, 0.48, makeSurfaceMat('concrete_clean', 0.6, 1.5, { color: 0xb8c0c8 }), 2.86, yB3 + 0.78, 3.92);
  addDBox(deepStatic, 0.44, 0.26, 0.03, screenGlowMat, 2.86, yB3 + 1.24, 4.17);
  addCollider(-2, 2.54, 3.64, 3.18, 4.22);

  // Warm Wooden Dining Table + Twin Hinoki Benches (East Side)
  addDBox(deepStatic, 0.82, 0.05, 1.65, hinokiMat, 2.55, yB3 + 0.74, 6.20);
  [[2.22, 5.52], [2.88, 5.52], [2.22, 6.88], [2.88, 6.88]].forEach(([lx, lz]) => {
    addDBox(deepStatic, 0.055, 0.72, 0.055, mat.walnut, lx, yB3 + 0.36, lz);
  });
  addDBox(deepStatic, 0.36, 0.44, 1.45, hinokiMat, 1.92, yB3 + 0.22, 6.20);
  addCollider(-2, 1.72, 5.32, 3.05, 7.08);

  // Cozy Plush Denim Shelter Sofa + Warm Rug + Bookshelf (West Side)
  addDBox(deepStatic, 1.35, 0.015, 2.15, makeSurfaceMat('carpet_beige', 1.4, 2.2), 0.92, yB3 + 0.025, 6.15);
  addDBox(deepStatic, 0.72, 0.40, 1.75, denimMat, 0.42, yB3 + 0.20, 6.10);
  addDBox(deepStatic, 0.16, 0.68, 1.75, denimMat, 0.12, yB3 + 0.44, 6.10);
  addCollider(-2, 0.04, 5.18, 0.82, 7.02);
  addDBox(deepStatic, 0.36, 1.85, 1.05, makeFrontMat('furniture_bookshelf'), 0.22, yB3 + 0.925, 7.82);
  addCollider(-2, 0.02, 7.26, 0.44, 8.38);

  // Warm Hanging Wooden Lantern Pendant in Living Ceiling
  addDBox(deepStatic, 0.02, 0.48, 0.02, mat.darkIron, 1.60, yB3 + hB3 - 0.24, 5.80);
  addDBox(deepStatic, 0.36, 0.24, 0.36, warmGlowMat, 1.60, yB3 + hB3 - 0.56, 5.80);

  // --- B302 SHELTER SHOWER ROOM FIXTURES (X=1.75..3.20, Z=8.60..10.40) ---
  addDBox(deepStatic, 0.04, 0.12, 0.56, mat.chrome, 3.12, yB3 + 1.15, 9.50); // Mixer bar
  addDBox(deepStatic, 0.32, 0.025, 0.32, mat.chrome, 2.86, yB3 + 2.18, 9.50); // Overhead rain shower head
  addDBox(deepStatic, 0.34, 0.02, 0.02, mat.chrome, 3.00, yB3 + 2.20, 9.50);
  addDBox(deepStatic, 0.14, 0.015, 1.15, mat.stainless, 2.95, yB3 - 0.002, 9.50); // Linear drain grate
  addDBox(deepStatic, 0.42, 0.44, 0.72, hinokiMat, 2.92, yB3 + 0.22, 8.98); // Hinoki waterproof shower bench
  addCollider(-2, 2.68, 8.62, 3.18, 9.38);

  // --- B303 SHELTER TOILET ROOM FIXTURES (X=1.75..3.20, Z=10.50..12.10) ---
  addDBox(deepStatic, 0.42, 0.42, 0.62, mat.ceramic, 2.82, yB3 + 0.21, 11.10); // Ceramic toilet bowl
  addDBox(deepStatic, 0.36, 0.74, 0.18, mat.ceramic, 3.02, yB3 + 0.37, 11.10);
  addDBox(deepStatic, 0.38, 0.76, 0.54, hinokiMat, 2.96, yB3 + 0.38, 11.78); // Wood vanity counter
  addDBox(deepStatic, 0.28, 0.12, 0.38, mat.ceramic, 2.96, yB3 + 0.80, 11.78); // Basin
  addDBox(deepStatic, 0.02, 0.58, 0.44, studioMirrorMat, 3.18, yB3 + 1.38, 11.78); // Mirror
  addCollider(-2, 2.58, 10.75, 3.18, 12.06);

  // --- B304 SHELTER WOODEN BEDROOM FURNITURE (X=0.00..3.20, Z=12.20..16.10) ---
  // Handcrafted Warm Wood Platform Queen Bed (East Side, leaving clear path to DB3-ST & DB3-FD!)
  addDBox(deepStatic, 1.65, 0.34, 2.02, mat.walnut, 2.32, yB3 + 0.17, 13.75);
  addDBox(deepStatic, 1.56, 0.20, 1.94, makeSurfaceMat('fabric_linen', 1.6, 2.0, { color: 0xeee5d8 }), 2.32, yB3 + 0.44, 13.75);
  addDBox(deepStatic, 0.48, 0.12, 0.32, mat.whiteMatte, 2.02, yB3 + 0.58, 12.98);
  addDBox(deepStatic, 0.48, 0.12, 0.32, mat.whiteMatte, 2.62, yB3 + 0.58, 12.98);
  addDBox(deepStatic, 1.72, 0.96, 0.08, warmTimberMat, 2.32, yB3 + 0.52, 12.72); // Warm wooden headboard
  addCollider(-2, 1.48, 12.68, 3.18, 14.78);
  // Cozy Wooden Writing Desk & Lamp on West Wall (North of ST_B3 door DB3-ST!)
  addDBox(deepStatic, 0.52, 0.74, 1.15, hinokiMat, 0.28, yB3 + 0.37, 13.85);
  addDBox(deepStatic, 0.16, 0.26, 0.16, warmGlowMat, 0.24, yB3 + 0.87, 13.48);
  addCollider(-2, 0.02, 13.24, 0.58, 14.46);
  // Cedar Wardrobe (SE corner, East of DB3-FD food vault door!)
  addDBox(deepStatic, 0.52, 1.96, 0.88, makeFrontMat('furniture_chest'), 2.88, yB3 + 0.98, 15.56);
  addCollider(-2, 2.58, 15.08, 3.18, 16.04);

  // --- B305 (2.0m×6.0m) FOOD STORAGE WAREHOUSE RACKS, WATER TANKS, RATIONS & FREEZER ---
  // Heavy-Duty 4-Tier Storage Racks lining West (X=0.64..1.08) & East (X=2.12..2.56) Walls!
  // Leaves X = 1.08..2.12 (1.04m wide!) completely unobstructed all the way to the deep freezer!
  const buildFoodRackBay = (rx, rz) => {
    // 4 Vertical Steel Posts + 4 Cedar/Plywood Shelf Decks
    [[-0.20, -0.58], [0.20, -0.58], [-0.20, 0.58], [0.20, 0.58]].forEach(([dx, dz]) => {
      addDBox(deepStatic, 0.035, 2.10, 0.035, mat.darkIron, rx + dx, yB3 + 1.05, rz + dz);
    });
    [0.14, 0.72, 1.32, 1.92].forEach((sy) => {
      addDBox(deepStatic, 0.44, 0.032, 1.22, hinokiMat, rx, yB3 + sy, rz);
    });
    // Tier 1 (Floor): Rows of 20L Blue Drinking Water Jerrycans!
    [-0.36, 0.0, 0.36].forEach((oz) => {
      addDBox(deepStatic, 0.30, 0.42, 0.24, waterJugMat, rx, yB3 + 0.37, rz + oz);
      addDBox(deepStatic, 0.07, 0.06, 0.07, mat.whiteMatte, rx, yB3 + 0.60, rz + oz);
    });
    // Tier 2: Wooden Ration Crates & Kraft Cardboard Supply Boxes
    addDBox(deepStatic, 0.36, 0.38, 0.48, crateMat, rx, yB3 + 0.93, rz - 0.28);
    addDBox(deepStatic, 0.36, 0.34, 0.48, rationBoxMat, rx, yB3 + 0.91, rz + 0.28);
    // Tier 3: Stacked Rice/Grain Burlap Sacks + Sealed Canned-Food Bins
    addDBox(deepStatic, 0.34, 0.20, 0.50, riceSackMat, rx, yB3 + 1.44, rz - 0.26);
    addDBox(deepStatic, 0.34, 0.20, 0.50, riceSackMat, rx, yB3 + 1.64, rz - 0.24);
    addDBox(deepStatic, 0.34, 0.32, 0.46, greenCanMat, rx, yB3 + 1.50, rz + 0.28);
    // Tier 4 (Top): Emergency Red & Kraft Reserve Cartons
    addDBox(deepStatic, 0.34, 0.32, 0.46, redCanMat, rx, yB3 + 2.10, rz - 0.24);
    addDBox(deepStatic, 0.34, 0.30, 0.46, rationBoxMat, rx, yB3 + 2.09, rz + 0.28);
  };
  [17.15, 18.55, 19.95].forEach((rzBay) => {
    buildFoodRackBay(0.84, rzBay);
    buildFoodRackBay(2.36, rzBay);
  });
  addCollider(-2, 0.60, 16.50, 1.09, 20.65);
  addCollider(-2, 2.11, 16.50, 2.60, 20.65);

  // Far South Wall Commercial Stainless Upright Refrigerator + Chest Deep Freezer (Z = 21.45..22.20)
  addDBox(deepStatic, 0.78, 1.98, 0.72, makeFrontMat('appliance_fridge', { roughness: 0.26, metalness: 0.38 }), 1.04, yB3 + 0.99, 21.84);
  addDBox(deepStatic, 1.04, 0.92, 0.68, mat.stainless, 2.02, yB3 + 0.46, 21.86);
  addDBox(deepStatic, 1.06, 0.05, 0.70, mat.whiteMatte, 2.02, yB3 + 0.94, 21.86); // Freezer lid
  addCollider(-2, 0.62, 21.44, 2.58, 22.25);

  // Overhead Bright Food Pantry LED Light Bars
  [17.85, 20.65].forEach((lz) => {
    addDBox(deepStatic, 0.16, 0.04, 1.05, studioTrackGlow, 1.60, yB3 + 2.58, lz);
  });

  // =========================================================================
  // 4. SPATIAL LIGHTS FOR B2F (floor=-1) & B3F (floor=-2) — Strictly <= 5 Active/Floor!
  // =========================================================================
  // B2F (5 lights total: Studio Center + Studio Mirror Fill + B200 ELV Lobby + B202 Control + B203 Lounge)
  addDLight('B2F_Studio_Main', -1, 'studio', 0xfff0da, 3.20, 14.5, 5.00, yB2 + 3.25, 7.85);
  addDLight('B2F_Studio_Mirror', -1, 'studio', 0xf7e7d0, 1.95, 11.5, 2.65, yB2 + 2.95, 5.20);
  addDLight('B2F_ELV_Lobby', -1, 'north', 0xe6eff8, 1.45, 6.2, 2.45, yB2 + 2.75, 1.85);
  addDLight('B2F_Control_R1', -1, 'east', 0xf6dfc0, 2.05, 9.5, 12.15, yB2 + 2.75, 5.85);
  addDLight('B2F_Lounge_R2', -1, 'south', 0xffe4be, 2.05, 9.5, 6.85, yB2 + 2.75, 15.00);

  // B3F (5 lights total: Corridor/ELV + Warm Shelter Living + Wet Bath/WC + Warm Bedroom + Food Vault)
  addDLight('B3F_Corridor_ELV', -2, 'north', 0xffd79e, 1.55, 6.4, 2.65, yB3 + 2.25, 1.75);
  addDLight('B3F_Shelter_Living', -2, 'living', 0xffd296, 2.45, 10.5, 1.60, yB3 + 2.20, 5.80);
  addDLight('B3F_Shelter_Wet', -2, 'wet', 0xfff0dc, 1.65, 6.2, 2.35, yB3 + 2.25, 10.35);
  addDLight('B3F_Shelter_Bed', -2, 'bed', 0xffcc8c, 2.05, 8.8, 1.60, yB3 + 2.25, 14.15);
  addDLight('B3F_Food_Vault', -2, 'food', 0xf5f7f2, 2.25, 9.2, 1.60, yB3 + 2.38, 19.25);

  // =========================================================================
  // 5. UV-BAKED STATIC BATCHING FOR DEEP BASEMENT B2F + B3F!
  // =========================================================================
  const { batchedGroup: deepBatched, stats: deepBatchStats } = batchStaticGroups([deepStatic]);
  deepRoot.add(deepBatched);

  return {
    root: deepRoot,
    batchStats: deepBatchStats,
  };
}
