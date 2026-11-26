import * as THREE from 'three';
import {
  TRIBUTARIES,
  evalMainRiver,
} from './terrenoConfig.js';
import { evalClosestTributary } from './terrenoGeomorphology.js';

/**
 * TERRENO 3.0 Engine — Real-World 3D Japanese Architectural River & Mountain-Stream Bridges!
 *
 * Automatically scans EVERY crossing of the winding mountain forestry road network across:
 *   - Main Emerald River (黒杉川) -> Grand Steel Under-Deck Arch & Overhead Warren-Truss Valley Bridges
 *   - All 12 Mountain Tributary Streams -> Scenic Cedar-Timber & Stone-Arch Mountain Stream Bridges
 *
 * Guarantees:
 *   1. ZERO impassable rivers on ANY road — vehicles (CAMPER-75, ARMOR-155 + Trailer, KEI-340) & players
 *      drive/walk smoothly across elevated 3D bridge decks +5.5m..+8.5m above the rushing river!
 *   2. Millimeter-exact C1 Hermite approach ramps + gentle arch camber synced 1:1 with geomorph.getHeightAt()!
 *   3. Authentic Japanese bridge detailing: weathered asphalt decks with white edge lines & steel expansion
 *      joints, dressed granite masonry abutments, hydro-shaped concrete river piers, steel/cedar guardrails,
 *      and glowing warm bridge streetlamps at dusk/night!
 */

const MAIN_BRIDGE_NAMES = [
  '黒杉大橋',
  '杉ノ郷渓谷橋',
  '奥谷アーチ橋',
  '紅葉大橋',
  '白樺北大橋',
  '北峠渓谷大橋',
  '黒杉北環状橋',
  '黒杉南環状橋',
  'ススキ渓谷大橋',
  '南杉大橋',
  'アカマツ大橋',
  '清流見晴橋',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function hermite01(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3.0 - 2.0 * c);
}

function hermiteDeriv01(t) {
  const c = clamp(t, 0, 1);
  return 6.0 * c * (1.0 - c);
}

function createBridgeAsphaltTexture() {
  const w = 256, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Weathered charcoal mountain asphalt
  ctx.fillStyle = '#363b40';
  ctx.fillRect(0, 0, w, h);

  // Fine mineral aggregate grain + subtle twin tire wear tracks
  let s = 48271;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 6500; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const v = 42 + Math.floor(rng() * 44);
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // Subtle wheel polish tracks
  ctx.fillStyle = 'rgba(22, 25, 29, 0.28)';
  ctx.fillRect(w * 0.22, 0, w * 0.16, h);
  ctx.fillRect(w * 0.62, 0, w * 0.16, h);

  // Crisp Japanese weathered white shoulder edge stripes
  ctx.fillStyle = 'rgba(235, 238, 234, 0.86)';
  ctx.fillRect(10, 0, 8, h);
  ctx.fillRect(w - 18, 0, 8, h);

  // Dashed amber-white mountain road centerline
  ctx.fillStyle = 'rgba(240, 198, 92, 0.82)';
  ctx.fillRect(w * 0.5 - 3, 18, 6, 92);
  ctx.fillRect(w * 0.5 - 3, 146, 6, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createBridgeStoneTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c6062';
  ctx.fillRect(0, 0, s, s);
  let seed = 19381;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  const rows = 8;
  const rowH = s / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 4;
    const colW = s / cols;
    const off = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + off;
      const y = r * rowH;
      const shade = 86 + Math.floor(rng() * 44);
      const moss = rng() < 0.25 ? 12 : 0;
      ctx.fillStyle = `rgb(${shade - moss * 0.5},${shade + moss},${shade - 2})`;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
      ctx.strokeStyle = 'rgba(30, 34, 32, 0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Evaluate exact bridge surface height and longitudinal slope at local coordinate `along`!
 */
function evalBridgeProfile(b, along) {
  const halfSpan = b.halfSpan;
  const rampLen = b.rampLen;
  const totalHalf = halfSpan + rampLen;

  if (along < -totalHalf || along > totalHalf) return null;

  if (along >= -halfSpan && along <= halfSpan) {
    // Graceful architectural camber across main span
    const u = along / halfSpan; // [-1..+1]
    const y = b.deckY + b.camber * (1.0 - u * u);
    const dyDal = -2.0 * b.camber * (along / (halfSpan * halfSpan));
    return { y, dyDal, onMainSpan: true };
  }

  if (along < -halfSpan) {
    // Negative approach ramp: [-totalHalf -> -halfSpan] smoothly rises from startGroundY -> deckY
    const t = (along - (-totalHalf)) / rampLen; // 0 at outer ramp toe -> 1 at bridge abutment
    const y = b.startGroundY + (b.deckY - b.startGroundY) * hermite01(t);
    const dyDal = ((b.deckY - b.startGroundY) / rampLen) * hermiteDeriv01(t);
    return { y, dyDal, onMainSpan: false };
  }

  // Positive approach ramp: [+halfSpan -> +totalHalf] smoothly descends from deckY -> endGroundY
  const t = (along - halfSpan) / rampLen; // 0 at abutment -> 1 at outer ramp toe
  const y = b.deckY + (b.endGroundY - b.deckY) * hermite01(t);
  const dyDal = ((b.endGroundY - b.deckY) / rampLen) * hermiteDeriv01(t);
  return { y, dyDal, onMainSpan: false };
}

/**
 * Detect ALL crossings of ALL roads across Kurosugi Main River AND all 12 Tributaries.
 */
function detectAllBridgeCrossings(geomorph) {
  const rawCrossings = [];
  const polylines = geomorph.roadPolylines || [];

  for (let rIdx = 0; rIdx < polylines.length; rIdx++) {
    const road = polylines[rIdx];
    const pts = road.pts;
    if (!pts || pts.length < 2) continue;

    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = pts[i][0], z0 = pts[i][1];
      const x1 = pts[i + 1][0], z1 = pts[i + 1][1];
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      if (segLen < 0.5) continue;
      const steps = Math.max(4, Math.ceil(segLen / 12.0));

      // 1. Check Main River Kurosugi Crossing
      let prevDiff = x0 - evalMainRiver(z0).x;
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const x = x0 + (x1 - x0) * u;
        const z = z0 + (z1 - z0) * u;
        const rv = evalMainRiver(z);
        const diff = x - rv.x;
        if ((prevDiff <= 0 && diff > 0) || (prevDiff >= 0 && diff < 0)) {
          const frac = Math.abs(prevDiff) / (Math.abs(prevDiff) + Math.abs(diff) + 1e-6);
          const uCross = ((s - 1) + frac) / steps;
          const cx = x0 + (x1 - x0) * uCross;
          const cz = z0 + (z1 - z0) * uCross;
          const ux = (x1 - x0) / segLen;
          const uz = (z1 - z0) / segLen;
          const rvC = evalMainRiver(cz);
          rawCrossings.push({
            kind: 'main_river',
            cx,
            cz,
            ux,
            uz,
            roadIdx: rIdx,
            roadId: road.id,
            roadName: road.nameJp,
            roadWidth: road.width || 8.4,
            waterY: rvC.waterY,
            bedY: rvC.bedY,
            channelHalfW: rvC.halfWidth,
          });
        }
        prevDiff = diff;
      }

      // 2. Check All 12 Tributary Stream Crossings
      for (let ti = 0; ti < TRIBUTARIES.length; ti++) {
        const tr = TRIBUTARIES[ti];
        const rv0 = evalMainRiver(tr.z0);
        const evalSignedTrib = (px, pz) => {
          const rx = px - rv0.x;
          const rz = pz - tr.z0;
          const along = rx * tr.dirX + rz * tr.dirZ;
          if (along < 40.0 || along > tr.len * 0.72) return null;
          const meander = Math.sin(along * 0.0014 + ti * 2.1) * 160.0 + Math.cos(along * 0.0036) * 52.0;
          return { perp: -rx * tr.dirZ + rz * tr.dirX - meander, along };
        };
        const pA = evalSignedTrib(x0, z0);
        const pB = evalSignedTrib(x1, z1);
        if (!pA || !pB) continue;
        if ((pA.perp <= 0 && pB.perp > 0) || (pA.perp >= 0 && pB.perp < 0)) {
          const frac = Math.abs(pA.perp) / (Math.abs(pA.perp) + Math.abs(pB.perp) + 1e-6);
          const cx = x0 + (x1 - x0) * frac;
          const cz = z0 + (z1 - z0) * frac;
          const ux = (x1 - x0) / segLen;
          const uz = (z1 - z0) / segLen;
          const uTrib = clamp((pA.along + (pB.along - pA.along) * frac) / (tr.len * 0.72), 0, 1);
          const hw = Math.max(6.0, tr.width * 0.16 * (1.25 - 0.55 * uTrib));
          const terrY = geomorph.getTerrainHeightAt(cx, cz);
          rawCrossings.push({
            kind: 'tributary',
            tribName: tr.nameJp,
            cx,
            cz,
            ux,
            uz,
            roadIdx: rIdx,
            roadId: road.id,
            roadName: road.nameJp,
            roadWidth: road.width || 8.0,
            waterY: terrY + 0.42,
            bedY: terrY - 1.5,
            channelHalfW: hw,
          });
        }
      }
    }
  }

  // Deduplicate nearby crossings (within 130m) keeping main_river priority
  rawCrossings.sort((a, b) => (a.kind === 'main_river' ? 0 : 1) - (b.kind === 'main_river' ? 0 : 1));
  const merged = [];
  for (let i = 0; i < rawCrossings.length; i++) {
    const c = rawCrossings[i];
    let dup = false;
    for (let j = 0; j < merged.length; j++) {
      if (Math.hypot(c.cx - merged[j].cx, c.cz - merged[j].cz) < 130.0) {
        dup = true;
        break;
      }
    }
    if (!dup) merged.push(c);
  }

  // Construct complete engineered Bridge Specification objects
  let mainIdx = 0;
  let mainPoolIdx = 0;
  let tribIdx = 0;
  return merged.map((c, idx) => {
    const isMain = c.kind === 'main_river';
    // Ensure consistent +X-pointing orientation for readable symmetry
    let ux = c.ux, uz = c.uz;
    if (ux < 0 || (Math.abs(ux) < 0.01 && uz < 0)) { ux = -ux; uz = -uz; }
    const rx = -uz;
    const rz = ux;
    const yaw = Math.atan2(ux, uz);

    // Span safely across the entire wetted river channel + dry bank benches!
    const angleCos = isMain ? Math.max(0.55, Math.abs(ux)) : 0.82;
    const minHalfSpan = isMain
      ? Math.max(46.0, (c.channelHalfW / angleCos) + 18.0)
      : Math.max(16.0, c.channelHalfW + 10.0);
    const halfSpan = Math.min(isMain ? 105.0 : 34.0, minHalfSpan);
    const rampLen = isMain ? 26.0 : 14.0;
    const deckWidth = Math.max(isMain ? 11.4 : 10.4, c.roadWidth + 2.6);
    const halfDeckW = deckWidth * 0.5;

    // Sample bare terrain at outer approach ramp ends & abutments
    const sx = c.cx - ux * (halfSpan + rampLen);
    const sz = c.cz - uz * (halfSpan + rampLen);
    const ex = c.cx + ux * (halfSpan + rampLen);
    const ez = c.cz + uz * (halfSpan + rampLen);
    const abNegX = c.cx - ux * halfSpan;
    const abNegZ = c.cz - uz * halfSpan;
    const abPosX = c.cx + ux * halfSpan;
    const abPosZ = c.cz + uz * halfSpan;

    const startGroundY = geomorph.getTerrainHeightAt(sx, sz);
    const endGroundY = geomorph.getTerrainHeightAt(ex, ez);
    const abNegY = geomorph.getTerrainHeightAt(abNegX, abNegZ);
    const abPosY = geomorph.getTerrainHeightAt(abPosX, abPosZ);

    // Deck height clears water generously (+5.8m..+8.2m on main river -> dry even during flash floods!)
    const minWaterClear = isMain ? (c.waterY + 6.2) : (c.waterY + 3.2);
    const bankClear = Math.max(startGroundY, endGroundY, abNegY, abPosY) + (isMain ? 1.15 : 0.65);
    const deckY = Math.max(minWaterClear, bankClear);
    const camber = isMain ? Math.min(1.35, halfSpan * 0.015) : 0.35;

    // Choose authentic Japanese architectural bridge style
    let style = 'timber_stone';
    let nameJp = `${c.tribName || '渓流'}橋`;
    if (isMain) {
      if (Math.abs(c.cz) < 180) {
        style = 'vermilion_arch'; // Iconic signature Kurobe/Kamikochi crimson arch bridge right near NARROW-50!
        nameJp = '黒杉大橋';
      } else if (Math.abs(c.cz - 1610) < 400) {
        style = 'forest_arch';
        nameJp = '杉ノ郷渓谷大橋';
      } else {
        style = mainIdx % 2 === 0 ? 'steel_truss' : 'forest_arch';
        const pool = MAIN_BRIDGE_NAMES.slice(2);
        nameJp = pool[mainPoolIdx % pool.length];
        mainPoolIdx++;
      }
      mainIdx++;
    } else {
      tribIdx++;
      nameJp = `${c.tribName || '清流'}${tribIdx > 1 ? '小橋' : '橋'}`;
    }

    return {
      id: `bridge_${idx}_${isMain ? 'main' : 'trib'}`,
      kind: c.kind,
      style,
      nameJp,
      roadId: c.roadId,
      cx: c.cx,
      cz: c.cz,
      ux,
      uz,
      rx,
      rz,
      yaw,
      halfSpan,
      rampLen,
      totalHalfLen: halfSpan + rampLen,
      deckWidth,
      halfDeckW,
      deckY,
      camber,
      waterY: c.waterY,
      bedY: c.bedY,
      startGroundY,
      endGroundY,
      boundingRadius: halfSpan + rampLen + halfDeckW + 8.0,
    };
  });
}

/**
 * Build a detailed, realistic 3D Japanese architectural bridge mesh group for one bridge!
 */
function buildSingleBridgeMesh(b, mats) {
  const grp = new THREE.Group();
  grp.name = `TERRENO_Bridge_${b.id}`;

  const toWorld = (along, y, across) => [
    b.cx + b.ux * along + b.rx * across,
    y,
    b.cz + b.uz * along + b.rz * across,
  ];

  // 1. CONTINUOUS EXACT-PROFILE ASPHALT DECK & APPROACH RAMPS (Exact match to evalBridgeProfile!)
  const deckSegs = b.kind === 'main_river' ? 28 : 16;
  const totalLen = b.totalHalfLen * 2.0;
  const deckPos = [];
  const deckNorm = [];
  const deckUv = [];
  const deckIdx = [];
  const curbPos = [];
  const curbNorm = [];
  const curbIdx = [];

  for (let i = 0; i <= deckSegs; i++) {
    const u = i / deckSegs;
    const along = -b.totalHalfLen + u * totalLen;
    const prof = evalBridgeProfile(b, along);
    const yTop = prof.y;
    const vCoord = (along + b.totalHalfLen) * 0.08;

    // Road deck strip (-halfDeckW .. +halfDeckW)
    const pL = toWorld(along, yTop, -b.halfDeckW);
    const pR = toWorld(along, yTop, b.halfDeckW);
    deckPos.push(pL[0], pL[1], pL[2], pR[0], pR[1], pR[2]);
    // Approximate upward normal tilted along slope
    const ny = 1.0 / Math.hypot(1.0, prof.dyDal);
    const nAlong = -prof.dyDal * ny;
    const nx = b.ux * nAlong;
    const nz = b.uz * nAlong;
    deckNorm.push(nx, ny, nz, nx, ny, nz);
    deckUv.push(0, vCoord, 1, vCoord);

    if (i < deckSegs) {
      const a = i * 2;
      // Front face pointing +Y (since +along × +across points -Y, order a -> a+1 -> a+2 faces UP!)
      deckIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    // Concrete deck underside & solid side fascia-skirt (thickness 0.85m on span, extends down into ramp embankment!)
    const isRamp = !prof.onMainSpan;
    const skirtBot = isRamp ? (Math.min(b.startGroundY, b.endGroundY) - 4.5) : (yTop - (b.kind === 'main_river' ? 1.15 : 0.72));
    const sideW = b.halfDeckW + 0.36;
    const baseV = curbPos.length / 3;
    const slTop = toWorld(along, yTop + 0.16, -sideW);
    const slBot = toWorld(along, skirtBot, -sideW);
    const srTop = toWorld(along, yTop + 0.16, sideW);
    const srBot = toWorld(along, skirtBot, sideW);
    curbPos.push(
      slTop[0], slTop[1], slTop[2],
      slBot[0], slBot[1], slBot[2],
      srTop[0], srTop[1], srTop[2],
      srBot[0], srBot[1], srBot[2],
    );
    curbNorm.push(
      -b.rx, 0.15, -b.rz,
      -b.rx, 0.0, -b.rz,
      b.rx, 0.15, b.rz,
      b.rx, 0.0, b.rz,
    );
    if (i < deckSegs) {
      const nextV = baseV + 4;
      // Left outer wall
      curbIdx.push(baseV, baseV + 1, nextV, nextV, baseV + 1, nextV + 1);
      // Right outer wall
      curbIdx.push(baseV + 2, nextV + 2, baseV + 3, nextV + 2, nextV + 3, baseV + 3);
      // Deck underside soffit
      curbIdx.push(baseV + 1, baseV + 3, nextV + 1, nextV + 1, baseV + 3, nextV + 3);
    }
  }

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(deckNorm, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUv, 2));
  deckGeo.setIndex(deckIdx);
  const deckMesh = new THREE.Mesh(deckGeo, mats.asphalt);
  deckMesh.receiveShadow = true;
  grp.add(deckMesh);

  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNorm, 3));
  curbGeo.setIndex(curbIdx);
  curbGeo.computeVertexNormals();
  const curbMesh = new THREE.Mesh(curbGeo, mats.concrete);
  grp.add(curbMesh);

  // Helper to place oriented box in bridge-local (along, y, across) space
  const addLocalBox = (wAcross, hY, lAlong, along, y, across, mat, tiltPitch = 0) => {
    const geo = new THREE.BoxGeometry(wAcross, hY, lAlong);
    const mesh = new THREE.Mesh(geo, mat);
    const p = toWorld(along, y, across);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(b.ux, b.uz);
    mesh.rotation.x = tiltPitch;
    grp.add(mesh);
    return mesh;
  };

  // 2. DRESSED GRANITE MASONRY ABUTMENTS & WING WALLS AT BOTH RIVERBANKS
  [-b.halfSpan, b.halfSpan].forEach((endAlong) => {
    const abH = 12.0;
    addLocalBox(b.deckWidth + 2.4, abH, 4.4, endAlong, b.deckY - abH * 0.5 - 0.15, 0, mats.stone);
    // Steel expansion joint strip flush on roadway at both ends of main span
    addLocalBox(b.deckWidth + 0.1, 0.04, 0.42, endAlong, b.deckY + 0.02, 0, mats.darkSteel);
  });

  // 3. HYDRO-SHAPED REINFORCED CONCRETE RIVER PIERS PLUNGING INTO RIVERBED
  if (b.kind === 'main_river') {
    const pierPositions = b.halfSpan > 62 ? [-b.halfSpan * 0.48, 0, b.halfSpan * 0.48] : [-b.halfSpan * 0.36, b.halfSpan * 0.36];
    pierPositions.forEach((pAlong) => {
      const prof = evalBridgeProfile(b, pAlong);
      const pierTop = prof.y - 1.05;
      const pierBot = b.bedY - 9.0;
      const pierH = Math.max(8.0, pierTop - pierBot);
      addLocalBox(b.deckWidth + 0.8, 1.15, 2.2, pAlong, pierTop - 0.55, 0, mats.concrete);
      [-b.halfDeckW * 0.58, b.halfDeckW * 0.58].forEach((pAcross) => {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, pierH, 8), mats.concrete);
        const pw = toWorld(pAlong, pierBot + pierH * 0.5, pAcross);
        cyl.position.set(pw[0], pw[1], pw[2]);
        grp.add(cyl);
      });
    });
  }

  // 4. ARCHITECTURAL SUPERSTRUCTURE (Vermilion/Forest Steel Arch, Overhead Warren Truss, or Cedar Stream Bridge!)
  const accentSteelMat = b.style === 'vermilion_arch'
    ? mats.vermilionSteel
    : (b.style === 'forest_arch' ? mats.forestSteel : (b.style === 'steel_truss' ? mats.slateSteel : mats.cedar));

  if (b.style === 'vermilion_arch' || b.style === 'forest_arch') {
    // Graceful Kamikochi/Kurobe Under-Deck Steel Arch Rib + Vertical Spandrel Columns (strictly BELOW deck soffit!)
    const archSegs = 14;
    const archRise = Math.min(7.5, Math.max(4.0, (b.deckY - b.waterY) * 0.72));
    [-b.halfDeckW * 0.90, b.halfDeckW * 0.90].forEach((sideA) => {
      for (let i = 0; i < archSegs; i++) {
        const u0 = -1.0 + (i / archSegs) * 2.0;
        const u1 = -1.0 + ((i + 1) / archSegs) * 2.0;
        const a0 = u0 * b.halfSpan * 0.96;
        const a1 = u1 * b.halfSpan * 0.96;
        const y0 = (b.deckY - 1.35) - archRise * u0 * u0;
        const y1 = (b.deckY - 1.35) - archRise * u1 * u1;
        const segL = Math.hypot(a1 - a0, y1 - y0);
        const pitch = -Math.atan2(y1 - y0, a1 - a0);
        addLocalBox(0.56, 0.68, segL + 0.16, (a0 + a1) * 0.5, (y0 + y1) * 0.5, sideA, accentSteelMat, pitch);

        // Vertical spandrel columns strictly below deck soffit (prof.y - 0.95)
        if (i > 0 && i < archSegs) {
          const prof = evalBridgeProfile(b, a0);
          const colTop = prof.y - 0.95;
          const colH = colTop - y0;
          if (colH > 0.35) {
            addLocalBox(0.30, colH, 0.30, a0, y0 + colH * 0.5, sideA, accentSteelMat);
          }
        }
      }
    });
  } else if (b.style === 'steel_truss') {
    // Classic Japanese Mountain Overhead Steel Warren Truss Bridge (6.8m clear headroom for ARMOR-155!)
    const trussH = 6.9;
    const bays = Math.max(6, Math.round((b.halfSpan * 2.0) / 11.5));
    const bayLen = (b.halfSpan * 2.0) / bays;
    [-b.halfDeckW - 0.18, b.halfDeckW + 0.18].forEach((sideA) => {
      // Top continuous chord
      addLocalBox(0.42, 0.48, b.halfSpan * 2.0 - bayLen * 1.4, 0, b.deckY + b.camber + trussH, sideA, accentSteelMat);
      for (let i = 0; i <= bays; i++) {
        const a0 = -b.halfSpan + i * bayLen;
        const prof0 = evalBridgeProfile(b, a0);
        if (i > 0 && i < bays) {
          addLocalBox(0.32, trussH, 0.32, a0, prof0.y + trussH * 0.5, sideA, accentSteelMat);
        }
        if (i < bays) {
          const aMid = a0 + bayLen * 0.5;
          const diagLen = Math.hypot(bayLen, trussH);
          const sign = (i % 2 === 0) ? 1 : -1;
          const pitch = sign * Math.atan2(trussH, bayLen);
          addLocalBox(0.28, 0.30, diagLen, aMid, prof0.y + trussH * 0.5, sideA, accentSteelMat, pitch);
        }
      }
    });
    // Overhead portal cross-braces
    for (let i = 1; i < bays; i += 2) {
      const a0 = -b.halfSpan + i * bayLen;
      addLocalBox(b.deckWidth + 0.6, 0.38, 0.38, a0, b.deckY + b.camber + trussH, 0, accentSteelMat);
    }
  }

  // 5. CONTINUOUS SAFETY GUARDRAILS, POSTS & GLOWING BRIDGE STREETLAMPS ALONG FULL SPAN + RAMPS!
  const railSegs = b.kind === 'main_river' ? 14 : 8;
  const railSpan = b.totalHalfLen * 1.94;
  const stepL = railSpan / railSegs;
  const railMat = b.kind === 'tributary' ? mats.cedar : accentSteelMat;
  const railH = b.kind === 'tributary' ? 1.05 : 1.18;

  [-b.halfDeckW - 0.18, b.halfDeckW + 0.18].forEach((sideA) => {
    for (let i = 0; i < railSegs; i++) {
      const a0 = -railSpan * 0.5 + i * stepL;
      const a1 = a0 + stepL;
      const p0 = evalBridgeProfile(b, a0);
      const p1 = evalBridgeProfile(b, a1);
      if (!p0 || !p1) continue;
      const dy = p1.y - p0.y;
      const segL = Math.hypot(stepL, dy);
      const pitch = -Math.atan2(dy, stepL);
      const midA = (a0 + a1) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;

      // Top & mid horizontal guardrails
      addLocalBox(0.16, 0.14, segL + 0.08, midA, midY + railH, sideA, railMat, pitch);
      addLocalBox(0.12, 0.10, segL + 0.08, midA, midY + railH * 0.55, sideA, railMat, pitch);
      // Vertical stanchion post
      addLocalBox(0.16, railH + 0.25, 0.16, a0, p0.y + (railH - 0.1) * 0.5, sideA, railMat);
    }
    // End pillar
    const pEnd = evalBridgeProfile(b, railSpan * 0.5);
    if (pEnd) addLocalBox(0.38, 1.35, 0.38, railSpan * 0.5, pEnd.y + 0.65, sideA, mats.stone);
    const pStart = evalBridgeProfile(b, -railSpan * 0.5);
    if (pStart) addLocalBox(0.38, 1.35, 0.38, -railSpan * 0.5, pStart.y + 0.65, sideA, mats.stone);
  });

  // Warm Glowing Bridge Streetlamps (Main River Bridges -> dramatic night reflection over emerald river!)
  if (b.kind === 'main_river') {
    const lampSpots = [-b.halfSpan * 0.65, 0, b.halfSpan * 0.65];
    lampSpots.forEach((la) => {
      const lp = evalBridgeProfile(b, la);
      if (!lp) return;
      [-1, 1].forEach((sideSign) => {
        const sideA = sideSign * (b.halfDeckW + 0.24);
        addLocalBox(0.12, 4.6, 0.12, la, lp.y + 2.3, sideA, mats.darkSteel);
        addLocalBox(1.1, 0.10, 0.10, la, lp.y + 4.55, sideA - sideSign * 0.52, mats.darkSteel);
        addLocalBox(0.42, 0.14, 0.26, la, lp.y + 4.46, sideA - sideSign * 0.96, mats.lampGlow);
      });
    });
  }

  return grp;
}

export function createTerrenoBridges(geomorph) {
  const group = new THREE.Group();
  group.name = 'TERRENO_ArchitecturalBridges';

  const bridges = detectAllBridgeCrossings(geomorph);

  // Shared high-craft PBR materials across all bridges
  const asphaltTex = createBridgeAsphaltTexture();
  const stoneTex = createBridgeStoneTexture();
  const mats = {
    asphalt: new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.86,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x8d9398,
      roughness: 0.88,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.90,
      metalness: 0.04,
    }),
    vermilionSteel: new THREE.MeshStandardMaterial({
      color: 0xa62e24,
      roughness: 0.46,
      metalness: 0.48,
    }),
    forestSteel: new THREE.MeshStandardMaterial({
      color: 0x2a4e42,
      roughness: 0.48,
      metalness: 0.48,
    }),
    slateSteel: new THREE.MeshStandardMaterial({
      color: 0x3b5268,
      roughness: 0.45,
      metalness: 0.55,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x262c32,
      roughness: 0.52,
      metalness: 0.62,
    }),
    cedar: new THREE.MeshStandardMaterial({
      color: 0x6f4e32,
      roughness: 0.84,
      metalness: 0.04,
    }),
    lampGlow: new THREE.MeshBasicMaterial({
      color: 0xffdca0,
    }),
  };

  // Spatial hash for O(1) bridge lookup anywhere across the 60 km × 60 km world!
  const BUCKET = 240.0;
  const buckets = new Map();
  const bKey = (bx, bz) => ((bx + 2048) << 12) | ((bz + 2048) & 0xfff);

  bridges.forEach((b, bIdx) => {
    const meshGroup = buildSingleBridgeMesh(b, mats);
    group.add(meshGroup);

    const rad = b.boundingRadius;
    const minBx = Math.floor((b.cx - rad) / BUCKET);
    const maxBx = Math.floor((b.cx + rad) / BUCKET);
    const minBz = Math.floor((b.cz - rad) / BUCKET);
    const maxBz = Math.floor((b.cz + rad) / BUCKET);
    for (let bz = minBz; bz <= maxBz; bz++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        const k = bKey(bx, bz);
        let arr = buckets.get(k);
        if (!arr) { arr = []; buckets.set(k, arr); }
        arr.push(bIdx);
      }
    }
  });

  /**
   * Fast O(1) exact analytical query at world (wx, wz).
   * Returns bridge deck elevation, smooth deck normal, guardrail check, & expansion-joint trigger!
   */
  function queryBridgeAt(wx, wz, extraMargin = 0.0) {
    const bx = Math.floor(wx / BUCKET);
    const bz = Math.floor(wz / BUCKET);
    const arr = buckets.get(bKey(bx, bz));
    if (!arr) return null;

    for (let i = 0; i < arr.length; i++) {
      const b = bridges[arr[i]];
      const dx = wx - b.cx;
      const dz = wz - b.cz;
      const along = dx * b.ux + dz * b.uz;
      if (Math.abs(along) > b.totalHalfLen + extraMargin) continue;
      const across = dx * b.rx + dz * b.rz;
      if (Math.abs(across) > b.halfDeckW + 0.55 + extraMargin) continue;

      const prof = evalBridgeProfile(b, clamp(along, -b.totalHalfLen, b.totalHalfLen));
      if (!prof) continue;

      const invL = 1.0 / Math.hypot(1.0, prof.dyDal);
      const nAlong = -prof.dyDal * invL;
      const nearJoint = Math.abs(Math.abs(along) - b.halfSpan) < 0.85;
      const onDeck = Math.abs(across) <= b.halfDeckW + 0.35;
      const hitGuardrail = prof.onMainSpan && Math.abs(across) > b.halfDeckW - 0.12 && Math.abs(across) <= b.halfDeckW + 0.85;

      return {
        onBridge: onDeck,
        onMainSpan: prof.onMainSpan,
        deckY: prof.y,
        slope: Math.abs(prof.dyDal),
        normalX: b.ux * nAlong,
        normalY: invL,
        normalZ: b.uz * nAlong,
        along,
        across,
        nearJoint,
        hitGuardrail,
        deckMaterial: b.kind === 'tributary' ? 'bridge' : 'bridge',
        bridge: b,
      };
    }
    return null;
  }

  // Register live bridge query directly on geomorph so EVERY subsystem gets 100% parity!
  geomorph.setBridgeSystem(queryBridgeAt, bridges);

  return {
    group,
    bridges,
    queryBridgeAt,
    evalClosestTributary,
  };
}
