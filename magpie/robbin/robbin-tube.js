// robbin-tube.js — TUBE FLOCK: the libbirds ride the Underground.
// A curated, real-geography slice of the network (Central / Northern /
// Jubilee around Bank and London Bridge) drawn in the game's lino style.
// The main dynamic is GROWING THE FLOCK: lost libbirds are scattered around
// the network; fly to their stations, drop inside — a full-screen platformer
// cut of the station with the depths London stations really have — and bring
// them home. Each interior you play a randomly chosen flock member while the
// rest flutter along as AI buddies. Adversaries are ordinary commuters.
// Step-free access is real-ish: step-free stations' lifts never fail;
// elsewhere lifts go out and escalators run against you.

import { PALETTE, drawBird, drawGrain, drawCommuter } from './robbin-sprites.js';
import { Level, Player, Enemy, TILE, W, H, LIFT_V } from './robbin-game.js';

const LINES = {
  central:  { color: '#c0392b', stations: ['HOLBORN', 'CHANCERY LANE', "ST PAUL'S", 'BANK', 'LIVERPOOL STREET'] },
  northern: { color: '#26221e', stations: ['MOORGATE', 'BANK', 'LONDON BRIDGE', 'BOROUGH', 'ELEPHANT & CASTLE'] },
  jubilee:  { color: '#7b868c', stations: ['WATERLOO', 'SOUTHWARK', 'LONDON BRIDGE', 'BERMONDSEY', 'CANADA WATER', 'CANARY WHARF'] },
};
// design space 0..100 × 0..60, loosely geographic
const POS = {
  'HOLBORN': [6, 16], 'CHANCERY LANE': [20, 13], "ST PAUL'S": [36, 11],
  'BANK': [52, 12], 'LIVERPOOL STREET': [68, 6], 'MOORGATE': [50, 2],
  'LONDON BRIDGE': [56, 32], 'BOROUGH': [46, 43], 'ELEPHANT & CASTLE': [32, 52],
  'WATERLOO': [8, 42], 'SOUTHWARK': [26, 38], 'BERMONDSEY': [74, 40], 'CANADA WATER': [90, 46],
  'CANARY WHARF': [99, 34],
};
// stations with genuine step-free access (roughly true to life):
// their lifts never break and their escalators all run your way
const STEP_FREE = new Set([
  'LONDON BRIDGE', 'BERMONDSEY', 'CANADA WATER', 'SOUTHWARK',
  'LIVERPOOL STREET', 'MOORGATE', 'WATERLOO', 'BOROUGH', 'CANARY WHARF',
]);

// the scattered flock, in rescue order (first hop is a gentle same-line
// trip). Every bird has a little story; every rescue is a small reunion.
const LOST = [
  { sp: 'bluetit', name: 'TITCH', at: "ST PAUL'S", note: 'lost near the ticket gates' },
  { sp: 'wren', name: 'JENNY', at: 'BOROUGH', note: 'lonely down at the platforms' },
  { sp: 'blackbird', name: 'MAUD', at: 'LONDON BRIDGE', note: 'going round in circles on level −1' },
  { sp: 'blackbird', name: 'BRAM', at: 'CANADA WATER', note: 'singing to nobody at level −2' },
  { sp: 'bluetit', name: 'SKY', at: 'CANARY WHARF', note: 'feeling small in the big station' },
  { sp: 'robin', name: 'PECK', at: 'HOLBORN', note: 'waiting where the lifts never came' },
  { sp: 'bluetit', name: 'PIP', at: 'ELEPHANT & CASTLE', note: 'napping by the deep stairs' },
  { sp: 'wren', name: 'MOSS', at: 'WATERLOO', note: 'lost on level −2' },
  { sp: 'wren', name: 'WINK', at: 'MOORGATE', note: 'hiding behind the adverts' },
  { sp: 'robin', name: 'RUSTY', at: 'CHANCERY LANE', note: 'moping on the middle level' },
  { sp: 'blackbird', name: 'COCO', at: 'SOUTHWARK', note: 'humming along with the escalators' },
  { sp: 'robin', name: 'ROBERTA', at: 'BERMONDSEY', note: 'watching the trains go by' },
];
const BIRD_PX = { wren: 26, bluetit: 32, robin: 32, blackbird: 32 };

// build the graph: station -> [{to, line}]
const EDGES = new Map(Object.keys(POS).map(s => [s, []]));
for (const [line, def] of Object.entries(LINES)) {
  for (let i = 0; i + 1 < def.stations.length; i++) {
    const a = def.stations[i], b = def.stations[i + 1];
    EDGES.get(a).push({ to: b, line });
    EDGES.get(b).push({ to: a, line });
  }
}
const INTERCHANGES = Object.keys(POS).filter(s => new Set(EDGES.get(s).map(e => e.line)).size > 1);

// ------------------------------------------------------- station interiors
// Four layout families modelled on real station shapes; every station maps
// to one. 'S' escalator · 'H' stairs · 'L' lift · '+' pierced floor ·
// 'P' arrival · 'X' departure gate · 'B' where a lost bird perches ·
// 'E' grain snacks.
const LAYOUTS = {
  // Bank: four levels down, long escalator flights, a shaft you can fall in
  deep4: {
    depths: 'street · ticket hall · concourse · platforms',
    map: [
      '....................',
      '.E...............B..',
      '######+#####LL####+#',
      '......S.....LL....H.',
      '......S.....LL....H.',
      '......S..E..LL....HX',
      '###+########LL######',
      '...S........LL......',
      '...S........LL......',
      '...S....E...LL......',
      '########+###LL##+###',
      '........S...LL..H...',
      '........S...LL..H...',
      'P.......S...LL..H...',
      '####################',
    ],
    commuters: [
      { t: 'commuter', c: 10, floor: 6, d: 1, v: 0 },
      { t: 'commuter', c: 5, floor: 10, d: -1, v: 9 },
      { t: 'commuter', c: 16, floor: 2, d: -1, v: 14 },
    ],
    bystanders: [[3, 13, 7], [15, 13, 12], [9, 2, 17]],
    ads: [[2, 10], [6, 10], [15, 6], [10, 10]],
    signs: [[4, 6], [14, 10]],
  },
  // London Bridge / Liverpool Street: big three-level halls
  big3: {
    depths: 'street · concourse · platforms',
    map: [
      '....................',
      '....................',
      '....................',
      '..E.....E........B..',
      '##+#####LL########+#',
      '..S.....LL........H.',
      '..S.....LL........H.',
      '..S.....LL........H.',
      '..S..E..LL........HX',
      '####+###LL######+###',
      '....S...LL......H...',
      '....S...LL......H...',
      '....S...LL......H...',
      'P...S...LL..E...H...',
      '####################',
    ],
    commuters: [
      { t: 'commuter', c: 12, floor: 9, d: -1, v: 2 },
      { t: 'commuter', c: 14, floor: 4, d: 1, v: 10 },
      { t: 'commuter', c: 7, floor: 14, d: 1, v: 5 },
    ],
    bystanders: [[6, 13, 3], [14, 13, 8], [12, 4, 15]],
    ads: [[6, 9], [12, 9], [14, 4], [3, 9]],
    signs: [[10, 4], [7, 9]],
  },
  // old Central-line stations: street + deep platforms, one long escalator,
  // stairs the long way round, no lift at all (Holborn has none in truth)
  shallow2: {
    depths: 'street · deep platforms',
    map: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..E.......B.........',
      '###+############+###',
      '...S............H...',
      '...S............H...',
      '...S............H...',
      '...S............H...',
      '...S............H...',
      '...S............H...',
      'P..S......E.....H..X',
      '####################',
    ],
    commuters: [
      { t: 'commuter', c: 9, floor: 6, d: 1, v: 6 },
      { t: 'commuter', c: 12, floor: 14, d: -1, v: 11 },
    ],
    bystanders: [[7, 13, 4], [11, 6, 18]],
    ads: [[6, 6], [10, 6], [13, 6]],
    signs: [[8, 6]],
  },
  // modern step-free stations: twin escalator banks, big central lifts
  modern3: {
    depths: 'street · concourse · platforms',
    map: [
      '....................',
      '....................',
      '....................',
      '.E................B.',
      '####+###LL####+#####',
      '....S...LL....S.....',
      '....S...LL....S.....',
      '....S...LL....S.....',
      '....S.E.LL....S.....',
      '####+###LL####+#####',
      '....S...LL....S.....',
      '....S...LL....S.....',
      '....S...LL....S.....',
      'P...S...LL.E..S....X',
      '####################',
    ],
    commuters: [
      { t: 'commuter', c: 12, floor: 9, d: 1, v: 8 },
      { t: 'commuter', c: 16, floor: 4, d: -1, v: 13 },
    ],
    bystanders: [[6, 13, 16], [16, 13, 1], [11, 9, 19]],
    ads: [[2, 9], [11, 4], [16, 9], [6, 4]],
    signs: [[12, 9], [2, 4]],
  },
};
const STATION_LAYOUT = {
  'BANK': 'deep4',
  'LONDON BRIDGE': 'big3', 'LIVERPOOL STREET': 'big3',
  'HOLBORN': 'shallow2', 'CHANCERY LANE': 'shallow2', "ST PAUL'S": 'shallow2',
  'BOROUGH': 'shallow2', 'ELEPHANT & CASTLE': 'shallow2',
  'CANADA WATER': 'modern3', 'BERMONDSEY': 'modern3', 'SOUTHWARK': 'modern3',
  'MOORGATE': 'modern3', 'WATERLOO': 'modern3', 'CANARY WHARF': 'modern3',
};

// a stylised carriage. doorX/baseY locate the doorway; door 0..1 is how
// open; dx slides the whole train; moving adds rush lines.
function drawTrain(ctx, doorX, baseY, color, { door = 1, dx = 0, moving = false } = {}) {
  const bx = doorX - 128 + dx, by = baseY - 46, bw = 176, bh = 44;
  ctx.save();
  if (moving) {
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.lineWidth = 2.5;
    for (const ly of [by + 8, by + 22, by + 36]) {
      ctx.beginPath(); ctx.moveTo(bx - 14, ly); ctx.lineTo(bx - 54, ly); ctx.stroke();
    }
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 9);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dfe6ea';
  for (let wx = bx + 10; wx < doorX + dx - 26; wx += 26) ctx.fillRect(wx, by + 8, 18, 14);
  ctx.fillRect(doorX + dx + 16, by + 8, 18, 14);
  // the doorway: dark aperture, two sliding panels
  const dw = 22;
  ctx.fillStyle = 'rgba(38,34,30,0.8)';
  ctx.fillRect(doorX + dx - dw / 2, by + 6, dw, bh - 8);
  ctx.fillStyle = color;
  const panel = (dw / 2) * (1 - door);
  ctx.fillRect(doorX + dx - dw / 2, by + 6, panel, bh - 8);
  ctx.fillRect(doorX + dx + dw / 2 - panel, by + 6, panel, bh - 8);
  ctx.strokeStyle = 'rgba(38,34,30,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(doorX + dx - dw / 2, by + 6, dw, bh - 8);
  ctx.fillStyle = '#f6d34c';
  ctx.beginPath(); ctx.arc(bx + 5, by + bh - 10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// gentle boids: the flock swirls after its anchor — cohesion, separation,
// a breath of wander. Satisfying, never anxious.
function flockStep(list, dt, tx, ty, t, spread = 1) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    b.vx = b.vx || 0; b.vy = b.vy || 0;
    let ax = (tx - b.x) * 2.2, ay = (ty - b.y) * 2.2;
    for (let j = 0; j < list.length; j++) {
      if (j === i) continue;
      const o = list[j];
      const dx = b.x - o.x, dy = b.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 26 * spread) { ax += (dx / d) * (26 * spread - d) * 9; ay += (dy / d) * (26 * spread - d) * 9; }
    }
    ax += Math.sin(t * 1.6 + b.ph) * 46;
    ay += Math.cos(t * 1.25 + b.ph * 1.3) * 34;
    b.vx = (b.vx + ax * dt) * (1 - dt * 1.4);
    b.vy = (b.vy + ay * dt) * (1 - dt * 1.4);
    const sp = Math.hypot(b.vx, b.vy), cap = 170;
    if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

export class TubeFlock {
  constructor(game) {
    this.g = game;
    this.hiscore = Number(localStorage.getItem('robbin.tube.hiscore') || 0);
  }
  start() {
    this.score = 0;
    this.over = false;          // no clock, no fail — the flock waits for you
    this.travel = null;
    this.interior = null;
    this.arriveT = 0;
    this.arriveMsg = '';
    this.freeChange = null;
    this.roster = [{ sp: 'robin', name: 'ROBBIN' }];
    this.lostIdx = 0;
    this.cur = 'LIVERPOOL STREET';
    this.line = null;
    this.gather = null;
    this.scene = null;
    this.shuffleLifts();
    const [x, y] = this.toXY(this.cur);
    this.flock = [{ sp: 'robin', x, y, ph: 0 }];
    this.updateMusic();
  }
  // the band assembles as the flock does: washes for one bird, full song
  // for the whole family
  updateMusic() {
    this.g.music.setIntensity(0.15 + 0.85 * ((this.roster.length - 1) / LOST.length));
  }
  get objective() { return this.lostIdx < LOST.length ? LOST[this.lostIdx] : null; }
  shuffleLifts() {
    // step-free stations keep their lifts, honest — everywhere else, luck
    this.liftOut = new Set(Object.keys(POS)
      .filter(s => !STEP_FREE.has(s) && Math.random() < 0.6));
  }
  saveHi() {
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      localStorage.setItem('robbin.tube.hiscore', String(this.hiscore));
    }
  }
  // design coords → screen
  layout() {
    const w = this.g.cssW, h = this.g.cssH;
    const mx = Math.max(30, w * 0.07), myTop = h * 0.2, myBot = h * 0.2;
    const sx = (w - 2 * mx) / 100, sy = (h - myTop - myBot) / 60;
    return { mx, myTop, sx, sy };
  }
  toXY(name) {
    const { mx, myTop, sx, sy } = this.layout();
    const [px, py] = POS[name];
    return [mx + px * sx, myTop + py * sy];
  }
  // ---------------------------------------------------------- input
  handleDir(dx, dy) {
    if (this.over || this.travel || this.interior || this.gather || Math.hypot(dx, dy) < 0.3) return;
    const [cx, cy] = this.toXY(this.cur);
    let best = null;
    for (const e of EDGES.get(this.cur)) {
      const [tx, ty] = this.toXY(e.to);
      const vx = tx - cx, vy = ty - cy, len = Math.hypot(vx, vy);
      const dot = (vx * dx + vy * dy) / (len * Math.hypot(dx, dy));
      if (dot > 0.45 && (!best || dot > best.dot)) best = { ...e, dot };
    }
    if (!best) return;
    // changing lines at an interchange means crossing the station itself —
    // unless you just fought your way through it
    if (this.line && best.line !== this.line && this.freeChange !== this.cur) {
      this.enterInterior(best, null);
      return;
    }
    this.depart(best);
  }
  depart(edge) {
    this.freeChange = null;
    const [ax, ay] = this.toXY(this.cur);
    const [bx, by] = this.toXY(edge.to);
    this.travel = { edge, ax, ay, bx, by, t: 0, dur: Math.max(0.7, Math.hypot(bx - ax, by - ay) / 210) };
    this.g.foley.whoosh();
  }
  handleJump() {
    // in an interior, jumping goes through the play input, not here
  }
  exit() {
    this.saveHi();
    this.g.state = 'title';
    document.getElementById('title').classList.remove('hidden');
  }
  // ---------------------------------------------------------- interiors
  enterInterior(pendingEdge, rescue, { arrival = false } = {}) {
    const g = this.g;
    const def = LAYOUTS[STATION_LAYOUT[this.cur]] || LAYOUTS.shallow2;
    const level = new Level({ name: this.cur, map: def.map, time: 0, enemies: [] }, 0);
    const stepFree = STEP_FREE.has(this.cur);
    if (level.lift) {
      level.lift.out = this.liftOut.has(this.cur);
      if (level.lift.out) level.lift.paddles = [];
    }
    // in scruffier stations one escalator runs against you
    const escCols = [...level.escCols.keys()];
    if (!stepFree && escCols.length) {
      level.escCols.set(escCols[Math.floor(Math.random() * escCols.length)], 1);
    }
    let gate = { c: 19, r: 13 }, perch = null;
    def.map.forEach((row, r) => {
      const xc = row.indexOf('X');
      if (xc >= 0) gate = { c: xc, r };
      const bc = row.indexOf('B');
      if (bc >= 0) perch = { c: bc, r };
    });
    // you play a random member of the flock; the rest fly with you
    const playing = this.roster[Math.floor(Math.random() * this.roster.length)];
    const player = new Player(level);
    player.species = playing.sp;
    this.interior = {
      def, level, pendingEdge, gate,
      playing,
      rescue: rescue && perch ? {
        ...rescue, x: perch.c * TILE + 16, y: (perch.r + 1) * TILE, found: false,
      } : null,
      enemies: def.commuters.map(e => new Enemy(level, e)),
      buddies: this.roster.filter(b => b !== playing).slice(0, 6)
        .map((b, i) => ({ sp: b.sp, x: player.x - 20 - i * 12, y: player.y - 30, ph: i * 1.9 })),
      invulnT: 1,
    };
    g.level = level;
    g.player = player;
    g.screen = { def: { name: this.cur }, enemies: this.interior.enemies, cleared: false };
    g.fx = []; g.parts = [];
    if (arrival) {
      // the train brings you: everyone starts tucked inside the carriage
      this.scene = { kind: 'arrive', t: 0, doorX: level.spawn.x + 36, baseY: H - TILE };
      player.x = -90; player.y = H - TILE;
      for (const b of this.interior.buddies) { b.x = -90; b.y = H - TILE - 26; b.vx = 0; b.vy = 0; }
    }
    g.updateCamera(0, true);
    g.foley.whoosh();
  }
  // scripted train moments: arrivals disembark, boardings get whisked away
  updateScene(dt) {
    const g = this.g, it = this.interior, sc = this.scene;
    sc.t += dt;
    const t = performance.now() / 1000;
    for (const e of it.enemies) e.update(dt);   // the station stays alive
    if (sc.kind === 'arrive') {
      const A = 1.0, B = 0.4, C = 1.1, D = 0.9;
      if (sc.t >= A + B && !sc.out) {
        sc.out = true;
        g.player.x = sc.doorX; g.player.y = sc.baseY;
        g.puff(sc.doorX, sc.baseY - 12, 4);
        g.foley.egg();
      }
      if (sc.out) {
        const k = Math.min(1, (sc.t - A - B) / C);
        const n = Math.ceil(k * it.buddies.length);
        it.buddies.forEach((b, i) => {
          if (i < n && b.x < -20) { b.x = sc.doorX; b.y = sc.baseY - 24; g.puff(b.x, b.y, 2); }
        });
        g.player.x += (it.level.spawn.x - g.player.x) * (1 - Math.exp(-dt * 4));
        flockStep(it.buddies.filter(b => b.x > -20), dt, g.player.x, g.player.y - 34, t);
      }
      if (sc.t >= A + B + C + D) { this.scene = null; it.invulnT = 0.9; }
    } else {   // board
      const A = 0.85, B = 0.5, C = 1.0;
      if (sc.t < A) {
        g.player.x += (sc.doorX - g.player.x) * (1 - Math.exp(-dt * 6));
        g.player.y += (sc.baseY - g.player.y) * (1 - Math.exp(-dt * 6));
        flockStep(it.buddies, dt, sc.doorX, sc.baseY - 26, t);
      } else if (sc.t < A + B) {
        const k = (sc.t - A) / B;
        if (g.player.x > -20) { g.puff(g.player.x, g.player.y - 12, 3); g.player.x = -200; }
        const n = Math.ceil(k * it.buddies.length);
        it.buddies.forEach((b, i) => {
          if (i < n && b.x > -20) { g.puff(b.x, b.y, 2); b.x = -200; }
        });
      }
      if (sc.t >= A + B + C) {
        const edge = it.pendingEdge;
        this.scene = null;
        this.interior = null;
        this.depart(edge);
      }
    }
  }
  updateInterior(dt) {
    const g = this.g, it = this.interior, lv = it.level;
    if (this.scene) { this.updateScene(dt); return; }
    if (it.invulnT > 0) it.invulnT -= dt;
    if (lv.lift && !lv.lift.out) {
      for (const p of lv.lift.paddles) {
        p.prevY = p.y;
        p.y -= LIFT_V * dt;
        if (p.y < 16) { p.y = lv.lift.botY; p.prevY = p.y; }
      }
    }
    g.player.update(dt, { ...g.input, jump: g.input.jump || g.jumpTap }, g);
    g.jumpTap = false;
    for (const e of it.enemies) e.update(dt);
    // buddies flock boids-fashion around their friend (or the reunion)
    const t = performance.now() / 1000;
    const anchor = it.celebrate || { x: g.player.x - (g.player.facing || 1) * 26, y: g.player.y - 34 };
    flockStep(it.buddies, dt, anchor.x, anchor.y, t);
    // grain snacks
    const px = g.player.x, py = g.player.y;
    for (const [key, itn] of lv.treasure) {
      const ix = itn.c * TILE + 16, iy = (itn.r + 1) * TILE;
      if (Math.abs(px - ix) < 15 && Math.abs(py - iy) < 22) {
        lv.treasure.delete(key);
        this.score += 50;
        g.fx.push({ x: ix, y: iy - 20, txt: '+50', t: 0.9 });
        g.foley.egg();
      }
    }
    // the lost bird: reach it and it joins the flock — a little reunion
    if (it.rescue && !it.rescue.found) {
      if (Math.abs(px - it.rescue.x) < 24 && Math.abs(py - it.rescue.y) < 34) {
        it.rescue.found = true;
        this.roster.push({ sp: it.rescue.sp, name: it.rescue.name });
        it.buddies.push({ sp: it.rescue.sp, x: it.rescue.x, y: it.rescue.y - 20, ph: 9 });
        const [fx, fy] = this.toXY(this.cur);
        this.flock.push({ sp: it.rescue.sp, x: fx, y: fy, ph: this.flock.length * 1.7 });
        this.score += 400;
        this.lostIdx++;
        this.arriveT = 3;
        this.arriveMsg = this.objective
          ? `♥ ${it.rescue.name} joins the flock ♥`
          : '♥ THE FLOCK IS WHOLE ♥';
        it.celebrate = { x: px, y: py - 30, t: 2.2 };
        g.fx.push({ x: px, y: py - 60, txt: `♥ ${it.rescue.name}! ♥`, t: 2.2 });
        g.hearts(px, py - 20, 10);
        g.foley.clear();
        this.updateMusic();
        g.music.swell();
        this.saveHi();
      }
    }
    if (it.celebrate) {
      it.celebrate.t -= dt;
      if (it.celebrate.t <= 0) it.celebrate = null;
    }
    // brushed by a commuter: just a gentle flutter aside — no harm done
    if (it.invulnT <= 0) {
      for (const e of it.enemies) {
        if (Math.abs(px - e.x) < 15 && py - 26 < e.y - 2 && e.y - 24 < py - 2) {
          const away = px < e.x ? -1 : 1;
          g.player.x = Math.max(12, Math.min(W - 12, px + away * 30));
          if (g.player.mode === 'walk' && !g.player.supported(g.player.x, g.player.y)) {
            g.player.mode = 'fall'; g.player.vy = 0;
          }
          g.puff(px, py - 10, 4);
          g.foley.grain();
          it.invulnT = 0.9;
          break;
        }
      }
    }
    // the way out / onto the train
    const locked = it.rescue && !it.rescue.found;
    if (!locked) {
      const gx = it.gate.c * TILE + 16, gy = (it.gate.r + 1) * TILE;
      if (Math.abs(px - gx) < 22 && Math.abs(py - gy) < 36) {
        if (it.pendingEdge) {
          // all aboard: the flock files into the open door
          this.scene = { kind: 'board', t: 0, doorX: gx, baseY: gy };
          g.foley.whoosh();
        } else {
          this.interior = null;
          g.foley.clear();
          this.freeChange = this.cur;   // rescued and out — no second toll
        }
      }
    }
  }
  // ---------------------------------------------------------- sim
  update(dt) {
    if (this.arriveT > 0) this.arriveT -= dt;
    if (this.interior) { this.updateInterior(dt); return; }
    if (this.gather) {
      this.gather.t += dt;
      if (this.gather.t >= this.gather.dur) {
        this.gather = null;
        this.enterInterior(null, this.objective, { arrival: true });
        return;
      }
    }
    if (this.travel) {
      this.travel.t += dt / this.travel.dur;
      if (this.travel.t >= 1) {
        this.cur = this.travel.edge.to;
        this.line = this.travel.edge.line;
        this.travel = null;
        this.g.foley.step();
        if (this.objective && this.cur === this.objective.at) {
          // don't whisk straight inside: let the flock settle in first
          this.gather = { t: 0, dur: 1.7 };
          return;
        }
      }
    }
    // the flock swirls around the map cursor
    const t = performance.now() / 1000;
    const [lx, ly] = this.travel
      ? [this.travel.ax + (this.travel.bx - this.travel.ax) * this.travel.t,
         this.travel.ay + (this.travel.by - this.travel.ay) * this.travel.t]
      : this.toXY(this.cur);
    flockStep(this.flock, dt, lx, ly - 14, t, 0.85);
  }
  // ---------------------------------------------------------- draw
  draw(ctx) {
    const g = this.g, w = g.cssW, h = g.cssH;
    const t = performance.now() / 1000;
    const fs = Math.max(13, Math.min(20, w / 34));
    if (this.interior) { this.drawInterior(ctx, fs); return; }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${fs * 1.5}px Georgia, serif`;
    ctx.fillText('TUBE FLOCK', w / 2, fs * 2);
    ctx.font = `italic ${fs * 0.72}px Georgia, serif`;
    ctx.globalAlpha = 0.7;
    ctx.fillText('grow the flock — every lost libbird is out there somewhere', w / 2, fs * 3.1);
    ctx.globalAlpha = 1;

    // the quest card: who's waiting, and where
    const ob = this.objective;
    ctx.font = `bold ${fs}px Georgia, serif`;
    if (ob) {
      ctx.fillText(`${ob.name} the ${ob.sp} is waiting at ${ob.at}`, w / 2, fs * 4.6);
      ctx.font = `italic ${fs * 0.78}px Georgia, serif`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(`…${ob.note}`, w / 2, fs * 5.7);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = PALETTE.platform;
      ctx.fillText('♥ the flock is whole — fly together as long as you like ♥', w / 2, fs * 4.6);
      ctx.fillStyle = PALETTE.ink;
    }
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 12, fs * 1.6);
    ctx.fillText(`HI ${this.hiscore}`, 12, fs * 2.8);
    // the roster, roosting in the corner
    this.roster.slice(0, 12).forEach((b, i) => {
      drawBird(ctx, b.sp, {
        x: w - 30 - i * 20, y: fs * 2.6, size: 20,
        facing: -1, phase: t * 3 + i, pose: 'stand',
      });
    });
    ctx.textAlign = 'center';

    // lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const def of Object.values(LINES)) {
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      def.stations.forEach((s, i) => {
        const [x, y] = this.toXY(s);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    // stations
    ctx.font = `bold ${Math.max(10, fs * 0.56)}px Georgia, serif`;
    for (const name of Object.keys(POS)) {
      const [x, y] = this.toXY(name);
      const inter = INTERCHANGES.includes(name);
      ctx.beginPath(); ctx.arc(x, y, inter ? 10 : 6.5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.paper; ctx.fill();
      ctx.lineWidth = inter ? 3.5 : 2.5;
      ctx.strokeStyle = PALETTE.ink; ctx.stroke();
      if (ob && name === ob.at) {
        ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(t * 4) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.5; ctx.stroke();
        // the waiting bird perches beside its station ring
        drawBird(ctx, ob.sp, { x: x + 26, y: y - 12, size: 24, facing: -1, phase: t * 8, pose: 'stand' });
      }
      ctx.fillStyle = PALETTE.ink;
      const above = POS[name][1] < 30;
      ctx.fillText(name, x, y + (above ? -16 : 26));
      if (this.liftOut.has(name)) {
        const ly = y + (above ? -40 : 44);
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.8;
        ctx.strokeRect(x - 8, ly - 8, 16, 16);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - 6, ly - 6); ctx.lineTo(x + 6, ly + 6);
        ctx.moveTo(x + 6, ly - 6); ctx.lineTo(x - 6, ly + 6);
        ctx.stroke();
      }
    }
    // the flock, swirling boids-fashion
    for (let i = this.flock.length - 1; i >= 0; i--) {
      const b = this.flock[i];
      const moving = !!this.travel;
      const facing = (b.vx || 0) < -8 ? -1 : 1;
      drawBird(ctx, b.sp, {
        x: b.x, y: b.y, size: BIRD_PX[b.sp] || 32, facing,
        phase: t * 14 + b.ph,
        pose: moving ? ((b.vy || 0) < -6 ? 'airup' : 'airdown') : 'flit',
      });
    }
    if (this.arriveT > 0) {
      ctx.fillStyle = PALETTE.platform;
      ctx.font = `bold ${fs * 1.2}px Georgia, serif`;
      ctx.fillText(this.arriveMsg, w / 2, h * 0.66);
    }
    if (this.gather) {
      ctx.fillStyle = PALETTE.ink;
      ctx.globalAlpha = 0.75;
      ctx.font = `italic ${fs * 0.95}px Georgia, serif`;
      ctx.fillText(`the flock gathers at ${this.cur}…`, w / 2, h * 0.66);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.6;
    ctx.font = `${fs * 0.72}px Georgia, serif`;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText('swipe or arrows to fly a line · no rush — the flock waits · ESC: home to roost', w / 2, h - fs);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // ------------------------------------------------ interior rendering
  drawInterior(ctx, fs) {
    const g = this.g, w = g.cssW;
    const it = this.interior;
    const t = performance.now() / 1000;
    // station dressing behind everything, in world space
    ctx.save();
    ctx.translate(g.offX, g.offY);
    ctx.scale(g.scale, g.scale);
    ctx.translate(-g.camX, -g.camY);
    this.drawDressing(ctx, it, t);
    ctx.restore();
    g.drawWorldPass(ctx);
    // birds over the top: buddies + the waiting lost one
    ctx.save();
    ctx.translate(g.offX, g.offY);
    ctx.scale(g.scale, g.scale);
    ctx.translate(-g.camX, -g.camY);
    for (const b of it.buddies) {
      drawBird(ctx, b.sp, {
        x: b.x, y: b.y, size: BIRD_PX[b.sp] || 32,
        facing: (b.vx || 0) < -8 ? -1 : 1, phase: t * 14 + b.ph,
        pose: Math.abs(b.vy || 0) > 30 ? ((b.vy || 0) < 0 ? 'airup' : 'airdown') : 'flit',
      });
    }
    if (it.rescue && !it.rescue.found) {
      const r = it.rescue;
      drawBird(ctx, r.sp, {
        x: r.x, y: r.y, size: 40, facing: -1,
        phase: t * 9, pose: Math.sin(t * 0.7) > 0.6 ? 'flit' : 'stand',
      });
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y - 18, 28 + Math.sin(t * 5) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.ink;
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, r.x, r.y - 52);
    }
    // the cutscene trains: sliding in with the flock, or whisking it away
    if (this.scene) {
      const sc = this.scene;
      const col = it.pendingEdge ? LINES[it.pendingEdge.line].color
        : (this.line ? LINES[this.line].color : PALETTE.platform);
      const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
      let door = 0, dx = 0, moving = false;
      if (sc.kind === 'arrive') {
        const A = 1.0, B = 0.4, C = 1.1, D = 0.9;
        if (sc.t < A) { dx = -460 * (1 - ease(sc.t / A)); moving = sc.t < A * 0.85; }
        else if (sc.t < A + B) { door = (sc.t - A) / B; }
        else if (sc.t < A + B + C) { door = 1; }
        else {
          const k = (sc.t - A - B - C) / D;
          door = Math.max(0, 1 - k * 2.5);
          dx = k > 0.35 ? Math.pow((k - 0.35) / 0.65, 2) * 580 : 0;
          moving = dx > 4;
        }
      } else {
        const A = 0.85, B = 0.5, C = 1.0;
        if (sc.t < A + B) door = 1;
        else {
          const k = (sc.t - A - B) / C;
          door = Math.max(0, 1 - k * 2.8);
          dx = k > 0.3 ? Math.pow((k - 0.3) / 0.7, 2) * 580 : 0;
          moving = dx > 4;
        }
      }
      drawTrain(ctx, sc.doorX, sc.baseY, col, { door, dx, moving });
    }
    ctx.restore();
    // HUD strip
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.9)';
    ctx.fillRect(0, 0, w, fs * 3);
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.beginPath(); ctx.moveTo(0, fs * 3); ctx.lineTo(w, fs * 3); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.font = `bold ${fs}px Georgia, serif`;
    const doing = it.rescue
      ? (it.rescue.found ? `${it.rescue.name} is aboard — amble to the WAY OUT` : `${it.rescue.name} the ${it.rescue.sp} is here, ${it.rescue.note}`)
      : `change to the ${it.pendingEdge.line.toUpperCase()} line — no rush`;
    ctx.fillText(`${this.cur} — ${doing}`, w / 2, fs * 1.25);
    ctx.font = `italic ${fs * 0.72}px Georgia, serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(`${it.def.depths} · you are ${it.playing.name} the ${it.playing.sp}`, w / 2, fs * 2.3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.font = `bold ${fs * 0.85}px Georgia, serif`;
    ctx.fillText(`FLOCK ${this.roster.length}`, 10, fs * 1.25);
    ctx.fillText(`SCORE ${this.score}`, 10, fs * 2.3);
    ctx.restore();
  }
  drawDressing(ctx, it, t) {
    const lv = it.level;
    const lineColor = it.pendingEdge ? LINES[it.pendingEdge.line].color
      : (this.line ? LINES[this.line].color : PALETTE.platform);
    // framed lino adverts on the back walls
    it.def.ads.forEach(([c, r], i) => {
      const x = c * TILE + 16, y = r * TILE - 14;
      ctx.fillStyle = PALETTE.paperHi;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.fillRect(x - 17, y - 24, 34, 26);
      ctx.strokeRect(x - 17, y - 24, 34, 26);
      const kind = (c + r + i) % 3;
      if (kind === 0) drawBird(ctx, ['robin', 'bluetit', 'blackbird'][i % 3], { x, y: y - 2, size: 17, facing: 1, pose: 'stand' });
      else if (kind === 1) { drawGrain(ctx, x, y - 4); }
      else {
        ctx.strokeStyle = 'rgba(38,34,30,0.6)';
        ctx.lineWidth = 1.5;
        for (let ly = y - 18; ly < y - 6; ly += 4) {
          ctx.beginPath(); ctx.moveTo(x - 12, ly); ctx.lineTo(x + 12 - (ly % 8), ly); ctx.stroke();
        }
      }
    });
    // station name boards: white board, line-colour bar
    for (const [c, r] of it.def.signs) {
      const x = c * TILE + 16, y = r * TILE - 20;
      ctx.fillStyle = '#fbf8ef';
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.fillRect(x - 40, y - 12, 80, 18);
      ctx.strokeRect(x - 40, y - 12, 80, 18);
      ctx.fillStyle = lineColor;
      ctx.fillRect(x - 40, y + 2, 80, 4);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = 'bold 9px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.cur, x, y + 1);
    }
    // WAY OUT up top
    ctx.fillStyle = PALETTE.ladder;
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    const streetRow = lv.grid.findIndex(row => row.some(ch => ch === '#' || ch === '+'));
    ctx.fillText('WAY OUT ↑', W / 2, streetRow * TILE - 6);
    // the gate: a waiting train (line changes) or the way-out doors (rescues)
    const gx = it.gate.c * TILE + 16, gy = (it.gate.r + 1) * TILE;
    const locked = it.rescue && !it.rescue.found;
    if (it.pendingEdge) {
      // a stylised carriage waiting at the platform (hidden while a
      // boarding scene animates its own)
      if (!(this.scene && this.scene.kind === 'board')) {
        ctx.save();
        ctx.globalAlpha = locked ? 0.5 : 1;
        drawTrain(ctx, gx, gy, lineColor, { door: 1 });
        ctx.restore();
      }
    } else {
      ctx.fillStyle = locked ? 'rgba(38,34,30,0.35)' : PALETTE.platform;
      ctx.fillRect(gx - 14, gy - 42, 28, 42);
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(gx - 9, gy - 36, 18, 36);
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 9px Georgia, serif';
    ctx.fillText(locked ? `FIND ${it.rescue.name} FIRST` : it.pendingEdge ? 'TO TRAINS' : 'WAY OUT', gx, gy - 52);
    if (!locked) {
      ctx.beginPath();
      const cy2 = gy - 26 + Math.sin(t * 5.5) * 3;
      ctx.moveTo(gx - 6, cy2); ctx.lineTo(gx + 6, cy2); ctx.lineTo(gx, cy2 + 7);
      ctx.closePath(); ctx.fill();
    }
    // waiting bystanders
    for (const [c, floor, v] of it.def.bystanders) {
      drawCommuter(ctx, {
        x: c * TILE + 16, y: floor * TILE, size: 48,
        facing: v % 2 ? -1 : 1, phase: t * 2 + c, pose: 'stand', variant: v,
      });
    }
  }
}
