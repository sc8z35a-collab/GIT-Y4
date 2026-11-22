import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  TERRENO_LANDMARKS,
  evalMainRiver,
} from './terrenoConfig.js';

/**
 * TERRENO Engine — Breakthrough 9 (TR-SURVEY):
 * Interactive GSI-Style (国土地理院風) 2D Topographic Contour Map & Elevation Cross-Section
 * for the full 5,000m × 19,000m (95.0 km²) Mountain Watershed.
 *
 * Features:
 *   - Hypsometric elevation tinting + NW directional 3D hillshade + Sky-View gorge AO
 *   - Crisp 50m minor (主曲線) & 200m major (計曲線) topographic contour lines
 *   - 19 km Main River (黒杉川), 7 tributaries, & 19 km Graded Forestry Road (奥山林道)
 *   - 1 km UTM-style metric grid, named mountain peaks (▲), & 6 scenic landmarks
 *   - Live Player GPS dot + view-heading cone + Longitudinal 19km Elevation Profile
 *   - Click ANYWHERE on the 5km × 19km map (or any landmark card) to teleport immediately!
 */

function hypsometricColor(asl) {
  // Authentic Japanese GSI topographic hypsometric ramp (EL +260m .. +2,260m ASL)
  const stops = [
    [280,  34,  68,  52],
    [520,  46,  92,  60],
    [820,  72, 118,  66],
    [1160, 118, 138,  76],
    [1480, 164, 146,  98],
    [1820, 198, 178, 144],
    [2260, 238, 234, 226],
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
 * Bake the 512×1536 relief + hillshade + 50m/200m contours + river bitmap once (<40ms).
 */
function bakeReliefBitmap(geomorph) {
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

  // Classic NW cartographic light direction (-0.65, 0.58, -0.49)
  const lx = -0.64, ly = 0.60, lz = -0.48;

  for (let iz = 0; iz < H; iz++) {
    const wz = TERRENO_WORLD.minZ + (iz / (H - 1)) * TERRENO_WORLD.depth;
    const rv = evalMainRiver(wz);
    for (let ix = 0; ix < W; ix++) {
      const idx = iz * W + ix;
      const wx = TERRENO_WORLD.minX + (ix / (W - 1)) * TERRENO_WORLD.width;
      const h = heights[idx];
      const asl = TERRENO_WORLD.baseElevationASL + h;

      // Hillshade normal
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

      // Topographic Contour Detection (50m minor & 200m bold major isolines!)
      const hR = heights[iz * W + ixR];
      const hD = heights[izD * W + ix];
      const aslR = TERRENO_WORLD.baseElevationASL + hR;
      const aslD = TERRENO_WORLD.baseElevationASL + hD;

      const maj0 = Math.floor(asl / 200.0);
      const isMajor = Math.floor(aslR / 200.0) !== maj0 || Math.floor(aslD / 200.0) !== maj0;
      const min0 = Math.floor(asl / 50.0);
      const isMinor = !isMajor && (Math.floor(aslR / 50.0) !== min0 || Math.floor(aslD / 50.0) !== min0);

      if (isMajor) {
        r = r * 0.42 + 44;
        g = g * 0.42 + 30;
        b = b * 0.42 + 18;
      } else if (isMinor) {
        r = r * 0.72 + 24;
        g = g * 0.72 + 18;
        b = b * 0.72 + 12;
      }

      // River & High-Flow Blue Streams
      const distRiv = Math.abs(wx - rv.x);
      const wetness = geoRGBA[idx * 4 + 1];
      if (distRiv < rv.halfWidth * 1.15) {
        r = 34; g = 148; b = 198;
      } else if (wetness > 0.78 && asl < 1260) {
        r = r * 0.45 + 32;
        g = g * 0.45 + 110;
        b = b * 0.45 + 148;
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
 * Mount the interactive TERRENO 5km × 19km GSI Topographic Survey Map into a container DOM element.
 */
export function createTerrenoMap2D(geomorph, callbacks = {}) {
  const reliefCanvas = bakeReliefBitmap(geomorph);

  // Precompute 19km longitudinal profile (river bed vs max ridge elevation per Z slice)
  const profBins = 160;
  const profRiver = new Float32Array(profBins);
  const profPeak = new Float32Array(profBins);
  const profRoad = new Float32Array(profBins);
  for (let b = 0; b < profBins; b++) {
    const z = TERRENO_WORLD.minZ + (b / (profBins - 1)) * TERRENO_WORLD.depth;
    const iz = Math.round((b / (profBins - 1)) * (geomorph.H - 1));
    let maxH = -9999;
    for (let ix = 0; ix < geomorph.W; ix += 4) {
      const h = geomorph.heights[iz * geomorph.W + ix];
      if (h > maxH) maxH = h;
    }
    profPeak[b] = TERRENO_WORLD.baseElevationASL + maxH;
    profRiver[b] = TERRENO_WORLD.baseElevationASL + evalMainRiver(z).waterY;
    profRoad[b] = TERRENO_WORLD.baseElevationASL + geomorph.getHeightAt(evalMainRiver(z).x - 280, z);
  }

  let mapCanvas = null;
  let profileCanvas = null;
  let telemetryEl = null;
  let mapRect = { x: 0, y: 0, w: 1, h: 1 };

  function worldToMapPx(wx, wz) {
    const u = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width;
    const v = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth;
    return {
      px: mapRect.x + u * mapRect.w,
      py: mapRect.y + v * mapRect.h,
    };
  }

  function mapPxToWorld(px, py) {
    const u = (px - mapRect.x) / mapRect.w;
    const v = (py - mapRect.y) / mapRect.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return {
      x: Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, TERRENO_WORLD.minX + u * TERRENO_WORLD.width)),
      z: Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, TERRENO_WORLD.minZ + v * TERRENO_WORLD.depth)),
    };
  }

  function mount(containerEl) {
    containerEl.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'terreno-survey-root';

    root.innerHTML = `
      <div class="terreno-survey-left">
        <canvas class="terreno-map-canvas" width="460" height="820"></canvas>
      </div>
      <div class="terreno-survey-right">
        <div class="terreno-telemetry-strip" id="terreno-telemetry-grid"></div>
        <div class="terreno-landmarks-grid" id="terreno-landmarks-grid"></div>
        <div class="terreno-profile-wrap">
          <canvas class="terreno-profile-canvas" width="560" height="126"></canvas>
        </div>
      </div>
    `;
    containerEl.appendChild(root);

    mapCanvas = root.querySelector('.terreno-map-canvas');
    profileCanvas = root.querySelector('.terreno-profile-canvas');
    telemetryEl = root.querySelector('#terreno-telemetry-grid');

    // Minimalist Landmark Teleport Grid (NO verbose descriptions, NO Time-of-Day switcher!)
    const lmGrid = root.querySelector('#terreno-landmarks-grid');
    TERRENO_LANDMARKS.forEach((lm) => {
      const y = geomorph.getHeightAt(lm.x, lm.z);
      const asl = Math.round(TERRENO_WORLD.baseElevationASL + y);
      const shortName = lm.nameJp.split('・')[0].replace('母屋 ', '').replace(' 拠点', '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'terreno-lm-btn';
      btn.innerHTML = `
        <span class="terreno-lm-code">${lm.code}</span>
        <span class="terreno-lm-name">${shortName}</span>
        <span class="terreno-lm-asl">+${asl}m</span>
      `;
      btn.addEventListener('click', () => {
        if (callbacks.onTeleportLandmark) callbacks.onTeleportLandmark(lm.id);
      });
      lmGrid.appendChild(btn);
    });

    // Tap anywhere on 5×19km map to teleport
    mapCanvas.addEventListener('click', (ev) => {
      const rect = mapCanvas.getBoundingClientRect();
      const scaleX = mapCanvas.width / rect.width;
      const scaleY = mapCanvas.height / rect.height;
      const px = (ev.clientX - rect.left) * scaleX;
      const py = (ev.clientY - rect.top) * scaleY;
      const world = mapPxToWorld(px, py);
      if (world && callbacks.onTeleportWorld) {
        callbacks.onTeleportWorld(world.x, world.z);
      }
    });
  }

  function render(playerState) {
    if (!mapCanvas || !profileCanvas) return;

    const ctx = mapCanvas.getContext('2d');
    const CW = mapCanvas.width;
    const CH = mapCanvas.height;

    ctx.fillStyle = '#091017';
    ctx.fillRect(0, 0, CW, CH);

    // Frame the 5km × 19km map with neat GSI cartographic margin for km labels
    const padL = 46, padR = 16, padT = 24, padB = 28;
    const availW = CW - padL - padR;
    const availH = CH - padT - padB;
    // Aspect ratio 5:19 (~0.263) -> fill height and center nicely, slightly wider readability (0.40) so peaks/roads read super clearly!
    const drawH = availH;
    const drawW = Math.min(availW, Math.round(drawH * 0.44));
    const ox = padL + Math.round((availW - drawW) * 0.5);
    const oy = padT;
    mapRect = { x: ox, y: oy, w: drawW, h: drawH };

    // 1. Draw pre-baked Hypsometric + Hillshade + 50m/200m Contour Bitmap
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(reliefCanvas, ox, oy, drawW, drawH);

    // 2. 2 km / 4 km Metric Grid Lines & Labels for 15km × 40km
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8;
    ctx.fillStyle = '#9db4c8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let x = -6000; x <= 6000; x += 3000) {
      const p = worldToMapPx(x, TERRENO_WORLD.minZ);
      ctx.beginPath();
      ctx.moveTo(p.px, oy);
      ctx.lineTo(p.px, oy + drawH);
      ctx.stroke();
      ctx.fillText(`${x >= 0 ? '+' : ''}${x / 1000}k`, p.px, oy + drawH + 14);
    }
    ctx.textAlign = 'right';
    for (let z = -12000; z <= 24000; z += 4000) {
      const p = worldToMapPx(TERRENO_WORLD.minX, z);
      ctx.beginPath();
      ctx.moveTo(ox, p.py);
      ctx.lineTo(ox + drawW, p.py);
      ctx.stroke();
      ctx.fillText(`${z >= 0 ? '+' : ''}${z / 1000}km`, ox - 5, p.py + 3);
    }
    ctx.restore();

    // 3. Draw 40 km Graded Forestry Road (奥山林道) dashed line
    ctx.save();
    ctx.beginPath();
    const rd = geomorph.roadDense;
    for (let i = 0; i < rd.length; i++) {
      const p = worldToMapPx(rd[i][0], rd[i][1]);
      if (i === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    }
    ctx.strokeStyle = 'rgba(255, 224, 150, 0.90)';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Draw Named Mountain Peaks (▲)
    ctx.save();
    ctx.font = 'bold 9.5px sans-serif';
    MOUNTAIN_PEAKS.forEach((pk) => {
      const p = worldToMapPx(pk.x, pk.z);
      const asl = Math.round(TERRENO_WORLD.baseElevationASL + geomorph.getHeightAt(pk.x, pk.z));
      ctx.fillStyle = '#ffe9b8';
      ctx.beginPath();
      ctx.moveTo(p.px, p.py - 4.5);
      ctx.lineTo(p.px - 4.0, p.py + 3.0);
      ctx.lineTo(p.px + 4.0, p.py + 3.0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1b1610';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.textAlign = pk.x > 0 ? 'right' : 'left';
      const tx = pk.x > 0 ? p.px - 6 : p.px + 6;
      ctx.fillStyle = 'rgba(7,12,18,0.75)';
      ctx.fillText(`${pk.nameJp} ${asl}m`, tx + 1, p.py + 4);
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(`${pk.nameJp} ${asl}m`, tx, p.py + 3);
    });
    ctx.restore();

    // 5. Draw 8 Curated Landmarks (including Suginosato 5-House Village!)
    ctx.save();
    TERRENO_LANDMARKS.forEach((lm) => {
      const p = worldToMapPx(lm.x, lm.z);
      const isBase = lm.id === 'compound';
      const isVillage = lm.id === 'village';
      ctx.fillStyle = isBase ? '#38bdf8' : (isVillage ? '#34d399' : '#f59e0b');
      ctx.strokeStyle = '#071018';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.px, p.py, isBase || isVillage ? 5.2 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = lm.x > 1200 ? 'right' : 'left';
      const offX = lm.x > 1200 ? -7 : 7;
      ctx.fillStyle = '#071018';
      ctx.fillText(lm.code, p.px + offX + 1, p.py + 3);
      ctx.fillStyle = isBase ? '#7dd3fc' : (isVillage ? '#6ee7b7' : '#fde68a');
      ctx.fillText(lm.code, p.px + offX, p.py + 2);
    });
    ctx.restore();

    // 6. Live Player GPS Marker + View Cone
    const pxW = playerState?.x ?? 1.5;
    const pzW = playerState?.z ?? 3.5;
    const pYaw = playerState?.yaw ?? 0;
    const pp = worldToMapPx(pxW, pzW);
    ctx.save();
    const dirX = -Math.sin(pYaw);
    const dirY = -Math.cos(pYaw);
    const ang = Math.atan2(dirY, dirX);
    ctx.fillStyle = 'rgba(248, 113, 113, 0.34)';
    ctx.beginPath();
    ctx.moveTo(pp.px, pp.py);
    ctx.arc(pp.px, pp.py, 22, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(pp.px, pp.py, 5.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Map border + minimal North marker
    ctx.strokeStyle = 'rgba(148, 184, 214, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(ox, oy, drawW, drawH);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N ▲', ox, oy - 7);
    ctx.textAlign = 'right';
    ctx.fillText('15×40km', ox + drawW, oy - 7);

    // ---- Render 40 km Longitudinal Elevation Profile ----
    const pCtx = profileCanvas.getContext('2d');
    const PW = profileCanvas.width;
    const PH = profileCanvas.height;
    pCtx.fillStyle = '#0b131c';
    pCtx.fillRect(0, 0, PW, PH);

    const pL = 42, pR = 12, pT = 10, pB = 18;
    const gW = PW - pL - pR;
    const gH = PH - pT - pB;
    const elevMin = 250, elevMax = 2350;
    const eToY = (e) => pT + gH * (1.0 - (e - elevMin) / (elevMax - elevMin));

    pCtx.strokeStyle = 'rgba(148, 184, 214, 0.16)';
    pCtx.fillStyle = '#8fa9bf';
    pCtx.font = '10px "JetBrains Mono", monospace';
    pCtx.textAlign = 'right';
    [400, 1000, 1600, 2200].forEach((e) => {
      const y = eToY(e);
      pCtx.beginPath();
      pCtx.moveTo(pL, y);
      pCtx.lineTo(pL + gW, y);
      pCtx.stroke();
      pCtx.fillText(`${e}m`, pL - 5, y + 3);
    });

    pCtx.beginPath();
    pCtx.moveTo(pL, pT + gH);
    for (let b = 0; b < profBins; b++) {
      const x = pL + (b / (profBins - 1)) * gW;
      pCtx.lineTo(x, eToY(profPeak[b]));
    }
    pCtx.lineTo(pL + gW, pT + gH);
    pCtx.closePath();
    const grad = pCtx.createLinearGradient(0, pT, 0, pT + gH);
    grad.addColorStop(0, 'rgba(198, 178, 138, 0.52)');
    grad.addColorStop(0.55, 'rgba(72, 132, 82, 0.45)');
    grad.addColorStop(1, 'rgba(26, 62, 54, 0.35)');
    pCtx.fillStyle = grad;
    pCtx.fill();
    pCtx.strokeStyle = '#d4c298';
    pCtx.lineWidth = 1.4;
    pCtx.stroke();

    pCtx.beginPath();
    for (let b = 0; b < profBins; b++) {
      const x = pL + (b / (profBins - 1)) * gW;
      const y = eToY(profRiver[b]);
      if (b === 0) pCtx.moveTo(x, y);
      else pCtx.lineTo(x, y);
    }
    pCtx.strokeStyle = '#38bdf8';
    pCtx.lineWidth = 1.8;
    pCtx.stroke();

    const playerBiome = geomorph.getBiomeInfoAt(pxW, pzW);
    const ptX = pL + ((pzW - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth) * gW;
    const ptY = eToY(playerBiome.asl);
    pCtx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    pCtx.moveTo(ptX, pT);
    pCtx.lineTo(ptX, pT + gH);
    pCtx.stroke();
    pCtx.fillStyle = '#ef4444';
    pCtx.beginPath();
    pCtx.arc(ptX, ptY, 4.2, 0, Math.PI * 2);
    pCtx.fill();

    pCtx.fillStyle = '#9db4c8';
    pCtx.textAlign = 'center';
    pCtx.fillText('-14km', pL + 22, PH - 4);
    pCtx.fillText('BASE', pL + ((0 - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth) * gW, PH - 4);
    pCtx.fillText('+26km', pL + gW - 24, PH - 4);

    if (telemetryEl) {
      const distBaseKm = (Math.hypot(pxW - TERRENO_WORLD.compoundCenterX, pzW - TERRENO_WORLD.compoundCenterZ) / 1000).toFixed(2);
      const slopeDeg = Math.round((Math.atan(playerBiome.slope) * 180) / Math.PI);
      telemetryEl.innerHTML = `
        <div><span>標高</span><strong>+${Math.round(playerBiome.asl)}m</strong></div>
        <div><span>勾配</span><strong>${slopeDeg}°</strong></div>
        <div><span>距離</span><strong>${distBaseKm}km</strong></div>
        <div><span>植生</span><strong>${playerBiome.zoneJp}</strong></div>
      `;
    }
  }

  return {
    mount,
    render,
    reliefCanvas,
  };
}
