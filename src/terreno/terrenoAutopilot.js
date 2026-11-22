import { TERRENO_WORLD, FOREST_ROAD_POINTS, evalMainRiver } from './terrenoConfig.js';

/**
 * TERRENO On-Board Autonomous Navigation Computer:
 *   - 30 Curated Safe Mountain Destinations across the 5 km × 19 km Watershed (01..30)
 *   - + 4 Live Dynamic Asset Destinations (Home/Garage, KEI-340, CON-24 Container, CAMPER-75)
 *   - Real 128×384 Terrain-Cost A* Pathfinding (prefers graded forestry road, avoids cliffs, floods, & landslides!)
 *   - Smooth Wide-Radius Trajectory Filtering & Pure-Pursuit Silent Autopilot Controller
 */

// 30 Safe Mountain Destinations spanning the full 15 km × 40 km Forestry Road (North Headwaters Z=-13100 -> Suginosato Village -> South Alps Z=+24950)
export const AUTOPILOT_WAYPOINTS = [
  { id: 'wp01', num: '01', nameJp: '北アルプス源流口', x: -1420, z: -13100 },
  { id: 'wp02', num: '02', nameJp: '北奥霧氷平',       x:  -680, z: -11800 },
  { id: 'wp03', num: '03', nameJp: '北東尾根見晴',     x:   240, z: -10600 },
  { id: 'wp04', num: '04', nameJp: '雲海展望峠',       x:   920, z:  -9450 },
  { id: 'wp05', num: '05', nameJp: '雲海南カーブ',     x:   320, z:  -8100 },
  { id: 'wp06', num: '06', nameJp: '霧沢西分岐',       x:  -580, z:  -6850 },
  { id: 'wp07', num: '07', nameJp: '白樺ヘアピン',     x: -1120, z:  -5550 },
  { id: 'wp08', num: '08', nameJp: '西森原生林道',     x:  -740, z:  -4150 },
  { id: 'wp09', num: '09', nameJp: '古杉北尾根',       x:  -420, z:  -2850 },
  { id: 'wp10', num: '10', nameJp: '苔杉西沢口',       x:  -210, z:  -1550 },
  { id: 'wp11', num: '11', nameJp: '北渓谷展望台',     x:   -85, z:   -580 },
  { id: 'wp12', num: '12', nameJp: '拠点北アプローチ', x:   -24, z:   -180 },
  { id: 'wp13', num: '13', nameJp: '車庫前広場',       x:    15.6, z:  -18.0 },
  { id: 'wp14', num: '14', nameJp: '西回廊バイパス',   x:   -42, z:     24 },
  { id: 'wp15', num: '15', nameJp: '黒杉渓谷口',       x:   -88, z:    145 },
  { id: 'wp16', num: '16', nameJp: '翡翠淵高台',       x:    65, z:    460 },
  { id: 'wp17', num: '17', nameJp: '朝霧沢南テラス',   x:   420, z:    840 },
  { id: 'wp18', num: '18', nameJp: '杉ノ郷北アプローチ', x: 735, z:   1140 },
  { id: 'wp19', num: '19', nameJp: '杉ノ郷集落(5棟)',  x:   788, z:   1280 },
  { id: 'wp20', num: '20', nameJp: '杉ノ郷南段丘',     x:   610, z:   1880 },
  { id: 'wp21', num: '21', nameJp: '清流沢カーブ',     x:   280, z:   2650 },
  { id: 'wp22', num: '22', nameJp: '翡翠西尾根口',     x:  -120, z:   3850 },
  { id: 'wp23', num: '23', nameJp: '深緑中南広場',     x:  -540, z:   5450 },
  { id: 'wp24', num: '24', nameJp: '黒岳前衛尾根',     x: -1080, z:   7250 },
  { id: 'wp25', num: '25', nameJp: '黒岳ブナ尾根',     x: -1620, z:   9250 },
  { id: 'wp26', num: '26', nameJp: 'ブナ大嶺南口',     x: -1340, z:  11400 },
  { id: 'wp27', num: '27', nameJp: '西アルプス峠口',   x:  -780, z:  13650 },
  { id: 'wp28', num: '28', nameJp: '翠巒中岳テラス',   x:  -320, z:  16100 },
  { id: 'wp29', num: '29', nameJp: '白雲峰展望林道',   x:   980, z:  21250 },
  { id: 'wp30', num: '30', nameJp: '南アルプス終点',   x:   280, z:  24950 },
];

export const DYNAMIC_TARGETS = [
  { id: 'dyn_home',      code: '自宅', kind: 'home' },
  { id: 'dyn_kei',       code: '軽',   kind: 'kei' },
  { id: 'dyn_container', code: '箱',   kind: 'container' },
  { id: 'dyn_camper',    code: 'RV',   kind: 'camper' },
];

const GRID_W = 144;
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

// Fast Binary Min-Heap for sub-14ms A* search across 55,296 terrain nodes
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
    const roadSnapBand = Math.max(58.0, Math.hypot(CELL_W, CELL_H) * 0.85);
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
        const onRoadCorridor = g.roadPad > 0.20 || rq.dist < roadSnapBand;

        let cost = 1.0;
        if (onRoadCorridor) {
          // Strong safe preference for continuous graded 40 km forestry road corridor!
          cost = 0.14 + (Math.min(rq.dist, roadSnapBand) / roadSnapBand) * 0.08;
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
