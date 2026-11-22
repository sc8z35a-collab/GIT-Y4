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

/**
 * TERRENO 1.1 Engine — Unified 15 km × 40 km (600.0 km²) Ultra-Precision Mountain & Deep-Forest World Controller.
 * Coordinates:
 *   1. Hydro-Tectonic + Phacelle + D8 Stream-Power Geomorphology & Dual-Azimuth Horizon Atlas
 *   2. 13-Ring Crack-Free GPU Geomorphing Clipmaps + Seamless PBR + Triplanar Granite + 52km Sky Dome
 *   3. Slope-Conforming 40 km Main Gorge River (黒杉川) & 16 Cascading Tributaries
 *   4. Deterministic Zero-GC Ecological Japanese Forest Streamer + 6,800 Mid-Distance Canopy Impostors
 *   5. Interactive Real-Time 3D Topographic Map, 2D Contour Survey & 8-Landmark Console (incl. Suginosato 5-House Village)
 */
export function createTerrenoEngine(scene, initialTodId = 'day') {
  const root = new THREE.Group();
  root.name = 'TERRENO_WORLD_15x40km';

  // 1. Bake 15km × 40km physical watershed & dual-azimuth horizon shadow atlas
  const geomorph = buildTerrenoGeomorphology();

  // 2. Shared Atmosphere Uniforms (including uAtmoHorizonMap for volumetric Sea-of-Clouds & God-Rays!)
  let currentTodId = ATMOSPHERE_PRESETS[initialTodId] ? initialTodId : 'day';
  const atmoUniforms = createSharedAtmosphereUniforms(currentTodId, geomorph);

  // 3. Instantiate visual & ecological subsystems
  const clipmap = createTerrenoClipmap(geomorph, atmoUniforms);
  const water = createTerrenoWater(geomorph, atmoUniforms);
  const forest = createTerrenoForest(geomorph, atmoUniforms);

  root.add(clipmap.group);
  root.add(water.group);
  root.add(forest.group);
  scene.add(root);

  // Prime initial camera-centered tiles right around NARROW-50 compound!
  const initPos = new THREE.Vector3(TERRENO_WORLD.compoundCenterX, 1.5, TERRENO_WORLD.compoundCenterZ);
  clipmap.update(initPos);
  forest.update(initPos);

  let map2dInstance = null;
  let map3dInstance = null;

  function setTimeOfDay(presetId) {
    if (!ATMOSPHERE_PRESETS[presetId]) return ATMOSPHERE_PRESETS[currentTodId];
    currentTodId = presetId;
    return applyAtmospherePresetToUniforms(atmoUniforms, presetId);
  }

  function cycleTimeOfDay() {
    // Locked — time of day is fixed
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
    atmoUniforms.uTime.value = elapsed;

    if (flashlightState && flashlightState.enabled) {
      atmoUniforms.uFlashPos.value.copy(flashlightState.position);
      atmoUniforms.uFlashDir.value.copy(flashlightState.direction);
      atmoUniforms.uFlashIntensity.value = flashlightState.intensity ?? 4.2;
    } else {
      atmoUniforms.uFlashIntensity.value = 0.0;
    }

    if (!root.visible) return;
    clipmap.update(cameraPos);
    forest.update(cameraPos);
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
    evalMainRiver,
    getHeightAt: geomorph.getHeightAt,
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
