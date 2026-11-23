import * as THREE from 'three';
import {
  TERRENO_WORLD,
  TERRENO_LANDMARKS,
} from './terrenoConfig.js';
import { VILLAGE, VILLAGE_HOUSES } from '../villageData.js';

/**
 * TERRENO High-Precision Real-Time 3D Topographic Map Renderer (60 km × 60 km = 3,600 km²).
 * Renders directly on the existing WebGL2 renderer (with full logarithmicDepthBuffer compatibility)
 * using the live 1024×1024 RGBA32F Geomorphology Atlas + Horizon/Sky-View AO Atlas.
 *
 * Features:
 *   - 288×288 real-time 3D countryside relief slab (150 × 150 diorama) + geological plinth skirt
 *   - Seamless 6-biome non-mountainous coloration + 15m/60m anti-aliased contours + 5 km metric grid
 *   - Animated 60 km meandering river + ALL 21 natural terrain-conforming 3D road ribbons
 *   - Live 3D glowing autonomous route paths for both CAMPER-75 and ARMOR-155
 *   - Analytical heightfield raymarching for tap-anywhere free-destination autonomous routing (NO player teleport!)
 */

const MAP_SCALE = 0.0025;        // 400 m world = 1.0 map unit -> 150 × 150 diorama slab (60 km × 60 km)
const MAP_Y_SCALE = 0.048;       // Crisp sculpted relief for rolling hills, plateaus, & river plains
const MAP_CENTER_Z = (TERRENO_WORLD.minZ + TERRENO_WORLD.maxZ) * 0.5; // 0
const HALF_W = (TERRENO_WORLD.width * 0.5) * MAP_SCALE;   // 75.0
const HALF_D = (TERRENO_WORLD.depth * 0.5) * MAP_SCALE;   // 75.0
const PLINTH_BASE_Y = -5.5;

export function worldToMap3D(wx, wz, wy = 0) {
  return {
    x: wx * MAP_SCALE,
    y: wy * MAP_Y_SCALE,
    z: (wz - MAP_CENTER_Z) * MAP_SCALE,
  };
}

export function map3DToWorld(mx, mz) {
  return {
    x: mx / MAP_SCALE,
    z: mz / MAP_SCALE + MAP_CENTER_Z,
  };
}

const TERRAIN_MAP_VERT = /* glsl */ `
  uniform float uInvMapScale;
  uniform float uInvMapYScale;
  uniform float uMapCenterZ;

  varying vec2 vAtlasUv;
  varying vec3 vMapPos;
  varying vec3 vWorldXZ_Y;
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    varying float vIsPerspective;
  #endif

  void main() {
    vAtlasUv = uv;
    vMapPos = position;
    vWorldXZ_Y = vec3(
      position.x * uInvMapScale,
      position.y * uInvMapYScale,
      position.z * uInvMapScale + uMapCenterZ
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
  }
`;

const TERRAIN_MAP_FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uGeoTex;
  uniform sampler2D uHorizonTex;
  uniform vec2 uAtlasSize;
  uniform float uBaseASL;
  uniform float uTime;
  uniform vec3 uCamPos;
  uniform vec3 uWorldBounds; // width, depth, minZ
  uniform vec2 uVillageCenter;

  varying vec2 vAtlasUv;
  varying vec3 vMapPos;
  varying vec3 vWorldXZ_Y;
  #include <logdepthbuf_pars_fragment>

  vec4 sampleGeo(vec2 uv) {
    vec2 f = clamp(uv, 0.0, 1.0) * (uAtlasSize - 1.0);
    vec2 i0 = floor(f);
    vec2 frac = f - i0;
    vec2 inv = 1.0 / uAtlasSize;
    vec2 p00 = (i0 + 0.5) * inv;
    vec2 p10 = (min(i0 + vec2(1.0, 0.0), uAtlasSize - 1.0) + 0.5) * inv;
    vec2 p01 = (min(i0 + vec2(0.0, 1.0), uAtlasSize - 1.0) + 0.5) * inv;
    vec2 p11 = (min(i0 + vec2(1.0, 1.0), uAtlasSize - 1.0) + 0.5) * inv;
    vec4 c00 = texture2D(uGeoTex, p00);
    vec4 c10 = texture2D(uGeoTex, p10);
    vec4 c01 = texture2D(uGeoTex, p01);
    vec4 c11 = texture2D(uGeoTex, p11);
    return mix(mix(c00, c10, frac.x), mix(c01, c11, frac.x), frac.y);
  }

  float evalRiverCenterX(float z) {
    return 340.0
      + sin(z * 0.00016 + 0.18) * 2800.0
      + sin(z * 0.00042 - 0.55) * 950.0
      + cos(z * 0.00009 + 0.35) * 1150.0
      - 1205.0 * exp(-(z * z) / (2600.0 * 2600.0));
  }

  float evalRiverHalfW(float z) {
    float t = clamp((z - uWorldBounds.z) / uWorldBounds.y, 0.0, 1.0);
    return 20.0 + 48.0 * pow(t, 0.90) + sin(z * 0.0008) * 6.0;
  }

  float sstepQ(float e0, float e1, float x) {
    float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  vec3 countrysideBiomeAlbedo(float wx, float wz, float asl, float slope, float wetness) {
    float uX = wx + sin(wz * 0.00014 + 0.6) * 3600.0 + cos((wx + wz) * 0.00009) * 1900.0;
    float uZ = wz + cos(wx * 0.00013 - 0.8) * 3600.0 + sin((wx - wz) * 0.00008) * 1900.0;

    float dxRiv = abs(wx - evalRiverCenterX(wz));
    float dCenter = length(vec2(wx - 400.0, wz - 600.0));

    float wValley = exp(-(dxRiv * dxRiv) / (6800.0 * 6800.0)) * 0.95
      + exp(-(dCenter * dCenter) / (6200.0 * 6200.0)) * 0.85 + 0.14;
    float wHills = sstepQ(2800.0, -14500.0, uX) * sstepQ(13500.0, -7500.0, uZ);
    float wPlateau = sstepQ(-1800.0, -17500.0, uZ) * sstepQ(-15000.0, 9500.0, uX);
    float wWetland = sstepQ(2600.0, 15500.0, uX) * sstepQ(-18500.0, -3500.0, uZ) * sstepQ(20500.0, 6500.0, uZ);
    float wMeadow = sstepQ(10500.0, -8500.0, uX) * sstepQ(2000.0, 15500.0, uZ) * sstepQ(27500.0, 15000.0, uZ);
    float wSouth = sstepQ(11500.0, 23000.0, uZ);
    float invSum = 1.0 / (wValley + wHills + wPlateau + wWetland + wMeadow + wSouth + 1e-5);

    vec3 cValley  = vec3(0.14, 0.34, 0.21);
    vec3 cHills   = vec3(0.24, 0.46, 0.22);
    vec3 cPlateau = vec3(0.32, 0.42, 0.20);
    vec3 cWetland = vec3(0.14, 0.34, 0.31);
    vec3 cMeadow  = vec3(0.46, 0.48, 0.24);
    vec3 cSouth   = vec3(0.34, 0.44, 0.28);

    vec3 col = (cValley * wValley + cHills * wHills + cPlateau * wPlateau
      + cWetland * wWetland + cMeadow * wMeadow + cSouth * wSouth) * invSum;

    // Gentle sunlit elevation warmth across rolling countryside (EL +90m .. +240m ASL)
    float elevT = clamp((asl - 95.0) / 145.0, 0.0, 1.0);
    col += vec3(0.06, 0.05, 0.03) * elevT;

    // Gentle soil warmth on undulating hill flanks (zero harsh granite cliffs)
    col = mix(col, vec3(0.38, 0.36, 0.27), smoothstep(0.18, 0.40, slope) * 0.35);

    // Rich wetland / stream bank moisture tint
    col = mix(col, col * vec3(0.76, 0.94, 0.88), clamp(wetness * 0.40, 0.0, 0.40));
    return col;
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec4 gC = sampleGeo(vAtlasUv);
    float hC = gC.r;
    float wetness = gC.g;
    float roadMask = gC.a;
    float asl = uBaseASL + hC;

    vec2 du = vec2(1.0 / (uAtlasSize.x - 1.0), 0.0);
    vec2 dv = vec2(0.0, 1.0 / (uAtlasSize.y - 1.0));
    float hL = sampleGeo(vAtlasUv - du).r;
    float hR = sampleGeo(vAtlasUv + du).r;
    float hD = sampleGeo(vAtlasUv - dv).r;
    float hU = sampleGeo(vAtlasUv + dv).r;

    float cellX = uWorldBounds.x / (uAtlasSize.x - 1.0);
    float cellZ = uWorldBounds.y / (uAtlasSize.y - 1.0);
    float gx = (hR - hL) / (2.0 * cellX);
    float gz = (hU - hD) / (2.0 * cellZ);
    float slope = length(vec2(gx, gz));
    vec3 N = normalize(vec3(-gx * 3.2, 1.0, -gz * 3.2));

    vec4 hor = texture2D(uHorizonTex, vAtlasUv);
    float skyAO = 0.66 + 0.34 * hor.b;
    float horShade = mix(0.80, 1.0, 1.0 - hor.g * 0.40);

    float wx = vWorldXZ_Y.x;
    float wz = vWorldXZ_Y.z;
    vec3 albedo = countrysideBiomeAlbedo(wx, wz, asl, slope, wetness);

    // 60 km Main River & gentle streams
    float distRiv = abs(wx - evalRiverCenterX(wz));
    float rivHW = evalRiverHalfW(wz);
    float isMainRiver = 1.0 - smoothstep(rivHW * 0.72, rivHW * 1.95, distRiv);
    float isStream = smoothstep(0.76, 0.92, wetness) * 0.58;
    float waterFactor = max(isMainRiver, isStream);

    float distComp = length(vec2(wx - 1.5, wz - 3.5));
    float distVill = length(vec2(wx, wz) - uVillageCenter);
    float isVillagePad = 1.0 - smoothstep(46.0, 82.0, distVill);
    float isRoad = smoothstep(0.24, 0.70, roadMask) * smoothstep(32.0, 62.0, distComp) * (1.0 - isVillagePad) * (1.0 - waterFactor);

    vec3 sunDir = normalize(vec3(-0.56, 0.68, -0.47));
    vec3 V = normalize(uCamPos - vMapPos);
    float ndl = max(dot(N, sunDir), 0.0);
    float wrap = max(0.0, (dot(N, sunDir) + 0.38) / 1.38);

    vec3 sunCol = vec3(1.16, 1.11, 0.98);
    vec3 skyFill = mix(vec3(0.12, 0.18, 0.25), vec3(0.26, 0.38, 0.52), N.y * 0.5 + 0.5);
    vec3 lit = albedo * (sunCol * (ndl * 0.88 + wrap * 0.30) * horShade + skyFill * skyAO * 0.85);

    if (isVillagePad > 0.01) {
      lit = mix(lit, vec3(0.32, 0.50, 0.28), isVillagePad * 0.55);
    }

    vec3 H = normalize(sunDir + V);
    if (waterFactor > 0.01) {
      float wave = sin(wz * 0.025 - uTime * 2.2 + wx * 0.018) * 0.5 + 0.5;
      vec3 riverCol = mix(vec3(0.07, 0.42, 0.56), vec3(0.16, 0.72, 0.82), 0.45 + 0.45 * wave);
      float fresnel = pow(1.0 - max(dot(vec3(0.0, 1.0, 0.0), V), 0.0), 3.0);
      float wSpec = pow(max(dot(vec3(0.0, 1.0, 0.0), H), 0.0), 38.0) * (0.45 + 0.35 * wave);
      riverCol += vec3(0.55, 0.92, 1.0) * (fresnel * 0.36 + wSpec * 0.60);
      lit = mix(lit, riverCol, waterFactor * 0.90);
    }

    if (isRoad > 0.01) {
      lit = mix(lit, vec3(0.95, 0.80, 0.46), isRoad * 0.78);
    }

    // Crisp anti-aliased Topographic Contours (15m minor + 50m major)
    float dfAsl = max(fwidth(asl), 0.28);
    float c15 = abs(fract(asl / 15.0 + 0.5) - 0.5) * 15.0 / dfAsl;
    float line15 = 1.0 - smoothstep(0.32, 0.95, c15);
    float c50 = abs(fract(asl / 50.0 + 0.5) - 0.5) * 50.0 / dfAsl;
    float line50 = 1.0 - smoothstep(0.38, 1.05, c50);

    float contourFade = (1.0 - waterFactor * 0.85) * (1.0 - isRoad * 0.5);
    lit = mix(lit, lit * 0.76 + vec3(0.06, 0.05, 0.04), line15 * 0.22 * contourFade);
    lit = mix(lit, vec3(0.92, 0.88, 0.74), line50 * 0.32 * contourFade);

    // Hairline 5 km Metric Grid draped over 60 km × 60 km topography
    vec2 kmCoord = vec2(wx, wz) * 0.0002;
    vec2 kmDist = abs(fract(kmCoord + 0.5) - 0.5) / max(fwidth(kmCoord), vec2(0.0004));
    float kmLine = 1.0 - smoothstep(0.55, 1.45, min(kmDist.x, kmDist.y));
    lit = mix(lit, vec3(0.75, 0.88, 1.0), kmLine * 0.14);

    float distCam = length(uCamPos - vMapPos);
    float fogT = 1.0 - exp(-max(0.0, distCam - 140.0) * 0.0018);
    lit = mix(lit, vec3(0.045, 0.075, 0.115), clamp(fogT, 0.0, 0.45));

    float edgeDist = min(min(vAtlasUv.x, 1.0 - vAtlasUv.x), min(vAtlasUv.y, 1.0 - vAtlasUv.y));
    float borderGlow = 1.0 - smoothstep(0.0, 0.0045, edgeDist);
    lit = mix(lit, vec3(0.32, 0.68, 0.82), borderGlow * 0.55);

    lit *= 1.18;
    lit = clamp((lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14), 0.0, 1.0);
    lit = pow(lit, vec3(1.0 / 1.12));

    gl_FragColor = vec4(lit, 1.0);
  }
`;

const PLINTH_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    varying float vIsPerspective;
  #endif
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
  }
`;

const PLINTH_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNormal;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float t = clamp((vPos.y - (-5.5)) / 12.0, 0.0, 1.0);
    vec3 base = mix(vec3(0.03, 0.045, 0.068), vec3(0.085, 0.11, 0.145), t);
    float strata = 1.0 - smoothstep(0.0, 0.08, abs(fract(vPos.y * 0.9) - 0.5));
    base += vec3(0.04, 0.06, 0.08) * strata * 0.5;
    float bottomRim = 1.0 - smoothstep(0.0, 0.30, vPos.y - (-5.5));
    base = mix(base, vec3(0.18, 0.45, 0.58), bottomRim * 0.55);
    float sideShade = 0.72 + 0.28 * abs(vNormal.x);
    gl_FragColor = vec4(base * sideShade, 1.0);
  }
`;

function buildGeologicalPlinth(geomorph, segX, segZ) {
  const positions = [];
  const normals = [];
  const indices = [];
  let vCursor = 0;

  const sampleEdgeY = (wx, wz) => geomorph.sampleGeoBilinear(wx, wz).hMacro * MAP_Y_SCALE;

  const pushWall = (pts, nx, nz) => {
    const startIdx = vCursor;
    for (let i = 0; i < pts.length; i++) {
      const [mx, my, mz] = pts[i];
      positions.push(mx, my, mz);
      normals.push(nx, 0, nz);
      positions.push(mx, PLINTH_BASE_Y, mz);
      normals.push(nx, 0, nz);
      vCursor += 2;
      if (i > 0) {
        const a = startIdx + (i - 1) * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, c, b, d);
      }
    }
  };

  const west = [];
  for (let iz = 0; iz <= segZ; iz++) {
    const wz = TERRENO_WORLD.minZ + (iz / segZ) * TERRENO_WORLD.depth;
    west.push([-HALF_W, sampleEdgeY(TERRENO_WORLD.minX, wz), (wz - MAP_CENTER_Z) * MAP_SCALE]);
  }
  pushWall(west, -1, 0);

  const east = [];
  for (let iz = segZ; iz >= 0; iz--) {
    const wz = TERRENO_WORLD.minZ + (iz / segZ) * TERRENO_WORLD.depth;
    east.push([HALF_W, sampleEdgeY(TERRENO_WORLD.maxX, wz), (wz - MAP_CENTER_Z) * MAP_SCALE]);
  }
  pushWall(east, 1, 0);

  const north = [];
  for (let ix = segX; ix >= 0; ix--) {
    const wx = TERRENO_WORLD.minX + (ix / segX) * TERRENO_WORLD.width;
    north.push([wx * MAP_SCALE, sampleEdgeY(wx, TERRENO_WORLD.minZ), -HALF_D]);
  }
  pushWall(north, 0, -1);

  const south = [];
  for (let ix = 0; ix <= segX; ix++) {
    const wx = TERRENO_WORLD.minX + (ix / segX) * TERRENO_WORLD.width;
    south.push([wx * MAP_SCALE, sampleEdgeY(wx, TERRENO_WORLD.maxZ), HALF_D]);
  }
  pushWall(south, 0, 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    vertexShader: PLINTH_VERT,
    fragmentShader: PLINTH_FRAG,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function createTerrenoMap3D(geomorph) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b12);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 1600);

  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x16202c, 1.15);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
  keyLight.position.set(-70, 120, -60);
  scene.add(keyLight);

  // =========================================================================
  // 1. HIGH-PRECISION 288 × 288 3D RELIEF TERRAIN MESH (60 km × 60 km)
  // =========================================================================
  const SEG_X = 288;
  const SEG_Z = 288;
  const terrainGeo = new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2, SEG_X, SEG_Z);
  terrainGeo.rotateX(-Math.PI * 0.5);

  const posAttr = terrainGeo.attributes.position;
  const uvAttr = terrainGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const mx = posAttr.getX(i);
    const mz = posAttr.getZ(i);
    const wx = mx / MAP_SCALE;
    const wz = mz / MAP_SCALE + MAP_CENTER_Z;
    const u = (wx - TERRENO_WORLD.minX) / TERRENO_WORLD.width;
    const v = (wz - TERRENO_WORLD.minZ) / TERRENO_WORLD.depth;
    uvAttr.setXY(i, u, v);
    const h = geomorph.sampleGeoBilinear(wx, wz).hMacro;
    posAttr.setY(i, h * MAP_Y_SCALE);
  }
  posAttr.needsUpdate = true;
  uvAttr.needsUpdate = true;

  const terrainUniforms = {
    uGeoTex: { value: geomorph.geoTexture },
    uHorizonTex: { value: geomorph.horizonTexture },
    uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
    uBaseASL: { value: TERRENO_WORLD.baseElevationASL },
    uTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uWorldBounds: { value: new THREE.Vector3(TERRENO_WORLD.width, TERRENO_WORLD.depth, TERRENO_WORLD.minZ) },
    uInvMapScale: { value: 1.0 / MAP_SCALE },
    uInvMapYScale: { value: 1.0 / MAP_Y_SCALE },
    uMapCenterZ: { value: MAP_CENTER_Z },
    uVillageCenter: { value: new THREE.Vector2(TERRENO_WORLD.villageCenterX, TERRENO_WORLD.villageCenterZ) },
  };

  const terrainMat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_MAP_VERT,
    fragmentShader: TERRAIN_MAP_FRAG,
    uniforms: terrainUniforms,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.frustumCulled = false;
  scene.add(terrainMesh);

  // =========================================================================
  // 2. GEOLOGICAL CUTAWAY PLINTH SKIRT + FLOATING BASE FRAME
  // =========================================================================
  const plinthMesh = buildGeologicalPlinth(geomorph, 144, 144);
  scene.add(plinthMesh);

  const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF_W * 2 + 0.16, 0.08, HALF_D * 2 + 0.16));
  const frameLine = new THREE.LineSegments(
    frameGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.34 })
  );
  frameLine.position.y = PLINTH_BASE_Y;
  scene.add(frameLine);

  // =========================================================================
  // 3. ALL 21 NATURAL TERRAIN-CONFORMING 3D ROAD RIBBONS
  // =========================================================================
  const roads = geomorph.roadPolylines || (geomorph.roadDense ? [{ pts: geomorph.roadDense }] : []);
  const mainRoadMat = new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.88 });
  const branchRoadMat = new THREE.LineBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.72 });
  for (let rIdx = 0; rIdx < roads.length; rIdx++) {
    const rpts = roads[rIdx].pts;
    if (!rpts || rpts.length < 2) continue;
    const roadPts3 = [];
    const stride = rpts.length > 400 ? 3 : 2;
    for (let i = 0; i < rpts.length; i += stride) {
      const [rx, rz] = rpts[i];
      const ry = geomorph.sampleGeoBilinear(rx, rz).hMacro;
      const p = worldToMap3D(rx, rz, ry);
      roadPts3.push(new THREE.Vector3(p.x, p.y + 0.22, p.z));
    }
    const lastPt = rpts[rpts.length - 1];
    const lastP = worldToMap3D(lastPt[0], lastPt[1], geomorph.sampleGeoBilinear(lastPt[0], lastPt[1]).hMacro);
    roadPts3.push(new THREE.Vector3(lastP.x, lastP.y + 0.22, lastP.z));
    const roadGeo = new THREE.BufferGeometry().setFromPoints(roadPts3);
    scene.add(new THREE.Line(roadGeo, rIdx === 0 ? mainRoadMat : branchRoadMat));
  }

  // =========================================================================
  // 4. LIVE 3D AUTONOMOUS ROUTE LINES & DESTINATION PINS (CAMPER-75 & ARMOR-155)
  // =========================================================================
  function createRouteViz(colorHex) {
    const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    line.visible = false;
    scene.add(line);

    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 2.2, 8),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    pin.rotation.x = Math.PI;
    pin.visible = false;
    scene.add(pin);
    return { line, pin, lastSig: '' };
  }
  const routeViz = {
    camper: createRouteViz(0x38bdf8),
    armor: createRouteViz(0x34d399),
    k11: createRouteViz(0xc084fc),
  };

  function updateRouteViz(key, pts) {
    const viz = routeViz[key];
    if (!viz) return;
    if (!pts || pts.length < 2) {
      viz.line.visible = false;
      viz.pin.visible = false;
      viz.lastSig = '';
      return;
    }
    const last = pts[pts.length - 1];
    const sig = `${pts.length}:${Math.round(pts[0][0])},${Math.round(pts[0][1])}:${Math.round(last[0])},${Math.round(last[1])}`;
    if (sig !== viz.lastSig) {
      viz.lastSig = sig;
      const v3 = [];
      const liftY = key === 'k11' ? 2.4 : 0.42;
      for (let i = 0; i < pts.length; i++) {
        const py = geomorph.sampleGeoBilinear(pts[i][0], pts[i][1]).hMacro;
        const mp = worldToMap3D(pts[i][0], pts[i][1], py);
        const arcBoost = key === 'k11' ? Math.sin((i / Math.max(1, pts.length - 1)) * Math.PI) * 2.2 : 0;
        v3.push(new THREE.Vector3(mp.x, mp.y + liftY + arcBoost, mp.z));
      }
      viz.line.geometry.dispose();
      viz.line.geometry = new THREE.BufferGeometry().setFromPoints(v3);
      const endP = v3[v3.length - 1];
      viz.pin.position.set(endP.x, endP.y + 1.4, endP.z);
    }
    viz.line.visible = true;
    viz.pin.visible = true;
  }

  // =========================================================================
  // 5. 3D MINIATURE NARROW-50 COMPOUND + SUGINOSATO 5-HOUSE VILLAGE + NULL EREA + BEACONS
  // =========================================================================
  const compPos = worldToMap3D(
    TERRENO_WORLD.compoundCenterX,
    TERRENO_WORLD.compoundCenterZ,
    TERRENO_WORLD.compoundGroundY
  );
  const compoundMini = new THREE.Group();
  compoundMini.position.set(compPos.x, compPos.y, compPos.z);

  const basePad = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 1.05, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  basePad.rotation.x = -Math.PI * 0.5;
  basePad.position.y = 0.16;
  compoundMini.add(basePad);

  const miniTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.95, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.3 })
  );
  miniTower.position.set(0, 0.54, 0);
  compoundMini.add(miniTower);

  const miniAnnex = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.52, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x0ea5e9, emissiveIntensity: 0.35, roughness: 0.4 })
  );
  miniAnnex.position.set(-0.42, 0.32, 0.04);
  compoundMini.add(miniAnnex);
  scene.add(compoundMini);

  // NULL EREA Miniature Underground Airship Launch Complex at South Edge (0, 29910)
  const nullPos = worldToMap3D(0.0, 29910.0, geomorph.southRectY);
  const nullMini = new THREE.Group();
  nullMini.position.set(nullPos.x, nullPos.y, nullPos.z);
  const nullPad = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.16, 1.15),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x0ea5e9, emissiveIntensity: 0.55, roughness: 0.35 })
  );
  nullPad.position.y = 0.14;
  nullMini.add(nullPad);
  const nullRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.65, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  nullRing.rotation.x = -Math.PI * 0.5;
  nullRing.position.y = 0.24;
  nullMini.add(nullRing);
  scene.add(nullMini);

  const villPos = worldToMap3D(VILLAGE.centerX, VILLAGE.centerZ, VILLAGE.groundY);
  const villageMini = new THREE.Group();
  villageMini.position.set(villPos.x, villPos.y, villPos.z);

  const villRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.32, 32),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  );
  villRing.rotation.x = -Math.PI * 0.5;
  villRing.position.y = 0.16;
  villageMini.add(villRing);

  const miniHouseMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0x10b981, emissiveIntensity: 0.42, roughness: 0.35 });
  const miniRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x059669, emissiveIntensity: 0.25, roughness: 0.5 });
  VILLAGE_HOUSES.forEach((h) => {
    const cx = (h.ox + h.w * 0.5 - VILLAGE.centerX) * MAP_SCALE * 6.5;
    const cz = (h.oz + h.d * 0.5 - VILLAGE.centerZ) * MAP_SCALE * 6.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.20), miniHouseMat);
    body.position.set(cx, 0.22, cz);
    villageMini.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), miniRoofMat);
    roof.rotation.y = Math.PI * 0.25;
    roof.position.set(cx, 0.42, cz);
    villageMini.add(roof);
  });
  scene.add(villageMini);

  // 9 Tappable 3D Landmark Beacons (Sets Autonomous Camper or K-11 Destination — NO teleport!)
  const beaconTargets = [];
  const beaconMeshes = [];
  TERRENO_LANDMARKS.forEach((lm) => {
    const wy = geomorph.sampleGeoBilinear(lm.x, lm.z).hMacro;
    const p = worldToMap3D(lm.x, lm.z, wy);
    const isBase = lm.id === 'compound';
    const isVillage = lm.id === 'village';
    const isNull = lm.id === 'null_erea';
    const colHex = isBase ? 0x38bdf8 : (isNull ? 0x22d3ee : (isVillage ? 0x34d399 : 0xf59e0b));
    const orbHex = isBase ? 0x7dd3fc : (isNull ? 0xa5f3fc : (isVillage ? 0x6ee7b7 : 0xfde68a));
    const tall = isBase || isVillage || isNull;

    const grp = new THREE.Group();
    grp.position.set(p.x, p.y, p.z);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.20, tall ? 5.2 : 3.8, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    beam.position.y = tall ? 2.6 : 1.9;
    grp.add(beam);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(tall ? 0.62 : 0.48, 0),
      new THREE.MeshBasicMaterial({ color: orbHex })
    );
    orb.position.y = tall ? 5.5 : 4.0;
    grp.add(orb);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 1.08, 24),
      new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.68, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.20;
    grp.add(ring);

    scene.add(grp);
    beaconMeshes.push({ orb, ring, baseY: orb.position.y });
    beaconTargets.push({
      id: lm.id,
      x: p.x,
      y: p.y + (tall ? 2.8 : 2.1),
      z: p.z,
      worldX: lm.x,
      worldZ: lm.z,
    });
  });

  // =========================================================================
  // 6. LIVE ANIMATED 3D PLAYER BEACON + DIRECTIONAL VIEW CONE + VEHICLES
  // =========================================================================
  const playerMarker = new THREE.Group();
  const playerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  playerCore.position.y = 1.05;
  playerMarker.add(playerCore);

  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.55, 32),
    new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  playerRing.rotation.x = -Math.PI * 0.5;
  playerRing.position.y = 0.30;
  playerMarker.add(playerRing);

  const coneShape = new THREE.Shape();
  coneShape.moveTo(0, 0);
  coneShape.absarc(0, 0, 5.8, -0.44, 0.44, false);
  coneShape.lineTo(0, 0);
  const coneGeo = new THREE.ShapeGeometry(coneShape, 16);
  coneGeo.rotateX(-Math.PI * 0.5);
  coneGeo.rotateY(Math.PI * 0.5);
  const playerCone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.34, side: THREE.DoubleSide })
  );
  playerCone.position.y = 0.36;
  playerMarker.add(playerCone);
  scene.add(playerMarker);

  const camperDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.92),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  scene.add(camperDot);

  const armorDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 1.18),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  scene.add(armorDot);

  const keiDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.38, 0.62),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  scene.add(keiDot);

  const k11Dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xc084fc })
  );
  k11Dot.scale.set(0.75, 0.65, 2.2);
  scene.add(k11Dot);

  const tapRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  tapRipple.rotation.x = -Math.PI * 0.5;
  scene.add(tapRipple);
  let tapRippleAge = 99;

  // =========================================================================
  // 7. SMOOTH DAMPED 3D CAMERA STATE (60 km × 60 km SQUARE DIORAMA)
  // =========================================================================
  const DEFAULT_VIEW = {
    tx: 0,
    ty: 1.5,
    tz: 0,
    azimuth: 0.58,
    pitch: 0.62,
    dist: 174,
  };

  const camTarget = new THREE.Vector3(DEFAULT_VIEW.tx, DEFAULT_VIEW.ty, DEFAULT_VIEW.tz);
  const camCurTarget = camTarget.clone();
  let targetAzimuth = DEFAULT_VIEW.azimuth;
  let curAzimuth = DEFAULT_VIEW.azimuth;
  let targetPitch = DEFAULT_VIEW.pitch;
  let curPitch = DEFAULT_VIEW.pitch;
  let targetDist = DEFAULT_VIEW.dist;
  let curDist = DEFAULT_VIEW.dist;
  let focusedOnPlayer = false;

  const lastPlayerMapPos = new THREE.Vector3(compPos.x, compPos.y, compPos.z);
  const _raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _boxMin = new THREE.Vector3(-HALF_W, PLINTH_BASE_Y, -HALF_D);
  const _boxMax = new THREE.Vector3(HALF_W, 24.0, HALF_D);
  const _hitBox = new THREE.Box3(_boxMin, _boxMax);
  const _tmpVec = new THREE.Vector3();

  function clampCameraTargets() {
    camTarget.x = Math.max(-HALF_W, Math.min(HALF_W, camTarget.x));
    camTarget.z = Math.max(-HALF_D, Math.min(HALF_D, camTarget.z));
    const groundY = geomorph.sampleGeoBilinear(camTarget.x / MAP_SCALE, camTarget.z / MAP_SCALE + MAP_CENTER_Z).hMacro * MAP_Y_SCALE;
    camTarget.y = Math.max(-2.5, Math.min(18.0, groundY + 1.0));
    targetPitch = Math.max(0.24, Math.min(1.46, targetPitch));
    targetDist = Math.max(14, Math.min(340, targetDist));
  }

  function resetOverview(instant = false) {
    focusedOnPlayer = false;
    camTarget.set(DEFAULT_VIEW.tx, DEFAULT_VIEW.ty, DEFAULT_VIEW.tz);
    targetAzimuth = DEFAULT_VIEW.azimuth;
    targetPitch = DEFAULT_VIEW.pitch;
    targetDist = DEFAULT_VIEW.dist;
    if (instant) {
      camCurTarget.copy(camTarget);
      curAzimuth = targetAzimuth;
      curPitch = targetPitch;
      curDist = targetDist;
    }
  }

  function focusPlayer(instant = false) {
    focusedOnPlayer = true;
    camTarget.copy(lastPlayerMapPos);
    targetPitch = 0.68;
    targetDist = 34;
    if (instant) {
      camCurTarget.copy(camTarget);
      curPitch = targetPitch;
      curDist = targetDist;
    }
  }

  function toggleFocusMode() {
    if (focusedOnPlayer) resetOverview(false);
    else focusPlayer(false);
    return focusedOnPlayer;
  }

  function panByScreenDelta(dxPx, dyPx, viewportW, viewportH) {
    focusedOnPlayer = false;
    const scale = (curDist * 1.18) / Math.max(320, Math.min(viewportW, viewportH));
    const sinA = Math.sin(curAzimuth);
    const cosA = Math.cos(curAzimuth);
    camTarget.x += (-dxPx * cosA - dyPx * sinA) * scale;
    camTarget.z += (dxPx * sinA - dyPx * cosA) * scale;
    clampCameraTargets();
  }

  function orbitByDelta(dxPx, dyPx) {
    targetAzimuth -= dxPx * 0.0062;
    targetPitch += dyPx * 0.0048;
    clampCameraTargets();
  }

  function zoomByFactor(factor) {
    targetDist *= factor;
    clampCameraTargets();
  }

  function syncPlayerPose(pose) {
    if (!pose) return;
    const wx = pose.x ?? TERRENO_WORLD.compoundCenterX;
    const wz = pose.z ?? TERRENO_WORLD.compoundCenterZ;
    const wy = geomorph.sampleGeoBilinear(wx, wz).hMacro;
    const mp = worldToMap3D(wx, wz, wy);
    lastPlayerMapPos.set(mp.x, mp.y, mp.z);
    playerMarker.position.set(mp.x, mp.y, mp.z);
    playerCone.rotation.y = pose.yaw ?? 0;

    if (pose.camperPose) {
      const cy = geomorph.sampleGeoBilinear(pose.camperPose.cx, pose.camperPose.cz).hMacro;
      const cp = worldToMap3D(pose.camperPose.cx, pose.camperPose.cz, cy);
      camperDot.position.set(cp.x, cp.y + 0.34, cp.z);
      camperDot.rotation.y = pose.camperPose.yaw || 0;
    }
    if (pose.armorPose) {
      const ay = geomorph.sampleGeoBilinear(pose.armorPose.cx, pose.armorPose.cz).hMacro;
      const ap = worldToMap3D(pose.armorPose.cx, pose.armorPose.cz, ay);
      armorDot.position.set(ap.x, ap.y + 0.38, ap.z);
      armorDot.rotation.y = pose.armorPose.yaw || 0;
    }
    if (pose.keiPose) {
      const ky = geomorph.sampleGeoBilinear(pose.keiPose.cx, pose.keiPose.cz).hMacro;
      const kp = worldToMap3D(pose.keiPose.cx, pose.keiPose.cz, ky);
      keiDot.position.set(kp.x, kp.y + 0.28, kp.z);
      keiDot.rotation.y = pose.keiPose.yaw || 0;
    }
    if (pose.k11Pose) {
      const kSurfY = geomorph.sampleGeoBilinear(pose.k11Pose.cx, pose.k11Pose.cz).hMacro;
      const kAlt = Math.max(0, (pose.k11Pose.y ?? kSurfY) - kSurfY);
      const kp11 = worldToMap3D(pose.k11Pose.cx, pose.k11Pose.cz, kSurfY);
      k11Dot.position.set(kp11.x, kp11.y + 0.95 + Math.min(5.0, kAlt * 0.025), kp11.z);
      k11Dot.rotation.y = pose.k11Pose.yaw || 0;
    }
    if (pose.autopilotRoutes) {
      updateRouteViz('camper', pose.autopilotRoutes.camper);
      updateRouteViz('armor', pose.autopilotRoutes.armor);
      updateRouteViz('k11', pose.autopilotRoutes.k11);
    }
  }

  /**
   * Instant (<0.1ms) 3D Pick: returns exact world coords for free-destination camper autopilot!
   */
  function pickAtScreenPoint(clientX, clientY, viewportRect) {
    if (!viewportRect || viewportRect.width <= 0 || viewportRect.height <= 0) return null;
    _ndc.set(
      ((clientX - viewportRect.left) / viewportRect.width) * 2 - 1,
      -((clientY - viewportRect.top) / viewportRect.height) * 2 + 1
    );
    camera.updateMatrixWorld();
    _raycaster.setFromCamera(_ndc, camera);
    const ray = _raycaster.ray;

    let bestBeacon = null;
    let bestBeaconDist = Infinity;
    for (let i = 0; i < beaconTargets.length; i++) {
      const b = beaconTargets[i];
      _tmpVec.set(b.x, b.y, b.z);
      const camToB = _tmpVec.distanceTo(camera.position);
      const pickRadius = Math.max(1.8, camToB * 0.032);
      const perpDist = ray.distanceToPoint(_tmpVec);
      if (perpDist < pickRadius && camToB < bestBeaconDist) {
        bestBeaconDist = camToB;
        bestBeacon = b;
      }
    }
    if (bestBeacon) {
      tapRipple.position.set(bestBeacon.x, bestBeacon.y - 1.6, bestBeacon.z);
      tapRippleAge = 0;
      return { kind: 'landmark', id: bestBeacon.id, worldX: bestBeacon.worldX, worldZ: bestBeacon.worldZ };
    }

    const entryPt = ray.intersectBox(_hitBox, _tmpVec);
    if (!entryPt) return null;

    const invDx = Math.abs(ray.direction.x) > 1e-6 ? 1 / ray.direction.x : 1e9;
    const invDy = Math.abs(ray.direction.y) > 1e-6 ? 1 / ray.direction.y : 1e9;
    const invDz = Math.abs(ray.direction.z) > 1e-6 ? 1 / ray.direction.z : 1e9;
    const tx1 = (_boxMin.x - ray.origin.x) * invDx;
    const tx2 = (_boxMax.x - ray.origin.x) * invDx;
    const ty1 = (_boxMin.y - ray.origin.y) * invDy;
    const ty2 = (_boxMax.y - ray.origin.y) * invDy;
    const tz1 = (_boxMin.z - ray.origin.z) * invDz;
    const tz2 = (_boxMax.z - ray.origin.z) * invDz;
    const tEnter = Math.max(0.5, Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tExit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tExit <= tEnter) return null;

    const steps = 128;
    const dt = (tExit - tEnter) / steps;
    let prevT = tEnter;
    for (let s = 0; s <= steps; s++) {
      const t = tEnter + s * dt;
      const px = ray.origin.x + ray.direction.x * t;
      const py = ray.origin.y + ray.direction.y * t;
      const pz = ray.origin.z + ray.direction.z * t;
      if (px < -HALF_W || px > HALF_W || pz < -HALF_D || pz > HALF_D) {
        prevT = t;
        continue;
      }
      const wx = px / MAP_SCALE;
      const wz = pz / MAP_SCALE + MAP_CENTER_Z;
      const surfY = geomorph.sampleGeoBilinear(wx, wz).hMacro * MAP_Y_SCALE;
      if (py <= surfY) {
        let lo = prevT;
        let hi = t;
        for (let b = 0; b < 10; b++) {
          const mid = 0.5 * (lo + hi);
          const bx = ray.origin.x + ray.direction.x * mid;
          const by = ray.origin.y + ray.direction.y * mid;
          const bz = ray.origin.z + ray.direction.z * mid;
          const sy = geomorph.sampleGeoBilinear(bx / MAP_SCALE, bz / MAP_SCALE + MAP_CENTER_Z).hMacro * MAP_Y_SCALE;
          if (by <= sy) hi = mid;
          else lo = mid;
        }
        const fx = ray.origin.x + ray.direction.x * hi;
        const fz = ray.origin.z + ray.direction.z * hi;
        const hitW = map3DToWorld(fx, fz);
        const clampedX = Math.max(TERRENO_WORLD.playMinX, Math.min(TERRENO_WORLD.playMaxX, hitW.x));
        const clampedZ = Math.max(TERRENO_WORLD.playMinZ, Math.min(TERRENO_WORLD.playMaxZ, hitW.z));
        const hy = geomorph.sampleGeoBilinear(clampedX, clampedZ).hMacro * MAP_Y_SCALE;
        tapRipple.position.set(clampedX * MAP_SCALE, hy + 0.28, (clampedZ - MAP_CENTER_Z) * MAP_SCALE);
        tapRippleAge = 0;
        return { kind: 'world', worldX: clampedX, worldZ: clampedZ };
      }
      prevT = t;
    }
    return null;
  }

  function resize(width, height) {
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function render(renderer, dt, elapsed) {
    const smooth = 1.0 - Math.exp(-dt * 10.5);
    camCurTarget.lerp(camTarget, smooth);
    curAzimuth += (targetAzimuth - curAzimuth) * smooth;
    curPitch += (targetPitch - curPitch) * smooth;
    curDist += (targetDist - curDist) * smooth;

    const horiz = Math.cos(curPitch) * curDist;
    camera.position.set(
      camCurTarget.x + Math.sin(curAzimuth) * horiz,
      camCurTarget.y + Math.sin(curPitch) * curDist,
      camCurTarget.z + Math.cos(curAzimuth) * horiz
    );
    camera.lookAt(camCurTarget);
    camera.updateMatrixWorld();

    terrainUniforms.uTime.value = elapsed;
    terrainUniforms.uCamPos.value.copy(camera.position);

    const pulse = (elapsed * 1.15) % 1.0;
    const ringScale = 0.85 + pulse * 1.85;
    playerRing.scale.set(ringScale, ringScale, 1);
    playerRing.material.opacity = (1.0 - pulse) * 0.82;

    for (let i = 0; i < beaconMeshes.length; i++) {
      const bm = beaconMeshes[i];
      bm.orb.rotation.y = elapsed * 1.4 + i * 0.9;
      bm.orb.position.y = bm.baseY + Math.sin(elapsed * 2.2 + i) * 0.22;
    }

    if (tapRippleAge < 0.85) {
      tapRippleAge += dt;
      const rt = Math.min(1, tapRippleAge / 0.85);
      const rs = 1.0 + rt * 4.5;
      tapRipple.scale.set(rs, rs, 1);
      tapRipple.material.opacity = (1.0 - rt) * 0.9;
    } else {
      tapRipple.material.opacity = 0;
    }

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  function getCameraState() {
    return {
      tx: Math.round(camCurTarget.x * 10) / 10,
      tz: Math.round(camCurTarget.z * 10) / 10,
      azimuth: Math.round(curAzimuth * 100) / 100,
      pitch: Math.round(curPitch * 100) / 100,
      dist: Math.round(curDist * 10) / 10,
      focusedOnPlayer,
    };
  }

  return {
    scene,
    camera,
    resetOverview,
    focusPlayer,
    toggleFocusMode,
    panByScreenDelta,
    orbitByDelta,
    zoomByFactor,
    syncPlayerPose,
    pickAtScreenPoint,
    resize,
    render,
    getCameraState,
  };
}
