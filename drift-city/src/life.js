// ---------- Conway's Life in the windows of the towers ----------
// Two boards, stepped here a few times a second and sent to the GPU packed 16 cells to a float (floats hold whole
// numbers exactly up to 2^24) after the event block:
// - LIFE, 64 columns (they wrap) by 40 rows from the top down (the top and the bottom are dead edges): the stepped
//   towers' flat faces and the rounded modern towers (`lifeCol` in scene.wgsl). Reseeded every couple of minutes, or
//   when the board dies or stops changing.
// - LIFER, 32 columns by 80 rows: the organic round towers (`lifeColR`). 32 columns go once round the tower, so the
//   board wraps as a cylinder does, with no seam. It always runs one glider gun at the top, turned on its side, and its
//   gliders go down and round the tower. The bottom two rows are a sink (cleared each step), so the gliders leave
//   there and nothing builds up to reach the gun. Two guns on one board destroy each other's streams (simulated).
const LIFE_W = 64, LIFE_H = 40, LIFER_W = 32, LIFER_H = 80;
const LIFE = { a: new Uint8Array(LIFE_W * LIFE_H), b: new Uint8Array(LIFE_W * LIFE_H), gpu: new Float32Array(856), t: 0, gen: 0, seedAt: -1e9, hist: [], pat: "" };
const LIFER = { a: new Uint8Array(LIFER_W * LIFER_H), b: new Uint8Array(LIFER_W * LIFER_H), gen: 0, seedAt: -1e9, pat: "" };
// patterns as rows of text, "#" alive; [name, rows, weight]
const LIFE_PATTERNS = [
  ["Gosper glider gun", [
    "........................#...........",
    "......................#.#...........",
    "............##......##............##",
    "...........#...#....##............##",
    "##........#.....#...##..............",
    "##........#...#.##....#.#...........",
    "..........#.....#.......#...........",
    "...........#...#....................",
    "............##......................"], 10],
  // Michael Simkin's gun (2015): one glider every 120 generations, from two blocks, a pair of eaters and a small
  // reaction between them
  ["Simkin glider gun", [
    "##.....##........................",
    "##.....##........................",
    ".................................",
    "....##...........................",
    "....##...........................",
    ".................................",
    ".................................",
    ".................................",
    ".................................",
    "......................##.##......",
    ".....................#.....#.....",
    ".....................#......#..##",
    ".....................###...#...##",
    "..........................#......",
    ".................................",
    ".................................",
    ".................................",
    "....................##...........",
    "....................#............",
    ".....................###.........",
    ".......................#........."], 5],
  ["pulsar", [
    "..###...###..",
    ".............",
    "#....#.#....#",
    "#....#.#....#",
    "#....#.#....#",
    "..###...###..",
    ".............",
    "..###...###..",
    "#....#.#....#",
    "#....#.#....#",
    "#....#.#....#",
    ".............",
    "..###...###.."], 1],
  ["pentadecathlon", [
    "..#....#..",
    "##.####.##",
    "..#....#.."], 1],
  ["acorn", [
    ".#.....",
    "...#...",
    "##..###"], 1],
  ["R-pentomino", [
    ".##",
    "##.",
    ".#."], 1],
  ["lightweight spaceship", [
    "#..#.",
    "....#",
    "#...#",
    ".####"], 1],
  ["glider", [
    ".#.",
    "..#",
    "###"], 1],
];
function lifeStamp(rows, x0, y0, flip) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") {
    const x = ((flip ? row.length - 1 - i : i) + x0 + LIFE_W * 4) % LIFE_W, y = y0 + j;
    if (y >= 0 && y < LIFE_H) LIFE.a[y * LIFE_W + x] = 1;
  } });
}
function lifeSeed() {
  LIFE.a.fill(0); LIFE.gen = 0; LIFE.hist = [];
  const pick = () => { let w = 0; for (const p of LIFE_PATTERNS) w += p[2]; let r = Math.random() * w; for (const p of LIFE_PATTERNS) { r -= p[2]; if (r < 0) return p; } return LIFE_PATTERNS[0]; };
  const main = pick();
  LIFE.pat = main[0];
  if (main[0].endsWith("glider gun")) {
    // the gun at the top, firing down the tower; a pulsar lower down for the gliders to hit, sometimes
    lifeStamp(main[1], Math.floor(Math.random() * LIFE_W), 1, Math.random() < 0.5);
    if (Math.random() < 0.5) lifeStamp(LIFE_PATTERNS[2][1], Math.floor(Math.random() * LIFE_W), 24);
  } else if (main[0] === "glider" || main[0] === "lightweight spaceship") {
    // a fleet
    for (let k = 0; k < 8; k++) lifeStamp(main[1], Math.floor(k * LIFE_W / 8 + Math.random() * 4), 1 + Math.floor(Math.random() * 12), Math.random() < 0.5);
  } else {
    // a few of the still-life makers and oscillators round the tower
    for (let k = 0; k < 3; k++) { const p = k === 0 ? main : pick(); if (p[0].endsWith("glider gun")) continue; lifeStamp(p[1], Math.floor(k * LIFE_W / 3 + Math.random() * 8), 1 + Math.floor(Math.random() * 8)); }
  }
  // most towers are short and show only the top rows, from one side: put small things all round the top
  for (let k = 0; k < 6; k++) {
    const small = [LIFE_PATTERNS[3], LIFE_PATTERNS[7], LIFE_PATTERNS[5], ["blinker", ["###"]]][Math.floor(Math.random() * 4)];
    lifeStamp(small[1], Math.floor(k * LIFE_W / 6 + Math.random() * 5), Math.floor(Math.random() * 5), Math.random() < 0.5);
  }
  // random soup in patches over the board: what Life looks like to most people, growth, collapse, blinkers and
  // blocks left behind, and a glider now and then. Without it most of a face in view was empty (owner, September
  // 2026: "not obviously life"). Below a gun's rows only, and fewer, so the gun's gliders have something to hit
  const gun = main[0].endsWith("glider gun");
  for (let k = 0; k < (gun ? 4 : 7); k++) {
    const x0 = Math.floor(k * LIFE_W / (gun ? 4 : 7) + Math.random() * 4), y0 = (gun ? 16 : 2) + Math.floor(Math.random() * (LIFE_H - (gun ? 24 : 12)));
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (Math.random() < 0.38) LIFE.a[(y0 + j) * LIFE_W + (x0 + i) % LIFE_W] = 1;
  }
  LIFE.seedAt = LIFE.t;
}
// the round towers' board: one gun, turned on its side (rows become columns), in one of the two turns of it that fire
// down the board (simulated: the others fire up into the dead top edge and wreck themselves)
function lifeSeedR() {
  const B = LIFER; B.a.fill(0); B.gen = 0;
  const simkin = Math.random() < 0.3, rows = LIFE_PATTERNS[simkin ? 1 : 0][1], mirror = Math.random() < 0.5;
  // every round tower shows this board unturned, so column c faces the same way on all of them; the gun is centred
  // on column 26, the side that faces Conway Corner (its camera looks along yaw 1.94; tales.js)
  const x0 = 26 - Math.floor(rows.length / 2) + LIFER_W;
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") {
    const x = mirror ? rows.length - 1 - j : j, y = simkin ? row.length - 1 - i : i;
    B.a[(y + 1) * LIFER_W + (x + x0) % LIFER_W] = 1;
  } });
  B.pat = simkin ? "Simkin glider gun" : "Gosper glider gun";
  B.seedAt = LIFE.t;
}
function lifeStepR() {
  const W = LIFER_W, H = LIFER_H, a = LIFER.a, b = LIFER.b;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= H - 2) { b[y * W + x] = 0; continue; }
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0) continue;
      for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += a[yy * W + (x + dx + W) % W];
    }
    b[y * W + x] = n === 3 || (n === 2 && a[y * W + x]) ? 1 : 0;
  }
  LIFER.a = b; LIFER.b = a; LIFER.gen++;
}
function lifeStep() {
  const a = LIFE.a, b = LIFE.b;
  let pop = 0;
  for (let y = 0; y < LIFE_H; y++) for (let x = 0; x < LIFE_W; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= LIFE_H) continue;
      for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += a[yy * LIFE_W + (x + dx + LIFE_W) % LIFE_W];
    }
    const v = n === 3 || (n === 2 && a[y * LIFE_W + x]) ? 1 : 0;
    b[y * LIFE_W + x] = v; pop += v;
  }
  LIFE.a = b; LIFE.b = a; LIFE.gen++;
  // a cheap signature to notice a board that has stopped changing (still lifes and period-2 blinkers)
  let h = 0; for (let i = 0; i < b.length; i++) if (b[i]) h = (h * 31 + i) | 0;
  LIFE.hist.push(h); if (LIFE.hist.length > 6) LIFE.hist.shift();
  const stale = LIFE.hist.length === 6 && (LIFE.hist[5] === LIFE.hist[3] && LIFE.hist[4] === LIFE.hist[2]);
  return { pop, stale };
}
// For the GPU, each cell's colour class, not its bare state: the shader then reads one value per pixel, where
// counting eight neighbours there cost a fifth of the scene's time once Life covered the stepped towers (Dawn,
// September 2026: 99.7 to 119.9 ms). Class: 0 dead, 1 dead with three neighbours (born next), 2 alive with one or
// none (dies of loneliness), 3 two, 4 three, 5 four or more (dies of crowding). Six 4-bit classes to a float
// (floats hold whole numbers exactly up to 2^24): the flat board from float 0, the round board from float 428.
const LIFE_RBASE = 428;
function lifeClassPack(a, W, H, g, base) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += a[yy * W + (x + dx + W) % W];
    }
    const i = y * W + x;
    const k = a[i] ? (n <= 1 ? 2 : n === 2 ? 3 : n === 3 ? 4 : 5) : (n === 3 ? 1 : 0);
    if (k) g[base + Math.floor(i / 6)] += k * Math.pow(16, i % 6);
  }
}
function lifePack() {
  const g = LIFE.gpu; g.fill(0);
  lifeClassPack(LIFE.a, LIFE_W, LIFE_H, g, 0);
  lifeClassPack(LIFER.a, LIFER_W, LIFER_H, g, LIFE_RBASE);
  return g;
}
// advance the board by real time; returns the packed board for the GPU
function lifeUpdate(dt) {
  LIFE.t += dt;
  if (LIFE.seedAt < -1e8) lifeSeed();
  if (LIFER.seedAt < -1e8) lifeSeedR();
  LIFE.acc = (LIFE.acc || 0) + dt;
  if (LIFE.acc < 0.25) return null;
  LIFE.acc = 0;
  const r = lifeStep();
  lifeStepR();
  // a gun fires for ever; a new one (the other kind, or the other way round) every four minutes
  if (LIFE.t - LIFER.seedAt > 240) lifeSeedR();
  // the gun runs longer; everything else gets a couple of minutes, less if it dies or settles
  const limit = LIFE.pat.endsWith("glider gun") ? 240 : 120;
  if (r.pop < 4 || (r.stale && LIFE.gen > 40) || LIFE.t - LIFE.seedAt > limit) lifeSeed();
  return lifePack();
}
