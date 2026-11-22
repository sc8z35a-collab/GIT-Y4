import { HOUSE, BLUEPRINT_SHEETS } from './planData.js';
import { FirstPersonHouseExplorer } from './scene3d.js';
import { ArchitecturalBlueprint2D } from './blueprint2d.js';

const STORAGE_SENS_KEY = 'narrow50_cam_sens';
const STORAGE_SM11S_KEY = 'narrow50_sm11s';

const canvas3dEl = document.getElementById('canvas-3d');
const webglErrorEl = document.getElementById('webgl-error');
const webglErrorMsgEl = document.getElementById('webgl-error-msg');
const hudTopEl = document.getElementById('hud-top');
const touchLayerEl = document.getElementById('touch-layer');
const reticleEl = document.getElementById('reticle');
const interactPromptEl = document.getElementById('interact-prompt');
const interactLabelEl = document.getElementById('interact-label');

const btnMap = document.getElementById('btn-map');
const btnSettings = document.getElementById('btn-settings');
const settingsSheet = document.getElementById('settings-sheet');
const btnCloseSettings = document.getElementById('btn-close-settings');
const inputSens = document.getElementById('input-sens');
const sensValEl = document.getElementById('sens-val');
const toggleSm11s = document.getElementById('toggle-sm11s');
const toggleStorm = document.getElementById('toggle-storm');
const toggleLight = document.getElementById('toggle-light');
const toggleAudio = document.getElementById('toggle-audio');
const togglePerfCb = document.getElementById('toggle-perf');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnDriveExitSettings = document.getElementById('btn-drive-exit-settings');
const btnInstall = document.getElementById('btn-install');
const btnEnterLandscape = document.getElementById('btn-enter-landscape');

const perfPanel = document.getElementById('perf-panel');
const perfGrid = document.getElementById('perf-grid');

const driveHudEl = document.getElementById('drive-hud');
const driveSpeedValEl = document.getElementById('drive-speed-val');

const mobileActionsEl = document.getElementById('mobile-actions');
const mobCrouch = document.getElementById('mob-crouch');

const mapModal = document.getElementById('map-modal');
const map3dGestureLayer = document.getElementById('map3d-gesture-layer');
const terreno2dPanel = document.getElementById('terreno-2d-panel');
const map3dControls = document.getElementById('map3d-controls');
const btnMap3dFocus = document.getElementById('btn-map3d-focus');
const btnMap3dOrbit = document.getElementById('btn-map3d-orbit');
const cadMapBody = document.getElementById('cad-map-body');
const blueprintViewport = document.getElementById('blueprint-viewport');
const bpToolsGroup = document.getElementById('bp-tools-group');
const btnExportSvg = document.getElementById('btn-export-svg');
const btnExportAllSvg = document.getElementById('btn-export-all-svg');
const btnExportAllZip = document.getElementById('btn-export-all-zip');
const blueprintMount = document.getElementById('blueprint-mount');

let mapVisible = false;
let settingsVisible = false;
let perfVisible = false;
let isDriving = false;
let activeSheetIdx = 30; // 30 = Full-Screen 3D Map, 31 = Authentic 2D Route Map, 0..22 = 23 CAD Blueprints
let map3dOrbitMode = false;
let terrenoMap2d = null;
let bpScale = 1.0;
let bpPanX = 0;
let bpPanY = 0;
let lastPose = { floor: HOUSE.spawnFloor, sheetIndex: 4, floorCode: '1F', x: 1.62, z: 6.25, yaw: Math.PI, todId: 'day', dx: 0, dz: 1 };

// ---- Service Worker Registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

// ---- Automatic Mobile Landscape Fullscreen Controller (POCO F7) ----
const isTouchDevice = () =>
  window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function isFullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

async function enterLandscapeFullscreen() {
  try {
    if (!isFullscreenActive()) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    }
  } catch (_) {}
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) {}
  syncFullscreenUi();
}

async function toggleFullscreen() {
  if (isFullscreenActive()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (_) {}
  } else {
    await enterLandscapeFullscreen();
  }
  syncFullscreenUi();
}

function syncFullscreenUi() {
  if (btnFullscreen) {
    btnFullscreen.classList.toggle('active', isFullscreenActive());
  }
}

document.addEventListener('fullscreenchange', syncFullscreenUi);
document.addEventListener('webkitfullscreenchange', syncFullscreenUi);

let autoFsAttempted = false;
function tryAutoMobileFullscreen() {
  if (autoFsAttempted || !isTouchDevice()) return;
  autoFsAttempted = true;
  enterLandscapeFullscreen();
}
window.addEventListener('pointerdown', tryAutoMobileFullscreen, { passive: true });
window.addEventListener('touchstart', tryAutoMobileFullscreen, { passive: true });
if (btnEnterLandscape) {
  btnEnterLandscape.addEventListener('click', () => enterLandscapeFullscreen());
}

// ---- PWA Install Prompt (Inside Settings) ----
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  btnInstall.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  btnInstall.classList.add('hidden');
});
btnInstall.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch (_) {}
  deferredInstallPrompt = null;
  btnInstall.classList.add('hidden');
});

// ---- CAD Blueprint 2D Controller + Silky 2-Finger Multi-Touch Pinch Zoom-Out/In & Omnidirectional Pan ----
const blueprint = new ArchitecturalBlueprint2D(blueprintMount, {});

function clampBlueprintPan() {
  const rect = blueprintViewport.getBoundingClientRect();
  const vw = rect.width || window.innerWidth || 924;
  const vh = rect.height || window.innerHeight || 427;
  // Generous omnidirectional freedom whether zoomed out (0.35x) or deeply zoomed in (5.0x)
  const maxPanX = Math.max(vw * 0.85, vw * bpScale * 0.78);
  const maxPanY = Math.max(vh * 0.85, vh * bpScale * 0.78);
  bpPanX = Math.max(-maxPanX, Math.min(maxPanX, bpPanX));
  bpPanY = Math.max(-maxPanY, Math.min(maxPanY, bpPanY));
}

function applyBlueprintTransform() {
  bpScale = Math.max(0.35, Math.min(5.0, bpScale));
  clampBlueprintPan();
  blueprintMount.style.transform = `translate3d(${bpPanX.toFixed(2)}px, ${bpPanY.toFixed(2)}px, 0) scale(${bpScale.toFixed(4)})`;
}

function setBlueprintView(scale = 1.0, panX = 0, panY = 0) {
  bpScale = Number(scale) || 1.0;
  bpPanX = Number(panX) || 0;
  bpPanY = Number(panY) || 0;
  applyBlueprintTransform();
  return getBlueprintViewState();
}

function getBlueprintViewState() {
  return { scale: Number(bpScale.toFixed(3)), panX: Number(bpPanX.toFixed(1)), panY: Number(bpPanY.toFixed(1)) };
}

function zoomBlueprintAtPoint(factor, clientX = null, clientY = null) {
  const rect = blueprintViewport.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const rx = clientX !== null ? (clientX - cx) : 0;
  const ry = clientY !== null ? (clientY - cy) : 0;
  const oldScale = bpScale;
  const nextScale = Math.max(0.35, Math.min(5.0, oldScale * factor));
  const u = (rx - bpPanX) / oldScale;
  const v = (ry - bpPanY) / oldScale;
  bpScale = nextScale;
  bpPanX = rx - u * nextScale;
  bpPanY = ry - v * nextScale;
  applyBlueprintTransform();
}

document.getElementById('btn-zoom-in').addEventListener('click', () => zoomBlueprintAtPoint(1.30));
document.getElementById('btn-zoom-out').addEventListener('click', () => zoomBlueprintAtPoint(1 / 1.30));

// Multi-Touch 2-Finger Pinch Zoom-Out/In + 1/2-Finger Omnidirectional Pan + Double-Tap Reset
const bpPointers = new Map();
let bpPrevDist = 0;
let bpPrevMidX = 0;
let bpPrevMidY = 0;
let bpDragMoved = 0;
let bpHadMulti = false;
let bpLastTapTime = 0;
let bpLastTapX = 0;
let bpLastTapY = 0;

blueprintViewport.addEventListener('pointerdown', (e) => {
  if (!mapVisible || activeSheetIdx >= 30) return;
  try { blueprintViewport.setPointerCapture(e.pointerId); } catch (_) {}
  bpPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (bpPointers.size === 1) {
    bpDragMoved = 0;
    bpHadMulti = false;
  } else if (bpPointers.size === 2) {
    bpHadMulti = true;
    const pts = Array.from(bpPointers.values());
    bpPrevDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    bpPrevMidX = (pts[0].x + pts[1].x) * 0.5;
    bpPrevMidY = (pts[0].y + pts[1].y) * 0.5;
  }
});

blueprintViewport.addEventListener('pointermove', (e) => {
  if (!bpPointers.has(e.pointerId) || !mapVisible || activeSheetIdx >= 30) return;
  const prev = bpPointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  bpPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (bpPointers.size === 1 && !bpHadMulti) {
    bpDragMoved += Math.hypot(dx, dy);
    bpPanX += dx;
    bpPanY += dy;
    applyBlueprintTransform();
  } else if (bpPointers.size >= 2) {
    const pts = Array.from(bpPointers.values());
    const p0 = pts[0];
    const p1 = pts[1];
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const midX = (p0.x + p1.x) * 0.5;
    const midY = (p0.y + p1.y) * 0.5;

    const rect = blueprintViewport.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const rxOld = bpPrevMidX - cx;
    const ryOld = bpPrevMidY - cy;
    const rxNew = midX - cx;
    const ryNew = midY - cy;

    const oldScale = bpScale;
    let nextScale = oldScale;
    if (bpPrevDist > 10 && dist > 10) {
      nextScale = Math.max(0.35, Math.min(5.0, oldScale * (dist / bpPrevDist)));
    }
    // Simultaneous anchor-preserving pinch zoom + omnidirectional 2-finger pan!
    const u = (rxOld - bpPanX) / oldScale;
    const v = (ryOld - bpPanY) / oldScale;
    bpScale = nextScale;
    bpPanX = rxNew - u * nextScale;
    bpPanY = ryNew - v * nextScale;
    applyBlueprintTransform();

    bpPrevDist = dist;
    bpPrevMidX = midX;
    bpPrevMidY = midY;
  }
});

function releaseBpPointer(e) {
  if (!bpPointers.has(e.pointerId)) return;
  const wasQuickTap = bpPointers.size === 1 && !bpHadMulti && bpDragMoved < 8;
  bpPointers.delete(e.pointerId);
  if (bpPointers.size === 1) {
    const rem = Array.from(bpPointers.values())[0];
    bpPrevMidX = rem.x;
    bpPrevMidY = rem.y;
  } else if (bpPointers.size === 0) {
    bpHadMulti = false;
    if (wasQuickTap) {
      const now = performance.now();
      if (now - bpLastTapTime < 320 && Math.hypot(e.clientX - bpLastTapX, e.clientY - bpLastTapY) < 28) {
        setBlueprintView(1.0, 0, 0);
        bpLastTapTime = 0;
      } else {
        bpLastTapTime = now;
        bpLastTapX = e.clientX;
        bpLastTapY = e.clientY;
      }
    }
  }
}

blueprintViewport.addEventListener('pointerup', releaseBpPointer);
blueprintViewport.addEventListener('pointercancel', releaseBpPointer);
blueprintViewport.addEventListener('dblclick', () => setBlueprintView(1.0, 0, 0));
blueprintViewport.addEventListener('wheel', (e) => {
  if (!mapVisible || activeSheetIdx >= 30) return;
  e.preventDefault();
  zoomBlueprintAtPoint(e.deltaY > 0 ? 0.88 : 1.14, e.clientX, e.clientY);
}, { passive: false });

// ---- Authentic 2D Topographic & 30-Waypoint Silent Autopilot Map Mount ----
function ensureMap2D() {
  if (terrenoMap2d || !explorer || !explorer.terreno) return terrenoMap2d;
  terrenoMap2d = explorer.terreno.getOrCreateMap2D({
    onSelectWaypoint: (wp) => {
      if (!explorer || !wp) return;
      explorer.startArmorAutopilotTo(wp.x, wp.z, wp.id);
      toggleMap(false);
    },
    onSelectDynamicTarget: (kind) => {
      if (!explorer || !kind) return;
      explorer.startArmorAutopilotToDynamic(kind);
      toggleMap(false);
    },
    onSelectWorldPoint: (wx, wz) => {
      if (!explorer) return;
      explorer.startArmorAutopilotTo(wx, wz, 'custom');
      toggleMap(false);
    },
  });
  terrenoMap2d.mount(terreno2dPanel);
  return terrenoMap2d;
}

function selectBlueprintFloor(sheetIdx) {
  const numIdx = Number(sheetIdx);
  const is3DMap = numIdx === 30;
  const is2DMap = numIdx === 31;
  activeSheetIdx = is3DMap ? 30 : (is2DMap ? 31 : Math.max(0, Math.min(BLUEPRINT_SHEETS.length - 1, numIdx || 0)));

  document.querySelectorAll('#bp-floor-tabs .floor-tab').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.floor) === activeSheetIdx);
  });

  mapModal.classList.toggle('mode-3d', is3DMap);
  mapModal.classList.toggle('mode-2d', is2DMap);
  map3dGestureLayer.classList.toggle('hidden', !is3DMap);
  map3dControls.classList.toggle('hidden', !is3DMap);
  terreno2dPanel.classList.toggle('hidden', !is2DMap);
  cadMapBody.classList.toggle('hidden', is3DMap || is2DMap);
  bpToolsGroup.classList.toggle('hidden', is3DMap || is2DMap);

  if (explorer) {
    explorer.setMap3DMode(mapVisible && is3DMap);
  }

  if (is2DMap) {
    const m2d = ensureMap2D();
    if (m2d && lastPose) {
      requestAnimationFrame(() => m2d.render(lastPose));
    }
  } else if (!is3DMap) {
    setBlueprintView(1.0, 0, 0);
    blueprint.setFloor(activeSheetIdx);
    if (lastPose) blueprint.updateCameraPose(lastPose);
  }
}

document.querySelectorAll('#bp-floor-tabs .floor-tab').forEach((btn) => {
  btn.addEventListener('click', () => selectBlueprintFloor(Number(btn.dataset.floor)));
});

function syncGameplayOverlayVisibility() {
  const hideGameplay = mapVisible;
  hudTopEl.classList.toggle('hidden', hideGameplay);
  touchLayerEl.classList.toggle('hidden', hideGameplay);
  reticleEl.classList.toggle('hidden', hideGameplay);
  if (hideGameplay) {
    interactPromptEl.classList.add('hidden');
    mobileActionsEl.classList.add('hidden');
    driveHudEl.classList.add('hidden');
  } else {
    driveHudEl.classList.toggle('hidden', !isDriving);
    mobileActionsEl.classList.toggle('hidden', isDriving);
  }
}

function toggleSettings(force = null) {
  settingsVisible = force !== null ? force : !settingsVisible;
  settingsSheet.classList.toggle('hidden', !settingsVisible);
  btnSettings.classList.toggle('active', settingsVisible);
  if (settingsVisible && mapVisible) toggleMap(false);
}

function toggleMap(force = null) {
  mapVisible = force !== null ? force : !mapVisible;
  mapModal.classList.toggle('hidden', !mapVisible);
  btnMap.classList.toggle('active', mapVisible);
  if (mapVisible) {
    if (settingsVisible) toggleSettings(false);
    if (explorer) explorer.setMapOpen(true);
    // Open into the High-Precision Full-Screen 3D Topographic Map (user can switch to 2D or any of 23 CAD sheets)
    selectBlueprintFloor(activeSheetIdx === 31 ? 31 : 30);
  } else {
    if (explorer) {
      explorer.setMap3DMode(false);
      explorer.setMapOpen(false);
    }
  }
  syncGameplayOverlayVisibility();
}

function renderTelemetry(t) {
  perfGrid.innerHTML = `
    <span><strong>${t.fps}</strong>fps</span>
    <span><strong>${t.frameMs}</strong>ms</span>
    <span><strong>${t.scale}×</strong>${t.surfaceSuper ? ' SM1.1S' : ''}</span>
    <span>DC<strong>${t.drawCalls}</strong></span>
  `;
}

function togglePerf(force = null) {
  perfVisible = force !== null ? force : !perfVisible;
  perfPanel.classList.toggle('hidden', !perfVisible);
  if (togglePerfCb) togglePerfCb.checked = perfVisible;
  if (perfVisible && explorer && explorer.adaptive) {
    renderTelemetry({
      ...explorer.adaptive.getTelemetry(),
      batch: explorer.house.batchStats,
      terreno: explorer.terreno ? explorer.terreno.getStats() : null,
    });
  }
}

function updateDriveHUD(driving, state = {}) {
  isDriving = driving;
  if (!mapVisible) {
    // STRICTLY identical minimal speed pill in both manual and autonomous driving — ZERO extra indicators!
    driveHudEl.classList.toggle('hidden', !driving);
    mobileActionsEl.classList.toggle('hidden', driving);
  }
  btnDriveExitSettings.classList.toggle('hidden', !driving);
  if (driving) {
    driveSpeedValEl.textContent = String(state.speedKmh ?? 0);
    if (toggleLight) toggleLight.checked = Boolean(state.headlightsOn);
  } else {
    if (toggleLight && explorer) toggleLight.checked = Boolean(explorer.flashlightOn);
  }
}

// ---- Initialize 3D Explorer ----
let explorer = null;
try {
  explorer = new FirstPersonHouseExplorer(canvas3dEl, {
    onPoseUpdate: (pose) => {
      lastPose = pose;
      if (mapVisible) {
        if (activeSheetIdx === 31 && terrenoMap2d) {
          terrenoMap2d.render(pose);
        } else if (activeSheetIdx < 30) {
          blueprint.updateCameraPose(pose);
        }
      }
    },
    onAimChange: (aim) => {
      if (isDriving || mapVisible) {
        reticleEl.classList.remove('aiming');
        interactPromptEl.classList.add('hidden');
        return;
      }
      const active = Boolean(aim);
      reticleEl.classList.toggle('aiming', active);
      interactPromptEl.classList.toggle('hidden', !active);
      if (aim) {
        interactLabelEl.textContent = aim.prompt;
      }
    },
    onDriveChange: (driving, state) => updateDriveHUD(driving, state),
    onFlashlightChange: (on) => {
      if (!isDriving && toggleLight) toggleLight.checked = Boolean(on);
    },
    onCrouchChange: (crouching) => {
      mobCrouch.classList.toggle('active', crouching);
    },
    onAudioChange: (active) => {
      if (toggleAudio) toggleAudio.checked = Boolean(active);
    },
    onSurfaceSuperChange: (on) => {
      if (toggleSm11s) toggleSm11s.checked = Boolean(on);
    },
    onStormChange: (on) => {
      if (toggleStorm) toggleStorm.checked = Boolean(on);
    },
    onToggleMap: () => toggleMap(),
    onToggleTelemetry: () => togglePerf(),
    onTelemetry: (t) => {
      if (perfVisible) renderTelemetry(t);
    },
  });
} catch (err) {
  webglErrorEl.classList.remove('hidden');
  webglErrorMsgEl.textContent = String(err?.message || err);
}

// ---- Restore Persisted Settings (Camera Sensitivity & SM1.1S) ----
function applySensitivity(val, persist = true) {
  const clamped = explorer ? explorer.setCameraSensitivity(val) : Math.max(0.2, Math.min(3.0, Number(val) || 1.0));
  inputSens.value = String(clamped);
  sensValEl.textContent = `${clamped.toFixed(1)}×`;
  if (persist) {
    try { localStorage.setItem(STORAGE_SENS_KEY, String(clamped)); } catch (_) {}
  }
}

function applySm11s(enabled, persist = true) {
  const on = Boolean(enabled);
  toggleSm11s.checked = on;
  if (explorer) explorer.setSurfaceSuper(on);
  if (persist) {
    try { localStorage.setItem(STORAGE_SM11S_KEY, on ? '1' : '0'); } catch (_) {}
  }
}

function applyStorm(enabled, instant = false) {
  const on = Boolean(enabled);
  if (toggleStorm) toggleStorm.checked = on;
  if (explorer) explorer.setStormEnabled(on, instant);
}

try {
  const savedSens = localStorage.getItem(STORAGE_SENS_KEY);
  if (savedSens !== null) applySensitivity(Number(savedSens), false);
  const savedSm11s = localStorage.getItem(STORAGE_SM11S_KEY);
  if (savedSm11s === '1') applySm11s(true, false);
} catch (_) {}

// ---- Wire HUD & Settings Events ----
btnMap.addEventListener('click', () => toggleMap());
document.getElementById('btn-close-map').addEventListener('click', () => toggleMap(false));
btnSettings.addEventListener('click', () => toggleSettings());
btnCloseSettings.addEventListener('click', () => toggleSettings(false));

inputSens.addEventListener('input', () => applySensitivity(Number(inputSens.value), true));
toggleSm11s.addEventListener('change', () => applySm11s(toggleSm11s.checked, true));
if (toggleStorm) {
  toggleStorm.addEventListener('change', () => applyStorm(toggleStorm.checked, false));
}
toggleLight.addEventListener('change', () => {
  if (!explorer) return;
  if (isDriving) explorer.toggleVehicleHeadlights(toggleLight.checked);
  else explorer.toggleFlashlight(toggleLight.checked);
});
toggleAudio.addEventListener('change', () => {
  if (!explorer) return;
  const active = explorer.toggleAudio();
  toggleAudio.checked = active;
});
togglePerfCb.addEventListener('change', () => togglePerf(togglePerfCb.checked));
btnFullscreen.addEventListener('click', () => toggleFullscreen());
btnDriveExitSettings.addEventListener('click', () => {
  if (explorer && isDriving) {
    explorer.interact();
    toggleSettings(false);
  }
});

driveHudEl.addEventListener('click', () => {
  if (explorer && isDriving) explorer.interact();
});
interactPromptEl.addEventListener('click', () => explorer && explorer.interact());
mobCrouch.addEventListener('click', () => explorer && !isDriving && explorer.toggleCrouch());

// ---- High-Precision 3D Map Touch / Mouse Orbit, Pan, Pinch-Zoom & Tap-to-Teleport ----
btnMap3dFocus.addEventListener('click', () => {
  if (!explorer || !explorer.map3d) return;
  const focused = explorer.map3d.toggleFocusMode();
  btnMap3dFocus.classList.toggle('active', focused);
});

btnMap3dOrbit.addEventListener('click', () => {
  map3dOrbitMode = !map3dOrbitMode;
  btnMap3dOrbit.classList.toggle('active', map3dOrbitMode);
});

const mapPointers = new Map();
let mapSingleMoved = 0;
let mapHadMultiTouch = false;
let mapDragIsOrbit = false;
let mapPrevPinchDist = 0;
let mapPrevPinchAngle = 0;
let mapPrevPinchMidY = 0;

map3dGestureLayer.addEventListener('contextmenu', (e) => e.preventDefault());

map3dGestureLayer.addEventListener('pointerdown', (e) => {
  if (!mapVisible || activeSheetIdx !== 30 || !explorer || !explorer.map3d) return;
  try { map3dGestureLayer.setPointerCapture(e.pointerId); } catch (_) {}
  mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (mapPointers.size === 1) {
    mapSingleMoved = 0;
    mapHadMultiTouch = false;
    mapDragIsOrbit = map3dOrbitMode || e.button === 2 || e.shiftKey;
  } else if (mapPointers.size === 2) {
    mapHadMultiTouch = true;
    const pts = Array.from(mapPointers.values());
    mapPrevPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    mapPrevPinchAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    mapPrevPinchMidY = (pts[0].y + pts[1].y) * 0.5;
  }
});

map3dGestureLayer.addEventListener('pointermove', (e) => {
  if (!mapPointers.has(e.pointerId) || !explorer || !explorer.map3d) return;
  const prev = mapPointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (mapPointers.size === 1 && !mapHadMultiTouch) {
    mapSingleMoved += Math.hypot(dx, dy);
    if (mapDragIsOrbit || e.buttons === 2 || e.shiftKey) {
      explorer.map3d.orbitByDelta(dx, dy);
    } else {
      const rect = map3dGestureLayer.getBoundingClientRect();
      explorer.map3d.panByScreenDelta(dx, dy, rect.width, rect.height);
      btnMap3dFocus.classList.remove('active');
    }
  } else if (mapPointers.size === 2) {
    const pts = Array.from(mapPointers.values());
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    const midY = (pts[0].y + pts[1].y) * 0.5;

    if (mapPrevPinchDist > 8 && dist > 8) {
      explorer.map3d.zoomByFactor(mapPrevPinchDist / dist);
    }
    let dAng = angle - mapPrevPinchAngle;
    if (dAng > Math.PI) dAng -= Math.PI * 2;
    if (dAng < -Math.PI) dAng += Math.PI * 2;
    const dTilt = midY - mapPrevPinchMidY;
    explorer.map3d.orbitByDelta(-dAng * 165, dTilt * 0.9);

    mapPrevPinchDist = dist;
    mapPrevPinchAngle = angle;
    mapPrevPinchMidY = midY;
  }
});

function releaseMapPointer(e) {
  if (!mapPointers.has(e.pointerId)) return;
  const wasSingleTap = mapPointers.size === 1 && !mapHadMultiTouch && mapSingleMoved < 9 && e.button !== 2;
  mapPointers.delete(e.pointerId);
  if (mapPointers.size === 0) {
    mapHadMultiTouch = false;
  }

  if (wasSingleTap && mapVisible && activeSheetIdx === 30 && explorer && explorer.map3d) {
    const rect = map3dGestureLayer.getBoundingClientRect();
    const hit = explorer.map3d.pickAtScreenPoint(e.clientX, e.clientY, rect);
    if (hit) {
      if (hit.kind === 'landmark') {
        explorer.teleportToLandmark(hit.id);
      } else {
        explorer.teleportToWorld(hit.worldX, hit.worldZ);
      }
      toggleMap(false);
    }
  }
}

map3dGestureLayer.addEventListener('pointerup', releaseMapPointer);
map3dGestureLayer.addEventListener('pointercancel', releaseMapPointer);

map3dGestureLayer.addEventListener('wheel', (e) => {
  if (!mapVisible || activeSheetIdx !== 30 || !explorer || !explorer.map3d) return;
  e.preventDefault();
  explorer.map3d.zoomByFactor(e.deltaY > 0 ? 1.12 : 0.89);
}, { passive: false });

// ---- 2.3× Ergonomic Touch Dual-Thumb Joystick + Direct 3D Physical Button Tap ----
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const lookZone = document.getElementById('look-zone');

let joyTouchId = null;
let joyOrigin = { x: 0, y: 0 };
const getJoyMaxR = () => Math.max(48, (joyBase.offsetWidth || 285) * 0.388);

joyZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || settingsVisible || joyTouchId !== null || !explorer) return;
  joyTouchId = e.pointerId;
  try { joyZone.setPointerCapture(e.pointerId); } catch (_) {}
  const rect = joyZone.getBoundingClientRect();
  const half = (joyBase.offsetWidth || 285) * 0.5;
  const padX = Math.min(half * 0.65, rect.width * 0.36);
  const padY = Math.min(half * 0.55, rect.height * 0.36);
  joyOrigin = {
    x: Math.max(padX, Math.min(rect.width - padX * 0.45, e.clientX - rect.left)),
    y: Math.max(padY, Math.min(rect.height - padY, e.clientY - rect.top)),
  };
  joyBase.classList.remove('joy-base-idle');
  joyBase.style.left = `${joyOrigin.x}px`;
  joyBase.style.top = `${joyOrigin.y}px`;
  joyKnob.style.transform = 'translate(0px, 0px)';
});

joyZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyTouchId || !explorer) return;
  const rect = joyZone.getBoundingClientRect();
  const maxR = getJoyMaxR();
  let dx = (e.clientX - rect.left) - joyOrigin.x;
  let dy = (e.clientY - rect.top) - joyOrigin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const norm = Math.min(1, dist / maxR);
  explorer.setVirtualMove(dx / maxR, dy / maxR, norm > 0.86);
});

function releaseJoy(e) {
  if (e.pointerId !== joyTouchId) return;
  joyTouchId = null;
  joyKnob.style.transform = 'translate(0px, 0px)';
  joyBase.classList.add('joy-base-idle');
  if (explorer) explorer.setVirtualMove(0, 0, false);
}
joyZone.addEventListener('pointerup', releaseJoy);
joyZone.addEventListener('pointercancel', releaseJoy);

let lookTouchId = null;
let lookLast = { x: 0, y: 0 };
let lookMoved = 0;

lookZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || lookTouchId !== null || !explorer) return;
  if (settingsVisible) {
    toggleSettings(false);
    return;
  }
  lookTouchId = e.pointerId;
  try { lookZone.setPointerCapture(e.pointerId); } catch (_) {}
  lookLast = { x: e.clientX, y: e.clientY };
  lookMoved = 0;
});

lookZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookTouchId || !explorer) return;
  const dx = e.clientX - lookLast.x;
  const dy = e.clientY - lookLast.y;
  lookMoved += Math.hypot(dx, dy);
  lookLast = { x: e.clientX, y: e.clientY };
  explorer.applyTouchLook(dx, dy);
});

function releaseLook(e) {
  if (e.pointerId !== lookTouchId) return;
  lookTouchId = null;
  if (lookMoved < 10 && explorer && !isDriving) {
    explorer.interactAtScreenPoint(e.clientX, e.clientY);
  }
}
lookZone.addEventListener('pointerup', releaseLook);
lookZone.addEventListener('pointercancel', releaseLook);

// ---- Bulk SVG / ZIP Blueprint Downloads (All 23 CAD Sheets) ----
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

btnExportSvg.addEventListener('click', () => {
  const fl = BLUEPRINT_SHEETS[blueprint.activeFloor];
  const blob = new Blob([blueprint.exportSVGString()], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `NARROW50_${fl.code}.svg`);
});

btnExportAllSvg.addEventListener('click', () => {
  const combinedSvg = blueprint.exportAllSheetsCombinedSVG();
  const blob = new Blob([combinedSvg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, 'NARROW50_ALL_23_BLUEPRINTS.svg');
});

btnExportAllZip.addEventListener('click', () => {
  const zipBlob = blueprint.exportAllSheetsZipBlob();
  triggerDownload(zipBlob, 'NARROW50_ALL_23_SVG.zip');
});

// ---- URL Parameters for Verification & Deep-Links ----
const params = new URLSearchParams(window.location.search);
if (explorer) {
  if (params.has('sens')) applySensitivity(Number(params.get('sens')), false);
  if (params.get('sm11s') === '1') applySm11s(true, false);
  if (params.get('storm') === '1') applyStorm(true, true);
  if (params.has('elvFloor')) {
    const ef = Number(params.get('elvFloor'));
    const eOpen = params.get('elvDoors') !== 'closed';
    if (!Number.isNaN(ef)) explorer.snapElevator(ef, eOpen);
  }
  if (params.has('extElvFloor')) {
    const xef = Number(params.get('extElvFloor'));
    const xeOpen = params.get('extElvDoors') !== 'closed';
    if (!Number.isNaN(xef)) explorer.snapExtElevator(xef, xeOpen);
  }
  if (params.get('camperPose')) {
    const parts = params.get('camperPose').split(',');
    const cx = Number(parts[0]), cz = Number(parts[1]), cyaw = Number(parts[2]);
    const force = parts[3] === '1';
    if (!Number.isNaN(cx) && !Number.isNaN(cz)) {
      explorer.setCamperPose(cx, cz, Number.isNaN(cyaw) ? 0 : cyaw, force);
    }
  }
  if (params.get('keiPose')) {
    const parts = params.get('keiPose').split(',');
    const kx = Number(parts[0]), kz = Number(parts[1]), kyaw = Number(parts[2]);
    const force = parts[3] === '1';
    if (!Number.isNaN(kx) && !Number.isNaN(kz)) {
      explorer.setKeiPose(kx, kz, Number.isNaN(kyaw) ? 0 : kyaw, force);
    }
  }
  if (params.get('armorPose')) {
    const parts = params.get('armorPose').split(',');
    const ax = Number(parts[0]), az = Number(parts[1]), ayaw = Number(parts[2]);
    const force = parts[3] === '1';
    if (!Number.isNaN(ax) && !Number.isNaN(az)) {
      explorer.setArmorPose(ax, az, Number.isNaN(ayaw) ? 0 : ayaw, force);
    }
  }
  if (params.get('hitch') === '1') explorer.toggleArmorHitch(true);
  if (params.get('shutters') === '1') explorer.toggleArmorShutters(true);
  const floorParam = params.has('floor') ? Number(params.get('floor')) : null;
  if (params.get('landmark')) {
    explorer.teleportToLandmark(params.get('landmark'));
    if (params.has('yaw') || params.has('pitch')) {
      const yw = params.has('yaw') ? Number(params.get('yaw')) : explorer.yaw;
      const pt = params.has('pitch') ? Number(params.get('pitch')) : explorer.pitch;
      explorer.setPose(explorer.playerPos.x, explorer.playerPos.z, yw, pt, 1);
    }
  } else if (params.get('armorLocal')) {
    const [lx, lz] = params.get('armorLocal').split(',').map(Number);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : 0;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.04;
    if (!Number.isNaN(lx) && !Number.isNaN(lz)) {
      const wPos = explorer.armorLocalToWorld(lx, lz);
      explorer.setPose(wPos.x, wPos.z, yaw, pitch, floorParam !== null ? floorParam : 1);
    }
  } else if (params.get('keiLocal')) {
    const [lx, lz] = params.get('keiLocal').split(',').map(Number);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : 0;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.05;
    if (!Number.isNaN(lx) && !Number.isNaN(lz)) {
      const wPos = explorer.keiLocalToWorld(lx, lz);
      explorer.setPose(wPos.x, wPos.z, yaw, pitch, floorParam !== null ? floorParam : 1);
    }
  } else if (params.get('camperLocal')) {
    const [lx, lz] = params.get('camperLocal').split(',').map(Number);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : 0;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.04;
    if (!Number.isNaN(lx) && !Number.isNaN(lz)) {
      const wPos = explorer.camperLocalToWorld(lx, lz);
      explorer.setPose(wPos.x, wPos.z, yaw, pitch, floorParam !== null ? floorParam : 1);
    }
  } else if (params.get('pos')) {
    const [x, z] = params.get('pos').split(',').map(Number);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : Math.PI - 0.24;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.04;
    if (!Number.isNaN(x) && !Number.isNaN(z)) explorer.setPose(x, z, yaw, pitch, floorParam);
  } else if (floorParam !== null && !Number.isNaN(floorParam)) {
    explorer.setPose(1.62, 6.25, Math.PI - 0.24, -0.04, floorParam);
  }
  if (params.has('elvMidY')) {
    const my = Number(params.get('elvMidY'));
    if (!Number.isNaN(my)) explorer.snapElevatorMidShaft(my, 1);
  }
  if (params.get('doors') === 'open') explorer.openDoors();
  if (params.get('drive') === '1') explorer.toggleCamperDrive(true);
  if (params.get('driveKei') === '1') explorer.toggleKeiDrive(true);
  if (params.get('driveArmor') === '1') explorer.toggleArmorDrive(true);
  if (params.get('flash') === '1') explorer.toggleFlashlight(true);
}
if (params.get('perf') === '1') togglePerf(true);
if (params.get('settings') === '1') toggleSettings(true);
if (params.get('map') === '1') {
  toggleMap(true);
  if (params.has('bpFloor')) selectBlueprintFloor(Number(params.get('bpFloor')));
}

window.__FPS_APP__ = {
  explorer,
  blueprint,
  selectBlueprintFloor,
  toggleSettings,
  toggleMap,
  applySensitivity,
  applySm11s,
  applyStorm,
  setBlueprintView,
  getBlueprintViewState,
  getMap2D: () => ensureMap2D(),
  getMap3D: () => explorer?.map3d || null,
};
