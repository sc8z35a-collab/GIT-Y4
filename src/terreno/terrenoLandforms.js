/**
 * TERRENO 6.0 — Unified Continuous Geomorphology Facade (100 Natural Earth & Subterranean Processes)
 */

import {
  GEOLOGY_PROCESS_CATALOG_100,
  GEOLOGY_PROCESS_CATALOG_62,
  GEOLOGY_BY_INDEX,
  GEOLOGY_BY_ID,
  evalGeologicalProvinces,
  runContinuousGeologyEngine,
} from './terrenoGeologyEngine.js';

export const ALL_LANDFORMS_100 = GEOLOGY_PROCESS_CATALOG_100;
export const ALL_LANDFORMS_62 = GEOLOGY_PROCESS_CATALOG_100;
export const LEGACY_LANDFORMS_22 = GEOLOGY_PROCESS_CATALOG_100.filter((g) => !g.isNewV5 && !g.isNewV6);
export const NEW_LANDFORMS_40 = GEOLOGY_PROCESS_CATALOG_100.filter((g) => g.isNewV5);
export const NEW_LANDFORMS_V6_38 = GEOLOGY_PROCESS_CATALOG_100.filter((g) => g.isNewV6);
export const MAJOR_LANDFORMS_22 = LEGACY_LANDFORMS_22;

export {
  GEOLOGY_PROCESS_CATALOG_100,
  GEOLOGY_PROCESS_CATALOG_62,
  GEOLOGY_BY_INDEX,
  GEOLOGY_BY_ID,
  evalGeologicalProvinces,
  runContinuousGeologyEngine,
};

let activeGeology = null;

export function setActiveGeologyEngineState(geoState) {
  activeGeology = geoState;
}

export function getActiveGeologyEngineState() {
  return activeGeology;
}

export function queryLandformAt(wx, wz, extraMargin = 0) {
  if (!activeGeology) return null;
  const { features, dominantKindId, W, H, minX, minZ, worldW, worldD } = activeGeology;

  const fx = ((wx - minX) / worldW) * (W - 1);
  const fz = ((wz - minZ) / worldD) * (H - 1);
  const ix = Math.max(0, Math.min(W - 1, Math.round(fx)));
  const iz = Math.max(0, Math.min(H - 1, Math.round(fz)));
  const kindIdx = dominantKindId[iz * W + ix];
  if (kindIdx > 0) {
    const meta = GEOLOGY_BY_INDEX.get(kindIdx);
    if (meta) {
      let bestDist = 180;
      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        if (f.kindIndex !== kindIdx) continue;
        const d = Math.hypot(wx - f.x, wz - f.z);
        if (d < bestDist) bestDist = d;
      }
      return {
        landform: { ...meta, radius: 420 },
        dist: bestDist,
      };
    }
  }

  if (extraMargin > 0 && features) {
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const r = f.radius + extraMargin;
      const dx = wx - f.x;
      const dz = wz - f.z;
      if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
      const d = Math.hypot(dx, dz);
      if (d <= r && d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    if (best) return { landform: best, dist: bestDist };
  }
  return null;
}

export function isInsideLandformTreeExclusion() {
  return null;
}

export function getClosestWaterfallDist(wx, wz) {
  if (!activeGeology || !activeGeology.features) return 9999;
  let best = 9999;
  const feats = activeGeology.features;
  for (let i = 0; i < feats.length; i++) {
    const f = feats[i];
    if (!f.hasWaterfall) continue;
    const d = Math.hypot(wx - f.x, wz - f.z);
    if (d < best) best = d;
  }
  return best;
}
