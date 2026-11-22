import * as THREE from 'three';
import { TERRENO_WORLD, evalMainRiver } from './terrenoConfig.js';

/**
 * TERRENO Severe Mountain Storm, Catastrophic Flash-Flood, Dynamic Landslide & Hydroplaning Engine.
 *   - 3,600-streak GPU diagonal wind-driven torrential rain curtain (1 draw call, zero GC)
 *   - Dynamic sky darkening, fierce wind gusts, multi-flicker volumetric lightning flashes & thunder callback
 *   - Massive 19km river flash-flooding (+7.5m water surge inundating low banks & valley roads!)
 *   - 8 active mountain landslide zones spawning tumbling debris plumes + real physical 3D mud/boulder mounds
 *   - Real surface traction/grip degradation (0.96 dry -> 0.18..0.34 storm mud/flood hydroplaning!)
 */

export const LANDSLIDE_SITES = [
  { id: 'ls_1', x: -102, z: -660,  radius: 13.5, peakH: 1.55, slopeDirX: 0.85,  slopeDirZ: 0.25 },
  { id: 'ls_2', x: -275, z: -1480, radius: 14.5, peakH: 1.75, slopeDirX: 0.88,  slopeDirZ: -0.20 },
  { id: 'ls_3', x: -338, z: -2910, radius: 15.0, peakH: 1.80, slopeDirX: 0.76,  slopeDirZ: 0.42 },
  { id: 'ls_4', x: 405,  z: -4510, radius: 14.0, peakH: 1.70, slopeDirX: -0.82, slopeDirZ: 0.30 },
  { id: 'ls_5', x: -176, z: 540,   radius: 13.5, peakH: 1.60, slopeDirX: 0.90,  slopeDirZ: 0.15 },
  { id: 'ls_6', x: -252, z: 1310,  radius: 14.5, peakH: 1.75, slopeDirX: 0.86,  slopeDirZ: 0.22 },
  { id: 'ls_7', x: -432, z: 2390,  radius: 15.0, peakH: 1.85, slopeDirX: 0.80,  slopeDirZ: -0.32 },
  { id: 'ls_8', x: -670, z: 4920,  radius: 16.0, peakH: 1.95, slopeDirX: 0.84,  slopeDirZ: 0.28 },
];

const RAIN_VERT = /* glsl */ `
  attribute vec3 aSeed;   // x, y, z normalized wrap coords [0..1]
  attribute vec2 aQuad;   // corner (-1..+1, 0..1)

  uniform vec3 uCamPos;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uWind;

  varying float vAlpha;

  void main() {
    if (uIntensity < 0.02) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }

    vec3 box = vec3(52.0, 28.0, 52.0);
    float fallSpeed = 24.0 + aSeed.x * 9.0;
    vec3 worldOffset = vec3(
      fract(aSeed.x + (uWind.x * uTime) / box.x - uCamPos.x / box.x) - 0.5,
      fract(aSeed.y - (fallSpeed * uTime) / box.y - uCamPos.y / box.y) - 0.5,
      fract(aSeed.z + (uWind.z * uTime) / box.z - uCamPos.z / box.z) - 0.5
    ) * box;

    vec3 basePos = uCamPos + worldOffset;
    // Raindrop velocity vector (diagonal howling storm streaks!)
    vec3 vel = normalize(vec3(uWind.x, -fallSpeed, uWind.z));
    vec3 toCam = normalize(uCamPos - basePos);
    vec3 right = normalize(cross(vel, toCam));

    float streakLen = (0.75 + uIntensity * 0.95) * (0.7 + aSeed.z * 0.6);
    float streakW = 0.016 + uIntensity * 0.010;
    vec3 pos = basePos + right * (aQuad.x * streakW) + vel * (aQuad.y * streakLen);

    float dist = length(worldOffset);
    float distFade = (1.0 - smoothstep(14.0, 25.0, dist)) * smoothstep(1.1, 2.8, dist);
    vAlpha = distFade * uIntensity * (1.0 - abs(aQuad.y - 0.5) * 1.4) * 0.52;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const RAIN_FRAG = /* glsl */ `
  precision highp float;
  uniform float uLightning;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    vec3 col = mix(vec3(0.68, 0.76, 0.86), vec3(0.96, 0.98, 1.0), clamp(uLightning, 0.0, 1.0));
    gl_FragColor = vec4(col, vAlpha);
  }
`;

function buildRainMesh(count = 3600) {
  const verts = count * 4;
  const tris = count * 2;
  const positions = new Float32Array(verts * 3);
  const seeds = new Float32Array(verts * 3);
  const quads = new Float32Array(verts * 2);
  const indices = new Uint32Array(tris * 3);

  let s = 918273;
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };

  const corners = [[-1, 0], [1, 0], [1, 1], [-1, 1]];
  for (let i = 0; i < count; i++) {
    const sx = rng(), sy = rng(), sz = rng();
    const v0 = i * 4;
    for (let k = 0; k < 4; k++) {
      const vi = v0 + k;
      seeds[vi * 3] = sx;
      seeds[vi * 3 + 1] = sy;
      seeds[vi * 3 + 2] = sz;
      quads[vi * 2] = corners[k][0];
      quads[vi * 2 + 1] = corners[k][1];
    }
    const i0 = i * 6;
    indices[i0] = v0;
    indices[i0 + 1] = v0 + 1;
    indices[i0 + 2] = v0 + 2;
    indices[i0 + 3] = v0;
    indices[i0 + 4] = v0 + 2;
    indices[i0 + 5] = v0 + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aQuad', new THREE.BufferAttribute(quads, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uCamPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uWind: { value: new THREE.Vector3(-9.5, 0, 5.2) },
      uLightning: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 25;
  return { mesh, mat };
}

export function createTerrenoStorm(geomorph, water, atmoUniforms) {
  const group = new THREE.Group();
  group.name = 'TERRENO_SevereStormSystem';

  // 1. GPU Diagonal Torrential Rain Curtain
  const rain = buildRainMesh(3600);
  group.add(rain.mesh);

  // 2. 8 Dynamic 3D Landslide Mounds, Fallen Granite Boulders, & Active Tumbling Rock Debris!
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 0.72, metalness: 0.08 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x52565c, roughness: 0.84, metalness: 0.06 });
  const landslides = [];

  LANDSLIDE_SITES.forEach((site, idx) => {
    const baseY = geomorph.getHeightAt(site.x, site.z);
    const lsGroup = new THREE.Group();
    lsGroup.position.set(site.x, baseY, site.z);
    lsGroup.visible = false;
    group.add(lsGroup);

    // Sculpted wet mudslide lobe cone/dome
    const moundGeo = new THREE.ConeGeometry(site.radius * 0.92, site.peakH * 2.0, 18, 2);
    const pos = moundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const n = Math.sin(px * 0.55 + idx) * Math.cos(pz * 0.48 - idx * 2) * 0.22;
      pos.setY(i, py * 0.5 + n * (py > 0 ? 1.0 : 0.2));
    }
    moundGeo.computeVertexNormals();
    const mound = new THREE.Mesh(moundGeo, mudMat);
    mound.position.y = site.peakH * 0.15;
    mound.receiveShadow = true;
    lsGroup.add(mound);

    // 7 Fallen jagged granite boulders resting on the mudslide lobe (with real dynamic colliders!)
    const colliders = [];
    const tumblingRocks = [];
    for (let b = 0; b < 7; b++) {
      const ang = (b / 7) * Math.PI * 2 + idx * 0.7;
      const dist = (0.18 + ((b * 37) % 10) * 0.06) * site.radius;
      const bx = Math.cos(ang) * dist;
      const bz = Math.sin(ang) * dist;
      const br = 0.65 + (b % 3) * 0.42;
      const bMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(br, 0), rockMat);
      const localH = Math.max(0.05, site.peakH * (1 - dist / site.radius));
      bMesh.position.set(bx, localH * 0.65 + br * 0.35, bz);
      bMesh.rotation.set(b * 0.8, b * 1.3, b * 0.5);
      bMesh.scale.set(1.15, 0.78, 0.95);
      lsGroup.add(bMesh);
      colliders.push({
        x: site.x + bx,
        z: site.z + bz,
        r: br * 0.85,
        kind: 'landslide_rock',
        height: br * 1.15,
        isLandslide: true,
      });
    }

    // 5 animated tumbling debris boulders that visibly cascade down the slope while storm rages!
    for (let t = 0; t < 5; t++) {
      const tr = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + (t % 2) * 0.24, 0), rockMat);
      lsGroup.add(tr);
      tumblingRocks.push({ mesh: tr, phase: t * 0.2, offsetSide: (t - 2) * 2.4 });
    }

    landslides.push({
      ...site,
      baseY,
      group: lsGroup,
      colliders,
      tumblingRocks,
      progress: 0.0, // 0 = dormant, 1 = fully slumped mudslide blocking slope/road
    });
  });

  // 3. Lightning Bolt Visual Flash Sheet in Distance
  const boltGeo = new THREE.BufferGeometry();
  const boltVerts = new Float32Array(12 * 3);
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltVerts, 3));
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.0 });
  const boltLine = new THREE.Line(boltGeo, boltMat);
  boltLine.frustumCulled = false;
  group.add(boltLine);

  // Baseline calm daylight atmosphere snapshot so turning storm OFF restores pristine daylight!
  const calmSnap = {
    sunIntensity: atmoUniforms.uSunIntensity.value,
    hemiIntensity: atmoUniforms.uHemiIntensity.value,
    skyZenith: atmoUniforms.uSkyZenith.value.clone(),
    skyHorizon: atmoUniforms.uSkyHorizon.value.clone(),
    skyGlow: atmoUniforms.uSkyGlow.value.clone(),
    valleyFogColor: atmoUniforms.uValleyFogColor.value.clone(),
    aerialFogColor: atmoUniforms.uAerialFogColor.value.clone(),
    valleyFogDensity: atmoUniforms.uValleyFogDensity.value,
    aerialDensity: atmoUniforms.uAerialDensity.value,
    cloudBrightness: atmoUniforms.uCloudBrightness.value,
  };

  let stormEnabled = false;
  let intensity = 0.0;       // 0..1 smooth storm severity
  let floodRise = 0.0;       // 0..7.5 m river water surge
  let lightningFlash = 0.0;
  let nextLightningTimer = 2.8;
  let thunderCallback = null;
  const windVec = new THREE.Vector3(-10.5, 0, 6.0);

  function triggerLightning(camPos) {
    lightningFlash = 1.0;
    const ang = Math.random() * Math.PI * 2;
    const dist = 160 + Math.random() * 480;
    const bx = camPos.x + Math.cos(ang) * dist;
    const bz = camPos.z + Math.sin(ang) * dist;
    const groundY = geomorph.getHeightAt(bx, bz);
    const arr = boltGeo.attributes.position.array;
    for (let i = 0; i < 12; i++) {
      const f = i / 11;
      const jitter = (1 - f) * 18;
      arr[i * 3] = bx + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 1] = groundY + (1 - f) * 420;
      arr[i * 3 + 2] = bz + (Math.random() - 0.5) * jitter;
    }
    boltGeo.attributes.position.needsUpdate = true;
    if (thunderCallback) thunderCallback(dist);
  }

  function setStormEnabled(enabled, instant = false) {
    stormEnabled = Boolean(enabled);
    if (instant) {
      intensity = stormEnabled ? 1.0 : 0.0;
      floodRise = stormEnabled ? 7.5 : 0.0;
      landslides.forEach((ls) => {
        ls.progress = stormEnabled ? 1.0 : 0.0;
        ls.group.visible = stormEnabled;
        ls.group.scale.y = stormEnabled ? 1.0 : 0.01;
      });
      if (water && water.setFlood) water.setFlood(floodRise, intensity);
      _applyStormAtmosphere();
    }
    return stormEnabled;
  }

  const stormSkyZenith = new THREE.Color(0.035, 0.055, 0.088);
  const stormSkyHorizon = new THREE.Color(0.14, 0.19, 0.24);
  const stormSkyGlow = new THREE.Color(0.24, 0.30, 0.36);
  const stormValleyFog = new THREE.Color(0.16, 0.20, 0.24);
  const stormAerialFog = new THREE.Color(0.13, 0.18, 0.23);

  function _lerpColorOrVec(dst, a, b, t) {
    if (dst.lerpColors) {
      dst.lerpColors(a, b, t);
    } else if (dst.lerpVectors) {
      dst.lerpVectors(a, b, t);
    }
  }

  function _applyStormAtmosphere() {
    const s = intensity;
    const flashBoost = lightningFlash * 2.4;
    atmoUniforms.uSunIntensity.value = calmSnap.sunIntensity * (1.0 - s * 0.72) + flashBoost;
    atmoUniforms.uHemiIntensity.value = calmSnap.hemiIntensity * (1.0 - s * 0.42) + flashBoost * 0.45;
    _lerpColorOrVec(atmoUniforms.uSkyZenith.value, calmSnap.skyZenith, stormSkyZenith, s);
    _lerpColorOrVec(atmoUniforms.uSkyHorizon.value, calmSnap.skyHorizon, stormSkyHorizon, s);
    _lerpColorOrVec(atmoUniforms.uSkyGlow.value, calmSnap.skyGlow, stormSkyGlow, s);
    _lerpColorOrVec(atmoUniforms.uValleyFogColor.value, calmSnap.valleyFogColor, stormValleyFog, s);
    _lerpColorOrVec(atmoUniforms.uAerialFogColor.value, calmSnap.aerialFogColor, stormAerialFog, s);
    atmoUniforms.uValleyFogDensity.value = calmSnap.valleyFogDensity + s * 0.0022;
    atmoUniforms.uAerialDensity.value = calmSnap.aerialDensity + s * 0.00055;
    atmoUniforms.uCloudBrightness.value = calmSnap.cloudBrightness * (1.0 - s * 0.68) + flashBoost * 0.3;
  }

  function update(cameraPos, dt, elapsed) {
    const targetI = stormEnabled ? 1.0 : 0.0;
    if (Math.abs(intensity - targetI) > 0.001) {
      intensity += (targetI - intensity) * Math.min(1, dt * (stormEnabled ? 0.55 : 0.85));
      if (Math.abs(intensity - targetI) < 0.004) intensity = targetI;
    }

    // Floodwater rises dramatically up to +7.5m during extreme storm!
    const targetFlood = intensity * 7.5;
    floodRise += (targetFlood - floodRise) * Math.min(1, dt * 0.42);
    if (water && water.setFlood) {
      water.setFlood(floodRise, intensity);
    }

    // Howling shifting storm wind gusts
    const gust = 1.0 + Math.sin(elapsed * 1.4) * 0.35 + Math.cos(elapsed * 3.1) * 0.20;
    windVec.set(-11.5 * intensity * gust, 0, 6.2 * intensity * gust);

    // Lightning cadence & decay
    if (intensity > 0.45) {
      nextLightningTimer -= dt;
      if (nextLightningTimer <= 0) {
        triggerLightning(cameraPos);
        nextLightningTimer = 4.2 + Math.random() * 7.5;
      }
    }
    lightningFlash = Math.max(0, lightningFlash - dt * 4.2);
    boltMat.opacity = lightningFlash > 0.2 ? lightningFlash * 0.95 : 0.0;

    // Rain shader uniforms
    rain.mat.uniforms.uCamPos.value.copy(cameraPos);
    rain.mat.uniforms.uTime.value = elapsed;
    rain.mat.uniforms.uIntensity.value = intensity;
    rain.mat.uniforms.uWind.value.copy(windVec);
    rain.mat.uniforms.uLightning.value = lightningFlash;

    // Landslide slump progression & live cascading debris animation
    for (let i = 0; i < landslides.length; i++) {
      const ls = landslides[i];
      const targetP = intensity > 0.25 ? Math.min(1.0, (intensity - 0.25) / 0.55) : 0.0;
      ls.progress += (targetP - ls.progress) * Math.min(1, dt * 0.45);
      ls.group.visible = ls.progress > 0.02;
      if (ls.group.visible) {
        ls.group.scale.y = Math.max(0.05, ls.progress);
        // Animate active tumbling boulders rushing downslope while storm is raging
        for (let t = 0; t < ls.tumblingRocks.length; t++) {
          const tr = ls.tumblingRocks[t];
          const cyc = (elapsed * 0.48 + tr.phase) % 1.0;
          const upDist = (1.0 - cyc) * 18.0;
          const downDist = cyc * ls.radius * 0.9;
          const ox = -ls.slopeDirX * upDist + ls.slopeDirX * downDist - ls.slopeDirZ * tr.offsetSide;
          const oz = -ls.slopeDirZ * upDist + ls.slopeDirZ * downDist + ls.slopeDirX * tr.offsetSide;
          const wy = geomorph.getHeightAt(ls.x + ox, ls.z + oz) - ls.baseY;
          tr.mesh.position.set(ox, wy + 0.35 + Math.sin(cyc * Math.PI * 6) * 0.25, oz);
          tr.mesh.rotation.x += dt * 4.2;
          tr.mesh.rotation.z += dt * 3.1;
          tr.mesh.visible = intensity > 0.35;
        }
      }
    }

    _applyStormAtmosphere();
  }

  /**
   * Exact flood depth & hydrodynamic current push at world (wx, wz).
   */
  function getFloodInfoAt(wx, wz) {
    const rv = evalMainRiver(wz);
    const effectiveWaterY = rv.waterY + floodRise;
    const effectiveHalfW = rv.halfWidth + floodRise * 11.2;
    const distRiv = Math.abs(wx - rv.x);
    if (distRiv > effectiveHalfW + 12.0) {
      return { depth: 0, submerged: false, currentX: 0, currentZ: 0, waterY: effectiveWaterY };
    }
    const groundY = geomorph.getHeightAt(wx, wz);
    const depth = Math.max(0, effectiveWaterY - groundY);
    if (depth <= 0.02) {
      return { depth: 0, submerged: false, currentX: 0, currentZ: 0, waterY: effectiveWaterY };
    }
    // River flows North (-Z) -> South (+Z); torrent speed scales steeply with floodRise!
    const speed = (1.4 + floodRise * 0.85) * Math.min(1.0, depth / 0.8);
    return {
      depth,
      submerged: depth > 0.12,
      currentX: (wx - rv.x) * 0.015 * speed,
      currentZ: speed,
      waterY: effectiveWaterY,
    };
  }

  /**
   * Extra terrain height and mud/rock hazard info from active landslides at (wx, wz).
   */
  function getLandslideInfoAt(wx, wz) {
    let heightAdd = 0;
    let mudFactor = 0;
    for (let i = 0; i < landslides.length; i++) {
      const ls = landslides[i];
      if (ls.progress <= 0.05) continue;
      const d = Math.hypot(wx - ls.x, wz - ls.z);
      if (d < ls.radius) {
        const t = 1.0 - d / ls.radius;
        heightAdd = Math.max(heightAdd, t * t * ls.peakH * ls.progress);
        mudFactor = Math.max(mudFactor, t * ls.progress);
      }
    }
    return { heightAdd, mudFactor };
  }

  function getActiveLandslideColliders() {
    const out = [];
    for (let i = 0; i < landslides.length; i++) {
      const ls = landslides[i];
      if (ls.progress > 0.30) {
        for (let j = 0; j < ls.colliders.length; j++) out.push(ls.colliders[j]);
      }
    }
    return out;
  }

  /**
   * Physical tire traction coefficient μ ∈ [0.18 .. 0.96] for authentic wet mud / hydroplaning slip!
   */
  function getSurfaceGripAt(wx, wz) {
    const baseDry = 0.96;
    if (intensity <= 0.01) return baseDry;
    const flood = getFloodInfoAt(wx, wz);
    const ls = getLandslideInfoAt(wx, wz);
    // Rain-slicked gravel/mud drops traction sharply; standing floodwater & fresh mudslides cause severe hydroplaning!
    let grip = baseDry - intensity * 0.56;
    if (flood.depth > 0.08) grip -= Math.min(0.22, flood.depth * 0.14);
    if (ls.mudFactor > 0.05) grip -= ls.mudFactor * 0.24;
    return Math.max(0.18, Math.min(0.96, grip));
  }

  return {
    group,
    landslides,
    setStormEnabled,
    isStormEnabled: () => stormEnabled,
    getIntensity: () => intensity,
    getFloodRise: () => floodRise,
    getWind: () => windVec,
    getLightningFlash: () => lightningFlash,
    setThunderCallback: (cb) => { thunderCallback = cb; },
    update,
    getFloodInfoAt,
    getLandslideInfoAt,
    getActiveLandslideColliders,
    getSurfaceGripAt,
  };
}
