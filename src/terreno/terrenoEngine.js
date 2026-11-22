import * as THREE from 'three';
import {
  TERRENO_WORLD,
  TERRENO_LANDMARKS,
  ATMOSPHERE_PRESETS,
  ATMOSPHERE_ORDER,
  evalMainRiver,
} from './terrenoConfig.js';
import { buildTerrenoGeomorphology } from './terrenoGeomorphology.js';
import {
  createSharedAtmosphereUniforms,
  applyAtmospherePresetToUniforms,
} from './terrenoAtmosphereGlsl.js';
import { createTerrenoClipmap } from './terrenoClipmap.js';
import { createTerrenoWater } from './terrenoWater.js';
import { createTerrenoForest } from './terrenoForest.js';
import { createTerrenoMap2D } from './terrenoMap2d.js';
import { createTerrenoMap3D } from './terrenoMap3d.js';
import { createTerrenoStorm } from './terrenoStorm.js';
import { createTerrenoAutopilot } from './terrenoAutopilot.js';

/**
 * TERRENO Engine — Unified 5 km × 19 km (95.0 km²) Ultra-Precision Mountain & Deep-Forest World Controller.
 */
export function createTerrenoEngine(scene, initialTodId = 'day') {
  const root = new THREE.Group();
  root.name = 'TERRENO_WORLD_5x19km';

  const geomorph = buildTerrenoGeomorphology();

  let currentTodId = ATMOSPHERE_PRESETS[initialTodId] ? initialTodId : 'day';
  const atmoUniforms = createSharedAtmosphereUniforms(currentTodId, geomorph);

  const clipmap = createTerrenoClipmap(geomorph, atmoUniforms);
  const water = createTerrenoWater(geomorph, atmoUniforms);
  const forest = createTerrenoForest(geomorph, atmoUniforms);
  const storm = createTerrenoStorm(geomorph, water, atmoUniforms);
  const autopilot = createTerrenoAutopilot(geomorph, storm);

  root.add(clipmap.group);
  root.add(water.group);
  root.add(forest.group);
  root.add(storm.group);
  scene.add(root);

  const initPos = new THREE.Vector3(TERRENO_WORLD.compoundCenterX, 1.5, TERRENO_WORLD.compoundCenterZ);
  clipmap.update(initPos);
  forest.update(initPos);

  let map2dInstance = null;
  let map3dInstance = null;
  let prevElapsed = 0;

  function setTimeOfDay(presetId) {
    if (!ATMOSPHERE_PRESETS[presetId]) return ATMOSPHERE_PRESETS[currentTodId];
    currentTodId = presetId;
    return applyAtmospherePresetToUniforms(atmoUniforms, presetId);
  }

  function cycleTimeOfDay() {
    return ATMOSPHERE_PRESETS[currentTodId];
  }

  function getTimeOfDay() {
    return ATMOSPHERE_PRESETS[currentTodId];
  }

  function setVisible(visible) {
    root.visible = !!visible;
  }

  function setSurfaceSuper(enabled, maxAniso = 8) {
    if (clipmap.setSurfaceSuper) clipmap.setSurfaceSuper(enabled, maxAniso);
    if (forest.setSurfaceSuper) forest.setSurfaceSuper(enabled, maxAniso);
  }

  function update(cameraPos, elapsed, flashlightState = null) {
    const dt = Math.max(0.001, Math.min(0.05, elapsed - prevElapsed));
    prevElapsed = elapsed;
    atmoUniforms.uTime.value = elapsed;

    if (flashlightState && flashlightState.enabled) {
      atmoUniforms.uFlashPos.value.copy(flashlightState.position);
      atmoUniforms.uFlashDir.value.copy(flashlightState.direction);
      atmoUniforms.uFlashIntensity.value = flashlightState.intensity ?? 4.2;
    } else {
      atmoUniforms.uFlashIntensity.value = 0.0;
    }

    storm.update(cameraPos, dt, elapsed);

    if (!root.visible) return;
    clipmap.update(cameraPos);
    forest.update(cameraPos);
  }

  function getHeightAtWithLandslides(wx, wz) {
    return geomorph.getHeightAt(wx, wz) + storm.getLandslideInfoAt(wx, wz).heightAdd;
  }

  function getOrCreateMap2D(callbacks) {
    if (!map2dInstance) {
      map2dInstance = createTerrenoMap2D(geomorph, callbacks);
    }
    return map2dInstance;
  }

  function getOrCreateMap3D() {
    if (!map3dInstance) {
      map3dInstance = createTerrenoMap3D(geomorph);
    }
    return map3dInstance;
  }

  function getStats() {
    const fStats = forest.getStats();
    return {
      worldWidthM: TERRENO_WORLD.width,
      worldDepthM: TERRENO_WORLD.depth,
      areaKm2: (TERRENO_WORLD.width * TERRENO_WORLD.depth) / 1e6,
      atlasW: geomorph.W,
      atlasH: geomorph.H,
      bakeMs: Math.round(geomorph.bakeMs * 10) / 10,
      minElevationASL: Math.round(TERRENO_WORLD.baseElevationASL + geomorph.minElev),
      maxElevationASL: Math.round(TERRENO_WORLD.baseElevationASL + geomorph.maxElev),
      clipmapRings: clipmap.rings.length,
      timeOfDay: currentTodId,
      stormIntensity: Math.round(storm.getIntensity() * 100) / 100,
      floodRiseM: Math.round(storm.getFloodRise() * 10) / 10,
      forest: fStats,
      localColliderCount: forest.getLocalColliders().length,
    };
  }

  return {
    root,
    world: TERRENO_WORLD,
    landmarks: TERRENO_LANDMARKS,
    presets: ATMOSPHERE_PRESETS,
    geomorph,
    atmoUniforms,
    clipmap,
    water,
    forest,
    storm,
    autopilot,
    evalMainRiver,
    getHeightAt: getHeightAtWithLandslides,
    getRawHeightAt: geomorph.getHeightAt,
    getNormalAt: geomorph.getNormalAt,
    getMacroNormalAt: geomorph.getMacroNormalAt,
    sampleGeoBilinear: geomorph.sampleGeoBilinear,
    getBiomeInfoAt: geomorph.getBiomeInfoAt,
    getLocalColliders: forest.getLocalColliders,
    ensureCollidersAt: forest.ensureCollidersAt,
    setSurfaceSuper,
    setTimeOfDay,
    cycleTimeOfDay,
    getTimeOfDay,
    setVisible,
    update,
    getOrCreateMap2D,
    getOrCreateMap3D,
    getStats,
  };
}
