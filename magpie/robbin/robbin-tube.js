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

import { PALETTE, drawBird, drawGrain, drawCommuter, drawBirdSkeleton, drawCommuterSkeleton } from './robbin-sprites.js';
import { Level, Player, Enemy, TILE, W, H, LIFT_V } from './robbin-game.js';
import { NETWORK } from './tube-network.js';
import { STATION_FACTS } from './robbin-facts.js';
import { STATION_LEVELS } from './tube-levels.js';

// the whole London Underground, baked from the TfL Unified API by
// tools/fetch-tube.mjs (plus the Windrush segment) — real geography,
// projected; the map wears a camera now instead of fitting one screen
const LINES = NETWORK.lines;
const POS = NETWORK.pos;
// stations with genuine step-free access (curated, roughly true to life):
// their lifts never break and their escalators all run your way — unless
// TfL's own lift-disruption feed said otherwise on the day of the bake
const STEP_FREE = new Set(NETWORK.stepFree);
// the whole city in design units — the far edge of the zoom-out
const BOUNDS = (() => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of Object.values(POS)) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
})();

// the scattered flock, in rescue order (first hop is a gentle same-line
// trip). Every bird has a little story; every rescue is a small reunion.
const LOST = [
  { sp: 'bluetit', name: 'TITCH', at: "ST PAUL'S", note: 'lost near the ticket gates' },
  { sp: 'wren', name: 'JENNY', at: 'BOROUGH', note: 'lonely down at the platforms' },
  { sp: 'blackbird', name: 'MAUD', at: 'LONDON BRIDGE', note: 'going round in circles on level −2' },
  { sp: 'blackbird', name: 'BRAM', at: 'CANADA WATER', note: 'singing to nobody at level −2' },
  { sp: 'wren', name: 'PERCH', at: 'ROTHERHITHE', note: 'listening to the river through the wall' },
  { sp: 'bluetit', name: 'SKY', at: 'CANARY WHARF', note: 'feeling small in the big station' },
  { sp: 'robin', name: 'PECK', at: 'HOLBORN', note: 'waiting where the lifts never came' },
  { sp: 'bluetit', name: 'PIP', at: 'ELEPHANT & CASTLE', note: 'napping by the deep stairs' },
  { sp: 'wren', name: 'MOSS', at: 'WATERLOO', note: 'lost on level −3' },
  { sp: 'wren', name: 'WINK', at: 'MOORGATE', note: 'hiding behind the adverts' },
  { sp: 'robin', name: 'RUSTY', at: 'CHANCERY LANE', note: 'moping on the middle level' },
  { sp: 'blackbird', name: 'COCO', at: 'SOUTHWARK', note: 'humming along with the escalators' },
  { sp: 'bluetit', name: 'QUAY', at: 'SURREY QUAYS', note: 'singing along with the tannoy' },
  { sp: 'robin', name: 'ROBERTA', at: 'BERMONDSEY', note: 'watching the trains go by' },
  // …and then the grand tour: the flock ranges out across the whole map
  { sp: 'blackbird', name: 'SOOT', at: "KING'S CROSS ST PANCRAS", note: 'dodging feet in the great hall' },
  { sp: 'robin', name: 'BERRY', at: 'WALTHAMSTOW CENTRAL', note: 'up the Victoria line, far from home' },
  { sp: 'bluetit', name: 'SPECK', at: 'NORTH GREENWICH', note: 'small and blue under the big dome' },
  { sp: 'blackbird', name: 'FLINT', at: 'STRATFORD', note: 'singing over the announcements' },
  { sp: 'wren', name: 'TWIG', at: 'EALING BROADWAY', note: 'watching the District trains turn back' },
  { sp: 'robin', name: 'HOLLY', at: 'HEATHROW TERMINAL 5', note: 'watching the big silver birds take off' },
  { sp: 'blackbird', name: 'JET', at: 'MORDEN', note: 'at the very end of the Northern line' },
  { sp: 'bluetit', name: 'DOT', at: 'AMERSHAM', note: 'right out where the Metropolitan gets leafy' },
];
const BIRD_PX = { wren: 26, bluetit: 32, robin: 32, blackbird: 32 };

// build the graph: station -> [{to, line}] from every line's chains
// (branches are separate chains; duplicate edges collapse to one).
// Not every line is a pair of tracks in opposite directions — one-way
// stretches (the Heathrow T4 loop) only get their served direction.
const EDGES = new Map(Object.keys(POS).map(s => [s, []]));
for (const [line, def] of Object.entries(LINES)) {
  const ow = new Map((def.oneWay || []).map(([f, t]) => [`${f}|${t}`, true]));
  const oneWayOnly = (a, b) => ow.has(`${a}|${b}`) || ow.has(`${b}|${a}`);
  const allowed = (a, b) => !oneWayOnly(a, b) || ow.has(`${a}|${b}`);
  for (const chain of def.chains) {
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i], b = chain[i + 1];
      if (a === b) continue;
      for (const [f, t] of [[a, b], [b, a]]) {
        if (!allowed(f, t)) continue;
        if (!EDGES.get(f).some(e => e.to === t && e.line === line)) {
          EDGES.get(f).push({ to: t, line });
        }
      }
    }
  }
}
const LINES_AT = new Map(Object.keys(POS).map(s => [s, new Set(EDGES.get(s).map(e => e.line))]));
const INTERCHANGES = Object.keys(POS).filter(s => LINES_AT.get(s).size > 1);
const INTER_SET = new Set(INTERCHANGES);
// which lines share each stretch of track — parallel lines draw offset
// side by side, tube-map fashion, instead of on top of each other
const EDGE_LINES = new Map();
for (const [line, def] of Object.entries(LINES)) {
  for (const chain of def.chains) {
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = chain[i], b = chain[i + 1];
      if (a === b) continue;
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const list = EDGE_LINES.get(k) || [];
      if (!list.includes(line)) { list.push(line); EDGE_LINES.set(k, list); }
    }
  }
}
for (const list of EDGE_LINES.values()) list.sort();

// ------------------------------------------------------- station interiors
// Every interior is GENERATED from the station's real facts baked into
// tube-network.js: which lines serve it (deep tube vs cut-and-cover vs
// open-air, weighted by fare zone) and TfL's own lift and escalator
// counts. Levels, platforms, stairs, escalator banks and lift shafts all
// follow from that — a reality-grounded model, playability-clamped.
// Legend: '#' floor · '+' floor pierced by a run · 'S' escalator ·
// 'H' stairs · 'L' lift shaft · 'E' grain · 'P' spawn.
const DEEP_LINES = new Set(['bakerloo', 'central', 'jubilee', 'northern', 'piccadilly', 'victoria', 'waterloo-city']);
const SUB_LINES = new Set(['circle', 'district', 'hammersmith-city', 'metropolitan', 'windrush']);
const LINE_SHORT = {
  bakerloo: 'Bakerloo', central: 'Central', circle: 'Circle', district: 'District',
  'hammersmith-city': 'H&C', jubilee: 'Jubilee', metropolitan: 'Met', northern: 'Northern',
  piccadilly: 'Piccadilly', victoria: 'Victoria', 'waterloo-city': 'W&C', windrush: 'Windrush',
  dlr: 'DLR',
};
const hashName = s => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const GEN_CACHE = new Map();
function genStation(name) {
  if (GEN_CACHE.has(name)) return GEN_CACHE.get(name);
  const facts = NETWORK.stations?.[name] || { zone: 2, lifts: 1, escalators: 2, lines: [], deep: 1, sub: 0 };
  let rng = hashName(name) || 1;
  const rnd = n => { rng = (rng * 1103515245 + 12345) >>> 0; return (rng >>> 8) % n; };
  const lineList = facts.lines || [];
  const deepL = lineList.filter(l => DEEP_LINES.has(l));
  const subL = lineList.filter(l => SUB_LINES.has(l));
  const short = ls => ls.map(l => LINE_SHORT[l] || l).join(' & ');

  // ---- the cross-section: which levels exist here, really
  let floors, levels, plats;   // plats: platform levels, each with its lines
  // Levels are numbered the way TfL numbers its own stations \u2014 street
  // is 0, storeys count down \u2014 and where TfL's own data speaks, we use
  // its REAL numbers and depths: FOI-0493-2223 platform depths and the
  // step-free topology feed's storey numbers, baked into tube-levels.js
  // (Hampstead platforms \u22124 and 58 m down; Bank's Northern at \u22125).
  // Stations the data misses fall back to a principled synthesis.
  const real = STATION_LEVELS[name] || { lines: {} };
  const groupLevel = (ls, fb) => {
    const vals = ls.map(l => real.lines[l]?.level).filter(v => v !== undefined);
    return vals.length ? Math.min(...vals) : fb;
  };
  const groupDepth = (ls) => {
    const vals = ls.map(l => real.lines[l]?.depth).filter(v => v !== undefined);
    return vals.length ? Math.max(...vals) : null;
  };
  const lvlTag = n => (n > 0 ? `+${n}` : n === 0 ? '0' : `−${-n}`);
  const platLabel = (ls, fb) => {
    const lv = groupLevel(ls, fb), dp = groupDepth(ls);
    const dpTxt = dp !== null && dp >= 1.5 ? ` \u00b7 ${Math.round(dp)} m`
      : dp !== null && dp <= -1.5 ? ` \u00b7 ${Math.round(-dp)} m up` : '';
    return { lv, label: `${lvlTag(lv)} \u00b7 ${short(ls) || 'platforms'}${dpTxt}` };
  };
  const ticketLv = real.ticket ?? -1;
  // a deep station's middle landing is a concourse when it sits well
  // below the street-level ticket hall (Hampstead's is at \u22123)
  const midLabel = lv => `${lvlTag(lv)} \u00b7 ${lv <= -2 ? 'concourse' : 'ticket hall'}`;
  // TfL's measured depths override the line-type guess: a "deep-line"
  // station whose platforms sit at or above the street (East Acton on
  // its embankment, Stratford) is really an open-air station
  const maxDepth = groupDepth(lineList);
  const atGrade = maxDepth !== null && maxDepth <= 1.5;
  if (!atGrade && facts.deep && facts.sub) {
    const pSub = platLabel(subL, -2), pDeep = platLabel(deepL, Math.min(pSub.lv - 1, -3));
    floors = [2, 6, 10, 14];
    levels = ['0 \u00b7 street', midLabel(ticketLv), pSub.label, pDeep.label];
    plats = [{ row: 10, lines: subL }, { row: 14, lines: deepL }];
  } else if (!atGrade && facts.deep && deepL.length >= 2 && facts.zone === 1) {
    // two deep lines really do run at different depths (Bank, Oxford
    // Circus) \u2014 the deeper one, by TfL's figures, takes the lower floor
    const byDepth = [...deepL].sort((a, b) =>
      (real.lines[a]?.depth ?? 12) - (real.lines[b]?.depth ?? 12));
    const g0 = byDepth.slice(0, -1), g1 = [byDepth[byDepth.length - 1]];
    const p0 = platLabel(g0, -2), p1 = platLabel(g1, Math.min(p0.lv - 1, -3));
    floors = [2, 6, 10, 14];
    levels = ['0 \u00b7 street', midLabel(ticketLv), p0.label, p1.label];
    plats = [{ row: 10, lines: g0 }, { row: 14, lines: g1 }];
  } else if (!atGrade && facts.deep) {
    const mid = real.concourse ?? ticketLv;
    const p = platLabel(deepL, Math.min(mid - 1, -2));
    floors = [4, 9, 14];
    levels = ['0 \u00b7 street', midLabel(mid), p.label];
    plats = [{ row: 14, lines: deepL }];
  } else if (!atGrade && facts.sub) {
    const p = platLabel(subL, -2);
    floors = [4, 9, 14];
    levels = ['0 \u00b7 street', midLabel(ticketLv), p.label];
    plats = [{ row: 14, lines: subL }];
  } else {
    // open-air suburbia: platforms at ground with a footbridge over the
    // tracks \u2014 unless TfL says they ride a viaduct, in which case the
    // whole station steps UP (Greenford's platforms are 10 m in the air)
    const dp = groupDepth(lineList);
    const up = groupLevel(lineList, 0) >= 1 || (dp ?? 0) <= -1.5;
    const platLv = up ? Math.max(1, groupLevel(lineList, 1)) : 0;
    const upTxt = up && dp !== null && dp <= -1.5 ? ` \u00b7 ${Math.round(-dp)} m up` : '';
    floors = [8, 14];
    levels = [
      `${lvlTag(platLv + 1)} \u00b7 footbridge`,
      up ? `${lvlTag(platLv)} \u00b7 ${short(lineList) || 'the'} platforms${upTxt}`
         : `0 \u00b7 street \u00b7 ${short(lineList) || 'the'} platforms`,
    ];
    plats = [{ row: 14, lines: lineList }];
  }
  const surface = atGrade || (!facts.deep && !facts.sub);
  const streetRow = surface ? 14 : floors[0];
  const bottom = 14;

  // ---- the grid
  const grid = Array.from({ length: 15 }, () => new Array(20).fill('.'));
  for (const fr of floors) for (let c = 0; c < 20; c++) grid[fr][c] = '#';
  const used = new Array(20).fill(false);
  // gate margins stay clear — including a buffer column, so nobody steps
  // off a lift straight out of the station
  used[0] = used[1] = used[2] = used[17] = used[18] = used[19] = true;
  const alloc = (w, pad = 0) => {
    const startC = 2 + rnd(16 - w);
    for (let k = 0; k <= 16 - w; k++) {
      const c = 2 + ((startC - 2 + k) % (16 - w + 1));
      let ok = true;
      for (let i = c - pad; i < c + w + pad; i++) if (i >= 2 && i <= 17 && used[i]) ok = false;
      if (ok) { for (let i = c; i < c + w; i++) used[i] = true; return c; }
    }
    return null;
  };
  // lift shafts from TfL's REAL lift graph where the feed knows it
  // (Canada Water: A street↔ticket hall, B down to the Jubilee calling
  // at the Windrush level, C to the Windrush level only — the on-site
  // Lift guide as data; letters follow the boards' street-first order).
  // The count heuristic covers stations the feed is silent about.
  const levelNums = levels.map(s => parseInt(s.replace('−', '-'), 10));
  const rowOfLevel = {};
  levelNums.forEach((lv, i) => { if (!(lv in rowOfLevel)) rowOfLevel[lv] = floors[i]; });
  let shaftPlans = [];
  if (real.liftGraph) {
    const seen = new Set();
    for (const lg of real.liftGraph) {
      const stops = [...new Set(lg.map(lv => rowOfLevel[lv]).filter(r => r !== undefined))].sort((a, b) => a - b);
      if (stops.length < 2) continue;
      const k = stops.join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      shaftPlans.push(stops);
      if (shaftPlans.length >= 3) break;
    }
  }
  if (!shaftPlans.length && facts.lifts && floors.length >= 2) {
    shaftPlans = facts.lifts >= 3 && floors.length >= 3
      ? [[floors[0], floors[1]], floors.slice(1)]
      : [[...floors]];
  }
  const shaftDefs = [];   // in LETTER order: A, B, C…
  for (const stops of shaftPlans) {
    const c = alloc(2, 1);
    if (c === null) continue;
    for (let r = stops[0]; r < stops[stops.length - 1]; r++) { grid[r][c] = 'L'; grid[r][c + 1] = 'L'; }
    shaftDefs.push({ c, stops });
  }
  // escalator banks are SLOPED runs now — 45° diagonals zigzagging down
  // the cross-section the way deep stations really stack them. Travel
  // direction is fixed per run: an up escalator boards at its bottom
  // end, a down escalator at its top. TfL's count still sets how many.
  const escRuns = [];
  {
    const gaps = floors.slice(0, -1).map((fr, i) => [fr, floors[i + 1]]);
    let escBudget = Math.min(Math.ceil((facts.escalators || 0) / 2), gaps.length * 2);
    const gapOrder = [...gaps].reverse();
    let zig = rnd(2) === 0;
    for (let round = 0; round < 2 && escBudget > 0; round++) {
      let placed = 0;
      for (const [top, bot] of gapOrder) {
        if (escBudget <= 0) break;
        const span = bot - top;              // rows of drop
        // 45° when there's room, steeper (real escalators are) when not
        let c = null, reach = span;
        for (const w of [span, Math.ceil(span / 2)]) {
          c = alloc(w + 1, 0);
          if (c !== null) { reach = w; break; }
        }
        if (c === null) continue;            // this gap is full; try the next
        const leftTop = zig;                 // slopes alternate: the zigzag
        zig = !zig;
        escRuns.push({
          xTop: (leftTop ? c : c + reach) * TILE + 16, yTop: top * TILE,
          xBot: (leftTop ? c + reach : c) * TILE + 16, yBot: bot * TILE,
          up: round === 0,                   // first bank rises, second descends
        });
        escBudget--;
        placed++;
      }
      if (!placed) break;
    }
  }
  // one honest staircase runs the whole way down — stairs never fail
  const stairC = alloc(1) ?? 16;
  for (let r = floors[0]; r < bottom; r++) grid[r][stairC] = floors.includes(r) ? '+' : 'H';
  // gates: a WAY OUT to daylight, and a door at EACH END of every
  // platform level. The doors ARE the network: the west end of a
  // platform holds the westbound track's real departures, the east end
  // the eastbound — fixed by London's geometry, never by whatever
  // errand the flock happens to be on. Learn the doors, learn London.
  // (Open-air stations exit over the footbridge, clear of the tracks.)
  const sideL = rnd(2) === 0;
  const gateOut = { c: sideL ? 1 : 18, r: (surface ? floors[0] : streetRow) - 1 };
  const platLevel = {};
  const platDefs = [];
  for (const p of plats) {
    const doors = { L: { c: 1, r: p.row - 1, edges: [] }, R: { c: 18, r: p.row - 1, edges: [] } };
    for (const e of EDGES.get(name) || []) {
      if (!p.lines.includes(e.line)) continue;
      const dx = POS[e.to][0] - POS[name][0], dy = POS[e.to][1] - POS[name][1];
      const west = dx < 0 || (dx === 0 && dy < 0);
      doors[west ? 'L' : 'R'].edges.push(e);
    }
    for (const d of Object.values(doors)) d.edges.sort((a, b) => (a.to < b.to ? -1 : 1));
    if (!doors.L.edges.length) delete doors.L;   // a terminus keeps one door
    if (!doors.R.edges.length) delete doors.R;
    platDefs.push({ row: p.row, lines: p.lines, doors });
    for (const l of p.lines) platLevel[l] = p.row;
  }
  // spawn: you walk in from the street (arrivals override at the platform)
  const spawnStreet = { c: sideL ? 3 : 16, r: streetRow - 1 };
  if (grid[spawnStreet.r][spawnStreet.c] === '.') grid[spawnStreet.r][spawnStreet.c] = 'P';
  // the lost bird perches somewhere below street level
  const perchFloors = floors.length > 2 ? floors.slice(1) : floors;
  const perchRow = perchFloors[rnd(perchFloors.length)];
  let perchC = 2 + rnd(16);
  for (let k = 0; k < 24 && grid[perchRow - 1][perchC] !== '.'; k++) perchC = 2 + rnd(16);
  const perch = { c: perchC, r: perchRow - 1 };
  // grain
  for (let n = 3 + rnd(3), k = 0; n > 0 && k < 40; k++) {
    const fr = floors[rnd(floors.length)], c = 2 + rnd(16);
    if (grid[fr - 1][c] === '.') { grid[fr - 1][c] = 'E'; n--; }
  }
  // ---- dressing, seeded per station
  const freeCol = fr => {
    for (let k = 0; k < 30; k++) {
      const c = 2 + rnd(16);
      const ch = grid[fr - 1][c];
      if (ch === '.' || ch === 'E') return c;
    }
    return 2 + rnd(16);
  };
  const ads = [], bystanders = [], signs = [], helps = [];
  for (let i = 0, n = 3 + rnd(2); i < n; i++) {
    const fr = floors[rnd(floors.length)];
    ads.push([freeCol(fr), fr]);
  }
  for (const p of platDefs) signs.push([4 + rnd(12), p.row]);
  for (let i = 0, n = 2 + rnd(2); i < n; i++) {
    const fr = floors[rnd(floors.length)];
    bystanders.push([freeCol(fr), fr, rnd(20)]);
  }
  helps.push([freeCol(bottom), bottom]);
  // Lift guides and notice boards live on circulation floors, never on
  // platforms — a board over a waiting train helps nobody
  const platRows = plats.map(p => p.row);
  const guides = shaftDefs.slice(0, 1).map(sd => {
    const rows = sd.stops.filter(r => !platRows.includes(r));
    const row = rows.length ? rows[rows.length - 1] : sd.stops[0];
    return [Math.max(2, Math.min(17, sd.c - 3)), row];
  });
  if (!guides.length) guides.push([freeCol(floors[Math.min(1, floors.length - 1)]), floors[Math.min(1, floors.length - 1)]]);
  const boardRow = [...floors].reverse().find(r => !platRows.includes(r)) ?? floors[0];
  const board = [freeCol(boardRow), boardRow];
  const commuters = [];
  for (let i = 0, n = 2 + (floors.length > 2 ? 1 : 0); i < n; i++) {
    commuters.push({ t: 'commuter', c: 2 + rnd(16), floor: floors[rnd(floors.length)], d: rnd(2) ? 1 : -1, v: rnd(20) });
  }
  // a few stations hide a small lost thing — lost property, waiting for
  // a sharp-eyed bird. Roughly one station in three, seeded like the rest.
  let lostObject = null;
  if (rnd(3) === 0) {
    const kinds = ['glove', 'umbrella', 'teddy bear', 'scarf', 'library book', 'toy train'];
    const fr = floors[rnd(floors.length)];
    let c = freeCol(fr);
    for (let k = 0; k < 20 && grid[fr - 1][c] !== '.'; k++) c = 2 + rnd(16);
    lostObject = { c, r: fr - 1, kind: kinds[rnd(kinds.length)] };
  }
  const def = {
    map: grid.map(r => r.join('')),
    commuters, bystanders, ads, signs, levels, levelNums, guides, helps, board,
    lostObject,
    streetRow, gateOut, platDefs, platLevel, spawnStreet, perch,
    shaftDefs, escRuns,
    underground: !surface,
    nLifts: shaftDefs.length,
  };
  GEN_CACHE.set(name, def);
  return def;
}

// the word on the platform: which way a door's train is FACING, in
// tube-map terms — the dominant axis of its next hop across the
// schematic. A statement about London, not route-planner advice.
function boundWord(from, to) {
  const dx = POS[to][0] - POS[from][0], dy = POS[to][1] - POS[from][1];
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx < 0 ? 'WESTBOUND' : 'EASTBOUND')
    : (dy < 0 ? 'NORTHBOUND' : 'SOUTHBOUND');
}
// which door a given real edge departs from
function doorForEdge(def, edge) {
  for (const p of def.platDefs) {
    for (const d of Object.values(p.doors)) {
      if (d.edges.some(e => e.line === edge.line && e.to === edge.to)) return d;
    }
  }
  return null;
}


// a stylised carriage. doorX/baseY locate the doorway; door 0..1 is how
// open; dx slides the whole train; moving adds rush lines; dir mirrors
// the carriage for platforms on the left side of a station.
function drawTrain(ctx, doorX, baseY, color, { door = 1, dx = 0, moving = false, dir = 1 } = {}) {
  const bw = 176, bh = 44;
  const bx = (dir > 0 ? doorX - 128 : doorX - 48) + dx, by = baseY - 46;
  ctx.save();
  if (moving) {
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.lineWidth = 2.5;
    const tail = dir > 0 ? bx : bx + bw;
    for (const ly of [by + 8, by + 22, by + 36]) {
      ctx.beginPath(); ctx.moveTo(tail - dir * 14, ly); ctx.lineTo(tail - dir * 54, ly); ctx.stroke();
    }
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 9);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dfe6ea';
  if (dir > 0) {
    for (let wx = bx + 10; wx < doorX + dx - 26; wx += 26) ctx.fillRect(wx, by + 8, 18, 14);
    ctx.fillRect(doorX + dx + 16, by + 8, 18, 14);
  } else {
    for (let wx = bx + bw - 28; wx > doorX + dx + 22; wx -= 26) ctx.fillRect(wx, by + 8, 18, 14);
    ctx.fillRect(doorX + dx - 34, by + 8, 18, 14);
  }
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
  ctx.beginPath(); ctx.arc(dir > 0 ? bx + 5 : bx + bw - 5, by + bh - 10, 3, 0, Math.PI * 2); ctx.fill();
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
    this.g.camFocus = null;
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
    this.changeHint = null;
    this.mapZoom = 1;   // pinch (or wheel) to lean in and out of London
    this.stats = { stops: 0, visited: new Set([this.cur]), objects: 0 };
    this.foundObjects = new Set();   // stations whose lost thing is handed in
    this.eatenGrain = new Map();     // station -> Set("c,r"): crumbs stay eaten
    this.quitConfirm = false;
    this.finale = null;
    this.finaleDone = false;
    this.lineFlash = null;
    // the clock: always daytime, ten times reality — the rat race spins
    this.clock = 7 * 60 + Math.floor(Math.random() * 11 * 60);
    this.day = 1;
    this.outSeed = (Math.random() * 0xffffffff) >>> 0;
    this._outMemo = new Map();
    this.cam = [...POS[this.cur]];
    // 🛸 konami reward: free flight — the camera rides freePos instead
    // of the current station while the teleporter is switched on
    this.freePos = this.g.teleportOn ? [...POS[this.cur]] : null;
    const [x, y] = this.toXY(this.cur);
    this.flock = [{ sp: 'robin', x, y, ph: 0 }];
    this.updateMusic();
    this.g.say(`Up the Junction — a cosy journey, no clock, no fail state. You are at ${this.cur}. ${this.describeStation()}`);
  }
  // the band assembles as the flock does: washes for one bird, full song
  // for the whole family
  // the recorded score rules Up the Junction when it can load: THE QUIET
  // ENGINES on the map, GEARS AND BIRDCALLS inside the stations, THE
  // INEXORABLE PASSACAGLIA for the flight home. The chiptune band steps
  // back — and steps straight back in if the tracks can't be fetched
  // (offline never silences the game).
  updateMusic() {
    const g = this.g;
    // a jukebox track the player chose owns the stage — every band waits
    if (g.jukebox?.engaged) {
      g.music.stop(0.6);
      g.soundtrack?.stop(0.8);
      g.midiScore?.stop(0.8);
      return;
    }
    const mood = this.finale ? 'passacaglia' : this.interior ? 'gears' : 'engines';
    // TAPE mode: the recordings themselves, crossfaded — inside a
    // station the tape may be that station's OWN song (see audio/)
    if (g.scoreMode === 'tape' && g.soundtrack && !g.soundtrack.failed) {
      const tape = this.interior && !this.finale
        ? (this.interior.trackChoice ??= this.pickInteriorTrack())
        : mood;
      g.music.stop(0.9);
      g.midiScore?.stop(0.9);
      g.soundtrack.play(tape).then(() => {
        if (g.soundtrack.failed) this.updateMusic();   // fell over: MIDI takes it
      });
      return;
    }
    // MIDI mode (the default): the parameterized live performance —
    // loops to the bar, layers with the flock, leans with rush hour
    g.soundtrack?.stop(1);
    g.music.stop(0.9);
    if (g.midiScore) {
      g.midiScore.play(mood);
      g.midiScore.setIntensity(0.25 + 0.75 * ((this.roster.length - 1) / LOST.length));
      return;
    }
    g.music.start();
    g.music.setIntensity(0.15 + 0.85 * ((this.roster.length - 1) / LOST.length));
  }
  swellMusic() {
    const g = this.g;
    if (g.jukebox?.engaged) return;   // the chosen song is not to be swollen
    if (g.midiScore?.timer) g.midiScore.swell();
    else if (g.soundtrack?.active) g.soundtrack.swell();
    else g.music.swell();
  }
  // which tape plays inside the current station: its own song leads
  // (two visits in three — a generic track takes the third turn so long
  // sessions don't wear a groove); everywhere else, the generic
  // rotation (the gears among them) varied by station and visit.
  // Chosen once per visit.
  pickInteriorTrack() {
    const st = this.g.soundtrack;
    this.musicVisit = (this.musicVisit || 0) + 1;
    if (!st) return 'engines';
    const own = st.stationTrack(this.cur);
    if (own && this.musicVisit % 3 !== 0) return own;
    const pool = st.genericPool();
    if (!pool.length) return own ?? 'engines';
    return pool[(hashName(this.cur) + this.musicVisit) % pool.length];
  }
  get objective() { return this.lostIdx < LOST.length ? LOST[this.lostIdx] : null; }
  // one facility in ten is having a day off — per lift shaft, per
  // escalator run, rolled once per run (step-free stations keep their
  // lifts honest). Broken things GLITCH, and rebuff all touch.
  facilityOut(name, kind, idx) {
    const key = `${name}|${kind}|${idx}`;
    if (this.forceOut) return !!this.forceOut[key];   // test seam
    if (STEP_FREE.has(name)) return false;
    return ((hashName(key) ^ this.outSeed) >>> 0) % 10 === 0;
  }
  stationLiftOut(name) {   // the map's crossed boxes
    if (this._outMemo.has(name)) return this._outMemo.get(name);
    const def = genStation(name);
    let out = false;
    for (let i = 0; i < (def.nLifts || 0); i++) if (this.facilityOut(name, 'lift', i)) out = true;
    this._outMemo.set(name, out);
    return out;
  }
  // ------------------------------------------------ narration (a11y)
  compass(dx, dy) {
    const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7;
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][oct];
  }
  stopsTo(from, to) {
    if (from === to) return 0;
    const seen = new Set([from]);
    let ring = [from];
    for (let d = 1; d < 40 && ring.length; d++) {
      const next = [];
      for (const s of ring) {
        for (const e of EDGES.get(s)) {
          if (e.to === to) return d;
          if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to); }
        }
      }
      ring = next;
    }
    return null;
  }
  // first hop of a shortest path toward a target (same-line hops win ties)
  nextHopTo(target) {
    if (!target || this.cur === target || !POS[target]) return null;
    const prev = new Map([[this.cur, null]]);
    let ring = [this.cur];
    while (ring.length) {
      const next = [];
      for (const s of ring) {
        for (const e of EDGES.get(s)) {
          if (!prev.has(e.to)) { prev.set(e.to, { from: s, edge: e }); next.push(e.to); }
        }
      }
      if (prev.has(target)) break;
      ring = next;
    }
    if (!prev.has(target)) return null;
    let n = target, hop = null, stops = 0;
    while (prev.get(n)) { hop = prev.get(n); n = hop.from; stops++; }
    // if a same-line edge reaches the same first stop, prefer it
    let edge = hop.edge;
    if (this.line && edge.line !== this.line) {
      const same = EDGES.get(this.cur).find(e => e.to === edge.to && e.line === this.line);
      if (same) edge = same;
    }
    return { edge, stops };
  }
  describeStation() {
    const seenDir = new Set();
    const parts = [];
    for (const e of EDGES.get(this.cur)) {
      const k = `${e.line}|${e.to}`;
      if (seenDir.has(k)) continue;
      seenDir.add(k);
      const dx = POS[e.to][0] - POS[this.cur][0], dy = POS[e.to][1] - POS[this.cur][1];
      parts.push(`${LINE_SHORT[e.line] || e.line} ${this.compass(dx, dy)} to ${e.to}`);
    }
    const ob = this.objective;
    let quest = '';
    if (ob) {
      const n = this.stopsTo(this.cur, ob.at);
      quest = ` ${ob.name} the ${ob.sp} waits at ${ob.at}${n ? `, ${n} stop${n === 1 ? '' : 's'} away` : ' — this is the place'}.`;
    }
    const lift = this.stationLiftOut(this.cur) ? ' A lift is out here.' : '';
    return `Routes: ${parts.join('; ')}.${quest}${lift}`;
  }
  describeInterior(it) {
    const side = c => (c < 10 ? 'left' : 'right');
    const d = it.def;
    const levelName = r => d.levels[it.floorRows.indexOf(r + 1)] || 'a platform';
    const bits = [`Inside ${this.cur}.`];
    if (it.rescue) bits.push(`${it.rescue.name} the ${it.rescue.sp} is on ${levelName(it.rescue.y / TILE - 1)}.`);
    else if (it.pendingEdge) bits.push(`Change to the ${LINE_SHORT[it.pendingEdge.line] || it.pendingEdge.line} line — its ${boundWord(this.cur, it.pendingEdge.to).toLowerCase()} train leaves from ${levelName(it.gate.r)}, ${side(it.gate.c)} end.`);
    bits.push(`It's ${this.clockText()}.`);
    bits.push(`Levels, top to bottom: ${d.levels.join('; ')}.`);
    const rowName = r => d.levels[it.floorRows.indexOf(r)] || 'a level';
    d.shaftDefs.forEach((sd, i) => {
      bits.push(`Lift ${String.fromCharCode(65 + i)} serves ${sd.stops.map(rowName).join(', ')}.`);
    });
    if (d.shaftDefs.length) bits.push('Stand at the doors and press up to board.');
    for (const p of d.platDefs) {
      const doors = Object.values(p.doors).map(dr =>
        `${boundWord(this.cur, dr.edges[0].to).toLowerCase()} to ${dr.edges[0].to} at the ${side(dr.c)} end`);
      if (doors.length) bits.push(`Trains on ${levelName(p.row - 1)}: ${doors.join('; ')}.`);
    }
    const broken = it.glitches.map(gl => gl.kind === 'lift' ? 'a lift' : 'an escalator');
    if (broken.length) bits.push(`Broken and glitching — do not touch: ${broken.join(', ')}.`);
    if (it.lost) bits.push(`Lost property: somebody dropped a ${it.lost.kind} on ${levelName(it.lost.r)}. Finding it is worth 250.`);
    bits.push(`The WAY OUT is on ${levelName(d.gateOut.r)}, ${side(d.gateOut.c)} side. Stairs always work.`);
    return bits.join(' ');
  }
  saveHi() {
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      localStorage.setItem('robbin.tube.hiscore', String(this.hiscore));
    }
  }
  // map camera: design units → screen. ~26 units across the short edge
  // keeps neighbouring stations a comfortable flap apart; the camera
  // glides after the flock across the whole city. The view centres in
  // the band between the masthead and the touch controls, so the map
  // owns the space the thumbs and words don't.
  mapScale() { return (Math.min(this.g.cssW, this.g.cssH) / 26) * (this.mapZoom || 1); }
  // fully zoomed out means the WHOLE network on screen: the pinch floor
  // is wherever London fits the view band, a little margin included
  fitZoom() {
    const g = this.g, { top, bot } = this.viewBand();
    const base = Math.min(g.cssW, g.cssH) / 26, m = 1.4;
    return Math.min(
      g.cssW / ((BOUNDS.x1 - BOUNDS.x0 + m * 2) * base),
      Math.max(40, g.cssH - top - bot) / ((BOUNDS.y1 - BOUNDS.y0 + m * 2) * base));
  }
  // once the player leans out, keep the view on the city — and when the
  // viewport outgrows the city, centre it, so the far zoom shows it all
  clampCam() {
    const s = this.mapScale(), g = this.g, { top, bot, cy } = this.viewBand();
    const m = 1.4, hw = g.cssW / 2 / s;
    const hTop = (cy - top) / s, hBot = (g.cssH - bot - cy) / s;
    const cl = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
    this.cam[0] = cl(this.cam[0], BOUNDS.x0 - m + hw, BOUNDS.x1 + m - hw);
    this.cam[1] = cl(this.cam[1], BOUNDS.y0 - m + hTop, BOUNDS.y1 + m - hBot);
  }
  viewBand() {
    const g = this.g, w = g.cssW, h = g.cssH;
    const fs = Math.max(17, Math.min(24, w / 22));
    const top = fs * 5.2;
    const bot = g.touchUI ? Math.min(h * 0.3, 215) : fs * 1.9;
    return { top, bot, cy: top + (h - top - bot) / 2 };
  }
  toScreen(p) {
    const s = this.mapScale();
    const { cy } = this.viewBand();
    return [this.g.cssW / 2 + (p[0] - this.cam[0]) * s, cy + (p[1] - this.cam[1]) * s];
  }
  toXY(name) { return this.toScreen(POS[name]); }
  // 🛸 TELEPORT (konami-unlocked, optional): triple-tap hops the whole
  // flock anywhere; dragging slides freely across the city, the nearest
  // station becoming yours as you pass. A cheat that keeps the rules of
  // GO: entering is still always your act.
  setTeleport(on) {
    this.freePos = on && this.cur && POS[this.cur] ? [...POS[this.cur]] : null;
  }
  stationAt(px, py) {
    if (this.interior || this.travel || this.finale) return null;
    let best = null, bd = 22;
    for (const name of Object.keys(POS)) {
      const [x, y] = this.toXY(name);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = name; }
    }
    return best;
  }
  teleportTo(name) {
    if (!POS[name] || this.travel || this.interior || this.finale || this.over) return;
    this.cur = name;
    this.line = null;
    this.changeHint = null;
    this.freeChange = null;
    if (this.freePos) this.freePos = [...POS[name]];
    this.stats.visited.add(name);
    this.flutterT = 0.9;
    this.g.haptics.chord();
    this.g.foley.whoosh();
    this.g.say(`Teleport — the flock blinks across London to ${name}.`);
  }
  slideBy(dx, dy) {
    if (!this.freePos) this.freePos = [...(POS[this.cur] || this.cam)];
    const sc = this.mapScale();
    this.freePos[0] -= dx / sc;
    this.freePos[1] -= dy / sc;
    const m = 3;
    this.freePos[0] = Math.min(BOUNDS.x1 + m, Math.max(BOUNDS.x0 - m, this.freePos[0]));
    this.freePos[1] = Math.min(BOUNDS.y1 + m, Math.max(BOUNDS.y0 - m, this.freePos[1]));
    let best = null, bd = 2.4;
    for (const name of Object.keys(POS)) {
      const d = Math.hypot(POS[name][0] - this.freePos[0], POS[name][1] - this.freePos[1]);
      if (d < bd) { bd = d; best = name; }
    }
    if (best && best !== this.cur) {
      this.cur = best;
      this.line = null;
      this.stats.visited.add(best);
      this.g.haptics.tick();
    }
  }
  // FINK embed support: begin the journey at a named station, and
  // resolve loose mode slugs ('hampstead') to real station names
  stationFromSlug(slug) {
    const want = String(slug || '').toUpperCase().replace(/[-_]+/g, ' ').trim();
    if (!want) return null;
    if (POS[want]) return want;
    const names = Object.keys(POS);
    return names.find(n => n === want)
      || names.find(n => n.startsWith(want))
      || names.find(n => n.includes(want))
      || null;
  }
  startAt(name) {
    if (!POS[name]) return false;
    this.cur = name;
    this.cam = [...POS[name]];
    this.stats.visited = new Set([name]);
    if (this.freePos) this.freePos = [...POS[name]];
    const [x, y] = this.toXY(name);
    this.flock = [{ sp: 'robin', x, y, ph: 0 }];
    this.updateMusic();
    this.g.say(`The journey begins at ${name}. ${this.describeStation()}`);
    return true;
  }
  // ---------------------------------------------------------- input
  // the full-screen postcard reads until dismissed — any press moves on
  dismissFact() {
    if (!this.factCard) return false;
    this.factCard = null;
    this.g.haptics.tick();
    this.g.foley.step();
    return true;
  }
  handleDir(dx, dy) {
    if (this.quitConfirm) return;   // the question holds the floor
    if (this.dismissFact()) return;
    if (this.over || this.travel || this.interior || this.gather || this.finale || Math.hypot(dx, dy) < 0.3) return;
    const [cx, cy] = this.toXY(this.cur);
    let best = null;
    for (const e of EDGES.get(this.cur)) {
      const [tx, ty] = this.toXY(e.to);
      const vx = tx - cx, vy = ty - cy, len = Math.hypot(vx, vy);
      const dot = (vx * dx + vy * dy) / (len * Math.hypot(dx, dy));
      if (dot > 0.45 && (!best || dot > best.dot)) best = { ...e, dot };
    }
    if (!best) return;
    // parallel lines share track: if your own line also serves the chosen
    // next stop, riding straight on is NOT a change — stay aboard
    if (this.line && best.line !== this.line) {
      const same = EDGES.get(this.cur).find(e => e.to === best.to && e.line === this.line);
      if (same) best = { ...same, dot: best.dot };
    }
    // changing lines at an interchange means crossing the station itself —
    // unless the two lines share a platform (a real cross-platform change:
    // you just stay put as the other train rolls in), or you just fought
    // your way through
    if (this.line && best.line !== this.line && this.freeChange !== this.cur) {
      const def = genStation(this.cur);
      const shared = def.platLevel[this.line] && def.platLevel[this.line] === def.platLevel[best.line];
      if (shared) { this.depart(best); return; }
      // never a surprise: changing lines means heading inside, and
      // heading inside is always YOUR act — arm the change, ask for GO
      this.changeHint = { edge: best };
      // leaving your line is a MOMENT: the rest of the map steps back
      // into shadow for a beat, the pocket buzzes, a low note sounds
      this.lineFlash = { t: 1, line: this.line, target: best.line };
      this.g.haptics.buzz();
      this.g.foley.buzz();
      this.g.say(`Changing to the ${LINE_SHORT[best.line] || best.line} line toward ${best.to} means heading inside ${this.cur}. Press GO to go in, or fly your own line on.`);
      return;
    }
    this.depart(best);
  }
  depart(edge) {
    this.g.haptics.tick();     // the swipe took: we're flying
    this.freeChange = null;
    this.changeHint = null;
    const a = POS[this.cur], b = POS[edge.to];
    const units = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.travel = { edge, a, b, t: 0, dur: Math.max(0.7, units * 0.16) };
    this.g.foley.whoosh();
  }
  handleJump() {
    if (this.cancelQuit()) return;   // GO means "keep flying", never "quit"
    if (this.dismissFact()) return;  // only the big moments card now (the finale)
    if (this.gather) {
      // the flock is still settling but GO is GO: straight in
      this.gather = null;
      if (this.objective && this.objective.at === this.cur) {
        this.enterInterior(null, this.objective, { arrival: true });
        return;
      }
    }
    // in an interior, jumping goes through the play input — but on the
    // map, GO is THE way in: it drops into the bird's station (with the
    // train-arrival scene), carries an armed line change inside, or
    // just wanders in on foot. Never automatic, always yours.
    if (!this.interior && !this.travel && !this.gather && !this.finale && !this.over) {
      const rescue = this.objective && this.objective.at === this.cur ? this.objective : null;
      if (rescue) { this.enterInterior(null, rescue, { arrival: true }); return; }
      const edge = this.changeHint?.edge ?? null;
      this.changeHint = null;
      this.enterInterior(edge, null);
    }
  }
  exit() {
    this.quitConfirm = false;
    this.saveHi();
    if (this.g.embedComplete?.(true)) return;   // FINK guest: hand back to the story
    this.g.soundtrack?.stop(1.2);
    this.g.midiScore?.stop(1.2);
    if (!this.g.jukebox?.engaged) {
      this.g.music.start();
      this.g.music.setIntensity(0.4);   // the menu keeps a gentle band
    }
    this.g.camFocus = null;
    this.g.state = 'title';
    document.getElementById('title').classList.remove('hidden');
  }
  // ---------------------------------------------------------- interiors
  enterInterior(pendingEdge, rescue, { arrival = false } = {}) {
    const g = this.g;
    const def = genStation(this.cur);
    const seed = hashName(this.cur) % 20;
    const level = new Level({ name: this.cur, map: def.map, time: 0, enemies: [] }, 0);
    // the level is rebuilt fresh each visit, but the crumbs are not:
    // grain already eaten here this journey stays gone
    for (const k of this.eatenGrain?.get(this.cur) ?? []) level.treasure.delete(k);
    // ONE CAR PER SHAFT, cycling its real stops with sliding doors —
    // you can see who's aboard as glowing skeletons through the glass.
    // Letters follow the Lift guide's street-first order (Canada Water:
    // A to street, B the deep through-lift, C the short hop) — the
    // board on the wall and the game agree. Broken lift = dead car
    // parked mid-shaft in the dark. One facility in ten is out.
    const LIFT_INK = ['#4f4a76', '#b23b2b', '#716b93'];
    const glitches = [];
    for (const sh of level.lifts) sh.paddles = [];   // paddles are the arcade's; the tube runs cars
    def.shaftDefs.forEach((sd, i) => {
      const sh = level.lifts.find(s => Math.round(s.x0 / TILE) === sd.c);
      if (!sh) return;
      sh.id = String.fromCharCode(65 + i);
      sh.color = LIFT_INK[i % LIFT_INK.length];
      sh.stops = sd.stops;
      if (this.facilityOut(this.cur, 'lift', i)) {
        sh.out = true;
        sh.car = { y: ((sd.stops[0] + sd.stops[sd.stops.length - 1]) / 2) * TILE,
          stop: -1, dir: 1, state: 'dead', t: 0, door: 0, occupants: [] };
        glitches.push({ kind: 'lift', x0: sh.x0, x1: sh.x1, y0: sh.topY, y1: sh.botY,
          next: 1.5 + Math.random() * 4, until: 0, flip: false });
      } else {
        sh.car = { y: sd.stops[0] * TILE, stop: 0, dir: 1, state: 'dwell',
          t: Math.random() * 1.5, door: 1, occupants: [] };
      }
    });
    // the landing floor runs IN FRONT of the lift doors: you can walk
    // straight past a lift without being blocked or swallowed — the
    // shaft is only open where the car actually travels between floors
    for (const sh of level.lifts) {
      if (!sh.stops) continue;
      const c0 = Math.round(sh.x0 / TILE), c1 = Math.round(sh.x1 / TILE);
      for (const r of sh.stops) for (let c = c0; c < c1; c++) level.grid[r][c] = '#';
    }
    // sloped escalator runs, with per-run outages
    const escRuns = def.escRuns.map((r0, i) => ({ ...r0, broken: this.facilityOut(this.cur, 'esc', i) }));
    const brokenEsc = new Set();
    escRuns.forEach((run, i) => {
      if (!run.broken) return;
      brokenEsc.add(i);
      glitches.push({ kind: 'esc', run,
        x0: Math.min(run.xTop, run.xBot) - 8, x1: Math.max(run.xTop, run.xBot) + 8,
        y0: run.yTop, y1: run.yBot,
        next: 1.5 + Math.random() * 4, until: 0, flip: false });
    });
    // where you're headed decides the door: a line change crosses the
    // station underground to the door the new train really leaves from;
    // rescues and wanders default to surfacing — the WAY OUT
    const gate = (pendingEdge && doorForEdge(def, pendingEdge)) || def.gateOut;
    const perch = def.perch;
    // you start where you really would: train arrivals and line changes
    // step off mid-platform on the level your line runs at
    const inRow = def.platLevel[this.line] || def.platDefs[def.platDefs.length - 1].row;
    // step off where the train actually stops: the door serving the
    // line and direction just ridden, not an abstract mid-platform
    const rideDoor = this.lastRide && this.lastRide.at === this.cur && this.lastRide.line === this.line
      ? doorForEdge(def, { line: this.lastRide.line, to: this.lastRide.from }) : null;
    if (arrival || (pendingEdge && this.line)) {
      level.spawn = { x: (rideDoor?.c ?? 9) * TILE + 16, y: inRow * TILE };
    } else {
      level.spawn = { x: def.spawnStreet.c * TILE + 16, y: (def.spawnStreet.r + 1) * TILE };
    }
    // you play a random member of the flock; the rest fly with you
    const playing = this.roster[Math.floor(Math.random() * this.roster.length)];
    const player = new Player(level);
    player.species = playing.sp;
    const floorRows = [];
    def.map.forEach((row, r) => { if (row.includes('#')) floorRows.push(r); });
    const vertRuns = [];   // escalator/stair runs for the Lift guide diagram
    for (let c = 0; c < 20; c++) {
      for (const kind of ['S', 'H']) {
        let top = 99, bot = -1;
        def.map.forEach((row, r) => { if (row[c] === kind) { top = Math.min(top, r); bot = Math.max(bot, r); } });
        if (bot >= 0) vertRuns.push({ c, kind, top, bot });
      }
    }
    this.stats?.visited.add(this.cur);
    // the Did-you-know now slides in OVER the interior — up to five
    // seconds or the first touch — instead of gating entry. Once per
    // station per journey; the game never repeats itself at you.
    const story = STATION_FACTS[this.cur];
    if (story && !(this.factShown ??= new Set()).has(this.cur)) {
      this.factShown.add(this.cur);
      this.toast = { fact: story, station: this.cur, t: 0, ttl: 5, leaving: 0 };
    }
    this.interior = {
      def, level, pendingEdge, gate, floorRows, vertRuns, seed,
      escRuns, escRide: null, playerCar: null,
      glitches, brokenEsc, grab: null, grabCool: 0,
      fact: arrival ? STATION_FACTS[this.cur] : null,
      droppings: [], decals: [],
      playing,
      rescue: rescue && perch ? {
        ...rescue, x: perch.c * TILE + 16, y: (perch.r + 1) * TILE, found: false,
      } : null,
      // the station's lost thing, if it has one and nobody found it yet
      lost: def.lostObject && !this.foundObjects?.has(this.cur) ? {
        ...def.lostObject,
        x: def.lostObject.c * TILE + 16, y: (def.lostObject.r + 1) * TILE,
      } : null,
      // every station draws its crowd from a different corner of London —
      // and some of that crowd moves slowly, with a stick, a case, a
      // pram or a wheelchair; steps and escalators are not for everyone
      enemies: def.commuters.map((e, i) => {
        const en = new Enemy(level, { ...e, v: (e.v + seed) % 20 });
        const roll = (seed * 7 + i * 13) % 100;
        en.aid = roll < 8 ? 'stick' : roll < 18 ? 'case' : roll < 24 ? 'pram' : roll < 30 ? 'wheelchair' : null;
        en.aidMul = { stick: 0.55, case: 0.75, pram: 0.6, wheelchair: 0.5 }[en.aid] || 1;
        en.liftOnly = en.aid === 'pram' || en.aid === 'wheelchair';
        return en;
      }),
      buddies: this.roster.filter(b => b !== playing).slice(0, 6)
        .map((b, i) => ({ sp: b.sp, x: player.x - 20 - i * 12, y: player.y - 30, ph: i * 1.9 })),
      invulnT: 1,
    };
    g.level = level;
    g.player = player;
    g.heading = { x: 0, y: 0 };   // glide mode: stand until told
    g.nextHeading = null;
    g.screen = { def: { name: this.cur }, enemies: this.interior.enemies, cleared: false };
    g.fx = []; g.parts = [];
    if (arrival) {
      // the train brings you in at the platform your line really uses
      // (door on the inward side so it stays on screen either way round)
      const doorX = level.spawn.x + (level.spawn.x < W / 2 ? 36 : -36);
      this.scene = { kind: 'arrive', t: 0, doorX, baseY: level.spawn.y };
      player.x = -90; player.y = level.spawn.y;
      for (const b of this.interior.buddies) { b.x = -90; b.y = level.spawn.y - 26; b.vx = 0; b.vy = 0; }
      g.camFocus = { x: this.scene.doorX, y: this.scene.baseY };
    } else {
      g.camFocus = null;
    }
    g.updateCamera(0, true);
    g.foley.whoosh();
    g.haptics.thud();
    this.updateMusic();   // gears and birdcalls: we're inside
    g.say(this.describeInterior(this.interior));
  }
  // scripted train moments: arrivals disembark, boardings get whisked away
  updateScene(dt) {
    const g = this.g, it = this.interior, sc = this.scene;
    sc.t += dt;
    const t = performance.now() / 1000;
    for (const e of it.enemies) if (!e.inCar && !e.riding) e.update(dt);   // the station stays alive
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
      if (sc.t >= A + B + C + D) { this.scene = null; it.invulnT = 0.9; g.camFocus = null; }
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
        g.camFocus = null;
        if (it.rescue) this.freeChange = this.cur;   // rescued and out: same toll rule as the WAY OUT
        if (this.maybeFinale(it)) { this.updateMusic(); return; }
        this.updateMusic();
        this.depart(edge);
      }
    }
  }
  // the rebuff: a broken facility pulls the whole flock in, holds them
  // while the jiggle and the feather-flap ramp up, then hurls the lot
  // back out into the scene. Harmless, indignant, memorable.
  updateGrab(dt) {
    const g = this.g, it = this.interior, gb = it.grab, p = g.player;
    gb.t += dt;
    for (const e of it.enemies) if (!e.inCar && !e.riding) e.update(dt);
    const PULL = 0.2, HOLD = 0.7;
    if (g.reducedMotion) {
      // no strobe, no shake: a firm calm set-down away from the thing
      p.x = Math.max(20, Math.min(W - 20, gb.x + gb.side * 80));
      p.y = gb.ry; p.mode = 'fall'; p.vy = 0;
      for (const b of it.buddies) { b.x = p.x - 20; b.y = p.y - 30; b.vx = b.vy = 0; }
      it.grab = null; it.grabCool = 1.2; it.invulnT = 1;
      return;
    }
    if (gb.t < PULL) {
      const k = 1 - Math.exp(-dt * 18);
      p.x += (gb.x - p.x) * k; p.y += (gb.y - p.y) * k;
      for (const b of it.buddies) { b.x += (gb.x - b.x) * k; b.y += (gb.y - b.y) * k; b.vx = b.vy = 0; }
    } else if (gb.t < PULL + HOLD) {
      const ramp = (gb.t - PULL) / HOLD;
      const j = 2 + ramp * 10;
      p.x = gb.x + (Math.random() - 0.5) * j * 2;
      p.y = gb.y + (Math.random() - 0.5) * j * 2;
      p.phase += dt * (24 + ramp * 70);          // feathers going frantic
      it.buddies.forEach((b, i) => {
        b.x = gb.x + Math.sin(i * 2.1 + gb.t * 30) * j * 1.6;
        b.y = gb.y + Math.cos(i * 1.7 + gb.t * 26) * j * 1.4;
        b.ph += dt * (24 + ramp * 70);
      });
    } else {
      // and OUT you all go
      p.mode = 'fall';
      p.vx = gb.side * (170 + Math.random() * 120);
      p.vy = -180 - Math.random() * 140;
      p.x = Math.max(20, Math.min(W - 20, gb.x + gb.side * 24));
      for (const b of it.buddies) {
        const a = Math.random() * Math.PI * 2;
        b.x = gb.x + Math.cos(a) * 26;
        b.y = gb.y + Math.sin(a) * 18;
        b.vx = Math.cos(a) * 170;
        b.vy = -Math.abs(Math.sin(a)) * 170 - 40;
      }
      g.puff(gb.x, gb.y, 9);
      it.grab = null;
      it.grabCool = 1.4;
      it.invulnT = 1;
    }
  }
  // surfacing: the visit ends, the map returns — and if the LAST bird
  // just came aboard, the ending gets to LAND
  surface() {
    const g = this.g, it = this.interior;
    this.interior = null;
    g.camFocus = null;
    g.foley.clear();
    if (it.rescue) this.freeChange = this.cur;   // rescued and out — no second toll
    else if (it.pendingEdge) this.line = null;   // surfaced on foot instead: fresh start
    if (this.maybeFinale(it)) { /* the ending has the stage */ }
    else g.say(`Surfaced at ${this.cur} — back on the map. ${this.describeStation()}`);
    this.updateMusic();   // quiet engines again (or the passacaglia home)
  }
  // the ending arms the moment the family is big enough — HOWEVER the
  // station was left. It used to live only behind the WAY OUT, so a
  // player who always rode onward from the platform (as the how-to
  // suggests!) could reach 9/7 and never see it. Field bug, July 2026.
  maybeFinale(it) {
    if (!it?.rescue || this.finaleDone) return false;
    if (this.roster.length < 7 && this.objective) return false;
    const g = this.g;
    this.finaleDone = true;
    this.travel = null;               // the flight home outranks any train
    this.finale = {
      t: 0, dur: 14, swells: 0,
      from: [...POS[this.cur]],
      to: [...POS['LIVERPOOL STREET']],
      home: 'LIVERPOOL STREET',
    };
    this.arriveT = 6;
    this.arriveMsg = 'UNFLOCKABLE…';
    this.swellMusic();
    g.haptics.chord();
    g.say(this.objective
      ? `${it.rescue.name} makes ${this.roster.length} — enough to fly home together. The flock wheels home across London.`
      : `${it.rescue.name} joins — the flock is unflockable now. It wheels home across London.`);
    return true;
  }
  // 🦉 the knowing owl in settings has seen how it ends: dress a fresh
  // run as a finished one — six birds aboard, a west-to-east start —
  // and let the real finale sequence fly exactly as it ships
  previewFinale() {
    const g = this.g;
    this.start();
    this.cur = 'PADDINGTON';        // a proper glide across town
    this.cam = [...POS[this.cur]];
    this.lostIdx = 6;               // the first six count as rescued
    for (const b of LOST.slice(0, 6)) this.roster.push({ sp: b.sp, name: b.name });
    const [x, y] = this.toXY(this.cur);
    this.flock = this.roster.map((b, i) => ({ sp: b.sp, x, y, ph: i * 1.7 }));
    this.finaleDone = true;
    this.finale = {
      t: 0, dur: 14, swells: 0,
      from: [...POS[this.cur]],
      to: [...POS['LIVERPOOL STREET']],
      home: 'LIVERPOOL STREET',
    };
    this.arriveT = 6;
    this.arriveMsg = 'UNFLOCKABLE…';
    this.swellMusic();
    g.haptics.chord();
    g.say('Preview: the whole flock wheels home across London.');
    this.updateMusic();
  }
  // wandered in by mistake? One press pops the flock straight back out
  // to the map — no trek to the WAY OUT, nothing lost, no judgement
  popOut() {
    const it = this.interior;
    if (!it || this.scene) return false;
    if (!it.rescue || it.rescue.found) { this.surface(); return true; }
    this.interior = null;
    this.g.camFocus = null;
    this.g.foley.step();
    this.updateMusic();
    this.g.say(`Back on the map at ${this.cur}. ${it.rescue.name} still waits inside.`);
    return true;
  }
  // prams and wheelchairs can't do steps or escalators: they make for
  // the lift, stand patiently by the doors, and ride — you'll see their
  // glowing skeletons glide past through the glass. Sticks and cases
  // manage the escalators, slowly and after a steadying pause.
  updateCommuterMobility(dt, it) {
    const lv = it.level;
    for (const e of it.enemies) {
      if (e.inCar) continue;
      if (e.riding) {
        const run = e.riding.run;
        const [sx, sy, ex, ey] = run.up ? [run.xBot, run.yBot, run.xTop, run.yTop]
          : [run.xTop, run.yTop, run.xBot, run.yBot];
        const len = Math.hypot(ex - sx, ey - sy) || 1;
        e.riding.s += (52 / len) * dt;
        e.x = sx + (ex - sx) * Math.min(1, e.riding.s);
        e.y = sy + (ey - sy) * Math.min(1, e.riding.s);
        if (e.riding.s >= 1) { e.x = ex + Math.sign(ex - sx) * 8; e.y = ey; e.riding = null; }
        continue;
      }
      if (e.liftOnly) {
        for (const sh of lv.lifts) {
          if (!sh.car || sh.out) continue;
          const row = Math.round(e.y / TILE);
          if (!sh.stops.includes(row)) continue;
          const cx = (sh.x0 + sh.x1) / 2;
          if (Math.abs(e.x - cx) < 34) {
            e.waitT = 0.4;                    // stood by the doors
            const car = sh.car;
            if (car.state === 'dwell' && car.door > 0.7 && sh.stops[car.stop] === row
              && car.occupants.length < 2 && Math.random() < dt * 0.8) {
              const others = sh.stops.filter(r => r !== row);
              const off = others[Math.floor(Math.random() * others.length)];
              car.occupants.push({ e, aid: e.aid, off });
              e.inCar = true; e.waitT = 0; e.x = -500;   // aboard: only the skeleton shows
            }
            break;
          }
        }
      } else if (Math.random() < dt * 2) {
        for (const run of it.escRuns) {
          if (run.broken) continue;
          const [bx, by] = run.up ? [run.xBot, run.yBot] : [run.xTop, run.yTop];
          if (Math.abs(e.x - bx) < 12 && Math.abs(e.y - by) < 8) {
            if (e.aid && !e.hesitated) { e.waitT = 1.0; e.hesitated = true; break; }
            e.riding = { run, s: 0 };
            e.hesitated = false;
            break;
          }
        }
      }
    }
  }
  updateInterior(dt) {
    const g = this.g, it = this.interior, lv = it.level;
    if (this.scene) { this.updateScene(dt); return; }
    if (it.invulnT > 0) it.invulnT -= dt;
    if (it.grabCool > 0) it.grabCool -= dt;
    // broken facilities glitch every few seconds — a 0.3s wrongness
    for (const gl of it.glitches) {
      if (gl.until > 0) gl.until -= dt;
      gl.next -= dt;
      if (gl.next <= 0) { gl.until = 0.3; gl.flip = !gl.flip; gl.next = 4 + Math.random() * 4; }
    }
    if (it.grab) { this.updateGrab(dt); return; }
    // ONE CAR PER SHAFT: dwell with sliding doors, glide to the next
    // real stop, bounce at the ends. The rat race rides in glass boxes.
    const DWELL = 2.4, DOOR_T = 0.35, CAR_V = 58;
    for (const sh of lv.lifts) {
      const car = sh.car;
      if (!car || car.state === 'dead') continue;
      car.t += dt;
      if (car.state === 'dwell') {
        // held doors: a bird (or a caller) standing right by the open
        // doors keeps them open a little longer, like a kind commuter
        const px2 = g.player.x, py2 = g.player.y;
        const holding = !sh.out && Math.abs(px2 - (sh.x0 + sh.x1) / 2) < 60
          && Math.abs(py2 - sh.stops[car.stop] * TILE) < 10
          && !it.playerCar && (car.held || 0) < 3;
        if (holding && car.t > DWELL - DOOR_T - 0.15) {
          car.held = (car.held || 0) + dt;
          car.t = DWELL - DOOR_T - 0.15;
        }
        // a call from another landing cuts the loitering short
        if (car.call != null && car.stop !== car.call && car.t < DWELL - DOOR_T) car.t = DWELL - DOOR_T;
        car.door = car.t < DWELL - DOOR_T ? Math.min(1, car.t / DOOR_T) : Math.max(0, (DWELL - car.t) / DOOR_T);
        // open doors with a bird stood right there: coach the boarding
        if (!sh.out && !it.playerCar && car.door > 0.9 && !car.coached
          && Math.abs(g.player.x - (sh.x0 + sh.x1) / 2) < 60
          && Math.abs(g.player.y - sh.stops[car.stop] * TILE) < 10) {
          car.coached = true;
          g.fx.push({ x: (sh.x0 + sh.x1) / 2, y: sh.stops[car.stop] * TILE - 64, txt: '↑ board', t: 1.4 });
          g.say(`Lift ${sh.id} doors open — press up to board.`);
        }
        if (car.t >= DWELL) {
          car.state = 'move'; car.t = 0; car.door = 0; car.held = 0; car.coached = false;
          if (car.call != null && car.call !== car.stop) {
            car.next = car.call;               // straight there, no calling points
            car.dir = Math.sign(car.call - car.stop) || 1;
          } else {
            if (car.stop + car.dir < 0 || car.stop + car.dir >= sh.stops.length) car.dir *= -1;
            car.next = car.stop + car.dir;
          }
        }
      } else {
        const ty = sh.stops[car.next] * TILE;
        const step = Math.sign(ty - car.y) * CAR_V * dt;
        if (Math.abs(ty - car.y) <= Math.abs(step)) {
          car.y = ty; car.stop = car.next; car.state = 'dwell'; car.t = 0;
          if (car.call === car.stop) car.call = null;   // the call is answered
          // passengers bound for this floor step off
          car.occupants = car.occupants.filter(oc => {
            if (oc.off !== sh.stops[car.stop]) return true;
            if (oc.e) {
              oc.e.inCar = false;
              oc.e.x = (sh.x0 + sh.x1) / 2 + (Math.random() < 0.5 ? -24 : 24);
              oc.e.y = sh.stops[car.stop] * TILE;
            }
            return false;
          });
        } else car.y += step;
      }
    }
    // glide mode glides here too: the persistent heading plays the keys
    const dirIn = g.controlMode === 'glide'
      ? { left: g.heading.x < 0 ? 1 : 0, right: g.heading.x > 0 ? 1 : 0,
          up: g.heading.y < 0 ? 1 : 0, down: g.heading.y > 0 ? 1 : 0 }
      : g.input;
    if (it.playerCar) {
      // the bird in the box: ride until the doors open somewhere you
      // like. The stop you boarded at doesn't count — walking in must
      // never mean instantly stepping out the far side (a held glide or
      // held key exits at the NEXT stop instead; JUMP bails anywhere).
      const sh = it.playerCar, car = sh.car;
      if (car.state === 'move') it.boardStop = -99;
      g.player.x = (sh.x0 + sh.x1) / 2;
      g.player.y = car.y;
      g.player.vx = 0; g.player.vy = 0; g.player.mode = 'walk';
      for (const b of it.buddies) { b.x = g.player.x - 6; b.y = car.y - 24; b.vx = b.vy = 0; }
      const side = dirIn.left ? -1 : dirIn.right ? 1 : 0;
      const mayExit = car.stop !== it.boardStop || g.jumpTap;
      if (car.state === 'dwell' && car.door > 0.6 && (side || g.jumpTap) && mayExit) {
        g.player.x += (side || 1) * 42;   // clear of the doorway — no instant re-board
        it.playerCar = null;
        it.carCool = 0.4;
        g.jumpTap = false;
        g.haptics.tick();
        g.say(`Off at ${it.def.levels[it.floorRows.indexOf(sh.stops[car.stop])] || 'a level'}.`);
      }
    } else if (it.escRide) {
      // a sloped escalator carries you toward the end you didn't enter;
      // with the treads it's a glide, against them it's a determined
      // trudge (everyone has walked down an up escalator once).
      // Hop off early with a jump.
      const ride = it.escRide, run = ride.run;
      const [sx, sy, ex, ey] = ride.fromTop
        ? [run.xTop, run.yTop, run.xBot, run.yBot]
        : [run.xBot, run.yBot, run.xTop, run.yTop];
      const withRun = run.up ? !ride.fromTop : ride.fromTop;
      const len = Math.hypot(ex - sx, ey - sy) || 1;
      ride.s += ((withRun ? 72 : 42) / len) * dt;
      g.player.x = sx + (ex - sx) * Math.min(1, ride.s);
      g.player.y = sy + (ey - sy) * Math.min(1, ride.s);
      g.player.vx = 0; g.player.vy = 0; g.player.mode = 'walk';
      if (g.input.jump || g.jumpTap) {
        it.escRide = null; it.escCool = 0.5;
        g.player.mode = 'jump'; g.player.vy = -230; g.jumpTap = false;
      } else if (ride.s >= 1) {
        g.player.x = ex + Math.sign(ex - sx) * 14;
        g.player.y = ey;
        it.escRide = null;
        it.escCool = 0.5;
        g.haptics.tick();
      }
    } else {
      g.player.update(dt, { ...dirIn, jump: g.input.jump || g.jumpTap }, g);
      g.jumpTap = false;
      // stand by a shaft's doors a beat and the car is CALLED to your
      // landing — it finishes its doors, comes straight to you (no
      // calling points), and the button by the door glows amber
      for (const sh of lv.lifts) {
        if (!sh.car || sh.out) continue;
        const cx = (sh.x0 + sh.x1) / 2;
        const idx = sh.stops.findIndex(r => Math.abs(g.player.y - r * TILE) < 8);
        const near = idx >= 0 && Math.abs(g.player.x - cx) < 44 && g.player.mode === 'walk';
        sh.callT = near ? (sh.callT || 0) + dt : 0;
        if (near && sh.callT > 0.35 && sh.car.call !== idx
          && !(sh.car.state === 'dwell' && sh.car.stop === idx)
          && !(sh.car.state === 'move' && sh.car.next === idx)) {
          sh.car.call = idx;
          g.foley.step();
          g.haptics.tick();
          g.say(`Lift ${sh.id} called.`);
        }
      }
      // …boarding is DELIBERATE: stand at the open doors and press UP
      // (a queued glide-up counts). Walking past never swallows you —
      // the doorway is just a doorway.
      if (it.carCool > 0) it.carCool -= dt;
      const wantUp = dirIn.up || (g.controlMode === 'glide' && g.nextHeading && g.nextHeading.y < 0);
      if (wantUp && g.player.mode === 'walk' && it.grabCool <= 0 && !(it.carCool > 0)) {
        for (const sh of lv.lifts) {
          const car = sh.car;
          if (!car || sh.out || car.state !== 'dwell' || car.door < 0.6) continue;
          const cx = (sh.x0 + sh.x1) / 2;
          if (Math.abs(g.player.x - cx) < 22 && Math.abs(g.player.y - sh.stops[car.stop] * TILE) < 8) {
            it.playerCar = sh;
            it.boardStop = car.stop;
            g.heading = { x: 0, y: 0 };
            g.nextHeading = null;
            g.foley.whoosh();
            g.haptics.tick();
            g.say(`Aboard Lift ${sh.id}. Press a direction when the doors open to step off.`);
            break;
          }
        }
      }
      // an escalator MOUTH is a mouth: walk into either end, from
      // either side, and it takes you to the other end. (Jump over it
      // if you truly meant to pass; a short cooldown after stepping
      // off stops it swallowing you straight back.)
      if (it.escCool > 0) it.escCool -= dt;
      if (!it.playerCar && !(it.escCool > 0) && g.player.mode === 'walk' && it.grabCool <= 0) {
        const moving = dirIn.left ? -1 : dirIn.right ? 1 : 0;
        outer: for (const run of it.escRuns) {
          if (run.broken) continue;
          for (const fromTop of [false, true]) {
            const [bx, by] = fromTop ? [run.xTop, run.yTop] : [run.xBot, run.yBot];
            if (moving !== 0 && Math.abs(g.player.x - bx) < 12 && Math.abs(g.player.y - by) < 10) {
              it.escRide = { run, s: 0, fromTop };
              g.foley.step();
              break outer;
            }
          }
        }
      }
    }
    // the rat race has a pace: rush hours hurry, aids slow you down
    const hr = (this.clock / 60) % 24;
    const pace = (hr >= 7.5 && hr < 9.5) || (hr >= 16.5 && hr < 18.5) ? 1.35 : 1;
    this.g.midiScore?.setPace(pace > 1 ? 1.12 : 1);   // the score leans with the rush
    for (const e of it.enemies) {
      if (e.inCar || e.riding) continue;
      if (e.waitT > 0) { e.waitT -= dt; continue; }
      e.update(dt * pace * (e.aidMul || 1));
    }
    this.updateCommuterMobility(dt, it);
    // touch a broken thing and it takes the whole flock personally
    if (!it.grab && it.grabCool <= 0) {
      const gpx = g.player.x, gpy = g.player.y;
      for (const gl of it.glitches) {
        let touching = false;
        if (gl.kind === 'lift') {
          touching = g.player.mode !== 'walk' && gpx > gl.x0 - 6 && gpx < gl.x1 + 6 && gpy > gl.y0 && gpy < gl.y1 + 30;
        } else if (gl.run) {
          const vx = gl.run.xBot - gl.run.xTop, vy = gl.run.yBot - gl.run.yTop;
          const tt = ((gpx - gl.run.xTop) * vx + (gpy - gl.run.yTop) * vy) / (vx * vx + vy * vy || 1);
          if (tt > 0.12 && tt < 0.92) {
            touching = Math.hypot(gpx - gl.run.xTop - vx * tt, gpy - gl.run.yTop - vy * tt) < 15;
          }
        }
        if (touching) {
          it.grab = {
            x: (gl.x0 + gl.x1) / 2,
            y: Math.max(gl.y0 + 30, Math.min(gl.y1 - 10, gpy - 16)),
            ry: gpy,
            side: gpx < (gl.x0 + gl.x1) / 2 ? -1 : 1,
            t: 0,
          };
          g.player.mode = 'fall'; g.player.vy = 0; g.player.onLift = null;
          g.foley.zap();
          g.haptics.buzz();
          g.say(`A broken ${gl.kind === 'lift' ? 'lift' : 'escalator'} crackles and flings the flock away.`);
          break;
        }
      }
    }
    // narrate the level you land on (not every floor a ride glides past)
    const fi = this.playerFloorIdx(it);
    if (!it.playerCar && !it.escRide && g.player.mode === 'walk' && fi !== it._saidFloor) {
      if (it._saidFloor !== undefined) g.say(it.def.levels[fi] || '');
      it._saidFloor = fi;
    }
    // buddies flock boids-fashion around their friend (or the reunion)
    const t = performance.now() / 1000;
    const anchor = it.celebrate || { x: g.player.x - (g.player.facing || 1) * 26, y: g.player.y - 34 };
    flockStep(it.buddies, dt, anchor.x, anchor.y, t);
    // the awesome power of poop: press down mid-air (away from any ladder)
    if (g.input.down && (g.player.mode === 'jump' || g.player.mode === 'fall') && !g.player._pooped) {
      g.player._pooped = true;
      it.droppings.push({ x: g.player.x, y: g.player.y - 4, vy: 30 });
    }
    if (g.player.mode === 'walk' || g.player.mode === 'climb') g.player._pooped = false;
    for (const dr of it.droppings) {
      dr.vy += 320 * dt;
      dr.y += dr.vy * dt;
      // a commuter beneath: they stop and look around, mystified
      for (const e of it.enemies) {
        if (Math.abs(dr.x - e.x) < 10 && Math.abs(dr.y - (e.y - 34)) < 12) {
          e.peckT = 1.4; dr.landed = true;
          g.puff(dr.x, dr.y, 2);
        }
      }
      const rr = Math.ceil(dr.y / TILE);
      if (!dr.landed && lv.solid(Math.floor(dr.x / TILE), rr) && dr.y >= rr * TILE - 2) {
        dr.landed = true;
        it.decals.push({ x: dr.x, y: rr * TILE });
        if (it.decals.length > 24) it.decals.shift();
      }
      if (dr.y > H + 40) dr.landed = true;
    }
    it.droppings = it.droppings.filter(d => !d.landed);
    // grain snacks — eaten is eaten: popping out and back in doesn't
    // regrow the crumbs (no +50 farming through the WAY OUT)
    const px = g.player.x, py = g.player.y;
    for (const [key, itn] of lv.treasure) {
      const ix = itn.c * TILE + 16, iy = (itn.r + 1) * TILE;
      if (Math.abs(px - ix) < 15 && Math.abs(py - iy) < 22) {
        lv.treasure.delete(key);
        let eaten = this.eatenGrain.get(this.cur);
        if (!eaten) this.eatenGrain.set(this.cur, eaten = new Set());
        eaten.add(key);
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
          : 'UNFLOCKABLE…';
        it.celebrate = { x: px, y: py - 30, t: 2.2 };
        g.fx.push({ x: px, y: py - 60, txt: `♥ ${it.rescue.name}! ♥`, t: 2.2 });
        g.hearts(px, py - 20, 10);
        g.foley.clear();
        g.haptics.chord();
        this.updateMusic();
        this.swellMusic();
        this.saveHi();
        g.embedProgress?.();
        g.say(`${it.rescue.name} joins the flock! ${this.roster.length} birds now. Head up to the street and out the WAY OUT.`);
      }
    }
    // the lost thing: brush past it and it's found — a warm little
    // side-hunt, never required, always worth a detour
    if (it.lost && Math.abs(px - it.lost.x) < 18 && Math.abs(py - it.lost.y) < 26) {
      this.foundObjects.add(this.cur);
      this.stats.objects++;
      this.score += 250;
      g.fx.push({ x: it.lost.x, y: it.lost.y - 26, txt: `the ${it.lost.kind}! +250`, t: 1.6 });
      g.hearts(it.lost.x, it.lost.y - 12, 5);
      g.foley.egg();
      g.haptics.tick();
      this.saveHi();
      g.say(`You found the lost ${it.lost.kind}! Handed in at ${this.cur}. ${this.stats.objects} lost thing${this.stats.objects === 1 ? '' : 's'} found.`);
      it.lost = null;
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
    // the exits. Walking in deliberately — not brushing past (lift
    // landings can live near a doorway, and alighting shouldn't eject you)
    const locked = it.rescue && !it.rescue.found;
    const atDoor = (c, r) => {
      const gx = c * TILE + 16, gy = (r + 1) * TILE;
      return Math.abs(px - gx) < 15 && Math.abs(py - gy) < 36 && !g.player.onLift;
    };
    if (!locked) {
      // the WAY OUT is always there: surfacing ends the visit, wherever
      // you were headed (a bird can always just fly out of a station)
      const o = it.def.gateOut;
      if (o && atDoor(o.c, o.r)) { this.surface(); return; }
      // …or any platform door. Every door is a real departure — the
      // west end of a platform holds the westbound train, the east end
      // the eastbound, exactly as the network runs, whatever the errand.
      // Board a door and you go where its track goes. (Your own line's
      // train wins the tie where lines share a platform.)
      if (!this.scene) {
        for (const pd of it.def.platDefs) {
          for (const d of Object.values(pd.doors)) {
            if (!atDoor(d.c, d.r)) continue;
            const edge = (it.pendingEdge && it.gate === d) ? it.pendingEdge
              : (d.edges.find(e => e.line === this.line) || d.edges[0]);
            if (!edge) continue;
            it.pendingEdge = edge;
            it.gate = d;
            const bgx = d.c * TILE + 16, bgy = (d.r + 1) * TILE;
            this.scene = { kind: 'board', t: 0, doorX: bgx, baseY: bgy };
            g.camFocus = { x: bgx, y: bgy };
            g.foley.whoosh();
            g.haptics.thud();
            g.say(`All aboard: ${boundWord(this.cur, edge.to).toLowerCase()} ${LINE_SHORT[edge.line] || edge.line} line to ${edge.to}.`);
            break;
          }
          if (this.scene) break;
        }
      }
    }
  }
  // ---------------------------------------------------------- sim
  update(dt) {
    if (this.arriveT > 0) this.arriveT -= dt;
    if (this.flutterT > 0) this.flutterT -= dt;
    if (this.toast) {
      this.toast.t += dt;
      if (!this.toast.leaving && this.toast.t >= this.toast.ttl) this.toast.leaving = this.toast.t;
      if (this.toast.leaving && this.toast.t >= this.toast.leaving + 0.3) this.toast = null;
    }
    if (this.lineFlash && (this.lineFlash.t -= dt / 0.9) <= 0) this.lineFlash = null;
    // ten game-seconds per real second, and never night: past nine in
    // the evening the clock snaps to half six the next morning
    this.clock += dt * 10 / 60;
    if (this.clock >= 21 * 60) { this.clock = 6.5 * 60; this.day++; }
    // a full-screen station postcard holds the world still until read
    if (this.factCard) { this.factCard.t += dt; return; }
    if (this.interior) { this.updateInterior(dt); return; }   // (the toast ticked above)
    if (this.finale) {
      // the long flight home: camera glides across the city, the whole
      // family swirling in one wide murmuration around it
      const f = this.finale;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e2 = k * k * (3 - 2 * k);
      this.cam[0] = f.from[0] + (f.to[0] - f.from[0]) * e2;
      this.cam[1] = f.from[1] + (f.to[1] - f.from[1]) * e2;
      const t = performance.now() / 1000;
      const [cx2, cy2] = this.toScreen(this.cam);
      flockStep(this.flock, dt,
        cx2 + Math.sin(t * 0.7) * 70,
        cy2 - 14 + Math.cos(t * 0.5) * 44, t, 2.4);
      if (f.t > f.swells * 5 + 4) { f.swells++; this.swellMusic(); }
      if (f.t >= f.dur + 3) {
        this.finale = null;
        this.cur = f.home;   // home to roost
        // the journey's own postcard: what this flock actually did
        this.factCard = {
          title: 'HOME TO ROOST',
          station: 'UNFLOCKABLE',
          fact: `${this.roster.length} birds fly home together — ${this.stats.stops} stops flown, `
            + `${this.stats.visited.size} stations seen`
            + `${this.stats.objects ? `, ${this.stats.objects} lost thing${this.stats.objects === 1 ? '' : 's'} found` : ''}, `
            + `${this.score} points. London is yours now: the other birds are still out there.`,
          t: 0,
        };
        this.updateMusic();
        this.g.say(`Home to roost at Liverpool Street. All ${this.roster.length} birds together — ${this.stats.stops} stops flown, ${this.stats.visited.size} stations seen. Fly together as long as you like.`);
      }
      return;
    }
    if (this.gather) {
      this.gather.t += dt;
      if (this.gather.t >= this.gather.dur) {
        // the flock has settled; going inside is YOUR act — press GO
        this.gather = null;
        this.g.say(`The flock is gathered at ${this.cur}. Press GO to head inside for ${this.objective?.name || 'a look around'}.`);
        return;
      }
    }
    if (this.travel) {
      this.travel.t += dt / this.travel.dur;
      if (this.travel.t >= 1) {
        const rode = this.travel.edge;
        this.lastRide = { line: rode.line, from: this.cur, at: rode.to };
        this.cur = rode.to;
        this.line = rode.line;
        this.travel = null;
        this.stats.stops++;
        this.stats.visited.add(this.cur);
        this.g.foley.step();
        // arriving at a node is a felt thing: a soft buzz in the hand,
        // and the flock flutters down to a near-hover while it settles
        this.flutterT = 0.9;
        if (this.freePos) this.freePos = [...POS[this.cur]];
        this.g.haptics.flutter();
        if (this.objective && this.cur === this.objective.at) {
          this.gather = { t: 0, dur: 1.7 };
          this.g.say(`${this.cur} — this is the place. The flock gathers…`);
          return;
        }
        this.g.say(`${this.cur}. ${this.describeStation()}`);
      }
    }
    // the flock swirls around the map cursor; the camera glides after it
    const t = performance.now() / 1000;
    const k = Math.min(1, this.travel ? this.travel.t : 0);
    const p = this.travel
      ? [this.travel.a[0] + (this.travel.b[0] - this.travel.a[0]) * k,
         this.travel.a[1] + (this.travel.b[1] - this.travel.a[1]) * k]
      : (this.freePos ?? POS[this.cur]);
    const ease = 1 - Math.exp(-dt * 3);
    this.cam[0] += (p[0] - this.cam[0]) * ease;
    this.cam[1] += (p[1] - this.cam[1]) * ease;
    if ((this.mapZoom || 1) < 0.999) this.clampCam();
    const [lx, ly] = this.toScreen(p);
    flockStep(this.flock, dt, lx, ly - 14, t, this.flutterT > 0 ? 0.28 : 0.85);
  }
  // word-wrap into centred lines; returns the lines it drew
  wrapText(ctx, text, cx, y, maxW, px, lineH, weight = '', family = 'Georgia, serif') {
    ctx.font = `${weight} ${px}px ${family}`.trim();
    const words = String(text).split(' ');
    let line = '', yy = y;
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(probe).width > maxW) {
        ctx.fillText(line, cx, yy);
        line = word; yy += lineH;
      } else line = probe;
    }
    if (line) ctx.fillText(line, cx, yy);
    return yy + lineH;
  }
  // the station's one true thing, FULL SCREEN on paper: big station
  // name, every line's exact colour with its hex code, the story in
  // readable type — and it waits until dismissed. No squinting.
  drawFactOverlay(ctx) {
    const g = this.g, w = g.cssW, h = g.cssH;
    const fc = this.factCard;
    const fs = Math.max(19, Math.min(30, w / 15));
    const cw = Math.min(w - 20, 600);
    const cx = w / 2;
    ctx.save();
    // the map dims to paper behind the postcard
    ctx.fillStyle = 'rgba(242,236,221,0.93)';
    ctx.fillRect(0, 0, w, h);
    // gentle arrival: the card settles into place
    const ease = 1 - Math.pow(1 - Math.min(1, fc.t / 0.35), 3);
    ctx.translate(0, (1 - ease) * 26);
    // measure the pieces before drawing the case around them
    const lineIds = (NETWORK.stations[fc.station]?.lines || []).filter(l => LINES[l]);
    const chipFs = fs * 0.6;
    ctx.font = `bold ${chipFs}px Georgia, serif`;
    const chips = lineIds.map(l => {
      const label = (LINE_SHORT[l] || l).toUpperCase();   // the swatch IS the colour — no hex in play
      return { l, label, w: chipFs * 1.7 + 8 + ctx.measureText(label).width + 14 };
    });
    const chipRows = [];
    let row = [], rw = 0;
    for (const c of chips) {
      if (row.length && rw + c.w > cw - 30) { chipRows.push(row); row = []; rw = 0; }
      row.push(c); rw += c.w;
    }
    if (row.length) chipRows.push(row);
    const bodyFs = fs * 0.92, bodyLh = fs * 1.18;
    ctx.font = `italic ${bodyFs}px Georgia, serif`;
    const words = fc.fact.split(' ');
    let nLines = 1, probe = '';
    for (const word of words) {
      const test = probe ? `${probe} ${word}` : word;
      if (probe && ctx.measureText(test).width > cw - 56) { nLines++; probe = word; }
      else probe = test;
    }
    const chipH = fs * 1.3;
    const ch = fs * 1.5 + fs * 1.9 + chipRows.length * chipH + fs * 0.8
      + nLines * bodyLh + fs * 2.1;
    const cy = Math.max(10, (h - ch) / 2 - fs);
    // the postcard case
    ctx.fillStyle = 'rgba(247,242,230,0.99)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, cy, cw, ch, 14);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    let yy = cy + fs * 1.15;
    ctx.fillStyle = PALETTE.platform;
    ctx.font = `bold ${fs * 0.55}px Georgia, serif`;
    ctx.fillText((fc.title || 'DID YOU KNOW').split('').join(' '), cx, yy);
    // the station, unmissable
    yy += fs * 1.5;
    ctx.fillStyle = PALETTE.ink;
    this.fitText(ctx, fc.station, cx, yy, cw - 36, fs * 1.35);
    // its lines: exact colour swatch + exact colour code, always shown
    yy += fs * 0.75;
    for (const cr of chipRows) {
      const total = cr.reduce((a, c) => a + c.w, 0);
      let xx = cx - total / 2;
      for (const c of cr) {
        const sw = chipFs * 1.7;
        ctx.fillStyle = LINES[c.l].color;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(xx, yy - chipFs * 0.05, sw, chipFs * 1.05, 3);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETTE.ink;
        ctx.font = `bold ${chipFs}px Georgia, serif`;
        ctx.textAlign = 'left';
        ctx.fillText(c.label, xx + sw + 8, yy + chipFs * 0.82);
        xx += c.w;
      }
      yy += chipH;
    }
    ctx.textAlign = 'center';
    // the story itself, big enough to read on a phone
    yy += fs * 0.8;
    ctx.fillStyle = PALETTE.ink;
    yy = this.wrapText(ctx, fc.fact, cx, yy + bodyFs * 0.4, cw - 56, bodyFs, bodyLh, 'italic');
    // dismiss hint, breathing
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(fc.t * 3.2);
    ctx.fillStyle = PALETTE.green || PALETTE.platform;
    ctx.font = `bold ${fs * 0.55}px Georgia, serif`;
    ctx.fillText(g.touchUI ? 'TAP TO CONTINUE' : 'TAP · JUMP · ENTER TO CONTINUE', cx, cy + ch - fs * 0.75);
    ctx.restore();
  }
  // draw one line, shrinking the font just enough to fit maxW
  fitText(ctx, text, x, y, maxW, px, weight = 'bold', family = 'Georgia, serif') {
    ctx.font = `${weight} ${px}px ${family}`;
    const tw = ctx.measureText(text).width;
    if (tw > maxW) ctx.font = `${weight} ${Math.max(12, px * maxW / tw)}px ${family}`;
    ctx.fillText(text, x, y);
  }
  // ---------------------------------------------------------- draw
  draw(ctx) {
    const g = this.g, w = g.cssW, h = g.cssH;
    const t = performance.now() / 1000;
    // phone-first type: readable at arm's length, shrink-to-fit when long
    const fs = Math.max(17, Math.min(24, w / 22));
    if (this.interior) { this.drawInterior(ctx, fs); this.drawToast(ctx, fs); return; }
    ctx.save();
    const ob = this.objective;
    ctx.textAlign = 'center';

    // the Thames first, under everything: the one landmark even the
    // schematic map never dared drop. A soft ribbon in map-water blue.
    if (NETWORK.thames) {
      const s = this.mapScale();
      ctx.strokeStyle = 'rgba(146,183,205,0.55)';
      ctx.lineWidth = Math.max(6, s * 0.85);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (const p of NETWORK.thames) {
        const [x, y] = this.toScreen(p);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // track — drawn segment by segment through the map camera; where
    // lines share a corridor they ride offset side by side, and the
    // octolinear bake keeps everything on the 45° grid. The diagram
    // LANGUAGE of a transit map, in our own lino ink.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const onScreen = (x, y, m = 60) => x > -m && x < w + m && y > -m && y < h + m;
    const segOffset = (lineId, a, b) => {
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const sharers = EDGE_LINES.get(k) || [lineId];
      const off = (sharers.indexOf(lineId) - (sharers.length - 1) / 2) * 3.6;
      // perpendicular in the canonical (alphabetical) direction so both
      // draw orders agree which side is which
      const [ca, cb] = a < b ? [a, b] : [b, a];
      const [ax, ay] = this.toXY(ca), [bx, by] = this.toXY(cb);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      return [(-(by - ay) / len) * off, ((bx - ax) / len) * off];
    };
    const traceSegs = (lineId, def, width, style) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (const chain of def.chains) {
        for (let i = 0; i + 1 < chain.length; i++) {
          const a = chain[i], b = chain[i + 1];
          if (a === b) continue;
          const [ax, ay] = this.toXY(a), [bx, by] = this.toXY(b);
          if (!onScreen(ax, ay, 140) && !onScreen(bx, by, 140)) continue;
          const [ox, oy] = segOffset(lineId, a, b);
          ctx.moveTo(ax + ox, ay + oy);
          ctx.lineTo(bx + ox, by + oy);
        }
      }
      ctx.stroke();
    };
    const lf = this.lineFlash;
    for (const [lineId, def] of Object.entries(LINES)) {
      const shadowed = lf && lineId !== lf.line && lineId !== lf.target;
      if (shadowed) ctx.globalAlpha = Math.max(0.15, 1 - lf.t * 0.85);
      if (def.pale) traceSegs(lineId, def, 8.6, 'rgba(38,34,30,0.5)');   // ink underlay keeps pale inks legible
      traceSegs(lineId, def, 6.4, def.color);
      if (def.hollow) traceSegs(lineId, def, 2.4, PALETTE.paper);        // Overground-style hollow stripe
      if (shadowed) ctx.globalAlpha = 1;
      // one-way stretches wear a little arrow in their served direction
      for (const [f, t2] of def.oneWay || []) {
        const [ax, ay] = this.toXY(f), [bx, by] = this.toXY(t2);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (!onScreen(mx, my)) continue;
        const ang = Math.atan2(by - ay, bx - ax);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(ang);
        ctx.fillStyle = PALETTE.paper;
        ctx.beginPath();
        ctx.moveTo(6.5, 0); ctx.lineTo(-3.5, -5); ctx.lineTo(-3.5, 5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    }
    // stations — interchanges wear rings, ordinary stops wear tick marks
    // off the side of their line; names only where they matter: where you
    // are, where you can fly next, and who you're looking for
    const nbrs = new Set(EDGES.get(this.cur).map(e => e.to));
    ctx.font = `bold ${Math.max(11, fs * 0.56)}px Georgia, serif`;
    for (const name of Object.keys(POS)) {
      const [x, y] = this.toXY(name);
      if (!onScreen(x, y)) continue;
      const inter = INTER_SET.has(name);
      const here = name === this.cur;
      if (inter || here) {
        if (here && !this.travel && !this.finale) {
          // your station breathes: swollen ring and a warm glow, the
          // standing invitation that GO goes HERE
          const pulse = 1 + Math.sin(t * 3.1) * 0.16;
          const halo = ctx.createRadialGradient(x, y, 2, x, y, 22 * pulse);
          halo.addColorStop(0, 'rgba(46,94,69,0.45)');
          halo.addColorStop(1, 'rgba(46,94,69,0)');
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, (inter ? 8.5 : 7) * pulse, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.paper; ctx.fill();
          ctx.lineWidth = 3.4;
          ctx.strokeStyle = PALETTE.green || PALETTE.ink; ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(x, y, inter ? 8 : 6.5, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.paper; ctx.fill();
          ctx.lineWidth = 3.2;
          ctx.strokeStyle = PALETTE.ink; ctx.stroke();
        }
      } else {
        // a tick perpendicular to the line, sticking out one side
        const e0 = EDGES.get(name)[0];
        let tx = 0, ty = -1;
        if (e0) {
          const [nx, ny] = this.toXY(e0.to);
          const len = Math.hypot(nx - x, ny - y) || 1;
          tx = -(ny - y) / len; ty = (nx - x) / len;
        }
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(x + tx * 4, y + ty * 4);
        ctx.lineTo(x + tx * 11, y + ty * 11);
        ctx.stroke();
      }
      if (g.showCustomAudio && g.soundtrack?.tracks?.perStation[name]) {
        // CUSTOM AUDIO: this station owns a song — a gold record, tappable
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#b98a2e'; ctx.fill();
        ctx.lineWidth = 2.6; ctx.strokeStyle = PALETTE.ink; ctx.stroke();
        ctx.fillStyle = PALETTE.ink;
        const keepFont = ctx.font;
        ctx.font = `bold ${fs * 0.62}px Georgia, serif`;
        const keepAlign = ctx.textAlign;
        ctx.textAlign = 'center';
        ctx.fillText('♪', x, y + fs * 0.22);
        ctx.font = keepFont;
        ctx.textAlign = keepAlign;
      }
      if (ob && name === ob.at) {
        ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(t * 4) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.5; ctx.stroke();
        // the waiting bird perches beside its station ring
        drawBird(ctx, ob.sp, { x: x + 26, y: y - 12, size: 24, facing: -1, phase: t * 8, pose: 'stand' });
      }
      const labelled = here || nbrs.has(name) || (ob && name === ob.at);
      // faint names only for the BIG interchanges — zone 1 gets crowded
      if (labelled || (inter && LINES_AT.get(name).size >= 3)) {
        ctx.fillStyle = PALETTE.ink;
        ctx.globalAlpha = labelled ? 1 : 0.4;
        const above = y < h * 0.56;
        ctx.fillText(name, x, y + (above ? -15 : 25));
        ctx.globalAlpha = 1;
      }
      // step-free intel just where the next decision lives
      if (labelled && this.stationLiftOut(name)) {
        const above = y < h * 0.56;
        const my = y + (above ? -37 : 42);
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1.8;
        ctx.strokeRect(x - 8, my - 8, 16, 16);
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x - 6, my - 6); ctx.lineTo(x + 6, my + 6);
        ctx.moveTo(x + 6, my - 6); ctx.lineTo(x - 6, my + 6);
        ctx.stroke();
      }
    }
    // the lost bird may be way across the city: an edge arrow points the
    // way, hugging the band between masthead and thumbs
    if (ob) {
      const [ox, oy] = this.toXY(ob.at);
      if (!onScreen(ox, oy, -20)) {
        const band = this.viewBand();
        const cx = w / 2, cy = band.cy;
        const dx = ox - cx, dy = oy - cy;
        const kk = 1 / Math.max(Math.abs(dx) / (w / 2 - 46), Math.abs(dy) / ((h - band.top - band.bot) / 2 - 34));
        const ex = cx + dx * kk, ey = cy + dy * kk;
        const ang = Math.atan2(dy, dx);
        const pulse = 1 + Math.sin(t * 5) * 0.12;
        ctx.save();
        ctx.translate(ex, ey);
        drawBird(ctx, ob.sp, { x: 0, y: 12, size: 26, facing: dx < 0 ? -1 : 1, phase: t * 8, pose: 'flit' });
        ctx.rotate(ang);
        ctx.fillStyle = PALETTE.danger;
        ctx.beginPath();
        ctx.moveTo(20 * pulse, 0); ctx.lineTo(6, -8); ctx.lineTo(6, 8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
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
    // a slim masthead — tiny tally row, one big quest line, one note —
    // so the city keeps the screen; the how-to lives in settings now,
    // and the touch band below stays honest map-free space
    const { top: headH, bot: botInset } = this.viewBand();
    ctx.fillStyle = 'rgba(242,236,221,0.88)';
    ctx.fillRect(0, 0, w, headH);
    if (!g.touchUI) ctx.fillRect(0, h - fs * 1.9, w, fs * 1.9);
    ctx.strokeStyle = 'rgba(38,34,30,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, headH); ctx.lineTo(w, headH); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.7;
    ctx.font = `bold ${fs * 0.6}px Georgia, serif`;
    const mast = `FLOCK ${this.roster.length}/${this.finaleDone ? LOST.length + 1 : 7} · SCORE ${this.score} · ${this.clockText()}`;
    ctx.fillText(mast, 12, fs * 0.95);
    this.drawClock(ctx, 12 + ctx.measureText(mast).width + fs * 0.75, fs * 0.72, fs * 0.5);
    ctx.globalAlpha = 1;
    // the roster roosts along the top right, under the speaker
    this.roster.slice(0, 12).forEach((b, i) => {
      drawBird(ctx, b.sp, {
        x: w - 56 - i * 18, y: fs * 0.95, size: 17,
        facing: -1, phase: t * 3 + i, pose: 'stand',
      });
    });
    // the two questions the header must answer at a glance:
    // HERE (where am I) and NEXT (what do I do about it)
    ctx.textAlign = 'left';
    const labX = 12;
    ctx.font = `bold ${fs * 0.55}px Georgia, serif`;
    ctx.fillStyle = PALETTE.platform;
    ctx.fillText('NOW', labX, fs * 2.15);
    ctx.fillText('NEXT', labX, fs * 3.55);
    const valX = labX + ctx.measureText('NEXT').width + 12;
    ctx.fillStyle = PALETTE.ink;
    this.fitText(ctx, this.cur, valX, fs * 2.2, w - valX - 12, fs * 1.05);
    if (this.changeHint) {
      // an armed line change owns the NEXT line until GO (or a new swipe)
      const che = this.changeHint.edge;
      ctx.fillStyle = LINES[che.line]?.pale ? PALETTE.ink : (LINES[che.line]?.color || PALETTE.ink);
      this.fitText(ctx, `GO: change to the ${LINE_SHORT[che.line] || che.line} line toward ${che.to}`, valX, fs * 3.55, w - valX - fs * 5.3, fs * 0.95);
      ctx.fillStyle = PALETTE.ink;
    } else if (ob) {
      const hop = this.nextHopTo(ob.at);
      let nx = valX;
      if (hop) {
        // the actual move, drawn: an arrow in the line's colour
        const dx = POS[hop.edge.to][0] - POS[this.cur][0];
        const dy = POS[hop.edge.to][1] - POS[this.cur][1];
        const ang = Math.atan2(dy, dx);
        const ay = fs * 3.25;
        ctx.save();
        ctx.translate(nx + fs * 0.55, ay);
        ctx.rotate(ang);
        ctx.fillStyle = LINES[hop.edge.line]?.color || PALETTE.ink;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fs * 0.62, 0);
        ctx.lineTo(-fs * 0.4, -fs * 0.42);
        ctx.lineTo(-fs * 0.4, fs * 0.42);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        nx += fs * 1.35;
        ctx.fillStyle = PALETTE.ink;
        const hopTxt = `${LINE_SHORT[hop.edge.line] || hop.edge.line} ${this.compass(dx, dy)} · ${hop.stops} stop${hop.stops === 1 ? '' : 's'} to ${ob.name}`;
        this.fitText(ctx, hopTxt, nx, fs * 3.55, w - nx - fs * 6.4, fs * 0.95);
      } else {
        // we're standing on it
        ctx.fillStyle = PALETTE.danger;
        this.fitText(ctx, `${ob.name} is HERE — press GO to drop in!`, nx, fs * 3.55, w - nx - fs * 6.4, fs * 0.95);
        ctx.fillStyle = PALETTE.ink;
      }
      // the bird in question perches on the end of the line (left of QUIT)
      drawBird(ctx, ob.sp, { x: w - fs * 5.5, y: fs * 3.7, size: fs * 1.15, facing: -1, phase: t * 6, pose: 'stand' });
      ctx.globalAlpha = 0.6;
      this.fitText(ctx, `${ob.name} the ${ob.sp}: ${ob.note}`, labX, fs * 4.5, w - labX - fs * 3.7, fs * 0.62, 'italic');
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = PALETTE.platform;
      this.fitText(ctx, 'fly together as long as you like — unflockable', valX, fs * 3.55, w - valX - fs * 5.3, fs * 0.95);
      ctx.fillStyle = PALETTE.ink;
    }
    ctx.textAlign = 'center';
    const msgY = headH + (h - botInset - headH) * 0.3;
    if (this.arriveT > 0) {
      ctx.fillStyle = PALETTE.platform;
      ctx.font = `bold ${fs * 1.2}px Georgia, serif`;
      ctx.fillText(this.arriveMsg, w / 2, msgY);
    }
    if (this.gather) {
      if (this.arriveT <= 0) {   // a reunion banner outranks the gather line
        ctx.fillStyle = PALETTE.ink;
        ctx.globalAlpha = 0.75;
        ctx.font = `italic ${fs * 0.95}px Georgia, serif`;
        ctx.fillText(`the flock gathers at ${this.cur}…`, w / 2, msgY);
        ctx.globalAlpha = 1;
      }
    }
    // ⏏ QUIT: same corner as the interior's ⌂ MAP chip — it asks first
    if (!this.finale && !this.over && !this.travel) {
      const chips = [[this.menuButtonRect(), '\u23cf QUIT'], [this.gearButtonRect(), '\u2699']];
      for (const [rect, label] of chips) {
        ctx.fillStyle = 'rgba(247,242,230,0.92)';
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETTE.ink;
        ctx.font = `bold ${fs * 0.52}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h * 0.66);
        ctx.textAlign = 'left';
      }
    }
    // the postcard covers everything, and waits
    if (this.factCard) this.drawFactOverlay(ctx);
    // …and the quit question outranks even the postcard
    if (this.quitConfirm) this.drawQuitDialog(ctx);
    ctx.restore();
    this.drawToast(ctx, fs);
  }
  // the Did-you-know as a visitor, not a gatekeeper: slides down from
  // above, lingers up to five seconds or until any interaction, and
  // slides away while the game plays on underneath
  drawToast(ctx, fs) {
    const tst = this.toast;
    if (!tst) return;
    const g = this.g, w = g.cssW;
    const cw = Math.min(w - 16, 560), cx = w / 2;
    const bodyFs = Math.max(14, fs * 0.78), lh = bodyFs * 1.3;
    ctx.save();
    ctx.font = `italic ${bodyFs}px Georgia, serif`;
    const words = tst.fact.split(' ');
    let nLines = 1, probe = '';
    for (const word of words) {
      const test = probe ? `${probe} ${word}` : word;
      if (probe && ctx.measureText(test).width > cw - 44) { nLines++; probe = word; }
      else probe = test;
    }
    const ch = fs * 1.5 + nLines * lh + fs * 0.9;
    const inK = Math.min(1, tst.t / 0.35);
    const easeIn = 1 - Math.pow(1 - inK, 3);
    const outK = tst.leaving ? Math.min(1, (tst.t - tst.leaving) / 0.3) : 0;
    const y = -ch + (ch + 8) * easeIn - (ch + 16) * outK * outK;
    ctx.fillStyle = 'rgba(247,242,230,0.97)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(cx - cw / 2, y, cw, ch, 12); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.platform;
    ctx.font = `bold ${fs * 0.5}px Georgia, serif`;
    ctx.fillText(`DID YOU KNOW · ${tst.station}`, cx, y + fs * 0.95);
    ctx.fillStyle = PALETTE.ink;
    this.wrapText(ctx, tst.fact, cx, y + fs * 1.5 + bodyFs * 0.6, cw - 44, bodyFs, lh, 'italic');
    ctx.restore();
  }
  dismissToast() {
    if (this.toast && !this.toast.leaving) this.toast.leaving = this.toast.t;
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
    // the cars ride over the world: box, skeleton riders, glass doors
    this.drawLiftCars(ctx, it, t);
    // broken facilities glitching: a 0.3s orientation flip, or a Jet Set
    // Willy colour roll. Under prefers-reduced-motion, a calm static X.
    for (const gl of it.glitches) {
      const gx0 = gl.x0, gw = gl.x1 - gl.x0, gy0 = gl.y0, gh = gl.y1 - gl.y0;
      if (g.reducedMotion) {
        if (gl.kind === 'esc') {   // (broken lifts already wear the engine's crossed sign)
          const cx2 = gx0 + gw / 2, sy = gy0 + gh / 2;
          ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 2.5;
          ctx.strokeRect(cx2 - 12, sy - 12, 24, 24);
          ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(cx2 - 8, sy - 8); ctx.lineTo(cx2 + 8, sy + 8);
          ctx.moveTo(cx2 + 8, sy - 8); ctx.lineTo(cx2 - 8, sy + 8);
          ctx.stroke();
        }
        continue;
      }
      if (gl.until <= 0) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.clip();
      if (gl.flip) {
        // upside-down and wrong: blank it, redraw the works inverted
        ctx.fillStyle = PALETTE.paper;
        ctx.fillRect(gx0, gy0, gw, gh);
        ctx.translate(gx0 + gw / 2, gy0 + gh / 2);
        ctx.scale(-1, -1);
        ctx.translate(-(gx0 + gw / 2), -(gy0 + gh / 2));
        ctx.strokeStyle = PALETTE.ladder;
        ctx.lineWidth = 3;
        if (gl.kind === 'esc') {
          for (let y = gy0 + 8; y < gy0 + gh; y += 11) {
            ctx.beginPath(); ctx.moveTo(gx0 + 3, y + 6); ctx.lineTo(gx0 + gw - 3, y); ctx.stroke();
          }
        } else {
          ctx.setLineDash([4, 8]);
          ctx.beginPath();
          ctx.moveTo(gx0 + gw / 2, gy0); ctx.lineTo(gx0 + gw / 2, gy0 + gh);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = PALETTE.ladder;
          ctx.fillRect(gx0 + 2, gy0 + gh * 0.4, gw - 4, 9);
        }
      } else {
        // every colour it owns, smoothly, like a Jet Set Willy treasure
        const hue = (performance.now() / 2.5) % 360;
        ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.5)`;
        ctx.fillRect(gx0, gy0, gw, gh);
        ctx.fillStyle = `hsla(${(hue + 120) % 360}, 85%, 60%, 0.35)`;
        ctx.fillRect(gx0, gy0 + gh / 3, gw, gh / 3);
      }
      ctx.restore();
    }
    // buddies fly feathered — unless the flock is in the lift, where
    // everyone is bones behind the glass instead
    if (!it.playerCar) {
      for (const b of it.buddies) {
        drawBird(ctx, b.sp, {
          x: b.x, y: b.y, size: BIRD_PX[b.sp] || 32,
          facing: (b.vx || 0) < -8 ? -1 : 1, phase: t * 14 + b.ph,
          pose: Math.abs(b.vy || 0) > 30 ? ((b.vy || 0) < 0 ? 'airup' : 'airdown') : 'flit',
        });
      }
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
      const dir = sc.doorX < W / 2 ? -1 : 1;   // left platforms run the other way
      let door = 0, dx = 0, moving = false;
      if (sc.kind === 'arrive') {
        const A = 1.0, B = 0.4, C = 1.1, D = 0.9;
        if (sc.t < A) { dx = -dir * 460 * (1 - ease(sc.t / A)); moving = sc.t < A * 0.85; }
        else if (sc.t < A + B) { door = (sc.t - A) / B; }
        else if (sc.t < A + B + C) { door = 1; }
        else {
          const k = (sc.t - A - B - C) / D;
          door = Math.max(0, 1 - k * 2.5);
          dx = k > 0.35 ? Math.pow((k - 0.35) / 0.65, 2) * dir * 580 : 0;
          moving = Math.abs(dx) > 4;
        }
      } else {
        const A = 0.85, B = 0.5, C = 1.0;
        if (sc.t < A + B) door = 1;
        else {
          const k = (sc.t - A - B) / C;
          door = Math.max(0, 1 - k * 2.8);
          dx = k > 0.3 ? Math.pow((k - 0.3) / 0.7, 2) * dir * 580 : 0;
          moving = Math.abs(dx) > 4;
        }
      }
      drawTrain(ctx, sc.doorX, sc.baseY, col, { door, dx, moving, dir });
    }
    ctx.restore();
    // HUD strip
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.9)';
    ctx.fillRect(0, 0, w, fs * 3);
    ctx.strokeStyle = 'rgba(38,34,30,0.35)';
    ctx.beginPath(); ctx.moveTo(0, fs * 3); ctx.lineTo(w, fs * 3); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    // compact tallies at the left; big readable lines in the rest
    ctx.textAlign = 'left';
    ctx.font = `bold ${fs * 0.62}px Georgia, serif`;
    const flockTxt = `FLOCK ${this.roster.length}/${this.finaleDone ? LOST.length + 1 : 7}`;
    ctx.fillText(flockTxt, 10, fs * 1.1);
    ctx.fillText(`SCORE ${this.score} · ${this.clockText()}`, 10, fs * 2.1);
    this.drawClock(ctx, 10 + ctx.measureText(flockTxt).width + fs * 0.75, fs * 0.85, fs * 0.5);
    const lx = 20 + ctx.measureText(`SCORE ${this.score}`).width;
    const cw = w - lx * 2;   // symmetric so centred text clears the tallies
    ctx.textAlign = 'center';
    // HERE: station and the level you're standing on, live
    const fi = this.playerFloorIdx(it);
    const lvl = it.def.levels[fi] || '';
    this.fitText(ctx, `${this.cur} · ${lvl}`, w / 2, fs * 1.25, cw, fs);
    // NEXT: the task, with an arrow pointing at its floor
    let targetRow, task;
    if (it.rescue && !it.rescue.found) {
      targetRow = it.rescue.y / TILE;
      task = `find ${it.rescue.name} the ${it.rescue.sp}`;
    } else if (it.rescue) {
      // advice only: the doors themselves never bend to the errand
      const hop = this.objective ? this.nextHopTo(this.objective.at) : null;
      const door = hop && doorForEdge(it.def, hop.edge);
      if (door) {
        targetRow = door.r + 1;
        task = `${it.rescue.name} aboard — ${boundWord(this.cur, hop.edge.to).toLowerCase()} ${LINE_SHORT[hop.edge.line] || hop.edge.line} train`;
      } else {
        targetRow = it.def.gateOut.r + 1;
        task = `${it.rescue.name} aboard — the WAY OUT`;
      }
    } else if (it.pendingEdge) {
      targetRow = it.gate.r + 1;
      task = `the ${LINE_SHORT[it.pendingEdge.line] || it.pendingEdge.line} line train`;
    } else {
      targetRow = it.def.gateOut.r + 1;
      task = 'wander — the WAY OUT when ready';
    }
    const ti = it.floorRows.indexOf(targetRow);
    let arrow;
    if (ti >= 0 && ti < fi) arrow = '↑';
    else if (ti >= 0 && ti > fi) arrow = '↓';
    else {
      const txx = it.rescue && !it.rescue.found ? it.rescue.x : (it.pendingEdge ? it.gate.c : it.def.gateOut.c) * TILE + 16;
      arrow = txx < this.g.player.x ? '←' : '→';
    }
    ctx.fillStyle = PALETTE.platform;
    this.fitText(ctx, `${arrow} ${task}`, w / 2, fs * 2.42, cw, fs * 0.92);
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'left';
    // ⌂ MAP: one tap straight back out (ESC does the same)
    const mb = this.mapButtonRect();
    ctx.fillStyle = 'rgba(247,242,230,0.92)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(mb.x, mb.y, mb.w, mb.h, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `bold ${fs * 0.52}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⌂ MAP', mb.x + mb.w / 2, mb.y + mb.h * 0.66);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  clockText() {
    const mins = this.clock % (24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
  }
  // a little station clock, spinning ten times too fast — the rat race
  drawClock(ctx, x, y, r) {
    const mins = this.clock % (24 * 60);
    const h = mins / 60, m = mins % 60, s = (this.clock * 60) % 60;
    ctx.save();
    ctx.fillStyle = 'rgba(247,242,230,0.95)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 1.5), y + Math.sin(a) * (r - 1.5));
      ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
      ctx.stroke();
    }
    const hand = (frac, ln, w2, col) => {
      const a = frac * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = col; ctx.lineWidth = w2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * ln, y + Math.sin(a) * ln);
      ctx.stroke();
    };
    hand((h % 12) / 12, r * 0.5, 2, PALETTE.ink);
    hand(m / 60, r * 0.76, 1.5, PALETTE.ink);
    if (!this.g.reducedMotion) hand(s / 60, r * 0.84, 0.9, PALETTE.danger);
    ctx.restore();
  }
  mapButtonRect() {
    const w = this.g.cssW;
    const fs = Math.max(17, Math.min(24, w / 22));
    return { x: w - fs * 3.3 - 6, y: fs * 3.2, w: fs * 3.3, h: fs * 1.1 };
  }
  mapButtonHit(x, y) {
    const r = this.mapButtonRect();
    return x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 8 && y <= r.y + r.h + 8;
  }
  // ⏏ QUIT on the map screen lives in the SAME top-right spot as the
  // interior's ⌂ MAP chip — one learned corner for "leave this screen".
  // It never quits outright: the journey (flock, stops, lost property)
  // can't be resumed, so a small dialog asks first.
  menuButtonRect() { return this.mapButtonRect(); }
  // ⚙ SETTINGS sits just left of QUIT: mid-journey tweaks, no quitting
  gearButtonRect() {
    const r = this.mapButtonRect();
    const fs = Math.max(17, Math.min(24, this.g.cssW / 22));
    return { x: r.x - fs * 1.5 - 6, y: r.y, w: fs * 1.5, h: r.h };
  }
  gearButtonHit(x, y) {
    const r = this.gearButtonRect();
    return x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 8 && y <= r.y + r.h + 8;
  }
  menuButtonHit(x, y) {
    const r = this.menuButtonRect();
    return x >= r.x - 8 && x <= r.x + r.w + 8 && y >= r.y - 8 && y <= r.y + r.h + 8;
  }
  // with CUSTOM AUDIO on, stations that own a song are tappable on the
  // map — this answers "which one is under that finger?"
  songStationAt(px, py) {
    if (this.interior || this.travel) return null;
    const per = this.g.soundtrack?.tracks?.perStation ?? {};
    let best = null, bd = 20;
    for (const name of Object.keys(per)) {
      if (!POS[name]) continue;
      const [x, y] = this.toXY(name);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = name; }
    }
    return best;
  }
  requestQuit() {
    if (this.interior || this.travel || this.finale || this.over || this.quitConfirm) return false;
    this.quitConfirm = true;
    this.g.haptics.tick();
    this.g.say('Quit to the menu? The journey — flock, stops flown, lost property — will be lost. '
      + 'The high score stays. GO or Escape keeps flying; QUIT (or Enter) leaves.');
    return true;
  }
  cancelQuit() {
    if (!this.quitConfirm) return false;
    this.quitConfirm = false;
    this.g.say('Flying on.');
    return true;
  }
  quitDialogRects() {
    const g = this.g, w = g.cssW, h = g.cssH;
    const fs = Math.max(19, Math.min(30, w / 15));
    const cw = Math.min(w - 36, 430);
    const ch = fs * 6.4;
    const cx = (w - cw) / 2;
    const cy = Math.max(12, h * 0.5 - ch * 0.62);
    const bw = (cw - fs * 1.8) / 2;
    const bh = fs * 1.55;
    const by = cy + ch - bh - fs * 0.6;
    return {
      fs,
      card: { x: cx, y: cy, w: cw, h: ch },
      keep: { x: cx + fs * 0.6, y: by, w: bw, h: bh },
      quit: { x: cx + cw - bw - fs * 0.6, y: by, w: bw, h: bh },
    };
  }
  // a tap while the question is up: QUIT leaves, anywhere else stays.
  // Modal — returns true whenever the dialog was open.
  quitTap(x, y) {
    if (!this.quitConfirm) return false;
    const r = this.quitDialogRects();
    const within = b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (within(r.quit)) { this.exit(); return true; }
    this.cancelQuit();
    return true;
  }
  drawQuitDialog(ctx) {
    const g = this.g, w = g.cssW, h = g.cssH;
    const r = this.quitDialogRects();
    const fs = r.fs;
    ctx.save();
    ctx.fillStyle = 'rgba(242,236,221,0.88)';   // the map dims to paper
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(247,242,230,0.98)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(r.card.x, r.card.y, r.card.w, r.card.h, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.font = `bold ${fs * 0.95}px Georgia, serif`;
    ctx.fillText('LEAVE THE JOURNEY?', r.card.x + r.card.w / 2, r.card.y + fs * 1.45);
    ctx.font = `italic ${fs * 0.62}px Georgia, serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText('the flock, the stops flown and the lost things found', r.card.x + r.card.w / 2, r.card.y + fs * 2.55);
    ctx.fillText('will be gone — only the high score stays', r.card.x + r.card.w / 2, r.card.y + fs * 3.35);
    ctx.globalAlpha = 1;
    // KEEP FLYING is the big warm default; QUIT is quiet and outlined
    ctx.fillStyle = PALETTE.platform;
    ctx.beginPath(); ctx.roundRect(r.keep.x, r.keep.y, r.keep.w, r.keep.h, 8); ctx.fill();
    ctx.fillStyle = '#f7f2e6';
    ctx.font = `bold ${fs * 0.62}px Georgia, serif`;
    ctx.fillText('♥ KEEP FLYING', r.keep.x + r.keep.w / 2, r.keep.y + r.keep.h * 0.66);
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(r.quit.x, r.quit.y, r.quit.w, r.quit.h, 8); ctx.stroke();
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText('⏏ QUIT', r.quit.x + r.quit.w / 2, r.quit.y + r.quit.h * 0.66);
    ctx.restore();
  }
  // ------------------------------------------------ the earth beyond
  // The play area ends at the station walls, and the presentation says
  // so: a slab of London clay past each edge, seeded per station with
  // one cosily-drawn UNPLAYABLE wonder — big bones, a mammoth skull
  // with a dent-nosed saucer in it, a longship, a curious ring, an
  // underground river, an ammonite. Open-air stations get a thick
  // brick wall instead. Strictly dressing: muted, behind everything.
  drawEarthEdges(ctx, it, t) {
    const topY = (it.def.underground ? it.def.streetRow : it.floorRows[0]) * TILE;
    const seed = hashName(this.cur);
    this.drawEarthStrip(ctx, it, t, true, topY, seed * 2654435761 >>> 0);
    this.drawEarthStrip(ctx, it, t, false, topY, seed ^ 0x9e3779b9);
  }
  drawEarthStrip(ctx, it, t, left, topY, seed) {
    const wpx = 460;   // deep enough for a two-thirds-screen dig
    let rng = seed >>> 0 || 1;
    const rnd = n => { rng = (rng * 1103515245 + 12345) >>> 0; return (rng >>> 8) % n; };
    ctx.save();
    // everything is composed in left-wall space; the right strip is the
    // same drawing mirrored about the level's midline, so buried scenes
    // always disappear INTO the wall, whichever side they're on
    if (!left) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.beginPath(); ctx.rect(-wpx, topY, wpx, H + 120 - topY); ctx.clip();
    if (!it.def.underground) {
      // open air: a stout brick wall says "no further"
      ctx.fillStyle = '#8a5a44';
      ctx.fillRect(-wpx, topY, wpx, H + 120 - topY);
      ctx.strokeStyle = 'rgba(38,34,30,0.45)';
      ctx.lineWidth = 2;
      for (let y = topY; y < H + 100; y += 14) {
        ctx.beginPath(); ctx.moveTo(-wpx, y); ctx.lineTo(0, y); ctx.stroke();
        const off = ((y - topY) / 14) % 2 ? 10 : 24;
        for (let x = -wpx + off; x < 0; x += 28) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke();
        }
      }
    } else {
      // London clay, in lino: soil wash, wavy strata, seeded stones
      ctx.fillStyle = '#4d3d2c';
      ctx.fillRect(-wpx, topY, wpx, H + 120 - topY);
      ctx.strokeStyle = 'rgba(30,24,18,0.5)';
      ctx.lineWidth = 2;
      for (let y = topY + 28; y < H + 100; y += 46) {
        ctx.beginPath();
        for (let x = -wpx; x <= 0; x += 20) {
          const yy = y + Math.sin((x + seed % 97) * 0.06) * 5;
          x === -wpx ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,24,18,0.4)';
      for (let i = 0; i < 44; i++) {
        const sx = -wpx + 8 + rnd(wpx - 16), sy = topY + 12 + rnd(H + 90 - topY);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3 + rnd(4), 2 + rnd(3), rnd(6), 0, Math.PI * 2);
        ctx.fill();
      }
      // one buried wonder, hugging the wall so it half-shows in play
      const cy = topY + (H - topY) * 0.55 + rnd(60) - 30;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#d8c8a4';
      ctx.fillStyle = '#d8c8a4';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      const kind = rnd(7);
      if (kind === 0) this.buriedBones(ctx, -52, cy, rnd);
      else if (kind === 1) this.buriedMammothUfo(ctx, -68, cy - 20);
      else if (kind === 2) this.buriedLongship(ctx, -58, cy);
      else if (kind === 3) this.buriedRing(ctx, -44, cy);
      else if (kind === 4) this.buriedRiver(ctx, topY, t);
      else if (kind === 5) this.buriedAmmonite(ctx, -40, cy);
      else this.buriedPteroBike(ctx, -62, cy);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // the wall face itself: a firm ink edge with mortar ticks
    const wx = left ? 0 : W;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(wx, topY); ctx.lineTo(wx, H + 60); ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = topY + 10; y < H + 50; y += 26) {
      ctx.beginPath();
      ctx.moveTo(wx, y); ctx.lineTo(wx + (left ? -8 : 8), y);
      ctx.stroke();
    }
  }
  buriedBones(ctx, cx, cy, rnd) {
    const bone = (x, y, len, ang) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
      for (const e of [-len / 2, len / 2]) {
        ctx.beginPath(); ctx.arc(e, -4, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(e, 4, 4.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    };
    bone(cx - 8, cy - 6, 52, 0.5);
    bone(cx + 10, cy + 2, 52, -0.6);
    bone(cx - 4, cy + 34, 40, 0.12);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx - 30 + i * 9, cy - 34, 13 + i * 3, 0.7, 2.2);
      ctx.stroke();
    }
  }
  buriedMammothUfo(ctx, cx, cy) {
    // the great skull, tusks curling
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 7, cy - 3, 3.4, 0, Math.PI * 2); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 12, cy + 18);
      ctx.bezierCurveTo(cx + s * 34, cy + 42, cx + s * 62, cy + 34, cx + s * 58, cy + 8);
      ctx.stroke();
    }
    // spine and ribs marching away
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy + 4);
    ctx.quadraticCurveTo(cx + 64, cy - 10, cx + 96, cy + 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + 40 + i * 16, cy + 12, 14, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
    }
    // the saucer, nose-first into the skull, rim dented — case closed
    ctx.save();
    ctx.translate(cx - 14, cy - 34);
    ctx.rotate(0.7);
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -5, 10, Math.PI, 0); ctx.stroke();
    ctx.beginPath();                     // the dent
    ctx.moveTo(14, 4); ctx.lineTo(19, 8); ctx.lineTo(15, 10);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {      // impact shivers
      ctx.beginPath();
      ctx.moveTo(24 + i * 3, 12 + i * 5); ctx.lineTo(31 + i * 3, 16 + i * 5);
      ctx.stroke();
    }
    ctx.restore();
  }
  buriedLongship(ctx, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(cx - 56, cy - 18);
    ctx.quadraticCurveTo(cx, cy + 26, cx + 52, cy - 22);
    ctx.quadraticCurveTo(cx + 30, cy + 4, cx - 34, cy + 2);
    ctx.stroke();
    ctx.beginPath();                     // plank line
    ctx.moveTo(cx - 44, cy - 8);
    ctx.quadraticCurveTo(cx, cy + 14, cx + 42, cy - 12);
    ctx.stroke();
    ctx.beginPath();                     // proud prow curl
    ctx.moveTo(cx - 56, cy - 18);
    ctx.bezierCurveTo(cx - 66, cy - 34, cx - 52, cy - 44, cx - 46, cy - 34);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {        // shields along the gunwale
      ctx.beginPath();
      ctx.arc(cx - 24 + i * 16, cy - 4 - Math.abs(i - 1.5) * 3, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();                     // stump of mast
    ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 8, cy - 30);
    ctx.stroke();
  }
  buriedRing(ctx, cx, cy) {
    ctx.save();
    ctx.rotate?.call(ctx, 0);
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(cx, cy, 21, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 7; i++) {        // chevrons, none of them lit
      const a = (i / 7) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 27, cy + Math.sin(a) * 27 - 4);
      ctx.lineTo(cx + Math.cos(a) * 33, cy + Math.sin(a) * 33);
      ctx.lineTo(cx + Math.cos(a) * 27, cy + Math.sin(a) * 27 + 4);
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  buriedRiver(ctx, topY, t) {
    // a lost river slides by in the dark, minding its own business
    const rx = -46;
    ctx.save();
    ctx.strokeStyle = '#5a748c';
    ctx.lineWidth = 16;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    for (let y = topY; y <= H + 100; y += 12) {
      const x = rx + Math.sin(y * 0.035 + 1.3) * 12;
      y === topY ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#9fb4c4';
    const flow = (t * 30) % 24;
    for (let y = topY + flow; y <= H + 100; y += 24) {
      const x = rx + Math.sin(y * 0.035 + 1.3) * 12;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y + 5, x + 5, y); ctx.stroke();
    }
    ctx.restore();
  }
  buriedPteroBike(ctx, cx, cy) {
    // a fossilised pterodactyl, forever mid-commute
    // the bicycle
    for (const wx of [cx - 24, cx + 24]) {
      ctx.beginPath(); ctx.arc(wx, cy + 38, 13, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3 + 0.4;
        ctx.beginPath();
        ctx.moveTo(wx - Math.cos(a) * 13, cy + 38 - Math.sin(a) * 13);
        ctx.lineTo(wx + Math.cos(a) * 13, cy + 38 + Math.sin(a) * 13);
        ctx.stroke();
      }
    }
    ctx.beginPath();                       // frame
    ctx.moveTo(cx - 24, cy + 38); ctx.lineTo(cx - 10, cy + 12);
    ctx.lineTo(cx - 2, cy + 34); ctx.lineTo(cx - 24, cy + 38);
    ctx.moveTo(cx - 2, cy + 34); ctx.lineTo(cx + 24, cy + 38);
    ctx.moveTo(cx + 24, cy + 38); ctx.lineTo(cx + 30, cy + 10);
    ctx.stroke();
    ctx.beginPath();                       // saddle + bars
    ctx.moveTo(cx - 17, cy + 11); ctx.lineTo(cx - 4, cy + 12);
    ctx.moveTo(cx + 26, cy + 8); ctx.quadraticCurveTo(cx + 34, cy + 6, cx + 36, cy + 12);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 2, cy + 34, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();                       // pedals
    ctx.moveTo(cx - 8, cy + 40); ctx.lineTo(cx - 1, cy + 42);
    ctx.moveTo(cx + 4, cy + 27); ctx.lineTo(cx - 1, cy + 26);
    ctx.stroke();
    // the rider: hips on the saddle, spine, long crested skull, and the
    // famous single flight-finger sweeping back over the rear wheel
    ctx.beginPath();                       // femur to the pedal
    ctx.moveTo(cx - 10, cy + 10); ctx.lineTo(cx - 7, cy + 27); ctx.lineTo(cx - 6, cy + 41);
    ctx.stroke();
    ctx.beginPath();                       // spine, arched keen
    ctx.moveTo(cx - 10, cy + 8);
    ctx.quadraticCurveTo(cx - 4, cy - 8, cx + 6, cy - 14);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {          // ribs
      ctx.beginPath();
      ctx.arc(cx - 6 + i * 5, cy - 2 + i * -3, 6, Math.PI * 0.2, Math.PI * 0.95);
      ctx.stroke();
    }
    ctx.beginPath();                       // neck vertebrae
    ctx.moveTo(cx + 6, cy - 14); ctx.lineTo(cx + 14, cy - 26);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const nx = cx + 8 + i * 3, ny = cy - 17 - i * 4;
      ctx.beginPath(); ctx.moveTo(nx - 2, ny - 1); ctx.lineTo(nx + 2, ny + 1); ctx.stroke();
    }
    ctx.beginPath();                       // crest sweeping back
    ctx.moveTo(cx + 15, cy - 28); ctx.lineTo(cx + 3, cy - 37);
    ctx.stroke();
    ctx.beginPath();                       // long beak, slightly open
    ctx.moveTo(cx + 15, cy - 30); ctx.lineTo(cx + 45, cy - 24);
    ctx.moveTo(cx + 15, cy - 25); ctx.lineTo(cx + 42, cy - 21);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 17, cy - 28, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();                       // bony arm to the handlebars
    ctx.moveTo(cx + 6, cy - 12); ctx.lineTo(cx + 20, cy - 2); ctx.lineTo(cx + 29, cy + 8);
    ctx.stroke();
    ctx.beginPath();                       // the wing-finger, trailing glory
    ctx.moveTo(cx + 6, cy - 14);
    ctx.quadraticCurveTo(cx - 16, cy - 34, cx - 34, cy - 26);
    ctx.quadraticCurveTo(cx - 52, cy - 16, cx - 62, cy + 2);
    ctx.stroke();
    ctx.beginPath();                       // a hint of membrane
    ctx.moveTo(cx - 30, cy - 22); ctx.lineTo(cx - 14, cy - 6);
    ctx.moveTo(cx - 46, cy - 12); ctx.lineTo(cx - 30, cy + 4);
    ctx.stroke();
    ctx.beginPath();                       // tail
    ctx.moveTo(cx - 10, cy + 8); ctx.lineTo(cx - 30, cy + 14);
    ctx.stroke();
  }
  buriedAmmonite(ctx, cx, cy) {
    ctx.beginPath();
    let r = 3;
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      r += 0.85;
    }
    ctx.stroke();
    for (let a = Math.PI * 3; a < Math.PI * 5; a += 0.55) {
      const r1 = 3 + (a / 0.25) * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r1 * 0.72), cy + Math.sin(a) * (r1 * 0.72));
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
  // sloped escalators: balustrade band, gliding treads, a direction
  // chevron at the boarding end. Broken ones stand still and sulk red.
  drawEscRuns(ctx, it, t) {
    for (const run of it.escRuns) {
      const { xTop, yTop, xBot, yBot } = run;
      const len = Math.hypot(xBot - xTop, yBot - yTop) || 1;
      const ux = (xBot - xTop) / len, uy = (yBot - yTop) / len;
      ctx.lineCap = 'round';
      ctx.strokeStyle = run.broken ? 'rgba(178,59,43,0.75)' : PALETTE.ladder;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(xTop, yTop - 6); ctx.lineTo(xBot, yBot - 6); ctx.stroke();
      // handrail + posts
      ctx.strokeStyle = 'rgba(38,34,30,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xTop, yTop - 26); ctx.lineTo(xBot, yBot - 26);
      ctx.moveTo(xTop, yTop - 6); ctx.lineTo(xTop, yTop - 26);
      ctx.moveTo(xBot, yBot - 6); ctx.lineTo(xBot, yBot - 26);
      ctx.stroke();
      // treads glide with the travel; a broken run's stand still
      const phase = run.broken ? 0 : (t * 40) % 14;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let d = phase; d < len; d += 14) {
        const dd = run.up ? len - d : d;
        const mx = xTop + ux * dd, my = yTop + uy * dd - 6;
        ctx.moveTo(mx + uy * 5, my - ux * 5);
        ctx.lineTo(mx - uy * 5, my + ux * 5);
      }
      ctx.stroke();
      // which way it carries: chevron over the boarding end
      const [bx, by] = run.up ? [xBot, yBot] : [xTop, yTop];
      ctx.fillStyle = run.broken ? PALETTE.danger : PALETTE.platform;
      const ay = by - 34;
      ctx.beginPath();
      if (run.up) { ctx.moveTo(bx - 5, ay + 4); ctx.lineTo(bx + 5, ay + 4); ctx.lineTo(bx, ay - 5); }
      else { ctx.moveTo(bx - 5, ay - 4); ctx.lineTo(bx + 5, ay - 4); ctx.lineTo(bx, ay + 5); }
      ctx.closePath(); ctx.fill();
    }
  }
  // one glass box per shaft: the car, its riders as glowing skeletons,
  // and sliding doors at every landing it calls at
  drawLiftCars(ctx, it, t) {
    for (const sh of it.level.lifts) {
      const car = sh.car;
      if (!car) continue;
      const cx = (sh.x0 + sh.x1) / 2;
      const w2 = (sh.x1 - sh.x0) - 10;
      const hh = 46;
      const cy = car.y;
      // the box: dark scanner glass — the x-ray view is the point
      ctx.fillStyle = sh.out ? '#241f1c' : '#2c333d';
      ctx.strokeStyle = sh.color || PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cx - w2 / 2, cy - hh, w2, hh, 3); ctx.fill(); ctx.stroke();
      // who's aboard, X-ray style — the whole flock rides together
      if (!sh.out) {
        ctx.save();
        ctx.beginPath(); ctx.roundRect(cx - w2 / 2 + 1, cy - hh + 1, w2 - 2, hh - 2, 3); ctx.clip();
        const seats = [];
        if (it.playerCar === sh) {
          seats.push({ bird: true, s: 1 });
          it.buddies.slice(0, 5).forEach((b, i) => seats.push({ bird: true, s: 0.62, dy: -14 - (i % 2) * 9 }));
        }
        for (const oc of car.occupants) seats.push({ aid: oc.aid });
        seats.forEach((s, i) => {
          const px = cx + (i - (seats.length - 1) / 2) * (seats.length > 3 ? 9 : 14);
          if (s.bird) drawBirdSkeleton(ctx, px, cy - 8 + (s.dy || 0), t + i, s.s || 1);
          else drawCommuterSkeleton(ctx, px, cy - 2, s.aid, t);
        });
        ctx.restore();
      }
      // sliding doors at each landing (+ an amber call light)
      sh.stops.forEach((row, ri) => {
        const dy = row * TILE;
        const here = !sh.out && car.state !== 'move' && sh.stops[car.stop] === row;
        const open = here ? car.door : 0;
        if (car.call === ri) {
          ctx.fillStyle = '#d9a327';
          ctx.beginPath(); ctx.arc(cx - w2 / 2 - 8, dy - hh * 0.55, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(38,34,30,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - w2 / 2 - 3, dy - hh - 3, w2 + 6, hh + 3);
        const half = (w2 / 2) * (1 - open);
        if (half > 0.5) {
          ctx.fillStyle = 'rgba(126,136,146,0.4)';   // glass: skeletons shine through
          ctx.fillRect(cx - w2 / 2, dy - hh, half, hh);
          ctx.fillRect(cx + w2 / 2 - half, dy - hh, half, hh);
          ctx.strokeStyle = 'rgba(38,34,30,0.55)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(cx - w2 / 2, dy - hh, half, hh);
          ctx.strokeRect(cx + w2 / 2 - half, dy - hh, half, hh);
        }
      });
    }
  }
  drawDressing(ctx, it, t) {
    const lv = it.level;
    this.drawEarthEdges(ctx, it, t);
    this.drawEscRuns(ctx, it, t);
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
      const kind = (c + r + i + (it.seed || 0)) % 3;
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
      ctx.textAlign = 'center';
      this.fitText(ctx, this.cur, x, y + 1, 74, 9);   // long names shrink to the board
    }
    // WAY OUT signage on every level, chevrons pointing the way it lies
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    const outRow = it.def.gateOut ? it.def.gateOut.r + 1
      : it.def.streetRow ?? lv.grid.findIndex(row => row.some(ch => ch === '#' || ch === '+'));
    const outLeft = (it.def.gateOut?.c ?? 1) < 10;
    for (const fr2 of it.floorRows) {
      const isHere = fr2 === outRow;
      const vert = isHere ? '' : fr2 > outRow ? '\u2191' : '\u2193';
      const label = isHere
        ? (outLeft ? '\u00ab\u00ab WAY OUT' : 'WAY OUT \u00bb\u00bb')
        : (outLeft ? `\u00ab\u00ab WAY OUT ${vert}` : `${vert} WAY OUT \u00bb\u00bb`);
      ctx.fillStyle = isHere ? PALETTE.ladder : 'rgba(38,34,30,0.55)';
      ctx.fillText(label, W / 2, fr2 * TILE - 6);
    }
    // the exits: the street WAY OUT is always there (surfacing ends any
    // visit); a waiting train stands at the platform when a change is on
    const locked = it.rescue && !it.rescue.found;
    const og = it.def.gateOut || it.gate;
    const ox = og.c * TILE + 16, oy = (og.r + 1) * TILE;
    ctx.fillStyle = locked ? 'rgba(38,34,30,0.35)' : PALETTE.platform;
    ctx.fillRect(ox - 14, oy - 42, 28, 42);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(ox - 9, oy - 36, 18, 36);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 9px Georgia, serif';
    ctx.fillText(locked ? `FIND ${it.rescue.name} FIRST` : 'WAY OUT', ox, oy - 52);
    let chevX = ox, chevY = oy;
    // every platform door keeps its own train: the west end's departs
    // west, the east end's east — the doors are the network itself, and
    // the boards above them say the direction and the next station
    for (const pd of it.def.platDefs) {
      for (const d of Object.values(pd.doors)) {
        const e0 = d.edges[0];
        if (!e0) continue;
        const pgx = d.c * TILE + 16, pgy = (d.r + 1) * TILE;
        const dirOut = d.c < 10 ? -1 : 1;
        const boarding = this.scene && this.scene.kind === 'board' && it.gate === d;
        if (!boarding) {
          ctx.save();
          if (locked) ctx.globalAlpha = 0.45;
          drawTrain(ctx, pgx, pgy, LINES[e0.line]?.color || PALETTE.platform, { door: 1, dir: dirOut });
          ctx.restore();
        }
        ctx.fillStyle = PALETTE.ink;
        ctx.textAlign = dirOut < 0 ? 'left' : 'right';
        const lx2 = dirOut < 0 ? pgx - 12 : pgx + 12;
        ctx.font = 'bold 9px Georgia, serif';
        ctx.fillText(boundWord(this.cur, e0.to) + (d.edges.length > 1 ? ' +' : ''), lx2, pgy - 62);
        ctx.fillText(e0.to, lx2, pgy - 52);
        ctx.textAlign = 'center';
      }
    }
    if (it.pendingEdge && it.gate !== it.def.gateOut) {
      chevX = it.gate.c * TILE + 16; chevY = (it.gate.r + 1) * TILE;
    }
    if (!locked) {
      // the pulsing chevron marks the journey's own exit
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      const cy2 = chevY - 26 + Math.sin(t * 5.5) * 3;
      ctx.moveTo(chevX - 6, cy2); ctx.lineTo(chevX + 6, cy2); ctx.lineTo(chevX, cy2 + 7);
      ctx.closePath(); ctx.fill();
    }
    // waiting bystanders, drawn from the station's own corner of the crowd
    for (const [c, floor, v] of it.def.bystanders) {
      const vv = (v + (it.seed || 0)) % 20;
      drawCommuter(ctx, {
        x: c * TILE + 16, y: floor * TILE, size: 48,
        facing: vv % 2 ? -1 : 1, phase: t * 2 + c, pose: 'stand', variant: vv,
      });
    }
    // level tags at the left edge of each depth
    it.floorRows.forEach((fr, i) => {
      const label = it.def.levels?.[i];
      if (!label) return;
      const y = fr * TILE;
      const wch = 10 + label.length * 4.6;
      ctx.fillStyle = 'rgba(247,242,230,0.95)';
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.2;
      ctx.fillRect(2, y - 17, wch, 13);
      ctx.strokeRect(2, y - 17, wch, 13);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = 'bold 8px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 7, y - 7);
    });
    // Lift guide boards — the station's own diagram of itself
    for (const [c, r] of it.def.guides || []) this.drawLiftGuide(ctx, it, c * TILE, r * TILE);
    // the lost thing, glinting quietly where somebody dropped it
    if (it.lost) this.drawLostObject(ctx, it.lost, t);
    // Help points
    for (const [c, r] of it.def.helps || []) {
      const hx = c * TILE + 10, hy = r * TILE;
      ctx.fillStyle = '#23406e';
      ctx.beginPath(); ctx.roundRect(hx, hy - 27, 13, 27, 3); ctx.fill();
      ctx.fillStyle = '#4a90d9';
      ctx.beginPath(); ctx.arc(hx + 6.5, hy - 20, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7dc383';
      ctx.beginPath(); ctx.arc(hx + 6.5, hy - 11, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // the whiteboard, when something is out and nobody is named
    const outLift = lv.lifts.find(sh => sh.out);
    const escBroken = it.brokenEsc && it.brokenEsc.size > 0;
    if ((outLift || escBroken) && it.def.board) {
      this.drawServiceBoard(ctx, it.def.board[0] * TILE, it.def.board[1] * TILE, outLift);
    }
    // the awesome power, memorialised
    for (const dcl of it.decals) {
      ctx.fillStyle = '#f6f3ea';
      ctx.beginPath();
      ctx.ellipse(dcl.x, dcl.y - 1, 4, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(dcl.x - 3, dcl.y - 1, 2, 1.2, 0, 0, Math.PI * 2);
      ctx.ellipse(dcl.x + 3.4, dcl.y - 0.8, 1.6, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(38,34,30,0.3)';
      ctx.beginPath(); ctx.arc(dcl.x + 1, dcl.y - 1.5, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    for (const dr of it.droppings) {
      ctx.fillStyle = '#f6f3ea';
      ctx.beginPath(); ctx.ellipse(dr.x, dr.y, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // lost property, drawn small and warm where it fell; a soft twinkle
  // says "come and look" without shouting (static under reduced motion)
  drawLostObject(ctx, lost, t) {
    const x = lost.x, y = lost.y;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PALETTE.ink;
    switch (lost.kind) {
      case 'glove':
        ctx.fillStyle = '#b23b2b';
        ctx.beginPath(); ctx.roundRect(x - 5, y - 10, 10, 9, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(x + 3, y - 8, 5, 4, 2); ctx.fill(); ctx.stroke();
        break;
      case 'umbrella':
        ctx.strokeStyle = '#2e5e45';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 8, y - 3); ctx.lineTo(x + 6, y - 12); ctx.stroke();
        ctx.fillStyle = '#2e5e45';
        ctx.beginPath();
        ctx.moveTo(x - 9, y - 5); ctx.quadraticCurveTo(x - 2, y - 14, x + 7, y - 13);
        ctx.quadraticCurveTo(x - 1, y - 11, x - 9, y - 5);
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x - 9, y - 2, 2.4, Math.PI * 0.2, Math.PI, false); ctx.stroke();
        break;
      case 'teddy bear':
        ctx.fillStyle = '#b98a2e';
        ctx.beginPath(); ctx.arc(x, y - 5, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 12, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - 3, y - 15, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 3, y - 15, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.ink;
        ctx.beginPath();
        ctx.arc(x - 1.2, y - 12.5, 0.6, 0, Math.PI * 2);
        ctx.arc(x + 1.2, y - 12.5, 0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'scarf':
        ctx.strokeStyle = '#4f4a76';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 2);
        ctx.quadraticCurveTo(x - 2, y - 9, x + 3, y - 4);
        ctx.quadraticCurveTo(x + 8, y - 1, x + 9, y - 7);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.moveTo(x + 7.5 + k, y - 6); ctx.lineTo(x + 7 + k, y - 2.5); ctx.stroke();
        }
        break;
      case 'library book':
        ctx.fillStyle = '#23406e';
        ctx.beginPath(); ctx.roundRect(x - 6, y - 9, 12, 8, 1.5); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f2ecdd';
        ctx.beginPath(); ctx.moveTo(x - 3.5, y - 7); ctx.lineTo(x + 3.5, y - 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 3.5, y - 5); ctx.lineTo(x + 2, y - 5); ctx.stroke();
        break;
      default:   // toy train
        ctx.fillStyle = '#d94327';
        ctx.beginPath(); ctx.roundRect(x - 7, y - 8, 10, 6, 1.5); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(x + 1, y - 11, 6, 9, 1.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETTE.ink;
        ctx.beginPath();
        ctx.arc(x - 4, y - 1.5, 1.6, 0, Math.PI * 2);
        ctx.arc(x + 1, y - 1.5, 1.6, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 1.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    // the twinkle
    const tw = this.g.reducedMotion ? 0.55 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.1 + x));
    ctx.globalAlpha = tw;
    ctx.strokeStyle = '#b98a2e';
    ctx.lineWidth = 1.2;
    const sy = y - 20, sr = 3;
    ctx.beginPath();
    ctx.moveTo(x - sr, sy); ctx.lineTo(x + sr, sy);
    ctx.moveTo(x, sy - sr); ctx.lineTo(x, sy + sr);
    ctx.stroke();
    ctx.restore();
  }
  playerFloorIdx(it) {
    const y = this.g.player.y / TILE;
    let best = 0, bd = 1e9;
    it.floorRows.forEach((fr, i) => {
      const d = Math.abs(fr - y);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  // the real boards from inside the lifts: the station drawn as levels and
  // lift columns — a platform game's map, mounted inside the platform game
  drawLiftGuide(ctx, it, cx, floorY) {
    const g = this.g, lv = it.level;
    const w = 88, h = 56;
    const x0 = cx + 16 - w / 2, y0 = floorY - h - 8;
    ctx.save();
    ctx.fillStyle = '#fbf9f2';
    ctx.strokeStyle = '#2a4a7a';
    ctx.lineWidth = 2;
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeRect(x0, y0, w, h);
    ctx.fillStyle = '#2a4a7a';
    ctx.font = 'bold 8px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Lift guide', x0 + 4, y0 + 10);
    ctx.fillStyle = '#3d6cb2';
    ctx.fillRect(x0 + w - 13, y0 + 3, 9, 9);
    ctx.fillStyle = '#fbf9f2';
    ctx.beginPath(); ctx.arc(x0 + w - 8.5, y0 + 7, 2.4, 0, Math.PI * 2); ctx.fill();
    const dx0 = x0 + 6, dx1 = x0 + w - 6, dy0 = y0 + 16, dy1 = y0 + h - 6;
    const n = it.floorRows.length;
    const fy = i => dy0 + (i / Math.max(1, n - 1)) * (dy1 - dy0);
    const mapX = colc => dx0 + (colc / 20) * (dx1 - dx0);
    ctx.strokeStyle = 'rgba(38,34,30,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(dx0, fy(i)); ctx.lineTo(dx1, fy(i)); ctx.stroke();
    }
    // stair runs, straight down
    for (const run of it.vertRuns) {
      if (run.kind !== 'H') continue;
      const i0 = Math.max(0, it.floorRows.indexOf(run.top - 1));
      const i1i = it.floorRows.indexOf(run.bot + 1);
      const i1 = i1i < 0 ? n - 1 : i1i;
      const exx = mapX(run.c + 0.5);
      ctx.strokeStyle = 'rgba(38,34,30,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(exx, fy(i1)); ctx.lineTo(exx, fy(i0)); ctx.stroke();
    }
    // escalators slope on the guide exactly as they do in the hall
    it.escRuns.forEach((run, ri) => {
      const iT = Math.max(0, it.floorRows.indexOf(run.yTop / TILE));
      const iB = it.floorRows.indexOf(run.yBot / TILE);
      ctx.strokeStyle = run.broken ? PALETTE.danger : PALETTE.ladder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mapX(run.xBot / TILE), fy(iB < 0 ? n - 1 : iB));
      ctx.lineTo(mapX(run.xTop / TILE), fy(iT));
      ctx.stroke();
    });
    // the lift columns, lettered, proud or crossed out — each drawn only
    // over the levels it actually serves, like the boards in the real lifts
    for (const sh of lv.lifts) {
      const lx = mapX((sh.x0 + sh.x1) / 2 / TILE);
      let i0 = it.floorRows.indexOf(sh.topY / TILE);
      let i1 = it.floorRows.indexOf(sh.botY / TILE);
      if (i0 < 0) i0 = 0;
      if (i1 < 0) i1 = n - 1;
      const col = sh.color || '#c0392b';
      ctx.fillStyle = sh.out ? 'rgba(192,57,43,0.3)' : col;
      ctx.fillRect(lx - 4, fy(i0), 8, fy(i1) - fy(i0));
      if (sh.id) {
        ctx.fillStyle = col;
        ctx.font = 'bold 6px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(sh.id, lx, fy(i0) - 2);
        ctx.textAlign = 'left';
      }
      if (sh.out) {
        ctx.strokeStyle = PALETTE.danger;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx - 5, fy(i0)); ctx.lineTo(lx + 5, fy(i1));
        ctx.moveTo(lx + 5, fy(i0)); ctx.lineTo(lx - 5, fy(i1));
        ctx.stroke();
      }
    }
    // you are here — live
    const pi = this.playerFloorIdx(it);
    const pxx = Math.max(dx0 + 2, Math.min(dx1 - 2, mapX(g.player.x / TILE)));
    ctx.fillStyle = PALETTE.danger;
    ctx.beginPath();
    ctx.arc(pxx, fy(pi), 2.6 + Math.sin(performance.now() / 280) * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 5.5px Georgia, serif';
    ctx.fillText('you are here', Math.min(pxx + 4, dx1 - 32), fy(pi) - 3);
    ctx.restore();
  }
  // the Service information A-board: dated, handwritten, signed by nobody
  drawServiceBoard(ctx, cx, floorY, outLift) {
    const w = 46, h = 60;
    const x0 = cx + 16 - w / 2, y0 = floorY - h;
    ctx.save();
    // A-board legs
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 5, y0 + h - 4); ctx.lineTo(x0 - 2, floorY);
    ctx.moveTo(x0 + w - 5, y0 + h - 4); ctx.lineTo(x0 + w + 2, floorY);
    ctx.stroke();
    ctx.fillStyle = '#fcfaf4';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(x0, y0, w, h - 4);
    ctx.strokeRect(x0, y0, w, h - 4);
    ctx.fillStyle = '#2a4a7a';
    ctx.font = 'bold 5px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Service information', x0 + 3, y0 + 7);
    const d = new Date();
    ctx.font = '4.5px Georgia, serif';
    ctx.fillText(`Date ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`, x0 + 3, y0 + 13);
    ctx.fillText(`Time ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, x0 + 3, y0 + 18);
    // faint ghost of an older half-wiped notice
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#26221e';
    ctx.font = 'italic 6px Georgia, serif';
    ctx.save(); ctx.translate(x0 + 8, y0 + 40); ctx.rotate(-0.06); ctx.fillText('out of service', 0, 0); ctx.restore();
    ctx.globalAlpha = 1;
    // today's message, in marker
    ctx.fillStyle = '#3a72b5';
    ctx.font = 'bold 7px Georgia, serif';
    ctx.save();
    ctx.translate(x0 + 4, y0 + 28);
    ctx.rotate(-0.035);
    if (outLift) {
      ctx.fillText(outLift.id ? `LIFT ${outLift.id} OUT` : 'LIFT OUT', 0, 0);
      ctx.fillText('OF SERVICE', 0, 9);
    } else { ctx.fillText('ESCALATOR', 0, 0); ctx.fillText('UNDER REPAIR', 0, 9); }
    ctx.beginPath();
    ctx.moveTo(0, 13); ctx.quadraticCurveTo(14, 15, 34, 13.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3a72b5';
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}
