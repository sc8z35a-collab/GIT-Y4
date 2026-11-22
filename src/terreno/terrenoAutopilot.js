import { TERRENO_WORLD, FOREST_ROAD_POINTS, evalMainRiver } from './terrenoConfig.js';

/**
 * TERRENO On-Board Autonomous Navigation Computer:
 *   - 30 Curated Safe Mountain Destinations across the 5 km × 19 km Watershed (01..30)
 *   - + 4 Live Dynamic Asset Destinations (Home/Garage, KEI-340, CON-24 Container, CAMPER-75)
 *   - Real 128×384 Terrain-Cost A* Pathfinding (prefers graded forestry road, avoids cliffs, floods, & landslides!)
 *   - Smooth Wide-Radius Trajectory Filtering & Pure-Pursuit Silent Autopilot Controller
 */

// 30 Safe Mountain Destinations spanning North Headwaters (Z=-5850) to South Alpine Ridge (Z=+11850)
export const AUTOPILOT_WAYPOINTS = [
  { id: 'wp01', num: '01', nameJp: '北源流入口',     x: -520,  z: -5850 },
  { id: 'wp02', num: '02', nameJp: '北奥沢平',       x: -240,  z: -5100 },
  { id: 'wp03', num: '03', nameJp: '北尾根見晴',     x:  120,  z: -4820 },
  { id: 'wp04', num: '04', nameJp: '雲海北カーブ',   x:  420,  z: -4550 },
  { id: 'wp05', num: '05', nameJp: '雲海展望峠',     x:  860,  z: -4150 },
  { id: 'wp06', num: '06', nameJp: '霧沢ターン',     x:  610,  z: -3850 },
  { id: 'wp07', num: '07', nameJp: '東稜林道口',     x:  340,  z: -3550 },
  { id: 'wp08', num: '08', nameJp: '白樺ヘアピン',   x: -320,  z: -2950 },
  { id: 'wp09', num: '09', nameJp: '西森原生広場',   x: -540,  z: -2250 },
  { id: 'wp10', num: '10', nameJp: '苔杉北テラス',   x: -380,  z: -1820 },
  { id: 'wp11', num: '11', nameJp: '老杉林道中腹',   x: -260,  z: -1450 },
  { id: 'wp12', num: '12', nameJp: '北渓谷展望台',   x: -175,  z: -1020 },
  { id: 'wp13', num: '13', nameJp: '苔沢西分岐',     x: -110,  z:  -680 },
  { id: 'wp14', num: '14', nameJp: '拠点北アプローチ', x: -28,  z:  -210 },
  { id: 'wp15', num: '15', nameJp: '車庫前広場',     x:   15.6, z:  -18.0 },
  { id: 'wp16', num: '16', nameJp: '西回廊バイパス', x:  -42,  z:    24 },
  { id: 'wp17', num: '17', nameJp: '黒杉渓谷口',     x:  -95,  z:   140 },
  { id: 'wp18', num: '18', nameJp: '翡翠淵高台',     x:  -130, z:   330 },
  { id: 'wp19', num: '19', nameJp: '南杉並木段丘',   x: -165,  z:   520 },
  { id: 'wp20', num: '20', nameJp: '朝霧沢西岸',     x: -220,  z:   920 },
  { id: 'wp21', num: '21', nameJp: '中央峡谷カーブ', x: -260,  z:  1280 },
  { id: 'wp22', num: '22', nameJp: '東岳展望台',     x: -340,  z:  1820 },
  { id: 'wp23', num: '23', nameJp: '深森ヘアピン',   x: -420,  z:  2350 },
  { id: 'wp24', num: '24', nameJp: '翡翠尾根テラス', x: -380,  z:  2960 },
  { id: 'wp25', num: '25', nameJp: '中南林道広場',   x: -340,  z:  3550 },
  { id: 'wp26', num: '26', nameJp: '黒岳前衛尾根',   x: -540,  z:  4320 },
  { id: 'wp27', num: '27', nameJp: 'ブナ渓沢展望',   x: -680,  z:  4950 },
  { id: 'wp28', num: '28', nameJp: '黒岳ブナ尾根',   x: -920,  z:  6250 },
  { id: 'wp29', num: '29', nameJp: '南アルプス峠口', x: -620,  z:  7850 },
  { id: 'wp30', num: '30', nameJp: '白雲峰南林道終点', x: 220,  z: 10850 },
];

export const DYNAMIC_TARGETS = [
  { id: 'dyn_home',      code: '自宅', kind: 'home' },
  { id: 'dyn_kei',       code: '軽',   kind: 'kei' },
  { id: 'dyn_container', code: '箱',   kind: 'container' },
  { id: 'dyn_camper',    code: 'RV',   kind: 'camper' },
];

const GRID_W = 128;
const GRID_H = 384;
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

// Fast Binary Min-Heap for sub-12ms A* search across 49,152 terrain nodes
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

export function createTerrenoAutopilot(geomorph, storm) {
  let baseCostGrid = null;

  function ensureNavGrid() {
    if (baseCostGrid) return baseCostGrid;
    baseCostGrid = new Float32Array(GRID_W * GRID_H);
    for (let gz = 0; gz < GRID_H; gz++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const [wx, wz] = gridToWorld(gx, gz);
        const idx = gz * GRID_W + gx;
        const g = geomorph.sampleGeoBilinear(wx, wz);
        const mn = geomorph.getMacroNormalAt(wx, wz, 6.0);
        const rv = evalMainRiver(wz);
        const distRiv = Math.abs(wx - rv.x);
        const inRiver = distRiv < rv.halfWidth * 1.45 && g.hMacro < rv.waterY + 1.2;
        const rq = geomorph.roadIndex ? geomorph.roadIndex.queryDist(wx, wz) : { dist: 999 };
        const onRoadCorridor = g.roadPad > 0.20 || rq.dist < 44.0;

        let cost = 1.0;
        if (onRoadCorridor) {
          // Strong safe preference for continuous graded 19 km forestry road corridor!
          cost = 0.14 + (rq.dist / 44.0) * 0.08;
        } else if (inRiver) {
          cost = 65.0;
        } else if (mn.slope > 0.54) {
          // Steep cliff: impassable for safe autonomous routing!
          cost = 1e6;
        } else if (mn.slope > 0.34) {
          cost = 2.8 + (mn.slope - 0.34) * 28.0;
        } else {
          cost = 1.25 + mn.slope * 2.4;
        }
        baseCostGrid[idx] = cost;
      }
    }
    return baseCostGrid;
  }

  /**
   * Compute a safe drivable route from (startX, startZ) to (goalX, goalZ) avoiding cliffs,
   * deep flooded channels, and active landslides, preferring the graded mountain road!
   */
  function computeSafeRoute(startX, startZ, goalX, goalZ) {
    const grid = ensureNavGrid();
    const N = GRID_W * GRID_H;
    const [sx, sz] = worldToGrid(startX, startZ);
    const [ex, ez] = worldToGrid(goalX, goalZ);

    const startIdx = sz * GRID_W + sx;
    const goalIdx = ez * GRID_W + ex;

    if (Math.hypot(goalX - startX, goalZ - startZ) < 42.0) {
      return [[startX, startZ], [goalX, goalZ]];
    }

    const gScore = new Float32Array(N);
    gScore.fill(1e12);
    const cameFrom = new Int32Array(N);
    cameFrom.fill(-1);
    const closed = new Uint8Array(N);

    const heap = new MinHeap();
    gScore[startIdx] = 0;
    const hScale = 0.13; // Admissible heuristic matched to minimum road corridor cost!
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
    const maxIter = 36000;

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

        // Dynamic live flood & active landslide hazard avoidance!
        if (stormActive) {
          const [nwx, nwz] = gridToWorld(nx, nz);
          if (floodRise > 0.8) {
            const rv = evalMainRiver(nwz);
            if (Math.abs(nwx - rv.x) < rv.halfWidth + floodRise * 9.0) {
              cellCost += 28.0;
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
    if (rawPts.length === 0) return [[startX, startZ], [goalX, goalZ]];

    // Anchor exact start & goal points and snap road-proximate points directly onto crisp forestry road centerline!
    rawPts[0] = [startX, startZ];
    rawPts[rawPts.length - 1] = [goalX, goalZ];

    for (let i = 1; i < rawPts.length - 1; i++) {
      const rq = geomorph.roadIndex.queryDist(rawPts[i][0], rawPts[i][1]);
      if (rq.dist < 38.0 && rq.segIdx >= 0) {
        const a = geomorph.roadDense[rq.segIdx];
        const b = geomorph.roadDense[rq.segIdx + 1];
        const rx = a[0] + (b[0] - a[0]) * rq.t;
        const rz = a[1] + (b[1] - a[1]) * rq.t;
        // Blend cleanly onto graded road center!
        rawPts[i] = [rx, rz];
      }
    }

    // If starting inside the 10x20m Garage (X=12..22, Z=-6..14), inject clean straight North exit point (-14m)!
    if (startX >= 11.5 && startX <= 22.5 && startZ >= -6.5 && startZ <= 14.5) {
      rawPts.splice(1, 0, [15.6, -15.0], [1.5, -22.0]);
    }

    // Chaikin corner-smoothing pass for wide turning radius suitable for 15.5m armored camper + trailer!
    const smoothOnce = (pts) => {
      if (pts.length <= 2) return pts;
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 8.0) {
          out.push(p1);
          continue;
        }
        out.push([p0[0] * 0.72 + p1[0] * 0.28, p0[1] * 0.72 + p1[1] * 0.28]);
        out.push([p0[0] * 0.28 + p1[0] * 0.72, p0[1] * 0.28 + p1[1] * 0.72]);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };

    let smoothed = smoothOnce(rawPts);
    // Resample to clean ~14m spacing
    const resampled = [smoothed[0]];
    for (let i = 1; i < smoothed.length; i++) {
      const prev = resampled[resampled.length - 1];
      const cur = smoothed[i];
      if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= 12.0 || i === smoothed.length - 1) {
        resampled.push(cur);
      }
    }
    return resampled;
  }

  /**
   * Pure-Pursuit Silent Autopilot Controller for ARMOR-155 (returns throttle [-1..1], steer [-1..1], arrived).
   */
  function evaluateDrivingControl(pose, speed, routeState, grip = 0.95) {
    if (!routeState || !routeState.points || routeState.points.length < 2) {
      return { throttle: 0, steer: 0, arrived: true };
    }
    const pts = routeState.points;
    const goal = pts[pts.length - 1];
    const distToGoal = Math.hypot(goal[0] - pose.cx, goal[1] - pose.cz);
    if (distToGoal < 5.5) {
      return { throttle: 0, steer: 0, arrived: true };
    }

    // Advance nearest path cursor monotonically
    let cursor = routeState.cursor || 0;
    let bestD = Infinity;
    const searchEnd = Math.min(pts.length - 1, cursor + 16);
    for (let i = cursor; i <= searchEnd; i++) {
      const d = Math.hypot(pts[i][0] - pose.cx, pts[i][1] - pose.cz);
      if (d < bestD) {
        bestD = d;
        cursor = i;
      }
    }
    routeState.cursor = cursor;

    // Pick dynamic lookahead target (14m .. 34m ahead depending on speed & vehicle length!)
    const lookaheadDist = Math.max(14.0, Math.min(34.0, 14.0 + Math.abs(speed) * 1.15));
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

    // Transform target vector into vehicle local coordinates (Forward = (-sin(yaw), -cos(yaw)), Right = (cos(yaw), -sin(yaw)))
    const dx = targetPt[0] - pose.cx;
    const dz = targetPt[1] - pose.cz;
    const sinY = Math.sin(pose.yaw);
    const cosY = Math.cos(pose.yaw);
    const localFwd = -sinY * dx - cosY * dz;
    const localRight = cosY * dx - sinY * dz;
    const headingErr = Math.atan2(localRight, Math.max(0.5, localFwd));

    // Steering command (+1 turns Left, -1 turns Right — matches vehicle steering convention!)
    let steerCmd = Math.max(-1, Math.min(1, -headingErr * 1.85));

    // If target is behind us (e.g. tight turnaround), turn sharply while creeping forward/reverse safely
    let throttleCmd = 0.85;
    if (localFwd < -2.0 && distToGoal > 10.0) {
      steerCmd = localRight >= 0 ? -1.0 : 1.0;
      throttleCmd = 0.42;
    } else {
      // Modulate target cruising speed smoothly by curvature, grip (storm!), and approach distance
      const curveSlow = 1.0 - Math.min(0.62, Math.abs(headingErr) * 0.65);
      const gripSlow = 0.52 + 0.48 * Math.max(0.2, Math.min(1.0, grip));
      const approachSlow = Math.min(1.0, distToGoal / 28.0);
      const desiredSpeed = Math.max(3.2, 14.5 * curveSlow * gripSlow * approachSlow);
      if (speed < desiredSpeed - 0.6) throttleCmd = Math.min(1.0, (desiredSpeed - speed) * 0.28 + 0.35);
      else if (speed > desiredSpeed + 1.2) throttleCmd = -0.35;
      else throttleCmd = 0.18;
    }

    return { throttle: throttleCmd, steer: steerCmd, arrived: false };
  }

  return {
    waypoints: AUTOPILOT_WAYPOINTS,
    dynamicTargets: DYNAMIC_TARGETS,
    computeSafeRoute,
    evaluateDrivingControl,
  };
}
