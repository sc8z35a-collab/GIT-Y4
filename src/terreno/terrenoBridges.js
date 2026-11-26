import * as THREE from 'three';
import { NATURAL_FORDS, evalMainRiver, evalFordFactor } from './terrenoConfig.js';

/**
 * TERRENO 6.0 — 100% Roadless Unspoiled Wilderness Crossing System (Option A)
 *
 * All 37 artificial asphalt road bridges have been permanently removed along with ROAD_NETWORK.
 * Instead, vehicles (CAMPER-75, ARMOR-155, KEI-340) & foot explorers cross Kurosugi River via
 * natural shallow cobble river fords (`NATURAL_FORDS`) with REAL ENGINE aquatic wading & buoyancy
 * physics — or traverse canyons aerially via Flagship Airship K-11!
 *
 * Maintains 100% API compatibility with existing callers (`group`, `bridges`, `queryBridgeAt`, `update`).
 */
export function createTerrenoBridges(geomorph) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Natural_Fords_Roadless';

  const fords = NATURAL_FORDS.map((f) => {
    const rv = evalMainRiver(f.z);
    return {
      id: f.id,
      nameJp: f.nameJp,
      kind: 'natural_ford',
      cx: rv.x,
      cz: f.z,
      halfLen: f.halfLen,
      waterY: rv.waterY,
      halfWidth: rv.halfWidth,
    };
  });

  function queryBridgeAt() {
    return null;
  }

  function queryFordAt(wx, wz) {
    const fw = evalFordFactor(wz);
    if (fw <= 0.15) return null;
    const rv = evalMainRiver(wz);
    const dx = Math.abs(wx - rv.x);
    if (dx > rv.halfWidth + 24.0) return null;
    return {
      inFord: true,
      factor: fw,
      waterY: rv.waterY,
      approxDepth: 0.42 + (1.0 - fw) * 0.85,
    };
  }

  if (geomorph && geomorph.setBridgeSystem) {
    geomorph.setBridgeSystem(queryBridgeAt, []);
  }

  return {
    group,
    bridges: [],
    fords,
    queryBridgeAt,
    queryFordAt,
    update() {},
  };
}
