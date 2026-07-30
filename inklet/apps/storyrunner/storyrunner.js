// FINK Story Runner — the narrative runtime, BOXED.
//
// This runs inside a foafos app frame (opaque origin). It compiles and
// plays a .fink.js entirely in its own document and reaches the shell ONLY
// through the app protocol (foaf.storyRequest / foaf.bus). It has no
// `parent.FoafOS` and never writes host DOM. That is the "sandboxed all the
// way up" containment the live host-side player does not yet have.
//
// Boxes within boxes ("all the way down"). The shell boxes this runner; the
// runner boxes the COMPILE step. The story's JS never runs in the runner's
// own frame — it runs in a nested throwaway opaque-origin iframe, using the
// frozen backticks INSTALL_CAPTURE_SOURCE. So a hostile .fink.js cannot even
// touch this runner's foaf/app-sdk, let alone the host. The runner receives
// only harvested strings. Compilation uses the real inkjs. NO hackparsing.

import { INSTALL_CAPTURE_SOURCE } from '../../../packages/backticks/src/index.js';

const $ = (id) => document.getElementById(id);
const state = {
  storyUrl: null, ready: false, prose: [], choices: [], bg: null,
  ended: false, requests: [], boxedCompile: false,
  media: null, mediaRole: null, mediaSpec: null,
  audio: null, audioPlaying: false, audioLevel: 1, linkedTo: null,
  pausedFor: null, lastGame: null, economy: null,
  depth: 0, restored: false,
  basehref: null, mediaBase: null, status: [], foley: null,
  resumedFromSave: false, knot: null, link: null, knots: 0, skin: null,
};
let story = null;

function setStatus(msg) { $('status').textContent = msg; }

// Extract the ink from a .fink.js by RUNNING it in a nested sandboxed
// iframe (opaque origin), not in this frame. Returns { ink, blocks }.
function extractInBox(src) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');   // opaque origin, no same-origin
    frame.style.display = 'none';
    // The nested box installs the FROZEN capture (byte-identical to the
    // kernel — proved in backticks/test/browser-source.test.js), runs the
    // untrusted story, harvests, and posts back only strings.
    frame.srcdoc = `<!DOCTYPE html><meta charset="utf-8"><script>
      var FINK_SIGILS = { oooOO: 'text/x-ink' };
      var install = ${INSTALL_CAPTURE_SOURCE};
      var harvest = install(window, FINK_SIGILS);
      addEventListener('message', function (e) {
        if (!e.data || e.data.type !== 'fink-exec') return;
        try { (new Function(e.data.src))(); } catch (err) { /* post-capture throw */ }
        parent.postMessage({ type: 'fink-harvested', result: harvest() }, '*');
      });
      parent.postMessage({ type: 'fink-box-ready' }, '*');
    <\/script>`;
    let done = false;
    const finish = (result) => {
      if (done) return; done = true;
      window.removeEventListener('message', onMsg);
      frame.remove();
      resolve(result || { ink: '', blocks: [] });
    };
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === 'fink-box-ready') {
        frame.contentWindow.postMessage({ type: 'fink-exec', src }, '*');
      } else if (e.data.type === 'fink-harvested') {
        const r = e.data.result || {};
        finish({ ink: r.firstInk || '', blocks: r.blocks || [] });
      }
    };
    window.addEventListener('message', onMsg);
    setTimeout(() => finish(null), 4000);            // never hang the runner
    document.body.appendChild(frame);
  });
}

// Prose is added as TEXT, never innerHTML — contained AND xss-proof.
function addProse(text, cls) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.textContent = text;
  $('prose').appendChild(p);
  state.prose.push({ text, cls: cls || '' });
  $('stage').scrollTop = $('stage').scrollHeight;
}

function renderChoices() {
  const ul = $('choices');
  ul.textContent = '';
  state.choices = [];
  if (!story) return;
  story.currentChoices.forEach((choice, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = choice.text;         // TEXT, not innerHTML
    btn.addEventListener('click', () => choose(i));
    li.appendChild(btn);
    ul.appendChild(li);
    state.choices.push(choice.text);
  });
}

// A story tag becomes: a CONTAINED effect (styles this frame) or a
// capability-checked VERB request to the shell — never a host reach.
function handleTag(tag) {
  const at = tag.indexOf(':');
  const key = (at < 0 ? tag : tag.slice(0, at)).trim().toUpperCase();
  const value = (at < 0 ? '' : tag.slice(at + 1)).trim();
  switch (key) {
    case 'BG':
      // Applies to THIS frame's body — the whole point of containment.
      if (value) { document.body.style.background = value; state.bg = value; }
      break;
    case 'CLASS':
      if (value) document.body.classList.add(value);
      break;
    case 'BASEHREF':
      // The story's own media layer. Set before any IMAGE/VIDEO resolves,
      // because it changes what those paths MEAN.
      state.basehref = value || null;
      break;
    case 'STATUS':
      // The status line is the STORY'S (spec §5.5.2): declarative items,
      // one tag each — `# STATUS: <var> [icon=] [label=] [format=] [max=]`
      // — keyed by VAR so a looping knot re-declaring its tags does not
      // append duplicates (3 items becoming 6 then 9 was the live
      // player's bug). `# STATUS: none` means no bar. A bare phrase with
      // no var is still shown as plain text, which is what this runner
      // used to do for everything.
      declareStatus(value);
      break;
    case 'MINIGAME':
      // A game BREAKS the beat and PAUSES the story (#779), the same way
      // the host engine's Continue loop breaks on this tag. Before this
      // the runner fired the verb and carried straight on, so a story
      // that says "play, then use what you won" ran the "then" while the
      // game was still on screen — and every chess/gems/waterworld
      // ending was unreachable. The shell hands the result back and
      // `resumeAfterGame()` continues from exactly here.
      _pendingGame = value.split(/\s+/)[0];
      break;
    case 'FINK':
      // A link to another story. Resolve it against THIS story's location,
      // then break the beat and ask the shell to authorize it (§story.link).
      _pendingLink = resolveStoryUrl(value);
      break;
    case 'LINKREL':
      // How the link COMPOSES (spec §3.4): goDeeper descends and keeps the
      // way back, goShallower surfaces early, oneWay burns the stack. Bare
      // FINK still replaces, which is the back-compatible default.
      _pendingRel = value.trim();
      break;
    // A beat's central media. The last IMAGE/VIDEO in a beat wins (matches
    // the live engine); rendered after the Continue loop.
    case 'IMAGE': case 'VIDEO':
      _beatMedia = parseMedia(key, value);
      break;
    case 'AUDIO':
      playAudio(value);
      break;
    case 'STOP_AUDIO':
      stopAudio();
      break;
  }
}

// Audio in the runner's OWN frame, UNLOCKED ON THE RUNNER'S OWN TAP.
//
// The iOS fix, corrected. iOS unlocks audio only on a gesture in the SAME
// document as the sound. The player's taps — the choices — happen HERE, in
// the runner frame, not in the host. An earlier version brokered audio to
// the host so it "played from a gesture-unlocked document"; but the host's
// gesture never comes (all interaction is in this frame), so on a deep link
// it stayed silent forever. So: play here, and if iOS blocks the first
// play(), arm a one-shot that starts the bed on the next tap in this frame.
// Volume still comes from the shell master (foaf.onAudio → our element), so
// the dock's mute reaches it — audio-as-a-host-service, where the guest
// applies the level itself (spec §5.5). Synth audio (`# AUDIO: synth:*`) is
// the host's FinkFoley, not reachable from the box; named, not silent.
let _audioEl = null;
let _audioLevel = 1;
let _audioArmed = false;

function playAudio(value) {
  const v = (value || '').trim();
  if (!v) return;
  // `synth:<layer>` is PROCEDURAL — there is no file, and the generator is
  // the host's FinkFoley. So it is a host service, asked for by name over
  // the governed audio verb. This used to print "synth is host-only" and
  // play nothing (#779).
  if (/^synth:/i.test(v)) {
    const layer = v.replace(/^synth:/i, '').trim();
    state.audio = v;
    storyRequest('story.audio', { action: 'foley', layer }).then((res) => {
      state.foley = res.ok ? layer : null;
      if (!res.ok) setStatus(`synth audio refused: ${res.reason}`);
    });
    return;
  }
  state.audio = v;
  stopAudio(true);
  // Layered resolution — a bed lives with the art, not next to the story.
  _audioEl = new Audio(resolveMedia(v));
  _audioEl.loop = true;
  _audioEl.volume = _audioLevel;
  _audioEl.play().then(() => { state.audioPlaying = true; }).catch(() => armAudioUnlock());
}

// iOS blocks play() with no gesture. The next tap anywhere in the runner
// (a choice, the pad) starts the bed — that tap IS the gesture iOS wants.
function armAudioUnlock() {
  if (_audioArmed) return;
  _audioArmed = true;
  const go = () => {
    document.removeEventListener('pointerdown', go);
    document.removeEventListener('touchend', go);
    _audioArmed = false;
    if (_audioEl) _audioEl.play().then(() => { state.audioPlaying = true; }).catch(() => { /* still blocked */ });
  };
  document.addEventListener('pointerdown', go, { once: true, passive: true });
  document.addEventListener('touchend', go, { once: true, passive: true });
}

function stopAudio(keep) {
  if (!keep) state.audio = null;
  state.audioPlaying = false;
  if (_audioEl) { try { _audioEl.pause(); } catch (e) { /* gone */ } _audioEl = null; }
}

// The shell's master volume/mute, applied to the runner's own element.
function applyAudioLevel({ level }) {
  _audioLevel = level;
  if (_audioEl) _audioEl.volume = level;
  state.audioLevel = level;
}

// Media role — a per-beat spectrum of prominence. SHORT authoring form
// (`# VIDEO: <id> hero`), MAPPED to the render-hint spec so the two
// schemes stay in sync (docs/fink-media-roles-20260728.md):
//   hero    → X-MEDIA-HERO     media owns the screen; prose is a caption
//   feature → X-MEDIA-FEATURE  big pinned media, prose scrolls below (default)
//   accent  → X-MEDIA-ACCENT   text leads; media is a small, tappable thumb
const MEDIA_ROLES = { hero: 'X-MEDIA-HERO', feature: 'X-MEDIA-FEATURE', accent: 'X-MEDIA-ACCENT' };
let _beatMedia;   // undefined = no media tag this beat (keep previous, sticky)
let _pendingLink; // undefined = no FINK link this beat
// ── the status line is the STORY'S (spec §5.5.2) ──────────────────────
//
// `# STATUS: <var> [icon=🔑] [label=Keys] [format=number|bar|percent|
// time|text] [max=10] [always]`, one tag per item. `# STATUS: none`
// clears the bar. A story that declares nothing gets no bar — the boxed
// runner has no hardcoded economy to fall back on, and inventing one
// would be the content leak the platform keeps removing.
//
// Keyed by VAR, never appended: a looping knot re-declares its tags on
// every visit, and appending turned three items into six then nine in the
// live player. Cleared on compile, or one story's HUD follows the reader
// into the next.
let _statusItems = [];   // the story's readouts, in declaration order

function declareStatus(value) {
  const v = (value || '').trim();
  if (!v) return;
  if (/^none$/i.test(v)) { _statusItems = []; renderStatusBar(); return; }
  const parts = v.split(/\s+/);
  const first = parts[0];
  // A phrase with no key=value pairs and no plausible var name is plain
  // prose — keep showing it as text rather than inventing an item.
  const kv = {};
  let bare = true;
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) { kv[p.slice(0, eq).toLowerCase()] = p.slice(eq + 1); bare = false; }
    else if (p === 'always') { kv.always = 'true'; bare = false; }
  }
  if (bare && !/^[A-Za-z_][\w]*$/.test(first)) { setStatus(v); return; }
  const item = {
    id: first,
    icon: kv.icon || '',
    label: kv.label ? kv.label.replace(/_/g, ' ') : first.replace(/_/g, ' '),
    format: (kv.format || 'number').toLowerCase(),
    max: kv.max != null ? Number(kv.max) : null,
    always: kv.always === 'true',
  };
  const at = _statusItems.findIndex((i) => i.id === item.id);
  if (at >= 0) _statusItems[at] = item; else _statusItems.push(item);
  renderStatusBar();
}

function statusValue(item) {
  let raw;
  try { raw = story?.variablesState?.[item.id]; } catch { raw = undefined; }
  if (raw === undefined || raw === null) return item.always ? '—' : null;
  const n = Number(raw);
  switch (item.format) {
    case 'percent': return `${Math.round((Number.isFinite(n) ? n : 0))}%`;
    case 'time': {
      const s = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    case 'bar': {
      const max = item.max || 10;
      const filled = Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));
      return '█'.repeat(filled) + '·'.repeat(Math.max(0, max - filled));
    }
    case 'text': return String(raw);
    default: return String(Number.isFinite(n) ? n : raw);
  }
}

function renderStatusBar() {
  const bar = $('statusbar');
  if (bar) {
    bar.textContent = '';
    for (const item of _statusItems) {
      const v = statusValue(item);
      if (v === null) continue;                 // undeclared and not `always`
      const span = document.createElement('span');
      span.className = 'sb-item';
      span.dataset.statusVar = item.id;
      span.textContent = `${item.icon ? item.icon + ' ' : ''}${item.label}: ${v}`;
      bar.appendChild(span);
    }
    bar.hidden = !bar.childElementCount;
  }
  // Contribute the same readouts to the menubar (grouped under this app in
  // the tree). Small, and in our own namespace — the sandbox allows
  // app.storyrunner.*; the menubar (shell furniture) aggregates it.
  window.foaf?.bus?.publish('app.storyrunner.status', {
    items: _statusItems.map((i) => ({ id: i.id,
      label: `${i.icon ? i.icon + ' ' : ''}${i.label}: ${statusValue(i) ?? '—'}` })),
  });
  state.status = _statusItems.map((i) => ({ id: i.id, value: statusValue(i) }));
}

function parseMedia(kind, value) {
  const parts = value.split(/\s+/).filter(Boolean);
  let role = 'feature';
  if (parts.length > 1 && MEDIA_ROLES[parts[parts.length - 1].toLowerCase()]) {
    role = parts.pop().toLowerCase();
  }
  return { kind, src: parts.join(' '), role };
}

function renderMedia(m) {
  const stage = $('stage');
  const box = $('media');
  box.textContent = '';
  box.onclick = null;
  if (!m || !m.src) {
    stage.removeAttribute('data-media-role');
    state.media = null; state.mediaRole = null; state.mediaSpec = null;
    return;
  }
  let el;
  if (m.kind === 'VIDEO' && /^[\w-]{11}$/.test(m.src)) {
    // a bare 11-char id is a YouTube video — nocookie embed, in-frame
    el = document.createElement('iframe');
    el.src = `https://www.youtube-nocookie.com/embed/${m.src}`;
    el.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    el.setAttribute('allowfullscreen', '');
    el.title = 'story video';
  } else if (m.kind === 'VIDEO') {
    el = document.createElement('video');
    // Layered resolution, not story-relative: global base → BASEHREF → path.
    el.src = resolveMedia(m.src); el.controls = true; el.playsInline = true;
  } else {
    el = document.createElement('img');
    el.src = resolveMedia(m.src); el.alt = '';
  }
  el.className = 'media-el';
  box.appendChild(el);
  stage.setAttribute('data-media-role', m.role);
  // accent: tap the thumbnail to blow it up to hero, tap again to shrink
  if (m.role === 'accent') {
    box.onclick = () => stage.setAttribute('data-media-role',
      stage.getAttribute('data-media-role') === 'accent' ? 'hero' : 'accent');
  }
  state.media = { kind: m.kind, src: m.src, resolved: el.src || null };
  state.mediaRole = m.role;
  state.mediaSpec = MEDIA_ROLES[m.role];
}

async function storyRequest(verb, detail) {
  state.requests.push({ verb, detail });
  const foaf = window.foaf;
  if (!foaf?.storyRequest) { setStatus(`(standalone: ${verb} not sent)`); return { ok: false, reason: 'standalone' }; }
  const res = await foaf.storyRequest(verb, detail);
  if (!res.ok) setStatus(`${verb} refused: ${res.reason}`);
  foaf.bus?.publish(`app.storyrunner.${verb.replace(/^story\./, '')}`, { verb, detail, ok: res.ok });
  return res;
}

// Resolve a story-authored URL (# FINK: value) against the CURRENT story's
// location, to an absolute URL the shell can authorize.
function resolveStoryUrl(value) {
  try { return new URL(String(value).trim(), new URL(state.storyUrl, location.href)).href; }
  catch { return ''; }
}

// LAYERED MEDIA RESOLUTION (#779), matching FinkUtils' three layers:
//
//   global media base (shell config, handed over at init)
//     → story `# BASEHREF:` (defaults to "media/")
//       → the path the beat named
//
// An absolute path or a full URL short-circuits the chain — a story that
// says `/somewhere/pic.png` means it. Media resolution is NOT the same
// question as story-link resolution: art commonly lives in one shared
// folder while stories live in several, which is the whole reason the
// global layer exists.
function resolveMedia(path) {
  const p = String(path || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) { try { return new URL(p, location.origin).href; } catch { return p; } }
  const storyDir = (() => {
    try { return new URL('.', new URL(state.storyUrl, location.href)).href; }
    catch { return location.href; }
  })();
  // The global base is itself resolved against the page, not the story —
  // it is an installation-wide fact, not a story-relative one.
  let base = storyDir;
  if (state.mediaBase) {
    try { base = new URL(state.mediaBase, location.href).href; } catch { /* keep storyDir */ }
  }
  let href = state.basehref || 'media/';
  if (!href.endsWith('/')) href += '/';
  let mediaBase;
  try {
    mediaBase = /^https?:\/\//i.test(href) ? href
      : href.startsWith('/') ? new URL(href, location.origin).href
      : new URL(href, base).href;
  } catch { mediaBase = base + href; }
  try { return new URL(p, mediaBase).href; } catch { return mediaBase + p; }
}

function advance() {
  if (!story) return;
  _beatMedia = undefined;                 // undefined ⇒ keep previous (sticky)
  _pendingLink = undefined;
  _pendingGame = undefined;
  // A LINKREL from an earlier beat must not colour a later link: the
  // annotation belongs to the link it travels with.
  _pendingRel = undefined;
  sampleKnot();                           // valid BEFORE the first Continue
  while (story.canContinue) {
    const text = story.Continue();
    sampleKnot();                         // and again while there is a path
    (story.currentTags || []).forEach(handleTag);
    const trimmed = text.trim();
    if (trimmed) {
      if (_pendingEcho !== undefined) {
        const echo = _pendingEcho; _pendingEcho = undefined;
        // Compare on collapsed whitespace: ink re-flows its output.
        const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!norm(trimmed).startsWith(norm(echo))) addProse(echo, 'player');
      }
      addProse(trimmed);
    }
    // A FINK link or a MINIGAME ends the beat — matching the host
    // engine, which breaks its loop on exactly these two tags.
    if (_pendingLink !== undefined || _pendingGame !== undefined) break;
  }
  if (_beatMedia !== undefined) renderMedia(_beatMedia);
  // Values change as the story runs, so the bar is re-read every beat —
  // the tags DECLARE the items, the ink holds the numbers.
  renderStatusBar();
  if (_pendingLink !== undefined) {
    const url = _pendingLink; _pendingLink = undefined;
    followLink(url);
    return;                                  // the linked story replaces this one
  }
  if (_pendingGame !== undefined) {
    const game = _pendingGame; _pendingGame = undefined;
    launchAndWait(game);
    return;                                  // paused: no choices until it ends
  }
  renderChoices();
  sampleKnot();                           // choices know their own container
  // Tell the shell where the reader is, so the address bar and breadcrumb
  // follow the reading. After renderChoices, so the position reported is
  // the one the reader is actually looking at.
  reportPosition();
  if (!story.canContinue && story.currentChoices.length === 0) {
    // END inside a dream POPS instead of ending — that is what makes a
    // nested story a dream rather than a dead end. Only the outermost END
    // is really the end.
    if (_frames.length) {
      window.foaf?.bus?.publish('app.storyrunner.surfacing', {
        summary: `inner story ended — surfacing to depth ${_frames.length - 1}`,
        depth: _frames.length - 1,
      });
      surface();
      return;
    }
    state.ended = true;
    setStatus('— THE END —');
    window.foaf?.bus?.publish('app.storyrunner.ended', { summary: 'story ended' });
  }
}

function choose(i) {
  if (!story || i < 0 || i >= story.currentChoices.length) return;
  // DON'T echo yet. An UNBRACKETED ink choice (`+ Open wardrobe -> knot`)
  // has its text included in the story's own output when taken, so echoing
  // here printed it twice — visible under Hampstead as "Open wardrobe"
  // followed by "Open wardrobe Inside the wardrobe you see…". The live
  // player adds no echo at all for exactly this reason. A BRACKETED choice
  // (`+ [Look] …`) is suppressed by ink, though, and then an echo is the
  // only record of what the reader chose. So: hold it, and add it only if
  // the story did not say it itself.
  _pendingEcho = story.currentChoices[i].text;
  story.ChooseChoiceIndex(i);
  advance();
}

// ── minigames: pause, then resume with what was won (#779) ────────────
//
// The story cannot resume itself and the shell cannot reach into this
// frame's ink, so the shell carries the result across: `story.launch`
// answers `awaiting: 'minigame.complete'`, and a `story.event` message
// arrives when the game ends. While paused there are NO choices — the
// story is genuinely suspended, not merely quiet.
let _pendingGame;                       // undefined = no game this beat
let _awaitingGame = null;

async function launchAndWait(game) {
  const res = await storyRequest('story.launch', { game });
  if (!res.ok) {
    // A refused launch must not strand the reader in a story with no
    // choices. Say so and carry on — the beat continues without the game.
    setStatus(`${game} refused: ${res.reason}`);
    state.pausedFor = null;
    renderChoices();
    return;
  }
  _awaitingGame = game;
  state.pausedFor = game;
  setStatus(`playing ${game}…`);
  renderChoices();                      // clears them: paused means paused
  window.foaf?.bus?.publish('app.storyrunner.paused', {
    summary: `story paused for ${game}`, game,
  });
}

// The result comes back governed: the shell checked the guest's manifest
// when it wrote, so these values are the ACCEPTED economy, not a request.
// The runner mirrors them into its own ink VARs — assignment to a name
// the story never declared throws in inkjs, so each is guarded and the
// misses are reported rather than swallowed.
function resumeAfterGame(detail) {
  const game = _awaitingGame;
  _awaitingGame = null;
  state.pausedFor = null;
  const applied = [], missed = [];
  for (const [name, value] of Object.entries(detail?.variables || {})) {
    try { story.variablesState[name] = value; applied.push(name); }
    catch { missed.push(name); }
  }
  state.lastGame = { game, success: detail?.success ?? null,
                     score: detail?.score ?? null, applied, missed };
  window.foaf?.bus?.publish('app.storyrunner.resumed', {
    summary: `${game} finished — story resumes` +
      (applied.length ? ` (${applied.join(', ')})` : ''),
    game, applied, missed,
  });
  setStatus(missed.length ? `resumed (undeclared: ${missed.join(', ')})` : 'resumed');
  advance();                            // continue from where the tag broke
}

// The shared economy, brokered. Seeded at compile so a story opens with
// the treasure the reader already has, and re-read after a game so its
// own VARs agree with the shell's canonical copy.
async function seedEconomy() {
  const declared = declaredNames();
  if (declared) await storyRequest('story.vars', { op: 'declares', names: declared });
  const res = await storyRequest('story.vars', { op: 'read' });
  if (!res.ok || !res.values) return;
  for (const [name, value] of Object.entries(res.values)) {
    if (value === undefined) continue;
    try { story.variablesState[name] = value; } catch { /* not declared here */ }
  }
  state.economy = res.values;
}

// Read the names from the COMPILED story, never from its source text.
function declaredNames() {
  try {
    const g = story?.variablesState?._globalVariables;
    return g ? [...g.keys()] : null;
  } catch { return null; }
}

// ── navigation: the runner owns the POSITION, the shell owns the URL ───
//
// A boxed story cannot touch `location` — that is the containment working.
// So after every beat the runner reports where the reader is and the shell
// mints the two-part link, updates the address bar and feeds the
// breadcrumb. The hashes are FinkNavigation's, so a link minted from the
// box is byte-identical to one minted by the host player and just as
// shareable.
//
// The KNOT is read from the compiled story's own path string, never
// guessed from prose: `currentPathString` is the ink runtime's answer.
// WHEN you ask matters. The live engine's own comment says it: after the
// initial divert the path is valid BEFORE the first Continue() and becomes
// NULL after it. So the knot is sampled during the beat, not read off
// afterwards — asking at the end returned null every time and no two-part
// link was ever minted.
let _beatKnot = null;

// "newsreel.0.c-1" → "newsreel". The container, not the leaf, because a
// link should land on a beat a reader recognises. A purely numeric head
// means root-level content, which genuinely has no knot name.
function knotHead(path) {
  const head = String(path || '').split('.')[0];
  return head && !/^\d+$/.test(head) ? head : null;
}

// TWO signals, because neither alone is enough — measured, not assumed:
//
//   · `state.currentPathString` is valid BEFORE the first Continue() of a
//     beat and NULL after it (the live engine's own comment says so). But
//     when a CHOICE caused the divert it still reads the old container, so
//     it never names the knot you just entered.
//   · the choices now on offer were DEFINED inside the current knot, so
//     `choice.sourcePath` names it exactly. This is the one that works for
//     choice-driven stories, which is most of them.
//
// Visit counts are not a third option: ink only tracks them for containers
// a conditional references, so they read 0 for every knot in these stories.
function sampleKnot() {
  try {
    const fromPath = knotHead(story?.state?.currentPathString);
    if (fromPath) { _beatKnot = fromPath; return; }
    const src = story?.currentChoices?.[0]?.sourcePath;
    const fromChoice = knotHead(src);
    if (fromChoice) _beatKnot = fromChoice;
  } catch { /* no path yet */ }
}
function currentKnot() { return _beatKnot; }

let _lastReported = '';
function reportPosition(push = false) {
  if (!story || !state.storyUrl) return;
  const knot = currentKnot();
  const key = `${state.storyUrl}#${knot || ''}`;
  if (key === _lastReported) return;          // one report per real move
  _lastReported = key;
  state.knot = knot;
  storyRequest('story.navigate', { op: 'position', url: state.storyUrl, knot, push })
    .then((res) => { if (res.ok) state.link = res.link || null; });
}

// A deep link at boot: the shell answers what the URL asks for, and the
// runner goes there if it can. A knot it does not have is reported, not
// silently ignored — a shared link that lands somewhere wrong should say so.
async function honourDeepLink() {
  const res = await storyRequest('story.navigate', { op: 'resolve' });
  if (!res.ok || !res.parsed) return false;
  return gotoKnotHash(res.parsed.knotHash);
}

// Resolve a knot HASH against this story's own knots. The runner builds the
// map itself, in the box, from the compiled story — the shell never needs
// the story's knot names to route a link.
const _knotHashes = new Map();      // knotHash -> knotName
async function buildKnotHashes() {
  _knotHashes.clear();
  const names = knotNames();
  for (const name of names) {
    const h = await knotHash(name);
    if (h) _knotHashes.set(h, name);
  }
  state.knots = names.length;
}

// SHA-256 with the linking spec's salt and lengths (docs/fink-linking-spec).
// Kept in step with FinkNavigation deliberately: the same string must come
// out of both, or a link shared from the box would not open in the player.
const LINK_SALT = 'glitchcan-fink-v2';
async function knotHash(name) {
  try {
    const data = `${LINK_SALT}:knot:#${String(name).trim()}`;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 9);
  } catch { return null; }
}

// Knot names from the COMPILED story, never regexed out of the source.
function knotNames() {
  try {
    const root = story?.mainContentContainer;
    const out = [];
    for (const [name, child] of (root?.namedContent || new Map())) {
      if (typeof name === 'string' && !name.startsWith('_') && child) out.push(name);
    }
    return out;
  } catch { return []; }
}

function gotoKnotHash(hash) {
  const name = _knotHashes.get(hash);
  if (!name) {
    setStatus('that link points somewhere this story does not have');
    window.foaf?.bus?.publish('app.storyrunner.link-miss', {
      summary: `unknown knot hash ${hash}`, hash,
    });
    return false;
  }
  try {
    story.ChoosePathString(name);
    $('prose').textContent = '';
    state.prose = [];
    advance();
    return true;
  } catch (e) {
    setStatus('could not open that link: ' + e.message);
    return false;
  }
}

// ── the dream stack (spec §3.4) ────────────────────────────────────────
//
// Frames live HERE, in the box: a frame holds the outer story's saved ink
// position (`state.ToJson()`), which is the story's own business and must
// not cross to the shell. The shell holds the DEPTH — see its story.link
// handler for why that half cannot be ours to claim.
let _pendingRel;                   // undefined = plain replace
let _pendingEcho;                  // the chosen text, pending de-duplication
const _frames = [];                // {url, state}

// Follow a # FINK link: the shell AUTHORIZES the destination and the
// composition (policy + depth), the runner does the contained load. A
// refusal is shown, never silent.
async function followLink(absUrl) {
  const rel = (_pendingRel || '').toLowerCase();
  _pendingRel = undefined;
  const res = await storyRequest('story.link', { url: absUrl, rel });
  if (!res.ok) {
    // Depth-cap is a story-visible outcome, not a crash: the dream simply
    // refuses. Leave the reader where they are, with choices intact.
    setStatus(res.reason === 'depth-cap'
      ? 'The dream refuses: too deep.'
      : `link refused: ${res.reason}`);
    renderChoices();
    return;
  }
  if (rel === 'goshallower') { await surface(); return; }
  if (rel === 'godeeper') {
    // Push BEFORE loading: once the inner story compiles, `story` is the
    // inner one and the outer position is gone.
    _frames.push({ url: state.storyUrl, state: story.state.ToJson() });
  } else if (rel === 'oneway') {
    _frames.length = 0;            // the way back is burned
  }
  state.depth = res.depth ?? _frames.length;
  document.body.dataset.depth = String(state.depth);
  state.linkedTo = res.url;
  await loadStory(res.url);
}

// Surface one level: reload the outer document and restore its FULL ink
// state, so the outer story resumes mid-breath rather than restarting at
// a knot. No knot bookkeeping — LoadJson carries the position.
async function surface() {
  const frame = _frames.pop();
  if (!frame) return false;
  const res = await storyRequest('story.link', { url: frame.url, rel: 'surface' });
  state.depth = res.ok ? (res.depth ?? _frames.length) : _frames.length;
  document.body.dataset.depth = String(state.depth);
  setStatus('surfacing…');
  await loadStory(frame.url, frame.state);
  return true;
}

// Load (or replace with) a story at `url`, wholly inside the box: fetch,
// nested-box extract, compile, reset the beat surface, play.
// `restore` is a saved `state.ToJson()` — supplied when surfacing from a
// dream, so the outer story resumes exactly where it paused.
async function loadStory(url, restore = null) {
  state.storyUrl = url;
  setStatus('loading…');
  $('prose').textContent = '';
  $('choices').textContent = '';
  renderMedia(null);
  stopAudio();
  state.prose = []; state.choices = []; story = null;
  let src;
  try {
    src = await (await fetch(url)).text();
  } catch (e) {
    setStatus('could not load story: ' + e.message);
    return;
  }
  // Extract ink in a NESTED sandbox — the story's JS never touches this
  // runner. Boxes within boxes: shell → runner → compile box.
  const { ink } = await extractInBox(src);
  state.boxedCompile = true;
  if (!ink) { setStatus('no ink content found'); return; }
  try {
    story = new inkjs.Compiler(ink).Compile();
  } catch (e) {
    setStatus('compile error: ' + e.message);
    return;
  }
  state.ready = true;
  setStatus('');
  _statusItems = [];              // a new work brings its own status line
  renderStatusBar();
  // Seed the shared economy BEFORE the first beat, or a story that opens
  // by reading `diamonds` shows a zero the reader has already disproved.
  await seedEconomy();
  await buildKnotHashes();
  // Surfacing from a dream: restore the outer story's saved position so it
  // resumes mid-breath. Must happen after seeding and before the first
  // advance(), or the restored position is immediately overwritten.
  if (restore) {
    try { story.state.LoadJson(restore); state.restored = true; }
    catch (e) { setStatus('could not restore the outer story: ' + e.message); }
  }
  advance();
}

async function boot(config) {
  // The installation-wide media base: the outermost layer of the layered
  // chain. Handed over by the shell because a boxed story cannot read
  // fink-config.js. Absent standalone, which correctly leaves resolution
  // story-relative.
  state.mediaBase = config?.mediaBase || null;
  const url = config?.story
    || new URLSearchParams(location.search).get('story')
    || './demo.fink.js';
  await loadStory(url);
}

// Headless hook for the containment e2e — read-only state + the verbs a
// player has. A driver that reaches into internals rots.
window.__storyrunner = {
  get state() { return JSON.parse(JSON.stringify(state)); },
  choose,
  ready: () => state.ready,
  paused: () => !!_awaitingGame,
  depth: () => _frames.length,
  frames: () => _frames.map((f) => f.url.split('/').pop()),
  snapshot: () => snapshotPlaythrough(),
  gotoHash: (h) => gotoKnotHash(h),
  knotHashes: () => [..._knotHashes.entries()],
  // read a story VAR (for the parity tests — the economy is the point)
  varOf: (name) => { try { return story?.variablesState?.[name]; } catch { return undefined; } },
  spend: (name, value) => storyRequest('story.vars', { op: 'write', name, value }),
};

// Shell → runner events. Only the parent may speak, and only the
// vocabulary below: a story that ends up hosting a hostile frame cannot
// forge a resume, because anything not from `parent` is dropped.
window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return;
  const d = e.data;
  if (!d || d.type !== 'story.event') return;
  if (d.event === 'minigame.complete' && _awaitingGame) resumeAfterGame(d.detail);
  // Back/forward: the shell heard the history event and says where the URL
  // now points. Suppress our own re-report, or going back would immediately
  // rewrite the address bar to where we just came from.
  if (d.event === 'navigate') {
    const hash = d.detail?.parsed?.knotHash;
    if (hash) { _lastReported = 'suppressed'; gotoKnotHash(hash); }
  }
});

function applySkinTokens(tokens, skin) {
  if (!tokens) return;
  for (const [k, v] of Object.entries(tokens)) {
    try { document.documentElement.style.setProperty(k, v); } catch { /* bad token */ }
  }
  if (skin) { state.skin = skin; document.documentElement.dataset.skin = skin; }
}

// SAVE / RESTORE the playthrough (spec §5.5.4, #779). Closing the window
// used to lose the whole reading. Registering these two handlers IS the
// declaration; the shell holds the bytes in its own namespace and hands
// them back after the next init.
//
// What travels: where the reader is, and how they got there — the ink
// position (`state.ToJson()`), the story URL, the dream stack, and the
// story's own media/status declarations. NOT the prose already on screen:
// re-rendering the scrollback from a save would put words in the reader's
// past that they might not have read, and the ink state is the truth.
function snapshotPlaythrough() {
  if (!story || !state.ready) return null;              // nothing to keep yet
  // Decline while paused for a game: the ink is mid-beat and the game holds
  // state of its own, so a save here would restore into a story waiting for
  // a completion that will never arrive.
  if (_awaitingGame) return null;
  try {
    return {
      v: 1,
      storyUrl: state.storyUrl,
      ink: story.state.ToJson(),
      frames: _frames.map((f) => ({ url: f.url, state: f.state })),
      basehref: state.basehref,
      status: _statusItems,
    };
  } catch { return null; }
}

async function restorePlaythrough(snap) {
  if (!snap || snap.v !== 1 || !snap.storyUrl) return;
  _frames.length = 0;
  for (const f of (snap.frames || [])) _frames.push(f);
  state.depth = _frames.length;
  // loadStory applies the ink state after compiling and seeding, which is
  // the same path surfacing from a dream uses.
  await loadStory(snap.storyUrl, snap.ink);
  if (snap.basehref) state.basehref = snap.basehref;
  if (Array.isArray(snap.status) && snap.status.length) {
    _statusItems = snap.status;
    renderStatusBar();
  }
  state.resumedFromSave = true;
  window.foaf?.bus?.publish('app.storyrunner.resumed-save', {
    summary: `resumed ${snap.storyUrl.split('/').pop()} at depth ${_frames.length}`,
    depth: _frames.length,
  });
}

// Live inside foafos if present; run standalone otherwise (dev).
if (window.foaf?.onInit) {
  let booted = false;
  let savedSnap;
  // Hold the save; do not act on it yet. PRECEDENCE, and the ordering the
  // suite caught me getting wrong: an EXPLICIT `?story=` is someone asking
  // for a particular story and must beat a save of a different one —
  // "asking for a specific thing should beat a default". A save only wins
  // the DEFAULT boot, where it is the most recent thing the reader did.
  window.foaf.onRestore?.((snap) => { savedSnap = snap || undefined; });
  window.foaf.onSnapshot?.(snapshotPlaythrough);
  window.foaf.onInit((config) => {
    state.mediaBase = config?.mediaBase || null;
    applySkinTokens(config?.skinTokens, config?.skin);
    // Give a pending restore one tick to arrive before deciding.
    setTimeout(() => {
      if (booted) return;
      booted = true;
      const asked = config?.story || null;
      const savedUrl = savedSnap?.storyUrl || null;
      const sameStory = asked && savedUrl
        && savedUrl.split('/').pop() === String(asked).split('/').pop();
      if (savedSnap && (!asked || sameStory)) { restorePlaythrough(savedSnap); return; }
      // A DEEP LINK beats the default story: the URL says where, the
      // session says how far.
      boot(config).then(() => honourDeepLink());
    }, 140);
  });
  window.foaf.onAudio?.(applyAudioLevel);   // the dock's volume reaches our bed
  // SKINS PARITY: the shell hands over its resolved token values (it cannot
  // hand over a stylesheet across an opaque origin, and a second copy of
  // fink-skins.css would drift). Applied to our own root, so the box reads
  // as part of the same installation instead of a foreign panel.
  window.foaf.bus?.subscribe('ui.skin', (e) =>
    applySkinTokens(e?.data?.tokens, e?.data?.skin));
} else {
  boot({});
}
