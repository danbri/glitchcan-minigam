// Waterworld FX — the living water. Everything in here is atmosphere:
// a basin-wide gyre current, boid fish schools, god rays with dust motes,
// neon plankton, drifting debris, vent bubble columns, and the thermal
// (IR) systems. No gameplay state lives here; game.js asks, fx answers.

import * as THREE from '../../../trees/vendor/three.module.min.js';
import { BOUNDS, floorYAt } from './world.js';

// ---------------------------------------------------------------- textures
function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,250,220,0.75)');
  v.addColorStop(0.55, 'rgba(200,235,255,0.28)');
  v.addColorStop(1, 'rgba(150,220,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  // fade the shaft's edges so planes read as light, not geometry
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.25, 'rgba(0,0,0,1)');
  h.addColorStop(0.75, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export function glowSprite(color, size = 3, opacity = 0.55) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.scale.setScalar(size);
  return m;
}

// ---------------------------------------------------------------- current
// One slow anticlockwise gyre around the basin centre, wobbled so nothing
// ever quite repeats. Everything drifting asks this one function.
const _tmp = new THREE.Vector3();
export function currentAt(p, t, out) {
  const r = Math.hypot(p.x, p.z) + 4;
  const s = 1.5 * Math.min(1, r / 90);
  out.set(
    (-p.z / r) * s + 0.35 * Math.sin(0.09 * p.z + t * 0.13),
    0.12 * Math.sin(t * 0.21 + p.x * 0.045),
    (p.x / r) * s + 0.35 * Math.cos(0.08 * p.x + t * 0.11));
  return out;
}

// ---------------------------------------------------------------- boids
class School {
  constructor(scene, n, home, radius, baseHue, size) {
    this.n = n;
    this.home = home;
    this.radius = radius;
    this.baseHue = baseHue;
    this.phase = Math.random() * 9;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = home.x + (Math.random() - 0.5) * radius;
      this.pos[i * 3 + 1] = home.y + (Math.random() - 0.5) * radius * 0.5;
      this.pos[i * 3 + 2] = home.z + (Math.random() - 0.5) * radius;
      this.vel[i * 3] = (Math.random() - 0.5) * 4;
      this.vel[i * 3 + 1] = (Math.random() - 0.5) * 1;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({
      size, transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.mat.color.setHSL(baseHue, 0.85, 0.62);
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  step(dt, t, sub, threats) {
    const { n, pos, vel } = this;
    const K = 7;                       // sampled neighbours per boid
    const maxV = 8.5;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      let ax = 0, ay = 0, az = 0;
      let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
      // sample a handful of flockmates — O(n·K), swirls just as well
      for (let k = 0; k < K; k++) {
        const j = ((Math.random() * n) | 0) * 3;
        const dx = pos[j] - pos[ix], dy = pos[j + 1] - pos[ix + 1], dz = pos[j + 2] - pos[ix + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 6) { ax -= dx; ay -= dy; az -= dz; }            // separate
        cx += dx; cy += dy; cz += dz;                             // cohere
        vx += vel[j]; vy += vel[j + 1]; vz += vel[j + 2];         // align
      }
      ax += cx * 0.012 + (vx / K - vel[ix]) * 0.18;
      ay += cy * 0.012 + (vy / K - vel[ix + 1]) * 0.18;
      az += cz * 0.012 + (vz / K - vel[ix + 2]) * 0.18;
      // home spring keeps the school haunting its wreck
      ax += (this.home.x - pos[ix]) * 0.015;
      ay += (this.home.y - pos[ix + 1]) * 0.03;
      az += (this.home.z - pos[ix + 2]) * 0.015;
      // flee the sub and the eels
      for (const th of threats) {
        const dx = pos[ix] - th.x, dy = pos[ix + 1] - th.y, dz = pos[ix + 2] - th.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 144 && d2 > 0.01) {
          const f = 30 / d2;
          ax += dx * f; ay += dy * f; az += dz * f;
        }
      }
      // the gyre carries everyone
      _tmp.set(pos[ix], pos[ix + 1], pos[ix + 2]);
      currentAt(_tmp, t, _tmp);
      ax += _tmp.x * 0.35; ay += _tmp.y * 0.35; az += _tmp.z * 0.35;

      vel[ix] += ax * dt * 4; vel[ix + 1] += ay * dt * 4; vel[ix + 2] += az * dt * 4;
      const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]);
      if (sp > maxV) { const f = maxV / sp; vel[ix] *= f; vel[ix + 1] *= f; vel[ix + 2] *= f; }
      pos[ix] += vel[ix] * dt; pos[ix + 1] += vel[ix + 1] * dt; pos[ix + 2] += vel[ix + 2] * dt;
      // stay off the mud and under the surface
      const fy = floorYAt(pos[ix], pos[ix + 2]) + 1.5;
      if (pos[ix + 1] < fy) { pos[ix + 1] = fy; vel[ix + 1] = Math.abs(vel[ix + 1]); }
      if (pos[ix + 1] > -3) { pos[ix + 1] = -3; vel[ix + 1] = -Math.abs(vel[ix + 1]); }
    }
    this.geo.attributes.position.needsUpdate = true;
    // neon shimmer: the whole school breathes through nearby hues
    this.mat.color.setHSL(
      (this.baseHue + 0.05 * Math.sin(t * 0.6 + this.phase) + 1) % 1,
      0.85, 0.55 + 0.18 * Math.sin(t * 2.3 + this.phase));
  }
}

// ---------------------------------------------------------------- the lot
export class UnderwaterFX {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.lite = !!opts.lite;
    this.ir = false;
    const q = this.lite ? 0.45 : 1;

    // --- god rays: slanted additive shafts under the surface
    this.rays = [];
    const rayTex = rayTexture();
    for (let i = 0; i < Math.round(11 * q); i++) {
      const w = 5 + Math.random() * 11;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 62),
        new THREE.MeshBasicMaterial({
          map: rayTex, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
          side: THREE.DoubleSide, fog: false,
        }));
      m.position.set(-115 + Math.random() * 150, -30, BOUNDS.minZ + 10 + Math.random() * 140);
      m.rotation.y = Math.random() * Math.PI;
      m.rotation.z = 0.18 + Math.random() * 0.14;   // sun comes in aslant
      m.userData = { phase: Math.random() * 9, base: 0.16 + Math.random() * 0.22 };
      m.frustumCulled = false;
      scene.add(m);
      this.rays.push(m);
    }

    // --- motes: dust hanging in the light, brightest inside the shafts
    this.motes = this._cloud(Math.round(420 * q), 0xfff4cc, 0.3, (i, a) => {
      const ray = this.rays[i % Math.max(1, this.rays.length)];
      a[i * 3] = (ray ? ray.position.x : 0) + (Math.random() - 0.5) * 14;
      a[i * 3 + 1] = -2 - Math.random() * 30;
      a[i * 3 + 2] = (ray ? ray.position.z : 0) + (Math.random() - 0.5) * 14;
    }, 0.5);

    // --- plankton: neon specks everywhere, vertex-coloured
    const pn = Math.round(650 * q);
    const pgeo = new THREE.BufferGeometry();
    const pa = new Float32Array(pn * 3), pc = new Float32Array(pn * 3);
    const palette = [0x33ffee, 0xff66cc, 0x66aaff, 0x9efff2, 0x88ffaa];
    const col = new THREE.Color();
    for (let i = 0; i < pn; i++) {
      pa[i * 3] = BOUNDS.minX + Math.random() * (BOUNDS.maxX - BOUNDS.minX);
      pa[i * 3 + 1] = -3 - Math.random() * 58;
      pa[i * 3 + 2] = BOUNDS.minZ + Math.random() * (BOUNDS.maxZ - BOUNDS.minZ);
      col.set(palette[(Math.random() * palette.length) | 0]);
      pc[i * 3] = col.r; pc[i * 3 + 1] = col.g; pc[i * 3 + 2] = col.b;
    }
    pgeo.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    pgeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    this.plankton = new THREE.Points(pgeo, new THREE.PointsMaterial({
      size: 0.42, vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.plankton.frustumCulled = false;
    scene.add(this.plankton);

    // --- drifting stuff: dull debris riding the gyre
    this.debris = this._cloud(Math.round(240 * q), 0xa8926a, 0.5, (i, a) => {
      a[i * 3] = BOUNDS.minX + Math.random() * (BOUNDS.maxX - BOUNDS.minX);
      a[i * 3 + 1] = -4 - Math.random() * 55;
      a[i * 3 + 2] = BOUNDS.minZ + Math.random() * (BOUNDS.maxZ - BOUNDS.minZ);
    }, 0.35);

    // --- fish: three schools, each haunting a wreck
    this.schools = [
      new School(scene, Math.round(130 * q), new THREE.Vector3(-40, -26, 30), 26, 0.5, 0.6),  // cyan, barge
      new School(scene, Math.round(110 * q), new THREE.Vector3(60, -50, 40), 22, 0.12, 0.55), // gold, crane
      new School(scene, Math.round(100 * q), new THREE.Vector3(85, -52, -30), 22, 0.87, 0.6), // pink, warehouse
    ];

    // --- vents: bubble columns off the dock floor
    this.vents = [];
    for (const [vx, vz] of [[-20, -12], [64, 18], [-62, -58]]) {
      const vy = floorYAt(vx, vz);
      const v = this._cloud(Math.round(70 * q), 0xcdf6ff, 0.35, (i, a) => {
        a[i * 3] = vx + (Math.random() - 0.5) * 2.5;
        a[i * 3 + 1] = vy + Math.random() * 34;
        a[i * 3 + 2] = vz + (Math.random() - 0.5) * 2.5;
      }, 0.5);
      v.userData = { vx, vy, vz };
      this.vents.push(v);
    }

    // --- heat plumes: born cold, only visible in IR
    this.plumes = this._cloud(Math.round(160 * q), 0xffcc66, 0.7, (i, a) => {
      a[i * 3] = 0; a[i * 3 + 1] = -200; a[i * 3 + 2] = 0;   // parked offscreen
    }, 0.0);
    this._plumeAge = new Float32Array(this.plumes.geometry.attributes.position.count).map(() => Math.random() * 3);
  }

  _cloud(count, color, size, fill, opacity) {
    const geo = new THREE.BufferGeometry();
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) fill(i, a);
    geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    p.frustumCulled = false;
    this.scene.add(p);
    return p;
  }

  // hotSpots: [{x,y,z}] — fatbergs and the sub's engine, fed by game.js
  step(dt, t, subPos, threats, camDepth, hotSpots = []) {
    // god rays live near the surface and die with depth
    const depthFade = Math.max(0, Math.min(1, 1 - (camDepth - 10) / 34));
    for (const r of this.rays) {
      const u = r.userData;
      r.material.opacity = this.ir ? 0
        : u.base * depthFade * (0.55 + 0.45 * Math.sin(t * 0.3 + u.phase));
      r.rotation.y += dt * 0.02;
    }

    // motes rise gently and twinkle as one
    this._drift(this.motes, dt, t, 0.35, 0.55);
    this.motes.material.opacity = this.ir ? 0.05
      : depthFade * (0.35 + 0.2 * Math.sin(t * 1.7));

    this._drift(this.plankton, dt, t, 0.5, 0);
    this.plankton.material.opacity = this.ir ? 0.08 : 0.55 + 0.25 * Math.sin(t * 0.9);

    this._drift(this.debris, dt, t, 1.0, 0);

    for (const s of this.schools) s.step(dt, t, subPos, threats);

    // vent bubbles rise and recycle
    for (const v of this.vents) {
      const pos = v.geometry.attributes.position;
      const { vx, vy, vz } = v.userData;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (3.5 + (i % 5) * 0.5);
        if (y > vy + 36) {
          y = vy + Math.random() * 2;
          pos.setX(i, vx + (Math.random() - 0.5) * 2.5);
          pos.setZ(i, vz + (Math.random() - 0.5) * 2.5);
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // heat plumes: only fed while IR is on
    if (this.ir && hotSpots.length) {
      const pos = this.plumes.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        this._plumeAge[i] += dt;
        if (this._plumeAge[i] > 3) {
          this._plumeAge[i] = 0;
          const h = hotSpots[i % hotSpots.length];
          pos.setXYZ(i, h.x + (Math.random() - 0.5) * 2, h.y + 1, h.z + (Math.random() - 0.5) * 2);
        } else {
          pos.setY(i, pos.getY(i) + dt * 2.2);
          pos.setX(i, pos.getX(i) + Math.sin(t * 3 + i) * dt * 0.4);
        }
      }
      pos.needsUpdate = true;
      this.plumes.material.opacity = 0.5;
    } else {
      this.plumes.material.opacity = 0;
    }
  }

  _drift(points, dt, t, carry, rise) {
    const pos = points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const p = _tmp.clone();
      currentAt(p, t, _tmp);
      let x = p.x + _tmp.x * carry * dt;
      let y = p.y + (_tmp.y * carry + rise) * dt;
      let z = p.z + _tmp.z * carry * dt;
      if (x < BOUNDS.minX) x = BOUNDS.maxX; if (x > BOUNDS.maxX) x = BOUNDS.minX;
      if (z < BOUNDS.minZ) z = BOUNDS.maxZ; if (z > BOUNDS.maxZ) z = BOUNDS.minZ;
      if (y > -2) y = -58; if (y < -60) y = -3;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  setIR(on) { this.ir = on; }
}
