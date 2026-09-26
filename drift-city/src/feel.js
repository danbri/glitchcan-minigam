// ---------- choices you can feel ----------
// Slide a thumb over the story's choices while watching the city: each choice has its own rhythm of haptic ticks
// and a quiet tone of its own, crossing from one choice to the next gives a short buzz, and lifting the thumb on a
// choice takes it. A plain tap still works as before. Android plays vibration patterns; iOS Safari has no vibration
// API, so there each tick is the system tick of a switch control (iOS 18 and later; older iPhones get only sound).
const FEEL = { on: taleFetch("drift.feel") !== false, slide: null, timer: 0, idx: -1, beat: 0, sw: null, swLabel: null, skipClick: false };
// four textures: [gap between groups (ms), ticks in a group, gap inside a group (ms), vibration per tick (ms)],
// and the tone that goes with each (Hz, wave)
const FEEL_TEX = [[240, 1, 0, 14], [320, 2, 70, 8], [85, 1, 0, 5], [380, 3, 45, 16]];
const FEEL_TONE = [[196, "sine"], [294, "triangle"], [1800, "noise"], [392, "square"]];

function feelSwitch() {
  if (FEEL.swLabel) return FEEL.swLabel;
  const l = document.createElement("label"), i = document.createElement("input");
  i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
  l.setAttribute("aria-hidden", "true");
  l.style.cssText = "position:fixed;left:-40px;top:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none";
  l.appendChild(i); document.body.appendChild(l);
  FEEL.sw = i; FEEL.swLabel = l;
  return l;
}
// one tick: a vibration where there is one, else the switch's system tick
function feelTick(ms) {
  if (navigator.vibrate) { navigator.vibrate(ms); return; }
  feelSwitch().click();
}
function feelBuzz() {
  if (navigator.vibrate) navigator.vibrate(38);
  else { feelTick(); setTimeout(feelTick, 28); setTimeout(feelTick, 56); }
  if (!AU.ready) return;
  const c = AU.ctx, t = c.currentTime;
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 92;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(f); f.connect(g); g.connect(AU.bus.cue); o.start(t); o.stop(t + 0.08);
}
// the tone for one tick of choice k: short and quiet, under the city's sound
function feelTone(k) {
  if (!AU.ready) return;
  const c = AU.ctx, t = c.currentTime, [hz, wave] = FEEL_TONE[k % 4];
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(wave === "noise" ? 0.05 : 0.07, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (wave === "noise" ? 0.025 : 0.09));
  let src;
  if (wave === "noise") {
    src = c.createBufferSource(); src.buffer = AU.white || null;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = hz; f.Q.value = 3;
    src.connect(f); f.connect(g);
    if (!src.buffer) return;
  } else {
    src = c.createOscillator(); src.type = wave; src.frequency.value = hz;
    src.connect(g);
  }
  g.connect(AU.bus.cue); src.start(t); src.stop(t + 0.1);
}
// the texture under the thumb: a group of ticks, a gap, again, until the thumb moves on
function feelRun(k) {
  clearTimeout(FEEL.timer);
  FEEL.idx = k;
  if (k < 0) return;
  const [gap, n, inner, ms] = FEEL_TEX[k % 4];
  let i = 0;
  const step = () => {
    if (FEEL.idx !== k) return;
    feelTick(ms); feelTone(k);
    i++;
    FEEL.timer = setTimeout(step, i % n === 0 ? gap : inner);
  };
  step();
}
function feelStop() { clearTimeout(FEEL.timer); FEEL.idx = -1; if (navigator.vibrate) navigator.vibrate(0); }
function feelButtonAt(x, y) {
  const e = document.elementFromPoint(x, y);
  const b = e && e.closest ? e.closest("#taleChoices button") : null;
  return b ? [...document.querySelectorAll("#taleChoices button")].indexOf(b) : -1;
}
function feelMark(k) {
  document.querySelectorAll("#taleChoices button").forEach((b, i) => b.classList.toggle("feel", i === k));
}
// touch-action none lets a thumb slide over the choices without the list panning; a list longer than its box
// scrolls instead while the thumb rests near its top or bottom edge (feelEdge)
function feelArm() {
  const ch = document.getElementById("taleChoices");
  if (ch) ch.classList.toggle("feelOn", FEEL.on);
}
function feelEdge() {
  const s = FEEL.slide, ch = document.getElementById("taleChoices");
  if (!s || !ch) return;
  const r = ch.getBoundingClientRect(), m = 22;
  const v = s.cy < r.top + m ? -1 : s.cy > r.bottom - m ? 1 : 0;
  if (v && ch.scrollHeight > ch.clientHeight + 2) {
    const before = ch.scrollTop;
    ch.scrollTop += v * 5;
    if (ch.scrollTop !== before) {
      const k = feelButtonAt(s.cx, s.cy);
      if (k !== FEEL.idx) { if (k >= 0 && FEEL.idx >= 0) feelBuzz(); feelMark(k); feelRun(k); }
    }
  }
  requestAnimationFrame(feelEdge);
}
function feelInit() {
  const ch = document.getElementById("taleChoices");
  if (!ch) return;
  ch.addEventListener("pointerdown", (e) => {
    if (!FEEL.on || e.pointerType !== "touch") return;
    const k = feelButtonAt(e.clientX, e.clientY);
    FEEL.slide = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, t: performance.now(), moved: false };
    requestAnimationFrame(feelEdge);
    try { ch.setPointerCapture(e.pointerId); } catch (err) {}
    feelMark(k); feelRun(k);
  });
  ch.addEventListener("pointermove", (e) => {
    const s = FEEL.slide;
    if (!s || e.pointerId !== s.id) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) s.moved = true;
    s.cx = e.clientX; s.cy = e.clientY;
    const k = feelButtonAt(e.clientX, e.clientY);
    if (k !== FEEL.idx) { if (k >= 0 && FEEL.idx >= 0) feelBuzz(); feelMark(k); feelRun(k); }
  });
  const end = (e, take) => {
    const s = FEEL.slide;
    if (!s || e.pointerId !== s.id) return;
    FEEL.slide = null;
    const k = FEEL.idx;
    feelStop(); feelMark(-1);
    // a slide (or a long rest) takes the choice under the thumb; a quick tap is left to the button's own click
    if (take && k >= 0 && (s.moved || performance.now() - s.t > 450)) { FEEL.skipClick = true; setTimeout(() => { FEEL.skipClick = false; }, 400); taleChoose(k); }
  };
  ch.addEventListener("pointerup", (e) => end(e, true));
  ch.addEventListener("pointercancel", (e) => end(e, false));
  // the click after a slide must not choose a second time
  ch.addEventListener("click", (e) => { if (FEEL.skipClick) { e.stopPropagation(); e.preventDefault(); FEEL.skipClick = false; } }, true);
}
