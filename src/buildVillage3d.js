import * as THREE from 'three';
import { VILLAGE, VILLAGE_HOUSES } from './villageData.js';
import { makeSurfaceMat, makeFrontMat } from './textures.js';
import { batchStaticGroups } from './mobileBatcher.js';

/**
 * Builds the Suginosato 5-House Japanese Mountain Village (杉ノ郷集落) perched on the
 * sunlit river-bend terrace at (X=820, Z=1280, Y=-6.0m / EL +514m ASL).
 *
 * Includes:
 *   - 5 distinct, fully enterable & furnished traditional Japanese mountain houses (V1..V5)
 *     with real pitched gable roofs, eaves, stone plinths, automatic interactive doors, & interiors
 *   - Stone-paved village lane, mossy stepping paths, & gravel parking bay off the 40 km Forestry Road
 *   - Central village plaza with covered mountain spring well (水場), benches, & wooden signpost
 *   - Terraced vegetable garden (畑), firewood racks, 8 warm street lanterns, & eastern Torii mountain shrine
 *   - Dedicated mobileBatcher UV-baked static batching for ~90% draw-call reduction & frustum culling!
 */

function createVillageSignTexture(title, lines, bgHex = '#d8c5a0', inkHex = '#231a12') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Weathered hinoki/cedar wood grain background
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(70,45,20,0.12)';
  ctx.lineWidth = 2;
  for (let y = 8; y < 256; y += 11) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.2) * 2);
    ctx.lineTo(512, y - Math.cos(y * 0.15) * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#3b2b1d';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 240);

  ctx.fillStyle = inkHex;
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px "Noto Serif JP", "Hiragino Mincho ProN", serif';
  ctx.fillText(title, 256, 76);

  ctx.fillStyle = '#5c4028';
  ctx.fillRect(64, 96, 384, 3);

  ctx.fillStyle = inkHex;
  ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, 256, 140 + i * 36);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02 });
}

function buildGableTriangleGeo(span, peakH, thickness) {
  const hw = span * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, peakH);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness * 0.5);
  // Normalize UVs in meters so architectural wall textures tile crisply
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + hw) * 0.45, pos.getY(i) * 0.45);
  }
  uv.needsUpdate = true;
  return geo;
}

export function buildVillage3D(ctx) {
  const {
    scene,
    dynamicGroup,
    mat,
    addCollider,
    addLight,
    addInteractiveDoor,
    excludeBatch,
  } = ctx;

  const villageRoot = new THREE.Group();
  villageRoot.name = 'Suginosato_5House_Village';
  scene.add(villageRoot);

  const staticGroup = new THREE.Group();
  staticGroup.name = 'VillageStaticArchitecture';
  villageRoot.add(staticGroup);

  const gy = VILLAGE.groundY; // -1.20m exact natural river terrace elevation
  const cx = VILLAGE.centerX; // 820.0
  const cz = VILLAGE.centerZ; // 1280.0

  // Local materials for rich traditional Japanese village detail
  const darkTimberMat = new THREE.MeshStandardMaterial({ color: 0x2c2017, roughness: 0.84, metalness: 0.04 });
  const warmCedarMat = new THREE.MeshStandardMaterial({ color: 0x7c5333, roughness: 0.78, metalness: 0.03 });
  const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xb83022, roughness: 0.58, metalness: 0.06 });
  const charcoalTileMat = makeSurfaceMat('slate_charcoal', 4.0, 2.5, { roughness: 0.74 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    emissive: 0xffb347,
    emissiveIntensity: 1.55,
    roughness: 0.4,
  });
  const emberGlowMat = new THREE.MeshStandardMaterial({
    color: 0x3a140c,
    emissive: 0xff5412,
    emissiveIntensity: 2.1,
    roughness: 0.85,
  });
  const springWaterMat = new THREE.MeshStandardMaterial({
    color: 0x227c8c,
    emissive: 0x0b333d,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.86,
  });
  const cropLeafMat = new THREE.MeshStandardMaterial({ color: 0x3b6e2e, roughness: 0.86 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x7a8f46, roughness: 0.62 });
  const ironKettleMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.42, metalness: 0.76 });

  function addBox(parent, w, h, d, material, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addVLight(name, houseId, color, intensity, distance, x, y, z) {
    const light = addLight(name, 1, 'village', color, intensity, distance, x, y, z);
    light.userData.building = 'village';
    light.userData.houseId = houseId;
    return light;
  }

  // Helper: build a clean wall segment with textured exterior/interior faces
  function addVillageWallBox(w, h, d, x, y, z, frontTex, backTex, axis) {
    const cap = mat.wallCutCap;
    let mats;
    if (axis === 'h') {
      const mNorth = makeSurfaceMat(frontTex, w, h);
      const mSouth = makeSurfaceMat(backTex || frontTex, w, h);
      mats = [cap, cap, cap, cap, mSouth, mNorth];
    } else {
      const mWest = makeSurfaceMat(frontTex, d, h);
      const mEast = makeSurfaceMat(backTex || frontTex, d, h);
      mats = [mEast, mWest, cap, cap, cap, cap];
    }
    return addBox(staticGroup, w, h, d, mats, x, y, z, true);
  }

  // Helper: add glass/lattice framed window on an exterior wall (mitered corners & staggered mullions)
  function addVillageWindow(h, side, pos, width, height, sillRel, frosted = false) {
    const t = 0.18;
    const baseY = h.domaY;
    const sillY = baseY + sillRel;
    const frameT = 0.045;
    const innerH = Math.max(0.06, height - frameT * 2);
    const glassMat = frosted ? mat.glassFrosted : mat.glassClear;
    const isH = side === 'north' || side === 'south';
    const ortho = side === 'north'
      ? h.oz + t * 0.5
      : (side === 'south' ? h.oz + h.d - t * 0.5 : (side === 'west' ? h.ox + t * 0.5 : h.ox + h.w - t * 0.5));
    const startW = isH ? h.ox + pos : h.oz + pos;

    if (isH) {
      addBox(staticGroup, width, frameT, t + 0.03, darkTimberMat, startW + width * 0.5, sillY + frameT * 0.5, ortho, false);
      addBox(staticGroup, width, frameT, t + 0.03, darkTimberMat, startW + width * 0.5, sillY + height - frameT * 0.5, ortho, false);
      addBox(staticGroup, frameT, innerH, t + 0.03, darkTimberMat, startW + frameT * 0.5, sillY + height * 0.5, ortho, false);
      addBox(staticGroup, frameT, innerH, t + 0.03, darkTimberMat, startW + width - frameT * 0.5, sillY + height * 0.5, ortho, false);
      // Mullion grid bars for authentic Japanese kumiko/lattice feel (depth staggered)
      const bars = Math.max(1, Math.floor(width / 0.55));
      for (let b = 1; b <= bars; b++) {
        const bx = startW + (width * b) / (bars + 1);
        addBox(staticGroup, 0.024, innerH, 0.028, darkTimberMat, bx, sillY + height * 0.5, ortho, false);
      }
      addBox(staticGroup, width - frameT * 2, 0.024, 0.034, darkTimberMat, startW + width * 0.5, sillY + height * 0.5, ortho, false);
      const g = addBox(dynamicGroup, width - frameT * 2 - 0.008, innerH - 0.008, 0.016, glassMat, startW + width * 0.5, sillY + height * 0.5, ortho, false);
      g.userData.noBatch = true;
    } else {
      addBox(staticGroup, t + 0.03, frameT, width, darkTimberMat, ortho, sillY + frameT * 0.5, startW + width * 0.5, false);
      addBox(staticGroup, t + 0.03, frameT, width, darkTimberMat, ortho, sillY + height - frameT * 0.5, startW + width * 0.5, false);
      addBox(staticGroup, t + 0.03, innerH, frameT, darkTimberMat, ortho, sillY + height * 0.5, startW + frameT * 0.5, false);
      addBox(staticGroup, t + 0.03, innerH, frameT, darkTimberMat, ortho, sillY + height * 0.5, startW + width - frameT * 0.5, false);
      const bars = Math.max(1, Math.floor(width / 0.55));
      for (let b = 1; b <= bars; b++) {
        const bz = startW + (width * b) / (bars + 1);
        addBox(staticGroup, 0.028, innerH, 0.024, darkTimberMat, ortho, sillY + height * 0.5, bz, false);
      }
      addBox(staticGroup, 0.034, 0.024, width - frameT * 2, darkTimberMat, ortho, sillY + height * 0.5, startW + width * 0.5, false);
      const g = addBox(dynamicGroup, 0.016, innerH - 0.008, width - frameT * 2 - 0.008, glassMat, ortho, sillY + height * 0.5, startW + width * 0.5, false);
      g.userData.noBatch = true;
    }
  }

  /**
   * Builds one full exterior wall along 'north', 'south', 'west', or 'east' with exact cutouts
   * for doors and windows, two-tone lower/upper architectural cladding, and player wall colliders!
   */
  function buildExteriorWall(h, side, openings, intTex) {
    const t = 0.18;
    const isH = side === 'north' || side === 'south';
    const len = isH ? h.w : h.d;
    const baseY = gy + 0.14;
    const topY = gy + h.eaveH;
    const totalH = topY - baseY;
    const lowerH = Math.min(1.18, totalH * 0.42);
    const upperH = totalH - lowerH;

    const ortho = side === 'north'
      ? h.oz + t * 0.5
      : (side === 'south' ? h.oz + h.d - t * 0.5 : (side === 'west' ? h.ox + t * 0.5 : h.ox + h.w - t * 0.5));
    const startOrigin = isH ? h.ox : h.oz;

    // Determine frontTex/backTex orientation to match addVillageWallBox conventions:
    // axis 'h': frontTex = North (-Z), backTex = South (+Z)
    // axis 'v': frontTex = West (-X), backTex = East (+X)
    const extIsFront = side === 'north' || side === 'west';
    const sorted = [...openings].sort((a, b) => a.pos - b.pos);

    const addSolidSegment = (s0, s1) => {
      const segW = s1 - s0;
      if (segW < 0.04) return;
      const mid = startOrigin + (s0 + s1) * 0.5;
      // Lower wainscot masonry / yakisugi band
      const fLow = extIsFront ? h.extLowerTex : intTex;
      const bLow = extIsFront ? intTex : h.extLowerTex;
      if (isH) {
        addVillageWallBox(segW, lowerH, t, mid, baseY + lowerH * 0.5, ortho, fLow, bLow, 'h');
      } else {
        addVillageWallBox(t, lowerH, segW, ortho, baseY + lowerH * 0.5, mid, fLow, bLow, 'v');
      }
      // Upper plaster / timber wall
      const fUp = extIsFront ? h.extUpperTex : intTex;
      const bUp = extIsFront ? intTex : h.extUpperTex;
      if (isH) {
        addVillageWallBox(segW, upperH, t, mid, baseY + lowerH + upperH * 0.5, ortho, fUp, bUp, 'h');
      } else {
        addVillageWallBox(t, upperH, segW, ortho, baseY + lowerH + upperH * 0.5, mid, fUp, bUp, 'v');
      }
      // Horizontal cedar belt-course trim on exterior (shortened at ends to clear corner timber pillars)
      const trimOff = extIsFront ? -(t * 0.5 + 0.016) : (t * 0.5 + 0.016);
      const t0 = Math.max(s0, 0.22);
      const t1 = Math.min(s1, len - 0.22);
      if (t1 - t0 > 0.04) {
        const tMid = startOrigin + (t0 + t1) * 0.5;
        if (isH) {
          addBox(staticGroup, t1 - t0, 0.075, 0.032, darkTimberMat, tMid, baseY + lowerH, ortho + trimOff, false);
        } else {
          addBox(staticGroup, 0.032, 0.075, t1 - t0, darkTimberMat, ortho + trimOff, baseY + lowerH, tMid, false);
        }
      }
      // Exact wall collider
      if (isH) addCollider(1, startOrigin + s0, ortho - t * 0.5, startOrigin + s1, ortho + t * 0.5);
      else addCollider(1, ortho - t * 0.5, startOrigin + s0, ortho + t * 0.5, startOrigin + s1);
    };

    let cursor = 0.0;
    for (const op of sorted) {
      if (op.pos > cursor + 0.02) {
        addSolidSegment(cursor, op.pos);
      }
      const mid = startOrigin + op.pos + op.width * 0.5;
      if (op.kind === 'door') {
        // Header lintel above door
        const doorTop = baseY + op.height;
        const headH = topY - doorTop;
        if (headH > 0.04) {
          const fUp = extIsFront ? h.extUpperTex : intTex;
          const bUp = extIsFront ? intTex : h.extUpperTex;
          if (isH) addVillageWallBox(op.width, headH, t, mid, doorTop + headH * 0.5, ortho, fUp, bUp, 'h');
          else addVillageWallBox(t, headH, op.width, ortho, doorTop + headH * 0.5, mid, fUp, bUp, 'v');
        }
        // Register live automatic interactive door!
        const wallDef = isH
          ? { axis: 'h', x1: h.ox, x2: h.ox + h.w, z1: ortho - t * 0.5, z2: ortho + t * 0.5 }
          : { axis: 'v', x1: ortho - t * 0.5, x2: ortho + t * 0.5, z1: h.oz, z2: h.oz + h.d };
        addInteractiveDoor(1, {
          id: op.id,
          label: op.label,
          type: op.type,
          pos: startOrigin + op.pos,
          width: op.width,
          height: op.height,
          sill: 0,
          tex: op.tex,
          hinge: op.hinge,
          swingDir: op.swingDir,
          slideDir: op.slideDir,
        }, wallDef, baseY, staticGroup);
      } else if (op.kind === 'window') {
        // Sill wall below window + header above window + collider across window!
        const sillH = op.sill;
        if (sillH > 0.04) {
          const fLow = extIsFront ? h.extLowerTex : intTex;
          const bLow = extIsFront ? intTex : h.extLowerTex;
          if (isH) addVillageWallBox(op.width, sillH, t, mid, baseY + sillH * 0.5, ortho, fLow, bLow, 'h');
          else addVillageWallBox(t, sillH, op.width, ortho, baseY + sillH * 0.5, mid, fLow, bLow, 'v');
        }
        const winTop = baseY + op.sill + op.height;
        const headH = topY - winTop;
        if (headH > 0.04) {
          const fUp = extIsFront ? h.extUpperTex : intTex;
          const bUp = extIsFront ? intTex : h.extUpperTex;
          if (isH) addVillageWallBox(op.width, headH, t, mid, winTop + headH * 0.5, ortho, fUp, bUp, 'h');
          else addVillageWallBox(t, headH, op.width, ortho, winTop + headH * 0.5, mid, fUp, bUp, 'v');
        }
        addVillageWindow(h, side, op.pos, op.width, op.height, op.sill, op.frosted);
        if (isH) addCollider(1, startOrigin + op.pos, ortho - t * 0.5, startOrigin + op.pos + op.width, ortho + t * 0.5);
        else addCollider(1, ortho - t * 0.5, startOrigin + op.pos, ortho + t * 0.5, startOrigin + op.pos + op.width);
      }
      cursor = op.pos + op.width;
    }
    if (cursor < len - 0.02) {
      addSolidSegment(cursor, len);
    }
  }

  /**
   * Builds a pitched traditional Japanese gable roof (ridge along X) with overhanging eaves,
   * triangular gable infill walls, exposed dark timber rafters, heavy ridge beam, & oni-gawara finials!
   */
  function buildPitchedGableRoof(h) {
    const eaveY = gy + h.eaveH;
    const ridgeY = gy + h.ridgeH;
    const rise = ridgeY - eaveY;
    const halfSpan = h.d * 0.5;
    const overZ = 0.72;
    const overX = 0.65;
    const slopeRun = halfSpan + overZ;
    const slopeAngle = Math.atan2(rise, halfSpan);
    const slopeLen = Math.hypot(slopeRun, rise * (slopeRun / halfSpan));
    const roofW = h.w + overX * 2.0;
    const midX = h.ox + h.w * 0.5;
    const midZ = h.oz + h.d * 0.5;
    const roofT = 0.14;

    const roofMat = makeSurfaceMat(h.roofTex, roofW * 0.55, slopeLen * 0.55, { roughness: 0.72 });
    const soffitMat = makeSurfaceMat('wood_planks_dark', roofW * 0.5, slopeLen * 0.5, { roughness: 0.85 });
    const roofMats = [darkTimberMat, darkTimberMat, roofMat, soffitMat, darkTimberMat, darkTimberMat];

    // North & South pitched roof planes meeting cleanly inside the ceramic ridge cap (no ridge interpenetration)
    const slopeDropY = (slopeRun * 0.5) * Math.tan(slopeAngle);
    const centerY = ridgeY - slopeDropY + roofT * 0.4;
    const halfOffsetZ = slopeRun * 0.5 + 0.024;

    const northSlope = new THREE.Mesh(new THREE.BoxGeometry(roofW, roofT, slopeLen), roofMats);
    northSlope.position.set(midX, centerY, midZ - halfOffsetZ);
    northSlope.rotation.x = -slopeAngle;
    northSlope.castShadow = true;
    northSlope.receiveShadow = true;
    staticGroup.add(northSlope);

    const southSlope = new THREE.Mesh(new THREE.BoxGeometry(roofW, roofT, slopeLen), roofMats);
    southSlope.position.set(midX, centerY + 0.002, midZ + halfOffsetZ);
    southSlope.rotation.x = slopeAngle;
    southSlope.castShadow = true;
    southSlope.receiveShadow = true;
    staticGroup.add(southSlope);

    // Heavy Japanese ceramic ridge cap beam (大棟) + oni-gawara end tiles!
    addBox(staticGroup, roofW + 0.14, 0.24, 0.28, charcoalTileMat, midX, ridgeY + 0.12, midZ, true);
    addBox(staticGroup, 0.16, 0.36, 0.34, darkTimberMat, h.ox - overX - 0.05, ridgeY + 0.20, midZ, true);
    addBox(staticGroup, 0.16, 0.36, 0.34, darkTimberMat, h.ox + h.w + overX + 0.05, ridgeY + 0.20, midZ, true);

    // Triangular Gable End Walls (West & East)
    const gableGeo = buildGableTriangleGeo(h.d - 0.04, rise + 0.04, 0.18);
    const gableMat = makeSurfaceMat(h.extUpperTex, 2.0, 2.0);
    const westGable = new THREE.Mesh(gableGeo, gableMat);
    westGable.rotation.y = Math.PI * 0.5;
    westGable.position.set(h.ox + 0.09, eaveY, midZ);
    westGable.castShadow = true;
    westGable.receiveShadow = true;
    staticGroup.add(westGable);

    const eastGable = new THREE.Mesh(gableGeo.clone(), gableMat);
    eastGable.rotation.y = Math.PI * 0.5;
    eastGable.position.set(h.ox + h.w - 0.09, eaveY, midZ);
    eastGable.castShadow = true;
    eastGable.receiveShadow = true;
    staticGroup.add(eastGable);

    // Exposed structural corner timber pillars (柱) positioned proud of corner wall faces
    const pillarH = h.eaveH - 0.14;
    const py = gy + 0.14 + pillarH * 0.5;
    [
      [h.ox + 0.07, h.oz + 0.07],
      [h.ox + h.w - 0.07, h.oz + 0.07],
      [h.ox + 0.07, h.oz + h.d - 0.07],
      [h.ox + h.w - 0.07, h.oz + h.d - 0.07],
    ].forEach(([px, pz]) => {
      addBox(staticGroup, 0.22, pillarH, 0.22, darkTimberMat, px, py, pz, true);
    });
    // Interior exposed cedar ceiling & crossbeams (梁)
    addBox(staticGroup, h.w - 0.36, 0.08, h.d - 0.36, makeSurfaceMat('wood_planks_dark', h.w * 0.5, h.d * 0.5), midX, eaveY - 0.04, midZ, false);
    for (let bx = h.ox + 1.4; bx < h.ox + h.w - 0.9; bx += 1.8) {
      addBox(staticGroup, 0.16, 0.18, h.d - 0.36, darkTimberMat, bx, eaveY - 0.17, midZ, false);
    }
  }

  /**
   * Builds interior partition wall with automatic door cutout & colliders.
   */
  function buildInteriorPartition(h, part, wallTex) {
    const baseY = h.floorY;
    const topY = gy + h.eaveH - 0.08;
    const totalH = topY - baseY;
    const t = 0.12;
    const wx = h.ox + part.coord;
    const len = h.d - 0.36;
    const zStart = h.oz + 0.18;
    const dPos = part.pos - 0.18;
    const dEnd = dPos + part.width;

    if (dPos > 0.04) {
      addVillageWallBox(t, totalH, dPos, wx, baseY + totalH * 0.5, zStart + dPos * 0.5, wallTex, wallTex, 'v');
      addCollider(1, wx - t * 0.5, zStart, wx + t * 0.5, zStart + dPos);
    }
    if (len - dEnd > 0.04) {
      const seg = len - dEnd;
      addVillageWallBox(t, totalH, seg, wx, baseY + totalH * 0.5, zStart + dEnd + seg * 0.5, wallTex, wallTex, 'v');
      addCollider(1, wx - t * 0.5, zStart + dEnd, wx + t * 0.5, zStart + len);
    }
    const doorTop = baseY + part.height;
    if (topY - doorTop > 0.04) {
      addVillageWallBox(t, topY - doorTop, part.width, wx, doorTop + (topY - doorTop) * 0.5, h.oz + part.pos + part.width * 0.5, wallTex, wallTex, 'v');
    }
    addInteractiveDoor(1, {
      id: part.id,
      label: part.label,
      type: part.type,
      pos: h.oz + part.pos,
      width: part.width,
      height: part.height,
      sill: 0,
      tex: part.tex,
      hinge: part.hinge,
      swingDir: part.swingDir,
      slideDir: part.slideDir,
    }, { axis: 'v', x1: wx - t * 0.5, x2: wx + t * 0.5, z1: h.oz, z2: h.oz + h.d }, baseY, staticGroup);
  }

  /**
   * Helper: Traditional Japanese Village Stone & Cedar Lantern (常夜灯)
   */
  function addVillageLantern(lx, lz, withLight = false, lightName = '') {
    const stoneMat = makeSurfaceMat('stone_cistern_grey', 0.6, 0.8);
    addBox(staticGroup, 0.42, 0.20, 0.42, stoneMat, lx, gy + 0.10, lz, true);
    addBox(staticGroup, 0.16, 1.38, 0.16, darkTimberMat, lx, gy + 0.89, lz, true);
    addBox(staticGroup, 0.34, 0.34, 0.34, lanternGlowMat, lx, gy + 1.72, lz, false);
    // Lattice cage bars
    addBox(staticGroup, 0.38, 0.05, 0.38, darkTimberMat, lx, gy + 1.54, lz, false);
    addBox(staticGroup, 0.38, 0.05, 0.38, darkTimberMat, lx, gy + 1.90, lz, false);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.24, 4), charcoalTileMat);
    cap.rotation.y = Math.PI * 0.25;
    cap.position.set(lx, gy + 2.04, lz);
    cap.castShadow = true;
    staticGroup.add(cap);
    addCollider(1, lx - 0.22, lz - 0.22, lx + 0.22, lz + 0.22);
    if (withLight) {
      addVLight(lightName, 'plaza', 0xffb764, 2.2, 16.0, lx, gy + 1.75, lz);
    }
  }

  /**
   * Helper: Hanging Paper Pendant Lamp inside a house
   */
  function addCeilingPendant(x, ceilY, z, houseId, lightName, color = 0xffca88, inten = 2.4, dist = 10.5) {
    addBox(staticGroup, 0.024, 0.42, 0.024, darkTimberMat, x, ceilY - 0.22, z, false);
    addBox(staticGroup, 0.34, 0.24, 0.34, lanternGlowMat, x, ceilY - 0.52, z, false);
    addBox(staticGroup, 0.38, 0.03, 0.38, darkTimberMat, x, ceilY - 0.40, z, false);
    addBox(staticGroup, 0.38, 0.03, 0.38, darkTimberMat, x, ceilY - 0.64, z, false);
    addVLight(lightName, houseId, color, inten, dist, x, ceilY - 0.65, z);
  }

  // =========================================================================
  // 1. VILLAGE STONE LANE, CENTRAL PLAZA, PARKING BAY & STEPPING PATHS
  // =========================================================================
  const laneW = VILLAGE.lane.maxX - VILLAGE.lane.minX;
  const laneD = VILLAGE.lane.maxZ - VILLAGE.lane.minZ;
  addBox(
    staticGroup,
    laneW,
    0.06,
    laneD,
    makeSurfaceMat('paver_granite_grid', laneW * 0.45, laneD * 0.45, { roughness: 0.88 }),
    (VILLAGE.lane.minX + VILLAGE.lane.maxX) * 0.5,
    gy + 0.02,
    (VILLAGE.lane.minZ + VILLAGE.lane.maxZ) * 0.5,
    false,
  );
  // River-cobble curb edgings along main village lane
  const curbMat = makeSurfaceMat('cobble_river', 16.0, 0.5, { roughness: 0.86 });
  addBox(staticGroup, laneW, 0.09, 0.34, curbMat, (VILLAGE.lane.minX + VILLAGE.lane.maxX) * 0.5, gy + 0.04, VILLAGE.lane.minZ - 0.16, false);
  addBox(staticGroup, laneW, 0.09, 0.34, curbMat, (VILLAGE.lane.minX + VILLAGE.lane.maxX) * 0.5, gy + 0.04, VILLAGE.lane.maxZ + 0.16, false);

  // Central Village Stone Plaza
  const plazaW = VILLAGE.plaza.maxX - VILLAGE.plaza.minX;
  const plazaD = VILLAGE.plaza.maxZ - VILLAGE.plaza.minZ;
  addBox(
    staticGroup,
    plazaW,
    0.055,
    plazaD,
    makeSurfaceMat('paver_moss_stones', plazaW * 0.38, plazaD * 0.38, { roughness: 0.90 }),
    (VILLAGE.plaza.minX + VILLAGE.plaza.maxX) * 0.5,
    gy + 0.015,
    (VILLAGE.plaza.minZ + VILLAGE.plaza.maxZ) * 0.5,
    false,
  );

  // Gravel Vehicle Parking Bay right off the Forestry Road (wide enough for KEI-340 & CAMPER-75!)
  const parkW = VILLAGE.parking.maxX - VILLAGE.parking.minX;
  const parkD = VILLAGE.parking.maxZ - VILLAGE.parking.minZ;
  addBox(
    staticGroup,
    parkW,
    0.05,
    parkD,
    makeSurfaceMat('cobble_river', parkW * 0.5, parkD * 0.5, { roughness: 0.92 }),
    (VILLAGE.parking.minX + VILLAGE.parking.maxX) * 0.5,
    gy + 0.012,
    (VILLAGE.parking.minZ + VILLAGE.parking.maxZ) * 0.5,
    false,
  );
  // Timber wheel stops along South edge of parking bay
  addBox(staticGroup, 2.2, 0.14, 0.16, warmCedarMat, VILLAGE.parking.minX + 2.4, gy + 0.07, VILLAGE.parking.maxZ - 0.4, true);
  addBox(staticGroup, 2.2, 0.14, 0.16, warmCedarMat, VILLAGE.parking.minX + 6.4, gy + 0.07, VILLAGE.parking.maxZ - 0.4, true);

  // =========================================================================
  // 2. BUILD ALL 5 DISTINCT ENTERABLE HOUSES OF SUGINOSATO VILLAGE!
  // =========================================================================
  const [h1, h2, h3, h4, h5] = VILLAGE_HOUSES;

  // --- Shared base foundation plinth + stepping-stone walkway helper ---
  function buildHouseFoundationAndPath(h, plinthTex) {
    // Ground foundation plinth (top at gy+0.12 — strictly below domaY gy+0.14..0.16 so zero Z-fighting!)
    addBox(staticGroup, h.w + 0.24, 0.26, h.d + 0.24, makeSurfaceMat(plinthTex, h.w * 0.6, 0.5), h.ox + h.w * 0.5, gy - 0.01, h.oz + h.d * 0.5, true);
    // Entry porch slab
    if (h.porch) {
      const pw = h.porch.maxX - h.porch.minX;
      const pd = h.porch.maxZ - h.porch.minZ;
      const pTex = h.style === 'kominka' ? 'wood_deck' : 'paver_granite_grid';
      const ph = h.porch.y - gy;
      addBox(staticGroup, pw, ph + 0.08, pd, makeSurfaceMat(pTex, pw * 0.6, pd * 0.6), (h.porch.minX + h.porch.maxX) * 0.5, gy + ph * 0.5 - 0.04, (h.porch.minZ + h.porch.maxZ) * 0.5, true);
    }
    // Stepping-stone approach path to main village lane
    const doorCenterX = h.ox + h.door.pos + h.door.width * 0.5;
    const zFrom = h.facing === 'south' ? h.oz + h.d + 0.2 : VILLAGE.lane.maxZ;
    const zTo = h.facing === 'south' ? VILLAGE.lane.minZ : h.oz - 0.2;
    const pLen = Math.abs(zTo - zFrom);
    if (pLen > 0.4) {
      addBox(
        staticGroup,
        1.85,
        0.05,
        pLen,
        makeSurfaceMat('paver_moss_stones', 1.2, pLen * 0.55),
        doorCenterX,
        gy + 0.018,
        (zFrom + zTo) * 0.5,
        false,
      );
    }
  }

  // -------------------------------------------------------------------------
  // HOUSE 1 (V1): 庄屋・古民家 (Traditional Timber Kominka with Irori Hearth!)
  // -------------------------------------------------------------------------
  buildHouseFoundationAndPath(h1, 'stone_moss_wall');
  // Interior Floors: Doma (east), Irori Cedar Hall (center), Tatami Parlor (west)
  addBox(staticGroup, 3.45, 0.04, h1.d - 0.30, makeSurfaceMat('paver_granite_grid', 2.4, 4.2), h1.ox + 7.12, h1.domaY - 0.02, h1.oz + h1.d * 0.5, false);
  addBox(staticGroup, 2.55, 0.22, h1.d - 0.30, makeSurfaceMat('wood_walnut_floor', 2.2, 4.2), h1.ox + 4.12, h1.floorY - 0.11, h1.oz + h1.d * 0.5, false);
  addBox(staticGroup, 2.75, 0.22, h1.d - 0.30, makeSurfaceMat('tatami', 2.2, 4.2), h1.ox + 1.50, h1.floorY - 0.11, h1.oz + h1.d * 0.5, false);
  // Step-up timber curb (上がり框) between Doma & Irori hall
  addBox(staticGroup, 0.14, 0.22, h1.d - 0.36, darkTimberMat, h1.ox + 5.38, h1.floorY - 0.10, h1.oz + h1.d * 0.5, false);

  buildExteriorWall(h1, 'south', [
    { kind: 'window', pos: 0.75, width: 1.70, height: 1.35, sill: 0.72 },
    { kind: 'window', pos: 3.30, width: 1.65, height: 1.35, sill: 0.72 },
    { kind: 'door', ...h1.door },
  ], 'plaster_beige');
  buildExteriorWall(h1, 'north', [
    { kind: 'window', pos: 0.90, width: 1.40, height: 1.10, sill: 0.95 },
    { kind: 'window', pos: 6.20, width: 1.40, height: 1.05, sill: 0.98 },
  ], 'plaster_beige');
  buildExteriorWall(h1, 'west', [
    { kind: 'window', pos: 2.10, width: 1.60, height: 1.20, sill: 0.85, frosted: true },
  ], 'plaster_beige');
  buildExteriorWall(h1, 'east', [
    { kind: 'window', pos: 1.85, width: 1.50, height: 1.15, sill: 0.88 },
  ], 'plaster_beige');
  buildInteriorPartition(h1, h1.innerDoor, 'shikkui_white');
  buildPitchedGableRoof(h1);

  // V1 South Engawa Veranda Timber Posts & Front Porch Awning Beam
  [h1.porch.minX + 0.14, (h1.porch.minX + h1.porch.maxX) * 0.5, h1.porch.maxX - 0.14].forEach((px) => {
    addBox(staticGroup, 0.14, h1.eaveH - 0.26, 0.14, darkTimberMat, px, h1.porch.y + (h1.eaveH - 0.26) * 0.5, h1.porch.maxZ - 0.10, true);
  });
  addBox(staticGroup, h1.porch.maxX - h1.porch.minX + 0.2, 0.14, 1.35, charcoalTileMat, (h1.porch.minX + h1.porch.maxX) * 0.5, gy + h1.eaveH - 0.15, h1.porch.maxZ - 0.55, true);

  // V1 Interior Craft: Sunken Irori Hearth (囲炉裏), Hanging Kettle, Zabuton, Kamado, & Tansu Chest!
  const irX = h1.ox + 4.10;
  const irZ = h1.oz + 3.25;
  addBox(staticGroup, 1.32, 0.12, 1.32, darkTimberMat, irX, h1.floorY + 0.05, irZ, true);
  addBox(staticGroup, 0.98, 0.08, 0.98, makeSurfaceMat('stone_cistern_grey', 1, 1), irX, h1.floorY + 0.08, irZ, false);
  addBox(staticGroup, 0.44, 0.10, 0.44, emberGlowMat, irX, h1.floorY + 0.12, irZ, false);
  // Suspended iron kettle (自在鉤)
  addBox(staticGroup, 0.04, 1.85, 0.04, ironKettleMat, irX, gy + h1.eaveH - 1.05, irZ, false);
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), ironKettleMat);
  kettle.scale.set(1.1, 0.78, 1.1);
  kettle.position.set(irX, h1.floorY + 0.54, irZ);
  staticGroup.add(kettle);
  addCollider(1, irX - 0.66, irZ - 0.66, irX + 0.66, irZ + 0.66);
  // 4 Red Zabuton floor cushions around the hearth
  const zabMat = makeFrontMat('zabuton_red', { roughness: 0.9 });
  [[0, -0.96], [0, 0.96], [-0.92, 0]].forEach(([dx, dz]) => {
    addBox(staticGroup, 0.52, 0.07, 0.52, zabMat, irX + dx, h1.floorY + 0.035, irZ + dz, false);
  });
  // Tatami Guest Parlor low table, zabuton, tansu chest, & hanging art scroll
  addBox(staticGroup, 1.25, 0.34, 0.78, darkTimberMat, h1.ox + 1.45, h1.floorY + 0.17, h1.oz + 3.40, true);
  addCollider(1, h1.ox + 0.82, h1.oz + 3.00, h1.ox + 2.08, h1.oz + 3.80);
  addBox(staticGroup, 0.52, 0.07, 0.52, zabMat, h1.ox + 1.45, h1.floorY + 0.035, h1.oz + 2.65, false);
  addBox(staticGroup, 0.52, 0.07, 0.52, zabMat, h1.ox + 1.45, h1.floorY + 0.035, h1.oz + 4.15, false);
  addBox(staticGroup, 1.15, 0.95, 0.46, makeFrontMat('furniture_chest'), h1.ox + 1.35, h1.floorY + 0.48, h1.oz + 0.48, true);
  addBox(staticGroup, 0.04, 1.15, 0.68, makeFrontMat('art_poster_1'), h1.ox + 0.22, h1.floorY + 1.48, h1.oz + 1.35, false);
  // Doma Kamado hearth & kitchen cabinet
  addBox(staticGroup, 1.45, 0.84, 0.58, makeFrontMat('furniture_kitchen_cab'), h1.ox + 7.45, h1.domaY + 0.42, h1.oz + 0.52, true);
  addCollider(1, h1.ox + 6.72, h1.oz + 0.22, h1.ox + 8.18, h1.oz + 0.82);
  // V1 Yard Firewood Rack on West side
  addBox(staticGroup, 0.72, 1.45, 2.40, makeSurfaceMat('timber_logs', 1.8, 1.4), h1.ox - 0.52, gy + 0.72, h1.oz + 3.20, true);
  addBox(staticGroup, 1.05, 0.08, 2.65, charcoalTileMat, h1.ox - 0.52, gy + 1.54, h1.oz + 3.20, true);
  addCollider(1, h1.ox - 0.92, h1.oz + 1.95, h1.ox - 0.12, h1.oz + 4.45);
  // Warm interior pendant & hearth light
  addCeilingPendant(irX, gy + h1.eaveH - 0.08, irZ, h1.id, 'V1_Irori_Lamp', 0xffb868, 2.8, 12.5);

  // -------------------------------------------------------------------------
  // HOUSE 2 (V2): 茶房・渓流庵 (Riverside Tea & Soba House with Indigo Noren!)
  // -------------------------------------------------------------------------
  buildHouseFoundationAndPath(h2, 'stone_cistern_grey');
  addBox(staticGroup, 2.38, 0.22, h2.d - 0.30, makeSurfaceMat('tatami_ryukyu', 2.0, 4.0), h2.ox + 1.36, h2.floorY - 0.11, h2.oz + h2.d * 0.5, false);
  addBox(staticGroup, 4.90, 0.06, h2.d - 0.30, makeSurfaceMat('wood_floor', 3.4, 4.0), h2.ox + 5.02, h2.domaY - 0.03, h2.oz + h2.d * 0.5, false);

  buildExteriorWall(h2, 'south', [
    { kind: 'window', pos: 0.70, width: 1.80, height: 1.30, sill: 0.75 },
    { kind: 'door', ...h2.door },
    { kind: 'window', pos: 5.05, width: 1.85, height: 1.30, sill: 0.75 },
  ], 'plaster_ochre');
  buildExteriorWall(h2, 'north', [
    { kind: 'window', pos: 2.80, width: 1.80, height: 1.05, sill: 1.00 },
  ], 'plaster_ochre');
  buildExteriorWall(h2, 'west', [
    { kind: 'window', pos: 1.90, width: 1.65, height: 1.25, sill: 0.80 },
  ], 'plaster_ochre');
  buildExteriorWall(h2, 'east', [
    { kind: 'window', pos: 1.80, width: 1.80, height: 1.25, sill: 0.80 },
  ], 'plaster_ochre');
  buildPitchedGableRoof(h2);

  // Indigo Noren Shop Curtain (暖簾) & Outdoor Resting Bench at V2 entrance!
  const norenMat = makeFrontMat('fabric_denim', { roughness: 0.92 });
  const doorCX2 = h2.ox + h2.door.pos + h2.door.width * 0.5;
  addBox(staticGroup, 1.56, 0.04, 0.04, bambooMat, doorCX2, gy + 2.24, h2.oz + h2.d + 0.18, false);
  for (let ni = -1; ni <= 1; ni++) {
    addBox(staticGroup, 0.42, 0.52, 0.02, norenMat, doorCX2 + ni * 0.46, gy + 1.96, h2.oz + h2.d + 0.18, true);
  }
  // Glowing red-amber tea house shop lantern beside door
  addBox(staticGroup, 0.24, 0.42, 0.24, lanternGlowMat, h2.ox + h2.door.pos - 0.36, gy + 2.02, h2.oz + h2.d + 0.24, false);
  // Outdoor tasting bench on porch
  addBox(staticGroup, 1.65, 0.44, 0.44, warmCedarMat, h2.ox + 5.90, h2.porch.y + 0.22, h2.oz + h2.d + 0.42, true);
  addCollider(1, h2.ox + 5.05, h2.oz + h2.d + 0.18, h2.ox + 6.75, h2.oz + h2.d + 0.66);

  // V2 Interior: Kitchen counter, dining tables with meal_teishoku trays, tatami tea table, clock!
  addBox(staticGroup, 3.60, 0.88, 0.64, makeFrontMat('furniture_kitchen_cab'), h2.ox + 5.20, h2.domaY + 0.44, h2.oz + 0.54, true);
  addCollider(1, h2.ox + 3.40, h2.oz + 0.22, h2.ox + 7.00, h2.oz + 0.86);
  // Two dining tables + benches
  const mealMat = makeFrontMat('meal_teishoku');
  [h2.oz + 2.25, h2.oz + 4.15].forEach((tz) => {
    addBox(staticGroup, 1.22, 0.72, 0.72, warmCedarMat, h2.ox + 5.75, h2.domaY + 0.36, tz, true);
    addBox(staticGroup, 0.44, 0.03, 0.32, mealMat, h2.ox + 5.65, h2.domaY + 0.74, tz, false);
    addCollider(1, h2.ox + 5.12, tz - 0.38, h2.ox + 6.38, tz + 0.38);
  });
  // Raised Ryukyu tatami tea nook
  addBox(staticGroup, 1.10, 0.34, 0.76, darkTimberMat, h2.ox + 1.30, h2.floorY + 0.17, h2.oz + 2.90, true);
  addCollider(1, h2.ox + 0.74, h2.oz + 2.50, h2.ox + 1.86, h2.oz + 3.30);
  addBox(staticGroup, 0.46, 0.06, 0.46, zabMat, h2.ox + 1.30, h2.floorY + 0.03, h2.oz + 2.15, false);
  addBox(staticGroup, 0.46, 0.06, 0.46, zabMat, h2.ox + 1.30, h2.floorY + 0.03, h2.oz + 3.65, false);
  addBox(staticGroup, 0.42, 0.42, 0.04, makeFrontMat('prop_wall_clock'), h2.ox + 1.35, h2.floorY + 1.82, h2.oz + 0.22, false);
  addCeilingPendant(h2.ox + 4.20, gy + h2.eaveH - 0.08, h2.oz + 2.90, h2.id, 'V2_Teahouse_Lamp', 0xffcb80, 2.7, 11.5);

  // -------------------------------------------------------------------------
  // HOUSE 3 (V3): 木工・林業小屋 (Forester & Carpenter's Timber House!)
  // -------------------------------------------------------------------------
  buildHouseFoundationAndPath(h3, 'stone_moss_wall');
  addBox(staticGroup, 3.85, 0.04, h3.d - 0.30, makeSurfaceMat('concrete_clean', 2.6, 3.6), h3.ox + 2.10, h3.domaY - 0.02, h3.oz + h3.d * 0.5, false);
  addBox(staticGroup, 3.20, 0.22, h3.d - 0.30, makeSurfaceMat('wood_scratched_cedar', 2.4, 3.6), h3.ox + 5.65, h3.floorY - 0.11, h3.oz + h3.d * 0.5, false);

  buildExteriorWall(h3, 'north', [
    { kind: 'door', ...h3.door },
    { kind: 'window', pos: 4.55, width: 1.85, height: 1.25, sill: 0.78 },
  ], 'wainscot_rustic');
  buildExteriorWall(h3, 'south', [
    { kind: 'window', pos: 1.15, width: 1.65, height: 1.15, sill: 0.90 },
    { kind: 'window', pos: 4.70, width: 1.60, height: 1.20, sill: 0.85 },
  ], 'wainscot_rustic');
  buildExteriorWall(h3, 'west', [
    { kind: 'window', pos: 1.80, width: 1.60, height: 1.10, sill: 0.95 },
  ], 'wainscot_rustic');
  buildExteriorWall(h3, 'east', [
    { kind: 'window', pos: 1.85, width: 1.55, height: 1.20, sill: 0.85 },
  ], 'wainscot_rustic');
  buildInteriorPartition(h3, h3.innerDoor, 'wainscot_wood');
  buildPitchedGableRoof(h3);

  // V3 Carpentry Workshop Interior: heavy workbench, pegboard tool wall, crates, & lumber!
  addBox(staticGroup, 2.20, 0.86, 0.76, warmCedarMat, h3.ox + 2.05, h3.domaY + 0.43, h3.oz + 4.85, true);
  addCollider(1, h3.ox + 0.95, h3.oz + 4.45, h3.ox + 3.15, h3.oz + 5.25);
  addBox(staticGroup, 1.95, 1.05, 0.05, makeFrontMat('pegboard_wood'), h3.ox + 2.05, h3.domaY + 1.56, h3.oz + 5.36, false);
  addBox(staticGroup, 0.65, 0.65, 0.65, makeSurfaceMat('crate_wood', 1, 1), h3.ox + 0.60, h3.domaY + 0.33, h3.oz + 2.60, true);
  addBox(staticGroup, 0.56, 0.62, 0.56, makeSurfaceMat('burlap_sack', 1, 1), h3.ox + 0.60, h3.domaY + 0.31, h3.oz + 3.45, true);
  addCollider(1, h3.ox + 0.25, h3.oz + 2.22, h3.ox + 0.96, h3.oz + 3.80);
  // V3 East Forester's Quarters: wood stove, bed with quilt, bookshelf!
  addBox(staticGroup, 0.52, 0.64, 0.52, ironKettleMat, h3.ox + 4.55, h3.floorY + 0.32, h3.oz + 0.68, true);
  addBox(staticGroup, 0.14, 2.15, 0.14, ironKettleMat, h3.ox + 4.55, h3.floorY + 1.55, h3.oz + 0.68, false);
  addBox(staticGroup, 0.22, 0.22, 0.04, emberGlowMat, h3.ox + 4.55, h3.floorY + 0.36, h3.oz + 0.95, false);
  addBox(staticGroup, 1.25, 0.48, 2.05, makeFrontMat('fabric_floral_quilt'), h3.ox + 6.38, h3.floorY + 0.24, h3.oz + 4.20, true);
  addCollider(1, h3.ox + 5.74, h3.oz + 3.16, h3.ox + 7.05, h3.oz + 5.25);
  addBox(staticGroup, 0.44, 1.65, 1.15, makeFrontMat('furniture_bookshelf'), h3.ox + 6.95, h3.floorY + 0.83, h3.oz + 1.45, true);
  addBox(staticGroup, 0.45, 0.58, 0.04, makeFrontMat('prop_calendar'), h3.ox + 5.55, h3.floorY + 1.58, h3.oz + 0.22, false);
  // Outdoor Cedar Timber Log Stack on West yard!
  addBox(staticGroup, 0.95, 1.15, 2.60, makeSurfaceMat('timber_logs', 1.6, 1.2), h3.ox - 0.72, gy + 0.58, h3.oz + 2.80, true);
  addCollider(1, h3.ox - 1.22, h3.oz + 1.48, h3.ox - 0.22, h3.oz + 4.12);
  addCeilingPendant(h3.ox + 2.40, gy + h3.eaveH - 0.08, h3.oz + 2.80, h3.id, 'V3_Woodshop_Lamp', 0xffd194, 2.5, 11.0);

  // -------------------------------------------------------------------------
  // HOUSE 4 (V4): 山荘・苔庭の家 (Sage-Plaster Modern-Japanese Mountain Residence!)
  // -------------------------------------------------------------------------
  buildHouseFoundationAndPath(h4, 'stone_cistern_grey');
  addBox(staticGroup, 2.75, 0.04, 1.85, makeSurfaceMat('paver_granite_grid', 2.0, 1.4), h4.ox + 1.52, h4.domaY - 0.02, h4.oz + 1.05, false);
  addBox(staticGroup, 4.45, 0.22, 3.90, makeSurfaceMat('parquet_oak', 3.0, 2.8), h4.ox + 2.40, h4.floorY - 0.11, h4.oz + 3.90, false);
  addBox(staticGroup, 1.75, 0.22, 1.85, makeSurfaceMat('parquet_oak', 1.2, 1.4), h4.ox + 3.75, h4.floorY - 0.11, h4.oz + 1.05, false);
  addBox(staticGroup, 3.00, 0.22, h4.d - 0.30, makeSurfaceMat('tatami_aged', 2.2, 4.0), h4.ox + 6.16, h4.floorY - 0.11, h4.oz + h4.d * 0.5, false);

  buildExteriorWall(h4, 'north', [
    { kind: 'door', ...h4.door },
    { kind: 'window', pos: 3.15, width: 1.25, height: 1.25, sill: 0.78 },
    { kind: 'window', pos: 5.20, width: 1.75, height: 1.25, sill: 0.78 },
  ], 'wallpaper_white');
  buildExteriorWall(h4, 'south', [
    { kind: 'window', pos: 0.95, width: 2.40, height: 1.40, sill: 0.68 },
    { kind: 'window', pos: 5.05, width: 1.95, height: 1.35, sill: 0.72 },
  ], 'wallpaper_white');
  buildExteriorWall(h4, 'west', [
    { kind: 'window', pos: 2.35, width: 1.75, height: 1.20, sill: 0.85 },
  ], 'wallpaper_white');
  buildExteriorWall(h4, 'east', [
    { kind: 'window', pos: 2.00, width: 1.80, height: 1.25, sill: 0.80 },
  ], 'wallpaper_white');
  buildInteriorPartition(h4, h4.innerDoor, 'plaster_sage');
  buildPitchedGableRoof(h4);

  // V4 Interior: Sofa, coffee table, TV console, fridge/kitchenette, tatami bedroom wardrobe & futon!
  addBox(staticGroup, 1.95, 0.76, 0.82, makeSurfaceMat('fabric_grey_sofa', 1.6, 1.0), h4.ox + 2.35, h4.floorY + 0.38, h4.oz + 5.18, true);
  addCollider(1, h4.ox + 1.36, h4.oz + 4.76, h4.ox + 3.34, h4.oz + 5.62);
  addBox(staticGroup, 1.15, 0.38, 0.60, mat.walnut, h4.ox + 2.35, h4.floorY + 0.19, h4.oz + 4.05, true);
  addBox(staticGroup, 1.15, 0.62, 0.42, mat.walnut, h4.ox + 2.35, h4.floorY + 0.31, h4.oz + 2.45, true);
  addBox(staticGroup, 0.96, 0.56, 0.08, makeFrontMat('appliance_tv'), h4.ox + 2.35, h4.floorY + 0.90, h4.oz + 2.42, false);
  addCollider(1, h4.ox + 1.76, h4.oz + 2.22, h4.ox + 2.94, h4.oz + 2.68);
  addBox(staticGroup, 0.66, 1.68, 0.66, makeFrontMat('appliance_fridge'), h4.ox + 0.58, h4.floorY + 0.84, h4.oz + 2.55, true);
  addCollider(1, h4.ox + 0.22, h4.oz + 2.20, h4.ox + 0.94, h4.oz + 2.90);
  // East Tatami Bedroom
  addBox(staticGroup, 1.35, 0.20, 2.05, makeFrontMat('fabric_sakura'), h4.ox + 6.45, h4.floorY + 0.10, h4.oz + 4.45, false);
  addBox(staticGroup, 1.25, 1.85, 0.52, makeFrontMat('furniture_wardrobe'), h4.ox + 6.25, h4.floorY + 0.92, h4.oz + 0.48, true);
  addCollider(1, h4.ox + 5.62, h4.oz + 0.20, h4.ox + 6.88, h4.oz + 0.78);
  addBox(staticGroup, 0.68, 0.92, 0.04, makeFrontMat('art_poster_2'), h4.ox + 3.70, h4.floorY + 1.55, h4.oz + 0.22, false);
  addCeilingPendant(h4.ox + 3.05, gy + h4.eaveH - 0.08, h4.oz + 3.40, h4.id, 'V4_Residence_Lamp', 0xffe2b4, 2.5, 11.5);

  // -------------------------------------------------------------------------
  // HOUSE 5 (V5): 蔵造り・石倉の民家 (Kura-Style Stone & White-Plaster Homestead!)
  // -------------------------------------------------------------------------
  buildHouseFoundationAndPath(h5, 'stone_grey_block');
  addBox(staticGroup, h5.w - 0.30, 0.04, 2.35, makeSurfaceMat('tile_checker_stone', 4.2, 1.8), h5.ox + h5.w * 0.5, h5.domaY - 0.02, h5.oz + 4.30, false);
  addBox(staticGroup, h5.w - 0.30, 0.22, 3.00, makeSurfaceMat('wood_walnut_floor', 4.2, 2.2), h5.ox + h5.w * 0.5, h5.floorY - 0.11, h5.oz + 1.65, false);
  addBox(staticGroup, h5.w - 0.36, 0.22, 0.14, darkTimberMat, h5.ox + h5.w * 0.5, h5.floorY - 0.10, h5.oz + 3.16, false);

  buildExteriorWall(h5, 'south', [
    { kind: 'window', pos: 0.70, width: 1.40, height: 1.15, sill: 0.95 },
    { kind: 'door', ...h5.door },
    { kind: 'window', pos: 4.70, width: 1.40, height: 1.15, sill: 0.95 },
  ], 'shikkui_white');
  buildExteriorWall(h5, 'north', [
    { kind: 'window', pos: 2.30, width: 2.15, height: 1.25, sill: 0.88 },
  ], 'shikkui_white');
  buildExteriorWall(h5, 'west', [
    { kind: 'window', pos: 1.00, width: 1.50, height: 1.15, sill: 0.92 },
  ], 'shikkui_white');
  buildExteriorWall(h5, 'east', [
    // Wide scenic East window framing the emerald Kurosugigawa river gorge!
    { kind: 'window', pos: 0.85, width: 2.00, height: 1.35, sill: 0.78 },
  ], 'shikkui_white');
  buildPitchedGableRoof(h5);

  // V5 Interior: Kura grain sacks & crates (South stone storehouse) + Walnut scholar's study (North)
  addBox(staticGroup, 0.62, 0.70, 0.62, makeSurfaceMat('burlap_sack', 1, 1), h5.ox + 0.68, h5.domaY + 0.35, h5.oz + 4.95, true);
  addBox(staticGroup, 0.62, 0.70, 0.62, makeSurfaceMat('burlap_sack', 1, 1), h5.ox + 1.38, h5.domaY + 0.35, h5.oz + 4.95, true);
  addBox(staticGroup, 0.76, 0.74, 0.64, makeSurfaceMat('crate_wood', 1, 1), h5.ox + 5.95, h5.domaY + 0.37, h5.oz + 4.90, true);
  addCollider(1, h5.ox + 0.30, h5.oz + 4.55, h5.ox + 1.75, h5.oz + 5.32);
  addCollider(1, h5.ox + 5.52, h5.oz + 4.52, h5.ox + 6.42, h5.oz + 5.30);
  // North Walnut Study: twin bookshelves, writing desk, chair, framed print
  addBox(staticGroup, 1.35, 1.95, 0.44, makeFrontMat('furniture_bookshelf'), h5.ox + 1.05, h5.floorY + 0.98, h5.oz + 0.44, true);
  addBox(staticGroup, 1.35, 1.95, 0.44, makeFrontMat('furniture_bookshelf'), h5.ox + 5.60, h5.floorY + 0.98, h5.oz + 0.44, true);
  addCollider(1, h5.ox + 0.35, h5.oz + 0.20, h5.ox + 1.75, h5.oz + 0.68);
  addCollider(1, h5.ox + 4.90, h5.oz + 0.20, h5.ox + 6.30, h5.oz + 0.68);
  addBox(staticGroup, 1.55, 0.76, 0.76, mat.walnut, h5.ox + 3.40, h5.floorY + 0.38, h5.oz + 1.60, true);
  addCollider(1, h5.ox + 2.60, h5.oz + 1.20, h5.ox + 4.20, h5.oz + 2.00);
  addBox(staticGroup, 0.04, 0.96, 0.68, makeFrontMat('art_poster_3'), h5.ox + 0.22, h5.floorY + 1.55, h5.oz + 2.65, false);
  addCeilingPendant(h5.ox + 3.40, gy + h5.eaveH - 0.08, h5.oz + 2.55, h5.id, 'V5_Kura_Lamp', 0xffd79c, 2.5, 11.0);

  // =========================================================================
  // 3. CENTRAL PLAZA: COVERED MOUNTAIN SPRING WELL (水場・井戸) & BENCHES
  // =========================================================================
  const wx = VILLAGE.well.x;
  const wz = VILLAGE.well.z;
  const stoneWellMat = makeSurfaceMat('stone_moss_wall', 2.2, 0.8);
  // Circular/octagonal stone spring basin
  const wellCurb = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.28, 0.78, 8), stoneWellMat);
  wellCurb.position.set(wx, gy + 0.39, wz);
  wellCurb.castShadow = true;
  wellCurb.receiveShadow = true;
  staticGroup.add(wellCurb);
  const wellWater = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.08, 16), springWaterMat);
  wellWater.position.set(wx, gy + 0.68, wz);
  staticGroup.add(wellWater);
  // Bamboo mountain spring water spout (筧 / かけひ)
  addBox(staticGroup, 0.14, 1.28, 0.14, darkTimberMat, wx - 1.38, gy + 0.64, wz, true);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.25, 8), bambooMat);
  spout.rotation.z = Math.PI * 0.44;
  spout.position.set(wx - 0.88, gy + 1.12, wz);
  staticGroup.add(spout);
  // 4 cedar canopy pillars + pitched shelter roof over the well
  [[-1.18, -1.18], [1.18, -1.18], [-1.18, 1.18], [1.18, 1.18]].forEach(([dx, dz]) => {
    addBox(staticGroup, 0.14, 2.55, 0.14, darkTimberMat, wx + dx, gy + 1.27, wz + dz, true);
  });
  const wellRoof1 = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.10, 1.85), charcoalTileMat);
  wellRoof1.position.set(wx, gy + 2.86, wz - 0.85);
  wellRoof1.rotation.x = -0.44;
  wellRoof1.castShadow = true;
  staticGroup.add(wellRoof1);
  const wellRoof2 = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.10, 1.85), charcoalTileMat);
  wellRoof2.position.set(wx, gy + 2.86, wz + 0.85);
  wellRoof2.rotation.x = 0.44;
  wellRoof2.castShadow = true;
  staticGroup.add(wellRoof2);
  addBox(staticGroup, 3.25, 0.16, 0.18, darkTimberMat, wx, gy + 3.24, wz, true);
  addCollider(1, wx - 1.48, wz - 1.42, wx + 1.42, wz + 1.42);

  // Twin Plaza Rest Benches
  addBox(staticGroup, 2.10, 0.46, 0.48, warmCedarMat, wx + 4.80, gy + 0.23, wz - 5.20, true);
  addCollider(1, wx + 3.72, wz - 5.46, wx + 5.88, wz - 4.94);
  addBox(staticGroup, 2.10, 0.46, 0.48, warmCedarMat, wx + 4.80, gy + 0.23, wz + 5.20, true);
  addCollider(1, wx + 3.72, wz + 4.94, wx + 5.88, wz + 5.46);

  // =========================================================================
  // 4. VILLAGE ENTRY SIGNPOST & ROOFED NOTICEBOARD (杉ノ郷 集落案内板)
  // =========================================================================
  const sx = VILLAGE.signpost.x;
  const sz = VILLAGE.signpost.z;
  addBox(staticGroup, 0.16, 2.45, 0.16, darkTimberMat, sx - 1.15, gy + 1.22, sz, true);
  addBox(staticGroup, 0.16, 2.45, 0.16, darkTimberMat, sx + 1.15, gy + 1.22, sz, true);
  const signMat = createVillageSignTexture('杉ノ郷 集落', [
    '標高 +119m  黒杉川河岸段丘（全5棟）',
    '1号棟 古民家 / 2号棟 茶房 / 3号棟 工房',
    '4号棟 苔庭の家 / 5号棟 蔵造り・社の祠',
  ]);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 1.06, 0.08),
    [darkTimberMat, darkTimberMat, darkTimberMat, darkTimberMat, signMat, signMat],
  );
  signBoard.position.set(sx, gy + 1.56, sz);
  signBoard.castShadow = true;
  signBoard.userData.noBatch = true;
  dynamicGroup.add(signBoard);
  excludeBatch.add(signBoard);
  // Rooflet over noticeboard
  addBox(staticGroup, 2.68, 0.10, 0.85, charcoalTileMat, sx, gy + 2.44, sz, true);
  addCollider(1, sx - 1.30, sz - 0.35, sx + 1.30, sz + 0.35);

  // =========================================================================
  // 5. TERRACED MOUNTAIN VEGETABLE GARDEN (集落の畑)
  // =========================================================================
  const gd = VILLAGE.garden;
  const gdW = gd.maxX - gd.minX;
  const gdD = gd.maxZ - gd.minZ;
  const gdCX = (gd.minX + gd.maxX) * 0.5;
  const gdCZ = (gd.minZ + gd.maxZ) * 0.5;
  addBox(staticGroup, gdW, 0.12, gdD, makeSurfaceMat('forest_mulch_ground', 4, 3), gdCX, gy + 0.06, gdCZ, false);
  // 5 Raised soil crop ridges + leafy vegetable clusters + bamboo bean poles
  for (let row = 0; row < 5; row++) {
    const rz = gd.minZ + 0.78 + row * 1.22;
    addBox(staticGroup, gdW - 0.9, 0.16, 0.62, makeSurfaceMat('forest_mulch_ground', 3, 0.6), gdCX, gy + 0.19, rz, true);
    for (let px = gd.minX + 0.95; px < gd.maxX - 0.75; px += 0.88) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), cropLeafMat);
      bush.scale.set(1.15, 0.78, 1.05);
      bush.position.set(px, gy + 0.36, rz);
      bush.castShadow = true;
      staticGroup.add(bush);
    }
    if (row === 0 || row === 4) {
      for (let bx = gd.minX + 1.2; bx < gd.maxX - 0.8; bx += 1.6) {
        addBox(staticGroup, 0.04, 1.35, 0.04, bambooMat, bx, gy + 0.75, rz, false);
      }
      addBox(staticGroup, gdW - 1.2, 0.04, 0.04, bambooMat, gdCX, gy + 1.445, rz, false);
    }
  }
  // Low rustic cedar garden perimeter fence (mitered corners)
  addBox(staticGroup, gdW + 0.08, 0.62, 0.08, warmCedarMat, gdCX, gy + 0.31, gd.minZ, true);
  addBox(staticGroup, gdW + 0.08, 0.62, 0.08, warmCedarMat, gdCX, gy + 0.31, gd.maxZ, true);
  addBox(staticGroup, 0.08, 0.62, gdD - 0.09, warmCedarMat, gd.minX, gy + 0.31, gdCZ, true);
  addBox(staticGroup, 0.08, 0.62, gdD - 0.09, warmCedarMat, gd.maxX, gy + 0.31, gdCZ, true);
  addCollider(1, gd.minX, gd.minZ, gd.maxX, gd.maxZ);

  // =========================================================================
  // 6. EASTERN RIVER-OVERLOOK VERMILION TORII & MOUNTAIN SHRINE (山の社・鳥居)
  // =========================================================================
  const shX = VILLAGE.shrine.x;
  const shZ = VILLAGE.shrine.z;
  // Stone shrine sanctuary terrace
  addBox(staticGroup, 5.4, 0.22, 4.6, makeSurfaceMat('paver_moss_stones', 2.8, 2.4), shX + 1.2, gy + 0.08, shZ, true);
  // Classic Japanese Vermilion Torii Gate (鳥居 — facing West toward village lane!)
  const toriiX = shX - 1.1;
  addBox(staticGroup, 0.34, 0.32, 0.34, makeSurfaceMat('stone_cistern_grey', 1, 1), toriiX, gy + 0.32, shZ - 1.28, true);
  addBox(staticGroup, 0.34, 0.32, 0.34, makeSurfaceMat('stone_cistern_grey', 1, 1), toriiX, gy + 0.32, shZ + 1.28, true);
  const tPillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.05, 10), vermilionMat);
  tPillar1.position.set(toriiX, gy + 1.98, shZ - 1.28);
  tPillar1.castShadow = true;
  staticGroup.add(tPillar1);
  const tPillar2 = tPillar1.clone();
  tPillar2.position.set(toriiX, gy + 1.98, shZ + 1.28);
  staticGroup.add(tPillar2);
  // Lower tie beam (貫 / nuki) & upper curved lintel (笠木 / kasagi)
  addBox(staticGroup, 0.12, 0.16, 3.35, vermilionMat, toriiX, gy + 2.95, shZ, true);
  addBox(staticGroup, 0.24, 0.22, 3.95, vermilionMat, toriiX, gy + 3.60, shZ, true);
  addBox(staticGroup, 0.28, 0.10, 4.05, darkTimberMat, toriiX, gy + 3.76, shZ, true);
  addBox(staticGroup, 0.14, 0.44, 0.32, darkTimberMat, toriiX, gy + 3.26, shZ, false);
  addCollider(1, toriiX - 0.24, shZ - 1.50, toriiX + 0.24, shZ - 1.06);
  addCollider(1, toriiX - 0.24, shZ + 1.06, toriiX + 0.24, shZ + 1.50);

  // Miniature Cedar Hokora Mountain Shrine (祠)
  const hokX = shX + 2.25;
  addBox(staticGroup, 1.50, 0.68, 1.85, makeSurfaceMat('stone_moss_wall', 1.4, 0.8), hokX, gy + 0.50, shZ, true);
  addBox(staticGroup, 1.15, 1.28, 1.35, warmCedarMat, hokX, gy + 1.48, shZ, true);
  addBox(staticGroup, 0.08, 0.72, 0.64, darkTimberMat, hokX - 0.62, gy + 1.44, shZ, false);
  const sRoof1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.10, 1.12), charcoalTileMat);
  sRoof1.position.set(hokX, gy + 2.34, shZ - 0.52);
  sRoof1.rotation.x = -0.48;
  staticGroup.add(sRoof1);
  const sRoof2 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.10, 1.12), charcoalTileMat);
  sRoof2.position.set(hokX, gy + 2.34, shZ + 0.52);
  sRoof2.rotation.x = 0.48;
  staticGroup.add(sRoof2);
  addBox(staticGroup, 1.80, 0.12, 0.14, darkTimberMat, hokX, gy + 2.61, shZ, true);
  addBox(staticGroup, 0.56, 0.48, 0.92, warmCedarMat, hokX - 1.08, gy + 0.44, shZ, true); // Saisen-bako offering box
  addCollider(1, hokX - 1.42, shZ - 0.96, hokX + 0.85, shZ + 0.96);

  // =========================================================================
  // 7. 8 WARM TRADITIONAL VILLAGE STREET LANTERNS (常夜灯)
  // =========================================================================
  addVillageLantern(cx - 21.0, cz - 4.2, false);
  addVillageLantern(cx - 10.5, cz - 4.2, true, 'V_Lantern_West');
  addVillageLantern(cx - 10.5, cz + 4.2, false);
  addVillageLantern(cx + 0.5, cz - 7.8, false);
  addVillageLantern(cx + 9.5, cz - 7.8, true, 'V_Lantern_Plaza');
  addVillageLantern(cx + 9.5, cz + 7.8, false);
  addVillageLantern(cx + 21.5, cz - 4.2, false);
  addVillageLantern(shX - 2.0, shZ - 2.0, false);

  // =========================================================================
  // 8. DEDICATED MOBILE-OPTIMIZED UV-BAKED STATIC BATCHING FOR THE 5-HOUSE VILLAGE!
  // =========================================================================
  const { batchedGroup, stats: batchStats } = batchStaticGroups([staticGroup], excludeBatch);
  batchedGroup.name = 'BatchedSuginosatoVillage';
  villageRoot.add(batchedGroup);

  return {
    root: villageRoot,
    batchStats,
  };
}
