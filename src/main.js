import { ROOMS, FINISH_SCHEDULE, OPENING_SCHEDULE } from './planData.js';
import { FirstPersonHouseExplorer } from './scene3d.js';
import { ArchitecturalBlueprint2D } from './blueprint2d.js';

const canvas3dEl = document.getElementById('canvas-3d');
const reticleEl = document.getElementById('reticle');
const interactPromptEl = document.getElementById('interact-prompt');
const interactLabelEl = document.getElementById('interact-label');
const roomCodeEl = document.getElementById('room-code');
const roomNameEl = document.getElementById('room-name');
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

let mapVisible = false;
let perfVisible = false;

// 1. Initialize 1/50 JIS CAD Blueprint inside the toggleable [M] drawer
const blueprint = new ArchitecturalBlueprint2D(blueprintMount, {
  onRoomHover: (room) => {
    if (!room) {
      roomDetailBar.textContent = '図面上の各部屋にカーソルを合わせると、寸法・床レベル・採用素材が表示されます。';
      return;
    }
    roomDetailBar.innerHTML = `<strong>${room.code} ${room.nameJp}</strong>（${room.area.toFixed(2)}m² / ${room.jo.toFixed(1)}帖・${room.fl} / ${room.ch}）— ${room.notes}`;
  },
});

function toggleMap(force = null) {
  mapVisible = force !== null ? force : !mapVisible;
  mapModal.classList.toggle('hidden', !mapVisible);
  btnMap.classList.toggle('active', mapVisible);
  explorer.setMapOpen(mapVisible);
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

// 2. Initialize Pure First-Person Dark-Forest Protagonist Explorer (starts immediately inside LDK!)
const explorer = new FirstPersonHouseExplorer(canvas3dEl, {
  onPoseUpdate: (pose) => {
    if (mapVisible) blueprint.updateCameraPose(pose);
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

// 3. HUD Button Wiring
btnFlash.addEventListener('click', () => explorer.toggleFlashlight());
mobFlash.addEventListener('click', () => explorer.toggleFlashlight());
mobCrouch.addEventListener('click', () => explorer.toggleCrouch());
btnAudio.addEventListener('click', () => explorer.toggleAudio());
btnMap.addEventListener('click', () => toggleMap());
document.getElementById('btn-close-map').addEventListener('click', () => toggleMap(false));
btnPerf.addEventListener('click', () => togglePerf());
interactPromptEl.addEventListener('click', () => explorer.interact());
mobInteract.addEventListener('click', () => explorer.interact());

// 4. POCO F7 Dual-Thumb Multi-Touch Controller (Simultaneous Left Analog Stick + Right Look)
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const lookZone = document.getElementById('look-zone');

let joyTouchId = null;
let joyOrigin = { x: 0, y: 0 };
const JOY_MAX_R = 46;

joyZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || joyTouchId !== null) return;
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
  if (e.pointerId !== joyTouchId) return;
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
  explorer.setVirtualMove(0, 0, false);
}
joyZone.addEventListener('pointerup', releaseJoy);
joyZone.addEventListener('pointercancel', releaseJoy);

let lookTouchId = null;
let lookLast = { x: 0, y: 0 };
let lookMoved = 0;

lookZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || lookTouchId !== null) return;
  lookTouchId = e.pointerId;
  lookZone.setPointerCapture(e.pointerId);
  lookLast = { x: e.clientX, y: e.clientY };
  lookMoved = 0;
});

lookZone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookTouchId) return;
  const dx = e.clientX - lookLast.x;
  const dy = e.clientY - lookLast.y;
  lookMoved += Math.hypot(dx, dy);
  lookLast = { x: e.clientX, y: e.clientY };
  explorer.applyTouchLook(dx, dy);
});

function releaseLook(e) {
  if (e.pointerId !== lookTouchId) return;
  lookTouchId = null;
  if (lookMoved < 10) explorer.interact();
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
  const blob = new Blob([blueprint.exportSVGString()], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'NARROW-50_1LDK_5x10m_blueprint.svg';
  a.click();
  URL.revokeObjectURL(url);
});

// 6. Populate Blueprint Architectural Schedules
document.getElementById('table-areas').innerHTML = `
  <thead><tr><th>室名</th><th class="num">内法 (mm)</th><th class="num">面積</th><th>FL / CH</th></tr></thead>
  <tbody>
    ${ROOMS.map((r) => `
      <tr>
        <td><strong>${r.code} ${r.nameJp}</strong></td>
        <td class="num">${Math.round(r.w * 1000)}×${Math.round(r.d * 1000)}</td>
        <td class="num">${r.area.toFixed(2)}m² (${r.jo.toFixed(1)}帖)</td>
        <td>${r.fl} / ${r.ch}</td>
      </tr>
    `).join('')}
    <tr style="background:#f3efe6;font-weight:700;">
      <td>延床合計 (壁厚含)</td><td class="num">5000×10000</td><td class="num">50.00m² (15.13坪)</td><td>正味 43.82m²</td>
    </tr>
  </tbody>
`;

document.getElementById('table-finishes').innerHTML = `
  <thead><tr><th>室・部位</th><th>床仕上</th><th>壁仕上</th><th>アクセント</th></tr></thead>
  <tbody>
    ${FINISH_SCHEDULE.map((f) => `
      <tr>
        <td><strong>${f.room}</strong></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.floorTex}.png" alt="" />${f.floor}</span></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.wallTex}.png" alt="" />${f.wall}</span></td>
        <td><span class="swatch-cell"><img class="swatch-img" src="./textures/${f.accentTex}.png" alt="" />${f.accent}</span></td>
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

// 7. Verification / Test Query Parameters (no UI presets exposed)
const params = new URLSearchParams(window.location.search);
if (params.get('pos')) {
  const [x, z] = params.get('pos').split(',').map(Number);
  const yaw = params.has('yaw') ? Number(params.get('yaw')) : Math.PI - 0.24;
  const pitch = params.has('pitch') ? Number(params.get('pitch')) : -0.04;
  if (!Number.isNaN(x) && !Number.isNaN(z)) explorer.setPose(x, z, yaw, pitch);
}
if (params.get('doors') === 'open') explorer.openDoors();
if (params.get('flash') === '1') explorer.toggleFlashlight(true);
if (params.get('perf') === '1') togglePerf(true);
if (params.get('map') === '1') toggleMap(true);

window.__FPS_APP__ = { explorer, blueprint };
