// ---------- the ship's computer: guided flights with narration ----------
// Menu > Guided flight (seven stops) or Full tour (fifteen, into four of the bars). The computer flies you over the
// city and says what you are looking at: recorded lines (audio/computer/NN.mp3; how they were made and how to add
// one: audio/computer/README.md) with the same words as a caption, so it works with the sound off.
// Touching the view, a key or the pad pauses the tour: you can look, walk, fly anywhere, and "Carry on" flies you
// back into the tour where you left it. Runs on its own timer, so it works in the WebGPU city and in the WebGL
// fallback (which hops instead of flying).
const GUIDE_LINES = [
  "Guided flight. I will take you over the city and tell you what you are looking at. Touch the screen to stop and look around; the tour waits for you.",
  "Below us is Lumen, the financial core. The tower with the ring is the tallest building in the city, about two hundred and sixty metres. Most of the city's money is managed here.",
  "The old town. The building with the glass dome is the Assembly Hall, where the city meets and votes. The long pools in front of it line the civic avenue.",
  "The Hive. Capsule homes, two hundred and forty metres tall, on the edge of the dorms. Most people in there seldom go out. They live, work and play under headsets. The boards on its walls sell tokes, the Hive's game credits.",
  "The pod fab, where the Hive's capsules are made. It runs on power beamed down from a station in orbit. The white line through the clouds is that beam. It runs day and night.",
  "Chinatown. Low buildings, tight streets, market stalls, and a lot of steam. The pagoda is one of the few places in the city where an open flame is allowed.",
  "The Warmhouse. A bubble of warm Earth air, three hundred and forty metres across, held down by four cables. It floats because warm air is lighter than Titan's cold, dense air. Inside, people can take their helmets off.",
  "The spaceport, at the end of the harbour arm on Kraken Mare. Ships leave from here for Earth, and the Org pays the fare for anyone who goes. Few ships come the other way.",
  "About the airships. Every one of them is called Hindenburg. The first settlers thought that was funny: there is no oxygen in the air here, so nothing burns. The newest is number sixteen thirty-two.",
  "That is the end of the tour. You have control. To fly or walk to anything, press and hold on it.",
  "The full tour: the city from the air, and four of its bars from the inside. About eight minutes. Touch the screen to stop and look around; the tour waits for you.",
  "The signal tower. Its red lights, and the lights on the tallest masts, blink Morse code together. Tonight they send the Asters' words: ad astra per aspera, and the same in toki pona.",
  "A round tower running Conway's Game of Life in its windows. Each window is a cell, and a new generation comes four times a second. Watch for gliders crossing the tower.",
  "Ferry Street, in the neon quarter, at street level. Most of the city's bars are within a few streets of here.",
  "The Cold Tap: nine stools, a heater, a jukebox, and a price list older than the dome. One of the few places left where people talk face to face.",
  "The Low Orbit, by the spaceport. Ship crews drink here between shifts, and the Asters sit along the window to watch the launches.",
  "The Lantern Cellar, forty steps under Chinatown. The late jam here does not stop; players come and go, and the tune goes on.",
  "The jazz club at the centre of the Warmhouse. The air in here is Earth air, so people take their helmets off and hear the band with their own ears.",
  "One board in five on the Hive shows the Asters' poster: toki pona, a language of about a hundred and twenty words, written in katakana. It says: go to the stars.",
  "Standing stones on a rise outside the city. They are older than the city, and nobody agrees who put them there.",
];
// seconds, measured with ffprobe: the caption's time when the sound is off or blocked
const GUIDE_DUR = [10.0, 13.3, 10.2, 17.2, 13.6, 12.1, 19.2, 11.8, 13.7, 8.1, 12.2, 14.9, 13.2, 7.2, 11.6, 9.8, 10.4, 9.4, 13.1, 7.4];
const GUIDE_AUDIO = "../audio/computer/";
// the signal tower: the lattice tower in front of its place's view
function guideSignalTower() {
  const p = placeById("tower_0");
  if (!p) return null;
  const d = C * 0.5 + 3.6;
  return { name: "The signal tower", x: p.x + Math.cos(p.yaw) * d, z: p.z + Math.sin(p.yaw) * d, y0: 0, r: 30, h: 70 };
}
// a Life tower: the tallest organic round tower near the centre that runs the board (scene.wgsl, material 15:
// hsh(cseed, 5, 781) < 0.5 with cseed from the wrapped cell)
function guideLifeTower() {
  let best = null;
  for (let cz = -30; cz <= 30; cz++) for (let cx = -30; cx <= 30; cx++) {
    const o = cellAt(cx, cz);
    if (o.wild || o.typ !== 8 || hsh(wrapS(cx) * 7919 + wrapS(cz) * 104729, 5, 781) >= 0.5) continue;
    if (!best || o.h > best.h) best = { name: "A Life tower", x: (cx + 0.5) * C, z: (cz + 0.5) * C, y0: 0, r: 14, h: o.h };
  }
  return best;
}
// each stop: a landmark to frame (pickLandmarks name, or a function), or a place to go to (`go`, the rooms among
// them); the place to hop to without the GPU city; its lines; `stay`, seconds to linger after the words
const GUIDE_TOURS = {
  short: { intro: 0, end: 9, stops: [
    { mark: "The ringed spire", place: "giant_0", lines: [1] },
    { mark: "The Assembly Hall", place: "hall_steps", lines: [2] },
    { mark: "The Hive", place: "hive", lines: [3] },
    { mark: "The pod fab and its power beam", place: "fab", lines: [4] },
    { mark: "The pagoda of the Flame", place: "pagoda_3", lines: [5] },
    { mark: () => ({ name: "The Warmhouse", x: bubbleAt(clock)[0], z: bubbleAt(clock)[2], y0: bubbleAt(clock)[1] - BUB_R, r: BUB_R, h: BUB_R * 2 }), place: "warmhouse_below", lines: [6] },
    { mark: () => ({ name: "The spaceport", x: CITY_ARM[0] * 0.9, z: CITY_ARM[1] * 0.9, y0: 0, r: 180, h: 60 }), place: "spaceport_apron", lines: [7, 8] },
  ] },
  full: { intro: 10, end: 9, stops: [
    { mark: "The ringed spire", place: "giant_0", lines: [1] },
    { go: "tower_0", place: "tower_0", lines: [11] },
    { mark: guideLifeTower, place: "roof_0", lines: [12], stay: 5 },
    { mark: "The Assembly Hall", place: "hall_steps", lines: [2] },
    { go: "street_1", place: "street_1", lines: [13] },
    { go: "cold_tap", place: "cold_tap", lines: [14], stay: 5 },
    { mark: "The pagoda of the Flame", place: "pagoda_3", lines: [5] },
    { go: "lantern_cellar", place: "lantern_cellar", lines: [16], stay: 7 },
    { mark: "The Hive", place: "hive", lines: [3, 18] },
    { mark: "The pod fab and its power beam", place: "fab", lines: [4] },
    { go: "low_orbit_bar", place: "low_orbit_bar", lines: [15], stay: 5 },
    { mark: () => ({ name: "The spaceport", x: CITY_ARM[0] * 0.9, z: CITY_ARM[1] * 0.9, y0: 0, r: 180, h: 60 }), place: "spaceport_apron", lines: [7, 8] },
    { mark: "The stones", place: "stones", lines: [19] },
    { mark: () => ({ name: "The Warmhouse", x: bubbleAt(clock)[0], z: bubbleAt(clock)[2], y0: bubbleAt(clock)[1] - BUB_R, r: BUB_R, h: BUB_R * 2 }), place: "warmhouse_below", lines: [6] },
    { go: "warmhouse_club", place: "warmhouse_club", lines: [17], stay: 7 },
  ] },
};
const GUIDE = { on: false, paused: false, tour: null, stop: -1, phase: "", queue: [], until: 0, timer: 0, audio: null, cap: null };

function guideCaption(text, paused) {
  if (!document.body || !document.body.appendChild || !document.createElement("div").querySelector) return;
  let c = GUIDE.cap;
  if (!c) {
    c = document.createElement("div"); c.className = "guideCap"; c.setAttribute("role", "status"); c.setAttribute("aria-live", "polite");
    c.innerHTML = '<span class="guideText"></span><span class="guideBtns"><button type="button" class="guideGoBtn">Carry on</button><button type="button" class="guideStopBtn">End tour</button></span>';
    document.body.appendChild(c); GUIDE.cap = c;
    c.querySelector(".guideGoBtn").addEventListener("click", (e) => { e.stopPropagation(); guideResume(); });
    c.querySelector(".guideStopBtn").addEventListener("click", (e) => { e.stopPropagation(); guideStop(true); });
    c.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  c.hidden = !text;
  c.classList.toggle("paused", !!paused);
  c.querySelector(".guideGoBtn").hidden = !paused;
  c.querySelector(".guideText").textContent = text || "";
}
// say one line: the recording if sound is on, the caption always; resolves the time it takes
function guideSay(n) {
  guideCaption(GUIDE_LINES[n]);
  const T = GUIDE_DUR[n] + 0.6;
  if (typeof AU !== "undefined" && AU.on && typeof Audio !== "undefined") {
    const a = GUIDE.audio || (GUIDE.audio = new Audio());
    a.src = GUIDE_AUDIO + String(n).padStart(2, "0") + ".mp3";
    a.volume = 0.9;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }
  return T;
}
function guideTick() {
  if (!GUIDE.on || GUIDE.paused) return;
  if (typeof PAD !== "undefined" && (PAD.lx || PAD.ly || PAD.rx || PAD.ry)) { guidePause(); return; }
  const now = performance.now() / 1000;
  if (GUIDE.phase === "talk") {
    if (now < GUIDE.until) return;
    if (GUIDE.queue.length) { GUIDE.until = now + guideSay(GUIDE.queue.shift()); return; }
    const s = GUIDE.tour.stops[GUIDE.stop];
    GUIDE.phase = "dwell"; GUIDE.until = now + (s && s.stay ? s.stay : 1.5); return;
  }
  if (GUIDE.phase === "dwell" || GUIDE.phase === "intro") {
    if (now < GUIDE.until) return;
    guideNext(); return;
  }
  if (GUIDE.phase === "fly") {
    // start talking as the view comes in to land, so the words meet the picture (in a room: once inside)
    const V = NAV.visit, s = GUIDE.tour.stops[GUIDE.stop];
    const k = V && V.T ? V.t / V.T : 1;
    if (k < (s && s.go && placeById(s.go) && placeById(s.go).room ? 0.97 : 0.62) && now < GUIDE.until) return;
    GUIDE.phase = "talk"; GUIDE.until = now; return;
  }
  if (GUIDE.phase === "end" && now >= GUIDE.until) guideStop(false);
}
// fly to a place the way a story does (a room shows once you arrive)
function guideGo(id) {
  const p = placeById(id);
  if (!p) return false;
  const from = { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
  const d = Math.hypot(p.x - from.x, p.z - from.z);
  tourHold(); NAV.trip = null; NAV.free = null; NAV.cam = null; NAV.spaceMix = 0;
  NAV.visit = { from, to: p, t: 0, T: clampv(2 + d / 380, 2.5, 12), ly: 0, lp: 0 };
  NAV.mode = "visit";
  return true;
}
function guideNext() {
  const tour = GUIDE.tour;
  GUIDE.stop++;
  if (GUIDE.stop >= tour.stops.length) {
    GUIDE.phase = "end"; GUIDE.until = performance.now() / 1000 + guideSay(tour.end);
    if (!roomNow()) flyOn();
    return;
  }
  const s = tour.stops[GUIDE.stop];
  GUIDE.queue = s.lines.slice();
  guideCaption("");
  const now = performance.now() / 1000;
  if (GPUREF.device && s.go && guideGo(s.go)) { GUIDE.phase = "fly"; GUIDE.until = now + 16; return; }
  const L = !s.mark ? null : typeof s.mark === "function" ? s.mark() : pickLandmarks().find((m) => m.name === s.mark);
  if (L && GPUREF.device) {
    pickLaunch({ ...L, y0: L.y0 !== undefined ? L.y0 : Math.max(terrSurfAt(L.x, L.z), 0) }, true);
    GUIDE.phase = "fly"; GUIDE.until = now + 16;
  } else {
    hopPlace(s.place);
    GUIDE.phase = "talk"; GUIDE.until = now + 1.2;
  }
}
function guideStart(which) {
  if (GUIDE.on) guideStop(false);
  if (TALE.on) taleClose();
  if (typeof mapClose === "function") mapClose();
  GUIDE.tour = GUIDE_TOURS[which] || GUIDE_TOURS.short;
  GUIDE.on = true; GUIDE.paused = false; GUIDE.stop = -1; GUIDE.queue = [];
  GUIDE.phase = "intro"; GUIDE.until = performance.now() / 1000 + guideSay(GUIDE.tour.intro) - 2.5;
  clearInterval(GUIDE.timer);
  GUIDE.timer = setInterval(guideTick, 200);
  if (!GUIDE.wired) {
    GUIDE.wired = true;
    document.getElementById("c")?.addEventListener?.("pointerdown", () => guidePause());
    addEventListener("keydown", (e) => { if (!e.repeat && e.key !== "Escape") guidePause(); });
  }
}
// the reader wants to look: stop talking, leave the view where it is, and wait
function guidePause() {
  if (!GUIDE.on || GUIDE.paused) return;
  GUIDE.paused = true;
  GUIDE.pausedIn = GUIDE.phase;
  if (GUIDE.audio) GUIDE.audio.pause();
  guideCaption("Tour paused. Look around, walk or fly anywhere; the tour waits.", true);
}
// back into the tour: the stop you were at, from the start of its words (or the next one if they were done)
function guideResume() {
  if (!GUIDE.on || !GUIDE.paused) return;
  GUIDE.paused = false;
  const ph = GUIDE.pausedIn;
  if (ph === "fly" || ph === "talk") GUIDE.stop--;
  if (ph === "end") { guideStop(false); return; }
  if (ph === "intro") { GUIDE.stop = -1; }
  guideNext();
}
// taken: the reader ended it (the button, the menu): stop at once, leave the view where it is
function guideStop(taken) {
  if (!GUIDE.on) return;
  GUIDE.on = false; GUIDE.paused = false; clearInterval(GUIDE.timer);
  if (GUIDE.audio) GUIDE.audio.pause();
  guideCaption("");
  if (taken) { if (NAV.mode === "visit" && !roomNow()) flyOn(); showHint("You have control.", 2500); }
}
