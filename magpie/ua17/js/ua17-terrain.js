// The world: terrain built from REAL elevation data (ASTER GDEM, fetched by
// tools/fetch-elevation.mjs into data/elevation-*.json) around London and New
// York — real coastlines and real relief — blended into procedural deep ocean
// for the crossing. Plus a translucent animated sea surface at y=0. This is
// the "use OSM + elevation like the trees project" approach the brief asked
// for, at toy scale.

import * as THREE from '../vendor/three.module.min.js';

export const CITY_GROUND_Y = 4; // flat pad height the cities/runways sit on

// Each city's DEM is mapped to a world square of this side, centred on the
// city. ~44 km of real terrain across ~2600 world units.
const DEM_WORLD_SIDE = 2600;
const V_SCALE = 0.14;   // metres of real elevation → world units of height
const R_FLAT = 380;     // radius flattened to CITY_GROUND_Y for the city/runway
const R_BLEND = 240;    // blend from the flat pad out to real terrain
const EDGE_BLEND = 0.14; // fraction of the DEM box edge blended down to ocean

export async function loadElevation() {
  const [london, nyc] = await Promise.all([
    fetch(new URL('../data/elevation-london.json', import.meta.url)).then((r) => r.json()),
    fetch(new URL('../data/elevation-nyc.json', import.meta.url)).then((r) => r.json()),
  ]);
  return { london, nyc };
}

function bilinear(dem, u, v) {
  const N = dem.n;
  const fx = THREE.MathUtils.clamp(u, 0, 1) * (N - 1);
  const fy = THREE.MathUtils.clamp(v, 0, 1) * (N - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, N - 1), y1 = Math.min(y0 + 1, N - 1);
  const tx = fx - x0, ty = fy - y0;
  const e = dem.elev;
  const a = e[y0 * N + x0], b = e[y0 * N + x1], c = e[y1 * N + x0], d = e[y1 * N + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function makeElevation(cities) {
  // cities: [{ x, z, dem }]
  function seabed(x, z) {
    return -56 + (vnoise(x * 0.002 + 3, z * 0.002 + 7) - 0.5) * 40;
  }
  return function elevation(x, z) {
    for (const c of cities) {
      const dx = x - c.x, dz = z - c.z;
      const u = dx / DEM_WORLD_SIDE + 0.5;
      const v = dz / DEM_WORLD_SIDE + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const realM = bilinear(c.dem, u, v);
      let h = realM * V_SCALE;
      // Sea (real elevation ~0) sits at/under the water plane.
      if (realM <= 0.5) h = -2;
      // Flatten the immediate city + runway area to a level pad.
      const d = Math.hypot(dx, dz);
      if (d < R_FLAT) h = CITY_GROUND_Y;
      else if (d < R_FLAT + R_BLEND) h = THREE.MathUtils.lerp(CITY_GROUND_Y, h, (d - R_FLAT) / R_BLEND);
      // Fade the DEM box edges down into the surrounding ocean to avoid a wall.
      const edge = Math.min(u, 1 - u, v, 1 - v);
      if (edge < EDGE_BLEND) h = THREE.MathUtils.lerp(seabed(x, z), h, edge / EDGE_BLEND);
      return h;
    }
    return seabed(x, z);
  };
}

function colorFor(e, out) {
  let c;
  if (e > 34) c = [0.50, 0.47, 0.42];        // high ground / rock
  else if (e > 14) c = [0.33, 0.44, 0.26];   // green hills
  else if (e > 3) c = [0.42, 0.5, 0.30];     // meadow / parkland
  else if (e > 0.3) c = [0.6, 0.57, 0.4];    // low ground / beach edge
  else if (e > -8) c = [0.16, 0.5, 0.55];    // turquoise shallows
  else if (e > -34) c = [0.07, 0.32, 0.48];  // shelf
  else c = [0.03, 0.15, 0.32];               // deep ocean
  out.push(c[0], c[1], c[2]);
}

export function buildTerrain(cities) {
  const elevation = makeElevation(cities);
  const W = 3800, D = 8400, SX = 190, SZ = 380;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
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
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0.0, flatShading: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 0;
  return { mesh, elevation };
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
  float n = sin(vWorld.x * 0.0009) * cos(vWorld.z * 0.0007 + 1.3);
  vec3 deep = vec3(0.04, 0.20, 0.40);
  vec3 shallow = vec3(0.10, 0.42, 0.55);
  vec3 col = mix(deep, shallow, 0.5 + 0.5 * n);
  float sparkle = smoothstep(0.96, 1.0, sin(vWorld.x * 0.3 + time) * sin(vWorld.z * 0.3));
  col += sparkle * 0.25;
  gl_FragColor = vec4(col, 0.86);
}`;

export function buildWater() {
  const geo = new THREE.PlaneGeometry(3800, 8400, 80, 160);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 3000);
  const mat = new THREE.ShaderMaterial({
    vertexShader: waterVert, fragmentShader: waterFrag,
    transparent: true, depthWrite: false, uniforms: { time: { value: 0 } },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}
