// robbin-tube.js — TUBE FLOCK: the libbirds ride the Underground.
// A curated, real-geography slice of the network (Central / Northern /
// Jubilee around Bank and London Bridge) drawn in the game's lino style.
// The flock sits at a station with a journey in mind — swipe/arrow along a
// line to travel. Changing lines at an interchange whose lift is out means
// the ESCALATOR: flutter up faster than it carries you down.

import { PALETTE, drawBird, drawGrain } from './robbin-sprites.js';
import { Level, Player, Enemy, TILE, W, H, LIFT_V } from './robbin-game.js';

// ------------------------------------------------------- station interiors
// Changing lines at an interchange drops you INTO the station: a full-screen
// platformer cut, with the depths London stations really have — street,
// ticket hall, (concourse,) platforms — joined by fallible lifts and
// escalators. 'S' = escalator (helps one way, resists the other; one is
// usually running against you), 'L' = lift (out of order when the map says
// the station's lift is out), 'H' = stairs, 'X' = the departure platform.
const INTERIORS = {
  'BANK': {
    depths: 'street · ticket hall · concourse · platforms',
    map: [
      '....................',
      '.E..................',
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
    enemies: [
      { t: 'blackbird', c: 10, floor: 6, d: 1 },
      { t: 'bluetit', c: 5, floor: 10, d: -1 },
    ],
  },
  'LONDON BRIDGE': {
    depths: 'street · concourse · platforms',
    map: [
      '....................',
      '....................',
      '....................',
      '..E.....E...........',
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
    enemies: [
      { t: 'wren', c: 12, floor: 9, d: -1 },
      { t: 'blackbird', c: 14, floor: 4, d: 1 },
    ],
  },
};

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
// journeys that make you change lines; the first is the canonical one
const JOURNEYS = [
  ['LIVERPOOL STREET', 'BERMONDSEY'],
  ['HOLBORN', 'BOROUGH'],
  ['CANADA WATER', "ST PAUL'S"],
  ['ELEPHANT & CASTLE', 'MOORGATE'],
  ['WATERLOO', 'LIVERPOOL STREET'],
  ['BERMONDSEY', 'CHANCERY LANE'],
  ['MOORGATE', 'SOUTHWARK'],
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
const FLOCK = ['robin', 'bluetit', 'blackbird', 'wren'];

export class TubeFlock {
  constructor(game) {
    this.g = game;
    this.hiscore = Number(localStorage.getItem('robbin.tube.hiscore') || 0);
  }
  start() {
    this.score = 0;
    this.journeys = 0;
    this.time = 300;
    this.timeAcc = 0;
    this.over = false;
    this.travel = null;
    this.escalator = null;
    this.interior = null;
    this.arriveT = 0;
    this.journey = [...JOURNEYS[0]];        // the canonical first trip
    this.cur = this.journey[0];
    this.line = null;
    this.shuffleLifts();
    const [x, y] = this.toXY(this.cur);
    this.flock = FLOCK.map((n, i) => ({ n, x, y, ph: i * 1.7 }));
  }
  shuffleLifts() {
    // which interchanges have their lift out (escalator territory)
    this.liftOut = new Set(INTERCHANGES.filter(() => Math.random() < 0.55));
    if (this.journeys > 0 && this.liftOut.size === 0) this.liftOut.add(INTERCHANGES[0]);
  }
  newJourney(from) {
    let dest = JOURNEYS[this.journeys % JOURNEYS.length][1];
    if (dest === from) dest = from === 'BANK' ? "ST PAUL'S" : 'BANK';
    this.journey = [from, dest];
    this.shuffleLifts();
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
    if (this.over || this.travel || this.escalator || Math.hypot(dx, dy) < 0.3) return;
    const [cx, cy] = this.toXY(this.cur);
    let best = null;
    for (const e of EDGES.get(this.cur)) {
      const [tx, ty] = this.toXY(e.to);
      const vx = tx - cx, vy = ty - cy, len = Math.hypot(vx, vy);
      const dot = (vx * dx + vy * dy) / (len * Math.hypot(dx, dy));
      if (dot > 0.45 && (!best || dot > best.dot)) best = { ...e, dot };
    }
    if (!best) return;
    // changing lines at an interchange? into the station itself
    if (this.line && best.line !== this.line && INTERIORS[this.cur]) {
      this.enterInterior(best);
      return;
    }
    // (fallback for interchanges without a built interior: the mash-up bar)
    if (this.line && best.line !== this.line && this.liftOut.has(this.cur)) {
      this.escalator = { p: 0.4, pending: best };
      this.g.foley.grain();
      return;
    }
    this.depart(best);
  }
  // ------------------------------------------------- station interior
  enterInterior(pendingEdge) {
    const g = this.g;
    const def = INTERIORS[this.cur];
    const level = new Level({ name: this.cur, map: def.map, time: 0, enemies: [] }, 0);
    // fallibility: the station's lift state comes from the map layer;
    // one random escalator runs against you
    if (level.lift) {
      level.lift.out = this.liftOut.has(this.cur);
      if (level.lift.out) level.lift.paddles = [];
    }
    const escCols = [...level.escCols.keys()];
    if (escCols.length) {
      const against = escCols[Math.floor(Math.random() * escCols.length)];
      level.escCols.set(against, 1);   // running down — flutter hard
    }
    let gate = { c: 19, r: 13 };
    def.map.forEach((row, r) => {
      const c = row.indexOf('X');
      if (c >= 0) gate = { c, r };
    });
    this.interior = {
      def, level, pendingEdge, gate,
      enemies: def.enemies.map(e => new Enemy(level, e)),
    };
    // hand the world to the shared engine: camera + renderer follow these
    g.level = level;
    g.player = new Player(level);
    g.screen = { def: { name: this.cur }, enemies: this.interior.enemies, cleared: false };
    g.fx = []; g.parts = [];
    g.updateCamera(0, true);
    g.foley.whoosh();
  }
  updateInterior(dt) {
    const g = this.g, it = this.interior, lv = it.level;
    // lift paddles run unless the lift is out
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
    // bumped by a commuter bird: feathers, lost time, back to the entrance
    for (const e of it.enemies) {
      if (Math.abs(px - e.x) < 15 && py - 26 < e.y - 2 && e.y - 24 < py - 2) {
        this.time = Math.max(1, this.time - 12);
        g.puff(px, py - 10, 7);
        g.foley.death();
        g.player.reset();
        g.updateCamera(0, true);
        break;
      }
    }
    // reached the departure platform
    const gx = it.gate.c * TILE + 16, gy = (it.gate.r + 1) * TILE;
    if (Math.abs(px - gx) < 22 && Math.abs(py - gy) < 36) {
      const edge = it.pendingEdge;
      this.interior = null;
      g.foley.clear();
      this.depart(edge);
    }
  }
  depart(edge) {
    const [ax, ay] = this.toXY(this.cur);
    const [bx, by] = this.toXY(edge.to);
    this.travel = { edge, ax, ay, bx, by, t: 0, dur: Math.max(0.55, Math.hypot(bx - ax, by - ay) / 260) };
    this.g.foley.whoosh();
  }
  handleJump() {
    if (this.over) { this.exit(); return; }
    if (this.interior) return;   // jumping in the interior goes through play input
    if (this.escalator) {
      this.escalator.p += 0.14;
      this.g.foley.step();
      if (this.escalator.p >= 1) {
        const e = this.escalator.pending;
        this.escalator = null;
        this.g.foley.clear();
        this.depart(e);
      }
    }
  }
  exit() {
    this.g.state = 'title';
    document.getElementById('title').classList.remove('hidden');
  }
  // ---------------------------------------------------------- sim
  update(dt) {
    if (this.over) return;
    // clock — the service won't run all night
    this.timeAcc += dt;
    while (this.timeAcc >= 0.25) {
      this.timeAcc -= 0.25;
      if (--this.time <= 0) {
        this.over = true;
        this.g.foley.death();
        if (this.score > this.hiscore) {
          this.hiscore = this.score;
          localStorage.setItem('robbin.tube.hiscore', String(this.hiscore));
        }
        return;
      }
    }
    if (this.arriveT > 0) this.arriveT -= dt;
    if (this.interior) { this.updateInterior(dt); return; }
    if (this.escalator) {
      this.escalator.p -= dt * 0.3;
      if (this.escalator.p <= 0) {          // carried back down — tumble, try again
        this.escalator.p = 0.4;
        this.time = Math.max(1, this.time - 25);
        this.g.puff(...this.toXY(this.cur), 6);
        this.g.foley.death();
      }
    }
    if (this.travel) {
      this.travel.t += dt / this.travel.dur;
      if (this.travel.t >= 1) {
        this.cur = this.travel.edge.to;
        this.line = this.travel.edge.line;
        this.travel = null;
        this.g.foley.step();
        if (this.cur === this.journey[1]) {
          this.score += 500 + this.time;
          this.journeys++;
          this.time += 90;
          this.arriveT = 2.2;
          this.g.foley.clear();
          this.newJourney(this.cur);
          if (this.score > this.hiscore) {
            this.hiscore = this.score;
            localStorage.setItem('robbin.tube.hiscore', String(this.hiscore));
          }
        }
      }
    }
    // the flock trails the leader point
    const t = performance.now() / 1000;
    let [lx, ly] = this.travel
      ? [this.travel.ax + (this.travel.bx - this.travel.ax) * this.travel.t,
         this.travel.ay + (this.travel.by - this.travel.ay) * this.travel.t]
      : this.toXY(this.cur);
    this.flock.forEach((b, i) => {
      const ox = Math.sin(t * 1.3 + b.ph) * (10 + i * 6) - i * 8;
      const oy = Math.cos(t * 1.7 + b.ph) * 7 - 14 - i * 3;
      const k = 1 - Math.exp(-dt * (6 - i));
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
    ctx.fillText('the libbirds ride the Underground — mind the lifts', w / 2, fs * 3.1);
    ctx.globalAlpha = 1;

    // journey card + meters
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.fillText(`${this.journey[0]}  →  ${this.journey[1]}`, w / 2, fs * 4.6);
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${this.score}`, 12, fs * 1.6);
    ctx.fillText(`HI ${this.hiscore}`, 12, fs * 2.8);
    ctx.fillStyle = this.time <= 60 ? PALETTE.danger : PALETTE.ink;
    ctx.textAlign = 'right';
    ctx.fillText(`TIME ${this.time}`, w - 52, fs * 1.6);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(`TRIPS ${this.journeys}`, w - 52, fs * 2.8);
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
      if (name === this.journey[1]) {
        ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(t * 5) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.fillStyle = PALETTE.ink;
      const above = POS[name][1] < 30;
      ctx.fillText(name, x, y + (above ? -16 : 26));
      if (this.liftOut.has(name)) {
        // lift-out glyph: little box, red cross
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
      drawBird(ctx, b.n, {
        x: b.x, y: b.y, size: b.n === 'wren' ? 26 : 32, facing,
        phase: t * 14 + b.ph,
        pose: moving ? (this.travel.by < this.travel.ay - 4 ? 'airup' : 'airdown') : 'flit',
      });
    }

    if (this.escalator) this.drawEscalator(ctx, fs);
    if (this.arriveT > 0) {
      ctx.fillStyle = PALETTE.platform;
      ctx.font = `bold ${fs * 1.3}px Georgia, serif`;
      ctx.fillText('JOURNEY COMPLETE! +500', w / 2, h * 0.62);
    }
    if (this.over) {
      ctx.fillStyle = 'rgba(38,34,30,0.85)';
      ctx.fillRect(0, h * 0.36, w, h * 0.3);
      ctx.fillStyle = PALETTE.paper;
      ctx.font = `bold ${fs * 1.6}px Georgia, serif`;
      ctx.fillText('SERVICE TERMINATES HERE', w / 2, h * 0.47);
      ctx.font = `${fs}px Georgia, serif`;
      ctx.fillText(`${this.journeys} journeys · SCORE ${this.score} · HI ${this.hiscore}`, w / 2, h * 0.53);
      ctx.globalAlpha = 0.4 + 0.6 * (Math.sin(t * 6) > 0 ? 1 : 0.2);
      ctx.fillText('PRESS JUMP / TAP TO FLY HOME', w / 2, h * 0.6);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.6;
      ctx.font = `${fs * 0.72}px Georgia, serif`;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText('swipe / arrows: ride a line · ESC: leave the network', w / 2, h - fs);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  drawInterior(ctx, fs) {
    const g = this.g, w = g.cssW;
    const it = this.interior;
    // gate sign, drawn in world space beneath the renderer's transform
    ctx.save();
    ctx.translate(g.offX, g.offY);
    ctx.scale(g.scale, g.scale);
    ctx.translate(-g.camX, -g.camY);
    const gx = it.gate.c * TILE + 16, gy = (it.gate.r + 1) * TILE;
    const lineColor = LINES[it.pendingEdge.line].color;
    ctx.fillStyle = lineColor;
    ctx.fillRect(gx - 15, gy - 46, 30, 8);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(gx - 15, gy - 46, 30, 8);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('TO TRAINS', gx, gy - 52);
    // chevron bouncing over the gate
    ctx.beginPath();
    const by = gy - 26 + Math.sin(performance.now() / 180) * 3;
    ctx.moveTo(gx - 6, by); ctx.lineTo(gx + 6, by); ctx.lineTo(gx, by + 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    g.drawWorldPass(ctx);
    // interior HUD strip
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.9)';
    ctx.fillRect(0, 0, w, fs * 3);
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.beginPath(); ctx.moveTo(0, fs * 3); ctx.lineTo(w, fs * 3); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.fillText(`${this.cur} — change to the ${it.pendingEdge.line.toUpperCase()} line`, w / 2, fs * 1.25);
    ctx.font = `italic ${fs * 0.72}px Georgia, serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(`${it.def.depths} · find the way to TO TRAINS`, w / 2, fs * 2.3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.font = `bold ${fs * 0.85}px Georgia, serif`;
    ctx.fillStyle = this.time <= 60 ? PALETTE.danger : PALETTE.ink;
    ctx.fillText(`TIME ${this.time}`, 10, fs * 1.25);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(`SCORE ${this.score}`, 10, fs * 2.3);
    ctx.restore();
  }
  drawEscalator(ctx, fs) {
    const g = this.g, w = g.cssW, h = g.cssH;
    const t = performance.now() / 1000;
    const ex = w / 2, ey = h * 0.52, ew = Math.min(300, w * 0.6), eh = 120;
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.96)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.fillRect(ex - ew / 2, ey - eh / 2, ew, eh);
    ctx.strokeRect(ex - ew / 2, ey - eh / 2, ew, eh);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.fillText('LIFT OUT — ESCALATOR!', ex, ey - eh / 2 + fs * 1.3);
    ctx.font = `${fs * 0.72}px Georgia, serif`;
    ctx.fillText('mash JUMP to flutter up', ex, ey - eh / 2 + fs * 2.3);
    // the moving stair: diagonal band with sliding treads
    const x0 = ex - ew / 2 + 24, y0 = ey + eh / 2 - 16, x1 = ex + ew / 2 - 24, y1 = ey - 4;
    ctx.strokeStyle = PALETTE.ladder;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    const slide = (t * 40) % 20;   // treads glide DOWN the stair
    for (let d = -slide; d < Math.hypot(x1 - x0, y1 - y0); d += 20) {
      if (d < 0) continue;
      const k = d / Math.hypot(x1 - x0, y1 - y0);
      const tx = x0 + (x1 - x0) * k, ty = y0 + (y1 - y0) * k;
      ctx.beginPath(); ctx.moveTo(tx - 4, ty + 6); ctx.lineTo(tx + 4, ty + 2); ctx.stroke();
    }
    const p = this.escalator.p;
    drawBird(ctx, 'robin', {
      x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p - 4,
      size: 34, facing: 1, phase: t * 26, pose: 'airup',
    });
    ctx.restore();
  }
}
