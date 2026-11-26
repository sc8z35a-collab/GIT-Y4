import * as THREE from 'three';
import { TERRENO_WORLD } from './terrenoConfig.js';
import { GEOLOGY_PROCESS_CATALOG_100 } from './terrenoGeologyEngine.js';

/**
 * TERRENO 6.0 — Zero-Artificiality Natural Basin Water Table & Geothermal Vapor Layer
 * (100% synced to TERRENO 6.0 CPU/GPU `evalSharedCliffAndStrataRelief`, ZERO artificial primitives!)
 */

function createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, opts = {}) {
  const deepCol = opts.deepCol || new THREE.Color(0.03, 0.17, 0.28);
  const shallowCol = opts.shallowCol || new THREE.Color(0.14, 0.44, 0.48);
  const absorb = opts.absorb || new THREE.Vector3(0.75, 0.28, 0.22);
  const maxOpacity = opts.maxOpacity ?? 0.94;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    uniforms: {
      uGeoMap: { value: geomorph.geoTexture },
      uNormalMap: { value: geomorph.normalTexture },
      uMicroNoiseTex: { value: geomorph.microNoiseTexture },
      uWorldMin: { value: new THREE.Vector2(TERRENO_WORLD.minX, TERRENO_WORLD.minZ) },
      uWorldSize: { value: new THREE.Vector2(TERRENO_WORLD.width, TERRENO_WORLD.depth) },
      uAtlasSize: { value: new THREE.Vector2(geomorph.W, geomorph.H) },
      uTime: atmoUniforms.uTime,
      uSunDir: atmoUniforms.uSunDir,
      uSunColor: atmoUniforms.uSunColor,
      uDeepCol: { value: deepCol },
      uShallowCol: { value: shallowCol },
      uAbsorb: { value: absorb },
      uMaxOpacity: { value: maxOpacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      #ifdef USE_LOGDEPTHBUF
        varying float vFragDepth;
        varying float vIsPerspective;
      #endif
      uniform float uTime;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(dot(wp.xz, vec2(0.24, 0.17)) + uTime * 1.45) * 0.018;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        #ifdef USE_LOGDEPTHBUF
          vFragDepth = 1.0 + gl_Position.w;
          vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      #include <logdepthbuf_pars_fragment>

      uniform sampler2D uGeoMap;
      uniform sampler2D uNormalMap;
      uniform sampler2D uMicroNoiseTex;
      uniform vec2 uWorldMin;
      uniform vec2 uWorldSize;
      uniform vec2 uAtlasSize;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uDeepCol;
      uniform vec3 uShallowCol;
      uniform vec3 uAbsorb;
      uniform float uMaxOpacity;

      float sampleMicroLut(vec2 p) {
        return texture2D(uMicroNoiseTex, (p + 0.5) / 256.0).r;
      }

      float evalSharedCliffAndStrataRelief(vec2 xz, float macroSlope, float suppressFactor, float macroH) {
        if (suppressFactor >= 0.999) return 0.0;
        vec4 m0 = texture2D(uMicroNoiseTex, (xz * 0.024 + 0.5) / 256.0);
        float micro = (m0.r - 0.5) * 1.15 + (m0.g - 0.5) * 0.52 + (m0.b - 0.5) * 0.22;
        if (macroSlope > 0.24) {
          float cliffT = clamp((macroSlope - 0.24) / 0.58, 0.0, 1.0);
          float cliffSq = cliffT * cliffT;
          vec4 m1 = texture2D(uMicroNoiseTex, (xz * 0.056 + vec2(7.4, -3.9) + 0.5) / 256.0);
          float ridge1 = 1.0 - abs(m1.r * 2.0 - 1.0);
          float ridge2 = 1.0 - abs(m1.b * 2.0 - 1.0);
          float crag = (ridge1 * ridge1 - 0.42) * 5.8 + (ridge2 * ridge2 - 0.42) * 1.95;
          float sp = fract(macroH * 0.11 + (m0.r - 0.5) * 1.35);
          float tri = 1.0 - abs(sp * 4.0 - 2.0);
          micro += (crag + (tri * tri * tri) * 2.85) * cliffSq;
        }
        return micro * (1.0 - suppressFactor);
      }

      vec4 sampleGeoBilinear(vec2 xz) {
        vec2 gridPos = ((xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0);
        gridPos = clamp(gridPos, vec2(0.0), uAtlasSize - 1.0001);
        vec2 i0 = floor(gridPos);
        vec2 f = gridPos - i0;
        vec2 invS = 1.0 / uAtlasSize;
        vec4 c00 = texture2D(uGeoMap, (i0 + vec2(0.5, 0.5)) * invS);
        vec4 c10 = texture2D(uGeoMap, (i0 + vec2(1.5, 0.5)) * invS);
        vec4 c01 = texture2D(uGeoMap, (i0 + vec2(0.5, 1.5)) * invS);
        vec4 c11 = texture2D(uGeoMap, (i0 + vec2(1.5, 1.5)) * invS);
        return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
      }

      void main() {
        float edgeMask = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x)
                       * smoothstep(0.0, 0.07, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
        if (edgeMask < 0.01) discard;

        vec4 geo = sampleGeoBilinear(vWorldPos.xz);
        vec2 atlasUv = clamp((((vWorldPos.xz - uWorldMin) / uWorldSize) * (uAtlasSize - 1.0) + 0.5) / uAtlasSize, 0.0005, 0.9995);
        float macroSlope = texture2D(uNormalMap, atlasUv).b / 0.45;
        float terrainY = geo.r + evalSharedCliffAndStrataRelief(vWorldPos.xz, macroSlope, geo.a, geo.r);
        float depth = vWorldPos.y - terrainY;
        if (depth <= 0.01) discard;

        vec2 wp2 = vWorldPos.xz;
        float w1 = sin(dot(wp2, vec2(0.53, 0.31)) + uTime * 1.75);
        float w2 = sin(dot(wp2, vec2(-0.41, 0.77)) - uTime * 1.42 + w1 * 0.42);
        float w3 = sin(dot(wp2, vec2(0.97, -0.63)) + uTime * 2.35 + w2 * 0.32);
        float fineRip = (sampleMicroLut(wp2 * 0.85 + vec2(uTime * 0.35, -uTime * 0.28)) - 0.5) * 0.04;
        vec3 nrm = normalize(vec3(
          (w1 * 0.45 + w2 * 0.35 + w3 * 0.20) * 0.045 + fineRip,
          1.0,
          (w2 * 0.45 - w3 * 0.35 + w1 * 0.20) * 0.045 - fineRip
        ));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float ndv = max(0.02, dot(viewDir, nrm));
        float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 4.2);

        // Physical Beer-Lambert depth tint (clear shallows -> rich sapphire / emerald / peat depths)
        vec3 trans = exp(-uAbsorb * max(0.0, depth));
        vec3 waterBody = mix(uDeepCol, uShallowCol, clamp((trans.r + trans.g + trans.b) * 0.33, 0.0, 1.0));

        // Mountain canopy & sky Fresnel reflection + subtle solar sparkle
        vec3 skyRefl = mix(vec3(0.32, 0.48, 0.62), uSunColor, 0.22);
        vec3 hVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(0.0, dot(nrm, hVec)), 160.0) * 0.72;
        vec3 col = mix(waterBody, skyRefl, clamp(fresnel * 0.76, 0.0, 0.78)) + uSunColor * spec;

        // Distance aerial perspective haze matching TERRENO sky
        float camDist = length(cameraPosition - vWorldPos);
        float fogT = 1.0 - exp(-camDist * 0.000048);
        col = mix(col, vec3(0.62, 0.72, 0.82), clamp(fogT * 0.65, 0.0, 0.70));

        // Razor-natural shoreline feathering right where water meets soil/cobbles
        float shoreAlpha = smoothstep(0.01, 0.52, depth);
        float alpha = shoreAlpha * edgeMask * mix(0.68, uMaxOpacity, smoothstep(0.25, 3.5, depth));
        if (alpha < 0.02) discard;

        gl_FragColor = vec4(col, alpha);
        #include <logdepthbuf_fragment>
      }
    `,
  });
}

function createGeothermalVaporMaterial(atmoUniforms) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uColor: { value: new THREE.Color(0.92, 0.94, 0.95) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #ifdef USE_LOGDEPTHBUF
        varying float vFragDepth;
        varying float vIsPerspective;
      #endif
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.x += sin(uv.y * 3.8 + uTime * 0.75) * 1.4 * uv.y;
        p.z += cos(uv.y * 3.2 - uTime * 0.62) * 1.1 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        #ifdef USE_LOGDEPTHBUF
          vFragDepth = 1.0 + gl_Position.w;
          vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      uniform vec3 uColor;
      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float rad = length(c);
        if (rad >= 1.0) discard;
        // Strict quadratic radial fade -> ZERO quad edges ever visible!
        float softDisk = pow(1.0 - rad * rad, 2.4);
        float wisp = 0.5 + 0.5 * sin(vUv.x * 6.0 + uTime * 0.65) * cos(vUv.y * 5.0 - uTime * 0.95);
        float a = softDisk * (0.35 + 0.65 * wisp) * 0.16;
        if (a < 0.008) discard;
        gl_FragColor = vec4(uColor, a);
        #include <logdepthbuf_fragment>
      }
    `,
  });
}

export function createTerrenoNaturalLocations(geomorph, atmoUniforms) {
  const root = new THREE.Group();
  root.name = 'TERRENO_NaturalBasinWaters';

  const geoState = geomorph.geologyState || {};
  const waterBasins = geoState.emergentWaterBasins || [];
  const vaporSites = geoState.emergentVaporSites || [];

  // Shared physical water palettes keyed by real hydrological lake genesis
  const waterMats = {
    caldera: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.02, 0.10, 0.28),
      shallowCol: new THREE.Color(0.10, 0.34, 0.50),
      absorb: new THREE.Vector3(0.62, 0.24, 0.14),
      maxOpacity: 0.96,
    }),
    tarn: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.04, 0.28, 0.38),
      shallowCol: new THREE.Color(0.22, 0.60, 0.64),
      absorb: new THREE.Vector3(0.82, 0.24, 0.20),
      maxOpacity: 0.94,
    }),
    maar: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.02, 0.15, 0.22),
      shallowCol: new THREE.Color(0.10, 0.34, 0.36),
      absorb: new THREE.Vector3(0.76, 0.30, 0.24),
      maxOpacity: 0.95,
    }),
    oxbow: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.05, 0.18, 0.17),
      shallowCol: new THREE.Color(0.18, 0.36, 0.30),
      absorb: new THREE.Vector3(0.95, 0.42, 0.38),
      maxOpacity: 0.93,
    }),
    dammed: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.03, 0.20, 0.26),
      shallowCol: new THREE.Color(0.16, 0.48, 0.48),
      absorb: new THREE.Vector3(0.84, 0.28, 0.26),
      maxOpacity: 0.94,
    }),
    kettle: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.04, 0.16, 0.18),
      shallowCol: new THREE.Color(0.15, 0.36, 0.34),
      absorb: new THREE.Vector3(0.90, 0.38, 0.34),
      maxOpacity: 0.92,
    }),
    bog: createTerrainClippedBasinWaterMaterial(geomorph, atmoUniforms, {
      deepCol: new THREE.Color(0.06, 0.12, 0.10),
      shallowCol: new THREE.Color(0.18, 0.26, 0.20),
      absorb: new THREE.Vector3(1.15, 0.65, 0.58),
      maxOpacity: 0.90,
    }),
  };

  const vaporMat = createGeothermalVaporMaterial(atmoUniforms);
  const visEntries = [];

  // 1. Mount ONLY Terrain-Clipped Natural Basin Water Sheets (ZERO artificial rims/circles/props!)
  for (let i = 0; i < waterBasins.length; i++) {
    const b = waterBasins[i];
    const mat = waterMats[b.lakeKind] || waterMats.dammed;
    const segsX = Math.max(8, Math.min(32, Math.round(b.spanX / 45)));
    const segsZ = Math.max(8, Math.min(32, Math.round(b.spanZ / 45)));
    const geo = new THREE.PlaneGeometry(b.spanX, b.spanZ, segsX, segsZ);
    geo.rotateX(-Math.PI * 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `NATURAL_WATER_${b.id}`;
    mesh.position.set(b.cx, b.waterY, b.cz);
    mesh.renderOrder = 3;
    root.add(mesh);

    const maxVisDist = Math.max(4500, Math.hypot(b.spanX, b.spanZ) * 8.5);
    visEntries.push({ obj: mesh, x: b.cx, z: b.cz, maxVisDist });
  }

  // 2. Ultra-subtle ground-hugging natural geothermal vapor wisps in fumarole / travertine zones
  const getGround = (wx, wz) => (
    typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(wx, wz)
      : geomorph.getHeightAt(wx, wz)
  );
  for (let i = 0; i < vaporSites.length; i++) {
    const v = vaporSites[i];
    const g = new THREE.Group();
    g.name = `GEOTHERMAL_VAPOR_${v.id}`;
    const by = getGround(v.x, v.z);
    for (let k = 0; k < 3; k++) {
      const ang = (k / 3) * Math.PI + (i * 0.7);
      const ox = Math.cos(ang) * (v.radius * 0.22);
      const oz = Math.sin(ang) * (v.radius * 0.22);
      const wy = getGround(v.x + ox, v.z + oz);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(34, 14, 2, 2), vaporMat);
      plane.position.set(v.x + ox, wy + 5.2, v.z + oz);
      plane.rotation.y = ang;
      plane.renderOrder = 5;
      g.add(plane);
    }
    root.add(g);
    visEntries.push({ obj: g, x: v.x, z: v.z, maxVisDist: 3200 });
  }

  function update(cameraPos) {
    if (!cameraPos) return;
    for (let i = 0; i < visEntries.length; i++) {
      const e = visEntries[i];
      const dx = cameraPos.x - e.x;
      const dz = cameraPos.z - e.z;
      e.obj.visible = (dx * dx + dz * dz) < (e.maxVisDist * e.maxVisDist);
    }
  }

  return {
    group: root,
    locations: GEOLOGY_PROCESS_CATALOG_100,
    waterBasins,
    vaporSites,
    update,
    getStats: () => ({
      totalLandforms: GEOLOGY_PROCESS_CATALOG_100.length,
      newLandformsV5: GEOLOGY_PROCESS_CATALOG_100.filter((l) => l.isNewV5).length,
      newLandformsV6: GEOLOGY_PROCESS_CATALOG_100.filter((l) => l.isNewV6).length,
      activeProcessCount: geoState.activeProcessCount || 0,
      multiOccurrenceFeatures: (geoState.features || []).length,
      naturalWaterBasins: waterBasins.length,
      geothermalVaporSites: vaporSites.length,
      primitivePropsCount: 0,
    }),
  };
}
