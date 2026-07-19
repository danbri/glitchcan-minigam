// robbin-game.js — ROBBIN, an egg-and-ladders platformer SPA.
// Vector birds (see robbin-sprites.js), tile platforms + ladders, 12 eggs a
// level, grain the rival birds will happily eat, a countdown timer and — on
// level four — the dreaded lift. Keyboard + touch.

import { PALETTE, BIRDS, drawBird, drawGrain, drawBottle, drawCommuter, birdSVG } from './robbin-sprites.js';
import { Chiptune } from './robbin-music.js';
import { TubeFlock } from './robbin-tube.js';

export const TILE = 32, COLS = 20, ROWS = 15;
export const W = COLS * TILE, H = ROWS * TILE;
const HUD = 40;
const GRAV = 780, JUMP_V = 268, WALK_V = 112, CLIMB_V = 84;
const ENEMY_V = { bluetit: 56, blackbird: 66, wren: 82, commuter: 46 };
const BIRD_SIZE = { robin: 46, blackbird: 46, bluetit: 45, wren: 38 };
export const LIFT_V = 52;
const TIME_TICK = 0.2;           // seconds per timer unit
const EXTRA_LIFE_EVERY = 10000;

// ---------------------------------------------------------------- levels
// map legend: '#' platform · 'H' ladder · '+' platform pierced by ladder
// 'E' grain pile (treasure) · 'G' milk bottle (cream bonus) · 'P' player
// start · 'L' lift shaft · '.' air
// Items/spawns at row r stand on the platform in row r+1.
const LEVELS = [
  {
    name: 'THE GARDEN', time: 600,
    map: [
      '....................',
      '..E..............E..',
      '.##+#..........#+##.',
      '...H............H...',
      '.E.H............H.E.',
      '.###+##......##+###.',
      '....H..........H....',
      '..E.H...E.E....H.E..',
      '..####+######+####..',
      '......H......H......',
      'E....GH......H.G...E',
      '##+######..######+##',
      '..H..............H..',
      'P.H..G..EE..G....H..',
      '####################',
    ],
    enemies: [
      { t: 'bluetit', c: 15, floor: 8, d: -1 },
      { t: 'bluetit', c: 12, floor: 11, d: -1 },
      { t: 'bluetit', c: 10, floor: 14, d: 1 },
    ],
  },
  {
    name: 'THE ROOFTOPS', time: 650,
    map: [
      '....................',
      '....................',
      '.....E....E....E....',
      '...#+##########+#...',
      '....H..........H....',
      'E...H..........H...E',
      '##+###+#....#+###+##',
      '..H...H......H...H..',
      '..H...H.E..E.H...H..',
      '..H..#####+####..H..',
      '..H.......H......H..',
      '#+##....E.H.....##+#',
      '.H......#+##......H.',
      '.H..G..P.H.E...G.EH.',
      '####################',
    ],
    enemies: [
      { t: 'blackbird', c: 6, floor: 9, d: 1 },
      { t: 'blackbird', c: 14, floor: 3, d: -1 },
      { t: 'bluetit', c: 3, floor: 6, d: 1 },
    ],
  },
  {
    name: 'THE WREN HOUSE', time: 700,
    map: [
      '....................',
      '........E..E........',
      '.......###+##.......',
      '..........H.........',
      '..E......GH......E..',
      '..#+############+#..',
      '...H............H...',
      'E..H.E......E..GH..E',
      '#####+#..#####+#####',
      '.....H........H.....',
      '....GH..E...E.H.....',
      '..#+############+#..',
      '...H............H...',
      'P..H..E...G..E..H...',
      '####################',
    ],
    enemies: [
      { t: 'wren', c: 6, floor: 11, d: 1 },
      { t: 'wren', c: 17, floor: 8, d: -1 },
      { t: 'wren', c: 5, floor: 5, d: 1 },
      { t: 'blackbird', c: 12, floor: 14, d: -1 },
    ],
  },
  {
    name: 'THE LIFT', time: 750,
    map: [
      '....................',
      'E..E............E..E',
      '########.LL.######+#',
      '.........LL.......H.',
      'G....E...LL...E...H.',
      '#+######.LL.########',
      '.H.......LL.........',
      '.H.E.....LL.G...E...',
      '########.LL.######+#',
      '.........LL.......H.',
      '.....E...LL...E...H.',
      '#+######.LL.########',
      '.H.......LL.........',
      '.H..E..G.LL..P.E....',
      '####################',
    ],
    enemies: [
      { t: 'bluetit', c: 5, floor: 11, d: -1 },
      { t: 'blackbird', c: 14, floor: 8, d: 1 },
      { t: 'wren', c: 3, floor: 5, d: 1 },
      { t: 'blackbird', c: 16, floor: 2, d: -1 },
    ],
  },
];

// Stations on the Flight Line: each is a row of screens joined by edge
// tunnels (walk off the side of one screen into the next), loosely modelled
// on step-free navigation — tunnels along, lifts up. Grain is pooled per
// station; clear the lot to move down the line.
const STATIONS = [
  { name: 'GARDEN GREEN', time: 1000, screens: [LEVELS[0], LEVELS[1]] },
  { name: 'WRENWICH PARK', time: 1100, screens: [LEVELS[2], LEVELS[3]] },
];
for (const st of STATIONS) {
  st.hasLift = st.screens.some(s => s.map.some(row => row.includes('L')));
}

// ---------------------------------------------------------------- audio
class Foley {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  chirp(f0, f1, dur, type = 'sine', gain = 0.12, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  jump()  { this.chirp(300, 620, 0.14, 'triangle', 0.1); }
  whoosh(){ this.chirp(900, 220, 0.16, 'triangle', 0.08); }
  egg()   { this.chirp(880, 880, 0.06, 'sine', 0.12); this.chirp(1320, 1320, 0.09, 'sine', 0.12, 0.06); }
  grain() { this.chirp(220, 180, 0.1, 'triangle', 0.12); }
  cream() { // a creamy little glug-and-trill
    this.chirp(220, 320, 0.12, 'sine', 0.14);
    this.chirp(660, 990, 0.1, 'triangle', 0.1, 0.1);
    this.chirp(1320, 1760, 0.12, 'sine', 0.08, 0.18);
  }
  step()  { this.chirp(140, 120, 0.03, 'square', 0.02); }
  death() { this.chirp(500, 60, 0.7, 'sawtooth', 0.14); }
  tick()  { this.chirp(1600, 1600, 0.03, 'square', 0.05); }
  clear() { [523, 659, 784, 1047].forEach((f, i) => this.chirp(f, f, 0.12, 'triangle', 0.12, i * 0.1)); }
  start() { this.chirp(392, 784, 0.25, 'triangle', 0.12); }
}

// ---------------------------------------------------------------- level model
export class Level {
  constructor(def, loop) {
    this.def = def; this.loop = loop;
    this.speedMul = Math.pow(1.13, loop);
    this.time = Math.max(300, def.time - loop * 60);
    this.grid = def.map.map(row => row.split(''));
    if (this.grid.length !== ROWS || this.grid.some(r => r.length !== COLS)) {
      console.error(`ROBBIN level "${def.name}" map is ${this.grid.length} rows; expected ${ROWS}×${COLS}`);
    }
    this.treasure = new Map();   // "c,r" -> {c,r}: grain piles, all required
    this.bottles = new Map();    // "c,r" -> {c,r,cream}: milk bottle bonuses
    this.escCols = new Map();    // col -> -1 up / +1 down: escalator runs ('S')
    this.spawn = { x: TILE + 16, y: H - TILE };
    let liftCols = [];
    let liftTop = ROWS, liftBot = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.grid[r][c];
        if (ch === 'E') this.treasure.set(`${c},${r}`, { c, r });
        else if (ch === 'G') this.bottles.set(`${c},${r}`, { c, r, cream: true });
        else if (ch === 'P') this.spawn = { x: c * TILE + 16, y: (r + 1) * TILE };
        else if (ch === 'S') this.escCols.set(c, -1);   // escalators run up by default
        if (ch === 'L') { liftCols.push(c); liftTop = Math.min(liftTop, r); liftBot = Math.max(liftBot, r); }
      }
    }
    this.lift = null;
    if (liftCols.length) {
      const c0 = Math.min(...liftCols), c1 = Math.max(...liftCols);
      this.lift = {
        x0: c0 * TILE, x1: (c1 + 1) * TILE,
        topY: liftTop * TILE, botY: (liftBot + 1) * TILE,
        paddles: [{ y: (liftBot + 1) * TILE }, { y: (liftTop + liftBot + 1) * TILE / 2 }],
      };
    }
  }
  at(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return ' ';
    return this.grid[r][c];
  }
  solid(c, r)  { const ch = this.at(c, r); return ch === '#' || ch === '+'; }
  ladder(c, r) { const ch = this.at(c, r); return ch === 'H' || ch === '+' || ch === 'S'; }
  // vertical extent of the ladder run through (c, r): feet-y clamp range
  ladderRange(c, r) {
    let top = r, bot = r;
    while (this.ladder(c, top - 1)) top--;
    while (this.ladder(c, bot + 1)) bot++;
    return { minY: top * TILE, maxY: (bot + 1) * TILE };
  }
}

class Station {
  constructor(def, loop) {
    this.def = def;
    this.loop = loop;
    this.time = Math.max(400, def.time - loop * 100);
    this.screens = def.screens.map(sd => ({
      def: sd,
      level: new Level(sd, loop),
      enemies: null,       // built below (needs the level)
      cleared: false,
    }));
    for (const s of this.screens) s.enemies = s.def.enemies.map(e => new Enemy(s.level, e));
    this.spawnScreen = Math.max(0, this.screens.findIndex(s => s.def.map.some(row => row.includes('P'))));
  }
  get treasureLeft() {
    return this.screens.reduce((n, s) => n + s.level.treasure.size, 0);
  }
}

const colOf = x => Math.floor(x / TILE);

// ---------------------------------------------------------------- actors
class Walker {
  // shared tile physics helpers for player + enemies (feet-point actors)
  constructor(level) { this.lv = level; this.x = 0; this.y = 0; }
  supported(x, y) {
    if (y % TILE !== 0) return false;
    const r = y / TILE;
    return this.lv.solid(colOf(x - 6), r) || this.lv.solid(colOf(x + 6), r);
  }
}

export class Player extends Walker {
  constructor(level) {
    super(level);
    this.reset();
  }
  reset() {
    this.species = this.species || 'robin';
    this.x = this.lv.spawn.x; this.y = this.lv.spawn.y;
    this.vx = 0; this.vy = 0;
    this.mode = 'walk'; this.facing = 1; this.phase = 0;
    this.onLift = null;
    this.squashT = 0;
    this.walkT = 0;      // continuous walking time — long walks become a flit
  }
  // find a ladder cell around the body (or under the feet when climbing
  // down), checking this column and its neighbours so a bird standing or
  // flying NEAR a ladder — not pixel-aligned with it — can still take it
  ladderGrab(dirDown, tol = 14) {
    const bodyRow = Math.floor((this.y - 14) / TILE);
    const feetRow = Math.floor(this.y / TILE);
    const c0 = colOf(this.x);
    let best = null;
    for (const c of [c0, c0 - 1, c0 + 1]) {
      const r = dirDown && !this.lv.ladder(c, bodyRow) ? feetRow : bodyRow;
      if (!this.lv.ladder(c, r)) continue;
      const cx = c * TILE + 16;
      const d = Math.abs(this.x - cx);
      if (d <= tol && (!best || d < best.d)) best = { c, r, cx, d };
    }
    return best;
  }
  update(dt, input, game) {
    const lv = this.lv;
    this.squashT = Math.max(0, this.squashT - dt);
    if (this.mode === 'walk') {
      this.vx = (input.right - input.left) * WALK_V;
      if (this.vx) {
        this.facing = Math.sign(this.vx);
        this.walkT += dt;
        this.phase += dt * (this.walkT > 0.7 ? 22 : 14);
      } else this.walkT = 0;
      this.x = Math.max(9, Math.min(W - 9, this.x + this.vx * dt));
      if (this.onLift) {
        const p = this.onLift;
        this.y = p.y;
        if (this.x < lv.lift.x0 - 4 || this.x > lv.lift.x1 + 4) { this.onLift = null; this.mode = 'fall'; this.vy = 0; }
        else if (this.y - 30 < 6) { game.kill('lift'); return; }
      } else if (!this.supported(this.x, this.y)) {
        this.mode = 'fall'; this.vy = 0;
      }
      if (input.jump && this.mode === 'walk') {
        this.mode = 'jump'; this.vy = -JUMP_V; this.onLift = null;
        game.foley.jump();
      } else if (input.up || input.down) {
        // standing near a ladder foot or head counts — snap on and go
        const g = this.ladderGrab(input.down, 24);
        if (g) {
          // don't re-grab downward at a ladder bottom standing on ground
          const range = lv.ladderRange(g.c, g.r);
          if (!(input.down && !input.up && this.y >= range.maxY)) {
            this.x = g.cx; this.mode = 'climb'; this.onLift = null; this.vy = 0;
            this.range = range; this.grabY = this.y;
          }
        }
      }
    } else if (this.mode === 'climb') {
      this.walkT = 0;
      const dir = (input.down - input.up);
      if (dir) this.phase += dt * 20;   // flutters up the ladder
      // escalators help when ridden their way, resist when ridden against
      const esc = lv.escCols.get(colOf(this.x));
      const climbV = esc === undefined || !dir ? CLIMB_V
        : CLIMB_V * (dir === esc ? 1.6 : 0.55);
      this.y += dir * climbV * dt;
      this.y = Math.max(this.range.minY, Math.min(this.range.maxY, this.y));
      if (input.jump) {
        this.mode = 'jump'; this.vy = -JUMP_V * 0.9; game.foley.jump();
      } else {
        const dirH = input.right - input.left;
        if (dirH) {
          // step off at a junction; a held diagonal exits where floor
          // actually continues that way (the "downstream" of SE/NE etc),
          // but only once it has climbed clear of the junction it boarded at
          const rb = Math.round(this.y / TILE);
          const c = colOf(this.x);
          if (Math.abs(this.y - rb * TILE) < 7 && lv.solid(c, rb)
              && (!dir || (lv.solid(c + dirH, rb) && Math.abs(this.y - (this.grabY ?? this.y)) > 8))) {
            this.y = rb * TILE; this.mode = 'walk';
          }
        }
        if (this.mode === 'climb' && dir && (this.y === this.range.minY || this.y === this.range.maxY)) {
          if (this.supported(this.x, this.y)) this.mode = 'walk';
        }
      }
    } else { // jump / fall
      this.walkT = 0;
      this.phase += dt * 26;   // wing flutter
      // gentle, dt-correct air steering — capped well below run speed
      // (the old per-frame form accelerated to ~3.5× run speed)
      const steer = input.right - input.left;
      const target = steer * WALK_V * 0.8;
      this.vx += (target - this.vx) * (1 - Math.exp(-dt * 5));
      if (steer) this.facing = steer;
      const prevY = this.y;
      this.vy = Math.min(this.vy + GRAV * dt, 460);
      this.x = Math.max(9, Math.min(W - 9, this.x + this.vx * dt));
      this.y += this.vy * dt;
      if (this.vy < 0) {
        // head bump on the slat above
        const headR = Math.floor((this.y - 28) / TILE);
        const c = colOf(this.x);
        if (this.lv.solid(c, headR) && (this.y - 28) < headR * TILE + 12) this.vy = 0;
      } else {
        // landing sweep over tile tops
        for (let rb = Math.max(1, Math.ceil(prevY / TILE)); rb * TILE <= this.y; rb++) {
          const yb = rb * TILE;
          if (yb < prevY) continue;
          if (this.lv.solid(colOf(this.x - 6), rb) || this.lv.solid(colOf(this.x + 6), rb)) {
            this.y = yb; this.vy = 0; this.vx = 0; this.mode = 'walk'; this.onLift = null;
            this.squashT = 0.16;
            game.puff(this.x, this.y, 4);
            break;
          }
        }
        // lift paddles (moving platforms)
        if (this.mode !== 'walk' && lv.lift && this.x > lv.lift.x0 - 6 && this.x < lv.lift.x1 + 6) {
          for (const p of lv.lift.paddles) {
            if (prevY <= p.prevY + 2 && this.y >= p.y) {
              this.y = p.y; this.vy = 0; this.vx = 0; this.mode = 'walk'; this.onLift = p;
              this.squashT = 0.16;
              break;
            }
          }
        }
      }
      // holding up/down mid-flight latches onto any ladder flown through,
      // rising or falling, and climbing continues in the held direction
      if (this.mode !== 'walk' && (input.up || input.down)) {
        const g = this.ladderGrab(input.down && !input.up, 16);
        if (g) {
          this.x = g.cx; this.mode = 'climb'; this.vy = 0;
          this.range = lv.ladderRange(g.c, g.r); this.grabY = this.y;
        }
      }
      if (this.y > H + 60) game.kill('fall');
    }
  }
  hitbox() { return { x0: this.x - 8, x1: this.x + 8, y0: this.y - 26, y1: this.y - 2 }; }
  draw(ctx, dead) {
    const pose = dead ? 'dead' : this.mode === 'climb' ? 'climb'
      : this.mode !== 'walk' ? (this.vy < 0 ? 'airup' : 'airdown')
      : Math.abs(this.vx) > 1 ? (this.walkT > 0.7 ? 'flit' : 'walk') : 'stand';
    // cartoon squash & stretch: flatten on landing, lengthen in flight
    let squash = null;
    if (this.squashT > 0) {
      const k = this.squashT / 0.16;
      squash = [1 + 0.18 * k, 1 - 0.22 * k];
    } else if (pose === 'airup' && Math.abs(this.vy) > 90) {
      squash = [0.94, 1.08];
    }
    const blend = Math.min(1, Math.max(0, (this.walkT - 0.7) / 0.3));
    drawBird(ctx, this.species, { x: this.x, y: this.y, size: BIRD_SIZE[this.species] ?? 46, facing: this.facing, phase: this.phase, pose, squash, blend });
  }
}

// Enemies flow like Pac-Man ghosts: constant speed, never stopping, and at
// every junction they pick randomly among the ways ONWARD — reversing only at
// true dead ends. Grain is gobbled in passing (a head-dip, not a pause).
export class Enemy extends Walker {
  constructor(level, def, rng = Math.random) {
    super(level);
    this.t = def.t;
    this.def = def;
    this.speed = ENEMY_V[def.t] * level.speedMul;
    this.phase = 0;
    this.rng = rng;
    this.respawn();
  }
  respawn() {
    this.x = this.def.c * TILE + 16;
    this.y = this.def.floor * TILE;
    this.dir = this.def.d || 1;
    this.mode = 'walk';
    this.vy = 0;
    this.peckT = 0;      // purely visual — movement never stops
    this.straightT = 0;  // long uninterrupted walks become a flit
  }
  update(dt) {
    const lv = this.lv;
    this.phase += dt * (this.mode === 'fly' ? 26 : 11);
    if (this.peckT > 0) this.peckT -= dt;
    if (this.mode === 'fly') {
      // a fluttering glide: forward at walking pace, floaty gravity,
      // landing on the first platform crossed
      const prevY = this.y;
      this.vy = Math.min(this.vy + GRAV * 0.45 * dt, 250);
      this.y += this.vy * dt;
      let nx = this.x + this.dir * this.speed * 0.9 * dt;
      if (nx < 10 || nx > W - 10) { this.dir = -this.dir; nx = this.x; }
      this.x = nx;
      if (this.vy > 0) {
        for (let rb = Math.floor(prevY / TILE) + 1; rb * TILE <= this.y; rb++) {
          if (lv.solid(colOf(this.x - 6), rb) || lv.solid(colOf(this.x + 6), rb)) {
            this.y = rb * TILE; this.vy = 0; this.mode = 'walk'; this.straightT = 0;
            break;
          }
        }
      }
      return;
    }
    if (this.mode === 'walk') {
      const nx = this.x + this.dir * this.speed * dt;
      const c = colOf(nx);
      const cx = c * TILE + 16;
      // strict crossing: sitting exactly ON the centre (fresh off a ladder)
      // is not a crossing, else birds re-decide the junction they just left
      const crossed = (this.x - cx) * (nx - cx) < 0;
      this.x = nx;
      this.straightT += dt;
      if (crossed) {
        const r = this.y / TILE;
        // a rival bird pinches the cream off any bottle it passes
        const bottle = lv.bottles.get(`${c},${r - 1}`);
        if (bottle && bottle.cream) { bottle.cream = false; this.peckT = 0.45; }
        this.decideWalking(c, r, cx);
      } else if (this.x + this.dir * 10 < 4 || this.x + this.dir * 10 > W - 4) {
        this.dir = -this.dir;   // level bounds between centres
        this.straightT = 0;
      }
    } else { // climb
      const prevY = this.y;
      let ny = this.y + this.vdir * this.speed * 0.85 * dt;
      const c = colOf(this.x);
      // visit every tile boundary crossed this step (endpoints included)
      const step = this.vdir;
      for (let rb = step > 0 ? Math.floor(prevY / TILE) + 1 : Math.ceil(prevY / TILE) - 1;
           step > 0 ? rb * TILE <= ny : rb * TILE >= ny; rb += step) {
        const yb = rb * TILE;
        if (yb < this.range.minY || yb > this.range.maxY) break;
        if (this.decideClimbing(c, rb, yb)) { ny = yb; break; }
      }
      if (this.mode === 'climb') {
        // safety clamp at ladder ends: force an exit
        if (ny <= this.range.minY) { ny = this.range.minY; this.forceExit(c, ny); }
        else if (ny >= this.range.maxY) { ny = this.range.maxY; this.forceExit(c, ny); }
      }
      this.y = ny;
    }
  }
  // at a tile centre while walking: ways onward = ahead / up / down / airborne
  decideWalking(c, r, cx) {
    const lv = this.lv;
    const fwdOK = lv.solid(c + this.dir, r) && (this.dir > 0 ? c + 1 < COLS : c > 0);
    const roomToFly = this.dir > 0 ? c < COLS - 2 : c > 1;
    const opts = [];
    const flier = this.t !== 'commuter';   // commuters stay firmly grounded
    if (fwdOK) opts.push('fwd', 'fwd'); // mild straight-on bias
    if (lv.ladder(c, r - 1)) opts.push('up');
    if (lv.ladder(c, r)) opts.push('down');
    if (!fwdOK && roomToFly && flier) opts.push('fly');   // glide off the edge
    if (!opts.length) { this.dir = -this.dir; this.straightT = 0; return; }
    const pick = opts[Math.floor(this.rng() * opts.length)];
    if (pick === 'fwd') {
      // once in a while, a little flutter-hop along the way
      if (flier && this.rng() < 0.04) { this.mode = 'fly'; this.vy = -170; this.straightT = 0; }
      return;
    }
    this.straightT = 0;
    if (pick === 'fly') { this.mode = 'fly'; this.vy = -70; return; }
    this.mode = 'climb';
    this.x = cx;
    this.vdir = pick === 'up' ? -1 : 1;
    this.range = lv.ladderRange(c, pick === 'up' ? r - 1 : r);
  }
  // crossing a floor junction while climbing: onward = continue / step off L / R
  decideClimbing(c, rb, yb) {
    const lv = this.lv;
    const opts = [];
    const contLadder = this.vdir < 0 ? lv.ladder(c, rb - 1) : lv.ladder(c, rb);
    if (contLadder && yb > this.range.minY - 1 && yb < this.range.maxY + 1) opts.push('cont', 'cont');
    if (lv.solid(c, rb)) {   // a floor pierces the ladder here — stepping off is possible
      if (lv.solid(c - 1, rb)) opts.push('left');
      if (lv.solid(c + 1, rb)) opts.push('right');
    }
    if (!opts.length) return false;
    const pick = opts[Math.floor(this.rng() * opts.length)];
    if (pick === 'cont') return false;
    this.mode = 'walk';
    this.y = yb;
    this.dir = pick === 'left' ? -1 : 1;
    this.straightT = 0;
    return true;
  }
  forceExit(c, yb) {
    const lv = this.lv;
    const rb = Math.round(yb / TILE);
    const opts = [];
    if (lv.solid(c - 1, rb)) opts.push(-1);
    if (lv.solid(c + 1, rb)) opts.push(1);
    if (opts.length) {
      this.mode = 'walk';
      this.dir = opts[Math.floor(this.rng() * opts.length)];
      this.straightT = 0;
    } else {
      this.vdir = -this.vdir;   // blind shaft — head back
    }
  }
  hitbox() { return { x0: this.x - 8, x1: this.x + 8, y0: this.y - 24, y1: this.y - 2 }; }
  draw(ctx) {
    if (this.t === 'commuter') {
      // commuters trudge; on an escalator they stand and ride
      drawCommuter(ctx, {
        x: this.x, y: this.y, size: 52, facing: this.dir, phase: this.phase,
        pose: this.mode === 'climb' ? 'ride' : 'walk', variant: this.def.v ?? 0,
      });
      return;
    }
    const pose = this.mode === 'fly' ? (this.vy < 0 ? 'airup' : 'airdown')
      : this.peckT > 0 ? 'peck' : this.mode === 'climb' ? 'climb'
      : this.straightT > 1.1 ? 'flit' : 'walk';
    const blend = Math.min(1, Math.max(0, (this.straightT - 1.1) / 0.3));
    drawBird(ctx, this.t, {
      x: this.x, y: this.y, size: BIRD_SIZE[this.t],
      facing: this.dir, phase: this.phase, pose, blend,
    });
  }
}

// ---------------------------------------------------------------- game
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.camX = 0; this.camY = 0;
    addEventListener('resize', () => this.resize());
    this.resize();
    this.foley = new Foley();
    this.music = new Chiptune(() => { this.foley.ensure(); return this.foley.ctx; });
    this.music.setMuted(localStorage.getItem('robbin.mute') === '1');
    this.input = { left: 0, right: 0, up: 0, down: 0, jump: 0 };
    // glide mode: a swipe sets a persistent heading; diagonals keep both
    // intents live, so SE runs east and takes the first southbound ladder
    this.controlMode = localStorage.getItem('robbin.ctrl') === 'glide' ? 'glide' : 'hold';
    this.heading = { x: 0, y: 0 };
    this.tube = new TubeFlock(this);
    this.state = 'title';
    this.hiscore = Number(localStorage.getItem('robbin.hiscore') || 0);
    this.fx = [];
    this.parts = [];     // air-ticks and feather puffs (secondary action)
    this.bindInput();
    this.updateMuteButton();
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }
  // full-viewport canvas + a camera zoomed for chunky cartoon characters:
  // never wider than the level needs (contain), never past full-bleed (cover),
  // aiming for ~8.5 tiles across the short side of the screen
  resize() {
    this.cssW = window.innerWidth; this.cssH = window.innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    const contain = Math.min(this.cssW / W, this.cssH / H);
    const cover = Math.max(this.cssW / W, this.cssH / H);
    const tileTarget = (Math.min(this.cssW, this.cssH) / 8.5) / TILE;
    this.scale = Math.min(Math.max(contain, tileTarget), cover);
    this.viewW = this.cssW / this.scale;
    this.viewH = this.cssH / this.scale;
    this.offX = Math.max(0, (this.cssW - W * this.scale) / 2);
    this.offY = Math.max(0, (this.cssH - H * this.scale) / 2);
  }
  updateCamera(dt, snap = false) {
    if (!this.player) return;
    const tx = Math.max(0, Math.min(this.player.x - this.viewW / 2, W - this.viewW));
    const ty = Math.max(0, Math.min(this.player.y - 24 - this.viewH / 2, H - this.viewH));
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  // ------------------------------------------------ state transitions
  newGame() {
    this.score = 0; this.lives = 5; this.stationIndex = 0; this.nextLifeAt = EXTRA_LIFE_EVERY;
    this.foley.ensure(); this.foley.start();
    this.music.start();
    this.loadStation(0);
    document.getElementById('title').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
  }
  loadStation(idx) {
    this.stationIndex = idx;
    const loop = Math.floor(idx / STATIONS.length);
    this.station = new Station(STATIONS[idx % STATIONS.length], loop);
    this.time = this.station.time;
    this.timeAcc = 0;
    this.enterScreen(this.station.spawnScreen);
    this.player = new Player(this.level);
    this.heading = { x: 0, y: 0 };
    this.state = 'intro'; this.stateT = 1.2;
    this.updateCamera(0, true);
  }
  enterScreen(sx) {
    this.screenX = sx;
    this.screen = this.station.screens[sx];
    this.level = this.screen.level;
    if (this.player) this.player.lv = this.level;
    this.fx = [];
    this.parts = [];
  }
  get enemies() { return this.screen ? this.screen.enemies : []; }
  set enemies(v) { if (this.screen) this.screen.enemies = v; }
  // walk (or fly) off the side of a screen into its neighbour — the tunnels
  slideScreen(d) {
    this.enterScreen(this.screenX + d);
    const pl = this.player;
    pl.x = d > 0 ? 12 : W - 12;
    pl.onLift = null;
    if (pl.mode === 'walk' && !pl.supported(pl.x, pl.y)) { pl.mode = 'fall'; pl.vy = 0; }
    this.foley.whoosh();
    this.fx.push({ x: pl.x + d * 60, y: pl.y - 46, txt: this.screen.def.name.toUpperCase(), t: 1.4 });
    this.updateCamera(0, true);
  }
  continueFromMap() {
    this.loadStation(this.stationIndex + 1);
  }
  puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + Math.random() * 14 - 7, y: y - Math.random() * 10,
        vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 50,
        t: 0.4 + Math.random() * 0.25,
      });
    }
  }
  addScore(n, x, y) {
    this.score += n;
    if (x !== undefined) this.fx.push({ x, y, txt: `+${n}`, t: 0.9 });
    if (this.score >= this.nextLifeAt) {
      this.lives++; this.nextLifeAt += EXTRA_LIFE_EVERY;
      this.fx.push({ x: W / 2, y: 60, txt: 'EXTRA LIFE!', t: 1.4 });
      this.foley.clear();
    }
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      localStorage.setItem('robbin.hiscore', String(this.hiscore));
    }
  }
  kill(why) {
    if (this.state !== 'play') return;
    this.state = 'dying'; this.stateT = 1.3;
    this.foley.death();
    this.music.duck(1.6);
    this.puff(this.player.x, this.player.y - 12, 9);
    this.player.vy = -180;
    this.deathWhy = why;
  }
  gameOver() {
    this.state = 'gameover';
    this.music.stop();
    const el = document.getElementById('gameover');
    el.querySelector('.finalscore').textContent =
      `SCORE ${this.score}   ·   HI ${this.hiscore}`;
    el.classList.remove('hidden');
  }

  // ------------------------------------------------ input
  bindInput() {
    const keymap = {
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ' ': 'jump', z: 'jump', Z: 'jump',
    };
    const DIRVEC = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    addEventListener('keydown', e => {
      if (e.key === 'Enter') { this.pressStart(); return; }
      if (e.key === 'Escape') {
        if (this.state === 'tube') { this.tube.exit(); return; }
        if (this.state === 'gameover') { this.backToMenu(); return; }
        return;
      }
      if (e.key === 'p' || e.key === 'P') { this.togglePause(); return; }
      if (e.key === 'm' || e.key === 'M') { this.toggleMute(); return; }
      const k = keymap[e.key];
      if (k) {
        this.input[k] = 1;
        if (k === 'jump' && !e.repeat) {
          this.jumpTap = true;  // don't let sub-frame taps vanish
          if (this.state === 'tube') this.tube.handleJump();
        }
        if (DIRVEC[k]) {
          if (this.state === 'tube') { if (!this.tube.interior) this.tube.handleDir(...DIRVEC[k]); }
          else if (this.controlMode === 'glide') this.setHeading(...DIRVEC[k]);
        }
        e.preventDefault(); this.foley.ensure();
      }
    });
    addEventListener('keyup', e => { const k = keymap[e.key]; if (k) this.input[k] = 0; });

    for (const btn of document.querySelectorAll('[data-k]')) {
      const k = btn.dataset.k;
      const on = e => {
        e.preventDefault(); this.input[k] = 1;
        if (k === 'jump') {
          this.jumpTap = true;
          // the tube's own jump handling (game-over dismiss etc) must hear
          // the TOUCH button too, not just the keyboard
          if (this.state === 'tube') this.tube.handleJump();
        }
        this.foley.ensure();
      };
      const off = e => { e.preventDefault(); this.input[k] = 0; };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    }
    for (const id of ['title', 'gameover']) {
      document.getElementById(id).addEventListener('pointerdown', () => this.pressStart());
    }
    document.getElementById('mute').addEventListener('pointerdown', e => {
      e.stopPropagation(); this.toggleMute();
    });
    this.canvas.addEventListener('pointerdown', e => {
      if (this.state === 'map') { this.continueFromMap(); return; }
      if (this.state === 'tube' && this.tube.over) { this.tube.handleJump(); return; }
      // flick gestures on the play field (glide mode + tube travel)
      this.gesture = { x: e.clientX, y: e.clientY, used: false };
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!this.gesture || this.gesture.used) return;
      const dx = e.clientX - this.gesture.x, dy = e.clientY - this.gesture.y;
      if (Math.hypot(dx, dy) > 26) {
        this.gesture.used = true;
        this.applySwipe(dx, dy);
      }
    });
    this.canvas.addEventListener('pointerup', () => { this.gesture = null; });

    // the 8-way pad is one joystick surface: touch position (or drag)
    // relative to its centre picks among the 8 directions
    const dpad = document.getElementById('dpad');
    if (dpad) {
      const cells = [...dpad.querySelectorAll('span[data-d]')];
      const padDir = e => {
        const r = dpad.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < 10) return null;
        const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
        const v = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(oct + 8) % 8];
        return { x: v[0], y: v[1] };
      };
      const show = d => cells.forEach(c =>
        c.classList.toggle('lit', !!d && c.dataset.d === `${d.x},${d.y}`));
      const apply = d => {
        if (this.state === 'tube' && !this.tube.interior) { if (d) this.tube.handleDir(d.x, d.y); return; }
        if (this.state !== 'tube' && this.controlMode === 'glide') { if (d) this.setHeading(d.x, d.y); return; }
        // hold semantics: flight-line HOLD mode and station interiors
        this.input.left = d && d.x < 0 ? 1 : 0;
        this.input.right = d && d.x > 0 ? 1 : 0;
        this.input.up = d && d.y < 0 ? 1 : 0;
        this.input.down = d && d.y > 0 ? 1 : 0;
      };
      let padActive = false;
      dpad.addEventListener('pointerdown', e => {
        e.preventDefault(); padActive = true; this.foley.ensure();
        const d = padDir(e); show(d); apply(d);
      });
      dpad.addEventListener('pointermove', e => {
        if (!padActive) return;
        const d = padDir(e); show(d); apply(d);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
        dpad.addEventListener(ev, () => {
          if (!padActive) return;
          padActive = false; show(null);
          if ((this.state === 'tube' && this.tube.interior) ||
              (this.state !== 'tube' && this.controlMode !== 'glide')) apply(null);
        });
      }
    }
    document.getElementById('playtube')?.addEventListener('pointerdown', e => {
      e.stopPropagation(); this.startTube();
    });
    document.getElementById('tomenu')?.addEventListener('pointerdown', e => {
      e.stopPropagation(); this.backToMenu();
    });
    document.getElementById('ctrlmode')?.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this.controlMode = this.controlMode === 'hold' ? 'glide' : 'hold';
      localStorage.setItem('robbin.ctrl', this.controlMode);
      e.currentTarget.textContent = `CONTROLS: ${this.controlMode.toUpperCase()}`;
    });
    const cbtn = document.getElementById('ctrlmode');
    if (cbtn) cbtn.textContent = `CONTROLS: ${this.controlMode.toUpperCase()}`;
  }
  setHeading(x, y) {
    // a cardinal swipe commits to that axis; a diagonal keeps both intents
    this.heading = { x, y };
  }
  applySwipe(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const x = ax > ay * 0.45 ? Math.sign(dx) : 0;
    const y = ay > ax * 0.45 ? Math.sign(dy) : 0;
    if (this.state === 'tube') { if (!this.tube.interior) this.tube.handleDir(dx, dy); }
    else if (this.controlMode === 'glide' && (x || y)) this.setHeading(x, y);
  }
  backToMenu() {
    this.state = 'title';
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('title').classList.remove('hidden');
  }
  startTube() {
    this.foley.ensure();
    this.music.start();
    document.getElementById('title').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    this.state = 'tube';
    this.tube.start();
  }
  toggleMute() {
    const m = !this.music.muted;
    this.music.setMuted(m);
    localStorage.setItem('robbin.mute', m ? '1' : '0');
    this.updateMuteButton();
  }
  updateMuteButton() {
    const b = document.getElementById('mute');
    if (b) {
      b.textContent = this.music.muted ? '\u{1F507}' : '\u{1F50A}';
      b.setAttribute('aria-label', this.music.muted ? 'Unmute music' : 'Mute music');
    }
  }
  pressStart() {
    if (this.state === 'title' || this.state === 'gameover') this.newGame();
    else if (this.state === 'map') this.continueFromMap();
  }
  togglePause() {
    if (this.state === 'play') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'play';
  }

  // ------------------------------------------------ update
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
    requestAnimationFrame(tt => this.frame(tt));
  }
  update(dt) {
    if (this.level && this.player) this.updateCamera(dt);
    // feather puffs and air-ticks animate in every state
    for (const q of this.parts) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt; q.t -= dt;
    }
    this.parts = this.parts.filter(q => q.t > 0);
    if (this.state === 'tube') { this.tube.update(dt); return; }
    if (this.state === 'intro') {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = 'play';
      return;
    }
    if (this.state === 'dying') {
      this.player.vy += GRAV * dt;
      this.player.y += this.player.vy * dt;
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.lives--;
        if (this.lives <= 0) this.gameOver();
        else {
          this.enterScreen(this.station.spawnScreen);
          this.player.reset();
          this.heading = { x: 0, y: 0 };   // glide mode: stand until told
          // no camping the respawn point: hostiles loitering nearby go
          // back to their own start positions (all far from the spawn)
          for (const e of this.enemies) {
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 150) e.respawn();
          }
          this.updateCamera(0, true);
          this.time = Math.max(this.time, 120); this.state = 'intro'; this.stateT = 0.7;
        }
      }
      return;
    }
    if (this.state === 'leveldone') {
      this.stateT -= dt;
      // drain remaining time into score
      const drain = Math.min(this.time, Math.ceil(200 * dt));
      if (drain > 0) { this.time -= drain; this.addScore(drain); }
      if (this.stateT <= 0 && this.time <= 0) {
        this.state = 'map'; this.mapT = 0;
      }
      return;
    }
    if (this.state === 'map') {
      this.mapT += dt;
      if (this.jumpTap) { this.jumpTap = false; this.continueFromMap(); }
      else if (this.mapT > 8) this.continueFromMap();   // idle demo rolls on
      return;
    }
    if (this.state !== 'play') return;

    const lv = this.level;
    // lift paddles
    if (lv.lift) {
      for (const p of lv.lift.paddles) {
        p.prevY = p.y;
        p.y -= LIFT_V * lv.speedMul * dt;
        if (p.y < 16) { p.y = lv.lift.botY; p.prevY = p.y; }
      }
    }
    // in glide mode the persistent heading plays the direction keys for you
    const dirIn = this.controlMode === 'glide'
      ? { left: this.heading.x < 0 ? 1 : 0, right: this.heading.x > 0 ? 1 : 0,
          up: this.heading.y < 0 ? 1 : 0, down: this.heading.y > 0 ? 1 : 0 }
      : this.input;
    this.player.update(dt, { ...dirIn, jump: this.input.jump || this.jumpTap }, this);
    this.jumpTap = false;
    if (this.state !== 'play') return;   // killed during update

    // edge tunnels between the station's screens
    if (this.player.mode !== 'climb') {
      if (this.player.x <= 9 && this.screenX > 0) this.slideScreen(-1);
      else if (this.player.x >= W - 9 && this.screenX < this.station.screens.length - 1) this.slideScreen(1);
    }

    for (const e of this.enemies) e.update(dt, this);

    // wing-beat air-ticks trail off anyone fluttering
    const emit = (b, facing) => {
      if (Math.random() < dt * 10 && this.parts.length < 90) {
        this.parts.push({
          x: b.x - facing * 9 + Math.random() * 8 - 4,
          y: b.y - 6 - Math.random() * 10,
          vx: -facing * 30, vy: 24, t: 0.35,
        });
      }
    };
    const pl = this.player;
    if (pl.mode === 'jump' || pl.mode === 'fall' || (pl.mode === 'walk' && pl.walkT > 0.7)) emit(pl, pl.facing);
    for (const e of this.enemies) {
      if (e.mode === 'fly' || (e.mode === 'walk' && e.straightT > 1.1)) emit(e, e.dir);
    }

    // gobble grain piles; pinch the cream off milk bottles
    const px = this.player.x, py = this.player.y;
    for (const [key, it] of lv.treasure) {
      const ix = it.c * TILE + 16, iy = (it.r + 1) * TILE;
      if (Math.abs(px - ix) < 15 && Math.abs(py - iy) < 22) {
        lv.treasure.delete(key);
        this.addScore(100, ix, iy - 20);
        this.foley.egg();
      }
    }
    for (const it of lv.bottles.values()) {
      const ix = it.c * TILE + 16, iy = (it.r + 1) * TILE;
      if (it.cream && Math.abs(px - ix) < 15 && Math.abs(py - iy) < 26) {
        it.cream = false;
        this.addScore(250, ix, iy - 34);
        this.foley.cream();
      }
    }
    if (lv.treasure.size === 0 && !this.screen.cleared) {
      this.screen.cleared = true;
      if (this.station.treasureLeft > 0) {
        // point toward the grain that's left
        const rest = this.station.screens.findIndex(s => s.level.treasure.size > 0);
        const arrow = rest > this.screenX ? '→' : '←';
        this.fx.push({ x: px, y: py - 64, txt: `SCREEN CLEAR ${arrow}`, t: 2.2 });
        this.foley.clear();
      }
    }
    if (this.station.treasureLeft === 0) {
      this.state = 'leveldone'; this.stateT = 1.4;
      this.foley.clear();
      return;
    }

    // enemy collisions
    const a = this.player.hitbox();
    for (const e of this.enemies) {
      const b = e.hitbox();
      if (a.x0 < b.x1 - 3 && b.x0 < a.x1 - 3 && a.y0 < b.y1 - 3 && b.y0 < a.y1 - 3) {
        this.kill('bird'); return;
      }
    }

    // timer
    this.timeAcc += dt;
    while (this.timeAcc >= TIME_TICK) {
      this.timeAcc -= TIME_TICK;
      this.time--;
      if (this.time <= 100 && this.time % 10 === 0) this.foley.tick();
      if (this.time <= 0) { this.kill('time'); return; }
    }

    for (const f of this.fx) f.t -= dt;
    this.fx = this.fx.filter(f => f.t > 0);
  }

  // ------------------------------------------------ drawing
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    if (this.state === 'title' || this.state === 'gameover') {
      this.drawBackdrop(ctx);
      this.drawHUDBar();
      return;
    }
    if (this.state === 'map') {
      this.drawMapScreen(ctx);
      this.drawHUDBar();
      return;
    }
    if (this.state === 'tube') {
      this.tube.draw(ctx);
      // feather puffs live in screen space here
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.6;
      for (const q of this.parts) {
        ctx.globalAlpha = Math.min(0.5, q.t * 1.5);
        ctx.beginPath();
        ctx.moveTo(q.x - 3, q.y);
        ctx.quadraticCurveTo(q.x, q.y - 3, q.x + 3, q.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    this.drawWorldPass(ctx);
    this.drawNeighbourHints(ctx);

    if (this.state === 'intro') this.banner(ctx, this.station.def.name, `${this.station.screens.length} screens · step-free · alight for grain`);
    if (this.state === 'leveldone') this.banner(ctx, 'STATION CLEARED!', `BONUS ${this.time}`);
    if (this.state === 'paused') this.banner(ctx, 'PAUSED', 'press P');
    this.drawHUDBar();
  }
  // the camera-transformed world: tiles, items, birds, particles, fx text.
  // Reused by TUBE FLOCK's station interiors.
  drawWorldPass(ctx) {
    ctx.save();
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.camX, -this.camY);
    this.drawLevel(ctx);
    const lv = this.level;
    for (const it of lv.treasure.values()) drawGrain(ctx, it.c * TILE + 16, (it.r + 1) * TILE);
    for (const it of lv.bottles.values()) drawBottle(ctx, it.c * TILE + 16, (it.r + 1) * TILE, it.cream);
    for (const e of this.enemies) e.draw(ctx);
    this.player.draw(ctx, this.state === 'dying');
    // little ink air-ticks — the visible whoosh of wings
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const q of this.parts) {
      ctx.globalAlpha = Math.min(0.5, q.t * 1.5);
      ctx.beginPath();
      ctx.moveTo(q.x - 3, q.y);
      ctx.quadraticCurveTo(q.x, q.y - 3, q.x + 3, q.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    for (const f of this.fx) {
      ctx.globalAlpha = Math.min(1, f.t * 2);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(f.txt, f.x, f.y - (0.9 - f.t) * 24);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // pulsing edge chevrons + counts: what's still to gobble next door
  drawNeighbourHints(ctx) {
    if (!this.station) return;
    const t = this.last / 1000;
    const fs = Math.max(14, Math.min(20, this.cssW / 32));
    for (const side of [-1, 1]) {
      const nx = this.screenX + side;
      if (nx < 0 || nx >= this.station.screens.length) continue;
      const n = this.station.screens[nx].level.treasure.size;
      if (!n) continue;
      // shout louder once this screen is finished
      const urgent = this.level.treasure.size === 0;
      const pulse = 0.45 + 0.4 * Math.sin(t * (urgent ? 7 : 3));
      const x = side < 0 ? 30 : this.cssW - 30;
      const y = this.cssH * 0.5;
      ctx.save();
      ctx.globalAlpha = urgent ? Math.max(0.5, pulse) : 0.55;
      ctx.fillStyle = urgent ? PALETTE.danger : PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(x + side * 10, y);
      ctx.lineTo(x - side * 4, y - 11);
      ctx.lineTo(x - side * 4, y + 11);
      ctx.closePath(); ctx.fill();
      ctx.font = `bold ${fs}px Georgia, serif`;
      ctx.textAlign = 'center';
      drawGrain(ctx, x - side * 2, y + fs * 2.1);
      ctx.fillText(`×${n}`, x - side * 2, y + fs * 3.4);
      ctx.restore();
    }
  }
  banner(ctx, big, small) {
    ctx.save();
    const bw = Math.min(400, this.cssW - 32), bh = 100;
    const cy = this.cssH * 0.44;
    const fs = Math.min(30, bw / 12);
    ctx.fillStyle = 'rgba(38,34,30,0.85)';
    ctx.fillRect((this.cssW - bw) / 2, cy - bh / 2, bw, bh);
    ctx.fillStyle = PALETTE.paper;
    ctx.textAlign = 'center';
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.fillText(big, this.cssW / 2, cy - 4);
    ctx.font = `${fs * 0.62}px Georgia, serif`;
    ctx.fillText(small, this.cssW / 2, cy + fs);
    ctx.restore();
  }
  // schematic line map between stations — step-free journey, no roundels
  drawMapScreen(ctx) {
    const t = this.last / 1000;
    const n = STATIONS.length;
    const nextIndex = this.stationIndex + 1;
    const round = Math.floor(nextIndex / n);
    const within = nextIndex % n;
    const cy = this.cssH * 0.46;
    const xA = this.cssW * 0.16, xB = this.cssW * 0.84;
    const fs = Math.max(15, Math.min(24, this.cssW / 26));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${fs * 1.6}px Georgia, serif`;
    ctx.fillText('THE FLIGHT LINE', this.cssW / 2, this.cssH * 0.2);
    ctx.font = `italic ${fs * 0.75}px Georgia, serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText('step-free route — tunnels between screens, lifts where marked', this.cssW / 2, this.cssH * 0.2 + fs * 1.5);
    ctx.globalAlpha = 1;

    // the line
    ctx.strokeStyle = PALETTE.platform;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(xA, cy); ctx.lineTo(xB, cy); ctx.stroke();

    // stations
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (xA + xB) / 2 : xA + (xB - xA) * (i / (n - 1));
      const done = i < within || (within === 0 && round > 0 && false);
      const isNext = i === within;
      ctx.beginPath(); ctx.arc(x, cy, 13, 0, Math.PI * 2);
      ctx.fillStyle = done ? PALETTE.platform : PALETTE.paper;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = PALETTE.ink;
      ctx.stroke();
      if (isNext) {
        ctx.beginPath(); ctx.arc(x, cy, 20 + Math.sin(t * 5) * 2.5, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = PALETTE.danger;
        ctx.stroke();
      }
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold ${fs * 0.72}px Georgia, serif`;
      ctx.fillText(STATIONS[i].name, x, cy + (i % 2 ? -34 : 46));
      if (STATIONS[i].hasLift) {
        // little lift glyph: box with up/down arrows
        const ly = cy + (i % 2 ? -66 : 62);
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 2;
        ctx.strokeRect(x - 10, ly - 9, 20, 18);
        ctx.font = `bold ${fs * 0.6}px Georgia, serif`;
        ctx.fillText('↕', x, ly + 5);
      }
    }
    // a robin commutes along the line
    const rx = xA + ((t * 46) % (xB - xA));
    drawBird(ctx, 'robin', { x: rx, y: cy - 4, size: 44, facing: 1, phase: t * 12, pose: 'walk' });

    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${fs}px Georgia, serif`;
    const nextName = STATIONS[within].name + (round > 0 ? `  ·  ROUND ${round + 1}` : '');
    ctx.fillText(`NEXT STATION: ${nextName}`, this.cssW / 2, this.cssH * 0.72);
    ctx.globalAlpha = 0.35 + 0.65 * (Math.sin(t * 6) > 0 ? 1 : 0.2);
    ctx.font = `${fs * 0.8}px Georgia, serif`;
    ctx.fillStyle = PALETTE.platform;
    ctx.fillText('PRESS JUMP / ENTER / TAP TO BOARD', this.cssW / 2, this.cssH * 0.8);
    ctx.restore();
  }
  drawBackdrop(ctx) {
    // quiet parade of the cast along the bottom while overlays are up
    const t = this.last / 1000;
    const names = ['blackbird', 'bluetit', 'wren', 'robin'];
    const size = Math.max(60, Math.min(96, this.cssH * 0.12));
    const span = this.cssW + size * 3;
    names.forEach((n, i) => {
      const x = ((t * 60 + i * span / 4) % span) - size * 1.5;
      drawBird(ctx, n, { x, y: this.cssH - 14, size: n === 'wren' ? size * 0.85 : size, facing: 1, phase: t * 12, pose: 'walk' });
    });
    ctx.fillStyle = PALETTE.platform;
    ctx.fillRect(0, this.cssH - 12, this.cssW, 12);
  }
  drawLevel(ctx) {
    const lv = this.level;
    // print-offset pass then ink pass, for that misregistered lino look
    for (const [dx, dy, ink] of [[2, 2, false], [0, 0, true]]) {
      for (let r = 0; r < ROWS; r++) {
        let run = -1;
        for (let c = 0; c <= COLS; c++) {
          const isSolid = c < COLS && lv.solid(c, r);
          if (isSolid && run < 0) run = c;
          if (!isSolid && run >= 0) {
            const x = run * TILE, y = r * TILE, w = (c - run) * TILE;
            ctx.fillStyle = ink ? PALETTE.platform : PALETTE.platformShadow;
            ctx.fillRect(x + dx, y + dy, w, 12);
            if (ink) {
              ctx.strokeStyle = 'rgba(38,34,30,0.5)';
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              for (let hx = x + 6; hx < x + w - 2; hx += 16) {
                ctx.moveTo(hx, y + 14); ctx.lineTo(hx + 6, y + 19);
              }
              ctx.stroke();
            }
            run = -1;
          }
        }
      }
      // ladders
      for (let c = 0; c < COLS; c++) {
        let run = -1;
        for (let r = 0; r <= ROWS; r++) {
          const isL = r < ROWS && lv.ladder(c, r);
          if (isL && run < 0) run = r;
          if (!isL && run >= 0) {
            const x = c * TILE + 16, y0 = run * TILE, y1 = r * TILE;
            const esc = lv.escCols.get(c);
            ctx.strokeStyle = ink ? PALETTE.ladder : PALETTE.platformShadow;
            ctx.lineWidth = 3.6;
            ctx.beginPath();
            ctx.moveTo(x - 8 + dx, y0 + dy); ctx.lineTo(x - 8 + dx, y1 + dy);
            ctx.moveTo(x + 8 + dx, y0 + dy); ctx.lineTo(x + 8 + dx, y1 + dy);
            if (esc === undefined) {
              for (let ry = y0 + 8; ry < y1; ry += 11) {
                ctx.moveTo(x - 8 + dx, ry + dy); ctx.lineTo(x + 8 + dx, ry + dy);
              }
              ctx.stroke();
            } else {
              ctx.stroke();
              if (ink) {
                // escalator: treads glide with the direction of travel
                const slide = ((this.last / 1000) * 26 * esc % 11 + 11) % 11;
                ctx.strokeStyle = PALETTE.ink;
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                for (let ry = y0 + 3 + slide; ry < y1 - 2; ry += 11) {
                  ctx.moveTo(x - 7, ry + 3); ctx.lineTo(x + 7, ry - 3);
                }
                ctx.stroke();
                // direction chevron beside the top
                ctx.fillStyle = esc < 0 ? PALETTE.platform : PALETTE.danger;
                ctx.beginPath();
                const ay = y0 + 10, flip = esc < 0 ? 1 : -1;
                ctx.moveTo(x + 14, ay + 4 * flip);
                ctx.lineTo(x + 18, ay - 4 * flip);
                ctx.lineTo(x + 22, ay + 4 * flip);
                ctx.closePath(); ctx.fill();
              }
            }
            run = -1;
          }
        }
      }
    }
    // tunnel mouths where a neighbouring screen connects
    const arch = (xEdge, dir) => {
      const gy = H - TILE;   // ground top
      ctx.fillStyle = 'rgba(38,34,30,0.85)';
      ctx.beginPath();
      ctx.moveTo(xEdge, gy);
      ctx.lineTo(xEdge, gy - 30);
      ctx.quadraticCurveTo(xEdge + dir * 18, gy - 44, xEdge + dir * 20, gy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PALETTE.paper;
      ctx.beginPath();
      const ax = xEdge + dir * 9;
      ctx.moveTo(ax - dir * 3, gy - 24); ctx.lineTo(ax + dir * 4, gy - 19); ctx.lineTo(ax - dir * 3, gy - 14);
      ctx.closePath(); ctx.fill();
    };
    if (this.state !== 'tube' && this.station) {
      if (this.screenX > 0) arch(0, 1);
      if (this.screenX < this.station.screens.length - 1) arch(W, -1);
    }
    // lift
    if (lv.lift) {
      const { x0, x1 } = lv.lift;
      ctx.strokeStyle = 'rgba(38,34,30,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo((x0 + x1) / 2, 8); ctx.lineTo((x0 + x1) / 2, lv.lift.botY);
      ctx.stroke();
      ctx.setLineDash([]);
      if (lv.lift.out) {
        // lift out of order: crossed sign at the shaft head
        const cx2 = (x0 + x1) / 2, sy = lv.lift.topY + 20;
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 2.5;
        ctx.strokeRect(cx2 - 14, sy - 14, 28, 28);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx2 - 10, sy - 10); ctx.lineTo(cx2 + 10, sy + 10);
        ctx.moveTo(cx2 + 10, sy - 10); ctx.lineTo(cx2 - 10, sy + 10);
        ctx.stroke();
      }
      for (const p of lv.lift.paddles) {
        ctx.fillStyle = PALETTE.platformShadow;
        ctx.fillRect(x0 + 2, p.y + 2, x1 - x0 - 4, 9);
        ctx.fillStyle = PALETTE.ladder;
        ctx.fillRect(x0, p.y, x1 - x0, 9);
      }
    }
  }
  drawHUDBar() {
    const ctx = this.ctx;
    const inGame = !['title', 'gameover', 'map'].includes(this.state);
    const hudH = Math.max(38, Math.min(52, this.cssH * 0.07));
    const fs = Math.max(13, Math.min(19, this.cssW / 34));
    const ty = hudH * 0.62;
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.9)';
    ctx.fillRect(0, 0, this.cssW, hudH);
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, hudH - 0.5); ctx.lineTo(this.cssW, hudH - 0.5); ctx.stroke();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.textAlign = 'left';
    const score = this.score ?? 0, time = this.time ?? 0;
    let x = 12;
    ctx.fillText(`SCORE ${String(score).padStart(6, '0')}`, x, ty);
    x += fs * 9;
    if (this.cssW >= 620) {
      ctx.fillText(`HI ${String(this.hiscore).padStart(6, '0')}`, x, ty);
      x += fs * 7;
    }
    if (inGame) {
      ctx.fillStyle = time <= 100 ? PALETTE.danger : PALETTE.hudText;
      ctx.fillText(`TIME ${String(Math.max(0, time)).padStart(3, '0')}`, x, ty);
      x += fs * 6;
      ctx.fillStyle = PALETTE.hudText;
      // station·screen plus grain still to gobble across the station
      ctx.fillText(`S${this.stationIndex + 1}·${this.screenX + 1}`, x, ty);
      x += fs * 3.2;
      drawGrain(ctx, x + 6, ty + 2);
      ctx.fillText(`×${this.station.treasureLeft}`, x + 18, ty);
      // lives roost on the right, leaving room for the mute button
      const liveSize = fs * 1.7;
      for (let i = 0; i < Math.min(6, this.lives - 1); i++) {
        drawBird(ctx, 'robin', {
          x: this.cssW - 56 - i * liveSize * 0.72, y: hudH * 0.82,
          size: liveSize, facing: -1, pose: 'stand',
        });
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- boot
function decorateTitle() {
  const cast = document.getElementById('cast');
  if (cast) {
    cast.innerHTML =
      birdSVG('robin', 96) + birdSVG('blackbird', 88) +
      birdSVG('bluetit', 88) + birdSVG('wren', 76);
  }
}
decorateTitle();
const game = new Game(document.getElementById('game'));
// headless-playtest hook (same convention as tanks-for-the-trees' __tftt)
window.__robbin = {
  game,
  get state() { return game.state; },
  start: () => game.newGame(),
  // legacy semantics: 0..3 map onto station 0-1 × screen 0-1
  warp: n => {
    game.loadStation(Math.floor(n / 2));
    game.enterScreen(n % 2);
    game.player = new Player(game.level);
    game.updateCamera(0, true);
  },
  press: (k, v = 1) => { game.input[k] = v; },
};
