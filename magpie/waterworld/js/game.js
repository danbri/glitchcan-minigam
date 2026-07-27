// Waterworld — Docklands Deep. The simulation: one submarine, one drowned
// dock, eels, mines, fatbergs, a ghost whale, and a pirate chest.
//
// The loop is deliberately tight: ping → glint → grab → bank → breathe.
// Difficulty is "disturbance": every banking stirs the dock up a little.

import * as THREE from '../../../trees/vendor/three.module.min.js';
import {
  P8, mat, buildDock, makeSub, makeEelHead, makeEelSegment, makeFatberg,
  makeMine, makeSalvageMesh, makeQuestMesh, makeParticleCloud,
  makeGhostWhale, BOUNDS, SHELF_Y, DEEP_Y, floorYAt,
} from './world.js';
import { FACTS, QUEST_ITEMS, TOOLS, HINTS } from './facts.js';

const AIR_MAX = 100;
const HULL_MAX = 4;

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
  }

  // ------------------------------------------------------------- setup
  init() {
    const c = this.canvas;
    // ?probe keeps the buffer readable for headless pixel checks —
    // costs a copy per frame, so never on by default
    const probe = /[?&]probe\b/.test(location.search);
    this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: false,
      preserveDrawingBuffer: probe });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(P8.navy);
    this.scene.fog = new THREE.FogExp2(P8.navy, 0.02);
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400);

    // light through water: cool hemisphere + a weak sun shaft
    this.scene.add(new THREE.HemisphereLight(0x66aaff, 0x0a1030, 1.1));
    const sun = new THREE.DirectionalLight(0xaaddff, 0.9);
    sun.position.set(20, 80, 10);
    this.scene.add(sun);

    this.dock = buildDock(this.scene);

    this.sub = makeSub();
    this.sub.position.copy(this.pos);
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
    this.bubbles = [];
    this._bubbleT = 0;

    // sonar ring + glints
    this.pingRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 4, 24),
      mat(P8.blue, { emissive: 0x1155aa, transparent: true, opacity: 0.9 }));
    this.pingRing.visible = false;
    this.scene.add(this.pingRing);
    this._pingAge = 99;
    this.glints = [];

    this.resize();
    this.render();
  }

  resize() {
    const w = this.canvas.clientWidth || 480, h = this.canvas.clientHeight || 270;
    // picoCAD pixels: render tiny, stretch big. ~270 lines of height.
    const scale = Math.max(1, Math.floor(h / 270));
    this.renderer.setSize(Math.floor(w / scale), Math.floor(h / scale), false);
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
      const segs = [];
      for (let s = 0; s < 6; s++) {
        const m = makeEelSegment(s);
        this.scene.add(m);
        segs.push(m);
      }
      this.scene.add(head);
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
      f.position.set(mouth.x, mouth.y + 1, mouth.z + 2);
      this.scene.add(f);
      this.fatbergs.push({ mesh: f, hp: 3, r: 4.5, blocking: true,
        vel: new THREE.Vector3(), wobble: Math.random() * 9 });
    }
  }

  _spawnRampantFatberg() {
    const mouth = this.dock.culverts[Math.floor(Math.random() * this.dock.culverts.length)];
    const f = makeFatberg(2.6);
    f.position.set(mouth.x, mouth.y + 2, mouth.z + 6);
    this.scene.add(f);
    const away = new THREE.Vector3(Math.random() - 0.5, 0.1, 0.8).normalize().multiplyScalar(2.2);
    this.fatbergs.push({ mesh: f, hp: 2, r: 2.8, blocking: false, vel: away,
      wobble: Math.random() * 9 });
    this.ui.toast('⚠ A FATBERG HAS ESCAPED THE TUNNELS', 'warn');
    this.ui.announce('A fatberg has escaped the tunnels');
  }

  // ------------------------------------------------------------- input
  setKey(k, down) {
    if (k in this.keys) this.keys[k] = down;
    if (k === 'b' && down) this._doPing();
  }

  // ------------------------------------------------------------- actions
  _doPing() {
    if (this.over || this._pingCooldown > 0) return;
    this._pingCooldown = 0.9;
    this._pingAge = 0;
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
    this.ui.toast(`⬆ BANKED ×${n}  +${gained}${mult > 1 ? `  (×${mult.toFixed(2)})` : ''}`, 'gold');
    this.ui.announce(`Banked ${n} items for ${gained} points. Air refilled.`);
    if (hadChest) { this._win(); return; }
    // banking stirs the dock: more eels, and eventually the fatbergs move
    if (this.banks === 1) this.ui.hint(HINTS[2]);
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

    // -------- steering: yaw/pitch on the pad, thrust on A
    const turn = 1.9 * dt, pitchRate = 1.4 * dt;
    if (k.left) this.yaw += turn;
    if (k.right) this.yaw -= turn;
    if (k.up) this.pitch = Math.min(0.9, this.pitch + pitchRate);
    if (k.down) this.pitch = Math.max(-0.9, this.pitch - pitchRate);
    if (!k.up && !k.down) this.pitch *= Math.pow(0.2, dt);   // level out

    const fwd = new THREE.Vector3(
      Math.cos(this.pitch) * Math.cos(this.yaw),
      Math.sin(this.pitch),
      -Math.cos(this.pitch) * Math.sin(this.yaw));
    const thrust = k.a ? 26 : 7;   // always some way on; A is the engine
    this.vel.addScaledVector(fwd, thrust * dt);
    this.vel.multiplyScalar(Math.pow(0.14, dt));            // water drag
    this.vel.y += Math.sin(this.elapsed * 0.8) * 0.06 * dt; // gentle swell
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

    // -------- pose the sub + camera
    this.sub.position.copy(this.pos);
    const roll = (k.left ? 0.25 : 0) - (k.right ? 0.25 : 0);
    this.sub.rotation.set(0, this.yaw, 0);
    this.sub.rotateZ(this.pitch * 0.7);
    this.sub.rotation.x += (roll - this.sub.rotation.x) * 0.2;
    this.sub.userData.prop.rotation.x += dt * (k.a ? 22 : 6);

    const camTarget = this.pos.clone().addScaledVector(fwd, -10).add(new THREE.Vector3(0, 3.5, 0));
    camTarget.y = Math.min(camTarget.y, BOUNDS.surface + 1);
    this.camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.pos.clone().addScaledVector(fwd, 6));

    // -------- fog and light by depth (the deep is DARK without the lamp)
    const depth = -this.pos.y;
    const deepT = Math.min(1, Math.max(0, (depth - 25) / 40));
    const fogC = new THREE.Color(P8.navy).lerp(new THREE.Color(P8.black), deepT * 0.9);
    this.scene.fog.color.copy(fogC);
    this.scene.background.copy(fogC);
    const lampBoost = this.tools.has('arclamp') ? 0.45 : 1;
    this.scene.fog.density = (0.018 + deepT * 0.03 * lampBoost);
    if (!this.tools.has('arclamp')) this.headlamp.intensity = 40;

    // -------- air + hull economy
    this.air -= dt * (k.a ? 1.7 : 1.1) * (1 + this.banks * 0.06);
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
    this._stepParticles(dt);

    // -------- timers, hints, facts
    if (this._pingCooldown > 0) this._pingCooldown -= dt;
    if (this._factQueue.length && !this._factShowing) {
      const type = this._factQueue.shift();
      const f = FACTS[type];
      this._factShowing = true;
      this.ui.fact(f.name.toUpperCase(), f.text, f.icon);
      setTimeout(() => { this._factShowing = false; }, 5200);
    }
    this._hintTimer -= dt;
    if (this._hintTimer < 0) {
      this._hintTimer = 45;
      this.ui.hint(HINTS[this._hintIdx % HINTS.length]);
      this._hintIdx++;
    }

    this.ui.hud(this.hudState());
  }

  hudState() {
    return {
      air: this.air / AIR_MAX, hull: this.hull, hullMax: HULL_MAX,
      score: this.score, cargo: this.cargo.length,
      cargoValue: this.cargo.reduce((a, c) => a + c.value, 0),
      depth: Math.round(-this.pos.y),
      items: [...this.items].filter(i => !this.tools.has(QUEST_ITEMS[i].makes)),
      tools: [...this.tools],
      codex: this.codex.size, codexTotal: Object.keys(FACTS).length,
      whale: this.whaleActive, chest: this.hasChest, over: this.over, won: this.won,
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
    const lanceOn = this.tools.has('fizzlance') && this.keys.b;
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
    // fade in, breathe
    const m = this.whale.material;
    m.opacity = Math.min(0.75, m.opacity + dt * 0.2) * (0.8 + Math.sin(this.whalePhase * 1.3) * 0.2);
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

  _stepParticles(dt) {
    // marine snow drifts down and wraps
    const sp = this.snow.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * 1.1;
      if (y < -60) y = 30;
      sp.setY(i, y);
    }
    sp.needsUpdate = true;
    // thrust bubbles
    this._bubbleT -= dt;
    if (this.keys.a && this._bubbleT < 0 && !this.over) {
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
    this.renderer.render(this.scene, this.camera);
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
