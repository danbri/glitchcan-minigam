// ---------- talking heads: the cast on a helmet comms feed while their recorded lines play ----------
// When a story plays a recorded line (# speech, tales.js) whose file is named for a cast member (mags-3.mp3), a small
// framed feed opens in the corner with that person's face: a rigged Gaussian-splat head (LAM, from magpie/splatweb,
// synthetic faces only), its mouth moved by the loudness of the clip. On Titan everyone wears a helmet, so a face
// reaching you on the visor's comms feed, flickering, is part of the world. Nothing loads until someone speaks.
// Posed and drawn on the GPU with WebGPU where the browser has it (headRenderer); on the CPU and WebGL2 where not.
// How it is built, the casting and the rules: the drift-city skill, "Talking heads".
const HEAD_LIB = "../../magpie/splatweb/lib/";
const HEAD_ART = "../../magpie/splatweb/third_party/";
// synthetic faces only (the lam-face-pipeline skill): cast by age, sex and character from a contact sheet
const HEAD_CAST = {
  mags: { face: "tpdne-40", name: "Mags", where: "the Cold Tap", base: "wry" },
  dex: { face: "tpdne-21", name: "Dex", where: "the Low Orbit", base: "sly" },
  oskar: { face: "tpdne-28", name: "Oskar", where: "the Lantern Cellar", base: "neutral" },
  nuala: { face: "tpdne-24", name: "Nuala Fenn", where: "", base: "worried" },
  pell: { face: "tpdne-20", name: "Clerk Pell", where: "gate three", base: "stern" },
  ruth: { face: "tpdne-35", name: "Ruth", where: "the Warmhouse", base: "warm" },
  elder: { face: "tpdne-04", name: "Elder Harriet", where: "", base: "wry" },
  org: { face: null, name: "The Org", where: "" },
};
// expressions beyond the mouth, as ARKit shapes: each is a target the face eases toward. A character has a resting
// expression (`base` above); a line may set its own with "# mood: <name>" in the story, and otherwise the words of the
// line are read for a cue (laughs, sighs, quietly, snorts...); failing that, the resting one
const HEAD_MOODS = {
  neutral: {},
  warm: { mouthSmileLeft: 0.3, mouthSmileRight: 0.3, cheekSquintLeft: 0.2, cheekSquintRight: 0.2, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },
  wry: { mouthSmileLeft: 0.3, mouthSmileRight: 0.06, browOuterUpLeft: 0.28, eyeSquintRight: 0.15, mouthDimpleLeft: 0.2 },
  amused: { mouthSmileLeft: 0.55, mouthSmileRight: 0.55, cheekSquintLeft: 0.4, cheekSquintRight: 0.4, eyeSquintLeft: 0.35, eyeSquintRight: 0.35, browInnerUp: 0.1 },
  stern: { browDownLeft: 0.45, browDownRight: 0.45, mouthPressLeft: 0.3, mouthPressRight: 0.3, eyeSquintLeft: 0.15, eyeSquintRight: 0.15 },
  sad: { browInnerUp: 0.55, mouthFrownLeft: 0.35, mouthFrownRight: 0.35, eyeLookDownLeft: 0.2, eyeLookDownRight: 0.2, eyeSquintLeft: 0.1, eyeSquintRight: 0.1 },
  surprised: { browInnerUp: 0.5, browOuterUpLeft: 0.5, browOuterUpRight: 0.5, eyeWideLeft: 0.45, eyeWideRight: 0.45 },
  sly: { eyeSquintLeft: 0.3, eyeSquintRight: 0.3, mouthSmileLeft: 0.25, mouthLeft: 0.12, browDownRight: 0.2 },
  worried: { browInnerUp: 0.45, mouthStretchLeft: 0.12, mouthStretchRight: 0.12, mouthPressLeft: 0.1, mouthPressRight: 0.1 },
  scornful: { noseSneerLeft: 0.3, noseSneerRight: 0.15, browDownLeft: 0.3, mouthRight: 0.12, mouthSmileRight: 0.15 },
};
function headMoodOf(text, tag, base) {
  if (tag && HEAD_MOODS[tag]) return tag;
  const t = (text || "").toLowerCase();
  if (/\b(laughs?|laughing|grins?|chuckles?|smiles?)\b/.test(t)) return "amused";
  if (/\b(snorts?|scoffs?|sneers?)\b/.test(t)) return "scornful";
  if (/\b(sighs?|quietly|softly|tired|crying|a long breath)\b/.test(t)) return "sad";
  if (/\b(thank you|thanks|means it)\b/.test(t)) return "warm";
  if (/\b(snaps?|frowns?|glares?|rubbish)\b/.test(t)) return "stern";
  if (/\b(leans|whispers?|winks?|coy)\b/.test(t)) return "sly";
  return base || "neutral";
}
const HEADS = { lib: null, libP: null, avatars: {}, env: {}, el: null, cv: null, r: null, who: null, audio: null, buf: null, raf: 0, hideAt: 0, fail: false, paused: false, device: null, noGpu: false, rP: null };
function headSpeaker(url) {
  const m = /\/([a-z]+)-[^/]*\.mp3(?:$|\?)/.exec(url || "");
  return m && HEAD_CAST[m[1]] ? m[1] : null;
}
function headLib() {
  if (!HEADS.libP) {
    const gpu = typeof navigator !== "undefined" && navigator.gpu
      ? Promise.all([import(HEAD_LIB + "gpu-splat-compute.js"), import(HEAD_LIB + "gpu-skinned-avatar.js")]).catch(() => null)
      : Promise.resolve(null);
    HEADS.libP = Promise.all([import(HEAD_LIB + "splat-renderer.js"), import(HEAD_LIB + "lam-splats.js"), import(HEAD_LIB + "lam-visemes.js"), gpu])
      .then(([sr, ls, lv, g]) => {
        HEADS.lib = { SplatRenderer: sr.SplatRenderer, F: sr.FLOATS_PER_SPLAT, loadLamAvatar: ls.loadLamAvatar, sampleTalkBurst: lv.sampleTalkBurst,
          gpu: g ? { requestComputeDevice: g[0].requestComputeDevice, GpuSplatScene: g[0].GpuSplatScene, createGpuSkinnedAvatar: g[1].createGpuSkinnedAvatar,
            presortOrder: g[1].presortOrder, MORPH_NAMES: g[1].MORPH_NAMES } : null };
        return HEADS.lib;
      });
  }
  return HEADS.libP;
}
// every ARKit channel a head is driven with: the visemes and blinks (MORPH_NAMES), the moods (HEAD_MOODS) and what
// speech adds in headFrame (brow flashes, the eyes' small jumps). The GPU pose bakes only the channels it is given.
const HEAD_SPEECH_SHAPES = ["jawOpen", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "eyeLookOutLeft", "eyeLookOutRight",
  "eyeLookInLeft", "eyeLookInRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeLookDownLeft", "eyeLookDownRight", "eyeBlinkLeft", "eyeBlinkRight"];
function headMorphNames(base) { return [...new Set([...base, ...HEAD_SPEECH_SHAPES, ...Object.values(HEAD_MOODS).flatMap((m) => Object.keys(m))])]; }
// The drawing. With WebGPU: the pose in a WGSL compute pass (gpu-skinned-avatar.js) and the draw in a GpuSplatScene,
// on the page's own device when it has one (HEADS.device, set by the city's main.js: a phone should not hold two).
// Without it: the CPU pose, 20,000 splats of JavaScript, and the WebGL2 SplatRenderer.
async function headRenderer(L) {
  if (L.gpu && !HEADS.noGpu) {
    try {
      const device = HEADS.device || await L.gpu.requestComputeDevice();
      const scene = new L.gpu.GpuSplatScene(device, HEADS.cv, { background: [0.02, 0.03, 0.04] });
      if (device !== HEADS.device) device.lost.then(() => headGpuLost());
      return { kind: "webgpu", device, scene, rigs: new Map() };
    } catch (e) { console.warn("talking head: no WebGPU, drawing with WebGL2:", e && e.message); headNewCanvas(); }
  }
  return { kind: "webgl2", r: new L.SplatRenderer(HEADS.cv, { background: [0.02, 0.03, 0.04] }), buf: new Float32Array(20200 * L.F) };
}
// a canvas that once gave a WebGPU context cannot give WebGL2: swap in a fresh one
function headNewCanvas() {
  const old = HEADS.cv, cv = document.createElement("canvas");
  if (old && old.parentNode) old.parentNode.replaceChild(cv, old);
  HEADS.cv = cv;
}
function headGpuLost() { HEADS.noGpu = true; HEADS.r = null; HEADS.rP = null; headNewCanvas(); }
// one face on the feed, posed and drawn: its GPU rig is made once per face, its splats ordered once back to front
// from the feed's fixed camera (presortOrder: a scene sorts objects, not the splats inside one); the last three faces
// are kept, the rest freed
function headDraw(a, head, morph, s) {
  const R = HEADS.r, h = a.heightM, eye = [0, h * 0.5, -h * 1.3], look = [0, h * 0.46, 0];
  HEADS.frames = (HEADS.frames || 0) + 1;
  if (R.kind === "webgpu") {
    const G = HEADS.lib.gpu;
    let rig = R.rigs.get(a);
    if (!rig) {
      const obj = R.scene.addObject(a.count, [0, 0, 0]);
      R.device.queue.writeBuffer(obj.orderBuf, 0, G.presortOrder(a, eye, { yaw: a.yaw }));
      rig = { obj, gpu: G.createGpuSkinnedAvatar(R.device, a, obj.outBuf, { morphNames: headMorphNames(G.MORPH_NAMES) }) };
      R.rigs.set(a, rig);
      for (const [k, old] of [...R.rigs].slice(0, -3)) { old.gpu.destroy(); old.obj.outBuf.destroy(); old.obj.orderBuf.destroy(); R.rigs.delete(k); }
    }
    R.scene.objects = [rig.obj];
    rig.gpu.update(s, { at: [0, 0, 0], yaw: a.yaw, bones: { head }, morph });
    R.scene.setCamera(eye, look, 0.7);
    R.scene.render((enc) => rig.gpu.encode(enc));
    return;
  }
  const out = a.pose({ at: [0, 0, 0], bones: { head }, morph }, R.buf, 0);
  R.r.setData(out, a.lastCount);
  R.r.setCamera(eye, look, 0.7);
  R.r.render();
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
function headSay(url, audioEl, info) {
  const who = headSpeaker(url);
  if (!who || HEADS.fail) { headHide(); return; }
  const el = headPanel();
  if (!el) return;
  const c = HEAD_CAST[who];
  el.querySelector(".headName").textContent = c.name + (c.where ? " · " + c.where : "");
  el.classList.toggle("org", !c.face);
  el.hidden = false; el.classList.remove("closing");
  HEADS.who = who; HEADS.audio = audioEl; HEADS.url = url; HEADS.hideAt = 0;
  const text = info && info.text || "";
  HEADS.mood = headMoodOf(text, info && info.mood, c.base);
  HEADS.ask = /\?["'”’]?\s*$/.test(text.trim()) || /\?"/.test(text);
  HEADS.exclaim = /!/.test(text);
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
  // paused by the page's host (the foafos shell): no posing and no drawing, the face stays as it is
  if (HEADS.paused) { HEADS.raf = requestAnimationFrame(headFrame); return; }
  if (HEADS.hideAt && now > HEADS.hideAt) { headHide(); return; }
  HEADS.raf = requestAnimationFrame(headFrame);
  headPlace();
  const A = HEADS.audio, t = A ? A.currentTime : 0, playing = A && !A.paused;
  const E = HEADS.envNow, lvl = E && playing ? E[Math.min(E.length - 1, Math.floor(t * 60))] : 0;
  if (HEADS.el) HEADS.el.style.setProperty("--lvl", lvl.toFixed(2));
  const a = HEADS.av, L = HEADS.lib;
  if (!a || !L || !HEADS.cv) return;
  if (!HEADS.r) {
    if (!HEADS.rP) HEADS.rP = headRenderer(L).then((r) => { HEADS.r = r; }).catch((e) => { HEADS.fail = true; console.warn("talking head unavailable:", e && e.message); headHide(); });
    return;
  }
  // on the CPU the pose is 20,000 splats of JavaScript, so about 30 frames a second; the GPU path draws every frame
  if (HEADS.r.kind === "webgl2") { if (HEADS.last && now - HEADS.last < 30) return; HEADS.last = now; }
  const s = now / 1000;
  const talk = playing ? L.sampleTalkBurst(t, { seed: HEADS.who.length * 17, durationSec: (A.duration || 4) + 1 }) : {};
  // the library's visemes are built to be unmissable in a demo (about 1.4 times full strength); at that size a LAM
  // mouth gapes and shows its empty inside (there are no teeth or tongue in these heads), so: half strength, and the
  // jaw never more than 0.35 open (owner, on a phone: "very toothy or just wrong")
  const morph = {};
  for (const k in talk) morph[k] = talk[k] * 0.5 * Math.min(1, lvl * 1.4);
  morph.jawOpen = Math.min(0.35, Math.max(morph.jawOpen || 0, lvl * 0.3));
  // the expression: the line's mood eased in, plus what speech does to a face: the brows flash and the head dips on
  // stressed syllables (onsets in the loudness), the brows rise toward the end of a question, the eyes wander in
  // small jumps, and a blink closes most phrases
  const X = HEADS.x || (HEADS.x = { cur: {}, flash: 0, prev: 0, lastOn: 0, gx: 0, gy: 0, nextLook: 0, blinkAt: -9, loud: 0 });
  const dt = Math.min(0.1, (now - (X.t || now)) / 1000); X.t = now;
  const target = HEAD_MOODS[HEADS.mood] || {};
  const ease = 1 - Math.exp(-dt / 0.35);
  for (const k of new Set([...Object.keys(X.cur), ...Object.keys(target)])) X.cur[k] = (X.cur[k] || 0) + ((target[k] || 0) - (X.cur[k] || 0)) * ease;
  if (lvl - X.prev > 0.22 && s - X.lastOn > 0.35) { X.flash = HEADS.exclaim ? 1.4 : 1; X.lastOn = s; }
  X.flash *= Math.exp(-dt / 0.25);
  if (X.loud > 0.3 && lvl < 0.05) X.blinkAt = s;
  X.loud = lvl > 0.05 ? Math.max(X.loud * 0.98, lvl) : X.loud * 0.9;
  X.prev = lvl;
  if (s > X.nextLook) { X.gx = (Math.random() - 0.5) * 0.4; X.gy = (Math.random() - 0.5) * 0.25; X.nextLook = s + 0.8 + Math.random() * 2.2; }
  const endQ = HEADS.ask && A && A.duration ? Math.max(0, Math.min(1, (t / A.duration - 0.6) / 0.3)) : 0;
  const add = (k, v) => { morph[k] = Math.min(1, (morph[k] || 0) + v); };
  // these heads answer weakly to the brow, eye and cheek shapes: the moods are written at their true size and applied
  // at 2.5 times (the mouth shapes are the exception: they gape, see above)
  for (const k in X.cur) if (X.cur[k] > 0.005) add(k, X.cur[k] * 2.5);
  add("browInnerUp", 0.25 * X.flash + 0.35 * endQ); add("browOuterUpLeft", 0.2 * X.flash + 0.3 * endQ); add("browOuterUpRight", 0.2 * X.flash + 0.3 * endQ);
  if (X.gx > 0) { add("eyeLookOutLeft", X.gx); add("eyeLookInRight", X.gx); } else { add("eyeLookInLeft", -X.gx); add("eyeLookOutRight", -X.gx); }
  if (X.gy > 0) { add("eyeLookUpLeft", X.gy); add("eyeLookUpRight", X.gy); } else { add("eyeLookDownLeft", -X.gy); add("eyeLookDownRight", -X.gy); }
  const bp = (s % 3.7) / 3.7, pb = s - X.blinkAt;
  const blink = Math.max(bp < 0.05 ? Math.sin(bp / 0.05 * Math.PI) : 0, pb >= 0 && pb < 0.18 ? Math.sin(pb / 0.18 * Math.PI) : 0);
  add("eyeBlinkLeft", blink); add("eyeBlinkRight", blink);
  const yaw = Math.sin(s / 2.9) * 0.1 + lvl * 0.04 * Math.sin(s * 5.0) + X.gx * 0.15, pitch = Math.sin(s / 3.7) * 0.04 - lvl * 0.03 - 0.06 * X.flash + 0.05 * endQ;
  const qy = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], qp = [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
  const head = [qy[3] * qp[0], qy[1] * qp[3], -qy[1] * qp[0], qy[3] * qp[3]];
  headDraw(a, head, morph, s);
}
