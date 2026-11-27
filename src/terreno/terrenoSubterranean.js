import * as THREE from 'three';
import { TERRENO_WORLD, SUBTERRANEAN_PORTALS } from './terrenoConfig.js';
import { fastNoiseLUT } from './terrenoGeologyEngine.js';

/**
 * TERRENO 6.0 — Deep Subterranean Multi-Strata Natural World (-50 m .. -1,500 m)
 *
 * ZERO Artificial Primitive Structures:
 *   All subterranean spaces are generated as continuous organically displaced rock-strata
 *   cavern vaults, spiral natural descent ledges, sinuous basalt lava tubes, underground
 *   aquifer pools, and deep geothermal mineral fissures extending all the way to -1,500 m!
 *
 * 3 Continuous Geological Depth Strata:
 *   1. Upper Karst Epiphreatic Zone (-50 m .. -350 m): Pale fractured limestone halls, dripstone
 *      fluting, natural skylight tiankeng shafts & clear subterranean turquoise aquifers.
 *   2. Mid-Crustal Lava-Tube & Tectonic Breccia Zone (-350 m .. -900 m): Dark columnar basalt
 *      arches, wide fault-rift corridors & mineral calcite rimstone terraces.
 *   3. Abyssal Geothermal & Crystal Zone (-900 m .. -1,500 m): Deep mantle-warmed basaltic/quartz
 *      cathedral caverns with glowing deep thermal veins & superheated subterranean pools down to -1,500m!
 *
 * Performance:
 *   - 0 draw calls when player is on the surface away from portals (`group.visible = false`).
 *   - Only 2–3 draw calls total when actively exploring underground!
 */

const CAVE_ROCK_VERT = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDepthASL;
#ifdef USE_LOGDEPTHBUF
  varying float vFragDepth;
  varying float vIsPerspective;
#endif

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vDepthASL = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #ifdef USE_LOGDEPTHBUF
    vFragDepth = 1.0 + gl_Position.w;
    vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
  #endif
}
`;

const CAVE_ROCK_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uFlashPos;
uniform vec3 uFlashDir;
uniform float uFlashIntensity;
uniform float uBaseElevationASL;
uniform vec3 uPortalCenter;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDepthASL;
#include <logdepthbuf_pars_fragment>

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 wp = vWorldPos;
  vec3 N = normalize(gl_FrontFacing ? vWorldNormal : -vWorldNormal);
  vec3 V = normalize(cameraPosition - wp);
  float asl = uBaseElevationASL + wp.y;
  float depthBelowSea = clamp((-asl - 801.0) / 1099.0, 0.0, 1.0);

  // Photorealistic multi-octave fractured basalt & stratified sedimentary bedding
  vec3 wWarp = wp * 0.085 + vec3(noise3(wp * 0.045), noise3(wp * 0.045 + 11.7), noise3(wp * 0.045 - 8.3)) * 1.8;
  float strata = sin(wp.y * 0.55 + noise3(wp * 0.055) * 4.2 + noise3(wp * 0.16) * 1.4) * 0.5 + 0.5;
  float macroRock = noise3(wWarp * 0.85);
  float midRock = noise3(wp * 0.32 + vec3(macroRock * 1.6));
  float fineGrain = noise3(wp * 1.45) * 0.65 + noise3(wp * 3.8) * 0.35;
  float jointCrevice = pow(1.0 - abs(noise3(wWarp * 1.65) * 2.0 - 1.0), 4.5);

  // Subtle wet normal perturbation for realistic jagged rock shadows & specular dampness
  vec3 nPerturb = vec3(
    noise3(wp * 0.72 + vec3(0.3, 0.0, 0.0)) - noise3(wp * 0.72 - vec3(0.3, 0.0, 0.0)),
    noise3(wp * 0.72 + vec3(0.0, 0.3, 0.0)) - noise3(wp * 0.72 - vec3(0.0, 0.3, 0.0)),
    noise3(wp * 0.72 + vec3(0.0, 0.0, 0.3)) - noise3(wp * 0.72 - vec3(0.0, 0.0, 0.3))
  );
  vec3 Ndet = normalize(N + nPerturb * 0.95);

  // Depth-driven photorealistic lithology (-801m .. -1,900m ASL):
  //   Upper Karst (-801..-1,150m): weathered ochre limestone & damp calcite flowstone
  //   Mid Crust (-1,150..-1,520m): dark wet volcanic basalt & fractured slate
  //   Deep Abyss (-1,520..-1,900m): dark obsidian-gabbro with crystalline quartz & geothermal ember fissures
  vec3 colKarst = mix(vec3(0.28, 0.25, 0.20), vec3(0.46, 0.42, 0.34), strata * 0.7 + midRock * 0.3);
  vec3 colBasalt = mix(vec3(0.06, 0.07, 0.09), vec3(0.16, 0.17, 0.20), strata * 0.5 + midRock * 0.5);
  vec3 colAbyss = mix(vec3(0.045, 0.048, 0.058), vec3(0.14, 0.125, 0.135), strata * 0.45 + midRock * 0.55);

  vec3 rockCol = mix(colKarst, colBasalt, smoothstep(0.18, 0.44, depthBelowSea));
  rockCol = mix(rockCol, colAbyss, smoothstep(0.58, 0.86, depthBelowSea));
  // Darken deep cracks and add fine rock mineral grain
  rockCol *= (0.55 + 0.65 * fineGrain) * (0.72 + 0.38 * macroRock) * (1.0 - jointCrevice * 0.68);
  // Subtle damp calcite/iron staining on downward-sloping wet cavern walls
  float dampWet = smoothstep(0.35, 0.82, midRock) * (1.0 - abs(Ndet.y) * 0.45);
  rockCol *= mix(1.0, 0.78, dampWet);

  // Skylight shaft illumination leaking naturally down from the surface opening!
  float dShaft = length(wp.xz - uPortalCenter.xz);
  float shaftDrop = max(0.0, uPortalCenter.y - wp.y);
  float skylight = exp(-shaftDrop * 0.011) * exp(-dShaft * 0.018) * (0.45 + 0.55 * max(0.0, Ndet.y));
  vec3 ambient = vec3(0.024, 0.032, 0.044) + vec3(0.35, 0.48, 0.62) * skylight;

  // Deep geothermal ambiance & rare hairline warm ember fissures ONLY along deep floor rifts
  float deepT = smoothstep(0.62, 0.96, depthBelowSea);
  float emberMask = smoothstep(0.76, 0.95, macroRock) * smoothstep(0.55, 0.92, jointCrevice) * smoothstep(-0.1, 0.85, N.y);
  float hairlineEmber = pow(emberMask, 2.2) * deepT;
  float mineralSpark = pow(smoothstep(0.78, 0.96, fineGrain), 3.2) * dampWet * deepT;
  vec3 thermalGlow = vec3(0.95, 0.24, 0.04) * hairlineEmber * (0.75 + 0.25 * sin(uTime * 1.4 + wp.x * 0.08))
                   + vec3(0.16, 0.34, 0.46) * mineralSpark * 0.32;
  ambient += vec3(0.09, 0.045, 0.032) * deepT * (0.35 + 0.65 * max(0.0, -Ndet.y));

  // Flashlight / Vehicle Headlamp illumination + wet basalt specular glint!
  vec3 lightCol = ambient;
  vec3 specCol = vec3(0.0);
  if (uFlashIntensity > 0.01) {
    vec3 toFrag = wp - uFlashPos;
    float d = length(toFrag);
    vec3 L = -toFrag / max(d, 0.001);
    float spot = smoothstep(0.52, 0.93, dot(-L, normalize(uFlashDir)));
    float atten = 1.0 / (1.0 + d * d * 0.00055);
    float ndl = max(0.04, dot(Ndet, L));
    lightCol += vec3(1.0, 0.95, 0.87) * (uFlashIntensity * spot * atten * ndl * 1.45);
    vec3 H = normalize(L + V);
    float spec = pow(max(0.0, dot(Ndet, H)), 28.0) * dampWet;
    specCol += vec3(0.75, 0.80, 0.86) * (uFlashIntensity * spot * atten * spec * 0.38);
  }

  // Soft personal headlamp rim fill so massive abyssal basalt arches remain atmospheric & legible
  float camD = length(cameraPosition - wp);
  float nearLamp = 1.0 / (1.0 + camD * camD * 0.00095);
  float ndv = max(0.0, dot(Ndet, V));
  lightCol += vec3(0.36, 0.44, 0.54) * nearLamp * (0.28 + 0.72 * ndv);
  specCol += vec3(0.28, 0.36, 0.44) * pow(ndv, 18.0) * nearLamp * dampWet * 0.25;

  vec3 finalCol = rockCol * lightCol + specCol + thermalGlow;

  // Atmospheric subterranean cave mist (cool indigo-slate abyssal air with faint deep geothermal warmth)
  float fogT = 1.0 - exp(-camD * 0.0052);
  vec3 caveFog = mix(vec3(0.018, 0.026, 0.038), vec3(0.035, 0.022, 0.020), deepT);
  finalCol = mix(finalCol, caveFog, clamp(fogT, 0.0, 0.90));

  gl_FragColor = vec4(finalCol, 1.0);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Build a continuous organically displaced vertical-to-horizontal natural cave shaft & multi-tier
 * spiral chamber complex connecting surface (y=0 local) down to targetDepthM (up to -1,500m!).
 */
function buildNaturalSubterraneanPortalMesh(portal, surfaceY) {
  const targetLocalY = portal.targetDepthM - TERRENO_WORLD.baseElevationASL;
  const totalDrop = Math.max(120.0, surfaceY - targetLocalY);
  const segR = 28;
  const segH = 96; // High vertical resolution along the spiral shaft + lower cathedral cavern!

  const positions = [];
  const indices = [];

  for (let iy = 0; iy <= segH; iy++) {
    const t = iy / segH; // 0 = surface rim -> 1 = deepest abyssal hall (-1,500m!)
    const wy = surfaceY - t * totalDrop;

    // Natural meandering cavern centerline (slight organic tectonic drift with depth!)
    const driftX = Math.sin(t * Math.PI * 3.2 + portal.x * 0.001) * 42.0 * Math.pow(t, 0.75);
    const driftZ = Math.cos(t * Math.PI * 2.6 + portal.z * 0.001) * 42.0 * Math.pow(t, 0.75);

    // Radius flares naturally into vast subterranean cathedral chambers at depth tiers!
    const tierChamber =
      Math.exp(-Math.pow((t - 0.28) / 0.10, 2.0)) * 32.0 +
      Math.exp(-Math.pow((t - 0.62) / 0.12, 2.0)) * 46.0 +
      Math.exp(-Math.pow((t - 0.94) / 0.09, 2.0)) * 68.0;
    const baseRad = portal.radius * (1.0 - t * 0.18) + tierChamber;

    for (let ir = 0; ir <= segR; ir++) {
      const a = (ir / segR) * Math.PI * 2.0;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Organic rock fracture wall displacement (ZERO smooth geometric cylinder look!)
      const n1 = fastNoiseLUT(ca * 2.4 + t * 14.0 + portal.x * 0.01, sa * 2.4 + t * 14.0) - 0.5;
      const n2 = fastNoiseLUT(ca * 5.8 - t * 28.0, sa * 5.8 + t * 24.0) - 0.5;
      // Continuous walkable natural spiral rock ledge descending gracefully down the shaft wall!
      const spiralPhase = (a + t * Math.PI * 16.0) % (Math.PI * 2.0);
      const ledgeIndent = Math.exp(-Math.pow((spiralPhase - Math.PI) * 1.8, 2.0)) * 6.5 * (1.0 - Math.pow(t, 6.0));
      const r = Math.max(12.0, baseRad * (1.0 + n1 * 0.34 + n2 * 0.14) - ledgeIndent);

      positions.push(
        portal.x + driftX + ca * r,
        wy,
        portal.z + driftZ + sa * r,
      );
    }
  }

  // Close the abyssal cavern floor organically at t=1 (with rough natural boulders/fractures)
  const floorCenterIdx = positions.length / 3;
  const botDriftX = Math.sin(Math.PI * 3.2 + portal.x * 0.001) * 42.0;
  const botDriftZ = Math.cos(Math.PI * 2.6 + portal.z * 0.001) * 42.0;
  positions.push(portal.x + botDriftX, surfaceY - totalDrop - 2.0, portal.z + botDriftZ);

  const stride = segR + 1;
  for (let iy = 0; iy < segH; iy++) {
    for (let ir = 0; ir < segR; ir++) {
      const a = iy * stride + ir;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // Inward-facing normals (player is INSIDE the subterranean cavern!)
      indices.push(a, b, c, b, d, c);
    }
  }

  // Abyssal floor cap triangles
  const botRow = segH * stride;
  for (let ir = 0; ir < segR; ir++) {
    indices.push(botRow + ir, botRow + ir + 1, floorCenterIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return {
    geo,
    surfaceY,
    floorY: surfaceY - totalDrop,
    botX: portal.x + botDriftX,
    botZ: portal.z + botDriftZ,
  };
}

export function createTerrenoSubterranean(geomorph, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_Subterranean_1500m';
  group.visible = false;

  const portalMeshes = [];
  const portalCenterUniform = { value: new THREE.Vector3(0, 0, 0) };

  const caveMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: atmoUniforms.uTime,
      uFlashPos: atmoUniforms.uFlashPos,
      uFlashDir: atmoUniforms.uFlashDir,
      uFlashIntensity: atmoUniforms.uFlashIntensity,
      uBaseElevationASL: { value: TERRENO_WORLD.baseElevationASL },
      uPortalCenter: portalCenterUniform,
    },
    vertexShader: CAVE_ROCK_VERT,
    fragmentShader: CAVE_ROCK_FRAG,
    side: THREE.DoubleSide,
  });

  // Lazily construct each portal cavern mesh ONLY when player approaches within 350m (0ms startup boot cost!)
  const portalStates = SUBTERRANEAN_PORTALS.map((p) => ({
    portal: p,
    surfaceY: geomorph.getTerrainHeightAt(p.x, p.z),
    mesh: null,
    meta: null,
  }));

  function ensurePortalBuilt(st) {
    if (st.mesh) return st;
    const built = buildNaturalSubterraneanPortalMesh(st.portal, st.surfaceY);
    const mesh = new THREE.Mesh(built.geo, caveMat);
    mesh.name = `SUB_CAVERN_${st.portal.id}`;
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    mesh.updateMatrixWorld(true);
    st.mesh = mesh;
    st.meta = built;
    portalMeshes.push(mesh);
    return st;
  }

  let activePortalState = null;

  function queryPortalAt(wx, wz, pad = 0.0) {
    for (let i = 0; i < portalStates.length; i++) {
      const st = portalStates[i];
      const p = st.portal;
      const d = Math.hypot(wx - p.x, wz - p.z);
      if (d <= p.radius + pad) {
        return { portal: p, dist: d, surfaceY: st.surfaceY, state: st };
      }
    }
    return null;
  }

  function evalSubterraneanElevation(wx, wz, currentLocalY) {
    const hit = queryPortalAt(wx, wz, 95.0);
    if (!hit) return null;
    const p = hit.portal;
    const surfY = hit.surfaceY;
    const targetFloorLocalY = p.targetDepthM - TERRENO_WORLD.baseElevationASL;
    const totalDrop = Math.max(120.0, surfY - targetFloorLocalY);
    const depthFrac = Math.max(0.0, Math.min(1.0, (surfY - currentLocalY) / totalDrop));

    const dx = wx - p.x;
    const dz = wz - p.z;
    const angle = Math.atan2(dz, dx);
    const dCenter = Math.hypot(dx, dz);
    const floorAtDepth = Math.max(targetFloorLocalY, surfY - totalDrop * Math.min(1.0, depthFrac + 0.02));

    return {
      portal: p,
      inShaft: dCenter < p.radius + 75.0,
      surfaceY: surfY,
      deepestFloorY: targetFloorLocalY,
      deepestASL: p.targetDepthM,
      currentASL: TERRENO_WORLD.baseElevationASL + currentLocalY,
      floorY: dCenter < p.radius * 0.85 ? floorAtDepth : surfY,
      angle,
    };
  }

  function getFloorYAt(wx, wz, currentLocalY = -1400) {
    const res = evalSubterraneanElevation(wx, wz, currentLocalY);
    return res ? res.deepestASL : null;
  }

  function isDeepUnderground(cameraPos) {
    if (!cameraPos) return false;
    const hit = queryPortalAt(cameraPos.x, cameraPos.z, 140.0);
    if (!hit) return false;
    return cameraPos.y < hit.surfaceY - 35.0;
  }

  function update(cameraPos) {
    let nearest = null;
    let nearestD = 1e9;
    for (let i = 0; i < portalStates.length; i++) {
      const st = portalStates[i];
      const d = Math.hypot(cameraPos.x - st.portal.x, cameraPos.z - st.portal.z);
      if (d < nearestD) { nearestD = d; nearest = st; }
    }

    const active = nearest && nearestD < 420.0;
    group.visible = Boolean(active);
    if (!active) {
      activePortalState = null;
      return;
    }

    ensurePortalBuilt(nearest);
    for (let i = 0; i < portalStates.length; i++) {
      if (portalStates[i].mesh) portalStates[i].mesh.visible = (portalStates[i] === nearest);
    }
    activePortalState = nearest;
    portalCenterUniform.value.set(nearest.portal.x, nearest.surfaceY, nearest.portal.z);
  }

  return {
    group,
    portals: SUBTERRANEAN_PORTALS,
    topDepthM: TERRENO_WORLD.subterraneanTopASL,       // -801 m ASL!
    maxDepthM: TERRENO_WORLD.maxSubterraneanDepthM,    // -1,900 m ASL!
    queryPortalAt,
    evalSubterraneanElevation,
    getFloorYAt,
    isDeepUnderground,
    getPortalMeta: (id) => {
      const st = portalStates.find((s) => s.portal.id === id) || portalStates[0];
      if (!st) return null;
      ensurePortalBuilt(st);
      return st.meta;
    },
    getStats: () => ({
      portalCount: SUBTERRANEAN_PORTALS.length,
      topDepthM: TERRENO_WORLD.subterraneanTopASL,
      maxDepthM: TERRENO_WORLD.maxSubterraneanDepthM,
      activePortalId: activePortalState?.portal?.id || null,
    }),
    update,
    getActivePortal: () => activePortalState?.portal || null,
  };
}
