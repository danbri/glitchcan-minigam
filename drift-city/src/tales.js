// ---------- Tales: 50 room-scale places in and around Drift city, and an Ink story that moves between them ----------
// Places are picked from the generated city itself (so each is really there), in a fixed order, so a story can refer
// to them by id. Each has a camera at eye height (or on a roof), a heading and a pitch.
const DISTRICTS = ["financial district", "neon quarter", "old town", "Chinatown", "industrial belt", "spaceport", "dorms", "crystal quarter"];
const STREET_A = ["Amber", "Tholin", "Methane", "Lantern", "Kraken", "Haze", "Cassini", "Huygens", "Saturnlight", "Ethane", "Dune", "Glass", "Cryo", "Orchid", "Ferry", "Halo"];
const STREET_B = ["Street", "Lane", "Row", "Walk", "Arcade", "Passage", "Parade", "Wynd"];
function streetName(k) { return STREET_A[Math.floor(hsh(k, 3, 901) * STREET_A.length)] + " " + STREET_B[Math.floor(hsh(k, 5, 902) * STREET_B.length)]; }

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
  // scan the city in rings outward from the centre, collecting one of each kind per district
  const seen = new Set();
  const want = (key) => { if (seen.has(key)) return false; seen.add(key); return true; };
  // the Hive, from a Lumen roof across the way: the view that says which side of town you are on
  {
    const cam = roofView(28, 28, 0);
    cam.yaw = Math.atan2(HIVE_C[1] - cam.z, HIVE_C[0] - cam.x); cam.pitch = 0.08;
    add("hive", "Facing the Hive, Lumen roofs", "Across the gap, the pod block fills the sky: patched walls, a million little windows, and the boards telling everyone inside to sleep more.", cam);
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
      else if (o.typ === 6 && giantHas(Math.floor(cx / 8), Math.floor(cz / 8)) && !hallAt(Math.floor(cx / 8), Math.floor(cz / 8)) && !hiveHas(Math.floor(cx / 8), Math.floor(cz / 8)) && want("giant" + zn)) add("giant_" + zn, "Foot of a megatower, " + dn, "The plaza at the base of a tower that vanishes into the haze above " + st + ".", facing(cx, cz, side));
      else if ((o.typ === 1 || o.typ === 2) && o.h > 20 && want("street" + zn)) add("street_" + zn, st + ", " + dn, "A street corner in the " + dn + ": tube traffic humming past, windows stacked up into the haze.", facing(cx, cz, side));
      else if ((o.typ === 1 || o.typ === 2) && o.h > 60 && want("roof" + zn)) add("roof_" + zn, "Rooftop above " + (zn === 3 ? "" : "the ") + dn, "A rooftop high over " + st + ", " + (zn === 3 ? "" : "the ") + dn + " spread out below.", roofView(cx, cz, a + Math.PI));
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
  PLACES = P;
  return P;
}
function placeById(id) { if (!PLACES) buildPlaces(); return PLACES.find((p) => p.id === id); }

// ---------- the story panel: Ink from a FINK file, compiled in the page ----------
// The story is story/lamplighter.fink.js. Its ink is captured with the repo's frozen backticks kernel
// (packages/backticks), inside a throwaway sandboxed iframe, the same way the Finkosphere story runner does it:
// the .fink.js runs in the box and only the captured strings come back. The ink runtime is the repo's vendored copy
// (third_party/ink), with jsDelivr as a fallback. Paths are relative to dist/city.html.
// The story keeps its place when the panel is closed, and across reloads (browser storage). The panel floats over the
// world: drag its header to move it, its corner to resize it, minimise it to a slim bar.
const TALE_URL = "../story/lamplighter.fink.js";
const BACKTICKS_URL = "../../packages/backticks/src/index.js";
const INK_URLS = ["../../third_party/ink/ink-full.js", "https://cdn.jsdelivr.net/npm/inkjs@2.4.0/dist/ink-full.js"];
const TALE_KEY = "drift.tale.v1", TALE_GEOM_KEY = "drift.taleGeom.v1";
const TALE = { textClues: taleFetch("drift.textClues") === true, story: null, on: false, scene: null, place: null, paras: [], hot: [], dwell: 0, dwellOn: null, loading: false, min: false };
if (typeof PLACES_BAKED !== "undefined") PLACES = PLACES_BAKED;

function taleStore(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function taleFetch(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function taleSave() { if (TALE.story) taleStore(TALE_KEY, { state: TALE.story.state.toJson(), paras: TALE.paras, scene: TALE.scene, place: TALE.place, hot: TALE.hot, props: TALE.props }); }
function taleForget() { taleStore(TALE_KEY, null); }

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
  const [res, kernel] = await Promise.all([fetch(TALE_URL), import(new URL(BACKTICKS_URL, location.href).href), loadInkRuntime()]);
  if (!res.ok) throw new Error("the story file could not be fetched (" + res.status + ")");
  const ink = await extractInBox(await res.text(), kernel.INSTALL_CAPTURE_SOURCE);
  if (!ink) throw new Error("no ink found in " + TALE_URL);
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
      const saved = taleFetch(TALE_KEY);
      if (saved && saved.state) {
        try {
          TALE.story.state.LoadJson(saved.state);
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
  while (s.canContinue) {
    const t = s.Continue();
    taleTags(s.currentTags, t);
    if (t.trim()) paras.push(t.trim());
  }
  TALE.paras = paras;
  taleSay(paras, s.currentChoices);
  taleSave();
}
function taleSay(paras, choices) {
  const tx = document.getElementById("taleText"), ch = document.getElementById("taleChoices");
  tx.innerHTML = "";
  for (const p of paras) { const e = document.createElement("p"); e.textContent = p; tx.appendChild(e); }
  ch.innerHTML = "";
  choices.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c.text;
    b.addEventListener("click", (e) => { e.stopPropagation(); taleChoose(i); });
    ch.appendChild(b);
  });
  tx.scrollTop = 0;
  const n = document.getElementById("taleCount");
  if (n) n.textContent = choices.length ? choices.length + (choices.length === 1 ? " choice" : " choices") : "";
}
function taleChoose(i) {
  TALE.story.ChooseChoiceIndex(i);
  taleAdvance();
}
// tags from the story drive the world
function taleTags(tags, line) {
  for (const tag of tags) {
    const k = tag.split(":")[0].trim(), v = tag.slice(tag.indexOf(":") + 1).trim();
    if (k === "scene") { TALE.scene = v; TALE.hot = []; TALE.live = false; TALE.props = (TALE.props || []).filter((p) => !p.clue); }
    else if (k === "prop") taleAddProp(v);
    else if (k === "live") TALE.live = true;
    // "# voice: <who>": the line is spoken, over the speaker's radio, from the nearest person in the scene
    else if (k === "voice") {
      const ps = (AUW.places && AUW.places.persons) || [];
      let from = null, best = 30;
      for (const q of ps) { const d = Math.hypot(q[0] - st.x, q[2] - st.z); if (d < best) { best = d; from = q; } }
      audioVoice(v, (line || "").split(/\s+/).length, from);
    }
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
      }
    } else if (k === "fly") { taleClose(); goTo(v); }
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
  const x = p.x + Math.cos(a) * dist, z = p.z + Math.sin(a) * dist;
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
  if (narrow) { const hh = Math.round(H * 0.36); return { x: 8, y: H - hh - 44, w: W - 16, h: hh, min: false }; }
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
    NAV.trip = null; NAV.space = null; NAV.free = null; NAV.spaceMix = 0; NAV.cam = null; NAV.tour = null;
    if (NAV.site.id !== "home") arriveRegion(HOME_DEST, true);
  }
  const from = { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
  if (NAV.visit && NAV.visit.to.id === id) return;
  const d = Math.hypot(p.x - from.x, p.z - from.z);
  NAV.visit = { from, to: p, t: 0, T: clampv(1.5 + d / 450, 1.5, 7), ly: 0, lp: 0 };
  NAV.mode = "visit";
}
function visitStep(dt, inp) {
  const V = NAV.visit;
  V.t = Math.min(V.t + dt, V.T);
  const e = sstep(0, 1, V.t / V.T);
  const a = V.from, b = V.to;
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const arc = Math.min(240, d * 0.3) * Math.sin(Math.PI * e);
  st.x = a.x + (b.x - a.x) * e; st.z = a.z + (b.z - a.z) * e;
  st.y = a.y + (b.y - a.y) * e + arc;
  let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const there = V.t >= V.T;
  if (there) { V.ly += inp.dx * 1.6 * dt; V.lp = clampv(V.lp - inp.dy * 1.1 * dt, -1.0, 1.0); }
  st.yaw = a.yaw + dy * e + V.ly + (there ? 0.015 * Math.sin(clock * 0.37) : 0);
  st.pitch = clampv(a.pitch + (b.pitch - a.pitch) * e + V.lp + (there ? 0.01 * Math.sin(clock * 0.29) : 0), -1.3, 1.3);
  st.roll = 0; st.vx = 0; st.vy = 0; st.vz = 0;
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
