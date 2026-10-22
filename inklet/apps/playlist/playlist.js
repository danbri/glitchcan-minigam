// Playlist — ONE queue of music for the whole installation.
//
// A single-instance app (manifest `instances: "single"`): stories and other
// apps do not open their own players, they add tracks here by an ACTION.
// The shell delivers actions through app-sdk's `foaf.onAction(action, args,
// from)`; `from.label` is who asked (a story name, say), shown beside the
// track. Actions: queue (args.track = a CHANNELS id), play, pause, next,
// open. Design: docs/foafos-apps-20261022.md, section 5 (singletons).
//
// It runs standalone too (open index.html directly): then it owns its own
// volume, and the "Add a track" control is the only way in.
//
// Content: the same tape library as the soundtrack app (../tv/channels.js).
// Its urls are relative to inklet/apps/tv/; this folder is at the same
// depth, so they resolve to the same files from here.

import { CHANNELS } from '../tv/channels.js';

const $ = (s) => document.querySelector(s);
const nowEl = $('#now');
const msgEl = $('#msg');
const listEl = $('#queue');
const emptyEl = $('#empty');
const playBtn = $('#play');
const nextBtn = $('#next');
const trackSel = $('#track');

const a11y = window.__mgA11y;
const foaf = window.foaf;
const KEY = 'playlist.queue';
const byId = new Map(CHANNELS.map((ch) => [ch.id, ch]));

let items = [];          // [{ id, name, from }]
let pos = -1;            // index of the current item, -1 = none
let hostVolume = null;   // null = nobody is governing us; we are on our own

const audio = new Audio();
audio.preload = 'none';

// ── persistence ────────────────────────────────────────────────────────
// localStorage is app-sdk's shim inside the shell (seeded by app.init) and
// the real one standalone. Either may throw: wrapped.
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ items, pos })); } catch (e) { /* not granted */ }
}
// Inside the shell the store snapshot arrives with app.init (registered
// below, before onAction); standalone the real localStorage is readable now.
let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* not granted, or bad JSON */ }
  if (!saved || !Array.isArray(saved.items)) return;
  const kept = saved.items
    .filter((it) => it && byId.has(it.id))
    .map((it) => ({ id: it.id, name: byId.get(it.id).name, from: String(it.from || 'someone') }));
  // Anything queued before the store arrived goes after the saved queue.
  const offset = kept.length;
  items = kept.concat(items);
  if (pos >= 0) pos += offset;
  else if (Number.isInteger(saved.pos) && saved.pos >= 0 && saved.pos < kept.length) pos = saved.pos;
  render();
}

// ── the list ───────────────────────────────────────────────────────────
function render() {
  listEl.replaceChildren();
  emptyEl.hidden = items.length > 0;
  items.forEach((it, i) => {
    const li = document.createElement('li');
    const current = i === pos;
    if (current) li.setAttribute('aria-current', 'true');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = (current ? '▶ ' : '') + it.name;
    const by = document.createElement('span');
    by.className = 'by';
    by.textContent = `added by ${it.from}`;
    const text = document.createElement('div');
    text.className = 'text';
    text.append(name, by);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove';
    rm.textContent = 'remove';
    rm.setAttribute('aria-label', `Remove ${it.name}`);
    rm.addEventListener('click', () => remove(i));
    const row = document.createElement('div');
    row.className = 'item';
    row.append(text, rm);
    li.append(row);
    listEl.appendChild(li);
  });
  const playing = !audio.paused && pos >= 0;
  playBtn.querySelector('.sym').textContent = playing ? '⏸' : '▶';
  playBtn.querySelector('.lbl').textContent = playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  nextBtn.disabled = items.length === 0;
}

function note(text) {
  msgEl.textContent = text;
  a11y?.announce(text);
}

// ── playback ───────────────────────────────────────────────────────────
function stop() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  pos = -1;
  nowEl.textContent = 'Nothing playing';
  save();
  render();
}

function playAt(i) {
  if (i < 0 || i >= items.length) { stop(); return; }
  pos = i;
  const ch = byId.get(items[i].id);
  audio.src = ch.url;
  // Apply the governed level BEFORE play, or a muted shell gets a burst.
  audio.volume = hostVolume === null ? 1 : hostVolume;
  nowEl.textContent = `Loading ${ch.name}`;
  save();
  render();
  audio.play().catch(() => {
    // Autoplay policy: a browser will not make noise before a gesture.
    if (pos === i) nowEl.textContent = `${ch.name} — press play`;
    render();
  });
}

function resume() {
  if (pos < 0 || pos >= items.length) { if (items.length) playAt(0); return; }
  if (!audio.getAttribute('src')) { playAt(pos); return; }
  audio.play().catch(() => { nowEl.textContent = `${items[pos].name} — press play`; });
}

function pause() {
  if (pos >= 0 && !audio.paused) audio.pause();
}

function next() {
  if (pos + 1 < items.length) playAt(pos + 1);
  else { stop(); note('End of the queue'); }
}

function remove(i) {
  if (i < 0 || i >= items.length) return;
  const [gone] = items.splice(i, 1);
  if (i === pos) {
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (i < items.length && wasPlaying) playAt(i);
    else { pos = -1; nowEl.textContent = 'Nothing playing'; }
  } else if (i < pos) {
    pos -= 1;
  }
  save();
  render();
  note(`Removed ${gone.name}`);
  // Keep focus in the list, not lost on <body> after the row went away.
  const rows = listEl.querySelectorAll('.remove');
  (rows[Math.min(i, rows.length - 1)] || trackSel).focus();
}

audio.addEventListener('playing', () => {
  if (pos < 0) return;
  const it = items[pos];
  nowEl.textContent = `▶ ${it.name}`;
  render();
  a11y?.announce(`Now playing ${it.name}`);
  foaf?.bus?.publish('app.playlist.now', {
    summary: `Playlist: ${it.name}`, track: it.id, name: it.name, from: it.from,
  });
});
audio.addEventListener('pause', () => {
  if (pos >= 0 && audio.getAttribute('src') && !audio.ended) nowEl.textContent = `⏸ ${items[pos].name}`;
  render();
});
audio.addEventListener('ended', next);
audio.addEventListener('error', () => {
  if (pos < 0 || !audio.getAttribute('src')) return;
  nowEl.textContent = `${items[pos].name} — could not load`;
  a11y?.announce(`${items[pos].name} failed to load`);
});

// ── actions ────────────────────────────────────────────────────────────
function handler(action, args, from) {
  const who = (from && from.label) ? String(from.label) : 'someone';
  switch (action) {
    case 'queue': {
      const id = args && args.track != null ? String(args.track) : '';
      const ch = byId.get(id);
      if (!ch) { note(`No track called ${id}`); return; }
      items.push({ id: ch.id, name: ch.name, from: who });
      const idle = pos < 0 || !audio.getAttribute('src') || audio.ended;
      save();
      render();
      note(`${ch.name} added by ${who}`);
      if (idle) playAt(items.length - 1);
      return;
    }
    case 'play': resume(); return;
    case 'pause': pause(); return;
    case 'next': next(); return;
    default: return;   // `open` and anything else: being shown is the answer
  }
}

// The shell's skin: it hands over its resolved token values (a stylesheet
// cannot cross the opaque origin), at init and on every change.
function applySkin(tokens) {
  for (const [k, v] of Object.entries(tokens || {})) {
    try { document.documentElement.style.setProperty(k, v); } catch (e) { /* bad token */ }
  }
}
foaf?.onInit?.((config) => applySkin(config?.skinTokens));
foaf?.bus?.subscribe?.('ui.skin', (e) => applySkin(e?.data?.tokens));

// Restore BEFORE taking actions. An action held by app-sdk is replayed the
// moment onAction is registered; if that ran first, its save() put the item in
// the store and the restore read it back as a second copy.
if (foaf && window.parent !== window) foaf.onInit(() => restore());
else restore();
foaf?.onAction?.(handler);

// ── the controls ───────────────────────────────────────────────────────
for (const ch of CHANNELS) {
  const opt = document.createElement('option');
  opt.value = ch.id;
  opt.textContent = ch.name;
  trackSel.appendChild(opt);
}
$('#add').addEventListener('submit', (e) => {
  e.preventDefault();
  handler('queue', { track: trackSel.value }, { appId: null, label: 'you' });
});
playBtn.addEventListener('click', () => {
  if (pos >= 0 && !audio.paused) pause(); else resume();
});
nextBtn.addEventListener('click', next);

// ── the shell's services ───────────────────────────────────────────────
// Answering the audio probe is what lets the shell's mute reach us.
foaf?.onAudio?.(({ level }) => {
  hostVolume = level;
  audio.volume = level;
});

render();

// Headless test hook (e2e).
window.__playlist = {
  queue: () => items.map(({ id, name, from }) => ({ id, name, from })),
  playing: () => pos,
  src: () => audio.currentSrc || audio.src,
  act: (action, args, from) => handler(action, args, from),
};
