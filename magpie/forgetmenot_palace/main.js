// Forget-Me-Not Palace — top-down vector CRT viewer
// Atic Atac × Battlezone, green phosphor on dark crimson.

import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }       from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js';
import { LineSegments2 }    from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial }     from 'three/addons/lines/LineMaterial.js';

// ─── palette ────────────────────────────────────────────────────────────────
const PHOSPHOR     = new THREE.Color('#2bff7c');
const PHOSPHOR_DIM = new THREE.Color('#14a050');
const BACKDROP     = new THREE.Color('#1d0008');
const INK_RED      = new THREE.Color('#6a0014');

// ─── state ─────────────────────────────────────────────────────────────────
const stage = document.getElementById('stage');
const ui = {
  name:  document.getElementById('roomname'),
  exits: document.getElementById('exits'),
};

let renderer, scene, camera, composer, bloomPass, crtPass;
let palace = null;
let roomsById = new Map();
let exitsByRoom = new Map();
let currentRoomId = null;
let currentRoomGroup = null;
let exitDoms = [];
let isTransitioning = false;
let clock = new THREE.Clock();

// ─── boot ──────────────────────────────────────────────────────────────────
init().catch(err => {
  console.error(err);
  ui.name.textContent = 'BOOT FAILURE';
  ui.name.classList.add('show');
});

async function init() {
  const res = await fetch('./palace.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`palace.json: ${res.status}`);
  palace = await res.json();
  for (const r of palace.rooms) roomsById.set(r.id, r);
  for (const r of palace.rooms) exitsByRoom.set(r.id, []);
  for (const x of palace.exits) {
    const list = exitsByRoom.get(x.from);
    if (list) list.push(x);
  }

  setupRenderer();
  setupScene();
  setupPostFX();
  bindEvents();
  enterRoom(palace.world.start || palace.rooms[0].id, true);

  renderer.setAnimationLoop(tick);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: stage,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BACKDROP, 1);
  resize();
  window.addEventListener('resize', resize, { passive: true });
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = BACKDROP;
  scene.fog = new THREE.Fog(BACKDROP, 22, 70);

  // Orthographic-ish 3/4 angle, like Atic Atac.
  camera = new THREE.PerspectiveCamera(28, 1, 0.5, 200);
  camera.position.set(0, 30, 18);
  camera.lookAt(0, 0, 0);
}

function setupPostFX() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(stage.clientWidth, stage.clientHeight),
    1.05, 0.85, 0.18
  );
  composer.addPass(bloomPass);

  // CRT: subtle scanlines + chromatic offset + vignette + faint phosphor tint
  crtPass = new ShaderPass({
    uniforms: {
      tDiffuse:  { value: null },
      uTime:     { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uScanline:   { value: 0.18 },
      uVignette:   { value: 0.55 },
      uChroma:     { value: 0.0015 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform float uTime, uScanline, uVignette, uChroma;
      uniform vec2 uResolution;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;

        // tiny chromatic offset
        vec2 d = (uv - 0.5);
        vec3 col;
        col.r = texture2D(tDiffuse, uv + d * uChroma).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - d * uChroma).b;

        // scanlines (per device-px stripe, drifts very slowly)
        float ln = sin((uv.y * uResolution.y + uTime * 6.0) * 3.14159);
        col *= 1.0 - uScanline * (0.5 + 0.5 * ln);

        // vignette
        float v = smoothstep(0.95, 0.35, length(d));
        col *= mix(1.0 - uVignette, 1.0, v);

        // a faint warm bias so the dark areas read as crimson, not black
        col = max(col, vec3(0.082, 0.0, 0.018) * (1.0 - v) * 0.7);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  composer.addPass(crtPass);
  composer.addPass(new OutputPass());
}

// ─── room construction ─────────────────────────────────────────────────────
function clearRoom() {
  if (!currentRoomGroup) return;
  scene.remove(currentRoomGroup);
  currentRoomGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => m.dispose());
    }
  });
  currentRoomGroup = null;
}

function buildRoom(roomId) {
  const room = roomsById.get(roomId);
  if (!room) throw new Error('unknown room: ' + roomId);
  const exits = exitsByRoom.get(roomId) || [];
  const kindCfg = palace.kinds[room.kind] || palace.kinds.lobby;

  const g = new THREE.Group();
  g.userData.room = room;

  // Centered local geometry; the room's bbox describes its size.
  const W = Math.max(2, room.bbox.w);
  const D = Math.max(2, room.bbox.d);
  const H = Math.max(0.3, kindCfg.wall_h * 0.45);
  const wallT = 0.15;

  // ── floor: hatched phosphor pattern ───────────────────────────────────────
  const floorGeom = new THREE.PlaneGeometry(W, D, 1, 1);
  floorGeom.rotateX(-Math.PI / 2);
  const floorMat = new THREE.ShaderMaterial({
    uniforms: {
      uPhosphor: { value: PHOSPHOR },
      uDim:      { value: PHOSPHOR_DIM },
      uInk:      { value: INK_RED },
      uTime:     { value: 0 },
      uHatch:    { value: hatchDensity(kindCfg.hatch) },
      uAngle:    { value: hatchAngle(kindCfg.hatch) },
      uOpen:     { value: kindCfg.open_to_sky ? 1.0 : 0.0 },
      uSize:     { value: new THREE.Vector2(W, D) },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vLocal;
      uniform vec3 uPhosphor, uDim, uInk;
      uniform float uTime, uHatch, uAngle, uOpen;
      uniform vec2 uSize;

      // signed line: parallel hatching at angle uAngle, spacing 1/uHatch
      float hatch(vec2 p, float a, float density) {
        vec2 dir = vec2(cos(a), sin(a));
        float v = dot(p, dir) * density;
        float w = fwidth(v) * 1.4;
        float s = abs(fract(v) - 0.5);
        return smoothstep(w, 0.0, s - 0.06);
      }

      void main() {
        vec2 p = vLocal;
        // outer border (room outline at floor level)
        vec2 q = abs(p) / (uSize * 0.5);
        float edge = max(q.x, q.y);
        float border = smoothstep(0.985, 0.998, edge);

        // primary + cross hatch (court rooms get a subtle tile pattern instead)
        float h1 = hatch(p, uAngle,           uHatch);
        float h2 = hatch(p, uAngle + 1.5708,  uHatch * 0.5);
        float pattern = max(h1 * 0.85, h2 * 0.35);

        // courts (open to sky): faint cobble crosshatch, no carpet feel
        if (uOpen > 0.5) {
          float c1 = hatch(p, 0.785,  0.55);
          float c2 = hatch(p, -0.785, 0.55);
          pattern = max(c1, c2) * 0.55;
        }

        vec3 col = mix(uInk * 0.35, uDim, pattern * 0.7);
        col = mix(col, uPhosphor, border);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.position.y = 0;
  g.add(floor);

  // ── walls: extruded boxes with hatched inner faces ────────────────────────
  // Build wall segments along each side; carve gaps for exits.
  const sides = [
    { dir: 'north', axis: 'x', sign: -1, len: W, perp: D / 2 }, // top edge (z = -D/2)
    { dir: 'south', axis: 'x', sign:  1, len: W, perp: D / 2 }, // bottom edge
    { dir: 'east',  axis: 'z', sign:  1, len: D, perp: W / 2 }, // right edge
    { dir: 'west',  axis: 'z', sign: -1, len: D, perp: W / 2 }, // left edge
  ];

  const exitsByDir = {};
  for (const ex of exits) (exitsByDir[ex.direction] ||= []).push(ex);

  const wallEdges = []; // for thick line overlay
  for (const side of sides) {
    const exitList = exitsByDir[side.dir] || [];
    const half = side.len / 2;
    // gap descriptors along this side, normalised local -half..half
    const gaps = exitList.map((ex, i) => {
      // distribute multiple exits along the wall
      const t = (i + 1) / (exitList.length + 1);
      const cx = -half + t * side.len;
      return { exit: ex, center: cx, width: 1.3 };
    });

    // emit wall segments: span the side, skipping gaps
    const stops = [-half];
    for (const g0 of gaps) {
      stops.push(g0.center - g0.width / 2);
      stops.push(g0.center + g0.width / 2);
    }
    stops.push(half);

    for (let i = 0; i < stops.length; i += 2) {
      const a = stops[i], b = stops[i + 1];
      if (b - a < 0.05) continue;
      addWallSegment(g, side, a, b, H, wallT, wallEdges);
    }

    // exit markers + DOM tags placement targets
    for (const g0 of gaps) {
      g0.exit.__local = computeDoorAnchor(side, g0.center, H);
      addDoorMarker(g, side, g0.center, H);
    }
  }

  // ── thick phosphor edges ──────────────────────────────────────────────────
  const segGeom = new LineSegmentsGeometry();
  segGeom.setPositions(wallEdges.flat());
  const lineMat = new LineMaterial({
    color: PHOSPHOR.getHex(),
    linewidth: 3.0, // px in screen space
    worldUnits: false,
    dashed: false,
    resolution: new THREE.Vector2(stage.clientWidth, stage.clientHeight),
    transparent: true,
  });
  const edges = new LineSegments2(segGeom, lineMat);
  edges.computeLineDistances();
  g.add(edges);
  g.userData.lineMat = lineMat;

  // octagonal hint for Central Hall (corner cuts)
  if (room.shape === 'octagon') addOctagonOverlay(g, W, D, H);

  // courts: simulate open sky with a fading inner ring of light
  if (kindCfg.open_to_sky) addSkylight(g, W, D);

  scene.add(g);
  currentRoomGroup = g;

  // place camera to fit
  fitCameraToRoom(W, D, H);

  return { exits };
}

function addWallSegment(group, side, a, b, H, t, edgesOut) {
  const len = b - a;
  const cx  = (a + b) / 2;
  const isNS = side.axis === 'x'; // wall runs along X (north/south sides)

  const w = isNS ? len : t;
  const d = isNS ? t   : len;

  const geom = new THREE.BoxGeometry(w, H, d);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPhosphor: { value: PHOSPHOR },
      uDim:      { value: PHOSPHOR_DIM },
      uInk:      { value: INK_RED },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vN;
      uniform vec3 uPhosphor, uDim, uInk;
      void main() {
        // vertical hatch on walls; density depends on facing
        float face = abs(vN.y);                // top of wall
        float v = vUv.x * 18.0;
        float w = fwidth(v) * 1.2;
        float s = abs(fract(v) - 0.5);
        float lines = smoothstep(w, 0.0, s - 0.07);
        vec3 col = mix(uInk * 0.6, uDim, lines * 0.85);
        // top cap brighter
        col = mix(col, uPhosphor, smoothstep(0.95, 1.0, face) * 0.7);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.FrontSide,
  });
  const wall = new THREE.Mesh(geom, mat);

  // position
  if (side.dir === 'north') wall.position.set(cx, H / 2, -side.perp);
  if (side.dir === 'south') wall.position.set(cx, H / 2,  side.perp);
  if (side.dir === 'east')  wall.position.set( side.perp, H / 2, cx);
  if (side.dir === 'west')  wall.position.set(-side.perp, H / 2, cx);

  group.add(wall);

  // edge segments along the inner-top of the wall (phosphor outline)
  const x0 = wall.position.x - w / 2, x1 = wall.position.x + w / 2;
  const z0 = wall.position.z - d / 2, z1 = wall.position.z + d / 2;
  const yT = H, yB = 0.02;
  // top rectangle (visible from above)
  edgesOut.push([x0, yT, z0,  x1, yT, z0]);
  edgesOut.push([x1, yT, z0,  x1, yT, z1]);
  edgesOut.push([x1, yT, z1,  x0, yT, z1]);
  edgesOut.push([x0, yT, z1,  x0, yT, z0]);
  // base outline
  edgesOut.push([x0, yB, z0,  x1, yB, z0]);
  edgesOut.push([x1, yB, z0,  x1, yB, z1]);
  edgesOut.push([x1, yB, z1,  x0, yB, z1]);
  edgesOut.push([x0, yB, z1,  x0, yB, z0]);
  // verticals at outer corners
  edgesOut.push([x0, yB, z0,  x0, yT, z0]);
  edgesOut.push([x1, yB, z0,  x1, yT, z0]);
  edgesOut.push([x1, yB, z1,  x1, yT, z1]);
  edgesOut.push([x0, yB, z1,  x0, yT, z1]);
}

function addDoorMarker(group, side, center, H) {
  // a glyph drawn at the threshold, plus a directional chevron pointing outward
  const len = 1.1, thick = 0.06;
  const geom = new THREE.PlaneGeometry(len, thick);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: PHOSPHOR, transparent: true, opacity: 0.85 });
  const m = new THREE.Mesh(geom, mat);

  if (side.dir === 'north' || side.dir === 'south') {
    m.position.set(center, 0.04, side.dir === 'north' ? -side.perp : side.perp);
  } else {
    m.rotation.y = Math.PI / 2;
    m.position.set(side.dir === 'east' ? side.perp : -side.perp, 0.04, center);
  }
  group.add(m);

  // outward chevron
  const cgeom = new THREE.BufferGeometry();
  const s = 0.45;
  const tri = new Float32Array([
    -s, 0.05, 0,
     s, 0.05, 0,
     0, 0.05, -s,
  ]);
  cgeom.setAttribute('position', new THREE.BufferAttribute(tri, 3));
  cgeom.setIndex([0, 1, 2]);
  const cMat = new THREE.MeshBasicMaterial({ color: PHOSPHOR, transparent: true, opacity: 0.55, depthWrite: false });
  const chev = new THREE.Mesh(cgeom, cMat);
  if (side.dir === 'north') { chev.position.set(center, 0.05, -side.perp - 0.6); chev.rotation.y = Math.PI; }
  if (side.dir === 'south') { chev.position.set(center, 0.05,  side.perp + 0.6); }
  if (side.dir === 'east')  { chev.position.set( side.perp + 0.6, 0.05, center); chev.rotation.y = -Math.PI / 2; }
  if (side.dir === 'west')  { chev.position.set(-side.perp - 0.6, 0.05, center); chev.rotation.y =  Math.PI / 2; }
  group.add(chev);
}

function computeDoorAnchor(side, center, H) {
  // world-local coordinate above the door for placing the DOM label
  if (side.dir === 'north') return new THREE.Vector3(center, H + 0.4, -side.perp);
  if (side.dir === 'south') return new THREE.Vector3(center, H + 0.4,  side.perp);
  if (side.dir === 'east')  return new THREE.Vector3( side.perp, H + 0.4, center);
  if (side.dir === 'west')  return new THREE.Vector3(-side.perp, H + 0.4, center);
}

function addOctagonOverlay(group, W, D, H) {
  // diagonal corner braces to suggest octagon shape inside a rectangular footprint
  const c = 0.32;
  const Wp = W / 2, Dp = D / 2;
  const positions = [];
  const pairs = [
    [[-Wp + c * W, 0.03, -Dp], [-Wp, 0.03, -Dp + c * D]],
    [[ Wp - c * W, 0.03, -Dp], [ Wp, 0.03, -Dp + c * D]],
    [[ Wp - c * W, 0.03,  Dp], [ Wp, 0.03,  Dp - c * D]],
    [[-Wp + c * W, 0.03,  Dp], [-Wp, 0.03,  Dp - c * D]],
  ];
  for (const [a, b] of pairs) positions.push(...a, ...b);
  const geom = new LineSegmentsGeometry();
  geom.setPositions(positions);
  const mat = new LineMaterial({
    color: PHOSPHOR.getHex(), linewidth: 2.0,
    resolution: new THREE.Vector2(stage.clientWidth, stage.clientHeight),
    transparent: true, opacity: 0.85,
  });
  const seg = new LineSegments2(geom, mat);
  group.add(seg);
  group.userData.octMat = mat;
}

function addSkylight(group, W, D) {
  const r = Math.min(W, D) * 0.32;
  const geom = new THREE.RingGeometry(r * 0.9, r, 64);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: PHOSPHOR_DIM, transparent: true, opacity: 0.6, depthWrite: false,
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.position.y = 0.06;
  group.add(ring);
}

function hatchDensity(kind) {
  return ({ fine: 1.4, med: 1.0, wide: 0.65, dense: 1.7, books: 1.2, tower: 0.9, none: 0.0001 })[kind] ?? 1.0;
}
function hatchAngle(kind) {
  return ({ fine: 0.6, med: 0.785, wide: 0.5, dense: 1.05, books: 0.0, tower: 0.785, none: 0.0 })[kind] ?? 0.785;
}

// ─── camera ────────────────────────────────────────────────────────────────
function fitCameraToRoom(W, D, H) {
  const aspect = stage.clientWidth / stage.clientHeight;
  const span = Math.max(W, D / aspect) * 1.55;
  // keep that 3/4 angle, scale distance
  const tilt = THREE.MathUtils.degToRad(58);
  const r = span;
  camera.position.set(0, Math.cos(tilt) * r * 0.92, Math.sin(tilt) * r * 0.6 + 1.5);
  camera.lookAt(0, H * 0.4, 0);
  camera.updateProjectionMatrix();
}

// ─── room transitions ──────────────────────────────────────────────────────
function enterRoom(id, instant = false) {
  if (isTransitioning) return;
  if (id === currentRoomId) return;
  const room = roomsById.get(id);
  if (!room) return;

  isTransitioning = true;

  const after = () => {
    clearRoom();
    buildRoom(id);
    currentRoomId = id;
    setRoomName(room.name);
    layoutExitTags();
    fadeIn(() => { isTransitioning = false; });
  };

  if (instant) {
    after();
  } else {
    fadeOut(after);
  }
}

function fadeOut(done) {
  const dur = 280;
  const t0 = performance.now();
  const startScan = crtPass.uniforms.uScanline.value;
  const startBloom = bloomPass.strength;
  const tween = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    crtPass.uniforms.uScanline.value = startScan + (0.9 - startScan) * k;
    bloomPass.strength = startBloom + (2.4 - startBloom) * k;
    if (k < 1) requestAnimationFrame(tween); else done();
  };
  requestAnimationFrame(tween);
  hideExitTags();
  ui.name.classList.remove('show');
}
function fadeIn(done) {
  const dur = 360;
  const t0 = performance.now();
  const startScan = crtPass.uniforms.uScanline.value;
  const startBloom = bloomPass.strength;
  const tween = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    crtPass.uniforms.uScanline.value = startScan + (0.18 - startScan) * k;
    bloomPass.strength = startBloom + (1.05 - startBloom) * k;
    if (k < 1) requestAnimationFrame(tween); else done();
  };
  requestAnimationFrame(tween);
  showExitTags();
}

// ─── HUD ───────────────────────────────────────────────────────────────────
let nameTimer = null;
function setRoomName(n) {
  ui.name.textContent = n;
  ui.name.classList.add('show');
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => ui.name.classList.remove('show'), 2400);
}

function clearExitTags() {
  exitDoms.forEach(d => d.el.remove());
  exitDoms = [];
}
function hideExitTags() { exitDoms.forEach(d => d.el.classList.remove('show')); }
function showExitTags() { setTimeout(() => exitDoms.forEach(d => d.el.classList.add('show')), 60); }

function layoutExitTags() {
  clearExitTags();
  const exits = exitsByRoom.get(currentRoomId) || [];
  for (const ex of exits) {
    const dest = roomsById.get(ex.to);
    if (!dest) continue;
    const el = document.createElement('div');
    el.className = 'exit-tag';
    el.innerHTML = `<span class="arrow">${arrowFor(ex.direction)}</span>${escapeHtml(dest.name)}`;
    el.addEventListener('click', () => enterRoom(ex.to));
    el.addEventListener('touchend', (e) => { e.preventDefault(); enterRoom(ex.to); }, { passive: false });
    ui.exits.appendChild(el);
    exitDoms.push({ el, exit: ex });
  }
}

function arrowFor(dir) {
  return ({ north: '↑', south: '↓', east: '→', west: '←', up: '⇧', down: '⇩' })[dir] || '·';
}
function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function projectAnchor(local) {
  const v = local.clone().project(camera);
  const x = (v.x * 0.5 + 0.5) * stage.clientWidth;
  const y = (-v.y * 0.5 + 0.5) * stage.clientHeight;
  return { x, y, behind: v.z > 1 };
}

function updateExitTags() {
  for (const d of exitDoms) {
    const local = d.exit.__local;
    if (!local) continue;
    const p = projectAnchor(local);
    d.el.style.left = `${p.x}px`;
    d.el.style.top  = `${p.y}px`;
    d.el.style.opacity = p.behind ? '0' : '';
  }
}

// ─── input ─────────────────────────────────────────────────────────────────
function bindEvents() {
  // swipe → move in cardinal direction if a matching exit exists
  let sx = 0, sy = 0, t0 = 0, tracking = false;
  stage.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = performance.now(); tracking = true;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (!tracking) return; tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const dt = performance.now() - t0;
    if (dt > 600) return;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 36) return;
    let dir;
    if (adx > ady) dir = dx > 0 ? 'east' : 'west';
    else            dir = dy > 0 ? 'south' : 'north';
    const ex = (exitsByRoom.get(currentRoomId) || []).find(e => e.direction === dir);
    if (ex) enterRoom(ex.to);
  }, { passive: true });

  // keyboard for desktop
  window.addEventListener('keydown', e => {
    const map = { ArrowUp: 'north', ArrowDown: 'south', ArrowLeft: 'west', ArrowRight: 'east',
                  w: 'north', s: 'south', a: 'west', d: 'east' };
    const dir = map[e.key];
    if (!dir) return;
    const ex = (exitsByRoom.get(currentRoomId) || []).find(x => x.direction === dir);
    if (ex) enterRoom(ex.to);
  });
}

// ─── frame loop ────────────────────────────────────────────────────────────
function tick() {
  const dt = clock.getDelta();
  const t  = clock.getElapsedTime();

  if (currentRoomGroup) {
    // a faint idle drift on the camera (CRT-table tremor)
    camera.position.x = Math.sin(t * 0.21) * 0.18;
    camera.lookAt(0, 0.6, 0);
  }

  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uResolution.value.set(stage.clientWidth, stage.clientHeight);

  composer.render(dt);
  updateExitTags();
}

function resize() {
  const w = stage.clientWidth = window.innerWidth;
  const h = stage.clientHeight = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  // line materials need pixel-resolution updates
  scene?.traverse(obj => {
    if (obj.material && obj.material.isLineMaterial) {
      obj.material.resolution.set(w, h);
    }
  });
}
