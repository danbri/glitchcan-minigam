// Sky dome, sun glow and ocean — pure procedural three.js materials/shaders,
// no textures to download. Designed to read as "lush, sunny, inspiring" from
// a chase camera at toy scale, not as a physically accurate atmosphere.

import * as THREE from '../vendor/three.module.min.js';

const skyVert = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 hazeColor;
uniform float haze; // 0..1, driven by real cloud cover along the route
varying vec3 vWorldPos;
void main() {
  float h = clamp(normalize(vWorldPos).y * 1.4 + 0.15, 0.0, 1.0);
  vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
  col = mix(col, hazeColor, haze * (1.0 - h) * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildSky() {
  const geo = new THREE.SphereGeometry(9000, 24, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a7be0) },
      horizonColor: { value: new THREE.Color(0xdff2ff) },
      hazeColor: { value: new THREE.Color(0xc9d8e0) },
      haze: { value: 0.2 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return mesh;
}

export function buildSun() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.25, 'rgba(255,240,180,0.9)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  // A bright solid core so it reads as the sun, wrapped in a big soft halo —
  // otherwise the small sprite looked like a stray floating white ball.
  ctx.fillStyle = 'rgba(255,252,235,1)';
  ctx.beginPath();
  ctx.arc(128, 128, 34, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2600, 2600, 1);
  sprite.position.set(-3200, 5200, -5200); // high in the sky, clearly the sun
  return sprite;
}

const oceanVert = `
uniform float time;
varying vec2 vUv;
varying float vWave;
void main() {
  vUv = uv;
  vec3 p = position;
  float w = sin(p.x * 0.01 + time * 0.6) * 3.0 + sin(p.y * 0.017 - time * 0.4) * 2.0;
  p.z += w;
  vWave = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const oceanFrag = `
varying vec2 vUv;
varying float vWave;
void main() {
  vec3 deep = vec3(0.03, 0.22, 0.42);
  vec3 shallow = vec3(0.15, 0.55, 0.62);
  vec3 col = mix(deep, shallow, clamp(vWave * 0.12 + 0.5, 0.0, 1.0));
  float sparkle = smoothstep(0.85, 1.0, sin(vUv.x * 400.0) * sin(vUv.y * 400.0));
  col += sparkle * 0.15;
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildOcean() {
  const geo = new THREE.PlaneGeometry(8000, 14000, 80, 140);
  const mat = new THREE.ShaderMaterial({
    vertexShader: oceanVert,
    fragmentShader: oceanFrag,
    uniforms: { time: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -60, 3000);
  return mesh;
}

export function updateSky(sky, fog, cloudTotalPct) {
  const haze = THREE.MathUtils.clamp(cloudTotalPct / 100, 0, 1);
  sky.material.uniforms.haze.value = haze;
  if (fog) {
    fog.color.setHSL(0.58, 0.35, THREE.MathUtils.lerp(0.75, 0.88, haze));
    // Keep a healthy near/far gap at all times — letting `far` drop below (or
    // too close to) `near` degenerates three.js's linear fog into "no fog",
    // which let the destination skyline stay perfectly crisp from mid-ocean.
    fog.near = THREE.MathUtils.lerp(3200, 700, haze);
    fog.far = THREE.MathUtils.lerp(9200, 4000, haze);
  }
}
