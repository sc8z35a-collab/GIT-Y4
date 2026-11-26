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
  GARAGE, GARAGE_PLAN, ARMOR_CAMPER, ARMOR_CAMPER_PLAN, TOW_CONTAINER, TOW_CONTAINER_PLAN, EXT_ELEVATOR,
  NULL_EREA, NULL_ELEVATOR, NULL_HANGAR_PLAN, AIRSHIP_K11, AIRSHIP_K11_PLAN,
} from './planData.js';
import { TERRENO_WORLD, TERRENO_LANDMARKS, evalMainRiver, evalRegionWeights } from './terreno/terrenoConfig.js';
import { evalClosestTributary } from './terreno/terrenoGeomorphology.js';
import { AUTOPILOT_WAYPOINTS } from './terreno/terrenoAutopilot.js';
import {
  VILLAGE, VILLAGE_VEHICLE_OBSTACLES, isInsideVillagePaving, queryVillageHouseAt, isInVillagePrecinct,
} from './villageData.js';

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
  { minX: -1.58, maxX: 0.02, minZ: 0.32, maxZ: 1.88 },    // Exterior Attic Express Elevator (ELV-EXT) steel shaft
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

    // Multi-Unit Forest Compound + Deep Basement Expansion + Giant Garage + Armor Camper + NULL EREA Silo-40 & Airship K-11:
    this.currentFloor = HOUSE.spawnFloor; // 1 (1F LDK)
    this.activeFlight = null;
    this.activeBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper' | 'kei' | 'garage' | 'armor' | 'container' | 'null_hangar' | 'k11' | 'courtyard'
    this.activeStairBuilding = 'main'; // 'main' | 'annex' | 'storage' | 'camper'
    this.inElevator = false;
    this.nearElevator = false;
    this.inExtElevator = false;
    this.nearExtElevator = false;
    this.inNullElevator = false;
    this.nearNullElevator = false;
    this.onNullLift = false;
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

    this.drivingVehicle = null; // null | 'camper' | 'kei' | 'armor' | 'k11'
    this.driveCamMode = 'cockpit'; // 'cockpit' | 'hood' | 'chase'
    this.k11ClimbInput = 0; // -1 descend, 0 hold, +1 climb (touch HUD buttons)
    this.bumpCooldown = 0;
    this.vehicleBlockedTimer = 0;

    // Autonomous Navigation State (CAMPER-75, ARMOR-155, & Flagship Airship K-11!)
    this.autopilotRoutes = { camper: null, armor: null, k11: null };
    this.selectedAutopilotVehicle = 'camper';
    this.stormEnabled = false;

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
    this.telemetryTimer = 0.25;
    this._prevLightning = 0;
    this._prevBridgeJointTime = 0;
    this._prevSuspHitTime = 0;
    this._prevLandslideRumbleTime = 0;
    this._prevK11Airborne = false;

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

    if (this.terreno && this.terreno.storm) {
      this.terreno.storm.setThunderCallback((distM) => this.audio.playThunder(distM));
    }

    // Snap initial terrain poses for ARMOR-155 & CON-24 cleanly onto level garage slab
    this._applyVehicleTerrainPose(this.house.armorCamper, 'armor');
    this._applyVehicleTerrainPose(this.house.towContainer, 'container');

    // Locked daylight countryside atmosphere
    this.currentTodId = 'day';
    this.lastNear = 0.16;
    this.lastFar = 95000;
    this._lastShadowTargetX = 0.5;
    this._lastShadowTargetZ = 4.5;
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
      logarithmicDepthBuffer: true,
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
    this.camera = new THREE.PerspectiveCamera(64, w / Math.max(1, h), 0.16, 95000);
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
    const targetNear = underground ? 0.08 : (outdoors ? 0.22 : 0.16);
    const targetFar = underground ? 140 : 95000;
    const targetFov = this.drivingVehicle ? (this.driveCamMode === 'chase' ? 68 : 74) : 64;
    if (this.terreno) {
      this.terreno.setVisible(!underground);
    }
    if (targetNear !== this.lastNear || targetFar !== this.lastFar || Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.lastNear = targetNear;
      this.lastFar = targetFar;
      this.camera.near = targetNear;
      this.camera.far = targetFar;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  teleportToWorld(x, z, yaw = null, pitch = -0.06) {
    if (this.drivingVehicle) this.toggleVehicleDrive(this.drivingVehicle, false);
    this.cancelAutopilot();
    this.inElevator = false;
    this.inExtElevator = false;
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
    this._lastShadowTargetX = Number.NaN;
    this._lastShadowTargetZ = Number.NaN;
    if (this.adaptive) this.adaptive.markShadowsDirty();
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
    this.audio.playClick(this.flashlightOn, 'flashlight');
    if (navigator.vibrate) navigator.vibrate(10);
    if (this.callbacks.onFlashlightChange) this.callbacks.onFlashlightChange(this.flashlightOn);
  }

  toggleCrouch() {
    this.audio.init();
    this.crouching = !this.crouching;
    this.targetEyeHeight = this.crouching ? 1.04 : 1.56;
    this.audio.playCrouch(this.crouching);
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

  worldToArmorLocal(wx, wz) {
    const ap = this.house.armorCamper.pose;
    const dx = wx - ap.cx;
    const dz = wz - ap.cz;
    const c = Math.cos(ap.yaw);
    const s = Math.sin(ap.yaw);
    return {
      lx: dx * c - dz * s + ARMOR_CAMPER.width * 0.5,
      lz: dx * s + dz * c + ARMOR_CAMPER.length * 0.5,
    };
  }

  armorLocalToWorld(lx, lz) {
    const ap = this.house.armorCamper.pose;
    const rx = lx - ARMOR_CAMPER.width * 0.5;
    const rz = lz - ARMOR_CAMPER.length * 0.5;
    const c = Math.cos(ap.yaw);
    const s = Math.sin(ap.yaw);
    return {
      x: ap.cx + rx * c + rz * s,
      z: ap.cz - rx * s + rz * c,
    };
  }

  worldToContainerLocal(wx, wz) {
    const tp = this.house.towContainer.pose;
    const dx = wx - tp.cx;
    const dz = wz - tp.cz;
    const c = Math.cos(tp.yaw);
    const s = Math.sin(tp.yaw);
    return {
      lx: dx * c - dz * s + TOW_CONTAINER.width * 0.5,
      lz: dx * s + dz * c + TOW_CONTAINER.length * 0.5,
    };
  }

  containerLocalToWorld(lx, lz) {
    const tp = this.house.towContainer.pose;
    const rx = lx - TOW_CONTAINER.width * 0.5;
    const rz = lz - TOW_CONTAINER.length * 0.5;
    const c = Math.cos(tp.yaw);
    const s = Math.sin(tp.yaw);
    return {
      x: tp.cx + rx * c + rz * s,
      z: tp.cz - rx * s + rz * c,
    };
  }

  worldToK11Local(wx, wz) {
    const kp = this.house.airshipK11.pose;
    const dx = wx - kp.cx;
    const dz = wz - kp.cz;
    const c = Math.cos(kp.yaw);
    const s = Math.sin(kp.yaw);
    return {
      lx: dx * c - dz * s + AIRSHIP_K11.cabin.outerWidth * 0.5,
      lz: dx * s + dz * c + AIRSHIP_K11.cabin.outerLength * 0.5,
    };
  }

  k11LocalToWorld(lx, lz) {
    const kp = this.house.airshipK11.pose;
    const rx = lx - AIRSHIP_K11.cabin.outerWidth * 0.5;
    const rz = lz - AIRSHIP_K11.cabin.outerLength * 0.5;
    const c = Math.cos(kp.yaw);
    const s = Math.sin(kp.yaw);
    return {
      x: kp.cx + rx * c + rz * s,
      z: kp.cz - rx * s + rz * c,
    };
  }

  _notifyStatus(text, tone = 'info') {
    if (this.callbacks.onStatusToast) {
      this.callbacks.onStatusToast(text, tone);
    }
  }

  _getVehicleObj(key) {
    if (key === 'k11') return this.house.airshipK11;
    if (key === 'kei') return this.house.kei;
    if (key === 'armor') return this.house.armorCamper;
    return this.house.camper;
  }

  setStormEnabled(enabled, instant = false) {
    this.stormEnabled = Boolean(enabled);
    if (this.terreno && this.terreno.storm) {
      this.terreno.storm.setStormEnabled(this.stormEnabled, instant);
    }
    if (this.callbacks.onStormChange) this.callbacks.onStormChange(this.stormEnabled);
    return this.stormEnabled;
  }

  toggleArmorShutters(force = null) {
    const armor = this.house.armorCamper;
    if (!armor || !armor.shutters) return false;
    const closed = armor.shutters.toggleShutters(force);
    this.audio.playShutterClank(closed, 'armor_shutter');
    this.adaptive.markShadowsDirty();
    if (navigator.vibrate) navigator.vibrate(14);
    return closed;
  }

  toggleArmorHitch(force = null) {
    const armor = this.house.armorCamper;
    const cont = this.house.towContainer;
    if (!armor || !cont) return false;
    const next = force !== null ? Boolean(force) : !cont.hitched;
    if (next) {
      const dist = Math.hypot(cont.pose.cx - armor.pose.cx, cont.pose.cz - armor.pose.cz);
      if (force !== true && dist > 30.0) {
        this.audio.playAutopilotCue('error');
        return false;
      }
      cont.hitched = true;
      cont.jockeyLeg.position.y = TOW_CONTAINER.groundY + 0.66; // Retract support leg cleanly
      // Snap coupled trailer neatly aligned directly behind ARMOR-155 rear pintle ball!
      const rearDist = ARMOR_CAMPER.hitchLocalZ - ARMOR_CAMPER.length * 0.5;
      const hx = armor.pose.cx + Math.sin(armor.pose.yaw) * rearDist;
      const hz = armor.pose.cz + Math.cos(armor.pose.yaw) * rearDist;
      const dHitch = TOW_CONTAINER.length * 0.5 + TOW_CONTAINER.drawbarLength;
      cont.pose.yaw = armor.pose.yaw;
      cont.pose.cx = hx + Math.sin(cont.pose.yaw) * dHitch;
      cont.pose.cz = hz + Math.cos(cont.pose.yaw) * dHitch;
      this._applyVehicleTerrainPose(cont, 'container');
      // If hitching inside garage, auto-open South shutter so hitched trailer never clips closed gate
      if (cont.pose.cx > 11.0 && cont.pose.cx < 23.0 && cont.pose.cz > 10.0 && cont.pose.cz < 17.5) {
        const dgs = this.house.interactiveDoors.find((d) => d.id === 'DG-S');
        if (dgs) { dgs.isOpen = true; dgs.autoHoldTimer = 2.0; }
      }
    } else {
      cont.hitched = false;
      cont.jockeyLeg.position.y = TOW_CONTAINER.groundY + 0.33; // Lower support leg to ground
    }
    armor.setHitchVisual(cont.hitched);
    this.house.interactiveProps.forEach((p) => {
      if (p.id === 'armor_hitch' || p.id === 'armor_hitch_cab') p.isOn = cont.hitched;
    });
    this.audio.playTowHitch(cont.hitched);
    this.adaptive.markShadowsDirty();
    return cont.hitched;
  }

  toggleNullSilo(force = null) {
    const ne = this.house.nullErea;
    if (!ne || !ne.silo) return false;
    const ok = force === true
      ? ne.silo.startLaunchSequence()
      : (force === false ? ne.silo.startStowSequence() : ne.silo.toggleSequence());
    if (ok) {
      this.audio.playSiloHydraulic(ne.silo.state === 'LAUNCH_OPENING' ? 'unlock' : 'stow_start');
      this._notifyStatus(
        ne.silo.state === 'LAUNCH_OPENING'
          ? 'SILO-40：44枚装甲屋根開放 → 巨大高昇機40m上昇開始'
          : 'SILO-40：地下40mへ格納降下 → 44枚屋根閉鎖',
        'info',
      );
    }
    return ok;
  }

  snapNullSilo(open = true) {
    const ne = this.house.nullErea;
    if (!ne || !ne.silo) return;
    ne.silo.snapState(open);
    if (this.house.airshipK11 && this.house.airshipK11.dockedInSilo) {
      this.house.airshipK11.pose.y = ne.silo.liftY;
      this.house.airshipK11.syncTransform();
    }
  }

  snapNullElevator(floor = 1, open = true) {
    if (this.house.nullElevator) {
      this.house.nullElevator.snapToFloor(floor, open);
    }
  }

  setK11ClimbInput(v) {
    this.k11ClimbInput = Math.max(-1, Math.min(1, Number(v) || 0));
  }

  setK11Pose(cx, y, cz, yaw = 0, dockedInSilo = false) {
    const k11 = this.house.airshipK11;
    if (!k11) return;
    k11.pose.cx = cx;
    k11.pose.y = y;
    k11.pose.cz = cz;
    k11.pose.yaw = yaw;
    k11.dockedInSilo = Boolean(dockedInSilo);
    k11.velX = 0; k11.velY = 0; k11.velZ = 0; k11.speed = 0;
    const surfY = this.terreno ? this.terreno.getHeightAt(cx, cz) : 0;
    k11.altitudeAGL = Math.max(0, y - surfY);
    k11.syncTransform();
  }

  isK11AtRefuelStation() {
    const k11 = this.house.airshipK11;
    if (!k11) return { canRefuel: false, stationName: null };
    const { cx, cz } = k11.pose;
    const distNull = Math.hypot(cx - NULL_EREA.originX, cz - NULL_EREA.originZ);
    if (distNull < NULL_EREA.refuelRadius && (k11.dockedInSilo || k11.altitudeAGL <= 14.0)) {
      return { canRefuel: true, stationName: 'NULL EREA 車庫 (SILO-40)' };
    }
    const hc = NULL_EREA.homeRefuelCenter;
    const distHome = Math.hypot(cx - hc.x, cz - hc.z);
    if (distHome < hc.radius && k11.altitudeAGL <= 14.0) {
      return { canRefuel: true, stationName: '自宅 (NARROW-50 拠点)' };
    }
    return { canRefuel: false, stationName: null };
  }

  refuelK11() {
    const k11 = this.house.airshipK11;
    if (!k11) return false;
    const check = this.isK11AtRefuelStation();
    if (!check.canRefuel) {
      this.audio.playAutopilotCue('error');
      this._notifyStatus('給油不可：車庫(NULL EREA)または自宅に戻って着陸してください', 'error');
      return false;
    }
    k11.fuelL = AIRSHIP_K11.maxFuelL;
    this.audio.playRefuelSound();
    this._notifyStatus(`給油完了 (${check.stationName})：100.0L / 航続 300km`, 'ok');
    this._notifyDriveHUD();
    return true;
  }

  /**
   * Breakthrough #4 — Summon selected camper ('camper' = CAMPER-75 or 'armor' = ARMOR-155)
   * unmanned to K-11's current horizontal position (X, Z excluding altitude)!
   * Strictly rejects rivers, floods, steep cliffs, buildings, open silo pit, and A* unreachable spots!
   */
  summonCamperToK11(vehicleKey = 'camper') {
    const k11 = this.house.airshipK11;
    if (!k11 || !this.terreno || !this.terreno.autopilot) return { valid: false, reasonJp: 'ナビ初期化中' };
    const key = vehicleKey === 'armor' ? 'armor' : 'camper';
    const veh = this._getVehicleObj(key);
    const goalX = k11.pose.cx;
    const goalZ = k11.pose.cz;
    const siloOpen = Boolean(this.house.nullErea && !this.house.nullErea.silo.isRoofSealed());

    const check = this.terreno.autopilot.validateCamperDestination(
      key,
      veh.pose.cx,
      veh.pose.cz,
      goalX,
      goalZ,
      { siloOpen },
    );

    if (!check.valid) {
      this.audio.playAutopilotCue('error');
      this._notifyStatus(check.reasonJp, 'error');
      return check;
    }

    if (key === 'armor') this._ensureGarageGatesOpenForArmor();
    const label = key === 'armor' ? '装甲RV (ARMOR-155)' : 'RV (CAMPER-75)';
    const route = {
      targetId: 'k11_summon',
      goalX,
      goalZ,
      points: check.points,
      cursor: 0,
      isSummon: true,
      stuckTimer: 0,
      stuckStage: 0,
      recoverTimer: 0,
      recoverDir: 1,
      lastCheckX: veh.pose.cx,
      lastCheckZ: veh.pose.cz,
      checkClock: 0,
    };
    this.autopilotRoutes[key] = route;
    this.audio.playAutopilotCue('summon');
    const distKm = (check.distM / 1000).toFixed(2);
    this._notifyStatus(`${label} 呼出発進 → K-11直下 (${distKm} km・自律スタック修正ON)`, 'ok');
    this._notifyDriveHUD();
    return { valid: true, route, distM: check.distM };
  }

  /**
   * Breakthrough #3 — Free-Point Map Autopilot for Airship K-11!
   */
  startK11AutopilotTo(goalX, goalZ, targetId = 'custom') {
    const k11 = this.house.airshipK11;
    if (!k11 || !this.terreno || !this.terreno.autopilot) return null;
    if (k11.fuelL <= 0.1) {
      this.audio.playAutopilotCue('error');
      this._notifyStatus('燃料切れ(0L)：車庫または自宅で給油してください', 'error');
      return null;
    }
    const points = this.terreno.autopilot.computeAirshipRoute(k11.pose.cx, k11.pose.cz, goalX, goalZ);
    const route = {
      targetId,
      goalX,
      goalZ,
      points,
      cursor: 0,
      isAirship: true,
    };
    this.autopilotRoutes.k11 = route;
    this.selectedAutopilotVehicle = 'k11';
    if (k11.dockedInSilo && this.house.nullErea && !this.house.nullErea.silo.isSurfaceReady()) {
      this.house.nullErea.silo.startLaunchSequence();
      this.audio.playSiloHydraulic('unlock');
    } else {
      this.audio.playAutopilotCue('engage');
    }
    const distKm = (Math.hypot(goalX - k11.pose.cx, goalZ - k11.pose.cz) / 1000).toFixed(2);
    this._notifyStatus(`K-11 自動飛行開始 (目標まで ${distKm} km)`, 'ok');
    this._notifyDriveHUD();
    return route;
  }

  cancelAutopilot(vehicleKey = null) {
    const hadAny = vehicleKey ? Boolean(this.autopilotRoutes[vehicleKey]) : Boolean(this.autopilotRoutes.camper || this.autopilotRoutes.armor || this.autopilotRoutes.k11);
    if (vehicleKey) {
      if (this.autopilotRoutes[vehicleKey]) this.autopilotRoutes[vehicleKey] = null;
      this.terreno?.autopilot?.neuralPolicy?.resetHidden?.(vehicleKey);
    } else {
      this.autopilotRoutes.camper = null;
      this.autopilotRoutes.armor = null;
      this.autopilotRoutes.k11 = null;
      this.terreno?.autopilot?.neuralPolicy?.resetHidden?.();
    }
    if (hadAny) this.audio.playAutopilotCue('cancel');
    this._notifyDriveHUD();
  }

  isAutopilotActive(vehicleKey = null) {
    if (vehicleKey) return Boolean(this.autopilotRoutes[vehicleKey]);
    if (this.drivingVehicle === 'camper' || this.drivingVehicle === 'armor' || this.drivingVehicle === 'k11') {
      return Boolean(this.autopilotRoutes[this.drivingVehicle]);
    }
    return Boolean(this.autopilotRoutes.camper || this.autopilotRoutes.armor || this.autopilotRoutes.k11);
  }

  setSelectedAutopilotVehicle(vehicleKey) {
    this.selectedAutopilotVehicle = vehicleKey === 'k11' ? 'k11' : (vehicleKey === 'armor' ? 'armor' : 'camper');
    return this.selectedAutopilotVehicle;
  }

  cycleDriveCameraMode(mode = null) {
    const order = ['cockpit', 'hood', 'chase'];
    if (mode && order.includes(mode)) {
      this.driveCamMode = mode;
    } else {
      const idx = order.indexOf(this.driveCamMode);
      this.driveCamMode = order[(idx + 1) % order.length];
    }
    this._syncCameraFrustum();
    this._notifyDriveHUD();
    if (this.audio && this.audio.playCameraShutter) this.audio.playCameraShutter();
    return this.driveCamMode;
  }

  _ensureGarageGatesOpenForArmor() {
    const ap = this.house.armorCamper?.pose;
    if (!ap || ap.cx < 11.0 || ap.cx > 23.0 || ap.cz < -10.0 || ap.cz > 16.0) return;
    for (const d of this.house.interactiveDoors) {
      if (d.id === 'DG-N' || d.id === 'DG-S') {
        d.isOpen = true;
        d.progress = Math.max(d.progress, 0.95);
        d.autoHoldTimer = 8.0;
        if (d.kind === 'rollup') d.pivot.position.y = d.closedY + d.openLiftY * d.progress;
      }
    }
  }

  startCamperAutopilotTo(vehicleKey, goalX, goalZ, targetId = 'custom') {
    if (!this.terreno || !this.terreno.autopilot) return null;
    if (vehicleKey === 'k11') {
      return this.startK11AutopilotTo(goalX, goalZ, targetId);
    }
    const key = vehicleKey === 'armor' ? 'armor' : 'camper';
    if (key === 'armor') this._ensureGarageGatesOpenForArmor();
    const veh = this._getVehicleObj(key);
    const points = this.terreno.autopilot.computeSafeRoute(veh.pose.cx, veh.pose.cz, goalX, goalZ);
    const route = {
      targetId,
      goalX,
      goalZ,
      points,
      cursor: 0,
      stuckTimer: 0,
      stuckStage: 0,
      recoverTimer: 0,
      recoverDir: 1,
      lastCheckX: veh.pose.cx,
      lastCheckZ: veh.pose.cz,
      checkClock: 0,
    };
    this.autopilotRoutes[key] = route;
    this.selectedAutopilotVehicle = key;
    this.audio.playAutopilotCue('engage');
    this._notifyDriveHUD();
    return route;
  }

  startCamperAutopilotToDynamic(vehicleKey, kind) {
    if (vehicleKey === 'k11') {
      if (kind === 'home') return this.startK11AutopilotTo(1.5, -24.0, 'dyn_home');
      if (kind === 'null_erea' || kind === 'k11') return this.startK11AutopilotTo(NULL_EREA.originX, NULL_EREA.originZ, 'dyn_null');
      if (kind === 'kei') return this.startK11AutopilotTo(this.house.kei.pose.cx, this.house.kei.pose.cz, 'dyn_kei');
      if (kind === 'container') return this.startK11AutopilotTo(this.house.towContainer.pose.cx, this.house.towContainer.pose.cz, 'dyn_container');
      if (kind === 'camper') return this.startK11AutopilotTo(this.house.camper.pose.cx, this.house.camper.pose.cz, 'dyn_camper');
      if (kind === 'armor') return this.startK11AutopilotTo(this.house.armorCamper.pose.cx, this.house.armorCamper.pose.cz, 'dyn_armor');
      return null;
    }
    const key = vehicleKey === 'armor' ? 'armor' : 'camper';
    if (kind === 'home') {
      const gx = key === 'camper' ? 7.75 : 15.6;
      const gz = key === 'camper' ? -12.0 : -15.0;
      return this.startCamperAutopilotTo(key, gx, gz, 'dyn_home');
    }
    if (kind === 'null_erea') {
      return this.startCamperAutopilotTo(key, NULL_EREA.camperDock.cx, NULL_EREA.camperDock.cz, 'dyn_null');
    }
    if (kind === 'k11') {
      const res = this.summonCamperToK11(key);
      return res.valid ? res.route : null;
    }
    if (kind === 'kei') {
      const kp = this.house.kei.pose;
      return this.startCamperAutopilotTo(key, kp.cx, kp.cz, 'dyn_kei');
    }
    if (kind === 'container') {
      const tp = this.house.towContainer.pose;
      return this.startCamperAutopilotTo(key, tp.cx, tp.cz, 'dyn_container');
    }
    if (kind === 'camper') {
      if (key === 'camper') return this.startCamperAutopilotTo(key, 7.75, -12.0, 'dyn_home');
      const cp = this.house.camper.pose;
      return this.startCamperAutopilotTo(key, cp.cx, cp.cz, 'dyn_camper');
    }
    if (kind === 'armor') {
      if (key === 'armor') return this.startCamperAutopilotTo(key, 15.6, -15.0, 'dyn_home');
      const ap = this.house.armorCamper.pose;
      return this.startCamperAutopilotTo(key, ap.cx, ap.cz, 'dyn_armor');
    }
    return null;
  }

  toggleVehicleAutopilot(vehicleKey = null) {
    const key = vehicleKey
      || (this.drivingVehicle === 'camper' || this.drivingVehicle === 'armor' || this.drivingVehicle === 'k11' ? this.drivingVehicle : null)
      || (this.activeBuilding === 'camper' || this.activeBuilding === 'armor' || this.activeBuilding === 'k11' ? this.activeBuilding : null)
      || this.selectedAutopilotVehicle
      || 'camper';
    if (key !== 'camper' && key !== 'armor' && key !== 'k11') return false;
    if (this.autopilotRoutes[key]) {
      this.autopilotRoutes[key] = null;
      this._notifyDriveHUD();
      return false;
    }
    if (!this.terreno || !this.terreno.autopilot) return false;
    if (key === 'k11') {
      const k11 = this.house.airshipK11;
      const fx = -Math.sin(k11.pose.yaw);
      const fz = -Math.cos(k11.pose.yaw);
      const gx = Math.max(TERRENO_WORLD.playMinX + 80, Math.min(TERRENO_WORLD.playMaxX - 80, k11.pose.cx + fx * 6000));
      const gz = Math.max(TERRENO_WORLD.playMinZ + 80, Math.min(TERRENO_WORLD.playMaxZ - 80, k11.pose.cz + fz * 6000));
      return Boolean(this.startK11AutopilotTo(gx, gz, 'cruise'));
    }
    if (key === 'armor') this._ensureGarageGatesOpenForArmor();
    const veh = this._getVehicleObj(key);
    const points = this.terreno.autopilot.buildCruiseAheadRoute(veh.pose.cx, veh.pose.cz, veh.pose.yaw, 2800);
    const last = points[points.length - 1];
    this.autopilotRoutes[key] = {
      targetId: 'cruise',
      goalX: last[0],
      goalZ: last[1],
      points,
      cursor: 0,
      stuckTimer: 0,
      stuckStage: 0,
      recoverTimer: 0,
      recoverDir: 1,
      lastCheckX: veh.pose.cx,
      lastCheckZ: veh.pose.cz,
      checkClock: 0,
    };
    this.selectedAutopilotVehicle = key;
    this._notifyDriveHUD();
    return true;
  }

  startArmorAutopilotTo(goalX, goalZ, targetId = 'custom') {
    return this.startCamperAutopilotTo('armor', goalX, goalZ, targetId);
  }

  startArmorAutopilotToDynamic(kind) {
    return this.startCamperAutopilotToDynamic('armor', kind);
  }

  _notifyDriveHUD() {
    if (!this.callbacks.onDriveChange) return;
    const activeKey = this.drivingVehicle;
    const activeRiderAuto = (this.activeBuilding === 'k11' && this.autopilotRoutes.k11)
      ? 'k11'
      : ((this.activeBuilding === 'camper' && this.autopilotRoutes.camper)
        ? 'camper'
        : ((this.activeBuilding === 'armor' && this.autopilotRoutes.armor) ? 'armor' : null));
    if (!activeKey) {
      this.callbacks.onDriveChange(false, {
        vehicle: activeRiderAuto,
        autopilotActive: Boolean(this.autopilotRoutes.camper || this.autopilotRoutes.armor || this.autopilotRoutes.k11),
        autopilotCamper: Boolean(this.autopilotRoutes.camper),
        autopilotArmor: Boolean(this.autopilotRoutes.armor),
        autopilotK11: Boolean(this.autopilotRoutes.k11),
        ridingAutopilot: activeRiderAuto,
        camMode: this.driveCamMode,
      });
      return;
    }
    const veh = this._getVehicleObj(activeKey);
    if (activeKey === 'k11') {
      const refuelCheck = this.isK11AtRefuelStation();
      const nearSilo = Math.hypot(veh.pose.cx - NULL_EREA.originX, veh.pose.cz - NULL_EREA.originZ) < 42.0;
      this.callbacks.onDriveChange(true, {
        vehicle: 'k11',
        badge: 'K-11 TECNICA FORCES',
        speedKmh: Math.round(veh.groundSpeedKmh || 0),
        altAgl: Math.round(veh.altitudeAGL || 0),
        fuelL: Number((veh.fuelL ?? 100).toFixed(1)),
        rangeKm: Math.round((veh.fuelL ?? 100) * AIRSHIP_K11.kmPerLiter),
        windKmh: Math.round(veh.windSpeedKmh || 0),
        canRefuel: refuelCheck.canRefuel && veh.fuelL < 99.9,
        nearSilo,
        siloState: this.house.nullErea ? this.house.nullErea.silo.state : 'STORED_B40',
        headlightsOn: veh.headlightsOn,
        autopilotActive: Boolean(this.autopilotRoutes.k11),
        canAutopilot: true,
        camMode: this.driveCamMode,
      });
      return;
    }
    this.callbacks.onDriveChange(true, {
      vehicle: activeKey,
      badge: activeKey === 'kei' ? 'KEI-340 660cc' : (activeKey === 'armor' ? 'ARMOR-155 8×8' : 'CAMPER-75 6×6'),
      speedKmh: Math.round(Math.hypot(veh.velX || 0, veh.velZ || 0) * 3.6),
      headlightsOn: veh.headlightsOn,
      colliding: this.vehicleBlockedTimer > 0,
      autopilotActive: Boolean(this.autopilotRoutes[activeKey]),
      canAutopilot: activeKey === 'camper' || activeKey === 'armor',
      camMode: this.driveCamMode,
    });
  }

  toggleVehicleHeadlights(force = null, vehicleKey = null) {
    const key = vehicleKey || this.drivingVehicle || 'camper';
    const veh = this._getVehicleObj(key);
    veh.headlightsOn = force !== null ? force : !veh.headlightsOn;
    const beamInt = key === 'k11' ? 16.0 : (key === 'kei' ? 8.2 : (key === 'armor' ? 12.0 : 9.5));
    veh.headlights.forEach((h) => {
      h.intensity = veh.headlightsOn ? beamInt : 0.0;
    });
    this.adaptive.markShadowsDirty();
    this.audio.playClick(veh.headlightsOn, 'headlight');
    if (this.drivingVehicle === key) {
      this._notifyDriveHUD();
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

  toggleArmorDrive(force = null) {
    this.toggleVehicleDrive('armor', force);
  }

  toggleK11Pilot(force = null) {
    const k11 = this.house.airshipK11;
    if (!k11) return;
    const isPiloting = this.drivingVehicle === 'k11';
    const next = force !== null ? Boolean(force) : !isPiloting;
    if (next && isPiloting) return;
    if (!next && !isPiloting) return;

    this.drivingVehicle = next ? 'k11' : null;
    this.k11ClimbInput = 0;
    if (next) {
      this.inElevator = false;
      this.inExtElevator = false;
      this.inNullElevator = false;
      this.activeFlight = null;
      this.activeBuilding = 'k11';
      this.currentFloor = k11.dockedInSilo && this.house.nullErea && this.house.nullErea.silo.liftProgress < 0.5 ? -40 : 1;
      const seatW = this.k11LocalToWorld(AIRSHIP_K11.pilotSeatLocal.x, AIRSHIP_K11.pilotSeatLocal.z);
      this.playerPos.set(seatW.x, 0, seatW.z);
      this.floorY = k11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
      this.eyeHeight = 1.48;
      this.yaw = k11.pose.yaw;
      this.pitch = -0.05;
      this.audio.playEngineStart('k11');
    } else {
      const standW = this.k11LocalToWorld(2.40, 2.85);
      this.playerPos.set(standW.x, 0, standW.z);
      this.playerVel.set(0, 0, 0);
      this.activeBuilding = 'k11';
      this.currentFloor = k11.dockedInSilo && this.house.nullErea && this.house.nullErea.silo.liftProgress < 0.5 ? -40 : 1;
      this.floorY = k11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
      this.eyeHeight = 1.56;
      if (!this.autopilotRoutes.k11 && k11.altitudeAGL < 1.5) {
        this.audio.updateAirshipEngine(false, 0);
        this.audio.playEngineStop('k11');
      }
    }
    this._syncCameraFrustum();
    this._notifyDriveHUD();
  }

  _findSafeVehicleExitWorld(activeKey) {
    const prevFloor = this.currentFloor;
    this.currentFloor = 1;
    let chosen = null;

    if (activeKey === 'camper') {
      // Immediately slide cockpit bulkhead door DC-01 open so player NEVER gets trapped or snagged!
      const dc01 = this.house.interactiveDoors.find((d) => d.id === 'DC-01');
      if (dc01) {
        dc01.isOpen = true;
        dc01.progress = Math.max(dc01.progress, 0.92);
        dc01.autoHoldTimer = 2.6;
        if (dc01.axis === 'x') dc01.pivot.position.x = dc01.closedPos.x + dc01.slideDelta * dc01.progress;
        else dc01.pivot.position.z = dc01.closedPos.z + dc01.slideDelta * dc01.progress;
      }
      const cands = [
        [1.35, 1.54],
        [1.35, 1.92],
        [1.35, 2.48],
        [1.35, 0.92],
      ];
      for (const [lx, lz] of cands) {
        const w = this.camperLocalToWorld(lx, lz);
        if (!this._collidesAt(w.x, w.z)) {
          chosen = { x: w.x, z: w.z, building: 'camper', eye: 1.54, floorY: (this.house.camper.pose.y || 0) + CAMPER.floor1WorldY };
          break;
        }
      }
      if (!chosen) {
        const w = this.camperLocalToWorld(1.35, 1.54);
        chosen = { x: w.x, z: w.z, building: 'camper', eye: 1.54, floorY: (this.house.camper.pose.y || 0) + CAMPER.floor1WorldY };
      }
    } else if (activeKey === 'armor') {
      const cands = [
        [1.55, 2.15],
        [1.18, 2.25],
        [1.12, 2.85],
        [1.15, 3.60],
      ];
      for (const [lx, lz] of cands) {
        const w = this.armorLocalToWorld(lx, lz);
        if (!this._collidesAt(w.x, w.z)) {
          chosen = { x: w.x, z: w.z, building: 'armor', eye: 1.56, floorY: (this.house.armorCamper.pose.y || 0) + ARMOR_CAMPER.floorWorldY };
          break;
        }
      }
      if (!chosen) {
        const w = this.armorLocalToWorld(1.55, 2.15);
        chosen = { x: w.x, z: w.z, building: 'armor', eye: 1.56, floorY: (this.house.armorCamper.pose.y || 0) + ARMOR_CAMPER.floorWorldY };
      }
    } else {
      // KEI-340: Prefer stepping cleanly outside beside the driver's door (opening DK-D),
      // falling back to left side (DK-L) or clear interior cargo bay so player NEVER gets stuck!
      const dkD = this.house.interactiveDoors.find((d) => d.id === 'DK-D');
      const dkL = this.house.interactiveDoors.find((d) => d.id === 'DK-L');
      const extRight = this.keiLocalToWorld(1.92, 0.78);
      if (!this._collidesAt(extRight.x, extRight.z)) {
        if (dkD) {
          dkD.isOpen = true;
          dkD.progress = Math.max(dkD.progress, 0.85);
          dkD.autoHoldTimer = 2.4;
          dkD.pivot.rotation.y = dkD.openAngle * dkD.progress;
        }
        chosen = { x: extRight.x, z: extRight.z, building: 'courtyard', eye: 1.56, floorY: this._computeFloorY(extRight.x, extRight.z) };
      } else {
        const extLeft = this.keiLocalToWorld(-0.46, 1.66);
        if (!this._collidesAt(extLeft.x, extLeft.z)) {
          if (dkL) {
            dkL.isOpen = true;
            dkL.progress = Math.max(dkL.progress, 0.85);
            dkL.autoHoldTimer = 2.4;
          }
          chosen = { x: extLeft.x, z: extLeft.z, building: 'courtyard', eye: 1.56, floorY: this._computeFloorY(extLeft.x, extLeft.z) };
        } else {
          if (dkL) {
            dkL.isOpen = true;
            dkL.progress = Math.max(dkL.progress, 0.85);
            dkL.autoHoldTimer = 2.4;
          }
          const inCargo = this.keiLocalToWorld(0.64, 1.66);
          chosen = { x: inCargo.x, z: inCargo.z, building: 'kei', eye: 1.04, floorY: (this.house.kei.pose.y || 0) + KEI.floorWorldY };
        }
      }
    }

    this.currentFloor = prevFloor;
    return chosen;
  }

  toggleVehicleDrive(vehicleKey, force = null) {
    if (vehicleKey === 'k11' || (!force && this.drivingVehicle === 'k11')) {
      return this.toggleK11Pilot(force);
    }
    const isDrivingThis = this.drivingVehicle === vehicleKey;
    const next = force !== null ? force : !isDrivingThis;
    if (next && this.drivingVehicle === vehicleKey) return;
    if (!next && !this.drivingVehicle) return;

    const activeKey = next ? vehicleKey : this.drivingVehicle;
    const veh = this._getVehicleObj(activeKey);
    const engProfile = activeKey === 'kei' ? 'kei' : (activeKey === 'armor' ? 'armor' : 'diesel');
    const keepAutopilotRunning = !next && Boolean(this.autopilotRoutes[activeKey]);

    this.drivingVehicle = next ? activeKey : null;
    veh.driveProp.isOn = next;

    // Only zero speed when entering manually OR exiting without active autopilot!
    if (!keepAutopilotRunning) {
      veh.speed = 0;
      veh.velX = 0;
      veh.velZ = 0;
      veh.slipSpeed = 0;
    }

    if (next) {
      this.inElevator = false;
      this.inExtElevator = false;
      this.currentFloor = 1;
      this.activeFlight = null;
      if (activeKey === 'camper') {
        const dc1 = this.house.interactiveDoors.find((d) => d.id === 'DC-1');
        if (dc1) dc1.isOpen = false;
        this.activeBuilding = 'camper';
        const seatW = this.camperLocalToWorld(0.72, 0.68);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + CAMPER.floor1WorldY;
        this.eyeHeight = 1.44;
        this.yaw = veh.pose.yaw;
        this.pitch = -0.06;
      } else if (activeKey === 'armor') {
        ['DAM-1', 'DAM-R'].forEach((id) => {
          const d = this.house.interactiveDoors.find((x) => x.id === id);
          if (d) d.isOpen = false;
        });
        this.activeBuilding = 'armor';
        const seatW = this.armorLocalToWorld(ARMOR_CAMPER.driverSeatLocal.x, 1.06);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + ARMOR_CAMPER.floorWorldY;
        this.eyeHeight = 1.54;
        this.yaw = veh.pose.yaw;
        this.pitch = -0.05;
      } else {
        ['DK-D', 'DK-L', 'DK-R'].forEach((id) => {
          const d = this.house.interactiveDoors.find((x) => x.id === id);
          if (d) d.isOpen = false;
        });
        this.activeBuilding = 'kei';
        const seatW = this.keiLocalToWorld(KEI.driverSeatLocal.x, 0.68);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + KEI.floorWorldY;
        this.eyeHeight = 1.04;
        this.yaw = veh.pose.yaw;
        this.pitch = -0.06;
      }
      this.audio.playEngineStart(engProfile);
      if (this.audio.playSeatbeltLatch) this.audio.playSeatbeltLatch(true);
      this.toggleVehicleHeadlights(true, activeKey);
    } else {
      const exitInfo = this._findSafeVehicleExitWorld(activeKey);
      this.playerPos.set(exitInfo.x, 0, exitInfo.z);
      this.playerVel.set(0, 0, 0);
      this.activeBuilding = exitInfo.building;
      this.floorY = exitInfo.floorY;
      this.eyeHeight = exitInfo.eye;
      if (!keepAutopilotRunning) {
        this.audio.updateEngine(false, 0, engProfile);
        this.audio.playEngineStop(engProfile);
        if (this.audio.playHandbrakeRatchet) this.audio.playHandbrakeRatchet(true);
      }
    }

    this._syncCameraFrustum();
    this._notifyDriveHUD();
  }

  _applyVehicleTerrainPose(veh, kind, stepLift = 0) {
    const cx = veh.pose.cx;
    const cz = veh.pose.cz;
    const yaw = veh.pose.yaw;
    let baseY = 0;
    let pitch = 0;
    let roll = 0;

    if (this.terreno) {
      const isKei = kind === true || kind === 'kei';
      const isArmor = kind === 'armor';
      const isCont = kind === 'container';
      const halfWB = isArmor ? 5.60 : (isCont ? 1.55 : (isKei ? 1.15 : 2.35));
      const halfTr = isArmor ? 1.38 : (isCont ? 0.88 : (isKei ? 0.65 : 1.15));
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

  _updateTowedContainer(movedDist = 0) {
    const cont = this.house.towContainer;
    if (!cont || !cont.hitched) return;
    const armor = this.house.armorCamper;
    const rearDist = ARMOR_CAMPER.hitchLocalZ - ARMOR_CAMPER.length * 0.5;
    const hx = armor.pose.cx + Math.sin(armor.pose.yaw) * rearDist;
    const hz = armor.pose.cz + Math.cos(armor.pose.yaw) * rearDist;
    const dHitch = TOW_CONTAINER.length * 0.5 + TOW_CONTAINER.drawbarLength;

    const dx = hx - cont.pose.cx;
    const dz = hz - cont.pose.cz;
    if (Math.hypot(dx, dz) > 0.01) {
      const desiredYaw = Math.atan2(-dx, -dz);
      let delta = desiredYaw - armor.pose.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      // Clamp articulation angle to ±62° so trailer follows naturally without jackknifing into rear bumper
      delta = Math.max(-1.08, Math.min(1.08, delta));
      cont.pose.yaw = armor.pose.yaw + delta;
    } else {
      cont.pose.yaw = armor.pose.yaw;
    }

    cont.pose.cx = hx + Math.sin(cont.pose.yaw) * dHitch;
    cont.pose.cz = hz + Math.cos(cont.pose.yaw) * dHitch;
    this._applyVehicleTerrainPose(cont, 'container');
    if (Math.abs(movedDist) > 0.0001) {
      const spin = movedDist / TOW_CONTAINER.wheelRadius;
      cont.wheelMeshes.forEach((w) => { w.rotation.x -= spin; });
    }
  }

  setCamperPose(cx, cz, yaw = 0, force = false) {
    const camper = this.house.camper;
    if (!force && this._camperCollidesAt(cx, cz, yaw).hit) return false;
    camper.pose.cx = cx;
    camper.pose.cz = cz;
    camper.pose.yaw = yaw;
    this._applyVehicleTerrainPose(camper, 'camper');
    this.adaptive.markShadowsDirty();
    return true;
  }

  setKeiPose(cx, cz, yaw = 0, force = false) {
    const kei = this.house.kei;
    if (!force && this._keiCollidesAt(cx, cz, yaw).hit) return false;
    kei.pose.cx = cx;
    kei.pose.cz = cz;
    kei.pose.yaw = yaw;
    this._applyVehicleTerrainPose(kei, 'kei');
    this.adaptive.markShadowsDirty();
    return true;
  }

  setArmorPose(cx, cz, yaw = 0, force = false) {
    const armor = this.house.armorCamper;
    if (!force && this._armorCollidesAt(cx, cz, yaw).hit) return false;
    armor.pose.cx = cx;
    armor.pose.cz = cz;
    armor.pose.yaw = yaw;
    this._applyVehicleTerrainPose(armor, 'armor');
    if (this.house.towContainer && this.house.towContainer.hitched) {
      const rearDist = ARMOR_CAMPER.hitchLocalZ - ARMOR_CAMPER.length * 0.5;
      const hx = cx + Math.sin(yaw) * rearDist;
      const hz = cz + Math.cos(yaw) * rearDist;
      const dHitch = TOW_CONTAINER.length * 0.5 + TOW_CONTAINER.drawbarLength;
      this.house.towContainer.pose.yaw = yaw;
      this.house.towContainer.pose.cx = hx + Math.sin(yaw) * dHitch;
      this.house.towContainer.pose.cz = hz + Math.cos(yaw) * dHitch;
      this._applyVehicleTerrainPose(this.house.towContainer, 'container');
    }
    this.adaptive.markShadowsDirty();
    return true;
  }

  setContainerPose(cx, cz, yaw = 0) {
    const cont = this.house.towContainer;
    if (!cont) return false;
    if (cont.hitched) this.toggleArmorHitch(false);
    cont.pose.cx = cx;
    cont.pose.cz = cz;
    cont.pose.yaw = yaw;
    this._applyVehicleTerrainPose(cont, 'container');
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

  _vehicleCollidesCommon(ncx, ncz, hw, hl, nyaw, otherObbs = [], opts = {}) {
    const c = Math.cos(nyaw);
    const s = Math.sin(nyaw);
    const maxStepH = opts.maxStepH ?? 0.50;
    const maxFordDepth = opts.maxFordDepth ?? 0.68;
    const isArmored = Boolean(opts.isArmored);
    const prevCx = opts.prevCx ?? ncx;
    const prevCz = opts.prevCz ?? ncz;

    // 1. Strict 15 km × 40 km TERRENO World Perimeter Check on all 4 OBB corners
    const corners = [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]];
    for (let i = 0; i < 4; i++) {
      const wx = ncx + corners[i][0] * c + corners[i][1] * s;
      const wz = ncz - corners[i][0] * s + corners[i][1] * c;
      if (
        wx < TERRENO_WORLD.playMinX || wx > TERRENO_WORLD.playMaxX ||
        wz < TERRENO_WORLD.playMinZ || wz > TERRENO_WORLD.playMaxZ
      ) return { hit: true, reason: 'bounds', stepLift: 0 };
    }

    // 1b. 3D Bridge Deck Passability & Guardrail Containment + Deep River / Flash-Flood Guard!
    if (this.terreno) {
      const bHit = this.terreno.queryBridgeAt ? this.terreno.queryBridgeAt(ncx, ncz, 0.35) : null;
      if (bHit && bHit.hitGuardrail) {
        return { hit: true, reason: 'bridge_rail', stepLift: 0 };
      }
      const onSolidBridge = Boolean(bHit && bHit.onBridge);
      if (!onSolidBridge) {
        const flood = this.terreno.storm
          ? this.terreno.storm.getFloodInfoAt(ncx, ncz)
          : null;
        const terrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(ncx, ncz) : this.terreno.getHeightAt(ncx, ncz);
        const nextDepth = flood ? flood.depth : Math.max(0, evalMainRiver(ncz).waterY - terrY);
        if (nextDepth > maxFordDepth) {
          const prevFlood = this.terreno.storm
            ? this.terreno.storm.getFloodInfoAt(prevCx, prevCz)
            : null;
          const prevTerrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(prevCx, prevCz) : this.terreno.getHeightAt(prevCx, prevCz);
          const prevDepth = prevFlood ? prevFlood.depth : Math.max(0, evalMainRiver(prevCz).waterY - prevTerrY);
          if (nextDepth >= prevDepth - 0.02) {
            return { hit: true, reason: 'river', stepLift: 0 };
          }
        }
      }
    }

    // 2. Exact SAT OBB vs Ground-Level Static Building, Giant Garage & Suginosato Village AABBs
    if (Math.abs(ncx - 6) < 28 && Math.abs(ncz - 4) < 28) {
      for (let i = 0; i < STATIC_VEHICLE_OBSTACLES.length; i++) {
        if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, STATIC_VEHICLE_OBSTACLES[i])) {
          return { hit: true, reason: 'building', stepLift: 0 };
        }
      }
      const gWalls = this.house.garage ? this.house.garage.vehicleWallObstacles : [];
      for (let i = 0; i < gWalls.length; i++) {
        if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, gWalls[i])) {
          return { hit: true, reason: 'garage', stepLift: 0 };
        }
      }
      for (let i = 0; i < this.house.interactiveDoors.length; i++) {
        const d = this.house.interactiveDoors[i];
        if (d.isGarageGate && d.progress < 0.62) {
          if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, d.collider)) {
            return { hit: true, reason: 'shutter', stepLift: 0 };
          }
        }
      }
    } else if (Math.hypot(ncx - VILLAGE.centerX, ncz - VILLAGE.centerZ) < 70.0) {
      for (let i = 0; i < VILLAGE_VEHICLE_OBSTACLES.length; i++) {
        if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, VILLAGE_VEHICLE_OBSTACLES[i])) {
          return { hit: true, reason: 'building', stepLift: 0 };
        }
      }
    } else if (Math.hypot(ncx - NULL_EREA.originX, ncz - NULL_EREA.originZ) < 62.0) {
      // ELV-NULL surface pavilion & control pedestal
      if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, { minX: -28.2, maxX: -22.0, minZ: 29906.5, maxZ: 29913.5 })) {
        return { hit: true, reason: 'building', stepLift: 0 };
      }
      if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, { minX: -14.7, maxX: -13.7, minZ: 29909.2, maxZ: 29910.8 })) {
        return { hit: true, reason: 'building', stepLift: 0 };
      }
      // Open 40m-deep Launch Silo Aperture guard whenever 44-plate roof is open!
      const silo = this.house.nullErea ? this.house.nullErea.silo : null;
      if (silo && !silo.isRoofSealed()) {
        const sa = NULL_EREA.siloAperture;
        if (this._obbIntersectsAABB(ncx, ncz, hw, hl, nyaw, { minX: sa.minX - 0.5, maxX: sa.maxX + 0.5, minZ: sa.minZ - 0.5, maxZ: sa.maxZ + 0.5 })) {
          return { hit: true, reason: 'silo_pit', stepLift: 0 };
        }
      }
    }

    // 3. Exact SAT OBB vs Other Movable Vehicles & Unhitched Container
    for (let i = 0; i < otherObbs.length; i++) {
      if (otherObbs[i] && this._obbIntersectsOBB({ cx: ncx, cz: ncz, hw, hl, yaw: nyaw }, otherObbs[i])) {
        return { hit: true, reason: 'vehicle', stepLift: 0 };
      }
    }

    // 4. Accurate OBB vs Trees, Oriented Ellipsoidal Boulders, Capsule Nurse Logs, Shrubs & Landslides!
    let stepLift = 0;
    const testPointCircleAgainstOBB = (px, pz, rad) => {
      const dx = px - ncx;
      const dz = pz - ncz;
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      const clx = rx < -hw ? -hw : (rx > hw ? hw : rx);
      const clz = rz < -hl ? -hl : (rz > hl ? hl : rz);
      const ddx = rx - clx;
      const ddz = rz - clz;
      return ddx * ddx + ddz * ddz < rad * rad;
    };

    const checkObstacles = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const dx = o.x - ncx;
        const dz = o.z - ncz;
        const maxRange = hl + (o.r || 1.0) + 3.2;
        if (dx * dx + dz * dz > maxRange * maxRange) continue;

        let intersects = false;
        if (o.kind === 'log' && o.ax !== undefined) {
          // Exact 5-sample full-length oriented capsule test against vehicle OBB!
          const segR = o.r || 0.24;
          for (let k = 0; k <= 4; k++) {
            const u = k * 0.25;
            if (testPointCircleAgainstOBB(o.ax + (o.bx - o.ax) * u, o.az + (o.bz - o.az) * u, segR)) {
              intersects = true;
              break;
            }
          }
        } else if (o.rx && o.rz && o.yaw !== undefined) {
          // Oriented ellipsoidal boulder vs vehicle OBB nearest point!
          const rx = dx * c - dz * s;
          const rz = dx * s + dz * c;
          const clx = rx < -hw ? -hw : (rx > hw ? hw : rx);
          const clz = rz < -hl ? -hl : (rz > hl ? hl : rz);
          // Transform closest OBB point back to world delta from boulder center
          const nearWdx = (clx * c + clz * s) - dx;
          const nearWdz = (-clx * s + clz * c) - dz;
          const bc = Math.cos(o.yaw);
          const bs = Math.sin(o.yaw);
          const ex = nearWdx * bc + nearWdz * bs;
          const ez = -nearWdx * bs + nearWdz * bc;
          intersects = (ex * ex) / (o.rx * o.rx) + (ez * ez) / (o.rz * o.rz) < 1.0;
        } else {
          intersects = testPointCircleAgainstOBB(o.x, o.z, o.r);
        }

        if (intersects) {
          // Dense herbaceous/woody low shrubs: vehicles roll cleanly over brush with minor wheel bump!
          if (o.kind === 'shrub') {
            stepLift = Math.max(stepLift, Math.min(0.18, (o.height || 0.45) * 0.25));
            continue;
          }
          const isNaturalRock = (o.kind === 'boulder' || o.kind === 'log' || o.kind === 'landslide_rock');
          const effMaxStep = isArmored && o.kind === 'landslide_rock' ? maxStepH * 1.25 : maxStepH;
          if (isNaturalRock && o.height !== undefined && o.height <= effMaxStep) {
            stepLift = Math.max(stepLift, o.height * 0.65);
            continue;
          }
          if (isArmored && o.kind === 'tree' && o.r < 0.20) {
            stepLift = Math.max(stepLift, 0.14);
            continue;
          }
          return true;
        }
      }
      return false;
    };

    if (Math.abs(ncx) < 26 && Math.abs(ncz) < 26) {
      if (checkObstacles(LANTERN_OBSTACLES)) return { hit: true, reason: 'lantern', stepLift: 0 };
      if (checkObstacles(this.house.boulderColliders || [])) return { hit: true, reason: 'boulder', stepLift: 0 };
    }
    if (this.terreno && this.terreno.storm) {
      const lsCols = this.terreno.storm.getActiveLandslideColliders();
      if (lsCols.length > 0 && checkObstacles(lsCols)) {
        return { hit: true, reason: 'landslide', stepLift: 0 };
      }
    }
    if (this.terreno) {
      const forestCols = this.terreno.getCollidersNear
        ? this.terreno.getCollidersNear(ncx, ncz)
        : this.terreno.getLocalColliders();
      if (checkObstacles(forestCols)) {
        return { hit: true, reason: 'forest', stepLift: 0 };
      }
    }
    return { hit: false, reason: null, stepLift };
  }

  _getOtherVehicleObbs(excludeKey) {
    const out = [];
    if (excludeKey !== 'camper' && this.house.camper) {
      const p = this.house.camper.pose;
      out.push({ cx: p.cx, cz: p.cz, hw: CAMPER.width * 0.5, hl: CAMPER.length * 0.5, yaw: p.yaw });
    }
    if (excludeKey !== 'kei' && this.house.kei) {
      const p = this.house.kei.pose;
      out.push({ cx: p.cx, cz: p.cz, hw: KEI.width * 0.5, hl: KEI.length * 0.5, yaw: p.yaw });
    }
    if (excludeKey !== 'armor' && this.house.armorCamper) {
      const p = this.house.armorCamper.pose;
      out.push({ cx: p.cx, cz: p.cz, hw: ARMOR_CAMPER.width * 0.5, hl: ARMOR_CAMPER.length * 0.5, yaw: p.yaw });
    }
    if (this.house.towContainer && !(excludeKey === 'armor' && this.house.towContainer.hitched)) {
      const p = this.house.towContainer.pose;
      out.push({ cx: p.cx, cz: p.cz, hw: TOW_CONTAINER.width * 0.5, hl: TOW_CONTAINER.length * 0.5, yaw: p.yaw });
    }
    return out;
  }

  _camperCollidesAt(ncx, ncz, nyaw, prevCx = ncx, prevCz = ncz) {
    return this._vehicleCollidesCommon(ncx, ncz, CAMPER.width * 0.5, CAMPER.length * 0.5, nyaw, this._getOtherVehicleObbs('camper'), {
      maxStepH: 0.62,
      maxFordDepth: 0.92,
      prevCx,
      prevCz,
    });
  }

  _keiCollidesAt(ncx, ncz, nyaw, prevCx = ncx, prevCz = ncz) {
    return this._vehicleCollidesCommon(ncx, ncz, KEI.width * 0.5, KEI.length * 0.5, nyaw, this._getOtherVehicleObbs('kei'), {
      maxStepH: 0.42,
      maxFordDepth: 0.52,
      prevCx,
      prevCz,
    });
  }

  _armorCollidesAt(ncx, ncz, nyaw, prevCx = ncx, prevCz = ncz) {
    return this._vehicleCollidesCommon(ncx, ncz, ARMOR_CAMPER.width * 0.5, ARMOR_CAMPER.length * 0.5, nyaw, this._getOtherVehicleObbs('armor'), {
      maxStepH: 0.95,
      maxFordDepth: 1.95,
      isArmored: true,
      prevCx,
      prevCz,
    });
  }

  _gatherApexObstacleProviders(vehicleKey, cx, cz, yaw = 0) {
    const staticBoxes = [];
    let lanternCols = null;
    let houseBoulderCols = null;

    if (Math.abs(cx - 6) < 75 && Math.abs(cz - 4) < 75) {
      for (let i = 0; i < STATIC_VEHICLE_OBSTACLES.length; i++) {
        staticBoxes.push(STATIC_VEHICLE_OBSTACLES[i]);
      }
      const gWalls = this.house.garage ? this.house.garage.vehicleWallObstacles : [];
      for (let i = 0; i < gWalls.length; i++) {
        staticBoxes.push(gWalls[i]);
      }
      for (let i = 0; i < this.house.interactiveDoors.length; i++) {
        const d = this.house.interactiveDoors[i];
        if (d.isGarageGate && d.progress < 0.62) {
          staticBoxes.push(d.collider);
        }
      }
      lanternCols = LANTERN_OBSTACLES;
      houseBoulderCols = this.house.boulderColliders || null;
    } else if (Math.hypot(cx - VILLAGE.centerX, cz - VILLAGE.centerZ) < 115.0) {
      for (let i = 0; i < VILLAGE_VEHICLE_OBSTACLES.length; i++) {
        staticBoxes.push(VILLAGE_VEHICLE_OBSTACLES[i]);
      }
    } else if (Math.hypot(cx - NULL_EREA.originX, cz - NULL_EREA.originZ) < 110.0) {
      staticBoxes.push({ minX: -28.2, maxX: -22.0, minZ: 29906.5, maxZ: 29913.5, reason: 'building' });
      staticBoxes.push({ minX: -14.7, maxX: -13.7, minZ: 29909.2, maxZ: 29910.8, reason: 'building' });
      const silo = this.house.nullErea ? this.house.nullErea.silo : null;
      if (silo && !silo.isRoofSealed()) {
        const sa = NULL_EREA.siloAperture;
        staticBoxes.push({ minX: sa.minX - 0.6, maxX: sa.maxX + 0.6, minZ: sa.minZ - 0.6, maxZ: sa.maxZ + 0.6, reason: 'silo_pit' });
      }
    }

    const forestCols = this.terreno
      ? (this.terreno.getCollidersNear ? this.terreno.getCollidersNear(cx, cz) : this.terreno.getLocalColliders())
      : null;
    const aheadX = cx - Math.sin(yaw) * 52.0;
    const aheadZ = cz - Math.cos(yaw) * 52.0;
    const forestColsAhead = this.terreno && this.terreno.getCollidersNear
      ? this.terreno.getCollidersNear(aheadX, aheadZ)
      : null;
    const landslideCols = this.terreno && this.terreno.storm
      ? this.terreno.storm.getActiveLandslideColliders()
      : null;

    return {
      forestCols,
      forestColsAhead: forestColsAhead === forestCols ? null : forestColsAhead,
      landslideCols,
      lanternCols,
      houseBoulderCols,
      staticBoxes,
      otherObbs: this._getOtherVehicleObbs(vehicleKey),
    };
  }

  loadApexNeuralWeights(jsonOrText) {
    if (!this.terreno?.autopilot?.neuralPolicy) {
      throw new Error('自動運転エンジンが初期化されていません');
    }
    const meta = this.terreno.autopilot.neuralPolicy.loadWeightsFromJSON(jsonOrText, true);
    const stepsTxt = meta.trainedSteps >= 1e9
      ? ` (${(meta.trainedSteps / 1e9).toFixed(2)}B steps)`
      : (meta.trainedSteps > 0 ? ` (${(meta.trainedSteps / 1e6).toFixed(1)}M steps)` : '');
    this._notifyStatus(`AI重み適用完了：${meta.labelJp}${stepsTxt}`, 'ok');
    return meta;
  }

  resetApexNeuralWeights() {
    if (!this.terreno?.autopilot?.neuralPolicy) return null;
    const meta = this.terreno.autopilot.neuralPolicy.resetToBuiltin();
    this._notifyStatus(`自動運転AIを標準（${meta.labelJp}）へ復元しました`, 'ok');
    return meta;
  }

  getApexNeuralMeta() {
    return this.terreno?.autopilot?.neuralPolicy?.getMeta() || {
      version: 'apex-omnidrive-v6.0',
      format: 'v4-mlp',
      source: 'builtin-structured-v6',
      labelJp: '内蔵 APEX-v6 BASE',
      trainedSteps: 0,
      isCustom: false,
      isTitanV6: false,
    };
  }

  getApexDriveTelemetry(vehicleKey = null) {
    const key = vehicleKey || this.drivingVehicle || this.selectedAutopilotVehicle || 'camper';
    const route = this.autopilotRoutes[key];
    return {
      vehicleKey: key,
      active: Boolean(route),
      mode: route?.mode || 'IDLE',
      lidarFrontMinM: route?.lidarFrontMin ?? 45.0,
      collisionCount: route?.collisionCount || 0,
      kTurnCount: route?.kTurnCount || 0,
      stuckStage: route?.stuckStage || 0,
      neural: this.getApexNeuralMeta(),
    };
  }

  _stepVehiclePhysics(vehicleKey, dt, isPlayerDriving) {
    const isKei = vehicleKey === 'kei';
    const isArmor = vehicleKey === 'armor';
    const veh = this._getVehicleObj(vehicleKey);
    if (veh.suspLift === undefined) { veh.suspLift = 0; veh.suspVelY = 0; }
    if (veh.velX === undefined) { veh.velX = 0; veh.velZ = 0; veh.slipSpeed = 0; }

    let throttle = 0;
    let steerIn = 0;
    if (isPlayerDriving && !this.mapOpen) {
      if (this.keys.has('w') || this.keys.has('arrowup')) throttle += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) throttle -= 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) steerIn += 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) steerIn -= 1;
      if (Math.abs(this.virtualMove.z) > 0.06) throttle -= this.virtualMove.z;
      if (Math.abs(this.virtualMove.x) > 0.06) steerIn -= this.virtualMove.x;
      throttle = Math.max(-1, Math.min(1, throttle));
      steerIn = Math.max(-1, Math.min(1, steerIn));
    }

    const grip = this.terreno && this.terreno.storm
      ? this.terreno.storm.getSurfaceGripAt(veh.pose.cx, veh.pose.cz)
      : 0.96;
    const flood = this.terreno && this.terreno.storm
      ? this.terreno.storm.getFloodInfoAt(veh.pose.cx, veh.pose.cz)
      : { depth: 0, submerged: false, currentX: 0, currentZ: 0 };

    const distFromCompound = Math.hypot(veh.pose.cx - TERRENO_WORLD.compoundCenterX, veh.pose.cz - TERRENO_WORLD.compoundCenterZ);
    const openRoad = distFromCompound > 28.0;
    const towingTrailer = isArmor && this.house.towContainer && this.house.towContainer.hitched;
    const towMassScale = towingTrailer ? 0.86 : 1.0;

    let climbGravAccel = 0;
    let cliffMacroSlope = 0;
    let macroNormal = null;
    let fwdUphill = 0;
    let latSlope = 0;
    const fwdX = -Math.sin(veh.pose.yaw);
    const fwdZ = -Math.cos(veh.pose.yaw);
    const rightX = Math.cos(veh.pose.yaw);
    const rightZ = -Math.sin(veh.pose.yaw);

    if (this.terreno && openRoad) {
      macroNormal = this.terreno.getMacroNormalAt
        ? this.terreno.getMacroNormalAt(veh.pose.cx, veh.pose.cz, 3.2)
        : this.terreno.getNormalAt(veh.pose.cx, veh.pose.cz, 3.2);
      cliffMacroSlope = macroNormal.slope;
      fwdUphill = -(fwdX * macroNormal.x + fwdZ * macroNormal.z);
      latSlope = -(rightX * macroNormal.x + rightZ * macroNormal.z);
      climbGravAccel = -fwdUphill * 12.8;
    }

    const maxClimbSlope = isArmor ? 0.49 : (isKei ? 0.46 : 0.42);
    const cliffHardSlope = isArmor ? 0.60 : (isKei ? 0.56 : 0.52);
    const maxSteer = isKei ? 0.54 : (isArmor ? 0.42 : 0.46);
    const steerRate = isKei ? 8.2 : (isArmor ? 6.0 : 7.4);
    const wheelbase = isArmor ? 7.80 : (isKei ? 1.98 : 4.55);

    // ---- APEX-DRIVE v4.0 Autonomous Driving Controller (RoadGraph A* + 1.25m Local C-Space + 19-Cand MPPI + 32-Ray LiDAR + Smart K-Turn + Shielded Neural Policy) ----
    let autopilotActive = false;
    let unmannedFarTransit = false;
    const route = (vehicleKey === 'camper' || vehicleKey === 'armor') ? this.autopilotRoutes[vehicleKey] : null;
    if (route && this.terreno && this.terreno.autopilot) {
      if (isPlayerDriving && (Math.abs(throttle) > 0.18 || Math.abs(steerIn) > 0.18)) {
        // Manual steering/throttle override cleanly hands control back to player
        this.cancelAutopilot(vehicleKey);
      } else {
        if (isArmor) this._ensureGarageGatesOpenForArmor();
        const distToPlayer = Math.hypot(veh.pose.cx - this.playerPos.x, veh.pose.cz - this.playerPos.z);
        if (!isPlayerDriving && this.activeBuilding !== vehicleKey && distToPlayer > 280.0 && route.isSummon) {
          unmannedFarTransit = true;
        }
        const rqNow = this.terreno.geomorph?.roadIndex
          ? this.terreno.geomorph.roadIndex.queryDist(veh.pose.cx, veh.pose.cz)
          : { dist: 9999, width: 9.5 };
        const onRoad = rqNow.dist < (rqNow.width || 9.5) * 0.65 + 1.5;

        const baseAccelFwd = (unmannedFarTransit ? 16.0 : (isArmor ? (openRoad ? 7.8 : 5.0) : (openRoad ? 8.4 : 5.2))) * towMassScale;
        const baseAccelRev = (isArmor ? 4.2 : 4.6) * towMassScale;
        const baseMaxFwd = (unmannedFarTransit ? 36.0 : (isArmor ? (openRoad ? 17.5 : 7.2) : (openRoad ? 18.5 : 7.0))) * (towingTrailer ? 0.90 : 1.0);

        const apexSpec = {
          hw: (isArmor ? ARMOR_CAMPER.width : CAMPER.width) * 0.5,
          hl: (isArmor ? ARMOR_CAMPER.length : CAMPER.length) * 0.5,
          wheelbase,
          maxSteer,
          steerRate,
          accelFwd: baseAccelFwd,
          accelRev: baseAccelRev,
          maxSpeed: baseMaxFwd,
          minSpeed: isArmor ? 3.2 : 3.4,
          maxStepH: isArmor ? 0.95 : 0.62,
          maxFordDepth: isArmor ? 1.95 : 0.92,
          maxClimbSlope,
          cliffHardSlope,
          isArmor,
          arriveDist: isArmor ? 5.5 : 4.5,
          lookaheadMin: isArmor ? 13.5 : 9.5,
          lookaheadMax: isArmor ? 32.0 : 25.0,
        };

        const providers = this._gatherApexObstacleProviders(vehicleKey, veh.pose.cx, veh.pose.cz, veh.pose.yaw);
        const ctrl = this.terreno.autopilot.evaluateApexControl({
          pose: veh.pose,
          speed: veh.speed,
          velX: veh.velX,
          velZ: veh.velZ,
          steerAngle: veh.steerAngle,
          grip,
          route,
          vehicleKey,
          spec: apexSpec,
          providers,
          dt,
          wasBlocked: Boolean(route.lastFrameBlocked),
          onRoad,
          isTowing: towingTrailer,
          fwdUphill,
          latSlope,
        });

        route.mode = ctrl.mode || 'CRUISE';
        route.lidarFrontMin = ctrl.lidarFrontMin ?? 45.0;

        if (ctrl.arrived) {
          const wasSummon = Boolean(route.isSummon);
          this.autopilotRoutes[vehicleKey] = null;
          throttle = 0;
          steerIn = 0;
          if (wasSummon) {
            this.audio.playElevatorChime(1);
            this._notifyStatus(
              vehicleKey === 'armor' ? '装甲RV (ARMOR-155) がK-11直下に到着しました！' : 'RV (CAMPER-75) がK-11直下に到着しました！',
              'ok',
            );
          }
          this._notifyDriveHUD();
        } else {
          throttle = ctrl.throttle;
          steerIn = ctrl.steer;
          autopilotActive = true;
        }
      }
    }

    const targetSteer = steerIn * maxSteer;
    veh.steerAngle += (targetSteer - veh.steerAngle) * Math.min(1, dt * steerRate);
    veh.frontSteerPivots.forEach((p, idx) => {
      p.rotation.y = isArmor && idx >= 2 ? veh.steerAngle * 0.58 : veh.steerAngle;
    });
    veh.steerWheelGroup.rotation.z = veh.steerAngle * 2.4;

    const accelFwd = (unmannedFarTransit ? 16.0 : (isKei ? (openRoad ? 9.4 : 5.6) : (isArmor ? (openRoad ? 7.8 : 5.0) : (openRoad ? 8.4 : 5.2)))) * towMassScale;
    const accelRev = (isKei ? 5.2 : (isArmor ? 4.2 : 4.6)) * towMassScale;
    const maxFwd = (unmannedFarTransit ? 36.0 : (isKei ? (openRoad ? 19.0 : 7.2) : (isArmor ? (openRoad ? 17.5 : 7.2) : (openRoad ? 18.5 : 7.0)))) * (towingTrailer ? 0.90 : 1.0);
    const maxRev = isKei ? 5.0 : 4.5;

    const tractionAccelScale = 0.42 + 0.58 * grip;
    const coastDrag = 1.4 + 2.5 * grip;

    if (throttle > 0.02) {
      veh.speed += throttle * accelFwd * tractionAccelScale * dt;
    } else if (throttle < -0.02) {
      veh.speed += throttle * accelRev * tractionAccelScale * dt;
    } else {
      veh.speed *= Math.max(0, 1 - dt * coastDrag);
      if (Math.abs(veh.speed) < 0.03 && Math.abs(climbGravAccel) < 2.2) veh.speed = 0;
    }

    if (flood.depth > 0.12) {
      const waterDrag = Math.min(4.8, flood.depth * (isArmor ? 1.4 : 2.9));
      veh.speed *= Math.max(0, 1 - waterDrag * dt);
    }

    if (Math.abs(climbGravAccel) > 1.8) {
      const effectiveGrav = Math.sign(climbGravAccel) * (Math.abs(climbGravAccel) - 1.8);
      veh.speed += effectiveGrav * dt;
    }

    veh.speed = Math.max(-maxRev, Math.min(maxFwd, veh.speed));

    const targetVx = -Math.sin(veh.pose.yaw) * veh.speed;
    const targetVz = -Math.cos(veh.pose.yaw) * veh.speed;
    const latResponse = Math.min(1, dt * (0.42 + grip * grip * 12.8));
    veh.velX += (targetVx - veh.velX) * latResponse;
    veh.velZ += (targetVz - veh.velZ) * latResponse;

    if (grip < 0.65 && Math.abs(veh.speed) > 1.5) {
      const hydroSeverity = (0.65 - grip) / 0.47;
      const turnSlide = Math.sin(veh.steerAngle) * veh.speed * hydroSeverity * 0.52;
      const rx = Math.cos(veh.pose.yaw);
      const rz = -Math.sin(veh.pose.yaw);
      veh.velX += rx * turnSlide * dt * 2.8;
      veh.velZ += rz * turnSlide * dt * 2.8;
      const wind = this.terreno?.storm?.getWind?.();
      if (wind) {
        const wScale = (isArmor ? 0.045 : 0.095) * hydroSeverity;
        veh.velX += wind.x * wScale * dt;
        veh.velZ += wind.z * wScale * dt;
      }
    }

    if (grip < 0.72 && macroNormal && macroNormal.slope > 0.06 && openRoad) {
      const slopeSlip = (0.72 - grip) * 5.2 * (isArmor ? 0.68 : 1.0);
      veh.velX += macroNormal.x * slopeSlip * dt;
      veh.velZ += macroNormal.z * slopeSlip * dt;
    }
    if (flood.depth > 0.14) {
      const currentScale = (isArmor ? 0.32 : (isKei ? 0.92 : 0.62)) * Math.min(1.0, flood.depth / 0.85);
      veh.velX += flood.currentX * currentScale * dt * 2.4;
      veh.velZ += flood.currentZ * currentScale * dt * 2.4;
    }

    veh.slipSpeed = veh.velX * rightX + veh.velZ * rightZ;

    let blocked = false;
    let blockedReason = null;
    let maxStepLift = 0;
    let totalMoved = 0;
    let totalDYaw = 0;
    const planarSpeed = Math.hypot(veh.velX, veh.velZ);

    const testVehCollision = (cx, cz, yaw, pcx, pcz) => (
      isArmor
        ? this._armorCollidesAt(cx, cz, yaw, pcx, pcz)
        : (isKei
          ? this._keiCollidesAt(cx, cz, yaw, pcx, pcz)
          : this._camperCollidesAt(cx, cz, yaw, pcx, pcz))
    );

    if (planarSpeed > 0.005 || Math.abs(veh.speed) > 0.005) {
      const subSteps = Math.abs(veh.speed) > 20.0 ? 5 : 3;
      const subDt = dt / subSteps;
      const wheelRad = isArmor ? ARMOR_CAMPER.wheelRadius : (isKei ? KEI.wheelRadius : CAMPER.wheelRadius);

      for (let sIdx = 0; sIdx < subSteps; sIdx++) {
        const distFwd = veh.speed * subDt;
        const steerGripFactor = 0.58 + 0.42 * grip;
        const dYaw = (distFwd / wheelbase) * Math.tan(veh.steerAngle) * steerGripFactor;
        const nyaw = veh.pose.yaw + dYaw;
        const stepX = veh.velX * subDt;
        const stepZ = veh.velZ * subDt;
        const ncx = veh.pose.cx + stepX;
        const ncz = veh.pose.cz + stepZ;

        if (this.terreno && openRoad) {
          const curY = this.terreno.getHeightAt(veh.pose.cx, veh.pose.cz);
          const nextY = this.terreno.getHeightAt(ncx, ncz);
          const stepDist = Math.max(0.02, Math.hypot(stepX, stepZ));
          const stepRise = nextY - curY;
          const nextMacro = this.terreno.getMacroNormalAt
            ? this.terreno.getMacroNormalAt(ncx, ncz, 3.2)
            : this.terreno.getNormalAt(ncx, ncz, 3.2);
          const moveDirX = stepX / stepDist;
          const moveDirZ = stepZ / stepDist;
          const uphillDot = -(moveDirX * nextMacro.x + moveDirZ * nextMacro.z);

          if (uphillDot > 0.14 && nextMacro.slope > cliffHardSlope) {
            const travelSign = Math.sign(veh.speed) || 1;
            veh.speed = -travelSign * Math.min(2.2, (nextMacro.slope - cliffHardSlope) * 5.0 + 0.65);
            veh.velX *= 0.25;
            veh.velZ *= 0.25;
            blocked = true;
            blockedReason = 'cliff';
            break;
          }
          if (uphillDot > 0.12 && nextMacro.slope > maxClimbSlope && stepRise > 0) {
            const excess = (nextMacro.slope - maxClimbSlope) / Math.max(0.05, cliffHardSlope - maxClimbSlope);
            veh.speed *= Math.max(0, 1.0 - excess * subDt * 6.5);
          }
          const vehMaxLedge = isArmor ? 0.92 : (isKei ? 0.42 : 0.62);
          if (stepRise > 0.08 && stepRise <= vehMaxLedge && stepRise / stepDist > 0.45 && nextMacro.slope <= cliffHardSlope) {
            maxStepLift = Math.max(maxStepLift, stepRise * 0.55);
          }
        }

        const res = testVehCollision(ncx, ncz, nyaw, veh.pose.cx, veh.pose.cz);

        if (!res.hit) {
          veh.pose.cx = ncx;
          veh.pose.cz = ncz;
          veh.pose.yaw = nyaw;
          totalMoved += distFwd;
          totalDYaw += dYaw;
          if (res.stepLift > maxStepLift) maxStepLift = res.stepLift;
        } else {
          // Newton's 3rd Law tangential wall-slide: if lateral storm/slope slip pressed the flank into a trunk,
          // the obstacle normal cancels sideways slip while allowing friction-damped wheel-axis motion if clear.
          const tanStepX = -Math.sin(nyaw) * distFwd;
          const tanStepZ = -Math.cos(nyaw) * distFwd;
          const slipDelta = Math.hypot(stepX - tanStepX, stepZ - tanStepZ);
          let slidCleanly = false;
          if (res.reason !== 'shutter' && res.reason !== 'cliff' && slipDelta > 0.0005 && Math.abs(distFwd) > 0.0002) {
            const tcx = veh.pose.cx + tanStepX;
            const tcz = veh.pose.cz + tanStepZ;
            const tanRes = testVehCollision(tcx, tcz, nyaw, veh.pose.cx, veh.pose.cz);
            if (!tanRes.hit) {
              veh.pose.cx = tcx;
              veh.pose.cz = tcz;
              veh.pose.yaw = nyaw;
              veh.speed *= Math.max(0.88, 1.0 - subDt * 1.8);
              veh.velX = -Math.sin(nyaw) * veh.speed;
              veh.velZ = -Math.cos(nyaw) * veh.speed;
              totalMoved += distFwd;
              totalDYaw += dYaw;
              if (tanRes.stepLift > maxStepLift) maxStepLift = tanRes.stepLift;
              slidCleanly = true;
            }
          }
          if (slidCleanly) continue;

          if (autopilotActive && res.reason === 'shutter') {
            veh.speed *= 0.35;
            veh.velX *= 0.35;
            veh.velZ *= 0.35;
            break;
          }
          veh.speed = isArmor ? -Math.sign(veh.speed) * Math.min(0.45, Math.abs(veh.speed) * 0.12) : 0;
          veh.velX *= 0.1;
          veh.velZ *= 0.1;
          blocked = true;
          blockedReason = res.reason;
          if (isPlayerDriving) {
            this.vehicleBlockedTimer = 0.55;
            if (this.bumpCooldown <= 0) {
              const impact = Math.max(0.35, Math.min(1.0, Math.abs(veh.speed) / 9.0 + 0.30));
              this.audio.playBump(res.reason || 'generic', impact);
              if (navigator.vibrate) navigator.vibrate(isArmor ? 14 : 25);
              this.bumpCooldown = 0.45;
            }
          }
          break;
        }
      }

      const targetSusp = maxStepLift;
      const springK = isKei ? 58.0 : (isArmor ? 36.0 : 42.0);
      const dampC = isKei ? 11.5 : (isArmor ? 8.8 : 9.2);
      const prevSuspVel = veh.suspVelY;
      veh.suspVelY += ((targetSusp - veh.suspLift) * springK - veh.suspVelY * dampC) * dt;
      veh.suspLift = Math.max(-0.08, Math.min(isArmor ? 0.85 : (isKei ? 0.45 : 0.65), veh.suspLift + veh.suspVelY * dt));
      const nowSec = performance.now() * 0.001;
      if (isPlayerDriving && maxStepLift > 0.16 && Math.abs(veh.suspVelY - prevSuspVel) > 1.15 && (nowSec - this._prevSuspHitTime) > 0.34) {
        this._prevSuspHitTime = nowSec;
        this.audio.playSuspensionThud(Math.min(1.0, maxStepLift * 2.1));
      }

      if (Math.abs(totalMoved) > 0.0001 || Math.abs(veh.suspLift) > 0.002 || Math.abs(veh.slipSpeed) > 0.02) {
        this._applyVehicleTerrainPose(veh, vehicleKey, maxStepLift);
        if (isArmor && this.house.towContainer && this.house.towContainer.hitched) {
          this._updateTowedContainer(totalMoved);
        }
        if (Math.abs(totalMoved) > 0.0001) {
          const wheelSpin = totalMoved / wheelRad;
          veh.wheelMeshes.forEach((w) => { w.rotation.x -= wheelSpin; });
          this.adaptive.markShadowsDirty();
        }
      }
    } else if (Math.abs(veh.suspLift) > 0.002 || Math.abs(veh.suspVelY) > 0.002) {
      veh.suspVelY += (-veh.suspLift * 44.0 - veh.suspVelY * 10.0) * dt;
      veh.suspLift += veh.suspVelY * dt;
      this._applyVehicleTerrainPose(veh, vehicleKey, 0);
    }

    // ---- APEX-DRIVE v4.0 EMERGENCY DEADLOCK GUARD (Only triggers if physically wedged after K-Turns!) ----
    if (autopilotActive && route) {
      if (blocked && !route.lastFrameBlocked) {
        route.collisionCount = (route.collisionCount || 0) + 1;
      }
      route.lastFrameBlocked = blocked;
      route.checkClock = (route.checkClock || 0) + dt;
      if (blocked) route.stuckTimer = (route.stuckTimer || 0) + dt * 1.1;

      if (route.checkClock >= 1.2) {
        const netMoved = Math.hypot(veh.pose.cx - (route.lastCheckX ?? veh.pose.cx), veh.pose.cz - (route.lastCheckZ ?? veh.pose.cz));
        route.lastCheckX = veh.pose.cx;
        route.lastCheckZ = veh.pose.cz;
        route.checkClock = 0;
        if (netMoved < 1.2) {
          route.stuckTimer = (route.stuckTimer || 0) + 1.25;
        } else {
          route.stuckTimer = Math.max(0, (route.stuckTimer || 0) - 2.2);
          if (route.stuckTimer < 0.2) route.stuckStage = 0;
        }
      }

      if ((route.stuckTimer || 0) >= 4.5 && (route.stuckStage || 0) === 0) {
        // Stage 1 Emergency: Force fresh macro + local C-Space detour to clear side!
        route.stuckStage = 1;
        route.localPlanTimer = 0;
        route.kTurnMode = 'CRUISE';
        route.kTurnCooldown = 0;
        if (vehicleKey === 'armor') this._ensureGarageGatesOpenForArmor();
      } else if ((route.stuckTimer || 0) >= 8.5 && route.stuckStage === 1) {
        // Stage 2 Emergency: 24-Ray Free-Corridor Heading Alignment (never lands inside obstacle!)
        route.stuckStage = 2;
        const goalPt = route.points[Math.min(route.points.length - 1, (route.cursor || 0) + 2)] || [route.goalX, route.goalZ];
        const aimToGoal = Math.atan2(-(goalPt[0] - veh.pose.cx), -(goalPt[1] - veh.pose.cz));
        let bestEsc = null;
        let bestEscScore = -1e9;
        for (let k = 0; k < 24; k++) {
          const probeYaw = aimToGoal + (k * Math.PI * 2) / 24;
          for (const dist of [4.2, 6.8]) {
            const px = veh.pose.cx - Math.sin(probeYaw) * dist;
            const pz = veh.pose.cz - Math.cos(probeYaw) * dist;
            if (!testVehCollision(px, pz, probeYaw, veh.pose.cx, veh.pose.cz).hit) {
              const align = Math.cos(probeYaw - aimToGoal);
              const sc = align * 10.0 + dist;
              if (sc > bestEscScore) {
                bestEscScore = sc;
                bestEsc = { px, pz, probeYaw };
              }
            }
          }
        }
        if (bestEsc) {
          veh.pose.cx = bestEsc.px;
          veh.pose.cz = bestEsc.pz;
          veh.pose.yaw = bestEsc.probeYaw;
          veh.speed = 3.8;
          veh.velX = -Math.sin(bestEsc.probeYaw) * 3.8;
          veh.velZ = -Math.cos(bestEsc.probeYaw) * 3.8;
          this._applyVehicleTerrainPose(veh, vehicleKey, 0);
          route.localPlanTimer = 0;
          route.stuckTimer = 2.5;
        }
      } else if ((route.stuckTimer || 0) >= 13.5) {
        // Stage 3 Ultimate Deadlock Recovery: Place cleanly onto next collision-free route corridor node
        route.stuckStage = 3;
        const nextIdx = Math.min(route.points.length - 1, (route.cursor || 0) + 2);
        const nxt = route.points[nextIdx];
        const lookIdx = Math.min(route.points.length - 1, nextIdx + 1);
        const lookPt = route.points[lookIdx];
        if (nxt) {
          const aimYaw = Math.atan2(-(lookPt[0] - nxt[0]), -(lookPt[1] - nxt[1]));
          const offsets = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [6, 6], [-6, -6], [8, 0], [-8, 0]];
          for (let oi = 0; oi < offsets.length; oi++) {
            const tx = nxt[0] + offsets[oi][0];
            const tz = nxt[1] + offsets[oi][1];
            const checkCol = testVehCollision(tx, tz, aimYaw, tx, tz);
            if (!checkCol.hit) {
              veh.pose.cx = tx;
              veh.pose.cz = tz;
              veh.pose.yaw = aimYaw;
              veh.speed = 4.5;
              veh.velX = -Math.sin(aimYaw) * 4.5;
              veh.velZ = -Math.cos(aimYaw) * 4.5;
              this._applyVehicleTerrainPose(veh, vehicleKey, 0);
              if (isArmor && this.house.towContainer && this.house.towContainer.hitched) {
                this._updateTowedContainer(0);
              }
              route.cursor = nextIdx;
              route.stuckTimer = 0;
              route.stuckStage = 0;
              route.localPlanTimer = 0;
              route.lastCheckX = veh.pose.cx;
              route.lastCheckZ = veh.pose.cz;
              break;
            }
          }
        }
      }
    }

    return {
      moved: Math.abs(totalMoved) > 0.0001 || Math.abs(totalDYaw) > 0.00001,
      totalDYaw,
      blocked,
      blockedReason,
      cliffMacroSlope,
      grip,
      maxFwd,
      speedKmh: Math.round(Math.hypot(veh.velX, veh.velZ) * 3.6),
      autopilotActive,
    };
  }

  /**
   * Flagship Airship K-11 Flight Physics Engine (tecnica forces):
   *  - Exact 250.0 km/h (69.444 m/s) max speed in zero wind!
   *  - Live Storm Wind Resistance / Headwind Drag & Gentle Crosswind Drift
   *  - Exact 1L / 3.0 km (max 100.0 L = 300.0 km range) fuel consumption & auto-refuel in underground hangar
   *  - Seamless Silo-40 44-plate auto-launch when taking off or starting autopilot from -40m!
   *  - Breakthrough #3: Free-Point Map Autopilot flight & smooth landing/hover at destination!
   */
  _stepAirshipK11(dt, elapsed) {
    const k11 = this.house.airshipK11;
    const ne = this.house.nullErea;
    if (!k11) return { moved: false, totalDYaw: 0 };

    const isPiloted = this.drivingVehicle === 'k11';
    const route = this.autopilotRoutes.k11;
    const silo = ne ? ne.silo : null;

    // 1. Gather Pilot Manual Controls (WASD / Virtual Stick + Space/R Climb & Shift/F Descend + HUD Climb Buttons)
    let fwdIn = 0;
    let yawIn = 0;
    let altIn = 0;
    if (isPiloted && !this.mapOpen) {
      if (this.keys.has('w') || this.keys.has('arrowup')) fwdIn += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) fwdIn -= 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) yawIn += 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) yawIn -= 1;
      if (this.keys.has(' ') || this.keys.has('r') || this.keys.has('q')) altIn += 1;
      if (this.keys.has('shift') || this.keys.has('f')) altIn -= 1;
      if (Math.abs(this.virtualMove.z) > 0.06) fwdIn -= this.virtualMove.z;
      if (Math.abs(this.virtualMove.x) > 0.06) yawIn -= this.virtualMove.x;
      altIn += this.k11ClimbInput;
      fwdIn = Math.max(-1, Math.min(1, fwdIn));
      yawIn = Math.max(-1, Math.min(1, yawIn));
      altIn = Math.max(-1, Math.min(1, altIn));
    }

    // Manual override cancels K-11 autopilot cleanly
    if (route && isPiloted && (Math.abs(fwdIn) > 0.18 || Math.abs(yawIn) > 0.18 || Math.abs(altIn) > 0.18)) {
      this.cancelAutopilot('k11');
    }

    const prevX = k11.pose.cx;
    const prevY = k11.pose.y;
    const prevZ = k11.pose.cz;
    const prevYaw = k11.pose.yaw;

    // 2. Silo-40 Docked State Handling (Rides 40m Mega-Lift & Auto-Launches on Thrust/Autopilot!)
    if (k11.dockedInSilo && silo) {
      k11.pose.cx = NULL_EREA.originX;
      k11.pose.cz = NULL_EREA.originZ;
      k11.pose.y = silo.liftY;
      k11.velX = 0; k11.velY = 0; k11.velZ = 0; k11.speed = 0;
      k11.groundSpeedKmh = 0;
      k11.altitudeAGL = 0;
      k11.pitchAngle *= 0.85;
      k11.rollAngle *= 0.85;

      // Auto-refuel cleanly when fully stowed underground at -40m!
      if (silo.state === 'STORED_B40' && k11.fuelL < AIRSHIP_K11.maxFuelL) {
        k11.fuelL = Math.min(AIRSHIP_K11.maxFuelL, k11.fuelL + dt * 25.0);
      }

      const wantsLaunch = (isPiloted && (altIn > 0.2 || fwdIn > 0.25)) || Boolean(this.autopilotRoutes.k11);
      if (wantsLaunch) {
        if (k11.fuelL <= 0.05) {
          k11.fuelL = AIRSHIP_K11.maxFuelL; // Instant silo fuel top-up before launch!
        }
        if (!silo.isSurfaceReady()) {
          if (silo.state !== 'LAUNCH_OPENING') {
            this.toggleNullSilo(true);
          }
        } else {
          // Lift is flush at Surface GL 0m & all 44 roof plates open -> CLEARED FOR TAKEOFF!
          k11.dockedInSilo = false;
          k11.velY = 7.5;
          k11.pose.y += 0.35;
          this._notifyStatus('K-11 発進完了！無風最大 250 km/h', 'ok');
        }
      }

      k11.updateVisuals(dt, elapsed, {
        isPiloted,
        autopilotActive: Boolean(this.autopilotRoutes.k11),
        siloState: silo.state,
      });
      return {
        moved: Math.abs(k11.pose.y - prevY) > 0.0001,
        totalDYaw: 0,
      };
    }

    // 3. Free Flight & Aerial Autopilot Physics!
    const overSiloWell = Math.abs(k11.pose.cx - NULL_EREA.originX) < 12.0 && Math.abs(k11.pose.cz - NULL_EREA.originZ) < 23.0;
    const terrainSurfY = this.terreno ? this.terreno.getHeightAt(k11.pose.cx, k11.pose.cz) : 0;
    const surfY = (overSiloWell && silo && silo.isSurfaceReady()) ? silo.groundY : terrainSurfY;
    k11.altitudeAGL = Math.max(0, k11.pose.y - surfY);

    // Real-time Wind Vector (Zero wind in calm weather => exact 250.0 km/h max speed!)
    const stormInt = this.terreno && this.terreno.storm ? this.terreno.storm.getIntensity() : 0;
    let windX = 0;
    let windZ = 0;
    if (stormInt > 0.02 && this.terreno && this.terreno.storm) {
      const w = this.terreno.storm.getWind();
      windX = w.x * 1.15;
      windZ = w.z * 1.15;
    }
    k11.windSpeedKmh = Math.hypot(windX, windZ) * 3.6;

    const hasFuel = k11.fuelL > 0.001;
    let desiredVx = 0;
    let desiredVz = 0;
    let desiredVy = 0;
    let targetYawRate = 0;

    if (!hasFuel) {
      // Fuel Empty: Safe controlled emergency auto-glide descent (never crashes!)
      if (this.autopilotRoutes.k11) {
        this.autopilotRoutes.k11 = null;
        this._notifyStatus('燃料切れ (0.0L)：緊急緩降下着陸 — 車庫または自宅で給油してください', 'error');
      }
      desiredVx = k11.velX * 0.90;
      desiredVz = k11.velZ * 0.90;
      desiredVy = k11.altitudeAGL > 0.2 ? -4.5 : 0;
    } else if (this.autopilotRoutes.k11) {
      // Breakthrough #3: K-11 Autonomous Flight to Marked Map Destination!
      const rt = this.autopilotRoutes.k11;
      const dxG = rt.goalX - k11.pose.cx;
      const dzG = rt.goalZ - k11.pose.cz;
      const distG = Math.hypot(dxG, dzG);

      // If approaching NULL EREA Silo destination, open 44-plate roof & raise lift to receive K-11!
      const goingToNullSilo = Math.hypot(rt.goalX - NULL_EREA.originX, rt.goalZ - NULL_EREA.originZ) < 25.0;
      if (goingToNullSilo && distG < 900 && silo && !silo.isSurfaceReady() && silo.state !== 'LAUNCH_OPENING') {
        silo.startLaunchSequence();
      }

      if (distG < 10.0) {
        // Smooth terminal descent / hover at marked destination
        const rvDest = evalMainRiver(k11.pose.cz);
        const overWater = Math.abs(k11.pose.cx - rvDest.x) < rvDest.halfWidth * 1.1 && terrainSurfY < rvDest.waterY + 0.8;
        const targetLandingY = overWater ? (surfY + 18.0) : surfY;
        const dyDest = targetLandingY - k11.pose.y;
        desiredVx = dxG * 0.8;
        desiredVz = dzG * 0.8;
        desiredVy = Math.max(-9.0, Math.min(9.0, dyDest * 0.95));
        if (Math.abs(dyDest) < 0.45 && Math.hypot(k11.velX, k11.velZ) < 1.2) {
          this.autopilotRoutes.k11 = null;
          k11.velX = 0; k11.velY = 0; k11.velZ = 0;
          if (!overWater) k11.pose.y = targetLandingY;
          if (goingToNullSilo && silo && silo.isSurfaceReady()) {
            k11.dockedInSilo = true;
            k11.pose.cx = NULL_EREA.originX;
            k11.pose.cz = NULL_EREA.originZ;
            k11.pose.y = silo.liftY;
          }
          // Auto-refuel if arrived at Home Base or NULL EREA!
          const rf = this.isK11AtRefuelStation();
          if (rf.canRefuel && k11.fuelL < 99.9) {
            k11.fuelL = AIRSHIP_K11.maxFuelL;
            this.audio.playRefuelSound();
            this._notifyStatus(`K-11 到着＆自動給油完了 (${rf.stationName}：100.0L)`, 'ok');
          } else {
            this._notifyStatus('K-11 目的地に到着しました！', 'ok');
          }
          this._notifyDriveHUD();
        }
      } else {
        // High-speed 250 km/h cruise toward destination!
        const targetYaw = Math.atan2(-dxG, -dzG);
        let yawDiff = targetYaw - k11.pose.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        targetYawRate = Math.max(-1.05, Math.min(1.05, yawDiff * 1.9));

        const brakeDist = 420.0;
        const approachFactor = Math.min(1.0, Math.max(0.12, distG / brakeDist));
        const alignFactor = Math.max(0.25, Math.cos(Math.min(Math.PI * 0.5, Math.abs(yawDiff))));
        const targetCruiseSpeed = AIRSHIP_K11.maxSpeedMs * approachFactor * alignFactor; // Up to 69.444 m/s = 250 km/h!
        const dirX = dxG / distG;
        const dirZ = dzG / distG;
        desiredVx = dirX * targetCruiseSpeed;
        desiredVz = dirZ * targetCruiseSpeed;

        // Maintain safe high-altitude cruise clearance well above all terrain/trees, descending smoothly on final 350m
        const cruiseAlt = distG > 260 ? Math.max(surfY + 68.0, 95.0) : (surfY + Math.max(12.0, (distG / 260.0) * 68.0));
        desiredVy = Math.max(-12.0, Math.min(14.0, (cruiseAlt - k11.pose.y) * 0.65));
      }
    } else if (isPiloted) {
      // Manual Captain Flight Controls (Exact 250 km/h zero wind!)
      targetYawRate = yawIn * 0.92;
      const fx = -Math.sin(k11.pose.yaw);
      const fz = -Math.cos(k11.pose.yaw);
      const maxSpd = fwdIn >= 0 ? AIRSHIP_K11.maxSpeedMs : 22.0; // 69.444 m/s = 250.0 km/h forward!
      // Smooth takeoff lift assist if pressing forward on ground
      if (k11.altitudeAGL < 1.5 && fwdIn > 0.25 && altIn >= 0) {
        altIn = Math.max(altIn, 0.55);
      }
      desiredVx = fx * (fwdIn * maxSpd);
      desiredVz = fz * (fwdIn * maxSpd);
      desiredVy = altIn * 16.0;
    } else {
      // Hovering autonomously while player walks freely inside the 4.5×15×3.2m cabin!
      desiredVx = 0;
      desiredVz = 0;
      desiredVy = 0;
    }

    // Apply Aerodynamic Wind Resistance & Thrust Integration
    // In zero wind: thrust overcomes drag cleanly to exact 250.0 km/h (69.444 m/s).
    // With wind: headwind opposes groundspeed proportionally to aerodynamic wind drag!
    const windEffectVx = windX * 0.68;
    const windEffectVz = windZ * 0.68;
    const effectiveTargetVx = (hasFuel && (Math.abs(desiredVx) > 0.1 || Math.abs(desiredVz) > 0.1))
      ? desiredVx + windEffectVx
      : desiredVx + (k11.altitudeAGL > 2.0 ? windX * 0.12 : 0);
    const effectiveTargetVz = (hasFuel && (Math.abs(desiredVx) > 0.1 || Math.abs(desiredVz) > 0.1))
      ? desiredVz + windEffectVz
      : desiredVz + (k11.altitudeAGL > 2.0 ? windZ * 0.12 : 0);

    // Clamp max airspeed with aerodynamic drag envelope (never exceeds 250 km/h in zero wind!)
    const targetPlanar = Math.hypot(effectiveTargetVx, effectiveTargetVz);
    const windDotDir = targetPlanar > 0.1
      ? (windX * (effectiveTargetVx / targetPlanar) + windZ * (effectiveTargetVz / targetPlanar))
      : 0;
    // Headwind (windDotDir < 0) reduces max speed realistically; calm wind = EXACT 250.0 km/h!
    const aeroCapMs = Math.max(25.0, AIRSHIP_K11.maxSpeedMs + Math.min(0, windDotDir * 0.72) + Math.max(0, windDotDir * 0.22));
    let clampedTx = effectiveTargetVx;
    let clampedTz = effectiveTargetVz;
    if (targetPlanar > aeroCapMs) {
      const s = aeroCapMs / targetPlanar;
      clampedTx *= s;
      clampedTz *= s;
    }

    const horizAccel = Math.min(1, dt * 1.45);
    const vertAccel = Math.min(1, dt * 2.8);
    k11.velX += (clampedTx - k11.velX) * horizAccel;
    k11.velZ += (clampedTz - k11.velZ) * horizAccel;
    k11.velY += (desiredVy - k11.velY) * vertAccel;
    k11.yawRate += (targetYawRate - k11.yawRate) * Math.min(1, dt * 4.5);

    k11.pose.yaw += k11.yawRate * dt;
    k11.pose.cx = Math.max(TERRENO_WORLD.playMinX + 20, Math.min(TERRENO_WORLD.playMaxX - 20, k11.pose.cx + k11.velX * dt));
    k11.pose.cz = Math.max(TERRENO_WORLD.playMinZ + 20, Math.min(TERRENO_WORLD.playMaxZ - 20, k11.pose.cz + k11.velZ * dt));
    k11.pose.y = Math.max(surfY, Math.min(surfY + AIRSHIP_K11.maxAltitudeAGL, k11.pose.y + k11.velY * dt));

    // Smooth Touchdown & Silo-40 Re-Docking!
    if (k11.pose.y <= surfY + 0.05 && k11.velY <= 0) {
      k11.pose.y = surfY;
      k11.velY = 0;
      k11.velX *= 0.85;
      k11.velZ *= 0.85;
      if (overSiloWell && silo && silo.isSurfaceReady() && Math.hypot(k11.velX, k11.velZ) < 2.2) {
        k11.dockedInSilo = true;
        k11.pose.cx = NULL_EREA.originX;
        k11.pose.cz = NULL_EREA.originZ;
        k11.pose.y = silo.liftY;
      }
    }

    const nowAirborne = !k11.dockedInSilo && (k11.pose.y - surfY) > 1.35;
    if (nowAirborne && !this._prevK11Airborne) {
      this.audio.playK11Takeoff();
    } else if (!nowAirborne && this._prevK11Airborne) {
      this.audio.playK11Touchdown(Boolean(k11.dockedInSilo));
    }
    this._prevK11Airborne = nowAirborne;

    // Exact 1L = 3.000 km Fuel Consumption (Breakthrough #1!)
    const dxMoved = k11.pose.cx - prevX;
    const dyMoved = k11.pose.y - prevY;
    const dzMoved = k11.pose.cz - prevZ;
    const distMovedM = Math.hypot(dxMoved, dyMoved, dzMoved);
    if (distMovedM > 0.001) {
      k11.totalDistKm += distMovedM / 1000.0;
      k11.fuelL = Math.max(0.0, k11.fuelL - distMovedM / (AIRSHIP_K11.kmPerLiter * 1000.0));
    }

    const planarV = Math.hypot(k11.velX, k11.velZ);
    k11.speed = planarV;
    k11.groundSpeedKmh = planarV * 3.6;
    k11.altitudeAGL = Math.max(0, k11.pose.y - surfY);

    // Smooth Aerodynamic Banking Roll & Pitch Attitude
    const speedRatio = Math.min(1, planarV / AIRSHIP_K11.maxSpeedMs);
    const targetRoll = Math.max(-0.24, Math.min(0.24, k11.yawRate * 0.24 * (0.25 + speedRatio * 0.75)));
    const targetPitch = Math.max(-0.14, Math.min(0.14, k11.velY * 0.009 - speedRatio * 0.03));
    k11.rollAngle += (targetRoll - k11.rollAngle) * Math.min(1, dt * 3.8);
    k11.pitchAngle += (targetPitch - k11.pitchAngle) * Math.min(1, dt * 3.8);

    k11.updateVisuals(dt, elapsed, {
      isPiloted,
      autopilotActive: Boolean(this.autopilotRoutes.k11),
      siloState: silo ? silo.state : 'FREE FLIGHT',
    });

    return {
      moved: distMovedM > 0.0001 || Math.abs(k11.pose.yaw - prevYaw) > 0.00001,
      totalDYaw: k11.pose.yaw - prevYaw,
    };
  }

  _updateAllVehicles(dt, elapsed = 0) {
    if (this.bumpCooldown > 0) this.bumpCooldown -= dt;
    if (this.vehicleBlockedTimer > 0) this.vehicleBlockedTimer -= dt;

    // Record exact vehicle-local rider coordinates before stepping vehicle / airship physics!
    const riderKey = (!this.drivingVehicle && (this.activeBuilding === 'camper' || this.activeBuilding === 'armor' || this.activeBuilding === 'container' || this.activeBuilding === 'k11'))
      ? this.activeBuilding
      : null;
    let riderLocal = null;
    if (riderKey === 'camper') riderLocal = this.worldToCamperLocal(this.playerPos.x, this.playerPos.z);
    else if (riderKey === 'armor') riderLocal = this.worldToArmorLocal(this.playerPos.x, this.playerPos.z);
    else if (riderKey === 'container') riderLocal = this.worldToContainerLocal(this.playerPos.x, this.playerPos.z);
    else if (riderKey === 'k11') riderLocal = this.worldToK11Local(this.playerPos.x, this.playerPos.z);

    // Step Flagship Airship K-11!
    const k11Res = this._stepAirshipK11(dt, elapsed);

    const toStep = new Set();
    if (this.drivingVehicle && this.drivingVehicle !== 'k11') toStep.add(this.drivingVehicle);
    if (this.autopilotRoutes.camper || Math.abs(this.house.camper.speed || 0) > 0.02) toStep.add('camper');
    if (this.autopilotRoutes.armor || Math.abs(this.house.armorCamper.speed || 0) > 0.02) toStep.add('armor');

    let playerDriveResult = null;
    const stepResults = { k11: k11Res };
    for (const key of toStep) {
      const isDriven = this.drivingVehicle === key;
      const res = this._stepVehiclePhysics(key, dt, isDriven);
      stepResults[key] = res;
      if (isDriven) playerDriveResult = res;
    }

    // Apply exact rigid-body platform coupling to walking rider inside a moving camper, container, OR flying Airship K-11!
    if (riderKey && riderLocal) {
      const coupledDriverKey = riderKey === 'container'
        ? (this.house.towContainer?.hitched ? 'armor' : null)
        : riderKey;
      const res = coupledDriverKey ? stepResults[coupledDriverKey] : null;
      if (res && res.moved) {
        const w = riderKey === 'k11'
          ? this.k11LocalToWorld(riderLocal.lx, riderLocal.lz)
          : (riderKey === 'camper'
            ? this.camperLocalToWorld(riderLocal.lx, riderLocal.lz)
            : (riderKey === 'armor'
              ? this.armorLocalToWorld(riderLocal.lx, riderLocal.lz)
              : this.containerLocalToWorld(riderLocal.lx, riderLocal.lz)));
        this.playerPos.x = w.x;
        this.playerPos.z = w.z;
        this.yaw += res.totalDYaw;
        if (riderKey === 'k11') {
          this.floorY = this.house.airshipK11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
          if (!this.house.airshipK11.dockedInSilo || (this.house.nullErea && this.house.nullErea.silo.liftProgress > 0.5)) {
            this.currentFloor = 1;
          }
        } else {
          this.floorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
        }
      }
      const sampleVehAudio = (veh) => {
        const cx = veh.pose.cx, cz = veh.pose.cz;
        const bHit = this.terreno?.queryBridgeAt ? this.terreno.queryBridgeAt(cx, cz, 0.0) : null;
        const rq = this.terreno?.geomorph?.roadIndex ? this.terreno.geomorph.roadIndex.queryDist(cx, cz) : null;
        const onBridge = Boolean(bHit && bHit.onBridge);
        const onRoad = onBridge || (rq ? rq.dist < (rq.width || 8.0) * 0.65 : false);
        let waterDepth = 0;
        if (!onBridge && this.terreno) {
          const terrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(cx, cz) : this.terreno.getHeightAt(cx, cz);
          waterDepth = Math.max(0, evalMainRiver(cz).waterY - terrY);
        }
        if (bHit && bHit.nearJoint && Math.abs(veh.speed || 0) > 2.2 && (elapsed - this._prevBridgeJointTime) > 0.36) {
          this._prevBridgeJointTime = elapsed;
          this.audio.playBridgeJoint(Math.min(1, Math.abs(veh.speed || 0) / 22.0));
        }
        return { onBridge, onRoad, waterDepth, slipSpeed: Math.abs(veh.slipSpeed || 0) };
      };
      if (riderKey === 'k11') {
        const k11 = this.house.airshipK11;
        this.audio.updateAirshipEngine(
          !k11.dockedInSilo || Boolean(this.autopilotRoutes.k11),
          Math.min(1, (k11.groundSpeedKmh || 0) / 250.0),
          { climbRate: k11.velY || 0, altitudeAgl: k11.altitudeAGL || 0 },
        );
      } else if (coupledDriverKey && this.autopilotRoutes[coupledDriverKey]) {
        const rv = this._getVehicleObj(coupledDriverKey);
        this.audio.updateEngine(true, Math.abs(rv.speed || 0) / 16.0, coupledDriverKey === 'armor' ? 'armor' : 'diesel', sampleVehAudio(rv));
      }
    }

    // Update seated K-11 Captain Pose, Airship Audio & Flight HUD!
    if (this.drivingVehicle === 'k11') {
      const k11 = this.house.airshipK11;
      if (Math.abs(k11Res.totalDYaw) > 0.00001) this.yaw += k11Res.totalDYaw;
      const seatW = this.k11LocalToWorld(AIRSHIP_K11.pilotSeatLocal.x, AIRSHIP_K11.pilotSeatLocal.z);
      this.playerPos.set(seatW.x, 0, seatW.z);
      this.floorY = k11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
      this.currentFloor = (k11.dockedInSilo && this.house.nullErea && this.house.nullErea.silo.liftProgress < 0.5) ? -40 : 1;
      this.eyeHeight += (1.48 - this.eyeHeight) * Math.min(1, dt * 10);
      this.bobAmount *= 0.85;
      this.audio.updateAirshipEngine(true, Math.min(1, (k11.groundSpeedKmh || 0) / 250.0), {
        climbRate: k11.velY || 0,
        altitudeAgl: k11.altitudeAGL || 0,
      });
      // K-11 V4 Aviation Foley: variable-pitch prop feather, altitude pressurize & high-speed wind shear
      const k11Climb = Math.abs(k11.velY || 0);
      if (k11Climb > 3.2 && elapsed - (this._prevK11PropT || 0) > 2.4) {
        this._prevK11PropT = elapsed;
        if (this.audio.playK11PropFeather) this.audio.playK11PropFeather((k11.velY || 0) > 0);
      }
      if ((k11.altitudeAGL || 0) > 165 && !(this._k11Pressurized)) {
        this._k11Pressurized = true;
        if (this.audio.playK11CabinPressurize) this.audio.playK11CabinPressurize();
      } else if ((k11.altitudeAGL || 0) < 90) {
        this._k11Pressurized = false;
      }
      if ((k11.groundSpeedKmh || 0) > 165 && elapsed - (this._prevK11ShearT || 0) > 3.2) {
        this._prevK11ShearT = elapsed;
        if (this.audio.playK11WindShear) this.audio.playK11WindShear(Math.min(1, (k11.groundSpeedKmh || 0) / 240));
      }
      this._notifyDriveHUD();
    } else if (this.drivingVehicle && playerDriveResult) {
      const key = this.drivingVehicle;
      const veh = this._getVehicleObj(key);
      if (Math.abs(playerDriveResult.totalDYaw) > 0.00001) {
        this.yaw += playerDriveResult.totalDYaw;
      }
      const cx = veh.pose.cx, cz = veh.pose.cz;
      const bHit = this.terreno?.queryBridgeAt ? this.terreno.queryBridgeAt(cx, cz, 0.0) : null;
      const rq = this.terreno?.geomorph?.roadIndex ? this.terreno.geomorph.roadIndex.queryDist(cx, cz) : null;
      const onBridge = Boolean(bHit && bHit.onBridge);
      const onRoad = onBridge || (rq ? rq.dist < (rq.width || 8.0) * 0.65 : false);
      let waterDepth = 0;
      if (!onBridge && this.terreno) {
        const terrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(cx, cz) : this.terreno.getHeightAt(cx, cz);
        waterDepth = Math.max(0, evalMainRiver(cz).waterY - terrY);
      }
      if (bHit && bHit.nearJoint && Math.abs(veh.speed || 0) > 2.2 && (elapsed - this._prevBridgeJointTime) > 0.36) {
        this._prevBridgeJointTime = elapsed;
        this.audio.playBridgeJoint(Math.min(1, Math.abs(veh.speed || 0) / 22.0));
      }
      const surfOpts = { onBridge, onRoad, waterDepth, slipSpeed: Math.abs(veh.slipSpeed || 0) };
      const spdKmh = Math.abs(playerDriveResult.speedKmh || 0);
      const spdNorm = Math.min(1.1, Math.abs(veh.speed || 0) / Math.max(1, playerDriveResult.maxFwd || 16));
      const engProf = key === 'kei' ? 'kei' : (key === 'armor' ? 'armor' : 'diesel');

      // V4 Realistic Drivetrain & Road Foley: gear shifts, air brakes, wipers, gravel pings, water surge, turbo, blinker!
      const gearIdx = spdKmh < 18 ? 1 : (spdKmh < 38 ? 2 : (spdKmh < 64 ? 3 : 4));
      if (this._prevVehGear && gearIdx !== this._prevVehGear && elapsed - (this._prevGearShiftT || 0) > 0.95) {
        this._prevGearShiftT = elapsed;
        if (this.audio.playGearShift) this.audio.playGearShift(gearIdx > this._prevVehGear, engProf);
      }
      this._prevVehGear = gearIdx;

      const prevSpd = this._prevVehSpdKmh || 0;
      if ((key === 'armor' || key === 'camper') && prevSpd > 14 && spdKmh < 3.5 && elapsed - (this._prevAirBrakeT || 0) > 2.2) {
        this._prevAirBrakeT = elapsed;
        if (this.audio.playAirBrakeHiss) this.audio.playAirBrakeHiss(key === 'armor' ? 1.0 : 0.72);
      }
      this._prevVehSpdKmh = spdKmh;

      if (!onBridge && spdKmh > 14 && (!onRoad || (rq && rq.width < 9.0)) && elapsed - (this._prevGravelT || 0) > 0.85) {
        this._prevGravelT = elapsed;
        if (this.audio.playGravelUndercarriage) this.audio.playGravelUndercarriage(spdNorm);
      }
      if (waterDepth > 0.10 && spdKmh > 6 && elapsed - (this._prevFordT || 0) > 1.1) {
        this._prevFordT = elapsed;
        if (this.audio.playWaterFordSurge) this.audio.playWaterFordSurge(spdNorm, waterDepth);
      }
      if ((key === 'armor' || key === 'camper') && (playerDriveResult.cliffMacroSlope || 0) > 0.18 && spdKmh > 12 && elapsed - (this._prevTurboT || 0) > 3.6) {
        this._prevTurboT = elapsed;
        if (this.audio.playTurboSpool) this.audio.playTurboSpool(0.75);
      }
      const stormWet = this.terreno?.storm ? this.terreno.storm.getIntensity() : 0;
      if (stormWet > 0.22 && elapsed - (this._prevWiperT || 0) > Math.max(1.35, 2.8 - stormWet * 1.4)) {
        this._prevWiperT = elapsed;
        if (this.audio.playWiperSweep) this.audio.playWiperSweep(stormWet);
      }
      if (this.autopilotRoutes[key] && Math.abs(playerDriveResult.totalDYaw || 0) > 0.014 && elapsed - (this._prevBlinkerT || 0) > 0.42) {
        this._prevBlinkerT = elapsed;
        this._blinkerPhase = !this._blinkerPhase;
        if (this.audio.playTurnSignalClick) this.audio.playTurnSignalClick(this._blinkerPhase);
      }

      if (key === 'kei') {
        const seatW = this.keiLocalToWorld(KEI.driverSeatLocal.x, 0.68);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + KEI.floorWorldY;
        this.eyeHeight += (1.04 - this.eyeHeight) * Math.min(1, dt * 10);
        this.audio.updateEngine(true, Math.abs(veh.speed) / playerDriveResult.maxFwd, 'kei', surfOpts);
      } else if (key === 'armor') {
        const seatW = this.armorLocalToWorld(ARMOR_CAMPER.driverSeatLocal.x, 1.06);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + ARMOR_CAMPER.floorWorldY;
        this.eyeHeight += (1.54 - this.eyeHeight) * Math.min(1, dt * 10);
        this.audio.updateEngine(true, Math.abs(veh.speed) / playerDriveResult.maxFwd, 'armor', surfOpts);
      } else {
        const seatW = this.camperLocalToWorld(0.72, 0.68);
        this.playerPos.set(seatW.x, 0, seatW.z);
        this.floorY = (veh.pose.y || 0) + CAMPER.floor1WorldY;
        this.eyeHeight += (1.44 - this.eyeHeight) * Math.min(1, dt * 10);
        this.audio.updateEngine(true, Math.abs(veh.speed) / playerDriveResult.maxFwd, 'diesel', surfOpts);
      }
      this.bobAmount *= 0.85;

      if (this.callbacks.onDriveChange) {
        this.callbacks.onDriveChange(true, {
          vehicle: key,
          badge: key === 'kei' ? 'KEI-340 660cc' : (key === 'armor' ? 'ARMOR-155 8×8' : 'CAMPER-75 6×6'),
          speedKmh: playerDriveResult.speedKmh,
          headlightsOn: veh.headlightsOn,
          colliding: playerDriveResult.blocked || this.vehicleBlockedTimer > 0,
          cliffSlopeDeg: Math.round((Math.atan(playerDriveResult.cliffMacroSlope) * 180) / Math.PI),
          grip: Math.round(playerDriveResult.grip * 100) / 100,
          slipMs: Math.round(Math.abs(veh.slipSpeed) * 100) / 100,
          autopilotActive: Boolean(this.autopilotRoutes[key]),
          canAutopilot: key === 'camper' || key === 'armor',
          camMode: this.driveCamMode,
        });
      }
    }
  }

  setMapOpen(open) {
    this.mapOpen = open;
    if (open && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
  }

  _isPointInElevatorCab(x, z, floorIdx) {
    if (floorIdx > 1) return false;
    const C = ELEVATOR.cab;
    return x >= C.minX - 0.14 && x <= C.maxX + 0.08 && z >= C.minZ - 0.06 && z <= C.maxZ + 0.06;
  }

  _isPointInExtElevatorCab(x, z, floorIdx) {
    if (floorIdx !== 1 && floorIdx !== 7) return false;
    const C = EXT_ELEVATOR.cab;
    return x >= C.minX - 0.14 && x <= C.maxX + 0.14 && z >= C.minZ - 0.06 && z <= C.maxZ + 0.06;
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

  selectExtElevatorFloor(floor) {
    this.audio.init();
    if (this.house.extElevator) {
      this.house.extElevator.selectFloor(floor);
      this.audio.playElevatorButton();
    }
  }

  snapExtElevator(floor, open = true) {
    if (this.house.extElevator) {
      this.house.extElevator.snapToFloor(floor, open);
      if (this.inExtElevator) {
        this.currentFloor = floor;
        this.floorY = this.house.extElevator.cabY;
        this._updateCameraTransform(0);
      }
    }
  }

  setPose(x, z, yaw, pitch = -0.04, floorIdx = null) {
    if (floorIdx !== null && ((floorIdx >= -3 && floorIdx < FLOORS.length) || floorIdx === -40)) {
      this.currentFloor = floorIdx;
      this.activeFlight = null;
    }
    this.playerPos.set(x, 0, z);
    this.activeBuilding = this._getBuildingAt(x, z);
    this.inElevator = this._isPointInElevatorCab(x, z, this.currentFloor);
    this.inExtElevator = this._isPointInExtElevatorCab(x, z, this.currentFloor);
    this.inNullElevator = this._isPointInNullElevatorCab(x, z, this.currentFloor);
    const sa = NULL_EREA.siloAperture;
    this.onNullLift = (this.currentFloor === -40 || this.currentFloor === 1)
      && x >= sa.minX && x <= sa.maxX && z >= sa.minZ && z <= sa.maxZ
      && this.activeBuilding !== 'k11'
      && Boolean(this.house.nullErea && !this.house.nullErea.silo.isRoofSealed());
    if (this.adaptive) this.adaptive.snapFloorLights(this.currentFloor, this.activeBuilding, this.inElevator, x, z, this.inExtElevator);
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
        else if (d.kind === 'rollup') d.pivot.position.y = d.closedY + d.openLiftY;
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
      if (k === 'v' && this.drivingVehicle) { this.cycleDriveCameraMode(); return; }
      if (k === 'g' && (this.drivingVehicle === 'camper' || this.drivingVehicle === 'armor' || this.drivingVehicle === 'k11' || this.activeBuilding === 'camper' || this.activeBuilding === 'armor' || this.activeBuilding === 'k11')) {
        this.toggleVehicleAutopilot();
        return;
      }
      if (k === 'h') { this.toggleVehicleHeadlights(); return; }
      if (k === 'f' && this.drivingVehicle !== 'k11') {
        if (this.drivingVehicle) this.toggleVehicleHeadlights();
        else this.toggleFlashlight();
        return;
      }
      if (k === 'c' && !this.drivingVehicle) { this.toggleCrouch(); return; }
      if ((k === 'x' || k === ' ') && this.drivingVehicle && this.drivingVehicle !== 'k11') {
        this.audio.init();
        if (this.audio.playVehicleHorn) this.audio.playVehicleHorn(this.drivingVehicle);
        e.preventDefault();
        return;
      }
      if (k === 'e' || (k === ' ' && this.drivingVehicle !== 'k11')) { if (this.interact()) e.preventDefault(); return; }
      if (['w', 'a', 's', 'd', 'shift', ' ', 'r', 'q', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.audio.init();
        this.keys.add(k);
        if (k === ' ' && this.drivingVehicle === 'k11') e.preventDefault();
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

  _classifyDoorAudioKind(door) {
    if (!door) return 'wood_swing';
    const id = String(door.id || '');
    if (door.isGarageGate || door.kind === 'rollup') return 'garage_rollup';
    if (door.kind === 'liftgate') return 'liftgate';
    if (door.isK11 || id.startsWith('DK11')) return 'k11_airlock';
    if (id.startsWith('DAM') || id.startsWith('DCT')) return 'armor_airlock';
    if (id.startsWith('DC-') || id.startsWith('DK-')) return 'vehicle';
    if (id.startsWith('DB') || id.startsWith('DS-')) return 'airtight';
    if (id.includes('-B') || id === 'D4-6' || id === 'D5-5' || id === 'D6-5' || id === 'DV2-1') return 'glass';
    if (door.kind === 'pocket') return 'shoji';
    return 'wood_swing';
  }

  _isPointInNullElevatorCab(x, z, floorIdx) {
    if (floorIdx !== 1 && floorIdx !== -40) return false;
    const C = NULL_ELEVATOR.cab;
    return x >= C.minX - 0.05 && x <= C.maxX + 0.05 && z >= C.minZ - 0.05 && z <= C.maxZ + 0.05;
  }

  _raycastInteractable(ndc = this.centerNDC, includeDoors = false) {
    if (this.drivingVehicle) return null;
    this.camera.updateMatrixWorld();
    if (this.house.elevator && (this.inElevator || this.nearElevator)) {
      this.house.elevator.cabGroup.updateMatrixWorld(true);
    }
    if (this.house.extElevator && (this.inExtElevator || this.nearExtElevator)) {
      this.house.extElevator.cabGroup.updateMatrixWorld(true);
    }
    if (this.house.nullElevator && (this.inNullElevator || this.nearNullElevator)) {
      this.house.nullElevator.cabGroup.updateMatrixWorld(true);
    }
    if (this.house.airshipK11 && this.activeBuilding === 'k11') {
      this.house.airshipK11.root.updateMatrixWorld(true);
    }
    if (this.house.armorCamper && this.activeBuilding === 'armor') {
      this.house.armorCamper.root.updateMatrixWorld(true);
    }
    if (this.house.camper && this.activeBuilding === 'camper') {
      this.house.camper.root.updateMatrixWorld(true);
    }
    const targets = [
      ...this.house.interactiveProps
        .filter((p) => (
          (p.isElevatorBtn && (this.inElevator || this.nearElevator))
          || (p.isExtElevatorBtn && (this.inExtElevator || this.nearExtElevator))
          || (p.isExtElevatorCall && p.floor === this.currentFloor)
          || (p.isNullElevatorBtn && (this.inNullElevator || this.nearNullElevator))
          || (p.isNullElevatorCall && p.floor === this.currentFloor)
          || (p.isNullSiloBtn && (p.floor === this.currentFloor))
          || (p.isK11RefuelBtn && (p.floor === this.currentFloor))
          || (p.isK11Prop && this.activeBuilding === 'k11')
          || p.floor === this.currentFloor
        ))
        .map((p) => p.mesh),
      ...(includeDoors
        ? this.house.interactiveDoors.filter((d) => (d.isK11 && this.activeBuilding === 'k11') || Math.abs(d.floor - this.currentFloor) <= 1).map((d) => d.mesh)
        : []),
    ];
    this.raycaster.setFromCamera(ndc, this.camera);
    this.raycaster.far = 3.6;
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;
    const hit0 = hits[0];
    const obj = hit0.object;
    if (obj.userData.propId) {
      const prop = this.house.interactiveProps.find((p) => p.id === obj.userData.propId);
      if (prop) {
        let shortPrompt = prop.getLabel();
        if (prop.id === 'camper_drive' || prop.id === 'kei_drive' || prop.id === 'armor_drive') shortPrompt = '運転';
        else if (prop.id === 'k11_pilot') shortPrompt = 'K-11 操縦';
        else if (prop.isK11Prop || prop.isNullSiloBtn || prop.isK11RefuelBtn || prop.isNullElevatorBtn || prop.isNullElevatorCall) {
          shortPrompt = prop.getLabel();
        } else if (prop.id === 'armor_shutter') shortPrompt = prop.getLabel();
        else if (prop.id === 'armor_hitch' || prop.id === 'armor_hitch_cab') shortPrompt = prop.getLabel();
        else if (!prop.isElevatorBtn && !prop.isElevatorCall && !prop.isExtElevatorBtn && !prop.isExtElevatorCall) {
          shortPrompt = prop.isOn ? '消灯' : '点灯';
        }
        return { kind: 'prop', item: prop, prompt: shortPrompt };
      }
    }
    if (obj.userData.doorId) {
      if (hit0.distance > 1.55) return null;
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
      this.audio.playDoor(this._classifyDoorAudioKind(hit.item), hit.item.isOpen);
      this.adaptive.markShadowsDirty();
    } else if (hit.kind === 'prop') {
      const pid = hit.item.id || '';
      if (pid === 'camper_drive') {
        this.toggleVehicleDrive('camper');
      } else if (pid === 'kei_drive') {
        this.toggleVehicleDrive('kei');
      } else if (pid === 'armor_drive') {
        this.toggleVehicleDrive('armor');
      } else if (pid === 'k11_pilot') {
        this.toggleK11Pilot(true);
      } else if (pid === 'k11_btn_silo' || hit.item.isNullSiloBtn) {
        this.toggleNullSilo();
      } else if (pid === 'k11_btn_call_rv') {
        this.summonCamperToK11('camper');
      } else if (pid === 'k11_btn_call_armor') {
        this.summonCamperToK11('armor');
      } else if (hit.item.isK11RefuelBtn) {
        this.refuelK11();
      } else if (hit.item.isNullElevatorBtn && this.house.nullElevator) {
        if (hit.item.elvAction === 'open') this.house.nullElevator.openDoorsNow();
        else if (hit.item.elvAction === 'close') this.house.nullElevator.closeDoorsNow();
        else this.house.nullElevator.selectFloor(hit.item.targetFloor);
        this.audio.playElevatorButton();
      } else if (hit.item.isNullElevatorCall && this.house.nullElevator) {
        this.house.nullElevator.callToFloor(hit.item.callFloor);
        this.audio.playElevatorButton();
      } else if (pid === 'armor_shutter') {
        this.toggleArmorShutters();
      } else if (pid === 'armor_hitch' || pid === 'armor_hitch_cab') {
        this.toggleArmorHitch();
      } else if (hit.item.isExtElevatorBtn && this.house.extElevator) {
        if (hit.item.elvAction === 'open') this.house.extElevator.openDoorsNow();
        else if (hit.item.elvAction === 'close') this.house.extElevator.closeDoorsNow();
        else this.house.extElevator.selectFloor(hit.item.targetFloor);
        this.audio.playElevatorButton();
      } else if (hit.item.isExtElevatorCall && this.house.extElevator) {
        this.house.extElevator.callToFloor(hit.item.callFloor);
        this.audio.playElevatorButton();
      } else if (hit.item.isElevatorBtn || hit.item.isElevatorCall) {
        hit.item.toggle();
      } else {
        hit.item.toggle();
        if (pid === 'b309_main_loyly' || pid === 'b311_priv_loyly') {
          this.audio.playSaunaLoyly(pid === 'b311_priv_loyly');
        } else if (pid === 'b308_thermal_cmd') {
          this.audio.playThermalConsole(hit.item.isOn);
        } else if (pid === 'b310_desk_cooling') {
          this.audio.playCoolingPlenum(hit.item.isOn);
        } else if (pid === 'lab_uv_mode') {
          this.audio.playLabUvMode(hit.item.isOn);
        } else if (pid === 'lab_containment') {
          this.audio.playLabContainment(hit.item.isOn);
        } else if (pid === 'fireplace_6f') {
          this.audio.playFireplaceToggle(hit.item.isOn);
        } else if (pid.includes('lantern')) {
          this.audio.playClick(hit.item.isOn, 'washi_lantern');
        } else {
          this.audio.playClick(hit.item.isOn, 'lamp');
        }
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
    // Check Flagship Airship K-11 walkable 4.50×15.00×3.20m cabin FIRST (works at -40m, 0m, AND airborne!)
    if (this.house.airshipK11) {
      const k11 = this.house.airshipK11;
      const kl11 = this.worldToK11Local(x, z);
      const inK11Fp = kl11.lx >= 0.0 && kl11.lx <= AIRSHIP_K11.cabin.outerWidth && kl11.lz >= 0.0 && kl11.lz <= AIRSHIP_K11.cabin.outerLength;
      const k11FloorY = k11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
      if (inK11Fp && (this.activeBuilding === 'k11' || Math.abs(this.floorY - k11FloorY) < 2.2)) {
        return 'k11';
      }
    }
    if (this.currentFloor === -40) return 'null_hangar';
    if (this.currentFloor < 0) return 'main';
    if (this.activeFlight !== null) return this.activeStairBuilding;

    const cl = this.worldToCamperLocal(x, z);
    const inCamperFootprint = cl.lx >= 0.0 && cl.lx <= CAMPER.width && cl.lz >= 0.0 && cl.lz <= CAMPER.length;
    const kl = this.worldToKeiLocal(x, z);
    const inKeiFootprint = kl.lx >= 0.0 && kl.lx <= KEI.width && kl.lz >= 0.0 && kl.lz <= KEI.length;
    const al = this.worldToArmorLocal(x, z);
    const inArmorFootprint = al.lx >= 0.0 && al.lx <= ARMOR_CAMPER.width && al.lz >= 0.0 && al.lz <= ARMOR_CAMPER.length;
    const tl = this.worldToContainerLocal(x, z);
    const inContainerFootprint = tl.lx >= 0.0 && tl.lx <= TOW_CONTAINER.width && tl.lz >= 0.0 && tl.lz <= TOW_CONTAINER.length;

    if (this.currentFloor === 1) {
      if (inArmorFootprint) return 'armor';
      if (inContainerFootprint) return 'container';
      if (inKeiFootprint) return 'kei';
      if (inCamperFootprint) return 'camper';
      if (x >= GARAGE.originX && x <= GARAGE.originX + GARAGE.width && z >= GARAGE.originZ && z <= GARAGE.originZ + GARAGE.depth) {
        return 'garage';
      }
      if (x >= 0.0 && x <= 5.0 && z >= 0.0 && z <= 10.0) return 'main';
      if (x >= ANNEX.originX && x <= ANNEX.originX + ANNEX.width && z >= ANNEX.originZ && z <= ANNEX.originZ + ANNEX.depth) {
        return 'annex';
      }
      if (x >= STORAGE.originX && x <= STORAGE.originX + STORAGE.width && z >= STORAGE.originZ && z <= STORAGE.originZ + STORAGE.depth) {
        return 'storage';
      }
      const vh = queryVillageHouseAt(x, z);
      if (vh && !vh.onPorch) return 'village';
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
    if (this.drivingVehicle === 'k11') return 1.48;
    if (this.drivingVehicle === 'kei') return 1.04;
    if (this.drivingVehicle === 'camper') return 1.44;
    if (this.drivingVehicle === 'armor') return 1.54;
    if (this.inElevator || this.inExtElevator || this.inNullElevator) return this.crouching ? 1.04 : 1.54;
    if (this.activeBuilding === 'k11') return this.crouching ? 1.04 : 1.58;
    if (this.activeBuilding === 'null_hangar') return this.crouching ? 1.04 : 1.58;
    if (this.activeBuilding === 'kei' && this.currentFloor === 1) {
      return this.crouching ? 0.88 : 1.04;
    }
    if (this.activeBuilding === 'camper' && this.currentFloor === 2 && this.activeFlight === null) {
      return 0.76;
    }
    if (this.activeBuilding === 'camper' && this.currentFloor === 1 && !this.crouching) {
      return 1.54;
    }
    if (this.activeBuilding === 'armor' && !this.crouching) {
      return 1.56;
    }
    if (this.activeBuilding === 'container' && !this.crouching) {
      return 1.50;
    }

    let desiredEye = this.crouching ? 1.04 : 1.56;
    if (this.crouching) return desiredEye;

    if (this.currentFloor < 0) return desiredEye;

    if (this.activeBuilding === 'storage') {
      const sx = x - STORAGE.originX;
      const sz = z - STORAGE.originZ;
      if (sx >= -0.05 && sx <= STORAGE.width + 0.05 && sz >= -0.05 && sz <= STORAGE.depth + 0.05) {
        return 1.44;
      }
    }
    if (this.currentFloor === 0) {
      return 1.50;
    }
    // Main Tower Attic 6寸 gable ceiling ducking near eaves (full standing headroom inside ELV-EXT West Dormer!)
    if (this.currentFloor === HOUSE.atticFloor && this.activeFlight === null) {
      if (x <= 1.48 && z >= 0.35 && z <= 1.85) return desiredEye;
      const ceilClearance = getAtticCeilingY(x) - HOUSE.atticBaseY - 0.24;
      return Math.min(desiredEye, Math.max(0.95, ceilClearance));
    }
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
    if (this.inExtElevator && this.house.extElevator) {
      return this.house.extElevator.cabY;
    }
    if (this.inNullElevator && this.house.nullElevator) {
      return this.house.nullElevator.cabY;
    }
    if (this.house.airshipK11) {
      const k11 = this.house.airshipK11;
      const kl11 = this.worldToK11Local(x, z);
      const k11FloorY = k11.pose.y + AIRSHIP_K11.cabin.floorLocalY;
      const inK11 = kl11.lx >= 0.0 && kl11.lx <= AIRSHIP_K11.cabin.outerWidth && kl11.lz >= 0.0 && kl11.lz <= AIRSHIP_K11.cabin.outerLength;
      if (this.activeBuilding === 'k11' && inK11) {
        return k11FloorY;
      }
      if (Math.abs(this.floorY - k11.pose.y) < 2.2 || Math.abs(this.floorY - k11FloorY) < 2.2) {
        if (inK11) return k11FloorY;
        // Smooth West Hatch boarding step (DK11-W: lx -0.85..0.0, lz 12.8..14.4)
        if (kl11.lx >= -0.85 && kl11.lx < 0.0 && kl11.lz >= 12.8 && kl11.lz <= 14.4) {
          const t = Math.max(0, Math.min(1, (kl11.lx + 0.85) / 0.85));
          return k11.pose.y + AIRSHIP_K11.cabin.floorLocalY * t;
        }
        // Smooth Rear Deployable Airstair Ramp (DK11-R: lz 15.6..17.2, lx 1.6..3.2)
        if (kl11.lz > AIRSHIP_K11.cabin.outerLength && kl11.lz <= AIRSHIP_K11.cabin.outerLength + 1.65 && kl11.lx >= 1.60 && kl11.lx <= 3.20) {
          const t = Math.max(0, Math.min(1, (AIRSHIP_K11.cabin.outerLength + 1.65 - kl11.lz) / 1.65));
          return k11.pose.y + AIRSHIP_K11.cabin.floorLocalY * t;
        }
      }
    }
    if (this.onNullLift && this.house.nullErea) {
      return this.house.nullErea.silo.liftY;
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

    if (this.currentFloor === -40 && this.house.nullErea) {
      return this.house.nullErea.b40Y;
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
    const al = this.worldToArmorLocal(x, z);
    const inArmor = al.lx >= 0.0 && al.lx <= ARMOR_CAMPER.width && al.lz >= 0.0 && al.lz <= ARMOR_CAMPER.length;
    const tl = this.worldToContainerLocal(x, z);
    const inCont = tl.lx >= 0.0 && tl.lx <= TOW_CONTAINER.width && tl.lz >= 0.0 && tl.lz <= TOW_CONTAINER.length;

    const camperBaseY = this.house.camper.pose.y || 0;
    const keiBaseY = this.house.kei.pose.y || 0;
    const armorBaseY = this.house.armorCamper.pose.y || 0;
    const contBaseY = this.house.towContainer.pose.y || 0;

    const baseY = getFloorByPhysicalIndex(this.currentFloor).baseY;
    if (this.currentFloor === 1) {
      if (inArmor) return armorBaseY + ARMOR_CAMPER.floorWorldY;
      // Smooth steel boarding steps up into ARMOR-155 side airlock DAM-1 & rear hatch DAM-R!
      if (al.lx >= -0.62 && al.lx < 0.0 && al.lz >= 13.75 && al.lz <= 15.05) {
        const t = Math.max(0, Math.min(1, (al.lx + 0.62) / 0.62));
        return armorBaseY - 0.32 + (ARMOR_CAMPER.floorWorldY + 0.32) * t;
      }
      if (al.lz > ARMOR_CAMPER.length && al.lz <= ARMOR_CAMPER.length + 0.60 && al.lx >= 0.90 && al.lx <= 2.20) {
        const t = Math.max(0, Math.min(1, (ARMOR_CAMPER.length + 0.60 - al.lz) / 0.60));
        return armorBaseY - 0.32 + (ARMOR_CAMPER.floorWorldY + 0.32) * t;
      }
      if (inCont) return contBaseY + TOW_CONTAINER.floorWorldY;
      if (tl.lz > TOW_CONTAINER.length && tl.lz <= TOW_CONTAINER.length + 0.55 && tl.lx >= 0.25 && tl.lx <= 1.75) {
        const t = Math.max(0, Math.min(1, (TOW_CONTAINER.length + 0.55 - tl.lz) / 0.55));
        return contBaseY - 0.32 + (TOW_CONTAINER.floorWorldY + 0.32) * t;
      }
      if (inKei) return keiBaseY + KEI.floorWorldY;
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
      // Smooth granite landing step leading into Exterior Attic Elevator (ELV-EXT) West door!
      if (x >= -2.30 && x <= -1.42 && z >= 0.45 && z <= 1.75) {
        const t = Math.max(0, Math.min(1, (x + 2.30) / 0.88));
        return -0.18 + 0.18 * t;
      }
      // NULL EREA Surface Titanium Launch Apron & Raised Silo Deck
      if (this.house.nullErea) {
        const ap = NULL_EREA.apron;
        if (x >= ap.minX && x <= ap.maxX && z >= ap.minZ && z <= ap.maxZ) {
          return this.house.nullErea.groundY + 0.03;
        }
      }
      // Giant 10×20m Steel Vehicle Warehouse (GARAGE-200) level epoxy floor
      if (x >= GARAGE.originX && x <= GARAGE.originX + GARAGE.width && z >= GARAGE.originZ && z <= GARAGE.originZ + GARAGE.depth) {
        return GARAGE.floorY;
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
      const vh = queryVillageHouseAt(x, z);
      if (vh) return vh.floorY;
      if (this.terreno) {
        const groundY = this.terreno.getHeightAt(x, z);
        if (isInsideVillagePaving(x, z)) {
          return groundY + 0.05;
        }
        const dComp = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
        // Smooth level transition around expanded garage apron too!
        const nearGarage = x >= 9.5 && x <= 24.5 && z >= -15.5 && z <= 19.5;
        if (nearGarage) return GARAGE.floorY;
        // Exact -0.18m courtyard height right at NARROW-50, smoothly settling onto boots-on-ground across 15km×40km!
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
      if (x > 3.55 && z > 3.50 && z < 5.95) return baseY - 0.02;
      if (x < 0.05 && z >= 6.15 && z <= 8.85) return baseY - 0.04;
      return baseY;
    }
    if (this.currentFloor === 6) {
      if (z > 9.95) return baseY - 0.04;
      return baseY;
    }
    return baseY;
  }

  _getSurfaceMaterial(x, z) {
    if (this.inElevator || this.inExtElevator || this.inNullElevator || this.onNullLift) return 'metal';
    if (this.activeBuilding === 'k11') return 'wood';
    if (this.currentFloor === -40 || this.activeBuilding === 'null_hangar') return 'metal';
    if (this.activeFlight !== null) {
      if (this.activeFlight === 'st_b2' || this.activeFlight === 'st_b3') return 'tile';
      if (this.activeStairBuilding === 'storage') return 'metal';
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
      if (x > 3.25 || z < 3.60 || z > 16.15 || (x > 1.70 && z >= 8.55 && z <= 12.15)) return 'wet_stone';
      return 'wood';
    }
    if (this.activeBuilding === 'garage') return 'tile';
    if (this.activeBuilding === 'container') return 'wood';
    if (this.activeBuilding === 'armor') {
      const al = this.worldToArmorLocal(x, z);
      return al.lz > 13.45 ? 'metal' : 'wood';
    }
    if (this.activeBuilding === 'kei') return 'metal';
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
        return 'metal';
      }
      const vh = queryVillageHouseAt(x, z);
      if (vh) return vh.surface;
      if (isInVillagePrecinct(x, z) && isInsideVillagePaving(x, z)) return 'tile';
      // Outdoors in TERRENO wilderness: distinguish ALL 11 outdoor surfaces (Bridges, Water, Alpine Snow,
      // Asphalt, Gravel, River Sand, Mud, Autumn Leaves, Mossy Cedar Floor, Grass & Earth)!
      if (this.terreno) {
        const bHit = this.terreno.queryBridgeAt ? this.terreno.queryBridgeAt(x, z, 0.0) : null;
        if (bHit && bHit.onBridge) return 'bridge';
        const terrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(x, z) : this.terreno.getHeightAt(x, z);
        const asl = TERRENO_WORLD.baseElevationASL + terrY;
        const rv = evalMainRiver(z);
        const distRiv = Math.abs(x - rv.x);
        if (distRiv < rv.halfWidth * 1.15 && rv.waterY - terrY > 0.04) return 'water';
        const trib = evalClosestTributary(x, z);
        if (trib && trib.dist < trib.width * 0.45) return 'water';
        if (asl > 960) return 'snow';
        const rq = this.terreno.geomorph?.roadIndex ? this.terreno.geomorph.roadIndex.queryDist(x, z) : null;
        if (rq && rq.dist < (rq.width || 8.0) * 0.56) {
          return (rq.width || 8.0) >= 9.0 ? 'asphalt' : 'gravel';
        }
        const stormWet = this.terreno.storm ? this.terreno.storm.getIntensity() : 0;
        if (distRiv < rv.halfWidth * 1.38 + 3.0) {
          return stormWet > 0.25 ? 'mud' : 'sand';
        }
        const rw = evalRegionWeights(x, z);
        if (rw.wetland > 0.42 || (stormWet > 0.35 && rw.valley > 0.45)) return 'mud';
        if (rw.meadow > 0.34 || Math.hypot(x - 1.5, z - 3.5) < 28.0) return 'grass';
        if (rw.hills > 0.32 || rw.plateau > 0.34) return 'leaves';
        if (rw.valley > 0.42) return 'moss';
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
      if (x < 0.05) return 'wood';
      if (x < 2.20 && z < 6.00) return 'tile';
      if (x > 3.55 && z > 3.50 && z < 5.95) return 'tile';
      if (x > 2.55 && z > 6.00) return 'tile';
      return 'wood';
    }
    if (this.currentFloor === 6) {
      if (x > 2.50 && x < 4.60 && z > 0.40 && z < 3.20) return 'tatami';
      if (x > 2.20 && z > 3.50 && z < 5.95) return 'tile';
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

  _collidesInArmorLocal(lx, lz) {
    const r = this.playerRadius;
    const r2 = r * r;
    const cols = this.house.armorCamper.localColliders || [];
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
      const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
      if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
    }
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.isArmor && d.progress < 0.55) {
        const b = d.collider;
        const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
        const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
        if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
      }
    }
    return false;
  }

  _collidesInContainerLocal(lx, lz) {
    const r = this.playerRadius;
    const r2 = r * r;
    const cols = this.house.towContainer.localColliders || [];
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
      const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
      if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
    }
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.isContainer && d.progress < 0.55) {
        const b = d.collider;
        const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
        const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
        if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
      }
    }
    return false;
  }

  _collidesInK11Local(lx, lz) {
    const k11 = this.house.airshipK11;
    if (!k11) return false;
    const r = this.playerRadius;
    const r2 = r * r;
    const cols = k11.localColliders || [];
    for (let i = 0; i < cols.length; i++) {
      const b = cols[i];
      const cx = lx < b.minX ? b.minX : (lx > b.maxX ? b.maxX : lx);
      const cz = lz < b.minZ ? b.minZ : (lz > b.maxZ ? b.maxZ : lz);
      if ((lx - cx) * (lx - cx) + (lz - cz) * (lz - cz) < r2) return true;
    }
    const airborneSeal = !k11.dockedInSilo && k11.altitudeAGL > 2.2;
    const doors = this.house.interactiveDoors;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.isK11 && (d.progress < 0.55 || (airborneSeal && d.isExteriorAirlock))) {
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

    // Airborne / Riding Inside Airship K-11: strictly keep player safely inside 4.50×15.00×3.20m cabin!
    if (this.activeBuilding === 'k11' && this.house.airshipK11) {
      const k11 = this.house.airshipK11;
      const airborneSeal = !k11.dockedInSilo && k11.altitudeAGL > 2.2;
      const kl11 = this.worldToK11Local(x, z);
      if (airborneSeal) {
        if (kl11.lx < AIRSHIP_K11.cabin.minX + r || kl11.lx > AIRSHIP_K11.cabin.maxX - r || kl11.lz < AIRSHIP_K11.cabin.minZ + r || kl11.lz > AIRSHIP_K11.cabin.maxZ - r) {
          return true;
        }
        return this._collidesInK11Local(kl11.lx, kl11.lz);
      }
    }

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
    if (this.currentFloor <= 1 && this.currentFloor > -40 && this.house.elevator) {
      const elv = this.house.elevator;
      const elvMoving = elv.phase === 'RUNNING' || elv.phase === 'RELEVELING' || elv.phase === 'BRAKE_RELEASE';
      const doorPassable = elv.currentStopFloor === this.currentFloor && !elvMoving && elv.doorProgress > 0.62;
      if (!doorPassable) {
        const bx1 = 3.16; const bx2 = 3.36; const bz1 = 1.24; const bz2 = 2.26;
        const cx = x < bx1 ? bx1 : (x > bx2 ? bx2 : x);
        const cz = z < bz1 ? bz1 : (z > bz2 ? bz2 : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) {
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

    // Dynamic Safety Door Interlock for Exterior Attic Express Elevator (ELV-EXT: 1F West <-> RF East!)
    if ((this.currentFloor === 1 || this.currentFloor === 7) && this.house.extElevator) {
      const ext = this.house.extElevator;
      const extDoorPassable = ext.currentStopFloor === this.currentFloor && ext.phase !== 'RUNNING' && ext.doorProgress > 0.60;
      const C = EXT_ELEVATOR.cab;
      if (!extDoorPassable) {
        const bx1 = this.currentFloor === 1 ? -1.58 : -0.14;
        const bx2 = this.currentFloor === 1 ? -1.40 : 0.06;
        const bz1 = 0.62; const bz2 = 1.58;
        const cx = x < bx1 ? bx1 : (x > bx2 ? bx2 : x);
        const cz = z < bz1 ? bz1 : (z > bz2 ? bz2 : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
      }
      if (this.inExtElevator) {
        if (z < C.minZ + r || z > C.maxZ - r) return true;
        const inDoorZ = z >= 0.65 + r * 0.5 && z <= 1.55 - r * 0.5;
        if (this.currentFloor === 1) {
          if (x > C.maxX - r) return true;
          if (x < C.minX + r && (!extDoorPassable || !inDoorZ)) return true;
        } else {
          if (x < C.minX + r) return true;
          if (x > C.maxX - r && (!extDoorPassable || !inDoorZ)) return true;
        }
      }
    }

    // Dynamic Safety Door Interlock for NULL EREA 40m High-Speed Elevator (ELV-NULL: GL 0m <-> B40F -40m!)
    if ((this.currentFloor === 1 || this.currentFloor === -40) && this.house.nullElevator) {
      const ne = this.house.nullElevator;
      const neDoorPassable = ne.currentStopFloor === this.currentFloor && ne.phase !== 'RUNNING' && ne.doorProgress > 0.60;
      const C = NULL_ELEVATOR.cab;
      const D = NULL_ELEVATOR.door;
      if (!neDoorPassable) {
        const bx1 = D.x - 0.14; const bx2 = D.x + 0.16;
        const cx = x < bx1 ? bx1 : (x > bx2 ? bx2 : x);
        const cz = z < D.minZ ? D.minZ : (z > D.maxZ ? D.maxZ : z);
        if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r2) return true;
      }
      if (this.inNullElevator) {
        if (x < C.minX + r || z < C.minZ + r || z > C.maxZ - r) return true;
        const inDoorZ = z >= D.minZ + r * 0.5 && z <= D.maxZ - r * 0.5;
        if (x > C.maxX - r && (!neDoorPassable || !inDoorZ)) return true;
      }
    }

    if (this.currentFloor === -40) {
      if (x < -26.2 || x > 23.5 - r || z < 29883.0 + r || z > 29937.0 - r) return true;
      const silo = this.house.nullErea ? this.house.nullErea.silo : null;
      const sa = NULL_EREA.siloAperture;
      // When lift has left -40m, keep players standing on the hangar gallery safely behind the yellow pit railings!
      if (silo && silo.liftProgress > 0.06 && !this.onNullLift && this.activeBuilding !== 'k11') {
        if (x > sa.minX - 0.45 && x < sa.maxX + 0.45 && z > sa.minZ - 0.35 && z < sa.maxZ + 0.35) {
          return true;
        }
      }
      // If riding ON the Mega-Lift while ascending/descending, keep safely on lift platform!
      if (this.onNullLift && silo && silo.liftProgress > 0.06 && silo.liftProgress < 0.94 && this.activeBuilding !== 'k11') {
        if (x < sa.minX + 0.65 || x > sa.maxX - 0.65 || z < sa.minZ + 0.85 || z > sa.maxZ - 0.85) return true;
      }
      // Airship K-11 local cabin collision when docked at -40m!
      if (this.house.airshipK11 && this.house.airshipK11.dockedInSilo) {
        const kl11 = this.worldToK11Local(x, z);
        if (kl11.lx >= -r - 0.15 && kl11.lx <= AIRSHIP_K11.cabin.outerWidth + r + 0.15 && kl11.lz >= -r - 0.15 && kl11.lz <= AIRSHIP_K11.cabin.outerLength + r + 0.15) {
          if (this._collidesInK11Local(kl11.lx, kl11.lz)) return true;
        }
      }
    } else if (this.currentFloor === -3) {
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
      // NULL EREA Surface Open 40m Silo Pit Safety Guard (passable when 44-plate roof sealed OR Mega-Lift flush at 0m!)
      if (this.house.nullErea) {
        const silo = this.house.nullErea.silo;
        const sa = NULL_EREA.siloAperture;
        if (!silo.isRoofSealed() && !silo.isSurfaceReady() && !this.onNullLift && this.activeBuilding !== 'k11') {
          if (x > sa.minX - 0.35 && x < sa.maxX + 0.35 && z > sa.minZ - 0.35 && z < sa.maxZ + 0.35) {
            return true;
          }
        }
      }
      // Airship K-11 local cabin collision when landed on surface / raised lift!
      if (this.house.airshipK11 && this.house.airshipK11.altitudeAGL < 2.2) {
        const k11 = this.house.airshipK11;
        if (!k11.dockedInSilo || (this.house.nullErea && this.house.nullErea.silo.isSurfaceReady())) {
          const kl11 = this.worldToK11Local(x, z);
          if (kl11.lx >= -r - 0.15 && kl11.lx <= AIRSHIP_K11.cabin.outerWidth + r + 0.15 && kl11.lz >= -r - 0.15 && kl11.lz <= AIRSHIP_K11.cabin.outerLength + r + 0.15) {
            if (this._collidesInK11Local(kl11.lx, kl11.lz)) return true;
          }
        }
      }
      // Strict Movable Giant Camper 1F collision
      const cl = this.worldToCamperLocal(x, z);
      if (cl.lx >= -r - 0.16 && cl.lx <= CAMPER.width + r + 0.16 && cl.lz >= -r - 0.18 && cl.lz <= CAMPER.length + r + 0.18) {
        if (this._collidesInCamperLocal(cl.lx, cl.lz, 1)) return true;
      }
      // Strict Movable Daily-Driver Kei-Van collision
      const kl = this.worldToKeiLocal(x, z);
      if (kl.lx >= -r - 0.12 && kl.lx <= KEI.width + r + 0.12 && kl.lz >= -r - 0.12 && kl.lz <= KEI.length + r + 0.12) {
        if (this._collidesInKeiLocal(kl.lx, kl.lz)) return true;
      }
      // Strict Movable Armored Camper (ARMOR-155) collision
      const al = this.worldToArmorLocal(x, z);
      if (al.lx >= -r - 0.16 && al.lx <= ARMOR_CAMPER.width + r + 0.16 && al.lz >= -r - 0.18 && al.lz <= ARMOR_CAMPER.length + r + 0.18) {
        if (this._collidesInArmorLocal(al.lx, al.lz)) return true;
      }
      // Strict Movable Towable Container (CON-24) collision
      const tl = this.worldToContainerLocal(x, z);
      if (tl.lx >= -r - 0.14 && tl.lx <= TOW_CONTAINER.width + r + 0.14 && tl.lz >= -r - 0.14 && tl.lz <= TOW_CONTAINER.length + r + 0.14) {
        if (this._collidesInContainerLocal(tl.lx, tl.lz)) return true;
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
      // RF Attic (floor 7): allow passing straight into ELV-EXT West Dormer Cab (X = -1.43..0.15, Z = 0.47..1.73)!
      const C = EXT_ELEVATOR.cab;
      const inAtticInt = x >= 0.15 + r && x <= 4.85 - r && z >= 0.15 + r && z <= 9.85 - r;
      const inExtCabZone = x >= C.minX + r && x <= 0.40 && z >= C.minZ + r && z <= C.maxZ - r;
      if (!inAtticInt && !inExtCabZone) return true;
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
      if (!d.isCamper && !d.isKei && !d.isArmor && !d.isContainer && !d.isK11 && d.floor === this.currentFloor && d.progress < 0.55) {
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
          const dx = x - t.x;
          const dz = z - t.z;
          const broadR = r + (t.r || 0.5) + 2.2;
          if (dx * dx + dz * dz > broadR * broadR) continue;

          let hit = false;
          if (t.kind === 'log' && t.ax !== undefined) {
            // Exact point-to-segment distance for full-length fallen nurse log capsule!
            const vx = t.bx - t.ax;
            const vz = t.bz - t.az;
            const lenSq = vx * vx + vz * vz;
            const proj = lenSq > 1e-6 ? Math.max(0, Math.min(1, ((x - t.ax) * vx + (z - t.az) * vz) / lenSq)) : 0;
            const px = t.ax + vx * proj;
            const pz = t.az + vz * proj;
            const md = r + (t.r || 0.24);
            hit = (x - px) * (x - px) + (z - pz) * (z - pz) < md * md;
          } else if (t.rx && t.rz && t.yaw !== undefined) {
            // Exact oriented ellipse collision for natural faceted granite boulders!
            const bc = Math.cos(t.yaw);
            const bs = Math.sin(t.yaw);
            const ex = dx * bc + dz * bs;
            const ez = -dx * bs + dz * bc;
            const erx = t.rx + r;
            const erz = t.rz + r;
            hit = (ex * ex) / (erx * erx) + (ez * ez) / (erz * erz) < 1.0;
          } else {
            const md = r + t.r;
            hit = dx * dx + dz * dz < md * md;
          }

          if (hit) {
            if ((t.kind === 'boulder' || t.kind === 'log') && t.height !== undefined && t.height <= 0.72) {
              this._lastStepOverH = Math.max(this._lastStepOverH || 0, t.height);
              continue;
            }
            if (t.kind === 'shrub' && t.height !== undefined && t.height <= 0.45) {
              this._lastStepOverH = Math.max(this._lastStepOverH || 0, t.height * 0.5);
              continue;
            }
            return true;
          }
        }
        const dComp = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
        if (dComp > 22.0) {
          const bHit = this.terreno.queryBridgeAt ? this.terreno.queryBridgeAt(x, z, 0.15) : null;
          if (bHit && bHit.hitGuardrail) return true;
          if (!(bHit && bHit.onBridge)) {
            const flood = this.terreno.storm ? this.terreno.storm.getFloodInfoAt(x, z) : null;
            const terrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(x, z) : this.terreno.getHeightAt(x, z);
            const nextDepth = flood ? flood.depth : Math.max(0, evalMainRiver(z).waterY - terrY);
            if (nextDepth > 1.15) {
              const curFlood = this.terreno.storm ? this.terreno.storm.getFloodInfoAt(this.playerPos.x, this.playerPos.z) : null;
              const curTerrY = this.terreno.getTerrainHeightAt ? this.terreno.getTerrainHeightAt(this.playerPos.x, this.playerPos.z) : this.terreno.getHeightAt(this.playerPos.x, this.playerPos.z);
              const curDepth = curFlood ? curFlood.depth : Math.max(0, evalMainRiver(this.playerPos.z).waterY - curTerrY);
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

  _updateMovement(dt, elapsed = 0) {
    this._updateAllVehicles(dt, elapsed);
    if (this.mapOpen) return;
    if (this.drivingVehicle) return;

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

    if (
      this.activeBuilding === 'camper' || this.activeBuilding === 'kei' ||
      this.activeBuilding === 'armor' || this.activeBuilding === 'container' ||
      this.activeBuilding === 'k11'
    ) {
      const bld = this.activeBuilding;
      const pose = bld === 'k11'
        ? this.house.airshipK11.pose
        : (bld === 'kei'
          ? this.house.kei.pose
          : (bld === 'armor'
            ? this.house.armorCamper.pose
            : (bld === 'container' ? this.house.towContainer.pose : this.house.camper.pose)));
      const toLocal = (wx, wz) => (bld === 'k11'
        ? this.worldToK11Local(wx, wz)
        : (bld === 'kei'
          ? this.worldToKeiLocal(wx, wz)
          : (bld === 'armor'
            ? this.worldToArmorLocal(wx, wz)
            : (bld === 'container' ? this.worldToContainerLocal(wx, wz) : this.worldToCamperLocal(wx, wz)))));
      const toWorld = (lx, lz) => (bld === 'k11'
        ? this.k11LocalToWorld(lx, lz)
        : (bld === 'kei'
          ? this.keiLocalToWorld(lx, lz)
          : (bld === 'armor'
            ? this.armorLocalToWorld(lx, lz)
            : (bld === 'container' ? this.containerLocalToWorld(lx, lz) : this.camperLocalToWorld(lx, lz)))));
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

    // Update Interior Elevator (ELV-1) Presence & Proximity
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

    // Update Exterior Attic Express Elevator (ELV-EXT) Presence & Proximity
    const extElv = this.house.extElevator;
    if (extElv && (this.currentFloor === 1 || this.currentFloor === 7)) {
      const inExtFootprint = this._isPointInExtElevatorCab(this.playerPos.x, this.playerPos.z, this.currentFloor);
      if (inExtFootprint && (this.inExtElevator || Math.abs(this.floorY - extElv.cabY) < 1.35)) {
        this.inExtElevator = true;
      } else if (!inExtFootprint) {
        this.inExtElevator = false;
      }
      this.nearExtElevator = !this.inExtElevator
        && this.playerPos.x >= -3.10 && this.playerPos.x <= 1.20
        && this.playerPos.z >= -0.20 && this.playerPos.z <= 2.60;
    } else {
      this.inExtElevator = false;
      this.nearExtElevator = false;
    }

    // Update NULL EREA 40m High-Speed Elevator (ELV-NULL) Presence & Proximity
    const nullElv = this.house.nullElevator;
    if (nullElv && (this.currentFloor === 1 || this.currentFloor === -40)) {
      const inNullFootprint = this._isPointInNullElevatorCab(this.playerPos.x, this.playerPos.z, this.currentFloor);
      if (inNullFootprint && (this.inNullElevator || Math.abs(this.floorY - nullElv.cabY) < 1.65)) {
        this.inNullElevator = true;
      } else if (!inNullFootprint) {
        this.inNullElevator = false;
      }
      this.nearNullElevator = !this.inNullElevator
        && Math.hypot(this.playerPos.x - NULL_ELEVATOR.shaft.cx, this.playerPos.z - NULL_ELEVATOR.shaft.cz) < 6.0;
    } else {
      this.inNullElevator = false;
      this.nearNullElevator = false;
    }

    // Update SILO-40 40m Giant Mega-Lift Riding Presence!
    const silo = this.house.nullErea ? this.house.nullErea.silo : null;
    const sa = NULL_EREA.siloAperture;
    if (silo && (this.currentFloor === -40 || this.currentFloor === 1) && this.activeBuilding !== 'k11' && !this.inNullElevator) {
      const inAperture = this.playerPos.x >= sa.minX + 0.15 && this.playerPos.x <= sa.maxX - 0.15
        && this.playerPos.z >= sa.minZ + 0.15 && this.playerPos.z <= sa.maxZ - 0.15;
      if (inAperture && (this.onNullLift || Math.abs(this.floorY - silo.liftY) < 1.6)) {
        this.onNullLift = true;
      } else if (!inAperture) {
        this.onNullLift = false;
      }
    } else {
      this.onNullLift = false;
    }

    if (this.inElevator && elv) {
      this.floorY = elv.cabY;
      this.jumpOffset = 0;
      this.jumpVelY = 0;
    } else if (this.inExtElevator && extElv) {
      this.floorY = extElv.cabY;
      this.jumpOffset = 0;
      this.jumpVelY = 0;
    } else if (this.inNullElevator && nullElv) {
      this.floorY = nullElv.cabY;
      this.jumpOffset = 0;
      this.jumpVelY = 0;
    } else if (this.onNullLift && silo) {
      this.floorY = silo.liftY;
      this.currentFloor = silo.liftProgress >= 0.5 ? 1 : -40;
      this.jumpOffset = 0;
      this.jumpVelY = 0;
    } else {
      const targetFloorY = this._computeFloorY(this.playerPos.x, this.playerPos.z);
      const lerpRate = this.activeFlight !== null ? 18 : 11;
      this.floorY += (targetFloorY - this.floorY) * Math.min(1, dt * lerpRate);

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
          this.audio.playJump(this._getSurfaceMaterial(this.playerPos.x, this.playerPos.z));
        }
      }

      if (this.jumpOffset > 0 || this.jumpVelY > 0) {
        this.jumpOffset += this.jumpVelY * dt;
        this.jumpVelY -= 18.0 * dt;
        if (this.jumpOffset <= 0) {
          this.jumpOffset = 0;
          this.jumpVelY = 0;
          this.audio.playLand(this._getSurfaceMaterial(this.playerPos.x, this.playerPos.z), 0.72);
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
        const surf = this._getSurfaceMaterial(this.playerPos.x, this.playerPos.z);
        if (this.activeFlight !== null) {
          if (this.activeStairBuilding === 'storage' && this.audio.playLadderRung) {
            this.audio.playLadderRung(true);
          } else {
            this.audio.playStairStep(surf === 'metal' || surf === 'tile' ? 'metal' : 'wood', (this.floorY - prevGroundY) >= -0.002);
          }
        } else {
          const isSprinting = horizSpeed > 5.0;
          this.audio.playFootstep(surf, { sprint: isSprinting, crouch: this.crouching });
          if (surf === 'water' && isSprinting && this.audio.playWaterWadeSplash) {
            this.audio.playWaterWadeSplash(0.85);
          } else if ((surf === 'moss' || surf === 'leaves' || surf === 'grass') && horizSpeed > 3.2 && Math.random() < 0.28 && this.audio.playBodyClothBrush) {
            this.audio.playBodyClothBrush(isSprinting ? 0.9 : 0.55);
          }
          if (isSprinting && Math.random() < 0.14 && this.audio.playSprintBreath) {
            this.audio.playSprintBreath(0.65);
          }
        }
      }
      this.prevBobSin = curSin;
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 8);
      this.prevBobSin = 0;
    }
  }

  _updateCameraTransform(elapsed) {
    if (this.drivingVehicle && this.driveCamMode !== 'cockpit') {
      const key = this.drivingVehicle;
      const veh = this._getVehicleObj(key);
      const vp = veh.pose;
      const fwdX = -Math.sin(vp.yaw);
      const fwdZ = -Math.cos(vp.yaw);
      if (this.driveCamMode === 'hood') {
        // Panoramic forward view mounted right ahead of top windshield / K-11 composite nosecone!
        const halfL = key === 'k11'
          ? 17.2
          : (key === 'armor' ? ARMOR_CAMPER.length * 0.5 : (key === 'kei' ? KEI.length * 0.5 : CAMPER.length * 0.5));
        const camY = (vp.y || 0) + (key === 'k11' ? 3.2 : (key === 'armor' ? 3.25 : (key === 'kei' ? 1.56 : 2.38)));
        this.camera.position.set(
          vp.cx + fwdX * (halfL + 0.18),
          camY,
          vp.cz + fwdZ * (halfL + 0.18),
        );
        _euler.set(this.pitch - 0.04, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
      } else {
        // Elevated wide chase camera following behind vehicle / K-11 airship, respecting user orbit look!
        const k11InSilo = key === 'k11' && veh.dockedInSilo && this.house.nullErea && this.house.nullErea.silo.liftProgress < 0.72;
        const chaseDist = key === 'k11' ? (k11InSilo ? 19.5 : 38.0) : (key === 'armor' ? 15.8 : (key === 'kei' ? 5.6 : 9.6));
        const chaseH = key === 'k11' ? (k11InSilo ? 8.5 : 14.5) : (key === 'armor' ? 5.8 : (key === 'kei' ? 2.7 : 4.2));
        const lookBackX = Math.sin(this.yaw);
        const lookBackZ = Math.cos(this.yaw);
        let cx = vp.cx + lookBackX * chaseDist;
        let cz = vp.cz + lookBackZ * chaseDist;
        let cy = (vp.y || 0) + chaseH - Math.sin(this.pitch) * chaseDist * 0.45;
        if (this.terreno && !k11InSilo) {
          const groundAtCam = this.terreno.getHeightAt(cx, cz);
          if (cy < groundAtCam + 1.15) cy = groundAtCam + 1.15;
        }
        this.camera.position.set(cx, cy, cz);
        _euler.set(Math.max(-0.55, Math.min(0.35, this.pitch - 0.18)), this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
      }
      if (this.flashlightTarget) {
        this.flashlightTarget.position.set(0, -0.08, -6.0);
      }
      return;
    }

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

    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    const cl = this.worldToCamperLocal(px, pz);
    const kl = this.worldToKeiLocal(px, pz);
    const al = this.worldToArmorLocal(px, pz);
    const tl = this.worldToContainerLocal(px, pz);
    const k11l = this.house.airshipK11 ? this.worldToK11Local(px, pz) : { lx: -999, lz: -999 };
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);
    const cp = this.house.camper.pose;
    const camLookX = lookX * Math.cos(cp.yaw) - lookZ * Math.sin(cp.yaw);
    const camLookZ = lookX * Math.sin(cp.yaw) + lookZ * Math.cos(cp.yaw);

    // Collect active/moving ground vehicles (player-driven OR autonomous) so Garage Gates (DG-N/DG-S) open when approaching!
    const activeVehicles = [];
    if (this.drivingVehicle && this.drivingVehicle !== 'k11') activeVehicles.push(this.drivingVehicle);
    if (this.autopilotRoutes.camper && !activeVehicles.includes('camper')) activeVehicles.push('camper');
    if (this.autopilotRoutes.armor && !activeVehicles.includes('armor')) activeVehicles.push('armor');

    for (const d of this.house.interactiveDoors) {
      if (d.forceOpen) continue;
      if (d.autoHoldTimer > 0) d.autoHoldTimer = Math.max(0, d.autoHoldTimer - dt);

      const b = d.collider;
      if (!b) continue;

      // Narrowed Auto Roll-Up Garage Gates (DG-N / DG-S) — reacts closely for foot traffic & approaching vehicles
      if (d.isGarageGate) {
        let minFootDist = Infinity;
        let minVehDist = Infinity;
        if (this.currentFloor === 1 && !this.drivingVehicle) {
          const cxP = px < b.minX ? b.minX : (px > b.maxX ? b.maxX : px);
          const czP = pz < b.minZ ? b.minZ : (pz > b.maxZ ? b.maxZ : pz);
          minFootDist = Math.hypot(px - cxP, pz - czP);
        }
        for (const vKey of activeVehicles) {
          const vObj = this._getVehicleObj(vKey);
          const vp = vObj.pose;
          const halfLen = vKey === 'armor' ? ARMOR_CAMPER.length * 0.5 : (vKey === 'kei' ? KEI.length * 0.5 : CAMPER.length * 0.5);
          const fx = -Math.sin(vp.yaw);
          const fz = -Math.cos(vp.yaw);
          const pts = [
            [vp.cx, vp.cz],
            [vp.cx + fx * halfLen, vp.cz + fz * halfLen],
            [vp.cx - fx * halfLen, vp.cz - fz * halfLen],
          ];
          if (vKey === 'armor' && this.house.towContainer && this.house.towContainer.hitched) {
            pts.push([this.house.towContainer.pose.cx, this.house.towContainer.pose.cz]);
          }
          for (const [vx, vz] of pts) {
            const cxV = vx < b.minX ? b.minX : (vx > b.maxX ? b.maxX : vx);
            const czV = vz < b.minZ ? b.minZ : (vz > b.maxZ ? b.maxZ : vz);
            minVehDist = Math.min(minVehDist, Math.hypot(vx - cxV, vz - czV));
          }
        }
        const shouldOpenGate = minFootDist < 1.15 || minVehDist < 3.6;
        const keepOpenGate = minFootDist < 1.45 || minVehDist < 4.2;
        const closeGateReady = minFootDist > 1.85 && minVehDist > 5.4;
        if (!d.isOpen && shouldOpenGate) {
          d.isOpen = true;
          d.autoHoldTimer = 1.0;
          if (this.autoDoorsReadyTimer <= 0) this.audio.playShutterClank(false, 'garage_rollup');
          this.adaptive.markShadowsDirty();
        } else if (d.isOpen) {
          if (keepOpenGate) d.autoHoldTimer = 0.8;
          else if (closeGateReady && d.autoHoldTimer <= 0) {
            d.isOpen = false;
            if (this.autoDoorsReadyTimer <= 0) this.audio.playShutterClank(true, 'garage_rollup');
            this.adaptive.markShadowsDirty();
          }
        }
        continue;
      }

      if (this.drivingVehicle) {
        if (d.isK11 && d.isExteriorAirlock && d.isOpen) d.isOpen = false;
        continue;
      }

      let sameFloor = false;
      let tx = px;
      let tz = pz;
      // Tight, realistic close-proximity trigger range for ALL doors!
      let openDist = 0.62;
      let closeDist = 1.08;

      if (d.isK11) {
        const k11 = this.house.airshipK11;
        const airborne = Boolean(k11 && !k11.dockedInSilo && k11.altitudeAGL > 2.2);
        if (airborne && d.isExteriorAirlock) {
          // Pressurized cabin safety interlock: exterior airlock hatch & airstair ramp stay sealed while flying!
          if (d.isOpen) d.isOpen = false;
          continue;
        }
        const silo = this.house.nullErea ? this.house.nullErea.silo : null;
        const k11AtB40 = Boolean(k11 && k11.dockedInSilo && silo && silo.liftProgress < 0.35);
        const k11AtSurf = Boolean(k11 && (!k11.dockedInSilo || (silo && silo.liftProgress > 0.72)));
        sameFloor = this.activeBuilding === 'k11'
          || (this.currentFloor === -40 && k11AtB40)
          || (this.currentFloor === 1 && k11AtSurf && k11.altitudeAGL < 2.2);
        tx = k11l.lx;
        tz = k11l.lz;
        openDist = d.isExteriorAirlock ? 1.50 : 0.72;
        closeDist = d.isExteriorAirlock ? 2.35 : 1.24;
      } else if (d.isCamper) {
        sameFloor = this.currentFloor === d.floor;
        tx = cl.lx;
        tz = cl.lz;
        if (d.id === 'DC-1') {
          openDist = 0.65;
          closeDist = 1.12;
        } else {
          openDist = 0.48;
          closeDist = 0.84;
        }
      } else if (d.isKei) {
        sameFloor = this.currentFloor === 1;
        tx = kl.lx;
        tz = kl.lz;
        openDist = 0.60;
        closeDist = 1.04;
      } else if (d.isArmor) {
        sameFloor = this.currentFloor === 1;
        tx = al.lx;
        tz = al.lz;
        openDist = (d.id === 'DAM-1' || d.id === 'DAM-R') ? 0.68 : 0.56;
        closeDist = (d.id === 'DAM-1' || d.id === 'DAM-R') ? 1.18 : 0.96;
      } else if (d.isContainer) {
        sameFloor = this.currentFloor === 1;
        tx = tl.lx;
        tz = tl.lz;
        openDist = 0.65;
        closeDist = 1.12;
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
        if (shouldOpen && d.isCamper && d.id !== 'DC-1' && d.id !== 'DC-01' && dist > 0.30) {
          const dmx = (b.minX + b.maxX) * 0.5 - tx;
          const dmz = (b.minZ + b.maxZ) * 0.5 - tz;
          const dmLen = Math.hypot(dmx, dmz) || 1;
          const faceDot = (dmx / dmLen) * camLookX + (dmz / dmLen) * camLookZ;
          if (faceDot < 0.25) shouldOpen = false;
        }
        if (shouldOpen) {
          d.isOpen = true;
          d.autoHoldTimer = 0.50;
          if (this.autoDoorsReadyTimer <= 0) this.audio.playDoor(this._classifyDoorAudioKind(d), true);
          this.adaptive.markShadowsDirty();
        }
      } else {
        if (dist < openDist + 0.12) {
          d.autoHoldTimer = 0.45;
        } else if (dist > closeDist && d.autoHoldTimer <= 0) {
          d.isOpen = false;
          if (this.autoDoorsReadyTimer <= 0) this.audio.playDoor(this._classifyDoorAudioKind(d), false);
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
        const speed = d.kind === 'rollup' ? 3.8 : 8.2;
        d.progress += (target - d.progress) * Math.min(1, dt * speed);
        const eased = d.progress * d.progress * (3 - 2 * d.progress);
        if (d.kind === 'swing') d.pivot.rotation.y = d.openAngle * eased;
        else if (d.kind === 'liftgate') d.pivot.rotation.x = d.openAngle * eased;
        else if (d.kind === 'rollup') d.pivot.position.y = d.closedY + d.openLiftY * eased;
        else if (d.axis === 'x') d.pivot.position.x = d.closedPos.x + d.slideDelta * eased;
        else d.pivot.position.z = d.closedPos.z + d.slideDelta * eased;
      }
    }

    // Update ARMOR-155 Motorized Iron Storm Shutters!
    if (this.house.armorCamper && this.house.armorCamper.shutters) {
      const sh = this.house.armorCamper.shutters;
      const prevP = sh.shutterProgress;
      sh.updateShutters(dt);
      if (Math.abs(sh.shutterProgress - prevP) > 0.0005) anyDoorAnimating = true;
    }

    // Real-Time Mark II MRL Traction Elevator (ELV-1: B4F..1F)
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

    // Exterior Panoramic Attic Express Elevator (ELV-EXT: 1F Courtyard <-> RF Attic 16.10m!)
    const extElv = this.house.extElevator;
    if (extElv) {
      const prevPhase = extElv.phase;
      extElv.update(dt);
      if (extElv.phase !== 'IDLE_OPEN') anyDoorAnimating = true;
      if (prevPhase === 'RUNNING' && extElv.phase === 'DOOR_OPENING') {
        this.audio.playElevatorChime(extElv.currentStopFloor === 7 ? 1 : -1);
        this.audio.playElevatorDoor(true);
      } else if (prevPhase !== 'DOOR_CLOSING' && extElv.phase === 'DOOR_CLOSING') {
        this.audio.playElevatorDoor(false);
      }
      if (this.inExtElevator) {
        this.floorY = extElv.cabY;
        if (extElv.phase === 'DOOR_OPENING' || extElv.phase === 'IDLE_OPEN') {
          this.currentFloor = extElv.currentStopFloor;
        } else if (extElv.phase === 'RUNNING') {
          this.currentFloor = extElv.cabY > 8.05 ? 7 : 1;
        }
      }
    }

    // NULL EREA 40m High-Speed Underground Elevator (ELV-NULL: GL 0m <-> B40F -40.0m!)
    const nullElv = this.house.nullElevator;
    if (nullElv) {
      const prevPhase = nullElv.phase;
      nullElv.update(dt);
      if (nullElv.phase !== 'IDLE_OPEN') anyDoorAnimating = true;
      if (prevPhase === 'RUNNING' && nullElv.phase === 'DOOR_OPENING') {
        this.audio.playElevatorChime(nullElv.currentStopFloor === 1 ? 1 : -1);
        this.audio.playElevatorDoor(true);
      } else if (prevPhase !== 'DOOR_CLOSING' && nullElv.phase === 'DOOR_CLOSING') {
        this.audio.playElevatorDoor(false);
      }
      if (this.inNullElevator) {
        this.floorY = nullElv.cabY;
        if (nullElv.phase === 'DOOR_OPENING' || nullElv.phase === 'IDLE_OPEN') {
          this.currentFloor = nullElv.currentStopFloor;
        } else if (nullElv.phase === 'RUNNING') {
          this.currentFloor = nullElv.cabY < nullElv.groundY - 20.0 ? -40 : 1;
        }
      }
    }

    // NULL EREA SILO-40: 44-Plate Multi-Layer Articulated Roof & 40m Giant Hydraulic Mega-Lift!
    const nullSilo = this.house.nullErea ? this.house.nullErea.silo : null;
    if (nullSilo) {
      const windVec = this.terreno && this.terreno.storm && this.terreno.storm.getIntensity() > 0.02
        ? this.terreno.storm.getWind()
        : null;
      const siloMoving = nullSilo.update(dt, elapsed, windVec);
      if (siloMoving) anyDoorAnimating = true;
      if (nullSilo.stageEventPending) {
        const stg = nullSilo.stageEventPending;
        nullSilo.stageEventPending = null;
        if (Math.hypot(this.playerPos.x - NULL_EREA.originX, this.playerPos.z - NULL_EREA.originZ) < 160.0) {
          this.audio.playSiloHydraulic(stg);
          if (stg === 'unlock' && this.audio.playSiloBlastKlaxon) this.audio.playSiloBlastKlaxon();
          if ((stg === 'lift' || stg === 'stow_start') && this.audio.playSiloCryoPurge) this.audio.playSiloCryoPurge();
        }
      }
      if (this.house.airshipK11 && this.house.airshipK11.dockedInSilo) {
        this.house.airshipK11.pose.y = nullSilo.liftY;
        this.house.airshipK11.syncTransform();
      }
    }

    if (this.drivingVehicle !== 'k11' && this.activeBuilding !== 'k11') {
      this.audio.updateAirshipEngine(false, 0);
    }

    if (this.house.b4Lab && this.currentFloor === -3) {
      this.house.b4Lab.update(dt, elapsed);
    }
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

      const tod = this.terreno.getTimeOfDay();
      const stormInt = this.terreno.storm ? this.terreno.storm.getIntensity() : 0;
      const lightning = this.terreno.storm ? this.terreno.storm.getLightningFlash() : 0;

      if (tod && this.moonLight) {
        const sd = this.terreno.atmoUniforms.uSunDir.value;
        const nearComp = Math.hypot(this.playerPos.x - 1.5, this.playerPos.z - 4.5) < 35.0;
        const tx = nearComp ? 0.5 : this.playerPos.x;
        const ty = nearComp ? 7.5 : this.floorY + 2.0;
        const tz = nearComp ? 4.5 : this.playerPos.z;
        this.moonLight.target.position.set(tx, ty, tz);
        this.moonLight.position.set(tx + sd.x * 46.0, ty + sd.y * 46.0, tz + sd.z * 46.0);
        this.moonLight.target.updateMatrixWorld();
        // Real-time severe storm darkening + volumetric lightning illumination on Three.js scene lights!
        this.moonLight.intensity = tod.sunIntensity * (1.0 - stormInt * 0.72) + lightning * 3.8;
        this.hemiLight.intensity = tod.hemiIntensity * (1.0 - stormInt * 0.45) + lightning * 1.4;
        if (this.scene.background) {
          const sh = this.terreno.atmoUniforms.uSkyHorizon.value;
          const sr = sh.r ?? sh.x ?? 0.5;
          const sg = sh.g ?? sh.y ?? 0.6;
          const sb = sh.b ?? sh.z ?? 0.7;
          this.scene.background.setRGB(
            Math.min(1, sr + lightning * 0.42),
            Math.min(1, sg + lightning * 0.46),
            Math.min(1, sb + lightning * 0.52),
          );
        }
        if (this.scene.fog) {
          const af = this.terreno.atmoUniforms.uAerialFogColor.value;
          this.scene.fog.color.setRGB(af.r ?? af.x ?? 0.5, af.g ?? af.y ?? 0.6, af.b ?? af.z ?? 0.7);
        }
        if (
          !Number.isFinite(this._lastShadowTargetX) ||
          Math.hypot(tx - this._lastShadowTargetX, tz - this._lastShadowTargetZ) > 9.0
        ) {
          this._lastShadowTargetX = tx;
          this._lastShadowTargetZ = tz;
          if (this.adaptive) this.adaptive.markShadowsDirty();
        }
      }

      // Spatial Storm Rain, Roof-Material Resonance, Thunder & Wind Howl Audio!
      let stormMuffle = 1.0;
      let roofKind = 'outdoor';
      if (this.currentFloor === -40) {
        const roofOpen = nullSilo ? nullSilo.roofProgress : 0;
        stormMuffle = 0.02 + roofOpen * 0.62;
        roofKind = 'underground';
      } else if (this.currentFloor <= 0) {
        stormMuffle = 0.02;
        roofKind = 'underground';
      } else if (this.activeBuilding === 'k11') {
        const hatchOpen = doorOpenMap['DK11-W'] || doorOpenMap['DK11-R'];
        stormMuffle = hatchOpen ? 0.54 : 0.16;
        roofKind = 'composite';
      } else if (this.activeBuilding === 'armor') {
        const shClosed = this.house.armorCamper?.shutters?.shuttersClosed;
        stormMuffle = shClosed ? 0.08 : 0.24;
        roofKind = 'metal';
      } else if (this.activeBuilding === 'garage' || this.activeBuilding === 'container' || this.activeBuilding === 'kei' || this.activeBuilding === 'storage') {
        stormMuffle = 0.34;
        roofKind = 'metal';
      } else if (this.activeBuilding !== 'courtyard') {
        stormMuffle = 0.22;
        roofKind = 'timber';
      }
      this._activeRoofKind = roofKind;
      this.audio.updateStorm(stormInt, stormMuffle, roofKind);

      // Real-time Thunder Crack & Valley Rolling Echo synchronized with storm lightning bolts!
      if (lightning > 0.72 && this._prevLightning <= 0.72 && stormInt > 0.15) {
        this.audio.playThunder(140 + Math.random() * 540);
      }
      this._prevLightning = lightning;
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
      ['Armor_Lounge_Fire', true, 0.12, 0.06],
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

    // Acoustic occlusion & Full 4-Space 3D Spatial Soundscape Environment State!
    let isFullyOutdoors = false;
    let acousticZone = 'wood_room';
    if (this.currentFloor === -40) {
      const roofOpen = nullSilo ? nullSilo.roofProgress : 0;
      this.audio.updateOcclusion(0.015 + roofOpen * 0.58);
      acousticZone = 'silo_cavern';
    } else if (this.currentFloor <= 0) {
      this.audio.updateOcclusion(0.015);
      acousticZone = this.currentFloor === -2 ? 'stone_bath' : (this.currentFloor === -3 ? 'basement_lab' : 'wood_room');
    } else if (this.activeBuilding === 'k11') {
      const hatchOpen = doorOpenMap['DK11-W'] || doorOpenMap['DK11-R'];
      this.audio.updateOcclusion(hatchOpen ? 0.56 : 0.18);
      acousticZone = 'airship_cabin';
    } else if (this.activeBuilding === 'armor') {
      const shClosed = this.house.armorCamper?.shutters?.shuttersClosed;
      const doorOpen = doorOpenMap['DAM-1'] || doorOpenMap['DAM-R'];
      this.audio.updateOcclusion(doorOpen ? 0.58 : (shClosed ? 0.06 : 0.16));
      acousticZone = 'vehicle_cabin';
    } else if (this.activeBuilding === 'container') {
      this.audio.updateOcclusion(doorOpenMap['DCT-1'] ? 0.60 : 0.12);
      acousticZone = 'vehicle_cabin';
    } else if (this.activeBuilding === 'garage') {
      const gateOpen = doorOpenMap['DG-N'] || doorOpenMap['DG-S'] || doorOpenMap['DG-W'];
      this.audio.updateOcclusion(gateOpen ? 0.72 : 0.25);
      acousticZone = 'garage';
    } else if (this.activeBuilding === 'village') {
      const vDoorOpen = doorOpenMap['DV1-1'] || doorOpenMap['DV2-1'] || doorOpenMap['DV3-1'] || doorOpenMap['DV4-1'] || doorOpenMap['DV5-1'];
      this.audio.updateOcclusion(vDoorOpen ? 0.72 : 0.28);
      acousticZone = 'wood_room';
    } else if (this.activeBuilding === 'kei') {
      const keiOpen = doorOpenMap['DK-L'] || doorOpenMap['DK-R'] || doorOpenMap['DK-D'];
      this.audio.updateOcclusion(keiOpen ? 0.72 : 0.22);
      acousticZone = 'vehicle_cabin';
    } else if (this.activeBuilding === 'camper') {
      this.audio.updateOcclusion(doorOpenMap['DC-1'] ? 0.62 : 0.16);
      acousticZone = 'vehicle_cabin';
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
      isFullyOutdoors = outside1F || onMainBal4F || onMainBal5F || onMainBal6F || onAnnexBal3F || onStorageExt;

      if (isFullyOutdoors) {
        this.audio.updateOcclusion(1.0);
        acousticZone = 'outdoor';
      } else if (this.activeBuilding === 'storage') {
        const sDoorOpen = (this.currentFloor === 1 && doorOpenMap['DS-1']) || (this.currentFloor === 2 && doorOpenMap['DS-2']);
        this.audio.updateOcclusion(sDoorOpen ? 0.58 : 0.08);
        acousticZone = 'garage';
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

    // Proximity environmental beds: Kurosugi River, 12 Tributaries, 3 Animated Waterfalls, Village Spring, Shrine, Cave Grotto & Travertine Onsen!
    const pxW = this.playerPos.x;
    const pzW = this.playerPos.z;
    const rvP = evalMainRiver(pzW);
    let riverDist = Math.max(0, Math.abs(pxW - rvP.x) - rvP.halfWidth);
    const tribP = evalClosestTributary(pxW, pzW);
    if (tribP) riverDist = Math.min(riverDist, Math.max(0, tribP.dist - tribP.width * 0.5));
    const wfDist = this.terreno?.getClosestWaterfallDist ? this.terreno.getClosestWaterfallDist(pxW, pzW) : 9999;
    if (wfDist < 180) {
      riverDist = Math.min(riverDist, Math.max(2.0, wfDist * 0.45));
    }
    const springDist = Math.hypot(pxW - VILLAGE.well.x, pzW - VILLAGE.well.z);
    const shrineDist = Math.hypot(pxW - VILLAGE.shrine.x, pzW - VILLAGE.shrine.z);
    const compoundDist = Math.hypot(pxW - 2.5, pzW - 4.0);
    const onBridgeNow = Boolean(this.terreno?.queryBridgeAt && this.terreno.queryBridgeAt(pxW, pzW, 0.5));
    const lfAtPlayer = this.terreno?.queryLandformAt ? this.terreno.queryLandformAt(pxW, pzW, 0) : null;
    let inNaturalSpa = false;
    if (lfAtPlayer && isFullyOutdoors) {
      if (lfAtPlayer.landform.kind === 'cave_grotto' && lfAtPlayer.dist < 32) {
        acousticZone = 'silo_cavern';
      } else if (lfAtPlayer.landform.kind === 'travertine_onsen' && lfAtPlayer.dist < 58) {
        inNaturalSpa = true;
      }
    }
    const altitudeASL = TERRENO_WORLD.baseElevationASL + (this.floorY || 0);

    let fireDist = 999;
    if (this.currentFloor === 6 && this.activeBuilding === 'main' && propStates.fireplace_6f) {
      fireDist = Math.hypot(pxW - 2.5, pzW - 8.2);
    } else if (this.activeBuilding === 'armor' && this.house.armorCamper) {
      const al = this.worldToArmorLocal(pxW, pzW);
      fireDist = Math.hypot(al.lx - 1.35, al.lz - 5.2);
    }

    let landslideNear = 0;
    const stormIntNow = this.terreno?.storm ? this.terreno.storm.getIntensity() : 0;
    if (this.terreno?.storm && stormIntNow > 0.25 && this.terreno.storm.landslides) {
      let minLsD = 9999;
      for (let i = 0; i < this.terreno.storm.landslides.length; i++) {
        const ls = this.terreno.storm.landslides[i];
        if (!ls.active) continue;
        const d = Math.hypot(pxW - ls.x, pzW - ls.z);
        if (d < minLsD) minLsD = d;
      }
      if (minLsD < 140) {
        landslideNear = 1.0 - minLsD / 140;
        if ((elapsed - this._prevLandslideRumbleTime) > 5.5) {
          this._prevLandslideRumbleTime = elapsed;
          this.audio.playLandslideRumble(landslideNear);
        }
      }
    }

    const todNow = this.terreno?.getTimeOfDay ? this.terreno.getTimeOfDay() : null;
    this.audio.updateEnvironment(dt, {
      acousticZone,
      isOutdoors: isFullyOutdoors && this.currentFloor >= 1,
      isNight: todNow ? (todNow.id === 'night' || todNow.id === 'dusk') : false,
      altitudeASL,
      onBridge: onBridgeNow,
      riverDist,
      riverFlowBoost: stormIntNow + (wfDist < 120 ? (1.0 - wfDist / 120) * 0.95 : 0),
      springDist,
      shrineDist,
      compoundDist,
      fireDist,
      inSpa: this.currentFloor === -2 || inNaturalSpa,
      inUnderground: this.currentFloor <= -1,
      inSiloCavern: this.currentFloor === -40,
      roofKind: this._activeRoofKind || 'outdoor',
      landslideNear,
    });

    return { anyDoorAnimating, doorOpenMap, propStates };
  }

  _detectCurrentRoom() {
    const x = this.playerPos.x;
    const z = this.playerPos.z;
    if (this.inNullElevator && this.house.nullElevator) {
      const ne = this.house.nullElevator;
      const relDepth = Math.min(0, ne.cabY - ne.groundY);
      const kmh = Math.round(Math.abs(ne.velY || 0) * 3.6);
      const label = ne.phase === 'RUNNING'
        ? `ELV-NULL 高速昇降中 (${relDepth.toFixed(1)}m / ${kmh}km/h)`
        : `ELV-NULL 地下40m直通 (${ne.currentStopFloor === -40 ? 'B40F -40.0m' : 'GL ±0.0m'})`;
      return { id: 'null_elevator', code: 'ELV-NULL', floor: this.currentFloor, building: 'null_hangar', nameJp: label };
    }
    if (this.inExtElevator && this.house.extElevator) {
      return { id: 'ext_elevator', code: 'ELV-EXT', floor: this.currentFloor, building: 'main', nameJp: '外部屋根裏直通エレベーター' };
    }
    if (this.inElevator && this.house.elevator) {
      const st = this.house.elevator.getState();
      const targetCode = ELEVATOR.stops.find((s) => s.floor === st.targetFloor)?.code || '1F';
      let msg = `MRL-900 リアルELV (${st.floorCode} 停止中 / ${st.cabY.toFixed(1)}m)`;
      if (st.phase === 'BRAKE_RELEASE') msg = `電磁ブレーキ解除 → ${targetCode} 発進`;
      else if (st.phase === 'RUNNING') msg = `リアルELV 昇降中 (${st.speedMs.toFixed(1)}m/s → ${targetCode} / ${st.cabY.toFixed(1)}m)`;
      else if (st.phase === 'RELEVELING') msg = `精密微速着床中 (${targetCode} レベリング)`;
      return { id: 'elevator_cab', code: 'ELV-1', floor: this.currentFloor, building: 'main', nameJp: msg };
    }
    if (this.drivingVehicle === 'k11' && this.house.airshipK11) {
      const k11 = this.house.airshipK11;
      const kmh = Math.round(k11.groundSpeedKmh || 0);
      const alt = Math.round(k11.altitudeAGL || 0);
      return {
        id: 'k11_piloting',
        code: 'K-11',
        floor: this.currentFloor,
        building: 'k11',
        nameJp: `飛行船 K-11 操縦中 (${kmh}km/h・高度${alt}m・残${k11.fuelL.toFixed(1)}L)`,
      };
    }
    if (this.drivingVehicle === 'kei') {
      const kmh = Math.round(Math.abs(this.house.kei.speed) * 3.6);
      return { id: 'kei_driving', code: '軽運転', floor: 1, building: 'kei', nameJp: `軽バン走行 (${kmh} km/h)` };
    }
    if (this.drivingVehicle === 'armor') {
      const kmh = Math.round(Math.hypot(this.house.armorCamper.velX || 0, this.house.armorCamper.velZ || 0) * 3.6);
      return { id: 'armor_driving', code: '装甲RV', floor: 1, building: 'armor', nameJp: `ARMOR-155 (${kmh} km/h)` };
    }
    if (this.drivingVehicle === 'camper') {
      const kmh = Math.round(Math.abs(this.house.camper.speed) * 3.6);
      return { id: 'camper_driving', code: '運転中', floor: 1, building: 'camper', nameJp: `キャンピングカー走行 (${kmh} km/h)` };
    }
    if (this.activeFlight !== null) {
      if (this.activeFlight === 'st_b2') {
        return { id: 'stair_b2', code: 'ST_B2', floor: this.currentFloor, building: 'main', nameJp: 'B1F↔B2F 階段' };
      }
      if (this.activeFlight === 'st_b3') {
        return { id: 'stair_b3', code: 'ST_B3', floor: this.currentFloor, building: 'main', nameJp: 'B2F↔B3F 階段' };
      }
      if (this.activeStairBuilding === 'camper') {
        return { id: 'camper_stair', code: 'STC1', floor: this.currentFloor, building: 'camper', nameJp: 'キャンピングカー 階段' };
      }
      if (this.activeStairBuilding === 'storage') {
        return { id: 'storage_stair', code: 'STS1', floor: this.currentFloor, building: 'storage', nameJp: '倉庫 外階段' };
      }
      if (this.activeStairBuilding === 'annex') {
        return { id: 'annex_stair', code: `STA${this.activeFlight}`, floor: this.currentFloor, building: 'annex', nameJp: '隣棟 階段' };
      }
      return { id: 'stair', code: `ST${this.activeFlight}`, floor: this.currentFloor, building: 'main', nameJp: '母屋 階段' };
    }

    if (this.activeBuilding === 'k11' && this.house.airshipK11) {
      const kl11 = this.worldToK11Local(x, z);
      for (let i = AIRSHIP_K11_PLAN.rooms.length - 1; i >= 0; i--) {
        const r = AIRSHIP_K11_PLAN.rooms[i];
        if (kl11.lx >= r.x && kl11.lx <= r.x + r.w && kl11.lz >= r.z && kl11.lz <= r.z + r.d) return r;
      }
      return AIRSHIP_K11_PLAN.rooms[0];
    }
    if (this.currentFloor === -40 || this.activeBuilding === 'null_hangar') {
      const nx = x - NULL_EREA.originX + 23.5;
      const nz = z - NULL_EREA.originZ + 27.0;
      for (let i = NULL_HANGAR_PLAN.rooms.length - 1; i >= 0; i--) {
        const r = NULL_HANGAR_PLAN.rooms[i];
        if (nx >= r.x && nx <= r.x + r.w && nz >= r.z && nz <= r.z + r.d) return r;
      }
      return NULL_HANGAR_PLAN.rooms[0];
    }
    if (this.activeBuilding === 'armor') {
      const al = this.worldToArmorLocal(x, z);
      for (let i = ARMOR_CAMPER_PLAN.rooms.length - 1; i >= 0; i--) {
        const r = ARMOR_CAMPER_PLAN.rooms[i];
        if (al.lx >= r.x && al.lx <= r.x + r.w && al.lz >= r.z && al.lz <= r.z + r.d) return r;
      }
      return ARMOR_CAMPER_PLAN.rooms[0];
    }
    if (this.activeBuilding === 'container') {
      return TOW_CONTAINER_PLAN.rooms[0];
    }
    if (this.activeBuilding === 'garage') {
      const gx = x - GARAGE.originX;
      const gz = z - GARAGE.originZ;
      for (let i = GARAGE_PLAN.rooms.length - 1; i >= 0; i--) {
        const r = GARAGE_PLAN.rooms[i];
        if (gx >= r.x && gx <= r.x + r.w && gz >= r.z && gz <= r.z + r.d) return r;
      }
      return GARAGE_PLAN.rooms[0];
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
        return { id: 'storage_landing', code: 'S2LD', floor: 2, building: 'storage', nameJp: '倉庫棟2F 鋼製踊場' };
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

    if (this.activeBuilding === 'village') {
      const vh = queryVillageHouseAt(x, z);
      if (vh) {
        return { id: vh.room.id, code: vh.room.code, floor: 1, building: 'village', nameJp: vh.room.nameJp };
      }
      return { id: 'village_house', code: '杉ノ郷', floor: 1, building: 'village', nameJp: '杉ノ郷集落 民家' };
    }

    if (this.currentFloor === 1 && this.activeBuilding === 'courtyard') {
      const vhPorch = queryVillageHouseAt(x, z);
      if (vhPorch) {
        return { id: vhPorch.room.id, code: vhPorch.room.code, floor: 1, building: 'courtyard', nameJp: vhPorch.room.nameJp };
      }
      if (isInVillagePrecinct(x, z)) {
        return { id: 'village_plaza', code: '杉ノ郷', floor: 1, building: 'courtyard', nameJp: '杉ノ郷集落・石畳広場（標高 +119m・全5棟）' };
      }
      const distBase = Math.hypot(x - TERRENO_WORLD.compoundCenterX, z - TERRENO_WORLD.compoundCenterZ);
      if (this.terreno && distBase > 28.0) {
        const b = this.terreno.getBiomeInfoAt(x, z);
        return {
          id: 'exterior_mountain',
          code: `EL+${Math.round(b.asl)}m`,
          floor: 1,
          building: 'courtyard',
          nameJp: b.zoneJp,
        };
      }
      return { id: 'exterior', code: 'EXT', floor: 1, building: 'courtyard', nameJp: '中庭・森' };
    }

    if (this.currentFloor === -1 && x < 0.0) {
      return { id: 'b2_stair_landing', code: 'ST_B2', floor: -1, building: 'main', nameJp: 'B2F 階段踊場' };
    }
    if (this.currentFloor === -2 && x < 0.0 && z > 12.20) {
      return { id: 'b3_stair_landing', code: 'ST_B3', floor: -2, building: 'main', nameJp: 'B3F 階段踊場' };
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

      this._updateMovement(dt, elapsed);
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
        flashlightOn: this.flashlightOn
          || this.house.camper.headlightsOn
          || this.house.kei.headlightsOn
          || this.house.armorCamper.headlightsOn
          || Boolean(this.house.airshipK11 && this.house.airshipK11.headlightsOn),
        cameraMoved,
        currentFloor: this.currentFloor,
        activeFlight: this.activeFlight,
        activeBuilding: this.activeBuilding,
        inElevator: this.inElevator,
        inExtElevator: this.inExtElevator,
        doorOpenMap,
        propStates,
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
      });

      if (this.scene.fog) {
        const stormInt = this.terreno && this.terreno.storm ? this.terreno.storm.getIntensity() : 0;
        const outdoorFog = 0.00018 + stormInt * 0.0018;
        let targetFog = outdoorFog;
        if (this.currentFloor === -40) {
          const roofOpen = this.house.nullErea ? this.house.nullErea.silo.roofProgress : 0;
          targetFog = 0.0016 * (1.0 - roofOpen) + outdoorFog * roofOpen;
        } else if (this.currentFloor < 0 || this.inElevator) {
          targetFog = 0.0035;
        }
        this.scene.fog.density += (targetFog - this.scene.fog.density) * Math.min(1, dt * 8);
      }

      const todPreset = this.terreno ? this.terreno.getTimeOfDay() : null;
      const outdoorExp = todPreset ? todPreset.exposure : 1.12;
      let targetExposure = 1.15;
      if (this.flashlightOn) targetExposure = 1.06;
      else if (this.inElevator || this.inExtElevator || this.inNullElevator) targetExposure = 1.18;
      else if (this.currentFloor === -40) targetExposure = 1.18;
      else if (this.currentFloor === -3) targetExposure = 1.18;
      else if (this.currentFloor === -1) targetExposure = 1.14;
      else if (this.currentFloor === -2) targetExposure = 1.16;
      else if (this.currentFloor === 0) targetExposure = 1.02;
      else if (this.activeBuilding === 'k11') targetExposure = 1.14;
      else if (this.activeBuilding === 'storage' || this.activeBuilding === 'garage') targetExposure = 1.12;
      else if (this.activeBuilding === 'armor' || this.activeBuilding === 'container') targetExposure = 1.16;
      else if (this.activeBuilding === 'camper' || this.activeBuilding === 'kei') targetExposure = outdoorExp;
      else if (room && (room.id === 'exterior_mountain' || room.id === 'exterior')) targetExposure = outdoorExp;
      else if (room && (room.id.includes('passage') || room.id.includes('gallery') || room.id.includes('stair'))) targetExposure = 1.24;
      else targetExposure = outdoorExp;
      this.postfx.render(this.scene, this.camera, elapsed, targetExposure);

      const aim = this.mapOpen ? null : this._raycastInteractable();
      if (this.callbacks.onAimChange) this.callbacks.onAimChange(aim);

      if (this.callbacks.onPoseUpdate) {
        this.camera.getWorldDirection(_lookDir);
        const inK11 = this.activeBuilding === 'k11';
        const inNullHangar = this.currentFloor === -40 || this.activeBuilding === 'null_hangar' || this.inNullElevator;
        const inKei = this.activeBuilding === 'kei';
        const inCamper = this.activeBuilding === 'camper';
        const inArmor = this.activeBuilding === 'armor';
        const inContainer = this.activeBuilding === 'container';
        const inGarage = this.activeBuilding === 'garage';
        const inAnnex = this.activeBuilding === 'annex';
        const inStorage = this.activeBuilding === 'storage';
        const distFromComp = Math.hypot(this.playerPos.x - TERRENO_WORLD.compoundCenterX, this.playerPos.z - TERRENO_WORLD.compoundCenterZ);
        const distFromNull = Math.hypot(this.playerPos.x - NULL_EREA.originX, this.playerPos.z - NULL_EREA.originZ);
        const nearNullSurface = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && distFromNull < 52.0;
        const farOutdoors = this.currentFloor === 1 && this.activeBuilding === 'courtyard' && distFromComp > 28.0 && !nearNullSurface;

        // 0..24 = CAD Blueprints (incl. 23=NULL車庫, 24=K-11), 30 = 3D Map, 31 = 2D Authentic Autopilot Map
        let sheetIndex = farOutdoors ? 30 : (nearNullSurface ? SHEET_OFFSETS.nullHangar : (this.currentFloor + 3));
        let floorCode = farOutdoors
          ? '平野'
          : (nearNullSurface
            ? 'NULL EREA'
            : (this.activeBuilding === 'courtyard'
              ? '中庭'
              : (this.inExtElevator ? 'ELV-EXT' : (this.inElevator ? 'ELV-1' : getFloorByPhysicalIndex(this.currentFloor).code))));
        let localX = nearNullSurface ? (this.playerPos.x - NULL_EREA.originX + 23.5) : this.playerPos.x;
        let localZ = nearNullSurface ? (this.playerPos.z - NULL_EREA.originZ + 27.0) : this.playerPos.z;
        let localDx = _lookDir.x;
        let localDz = _lookDir.z;

        if (inK11 && this.house.airshipK11) {
          sheetIndex = this.drivingVehicle === 'k11' ? 31 : SHEET_OFFSETS.k11;
          floorCode = this.drivingVehicle === 'k11' ? 'K-11飛行' : 'K-11船内';
          const kl11 = this.worldToK11Local(this.playerPos.x, this.playerPos.z);
          localX = kl11.lx;
          localZ = kl11.lz;
          const kp = this.house.airshipK11.pose;
          const c = Math.cos(kp.yaw);
          const s = Math.sin(kp.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inNullHangar) {
          sheetIndex = SHEET_OFFSETS.nullHangar;
          floorCode = this.inNullElevator ? 'ELV-NULL' : 'B40F車庫';
          localX = this.playerPos.x - NULL_EREA.originX + 23.5;
          localZ = this.playerPos.z - NULL_EREA.originZ + 27.0;
        } else if (inArmor) {
          sheetIndex = distFromComp > 30.0 ? 31 : SHEET_OFFSETS.armor;
          floorCode = '装甲RV';
          const al = this.worldToArmorLocal(this.playerPos.x, this.playerPos.z);
          localX = al.lx;
          localZ = al.lz;
          const ap = this.house.armorCamper.pose;
          const c = Math.cos(ap.yaw);
          const s = Math.sin(ap.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inContainer) {
          sheetIndex = distFromComp > 30.0 ? 31 : SHEET_OFFSETS.container;
          floorCode = 'コンテナ';
          const tl = this.worldToContainerLocal(this.playerPos.x, this.playerPos.z);
          localX = tl.lx;
          localZ = tl.lz;
          const tp = this.house.towContainer.pose;
          const c = Math.cos(tp.yaw);
          const s = Math.sin(tp.yaw);
          localDx = _lookDir.x * c - _lookDir.z * s;
          localDz = _lookDir.x * s + _lookDir.z * c;
        } else if (inGarage) {
          sheetIndex = SHEET_OFFSETS.garage;
          floorCode = '車庫';
          localX = this.playerPos.x - GARAGE.originX;
          localZ = this.playerPos.z - GARAGE.originZ;
        } else if (inKei) {
          sheetIndex = distFromComp > 30.0 ? 30 : SHEET_OFFSETS.kei;
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
          sheetIndex = distFromComp > 30.0 ? 30 : (SHEET_OFFSETS.camper + (this.currentFloor === 2 ? 1 : 0));
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

        const storm = this.terreno ? this.terreno.storm : null;
        const activeRoute = this.autopilotRoutes[this.selectedAutopilotVehicle] || this.autopilotRoutes.k11 || this.autopilotRoutes.camper || this.autopilotRoutes.armor;
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
          armorPose: this.house.armorCamper.pose,
          k11Pose: this.house.airshipK11 ? this.house.airshipK11.pose : null,
          containerPose: this.house.towContainer.pose,
          containerHitched: this.house.towContainer.hitched,
          floodRise: storm ? storm.getFloodRise() : 0,
          activeLandslides: storm ? storm.landslides.filter((l) => l.progress > 0.25) : [],
          selectedAutopilotVehicle: this.selectedAutopilotVehicle,
          autopilotRoutes: {
            camper: this.autopilotRoutes.camper ? this.autopilotRoutes.camper.points : null,
            armor: this.autopilotRoutes.armor ? this.autopilotRoutes.armor.points : null,
            k11: this.autopilotRoutes.k11 ? this.autopilotRoutes.k11.points : null,
          },
          autopilotRoute: activeRoute ? activeRoute.points : null,
          autopilotTargetId: activeRoute ? activeRoute.targetId : null,
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
