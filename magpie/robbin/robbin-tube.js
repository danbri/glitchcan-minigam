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
  jubilee:  { color: '#7b868c', stations: ['WATERLOO', 'SOUTHWARK', 'LONDON BRIDGE', 'BERMONDSEY', 'CANADA WATER'] },
};
// design space 0..100 × 0..60, loosely geographic
const POS = {
  'HOLBORN': [6, 16], 'CHANCERY LANE': [20, 13], "ST PAUL'S": [36, 11],
  'BANK': [52, 12], 'LIVERPOOL STREET': [68, 6], 'MOORGATE': [50, 2],
  'LONDON BRIDGE': [56, 32], 'BOROUGH': [46, 43], 'ELEPHANT & CASTLE': [32, 52],
  'WATERLOO': [8, 42], 'SOUTHWARK': [26, 38], 'BERMONDSEY': [74, 40], 'CANADA WATER': [90, 46],
};
// stations with genuine step-free access (roughly true to life):
// their lifts never break and their escalators all run your way
const STEP_FREE = new Set([
  'LONDON BRIDGE', 'BERMONDSEY', 'CANADA WATER', 'SOUTHWARK',
  'LIVERPOOL STREET', 'MOORGATE', 'WATERLOO', 'BOROUGH',
]);

// the scattered flock, in rescue order (first hop is a gentle same-line trip)
const LOST = [
  { sp: 'bluetit', name: 'TITCH', at: "ST PAUL'S" },
  { sp: 'wren', name: 'JENNY', at: 'BOROUGH' },
  { sp: 'blackbird', name: 'BRAM', at: 'CANADA WATER' },
  { sp: 'robin', name: 'PECK', at: 'HOLBORN' },
  { sp: 'bluetit', name: 'PIP', at: 'ELEPHANT & CASTLE' },
  { sp: 'wren', name: 'WINK', at: 'MOORGATE' },
  { sp: 'blackbird', name: 'COCO', at: 'WATERLOO' },
  { sp: 'robin', name: 'ROBERTA', at: 'CHANCERY LANE' },
];

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
      { t: 'commuter', c: 5, floor: 10, d: -1, v: 1 },
      { t: 'commuter', c: 16, floor: 2, d: -1, v: 2 },
    ],
    bystanders: [[3, 13, 1], [15, 13, 2], [9, 2, 0]],
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
      { t: 'commuter', c: 14, floor: 4, d: 1, v: 0 },
      { t: 'commuter', c: 7, floor: 14, d: 1, v: 1 },
    ],
    bystanders: [[6, 13, 0], [14, 13, 1], [12, 4, 2]],
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
      { t: 'commuter', c: 9, floor: 6, d: 1, v: 1 },
      { t: 'commuter', c: 12, floor: 14, d: -1, v: 2 },
    ],
    bystanders: [[7, 13, 0], [11, 6, 2]],
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
      { t: 'commuter', c: 12, floor: 9, d: 1, v: 0 },
      { t: 'commuter', c: 16, floor: 4, d: -1, v: 1 },
    ],
    bystanders: [[6, 13, 2], [16, 13, 0], [11, 9, 1]],
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
  'MOORGATE': 'modern3', 'WATERLOO': 'modern3',
};

export class TubeFlock {
  constructor(game) {
    this.g = game;
    this.hiscore = Number(localStorage.getItem('robbin.tube.hiscore') || 0);
  }
  start() {
    this.score = 0;
    this.time = 450;
    this.timeAcc = 0;
    this.over = false;
    this.travel = null;
    this.interior = null;
    this.arriveT = 0;
    this.arriveMsg = '';
    this.freeChange = null;
    this.roster = [{ sp: 'robin', name: 'ROBBIN' }];
    this.lostIdx = 0;
    this.cur = 'LIVERPOOL STREET';
    this.line = null;
    this.shuffleLifts();
    const [x, y] = this.toXY(this.cur);
    this.flock = [{ sp: 'robin', x, y, ph: 0 }];
  }
  get objective() { return LOST[this.lostIdx % LOST.length]; }
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
    if (this.over || this.travel || this.interior || Math.hypot(dx, dy) < 0.3) return;
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
    this.travel = { edge, ax, ay, bx, by, t: 0, dur: Math.max(0.55, Math.hypot(bx - ax, by - ay) / 260) };
    this.g.foley.whoosh();
  }
  handleJump() {
    if (this.over) { this.exit(); return; }
    // in an interior, jumping goes through the play input, not here
  }
  exit() {
    this.saveHi();
    this.g.state = 'title';
    document.getElementById('title').classList.remove('hidden');
  }
  // ---------------------------------------------------------- interiors
  enterInterior(pendingEdge, rescue) {
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
    g.updateCamera(0, true);
    g.foley.whoosh();
  }
  updateInterior(dt) {
    const g = this.g, it = this.interior, lv = it.level;
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
    // buddies flutter after their playing friend
    const t = performance.now() / 1000;
    it.buddies.forEach((b, i) => {
      const ox = Math.sin(t * 1.4 + b.ph) * (12 + i * 5) - 24 - i * 10;
      const oy = Math.cos(t * 1.8 + b.ph) * 8 - 26 - i * 4;
      const k = 1 - Math.exp(-dt * (5 - i * 0.5));
      b.x += (g.player.x + ox * (g.player.facing || 1) - b.x) * k;
      b.y += (g.player.y + oy - b.y) * k;
    });
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
    // the lost bird: reach it and it joins the flock
    if (it.rescue && !it.rescue.found) {
      if (Math.abs(px - it.rescue.x) < 24 && Math.abs(py - it.rescue.y) < 34) {
        it.rescue.found = true;
        this.roster.push({ sp: it.rescue.sp, name: it.rescue.name });
        it.buddies.push({ sp: it.rescue.sp, x: it.rescue.x, y: it.rescue.y - 20, ph: 9 });
        const [fx, fy] = this.toXY(this.cur);
        this.flock.push({ sp: it.rescue.sp, x: fx, y: fy, ph: this.flock.length * 1.7 });
        this.score += 400;
        this.time += 150;
        this.lostIdx++;
        this.arriveT = 2.4;
        this.arriveMsg = `${it.rescue.name} JOINS THE FLOCK! +400`;
        g.fx.push({ x: px, y: py - 60, txt: `${it.rescue.name}!`, t: 2 });
        g.foley.clear();
        this.saveHi();
      }
    }
    // bumped by a commuter: feathers, lost time, back to the entrance —
    // with a grace period and a shooed-away camper so it can't loop
    if (it.invulnT <= 0) {
      for (const e of it.enemies) {
        if (Math.abs(px - e.x) < 15 && py - 26 < e.y - 2 && e.y - 24 < py - 2) {
          this.time = Math.max(1, this.time - 12);
          g.puff(px, py - 10, 7);
          g.foley.death();
          g.player.reset();
          for (const e2 of it.enemies) {
            if (Math.hypot(e2.x - g.player.x, e2.y - g.player.y) < 140) e2.respawn();
          }
          g.updateCamera(0, true);
          it.invulnT = 1.1;
          break;
        }
      }
    }
    // the way out / onto the train
    const locked = it.rescue && !it.rescue.found;
    if (!locked) {
      const gx = it.gate.c * TILE + 16, gy = (it.gate.r + 1) * TILE;
      if (Math.abs(px - gx) < 22 && Math.abs(py - gy) < 36) {
        const edge = it.pendingEdge;
        this.interior = null;
        g.foley.clear();
        if (edge) this.depart(edge);
        else this.freeChange = this.cur;   // rescued and out — no second toll
      }
    }
  }
  // ---------------------------------------------------------- sim
  update(dt) {
    if (this.over) return;
    this.timeAcc += dt;
    while (this.timeAcc >= 0.25) {
      this.timeAcc -= 0.25;
      if (--this.time <= 0) {
        this.over = true;
        this.g.foley.death();
        this.saveHi();
        return;
      }
    }
    if (this.arriveT > 0) this.arriveT -= dt;
    if (this.interior) { this.updateInterior(dt); return; }
    if (this.travel) {
      this.travel.t += dt / this.travel.dur;
      if (this.travel.t >= 1) {
        this.cur = this.travel.edge.to;
        this.line = this.travel.edge.line;
        this.travel = null;
        this.g.foley.step();
        if (this.cur === this.objective.at) {
          this.enterInterior(null, this.objective);
          return;
        }
      }
    }
    // the flock trails the map cursor
    const t = performance.now() / 1000;
    let [lx, ly] = this.travel
      ? [this.travel.ax + (this.travel.bx - this.travel.ax) * this.travel.t,
         this.travel.ay + (this.travel.by - this.travel.ay) * this.travel.t]
      : this.toXY(this.cur);
    this.flock.forEach((b, i) => {
      const ox = Math.sin(t * 1.3 + b.ph) * (10 + i * 5) - i * 7;
      const oy = Math.cos(t * 1.7 + b.ph) * 7 - 14 - i * 3;
      const k = 1 - Math.exp(-dt * Math.max(2, 6 - i));
      b.x += (lx + ox - b.x) * k;
      b.y += (ly + oy - b.y) * k;
    });
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

    // objective card + meters
    const ob = this.objective;
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.fillText(`FIND ${ob.name} THE ${ob.sp.toUpperCase()}  ·  ${ob.at}`, w / 2, fs * 4.6);
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 12, fs * 1.6);
    ctx.fillText(`HI ${this.hiscore}`, 12, fs * 2.8);
    ctx.fillStyle = this.time <= 60 ? PALETTE.danger : PALETTE.ink;
    ctx.textAlign = 'right';
    ctx.fillText(`TIME ${this.time}`, w - 52, fs * 1.6);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(`FLOCK ${this.roster.length}`, w - 52, fs * 2.8);
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
      if (name === ob.at) {
        ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(t * 5) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.5; ctx.stroke();
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
    // the flock
    for (let i = this.flock.length - 1; i >= 0; i--) {
      const b = this.flock[i];
      const moving = !!this.travel;
      const facing = moving && this.travel.bx < this.travel.ax ? -1 : 1;
      drawBird(ctx, b.sp, {
        x: b.x, y: b.y, size: b.sp === 'wren' ? 26 : 32, facing,
        phase: t * 14 + b.ph,
        pose: moving ? (this.travel.by < this.travel.ay - 4 ? 'airup' : 'airdown') : 'flit',
      });
    }
    if (this.arriveT > 0) {
      ctx.fillStyle = PALETTE.platform;
      ctx.font = `bold ${fs * 1.2}px Georgia, serif`;
      ctx.fillText(this.arriveMsg, w / 2, h * 0.66);
    }
    if (this.over) this.drawOverPanel(ctx, fs);
    else {
      ctx.globalAlpha = 0.6;
      ctx.font = `${fs * 0.72}px Georgia, serif`;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText('swipe / arrows: ride a line · crossed box: lift out · ESC: leave', w / 2, h - fs);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  drawOverPanel(ctx, fs) {
    const w = this.g.cssW, h = this.g.cssH;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(38,34,30,0.87)';
    ctx.fillRect(0, h * 0.34, w, h * 0.32);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = `bold ${fs * 1.6}px Georgia, serif`;
    ctx.fillText('SERVICE TERMINATES HERE', w / 2, h * 0.45);
    ctx.font = `${fs}px Georgia, serif`;
    ctx.fillText(`flock of ${this.roster.length} · SCORE ${this.score} · HI ${this.hiscore}`, w / 2, h * 0.52);
    ctx.globalAlpha = 0.4 + 0.6 * (Math.sin(t * 6) > 0 ? 1 : 0.2);
    ctx.fillText('PRESS JUMP / TAP TO FLY HOME', w / 2, h * 0.6);
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
        x: b.x, y: b.y, size: b.sp === 'wren' ? 26 : 32,
        facing: g.player.facing || 1, phase: t * 14 + b.ph, pose: 'flit',
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
      ? (it.rescue.found ? `${it.rescue.name} aboard — find the WAY OUT` : `find ${it.rescue.name} the ${it.rescue.sp}`)
      : `change to the ${it.pendingEdge.line.toUpperCase()} line`;
    ctx.fillText(`${this.cur} — ${doing}`, w / 2, fs * 1.25);
    ctx.font = `italic ${fs * 0.72}px Georgia, serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(`${it.def.depths} · you are ${it.playing.name} the ${it.playing.sp}`, w / 2, fs * 2.3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.font = `bold ${fs * 0.85}px Georgia, serif`;
    ctx.fillStyle = this.time <= 60 ? PALETTE.danger : PALETTE.ink;
    ctx.fillText(`TIME ${this.time}`, 10, fs * 1.25);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(`FLOCK ${this.roster.length}`, 10, fs * 2.3);
    ctx.restore();
    if (this.over) this.drawOverPanel(ctx, fs);
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
      // a stylised carriage waiting at the platform
      ctx.save();
      ctx.globalAlpha = locked ? 0.5 : 1;
      ctx.fillStyle = lineColor;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      const bx = gx - 128, by = gy - 46, bw = 152, bh = 44;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 9);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dfe6ea';
      for (let wx = bx + 10; wx < gx - 26; wx += 26) ctx.fillRect(wx, by + 8, 18, 14);
      // open doorway aligned with the gate
      ctx.fillStyle = 'rgba(38,34,30,0.8)';
      ctx.fillRect(gx - 11, by + 6, 22, bh - 8);
      ctx.fillStyle = '#f6d34c';
      ctx.beginPath(); ctx.arc(bx + 4, by + bh - 10, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
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
