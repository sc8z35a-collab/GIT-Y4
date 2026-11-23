import * as THREE from 'three';

/**
 * INNOVATION 3: TBDR-Optimized Volumetric Moonlight Shafts across ALL Above-Ground Levels
 * (1F, 2F, 3F, 4F + Balcony, Gable Attic), Drifting Forest Mist, and GPU Cedar Wind Sway.
 */

const SHAFT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    varying float vIsPerspective;
  #endif
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vViewPos = -mv.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
  }
`;

const SHAFT_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vec3 V = normalize(vViewPos);
    float ndotv = abs(dot(normalize(vNormalView), V));
    float edgeFade = pow(ndotv, 1.35);
    float lengthFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
    float sideFade = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);

    float dust = noise3(vWorldPos * 2.4 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06));
    float dustSparkle = smoothstep(0.68, 0.94, noise3(vWorldPos * 8.5 + vec3(0.0, -uTime * 0.18, uTime * 0.12)));

    float alpha = edgeFade * lengthFade * sideFade * (0.68 + 0.45 * dust + 0.55 * dustSparkle) * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor * (1.0 + dustSparkle * 0.5), alpha);
    #include <logdepthbuf_fragment>
  }
`;

const MIST_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  #ifdef USE_LOGDEPTHBUF
    varying float vFragDepth;
    varying float vIsPerspective;
  #endif
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #ifdef USE_LOGDEPTHBUF
      vFragDepth = 1.0 + gl_Position.w;
      vIsPerspective = float( projectionMatrix[ 2 ][ 3 ] == - 1.0 );
    #endif
  }
`;

const MIST_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uMistColor;
  uniform vec4 uCamperPose;
  uniform vec4 uKeiPose;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  #include <logdepthbuf_pars_fragment>

  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float n2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
      mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 3; i++) {
      v += a * n2(p);
      p = p * 2.07 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Mask mist out of Main Tower, Neighbor Annex, Concrete Warehouse, Movable Giant Camper, AND Movable Daily Kei-Van!
    float dx1 = max(max(0.0 - vWorldPos.x, vWorldPos.x - 5.0), 0.0);
    float dz1 = max(max(0.0 - vWorldPos.z, vWorldPos.z - 11.2), 0.0);
    float distMain = length(vec2(dx1, dz1));

    float dx2 = max(max(-7.6 - vWorldPos.x, vWorldPos.x - (-2.6)), 0.0);
    float dz2 = max(max(1.0 - vWorldPos.z, vWorldPos.z - 9.0), 0.0);
    float distAnnex = length(vec2(dx2, dz2));

    float dx3 = max(max(6.6 - vWorldPos.x, vWorldPos.x - 8.6), 0.0);
    float dz3 = max(max(-1.2 - vWorldPos.z, vWorldPos.z - 0.8), 0.0);
    float distStorage = length(vec2(dx3, dz3));

    vec2 relC = vWorldPos.xz - uCamperPose.xy;
    vec2 locC = vec2(
      relC.x * uCamperPose.z - relC.y * uCamperPose.w,
      relC.x * uCamperPose.w + relC.y * uCamperPose.z
    );
    float distCamper = length(max(abs(locC) - vec2(1.42, 3.82), 0.0));

    vec2 relK = vWorldPos.xz - uKeiPose.xy;
    vec2 locK = vec2(
      relK.x * uKeiPose.z - relK.y * uKeiPose.w,
      relK.x * uKeiPose.w + relK.y * uKeiPose.z
    );
    float distKei = length(max(abs(locK) - vec2(0.82, 1.78), 0.0));

    float outsideDist = min(min(min(min(distMain, distAnnex), distStorage), distCamper), distKei);
    float houseMask = smoothstep(0.35, 2.0, outsideDist);

    float radialFade = 1.0 - smoothstep(22.0, 46.0, length(vWorldPos.xz - vec2(1.0, 4.5)));

    vec2 p1 = vWorldPos.xz * 0.15 + vec2(uTime * 0.045, uTime * 0.022);
    vec2 p2 = vWorldPos.xz * 0.30 + vec2(-uTime * 0.032, uTime * 0.038);
    float mist = fbm(p1) * 0.65 + fbm(p2) * 0.35;
    float alpha = smoothstep(0.28, 0.85, mist) * houseMask * radialFade * 0.22;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uMistColor, alpha);
    #include <logdepthbuf_fragment>
  }
`;

export function createVolumetricAtmosphere(scene) {
  const group = new THREE.Group();
  group.name = 'VolumetricAtmosphere';
  scene.add(group);

  const uniforms = {
    uTime: { value: 0 },
    uCamperPose: { value: new THREE.Vector4(7.75, 5.75, 1.0, 0.0) },
    uKeiPose: { value: new THREE.Vector4(3.55, -3.60, 1.0, 0.0) },
  };

  function addMoonShaft(x, y, z, w, length, rotX, rotY, rotZ, opacity = 0.088) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: {
        uTime: uniforms.uTime,
        uColor: { value: new THREE.Color(0x88b2dc) },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(w, length), mat);
    m1.position.set(x, y, z);
    m1.rotation.set(rotX, rotY, rotZ);
    m1.renderOrder = 3;
    group.add(m1);
  }

  // 1F Moonlight Shafts
  addMoonShaft(1.50, 1.05, 8.95, 1.25, 2.70, 0.56, 0.16, 0.0, 0.090);
  addMoonShaft(2.55, 1.05, 8.95, 1.15, 2.65, 0.56, -0.14, 0.0, 0.080);
  addMoonShaft(4.15, 1.18, 9.20, 0.78, 1.85, 0.52, -0.12, 0.0, 0.072);
  addMoonShaft(3.55, 1.18, 0.92, 1.20, 2.00, -0.58, 0.08, 0.0, 0.062);

  // 2F Moonlight Shafts
  addMoonShaft(1.75, 2.75 + 1.15, 8.95, 1.65, 2.55, 0.56, 0.12, 0.0, 0.082);
  addMoonShaft(3.55, 2.75 + 1.20, 0.92, 1.20, 2.00, -0.58, 0.08, 0.0, 0.064);

  // 3F Moonlight Shafts
  addMoonShaft(1.75, 5.50 + 1.18, 8.95, 1.75, 2.60, 0.54, 0.10, 0.0, 0.092);
  addMoonShaft(3.55, 5.50 + 1.15, 0.92, 1.20, 1.95, -0.58, 0.06, 0.0, 0.068);

  // 4F Moonlight Shafts (Library W4F-5 & Sky Lounge Balcony Door D4-6)
  addMoonShaft(1.28, 8.15 + 1.05, 9.05, 1.35, 2.15, 0.54, 0.12, 0.0, 0.086);
  addMoonShaft(3.65, 8.15 + 1.05, 9.15, 1.15, 2.10, 0.54, -0.08, 0.0, 0.088);

  // 5F Moonlight Shafts (Conservatory South Windows W5-6/W5-7 & Drafting Studio North W5-2)
  addMoonShaft(1.50, 10.50 + 1.25, 8.95, 1.65, 2.55, 0.54, 0.12, 0.0, 0.090);
  addMoonShaft(3.75, 10.50 + 1.25, 9.00, 1.30, 2.45, 0.54, -0.08, 0.0, 0.084);
  addMoonShaft(3.60, 10.50 + 1.20, 0.92, 1.25, 2.05, -0.58, 0.08, 0.0, 0.066);

  // 6F Moonlight Shafts (Crown Observatory Panorama Window W6-7, Sky Terrace Door D6-5 & Starlight Alcove W6-2)
  addMoonShaft(1.42, 13.25 + 1.30, 8.95, 1.85, 2.75, 0.52, 0.10, 0.0, 0.098);
  addMoonShaft(3.15, 13.25 + 1.28, 9.08, 1.25, 2.45, 0.52, -0.06, 0.0, 0.092);
  addMoonShaft(3.60, 13.25 + 1.25, 0.92, 1.25, 2.10, -0.58, 0.06, 0.0, 0.070);

  // Attic (RF at baseY=16.10m) Dramatic Gable Apex Moonlight Shafts
  addMoonShaft(2.50, 16.10 + 1.18, 8.92, 1.45, 2.45, 0.56, 0.04, 0.0, 0.105);
  addMoonShaft(2.50, 16.10 + 1.15, 1.05, 1.20, 2.15, -0.58, -0.05, 0.0, 0.078);

  // Neighboring 5x8m Annex (ANNEX-40) Moonlight Shafts (1F, 2F, 3F, Attic!)
  addMoonShaft(-5.75, 1.10, 8.15, 1.55, 2.55, 0.56, 0.12, 0.0, 0.085);
  addMoonShaft(-5.65, 2.75 + 1.15, 8.15, 1.50, 2.45, 0.54, 0.10, 0.0, 0.082);
  addMoonShaft(-4.00, 5.50 + 1.10, 8.15, 1.25, 2.10, 0.54, -0.08, 0.0, 0.082);
  addMoonShaft(-5.10, 8.15 + 1.15, 8.05, 1.35, 2.25, 0.56, 0.04, 0.0, 0.095);

  const mistPlanes = [];
  // Layered Drifting Forest Mist Sheets (ground + mid-canopy + high-canopy around 5F/6F Sky Terraces!)
  [
    { y: 0.26, col: 0x1b2b38 },
    { y: 1.05, col: 0x152330 },
    { y: 7.40, col: 0x11202e },
    { y: 12.60, col: 0x101d2b },
  ].forEach((layer) => {
    const mistMat = new THREE.ShaderMaterial({
      vertexShader: MIST_VERT,
      fragmentShader: MIST_FRAG,
      uniforms: {
        uTime: uniforms.uTime,
        uMistColor: { value: new THREE.Color(layer.col) },
        uCamperPose: uniforms.uCamperPose,
        uKeiPose: uniforms.uKeiPose,
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(88, 88), mistMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0.0, layer.y, 4.0);
    plane.renderOrder = 2;
    group.add(plane);
    mistPlanes.push({ plane, mat: mistMat, nightHex: layer.col });
  });

  return {
    group,
    setAtmospherePreset(preset) {
      if (!preset) return;
      const isNight = preset.id === 'night';
      const isDay = preset.id === 'day';
      mistPlanes.forEach(({ plane, mat, nightHex }) => {
        plane.visible = isNight; // TERRENO's exact 3D height fog handles daylight/dawn/dusk valley mist cleanly!
        if (isNight) mat.uniforms.uMistColor.value.setHex(nightHex);
      });
      group.children.forEach((ch) => {
        if (ch.material && ch.material.uniforms && ch.material.uniforms.uColor && ch.material.uniforms.uOpacity) {
          if (isNight) {
            ch.material.uniforms.uColor.value.setHex(0x88b4e0);
          } else if (preset.id === 'dawn') {
            ch.material.uniforms.uColor.value.setRGB(1.0, 0.78, 0.52);
          } else if (isDay) {
            ch.material.uniforms.uColor.value.setRGB(1.0, 0.96, 0.86);
          } else {
            ch.material.uniforms.uColor.value.setRGB(1.0, 0.56, 0.34);
          }
        }
      });
    },
    update(elapsed, camperPose = null, keiPose = null) {
      uniforms.uTime.value = elapsed;
      if (camperPose) {
        uniforms.uCamperPose.value.set(
          camperPose.cx,
          camperPose.cz,
          Math.cos(camperPose.yaw),
          Math.sin(camperPose.yaw),
        );
      }
      if (keiPose) {
        uniforms.uKeiPose.value.set(
          keiPose.cx,
          keiPose.cz,
          Math.cos(keiPose.yaw),
          Math.sin(keiPose.yaw),
        );
      }
    },
  };
}

export function injectForestWindShader(material, windTimeUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uWindTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           float swayWeight = clamp((position.y + 0.5) * 0.85, 0.0, 1.0);
           float heightAmp = 0.045 + clamp(instOrigin.y * 0.004, 0.0, 0.09);
           float phase = instOrigin.x * 0.42 + instOrigin.z * 0.35 + uWindTime * 1.10;
           transformed.x += sin(phase) * heightAmp * swayWeight;
           transformed.z += cos(phase * 0.83) * (heightAmp * 0.78) * swayWeight;
         #endif`,
      );
  };
  material.needsUpdate = true;
}
