import * as THREE from 'three';
import { WALLS, LIGHTING } from './planData.js';
import { makeSurfaceMat, makeFrontMat, createSharedMaterials } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';
import { injectForestWindShader } from './volumetricAtmosphere.js';

// Deterministic PRNG so the surrounding deep forest is artistically balanced every load
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedural damp mossy forest floor canvas texture (no external CDN)
function createForestGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#151c14';
  ctx.fillRect(0, 0, 512, 512);
  const rand = mulberry32(90210);
  // Layered damp earth, dark moss & pine needle patches
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 2 + rand() * 14;
    const pick = rand();
    if (pick < 0.45) ctx.fillStyle = 'rgba(26, 39, 22, 0.35)';
    else if (pick < 0.78) ctx.fillStyle = 'rgba(18, 22, 16, 0.42)';
    else ctx.fillStyle = 'rgba(34, 28, 20, 0.30)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fine fallen pine needles
  ctx.strokeStyle = 'rgba(46, 37, 25, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 1600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const ang = rand() * Math.PI * 2;
    const len = 4 + rand() * 9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  return tex;
}

/**
 * Build the complete 5.0m × 10.0m 1LDK 3D House Interior & Deep Dark Forest Surroundings.
 * Returns handles for interactive doors, interactive props, collision AABBs, tree colliders,
 * interior lights, and animated forest fireflies.
 */
export function buildHouse3D(scene) {
  const M = createSharedMaterials();
  const root = new THREE.Group();
  root.name = 'HouseRoot';
  scene.add(root);

  const interiorGroup = new THREE.Group();
  root.add(interiorGroup);
  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'DynamicDoorsAndProps';
  root.add(dynamicGroup);
  const exteriorGroup = new THREE.Group();
  root.add(exteriorGroup);
  const forestGroup = new THREE.Group();
  root.add(forestGroup);

  const windTimeUniform = { value: 0 };
  const interactiveDoors = [];
  const interactiveProps = [];
  const interiorLights = [];
  const staticColliders = []; // { minX, maxX, minZ, maxZ }
  const treeColliders = [];   // { x, z, r }

  function addBox(parent, w, h, d, x, y, z, mat, cast = true, receive = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  function addCollider(x0, x1, z0, z1) {
    staticColliders.push({
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1),
      maxZ: Math.max(z0, z1),
    });
  }

  // =========================================================================
  // 1. DEEP FOREST TERRAIN, MOSSY BOULDERS, TOWERING CEDAR WOODS & FIREFLIES
  // =========================================================================
  const forestFloorTex = createForestGroundTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    map: forestFloorTex,
    roughness: 0.96,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110, 48, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(2.5, -0.26, 5.0);
  // Subtle organic forest terrain undulations outside the house clearing
  const gPos = ground.geometry.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const vx = gPos.getX(i);
    const vy = gPos.getY(i); // maps to -Z after rotation
    const wx = vx + 2.5;
    const wz = -vy + 5.0;
    const distFromHouse = Math.max(0, Math.hypot(Math.max(0, Math.abs(wx - 2.5) - 4.2), Math.max(0, Math.abs(wz - 5.0) - 7.0)));
    if (distFromHouse > 0.2) {
      const hill = Math.min(2.6, distFromHouse * 0.085) * (0.55 + 0.45 * Math.sin(wx * 0.27) * Math.cos(wz * 0.23));
      const bump = 0.22 * Math.sin(wx * 0.9 + wz * 0.7);
      gPos.setZ(i, hill + bump);
    }
  }
  ground.geometry.computeVertexNormals();
  ground.receiveShadow = true;
  forestGroup.add(ground);

  // Dark night forest sky dome overhead
  const skyGeo = new THREE.SphereGeometry(65, 24, 16);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const sgrad = sctx.createLinearGradient(0, 0, 0, 256);
  sgrad.addColorStop(0.0, '#03060c');
  sgrad.addColorStop(0.38, '#060c14');
  sgrad.addColorStop(0.54, '#0c161e');
  sgrad.addColorStop(1.0, '#070c10');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 16, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  skyDome.position.set(2.5, 0, 5.0);
  forestGroup.add(skyDome);

  // Dense Deep Cedar Forest (230 towering trees via InstancedMesh for silky-smooth 60 FPS!)
  const rand = mulberry32(42817);
  const treeSpecs = [];

  // Hand-placed hero foreground Japanese cedars (strictly clear of house walls by >= 1.6m canopy margin!)
  const heroTrees = [
    // Outside South Terrace Window W2 & W3 (slender tall cedar trunks & evergreen boughs framed cleanly outside!)
    { x: -0.6, z: 13.8, h: 11.5, r: 0.25 },
    { x: 1.05, z: 14.3, h: 12.2, r: 0.27 },
    { x: 2.55, z: 13.7, h: 11.4, r: 0.24 },
    { x: 4.15, z: 14.4, h: 12.8, r: 0.28 },
    { x: 5.85, z: 13.8, h: 11.8, r: 0.26 },
    { x: 1.85, z: 17.0, h: 14.0, r: 0.31 },
    { x: 0.05, z: 17.4, h: 13.2, r: 0.28 },
    { x: 3.45, z: 17.2, h: 13.6, r: 0.29 },
    // Outside East Windows (Kitchen W6, Tatami W7, Bath W5)
    { x: 8.1, z: 9.3, h: 11.8, r: 0.25 },
    { x: 8.8, z: 7.0, h: 12.8, r: 0.28 },
    { x: 8.0, z: 4.6, h: 11.2, r: 0.24 },
    { x: 8.6, z: 2.1, h: 12.2, r: 0.27 },
    // Outside North Bedroom Window W1 & Porch Approach
    { x: 2.55, z: -3.7, h: 11.6, r: 0.25 },
    { x: 4.15, z: -4.2, h: 12.6, r: 0.27 },
    { x: 3.30, z: -6.4, h: 13.4, r: 0.30 },
    { x: -0.55, z: -3.9, h: 11.8, r: 0.26 },
    { x: 1.85, z: -5.6, h: 12.4, r: 0.27 },
    { x: 6.2, z: -3.5, h: 12.8, r: 0.28 },
    // Outside West Wall & Corridor Window W4
    { x: -3.2, z: 4.3, h: 11.6, r: 0.25 },
    { x: -3.7, z: 7.8, h: 12.8, r: 0.28 },
    { x: -3.3, z: 1.1, h: 12.0, r: 0.26 },
  ];
  heroTrees.forEach((t) => treeSpecs.push({ ...t, leanX: (rand() - 0.5) * 0.04, leanZ: (rand() - 0.5) * 0.04 }));

  // Procedural dense deep woods surrounding ALL 4 sides up to 42m radius (strictly outside house + canopy clearance!)
  for (let i = 0; i < 275; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 7.2 + Math.pow(rand(), 0.72) * 33.0;
    const tx = 2.5 + Math.cos(angle) * dist;
    const tz = 5.0 + Math.sin(angle) * dist * 1.12;
    // Strict no-clip perimeter box around 5m×10m house (min 2.8m on X, 3.4m on N/S)
    if (tx > -2.8 && tx < 7.8 && tz > -3.4 && tz < 13.4) continue;
    if (tx > -0.3 && tx < 2.4 && tz > -6.8 && tz <= 0.0) continue; // North forest stepping-stone trail
    if (treeSpecs.some((o) => Math.hypot(o.x - tx, o.z - tz) < 1.85)) continue;
    treeSpecs.push({
      x: tx,
      z: tz,
      h: 9.2 + rand() * 9.5,
      r: 0.16 + rand() * 0.19,
      leanX: (rand() - 0.5) * 0.05,
      leanZ: (rand() - 0.5) * 0.05,
    });
  }

  const trunkMat = makeSurfaceMat('yakisugi_dark', 1.2, 5.0, { roughness: 0.90, color: 0x8a796a });
  const canopyMatDark = new THREE.MeshStandardMaterial({ color: 0x183422, roughness: 0.90, metalness: 0.0 });
  const canopyMatMid = new THREE.MeshStandardMaterial({ color: 0x22462e, roughness: 0.88, metalness: 0.0 });
  injectForestWindShader(canopyMatDark, windTimeUniform);
  injectForestWindShader(canopyMatMid, windTimeUniform);

  const trunkGeo = new THREE.CylinderGeometry(0.55, 1.0, 1.0, 8);
  const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 7);

  const count = treeSpecs.length;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  const tier1Inst = new THREE.InstancedMesh(coneGeo, canopyMatDark, count);
  const tier2Inst = new THREE.InstancedMesh(coneGeo, canopyMatMid, count);
  const tier3Inst = new THREE.InstancedMesh(coneGeo, canopyMatDark, count);
  const tier4Inst = new THREE.InstancedMesh(coneGeo, canopyMatMid, count);
  [tier1Inst, tier2Inst, tier3Inst, tier4Inst].forEach((im) => {
    im.castShadow = true;
    im.receiveShadow = true;
  });

  const dummy = new THREE.Object3D();
  treeSpecs.forEach((t, idx) => {
    // Tall straight Sugi cedar trunk
    dummy.position.set(t.x, t.h * 0.44 - 0.30, t.z);
    dummy.rotation.set(t.leanX, rand() * Math.PI, t.leanZ);
    dummy.scale.set(t.r, t.h * 0.88, t.r);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    // Slender authentic Japanese Sugi cedar spire canopies (max radius ~1.65m — ZERO clipping into house walls!)
    const cw = 0.88 + t.r * 2.5;
    const tiers = [
      [tier1Inst, 2.35 + t.h * 0.10, cw * 1.05, t.h * 0.25],
      [tier2Inst, 3.25 + t.h * 0.24, cw * 0.86, t.h * 0.25],
      [tier3Inst, 4.10 + t.h * 0.38, cw * 0.66, t.h * 0.24],
      [tier4Inst, 4.95 + t.h * 0.52, cw * 0.44, t.h * 0.22],
    ];
    tiers.forEach(([inst, yPos, rad, ch]) => {
      dummy.position.set(t.x, yPos, t.z);
      dummy.rotation.set(t.leanX * 0.5, rand() * Math.PI * 2, t.leanZ * 0.5);
      dummy.scale.set(rad, ch, rad);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });

    if (Math.hypot(t.x - 2.5, t.z - 5.0) < 16) {
      treeColliders.push({ x: t.x, z: t.z, r: t.r + 0.14 });
    }
  });
  forestGroup.add(trunkInst, tier1Inst, tier2Inst, tier3Inst, tier4Inst);

  // Subtle moonlight forest canopy scatter lights outside South & North woods so cedar trunks pop dramatically against midnight mist!
  const southForestMoon = new THREE.PointLight(0x5584b8, 5.2, 22, 1.3);
  southForestMoon.position.set(2.4, 3.8, 15.8);
  forestGroup.add(southForestMoon);
  const northForestMoon = new THREE.PointLight(0x4f7aad, 4.2, 18, 1.3);
  northForestMoon.position.set(2.8, 3.6, -5.2);
  forestGroup.add(northForestMoon);

  // Dense Dark Forest Understory: ferns, low bushes & mossy boulders
  const bushGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1c3822, roughness: 0.92 });
  const bushCount = 175;
  const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
  let bIdx = 0;
  for (let i = 0; i < 240 && bIdx < bushCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 4.8 + rand() * 22.0;
    const bx = 2.5 + Math.cos(angle) * dist;
    const bz = 5.0 + Math.sin(angle) * dist * 1.15;
    if (bx > -1.8 && bx < 6.8 && bz > -2.6 && bz < 12.6) continue;
    if (bx > -0.4 && bx < 2.5 && bz > -6.5 && bz <= 0.0) continue;
    const sc = 0.36 + rand() * 0.65;
    dummy.position.set(bx, -0.08 + sc * 0.24, bz);
    dummy.rotation.set(rand(), rand() * Math.PI, rand());
    dummy.scale.set(sc * 1.35, sc * 0.60, sc * 1.15);
    dummy.updateMatrix();
    bushInst.setMatrixAt(bIdx++, dummy.matrix);
  }
  bushInst.count = bIdx;
  bushInst.receiveShadow = true;
  forestGroup.add(bushInst);

  // Mossy rocks & stepping stones leading into the North forest trail
  const rockMat = makeSurfaceMat('stone_grey_block', 1.0, 1.0, { color: 0x5d665c, roughness: 0.92 });
  [
    [0.95, -1.75], [1.10, -2.55], [0.85, -3.35], [1.05, -4.15],
  ].forEach(([sx, sz]) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 9), rockMat);
    st.position.set(sx, -0.23, sz);
    st.receiveShadow = true;
    forestGroup.add(st);
  });
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2;
    const d = 5.5 + rand() * 14.0;
    const rx = 2.5 + Math.cos(a) * d;
    const rz = 5.0 + Math.sin(a) * d * 1.1;
    if (rx > -0.6 && rx < 5.6 && rz > -1.5 && rz < 11.5) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rand() * 0.38, 0), rockMat);
    rock.scale.set(1.3, 0.62, 1.0);
    rock.position.set(rx, -0.16, rz);
    rock.rotation.set(rand(), rand(), rand());
    rock.receiveShadow = true;
    forestGroup.add(rock);
  }

  // Subtle Drifting Forest Fireflies / Night Motes outside the windows
  const fireflyCount = 75;
  const ffPositions = new Float32Array(fireflyCount * 3);
  const ffSeeds = [];
  for (let i = 0; i < fireflyCount; i++) {
    let fx, fz;
    do {
      fx = 2.5 + (rand() - 0.5) * 28;
      fz = 5.0 + (rand() - 0.5) * 30;
    } while (fx > -0.4 && fx < 5.4 && fz > -0.4 && fz < 10.6);
    const fy = 0.5 + rand() * 3.2;
    ffPositions[i * 3] = fx;
    ffPositions[i * 3 + 1] = fy;
    ffPositions[i * 3 + 2] = fz;
    ffSeeds.push({ x: fx, y: fy, z: fz, ph: rand() * Math.PI * 2, sp: 0.4 + rand() * 0.7 });
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPositions, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xd9f29b,
    size: 0.085,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  forestGroup.add(fireflies);

  // =========================================================================
  // 2. FOUNDATION PLINTH, NORTH APPROACH PORCH & SOUTH ENGAWA DECK
  // =========================================================================
  addBox(exteriorGroup, 5.06, 0.14, 10.06, 2.5, -0.19, 5.0, makeSurfaceMat('concrete_clean', 5.0, 0.3), true, true);

  // North Entry Approach Porch (outside front door, Z = -1.25..0.0, X = 0.05..2.05)
  addBox(exteriorGroup, 2.0, 0.12, 1.25, 1.05, -0.18, -0.625, makeSurfaceMat('paver_red_brick', 2.0, 1.25), false, true);
  addBox(exteriorGroup, 2.08, 0.13, 0.06, 1.05, -0.18, -1.25, makeSurfaceMat('stone_grey_block', 2.1, 0.2), true, true);
  const doormatMat = makeFrontMat('doormat_coir', { roughness: 0.96 });
  addBox(exteriorGroup, 0.78, 0.018, 0.48, 0.95, -0.11, -0.34, [M.walnut, M.walnut, doormatMat, M.walnut, M.walnut, M.walnut], false, true);

  // South Wooden Engawa Deck (Z = 10.0..11.15, X = 0.0..5.0)
  const deckTopMat = makeSurfaceMat('wood_deck', 5.0, 1.15);
  addBox(exteriorGroup, 5.0, 0.14, 1.15, 2.5, -0.09, 10.575, [M.walnut, M.walnut, deckTopMat, M.walnut, M.walnut, M.walnut], true, true);
  addBox(exteriorGroup, 2.8, 0.10, 0.30, 2.0, -0.20, 11.30, makeSurfaceMat('wood_deck', 2.8, 0.3), true, true);

  // Vertical Green Plant Wall (壁面緑化) on South-West terrace wing wall
  addBox(exteriorGroup, 0.12, 2.15, 1.12, 0.06, 1.05, 10.56, makeSurfaceMat('concrete_clean', 1.1, 2.15), true, true);
  addBox(exteriorGroup, 0.04, 1.95, 0.96, 0.13, 1.08, 10.56, makeSurfaceMat('green_wall', 0.96, 1.95), true, true);

  // Dark Wooden Lattice Privacy Screen on South-East Engawa wing
  addBox(exteriorGroup, 0.06, 2.10, 1.12, 4.97, 1.02, 10.56, makeSurfaceMat('wood_lattice_dark', 1.12, 2.10), true, true);

  // Outdoor AC Compressor Unit (室外機) on North-East exterior wall
  const acExtGroup = new THREE.Group();
  acExtGroup.position.set(4.50, 0.10, -0.22);
  addBox(acExtGroup, 0.72, 0.56, 0.28, 0, 0, 0, M.whiteMatte, true, true);
  addBox(acExtGroup, 0.60, 0.44, 0.02, 0, 0, -0.145, makeFrontMat('exterior_louver', { roughness: 0.55 }), false, true);
  addBox(acExtGroup, 0.08, 0.08, 0.32, -0.26, -0.32, 0, M.darkIron);
  addBox(acExtGroup, 0.08, 0.08, 0.32, 0.26, -0.32, 0, M.darkIron);
  exteriorGroup.add(acExtGroup);

  // =========================================================================
  // 3. INTERIOR FLOORS (EXACT ROOM-BY-ROOM USER MATERIAL FINISHES)
  // =========================================================================
  function addFloorSlab(x0, z0, x1, z1, topY, thick, texName, extra = {}) {
    const w = x1 - x0;
    const d = z1 - z0;
    const topMat = makeSurfaceMat(texName, w, d, extra);
    const mats = [M.oak, M.oak, topMat, M.whiteMatte, M.oak, M.oak];
    return addBox(interiorGroup, w, thick, d, (x0 + x1) / 2, topY - thick / 2, (z0 + z1) / 2, mats, false, true);
  }

  addFloorSlab(0.15, 0.15, 1.55, 1.45, -0.12, 0.04, 'terrazzo_white');
  addBox(interiorGroup, 1.40, 0.125, 0.09, 0.85, -0.06, 1.46, M.oak, true, true);

  addFloorSlab(0.15, 1.45, 1.55, 3.55, 0.0, 0.12, 'wood_floor');
  addFloorSlab(0.15, 3.55, 1.15, 5.30, 0.0, 0.12, 'wood_floor');
  addFloorSlab(1.60, 0.15, 4.85, 3.50, 0.0, 0.12, 'wood_floor');
  addFloorSlab(1.15, 3.50, 2.05, 4.90, 0.0, 0.12, 'tile_beige_grid');
  addFloorSlab(1.15, 4.90, 2.05, 5.35, 0.0, 0.12, 'wood_floor');
  addFloorSlab(2.05, 3.50, 3.50, 5.30, 0.0, 0.12, 'terrazzo_white');
  addFloorSlab(3.50, 3.50, 4.85, 5.30, -0.02, 0.10, 'tile_grey_stone');
  addBox(interiorGroup, 0.06, 0.03, 0.72, 3.52, -0.005, 4.80, M.whiteMatte, false, true);
  addBox(interiorGroup, 0.16, 0.004, 0.16, 4.20, -0.018, 4.82, M.stainless, false, true);

  addFloorSlab(0.15, 5.30, 3.60, 9.85, 0.0, 0.12, 'wood_floor');
  addFloorSlab(3.60, 8.38, 4.85, 9.85, 0.0, 0.12, 'wood_floor');
  addFloorSlab(3.60, 5.30, 4.85, 8.38, 0.001, 0.12, 'tile_beige_grid');
  addBox(interiorGroup, 0.015, 0.004, 3.08, 3.60, 0.002, 6.84, M.bronze, false, true);
  addBox(interiorGroup, 1.25, 0.004, 0.015, 4.225, 0.002, 8.38, M.bronze, false, true);

  // Soft Area Rugs
  const rugLivingMat = makeSurfaceMat('carpet_beige', 1.85, 2.05);
  addBox(interiorGroup, 1.85, 0.012, 2.05, 1.88, 0.006, 8.48, [M.creamTrim, M.creamTrim, rugLivingMat, M.creamTrim, M.creamTrim, M.creamTrim], false, true);
  const rugBedMat = makeSurfaceMat('carpet_beige', 1.95, 2.10);
  addBox(interiorGroup, 1.95, 0.012, 2.10, 3.65, 0.006, 1.45, [M.creamTrim, M.creamTrim, rugBedMat, M.creamTrim, M.creamTrim, M.creamTrim], false, true);

  // =========================================================================
  // 4. WALLS WITH CUTOUT OPENINGS, INTERACTIVE DOORS, WINDOWS & COLLIDERS
  // =========================================================================
  function makeWallBlockMats(wall, spanLen, spanH) {
    const extM = wall.exterior ? makeSurfaceMat(wall.extTex, spanLen, spanH) : makeSurfaceMat(wall.intTex, spanLen, spanH);
    const intM = makeSurfaceMat(wall.intTex, spanLen, spanH);
    if (wall.axis === 'x') {
      const isNorth = wall.pos < 1.0;
      const isSouth = wall.pos > 9.0;
      return [M.whiteMatte, M.whiteMatte, M.wallCutCap, M.whiteMatte, isSouth ? extM : intM, isNorth ? extM : intM];
    }
    const isWest = wall.pos < 1.0;
    const isEast = wall.pos > 4.0;
    return [isEast ? extM : intM, isWest ? extM : intM, M.wallCutCap, M.whiteMatte, M.whiteMatte, M.whiteMatte];
  }

  function addWallSegment(wall, s0, s1, y0, y1, solidCollision = false) {
    const len = s1 - s0;
    const h = y1 - y0;
    if (len <= 0.005 || h <= 0.005) return;
    const midS = (s0 + s1) / 2;
    const midY = (y0 + y1) / 2;
    const mats = makeWallBlockMats(wall, len, h);
    if (wall.axis === 'x') {
      addBox(interiorGroup, len, h, wall.thick, midS, midY, wall.pos, mats, true, true);
      if (solidCollision) addCollider(s0, s1, wall.pos - wall.thick / 2, wall.pos + wall.thick / 2);
    } else {
      addBox(interiorGroup, wall.thick, h, len, wall.pos, midY, midS, mats, true, true);
      if (solidCollision) addCollider(wall.pos - wall.thick / 2, wall.pos + wall.thick / 2, s0, s1);
    }
  }

  function buildOpeningFixture(wall, op) {
    const len = op.end - op.start;
    const h = op.top - op.sill;
    const midS = (op.start + op.end) / 2;
    const midY = (op.sill + op.top) / 2;
    const frameThick = 0.036;
    const frameDepth = wall.thick + 0.016;

    if (op.type === 'door') {
      const fMat = op.id === 'D1' ? M.darkIron : (op.id === 'D3' || op.id === 'D6' ? M.whiteMatte : M.oak);
      if (wall.axis === 'x') {
        addBox(interiorGroup, len, frameThick, frameDepth, midS, op.top - frameThick / 2, wall.pos, fMat);
        addBox(interiorGroup, frameThick, h, frameDepth, op.start + frameThick / 2, midY, wall.pos, fMat);
        addBox(interiorGroup, frameThick, h, frameDepth, op.end - frameThick / 2, midY, wall.pos, fMat);
      } else {
        addBox(interiorGroup, frameDepth, frameThick, len, wall.pos, op.top - frameThick / 2, midS, fMat);
        addBox(interiorGroup, frameDepth, h, frameThick, wall.pos, midY, op.start + frameThick / 2, fMat);
        addBox(interiorGroup, frameDepth, h, frameThick, wall.pos, midY, op.end - frameThick / 2, fMat);
      }

      const leafW = len - frameThick * 2;
      const leafH = h - frameThick - 0.01;
      const leafT = 0.042;
      const doorFaceMat = makeFrontMat(op.tex, { roughness: op.id === 'D1' ? 0.38 : 0.48, metalness: op.id === 'D1' ? 0.25 : 0.04 });
      const pivot = new THREE.Group();
      let leafMesh;

      const collider = wall.axis === 'x'
        ? { minX: op.start, maxX: op.end, minZ: wall.pos - 0.06, maxZ: wall.pos + 0.06 }
        : { minX: wall.pos - 0.06, maxX: wall.pos + 0.06, minZ: op.start, maxZ: op.end };

      if (op.subtype === 'pocket') {
        if (wall.axis === 'x') {
          pivot.position.set(midS, op.sill + leafH / 2 + 0.005, wall.pos);
          leafMesh = addBox(pivot, leafW, leafH, leafT, 0, 0, 0, [fMat, fMat, fMat, fMat, doorFaceMat, doorFaceMat], true, true);
        } else {
          pivot.position.set(wall.pos, op.sill + leafH / 2 + 0.005, midS);
          leafMesh = addBox(pivot, leafT, leafH, leafW, 0, 0, 0, [doorFaceMat, doorFaceMat, fMat, fMat, fMat, fMat], true, true);
        }
        dynamicGroup.add(pivot);
        interactiveDoors.push({
          id: op.id,
          label: op.label,
          kind: 'pocket',
          axis: wall.axis,
          pivot,
          mesh: leafMesh,
          collider,
          closedPos: pivot.position.clone(),
          slideDelta: (op.slideDir || 1) * (leafW * 0.88),
          isOpen: false,
          progress: 0,
        });
      } else {
        const hingeAtStart = op.hinge === 'start';
        const hingeS = hingeAtStart ? op.start + frameThick : op.end - frameThick;
        const offsetSign = hingeAtStart ? 1 : -1;
        if (wall.axis === 'x') {
          pivot.position.set(hingeS, op.sill + leafH / 2 + 0.005, wall.pos);
          leafMesh = addBox(pivot, leafW, leafH, leafT, (offsetSign * leafW) / 2, 0, 0, [fMat, fMat, fMat, fMat, doorFaceMat, doorFaceMat], true, true);
          addBox(pivot, 0.11, 0.022, 0.12, offsetSign * (leafW - 0.11), -0.05, 0, M.chrome, false, false);
        } else {
          pivot.position.set(wall.pos, op.sill + leafH / 2 + 0.005, hingeS);
          leafMesh = addBox(pivot, leafT, leafH, leafW, 0, 0, (offsetSign * leafW) / 2, [doorFaceMat, doorFaceMat, fMat, fMat, fMat, fMat], true, true);
          addBox(pivot, 0.12, 0.022, 0.11, 0, -0.05, offsetSign * (leafW - 0.11), M.chrome, false, false);
        }
        dynamicGroup.add(pivot);
        const openAngle = (op.swingDir || 1) * (hingeAtStart ? -1 : 1) * (Math.PI * 0.46) * (wall.axis === 'x' ? 1 : -1);
        interactiveDoors.push({
          id: op.id,
          label: op.label,
          kind: 'swing',
          pivot,
          mesh: leafMesh,
          collider,
          openAngle,
          isOpen: false,
          progress: 0,
        });
      }
      leafMesh.userData.doorId = op.id;
    } else if (op.type === 'window') {
      // Solid collider across window opening so protagonist can't walk out through glass
      if (wall.axis === 'x') addCollider(op.start, op.end, wall.pos - wall.thick / 2, wall.pos + wall.thick / 2);
      else addCollider(wall.pos - wall.thick / 2, wall.pos + wall.thick / 2, op.start, op.end);

      const sashMat = M.aluminum;
      const ft = 0.04;
      const fd = wall.thick + 0.012;
      if (wall.axis === 'x') {
        addBox(interiorGroup, len, ft, fd, midS, op.top - ft / 2, wall.pos, sashMat);
        addBox(interiorGroup, len, ft, fd, midS, op.sill + ft / 2, wall.pos, sashMat);
        addBox(interiorGroup, ft, h, fd, op.start + ft / 2, midY, wall.pos, sashMat);
        addBox(interiorGroup, ft, h, fd, op.end - ft / 2, midY, wall.pos, sashMat);
        const sillOffsetZ = wall.pos < 1.0 ? 0.05 : -0.05;
        addBox(interiorGroup, len + 0.06, 0.028, wall.thick + 0.08, midS, op.sill + 0.01, wall.pos + sillOffsetZ * 0.4, M.oakLight);
        if (len > 1.2) addBox(interiorGroup, 0.032, h - ft * 2, 0.045, midS, midY, wall.pos, sashMat);
        const paneMat = op.subtype === 'frosted'
          ? makeFrontMat('window_frosted', { transparent: true, opacity: 0.78 })
          : M.glassClear;
        addBox(interiorGroup, len - ft * 2, h - ft * 2, 0.014, midS, midY, wall.pos, paneMat, false, false);
      } else {
        addBox(interiorGroup, fd, ft, len, wall.pos, op.top - ft / 2, midS, sashMat);
        addBox(interiorGroup, fd, ft, len, wall.pos, op.sill + ft / 2, midS, sashMat);
        addBox(interiorGroup, fd, h, ft, wall.pos, midY, op.start + ft / 2, sashMat);
        addBox(interiorGroup, fd, h, ft, wall.pos, midY, op.end - ft / 2, sashMat);
        const sillOffsetX = wall.pos < 1.0 ? 0.04 : -0.04;
        addBox(interiorGroup, wall.thick + 0.07, 0.028, len + 0.06, wall.pos + sillOffsetX * 0.4, op.sill + 0.01, midS, M.oakLight);
        const paneMat = op.subtype === 'frosted'
          ? makeFrontMat('window_frosted', { roughness: 0.35 })
          : M.glassClear;
        addBox(interiorGroup, 0.016, h - ft * 2, len - ft * 2, wall.pos, midY, midS, paneMat, false, false);
      }
    }
  }

  for (const wall of WALLS) {
    const ops = [...(wall.openings || [])].sort((a, b) => a.start - b.start);
    const bottomY = wall.id === 'EXT-N' ? -0.12 : 0.0;
    let cursor = wall.start;
    for (const op of ops) {
      if (op.start > cursor) addWallSegment(wall, cursor, op.start, bottomY, wall.height, true);
      if (op.sill > bottomY) addWallSegment(wall, op.start, op.end, bottomY, op.sill, false);
      if (op.top < wall.height) addWallSegment(wall, op.start, op.end, op.top, wall.height, false);
      buildOpeningFixture(wall, op);
      cursor = op.end;
    }
    if (cursor < wall.end) addWallSegment(wall, cursor, wall.end, bottomY, wall.height, true);
  }

  // =========================================================================
  // 5. ROOM FEATURE WALLS, CLADDINGS & CURTAINS
  // =========================================================================
  const coveMat = new THREE.MeshStandardMaterial({ color: 0xffd79b, emissive: new THREE.Color(0xff9c3b), emissiveIntensity: 1.65 });

  // LDK West Wood Slat TV Wall + Vertical Indirect LEDs
  addBox(interiorGroup, 0.022, 2.48, 2.38, 0.162, 1.24, 8.46, makeSurfaceMat('wood_slats', 2.38, 2.48), true, true);
  addBox(interiorGroup, 0.012, 2.36, 0.018, 0.16, 1.24, 7.26, coveMat, false, false);
  addBox(interiorGroup, 0.012, 2.36, 0.018, 0.16, 1.24, 9.66, coveMat, false, false);

  // Kitchen Glossy Caramel Glazed Subway Tile Backsplash
  addBox(interiorGroup, 0.014, 0.40, 2.24, 4.842, 1.05, 7.18, makeSurfaceMat('tile_caramel_brick', 2.24, 0.40), false, true);
  addBox(interiorGroup, 0.014, 0.72, 0.44, 4.842, 1.61, 6.28, makeSurfaceMat('tile_caramel_brick', 0.44, 0.72), false, true);
  addBox(interiorGroup, 0.014, 0.72, 0.90, 4.842, 1.61, 7.85, makeSurfaceMat('tile_caramel_brick', 0.90, 0.72), false, true);

  // Tatami Nook Beige Plaster
  addBox(interiorGroup, 0.012, 0.65, 1.35, 4.842, 0.325, 9.18, makeSurfaceMat('plaster_beige', 1.35, 0.65), false, true);
  addBox(interiorGroup, 1.30, 0.65, 0.012, 4.20, 0.325, 9.842, makeSurfaceMat('plaster_beige', 1.30, 0.65), false, true);

  // Gallery Corridor Wood Wainscoting + 3 Framed Pastel Posters
  addBox(interiorGroup, 0.018, 1.05, 1.72, 0.160, 0.525, 4.41, makeSurfaceMat('wainscot_wood', 1.72, 1.05), false, true);
  [3.92, 4.38, 4.84].forEach((pz, i) => {
    addBox(interiorGroup, 0.016, 0.44, 0.32, 0.162, 1.40, pz, M.oakLight, true, true);
    addBox(interiorGroup, 0.006, 0.39, 0.27, 0.171, 1.40, pz, makeFrontMat(`art_poster_${i + 1}`, { roughness: 0.65 }), false, true);
  });

  // Master Bedroom East Beige Plaster Accent Wall + Oak Ledge + Cove LED
  addBox(interiorGroup, 0.014, 2.48, 3.30, 4.842, 1.24, 1.80, makeSurfaceMat('plaster_beige', 3.30, 2.48), false, true);
  addBox(interiorGroup, 0.10, 0.032, 1.65, 4.79, 1.32, 1.45, M.oak, true, true);
  addBox(interiorGroup, 0.015, 0.012, 1.55, 4.82, 1.298, 1.45, coveMat, false, false);

  // Unit Bath Tiles (Sky Blue Tub Wall + Crisp White Small Tiles)
  addBox(interiorGroup, 1.30, 2.25, 0.014, 4.20, 1.12, 3.558, makeSurfaceMat('tile_blue_bath', 1.30, 2.25), false, true);
  addBox(interiorGroup, 1.30, 2.25, 0.014, 4.20, 1.12, 5.242, makeSurfaceMat('tile_white_small', 1.30, 2.25), false, true);
  addBox(interiorGroup, 0.014, 2.25, 0.90, 3.558, 1.12, 4.00, makeSurfaceMat('tile_white_small', 0.90, 2.25), false, true);
  addBox(interiorGroup, 0.014, 1.50, 1.70, 4.842, 0.75, 4.40, makeSurfaceMat('tile_white_small', 1.70, 1.50), false, true);
  addBox(interiorGroup, 0.014, 0.75, 0.45, 4.842, 1.875, 3.775, makeSurfaceMat('tile_white_small', 0.45, 0.75), false, true);
  addBox(interiorGroup, 0.014, 0.75, 0.65, 4.842, 1.875, 4.925, makeSurfaceMat('tile_white_small', 0.65, 0.75), false, true);

  // Washroom & WC Tile Accents
  addBox(interiorGroup, 1.35, 1.10, 0.012, 2.775, 0.55, 3.558, makeSurfaceMat('tile_white_large', 1.35, 1.10), false, true);
  addBox(interiorGroup, 0.72, 0.48, 0.015, 2.47, 1.04, 3.56, makeSurfaceMat('marble_white', 0.72, 0.48), false, true);
  addBox(interiorGroup, 0.012, 1.10, 1.70, 2.108, 0.55, 4.40, makeSurfaceMat('tile_white_large', 1.70, 1.10), false, true);
  addBox(interiorGroup, 0.014, 1.15, 0.68, 1.992, 1.15, 4.50, makeSurfaceMat('tile_mosaic_mint', 0.68, 1.15), false, true);
  addBox(interiorGroup, 0.80, 2.34, 0.012, 1.60, 1.17, 4.958, makeSurfaceMat('panel_white_vert', 0.80, 2.34), false, true);

  // Baseboards
  addBox(interiorGroup, 3.20, 0.06, 0.014, 3.25, 0.03, 3.44, M.oakLight);
  addBox(interiorGroup, 3.20, 0.06, 0.014, 3.25, 0.03, 0.158, M.oakLight);
  addBox(interiorGroup, 0.60, 0.06, 0.014, 0.45, 0.03, 9.842, M.oakLight);

  // Botanical Curtains & Bamboo Sudare
  function addCurtainPair(wallPos, startX, endX, topY, bottomY, insetZ) {
    const h = topY - bottomY;
    const midY = (topY + bottomY) / 2;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, endX - startX + 0.24, 10), M.darkIron);
    rod.rotation.z = Math.PI / 2;
    rod.position.set((startX + endX) / 2, topY + 0.04, wallPos + insetZ);
    interiorGroup.add(rod);
    const cW = Math.min(0.42, (endX - startX) * 0.24);
    const cMat = makeSurfaceMat('curtain_botanical', cW, h, { side: THREE.DoubleSide });
    [startX + cW * 0.38, endX - cW * 0.38].forEach((cx) => {
      for (let f = -1; f <= 1; f++) {
        const fold = new THREE.Mesh(new THREE.BoxGeometry(cW / 3, h, 0.035), cMat);
        fold.position.set(cx + f * (cW / 3.1), midY, wallPos + insetZ + (f === 0 ? 0.012 : -0.008));
        fold.castShadow = true;
        interiorGroup.add(fold);
      }
    });
  }
  addCurtainPair(9.85, 0.72, 3.28, 2.22, 0.04, -0.08);
  addCurtainPair(0.15, 2.52, 4.18, 2.18, 0.72, 0.08);
  addBox(interiorGroup, 0.92, 0.42, 0.025, 4.175, 1.88, 9.81, makeSurfaceMat('bamboo_sudare', 0.92, 0.42), true, true);

  // =========================================================================
  // 6. FURNITURE, APPLIANCES & COLLIDERS (ALL ROOMS)
  // =========================================================================

  // --- GENKAN & ENTRY HALL ---
  addBox(interiorGroup, 0.24, 0.34, 0.025, 0.30, 1.32, -0.015, makeFrontMat('fixture_intercom', { roughness: 0.35 }), true, true);
  addBox(interiorGroup, 0.10, 0.20, 0.09, 1.54, 1.92, -0.05, M.darkIron);
  addBox(interiorGroup, 0.08, 0.12, 0.07, 1.54, 1.92, -0.06, M.warmBulb, false, false);

  const shoeMat = makeFrontMat('furniture_wardrobe', { roughness: 0.48 });
  addBox(interiorGroup, 0.35, 0.88, 1.18, 0.325, 0.46, 0.81, [shoeMat, M.oak, M.oakLight, M.oak, M.oak, M.oak], true, true);
  addCollider(0.15, 0.50, 0.22, 1.40);
  addBox(interiorGroup, 0.06, 0.015, 1.10, 0.42, 0.015, 0.81, coveMat, false, false);
  addBox(interiorGroup, 0.16, 0.016, 0.24, 0.34, 0.91, 0.55, M.walnut);
  const entryPot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.10, 14), M.ceramic);
  entryPot.position.set(0.34, 0.95, 1.12);
  interiorGroup.add(entryPot);
  const entryPlant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 1), M.foliageLight);
  entryPlant.position.set(0.34, 1.06, 1.12);
  interiorGroup.add(entryPlant);
  addBox(interiorGroup, 0.025, 1.05, 0.52, 0.165, 1.58, 0.82, M.oak);
  addBox(interiorGroup, 0.012, 0.99, 0.46, 0.175, 1.58, 0.82, M.mirror);

  const closetDoorMat = makeFrontMat('furniture_wardrobe', { roughness: 0.50 });
  addBox(interiorGroup, 0.45, 2.25, 1.10, 0.375, 1.125, 2.17, [closetDoorMat, M.oak, M.oak, M.oak, M.oak, M.oak], true, true);
  addCollider(0.15, 0.60, 1.62, 2.72);
  addBox(interiorGroup, 0.03, 0.34, 0.28, 0.168, 1.88, 3.05, makeFrontMat('fixture_meter', { roughness: 0.45 }), true, true);
  addBox(interiorGroup, 0.022, 0.42, 0.56, 0.164, 1.32, 3.12, makeFrontMat('fixture_pinboard', { roughness: 0.82 }), true, true);

  // --- MASTER BEDROOM ---
  const bedGroup = new THREE.Group();
  addBox(bedGroup, 2.02, 0.16, 1.44, 3.81, 0.22, 1.445, M.oak, true, true);
  [[2.86, 0.78], [2.86, 2.10], [4.74, 0.78], [4.74, 2.10]].forEach(([lx, lz]) => {
    addBox(bedGroup, 0.06, 0.14, 0.06, lx, 0.07, lz, M.oak, true, true);
  });
  addBox(bedGroup, 0.09, 0.82, 1.48, 4.78, 0.66, 1.445, makeSurfaceMat('fabric_grey_sofa', 1.48, 0.78), true, true);
  addBox(bedGroup, 1.96, 0.22, 1.38, 3.77, 0.40, 1.445, M.whiteMatte, true, true);
  const duvetMat = makeSurfaceMat('fabric_floral_quilt', 1.42, 1.42);
  addBox(bedGroup, 1.38, 0.07, 1.44, 3.45, 0.525, 1.445, duvetMat, true, true);
  addBox(bedGroup, 1.36, 0.22, 0.03, 3.45, 0.42, 0.725, duvetMat, true, true);
  addBox(bedGroup, 1.36, 0.22, 0.03, 3.45, 0.42, 2.165, duvetMat, true, true);
  addBox(bedGroup, 0.20, 0.055, 1.40, 4.18, 0.535, 1.445, M.whiteMatte, true, true);
  [1.12, 1.77].forEach((pz) => {
    const pil = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), M.whiteMatte);
    pil.scale.set(0.68, 0.28, 1.12);
    pil.position.set(4.52, 0.56, pz);
    pil.castShadow = true;
    bedGroup.add(pil);
  });
  const sakuraPillow = addBox(bedGroup, 0.13, 0.28, 0.34, 4.30, 0.63, 1.445, makeSurfaceMat('fabric_sakura', 0.36, 0.36), true, true);
  sakuraPillow.rotation.z = -0.25;
  interiorGroup.add(bedGroup);
  addCollider(2.82, 4.84, 0.72, 2.17);

  [0.45, 2.43].forEach((nz) => {
    addBox(interiorGroup, 0.40, 0.48, 0.38, 4.59, 0.24, nz, M.oak, true, true);
    addBox(interiorGroup, 0.02, 0.18, 0.34, 4.38, 0.34, nz, M.oakLight);
    addBox(interiorGroup, 0.02, 0.02, 0.10, 4.36, 0.36, nz, M.bronze);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 14), M.ceramic);
    base.position.set(4.60, 0.55, nz);
    interiorGroup.add(base);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 0.17, 16), M.washiGlow);
    shade.position.set(4.60, 0.69, nz);
    interiorGroup.add(shade);
  });

  const wardFront = makeFrontMat('furniture_wardrobe', { roughness: 0.48 });
  addBox(interiorGroup, 2.05, 2.28, 0.65, 3.775, 1.14, 3.125, [M.oak, M.oak, M.oak, M.oak, M.oak, wardFront], true, true);
  addCollider(2.75, 4.84, 2.80, 3.45);

  const chestFront = makeFrontMat('furniture_chest', { roughness: 0.48 });
  addBox(interiorGroup, 0.45, 0.85, 0.90, 1.895, 0.425, 0.93, [chestFront, M.oak, M.oakLight, M.oak, M.oak, M.oak], true, true);
  addCollider(1.65, 2.12, 0.48, 1.38);
  addBox(interiorGroup, 0.022, 0.44, 0.82, 1.665, 1.48, 0.93, M.oakLight, true, true);
  addBox(interiorGroup, 0.008, 0.39, 0.77, 1.678, 1.48, 0.93, makeFrontMat('art_posters_trio', { roughness: 0.65 }), false, true);
  const bedVase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.22, 14), M.terracotta);
  bedVase.position.set(1.90, 0.96, 0.68);
  interiorGroup.add(bedVase);
  addBox(interiorGroup, 0.30, 0.04, 0.36, 1.90, 0.87, 1.12, [M.whiteMatte, M.whiteMatte, makeFrontMat('folded_clothes'), M.whiteMatte, M.whiteMatte, M.whiteMatte], true, true);

  const acMat = makeFrontMat('appliance_ac', { roughness: 0.25 });
  addBox(interiorGroup, 0.76, 0.27, 0.22, 2.08, 2.22, 0.26, [M.whiteMatte, M.whiteMatte, M.whiteMatte, M.whiteMatte, acMat, M.whiteMatte], true, true);

  // --- INDEPENDENT WC ---
  const wcGroup = new THREE.Group();
  addBox(wcGroup, 0.36, 0.38, 0.46, 1.60, 0.19, 3.84, M.ceramic, true, true);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.16, 0.38, 18), M.ceramic);
  bowl.position.set(1.60, 0.19, 4.02);
  wcGroup.add(bowl);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 18), M.ceramic);
  lid.position.set(1.60, 0.41, 3.98);
  wcGroup.add(lid);
  addBox(wcGroup, 0.38, 0.12, 0.24, 1.60, 0.44, 3.72, M.ceramic, true, true);
  addBox(wcGroup, 0.02, 0.12, 0.18, 1.98, 0.92, 4.02, M.whiteMatte);
  const tpRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 14), M.whiteMatte);
  tpRoll.rotation.z = Math.PI / 2;
  tpRoll.position.set(1.93, 0.72, 4.05);
  wcGroup.add(tpRoll);
  addBox(wcGroup, 0.22, 0.04, 0.46, 1.88, 0.80, 4.52, M.oak, true, true);
  addBox(wcGroup, 0.18, 0.10, 0.34, 1.88, 0.86, 4.52, M.ceramic, true, true);
  addBox(wcGroup, 0.03, 0.14, 0.03, 1.94, 0.96, 4.52, M.chrome);
  addBox(wcGroup, 0.02, 0.48, 0.36, 1.98, 1.38, 4.52, M.mirror);
  addBox(wcGroup, 0.76, 0.03, 0.24, 1.60, 1.55, 3.68, M.oak);
  [1.38, 1.52, 1.66].forEach((tx) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.11, 12), M.whiteMatte);
    r.position.set(tx, 1.62, 3.68);
    wcGroup.add(r);
  });
  interiorGroup.add(wcGroup);
  addCollider(1.36, 1.84, 3.55, 4.18);

  // --- RECESSED PANTRY ---
  const pantryCabFront = makeFrontMat('furniture_kitchen_cab', { roughness: 0.35 });
  addBox(interiorGroup, 0.76, 0.84, 0.36, 1.60, 0.42, 5.14, [M.whiteMatte, M.whiteMatte, makeSurfaceMat('marble_white', 0.76, 0.36), M.whiteMatte, pantryCabFront, M.whiteMatte], true, true);
  addCollider(1.20, 2.00, 4.95, 5.34);
  addBox(interiorGroup, 0.18, 0.28, 0.22, 1.42, 0.98, 5.14, M.darkIron, true, true);
  addBox(interiorGroup, 0.12, 0.14, 0.12, 1.72, 0.91, 5.14, M.terracotta, true, true);
  [1.42, 1.78, 2.10].forEach((sy) => addBox(interiorGroup, 0.76, 0.028, 0.30, 1.60, sy, 5.11, M.oak, true, true));
  addBox(interiorGroup, 0.24, 0.18, 0.22, 1.40, 1.52, 5.12, M.creamTrim);
  addBox(interiorGroup, 0.24, 0.18, 0.22, 1.76, 1.52, 5.12, M.creamTrim);
  addBox(interiorGroup, 0.008, 0.24, 0.30, 1.21, 1.18, 5.14, makeFrontMat('sign_recycle', { roughness: 0.5 }), false, true);

  // --- WASHROOM & LAUNDRY ---
  const vanBaseFront = makeFrontMat('furniture_vanity_base', { roughness: 0.42 });
  addBox(interiorGroup, 0.70, 0.76, 0.50, 2.47, 0.38, 3.82, [M.oak, M.oak, M.ceramic, M.oak, vanBaseFront, M.oak], true, true);
  addBox(interiorGroup, 0.72, 0.05, 0.52, 2.47, 0.785, 3.82, M.ceramic, true, true);
  addBox(interiorGroup, 0.035, 0.16, 0.035, 2.47, 0.88, 3.64, M.chrome);
  addBox(interiorGroup, 0.035, 0.03, 0.11, 2.47, 0.94, 3.69, M.chrome);
  addBox(interiorGroup, 0.66, 0.54, 0.035, 2.47, 1.52, 3.585, [M.oak, M.oak, M.oak, M.oak, makeFrontMat('furniture_vanity_mirror', { roughness: 0.1, metalness: 0.65 }), M.oak], true, true);

  addBox(interiorGroup, 0.62, 0.05, 0.62, 3.14, 0.025, 3.88, M.whiteMatte, false, true);
  const washerFront = makeFrontMat('appliance_washer', { roughness: 0.22, metalness: 0.15 });
  addBox(interiorGroup, 0.59, 0.90, 0.58, 3.14, 0.50, 3.87, [M.whiteMatte, M.whiteMatte, M.whiteMatte, M.whiteMatte, washerFront, M.whiteMatte], true, true);
  addCollider(2.10, 3.45, 3.55, 4.19);
  [1.42, 1.78].forEach((sy) => addBox(interiorGroup, 0.60, 0.028, 0.32, 3.14, sy, 3.72, M.oak, true, true));
  addBox(interiorGroup, 0.42, 0.08, 0.26, 3.14, 1.48, 3.72, [M.whiteMatte, M.whiteMatte, makeFrontMat('folded_clothes'), M.whiteMatte, M.whiteMatte, M.whiteMatte], true, true);
  addBox(interiorGroup, 0.06, 0.02, 0.50, 2.14, 1.18, 4.65, M.chrome);
  addBox(interiorGroup, 0.03, 0.42, 0.36, 2.16, 0.98, 4.65, M.creamTrim, true, true);

  // --- UNIT BATH 1317 ---
  const tubGroup = new THREE.Group();
  addBox(tubGroup, 1.26, 0.54, 0.08, 4.20, 0.25, 3.61, M.ceramic, true, true);
  addBox(tubGroup, 1.26, 0.54, 0.09, 4.20, 0.25, 4.29, M.ceramic, true, true);
  addBox(tubGroup, 0.08, 0.54, 0.76, 3.61, 0.25, 3.95, M.ceramic, true, true);
  addBox(tubGroup, 0.08, 0.54, 0.76, 4.79, 0.25, 3.95, M.ceramic, true, true);
  addBox(tubGroup, 1.14, 0.06, 0.62, 4.20, 0.02, 3.95, M.ceramic, false, true);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 0.60), M.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(4.20, 0.42, 3.95);
  tubGroup.add(water);
  addBox(tubGroup, 0.24, 0.03, 0.70, 3.74, 0.535, 3.95, M.oakLight, true, true);
  addBox(tubGroup, 0.26, 0.06, 0.14, 4.20, 0.78, 5.17, M.chrome, true, true);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 10), M.chrome);
  rail.position.set(4.42, 1.48, 5.18);
  tubGroup.add(rail);
  const sHead = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.022, 0.09, 14), M.chrome);
  sHead.rotation.x = -0.6;
  sHead.position.set(4.42, 1.92, 5.10);
  tubGroup.add(sHead);
  addBox(tubGroup, 0.44, 0.76, 0.02, 4.02, 1.42, 5.225, M.mirror);
  addBox(tubGroup, 0.56, 0.03, 0.14, 4.10, 0.96, 5.16, M.whiteMatte);
  [3.92, 4.02, 4.12].forEach((bx, idx) => {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.16, 12), new THREE.MeshStandardMaterial({ color: [0x3d7c8a, 0xd8c9a8, 0xeef3f5][idx], roughness: 0.3 }));
    bot.position.set(bx, 1.06, 5.16);
    tubGroup.add(bot);
  });
  addBox(tubGroup, 0.30, 0.24, 0.24, 4.52, 0.10, 4.74, M.oakLight, true, true);
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.11, 16), M.oakLight);
  pail.position.set(4.15, 0.04, 4.92);
  tubGroup.add(pail);
  interiorGroup.add(tubGroup);
  addCollider(3.55, 4.85, 3.55, 4.35);

  // --- LDK KITCHEN (East Wall) ---
  const fridgeFront = makeFrontMat('appliance_fridge', { roughness: 0.28, metalness: 0.72 });
  addBox(interiorGroup, 0.62, 1.74, 0.62, 4.51, 0.87, 5.70, [M.stainless, fridgeFront, M.stainless, M.stainless, M.stainless, M.stainless], true, true);
  const kCabFront = makeFrontMat('furniture_kitchen_cab', { roughness: 0.35 });
  const kTopMat = makeSurfaceMat('marble_white', 2.20, 0.65);
  [6.44, 7.18, 7.91].forEach((kz, idx) => {
    addBox(interiorGroup, 0.62, 0.82, (idx === 1 ? 0.74 : 0.73) - 0.008, 4.53, 0.41, kz, [M.whiteMatte, kCabFront, M.whiteMatte, M.whiteMatte, M.whiteMatte, M.whiteMatte], true, true);
  });
  addBox(interiorGroup, 0.65, 0.042, 0.16, 4.52, 0.84, 6.16, kTopMat, true, true);
  addBox(interiorGroup, 0.65, 0.042, 1.48, 4.52, 0.84, 7.54, kTopMat, true, true);
  addBox(interiorGroup, 0.12, 0.042, 0.62, 4.26, 0.84, 6.55, kTopMat, true, true);
  addBox(interiorGroup, 0.14, 0.042, 0.62, 4.78, 0.84, 6.55, kTopMat, true, true);
  addBox(interiorGroup, 0.42, 0.16, 0.58, 4.52, 0.76, 6.55, M.stainless, false, true);
  const fNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.30, 12), M.chrome);
  fNeck.position.set(4.76, 1.00, 6.55);
  interiorGroup.add(fNeck);
  const fSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 12), M.chrome);
  fSpout.rotation.z = Math.PI / 2;
  fSpout.position.set(4.67, 1.14, 6.55);
  interiorGroup.add(fSpout);
  addBox(interiorGroup, 0.24, 0.02, 0.34, 4.48, 0.87, 7.18, M.oakLight, true, true);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.17, 16), M.darkIron);
  kettle.position.set(4.56, 0.945, 7.45);
  interiorGroup.add(kettle);
  addBox(interiorGroup, 0.52, 0.016, 0.58, 4.51, 0.868, 7.90, M.darkIron, false, true);
  [[4.42, 7.76], [4.42, 8.04], [4.64, 7.90]].forEach(([bx, bz]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.072, 24), new THREE.MeshBasicMaterial({ color: 0x8b95a1, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(bx, 0.878, bz);
    interiorGroup.add(ring);
  });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.12, 18), M.bronze);
  pot.position.set(4.42, 0.935, 7.76);
  pot.castShadow = true;
  interiorGroup.add(pot);
  const hoodMat = makeSurfaceMat('metal_bronze', 0.65, 0.70);
  addBox(interiorGroup, 0.62, 0.16, 0.74, 4.53, 1.72, 7.90, hoodMat, true, true);
  addBox(interiorGroup, 0.32, 0.72, 0.34, 4.68, 2.16, 7.90, hoodMat, true, true);
  addBox(interiorGroup, 0.36, 0.64, 1.38, 4.66, 2.14, 6.78, M.whiteMatte, true, true);
  addBox(interiorGroup, 0.02, 0.014, 1.30, 4.54, 1.815, 6.78, coveMat, false, false);
  addCollider(4.18, 4.85, 5.36, 8.30);

  // --- LDK DINING ---
  const diningGroup = new THREE.Group();
  addBox(diningGroup, 1.35, 0.038, 0.80, 2.525, 0.71, 6.68, makeSurfaceMat('wood_floor', 1.35, 0.80), true, true);
  [[1.93, 6.36], [3.12, 6.36], [1.93, 7.00], [3.12, 7.00]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.70, 12), M.oak);
    leg.position.set(lx, 0.35, lz);
    leg.castShadow = true;
    diningGroup.add(leg);
  });
  const mealMat = makeFrontMat('meal_teishoku', { roughness: 0.45 });
  addBox(diningGroup, 0.48, 0.012, 0.44, 2.28, 0.735, 6.72, [M.oak, M.oak, mealMat, M.oak, M.oak, M.oak], true, true);
  const dVase = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.055, 0.19, 14), M.ceramic);
  dVase.position.set(2.86, 0.825, 6.62);
  diningGroup.add(dVase);
  const dBranch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 1), M.foliageLight);
  dBranch.position.set(2.86, 0.96, 6.62);
  diningGroup.add(dBranch);
  const chairSeatMat = makeSurfaceMat('fabric_grey_sofa', 0.42, 0.42);
  [{ x: 2.24, z: 6.08, rot: 0 }, { x: 2.82, z: 6.08, rot: 0 }, { x: 2.24, z: 7.28, rot: Math.PI }, { x: 2.82, z: 7.28, rot: Math.PI }].forEach(({ x, z, rot }) => {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z);
    ch.rotation.y = rot;
    addBox(ch, 0.42, 0.045, 0.40, 0, 0.44, 0, chairSeatMat, true, true);
    [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.43, 10), M.oak);
      leg.position.set(lx, 0.215, lz);
      leg.castShadow = true;
      ch.add(leg);
    });
    addBox(ch, 0.026, 0.36, 0.026, -0.17, 0.62, -0.17, M.oak, true, true);
    addBox(ch, 0.026, 0.36, 0.026, 0.17, 0.62, -0.17, M.oak, true, true);
    addBox(ch, 0.40, 0.12, 0.028, 0, 0.74, -0.17, M.oak, true, true);
    diningGroup.add(ch);
  });
  interiorGroup.add(diningGroup);
  addCollider(1.90, 3.16, 6.26, 7.10);

  // Twin Warm Brushed-Bronze Dining Pendant Lights
  [2.25, 2.82].forEach((px) => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.90, 8), M.darkIron);
    cord.position.set(px, 2.05, 6.68);
    interiorGroup.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 20, 1, true), M.bronze);
    shade.position.set(px, 1.58, 6.68);
    interiorGroup.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), M.warmBulb);
    bulb.position.set(px, 1.54, 6.68);
    interiorGroup.add(bulb);
  });

  // --- LDK LIVING LOUNGE ---
  const latticeGroup = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    addBox(latticeGroup, 0.045, 2.48, 0.030, 1.15, 1.24, 5.38 + i * 0.082, M.walnut, true, true);
  }
  addBox(latticeGroup, 0.055, 0.04, 0.72, 1.15, 2.47, 5.71, M.walnut);
  addBox(latticeGroup, 0.055, 0.04, 0.72, 1.15, 0.02, 5.71, M.walnut);
  interiorGroup.add(latticeGroup);
  addCollider(1.11, 1.19, 5.34, 6.07);

  const bsFront = makeFrontMat('furniture_bookshelf', { roughness: 0.55 });
  addBox(interiorGroup, 0.32, 1.48, 0.88, 0.33, 0.74, 6.76, [bsFront, M.oak, M.oakLight, M.oak, M.oak, M.oak], true, true);
  addCollider(0.15, 0.50, 6.32, 7.20);
  addBox(interiorGroup, 0.16, 0.20, 0.035, 0.32, 1.58, 6.50, new THREE.MeshStandardMaterial({ color: 0x324d66, roughness: 0.7 }));
  addBox(interiorGroup, 0.16, 0.18, 0.032, 0.32, 1.57, 6.54, new THREE.MeshStandardMaterial({ color: 0x9d4b39, roughness: 0.7 }));
  addBox(interiorGroup, 0.16, 0.21, 0.035, 0.32, 1.585, 6.58, new THREE.MeshStandardMaterial({ color: 0xc29e53, roughness: 0.7 }));

  addBox(interiorGroup, 0.39, 0.36, 1.80, 0.365, 0.24, 8.45, M.oak, true, true);
  addBox(interiorGroup, 0.015, 0.28, 0.66, 0.562, 0.24, 8.45, makeSurfaceMat('panel_perforated', 0.66, 0.28), false, true);
  addBox(interiorGroup, 0.015, 0.28, 0.50, 0.562, 0.24, 7.82, M.oakLight);
  addBox(interiorGroup, 0.015, 0.28, 0.50, 0.562, 0.24, 9.08, M.oakLight);
  addCollider(0.15, 0.57, 7.54, 9.36);

  // Interactive 55" Flat-Screen TV (toggleable dim moody screen glow!)
  const tvScreenMat = makeFrontMat('appliance_tv_screen', { roughness: 0.14, metalness: 0.25 });
  const tvMesh = addBox(interiorGroup, 0.045, 0.72, 1.24, 0.32, 0.86, 8.45, [tvScreenMat, M.darkIron, M.darkIron, M.darkIron, M.darkIron, M.darkIron], true, true);
  addBox(interiorGroup, 0.22, 0.08, 0.03, 0.33, 0.46, 8.02, M.darkIron);
  addBox(interiorGroup, 0.22, 0.08, 0.03, 0.33, 0.46, 8.88, M.darkIron);
  const tvGlowLight = new THREE.PointLight(0x7098c9, 0.0, 3.6, 2.0);
  tvGlowLight.position.set(0.55, 0.86, 8.45);
  root.add(tvGlowLight);
  tvMesh.userData.propId = 'tv';
  interactiveProps.push({
    id: 'tv',
    mesh: tvMesh,
    isOn: false,
    getLabel() { return this.isOn ? 'テレビを消す' : 'テレビをつける'; },
    toggle() {
      this.isOn = !this.isOn;
      tvScreenMat.emissive.setHex(this.isOn ? 0x1d2c42 : 0x000000);
      tvScreenMat.emissiveIntensity = this.isOn ? 1.4 : 0.0;
      tvGlowLight.intensity = this.isOn ? 0.85 : 0.0;
    },
  });

  // 3-Seater Sofa
  const sofaGroup = new THREE.Group();
  const sofaMat = makeSurfaceMat('fabric_grey_sofa', 0.85, 0.85);
  addBox(sofaGroup, 0.82, 0.10, 1.74, 2.70, 0.16, 8.495, M.oak, true, true);
  [[2.36, 7.70], [3.04, 7.70], [2.36, 9.29], [3.04, 9.29]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.12, 10), M.oak);
    leg.position.set(lx, 0.06, lz);
    sofaGroup.add(leg);
  });
  addBox(sofaGroup, 0.16, 0.54, 1.74, 3.03, 0.48, 8.495, sofaMat, true, true);
  addBox(sofaGroup, 0.82, 0.36, 0.13, 2.70, 0.39, 7.69, sofaMat, true, true);
  addBox(sofaGroup, 0.82, 0.36, 0.13, 2.70, 0.39, 9.30, sofaMat, true, true);
  [7.98, 8.495, 9.01].forEach((cz) => {
    addBox(sofaGroup, 0.64, 0.16, 0.49, 2.61, 0.29, cz, sofaMat, true, true);
    const bc = addBox(sofaGroup, 0.15, 0.33, 0.48, 2.88, 0.525, cz, sofaMat, true, true);
    bc.rotation.z = 0.08;
  });
  const redCushion = addBox(sofaGroup, 0.11, 0.34, 0.34, 2.68, 0.50, 7.92, makeFrontMat('zabuton_red', { roughness: 0.9 }), true, true);
  redCushion.rotation.set(0.12, 0.28, 0.18);
  const sakCushion = addBox(sofaGroup, 0.11, 0.32, 0.32, 2.68, 0.49, 9.06, makeSurfaceMat('fabric_sakura', 0.35, 0.35), true, true);
  sakCushion.rotation.set(-0.14, -0.25, 0.18);
  interiorGroup.add(sofaGroup);
  addCollider(2.30, 3.12, 7.62, 9.36);

  // Coffee Table + Tea Set
  addBox(interiorGroup, 0.55, 0.032, 1.00, 1.495, 0.365, 8.45, makeSurfaceMat('wood_floor', 0.55, 1.0), true, true);
  [[1.28, 8.02], [1.71, 8.02], [1.28, 8.88], [1.71, 8.88]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.35, 10), M.oak);
    leg.position.set(lx, 0.175, lz);
    leg.castShadow = true;
    interiorGroup.add(leg);
  });
  addBox(interiorGroup, 0.28, 0.015, 0.34, 1.50, 0.39, 8.32, M.walnut, true, true);
  const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), M.darkIron);
  teapot.scale.set(1, 0.72, 1);
  teapot.position.set(1.50, 0.435, 8.26);
  interiorGroup.add(teapot);
  [1.44, 1.56].forEach((cx) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.055, 12), M.ceramic);
    cup.position.set(cx, 0.425, 8.40);
    interiorGroup.add(cup);
  });
  addBox(interiorGroup, 0.22, 0.022, 0.28, 1.48, 0.395, 8.74, M.creamTrim, true, true);
  addCollider(1.22, 1.77, 7.95, 8.95);

  // LDK AC Unit
  addBox(interiorGroup, 0.82, 0.28, 0.23, 3.68, 2.22, 5.47, [M.whiteMatte, M.whiteMatte, M.whiteMatte, M.whiteMatte, acMat, M.whiteMatte], true, true);

  // Potted Ficus Tree
  const plantGroup = new THREE.Group();
  plantGroup.position.set(0.45, 0, 9.48);
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.34, 18), M.ceramic);
  planter.position.y = 0.17;
  planter.castShadow = true;
  plantGroup.add(planter);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.82, 10), M.walnut);
  trunk.position.y = 0.72;
  plantGroup.add(trunk);
  [[0, 1.15, 0, 0.24], [-0.14, 1.02, 0.09, 0.18], [0.13, 1.08, -0.08, 0.19], [0.06, 1.28, 0.08, 0.16], [-0.08, 1.22, -0.10, 0.15]].forEach(([fx, fy, fz, r], idx) => {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), idx % 2 === 0 ? M.foliage : M.foliageLight);
    puff.position.set(fx, fy, fz);
    puff.castShadow = true;
    plantGroup.add(puff);
  });
  interiorGroup.add(plantGroup);

  // --- RAISED TATAMI NOOK (Protagonist can smoothly step up onto FL+320!) ---
  const tatamiGroup = new THREE.Group();
  addBox(tatamiGroup, 1.29, 0.29, 1.29, 4.195, 0.145, 9.195, M.oak, true, true);
  [8.88, 9.50].forEach((dz) => {
    addBox(tatamiGroup, 0.016, 0.22, 0.56, 3.545, 0.15, dz, M.oakLight, false, true);
    addBox(tatamiGroup, 0.022, 0.02, 0.14, 3.532, 0.22, dz, M.bronze);
  });
  const tatamiTop = makeFrontMat('tatami', { roughness: 0.88 });
  addBox(tatamiGroup, 1.24, 0.036, 1.24, 4.195, 0.308, 9.195, [M.oak, M.oak, tatamiTop, M.oak, M.oak, M.oak], true, true);
  const zabMat = makeFrontMat('zabuton_red', { roughness: 0.92 });
  addBox(tatamiGroup, 0.50, 0.065, 0.50, 4.46, 0.358, 9.02, [M.terracotta, M.terracotta, zabMat, M.terracotta, M.terracotta, M.terracotta], true, true);
  const chabTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.026, 24), M.walnut);
  chabTop.position.set(3.98, 0.58, 9.28);
  chabTop.castShadow = true;
  tatamiGroup.add(chabTop);
  [[3.84, 9.15], [4.12, 9.15], [3.84, 9.41], [4.12, 9.41]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.24, 8), M.walnut);
    leg.position.set(lx, 0.45, lz);
    tatamiGroup.add(leg);
  });
  // Interactive Washi Floor Lantern (和紙行灯)
  addBox(tatamiGroup, 0.20, 0.03, 0.20, 4.62, 0.34, 9.60, M.walnut);
  const lanternMat = M.washiGlow.clone();
  lanternMat.emissiveIntensity = 1.9;
  const lanternMesh = addBox(tatamiGroup, 0.16, 0.34, 0.16, 4.62, 0.52, 9.60, lanternMat, false, false);
  [[-0.085, -0.085], [0.085, -0.085], [-0.085, 0.085], [0.085, 0.085]].forEach(([rx, rz]) => {
    addBox(tatamiGroup, 0.014, 0.38, 0.014, 4.62 + rx, 0.53, 9.60 + rz, M.walnut);
  });
  interiorGroup.add(tatamiGroup);

  // =========================================================================
  // 7. CEILINGS, INSPECTION HATCH & ROOF (ALWAYS ENCLOSED IN FIRST-PERSON)
  // =========================================================================
  function addCeiling(x0, z0, x1, z1, y, texName) {
    const w = x1 - x0, d = z1 - z0;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), makeSurfaceMat(texName, w, d));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    interiorGroup.add(mesh);
  }
  addCeiling(0.15, 5.30, 4.85, 9.85, 2.50, 'wallpaper_white');
  addCeiling(1.60, 0.15, 4.85, 3.50, 2.50, 'wallpaper_white');
  addCeiling(0.15, 0.15, 1.55, 3.50, 2.35, 'wallpaper_white');
  addCeiling(0.15, 3.50, 1.15, 5.30, 2.35, 'ceiling_acoustic');
  addCeiling(1.15, 3.50, 2.05, 5.30, 2.35, 'wallpaper_white');
  addCeiling(2.05, 3.50, 3.50, 5.30, 2.35, 'ceiling_hatch');
  addCeiling(3.50, 3.50, 4.85, 5.30, 2.25, 'panel_white_vert');
  addBox(interiorGroup, 0.42, 0.03, 0.30, 4.20, 2.235, 4.72, M.whiteMatte, false, false);

  // Roof Slab & Canopies
  const roofMat = makeSurfaceMat('concrete_clean', 5.0, 10.0);
  addBox(exteriorGroup, 5.10, 0.14, 10.10, 2.50, 2.72, 5.00, [M.bronze, M.bronze, roofMat, M.whiteMatte, M.bronze, M.bronze], true, true);
  addBox(exteriorGroup, 5.10, 0.10, 0.90, 2.50, 2.58, 10.45, [M.bronze, M.bronze, M.darkIron, makeSurfaceMat('wood_deck', 5.0, 0.90), M.bronze, M.bronze], true, true);
  addBox(exteriorGroup, 1.75, 0.08, 0.85, 0.95, 2.42, -0.42, M.darkIron, true, true);

  // Dim Ceiling Fixture Housings
  const dimBulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe4bd,
    emissive: new THREE.Color(0xffaa4c),
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });
  LIGHTING.forEach((lt) => {
    if (lt.type === 'downlight' || lt.type === 'bath_light') {
      const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.015, 16), M.whiteMatte);
      trim.position.set(lt.x, lt.y, lt.z);
      interiorGroup.add(trim);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.018, 14), dimBulbMat);
      glow.position.set(lt.x, lt.y - 0.004, lt.z);
      interiorGroup.add(glow);
    } else if (lt.type === 'ceiling') {
      const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24), M.washiGlow);
      cl.position.set(lt.x, lt.y, lt.z);
      interiorGroup.add(cl);
    }
  });

  // =========================================================================
  // 8. MOODY DARK ARCHITECTURAL PRACTICAL LIGHTS (INTIMATE WARM POOLS)
  // =========================================================================
  const practicalSpecs = [
    { name: 'Dining_Pendant', x: 2.52, y: 1.44, z: 6.68, color: 0xffb766, intensity: 2.15, dist: 5.4, shadow: true },
    { name: 'Tatami_Lantern', x: 4.52, y: 0.66, z: 9.46, color: 0xff9f45, intensity: 2.10, dist: 4.6, shadow: false },
    { name: 'Living_Cove',    x: 0.55, y: 1.65, z: 8.45, color: 0xffaa52, intensity: 0.95, dist: 4.2, shadow: false },
    { name: 'Kitchen_Task',   x: 4.22, y: 1.72, z: 6.95, color: 0xffdca8, intensity: 1.15, dist: 3.6, shadow: false },
    { name: 'Bedroom_Lamps',  x: 4.20, y: 1.05, z: 1.45, color: 0xffad58, intensity: 1.55, dist: 5.2, shadow: true },
    { name: 'Genkan_Glow',    x: 0.90, y: 1.55, z: 1.05, color: 0xffb361, intensity: 1.15, dist: 4.2, shadow: false },
    { name: 'Corridor_Dim',   x: 0.65, y: 2.18, z: 4.35, color: 0xffc685, intensity: 0.85, dist: 3.6, shadow: false },
    { name: 'Wash_Bath',      x: 3.10, y: 2.05, z: 4.35, color: 0xcfe2f5, intensity: 1.10, dist: 4.4, shadow: false },
    { name: 'Porch_Sconce',   x: 1.54, y: 1.85, z: -0.35, color: 0xffb562, intensity: 1.45, dist: 6.5, shadow: false },
  ];
  let lanternLight = null;
  practicalSpecs.forEach((ps) => {
    const pl = new THREE.PointLight(ps.color, ps.intensity, ps.dist, 1.85);
    pl.position.set(ps.x, ps.y, ps.z);
    if (ps.shadow) {
      pl.castShadow = true;
      pl.shadow.mapSize.set(512, 512);
      pl.shadow.bias = -0.002;
    }
    root.add(pl);
    interiorLights.push({ light: pl, baseInt: ps.intensity, name: ps.name });
    if (ps.name === 'Tatami_Lantern') lanternLight = pl;
  });

  // Make Washi Lantern interactively toggleable too!
  lanternMesh.userData.propId = 'lantern';
  interactiveProps.push({
    id: 'lantern',
    mesh: lanternMesh,
    isOn: true,
    getLabel() { return this.isOn ? '和紙行灯を消す' : '和紙行灯をつける'; },
    toggle() {
      this.isOn = !this.isOn;
      lanternMat.emissiveIntensity = this.isOn ? 1.9 : 0.0;
      if (lanternLight) lanternLight.intensity = this.isOn ? 2.1 : 0.0;
    },
  });

  // Tune bulb glows for moody night aesthetic
  M.warmBulb.emissiveIntensity = 2.6;
  M.washiGlow.emissiveIntensity = 1.65;

  // =========================================================================
  // 9. POCO F7 ADRENO 825 STATIC GEOMETRY BATCHING (SLASHES DRAW CALLS ~75%)
  // =========================================================================
  const excludeInteractive = new Set([
    ...interactiveProps.map((p) => p.mesh),
  ]);
  const { batchedGroup, stats: batchStats } = batchStaticGroups([interiorGroup, exteriorGroup], excludeInteractive);
  root.add(batchedGroup);

  return {
    root,
    interactiveDoors,
    interactiveProps,
    interiorLights,
    staticColliders,
    treeColliders,
    fireflies,
    ffSeeds,
    windTimeUniform,
    batchStats,
  };
}
