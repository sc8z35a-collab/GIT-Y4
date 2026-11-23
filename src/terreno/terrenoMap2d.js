import {
  TERRENO_WORLD,
  evalMainRiver,
  evalRegionWeights,
} from './terrenoConfig.js';
import { AUTOPILOT_WAYPOINTS, DYNAMIC_TARGETS } from './terrenoAutopilot.js';
import { VILLAGE } from '../villageData.js';

/**
 * TERRENO Full-Screen Edge-to-Edge GSI 2D Topographic Map & Free-Destination Autonomous Route Selector (60 km × 60 km).
 *   - Standard North-Up Orientation (North Top / South Bottom / West Left / East Right)
 *   - Seamless 6-biome countryside palette + NW hillshade + Sky-View AO + crisp 10m / 50m contours
 *   - Live 60 km meandering river, ALL 21 natural roads, Suginosato 5-House Village, & storm hazards
 *   - Tap ANY point, waypoint (01..30), or live asset to set free autonomous destination for CAMPER-75 or ARMOR-155
 *   - Smooth 1/2-finger pan & pinch zoom (0.85x..12.0x) — ZERO player teleportation!
 */

function countrysideBiomeColor(wx, wz, asl) {
  const rw = evalRegionWeights(wx, wz);
  // Subtle organic palette matching the 6 seamless non-mountainous landscapes
  let r = rw.valley * 58 + rw.hills * 76 + rw.plateau * 92 + rw.wetland * 52 + rw.meadow * 124 + rw.southPlain * 98;
  let g = rw.valley * 102 + rw.hills * 122 + rw.plateau * 114 + rw.wetland * 94 + rw.meadow * 126 + rw.southPlain * 116;
  let b = rw.valley * 64 + rw.hills * 66 + rw.plateau * 62 + rw.wetland * 82 + rw.meadow * 68 + rw.southPlain * 76;

  // Gentle hypsometric brightness lift across EL +90m .. +240m ASL
  const elevT = Math.max(0, Math.min(1, (asl - 95.0) / 145.0));
  r += elevT * 26;
  g += elevT * 24;
  b += elevT * 14;
  return [r, g, b];
}

/**
 * Pre-bake 1024×1024 North-Up Countryside GSI Relief Bitmap once (<45ms).
 */
function bakeCountrysideReliefBitmap(geomorph) {
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

  const lx = -0.62, ly = 0.64, lz = -0.45;

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
      const invL = 1.0 / Math.hypot(gx * 2.4, 1.0, gz * 2.4);
      const nx = -gx * 2.4 * invL, ny = invL, nz = -gz * 2.4 * invL;
      const shade = Math.max(0.45, Math.min(1.24, (nx * lx + ny * ly + nz * lz) * 0.85 + 0.48));
      const skyAO = 0.76 + 0.24 * (horizonRGBA[idx * 4 + 2] / 255.0);

      let [r, g, b] = countrysideBiomeColor(wx, wz, asl);
      r *= shade * skyAO;
      g *= shade * skyAO;
      b *= shade * skyAO;

      // Crisp 15m minor & 50m major countryside topographic contours
      const aslR = TERRENO_WORLD.baseElevationASL + heights[iz * W + ixR];
      const aslD = TERRENO_WORLD.baseElevationASL + heights[izD * W + ix];
      const maj0 = Math.floor(asl / 50.0);
      const isMajor = Math.floor(aslR / 50.0) !== maj0 || Math.floor(aslD / 50.0) !== maj0;
      const min0 = Math.floor(asl / 15.0);
      const isMinor = !isMajor && (Math.floor(aslR / 15.0) !== min0 || Math.floor(aslD / 15.0) !== min0);

      if (isMajor) {
        r = r * 0.56 + 44;
        g = g * 0.56 + 34;
        b = b * 0.56 + 22;
      } else if (isMinor) {
        r = r * 0.80 + 18;
        g = g * 0.80 + 14;
        b = b * 0.80 + 10;
      }

      const distRiv = Math.abs(wx - rv.x);
      const wetness = geoRGBA[idx * 4 + 1];
      if (distRiv < rv.halfWidth * 1.35) {
        r = 38; g = 148; b = 198;
      } else if (wetness > 0.74) {
        r = r * 0.52 + 32;
        g = g * 0.52 + 106;
        b = b * 0.52 + 144;
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

export function createTerrenoMap2D(geomorph, callbacks = {}) {
  const reliefCanvas = bakeCountrysideReliefBitmap(geomorph);

  let canvas = null;
  let containerEl = null;
  let lastState = null;
  let activeAutoVeh = 'camper'; // 'camper' (CAMPER-75) or 'armor' (ARMOR-155)
  let vehButtons = [];

  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let baseRect = { x: 0, y: 0, w: 1, h: 1 };

  function setSelectedVehicle(v) {
    activeAutoVeh = v === 'armor' ? 'armor' : 'camper';
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
    const padX = 18;
    const padY = 46;
    const availW = Math.max(120, CW - padX * 2);
    const availH = Math.max(120, CH - padY * 2);
    const side = Math.min(availW, availH);
    baseRect = {
      x: (CW - side) * 0.5,
      y: (CH - side) * 0.5,
      w: side,
      h: side,
    };
  }

  // World (wx, wz) -> Canvas pixel (px, py) (Standard North-Up: +X right, +Z down)
  function worldToPx(wx, wz) {
    const u = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width;
    const v = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth;
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
      x: Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, TERRENO_WORLD.minX + u * TERRENO_WORLD.width)),
      z: Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, TERRENO_WORLD.minZ + v * TERRENO_WORLD.depth)),
    };
  }

  function clampView() {
    zoom = Math.max(0.85, Math.min(12.0, zoom));
    if (!canvas) return;
    const maxPanX = canvas.width * 0.55 * zoom;
    const maxPanY = canvas.height * 0.55 * zoom;
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
      { id: 'dyn_armor', code: '装甲', kind: 'armor', x: state?.armorPose?.cx ?? 15.6, z: state?.armorPose?.cz ?? 4.0, color: '#10b981' },
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

    // Compact top-left bar: Autonomous Vehicle selector (RV自動 / 装甲自動) + quick destination chips
    const dynBar = document.createElement('div');
    dynBar.className = 'map2d-dyn-bar';

    vehButtons = [];
    [
      { key: 'camper', label: 'RV自動' },
      { key: 'armor', label: '装甲自動' },
    ].forEach((v) => {
      const vb = document.createElement('button');
      vb.type = 'button';
      vb.className = `map-pill-btn map2d-veh-btn${v.key === activeAutoVeh ? ' active' : ''}`;
      vb.dataset.vehKey = v.key;
      vb.textContent = v.label;
      vb.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedVehicle(v.key);
      });
      dynBar.appendChild(vb);
      vehButtons.push(vb);
    });

    DYNAMIC_TARGETS.forEach((dt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-pill-btn map2d-dyn-btn';
      btn.dataset.dynKind = dt.kind;
      btn.textContent = dt.code;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks.onSelectDynamicTarget) {
          callbacks.onSelectDynamicTarget(dt.kind, activeAutoVeh);
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

    // Smooth Multi-Touch 2-Finger Pinch Zoom + 1/2-Finger Pan + Free-Destination Tap Selection
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
          zoom = Math.max(0.85, Math.min(12.0, zoom * factor));
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
        const hitRad = 18 * dpr;

        // 1. Check 30 Waypoint Pins
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
          if (callbacks.onSelectWaypoint) callbacks.onSelectWaypoint(bestWp, activeAutoVeh);
          return;
        }

        // 2. Tap ANY free point on the 60 km × 60 km 2D map -> autonomous camper destination (ZERO player teleport!)
        const w = pxToWorld(px, py);
        if (w && callbacks.onSelectWorldPoint) {
          callbacks.onSelectWorldPoint(w.x, w.z, activeAutoVeh);
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
      zoom = Math.max(0.85, Math.min(12.0, zoom * (e.deltaY > 0 ? 0.86 : 1.16)));
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
    if (state?.selectedAutopilotVehicle && state.selectedAutopilotVehicle !== activeAutoVeh) {
      activeAutoVeh = state.selectedAutopilotVehicle;
      vehButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.vehKey === activeAutoVeh);
      });
    }
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

    // 1. Shaded 6-Biome Countryside Relief + Hillshade + 15m/50m Contour Bitmap
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(reliefCanvas, tl.px, tl.py, dw, dh);

    // 2. Dynamic Storm River Flood & Landslide Hazard Rings
    const floodRise = state?.floodRise || 0;
    if (floodRise > 0.3) {
      ctx.save();
      ctx.beginPath();
      for (let z = TERRENO_WORLD.minZ; z <= TERRENO_WORLD.maxZ; z += 400) {
        const rv = evalMainRiver(z);
        const p = worldToPx(rv.x, z);
        if (z === TERRENO_WORLD.minZ) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = `rgba(180, 128, 62, ${Math.min(0.68, 0.25 + floodRise * 0.06)})`;
      ctx.lineWidth = Math.max(2.5, (4.5 + floodRise * 1.8) * dpr * Math.sqrt(zoom));
      ctx.stroke();
      ctx.restore();
    }
    if (state?.activeLandslides && state.activeLandslides.length > 0) {
      ctx.save();
      state.activeLandslides.forEach((ls) => {
        const p = worldToPx(ls.x, ls.z);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.42)';
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.9)';
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5.0 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }

    // 3. Crisp 5 km Metric Grid across 60 km × 60 km
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.11)';
    ctx.lineWidth = 0.75 * dpr;
    for (let g = -25000; g <= 25000; g += 5000) {
      const ax = worldToPx(g, TERRENO_WORLD.minZ);
      const bx = worldToPx(g, TERRENO_WORLD.maxZ);
      ctx.beginPath(); ctx.moveTo(ax.px, ax.py); ctx.lineTo(bx.px, bx.py); ctx.stroke();
      const az = worldToPx(TERRENO_WORLD.minX, g);
      const bz = worldToPx(TERRENO_WORLD.maxX, g);
      ctx.beginPath(); ctx.moveTo(az.px, az.py); ctx.lineTo(bz.px, bz.py); ctx.stroke();
    }
    ctx.restore();

    // 4. ALL 21 Natural Terrain-Conforming Roads
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const roads = geomorph.roadPolylines || (geomorph.roadDense ? [{ pts: geomorph.roadDense }] : []);
    for (let rIdx = 0; rIdx < roads.length; rIdx++) {
      const pts = roads[rIdx].pts;
      if (!pts || pts.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = worldToPx(pts[i][0], pts[i][1]);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = rIdx === 0 ? 'rgba(254, 232, 152, 0.90)' : 'rgba(246, 214, 134, 0.74)';
      ctx.lineWidth = (rIdx === 0 ? 1.85 : 1.25) * dpr * Math.min(2.2, Math.sqrt(zoom));
      ctx.stroke();
    }
    ctx.restore();

    // 5. Active Computed A* Autonomous Route Paths (CAMPER-75 & ARMOR-155!)
    const drawRoute = (routePts, strokeCol, destLabel) => {
      if (!routePts || routePts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < routePts.length; i++) {
        const p = worldToPx(routePts[i][0], routePts[i][1]);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      }
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 3.0 * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Destination target pin
      const last = routePts[routePts.length - 1];
      const dp = worldToPx(last[0], last[1]);
      ctx.fillStyle = strokeCol;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8 * dpr;
      ctx.beginPath();
      ctx.arc(dp.px, dp.py, 6.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (destLabel) {
        ctx.font = `700 ${Math.round(8.5 * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(destLabel, dp.px, dp.py - 8.0 * dpr);
      }
      ctx.restore();
    };

    const routesByVeh = state?.autopilotRoutes || null;
    if (routesByVeh) {
      drawRoute(routesByVeh.camper, '#38bdf8', 'RV目的地');
      drawRoute(routesByVeh.armor, '#34d399', '装甲目的地');
    } else if (state?.autopilotRoute && state.autopilotRoute.length >= 2) {
      drawRoute(state.autopilotRoute, '#38bdf8', '目的地');
    }

    // 6. Suginosato 5-House Village Marker
    ctx.save();
    const vp = worldToPx(VILLAGE.centerX, VILLAGE.centerZ);
    ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath();
    ctx.arc(vp.px, vp.py, 8.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 7. 30 Numbered Selectable Waypoint Pins (01..30)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(7.8 * dpr)}px ui-monospace, monospace`;
    const activeWpId = state?.autopilotTargetId || null;
    AUTOPILOT_WAYPOINTS.forEach((wp) => {
      const p = worldToPx(wp.x, wp.z);
      const isActive = activeWpId === wp.id;
      const rad = (isActive ? 8.6 : 6.8) * dpr;
      ctx.fillStyle = isActive ? '#0ea5e9' : 'rgba(9, 15, 22, 0.80)';
      ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(245, 198, 92, 0.82)';
      ctx.lineWidth = (isActive ? 1.9 : 1.1) * dpr;
      ctx.beginPath();
      ctx.arc(p.px, p.py, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? '#ffffff' : '#fde68a';
      ctx.fillText(wp.num, p.px, p.py + 0.5 * dpr);
    });
    ctx.restore();

    // 8. Live Dynamic Asset Dots (自宅 / 軽 / 箱 / RV / 装甲)
    ctx.save();
    const assets = getDynamicAssetCoords(state);
    assets.forEach((a) => {
      const p = worldToPx(a.x, a.z);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = '#071018';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(p.px, p.py, 4.8 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();

    // 9. Live Player GPS Dot & Heading Cone (North-Up: Forward (-sin(yaw), -cos(yaw)) -> (dx, dy))
    const pxW = state?.x ?? 1.5;
    const pzW = state?.z ?? 3.5;
    const pYaw = state?.yaw ?? 0;
    const pp = worldToPx(pxW, pzW);
    ctx.save();
    const ang = Math.atan2(-Math.cos(pYaw), -Math.sin(pYaw));
    ctx.fillStyle = 'rgba(248, 113, 113, 0.36)';
    ctx.beginPath();
    ctx.moveTo(pp.px, pp.py);
    ctx.arc(pp.px, pp.py, 17 * dpr, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.7 * dpr;
    ctx.beginPath();
    ctx.arc(pp.px, pp.py, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Hairline perimeter frame + compact North compass mark
    ctx.strokeStyle = 'rgba(148, 184, 214, 0.40)';
    ctx.lineWidth = 1.1 * dpr;
    ctx.strokeRect(tl.px, tl.py, dw, dh);
  }

  return {
    mount,
    render,
    resetView,
    setSelectedVehicle,
    getSelectedVehicle: () => activeAutoVeh,
    reliefCanvas,
  };
}
