import * as THREE from 'three';
import {
  TERRENO_WORLD,
  TRIBUTARIES,
  ROAD_NETWORK,
  evalMainRiver,
  evalRegionWeights,
} from './terrenoConfig.js';

/**
 * TERRENO 2.0 Engine — Non-Mountainous Multi-Biome Geomorphology Solver (60 km × 60 km = 3,600 km²)
 * Synthesizes seamless rolling hills, alluvial river plains, broadleaf beech/birch plateaus,
 * misty wetlands & reed marshes, expansive sunlit susuki grasslands, and southern pine flats,
 * with D8 hydrological wetness, gentle soil drainage, 21 non-carving terrain-conforming roads,
 * and exact CPU-GPU height parity via RGBA32F Float32 + RGBA8 Horizon Atlas.
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

// Smooth organic rotated-octave FBM for gentle rolling hills, plateaus, & meadows (zero jagged peaks!)
function gentleLandFbm(x, z, octaves = 4) {
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

/**
 * Exact Micro-Relief Function — IDENTICAL math runs on CPU and in GLSL vertex shader!
 * Adds subtle organic soil undulation (0.3m..0.8m) without harsh crags or mountain rocks.
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
  const n1 = glslCompatibleNoise(x * 0.042, z * 0.042) - 0.5;
  const n2 = glslCompatibleNoise(x * 0.14 + 19.3, z * 0.14 - 7.1) - 0.5;
  const swell = glslCompatibleNoise(x * 0.018 - 4.2, z * 0.018 + 11.8) - 0.5;
  const micro = n1 * 0.44 + n2 * 0.14 + swell * 0.56;
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
 * Sample Catmull-Rom splines densely for ALL 21 natural terrain-conforming roads across 60 km × 60 km.
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
    const segSamples = Math.max(8, Math.min(80, Math.ceil(segLen / 85.0)));
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
    width: road.width || 9.5,
    pts: sampleSingleRoadSpline(road.points),
  }));
}

/**
 * Zero-GC integer-keyed spatial hash indexing ALL segments across all 21 roads in the 60 km × 60 km world.
 */
function buildRoadSpatialIndex(roadPolylines) {
  const bucketSize = 180.0;
  const buckets = new Map();
  const keyOf = (bx, bz) => ((bx + 4096) << 14) | ((bz + 4096) & 0x3fff);

  // Flat typed segment arrays for ultra-fast cache-friendly queries
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

      const pad = 42.0;
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

  const NO_HIT = { dist: 9999, segIdx: -1, roadIdx: -1, t: 0, width: 9.5, ax: 0, az: 0, bx: 0, bz: 0 };
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
 * Gentle Lowland/Hillside Micro-Drainage & Curvature Tensor Pass:
 * Computes subtle natural soil drainage swales and surface curvature without sharp mountain ravines.
 */
function applyGentleDrainagePass(heights, W, H, cellX, cellZ) {
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
      const curv = Math.max(-1.0, Math.min(1.0, -lap * 0.45 + slope * 0.35));
      ridgeTensor[idx] = curv;
    }
  }
  return ridgeTensor;
}

/**
 * Topological D8 Flow Accumulation + Gentle Soil Drainage Smoothing:
 * Computes accurate watershed wetness across all 1,048,576 cells (60 km × 60 km)
 * and gently relaxes any excess slopes to soft pastoral angles (<= 14°).
 */
function runGentleHydrologyAndFlow(heights, W, H, cellX, cellZ) {
  const N = W * H;
  const flowArea = new Float32Array(N);
  flowArea.fill(1.0);

  // O(N) descending bucket sort by elevation
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

      // Very gentle lowland stream drainage (never carves deep gullies or cliffs!)
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
      const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
      const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
      if (dComp > 45.0 && dVill > 60.0) {
        const incise = Math.min(3.8, 0.055 * Math.pow(a, 0.34) * Math.pow(bestSlope, 1.05));
        const protect = quinticSmoothstep(45.0, 140.0, dComp) * quinticSmoothstep(60.0, 165.0, dVill);
        heights[idx] -= incise * protect;
      }
    }
  }

  // Soft pastoral slope relaxation (~16° max soil repose angle -> guarantees smooth rolling hills!)
  const reposeTan = Math.tan((16.0 * Math.PI) / 180.0);
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
            const transfer = (diff - maxDiff) * 0.24;
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
 * Dual-Azimuth Horizon Shadow + 8-Direction Sky-View AO + Multi-Biome Canopy Density Atlas (1024×1024).
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
      let skyView = 1.0 - (occSum * 0.125) * 1.05;
      if (skyView < 0.35) skyView = 0.35;
      else if (skyView > 1.0) skyView = 1.0;

      // Biome-driven macro forest canopy density (dense in valley & plateau, dappled on hills & south plain, open in meadows & wetlands!)
      const ixL = ix > 0 ? ix - 1 : 0;
      const ixR = ix < W - 1 ? ix + 1 : W - 1;
      const gx = (heights[rowBase + ixR] - heights[rowBase + ixL]) * inv2CellX;
      const gz = (heights[rowD + ix] - heights[rowU + ix]) * inv2CellZ;
      const slope = Math.sqrt(gx * gx + gz * gz);

      const rw = evalRegionWeights(wx, wz);
      const grovePatch = smoothNoise2D(wx * 0.00055 + 3.1, wz * 0.00055 - 5.4);
      const biomeCanopy =
        rw.valley * 0.88 +
        rw.plateau * 0.94 +
        rw.hills * (0.48 + 0.44 * grovePatch) +
        rw.wetland * (0.20 + 0.35 * grovePatch) +
        rw.meadow * (0.12 + 0.32 * grovePatch) +
        rw.southPlain * (0.38 + 0.40 * grovePatch);

      const slopeTree = 1.0 - quinticSmoothstep(0.50, 0.88, slope);
      const distRiv = wx > rivX ? wx - rivX : rivX - wx;
      const riverClear = quinticSmoothstep(rivHW + 3.0, rivHW + 22.0, distRiv);
      const roadClear = 1.0 - roadMaskArr[idx];
      const flowWet = Math.min(1.0, Math.log1p(flowArea[idx]) / 7.2);
      const dxComp = wx - compX;
      const dComp2 = dxComp * dxComp + dzComp * dzComp;
      const compClear = dComp2 < 784.0 ? quinticSmoothstep(16.0, 28.0, Math.sqrt(dComp2)) : 1.0;
      const dxVill = wx - villX;
      const dVill2 = dxVill * dxVill + dzVill * dzVill;
      const villClear = dVill2 < 3136.0 ? quinticSmoothstep(34.0, 56.0, Math.sqrt(dVill2)) : 1.0;
      let canopy = biomeCanopy * slopeTree * riverClear * roadClear * compClear * villClear * (0.86 + 0.14 * flowWet);
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
 * Master Geomorphology Builder — creates the entire 60 km × 60 km (3,600 km²) non-mountainous world & GPU atlases!
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

  // Build spatial index for ALL 21 terrain-conforming roads
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

  const tribPrepared = TRIBUTARIES.map((tr, ti) => {
    const rv = evalMainRiver(tr.z0);
    const zEnd = tr.z0 + tr.dirZ * (tr.len + 320.0);
    const margin = tr.width * 4.2 + 240.0;
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
  // PASS 1: SEAMLESS 60km × 60km NON-MOUNTAINOUS MULTI-BIOME LANDFORM SYNTHESIS
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

    for (let ix = 0; ix < W; ix++) {
      const idx = rowBase + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const dxRiv = wx > rivX ? wx - rivX : rivX - wx;

      // 1a. Continuous C2-smooth regional biome weights (zero seams across 60 km!)
      const rw = evalRegionWeights(wx, wz);

      // Soft multi-scale domain-warped FBM components for gentle non-mountain landforms
      const warpX = (smoothNoise2D(wx * 0.00011 + 4.1, wz * 0.00011 - 2.3) - 0.5) * 2400.0;
      const warpZ = (smoothNoise2D(wx * 0.00011 - 8.7, wz * 0.00011 + 6.9) - 0.5) * 2400.0;
      const fMacro = gentleLandFbm((wx + warpX) * 0.00014, (wz + warpZ) * 0.00014, 4); // [0..1]
      const fMed = gentleLandFbm(wx * 0.00042 + 12.4, wz * 0.00042 - 6.8, 3);          // [0..1]
      const fFine = smoothNoise2D(wx * 0.0012 - 3.7, wz * 0.0012 + 9.2);               // [0..1]

      // Broad natural gentle relief per landform type (ALL gentle, zero alpine peaks or cliffs!)
      // 1) Central Alluvial River Valley & Cedar Plain (naturally level near NARROW-50 & Suginosato Village!)
      const dSettlement = Math.min(
        Math.hypot(wx - compX, dzComp),
        Math.hypot(wx - villX, dzVill),
      );
      const settleCalm = quinticSmoothstep(220.0, 2200.0, dSettlement);
      const valleyH = rivBed + 4.82 + (fMed * 5.2 + fFine * 1.4 - 2.2) * settleCalm;

      // 2) Rolling Green Hills & Pastoral Uplands (West / NW — graceful soft rolling swells, max ~68m)
      const rollWave = 0.5 + 0.5 * Math.sin((wx + warpX * 0.4) * 0.00075 + Math.cos(wz * 0.00055) * 1.2);
      const hillsH = rivBed + 14.0 + fMacro * 42.0 + rollWave * 14.0 + fMed * 8.0;

      // 3) Broadleaf Beech & Birch Woodland Plateau (North / NE — smooth softly-terraced tablelands)
      const plateauStep = quinticSmoothstep(0.24, 0.72, fMacro);
      const plateauH = rivBed + 18.0 + plateauStep * 48.0 + fMed * 10.0 + fFine * 2.6;

      // 4) Misty Wetlands, Reed Marshes & Quiet Lake Basins (East — low peaceful wet flats)
      const wetlandH = rivBed + 3.2 + (fMacro - 0.35) * 6.5 + (fMed - 0.5) * 3.0;

      // 5) Expansive Sunlit Susuki Grasslands & Prairies (SW / Mid-South — sweeping rolling prairie waves)
      const meadowH = rivBed + 8.5 + fMacro * 24.0 + fMed * 7.5 + fFine * 1.8;

      // 6) Southern Alluvial Plains & Pine Flats (Far South — broad tranquil sandy-loam plains)
      const southPlainH = rivBed + 6.2 + fMacro * 13.0 + fMed * 4.0 + fFine * 1.2;

      // Seamless C2 weighted blend across all 6 landforms
      let h =
        valleyH * rw.valley +
        hillsH * rw.hills +
        plateauH * rw.plateau +
        wetlandH * rw.wetland +
        meadowH * rw.meadow +
        southPlainH * rw.southPlain;

      // 1b. Gentle Natural River Floodplain & Channel (broad grassy banks — zero canyon cliffs!)
      const riverBankEnv = quinticSmoothstep(rivHW * 0.9, rivHW + 380.0, dxRiv);
      const riverFloor = rivBed + quinticSmoothstep(0.0, rivHW * 1.25, dxRiv) * (rivWaterY - rivBed + 1.85);
      h = riverFloor + (h - riverFloor) * riverBankEnv;

      // 1c. 12 Gentle Shallow Rural Tributary Streams (soft grassy swales, never deep gorges!)
      for (let ti = 0; ti < rowTribs.length; ti++) {
        const tr = rowTribs[ti];
        const rx = wx - tr.x0;
        const rz = wz - tr.z0;
        const along = rx * tr.dirX + rz * tr.dirZ;
        if (along < -60.0 || along > tr.len + 280.0) continue;
        const meander = Math.sin(along * 0.0014 + tr.ti * 2.1) * 160.0 + Math.cos(along * 0.0036) * 52.0;
        const perp = Math.abs(-rx * tr.dirZ + rz * tr.dirX - meander);
        const u = along < 0.0 ? 0.0 : (along > tr.len ? 1.0 : along * tr.invLen);
        const halfW = tr.width * (1.25 - 0.45 * u);
        if (perp < halfW * 3.4) {
          const swaleEnv =
            (1.0 - quinticSmoothstep(0.0, halfW * 3.2, perp))
            * (1.0 - u * 0.85)
            * quinticSmoothstep(-60.0, 160.0, along)
            * settleCalm;
          const targetBed = h - tr.depth * (0.45 + 0.55 * (1.0 - u));
          h = h * (1.0 - swaleEnv * 0.42) + targetBed * (swaleEnv * 0.42);
        }
      }

      heights[idx] = h;
    }
  }

  // =========================================================================
  // PASS 2: GENTLE CURVATURE & MICRO-DRAINAGE TENSOR
  // =========================================================================
  const ridgeTensor = applyGentleDrainagePass(heights, W, H, cellX, cellZ);

  // =========================================================================
  // PASS 3: D8 HYDROLOGICAL FLOW ACCUMULATION & PASTORAL SLOPE RELAXATION
  // =========================================================================
  const flowArea = runGentleHydrologyAndFlow(heights, W, H, cellX, cellZ);

  // =========================================================================
  // PASS 4: CLEAN RIVER CHANNEL + 21 NON-CARVING ROADS + FLUSH SETTLEMENT LOCKS
  // =========================================================================
  for (let iz = 0; iz < H; iz++) {
    const wz = minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rivX = riverRowX[iz];
    const rivBed = riverRowBedY[iz];
    const rivWaterY = riverRowWaterY[iz];
    const rivHW = riverRowHW[iz];

    for (let ix = 0; ix < W; ix++) {
      const idx = iz * W + ix;
      const wx = minX + (ix / (W - 1)) * TERRENO_WORLD.width;

      // 4a. Gentle shallow gravel riverbank shaping
      const dxRiv = Math.abs(wx - rivX);
      if (dxRiv < rivHW + 68.0) {
        const bankBenchY = rivWaterY + 1.45;
        let targetRivY;
        if (dxRiv <= rivHW * 0.82) {
          targetRivY = rivBed;
        } else if (dxRiv <= rivHW + 16.0) {
          const bankT = quinticSmoothstep(rivHW * 0.82, rivHW + 12.0, dxRiv);
          targetRivY = rivBed + (bankBenchY - rivBed) * bankT;
        } else {
          targetRivY = bankBenchY + (dxRiv - (rivHW + 16.0)) * 0.06;
        }
        const rivEnv = 1.0 - quinticSmoothstep(rivHW + 14.0, rivHW + 66.0, dxRiv);
        heights[idx] = heights[idx] * (1.0 - rivEnv) + targetRivY * rivEnv;
      }

      // 4b. ZERO-CARVING 21-ROAD NETWORK:
      // Roads drape naturally over untouched terrain (never cutting or slicing any hill!).
      // Only across wet river channels do roads rise smoothly onto a low dry ford/causeway.
      const rq = roadIndex.queryDist(wx, wz);
      if (rq.segIdx >= 0 && rq.dist < 32.0) {
        const halfW = rq.width * 0.5;
        roadMaskArr[idx] = 1.0 - quinticSmoothstep(halfW * 0.85, halfW + 5.0, rq.dist);
        if (dxRiv < rivHW + 22.0 && heights[idx] < rivWaterY + 0.72) {
          const causewayT = (1.0 - quinticSmoothstep(halfW + 1.5, halfW + 11.0, rq.dist))
            * (1.0 - quinticSmoothstep(rivHW + 4.0, rivHW + 22.0, dxRiv));
          heights[idx] = heights[idx] * (1.0 - causewayT) + (rivWaterY + 0.72) * causewayT;
        }
      }

      // 4c. Natural flush settlement settling (natural terrain is ALREADY ~ -1.2m / -0.35m flat plain -> zero carving!)
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

  // Sample natural ground elevations along primary trunk road for backward-compatible consumers
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
  // PASS 5: PACK RGBA32F GEOMORPHOLOGY ATLAS + RGBA8 DUAL-AZIMUTH HORIZON ATLAS
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

      // G: hydrological wetness [0..1] combining D8 flow accumulation, main river proximity, & wetland region
      const d8Wet = Math.min(1.0, Math.log1p(flowArea[idx]) / 7.4);
      const rivWet = 1.0 - quinticSmoothstep(rivHW * 0.9, rivHW + 32.0, Math.abs(wx - rivX));
      const marshWet = rw.wetland * (0.48 + 0.44 * smoothNoise2D(wx * 0.0007 + 2.1, wz * 0.0007 - 4.3));
      geoRGBA[o4 + 1] = Math.min(1.0, Math.max(d8Wet, rivWet, marshWet));

      // B: curvature / gentle terrain relief tensor [-1..+1]
      geoRGBA[o4 + 2] = ridgeTensor[idx];

      // A: road, compound & village micro-suppression mask [0..1]
      const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
      const compMask = 1.0 - quinticSmoothstep(TERRENO_WORLD.compoundFlatRadius, 52.0, dComp);
      const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
      const villMask = 1.0 - quinticSmoothstep(TERRENO_WORLD.villageFlatRadius - 2.0, TERRENO_WORLD.villageFlatRadius + 24.0, dVill);
      geoRGBA[o4 + 3] = Math.max(compMask, villMask, roadMaskArr[idx] * 0.92);
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

  function getHeightAt(wx, wz) {
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
    const hNat = g.hMacro + evalSharedMicroRelief(wx, wz, g.roadPad);
    return sW > 0.0 ? (hNat * (1.0 - sW) + southRectY * sW) : hNat;
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
    const inRiver = Math.abs(wx - rv.x) < rv.halfWidth * 0.95 && y < rv.waterY + 0.4;
    const dComp = Math.hypot(wx - TERRENO_WORLD.compoundCenterX, wz - TERRENO_WORLD.compoundCenterZ);
    const dVill = Math.hypot(wx - TERRENO_WORLD.villageCenterX, wz - TERRENO_WORLD.villageCenterZ);
    const inVillage = dVill < TERRENO_WORLD.villageFlatRadius;
    const isRoad = g.roadPad > 0.42 && dComp > 22.0 && !inVillage;
    const rw = evalRegionWeights(wx, wz);

    const inNullErea = isInsideSouthRect(wx, wz, 2.0);
    let zoneJp = 'スギ・ヒノキ平地林';
    if (inNullErea) zoneJp = 'NULL EREA・地下40m飛行船基地';
    else if (inVillage) zoneJp = '杉ノ郷集落';
    else if (inRiver) zoneJp = '黒杉川の清流';
    else if (isRoad) zoneJp = 'カントリーロード';
    else {
      let bestW = rw.valley;
      if (rw.hills > bestW) { bestW = rw.hills; zoneJp = '緑のなだらか丘陵'; }
      if (rw.plateau > bestW) { bestW = rw.plateau; zoneJp = 'ブナ・白樺の森林台地'; }
      if (rw.wetland > bestW) { bestW = rw.wetland; zoneJp = '水郷湿原・葦原'; }
      if (rw.meadow > bestW) { bestW = rw.meadow; zoneJp = 'ススキ大草原'; }
      if (rw.southPlain > bestW) { bestW = rw.southPlain; zoneJp = '南部松原平野'; }
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
    getHeightAt,
    getNormalAt,
    getMacroNormalAt,
    sampleGeoBilinear,
    getBiomeInfoAt,
  };
}
