import * as THREE from 'three';
import { FLOOR_B2F, FLOOR_B3F, FLOOR_B4F, STAIR_B1_B2, STAIR_B2_B3 } from './deepBasementData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';
import { buildB3fExpansion3D } from './buildB3fExpansion3d.js';

/**
 * Builds the entire Deep Basement Expansion:
 * 1) B1F Elevator Vestibule + Enclosed Concrete Stair ST_B2 (B1F -> B2F Studio Door DB2-0)
 * 2) B2F (Y = -6.60m, CH = 3.80m): 10m×10m Wood-Floor + Concrete & Full-Mirror Studio (B201)
 *    + Direct-Connected 4m×6m Control/Recording Room (B202) + 6m×4m Lounge/Gear Room (B203)
 *    + Enclosed Concrete Stair ST_B3 (B2F -> B3F Shelter Door DB3-ST)
 * 3) B3F (Y = -10.20m, CH = 2.80m): W 520mm (1.3× protagonist Ø400mm) Narrow Elevator Corridor (B300)
 *    + 3.2m×12.5m Warm Wooden Shelter (Living B301, Shower B302, Toilet B303, Bedroom B304)
 *    + Rear Vault Door DB3-FD -> 2.0m×6.0m Food Storage Warehouse (B305)
 * 4) B4F (Y = -14.20m, CH = 3.55m — ELEVATOR-ONLY!): 2.70m×15.50m Clandestine Gang Research Laboratory
 *    (5 Longitudinal Zones: Biometric Airlock -> Chem Synthesis Lab -> Cyber Ops -> CNC Fab Lab -> Containment Vault)
 */
export function buildDeepBasement3D(ctx) {
  const {
    scene,
    mat,
    addCollider,
    addInteractiveDoor,
    interactiveProps = [],
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

    // Enclosed concrete stairwell shell (West wall mitered between North & South caps, East wall along run, ceiling above)
    const fullTop = st.topY + 2.35;
    const fullBot = st.bottomY - 0.20;
    const fullH = fullTop - fullBot;
    const midY = (fullTop + fullBot) / 2;
    const zMin = landingZ0 - 0.12;
    const zMax = lowerVestZ1 + 0.12;
    addDBox(deepStatic, 0.14, fullH, zMax - zMin - 0.28, concPconMat, st.minX - 0.07, midY, (zMin + zMax) / 2);
    addDBox(deepStatic, w + 0.24, fullH, 0.14, concPconMat, cx, midY, zMin + 0.07);
    addDBox(deepStatic, w + 0.24, fullH, 0.14, concPconMat, cx, midY, zMax - 0.07);
    // East divider wall along the sloped middle section
    addDBox(deepStatic, 0.14, fullH, st.bottomZ - st.topZ, concPconMat, st.maxX + 0.07, midY, (st.topZ + st.bottomZ) / 2);
    // Ceilings over upper landing & lower vestibule + sloped soffit
    addDBox(deepStatic, w + 0.20, 0.14, zMax - zMin, concPconMat, cx, fullTop + 0.07, (zMin + zMax) / 2);

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
  addDWallBox(0.14, 2.02, 1.93, 1.88, yB1 + 1.01, 1.885, 'concrete_pcon', 'concrete_pcon', 'v');
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
    addDBox(deepStatic, 0.24, 0.22, 10.00, concPconMat, bx, yB2 + hB2 - 0.11, 7.85);
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
    addDBox(deepStatic, 1.48, 2.62, 0.016, studioMirrorMat, mx, yB2 + 1.48, 2.885);
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
    addDBox(deepStatic, 0.016, 2.62, 1.46, studioMirrorMat, 0.035, yB2 + 1.48, mz);
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
  addDBox(deepStatic, 2.08, 0.44, 0.64, denimMat, 5.45, yB2 + 0.22, 16.12);
  addDBox(deepStatic, 2.10, 0.72, 0.18, denimMat, 5.45, yB2 + 0.46, 16.56);
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
  addDBox(deepStatic, 0.72, 0.02, 0.56, makeSurfaceMat('metal_grate', 0.7, 0.6), 2.25, yB3 + 0.01, 1.75);
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
  addDBox(deepStatic, 1.45, 0.018, 1.80, makeSurfaceMat('tile_blue_bath', 1.45, 1.8), 2.475, yB3 + 0.009, 9.50);
  addDBox(deepStatic, 1.45, 0.020, 1.60, makeSurfaceMat('tile_beige_grid', 1.45, 1.6), 2.475, yB3 + 0.010, 11.30);
  // Warm Wood Plank Ceiling + Exposed Structural Timber Ceiling Joists every 1.25m!
  addDBox(deepStatic, 3.50, 0.26, 12.80, makeSurfaceMat('plywood_attic', 3.5, 12.8), 1.60, yB3 + hB3 + 0.13, 9.85);
  for (let jz = 4.20; jz <= 15.60; jz += 1.25) {
    addDBox(deepStatic, 3.20, 0.14, 0.12, mat.walnut, 1.60, yB3 + hB3 - 0.07, jz);
  }
  // Warm Wooden Acoustic Slat Feature Wall strictly North of WB3-WK (keeps WB3-WK & DB3-WK 100% open!)
  addDBox(deepStatic, 0.04, 2.65, 1.32, warmTimberMat, 0.03, yB3 + 1.34, 4.30);

  // --- B305: 2.00m × 6.00m FOOD STORAGE WAREHOUSE SLAB & CEILING (X=0.60..2.60, Z=16.25..22.25) ---
  addDBox(deepStatic, 2.30, 0.26, 6.30, concCleanMat, 1.60, yB3 - 0.13, 19.25);
  addDBox(deepStatic, 2.30, 0.24, 6.30, concPconMat, 1.60, yB3 + 2.72, 19.25);

  // Build All B3F Walls & Doors (Existing + NEW DB3-WK, WB3-WK, DB3-SP, DB3-S2, DB3-PS, DB3-BT, DB3-TG, DB3-BT2, DB3-S1, DB3-S3, DB3-FD2!)
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

  // Warm Wooden Dining Table + Hinoki Bench (North-East, leaving Z=6.55..8.50 wide open before DB3-SP Sauna Prep Door!)
  addDBox(deepStatic, 0.80, 0.05, 1.55, hinokiMat, 2.56, yB3 + 0.74, 5.55);
  [[2.24, 4.92], [2.88, 4.92], [2.24, 6.18], [2.88, 6.18]].forEach(([lx, lz]) => {
    addDBox(deepStatic, 0.055, 0.72, 0.055, mat.walnut, lx, yB3 + 0.36, lz);
  });
  addDBox(deepStatic, 0.34, 0.44, 1.38, hinokiMat, 1.94, yB3 + 0.22, 5.55);
  addCollider(-2, 1.74, 4.72, 3.06, 6.40);

  // Cozy Plush Denim Shelter Sofa + Rug beneath WB3-WK Observation Window (leaves Z=6.60..8.55 wide open before DB3-WK!)
  addDBox(deepStatic, 1.30, 0.014, 1.75, makeSurfaceMat('carpet_beige', 1.3, 1.8), 0.90, yB3 + 0.029, 5.72);
  addDBox(deepStatic, 0.54, 0.40, 1.46, denimMat, 0.47, yB3 + 0.20, 5.72);
  addDBox(deepStatic, 0.16, 0.66, 1.48, denimMat, 0.11, yB3 + 0.43, 5.72);
  addCollider(-2, 0.04, 4.94, 0.78, 6.50);
  // Relocated Bookshelf cleanly along Middle Gallery West Wall (clear of DB3-WK & DB3-SH/DB3-WC!)
  addDBox(deepStatic, 0.34, 1.85, 1.05, makeFrontMat('furniture_bookshelf'), 0.20, yB3 + 0.925, 9.75);
  addCollider(-2, 0.02, 9.20, 0.42, 10.30);

  // Warm Hanging Wooden Lantern Pendant in Living Ceiling
  addDBox(deepStatic, 0.02, 0.48, 0.02, mat.darkIron, 1.60, yB3 + hB3 - 0.24, 5.80);
  addDBox(deepStatic, 0.36, 0.24, 0.36, warmGlowMat, 1.60, yB3 + hB3 - 0.56, 5.80);

  // --- B302 SHELTER SHOWER ROOM FIXTURES (X=1.75..3.20, Z=8.60..10.40) ---
  addDBox(deepStatic, 0.04, 0.12, 0.56, mat.chrome, 3.12, yB3 + 1.15, 9.50); // Mixer bar
  addDBox(deepStatic, 0.32, 0.025, 0.32, mat.chrome, 2.86, yB3 + 2.18, 9.50); // Overhead rain shower head
  addDBox(deepStatic, 0.34, 0.02, 0.02, mat.chrome, 3.00, yB3 + 2.20, 9.50);
  addDBox(deepStatic, 0.14, 0.015, 1.15, mat.stainless, 2.95, yB3 + 0.024, 9.50); // Linear drain grate
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

  // --- B305 (2.0m×6.0m) 1ST FOOD STORAGE WAREHOUSE RACKS (STRAIGHT-THROUGH TO DB3-FD2 -> B306!) ---
  // Heavy-Duty 4-Tier Storage Racks lining West (X=0.64..1.08) & East (X=2.12..2.56) Walls!
  // Leaves X = 1.08..2.12 (1.04m wide!) completely unobstructed all the way through DB3-FD2 into B306!
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
  [17.15, 18.55, 19.95, 21.35].forEach((rzBay) => {
    buildFoodRackBay(0.84, rzBay);
    buildFoodRackBay(2.36, rzBay);
  });
  addCollider(-2, 0.60, 16.50, 1.09, 22.02);
  addCollider(-2, 2.11, 16.50, 2.60, 22.02);

  // Overhead Bright Food Pantry LED Light Bars
  [17.85, 20.65].forEach((lz) => {
    addDBox(deepStatic, 0.16, 0.04, 1.05, studioTrackGlow, 1.60, yB3 + 2.58, lz);
  });

  // =========================================================================
  // 3b. B4F (Y = -14.20m, CH = 3.55m — ELEVATOR-ONLY!):
  // 2.70m × 15.50m CLANDESTINE GANG RESEARCH LABORATORY (5 LONGITUDINAL ZONES)
  // =========================================================================
  const yB4 = FLOOR_B4F.baseY;     // -14.20 m (Exact 4.00 m below B3F!)
  const hB4 = FLOOR_B4F.ceilingH;  // 3.55 m soaring high-ceiling ribbed vault!
  const b4MinX = FLOOR_B4F.originX; // 0.55
  const b4MaxX = b4MinX + FLOOR_B4F.width; // 3.25 (W = 2.70 m EXACT)
  const b4Cx = (b4MinX + b4MaxX) * 0.5;    // 1.90
  const b4MinZ = FLOOR_B4F.originZ; // 0.85
  const b4MaxZ = b4MinZ + FLOOR_B4F.depth; // 16.35 (D = 15.50 m EXACT)
  const b4Cz = (b4MinZ + b4MaxZ) * 0.5;    // 8.60

  // --- Dedicated B4F Tactical Laboratory Materials & Procedural CanvasTextures ---
  const labDarkSteelMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.38, metalness: 0.72 });
  const labGunmetalMat = new THREE.MeshStandardMaterial({ color: 0x353f4b, roughness: 0.42, metalness: 0.65 });
  const labEpoxyTopMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.22, metalness: 0.16 });
  const labWhiteCaseMat = new THREE.MeshStandardMaterial({ color: 0xd9e0e6, roughness: 0.36, metalness: 0.25 });
  const labCyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x9ef0ff, emissive: new THREE.Color(0x22d3ee), emissiveIntensity: 1.55, roughness: 0.2 });
  const labEmeraldGlowMat = new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: new THREE.Color(0x10b981), emissiveIntensity: 1.45, roughness: 0.22 });
  const labCrimsonGlowMat = new THREE.MeshStandardMaterial({ color: 0xff8598, emissive: new THREE.Color(0xe11d48), emissiveIntensity: 1.65, roughness: 0.22 });
  const labUvGlowMat = new THREE.MeshStandardMaterial({ color: 0xd8b4fe, emissive: new THREE.Color(0x9333ea), emissiveIntensity: 1.75, roughness: 0.2 });
  const labHazardYellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.44, metalness: 0.18 });
  const labCopperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.30, metalness: 0.85 });
  const labGlassMat = new THREE.MeshStandardMaterial({
    color: 0xa5d8f0,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const labLedBarMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, emissive: new THREE.Color(0xcffafe), emissiveIntensity: 1.65, roughness: 0.2 });
  const labToolRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.36, metalness: 0.38 });
  const labGasGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.35, metalness: 0.45 });
  const labGasBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.45 });
  const labOliveCaseMat = new THREE.MeshStandardMaterial({ color: 0x3f4f3c, roughness: 0.72, metalness: 0.12 });
  const labGoldBarMat = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.22, metalness: 0.92 });

  const makeCanvasMat = (w, h, drawFn, emissiveHex = 0x334455, emissiveInt = 0.55) => {
    if (typeof document === 'undefined') {
      return new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: new THREE.Color(emissiveHex), emissiveIntensity: emissiveInt });
    }
    const cv = document.createElement('canvas');
    cv.width = w * 2;
    cv.height = h * 2;
    const c = cv.getContext('2d');
    c.scale(2, 2);
    drawFn(c, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: emissiveInt,
      roughness: 0.28,
    });
  };

  // Procedural Syndicate Plaque Texture (North Wall of B401)
  const syndicatePlaqueMat = makeCanvasMat(512, 192, (c, w, h) => {
    c.fillStyle = '#0d1117';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e11d48';
    c.lineWidth = 6;
    c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#e11d48';
    c.fillRect(18, 18, 12, h - 36);
    c.fillStyle = '#f8fafc';
    c.font = '900 34px monospace';
    c.fillText('SECTOR B4 // BLACK-OPS R&D', 46, 66);
    c.fillStyle = '#38bdf8';
    c.font = '700 22px monospace';
    c.fillText('SYNDICATE CLASSIFIED LABORATORY — LV.5', 46, 108);
    c.fillStyle = '#fb7185';
    c.font = '700 18px monospace';
    c.fillText('ELEVATOR ACCESS ONLY  |  DEPTH -14.20m  |  OFF-GRID', 46, 152);
  }, 0x883344, 0.72);

  // Procedural Chemistry Synthesis Whiteboard Texture (East Wall of B402)
  const chemBoardMat = makeCanvasMat(512, 256, (c, w, h) => {
    c.fillStyle = '#edf3f7';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#334155';
    c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
    // Title
    c.fillStyle = '#0f172a';
    c.font = '800 19px monospace';
    c.fillText('PROJECT SYNTH-09 // CATALYTIC REFINEMENT', 18, 30);
    // Draw Benzene Rings + Molecular Bonds!
    const drawHex = (cx, cy, r, col) => {
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.stroke();
      c.beginPath(); c.arc(cx, cy, r * 0.56, 0, Math.PI * 2); c.stroke();
    };
    drawHex(78, 102, 32, '#0284c7');
    drawHex(148, 102, 32, '#0284c7');
    drawHex(113, 158, 28, '#0f766e');
    c.strokeStyle = '#dc2626'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(180, 102); c.lineTo(240, 102); c.stroke();
    c.fillStyle = '#dc2626'; c.font = '800 16px monospace';
    c.fillText('NH-CH3 -> 99.4% YIELD', 248, 108);
    // Purity Spectrogram Graph on Right
    c.strokeStyle = '#334155'; c.lineWidth = 2;
    c.strokeRect(255, 130, 232, 102);
    c.strokeStyle = '#0284c7'; c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(265, 222); c.lineTo(310, 215); c.lineTo(335, 148); c.lineTo(360, 218); c.lineTo(405, 165); c.lineTo(435, 220); c.lineTo(476, 216);
    c.stroke();
    c.fillStyle = '#b91c1c'; c.font = '700 15px monospace';
    c.fillText('CRYO CORE: -196.0°C  [LOCKED]', 22, 234);
  }, 0x64748b, 0.35);

  // Procedural 3 Cyber/Tactical Monitor Screen Textures (B403 Command Console)
  const makeCyberScreenMat = (mode) => makeCanvasMat(256, 160, (c, w, h) => {
    c.fillStyle = '#071019';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = mode === 'cam' ? '#22c55e' : (mode === 'wave' ? '#f59e0b' : '#38bdf8');
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, h - 4);
    if (mode === 'net') {
      // Encrypted Syndicate Network Map
      c.fillStyle = '#38bdf8'; c.font = '700 12px monospace';
      c.fillText('SYNDICATE CRYPTO-NET // ACTIVE', 10, 18);
      const pts = [[45, 58], [122, 42], [202, 64], [78, 118], [164, 122], [128, 86]];
      c.strokeStyle = 'rgba(56,189,248,0.55)'; c.lineWidth = 1.5;
      [[0, 1], [1, 2], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [3, 4]].forEach(([a, b]) => {
        c.beginPath(); c.moveTo(pts[a][0], pts[a][1]); c.lineTo(pts[b][0], pts[b][1]); c.stroke();
      });
      pts.forEach(([px, py], i) => {
        c.fillStyle = i === 5 ? '#f43f5e' : '#38bdf8';
        c.beginPath(); c.arc(px, py, i === 5 ? 7 : 4.5, 0, Math.PI * 2); c.fill();
      });
      c.fillStyle = '#4ade80'; c.font = '700 11px monospace';
      c.fillText('AES-512 DECRYPT: 94.8%  [TOR-NODE 12]', 10, 148);
    } else if (mode === 'cam') {
      // 4-Split Compound Security Cameras!
      c.strokeStyle = '#1e3a2f'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w / 2, h); c.moveTo(0, h / 2 + 8); c.lineTo(w, h / 2 + 8); c.stroke();
      c.fillStyle = '#4ade80'; c.font = '700 11px monospace';
      c.fillText('CAM-01 FOREST', 8, 34); c.fillText('CAM-02 ANNEX', 136, 34);
      c.fillText('CAM-03 ELV-1', 8, 102); c.fillText('CAM-04 B4 AIRLOCK', 136, 102);
      c.fillStyle = '#ef4444'; c.fillText('● REC LIVE', 176, 16);
    } else {
      // Oscilloscope & RF Spectrum Waveform
      c.fillStyle = '#fbbf24'; c.font = '700 12px monospace';
      c.fillText('RF SPECTRUM // JAMMER 2.4-5.8GHz', 10, 18);
      c.strokeStyle = '#f59e0b'; c.lineWidth = 2;
      c.beginPath();
      for (let x = 10; x < w - 10; x += 4) {
        const y = 84 + Math.sin(x * 0.14) * 24 + Math.cos(x * 0.37) * 14;
        if (x === 10) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      for (let bx = 18; bx < w - 18; bx += 14) {
        const bh = 12 + ((bx * 37) % 34);
        c.fillStyle = 'rgba(56,189,248,0.65)';
        c.fillRect(bx, 146 - bh, 8, bh);
      }
    }
  }, 0x5588aa, 0.85);

  const cyberNetMat = makeCyberScreenMat('net');
  const cyberCamMat = makeCyberScreenMat('cam');
  const cyberWaveMat = makeCyberScreenMat('wave');

  // Procedural Syndicate Operations Conspiracy & Evidence Board (East Wall of B403)
  const conspiracyBoardMat = makeCanvasMat(512, 288, (c, w, h) => {
    c.fillStyle = '#1f2329';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#525b66'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    // Faint city street grid map background
    c.strokeStyle = 'rgba(148,163,184,0.16)'; c.lineWidth = 1.5;
    for (let gx = 24; gx < w; gx += 32) { c.beginPath(); c.moveTo(gx, 12); c.lineTo(gx, h - 12); c.stroke(); }
    for (let gy = 24; gy < h; gy += 32) { c.beginPath(); c.moveTo(12, gy); c.lineTo(w - 12, gy); c.stroke(); }
    // Pinned Dossier Cards, Blueprints & Sticky Notes
    const cards = [
      [34, 34, 112, 78, '#f1ece1', 'PORT DOCK 04'],
      [194, 28, 122, 82, '#e2edf7', 'SYNDICATE HUB'],
      [362, 42, 116, 76, '#f6e7c8', 'TARGET ROUTE'],
      [58, 168, 118, 84, '#ebe4d8', 'KEYCARD SPEC'],
      [230, 174, 108, 78, '#fde68a', 'LAB B4 TIMELINE'],
      [372, 166, 106, 86, '#fee2e2', 'WARNING: SEC'],
    ];
    cards.forEach(([x, y, cw, ch, col, lbl]) => {
      c.fillStyle = col; c.fillRect(x, y, cw, ch);
      c.fillStyle = '#1e293b'; c.font = '800 11px monospace'; c.fillText(lbl, x + 6, y + 18);
      c.fillStyle = 'rgba(30,41,59,0.35)';
      c.fillRect(x + 8, y + 28, cw - 16, 6);
      c.fillRect(x + 8, y + 40, cw - 28, 6);
      c.fillRect(x + 8, y + 52, cw - 20, 6);
    });
    // Crimson Conspiracy Thread Lines Connecting Evidence Pins!
    const pins = [[90, 42], [255, 36], [420, 50], [116, 176], [284, 182], [424, 174]];
    c.strokeStyle = '#ef4444'; c.lineWidth = 2.6;
    [[0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [1, 5], [0, 4]].forEach(([a, b]) => {
      c.beginPath(); c.moveTo(pins[a][0], pins[a][1]); c.lineTo(pins[b][0], pins[b][1]); c.stroke();
    });
    pins.forEach(([px, py]) => {
      c.fillStyle = '#dc2626'; c.beginPath(); c.arc(px, py, 5.5, 0, Math.PI * 2); c.fill();
    });
  }, 0x553333, 0.40);

  // --- B4F STRUCTURAL SLABS, MULTI-ZONE FLOORING & SOARING CH 3.55m RIBBED CEILING ---
  // Continuous 300mm Structural Base Concrete Slab + 450mm Overhead Seismic Isolation Slab beneath B3F!
  addDBox(deepStatic, FLOOR_B4F.width + 0.50, 0.30, FLOOR_B4F.depth + 0.50, concCleanMat, b4Cx, yB4 - 0.15, b4Cz);
  addDBox(deepStatic, FLOOR_B4F.width + 0.50, 0.44, FLOOR_B4F.depth + 0.50, concPconMat, b4Cx, yB4 + hB4 + 0.22, b4Cz);

  // Zone-specific Precision Lab Flooring Finish
  addDBox(deepStatic, 2.70, 0.022, 2.40, makeSurfaceMat('rubber_black_stud', 2.7, 2.4), b4Cx, yB4 + 0.011, 2.05); // B401 Airlock
  addDBox(deepStatic, 2.70, 0.022, 6.95, makeSurfaceMat('tile_grey_stone', 2.7, 7.0, { color: 0x5b646f }), b4Cx, yB4 + 0.011, 6.80); // B402+B403
  addDBox(deepStatic, 2.70, 0.022, 3.15, makeSurfaceMat('concrete_clean', 2.7, 3.1, { color: 0x6c7278 }), b4Cx, yB4 + 0.011, 11.90); // B404 Fab
  addDBox(deepStatic, 2.70, 0.022, 2.85, makeSurfaceMat('rubber_black_stud', 2.7, 2.8), b4Cx, yB4 + 0.011, 14.95); // B405 Vault

  // Full-Length Recessed Central Steel Trench Drain / Fiber-Optic Floor Channel (X=1.96, Z=3.20..15.80) + Luminous Strip!
  addDBox(deepStatic, 0.18, 0.020, 12.60, makeSurfaceMat('metal_grate', 0.2, 12.6), 1.96, yB4 + 0.018, 9.50);
  addDBox(deepStatic, 0.026, 0.020, 12.40, labCyanGlowMat, 1.96, yB4 + 0.022, 9.50);

  // 8 Exposed Reinforced Concrete Portal Frame Structural Ribs (Columns + Haunched Ceiling Beams along 15.5m!)
  const pilH = hB4 - 0.30;
  [1.05, 3.05, 5.05, 7.05, 9.05, 11.05, 13.05, 15.25].forEach((rz) => {
    // West & East concrete pilaster columns stopped cleanly below ceiling rib beams
    addDBox(deepStatic, 0.14, pilH, 0.22, concPconMat, b4MinX + 0.075, yB4 + pilH * 0.5, rz);
    if (rz > 2.70) {
      addDBox(deepStatic, 0.14, pilH, 0.22, concPconMat, b4MaxX - 0.075, yB4 + pilH * 0.5, rz);
    }
    // Overhead deep structural ceiling rib beam + dark steel gusset brackets
    addDBox(deepStatic, FLOOR_B4F.width - 0.02, 0.30, 0.24, concPconMat, b4Cx, yB4 + hB4 - 0.15, rz);
    addDBox(deepStatic, 0.26, 0.26, 0.10, labDarkSteelMat, b4MinX + 0.15, yB4 + hB4 - 0.32, rz);
    addDBox(deepStatic, 0.26, 0.26, 0.10, labDarkSteelMat, b4MaxX - 0.15, yB4 + hB4 - 0.32, rz);
  });

  // Lower Hairline Stainless Steel Lab Wainscoting & Yellow Hazard Kick Strips along West & East Walls
  addDBox(deepStatic, 0.020, 0.96, FLOOR_B4F.depth - 0.10, mat.stainless, b4MinX + 0.015, yB4 + 0.48, b4Cz);
  addDBox(deepStatic, 0.020, 0.96, FLOOR_B4F.depth - 1.90, mat.stainless, b4MaxX - 0.015, yB4 + 0.48, (2.65 + b4MaxZ) * 0.5);
  addDBox(deepStatic, 0.024, 0.045, FLOOR_B4F.depth - 0.10, labHazardYellowMat, b4MinX + 0.028, yB4 + 0.05, b4Cz);

  // OVERHEAD INDUSTRIAL UTILITY SPINE (Soaring Y = yB4 + 2.95 .. 3.45m!)
  // 1) Full 15.0m Galvanized Cylindrical HEPA Exhaust Trunk Duct along West Ceiling (X = 0.88)
  const hepaDuct = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14.90, 12), mat.stainless);
  hepaDuct.rotation.x = Math.PI / 2;
  hepaDuct.position.set(0.88, yB4 + 3.06, b4Cz);
  deepStatic.add(hepaDuct);
  // 2) Full 14.6m Yellow Steel I-Beam Overhead Monorail Crane Track (X = 1.96) + Wheeled Chain Hoist Trolley over B404!
  addDBox(deepStatic, 0.12, 0.14, 14.60, labHazardYellowMat, 1.96, yB4 + 3.10, b4Cz);
  addDBox(deepStatic, 0.16, 0.025, 14.60, labDarkSteelMat, 1.96, yB4 + 3.02, b4Cz);
  // Hoist Trolley parked at B404 CNC Fabrication Zone (Z = 11.75)
  addDBox(deepStatic, 0.26, 0.20, 0.38, labDarkSteelMat, 1.96, yB4 + 2.94, 11.75);
  const hoistChain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.56, 6), mat.darkIron);
  hoistChain.position.set(1.96, yB4 + 2.58, 11.75);
  deepStatic.add(hoistChain);
  addDBox(deepStatic, 0.08, 0.12, 0.08, labHazardYellowMat, 1.96, yB4 + 2.28, 11.75); // Hoist hook block
  // 3) Full 14.8m East Perforated Cable Tray + Color-Coded Power/Data/Fire-Sprinkler Pipes (X = 2.96)
  addDBox(deepStatic, 0.24, 0.04, 14.80, labGunmetalMat, 2.96, yB4 + 3.04, b4Cz);
  const firePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 14.80, 8), labToolRedMat);
  firePipe.rotation.x = Math.PI / 2;
  firePipe.position.set(2.86, yB4 + 3.16, b4Cz);
  deepStatic.add(firePipe);
  const hvConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 14.80, 8), labHazardYellowMat);
  hvConduit.rotation.x = Math.PI / 2;
  hvConduit.position.set(3.02, yB4 + 3.12, b4Cz);
  deepStatic.add(hvConduit);
  // 4) 5 Suspended High-Ceiling Architectural Lab Linear LED Bars (1 per zone!)
  [2.05, 5.10, 8.60, 11.90, 14.90].forEach((lz) => {
    addDBox(deepStatic, 0.14, 0.05, 1.65, labDarkSteelMat, 1.96, yB4 + 2.86, lz);
    addDBox(deepStatic, 0.10, 0.02, 1.58, labLedBarMat, 1.96, yB4 + 2.83, lz);
  });

  // Build All B4F Concrete Blast Walls, Glass Bulkheads & Doors (DB4-1, DB4-2, DB4-3, DB4-4!)
  buildDeepWalls(FLOOR_B4F, hB4);

  // --- ZONE 1: B401 BIOMETRIC AIRLOCK & DECONTAMINATION ENTRY (Z = 0.85..3.25) ---
  // North Wall Illuminated Syndicate Classified Crest Plaque
  addDBox(deepStatic, 1.68, 0.64, 0.04, syndicatePlaqueMat, 1.88, yB4 + 1.88, b4MinZ + 0.03);
  // Corner Security CCTV Dome aimed directly at ELV-1 doors
  const b4Cctv = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), labDarkSteelMat);
  b4Cctv.position.set(0.76, yB4 + 2.75, 1.04);
  deepStatic.add(b4Cctv);
  addDBox(deepStatic, 0.03, 0.03, 0.03, labCrimsonGlowMat, 0.82, yB4 + 2.72, 1.09);
  // West Wall: Emergency Deluge Shower & Yellow Eyewash Station (Z = 1.40)
  const showerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 2.35, 8), labHazardYellowMat);
  showerPole.position.set(0.76, yB4 + 1.18, 1.40);
  deepStatic.add(showerPole);
  const showerBell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 12), labHazardYellowMat);
  showerBell.position.set(0.96, yB4 + 2.26, 1.40);
  deepStatic.add(showerBell);
  const eyewashBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.10, 0.09, 12), mat.stainless);
  eyewashBowl.position.set(0.92, yB4 + 1.02, 1.40);
  deepStatic.add(eyewashBowl);
  // West Wall: Gunmetal Tactical Hazmat & Lab Coat Double Locker (Z = 2.40)
  addDBox(deepStatic, 0.56, 2.04, 1.02, labGunmetalMat, 0.85, yB4 + 1.02, 2.40);
  addDBox(deepStatic, 0.02, 1.90, 0.02, labDarkSteelMat, 1.14, yB4 + 1.02, 2.40);
  addDBox(deepStatic, 0.02, 0.16, 0.24, labHazardYellowMat, 1.14, yB4 + 1.65, 2.18);
  addCollider(-3, 0.55, 1.16, 1.18, 2.96);
  // Biometric Retinal/Palm Scanner Panel right beside Door DB4-1 (Z = 3.22) + Decon Floor Grate
  addDBox(deepStatic, 0.20, 0.36, 0.05, labDarkSteelMat, 2.66, yB4 + 1.32, 3.22);
  addDBox(deepStatic, 0.14, 0.18, 0.02, labEmeraldGlowMat, 2.66, yB4 + 1.36, 3.19);
  addDBox(deepStatic, 0.96, 0.020, 0.72, makeSurfaceMat('metal_grate', 0.96, 0.72), 1.98, yB4 + 0.018, 2.75);

  // --- ZONE 2: B402 PRECISION CHEMICAL & PHARMACOLOGY SYNTHESIS LAB (Z = 3.35..6.85) ---
  // West Wall: Full Stainless & Tempered-Glass Chemical Fume Hood (ドラフトチャンバー, Z = 3.70..5.45)
  addDBox(deepStatic, 0.78, 0.88, 1.76, labGunmetalMat, 0.94, yB4 + 0.44, 4.58);      // Lower chemical cabinet
  addDBox(deepStatic, 0.80, 0.05, 1.78, labEpoxyTopMat, 0.95, yB4 + 0.90, 4.58);      // Acid-proof epoxy deck
  addDBox(deepStatic, 0.12, 1.48, 1.76, labWhiteCaseMat, 0.62, yB4 + 1.64, 4.58);     // Rear baffle
  addDBox(deepStatic, 0.78, 0.36, 1.76, labGunmetalMat, 0.94, yB4 + 2.26, 4.58);      // Upper hood plenum
  addDBox(deepStatic, 0.78, 1.24, 0.06, labGunmetalMat, 0.94, yB4 + 1.52, 3.72);      // North cheek
  addDBox(deepStatic, 0.78, 1.24, 0.06, labGunmetalMat, 0.94, yB4 + 1.52, 5.44);      // South cheek
  addDBox(deepStatic, 0.02, 0.72, 1.64, labGlassMat, 1.32, yB4 + 1.74, 4.58);         // Sliding glass sash!
  addDBox(deepStatic, 0.04, 0.04, 1.64, mat.stainless, 1.32, yB4 + 1.38, 4.58);       // Sash handle bar
  addDBox(deepStatic, 0.14, 0.03, 1.42, labLedBarMat, 0.96, yB4 + 2.06, 4.58);        // Hood interior UV/work light
  // Vertical Exhaust Stack rising straight into the overhead HEPA trunk duct!
  const hoodStack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 10), mat.stainless);
  hoodStack.position.set(0.88, yB4 + 2.74, 4.58);
  deepStatic.add(hoodStack);
  // Glassware Inside Fume Hood: Hotplate + Glowing Emerald/Cyan/Amber Erlenmeyer Reaction Flasks & Condenser!
  addDBox(deepStatic, 0.24, 0.06, 0.24, labDarkSteelMat, 0.94, yB4 + 0.96, 4.18);
  [
    { z: 4.18, r: 0.085, h: 0.22, m: labEmeraldGlowMat },
    { z: 4.52, r: 0.075, h: 0.26, m: labCyanGlowMat },
    { z: 4.86, r: 0.080, h: 0.20, m: amberStripMat },
    { z: 5.16, r: 0.065, h: 0.24, m: labCrimsonGlowMat },
  ].forEach((flk) => {
    const body = new THREE.Mesh(new THREE.ConeGeometry(flk.r, flk.h, 10), flk.m);
    body.position.set(0.95, yB4 + 0.93 + flk.h * 0.5, flk.z);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.12, 8), labGlassMat);
    neck.position.set(0.95, yB4 + 0.93 + flk.h + 0.04, flk.z);
    deepStatic.add(body, neck);
  });
  // Chained High-Pressure Industrial Gas Cylinders (N2, Ar, O2) at Z = 5.82, 6.16, 6.50
  [[5.82, labDarkSteelMat], [6.16, labGasGreenMat], [6.50, labGasBlueMat]].forEach(([gz, gm]) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 1.38, 12), gm);
    tank.position.set(0.82, yB4 + 0.70, gz);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.16, 8), labCopperMat);
    valve.position.set(0.82, yB4 + 1.46, gz);
    deepStatic.add(tank, valve);
  });
  addDBox(deepStatic, 0.03, 0.04, 0.98, labHazardYellowMat, 0.95, yB4 + 0.95, 6.16); // Safety restraint bracket
  addCollider(-3, 0.55, 3.60, 1.36, 6.72);

  // East Wall: Granite-Top Anti-Vibration Analytical Bench (Z = 3.70..6.55) + Microscope + Centrifuge + Reagent Rack + Whiteboard!
  addDBox(deepStatic, 0.58, 0.86, 2.84, labDarkSteelMat, 2.94, yB4 + 0.43, 5.12);
  addDBox(deepStatic, 0.62, 0.045, 2.88, labEpoxyTopMat, 2.93, yB4 + 0.88, 5.12);
  // Binocular Optical Compound Microscope (Z = 4.25)
  addDBox(deepStatic, 0.18, 0.04, 0.22, labWhiteCaseMat, 2.86, yB4 + 0.92, 4.25);
  addDBox(deepStatic, 0.06, 0.30, 0.06, labWhiteCaseMat, 2.92, yB4 + 1.08, 4.25);
  addDBox(deepStatic, 0.12, 0.03, 0.12, labDarkSteelMat, 2.84, yB4 + 1.04, 4.25); // Stage
  const eyeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8), labDarkSteelMat);
  eyeTube.rotation.z = 0.6;
  eyeTube.position.set(2.82, yB4 + 1.24, 4.25);
  deepStatic.add(eyeTube);
  // Benchtop High-Speed Micro-Centrifuge (Z = 4.95) & Analytical Micro-Balance (Z = 5.55)
  addDBox(deepStatic, 0.34, 0.24, 0.38, labWhiteCaseMat, 2.90, yB4 + 1.02, 4.95);
  addDBox(deepStatic, 0.02, 0.06, 0.16, labCyanGlowMat, 2.72, yB4 + 1.00, 4.95);
  addDBox(deepStatic, 0.28, 0.32, 0.28, labGlassMat, 2.88, yB4 + 1.06, 5.55);
  // Amber/Blue Chemical Reagent Bottle Rack (Z = 6.18)
  addDBox(deepStatic, 0.22, 0.46, 0.56, mat.stainless, 3.06, yB4 + 1.13, 6.18);
  for (let bi = 0; bi < 4; bi++) {
    const btl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 8), bi % 2 === 0 ? amberStripMat : labGasBlueMat);
    btl.position.set(3.04, yB4 + 1.02, 5.98 + bi * 0.13);
    deepStatic.add(btl);
  }
  // Molecular Synthesis Glass Whiteboard mounted cleanly inside East RC pilaster bay (Z=5.20..6.76, clear of 5.05 rib!)
  addDBox(deepStatic, 0.03, 0.94, 1.56, chemBoardMat, 3.22, yB4 + 1.82, 5.98);
  addCollider(-3, 2.60, 3.64, 3.25, 6.60);

  // --- ZONE 3: B403 CYBER CRYPTANALYSIS & SYNDICATE TACTICAL COMMAND (Z = 6.95..10.25) ---
  // West Wall: 5-Monitor Curved Cyber/Tactical Research Command Console (Z = 7.20..9.00)
  addDBox(deepStatic, 0.76, 0.74, 1.82, labDarkSteelMat, 0.94, yB4 + 0.37, 8.10);
  addDBox(deepStatic, 0.80, 0.04, 1.86, labEpoxyTopMat, 0.95, yB4 + 0.76, 8.10);
  // 5 Glowing Tactical Monitors (3 bottom row + 2 upper row!)
  addDBox(deepStatic, 0.03, 0.40, 0.64, cyberNetMat, 0.68, yB4 + 1.08, 8.10);  // Center primary
  addDBox(deepStatic, 0.03, 0.36, 0.52, cyberWaveMat, 0.74, yB4 + 1.06, 7.46); // Left RF spectrum
  addDBox(deepStatic, 0.03, 0.36, 0.52, cyberCamMat, 0.74, yB4 + 1.06, 8.74);  // Right security cams
  addDBox(deepStatic, 0.03, 0.34, 0.58, cyberCamMat, 0.68, yB4 + 1.50, 7.78);  // Upper left
  addDBox(deepStatic, 0.03, 0.34, 0.58, cyberNetMat, 0.68, yB4 + 1.50, 8.42);  // Upper right
  // Keyboard, Oscilloscope & Precision Soldering Station
  addDBox(deepStatic, 0.16, 0.025, 0.44, labGunmetalMat, 1.12, yB4 + 0.79, 8.10);
  addDBox(deepStatic, 0.24, 0.18, 0.28, labGunmetalMat, 0.96, yB4 + 0.87, 7.36);
  addDBox(deepStatic, 0.02, 0.12, 0.18, labEmeraldGlowMat, 1.08, yB4 + 0.88, 7.36);
  // 3-Bay Full-Height 42U Matte-Black Cryptanalysis Server Rack (Z = 9.12..10.14)
  addDBox(deepStatic, 0.78, 2.22, 1.04, labDarkSteelMat, 0.94, yB4 + 1.11, 9.63);
  for (let su = 0; su < 10; su++) {
    const ledMat = su % 3 === 0 ? labCyanGlowMat : (su % 3 === 1 ? labEmeraldGlowMat : amberStripMat);
    addDBox(deepStatic, 0.02, 0.035, 0.78, ledMat, 1.34, yB4 + 0.38 + su * 0.18, 9.63);
  }
  addCollider(-3, 0.55, 7.12, 1.36, 10.18);

  // INTERACTIVE WALL SWITCH #1: B4F Tactical UV / Covert Crimson Lighting Mode Toggle (flush on inward face of Z=7.05 RC pilaster!)
  const uvSwitchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.20, 0.14), labCyanGlowMat);
  uvSwitchMesh.position.set(0.69, yB4 + 1.34, 7.05);
  uvSwitchMesh.userData.propId = 'lab_uv_mode';
  deepDynamic.add(uvSwitchMesh);

  // East Wall: Syndicate Conspiracy/Operations Strategy Board framed cleanly between Z=7.05 & Z=9.05 RC pilasters (Z=7.20..8.90)!
  addDBox(deepStatic, 0.04, 1.06, 1.70, conspiracyBoardMat, 3.22, yB4 + 1.66, 8.05);
  addDBox(deepStatic, 0.54, 0.82, 1.35, labDarkSteelMat, 2.96, yB4 + 0.41, 8.05); // Tactical comm console
  addDBox(deepStatic, 0.26, 0.18, 0.42, labGunmetalMat, 2.92, yB4 + 0.91, 7.80);  // Shortwave transceiver
  addDBox(deepStatic, 0.02, 0.08, 0.26, labCrimsonGlowMat, 2.78, yB4 + 0.92, 7.80);
  addDBox(deepStatic, 0.56, 1.28, 0.72, labGunmetalMat, 2.96, yB4 + 0.64, 9.56); // Evidence filing cabinet
  addCollider(-3, 2.62, 7.26, 3.25, 9.96);

  // --- ZONE 4: B404 5-AXIS CNC FABRICATION & TACTICAL GADGET PROTOTYPING (Z = 10.35..13.45) ---
  // West Wall: Enclosed 5-Axis Precision CNC Milling Center (Z = 10.52..11.62)
  addDBox(deepStatic, 0.78, 1.88, 1.10, labGunmetalMat, 0.94, yB4 + 0.94, 11.07);
  addDBox(deepStatic, 0.03, 0.76, 0.76, labGlassMat, 1.33, yB4 + 1.30, 11.07);
  addDBox(deepStatic, 0.12, 0.34, 0.12, mat.stainless, 0.94, yB4 + 1.44, 11.07); // CNC spindle head
  addDBox(deepStatic, 0.26, 0.12, 0.26, mat.stainless, 0.94, yB4 + 1.02, 11.07); // Machined billet
  addDBox(deepStatic, 0.16, 0.03, 0.64, labLedBarMat, 0.96, yB4 + 1.72, 11.07);
  // Resin UV SLA 3D Printer with Glowing Violet Curing Chamber (Z = 11.72..12.22)
  addDBox(deepStatic, 0.52, 0.76, 0.50, labDarkSteelMat, 0.88, yB4 + 0.38, 11.97);
  addDBox(deepStatic, 0.42, 0.56, 0.42, labUvGlowMat, 0.88, yB4 + 1.04, 11.97);
  // Prototype Workbench + Tactical 4-Rotor Recon Drone Mid-Assembly + Rolling Red Mechanic Tool Chest (Z = 12.28..13.34)
  addDBox(deepStatic, 0.76, 0.06, 1.06, hinokiMat, 0.94, yB4 + 0.88, 12.81);
  addDBox(deepStatic, 0.66, 0.82, 0.92, labToolRedMat, 0.92, yB4 + 0.41, 12.81); // Red rolling tool chest
  // Quad-Rotor Tactical Recon Drone Frame on Workbench!
  addDBox(deepStatic, 0.42, 0.03, 0.04, labDarkSteelMat, 0.96, yB4 + 0.94, 12.78);
  addDBox(deepStatic, 0.04, 0.03, 0.42, labDarkSteelMat, 0.96, yB4 + 0.946, 12.78);
  addDBox(deepStatic, 0.14, 0.05, 0.14, labEmeraldGlowMat, 0.96, yB4 + 0.96, 12.78); // Flight controller PCB
  addCollider(-3, 0.55, 10.48, 1.36, 13.36);

  // East Wall: Tactical Prototype Pegboard framed cleanly between Z=11.05 & Z=13.05 RC pilasters (Z=11.19..12.91) + Pelican Cases!
  addDBox(deepStatic, 0.04, 1.76, 1.72, labDarkSteelMat, 3.22, yB4 + 1.50, 12.05); // Matte-black pegboard
  addDBox(deepStatic, 0.54, 0.78, 2.58, labGunmetalMat, 2.96, yB4 + 0.39, 11.94);  // Lower heavy equipment bench
  // Tactical Gear Props: Ceramic Ballistic Test Plates, Signal Jammer Boxes, Pelican Hard Cases!
  [11.50, 12.05, 12.60].forEach((pz, idx) => {
    addDBox(deepStatic, 0.06, 0.36, 0.28, idx === 1 ? labGunmetalMat : labOliveCaseMat, 3.16, yB4 + 1.56, pz);
  });
  addDBox(deepStatic, 0.36, 0.24, 0.52, labOliveCaseMat, 2.94, yB4 + 0.90, 11.15); // Pelican Case 1
  addDBox(deepStatic, 0.36, 0.24, 0.52, labDarkSteelMat, 2.94, yB4 + 0.90, 11.82); // Pelican Case 2 (Optics)
  addDBox(deepStatic, 0.24, 0.20, 0.36, labDarkSteelMat, 2.94, yB4 + 0.88, 12.56); // Signal Jammer Prototype
  addDBox(deepStatic, 0.02, 0.06, 0.12, labCrimsonGlowMat, 2.81, yB4 + 0.90, 12.56);
  addCollider(-3, 2.62, 10.58, 3.25, 13.28);

  // --- ZONE 5: B405 CLASSIFIED CORE CONTAINMENT POD, CRYO VAULT & OFF-GRID POWER (Z = 13.55..16.35) ---
  // CENTERPIECE: Armored Pedestal + Illuminated Cylindrical Containment Pod with REAL-TIME ROTATING LUMINOUS CORE!
  const podX = 1.90;
  const podZ = 15.52;
  addDBox(deepStatic, 0.92, 0.14, 0.92, labDarkSteelMat, podX, yB4 + 0.07, podZ);
  addDBox(deepStatic, 0.72, 0.58, 0.72, labGunmetalMat, podX, yB4 + 0.43, podZ);
  const podBaseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.12, 16), mat.stainless);
  podBaseRing.position.set(podX, yB4 + 0.78, podZ);
  const podTopRing = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.36, 0.16, 16), mat.stainless);
  podTopRing.position.set(podX, yB4 + 2.38, podZ);
  const podGlassCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.48, 18, 1, true), labGlassMat);
  podGlassCyl.position.set(podX, yB4 + 1.58, podZ);
  const podCoolantPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.12, 10), mat.stainless);
  podCoolantPipe.position.set(podX, yB4 + 3.00, podZ); // Connects straight into ceiling manifold!
  deepStatic.add(podBaseRing, podTopRing, podGlassCyl, podCoolantPipe);
  // 3 Vertical Tension Tie-Rods around the Containment Cylinder
  for (let ti = 0; ti < 3; ti++) {
    const ta = (ti * Math.PI * 2) / 3 + Math.PI / 6;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.64, 6), labCopperMat);
    rod.position.set(podX + Math.cos(ta) * 0.37, yB4 + 1.58, podZ + Math.sin(ta) * 0.37);
    deepStatic.add(rod);
  }
  // DYNAMIC ANIMATED ROTATING LUMINOUS CORE + MAGNETIC GIMBAL RINGS INSIDE POD!
  const coreGroup = new THREE.Group();
  coreGroup.position.set(podX, yB4 + 1.58, podZ);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xa5f3fc,
    emissive: new THREE.Color(0x06b6d4),
    emissiveIntensity: 2.2,
    roughness: 0.12,
    metalness: 0.25,
  });
  const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), coreMat);
  const gimbalA = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 8, 24), labCopperMat);
  const gimbalB = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.010, 8, 24), mat.stainless);
  gimbalB.rotation.x = Math.PI / 2;
  coreGroup.add(coreCrystal, gimbalA, gimbalB);
  deepDynamic.add(coreGroup);

  // INTERACTIVE SWITCH #2: Containment Analyzer Overdrive Control Pedestal right in front of the Pod!
  addDBox(deepStatic, 0.38, 0.96, 0.24, labDarkSteelMat, podX, yB4 + 0.48, 14.92);
  const podSwitchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), labCyanGlowMat);
  podSwitchMesh.position.set(podX, yB4 + 1.00, 14.86);
  podSwitchMesh.rotation.x = -0.35;
  podSwitchMesh.userData.propId = 'lab_containment';
  deepDynamic.add(podSwitchMesh);
  addCollider(-3, 1.44, 14.76, 2.36, 16.14);

  // West Wall of B405: Ultra-Low-Temp Cryo Freezer (-80°C) + Armored Syndicate Combination Vault Safe + Gold/Evidence Cabinet!
  addDBox(deepStatic, 0.72, 1.98, 0.86, labWhiteCaseMat, 0.92, yB4 + 0.99, 14.18); // -80°C Cryo Freezer
  addDBox(deepStatic, 0.03, 0.14, 0.28, labCrimsonGlowMat, 1.29, yB4 + 1.72, 14.18); // Red -80°C readout
  addDBox(deepStatic, 0.74, 1.54, 0.92, labDarkSteelMat, 0.93, yB4 + 0.77, 15.26); // Heavy Armored Syndicate Vault Safe!
  const vaultWheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 16), labCopperMat);
  vaultWheel.rotation.y = Math.PI / 2;
  vaultWheel.position.set(1.33, yB4 + 0.86, 15.26);
  deepStatic.add(vaultWheel);
  // Gold Bullion & Classified Drives visible on top shelf cabinet beside Vault
  addDBox(deepStatic, 0.36, 0.10, 0.22, labGoldBarMat, 0.95, yB4 + 1.60, 15.10);
  addDBox(deepStatic, 0.36, 0.10, 0.22, labGoldBarMat, 0.95, yB4 + 1.60, 15.42);
  addCollider(-3, 0.55, 13.70, 1.35, 16.12);

  // East Wall of B405: Off-Grid 48kWh Solid-State Emergency Power & Battery Bank!
  addDBox(deepStatic, 0.64, 2.12, 1.95, labDarkSteelMat, 2.92, yB4 + 1.06, 14.92);
  for (let pi = 0; pi < 5; pi++) {
    addDBox(deepStatic, 0.03, 0.24, 0.72, labHazardYellowMat, 2.59, yB4 + 0.34 + pi * 0.36, 14.48);
    addDBox(deepStatic, 0.03, 0.24, 0.72, labGunmetalMat, 2.59, yB4 + 0.34 + pi * 0.36, 15.36);
  }
  addDBox(deepStatic, 0.03, 0.16, 0.42, labEmeraldGlowMat, 2.58, yB4 + 1.94, 14.92); // Off-Grid 48kWh Ready LED
  addCollider(-3, 2.56, 13.86, 3.25, 16.05);

  // =========================================================================
  // 4. SPATIAL LIGHTS FOR B2F (-1), B3F (-2) & B4F (-3) — Strictly <= 5 Active/Floor!
  // =========================================================================
  // B2F (5 lights total)
  addDLight('B2F_Studio_Main', -1, 'studio', 0xfff0da, 3.20, 14.5, 5.00, yB2 + 3.25, 7.85);
  addDLight('B2F_Studio_Mirror', -1, 'studio', 0xf7e7d0, 1.95, 11.5, 2.65, yB2 + 2.95, 5.20);
  addDLight('B2F_ELV_Lobby', -1, 'north', 0xe6eff8, 1.45, 6.2, 2.45, yB2 + 2.75, 1.85);
  addDLight('B2F_Control_R1', -1, 'east', 0xf6dfc0, 2.05, 9.5, 12.15, yB2 + 2.75, 5.85);
  addDLight('B2F_Lounge_R2', -1, 'south', 0xffe4be, 2.05, 9.5, 6.85, yB2 + 2.75, 15.00);

  // B3F (5 lights total)
  addDLight('B3F_Corridor_ELV', -2, 'north', 0xffd79e, 1.55, 6.4, 2.65, yB3 + 2.25, 1.75);
  addDLight('B3F_Shelter_Living', -2, 'living', 0xffd296, 2.45, 10.5, 1.60, yB3 + 2.20, 5.80);
  addDLight('B3F_Shelter_Wet', -2, 'wet', 0xfff0dc, 1.65, 6.2, 2.35, yB3 + 2.25, 10.35);
  addDLight('B3F_Shelter_Bed', -2, 'bed', 0xffcc8c, 2.05, 8.8, 1.60, yB3 + 2.25, 14.15);
  addDLight('B3F_Food_Vault', -2, 'food', 0xf5f7f2, 2.25, 9.2, 1.60, yB3 + 2.38, 19.25);

  // B4F Secret Lab (5 lights total — 1 per longitudinal research zone!)
  const b4Lights = [
    addDLight('B4F_Airlock', -3, 'north', 0xdbeafe, 1.95, 7.6, 1.90, yB4 + 2.72, 2.05),
    addDLight('B4F_ChemLab', -3, 'chem', 0xdcf7f5, 2.45, 9.2, 1.90, yB4 + 2.72, 5.10),
    addDLight('B4F_CyberOps', -3, 'cyber', 0xc7dcff, 2.25, 9.2, 1.90, yB4 + 2.72, 8.60),
    addDLight('B4F_FabLab', -3, 'fab', 0xf5efe6, 2.45, 9.2, 1.90, yB4 + 2.72, 11.90),
    addDLight('B4F_Vault', -3, 'vault', 0x7dd3fc, 2.55, 8.8, 1.90, yB4 + 2.68, 14.95),
  ];
  const b4NormalColors = [0xdbeafe, 0xdcf7f5, 0xc7dcff, 0xf5efe6, 0x7dd3fc];
  const b4CovertColors = [0xf43f5e, 0xa855f7, 0x38bdf8, 0xf97316, 0xe11d48];

  const b4Lab = {
    uvCovertMode: false,
    containmentOverdrive: false,
    update(dt, elapsed) {
      const spinMult = this.containmentOverdrive ? 3.4 : 1.0;
      coreCrystal.rotation.y += dt * 1.15 * spinMult;
      coreCrystal.rotation.x = Math.sin(elapsed * 1.4 * spinMult) * 0.35;
      gimbalA.rotation.y -= dt * 0.90 * spinMult;
      gimbalA.rotation.x += dt * 0.65 * spinMult;
      gimbalB.rotation.z += dt * 1.10 * spinMult;
      const pulse = 1.9 + Math.sin(elapsed * (this.containmentOverdrive ? 6.5 : 2.2)) * 0.45;
      coreMat.emissiveIntensity = pulse;
    },
  };

  interactiveProps.push({
    id: 'lab_uv_mode',
    floor: -3,
    building: 'main',
    isOn: false,
    mesh: uvSwitchMesh,
    getLabel: () => (b4Lab.uvCovertMode
      ? '研究所照明を【通常解析モード】へ戻す'
      : '研究所照明を【極秘UV・警戒モード】へ切替'),
    toggle: () => {
      b4Lab.uvCovertMode = !b4Lab.uvCovertMode;
      const palette = b4Lab.uvCovertMode ? b4CovertColors : b4NormalColors;
      b4Lights.forEach((lt, idx) => lt.color.setHex(palette[idx]));
      uvSwitchMesh.material = b4Lab.uvCovertMode ? labCrimsonGlowMat : labCyanGlowMat;
    },
  });

  interactiveProps.push({
    id: 'lab_containment',
    floor: -3,
    building: 'main',
    isOn: false,
    mesh: podSwitchMesh,
    getLabel: () => (b4Lab.containmentOverdrive
      ? '極秘コア解析出力を【通常安定】へ戻す'
      : '極秘研究コア【高出力解析モード】を起動'),
    toggle: () => {
      b4Lab.containmentOverdrive = !b4Lab.containmentOverdrive;
      coreMat.emissive.setHex(b4Lab.containmentOverdrive ? 0xf43f5e : 0x06b6d4);
      coreMat.color.setHex(b4Lab.containmentOverdrive ? 0xfecdd3 : 0xa5f3fc);
      podSwitchMesh.material = b4Lab.containmentOverdrive ? labCrimsonGlowMat : labCyanGlowMat;
    },
  });

  // =========================================================================
  // 4b. B3F ULTRA-PRECISION EXPANSION (B306..B313 + PS-TH)
  // =========================================================================
  const { b3Thermal } = buildB3fExpansion3D({
    deepStatic,
    deepDynamic,
    mat,
    addDBox,
    addDLight,
    addCollider,
    interactiveProps,
    makeCanvasMat,
    sharedMats: {
      concPconMat,
      concCleanMat,
      studioMirrorMat,
      studioTrackGlow,
      warmGlowMat,
      amberStripMat,
      waterJugMat,
      crateMat,
      riceSackMat,
      rationBoxMat,
      greenCanMat,
      redCanMat,
      warmTimberMat,
      hinokiMat,
      darkSpeakerMat,
    },
  });

  // =========================================================================
  // 5. UV-BAKED STATIC BATCHING FOR DEEP BASEMENT B2F + B3F + B4F!
  // =========================================================================
  const { batchedGroup: deepBatched, stats: deepBatchStats } = batchStaticGroups([deepStatic]);
  deepRoot.add(deepBatched);

  return {
    root: deepRoot,
    batchStats: deepBatchStats,
    b3Thermal,
    b4Lab,
  };
}

