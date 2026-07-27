// Waterworld post — the compositing pass. The scene renders into a
// target, then one fullscreen fragment shader does the atmosphere:
//
//   · screen-space crepuscular rays (radial-blurred brightness toward
//     the sun's screen position — real occluded light shafts)
//   · depth-based water absorption (distance drinks red, then green)
//   · a gentle teal-shadow grade, vignette, breathing light, fine grain
//
// Hand-rolled (no EffectComposer): one render target, one triangle.

import * as THREE from '../../../trees/vendor/three.module.min.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float uTime;
uniform float uDeep;      // 0 shallow … 1 deep basin
uniform float uIR;        // thermal sight: grading stands down
uniform float uHasDepth;
uniform vec2  uSun;       // sun position in uv space
uniform float uSunVis;    // 0 when the sun is behind the camera
uniform float uRayAmt;    // shafts fade with depth
uniform vec2  uRes;
uniform float uNear;
uniform float uFar;

float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  return (2.0 * uNear) / (uFar + uNear - z * (uFar - uNear));
}

void main() {
  vec3 col = texture2D(tScene, vUv).rgb;

  // -- absorption: the water itself eats warm light with distance
  if (uHasDepth > 0.5 && uIR < 0.5) {
    float d = clamp(linDepth(vUv) * 2.4, 0.0, 1.0);
    vec3 deepTint = mix(vec3(0.10, 0.32, 0.48), vec3(0.02, 0.06, 0.14), uDeep);
    col = mix(col, deepTint, d * 0.28);
    col.r *= 1.0 - d * 0.2;
  }

  // -- crepuscular rays: march toward the sun, gather what glows
  if (uSunVis > 0.001 && uIR < 0.5) {
    vec2 stp = (uSun - vUv) / float(RAY_SAMPLES);
    vec2 p = vUv;
    float illum = 0.0;
    float decay = 1.0;
    for (int i = 0; i < RAY_SAMPLES; i++) {
      p += stp;
      vec3 s = texture2D(tScene, p).rgb;
      illum += max(dot(s, vec3(0.30, 0.55, 0.15)) - 0.5, 0.0) * decay;
      decay *= 0.93;
    }
    col += vec3(0.50, 0.72, 0.90)
      * (illum / float(RAY_SAMPLES)) * 5.0 * uRayAmt * uSunVis;
  }

  // -- grade: teal lift in the shadows, soft rolloff up top
  if (uIR < 0.5) {
    col = pow(col, vec3(0.96));
    col += vec3(-0.006, 0.006, 0.020);
  }

  // -- vignette, breathing light, fine grain
  col *= 1.12;
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.30;
  col *= 1.0 + 0.015 * sin(uTime * 0.4);
  float g = fract(sin(dot(vUv * uRes + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.013;

  gl_FragColor = vec4(col, 1.0);
}`;

export class Composite {
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.lite = !!opts.lite;
    this.enabled = true;

    const gl2 = renderer.capabilities.isWebGL2;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });
    if (gl2) {
      this.rt.depthTexture = new THREE.DepthTexture(2, 2);
    }

    this.mat = new THREE.ShaderMaterial({
      defines: { RAY_SAMPLES: this.lite ? 10 : 22 },
      uniforms: {
        tScene: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture || this.rt.texture },
        uTime: { value: 0 },
        uDeep: { value: 0 },
        uIR: { value: 0 },
        uHasDepth: { value: gl2 ? 1 : 0 },
        uSun: { value: new THREE.Vector2(0.5, 1.2) },
        uSunVis: { value: 1 },
        uRayAmt: { value: 1 },
        uRes: { value: new THREE.Vector2(2, 2) },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    // one oversized triangle beats a quad (no diagonal seam)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, this.mat);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._sunWorld = new THREE.Vector3();
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.mat.uniforms.uRes.value.set(w * pr, h * pr);
  }

  // sunDir: normalized direction TOWARD the sun in world space
  render(time, sunDir, { deep = 0, ir = false, rayAmt = 1 } = {}) {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uDeep.value = deep;
    u.uIR.value = ir ? 1 : 0;
    u.uRayAmt.value = rayAmt;
    // project a far point along the sun direction into screen uv space
    this._sunWorld.copy(this.camera.position).addScaledVector(sunDir, 200);
    const p = this._sunWorld.project(this.camera);
    const behind = p.z > 1 || p.z < -1;
    u.uSunVis.value = behind ? 0 : Math.max(0, 1 - Math.hypot(p.x * 0.5, p.y * 0.5) * 0.55);
    u.uSun.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
