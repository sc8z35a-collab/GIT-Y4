import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  TRIBUTARIES,
  TERRENO_LANDMARKS,
  evalMainRiver,
  evalRegionWeights,
} from './terrenoConfig.js';
import { VILLAGE, VILLAGE_HOUSES } from '../villageData.js';

/**
 * TERRENO 3.0 — Pinnacle 2D-Only Swiss/GSI Alpine Cartographic Map (60 km × 60 km)
 *
 *   • Ultra-Minimalist Luxury Glassmorphic UI: ZERO clutter, ZERO 3D-map switches, ZERO 27-tab bar,
 *     ZERO yellow-number pin spam — just a single 3-craft pill, close button, and 3-icon zoom/focus dock!
 *   • Maximum Zoom (0.88× .. 600×): Seamless transition from full 60 km alpine basin overview down to
 *     sub-meter architectural detail (true-scale NARROW-50 buildings, Suginosato 5 houses, bridges, & vehicles).
 *   • Live Viewport High-Res Relief & Marching-Squares Vector Contours (zoom >= 4.5×):
 *     Re-samples geomorph.getTerrainHeightAt() directly for the visible viewport at sub-meter precision
 *     with progressive 50m/20m/10m/5m/2m/1m contours — ZERO pixelation even at 600× zoom!
 *   • Complete Vector Cartography: 18 Mountain Massif Peaks, Kurosugi River + 12 Tributaries,
 *     16 Dual-Casing Winding Forestry Roads, EVERY 3D Architectural Bridge with orientation & span,
 *     live storm floods/landslides, animated inertial pan/zoom, & tap-anywhere autonomous dispatch.
 */

const MIN_ZOOM = 0.88;
const MAX_ZOOM = 600.0;

// Smooth Imhof Swiss-Alpine hypsometric elevation color ramp (ASL meters -> [r, g, b])
function alpineHypsometricColor(asl, rw, slope) {
  // Subtle biome undertone at valley/foothill elevations
  const vr = rw.valley * 58 + rw.hills * 70 + rw.plateau * 76 + rw.wetland * 52 + rw.meadow * 102 + rw.southPlain * 86;
  const vg = rw.valley * 106 + rw.hills * 116 + rw.plateau * 110 + rw.wetland * 94 + rw.meadow * 118 + rw.southPlain * 112;
  const vb = rw.valley * 68 + rw.hills * 70 + rw.plateau * 66 + rw.wetland * 82 + rw.meadow * 70 + rw.southPlain * 76;

  // Elevation bands: Valley Emerald (300..520) -> Montane Olive (520..820) -> Subalpine Ochre (820..1100)
  // -> Alpine Granite (1100..1380) -> Snow Crest (1380+)
  let r, g, b;
  if (asl < 520) {
    const t = Math.max(0, Math.min(1, (asl - 295) / 225));
    r = vr + t * 18;
    g = vg + t * 16;
    b = vb + t * 8;
  } else if (asl < 840) {
    const t = (asl - 520) / 320;
    r = (vr + 18) * (1 - t) + 128 * t;
    g = (vg + 16) * (1 - t) + 144 * t;
    b = (vb + 8) * (1 - t) + 92 * t;
  } else if (asl < 1140) {
    const t = (asl - 840) / 300;
    r = 128 * (1 - t) + 158 * t;
    g = 144 * (1 - t) + 148 * t;
    b = 92 * (1 - t) + 122 * t;
  } else if (asl < 1420) {
    const t = (asl - 1140) / 280;
    r = 158 * (1 - t) + 178 * t;
    g = 148 * (1 - t) + 176 * t;
    b = 122 * (1 - t) + 174 * t;
  } else {
    const t = Math.min(1, (asl - 1420) / 260);
    r = 178 * (1 - t) + 236 * t;
    g = 176 * (1 - t) + 241 * t;
    b = 174 * (1 - t) + 247 * t;
  }

  // Steep exposed granite rock faces take on cool slate-stone shading
  if (slope > 0.34) {
    const rk = Math.min(0.75, (slope - 0.34) * 1.45);
    r = r * (1 - rk) + 132 * rk;
    g = g * (1 - rk) + 134 * rk;
    b = b * (1 - rk) + 138 * rk;
  }
  return [r, g, b];
}

/**
 * Pre-bake 1024×1024 Swiss-Imhof Multi-Directional Shaded Relief Bitmap once (<45ms).
 */
function bakeAlpineReliefBitmap(geomorph) {
  const W = geomorph.W;
  const H = geomorph.H;
  const heights = geomorph.heights;
  const geoRGBA = geomorph.geoRGBA;
  const horizonRGBA = geomorph.horizonRGBA;
  const cellX = TERRENO_WORLD.width / (W - 1);
  const cellZ = TERRENO_WORLD.depth / (H - 1);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  // Swiss Imhof oblique NW main key light + subtle cool NE fill light
  const lx1 = -0.64, ly1 = 0.56, lz1 = -0.52;
  const lx2 = 0.52, ly2 = 0.72, lz2 = -0.46;

  for (let iz = 0; iz < H; iz++) {
    const wz = TERRENO_WORLD.minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rv = evalMainRiver(wz);
    for (let ix = 0; ix < W; ix++) {
      const idx = iz * W + ix;
      const wx = TERRENO_WORLD.minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const h = heights[idx];
      const asl = TERRENO_WORLD.baseElevationASL + h;

      const ixL = Math.max(0, ix - 1), ixR = Math.min(W - 1, ix + 1);
      const izU = Math.max(0, iz - 1), izD = Math.min(H - 1, iz + 1);
      const gx = (heights[iz * W + ixR] - heights[iz * W + ixL]) / (2.0 * cellX);
      const gz = (heights[izD * W + ix] - heights[izU * W + ix]) / (2.0 * cellZ);
      const slope = Math.hypot(gx, gz);

      const exag = 2.6;
      const invL = 1.0 / Math.hypot(gx * exag, 1.0, gz * exag);
      const nx = -gx * exag * invL, ny = invL, nz = -gz * exag * invL;

      const sun1 = Math.max(0, nx * lx1 + ny * ly1 + nz * lz1);
      const sun2 = Math.max(0, nx * lx2 + ny * ly2 + nz * lz2);
      const shade = Math.max(0.46, Math.min(1.26, sun1 * 0.86 + sun2 * 0.24 + 0.30));
      const skyAO = 0.72 + 0.28 * (horizonRGBA[idx * 4 + 2] / 255.0);

      const rw = evalRegionWeights(wx, wz);
      let [r, g, b] = alpineHypsometricColor(asl, rw, slope);

      // Imhof aerial color temperature shift: warm sunlit slopes, cool violet-blue shadows!
      const warmLift = Math.max(0, sun1 - 0.52) * 28;
      const coolShad = Math.max(0, 0.55 - sun1) * 22;
      r = r * shade * skyAO + warmLift - coolShad * 0.35;
      g = g * shade * skyAO + warmLift * 0.65 - coolShad * 0.12;
      b = b * shade * skyAO - warmLift * 0.20 + coolShad * 0.85;

      // Crisp 100m index & 25m intermediate macro contours
      const aslR = TERRENO_WORLD.baseElevationASL + heights[iz * W + ixR];
      const aslD = TERRENO_WORLD.baseElevationASL + heights[izD * W + ix];
      const maj0 = Math.floor(asl / 100.0);
      const isMajor = Math.floor(aslR / 100.0) !== maj0 || Math.floor(aslD / 100.0) !== maj0;
      const min0 = Math.floor(asl / 25.0);
      const isMinor = !isMajor && (Math.floor(aslR / 25.0) !== min0 || Math.floor(aslD / 25.0) !== min0);

      if (isMajor) {
        r = r * 0.62 + 34;
        g = g * 0.62 + 26;
        b = b * 0.62 + 18;
      } else if (isMinor) {
        r = r * 0.84 + 14;
        g = g * 0.84 + 11;
        b = b * 0.84 + 8;
      }

      // River channel & alpine wetland undertone
      const distRiv = Math.abs(wx - rv.x);
      const wetness = geoRGBA[idx * 4 + 1];
      if (distRiv < rv.halfWidth * 1.15) {
        r = 34; g = 148; b = 192;
      } else if (wetness > 0.78) {
        r = r * 0.64 + 28;
        g = g * 0.64 + 98;
        b = b * 0.64 + 126;
      }

      const o = idx * 4;
      d[o] = Math.max(0, Math.min(255, Math.round(r)));
      d[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      d[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Precompute dense polyline samples for all 12 mountain tributaries so vector river rendering is O(1) fast!
 */
function buildTributaryPolylines() {
  return TRIBUTARIES.map((tr, ti) => {
    const rv0 = evalMainRiver(tr.z0);
    const pts = [];
    const steps = 36;
    const maxLen = tr.len * 0.78;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const along = u * maxLen;
      const meander = Math.sin(along * 0.0014 + ti * 2.1) * 160.0 + Math.cos(along * 0.0036) * 52.0;
      const px = -tr.dirZ;
      const pz = tr.dirX;
      const wx = rv0.x + tr.dirX * along + px * meander;
      const wz = tr.z0 + tr.dirZ * along + pz * meander;
      pts.push([wx, wz]);
    }
    return {
      id: tr.id,
      nameJp: tr.nameJp,
      width: Math.max(6.0, tr.width * 0.16),
      pts,
    };
  });
}

function getZoneLabelJp(wx, wz, asl) {
  if (Math.hypot(wx - 6, wz - 2) < 60) return 'NARROW-50 拠点';
  if (Math.hypot(wx - VILLAGE.centerX, wz - VILLAGE.centerZ) < 110) return '杉ノ郷 集落';
  if (Math.abs(wx) < 200 && Math.abs(wz - 29910) < 120) return 'NULL EREA';
  const rv = evalMainRiver(wz);
  if (Math.abs(wx - rv.x) < rv.halfWidth * 2.2) return '黒杉川 渓流';
  if (asl > 1150) return '日本アルプス 高山帯';
  const rw = evalRegionWeights(wx, wz);
  const pairs = [
    [rw.valley, '黒杉渓谷 原生林'],
    [rw.hills, '西嶺 紅葉山麓'],
    [rw.plateau, '北部 ブナ・白樺高地'],
    [rw.wetland, '東水郷 湿原'],
    [rw.meadow, '南西 ススキ高原'],
    [rw.southPlain, '南部 松原渓谷'],
  ];
  pairs.sort((a, b) => b[0] - a[0]);
  return pairs[0][1];
}

function formatMetricScale(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  return `${Math.round(meters)} m`;
}

// Marching Squares lookup table (edge pairs: 0=top, 1=right, 2=bottom, 3=left)
const MS_SEGMENTS = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  [[0, 3], [2, 1]],
  [[0, 2]],
  [[0, 3]],
  [[0, 3]],
  [[0, 2]],
  [[0, 1], [3, 2]],
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  [],
];

export function createTerrenoMap2D(geomorph, callbacks = {}) {
  const reliefCanvas = bakeAlpineReliefBitmap(geomorph);
  const tributaryPolylines = buildTributaryPolylines();

  // Enrich mountain peaks with exact baked summit elevation ASL
  const peaksData = MOUNTAIN_PEAKS.map((pk) => {
    const h = typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(pk.x, pk.z)
      : geomorph.getHeightAt(pk.x, pk.z);
    return {
      ...pk,
      elevASL: Math.round(TERRENO_WORLD.baseElevationASL + h),
    };
  }).sort((a, b) => b.elevASL - a.elevASL);

  // Offscreen high-res dynamic viewport relief buffer for zoom >= 4.5x (ZERO pixelation up to 600x!)
  const detailCanvas = document.createElement('canvas');
  let detailCacheKey = '';
  let detailGrid = null; // { cols, rows, minX, minZ, maxX, maxZ, asl: Float32Array }

  let canvas = null;
  let containerEl = null;
  let lastState = null;
  let activeAutoVeh = 'camper'; // 'camper' | 'armor' | 'k11'
  let vehButtons = [];
  let stopRouteBtn = null;
  let hudScaleLabelEl = null;
  let hudScaleBarEl = null;
  let hudInfoEl = null;

  let zoom = 14.0;
  let panX = 0;
  let panY = 0;
  let baseRect = { x: 0, y: 0, w: 1, h: 1 };
  let hasInitialFocus = false;
  let focusCycleState = 0; // 0: player close, 1: valley, 2: full 60km world

  // Smooth spring animation & inertia state
  let animRaf = 0;
  let animGoal = null; // { zoom, panX, panY }
  let velX = 0;
  let velY = 0;
  let hoverWorld = null;
  let tapRipple = null; // { wx, wz, t0, color }

  function getTerrainY(wx, wz) {
    return typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(wx, wz)
      : geomorph.getHeightAt(wx, wz);
  }

  function setSelectedVehicle(v) {
    activeAutoVeh = v === 'k11' ? 'k11' : (v === 'armor' ? 'armor' : 'camper');
    vehButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.vehKey === activeAutoVeh);
    });
    if (callbacks.onChangeAutopilotVehicle) {
      callbacks.onChangeAutopilotVehicle(activeAutoVeh);
    }
    if (lastState) render(lastState);
  }

  function updateBaseRect() {
    if (!canvas) return;
    const CW = canvas.width;
    const CH = canvas.height;
    const side = Math.min(CW, CH) * 0.94;
    baseRect = {
      x: (CW - side) * 0.5,
      y: (CH - side) * 0.5,
      w: side,
      h: side,
    };
  }

  function worldToPx(wx, wz, zVal = zoom, pxOff = panX, pyOff = panY) {
    const u = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width;
    const v = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth;
    const bx = baseRect.x + u * baseRect.w;
    const by = baseRect.y + v * baseRect.h;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    return {
      px: cx + (bx - cx) * zVal + pxOff,
      py: cy + (by - cy) * zVal + pyOff,
    };
  }

  function pxToWorld(px, py) {
    if (!canvas) return null;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const bx = cx + (px - cx - panX) / zoom;
    const by = cy + (py - cy - panY) / zoom;
    const u = (bx - baseRect.x) / baseRect.w;
    const v = (by - baseRect.y) / baseRect.h;
    if (u < -0.04 || u > 1.04 || v < -0.04 || v > 1.04) return null;
    return {
      x: Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, TERRENO_WORLD.minX + u * TERRENO_WORLD.width)),
      z: Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, TERRENO_WORLD.minZ + v * TERRENO_WORLD.depth)),
    };
  }

  function panForWorldCenter(wx, wz, targetZoom) {
    if (!canvas) return { px: 0, py: 0 };
    const u = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width;
    const v = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth;
    const bx = baseRect.x + u * baseRect.w;
    const by = baseRect.y + v * baseRect.h;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    return {
      px: -(bx - cx) * targetZoom,
      py: -(by - cy) * targetZoom,
    };
  }

  function clampView() {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    if (!canvas) return;
    const maxPanX = baseRect.w * 0.52 * zoom + canvas.width * 0.22;
    const maxPanY = baseRect.h * 0.52 * zoom + canvas.height * 0.22;
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function startAnimLoop() {
    if (animRaf) return;
    const step = () => {
      let keepGoing = false;

      if (animGoal) {
        const dz = animGoal.zoom / Math.max(0.01, zoom);
        const lerpT = 0.24;
        zoom = zoom * Math.pow(dz, lerpT);
        panX += (animGoal.panX - panX) * lerpT;
        panY += (animGoal.panY - panY) * lerpT;
        clampView();
        if (Math.abs(Math.log(dz)) < 0.003 && Math.hypot(animGoal.panX - panX, animGoal.panY - panY) < 0.8) {
          zoom = animGoal.zoom;
          panX = animGoal.panX;
          panY = animGoal.panY;
          clampView();
          animGoal = null;
        } else {
          keepGoing = true;
        }
      } else if (Math.hypot(velX, velY) > 0.35) {
        panX += velX;
        panY += velY;
        velX *= 0.88;
        velY *= 0.88;
        clampView();
        keepGoing = true;
      } else {
        velX = 0;
        velY = 0;
      }

      if (tapRipple) {
        if (performance.now() - tapRipple.t0 < 950) keepGoing = true;
        else tapRipple = null;
      }

      if (lastState) render(lastState);

      if (keepGoing) {
        animRaf = requestAnimationFrame(step);
      } else {
        animRaf = 0;
      }
    };
    animRaf = requestAnimationFrame(step);
  }

  function animateTo(targetZoom, targetPanX, targetPanY) {
    velX = 0;
    velY = 0;
    const zClamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    animGoal = { zoom: zClamped, panX: targetPanX, panY: targetPanY };
    startAnimLoop();
  }

  function zoomCenteredBy(factor, anchorClientX = null, anchorClientY = null) {
    if (!canvas) return;
    const baseZoom = animGoal ? animGoal.zoom : zoom;
    const basePanX = animGoal ? animGoal.panX : panX;
    const basePanY = animGoal ? animGoal.panY : panY;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, baseZoom * factor));
    const ratio = nextZoom / baseZoom;
    let mx = 0;
    let my = 0;
    if (anchorClientX !== null && anchorClientY !== null) {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      mx = (anchorClientX - rect.left) * sx - canvas.width * 0.5;
      my = (anchorClientY - rect.top) * sy - canvas.height * 0.5;
    }
    const nextPanX = mx - (mx - basePanX) * ratio;
    const nextPanY = my - (my - basePanY) * ratio;
    animateTo(nextZoom, nextPanX, nextPanY);
  }

  function focusOnWorld(wx, wz, targetZoom = 42.0, instant = false) {
    hasInitialFocus = true;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    const p = panForWorldCenter(wx, wz, z);
    if (instant) {
      animGoal = null;
      zoom = z;
      panX = p.px;
      panY = p.py;
      clampView();
      if (lastState) render(lastState);
    } else {
      animateTo(z, p.px, p.py);
    }
  }

  function cycleFocus() {
    const pxW = lastState?.x ?? 1.5;
    const pzW = lastState?.z ?? 3.5;
    // Smart 3-stage cycle: Close Player View (55x) -> Valley Overview (12x) -> Full 60km Basin (1.0x)
    if (zoom < 3.5) {
      focusCycleState = 0;
      focusOnWorld(pxW, pzW, 55.0);
    } else if (zoom < 28.0) {
      focusCycleState = 2;
      animateTo(1.0, 0, 0);
    } else {
      focusCycleState = 1;
      focusOnWorld(pxW, pzW, 12.0);
    }
  }

  function resetView() {
    hasInitialFocus = true;
    animateTo(1.0, 0, 0);
  }

  function setView(targetZoom, wx = null, wz = null) {
    hasInitialFocus = true;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(targetZoom) || 1.0));
    if (wx !== null && wz !== null) {
      focusOnWorld(wx, wz, z, true);
    } else {
      animGoal = null;
      zoom = z;
      clampView();
      if (lastState) render(lastState);
    }
    return getViewState();
  }

  function getViewState() {
    const c = canvas ? pxToWorld(canvas.width * 0.5, canvas.height * 0.5) : { x: 0, z: 0 };
    return {
      zoom: Number(zoom.toFixed(2)),
      maxZoom: MAX_ZOOM,
      centerX: Math.round(c?.x ?? 0),
      centerZ: Math.round(c?.z ?? 0),
    };
  }

  /**
   * High-Resolution Live Viewport Relief Sampler (active whenever zoom >= 4.5x):
   * Samples geomorph.getTerrainHeightAt() directly across the visible viewport so there is
   * ZERO bitmap pixelation even at 600× zoom, and smooths normals to eliminate bilinear cell seams!
   */
  function ensureHighResViewportRelief(CW, CH) {
    const cx = CW * 0.5;
    const cy = CH * 0.5;
    const bx0 = cx + (0 - cx - panX) / zoom;
    const by0 = cy + (0 - cy - panY) / zoom;
    const bx1 = cx + (CW - cx - panX) / zoom;
    const by1 = cy + (CH - cy - panY) / zoom;
    const minX = TERRENO_WORLD.minX + ((bx0 - baseRect.x) / baseRect.w) * TERRENO_WORLD.width;
    const maxX = TERRENO_WORLD.minX + ((bx1 - baseRect.x) / baseRect.w) * TERRENO_WORLD.width;
    const minZ = TERRENO_WORLD.minZ + ((by0 - baseRect.y) / baseRect.h) * TERRENO_WORLD.depth;
    const maxZ = TERRENO_WORLD.minZ + ((by1 - baseRect.y) / baseRect.h) * TERRENO_WORLD.depth;

    const key = `${Math.round(minX * 4)}_${Math.round(maxX * 4)}_${Math.round(minZ * 4)}_${Math.round(maxZ * 4)}_${CW}_${CH}`;
    if (key === detailCacheKey && detailGrid) return detailGrid;
    detailCacheKey = key;

    const aspect = CW / Math.max(1, CH);
    const cols = Math.max(96, Math.min(200, Math.round(145 * Math.min(1.4, aspect))));
    const rows = Math.max(72, Math.min(160, Math.round(cols / Math.max(0.6, aspect))));

    if (detailCanvas.width !== cols || detailCanvas.height !== rows) {
      detailCanvas.width = cols;
      detailCanvas.height = rows;
    }

    const aslArr = new Float32Array(cols * rows);
    const dxW = (maxX - minX) / (cols - 1);
    const dzW = (maxZ - minZ) / (rows - 1);

    for (let r = 0; r < rows; r++) {
      const wz = minZ + r * dzW;
      const rowOff = r * cols;
      for (let c = 0; c < cols; c++) {
        const wx = minX + c * dxW;
        if (wx < TERRENO_WORLD.minX || wx > TERRENO_WORLD.maxX || wz < TERRENO_WORLD.minZ || wz > TERRENO_WORLD.maxZ) {
          aslArr[rowOff + c] = NaN;
        } else {
          aslArr[rowOff + c] = TERRENO_WORLD.baseElevationASL + getTerrainY(wx, wz);
        }
      }
    }

    // 3-pass separable smoothing of height grid for silky LiDAR-grade hillshade normals (zero bilinear seam artifacts!)
    const smoothA = new Float32Array(aslArr);
    const smoothB = new Float32Array(aslArr.length);
    const blurPasses = zoom > 80 ? 5 : 2;
    for (let p = 0; p < blurPasses; p++) {
      for (let r = 0; r < rows; r++) {
        const ro = r * cols;
        for (let c = 0; c < cols; c++) {
          const v = smoothA[ro + c];
          if (Number.isNaN(v)) { smoothB[ro + c] = NaN; continue; }
          const l = c > 0 && !Number.isNaN(smoothA[ro + c - 1]) ? smoothA[ro + c - 1] : v;
          const ri = c < cols - 1 && !Number.isNaN(smoothA[ro + c + 1]) ? smoothA[ro + c + 1] : v;
          smoothB[ro + c] = (l + v * 2 + ri) * 0.25;
        }
      }
      for (let r = 0; r < rows; r++) {
        const ro = r * cols;
        const rU = Math.max(0, r - 1) * cols;
        const rD = Math.min(rows - 1, r + 1) * cols;
        for (let c = 0; c < cols; c++) {
          const v = smoothB[ro + c];
          if (Number.isNaN(v)) { smoothA[ro + c] = NaN; continue; }
          const u = !Number.isNaN(smoothB[rU + c]) ? smoothB[rU + c] : v;
          const d = !Number.isNaN(smoothB[rD + c]) ? smoothB[rD + c] : v;
          smoothA[ro + c] = (u + v * 2 + d) * 0.25;
        }
      }
    }

    const dctx = detailCanvas.getContext('2d');
    const img = dctx.createImageData(cols, rows);
    const data = img.data;
    const lx1 = -0.64, ly1 = 0.56, lz1 = -0.52;
    const lx2 = 0.52, ly2 = 0.72, lz2 = -0.46;
    const exag = zoom > 120 ? 1.35 : (zoom > 40 ? 1.85 : 2.35);

    for (let r = 0; r < rows; r++) {
      const wz = minZ + r * dzW;
      const rowOff = r * cols;
      const rU = Math.max(0, r - 1), rD = Math.min(rows - 1, r + 1);
      for (let c = 0; c < cols; c++) {
        const idx = rowOff + c;
        const o = idx * 4;
        const asl = aslArr[idx];
        if (Number.isNaN(asl)) {
          data[o] = 10; data[o + 1] = 16; data[o + 2] = 24; data[o + 3] = 255;
          continue;
        }
        const wx = minX + c * dxW;
        const cL = Math.max(0, c - 1), cR = Math.min(cols - 1, c + 1);
        const hL = Number.isNaN(smoothA[rowOff + cL]) ? smoothA[idx] : smoothA[rowOff + cL];
        const hR = Number.isNaN(smoothA[rowOff + cR]) ? smoothA[idx] : smoothA[rowOff + cR];
        const hU = Number.isNaN(smoothA[rU * cols + c]) ? smoothA[idx] : smoothA[rU * cols + c];
        const hD = Number.isNaN(smoothA[rD * cols + c]) ? smoothA[idx] : smoothA[rD * cols + c];

        const gx = (hR - hL) / Math.max(0.25, (cR - cL) * dxW);
        const gz = (hD - hU) / Math.max(0.25, (rD - rU) * dzW);
        const slope = Math.hypot(gx, gz);
        const invL = 1.0 / Math.hypot(gx * exag, 1.0, gz * exag);
        const nx = -gx * exag * invL, ny = invL, nz = -gz * exag * invL;

        const sun1 = Math.max(0, nx * lx1 + ny * ly1 + nz * lz1);
        const sun2 = Math.max(0, nx * lx2 + ny * ly2 + nz * lz2);
        const shade = Math.max(0.54, Math.min(1.22, sun1 * 0.80 + sun2 * 0.24 + 0.36));

        const rw = evalRegionWeights(wx, wz);
        let [cr, cg, cb] = alpineHypsometricColor(asl, rw, slope);
        const warmLift = Math.max(0, sun1 - 0.52) * 20;
        const coolShad = Math.max(0, 0.55 - sun1) * 15;
        cr = cr * shade + warmLift - coolShad * 0.3;
        cg = cg * shade + warmLift * 0.6 - coolShad * 0.1;
        cb = cb * shade - warmLift * 0.18 + coolShad * 0.72;

        data[o] = Math.max(0, Math.min(255, Math.round(cr)));
        data[o + 1] = Math.max(0, Math.min(255, Math.round(cg)));
        data[o + 2] = Math.max(0, Math.min(255, Math.round(cb)));
        data[o + 3] = 255;
      }
    }
    dctx.putImageData(img, 0, 0);

    detailGrid = { cols, rows, minX, maxX, minZ, maxZ, asl: aslArr };
    return detailGrid;
  }

  /**
   * Draw razor-sharp live Marching-Squares vector contours from detailGrid at high zoom!
   */
  function drawDynamicContours(ctx, grid, CW, CH, dpr) {
    if (!grid) return;
    let minorStep = 10;
    let majorStep = 50;
    if (zoom >= 240) { minorStep = 1; majorStep = 5; }
    else if (zoom >= 85) { minorStep = 2; majorStep = 10; }
    else if (zoom >= 20) { minorStep = 5; majorStep = 20; }
    else { minorStep = 10; majorStep = 50; }

    const { cols, rows, asl } = grid;
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < asl.length; i++) {
      const v = asl[i];
      if (!Number.isNaN(v)) {
        if (v < minH) minH = v;
        if (v > maxH) maxH = v;
      }
    }
    if (!Number.isFinite(minH) || maxH - minH < minorStep * 0.5) return;

    const startLvl = Math.ceil(minH / minorStep) * minorStep;
    const endLvl = Math.floor(maxH / minorStep) * minorStep;
    // Cap level count so ultra-steep mountain cliffs stay blazingly fast
    const maxLevels = 65;
    const stepMult = Math.max(1, Math.ceil(((endLvl - startLvl) / minorStep) / maxLevels));
    const effMinor = minorStep * stepMult;
    const effMajor = majorStep * stepMult;

    const sx = CW / (cols - 1);
    const sy = CH / (rows - 1);

    const interpEdge = (edge, c, r, v0, v1, v2, v3, lvl) => {
      switch (edge) {
        case 0: { const t = (lvl - v0) / (v1 - v0 || 1e-6); return [(c + t) * sx, r * sy]; }
        case 1: { const t = (lvl - v1) / (v2 - v1 || 1e-6); return [(c + 1) * sx, (r + t) * sy]; }
        case 2: { const t = (lvl - v3) / (v2 - v3 || 1e-6); return [(c + t) * sx, (r + 1) * sy]; }
        default:{ const t = (lvl - v0) / (v3 - v0 || 1e-6); return [c * sx, (r + t) * sy]; }
      }
    };

    const majorLabels = [];

    for (let pass = 0; pass < 2; pass++) {
      const isMajorPass = pass === 1;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = isMajorPass ? 'rgba(66, 48, 30, 0.56)' : 'rgba(72, 54, 34, 0.25)';
      ctx.lineWidth = (isMajorPass ? 1.25 : 0.72) * dpr;

      for (let lvl = startLvl; lvl <= endLvl; lvl += effMinor) {
        const isMaj = Math.abs(Math.round(lvl / effMajor) * effMajor - lvl) < 0.01;
        if (isMaj !== isMajorPass) continue;

        let labeledThisLvl = false;
        for (let r = 0; r < rows - 1; r++) {
          const rOff = r * cols;
          const rNext = rOff + cols;
          for (let c = 0; c < cols - 1; c++) {
            const v0 = asl[rOff + c];
            const v1 = asl[rOff + c + 1];
            const v2 = asl[rNext + c + 1];
            const v3 = asl[rNext + c];
            if (Number.isNaN(v0) || Number.isNaN(v1) || Number.isNaN(v2) || Number.isNaN(v3)) continue;
            let mask = 0;
            if (v0 >= lvl) mask |= 8;
            if (v1 >= lvl) mask |= 4;
            if (v2 >= lvl) mask |= 2;
            if (v3 >= lvl) mask |= 1;
            const segs = MS_SEGMENTS[mask];
            if (!segs.length) continue;
            for (let s = 0; s < segs.length; s++) {
              const pA = interpEdge(segs[s][0], c, r, v0, v1, v2, v3, lvl);
              const pB = interpEdge(segs[s][1], c, r, v0, v1, v2, v3, lvl);
              ctx.moveTo(pA[0], pA[1]);
              ctx.lineTo(pB[0], pB[1]);

              if (isMajorPass && !labeledThisLvl && c > cols * 0.18 && c < cols * 0.82 && r > rows * 0.18 && r < rows * 0.82) {
                const mx = (pA[0] + pB[0]) * 0.5;
                const my = (pA[1] + pB[1]) * 0.5;
                let tooClose = false;
                for (let li = 0; li < majorLabels.length; li++) {
                  if (Math.hypot(mx - majorLabels[li].x, my - majorLabels[li].y) < 110 * dpr) {
                    tooClose = true;
                    break;
                  }
                }
                if (!tooClose) {
                  majorLabels.push({ x: mx, y: my, text: `${Math.round(lvl)}m` });
                  labeledThisLvl = true;
                }
              }
            }
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Crisp haloed contour elevation labels
    if (majorLabels.length > 0) {
      ctx.save();
      ctx.font = `700 ${Math.round(8.5 * dpr)}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.8 * dpr;
      ctx.strokeStyle = 'rgba(235, 240, 232, 0.78)';
      ctx.fillStyle = 'rgba(54, 38, 22, 0.90)';
      for (let i = 0; i < majorLabels.length; i++) {
        const lb = majorLabels[i];
        ctx.strokeText(lb.text, lb.x, lb.y);
        ctx.fillText(lb.text, lb.x, lb.y);
      }
      ctx.restore();
    }
  }

  function getDynamicAssetCoords(state) {
    return [
      { id: 'dyn_camper', code: 'RV', kind: 'camper', x: state?.camperPose?.cx ?? 7.75, z: state?.camperPose?.cz ?? 5.75, yaw: state?.camperPose?.yaw ?? 0, w: 2.5, l: 7.5, color: '#f97316' },
      { id: 'dyn_armor', code: '装甲', kind: 'armor', x: state?.armorPose?.cx ?? 15.6, z: state?.armorPose?.cz ?? 4.0, yaw: state?.armorPose?.yaw ?? 0, w: 2.7, l: 10.4, color: '#10b981' },
      { id: 'dyn_kei', code: '軽', kind: 'kei', x: state?.keiPose?.cx ?? 3.55, z: state?.keiPose?.cz ?? -3.80, yaw: state?.keiPose?.yaw ?? 0, w: 1.48, l: 3.4, color: '#eab308' },
      { id: 'dyn_container', code: '箱', kind: 'container', x: state?.containerPose?.cx ?? 19.85, z: state?.containerPose?.cz ?? 6.50, yaw: state?.containerPose?.yaw ?? 0, w: 2.5, l: 6.2, color: '#84cc16' },
      { id: 'dyn_k11', code: 'K-11', kind: 'k11', x: state?.k11Pose?.cx ?? 0.0, z: state?.k11Pose?.cz ?? 29910.0, yaw: state?.k11Pose?.yaw ?? 0, w: 11.0, l: 26.0, color: '#a855f7' },
    ];
  }

  function mount(hostEl) {
    containerEl = hostEl;
    containerEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'terreno-2d-fullscreen';

    canvas = document.createElement('canvas');
    canvas.className = 'terreno-2d-canvas';
    wrap.appendChild(canvas);

    // 1. Minimal Top-Left: ONE single frosted segmented vehicle selector pill (+ conditional stop pill only when active)
    const tlDock = document.createElement('div');
    tlDock.className = 'map2d-tl-dock';

    const seg = document.createElement('div');
    seg.className = 'map2d-veh-seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', '自律車両選択');
    vehButtons = [];
    [
      { key: 'camper', label: 'RV', dot: '#fb923c' },
      { key: 'armor',  label: '装甲', dot: '#34d399' },
      { key: 'k11',    label: 'K-11', dot: '#c084fc' },
    ].forEach((v) => {
      const vb = document.createElement('button');
      vb.type = 'button';
      vb.className = `map2d-seg-btn${v.key === activeAutoVeh ? ' active' : ''}`;
      vb.dataset.vehKey = v.key;
      vb.innerHTML = `<i class="map2d-seg-dot" style="background:${v.dot}"></i><span>${v.label}</span>`;
      vb.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedVehicle(v.key);
      });
      seg.appendChild(vb);
      vehButtons.push(vb);
    });
    tlDock.appendChild(seg);

    stopRouteBtn = document.createElement('button');
    stopRouteBtn.type = 'button';
    stopRouteBtn.className = 'map2d-stop-pill hidden';
    stopRouteBtn.textContent = '停止';
    stopRouteBtn.setAttribute('aria-label', '自動走行停止');
    stopRouteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (callbacks.onCancelAutopilot) callbacks.onCancelAutopilot(activeAutoVeh);
    });
    tlDock.appendChild(stopRouteBtn);
    wrap.appendChild(tlDock);

    // 2. Minimal Bottom-Right: Single vertical 3-icon dock (Focus / Zoom In / Zoom Out)
    const brDock = document.createElement('div');
    brDock.className = 'map2d-br-dock';

    const btnFocus = document.createElement('button');
    btnFocus.type = 'button';
    btnFocus.className = 'map2d-dock-btn';
    btnFocus.setAttribute('aria-label', '現在地・全景切替');
    btnFocus.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8.5" opacity="0.55"/><line x1="12" y1="1.8" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22.2"/><line x1="1.8" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22.2" y2="12"/></svg>`;
    btnFocus.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleFocus();
    });

    const btnZoomIn = document.createElement('button');
    btnZoomIn.type = 'button';
    btnZoomIn.className = 'map2d-dock-btn';
    btnZoomIn.setAttribute('aria-label', '拡大');
    btnZoomIn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    btnZoomIn.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomCenteredBy(2.15);
    });

    const btnZoomOut = document.createElement('button');
    btnZoomOut.type = 'button';
    btnZoomOut.className = 'map2d-dock-btn';
    btnZoomOut.setAttribute('aria-label', '縮小');
    btnZoomOut.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    btnZoomOut.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomCenteredBy(1 / 2.15);
    });

    brDock.appendChild(btnFocus);
    brDock.appendChild(btnZoomIn);
    brDock.appendChild(btnZoomOut);
    wrap.appendChild(brDock);

    // 3. Quiet Non-Interactive Bottom-Left Cartographic Scalebar & Elevation Readout (ZERO buttons!)
    const blHud = document.createElement('div');
    blHud.className = 'map2d-bl-hud';
    blHud.innerHTML = `
      <div class="map2d-scale-row">
        <span class="map2d-north-badge">N</span>
        <div class="map2d-scale-wrap">
          <div class="map2d-scale-bar"></div>
          <span class="map2d-scale-label">1 km</span>
        </div>
      </div>
      <div class="map2d-meta-line">標高 320m</div>
    `;
    hudScaleBarEl = blHud.querySelector('.map2d-scale-bar');
    hudScaleLabelEl = blHud.querySelector('.map2d-scale-label');
    hudInfoEl = blHud.querySelector('.map2d-meta-line');
    wrap.appendChild(blHud);

    containerEl.appendChild(wrap);

    const syncSize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, Math.round((r.width || window.innerWidth) * dpr));
      canvas.height = Math.max(200, Math.round((r.height || window.innerHeight) * dpr));
      updateBaseRect();
      detailCacheKey = '';
      if (!hasInitialFocus && lastState) {
        hasInitialFocus = true;
        focusOnWorld(lastState.x ?? 1.5, lastState.z ?? 3.5, 16.0, true);
      } else if (lastState) {
        render(lastState);
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);

    // Silky Multi-Touch Pinch + Inertial Pan + Double-Tap Zoom + Tap-to-Dispatch
    const ptrs = new Map();
    let singleMoved = 0;
    let hadMulti = false;
    let prevDist = 0;
    let prevMid = { x: 0, y: 0 };
    let lastDragDx = 0;
    let lastDragDy = 0;
    let lastTapTime = 0;
    let lastTapClient = { x: 0, y: 0 };
    let pendingSingleTapTimer = null;

    canvas.addEventListener('pointerdown', (e) => {
      animGoal = null;
      velX = 0;
      velY = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        singleMoved = 0;
        hadMulti = false;
        lastDragDx = 0;
        lastDragDy = 0;
      } else if (ptrs.size === 2) {
        hadMulti = true;
        if (pendingSingleTapTimer) { clearTimeout(pendingSingleTapTimer); pendingSingleTapTimer = null; }
        const pts = Array.from(ptrs.values());
        prevDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        prevMid = { x: (pts[0].x + pts[1].x) * 0.5, y: (pts[0].y + pts[1].y) * 0.5 };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);

      // Update live cursor hover elevation & biome readout on mouse hover
      if (ptrs.size === 0 && e.pointerType === 'mouse') {
        hoverWorld = pxToWorld((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
        if (lastState) updateBottomHud(lastState);
        return;
      }

      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (ptrs.size === 1 && !hadMulti) {
        singleMoved += Math.hypot(dx, dy);
        panX += dx * sx;
        panY += dy * sy;
        lastDragDx = dx * sx;
        lastDragDy = dy * sy;
        clampView();
        if (lastState) render(lastState);
      } else if (ptrs.size === 2) {
        const pts = Array.from(ptrs.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const mid = { x: (pts[0].x + pts[1].x) * 0.5, y: (pts[0].y + pts[1].y) * 0.5 };
        if (prevDist > 8 && dist > 8) {
          const factor = dist / prevDist;
          const oldZoom = zoom;
          zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
          const ratio = zoom / oldZoom;
          const mx = (mid.x - rect.left) * sx - canvas.width * 0.5;
          const my = (mid.y - rect.top) * sy - canvas.height * 0.5;
          panX = mx - (mx - panX) * ratio + (mid.x - prevMid.x) * sx;
          panY = my - (my - panY) * ratio + (mid.y - prevMid.y) * sy;
          clampView();
          if (lastState) render(lastState);
        }
        prevDist = dist;
        prevMid = mid;
      }
    });

    canvas.addEventListener('pointerleave', () => {
      hoverWorld = null;
      if (lastState) updateBottomHud(lastState);
    });

    const handleSingleTap = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const px = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const py = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      const dpr = canvas.width / Math.max(1, rect.width);
      const hitRad = 18 * dpr;

      // 1. Check snap to dynamic assets (vehicles / NULL / Home)
      if (lastState) {
        const snapTargets = [
          { kind: 'home', x: 15.6, z: -15.0 },
          { kind: 'null_erea', x: 0.0, z: 29910.0 },
          ...getDynamicAssetCoords(lastState),
        ];
        let best = null;
        let bestD = hitRad;
        for (let i = 0; i < snapTargets.length; i++) {
          const a = snapTargets[i];
          if (a.kind === activeAutoVeh) continue;
          const p = worldToPx(a.x, a.z);
          const d = Math.hypot(px - p.px, py - p.py);
          if (d < bestD) { bestD = d; best = a; }
        }
        if (best && callbacks.onSelectDynamicTarget) {
          tapRipple = { wx: best.x, wz: best.z, t0: performance.now(), color: activeAutoVeh === 'k11' ? '#c084fc' : (activeAutoVeh === 'armor' ? '#34d399' : '#38bdf8') };
          startAnimLoop();
          callbacks.onSelectDynamicTarget(best.kind, activeAutoVeh);
          return;
        }
      }

      // 2. Tap ANY coordinate on the 60 km × 60 km map -> autonomous dispatch!
      const w = pxToWorld(px, py);
      if (w && callbacks.onSelectWorldPoint) {
        tapRipple = { wx: w.x, wz: w.z, t0: performance.now(), color: activeAutoVeh === 'k11' ? '#c084fc' : (activeAutoVeh === 'armor' ? '#34d399' : '#38bdf8') };
        startAnimLoop();
        callbacks.onSelectWorldPoint(w.x, w.z, activeAutoVeh);
      }
    };

    const onUp = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const isTap = ptrs.size === 1 && !hadMulti && singleMoved < 9;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0) hadMulti = false;

      if (isTap) {
        const now = performance.now();
        const dtTap = now - lastTapTime;
        const dTap = Math.hypot(e.clientX - lastTapClient.x, e.clientY - lastTapClient.y);
        if (dtTap < 280 && dTap < 30) {
          // Double-tap -> smooth anchored zoom-in!
          if (pendingSingleTapTimer) { clearTimeout(pendingSingleTapTimer); pendingSingleTapTimer = null; }
          lastTapTime = 0;
          zoomCenteredBy(2.8, e.clientX, e.clientY);
        } else {
          lastTapTime = now;
          lastTapClient = { x: e.clientX, y: e.clientY };
          const cx = e.clientX, cy = e.clientY;
          if (pendingSingleTapTimer) clearTimeout(pendingSingleTapTimer);
          pendingSingleTapTimer = setTimeout(() => {
            pendingSingleTapTimer = null;
            handleSingleTap(cx, cy);
          }, 210);
        }
      } else if (!hadMulti && Math.hypot(lastDragDx, lastDragDy) > 2.2) {
        velX = Math.max(-42, Math.min(42, lastDragDx * 0.72));
        velY = Math.max(-42, Math.min(42, lastDragDy * 0.72));
        startAnimLoop();
      }
    };
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      animGoal = null;
      velX = 0;
      velY = 0;
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      const oldZoom = zoom;
      const delta = Math.max(-120, Math.min(120, e.deltaY));
      const factor = Math.pow(1.0024, -delta);
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
      const ratio = zoom / oldZoom;
      const mx = (e.clientX - rect.left) * sx - canvas.width * 0.5;
      const my = (e.clientY - rect.top) * sy - canvas.height * 0.5;
      panX = mx - (mx - panX) * ratio;
      panY = my - (my - panY) * ratio;
      clampView();
      if (lastState) render(lastState);
    }, { passive: false });
  }

  function updateBottomHud(state) {
    if (!canvas || !hudScaleBarEl || !hudScaleLabelEl || !hudInfoEl) return;
    const dpr = canvas.width / Math.max(320, canvas.clientWidth || 924);
    const pxPerMeter = (baseRect.w * zoom) / TERRENO_WORLD.width;
    const cssPxPerMeter = pxPerMeter / Math.max(1, dpr);

    // Choose crisp Swiss cartographic scale step
    const steps = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2];
    let bestM = 1000;
    for (let i = 0; i < steps.length; i++) {
      const wPx = steps[i] * cssPxPerMeter;
      if (wPx >= 46 && wPx <= 132) { bestM = steps[i]; break; }
      if (wPx < 46) { bestM = steps[Math.max(0, i - 1)]; break; }
      bestM = steps[i];
    }
    const barCssW = Math.max(34, Math.min(148, bestM * cssPxPerMeter));
    hudScaleBarEl.style.width = `${barCssW.toFixed(1)}px`;
    hudScaleLabelEl.textContent = formatMetricScale(bestM);

    const refW = hoverWorld || pxToWorld(canvas.width * 0.5, canvas.height * 0.5) || { x: state?.x ?? 0, z: state?.z ?? 0 };
    const asl = Math.round(TERRENO_WORLD.baseElevationASL + getTerrainY(refW.x, refW.z));
    const zone = getZoneLabelJp(refW.x, refW.z, asl);
    const zTxt = zoom >= 10 ? `${Math.round(zoom)}×` : `${zoom.toFixed(1)}×`;
    hudInfoEl.textContent = `${zone} • 標高 ${asl}m • ${zTxt}`;
  }

  function render(state) {
    lastState = state;
    if (state?.selectedAutopilotVehicle && state.selectedAutopilotVehicle !== activeAutoVeh) {
      activeAutoVeh = state.selectedAutopilotVehicle;
      vehButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.vehKey === activeAutoVeh);
      });
    }
    if (!canvas) return;

    if (!hasInitialFocus && state) {
      hasInitialFocus = true;
      focusOnWorld(state.x ?? 1.5, state.z ?? 3.5, 16.0, true);
      return;
    }

    const ctx = canvas.getContext('2d');
    const CW = canvas.width;
    const CH = canvas.height;
    const dpr = CW / Math.max(320, canvas.clientWidth || 924);
    const pxPerMeter = (baseRect.w * zoom) / TERRENO_WORLD.width;

    // Show subtle stop pill ONLY when any autopilot route is active
    const routesByVeh = state?.autopilotRoutes || null;
    const hasAnyRoute = Boolean(
      (routesByVeh && ((routesByVeh.camper && routesByVeh.camper.length >= 2) ||
        (routesByVeh.armor && routesByVeh.armor.length >= 2) ||
        (routesByVeh.k11 && routesByVeh.k11.length >= 2))) ||
      (state?.autopilotRoute && state.autopilotRoute.length >= 2)
    );
    if (stopRouteBtn) stopRouteBtn.classList.toggle('hidden', !hasAnyRoute);

    // Deep slate map background outside world bounds
    ctx.fillStyle = '#09111a';
    ctx.fillRect(0, 0, CW, CH);

    const tl = worldToPx(TERRENO_WORLD.minX, TERRENO_WORLD.minZ);
    const br = worldToPx(TERRENO_WORLD.maxX, TERRENO_WORLD.maxZ);
    const dw = br.px - tl.px;
    const dh = br.py - tl.py;

    // ---- 1. TERRAIN RELIEF LAYER (Macro Swiss Bitmap OR Live Sub-Meter Viewport Relief + Marching Squares!) ----
    if (zoom < 4.5) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(reliefCanvas, tl.px, tl.py, dw, dh);
    } else {
      const grid = ensureHighResViewportRelief(CW, CH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(detailCanvas, 0, 0, CW, CH);
      drawDynamicContours(ctx, grid, CW, CH, dpr);
    }

    // ---- 2. ADAPTIVE METRIC COORDINATE GRID ----
    {
      const gridSteps = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20];
      let gStep = 10000;
      for (let i = 0; i < gridSteps.length; i++) {
        if (gridSteps[i] * pxPerMeter >= 88 * dpr) gStep = gridSteps[i];
      }
      const wMin = pxToWorld(0, 0) || { x: TERRENO_WORLD.minX, z: TERRENO_WORLD.minZ };
      const wMax = pxToWorld(CW, CH) || { x: TERRENO_WORLD.maxX, z: TERRENO_WORLD.maxZ };
      const x0 = Math.max(TERRENO_WORLD.minX, Math.floor(wMin.x / gStep) * gStep);
      const x1 = Math.min(TERRENO_WORLD.maxX, Math.ceil(wMax.x / gStep) * gStep);
      const z0 = Math.max(TERRENO_WORLD.minZ, Math.floor(wMin.z / gStep) * gStep);
      const z1 = Math.min(TERRENO_WORLD.maxZ, Math.ceil(wMax.z / gStep) * gStep);

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 0.75 * dpr;
      ctx.beginPath();
      for (let gx = x0; gx <= x1; gx += gStep) {
        const a = worldToPx(gx, Math.max(TERRENO_WORLD.minZ, z0 - gStep));
        const b = worldToPx(gx, Math.min(TERRENO_WORLD.maxZ, z1 + gStep));
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
      }
      for (let gz = z0; gz <= z1; gz += gStep) {
        const a = worldToPx(Math.max(TERRENO_WORLD.minX, x0 - gStep), gz);
        const b = worldToPx(Math.min(TERRENO_WORLD.maxX, x1 + gStep), gz);
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ---- 3. HYDROLOGY: KUROSUGI MAIN RIVER + ALL 12 MOUNTAIN TRIBUTARIES ----
    {
      const floodRise = state?.floodRise || 0;
      const wMin = pxToWorld(0, 0) || { x: TERRENO_WORLD.minX, z: TERRENO_WORLD.minZ };
      const wMax = pxToWorld(CW, CH) || { x: TERRENO_WORLD.maxX, z: TERRENO_WORLD.maxZ };

      // 3a. 12 Mountain Tributaries
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let ti = 0; ti < tributaryPolylines.length; ti++) {
        const tr = tributaryPolylines[ti];
        const pts = tr.pts;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = worldToPx(pts[i][0], pts[i][1]);
          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        const tribW = Math.max(1.2 * dpr, tr.width * pxPerMeter);
        ctx.strokeStyle = 'rgba(18, 86, 118, 0.55)';
        ctx.lineWidth = tribW + 1.6 * dpr;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(72, 186, 224, 0.85)';
        ctx.lineWidth = tribW;
        ctx.stroke();
      }
      ctx.restore();

      // 3b. Main Emerald Kurosugi River (adaptive step precision from 300m down to 6m!)
      const zStart = Math.max(TERRENO_WORLD.minZ, wMin.z - 600);
      const zEnd = Math.min(TERRENO_WORLD.maxZ, wMax.z + 600);
      const zStep = Math.max(6, Math.min(300, (zEnd - zStart) / 180));

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (zoom >= 10) {
        // Exact variable-width polygon ribbon (left bank + right bank) for true architectural riverbanks!
        const leftBank = [];
        const rightBank = [];
        for (let z = zStart; z <= zEnd + zStep * 0.5; z += zStep) {
          const zc = Math.min(zEnd, z);
          const rv = evalMainRiver(zc);
          const hw = rv.halfWidth * (1.0 + floodRise * 0.14);
          leftBank.push(worldToPx(rv.x - hw, zc));
          rightBank.push(worldToPx(rv.x + hw, zc));
        }
        if (leftBank.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(leftBank[0].px, leftBank[0].py);
          for (let i = 1; i < leftBank.length; i++) ctx.lineTo(leftBank[i].px, leftBank[i].py);
          for (let i = rightBank.length - 1; i >= 0; i--) ctx.lineTo(rightBank[i].px, rightBank[i].py);
          ctx.closePath();
          ctx.fillStyle = floodRise > 0.35 ? 'rgba(128, 112, 74, 0.82)' : 'rgba(54, 174, 212, 0.86)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(18, 84, 116, 0.78)';
          ctx.lineWidth = 1.4 * dpr;
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        let first = true;
        for (let z = zStart; z <= zEnd + zStep * 0.5; z += zStep) {
          const rv = evalMainRiver(Math.min(zEnd, z));
          const p = worldToPx(rv.x, Math.min(zEnd, z));
          if (first) { ctx.moveTo(p.px, p.py); first = false; }
          else ctx.lineTo(p.px, p.py);
        }
        const riverW = Math.max(2.2 * dpr, 56 * pxPerMeter);
        ctx.strokeStyle = 'rgba(16, 78, 108, 0.65)';
        ctx.lineWidth = riverW + 2.0 * dpr;
        ctx.stroke();
        ctx.strokeStyle = floodRise > 0.35 ? 'rgba(168, 128, 72, 0.88)' : 'rgba(66, 188, 226, 0.92)';
        ctx.lineWidth = riverW;
        ctx.stroke();
      }
      ctx.restore();

      // Storm Landslides
      if (state?.activeLandslides && state.activeLandslides.length > 0) {
        ctx.save();
        state.activeLandslides.forEach((ls) => {
          const p = worldToPx(ls.x, ls.z);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.92)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.arc(p.px, p.py, Math.max(5.5 * dpr, 16 * pxPerMeter), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    // ---- 4. DUAL-CASING WINDING MOUNTAIN ROADS (ALL 16 ROUTES) ----
    {
      const roads = geomorph.roadPolylines || (geomorph.roadDense ? [{ pts: geomorph.roadDense, width: 8.6 }] : []);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pass A: Dark outer road casing
      for (let rIdx = 0; rIdx < roads.length; rIdx++) {
        const rd = roads[rIdx];
        const pts = rd.pts;
        if (!pts || pts.length < 2) continue;
        const isMain = rIdx <= 1;
        const wPx = Math.max((isMain ? 2.6 : 1.7) * dpr, (rd.width || 8.0) * pxPerMeter);
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = worldToPx(pts[i][0], pts[i][1]);
          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.strokeStyle = 'rgba(24, 28, 32, 0.72)';
        ctx.lineWidth = wPx + 2.2 * dpr;
        ctx.stroke();
      }

      // Pass B: Crisp ivory / warm-ochre inner road surface
      for (let rIdx = 0; rIdx < roads.length; rIdx++) {
        const rd = roads[rIdx];
        const pts = rd.pts;
        if (!pts || pts.length < 2) continue;
        const isMain = rIdx <= 1;
        const wPx = Math.max((isMain ? 2.4 : 1.5) * dpr, (rd.width || 8.0) * pxPerMeter);
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const p = worldToPx(pts[i][0], pts[i][1]);
          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.strokeStyle = isMain ? 'rgba(255, 244, 210, 0.96)' : 'rgba(242, 224, 172, 0.88)';
        ctx.lineWidth = wPx;
        ctx.stroke();

        // Pass C: Subtle dashed centerline at high zoom
        if (zoom >= 26) {
          ctx.save();
          ctx.setLineDash([5 * dpr, 6 * dpr]);
          ctx.strokeStyle = isMain ? 'rgba(217, 152, 42, 0.80)' : 'rgba(148, 134, 108, 0.55)';
          ctx.lineWidth = Math.max(0.8 * dpr, 0.35 * pxPerMeter);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // ---- 5. TRUE-SCALE ARCHITECTURAL FOOTPRINTS AT HIGH ZOOM (NARROW-50, 杉ノ郷, NULL EREA) ----
    if (zoom >= 10) {
      ctx.save();
      const alpha = Math.min(1.0, (zoom - 10) / 14);
      ctx.globalAlpha = alpha;

      const drawFootprint = (x0, z0, x1, z1, fill, stroke, label = null, labelYFrac = 0.5) => {
        const a = worldToPx(x0, z0);
        const b = worldToPx(x1, z1);
        const w = b.px - a.px;
        const h = b.py - a.py;
        if (a.px + w < -40 || a.px > CW + 40 || a.py + h < -40 || a.py > CH + 40) return;
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1.0, 1.3 * dpr);
        ctx.fillRect(a.px, a.py, w, h);
        ctx.strokeRect(a.px, a.py, w, h);
        if (label && zoom >= 52 && Math.max(Math.abs(w), Math.abs(h)) > 24 * dpr) {
          ctx.font = `700 ${Math.round(8.2 * dpr)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lx = a.px + w * 0.5;
          const ly = a.py + h * labelYFrac;
          if (labelYFrac < 0 || labelYFrac > 1) {
            ctx.lineWidth = 2.6 * dpr;
            ctx.strokeStyle = 'rgba(8, 15, 24, 0.85)';
            ctx.fillStyle = '#e2e8f0';
            ctx.strokeText(label, lx, ly);
            ctx.fillText(label, lx, ly);
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillText(label, lx, ly);
          }
        }
      };

      // 5a. NARROW-50 Compound
      drawFootprint(-9.5, -16.0, 23.0, 16.0, 'rgba(226, 222, 212, 0.32)', 'rgba(148, 163, 184, 0.45)');
      drawFootprint(0.0, 0.0, 5.0, 10.0, 'rgba(248, 250, 252, 0.92)', '#0f172a', '母屋');
      drawFootprint(-5.5, 0.0, -1.5, 9.0, 'rgba(241, 245, 249, 0.88)', '#334155', '別館');
      drawFootprint(-8.0, 2.0, -5.8, 7.0, 'rgba(226, 232, 240, 0.86)', '#475569');
      drawFootprint(10.0, -4.0, 22.0, 14.0, 'rgba(203, 213, 225, 0.90)', '#1e293b', 'GARAGE', 1.12);

      // 5b. Suginosato 5-House Village
      drawFootprint(VILLAGE.lane.minX, VILLAGE.lane.minZ, VILLAGE.lane.maxX, VILLAGE.lane.maxZ, 'rgba(218, 212, 198, 0.55)', 'rgba(120, 113, 108, 0.45)');
      drawFootprint(VILLAGE.plaza.minX, VILLAGE.plaza.minZ, VILLAGE.plaza.maxX, VILLAGE.plaza.maxZ, 'rgba(228, 222, 208, 0.65)', 'rgba(120, 113, 108, 0.55)');
      for (let i = 0; i < VILLAGE_HOUSES.length; i++) {
        const vh = VILLAGE_HOUSES[i];
        drawFootprint(vh.ox, vh.oz, vh.ox + vh.w, vh.oz + vh.d, 'rgba(250, 245, 235, 0.92)', '#451a03', vh.code);
      }
      // Spring Well & Shrine Torii
      const wellP = worldToPx(VILLAGE.well.x, VILLAGE.well.z);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.arc(wellP.px, wellP.py, Math.max(2.5 * dpr, VILLAGE.well.r * pxPerMeter), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const shrP = worldToPx(VILLAGE.shrine.x, VILLAGE.shrine.z);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(shrP.px, shrP.py, Math.max(3.0 * dpr, 2.2 * pxPerMeter), 0, Math.PI * 2);
      ctx.fill();

      // 5c. NULL EREA Launch Pad & Circular SILO-40 Aperture
      drawFootprint(-150, 29860, 150, 29960, 'rgba(30, 41, 59, 0.72)', 'rgba(56, 189, 248, 0.85)');
      const siloP = worldToPx(0, 29910);
      const siloR = Math.max(4.5 * dpr, 22.0 * pxPerMeter);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.arc(siloP.px, siloP.py, siloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // ---- 6. ALL 3D ARCHITECTURAL BRIDGES (True Span, Orientation, Abutments & Labels) ----
    const bridges = geomorph.bridges || [];
    const placedLabels = [];
    const canPlaceLabel = (x, y, minDist) => {
      for (let i = 0; i < placedLabels.length; i++) {
        if (Math.hypot(x - placedLabels[i].x, y - placedLabels[i].y) < minDist) return false;
      }
      placedLabels.push({ x, y });
      return true;
    };

    if (bridges.length > 0) {
      ctx.save();
      for (let bi = 0; bi < bridges.length; bi++) {
        const b = bridges[bi];
        const p = worldToPx(b.cx, b.cz);
        if (p.px < -60 || p.px > CW + 60 || p.py < -60 || p.py > CH + 60) continue;

        const isMain = b.kind === 'main_river';
        if (!isMain && zoom < 5.0) continue;

        const ang = Math.atan2(b.uz, b.ux);
        const halfL = Math.max((isMain ? 7.5 : 4.5) * dpr, b.halfSpan * pxPerMeter);
        const halfW = Math.max((isMain ? 2.6 : 1.7) * dpr, b.halfDeckW * pxPerMeter);

        ctx.save();
        ctx.translate(p.px, p.py);
        ctx.rotate(ang);

        // Dark bridge abutment wing walls (`][`)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-halfL - 1.5 * dpr, -halfW - 1.4 * dpr, (halfL * 2) + 3 * dpr, (halfW * 2) + 2.8 * dpr);

        // Bridge deck ribbon
        const deckCol = b.style === 'vermilion_arch'
          ? '#ef4444'
          : (b.style === 'steel_truss' ? '#93c5fd' : (b.style === 'forest_arch' ? '#6ee7b7' : '#d6b27c'));
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-halfL, -halfW, halfL * 2, halfW * 2);

        // Architectural side arches / guardrails
        ctx.strokeStyle = deckCol;
        ctx.lineWidth = Math.max(1.4 * dpr, 0.9 * pxPerMeter);
        ctx.beginPath();
        ctx.moveTo(-halfL, -halfW); ctx.lineTo(halfL, -halfW);
        ctx.moveTo(-halfL, halfW);  ctx.lineTo(halfL, halfW);
        ctx.stroke();

        // Abutment bracket ticks
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(-halfL - 2.2 * dpr, -halfW - 2.4 * dpr); ctx.lineTo(-halfL + 1.2 * dpr, -halfW);
        ctx.moveTo(-halfL - 2.2 * dpr,  halfW + 2.4 * dpr); ctx.lineTo(-halfL + 1.2 * dpr,  halfW);
        ctx.moveTo( halfL + 2.2 * dpr, -halfW - 2.4 * dpr); ctx.lineTo( halfL - 1.2 * dpr, -halfW);
        ctx.moveTo( halfL + 2.2 * dpr,  halfW + 2.4 * dpr); ctx.lineTo( halfL - 1.2 * dpr,  halfW);
        ctx.stroke();
        ctx.restore();

        // Crisp bridge label when zoomed in
        const showLabel = (isMain && zoom >= 6.5) || (!isMain && zoom >= 26.0);
        if (showLabel && b.nameJp && canPlaceLabel(p.px, p.py - halfW - 10 * dpr, 68 * dpr)) {
          ctx.font = `700 ${Math.round(8.6 * dpr)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3.0 * dpr;
          ctx.strokeStyle = 'rgba(8, 15, 24, 0.86)';
          ctx.fillStyle = b.style === 'vermilion_arch' ? '#fecaca' : '#e0f2fe';
          ctx.strokeText(b.nameJp, p.px, p.py - halfW - 5 * dpr);
          ctx.fillText(b.nameJp, p.px, p.py - halfW - 5 * dpr);
        }
      }
      ctx.restore();
    }

    // ---- 7. 18 MOUNTAIN PEAKS (▲ + Peak Name + Elevation ASL, Smartly Decluttered) ----
    {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < peaksData.length; i++) {
        const pk = peaksData[i];
        // At wide zoom show major peaks (>= 850m ASL); show local valley peaks as zoom increases
        if (zoom < 2.2 && pk.elevASL < 900) continue;
        const p = worldToPx(pk.x, pk.z);
        if (p.px < -40 || p.px > CW + 40 || p.py < -40 || p.py > CH + 40) continue;
        if (!canPlaceLabel(p.px, p.py, 76 * dpr)) continue;

        const tri = (pk.elevASL > 1100 ? 4.4 : 3.4) * dpr;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py - tri);
        ctx.lineTo(p.px + tri * 0.92, p.py + tri * 0.72);
        ctx.lineTo(p.px - tri * 0.92, p.py + tri * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.round(8.8 * dpr)}px sans-serif`;
        ctx.lineWidth = 3.0 * dpr;
        ctx.strokeStyle = 'rgba(10, 16, 24, 0.82)';
        ctx.fillStyle = '#f8fafc';
        ctx.strokeText(pk.nameJp, p.px, p.py + tri + 2.5 * dpr);
        ctx.fillText(pk.nameJp, p.px, p.py + tri + 2.5 * dpr);

        ctx.font = `600 ${Math.round(7.4 * dpr)}px ui-monospace, monospace`;
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeText(`${pk.elevASL}m`, p.px, p.py + tri + 12.5 * dpr);
        ctx.fillText(`${pk.elevASL}m`, p.px, p.py + tri + 12.5 * dpr);
      }
      ctx.restore();
    }

    // ---- 8. CURATED CLEAN LANDMARK BADGES (NO 31 yellow numbered circles!) ----
    {
      const keyPlaces = [
        { name: 'NARROW-50', x: 2.5, z: 4.0, accent: '#38bdf8', always: true, hideHighZoom: true },
        { name: '杉ノ郷', x: VILLAGE.centerX, z: VILLAGE.centerZ, accent: '#34d399', always: true, minZoom: 3.5, hideHighZoom: true },
        { name: 'NULL EREA', x: 0, z: 29910, accent: '#22d3ee', always: true, hideHighZoom: false },
        ...TERRENO_LANDMARKS.filter((lm) => !['compound', 'village', 'gorge_river', 'null_erea'].includes(lm.id)).map((lm) => ({
          name: lm.nameJp.split('・')[0],
          x: lm.x,
          z: lm.z,
          accent: '#fde68a',
          always: false,
          hideHighZoom: false,
        })),
      ];
      ctx.save();
      for (let i = 0; i < keyPlaces.length; i++) {
        const pl = keyPlaces[i];
        if (pl.hideHighZoom && zoom >= 85) continue;
        if (pl.minZoom && zoom < pl.minZoom) continue;
        if (!pl.always && zoom < 2.2) continue;
        const p = worldToPx(pl.x, pl.z);
        if (p.px < -60 || p.px > CW + 60 || p.py < -40 || p.py > CH + 40) continue;
        if (!pl.always && !canPlaceLabel(p.px, p.py, 90 * dpr)) continue;

        ctx.fillStyle = 'rgba(9, 16, 26, 0.78)';
        ctx.strokeStyle = pl.accent;
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.arc(p.px, p.py, (pl.always ? 4.4 : 3.2) * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = `${pl.always ? 800 : 700} ${Math.round((pl.always ? 9.4 : 8.2) * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.2 * dpr;
        ctx.strokeStyle = 'rgba(7, 13, 20, 0.88)';
        ctx.fillStyle = pl.always ? '#ffffff' : '#f1f5f9';
        ctx.strokeText(pl.name, p.px, p.py - 7 * dpr);
        ctx.fillText(pl.name, p.px, p.py - 7 * dpr);
      }
      ctx.restore();
    }

    // ---- 9. ACTIVE AUTONOMOUS ROUTES (Glowing Dual-Layer Route + Distance Pill) ----
    const drawRoute = (routePts, strokeCol, glowCol, vehLabel) => {
      if (!routePts || routePts.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let totalDist = 0;
      for (let i = 0; i < routePts.length; i++) {
        const p = worldToPx(routePts[i][0], routePts[i][1]);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else {
          ctx.lineTo(p.px, p.py);
          totalDist += Math.hypot(routePts[i][0] - routePts[i - 1][0], routePts[i][1] - routePts[i - 1][1]);
        }
      }
      ctx.strokeStyle = glowCol;
      ctx.lineWidth = 7.2 * dpr;
      ctx.stroke();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 3.0 * dpr;
      ctx.stroke();

      // Animated crisp white directional dashes on route
      ctx.setLineDash([6 * dpr, 10 * dpr]);
      ctx.lineDashOffset = -(performance.now() * 0.025) * dpr;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 1.4 * dpr;
      ctx.stroke();
      ctx.setLineDash([]);

      // Destination target pin + distance tag
      const last = routePts[routePts.length - 1];
      const dp = worldToPx(last[0], last[1]);
      ctx.fillStyle = strokeCol;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0 * dpr;
      ctx.beginPath();
      ctx.arc(dp.px, dp.py, 6.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const distTag = `${vehLabel} ${formatMetricScale(totalDist)}`;
      ctx.font = `700 ${Math.round(8.8 * dpr)}px sans-serif`;
      const tw = ctx.measureText(distTag).width + 12 * dpr;
      const th = 16 * dpr;
      const bx = dp.px - tw * 0.5;
      const by = dp.py - 12 * dpr - th;
      ctx.fillStyle = 'rgba(8, 15, 26, 0.86)';
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.1 * dpr;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, th, 8 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(distTag, dp.px, by + th * 0.5 + 0.5 * dpr);
      ctx.restore();
    };

    if (routesByVeh) {
      drawRoute(routesByVeh.camper, '#38bdf8', 'rgba(56, 189, 248, 0.28)', 'RV');
      drawRoute(routesByVeh.armor, '#34d399', 'rgba(52, 211, 153, 0.28)', '装甲');
      drawRoute(routesByVeh.k11, '#c084fc', 'rgba(192, 132, 252, 0.28)', 'K-11');
    } else if (state?.autopilotRoute && state.autopilotRoute.length >= 2) {
      drawRoute(state.autopilotRoute, '#38bdf8', 'rgba(56, 189, 248, 0.28)', '目的地');
    }

    // Tap dispatch ripple feedback
    if (tapRipple) {
      const elapsed = (performance.now() - tapRipple.t0) / 950;
      if (elapsed >= 0 && elapsed < 1) {
        const rp = worldToPx(tapRipple.wx, tapRipple.wz);
        ctx.save();
        ctx.strokeStyle = tapRipple.color;
        ctx.globalAlpha = 1.0 - elapsed;
        ctx.lineWidth = 2.2 * dpr;
        ctx.beginPath();
        ctx.arc(rp.px, rp.py, (8 + elapsed * 32) * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ---- 10. LIVE VEHICLES (True-Scale Rotated Silhouettes at High Zoom, Crisp Badges Wide!) ----
    {
      const assets = getDynamicAssetCoords(state);
      ctx.save();
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const p = worldToPx(a.x, a.z);
        if (p.px < -40 || p.px > CW + 40 || p.py < -40 || p.py > CH + 40) continue;

        const isSelected = a.kind === activeAutoVeh;

        if (a.kind === 'k11') {
          ctx.save();
          ctx.translate(p.px, p.py);
          ctx.rotate(-a.yaw);
          const sc = Math.max(1.0, (a.l * pxPerMeter) / (18 * dpr));
          ctx.fillStyle = a.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6 * dpr;
          ctx.beginPath();
          ctx.moveTo(0, -9.0 * dpr * sc);
          ctx.lineTo(4.8 * dpr * sc, 2.0 * dpr * sc);
          ctx.lineTo(0, 8.0 * dpr * sc);
          ctx.lineTo(-4.8 * dpr * sc, 2.0 * dpr * sc);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (zoom >= 65) {
          // True-to-scale rotated vehicle silhouette!
          const vw = Math.max(4 * dpr, a.w * pxPerMeter);
          const vl = Math.max(7 * dpr, a.l * pxPerMeter);
          ctx.save();
          ctx.translate(p.px, p.py);
          ctx.rotate(-a.yaw);
          ctx.fillStyle = a.color;
          ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
          ctx.lineWidth = (isSelected ? 2.0 : 1.4) * dpr;
          ctx.beginPath();
          ctx.roundRect(-vw * 0.5, -vl * 0.5, vw, vl, Math.min(vw * 0.25, 3 * dpr));
          ctx.fill();
          ctx.stroke();
          // Windshield accent on front (+Z/-Z nose)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
          ctx.fillRect(-vw * 0.36, -vl * 0.38, vw * 0.72, vl * 0.16);
          ctx.restore();
        } else {
          ctx.fillStyle = a.color;
          ctx.strokeStyle = isSelected ? '#ffffff' : '#071018';
          ctx.lineWidth = (isSelected ? 2.0 : 1.4) * dpr;
          ctx.beginPath();
          ctx.arc(p.px, p.py, (isSelected ? 5.6 : 4.4) * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        if (zoom >= 14) {
          ctx.font = `700 ${Math.round(8.0 * dpr)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.lineWidth = 2.6 * dpr;
          ctx.strokeStyle = 'rgba(8, 14, 22, 0.88)';
          ctx.fillStyle = '#ffffff';
          ctx.strokeText(a.code, p.px, p.py + 7 * dpr);
          ctx.fillText(a.code, p.px, p.py + 7 * dpr);
        }
      }
      ctx.restore();
    }

    // ---- 11. LIVE PLAYER GPS BEACON & TRANSLUCENT HEADING CONE ----
    {
      const pxW = state?.x ?? 1.5;
      const pzW = state?.z ?? 3.5;
      const pYaw = state?.yaw ?? 0;
      const pp = worldToPx(pxW, pzW);
      ctx.save();
      const ang = Math.atan2(-Math.cos(pYaw), -Math.sin(pYaw));
      const coneR = 24 * dpr;
      const grad = ctx.createRadialGradient(pp.px, pp.py, 2 * dpr, pp.px, pp.py, coneR);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.58)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pp.px, pp.py);
      ctx.arc(pp.px, pp.py, coneR, ang - 0.44, ang + 0.44);
      ctx.closePath();
      ctx.fill();

      // Subtle outer halo ring + vivid Apple-Maps GPS blue dot
      ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
      ctx.beginPath();
      ctx.arc(pp.px, pp.py, 10.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(pp.px, pp.py, 5.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Hairline world boundary frame
    ctx.strokeStyle = 'rgba(148, 184, 214, 0.30)';
    ctx.lineWidth = 1.0 * dpr;
    ctx.strokeRect(tl.px, tl.py, dw, dh);

    updateBottomHud(state);
  }

  return {
    mount,
    render,
    resetView,
    focusOnWorld,
    cycleFocus,
    setView,
    getViewState,
    setSelectedVehicle,
    getSelectedVehicle: () => activeAutoVeh,
    reliefCanvas,
  };
}
