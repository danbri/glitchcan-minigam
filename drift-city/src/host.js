// ---------- in foafos: the city as a stage app ----------
// In a frame with the minigame SDK, this page is the foafos stage app "drift" (inklet/finkapp/foafos-apps.js), opened
// by a story's `# MINIGAME: drift [tale=<story>]` (the tale arrives as ?tale=, which tales.js already reads), or by
// `# WORLD: drift` as the world beside a story that the foafos runner plays (world=1; see the end of this file). It
// answers the shell: pause stops the frames (main.js and fallback.js check hostPaused), the Web Audio graph, a running
// tour, a recorded line and the comms feed (heads.js); resume restarts only what pause stopped; the master volume sets the level of all three
// sound paths (hostGain); the snapshot is the story saves, which a sandboxed frame cannot keep in localStorage
// (taleMem in tales.js); and at a story's end the panel offers "Back to the story" (hostComplete). The model is in
// the story-game-sync skill; the drift-city skill, "Drift City as a foafos app", has the lessons.
// State lives on a hoisted function, so the earlier modules can ask before this one has run.
function hostState() { return hostState.s || (hostState.s = { on: false, paused: false, level: 1, sdk: null, held: {} }); }
function hostOn() { return hostState().on; }
function hostPaused() { return hostState().paused; }
function hostGain() { return hostState().level; }
function hostComplete() { const H = hostState(); if (H.sdk) H.sdk.complete({ success: true }); }
function hostSetLevel(level) {
  const H = hostState();
  H.level = Math.max(0, Math.min(1, Number(level)));
  if (!(H.level >= 0)) H.level = 1;
  if (AU.ready && AU.on && AU.ctx) AU.master.gain.setTargetAtTime(0.5 * H.level, AU.ctx.currentTime, 0.1);
  if (GUIDE.audio) GUIDE.audio.volume = 0.9 * H.level;
  if (TALE.speech) TALE.speech.el.volume = H.level;
}
function hostPause() {
  const H = hostState();
  if (H.paused) return;
  H.paused = true;
  H.held = {};
  if (AU.ctx && AU.ctx.state === "running") { AU.ctx.suspend(); H.held.audio = true; }
  if (GUIDE.on && !GUIDE.paused) { guidePause(true); H.held.tour = true; }
  const sp = TALE.speech && TALE.speech.el;
  if (sp && !sp.paused) { sp.pause(); H.held.speech = true; }
  HEADS.paused = true;   // the comms feed poses 20,000 splats on the CPU 30 times a second
}
function hostResume() {
  const H = hostState();
  if (!H.paused) return;
  H.paused = false;
  if (H.held.audio && AU.ctx && AU.on) AU.ctx.resume();
  if (H.held.tour && GUIDE.on && GUIDE.paused) guideResume();
  if (H.held.speech && TALE.speech) TALE.speech.el.play().catch(() => {});
  HEADS.paused = false;
  H.held = {};
}
if (typeof window !== "undefined" && window.parent !== window && typeof MinigameSDK === "function") {
  const H = hostState();
  H.on = true;
  const sdk = (H.sdk = new MinigameSDK());
  sdk.onPause(hostPause);
  sdk.onResume(hostResume);
  sdk.onAudio((a) => hostSetLevel(a && a.level !== undefined ? a.level : 1));
  // Controls from the foafos input service: its two sticks (on-screen, or a gamepad's) write the same PAD values the
  // city's own sticks write, so the city hides its own. A gamepad's directions do not also come as keys (the shell
  // skips them); the keyboard's still do.
  sdk.onControls((c) => { if (c && c.provider === "host" && c.scheme === "sticks") { H.sticks = true; padShow(false); } });
  sdk.onSticks((s) => {
    PAD.lx = s.l[0]; PAD.ly = s.l[1]; PAD.rx = s.r[0]; PAD.ry = s.r[1];
    lastInput = clock; lastUiTouch = clock;
  });
  sdk.onSnapshot(() => { taleSave(); return { v: 1, saves: { ...taleMem() } }; });
  sdk.onRestore((state) => { if (state && state.v === 1 && state.saves) Object.assign(taleMem(), state.saves); });
  // As the WORLD beside a story (`# WORLD: drift`; the shell adds world=1): the story runs in the foafos runner and
  // its tags arrive after every step (tales.js, "the world beside a story in foafos").
  if (/[?&]world=1(&|$)/.test(location.search)) {
    H.world = true;
    const bTale = document.getElementById("bTale");   // the story is the runner's: no Story button here
    if (bTale) bTale.hidden = true;
    sdk.onStoryBeat((lines, meta) => worldBeat(lines, meta));
    sdk.onVariableChanged((name, value) => worldVar(name, value));
  }
}
