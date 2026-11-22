import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildHouse3D } from './buildHouse3d.js';
import { createVolumetricAtmosphere } from './volumetricAtmosphere.js';
import { SinglePassPostFX } from './postfx.js';
import { AdaptiveMobileEngine } from './adaptiveEngine.js';
import { SpatialForestAudio } from './audioEngine.js';
import {
  FLOORS, HOUSE, ANNEX, ANNEX_FLOORS, getAnnexAtticCeilingY,
  STORAGE, STORAGE_FLOORS, CAMPER, CAMPER_SHEETS, KEI, KEI_PLAN, SHEET_OFFSETS, getAtticCeilingY,
  ELEVATOR, STAIR_B1_B2, STAIR_B2_B3, FLOOR_B2F, FLOOR_B3F, FLOOR_B4F, getFloorByPhysicalIndex,
} from './planData.js';
import { TERRENO_WORLD, TERRENO_LANDMARKS, evalMainRiver } from './terreno/terrenoConfig.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _input = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _lookDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _flashWorldPos = new THREE.Vector3();
const _flashWorldDir = new THREE.Vector3();

// Exact Ground-Level Static Building World AABBs for Movable Vehicles (ZERO invisible air under high balconies!)
const STATIC_VEHICLE_OBSTACLES = [
  { minX: 0.00, maxX: 5.02, minZ: 0.00, maxZ: 10.02 },    // Main Tower ground walls
  { minX: 0.00, maxX: 2.22, minZ: -1.25, maxZ: 0.02 },    // Main Tower north entry porch
  { minX: 0.02, maxX: 4.98, minZ: 10.00, maxZ: 11.35 },   // Main Tower south engawa deck
  { minX: 5.00, maxX: 5.38, minZ: 2.24, maxZ: 3.06 },     // East outdoor AC condenser only
  { minX: -7.62, maxX: -2.58, minZ: 0.98, maxZ: 9.02 },   // Neighbor Annex exact ground footprint (excludes high 3F balconies!)
  { minX: -4.75, maxX: -2.58, minZ: 0.15, maxZ: 1.00 },   // Neighbor Annex north entry step
  { minX: 6.58, maxX: 9.42, minZ: -1.22, maxZ: 0.84 },    // Concrete Warehouse + exterior stair ground footprint
];
const LANTERN_OBSTACLES = [
  { x: -2.25, z: 0.25, r: 0.30 },
  { x: -2.25, z: 5.10, r: 0.30 },
];

export class FirstPersonHouseExplorer {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // 5-Unit Forest Compound + Deep Basement Expansion (B4F..6F+RF + Real Traction Elevator ELV-1):
    this.currentFloor = HOUSE.spawnFloor; // 1 (1F LDK)
    this.activeFlight = null;
    this.activeBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper' | 'kei' | 'courtyard'
    this.activeStairBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper'
    this.inElevator = false;
    this.nearElevator = false;
    this.lastElvHudSig = '';
    this.playerPos = new THREE.Vector3(1.62, 0.0, 6.25);
    this.playerVel = new THREE.Vector3();
    this.floorY = 0.0;
    this.eyeHeight = 1.56;
    this.targetEyeHeight = 1.56;
    this.crouching = false;
    this.playerRadius = 0.20;

    // Natural terrain auto-jump & steep-cliff slip physics
    this.jumpOffset = 0.0;
    this.jumpVelY = 0.0;
    this.autoJumpCooldown = 0.0;
    this.autoDoorsReadyTimer = 0.55;

    this.drivingVehicle = null; // null | 'camper' | 'kei'
    this.bumpCooldown = 0;
    this.vehicleBlockedTimer = 0;

    this.cameraSensitivity = 1.0;
    this.surfaceSuper = false;

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
    this.map3dActive = false;
    this.map3d = null;
    this.telemetryTimer = 0.25;

    this._initRenderer();
    this._initScene();
    this._initDarkForestLighting();

    this.house = buildHouse3D(this.scene);
    this.terreno = this.house.terreno;
    this.atmosphere = createVolumetricAtmosphere(this.scene);
    this._initFlashlight();
    this.postfx = new SinglePassPostFX(this.renderer);
    this.adaptive = new AdaptiveMobileEngine(this.renderer, this.postfx, this.house);
    this.audio = new SpatialForestAudio();

    // Locked daylight alpine/deep-forest atmosphere (時間帯変更不可)
    this.currentTodId = 'day';
    this.lastNear = 0.14;
    this.lastFar = 26000;
    this._applyTimeOfDayLighting(this.terreno.getTimeOfDay());

    this._initEvents();
    this._syncCameraFrustum();
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
    this.scene.background = new THREE.Color(0x07111e);
    this.scene.fog = new THREE.FogExp2(0x0a1728, 0.00018);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.042;
    pmrem.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(64, w / Math.max(1, h), 0.14, 26000);
    this.scene.add(this.camera);
  }

  _initDarkForestLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x2b4566, 0x090807, 0.22);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0x7ea8d8, 1.48);
    this.moonLight.position.set(-10.0, 29.0, 28.0);
    this.moonLight.target.position.set(0.5, 7.5, 4.5);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 96;
    this.moonLight.shadow.camera.left = -26;
    this.moonLight.shadow.camera.right = 26;
    this.moonLight.shadow.camera.top = 26;
    this.moonLight.shadow.camera.bottom = -20;
    this.moonLight.shadow.bias = -0.0007;
    this.moonLight.shadow.normalBias = 0.03;
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target);

    this.northMoon = new THREE.DirectionalLight(0x52759e, 0.62);
    this.northMoon.position.set(6.5, 24.0, -17.0);
    this.scene.add(this.northMoon);
  }

  _applyTimeOfDayLighting(preset) {
    if (!preset) return;
    this.currentTodId = preset.id;
    const isNight = preset.id === 'night';
    const isDay = preset.id === 'day';

    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = isNight ? 0.20 : preset.hemiIntensity;

    this.moonLight.color.setRGB(preset.sunColor[0], preset.sunColor[1], preset.sunColor[2]);
    this.moonLight.intensity = preset.sunIntensity;
    if (this.northMoon) {
      this.northMoon.intensity = isNight ? 0.62 : (isDay ? 0.45 : 0.32);
      this.northMoon.color.setHex(preset.hemiSky);
    }

    if (this.scene.background) {
      this.scene.background.setRGB(preset.skyHorizon[0], preset.skyHorizon[1], preset.skyHorizon[2]);
    }
    if (this.scene.fog) {
      this.scene.fog.color.setRGB(preset.aerialFogColor[0], preset.aerialFogColor[1], preset.aerialFogColor[2]);
    }
    this.scene.environmentIntensity = isNight ? 0.042 : (isDay ? 0.14 : 0.085);

    if (this.atmosphere && this.atmosphere.setAtmospherePreset) {
      this.atmosphere.setAtmospherePreset(preset);
    }
    if (this.house.fireflies) {
      this.house.fireflies.visible = !isDay;
    }
    if (this.house.exteriorFillLights) {
      const fillScale = isNight ? 1.0 : (isDay ? 0.0 : 0.35);
      this.house.exteriorFillLights.forEach(({ light, baseIntensity }) => {
        light.intensity = baseIntensity * fillScale;
      });
    }
    if (this.adaptive) this.adaptive.markShadowsDirty();
    if (this.callbacks.onTimeOfDayChange) this.callbacks.onTimeOfDayChange(preset);
  }

  setTimeOfDay() {
    // Time of day is permanently locked (時間帯変更不可)
    return this.terreno ? this.terreno.getTimeOfDay() : null;
  }

  cycleTimeOfDay() {
    return this.terreno ? this.terreno.getTimeOfDay() : null;
  }

  getTimeOfDay() {
    return this.terreno ? this.terreno.getTimeOfDay() : null;
  }

  setCameraSensitivity(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return this.cameraSensitivity;
    this.cameraSensitivity = Math.max(0.2, Math.min(3.0, Math.round(num * 10) / 10));
    return this.cameraSensitivity;
  }

  setSurfaceSuper(enabled) {
    this.surfaceSuper = Boolean(enabled);
    const maxAniso = this.renderer?.capabilities?.getMaxAnisotropy ? this.renderer.capabilities.getMaxAnisotropy() : 8;

    if (this.adaptive && this.adaptive.setSurfaceSuper) {
      this.adaptive.setSurfaceSuper(this.surfaceSuper);
    }
    if (this.terreno && this.terreno.setSurfaceSuper) {
      this.terreno.setSurfaceSuper(this.surfaceSuper, maxAniso);
    }
    if (this.callbacks.onSurfaceSuperChange) this.callbacks.onSurfaceSuperChange(this.surfaceSuper);
    return this.surfaceSuper;
  }

  _syncCameraFrustum() {
    const underground = this.currentFloor <= 0;
    const outdoors = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && !this.drivingVehicle;
    const targetNear = underground ? 0.06 : (outdoors ? 0.24 : 0.14);
    const targetFar = underground ? 140 : 26000;
    if (this.terreno) {
      this.terreno.setVisible(!underground);
    }
    if (targetNear !== this.lastNear || targetFar !== this.lastFar) {
      this.lastNear = targetNear;
      this.lastFar = targetFar;
      this.camera.near = targetNear;
      this.camera.far = targetFar;
      this.camera.updateProjectionMatrix();
    }
  }

  teleportToWorld(x, z, yaw = null, pitch = -0.06) {
    if (this.drivingVehicle) this.toggleVehicleDrive(this.drivingVehicle, false);
    this.inElevator = false;
    this.activeFlight = null;
    this.currentFloor = 1;
    this.jumpOffset = 0;
    this.jumpVelY = 0;
    const cx = Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, x));
    const cz = Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, z));
    this.setPose(cx, cz, yaw !== null ? yaw : this.yaw, pitch, 1);
    if (this.terreno) {
      this._syncCameraFrustum();
      this.terreno.update(this.camera.position, 0, null);
    }
  }

  teleportToLandmark(id) {
    const lm = TERRENO_LANDMARKS.find((item) => item.id === id);
    if (!lm) return false;
    this.teleportToWorld(lm.x, lm.z, lm.yaw, lm.pitch);
    return true;
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
    const s = this.cameraSensitivity;
    this.yaw -= dx * 0.0048 * s;
    this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - dy * 0.0040 * s));
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
    if (this.drivingVehicle) {
      this.toggleVehicleDrive(this.drivingVehicle, false);
      return true;
    }
    return this._interactAimed();
  }

  interactAtScreenPoint(clientX, clientY) {
    this.audio.init();
    if (this.drivingVehicle) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const hit = this._raycastInteractable(ndc, true);
      if (hit) return this._triggerInteractHit(hit);
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

  worldToKeiLocal(wx, wz) {
    const kp = this.house.kei.pose;
    const dx = wx - kp.cx;
    const dz = wz - kp.cz;
    const c = Math.cos(kp.yaw);
    const s = Math.sin(kp.yaw);
    return {
      lx: dx * c - dz * s + KEI.width * 0.5,
      lz: dx * s + dz * c + KEI.length * 0.5,
    };
  }

  keiLocalToWorld(lx, lz) {
    const kp = this.house.kei.pose;
    const rx = lx - KEI.width * 0.5;
    const rz = lz - KEI.length * 0.5;
    const c = Math.cos(kp.yaw);
    const s = Math.sin(kp.yaw);
    return {
      x: kp.cx + rx * c + rz * s,
      z: kp.cz - rx * s + rz * c,
    };
  }

  toggleVehicleHeadlights(force = null, vehicleKey = null) {
    const key = vehicleKey || this.drivingVehicle || 'camper';
    const veh = key === 'kei' ? this.house.kei : this.house.camper;
    veh.headlightsOn = force !== null ? force : !veh.headlightsOn;
    const beamInt = key === 'kei' ? 8.2 : 9.5;
    veh.headlights.forEach((h) => {
      h.intensity = veh.headlightsOn ? beamInt : 0.0;
    });
    this.adaptive.markShadowsDirty();
    this.audio.playClick(veh.headlightsOn);
    if (this.callbacks.onDriveChange && this.drivingVehicle === key) {
      this.callbacks.onDriveChange(true, {
        vehicle: key,
        badge: key === 'kei' ? 'KEI-340 660cc' : 'CAMPER-75 6×6',
        speedKmh: Math.round(Math.abs(veh.speed) * 3.6),
        headlightsOn: veh.headlightsOn,
        colliding: this.vehicleBlockedTimer > 0,
      });
    }
  }

  toggleCamperHeadlights(force = null) {
    this.toggleVehicleHeadlights(force, this.drivingVehicle || 'camper');
  }

  toggleCamperDrive(force = null) {
    this.toggleVehicleDrive('camper', force);
  }

  toggleKeiDrive(force = null) {
    this.toggleVehicleDrive('kei', force);
  }

  toggleVehicleDrive(vehicleKey, force = null) {
    const isDrivingThis = this.drivingVehicle === vehicleKey;
    const next = force !== null ? force : !isDrivingThis;
    if (next && this.drivingVehicle === vehicleKey) return;
    if (!next && !this.drivingVehicle) return;

    const activeKey = next ? vehicleKey : this.drivingVehicle;
    const veh = activeKey === 'kei' ? this.house.kei : this.house.camper;
    this.drivingVehicle = next ? activeKey : null;
    veh.driveProp.isOn = next;
    veh.speed = 0;

    if (next) {
      if (activeKey === 'camper') {
        const dc1 = this.house.interactiveDoors.find((d) => d.id === 'DC-1');
        if (dc1) dc1.isOpen = false;
        this.currentFloor = 1;
        this.activeFlight = null;
        this.activeBuilding = 'camper';
        const seatW = this.camperLocalToWorld(0.72, 0.88);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + CAMPER.floor1WorldY;
        this.eyeHeight = 1.20;
        this.yaw = veh.pose.yaw;
        this.pitch = -0.10;
      } else {
        ['DK-D', 'DK-L', 'DK-R'].forEach((id) => {
          const d = this.house.interactiveDoors.find((x) => x.id === id);
          if (d) d.isOpen = false;
        });
        this.currentFloor = 1;
        this.activeFlight = null;
        this.activeBuilding = 'kei';
        const seatW = this.keiLocalToWorld(KEI.driverSeatLocal.x, KEI.driverSeatLocal.z);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + KEI.floorWorldY;
        this.eyeHeight = 0.98;
        this.yaw = veh.pose.yaw;
        this.pitch = -0.09;
      }
      this.toggleVehicleHeadlights(true, activeKey);
    } else {
      if (activeKey === 'camper') {
        const standW = this.camperLocalToWorld(1.35, 0.88);
        this.playerPos.set(standW.x, 0, standW.z);
        this.floorY = (veh.pose.y || 0) + CAMPER.floor1WorldY;
        this.eyeHeight = 1.54;
      } else {
        // Exit smoothly straight into the open walk-in cargo bay (100% collision-safe anywhere!)
        const cargoW = this.keiLocalToWorld(0.68, 1.56);
        this.playerPos.set(cargoW.x, 0, cargoW.z);
        this.floorY = (veh.pose.y || 0) + KEI.floorWorldY;
        this.eyeHeight = 1.04;
      }
      this.audio.updateEngine(false, 0, activeKey === 'kei' ? 'kei' : 'diesel');
    }

    if (this.callbacks.onDriveChange) {
      this.callbacks.onDriveChange(Boolean(this.drivingVehicle), {
        vehicle: activeKey,
        badge: activeKey === 'kei' ? 'KEI-340 660cc' : 'CAMPER-75 6×6',
        speedKmh: 0,
        headlightsOn: veh.headlightsOn,
        colliding: false,
      });
    }
  }

  _applyVehicleTerrainPose(veh, isKei, stepLift = 0) {
    const cx = veh.pose.cx;
    const cz = veh.pose.cz;
    const yaw = veh.pose.yaw;
    let baseY = 0;
    let pitch = 0;
    let roll = 0;

    if (this.terreno) {
      const halfWB = isKei ? 1.15 : 2.35;
      const halfTr = isKei ? 0.65 : 1.15;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      const yCenter = this.terreno.getHeightAt(cx, cz);
      const yFront = this.terreno.getHeightAt(cx + fx * halfWB, cz + fz * halfWB);
      const yRear = this.terreno.getHeightAt(cx - fx * halfWB, cz - fz * halfWB);
      const yRight = this.terreno.getHeightAt(cx + rx * halfTr, cz + rz * halfTr);
      const yLeft = this.terreno.getHeightAt(cx - rx * halfTr, cz - rz * halfTr);

      const avgGround = 0.4 * yCenter + 0.15 * (yFront + yRear + yRight + yLeft);
      baseY = avgGround + 0.35 + (veh.suspLift || 0) + stepLift * 0.25;
      pitch = Math.max(-0.46, Math.min(0.46, Math.atan2(yFront - yRear, 2 * halfWB)));
      roll = Math.max(-0.42, Math.min(0.42, Math.atan2(yRight - yLeft, 2 * halfTr)));
    }

    veh.pose.y = baseY;
    veh.pose.pitch = pitch;
    veh.pose.roll = roll;
    veh.root.position.set(cx, baseY, cz);
    veh.root.rotation.order = 'YXZ';
    veh.root.rotation.set(pitch, yaw, roll);
  }

  setCamperPose(cx, cz, yaw = 0, force = false) {
    const camper = this.house.camper;
    if (!force && this._camperCollidesAt(cx, cz, yaw).hit) return false;
    camper.pose.cx = cx;
    camper.pose.cz = cz;
    camper.pose.yaw = yaw;
    this._applyVehicleTerrainPose(camper, false);
    this.adaptive.markShadowsDirty();
    return true;
  }

  setKeiPose(cx, cz, yaw = 0, force = false) {
    const kei = this.house.kei;
    if (!force && this._keiCollidesAt(cx, cz, yaw).hit) return false;
    kei.pose.cx = cx;
    kei.pose.cz = cz;
    kei.pose.yaw = yaw;
    this._applyVehicleTerrainPose(kei, true);
    this.adaptive.markShadowsDirty();
    return true;
  }

  /**
   * Exact 2D Separating Axis Theorem (SAT) OBB vs AABB test for strict vehicle collision.
   */
  _obbIntersectsAABB(cx, cz, hw, hl, yaw, box) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const bx = (box.minX + box.maxX) * 0.5;
    const bz = (box.minZ + box.maxZ) * 0.5;
    const bhw = (box.maxX - box.minX) * 0.5;
    const bhl = (box.maxZ - box.minZ) * 0.5;
    const dx = cx - bx;
    const dz = cz - bz;

    if (Math.abs(dx) > bhw + hw * Math.abs(c) + hl * Math.abs(s)) return false;
    if (Math.abs(dz) > bhl + hw * Math.abs(s) + hl * Math.abs(c)) return false;
    if (Math.abs(dx * c - dz * s) > hw + bhw * Math.abs(c) + bhl * Math.abs(s)) return false;
    if (Math.abs(dx * s + dz * c) > hl + bhw * Math.abs(s) + bhl * Math.abs(c)) return false;
    return true;
  }

  /**
   * Exact 2D Separating Axis Theorem (SAT) OBB vs OBB test for strict mutual vehicle-to-vehicle collision!
   */
  _obbIntersectsOBB(a, b) {
    const cA = Math.cos(a.yaw);
    const sA = Math.sin(a.yaw);
    const cB = Math.cos(b.yaw);
    const sB = Math.sin(b.yaw);
    const ax1x = cA; const ax1z = -sA;
    const ax2x = sA; const ax2z = cA;
    const bx1x = cB; const bx1z = -sB;
    const bx2x = sB; const bx2z = cB;
    const dx = b.cx - a.cx;
    const dz = b.cz - a.cz;

    const axes = [
      [ax1x, ax1z],
      [ax2x, ax2z],
      [bx1x, bx1z],
      [bx2x, bx2z],
    ];
    for (let i = 0; i < 4; i++) {
      const ux = axes[i][0];
      const uz = axes[i][1];
      const dist = Math.abs(dx * ux + dz * uz);
      const projA = a.hw * Math.abs(ax1x * ux + ax1z * uz) + a.hl * Math.abs(ax2x * ux + ax2z * uz);
      const projB = b.hw * Math.abs(bx1x * ux + bx1z * uz) + b.hl * Math.abs(bx2x * ux + bx2z * uz);
      if (dist > projA + projB) return false;
    }
    return true;
  }

  _vehicleCollidesCommon(ncx, ncz, hw, hl, nyaw, otherObb = null, opts = {}) {
    const c = Math.cos(nyaw);
    const s = Math.sin(nyaw);
    const maxStepH = opts.maxStepH ?? 0.50;
    const maxFordDepth = opts.maxFordDepth ?? 0.68;
    const prevCx = opts.prevCx ?? ncx;
    const prevCz = opts.prevCz ?? ncz;

    // 1. Strict 5 km × 19 km TERRENO World Perimeter Check on all 4 OBB corners
    const corners = [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]];
    for (let i = 0; i < 4; i++) {
      const wx = ncx + corners[i][0] * c + corners[i][1] * s;
      const wz = ncz - corners[i][0] * s + corners[i][1] * c;
      if (
        wx < TERRENO_WORLD.playMinX || wx > TERRENO_WORLD.playMaxX ||
        wz < TERRENO_WORLD.playMinZ || wz > TERRENO_WORLD.playMaxZ
      ) return { hit: true, reason: 'bounds', stepLift: 0 };
    }

    // 1b. Directional Deep River Channel Guard (blocks ONLY driving deeper into deep water; never traps or hits dry banks!)
    if (this.terreno) {
      if (this.terreno.ensureCollidersAt) this.terreno.ensureCollidersAt(ncx, ncz);
      const rv = evalMainRiver(ncz);
      if (Math.abs(ncx - rv.x) < rv.halfWidth * 0.78) {
        const nextDepth = rv.waterY - this.terreno.getHeightAt(ncx, ncz);
        if (nextDepth > maxFordDepth) {
          const prevRv = evalMainRiver(prevCz);
          const prevDepth = prevRv.waterY - this.terreno.getHeightAt(prevCx, prevCz);
          if (nextDepth >= prevDepth - 0.02) {
            return { hit: true, reason: 'river', stepLift: 0 };
          }
        }
      }
    }

    // 2. Exact SAT OBB vs Ground-Level Static Building AABBs (near compound only)
    if (Math.abs(ncx) < 24 && Math.abs(ncz) < 24) {
      for (let i = 0; i < STATIC_VEHICLE_OBSTACLES.length; i++) {
        if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, STATIC_VEHICLE_OBSTACLES[i])) {
          return { hit: true, reason: 'building', stepLift: 0 };
        }
      }
    }

    // 3. Exact SAT OBB vs Other Movable Vehicle OBB (Camper <-> Kei-Van mutual collision!)
    if (otherObb && this._obbIntersectsOBB({ cx: ncx, cz: ncz, hw, hl, yaw: nyaw }, otherObb)) {
      return { hit: true, reason: 'vehicle', stepLift: 0 };
    }

    // 4. Exact OBB vs Circle (Lanterns, Courtyard Boulders, & TERRENO Streamed Trees/Tall Boulders)
    //    Low rocks/logs <= maxStepH smoothly trigger suspension step-over instead of stopping the car!
    let stepLift = 0;
    const checkCircles = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const dx = o.x - ncx;
        const dz = o.z - ncz;
        if (dx * dx + dz * dz > 64.0) continue;
        const rx = dx * c - dz * s;
        const rz = dx * s + dz * c;
        const clx = rx < -hw ? -hw : (rx > hw ? hw : rx);
        const clz = rz < -hl ? -hl : (rz > hl ? hl : rz);
        const ddx = rx - clx;
        const ddz = rz - clz;
        const r2 = o.r * o.r;
        if (ddx * ddx + ddz * ddz < r2) {
          const isLowNatural = (o.kind === 'boulder' || o.kind === 'log') && (o.height !== undefined) && o.height <= maxStepH;
          if (isLowNatural) {
            stepLift = Math.max(stepLift, o.height * 0.72);
            continue;
          }
          return true;
        }
      }
      return false;
    };

    if (Math.abs(ncx) < 24 && Math.abs(ncz) < 24) {
      if (checkCircles(LANTERN_OBSTACLES)) return { hit: true, reason: 'lantern', stepLift: 0 };
      if (checkCircles(this.house.boulderColliders || [])) return { hit: true, reason: 'boulder', stepLift: 0 };
    }
    if (this.terreno && checkCircles(this.terreno.getLocalColliders())) {
      return { hit: true, reason: 'forest', stepLift: 0 };
    }
    return { hit: false, reason: null, stepLift };
  }

  _camperCollidesAt(ncx, ncz, nyaw, prevCx = ncx, prevCz = ncz) {
    const hw = CAMPER.width * 0.5 + 0.02;
    const hl = CAMPER.length * 0.5 + 0.02;
    const kp = this.house.kei.pose;
    const keiObb = { cx: kp.cx, cz: kp.cz, hw: KEI.width * 0.5 + 0.01, hl: KEI.length * 0.5 + 0.01, yaw: kp.yaw };
    return this._vehicleCollidesCommon(ncx, ncz, hw, hl, nyaw, keiObb, {
      maxStepH: 0.62,
      maxFordDepth: 0.82,
      prevCx,
      prevCz,
    });
  }

  _keiCollidesAt(ncx, ncz, nyaw, prevCx = ncx, prevCz = ncz) {
    const hw = KEI.width * 0.5 + 0.01;
    const hl = KEI.length * 0.5 + 0.01;
    const cp = this.house.camper.pose;
    const camperObb = { cx: cp.cx, cz: cp.cz, hw: CAMPER.width * 0.5 + 0.02, hl: CAMPER.length * 0.5 + 0.02, yaw: cp.yaw };
    return this._vehicleCollidesCommon(ncx, ncz, hw, hl, nyaw, camperObb, {
      maxStepH: 0.42,
      maxFordDepth: 0.52,
      prevCx,
      prevCz,
    });
  }

  _updateVehicleDriving(dt) {
    const isKei = this.drivingVehicle === 'kei';
    const veh = isKei ? this.house.kei : this.house.camper;
    if (veh.suspLift === undefined) { veh.suspLift = 0; veh.suspVelY = 0; }
    if (this.bumpCooldown > 0) this.bumpCooldown -= dt;
    if (this.vehicleBlockedTimer > 0) this.vehicleBlockedTimer -= dt;

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

    const maxSteer = isKei ? 0.54 : 0.44;
    const steerRate = isKei ? 8.2 : 6.5;
    const targetSteer = steerIn * maxSteer;
    veh.steerAngle += (targetSteer - veh.steerAngle) * Math.min(1, dt * steerRate);
    veh.frontSteerPivots.forEach((p) => { p.rotation.y = veh.steerAngle; });
    veh.steerWheelGroup.rotation.z = veh.steerAngle * 2.4;

    const distFromCompound = Math.hypot(veh.pose.cx - TERRENO_WORLD.compoundCenterX, veh.pose.cz - TERRENO_WORLD.compoundCenterZ);
    const openRoad = distFromCompound > 22.0;
    const accelFwd = isKei ? (openRoad ? 9.4 : 5.6) : (openRoad ? 7.6 : 4.2);
    const accelRev = isKei ? 5.2 : 4.4;
    const maxFwd = isKei ? (openRoad ? 19.0 : 7.2) : (openRoad ? 16.0 : 5.8);
    const maxRev = isKei ? 5.0 : 4.2;

    // Realistic mountain gravity & steep cliff climbing resistance (smooth macro terrain normal — ZERO invisible walls!)
    let climbGravAccel = 0;
    let cliffMacroSlope = 0;
    let macroNormal = null;
    const fwdX = -Math.sin(veh.pose.yaw);
    const fwdZ = -Math.cos(veh.pose.yaw);

    if (this.terreno && openRoad) {
      macroNormal = this.terreno.getMacroNormalAt
        ? this.terreno.getMacroNormalAt(veh.pose.cx, veh.pose.cz, 3.2)
        : this.terreno.getNormalAt(veh.pose.cx, veh.pose.cz, 3.2);
      cliffMacroSlope = macroNormal.slope;
      // Forward uphill component along vehicle heading (macroNormal.x/z point downhill)
      const fwdUphill = -(fwdX * macroNormal.x + fwdZ * macroNormal.z);
      // Gravity pulls vehicle downhill along slope; steep cliffs exceed engine torque!
      climbGravAccel = -fwdUphill * 12.8;
    }

    // Realistic grade capability: KEI-340 (~24° max climb), CAMPER-75 (~21° max climb)
    const maxClimbSlope = isKei ? 0.46 : 0.39;
    const cliffHardSlope = isKei ? 0.56 : 0.49;

    if (throttle > 0.02) {
      veh.speed += throttle * accelFwd * dt;
    } else if (throttle < -0.02) {
      veh.speed += throttle * accelRev * dt;
    } else {
      veh.speed *= Math.max(0, 1 - dt * 3.8);
      if (Math.abs(veh.speed) < 0.03 && Math.abs(climbGravAccel) < 2.2) veh.speed = 0;
    }

    // Apply physical hill gravity drag (only strong when grade > ~10° so gentle forestry roads feel effortless)
    if (Math.abs(climbGravAccel) > 1.8) {
      const effectiveGrav = Math.sign(climbGravAccel) * (Math.abs(climbGravAccel) - 1.8);
      veh.speed += effectiveGrav * dt;
    }

    veh.speed = Math.max(-maxRev, Math.min(maxFwd, veh.speed));

    let blocked = false;
    let maxStepLift = 0;
    if (Math.abs(veh.speed) > 0.005) {
      const subSteps = 3;
      const subDt = dt / subSteps;
      const wheelbase = isKei ? 1.98 : 4.55;
      const wheelRad = isKei ? KEI.wheelRadius : CAMPER.wheelRadius;
      let totalMoved = 0;
      let totalDYaw = 0;

      for (let sIdx = 0; sIdx < subSteps; sIdx++) {
        const dist = veh.speed * subDt;
        const dYaw = (dist / wheelbase) * Math.tan(veh.steerAngle);
        const nyaw = veh.pose.yaw + dYaw;
        const ncx = veh.pose.cx - Math.sin(nyaw) * dist;
        const ncz = veh.pose.cz - Math.cos(nyaw) * dist;

        // Check realistic cliff climb limit ONLY when trying to climb UPHILL (downhill & backing off ALWAYS free!)
        if (this.terreno && openRoad) {
          const curY = this.terreno.getHeightAt(veh.pose.cx, veh.pose.cz);
          const nextY = this.terreno.getHeightAt(ncx, ncz);
          const stepDist = Math.max(0.02, Math.abs(dist));
          const stepRise = nextY - curY;
          const nextMacro = this.terreno.getMacroNormalAt
            ? this.terreno.getMacroNormalAt(ncx, ncz, 3.2)
            : this.terreno.getNormalAt(ncx, ncz, 3.2);
          const travelSign = Math.sign(dist);
          const moveDirX = -Math.sin(nyaw) * travelSign;
          const moveDirZ = -Math.cos(nyaw) * travelSign;
          const uphillDot = -(moveDirX * nextMacro.x + moveDirZ * nextMacro.z);

          // Steep cliff uphill refusal -> realistic hill stall & gentle downhill rollback (NO invisible wall crash!)
          if (uphillDot > 0.14 && nextMacro.slope > cliffHardSlope) {
            veh.speed = -travelSign * Math.min(2.2, (nextMacro.slope - cliffHardSlope) * 5.0 + 0.65);
            break;
          }
          // Steep sustained grade torque exhaustion (cannot climb steep mountain faces effortlessly!)
          if (uphillDot > 0.12 && nextMacro.slope > maxClimbSlope && stepRise > 0) {
            const excess = (nextMacro.slope - maxClimbSlope) / Math.max(0.05, cliffHardSlope - maxClimbSlope);
            veh.speed *= Math.max(0, 1.0 - excess * subDt * 6.5);
          }
          // Allow realistic sudden terrain step-over up to vehicle clearance (0.42m Kei / 0.62m Camper)!
          const vehMaxLedge = isKei ? 0.42 : 0.62;
          if (stepRise > 0.08 && stepRise <= vehMaxLedge && stepRise / stepDist > 0.45 && nextMacro.slope <= cliffHardSlope) {
            maxStepLift = Math.max(maxStepLift, stepRise * 0.55);
          }
        }

        const res = isKei
          ? this._keiCollidesAt(ncx, ncz, nyaw, veh.pose.cx, veh.pose.cz)
          : this._camperCollidesAt(ncx, ncz, nyaw, veh.pose.cx, veh.pose.cz);

        if (!res.hit) {
          veh.pose.cx = ncx;
          veh.pose.cz = ncz;
          veh.pose.yaw = nyaw;
          totalMoved += dist;
          totalDYaw += dYaw;
          if (res.stepLift > maxStepLift) maxStepLift = res.stepLift;
        } else {
          veh.speed = 0;
          blocked = true;
          this.vehicleBlockedTimer = 0.65;
          if (this.bumpCooldown <= 0) {
            this.audio.playBump();
            if (navigator.vibrate) navigator.vibrate(25);
            this.bumpCooldown = 0.45;
          }
          break;
        }
      }

      // Smooth spring-damper suspension response over rocks, logs, & step-overs!
      const targetSusp = maxStepLift;
      const springK = isKei ? 58.0 : 42.0;
      const dampC = isKei ? 11.5 : 9.2;
      veh.suspVelY += ((targetSusp - veh.suspLift) * springK - veh.suspVelY * dampC) * dt;
      veh.suspLift = Math.max(-0.08, Math.min(isKei ? 0.45 : 0.65, veh.suspLift + veh.suspVelY * dt));

      if (Math.abs(totalMoved) > 0.0001 || Math.abs(veh.suspLift) > 0.002) {
        this._applyVehicleTerrainPose(veh, isKei, maxStepLift);
        if (Math.abs(totalMoved) > 0.0001) {
          const wheelSpin = totalMoved / wheelRad;
          veh.wheelMeshes.forEach((w) => { w.rotation.x -= wheelSpin; });
          this.yaw += totalDYaw;
          this.adaptive.markShadowsDirty();
        }
      }
    } else if (Math.abs(veh.suspLift) > 0.002 || Math.abs(veh.suspVelY) > 0.002) {
      veh.suspVelY += (-veh.suspLift * 44.0 - veh.suspVelY * 10.0) * dt;
      veh.suspLift += veh.suspVelY * dt;
      this._applyVehicleTerrainPose(veh, isKei, 0);
    }

    if (isKei) {
      const seatW = this.keiLocalToWorld(KEI.driverSeatLocal.x, KEI.driverSeatLocal.z);
      this.playerPos.set(seatW.x, 0, seatW.z);
      this.floorY = (veh.pose.y || 0) + KEI.floorWorldY;
      this.eyeHeight += (0.98 - this.eyeHeight) * Math.min(1, dt * 10);
      this.audio.updateEngine(true, Math.abs(veh.speed) / maxFwd, 'kei');
    } else {
      const seatW = this.camperLocalToWorld(0.72, 0.88);
      this.playerPos.set(seatW.x, 0, seatW.z);
      this.floorY = (veh.pose.y || 0) + CAMPER.floor1WorldY;
      this.eyeHeight += (1.20 - this.eyeHeight) * Math.min(1, dt * 10);
      this.audio.updateEngine(true, Math.abs(veh.speed) / maxFwd, 'diesel');
    }
    this.bobAmount *= 0.85;

    if (this.callbacks.onDriveChange) {
      this.callbacks.onDriveChange(true, {
        vehicle: this.drivingVehicle,
        badge: isKei ? 'KEI-340 660cc' : 'CAMPER-75 6×6',
        speedKmh: Math.round(Math.abs(veh.speed) * 3.6),
        headlightsOn: veh.headlightsOn,
        colliding: blocked || this.vehicleBlockedTimer > 0,
        cliffSlopeDeg: Math.round((Math.atan(cliffMacroSlope) * 180) / Math.PI),
      });
    }
  }

  setMapOpen(open) {
    this.mapOpen = open;
    if (!open) {
      this.map3dActive = false;
    }
    if (open && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  setMap3DMode(active) {
    this.map3dActive = Boolean(active);
    if (this.map3dActive && this.terreno && this.terreno.getOrCreateMap3D) {
      const firstInit = !this.map3d;
      this.map3d = this.terreno.getOrCreateMap3D();
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.map3d.resize(w, h);
      this.map3d.syncPlayerPose({
        x: this.playerPos.x,
        z: this.playerPos.z,
        yaw: this.yaw,
        camperPose: this.house.camper.pose,
        keiPose: this.house.kei.pose,
      });
      if (firstInit) {
        this.map3d.resetOverview(true);
      }
    }
    return this.map3d;
  }

  _isPointInElevatorCab(x, z, floorIdx) {
    if (floorIdx > 1) return false;
    const C = ELEVATOR.cab;
    return x >= C.minX - 0.14 && x <= C.maxX + 0.08 && z >= C.minZ - 0.06 && z <= C.maxZ + 0.06;
  }

  selectElevatorFloor(floor) {
    this.audio.init();
    if (this.house.elevator) this.house.elevator.selectFloor(floor);
  }

  callElevator(floor = this.currentFloor) {
    this.audio.init();
    if (this.house.elevator) this.house.elevator.callToFloor(floor);
  }

  openElevatorDoors() {
    this.audio.init();
    if (this.house.elevator) this.house.elevator.openDoorsNow();
  }

  closeElevatorDoors() {
    this.audio.init();
    if (this.house.elevator) this.house.elevator.closeDoorsNow();
  }

  snapElevator(floor, open = true) {
    if (this.house.elevator) {
      this.house.elevator.snapToFloor(floor, open);
      if (this.inElevator) {
        this.currentFloor = floor;
        this.floorY = this.house.elevator.cabY;
        this._updateCameraTransform(0);
      }
    }
  }

  snapElevatorMidShaft(y, targetFloor = 1) {
    if (this.house.elevator) {
      this.house.elevator.snapMidShaft(y, targetFloor);
      if (this.inElevator) {
        this.floorY = this.house.elevator.cabY;
        this._updateCameraTransform(0);
      }
    }
  }

  setPose(x, z, yaw, pitch = -0.04, floorIdx = null) {
    if (floorIdx !== null && floorIdx >= -3 && floorIdx < FLOORS.length) {
      this.currentFloor = floorIdx;
      this.activeFlight = null;
    }
    this.playerPos.set(x, 0, z);
    this.activeBuilding = this._getBuildingAt(x, z);
    this.inElevator = this._isPointInElevatorCab(x, z, this.currentFloor);
    if (this.adaptive) this.adaptive.snapFloorLights(this.currentFloor, this.activeBuilding, this.inElevator, x, z);
    this.floorY = this._computeFloorY(x, z);
    this.eyeHeight = this._computeDesiredEyeHeight(x, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this._syncCameraFrustum();
    this._updateCameraTransform(0);
    if (this.terreno) this.terreno.update(this.camera.position, 0, null);
    this.adaptive.markShadowsDirty();
  }

  openDoors(ids = null) {
    this.house.interactiveDoors.forEach((d) => {
      if (!ids || ids.includes(d.id)) {
        d.isOpen = true;
        d.forceOpen = true;
        d.progress = 1;
        if (d.kind === 'swing') d.pivot.rotation.y = d.openAngle;
        else if (d.kind === 'liftgate') d.pivot.rotation.x = d.openAngle;
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
        const didInteract = this.interactAtScreenPoint(e.clientX, e.clientY);
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
      const s = this.cameraSensitivity;
      if (this.isLocked) {
        this.yaw -= e.movementX * 0.0022 * s;
        this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - e.movementY * 0.0020 * s));
      } else if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.dragMoved += Math.hypot(dx, dy);
        this.yaw -= dx * 0.0042 * s;
        this.pitch = Math.max(-1.22, Math.min(1.18, this.pitch - dy * 0.0036 * s));
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
      if (k === 'h') { this.toggleVehicleHeadlights(); return; }
      if (k === 'f') {
        if (this.drivingVehicle) this.toggleVehicleHeadlights();
        else this.toggleFlashlight();
        return;
      }
      if (k === 'c' && !this.drivingVehicle) { this.toggleCrouch(); return; }
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
    if (this.map3d) this.map3d.resize(w, h);
  }

  _raycastInteractable(ndc = this.centerNDC, includeDoors = false) {
    if (this.drivingVehicle) return null;
    this.camera.updateMatrixWorld();
    if (this.house.elevator && (this.inElevator || this.nearElevator)) {
      this.house.elevator.cabGroup.updateMatrixWorld(true);
    }
    const targets = [
      ...this.house.interactiveProps
        .filter((p) => (p.isElevatorBtn && (this.inElevator || this.nearElevator)) || p.floor === this.currentFloor)
        .map((p) => p.mesh),
      ...(includeDoors
        ? this.house.interactiveDoors.filter((d) => Math.abs(d.floor - this.currentFloor) <= 1).map((d) => d.mesh)
        : []),
    ];
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.far = 3.2;
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    if (obj.userData.propId) {
      const prop = this.house.interactiveProps.find((p) => p.id === obj.userData.propId);
      if (prop) {
        let shortPrompt = prop.getLabel();
        if (prop.id === 'camper_drive' || prop.id === 'kei_drive') shortPrompt = '運転';
        else if (!prop.isElevatorBtn && !prop.isElevatorCall) shortPrompt = prop.isOn ? '消灯' : '点灯';
        return { kind: 'prop', item: prop, prompt: shortPrompt };
      }
    }
    if (obj.userData.doorId) {
      const door = this.house.interactiveDoors.find((d) => d.id === obj.userData.doorId);
      if (door) return { kind: 'door', item: door, prompt: door.isOpen ? '閉' : '開' };
    }
    return null;
  }

  _triggerInteractHit(hit) {
    if (!hit) return false;
    if (hit.kind === 'door') {
      hit.item.isOpen = !hit.item.isOpen;
      hit.item.autoHoldTimer = 1.2;
      this.audio.playDoor(hit.item.kind === 'pocket');
      this.adaptive.markShadowsDirty();
    } else if (hit.kind === 'prop') {
      if (hit.item.id === 'camper_drive') {
        this.toggleVehicleDrive('camper');
      } else if (hit.item.id === 'kei_drive') {
        this.toggleVehicleDrive('kei');
      } else if (hit.item.isElevatorBtn || hit.item.isElevatorCall) {
        hit.item.toggle();
      } else {
        hit.item.toggle();
        this.audio.playClick(hit.item.isOn);
      }
    }
    if (navigator.vibrate) navigator.vibrate(12);
    return true;
  }

  _interactAimed() {
    const hit = this._raycastInteractable(this.centerNDC, false);
    return this._triggerInteractHit(hit);
  }

  _getBuildingAt(x, z) {
    if (this.drivingVehicle) return this.drivingVehicle;
    if (this.currentFloor < 0) return 'main';
    if (this.activeFlight !== null) return this.activeStairBuilding;

    const cl = this.worldToCamperLocal(x, z);
    const inCamperFootprint = cl.lx >= 0.0 && cl.lx <= CAMPER.width && cl.lz >= 0.0 && cl.lz <= CAMPER.length;
    const kl = this.worldToKeiLocal(x, z);
    const inKeiFootprint = kl.lx >= 0.0 && kl.lx <= KEI.width && kl.lz >= 0.0 && kl.lz <= KEI.length;

    if (this.currentFloor === 1) {
      if (inKeiFootprint) return 'kei';
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
    if (this.drivingVehicle === 'kei') return 0.98;
    if (this.drivingVehicle === 'camper') return 1.20;
    if (this.inElevator) return this.crouching ? 1.04 : 1.54;
    // Daily-Driver Kei-Van interior (CH 1.38m -> authentic crouching walk-in cargo posture 1.04m!)
    if (this.activeBuilding === 'kei' && this.currentFloor === 1) {
      return this.crouching ? 0.88 : 1.04;
    }
    // Giant Camper 2F Loft (CH 0.98m -> authentic crouched/seated loft posture 0.76m!)
    if (this.activeBuilding === 'camper' && this.currentFloor === 2 && this.activeFlight === null) {
      return 0.76;
    }
    if (this.activeBuilding === 'camper' && this.currentFloor === 1 && !this.crouching) {
      return 1.54;
    }

    let desiredEye = this.crouching ? 1.04 : 1.56;
    if (this.crouching) return desiredEye;

    // B2F (CH 3.80m studio) & B3F (CH 2.80m wooden shelter): full standing height!
    if (this.currentFloor < 0) return desiredEye;

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
    if (this.inElevator && this.house.elevator) {
      return this.house.elevator.cabY;
    }
    if (this.activeFlight !== null) {
      if (this.activeFlight === 'st_b2') {
        const t = Math.max(0, Math.min(1, (z - STAIR_B1_B2.topZ) / (STAIR_B1_B2.bottomZ - STAIR_B1_B2.topZ)));
        return STAIR_B1_B2.topY + (STAIR_B1_B2.bottomY - STAIR_B1_B2.topY) * t;
      }
      if (this.activeFlight === 'st_b3') {
        const t = Math.max(0, Math.min(1, (z - STAIR_B2_B3.topZ) / (STAIR_B2_B3.bottomZ - STAIR_B2_B3.topZ)));
        return STAIR_B2_B3.topY + (STAIR_B2_B3.bottomY - STAIR_B2_B3.topY) * t;
      }
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
        const a0 = ANNEX_FLOORS[Math.max(0, this.activeFlight - 1)];
        const a1 = ANNEX_FLOORS[Math.min(ANNEX_FLOORS.length - 1, this.activeFlight)];
        return a0.baseY + (a1.baseY - a0.baseY) * t;
      }
      const sb = HOUSE.stairBox;
      const t = Math.max(0, Math.min(1, (sb.bottomZ - z) / (sb.bottomZ - sb.topZ)));
      const y0 = FLOORS[this.activeFlight].baseY;
      const y1 = FLOORS[this.activeFlight + 1].baseY;
      return y0 + (y1 - y0) * t;
    }

    if (this.currentFloor === -3) {
      return FLOOR_B4F.baseY;
    }
    if (this.currentFloor === -2) {
      if (x > 1.75 && x <= 3.20 && z > 8.60 && z < 10.40) return FLOOR_B3F.baseY - 0.02;
      if (x >= 3.35 && x <= 5.35 && z >= 8.65 && z <= 12.15) return FLOOR_B3F.baseY - 0.03;
      if (x >= 7.60 && x <= 11.60 && z >= 3.85 && z <= 12.15) return FLOOR_B3F.baseY - 0.015;
      if (x >= 5.55 && x <= 7.35 && z >= 6.00 && z <= 12.15) return FLOOR_B3F.baseY - 0.01;
      return FLOOR_B3F.baseY;
    }
    if (this.currentFloor === -1) {
      return FLOOR_B2F.baseY;
    }

    const cl = this.worldToCamperLocal(x, z);
    const inCamper = cl.lx >= 0.0 && cl.lx <= CAMPER.width && cl.lz >= 0.0 && cl.lz <= CAMPER.length;
    const kl = this.worldToKeiLocal(x, z);
    const inKei = kl.lx >= 0.0 && kl.lx <= KEI.width && kl.lz >= 0.0 && kl.lz <= KEI.length;
    const camperBaseY = this.house.camper.pose.y || 0;
    const keiBaseY = this.house.kei.pose.y || 0;

    const baseY = getFloorByPhysicalIndex(this.currentFloor).baseY;
    if (this.currentFloor === 1) {
      if (inKei) return keiBaseY + KEI.floorWorldY;
      // Smooth step-in outside Kei-Van Left Sliding Door (DK-L) and Rear Liftgate (DK-R)!
      if (kl.lx >= -0.32 && kl.lx < 0.0 && kl.lz >= 1.20 && kl.lz <= 2.10) {
        const t = Math.max(0, Math.min(1, (kl.lx + 0.32) / 0.32));
        return keiBaseY - 0.18 + (KEI.floorWorldY + 0.18) * t;
      }
      if (kl.lz > KEI.length && kl.lz <= KEI.length + 0.36 && kl.lx >= 0.12 && kl.lx <= 1.36) {
        const t = Math.max(0, Math.min(1, (KEI.length + 0.36 - kl.lz) / 0.36));
        return keiBaseY - 0.18 + (KEI.floorWorldY + 0.18) * t;
      }
      if (inCamper) {
        if (cl.lx < 1.03 && cl.lz > 3.69 && cl.lz < 5.25) return camperBaseY + CAMPER.floor1WorldY - 0.02;
        return camperBaseY + CAMPER.floor1WorldY;
      }
      if (cl.lx >= -0.36 && cl.lx < 0.0 && cl.lz >= 2.15 && cl.lz <= 2.82) {
        const stepT = Math.max(0, Math.min(1, (cl.lx + 0.36) / 0.36));
        return camperBaseY - 0.18 + (CAMPER.floor1WorldY + 0.18) * stepT;
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
      if (this.terreno) {
        const groundY = this.terreno.getHeightAt(x, z);
        const dComp = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
        // Exact -0.18m courtyard height right at NARROW-50, smoothly settling onto boots-on-ground across 5km×19km!
        const yardLift = dComp < 20.0 ? 0.17 : (dComp < 34.0 ? 0.17 - 0.15 * ((dComp - 20.0) / 14.0) : 0.02);
        return groundY + yardLift;
      }
      return -0.18;
    }
    if (this.currentFloor === 2) {
      if (inCamper || this.activeBuilding === 'camper') return camperBaseY + CAMPER.loft2WorldY;
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
    if (this.currentFloor === 5) {
      if (x > 3.55 && z > 3.50 && z < 5.95) return baseY - 0.02; // 5R04 Hinoki Sky Bath waterproof drop
      if (x < 0.05 && z >= 6.15 && z <= 8.85) return baseY - 0.04; // 5R07 West Canopy Spa Deck
      return baseY;
    }
    if (this.currentFloor === 6) {
      if (z > 9.95) return baseY - 0.04; // 6R07 Full-Width South Sky Observatory Terrace
      return baseY;
    }
    return baseY;
  }

  _getSurfaceMaterial(x, z) {
    if (this.inElevator) return 'tile';
    if (this.activeFlight !== null) {
      if (this.activeFlight === 'st_b2' || this.activeFlight === 'st_b3') return 'tile';
      if (this.activeStairBuilding === 'storage') return 'tile';
      return this.activeStairBuilding === 'main' && this.activeFlight === 0 ? 'tile' : 'wood';
    }
    if (this.currentFloor === -3) return 'tile';
    if (this.currentFloor === -1) {
      return z < 2.85 ? 'tile' : 'wood';
    }
    if (this.currentFloor === -2) {
      if (x < 0.0 && z >= 4.60 && z <= 8.60) return 'wood';
      if (x >= 3.35 && x <= 5.05 && z >= 6.00 && z <= 8.50) return 'wood';
      if (x >= 3.35 && x <= 6.35 && z >= 3.85 && z <= 5.85) return 'wood';
      if (x > 3.25 || z < 3.60 || z > 16.15 || (x > 1.70 && z >= 8.55 && z <= 12.15)) return 'tile';
      return 'wood';
    }
    if (this.activeBuilding === 'kei') return 'tile';
    if (this.activeBuilding === 'camper') {
      const cl = this.worldToCamperLocal(x, z);
      if (this.currentFloor === 2) return cl.lz < 2.17 || cl.lz > 5.25 ? 'tatami' : 'wood';
      if (cl.lz < 1.25 || (cl.lx < 1.03 && cl.lz > 2.85) || (cl.lx > 1.67 && cl.lz > 2.85 && cl.lz < 6.05)) return 'tile';
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
    if (this.currentFloor === 5) {
      if (x < 0.05) return 'wood'; // 5R07 West Spa Cedar Deck
      if (x < 2.20 && z < 6.00) return 'tile'; // 5R01/5R06 Terrazzo hall & spine
      if (x > 3.55 && z > 3.50 && z < 5.95) return 'tile'; // 5R04 Granite Sky Bath
      if (x > 2.55 && z > 6.00) return 'tile'; // 5R05 Emerald Terrazzo Botanical Lab
      return 'wood';
    }
    if (this.currentFloor === 6) {
      if (x > 2.50 && x < 4.60 && z > 0.40 && z < 3.20) return 'tatami'; // 6R02 Starlight Ryukyu Tatami
      if (x > 2.20 && z > 3.50 && z < 5.95) return 'tile'; // 6R03 Black Marble Powder & 6R04 Stone Cellar
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

  _collidesInKeiLocal(lx, lz) {
    const r = this.playerRadius;
    const r2 = r * r;
    const cols = this.house.kei.localColliders || [];
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
      const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
      if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
    }
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.isKei && d.progress < 0.55) {
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
      if (this.activeFlight === 'st_b2') {
        if (x < STAIR_B1_B2.minX + r || x > STAIR_B1_B2.maxX - r) return true;
        return false;
      }
      if (this.activeFlight === 'st_b3') {
        if (x < STAIR_B2_B3.minX + r || x > STAIR_B2_B3.maxX - r) return true;
        return false;
      }
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

    // Dynamic Mechanical Safety Door Interlock & Infrared Light-Curtain Re-Open for ELV-1 Mk2 (floors B4F..1F)
    if (this.currentFloor <= 1 && this.house.elevator) {
      const elv = this.house.elevator;
      const elvMoving = elv.phase === 'RUNNING' || elv.phase === 'RELEVELING' || elv.phase === 'BRAKE_RELEASE';
      const doorPassable = elv.currentStopFloor === this.currentFloor && !elvMoving && elv.doorProgress > 0.62;
      if (!doorPassable) {
        const bx1 = 3.16; const bx2 = 3.36; const bz1 = 1.24; const bz2 = 2.26;
        const cx = x < bx1 ? bx1 : (x > bx2 ? bx2 : x);
        const cz = z < bz1 ? bz1 : (z > bz2 ? bz2 : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) {
          // Real Infrared Light-Curtain Safety Re-Open if player approaches closing door!
          if (elv.currentStopFloor === this.currentFloor && elv.phase === 'DOOR_CLOSING' && elv.doorProgress > 0.15) {
            elv.triggerSafetyReopen();
          }
          return true;
        }
      }
      if (this.inElevator) {
        const C = ELEVATOR.cab;
        if (x > C.maxX - r || z < C.minZ + r || z > C.maxZ - r) return true;
        const inDoorOpeningZ = z >= ELEVATOR.door.minZ + r * 0.7 && z <= ELEVATOR.door.maxZ - r * 0.7;
        if (x < C.minX + r && (!doorPassable || !inDoorOpeningZ)) return true;
      }
    }

    if (this.currentFloor === -3) {
      // Strictly enclosed 2.70m×15.50m B4F Secret Lab (plus ELV-1 cab when inside!)
      if (x < 0.55 + r * 0.5 || x > 4.75 || z < 0.85 + r * 0.5 || z > 16.35 - r * 0.5) return true;
    } else if (this.currentFloor === -2) {
      if (x < -3.25 || x > 11.70 || z < 0.85 || z > 29.55) return true;
    } else if (this.currentFloor === -1) {
      if (x < -1.25 || x > 14.25 || z < 0.70 || z > 17.10) return true;
    } else if (this.currentFloor === 0) {
      if (x < -1.20 || x > 4.95 || z < 0.75 || z > 9.95) return true;
    } else if (this.currentFloor === 1) {
      if (
        x < TERRENO_WORLD.playMinX || x > TERRENO_WORLD.playMaxX ||
        z < TERRENO_WORLD.playMinZ || z > TERRENO_WORLD.playMaxZ
      ) return true;
      // Strict Movable Giant Camper 1F exterior shell + 14-room + widened 560mm corridor collision!
      const cl = this.worldToCamperLocal(x, z);
      if (cl.lx >= -r - 0.16 && cl.lx <= CAMPER.width + r + 0.16 && cl.lz >= -r - 0.18 && cl.lz <= CAMPER.length + r + 0.18) {
        if (this._collidesInCamperLocal(cl.lx, cl.lz, 1)) return true;
      }
      // Strict Movable Daily-Driver Kei-Van exterior shell + walk-in cargo hold collision!
      const kl = this.worldToKeiLocal(x, z);
      if (kl.lx >= -r - 0.12 && kl.lx <= KEI.width + r + 0.12 && kl.lz >= -r - 0.12 && kl.lz <= KEI.length + r + 0.12) {
        if (this._collidesInKeiLocal(kl.lx, kl.lz)) return true;
      }
    } else if (this.currentFloor === 2) {
      const cl = this.worldToCamperLocal(x, z);
      if (this.activeBuilding === 'camper') {
        if (cl.lx < 0.07 + r || cl.lx > CAMPER.width - 0.07 - r || cl.lz < 0.07 + r || cl.lz > CAMPER.length - 0.07 - r) {
          return true;
        }
        if (cl.lx > 1.03 - r && cl.lz > 2.17 && cl.lz < 5.25) return true;
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
        const onBalcony = z >= 9.55 && x >= bal.minX + r && x <= bal.maxX - r && z <= bal.maxZ - r;
        const inInterior = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
        if (!inInterior && !onBalcony) return true;
      }
    } else if (this.currentFloor === 5) {
      const bal5 = HOUSE.balcony5F;
      const onBalcony5 = x >= bal5.minX + r && x <= 0.45 && z >= bal5.minZ + r && z <= bal5.maxZ - r;
      const inInterior = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
      if (!inInterior && !onBalcony5) return true;
    } else if (this.currentFloor === 6) {
      const bal6 = HOUSE.balcony6F;
      const onBalcony6 = z >= 9.55 && x >= bal6.minX + r && x <= bal6.maxX - r && z <= bal6.maxZ - r;
      const inInterior = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
      if (!inInterior && !onBalcony6) return true;
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
      if (!d.isCamper && !d.isKei && d.floor === this.currentFloor && d.progress < 0.55) {
        const b = d.collider;
        const cx = x < b.minX ? b.minX : (x > b.maxX ? b.maxX : x);
        const cz = z < b.minZ ? b.minZ : (z > b.maxZ ? b.maxZ : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
      }
    }

    if (this.currentFloor === 1) {
      const boulders = this.house.boulderColliders || [];
      for (let i = 0; i < boulders.length; i++) {
        const b = boulders[i];
        const md = r + b.r;
        if ((x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) < md * md) {
          if (b.height !== undefined && b.height <= 0.74) {
            this._lastStepOverH = Math.max(this._lastStepOverH || 0, b.height);
            continue;
          }
          return true;
        }
      }
      if (this.terreno) {
        if (this.terreno.ensureCollidersAt) this.terreno.ensureCollidersAt(x, z);
        const localCols = this.terreno.getLocalColliders();
        for (let i = 0; i < localCols.length; i++) {
          const t = localCols[i];
          const md = r + t.r;
          const dx = x - t.x;
          const dz = z - t.z;
          if (dx * dx + dz * dz < md * md) {
            // Natural low boulders & fallen logs <= 0.76m can be vaulted cleanly via auto-jump!
            if ((t.kind === 'boulder' || t.kind === 'log') && t.height !== undefined && t.height <= 0.76) {
              this._lastStepOverH = Math.max(this._lastStepOverH || 0, t.height);
              continue;
            }
            return true;
          }
        }
        // Outside compound buildings: directional deep-river guard (blocks wading deeper into deep rapids, never traps!)
        const dComp = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
        if (dComp > 22.0) {
          const rv = evalMainRiver(z);
          if (Math.abs(x - rv.x) < rv.halfWidth * 0.85) {
            const gY = this.terreno.getHeightAt(x, z);
            const nextDepth = rv.waterY - gY;
            if (nextDepth > 1.15) {
              const curRv = evalMainRiver(this.playerPos.z);
              const curDepth = curRv.waterY - this.terreno.getHeightAt(this.playerPos.x, this.playerPos.z);
              if (nextDepth >= curDepth - 0.02) return true;
            }
          }
        }
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
      // Deep Basement Stair ST_B2: B1F (0) <-> B2F (-1) (descends South +Z)
      if (x >= STAIR_B1_B2.minX && x <= STAIR_B1_B2.maxX) {
        if (this.currentFloor === 0 && prevZ <= STAIR_B1_B2.topZ + 0.04 && z > STAIR_B1_B2.topZ) {
          this.activeFlight = 'st_b2';
          this.activeStairBuilding = 'main';
          return;
        }
        if (this.currentFloor === -1 && prevZ >= STAIR_B1_B2.bottomZ - 0.04 && z < STAIR_B1_B2.bottomZ) {
          this.activeFlight = 'st_b2';
          this.activeStairBuilding = 'main';
          return;
        }
      }
      // Deep Basement Stair ST_B3: B2F (-1) <-> B3F (-2) (descends South +Z)
      if (x >= STAIR_B2_B3.minX && x <= STAIR_B2_B3.maxX) {
        if (this.currentFloor === -1 && prevZ <= STAIR_B2_B3.topZ + 0.04 && z > STAIR_B2_B3.topZ) {
          this.activeFlight = 'st_b3';
          this.activeStairBuilding = 'main';
          return;
        }
        if (this.currentFloor === -2 && prevZ >= STAIR_B2_B3.bottomZ - 0.04 && z < STAIR_B2_B3.bottomZ) {
          this.activeFlight = 'st_b3';
          this.activeStairBuilding = 'main';
          return;
        }
      }
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
      if (this.currentFloor >= 0 && x >= sb.minX && x <= sb.maxX) {
        if (prevZ >= sb.bottomZ - 0.04 && z < sb.bottomZ && this.currentFloor < maxFloor) {
          this.activeFlight = this.currentFloor;
          this.activeStairBuilding = 'main';
        } else if (prevZ <= sb.topZ + 0.04 && z > sb.topZ && this.currentFloor > 0) {
          this.activeFlight = this.currentFloor - 1;
          this.activeStairBuilding = 'main';
        }
      } else if (this.currentFloor >= 1 && x >= asb.minX && x <= asb.maxX) {
        if (this.currentFloor >= 1 && this.currentFloor < 4 && prevZ >= asb.bottomZ - 0.04 && z < asb.bottomZ) {
          this.activeFlight = this.currentFloor;
          this.activeStairBuilding = 'annex';
        } else if (this.currentFloor >= 2 && this.currentFloor <= 4 && prevZ <= asb.topZ + 0.04 && z > asb.topZ) {
          this.activeFlight = this.currentFloor - 1;
          this.activeStairBuilding = 'annex';
        }
      } else if (this.currentFloor >= 1 && x >= ssb.minX && x <= ssb.maxX) {
        if (this.currentFloor === 1 && prevZ >= ssb.bottomZ - 0.04 && z < ssb.bottomZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'storage';
        } else if (this.currentFloor === 2 && prevZ <= ssb.topZ + 0.04 && z > ssb.topZ) {
          this.activeFlight = 1;
          this.activeStairBuilding = 'storage';
        }
      }
    } else if (this.activeFlight === 'st_b2') {
      if (z <= STAIR_B1_B2.topZ) {
        this.currentFloor = 0;
        this.activeFlight = null;
      } else if (z >= STAIR_B1_B2.bottomZ) {
        this.currentFloor = -1;
        this.activeFlight = null;
      }
    } else if (this.activeFlight === 'st_b3') {
      if (z <= STAIR_B2_B3.topZ) {
        this.currentFloor = -1;
        this.activeFlight = null;
      } else if (z >= STAIR_B2_B3.bottomZ) {
        this.currentFloor = -2;
        this.activeFlight = null;
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
    if (this.drivingVehicle) {
      this._updateVehicleDriving(dt);
      return;
    }

    if (this.autoJumpCooldown > 0) this.autoJumpCooldown = Math.max(0, this.autoJumpCooldown - dt);

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
    const tightSlow = ((this.activeBuilding === 'camper' && this.currentFloor === 2) || this.activeBuilding === 'kei') ? 0.72 : 1.0;
    const distFromCompound = Math.hypot(this.playerPos.x - TERRENO_WORLD.compoundCenterX, this.playerPos.z - TERRENO_WORLD.compoundCenterZ);
    const outdoorHike = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && distFromCompound > 22.0;
    const baseWalk = this.crouching ? 1.05 : (sprinting ? (outdoorHike ? 6.8 : 2.75) : (outdoorHike ? 2.65 : 1.75));
    let maxSpeed = baseWalk * stairSlow * tightSlow;

    // Realistic mountain slope slowdown & steep cliff climbing restriction (崖はそう簡単に登れない！)
    let cliffNrm = null;
    if (outdoorHike && this.terreno) {
      cliffNrm = this.terreno.getMacroNormalAt
        ? this.terreno.getMacroNormalAt(this.playerPos.x, this.playerPos.z, 2.2)
        : this.terreno.getNormalAt(this.playerPos.x, this.playerPos.z, 2.2);
      const inLen = _input.length();
      if (inLen > 0.01) {
        const dirX = _input.x / inLen;
        const dirZ = _input.z / inLen;
        // Macro normal (x, z) points downhill -> uphillDot > 0 means climbing uphill
        const uphillDot = -(dirX * cliffNrm.x + dirZ * cliffNrm.z);
        if (uphillDot > 0.05 && cliffNrm.slope > 0.40) {
          // 22°..36°: progressive realistic uphill stamina slowdown
          const climbT = Math.min(1, (cliffNrm.slope - 0.40) / 0.34);
          maxSpeed *= (1.0 - climbT * 0.62);
        }
      }
    }

    const mag = Math.min(1.0, _input.length());
    if (mag > 0.01) {
      _input.normalize().multiplyScalar(maxSpeed * mag);
      this.playerVel.lerp(_input, Math.min(1, dt * 11));
    } else {
      this.playerVel.lerp(_zero, Math.min(1, dt * 13));
    }

    // Steep cliff uphill refusal (> 36°) & sheer cliff downhill slide (> 42°)
    if (outdoorHike && cliffNrm && cliffNrm.slope > 0.73) {
      const horizLen = Math.hypot(cliffNrm.x, cliffNrm.z) || 1.0;
      const downX = cliffNrm.x / horizLen;
      const downZ = cliffNrm.z / horizLen;
      const velDown = this.playerVel.x * downX + this.playerVel.z * downZ;
      if (velDown < 0) {
        // Strip uphill velocity component -> project smoothly onto horizontal contour so cliffs cannot be scaled!
        this.playerVel.x -= velDown * downX;
        this.playerVel.z -= velDown * downZ;
      }
      if (cliffNrm.slope > 0.90) {
        const slipSpeed = Math.min(3.8, (cliffNrm.slope - 0.88) * 5.2);
        this.playerVel.x += downX * slipSpeed * Math.min(1, dt * 6.5);
        this.playerVel.z += downZ * slipSpeed * Math.min(1, dt * 6.5);
      }
    }

    const prevX = this.playerPos.x;
    const prevZ = this.playerPos.z;
    const prevGroundY = this._computeFloorY(prevX, prevZ);
    this._lastStepOverH = 0;

    if (this.activeBuilding === 'camper' || this.activeBuilding === 'kei') {
      const isKei = this.activeBuilding === 'kei';
      const pose = isKei ? this.house.kei.pose : this.house.camper.pose;
      const toLocal = (wx, wz) => (isKei ? this.worldToKeiLocal(wx, wz) : this.worldToCamperLocal(wx, wz));
      const toWorld = (lx, lz) => (isKei ? this.keiLocalToWorld(lx, lz) : this.camperLocalToWorld(lx, lz));
      const c = Math.cos(pose.yaw);
      const s = Math.sin(pose.yaw);
      const curL = toLocal(this.playerPos.x, this.playerPos.z);
      const vxL = this.playerVel.x * c - this.playerVel.z * s;
      const vzL = this.playerVel.x * s + this.playerVel.z * c;

      const cand1 = toWorld(curL.lx + vxL * dt, curL.lz);
      if (!this._collidesAt(cand1.x, cand1.z)) {
        this.playerPos.x = cand1.x;
        this.playerPos.z = cand1.z;
      }
      const midL = toLocal(this.playerPos.x, this.playerPos.z);
      const cand2 = toWorld(midL.lx, midL.lz + vzL * dt);
      if (!this._collidesAt(cand2.x, cand2.z)) {
        this.playerPos.x = cand2.x;
        this.playerPos.z = cand2.z;
      }
    } else {
      const nextX = this.playerPos.x + this.playerVel.x * dt;
      if (!this._collidesAt(nextX, this.playerPos.z)) {
        // Guard against stepping straight onto a > 37° cliff wall uphill
        let cliffBlockX = false;
        if (outdoorHike && this.terreno) {
          const nmX = this.terreno.getMacroNormalAt ? this.terreno.getMacroNormalAt(nextX, this.playerPos.z, 2.2) : cliffNrm;
          const upX = -((nextX - this.playerPos.x) * nmX.x);
          if (nmX && nmX.slope > 0.75 && upX > 0) cliffBlockX = true;
        }
        if (!cliffBlockX) this.playerPos.x = nextX;
      }
      const nextZ = this.playerPos.z + this.playerVel.z * dt;
      if (!this._collidesAt(this.playerPos.x, nextZ)) {
        let cliffBlockZ = false;
        if (outdoorHike && this.terreno) {
          const nmZ = this.terreno.getMacroNormalAt ? this.terreno.getMacroNormalAt(this.playerPos.x, nextZ, 2.2) : cliffNrm;
          const upZ = -((nextZ - this.playerPos.z) * nmZ.z);
          if (nmZ && nmZ.slope > 0.75 && upZ > 0) cliffBlockZ = true;
        }
        if (!cliffBlockZ) this.playerPos.z = nextZ;
      }
    }

    this._updateStairTransitions(prevX, prevZ);
    this.activeBuilding = this._getBuildingAt(this.playerPos.x, this.playerPos.z);

    // Update Elevator Cab Presence & Proximity
    const elv = this.house.elevator;
    if (elv && this.currentFloor <= 1 && this.activeBuilding === 'main') {
      const inFootprint = this._isPointInElevatorCab(this.playerPos.x, this.playerPos.z, this.currentFloor);
      if (inFootprint && (this.inElevator || Math.abs(this.floorY - elv.cabY) < 1.25)) {
        this.inElevator = true;
      } else if (!inFootprint) {
        this.inElevator = false;
      }
      this.nearElevator = !this.inElevator
        && this.playerPos.x >= 1.85 && this.playerPos.x <= 3.34
        && this.playerPos.z >= 0.85 && this.playerPos.z <= 2.75;
    } else {
      this.inElevator = false;
      this.nearElevator = false;
    }

    if (this.inElevator && elv) {
      this.floorY = elv.cabY;
      this.jumpOffset = 0;
      this.jumpVelY = 0;
    } else {
      const targetFloorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
      const lerpRate = this.activeFlight !== null ? 18 : 11;
      this.floorY += (targetFloorY - this.floorY) * Math.min(1, dt * lerpRate);

      // Natural Terrain Auto-Jump over realistic rocks, fallen logs, & step ledges while running outdoors!
      const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const inNature = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && this.activeFlight === null;
      if (inNature && this.jumpOffset <= 0.02 && this.autoJumpCooldown <= 0 && horizSpeed > 1.35) {
        const dH = targetFloorY - prevGroundY;
        const stepObstacleH = this._lastStepOverH || 0;
        const ledgeStepH = (dH > 0.16 && dH <= 0.68 && (!cliffNrm || cliffNrm.slope < 0.72)) ? dH : 0;
        const triggerH = Math.max(stepObstacleH, ledgeStepH);
        if (triggerH > 0.16) {
          const apexH = Math.max(0.28, Math.min(0.86, triggerH + 0.18));
          this.jumpVelY = Math.sqrt(2.0 * 18.0 * apexH);
          this.autoJumpCooldown = 0.48;
          this.audio.playFootstep('earth');
        }
      }

      if (this.jumpOffset > 0 || this.jumpVelY > 0) {
        this.jumpOffset += this.jumpVelY * dt;
        this.jumpVelY -= 18.0 * dt;
        if (this.jumpOffset <= 0) {
          this.jumpOffset = 0;
          this.jumpVelY = 0;
          this.audio.playFootstep(this._getSurfaceMaterial(this.playerPos.x, this.playerPos.z));
        }
      }
    }

    const desiredEye = this._computeDesiredEyeHeight(this.playerPos.x, this.playerPos.z);
    this.eyeHeight += (desiredEye - this.eyeHeight) * Math.min(1, dt * 9);

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (horizSpeed > 0.16 && this.jumpOffset < 0.05) {
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
    const elvRideMotion = (this.inElevator && this.house.elevator)
      ? (this.house.elevator.cabSettleOffset + this.house.elevator.railVibration)
      : 0;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.camera.position.set(
      this.playerPos.x + rightX * bobSide,
      this.floorY + this.jumpOffset + this.eyeHeight + bobY + idleBreath + elvRideMotion,
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

  _updateAutomaticDoors(dt) {
    if (this.autoDoorsReadyTimer > 0) this.autoDoorsReadyTimer = Math.max(0, this.autoDoorsReadyTimer - dt);
    if (this.drivingVehicle) return;

    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    const cl = this.worldToCamperLocal(px, pz);
    const kl = this.worldToKeiLocal(px, pz);
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    const cp = this.house.camper.pose;
    const camLookX = lookX * Math.cos(cp.yaw) - lookZ * Math.sin(cp.yaw);
    const camLookZ = lookX * Math.sin(cp.yaw) + lookZ * Math.cos(cp.yaw);

    for (const d of this.house.interactiveDoors) {
      if (d.forceOpen) continue;
      if (d.autoHoldTimer > 0) d.autoHoldTimer = Math.max(0, d.autoHoldTimer - dt);

      const b = d.collider;
      if (!b) continue;

      let sameFloor = false;
      let tx = px;
      let tz = pz;
      let openDist = 1.25;
      let closeDist = 1.95;

      if (d.isCamper) {
        sameFloor = this.currentFloor === d.floor;
        tx = cl.lx;
        tz = cl.lz;
        if (d.id === 'DC-1') {
          openDist = 1.15;
          closeDist = 1.75;
        } else {
          openDist = 0.68;
          closeDist = 1.12;
        }
      } else if (d.isKei) {
        sameFloor = this.currentFloor === 1;
        tx = kl.lx;
        tz = kl.lz;
        openDist = 0.98;
        closeDist = 1.55;
      } else {
        sameFloor = (d.floor === this.currentFloor)
          || (this.activeFlight !== null && Math.abs(d.floor - this.currentFloor) <= 1);
      }

      if (!sameFloor) {
        if (d.isOpen && d.autoHoldTimer <= 0) {
          d.isOpen = false;
        }
        continue;
      }

      const cx = tx < b.minX ? b.minX : (tx > b.maxX ? b.maxX : tx);
      const cz = tz < b.minZ ? b.minZ : (tz > b.maxZ ? b.maxZ : tz);
      const dist = Math.hypot(tx - cx, tz - cz);

      if (!d.isOpen) {
        let shouldOpen = dist < openDist;
        // In the narrow Camper corridor, only open interior side-doors when facing/approaching them!
        if (shouldOpen && d.isCamper && d.id !== 'DC-1' && dist > 0.36) {
          const dmx = (b.minX + b.maxX) * 0.5 - tx;
          const dmz = (b.minZ + b.maxZ) * 0.5 - tz;
          const dmLen = Math.hypot(dmx, dmz) || 1;
          const faceDot = (dmx / dmLen) * camLookX + (dmz / dmLen) * camLookZ;
          if (faceDot < 0.25) shouldOpen = false;
        }
        if (shouldOpen) {
          d.isOpen = true;
          d.autoHoldTimer = 0.55;
          if (this.autoDoorsReadyTimer <= 0) this.audio.playDoor(d.kind === 'pocket');
          this.adaptive.markShadowsDirty();
        }
      } else {
        if (dist < openDist + 0.15) {
          d.autoHoldTimer = 0.50;
        } else if (dist > closeDist && d.autoHoldTimer <= 0) {
          d.isOpen = false;
          if (this.autoDoorsReadyTimer <= 0) this.audio.playDoor(d.kind === 'pocket');
          this.adaptive.markShadowsDirty();
        }
      }
    }
  }

  _updateWorldSystems(dt, elapsed) {
    this._updateAutomaticDoors(dt);

    let anyDoorAnimating = false;
    const doorOpenMap = {};
    for (const d of this.house.interactiveDoors) {
      doorOpenMap[d.id] = d.progress > 0.12;
      const target = d.isOpen ? 1 : 0;
      if (Math.abs(d.progress - target) > 0.002) {
        anyDoorAnimating = true;
        d.progress += (target - d.progress) * Math.min(1, dt * 8.2);
        const eased = d.progress * d.progress * (3 - 2 * d.progress);
        if (d.kind === 'swing') d.pivot.rotation.y = d.openAngle * eased;
        else if (d.kind === 'liftgate') d.pivot.rotation.x = d.openAngle * eased;
        else if (d.axis === 'x') d.pivot.position.x = d.closedPos.x + d.slideDelta * eased;
        else d.pivot.position.z = d.closedPos.z + d.slideDelta * eased;
      }
    }

    // Real-Time Mark II MRL Traction Elevator 7-Phase Physics, Mechanical Audio Cues & Rider Sync!
    const elv = this.house.elevator;
    if (elv) {
      elv.update(dt);
      const isElvActive = elv.phase !== 'IDLE_OPEN' && elv.phase !== 'IDLE_CLOSED';
      const isElvMoving = elv.phase === 'RUNNING' || elv.phase === 'RELEVELING' || elv.phase === 'BRAKE_RELEASE';
      if (isElvActive) anyDoorAnimating = true;

      if (elv.buttonBeepPending) {
        this.audio.playElevatorButton();
        elv.buttonBeepPending = false;
      }
      if (elv.brakeSoundPending) {
        this.audio.playElevatorBrake(elv.brakeSoundPending === 'engage');
        elv.brakeSoundPending = null;
      }
      if (elv.safetyBeepPending) {
        this.audio.playElevatorSafetyBeep();
        elv.safetyBeepPending = false;
      }
      if (elv.doorSoundPending) {
        this.audio.playElevatorDoor(elv.doorSoundPending === 'open');
        elv.doorSoundPending = null;
      }
      if (elv.chimePending) {
        this.audio.playElevatorChime(elv.chimeDir);
        elv.chimePending = false;
      }
      const hearMotor = (this.inElevator || this.nearElevator) && (elv.phase === 'RUNNING' || elv.phase === 'RELEVELING');
      this.audio.updateElevatorMotor(hearMotor, Math.abs(elv.velocity) / ELEVATOR.maxSpeed);

      if (this.inElevator) {
        this.floorY = elv.cabY;
        if (elv.phase === 'DOOR_OPENING' || elv.phase === 'IDLE_OPEN') {
          this.currentFloor = elv.currentStopFloor;
        } else if (isElvMoving) {
          let nearFl = this.currentFloor;
          let bestD = Infinity;
          for (const st of ELEVATOR.stops) {
            const d = Math.abs(st.y - elv.cabY);
            if (d < bestD) { bestD = d; nearFl = st.floor; }
          }
          this.currentFloor = nearFl;
        }
      }
    }

    // Animate B4F Clandestine Research Core Containment Pod when player is on B4F!
    if (this.house.b4Lab && this.currentFloor === -3) {
      this.house.b4Lab.update(dt, elapsed);
    }
    // Animate B3F Thermal Wing (Löyly steam, laminar forest-breeze fan, ember glow, bath water shimmer)!
    if (this.house.b3Thermal && this.currentFloor === -2) {
      this.house.b3Thermal.update(dt, elapsed);
    }

    this.house.windTimeUniform.value = elapsed;
    this._syncCameraFrustum();
    if (this.terreno) {
      let flashState = null;
      if (this.flashlightOn) {
        this.camera.getWorldPosition(_flashWorldPos);
        this.camera.getWorldDirection(_flashWorldDir);
        flashState = { enabled: true, position: _flashWorldPos, direction: _flashWorldDir, intensity: 4.5 };
      }
      this.terreno.update(this.camera.position, elapsed, flashState);

      // Keep main directional sun/moon shadow camera centered on player outdoors & aligned to active sky!
      const tod = this.terreno.getTimeOfDay();
      if (tod && this.moonLight) {
        const sd = this.terreno.atmoUniforms.uSunDir.value;
        const nearComp = Math.hypot(this.playerPos.x - 1.5, this.playerPos.z - 4.5) < 35.0;
        const tx = nearComp ? 0.5 : this.playerPos.x;
        const ty = nearComp ? 7.5 : this.floorY + 2.0;
        const tz = nearComp ? 4.5 : this.playerPos.z;
        this.moonLight.target.position.set(tx, ty, tz);
        this.moonLight.position.set(tx + sd.x * 46.0, ty + sd.y * 46.0, tz + sd.z * 46.0);
        this.moonLight.target.updateMatrixWorld();
      }
    }
    this.atmosphere.update(elapsed, this.house.camper.pose, this.house.kei.pose);

    const propStates = {};
    for (const p of this.house.interactiveProps) propStates[p.id] = p.isOn;

    const flickerCfg = [
      ['Tatami_Lantern', propStates.lantern_1f, 0.05, 0.025],
      ['Attic_Lantern', propStates.lantern_attic, 0.05, 0.025],
      ['Annex_Cafe_Lamp', propStates.lamp_annex_cafe, 0.04, 0.02],
      ['5F_Conservatory_Lamp', propStates.lamp_5f_conservatory, 0.04, 0.018],
      ['6F_Hearth_Fire', propStates.fireplace_6f, 0.14, 0.08],
    ];
    for (const [lname, isOn, a1, a2] of flickerCfg) {
      const entry = this.house.interiorLights.find((l) => l.name === lname);
      if (entry && isOn && entry.light.visible) {
        entry.light.intensity += (Math.sin(elapsed * 3.1) * a1 + Math.sin(elapsed * 7.3) * a2) * dt * 9;
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

    // Acoustic occlusion across all 5 units + 11-Level Main Tower (B4F..6F+RF)
    if (this.currentFloor <= 0) {
      this.audio.updateOcclusion(0.015);
    } else if (this.activeBuilding === 'kei') {
      const keiOpen = doorOpenMap['DK-L'] || doorOpenMap['DK-R'] || doorOpenMap['DK-D'];
      this.audio.updateOcclusion(keiOpen ? 0.72 : 0.22);
    } else if (this.activeBuilding === 'camper') {
      this.audio.updateOcclusion(doorOpenMap['DC-1'] ? 0.62 : 0.16);
    } else {
      const lxA = this.playerPos.x - ANNEX.originX;
      const lzA = this.playerPos.z - ANNEX.originZ;
      const outside1F = this.currentFloor === 1 && this.activeBuilding === 'courtyard';
      const onMainBal4F = this.currentFloor === 4 && this.activeBuilding === 'main' && this.playerPos.z > 9.90;
      const onMainBal5F = this.currentFloor === 5 && this.activeBuilding === 'main' && this.playerPos.x < 0.05;
      const onMainBal6F = this.currentFloor === 6 && this.activeBuilding === 'main' && this.playerPos.z > 9.90;
      const onAnnexBal3F = this.currentFloor === 3 && this.activeBuilding === 'annex' && (lzA < 0.05 || lzA > 7.95 || lxA < 0.05);
      const onStorageExt =
        (this.activeFlight !== null && this.activeStairBuilding === 'storage') ||
        (this.currentFloor === 2 && this.activeBuilding === 'storage' && this.playerPos.z < STORAGE.originZ + 0.05);
      const isFullyOutdoors = outside1F || onMainBal4F || onMainBal5F || onMainBal6F || onAnnexBal3F || onStorageExt;

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
          (this.currentFloor === 5 && this.activeBuilding === 'main' && doorOpenMap['D5-5']) ||
          (this.currentFloor === 6 && this.activeBuilding === 'main' && doorOpenMap['D6-5']) ||
          (this.currentFloor === 3 && this.activeBuilding === 'annex' && (doorOpenMap['DA3-B1'] || doorOpenMap['DA3-B2'] || doorOpenMap['DA3-B3']))
            ? 0.68 : 0;
        const atticWindBoost =
          (this.currentFloor === HOUSE.atticFloor && this.activeBuilding === 'main') ||
          (this.currentFloor === 4 && this.activeBuilding === 'annex')
            ? 0.52
            : ((this.currentFloor === 5 || this.currentFloor === 6) && this.activeBuilding === 'main' ? 0.28 : 0);
        const windowBoost = Math.max(0, 1 - Math.abs(this.playerPos.z - 9.85) / 4.5) * 0.35;
        this.audio.updateOcclusion(Math.min(1.0, Math.max(d1Boost, da1Boost, balDoorBoost, windowBoost, atticWindBoost)));
      }
    }

    return { anyDoorAnimating, doorOpenMap, propStates };
  }

  _detectCurrentRoom() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    if (this.inElevator && this.house.elevator) {
      const st = this.house.elevator.getState();
      const targetCode = ELEVATOR.stops.find((s) => s.floor === st.targetFloor)?.code || '1F';
      let msg = `MRL-900 リアルELV (${st.floorCode} 停止中 / ${st.cabY.toFixed(1)}m)`;
      if (st.phase === 'BRAKE_RELEASE') msg = `電磁ブレーキ解除 → ${targetCode} 発進`;
      else if (st.phase === 'RUNNING') msg = `リアルELV 昇降中 (${st.speedMs.toFixed(1)}m/s → ${targetCode} / ${st.cabY.toFixed(1)}m)`;
      else if (st.phase === 'RELEVELING') msg = `精密微速着床中 (${targetCode} レベリング)`;
      return { id: 'elevator_cab', code: 'ELV-1', floor: this.currentFloor, building: 'main', nameJp: msg };
    }
    if (this.drivingVehicle === 'kei') {
      const kmh = Math.round(Math.abs(this.house.kei.speed) * 3.6);
      const tag = this.vehicleBlockedTimer > 0 ? ' [衝突停止]' : '';
      return { id: 'kei_driving', code: '軽運転', floor: 1, building: 'kei', nameJp: `日常使い軽バン走行中 (${kmh} km/h)${tag}` };
    }
    if (this.drivingVehicle === 'camper') {
      const kmh = Math.round(Math.abs(this.house.camper.speed) * 3.6);
      const tag = this.vehicleBlockedTimer > 0 ? ' [衝突停止]' : '';
      return { id: 'camper_driving', code: '運転中', floor: 1, building: 'camper', nameJp: `巨大キャンピングカー走行中 (${kmh} km/h)${tag}` };
    }
    if (this.activeFlight !== null) {
      if (this.activeFlight === 'st_b2') {
        return { id: 'stair_b2', code: 'ST_B2', floor: this.currentFloor, building: 'main', nameJp: 'B1F↔B2F スタジオ直通コンクリート階段' };
      }
      if (this.activeFlight === 'st_b3') {
        return { id: 'stair_b3', code: 'ST_B3', floor: this.currentFloor, building: 'main', nameJp: 'B2F↔B3F シェルター直通コンクリート階段' };
      }
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
      const fNames = [
        'B1F↔1F 地下コンクリート階段',
        '1F↔2F 階段',
        '2F↔3F 階段',
        '3F↔4F 階段',
        '4F↔5F 階段',
        '5F↔6F 階段',
        '6F↔屋根裏 階段',
      ];
      return { id: 'stair', code: `ST${this.activeFlight}`, floor: this.currentFloor, building: 'main', nameJp: fNames[this.activeFlight] || '母屋 階段' };
    }

    if (this.activeBuilding === 'kei') {
      const kl = this.worldToKeiLocal(x, z);
      for (let i = KEI_PLAN.rooms.length - 1; i >= 0; i--) {
        const r = KEI_PLAN.rooms[i];
        if (kl.lx >= r.x && kl.lx <= r.x + r.w && kl.lz >= r.z && kl.lz <= r.z + r.d) return r;
      }
      return KEI_PLAN.rooms[2] || KEI_PLAN.rooms[0];
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
      if (x > 2.2 && x < 5.0 && z > -6.0 && z < -1.2) {
        return { id: 'exterior', code: '軽駐車', floor: 1, building: 'courtyard', nameJp: '日常使い軽バン駐車スペース（玄関前）' };
      }
      if (x > 5.0 && x < 10.6 && z >= 1.5 && z < 10.2) {
        return { id: 'exterior', code: 'RV駐車帯', floor: 1, building: 'courtyard', nameJp: '巨大キャンピングカー駐車帯（母屋東隣）' };
      }
      if (x > 5.0 && x < 10.2 && z > -2.5 && z < 1.5) {
        return { id: 'exterior', code: '東歩道', floor: 1, building: 'courtyard', nameJp: '東アプローチ（母屋↔コンクリート倉庫棟）' };
      }
      if (x > -3.1 && x < 0.25 && z > -2.0 && z < 10.2) {
        return { id: 'exterior', code: '中庭', floor: 1, building: 'courtyard', nameJp: '石灯籠の苔中庭（母屋↔隣棟）' };
      }
      const distBase = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
      if (this.terreno && distBase > 22.0) {
        const b = this.terreno.getBiomeInfoAt(x, z);
        const dirNS = z < 0 ? '北' : '南';
        const distLabel = distBase >= 1000 ? `${(distBase / 1000).toFixed(2)}km` : `${Math.round(distBase)}m`;
        return {
          id: 'exterior_mountain',
          code: `EL+${Math.round(b.asl)}m`,
          floor: 1,
          building: 'courtyard',
          nameJp: `${b.zoneJp}（母屋より${dirNS} ${distLabel}）`,
        };
      }
      return { id: 'exterior', code: 'EXT', floor: 1, building: 'courtyard', nameJp: '深い森・苔石アプローチ（標高 +520m）' };
    }

    if (this.currentFloor === -1 && x < 0.0) {
      return { id: 'b2_stair_landing', code: 'ST_B2', floor: -1, building: 'main', nameJp: 'B2F 階段踊場（スタジオ正面扉前）' };
    }
    if (this.currentFloor === -2 && x < 0.0 && z > 12.20) {
      return { id: 'b3_stair_landing', code: 'ST_B3', floor: -2, building: 'main', nameJp: 'B3F 階段踊場（木造シェルター連絡口）' };
    }

    const floorRooms = getFloorByPhysicalIndex(this.currentFloor).rooms;
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
      const rawDtMs = Math.max(0, now - prev);
      const dt = Math.max(0, Math.min(0.05, rawDtMs / 1000));
      const elapsed = Math.max(0, (now - start) / 1000);
      prev = now;

      if (this.map3dActive && this.map3d) {
        this.map3d.syncPlayerPose({
          x: this.playerPos.x,
          z: this.playerPos.z,
          yaw: this.yaw,
          camperPose: this.house.camper.pose,
          keiPose: this.house.kei.pose,
        });
        this.map3d.render(this.renderer, dt, elapsed);
        if (this.callbacks.onAimChange) this.callbacks.onAimChange(null);
        return;
      }

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
        flashlightOn: this.flashlightOn || this.house.camper.headlightsOn || this.house.kei.headlightsOn,
        cameraMoved,
        currentFloor: this.currentFloor,
        activeFlight: this.activeFlight,
        activeBuilding: this.activeBuilding,
        inElevator: this.inElevator,
        doorOpenMap,
        propStates,
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
      });

      // Keep underground crystal clear and standard meshes smoothly harmonized with TERRENO's 19km atmosphere!
      if (this.scene.fog) {
        const targetFog = this.currentFloor < 0 || this.inElevator ? 0.0035 : 0.00018;
        this.scene.fog.density += (targetFog - this.scene.fog.density) * Math.min(1, dt * 8);
      }

      const todPreset = this.terreno ? this.terreno.getTimeOfDay() : null;
      const outdoorExp = todPreset ? todPreset.exposure : 1.12;
      let targetExposure = 1.15;
      if (this.flashlightOn) targetExposure = 1.06;
      else if (this.inElevator) targetExposure = 1.18;
      else if (this.currentFloor === -3) targetExposure = 1.18;
      else if (this.currentFloor === -1) targetExposure = 1.14;
      else if (this.currentFloor === -2) targetExposure = 1.16;
      else if (this.currentFloor === 0) targetExposure = 1.02;
      else if (this.activeBuilding === 'storage') targetExposure = 1.08;
      else if (this.activeBuilding === 'camper' || this.activeBuilding === 'kei') targetExposure = this.currentTodId === 'night' ? 1.18 : outdoorExp;
      else if (room && (room.id === 'exterior_mountain' || room.id === 'exterior')) {
        targetExposure = this.currentTodId === 'night' ? 1.20 : outdoorExp;
      } else if (room && (room.id.includes('passage') || room.id.includes('gallery') || room.id.includes('stair'))) {
        targetExposure = 1.24;
      } else if (this.currentTodId !== 'night') {
        targetExposure = outdoorExp;
      }
      this.postfx.render(this.scene, this.camera, elapsed, targetExposure);

      const aim = this.mapOpen ? null : this._raycastInteractable();
      if (this.callbacks.onAimChange) this.callbacks.onAimChange(aim);

      if (this.callbacks.onPoseUpdate) {
        this.camera.getWorldDirection(_lookDir);
        const inKei = this.activeBuilding === 'kei';
        const inCamper = this.activeBuilding === 'camper';
        const inAnnex = this.activeBuilding === 'annex';
        const inStorage = this.activeBuilding === 'storage';
        const distFromComp = Math.hypot(this.playerPos.x - TERRENO_WORLD.compoundCenterX, this.playerPos.z - TERRENO_WORLD.compoundCenterZ);
        const farOutdoors = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && distFromComp > 22.0;

        let sheetIndex = farOutdoors ? 20 : (this.currentFloor + 3); // 0..19 CAD sheets, 20 = TERRENO 5×19km Topo Map!
        let floorCode = farOutdoors
          ? '山岳'
          : (this.activeBuilding === 'courtyard'
            ? '中庭'
            : (this.inElevator ? 'ELV-1' : getFloorByPhysicalIndex(this.currentFloor).code));
        let localX = this.playerPos.x;
        let localZ = this.playerPos.z;
        let localDx = _lookDir.x;
        let localDz = _lookDir.z;

        if (inKei) {
          sheetIndex = distFromComp > 26.0 ? 20 : SHEET_OFFSETS.kei;
          floorCode = this.drivingVehicle === 'kei' ? '軽運転' : '軽バン';
          const kl = this.worldToKeiLocal(this.playerPos.x, this.playerPos.z);
          localX = kl.lx;
          localZ = kl.lz;
          const kp = this.house.kei.pose;
          const c = Math.cos(kp.yaw);
          const s = Math.sin(kp.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inCamper) {
          sheetIndex = distFromComp > 26.0 ? 20 : (SHEET_OFFSETS.camper + (this.currentFloor === 2 ? 1 : 0));
          floorCode = this.drivingVehicle === 'camper' ? 'RV運転' : (this.currentFloor === 2 ? 'RV 2F' : 'RV 1F');
          const cl = this.worldToCamperLocal(this.playerPos.x, this.playerPos.z);
          localX = cl.lx;
          localZ = cl.lz;
          const cp = this.house.camper.pose;
          const c = Math.cos(cp.yaw);
          const s = Math.sin(cp.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inStorage) {
          sheetIndex = SHEET_OFFSETS.storage + (this.currentFloor === 2 ? 1 : 0);
          floorCode = this.currentFloor === 2 ? '倉庫2F' : '倉庫1F';
          localX = this.playerPos.x - STORAGE.originX;
          localZ = this.playerPos.z - STORAGE.originZ;
        } else if (inAnnex) {
          const aIdx = Math.max(0, Math.min(ANNEX_FLOORS.length - 1, this.currentFloor - 1));
          sheetIndex = SHEET_OFFSETS.annex + aIdx;
          floorCode = ANNEX_FLOORS[aIdx].code;
          localX = this.playerPos.x - ANNEX.originX;
          localZ = this.playerPos.z - ANNEX.originZ;
        }

        this.callbacks.onPoseUpdate({
          x: this.playerPos.x,
          z: this.playerPos.z,
          yaw: this.yaw,
          todId: this.currentTodId,
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
          keiPose: this.house.kei.pose,
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
            terreno: this.terreno ? this.terreno.getStats() : null,
          });
        }
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
