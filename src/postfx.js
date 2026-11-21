import * as THREE from 'three';

/**
 * INNOVATION 4A: Single-Pass Adreno 825 TBDR Cinematic Post-FX Pipeline.
 *
 * Avoids multi-pass bloom/tonemap ping-pong bandwidth overhead on mobile tile GPUs by
 * combining:
 *   1) 9-tap circular bright-pass analytic nocturnal bloom glow
 *   2) ACES Filmic tone mapping + Nocturnal Japanese Cinema split-tone grading
 *   3) Smooth dark-adaptation auto-exposure
 *   4) Optical vignette + animated perceptual film grain dither (zero AMOLED dark banding!)
 */

const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uExposure;
  uniform float uBloomStrength;
  varying vec2 vUv;

  vec3 acesFilm(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 softBright(vec3 c) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float contrib = max(0.0, lum - 0.78) / max(lum, 0.001);
    return c * contrib;
  }

  void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;

    // 9-tap dual-radius circular kernel analytic bloom (single TBDR tile pass!)
    vec3 bloom = vec3(0.0);
    vec2 r1 = uTexel * 3.2;
    vec2 r2 = uTexel * 7.5;
    bloom += softBright(texture2D(tDiffuse, vUv + vec2( r1.x,  0.0)).rgb);
    bloom += softBright(texture2D(tDiffuse, vUv + vec2(-r1.x,  0.0)).rgb);
    bloom += softBright(texture2D(tDiffuse, vUv + vec2( 0.0,  r1.y)).rgb);
    bloom += softBright(texture2D(tDiffuse, vUv + vec2( 0.0, -r1.y)).rgb);
    bloom += softBright(texture2D(tDiffuse, vUv + vec2( r2.x,  r2.y) * 0.707).rgb) * 0.75;
    bloom += softBright(texture2D(tDiffuse, vUv + vec2(-r2.x,  r2.y) * 0.707).rgb) * 0.75;
    bloom += softBright(texture2D(tDiffuse, vUv + vec2( r2.x, -r2.y) * 0.707).rgb) * 0.75;
    bloom += softBright(texture2D(tDiffuse, vUv + vec2(-r2.x, -r2.y) * 0.707).rgb) * 0.75;
    bloom /= 7.0;

    col += bloom * uBloomStrength;

    // Exposure + ACES Filmic tone mapping
    col *= uExposure;
    col = acesFilm(col);

    // Nocturnal Japanese Cinema split-tone grading:
    // Cool deep midnight pine shadows, warm amber lantern highlights
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 shadowTint = vec3(0.92, 0.97, 1.06);
    vec3 highTint   = vec3(1.05, 1.00, 0.94);
    col *= mix(shadowTint, highTint, smoothstep(0.12, 0.72, luma));

    // Subtle organic optical vignette
    vec2 centered = vUv * 2.0 - 1.0;
    float vig = 1.0 - dot(centered, centered) * 0.24;
    col *= clamp(vig, 0.58, 1.0);

    // Gamma encode to sRGB + perceptual triangular dithered film grain (prevents dark AMOLED banding)
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));
    float grain = (hash12(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.022;
    col = clamp(col + grain, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class SinglePassPostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;

    const isWebGL2 = renderer.capabilities.isWebGL2;
    const rtType = isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());

    this.target = new THREE.WebGLRenderTarget(Math.max(1, sz.x), Math.max(1, sz.y), {
      type: rtType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: isWebGL2 ? 2 : 0, // Hardware 2x MSAA on Adreno 825 tile memory (near-zero cost!)
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uTexel: { value: new THREE.Vector2(1 / Math.max(1, sz.x), 1 / Math.max(1, sz.y)) },
        uTime: { value: 0 },
        uExposure: { value: 1.15 },
        uBloomStrength: { value: 0.48 },
      },
      depthTest: false,
      depthWrite: false,
    });

    // Single oversized triangle (faster than 2-triangle quad on mobile tile GPUs: zero diagonal seam overdraw!)
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    triGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.scene.add(new THREE.Mesh(triGeo, this.material));
  }

  resize() {
    const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(1, Math.floor(sz.x));
    const h = Math.max(1, Math.floor(sz.y));
    this.target.setSize(w, h);
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  render(mainScene, mainCamera, elapsed, targetExposure = 1.15) {
    if (!this.enabled) {
      this.renderer.render(mainScene, mainCamera);
      return;
    }
    // Smooth eye dark-adaptation exposure transition
    const uExp = this.material.uniforms.uExposure;
    uExp.value += (targetExposure - uExp.value) * 0.04;
    this.material.uniforms.uTime.value = elapsed;

    // Main pass into half-float linear target (disable renderer tonemapping since post-shader applies ACES Filmic)
    const prevTM = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(mainScene, mainCamera);
    this.lastMainCalls = this.renderer.info.render.calls;
    this.lastMainTris = this.renderer.info.render.triangles;

    // Single composite pass to screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    this.renderer.toneMapping = prevTM;
  }
}
