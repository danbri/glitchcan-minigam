// ---------- Conway's Life in the windows of the round towers ----------
// One board, 64 columns round the tower (it wraps, as a cylinder should) by 40 floors from the top down (the top and
// the bottom are dead edges). Stepped here a few times a second, sent to the GPU packed 16 cells to a float (floats
// hold whole numbers exactly up to 2^24) after the event block, and read by material 1 in scene.wgsl (`lifeAt`) on
// about two in five round towers, each turned by its own number of columns. Patterns are reseeded every couple of
// minutes, or when the board dies or stops changing.
const LIFE_W = 64, LIFE_H = 40;
const LIFE = { a: new Uint8Array(LIFE_W * LIFE_H), b: new Uint8Array(LIFE_W * LIFE_H), gpu: new Float32Array(256), t: 0, gen: 0, seedAt: -1e9, hist: [], pat: "" };
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
    "............##......................"], 5],
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
    ".......................#........."], 3],
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
  LIFE.seedAt = LIFE.t;
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
function lifePack() {
  const g = LIFE.gpu; g.fill(0);
  for (let i = 0; i < LIFE.a.length; i++) if (LIFE.a[i]) g[i >> 4] += 1 << (i & 15);
  return g;
}
// advance the board by real time; returns the packed board for the GPU
function lifeUpdate(dt) {
  LIFE.t += dt;
  if (LIFE.seedAt < -1e8) lifeSeed();
  LIFE.acc = (LIFE.acc || 0) + dt;
  if (LIFE.acc < 0.25) return null;
  LIFE.acc = 0;
  const r = lifeStep();
  // the gun runs longer; everything else gets a couple of minutes, less if it dies or settles
  const limit = LIFE.pat.endsWith("glider gun") ? 240 : 120;
  if (r.pop < 4 || (r.stale && LIFE.gen > 40) || LIFE.t - LIFE.seedAt > limit) lifeSeed();
  return lifePack();
}
