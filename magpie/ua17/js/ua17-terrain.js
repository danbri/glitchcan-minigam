// The world: an elevation-displaced terrain mesh (deep seabed → shallow
// coastal shelf → beaches → land plateaus where the cities sit) plus a
// translucent animated sea surface. Replaces the old flat tiled ocean +
// floating city slabs. Colours come from height, so you get dark open ocean,
// turquoise coasts and green land — a hint of the LHR→EWR crossing rather
// than a dull repeating pattern.
//
// This is procedural (deterministic value-noise), not real bathymetry — a
// true OSM+DEM terrain for the whole North Atlantic isn't feasible offline —
// but it reads as land/sea/coast from the air, which is the point.

import * as THREE from '../vendor/three.module.min.js';

// Land masses sit under each city (and its runway). Keep these in sync with
// the skyline offsets in ua17-buildings.js and runway z in ua17-route.js.
const LANDS = [
  { x: -330, z: -260, r: 1050 }, // London
  { x: 330, z: 6300, r: 1250 },  // New York / Newark
];
export const CITY_GROUND_Y = 3; // flat plateau height the cities/runways sit on

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, z) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}

export function elevation(x, z) {
  // Rolling seabed well below the surface.
  let e = -58 + (fbm(x * 0.0018 + 3, z * 0.0018 + 7) - 0.5) * 44;
  for (const L of LANDS) {
    const d = Math.hypot(x - L.x, z - L.z) / L.r;
    if (d >= 1) continue;
    if (d < 0.42) {
      e = CITY_GROUND_Y; // flat coastal plateau for the city + runway
    } else {
      const t = (d - 0.42) / 0.58; // 0 at plateau edge → 1 at the outer coast
      const land = CITY_GROUND_Y * (1 - t) - 34 * t * t + (fbm(x * 0.02, z * 0.02) - 0.5) * 9;
      e = Math.max(e, land);
    }
  }
  return e;
}

function colorFor(e, out) {
  // returns [r,g,b] land/sea colour ramp
  let c;
  if (e > 26) c = [0.46, 0.47, 0.44];        // high ground / rock
  else if (e > 8) c = [0.34, 0.46, 0.28];    // grass
  else if (e > 1.5) c = [0.55, 0.55, 0.36];  // meadow/edge
  else if (e > -1) c = [0.78, 0.72, 0.5];    // beach sand
  else if (e > -12) c = [0.16, 0.5, 0.55];   // turquoise shallows
  else if (e > -34) c = [0.07, 0.32, 0.48];  // shelf
  else c = [0.03, 0.15, 0.32];               // deep ocean
  out.push(c[0], c[1], c[2]);
}

export function buildTerrain() {
  const W = 3800, D = 8400, SX = 150, SZ = 320;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  // Center the plane over the route mid-point in z.
  geo.translate(0, 0, 3000);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const e = elevation(pos.getX(i), pos.getZ(i));
    pos.setY(i, e);
    colorFor(e, colors);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  return mesh;
}

const waterVert = `
uniform float time;
varying vec3 vWorld;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.02 + time) * 0.6 + sin(p.z * 0.028 - time * 0.8) * 0.5;
  p.y += w;
  vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const waterFrag = `
uniform float time;
varying vec3 vWorld;
void main() {
  // Large-scale colour variation so the open ocean isn't a flat tile.
  float n = sin(vWorld.x * 0.0009) * cos(vWorld.z * 0.0007 + 1.3);
  vec3 deep = vec3(0.04, 0.20, 0.40);
  vec3 shallow = vec3(0.10, 0.42, 0.55);
  vec3 col = mix(deep, shallow, 0.5 + 0.5 * n);
  float sparkle = smoothstep(0.96, 1.0, sin(vWorld.x * 0.3 + time) * sin(vWorld.z * 0.3));
  col += sparkle * 0.25;
  gl_FragColor = vec4(col, 0.82);
}`;

export function buildWater() {
  const geo = new THREE.PlaneGeometry(3800, 8400, 80, 160);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 3000);
  const mat = new THREE.ShaderMaterial({
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.renderOrder = 1;
  return mesh;
}
