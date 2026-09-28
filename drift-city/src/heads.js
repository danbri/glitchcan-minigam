// ---------- talking heads: the cast on a helmet comms feed while their recorded lines play ----------
// When a story plays a recorded line (# speech, tales.js) whose file is named for a cast member (mags-3.mp3), a small
// framed feed opens in the corner with that person's face: a rigged Gaussian-splat head (LAM, from magpie/splatweb,
// synthetic faces only), its mouth moved by the loudness of the clip. On Titan everyone wears a helmet, so a face
// reaching you on the visor's comms feed, flickering, is part of the world. Nothing loads until someone speaks.
// How it is built, the casting and the rules: the drift-city skill, "Talking heads".
const HEAD_LIB = "../../magpie/splatweb/lib/";
const HEAD_ART = "../../magpie/splatweb/third_party/";
// synthetic faces only (the lam-face-pipeline skill): cast by age, sex and character from a contact sheet
const HEAD_CAST = {
  mags: { face: "tpdne-40", name: "Mags", where: "the Cold Tap" },
  dex: { face: "tpdne-21", name: "Dex", where: "the Low Orbit" },
  oskar: { face: "tpdne-28", name: "Oskar", where: "the Lantern Cellar" },
  nuala: { face: "tpdne-24", name: "Nuala Fenn", where: "" },
  pell: { face: "tpdne-20", name: "Clerk Pell", where: "gate three" },
  ruth: { face: "tpdne-35", name: "Ruth", where: "the Warmhouse" },
  elder: { face: "tpdne-04", name: "Elder Harriet", where: "" },
  org: { face: null, name: "The Org", where: "" },
};
const HEADS = { lib: null, libP: null, avatars: {}, env: {}, el: null, cv: null, r: null, who: null, audio: null, buf: null, raf: 0, hideAt: 0, fail: false };
function headSpeaker(url) {
  const m = /\/([a-z]+)-[^/]*\.mp3(?:$|\?)/.exec(url || "");
  return m && HEAD_CAST[m[1]] ? m[1] : null;
}
function headLib() {
  if (!HEADS.libP) {
    HEADS.libP = Promise.all([import(HEAD_LIB + "splat-renderer.js"), import(HEAD_LIB + "lam-splats.js"), import(HEAD_LIB + "lam-visemes.js")])
      .then(([sr, ls, lv]) => { HEADS.lib = { SplatRenderer: sr.SplatRenderer, F: sr.FLOATS_PER_SPLAT, loadLamAvatar: ls.loadLamAvatar, sampleTalkBurst: lv.sampleTalkBurst }; return HEADS.lib; });
  }
  return HEADS.libP;
}
function headAvatar(who) {
  const c = HEAD_CAST[who];
  if (!c || !c.face) return Promise.resolve(null);
  if (!HEADS.avatars[who]) {
    HEADS.avatars[who] = headLib().then((L) => L.loadLamAvatar(HEAD_ART + "lam-synth-faces-tpdne/" + c.face + "/", { yaw: Math.PI, meshBase: HEAD_ART + "lam-sample/" }));
  }
  return HEADS.avatars[who];
}
// the clip's loudness, 60 times a second, from a second fetch of the same file (the browser's cache serves it): the
// line itself keeps playing through its own <audio> element, untouched
function headEnvelope(url) {
  if (HEADS.env[url]) return HEADS.env[url];
  HEADS.env[url] = fetch(url).then((r) => r.arrayBuffer()).then((b) => {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    const c = typeof AU !== "undefined" && AU.ctx ? AU.ctx : new AC();
    return c.decodeAudioData(b);
  }).then((d) => {
    const x = d.getChannelData(0), hop = Math.floor(d.sampleRate / 60), n = Math.floor(x.length / hop), e = new Float32Array(n);
    let mx = 1e-6;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; s += v * v; } e[i] = Math.sqrt(s / hop); if (e[i] > mx) mx = e[i]; }
    for (let i = 0; i < n; i++) e[i] = Math.min(1, e[i] / (mx * 0.7));
    return e;
  }).catch(() => null);
  return HEADS.env[url];
}
function headPanel() {
  if (HEADS.el || typeof document === "undefined" || !document.createElement || !document.body || !document.body.appendChild) return HEADS.el;
  const el = document.createElement("div");
  el.className = "headFeed"; el.hidden = true; el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<canvas></canvas><div class="headScan"></div><div class="headOrg"></div><div class="headName"></div><div class="headCredit">synthetic face · LAM, Apache-2.0</div>';
  document.body.appendChild(el);
  HEADS.el = el; HEADS.cv = el.querySelector("canvas");
  return el;
}
// where the feed sits: inside the story's text as an inset on the right, the words wrapping round it, while the story
// panel is open (taleSay rebuilds the text on every step, so this is checked every frame); in the corner otherwise
function headPlace() {
  const el = HEADS.el, tx = typeof document !== "undefined" && document.getElementById ? document.getElementById("taleText") : null;
  if (!el) return;
  const inTale = !!(tx && tx.offsetParent !== null && tx.clientHeight > 60);
  if (inTale && el.parentNode !== tx) { tx.insertBefore(el, tx.firstChild); el.classList.add("inTale"); }
  else if (!inTale && el.parentNode !== document.body) { document.body.appendChild(el); el.classList.remove("inTale"); }
  else if (inTale && tx.firstChild !== el) tx.insertBefore(el, tx.firstChild);
}
// a line starts: open the feed for its speaker (or close it for anyone else)
function headSay(url, audioEl) {
  const who = headSpeaker(url);
  if (!who || HEADS.fail) { headHide(); return; }
  const el = headPanel();
  if (!el) return;
  const c = HEAD_CAST[who];
  el.querySelector(".headName").textContent = c.name + (c.where ? " · " + c.where : "");
  el.classList.toggle("org", !c.face);
  el.hidden = false; el.classList.remove("closing");
  HEADS.who = who; HEADS.audio = audioEl; HEADS.url = url; HEADS.hideAt = 0;
  HEADS.envNow = null; headEnvelope(url).then((e) => { if (HEADS.url === url) HEADS.envNow = e; });
  if (c.face) {
    headAvatar(who).then((a) => { if (HEADS.who === who) HEADS.av = a; }).catch((e) => { HEADS.fail = true; console.warn("talking head unavailable:", e && e.message); headHide(); });
    HEADS.av = null;
  }
  if (!HEADS.raf && typeof requestAnimationFrame === "function") HEADS.raf = requestAnimationFrame(headFrame);
}
// the line ended: hold the face a moment, then close
function headDone() { if (HEADS.who) HEADS.hideAt = performance.now() + 900; }
function headHide() {
  HEADS.who = null; HEADS.av = null;
  if (HEADS.el && !HEADS.el.hidden) { HEADS.el.classList.add("closing"); setTimeout(() => { if (!HEADS.who && HEADS.el) HEADS.el.hidden = true; }, 350); }
}
function headFrame(now) {
  HEADS.raf = 0;
  if (!HEADS.who) return;
  if (HEADS.hideAt && now > HEADS.hideAt) { headHide(); return; }
  HEADS.raf = requestAnimationFrame(headFrame);
  headPlace();
  const A = HEADS.audio, t = A ? A.currentTime : 0, playing = A && !A.paused;
  const E = HEADS.envNow, lvl = E && playing ? E[Math.min(E.length - 1, Math.floor(t * 60))] : 0;
  if (HEADS.el) HEADS.el.style.setProperty("--lvl", lvl.toFixed(2));
  const a = HEADS.av, L = HEADS.lib;
  if (!a || !L || !HEADS.cv) return;
  // draw at about 30 frames a second: the pose is computed on the CPU for 20,000 splats
  if (HEADS.last && now - HEADS.last < 30) return;
  HEADS.last = now;
  if (!HEADS.r) {
    try { HEADS.r = new L.SplatRenderer(HEADS.cv, { background: [0.02, 0.03, 0.04] }); } catch (e) { HEADS.fail = true; headHide(); return; }
    HEADS.buf = new Float32Array(20200 * L.F);
  }
  const s = now / 1000;
  const talk = playing ? L.sampleTalkBurst(t, { seed: HEADS.who.length * 17, durationSec: (A.duration || 4) + 1 }) : {};
  // the library's visemes are built to be unmissable in a demo (about 1.4 times full strength); at that size a LAM
  // mouth gapes and shows its empty inside (there are no teeth or tongue in these heads), so: half strength, and the
  // jaw never more than 0.35 open (owner, on a phone: "very toothy or just wrong")
  const morph = {};
  for (const k in talk) morph[k] = talk[k] * 0.5 * Math.min(1, lvl * 1.4);
  morph.jawOpen = Math.min(0.35, Math.max(morph.jawOpen || 0, lvl * 0.3));
  const bp = (s % 3.7) / 3.7, blink = bp < 0.05 ? Math.sin(bp / 0.05 * Math.PI) : 0;
  morph.eyeBlinkLeft = blink; morph.eyeBlinkRight = blink;
  const yaw = Math.sin(s / 2.9) * 0.1 + lvl * 0.04 * Math.sin(s * 5.0), pitch = Math.sin(s / 3.7) * 0.04 - lvl * 0.05;
  const qy = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], qp = [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
  const head = [qy[3] * qp[0], qy[1] * qp[3], -qy[1] * qp[0], qy[3] * qp[3]];
  const out = a.pose({ at: [0, 0, 0], bones: { head }, morph }, HEADS.buf, 0);
  HEADS.r.setData(out, a.lastCount);
  const h = a.heightM;
  HEADS.r.setCamera([0, h * 0.56, -h * 1.2], [0, h * 0.52, 0], 0.7);
  HEADS.r.render();
}
