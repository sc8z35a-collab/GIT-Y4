import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHouse3D } from './buildHouse3d.js';
import { createVolumetricAtmosphere } from './volumetricAtmosphere.js';
import { SinglePassPostFX } from './postfx.js';
import { AdaptiveMobileEngine } from './adaptiveEngine.js';
import { SpatialForestAudio } from './audioEngine.js';
import { ROOMS } from './planData.js';

// Pre-allocated zero-GC hot-loop scratch math objects (eliminates Android/V8 GC frame spikes at 120Hz)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _input = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _lookDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class FirstPersonHouseExplorer {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // Protagonist spawns directly inside LDK looking across the dark moody Living/Tatami Nook out into the deep cedar forest
    this.playerPos = new THREE.Vector3(1.58, 0.0, 6.18);
    this.playerVel = new THREE.Vector3();
    this.floorY = 0.0;
    this.eyeHeight = 1.56;
    this.targetEyeHeight = 1.56;
    this.crouching = false;
    this.playerRadius = 0.23;

    this.yaw = Math.PI - 0.24;
    this.pitch = -0.04;
    this.prevCamX = 0;
    this.prevCamZ = 0;
    this.prevYaw = 0;
    this.prevPitch = 0;

    this.bobPhase = 0;
    this.bobAmount = 0;
    this.prevBobSin = 0;

    // Desktop & Virtual Mobile Touch Inputs
    this.keys = new Set();
    this.virtualMove = { x: 0, z: 0, sprint: false };
    this.isLocked = false;
    this.isDragging = false;
    this.dragMoved = 0;
    this.lastMouse = { x: 0, y: 0 };

    this.flashlightOn = false;
    this.mapOpen = false;
    this.telemetryTimer = 0.25;

    this._initRenderer();
    this._initScene();
    this._initDarkForestLighting();

    this.house = buildHouse3D(this.scene);
    this.atmosphere = createVolumetricAtmosphere(this.scene);
    this._initFlashlight();
    this.postfx = new SinglePassPostFX(this.renderer);
    this.adaptive = new AdaptiveMobileEngine(this.renderer, this.postfx, this.house);
    this.audio = new SpatialForestAudio();

    this._initEvents();
    this._updateCameraTransform(0);
    // Initial one-shot static shadow bake
    this.adaptive.markShadowsDirty();
    this._startLoop();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // SinglePassPostFX RT handles hardware 2x MSAA directly on Adreno tile memory
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050a10);
    // Layered nocturnal forest fog tuned so 4-5 receding ranks of dark cedars read crisply through every window!
    this.scene.fog = new THREE.FogExp2(0x070e16, 0.038);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.045;
    pmrem.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(64, w / Math.max(1, h), 0.06, 95);
    this.scene.add(this.camera);
  }

  _initDarkForestLighting() {
    // Low moody nocturnal hemisphere fill so interior corners stay genuinely dark & intimate
    this.hemiLight = new THREE.HemisphereLight(0x28405e, 0x090807, 0.13);
    this.scene.add(this.hemiLight);

    // Pale silver-blue moonlight grazing cedar trunks & boughs outside and casting forest shadows across the Engawa
    this.moonLight = new THREE.DirectionalLight(0x7ca6d4, 1.32);
    this.moonLight.position.set(-5.5, 13.0, 20.0);
    this.moonLight.target.position.set(2.5, 1.2, 8.0);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 42;
    this.moonLight.shadow.camera.left = -13;
    this.moonLight.shadow.camera.right = 13;
    this.moonLight.shadow.camera.top = 15;
    this.moonLight.shadow.camera.bottom = -15;
    this.moonLight.shadow.bias = -0.0007;
    this.moonLight.shadow.normalBias = 0.03;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    // Subtle cool moon bounce illuminating North woods outside Bedroom W1 & Front Door D1
    const northMoon = new THREE.DirectionalLight(0x52759e, 0.58);
    northMoon.position.set(5.5, 10.0, -14.0);
    this.scene.add(northMoon);
  }

  _initFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff0d4, 0.0, 22.0, Math.PI * 0.21, 0.56, 1.45);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.bias = -0.0006;
    this.flashlight.position.set(0.16, -0.14, -0.10);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0.0, -0.08, -6.0);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
  }

  // --- Public Protagonist & Mobile Touch APIs ---
  setVirtualMove(nx, nz, sprint = false) {
    this.virtualMove.x = nx;
    this.virtualMove.z = nz;
    this.virtualMove.sprint = sprint;
    if ((Math.abs(nx) > 0.1 || Math.abs(nz) > 0.1) && !this.audio.enabled) {
      this.audio.init();
    }
  }

  applyTouchLook(dx, dy) {
    this.yaw -= dx * 0.0048;
    this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - dy * 0.0040));
  }

  toggleFlashlight(force = null) {
    this.audio.init();
    this.flashlightOn = force !== null ? force : !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 6.4 : 0.0;
    this.adaptive.markShadowsDirty();
    this.audio.playClick(this.flashlightOn);
    if (navigator.vibrate) navigator.vibrate(10);
    if (this.callbacks.onFlashlightChange) this.callbacks.onFlashlightChange(this.flashlightOn);
  }

  toggleCrouch() {
    this.crouching = !this.crouching;
    this.targetEyeHeight = this.crouching ? 1.04 : 1.56;
    if (navigator.vibrate) navigator.vibrate(6);
    if (this.callbacks.onCrouchChange) this.callbacks.onCrouchChange(this.crouching);
  }

  toggleAudio() {
    const active = this.audio.toggleMute();
    if (this.callbacks.onAudioChange) this.callbacks.onAudioChange(active);
    return active;
  }

  interact() {
    this.audio.init();
    return this._interactAimed();
  }

  setMapOpen(open) {
    this.mapOpen = open;
    if (open && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  setPose(x, z, yaw, pitch = -0.04) {
    this.playerPos.set(x, 0, z);
    this.floorY = this._computeFloorY(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this._updateCameraTransform(0);
    this.adaptive.markShadowsDirty();
  }

  openDoors(ids = null) {
    this.house.interactiveDoors.forEach((d) => {
      if (!ids || ids.includes(d.id)) {
        d.isOpen = true;
        d.progress = 1;
        if (d.kind === 'swing') d.pivot.rotation.y = d.openAngle;
        else if (d.axis === 'x') d.pivot.position.x = d.closedPos.x + d.slideDelta;
        else d.pivot.position.z = d.closedPos.z + d.slideDelta;
      }
    });
    this.adaptive.markShadowsDirty();
  }

  _initEvents() {
    this.raycaster = new THREE.Raycaster();
    this.centerNDC = new THREE.Vector2(0, 0);
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      if (this.mapOpen || e.pointerType === 'touch') return;
      this.audio.init();
      this.isDragging = true;
      this.dragMoved = 0;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      if (this.isLocked && e.button === 0) {
        this._interactAimed();
      }
    });

    dom.addEventListener('click', (e) => {
      if (this.mapOpen || e.pointerType === 'touch') return;
      this.audio.init();
      if (!this.isLocked && this.dragMoved < 6) {
        const didInteract = this._interactAimed();
        if (!didInteract && dom.requestPointerLock) {
          try {
            const p = dom.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (_) {
            // Drag-look fallback works seamlessly
          }
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.mapOpen || e.pointerType === 'touch') return;
      if (this.isLocked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - e.movementY * 0.0020));
      } else if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.dragMoved += Math.hypot(dx, dy);
        this.yaw -= dx * 0.0042;
        this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - dy * 0.0036));
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === dom;
      if (this.callbacks.onLockChange) this.callbacks.onLockChange(this.isLocked);
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'm') {
        if (this.callbacks.onToggleMap) this.callbacks.onToggleMap();
        return;
      }
      if (k === 'p') {
        if (this.callbacks.onToggleTelemetry) this.callbacks.onToggleTelemetry();
        return;
      }
      if (this.mapOpen) {
        if (k === 'escape' && this.callbacks.onToggleMap) this.callbacks.onToggleMap();
        return;
      }
      if (k === 'f') {
        this.toggleFlashlight();
        return;
      }
      if (k === 'c') {
        this.toggleCrouch();
        return;
      }
      if (k === 'e' || k === ' ') {
        if (this.interact()) e.preventDefault();
        return;
      }
      if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.audio.init();
        this.keys.add(k);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isDragging = false;
      this.setVirtualMove(0, 0, false);
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.postfx) this.postfx.resize();
  }

  _raycastInteractable() {
    const targets = [
      ...this.house.interactiveDoors.map((d) => d.mesh),
      ...this.house.interactiveProps.map((p) => p.mesh),
    ];
    this.raycaster.setFromCamera(this.centerNDC, this.camera);
    this.raycaster.far = 2.65;
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    if (obj.userData.doorId) {
      const door = this.house.interactiveDoors.find((d) => d.id === obj.userData.doorId);
      if (door) {
        const shortName = door.label.split(' ')[0];
        return { kind: 'door', item: door, prompt: `${shortName}を${door.isOpen ? '閉める' : '開ける'}` };
      }
    }
    if (obj.userData.propId) {
      const prop = this.house.interactiveProps.find((p) => p.id === obj.userData.propId);
      if (prop) return { kind: 'prop', item: prop, prompt: prop.getLabel() };
    }
    return null;
  }

  _interactAimed() {
    const hit = this._raycastInteractable();
    if (!hit) return false;
    if (hit.kind === 'door') {
      hit.item.isOpen = !hit.item.isOpen;
      this.audio.playDoor(hit.item.kind === 'pocket');
      this.adaptive.markShadowsDirty();
    } else if (hit.kind === 'prop') {
      hit.item.toggle();
      this.audio.playClick(hit.item.isOn);
    }
    if (navigator.vibrate) navigator.vibrate(12);
    return true;
  }

  _computeFloorY(x, z) {
    if (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0) return -0.15;
    if (x < 1.55 && z < 1.45) return -0.12;
    if (x > 3.50 && z > 3.50 && z < 5.30) return -0.02;
    if (x > 3.53 && z > 8.53) return 0.32;
    return 0.0;
  }

  _getSurfaceMaterial(x, z) {
    if (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0) return 'earth';
    if (x > 3.53 && z > 8.53) return 'tatami';
    if ((x < 1.55 && z < 1.45) || (x > 1.15 && z > 3.50 && z < 5.30) || (x > 3.60 && z > 5.30 && z < 8.38)) return 'tile';
    return 'wood';
  }

  _collidesAt(x, z) {
    if (x < -3.5 || x > 8.5 || z < -5.2 || z > 12.6) return true;
    const r = this.playerRadius;
    const r2 = r * r;
    const statics = this.house.staticColliders;
    for (let i = 0; i < statics.length; i++) {
      const b = statics[i];
      const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
      const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
    }
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.progress < 0.55) {
        const b = d.collider;
        const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
        const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
      }
    }
    const trees = this.house.treeColliders;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const md = r + t.r;
      if ((x - t.x) * (x - t.x) + (z - t.z) * (z - t.z) < md * md) return true;
    }
    return false;
  }

  _updateMovement(dt) {
    if (this.mapOpen) return;

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _input.set(0, 0, 0);

    // Keyboard input
    if (this.keys.has('w') || this.keys.has('arrowup')) _input.add(_forward);
    if (this.keys.has('s') || this.keys.has('arrowdown')) _input.sub(_forward);
    if (this.keys.has('d') || this.keys.has('arrowright')) _input.add(_right);
    if (this.keys.has('a') || this.keys.has('arrowleft')) _input.sub(_right);

    // POCO F7 Analog Virtual Thumbstick input
    if (Math.abs(this.virtualMove.x) > 0.04 || Math.abs(this.virtualMove.z) > 0.04) {
      _input.addScaledVector(_right, this.virtualMove.x);
      _input.addScaledVector(_forward, -this.virtualMove.z);
    }

    const sprinting = (this.keys.has('shift') || this.virtualMove.sprint) && !this.crouching;
    const maxSpeed = this.crouching ? 1.05 : (sprinting ? 2.75 : 1.72);
    const mag = Math.min(1.0, _input.length());
    if (mag > 0.01) {
      _input.normalize().multiplyScalar(maxSpeed * mag);
      this.playerVel.lerp(_input, Math.min(1, dt * 11));
    } else {
      this.playerVel.lerp(_zero, Math.min(1, dt * 13));
    }

    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (!this._collidesAt(nextX, this.playerPos.z)) this.playerPos.x = nextX;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (!this._collidesAt(this.playerPos.x, nextZ)) this.playerPos.z = nextZ;

    // Smooth vertical floor & crouch lerp
    const targetFloorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
    this.floorY += (targetFloorY - this.floorY) * Math.min(1, dt * 10);
    this.eyeHeight += (this.targetEyeHeight - this.eyeHeight) * Math.min(1, dt * 9);

    // Natural head-bob + stride-synchronized material footsteps!
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (horizSpeed > 0.16) {
      this.bobPhase += dt * (horizSpeed * 4.5);
      this.bobAmount += (1 - this.bobAmount) * Math.min(1, dt * 8);
      const curSin = Math.sin(this.bobPhase);
      if (this.prevBobSin > -0.82 && curSin <= -0.82) {
        this.audio.playFootstep(this._getSurfaceMaterial(this.playerPos.x, this.playerPos.z));
      }
      this.prevBobSin = curSin;
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 8);
      this.prevBobSin = 0;
    }
  }

  _updateCameraTransform(elapsed) {
    const bobY = Math.sin(this.bobPhase) * 0.023 * this.bobAmount;
    const bobSide = Math.cos(this.bobPhase * 0.5) * 0.010 * this.bobAmount;
    const idleBreath = Math.sin(elapsed * 1.35) * 0.004;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.camera.position.set(
      this.playerPos.x + rightX * bobSide,
      this.floorY + this.eyeHeight + bobY + idleBreath,
      this.playerPos.z + rightZ * bobSide,
    );
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    if (this.flashlightTarget) {
      this.flashlightTarget.position.set(
        Math.cos(this.bobPhase * 0.5) * 0.14 * this.bobAmount,
        -0.08 + Math.sin(this.bobPhase) * 0.12 * this.bobAmount,
        -6.0,
      );
    }
  }

  _updateWorldSystems(dt, elapsed) {
    // Animate doors and track whether any door moved (triggers demand-driven shadow refresh)
    let anyDoorAnimating = false;
    const doorOpenMap = {};
    for (const d of this.house.interactiveDoors) {
      doorOpenMap[d.id] = d.progress > 0.12;
      const target = d.isOpen ? 1 : 0;
      if (Math.abs(d.progress - target) > 0.002) {
        anyDoorAnimating = true;
        d.progress += (target - d.progress) * Math.min(1, dt * 7.5);
        const eased = d.progress * d.progress * (3 - 2 * d.progress);
        if (d.kind === 'swing') d.pivot.rotation.y = d.openAngle * eased;
        else if (d.axis === 'x') d.pivot.position.x = d.closedPos.x + d.slideDelta * eased;
        else d.pivot.position.z = d.closedPos.z + d.slideDelta * eased;
      }
    }

    // Update GPU wind uniform & volumetric god-rays/mist
    this.house.windTimeUniform.value = elapsed;
    this.atmosphere.update(elapsed);

    // Subtle breathing flicker on Washi Paper Lantern
    const lanternProp = this.house.interactiveProps.find((p) => p.id === 'lantern');
    const lanternOn = Boolean(lanternProp && lanternProp.isOn);
    const lanternEntry = this.house.interiorLights.find((l) => l.name === 'Tatami_Lantern');
    if (lanternEntry && lanternOn && lanternEntry.light.visible) {
      lanternEntry.light.intensity += (Math.sin(elapsed * 3.1) * 0.05 + Math.sin(elapsed * 7.3) * 0.025) * dt * 10;
    }

    // Drifting exterior forest fireflies
    const posAttr = this.house.fireflies.geometry.attributes.position;
    const seeds = this.house.ffSeeds;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      posAttr.setXYZ(
        i,
        s.x + Math.sin(elapsed * s.sp + s.ph) * 0.45,
        s.y + Math.sin(elapsed * (s.sp * 1.3) + s.ph) * 0.28,
        s.z + Math.cos(elapsed * (s.sp * 0.9) + s.ph) * 0.45,
      );
    }
    posAttr.needsUpdate = true;

    // Acoustic occlusion: wind gets clearer outside, near open Front Door D1, or near South Terrace Window W2
    const outside = this.playerPos.z < 0.0 || this.playerPos.z > 10.0;
    const d1Boost = doorOpenMap.D1 ? Math.max(0, 1 - Math.hypot(this.playerPos.x - 0.95, this.playerPos.z) / 4.0) * 0.85 : 0;
    const w2Boost = Math.max(0, 1 - Math.abs(this.playerPos.z - 9.85) / 4.5) * 0.35;
    this.audio.updateOcclusion(outside ? 1.0 : Math.min(1.0, Math.max(d1Boost, w2Boost)));

    return { anyDoorAnimating, doorOpenMap, lanternOn };
  }

  _detectCurrentRoom() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    if (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0) {
      return { id: 'exterior', code: 'EXT', nameJp: '深い森・玄関ポーチ', area: 50.0, jo: 0, ch: '森の奥' };
    }
    for (let i = ROOMS.length - 1; i >= 0; i--) {
      const r = ROOMS[i];
      if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return r;
    }
    return null;
  }

  _startLoop() {
    let prev = performance.now();
    const start = prev;
    const tick = (now) => {
      this.rafId = requestAnimationFrame(tick);
      const rawDtMs = now - prev;
      const dt = Math.min(0.05, rawDtMs / 1000);
      const elapsed = (now - start) / 1000;
      prev = now;

      this._updateMovement(dt);
      this._updateCameraTransform(elapsed);
      const { anyDoorAnimating, doorOpenMap, lanternOn } = this._updateWorldSystems(dt, elapsed);

      const room = this._detectCurrentRoom();
      const cameraMoved = Math.abs(this.playerPos.x - this.prevCamX) > 0.003 ||
        Math.abs(this.playerPos.z - this.prevCamZ) > 0.003 ||
        Math.abs(this.yaw - this.prevYaw) > 0.003 ||
        Math.abs(this.pitch - this.prevPitch) > 0.003;
      this.prevCamX = this.playerPos.x;
      this.prevCamZ = this.playerPos.z;
      this.prevYaw = this.yaw;
      this.prevPitch = this.pitch;

      // POCO F7 Adaptive DRS + Demand-Driven Shadows + Spatial Room Light Culler
      this.adaptive.update(rawDtMs, dt, {
        anyDoorAnimating,
        flashlightOn: this.flashlightOn,
        cameraMoved,
        roomId: room ? room.id : null,
        doorOpenMap,
        lanternOn,
      });

      // Eye dark-adaptation target exposure (gently brighter in deep unlit hallway/exterior, calmer near bright lantern/flashlight)
      const isDarkZone = room && (room.id === 'exterior' || room.id === 'passage' || room.id === 'wc');
      const targetExposure = this.flashlightOn ? 1.06 : (isDarkZone ? 1.24 : 1.14);
      this.postfx.render(this.scene, this.camera, elapsed, targetExposure);

      // Crosshair aim detection
      const aim = this.mapOpen ? null : this._raycastInteractable();
      if (this.callbacks.onAimChange) this.callbacks.onAimChange(aim);

      // Update room HUD & 2D map pose
      if (this.callbacks.onPoseUpdate) {
        this.camera.getWorldDirection(_lookDir);
        this.callbacks.onPoseUpdate({
          x: this.playerPos.x,
          z: this.playerPos.z,
          dx: _lookDir.x,
          dz: _lookDir.z,
          room,
        });
      }

      // Throttled telemetry push (fires on frame 1 right after postfx.render, then 4Hz)
      this.telemetryTimer += dt;
      if (!this.firstTelemetryPushed || this.telemetryTimer >= 0.25) {
        this.firstTelemetryPushed = true;
        this.telemetryTimer = 0;
        if (this.callbacks.onTelemetry) {
          this.callbacks.onTelemetry({
            ...this.adaptive.getTelemetry(),
            batch: this.house.batchStats,
          });
        }
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
