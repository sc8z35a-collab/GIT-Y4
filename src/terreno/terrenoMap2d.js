import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  evalMainRiver,
} from './terrenoConfig.js';
import { AUTOPILOT_WAYPOINTS, DYNAMIC_TARGETS } from './terrenoAutopilot.js';

/**
 * TERRENO Full-Screen Edge-to-Edge Authentic GSI 2D Topographic Map & 30-Waypoint Autonomous Route Selector.
 *   - Oriented horizontally (North Left -> South Right) to fill 100% of widescreen POCO F7 landscape displays!
 *   - Hypsometric elevation tinting + NW hillshade + Sky-View gorge AO + crisp 50m/200m contour lines
 *   - Live 19km river (expands dynamically during storm flash-floods!), 19km forestry road, active landslide rings
 *   - 30 numbered safe destination pins (01..30) + 4 live asset pins (自宅 / 軽 / 箱 / RV)
 *   - Live glowing A* safe route path + smooth 1/2-finger pan & pinch zoom (0.8x..6.0x)
 *   - Zero sidebars, zero telemetry boxes, zero verbose text!
 */

function hypsometricColor(asl) {
  const stops = [
    [320,  32,  66,  50],
    [520,  46,  92,  60],
    [760,  72, 118,  66],
    [1020, 118, 138,  76],
    [1260, 164, 146,  98],
    [1440, 198, 178, 144],
    [1680, 234, 228, 218],
  ];
  if (asl <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (asl <= b[0]) {
      const t = (asl - a[0]) / (b[0] - a[0]);
      return [
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        a[3] + (b[3] - a[3]) * t,
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

/**
 * Pre-bake landscape-rotated 1536×512 (North Left -> South Right, West Top -> East Bottom) GSI Relief Bitmap once (<40ms).
 */
function bakeLandscapeReliefBitmap(geomorph) {
  const W = geomorph.W; // 512 (X: West..East -> Vertical Y on landscape map)
  const H = geomorph.H; // 1536 (Z: North..South -> Horizontal X on landscape map!)
  const heights = geomorph.heights;
  const geoRGBA = geomorph.geoRGBA;
  const horizonRGBA = geomorph.horizonRGBA;
  const cellX = TERRENO_WORLD.width / (W - 1);
  const cellZ = TERRENO_WORLD.depth / (H - 1);

  const canvas = document.createElement('canvas');
  canvas.width = H;
  canvas.height = W;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(H, W);
  const d = img.data;

  const lx = -0.64, ly = 0.60, lz = -0.48;

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
      const invL = 1.0 / Math.hypot(gx, 1.0, gz);
      const nx = -gx * invL, ny = invL, nz = -gz * invL;
      const shade = Math.max(0.28, Math.min(1.28, (nx * lx + ny * ly + nz * lz) * 0.95 + 0.42));
      const skyAO = 0.68 + 0.32 * (horizonRGBA[idx * 4 + 2] / 255.0);

      let [r, g, b] = hypsometricColor(asl);
      r *= shade * skyAO;
      g *= shade * skyAO;
      b *= shade * skyAO;

      // Crisp 50m minor & 200m major GSI topographic contours
      const aslR = TERRENO_WORLD.baseElevationASL + heights[iz * W + ixR];
      const aslD = TERRENO_WORLD.baseElevationASL + heights[izD * W + ix];
      const maj0 = Math.floor(asl / 200.0);
      const isMajor = Math.floor(aslR / 200.0) !== maj0 || Math.floor(aslD / 200.0) !== maj0;
      const min0 = Math.floor(asl / 50.0);
      const isMinor = !isMajor && (Math.floor(aslR / 50.0) !== min0 || Math.floor(aslD / 50.0) !== min0);

      if (isMajor) {
        r = r * 0.45 + 48;
        g = g * 0.45 + 34;
        b = b * 0.45 + 20;
      } else if (isMinor) {
        r = r * 0.74 + 22;
        g = g * 0.74 + 16;
        b = b * 0.74 + 10;
      }

      const distRiv = Math.abs(wx - rv.x);
      const wetness = geoRGBA[idx * 4 + 1];
      if (distRiv < rv.halfWidth * 1.15) {
        r = 34; g = 148; b = 198;
      } else if (wetness > 0.78 && asl < 1260) {
        r = r * 0.48 + 30;
        g = g * 0.48 + 108;
        b = b * 0.48 + 148;
      }

      // Write rotated: horizontal px = iz (0..H-1), vertical py = ix (0..W-1)
      const o = (ix * H + iz) * 4;
      d[o] = Math.max(0, Math.min(255, Math.round(r)));
      d[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      d[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createTerrenoMap2D(geomorph, callbacks = {}) {
  const reliefCanvas = bakeLandscapeReliefBitmap(geomorph);

  let canvas = null;
  let containerEl = null;
  let lastState = null;

  // Interactive smooth pan & 2-finger pinch zoom state (normalized canvas view)
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let baseRect = { x: 0, y: 0, w: 1, h: 1 };

  function updateBaseRect() {
    if (!canvas) return;
    const CW = canvas.width;
    const CH = canvas.height;
    // Slight vertical visual stretch (1.42×) so the 5km × 19km relief fills POCO F7 widescreen edge-to-edge cleanly!
    const padX = 16;
    const padY = 44;
    const availW = CW - padX * 2;
    const availH = CH - padY * 2;
    const targetAspect = (19 / 5) * 0.62; // ~2.35 landscape aspect matching POCO F7!
    let w = availW;
    let h = w / targetAspect;
    if (h > availH) {
      h = availH;
      w = h * targetAspect;
    }
    baseRect = {
      x: (CW - w) * 0.5,
      y: (CH - h) * 0.5,
      w,
      h,
    };
  }

  // World (wx, wz) -> Canvas pixel (px, py) with current pan & zoom
  function worldToPx(wx, wz) {
    const u = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth; // North (left 0) -> South (right 1)
    const v = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width; // West (top 0) -> East (bottom 1)
    const bx = baseRect.x + u * baseRect.w;
    const by = baseRect.y + v * baseRect.h;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    return {
      px: cx + (bx - cx) * zoom + panX,
      py: cy + (by - cy) * zoom + panY,
    };
  }

  function pxToWorld(px, py) {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const bx = cx + (px - cx - panX) / zoom;
    const by = cy + (py - cy - panY) / zoom;
    const u = (bx - baseRect.x) / baseRect.w;
    const v = (by - baseRect.y) / baseRect.h;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) return null;
    return {
      x: Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, TERRENO_WORLD.minX + v * TERRENO_WORLD.width)),
      z: Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, TERRENO_WORLD.minZ + u * TERRENO_WORLD.depth)),
    };
  }

  function clampView() {
    zoom = Math.max(0.85, Math.min(6.0, zoom));
    if (!canvas) return;
    const maxPanX = canvas.width * 0.48 * zoom;
    const maxPanY = canvas.height * 0.48 * zoom;
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function resetView() {
    zoom = 1.0;
    panX = 0;
    panY = 0;
    if (lastState) render(lastState);
  }

  function getDynamicAssetCoords(state) {
    return [
      { id: 'dyn_home', code: '自宅', kind: 'home', x: 15.6, z: -15.0, color: '#38bdf8' },
      { id: 'dyn_kei', code: '軽', kind: 'kei', x: state?.keiPose?.cx ?? 3.55, z: state?.keiPose?.cz ?? -3.80, color: '#facc15' },
      { id: 'dyn_container', code: '箱', kind: 'container', x: state?.containerPose?.cx ?? 19.85, z: state?.containerPose?.cz ?? 6.50, color: '#a3e635' },
      { id: 'dyn_camper', code: 'RV', kind: 'camper', x: state?.camperPose?.cx ?? 7.75, z: state?.camperPose?.cz ?? 5.75, color: '#fb923c' },
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

    // Compact minimalist top-left floating 4 dynamic asset chips (自宅 / 軽 / 箱 / RV)
    const dynBar = document.createElement('div');
    dynBar.className = 'map2d-dyn-bar';
    DYNAMIC_TARGETS.forEach((dt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-pill-btn map2d-dyn-btn';
      btn.dataset.dynKind = dt.kind;
      btn.textContent = dt.code;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks.onSelectDynamicTarget) {
          callbacks.onSelectDynamicTarget(dt.kind);
        }
      });
      dynBar.appendChild(btn);
    });
    wrap.appendChild(dynBar);
    containerEl.appendChild(wrap);

    const syncSize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, Math.round((r.width || window.innerWidth) * dpr));
      canvas.height = Math.max(200, Math.round((r.height || window.innerHeight) * dpr));
      updateBaseRect();
      if (lastState) render(lastState);
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);

    // Smooth Multi-Touch 2-Finger Pinch Zoom + 1/2-Finger Pan + Tap Pin Selection!
    const ptrs = new Map();
    let singleMoved = 0;
    let hadMulti = false;
    let prevDist = 0;
    let prevMid = { x: 0, y: 0 };

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        singleMoved = 0;
        hadMulti = false;
      } else if (ptrs.size === 2) {
        hadMulti = true;
        const pts = Array.from(ptrs.values());
        prevDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        prevMid = { x: (pts[0].x + pts[1].x) * 0.5, y: (pts[0].y + pts[1].y) * 0.5 };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);

      if (ptrs.size === 1 && !hadMulti) {
        singleMoved += Math.hypot(dx, dy);
        panX += dx * sx;
        panY += dy * sy;
        clampView();
        if (lastState) render(lastState);
      } else if (ptrs.size === 2) {
        const pts = Array.from(ptrs.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const mid = { x: (pts[0].x + pts[1].x) * 0.5, y: (pts[0].y + pts[1].y) * 0.5 };
        if (prevDist > 8 && dist > 8) {
          const factor = dist / prevDist;
          const oldZoom = zoom;
          zoom = Math.max(0.85, Math.min(6.0, zoom * factor));
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

    const onUp = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const isTap = ptrs.size === 1 && !hadMulti && singleMoved < 10;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0) hadMulti = false;

      if (isTap) {
        const rect = canvas.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
        const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
        const dpr = canvas.width / Math.max(1, rect.width);
        const hitRad = 22 * dpr;

        // 1. Check 4 Dynamic Asset Pins first
        const assets = getDynamicAssetCoords(lastState);
        for (let i = 0; i < assets.length; i++) {
          const ap = worldToPx(assets[i].x, assets[i].z);
          if (Math.hypot(px - ap.px, py - ap.py) <= hitRad) {
            if (callbacks.onSelectDynamicTarget) callbacks.onSelectDynamicTarget(assets[i].kind);
            return;
          }
        }

        // 2. Check 30 Numbered Safe Waypoints (01..30)
        let bestWp = null;
        let bestD = hitRad;
        for (let i = 0; i < AUTOPILOT_WAYPOINTS.length; i++) {
          const wp = AUTOPILOT_WAYPOINTS[i];
          const p = worldToPx(wp.x, wp.z);
          const d = Math.hypot(px - p.px, py - p.py);
          if (d < bestD) {
            bestD = d;
            bestWp = wp;
          }
        }
        if (bestWp) {
          if (callbacks.onSelectWaypoint) callbacks.onSelectWaypoint(bestWp);
          return;
        }

        // 3. Tap anywhere else on the 2D topographic map -> route/teleport to exact world point!
        const w = pxToWorld(px, py);
        if (w && callbacks.onSelectWorldPoint) {
          callbacks.onSelectWorldPoint(w.x, w.z);
        }
      }
    };
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      const oldZoom = zoom;
      zoom = Math.max(0.85, Math.min(6.0, zoom * (e.deltaY > 0 ? 0.88 : 1.14)));
      const ratio = zoom / oldZoom;
      const mx = (e.clientX - rect.left) * sx - canvas.width * 0.5;
      const my = (e.clientY - rect.top) * sy - canvas.height * 0.5;
      panX = mx - (mx - panX) * ratio;
      panY = my - (my - panY) * ratio;
      clampView();
      if (lastState) render(lastState);
    }, { passive: false });
  }

  function render(state) {
    lastState = state;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CW = canvas.width;
    const CH = canvas.height;
    const dpr = CW / Math.max(320, canvas.clientWidth || 924);

    ctx.fillStyle = '#070d14';
    ctx.fillRect(0, 0, CW, CH);

    const tl = worldToPx(TERRENO_WORLD.minX, TERRENO_WORLD.minZ);
    const br = worldToPx(TERRENO_WORLD.maxX, TERRENO_WORLD.maxZ);
    const dw = br.px - tl.px;
    const dh = br.py - tl.py;

    // 1. Shaded GSI Hypsometric + Hillshade + 50m/200m Contour Bitmap
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(reliefCanvas, tl.px, tl.py, dw, dh);

    // 2. Dynamic Storm Flash-Flood River Inundation & Active Landslide Hazard Rings
    const floodRise = state?.floodRise || 0;
    if (floodRise > 0.3) {
      ctx.save();
      ctx.beginPath();
      for (let z = TERRENO_WORLD.minZ; z <= TERRENO_WORLD.maxZ; z += 180) {
        const rv = evalMainRiver(z);
        const p = worldToPx(rv.x, z);
        if (z === TERRENO_WORLD.minZ) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = `rgba(180, 128, 62, ${Math.min(0.68, 0.25 + floodRise * 0.06)})`;
      ctx.lineWidth = Math.max(3, (6 + floodRise * 2.2) * dpr * Math.sqrt(zoom));
      ctx.stroke();
      ctx.restore();
    }
    if (state?.activeLandslides && state.activeLandslides.length > 0) {
      ctx.save();
      state.activeLandslides.forEach((ls) => {
        const p = worldToPx(ls.x, ls.z);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.42)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.9)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }

    // 3. Subtle 2 km Metric Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.8 * dpr;
    for (let x = -2000; x <= 2000; x += 1000) {
      const a = worldToPx(x, TERRENO_WORLD.minZ);
      const b = worldToPx(x, TERRENO_WORLD.maxZ);
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }
    for (let z = -6000; z <= 12000; z += 2000) {
      const a = worldToPx(TERRENO_WORLD.minX, z);
      const b = worldToPx(TERRENO_WORLD.maxX, z);
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    }
    ctx.restore();

    // 4. 19 km Graded Forestry Road (奥山林道)
    ctx.save();
    ctx.beginPath();
    const rd = geomorph.roadDense;
    for (let i = 0; i < rd.length; i++) {
      const p = worldToPx(rd[i][0], rd[i][1]);
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.strokeStyle = 'rgba(253, 224, 138, 0.85)';
    ctx.lineWidth = 1.8 * dpr;
    ctx.stroke();
    ctx.restore();

    // 5. Active Computed Safe A* Autonomous Route Path (Crisp Glowing Cyan Ribbon!)
    if (state?.autopilotRoute && state.autopilotRoute.length >= 2) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < state.autopilotRoute.length; i++) {
        const pt = state.autopilotRoute[i];
        const p = worldToPx(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.2 * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // 6. Subtle Mountain Peak Triangles (▲ — geometry only, zero text bloat)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 243, 214, 0.72)';
    MOUNTAIN_PEAKS.forEach((pk) => {
      const p = worldToPx(pk.x, pk.z);
      const r = 3.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py - r);
      ctx.lineTo(p.px - r * 0.9, p.py + r * 0.7);
      ctx.lineTo(p.px + r * 0.9, p.py + r * 0.7);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // 7. 30 Numbered Selectable Waypoint Pins (01..30)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(8.5 * dpr)}px ui-monospace, monospace`;
    const activeWpId = state?.autopilotTargetId || null;
    AUTOPILOT_WAYPOINTS.forEach((wp) => {
      const p = worldToPx(wp.x, wp.z);
      const isActive = activeWpId === wp.id;
      const rad = (isActive ? 9.5 : 7.8) * dpr;
      ctx.fillStyle = isActive ? '#0ea5e9' : 'rgba(9, 15, 22, 0.82)';
      ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(245, 198, 92, 0.85)';
      ctx.lineWidth = (isActive ? 2.0 : 1.2) * dpr;
      ctx.beginPath();
      ctx.arc(p.px, p.py, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? '#ffffff' : '#fde68a';
      ctx.fillText(wp.num, p.px, p.py + 0.5 * dpr);
    });
    ctx.restore();

    // 8. 4 Live Dynamic Asset Pins (自宅 / 軽 / 箱 / RV) + ARMOR-155 Emerald Pin
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(8.5 * dpr)}px sans-serif`;
    const assets = getDynamicAssetCoords(state);
    assets.forEach((a) => {
      const p = worldToPx(a.x, a.z);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = '#071018';
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.arc(p.px, p.py, 5.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    if (state?.armorPose) {
      const ap = worldToPx(state.armorPose.cx, state.armorPose.cz);
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8 * dpr;
      ctx.beginPath();
      ctx.arc(ap.px, ap.py, 5.8 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // 9. Live Player GPS Dot & Heading Cone (Note: North = Left -X, West = Up -Y!)
    const pxW = state?.x ?? 1.5;
    const pzW = state?.z ?? 3.5;
    const pYaw = state?.yaw ?? 0;
    const pp = worldToPx(pxW, pzW);
    ctx.save();
    // Forward world (-sin(yaw), -cos(yaw)): map X = +Z -> -cos(yaw), map Y = +X -> -sin(yaw)
    const dirPx = -Math.cos(pYaw);
    const dirPy = -Math.sin(pYaw);
    const ang = Math.atan2(dirPy, dirPx);
    ctx.fillStyle = 'rgba(248, 113, 113, 0.36)';
    ctx.beginPath();
    ctx.moveTo(pp.px, pp.py);
    ctx.arc(pp.px, pp.py, 19 * dpr, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath();
    ctx.arc(pp.px, pp.py, 4.8 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Minimalist hairline frame + tiny North indicator (◄ N)
    ctx.strokeStyle = 'rgba(148, 184, 214, 0.40)';
    ctx.lineWidth = 1.1 * dpr;
    ctx.strokeRect(tl.px, tl.py, dw, dh);
  }

  return {
    mount,
    render,
    resetView,
    reliefCanvas,
  };
}
