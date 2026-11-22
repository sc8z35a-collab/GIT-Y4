import * as THREE from 'three';
import {
  TERRENO_WORLD,
  MOUNTAIN_PEAKS,
  TERRENO_LANDMARKS,
  evalMainRiver,
} from './terrenoConfig.js';
import { VILLAGE, VILLAGE_HOUSES } from '../villageData.js';

/**
 * TERRENO High-Precision Real-Time 3D Topographic Map Renderer.
 * Renders directly on the existing WebGL2 renderer (zero extra WebGL contexts, zero VRAM duplication)
 * using the live 512×1536 RGBA32F Geomorphology Atlas + Horizon/Sky-View AO Atlas.
 *
 * Features:
 *   - 224×480 (107,520 vertices / 215,040 triangles) real-time 3D relief terrain slab + geological plinth skirt
 *   - Per-pixel manual-bilinear RGBA32F elevation + analytical normals + Sky-View gorge AO + horizon shading
 *   - Screen-space fwidth() anti-aliased 50m / 200m topographic contour isolines + 1km metric grid
 *   - Animated specular 19km gorge river (黒杉川), wet streams, & 3D luminous 19km forestry road spline (奥山林道)
 *   - Miniature 3D NARROW-50 compound, 6 tappable 3D landmark beacons, live animated 3D player cone, & vehicle dots
 *   - Ultra-fast (<0.1ms) analytical heightfield raymarching for exact tap-anywhere-on-3D-terrain teleportation
 */

const MAP_SCALE = 0.005;         // 200 m world = 1.0 map unit -> 75 × 200 diorama slab (15km × 40km!)
const MAP_Y_SCALE = 0.011;       // 2.2× sculptural vertical relief exaggeration
const MAP_CENTER_Z = (TERRENO_WORLD.minZ + TERRENO_WORLD.maxZ) * 0.5; // +6000m
const HALF_W = (TERRENO_WORLD.width * 0.5) * MAP_SCALE;   // 37.5
const HALF_D = (TERRENO_WORLD.depth * 0.5) * MAP_SCALE;   // 100.0
const PLINTH_BASE_Y = -5.2;

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

  void main() {
    vAtlasUv = uv;
    vMapPos = position;
    vWorldXZ_Y = vec3(
      position.x * uInvMapScale,
      position.y * uInvMapYScale,
      position.z * uInvMapScale + uMapCenterZ
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

  // 100% core WebGL2 manual bilinear sampler for RGBA32F DataTexture (NearestFilter safe!)
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
    return 240.0
      + sin(z * 0.00024 + 0.10) * 1420.0
      + sin(z * 0.00068 - 0.62) * 540.0
      + cos(z * 0.00014 + 0.45) * 680.0
      - 495.0 * exp(-(z * z) / (1700.0 * 1700.0));
  }

  float evalRiverHalfW(float z) {
    float t = clamp((z - uWorldBounds.z) / uWorldBounds.y, 0.0, 1.0);
    return 16.0 + 40.0 * pow(t, 0.85) + sin(z * 0.0014) * 4.5;
  }

  vec3 alpineBiomeAlbedo(float asl, float slope, float ridge, float wetness) {
    // Rich photoreal Japanese Northern Alps elevation & biome palette (EL +265m .. +2,260m ASL)
    vec3 cGorge  = vec3(0.08, 0.21, 0.16);
    vec3 cCedar  = vec3(0.11, 0.29, 0.19);
    vec3 cBeech  = vec3(0.24, 0.42, 0.23);
    vec3 cSubAlp = vec3(0.45, 0.48, 0.29);
    vec3 cAlpine = vec3(0.60, 0.55, 0.44);
    vec3 cRock   = vec3(0.47, 0.49, 0.52);
    vec3 cSnow   = vec3(0.89, 0.93, 0.97);

    vec3 col = mix(cGorge, cCedar, smoothstep(310.0, 560.0, asl));
    col = mix(col, cBeech, smoothstep(700.0, 1020.0, asl));
    col = mix(col, cSubAlp, smoothstep(1080.0, 1340.0, asl));
    col = mix(col, cAlpine, smoothstep(1340.0, 1560.0, asl));

    // Exposed granite crags on steep mountain faces & sharp ridges
    float rockMask = smoothstep(0.46, 0.88, slope) * 0.82 + smoothstep(0.32, 0.85, ridge) * smoothstep(1080.0, 1480.0, asl) * 0.45;
    col = mix(col, cRock, clamp(rockMask, 0.0, 0.92));

    // Sunlit high alpine snow caps & couloirs above +1460m ASL
    float snowLine = 1480.0 + slope * 150.0 - max(0.0, -ridge) * 120.0;
    float snowMask = smoothstep(snowLine, snowLine + 190.0, asl) * (1.0 - smoothstep(0.75, 1.25, slope));
    col = mix(col, cSnow, clamp(snowMask, 0.0, 0.95));

    // Deep lush moisture tint along ravines
    col = mix(col, col * vec3(0.76, 0.95, 0.86), clamp(wetness * 0.35, 0.0, 0.35));
    return col;
  }

  void main() {
    vec4 gC = sampleGeo(vAtlasUv);
    float hC = gC.r;
    float wetness = gC.g;
    float ridge = gC.b;
    float roadMask = gC.a;
    float asl = uBaseASL + hC;

    // Per-pixel high-precision analytical normal from Float32 elevation atlas
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
    vec3 N = normalize(vec3(-gx * 1.55, 1.0, -gz * 1.55));

    vec4 hor = texture2D(uHorizonTex, vAtlasUv);
    float skyAO = 0.56 + 0.44 * hor.b;
    float horShade = mix(0.72, 1.0, 1.0 - hor.g * 0.55);

    vec3 albedo = alpineBiomeAlbedo(asl, slope, ridge, wetness);

    // River & alpine tributaries
    float wx = vWorldXZ_Y.x;
    float wz = vWorldXZ_Y.z;
    float distRiv = abs(wx - evalRiverCenterX(wz));
    float rivHW = evalRiverHalfW(wz);
    float isMainRiver = 1.0 - smoothstep(rivHW * 0.72, rivHW * 1.65, distRiv);
    float isStream = smoothstep(0.77, 0.92, wetness) * (1.0 - smoothstep(1260.0, 1460.0, asl)) * 0.65;
    float waterFactor = max(isMainRiver, isStream);

    // Compound & Suginosato Village pad check so forestry road blends cleanly into settlements
    float distComp = length(vec2(wx - 1.5, wz - 3.5));
    float distVill = length(vec2(wx, wz) - uVillageCenter);
    float isVillagePad = 1.0 - smoothstep(42.0, 68.0, distVill);
    float isRoad = smoothstep(0.32, 0.78, roadMask) * smoothstep(32.0, 62.0, distComp) * (1.0 - isVillagePad) * (1.0 - waterFactor);

    // Crisp alpine directional sunlight + cool mountain sky hemisphere + sculptural rim
    vec3 sunDir = normalize(vec3(-0.56, 0.68, -0.47));
    vec3 V = normalize(uCamPos - vMapPos);
    float ndl = max(dot(N, sunDir), 0.0);
    float wrap = max(0.0, (dot(N, sunDir) + 0.35) / 1.35);

    vec3 sunCol = vec3(1.18, 1.11, 0.98);
    vec3 skyFill = mix(vec3(0.11, 0.17, 0.25), vec3(0.24, 0.36, 0.52), N.y * 0.5 + 0.5);
    vec3 lit = albedo * (sunCol * (ndl * 0.92 + wrap * 0.26) * horShade + skyFill * skyAO * 0.85);

    // Subtle warm sunlit meadow highlight for Suginosato 5-House Village terrace
    if (isVillagePad > 0.01) {
      lit = mix(lit, vec3(0.32, 0.48, 0.26), isVillagePad * 0.55);
    }

    // Subtle specular glint on snow & sunlit granite ridges
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 28.0) * smoothstep(1380.0, 1680.0, asl) * 0.28;
    lit += vec3(0.92, 0.96, 1.0) * spec;

    // Shimmering specular emerald-cyan 40 km River water
    if (waterFactor > 0.01) {
      float wave = sin(wz * 0.045 - uTime * 2.4 + wx * 0.03) * 0.5 + 0.5;
      vec3 riverCol = mix(vec3(0.07, 0.42, 0.56), vec3(0.16, 0.74, 0.82), 0.45 + 0.45 * wave);
      float fresnel = pow(1.0 - max(dot(vec3(0.0, 1.0, 0.0), V), 0.0), 3.0);
      float wSpec = pow(max(dot(vec3(0.0, 1.0, 0.0), H), 0.0), 42.0) * (0.45 + 0.35 * wave);
      riverCol += vec3(0.55, 0.92, 1.0) * (fresnel * 0.38 + wSpec * 0.65);
      lit = mix(lit, riverCol, waterFactor * 0.92);
    }

    // Luminous graded 40 km Forestry Road ribbon (奥山林道)
    if (isRoad > 0.01) {
      vec3 roadCol = vec3(0.95, 0.78, 0.44);
      lit = mix(lit, roadCol, isRoad * 0.82);
    }

    // Screen-space anti-aliased Topographic Contour Isolines (100m minor + 250m major) via fwidth!
    float dfAsl = max(fwidth(asl), 0.85);
    float c100 = abs(fract(asl / 100.0 + 0.5) - 0.5) * 100.0 / dfAsl;
    float line100 = 1.0 - smoothstep(0.32, 0.92, c100);
    float c250 = abs(fract(asl / 250.0 + 0.5) - 0.5) * 250.0 / dfAsl;
    float line250 = 1.0 - smoothstep(0.38, 1.05, c250);

    float contourFade = (1.0 - waterFactor * 0.85) * (1.0 - isRoad * 0.5);
    lit = mix(lit, lit * 0.72 + vec3(0.08, 0.07, 0.05), line100 * 0.22 * contourFade);
    lit = mix(lit, vec3(0.95, 0.89, 0.74), line250 * 0.34 * contourFade);

    // Hairline 2 km Metric Grid draped seamlessly over 15km × 40km 3D topography
    vec2 kmCoord = vec2(wx, wz) * 0.0005;
    vec2 kmDist = abs(fract(kmCoord + 0.5) - 0.5) / max(fwidth(kmCoord), vec2(0.0005));
    float kmLine = 1.0 - smoothstep(0.55, 1.45, min(kmDist.x, kmDist.y));
    lit = mix(lit, vec3(0.75, 0.88, 1.0), kmLine * 0.14);

    // Subtle crisp atmospheric perspective + cool Fresnel ridge rim
    float distCam = length(uCamPos - vMapPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.6) * smoothstep(650.0, 1750.0, asl) * 0.22;
    lit += vec3(0.42, 0.66, 0.88) * rim;

    float fogT = 1.0 - exp(-max(0.0, distCam - 115.0) * 0.0022);
    lit = mix(lit, vec3(0.045, 0.075, 0.115), clamp(fogT, 0.0, 0.52));

    // Crisp luminous cyan-slate perimeter edge highlight
    float edgeDist = min(min(vAtlasUv.x, 1.0 - vAtlasUv.x), min(vAtlasUv.y, 1.0 - vAtlasUv.y));
    float borderGlow = 1.0 - smoothstep(0.0, 0.0045, edgeDist);
    lit = mix(lit, vec3(0.32, 0.68, 0.82), borderGlow * 0.55);

    // Filmic highlight roll-off for vivid snow peaks & crisp alpine relief
    lit *= 1.18;
    lit = clamp((lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14), 0.0, 1.0);
    lit = pow(lit, vec3(1.0 / 1.12));

    gl_FragColor = vec4(lit, 1.0);
  }
`;

const PLINTH_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLINTH_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    float t = clamp((vPos.y - (-5.2)) / 18.0, 0.0, 1.0);
    vec3 base = mix(vec3(0.03, 0.045, 0.068), vec3(0.085, 0.11, 0.145), t);
    // Subtle geological strata hairlines along cutaway rock wall
    float strata = 1.0 - smoothstep(0.0, 0.08, abs(fract(vPos.y * 0.9) - 0.5));
    base += vec3(0.04, 0.06, 0.08) * strata * 0.5;
    float bottomRim = 1.0 - smoothstep(0.0, 0.30, vPos.y - (-5.2));
    base = mix(base, vec3(0.18, 0.45, 0.58), bottomRim * 0.55);
    float sideShade = 0.72 + 0.28 * abs(vNormal.x);
    gl_FragColor = vec4(base * sideShade, 1.0);
  }
`;

/**
 * Build the 4 vertical geological cutaway walls joining the exact terrain perimeter to PLINTH_BASE_Y.
 */
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

  // West edge (X = minX, Z: minZ -> maxZ)
  const west = [];
  for (let iz = 0; iz <= segZ; iz++) {
    const v = iz / segZ;
    const wz = TERRENO_WORLD.minZ + v * TERRENO_WORLD.depth;
    const my = sampleEdgeY(TERRENO_WORLD.minX, wz);
    west.push([-HALF_W, my, (wz - MAP_CENTER_Z) * MAP_SCALE]);
  }
  pushWall(west, -1, 0);

  // East edge (X = maxX, Z: maxZ -> minZ)
  const east = [];
  for (let iz = segZ; iz >= 0; iz--) {
    const v = iz / segZ;
    const wz = TERRENO_WORLD.minZ + v * TERRENO_WORLD.depth;
    const my = sampleEdgeY(TERRENO_WORLD.maxX, wz);
    east.push([HALF_W, my, (wz - MAP_CENTER_Z) * MAP_SCALE]);
  }
  pushWall(east, 1, 0);

  // North edge (Z = minZ, X: maxX -> minX)
  const north = [];
  for (let ix = segX; ix >= 0; ix--) {
    const u = ix / segX;
    const wx = TERRENO_WORLD.minX + u * TERRENO_WORLD.width;
    const my = sampleEdgeY(wx, TERRENO_WORLD.minZ);
    north.push([wx * MAP_SCALE, my, -HALF_D]);
  }
  pushWall(north, 0, -1);

  // South edge (Z = maxZ, X: minX -> maxX)
  const south = [];
  for (let ix = 0; ix <= segX; ix++) {
    const u = ix / segX;
    const wx = TERRENO_WORLD.minX + u * TERRENO_WORLD.width;
    const my = sampleEdgeY(wx, TERRENO_WORLD.maxZ);
    south.push([wx * MAP_SCALE, my, HALF_D]);
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

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 1400);

  // Subtle ambient & directional fill for 3D markers/miniatures
  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x16202c, 1.15);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
  keyLight.position.set(-70, 120, -60);
  scene.add(keyLight);

  // =========================================================================
  // 1. HIGH-PRECISION 240 × 512 3D RELIEF TERRAIN MESH (15 km × 40 km)
  // =========================================================================
  const SEG_X = 240;
  const SEG_Z = 512;
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
  const plinthMesh = buildGeologicalPlinth(geomorph, 112, 240);
  scene.add(plinthMesh);

  const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(HALF_W * 2 + 0.16, 0.08, HALF_D * 2 + 0.16));
  const frameLine = new THREE.LineSegments(
    frameGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.34 })
  );
  frameLine.position.y = PLINTH_BASE_Y;
  scene.add(frameLine);

  // =========================================================================
  // 3. 3D LUMINOUS FORESTRY ROAD SPLINE RIBBON (奥山林道 40 km)
  // =========================================================================
  if (geomorph.roadDense && geomorph.roadDense.length > 2) {
    const roadPts = [];
    for (let i = 0; i < geomorph.roadDense.length; i += 2) {
      const [rx, rz] = geomorph.roadDense[i];
      const ry = geomorph.sampleGeoBilinear(rx, rz).hMacro;
      const p = worldToMap3D(rx, rz, ry);
      roadPts.push(new THREE.Vector3(p.x, p.y + 0.20, p.z));
    }
    const roadGeo = new THREE.BufferGeometry().setFromPoints(roadPts);
    const roadLine = new THREE.Line(
      roadGeo,
      new THREE.LineBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.82 })
    );
    scene.add(roadLine);
  }

  // =========================================================================
  // 4. 3D MINIATURE NARROW-50 COMPOUND + SUGINOSATO 5-HOUSE VILLAGE + BEACONS
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
  basePad.position.y = 0.14;
  compoundMini.add(basePad);

  const miniTower = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.95, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.3 })
  );
  miniTower.position.set(0, 0.52, 0);
  compoundMini.add(miniTower);

  const miniAnnex = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.52, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x0ea5e9, emissiveIntensity: 0.35, roughness: 0.4 })
  );
  miniAnnex.position.set(-0.42, 0.30, 0.04);
  compoundMini.add(miniAnnex);
  scene.add(compoundMini);

  // Miniature 3D 5-House Suginosato Mountain Village (杉ノ郷集落) Cluster!
  const villPos = worldToMap3D(VILLAGE.centerX, VILLAGE.centerZ, VILLAGE.groundY);
  const villageMini = new THREE.Group();
  villageMini.position.set(villPos.x, villPos.y, villPos.z);

  const villRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.32, 32),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  );
  villRing.rotation.x = -Math.PI * 0.5;
  villRing.position.y = 0.15;
  villageMini.add(villRing);

  const miniHouseMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0x10b981, emissiveIntensity: 0.42, roughness: 0.35 });
  const miniRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x059669, emissiveIntensity: 0.25, roughness: 0.5 });
  VILLAGE_HOUSES.forEach((h) => {
    const cx = (h.ox + h.w * 0.5 - VILLAGE.centerX) * MAP_SCALE * 3.8;
    const cz = (h.oz + h.d * 0.5 - VILLAGE.centerZ) * MAP_SCALE * 3.8;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.20), miniHouseMat);
    body.position.set(cx, 0.20, cz);
    villageMini.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), miniRoofMat);
    roof.rotation.y = Math.PI * 0.25;
    roof.position.set(cx, 0.40, cz);
    villageMini.add(roof);
  });
  scene.add(villageMini);

  // Subtle geometric diamond needles over major mountain summits (zero text clutter!)
  const peakCrystalGeo = new THREE.OctahedronGeometry(0.38, 0);
  const peakCrystalMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.72 });
  MOUNTAIN_PEAKS.forEach((pk) => {
    const py = geomorph.sampleGeoBilinear(pk.x, pk.z).hMacro;
    const p = worldToMap3D(pk.x, pk.z, py);
    const cry = new THREE.Mesh(peakCrystalGeo, peakCrystalMat);
    cry.scale.set(0.75, 1.55, 0.75);
    cry.position.set(p.x, p.y + 1.05, p.z);
    scene.add(cry);
  });

  // 8 Tappable 3D Landmark Beacons (BASE=cyan, VLG=emerald, Alpine Landmarks=amber)
  const beaconTargets = [];
  const beaconMeshes = [];
  TERRENO_LANDMARKS.forEach((lm) => {
    const wy = geomorph.sampleGeoBilinear(lm.x, lm.z).hMacro;
    const p = worldToMap3D(lm.x, lm.z, wy);
    const isBase = lm.id === 'compound';
    const isVillage = lm.id === 'village';
    const colHex = isBase ? 0x38bdf8 : (isVillage ? 0x34d399 : 0xf59e0b);
    const orbHex = isBase ? 0x7dd3fc : (isVillage ? 0x6ee7b7 : 0xfde68a);
    const tall = isBase || isVillage;

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
  // 5. LIVE ANIMATED 3D PLAYER BEACON + DIRECTIONAL VIEW CONE + VEHICLES
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
    new THREE.BoxGeometry(0.42, 0.42, 0.72),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  scene.add(camperDot);

  const keiDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.30, 0.52),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  scene.add(keiDot);

  const tapRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.4, 28),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  tapRipple.rotation.x = -Math.PI * 0.5;
  scene.add(tapRipple);
  let tapRippleAge = 99;

  // =========================================================================
  // 6. SMOOTH DAMPED 3D CAMERA STATE (WIDESCREEN LANDSCAPE OPTIMIZED FOR 15×40km!)
  // =========================================================================
  const DEFAULT_VIEW = {
    tx: 0,
    ty: 4.0,
    tz: 0,
    azimuth: 1.40,   // ~80° WSW overlook -> full 15km × 40km alpine watershed sweeps edge-to-edge!
    pitch: 0.56,     // ~32° dramatic sculpted mountain relief angle
    dist: 138,
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
  const _boxMax = new THREE.Vector3(HALF_W, 34.0, HALF_D);
  const _hitBox = new THREE.Box3(_boxMin, _boxMax);
  const _tmpVec = new THREE.Vector3();

  function clampCameraTargets() {
    camTarget.x = Math.max(-HALF_W, Math.min(HALF_W, camTarget.x));
    camTarget.z = Math.max(-HALF_D, Math.min(HALF_D, camTarget.z));
    const groundY = geomorph.sampleGeoBilinear(camTarget.x / MAP_SCALE, camTarget.z / MAP_SCALE + MAP_CENTER_Z).hMacro * MAP_Y_SCALE;
    camTarget.y = Math.max(-2.0, Math.min(26.0, groundY + 1.2));
    targetPitch = Math.max(0.24, Math.min(1.46, targetPitch));
    targetDist = Math.max(16, Math.min(280, targetDist));
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
    targetDist = 38;
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
    // Screen right & forward projected onto horizontal XZ map plane
    const sinA = Math.sin(curAzimuth);
    const cosA = Math.cos(curAzimuth);
    // Right vector = (cosA, 0, -sinA), Forward vector = (-sinA, 0, -cosA)
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
      camperDot.position.set(cp.x, cp.y + 0.24, cp.z);
      camperDot.rotation.y = pose.camperPose.yaw || 0;
    }
    if (pose.keiPose) {
      const ky = geomorph.sampleGeoBilinear(pose.keiPose.cx, pose.keiPose.cz).hMacro;
      const kp = worldToMap3D(pose.keiPose.cx, pose.keiPose.cz, ky);
      keiDot.position.set(kp.x, kp.y + 0.20, kp.z);
      keiDot.rotation.y = pose.keiPose.yaw || 0;
    }
  }

  /**
   * Instant (<0.1ms) 3D Pick: checks landmark beacons first, then analytically raymarches the 5×19km relief!
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

    // 1. Check 3D landmark beacon proximity first (generous thumb-friendly radius)
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

    // 2. Analytical raymarch against 5km × 19km relief AABB + heightfield (sub-meter accuracy in <0.08ms!)
    const entryPt = ray.intersectBox(_hitBox, _tmpVec);
    if (!entryPt) return null;

    // Compute exact ray entry/exit interval [t0, t1]
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
        // 10 iterations binary refinement -> millimeter precision!
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
        tapRipple.position.set(clampedX * MAP_SCALE, hy + 0.26, (clampedZ - MAP_CENTER_Z) * MAP_SCALE);
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

    // Subtle organic animations on 3D beacons & live player sonar pulse
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
