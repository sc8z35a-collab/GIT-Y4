import { FLOORS, FINISH_SCHEDULE, OPENING_SCHEDULE } from './planData.js';
import { FirstPersonHouseExplorer } from './scene3d.js';
import { ArchitecturalBlueprint2D } from './blueprint2d.js';

const canvas3dEl = document.getElementById('canvas-3d');
const webglErrorEl = document.getElementById('webgl-error');
const webglErrorMsgEl = document.getElementById('webgl-error-msg');
const reticleEl = document.getElementById('reticle');
const interactPromptEl = document.getElementById('interact-prompt');
const interactLabelEl = document.getElementById('interact-label');
const floorBadgeEl = document.getElementById('floor-badge');
const roomCodeEl = document.getElementById('room-code');
const roomNameEl = document.getElementById('room-name');
const btnInstall = document.getElementById('btn-install');
const btnFlash = document.getElementById('btn-flash');
const btnAudio = document.getElementById('btn-audio');
const btnMap = document.getElementById('btn-map');
const btnPerf = document.getElementById('btn-perf');
const perfPanel = document.getElementById('perf-panel');
const perfGrid = document.getElementById('perf-grid');

const mobInteract = document.getElementById('mob-interact');
const mobFlash = document.getElementById('mob-flash');
const mobCrouch = document.getElementById('mob-crouch');

const mapModal = document.getElementById('map-modal');
const blueprintMount = document.getElementById('blueprint-mount');
const roomDetailBar = document.getElementById('room-detail-bar');
const areaTableTitle = document.getElementById('area-table-title');
const tableAreas = document.getElementById('table-areas');

let mapVisible = false;
let perfVisible = false;
let lastPose = { floor: 0, floorCode: '1F', x: 1.62, z: 6.25, dx: 0, dz: 1 };

// 0. Register Offline PWA Service Worker & Capture Install Prompt (for POCO F7 Chrome / Desktop)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

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
  try {
    await deferredInstallPrompt.userChoice;
  } catch (_) {}
  deferredInstallPrompt = null;
  btnInstall.classList.add('hidden');
});

// 1. Initialize 4-Level 1/50 JIS CAD Blueprint inside the toggleable [M] drawer
const blueprint = new ArchitecturalBlueprint2D(blueprintMount, {
  onRoomHover: (room) => {
    if (!room) {
      roomDetailBar.textContent = '図面上の各部屋にカーソルを合わせると、寸法・床レベル・採用素材が表示されます。';
      return;
    }
    roomDetailBar.innerHTML = `<strong>${room.code} ${room.nameJp}</strong>（${room.area.toFixed(2)}m² / ${room.jo.toFixed(1)}帖・${room.fl} / ${room.ch}）— ${room.notes}`;
  },
});

function renderFloorAreaTable(floorIdx) {
  const fl = FLOORS[floorIdx] || FLOORS[0];
  areaTableTitle.textContent = `求積・天井高一覧（${fl.code} — ${fl.floorLabel}）`;
  const netSum = fl.rooms.reduce((acc, r) => acc + r.area, 0);
  tableAreas.innerHTML = `
    <thead><tr><th>室名</th><th class="num">内法 (mm)</th><th class="num">面積</th><th>FL / CH</th></tr></thead>
    <tbody>
      ${fl.rooms.map((r) => `
        <tr>
          <td><strong>${r.code} ${r.nameJp}</strong></td>
          <td class="num">${Math.round(r.w * 1000)}×${Math.round(r.d * 1000)}</td>
          <td class="num">${r.area.toFixed(2)}m² (${r.jo.toFixed(1)}帖)</td>
          <td>${r.fl} / ${r.ch}</td>
        </tr>
      `).join('')}
      <tr style="background:#f3efe6;font-weight:700;">
        <td>${fl.code} フロア計 (全4層延床 150.0m² + 小屋裏 28.5m²)</td>
        <td class="num">5000×10000</td>
        <td class="num">${fl.isAttic ? '有効 28.50m²' : '50.00m²'}</td>
        <td>室計 ${netSum.toFixed(1)}m²</td>
      </tr>
    </tbody>
  `;
}

function selectBlueprintFloor(floorIdx) {
  const idx = Math.max(0, Math.min(FLOORS.length - 1, Number(floorIdx) || 0));
  blueprint.setFloor(idx);
  renderFloorAreaTable(idx);
  document.querySelectorAll('#bp-floor-tabs .floor-tab').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.floor) === idx);
  });
  if (lastPose) blueprint.updateCameraPose(lastPose);
}

document.querySelectorAll('#bp-floor-tabs .floor-tab').forEach((btn) => {
  btn.addEventListener('click', () => selectBlueprintFloor(Number(btn.dataset.floor)));
});

renderFloorAreaTable(0);

function toggleMap(force = null) {
  mapVisible = force !== null ? force : !mapVisible;
  mapModal.classList.toggle('hidden', !mapVisible);
  btnMap.classList.toggle('active', mapVisible);
  if (mapVisible) {
    selectBlueprintFloor(lastPose.floor);
  }
  if (explorer) explorer.setMapOpen(mapVisible);
}

function renderTelemetry(t) {
  perfGrid.innerHTML = `
    <div>FPS: <strong>${t.fps}</strong> / ${t.targetHz}Hz</div>
    <div>Frame: <strong>${t.frameMs}ms</strong></div>
    <div>DRS Scale: <strong>${t.scale}x</strong></div>
    <div>DrawCalls: <strong>${t.drawCalls}</strong></div>
    <div>Batch Cut: <strong>-${t.batch.reductionPct}%</strong></div>
    <div>Tris: <strong>${(t.triangles / 1000).toFixed(1)}k</strong></div>
    <div>Lights: <strong>${t.activeLights}</strong> active</div>
    <div>Shadows: <strong>${t.shadowRate}/s</strong></div>
  `;
}

function togglePerf(force = null) {
  perfVisible = force !== null ? force : !perfVisible;
  perfPanel.classList.toggle('hidden', !perfVisible);
  btnPerf.classList.toggle('active', perfVisible);
  if (perfVisible && explorer && explorer.adaptive) {
    renderTelemetry({ ...explorer.adaptive.getTelemetry(), batch: explorer.house.batchStats });
  }
}

// 2. Initialize Pure First-Person Dark-Forest 4-Level Protagonist Explorer (with safe WebGL boundary)
let explorer = null;
try {
  explorer = new FirstPersonHouseExplorer(canvas3dEl, {
    onPoseUpdate: (pose) => {
      lastPose = pose;
      if (mapVisible) blueprint.updateCameraPose(pose);
      floorBadgeEl.textContent = pose.floorCode || '1F';
      if (pose.room) {
        roomCodeEl.textContent = pose.room.code;
        roomNameEl.textContent = pose.room.nameJp;
      }
    },
    onAimChange: (aim) => {
      const active = Boolean(aim);
      reticleEl.classList.toggle('aiming', active);
      interactPromptEl.classList.toggle('hidden', !active);
      mobInteract.classList.toggle('hidden', !active);
      if (aim) interactLabelEl.textContent = aim.prompt;
    },
    onFlashlightChange: (on) => {
      btnFlash.classList.toggle('active', on);
      mobFlash.classList.toggle('active', on);
    },
    onCrouchChange: (crouching) => {
      mobCrouch.classList.toggle('active', crouching);
    },
    onAudioChange: (active) => {
      btnAudio.textContent = active ? '音: ON' : '音: OFF';
      btnAudio.classList.toggle('active', active);
    },
    onToggleMap: () => toggleMap(),
    onToggleTelemetry: () => togglePerf(),
    onTelemetry: (t) => {
      if (perfVisible) renderTelemetry(t);
    },
  });
} catch (err) {
  webglErrorEl.classList.remove('hidden');
  webglErrorMsgEl.textContent = `WebGL初期化エラー: ${err?.message || err}`;
}

// 3. HUD Button Wiring
btnFlash.addEventListener('click', () => explorer && explorer.toggleFlashlight());
mobFlash.addEventListener('click', () => explorer && explorer.toggleFlashlight());
mobCrouch.addEventListener('click', () => explorer && explorer.toggleCrouch());
btnAudio.addEventListener('click', () => explorer && explorer.toggleAudio());
btnMap.addEventListener('click', () => toggleMap());
document.getElementById('btn-close-map').addEventListener('click', () => toggleMap(false));
btnPerf.addEventListener('click', () => togglePerf());
interactPromptEl.addEventListener('click', () => explorer && explorer.interact());
mobInteract.addEventListener('click', () => explorer && explorer.interact());

// 4. POCO F7 Dual-Thumb Multi-Touch Controller (Simultaneous Left Analog Stick + Right Look)
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const lookZone = document.getElementById('look-zone');

let joyTouchId = null;
let joyOrigin = { x: 0, y: 0 };
const JOY_MAX_R = 46;

joyZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || joyTouchId !== null || !explorer) return;
  joyTouchId = e.pointerId;
  joyZone.setPointerCapture(e.pointerId);
  const rect = joyZone.getBoundingClientRect();
  joyOrigin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  joyBase.style.left = `${joyOrigin.x}px`;
  joyBase.style.top = `${joyOrigin.y}px`;
  joyBase.classList.remove('hidden');
  joyKnob.style.transform = 'translate(0px, 0px)';
});

joyZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyTouchId || !explorer) return;
  const rect = joyZone.getBoundingClientRect();
  let dx = (e.clientX - rect.left) - joyOrigin.x;
  let dy = (e.clientY - rect.top) - joyOrigin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_MAX_R) {
    dx = (dx / dist) * JOY_MAX_R;
    dy = (dy / dist) * JOY_MAX_R;
  }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  const norm = Math.min(1, dist / JOY_MAX_R);
  explorer.setVirtualMove(dx / JOY_MAX_R, dy / JOY_MAX_R, norm > 0.86);
});

function releaseJoy(e) {
  if (e.pointerId !== joyTouchId) return;
  joyTouchId = null;
  joyBase.classList.add('hidden');
  if (explorer) explorer.setVirtualMove(0, 0, false);
}
joyZone.addEventListener('pointerup', releaseJoy);
joyZone.addEventListener('pointercancel', releaseJoy);

let lookTouchId = null;
let lookLast = { x: 0, y: 0 };
let lookMoved = 0;

lookZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || lookTouchId !== null || !explorer) return;
  lookTouchId = e.pointerId;
  lookZone.setPointerCapture(e.pointerId);
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
  if (lookMoved < 10 && explorer) explorer.interact();
}
lookZone.addEventListener('pointerup', releaseLook);
lookZone.addEventListener('pointercancel', releaseLook);

// 5. Blueprint Layer Checkboxes & SVG Download
document.querySelectorAll('#bp-layers input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener('change', () => {
    cb.closest('.layer-chip').classList.toggle('active', cb.checked);
    blueprint.setLayer(cb.dataset.layer, cb.checked);
  });
});

document.getElementById('btn-export-svg').addEventListener('click', () => {
  const fl = FLOORS[blueprint.activeFloor];
  const blob = new Blob([blueprint.exportSVGString()], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NARROW-50_TOWER_${fl.code}_1to50_blueprint.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

// 6. Populate Multi-Floor Finish & Opening Schedules
document.getElementById('table-finishes').innerHTML = `
  <thead><tr><th>階</th><th>室・部位</th><th>床仕上</th><th>壁仕上</th><th>アクセント</th></tr></thead>
  <tbody>
    ${FINISH_SCHEDULE.map((f) => `
      <tr>
        <td><strong>${f.floor}</strong></td>
        <td><strong>${f.room}</strong></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.floorTex}.png" alt="" />${f.floorName}</span></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.wallTex}.png" alt="" />${f.wallName}</span></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.accentTex}.png" alt="" />${f.accentName}</span></td>
      </tr>
    `).join('')}
  </tbody>
`;

document.getElementById('table-openings').innerHTML = `
  <thead><tr><th>記号</th><th>種別</th><th class="num">開口 (mm)</th><th>仕様</th></tr></thead>
  <tbody>
    ${OPENING_SCHEDULE.map((o) => `
      <tr>
        <td><strong>${o.code}</strong></td>
        <td>${o.kind}</td>
        <td class="num">${o.size}</td>
        <td>${o.spec}</td>
      </tr>
    `).join('')}
  </tbody>
`;

// 7. Verification Query Parameters (for automated inspection — no UI camera presets exposed)
const params = new URLSearchParams(window.location.search);
if (explorer) {
  const floorParam = params.has('floor') ? Number(params.get('floor')) : null;
  if (params.get('pos')) {
    const [x, z] = params.get('pos').split(',').map(Number);
    const yaw = params.has('yaw') ? Number(params.get('yaw')) : Math.PI - 0.24;
    const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.04;
    if (!Number.isNaN(x) && !Number.isNaN(z)) explorer.setPose(x, z, yaw, pitch, floorParam);
  } else if (floorParam !== null && !Number.isNaN(floorParam)) {
    explorer.setPose(1.62, 6.25, Math.PI - 0.24, -0.04, floorParam);
  }
  if (params.get('doors') === 'open') explorer.openDoors();
  if (params.get('flash') === '1') explorer.toggleFlashlight(true);
}
if (params.get('perf') === '1') togglePerf(true);
if (params.get('map') === '1') {
  toggleMap(true);
  if (params.has('bpFloor')) selectBlueprintFloor(Number(params.get('bpFloor')));
}

window.__FPS_APP__ = { explorer, blueprint, selectBlueprintFloor };
