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
  audio: null, audioLevel: 1, linkedTo: null,
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
    case 'STATUS':
      setStatus(value);
      break;
    case 'MINIGAME':
      storyRequest('story.launch', { game: value.split(/\s+/)[0] });
      break;
    case 'FINK':
      // A link to another story. Resolve it against THIS story's location,
      // then break the beat and ask the shell to authorize it (§story.link).
      _pendingLink = resolveStoryUrl(value);
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

// Audio, BOXED and GOVERNED. A looping bed for `# AUDIO: <file>`, played by
// an <audio> element in the runner's own frame, its volume driven by the
// shell's master level (foaf.onAudio) so the dock's mute reaches it. Synth
// audio (`# AUDIO: synth:*`) is the host's FinkFoley — not reachable from
// the box; named, not silent.
let _audioEl = null;
let _audioLevel = 1;

function playAudio(value) {
  const v = (value || '').trim();
  if (/^synth:/i.test(v)) { setStatus('(synth audio is host-only, not in the boxed runner)'); return; }
  if (!v) return;
  stopAudio();
  _audioEl = new Audio(v);
  _audioEl.loop = true;
  _audioEl.volume = _audioLevel;
  _audioEl.play().catch(() => { /* autoplay may wait for a gesture */ });
  state.audio = v;
}

function stopAudio() {
  if (_audioEl) { try { _audioEl.pause(); } catch (e) { /* gone */ } _audioEl = null; }
  state.audio = null;
}

// The shell's master volume/mute, applied to the runner's bed.
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
    el.src = m.src; el.controls = true; el.playsInline = true;
  } else {
    el = document.createElement('img');
    el.src = m.src; el.alt = '';
  }
  el.className = 'media-el';
  box.appendChild(el);
  stage.setAttribute('data-media-role', m.role);
  // accent: tap the thumbnail to blow it up to hero, tap again to shrink
  if (m.role === 'accent') {
    box.onclick = () => stage.setAttribute('data-media-role',
      stage.getAttribute('data-media-role') === 'accent' ? 'hero' : 'accent');
  }
  state.media = { kind: m.kind, src: m.src };
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

function advance() {
  if (!story) return;
  _beatMedia = undefined;                 // undefined ⇒ keep previous (sticky)
  _pendingLink = undefined;
  while (story.canContinue) {
    const text = story.Continue();
    (story.currentTags || []).forEach(handleTag);
    const trimmed = text.trim();
    if (trimmed) addProse(trimmed);
    if (_pendingLink !== undefined) break;   // a FINK link ends the beat
  }
  if (_beatMedia !== undefined) renderMedia(_beatMedia);
  if (_pendingLink !== undefined) {
    const url = _pendingLink; _pendingLink = undefined;
    followLink(url);
    return;                                  // the linked story replaces this one
  }
  renderChoices();
  if (!story.canContinue && story.currentChoices.length === 0) {
    state.ended = true;
    setStatus('— THE END —');
    window.foaf?.bus?.publish('app.storyrunner.ended', { summary: 'story ended' });
  }
}

function choose(i) {
  if (!story || i < 0 || i >= story.currentChoices.length) return;
  addProse(story.currentChoices[i].text, 'player');
  story.ChooseChoiceIndex(i);
  advance();
}

// Follow a # FINK link: the shell AUTHORIZES the destination (policy), the
// runner does the contained load. A refusal is shown, never silent.
async function followLink(absUrl) {
  const res = await storyRequest('story.link', { url: absUrl });
  if (res.ok && res.url) { state.linkedTo = res.url; await loadStory(res.url); }
  else setStatus(`link refused: ${res.reason}`);
}

// Load (or replace with) a story at `url`, wholly inside the box: fetch,
// nested-box extract, compile, reset the beat surface, play.
async function loadStory(url) {
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
  advance();
}

async function boot(config) {
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
};

// Live inside foafos if present; run standalone otherwise (dev).
if (window.foaf?.onInit) {
  window.foaf.onInit((config) => boot(config));
  window.foaf.onAudio?.(applyAudioLevel);   // the dock's volume reaches our bed
} else {
  boot({});
}
