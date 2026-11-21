import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHouse3D } from './buildHouse3d.js';
import { createVolumetricAtmosphere } from './volumetricAtmosphere.js';
import { SinglePassPostFX } from './postfx.js';
import { AdaptiveMobileEngine } from './adaptiveEngine.js';
import { SpatialForestAudio } from './audioEngine.js';
import {
  FLOORS, HOUSE, ANNEX, ANNEX_FLOORS, getAnnexAtticCeilingY,
  STORAGE, STORAGE_FLOORS, CAMPER, CAMPER_SHEETS, getAtticCeilingY,
} from './planData.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _input = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _lookDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Strict Static Building World AABBs for Movable Giant Camper OBB Collision
const STATIC_VEHICLE_OBSTACLES = [
  { minX: -0.15, maxX: 5.45, minZ: -1.35, maxZ: 11.45 },  // Main Tower + North Porch + South Engawa + AC
  { minX: -8.70, maxX: -2.45, minZ: -0.15, maxZ: 10.10 }, // Neighbor Annex + Porch + 3F Balconies footprint
  { minX: 6.48, maxX: 9.52, minZ: -2.05, maxZ: 0.92 },    // Concrete Warehouse + STS1 Stair + 2F Landing
];
const LANTERN_OBSTACLES = [
  { x: -2.25, z: 0.25, r: 0.34 },
  { x: -2.25, z: 5.10, r: 0.34 },
];

export class FirstPersonHouseExplorer {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // 4-Structure Forest Compound:
    // - Main Tower (0=B1F..5=RF, X=0..5)
    // - Neighbor Annex (1=1F..4=Attic, X=-7.6..-2.6)
    // - Concrete Storage Warehouse (1=1F..2=2F at Y=2.12, X=6.6..8.6)
    // - Movable Giant Overland Camper (1=1F 14 rooms..2=2F 2 lofts, 2.7×7.5×H3.4m)
    this.currentFloor = HOUSE.spawnFloor; // 1 (1F LDK)
    this.activeFlight = null;
    this.activeBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper' | 'courtyard'
    this.activeStairBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper'
    this.playerPos = new THREE.Vector3(1.62, 0.0, 6.25);
    this.playerVel = new THREE.Vector3();
    this.floorY = 0.0;
    this.eyeHeight = 1.56;
    this.targetEyeHeight = 1.56;
    this.crouching = false;
    this.playerRadius = 0.20;

    this.drivingCamper = false;
    this.bumpCooldown = 0;
    this.camperBlockedTimer = 0;

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
    this.moonLight.position.set(-10.0, 24.0, 26.0);
    this.moonLight.target.position.set(0.5, 5.0, 4.5);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 66;
    this.moonLight.shadow.camera.left = -22;
    this.moonLight.shadow.camera.right = 22;
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
    if (this.drivingCamper) {
      this.toggleCamperDrive(false);
      return true;
    }
    return this._interactAimed();
  }

  worldToCamperLocal(wx, wz) {
    const cp = this.house.camper.pose;
    const dx = wx - cp.cx;
    const dz = wz - cp.cz;
    const c = Math.cos(cp.yaw);
    const s = Math.sin(cp.yaw);
    return {
      lx: dx * c - dz * s + CAMPER.width * 0.5,
      lz: dx * s + dz * c + CAMPER.length * 0.5,
    };
  }

  camperLocalToWorld(lx, lz) {
    const cp = this.house.camper.pose;
    const rx = lx - CAMPER.width * 0.5;
    const rz = lz - CAMPER.length * 0.5;
    const c = Math.cos(cp.yaw);
    const s = Math.sin(cp.yaw);
    return {
      x: cp.cx + rx * c + rz * s,
      z: cp.cz - rx * s + rz * c,
    };
  }

  toggleCamperHeadlights(force = null) {
    const camper = this.house.camper;
    camper.headlightsOn = force !== null ? force : !camper.headlightsOn;
    camper.headlights.forEach((h) => {
      h.intensity = camper.headlightsOn ? 9.5 : 0.0;
    });
    this.adaptive.markShadowsDirty();
    this.audio.playClick(camper.headlightsOn);
    if (this.callbacks.onDriveChange) {
      this.callbacks.onDriveChange(this.drivingCamper, {
        speedKmh: Math.round(Math.abs(camper.speed) * 3.6),
        headlightsOn: camper.headlightsOn,
        colliding: this.camperBlockedTimer > 0,
      });
    }
  }

  toggleCamperDrive(force = null) {
    const camper = this.house.camper;
    const next = force !== null ? force : !this.drivingCamper;
    if (next === this.drivingCamper) return;
    this.drivingCamper = next;
    camper.driveProp.isOn = next;
    camper.speed = 0;

    if (next) {
      // Automatically close exterior RV entry door DC-1 when departing
      const dc1 = this.house.interactiveDoors.find((d) => d.id === 'DC-1');
      if (dc1) dc1.isOpen = false;
      this.currentFloor = 1;
      this.activeFlight = null;
      this.activeBuilding = 'camper';
      const seatW = this.camperLocalToWorld(0.72, 0.88);
      this.playerPos.set(seatW.x, 0, seatW.z);
      this.floorY = CAMPER.floor1WorldY;
      this.eyeHeight = 1.20;
      this.yaw = camper.pose.yaw;
      this.pitch = -0.10;
      this.toggleCamperHeadlights(true);
    } else {
      const standW = this.camperLocalToWorld(1.35, 0.88);
      this.playerPos.set(standW.x, 0, standW.z);
      this.floorY = CAMPER.floor1WorldY;
      this.eyeHeight = 1.54;
      this.audio.updateEngine(false, 0);
    }
    if (this.callbacks.onDriveChange) {
      this.callbacks.onDriveChange(this.drivingCamper, {
        speedKmh: 0,
        headlightsOn: camper.headlightsOn,
        colliding: false,
      });
    }
  }

  setCamperPose(cx, cz, yaw = 0) {
    const camper = this.house.camper;
    if (this._camperCollidesAt(cx, cz, yaw)) return false;
    camper.pose.cx = cx;
    camper.pose.cz = cz;
    camper.pose.yaw = yaw;
    camper.root.position.set(cx, 0, cz);
    camper.root.rotation.y = yaw;
    this.adaptive.markShadowsDirty();
    return true;
  }

  /**
   * Exact 2D Separating Axis Theorem (SAT) OBB vs AABB test for strict vehicle collision.
   */
  _obbIntersectsAABB(cx, cz, hw, hl, yaw, box) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // OBB local X axis = (c, -s), local Z axis = (s, c)
    const bx = (box.minX + box.maxX) * 0.5;
    const bz = (box.minZ + box.maxZ) * 0.5;
    const bhw = (box.maxX - box.minX) * 0.5;
    const bhl = (box.maxZ - box.minZ) * 0.5;
    const dx = cx - bx;
    const dz = cz - bz;

    // 1. World X axis
    const projX = hw * Math.abs(c) + hl * Math.abs(s);
    if (Math.abs(dx) > bhw + projX) return false;
    // 2. World Z axis
    const projZ = hw * Math.abs(s) + hl * Math.abs(c);
    if (Math.abs(dz) > bhl + projZ) return false;
    // 3. OBB local X axis (c, -s)
    const distLX = Math.abs(dx * c - dz * s);
    const boxProjLX = bhw * Math.abs(c) + bhl * Math.abs(s);
    if (distLX > hw + boxProjLX) return false;
    // 4. OBB local Z axis (s, c)
    const distLZ = Math.abs(dx * s + dz * c);
    const boxProjLZ = bhw * Math.abs(s) + bhl * Math.abs(c);
    if (distLZ > hl + boxProjLZ) return false;

    return true;
  }

  /**
   * STRICT 100% OBB Collision Test for the 2.70m × 7.50m Giant Camper against:
   * - All 3 static buildings (+ porches, engawa, balcony footprints, STS1 stair, 2F steel landing)
   * - All forest cedar tree trunks, boulders, stone lanterns, and compound forest perimeter!
   */
  _camperCollidesAt(ncx, ncz, nyaw) {
    const hw = CAMPER.width * 0.5 + 0.14;   // 1.49m half-width (strict body + 6x6 wheel fender flares!)
    const hl = CAMPER.length * 0.5 + 0.14;  // 3.89m half-length (includes front bull-bar & rear spare!)
    const c = Math.cos(nyaw);
    const s = Math.sin(nyaw);

    // 1. Strict Forest Perimeter Check on all 4 OBB corners
    const corners = [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]];
    for (let i = 0; i < 4; i++) {
      const wx = ncx + corners[i][0] * c + corners[i][1] * s;
      const wz = ncz - corners[i][0] * s + corners[i][1] * c;
      if (wx < -14.8 || wx > 15.2 || wz < -15.2 || wz > 14.8) return true;
    }

    // 2. Exact SAT OBB vs Static Building AABBs
    for (let i = 0; i < STATIC_VEHICLE_OBSTACLES.length; i++) {
      if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, STATIC_VEHICLE_OBSTACLES[i])) return true;
    }

    // 3. Exact OBB vs Circle (Stone Lanterns, Boulders, and ALL Cedar Tree Trunks!)
    const checkCircles = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const dx = o.x - ncx;
        const dz = o.z - ncz;
        const rx = dx * c - dz * s;
        const rz = dx * s + dz * c;
        const clx = rx < -hw ? -hw : (rx > hw ? hw : rx);
        const clz = rz < -hl ? -hl : (rz > hl ? hl : rz);
        const ddx = rx - clx;
        const ddz = rz - clz;
        if (ddx * ddx + ddz * ddz < o.r * o.r) return true;
      }
      return false;
    };

    if (checkCircles(LANTERN_OBSTACLES)) return true;
    if (checkCircles(this.house.boulderColliders || [])) return true;
    if (checkCircles(this.house.treeColliders || [])) return true;

    return false;
  }

  _updateCamperDriving(dt) {
    const camper = this.house.camper;
    if (this.bumpCooldown > 0) this.bumpCooldown -= dt;
    if (this.camperBlockedTimer > 0) this.camperBlockedTimer -= dt;

    let throttle = 0;
    let steerIn = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) throttle += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) throttle -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) steerIn += 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) steerIn -= 1;

    if (Math.abs(this.virtualMove.z) > 0.06) throttle -= this.virtualMove.z;
    if (Math.abs(this.virtualMove.x) > 0.06) steerIn -= this.virtualMove.x;
    throttle = Math.max(-1, Math.min(1, throttle));
    steerIn = Math.max(-1, Math.min(1, steerIn));

    // Smooth steering wheel + front expedition axle turn
    const targetSteer = steerIn * 0.46;
    camper.steerAngle += (targetSteer - camper.steerAngle) * Math.min(1, dt * 6.5);
    camper.frontSteerPivots.forEach((p) => { p.rotation.y = camper.steerAngle; });
    camper.steerWheelGroup.rotation.z = camper.steerAngle * 2.4;

    // Heavy overland expedition acceleration & engine braking
    if (throttle > 0.02) {
      camper.speed += throttle * 4.2 * dt;
    } else if (throttle < -0.02) {
      camper.speed += throttle * 3.8 * dt;
    } else {
      camper.speed *= Math.max(0, 1 - dt * 4.0);
      if (Math.abs(camper.speed) < 0.03) camper.speed = 0;
    }
    camper.speed = Math.max(-3.0, Math.min(5.4, camper.speed));

    let blocked = false;
    if (Math.abs(camper.speed) > 0.005) {
      const subSteps = 3;
      const subDt = dt / subSteps;
      const wheelbase = 4.55;
      let totalMoved = 0;
      let totalDYaw = 0;

      for (let sIdx = 0; sIdx < subSteps; sIdx++) {
        const dist = camper.speed * subDt;
        const dYaw = (dist / wheelbase) * Math.tan(camper.steerAngle);
        const nyaw = camper.pose.yaw + dYaw;
        // Forward direction of camper (-Z in local space) is (-sin(yaw), -cos(yaw))
        const ncx = camper.pose.cx - Math.sin(nyaw) * dist;
        const ncz = camper.pose.cz - Math.cos(nyaw) * dist;

        if (!this._camperCollidesAt(ncx, ncz, nyaw)) {
          camper.pose.cx = ncx;
          camper.pose.cz = ncz;
          camper.pose.yaw = nyaw;
          totalMoved += dist;
          totalDYaw += dYaw;
        } else {
          // Strict zero-penetration halt!
          camper.speed = 0;
          blocked = true;
          this.camperBlockedTimer = 0.65;
          if (this.bumpCooldown <= 0) {
            this.audio.playBump();
            if (navigator.vibrate) navigator.vibrate(25);
            this.bumpCooldown = 0.45;
          }
          break;
        }
      }

      if (Math.abs(totalMoved) > 0.0001) {
        camper.root.position.set(camper.pose.cx, 0, camper.pose.cz);
        camper.root.rotation.y = camper.pose.yaw;
        const wheelSpin = totalMoved / CAMPER.wheelRadius;
        camper.wheelMeshes.forEach((w) => { w.rotation.x -= wheelSpin; });
        this.yaw += totalDYaw;
        this.adaptive.markShadowsDirty();
      }
    }

    // Lock player smoothly at the driver's captain seat looking over steering wheel & OLED dash
    const seatW = this.camperLocalToWorld(0.72, 0.88);
    this.playerPos.set(seatW.x, 0, seatW.z);
    this.floorY = CAMPER.floor1WorldY;
    this.eyeHeight += (1.20 - this.eyeHeight) * Math.min(1, dt * 10);
    this.bobAmount *= 0.85;
    this.audio.updateEngine(true, Math.abs(camper.speed) / 5.4);

    if (this.callbacks.onDriveChange) {
      this.callbacks.onDriveChange(true, {
        speedKmh: Math.round(Math.abs(camper.speed) * 3.6),
        headlightsOn: camper.headlightsOn,
        colliding: blocked || this.camperBlockedTimer > 0,
      });
    }
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
    }
    this.playerPos.set(x, 0, z);
    this.activeBuilding = this._getBuildingAt(x, z);
    if (this.adaptive) this.adaptive.snapFloorLights(this.currentFloor, this.activeBuilding);
    this.floorY = this._computeFloorY(x, z);
    this.eyeHeight = this._computeDesiredEyeHeight(x, z);
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
      if (k === 'h') { this.toggleCamperHeadlights(); return; }
      if (k === 'f') {
        if (this.drivingCamper) this.toggleCamperHeadlights();
        else this.toggleFlashlight();
        return;
      }
      if (k === 'c' && !this.drivingCamper) { this.toggleCrouch(); return; }
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
    if (this.drivingCamper) return null;
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
    if (hit.kind === 'drive_exit') {
      this.toggleCamperDrive(false);
    } else if (hit.kind === 'door') {
      hit.item.isOpen = !hit.item.isOpen;
      this.audio.playDoor(hit.item.kind === 'pocket');
      this.adaptive.markShadowsDirty();
    } else if (hit.kind === 'prop') {
      if (hit.item.id === 'camper_drive') {
        this.toggleCamperDrive();
      } else {
        hit.item.toggle();
        this.audio.playClick(hit.item.isOn);
      }
    }
    if (navigator.vibrate) navigator.vibrate(12);
    return true;
  }

  _getBuildingAt(x, z) {
    if (this.drivingCamper) return 'camper';
    if (this.activeFlight !== null) return this.activeStairBuilding;

    const cl = this.worldToCamperLocal(x, z);
    const inCamperFootprint = cl.lx >= 0.0 && cl.lx <= CAMPER.width && cl.lz >= 0.0 && cl.lz <= CAMPER.length;

    if (this.currentFloor === 1) {
      if (inCamperFootprint) return 'camper';
      if (x >= 0.0 && x <= 5.0 && z >= 0.0 && z <= 10.0) return 'main';
      if (x >= ANNEX.originX && x <= ANNEX.originX + ANNEX.width && z >= ANNEX.originZ && z <= ANNEX.originZ + ANNEX.depth) {
        return 'annex';
      }
      if (x >= STORAGE.originX && x <= STORAGE.originX + STORAGE.width && z >= STORAGE.originZ && z <= STORAGE.originZ + STORAGE.depth) {
        return 'storage';
      }
      return 'courtyard';
    }
    if (this.currentFloor === 2) {
      if (inCamperFootprint) return 'camper';
      if (x < -1.2) return 'annex';
      if (x > 5.5) return 'storage';
      return 'main';
    }
    if (this.currentFloor === 3 || this.currentFloor === 4) {
      return x < -1.2 ? 'annex' : 'main';
    }
    return 'main';
  }

  _computeDesiredEyeHeight(x, z) {
    if (this.drivingCamper) return 1.20;
    // Giant Camper 2F Loft (CH 0.98m -> authentic crouched/seated loft posture 0.76m!)
    if (this.activeBuilding === 'camper' && this.currentFloor === 2 && this.activeFlight === null) {
      return 0.76;
    }
    if (this.activeBuilding === 'camper' && this.currentFloor === 1 && !this.crouching) {
      return 1.54;
    }

    let desiredEye = this.crouching ? 1.04 : 1.56;
    if (this.crouching) return desiredEye;

    // Low-ceiling 2m×2m Concrete Warehouse (CH 1.92m, door lintels 1.76m)
    if (this.activeBuilding === 'storage') {
      const sx = x - STORAGE.originX;
      const sz = z - STORAGE.originZ;
      if (sx >= -0.05 && sx <= STORAGE.width + 0.05 && sz >= -0.05 && sz <= STORAGE.depth + 0.05) {
        return 1.44;
      }
    }
    // B1F subterranean low concrete ceiling (CH 2.02m, door lintels 1.88m)
    if (this.currentFloor === 0) {
      return 1.50;
    }
    // Main Tower Attic 6寸 gable ceiling ducking near eaves
    if (this.currentFloor === HOUSE.atticFloor && this.activeFlight === null) {
      const ceilClearance = getAtticCeilingY(x) - HOUSE.atticBaseY - 0.24;
      return Math.min(desiredEye, Math.max(0.95, ceilClearance));
    }
    // Neighbor Annex Attic 6寸 gable ceiling ducking near eaves
    if (this.currentFloor === 4 && this.activeBuilding === 'annex' && this.activeFlight === null) {
      const ceilClearance = getAnnexAtticCeilingY(x - ANNEX.originX) - ANNEX.atticBaseY - 0.24;
      return Math.min(desiredEye, Math.max(0.95, ceilClearance));
    }
    return desiredEye;
  }

  _computeFloorY(x, z) {
    if (this.activeFlight !== null) {
      if (this.activeStairBuilding === 'camper') {
        const cl = this.worldToCamperLocal(x, z);
        const st = CAMPER.stairLocal;
        const t = Math.max(0, Math.min(1, (cl.lz - st.bottomZ) / (st.topZ - st.bottomZ)));
        return CAMPER.floor1WorldY + (CAMPER.loft2WorldY - CAMPER.floor1WorldY) * t;
      }
      if (this.activeStairBuilding === 'storage') {
        const ssb = STORAGE.stairWorld;
        const t = Math.max(0, Math.min(1, (ssb.bottomZ - z) / (ssb.bottomZ - ssb.topZ)));
        return 0.0 + STORAGE.floor2Y * t;
      }
      if (this.activeStairBuilding === 'annex') {
        const asb = ANNEX.stairWorld;
        const t = Math.max(0, Math.min(1, (asb.bottomZ - z) / (asb.bottomZ - asb.topZ)));
        const y0 = FLOORS[this.activeFlight].baseY;
        const y1 = FLOORS[this.activeFlight + 1].baseY;
        return y0 + (y1 - y0) * t;
      }
      const sb = HOUSE.stairBox;
      const t = Math.max(0, Math.min(1, (sb.bottomZ - z) / (sb.bottomZ - sb.topZ)));
      const y0 = FLOORS[this.activeFlight].baseY;
      const y1 = FLOORS[this.activeFlight + 1].baseY;
      return y0 + (y1 - y0) * t;
    }

    const cl = this.worldToCamperLocal(x, z);
    const inCamper = cl.lx >= 0.0 && cl.lx <= CAMPER.width && cl.lz >= 0.0 && cl.lz <= CAMPER.length;

    const baseY = FLOORS[this.currentFloor].baseY;
    if (this.currentFloor === 1) {
      if (inCamper) {
        if (cl.lx < 1.08 && cl.lz > 3.69 && cl.lz < 5.25) return CAMPER.floor1WorldY - 0.02; // Bath/Shower recess
        return CAMPER.floor1WorldY;
      }
      // Step-up ramp right on West fold-out RV steps outside DC-1!
      if (cl.lx >= -0.36 && cl.lx < 0.0 && cl.lz >= 2.15 && cl.lz <= 2.82) {
        const stepT = Math.max(0, Math.min(1, (cl.lx + 0.36) / 0.36));
        return -0.18 + (CAMPER.floor1WorldY + 0.18) * stepT;
      }
      if (x >= 0.0 && x <= 5.0 && z >= 0.0 && z <= 10.0) {
        if (x < 2.15 && z < 1.35) return -0.12;
        if (x > 3.44 && z > 8.44) return 0.32;
        return 0.0;
      }
      const lx = x - ANNEX.originX;
      const lz = z - ANNEX.originZ;
      if (lx >= 0.0 && lx <= ANNEX.width && lz >= 0.0 && lz <= ANNEX.depth) {
        if (lx >= 2.85 && lz <= 1.65) return -0.10;
        return 0.0;
      }
      const sx = x - STORAGE.originX;
      const sz = z - STORAGE.originZ;
      if (sx >= 0.0 && sx <= STORAGE.width && sz >= 0.0 && sz <= STORAGE.depth) {
        return 0.0;
      }
      return -0.18;
    }
    if (this.currentFloor === 2) {
      if (inCamper || this.activeBuilding === 'camper') return CAMPER.loft2WorldY;
      if (x > 5.5) return STORAGE.floor2Y;
      if (x < -1.2) return baseY;
      if (x > 3.55 && z > 3.50 && z < 5.95) return baseY - 0.02;
      return baseY;
    }
    if (this.currentFloor === 3) {
      if (x < -1.2) {
        const lx = x - ANNEX.originX;
        const lz = z - ANNEX.originZ;
        if (lz < 0.05 || lz > 7.95 || lx < 0.05) return baseY - 0.04;
      }
      return baseY;
    }
    if (this.currentFloor === 4) {
      if (x >= -1.2 && z > 9.95) return baseY - 0.04;
      return baseY;
    }
    return baseY;
  }

  _getSurfaceMaterial(x, z) {
    if (this.activeFlight !== null) {
      if (this.activeStairBuilding === 'storage') return 'tile';
      return this.activeStairBuilding === 'main' && this.activeFlight === 0 ? 'tile' : 'wood';
    }
    if (this.activeBuilding === 'camper') {
      const cl = this.worldToCamperLocal(x, z);
      if (this.currentFloor === 2) return cl.lz < 2.17 || cl.lz > 5.25 ? 'tatami' : 'wood';
      if (cl.lz < 1.25 || (cl.lx < 1.08 && cl.lz > 2.85) || (cl.lx > 1.62 && cl.lz > 2.85 && cl.lz < 6.05)) return 'tile';
      return 'wood';
    }
    if (this.currentFloor === 0) return 'tile';
    if (this.currentFloor === 1) {
      if (x >= 0.0 && x <= 5.0 && z >= 0.0 && z <= 10.0) {
        if (x > 3.44 && z > 8.44) return 'tatami';
        if ((x < 2.15 && z < 1.35) || (x > 2.20 && z < 5.25)) return 'tile';
        return 'wood';
      }
      const lx = x - ANNEX.originX;
      const lz = z - ANNEX.originZ;
      if (lx >= 0.0 && lx <= ANNEX.width && lz >= 0.0 && lz <= ANNEX.depth) {
        if (lz < 2.15 || (lx > 2.80 && lz < 4.00)) return 'tile';
        return 'wood';
      }
      const sx = x - STORAGE.originX;
      const sz = z - STORAGE.originZ;
      if (sx >= 0.0 && sx <= STORAGE.width && sz >= 0.0 && sz <= STORAGE.depth) {
        return 'tile';
      }
      return 'earth';
    }
    if (this.currentFloor === 2) {
      if (x > 5.5) return 'tile';
      if (x < -1.2) {
        const lx = x - ANNEX.originX;
        const lz = z - ANNEX.originZ;
        if (lx > 2.50 && lz > 2.30 && lz < 5.55) return 'tatami';
        return 'wood';
      }
      if (x > 2.20 && z > 3.50 && z < 5.95) return 'tile';
      if (x > 2.20 && z < 3.50) return 'tatami';
      return 'wood';
    }
    if (this.currentFloor === 3) {
      if (x < -1.2) {
        const lx = x - ANNEX.originX;
        const lz = z - ANNEX.originZ;
        if ((lx < 2.15 && lz < 1.50) || (lx > 2.20 && lz > 3.60 && lz < 5.00)) return 'tatami';
        return 'wood';
      }
      if (x > 2.20 && z < 3.50) return 'tatami';
      if (x > 2.20 && x < 3.50 && z > 3.50 && z < 5.95) return 'tile';
      return 'wood';
    }
    if (this.currentFloor === 4) {
      if (x < -1.2) {
        const lx = x - ANNEX.originX;
        const lz = z - ANNEX.originZ;
        if (lx > 2.40 && lz > 5.60) return 'tatami';
        return 'wood';
      }
      if (x < 2.15 && z < 1.55) return 'tatami';
      return 'wood';
    }
    if (x > 1.30 && x < 3.70 && z > 6.15 && z < 8.75) return 'tatami';
    return 'wood';
  }

  _collidesInCamperLocal(lx, lz, level) {
    const r = this.playerRadius;
    const r2 = r * r;
    const cols = this.house.camper.localCollidersByLevel[level] || [];
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
      const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
      if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
    }
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.isCamper && d.floor === level && d.progress < 0.55) {
        const b = d.collider;
        const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
        const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
        if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
      }
    }
    return false;
  }

  _collidesAt(x, z) {
    const r = this.playerRadius;
    const r2 = r * r;

    if (this.activeFlight !== null) {
      if (this.activeStairBuilding === 'camper') {
        const cl = this.worldToCamperLocal(x, z);
        const st = CAMPER.stairLocal;
        if (cl.lx < st.minX + r || cl.lx > st.maxX - r) return true;
        return false;
      }
      const sb = this.activeStairBuilding === 'storage'
        ? STORAGE.stairWorld
        : (this.activeStairBuilding === 'annex' ? ANNEX.stairWorld : HOUSE.stairBox);
      if (x < sb.minX + r || x > sb.maxX - r) return true;
      return false;
    }

    if (this.currentFloor === 0) {
      if (x < 0.15 + r || x > 4.85 - r || z < 2.45 + r || z > 9.85 - r) return true;
    } else if (this.currentFloor === 1) {
      // Expanded forest compound + Camper drive clearing
      if (x < -14.5 || x > 15.2 || z < -15.2 || z > 14.5) return true;
      // Strict Movable Giant Camper 1F exterior shell + 14-room + 460mm corridor collision!
      const cl = this.worldToCamperLocal(x, z);
      if (cl.lx >= -r - 0.16 && cl.lx <= CAMPER.width + r + 0.16 && cl.lz >= -r - 0.18 && cl.lz <= CAMPER.length + r + 0.18) {
        if (this._collidesInCamperLocal(cl.lx, cl.lz, 1)) return true;
      }
    } else if (this.currentFloor === 2) {
      const cl = this.worldToCamperLocal(x, z);
      if (this.activeBuilding === 'camper') {
        if (cl.lx < 0.07 + r || cl.lx > CAMPER.width - 0.07 - r || cl.lz < 0.07 + r || cl.lz > CAMPER.length - 0.07 - r) {
          return true;
        }
        // Prevent stepping into the open 1F double-height atrium void (vx > 1.10, vz = 2.17..5.25)
        if (cl.lx > 1.08 - r && cl.lz > 2.17 && cl.lz < 5.25) return true;
        if (this._collidesInCamperLocal(cl.lx, cl.lz, 2)) return true;
        return false;
      }
      if (x < -1.2) {
        if (
          x < ANNEX.originX + 0.15 + r ||
          x > ANNEX.originX + ANNEX.width - 0.15 - r ||
          z < ANNEX.originZ + 0.15 + r ||
          z > ANNEX.originZ + ANNEX.depth - 0.15 - r
        ) return true;
      } else if (x > 5.5) {
        const ld = STORAGE.landing2FWorld;
        const inStorageInt =
          x >= STORAGE.originX + 0.10 + r &&
          x <= STORAGE.originX + STORAGE.width - 0.10 - r &&
          z >= STORAGE.originZ + 0.10 + r &&
          z <= STORAGE.originZ + STORAGE.depth - 0.10 - r;
        const onStorageLand =
          x >= ld.minX + r &&
          x <= ld.maxX - r &&
          z >= ld.minZ + r &&
          z <= ld.maxZ + 0.35;
        if (!inStorageInt && !onStorageLand) return true;
      } else if (x < 0.15 + r || x > 4.85 - r || z < 0.15 + r || z > 9.85 - r) {
        return true;
      }
    } else if (this.currentFloor === 3) {
      if (x < -1.2) {
        const lx = x - ANNEX.originX;
        const lz = z - ANNEX.originZ;
        const inAnnexInt = lx >= 0.15 + r && lx <= 4.85 - r && lz >= 0.15 + r && lz <= 7.85 - r;
        const onBalN = lx >= 2.85 + r && lx <= 4.45 - r && lz >= -1.00 + r && lz <= 0.45;
        const onBalW = lx >= -1.00 + r && lx <= 0.45 && lz >= 5.95 + r && lz <= 7.55 - r;
        const onBalS = lx >= 2.85 + r && lx <= 4.45 - r && lz >= 7.55 && lz <= 9.00 - r;
        if (!inAnnexInt && !onBalN && !onBalW && !onBalS) return true;
      } else if (x < 0.15 + r || x > 4.85 - r || z < 0.15 + r || z > 9.85 - r) {
        return true;
      }
    } else if (this.currentFloor === 4) {
      if (x < -1.2) {
        if (
          x < ANNEX.originX + 0.15 + r ||
          x > ANNEX.originX + ANNEX.width - 0.15 - r ||
          z < ANNEX.originZ + 0.15 + r ||
          z > ANNEX.originZ + ANNEX.depth - 0.15 - r
        ) return true;
      } else {
        const bal = HOUSE.balcony4F;
        const onBalcony = z >= 9.75 && x >= bal.minX + r && x <= bal.maxX - r && z <= bal.maxZ - r;
        const inInterior = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
        if (!inInterior && !onBalcony) return true;
      }
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
      if (!d.isCamper && d.floor === this.currentFloor && d.progress < 0.55) {
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
      const boulders = this.house.boulderColliders || [];
      for (let i = 0; i < boulders.length; i++) {
        const b = boulders[i];
        const md = r + b.r;
        if ((x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) < md * md) return true;
      }
    }
    return false;
  }

  _updateStairTransitions(prevX, prevZ) {
    const sb = HOUSE.stairBox;
    const asb = ANNEX.stairWorld;
    const ssb = STORAGE.stairWorld;
    const cst = CAMPER.stairLocal;
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    const maxFloor = FLOORS.length - 1;

    const prevCl = this.worldToCamperLocal(prevX, prevZ);
    const curCl = this.worldToCamperLocal(x, z);

    if (this.activeFlight === null) {
      // 0. Movable Giant Camper Rear Loft Ladder (STC1: 1F <-> 2F Loft)
      if (this.activeBuilding === 'camper' && curCl.lx >= cst.minX && curCl.lx <= cst.maxX) {
        if (this.currentFloor === 1 && prevCl.lz <= cst.bottomZ + 0.04 && curCl.lz > cst.bottomZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'camper';
          return;
        }
        if (this.currentFloor === 2 && prevCl.lz >= cst.topZ - 0.04 && curCl.lz < cst.topZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'camper';
          return;
        }
      }
      // 1. Main Tower Stairwell (ST0..ST4)
      if (x >= sb.minX && x <= sb.maxX) {
        if (prevZ >= sb.bottomZ - 0.04 && z < sb.bottomZ && this.currentFloor < maxFloor) {
          this.activeFlight = this.currentFloor;
          this.activeStairBuilding = 'main';
        } else if (prevZ <= sb.topZ + 0.04 && z > sb.topZ && this.currentFloor > 0) {
          this.activeFlight = this.currentFloor - 1;
          this.activeStairBuilding = 'main';
        }
      }
      // 2. Neighbor Annex Stairwell (STA1..STA3)
      else if (x >= asb.minX && x <= asb.maxX) {
        if (this.currentFloor >= 1 && this.currentFloor < 4 && prevZ >= asb.bottomZ - 0.04 && z < asb.bottomZ) {
          this.activeFlight = this.currentFloor;
          this.activeStairBuilding = 'annex';
        } else if (this.currentFloor >= 2 && this.currentFloor <= 4 && prevZ <= asb.topZ + 0.04 && z > asb.topZ) {
          this.activeFlight = this.currentFloor - 1;
          this.activeStairBuilding = 'annex';
        }
      }
      // 3. Concrete Warehouse Exterior Steel Stair (STS1)
      else if (x >= ssb.minX && x <= ssb.maxX) {
        if (this.currentFloor === 1 && prevZ >= ssb.bottomZ - 0.04 && z < ssb.bottomZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'storage';
        } else if (this.currentFloor === 2 && prevZ <= ssb.topZ + 0.04 && z > ssb.topZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'storage';
        }
      }
    } else if (this.activeStairBuilding === 'camper') {
      if (curCl.lz >= cst.topZ) {
        this.currentFloor = 2;
        this.activeFlight = null;
      } else if (curCl.lz <= cst.bottomZ) {
        this.currentFloor = 1;
        this.activeFlight = null;
      }
    } else {
      const activeBox = this.activeStairBuilding === 'storage'
        ? ssb
        : (this.activeStairBuilding === 'annex' ? asb : sb);
      if (z <= activeBox.topZ) {
        this.currentFloor = this.activeFlight + 1;
        this.activeFlight = null;
      } else if (z >= activeBox.bottomZ) {
        this.currentFloor = this.activeFlight;
        this.activeFlight = null;
      }
    }
  }

  _updateMovement(dt) {
    if (this.mapOpen) return;
    if (this.drivingCamper) {
      this._updateCamperDriving(dt);
      return;
    }

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
    const stairSlow = this.activeFlight !== null ? 0.80 : 1.0;
    const loftSlow = (this.activeBuilding === 'camper' && this.currentFloor === 2) ? 0.68 : 1.0;
    const maxSpeed = (this.crouching ? 1.05 : (sprinting ? 2.75 : 1.75)) * stairSlow * loftSlow;
    const mag = Math.min(1.0, _input.length());
    if (mag > 0.01) {
      _input.normalize().multiplyScalar(maxSpeed * mag);
      this.playerVel.lerp(_input, Math.min(1, dt * 11));
    } else {
      this.playerVel.lerp(_zero, Math.min(1, dt * 13));
    }

    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;

    // Inside Movable Giant Camper: resolve axis-separated sliding in CAMPER LOCAL SPACE
    // so walking through the razor-tight 460mm corridor is silky smooth at ANY parked heading!
    if (this.activeBuilding === 'camper') {
      const cp = this.house.camper.pose;
      const c = Math.cos(cp.yaw);
      const s = Math.sin(cp.yaw);
      const curL = this.worldToCamperLocal(this.playerPos.x, this.playerPos.z);
      const vxL = this.playerVel.x * c - this.playerVel.z * s;
      const vzL = this.playerVel.x * s + this.playerVel.z * c;

      const cand1 = this.camperLocalToWorld(curL.lx + vxL * dt, curL.lz);
      if (!this._collidesAt(cand1.x, cand1.z)) {
        this.playerPos.x = cand1.x;
        this.playerPos.z = cand1.z;
      }
      const midL = this.worldToCamperLocal(this.playerPos.x, this.playerPos.z);
      const cand2 = this.camperLocalToWorld(midL.lx, midL.lz + vzL * dt);
      if (!this._collidesAt(cand2.x, cand2.z)) {
        this.playerPos.x = cand2.x;
        this.playerPos.z = cand2.z;
      }
    } else {
      const nextX = this.playerPos.x + this.playerVel.x * dt;
      if (!this._collidesAt(nextX, this.playerPos.z)) this.playerPos.x = nextX;
      const nextZ = this.playerPos.z + this.playerVel.z * dt;
      if (!this._collidesAt(this.playerPos.x, nextZ)) this.playerPos.z = nextZ;
    }

    this._updateStairTransitions(prevX, prevZ);
    this.activeBuilding = this._getBuildingAt(this.playerPos.x, this.playerPos.z);

    const targetFloorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
    const lerpRate = this.activeFlight !== null ? 18 : 11;
    this.floorY += (targetFloorY - this.floorY) * Math.min(1, dt * lerpRate);

    const desiredEye = this._computeDesiredEyeHeight(this.playerPos.x, this.playerPos.z);
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
    this.atmosphere.update(elapsed, this.house.camper.pose);

    const propStates = {};
    for (const p of this.house.interactiveProps) propStates[p.id] = p.isOn;

    for (const lname of ['Tatami_Lantern', 'Attic_Lantern', 'Annex_Cafe_Lamp']) {
      const entry = this.house.interiorLights.find((l) => l.name === lname);
      const isOn = lname === 'Tatami_Lantern'
        ? propStates.lantern_1f
        : (lname === 'Attic_Lantern' ? propStates.lantern_attic : propStates.lamp_annex_cafe);
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

    // Acoustic occlusion across all 4 structures (Main, Annex, Storage, Movable Camper!)
    if (this.currentFloor === 0) {
      this.audio.updateOcclusion(0.02);
    } else if (this.activeBuilding === 'camper') {
      this.audio.updateOcclusion(doorOpenMap['DC-1'] ? 0.62 : 0.16);
    } else {
      const lxA = this.playerPos.x - ANNEX.originX;
      const lzA = this.playerPos.z - ANNEX.originZ;
      const outside1F = this.currentFloor === 1 && this.activeBuilding === 'courtyard';
      const onMainBal4F = this.currentFloor === 4 && this.activeBuilding === 'main' && this.playerPos.z > 9.90;
      const onAnnexBal3F = this.currentFloor === 3 && this.activeBuilding === 'annex' && (lzA < 0.05 || lzA > 7.95 || lxA < 0.05);
      const onStorageExt =
        (this.activeFlight !== null && this.activeStairBuilding === 'storage') ||
        (this.currentFloor === 2 && this.activeBuilding === 'storage' && this.playerPos.z < STORAGE.originZ + 0.05);
      const isFullyOutdoors = outside1F || onMainBal4F || onAnnexBal3F || onStorageExt;

      if (isFullyOutdoors) {
        this.audio.updateOcclusion(1.0);
      } else if (this.activeBuilding === 'storage') {
        const sDoorOpen = (this.currentFloor === 1 && doorOpenMap['DS-1']) || (this.currentFloor === 2 && doorOpenMap['DS-2']);
        this.audio.updateOcclusion(sDoorOpen ? 0.58 : 0.08);
      } else {
        const d1Boost = this.currentFloor === 1 && doorOpenMap['D1-1']
          ? Math.max(0, 1 - Math.hypot(this.playerPos.x - 1.10, this.playerPos.z) / 4.0) * 0.85 : 0;
        const da1Boost = this.currentFloor === 1 && doorOpenMap['DA-1']
          ? Math.max(0, 1 - Math.hypot(this.playerPos.x - (ANNEX.originX + 3.90), this.playerPos.z - ANNEX.originZ) / 4.0) * 0.85 : 0;
        const balDoorBoost =
          (this.currentFloor === 4 && this.activeBuilding === 'main' && doorOpenMap['D4-6']) ||
          (this.currentFloor === 3 && this.activeBuilding === 'annex' && (doorOpenMap['DA3-B1'] || doorOpenMap['DA3-B2'] || doorOpenMap['DA3-B3']))
            ? 0.65 : 0;
        const atticWindBoost = (this.currentFloor === 5 || (this.currentFloor === 4 && this.activeBuilding === 'annex')) ? 0.48 : 0;
        const windowBoost = Math.max(0, 1 - Math.abs(this.playerPos.z - 9.85) / 4.5) * 0.35;
        this.audio.updateOcclusion(Math.min(1.0, Math.max(d1Boost, da1Boost, balDoorBoost, windowBoost, atticWindBoost)));
      }
    }

    return { anyDoorAnimating, doorOpenMap, propStates };
  }

  _detectCurrentRoom() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    if (this.drivingCamper) {
      const kmh = Math.round(Math.abs(this.house.camper.speed) * 3.6);
      const tag = this.camperBlockedTimer > 0 ? ' [衝突停止]' : '';
      return { id: 'camper_driving', code: '運転中', floor: 1, building: 'camper', nameJp: `巨大キャンピングカー走行中 (${kmh} km/h)${tag}` };
    }
    if (this.activeFlight !== null) {
      if (this.activeStairBuilding === 'camper') {
        return { id: 'camper_stair', code: 'STC1', floor: this.currentFloor, building: 'camper', nameJp: 'キャンピングカー 1F↔2Fロフト階段' };
      }
      if (this.activeStairBuilding === 'storage') {
        return { id: 'storage_stair', code: 'STS1', floor: this.currentFloor, building: 'storage', nameJp: 'コンクリート倉庫 1F↔2F 外鉄骨階段' };
      }
      if (this.activeStairBuilding === 'annex') {
        const aNames = { 1: '隣棟 1F↔2F 階段', 2: '隣棟 2F↔3F 階段', 3: '隣棟 3F↔屋根裏 階段' };
        return { id: 'annex_stair', code: `STA${this.activeFlight}`, floor: this.currentFloor, building: 'annex', nameJp: aNames[this.activeFlight] || '隣棟 階段' };
      }
      const fNames = ['B1F↔1F 地下コンクリート階段', '1F↔2F 階段', '2F↔3F 階段', '3F↔4F 階段', '4F↔屋根裏 階段'];
      return { id: 'stair', code: `ST${this.activeFlight}`, floor: this.currentFloor, building: 'main', nameJp: fNames[this.activeFlight] };
    }

    if (this.activeBuilding === 'camper') {
      const cl = this.worldToCamperLocal(x, z);
      const cFloor = CAMPER_SHEETS[this.currentFloor === 2 ? 1 : 0];
      for (let i = cFloor.rooms.length - 1; i >= 0; i--) {
        const r = cFloor.rooms[i];
        if (cl.lx >= r.x && cl.lx <= r.x + r.w && cl.lz >= r.z && cl.lz <= r.z + r.d) return r;
      }
      return cFloor.rooms[0] || null;
    }

    if (this.activeBuilding === 'storage') {
      if (this.currentFloor === 2 && z < STORAGE.originZ + 0.02) {
        return { id: 'storage_landing', code: 'S2LD', floor: 2, building: 'storage', nameJp: '倉庫棟2F 鋼製踊場（外階段）' };
      }
      const sx = x - STORAGE.originX;
      const sz = z - STORAGE.originZ;
      const sFloor = STORAGE_FLOORS[this.currentFloor === 2 ? 1 : 0];
      for (let i = sFloor.rooms.length - 1; i >= 0; i--) {
        const r = sFloor.rooms[i];
        if (sx >= r.x && sx <= r.x + r.w && sz >= r.z && sz <= r.z + r.d) return r;
      }
      return sFloor.rooms[0] || null;
    }

    if (this.activeBuilding === 'annex') {
      const lx = x - ANNEX.originX;
      const lz = z - ANNEX.originZ;
      const aIdx = Math.max(0, Math.min(ANNEX_FLOORS.length - 1, this.currentFloor - 1));
      const aFloor = ANNEX_FLOORS[aIdx];
      for (let i = aFloor.rooms.length - 1; i >= 0; i--) {
        const r = aFloor.rooms[i];
        if (lx >= r.x && lx <= r.x + r.w && lz >= r.z && lz <= r.z + r.d) return r;
      }
      return aFloor.rooms[0] || null;
    }

    if (this.currentFloor === 1 && this.activeBuilding === 'courtyard') {
      if (x > 5.0 && x < 10.6 && z >= 1.5 && z < 10.2) {
        return { id: 'exterior', code: 'RV駐車帯', floor: 1, building: 'courtyard', nameJp: '巨大キャンピングカー駐車帯（母屋東隣）' };
      }
      if (x > 5.0 && x < 10.2 && z > -2.5 && z < 1.5) {
        return { id: 'exterior', code: '東歩道', floor: 1, building: 'courtyard', nameJp: '東アプローチ（母屋↔コンクリート倉庫棟）' };
      }
      if (x > -3.1 && x < 0.25 && z > -2.0 && z < 10.2) {
        return { id: 'exterior', code: '中庭', floor: 1, building: 'courtyard', nameJp: '石灯籠の苔中庭（母屋↔隣棟）' };
      }
      return { id: 'exterior', code: 'EXT', floor: 1, building: 'courtyard', nameJp: '深い森・苔石アプローチ' };
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
        flashlightOn: this.flashlightOn || this.house.camper.headlightsOn,
        cameraMoved,
        currentFloor: this.currentFloor,
        activeFlight: this.activeFlight,
        activeBuilding: this.activeBuilding,
        doorOpenMap,
        propStates,
      });

      let targetExposure = 1.15;
      if (this.flashlightOn) targetExposure = 1.06;
      else if (this.currentFloor === 0) targetExposure = 1.02;
      else if (this.activeBuilding === 'storage') targetExposure = 1.08;
      else if (this.activeBuilding === 'camper') targetExposure = 1.18;
      else if (room && (room.id === 'exterior' || room.id.includes('passage') || room.id.includes('gallery') || room.id.includes('stair'))) {
        targetExposure = 1.24;
      }
      this.postfx.render(this.scene, this.camera, elapsed, targetExposure);

      const aim = this.mapOpen ? null : this._raycastInteractable();
      if (this.callbacks.onAimChange) this.callbacks.onAimChange(aim);

      if (this.callbacks.onPoseUpdate) {
        this.camera.getWorldDirection(_lookDir);
        const inCamper = this.activeBuilding === 'camper';
        const inAnnex = this.activeBuilding === 'annex';
        const inStorage = this.activeBuilding === 'storage';
        let sheetIndex = this.currentFloor;
        let floorCode = this.activeBuilding === 'courtyard' ? '中庭' : FLOORS[this.currentFloor].code;
        let localX = this.playerPos.x;
        let localZ = this.playerPos.z;
        let localDx = _lookDir.x;
        let localDz = _lookDir.z;

        if (inCamper) {
          sheetIndex = this.currentFloor === 2 ? 13 : 12;
          floorCode = this.drivingCamper ? 'RV運転' : (this.currentFloor === 2 ? 'RV 2F' : 'RV 1F');
          const cl = this.worldToCamperLocal(this.playerPos.x, this.playerPos.z);
          localX = cl.lx;
          localZ = cl.lz;
          const cp = this.house.camper.pose;
          const c = Math.cos(cp.yaw);
          const s = Math.sin(cp.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inStorage) {
          sheetIndex = this.currentFloor === 2 ? 11 : 10;
          floorCode = this.currentFloor === 2 ? '倉庫2F' : '倉庫1F';
          localX = this.playerPos.x - STORAGE.originX;
          localZ = this.playerPos.z - STORAGE.originZ;
        } else if (inAnnex) {
          const aIdx = Math.max(0, Math.min(ANNEX_FLOORS.length - 1, this.currentFloor - 1));
          sheetIndex = 6 + aIdx;
          floorCode = ANNEX_FLOORS[aIdx].code;
          localX = this.playerPos.x - ANNEX.originX;
          localZ = this.playerPos.z - ANNEX.originZ;
        }

        this.callbacks.onPoseUpdate({
          x: this.playerPos.x,
          z: this.playerPos.z,
          localX,
          localZ,
          dx: localDx,
          dz: localDz,
          floor: this.currentFloor,
          sheetIndex,
          building: this.activeBuilding,
          floorCode,
          room,
          camperPose: this.house.camper.pose,
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
