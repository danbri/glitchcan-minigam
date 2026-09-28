// ---------- Tales: 50 room-scale places in and around Drift city, and an Ink story that moves between them ----------
// Places are picked from the generated city itself (so each is really there), in a fixed order, so a story can refer
// to them by id. Each has a camera at eye height (or on a roof), a heading and a pitch.
const DISTRICTS = ["financial district", "neon quarter", "old town", "Chinatown", "industrial belt", "spaceport", "dorms", "crystal quarter"];
const STREET_A = ["Amber", "Tholin", "Methane", "Lantern", "Kraken", "Haze", "Cassini", "Huygens", "Saturnlight", "Ethane", "Dune", "Glass", "Cryo", "Orchid", "Ferry", "Halo"];
const STREET_B = ["Street", "Lane", "Row", "Walk", "Arcade", "Passage", "Parade", "Wynd"];
function streetName(k) { return STREET_A[Math.floor(hsh(k, 3, 901) * STREET_A.length)] + " " + STREET_B[Math.floor(hsh(k, 5, 902) * STREET_B.length)]; }

// ---------- rooms: the venues' interiors ----------
// A room place stands where its door is (on the street it belongs to), but when you arrive the shader draws the room
// round you instead of the city (roomRender in scene.wgsl; kind in EVN[210], origin and heading in EVN[212..215]).
// Room axes: x forward along the place's heading, z to the right, y up from the floor; the camera starts at x = 0.
// x0..x1 and hw (half width) are the walls, for walking and for placing the story's things; scene.wgsl must match.
const ROOMS = [
  { id: "cold_tap", kind: 1, base: "street_1", x0: -1.3, x1: 8.8, hw: 3.0, name: "The Cold Tap, Ferry Street", blurb: "A dive bar behind an airlock: nine stools, a heater that ticks, bottles lit from below, and a price list older than the dome." },
  { id: "low_orbit_bar", kind: 2, base: "street_5", x0: -1.3, x1: 19.6, hw: 4.3, name: "The Low Orbit, by the spaceport", blurb: "A long bar for ship crews, with a window on the pads and a cracked star painted on the ceiling." },
  { id: "lantern_cellar", kind: 3, base: "street_3", x0: -1.3, x1: 13.2, hw: 4.8, name: "The Lantern Cellar, Chinatown", blurb: "Forty steps down: a brick vault full of paper lanterns and smoke, and a late jam that never stops." },
  { id: "warmhouse_club", kind: 4, base: "warmhouse", x0: -2.8, x1: 26.5, hw: 14.5, round: [12, 15.2], name: "The Warmhouse club", blurb: "The jazz club under the dome in the middle of the Warmhouse: tables in rings, lamps on every table, the stand at the far side." },
];
// the room you are in now (a room place, arrived or nearly), or null
function roomNow() { const V = NAV.visit; return NAV.mode === "visit" && V && V.to && V.to.room && V.t >= V.T * 0.92 ? V.to : null; }
function roomOf(p) { return p && p.room ? ROOMS.find((r) => r.kind === p.room) : null; }
// keep a point (local x, z) inside a room, margin m from the walls
function roomClamp(R, x, z, m) {
  x = clampv(x, R.x0 + m, R.x1 - m); z = clampv(z, -R.hw + m, R.hw - m);
  if (R.round) { const dx = x - R.round[0], d = Math.hypot(dx, z), rr = R.round[1] - m; if (d > rr) { x = R.round[0] + dx * rr / d; z = z * rr / d; } }
  return [x, z];
}

// camera on the far sidewalk across the street from a block, looking at it; side 0..3 = west, east, north, south
function facing(cx, cz, side, eye) {
  const mx = (cx + 0.5) * C, mz = (cz + 0.5) * C;
  const off = [[-1, 0], [1, 0], [0, -1], [0, 1]][side];
  const d = C * 0.5 + 2.8 + 0.8;
  const x = mx + off[0] * d, z = mz + off[1] * d;
  const y = Math.max(terrSurfAt(x, z), 0) + (eye || 1.7);
  return { x, y, z, yaw: Math.atan2(mz - z, mx - x), pitch: 0.18 };
}
function roofView(cx, cz, yaw) {
  const o = cellAt(cx, cz);
  const mx = (cx + 0.5) * C, mz = (cz + 0.5) * C;
  return { x: mx, y: Math.max(o.top, o.h, 6) + 1.7, z: mz, yaw, pitch: -0.12 };
}

let PLACES = null;
function buildPlaces() {
  const P = [];
  const add = (id, name, blurb, cam) => { if (P.length < 50 && !P.find((p) => p.id === id)) P.push({ id, name, blurb, ...cam }); };
  // the Assembly Hall: under the dome, and on its steps
  const hx = 3.5 * BIG, hz = -3.5 * BIG;
  add("hall_floor", "Assembly Hall, the floor", "Under the great glass dome, where the city's assembly meets: tier on tier of seats around the rostrum. Light falls through the ribs in long amber bars.", { x: hx - 8, y: 2.8, z: hz + 3, yaw: Math.PI - 0.3, pitch: 0.28 });
  add("hall_steps", "Assembly Hall, the steps", "The broad stone steps below the arcade, a place to wait, to argue, to be seen.", { x: hx - 84, y: 1.7 + 2.7, z: hz, yaw: 0, pitch: 0.2 });
  add("civic_axis", "The Assembly Hall avenue, old town", "The long reflecting pools up the avenue, between two walls of stone, to the dome of the Assembly Hall.", { x: 728, y: 3.2, z: -175, yaw: -Math.PI / 2, pitch: 0.1 });
  // scan the city in rings outward from the centre, collecting one of each kind per district
  const seen = new Set();
  const want = (key) => { if (seen.has(key)) return false; seen.add(key); return true; };
  // the Hive, from a Lumen roof across the way: the view that says which side of town you are on
  {
    const cam = roofView(28, 28, 0);
    cam.yaw = Math.atan2(HIVE_C[1] - cam.z, HIVE_C[0] - cam.x); cam.pitch = 0.08;
    add("hive", "Facing the Hive, Lumen roofs", "Across the gap, the pod block fills the sky: patched walls, a million little windows, and the boards telling everyone inside to sleep more.", cam);
  }
  // the pod fab beside the Hive, and the power beam coming down to it, from the battlements of the Hive's
  // north-east tower (240 m up)
  {
    const x = HIVE_C[0] + 255, z = HIVE_C[1] - 150;
    add("fab", "Hive battlements, over the pod fab", "Below, the fab that makes the Hive's capsule homes, fed by a beam from the power station in orbit: a white line through the clouds, day and night.",
      { x, y: 252, z, yaw: Math.atan2(FAB_C[1] - z, FAB_C[0] - x), pitch: -0.42 });
  }
  // the Warmhouse: inside, on its square; and from the ground to the east, the whole bubble over the city's edge
  {
    const c = BUB_C, a = 0.35, r = 30, x = c[0] + Math.cos(a) * r, z = c[2] + Math.sin(a) * r;
    add("warmhouse", "The Warmhouse, the square", "Inside the bubble the air is warm and thin, and smells of Earth: grass, bread, beer. Lights are strung round the square; the club's dome glows in the middle.",
      { x, y: c[1] - 95 + 2.5 + 1.7, z, yaw: a + 0.5, pitch: 0.2 });
    const gx = c[0] - 620, gz = c[2] + 160;
    add("warmhouse_below", "Under the Warmhouse", "A bubble of warm air, 340 m across, hangs over the west edge of the city ahead on four cables. It floats because it is lighter than the cold, dense air around it.",
      { x: gx, y: Math.max(terrSurfAt(gx, gz), 0) + 1.7, z: gz, yaw: Math.atan2(c[2] - gz, c[0] - gx), pitch: 0.42 });
  }
  // Chinatown's pagoda: placed (PAGODA_CELL in world.js), so its view is too
  {
    const cx = wrapS(PAGODA_CELL[0]), cz = wrapS(PAGODA_CELL[1]);
    seen.add("pagoda3");
    add("pagoda_3", "Pagoda, Chinatown", "Tiers of curved roofs on " + streetName(cx * 131 + cz * 7) + "; incense and methane frost on the eaves.", facing(cx, cz, Math.floor(hsh(cx, cz, 903) * 4)));
  }
  const kinds = [];
  for (let r = 2; r < 240 && P.length < 34; r += 1) {
    for (let k = 0; k < 8 * r; k++) {
      const a = (k / (8 * r)) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * r), cz = Math.round(Math.sin(a) * r);
      const o = cellAt(cx, cz);
      if (o.wild) continue;
      const zn = o.zone, dn = DISTRICTS[zn], st = streetName(cx * 131 + cz * 7);
      const side = Math.floor(hsh(cx, cz, 903) * 4);
      if ((o.fl & 16) && want("market" + zn)) add("market_" + zn, "Night market, " + dn, "Stalls under strings of light on " + st + ": noodles, cold-weather gear, spare parts, rumours.", facing(cx, cz, side));
      else if ((o.fl & 8) && want("wheel")) add("wheel", "The Ferris wheel, " + dn, "The old wheel turns slowly over " + st + ", its cars lit like lanterns.", facing(cx, cz, side, 1.7));
      else if (o.typ === 11 && (o.fl & 3) === 1 && want("pagoda" + zn)) add("pagoda_" + zn, "Pagoda, " + dn, "Tiers of curved roofs on " + st + "; incense and methane frost on the eaves.", facing(cx, cz, side));
      else if (o.typ === 11 && (o.fl & 3) === 2 && want("tower" + zn)) add("tower_" + zn, "Signal tower, " + dn, "A lattice tower on " + st + ", blinking out to the ships.", facing(cx, cz, side));
      else if (o.typ === 13 && want("pyramid")) add("pyramid", "Corporate pyramid, " + dn, "A stepped pyramid of glass and stone on " + st + "; security drones idle at its apex.", facing(cx, cz, side));
      else if (o.typ === 9 && want("works" + zn)) { add("works_" + zn, "The works, " + dn, "Pipes, stacks and pressure domes on " + st + ": the city's heat and air are made here.", facing(cx, cz, side)); }
      else if (o.typ === 10 && want("apron")) add("spaceport_apron", "Spaceport apron", "Landing pads and fuel lines off " + st + ", under the long light of Saturn.", facing(cx, cz, side));
      else if (o.typ === 6 && giantHas(Math.floor(cx / 8), Math.floor(cz / 8)) && !hallAt(Math.floor(cx / 8), Math.floor(cz / 8)) && !hiveHas(Math.floor(cx / 8), Math.floor(cz / 8)) && !fabHas(Math.floor(cx / 8), Math.floor(cz / 8)) && want("giant" + zn)) {
        // the tower stands in a park: look from above the trees, 140 m out, on the side of the cell that found it
        const bx = (Math.floor(cx / 8) + 0.5) * BIG, bz = (Math.floor(cz / 8) + 0.5) * BIG;
        const a0 = Math.atan2((cz + 0.5) * C - bz, (cx + 0.5) * C - bx);
        const x = bx + Math.cos(a0) * 140, z = bz + Math.sin(a0) * 140;
        add("giant_" + zn, "Below a megatower, " + dn, "Over the park at its foot, a tower that vanishes into the haze above " + st + ".",
          { x, y: Math.max(terrSurfAt(x, z), 0) + 26, z, yaw: Math.atan2(bz - z, bx - x), pitch: 0.38 });
      }
      else if ((o.typ === 1 || o.typ === 2) && o.h > 20 && want("street" + zn)) add("street_" + zn, st + ", " + dn, "A street corner in the " + dn + ": tube traffic humming past, windows stacked up into the haze.", facing(cx, cz, side));
      else if ((o.typ === 1 || o.typ === 2) && o.h > (zn === 3 ? 20 : 60) && want("roof" + zn)) add("roof_" + zn, "Rooftop above " + (zn === 3 ? "" : "the ") + dn, "A rooftop high over " + st + ", " + (zn === 3 ? "" : "the ") + dn + " spread out below.", roofView(cx, cz, a + Math.PI));
      else if (o.egg >= 21 && o.egg <= 23 && want("roofegg")) add("roof_oddity", "A rooftop garden", "Someone keeps a garden up here, with a view across the " + dn + ".", roofView(cx, cz, a));
    }
  }
  // the hillside letters, and the wild places near the city
  if (SIGN) {
    const sx = (SIGN.cx0 + 5) * C, sz = (SIGN.cz + 0.5) * C + SIGN.face * 160;
    const sy = Math.max(terrSurfAt(sx, sz), 0) + 1.7;
    add("sign", "Below the hillside letters", "The letters DRIFT CITY stand on the hill above, each taller than a house.", { x: sx, y: sy, z: sz, yaw: Math.atan2(-SIGN.face, 0), pitch: Math.atan2(SIGN.base + 6 - sy, 160) });
  }
  const wildNames = { 1: ["lighthouse", "The lighthouse", "A lighthouse on the shore, its beam sweeping the methane sea."], 3: ["stones", "The stone circle", "Standing stones on a rise, older than the city, nobody agrees whose."],
    5: ["lander", "The lander", "An old probe, its parachute collapsed beside it on the pebbles."], 7: ["treehouse", "The treehouse", "A cabin in the crown of a great tree, reached by a swaying ladder."],
    15: ["dish", "The radio dish", "A dish in the hills, listening for Earth."], 17: ["cabin", "The mountain cabin", "A cabin high on the slopes, smoke from its heat vent."], 18: ["wreck", "The shipwreck", "A hull stranded in the shallows, its ribs rimed with frost."] };
  const addWild = (cx, cz, wn) => {
    const cam = facing(cx, cz, Math.floor(hsh(cx, cz, 904) * 4));
    cam.x += (cam.x - (cx + 0.5) * C) * 1.6; cam.z += (cam.z - (cz + 0.5) * C) * 1.6;
    cam.y = Math.max(terrSurfAt(cam.x, cam.z), 0) + 1.7;
    cam.yaw = Math.atan2((cz + 0.5) * C - cam.z, (cx + 0.5) * C - cam.x); cam.pitch = 0.12;
    add(wn[0], wn[1], wn[2], cam);
  };
  // the story's stones and treehouse are placed (world.js), so their views are too
  for (const [egg, at] of [[3, STONES_AT], [7, TREEHOUSE_AT]]) { want("egg" + egg); addWild(wrapS(Math.floor(at[0] / C)), wrapS(Math.floor(at[1] / C)), wildNames[egg]); }
  for (let r = 150; r < 360 && P.length < 50; r += 2) {
    for (let k = 0; k < 8 * r && P.length < 50; k += 3) {
      const a = (k / (8 * r)) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * r), cz = Math.round(Math.sin(a) * r);
      const o = cellAt(cx, cz);
      if (o.typ !== 14 || !wildNames[o.egg]) continue;
      if (!want("egg" + o.egg)) continue;
      addWild(cx, cz, wildNames[o.egg]);
    }
  }
  // fill with the land itself: a river bank, a lake shore, a forest glade, a summit, a dune crest
  const land = [["riverbank", "A river bank", "A methane river slides past, silent and dark, between low banks.", (t, w) => t[1] > t[0] + 1 && t[1] > 1.5 && Math.abs(t[1] - 1.4) > 0.01],
    ["lakeshore", "The lake shore", "The edge of a methane lake; tiny waves, and the city's glow far off across it.", (t, w) => t[1] === 0 && t[0] < -3],
    ["glade", "A forest glade", "A clearing in the dark forest; the fronds glow faintly after dark.", (t, w) => w.fo > 0.8 && w.mid > 0.8 && t[1] < t[0]],
    ["summit", "A summit", "A bare summit of ice rock above the haze layer, the city a smudge of light below.", (t, w) => t[0] > 420],
    ["dunes", "Among the dunes", "Dark dunes of organic sand, rippled by the wind.", (t, w) => w.des > 0.8 && w.mid > 0.8]];
  for (const [id, name, blurb, test] of land) {
    let done = false;
    for (let r = 7000; r < 9800 && !done; r += 150) for (let a = 0; a < 6.28 && !done; a += 0.11) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r, t = terrainAt(x, z), w = biomeW(t[2], t[3]);
      if (!test(t, w)) continue;
      const y = Math.max(terrSurfAt(x, z), t[1]) + 1.7;
      add(id, name, blurb, { x, y, z, yaw: a + Math.PI * 0.5, pitch: 0.05 });
      done = true;
    }
  }
  // streets and roofs until there are fifty
  for (let r = 3; r < 200 && P.length < 50; r += 7) {
    for (let k = 0; k < 6 && P.length < 50; k++) {
      const a = k * 1.047 + r * 0.37;
      const cx = Math.round(Math.cos(a) * r), cz = Math.round(Math.sin(a) * r);
      const o = cellAt(cx, cz);
      if (o.wild || (o.typ !== 1 && o.typ !== 2)) continue;
      const st = streetName(cx * 131 + cz * 7);
      add("corner_" + cx + "_" + cz, st + ", " + DISTRICTS[o.zone], "A corner on " + st + ": steam from a vent, the tubes' glass humming with traffic.", facing(cx, cz, Math.floor(hsh(cx, cz, 905) * 4)));
    }
  }
  // the venues' rooms, beyond the fifty
  for (const R of ROOMS) {
    const bp = P.find((p) => p.id === R.base);
    if (bp) P.push({ id: R.id, name: R.name, blurb: R.blurb, x: bp.x, y: bp.y, z: bp.z, yaw: bp.yaw, pitch: 0.02, room: R.kind });
  }
  PLACES = P;
  return P;
}
function placeById(id) { if (!PLACES) buildPlaces(); return PLACES.find((p) => p.id === id); }

// ---------- the story panel: Ink from a FINK file, compiled in the page ----------
// The stories are in story/. Their ink is captured with the repo's frozen backticks kernel
// (packages/backticks), inside a throwaway sandboxed iframe, the same way the Finkosphere story runner does it:
// the .fink.js runs in the box and only the captured strings come back. The ink runtime is the repo's vendored copy
// (third_party/ink), with jsDelivr as a fallback. Paths are relative to dist/city.html.
// The story keeps its place when the panel is closed, and across reloads (browser storage). The panel floats over the
// world: drag its header to move it, its corner to resize it, minimise it to a slim bar.
// Stories link to each other the FINK way, by tags in the story, never by a list in the page: "# FINK: <file>" leaves
// this story for that one; with "# LINKREL: peer" the story you leave keeps its place, to come back to. Each file keeps
// its own save. The front door, story/episodes.fink.js, lists the episodes (Menu > Story > Episodes). The same files
// play in the FINK player, which reads the same tags. Why: the drift-city skill, "Stories".
const TALE_DIR = "../story/", TALE_FIRST = "lamplighter.fink.js", TALE_DOOR = "episodes.fink.js";
const BACKTICKS_URL = "../../packages/backticks/src/index.js";
const INK_URLS = ["../../third_party/ink/ink-full.js", "https://cdn.jsdelivr.net/npm/inkjs@2.4.0/dist/ink-full.js"];
const TALE_GEOM_KEY = "drift.taleGeom.v2"; // v2: a taller default on phones (v1 showed one choice at 400 x 800)
const TALE = { file: TALE_FIRST, title: "", link: null, textClues: taleFetch("drift.textClues") === true, story: null, on: false, scene: null, place: null, paras: [], hot: [], dwell: 0, dwellOn: null, loading: false, min: false };
if (typeof PLACES_BAKED !== "undefined") PLACES = PLACES_BAKED;
// a story file named in a tag or the address: a bare file name in story/, nothing else
function taleFileOk(f) { return typeof f === "string" && /^[a-z0-9_-]+\.fink\.js$/i.test(f); }
{
  let want = null;
  try { want = new URLSearchParams(location.search).get("tale"); } catch (e) {}
  if (want && !want.endsWith(".fink.js")) want += ".fink.js";
  want = taleFileOk(want) ? want : taleFetch("drift.taleFile");
  if (taleFileOk(want)) TALE.file = want;
}
// the save for a story file: the front door keeps none (it is a menu); the first story keeps its old key
function taleKey(f = TALE.file) { return f === TALE_DOOR ? null : f === TALE_FIRST ? "drift.tale.v1" : "drift.tale:" + f; }
// follow a "# FINK:" link: put this story away (it keeps its place) and open that one where it was left
function taleLink(file) {
  const f = String(file || "").replace(/^\.\//, "");
  if (!taleFileOk(f) || TALE.loading) return;
  taleSave();
  TALE.file = f;
  if (f !== TALE_DOOR) taleStore("drift.taleFile", f);
  TALE.story = null; TALE.title = ""; TALE.scene = null; TALE.place = null; TALE.hot = []; TALE.paras = []; TALE.props = [];
  taleOpen();
}

// saves go to localStorage and to taleMem; a page with no storage of its own (a sandboxed frame: the foafos stage app,
// host.js) reads them back from taleMem, and host.js hands taleMem to the shell as its snapshot
function taleMem() { return taleMem.m || (taleMem.m = {}); }
function taleStore(k, v) {
  if (v === null) delete taleMem()[k]; else taleMem()[k] = JSON.stringify(v);
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
function taleFetch(k) {
  if (!k) return null;
  try { const s = localStorage.getItem(k); if (s !== null) return JSON.parse(s); } catch (e) {}
  try { return JSON.parse(taleMem()[k] || "null"); } catch (e) { return null; }
}
function taleSave() { if (TALE.story && taleKey()) taleStore(taleKey(), { state: TALE.story.state.toJson(), paras: TALE.paras, scene: TALE.scene, place: TALE.place, hot: TALE.hot, props: TALE.props }); }
function taleForget() { if (taleKey()) taleStore(taleKey(), null); }

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error("could not load " + url));
    (document.head || document.body).appendChild(s);
  });
}
async function loadInkRuntime() {
  for (const url of INK_URLS) {
    if (globalThis.inkjs) return;
    try { await loadScript(url); } catch (e) { /* try the next one */ }
  }
  if (!globalThis.inkjs) throw new Error("The story engine could not be loaded. Check the connection and try again.");
}
// run the .fink.js in a sandboxed iframe (opaque origin) with the frozen capture installed; get back its first ink block
function extractInBox(src, installSource) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.display = "none";
    frame.srcdoc = '<!DOCTYPE html><meta charset="utf-8"><script>' +
      "var install = " + installSource + ";\n" +
      "var harvest = install(window, { oooOO: 'text/x-ink' });\n" +
      "addEventListener('message', function (e) {\n" +
      "  if (!e.data || e.data.type !== 'fink-exec') return;\n" +
      "  try { (new Function(e.data.src))(); } catch (err) {}\n" +
      "  parent.postMessage({ type: 'fink-harvested', result: harvest() }, '*');\n" +
      "});\n" +
      "parent.postMessage({ type: 'fink-box-ready' }, '*');\n" +
      "<\/script>";
    let done = false;
    const finish = (err, ink) => {
      if (done) return;
      done = true;
      removeEventListener("message", onMsg);
      frame.remove();
      if (err) reject(err); else resolve(ink);
    };
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === "fink-box-ready") frame.contentWindow.postMessage({ type: "fink-exec", src }, "*");
      else if (e.data.type === "fink-harvested") finish(null, (e.data.result && e.data.result.firstInk) || "");
    };
    addEventListener("message", onMsg);
    setTimeout(() => finish(new Error("the story file did not answer")), 8000);
    document.body.appendChild(frame);
  });
}
async function loadTaleInk() {
  const [res, kernel] = await Promise.all([fetch(TALE_DIR + TALE.file), import(new URL(BACKTICKS_URL, location.href).href), loadInkRuntime()]);
  if (!res.ok) throw new Error("the story file could not be fetched (" + res.status + ")");
  const ink = await extractInBox(await res.text(), kernel.INSTALL_CAPTURE_SOURCE);
  if (!ink) throw new Error("no ink found in " + TALE.file);
  return ink;
}
function taleToggle() { if (TALE.on) taleClose(); else taleOpen(); }
function taleOpen() {
  TALE.on = true;
  const el = document.getElementById("tale");
  el.hidden = false;
  taleApplyGeom();
  requestAnimationFrame(() => el.classList?.add("open"));
  if (TALE.story) {
    // back where we were: the same text and choices, the view back at the scene, the clues still to find
    taleSay(TALE.paras, TALE.story.currentChoices);
    if (TALE.place) taleGo(TALE.place);
    return;
  }
  taleSay(["Loading the story\u2026"], []);
  if (TALE.loading) return;
  TALE.loading = true;
  loadTaleInk().then((src) => {
    TALE.loading = false;
    try {
      TALE.story = new inkjs.Compiler(src).Compile();
      // the story's name: a "# title:" tag at the top of the file (a global tag, read through the story API)
      for (const t of TALE.story.globalTags || []) if (/^title\s*:/i.test(t)) TALE.title = t.slice(t.indexOf(":") + 1).trim();
      const tt = document.querySelector(".taleTitle");
      if (tt && TALE.title) tt.textContent = TALE.title;
      const saved = taleFetch(taleKey());
      if (saved && saved.state) {
        try {
          TALE.story.state.LoadJson(saved.state);
          // left at an end (a replacing link has nothing after it): start this one again
          if (!TALE.story.canContinue && !TALE.story.currentChoices.length) throw new Error("ended");
          TALE.paras = saved.paras || []; TALE.scene = saved.scene; TALE.hot = saved.hot || []; TALE.props = saved.props || [];
          taleSay(TALE.paras, TALE.story.currentChoices);
          if (saved.place) taleGo(saved.place);
          showHint("Story resumed.", 4000);
          return;
        } catch (e) { TALE.story.ResetState(); }
      }
      taleAdvance();
      showHint("Drag to look around. Clues glint.", 7000);
    } catch (e) { taleSay(["The story could not be compiled: " + e.message], []); }
  }, (e) => { TALE.loading = false; taleSay([e.message], []); });
}
function taleClose() {
  TALE.on = false;
  const el = document.getElementById("tale");
  el.classList?.remove("open");
  setTimeout(() => { if (!TALE.on) el.hidden = true; }, 250);
  if (NAV.mode === "visit") flyOn();
  const g = document.getElementById("glint");
  if (g) g.hidden = true;
  taleSave();
}
function taleRestart() {
  if (!TALE.story) { taleForget(); taleOpen(); return; }
  TALE.story.ResetState(); TALE.scene = null; TALE.place = null; TALE.hot = []; TALE.paras = [];
  if (!TALE.on) taleOpen();
  taleAdvance();
}
function taleAdvance() {
  const s = TALE.story;
  taleSetVar("in_world", !TALE.textClues); // after every reset too: text routes to clues only without the city, or on request
  const paras = [];
  let cut = -1;
  TALE.link = null;
  while (s.canContinue) {
    const t = s.Continue();
    taleTags(s.currentTags, t);
    if (t.trim()) paras.push(t.trim());
    if (TALE.link && cut < 0) cut = paras.length;
  }
  if (TALE.link) {
    // a "# FINK:" link: show the lines up to the link and a way through; what came after it (a peer link diverts back
    // to a knot with choices) is what this story shows when you come back
    const L = TALE.link;
    TALE.paras = paras.slice(cut);
    taleSave();
    taleSay(paras.slice(0, cut), [{ text: "Go on" }], () => taleLink(L.file));
    return;
  }
  TALE.paras = paras;
  // at an end, inside foafos (host.js): the way back to the story that opened the city
  const back = !s.currentChoices.length && hostOn();
  taleSay(paras, back ? [{ text: "Back to the story" }] : s.currentChoices, back ? () => hostComplete() : undefined);
  taleSave();
}
function taleSay(paras, choices, onPick) {
  const tx = document.getElementById("taleText"), ch = document.getElementById("taleChoices");
  tx.innerHTML = "";
  for (const p of paras) { const e = document.createElement("p"); e.textContent = p; tx.appendChild(e); }
  ch.innerHTML = "";
  choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c.text;
    b.addEventListener("click", (e) => { e.stopPropagation(); if (onPick) onPick(i); else taleChoose(i); });
    ch.appendChild(b);
  });
  tx.scrollTop = 0;
  requestAnimationFrame(feelArm);
  const n = document.getElementById("taleCount");
  if (n) n.textContent = choices.length ? choices.length + (choices.length === 1 ? " choice" : " choices") : "";
}
// where a speaker's voice comes from: your own ("you") from inside your helmet; each other speaker from one person
// in the scene, the same one for as long as the scene lasts (the nearest one not already speaking for someone else).
// Looked up when the line is spoken, so a scene's people are in place by then.
function taleVoiceAt(who) {
  if (who === "you") return null;
  if (TALE.voiceScene !== TALE.scene) { TALE.voiceScene = TALE.scene; TALE.voiceOf = {}; }
  const ps = (TALE.props || []).filter((p) => p.kind === 0 && Math.hypot(p.x - st.x, p.z - st.z) < 40);
  const taken = new Set(Object.values(TALE.voiceOf));
  let q = TALE.voiceOf[who] !== undefined ? ps[TALE.voiceOf[who]] : null;
  if (!q) {
    let best = -1, bd = 1e9;
    ps.forEach((p, i) => { const d = Math.hypot(p.x - st.x, p.z - st.z); if (!taken.has(i) && d < bd) { bd = d; best = i; } });
    if (best < 0) return null;
    TALE.voiceOf[who] = best; q = ps[best];
  }
  return [q.x, q.y + 1.55, q.z];
}
// recorded lines (# speech): one element, a queue; a new choice cuts off what is still waiting
function taleSpeech(file, info) {
  if (typeof AU !== "undefined" && !AU.on) return;
  if (typeof Audio === "undefined") return;
  let url;
  try { url = new URL(file, new URL(TALE_DIR + TALE.file, location.href)).href; } catch (e) { return; }
  const S = TALE.speech || (TALE.speech = { el: new Audio(), q: [] });
  S.el.volume = hostGain();
  S.q.push({ url, info });
  if (!S.wired) { S.wired = true; S.el.addEventListener("ended", () => taleSpeechNext()); S.el.addEventListener("error", () => taleSpeechNext()); }
  if (!S.busy) taleSpeechNext();
}
function taleSpeechNext() {
  const S = TALE.speech;
  if (!S) return;
  if (!S.q.length) { S.busy = false; if (typeof headDone === "function") headDone(); return; }
  S.busy = true;
  const it = S.q.shift();
  S.el.src = it.url;
  if (typeof headSay === "function") headSay(S.el.src, S.el, it.info); // the speaker's face on the comms feed (heads.js)
  const p = S.el.play();
  if (p && p.catch) p.catch(() => taleSpeechNext());
}
function taleSpeechStop() { const S = TALE.speech; if (S) { S.q = []; S.el.pause(); S.busy = false; } if (typeof headHide === "function") headHide(); }
function taleChoose(i) {
  taleSpeechStop();
  TALE.story.ChooseChoiceIndex(i);
  taleAdvance();
}
// tags from the story drive the world
function taleTags(tags, line) {
  // "# mood: <name>" belongs to the line's recorded speech (heads.js), wherever it sits among the line's tags
  const moodTag = tags.find((t) => t.split(":")[0].trim() === "mood");
  const mood = moodTag ? moodTag.slice(moodTag.indexOf(":") + 1).trim() : "";
  for (const tag of tags) {
    const k = tag.split(":")[0].trim(), v = tag.slice(tag.indexOf(":") + 1).trim();
    if (k === "scene") { TALE.scene = v; TALE.hot = []; TALE.live = false; TALE.props = (TALE.props || []).filter((p) => !p.clue); }
    else if (k === "prop") taleAddProp(v);
    else if (k === "live") TALE.live = true;
    // "# voice: <who>": the line is spoken, over the speaker's radio, from the nearest person in the scene
    else if (k === "voice") audioVoice(v, (line || "").split(/\s+/).length, () => taleVoiceAt(v));
    else if (k === "place") taleGo(v);
    else if (k === "time") { const idx = { day: 0, dusk: 1, dawn: 1, night: 2, snow: 3 }[v]; if (idx !== undefined && idx !== todIdx) { todFrom = currentTod(); todIdx = idx; todT = 0; todAuto = 0; NAV.sunOverride = null; syncLabels(); } }
    else if (k === "weather") { WX.forced = v === "snow" ? 0.75 : v === "clear" ? 0 : null; }
    else if (k === "hotspot") {
      const f = v.split("@").map((x) => x.trim());
      if (f.length >= 4 && !TALE.story.variablesState[f[0]]) {
        TALE.hot.push({ v: f[0], label: f[1], bearing: +f[2] * DEG, elev: +f[3] * DEG });
        // the clue itself lies on the ground where you would look for it
        const dist = clampv(1.7 / Math.tan(Math.max(-(+f[3]) * DEG, 0.05)), 1.4, 14);
        taleAddProp("item @ " + f[2] + " @ " + dist.toFixed(2) + " @ 0 @ " + (hsh(f[0].length * 31 + f[0].charCodeAt(0), 7, 930)).toFixed(3) + " @ 0", f[0]);
        // a room's walls may have moved the thing nearer: point the glint at where it lies
        const pl = placeById(TALE.place), it = TALE.props && TALE.props[TALE.props.length - 1];
        if (roomOf(pl) && it && it.clue === f[0]) {
          const h = TALE.hot[TALE.hot.length - 1], dx = it.x - pl.x, dz = it.z - pl.z;
          h.bearing = Math.atan2(dz, dx) - pl.yaw; h.elev = Math.atan2(it.y + 0.05 - pl.y, Math.hypot(dx, dz));
        }
      }
    } else if (k === "fly") { taleClose(); goTo(v); }
    // "# FINK: <file>" (with "# LINKREL: peer" or none): leave for another story once this passage has been shown
    else if (k === "FINK") { TALE.link = { file: v, rel: TALE.linkRel || "" }; TALE.linkRel = ""; }
    else if (k === "LINKREL") { if (TALE.link) TALE.link.rel = v; else TALE.linkRel = v; }
    // "# speech: <mp3>": a recorded line, relative to the story file, played once, after any line before it
    else if (k === "speech") taleSpeech(v, { text: line || "", mood });
    // "# morse: <text>": the masts and the radio key the story's message; empty goes back to the usual ones
    else if (k === "morse") { if (typeof MORSE !== "undefined") MORSE.override = v ? v.toUpperCase() : null; }
    else if (k === "restart") { TALE.story.ResetState(); TALE.scene = null; TALE.place = null; setTimeout(taleAdvance, 0); }
  }
}
// ---------- props: people and objects placed in a scene by the story ----------
// "# prop: kind @ bearing @ distance @ facing @ hue @ parameter": bearing in degrees from the place's view (positive to
// the right), distance in metres, facing in degrees (0 = toward you), hue 0..1, a kind-specific parameter.
const PROP_KINDS = { person: 0, stall: 1, ladder: 2, radio: 3, lamp: 4, ferry: 5, crates: 6, nest: 7, item: 8 };
const PROP_DATA = new Float32Array(4 + 256);
function taleAddProp(v, clue) {
  const f = v.split("@").map((x) => x.trim());
  const kind = PROP_KINDS[f[0]];
  const p = placeById(TALE.place);
  if (kind === undefined || !p) return;
  if (!TALE.props) TALE.props = [];
  const bearing = (+f[1] || 0) * DEG, dist = +f[2] || 5, facing = (+f[3] || 0) * DEG;
  const a = p.yaw + bearing;
  let x = p.x + Math.cos(a) * dist, z = p.z + Math.sin(a) * dist;
  // in a room, everything stands inside its walls
  const R = roomOf(p);
  if (R) {
    const [lx, lz] = roomClamp(R, Math.cos(bearing) * dist, Math.sin(bearing) * dist, kind === 8 ? 0.6 : 0.9);
    x = p.x + Math.cos(p.yaw) * lx - Math.sin(p.yaw) * lz; z = p.z + Math.sin(p.yaw) * lx + Math.cos(p.yaw) * lz;
  }
  let y = p.y - 1.7;
  if (kind === 5) { const tv = terrainAt(x, z); if (tv[1] > -50) y = tv[1] - 0.3; }
  const toCam = Math.atan2(p.z - z, p.x - x);
  TALE.props.push({ kind, x, y, z, rot: Math.PI / 2 - (toCam + facing), scale: 1, hue: +f[4] || 0, param: +f[5] || 0, clue });
}
function taleFillProps() {
  const ps = TALE.story && TALE.on ? (TALE.props || []) : [];
  const n = Math.min(32, ps.length);
  PROP_DATA[0] = n;
  for (let i = 0; i < n; i++) { const p = ps[i]; PROP_DATA.set([p.x, p.y, p.z, p.kind, p.rot, p.scale, p.hue, p.param], 4 + i * 8); }
  return PROP_DATA;
}

// ---------- the live bridge: the story runs alongside the world and shares state with it ----------
// World to story (every half-second): here = the place you are standing at, if any; hour = day, dusk, night or snow;
// snowing = true or false. Story to world: setting want_time or want_weather changes the world. A scene tagged
// "# live" is re-read when "here" changes, so the story can react to wherever you go by yourself.
let taleSyncT = 0;
function taleSetVar(name, v) {
  const vs = TALE.story.variablesState;
  try { if (vs.GetVariableWithName ? vs.GetVariableWithName(name) !== null : vs[name] !== undefined) { if (vs[name] !== v) vs[name] = v; return true; } } catch (e) {}
  return false;
}
function taleSync(dt) {
  if (!TALE.story) return;
  taleSyncT += dt;
  if (taleSyncT < 0.5) return;
  taleSyncT = 0;
  if (!TALE.observed) {
    TALE.observed = true;
    const s = TALE.story;
    try {
      s.ObserveVariable("want_time", (n, v) => { const idx = { day: 0, dusk: 1, night: 2, snow: 3 }[v]; if (idx !== undefined && idx !== todIdx) { todFrom = currentTod(); todIdx = idx; todT = 0; todAuto = 0; NAV.sunOverride = null; syncLabels(); } });
      s.ObserveVariable("want_weather", (n, v) => { WX.forced = v === "snow" ? 0.75 : v === "clear" ? 0 : null; });
    } catch (e) { /* the story does not declare them */ }
  }
  let here = "";
  if (NAV.mode === "surface" || NAV.mode === "visit") {
    let best = 60;
    for (const p of PLACES) { const d = Math.hypot(p.x - st.x, p.z - st.z) + Math.abs(p.y - st.y) * 0.5; if (d < best) { best = d; here = p.id; } }
  }
  const was = TALE.here;
  TALE.here = here;
  taleSetVar("here", here);
  taleSetVar("hour", ["day", "dusk", "night", "snow"][todIdx]);
  taleSetVar("snowing", WX.rain > 0.3);
  if (was !== here && TALE.live && TALE.scene && TALE.on) { TALE.story.ChoosePathString(TALE.scene); taleAdvance(); }
}

// something noticed while looking around: tell the story, and re-enter the scene so its text and choices refresh
function taleFound(h) {
  TALE.story.variablesState[h.v] = true;
  TALE.hot = TALE.hot.filter((x) => x !== h);
  TALE.props = (TALE.props || []).filter((p) => p.clue !== h.v);
  audioChime();
  showHint("You notice " + h.label + ".", 5000);
  if (TALE.scene) { TALE.story.ChoosePathString(TALE.scene); taleAdvance(); }
}

// ---------- the panel's place and size: move by the header, resize by the corner, minimise to a bar ----------
function taleDefaultGeom() {
  const W = innerWidth, H = innerHeight, narrow = W < 640;
  if (narrow) { const hh = Math.round(Math.max(H * 0.5, Math.min(300, H - 120))); return { x: 8, y: H - hh - 44, w: W - 16, h: hh, min: false }; }
  return { x: W - 356, y: 64, w: 340, h: Math.round(Math.min(H * 0.46, 420)), min: false };
}
function taleGeom() { return TALE.geom || (TALE.geom = taleFetch(TALE_GEOM_KEY) || taleDefaultGeom()); }
function taleApplyGeom() {
  const el = document.getElementById("tale"), g = taleGeom();
  const W = innerWidth, H = innerHeight;
  g.w = clampv(g.w, 220, W - 8); g.h = clampv(g.h, 120, H - 16);
  g.x = clampv(g.x, 4 - g.w + 80, W - 80); g.y = clampv(g.y, 4, H - 44);
  if (!el.style) return;
  el.style.left = g.x + "px"; el.style.top = g.y + "px"; el.style.width = g.w + "px"; el.style.height = g.min ? "auto" : g.h + "px";
  el.classList?.toggle("min", !!g.min);
  const mb = document.getElementById("taleMin");
  if (mb) { mb.textContent = g.min ? "\u25a2" : "\u2013"; mb.setAttribute("aria-label", g.min ? "Expand the story" : "Minimise the story"); }
}
function taleResetGeom() { TALE.geom = taleDefaultGeom(); taleStore(TALE_GEOM_KEY, TALE.geom); if (TALE.on) taleApplyGeom(); }
function taleMinToggle() { const g = taleGeom(); g.min = !g.min; taleStore(TALE_GEOM_KEY, g); taleApplyGeom(); }
function taleWirePanel() {
  const el = document.getElementById("tale"), head = document.getElementById("taleHead"), grip = document.getElementById("taleGrip");
  if (!head || !grip || !head.addEventListener) return;
  let drag = null;
  const start = (mode) => (e) => {
    if (e.target && e.target.closest && e.target.closest("button")) return;
    e.preventDefault(); e.stopPropagation();
    const g = taleGeom();
    drag = { mode, x0: e.clientX, y0: e.clientY, g0: { ...g }, id: e.pointerId };
    (mode === "move" ? head : grip).setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = taleGeom(), dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.mode === "move") { g.x = drag.g0.x + dx; g.y = drag.g0.y + dy; }
    else { g.w = drag.g0.w + dx; g.h = drag.g0.h + dy; }
    taleApplyGeom();
  };
  const end = () => { if (drag) { drag = null; taleStore(TALE_GEOM_KEY, taleGeom()); } };
  head.addEventListener("pointerdown", start("move"));
  grip.addEventListener("pointerdown", start("size"));
  for (const t of [head, grip]) { t.addEventListener("pointermove", move); t.addEventListener("pointerup", end); t.addEventListener("pointercancel", end); }
  head.addEventListener("dblclick", (e) => { if (!(e.target && e.target.closest && e.target.closest("button"))) taleMinToggle(); });
  addEventListener("resize", () => { if (TALE.on) taleApplyGeom(); });
}

// ---------- the camera during a story: glide between places, then look around ----------
function taleGo(id) {
  const p = placeById(id);
  if (!p) return;
  // a new place clears the last place's props; staying put keeps them through the conversation
  if (TALE.place !== id) TALE.props = [];
  TALE.place = id;
  if (NAV.site.id !== "home" || NAV.mode === "space" || NAV.mode === "trip" || NAV.mode === "free") {
    tourHold(); NAV.trip = null; NAV.space = null; NAV.free = null; NAV.spaceMix = 0; NAV.cam = null;
    if (NAV.site.id !== "home") arriveRegion(HOME_DEST, true);
  }
  const from = { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
  if (NAV.visit && NAV.visit.to.id === id) return;
  const d = Math.hypot(p.x - from.x, p.z - from.z);
  NAV.visit = { from, to: p, t: 0, T: clampv(1.5 + d / 450, 1.5, 7), ly: 0, lp: 0 };
  NAV.mode = "visit";
}
function visitStep(dt, inp) {
  let V = NAV.visit;
  // a stick (or W, S) pushed during the flight there takes over at once: the view stops where it is and is yours
  // (not during a guided tour: there the sticks only turn the view, and the tour flies on)
  const touring = typeof GUIDE !== "undefined" && GUIDE.on && !GUIDE.paused;
  if (!touring && V.t < V.T && V.t > 0.3 && (inp.move || Math.abs(PAD.lx) > 0.3 || Math.abs(PAD.ly) > 0.3 || Math.abs(PAD.rx) > 0.3)) {
    const here = { ...V.to, id: (V.to.id || "") + "~", x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch, room: 0 };
    V = NAV.visit = { from: here, to: here, t: 1, T: 1, ly: 0, lp: 0 };
  }
  V.t = Math.min(V.t + dt, V.T);
  const e = sstep(0, 1, V.t / V.T);
  const a = V.from, b = V.to;
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const arc = Math.min(240, d * 0.3) * Math.sin(Math.PI * e);
  st.x = a.x + (b.x - a.x) * e; st.z = a.z + (b.z - a.z) * e;
  st.y = a.y + (b.y - a.y) * e + arc;
  let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const there = V.t >= V.T;
  // looking about: once there, or at any time on a tour (a brush turns the view and the tour flies on)
  if (there || touring) { V.ly += inp.dx * 1.6 * dt; V.lp = clampv(V.lp - inp.dy * 1.1 * dt, -1.0, 1.0); }
  st.yaw = a.yaw + dy * e + V.ly + (there ? 0.015 * Math.sin(clock * 0.37) : 0);
  st.pitch = clampv(a.pitch + (b.pitch - a.pitch) * e + V.lp + (there ? 0.01 * Math.sin(clock * 0.29) : 0), -1.3, 1.3);
  // a flight to something picked (V.look): turn to watch it on the way, then settle into the composed view
  if (V.look && !there) {
    const lx = V.look[0] - st.x, ly = V.look[1] - st.y, lz = V.look[2] - st.z;
    const lyaw = Math.atan2(lz, lx), lp = Math.atan2(ly, Math.hypot(lx, lz));
    const w0 = sstep(0, 0.18, V.t / V.T), w1 = sstep(0.72, 1, V.t / V.T);
    const ang = (from, to, w) => { let d = to - from; d = Math.atan2(Math.sin(d), Math.cos(d)); return from + d * w; };
    const watch = ang(a.yaw, lyaw, w0);
    st.yaw = ang(watch, b.yaw, w1) + V.ly;
    st.pitch = clampv((a.pitch + (lp - a.pitch) * w0) * (1 - w1) + b.pitch * w1 + V.lp, -1.3, 1.3);
  }
  // walking or flying into the scene (visitMove); the offset is kept until the next visit
  if (there && V.walk) { if (inp.move || inp.dx || inp.dy) V.walk = null; else visitWalkStep(V, dt); }
  if (there && V.off) { st.x += V.off[0]; st.y += V.off[1]; st.z += V.off[2]; }
  if (there && inp.move && !(touring && GUIDE.phase === "fly")) visitMove(V, inp.move, dt);
  st.roll = 0; st.vx = 0; st.vy = 0; st.vz = 0;
}
// At eye level you walk (Titan's slow lope, the ground followed); higher up you fly along the view. Buildings
// stop you: a step is checked against the flight code's height map rising in front of you (compared with where you
// stand, since a street place can stand inside its coarse boxes). A blocked step slides along the wall instead of
// stopping dead. There is no limit on how far you go. In a room you walk its floor, inside its walls.
function visitMove(V, move, dt) {
  const b = V.to;
  if (!V.off) V.off = [0, 0, 0];
  V.walk = null;
  const R = roomOf(b);
  const eye = b.y + V.off[1] - Math.max(terrSurfAt(b.x + V.off[0], b.z + V.off[2]), 0), walk = R || eye < 6;
  const cp = Math.cos(st.pitch), speed = walk ? 2.6 : 10;
  const dir = walk ? [Math.cos(st.yaw), 0, Math.sin(st.yaw)] : [Math.cos(st.yaw) * cp, Math.sin(st.pitch), Math.sin(st.yaw) * cp];
  const step = move * speed * dt;
  if (R) {
    // room axes: forward along the place's heading, right across it
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const ox = V.off[0] + dir[0] * step, oz = V.off[2] + dir[2] * step;
    const [lx, lz] = roomClamp(R, ox * c + oz * s, -ox * s + oz * c, 0.45);
    V.off = [lx * c - lz * s, 0, lx * s + lz * c];
  } else {
    const x0 = b.x + V.off[0], y0 = b.y + V.off[1], z0 = b.z + V.off[2];
    const h0 = heightAt(x0, z0, y0);
    const tryTo = (nx, nz) => {
      let ny = walk ? Math.max(terrSurfAt(nx, nz), 0) + 1.7 : y0 + dir[1] * step;
      if (!walk) ny = Math.max(ny, Math.max(terrSurfAt(nx, nz), 0) + 2);
      const h1 = heightAt(nx, nz, ny);
      if (h1 > ny - 0.3 && h1 > h0 + 0.5) return null;
      return [nx, ny, nz];
    };
    // straight on, or along the wall: whichever part of the step is free
    const got = tryTo(x0 + dir[0] * step, z0 + dir[2] * step) || tryTo(x0 + dir[0] * step, z0) || tryTo(x0, z0 + dir[2] * step);
    if (!got) return;
    V.off = [got[0] - b.x, got[1] - b.y, got[2] - b.z];
  }
  // a gentle lope: the eye rises and falls over each long, slow stride
  V.walked = (V.walked || 0) + Math.abs(step);
  const bob = walk ? 0.06 * Math.abs(Math.sin(V.walked * 1.1)) : 0;
  st.x = b.x + V.off[0]; st.y = b.y + V.off[1] + bob; st.z = b.z + V.off[2];
}
// "Walk there" (a long press in a scene): a planned move to a point, made to be easy to follow. The view turns to
// the goal first, so you see where you are going; the walk eases in and out at Titan's lope; if buildings stand in
// the way the view rises over them in a crane move, looking down at the goal, and comes down on the far side; at the
// end you face on in the direction you came, the goal in front of you. In a room it is a straight walk.
function visitWalkTo(V, gx, gz) {
  const b = V.to, R = roomOf(b);
  if (!V.off) V.off = [0, 0, 0];
  const from = V.off.slice();
  let to, lift = 0;
  if (R) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), ox = gx - b.x, oz = gz - b.z;
    const [lx, lz] = roomClamp(R, ox * c + oz * s, -ox * s + oz * c, 0.6);
    to = [lx * c - lz * s, 0, lx * s + lz * c];
  } else {
    // Walk the line at eye level, 1.5 m at a time, and find the walls on it. A wall is a rise in the height map from
    // one step to the next (a street place stands inside the flight code's coarse boxes, so neither an absolute
    // height nor the height at the start tells a wall from the street).
    const x0 = b.x + from[0], z0 = b.z + from[2], dx = gx - x0, dz = gz - z0, L = Math.hypot(dx, dz) || 1;
    const eye = (x, z) => Math.max(terrSurfAt(x, z), 0) + 1.7;
    let hp = heightAt(x0, z0, eye(x0, z0)), wall = -1, top = 0, lastOut = 0;
    for (let t = 1.5; t <= L; t += 1.5) {
      const x = x0 + dx * t / L, z = z0 + dz * t / L, y = eye(x, z), h = heightAt(x, z, y);
      if (h > y - 0.3 && h > hp + 0.5) { if (wall < 0) wall = t; top = Math.max(top, h - y); }
      else if (h < hp - 3) lastOut = t;
      if (h <= y - 0.3) lastOut = t;
      hp = h;
    }
    // the goal is the building in front of you (the wall is near the goal): stop 2.5 m short of its face; the goal
    // is beyond buildings: rise over them and come down at the last clear point before the goal
    let stop = L - 2.5;
    if (wall >= 0 && L - wall < 12) stop = wall - 2.5;
    else if (wall >= 0) { lift = top + 4; stop = Math.max(lastOut > wall ? lastOut : wall - 2.5, 0); }
    stop = Math.max(0, stop);
    const tx = x0 + dx * stop / L, tz = z0 + dz * stop / L;
    to = [tx - b.x, eye(tx, tz) - b.y, tz - b.z];
  }
  const D = Math.hypot(to[0] - from[0], to[2] - from[2]);
  if (D < 0.5) return false;
  const yawTo = Math.atan2(to[2] - from[2], to[0] - from[0]);
  const ly0 = V.ly, lp0 = V.lp;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  V.walk = { from, to, lift, t: 0, T: clampv(1.4 + D / (lift ? 9 : 3.2), 2.5, 16), ly0, lyTo: ly0 + wrap(yawTo - (b.yaw + ly0)), lp0 };
  return true;
}
function visitWalkStep(V, dt) {
  const W = V.walk;
  W.t = Math.min(W.t + dt, W.T);
  const k = W.t / W.T;
  // turn first (the first 18%, at most 1.2 s), then go; the move eases in and out
  const tk = Math.min(0.18, 1.2 / W.T), turn = sstep(0, tk, k), go = sstep(tk * 0.66, 1, k);
  const arc = W.lift * Math.sin(Math.PI * go);
  V.off = [W.from[0] + (W.to[0] - W.from[0]) * go, W.from[1] + (W.to[1] - W.from[1]) * go + arc, W.from[2] + (W.to[2] - W.from[2]) * go];
  V.ly = W.ly0 + (W.lyTo - W.ly0) * turn;
  // look a little down at the goal while lifted, level again on landing
  const down = W.lift ? -Math.atan2(W.lift, Math.max(6, Math.hypot(W.to[0] - W.from[0], W.to[2] - W.from[2]) * 0.5)) * Math.sin(Math.PI * go) : 0;
  V.lp = W.lp0 * (1 - turn) + (0.02 - V.to.pitch) * turn + down;
  V.walked = (V.walked || 0) + dt * 2.6 * (1 - Math.min(1, W.lift));
  if (W.t >= W.T) V.walk = null;
}
// hotspots: a faint glint when you look their way; holding one near the centre of view (or tapping it) finds it
function taleHotspots(dt, cam, fov) {
  const g = document.getElementById("glint");
  if (!g) return;
  if (NAV.mode !== "visit" || !TALE.on || !TALE.hot.length || NAV.visit.t < NAV.visit.T) { g.hidden = true; TALE.dwell = 0; return; }
  const p = NAV.visit.to, W = innerWidth, H = innerHeight;
  let best = null, bestA = 9;
  for (const h of TALE.hot) {
    const yaw = p.yaw + h.bearing, cp = Math.cos(h.elev);
    const dv = [Math.cos(yaw) * cp, Math.sin(h.elev), Math.sin(yaw) * cp];
    const a = Math.acos(clampv(dot3(dv, cam.f), -1, 1));
    if (a < bestA) { bestA = a; best = { h, dv }; }
  }
  if (!best || bestA > 0.6) { g.hidden = true; TALE.dwell = 0; return; }
  const z = dot3(best.dv, cam.f);
  const ux = dot3(best.dv, cam.r) / z / fov, uy = dot3(best.dv, cam.up) / z / fov;
  g.style.left = (W / 2 + ux * H / 2) + "px";
  g.style.top = (H / 2 - uy * H / 2) + "px";
  g.style.opacity = String(clampv((0.6 - bestA) / 0.35, 0, 1) * 0.9);
  g.hidden = false;
  g.onclick = (e) => { e.stopPropagation(); taleFound(best.h); };
  if (bestA < 0.12) { if (TALE.dwellOn !== best.h) { TALE.dwellOn = best.h; TALE.dwell = 0; } TALE.dwell += dt; if (TALE.dwell > 0.8) { TALE.dwell = 0; taleFound(best.h); } }
  else TALE.dwell = 0;
}
