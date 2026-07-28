// FINK Story Runner — the narrative runtime, BOXED.
//
// This runs inside a foafos app frame (opaque origin). It compiles and
// plays a .fink.js entirely in its own document and reaches the shell ONLY
// through the app protocol (foaf.storyRequest / foaf.bus). It has no
// `parent.FoafOS` and never writes host DOM. That is the "sandboxed all the
// way up" containment the live host-side player does not yet have.
//
// Extraction uses the frozen @foafos/backticks kernel (browser-safe entry).
// Compilation uses the real inkjs (global). NO hackparsing (CLAUDE.md).
//
// HONEST LIMIT (hardening follow-up): the story's JS runs via new Function
// in THIS frame, so a hostile story could tamper with this runner's own
// app-sdk — but it still cannot exceed the runner's grant or reach the
// host, because the frame is opaque-origin. Nesting the compile step in a
// throwaway iframe (backticks INSTALL_CAPTURE_SOURCE) closes that inner gap
// next; the OUTER containment (no host reach) holds now and is what the
// e2e proves.

import { createCapture, firstInkOf } from '../../../packages/backticks/src/index.js';

const $ = (id) => document.getElementById(id);
const state = {
  storyUrl: null, ready: false, prose: [], choices: [], bg: null,
  ended: false, requests: [],
};
let story = null;

function setStatus(msg) { $('status').textContent = msg; }

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
      storyRequest('story.link', { url: value });
      break;
    // IMAGE / VIDEO / AUDIO: media verbs, a later slab. Named, not silent.
    case 'IMAGE': case 'VIDEO': case 'AUDIO':
      setStatus(`(${key.toLowerCase()} pending: media verbs are a later slab)`);
      break;
  }
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

function advance() {
  if (!story) return;
  while (story.canContinue) {
    const text = story.Continue();
    (story.currentTags || []).forEach(handleTag);
    const trimmed = text.trim();
    if (trimmed) addProse(trimmed);
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

async function boot(config) {
  state.storyUrl = config?.story
    || new URLSearchParams(location.search).get('story')
    || './demo.fink.js';
  setStatus('loading…');
  let src;
  try {
    src = await (await fetch(state.storyUrl)).text();
  } catch (e) {
    setStatus('could not load story: ' + e.message);
    return;
  }
  // Extract ink with the frozen kernel: install the sigils, run the file's
  // JS in THIS frame (contained by the opaque origin), harvest the ink.
  const { globals, blocks } = createCapture();
  const names = Object.keys(globals);
  try {
    // eslint-disable-next-line no-new-func
    new Function(...names, src)(...names.map((n) => globals[n]));
  } catch {
    // window/document touches throw AFTER the sigils ran — blocks stand.
  }
  const ink = firstInkOf(blocks);
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
} else {
  boot({});
}
