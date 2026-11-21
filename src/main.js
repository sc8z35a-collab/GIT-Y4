import { HOUSE, BLUEPRINT_SHEETS, FINISH_SCHEDULE, OPENING_SCHEDULE } from './planData.js';
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

const driveHudEl = document.getElementById('drive-hud');
const driveBadgeEl = document.getElementById('drive-badge');
const driveSpeedValEl = document.getElementById('drive-speed-val');
const driveCollisionTagEl = document.getElementById('drive-collision-tag');
const btnDriveLights = document.getElementById('btn-drive-lights');
const btnDriveExit = document.getElementById('btn-drive-exit');

const elvHudEl = document.getElementById('elevator-hud');
const elvHudFloorEl = document.getElementById('elv-hud-floor');
const elvHudArrowEl = document.getElementById('elv-hud-arrow');
const elvHudStatusEl = document.getElementById('elv-hud-status');
const elvFloorBtns = Array.from(document.querySelectorAll('.elv-btn[data-elv-floor]'));
const elvBtnCall = document.getElementById('elv-btn-call');
const elvBtnOpen = document.getElementById('elv-btn-open');
const elvBtnClose = document.getElementById('elv-btn-close');

const mapModal = document.getElementById('map-modal');
const blueprintMount = document.getElementById('blueprint-mount');
const roomDetailBar = document.getElementById('room-detail-bar');
const areaTableTitle = document.getElementById('area-table-title');
const tableAreas = document.getElementById('table-areas');

let mapVisible = false;
let perfVisible = false;
let isDriving = false;
let lastPose = { floor: HOUSE.spawnFloor, sheetIndex: 4, floorCode: '1F', x: 1.62, z: 6.25, dx: 0, dz: 1 };

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
  try { await deferredInstallPrompt.userChoice; } catch (_) {}
  deferredInstallPrompt = null;
  btnInstall.classList.add('hidden');
});

const blueprint = new ArchitecturalBlueprint2D(blueprintMount, {
  onRoomHover: (room) => {
    if (!room) {
      roomDetailBar.textContent = '図面上の各部屋にカーソルを合わせると、寸法・床レベル・採用素材が表示されます。';
      return;
    }
    roomDetailBar.innerHTML = `<strong>${room.code} ${room.nameJp}</strong>（${room.area.toFixed(2)}m² / ${room.jo.toFixed(1)}帖・${room.fl} / ${room.ch}）— ${room.notes}`;
  },
});

function renderFloorAreaTable(sheetIdx) {
  const fl = BLUEPRINT_SHEETS[sheetIdx] || BLUEPRINT_SHEETS[4];
  const isAnnex = fl.building === 'annex';
  const isStorage = fl.building === 'storage';
  const isCamper = fl.building === 'camper';
  const isKei = fl.building === 'kei';
  areaTableTitle.textContent = `求積・天井高一覧（${fl.code} — ${fl.floorLabel}）`;
  const netSum = fl.rooms.reduce((acc, r) => acc + r.area, 0);
  let summaryLabel = `${fl.code} フロア計`;
  if (fl.isDeepB4) {
    summaryLabel = '地下4階計（ELV専用・階段なし・2.7×15.5m CH3.55m ギャング極秘研究所5区画）';
  } else if (fl.isDeepB3) {
    summaryLabel = '地下3階計（W520通路＋5停止ELV-1＋3.2×12.5m木造シェルター＋2×6m食料庫）';
  } else if (fl.isDeepB2) {
    summaryLabel = '地下2階計（10×10m CH3.8mスタジオ＋4×6m 2室＋ELV乗場）';
  } else if (isKei) {
    summaryLabel = '軽バン計（1席＋進入可能フル荷室 3.52m³）';
  } else if (isCamper) {
    summaryLabel = fl.camperLevel === 2
      ? 'RV 2Fロフト計（2室＋連絡ブリッジ・吹抜CH3.02m）'
      : 'RV 1F計（全14室＋拡幅W560廊下＋高天井CH3.02m）';
  } else if (isStorage) {
    summaryLabel = `${fl.code}計（RC倉庫 2×2m・低天井2階建 計4室）`;
  } else if (isAnnex) {
    if (fl.hasAnnexBalconies) summaryLabel = '隣棟3F計（6室＋1×1.6mバルコニー×3）';
    else if (fl.isAttic) summaryLabel = '隣棟屋根裏計（全5室・6寸勾配小屋裏）';
    else summaryLabel = `${fl.code}計（隣棟 5×8m 3階建＋屋根裏）`;
  } else if (fl.isBasement) {
    summaryLabel = '地下1階計 (3×7m主空間 + 倉庫3室・棚15基 + ST_B2 + ELV-1)';
  } else if (fl.isAttic) {
    summaryLabel = '母屋屋根裏計 (有効 28.5m²)';
  } else if (fl.hasBalcony) {
    summaryLabel = '母屋4F計 (5室 + 1×2mバルコニー)';
  }
  const footprintStr = fl.isDeepB4
    ? '2700×15500 (CH3550)'
    : (fl.isDeepB3
      ? '3200×12500 + 2000×6000'
      : (fl.isDeepB2
        ? '10000×10000 + 4000×6000×2'
        : (isKei
          ? '1480×3400×H1800'
          : (isCamper
            ? '2700×7500×H3400'
            : (isStorage ? '2000×2000' : (isAnnex ? '5000×8000' : '5000×10000'))))));
  const grossStr = fl.isDeepB4
    ? '41.85m² (ELV専用)'
    : (fl.isDeepB3
      ? '計 53.34m² (+ELV)'
      : (fl.isDeepB2
        ? '計 151.20m²'
        : (isKei
          ? '車体床 5.03m²'
          : (isCamper
            ? (fl.camperLevel === 2 ? 'ロフト床 13.9m²' : '車体床 20.25m²')
            : (isStorage
              ? '4.00m² (2F延8.0m²)'
              : (isAnnex
                ? (fl.isAttic ? '有効 29.49m²' : (fl.hasAnnexBalconies ? '40.00m² + B4.8m²' : '40.00m²'))
                : (fl.isBasement ? '31.88m²' : (fl.isAttic ? '有効 28.50m²' : '50.00m²'))))))));
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
        <td>${summaryLabel}</td>
        <td class="num">${footprintStr}</td>
        <td class="num">${grossStr}</td>
        <td>室計 ${netSum.toFixed(2)}m²</td>
      </tr>
    </tbody>
  `;
}

function selectBlueprintFloor(sheetIdx) {
  const idx = Math.max(0, Math.min(BLUEPRINT_SHEETS.length - 1, Number(sheetIdx) || 0));
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

renderFloorAreaTable(4);

function toggleMap(force = null) {
  mapVisible = force !== null ? force : !mapVisible;
  mapModal.classList.toggle('hidden', !mapVisible);
  btnMap.classList.toggle('active', mapVisible);
  if (mapVisible) selectBlueprintFloor(lastPose.sheetIndex !== undefined ? lastPose.sheetIndex : (lastPose.floor + 3));
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

function updateDriveHUD(driving, state = {}) {
  isDriving = driving;
  driveHudEl.classList.toggle('hidden', !driving);
  if (driving) {
    if (driveBadgeEl) {
      driveBadgeEl.textContent = state.badge || (state.vehicle === 'kei' ? 'KEI-340 660cc' : 'CAMPER-75 6×6');
      driveBadgeEl.classList.toggle('kei', state.vehicle === 'kei');
    }
    driveSpeedValEl.textContent = String(state.speedKmh ?? 0);
    driveCollisionTagEl.classList.toggle('hidden', !state.colliding);
    driveHudEl.classList.toggle('colliding', Boolean(state.colliding));
    btnDriveLights.classList.toggle('active', Boolean(state.headlightsOn));
    mobInteract.textContent = '降車';
    mobInteract.classList.remove('hidden');
  } else {
    driveHudEl.classList.remove('colliding');
    mobInteract.textContent = '操作';
    mobInteract.classList.add('hidden');
  }
}

function updateElevatorHUD(show, state = {}) {
  elvHudEl.classList.toggle('hidden', !show);
  if (!show) return;
  elvHudFloorEl.textContent = state.floorCode || 'B3';
  elvHudArrowEl.textContent = state.dir > 0 ? '▲' : (state.dir < 0 ? '▼' : '●');
  const depthStr = state.cabY !== undefined ? `${state.cabY >= 0 ? '±0.0' : state.cabY.toFixed(1)}m` : '';
  const isMoving = state.phase === 'RUNNING' || state.phase === 'RELEVELING' || state.phase === 'BRAKE_RELEASE';
  let stText = `${state.floorCode} 待機中 (${depthStr})`;
  if (state.phase === 'BRAKE_RELEASE') {
    stText = '電磁ブレーキ解除…';
  } else if (state.phase === 'RUNNING') {
    stText = `${state.dir > 0 ? 'S字上昇' : 'S字下降'} ${(state.speedMs || 0).toFixed(1)}m/s (${depthStr})`;
  } else if (state.phase === 'RELEVELING') {
    stText = `精密微速着床中 (${depthStr})`;
  } else if (state.phase === 'DOOR_CLOSING') {
    stText = '連動扉 閉鎖中…';
  } else if (state.phase === 'DOOR_OPENING' || state.phase === 'IDLE_OPEN') {
    stText = `${state.floorCode} 到着 · 扉開 (${depthStr})`;
  }
  elvHudStatusEl.textContent = stText;

  const queuedSet = new Set(state.queuedFloors || []);
  elvFloorBtns.forEach((btn) => {
    const fl = Number(btn.dataset.elvFloor);
    const isTarget = fl === state.targetFloor && (isMoving || state.phase === 'DOOR_CLOSING');
    btn.classList.toggle('current', fl === state.currentStopFloor && !isMoving);
    btn.classList.toggle('target', isTarget);
    btn.classList.toggle('queued', !isTarget && queuedSet.has(fl));
  });

  const needCall = !state.inCab && (state.currentStopFloor !== state.playerFloor || state.phase === 'IDLE_CLOSED');
  elvBtnCall.classList.toggle('hidden', !needCall);
}

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
      if (isDriving) {
        reticleEl.classList.remove('aiming');
        interactPromptEl.classList.add('hidden');
        return;
      }
      const active = Boolean(aim);
      reticleEl.classList.toggle('aiming', active);
      interactPromptEl.classList.toggle('hidden', !active);
      mobInteract.classList.toggle('hidden', !active);
      if (aim) interactLabelEl.textContent = aim.prompt;
    },
    onDriveChange: (driving, state) => updateDriveHUD(driving, state),
    onElevatorChange: (show, state) => updateElevatorHUD(show, state),
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

btnFlash.addEventListener('click', () => {
  if (!explorer) return;
  if (isDriving) explorer.toggleVehicleHeadlights();
  else explorer.toggleFlashlight();
});
mobFlash.addEventListener('click', () => {
  if (!explorer) return;
  if (isDriving) explorer.toggleVehicleHeadlights();
  else explorer.toggleFlashlight();
});
mobCrouch.addEventListener('click', () => explorer && !isDriving && explorer.toggleCrouch());
btnAudio.addEventListener('click', () => explorer && explorer.toggleAudio());
btnMap.addEventListener('click', () => toggleMap());
document.getElementById('btn-close-map').addEventListener('click', () => toggleMap(false));
btnPerf.addEventListener('click', () => togglePerf());
interactPromptEl.addEventListener('click', () => explorer && explorer.interact());
mobInteract.addEventListener('click', () => explorer && explorer.interact());
btnDriveLights.addEventListener('click', () => explorer && explorer.toggleVehicleHeadlights());
btnDriveExit.addEventListener('click', () => explorer && explorer.interact());

elvFloorBtns.forEach((btn) => {
  btn.addEventListener('click', () => explorer && explorer.selectElevatorFloor(Number(btn.dataset.elvFloor)));
});
elvBtnCall.addEventListener('click', () => explorer && explorer.callElevator(explorer.currentFloor));
elvBtnOpen.addEventListener('click', () => explorer && explorer.openElevatorDoors());
elvBtnClose.addEventListener('click', () => explorer && explorer.closeElevatorDoors());

const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyKnob = document.getElementById('joy-knob');
const lookZone = document.getElementById('look-zone');

let joyTouchId = null;
let joyOrigin = { x: 0, y: 0 };
const JOY_MAX_R = 60;

joyZone.addEventListener('pointerdown', (e) => {
  if (mapVisible || joyTouchId !== null || !explorer) return;
  joyTouchId = e.pointerId;
  joyZone.setPointerCapture(e.pointerId);
  const rect = joyZone.getBoundingClientRect();
  joyOrigin = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  joyBase.classList.remove('joy-base-idle');
  joyBase.style.left = `${joyOrigin.x}px`;
  joyBase.style.top = `${joyOrigin.y}px`;
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
  if (lookMoved < 10 && explorer && !isDriving) explorer.interact();
}
lookZone.addEventListener('pointerup', releaseLook);
lookZone.addEventListener('pointercancel', releaseLook);

document.querySelectorAll('#bp-layers input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener('change', () => {
    cb.closest('.layer-chip').classList.toggle('active', cb.checked);
    blueprint.setLayer(cb.dataset.layer, cb.checked);
  });
});

document.getElementById('btn-export-svg').addEventListener('click', () => {
  const fl = BLUEPRINT_SHEETS[blueprint.activeFloor];
  const blob = new Blob([blueprint.exportSVGString()], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NARROW-50_${fl.code}_blueprint.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

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

const params = new URLSearchParams(window.location.search);
if (explorer) {
  if (params.has('elvFloor')) {
    const ef = Number(params.get('elvFloor'));
    const eOpen = params.get('elvDoors') !== 'closed';
    if (!Number.isNaN(ef)) explorer.snapElevator(ef, eOpen);
  }
  if (params.get('camperPose')) {
    const [cx, cz, cyaw] = params.get('camperPose').split(',').map(Number);
    if (!Number.isNaN(cx) && !Number.isNaN(cz)) {
      explorer.setCamperPose(cx, cz, Number.isNaN(cyaw) ? 0 : cyaw);
    }
  }
  if (params.get('keiPose')) {
    const [kx, kz, kyaw] = params.get('keiPose').split(',').map(Number);
    if (!Number.isNaN(kx) && !Number.isNaN(kz)) {
      explorer.setKeiPose(kx, kz, Number.isNaN(kyaw) ? 0 : kyaw);
    }
  }
  const floorParam = params.has('floor') ? Number(params.get('floor')) : null;
  if (params.get('keiLocal')) {
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
  if (params.get('flash') === '1') explorer.toggleFlashlight(true);
}
if (params.get('perf') === '1') togglePerf(true);
if (params.get('map') === '1') {
  toggleMap(true);
  if (params.has('bpFloor')) selectBlueprintFloor(Number(params.get('bpFloor')));
}

window.__FPS_APP__ = { explorer, blueprint, selectBlueprintFloor };
