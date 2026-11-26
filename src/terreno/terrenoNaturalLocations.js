import * as THREE from 'three';
import { MAJOR_LANDFORMS_22 } from './terrenoLandforms.js';
import { evalMainRiver } from './terrenoConfig.js';

/**
 * TERRENO 4.0 — 3D Geological & Hydrological Natural Locations Builder
 *
 * Constructs high-craft animated 3D formations for ALL 22 real-world landforms:
 *  - Animated multi-tier waterfalls, Shiraito veil ribbons & mossy stepped cascades
 *  - Foaming plunge pools, caldera crater lake, glacial tarn lake & 14 highland bog-pools
 *  - Rising sunlit waterfall spray & geothermal hot-spring steam plumes
 *  - Hexagonal columnar basalt cliffs (95+ prisms), monumental drive-under natural stone arch,
 *    vaulted mossy limestone cave grotto with stalactites, steaming turquoise travertine sinter
 *    terraces, white karst limestone pinnacles, 16 stacked granite hoodoo spires, talus boulder
 *    chute slabs, gorge buttress crags, mesa basalt rims, cuesta ledges, scoria boulders & more!
 */

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296.0;
  };
}

function makeRockTexture(baseHex, veinHex, mossAmt = 0.25, seed = 17) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const rng = makeRng(seed);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Stratified sedimentary / volcanic banding
  for (let y = 0; y < 256; y += 3) {
    const a = 0.04 + rng() * 0.10;
    ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a * 0.6})` : `rgba(12,16,20,${a})`;
    ctx.fillRect(0, y, 256, 2 + Math.floor(rng() * 4));
  }
  // Fractures & mineral grain
  ctx.strokeStyle = veinHex;
  for (let i = 0; i < 42; i++) {
    ctx.globalAlpha = 0.14 + rng() * 0.22;
    ctx.lineWidth = 0.8 + rng() * 1.8;
    ctx.beginPath();
    let x = rng() * 256;
    let y = rng() * 256;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rng() - 0.5) * 44;
      y += (rng() - 0.5) * 32;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Organic damp lichen / emerald moss patches near upper edges
  if (mossAmt > 0.01) {
    for (let i = 0; i < Math.floor(90 * mossAmt); i++) {
      ctx.globalAlpha = 0.16 + rng() * 0.28;
      ctx.fillStyle = rng() > 0.35 ? '#355427' : '#4d6f32';
      const rx = rng() * 256;
      const ry = rng() * 115;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 4 + rng() * 16, 3 + rng() * 10, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaterfallMaterial(atmoUniforms, opts = {}) {
  const speed = opts.speed ?? 1.55;
  const veil = opts.veil ? 1.0 : 0.0;
  const tint = opts.tint || new THREE.Color(0.72, 0.90, 0.96);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uSunDir: atmoUniforms.uSunDir,
      uSunColor: atmoUniforms.uSunColor,
      uSpeed: { value: speed },
      uVeil: { value: veil },
      uTint: { value: tint },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldN;
      #ifdef USE_LOGDEPTHBUF
        varying float vFragDepth;
        varying float vIsPerspective;
      #endif
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float sway = sin(uv.y * 9.0 - uTime * 7.5 + uv.x * 12.0) * 0.16 * sin(uv.y * 3.14159);
        p.z += sway;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vWorldN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
        #ifdef USE_LOGDEPTHBUF
          vFragDepth = 1.0 + gl_Position.w;
          vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldN;
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSpeed;
      uniform float uVeil;
      uniform vec3 uTint;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        // Gravity-accelerated downward waterfall flow (vUv.y = 1 at crest, 0 at plunge pool)
        float fallT = uTime * uSpeed;
        float stretchY = vUv.y * 3.8 + fallT * (1.25 + (1.0 - vUv.y) * 0.45);
        float streak1 = vnoise(vec2(vUv.x * (uVeil > 0.5 ? 24.0 : 12.0), stretchY));
        float streak2 = vnoise(vec2(vUv.x * (uVeil > 0.5 ? 48.0 : 26.0) + 4.2, stretchY * 1.65 + fallT * 0.7));
        float foamStreak = smoothstep(0.28, 0.78, streak1 * 0.62 + streak2 * 0.52);

        // Crest lip & bottom plunge foam bursts
        float topCrest = smoothstep(0.82, 1.0, vUv.y) * 0.76;
        float bottomChurn = smoothstep(0.26, 0.0, vUv.y) * 0.90;
        float foam = clamp(foamStreak * 0.86 + topCrest + bottomChurn, 0.0, 1.0);

        // Soft organic horizontal edge & top/bottom feathering
        float edgeX = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float edgeY = smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
        float ribMask = uVeil > 0.5
          ? smoothstep(0.26, 0.72, 0.5 + 0.5 * sin(vUv.x * 3.14159 * 14.0 + streak1 * 1.4))
          : 1.0;

        float ndl = max(0.45, dot(normalize(vWorldN), normalize(uSunDir)) * 0.55 + 0.45);
        vec3 waterCol = mix(uTint * 0.70, vec3(0.96, 0.99, 1.0), foam);
        waterCol *= (0.76 + 0.36 * ndl) * mix(vec3(1.0), uSunColor, 0.22);

        float alpha = edgeX * edgeY * ribMask * clamp(0.52 + foam * 0.46, 0.0, 0.96);
        if (alpha < 0.04) discard;
        gl_FragColor = vec4(waterCol, alpha);
        #include <logdepthbuf_fragment>
      }
    `,
  });
}

function createNaturalPoolMaterial(atmoUniforms, opts = {}) {
  const deepCol = opts.deepCol || new THREE.Color(0.05, 0.26, 0.34);
  const shallowCol = opts.shallowCol || new THREE.Color(0.22, 0.64, 0.68);
  const foamRing = opts.foamRing ?? 0.0;
  const opacity = opts.opacity ?? 0.90;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uSunDir: atmoUniforms.uSunDir,
      uSunColor: atmoUniforms.uSunColor,
      uDeepCol: { value: deepCol },
      uShallowCol: { value: shallowCol },
      uFoamRing: { value: foamRing },
      uOpacity: { value: opacity },
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
        wp.y += sin(wp.x * 0.35 + uTime * 1.8) * cos(wp.z * 0.35 - uTime * 1.4) * 0.045;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
        #ifdef USE_LOGDEPTHBUF
          vFragDepth = 1.0 + gl_Position.w;
          vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uDeepCol;
      uniform vec3 uShallowCol;
      uniform float uFoamRing;
      uniform float uOpacity;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        // 3-angle irrational organic water wavelets + Fresnel sky sheen (no Cartesian grid!)
        vec2 wp2 = vWorldPos.xz;
        float w1 = sin(dot(wp2, vec2(0.73, 0.41)) + uTime * 2.1);
        float w2 = sin(dot(wp2, vec2(-0.52, 0.89)) - uTime * 1.7 + w1 * 0.45);
        float w3 = sin(dot(wp2, vec2(1.18, -0.77)) + uTime * 2.9 + w2 * 0.35);
        float radWave = sin(r * 22.0 - uTime * 4.4) * 0.5 + 0.5;
        vec3 nrm = normalize(vec3((w1 * 0.5 + w2 * 0.35 + w3 * 0.25) * 0.055, 1.0, (w2 * 0.5 - w3 * 0.35 + w1 * 0.2) * 0.055));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, nrm)), 3.2);

        vec3 hVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(0.0, dot(nrm, hVec)), 128.0) * 0.85;

        vec3 base = mix(uDeepCol, uShallowCol, smoothstep(0.15, 0.92, r));
        vec3 skyRefl = mix(vec3(0.46, 0.70, 0.86), uSunColor, 0.25);
        vec3 col = mix(base, skyRefl, clamp(fresnel * 0.62, 0.0, 0.68)) + uSunColor * spec;

        // Waterfall impact whitewater churn & concentric foam rings
        if (uFoamRing > 0.01) {
          float impactF = smoothstep(0.54, 0.06, r) * (0.55 + 0.45 * radWave);
          float shoreF = smoothstep(0.80, 0.98, r) * 0.45;
          col = mix(col, vec3(0.94, 0.98, 1.0), clamp((impactF + shoreF) * uFoamRing, 0.0, 0.92));
        }

        float edgeAlpha = smoothstep(1.0, 0.86, r) * uOpacity;
        gl_FragColor = vec4(col, edgeAlpha);
        #include <logdepthbuf_fragment>
      }
    `,
  });
}

function createMistMaterial(atmoUniforms, warmSteam = false) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uColor: { value: warmSteam ? new THREE.Color(0.96, 0.97, 0.99) : new THREE.Color(0.88, 0.95, 0.99) },
      uAlpha: { value: warmSteam ? 0.30 : 0.34 },
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
        p.x += sin(uv.y * 4.5 + uTime * 1.1) * 0.65 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        #ifdef USE_LOGDEPTHBUF
          vFragDepth = 1.0 + gl_Position.w;
          vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      #include <logdepthbuf_pars_fragment>
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uAlpha;
      void main() {
        float wisp = 0.5 + 0.5 * sin(vUv.x * 7.5 + uTime * 0.9) * cos(vUv.y * 5.2 - uTime * 1.4);
        float rx = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float ry = sin(vUv.y * 3.14159);
        float a = smoothstep(0.0, 0.72, rx) * pow(max(0.0, ry), 1.25) * (0.45 + 0.55 * wisp) * uAlpha;
        if (a < 0.015) discard;
        gl_FragColor = vec4(uColor, a);
        #include <logdepthbuf_fragment>
      }
    `,
  });
}

function makeCraggyRockGeo(rx, ry, rz, seed = 11, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(1.0, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 0.76 + 0.28 * Math.sin(x * 3.9 + seed) * Math.cos(y * 3.3 - seed * 1.3)
      + 0.14 * Math.sin(z * 6.1 + x * 4.2 + seed * 2.1);
    pos.setXYZ(i, x * rx * n, y * ry * n, z * rz * n);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createTerrenoNaturalLocations(geomorph, atmoUniforms) {
  const root = new THREE.Group();
  root.name = 'TERRENO_22_NaturalLocations';

  // Shared procedural rock materials (distinct geology per landform!)
  const matWetGranite = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#3f4648', '#1d2428', 0.65, 101),
    roughness: 0.42, metalness: 0.06,
  });
  const matBasalt = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#2c3138', '#12151a', 0.24, 202),
    roughness: 0.72, metalness: 0.08, flatShading: true,
  });
  const matLimestone = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#c6bfb0', '#867f72', 0.20, 303),
    roughness: 0.84, metalness: 0.02,
  });
  const matTravertine = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#b5aa94', '#867b66', 0.14, 404),
    roughness: 0.72, metalness: 0.03,
  });
  const matDryGranite = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#6c6963', '#3b3935', 0.30, 505),
    roughness: 0.86, metalness: 0.03,
  });
  const matScoria = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#312826', '#161110', 0.04, 606),
    roughness: 0.92, metalness: 0.04,
  });
  const matMossRock = new THREE.MeshStandardMaterial({
    map: makeRockTexture('#46543d', '#242f20', 0.88, 707),
    roughness: 0.68, metalness: 0.02,
  });
  const matWoodBoard = new THREE.MeshStandardMaterial({
    color: 0x6f573f, roughness: 0.88, metalness: 0.02,
  });

  const matWaterfallMain = createWaterfallMaterial(atmoUniforms, { speed: 1.75, veil: false });
  const matWaterfallVeil = createWaterfallMaterial(atmoUniforms, { speed: 1.35, veil: true });
  const matMistSpray = createMistMaterial(atmoUniforms, false);
  const matHotSteam = createMistMaterial(atmoUniforms, true);

  const locEntries = [];

  const getGround = (wx, wz) => (
    typeof geomorph.getTerrainHeightAt === 'function'
      ? geomorph.getTerrainHeightAt(wx, wz)
      : geomorph.getHeightAt(wx, wz)
  );

  // Helper to place a rotated local group anchored cleanly on terrain + exact local ground query
  const makeSiteGroup = (lf) => {
    const g = new THREE.Group();
    g.name = `LANDFORM_${lf.id}`;
    const baseY = getGround(lf.x, lf.z);
    g.position.set(lf.x, baseY, lf.z);
    const angle = lf.angle || 0;
    g.rotation.y = -angle; // local +X aligns with (cosA, sinA) used in heightfield!
    root.add(g);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const localGroundY = (lx, lz) => {
      const wx = lf.x + lx * cosA - lz * sinA;
      const wz = lf.z + lx * sinA + lz * cosA;
      return getGround(wx, wz) - baseY;
    };
    const maxVisDist = lf.hasLake || lf.kind === 'volcanic_mesa' || lf.kind === 'scoria_cone' || lf.kind === 'peat_bog'
      ? 18000 : 4200;
    locEntries.push({ lf, group: g, baseY, maxVisDist });
    return { g, baseY, localGroundY };
  };

  // =========================================================================
  // BUILD ALL 22 REAL-WORLD NATURAL FORMATIONS
  // =========================================================================
  for (let i = 0; i < MAJOR_LANDFORMS_22.length; i++) {
    const lf = MAJOR_LANDFORMS_22[i];
    const rng = makeRng(4100 + lf.index * 997);
    const { g, baseY, localGroundY } = makeSiteGroup(lf);

    if (lf.kind === 'waterfall_multitier') {
      // #1: 黒杉大滝（三段瀑布）— Exact Slope-Grounded 36m 3-Tier Animated Waterfall, Mossy Wet Cliff Shelves, Plunge Pool & Mist!
      const poolCenterX = 18.0;
      const poolR = lf.poolRadius || 24;
      const poolFloorY = localGroundY(poolCenterX, 0);
      const poolY = poolFloorY + 2.4; // water level nestled cleanly inside the natural plunge basin
      const topCrestY = Math.max(poolY + 28.0, localGroundY(-26, 0) + 6.5);
      const totalDrop = topCrestY - poolY;

      const tiers = [
        { x: -21.0, yBot: poolY + totalDrop * 0.64, h: totalDrop * 0.39, w: 12.5, zOff: -1.6 },
        { x: -11.0, yBot: poolY + totalDrop * 0.31, h: totalDrop * 0.37, w: 15.5, zOff: 1.0 },
        { x: -1.0,  yBot: poolY - 0.8,              h: totalDrop * 0.36 + 0.8, w: 18.5, zOff: 0.0 },
      ];

      for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
        const ti = tiers[tIdx];
        const ledgeGroundY = localGroundY(ti.x - 4.5, ti.zOff);
        // Deeply rooted wet mossy granite headwall behind each waterfall tier
        const ledgeH = Math.max(ti.h * 0.72, (ti.yBot + ti.h - ledgeGroundY) * 0.62 + 4.5);
        const ledge = new THREE.Mesh(makeCraggyRockGeo(8.2, ledgeH, ti.w * 0.82, 20 + tIdx * 7, 2), matWetGranite);
        ledge.position.set(ti.x - 5.2, ti.yBot + ti.h - ledgeH * 0.78, ti.zOff);
        g.add(ledge);

        // Grounded towering mossy gorge cliff walls framing left & right of each waterfall tier
        for (const side of [-1, 1]) {
          const wzLocal = ti.zOff + side * (ti.w * 0.56 + 4.2);
          const sideGY = localGroundY(ti.x + 1.5, wzLocal);
          const wallTop = ti.yBot + ti.h + 2.8;
          const wallH = Math.max(8.0, (wallTop - (sideGY - 5.0)) * 0.55);
          const wall = new THREE.Mesh(makeCraggyRockGeo(8.0, wallH, 7.6, 50 + tIdx * 11 + side, 2), matMossRock);
          wall.position.set(ti.x + 1.2, sideGY - 4.0 + wallH * 0.78, wzLocal);
          g.add(wall);
        }

        // Animated forward-arcing waterfall curtain projecting CLEANLY in front of the cliff rock!
        const wGeo = new THREE.PlaneGeometry(ti.w, ti.h, 14, 18);
        const wPos = wGeo.attributes.position;
        for (let k = 0; k < wPos.count; k++) {
          const vy = (wPos.getY(k) / ti.h) + 0.5; // 0 at bottom, 1 at top
          const arcOut = Math.sin((1.0 - vy) * Math.PI * 0.65) * 3.6 + (1.0 - vy) * 2.2;
          wPos.setZ(k, arcOut);
        }
        wGeo.computeVertexNormals();
        const sheet = new THREE.Mesh(wGeo, matWaterfallMain);
        sheet.rotation.y = Math.PI * 0.5; // face local +X (outward toward viewer!)
        sheet.position.set(ti.x + 2.2, ti.yBot + ti.h * 0.5, ti.zOff);
        sheet.renderOrder = 4;
        g.add(sheet);

        // Intermediate turquoise splash pool shelf between upper tiers
        if (tIdx < 2) {
          const midRim = new THREE.Mesh(
            new THREE.CylinderGeometry(ti.w * 0.54, ti.w * 0.64, 5.0, 16),
            matWetGranite,
          );
          midRim.position.set(ti.x + 4.8, ti.yBot - 2.6, ti.zOff);
          g.add(midRim);

          const midPool = new THREE.Mesh(
            new THREE.CircleGeometry(ti.w * 0.50, 24),
            createNaturalPoolMaterial(atmoUniforms, { foamRing: 1.0, opacity: 0.92 }),
          );
          midPool.rotation.x = -Math.PI * 0.5;
          midPool.position.set(ti.x + 4.8, ti.yBot + 0.08, ti.zOff);
          midPool.renderOrder = 3;
          g.add(midPool);
        }
      }

      // Natural mossy granite weir ledge supporting the plunge pool on the downhill mountain slope
      const poolWeir = new THREE.Mesh(
        new THREE.CylinderGeometry(poolR * 1.04, poolR * 1.24, 12.0, 28),
        matWetGranite,
      );
      poolWeir.position.set(poolCenterX, poolY - 6.22, 0);
      g.add(poolWeir);

      // Main churning emerald-turquoise plunge pool at waterfall base!
      const mainPool = new THREE.Mesh(
        new THREE.CircleGeometry(poolR * 0.98, 36),
        createNaturalPoolMaterial(atmoUniforms, {
          deepCol: new THREE.Color(0.04, 0.28, 0.36),
          shallowCol: new THREE.Color(0.24, 0.72, 0.76),
          foamRing: 1.2,
          opacity: 0.94,
        }),
      );
      mainPool.rotation.x = -Math.PI * 0.5;
      mainPool.position.set(poolCenterX, poolY, 0);
      mainPool.renderOrder = 3;
      g.add(mainPool);

      // Rising sunlit waterfall spray mist curtains hovering above the plunge pool!
      for (let m = 0; m < 4; m++) {
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(24, 15, 4, 4), matMistSpray);
        mist.position.set(6.5 + m * 2.6, poolY + 6.8, (m - 1.5) * 4.8);
        mist.rotation.y = Math.PI * 0.5 + (m - 1.5) * 0.32;
        mist.renderOrder = 5;
        g.add(mist);
      }

      // Ring of strictly terrain-grounded wet mossy boulders framing the plunge pool rim (ZERO floating rocks!)
      for (let b = 0; b < 16; b++) {
        const a = -Math.PI * 0.68 + (b / 15) * Math.PI * 1.36;
        const rr = poolR * (0.94 + rng() * 0.14);
        const rx = poolCenterX + Math.cos(a) * rr;
        const rz = Math.sin(a) * rr;
        const groundAtRim = localGroundY(rx, rz);
        const by = Math.min(poolY - 0.1, Math.max(groundAtRim - 0.3, poolY - 1.4));
        const rockH = 1.6 + rng() * 2.1;
        const rock = new THREE.Mesh(makeCraggyRockGeo(2.4 + rng() * 2.6, rockH, 2.4 + rng() * 2.4, b * 17, 1), matMossRock);
        rock.position.set(rx, by + rockH * 0.28, rz);
        g.add(rock);
      }
    } else if (lf.kind === 'waterfall_veil') {
      // #2: 白糸の繊滝（潜流瀑）— Grounded Horseshoe Mossy Basalt Amphitheater with 13 Shimmering Ribbons!
      const poolCenterX = 12.0;
      const poolR = lf.poolRadius || 22;
      const poolY = localGroundY(poolCenterX, 0) + 1.8;
      const cliffR = 24.0;
      const cliffH = lf.cliffHeight || 20;

      const basinWeir = new THREE.Mesh(
        new THREE.CylinderGeometry(poolR * 1.04, poolR * 1.22, 10.0, 24),
        matWetGranite,
      );
      basinWeir.position.set(poolCenterX, poolY - 5.2, 0);
      g.add(basinWeir);

      for (let s = 0; s < 13; s++) {
        const ang = -Math.PI * 0.42 + (s / 12) * Math.PI * 0.84;
        const bx = -Math.cos(ang) * cliffR + poolCenterX;
        const bz = Math.sin(ang) * cliffR;
        const bGround = localGroundY(bx, bz);
        const blkTop = Math.max(poolY + cliffH * 0.85, bGround + 6.5);
        const blkH = Math.max(8.0, (blkTop - (poolY - 5.0)) * 0.56);
        const blk = new THREE.Mesh(makeCraggyRockGeo(6.4, blkH, 6.2, 200 + s * 13, 1), matMossRock);
        blk.position.set(bx - Math.cos(ang) * 2.4, poolY - 4.0 + blkH * 0.82, bz + Math.sin(ang) * 2.4);
        g.add(blk);

        // Delicate shimmering curtain ribbon pouring cleanly down from mossy strata to plunge pool
        const rW = 3.4 + rng() * 2.2;
        const rH = Math.max(10.0, blkTop - poolY - 0.4);
        const rib = new THREE.Mesh(new THREE.PlaneGeometry(rW, rH, 4, 8), matWaterfallVeil);
        rib.position.set(bx + Math.cos(ang) * 2.8, poolY + rH * 0.5, bz - Math.sin(ang) * 2.8);
        rib.rotation.y = Math.PI * 0.5 - ang;
        rib.renderOrder = 4;
        g.add(rib);
      }
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(poolR * 0.98, 32),
        createNaturalPoolMaterial(atmoUniforms, {
          deepCol: new THREE.Color(0.06, 0.34, 0.36),
          shallowCol: new THREE.Color(0.28, 0.74, 0.70),
          foamRing: 0.78, opacity: 0.92,
        }),
      );
      pool.rotation.x = -Math.PI * 0.5;
      pool.position.set(poolCenterX, poolY, 0);
      pool.renderOrder = 3;
      g.add(pool);

      for (let m = 0; m < 3; m++) {
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(22, 10, 4, 4), matMistSpray);
        mist.position.set(4.5, poolY + 4.8, (m - 1) * 10.5);
        mist.rotation.y = Math.PI * 0.5 + (m - 1) * 0.4;
        mist.renderOrder = 5;
        g.add(mist);
      }
    } else if (lf.kind === 'basalt_cliff') {
      // #4: 玄武洞・柱状節理の大断崖 — 96 Deeply-Rooted Towering Hexagonal Volcanic Basalt Columns!
      const colGeo = new THREE.CylinderGeometry(1.0, 1.04, 1.0, 6);
      const count = 96;
      const im = new THREE.InstancedMesh(colGeo, matBasalt, count);
      const dummy = new THREE.Object3D();
      let ci = 0;
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 24 && ci < count; k++) {
          const z = (k - 11.5) * 3.7 + (rng() - 0.5) * 1.0;
          const x = -row * 3.5 + Math.sin(k * 0.42) * 3.0 + (rng() - 0.5) * 1.1;
          const gy = localGroundY(x, z);
          const aboveH = (14.5 + row * 6.5 + rng() * 13.5) * (1.0 - Math.abs(k - 11.5) / 18.0 * 0.42);
          const embedDepth = 11.0; // deeply rooted 11m below hillside so ZERO column bases ever float!
          const totalH = aboveH + embedDepth;
          const rad = 1.65 + rng() * 0.85;
          dummy.position.set(x, gy - embedDepth + totalH * 0.5, z);
          dummy.rotation.set((rng() - 0.5) * 0.04, rng() * Math.PI, (rng() - 0.5) * 0.04);
          dummy.scale.set(rad, totalH, rad);
          dummy.updateMatrix();
          im.setMatrixAt(ci++, dummy.matrix);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);

      // Fractured fallen hexagonal basalt columns strictly grounded onto the cliff-foot grass & scree!
      for (let f = 0; f < 16; f++) {
        const fallen = new THREE.Mesh(colGeo, matBasalt);
        const rad = 1.15 + rng() * 0.45;
        const len = 3.6 + rng() * 4.4;
        const fx = 6.5 + rng() * 15.0;
        const fz = (rng() - 0.5) * 70.0;
        const fgy = localGroundY(fx, fz);
        fallen.scale.set(rad, len, rad);
        fallen.position.set(fx, fgy + rad * 0.48, fz);
        fallen.rotation.set(Math.PI * 0.48 + (rng() - 0.5) * 0.14, rng() * Math.PI, (rng() - 0.5) * 0.18);
        g.add(fallen);
      }
    } else if (lf.kind === 'natural_arch') {
      // #5: 天龍の天然石橋（岩門）— Colossal 32m-Span Solid Natural Eroded Granite Bridge!
      const span = lf.archSpan || 32;
      const archH = lf.archHeight || 24;
      const pzLeft = -(span * 0.5 + 4.0);
      const pzRight = span * 0.5 + 4.0;
      const gyLeft = localGroundY(0, pzLeft);
      const gyRight = localGroundY(0, pzRight);
      const gyMid = localGroundY(0, 0);
      const archBaseY = Math.max(gyMid, Math.min(gyLeft, gyRight) + 2.5);

      // Twin massive weathered granite abutment piers deeply rooted -15m into the hillside!
      for (const side of [-1, 1]) {
        const pz = side * (span * 0.5 + 4.0);
        const pgy = side < 0 ? gyLeft : gyRight;
        const topY = archBaseY + archH * 0.52;
        const botY = pgy - 15.0;
        const pierH = Math.max(18.0, (topY - botY) * 0.58);
        const pier = new THREE.Mesh(makeCraggyRockGeo(12.2, pierH, 11.8, 310 + side * 19, 2), matDryGranite);
        pier.position.set(0, botY + pierH * 0.86, pz);
        g.add(pier);

        // Secondary buttress shoulder rooting cleanly downhill
        const butt = new THREE.Mesh(makeCraggyRockGeo(9.5, pierH * 0.65, 9.0, 325 + side * 23, 1), matMossRock);
        butt.position.set(3.2 * side, pgy - 3.5 + pierH * 0.36, pz + side * 4.2);
        g.add(butt);
      }

      // Continuous organically-sculpted solid granite arch bridge span (NO gaps between rocks!)
      const curvePts = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        const theta = Math.PI * u;
        const cz = -Math.cos(theta) * (span * 0.5 + 3.5);
        const cy = archBaseY + Math.sin(theta) * archH;
        const cx = Math.sin(theta * 2.0) * 1.1;
        curvePts.push(new THREE.Vector3(cx, cy, cz));
      }
      const archCurve = new THREE.CatmullRomCurve3(curvePts);
      const archTubeGeo = new THREE.TubeGeometry(archCurve, 36, 4.6, 10, false);
      const aPos = archTubeGeo.attributes.position;
      for (let k = 0; k < aPos.count; k++) {
        const vx = aPos.getX(k), vy = aPos.getY(k), vz = aPos.getZ(k);
        const crownFactor = 1.0 - 0.16 * Math.exp(-Math.pow(vz / (span * 0.28), 2.0));
        const crag = 1.0 + 0.16 * Math.sin(vz * 0.42 + vy * 0.55) * Math.cos(vx * 0.65 + 1.3)
          + 0.08 * Math.sin(vz * 1.15 - vy * 0.8);
        aPos.setXYZ(k, vx * (1.28 * crag), vy + (crag - 1.0) * 2.2 * crownFactor, vz);
      }
      archTubeGeo.computeVertexNormals();
      const archCore = new THREE.Mesh(archTubeGeo, matDryGranite);
      g.add(archCore);

      // Overlapping weathered mossy granite capstones & shoulder ledges hugging the continuous arch spine
      const segs = 13;
      for (let s = 0; s < segs; s++) {
        const u = s / (segs - 1);
        const pt = archCurve.getPoint(u);
        const thick = 3.8 + (1.0 - Math.sin(Math.PI * u)) * 3.0;
        const block = new THREE.Mesh(
          makeCraggyRockGeo(6.2 + rng() * 1.8, thick * 0.74, 5.2 + rng() * 1.6, 340 + s * 13, 1),
          s % 3 === 0 ? matMossRock : matDryGranite,
        );
        block.position.set(pt.x + (rng() - 0.5) * 1.2, pt.y + 0.8 + (rng() - 0.5) * 0.6, pt.z);
        block.rotation.x = Math.PI * u - Math.PI * 0.5;
        g.add(block);
      }
    } else if (lf.kind === 'cave_grotto') {
      // #12: 苔生す鍾乳洞窟・岩窟 — Grounded Vaulted Stone Cavern Mouth, Hanging Stalactites & Subterranean Pool!
      const archR = 13.5;
      const poolY = localGroundY(-4.0, 0) + 0.55;
      // Arched mossy cavern roof & deeply rooted side walls
      for (let s = 0; s < 11; s++) {
        const theta = (s / 10) * Math.PI;
        const cz = -Math.cos(theta) * archR;
        const cy = poolY + Math.sin(theta) * 11.5 + 1.5;
        const vault = new THREE.Mesh(makeCraggyRockGeo(14.5, 5.2, 5.8, 410 + s * 17, 1), matMossRock);
        vault.position.set(-10.0, cy, cz);
        vault.rotation.x = theta - Math.PI * 0.5;
        g.add(vault);
      }
      // Dark interior cave back-wall enclosure
      const backWall = new THREE.Mesh(makeCraggyRockGeo(6.5, 14.0, 16.5, 490, 1), matBasalt);
      backWall.position.set(-24.0, poolY + 5.5, 0);
      g.add(backWall);

      // Hanging conical limestone stalactites along cavern ceiling lip
      const stalGeo = new THREE.ConeGeometry(0.55, 3.6, 7);
      for (let st = 0; st < 14; st++) {
        const stal = new THREE.Mesh(stalGeo, matLimestone);
        stal.rotation.x = Math.PI;
        stal.scale.set(0.6 + rng() * 0.9, 0.55 + rng() * 1.15, 0.6 + rng() * 0.9);
        stal.position.set(-4.0 - rng() * 14.0, poolY + 10.6 + rng() * 1.4, (rng() - 0.5) * 15.0);
        g.add(stal);
      }

      // Glowing subterranean emerald grotto pool
      const cavePool = new THREE.Mesh(
        new THREE.CircleGeometry(14.5, 28),
        createNaturalPoolMaterial(atmoUniforms, {
          deepCol: new THREE.Color(0.03, 0.24, 0.30),
          shallowCol: new THREE.Color(0.16, 0.66, 0.64),
          foamRing: 0.25, opacity: 0.90,
        }),
      );
      cavePool.rotation.x = -Math.PI * 0.5;
      cavePool.position.set(-6.0, poolY, 0);
      cavePool.renderOrder = 3;
      g.add(cavePool);
    } else if (lf.kind === 'travertine_onsen') {
      // #13: 白湯の石灰華段丘（秘湯棚田池）— 7 Steaming Milky-Turquoise Scalloped Terraced Sinter Pools!
      const poolMat = createNaturalPoolMaterial(atmoUniforms, {
        deepCol: new THREE.Color(0.18, 0.66, 0.78),
        shallowCol: new THREE.Color(0.62, 0.92, 0.96),
        foamRing: 0.42, opacity: 0.94,
      });
      for (let t = 0; t < 7; t++) {
        const lx = -38 + t * 13.5;
        const lz = Math.sin(t * 1.15) * 11.5;
        const r = 11.2 + (t % 3) * 3.4;
        const ty = localGroundY(lx, lz);
        const waterY = ty + 1.15;

        // Deeply rooted scalloped ivory travertine mineral sinter pedestal (never floats on slope!)
        const basePed = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.25, 7.4, 24), matTravertine);
        basePed.position.set(lx, waterY - 3.92, lz);
        g.add(basePed);

        // Raised sculpted mineral travertine basin rim lip (Pamukkale / Shirahone sinter lip!)
        const lipGeo = new THREE.TorusGeometry(r * 1.01, 0.72, 8, 28);
        lipGeo.rotateX(Math.PI * 0.5);
        lipGeo.scale(1.0, 0.58, 1.0);
        const lip = new THREE.Mesh(lipGeo, matTravertine);
        lip.position.set(lx, waterY + 0.08, lz);
        g.add(lip);

        // Luminous milky-turquoise geothermal hot spring surface nestled inside the sinter rim!
        const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 28), poolMat);
        pool.rotation.x = -Math.PI * 0.5;
        pool.position.set(lx, waterY + 0.06, lz);
        pool.renderOrder = 3;
        g.add(pool);

        // Billowing double-crossed rising geothermal steam plumes!
        for (let st = 0; st < 2; st++) {
          const steam = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.55, 11.0, 4, 4), matHotSteam);
          steam.position.set(lx, waterY + 5.4, lz);
          steam.rotation.y = (t * 0.7) + st * (Math.PI * 0.5);
          steam.renderOrder = 5;
          g.add(steam);
        }

        // Accent mineral-encrusted mossy rocks perched on the outer terrace rim
        for (let rk = 0; rk < 3; rk++) {
          const ra = t * 1.9 + rk * 2.1;
          const rock = new THREE.Mesh(makeCraggyRockGeo(1.6 + rng() * 1.4, 0.9 + rng() * 0.7, 1.5 + rng() * 1.3, 450 + t * 11 + rk, 1), matTravertine);
          rock.position.set(lx + Math.cos(ra) * (r * 1.04), waterY + 0.25, lz + Math.sin(ra) * (r * 1.04));
          g.add(rock);
        }
      }
    } else if (lf.kind === 'caldera_lake') {
      // #9: 蒼天カルデラ火口湖 — Massive 560m-Radius Deep Sapphire Volcanic Crater Lake!
      const lakeY = (lf.preBaseY || 0) - baseY + 18.0;
      const lake = new THREE.Mesh(
        new THREE.CircleGeometry(lf.lakeRadius || 560, 64),
        createNaturalPoolMaterial(atmoUniforms, {
          deepCol: new THREE.Color(0.03, 0.14, 0.34),
          shallowCol: new THREE.Color(0.12, 0.42, 0.62),
          foamRing: 0.18, opacity: 0.94,
        }),
      );
      lake.rotation.x = -Math.PI * 0.5;
      lake.position.set(0, Math.max(24.0, lakeY), 0);
      lake.renderOrder = 3;
      g.add(lake);
    } else if (lf.kind === 'glacial_cirque') {
      // #10: 白雲カール氷河圏谷＆氷河湖 — Luminous Turquoise Alpine Glacial Tarn & Grounded Terminal Moraine!
      const lake = new THREE.Mesh(
        new THREE.CircleGeometry(lf.lakeRadius || 215, 48),
        createNaturalPoolMaterial(atmoUniforms, {
          deepCol: new THREE.Color(0.06, 0.38, 0.48),
          shallowCol: new THREE.Color(0.32, 0.78, 0.80),
          foamRing: 0.22, opacity: 0.92,
        }),
      );
      lake.rotation.x = -Math.PI * 0.5;
      lake.position.set(42, 16.0, 0);
      lake.renderOrder = 3;
      g.add(lake);

      // Terminal moraine glacial erratics strictly grounded on the moraine crest!
      for (let m = 0; m < 18; m++) {
        const a = -Math.PI * 0.45 + (m / 17) * Math.PI * 0.90;
        const rr = (lf.lakeRadius || 215) * (1.06 + rng() * 0.18);
        const bx = 42 + Math.cos(a) * rr;
        const bz = Math.sin(a) * rr;
        const bgy = localGroundY(bx, bz);
        const rock = new THREE.Mesh(makeCraggyRockGeo(4.5 + rng() * 5.0, 3.2 + rng() * 3.8, 4.5 + rng() * 5.0, 520 + m * 11, 1), matDryGranite);
        rock.position.set(bx, bgy + 1.2, bz);
        g.add(rock);
      }
    } else if (lf.kind === 'karst_doline') {
      // #11: 秋芳カルスト・ドリーネ凹地 — 38 Pale-Ivory Weathered Limestone Karst Pinnacles (Lapies)!
      const toothGeo = makeCraggyRockGeo(2.8, 6.2, 2.4, 611, 1);
      const im = new THREE.InstancedMesh(toothGeo, matLimestone, 38);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < 38; k++) {
        const a = rng() * Math.PI * 2;
        const rr = 95 + rng() * 360;
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        const wx = lf.x + lx * Math.cos(lf.angle) - lz * Math.sin(lf.angle);
        const wz = lf.z + lx * Math.sin(lf.angle) + lz * Math.cos(lf.angle);
        const ty = getGround(wx, wz) - baseY;
        const s = 0.75 + rng() * 1.45;
        dummy.position.set(lx, ty + 1.8 * s, lz);
        dummy.rotation.set((rng() - 0.5) * 0.25, rng() * Math.PI, (rng() - 0.5) * 0.25);
        dummy.scale.set(s, s * (0.9 + rng() * 0.8), s);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
    } else if (lf.kind === 'peat_bog') {
      // #15: 霧ヶ原・高層湿原＆池塘群 — 14 Mirror-Like Bog Pools (池塘) + Timber Boardwalk!
      const bogWaterMat = createNaturalPoolMaterial(atmoUniforms, {
        deepCol: new THREE.Color(0.08, 0.16, 0.14),
        shallowCol: new THREE.Color(0.24, 0.40, 0.34),
        foamRing: 0.0, opacity: 0.90,
      });
      for (let p = 0; p < 14; p++) {
        const a = (p / 14) * Math.PI * 2 + rng() * 0.4;
        const rr = 35 + rng() * 260;
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        const ty = localGroundY(lx, lz);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(14 + rng() * 22, 22), bogWaterMat);
        pool.rotation.x = -Math.PI * 0.5;
        pool.scale.set(1.0 + rng() * 0.5, 0.65 + rng() * 0.45, 1);
        pool.position.set(lx, ty + 0.42, lz);
        pool.renderOrder = 3;
        g.add(pool);
      }
      // Classic Ozegahara-style weathered cedar timber boardwalk spanning the wet marsh!
      for (let bw = -6; bw <= 6; bw++) {
        const lx = bw * 16.0;
        const ty = localGroundY(lx, 0);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.28, 2.4), matWoodBoard);
        deck.position.set(lx, ty + 0.78, 0);
        g.add(deck);
      }
    } else if (lf.kind === 'granite_hoodoos') {
      // #16: 天狗の奇岩群・花崗岩石柱塔 — 16 Towering Stacked-Slab Granite Tors & Mushroom Hoodoo Spires!
      for (let s = 0; s < 16; s++) {
        const a = (s / 16) * Math.PI * 2 + rng() * 0.3;
        const rr = 14 + rng() * 115;
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        const ty = localGroundY(lx, lz);
        const totalH = 11.0 + rng() * 19.0;
        const stacks = 3 + Math.floor(rng() * 3);
        let curY = ty - 1.5;
        for (let k = 0; k < stacks; k++) {
          const isCap = k === stacks - 1;
          const segH = totalH / stacks;
          const r = (isCap ? 4.4 : 2.6 + (1.0 - k / stacks) * 1.8) * (0.75 + rng() * 0.5);
          const slab = new THREE.Mesh(makeCraggyRockGeo(r, segH * 0.68, r * (0.85 + rng() * 0.3), 700 + s * 17 + k, 1), matDryGranite);
          slab.position.set(lx + (rng() - 0.5) * 0.9, curY + segH * 0.5, lz + (rng() - 0.5) * 0.9);
          g.add(slab);
          curY += segH * 0.88;
        }
      }
    } else if (lf.kind === 'moss_cascade_ravine') {
      // #22: 幽玄の苔渓（階段状ナメ滝渓谷）— 6 Stepped Mossy Bedrock Cascades with Animated Water Sheets!
      const poolMat = createNaturalPoolMaterial(atmoUniforms, {
        deepCol: new THREE.Color(0.05, 0.30, 0.28),
        shallowCol: new THREE.Color(0.24, 0.68, 0.58),
        foamRing: 0.72, opacity: 0.90,
      });
      for (let st = 0; st < 6; st++) {
        const lx = -48 + st * 18.0;
        const ty = localGroundY(lx, 0);
        const nextTy = localGroundY(lx + 8.0, 0);

        // Wet mossy step ledge
        const ledge = new THREE.Mesh(makeCraggyRockGeo(5.2, 2.8, 9.5, 810 + st * 13, 1), matMossRock);
        ledge.position.set(lx - 3.0, ty - 0.5, 0);
        g.add(ledge);

        // Animated inclined slick-rock cascade ribbon!
        const casc = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 5.4, 8, 8), matWaterfallMain);
        casc.position.set(lx + 1.8, Math.max(ty, nextTy) + 1.4, 0);
        casc.rotation.order = 'YXZ';
        casc.rotation.y = Math.PI * 0.5;
        casc.rotation.x = -0.35;
        casc.renderOrder = 4;
        g.add(casc);

        // Shallow emerald pool below each cascade step
        const pool = new THREE.Mesh(new THREE.CircleGeometry(8.5, 20), poolMat);
        pool.rotation.x = -Math.PI * 0.5;
        pool.position.set(lx + 8.0, nextTy + 0.45, 0);
        pool.renderOrder = 3;
        g.add(pool);

        // Mossy ravine flanking boulders
        for (const side of [-1, 1]) {
          const bkz = side * (9.5 + rng() * 3.5);
          const bkgy = localGroundY(lx + 2.0, bkz);
          const bk = new THREE.Mesh(makeCraggyRockGeo(4.8, 3.6 + rng() * 2.2, 4.5, 850 + st * 7 + side, 1), matMossRock);
          bk.position.set(lx + 2.0, bkgy + 1.2, bkz);
          g.add(bk);
        }
      }
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(24, 9, 4, 4), matMistSpray);
      mist.position.set(16, localGroundY(16, 0) + 4.5, 0);
      mist.rotation.y = Math.PI * 0.5;
      mist.renderOrder = 5;
      g.add(mist);
    } else if (lf.kind === 'talus_chute') {
      // #17: 大ガレ場・花崗岩の崖錐斜面 — Sweeping Fan of 48 Angular Granite Rockfall Slabs!
      const slabGeo = makeCraggyRockGeo(3.2, 1.8, 2.8, 912, 1);
      const im = new THREE.InstancedMesh(slabGeo, matDryGranite, 48);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < 48; k++) {
        const lx = -60 + rng() * 240;
        const spread = 30 + Math.max(0, lx + 60) * 0.36;
        const lz = (rng() - 0.5) * 2.0 * spread;
        const wx = lf.x + lx * Math.cos(lf.angle) - lz * Math.sin(lf.angle);
        const wz = lf.z + lx * Math.sin(lf.angle) + lz * Math.cos(lf.angle);
        const ty = getGround(wx, wz) - baseY;
        const sc = 0.65 + rng() * 1.85;
        dummy.position.set(lx, ty + 0.5 * sc, lz);
        dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        dummy.scale.set(sc, sc * 0.75, sc);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
    } else if (lf.kind === 'v_gorge') {
      // #3: 黒杉大峡谷（V字渓谷）— Towering Overhanging Gorge Buttress Crags & River Rapids Boulders!
      for (let k = 0; k < 18; k++) {
        const dz = (k - 8.5) * 52.0;
        const wz = lf.z + dz;
        const rv = evalMainRiver(wz);
        for (const side of [-1, 1]) {
          const wx = rv.x + side * (rv.halfWidth + 24 + rng() * 22);
          const ty = getGround(wx, wz) - baseY;
          const crag = new THREE.Mesh(makeCraggyRockGeo(14 + rng() * 10, 18 + rng() * 18, 16 + rng() * 12, 1000 + k * 7 + side, 1), matWetGranite);
          crag.position.set(wx - lf.x, ty + 6.0, dz);
          g.add(crag);
        }
      }
    } else if (lf.kind === 'braided_island') {
      // #21: 翡翠中洲の砂礫島 — Smooth River Cobble Bars & Weathered Driftwood Trunks!
      const cobGeo = makeCraggyRockGeo(2.2, 0.85, 1.8, 1104, 1);
      const im = new THREE.InstancedMesh(cobGeo, matWetGranite, 26);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < 26; k++) {
        const lx = (rng() - 0.5) * 20;
        const lz = (rng() - 0.5) * 115;
        const ty = getGround(lf.x + lx, lf.z + lz) - baseY;
        const sc = 0.55 + rng() * 1.25;
        dummy.position.set(lx, ty + 0.1, lz);
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.scale.set(sc, sc * 0.55, sc);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
    } else {
      // Remaining macro landforms (#6 river_terraces, #7 drumlin_hills, #8 volcanic_mesa, #14 alluvial_fan,
      // #18 cuesta_ridge, #19 alpine_saddle, #20 scoria_cone): authentic geological rim/outcrop rocks!
      const mat = lf.kind === 'scoria_cone' || lf.kind === 'volcanic_mesa'
        ? matScoria
        : (lf.kind === 'cuesta_ridge' ? matBasalt : matDryGranite);
      const count = 20;
      const outGeo = makeCraggyRockGeo(5.5, 4.2, 5.0, 1200 + lf.index * 19, 1);
      const im = new THREE.InstancedMesh(outGeo, mat, count);
      const dummy = new THREE.Object3D();
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + rng() * 0.25;
        const rr = lf.radius * (0.22 + rng() * 0.45);
        const lx = Math.cos(a) * rr;
        const lz = Math.sin(a) * rr;
        const wx = lf.x + lx * Math.cos(lf.angle || 0) - lz * Math.sin(lf.angle || 0);
        const wz = lf.z + lx * Math.sin(lf.angle || 0) + lz * Math.cos(lf.angle || 0);
        const ty = getGround(wx, wz) - baseY;
        const sc = 0.8 + rng() * 1.9;
        dummy.position.set(lx, ty + 1.0 * sc, lz);
        dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
        dummy.scale.set(sc, sc * (0.7 + rng() * 0.7), sc);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
    }
  }

  function update(cameraPos) {
    if (!cameraPos) return;
    for (let i = 0; i < locEntries.length; i++) {
      const e = locEntries[i];
      const dx = cameraPos.x - e.lf.x;
      const dz = cameraPos.z - e.lf.z;
      const d2 = dx * dx + dz * dz;
      e.group.visible = d2 < e.maxVisDist * e.maxVisDist;
    }
  }

  return {
    group: root,
    locations: MAJOR_LANDFORMS_22,
    update,
    getStats: () => ({
      totalLandforms: MAJOR_LANDFORMS_22.length,
      waterfalls: MAJOR_LANDFORMS_22.filter((l) => l.hasWaterfall).length,
      lakes: MAJOR_LANDFORMS_22.filter((l) => l.hasLake || l.hasBogPools || l.hasHotSpring).length,
    }),
  };
}
