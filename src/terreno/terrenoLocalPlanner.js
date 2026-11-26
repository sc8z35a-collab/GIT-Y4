import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import {
  LIDAR_RAYS,
  LIDAR_MAX_RANGE,
  LIDAR_SIN_32,
  LIDAR_COS_32,
} from './neuralDrivePolicy.js';

/**
 * APEX-DRIVE v11.0 — Exact 2D Chamfer Clearance Field + Wide-Glade Highway Extractor (71×71 ±70m)
 *                   + C1-Continuous Slip/Hydroplaning SE(2) Hybrid A* (48 yaw bins, 1.6m cells)
 *                   + Zero-Understeer 1.00× Feedforward + Stanley Tracker
 *                   + Braking-Distance Speed Governor & Brake-Before-Reverse Guard
 *                   + Anti-Loop Full-Lock Back-Out-and-Pivot Cul-de-Sac Escape
 *                   + Shielded Neural Residual Policy (Colab L4 GPU Compatible)
 */

class FastMinHeap {
  constructor(cap) {
    this.nodes = new Int32Array(cap);
    this.scores = new Float32Array(cap);
    this.len = 0;
  }
  clear() { this.len = 0; }
  push(node, score) {
    if (this.len >= this.nodes.length) return;
    let i = this.len++;
    this.nodes[i] = node;
    this.scores[i] = score;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.scores[p] <= this.scores[i]) break;
      const tn = this.nodes[p]; this.nodes[p] = this.nodes[i]; this.nodes[i] = tn;
      const ts = this.scores[p]; this.scores[p] = this.scores[i]; this.scores[i] = ts;
      i = p;
    }
  }
  pop() {
    const top = this.nodes[0];
    this.len--;
    if (this.len > 0) {
      this.nodes[0] = this.nodes[this.len];
      this.scores[0] = this.scores[this.len];
      let i = 0;
      const n = this.len;
      while (true) {
        let s = i;
        const l = (i << 1) + 1;
        const r = l + 1;
        if (l < n && this.scores[l] < this.scores[s]) s = l;
        if (r < n && this.scores[r] < this.scores[s]) s = r;
        if (s === i) break;
        const tn = this.nodes[i]; this.nodes[i] = this.nodes[s]; this.nodes[s] = tn;
        const ts = this.scores[i]; this.scores[i] = this.scores[s]; this.scores[s] = ts;
        i = s;
      }
    }
    return top;
  }
}

// 7-Primitive Forward SE(2) Fan (max planned steer = 0.84 dry / 0.94 storm to offset steerGrip=0.75!)
const FWD_PRIMS = [0.0, -0.22, 0.22, -0.50, 0.50, -0.84, 0.84];
const FWD_PRIMS_STORM = [0.0, -0.26, 0.26, -0.58, 0.58, -0.94, 0.94];
// 5-Primitive Reverse SE(2) Fan (Pass 2 K-Turn breakout)
const REV_PRIMS = [0.0, -0.94, 0.94, -0.52, 0.52];

// 71 × 71 Exact Clearance & Wide-Glade Geodesic Grid (±70m @ 2.0m res = 140m × 140m corridor!)
const HOLO_HALF = 35;
const HOLO_SIZE = HOLO_HALF * 2 + 1; // 71
const HOLO_CELL = 2.0;
const HOLO_N = HOLO_SIZE * HOLO_SIZE; // 5,041 cells

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function wrapAngle(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function obbVsAabbClearance(cx, cz, hw, hl, cosY, sinY, box) {
  const bx = (box.minX + box.maxX) * 0.5;
  const bz = (box.minZ + box.maxZ) * 0.5;
  const bhw = (box.maxX - box.minX) * 0.5;
  const bhl = (box.maxZ - box.minZ) * 0.5;
  const dx = bx - cx;
  const dz = bz - cz;

  const maxR = hl + hw + bhw + bhl;
  if (Math.abs(dx) > maxR + 6.0 || Math.abs(dz) > maxR + 6.0) return 99.0;

  const absC = Math.abs(cosY);
  const absS = Math.abs(sinY);

  const g1 = Math.abs(dx) - (bhw + hw * absC + hl * absS);
  const g2 = Math.abs(dz) - (bhl + hw * absS + hl * absC);
  const g3 = Math.abs(dx * cosY - dz * sinY) - (hw + bhw * absC + bhl * absS);
  const g4 = Math.abs(dx * sinY + dz * cosY) - (hl + bhw * absS + bhl * absC);
  return Math.max(g1, g2, g3, g4);
}

function obbVsObbClearance(cx, cz, hw, hl, cosA, sinA, other) {
  const dx = other.cx - cx;
  const dz = other.cz - cz;
  const maxR = hl + hw + other.hl + other.hw;
  if (dx * dx + dz * dz > (maxR + 6.0) * (maxR + 6.0)) return 99.0;

  const cosB = Math.cos(other.yaw);
  const sinB = Math.sin(other.yaw);
  const axes = [
    [cosA, -sinA],
    [sinA,  cosA],
    [cosB, -sinB],
    [sinB,  cosB],
  ];
  let maxGap = -1e9;
  for (let i = 0; i < 4; i++) {
    const ax = axes[i][0], az = axes[i][1];
    const dist = Math.abs(dx * ax + dz * az);
    const rA = hw * Math.abs(cosA * ax - sinA * az) + hl * Math.abs(sinA * ax + cosA * az);
    const rB = other.hw * Math.abs(cosB * ax - sinB * az) + other.hl * Math.abs(sinB * ax + cosB * az);
    const gap = dist - (rA + rB);
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

function obbVsCircleClearance(cx, cz, hw, hl, cosY, sinY, px, pz, r) {
  const dx = px - cx;
  const dz = pz - cz;
  const rx = dx * cosY - dz * sinY;
  const rz = dx * sinY + dz * cosY;
  const clx = rx < -hw ? -hw : (rx > hw ? hw : rx);
  const clz = rz < -hl ? -hl : (rz > hl ? hl : rz);
  const ddx = rx - clx;
  const ddz = rz - clz;
  const d2 = ddx * ddx + ddz * ddz;
  if (d2 <= 1e-8) {
    const pen = Math.min(hw - Math.abs(rx), hl - Math.abs(rz));
    return -(pen + r);
  }
  return Math.sqrt(d2) - r;
}

function rayCircleHit(ox, oz, dirX, dirZ, cx, cz, r, maxRange) {
  const fx = cx - ox;
  const fz = cz - oz;
  const proj = fx * dirX + fz * dirZ;
  if (proj < -r || proj > maxRange + r) return maxRange;
  const perp2 = fx * fx + fz * fz - proj * proj;
  const r2 = r * r;
  if (perp2 >= r2) return maxRange;
  const t = proj - Math.sqrt(r2 - perp2);
  if (t < 0) return perp2 < r2 ? 0.0 : maxRange;
  return t < maxRange ? t : maxRange;
}

function rayAabbHit(ox, oz, dirX, dirZ, box, maxRange) {
  let tmin = 0.0;
  let tmax = maxRange;
  if (Math.abs(dirX) < 1e-7) {
    if (ox < box.minX || ox > box.maxX) return maxRange;
  } else {
    const invX = 1.0 / dirX;
    let t1 = (box.minX - ox) * invX;
    let t2 = (box.maxX - ox) * invX;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return maxRange;
  }
  if (Math.abs(dirZ) < 1e-7) {
    if (oz < box.minZ || oz > box.maxZ) return maxRange;
  } else {
    const invZ = 1.0 / dirZ;
    let t1 = (box.minZ - oz) * invZ;
    let t2 = (box.maxZ - oz) * invZ;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return maxRange;
  }
  return tmin >= 0 && tmin < maxRange ? tmin : maxRange;
}

function rayObbHit(ox, oz, dirX, dirZ, obb, maxRange) {
  const cosY = Math.cos(obb.yaw);
  const sinY = Math.sin(obb.yaw);
  const dx = ox - obb.cx;
  const dz = oz - obb.cz;
  const lox = dx * cosY - dz * sinY;
  const loz = dx * sinY + dz * cosY;
  const ldx = dirX * cosY - dirZ * sinY;
  const ldz = dirX * sinY + dirZ * cosY;
  return rayAabbHit(lox, loz, ldx, ldz, { minX: -obb.hw, maxX: obb.hw, minZ: -obb.hl, maxZ: obb.hl }, maxRange);
}

export function createTerrenoLocalPlanner(geomorph, storm, neuralPolicy) {
  const lidarBuf = new Float32Array(LIDAR_RAYS);
  const haHeap = new FastMinHeap(16384);

  // Reusable zero-GC buffers for 71×71 Exact Chamfer Clearance + Wide-Glade Geodesic Field
  const obsClear = new Float32Array(HOLO_N);
  const holoCost = new Float32Array(HOLO_N);
  const holoDist = new Float32Array(HOLO_N);
  const holoDone = new Uint8Array(HOLO_N);
  const holoHeap = new FastMinHeap(HOLO_N * 4);
  let holoOriginX = 0;
  let holoOriginZ = 0;

  // Spatial bucket hash for O(1) OBB vs Tree/Rock clearance checks across ±112m!
  const OB_CELL = 8.0;
  const OB_DIM = 28;
  const OB_HALF = 14;
  const obBuckets = Array.from({ length: OB_DIM * OB_DIM }, () => []);
  let obOriginX = 0;
  let obOriginZ = 0;
  let cacheX = 1e9, cacheZ = 1e9, cacheArmor = -1;

  const unifiedObs = {
    circles: [],
    boxes: [],
    obbs: [],
    count: 0,
  };

  function gatherUnifiedObstacles(cx, cz, radius, providers, spec, forceRebuild = false) {
    const isArmor = Boolean(spec.isArmor);
    const hasDynamic = Boolean(
      (providers && providers.otherObbs && providers.otherObbs.length > 0 && providers.otherObbs.some((o) => o && Math.hypot(o.cx - cx, o.cz - cz) < radius + 15)) ||
      (providers && providers.landslideCols && providers.landslideCols.length > 0) ||
      (providers && providers.staticBoxes && providers.staticBoxes.length > 0)
    );
    if (!forceRebuild && !hasDynamic && cacheArmor === (isArmor ? 1 : 0) && Math.hypot(cx - cacheX, cz - cacheZ) < 4.0) {
      return unifiedObs;
    }

    cacheX = cx;
    cacheZ = cz;
    cacheArmor = isArmor ? 1 : 0;
    unifiedObs.circles.length = 0;
    unifiedObs.boxes.length = 0;
    unifiedObs.obbs.length = 0;

    obOriginX = cx - OB_HALF * OB_CELL;
    obOriginZ = cz - OB_HALF * OB_CELL;
    for (let i = 0; i < obBuckets.length; i++) obBuckets[i].length = 0;

    const r2 = radius * radius;
    const maxStepH = spec.maxStepH ?? (isArmor ? 0.95 : 0.62);
    const seen = new Set();

    const addCircle = (x, z, r, kind, rawR = r) => {
      const kHash = (Math.round(x * 4) + 200000) * 400001 + (Math.round(z * 4) + 200000);
      if (seen.has(kHash)) return;
      seen.add(kHash);
      const idx = unifiedObs.circles.length;
      unifiedObs.circles.push({ x, z, r, rawR, kind });
      const bx = Math.floor((x - obOriginX) / OB_CELL);
      const bz = Math.floor((z - obOriginZ) / OB_CELL);
      if (bx >= 0 && bx < OB_DIM && bz >= 0 && bz < OB_DIM) {
        obBuckets[bz * OB_DIM + bx].push(idx);
      }
    };

    const pushCircleArray = (arr) => {
      if (!arr) return;
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const dx = o.x - cx;
        const dz = o.z - cz;
        if (dx * dx + dz * dz > r2) continue;

        if (o.kind === 'shrub') continue;
        const isNaturalRock = (o.kind === 'boulder' || o.kind === 'log' || o.kind === 'landslide_rock');
        const effMaxStep = isArmor && o.kind === 'landslide_rock' ? maxStepH * 1.25 : maxStepH;
        if (isNaturalRock && o.height !== undefined && o.height <= effMaxStep) continue;
        if (isArmor && o.kind === 'tree' && o.r < 0.20) continue;

        if (o.kind === 'log' && o.ax !== undefined) {
          const baseR = o.r || 0.24;
          const segR = baseR + 0.05;
          for (let k = 0; k <= 4; k++) {
            const u = k * 0.25;
            addCircle(o.ax + (o.bx - o.ax) * u, o.az + (o.bz - o.az) * u, segR, 'log', baseR);
          }
        } else if (o.rx && o.rz) {
          const baseR = Math.max(o.rx, o.rz);
          addCircle(o.x, o.z, baseR + 0.06, o.kind || 'boulder', baseR);
        } else {
          const baseR = o.r || 0.35;
          addCircle(o.x, o.z, baseR + 0.05, o.kind || 'tree', baseR);
        }
      }
    };

    if (providers) {
      pushCircleArray(providers.forestCols);
      pushCircleArray(providers.forestColsAhead);
      pushCircleArray(providers.landslideCols);
      pushCircleArray(providers.lanternCols);
      pushCircleArray(providers.houseBoulderCols);

      const boxes = providers.staticBoxes;
      if (boxes) {
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          const bx = (b.minX + b.maxX) * 0.5;
          const bz = (b.minZ + b.maxZ) * 0.5;
          const halfSpan = Math.hypot((b.maxX - b.minX) * 0.5, (b.maxZ - b.minZ) * 0.5);
          if (Math.hypot(bx - cx, bz - cz) <= radius + halfSpan) {
            unifiedObs.boxes.push(b);
          }
        }
      }
      const obbs = providers.otherObbs;
      if (obbs) {
        for (let i = 0; i < obbs.length; i++) {
          const ob = obbs[i];
          if (!ob) continue;
          if (Math.hypot(ob.cx - cx, ob.cz - cz) <= radius + ob.hl + ob.hw) {
            unifiedObs.obbs.push(ob);
          }
        }
      }
    }

    unifiedObs.count = unifiedObs.circles.length + unifiedObs.boxes.length + unifiedObs.obbs.length;
    return unifiedObs;
  }

  function evalPoseClearance(cx, cz, yaw, spec, obs, safetyPad = 0.16, exactPhys = false) {
    const hw = spec.hw + safetyPad;
    const hl = spec.hl + safetyPad;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    if (
      cx < TERRENO_WORLD.playMinX + hl || cx > TERRENO_WORLD.playMaxX - hl ||
      cz < TERRENO_WORLD.playMinZ + hl || cz > TERRENO_WORLD.playMaxZ - hl
    ) {
      return { hit: true, clearance: -1.0, reason: 'bounds' };
    }

    let minClear = 12.0;
    let worstReason = null;

    if (geomorph) {
      const bHit = geomorph.queryBridgeAt ? geomorph.queryBridgeAt(cx, cz) : null;
      const rq = geomorph.roadIndex ? geomorph.roadIndex.queryDist(cx, cz) : { dist: 9999, width: 9.5 };
      const onRoadBridge = Boolean(bHit && bHit.onBridge) || rq.dist < (rq.width || 9.5) * 0.65;
      if (bHit && bHit.hitGuardrail) {
        return { hit: true, clearance: -0.2, reason: 'bridge_rail' };
      }
      if (!onRoadBridge) {
        const rv = evalMainRiver(cz);
        if (Math.abs(cx - rv.x) < rv.halfWidth * 1.35) {
          const y = geomorph.getHeightAt(cx, cz);
          const flood = storm ? storm.getFloodInfoAt(cx, cz) : null;
          const depth = flood ? flood.depth : Math.max(0, rv.waterY - y);
          if (depth > spec.maxFordDepth * 0.90) {
            return { hit: true, clearance: -0.8, reason: 'river' };
          }
        }
      }
      const nrm = geomorph.getMacroNormalAt(cx, cz, 3.2);
      if (!onRoadBridge && nrm.slope > spec.cliffHardSlope * 0.95) {
        return { hit: true, clearance: -0.6, reason: 'cliff' };
      }
      if (nrm.slope > spec.maxClimbSlope) {
        minClear = Math.min(minClear, 0.85);
      }
    }

    const boxes = obs.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const g = obbVsAabbClearance(cx, cz, hw, hl, cosY, sinY, boxes[i]);
      if (g <= 0.0) return { hit: true, clearance: g, reason: boxes[i].reason || 'building' };
      if (g < minClear) { minClear = g; worstReason = boxes[i].reason || 'building'; }
    }

    const obbs = obs.obbs;
    for (let i = 0; i < obbs.length; i++) {
      const g = obbVsObbClearance(cx, cz, hw, hl, cosY, sinY, obbs[i]);
      if (g <= 0.0) return { hit: true, clearance: g, reason: 'vehicle' };
      if (g < minClear) { minClear = g; worstReason = 'vehicle'; }
    }

    const circles = obs.circles;
    const searchRad = hl + hw + 2.8;
    const minBx = Math.max(0, Math.floor((cx - searchRad - obOriginX) / OB_CELL));
    const maxBx = Math.min(OB_DIM - 1, Math.floor((cx + searchRad - obOriginX) / OB_CELL));
    const minBz = Math.max(0, Math.floor((cz - searchRad - obOriginZ) / OB_CELL));
    const maxBz = Math.min(OB_DIM - 1, Math.floor((cz + searchRad - obOriginZ) / OB_CELL));

    for (let bz = minBz; bz <= maxBz; bz++) {
      const row = bz * OB_DIM;
      for (let bx = minBx; bx <= maxBx; bx++) {
        const bucket = obBuckets[row + bx];
        for (let k = 0; k < bucket.length; k++) {
          const o = circles[bucket[k]];
          const rad = exactPhys ? (o.rawR ?? o.r) : o.r;
          const g = obbVsCircleClearance(cx, cz, hw, hl, cosY, sinY, o.x, o.z, rad);
          if (g <= 0.0) return { hit: true, clearance: g, reason: o.kind || 'forest' };
          if (g < minClear) { minClear = g; worstReason = o.kind || 'forest'; }
        }
      }
    }

    return { hit: false, clearance: minClear, reason: worstReason };
  }

  /**
   * WIDE-GLADE HIGHWAY EXTRACTOR (v11.0):
   * 1. Computes an EXACT 2-pass 2D Euclidean Clearance Distance Transform (`obsClear[71×71]`, ±70m @ 2m)
   *    telling us the exact metric corridor width at every cell in ~0.18 ms!
   * 2. Assigns high traversal cost to corridors narrower than `spec.hw + 0.35` (so dense boulder walls
   *    and tight cul-de-sacs are automatically avoided 70m in advance!) while keeping wide glades at cost 1.0!
   * 3. Runs Backward Dijkstra from `(goalX, goalZ)` (~0.30 ms) AND traces the smooth 2D Wide-Glade
   *    Centerline from `(startX, startZ)` toward `(goalX, goalZ)` so SE(2) Hybrid A* aims straight down
   *    the widest open forest highway instead of diving into dead-ends!
   */
  function buildWideGladeFieldAndGuide(startX, startZ, goalX, goalZ, obs, spec, tabuSpots, grip = 0.96) {
    const midX = (startX + goalX) * 0.5;
    const midZ = (startZ + goalZ) * 0.5;
    holoOriginX = midX - HOLO_HALF * HOLO_CELL;
    holoOriginZ = midZ - HOLO_HALF * HOLO_CELL;

    obsClear.fill(14.0);
    holoDist.fill(1e6);
    holoDone.fill(0);

    const toGx = (wx) => clamp(Math.round((wx - holoOriginX) / HOLO_CELL), 0, HOLO_SIZE - 1);
    const toGz = (wz) => clamp(Math.round((wz - holoOriginZ) / HOLO_CELL), 0, HOLO_SIZE - 1);
    const toWx = (gx) => holoOriginX + gx * HOLO_CELL;
    const toWz = (gz) => holoOriginZ + gz * HOLO_CELL;

    // 1. Seed exact surface distance around every obstacle circle & static box
    const circles = obs.circles;
    for (let i = 0; i < circles.length; i++) {
      const o = circles[i];
      const rad = o.r;
      const span = rad + HOLO_CELL * 1.5;
      const minGx = Math.max(0, Math.floor((o.x - span - holoOriginX) / HOLO_CELL));
      const maxGx = Math.min(HOLO_SIZE - 1, Math.ceil((o.x + span - holoOriginX) / HOLO_CELL));
      const minGz = Math.max(0, Math.floor((o.z - span - holoOriginZ) / HOLO_CELL));
      const maxGz = Math.min(HOLO_SIZE - 1, Math.ceil((o.z + span - holoOriginZ) / HOLO_CELL));
      for (let gz = minGz; gz <= maxGz; gz++) {
        const dz = toWz(gz) - o.z;
        const row = gz * HOLO_SIZE;
        for (let gx = minGx; gx <= maxGx; gx++) {
          const d = Math.hypot(toWx(gx) - o.x, dz) - rad;
          const idx = row + gx;
          if (d < obsClear[idx]) obsClear[idx] = d < 0 ? 0 : d;
        }
      }
    }

    const boxes = obs.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const minGx = Math.max(0, Math.floor((b.minX - holoOriginX) / HOLO_CELL));
      const maxGx = Math.min(HOLO_SIZE - 1, Math.ceil((b.maxX - holoOriginX) / HOLO_CELL));
      const minGz = Math.max(0, Math.floor((b.minZ - holoOriginZ) / HOLO_CELL));
      const maxGz = Math.min(HOLO_SIZE - 1, Math.ceil((b.maxZ - holoOriginZ) / HOLO_CELL));
      for (let gz = minGz; gz <= maxGz; gz++) {
        const row = gz * HOLO_SIZE;
        for (let gx = minGx; gx <= maxGx; gx++) obsClear[row + gx] = -2.0;
      }
    }

    const obbs = obs.obbs;
    for (let i = 0; i < obbs.length; i++) {
      const ob = obbs[i];
      const rad = Math.hypot(ob.hw, ob.hl);
      const minGx = Math.max(0, Math.floor((ob.cx - rad - holoOriginX) / HOLO_CELL));
      const maxGx = Math.min(HOLO_SIZE - 1, Math.ceil((ob.cx + rad - holoOriginX) / HOLO_CELL));
      const minGz = Math.max(0, Math.floor((ob.cz - rad - holoOriginZ) / HOLO_CELL));
      const maxGz = Math.min(HOLO_SIZE - 1, Math.ceil((ob.cz + rad - holoOriginZ) / HOLO_CELL));
      for (let gz = minGz; gz <= maxGz; gz++) {
        const dz = toWz(gz) - ob.cz;
        const row = gz * HOLO_SIZE;
        for (let gx = minGx; gx <= maxGx; gx++) {
          const d = Math.hypot(toWx(gx) - ob.cx, dz) - rad * 0.72;
          const idx = row + gx;
          if (d < obsClear[idx]) obsClear[idx] = d < 0 ? 0 : d;
        }
      }
    }

    // 2. Fast 2-pass Chamfer Distance Transform (propagates exact clearance across all 71×71 cells!)
    const cOrt = HOLO_CELL;
    const cDia = HOLO_CELL * 1.4142;
    for (let gz = 0; gz < HOLO_SIZE; gz++) {
      const row = gz * HOLO_SIZE;
      const pRow = (gz - 1) * HOLO_SIZE;
      for (let gx = 0; gx < HOLO_SIZE; gx++) {
        let v = obsClear[row + gx];
        if (v <= 0) continue;
        if (gx > 0) {
          const t = obsClear[row + gx - 1] + cOrt;
          if (t < v) v = t;
        }
        if (gz > 0) {
          const t = obsClear[pRow + gx] + cOrt;
          if (t < v) v = t;
          if (gx > 0) {
            const td = obsClear[pRow + gx - 1] + cDia;
            if (td < v) v = td;
          }
          if (gx < HOLO_SIZE - 1) {
            const td = obsClear[pRow + gx + 1] + cDia;
            if (td < v) v = td;
          }
        }
        obsClear[row + gx] = v;
      }
    }
    for (let gz = HOLO_SIZE - 1; gz >= 0; gz--) {
      const row = gz * HOLO_SIZE;
      const nRow = (gz + 1) * HOLO_SIZE;
      for (let gx = HOLO_SIZE - 1; gx >= 0; gx--) {
        let v = obsClear[row + gx];
        if (v <= 0) continue;
        if (gx < HOLO_SIZE - 1) {
          const t = obsClear[row + gx + 1] + cOrt;
          if (t < v) v = t;
        }
        if (gz < HOLO_SIZE - 1) {
          const t = obsClear[nRow + gx] + cOrt;
          if (t < v) v = t;
          if (gx < HOLO_SIZE - 1) {
            const td = obsClear[nRow + gx + 1] + cDia;
            if (td < v) v = td;
          }
          if (gx > 0) {
            const td = obsClear[nRow + gx - 1] + cDia;
            if (td < v) v = td;
          }
        }
        obsClear[row + gx] = v;
      }
    }

    // 3. Convert exact metric clearance into smooth corridor traversal cost!
    const minPassClr = spec.hw + (spec.isArmor ? 0.45 : 0.20);  // 2.05m for ARMOR-155 swept turns
    const wideClr = spec.hw + (spec.isArmor ? 3.8 : 2.3);       // 5.40m open forest highway
    const invSpan = 1.0 / Math.max(0.5, wideClr - minPassClr);
    for (let i = 0; i < HOLO_N; i++) {
      const c = obsClear[i];
      if (c < -0.5) {
        holoCost[i] = 35.0; // Solid building / open silo
      } else if (c < minPassClr) {
        const deficit = (minPassClr - c) / Math.max(0.4, minPassClr);
        holoCost[i] = 7.0 + deficit * 16.0; // Strongly avoids tree cores without hard disconnection!
      } else if (c < wideClr) {
        const f = (wideClr - c) * invSpan;
        holoCost[i] = 1.0 + f * f * 3.8; // Smoothly prefers wide open glades over narrow gaps!
      } else {
        holoCost[i] = 1.0;
      }
    }

    // Add strong Tabu dead-end memory repulsor so Wide-Glade Dijkstra routes cleanly AROUND dead-end pockets!
    if (tabuSpots && tabuSpots.length > 0) {
      for (let t = 0; t < tabuSpots.length; t++) {
        const tb = tabuSpots[t];
        const minGx = Math.max(0, Math.floor((tb.x - tb.r - holoOriginX) / HOLO_CELL));
        const maxGx = Math.min(HOLO_SIZE - 1, Math.ceil((tb.x + tb.r - holoOriginX) / HOLO_CELL));
        const minGz = Math.max(0, Math.floor((tb.z - tb.r - holoOriginZ) / HOLO_CELL));
        const maxGz = Math.min(HOLO_SIZE - 1, Math.ceil((tb.z + tb.r - holoOriginZ) / HOLO_CELL));
        for (let gz = minGz; gz <= maxGz; gz++) {
          const dz = toWz(gz) - tb.z;
          const row = gz * HOLO_SIZE;
          for (let gx = minGx; gx <= maxGx; gx++) {
            const d = Math.hypot(toWx(gx) - tb.x, dz);
            if (d < tb.r) holoCost[row + gx] += (1.0 - d / tb.r) * 45.0;
          }
        }
      }
    }

    // 4. Backward Dijkstra from goal cell (or nearest clear cell around goal!)
    let ggx = toGx(goalX);
    let ggz = toGz(goalZ);
    if (obsClear[ggz * HOLO_SIZE + ggx] < minPassClr) {
      let bestC = obsClear[ggz * HOLO_SIZE + ggx];
      let bx = ggx, bz = ggz;
      for (let dz = -5; dz <= 5; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const nx = ggx + dx, nz = ggz + dz;
          if (nx < 0 || nx >= HOLO_SIZE || nz < 0 || nz >= HOLO_SIZE) continue;
          const c = obsClear[nz * HOLO_SIZE + nx] - Math.hypot(dx, dz) * 0.25;
          if (c > bestC) { bestC = c; bx = nx; bz = nz; }
        }
      }
      ggx = bx; ggz = bz;
    }

    const goalIdx = ggz * HOLO_SIZE + ggx;
    holoHeap.clear();
    holoDist[goalIdx] = 0.0;
    holoHeap.push(goalIdx, 0.0);

    const dirs = [
      [-1, 0, cOrt], [1, 0, cOrt], [0, -1, cOrt], [0, 1, cOrt],
      [-1, -1, cDia], [1, -1, cDia], [-1, 1, cDia], [1, 1, cDia],
    ];

    let settled = 0;
    let pops = 0;
    const maxPops = HOLO_N * 4;
    while (holoHeap.len > 0 && settled < HOLO_N && pops++ < maxPops) {
      const cur = holoHeap.pop();
      if (holoDone[cur]) continue;
      holoDone[cur] = 1;
      settled++;
      const cxG = cur % HOLO_SIZE;
      const czG = (cur - cxG) / HOLO_SIZE;
      const cd = holoDist[cur];
      for (let d = 0; d < 8; d++) {
        const nx = cxG + dirs[d][0];
        const nz = czG + dirs[d][1];
        if (nx < 0 || nx >= HOLO_SIZE || nz < 0 || nz >= HOLO_SIZE) continue;
        const ni = nz * HOLO_SIZE + nx;
        if (holoDone[ni]) continue;
        const nd = cd + dirs[d][2] * holoCost[ni];
        if (nd < holoDist[ni]) {
          holoDist[ni] = nd;
          holoHeap.push(ni, nd);
        }
      }
    }

    // 5. Trace smooth 2D Wide-Glade Highway from vehicle down holoDist gradient!
    let gx = toGx(startX);
    let gz = toGz(startZ);
    let accum = 0;
    let guideX = toWx(ggx);
    let guideZ = toWz(ggz);
    let midGuideX = guideX;
    let midGuideZ = guideZ;
    let gotMid = false;
    let gotFar = false;

    for (let step = 0; step < 52; step++) {
      const curD = holoDist[gz * HOLO_SIZE + gx];
      if (curD <= 1.0) break;
      let bestNx = gx, bestNz = gz, bestVal = curD;
      for (let d = 0; d < 8; d++) {
        const nx = gx + dirs[d][0];
        const nz = gz + dirs[d][1];
        if (nx < 0 || nx >= HOLO_SIZE || nz < 0 || nz >= HOLO_SIZE) continue;
        const v = holoDist[nz * HOLO_SIZE + nx];
        if (v < bestVal) { bestVal = v; bestNx = nx; bestNz = nz; }
      }
      if (bestNx === gx && bestNz === gz) break;
      accum += Math.hypot(bestNx - gx, bestNz - gz) * HOLO_CELL;
      gx = bestNx;
      gz = bestNz;
      if (!gotMid && accum >= 24.0) {
        midGuideX = toWx(gx);
        midGuideZ = toWz(gz);
        gotMid = true;
      }
      if (!gotFar && accum >= 48.0) {
        guideX = toWx(gx);
        guideZ = toWz(gz);
        gotFar = true;
        break;
      }
    }
    if (!gotFar && accum >= 24.0) {
      guideX = toWx(gx);
      guideZ = toWz(gz);
    }
    // Never collapse guide onto a nearby stub (< 26m) when the macro target is far (> 32m)
    if (Math.hypot(goalX - startX, goalZ - startZ) > 32.0 && Math.hypot(guideX - startX, guideZ - startZ) < 26.0) {
      guideX = goalX;
      guideZ = goalZ;
    }
    if (!gotMid) {
      midGuideX = guideX;
      midGuideZ = guideZ;
    }

    return {
      guideX,
      guideZ,
      midGuideX,
      midGuideZ,
      goalSnappedX: toWx(ggx),
      goalSnappedZ: toWz(ggz),
      startClear: obsClear[toGz(startZ) * HOLO_SIZE + toGx(startX)],
    };
  }

  function queryHoloDist(wx, wz, fallbackEuclid) {
    const fx = (wx - holoOriginX) / HOLO_CELL;
    const fz = (wz - holoOriginZ) / HOLO_CELL;
    if (fx < 0 || fx >= HOLO_SIZE - 1 || fz < 0 || fz >= HOLO_SIZE - 1) {
      return fallbackEuclid * 1.06;
    }
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const r0 = iz * HOLO_SIZE + ix;
    const r1 = r0 + HOLO_SIZE;
    const v =
      (holoDist[r0] * (1 - tx) + holoDist[r0 + 1] * tx) * (1 - tz) +
      (holoDist[r1] * (1 - tx) + holoDist[r1 + 1] * tx) * tz;
    if (v > 1e5) return fallbackEuclid * 1.12;
    return Math.max(fallbackEuclid, Math.min(fallbackEuclid + 42.0, v * 0.72));
  }

  function queryGridClearance(wx, wz) {
    const gx = Math.round((wx - holoOriginX) / HOLO_CELL);
    const gz = Math.round((wz - holoOriginZ) / HOLO_CELL);
    if (gx < 0 || gx >= HOLO_SIZE || gz < 0 || gz >= HOLO_SIZE) return 3.0;
    return obsClear[gz * HOLO_SIZE + gx];
  }

  function scanVirtualLidar32(pose, obs, spec) {
    const cx = pose.cx;
    const cz = pose.cz;
    const yaw = pose.yaw;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const fwdX = -sinY, fwdZ = -cosY;
    const rgtX = cosY,  rgtZ = -sinY;

    const circles = obs.circles;
    const boxes = obs.boxes;
    const obbs = obs.obbs;
    const inflateR = spec.hw * 0.55;
    const maxR2 = (LIDAR_MAX_RANGE + 5.0) * (LIDAR_MAX_RANGE + 5.0);

    let frontCenterMinM = LIDAR_MAX_RANGE;
    let rearCenterMinM = LIDAR_MAX_RANGE;

    for (let r = 0; r < LIDAR_RAYS; r++) {
      const sa = LIDAR_SIN_32[r];
      const ca = LIDAR_COS_32[r];
      const dirX = fwdX * ca + rgtX * sa;
      const dirZ = fwdZ * ca + rgtZ * sa;
      let bestT = LIDAR_MAX_RANGE;

      for (let i = 0; i < circles.length; i++) {
        const o = circles[i];
        const dx = o.x - cx, dz = o.z - cz;
        if (dx * dx + dz * dz > maxR2) continue;
        const t = rayCircleHit(cx, cz, dirX, dirZ, o.x, o.z, o.r + inflateR, bestT);
        if (t < bestT) bestT = t;
      }
      for (let i = 0; i < boxes.length; i++) {
        const t = rayAabbHit(cx, cz, dirX, dirZ, boxes[i], bestT);
        if (t < bestT) bestT = t;
      }
      for (let i = 0; i < obbs.length; i++) {
        const t = rayObbHit(cx, cz, dirX, dirZ, obbs[i], bestT);
        if (t < bestT) bestT = t;
      }

      const skinDist = Math.max(0.0, bestT - (Math.abs(ca) * spec.hl + Math.abs(sa) * spec.hw) * 0.72);
      lidarBuf[r] = skinDist / LIDAR_MAX_RANGE;

      if (r >= 7 && r <= 9 && skinDist < frontCenterMinM) frontCenterMinM = skinDist;
      if (r >= 29 && r <= 31 && skinDist < rearCenterMinM) rearCenterMinM = skinDist;
    }

    return {
      rays: lidarBuf,
      frontMinM: frontCenterMinM,
      rearMinM: rearCenterMinM,
    };
  }

  function samplePathAhead(pts, startIdx, cx, cz, aheadM) {
    if (!pts || pts.length === 0) return [cx, cz];
    const last = pts[pts.length - 1];
    let accum = 0;
    let px = cx, pz = cz;
    for (let i = Math.max(0, startIdx); i < pts.length; i++) {
      const qx = pts[i][0], qz = pts[i][1];
      const d = Math.hypot(qx - px, qz - pz);
      if (accum + d >= aheadM && d > 1e-4) {
        const u = (aheadM - accum) / d;
        return [px + (qx - px) * u, pz + (qz - pz) * u];
      }
      accum += d;
      px = qx;
      pz = qz;
    }
    return last;
  }

  /**
   * Shared physics-matched Extreme Storm target speed envelope (exact parity between Hybrid A* rollout and Section 8 MPC!).
   */
  function stormTargetSpd(absSt, grip, minClr = 0.65) {
    const gScale = clamp((grip - 0.18) / 0.22, 0.0, 1.0);
    const base = absSt > 0.70 ? 4.9 : (absSt > 0.38 ? 8.2 : (absSt > 0.10 ? 12.0 : 15.4));
    const clrFactor = minClr < 0.50 ? clamp(0.85 + minClr * 0.30, 0.85, 1.0) : 1.0;
    return base * clrFactor * (0.78 + 0.22 * gScale);
  }

  /**
   * C1-Continuous Physics-Exact Clothoid + Lateral-Slip + Storm-Hydroplaning SE(2) Rollout!
   */
  function rolloutPrimitive(
    cx, cz, yaw, initSteerAng, initVx, initVz, sameDirParent, estSpeed, dir, steerCmd, arcLen,
    grip, spec, obs, safetyPad, isRoot, rootStartClear,
  ) {
    const subSteps = isRoot ? Math.max(8, Math.ceil(arcLen / 0.55)) : Math.max(5, Math.ceil(arcLen / 1.25));
    const stepD = (dir * arcLen) / subSteps;
    const absSt = Math.abs(steerCmd);
    let spdAbs;
    let endSpd;
    if (dir > 0 && grip < 0.65) {
      const targetSpd = stormTargetSpd(absSt, grip, 0.60);
      const startSpd = clamp(Math.abs(estSpeed), 2.8, 15.5);
      const trac = 0.42 + 0.58 * grip;
      const aAcc = (spec.accelFwd || 7.8) * trac * 0.78;
      const aBrk = (spec.accelRev || 4.2) * trac * 0.72;
      if (startSpd > targetSpd) {
        endSpd = Math.max(targetSpd, Math.sqrt(Math.max(0.0, startSpd * startSpd - 2.0 * aBrk * arcLen)));
      } else {
        endSpd = Math.min(targetSpd, Math.sqrt(startSpd * startSpd + 2.0 * aAcc * arcLen));
      }
      spdAbs = clamp((startSpd + endSpd) * 0.5, 3.6, 15.5);
    } else if (dir > 0) {
      const curveCap = absSt > 0.58 ? 10.6 : Math.min(spec.maxSpeed, 15.6);
      spdAbs = clamp(Math.abs(estSpeed), 4.8, curveCap);
      endSpd = spdAbs;
    } else {
      spdAbs = 4.2;
      endSpd = 2.8;
    }
    const signedSpd = dir * spdAbs;
    const dtStep = Math.abs(stepD) / spdAbs;
    const targetSteerAng = steerCmd * spec.maxSteer;
    const steerGrip = 0.58 + 0.42 * grip;
    const kLat = 0.42 + grip * grip * 12.8;
    const latResp = 1.0 - Math.exp(-kLat * dtStep);
    const driftDt = latResp / kLat;
    const hydroActive = grip < 0.65 && spdAbs > 1.5;
    const hydroSev = hydroActive ? ((0.65 - grip) / 0.47) : 0.0;
    const hydroFactor = hydroSev * 0.52 * 2.8;
    let windAccX = 0, windAccZ = 0;
    if (hydroActive && storm && storm.getWind) {
      const wv = storm.getWind();
      if (wv) {
        const wScale = (spec.isArmor ? 0.045 : 0.095) * hydroSev;
        windAccX = wv.x * wScale;
        windAccZ = wv.z * wScale;
      }
    }
    let slopeSlipVx = 0, slopeSlipVz = 0;
    if (grip < 0.72 && geomorph) {
      const mn = geomorph.getMacroNormalAt(cx, cz, 3.2);
      if (mn.slope > 0.06) {
        const slSlip = (0.72 - grip) * 5.2 * (spec.isArmor ? 0.68 : 1.0);
        slopeSlipVx = mn.x * slSlip;
        slopeSlipVz = mn.z * slSlip;
      }
    }

    let x = cx, z = cz, y = yaw;
    let str = initSteerAng;
    const initFwdX = -Math.sin(y), initFwdZ = -Math.cos(y);
    let vx = initFwdX * signedSpd;
    let vz = initFwdZ * signedSpd;

    if (sameDirParent && dir > 0 && initVx !== undefined && initVz !== undefined) {
      const vMag = Math.hypot(initVx, initVz);
      if (vMag > 1.5) {
        const align = (initVx * initFwdX + initVz * initFwdZ) / vMag;
        if (align > 0.60) {
          vx = (initVx / vMag) * spdAbs;
          vz = (initVz / vMag) * spdAbs;
        }
      }
    } else if (isRoot && grip < 0.65 && initVx !== undefined && initVz !== undefined) {
      const vMag = Math.hypot(initVx, initVz);
      const dirDot = initVx * (initFwdX * dir) + initVz * (initFwdZ * dir);
      if (vMag < 0.8 || dirDot > 0) {
        vx = initVx;
        vz = initVz;
      }
    }

    // Micro-step exact-physical Frame-1 clearance check on root primitives (exact rawR parity with scene3d.js!)
    let curPhysClear = 12.0;
    if (isRoot) {
      curPhysClear = evalPoseClearance(cx, cz, yaw, spec, obs, 0.0, true).clearance;
      const rootPhysPad = curPhysClear < 0.008 ? Math.min(0.0, curPhysClear - 0.0005) : 0.002;
      let mx = cx, mz = cz, my = yaw, mStr = initSteerAng;
      const mSteps = [0.06, 0.14];
      for (let ms = 0; ms < mSteps.length; ms++) {
        const md = dir * mSteps[ms];
        const mDt = mSteps[ms] / Math.max(1.8, spdAbs);
        mStr += (targetSteerAng - mStr) * Math.min(1.0, mDt * spec.steerRate);
        my += (md / spec.wheelbase) * Math.tan(mStr) * steerGrip;
        const tmx = mx + (-Math.sin(my) * md);
        const tmz = mz + (-Math.cos(my) * md);
        mx = tmx + slopeSlipVx * mDt;
        mz = tmz + slopeSlipVz * mDt;
        let mChk = evalPoseClearance(mx, mz, my, spec, obs, rootPhysPad, true);
        if (mChk.hit && (slopeSlipVx !== 0 || slopeSlipVz !== 0)) {
          const tanChk = evalPoseClearance(tmx, tmz, my, spec, obs, rootPhysPad, true);
          if (!tanChk.hit) {
            mx = tmx; mz = tmz; mChk = tanChk;
          }
        }
        if (mChk.hit && mChk.clearance < Math.min(0.0, curPhysClear) - 0.001) {
          return null;
        }
      }
    }

    let minClear = 12.0;
    let prevClear = rootStartClear;
    const grazePadInit = curPhysClear < 0.008 ? Math.min(0.0, curPhysClear - 0.0005) : 0.002;
    const samples = [];

    for (let s = 1; s <= subSteps; s++) {
      str += (targetSteerAng - str) * Math.min(1.0, dtStep * spec.steerRate);
      const dYaw = (stepD / spec.wheelbase) * Math.tan(str) * steerGrip;
      y += dYaw;

      const tvx = -Math.sin(y) * signedSpd;
      const tvz = -Math.cos(y) * signedSpd;
      vx += (tvx - vx) * latResp;
      vz += (tvz - vz) * latResp;
      if (hydroActive) {
        const turnSlide = Math.sin(str) * signedSpd * hydroFactor;
        vx += (Math.cos(y) * turnSlide + windAccX) * driftDt;
        vz += (-Math.sin(y) * turnSlide + windAccZ) * driftDt;
      }
      if (slopeSlipVx !== 0 || slopeSlipVz !== 0) {
        vx += slopeSlipVx * driftDt;
        vz += slopeSlipVz * driftDt;
      }

      const prevX = x, prevZ = z;
      x += vx * dtStep;
      z += vz * dtStep;

      const hasLatPush = (slopeSlipVx !== 0 || slopeSlipVz !== 0 || windAccX !== 0 || windAccZ !== 0);
      let rawChk = evalPoseClearance(x, z, y, spec, obs, 0.02);
      if (rawChk.hit && isRoot && hasLatPush) {
        const tx = prevX + (-Math.sin(y) * stepD);
        const tz = prevZ + (-Math.cos(y) * stepD);
        const tChk = evalPoseClearance(tx, tz, y, spec, obs, 0.02);
        const tPhys = tChk.hit && rootStartClear < 0.06 ? evalPoseClearance(tx, tz, y, spec, obs, grazePadInit, true) : null;
        if (!tChk.hit || (tPhys && !tPhys.hit)) {
          x = tx; z = tz;
          vx = -Math.sin(y) * signedSpd;
          vz = -Math.cos(y) * signedSpd;
          rawChk = tChk;
        }
      }
      const grazePad = grazePadInit;
      if (rawChk.hit) {
        if (isRoot && rootStartClear < 0.06) {
          const physChk = evalPoseClearance(x, z, y, spec, obs, grazePad, true);
          if (
            (physChk.hit && physChk.clearance < Math.min(0.0, curPhysClear) - 0.002) ||
            (grip < 0.65 && safetyPad >= 0.10 && s >= 2 && physChk.clearance < 0.018)
          ) {
            return null;
          }
        } else {
          return null;
        }
      }

      const padNow = (isRoot && s <= 5 && rootStartClear < safetyPad)
        ? Math.max(0.02, safetyPad * (s / 6.0))
        : safetyPad;
      const paddedClear = rawChk.clearance - (padNow - 0.02);

      if (paddedClear <= 0.0) {
        if (isRoot && rootStartClear < safetyPad && (rawChk.clearance >= prevClear - 0.004 || !evalPoseClearance(x, z, y, spec, obs, grazePad, true).hit)) {
          // Allowed directional or parallel flank slide-out away from grazing trunk across the full root arc!
        } else {
          return null;
        }
      }
      prevClear = rawChk.clearance;
      if (rawChk.clearance < minClear) minClear = rawChk.clearance;
      if (!isRoot || s % 2 === 0 || s === subSteps) {
        samples.push({ x, z, yaw: y, dir, steer: steerCmd, minClear: rawChk.clearance });
      }
    }
    return { x, z, yaw: y, endSteerAng: str, endVx: vx, endVz: vz, endSpd, minClear, samples };
  }

  /**
   * CORE ENGINE: Wide-Glade Guided C1-Continuous SE(2) Hybrid A*!
   * Aims along the extracted 2D Wide-Glade Highway (`guideX, guideZ`) instead of blindly into walls!
   */
  function planRollingHybridAStar(
    pose, liveSteerAng, liveSpeed, liveVx, liveVz, guideX, guideZ, finalGoalX, finalGoalZ,
    grip, spec, obs, opts,
  ) {
    const allowReverse = Boolean(opts.allowReverse);
    const safetyPad = opts.safetyPad;
    const maxExpansions = opts.maxExpansions || (allowReverse ? 1400 : 900);
    const neuralSteerPrior = opts.neuralSteerPrior || 0;
    const customArc = opts.arcLen || 0;

    const isFinalClose = Math.hypot(finalGoalX - pose.cx, finalGoalZ - pose.cz) < 62.0;
    const goalX = isFinalClose ? finalGoalX : guideX;
    const goalZ = isFinalClose ? finalGoalZ : guideZ;
    const startDist = Math.hypot(goalX - pose.cx, goalZ - pose.cz);

    const rootRawChk = evalPoseClearance(pose.cx, pose.cz, pose.yaw, spec, obs, 0.02);
    const rootStartClear = rootRawChk.clearance;

    const arcLen = customArc > 0 ? customArc : (spec.isArmor ? 5.6 : 4.3);
    const planEstSpeed = grip < 0.65 ? clamp(Math.abs(liveSpeed), 2.8, 15.5) : Math.max(6.4, Math.abs(liveSpeed));

    const gDx = goalX - pose.cx;
    const gDz = goalZ - pose.cz;
    const gLen = Math.max(1.0, Math.hypot(gDx, gDz));
    const gDirX = gDx / gLen;
    const gDirZ = gDz / gLen;

    const nodes = [];
    const bestGByCell = new Map();
    haHeap.clear();

    const cellXY = customArc > 0 ? 1.3 : 1.7;
    const yawBins = 48;
    const cellKey = (x, z, yaw, dir) => {
      const ix = Math.round((x - pose.cx) / cellXY) + 512;
      const iz = Math.round((z - pose.cz) / cellXY) + 512;
      const iy = ((Math.round((wrapAngle(yaw) + Math.PI) / (Math.PI * 2 / yawBins))) % yawBins + yawBins) % yawBins;
      return ((ix * 1024 + iz) * 96) + (iy * 2) + (dir > 0 ? 1 : 0);
    };

    const startHolo = queryHoloDist(pose.cx, pose.cz, startDist);
    nodes.push({
      x: pose.cx, z: pose.cz, yaw: pose.yaw,
      steerAng: liveSteerAng,
      vx: liveVx, vz: liveVz,
      spd: planEstSpeed,
      dir: 1, steer: liveSteerAng / Math.max(0.1, spec.maxSteer),
      revSteerSum: 0,
      g: 0, parent: -1, depth: 0, revStreak: 0, totalRevs: 0, fwdSteps: 0,
      minClear: Math.max(0, rootStartClear), samples: null,
    });
    bestGByCell.set(cellKey(pose.cx, pose.cz, pose.yaw, 1), 0);
    haHeap.push(0, startHolo);

    const maxDepth = allowReverse ? 15 : 14;
    const arriveGoalRad = isFinalClose ? (spec.isArmor ? 5.2 : 4.2) : 11.0;
    const goodHorizonProg = Math.min(startDist * 0.84, opts.isBreakout ? 32.0 : (spec.isArmor ? 44.0 : 36.0));

    let bestGoalId = -1;
    let bestFallbackId = 0;
    let bestFallbackScore = -1e9;
    let expanded = 0;

    while (haHeap.len > 0 && expanded++ < maxExpansions) {
      const curId = haHeap.pop();
      const cur = nodes[curId];

      const remToGoal = Math.hypot(goalX - cur.x, goalZ - cur.z);
      const progAlong = (cur.x - pose.cx) * gDirX + (cur.z - pose.cz) * gDirZ;

      if (cur.depth >= 1) {
        const holoRem = queryHoloDist(cur.x, cur.z, remToGoal);
        const euclidGain = startDist - remToGoal;
        const holoGain = clamp(startHolo - holoRem, -30.0, 80.0);
        const headAlign = (-Math.sin(cur.yaw) * gDirX - Math.cos(cur.yaw) * gDirZ);
        const dispFromStart = Math.hypot(cur.x - pose.cx, cur.z - pose.cz);
        // Penalize useless "back 4m + forward 4m right back to start" stubs!
        const loopPen = (cur.totalRevs > 0 && dispFromStart < 6.5 && cur.fwdSteps < 3) ? 24.0 : 0.0;
        let tabuPen = 0.0;
        const tSpots = opts.tabuSpots;
        if (tSpots && tSpots.length > 0) {
          for (let ti = 0; ti < tSpots.length; ti++) {
            const tb = tSpots[ti];
            const dCur = Math.hypot(cur.x - tb.x, cur.z - tb.z);
            const dStart = Math.hypot(pose.cx - tb.x, pose.cz - tb.z);
            if (dCur < tb.r && dCur < dStart + 2.0) {
              tabuPen += (1.0 - dCur / tb.r) * 38.0;
            }
          }
        }
        const fbScore =
          holoGain * 1.15 +
          euclidGain * 0.90 +
          progAlong * 0.45 +
          headAlign * 7.5 +
          Math.min(2.4, cur.minClear) * 2.5 +
          cur.fwdSteps * 1.8 -
          (cur.dir < 0 ? 10.0 : 0.0) -
          loopPen -
          tabuPen;
        if (fbScore > bestFallbackScore) {
          bestFallbackScore = fbScore;
          bestFallbackId = curId;
        }
        if (
          (isFinalClose && remToGoal <= arriveGoalRad) ||
          (!isFinalClose && cur.dir > 0 && dispFromStart >= 16.0 && (remToGoal <= arriveGoalRad || progAlong >= goodHorizonProg))
        ) {
          bestGoalId = curId;
          break;
        }
      }

      if (cur.depth >= maxDepth) continue;
      const isRoot = cur.depth === 0;

      const fwdPrimsNow = grip < 0.65 ? FWD_PRIMS_STORM : FWD_PRIMS;
      for (let i = 0; i < fwdPrimsNow.length; i++) {
        const st = fwdPrimsNow[i];
        // A true K-turn switches steering sign (or straightens) after a REV cusp;
        // in storms enforce across fwdSteps < 2 to eliminate REV(-0.94)->FWD(0.0)->FWD(-0.26..-0.94) self-undo loops!
        if (grip < 0.65
          ? (cur.totalRevs > 0 && cur.fwdSteps < 2 && Math.abs(cur.revSteerSum) > 0.35 && cur.revSteerSum * st > 0.05)
          : (cur.depth > 0 && cur.dir < 0 && Math.abs(cur.revSteerSum) > 0.35 && cur.revSteerSum * st > 0.15)) continue;
        const sameDir = isRoot ? (liveSpeed > 1.2) : (cur.dir > 0);
        const nodeSpdIn = grip < 0.65 ? (cur.dir > 0 ? cur.spd : 2.8) : planEstSpeed;
        const res = rolloutPrimitive(
          cur.x, cur.z, cur.yaw, cur.steerAng, cur.vx, cur.vz, sameDir, nodeSpdIn,
          1, st, arcLen, grip, spec, obs, safetyPad, isRoot, rootStartClear,
        );
        if (!res) continue;

        const key = cellKey(res.x, res.z, res.yaw, 1);
        const steerChangePen = Math.abs(st - cur.steer) * 0.55;
        const turnPen = Math.abs(st) * 0.32;
        const switchPen = (cur.depth > 0 && cur.dir < 0) ? 1.8 : 0.0;
        const clrPen = res.minClear < 1.8 ? (1.8 - res.minClear) * (1.8 - res.minClear) * 1.65 : 0.0;
        const neuralBias = isRoot ? Math.abs(st - neuralSteerPrior) * 0.25 : 0.0;
        let stepTabuPen = 0.0;
        const tSpots = opts.tabuSpots;
        if (tSpots && tSpots.length > 0) {
          const tabuW = (opts.isBreakout && grip < 0.65) ? 30.0 : 18.0;
          for (let ti = 0; ti < tSpots.length; ti++) {
            const tb = tSpots[ti];
            const dRes = Math.hypot(res.x - tb.x, res.z - tb.z);
            if (dRes < tb.r) stepTabuPen += (1.0 - dRes / tb.r) * tabuW;
          }
        }
        const ng = cur.g + arcLen + steerChangePen + turnPen + switchPen + clrPen + neuralBias + stepTabuPen;

        const prevBest = bestGByCell.get(key);
        if (prevBest !== undefined && ng >= prevBest - 0.15) continue;
        bestGByCell.set(key, ng);

        const rem = Math.hypot(goalX - res.x, goalZ - res.z);
        const holoH = queryHoloDist(res.x, res.z, rem);
        const headingToG = Math.atan2(-(goalX - res.x), -(goalZ - res.z));
        const hErr = Math.abs(wrapAngle(res.yaw - headingToG));
        const h = holoH * 1.12 + hErr * (spec.isArmor ? 2.1 : 1.3);

        const nid = nodes.length;
        nodes.push({
          x: res.x, z: res.z, yaw: res.yaw,
          steerAng: res.endSteerAng,
          vx: res.endVx, vz: res.endVz,
          spd: res.endSpd,
          dir: 1, steer: st,
          revSteerSum: (grip < 0.65 && cur.totalRevs > 0 && cur.fwdSteps < 2) ? cur.revSteerSum : 0,
          g: ng, parent: curId,
          depth: cur.depth + 1, revStreak: 0, totalRevs: cur.totalRevs,
          fwdSteps: cur.fwdSteps + 1,
          minClear: res.minClear, samples: res.samples,
        });
        haHeap.push(nid, ng + h);
      }

      // SINGLE-PHASE CLEAN K-TURN ONLY (cur.fwdSteps === 0 -> ONLY REV->FWD, NEVER FWD->REV->FWD!)
      const maxRevDepth = (opts.isBreakout && grip < 0.65) ? 3 : 2;
      if (allowReverse && cur.fwdSteps === 0 && cur.depth < maxRevDepth && cur.totalRevs < maxRevDepth) {
        if (isRoot && liveSpeed > 2.2) continue;
        const revArc = customArc > 0 ? Math.min(3.2, customArc) : (spec.isArmor ? (grip < 0.65 ? 5.2 : 4.3) : 3.2);
        for (let i = 0; i < REV_PRIMS.length; i++) {
          const st = REV_PRIMS[i];
          if (!isRoot && cur.dir < 0 && cur.steer * st < -0.1) continue;
          const res = rolloutPrimitive(
            cur.x, cur.z, cur.yaw, cur.steerAng, undefined, undefined, false, grip < 0.65 ? 3.4 : 4.2,
            -1, st, revArc, grip, spec, obs, Math.min(safetyPad, 0.12), isRoot, rootStartClear,
          );
          if (!res) continue;

          const key = cellKey(res.x, res.z, res.yaw, -1);
          const straightRevPen = (isRoot && Math.abs(st) < 0.1) ? 3.6 : 0.0;
          const revPen = revArc * 1.35 + straightRevPen;
          const clrPen = res.minClear < 1.1 ? (1.1 - res.minClear) * 2.0 : 0.0;
          const ng = cur.g + revPen + clrPen;

          const prevBest = bestGByCell.get(key);
          if (prevBest !== undefined && ng >= prevBest - 0.15) continue;
          bestGByCell.set(key, ng);

          const rem = Math.hypot(goalX - res.x, goalZ - res.z);
          const holoH = queryHoloDist(res.x, res.z, rem);
          const nid = nodes.length;
          nodes.push({
            x: res.x, z: res.z, yaw: res.yaw,
            steerAng: res.endSteerAng,
            vx: res.endVx, vz: res.endVz,
            spd: 2.8,
            dir: -1, steer: st, revSteerSum: cur.revSteerSum + st, g: ng, parent: curId,
            depth: cur.depth + 1, revStreak: cur.revStreak + 1, totalRevs: cur.totalRevs + 1,
            fwdSteps: 0,
            minClear: res.minClear, samples: res.samples,
          });
          haHeap.push(nid, ng + holoH * 1.12 + 2.0);
        }
      }
    }

    const chosenId = bestGoalId >= 0 ? bestGoalId : bestFallbackId;
    if (chosenId <= 0) return null;

    const chain = [];
    let k = chosenId;
    while (k > 0) {
      chain.push(nodes[k]);
      k = nodes[k].parent;
    }
    chain.reverse();

    const samples = [];
    let totalLen = 0;
    let px = pose.cx, pz = pose.cz;
    for (let c = 0; c < chain.length; c++) {
      const segSamples = chain[c].samples;
      for (let s = 0; s < segSamples.length; s++) {
        const pt = segSamples[s];
        totalLen += Math.hypot(pt.x - px, pt.z - pz);
        px = pt.x; pz = pt.z;
        samples.push({ ...pt, cumLen: totalLen });
      }
    }

    const endNode = chain[chain.length - 1];
    const progressM = startDist - Math.hypot(goalX - endNode.x, goalZ - endNode.z);
    const netDispM = Math.hypot(endNode.x - pose.cx, endNode.z - pose.cz);

    return {
      samples,
      totalLen,
      progressM,
      netDispM,
      fwdSteps: endNode.fwdSteps,
      reachedHorizon: bestGoalId >= 0,
      hasReverse: chain.some((n) => n.dir < 0),
      idx: 0,
      planOriginX: pose.cx,
      planOriginZ: pose.cz,
    };
  }

  /**
   * ANTI-LOOP BIDIRECTIONAL 3-POINT-TURN PIVOT PLANNER (v11.1):
   * - During Reverse phase (`allowRev = true`): backs out `[8.2, 6.2, 4.4, 3.0]m` at full lock
   *   rotating the 15.5m nose monotonically toward `targetX, targetZ` (+15..28 deg!).
   * - During Forward phase (`allowRev = false`, i.e., right after a reverse swing during cooldown!):
   *   NEVER drives straight (`steer = 0`) back into the same dead-end wall! Instead pulls forward
   *   `[7.0, 5.0, 3.5, 2.2]m` at FULL OPPOSITE LOCK rotating another +12..24 deg in the EXACT SAME
   *   direction, completing a genuine 3-point / 5-point turnaround inside ANY forest pocket!
   */
  function planThreePointPivot(pose, steerAngle, targetX, targetZ, grip, spec, obs, allowRev, forcedTurnSign = 0, tabuSpots = null, pureReverseExtract = false, prevOrigin = null) {
    const desiredYaw = Math.atan2(-(targetX - pose.cx), -(targetZ - pose.cz));
    const yawDiff = wrapAngle(desiredYaw - pose.yaw);
    const dir = allowRev ? -1 : 1;
    // When entering a new 3-point turn (forcedTurnSign === 0), evaluate BOTH +1 and -1 and commit to the genuinely open side!
    if (forcedTurnSign === 0) {
      const prefSign = yawDiff >= 0 ? 1 : -1;
      const pA = planThreePointPivot(pose, steerAngle, targetX, targetZ, grip, spec, obs, allowRev, prefSign, tabuSpots, pureReverseExtract, prevOrigin);
      const pB = planThreePointPivot(pose, steerAngle, targetX, targetZ, grip, spec, obs, allowRev, -prefSign, tabuSpots, pureReverseExtract, prevOrigin);
      if (pA && pB) {
        const scA = (pA._pivotScore || 0) + 12.0; // slight tie-breaker toward goal yaw
        const scB = (pB._pivotScore || 0);
        return scB > scA ? pB : pA;
      }
      return pA || pB;
    }
    const turnSign = forcedTurnSign;
    // Forward (+1): steer = +turnSign increases yaw by turnSign. Reverse (-1): steer = -turnSign increases yaw by turnSign!
    const idealSteer = (dir > 0 ? turnSign : -turnSign) * 0.96;

    const rootClear = evalPoseClearance(pose.cx, pose.cz, pose.yaw, spec, obs, 0.02).clearance;
    const beforeErr = Math.abs(yawDiff);
    let bestPlan = null;
    let bestScore = -1e9;

    const evalCandidateChain = (segs, bonus = 0) => {
      const last = segs[segs.length - 1];
      const deltaYaw = wrapAngle(last.yaw - pose.yaw);
      // Strongly reward yaw rotation in our committed turnSign direction (NEVER reward undoing our turn!)
      const committedRot = deltaYaw * turnSign;
      const openGridClr = queryGridClearance(last.x, last.z);
      const moveD = Math.hypot(last.x - pose.cx, last.z - pose.cz);
      let minC = 12.0;
      for (let k = 0; k < segs.length; k++) if (segs[k].minClear < minC) minC = segs[k].minClear;

      let probeFwd = null;
      let fwdBonus = 0;
      if (dir < 0) {
        const oppSteer = turnSign * 0.94;
        probeFwd =
          rolloutPrimitive(last.x, last.z, last.yaw, oppSteer * spec.maxSteer, undefined, undefined, false, 5.2, 1, oppSteer, 11.0, grip, spec, obs, 0.08, false, last.minClear) ||
          rolloutPrimitive(last.x, last.z, last.yaw, oppSteer * spec.maxSteer, undefined, undefined, false, 4.8, 1, oppSteer, 6.0, grip, spec, obs, 0.06, false, last.minClear) ||
          rolloutPrimitive(last.x, last.z, last.yaw, oppSteer * spec.maxSteer, undefined, undefined, false, 4.4, 1, oppSteer, 3.6, grip, spec, obs, 0.05, false, last.minClear);
        if (probeFwd) {
          const totalRot = wrapAngle(probeFwd.yaw - pose.yaw) * turnSign;
          fwdBonus = (pureReverseExtract ? 10.0 : 22.0) + totalRot * 38.0 + probeFwd.minClear * 3.0;
        }
      }

      // Penalize forward pivot strokes that drive right back into a known Tabu dead-end tip, and reward backing OUT of it!
      let tabuAdj = 0.0;
      if (tabuSpots && tabuSpots.length > 0) {
        for (let ti = 0; ti < tabuSpots.length; ti++) {
          const tb = tabuSpots[ti];
          const dStart = Math.hypot(pose.cx - tb.x, pose.cz - tb.z);
          const dEnd = Math.hypot(last.x - tb.x, last.z - tb.z);
          if (dir > 0 && dEnd < tb.r && dEnd < dStart + 1.0) {
            tabuAdj -= (1.0 - dEnd / tb.r) * 42.0;
          } else if (dir < 0 && dStart < tb.r && dEnd > dStart + 1.0) {
            tabuAdj += Math.min(22.0, (dEnd - dStart) * 3.2);
          }
        }
      }

      // ANTI-TIME-REVERSAL GUARD: heavily penalize undoing the exact arc we just drove (passing right back through prevOrigin A <-> B!)
      let isUndoCycle = false;
      let undoPen = 0.0;
      if (prevOrigin) {
        const dPrevEnd = Math.hypot(last.x - prevOrigin.x, last.z - prevOrigin.z);
        const yawPrevErr = Math.abs(wrapAngle(last.yaw - prevOrigin.yaw));
        if (dPrevEnd < 2.8 && yawPrevErr < 0.18) {
          isUndoCycle = true;
        } else if (grip < 0.65 && Math.hypot(pose.cx - prevOrigin.x, pose.cz - prevOrigin.z) > 1.8) {
          for (let k = 0; k < segs.length && !isUndoCycle; k++) {
            const arr = segs[k].samples;
            for (let s = 0; s < arr.length; s++) {
              const pt = arr[s];
              if (Math.hypot(pt.x - prevOrigin.x, pt.z - prevOrigin.z) < 2.2 && Math.abs(wrapAngle(pt.yaw - prevOrigin.yaw)) < 0.22) {
                isUndoCycle = true;
                break;
              }
            }
          }
        }
        if (isUndoCycle) undoPen = -180.0;
      }

      const straightPen = Math.abs(committedRot) < 0.04 ? -28.0 : 0.0;
      const distW = pureReverseExtract && dir < 0 ? 4.2 : 1.8;
      const sc = committedRot * 82.0 + openGridClr * 5.0 + minC * 3.5 + moveD * distW + fwdBonus + bonus + straightPen + tabuAdj + undoPen;
      if (sc > bestScore) {
        bestScore = sc;
        const samples = [];
        let tot = 0, px = pose.cx, pz = pose.cz;
        for (let k = 0; k < segs.length; k++) {
          const arr = segs[k].samples;
          for (let s = 0; s < arr.length; s++) {
            const pt = arr[s];
            tot += Math.hypot(pt.x - px, pt.z - pz);
            px = pt.x; pz = pt.z;
            samples.push({ ...pt, cumLen: tot });
          }
        }
        if (probeFwd && !pureReverseExtract) {
          for (let s = 0; s < probeFwd.samples.length; s++) {
            const pt = probeFwd.samples[s];
            tot += Math.hypot(pt.x - px, pt.z - pz);
            px = pt.x; pz = pt.z;
            samples.push({ ...pt, cumLen: tot });
          }
        }
        bestPlan = {
          samples,
          totalLen: tot,
          progressM: 0,
          netDispM: Math.hypot(px - pose.cx, pz - pose.cz),
          fwdSteps: probeFwd ? 2 : (dir > 0 ? 1 : 0),
          reachedHorizon: false,
          hasReverse: dir < 0,
          isPivotEscape: true,
          pivotTurnSign: turnSign,
          _pivotScore: sc,
          _rotAbs: Math.abs(committedRot),
          _isUndoCycle: isUndoCycle,
          idx: 0,
          planOriginX: pose.cx,
          planOriginZ: pose.cz,
          planOriginYaw: pose.yaw,
        };
      }
    };

    // STRICTLY commit to turnSign steers (NEVER drive straight 0.0 back into a dead-end wall on forward pivot!)
    const cands = dir < 0
      ? [idealSteer, idealSteer * 0.72, idealSteer * 0.42, idealSteer * 0.24, 0.0]
      : [idealSteer, idealSteer * 0.72, idealSteer * 0.42, idealSteer * 0.24];
    const lens = dir < 0 ? [10.0, 8.0, 6.0, 4.2, 2.8, 1.8] : [8.0, 5.6, 3.8, 2.4, 1.6];

    const runSweep = (pad) => {
      let gotGoodDirectTurn = false;
      for (let i = 0; i < cands.length; i++) {
        const st = cands[i];
        for (let li = 0; li < lens.length; li++) {
          // Assume dry-steer pre-crank aligns wheels before moving!
          const res = rolloutPrimitive(
            pose.cx, pose.cz, pose.yaw, st * spec.maxSteer, undefined, undefined, false,
            dir < 0 ? 4.3 : 4.8, dir, st, lens[li], grip, spec, obs, pad, true, rootClear,
          );
          if (res) {
            evalCandidateChain([res], 0);
            if (i <= 1 && lens[li] >= 4.2) gotGoodDirectTurn = true;
            break;
          }
        }
      }

      // 2-Stage Coach Slot Escape (when direct full-lock turning was blocked/short!):
      if (dir < 0 && !gotGoodDirectTurn) {
        const stage1Specs = [
          { st: 0.0, lens: [1.8, 3.0], allowStraightS2: false },
          { st: idealSteer * 0.25, lens: [2.2, 1.4], allowStraightS2: true },
        ];
        for (let sp = 0; sp < stage1Specs.length; sp++) {
          const spec1 = stage1Specs[sp];
          for (let si = 0; si < spec1.lens.length; si++) {
            const s1 = rolloutPrimitive(
              pose.cx, pose.cz, pose.yaw, spec1.st * spec.maxSteer, undefined, undefined, false, 4.3, -1, spec1.st, spec1.lens[si], grip, spec, obs, pad, true, rootClear,
            );
            if (!s1) continue;
            const turnLocks = spec1.allowStraightS2 ? [idealSteer, idealSteer * 0.65, 0.0] : [idealSteer, idealSteer * 0.65];
            for (let k = 0; k < turnLocks.length; k++) {
              const stage2 =
                rolloutPrimitive(s1.x, s1.z, s1.yaw, s1.endSteerAng, undefined, undefined, false, 4.3, -1, turnLocks[k], 5.2, grip, spec, obs, pad, false, s1.minClear) ||
                rolloutPrimitive(s1.x, s1.z, s1.yaw, s1.endSteerAng, undefined, undefined, false, 4.3, -1, turnLocks[k], 3.4, grip, spec, obs, pad, false, s1.minClear) ||
                rolloutPrimitive(s1.x, s1.z, s1.yaw, s1.endSteerAng, undefined, undefined, false, 4.3, -1, turnLocks[k], 2.0, grip, spec, obs, pad, false, s1.minClear);
              if (stage2) evalCandidateChain([s1, stage2], si === 0 ? 3.5 : 1.5);
            }
          }
        }
      } else if (dir > 0 && !gotGoodDirectTurn) {
        // Forward 2-stage slot slide: ONLY pull straight past flanking trunks if it genuinely unlocks a turn!
        const fLens = [4.6, 2.8];
        for (let si = 0; si < fLens.length; si++) {
          const s1 = rolloutPrimitive(
            pose.cx, pose.cz, pose.yaw, 0.0, undefined, undefined, false, 4.4, 1, 0.0, fLens[si], grip, spec, obs, pad, true, rootClear,
          );
          if (!s1) continue;
          const turnLocks = [idealSteer, idealSteer * 0.65];
          for (let k = 0; k < turnLocks.length; k++) {
            const stage2 =
              rolloutPrimitive(s1.x, s1.z, s1.yaw, s1.endSteerAng, undefined, undefined, false, 4.4, 1, turnLocks[k], 4.2, grip, spec, obs, pad, false, s1.minClear) ||
              rolloutPrimitive(s1.x, s1.z, s1.yaw, s1.endSteerAng, undefined, undefined, false, 4.4, 1, turnLocks[k], 2.4, grip, spec, obs, pad, false, s1.minClear);
            if (stage2) {
              evalCandidateChain([s1, stage2], 2.0);
            }
          }
        }
      }
    };

    runSweep(0.05);
    if (!bestPlan || (bestPlan.totalLen < 2.6 && (bestPlan._rotAbs || 0) < 0.05)) {
      runSweep(0.01);
    }

    return bestPlan;
  }

  /**
   * EXACT-PHYSICAL MICRO-SLOT PARALLEL-PARKING ESCAPE SOLVER (v21.3):
   * When ARMOR-155 is wedged inside a sub-2m multi-tree pocket where coarse 4-6m primitives fail
   * and single-stroke turns hit within 0.8-1.2m, this fine 0.85m bidirectional SE(2) A* solver
   * computes exact multi-stroke parallel-parking S-shifts (FWD <-> REV) using exact rawR parity
   * with scene3d.js (~190-650 nodes, < 1.2 ms) to shift laterally into open glades and extract cleanly!
   */
  const MICRO_STEERS = [-0.96, -0.48, 0.0, 0.48, 0.96];
  function planMicroSlotEscape(pose, targetX, targetZ, grip, spec, obs, canRevNow, pivotSign = 0) {
    const rootPhys = evalPoseClearance(pose.cx, pose.cz, pose.yaw, spec, obs, 0.0, true).clearance;
    const basePad = rootPhys < 0.015 ? Math.min(0.0, rootPhys - 0.001) : 0.008;
    const steerGrip = 0.58 + 0.42 * grip;
    const useFineStep = rootPhys < 0.03;
    const stepLen = useFineStep ? 0.50 : 0.85;
    const subSteps = useFineStep ? 2 : 3;
    const ds = stepLen / subSteps;
    const cellXY = useFineStep ? 0.22 : 0.30;
    const yawBin = 0.025;
    const maxExpansions = useFineStep ? 1200 : 950;
    const maxDepth = useFineStep ? 24 : 18;
    const maxRevStreak = useFineStep ? 10 : 6; // <= 5.1m (~2.0s reverse, well under 4.5s INFINITE_REVERSE_DQ!)

    const cellKey = (x, z, y, dir) => {
      const ix = Math.round((x - pose.cx) / cellXY) + 256;
      const iz = Math.round((z - pose.cz) / cellXY) + 256;
      const iy = ((Math.round((wrapAngle(y) + Math.PI) / yawBin)) % 256 + 256) % 256;
      return ((ix * 512 + iz) * 512) + (iy * 2) + (dir > 0 ? 1 : 0);
    };

    const nodes = [{
      x: pose.cx, z: pose.cz, yaw: pose.yaw,
      dir: 0, steer: 0, g: 0, parent: -1, depth: 0, revStreak: 0,
      clear: rootPhys, samples: null,
    }];
    const visited = new Set();
    haHeap.clear();
    haHeap.push(0, 0);

    const startDistGoal = Math.hypot(targetX - pose.cx, targetZ - pose.cz);
    let bestGoalId = -1;
    let bestFallbackId = 0;
    let bestFallbackScore = -1e9;
    let expanded = 0;

    while (haHeap.len > 0 && expanded++ < maxExpansions) {
      const curId = haHeap.pop();
      const cur = nodes[curId];
      const disp = Math.hypot(cur.x - pose.cx, cur.z - pose.cz);
      const dYaw = wrapAngle(cur.yaw - pose.yaw);
      const dYawAbs = Math.abs(dYaw);

      if (cur.depth >= 2) {
        const goalGain = startDistGoal - Math.hypot(targetX - cur.x, targetZ - cur.z);
        const pivBonus = pivotSign !== 0 ? (dYaw * pivotSign * 16.0) : 0.0;
        const unwindPen = (grip < 0.65 && pivotSign !== 0 && dYaw * pivotSign < -0.04) ? 40.0 : 0.0;
        const fbScore = disp * 3.8 + dYawAbs * 22.0 + pivBonus - unwindPen + Math.min(0.6, cur.clear) * 18.0 + goalGain * 0.35 - cur.g * 0.15;
        if (fbScore > bestFallbackScore) {
          bestFallbackScore = fbScore;
          bestFallbackId = curId;
        }
        if (
          disp >= 6.8 ||
          (disp >= 3.2 && cur.clear >= 0.30 && (grip >= 0.65 || pivotSign === 0 || dYaw * pivotSign > -0.04)) ||
          (dYawAbs >= 0.16 && cur.clear >= 0.15 && disp >= 1.8 && (pivotSign === 0 || dYaw * pivotSign > -0.02))
        ) {
          bestGoalId = curId;
          break;
        }
      }
      if (cur.depth >= maxDepth) continue;

      const dirs = (cur.depth === 0 && !canRevNow) ? [1] : [1, -1];
      for (let di = 0; di < dirs.length; di++) {
        const dir = dirs[di];
        if (dir < 0 && cur.revStreak >= maxRevStreak) continue;
        for (let si = 0; si < MICRO_STEERS.length; si++) {
          const st = MICRO_STEERS[si];
          if (cur.depth > 0 && cur.dir === -dir && Math.abs(cur.steer - st) < 0.05) continue;

          const stormMicroPad = grip < 0.65 ? 0.022 : 0.016;
          const padNow = cur.depth >= 5 ? Math.max(basePad, stormMicroPad) : basePad;
          const tanSteer = Math.tan(st * spec.maxSteer) * steerGrip;
          let nx = cur.x, nz = cur.z, ny = cur.yaw;
          let ok = true;
          let minC = 12.0;
          const segSamples = [];
          for (let sub = 0; sub < subSteps; sub++) {
            const stepD = dir * ds;
            ny += (stepD / spec.wheelbase) * tanSteer;
            nx += -Math.sin(ny) * stepD;
            nz += -Math.cos(ny) * stepD;
            const chk = evalPoseClearance(nx, nz, ny, spec, obs, padNow, true);
            if (chk.hit) {
              if (cur.depth === 0 && chk.clearance >= rootPhys - 0.0005 && chk.clearance >= basePad) {
                // Allow gentle initial un-grazing step away from bark
              } else {
                ok = false;
                break;
              }
            }
            if (chk.clearance < minC) minC = chk.clearance;
            segSamples.push({ x: nx, z: nz, yaw: ny, dir, steer: st, minClear: Math.max(0, chk.clearance) });
          }
          if (!ok) continue;

          const k = cellKey(nx, nz, ny, dir);
          if (visited.has(k)) continue;
          visited.add(k);

          const switchPen = (cur.dir !== 0 && cur.dir !== dir) ? 1.5 : 0.0;
          const steerJumpPen = (cur.dir === dir && Math.abs(st - cur.steer) > 0.55) ? 0.5 : 0.0;
          const ng = cur.g + stepLen + switchPen + steerJumpPen;
          const nDisp = Math.hypot(nx - pose.cx, nz - pose.cz);
          const nYawAbs = Math.abs(wrapAngle(ny - pose.yaw));
          const h = Math.max(0, 7.0 - nDisp) * 1.15 - Math.min(0.45, minC) * 4.5 - nYawAbs * 6.0;

          const nid = nodes.length;
          nodes.push({
            x: nx, z: nz, yaw: ny,
            dir, steer: st, g: ng, parent: curId,
            depth: cur.depth + 1,
            revStreak: dir < 0 ? cur.revStreak + 1 : 0,
            clear: minC, samples: segSamples,
          });
          haHeap.push(nid, ng + h);
        }
      }
    }

    const chosenId = bestGoalId >= 0 ? bestGoalId : bestFallbackId;
    if (chosenId <= 0) return null;

    const chain = [];
    let cId = chosenId;
    while (cId > 0) {
      chain.push(nodes[cId]);
      cId = nodes[cId].parent;
    }
    chain.reverse();

    const samples = [];
    let tot = 0, px = pose.cx, pz = pose.cz;
    for (let i = 0; i < chain.length; i++) {
      const arr = chain[i].samples;
      for (let s = 0; s < arr.length; s++) {
        const pt = arr[s];
        tot += Math.hypot(pt.x - px, pt.z - pz);
        px = pt.x; pz = pt.z;
        samples.push({ ...pt, cumLen: tot });
      }
    }
    const endNode = chain[chain.length - 1];
    const netDispM = Math.hypot(endNode.x - pose.cx, endNode.z - pose.cz);
    const endDYaw = wrapAngle(endNode.yaw - pose.yaw);
    const rotAbs = Math.abs(endDYaw);
    const hasRev = chain.some((n) => n.dir < 0);
    // NEVER return a zero-rotation straight-forward micro-slot or unwind an active 3-point turn!
    if (!hasRev && rotAbs < 0.04) return null;
    if (pivotSign !== 0 && bestGoalId < 0 && endDYaw * pivotSign < -0.03 && netDispM < 3.5) return null;
    if (bestGoalId < 0 && netDispM < 3.2 && (rotAbs < 0.09 || netDispM < 1.8)) return null;

    return {
      samples,
      totalLen: tot,
      progressM: startDistGoal - Math.hypot(targetX - endNode.x, targetZ - endNode.z),
      netDispM,
      fwdSteps: chain.filter((n) => n.dir > 0).length,
      reachedHorizon: false,
      hasReverse: chain.some((n) => n.dir < 0),
      isPivotEscape: true,
      isMicroSlot: true,
      _rotAbs: rotAbs,
      idx: 0,
      planOriginX: pose.cx,
      planOriginZ: pose.cz,
      planOriginYaw: pose.yaw,
    };
  }

  /**
   * Real-time Slip-Aware Immediate Safety Shield.
   */
  function checkImmediateSafety(pose, speed, steerAngNow, steerCmd, velX, velZ, grip, spec, obs, maxDistOverride = 0) {
    const dir = speed >= -0.05 ? 1 : -1;
    const spdAbs = Math.max(3.0, Math.abs(speed));
    const stopDist = (spdAbs * spdAbs) / (2.0 * (spec.accelRev || 4.2) * (0.42 + 0.58 * grip)) + 2.4;
    const capDist = maxDistOverride > 0 ? maxDistOverride : (spec.isArmor ? 18.0 : 12.0);
    const checkDist = clamp(Math.max(stopDist, spdAbs * 0.90), 3.6, capDist);
    const steps = clamp(Math.ceil(checkDist / 0.78), 5, 22);
    const dtStep = (checkDist / spdAbs) / steps;
    const targetSteer = steerCmd * spec.maxSteer;
    const steerGrip = 0.58 + 0.42 * grip;
    const kLat = 0.42 + grip * grip * 12.8;
    const latResp = 1.0 - Math.exp(-kLat * dtStep);
    const driftDt = latResp / kLat;
    const hydroActive = grip < 0.65 && spdAbs > 1.5;
    const hydroFactor = hydroActive ? ((0.65 - grip) / 0.47) * 0.52 * 2.8 : 0.0;
    let slopeSlipVx = 0, slopeSlipVz = 0;
    if (grip < 0.72 && geomorph) {
      const mn = geomorph.getMacroNormalAt(pose.cx, pose.cz, 3.2);
      if (mn.slope > 0.06) {
        const slSlip = (0.72 - grip) * 5.2 * (spec.isArmor ? 0.68 : 1.0);
        slopeSlipVx = mn.x * slSlip;
        slopeSlipVz = mn.z * slSlip;
      }
    }

    let x = pose.cx, z = pose.cz, y = pose.yaw;
    let str = steerAngNow;
    let vx = velX, vz = velZ;
    let minClear = 12.0;

    for (let s = 1; s <= steps; s++) {
      str += (targetSteer - str) * Math.min(1.0, dtStep * spec.steerRate);
      const d = dir * spdAbs * dtStep;
      y += (d / spec.wheelbase) * Math.tan(str) * steerGrip;
      const tvx = -Math.sin(y) * (dir * spdAbs);
      const tvz = -Math.cos(y) * (dir * spdAbs);
      vx += (tvx - vx) * latResp;
      vz += (tvz - vz) * latResp;
      if (hydroActive) {
        const turnSlide = Math.sin(str) * (dir * spdAbs) * hydroFactor;
        vx += Math.cos(y) * turnSlide * driftDt;
        vz += -Math.sin(y) * turnSlide * driftDt;
      }
      if (slopeSlipVx !== 0 || slopeSlipVz !== 0) {
        vx += slopeSlipVx * driftDt;
        vz += slopeSlipVz * driftDt;
      }
      x += vx * dtStep;
      z += vz * dtStep;
      const chk = evalPoseClearance(x, z, y, spec, obs, 0.04);
      if (chk.hit) {
        return { safe: false, hitStep: s, steps, hitDist: (s / steps) * checkDist, minClear: chk.clearance };
      }
      if (chk.clearance < minClear) minClear = chk.clearance;
    }
    return { safe: true, hitStep: -1, steps, hitDist: checkDist, minClear };
  }

  function pickSafestBrakingSteer(pose, speed, steerAngNow, velX, velZ, grip, spec, obs) {
    const cands = [0.0, -0.35, 0.35, -0.70, 0.70, -1.0, 1.0];
    let bestSteer = 0;
    let bestScore = -1e9;
    for (let i = 0; i < cands.length; i++) {
      const st = cands[i];
      const saf = checkImmediateSafety(pose, Math.max(speed, 4.0), steerAngNow, st, velX, velZ, grip, spec, obs);
      const sc = (saf.safe ? 100.0 : saf.hitDist * 4.0) + saf.minClear * 3.0 - Math.abs(st) * 0.4;
      if (sc > bestScore) {
        bestScore = sc;
        bestSteer = st;
      }
    }
    return bestSteer;
  }

  const terrainRadarBuf = new Float32Array(8);

  /**
   * Master Per-Frame APEX-OMNIDRIVE v6.0 / TITAN-CORE Hybrid Controller!
   */
  function evaluateApexControl(ctx) {
    const {
      pose,
      speed,
      velX,
      velZ,
      steerAngle,
      grip,
      route,
      vehicleKey,
      spec,
      providers,
      dt,
      wasBlocked,
      onRoad,
      isTowing,
      fwdUphill,
      latSlope,
    } = ctx;

    if (!route || !route.points || route.points.length < 2) {
      return { throttle: 0, steer: 0, arrived: true, mode: 'IDLE', lidarFrontMin: LIDAR_MAX_RANGE };
    }

    const pts = route.points;
    const goal = pts[pts.length - 1];
    const distToGoal = Math.hypot(goal[0] - pose.cx, goal[1] - pose.cz);
    const arriveDist = route.isSummon ? Math.max(spec.arriveDist, 7.2) : spec.arriveDist;
    if (distToGoal < arriveDist) {
      return { throttle: 0, steer: 0, arrived: true, mode: 'ARRIVED', lidarFrontMin: LIDAR_MAX_RANGE };
    }

    // 1. Advance macro route cursor STRICTLY monotonically inside bounded arc window
    let cursor = route.cursor || 0;
    let bestD = Math.hypot(pts[cursor][0] - pose.cx, pts[cursor][1] - pose.cz);
    let scanArc = 0;
    for (let i = cursor + 1; i < pts.length && scanArc < 240.0; i++) {
      scanArc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const d = Math.hypot(pts[i][0] - pose.cx, pts[i][1] - pose.cz);
      if (d < bestD) { bestD = d; cursor = i; }
    }
    const cursorAdvanced = cursor > (route.cursor || 0);
    route.cursor = cursor;

    // 2. Gather unified obstacles within 105m (O(1) spatial hash!)
    const obs = gatherUnifiedObstacles(pose.cx, pose.cz, 105.0, providers, spec, wasBlocked);

    // 3. Scan 32-Ray Virtual LiDAR
    const lidar = scanVirtualLidar32(pose, obs, spec);

    // 4. Reverse Guard, Tabu Dead-End Memory & Yo-Yo-Proof 13.5m Stall Escalation
    if (!route.tabuSpots) route.tabuSpots = [];
    for (let i = route.tabuSpots.length - 1; i >= 0; i--) {
      route.tabuSpots[i].ttl -= dt;
      if (route.tabuSpots[i].ttl <= 0) route.tabuSpots.splice(i, 1);
    }

    route.revCooldownTimer = Math.max(0, (route.revCooldownTimer || 0) - dt);
    if (speed < -0.25) {
      route.revElapsed = (route.revElapsed || 0) + dt;
    } else {
      if ((route.revElapsed || 0) > 2.05) {
        route.revCooldownTimer = Math.max(route.revCooldownTimer, 0.08);
      }
      route.revElapsed = 0;
    }

    const movedStep = Math.hypot(pose.cx - (route.prevPoseX ?? pose.cx), pose.cz - (route.prevPoseZ ?? pose.cz));
    const speedDelta = Math.abs(speed - (route.prevSpeed ?? speed));
    route.prevPoseX = pose.cx;
    route.prevPoseZ = pose.cz;
    route.prevSpeed = speed;
    // Only count non-blocked micro-stall when truly immobile (zero velocity AND zero acceleration, NEVER during normal braking/gear reversals!)
    if (wasBlocked || (movedStep < Math.max(0.012, dt * 0.25) && Math.abs(speed) < 0.35 && speedDelta < 0.04)) {
      route.microStallTimer = (route.microStallTimer || 0) + dt;
    } else {
      route.microStallTimer = Math.max(0, (route.microStallTimer || 0) - dt * 2.0);
    }

    if (route.yoAnchorX === undefined) {
      route.yoAnchorX = pose.cx;
      route.yoAnchorZ = pose.cz;
      route.yoClock = 0;
      route.stallEscalation = 0;
      route.localKTurns = 0;
    }
    const curPlanObj = route.se2Plan;
    const curSampleNow = (curPlanObj && curPlanObj.samples && (curPlanObj.idx || 0) < curPlanObj.samples.length)
      ? curPlanObj.samples[curPlanObj.idx || 0]
      : null;
    const activelyEscapingLong = Boolean(
      curPlanObj && !wasBlocked && (
        (curPlanObj.totalLen >= 25.0 && !curPlanObj.hasReverse && speed > 2.2) ||
        (curPlanObj.hasReverse && curPlanObj.totalLen >= 25.0 && (curPlanObj.reachedHorizon || curPlanObj.totalLen >= 35.0) && curSampleNow)
      ),
    );
    const distFromYoAnchor = Math.hypot(pose.cx - route.yoAnchorX, pose.cz - route.yoAnchorZ);
    if (distFromYoAnchor > 13.5 || cursorAdvanced) {
      route.yoAnchorX = pose.cx;
      route.yoAnchorZ = pose.cz;
      route.yoClock = 0;
      route.localKTurns = 0;
      route.localHits = 0;
      route.extractStartX = undefined;
      route.extractStartZ = undefined;
      if (cursorAdvanced || bestD > 55.0) {
        route.stallEscalation = 0;
      } else if (route.stallEscalation > 0) {
        route.stallEscalation = Math.max(0, route.stallEscalation - 1);
      }
    } else {
      route.yoClock = (route.yoClock || 0) + (activelyEscapingLong ? dt * 0.45 : dt);
    }

    if (wasBlocked && !route._prevFrameBlocked) {
      if (distFromYoAnchor < 15.0) {
        route.localHits = (route.localHits || 0) + 1;
        route.yoClock = (route.yoClock || 0) + 1.4;
      }
      if (route.localHits >= 2 || (route.stallEscalation || 0) >= 3) {
        const hitX = pose.cx - Math.sin(pose.yaw) * 4.5;
        const hitZ = pose.cz - Math.cos(pose.yaw) * 4.5;
        const alreadyNear = route.tabuSpots.some((tb) => Math.hypot(tb.x - hitX, tb.z - hitZ) < 6.0);
        if (!alreadyNear) {
          route.tabuSpots.push({ x: hitX, z: hitZ, r: 11.5, ttl: 24.0 });
          if (route.tabuSpots.length > 12) route.tabuSpots.shift();
        }
      } else if (grip < 0.65) {
        // Tight storm dead-end tip Tabu on Hit #1 so storm K-turns steer around the tree instead of re-entering the exact same spot!
        const hitX = pose.cx - Math.sin(pose.yaw) * 6.5;
        const hitZ = pose.cz - Math.cos(pose.yaw) * 6.5;
        const alreadyNear = route.tabuSpots.some((tb) => Math.hypot(tb.x - hitX, tb.z - hitZ) < 5.5);
        if (!alreadyNear) {
          route.tabuSpots.push({ x: hitX, z: hitZ, r: 8.0, ttl: 20.0 });
          if (route.tabuSpots.length > 12) route.tabuSpots.shift();
        }
      }
    }
    route._prevFrameBlocked = wasBlocked;

    const isStormYo = grip < 0.65;
    const inCleanRevStroke = Boolean(isStormYo && curSampleNow && curSampleNow.dir < 0 && !wasBlocked && (route.revElapsed || 0) < 2.8);
    const longFwdStormEscape = Boolean(isStormYo && curPlanObj && !curPlanObj.hasReverse && curPlanObj.totalLen >= 35.0 && speed > 2.2);
    const escapeHoldSec = isStormYo ? (longFwdStormEscape ? 6.8 : 5.2) : ((curPlanObj && curPlanObj.hasReverse) ? 4.2 : 5.0);
    const protectActiveEscape = (
      (activelyEscapingLong && route.yoClock <= escapeHoldSec) ||
      (inCleanRevStroke && route.yoClock <= 3.8)
    ) && (route.localHits || 0) < 2;
    const yoLim = isStormYo ? 3.5 : 2.5;
    const kTurnLim = isStormYo ? 4 : 2;
    if (!protectActiveEscape && (route.yoClock > yoLim || (route.localKTurns || 0) >= kTurnLim)) {
      route.yoAnchorX = pose.cx;
      route.yoAnchorZ = pose.cz;
      route.yoClock = 0;
      route.localKTurns = 0;
      route.localHits = 0;
      route.stallEscalation = Math.min(8, (route.stallEscalation || 0) + 1);
      route.flankFlipCount = (route.flankFlipCount || 0) + 1;

      // Drop strong Tabu zone RIGHT on the dead-end tip so Wide-Glade Dijkstra & Hybrid A* never re-enter it!
      route.tabuSpots.push({
        x: pose.cx - Math.sin(pose.yaw) * 10.5,
        z: pose.cz - Math.cos(pose.yaw) * 10.5,
        r: 20.0,
        ttl: 34.0,
      });
      if (route.tabuSpots.length > 10) route.tabuSpots.shift();

      route.se2Plan = null;
      route.replanCooldown = 0;
    }

    const sinY = Math.sin(pose.yaw);
    const cosY = Math.cos(pose.yaw);
    const toLocal = (wx, wz) => {
      const dx = wx - pose.cx;
      const dz = wz - pose.cz;
      return [cosY * dx - sinY * dz, -sinY * dx - cosY * dz];
    };

    const pNear = samplePathAhead(pts, cursor, pose.cx, pose.cz, 12.0);
    const pMid  = samplePathAhead(pts, cursor, pose.cx, pose.cz, 28.0);
    // When off-centerline (>35m), sample 74m FORWARD from pts[cursor] so we smoothly rejoin ahead instead of orbiting backward!
    const pHorizon = bestD > 35.0
      ? samplePathAhead(pts, cursor, pts[cursor][0], pts[cursor][1], 74.0)
      : samplePathAhead(pts, cursor, pose.cx, pose.cz, 74.0);

    const locNear = toLocal(pNear[0], pNear[1]);
    const locMid  = toLocal(pMid[0], pMid[1]);
    const locFar  = toLocal(pHorizon[0], pHorizon[1]);

    const curVx = velX ?? (-sinY * speed);
    const curVz = velZ ?? (-cosY * speed);

    // 5. TITAN-CORE v6.0 Recurrent Omni-Modal Policy (~0.35 ms) / Legacy v4 Residual Policy (~0.03 ms)
    let neuralOut = {
      steerCmd: 0, throttleCmd: 0, steerBias: 0, speedScale: 1.0,
      kTurnIntent: -1.0, reverseIntent: -1.0, confidence: 0.0, isTitanV6: false,
    };
    const isTitanMode = Boolean(neuralPolicy && neuralPolicy.getMeta && neuralPolicy.getMeta().isTitanV6);
    if (neuralPolicy) {
      let lookArr = [locNear[0], locNear[1], locMid[0], locMid[1], locFar[0], locFar[1]];
      let extraState = null;
      if (isTitanMode) {
        const pFar90 = samplePathAhead(pts, cursor, pose.cx, pose.cz, 90.0);
        const loc90 = toLocal(pFar90[0], pFar90[1]);
        lookArr = [locNear[0], locNear[1], locMid[0], locMid[1], locFar[0], locFar[1], loc90[0], loc90[1]];

        // 8-Ray Terrain Elevation / Slope / Cliff / Water Radar (bit-exact parity with TitanOmniWorldGPU!)
        const fwdX = -sinY, fwdZ = -cosY;
        const rgtX = cosY, rgtZ = -sinY;
        const h0 = geomorph ? geomorph.getHeightAt(pose.cx, pose.cz) : 0;
        const hF10 = geomorph ? geomorph.getHeightAt(pose.cx + fwdX * 10.0, pose.cz + fwdZ * 10.0) : h0;
        const hL10 = geomorph ? geomorph.getHeightAt(pose.cx + (fwdX * 0.82 - rgtX * 0.57) * 10.0, pose.cz + (fwdZ * 0.82 - rgtZ * 0.57) * 10.0) : h0;
        const hR10 = geomorph ? geomorph.getHeightAt(pose.cx + (fwdX * 0.82 + rgtX * 0.57) * 10.0, pose.cz + (fwdZ * 0.82 + rgtZ * 0.57) * 10.0) : h0;
        const hF25 = geomorph ? geomorph.getHeightAt(pose.cx + fwdX * 25.0, pose.cz + fwdZ * 25.0) : h0;
        const floodNow = storm && storm.getFloodInfoAt ? storm.getFloodInfoAt(pose.cx, pose.cz).depth : 0;
        terrainRadarBuf[0] = clamp((hL10 - h0) / 10.0, -1.0, 1.0);
        terrainRadarBuf[1] = clamp((hF10 - h0) / 10.0, -1.0, 1.0);
        terrainRadarBuf[2] = clamp((hR10 - h0) / 10.0, -1.0, 1.0);
        terrainRadarBuf[3] = clamp((hF25 - h0) / 25.0, -1.0, 1.0);
        terrainRadarBuf[4] = clamp((latSlope || 0) * 1.5, -1.0, 1.0);
        terrainRadarBuf[5] = clamp(Math.abs(fwdUphill || 0) + Math.abs(latSlope || 0), 0.0, 1.0);
        terrainRadarBuf[6] = clamp(floodNow / 2.0, 0.0, 1.0);
        terrainRadarBuf[7] = clamp((1.0 - grip) * 1.25, 0.0, 1.0);

        const latVel = curVx * rgtX + curVz * rgtZ;
        const yawRate = dt > 1e-4 ? wrapAngle(pose.yaw - (route._prevTitanYaw ?? pose.yaw)) / dt : 0;
        route._prevTitanYaw = pose.yaw;
        const prevThr = route.prevThrottleCmd || 0;
        const nomDv = (prevThr * (spec.accelFwd || 7.8) * 0.85) * dt;
        const actualDv = speed - (route._prevTitanSpd ?? speed);
        route._prevTitanSpd = speed;
        const troubleSig = wasBlocked ? 1.0 : clamp((nomDv - actualDv) / 1.2, -1.0, 1.0);

        extraState = {
          terrainRadar: terrainRadarBuf,
          floodDepth: floodNow,
          latVel,
          yawRate,
          maxSteer: spec.maxSteer,
          hl: spec.hl,
          hw: spec.hw,
          prevThrottleCmd: prevThr,
          steerDelta: (route.prevSteerCmd || 0) - (route._prevSteerCmd2 || 0),
          troubleSignal: troubleSig,
        };
      }
      neuralPolicy.encodeObservation(
        lidar.rays,
        lookArr,
        {
          speed, steerAngle, grip,
          fwdUphill: fwdUphill || 0, latSlope: latSlope || 0,
          onRoad, isArmor: spec.isArmor, isTowing, distToGoal,
          prevSteerCmd: route.prevSteerCmd || 0,
          ...(extraState || {}),
        },
      );
      neuralOut = neuralPolicy.infer(undefined, vehicleKey || 'default');
    }

    // =========================================================================
    // 5B. TITAN-CORE v6.0 DIRECT HUMAN-GRADE NEURAL AUTHORITY + OBB SAFETY SHIELD
    // Active ONLY when Colab Pro TITAN-CORE v6.0 weights are loaded (`isTitanV6`).
    // Delivers silky C² minimum-jerk steering, outside-in-outside apex flow, real
    // ice/mud counter-steering & zero-shot trouble adaptation — backed by our exact
    // physical OBB stopping-distance guardian so it NEVER collides!
    // =========================================================================
    if (
      neuralOut.isTitanV6 &&
      neuralOut.confidence >= 0.42 &&
      !wasBlocked &&
      (route.stallEscalation || 0) < 2 &&
      (route.consecBlockFrames || 0) === 0 &&
      (route.unwedgeHoldTimer || 0) <= 0
    ) {
      const wantRev = neuralOut.throttleCmd < -0.25 && speed < 0.8 && (route.revElapsed || 0) < 3.4;
      const rawSt = clamp(neuralOut.steerCmd, -1.0, 1.0);
      const rawThr = clamp(neuralOut.throttleCmd, -1.0, 1.0);
      // C² minimum-jerk human-chauffeur smoothing (eliminates all robotic twitching!)
      const prevSt = route.prevSteerCmd ?? rawSt;
      const smoothSt = clamp(prevSt + (rawSt - prevSt) * 0.58, -1.0, 1.0);
      const prevThr = route.prevThrottleCmd ?? rawThr;
      const smoothThr = clamp(prevThr + (rawThr - prevThr) * 0.62, -1.0, 1.0);

      if (!wantRev) {
        const safTitan = checkImmediateSafety(
          pose, Math.max(speed, 5.0), steerAngle, smoothSt, curVx, curVz, grip, spec, obs, 0,
        );
        if (safTitan.safe && safTitan.minClear > 0.38) {
          // Gentle goal-approach braking cap so arrival is smooth & dignified
          const goalSpdCap = clamp(distToGoal * 0.55, 2.2, spec.maxSpeed);
          const finalThr = (speed > goalSpdCap + 1.0) ? -0.55 : smoothThr;
          const latSlipNow = Math.abs(curVx * cosY - curVz * sinY);
          route._prevSteerCmd2 = prevSt;
          route.prevSteerCmd = smoothSt;
          route.prevThrottleCmd = finalThr;
          route.se2Plan = null;
          return {
            throttle: finalThr,
            steer: smoothSt,
            arrived: false,
            mode: (grip < 0.65 && latSlipNow > 1.2) ? 'TITAN_DRIFT' : 'TITAN_AI',
            lidarFrontMin: lidar.frontMinM,
            neuralOut,
          };
        }
      } else if (lidar.rearMinM > 2.8) {
        route._prevSteerCmd2 = prevSt;
        route.prevSteerCmd = smoothSt;
        route.prevThrottleCmd = smoothThr;
        route.se2Plan = null;
        return {
          throttle: clamp(smoothThr, -0.92, -0.35),
          steer: smoothSt,
          arrived: false,
          mode: 'TITAN_KTURN',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }
    }

    // =========================================================================
    // 6. FAST HIGHWAY ROAD CRUISE SHORTCUT (0.05 ms on clean tree-free 21 roads!)
    // =========================================================================
    const roadClearAhead = onRoad && lidar.frontMinM > 32.0 && obs.boxes.length === 0 && obs.obbs.length === 0 && !wasBlocked && !route.se2Plan && route.tabuSpots.length === 0;
    if (roadClearAhead && locMid[1] > 4.0) {
      const lookM = clamp(12.0 + Math.abs(speed) * 1.05, spec.lookaheadMin, spec.lookaheadMax);
      const pRoad = samplePathAhead(pts, cursor, pose.cx, pose.cz, lookM);
      const lr = toLocal(pRoad[0], pRoad[1]);
      const hErr = Math.atan2(lr[0], Math.max(1.0, lr[1]));
      const steerCmd = clamp(-hErr * (spec.isArmor ? 1.85 : 2.05), -1.0, 1.0);

      const saf = checkImmediateSafety(pose, Math.max(speed, 11.0), steerAngle, steerCmd, curVx, curVz, grip, spec, obs);
      if (saf.safe && saf.minClear > 0.65) {
        const curveSlow = 1.0 - Math.min(0.40, Math.abs(hErr) * 0.52);
        const gripSlow = 0.58 + 0.42 * clamp(grip, 0.25, 1.0);
        const approachSlow = clamp(distToGoal / 28.0, 0.25, 1.0);
        const desiredSpd = clamp(spec.maxSpeed * curveSlow * gripSlow * approachSlow, spec.minSpeed, spec.maxSpeed);
        let thr = 0.30;
        if (speed < desiredSpd - 0.5) thr = clamp((desiredSpd - speed) * 0.48 + 0.45, 0.38, 1.0);
        else if (speed > desiredSpd + 2.2 && speed > 2.6) thr = -0.35;
        route.prevSteerCmd = steerCmd;
        return {
          throttle: thr,
          steer: steerCmd,
          arrived: false,
          mode: 'ROAD_CRUISE',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }
    }

    // =========================================================================
    // 7. WIDE-GLADE GUIDED 3-TIER SE(2) HYBRID A* + ANTI-LOOP PIVOT PLANNER
    // =========================================================================
    route.replanCooldown = Math.max(0, (route.replanCooldown || 0) - dt);
    let plan = route.se2Plan || null;

    let crossTrackErr = 0;
    let remainingPlanLen = 0;
    let inActiveReverse = false;
    let inActiveMicroSlot = false;
    if (plan && plan.samples && plan.samples.length > 0) {
      const sam = plan.samples;
      let idx = plan.idx || 0;
      const curDir = sam[idx].dir;
      let bestDist = Infinity;
      const endWin = Math.min(sam.length - 1, idx + (plan.isMicroSlot ? 5 : 16));
      for (let i = idx; i <= endWin; i++) {
        if (sam[i].dir !== curDir && (plan.isMicroSlot ? i > idx : i > idx + 2)) break;
        const d = Math.hypot(sam[i].x - pose.cx, sam[i].z - pose.cz);
        if (d < bestDist) { bestDist = d; idx = i; }
      }
      plan.idx = idx;
      crossTrackErr = bestDist;
      remainingPlanLen = plan.totalLen - sam[idx].cumLen;

      if (sam[idx].dir < 0) {
        inActiveReverse = true;
        let cuspStart = idx;
        while (cuspStart > 0 && sam[cuspStart - 1].dir < 0) cuspStart--;
        let cuspEnd = idx;
        while (cuspEnd < sam.length - 1 && sam[cuspEnd + 1].dir < 0) cuspEnd++;
        const distToCusp = Math.hypot(sam[cuspEnd].x - pose.cx, sam[cuspEnd].z - pose.cz);
        const segStartX = cuspStart === 0 ? plan.planOriginX : sam[cuspStart - 1].x;
        const segStartZ = cuspStart === 0 ? plan.planOriginZ : sam[cuspStart - 1].z;
        const revSegLen = Math.hypot(sam[cuspEnd].x - segStartX, sam[cuspEnd].z - segStartZ);
        const maxRevCap = grip < 0.65 ? 2.95 : 2.85;
        const timedOutRev = route.revElapsed > maxRevCap;
        const baseCuspTrig = plan.isMicroSlot ? 0.32 : (grip < 0.65 ? 2.20 : 1.65);
        const cuspTrigDist = (cuspEnd + 1 < sam.length)
          ? Math.min(baseCuspTrig, Math.max(plan.isMicroSlot ? 0.22 : 0.55, revSegLen * (plan.isMicroSlot ? 0.30 : 0.42)))
          : Math.min(plan.isMicroSlot ? 0.38 : 1.10, Math.max(plan.isMicroSlot ? 0.22 : 0.45, revSegLen * 0.35));
        if (distToCusp < cuspTrigDist || timedOutRev || (wasBlocked && speed < -0.1)) {
          inActiveReverse = false;
          const dRevYaw = wrapAngle(pose.yaw - (plan.planOriginYaw ?? sam[0].yaw));
          if (Math.abs(dRevYaw) > 0.05) {
            route.lastKTurnSign = dRevYaw > 0 ? 1 : -1;
            route.lastKTurnSignTTL = 5.5;
          }
          // Only lock reverse cooldown if we actually hit the reverse duration cap (never cut a short 1.2s backout in half!)
          if (timedOutRev || route.revElapsed > 2.05) {
            route.revCooldownTimer = Math.max(route.revCooldownTimer || 0, grip < 0.65 ? 0.16 : 0.14);
          }
          let discardShiftedTail = false;
          if (cuspEnd + 1 < sam.length && grip < 0.65 && !plan.isMicroSlot && timedOutRev && distToCusp > 3.2) {
            const revSteer = sam[cuspEnd].steer || 0;
            let snapIdx = cuspEnd + 1;
            let snapBestD = Infinity;
            const snapEnd = Math.min(sam.length - 1, cuspEnd + 16);
            for (let si = cuspEnd + 1; si <= snapEnd; si++) {
              if (sam[si].dir <= 0) break;
              const sd = Math.hypot(sam[si].x - pose.cx, sam[si].z - pose.cz);
              if (sd < snapBestD) { snapBestD = sd; snapIdx = si; }
            }
            if (snapIdx > cuspEnd + 4 || (Math.abs(revSteer) > 0.20 && sam[snapIdx].steer * revSteer > 0.05)) {
              discardShiftedTail = true;
            }
          }
          if (cuspEnd + 1 < sam.length && !discardShiftedTail) {
            plan.idx = cuspEnd + 1;
            remainingPlanLen = plan.totalLen - sam[plan.idx].cumLen;
          } else {
            plan = null;
            route.se2Plan = null;
            route.replanCooldown = 0;
          }
        }
      } else if (plan.isMicroSlot && sam[idx].dir > 0) {
        let cuspEnd = idx;
        while (cuspEnd < sam.length - 1 && sam[cuspEnd + 1].dir > 0) cuspEnd++;
        if (cuspEnd + 1 < sam.length) {
          const distToCusp = Math.hypot(sam[cuspEnd].x - pose.cx, sam[cuspEnd].z - pose.cz);
          if (distToCusp < 0.32 || (wasBlocked && speed > 0.08)) {
            plan.idx = cuspEnd + 1;
            remainingPlanLen = plan.totalLen - sam[plan.idx].cumLen;
            if (sam[plan.idx].dir < 0) inActiveReverse = true;
          }
        }
      }
      if (plan && plan.isMicroSlot && plan.idx < plan.samples.length - 1 && crossTrackErr < 0.90) {
        inActiveMicroSlot = true;
      }
    }
    if ((route.lastKTurnSignTTL || 0) > 0) {
      route.lastKTurnSignTTL = Math.max(0, route.lastKTurnSignTTL - dt);
      if (route.lastKTurnSignTTL <= 0) route.lastKTurnSign = 0;
    }

    if (wasBlocked && Math.abs(speed) < 0.85) {
      if ((route.unwedgeHoldTimer || 0) > 0 && route.unwedgeOriginX !== undefined) {
        const uwBlkMoved = Math.hypot(pose.cx - route.unwedgeOriginX, pose.cz - route.unwedgeOriginZ);
        if (uwBlkMoved < 1.5) route.unwedgeShortCycles = (route.unwedgeShortCycles || 0) + 1;
      }
      route.consecBlockFrames = (route.consecBlockFrames || 0) + 1;
      route.unwedgeHoldTimer = 0;
      if (route.consecBlockFrames >= 4 && route.pivotTurnSign) {
        route.pivotTurnSign = -route.pivotTurnSign;
        route.pivotAccumYaw = 0;
      }
    } else if (!wasBlocked && (movedStep > 0.025 || Math.abs(speed) > 0.30)) {
      route.consecBlockFrames = 0;
    }

    if ((route.unwedgeHoldTimer || 0) > 0) {
      route.unwedgeHoldTimer = Math.max(0, route.unwedgeHoldTimer - dt);
      if (route.unwedgeHoldTimer <= 0 && route.unwedgeHoldDir && route.unwedgeOriginX !== undefined) {
        const uwMoved = Math.hypot(pose.cx - route.unwedgeOriginX, pose.cz - route.unwedgeOriginZ);
        if (uwMoved >= 0.75) {
          route.lastPivotStartX = route.unwedgeOriginX;
          route.lastPivotStartZ = route.unwedgeOriginZ;
          route.lastPivotStartYaw = pose.yaw;
          route.lastPivotDir = route.unwedgeHoldDir;
        }
      }
    }

    const gripDroppedNow = grip < 0.65 && (route.lastGrip ?? 0.96) >= 0.65;
    route.lastGrip = grip;
    if (gripDroppedNow) {
      plan = null;
      route.se2Plan = null;
      route.replanCooldown = 0;
    }

    const forceUnwedgeNow = (route.consecBlockFrames || 0) >= 2 || (route.unwedgeHoldTimer || 0) > 0;
    const stallLimSec = inActiveMicroSlot ? 0.80 : (grip < 0.65 ? 0.85 : 0.45);
    const forceEscapeReplan = wasBlocked || route.microStallTimer > stallLimSec;
    const distSinceReplan = plan ? Math.hypot(pose.cx - plan.planOriginX, pose.cz - plan.planOriginZ) : 999;
    const inKTurnEscape = Boolean(plan && plan.hasReverse && !inActiveReverse && remainingPlanLen >= 8.0);
    // Smooth CTE ramp during K-turn cusp pull-out (eliminates the hard 2.6 m/s cliff that aborted 70m escape plans mid-acceleration!)
    const baseCte = grip < 0.65 ? 2.2 : 1.8;
    const pullOutExtra = inKTurnEscape ? clamp((4.8 - speed) / 2.8, 0.0, 1.0) * (grip < 0.65 ? 2.0 : 1.4) : 0.0;
    const cteLimit = baseCte + pullOutExtra;
    const minRemTrigger = inKTurnEscape ? 9.0 : (spec.isArmor ? 22.0 : 16.0);
    const needReplan =
      !plan ||
      !plan.samples ||
      plan.idx >= plan.samples.length - (plan.isMicroSlot ? 1 : 2) ||
      forceEscapeReplan ||
      (!inActiveReverse && !inActiveMicroSlot && (
        remainingPlanLen < minRemTrigger ||
        (!inKTurnEscape && distSinceReplan >= (spec.isArmor ? 22.0 : 17.0)) ||
        crossTrackErr > cteLimit
      ));

    if (forceUnwedgeNow) {
      // Bypass SE(2) replanner for this tick so Section 9 executes exact-physical dry-steered un-wedging!
      plan = null;
      route.se2Plan = null;
      route.replanCooldown = 0.12;
    } else if (needReplan && (route.replanCooldown <= 0 || !plan || forceEscapeReplan)) {
      const freshObs = Math.hypot(pose.cx - cacheX, pose.cz - cacheZ) > 2.0
        ? gatherUnifiedObstacles(pose.cx, pose.cz, 105.0, providers, spec, true)
        : obs;

      const isFinalClose = distToGoal < 62.0;
      let macroX = isFinalClose ? goal[0] : pHorizon[0];
      let macroZ = isFinalClose ? goal[1] : pHorizon[1];
      const isBreakout = (route.stallEscalation || 0) > 0;
      if (!isFinalClose && isBreakout && bestD <= 45.0) {
        const dxM = macroX - pose.cx;
        const dzM = macroZ - pose.cz;
        const lenM = Math.max(1.0, Math.hypot(dxM, dzM));
        // Pick the more open lateral side on esc=1 using 32-ray LiDAR, then cycle monotonically (never freezing at esc=8!):
        if (route.stallEscalation === 1 || !route.breakoutBaseSign) {
          let leftOpen = 0, rightOpen = 0;
          for (let r = 0; r < 7; r++) leftOpen += lidar.rays[r];
          for (let r = 10; r < 17; r++) rightOpen += lidar.rays[r];
          route.breakoutBaseSign = leftOpen >= rightOpen ? -1 : 1;
        }
        const flipN = (route.flankFlipCount || route.stallEscalation) - 1;
        const flankSign = (flipN % 2 === 0) ? route.breakoutBaseSign : -route.breakoutBaseSign;
        // On every 3rd/4th attempt, pull perpendicular/slightly back (-6m) to cleanly escape deep U-shaped pockets!
        const widePhase = (flipN % 4 >= 2);
        const fwdPull = widePhase ? -6.0 : 32.0;
        const latOff = widePhase ? 60.0 : (44.0 + Math.min(20.0, (route.stallEscalation - 1) * 6.0));
        macroX = clamp(pose.cx + (dxM / lenM) * fwdPull + (-dzM / lenM) * latOff * flankSign, TERRENO_WORLD.playMinX + 24, TERRENO_WORLD.playMaxX - 24);
        macroZ = clamp(pose.cz + (dzM / lenM) * fwdPull + (dxM / lenM) * latOff * flankSign, TERRENO_WORLD.playMinZ + 24, TERRENO_WORLD.playMaxZ - 24);
      } else if (!isFinalClose) {
        const dxM = macroX - pose.cx;
        const dzM = macroZ - pose.cz;
        const lenM = Math.hypot(dxM, dzM);
        if (lenM > 66.0) {
          macroX = clamp(pose.cx + (dxM / lenM) * 66.0, TERRENO_WORLD.playMinX + 24, TERRENO_WORLD.playMaxX - 24);
          macroZ = clamp(pose.cz + (dzM / lenM) * 66.0, TERRENO_WORLD.playMinZ + 24, TERRENO_WORLD.playMaxZ - 24);
        }
      }

      // Build exact 71×71 Chamfer Clearance + Wide-Glade Highway Centerline (~0.5ms!)
      const glade = buildWideGladeFieldAndGuide(
        pose.cx, pose.cz, macroX, macroZ, freshObs, spec, route.tabuSpots, grip,
      );

      const targetX = isFinalClose ? goal[0] : glade.guideX;
      const targetZ = isFinalClose ? goal[1] : glade.guideZ;

      const stormSlopeExtra = (grip < 0.65 && Math.abs(latSlope || 0) > 0.07) ? 0.08 : 0.0;
      const stormPadBoost = (grip < 0.65 ? 0.18 : 0.0) + stormSlopeExtra;
      const canRevNow = (route.revCooldownTimer || 0) <= 0.01 && (route.revElapsed || 0) < 2.0 && speed <= 2.2;
      let newPlan = null;

      if (!forceEscapeReplan) {
        // Pass 1A: Safe high-speed Wide-Glade forward slalom (0.28m dry / 0.46-0.54m storm)
        newPlan = planRollingHybridAStar(
          pose, steerAngle, speed, curVx, curVz, targetX, targetZ, goal[0], goal[1],
          grip, spec, freshObs, {
            allowReverse: false,
            safetyPad: (spec.isArmor ? 0.28 : 0.20) + stormPadBoost,
            maxExpansions: grip < 0.65 ? 1500 : 950,
            neuralSteerPrior: neuralOut.steerBias,
            isBreakout,
            tabuSpots: route.tabuSpots,
          },
        );
        // Pass 1B: Precision tight forward squeeze (0.14m dry / 0.25m storm) — in storms keep wide >=22m Pass 1A safe!
        const needTightPass1B = !newPlan || (
          grip < 0.65
            ? (!newPlan.reachedHorizon && newPlan.totalLen < (spec.isArmor ? 22.0 : 15.0))
            : !newPlan.reachedHorizon
        );
        if (needTightPass1B) {
          const tightFwd = planRollingHybridAStar(
            pose, steerAngle, speed, curVx, curVz, targetX, targetZ, goal[0], goal[1],
            grip, spec, freshObs, {
              allowReverse: false,
              safetyPad: (spec.isArmor ? 0.14 : 0.10) + (grip < 0.65 ? 0.11 : 0.0),
              maxExpansions: grip < 0.65 ? 1300 : 1100,
              neuralSteerPrior: neuralOut.steerBias,
              isBreakout,
              tabuSpots: route.tabuSpots,
            },
          );
          if (tightFwd && (!newPlan || (tightFwd.reachedHorizon && !newPlan.reachedHorizon) || tightFwd.totalLen > newPlan.totalLen + 4.5)) {
            newPlan = tightFwd;
          }
        }
      }

      const fwdGood = newPlan && (newPlan.reachedHorizon || newPlan.totalLen >= (spec.isArmor ? 20.0 : 13.0));
      if (!fwdGood) {
        // Pass 2: Single-Phase Clean K-Turn + Forward Escape (0.12m dry / 0.18m storm)
        const revPlan = planRollingHybridAStar(
          pose, steerAngle, speed, curVx, curVz, targetX, targetZ, goal[0], goal[1],
          grip, spec, freshObs, {
            allowReverse: canRevNow,
            safetyPad: 0.12 + (grip < 0.65 ? 0.06 : 0.0),
            maxExpansions: isBreakout ? 2400 : 1500,
            neuralSteerPrior: neuralOut.steerBias,
            isBreakout,
            tabuSpots: route.tabuSpots,
          },
        );
        const revPlanIsUseful = Boolean(
          revPlan && (
            revPlan.reachedHorizon ||
            revPlan.fwdSteps >= 3 ||
            revPlan.netDispM >= 9.0 ||
            !revPlan.hasReverse
          ),
        );
        if (revPlanIsUseful && (!newPlan || revPlan.progressM > newPlan.progressM + 1.5 || revPlan.totalLen > newPlan.totalLen + 3.0)) {
          newPlan = revPlan;
          if (revPlan.hasReverse) {
            route.kTurnCount = (route.kTurnCount || 0) + 1;
            route.localKTurns = (route.localKTurns || 0) + 1;
          }
        }
      }

      // Track monotonic yaw accumulation during an active 3-point-turn pivot
      if (route.pivotTurnSign) {
        if (route.pivotLastYaw !== undefined) {
          route.pivotAccumYaw = (route.pivotAccumYaw || 0) + wrapAngle(pose.yaw - route.pivotLastYaw) * route.pivotTurnSign;
        }
        route.pivotLastYaw = pose.yaw;
        if ((route.pivotAccumYaw || 0) > 1.65) {
          route.pivotTurnSign = -route.pivotTurnSign;
          route.pivotAccumYaw = 0;
        }
      }

      // Pass 2B (APEX-DRIVE v18.4 TABU-AWARE HYSTERESIS 3-POINT-TURN PIVOT):
      const inPivotLock = Boolean(route.pivotTurnSign);
      const exitLenThresh = isBreakout ? 24.0 : (inPivotLock ? 16.0 : 11.0);
      const exitDispThresh = isBreakout ? 16.0 : (inPivotLock ? 12.0 : 9.0);
      const planTooShort = !newPlan || (
        !isFinalClose &&
        (!newPlan.reachedHorizon || newPlan.netDispM < exitDispThresh) &&
        newPlan.totalLen < exitLenThresh &&
        newPlan.netDispM < exitDispThresh
      );
      const keepActivePivotStroke = Boolean(
        plan && plan.isPivotEscape && !inActiveReverse && !forceEscapeReplan &&
        plan.samples && plan.idx < plan.samples.length - 2 && remainingPlanLen >= 0.65 && crossTrackErr < 1.5,
      );

      if (!planTooShort) {
        // Genuine escape corridor opened — exit 3-point-turn lock cleanly!
        route.pivotTurnSign = 0;
        route.pivotAccumYaw = 0;
        route.pivotLastYaw = undefined;
        route.lastPivotDir = 0;
        route.extractStartX = undefined;
        route.extractStartZ = undefined;
      } else if (keepActivePivotStroke) {
        // Stay committed to finishing the current pivot stroke until either an escape opens or the stroke completes
        newPlan = null;
      } else if (speed <= (inPivotLock ? 5.2 : 2.8)) {
        let signToUse = route.pivotTurnSign || route.lastKTurnSign || 0;
        const wantFwdFirst = (inPivotLock && route.lastPivotDir === -1) || !canRevNow;
        let pivotPlan = null;
        let preferCooldownHold = false;
        const pivotTabu = isBreakout ? route.tabuSpots : null;

        if (isBreakout && route.extractStartX === undefined) {
          route.extractStartX = pose.cx;
          route.extractStartZ = pose.cz;
        }
        const extractedDistM = route.extractStartX !== undefined
          ? Math.hypot(pose.cx - route.extractStartX, pose.cz - route.extractStartZ)
          : 0;
        const deepExtractMode = isBreakout && extractedDistM < 18.0 && (route.stallEscalation || 0) >= 2;

        const prevOrigin = (route.lastPivotStartX !== undefined)
          ? { x: route.lastPivotStartX, z: route.lastPivotStartZ, yaw: route.lastPivotStartYaw }
          : null;
        const pivotHasRealTurn = (p) => Boolean(p && !p._isUndoCycle && (p._rotAbs || 0) >= 0.02);
        if (wantFwdFirst) {
          const fwdPivot = planThreePointPivot(
            pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, false, signToUse, pivotTabu, false, prevOrigin,
          );
          // DEEP CUL-DE-SAC EXTRACTION: when trapped in a dead-end corridor (esc >= 2 or forward < 6.0m) AND we haven't yet
          // backed 18m out into an open glade, NEVER drive back into the dead-end or flip pivotSign! Wait 0.25s then keep backing out!
          const fwdTooPinched = !fwdPivot || fwdPivot._isUndoCycle || (
            isBreakout &&
            extractedDistM < 18.0 &&
            (fwdPivot.totalLen < 6.0 || (route.stallEscalation || 0) >= 2)
          );
          if (fwdTooPinched) {
            let revExt = planThreePointPivot(pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, signToUse, pivotTabu, true, prevOrigin);
            if (!pivotHasRealTurn(revExt)) {
              const revAny = planThreePointPivot(pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, 0, pivotTabu, true, prevOrigin);
              if (revAny && (!revExt || pivotHasRealTurn(revAny))) revExt = revAny;
            }
            if (revExt && !revExt._isUndoCycle && (revExt.totalLen >= 2.4 || pivotHasRealTurn(revExt))) {
              if (canRevNow) {
                pivotPlan = revExt;
              } else if (speed > 2.2 || (route.revCooldownTimer || 0) > 0.02 || (route.revElapsed || 0) >= 1.8 || speed < -0.3) {
                preferCooldownHold = true;
              }
            }
          }
          if (!pivotPlan && !preferCooldownHold) {
            pivotPlan = fwdPivot;
          }
          if (!pivotPlan && !preferCooldownHold && canRevNow) {
            pivotPlan = planThreePointPivot(
              pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, signToUse, pivotTabu, deepExtractMode, prevOrigin,
            );
          }
          const committedInPivot = inPivotLock && Math.abs(route.pivotAccumYaw || 0) >= 0.20;
          if (!pivotHasRealTurn(pivotPlan) && !preferCooldownHold && signToUse !== 0) {
            if (committedInPivot && !canRevNow && ((route.revCooldownTimer || 0) > 0.02 || (route.revElapsed || 0) >= 1.8 || speed < -0.3)) {
              preferCooldownHold = true;
            } else {
              const altSign = -signToUse;
              const altPivot = planThreePointPivot(
                pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, false, altSign, pivotTabu, false, prevOrigin,
              ) || (canRevNow ? planThreePointPivot(
                pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, altSign, pivotTabu, deepExtractMode, prevOrigin,
              ) : null);
              // Upgrade to opposite turn sign ONLY if altPivot genuinely rotates AND does NOT time-reverse back to prevOrigin!
              if (altPivot && pivotHasRealTurn(altPivot) && (!pivotPlan || !pivotHasRealTurn(pivotPlan) || altPivot.totalLen >= 3.5)) {
                signToUse = altSign;
                pivotPlan = altPivot;
              }
            }
          }
        } else {
          pivotPlan = planThreePointPivot(
            pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, signToUse, pivotTabu, deepExtractMode, prevOrigin,
          );
          if (!pivotHasRealTurn(pivotPlan)) {
            const fwdAlt = planThreePointPivot(
              pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, false, signToUse, pivotTabu, false, prevOrigin,
            );
            if (fwdAlt && pivotHasRealTurn(fwdAlt)) {
              pivotPlan = fwdAlt;
            }
          }
          if (!pivotHasRealTurn(pivotPlan) && signToUse !== 0) {
            const altSign = -signToUse;
            const altPivot = planThreePointPivot(
              pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, true, altSign, pivotTabu, deepExtractMode, prevOrigin,
            ) || planThreePointPivot(
              pose, steerAngle, glade.midGuideX, glade.midGuideZ, grip, spec, freshObs, false, altSign, pivotTabu, false, prevOrigin,
            );
            if (altPivot && pivotHasRealTurn(altPivot)) {
              signToUse = altSign;
              pivotPlan = altPivot;
            }
          }
        }

        if (preferCooldownHold) {
          newPlan = { isCooldownHold: true, samples: [], totalLen: 0, idx: 0, planOriginX: pose.cx, planOriginZ: pose.cz };
        } else if (pivotPlan) {
          newPlan = pivotPlan;
          const committedSign = pivotPlan.pivotTurnSign || signToUse || 1;
          if (route.pivotTurnSign !== committedSign) {
            route.pivotTurnSign = committedSign;
            route.pivotAccumYaw = 0;
            route.pivotLastYaw = pose.yaw;
          }
          const newPivotDir = pivotPlan.hasReverse ? -1 : 1;
          if (route.lastPivotDir !== newPivotDir) {
            route.lastPivotStartX = pose.cx;
            route.lastPivotStartZ = pose.cz;
            route.lastPivotStartYaw = pose.yaw;
          }
          const wasAlreadyRev = Boolean(plan && plan.hasReverse && inActiveReverse);
          route.lastPivotDir = newPivotDir;
          if (pivotPlan.hasReverse && !wasAlreadyRev) {
            route.kTurnCount = (route.kTurnCount || 0) + 1;
            route.localKTurns = (route.localKTurns || 0) + 1;
          }
        } else if (!canRevNow && ((route.revCooldownTimer || 0) > 0.02 || (route.revElapsed || 0) >= 1.8)) {
          // CUL-DE-SAC ANTI-YOYO HOLD: mid-extraction on reverse cooldown & no forward pivot exists!
          newPlan = { isCooldownHold: true, samples: [], totalLen: 0, idx: 0, planOriginX: pose.cx, planOriginZ: pose.cz };
        } else {
          // Discard dead short Pass 1B straight-rail stubs so Pass 3A micro-slot escape & Section 9 can extract cleanly!
          newPlan = null;
        }
      } else {
        // Approaching a dead-end pocket too fast to pivot yet: discard the short stub so Section 9 executes BRAKE_PREP immediately!
        newPlan = null;
      }

      // Pass 3A: Exact-Physical Micro-Slot Parallel-Parking Escape Solver (solves sub-2m multi-tree pockets EVEN during pivot lock!)
      const microLenCut = route.pivotTurnSign ? 2.2 : 3.6;
      const zeroYawStub = Boolean(
        newPlan && !newPlan.isCooldownHold && newPlan.isPivotEscape && (newPlan._rotAbs || 0) < 0.03 &&
        (newPlan.totalLen < 6.0 || ((route.stallEscalation || 0) >= 5 && newPlan.totalLen <= 10.5)),
      );
      const needMicroSlot = !keepActivePivotStroke && speed <= 2.4 && (
        !newPlan ||
        (!newPlan.isCooldownHold && (
          newPlan.totalLen < microLenCut ||
          zeroYawStub
        ))
      );
      if (needMicroSlot) {
        const activePiv = route.pivotTurnSign || 0;
        const microPivSign = grip < 0.65 ? activePiv : ((route.stallEscalation || 0) >= 3 ? 0 : activePiv);
        let slotPlan = planMicroSlotEscape(pose, targetX, targetZ, grip, spec, freshObs, canRevNow, microPivSign);
        if (!slotPlan && grip < 0.65 && activePiv !== 0 && (route.stallEscalation || 0) >= 3) {
          slotPlan = planMicroSlotEscape(pose, targetX, targetZ, grip, spec, freshObs, canRevNow, 0);
        }
        if (slotPlan && (!newPlan || zeroYawStub || slotPlan.netDispM > (newPlan.netDispM || 0) + 0.8 || slotPlan._rotAbs > (newPlan._rotAbs || 0) + 0.04)) {
          newPlan = slotPlan;
          if (slotPlan.hasReverse) {
            route.kTurnCount = (route.kTurnCount || 0) + 1;
            route.localKTurns = (route.localKTurns || 0) + 1;
          }
        }
      }

      // Pass 3B: Ultra-tight micro-wiggle Hybrid A* fallback ONLY when not in pivot lock and not on cooldown hold
      if (!keepActivePivotStroke && !route.pivotTurnSign && speed <= 2.4 && (!newPlan || (!newPlan.isCooldownHold && !newPlan.isMicroSlot && newPlan.totalLen < 4.0))) {
        const microPlan = planRollingHybridAStar(
          pose, steerAngle, speed, curVx, curVz, targetX, targetZ, goal[0], goal[1],
          grip, spec, freshObs, {
            allowReverse: canRevNow,
            safetyPad: 0.04,
            arcLen: spec.isArmor ? 3.5 : 2.5,
            maxExpansions: 850,
            neuralSteerPrior: neuralOut.steerBias,
            isBreakout,
            tabuSpots: route.tabuSpots,
          },
        );
        if (microPlan && (!newPlan || microPlan.totalLen > newPlan.totalLen + 1.5)) {
          newPlan = microPlan;
          if (microPlan.hasReverse) {
            route.kTurnCount = (route.kTurnCount || 0) + 1;
            route.localKTurns = (route.localKTurns || 0) + 1;
          }
        }
      }

      const keepShortFwdSlide = Boolean(
        plan && plan.samples && !plan.hasReverse && !forceEscapeReplan &&
        crossTrackErr < 1.2 && remainingPlanLen >= 0.85 &&
        newPlan && newPlan.hasReverse && !newPlan.reachedHorizon && newPlan.totalLen < 4.5,
      );
      const keepOldValid = Boolean(
        keepActivePivotStroke ||
        keepShortFwdSlide ||
        (plan && plan.samples && !forceEscapeReplan && crossTrackErr < cteLimit && remainingPlanLen >= 8.0 &&
        (!newPlan || (!newPlan.reachedHorizon && !newPlan.isPivotEscape && !newPlan.isCooldownHold && newPlan.totalLen < remainingPlanLen + 3.0))),
      );

      if (keepOldValid) {
        route.replanCooldown = keepActivePivotStroke ? 0.30 : 0.35;
      } else if (newPlan && newPlan.isCooldownHold) {
        plan = newPlan;
        route.se2Plan = null;
        route.replanCooldown = 0.12;
      } else if (newPlan && newPlan.samples && newPlan.samples.length >= 2) {
        plan = newPlan;
        route.se2Plan = newPlan;
        route.microStallTimer = 0;
        route.replanCooldown = forceEscapeReplan ? 0.25 : 0.40;
      } else {
        plan = null;
        route.se2Plan = null;
        route.replanCooldown = 0.18;
      }
    }

    // Cul-de-sac reverse-cooldown clean brake/hold (resets revStreak cleanly without driving back into the pocket!)
    if (plan && plan.isCooldownHold) {
      const holdThr = speed < -0.15 ? 0.85 : (speed > 0.25 ? -1.0 : 0.0);
      return {
        throttle: holdThr,
        steer: route.prevSteerCmd || 0,
        arrived: false,
        mode: 'K_TURN_FWD',
        lidarFrontMin: lidar.frontMinM,
        neuralOut,
      };
    }

    // =========================================================================
    // 8. ZERO-UNDERSTEER FEEDFORWARD + STANLEY TRACKER & BRAKING-DISTANCE GOVERNOR
    // =========================================================================
    if (plan && plan.samples && plan.idx < plan.samples.length) {
      const sam = plan.samples;
      const idx = plan.idx;
      const curPt = sam[idx];
      const gearDir = curPt.dir;

      // BRAKE-BEFORE-REVERSE GUARD: NEVER execute reverse steering while still moving forward > 1.4 m/s!
      if (gearDir < 0 && speed > 1.4) {
        const safeBrkSteer = pickSafestBrakingSteer(pose, speed, steerAngle, curVx, curVz, grip, spec, obs);
        route.prevSteerCmd = safeBrkSteer;
        if (!(plan && plan.totalLen >= 22.0 && plan.hasReverse)) {
          route.replanCooldown = 0;
        } else {
          route.replanCooldown = Math.max(route.replanCooldown || 0, 0.35);
        }
        return {
          throttle: -1.0,
          steer: safeBrkSteer,
          arrived: false,
          mode: 'BRAKE_PREP',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }

      // SYMMETRIC BRAKE-BEFORE-FORWARD GUARD: NEVER crank to opposite lock while still rolling backward > 0.6 m/s!
      if (gearDir > 0 && speed < -0.60) {
        const holdSteer = route.prevSteerCmd ?? 0;
        return {
          throttle: 1.0,
          steer: holdSteer,
          arrived: false,
          mode: 'K_TURN_FWD',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }

      const maxRevTrackCap = 3.10;
      if (gearDir < 0 && (route.revElapsed > maxRevTrackCap || (route.revCooldownTimer || 0) > 0.05)) {
        let nextFwd = idx + 1;
        while (nextFwd < sam.length && sam[nextFwd].dir < 0) nextFwd++;
        if (nextFwd < sam.length) {
          plan.idx = nextFwd;
          return {
            throttle: 1.0,
            steer: route.prevSteerCmd ?? 0,
            arrived: false,
            mode: 'K_TURN_FWD',
            lidarFrontMin: lidar.frontMinM,
            neuralOut,
          };
        }
        route.se2Plan = null;
        route.replanCooldown = 0;
      } else {
        let steerCmd;
        if (gearDir > 0) {
          const nextIdx = (idx + 1 < sam.length && sam[idx + 1].dir > 0) ? idx + 1 : idx;
          const next2Idx = (idx + 2 < sam.length && sam[idx + 2].dir > 0) ? idx + 2 : nextIdx;
          const ffSteer = curPt.steer * 0.45 + sam[nextIdx].steer * 0.40 + sam[next2Idx].steer * 0.15;

          const cCos = Math.cos(curPt.yaw);
          const cSin = Math.sin(curPt.yaw);
          const errX = pose.cx - curPt.x;
          const errZ = pose.cz - curPt.z;
          const eLat = cCos * errX - cSin * errZ;
          // rolloutPrimitive already integrates exact storm latResp + turnSlide + slopeSlip into (curPt.x, curPt.z, curPt.yaw);
          // during low-grip storms (0.40s lateral phase lag), use damped feedback gains to prevent fishtailing!
          const eYaw = wrapAngle(curPt.yaw - pose.yaw);
          const isStormGrip = grip < 0.65;
          const stanleyGain = isStormGrip ? 1.15 : 1.55;
          const stanleyAng = Math.atan2(eLat * stanleyGain, Math.max(3.0, Math.abs(speed)));
          const fbLim = isStormGrip ? 0.48 : 0.65;
          const fbSteer = clamp(
            (eYaw * (isStormGrip ? 1.05 : 1.40) + stanleyAng * (isStormGrip ? 0.95 : 1.25)) / Math.max(0.2, spec.maxSteer),
            -fbLim,
            fbLim,
          );

          const fbScale = (!plan.reachedHorizon && plan.totalLen < 10.0) ? 0.35 : 1.0;
          steerCmd = plan.isPivotEscape ? clamp(curPt.steer, -1.0, 1.0) : clamp(ffSteer + fbSteer * fbScale, -1.0, 1.0);
        } else {
          const eYaw = wrapAngle(curPt.yaw - pose.yaw);
          steerCmd = plan.isPivotEscape ? clamp(curPt.steer, -1.0, 1.0) : clamp(curPt.steer - eYaw * 0.55, -1.0, 1.0);
        }

        // DRY-STEER PRE-CRANK during tight 3-point pivot & micro-slot gear/steer changes (reset microStallTimer so intentional dry-steer never triggers forceEscapeReplan!)
        const preCrankSpdLim = plan.isMicroSlot ? 2.2 : 1.1;
        const preCrankAngTol = plan.isMicroSlot ? 0.075 : 0.10;
        if (plan.isPivotEscape && Math.abs(speed) < preCrankSpdLim && Math.abs(steerAngle - steerCmd * spec.maxSteer) > preCrankAngTol) {
          route.microStallTimer = 0;
          route.prevSteerCmd = steerCmd;
          return {
            throttle: speed > 0.12 ? -0.70 : (speed < -0.12 ? 0.70 : 0.0),
            steer: steerCmd,
            arrived: false,
            mode: gearDir < 0 ? 'K_TURN_REV' : 'K_TURN_FWD',
            lidarFrontMin: lidar.frontMinM,
            neuralOut,
          };
        }

        let minPathClear = 12.0;
        let maxPathSteer = Math.abs(steerCmd);
        let distToEndOrCusp = plan.totalLen - curPt.cumLen;
        let hasUpcomingCusp = false;
        const isStormSpd = grip < 0.65;
        const lookScanEnd = Math.min(sam.length - 1, idx + (isStormSpd ? 20 : 18));
        const effEnvBrake = (spec.accelRev || 4.2) * (0.42 + 0.58 * grip) * 0.72;
        let stormEnvSpd = spec.maxSpeed;
        for (let i = idx; i <= lookScanEnd; i++) {
          if (sam[i].dir !== gearDir) {
            distToEndOrCusp = sam[i].cumLen - curPt.cumLen;
            hasUpcomingCusp = true;
            break;
          }
          const as = Math.abs(sam[i].steer);
          if (i > idx && sam[i].minClear < minPathClear) minPathClear = sam[i].minClear;
          if (as > maxPathSteer) maxPathSteer = as;
          if (isStormSpd && gearDir > 0) {
            const dAhead = Math.max(0.0, sam[i].cumLen - curPt.cumLen);
            const sClr = i > idx ? sam[i].minClear : 0.65;
            const vLim = stormTargetSpd(as, grip, sClr);
            const vAllow = Math.sqrt(vLim * vLim + 2.0 * effEnvBrake * dAhead);
            if (vAllow < stormEnvSpd) stormEnvSpd = vAllow;
          }
        }
        if (isStormSpd && gearDir > 0) {
          const nextLocalClr = idx + 1 < sam.length ? sam[idx + 1].minClear : 0.65;
          const curSteerLim = stormTargetSpd(Math.abs(steerCmd), grip, Math.min(curPt.minClear ?? 0.65, nextLocalClr));
          if (curSteerLim < stormEnvSpd) stormEnvSpd = curSteerLim;
        }

        // S-Curve-Smart Stopping-Distance Safety Shield
        const effMaxSpd = spec.maxSpeed;
        let shieldMaxSpd = effMaxSpd;
        let forceEmergencyBrake = false;
        if (gearDir > 0 && !plan.isPivotEscape) {
          const onVerifiedCurve = plan.reachedHorizon && crossTrackErr < (isStormSpd ? 1.20 : 0.90);
          const shieldCap = onVerifiedCurve ? (spec.isArmor ? (isStormSpd ? 7.8 : 7.2) : 5.5) : 0;
          const saf = checkImmediateSafety(
            pose, Math.max(speed, 4.5), steerAngle, steerCmd, curVx, curVz, grip, spec, obs, shieldCap,
          );
          if (!saf.safe) {
            route.replanCooldown = 0;
            const effBrakeDecel = (spec.accelRev || 4.2) * (0.42 + 0.58 * grip) * 0.84;
            shieldMaxSpd = Math.sqrt(2.0 * effBrakeDecel * Math.max(0.0, saf.hitDist - 2.2));
            if (saf.hitDist < 4.2 && speed > 3.8) forceEmergencyBrake = true;
          }
        }

        let throttleCmd;
        if (gearDir > 0) {
          const effBrakeDecel = (spec.accelRev || 4.2) * (0.42 + 0.58 * grip) * 0.86;
          const runwayM = (hasUpcomingCusp || !plan.reachedHorizon)
            ? Math.max(0.0, distToEndOrCusp - (plan.isMicroSlot ? 0.20 : (plan.isPivotEscape ? 0.8 : 2.0)))
            : Math.max(0.0, distToGoal - 2.0);
          const brakeGovSpd = Math.sqrt(2.0 * effBrakeDecel * runwayM);

          const clearSpeedScale = clamp(0.80 + minPathClear * 0.20, 0.80, 1.0);
          const curveSpeedScale = 1.0 - Math.min(0.24, maxPathSteer * 0.24);
          const gripScale = 0.82 + grip * 0.18;
          const neuralSpd = 0.94 + 0.06 * neuralOut.speedScale;

          const nominalSpd = isStormSpd
            ? (plan.isMicroSlot ? 2.4 : (plan.isPivotEscape ? 5.5 : stormEnvSpd))
            : Math.min(
                plan.isMicroSlot ? 2.4 : (plan.isPivotEscape ? 5.1 : effMaxSpd),
                effMaxSpd * clearSpeedScale * curveSpeedScale * gripScale * neuralSpd,
              );
          const desiredSpd = clamp(
            Math.min(nominalSpd, brakeGovSpd, shieldMaxSpd),
            (hasUpcomingCusp || plan.isPivotEscape) ? (plan.isMicroSlot ? 1.0 : 1.1) : (isStormSpd ? 2.6 : spec.minSpeed),
            effMaxSpd,
          );

          if (forceEmergencyBrake || (isStormSpd && speed > stormEnvSpd + 1.4)) {
            throttleCmd = -1.0;
          } else if (plan.isPivotEscape) {
            if (speed > desiredSpd + 0.35) throttleCmd = -0.88;
            else if (speed < desiredSpd - 0.25) throttleCmd = plan.isMicroSlot ? 0.72 : (isStormSpd ? 0.94 : 0.86);
            else throttleCmd = isStormSpd ? 0.021 : 0.08;
          } else if (isStormSpd) {
            if (speed > desiredSpd + 0.22 && speed > 1.8) {
              throttleCmd = clamp(-(speed - desiredSpd) * 0.75 - 0.30, -1.0, -0.28);
            } else if (speed < desiredSpd - 0.25) {
              throttleCmd = clamp((desiredSpd - speed) * 0.80 + 0.64, 0.52, 1.0);
            } else {
              throttleCmd = 0.021;
            }
          } else if (speed > desiredSpd + 1.4 && speed > 1.8) {
            throttleCmd = clamp(-(speed - desiredSpd) * 0.55 - 0.38, -1.0, -0.35);
          } else if (speed < desiredSpd - 0.30) {
            throttleCmd = clamp((desiredSpd - speed) * 0.65 + 0.58, 0.48, 1.0);
          } else {
            throttleCmd = 0.30;
          }
        } else {
          const effRevStop = (spec.accelFwd || 7.8) * (0.42 + 0.58 * grip) * 0.62;
          const cuspSpdCap = Math.max(plan.isMicroSlot ? 1.0 : 1.5, Math.sqrt(2.0 * effRevStop * Math.max(0.0, distToEndOrCusp - (plan.isMicroSlot ? 0.15 : 0.45))));
          const maxRevAbs = Math.min(plan.isMicroSlot ? 2.4 : (grip < 0.65 ? 3.4 : 4.3), cuspSpdCap);
          const revSpdTarget = -maxRevAbs;
          throttleCmd = speed < revSpdTarget - 0.12 ? 0.65 : (speed > revSpdTarget + 0.15 ? -0.95 : 0.0);
        }

        const prevSteer = route.prevSteerCmd ?? steerCmd;
        const outSteer = clamp(prevSteer + (steerCmd - prevSteer) * 0.92, -1.0, 1.0);
        route.prevSteerCmd = outSteer;

        return {
          throttle: throttleCmd,
          steer: outSteer,
          arrived: false,
          mode: gearDir < 0 ? 'K_TURN_REV' : (plan.hasReverse ? 'K_TURN_FWD' : 'SE2_SLALOM'),
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }
    }

    // 9. Un-Wedgeable 22-Candidate Exact-Physics Micro-Step Escape (Solves Parallel Flank Traps & Storm Slope-Pinching!)
    const activeFwdUnwedge = !wasBlocked && (route.unwedgeHoldTimer || 0) > 0 && route.unwedgeHoldDir > 0;
    if (speed > (activeFwdUnwedge ? 3.4 : 2.1)) {
      const safeBrkSteer = pickSafestBrakingSteer(pose, speed, steerAngle, curVx, curVz, grip, spec, obs);
      route.prevSteerCmd = safeBrkSteer;
      return {
        throttle: -1.0,
        steer: safeBrkSteer,
        arrived: false,
        mode: 'BRAKE_PREP',
        lidarFrontMin: lidar.frontMinM,
        neuralOut,
      };
    }

    const curClear = evalPoseClearance(pose.cx, pose.cz, pose.yaw, spec, obs, 0.0, true).clearance;
    let slopeAccX = 0, slopeAccZ = 0;
    if (grip < 0.72 && geomorph) {
      const mn = geomorph.getMacroNormalAt(pose.cx, pose.cz, 3.2);
      if (mn.slope > 0.06) {
        const slSlip = (0.72 - grip) * 5.2 * (spec.isArmor ? 0.68 : 1.0);
        slopeAccX = mn.x * slSlip;
        slopeAccZ = mn.z * slSlip;
      }
    }

    // Track per-pose failed un-wedge actions (only blacklist after 2 blocked frames WITH wheels aligned!)
    const movedFromUnwedge = route.unwedgePoseX !== undefined
      ? Math.hypot(pose.cx - route.unwedgePoseX, pose.cz - route.unwedgePoseZ)
      : 999;
    if (movedFromUnwedge > 0.35) {
      route.unwedgePoseX = pose.cx;
      route.unwedgePoseZ = pose.cz;
      route.unwedgeFailed = new Set();
      route.unwedgeFailHits = new Map();
      route.unwedgeLastKey = null;
      if (movedFromUnwedge > 1.2) route.unwedgeShortCycles = 0;
    } else if (wasBlocked && route.unwedgeLastKey) {
      if (!route.unwedgeFailed) route.unwedgeFailed = new Set();
      if (!route.unwedgeFailHits) route.unwedgeFailHits = new Map();
      const hits = (route.unwedgeFailHits.get(route.unwedgeLastKey) || 0) + 1;
      route.unwedgeFailHits.set(route.unwedgeLastKey, hits);
      if (hits >= 2) route.unwedgeFailed.add(route.unwedgeLastKey);
    }

    const allowRevNow = (route.revElapsed || 0) < (grip < 0.65 ? 2.6 : 2.8) && (route.revCooldownTimer || 0) <= 0.05;
    const emergRevAllowed = (route.revElapsed || 0) < 3.4;
    const probeSteers = [-1.0, -0.66, -0.33, -0.12, -0.04, 0.0, 0.04, 0.12, 0.33, 0.66, 1.0];
    const probeDts = [0.06, 0.10, 0.14, 0.22, 0.30, 0.38];
    const steerGripNow = 0.58 + 0.42 * grip;
    const tractionScale = 0.42 + 0.58 * grip;
    const padEff = curClear < 0.008 ? Math.min(0.0, curClear - 0.0005) : 0.002;

    const evalCandidates = (dirsList, ignoreBlacklist) => {
      let bDir = dirsList[0], bSteer = 0, bGain = -1e9, bKey = null;
      for (let di = 0; di < dirsList.length; di++) {
        const d = dirsList[di];
        const acc = (d > 0 ? (spec.isArmor ? 7.8 : 8.4) : (spec.accelRev || 4.2)) * tractionScale;
        for (let si = 0; si < probeSteers.length; si++) {
          const st = probeSteers[si];
          const key = `${d}:${si}`;
          if (!ignoreBlacklist && route.unwedgeFailed && route.unwedgeFailed.has(key)) continue;

          let x = pose.cx, z = pose.cz, y = pose.yaw;
          const willDryStopFirst = (d * speed < 0) || Math.abs(speed) < 0.85;
          let spdSim = willDryStopFirst ? 0.0 : speed;
          let vx = willDryStopFirst ? 0.0 : curVx;
          let vz = willDryStopFirst ? 0.0 : curVz;
          let hitStep = -1;
          let step1Clear = curClear;
          let clearSteps = 0;
          let endC = curClear;

          for (let step = 0; step < probeDts.length; step++) {
            const dtS = probeDts[step];
            spdSim = clamp(spdSim + d * acc * dtS, -4.5, spec.maxSpeed);
            const lr = Math.min(1.0, dtS * (0.42 + grip * grip * 12.8));
            const tvx = -Math.sin(y) * spdSim;
            const tvz = -Math.cos(y) * spdSim;
            vx += (tvx - vx) * lr + slopeAccX * dtS;
            vz += (tvz - vz) * lr + slopeAccZ * dtS;
            y += ((spdSim * dtS) / spec.wheelbase) * Math.tan(st * spec.maxSteer) * steerGripNow;
            // Exact physical rawR collision check (with tangential wheel-axis slide matching scene3d.js!)
            let chk = evalPoseClearance(x + vx * dtS, z + vz * dtS, y, spec, obs, padEff, true);
            if (chk.hit && grip < 0.72) {
              const tx = x + (-Math.sin(y) * spdSim * dtS);
              const tz = z + (-Math.cos(y) * spdSim * dtS);
              const tChk = evalPoseClearance(tx, tz, y, spec, obs, padEff, true);
              if (!tChk.hit) {
                x = tx; z = tz; chk = tChk;
              } else {
                x += vx * dtS; z += vz * dtS;
              }
            } else {
              x += vx * dtS; z += vz * dtS;
            }
            if (step === 0) step1Clear = chk.clearance;
            if (chk.hit || (curClear < 0.03 && step === 0 && chk.clearance < curClear - 0.0005)) {
              hitStep = step;
              break;
            }
            clearSteps++;
            endC = chk.clearance;
          }

          const movedM = Math.hypot(x - pose.cx, z - pose.cz);
          const sameActionBonus =
            (!wasBlocked && route.unwedgeHoldDir === d && Math.abs((route.unwedgeHoldSteer || 0) - st) < 0.35)
              ? 12.0
              : 0.0;
          const grazingPinch = curClear < 0.03 && endC <= curClear + 0.035 && step1Clear <= curClear + 0.001 && Math.abs(st) > 0.15;
          const rotEscapeBonus = (clearSteps >= 3 && !grazingPinch)
            ? Math.abs(st) * ((route.stallEscalation || 0) >= 3 ? 11.0 : 3.0)
            : 0.0;
          const flankOpeningBonus = curClear < 0.04 ? Math.max(-20.0, Math.min(35.0, (endC - curClear) * 45.0)) : 0.0;
          const pSign = route.pivotTurnSign || 0;
          const pivotAlignBonus = (pSign !== 0 && clearSteps >= 2 && Math.abs(st) >= 0.45 && !grazingPinch)
            ? ((d * st * pSign > 0) ? 24.0 : -14.0)
            : 0.0;
          const antiStraightYoYo =
            (!wasBlocked && Math.abs(st) < 0.05 && route.lastPivotDir === -d && (route.stallEscalation || 0) >= 4 && curClear >= 0.03)
              ? -20.0
              : 0.0;
          const gladeClr = queryGridClearance(x, z);
          const gain =
            (step1Clear - curClear) * 80.0 +
            (hitStep === 0 ? -90.0 : (hitStep > 0 ? -15.0 : 40.0)) +
            clearSteps * 18.0 +
            movedM * 12.0 +
            Math.min(1.5, endC) * 28.0 +
            flankOpeningBonus +
            Math.min(4.0, gladeClr) * 4.0 +
            sameActionBonus +
            rotEscapeBonus +
            pivotAlignBonus +
            antiStraightYoYo +
            (d > 0 ? 4.0 : 0.0);
          if (gain > bGain) {
            bGain = gain;
            bDir = d;
            bSteer = st;
            bKey = key;
          }
        }
      }
      return { bestDir: bDir, bestSteer: bSteer, bestGain: bGain, bestKey: bKey };
    };

    const primaryDirs = allowRevNow ? [1, -1] : [1];
    let pick = evalCandidates(primaryDirs, false);
    if (!pick.bestKey && !allowRevNow && emergRevAllowed) {
      // All forward actions physically failed at this exact spot — permit emergency reverse briefly!
      pick = evalCandidates([-1], false);
    }
    if (!pick.bestKey) {
      route.unwedgeFailed = new Set();
      route.unwedgeFailHits = new Map();
      pick = evalCandidates(emergRevAllowed ? [1, -1] : [1], true);
    }

    const controlledUnwedgeThr = (dirCmd) => {
      if (dirCmd > 0) {
        if (speed > 2.9) return -0.55;
        if (speed < 2.4) return 0.95;
        return 0.25;
      }
      if (speed < -2.4) return 0.55;
      if (speed > -1.9) return -0.88;
      return -0.15;
    };

    const unwedgeMovedM = route.unwedgeOriginX !== undefined
      ? Math.hypot(pose.cx - route.unwedgeOriginX, pose.cz - route.unwedgeOriginZ)
      : movedFromUnwedge;

    // Release unwedge hold cleanly once genuinely clear of flanking obstacles (OR if an obstacle appears ahead along hold path!)
    if (!wasBlocked && (route.unwedgeHoldTimer || 0) > 0 && route.unwedgeHoldDir) {
      const hDir = route.unwedgeHoldDir;
      const hSteer = route.unwedgeHoldSteer || 0;
      const aheadY = pose.yaw + ((hDir * 0.45) / spec.wheelbase) * Math.tan(hSteer * spec.maxSteer) * steerGripNow;
      const aheadX = pose.cx + (-Math.sin(aheadY) * hDir * 0.45);
      const aheadZ = pose.cz + (-Math.cos(aheadY) * hDir * 0.45);
      const aheadChk = evalPoseClearance(aheadX, aheadZ, aheadY, spec, obs, padEff, true);
      let tunnelFwdClear = false;
      if (hDir > 0 && !aheadChk.hit && Math.abs(hSteer) < 0.08 && curClear < 0.14 && unwedgeMovedM < 7.5) {
        const y1 = pose.yaw + (1.15 / spec.wheelbase) * Math.tan(hSteer * spec.maxSteer) * steerGripNow;
        const c1 = evalPoseClearance(pose.cx - Math.sin(y1) * 1.15, pose.cz - Math.cos(y1) * 1.15, y1, spec, obs, padEff, true);
        const y2 = pose.yaw + (1.85 / spec.wheelbase) * Math.tan(hSteer * spec.maxSteer) * steerGripNow;
        const c2 = !c1.hit ? evalPoseClearance(pose.cx - Math.sin(y2) * 1.85, pose.cz - Math.cos(y2) * 1.85, y2, spec, obs, padEff, true) : c1;
        tunnelFwdClear = !c1.hit && !c2.hit;
      }
      const inCleanFwdTunnelSlide = tunnelFwdClear;
      const clearedFlank = (curClear > 0.16 && unwedgeMovedM > 0.85) || (!inCleanFwdTunnelSlide && unwedgeMovedM > 2.8) || unwedgeMovedM >= 7.5;
      if (clearedFlank) {
        if (unwedgeMovedM >= 0.75 && route.unwedgeOriginX !== undefined) {
          route.lastPivotStartX = route.unwedgeOriginX;
          route.lastPivotStartZ = route.unwedgeOriginZ;
          route.lastPivotStartYaw = pose.yaw;
          route.lastPivotDir = hDir;
        }
        route.unwedgeHoldTimer = 0;
        route.unwedgeHoldDir = 0;
        route.consecBlockFrames = 0;
        route.replanCooldown = 0;
        route.prevSteerCmd = hSteer;
        return {
          throttle: controlledUnwedgeThr(hDir),
          steer: hSteer,
          arrived: false,
          mode: hDir < 0 ? 'K_TURN_REV' : 'LOCAL_AVOID',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }
      if (inCleanFwdTunnelSlide && route.unwedgeHoldTimer < 0.25 && speed > 0.6) {
        route.unwedgeHoldTimer = 0.45;
      }
      if (aheadChk.hit && aheadChk.clearance < Math.min(0.0, curClear) - 0.002) {
        if (unwedgeMovedM >= 0.75 && route.unwedgeOriginX !== undefined) {
          route.lastPivotStartX = route.unwedgeOriginX;
          route.lastPivotStartZ = route.unwedgeOriginZ;
          route.lastPivotStartYaw = pose.yaw;
          route.lastPivotDir = hDir;
        }
        if (unwedgeMovedM >= 1.8) {
          route.unwedgeShortCycles = 0;
        } else {
          route.unwedgeShortCycles = (route.unwedgeShortCycles || 0) + 1;
        }
        route.unwedgeHoldTimer = 0;
        route.unwedgeHoldDir = 0;
        if ((route.unwedgeShortCycles || 0) >= 2 && curClear > -0.12) {
          route.unwedgeShortCycles = 0;
          route.consecBlockFrames = 0;
          route.replanCooldown = 0;
          return {
            throttle: 0.0,
            steer: hSteer,
            arrived: false,
            mode: 'LOCAL_AVOID',
            lidarFrontMin: lidar.frontMinM,
            neuralOut,
          };
        }
      }
    }

    // If already executing a clean unblocked un-wedge pull-away, hold it smoothly at controlled ±2.2 m/s!
    if (!wasBlocked && (route.unwedgeHoldTimer || 0) > 0 && route.unwedgeHoldDir) {
      const hDir = route.unwedgeHoldDir;
      const hSteer = route.unwedgeHoldSteer || 0;
      if (hDir > 0 || (route.revElapsed || 0) < 2.65) {
        route.prevSteerCmd = hSteer;
        return {
          throttle: controlledUnwedgeThr(hDir),
          steer: hSteer,
          arrived: false,
          mode: hDir < 0 ? 'K_TURN_REV' : 'LOCAL_AVOID',
          lidarFrontMin: lidar.frontMinM,
          neuralOut,
        };
      }
      if (unwedgeMovedM >= 0.75 && route.unwedgeOriginX !== undefined) {
        route.lastPivotStartX = route.unwedgeOriginX;
        route.lastPivotStartZ = route.unwedgeOriginZ;
        route.lastPivotStartYaw = pose.yaw;
        route.lastPivotDir = hDir;
      }
      route.unwedgeHoldTimer = 0;
    }

    const { bestDir, bestSteer, bestKey } = pick;
    // Only align pivotTurnSign if wedged deep (esc >= 4) and Section 9 finds a full-lock escape into the physically open opposite side!
    if (Math.abs(bestSteer) >= 0.90 && (route.stallEscalation || 0) >= 4) {
      const rotSign = (bestDir * bestSteer) > 0 ? 1 : -1;
      if (route.pivotTurnSign && route.pivotTurnSign !== rotSign) {
        route.pivotTurnSign = rotSign;
        route.pivotAccumYaw = 0;
      }
    }
    route.prevSteerCmd = bestSteer;
    // ALWAYS dry-steer pre-crank to ultra-tight precision (<0.012 rad when grazing!) while holding Section 9 lock!
    const alignTol = curClear < 0.06 ? 0.012 : 0.05;
    if (Math.abs(speed) < 0.8 && Math.abs(steerAngle - bestSteer * spec.maxSteer) > alignTol) {
      route.microStallTimer = 0;
      route.unwedgeLastKey = null;
      route.unwedgeHoldDir = 0;
      route.unwedgeHoldTimer = 0.25;
      return {
        throttle: speed > 0.15 ? -0.55 : (speed < -0.15 ? 0.55 : 0.0),
        steer: bestSteer,
        arrived: false,
        mode: bestDir < 0 ? 'K_TURN_REV' : 'LOCAL_AVOID',
        lidarFrontMin: lidar.frontMinM,
        neuralOut,
      };
    }
    route.unwedgeOriginX = pose.cx;
    route.unwedgeOriginZ = pose.cz;
    route.unwedgeLastKey = bestKey;
    route.unwedgeHoldDir = bestDir;
    route.unwedgeHoldSteer = bestSteer;
    route.unwedgeHoldTimer = (curClear < 0.06 || (route.stallEscalation || 0) >= 4) ? 1.45 : 0.55;
    return {
      throttle: controlledUnwedgeThr(bestDir),
      steer: bestSteer,
      arrived: false,
      mode: bestDir < 0 ? 'K_TURN_REV' : 'LOCAL_AVOID',
      lidarFrontMin: lidar.frontMinM,
      neuralOut,
    };
  }

  return {
    gatherUnifiedObstacles,
    evalPoseClearance,
    scanVirtualLidar32,
    planRollingHybridAStar,
    evaluateApexControl,
  };
}
