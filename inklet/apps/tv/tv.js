// Channels — the tape library as a set of stations.
//
// A TV app because it needs to be one: a channel list, a transport, a
// now-playing line, and a volume it does NOT own. It exists to prove the
// audio service is real — the shell's mute has to silence this from
// outside, and this app has to answer the probe to let it.
//
// It runs standalone too (open index.html directly): then it owns its own
// volume, because nobody else is offering.
//
// Content: ROBBIN's tape library (magpie/robbin/audio/, see its README).
// The list is baked because a static host has no directory listing —
// regenerate with `node inklet/apps/tv/build-channels.mjs` when the
// library changes.

import { CHANNELS } from './channels.js';

const $ = (s) => document.querySelector(s);
const listEl = $('#channels');
const nowEl = $('#now');
const playBtn = $('#play');

const sdk = window.MinigameSDK ? new MinigameSDK() : null;
const a11y = window.__mgA11y;

let index = 0;
let audio = null;
let hostVolume = null;   // null = nobody is governing us; we are on our own

// ── the list ───────────────────────────────────────────────────────────
CHANNELS.forEach((ch, i) => {
  const li = document.createElement('li');
  li.id = `ch-${i}`;
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', String(i === 0));
  li.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span>
    <span class="name"></span><span class="tag">${ch.tag}</span>`;
  li.querySelector('.name').textContent = ch.name;
  li.addEventListener('click', () => { select(i); tune(); });
  listEl.appendChild(li);
});
listEl.setAttribute('aria-activedescendant', 'ch-0');

function select(i) {
  index = (i + CHANNELS.length) % CHANNELS.length;
  [...listEl.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === index)));
  listEl.setAttribute('aria-activedescendant', `ch-${index}`);
  listEl.children[index].scrollIntoView({ block: 'nearest' });
}

// ── tuning in ──────────────────────────────────────────────────────────
function tune() {
  const ch = CHANNELS[index];
  if (audio) { audio.pause(); audio.remove(); }
  audio = new Audio(ch.url);
  audio.loop = true;
  // Apply the governed level BEFORE play, or a muted shell gets a burst
  // of sound on every channel change.
  audio.volume = hostVolume === null ? 1 : hostVolume;
  audio.addEventListener('error', () => {
    nowEl.textContent = `${ch.name} — could not load`;
    a11y?.announce(`${ch.name} failed to load`);
  });
  audio.play().then(() => {
    nowEl.textContent = `▶ ${ch.name}`;
    playBtn.textContent = '⏸';
    [...listEl.children].forEach((li, n) => li.classList.toggle('playing', n === index));
    a11y?.announce(`Now playing ${ch.name}`);
    sdk?.progress({ channel: ch.id, name: ch.name });
  }).catch(() => {
    // Autoplay policy: a browser will not make noise before a gesture.
    nowEl.textContent = `${ch.name} — press play`;
    playBtn.textContent = '▶';
  });
}

function toggle() {
  if (!audio) { tune(); return; }
  if (audio.paused) { audio.play(); playBtn.textContent = '⏸'; nowEl.textContent = `▶ ${CHANNELS[index].name}`; }
  else { audio.pause(); playBtn.textContent = '▶'; nowEl.textContent = `⏸ ${CHANNELS[index].name}`; }
}

$('#prev').addEventListener('click', () => { select(index - 1); tune(); });
$('#next').addEventListener('click', () => { select(index + 1); tune(); });
playBtn.addEventListener('click', toggle);

// Arrow keys move the highlight, Enter tunes: the same two gestures a
// d-pad, a remote and a keyboard all make.
listEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { select(index + 1); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { select(index - 1); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') { tune(); e.preventDefault(); }
});

// ── the shell's services ───────────────────────────────────────────────
if (sdk) {
  // Answering this is what makes the shell's mute real for us. A guest
  // that stays silent cannot be turned down from outside — the shell has
  // no way into this document's audio — so it reports us as ungovernable
  // rather than pretending.
  sdk.onAudio(({ level }) => {
    hostVolume = level;
    window.__tvLevel = level;   // headless probe: did the shell reach us?
    if (audio) audio.volume = level;
  });
  sdk.onPause(() => { if (audio && !audio.paused) { audio.pause(); playBtn.textContent = '▶'; } });
  sdk.onInit(() => { select(0); });
}

a11y?.announce(`Channels ready, ${CHANNELS.length} stations`);
