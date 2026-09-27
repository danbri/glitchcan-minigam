// ---------- the ship's computer: a guided flight with narration ----------
// Menu > Guided flight. The computer flies you over the city and says what you are looking at: recorded lines
// (audio/computer/NN.mp3; how they were made and how to add one: audio/computer/README.md) with the same words as
// a caption, so it works with the sound off. Touching the view, a key or the pad hands control back.
// Runs on its own timer, so it works in the WebGPU city and in the WebGL fallback (which hops instead of flying).
const GUIDE_LINES = [
  "Guided flight. I will take you over the city and tell you what you are looking at. Touch the screen at any time to take control.",
  "Below us is Lumen, the financial core. The tower with the ring is the tallest building in the city, about two hundred and sixty metres. Most of the city's money is managed here.",
  "The old town. The building with the glass dome is the Assembly Hall, where the city meets and votes. The long pools in front of it line the civic avenue.",
  "The Hive. Capsule homes, two hundred and forty metres tall, on the edge of the dorms. Most people in there seldom go out. They live, work and play under headsets. The boards on its walls sell tokes, the Hive's game credits.",
  "The pod fab, where the Hive's capsules are made. It runs on power beamed down from a station in orbit. The white line through the clouds is that beam. It runs day and night.",
  "Chinatown. Low buildings, tight streets, market stalls, and a lot of steam. The pagoda is one of the few places in the city where an open flame is allowed.",
  "The Warmhouse. A bubble of warm Earth air, three hundred and forty metres across, held down by four cables. It floats because warm air is lighter than Titan's cold, dense air. Inside, people can take their helmets off.",
  "The spaceport, at the end of the harbour arm on Kraken Mare. Ships leave from here for Earth, and the Org pays the fare for anyone who goes. Few ships come the other way.",
  "About the airships. Every one of them is called Hindenburg. The first settlers thought that was funny: there is no oxygen in the air here, so nothing burns. The newest is number sixteen thirty-two.",
  "That is the end of the guided flight. You have control. To fly to anything, press and hold on it.",
];
// seconds, measured with ffprobe: the caption's time when the sound is off or blocked
const GUIDE_DUR = [9.2, 12.7, 9.6, 18.4, 12.8, 11.2, 17.0, 11.8, 15.7, 7.6];
const GUIDE_AUDIO = "../audio/computer/";
// each stop: a landmark to frame (pickLandmarks name), the place to hop to without the GPU city, and its lines
const GUIDE_STOPS = [
  { mark: "The ringed spire", place: "giant_0", lines: [1] },
  { mark: "The Assembly Hall", place: "hall_steps", lines: [2] },
  { mark: "The Hive", place: "hive", lines: [3] },
  { mark: "The pod fab and its power beam", place: "fab", lines: [4] },
  { mark: "The pagoda of the Flame", place: "pagoda_3", lines: [5] },
  { mark: () => ({ name: "The Warmhouse", x: bubbleAt(clock)[0], z: bubbleAt(clock)[2], y0: bubbleAt(clock)[1] - BUB_R, r: BUB_R, h: BUB_R * 2 }), place: "warmhouse_below", lines: [6] },
  { mark: () => ({ name: "The spaceport", x: CITY_ARM[0] * 0.9, z: CITY_ARM[1] * 0.9, y0: 0, r: 180, h: 60 }), place: "spaceport_apron", lines: [7, 8] },
];
const GUIDE = { on: false, stop: -1, phase: "", queue: [], until: 0, timer: 0, audio: null, cap: null };

function guideCaption(text) {
  if (!document.body || !document.body.appendChild || !document.createElement("div").querySelector) return;
  let c = GUIDE.cap;
  if (!c) {
    c = document.createElement("div"); c.className = "guideCap"; c.setAttribute("role", "status"); c.setAttribute("aria-live", "polite");
    c.innerHTML = '<span class="guideText"></span><button type="button" class="guideStopBtn">Stop</button>';
    document.body.appendChild(c); GUIDE.cap = c;
    c.querySelector(".guideStopBtn").addEventListener("click", (e) => { e.stopPropagation(); guideStop(true); });
  }
  c.hidden = !text;
  c.querySelector(".guideText").textContent = text || "";
}
// say one line: the recording if sound is on, the caption always; resolves the time it takes
function guideSay(n) {
  guideCaption(GUIDE_LINES[n]);
  let T = GUIDE_DUR[n] + 0.6;
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
  if (!GUIDE.on) return;
  if (typeof PAD !== "undefined" && (PAD.lx || PAD.ly || PAD.rx || PAD.ry)) { guideStop(true); return; }
  const now = performance.now() / 1000;
  if (GUIDE.phase === "talk") {
    if (now < GUIDE.until) return;
    if (GUIDE.queue.length) { GUIDE.until = now + guideSay(GUIDE.queue.shift()); return; }
    GUIDE.phase = "dwell"; GUIDE.until = now + 2.5; return;
  }
  if (GUIDE.phase === "dwell" || GUIDE.phase === "intro") {
    if (now < GUIDE.until) return;
    guideNext(); return;
  }
  if (GUIDE.phase === "fly") {
    // start talking as the view comes in to land, so the words meet the picture
    const V = NAV.visit;
    const k = V && V.T ? V.t / V.T : 1;
    if (k < 0.62 && now < GUIDE.until) return;
    GUIDE.phase = "talk"; GUIDE.until = now; return;
  }
  if (GUIDE.phase === "end" && now >= GUIDE.until) guideStop(false);
}
function guideNext() {
  GUIDE.stop++;
  if (GUIDE.stop >= GUIDE_STOPS.length) {
    GUIDE.phase = "end"; GUIDE.until = performance.now() / 1000 + guideSay(9);
    flyOn();
    return;
  }
  const s = GUIDE_STOPS[GUIDE.stop];
  GUIDE.queue = s.lines.slice();
  guideCaption("");
  const L = typeof s.mark === "function" ? s.mark() : pickLandmarks().find((m) => m.name === s.mark);
  if (L && GPUREF.device) {
    pickLaunch({ ...L, y0: L.y0 !== undefined ? L.y0 : Math.max(terrSurfAt(L.x, L.z), 0) }, true);
    GUIDE.phase = "fly"; GUIDE.until = performance.now() / 1000 + 16;
  } else {
    hopPlace(s.place);
    GUIDE.phase = "talk"; GUIDE.until = performance.now() / 1000 + 1.2;
  }
}
function guideStart() {
  if (GUIDE.on) return;
  if (TALE.on) taleClose();
  if (typeof mapClose === "function") mapClose();
  GUIDE.on = true; GUIDE.stop = -1; GUIDE.queue = [];
  GUIDE.phase = "intro"; GUIDE.until = performance.now() / 1000 + guideSay(0) - 2.5;
  clearInterval(GUIDE.timer);
  GUIDE.timer = setInterval(guideTick, 200);
  if (!GUIDE.wired) {
    GUIDE.wired = true;
    document.getElementById("c")?.addEventListener?.("pointerdown", () => guideStop(true));
    addEventListener("keydown", (e) => { if (!e.repeat) guideStop(true); });
  }
}
// taken: the reader took control (a touch, a key, the pad): stop at once, leave the view where it is
function guideStop(taken) {
  if (!GUIDE.on) return;
  GUIDE.on = false; clearInterval(GUIDE.timer);
  if (GUIDE.audio) GUIDE.audio.pause();
  guideCaption("");
  if (taken) { if (NAV.mode === "visit") flyOn(); showHint("You have control.", 2500); }
}
