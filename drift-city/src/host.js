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
  // The city's menu is the shell's (spec §5.9): inside foafos there is no ☰ of the city's own over the view. The
  // same rows go to the shell as actions, and the shell's one window menu draws them (hostMenuPublish below).
  const burger = document.getElementById("bMenu");
  if (burger) burger.hidden = true;
  // Nothing of the city's own over its view in foafos: the readout goes to the shell (hostStatus), the talking
  // heads to its activity stream (headSay in heads.js), a pick to its selection (pick.js).
  const ui = document.getElementById("ui");
  if (ui) ui.hidden = true;
  sdk.onAction((id) => (String(id).startsWith("pick:") ? hostPickAction(id) : hostMenuRun(id)));
  sdk.onDeselect(() => pickMarkSet(null));
  setInterval(hostMenuPublish, 1000);
  if (/[?&]world=1(&|$)/.test(location.search)) {
    H.world = true;
    const bTale = document.getElementById("bTale");   // the story is the runner's: no Story button here
    if (bTale) bTale.hidden = true;
    sdk.onStoryBeat((lines, meta) => worldBeat(lines, meta));
    sdk.onVariableChanged((name, value) => worldVar(name, value));
  }
}

// ---------- the city's menu, as the shell's actions (spec §5.9) ----------
// The owner, September 2026: "The settings we had in a hamburger menu should be formalised via foafos menuing". The
// rows of menuRoot (titan.js) are walked into data: a row with `sub` becomes a group, a row with `check` a setting
// that stays in the menu, any other row a command. Each id is the path of labels to the row, so when the menu
// changes (the tour's rows come and go) an old id finds nothing rather than the wrong row. Sent again when it
// changes, checked once a second; the shell keeps the last list.
const HOST_MENU = { acts: new Map(), sent: "" };
function hostMenuTree() {
  const acts = new Map();
  const walk = (rows, path, depth) => (rows || []).map((r) => {
    const id = path + "/" + r.label;
    const out = { id, label: r.label };
    if (r.detail !== undefined && r.detail !== "") out.detail = String(r.detail);
    if (typeof r.check === "boolean") out.checked = r.check;
    if (r.closes) out.closes = true;
    if (r.sub && depth < 4) {
      const page = r.sub();
      out.items = walk(typeof page.items === "function" ? page.items() : page.items, id, depth + 1);
    } else if (r.act) acts.set(id, r.act);
    return out;
  });
  const items = walk(menuRoot().items(), "menu", 0);
  return { items, acts };
}
function hostMenuPublish() {
  const H = hostState();
  if (!H.on || !H.sdk || !H.sdk.setActions) return;
  let tree;
  try { tree = hostMenuTree(); } catch (e) { return; }   // before the city has its places
  HOST_MENU.acts = tree.acts;
  const json = JSON.stringify(tree.items);
  if (json === HOST_MENU.sent) return;
  HOST_MENU.sent = json;
  H.sdk.setActions(tree.items);
}
function hostMenuRun(id) {
  const act = HOST_MENU.acts.get(id);
  if (act) { try { act(); } catch (e) { /* a row whose state moved on */ } }
  HOST_MENU.sent = "";
  setTimeout(hostMenuPublish, 60);        // checks and labels follow at once
}

// ---------- the readout and the activity stream, in the shell (spec §5.10) ----------
// The readout the page draws along the bottom of its view goes to the shell instead: its parts, and where the
// camera is on Titan (IAU_2015:60600, titanWhere in titan.js) to about 100 m. Sent only when it changes.
const HOST_STATUS = { sent: "" };
function hostStatus(parts) {
  const H = hostState();
  if (!H.sdk || !H.sdk.setStatus) return;
  const w = titanWhere();
  const at = Math.abs(w.lat).toFixed(3) + "°" + (w.lat >= 0 ? "N" : "S") + " " + Math.abs(w.lon).toFixed(3) + "°" + (w.lon >= 0 ? "E" : "W");
  const items = [];
  if (parts[0]) items.push({ id: "mode", value: parts[0] });
  if (parts[1]) items.push({ id: "where", value: parts[1] });
  if (parts[2]) items.push({ id: "far", value: parts[2] });
  items.push({ id: "at", label: "Titan", value: at });
  if (audioBlocked()) items.push({ id: "sound", label: "Sound", value: "off: tap the city" });
  const json = JSON.stringify(items);
  if (json === HOST_STATUS.sent) return;
  HOST_STATUS.sent = json;
  H.sdk.setStatus(items);
}
// Who speaks, for the shell's activity stream: the cast member's name and the line, and, for a face, its frames.
function hostPost(who, text, live) {
  const H = hostState();
  if (H.on && H.sdk && H.sdk.post) H.sdk.post({ who, text, verb: "says", live: !!live });
  H.liveAt = 0;
}
// A frame of the talking head, copied from its canvas right after it is drawn (a WebGL canvas keeps no picture after
// the frame) and transferred, not copied again, to the shell: about 15 a second.
function hostHeadFrame(cv, now) {
  const H = hostState();
  if (!H.sdk || !H.sdk.postFrame || !cv || !cv.width || typeof createImageBitmap !== "function") return;
  if (H.liveAt && now - H.liveAt < 66) return;
  H.liveAt = now;
  createImageBitmap(cv, { resizeWidth: 96, resizeHeight: Math.round(96 * cv.height / cv.width), resizeQuality: "medium" })
    .then((b) => H.sdk.postFrame(b)).catch(() => {});
}
function hostEndLive() { const H = hostState(); if (H.sdk && H.sdk.endLive) H.sdk.endLive(); }

// ---------- the selection, in the shell (spec §5.11) ----------
function hostSelect(S) {
  const H = hostState();
  if (!H.sdk || !H.sdk.select) return;
  pickMarkSet(S || null);
  H.sdk.select(S ? pickEntity(S) : null);
}
function hostPickAction(id) {
  const S = PICK.sel;
  if (!S) return;
  if (id === "pick:fly") pickLaunch(S, true);
  else if (id === "pick:walk") {
    const V = NAV.mode === "visit" && NAV.visit ? NAV.visit : null;
    if (V && !visitWalkTo(V, S.x, S.z)) showHint("You are there.", 1500);
  } else if (id === "pick:map") mapOpen();
}
