import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';
import { NULL_EREA } from '../airshipData.js';
import { VILLAGE_HOUSES } from '../villageData.js';

/**
 * TERRENO On-Board Autonomous Navigation Computer (60 km × 60 km, 21 Roads):
 *   - 31 Curated Countryside Waypoints (including NULL EREA Underground Airship Base)
 *   - + 7 Live Dynamic Asset Destinations (Home/Garage, NULL EREA, K-11, KEI-340, CON-24, CAMPER-75, ARMOR-155)
 *   - Real 240×240 Terrain-Cost A* Pathfinding + Strict Mathematical Reachability Verification for K-11 Camper Summon
 *   - Smooth Wide-Radius Trajectory Filtering & Autonomous Controllers (CAMPER-75, ARMOR-155, & Airship K-11)
 */

// 31 Curated Scenic Countryside Waypoints across the 60 km × 60 km 21-Road Network + NULL EREA
export const AUTOPILOT_WAYPOINTS = [
  { id: 'wp01', num: '01', nameJp: '最北白樺パノラマ',   x:  -1200, z: -24200 },
  { id: 'wp02', num: '02', nameJp: '北西丘陵ループ北',   x: -11800, z: -22800 },
  { id: 'wp03', num: '03', nameJp: '北西森林十字路',     x: -17200, z: -16500 },
  { id: 'wp04', num: '04', nameJp: '北部台地中央口',     x:    420, z: -16500 },
  { id: 'wp05', num: '05', nameJp: '北東ブナ林分岐',     x:  17800, z: -16300 },
  { id: 'wp06', num: '06', nameJp: '最北東湖畔入口',     x:  25000, z: -24400 },
  { id: 'wp07', num: '07', nameJp: '最西牧野北口',       x: -25600, z: -12400 },
  { id: 'wp08', num: '08', nameJp: '白樺北西合流点',     x:  -8600, z: -11600 },
  { id: 'wp09', num: '09', nameJp: '中央環状北ゲート',   x:    220, z:  -8600 },
  { id: 'wp10', num: '10', nameJp: '北東広葉樹林道',     x:   9200, z: -13800 },
  { id: 'wp11', num: '11', nameJp: '西丘陵パノラマ口',   x: -17500, z:   -380 },
  { id: 'wp12', num: '12', nameJp: '環状西テラス',       x:  -9400, z:   -620 },
  { id: 'wp13', num: '13', nameJp: '車庫前広場',         x:     15.6, z:  -18.0 },
  { id: 'wp14', num: '14', nameJp: '黒杉川・清流口',     x:    -55, z:   -420 },
  { id: 'wp15', num: '15', nameJp: '杉ノ郷集落(5棟)',    x:    788, z:   1280 },
  { id: 'wp16', num: '16', nameJp: '東岸せせらぎ原',     x:   4400, z:   1600 },
  { id: 'wp17', num: '17', nameJp: '環状東ミスト入口',   x:   9600, z:   -320 },
  { id: 'wp18', num: '18', nameJp: '東水郷・湿原連絡口', x:  17200, z:   4800 },
  { id: 'wp19', num: '19', nameJp: '最東葦原レイク',     x:  26500, z:   6800 },
  { id: 'wp20', num: '20', nameJp: '最西草原連絡口',     x: -26600, z:   6400 },
  { id: 'wp21', num: '21', nameJp: '西丘陵草原口',       x: -16800, z:   4600 },
  { id: 'wp22', num: '22', nameJp: '西岸リバーサイド',   x:  -3800, z:   6800 },
  { id: 'wp23', num: '23', nameJp: '中央環状南分岐',     x:   -920, z:   9200 },
  { id: 'wp24', num: '24', nameJp: '南西ススキ大草原',   x: -13200, z:  14200 },
  { id: 'wp25', num: '25', nameJp: '南部草原中央交点',   x:  -1280, z:  14800 },
  { id: 'wp26', num: '26', nameJp: '南東水辺ループ口',   x:  11800, z:  15200 },
  { id: 'wp27', num: '27', nameJp: '南東湿原パノラマ',   x:  17800, z:  14700 },
  { id: 'wp28', num: '28', nameJp: '最南西松原入口',     x: -17400, z:  14900 },
  { id: 'wp29', num: '29', nameJp: '南部沖積松原口',     x:    640, z:  24200 },
  { id: 'wp30', num: '30', nameJp: '南東松原平原',       x:  13600, z:  24600 },
  { id: 'wp31', num: 'NL', nameJp: 'NULL EREA (K-11基地)', x:   28, z:  29910 },
];

export const DYNAMIC_TARGETS = [
  { id: 'dyn_home',      code: '自宅', kind: 'home' },
  { id: 'dyn_null',      code: 'NULL', kind: 'null_erea' },
  { id: 'dyn_k11',       code: 'K-11', kind: 'k11' },
  { id: 'dyn_kei',       code: '軽',   kind: 'kei' },
  { id: 'dyn_container', code: '箱',   kind: 'container' },
  { id: 'dyn_camper',    code: 'RV',   kind: 'camper' },
  { id: 'dyn_armor',     code: '装甲', kind: 'armor' },
];

const GRID_W = 240;
const GRID_H = 240;
const CELL_W = TERRENO_WORLD.width / (GRID_W - 1);
const CELL_H = TERRENO_WORLD.depth / (GRID_H - 1);

function worldToGrid(wx, wz) {
  const gx = Math.max(0, Math.min(GRID_W - 1, Math.round(((wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width) * (GRID_W - 1))));
  const gz = Math.max(0, Math.min(GRID_H - 1, Math.round(((wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth) * (GRID_H - 1))));
  return [gx, gz];
}

function gridToWorld(gx, gz) {
  return [
    TERRENO_WORLD.minX + (gx / (GRID_W - 1)) * TERRENO_WORLD.width,
    TERRENO_WORLD.minZ + (gz / (GRID_H - 1)) * TERRENO_WORLD.depth,
  ];
}

// Fast Binary Min-Heap for sub-15ms A* search across 57,600 terrain nodes
class MinHeap {
  constructor() {
    this.nodes = [];
    this.scores = [];
  }
  push(node, score) {
    this.nodes.push(node);
    this.scores.push(score);
    let i = this.nodes.length - 1;
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
    const lastN = this.nodes.pop();
    const lastS = this.scores.pop();
    if (this.nodes.length > 0) {
      this.nodes[0] = lastN;
      this.scores[0] = lastS;
      let i = 0;
      const len = this.nodes.length;
      while (true) {
        let s = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < len && this.scores[l] < this.scores[s]) s = l;
        if (r < len && this.scores[r] < this.scores[s]) s = r;
        if (s === i) break;
        const tn = this.nodes[i]; this.nodes[i] = this.nodes[s]; this.nodes[s] = tn;
        const ts = this.scores[i]; this.scores[i] = this.scores[s]; this.scores[s] = ts;
        i = s;
      }
    }
    return top;
  }
  get size() { return this.nodes.length; }
}

const DEFAULT_VEHICLE_PROFILES = {
  camper: {
    maxSpeed: 17.5,
    minSpeed: 3.4,
    lookaheadMin: 10.5,
    lookaheadMax: 26.0,
    steerGain: 2.05,
    arriveDist: 4.5,
  },
  armor: {
    maxSpeed: 15.2,
    minSpeed: 3.2,
    lookaheadMin: 14.0,
    lookaheadMax: 34.0,
    steerGain: 1.85,
    arriveDist: 5.5,
  },
};

export function createTerrenoAutopilot(geomorph, storm) {
  let baseCostGrid = null;

  function ensureNavGrid() {
    if (baseCostGrid) return baseCostGrid;
    baseCostGrid = new Float32Array(GRID_W * GRID_H);
    const roadSnapBand = Math.max(150.0, Math.hypot(CELL_W, CELL_H) * 0.72);
    for (let gz = 0; gz < GRID_H; gz++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const [wx, wz] = gridToWorld(gx, gz);
        const idx = gz * GRID_W + gx;
        const g = geomorph.sampleGeoBilinear(wx, wz);
        const mn = geomorph.getMacroNormalAt(wx, wz, 8.0);
        const rv = evalMainRiver(wz);
        const distRiv = Math.abs(wx - rv.x);
        const inRiver = distRiv < rv.halfWidth * 1.25 && g.hMacro < rv.waterY + 1.0;
        const rq = geomorph.roadIndex ? geomorph.roadIndex.queryDist(wx, wz) : { dist: 9999 };
        const onRoadCorridor = g.roadPad > 0.16 || rq.dist < roadSnapBand;

        let cost = 1.0;
        if (onRoadCorridor) {
          // Strong safe preference for all 21 terrain-conforming countryside roads!
          cost = 0.14 + (Math.min(rq.dist, roadSnapBand) / roadSnapBand) * 0.08;
        } else if (inRiver) {
          cost = 32.0;
        } else if (mn.slope > 0.45) {
          cost = 12.0 + (mn.slope - 0.45) * 40.0;
        } else {
          cost = 1.15 + mn.slope * 2.2;
        }
        baseCostGrid[idx] = cost;
      }
    }
    return baseCostGrid;
  }

  /**
   * Compute a safe drivable route from (startX, startZ) to ANY free destination (goalX, goalZ)
   * across the 60 km × 60 km world, preferring the 21-road network and avoiding floods/hazards.
   */
  function computeSafeRoute(startX, startZ, goalX, goalZ) {
    const clampedGoalX = Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, goalX));
    const clampedGoalZ = Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, goalZ));

    if (Math.hypot(clampedGoalX - startX, clampedGoalZ - startZ) < 42.0) {
      return [[startX, startZ], [clampedGoalX, clampedGoalZ]];
    }

    const grid = ensureNavGrid();
    const N = GRID_W * GRID_H;
    const [sx, sz] = worldToGrid(startX, startZ);
    const [ex, ez] = worldToGrid(clampedGoalX, clampedGoalZ);

    const startIdx = sz * GRID_W + sx;
    const goalIdx = ez * GRID_W + ex;

    const gScore = new Float32Array(N);
    gScore.fill(1e12);
    const cameFrom = new Int32Array(N);
    cameFrom.fill(-1);
    const closed = new Uint8Array(N);

    const heap = new MinHeap();
    gScore[startIdx] = 0;
    const hScale = 0.13;
    const heuristic = (gx, gz) => Math.hypot((gx - ex) * CELL_W, (gz - ez) * CELL_H) * hScale;
    heap.push(startIdx, heuristic(sx, sz));

    const stormActive = storm && storm.getIntensity() > 0.15;
    const floodRise = storm ? storm.getFloodRise() : 0;
    const activeSlides = storm ? storm.landslides.filter((l) => l.progress > 0.25) : [];

    const dirs = [
      [-1, 0, CELL_W], [1, 0, CELL_W], [0, -1, CELL_H], [0, 1, CELL_H],
      [-1, -1, Math.hypot(CELL_W, CELL_H)], [1, -1, Math.hypot(CELL_W, CELL_H)],
      [-1, 1, Math.hypot(CELL_W, CELL_H)], [1, 1, Math.hypot(CELL_W, CELL_H)],
    ];

    let bestNode = startIdx;
    let bestRemDist = Math.hypot((sx - ex) * CELL_W, (sz - ez) * CELL_H);
    let iterations = 0;
    const maxIter = 45000;

    while (heap.size > 0 && iterations++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;

      if (cur === goalIdx) {
        bestNode = cur;
        break;
      }

      const cx = cur % GRID_W;
      const cz = (cur - cx) / GRID_W;
      const rem = Math.hypot((cx - ex) * CELL_W, (cz - ez) * CELL_H);
      if (rem < bestRemDist) {
        bestRemDist = rem;
        bestNode = cur;
      }

      const curG = gScore[cur];
      for (let d = 0; d < 8; d++) {
        const nx = cx + dirs[d][0];
        const nz = cz + dirs[d][1];
        if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
        const nIdx = nz * GRID_W + nx;
        if (closed[nIdx]) continue;

        let cellCost = grid[nIdx];
        if (cellCost >= 1e5 && nIdx !== goalIdx) continue;

        if (stormActive) {
          const [nwx, nwz] = gridToWorld(nx, nz);
          if (floodRise > 0.8) {
            const rv = evalMainRiver(nwz);
            if (Math.abs(nwx - rv.x) < rv.halfWidth + floodRise * 8.0) {
              cellCost += 24.0;
            }
          }
          for (let s = 0; s < activeSlides.length; s++) {
            const ls = activeSlides[s];
            if (Math.hypot(nwx - ls.x, nwz - ls.z) < ls.radius + 24.0) {
              cellCost += 14.0;
            }
          }
        }

        const stepCost = dirs[d][2] * cellCost;
        const candG = curG + stepCost;
        if (candG < gScore[nIdx]) {
          gScore[nIdx] = candG;
          cameFrom[nIdx] = cur;
          heap.push(nIdx, candG + heuristic(nx, nz));
        }
      }
    }

    // Reconstruct raw grid polyline
    const rawPts = [];
    let node = bestNode;
    while (node !== -1) {
      const nx = node % GRID_W;
      const nz = (node - nx) / GRID_W;
      rawPts.push(gridToWorld(nx, nz));
      node = cameFrom[node];
    }
    rawPts.reverse();
    if (rawPts.length <= 1) {
      rawPts.length = 0;
      rawPts.push([startX, startZ], [clampedGoalX, clampedGoalZ]);
    } else {
      // Anchor exact start & goal points and snap road-proximate nodes onto ANY of the 21 road centerlines!
      rawPts[0] = [startX, startZ];
      rawPts[rawPts.length - 1] = [clampedGoalX, clampedGoalZ];
    }

    for (let i = 1; i < rawPts.length - 1; i++) {
      const rq = geomorph.roadIndex.queryDist(rawPts[i][0], rawPts[i][1]);
      if (rq.dist < 145.0 && rq.roadIdx >= 0) {
        const rx = rq.ax + (rq.bx - rq.ax) * rq.t;
        const rz = rq.az + (rq.bz - rq.az) * rq.t;
        rawPts[i] = [rx, rz];
      }
    }

    // Chaikin corner-smoothing pass for wide turning radius suitable for both campers
    const smoothOnce = (pts) => {
      if (pts.length <= 2) return pts;
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 10.0) {
          out.push(p1);
          continue;
        }
        out.push([p0[0] * 0.72 + p1[0] * 0.28, p0[1] * 0.72 + p1[1] * 0.28]);
        out.push([p0[0] * 0.28 + p1[0] * 0.72, p0[1] * 0.28 + p1[1] * 0.72]);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };

    const smoothed = smoothOnce(rawPts);
    // Resample to clean ~18m spacing (subdividing long 250m legs smoothly!)
    const resampled = [smoothed[0]];
    for (let i = 1; i < smoothed.length; i++) {
      const prev = resampled[resampled.length - 1];
      const cur = smoothed[i];
      const segLen = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      if (segLen > 38.0) {
        const subSteps = Math.min(24, Math.ceil(segLen / 24.0));
        for (let s = 1; s <= subSteps; s++) {
          const u = s / subSteps;
          let sxPt = prev[0] + (cur[0] - prev[0]) * u;
          let szPt = prev[1] + (cur[1] - prev[1]) * u;
          if (i < smoothed.length - 1) {
            const rq = geomorph.roadIndex.queryDist(sxPt, szPt);
            if (rq.dist < 26.0 && rq.roadIdx >= 0) {
              sxPt = rq.ax + (rq.bx - rq.ax) * rq.t;
              szPt = rq.az + (rq.bz - rq.az) * rq.t;
            }
          }
          resampled.push([sxPt, szPt]);
        }
      } else if (segLen >= 12.0 || i === smoothed.length - 1) {
        resampled.push(cur);
      }
    }

    // Prepend exact unsmoothed bay pull-out points so vehicles exit compound bays cleanly
    if (startX >= 11.5 && startX <= 22.5 && startZ >= -6.5 && startZ <= 14.5) {
      resampled.splice(1, 0, [15.6, -16.5], [1.5, -26.0]);
    } else if (startX >= 5.0 && startX <= 11.5 && startZ >= 0.0 && startZ <= 14.5) {
      resampled.splice(1, 0, [7.75, 18.2], [1.5, 25.0]);
    }
    return resampled;
  }

  /**
   * Generate a smooth forward cruise route when autopilot is switched ON from the driver's seat
   * without a map destination yet — follows the road ahead or cruises straight gently!
   */
  function buildCruiseAheadRoute(startX, startZ, yaw, cruiseDist = 2400) {
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const goalX = Math.max(TERRENO_WORLD.playMinX + 40, Math.min(TERRENO_WORLD.playMaxX - 40, startX + fwdX * cruiseDist));
    const goalZ = Math.max(TERRENO_WORLD.playMinZ + 40, Math.min(TERRENO_WORLD.playMaxZ - 40, startZ + fwdZ * cruiseDist));
    return computeSafeRoute(startX, startZ, goalX, goalZ);
  }

  /**
   * Pure-Pursuit Silent Autopilot Controller for CAMPER-75 & ARMOR-155
   * Returns { throttle [-1..1], steer [-1..1], arrived }.
   */
  function evaluateDrivingControl(pose, speed, routeState, grip = 0.95, vehicleKey = 'armor') {
    if (!routeState || !routeState.points || routeState.points.length < 2) {
      return { throttle: 0, steer: 0, arrived: true };
    }
    const prof = DEFAULT_VEHICLE_PROFILES[vehicleKey] || DEFAULT_VEHICLE_PROFILES.armor;
    const pts = routeState.points;
    const goal = pts[pts.length - 1];
    const distToGoal = Math.hypot(goal[0] - pose.cx, goal[1] - pose.cz);
    const arriveThreshold = routeState.isSummon ? Math.max(prof.arriveDist, 7.5) : prof.arriveDist;
    if (distToGoal < arriveThreshold) {
      return { throttle: 0, steer: 0, arrived: true };
    }

    // 1. Precision Reverse Pull-Out when CAMPER-75 is inside its East compound bay (Storage-4 sits directly North!)
    if (pose.cx >= 5.0 && pose.cx <= 11.8 && pose.cz >= 0.0 && pose.cz < 16.8 && distToGoal > 12.0) {
      if (Math.cos(pose.yaw) > -0.2) {
        const steerCenter = Math.max(-0.22, Math.min(0.22, (7.75 - pose.cx) * 0.25 - Math.sin(pose.yaw) * 0.9));
        return { throttle: -0.92, steer: steerCenter, arrived: false };
      }
    }

    // 2. Precision Straight North Pull-Out when ARMOR-155 is inside GARAGE-200
    if (pose.cx >= 11.8 && pose.cx <= 22.2 && pose.cz >= -11.5 && pose.cz <= 14.5 && distToGoal > 14.0) {
      const steerCenter = Math.max(-0.25, Math.min(0.25, -(15.60 - pose.cx) * 0.25 - Math.sin(pose.yaw) * 0.9));
      return { throttle: 0.88, steer: steerCenter, arrived: false };
    }

    // Advance nearest path cursor monotonically
    let cursor = routeState.cursor || 0;
    let bestD = Infinity;
    const searchEnd = Math.min(pts.length - 1, cursor + 22);
    for (let i = cursor; i <= searchEnd; i++) {
      const d = Math.hypot(pts[i][0] - pose.cx, pts[i][1] - pose.cz);
      if (d < bestD) {
        bestD = d;
        cursor = i;
      }
    }
    routeState.cursor = cursor;

    const lookaheadDist = Math.max(prof.lookaheadMin, Math.min(prof.lookaheadMax, prof.lookaheadMin + Math.abs(speed) * 1.12));
    let targetPt = goal;
    let accum = 0;
    for (let i = cursor; i < pts.length - 1; i++) {
      const segLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      accum += segLen;
      if (accum >= lookaheadDist) {
        targetPt = pts[i + 1];
        break;
      }
    }

    const dx = targetPt[0] - pose.cx;
    const dz = targetPt[1] - pose.cz;
    const sinY = Math.sin(pose.yaw);
    const cosY = Math.cos(pose.yaw);
    const localFwd = -sinY * dx - cosY * dz;
    const localRight = cosY * dx - sinY * dz;
    const headingErr = Math.atan2(localRight, Math.max(0.5, localFwd));

    let steerCmd = Math.max(-1, Math.min(1, -headingErr * prof.steerGain));
    let throttleCmd = 0.85;
    if (localFwd < -2.0 && distToGoal > 10.0) {
      steerCmd = localRight >= 0 ? -1.0 : 1.0;
      throttleCmd = 0.42;
    } else {
      const curveSlow = 1.0 - Math.min(0.62, Math.abs(headingErr) * 0.65);
      const gripSlow = 0.55 + 0.45 * Math.max(0.25, Math.min(1.0, grip));
      const approachSlow = Math.min(1.0, distToGoal / 28.0);
      const desiredSpeed = Math.max(prof.minSpeed, prof.maxSpeed * curveSlow * gripSlow * approachSlow);
      if (speed < desiredSpeed - 0.6) throttleCmd = Math.min(1.0, (desiredSpeed - speed) * 0.28 + 0.35);
      else if (speed > desiredSpeed + 1.2) throttleCmd = -0.35;
      else throttleCmd = 0.18;
    }

    return { throttle: throttleCmd, steer: steerCmd, arrived: false };
  }

  /**
   * Breakthrough #4 — Rigorous Mathematical Destination Reachability Validator for K-11 Camper Summon!
   * Rejects:
   *  - Out of playable map bounds
   *  - Rivers / deep water channels / storm flash-flood submerged zones (川などの場所は無効!)
   *  - Impassable steep slopes / cliffs
   *  - Solid building footprints (Main Tower, Annex, Storage, Suginosato Village houses, ELV-NULL pavilion)
   *  - Open 40m-deep NULL EREA Launch Silo pit
   *  - Any point mathematically unreachable via strict hard-barrier A* pathfinding!
   */
  function validateCamperDestination(vehicleKey, startX, startZ, goalX, goalZ, opts = {}) {
    const isArmor = vehicleKey === 'armor';
    const maxFordDepth = isArmor ? 1.15 : 0.72;
    const maxClimbSlope = isArmor ? 0.49 : 0.42;
    const cliffHardSlope = isArmor ? 0.60 : 0.52;

    if (
      !Number.isFinite(goalX) || !Number.isFinite(goalZ) ||
      goalX < TERRENO_WORLD.playMinX + 4 || goalX > TERRENO_WORLD.playMaxX - 4 ||
      goalZ < TERRENO_WORLD.playMinZ + 4 || goalZ > TERRENO_WORLD.playMaxZ - 4
    ) {
      return { valid: false, reason: 'bounds', reasonJp: '呼出不可：マップ範囲外の地点です' };
    }

    // 1. River & Deep Water Check (main meandering river + active storm floodwater!)
    const gGoal = geomorph.sampleGeoBilinear(goalX, goalZ);
    const yGoal = geomorph.getHeightAt(goalX, goalZ);
    const rvGoal = evalMainRiver(goalZ);
    const distRiv = Math.abs(goalX - rvGoal.x);
    const rqGoal = geomorph.roadIndex ? geomorph.roadIndex.queryDist(goalX, goalZ) : { dist: 9999 };
    const onRoadBridge = rqGoal.dist < (rqGoal.width || 10) * 0.55;
    const riverDepth = Math.max(0, rvGoal.waterY - yGoal);
    const floodInfo = storm ? storm.getFloodInfoAt(goalX, goalZ) : { depth: 0 };
    const effectiveDepth = Math.max(riverDepth, floodInfo.depth || 0);

    if (distRiv < rvGoal.halfWidth * 1.12 && (yGoal < rvGoal.waterY + 0.55 || riverDepth > 0.25)) {
      return { valid: false, reason: 'river', reasonJp: '呼出不可：川の上には呼び出せません' };
    }
    if (!onRoadBridge && effectiveDepth > maxFordDepth * 0.80) {
      return { valid: false, reason: 'water', reasonJp: '呼出不可：水域・浸水地帯のため到達不可' };
    }

    // 2. Steep Cliff / Unclimbable Terrain Check
    const nGoal = geomorph.getMacroNormalAt(goalX, goalZ, 4.0);
    if (nGoal.slope > maxClimbSlope) {
      return { valid: false, reason: 'slope', reasonJp: '呼出不可：急斜面のため車両が進入できません' };
    }

    // 3. Solid Building & Open 40m Launch Silo Pit Check
    const inSolidBuilding =
      (goalX >= -1.8 && goalX <= 5.5 && goalZ >= -0.6 && goalZ <= 10.6) || // Main Tower
      (goalX >= -8.0 && goalX <= -2.1 && goalZ >= -0.6 && goalZ <= 8.6) || // Annex
      (goalX >= 6.1 && goalX <= 9.1 && goalZ >= -0.6 && goalZ <= 2.6) ||   // Storage-4
      (goalX >= -28.5 && goalX <= -21.8 && goalZ >= 29906.2 && goalZ <= 29913.8); // ELV-NULL Pavilion
    if (inSolidBuilding) {
      return { valid: false, reason: 'building', reasonJp: '呼出不可：建物の上には呼び出せません' };
    }
    for (let i = 0; i < VILLAGE_HOUSES.length; i++) {
      const vh = VILLAGE_HOUSES[i];
      if (goalX >= vh.ox - 0.8 && goalX <= vh.ox + vh.w + 0.8 && goalZ >= vh.oz - 0.8 && goalZ <= vh.oz + vh.d + 0.8) {
        return { valid: false, reason: 'village_house', reasonJp: '呼出不可：集落建物の上には呼び出せません' };
      }
    }
    const sa = NULL_EREA.siloAperture;
    if (
      opts.siloOpen &&
      goalX >= sa.minX - 1.2 && goalX <= sa.maxX + 1.2 &&
      goalZ >= sa.minZ - 1.2 && goalZ <= sa.maxZ + 1.2
    ) {
      return { valid: false, reason: 'silo_pit', reasonJp: '呼出不可：開放中の地下40m立坑の上です' };
    }

    // 4. Strict Mathematical Hard-Barrier A* Connectivity Verification
    const directDist = Math.hypot(goalX - startX, goalZ - startZ);
    if (directDist >= 45.0) {
      const grid = ensureNavGrid();
      const [sx, sz] = worldToGrid(startX, startZ);
      const [ex, ez] = worldToGrid(goalX, goalZ);
      const startIdx = sz * GRID_W + sx;
      const goalIdx = ez * GRID_W + ex;
      const N = GRID_W * GRID_H;
      const gScore = new Float32Array(N);
      gScore.fill(1e12);
      const closed = new Uint8Array(N);
      const heap = new MinHeap();
      gScore[startIdx] = 0;
      const hFn = (gx, gz) => Math.hypot((gx - ex) * CELL_W, (gz - ez) * CELL_H) * 0.13;
      heap.push(startIdx, hFn(sx, sz));

      const dirs = [
        [-1, 0, CELL_W], [1, 0, CELL_W], [0, -1, CELL_H], [0, 1, CELL_H],
        [-1, -1, Math.hypot(CELL_W, CELL_H)], [1, -1, Math.hypot(CELL_W, CELL_H)],
        [-1, 1, Math.hypot(CELL_W, CELL_H)], [1, 1, Math.hypot(CELL_W, CELL_H)],
      ];
      const floodRise = storm ? storm.getFloodRise() : 0;
      let reached = false;
      let iter = 0;
      while (heap.size > 0 && iter++ < 48000) {
        const cur = heap.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === goalIdx) { reached = true; break; }
        const cx = cur % GRID_W;
        const cz = (cur - cx) / GRID_W;
        const curG = gScore[cur];
        for (let d = 0; d < 8; d++) {
          const nx = cx + dirs[d][0];
          const nz = cz + dirs[d][1];
          if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
          const nIdx = nz * GRID_W + nx;
          if (closed[nIdx]) continue;
          const baseC = grid[nIdx];
          // Hard-block unbridged deep river (>20 cost) & extreme unnavigable cliffs (>24) unless on a road corridor!
          if (nIdx !== goalIdx && baseC >= 28.0) {
            const [nwx, nwz] = gridToWorld(nx, nz);
            const rqn = geomorph.roadIndex ? geomorph.roadIndex.queryDist(nwx, nwz) : { dist: 9999 };
            if (rqn.dist > 155.0) continue; // Strictly impassable unbridged deep river/cliff!
          }
          let stepC = baseC;
          if (floodRise > 1.5 && nIdx !== goalIdx) {
            const [nwx, nwz] = gridToWorld(nx, nz);
            const rvn = evalMainRiver(nwz);
            if (Math.abs(nwx - rvn.x) < rvn.halfWidth + floodRise * 4.0) {
              const rqn = geomorph.roadIndex ? geomorph.roadIndex.queryDist(nwx, nwz) : { dist: 9999 };
              if (rqn.dist > 155.0) continue; // Flooded river bank strictly impassable off-road!
            }
          }
          const candG = curG + dirs[d][2] * stepC;
          if (candG < gScore[nIdx]) {
            gScore[nIdx] = candG;
            heap.push(nIdx, candG + hFn(nx, nz));
          }
        }
      }
      if (!reached) {
        return { valid: false, reason: 'unreachable', reasonJp: '呼出不可：経路計算により到達不可能な地点です' };
      }
    }

    const points = computeSafeRoute(startX, startZ, goalX, goalZ);
    // Final sanity check: make sure route doesn't cut directly across deep water without bridge if short
    if (directDist < 45.0 && directDist > 4.0) {
      const steps = Math.ceil(directDist / 5.0);
      for (let s = 1; s < steps; s++) {
        const u = s / steps;
        const sx = startX + (goalX - startX) * u;
        const sz = startZ + (goalZ - startZ) * u;
        const rvs = evalMainRiver(sz);
        const ys = geomorph.getHeightAt(sx, sz);
        if (Math.abs(sx - rvs.x) < rvs.halfWidth * 0.95 && ys < rvs.waterY - maxFordDepth) {
          return { valid: false, reason: 'river_between', reasonJp: '呼出不可：間に渡れない川があります' };
        }
        if (geomorph.getMacroNormalAt(sx, sz, 3.0).slope > cliffHardSlope) {
          return { valid: false, reason: 'cliff_between', reasonJp: '呼出不可：経路上に登坂不能な崖があります' };
        }
      }
    }

    return { valid: true, points, distM: directDist };
  }

  /**
   * Breakthrough #3 — Direct High-Altitude Aerial Route Corridor Planner for Airship K-11!
   */
  function computeAirshipRoute(startX, startZ, goalX, goalZ) {
    const gx = Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, goalX));
    const gz = Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, goalZ));
    const dist = Math.hypot(gx - startX, gz - startZ);
    const segs = Math.max(2, Math.min(64, Math.ceil(dist / 800.0)));
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      pts.push([startX + (gx - startX) * u, startZ + (gz - startZ) * u]);
    }
    return pts;
  }

  return {
    waypoints: AUTOPILOT_WAYPOINTS,
    dynamicTargets: DYNAMIC_TARGETS,
    computeSafeRoute,
    buildCruiseAheadRoute,
    evaluateDrivingControl,
    validateCamperDestination,
    computeAirshipRoute,
  };
}
