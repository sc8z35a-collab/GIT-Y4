import * as THREE from 'three';
import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  TRIBUTARIES,
  ROAD_NETWORK,
  evalMainRiver,
  evalRegionWeights,
} from './terrenoConfig.js';

/**
 * TERRENO 3.0 Engine — Real-World Japanese Mountain-Valley & Old-Growth Forest Geomorphology Solver
 * (60 km × 60 km = 3,600 km²):
 *   - 18 Geological Mountain Massifs with directional radiating ridge spurs & alpine granite summits
 *   - Multi-Octave Domain-Warped Ridged Multifractal + Folded Foothill Strata
 *   - Topological D8 Stream-Power Fluvial Erosion + 33° Granite Talus Thermal Relaxation
 *   - Organic Winding Forestry Road Corridor Grading (smoothly driveable grades, ZERO river mud-dams!)
 *   - Exact CPU-GPU Height Parity via RGBA32F Atlas + Shared Micro-Relief + Live 3D Bridge Deck Hook!
 */

function hash2(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}

function smoothNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

// Organic rotated-octave FBM for foothills, forest slopes & valleys
function landFbm(x, z, octaves = 4) {
  let sum = 0.0;
  let amp = 0.52;
  let norm = 0.0;
  let px = x;
  let pz = z;
  const m00 = 1.60, m01 = -1.20, m10 = 1.20, m11 = 1.60;
  for (let o = 0; o < octaves; o++) {
    sum += smoothNoise2D(px, pz) * amp;
    norm += amp;
    const nx = m00 * px + m01 * pz + 17.3;
    const nz = m10 * px + m11 * pz + 31.1;
    px = nx;
    pz = nz;
    amp *= 0.48;
  }
  return sum / norm;
}

// Sharp Geological Ridged Multifractal (sculpts authentic Japanese Alps knife-ridges & mountain spurs!)
function ridgedFbm(x, z, octaves = 4) {
  let sum = 0.0;
  let amp = 0.56;
  let weight = 1.0;
  let norm = 0.0;
  let px = x;
  let pz = z;
  const m00 = 1.62, m01 = -1.22, m10 = 1.22, m11 = 1.62;
  for (let o = 0; o < octaves; o++) {
    let n = 1.0 - Math.abs(smoothNoise2D(px, pz) * 2.0 - 1.0);
    n = n * n * weight;
    weight = Math.max(0.18, Math.min(1.0, n * 1.65));
    sum += n * amp;
    norm += amp;
    const nx = m00 * px + m01 * pz + 23.7;
    const nz = m10 * px + m11 * pz - 14.9;
    px = nx;
    pz = nz;
    amp *= 0.48;
  }
  return sum / norm;
}

/**
 * Exact Micro-Relief Function — IDENTICAL math runs on CPU and in GLSL vertex/fragment shaders!
 * Adds realistic forest-floor hummocks, mossy root mounds, natural soil undulations & valley swells.
 */
function sinHash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function glslCompatibleNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = sinHash2(ix, iz);
  const b = sinHash2(ix + 1, iz);
  const c = sinHash2(ix, iz + 1);
  const d = sinHash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function evalSharedMicroRelief(x, z, suppressFactor) {
  if (suppressFactor >= 0.999) return 0.0;
  const swell = glslCompatibleNoise(x * 0.015 - 4.2, z * 0.015 + 11.8) - 0.5;
  const n1 = glslCompatibleNoise(x * 0.046, z * 0.046) - 0.5;
  const n2 = glslCompatibleNoise(x * 0.145 + 19.3, z * 0.145 - 7.1) - 0.5;
  const hummock = glslCompatibleNoise(x * 0.34 - 11.1, z * 0.34 + 6.4) - 0.5;
  const micro = swell * 1.15 + n1 * 0.62 + n2 * 0.22 + hummock * 0.08;
  return micro * (1.0 - suppressFactor);
}

function quinticSmoothstep(edge0, edge1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

export function evalSouthRectWeight(wx, wz) {
  const sr = TERRENO_WORLD.southRect;
  if (!sr) return 0.0;
  const b = sr.blend;
  if (wx < sr.minX - b || wx > sr.maxX + b || wz < sr.minZ - b || wz > sr.maxZ + b) return 0.0;
  const dx = wx < sr.minX ? (sr.minX - wx) : (wx > sr.maxX ? (wx - sr.maxX) : 0.0);
  const dz = wz < sr.minZ ? (sr.minZ - wz) : (wz > sr.maxZ ? (wz - sr.maxZ) : 0.0);
  const d = Math.hypot(dx, dz);
  return 1.0 - quinticSmoothstep(0.0, b, d);
}

export function isInsideSouthRect(wx, wz, margin = 0.0) {
  const sr = TERRENO_WORLD.southRect;
  if (!sr) return false;
  return (
    wx >= sr.minX - margin &&
    wx <= sr.maxX + margin &&
    wz >= sr.minZ - margin &&
    wz <= sr.maxZ + margin
  );
}

/**
 * Exact Analytical Query for Closest Tributary Stream Centerline & Half-Width.
 */
const TRIB_CACHE = TRIBUTARIES.map((tr, ti) => {
  const rv = evalMainRiver(tr.z0);
  return {
    ...tr,
    ti,
    x0: rv.x,
    y0: rv.bedY,
    invLen: 1.0 / tr.len,
  };
});

export function evalClosestTributary(wx, wz) {
  let bestDist = 99999;
  let bestHalfW = 0;
  let bestTrib = null;
  let bestAlong = 0;
  for (let i = 0; i < TRIB_CACHE.length; i++) {
    const tr = TRIB_CACHE[i];
    const rx = wx - tr.x0;
    const rz = wz - tr.z0;
    const along = rx * tr.dirX + rz * tr.dirZ;
    if (along < -30.0 || along > tr.len * 0.74 + 30.0) continue;
    const meander = Math.sin(along * 0.0014 + tr.ti * 2.1) * 160.0 + Math.cos(along * 0.0036) * 52.0;
    const perp = Math.abs(-rx * tr.dirZ + rz * tr.dirX - meander);
    if (perp < bestDist) {
      const u = Math.max(0.0, Math.min(1.0, along / (tr.len * 0.72)));
      bestDist = perp;
      bestHalfW = Math.max(5.5, tr.width * 0.16 * (1.25 - 0.55 * u));
      bestTrib = tr;
      bestAlong = along;
    }
  }
  return { dist: bestDist, halfWidth: bestHalfW, trib: bestTrib, along: bestAlong };
}

/**
 * Sample Catmull-Rom splines densely for ALL winding mountain forestry roads across 60 km × 60 km.
 */
function sampleSingleRoadSpline(pts) {
  const dense = [];
  const isClosed =
    pts.length > 3 &&
    Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1.0;
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = isClosed ? pts[(i - 1 + (n - 1)) % (n - 1)] : pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = isClosed ? pts[(i + 2) % (n - 1)] : pts[Math.min(n - 1, i + 2)];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const segSamples = Math.max(10, Math.min(90, Math.ceil(segLen / 65.0)));
    for (let s = 0; s < segSamples; s++) {
      const t = s / segSamples;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      const z = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      dense.push([x, z]);
    }
  }
  dense.push([pts[n - 1][0], pts[n - 1][1]]);
  return dense;
}

function buildDenseRoadNetwork() {
  return ROAD_NETWORK.map((road) => ({
    id: road.id,
    nameJp: road.nameJp,
    width: road.width || 8.2,
    pts: sampleSingleRoadSpline(road.points),
  }));
}

/**
 * Zero-GC integer-keyed spatial hash indexing ALL segments across all mountain forestry roads.
 */
function buildRoadSpatialIndex(roadPolylines) {
  const bucketSize = 160.0;
  const buckets = new Map();
  const keyOf = (bx, bz) => ((bx + 4096) << 14) | ((bz + 4096) & 0x3fff);

  let totalSegs = 0;
  for (let r = 0; r < roadPolylines.length; r++) {
    totalSegs += Math.max(0, roadPolylines[r].pts.length - 1);
  }
  const segAx = new Float32Array(totalSegs);
  const segAz = new Float32Array(totalSegs);
  const segBx = new Float32Array(totalSegs);
  const segBz = new Float32Array(totalSegs);
  const segW = new Float32Array(totalSegs);
  const segRoad = new Uint16Array(totalSegs);

  let sIdx = 0;
  for (let r = 0; r < roadPolylines.length; r++) {
    const pts = roadPolylines[r].pts;
    const rw = roadPolylines[r].width;
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = pts[i][0];
      const z0 = pts[i][1];
      const x1 = pts[i + 1][0];
      const z1 = pts[i + 1][1];
      segAx[sIdx] = x0;
      segAz[sIdx] = z0;
      segBx[sIdx] = x1;
      segBz[sIdx] = z1;
      segW[sIdx] = rw;
      segRoad[sIdx] = r;

      const pad = 48.0;
      const minBx = Math.floor((Math.min(x0, x1) - pad) / bucketSize);
      const maxBx = Math.floor((Math.max(x0, x1) + pad) / bucketSize);
      const minBz = Math.floor((Math.min(z0, z1) - pad) / bucketSize);
      const maxBz = Math.floor((Math.max(z0, z1) + pad) / bucketSize);
      for (let bz = minBz; bz <= maxBz; bz++) {
        for (let bx = minBx; bx <= maxBx; bx++) {
          const key = keyOf(bx, bz);
          let arr = buckets.get(key);
          if (!arr) { arr = []; buckets.set(key, arr); }
          arr.push(sIdx);
        }
      }
      sIdx++;
    }
  }

  const NO_HIT = { dist: 9999, segIdx: -1, roadIdx: -1, t: 0, width: 8.2, ax: 0, az: 0, bx: 0, bz: 0 };
  return {
    pts: roadPolylines[0].pts,
    polylines: roadPolylines,
    segCount: totalSegs,
    queryDist(x, z) {
      const bx = Math.floor(x / bucketSize);
      const bz = Math.floor(z / bucketSize);
      const arr = buckets.get(keyOf(bx, bz));
      if (!arr) return NO_HIT;
      let bestD2 = 1e12;
      let bestSeg = -1;
      let bestT = 0;
      for (let k = 0; k < arr.length; k++) {
        const i = arr[k];
        const ax = segAx[i];
        const az = segAz[i];
        const abx = segBx[i] - ax;
        const abz = segBz[i] - az;
        const len2 = abx * abx + abz * abz + 1e-6;
        let t = ((x - ax) * abx + (z - az) * abz) / len2;
        if (t < 0.0) t = 0.0;
        else if (t > 1.0) t = 1.0;
        const dx = x - (ax + abx * t);
        const dz = z - (az + abz * t);
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestSeg = i;
          bestT = t;
        }
      }
      if (bestSeg < 0) return NO_HIT;
      return {
        dist: Math.sqrt(bestD2),
        segIdx: bestSeg,
        roadIdx: segRoad[bestSeg],
        t: bestT,
        width: segW[bestSeg],
        ax: segAx[bestSeg],
        az: segAz[bestSeg],
        bx: segBx[bestSeg],
        bz: segBz[bestSeg],
      };
    },
  };
}

/**
 * Curvature & Ridge Tensor Pass: highlights sharp alpine ridges, rocky outcrops & damp gullies!
 */
function applyRidgeCurvaturePass(heights, W, H, cellX, cellZ) {
  const ridgeTensor = new Float32Array(W * H);
  const inv2CellX = 0.5 / cellX;
  const inv2CellZ = 0.5 / cellZ;

  for (let iz = 1; iz < H - 1; iz++) {
    const rowBase = iz * W;
    for (let ix = 1; ix < W - 1; ix++) {
      const idx = rowBase + ix;
      const h = heights[idx];
      const lap = (heights[idx - 1] + heights[idx + 1] + heights[idx - W] + heights[idx + W]) * 0.25 - h;
      const gx = (heights[idx + 1] - heights[idx - 1]) * inv2CellX;
      const gz = (heights[idx + W] - heights[idx - W]) * inv2CellZ;
      const slope = Math.sqrt(gx * gx + gz * gz);
      const curv = Math.max(-1.0, Math.min(1.0, -lap * 0.16 + slope * 0.42));
      ridgeTensor[idx] = curv;
    }
  }
  return ridgeTensor;
}

/**
 * Topological D8 Stream-Power Fluvial Erosion + 33° Alpine Granite Talus Relaxation!
 * Carves realistic branching mountain gullies, waterfalls & alluvial aprons while preserving
 * natural dramatic steep ridges & cliffs across the Japanese mountain ranges!
 */
function runAlpineHydrologyAndErosion(heights, W, H, cellX, cellZ) {
  const N = W * H;
  const flowArea = new Float32Array(N);
  flowArea.fill(1.0);

  let minH = 1e9, maxH = -1e9;
  for (let i = 0; i < N; i++) {
    const h = heights[i];
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const numBuckets = 4096;
  const invSpan = (numBuckets - 1) / Math.max(1.0, maxH - minH);
  const counts = new Int32Array(numBuckets);
  const cellBucket = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    const b = Math.max(0, Math.min(numBuckets - 1, Math.floor((heights[i] - minH) * invSpan)));
    cellBucket[i] = b;
    counts[b]++;
  }
  const offsets = new Int32Array(numBuckets);
  let cursor = 0;
  for (let b = numBuckets - 1; b >= 0; b--) {
    offsets[b] = cursor;
    cursor += counts[b];
  }
  const sortedIdx = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const b = cellBucket[i];
    sortedIdx[offsets[b]++] = i;
  }

  const dOff = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
  const dDist = [
    cellX, cellX, cellZ, cellZ,
    Math.hypot(cellX, cellZ), Math.hypot(cellX, cellZ), Math.hypot(cellX, cellZ), Math.hypot(cellX, cellZ),
  ];
  const minX = TERRENO_WORLD.minX;
  const minZ = TERRENO_WORLD.minZ;

  for (let k = 0; k < N; k++) {
    const idx = sortedIdx[k];
    const ix = idx % W;
    const iz = (idx - ix) / W;
    if (ix <= 0 || ix >= W - 1 || iz <= 0 || iz >= H - 1) continue;

    const h = heights[idx];
    let bestSlope = 0.0;
    let bestNeighbor = -1;
    for (let d = 0; d < 8; d++) {
      const nIdx = idx + dOff[d];
      const sl = (h - heights[nIdx]) / dDist[d];
      if (sl > bestSlope) {
        bestSlope = sl;
        bestNeighbor = nIdx;
      }
    }
    if (bestNeighbor >= 0) {
      const a = flowArea[idx];
      flowArea[bestNeighbor] += a;

      // Authentic Stream-Power Mountain Gully Incision (protects immediate compound & village pads)
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
      const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
      const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
      if (dComp > 42.0 && dVill > 58.0) {
        const incise = Math.min(26.0, 0.24 * Math.pow(a, 0.38) * Math.pow(bestSlope, 1.12));
        const protect = quinticSmoothstep(42.0, 120.0, dComp) * quinticSmoothstep(58.0, 145.0, dVill);
        heights[idx] -= incise * protect;
      }
    }
  }

  // Realistic 34° Alpine Talus Thermal Relaxation (keeps majestic granite crags while preventing jagged spikes!)
  const reposeTan = Math.tan((34.0 * Math.PI) / 180.0);
  const delta = new Float32Array(N);
  for (let pass = 0; pass < 2; pass++) {
    delta.fill(0);
    for (let iz = 1; iz < H - 1; iz++) {
      for (let ix = 1; ix < W - 1; ix++) {
        const idx = iz * W + ix;
        const h = heights[idx];
        for (let d = 0; d < 4; d++) {
          const nIdx = idx + dOff[d];
          const diff = h - heights[nIdx];
          const maxDiff = reposeTan * dDist[d];
          if (diff > maxDiff) {
            const transfer = (diff - maxDiff) * 0.26;
            delta[idx] -= transfer;
            delta[nIdx] += transfer;
          }
        }
      }
    }
    for (let i = 0; i < N; i++) heights[i] += delta[i];
  }

  return flowArea;
}

/**
 * Dual-Azimuth Mountain Horizon Shadow + 8-Direction Sky-View AO + Ecological Canopy Density Atlas (1024×1024).
 */
function computeHorizonAndSkyViewAtlas(heights, flowArea, roadMaskArr, W, H, cellX, cellZ) {
  const out = new Uint8Array(W * H * 4);
  const minX = TERRENO_WORLD.minX;
  const minZ = TERRENO_WORLD.minZ;
  const inv2CellX = 0.5 / cellX;
  const inv2CellZ = 0.5 / cellZ;
  const compX = TERRENO_WORLD.compoundCenterX;
  const compZ = TERRENO_WORLD.compoundCenterZ;
  const villX = TERRENO_WORLD.villageCenterX;
  const villZ = TERRENO_WORLD.villageCenterZ;

  const steps = [1.5, 3, 5, 9, 15, 24, 38, 58, 88, 130, 190];
  const nSteps = steps.length;
  const sunRayStepMeters = Math.hypot(0.85 * cellX, 0.42 * cellZ);
  const stepDx = new Int32Array(nSteps);
  const stepDz = new Int32Array(nSteps);
  const stepInvDist = new Float32Array(nSteps);
  for (let s = 0; s < nSteps; s++) {
    stepDx[s] = Math.round(steps[s] * 0.85);
    stepDz[s] = Math.round(steps[s] * 0.42);
    stepInvDist[s] = 1.0 / (steps[s] * sunRayStepMeters);
  }

  const aoRawDirs = [
    [1, 0, cellX], [-1, 0, cellX], [0, 1, cellZ], [0, -1, cellZ],
    [0.707, 0.707, Math.hypot(0.707 * cellX, 0.707 * cellZ)],
    [-0.707, 0.707, Math.hypot(0.707 * cellX, 0.707 * cellZ)],
    [0.707, -0.707, Math.hypot(0.707 * cellX, 0.707 * cellZ)],
    [-0.707, -0.707, Math.hypot(0.707 * cellX, 0.707 * cellZ)],
  ];
  const aoRadii = [2.0, 7.0, 18.0];
  const aoOffX = new Int32Array(24);
  const aoOffZ = new Int32Array(24);
  const aoInvD = new Float32Array(24);
  for (let d = 0; d < 8; d++) {
    for (let r = 0; r < 3; r++) {
      const k = d * 3 + r;
      aoOffX[k] = Math.round(aoRawDirs[d][0] * aoRadii[r]);
      aoOffZ[k] = Math.round(aoRawDirs[d][1] * aoRadii[r]);
      aoInvD[k] = 1.0 / (aoRadii[r] * aoRawDirs[d][2]);
    }
  }

  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const river = evalMainRiver(wz);
    const rivX = river.x;
    const rivHW = river.halfWidth;
    const dzComp = wz - compZ;
    const dzVill = wz - villZ;
    const rowBase = iz * W;
    const rowU = (iz > 0 ? iz - 1 : 0) * W;
    const rowD = (iz < H - 1 ? iz + 1 : H - 1) * W;

    for (let ix = 0; ix < W; ix++) {
      const idx = rowBase + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const h0 = heights[idx];

      let maxTanE = 0.0;
      let maxTanW = 0.0;
      for (let s = 0; s < nSteps; s++) {
        const ez = iz + stepDz[s];
        if (ez < H) {
          const sdx = stepDx[s];
          const invD = stepInvDist[s];
          const ezRow = ez * W;
          const ex = ix + sdx;
          if (ex < W) {
            const tE = (heights[ezRow + ex] - h0) * invD;
            if (tE > maxTanE) maxTanE = tE;
          }
          const wx2 = ix - sdx;
          if (wx2 >= 0) {
            const tW = (heights[ezRow + wx2] - h0) * invD;
            if (tW > maxTanW) maxTanW = tW;
          }
        }
      }
      const sinE = maxTanE / Math.sqrt(1.0 + maxTanE * maxTanE);
      const sinW = maxTanW / Math.sqrt(1.0 + maxTanW * maxTanW);

      let occSum = 0.0;
      for (let d = 0; d < 8; d++) {
        const baseK = d * 3;
        let peakTan = 0.0;
        for (let r = 0; r < 3; r++) {
          const k = baseK + r;
          const nx = ix + aoOffX[k];
          const nz = iz + aoOffZ[k];
          if (nx >= 0 && nx < W && nz >= 0 && nz < H) {
            const tn = (heights[nz * W + nx] - h0) * aoInvD[k];
            if (tn > peakTan) peakTan = tn;
          }
        }
        occSum += peakTan / Math.sqrt(1.0 + peakTan * peakTan);
      }
      let skyView = 1.0 - (occSum * 0.125) * 1.15;
      if (skyView < 0.28) skyView = 0.28;
      else if (skyView > 1.0) skyView = 1.0;

      // Ecological treeline + slope + biome forest canopy density
      const ixL = ix > 0 ? ix - 1 : 0;
      const ixR = ix < W - 1 ? ix + 1 : W - 1;
      const gx = (heights[rowBase + ixR] - heights[rowBase + ixL]) * inv2CellX;
      const gz = (heights[rowD + ix] - heights[rowU + ix]) * inv2CellZ;
      const slope = Math.sqrt(gx * gx + gz * gz);

      const rw = evalRegionWeights(wx, wz);
      const grovePatch = smoothNoise2D(wx * 0.00065 + 3.1, wz * 0.00065 - 5.4);
      const biomeCanopy =
        rw.valley * 0.94 +
        rw.plateau * 0.96 +
        rw.hills * (0.62 + 0.36 * grovePatch) +
        rw.wetland * (0.34 + 0.38 * grovePatch) +
        rw.meadow * (0.20 + 0.34 * grovePatch) +
        rw.southPlain * (0.52 + 0.36 * grovePatch);

      const asl = TERRENO_WORLD.baseElevationASL + h0;
      const alpineTreeline = 1.0 - quinticSmoothstep(1060.0, 1420.0, asl);
      const slopeTree = 1.0 - quinticSmoothstep(0.56, 0.92, slope);
      const distRiv = wx > rivX ? wx - rivX : rivX - wx;
      const riverClear = quinticSmoothstep(rivHW + 2.0, rivHW + 20.0, distRiv);
      const roadClear = 1.0 - roadMaskArr[idx];
      const flowWet = Math.min(1.0, Math.log1p(flowArea[idx]) / 7.2);
      const dxComp = wx - compX;
      const dComp2 = dxComp * dxComp + dzComp * dzComp;
      const compClear = dComp2 < 784.0 ? quinticSmoothstep(16.0, 28.0, Math.sqrt(dComp2)) : 1.0;
      const dxVill = wx - villX;
      const dVill2 = dxVill * dxVill + dzVill * dzVill;
      const villClear = dVill2 < 3136.0 ? quinticSmoothstep(34.0, 56.0, Math.sqrt(dVill2)) : 1.0;
      let canopy = biomeCanopy * alpineTreeline * slopeTree * riverClear * roadClear * compClear * villClear * (0.86 + 0.14 * flowWet);
      if (canopy < 0.0) canopy = 0.0;
      else if (canopy > 1.0) canopy = 1.0;

      const o4 = idx * 4;
      out[o4]     = sinE <= 0 ? 0 : (sinE >= 1 ? 255 : (sinE * 255.0 + 0.5) | 0);
      out[o4 + 1] = sinW <= 0 ? 0 : (sinW >= 1 ? 255 : (sinW * 255.0 + 0.5) | 0);
      out[o4 + 2] = (skyView * 255.0 + 0.5) | 0;
      out[o4 + 3] = (canopy * 255.0 + 0.5) | 0;
    }
  }
  return out;
}

/**
 * Master Geomorphology Builder — constructs the 60 km × 60 km photorealistic Japanese Alpine-Valley World!
 */
export function buildTerrenoGeomorphology() {
  const tStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const W = TERRENO_WORLD.atlasW;
  const H = TERRENO_WORLD.atlasH;
  const N = W * H;
  const cellX = TERRENO_WORLD.width / (W - 1);
  const cellZ = TERRENO_WORLD.depth / (H - 1);
  const minX = TERRENO_WORLD.minX;
  const minZ = TERRENO_WORLD.minZ;

  const heights = new Float32Array(N);
  const roadMaskArr = new Float32Array(N);

  const roadPolylines = buildDenseRoadNetwork();
  const roadDense = roadPolylines[0].pts;
  const roadIndex = buildRoadSpatialIndex(roadPolylines);

  // Precompute river profile per row iz
  const riverRowX = new Float32Array(H);
  const riverRowBedY = new Float32Array(H);
  const riverRowWaterY = new Float32Array(H);
  const riverRowHW = new Float32Array(H);
  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rv = evalMainRiver(wz);
    riverRowX[iz] = rv.x;
    riverRowBedY[iz] = rv.bedY;
    riverRowWaterY[iz] = rv.waterY;
    riverRowHW[iz] = rv.halfWidth;
  }

  // Precompute mountain peak rotated axes & bounding boxes for fast evaluation
  const peaksPrepared = MOUNTAIN_PEAKS.map((pk, pi) => {
    const maxR = Math.max(pk.radiusX, pk.radiusZ) * 1.42;
    return {
      ...pk,
      pi,
      cosA: Math.cos(pk.ridgeAngle),
      sinA: Math.sin(pk.ridgeAngle),
      invRx: 1.0 / pk.radiusX,
      invRz: 1.0 / pk.radiusZ,
      minX: pk.x - maxR,
      maxX: pk.x + maxR,
      minZ: pk.z - maxR,
      maxZ: pk.z + maxR,
    };
  });

  const tribPrepared = TRIBUTARIES.map((tr, ti) => {
    const rv = evalMainRiver(tr.z0);
    const zEnd = tr.z0 + tr.dirZ * (tr.len + 320.0);
    const margin = tr.width * 4.5 + 260.0;
    return {
      ...tr,
      ti,
      x0: rv.x,
      y0: rv.bedY,
      invLen: 1.0 / tr.len,
      minZ: Math.min(tr.z0, zEnd) - margin,
      maxZ: Math.max(tr.z0, zEnd) + margin,
    };
  });

  // =========================================================================
  // PASS 1: REAL-WORLD JAPANESE ALPINE-VALLEY, FOOTHILLS & MASSIF SYNTHESIS
  // =========================================================================
  const compX = TERRENO_WORLD.compoundCenterX;
  const compZ = TERRENO_WORLD.compoundCenterZ;
  const villX = TERRENO_WORLD.villageCenterX;
  const villZ = TERRENO_WORLD.villageCenterZ;

  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rivX = riverRowX[iz];
    const rivBed = riverRowBedY[iz];
    const rivWaterY = riverRowWaterY[iz];
    const rivHW = riverRowHW[iz];
    const dzComp = wz - compZ;
    const dzVill = wz - villZ;
    const rowBase = iz * W;

    const rowTribs = [];
    for (let ti = 0; ti < tribPrepared.length; ti++) {
      const tr = tribPrepared[ti];
      if (wz >= tr.minZ && wz <= tr.maxZ) rowTribs.push(tr);
    }
    const rowPeaks = [];
    for (let pi = 0; pi < peaksPrepared.length; pi++) {
      const pk = peaksPrepared[pi];
      if (wz >= pk.minZ && wz <= pk.maxZ) rowPeaks.push(pk);
    }

    for (let ix = 0; ix < W; ix++) {
      const idx = rowBase + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const dxRiv = wx > rivX ? wx - rivX : rivX - wx;

      const rw = evalRegionWeights(wx, wz);

      // Multi-scale tectonic domain warp -> natural geological folding & foothill spurs!
      const warpX = (smoothNoise2D(wx * 0.00018 + 4.1, wz * 0.00018 - 2.3) - 0.5) * 1900.0;
      const warpZ = (smoothNoise2D(wx * 0.00018 - 8.7, wz * 0.00018 + 6.9) - 0.5) * 1900.0;
      const fMacro = landFbm((wx + warpX) * 0.00020, (wz + warpZ) * 0.00020, 4);
      const rMacro = ridgedFbm((wx + warpX * 0.8) * 0.00024 + 5.2, (wz + warpZ * 0.8) * 0.00024 - 3.8, 4);
      const fMed = landFbm(wx * 0.00072 + 12.4, wz * 0.00072 - 6.8, 3);
      const rMed = ridgedFbm(wx * 0.0014 - 7.3, wz * 0.0014 + 9.6, 3);
      const fFine = smoothNoise2D(wx * 0.0028 - 3.7, wz * 0.0028 + 9.2);

      // Tight settlement apron — real undulating forest foothills start ~75m from the house (NO 2.2km flat pancake!)
      const dComp = Math.hypot(wx - compX, dzComp);
      const dVill = Math.hypot(wx - villX, dzVill);
      const dSettlement = Math.min(dComp, dVill);
      const settleRelief = quinticSmoothstep(62.0, 260.0, dSettlement);

      // 1a. Rich Multi-Biome Natural Mountain-Foothill Base Landforms
      // Central Valley rises naturally into wooded valley flanks away from the river channel!
      const valleyFlank = quinticSmoothstep(rivHW + 95.0, rivHW + 1450.0, dxRiv);
      const valleyH = rivBed + 4.90 + (fMed * 16.0 + rMed * 18.0 + fFine * 4.5 - 4.0) * settleRelief
        + valleyFlank * (48.0 * fMacro + 76.0 * rMacro);

      // Western Forested Mountain Foothills (dramatic terraced slopes & spurs)
      const hillsH = rivBed + 32.0 + fMacro * 95.0 + rMacro * 145.0 + rMed * 28.0 + fMed * 16.0;

      // Northern Ancient Beech & Birch Mountain Highland
      const plateauH = rivBed + 42.0 + quinticSmoothstep(0.18, 0.78, fMacro) * 110.0 + rMacro * 135.0 + fMed * 22.0;

      // Eastern Misty Mountain-Basin Wetlands & Wooded Knoll Ridges
      const wetlandH = rivBed + 5.0 + (fMacro - 0.25) * 28.0 + rMacro * 42.0 + fMed * 8.0;

      // Southwestern Sunlit Susuki Upland Meadows & Pine Ridges
      const meadowH = rivBed + 20.0 + fMacro * 68.0 + rMacro * 88.0 + fMed * 16.0;

      // Southern Forested Valley & Red-Pine Bluffs
      const southPlainH = rivBed + 14.0 + fMacro * 44.0 + rMacro * 56.0 + fMed * 12.0;

      let h =
        valleyH * rw.valley +
        hillsH * rw.hills +
        plateauH * rw.plateau +
        wetlandH * rw.wetland +
        meadowH * rw.meadow +
        southPlainH * rw.southPlain;

      // 1b. Add 18 Sculpted Geological Mountain Massifs with Radiating Ridge Spurs!
      // Carefully modulated away from Kurosugi River bed & settlements so passes stay lush and scenic!
      const riverValleyCarve = quinticSmoothstep(rivHW + 55.0, rivHW + 520.0, dxRiv);
      const peakClear = settleRelief * riverValleyCarve;
      if (peakClear > 0.002) {
        let peakAdd = 0.0;
        for (let pi = 0; pi < rowPeaks.length; pi++) {
          const pk = rowPeaks[pi];
          if (wx < pk.minX || wx > pk.maxX) continue;
          const dx = wx - pk.x;
          const dz = wz - pk.z;
          // Rotate into mountain ridge strike orientation
          const lx = (dx * pk.cosA + dz * pk.sinA) * pk.invRx;
          const lz = (-dx * pk.sinA + dz * pk.cosA) * pk.invRz;
          // Subtle radiating geological ridge ribs (star-like alpine buttress spurs!)
          const ang = Math.atan2(lz, lx);
          const spurWarp = 1.0
            + 0.14 * Math.cos(ang * 3.0 + pk.pi * 1.7)
            + 0.08 * Math.sin(ang * 5.0 - pk.pi * 2.3);
          const distN = Math.hypot(lx, lz) / spurWarp;
          if (distN < 1.32) {
            const baseProf = Math.pow(Math.max(0.0, 1.0 - distN / 1.32), 1.65 * pk.sharpness);
            // Multiply with local ridged multifractal so summits have authentic craggy alpine spines!
            const ridgeSculpt = 0.58 + 0.56 * rMacro + 0.24 * rMed;
            const contrib = pk.height * baseProf * ridgeSculpt;
            if (contrib > peakAdd) peakAdd = contrib + peakAdd * 0.22;
            else peakAdd += contrib * 0.28;
          }
        }
        h += peakAdd * peakClear;
      }

      // 1c. Natural Mountain River Floodplain & Cobble Valley Floor (smooth stepped terraces)
      const riverBankEnv = quinticSmoothstep(rivHW * 0.95, rivHW + 210.0, dxRiv);
      const riverFloor = rivBed + quinticSmoothstep(0.0, rivHW * 1.25, dxRiv) * (rivWaterY - rivBed + 2.4);
      h = riverFloor + (h - riverFloor) * riverBankEnv;

      // 1d. 12 Cascading Mountain Tributary Valleys carved naturally through forested ridges
      for (let ti = 0; ti < rowTribs.length; ti++) {
        const tr = rowTribs[ti];
        const rx = wx - tr.x0;
        const rz = wz - tr.z0;
        const along = rx * tr.dirX + rz * tr.dirZ;
        if (along < -60.0 || along > tr.len + 260.0) continue;
        const meander = Math.sin(along * 0.0014 + tr.ti * 2.1) * 160.0 + Math.cos(along * 0.0036) * 52.0;
        const perp = Math.abs(-rx * tr.dirZ + rz * tr.dirX - meander);
        const u = along < 0.0 ? 0.0 : (along > tr.len ? 1.0 : along * tr.invLen);
        const halfW = tr.width * (1.20 - 0.42 * u);
        if (perp < halfW * 3.2) {
          const swaleEnv =
            (1.0 - quinticSmoothstep(0.0, halfW * 3.0, perp))
            * (1.0 - u * 0.80)
            * quinticSmoothstep(-60.0, 150.0, along)
            * settleRelief;
          const targetBed = h - tr.depth * (0.42 + 0.58 * (1.0 - u));
          h = h * (1.0 - swaleEnv * 0.48) + targetBed * (swaleEnv * 0.48);
        }
      }

      heights[idx] = h;
    }
  }

  // =========================================================================
  // PASS 2: RIDGE CURVATURE TENSOR + D8 FLUVIAL EROSION & 34° TALUS REPOSE
  // =========================================================================
  const flowArea = runAlpineHydrologyAndErosion(heights, W, H, cellX, cellZ);
  const ridgeTensor = applyRidgeCurvaturePass(heights, W, H, cellX, cellZ);

  // =========================================================================
  // PASS 3: CLEAN RIVER CHANNEL + SMOOTH MOUNTAIN ROAD CORRIDOR GRADING + FLUSH SETTLEMENTS
  // =========================================================================
  // Note: Roads NEVER create ugly dirt causeways across rivers — the riverbed stays open & flowing
  // underneath our real 3D Architectural Bridges (terrenoBridges.js)!
  // Gently relax steep cross-slopes right along road corridors so cars climb mountain passes realistically!
  const roadSmoothHeights = new Float32Array(heights);
  for (let pass = 0; pass < 3; pass++) {
    for (let iz = 2; iz < H - 2; iz++) {
      const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
      const rivX = riverRowX[iz];
      const rivHW = riverRowHW[iz];
      for (let ix = 2; ix < W - 2; ix++) {
        const idx = iz * W + ix;
        const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
        const rq = roadIndex.queryDist(wx, wz);
        if (rq.segIdx >= 0 && rq.dist < 85.0 && Math.abs(wx - rivX) > rivHW + 38.0) {
          const avg = (
            heights[idx - 1] + heights[idx + 1] +
            heights[idx - W] + heights[idx + W] +
            heights[idx - 2] + heights[idx + 2] +
            heights[idx - 2 * W] + heights[idx + 2 * W] +
            heights[idx] * 2.0
          ) * 0.1;
          const wRoad = 1.0 - quinticSmoothstep(12.0, 85.0, rq.dist);
          roadSmoothHeights[idx] = heights[idx] * (1.0 - wRoad * 0.72) + avg * (wRoad * 0.72);
        }
      }
    }
    heights.set(roadSmoothHeights);
  }

  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rivX = riverRowX[iz];
    const rivBed = riverRowBedY[iz];
    const rivWaterY = riverRowWaterY[iz];
    const rivHW = riverRowHW[iz];

    for (let ix = 0; ix < W; ix++) {
      const idx = iz * W + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;

      // 3a. Clean Natural Emerald Mountain River Channel & Gravel Banks (open under every 3D Bridge!)
      const dxRiv = Math.abs(wx - rivX);
      if (dxRiv < rivHW + 62.0) {
        const bankBenchY = rivWaterY + 2.25;
        let targetRivY;
        if (dxRiv <= rivHW * 0.80) {
          targetRivY = rivBed;
        } else if (dxRiv <= rivHW + 18.0) {
          const bankT = quinticSmoothstep(rivHW * 0.80, rivHW + 15.0, dxRiv);
          targetRivY = rivBed + (bankBenchY - rivBed) * bankT;
        } else {
          targetRivY = bankBenchY + (dxRiv - (rivHW + 18.0)) * 0.11;
        }
        const rivEnv = 1.0 - quinticSmoothstep(rivHW + 14.0, rivHW + 60.0, dxRiv);
        heights[idx] = heights[idx] * (1.0 - rivEnv) + targetRivY * rivEnv;
      }

      // 3b. Macro road mask (crisp 1.0m detail is rendered via uLocalDetailMap in clipmap!)
      const rq = roadIndex.queryDist(wx, wz);
      if (rq.segIdx >= 0 && rq.dist < 30.0) {
        const halfW = rq.width * 0.5;
        roadMaskArr[idx] = 1.0 - quinticSmoothstep(halfW * 0.85, halfW + 6.0, rq.dist);
      }

      // 3c. Tight Flush Compound & Suginosato Village Terraces
      const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
      if (dVill < TERRENO_WORLD.villageBlendRadius) {
        const vLockT = 1.0 - quinticSmoothstep(TERRENO_WORLD.villageFlatRadius, TERRENO_WORLD.villageBlendRadius, dVill);
        heights[idx] = heights[idx] * (1.0 - vLockT) + TERRENO_WORLD.villageGroundY * vLockT;
      }

      const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
      if (dComp < TERRENO_WORLD.compoundBlendRadius) {
        const lockT = 1.0 - quinticSmoothstep(TERRENO_WORLD.compoundFlatRadius, TERRENO_WORLD.compoundBlendRadius, dComp);
        heights[idx] = heights[idx] * (1.0 - lockT) + TERRENO_WORLD.compoundGroundY * lockT;
      }
    }
  }

  const sampleGridH = (wx, wz) => {
    const u = Math.max(0, Math.min(W - 1.001, ((wx - minX) / TERRENO_WORLD.width) * (W - 1)));
    const v = Math.max(0, Math.min(H - 1.001, ((wz - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const x0 = Math.floor(u), z0 = Math.floor(v);
    const fx = u - x0, fz = v - z0;
    const h00 = heights[z0 * W + x0];
    const h10 = heights[z0 * W + x0 + 1];
    const h01 = heights[(z0 + 1) * W + x0];
    const h11 = heights[(z0 + 1) * W + x0 + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  };
  const roadElevs = new Float32Array(roadDense.length);
  for (let i = 0; i < roadDense.length; i++) {
    roadElevs[i] = sampleGridH(roadDense[i][0], roadDense[i][1]);
  }

  // =========================================================================
  // PASS 4: PACK RGBA32F GEOMORPHOLOGY ATLAS + RGBA8 DUAL-AZIMUTH HORIZON ATLAS
  // =========================================================================
  const geoRGBA = new Float32Array(N * 4);
  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rivX = riverRowX[iz];
    const rivHW = riverRowHW[iz];
    for (let ix = 0; ix < W; ix++) {
      const idx = iz * W + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const o4 = idx * 4;
      const rw = evalRegionWeights(wx, wz);

      // R: exact float32 elevation (m)
      geoRGBA[o4] = heights[idx];

      // G: hydrological wetness [0..1]
      const d8Wet = Math.min(1.0, Math.log1p(flowArea[idx]) / 7.2);
      const rivWet = 1.0 - quinticSmoothstep(rivHW * 0.9, rivHW + 30.0, Math.abs(wx - rivX));
      const marshWet = rw.wetland * (0.48 + 0.44 * smoothNoise2D(wx * 0.0007 + 2.1, wz * 0.0007 - 4.3));
      geoRGBA[o4 + 1] = Math.min(1.0, Math.max(d8Wet, rivWet, marshWet));

      // B: geological ridge/curvature tensor [-1..+1]
      geoRGBA[o4 + 2] = ridgeTensor[idx];

      // A: road, compound & village micro-relief suppression mask [0..1]
      const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
      const compMask = 1.0 - quinticSmoothstep(TERRENO_WORLD.compoundFlatRadius, 46.0, dComp);
      const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
      const villMask = 1.0 - quinticSmoothstep(TERRENO_WORLD.villageFlatRadius - 2.0, TERRENO_WORLD.villageFlatRadius + 22.0, dVill);
      geoRGBA[o4 + 3] = Math.max(compMask, villMask, roadMaskArr[idx] * 0.95);
    }
  }

  const horizonRGBA = computeHorizonAndSkyViewAtlas(heights, flowArea, roadMaskArr, W, H, cellX, cellZ);

  const geoTexture = new THREE.DataTexture(geoRGBA, W, H, THREE.RGBAFormat, THREE.FloatType);
  geoTexture.minFilter = THREE.NearestFilter;
  geoTexture.magFilter = THREE.NearestFilter;
  geoTexture.wrapS = THREE.ClampToEdgeWrapping;
  geoTexture.wrapT = THREE.ClampToEdgeWrapping;
  geoTexture.generateMipmaps = false;
  geoTexture.needsUpdate = true;

  const horizonTexture = new THREE.DataTexture(horizonRGBA, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  horizonTexture.minFilter = THREE.LinearFilter;
  horizonTexture.magFilter = THREE.LinearFilter;
  horizonTexture.wrapS = THREE.ClampToEdgeWrapping;
  horizonTexture.wrapT = THREE.ClampToEdgeWrapping;
  horizonTexture.generateMipmaps = false;
  horizonTexture.needsUpdate = true;

  const bakeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tStart;

  function sampleGeoBilinear(wx, wz) {
    const u = Math.max(0.0, Math.min(W - 1.0001, ((wx - minX) / TERRENO_WORLD.width) * (W - 1)));
    const v = Math.max(0.0, Math.min(H - 1.0001, ((wz - minZ) / TERRENO_WORLD.depth) * (H - 1)));
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    const fx = u - x0;
    const fz = v - z0;
    const i00 = (z0 * W + x0) * 4;
    const i10 = i00 + 4;
    const i01 = i00 + W * 4;
    const i11 = i01 + 4;

    const w00 = (1.0 - fx) * (1.0 - fz);
    const w10 = fx * (1.0 - fz);
    const w01 = (1.0 - fx) * fz;
    const w11 = fx * fz;

    return {
      hMacro: geoRGBA[i00] * w00 + geoRGBA[i10] * w10 + geoRGBA[i01] * w01 + geoRGBA[i11] * w11,
      wetness: geoRGBA[i00 + 1] * w00 + geoRGBA[i10 + 1] * w10 + geoRGBA[i01 + 1] * w01 + geoRGBA[i11 + 1] * w11,
      ridge: geoRGBA[i00 + 2] * w00 + geoRGBA[i10 + 2] * w10 + geoRGBA[i01 + 2] * w01 + geoRGBA[i11 + 2] * w11,
      roadPad: geoRGBA[i00 + 3] * w00 + geoRGBA[i10 + 3] * w10 + geoRGBA[i01 + 3] * w01 + geoRGBA[i11 + 3] * w11,
    };
  }

  const sr = TERRENO_WORLD.southRect;
  const southRectY = sampleGeoBilinear(
    (sr.minX + sr.maxX) * 0.5,
    (sr.minZ + sr.maxZ) * 0.5,
  ).hMacro;

  // Live 3D Bridge Query Hook (registered by terrenoBridges.js right after geomorph build!)
  let bridgeQueryFn = null;
  let bridgeList = [];
  function setBridgeSystem(queryFn, list = []) {
    bridgeQueryFn = queryFn;
    bridgeList = list;
  }
  function queryBridgeAt(wx, wz) {
    return bridgeQueryFn ? bridgeQueryFn(wx, wz) : null;
  }

  /**
   * Bare natural terrain height (excluding elevated bridge decks — used by water & bridge piers!).
   */
  function getTerrainHeightAt(wx, wz) {
    const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
    if (dComp <= TERRENO_WORLD.compoundFlatRadius - 2.0) {
      return TERRENO_WORLD.compoundGroundY;
    }
    const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
    if (dVill <= TERRENO_WORLD.villageFlatRadius - 2.0) {
      return TERRENO_WORLD.villageGroundY;
    }
    const g = sampleGeoBilinear(wx, wz);
    const sW = evalSouthRectWeight(wx, wz);
    if (sW >= 0.999) return southRectY;
    // Suppress micro-relief smoothly on road corridors (exact road distance, not coarse 58m atlas!)
    const rq = roadIndex.queryDist(wx, wz);
    const exactRoadSup = rq.segIdx >= 0 && rq.dist < rq.width * 0.72 + 2.0
      ? (1.0 - quinticSmoothstep(rq.width * 0.45, rq.width * 0.72 + 2.0, rq.dist))
      : 0.0;
    const suppress = Math.max(g.roadPad, exactRoadSup);
    const hNat = g.hMacro + evalSharedMicroRelief(wx, wz, suppress);
    return sW > 0.0 ? (hNat * (1.0 - sW) + southRectY * sW) : hNat;
  }

  /**
   * Master Walkable / Driveable Surface Height: seamlessly lifts onto EVERY 3D Bridge Deck & Approach Ramp!
   */
  function getHeightAt(wx, wz) {
    const hTerrain = getTerrainHeightAt(wx, wz);
    if (bridgeQueryFn) {
      const bHit = bridgeQueryFn(wx, wz);
      if (bHit && bHit.onBridge && bHit.deckY > hTerrain - 0.15) {
        return Math.max(hTerrain, bHit.deckY);
      }
    }
    return hTerrain;
  }

  function getNormalAt(wx, wz, step = 1.2) {
    const hL = getHeightAt(wx - step, wz);
    const hR = getHeightAt(wx + step, wz);
    const hD = getHeightAt(wx, wz - step);
    const hU = getHeightAt(wx, wz + step);
    const nx = hL - hR;
    const ny = 2.0 * step;
    const nz = hD - hU;
    const len = Math.hypot(nx, ny, nz) || 1.0;
    return { x: nx / len, y: ny / len, z: nz / len, slope: Math.hypot(hR - hL, hU - hD) / (2.0 * step) };
  }

  function getMacroNormalAt(wx, wz, step = 3.0) {
    if (bridgeQueryFn) {
      const bHit = bridgeQueryFn(wx, wz);
      if (bHit && bHit.onBridge) {
        // Bridges always present a smooth engineered road grade to vehicles & autopilot!
        return { x: bHit.normalX || 0, y: bHit.normalY || 1, z: bHit.normalZ || 0, slope: bHit.slope || 0.04 };
      }
    }
    const hL = sampleGeoBilinear(wx - step, wz).hMacro;
    const hR = sampleGeoBilinear(wx + step, wz).hMacro;
    const hD = sampleGeoBilinear(wx, wz - step).hMacro;
    const hU = sampleGeoBilinear(wx, wz + step).hMacro;
    const nx = hL - hR;
    const ny = 2.0 * step;
    const nz = hD - hU;
    const len = Math.hypot(nx, ny, nz) || 1.0;
    return { x: nx / len, y: ny / len, z: nz / len, slope: Math.hypot(hR - hL, hU - hD) / (2.0 * step) };
  }

  function getBiomeInfoAt(wx, wz) {
    const g = sampleGeoBilinear(wx, wz);
    const y = getHeightAt(wx, wz);
    const asl = TERRENO_WORLD.baseElevationASL + y;
    const n = getNormalAt(wx, wz, 2.0);
    const rv = evalMainRiver(wz);
    const bHit = queryBridgeAt(wx, wz);
    const onBridge = Boolean(bHit && bHit.onBridge);
    const inRiver = !onBridge && Math.abs(wx - rv.x) < rv.halfWidth * 0.95 && y < rv.waterY + 0.4;
    const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
    const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
    const inVillage = dVill < TERRENO_WORLD.villageFlatRadius;
    const rq = roadIndex.queryDist(wx, wz);
    const isRoad = (rq.segIdx >= 0 && rq.dist < rq.width * 0.56) && dComp > 22.0 && !inVillage;
    const rw = evalRegionWeights(wx, wz);

    const inNullErea = isInsideSouthRect(wx, wz, 2.0);
    let zoneJp = '黒杉・紅葉の原生渓谷林';
    if (inNullErea) zoneJp = 'NULL EREA・地下40m飛行船基地';
    else if (onBridge) zoneJp = bHit.bridge.nameJp || '黒杉川大橋';
    else if (inVillage) zoneJp = '杉ノ郷集落';
    else if (inRiver) zoneJp = '黒杉川の清流';
    else if (isRoad) zoneJp = '山岳森林ロード';
    else if (asl > 1180) zoneJp = '高山岩稜・雪渓帯';
    else if (asl > 860) zoneJp = '亜高山針葉樹林帯';
    else {
      let bestW = rw.valley;
      if (rw.hills > bestW) { bestW = rw.hills; zoneJp = '西嶺もみじ・白樺山麓'; }
      if (rw.plateau > bestW) { bestW = rw.plateau; zoneJp = '北部ブナ原生林高地'; }
      if (rw.wetland > bestW) { bestW = rw.wetland; zoneJp = '東水郷・柳沢湿原'; }
      if (rw.meadow > bestW) { bestW = rw.meadow; zoneJp = '南西ススキ高原・赤松尾根'; }
      if (rw.southPlain > bestW) { bestW = rw.southPlain; zoneJp = '南部アカマツ渓谷林'; }
    }

    return {
      y,
      asl,
      slope: n.slope,
      normal: n,
      wetness: g.wetness,
      ridge: g.ridge,
      roadPad: g.roadPad,
      regions: rw,
      isRoad,
      onBridge,
      bridge: bHit ? bHit.bridge : null,
      inRiver,
      inVillage,
      riverY: rv.waterY,
      zoneJp,
    };
  }

  let minElev = 1e9, maxElev = -1e9;
  for (let i = 0; i < N; i++) {
    if (heights[i] < minElev) minElev = heights[i];
    if (heights[i] > maxElev) maxElev = heights[i];
  }

  return {
    W,
    H,
    heights,
    geoRGBA,
    horizonRGBA,
    geoTexture,
    horizonTexture,
    roadPolylines,
    roadDense,
    roadElevs,
    roadIndex,
    southRectY,
    minElev,
    maxElev,
    bakeMs,
    get bridges() { return bridgeList; },
    setBridgeSystem,
    queryBridgeAt,
    getTerrainHeightAt,
    getHeightAt,
    getNormalAt,
    getMacroNormalAt,
    sampleGeoBilinear,
    getBiomeInfoAt,
  };
}
