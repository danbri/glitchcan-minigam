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
// A PEER runner is this same page, nested inside another runner, playing the
// story beside it. It is a level-2 session: it plays, but it does not watch a
// subtree and it does not announce sessions (see the outer runner's allow-list).
const IS_PEER = new URLSearchParams(location.search).get('peer') === '1';
const state = {
  storyUrl: null, ready: false, prose: [], choices: [], bg: null,
  ended: false, requests: [], boxedCompile: false,
  media: null, mediaRole: null, mediaSpec: null,
  audio: null, audioPlaying: false, audioLevel: 1, linkedTo: null,
  pausedFor: null, lastGame: null, economy: null,
  depth: 0, restored: false,
  sessionId: null, sessionLabel: null,
  observing: false, observed: [], peer: null, isPeer: false,
  loads: 0, fetches: 0, cacheHits: 0,
  // THE ORDERED SET THIS SESSION HAS PARSED. One entry after a plain load,
  // one more per merged chunk — this is the "pragmatic set" the inkjs engine
  // runs over, and the reason a session is a composition rather than a file.
  sources: [], merges: [], mergedInk: 0,
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
  // THE CHOICES ARE THE ONLY THING A READER CAN ACT ON, so they must be
  // ON SCREEN. addProse() scrolls to the end, but that runs BEFORE the
  // choices exist, so a long hand (7 episodes) rendered its last button
  // past the fold — measured at 390x740: "Skydock Scuttlebutt" spanned
  // 733-777px in a 740px viewport, and elementFromPoint returned the
  // Subtree bar. A tap on it did nothing, which is not a UI blemish, it
  // is a story you cannot enter. Scroll after the hand is dealt.
  if (ul.lastElementChild) keepChoicesInView();
}

// Keep the hand on screen — including AFTER the beat's picture arrives.
// Measured at 390x740: scrolling once on the next frame did nothing,
// because at that moment the media had no height yet; the image then
// decoded, the column grew by exactly the 85px that had been cut off,
// and the last choice sat under the fixed Subtree bar for good. So the
// scroll is re-run when the media settles, and again on a viewport
// change (a phone toolbar sliding away is the same problem).
function keepChoicesInView() {
  const st = $('stage');
  const toEnd = () => { st.scrollTop = st.scrollHeight; };
  requestAnimationFrame(toEnd);
  for (const el of $('media').querySelectorAll('img, video, iframe')) {
    el.addEventListener('load', () => requestAnimationFrame(toEnd), { once: true });
    if (el.tagName === 'VIDEO') {
      el.addEventListener('loadedmetadata', () => requestAnimationFrame(toEnd), { once: true });
    }
  }
  if (window.visualViewport && !keepChoicesInView._vv) {
    keepChoicesInView._vv = true;
    window.visualViewport.addEventListener('resize', () => {
      if ($('choices').lastElementChild) requestAnimationFrame(toEnd);
    });
  }
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
      // way back, goShallower surfaces early, oneWay burns the stack, merge
      // grows this engine without a frame. Bare FINK still replaces, which is
      // the back-compatible default.
      _pendingRel = value.trim();
      break;
    case 'ENTRY':
      // Where to go once a MERGE lands — the knot in the merged chunk to enter.
      //
      // It is a tag of its own rather than a URL fragment, and that is not a
      // style choice: `# FINK: annex.fink.js#annex` is TWO TAGS to ink, because
      // `#` starts a tag in ink's own syntax. The fragment never reaches the
      // runner. Measured the hard way — the merge landed and the reader read the
      // refusal branch, because the entry name arrived empty.
      //
      // ENTRY is not a front door. No reader can arrive at it; it is the host
      // story saying which of the merged knots the reader walks into now.
      _pendingEntry = value.trim();
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
  // SAY WHICH PLAYTHROUGH IS ASKING. Without this the shell has to guess, and
  // its only sensible guess is "the innermost session" — which was right for a
  // dream stack and wrong the moment a peer sat on top of it: the reader's own
  // spend was checked against the PEER's dream depth and refused. A request
  // that already names a session keeps it; that is the peer-forwarding path,
  // where the name belongs to the peer and not to us.
  if (state.sessionId && detail && detail.session === undefined) {
    detail = { ...detail, session: state.sessionId };
  }
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
  // annotation belongs to the link it travels with. Same for ENTRY.
  _pendingRel = undefined;
  _pendingEntry = undefined;
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
    // A PEER'S END IS NOT THE END — it is the way back, and the only one the
    // reader ever needs. Say so upward and let our mediator uncover the story
    // we were standing beside. "— THE END —" here would be a lie: the reader
    // has a story still running underneath.
    if (IS_PEER) {
      state.ended = false;
      try { parent.postMessage({ type: 'session.done' }, '*'); } catch { /* no mediator */ }
      return;
    }
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
  // FOCUS FOLLOWS THE READING. Without this a reader who takes a choice is
  // dropped back at the document body and must walk the whole page again for
  // every beat — measured by the aria audit, which is why it is a named
  // defect rather than a nicety. Focus lands on the PROSE, not on the first
  // choice: a screen reader then starts at the new text and reaches the
  // choices in DOM order, so nothing is skipped. Only after a beat the READER
  // caused — on first paint the body is a fair place for the keyboard to be.
  focusTheReading();
}

// The beat's new text is where a non-visual reader wants to be. `preventScroll`
// because the stage manages its own scrolling and a focus jump would fight it.
function focusTheReading() {
  const prose = $('prose');
  if (!prose) return;
  try { prose.focus({ preventScroll: true }); } catch { prose.focus(); }
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
let _pendingEntry;                 // # ENTRY: the knot to walk into after a merge
let _pendingEcho;                  // the chosen text, pending de-duplication
const _frames = [];                // {url, state}

// Follow a # FINK link: the shell AUTHORIZES the destination and the
// composition (policy + depth), the runner does the contained load. A
// refusal is shown, never silent.
async function followLink(absUrl) {
  const rel = (_pendingRel || '').toLowerCase();
  const entry = (_pendingEntry || '').trim();
  _pendingRel = undefined;
  _pendingEntry = undefined;
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
  if (rel === 'peer') { await openPeer(res.url); return; }
  // MERGE never loads a story: it grows the one already running. The shell has
  // already authorized this destination under `rel: 'merge'` in the request
  // above, so the granted URL is handed straight on — asking twice would be a
  // second same-origin check and a second entry in the capability ledger for
  // one act.
  if (rel === 'merge') { await mergeStory(res.url, entry); return; }
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
  await loadStory(res.url, null, rel || 'replace');
}

// ── MERGE (level 2: composition WITHOUT a frame) ───────────────────────────
//
// MERGE IS NOT PEERING (owner, 2026-07-30). A peer has a front door of its own,
// so it gets a frame. A merge chunk has NONE — it is a room of one city, an
// episode of one work, meaningless to arrive at alone. So it makes no frame, no
// origin, no session and no shell: it joins the engine already running.
//
//     fetch it → append it to the ordered set this session has parsed
//     → recompile the UNION with the real compiler → restore the reader's
//     state into it → carry on
//
// Publication and linkage, not window management. An episodal game must not
// become a tree of sandboxed widget frames.
//
// EVERY STEP OF THAT WAS MEASURED FIRST (offline, real inkjs, 2026-07-30):
// `state.LoadJson` into a recompiled superset loads; variables keep their
// values; the reader is still at the same beat with the same choice on offer;
// and a merged-in knot reads AND writes the live state. Visit counts read 0,
// which is ink's own behaviour and not a merge fault.
//
// COLLISIONS: the same measurement found that two files both declaring
// `VAR lamp`, or both defining `=== hall ===`, are a COMPILE ERROR. That is
// the good failure — nothing is silently overwritten — and it is why the union
// is compiled into a LOCAL before anything is assigned. A refused merge leaves
// the reader exactly where they were, reading the story they already had.
//
// THE ARBITER IS THE REAL COMPILER, and deliberately so. The obvious
// alternative — auto-renaming each chunk's knots and vars behind a namespace —
// means rewriting ink identifiers with pattern matching, across diverts,
// tunnels, threads, logic and prose. That is the hackparsing this repo has a
// rule about, and `inklet/demos/fink-namespace-preprocessor.js` is what it
// looks like when attempted: a self-described strawman, regex-based, variables
// only, blind to knot names. So we do not guess. We hand the union to
// `inkjs.Compiler` and report ITS words to the author.
//
// The reader sees nothing of any of this: no frame, no notice, no control. More
// story, more choices — the presentation invariant.
//
// `# ENTRY:` names the knot to walk into once the merge lands. It is a tag of
// its own and NOT a URL fragment, because `#` starts a tag in ink's own syntax:
// `# FINK: annex.fink.js#annex` is two tags to the compiler, and the fragment
// never arrives. Without an ENTRY the chunk is simply added and the beat carries
// on. An ENTRY is not a front door — no reader can arrive at it; it is the host
// story saying where in the merged content the reader now is.
async function mergeStory(absUrl, entry = '') {
  // AUTHORIZATION STILL APPLIES. A merge fetches content, so the shell decides
  // whether this destination is allowed — same-origin under policy v0, and the
  // trust graph later. What the shell must NOT do is treat it as a new
  // playthrough: `rel: 'merge'` leaves the session and the dream depth alone.
  const res = await storyRequest('story.link', { url: absUrl, rel: 'merge' });
  if (!res.ok) { setStatus(`merge refused: ${res.reason}`); advance(); return false; }

  let ink;
  try { ink = await inkFor(res.url); }
  catch (e) { setStatus('could not load the chunk: ' + e.message); advance(); return false; }
  if (!ink) { setStatus('nothing to merge: no ink content'); advance(); return false; }

  const url = bare(res.url);
  if (state.sources.some((s) => s.url === url)) {
    // Already in the set. Merging twice would redeclare every one of its knots
    // against itself, so the compile would fail and the author would be told
    // their own chunk collides with their own chunk. Say the true thing.
    setStatus('');
    state.merges.push({ url, ok: true, already: true });
    advance();
    return true;
  }

  // COMPILE INTO A LOCAL. `story` is the reader's live playthrough and must not
  // be touched until the union is known to compile.
  const saved = story.state.ToJson();
  const sources = [...state.sources, { url, ink }];
  let merged;
  // `join('\n')` and NOT '\\n' — see the sandbox incident in CLAUDE.md. A
  // literal backslash-n here would fuse the last line of one file to the first
  // line of the next and the failure would look like an authoring mistake.
  const compiler = new inkjs.Compiler(sources.map((s) => s.ink).join('\n'));
  try {
    merged = compiler.Compile();
  } catch (e) {
    // The compiler's OWN words, because it is the only thing here that
    // understands ink. A duplicate `VAR` or a duplicate knot name lands here.
    //
    // The DETAIL is on the compiler instance, not on the exception: what is
    // thrown says only "Compilation failed." while `compiler.errors` carries
    // "found declaration variable 'diamonds' that was already declared
    // (line 16)" — the line and the name an author needs. Measured: the first
    // version reported the useless string, which is why the instance is kept.
    const why = (compiler.errors && compiler.errors.length
      ? String(compiler.errors[0])
      : String(e.message || 'compile error')).split('\n')[0];
    setStatus(`this chunk does not fit: ${why}`);
    state.merges.push({ url, ok: false, reason: why });
    window.foaf?.bus?.publish('app.storyrunner.merge', {
      summary: `merge refused — ${why}`, phase: 'fault', url,
    });
    advance();                     // the reader's own story is untouched
    return false;
  }
  try {
    merged.state.LoadJson(saved);
  } catch (e) {
    setStatus('could not carry your place into the merged story: ' + e.message);
    state.merges.push({ url, ok: false, reason: 'restore-failed' });
    advance();
    return false;
  }

  story = merged;
  state.sources = sources;
  state.merges.push({ url, ok: true });
  state.mergedInk = sources.reduce((n, s) => n + s.ink.length, 0);
  await buildKnotHashes();         // the union has knots the old hashes lack
  window.foaf?.bus?.publish('app.storyrunner.merge', {
    summary: `merged ${url.split('/').pop()} — ${sources.length} sources in this session`,
    phase: 'loading', url, sources: sources.length,
  });
  setStatus('');

  // `# ENTRY:` says where to go now. `ChoosePathString` resets the callstack, so
  // it discards the beat the host story had queued behind the merge — which is
  // what makes the host's fallback branch a REFUSAL path rather than something
  // the reader always reads. An unknown name is an authoring mistake worth
  // showing rather than swallowing.
  if (entry) {
    try { story.ChoosePathString(entry); }
    catch (e) { setStatus(`merged, but "${entry}" is not a knot in it`); }
  }
  advance();
  return true;
}

// ── PEERING (level 2, the layer model's sibling relation) ─────────────────
//
// A dream is INSIDE its outer story and surfaces back into it. A peer stands
// BESIDE it: both live, neither containing the other. That is a different
// thing from a link, and it needs a second story actually running — which one
// frame with one inkjs Story cannot do.
//
// So a peer is a NESTED RUNNER: this same page, in its own sandboxed frame at
// its own opaque origin. Three things fall out of that, and they are the
// reasons for doing it this way rather than juggling two Story objects here:
//
//   · The peer cannot touch this runner's document, prose or ink. Two stories
//     in one frame would be isolated only by our good behaviour; two frames
//     are isolated by the browser.
//   · The mediation chain stops being a metaphor. The peer asks US, we ask
//     foafos, foafos acts — session → StoryRunner → foafos broker → effect,
//     exactly as written down.
//   · It is the same code. A peer plays media, audio, minigames and dreams
//     because it IS a runner, not a reduced copy of one that drifts.
//
// We are its shell, so we owe it the small part of the app protocol it needs:
// an `app.init` in answer to its `app.hello`, and forwarding for its verbs. We
// tag every forwarded verb with the peer's OWN session id, so the shell parents
// what the peer opens under the peer — see the shell's `story.launch`, which
// checks that name is one of our own sessions before it trusts it.
//
// ONE peer at a time, deliberately — and now for a stronger reason than layout.
// A PEER MUST NOT LOOK LIKE ANYTHING (owner, 2026-07-30). Reading into a peer
// is just more story and more choices; it must not throw the reader out of the
// illusion and into window management. So a peer takes the READING SURFACE, the
// way a dream already does — no title bar, no ✕, no split pane — and the reader
// comes back when the peer's story ends. Two panes was the wrong answer twice
// over: it announced the mechanism to the reader, and it does not survive the
// voice interface being built, where there is no second pane to look at. That
// is a rule about COMPOSITION INSIDE A READING, not about the platform: foafos
// is a windowing shell and keeps its windows, switcher and drawer.
// What peering IS remains invisible and structural: the reader's own story is
// not destroyed, and they return to its live beat rather than a restart.
// The mechanism shows only where mechanisms belong — the Subtree panel, the
// shell's own app tree and the capability ledger.
const PEER_CAP = 1;
let _peer = null;      // { url, session, frame, el }

async function openPeer(absUrl) {
  if (_peer) {                    // the second peer replaces the first
    await closePeer();
  }
  // The peer's session is a SIBLING under our node, not a child of ours: the
  // shell decides that from `rel`, and it is the shell that says whether a
  // peer is allowed at all.
  const res = await storyRequest('story.session', { op: 'start', url: absUrl, rel: 'peer' });
  // RESUME THE BEAT, refused or not. Every other link REPLACES the story, so
  // breaking out of the Continue loop and stopping there is correct for them.
  // A peer replaces nothing: the reader's own story is still mid-beat, and
  // leaving it there is what "the primary story stopped being playable, 0
  // choices" looked like — the story had said its line about the chart and
  // then had nowhere to go.
  if (!res.ok) { setStatus(`peer refused: ${res.reason}`); advance(); return; }

  const wrap = document.createElement('section');
  wrap.className = 'peer';
  wrap.id = 'peer';

  // Opaque origin: `allow-scripts` WITHOUT `allow-same-origin`. The peer gets
  // no handle on this document, which is the whole point of the second frame.
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = res.label || 'A story beside this one';
  frame.src = `./index.html?peer=1&story=${encodeURIComponent(absUrl)}`;
  wrap.append(frame);
  document.body.appendChild(wrap);
  document.body.dataset.peer = '1';

  // THE OUTER STAGE GOES INERT while the peer reads. Not decoration: `#prose`
  // is `aria-live="polite"`, so without this a screen reader or a voice
  // interface is read TWO stories interleaved, and a keyboard reader can tab
  // into choices that are not on screen. Set before `advance()`, so the beat
  // prepared below is not announced over the peer's opening line.
  stageInert(true);

  _peer = { url: absUrl, session: res.id, frame, el: wrap };
  state.peer = { url: absUrl, session: res.id, label: res.label || null };
  setStatus('');
  // The reader's own story advances one beat and WAITS there, hidden. Nothing
  // is lost: on return that prepared beat is what they read next, which is what
  // leaving a book face-down and picking it up feels like.
  advance();
}

// Hide/expose the reader's own reading surface. The peer overlays it, so the
// stage must stop being reachable — by assistive tech, by the tab key, by a
// stray click — rather than merely being covered.
function stageInert(on) {
  const stage = $('stage');
  if (!stage) return;
  if (on) { stage.setAttribute('aria-hidden', 'true'); stage.inert = true; }
  else { stage.removeAttribute('aria-hidden'); stage.inert = false; }
}

// `why` is 'ended' when the peer's own story finished — the ordinary way back,
// and the only one a reader ever sees. Anything else is a debug/advanced route
// (the `__storyrunner` hook, the shell's own app tree), which is why the reader
// is given no control of their own.
async function closePeer(why = 'closed') {
  if (!_peer) return false;
  const { session, el } = _peer;
  _peer = null;
  state.peer = null;
  el.remove();
  delete document.body.dataset.peer;
  stageInert(false);
  // NO RELOAD, and this is the point of peering rather than dreaming. The
  // reader's own story never stopped being this document's live `story`: its
  // prose is still in the DOM and its choices are still bound. A dream has to
  // reload and `LoadJson` its way back; a peer just stops covering the page.
  // A short, polite cue on the status line — the same line a dream surfaces
  // with — because a reader who cannot see the change is owed the words.
  if (why === 'ended') setStatus('back to your own story');
  // End the SESSION, by name: a peer is not the innermost session, so an
  // unnamed end would close the wrong one.
  await storyRequest('story.session', { op: 'end', id: session });
  return true;
}

// We are the peer's mediator. Everything below is the small part of the shell's
// app protocol a nested runner needs — and nothing more, because anything we
// hand it beyond this it did not ask for and cannot be held to.
window.addEventListener('message', (e) => {
  if (!_peer || e.source !== _peer.frame.contentWindow) return;
  const d = e.data;
  if (!d || typeof d.type !== 'string') return;
  const down = (msg) => {
    try { _peer.frame.contentWindow?.postMessage(msg, '*'); } catch (err) { /* gone */ }
  };
  if (d.type === 'app.hello') {
    // The peer inherits our media base and our skin, because it is part of the
    // same installation and the same reading. It does NOT inherit a store: a
    // peer keeps nothing of its own, which matches "ephemeral unless sealed".
    down({
      type: 'app.init', appId: 'story-session', capabilities: [],
      store: {},
      config: { story: _peer.url, mediaBase: state.mediaBase, skin: state.skin },
    });
    return;
  }
  // THE WAY BACK. The peer's story reached its end, so it stops covering the
  // reader's own — the peer equivalent of a dream surfacing when the inner
  // story ends. No capability is involved: a session is saying it is finished,
  // which is the one thing it is always entitled to say about itself.
  if (d.type === 'session.done') { closePeer('ended'); return; }
  if (d.type === 'story.request') {
    const verb = String(d.verb || '');
    // AN ALLOW-LIST, and the two refusals are the interesting part.
    //
    // `story.session` — a peer must not announce sessions. Its own session is
    // the one WE opened for it, and a plain link from inside it would arrive at
    // the shell as "replace", which ends every session this runner has: the
    // reader's own story would vanish because the story beside it followed a
    // link. Refusing means the peer navigates inside its own node.
    // `story.observe` — watching the subtree is level 1's job, and the peer is
    // level 2. A session that could watch its siblings is not a session.
    const PEER_VERBS = ['story.link', 'story.navigate', 'story.vars',
                        'story.audio', 'story.launch'];
    if (!PEER_VERBS.includes(verb)) {
      down({ type: 'story.result', rid: d.rid, ok: false, reason: 'not-for-sessions' });
      return;
    }
    // FORWARD, tagged with whose session this is. We add the tag; we cannot
    // forge one, because the shell only honours names it already knows to be
    // ours.
    const detail = { ...(d.detail || {}), session: _peer.session };
    storyRequest(verb, detail).then((res) => {
      const { type, rid, ...rest } = res || {};
      down({ type: 'story.result', rid: d.rid, ...rest });
    });
    return;
  }
  // A peer's bus publishes and its snapshot are not forwarded: the first would
  // let it speak in our name, and the second belongs to a session that keeps
  // nothing. Both are refusals by silence, which the SDK reads as a timeout.
});

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
  await loadStory(frame.url, frame.state, 'surface');
  return true;
}

// Bounded, and bounded by COUNT rather than bytes: a handful of ink files is
// kilobytes, and a story someone reads through is a handful of files. Oldest
// out first — a dream stack walks back the way it came, so the entries a reader
// is about to need are the ones added most recently.
const INK_CACHE_CAP = 6;
const _inkCache = new Map();
function rememberInk(url, ink) {
  _inkCache.delete(url);                    // re-insert to refresh its age
  _inkCache.set(url, ink);
  while (_inkCache.size > INK_CACHE_CAP) {
    _inkCache.delete(_inkCache.keys().next().value);
  }
}

// A url without its fragment. The fragment names a KNOT, not a file, so it
// must not reach `fetch` as part of the identity of the bytes — otherwise
// `annex.fink.js#annex` and `annex.fink.js#attic` are two cache entries and
// two fetches of one file.
const bare = (u) => { try { const x = new URL(u); x.hash = ''; return x.href; } catch { return u; } };

// GET THE INK FOR A URL — cache, then fetch, then nested-box extract. Factored
// out of `loadStory` because MERGE needs exactly this and nothing else: it does
// not reset the surface, does not announce a session, and does not touch depth.
// THE SESSION'S CACHE (the layer model's "inkjs reality" note). A dream
// surfaces back into the story it came from, and a reader who links away and
// returns is a re-entry: without a cache each of those pays for a fetch and a
// whole nested-box extraction again. What is kept is the EXTRACTED INK — the
// strings the compile box harvested — not a compiled story, because the
// vendored inkjs does not promise a story survives a serialise/restore round
// trip and NO HACKPARSING means the compiler stays the only way in. So a hit
// still compiles, with the real compiler, from bytes we already have.
//
// It belongs to the SESSION, not the shell: it lives in this frame and dies
// with it. The shell never sees a story's source, which is the containment
// working and the reason this cache cannot live anywhere else.
async function inkFor(url) {
  const key = bare(url);
  const hit = _inkCache.get(key);
  if (hit) { state.cacheHits += 1; state.boxedCompile = true; return hit; }
  state.fetches += 1;
  const src = await (await fetch(key)).text();
  // Extract ink in a NESTED sandbox — the story's JS never touches this
  // runner. Boxes within boxes: shell → runner → compile box.
  const { ink } = await extractInBox(src);
  state.boxedCompile = true;
  if (ink) rememberInk(key, ink);
  return ink;
}

// Load (or replace with) a story at `url`, wholly inside the box: fetch,
// nested-box extract, compile, reset the beat surface, play.
// `restore` is a saved `state.ToJson()` — supplied when surfacing from a
// dream, so the outer story resumes exactly where it paused.
// `rel` names the relation to the playthrough being LEFT: 'replace' (a plain
// link, or the first load), 'godeeper' (a dream), 'oneway', 'surface'. The
// shell needs it to decide whether the outer session lives on, so it travels
// with the session announcement rather than being guessed from the depth.
async function loadStory(url, restore = null, rel = 'replace') {
  state.storyUrl = url;
  setStatus('loading…');
  $('prose').textContent = '';
  $('choices').textContent = '';
  renderMedia(null);
  stopAudio();
  state.prose = []; state.choices = []; story = null;
  state.loads += 1;
  // THE SESSION'S CACHE (the layer model's "inkjs reality" note). A dream
  // surfaces back into the story it came from, and a reader who links away and
  // returns is a re-entry: without a cache each of those pays for a fetch and a
  // whole nested-box extraction again. What is kept is the EXTRACTED INK — the
  // strings the compile box harvested — not a compiled story, because the
  // vendored inkjs does not promise a story survives a serialise/restore round
  // trip and NO HACKPARSING means the compiler stays the only way in. So a hit
  // still compiles, with the real compiler, from bytes we already have.
  //
  // It belongs to the SESSION, not the shell: it lives in this frame and dies
  // with it. The shell never sees a story's source, which is the containment
  // working and the reason this cache cannot live anywhere else.
  let ink;
  try { ink = await inkFor(url); }
  catch (e) { setStatus('could not load story: ' + e.message); return; }
  if (!ink) { setStatus('no ink content found'); return; }
  // A PLAIN LOAD RESETS THE COMPOSITION. Whatever this session had merged
  // belonged to the story being left; the new one starts as one source and
  // grows its own set. (A dream surfacing reloads the outer story, so its
  // merges are lost with it — recorded in the doc, not pretended away.)
  state.sources = [{ url: bare(url), ink }];
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
  // THIS PLAYTHROUGH IS A THING (level 2 of the layer model). We cannot make
  // a node — we ask the shell for one and keep the token it hands back.
  // Everything this playthrough opens parents under it, so the ask happens
  // before any of it: before the economy read, before the first beat.
  {
    const session = await storyRequest('story.session', { op: 'start', url, rel });
    state.sessionId = session.ok ? session.id : null;
    state.sessionLabel = session.ok ? (session.label || null) : null;
    // NAME THE STORY REGION. The heading is what a screen-reader user jumps to
    // and what an agent reads to know where it is, so it carries the SHELL's
    // label — computed from the URL the shell authorized — rather than
    // anything the story said about itself.
    const h = $('story-title');
    if (h) h.textContent = state.sessionLabel || 'Story';
  }
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
  session: () => state.sessionId,
  peer: () => state.peer,
  cache: () => ({ loads: state.loads, fetches: state.fetches,
                  hits: state.cacheHits, size: _inkCache.size }),
  // The composition: which files this ONE engine is running over, and what
  // happened to each merge attempt.
  sources: () => state.sources.map((s) => s.url.split('/').pop()),
  merges: () => state.merges.map((m) => ({ ...m, url: m.url.split('/').pop() })),
  knotCount: () => { try { return [...story.mainContentContainer.namedContent.keys()].length; } catch { return 0; } },
  closePeer: () => closePeer(),
  observed: () => state.observed.map((o) => o.line),
  observing: () => state.observing,
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
  if (d.event === 'observe') noteObservation(d.detail);
});

// OBSERVABILITY, LEVEL 1. The shell forwards what happens in OUR subtree and
// nothing else (it computes that filter; see its story.observe handler). Our
// job is the part the shell cannot do: reading it as story events rather than
// as traffic — a session starting, a dream deepening, a game coming back.
//
// EPHEMERAL BY DEFAULT, and this is not a comment about the future: the log is
// a bounded array in this frame. Nothing writes it to storage, and it dies with
// the frame. Persisting it would mean sealing it, and that needs consent.
const OBSERVE_CAP = 40;

function noteObservation(o) {
  if (!o || !o.kind) return;
  const line =
      o.kind === 'spawn'   ? `opened ${o.label || o.appId} (depth ${o.depth})`
    : o.kind === 'close'   ? `closed ${o.count} node${o.count === 1 ? '' : 's'}`
    : o.kind === 'session' ? (o.dreamOf ? 'session began inside another' : `session began (${o.rel})`)
    : o.kind === 'depth'   ? (o.depth ? `dream depth ${o.depth}` : 'surfaced')
    // Composition belongs in the debug view and NOWHERE else — the reader of a
    // merged story sees more story, never a mechanism. This panel is the
    // advanced view the presentation invariant allows.
    : o.kind === 'compose' ? `merged ${o.file || 'content'} into the story`
    : o.kind === 'game'    ? `${o.game || 'game'} finished`
                             + (o.score != null ? ` · score ${o.score}` : '')
                             + (o.success === false ? ' · lost' : '')
    : o.kind;
  state.observed.push({ kind: o.kind, line });
  if (state.observed.length > OBSERVE_CAP) state.observed.shift();
  renderObserved();
}

function renderObserved() {
  const el = $('watch');
  if (!el) return;
  el.textContent = '';
  for (const o of state.observed.slice(-8).reverse()) {
    const li = document.createElement('li');
    li.textContent = o.line;                 // TEXT, never innerHTML
    el.appendChild(li);
  }
}

async function startObserving() {
  const res = await storyRequest('story.observe', { op: 'start' });
  state.observing = !!res.ok;
  if (!res.ok) setStatus(`cannot watch: ${res.reason}`);
  return res;
}

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
    // Ask to watch our own subtree BEFORE the story starts, so the first
    // session is in the record rather than the second. A refusal is not fatal:
    // a runner without `story:observe` plays exactly as before, with no log.
    if (!IS_PEER) startObserving();     // level 1 watches; level 2 plays
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
