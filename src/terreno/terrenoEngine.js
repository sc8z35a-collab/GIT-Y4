import * as THREE from 'three';
import {
  TERRENO_WORLD,
  TERRENO_LANDMARKS,
  ATMOSPHERE_PRESETS,
  evalMainRiver,
} from './terrenoConfig.js';
import { buildTerrenoGeomorphology } from './terrenoGeomorphology.js';
import {
  createSharedAtmosphereUniforms,
  applyAtmospherePresetToUniforms,
} from './terrenoAtmosphereGlsl.js';
import { createTerrenoClipmap } from './terrenoClipmap.js';
import { createTerrenoBridges } from './terrenoBridges.js';
import { createTerrenoWater } from './terrenoWater.js';
import { createTerrenoForest } from './terrenoForest.js';
import { createTerrenoNaturalLocations } from './terrenoNaturalLocations.js';
import { createTerrenoSubterranean } from './terrenoSubterranean.js';
import { createTerrenoMap2D } from './terrenoMap2d.js';
import { createTerrenoStorm } from './terrenoStorm.js';
import { createTerrenoAutopilot } from './terrenoAutopilot.js';
import { createTerrenoWeatherClouds } from './terrenoWeatherClouds.js';
import { createTerrenoEcosystems } from './terrenoEcosystems.js';
import { createRealEngine } from '../physics/realEngine.js';

/**
 * TERRENO 9.0 & REAL ENGINE 1.0 — Unified 60 km × 60 km (3,600 km²) Roadless Earth & Subterranean Engine
 *
 *   • 210 Natural Earth & Subterranean Geological Processes (1,700+ multi-occurrence features, 24 named biomes)
 *   • Surface Relief: -800 m .. +4,000 m ASL (4,800 m relief) + Subterranean World: -801 m .. -1,900 m ASL
 *   • Truly Floating 5-Layer 3D Volumetric Clouds + Real 13-Mode Dynamic Meteorological Weather System
 *   • 100 Living River (20), Lake (16) & 24-Biome Specialist (64) Ecosystem Entities in 4 GPU Super-Batches
 *   • Ultra-Lightweight Strict 6 m × 6 m × 6 m Dynamic Animation Bubble (excluding Elevators & Autopilot)
 *   • Coupled High-Precision 2D Map Autopilot Trajectory Prediction & 30 m Driver-Separation Emergency Pickup
 */
export function createTerrenoEngine(scene, initialTodId = 'day', renderer = null) {
  const root = new THREE.Group();
  root.name = 'TERRENO_WORLD_60x60km';

  // 1. Bake 60km × 60km tectonic geomorphology (210 geological processes, -800m..+4,000m surface, -801..-1,900m subterranean)
  const geomorph = buildTerrenoGeomorphology();
  if (renderer && renderer.extensions && renderer.extensions.has('OES_texture_float_linear')) {
    geomorph.geoTexture.minFilter = THREE.LinearFilter;
    geomorph.geoTexture.magFilter = THREE.LinearFilter;
    geomorph.geoTexture.needsUpdate = true;
    geomorph.hasFloatLinear = true;
  } else {
    geomorph.hasFloatLinear = false;
  }

  // 2. Register natural shallow cobble river fords (0 artificial bridges!)
  const bridges = createTerrenoBridges(geomorph);

  // 3. Initialize REAL ENGINE 1.0 physical law field & toroidal spring-damped foliage trail!
  const realEngine = createRealEngine();

  let currentTodId = ATMOSPHERE_PRESETS[initialTodId] ? initialTodId : 'day';
  const atmoUniforms = createSharedAtmosphereUniforms(currentTodId, geomorph);

  const clipmap = createTerrenoClipmap(geomorph, atmoUniforms);
  const water = createTerrenoWater(geomorph, atmoUniforms);
  const naturalLocations = createTerrenoNaturalLocations(geomorph, atmoUniforms);
  const forest = createTerrenoForest(geomorph, atmoUniforms, realEngine);
  const ecosystems = createTerrenoEcosystems(geomorph, atmoUniforms);
  const subterranean = createTerrenoSubterranean(geomorph, atmoUniforms);
  const storm = createTerrenoStorm(geomorph, water, atmoUniforms);
  const weather = createTerrenoWeatherClouds(geomorph, atmoUniforms, storm);
  const autopilot = createTerrenoAutopilot(geomorph, storm);

  root.add(clipmap.group);
  root.add(bridges.group);
  root.add(water.group);
  root.add(naturalLocations.group);
  root.add(forest.group);
  root.add(ecosystems.group);
  root.add(subterranean.group);
  root.add(storm.group);
  root.add(weather.group);
  scene.add(root);

  root.updateMatrixWorld(true);
  clipmap.group.matrixWorldAutoUpdate = false;
  water.group.matrixWorldAutoUpdate = false;
  forest.group.matrixWorldAutoUpdate = false;
  bridges.group.matrixWorldAutoUpdate = false;

  const initPos = new THREE.Vector3(TERRENO_WORLD.compoundCenterX, 1.5, TERRENO_WORLD.compoundCenterZ);
  clipmap.update(initPos);
  naturalLocations.update(initPos);
  forest.update(initPos);
  ecosystems.update(initPos);
  subterranean.update(initPos);
  weather.update(initPos, 0.016, 0.0);

  let map2dInstance = null;
  let prevElapsed = 0;

  function setTimeOfDay(presetId) {
    if (!ATMOSPHERE_PRESETS[presetId]) return ATMOSPHERE_PRESETS[currentTodId];
    currentTodId = presetId;
    const p = applyAtmospherePresetToUniforms(atmoUniforms, presetId);
    if (weather && weather.captureBaseAtmosphere) weather.captureBaseAtmosphere();
    return p;
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

  function update(cameraPos, elapsed, flashlightState = null, realPhysState = null) {
    const dt = Math.max(0.001, Math.min(0.05, elapsed - prevElapsed));
    prevElapsed = elapsed;
    atmoUniforms.uTime.value = elapsed;

    // Update strict 6m × 6m × 6m Player Dynamic Animation Bubble center every frame!
    if (realPhysState) {
      atmoUniforms.uPlayerBubbleCenter.value.set(
        realPhysState.playerX,
        realPhysState.playerY + 1.0,
        realPhysState.playerZ,
      );
    } else if (cameraPos) {
      atmoUniforms.uPlayerBubbleCenter.value.copy(cameraPos);
    }

    if (flashlightState && flashlightState.enabled) {
      atmoUniforms.uFlashPos.value.copy(flashlightState.position);
      atmoUniforms.uFlashDir.value.copy(flashlightState.direction);
      atmoUniforms.uFlashIntensity.value = flashlightState.intensity ?? 4.2;
    } else {
      atmoUniforms.uFlashIntensity.value = 0.0;
    }

    if (realPhysState) {
      realEngine.update(dt, realPhysState);
    }

    storm.update(cameraPos, dt, elapsed);
    weather.update(cameraPos, dt, elapsed);

    if (!root.visible) return;

    // Deep subterranean optimization: when > 45m underground inside natural caverns, hide surface clipmap/forest/clouds!
    const deepSub = subterranean.isDeepUnderground && subterranean.isDeepUnderground(cameraPos);
    clipmap.group.visible = !deepSub;
    forest.group.visible = !deepSub;
    ecosystems.group.visible = !deepSub;
    water.group.visible = !deepSub;
    naturalLocations.group.visible = !deepSub;
    weather.group.visible = !deepSub;

    if (!deepSub) {
      clipmap.update(cameraPos);
      naturalLocations.update(cameraPos);
      forest.update(cameraPos);
      ecosystems.update(cameraPos);
    }
    subterranean.update(cameraPos);
  }

  function getHeightAtWithLandslides(wx, wz) {
    const h = geomorph.getTerrainHeightAt(wx, wz);
    return storm.hasActiveLandslides() ? (h + storm.getLandslideHeightAddAt(wx, wz)) : h;
  }

  function getOrCreateMap2D(callbacks) {
    if (!map2dInstance) {
      map2dInstance = createTerrenoMap2D(geomorph, callbacks, renderer, forest, ecosystems, weather);
    }
    return map2dInstance;
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
      subterraneanTopASL: TERRENO_WORLD.subterraneanTopASL,
      subterraneanMinASL: TERRENO_WORLD.maxSubterraneanDepthM,
      maxCliffDeg: geomorph.maxCliffDeg || 85,
      roadCount: 0,
      clipmapRings: clipmap.rings.length,
      bridgeCount: bridges.bridges.length,
      fordCount: bridges.fords?.length || 0,
      landformCount: naturalLocations.locations.length,
      naturalLocations: naturalLocations.getStats(),
      geology: {
        totalProcesses: geomorph.landforms.length,
        activeProcessCount: geomorph.geologyState?.activeProcessCount || 0,
        multiOccurrenceFeatures: geomorph.emergentFeatures?.length || 0,
      },
      subterranean: subterranean.getStats ? subterranean.getStats() : null,
      weather: weather.getState(0),
      ecosystems: ecosystems.getStats(),
      animBubbleSizeM: 6.0,
      realEngineActiveTrailCells: realEngine.getActiveTrailCells(),
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
    landforms: naturalLocations.locations,
    emergentFeatures: geomorph.emergentFeatures,
    geologyState: geomorph.geologyState,
    presets: ATMOSPHERE_PRESETS,
    geomorph,
    bridges,
    naturalLocations,
    subterranean,
    realEngine,
    atmoUniforms,
    clipmap,
    water,
    forest,
    ecosystems,
    weather,
    storm,
    autopilot,
    evalMainRiver,
    queryBridgeAt: bridges.queryBridgeAt,
    queryLandformAt: geomorph.queryLandformAt,
    getClosestWaterfallDist: geomorph.getClosestWaterfallDist,
    getHeightAt: getHeightAtWithLandslides,
    getRawHeightAt: geomorph.getHeightAt,
    getTerrainHeightAt: geomorph.getTerrainHeightAt,
    getNormalAt: geomorph.getNormalAt,
    getMacroNormalAt: geomorph.getMacroNormalAt,
    getSoilEcoAt: geomorph.getSoilEcoAt,
    sampleGeoBilinear: geomorph.sampleGeoBilinear,
    getBiomeInfoAt: geomorph.getBiomeInfoAt,
    getActiveEcosystemAt: ecosystems.getActiveEcosystemAt,
    setWeather: weather.setWeather,
    cycleWeather: weather.cycleWeather,
    getWeatherState: weather.getState,
    getLocalColliders: forest.getLocalColliders,
    getCollidersNear: forest.getCollidersNear,
    ensureCollidersAt: forest.ensureCollidersAt,
    setSurfaceSuper,
    setTimeOfDay,
    cycleTimeOfDay,
    getTimeOfDay,
    setVisible,
    update,
    getOrCreateMap2D,
    getStats,
  };
}
