import { HOUSE } from './planData.js';
import { FirstPersonHouseExplorer } from './scene3d.js';

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
const apexAiMetaEl = document.getElementById('apex-ai-meta');
const apexAiBadgeEl = document.getElementById('apex-ai-badge');
const btnAiImport = document.getElementById('btn-ai-import');
const btnAiReset = document.getElementById('btn-ai-reset');
const inputAiWeights = document.getElementById('input-ai-weights');

const perfPanel = document.getElementById('perf-panel');
const perfGrid = document.getElementById('perf-grid');

const statusToastEl = document.getElementById('status-toast');
const driveHudEl = document.getElementById('drive-hud');
const driveSpeedValEl = document.getElementById('drive-speed-val');
const btnDriveAuto = document.getElementById('btn-drive-auto');
const btnDriveCam = document.getElementById('btn-drive-cam');
const btnDriveExit = document.getElementById('btn-drive-exit');
const k11FlightControls = document.getElementById('k11-flight-controls');
const k11AltValEl = document.getElementById('k11-alt-val');
const k11FuelValEl = document.getElementById('k11-fuel-val');
const k11WindValEl = document.getElementById('k11-wind-val');
const btnK11Up = document.getElementById('btn-k11-up');
const btnK11Down = document.getElementById('btn-k11-down');
const btnK11Silo = document.getElementById('btn-k11-silo');
const btnK11Refuel = document.getElementById('btn-k11-refuel');
const btnK11CallRv = document.getElementById('btn-k11-call-rv');
const btnK11CallArmor = document.getElementById('btn-k11-call-armor');
const autopilotStopChip = document.getElementById('autopilot-stop-chip');
const autopilotStopLabel = document.getElementById('autopilot-stop-label');

const mobileActionsEl = document.getElementById('mobile-actions');
const mobCrouch = document.getElementById('mob-crouch');

const mapModal = document.getElementById('map-modal');
const terreno2dPanel = document.getElementById('terreno-2d-panel');
const btnCloseMap = document.getElementById('btn-close-map');

let mapVisible = false;
let settingsVisible = false;
let perfVisible = false;
let isDriving = false;
let hasActiveAutopilot = false;
let selectedAutopilotVehicle = 'camper'; // 'camper' | 'armor' | 'k11'
let terrenoMap2d = null;
let toastTimer = null;
let lastPose = { floor: HOUSE.spawnFloor, sheetIndex: 4, floorCode: '1F', x: 1.62, z: 6.25, yaw: Math.PI, todId: 'day', dx: 0, dz: 1 };

function playUi(kind) {
  try {
    if (explorer && explorer.audio && typeof explorer.audio.playUiSound === 'function') {
      explorer.audio.playUiSound(kind);
    }
  } catch (_) {}
}

function showStatusToast(message, kind = 'info') {
  if (!statusToastEl || !message) return;
  statusToastEl.textContent = message;
  statusToastEl.classList.remove('hidden', 'toast-warn', 'toast-ok');
  if (kind === 'warn' || kind === 'error') statusToastEl.classList.add('toast-warn');
  else if (kind === 'ok' || kind === 'success') statusToastEl.classList.add('toast-ok');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    statusToastEl.classList.add('hidden');
    toastTimer = null;
  }, 4200);
}

function setSelectedAutopilotVehicle(v) {
  selectedAutopilotVehicle = (v === 'armor' || v === 'k11') ? v : 'camper';
  if (explorer && explorer.setSelectedAutopilotVehicle) {
    explorer.setSelectedAutopilotVehicle(selectedAutopilotVehicle);
  }
  if (terrenoMap2d && terrenoMap2d.getSelectedVehicle && terrenoMap2d.getSelectedVehicle() !== selectedAutopilotVehicle) {
    terrenoMap2d.setSelectedVehicle(selectedAutopilotVehicle);
  }
}

// ---- Service Worker Registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

// ---- Automatic Mobile Landscape Fullscreen Controller ----
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

// ---- Pinnacle 2D-Only Cartographic Map Controller ----
function ensureMap2D() {
  if (terrenoMap2d || !explorer || !explorer.terreno) return terrenoMap2d;
  terrenoMap2d = explorer.terreno.getOrCreateMap2D({
    onChangeAutopilotVehicle: (vehKey) => {
      playUi('ui_toggle');
      setSelectedAutopilotVehicle(vehKey);
    },
    onSelectDynamicTarget: (kind, vehKey) => {
      if (!explorer || !kind) return;
      playUi('waypoint_set');
      const key = vehKey || selectedAutopilotVehicle;
      explorer.startCamperAutopilotToDynamic(key, kind);
    },
    onSelectWorldPoint: (wx, wz, vehKey) => {
      if (!explorer) return;
      playUi('waypoint_set');
      const key = vehKey || selectedAutopilotVehicle;
      explorer.startCamperAutopilotTo(key, wx, wz, 'custom');
    },
    onCancelAutopilot: () => {
      if (!explorer) return;
      playUi('ui_toggle');
      explorer.cancelAutopilot();
      if (terrenoMap2d && lastPose) requestAnimationFrame(() => terrenoMap2d.render(lastPose));
    },
  });
  terrenoMap2d.mount(terreno2dPanel);
  terrenoMap2d.setSelectedVehicle(selectedAutopilotVehicle);
  return terrenoMap2d;
}

function syncGameplayOverlayVisibility() {
  const hideGameplay = mapVisible;
  hudTopEl.classList.toggle('hidden', hideGameplay);
  touchLayerEl.classList.toggle('hidden', hideGameplay);
  reticleEl.classList.toggle('hidden', hideGameplay);
  if (hideGameplay) {
    interactPromptEl.classList.add('hidden');
    mobileActionsEl.classList.add('hidden');
    driveHudEl.classList.add('hidden');
    if (autopilotStopChip) autopilotStopChip.classList.add('hidden');
  } else {
    driveHudEl.classList.toggle('hidden', !isDriving);
    mobileActionsEl.classList.toggle('hidden', isDriving);
    if (autopilotStopChip) autopilotStopChip.classList.toggle('hidden', isDriving || !hasActiveAutopilot);
  }
}

function toggleSettings(force = null) {
  const next = force !== null ? force : !settingsVisible;
  if (next !== settingsVisible) playUi('ui_toggle');
  settingsVisible = next;
  settingsSheet.classList.toggle('hidden', !settingsVisible);
  btnSettings.classList.toggle('active', settingsVisible);
  if (settingsVisible && mapVisible) toggleMap(false);
}

function toggleMap(force = null) {
  const next = force !== null ? force : !mapVisible;
  if (next !== mapVisible) playUi(next ? 'map_open' : 'map_close');
  mapVisible = next;
  mapModal.classList.toggle('hidden', !mapVisible);
  btnMap.classList.toggle('active', mapVisible);

  if (mapVisible) {
    if (settingsVisible) toggleSettings(false);
    if (explorer) {
      explorer.setMapOpen(true);
      if (explorer.drivingVehicle === 'k11' || explorer.activeBuilding === 'k11') {
        setSelectedAutopilotVehicle('k11');
      } else if (explorer.drivingVehicle === 'armor' || explorer.activeBuilding === 'armor') {
        setSelectedAutopilotVehicle('armor');
      } else if (explorer.drivingVehicle === 'camper' || explorer.activeBuilding === 'camper') {
        setSelectedAutopilotVehicle('camper');
      }
    }
    const m2d = ensureMap2D();
    if (m2d && lastPose) {
      requestAnimationFrame(() => m2d.render(lastPose));
    }
  } else if (explorer) {
    explorer.setMapOpen(false);
  }
  syncGameplayOverlayVisibility();
}

function renderTelemetry(t) {
  let apexHtml = '';
  if (explorer && explorer.getApexDriveTelemetry) {
    const at = explorer.getApexDriveTelemetry();
    if (at && at.active) {
      apexHtml = `<span>AI<strong>${at.mode}</strong></span><span>LD<strong>${at.lidarFrontMinM.toFixed(0)}m</strong></span>`;
    }
  }
  perfGrid.innerHTML = `
    <span><strong>${t.fps}</strong>fps</span>
    <span><strong>${t.frameMs}</strong>ms</span>
    <span><strong>${t.scale}×</strong>${t.surfaceSuper ? ' SM1.1S' : ''}</span>
    <span>DC<strong>${t.drawCalls}</strong></span>
    ${apexHtml}
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
  hasActiveAutopilot = Boolean(state.autopilotActive);
  const isK11 = driving && state.vehicle === 'k11';
  if (!mapVisible) {
    driveHudEl.classList.toggle('hidden', !driving);
    mobileActionsEl.classList.toggle('hidden', driving);
    if (autopilotStopChip) {
      autopilotStopChip.classList.toggle('hidden', driving || !hasActiveAutopilot);
    }
  }
  if (k11FlightControls) k11FlightControls.classList.toggle('hidden', !isK11);
  btnDriveExitSettings.classList.toggle('hidden', !driving);
  if (driving) {
    driveSpeedValEl.textContent = String(state.speedKmh ?? 0);
    if (isK11) {
      if (k11AltValEl) k11AltValEl.textContent = String(state.altAgl ?? 0);
      if (k11FuelValEl) k11FuelValEl.textContent = Number(state.fuelL ?? 100).toFixed(1);
      if (k11WindValEl) k11WindValEl.textContent = String(state.windKmh ?? 0);
      if (btnK11Silo) btnK11Silo.classList.toggle('hidden', !state.nearSilo);
      if (btnK11Refuel) btnK11Refuel.classList.toggle('hidden', !state.canRefuel);
    }
    if (btnDriveAuto) {
      const canAuto = state.canAutopilot !== false && (state.vehicle === 'camper' || state.vehicle === 'armor' || state.vehicle === 'k11');
      btnDriveAuto.classList.toggle('hidden', !canAuto);
      btnDriveAuto.classList.toggle('active', Boolean(state.autopilotActive));
      btnDriveAuto.textContent = state.autopilotActive ? (isK11 ? '自動航行ON' : '自動ON') : (isK11 ? '自動航行' : '自動運転');
    }
    if (btnDriveCam) {
      const modeLabel = state.camMode === 'hood' ? (isK11 ? '機首' : '前方') : (state.camMode === 'chase' ? '後方' : (isK11 ? '操縦席' : '運転席'));
      btnDriveCam.textContent = `視点:${modeLabel}`;
    }
    if (btnDriveExit) btnDriveExit.textContent = isK11 ? '離席' : '降車';
    if (toggleLight) toggleLight.checked = Boolean(state.headlightsOn);
  } else {
    if (autopilotStopLabel && hasActiveAutopilot) {
      if (state.ridingAutopilot === 'k11') autopilotStopLabel.textContent = 'K-11 自動飛行中（乗船中）・停止';
      else if (state.autopilotK11) autopilotStopLabel.textContent = 'K-11 自動飛行中・停止';
      else if (state.ridingAutopilot) autopilotStopLabel.textContent = '自動走行中（乗船中）・停止';
      else autopilotStopLabel.textContent = 'キャンピングカー自動走行中・停止';
    }
    if (toggleLight && explorer) toggleLight.checked = Boolean(explorer.flashlightOn);
  }
}

// ---- Initialize 3D Explorer ----
let explorer = null;
try {
  explorer = new FirstPersonHouseExplorer(canvas3dEl, {
    onPoseUpdate: (pose) => {
      lastPose = pose;
      if (mapVisible && terrenoMap2d) {
        terrenoMap2d.render(pose);
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
    onStatusToast: (msg, kind) => showStatusToast(msg, kind),
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
if (btnCloseMap) btnCloseMap.addEventListener('click', () => toggleMap(false));
btnSettings.addEventListener('click', () => toggleSettings());
btnCloseSettings.addEventListener('click', () => toggleSettings(false));

inputSens.addEventListener('input', () => applySensitivity(Number(inputSens.value), true));
toggleSm11s.addEventListener('change', () => { playUi('ui_toggle'); applySm11s(toggleSm11s.checked, true); });
if (toggleStorm) {
  toggleStorm.addEventListener('change', () => { playUi('ui_toggle'); applyStorm(toggleStorm.checked, false); });
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
togglePerfCb.addEventListener('change', () => { playUi('ui_toggle'); togglePerf(togglePerfCb.checked); });
btnFullscreen.addEventListener('click', () => { playUi('ui_toggle'); toggleFullscreen(); });
btnDriveExitSettings.addEventListener('click', () => {
  if (explorer && isDriving) {
    explorer.interact();
    toggleSettings(false);
  }
});

function syncApexAiUi() {
  if (!explorer || !explorer.getApexNeuralMeta) return;
  const meta = explorer.getApexNeuralMeta();
  if (apexAiMetaEl) {
    const stepsTxt = meta.trainedSteps >= 1e9
      ? ` • ${(meta.trainedSteps / 1e9).toFixed(2)}B steps`
      : (meta.trainedSteps > 0 ? ` • ${(meta.trainedSteps / 1e6).toFixed(1)}M steps` : '');
    apexAiMetaEl.textContent = `${meta.labelJp}${stepsTxt}`;
  }
  if (apexAiBadgeEl) {
    apexAiBadgeEl.textContent = meta.isTitanV6 ? 'TITAN-v6' : (meta.isCustom ? 'L4-AI' : 'BASE');
    apexAiBadgeEl.classList.toggle('custom', Boolean(meta.isCustom));
  }
  if (btnAiReset) {
    btnAiReset.classList.toggle('hidden', !meta.isCustom);
  }
}
syncApexAiUi();

if (btnAiImport && inputAiWeights) {
  btnAiImport.addEventListener('click', () => inputAiWeights.click());
  inputAiWeights.addEventListener('change', async () => {
    const file = inputAiWeights.files && inputAiWeights.files[0];
    inputAiWeights.value = '';
    if (!file || !explorer) return;
    try {
      const text = await file.text();
      explorer.loadApexNeuralWeights(text);
      syncApexAiUi();
    } catch (err) {
      showStatusToast(`AI重み読込エラー：${err?.message || err}`, 'error');
    }
  });
}
if (btnAiReset) {
  btnAiReset.addEventListener('click', () => {
    if (!explorer) return;
    explorer.resetApexNeuralWeights();
    syncApexAiUi();
  });
}

if (btnDriveAuto) {
  btnDriveAuto.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer && isDriving) explorer.toggleVehicleAutopilot();
  });
}
if (btnDriveCam) {
  btnDriveCam.addEventListener('click', (e) => {
    e.stopPropagation();
    playUi('camera_switch');
    if (explorer && isDriving) explorer.cycleDriveCameraMode();
  });
}
if (btnDriveExit) {
  btnDriveExit.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer && isDriving) explorer.interact();
  });
}
function bindClimbHold(btn, dir) {
  if (!btn) return;
  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.add('active');
    if (explorer) explorer.setK11ClimbInput(dir);
  };
  const stop = (e) => {
    if (e) e.stopPropagation();
    btn.classList.remove('active');
    if (explorer) explorer.setK11ClimbInput(0);
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}
bindClimbHold(btnK11Up, 1);
bindClimbHold(btnK11Down, -1);

if (btnK11Silo) {
  btnK11Silo.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer) explorer.toggleNullSilo();
  });
}
if (btnK11Refuel) {
  btnK11Refuel.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer) explorer.refuelK11();
  });
}
if (btnK11CallRv) {
  btnK11CallRv.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer) explorer.summonCamperToK11('camper');
  });
}
if (btnK11CallArmor) {
  btnK11CallArmor.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer) explorer.summonCamperToK11('armor');
  });
}
if (autopilotStopChip) {
  autopilotStopChip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explorer) explorer.cancelAutopilot();
  });
}
interactPromptEl.addEventListener('click', () => explorer && explorer.interact());
mobCrouch.addEventListener('click', () => explorer && !isDriving && explorer.toggleCrouch());

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
  if (params.has('nullElvFloor')) {
    const nef = Number(params.get('nullElvFloor'));
    const neOpen = params.get('nullElvDoors') !== 'closed';
    if (!Number.isNaN(nef)) explorer.snapNullElevator(nef, neOpen);
  }
  if (params.get('siloOpen') === '1') {
    explorer.snapNullSilo(true);
  }
  if (params.get('k11Pose')) {
    const parts = params.get('k11Pose').split(',').map(Number);
    if (!Number.isNaN(parts[0]) && !Number.isNaN(parts[2])) {
      explorer.setK11Pose(parts[0], Number.isNaN(parts[1]) ? null : parts[1], parts[2], Number.isNaN(parts[3]) ? 0 : parts[3]);
    }
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
  if (params.get('b40') === '1') {
    explorer.snapNullElevator(-40, true);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : -Math.PI * 0.5;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : 0.08;
    explorer.setPose(-16.5, 29910.0, yaw, pitch, -40);
  } else if (params.get('nullErea') === '1') {
    explorer.teleportToLandmark('null_erea');
    if (params.has('yaw') || params.has('pitch')) {
      const yw = params.has('yaw') ? Number(params.get('yaw')) : explorer.yaw;
      const pt = params.has('pitch') ? Number(params.get('pitch')) : explorer.pitch;
      explorer.setPose(explorer.playerPos.x, explorer.playerPos.z, yw, pt, 1);
    }
  } else if (params.get('boardK11') === '1') {
    const kFloor = (explorer.house.airshipK11.dockedInSilo && explorer.house.nullErea && explorer.house.nullErea.silo.liftProgress < 0.5) ? -40 : 1;
    const wPos = explorer.k11LocalToWorld(2.40, 5.20);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : explorer.house.airshipK11.pose.yaw;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.02;
    explorer.setPose(wPos.x, wPos.z, yaw, pitch, kFloor);
  } else if (params.get('landmark')) {
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
  if (params.get('flyK11') === '1') explorer.toggleK11Pilot(true);
  if (params.get('flash') === '1') explorer.toggleFlashlight(true);
}
if (params.get('perf') === '1') togglePerf(true);
if (params.get('settings') === '1') toggleSettings(true);
if (params.get('map') === '1') {
  toggleMap(true);
  if (params.has('mapZoom')) {
    const mz = Number(params.get('mapZoom'));
    const mc = params.get('mapCenter') ? params.get('mapCenter').split(',').map(Number) : null;
    if (!Number.isNaN(mz)) {
      requestAnimationFrame(() => {
        const m2d = ensureMap2D();
        if (m2d) m2d.setView(mz, mc && !Number.isNaN(mc[0]) ? mc[0] : null, mc && !Number.isNaN(mc[1]) ? mc[1] : null);
      });
    }
  }
}

window.__FPS_APP__ = {
  explorer,
  toggleSettings,
  toggleMap,
  applySensitivity,
  applySm11s,
  applyStorm,
  showStatusToast,
  getMap2D: () => ensureMap2D(),
  setMapZoom: (z, wx = null, wz = null) => ensureMap2D()?.setView(z, wx, wz),
};
