// Waterworld — Docklands Deep. The simulation: one submarine, one drowned
// dock, eels, mines, fatbergs, a ghost whale, and a pirate chest.
//
// The loop is deliberately tight: ping → glint → grab → bank → breathe.
// Difficulty is "disturbance": every banking stirs the dock up a little.

import * as THREE from '../../../trees/vendor/three.module.min.js';
import {
  P8, mat, buildDock, makeSub, makeEelHead, makeEelSegment, makeFatberg,
  makeMine, makeSalvageMesh, makeQuestMesh, makeParticleCloud,
  makeGhostWhale, makeSeal, makeDuck, BOUNDS, SHELF_Y, DEEP_Y, floorYAt, tint,
} from './world.js';
import { UnderwaterFX, glowSprite, currentAt } from './fx.js';
import { Composite } from './post.js';
import { FACTS, QUEST_ITEMS, TOOLS, HINTS } from './facts.js';

const AIR_MAX = 100;
const HULL_MAX = 4;
const _cur = new THREE.Vector3();
// The sub's pose is composed from QUATERNIONS, never read back from
// Euler angles. The old code did `rotation.set(yaw)` + `rotateZ(pitch)`
// and then read-modified `rotation.x` — but a yaw+pitch composition has
// two equivalent Euler representations, and near the flip boundary the
// extracted angles alternate between them frame to frame. Writing .x
// back then slammed the craft between two orientations with no
// in-between: the reported drift glitch.
const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);

export class WaterworldGame {
  // ui: { hud(state), toast(text, cls), fact(title, text, icon),
  //       announce(text), complete(result), hint(text) }
  constructor(canvas, ui, opts = {}) {
    this.canvas = canvas;
    this.ui = ui;
    this.lite = !!opts.lite;
    this.running = false;
    this.over = false;
    this._raf = null;
    this._last = 0;
    this.keys = { up: false, down: false, left: false, right: false, a: false, b: false };
    this.elapsed = 0;

    // player state
    this.pos = new THREE.Vector3(-88, -16, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.air = AIR_MAX;
    this.hull = HULL_MAX;
    this.score = 0;
    this.cargo = [];             // unbanked {type, value}
    this.bankedTypes = new Set();
    this.bankedValue = 0;
    this.banks = 0;              // completed bankings → disturbance
    this.items = new Set();      // quest halves held
    this.tools = new Set();      // crafted tools
    this.codex = new Set();      // fact types seen
    this.hasChest = false;
    this.won = false;
    this._biteCooldown = 0;
    this._pingCooldown = 0;
    this._lowAirWarned = false;
    this._hintIdx = 0;
    this._hintTimer = 18;
    this._factQueue = [];

    // the captain's helm: she sails herself until you touch her
    this.autopilot = true;
    this.manualUntil = 0;
    this._explore = null;        // a brushed course order {yaw,pitch,until}
    this._brushCount = 0;
    this._lastAutoPing = 0;
    this._autoThrust = false;
    this._autoFizz = false;
    this._helmActive = false;
    this._smYaw = 0;             // low-passed desired heading — the
    this._smPitch = 0;           // helm may never snap between poses
    this._smRoll = 0;            // roll as a SCALAR, never read from Eulers
    this._terrainLift = false;   // hysteresis, not a flickering flag

    // visitors
    this.seal = null;
    this._sealAt = 45;
    this.duck = null;
    this._duckDone = false;
  }

  // ------------------------------------------------------------- setup
  init() {
    const c = this.canvas;
    // ?probe keeps the buffer readable for headless pixel checks —
    // costs a copy per frame, so never on by default
    const probe = /[?&]probe\b/.test(location.search);
    this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true,
      preserveDrawingBuffer: probe });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lite ? 1.25 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(P8.navy);
    this.scene.fog = new THREE.FogExp2(P8.navy, 0.02);
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400);

    // light through water: a friendly bright blue, dimming with depth
    this.scene.add(new THREE.HemisphereLight(0x77bbff, 0x102048, 1.35));
    const sun = new THREE.DirectionalLight(0xbbe6ff, 1.0);
    sun.position.set(20, 80, 10);
    this.scene.add(sun);
    this._sunDir = sun.position.clone().normalize();

    // the compositing pass: crepuscular rays, absorption, grade, grain
    this.post = new Composite(this.renderer, this.scene, this.camera, { lite: this.lite });

    this.dock = buildDock(this.scene);

    this.sub = makeSub();
    this.sub.position.copy(this.pos);
    tint(this.sub, 0xffec27, 0.5);
    this.sub.userData.irColor = 0xbb5533;          // a warm engine in the dark
    // the visible beam: an additive cone the headlamp appears to cast
    this.lightCone = new THREE.Mesh(
      new THREE.ConeGeometry(3.6, 16, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.06,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.lightCone.rotation.z = Math.PI / 2;       // apex forward at the nose
    this.lightCone.position.set(10.5, 0, 0);
    this.lightCone.userData.noNeon = true;
    this.sub.add(this.lightCone);
    this.scene.add(this.sub);
    this.headlamp = new THREE.SpotLight(0xfff1e8, 0, 60, 0.5, 0.4);
    this.headlamp.position.set(2, 0, 0);
    this.headlamp.target.position.set(20, 0, 0);
    this.sub.add(this.headlamp);
    this.sub.add(this.headlamp.target);

    this._spawnSalvage();
    this._spawnQuestItems();
    this._spawnEels(3);
    this._spawnMines();
    this._spawnFatbergs();

    // ghost whale, waiting in the wings
    this.whale = makeGhostWhale();
    this.whale.visible = false;
    this.scene.add(this.whale);
    this.whaleActive = false;
    this.whalePhase = 0;
    this._whaleSongT = 0;

    // marine snow + bubbles
    this.snow = makeParticleCloud(this.lite ? 150 : 500, 0x99bbdd, 0.35, 180);
    this.snow.position.y = -30;
    this.scene.add(this.snow);

    // the living water: currents, fish, god rays, plankton, vents, plumes
    this.fx = new UnderwaterFX(this.scene, { lite: this.lite });
    this.ir = false;
    this._irMats = new Map();
    this._irUsedOnce = false;
    this.bubbles = [];
    this._bubbleT = 0;

    // sonar ring + glints
    this.pingRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 4, 24),
      mat(P8.blue, { emissive: 0x1155aa, transparent: true, opacity: 0.9 }));
    this.pingRing.visible = false;
    this.pingRing.userData.irSkip = true;
    this.scene.add(this.pingRing);
    this._pingAge = 99;
    this.glints = [];

    // the bell is the warm heart of the dive — let it read that way
    const bellGlow = glowSprite(0xffec27, 11, 0.5);
    bellGlow.userData.irHot = true;
    bellGlow.position.y = -1;
    this.dock.bell.add(bellGlow);
    this.dock.bell.userData.irColor = 0xffaa44;
    this.lightCone.userData.irSkip = true;

    this.resize();
    this.render();
  }

  resize() {
    // full-resolution rendering (art direction v2 — the low-res
    // pixelated look is retired)
    const w = this.canvas.clientWidth || 480, h = this.canvas.clientHeight || 270;
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------- spawns
  _spawnSalvage() {
    this.salvage = [];
    const put = (type, x, z, opts = {}) => {
      const y = opts.y ?? floorYAt(x, z) + 0.4;
      const g = makeSalvageMesh(type);
      g.position.set(x, y, z);
      g.rotation.y = Math.random() * Math.PI * 2;
      const halo = glowSprite(
        type === 'captains_chest' ? 0xffec27 : type === 'fatberg_relic' ? 0xffccaa : 0xaef0ff,
        type === 'captains_chest' ? 4.5 : 2.0,
        type === 'captains_chest' ? 0.6 : 0.3);
      halo.position.y = 0.8;
      g.add(halo);
      this.scene.add(g);
      this.salvage.push({ type, mesh: g, collected: false,
        heavy: !!opts.heavy, hidden: !!opts.hidden,
        value: FACTS[type]?.value ?? 10 });
      if (opts.hidden) g.visible = false;
      return this.salvage[this.salvage.length - 1];
    };
    // shallow shelf: the easy pickings
    put('clay_pipe', -70, -10); put('clay_pipe', -30, 40); put('clay_pipe', 0, -30);
    put('green_bottle', -55, 20); put('green_bottle', -20, -45); put('green_bottle', -80, 45);
    put('anchor_chain', -60, -35); put('anchor_chain', 5, 30);
    put('sugar_barrel', -38, 33, { y: SHELF_Y + 7 });   // in the barge hold
    put('tea_chest', -45, 25); put('tea_chest', 10, 50);
    // slope + deep basin: worth the dark
    put('cannonball', 40, -20); put('cannonball', 55, 60);
    put('ships_bell', 70, -45); put('whale_bone', 90, 20); put('whale_bone', 50, 0);
    put('roman_coin', 100, -60); put('roman_coin', 75, 55);
    put('figurehead', 88, -28, { heavy: true });        // by the warehouse
    // the prize — revealed by the whale, needs the grapple
    this.chest = put('captains_chest', 105, 55, { heavy: true, hidden: true });
  }

  _spawnQuestItems() {
    this.quest = [];
    const put = (id, x, z, y) => {
      const g = makeQuestMesh();
      g.position.set(x, y ?? floorYAt(x, z) + 0.3, z);
      const halo = glowSprite(0xff77a8, 3.2, 0.45);
      halo.position.y = 0.7;
      g.add(halo);
      this.scene.add(g);
      this.quest.push({ id, mesh: g, taken: false });
    };
    // shallow, findable: the grapple and the fizz lance
    put('magnet', -75, 30);
    put('rope', -42, 27, SHELF_Y + 8);      // on the barge deck
    put('soda', -12, -22);
    put('nozzle', 58, 38, DEEP_Y + 24);     // hanging off the crane jib
    // behind the fatbergs: the lamp for the deep
    put('lamp', -70, -74);
    put('battery', -30, -74);
  }

  _spawnEels(n) {
    this.eels = this.eels || [];
    for (let i = 0; i < n; i++) {
      const head = makeEelHead();
      tint(head, 0x00e436, 0.6);
      head.userData.irColor = 0x38506e;         // cold-blooded: a faint trace
      const eyeGlow = glowSprite(0xff004d, 1.6, 0.6);
      eyeGlow.position.set(-0.2, 0.45, 0);
      eyeGlow.userData.irHot = true;
      head.add(eyeGlow);
      const segs = [];
      for (let s = 0; s < 6; s++) {
        const m = makeEelSegment(s);
        m.userData.irColor = 0x38506e;
        this.scene.add(m);
        segs.push(m);
      }
      this.scene.add(head);
      if (this.ir) { this._irApply(head); segs.forEach(s => this._irApply(s)); }
      const cx = 30 + Math.random() * 70, cz = (Math.random() - 0.5) * 120;
      this.eels.push({
        head, segs,
        pos: new THREE.Vector3(cx, floorYAt(cx, cz) + 6 + Math.random() * 10, cz),
        angle: Math.random() * Math.PI * 2,
        center: new THREE.Vector3(cx, 0, cz),
        radius: 10 + Math.random() * 14,
        speed: 6 + Math.random() * 3,
        stun: 0, bite: 0,
      });
    }
  }

  _spawnMines() {
    this.mines = [];
    const spots = [[45, -50], [70, 10], [95, -10], [60, 55], [110, 30]];
    for (const [x, z] of spots) {
      const m = makeMine();
      m.userData.irColor = 0x8a4a33;             // old explosive, faintly warm
      const blink = glowSprite(0xff004d, 1.6, 0.35);
      blink.position.y = 1.4;
      blink.userData.irHot = true;
      m.add(blink);
      m.userData.blink = blink;
      const y = floorYAt(x, z) + 5 + Math.random() * 6;
      m.position.set(x, y, z);
      this.scene.add(m);
      // anchor cable
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.1, y - floorYAt(x, z), 0.1), mat(P8.dusk));
      cable.position.set(x, (y + floorYAt(x, z)) / 2, z);
      this.scene.add(cable);
      this.mines.push({ mesh: m, cable, live: true, beep: 0 });
    }
  }

  _spawnFatbergs() {
    this.fatbergs = [];
    // one parked in each culvert mouth, blocking it
    for (const mouth of this.dock.culverts) {
      const f = makeFatberg(4.2);
      tint(f, 0xffccaa, 0.4);
      f.userData.irColor = 0xffdd66;             // decomposition runs HOT
      f.position.set(mouth.x, mouth.y + 1, mouth.z + 2);
      this.scene.add(f);
      this.fatbergs.push({ mesh: f, hp: 3, r: 4.5, blocking: true,
        vel: new THREE.Vector3(), wobble: Math.random() * 9 });
    }
  }

  _spawnRampantFatberg() {
    const mouth = this.dock.culverts[Math.floor(Math.random() * this.dock.culverts.length)];
    const f = makeFatberg(2.6);
    tint(f, 0xffccaa, 0.4);
    f.userData.irColor = 0xffdd66;
    f.position.set(mouth.x, mouth.y + 2, mouth.z + 6);
    this.scene.add(f);
    if (this.ir) this._irApply(f);
    const away = new THREE.Vector3(Math.random() - 0.5, 0.1, 0.8).normalize().multiplyScalar(2.2);
    this.fatbergs.push({ mesh: f, hp: 2, r: 2.8, blocking: false, vel: away,
      wobble: Math.random() * 9 });
    this.ui.toast('⚠ A FATBERG HAS ESCAPED THE TUNNELS', 'warn');
    this.ui.announce('A fatberg has escaped the tunnels');
  }

  // ------------------------------------------------------------- input
  setKey(k, down) {
    if (k in this.keys) this.keys[k] = down;
    // taking any control surface takes the helm for a few seconds
    if (down && k !== 'b') this.manualUntil = this.elapsed + 4;
    if (k === 'b' && down) this._doPing();
  }

  // A brush across the water is a course order from the captain: bank
  // onto the swiped heading and hold it a while, then resume the hunt.
  // dxN/dyN are normalised screen deltas (right and down positive).
  brush(dxN, dyN) {
    const yaw = this.yaw - dxN * 3.4;
    const pitch = Math.max(-0.8, Math.min(0.8, this.pitch - dyN * 2.2));
    this._explore = { yaw, pitch, until: this.elapsed + 8 };
    this.manualUntil = 0;          // the helm answers the brush at once
    this.autopilot = true;
    this.ui.audio?.swish();
    if (this._brushCount < 3) {
      this._brushCount++;
      this.ui.toast('↪ Aye aye, Captain — new course!', 'good');
    }
    this.ui.announce('New course set.');
  }

  // ------------------------------------------------------------- the helm
  // Sails toward the objective (or a brushed course), keeps off the
  // floor, the surface, the walls and the mines, pings as she hunts,
  // and even works the fizz lance when she's alongside a fatberg.
  _helm(dt) {
    this._helmActive = true;
    // re-engaging after manual or a brush: start the filter from where
    // the boat actually is, or the first frame swings from stale state
    if (!this._helmWasActive) { this._smYaw = this.yaw; this._smPitch = this.pitch; }
    let desYaw, desPitch;
    const exploring = this._explore && this.elapsed < this._explore.until;
    const obj = exploring ? null : this._objective();
    let dist = 99;
    if (exploring) {
      desYaw = this._explore.yaw;
      desPitch = this._explore.pitch;
    } else if (obj && obj.target) {
      const dx = obj.target.x - this.pos.x, dz = obj.target.z - this.pos.z;
      const dy = (obj.target.y ?? this.pos.y) - this.pos.y;
      dist = Math.hypot(dx, dz);
      // deadband: right on top of the target, bearing is noise — hold
      // the heading and settle vertically instead of chasing atan2 jitter
      desYaw = dist < 5 ? this.yaw : Math.atan2(-dz, dx);
      desPitch = Math.max(-0.65, Math.min(0.65, Math.atan2(dy, Math.max(dist, 5))));
    } else {
      this._helmActive = false;
      return;
    }
    // avoidance, as a steering vector blended into the desired heading
    const dir = new THREE.Vector3(
      Math.cos(desPitch) * Math.cos(desYaw), Math.sin(desPitch),
      -Math.cos(desPitch) * Math.sin(desYaw));
    for (const m of this.mines) {
      if (!m.live) continue;
      const d = m.mesh.position.distanceTo(this.pos);
      if (d < 13) {
        dir.addScaledVector(
          _cur.subVectors(this.pos, m.mesh.position).normalize(), (13 - d) / 6);
      }
    }
    for (const c of this.dock.colliders) {
      const d = this.pos.distanceTo(c);
      if (d < c.r + 7) {
        dir.addScaledVector(_cur.set(this.pos.x - c.x, this.pos.y - c.y,
          this.pos.z - c.z).normalize(), (c.r + 7 - d) / 6);
      }
    }
    // terrain ahead: pull up early — WITH hysteresis, or the lift flag
    // flickers every frame and the boat wags between two pitches
    const px = this.pos.x + dir.x * 12, pz = this.pos.z + dir.z * 12;
    const clearance = this.pos.y - floorYAt(px, pz);
    if (this._terrainLift) {
      if (clearance > 7) this._terrainLift = false;
    } else if (clearance < 3.5) {
      this._terrainLift = true;
    }
    if (this._terrainLift) dir.y = Math.max(dir.y, 0.6);
    if (this.pos.y > BOUNDS.surface - 2) dir.y = Math.min(dir.y, -0.1);
    if (px < BOUNDS.minX + 8 || px > BOUNDS.maxX - 8 ||
        pz < BOUNDS.minZ + 8 || pz > BOUNDS.maxZ - 8) {
      dir.x += (0 - this.pos.x) * 0.02;
      dir.z += (0 - this.pos.z) * 0.02;
    }
    dir.normalize();
    desYaw = Math.atan2(-dir.z, dir.x);
    desPitch = Math.max(-0.8, Math.min(0.8, Math.asin(Math.max(-1, Math.min(1, dir.y)))));
    // LOW-PASS the desired heading before steering toward it. Raw desire
    // can flip pose-to-pose (avoidance engaging, a target passing under
    // the keel) and steering straight at it made the boat oscillate
    // between two angles with no in-between — the reported glitch. The
    // filtered desire cannot step, so the boat cannot snap.
    let sd = desYaw - this._smYaw;
    while (sd > Math.PI) sd -= Math.PI * 2;
    while (sd < -Math.PI) sd += Math.PI * 2;
    this._smYaw += sd * Math.min(1, 3.5 * dt);
    while (this._smYaw > Math.PI) this._smYaw -= Math.PI * 2;
    while (this._smYaw < -Math.PI) this._smYaw += Math.PI * 2;
    this._smPitch += (desPitch - this._smPitch) * Math.min(1, 3.5 * dt);
    // steer toward the FILTERED desire, remember the turn for the rudder
    let dYaw = this._smYaw - this.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const turn = Math.max(-1.5 * dt, Math.min(1.5 * dt, dYaw));
    this.yaw += turn;
    this._helmTurn = Math.max(-0.5, Math.min(0.5, dYaw));
    this.pitch += Math.max(-1.1 * dt, Math.min(1.1 * dt, this._smPitch - this.pitch));
    this._autoThrust = exploring || dist > 7;
    // she pings as she hunts — the sonar chimes are half the mood
    if (this._pingCooldown <= 0 && this.elapsed - this._lastAutoPing > 7 && !exploring) {
      this._lastAutoPing = this.elapsed;
      this._doPing();
    }
    // and works the lance alongside a fatberg
    if (this.tools.has('fizzlance')) {
      for (const f of this.fatbergs) {
        if (f.mesh.position.distanceTo(this.pos) < f.r + 5.5) { this._autoFizz = true; break; }
      }
    }
  }

  // ------------------------------------------------------------- IR mode
  // Thermal sight: every mesh drops to a cold navy silhouette unless
  // something tagged it with a temperature (userData.irColor, inherited
  // down the subtree). Fatbergs blaze — decomposition runs warm — the
  // sub's engine glows, old explosives smoulder, eels barely register
  // (cold-blooded), and the ghost whale shows as a COLD blue void.
  _irMat(color) {
    if (!this._irMats.has(color)) {
      this._irMats.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return this._irMats.get(color);
  }

  _irColorFor(o) {
    let n = o;
    while (n) {
      if (n.userData && n.userData.irColor) return n.userData.irColor;
      n = n.parent;
    }
    return null;
  }

  _irApply(root) {
    root.traverse((o) => {
      if (o.userData && o.userData.irSkip) return;
      if (o.isLineSegments) {
        if (o.visible) { o.userData._irHid = true; o.visible = false; }
      } else if (o.isSprite) {
        if (!o.userData.irHot && o.visible) { o.userData._irHid = true; o.visible = false; }
      } else if (o.isMesh) {
        if (!o.userData._origMat) o.userData._origMat = o.material;
        o.material = this._irMat(this._irColorFor(o) ?? 0x0a1224);
      }
    });
  }

  _irRestore(root) {
    root.traverse((o) => {
      if (o.userData && o.userData._irHid) { o.visible = true; delete o.userData._irHid; }
      if (o.isMesh && o.userData._origMat) {
        o.material = o.userData._origMat;
        delete o.userData._origMat;
      }
    });
  }

  toggleIR() {
    this.ir = !this.ir;
    this.fx.setIR(this.ir);
    if (this.ir) {
      this._irApply(this.scene);
      this.whale.material.color.set(0x3366ff);
      this.ui.toast('▣ THERMAL SIGHT', 'warn');
      if (!this._irUsedOnce) {
        this._irUsedOnce = true;
        this.ui.fact('THERMAL EYE',
          'Decomposing fat runs warm — sewer crews find fatbergs by their heat. Ghosts, of course, run cold.',
          '🌡️');
      }
      this.ui.announce('Thermal view on. Warm things glow; the water goes dark.');
    } else {
      this._irRestore(this.scene);
      this.whale.material.color.set(0xc8f0ff);
      this.ui.toast('▢ THERMAL OFF', 'hint');
      this.ui.announce('Thermal view off.');
    }
  }

  // ------------------------------------------------------------- actions
  _doPing() {
    if (this.over || this._pingCooldown > 0) return;
    this._pingCooldown = 0.9;
    this._pingAge = 0;
    this.fx?.pingPulse();          // the plankton answer the sonar
    this.pingRing.visible = true;
    this.pingRing.position.copy(this.pos);
    this.ui.audio?.ping();

    // reveal glints on everything interesting within range
    const R = 55;
    const glintAt = (v, color) => {
      const p = makeParticleCloud(6, color, 1.6, 2.5);
      p.position.copy(v); p.position.y += 1.5;
      p.userData.age = 0;
      this.scene.add(p);
      this.glints.push(p);
    };
    for (const s of this.salvage) {
      if (!s.collected && !s.hidden && s.mesh.position.distanceTo(this.pos) < R) {
        glintAt(s.mesh.position, P8.yellow);
      }
    }
    for (const q of this.quest) {
      if (!q.taken && q.mesh.position.distanceTo(this.pos) < R) glintAt(q.mesh.position, P8.pink);
    }
    // stun close eels
    for (const e of this.eels) {
      if (e.pos.distanceTo(this.pos) < 10) {
        e.stun = 3;
        this.ui.audio?.growl();
      }
    }
    // detonate mines at a safe distance (the fun trick)
    for (const m of this.mines) {
      if (!m.live) continue;
      const d = m.mesh.position.distanceTo(this.pos);
      if (d > 7 && d < 18) {
        this._detonate(m, false);
        this.score += 15;
        this.ui.toast('+15 MINE CLEARED', 'good');
        this.ui.announce('Mine safely detonated by sonar');
      }
    }
  }

  _detonate(m, harmful) {
    m.live = false;
    this.scene.remove(m.mesh); this.scene.remove(m.cable);
    const burst = makeParticleCloud(40, P8.orange, 1.4, 8);
    burst.position.copy(m.mesh.position);
    burst.userData.age = 0;
    this.scene.add(burst);
    this.glints.push(burst);
    this.ui.audio?.boom();
    if (harmful) this._damage(2, 'The mine goes off — the hull rings like a bell');
  }

  _damage(n, why) {
    if (this.over) return;
    this.hull -= n;
    this.ui.audio?.hurt();
    this.ui.toast('💥 HULL ' + '▮'.repeat(Math.max(0, this.hull)) + '▯'.repeat(Math.max(0, HULL_MAX - this.hull)), 'bad');
    if (why) this.ui.announce(why);
    // knockback
    this.vel.add(new THREE.Vector3(Math.random() - 0.5, 0.4, Math.random() - 0.5).multiplyScalar(8));
    if (this.hull <= 0) this._lose('The old sub gives out at last. You bob to the surface clinging to a barrel.');
  }

  _collect(s) {
    s.collected = true;
    this.scene.remove(s.mesh);
    this.cargo.push({ type: s.type, value: s.value });
    this.ui.audio?.pickup(s.value);
    const f = FACTS[s.type];
    this.ui.toast(`${f.icon} ${f.name.toUpperCase()} +${s.value}`, 'good');
    if (!this.codex.has(s.type)) {
      this.codex.add(s.type);
      this._factQueue.push(s.type);
    }
    if (s.type === 'captains_chest') {
      this.hasChest = true;
      this.ui.toast('🏴‍☠️ THE CAPTAIN’S CHEST! BANK IT AT THE BELL!', 'gold');
      this.ui.announce('You have the captain’s chest. Take it to the diving bell.');
    }
    this.ui.announce(`Collected ${f.name}`);
  }

  _takeQuest(q) {
    q.taken = true;
    this.scene.remove(q.mesh);
    const info = QUEST_ITEMS[q.id];
    this.items.add(q.id);
    this.ui.audio?.pickup(30);
    this.ui.toast(`${info.icon} ${info.name.toUpperCase()}`, 'good');
    this.ui.announce(`Found ${info.name}`);
    // adventure-style auto-crafting when both halves are aboard
    const other = info.pairsWith;
    if (this.items.has(other) && !this.tools.has(info.makes)) {
      this.tools.add(info.makes);
      const tool = TOOLS[info.makes];
      this.ui.audio?.craft();
      this.ui.fact(`CRAFTED: ${tool.name}`, tool.text, tool.icon);
      this.ui.announce(`Crafted ${tool.name}`);
      if (info.makes === 'arclamp') this.headlamp.intensity = 300;
    }
  }

  _bank() {
    if (!this.cargo.length) { this.air = AIR_MAX; return; }
    const n = this.cargo.length;
    const base = this.cargo.reduce((a, c) => a + c.value, 0);
    const mult = 1 + 0.15 * (n - 1);
    const gained = Math.round(base * mult);
    this.score += gained;
    this.bankedValue += gained;
    for (const c of this.cargo) this.bankedTypes.add(c.type);
    const hadChest = this.cargo.some(c => c.type === 'captains_chest');
    this.cargo = [];
    this.air = AIR_MAX;
    this.banks++;
    this.ui.audio?.bank(n);
    this.ui.toast(`🎉 BANKED ×${n}  +${gained}${mult > 1 ? `  (×${mult.toFixed(2)} haul bonus!)` : ''}`, 'gold');
    this.ui.announce(`Banked ${n} items for ${gained} points. Air refilled.`);
    if (hadChest) { this._win(); return; }
    // confetti — a banked haul is a little party
    this.fx.confetti(this.scene, this.pos.clone());
    // banking stirs the dock: more eels, and eventually the fatbergs move
    if (this.banks === 1) this.ui.hint(HINTS[2]);
    if (this.banks === 2 && !this.duck && !this._duckDone) this._spawnDuck();
    if (this.eels.length < 7) this._spawnEels(1);
    if (this.banks >= 2) this._spawnRampantFatberg();
    // the whale comes when the dock has given up enough of its past
    if (!this.whaleActive && (this.bankedTypes.size >= 6 || this.bankedValue >= 320)) {
      this._wakeWhale();
    }
  }

  _wakeWhale() {
    this.whaleActive = true;
    this.whale.visible = true;
    this.whale.position.set(-60, -18, -20);
    this.chest.hidden = false;
    this.chest.mesh.visible = true;
    this.ui.audio?.whaleSong();
    this.ui.fact('THE GHOST OF THE DOCK',
      'A pale shape hangs in the water — the ghost of a whale that once swam up the Thames. She turns east, slowly, as if to say: follow.',
      '🐋');
    this.ui.announce('A ghost whale has appeared. Follow her east into the deep.');
  }

  _win() {
    this.won = true;
    this.over = true;
    this.ui.audio?.victory();
    const bonus = 100;
    this.score += bonus;
    this.ui.announce('You raised the captain’s chest. Victory.');
    setTimeout(() => {
      this.ui.complete({
        success: true,
        score: this.score,
        stats: {
          artifacts: this.bankedTypes.size,
          codex: this.codex.size,
          tools: this.tools.size,
        },
      });
    }, 2600);
  }

  _lose(text) {
    this.over = true;
    this.ui.announce(text);
    setTimeout(() => {
      this.ui.complete({ success: false, score: this.score, stats: {
        artifacts: this.bankedTypes.size, codex: this.codex.size, tools: this.tools.size,
      } });
    }, 2200);
  }

  // ------------------------------------------------------------- stepping
  step(dt) {
    this.elapsed += dt;
    const k = this.keys;

    // -------- the helm: she sails herself unless the captain takes her
    this._autoThrust = false;
    this._autoFizz = false;
    this._helmActive = false;
    const manual = this.elapsed < this.manualUntil;
    if (this.autopilot && !manual && !this.over) this._helm(dt);
    this._helmWasActive = this._helmActive;

    // -------- steering: yaw/pitch on the pad, thrust on A
    const turn = 1.9 * dt, pitchRate = 1.4 * dt;
    if (k.left) this.yaw += turn;
    if (k.right) this.yaw -= turn;
    if (k.up) this.pitch = Math.min(0.9, this.pitch + pitchRate);
    if (k.down) this.pitch = Math.max(-0.9, this.pitch - pitchRate);
    if (!k.up && !k.down && !this._helmActive) this.pitch *= Math.pow(0.2, dt);

    const fwd = new THREE.Vector3(
      Math.cos(this.pitch) * Math.cos(this.yaw),
      Math.sin(this.pitch),
      -Math.cos(this.pitch) * Math.sin(this.yaw));
    const thrusting = k.a || this._autoThrust;
    const thrust = thrusting ? 26 : 7;   // always some way on
    this.vel.addScaledVector(fwd, thrust * dt);
    this.vel.multiplyScalar(Math.pow(0.14, dt));            // water drag
    this.vel.y += Math.sin(this.elapsed * 0.8) * 0.06 * dt; // gentle swell
    currentAt(this.pos, this.elapsed, _cur);                 // the gyre tugs
    this.vel.addScaledVector(_cur, 0.35 * dt);
    this.pos.addScaledVector(this.vel, dt);

    // -------- containment: walls, floor, surface
    this.pos.x = Math.max(BOUNDS.minX + 2, Math.min(BOUNDS.maxX - 2, this.pos.x));
    this.pos.z = Math.max(BOUNDS.minZ + 2, Math.min(BOUNDS.maxZ - 2, this.pos.z));
    const fy = floorYAt(this.pos.x, this.pos.z) + 1.4;
    if (this.pos.y < fy) { this.pos.y = fy; this.vel.y = Math.abs(this.vel.y) * 0.3; }
    if (this.pos.y > BOUNDS.surface) { this.pos.y = BOUNDS.surface; this.vel.y = -Math.abs(this.vel.y) * 0.3; }
    for (const c of this.dock.colliders) {
      const d = this.pos.distanceTo(c);
      if (d < c.r) {
        const push = new THREE.Vector3().subVectors(this.pos, c).normalize();
        this.pos.copy(new THREE.Vector3(c.x, c.y, c.z).addScaledVector(push, c.r));
        this.vel.multiplyScalar(0.5);
      }
    }

    // -------- pose the sub + camera (quaternion compose — see top note)
    this.sub.position.copy(this.pos);
    const rollTarget = (k.left ? 0.25 : 0) - (k.right ? 0.25 : 0) + (this._helmTurn || 0) * 0.45;
    this._smRoll += (rollTarget - this._smRoll) * Math.min(1, 6 * dt);
    _qYaw.setFromAxisAngle(Y_AXIS, this.yaw);
    _qPitch.setFromAxisAngle(Z_AXIS, this.pitch * 0.7);
    _qRoll.setFromAxisAngle(X_AXIS, this._smRoll);
    this.sub.quaternion.copy(_qYaw).multiply(_qPitch).multiply(_qRoll);
    const ud = this.sub.userData;
    ud.prop.rotation.x += dt * (thrusting ? 24 : 6);
    ud.prop2.rotation.x -= dt * (thrusting ? 24 : 6);      // counter-rotating
    ud.planes.rotation.z += (-this.pitch * 0.55 - ud.planes.rotation.z) * 0.2;
    ud.forePlanes.rotation.z += (-this.pitch * 0.8 - ud.forePlanes.rotation.z) * 0.2;
    const helmOrder = (k.left ? 0.45 : 0) - (k.right ? 0.45 : 0) + (this._helmTurn || 0);
    ud.rudder.rotation.y += (helmOrder - ud.rudder.rotation.y) * 0.18;
    ud.beacon.visible = Math.sin(this.elapsed * 4.5) > -0.35;   // masthead blink

    const camTarget = this.pos.clone().addScaledVector(fwd, -10).add(new THREE.Vector3(0, 3.5, 0));
    camTarget.y = Math.min(camTarget.y, BOUNDS.surface + 1);
    this.camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
    // the gaze is smoothed too: a lookAt chasing a jittery forward
    // vector is half of any "camera snapping" complaint
    const lookTarget = this.pos.clone().addScaledVector(fwd, 6);
    this._camLook = this._camLook || lookTarget.clone();
    this._camLook.lerp(lookTarget, 1 - Math.pow(0.004, dt));
    this.camera.lookAt(this._camLook);

    // -------- fog and light by depth (the deep is DARK without the lamp)
    const depth = -this.pos.y;
    if (this.ir) {
      // heat sees through the murk: near-black, unusually clear
      this.scene.fog.color.set(0x000308);
      this.scene.background.set(0x000308);
      this.scene.fog.density = 0.011;
    } else {
      const deepT = Math.min(1, Math.max(0, (depth - 25) / 40));
      const fogC = new THREE.Color(P8.navy)
        .lerp(new THREE.Color(P8.blue), 0.30 * (1 - deepT))   // cheery shallows
        .lerp(new THREE.Color(P8.black), deepT * 0.85);
      this.scene.fog.color.copy(fogC);
      this.scene.background.copy(fogC);
      const lampBoost = this.tools.has('arclamp') ? 0.45 : 1;
      this.scene.fog.density = (0.016 + deepT * 0.03 * lampBoost);
    }
    if (!this.tools.has('arclamp')) this.headlamp.intensity = 40;
    this.lightCone.material.opacity = this.ir ? 0
      : (this.tools.has('arclamp') ? 0.13 : 0.06);
    this._deepT = this.ir ? 0 : Math.min(1, Math.max(0, (depth - 25) / 40));

    // shader clocks: the caustic webs and the living surface
    const floorShader = this.dock.floor.material.userData.shader;
    if (floorShader) floorShader.uniforms.uTime.value = this.elapsed;
    const surf = this.dock.surface.material;
    if (surf.uniforms) {
      surf.uniforms.uTime.value = this.elapsed;
      surf.uniforms.uCam.value.copy(this.camera.position);
    }

    // -------- the living water
    const threats = [this.pos, ...this.eels.map(e => e.pos)];
    const hot = this.ir
      ? [...this.fatbergs.map(f => f.mesh.position), this.pos]
      : [];
    this.fx.step(dt, this.elapsed, this.pos, threats, -this.camera.position.y, hot);

    // -------- air + hull economy
    this.air -= dt * (thrusting ? 1.7 : 1.1) * (1 + this.banks * 0.06);
    if (this.air < 25 && !this._lowAirWarned) {
      this._lowAirWarned = true;
      this.ui.audio?.alarm();
      this.ui.toast('⚠ AIR LOW — BACK TO THE BELL', 'warn');
      this.ui.announce('Air is low. Return to the diving bell.');
    }
    if (this.air >= 25) this._lowAirWarned = false;
    if (this.air <= 0) {
      this.air = 0;
      this._drownT = (this._drownT || 0) + dt;
      if (this._drownT > 1) { this._drownT = 0; this._damage(1, 'No air — the crew is fading'); }
    }

    // -------- the bell: bank + breathe
    const bellPos = this.dock.bell.position;
    if (this.pos.distanceTo(bellPos) < 9) {
      if (this.air < AIR_MAX - 1 || this.cargo.length) this._bank();
      this.air = Math.min(AIR_MAX, this.air + dt * 40);
    }
    this.dock.bell.userData.ring.rotation.z += dt * 0.8;

    // -------- pickups (auto-collect on touch: the tight loop)
    for (const s of this.salvage) {
      if (s.collected || s.hidden) continue;
      const d = s.mesh.position.distanceTo(this.pos);
      if (d < 3.2) {
        if (s.heavy && !this.tools.has('grapple')) {
          if (!s._nagged || this.elapsed - s._nagged > 6) {
            s._nagged = this.elapsed;
            this.ui.toast('TOO HEAVY — NEEDS A GRAPPLE', 'warn');
            this.ui.announce('Too heavy to lift. You need a grapple.');
          }
        } else this._collect(s);
      } else if (d < 20) {
        s.mesh.rotation.y += dt * 1.5;   // shimmy when you're close
      }
    }
    for (const q of this.quest) {
      if (!q.taken && q.mesh.position.distanceTo(this.pos) < 3.2) this._takeQuest(q);
      if (!q.taken) q.mesh.userData.spin.rotation.y += dt * 2;
    }

    this._stepEels(dt);
    this._stepFatbergs(dt);
    this._stepMines(dt);
    this._stepWhale(dt);
    this._maybeSeal(dt);
    this._stepDuck(dt);
    this._stepParticles(dt);
    this.fx.stepExtras(this.scene, dt);

    // -------- timers, hints, facts
    if (this._pingCooldown > 0) this._pingCooldown -= dt;
    if (this._factQueue.length && !this._factShowing) {
      const type = this._factQueue.shift();
      const f = FACTS[type];
      this._factShowing = true;
      this.ui.fact(f.name.toUpperCase(), f.text, f.icon);
      setTimeout(() => { this._factShowing = false; }, 9500);
    }
    this._hintTimer -= dt;
    if (this._hintTimer < 0) {
      this._hintTimer = 45;
      this.ui.hint(HINTS[this._hintIdx % HINTS.length]);
      this._hintIdx++;
    }

    this.ui.hud(this.hudState());
  }

  // The objective: one line, always on screen, with a live arrow. The
  // player should never wonder what to do next or which way to swim.
  _objective() {
    if (this.over) return null;
    const bell = this.dock.bell.position;
    const nearest = (list) => {
      let best = null, bd = 1e9;
      for (const it of list) {
        const d = it.mesh.position.distanceTo(this.pos);
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    };
    const carryingChest = this.hasChest || this.cargo.some(c => c.type === 'captains_chest');
    if (carryingChest) return { icon: '🏴‍☠️', text: 'Bank the chest at the bell!', target: bell };
    if (this.air < 30) return { icon: '💨', text: 'Air low — swim to the bell!', target: bell };
    if (this.whaleActive) {
      if (!this.tools.has('grapple')) {
        const part = nearest(this.quest.filter(q => !q.taken && (q.id === 'magnet' || q.id === 'rope')));
        if (part) return { icon: '🪝', text: 'Craft a grapple: find magnet + rope', target: part.mesh.position };
      }
      return { icon: '🐋', text: 'Follow the whale to the chest!', target: this.chest.mesh.position };
    }
    if (this.cargo.length >= 4) return { icon: '⬆', text: `Great haul! Bank ${this.cargo.length} finds at the bell`, target: bell };
    if (this.banks === 0 && this.cargo.length >= 3) return { icon: '🔔', text: 'Nice! Now bank them at the glowing bell', target: bell };
    if (this.tools.has('fizzlance')) {
      const berg = this.fatbergs.find(f => f.blocking);
      if (berg) return { icon: '🫧', text: 'Hold B by a fatberg to fizz it away', target: berg.mesh.position };
    }
    const grabbable = this.salvage.filter(s => !s.collected && !s.hidden && (!s.heavy || this.tools.has('grapple')));
    const s = nearest(grabbable);
    if (this.banks === 0) {
      return { icon: '✨', text: `Grab ${Math.max(0, 3 - this.cargo.length)} more shiny finds — press B to ping!`, target: s?.mesh.position ?? bell };
    }
    const gear = nearest(this.quest.filter(q => !q.taken));
    if (gear && (!s || gear.mesh.position.distanceTo(this.pos) < s.mesh.position.distanceTo(this.pos))) {
      return { icon: '💗', text: 'Pink glow = gear! Collect it to craft tools', target: gear.mesh.position };
    }
    return { icon: '✨', text: 'Ping (B) and gather salvage', target: s?.mesh.position ?? bell };
  }

  hudState() {
    const obj = this._objective();
    let objOut = null;
    if (obj && obj.target) {
      const dx = obj.target.x - this.pos.x, dz = obj.target.z - this.pos.z;
      let rel = Math.atan2(-dz, dx) - this.yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      objOut = {
        icon: obj.icon, text: obj.text,
        dist: Math.round(Math.hypot(dx, dz)),
        deg: Math.round(-rel * 180 / Math.PI),
      };
    }
    return {
      obj: objOut,
      air: this.air / AIR_MAX, hull: this.hull, hullMax: HULL_MAX,
      score: this.score, cargo: this.cargo.length,
      cargoValue: this.cargo.reduce((a, c) => a + c.value, 0),
      depth: Math.round(-this.pos.y),
      items: [...this.items].filter(i => !this.tools.has(QUEST_ITEMS[i].makes)),
      tools: [...this.tools],
      codex: this.codex.size, codexTotal: Object.keys(FACTS).length,
      whale: this.whaleActive, chest: this.hasChest, over: this.over, won: this.won,
      ir: this.ir, auto: this.autopilot,
    };
  }

  _stepEels(dt) {
    for (const e of this.eels) {
      if (e.stun > 0) { e.stun -= dt; e.head.rotation.z = Math.sin(this.elapsed * 20) * 0.3; }
      else {
        const toPlayer = this.pos.distanceTo(e.pos);
        const speedUp = 1 + this.banks * 0.12;
        if (toPlayer < 22) {
          // chase — sharp teeth first
          const dir = new THREE.Vector3().subVectors(this.pos, e.pos).normalize();
          e.pos.addScaledVector(dir, e.speed * 1.25 * speedUp * dt);
        } else {
          // patrol a lazy circle
          e.angle += dt * 0.5;
          const target = new THREE.Vector3(
            e.center.x + Math.cos(e.angle) * e.radius,
            floorYAt(e.center.x, e.center.z) + 8 + Math.sin(e.angle * 2.3) * 4,
            e.center.z + Math.sin(e.angle) * e.radius);
          e.pos.lerp(target, 1 - Math.pow(0.3, dt));
        }
        if (e.bite > 0) e.bite -= dt;
        if (toPlayer < 2.6 && e.bite <= 0) {
          e.bite = 1.6;
          this.ui.audio?.growl();
          this._damage(1, 'An eel gets its teeth into the hull');
        }
      }
      // pose: head faces travel, segments follow like a chain
      e.head.position.copy(e.pos);
      const ahead = e.segs[0].position.distanceTo(e.pos) > 0.01
        ? new THREE.Vector3().subVectors(e.pos, e.segs[0].position).normalize()
        : new THREE.Vector3(1, 0, 0);
      e.head.lookAt(e.pos.clone().add(ahead));
      e.head.rotateY(-Math.PI / 2);
      let prev = e.pos;
      for (let i = 0; i < e.segs.length; i++) {
        const s = e.segs[i];
        const want = prev.clone().addScaledVector(
          new THREE.Vector3().subVectors(s.position, prev).normalize(), 1.05);
        want.y += Math.sin(this.elapsed * 6 + i) * 0.08;
        s.position.lerp(want, 1 - Math.pow(0.0005, dt));
        s.lookAt(prev);
        prev = s.position;
      }
    }
  }

  _stepFatbergs(dt) {
    const lanceOn = this.tools.has('fizzlance') && (this.keys.b || this._autoFizz);
    let fizzing = false;
    for (let i = this.fatbergs.length - 1; i >= 0; i--) {
      const f = this.fatbergs[i];
      f.wobble += dt;
      f.mesh.rotation.y += dt * 0.1;
      f.mesh.position.y += Math.sin(f.wobble) * 0.01;
      if (!f.blocking) {
        // rampant: drift about the basin, faintly menacing
        f.vel.y = Math.sin(f.wobble * 0.7) * 0.4;
        f.mesh.position.addScaledVector(f.vel, dt);
        const m = f.mesh.position;
        if (m.x < BOUNDS.minX + 5 || m.x > BOUNDS.maxX - 5) f.vel.x *= -1;
        if (m.z < BOUNDS.minZ + 5 || m.z > BOUNDS.maxZ - 5) f.vel.z *= -1;
        m.y = Math.max(floorYAt(m.x, m.z) + f.r * 0.7, Math.min(-6, m.y));
      }
      const d = f.mesh.position.distanceTo(this.pos);
      // touching a fatberg is bad for everyone
      if (d < f.r + 1.2) {
        this.vel.multiplyScalar(Math.pow(0.02, dt));   // horribly sticky
        if (!f._hurtT || this.elapsed - f._hurtT > 2) {
          f._hurtT = this.elapsed;
          this._damage(1, 'The fatberg smears across the viewport. Ugh.');
        }
      }
      // the fizz lance: hold B nearby to dissolve
      if (lanceOn && d < f.r + 6) {
        fizzing = true;
        f.hp -= dt;
        f.mesh.scale.setScalar(Math.max(0.4, f.hp / 3));
        if (Math.random() < dt * 8) this.ui.audio?.bubble();
        if (f.hp <= 0) {
          const at = f.mesh.position.clone();
          this.scene.remove(f.mesh);
          this.fatbergs.splice(i, 1);
          const burst = makeParticleCloud(60, P8.peach, 1.2, 10);
          burst.position.copy(at); burst.userData.age = 0;
          this.scene.add(burst); this.glints.push(burst);
          this.score += 25;
          this.ui.toast('+25 FATBERG DISSOLVED', 'gold');
          if (f.blocking) {
            this.ui.announce('The culvert is clear. Something glitters inside.');
            // a fatberg always keeps a souvenir
            const s = this.salvage.find(x => x.type === 'fatberg_relic' && x.collected === false && x.hidden);
            if (s) { s.hidden = false; s.mesh.visible = true; s.mesh.position.copy(at); }
            else {
              const g = makeSalvageMesh('fatberg_relic');
              g.position.copy(at);
              this.scene.add(g);
              this.salvage.push({ type: 'fatberg_relic', mesh: g, collected: false,
                heavy: false, hidden: false, value: FACTS.fatberg_relic.value });
            }
          } else this.ui.announce('Rampant fatberg dissolved.');
        }
      }
    }
    this.ui.audio?.fizz(fizzing);
  }

  _stepMines(dt) {
    for (const m of this.mines) {
      if (!m.live) continue;
      m.mesh.rotation.y += dt * 0.4;
      const d = m.mesh.position.distanceTo(this.pos);
      const blink = m.mesh.userData.blink;
      if (blink) {
        blink.material.opacity = 0.2 +
          0.5 * Math.abs(Math.sin(this.elapsed * (d < 8 ? 7 : 1.6)));
      }
      if (d < 3.2) this._detonate(m, true);
      else if (d < 8) {
        m.beep -= dt;
        if (m.beep <= 0) { m.beep = Math.max(0.15, d / 10); this.ui.audio?.alarm(); }
      }
    }
  }

  _stepWhale(dt) {
    if (!this.whaleActive || this.over) return;
    this.whalePhase += dt;
    const chestPos = this.chest.mesh.position;
    // she swims a slow bee-line for the chest, loops there, sings
    const target = this.hasChest
      ? new THREE.Vector3(-80, -20, 0)               // then home toward the bell
      : chestPos.clone().add(new THREE.Vector3(
        Math.cos(this.whalePhase * 0.3) * 16, 10 + Math.sin(this.whalePhase * 0.5) * 3,
        Math.sin(this.whalePhase * 0.3) * 16));
    const dir = new THREE.Vector3().subVectors(target, this.whale.position);
    const dist = dir.length();
    if (dist > 1) this.whale.position.addScaledVector(dir.normalize(), Math.min(6, dist) * dt * 0.9);
    this.whale.lookAt(target);
    this.whale.rotateY(-Math.PI / 2);
    // fade in, breathe (in thermal sight she is a steady cold presence)
    const m = this.whale.material;
    const ceiling = this.ir ? 0.95 : 0.75;
    m.opacity = Math.min(ceiling, m.opacity + dt * 0.2) * (0.8 + Math.sin(this.whalePhase * 1.3) * 0.2);
    // tail swish: displace the base positions a little
    const pos = this.whale.geometry.attributes.position, base = this.whale.userData.base;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], bz = base[i * 3 + 2];
      pos.setZ(i, bz + Math.sin(this.whalePhase * 2 + bx * 0.4) * (bx < -6 ? 0.8 : 0.15));
    }
    pos.needsUpdate = true;
    this._whaleSongT -= dt;
    if (this._whaleSongT < 0 && this.whale.position.distanceTo(this.pos) < 45) {
      this._whaleSongT = 9;
      this.ui.audio?.whaleSong();
    }
  }

  // ---------------------------------------------------------- visitors
  // A curious Thames seal: swims in, loops the sub barking hello, and
  // slips away. Pure delight, zero threat — and a true codex entry.
  _maybeSeal(dt) {
    if (!this.seal && !this.over && this.elapsed > this._sealAt) this._spawnSeal();
    if (this.seal) this._stepSeal(dt);
  }

  _spawnSeal() {
    const m = makeSeal();
    tint(m, 0xff77a8, 0.4);
    m.userData.irColor = 0xdd8855;             // warm-blooded, unlike the eels
    m.position.copy(this.pos).add(new THREE.Vector3(35, 6, 20));
    m.position.y = Math.min(-4, Math.max(floorYAt(m.position.x, m.position.z) + 3, m.position.y));
    this.scene.add(m);
    if (this.ir) this._irApply(m);
    this.seal = { mesh: m, state: 'approach', phase: 0, barks: 0 };
    this.ui.audio?.sealBark();
    this.ui.toast('🦭 A curious seal is coming to say hello!', 'good');
    this.ui.announce('A curious seal approaches.');
    if (!this.codex.has('seal_visit')) {
      this.codex.add('seal_visit');
      this._factQueue.push('seal_visit');
    }
  }

  _stepSeal(dt) {
    const s = this.seal, m = s.mesh;
    let target;
    if (s.state === 'approach') {
      target = this.pos.clone().add(new THREE.Vector3(0, 2, 0));
      if (m.position.distanceTo(this.pos) < 8) { s.state = 'orbit'; s.phase = 0; }
    } else if (s.state === 'orbit') {
      s.phase += dt * 1.5;
      target = this.pos.clone().add(new THREE.Vector3(
        Math.cos(s.phase) * 5.5, 1.5 + Math.sin(s.phase * 2) * 1.2, Math.sin(s.phase) * 5.5));
      if (Math.floor(s.phase / 2.5) > s.barks) {
        s.barks++;
        this.ui.audio?.sealBark();
      }
      if (s.phase > Math.PI * 4.5) {
        s.state = 'depart';
        s.exit = this.pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 160, 8, (Math.random() - 0.5) * 120));
      }
    } else {
      target = s.exit;
      if (m.position.distanceTo(this.pos) > 60) {
        this.scene.remove(m);
        this.seal = null;
        this._sealAt = this.elapsed + 110 + Math.random() * 60;
        return;
      }
    }
    const dir = new THREE.Vector3().subVectors(target, m.position);
    const d = dir.length();
    if (d > 0.5) m.position.addScaledVector(dir.normalize(), Math.min(11, d * 2.2) * dt);
    m.lookAt(m.position.clone().add(dir));
    m.rotateY(-Math.PI / 2);
    m.userData.tail.rotation.z = Math.sin(this.elapsed * 7) * 0.35;
  }

  // The Glitch Canary: paddling at the surface near the bell after your
  // second banking. Nose up to it for a honk, confetti and +100.
  _spawnDuck() {
    const m = makeDuck();
    tint(m, 0xffec27, 0.6);
    m.userData.irColor = 0xffee88;
    const halo = glowSprite(0xffec27, 5, 0.5);
    halo.userData.irHot = true;
    m.add(halo);
    const b = this.dock.bell.position;
    m.position.set(b.x + 7, BOUNDS.surface - 0.2, b.z + 5);
    this.scene.add(m);
    if (this.ir) this._irApply(m);
    this.duck = m;
    this.ui.toast('…did something just splash, up by the bell?', 'hint');
  }

  _stepDuck(dt) {
    if (!this.duck) return;
    const m = this.duck;
    m.position.y = BOUNDS.surface - 0.2 + Math.sin(this.elapsed * 2.2) * 0.18;
    m.rotation.y += dt * 0.6;
    if (m.position.distanceTo(this.pos) < 4.5) {
      this._duckDone = true;
      this.score += 100;
      this.ui.audio?.honk();
      this.fx.confetti(this.scene, m.position.clone());
      this.ui.fact('THE GLITCH CANARY',
        '🐥 Patron bird of the whole arcade, paddling a long way from home. It approves of your seamanship. +100!',
        '🐥');
      this.ui.announce('The Glitch Canary honks its approval. One hundred points.');
      this.scene.remove(m);
      this.duck = null;
    }
  }

  _stepParticles(dt) {
    // marine snow drifts down and wraps
    this.snow.material.opacity = this.ir ? 0.12 : 0.8;
    const sp = this.snow.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * 1.1;
      if (y < -60) y = 30;
      sp.setY(i, y);
    }
    sp.needsUpdate = true;
    // thrust bubbles
    this._bubbleT -= dt;
    if ((this.keys.a || this._autoThrust) && this._bubbleT < 0 && !this.over) {
      this._bubbleT = 0.1;
      if (Math.random() < 0.25) this.ui.audio?.bubble();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), mat(P8.white));
      b.position.copy(this.pos).add(new THREE.Vector3(
        -Math.cos(this.yaw) * 2.5, 0, Math.sin(this.yaw) * 2.5));
      this.scene.add(b);
      this.bubbles.push({ mesh: b, age: 0 });
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.mesh.position.y += dt * (3 + b.age);
      b.mesh.position.x += Math.sin(b.age * 7) * dt;
      if (b.age > 2.5 || b.mesh.position.y > BOUNDS.surface) {
        this.scene.remove(b.mesh); this.bubbles.splice(i, 1);
      }
    }
    // sonar ring expands and dies
    if (this.pingRing.visible) {
      this._pingAge += dt;
      const r = 1 + this._pingAge * 34;
      this.pingRing.scale.setScalar(r);
      this.pingRing.lookAt(this.camera.position);
      this.pingRing.material.opacity = Math.max(0, 0.9 - this._pingAge * 0.6);
      if (this._pingAge > 1.6) this.pingRing.visible = false;
    }
    // glints sparkle then fade
    for (let i = this.glints.length - 1; i >= 0; i--) {
      const g = this.glints[i];
      g.userData.age += dt;
      g.rotation.y += dt * 2;
      g.material.opacity = Math.max(0, 0.9 - g.userData.age * 0.22);
      if (g.userData.age > 4.2) { this.scene.remove(g); this.glints.splice(i, 1); }
    }
    // weeds wave
    for (const w of this.dock.weeds) {
      w.rotation.x = Math.sin(this.elapsed * 0.7 + w.userData.phase) * 0.12;
    }
  }

  // ------------------------------------------------------------- loop
  render() {
    if (this.post) {
      const camDepth = -this.camera.position.y;
      const rayAmt = Math.max(0, Math.min(1, 1 - (camDepth - 10) / 34));
      this.post.render(this.elapsed, this._sunDir,
        { deep: this._deepT || 0, ir: this.ir, rayAmt });
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _frame(t) {
    this._raf = requestAnimationFrame(this._boundFrame);
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0.016);
    this._last = t;
    if (!this.over) this.step(dt);
    else this.elapsed += dt;
    this.render();
  }

  start() {
    if (this._raf === null) {
      this._boundFrame = (t) => this._frame(t);
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._boundFrame);
    }
    this.running = true;
  }

  pause() { this.running = false; }
  resume() { this._last = performance.now(); this.running = true; }
  stop() { if (this._raf !== null) cancelAnimationFrame(this._raf); this._raf = null; this.running = false; }

  // ------------------------------------------------------------- persistence
  snapshot() {
    if (this.over) return null;   // a finished game should not be resumed
    return {
      pos: this.pos.toArray(), yaw: this.yaw, pitch: this.pitch,
      air: this.air, hull: this.hull, score: this.score,
      cargo: this.cargo, banks: this.banks,
      bankedTypes: [...this.bankedTypes], bankedValue: this.bankedValue,
      items: [...this.items], tools: [...this.tools], codex: [...this.codex],
      collected: this.salvage.map(s => s.collected),
      questTaken: this.quest.map(q => q.taken),
      whaleActive: this.whaleActive, hasChest: this.hasChest,
    };
  }

  restore(s) {
    if (!s || !s.pos) return;
    this.pos.fromArray(s.pos);
    this.yaw = s.yaw || 0; this.pitch = s.pitch || 0;
    this.air = s.air ?? AIR_MAX; this.hull = s.hull ?? HULL_MAX;
    this.score = s.score || 0;
    this.cargo = s.cargo || [];
    this.banks = s.banks || 0;
    this.bankedTypes = new Set(s.bankedTypes || []);
    this.bankedValue = s.bankedValue || 0;
    this.items = new Set(s.items || []);
    this.tools = new Set(s.tools || []);
    this.codex = new Set(s.codex || []);
    (s.collected || []).forEach((c, i) => {
      if (c && this.salvage[i] && !this.salvage[i].collected) {
        this.salvage[i].collected = true;
        this.scene.remove(this.salvage[i].mesh);
      }
    });
    (s.questTaken || []).forEach((t, i) => {
      if (t && this.quest[i] && !this.quest[i].taken) {
        this.quest[i].taken = true;
        this.items.add(this.quest[i].id);
        this.scene.remove(this.quest[i].mesh);
      }
    });
    if (this.tools.has('arclamp')) this.headlamp.intensity = 300;
    if (s.whaleActive) this._wakeWhale();
    this.hasChest = !!s.hasChest;
    this.ui.announce('Dive resumed where you left it.');
  }
}
