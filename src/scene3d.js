import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHouse3D } from './buildHouse3d.js';
import { createVolumetricAtmosphere } from './volumetricAtmosphere.js';
import { SinglePassPostFX } from './postfx.js';
import { AdaptiveMobileEngine } from './adaptiveEngine.js';
import { SpatialForestAudio } from './audioEngine.js';
import { FLOORS, HOUSE, getAtticCeilingY } from './planData.js';

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

    // 6-level stack: 0=B1F, 1=1F (Spawn!), 2=2F, 3=3F, 4=4F, 5=RF (屋根裏部屋)
    this.currentFloor = HOUSE.spawnFloor; // 1 (1F LDK)
    this.activeFlight = null; // null or 0(ST0), 1(ST1), 2(ST2), 3(ST3), 4(ST4)
    this.playerPos = new THREE.Vector3(1.62, 0.0, 6.25);
    this.playerVel = new THREE.Vector3();
    this.floorY = 0.0;
    this.eyeHeight = 1.56;
    this.targetEyeHeight = 1.56;
    this.crouching = false;
    this.playerRadius = 0.20;

    this.yaw = Math.PI - 0.24;
    this.pitch = -0.04;
    this.prevCamX = 0;
    this.prevCamZ = 0;
    this.prevYaw = 0;
    this.prevPitch = 0;

    this.bobPhase = 0;
    this.bobAmount = 0;
    this.prevBobSin = 0;

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
    this.adaptive.markShadowsDirty();
    this._startLoop();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050a10);
    this.scene.fog = new THREE.FogExp2(0x070e16, 0.030);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.042;
    pmrem.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(64, w / Math.max(1, h), 0.06, 120);
    this.scene.add(this.camera);
  }

  _initDarkForestLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x2b4566, 0x090807, 0.13);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0x7ea8d8, 1.38);
    this.moonLight.position.set(-8.0, 24.0, 26.0);
    this.moonLight.target.position.set(2.5, 5.5, 6.0);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 58;
    this.moonLight.shadow.camera.left = -16;
    this.moonLight.shadow.camera.right = 16;
    this.moonLight.shadow.camera.top = 20;
    this.moonLight.shadow.camera.bottom = -16;
    this.moonLight.shadow.bias = -0.0007;
    this.moonLight.shadow.normalBias = 0.03;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    const northMoon = new THREE.DirectionalLight(0x52759e, 0.62);
    northMoon.position.set(6.5, 19.0, -16.0);
    this.scene.add(northMoon);
  }

  _initFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfff0d4, 0.0, 22.0, Math.PI * 0.22, 0.54, 1.40);
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
    this.flashlight.intensity = this.flashlightOn ? 6.8 : 0.0;
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

  setPose(x, z, yaw, pitch = -0.04, floorIdx = null) {
    if (floorIdx !== null && floorIdx >= 0 && floorIdx < FLOORS.length) {
      this.currentFloor = floorIdx;
      this.activeFlight = null;
      if (this.adaptive) this.adaptive.snapFloorLights(floorIdx);
    }
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
          } catch (_) {}
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

    window.addEventListener('pointerup', () => { this.isDragging = false; });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === dom;
      if (this.callbacks.onLockChange) this.callbacks.onLockChange(this.isLocked);
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { if (this.callbacks.onToggleMap) this.callbacks.onToggleMap(); return; }
      if (k === 'p') { if (this.callbacks.onToggleTelemetry) this.callbacks.onToggleTelemetry(); return; }
      if (this.mapOpen) {
        if (k === 'escape' && this.callbacks.onToggleMap) this.callbacks.onToggleMap();
        return;
      }
      if (k === 'f') { this.toggleFlashlight(); return; }
      if (k === 'c') { this.toggleCrouch(); return; }
      if (k === 'e' || k === ' ') { if (this.interact()) e.preventDefault(); return; }
      if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.audio.init();
        this.keys.add(k);
      }
    });

    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });

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
      ...this.house.interactiveDoors.filter((d) => Math.abs(d.floor - this.currentFloor) <= 1).map((d) => d.mesh),
      ...this.house.interactiveProps.filter((p) => p.floor === this.currentFloor).map((p) => p.mesh),
    ];
    this.raycaster.setFromCamera(this.centerNDC, this.camera);
    this.raycaster.far = 2.65;
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    if (obj.userData.doorId) {
      const door = this.house.interactiveDoors.find((d) => d.id === obj.userData.doorId);
      if (door) {
        const shortName = door.label.split(' ')[1] || door.label;
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
    const sb = HOUSE.stairBox;
    if (this.activeFlight !== null) {
      const t = Math.max(0, Math.min(1, (sb.bottomZ - z) / (sb.bottomZ - sb.topZ)));
      const y0 = FLOORS[this.activeFlight].baseY;
      const y1 = FLOORS[this.activeFlight + 1].baseY;
      return y0 + (y1 - y0) * t;
    }

    const baseY = FLOORS[this.currentFloor].baseY;
    if (this.currentFloor === 1) { // 1F
      if (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0) return -0.18;
      if (x < 2.15 && z < 1.35) return -0.12;
      if (x > 3.44 && z > 8.44) return 0.32;
      return 0.0;
    }
    if (this.currentFloor === 2) { // 2F
      if (x > 3.55 && z > 3.50 && z < 5.95) return baseY - 0.02;
      return baseY;
    }
    if (this.currentFloor === 4) { // 4F Balcony slight weather step-down (-40mm)
      if (z > 9.95) return baseY - 0.04;
      return baseY;
    }
    return baseY;
  }

  _getSurfaceMaterial(x, z) {
    if (this.activeFlight !== null) return this.activeFlight === 0 ? 'tile' : 'wood';
    if (this.currentFloor === 0) return 'tile'; // B1F hard grey cement footsteps!
    if (this.currentFloor === 1) {
      if (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0) return 'earth';
      if (x > 3.44 && z > 8.44) return 'tatami';
      if ((x < 2.15 && z < 1.35) || (x > 2.20 && z < 5.25)) return 'tile';
      return 'wood';
    }
    if (this.currentFloor === 2) {
      if (x > 2.20 && z > 3.50 && z < 5.95) return 'tile';
      if (x > 2.20 && z < 3.50) return 'tatami';
      return 'wood';
    }
    if (this.currentFloor === 3) {
      if (x > 2.20 && z < 3.50) return 'tatami';
      if (x > 2.20 && x < 3.50 && z > 3.50 && z < 5.95) return 'tile';
      return 'wood';
    }
    if (this.currentFloor === 4) {
      if (x < 2.15 && z < 1.55) return 'tatami'; // listening room carpet
      return 'wood';
    }
    if (x > 1.30 && x < 3.70 && z > 6.15 && z < 8.75) return 'tatami';
    return 'wood';
  }

  _collidesAt(x, z) {
    const r = this.playerRadius;
    const r2 = r * r;
    const sb = HOUSE.stairBox;

    if (this.activeFlight !== null) {
      if (x < sb.minX + r || x > sb.maxX - r) return true;
      return false;
    }

    if (this.currentFloor === 0) {
      // B1F subterranean bounds: Z=2.45..9.85, X=0.15..4.85
      if (x < 0.15 + r || x > 4.85 - r || z < 2.45 + r || z > 9.85 - r) return true;
    } else if (this.currentFloor === 1) {
      // 1F permits walking out into deep forest via Front Door D1-1
      if (x < -3.5 || x > 8.5 || z < -6.5 || z > 12.6) return true;
    } else if (this.currentFloor === 4) {
      // 4F permits walking directly out onto the 1m×2m South-East Canopy Balcony (X=2.65..4.65, Z=10.0..11.0)!
      const bal = HOUSE.balcony4F;
      const onBalcony = z >= 9.75 && x >= bal.minX + r && x <= bal.maxX - r && z <= bal.maxZ - r;
      const inInterior = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
      if (!inInterior && !onBalcony) return true;
    } else {
      if (x < 0.15 + r || x > 4.85 - r || z < 0.15 + r || z > 9.85 - r) return true;
    }

    const statics = this.house.collidersByFloor[this.currentFloor] || [];
    for (let i = 0; i < statics.length; i++) {
      const b = statics[i];
      const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
      const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
      if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
    }

    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.floor === this.currentFloor && d.progress < 0.55) {
        const b = d.collider;
        const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
        const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
      }
    }

    if (this.currentFloor === 1) {
      const trees = this.house.treeColliders;
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        const md = r + t.r;
        if ((x - t.x) * (x - t.x) + (z - t.z) * (z - t.z) < md * md) return true;
      }
    }
    return false;
  }

  _updateStairTransitions(prevZ) {
    const sb = HOUSE.stairBox;
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    const inStairX = x >= sb.minX && x <= sb.maxX;
    const maxFloor = FLOORS.length - 1; // 5 (Attic)

    if (this.activeFlight === null) {
      if (inStairX) {
        // Stepping North onto bottom of upward flight (B1F->1F, 1F->2F, 2F->3F, 3F->4F, 4F->Attic)
        if (prevZ >= sb.bottomZ - 0.04 && z < sb.bottomZ && this.currentFloor < maxFloor) {
          this.activeFlight = this.currentFloor;
        }
        // Stepping South onto top of downward flight (1F->B1F, 2F->1F, 3F->2F, 4F->3F, Attic->4F)
        else if (prevZ <= sb.topZ + 0.04 && z > sb.topZ && this.currentFloor > 0) {
          this.activeFlight = this.currentFloor - 1;
        }
      }
    } else {
      if (z <= sb.topZ) {
        this.currentFloor = this.activeFlight + 1;
        this.activeFlight = null;
      } else if (z >= sb.bottomZ) {
        this.currentFloor = this.activeFlight;
        this.activeFlight = null;
      }
    }
  }

  _updateMovement(dt) {
    if (this.mapOpen) return;

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _input.set(0, 0, 0);

    if (this.keys.has('w') || this.keys.has('arrowup')) _input.add(_forward);
    if (this.keys.has('s') || this.keys.has('arrowdown')) _input.sub(_forward);
    if (this.keys.has('d') || this.keys.has('arrowright')) _input.add(_right);
    if (this.keys.has('a') || this.keys.has('arrowleft')) _input.sub(_right);

    if (Math.abs(this.virtualMove.x) > 0.04 || Math.abs(this.virtualMove.z) > 0.04) {
      _input.addScaledVector(_right, this.virtualMove.x);
      _input.addScaledVector(_forward, -this.virtualMove.z);
    }

    const sprinting = (this.keys.has('shift') || this.virtualMove.sprint) && !this.crouching;
    const stairSlow = this.activeFlight !== null ? 0.85 : 1.0;
    const maxSpeed = (this.crouching ? 1.05 : (sprinting ? 2.75 : 1.75)) * stairSlow;
    const mag = Math.min(1.0, _input.length());
    if (mag > 0.01) {
      _input.normalize().multiplyScalar(maxSpeed * mag);
      this.playerVel.lerp(_input, Math.min(1, dt * 11));
    } else {
      this.playerVel.lerp(_zero, Math.min(1, dt * 13));
    }

    const prevZ = this.playerPos.z;
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    if (!this._collidesAt(nextX, this.playerPos.z)) this.playerPos.x = nextX;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    if (!this._collidesAt(this.playerPos.x, nextZ)) this.playerPos.z = nextZ;

    this._updateStairTransitions(prevZ);

    const targetFloorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
    const lerpRate = this.activeFlight !== null ? 18 : 11;
    this.floorY += (targetFloorY - this.floorY) * Math.min(1, dt * lerpRate);

    let desiredEye = this.crouching ? 1.04 : 1.56;
    // Slight natural ducking under B1F low beams / Attic outer eaves
    if (this.currentFloor === 0 && !this.crouching) {
      desiredEye = 1.50; // Keeps eye comfortably beneath low 2.02m cement ceiling & 1.88m door lintels
    } else if (this.currentFloor === HOUSE.atticFloor && this.activeFlight === null) {
      const ceilClearance = getAtticCeilingY(this.playerPos.x) - HOUSE.atticBaseY - 0.24;
      desiredEye = Math.min(desiredEye, Math.max(0.95, ceilClearance));
    }
    this.eyeHeight += (desiredEye - this.eyeHeight) * Math.min(1, dt * 9);

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

    this.house.windTimeUniform.value = elapsed;
    this.atmosphere.update(elapsed);

    const propStates = {};
    for (const p of this.house.interactiveProps) propStates[p.id] = p.isOn;

    for (const lname of ['Tatami_Lantern', 'Attic_Lantern']) {
      const entry = this.house.interiorLights.find((l) => l.name === lname);
      const isOn = lname === 'Tatami_Lantern' ? propStates.lantern_1f : propStates.lantern_attic;
      if (entry && isOn && entry.light.visible) {
        entry.light.intensity += (Math.sin(elapsed * 3.1) * 0.05 + Math.sin(elapsed * 7.3) * 0.025) * dt * 9;
      }
    }

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

    // Acoustic occlusion: eerie subterranean silence in B1F, rushing mountain wind on 4F Balcony & exterior!
    if (this.currentFloor === 0) {
      this.audio.updateOcclusion(0.02);
    } else {
      const outside1F = this.currentFloor === 1 && (this.playerPos.z < 0.0 || this.playerPos.z > 10.0);
      const onBalcony4F = this.currentFloor === 4 && this.playerPos.z > 9.90;
      const d1Boost = this.currentFloor === 1 && doorOpenMap['D1-1']
        ? Math.max(0, 1 - Math.hypot(this.playerPos.x - 1.10, this.playerPos.z) / 4.0) * 0.85 : 0;
      const balDoorBoost = this.currentFloor === 4 && doorOpenMap['D4-6'] ? 0.65 : 0;
      const atticWindBoost = this.currentFloor === 5 ? 0.48 : 0;
      const windowBoost = Math.max(0, 1 - Math.abs(this.playerPos.z - 9.85) / 4.5) * 0.35;
      this.audio.updateOcclusion((outside1F || onBalcony4F) ? 1.0 : Math.min(1.0, Math.max(d1Boost, balDoorBoost, windowBoost, atticWindBoost)));
    }

    return { anyDoorAnimating, doorOpenMap, propStates };
  }

  _detectCurrentRoom() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    if (this.activeFlight !== null) {
      const fNames = ['B1F↔1F 地下コンクリート階段', '1F↔2F 階段', '2F↔3F 階段', '3F↔4F 階段', '4F↔屋根裏 階段'];
      return { id: 'stair', code: `ST${this.activeFlight}`, floor: this.currentFloor, nameJp: fNames[this.activeFlight] };
    }
    if (this.currentFloor === 1 && (z < 0.0 || z > 10.0 || x < 0.0 || x > 5.0)) {
      return { id: 'exterior', code: 'EXT', floor: 1, nameJp: '深い森・苔石アプローチ' };
    }
    const floorRooms = FLOORS[this.currentFloor].rooms;
    for (let i = floorRooms.length - 1; i >= 0; i--) {
      const r = floorRooms[i];
      if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return r;
    }
    return floorRooms[0] || null;
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
      const { anyDoorAnimating, doorOpenMap, propStates } = this._updateWorldSystems(dt, elapsed);

      const room = this._detectCurrentRoom();
      const cameraMoved = Math.abs(this.playerPos.x - this.prevCamX) > 0.003 ||
        Math.abs(this.playerPos.z - this.prevCamZ) > 0.003 ||
        Math.abs(this.yaw - this.prevYaw) > 0.003 ||
        Math.abs(this.pitch - this.prevPitch) > 0.003;
      this.prevCamX = this.playerPos.x;
      this.prevCamZ = this.playerPos.z;
      this.prevYaw = this.yaw;
      this.prevPitch = this.pitch;

      this.adaptive.update(rawDtMs, dt, {
        anyDoorAnimating,
        flashlightOn: this.flashlightOn,
        cameraMoved,
        currentFloor: this.currentFloor,
        activeFlight: this.activeFlight,
        doorOpenMap,
        propStates,
      });

      // Keep B1F dimly lit & atmospheric; slightly boost hallway visibility; calm exposure with flashlight ON
      let targetExposure = 1.15;
      if (this.flashlightOn) targetExposure = 1.06;
      else if (this.currentFloor === 0) targetExposure = 1.02;
      else if (room && (room.id === 'exterior' || room.id.includes('passage') || room.id.includes('gallery') || room.id === 'stair')) {
        targetExposure = 1.24;
      }
      this.postfx.render(this.scene, this.camera, elapsed, targetExposure);

      const aim = this.mapOpen ? null : this._raycastInteractable();
      if (this.callbacks.onAimChange) this.callbacks.onAimChange(aim);

      if (this.callbacks.onPoseUpdate) {
        this.camera.getWorldDirection(_lookDir);
        this.callbacks.onPoseUpdate({
          x: this.playerPos.x,
          z: this.playerPos.z,
          dx: _lookDir.x,
          dz: _lookDir.z,
          floor: this.currentFloor,
          floorCode: FLOORS[this.currentFloor].code,
          room,
        });
      }

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
