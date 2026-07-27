// Waterworld boot + shell bridge. Owns the DOM (HUD, splash, toasts,
// touch pad), the input mapping, and the minigame SDK conversation.
// The simulation lives in game.js and knows nothing about any of it.

import { WaterworldGame } from './game.js';
import { WaterAudio } from './audio.js';
import { FACTS } from './facts.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const EMBED = window.parent !== window;
const LITE = params.has('lite');

const audio = new WaterAudio();
let game = null;
let started = false;
let pendingRestore;

// ---------------------------------------------------------------- SDK
// Speak the protocol natively (the robbin pattern): works embedded in the
// FINK shell, harmlessly logs standalone.
const sdk = window.MinigameSDK ? new MinigameSDK() : null;

// ---------------------------------------------------------------- UI glue
function toast(text, cls = '') {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = text;
  box.appendChild(t);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, 2600);
}

let factTimer = null;
function fact(title, text, icon) {
  const f = $('fact');
  $('fact-icon').textContent = icon || '📜';
  $('fact-title').textContent = title;
  $('fact-text').textContent = text;
  f.classList.add('show');
  if (factTimer) clearTimeout(factTimer);
  factTimer = setTimeout(() => f.classList.remove('show'), 5000);
  announce(`${title}. ${text}`);
}

function hint(text) { toast('💡 ' + text, 'hint'); }

function announce(text) { window.__mgA11y?.announce?.(text); }

function hud(s) {
  $('air-fill').style.width = Math.max(0, s.air * 100) + '%';
  $('air-fill').classList.toggle('low', s.air < 0.25);
  $('hull').textContent = '▮'.repeat(Math.max(0, s.hull)) + '▯'.repeat(Math.max(0, s.hullMax - s.hull));
  $('score').textContent = String(s.score).padStart(5, '0');
  $('depth').textContent = s.depth + 'm';
  $('cargo').textContent = s.cargo ? `⚓${s.cargo} (+${s.cargoValue})` : '⚓—';
  $('codex').textContent = `📖${s.codex}/${s.codexTotal}`;
  const held = [
    ...s.tools.map(t => ({ grapple: '🪝', arclamp: '💡', fizzlance: '🫧' }[t] || '🔧')),
    ...s.items.map(i => ({ magnet: '🧲', rope: '🪢', lamp: '🏮', battery: '🔋', soda: '📦', nozzle: '🔩' }[i] || '❓')),
  ];
  $('inv').textContent = held.join(' ') || '·';
}

function complete(result) {
  const el = $('endcard');
  $('end-title').textContent = result.success ? '★ TREASURE RAISED ★' : 'SUB LOST';
  $('end-body').textContent = result.success
    ? `The captain’s chest is aboard the bell. Score ${result.score} — ${result.stats.codex} codex entries logged.`
    : `Score ${result.score}. The dock keeps its secrets a while longer.`;
  el.classList.add('show');
  audio.stopMusic();
  if (sdk && EMBED) {
    sdk.complete({
      success: result.success,
      score: result.score,
      variables: {
        waterworld_won: result.success,
        waterworld_treasure: result.score,
        waterworld_artifacts: result.stats.artifacts,
        score: (Number(sdk.getVariable('score')) || 0) + result.score,
        diamonds: (Number(sdk.getVariable('diamonds')) || 0) + Math.floor(result.score / 40),
        minigame_played: true,
      },
    });
  } else {
    $('end-again').hidden = false;
  }
}

const ui = { hud, toast, fact, hint, announce, complete, audio };

// ---------------------------------------------------------------- input
// One mapping for real keyboards AND the shell's input service: the host
// pad arrives as synthetic KeyboardEvents (A=Space, B=Escape) dispatched
// by the SDK on this document. Handling `key` means handling THESE — a
// guest that hides its pad but ignores them is unplayable in the shell.
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  ' ': 'a', z: 'a', Escape: 'b', x: 'b', b: 'b',
};
const releaseTimers = {};
function setAction(action, down, fromRepeat) {
  if (!game || !started) return;
  audio.ensure();
  game.setKey(action, down);
  // a lost keyup must never stick a control: every (repeating) keydown
  // re-arms a short dead-man's release
  if (down) {
    clearTimeout(releaseTimers[action]);
    releaseTimers[action] = setTimeout(() => game.setKey(action, false), fromRepeat ? 350 : 900);
  } else clearTimeout(releaseTimers[action]);
}
document.addEventListener('keydown', (e) => {
  if (!started && (e.key === ' ' || e.key === 'Enter')) { startGame(); return; }
  const action = KEYMAP[e.key] ?? KEYMAP[e.key?.toLowerCase?.()];
  if (!action) return;
  if (e.key !== 'Escape') e.preventDefault?.();
  // B is edge-triggered (ping) — don't retrigger on autorepeat
  if (action === 'b' && e.repeat) { setAction('b', true, true); return; }
  setAction(action, true, e.repeat);
});
document.addEventListener('keyup', (e) => {
  const action = KEYMAP[e.key] ?? KEYMAP[e.key?.toLowerCase?.()];
  if (action) setAction(action, false);
});

// Own touch pad (standalone only — the shell provides one and tells us).
function buildPad() {
  const pad = $('pad');
  const bind = (btn, action) => {
    const el = $(btn);
    const on = (e) => { e.preventDefault(); el.classList.add('held'); setAction(action, true); };
    const off = (e) => { e.preventDefault(); el.classList.remove('held'); setAction(action, false); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  };
  bind('p-up', 'up'); bind('p-down', 'down');
  bind('p-left', 'left'); bind('p-right', 'right');
  bind('p-a', 'a'); bind('p-b', 'b');
  return pad;
}

function applyControls(controls) {
  const hostOwns = controls?.provider === 'host';
  $('pad').style.display = hostOwns ? 'none' : '';
}

// ---------------------------------------------------------------- boot
function startGame() {
  if (started) return;
  started = true;
  $('splash').classList.remove('show');
  audio.ensure();
  if (!game) {
    game = new WaterworldGame($('scene'), ui, { lite: LITE });
    game.init();
    if (pendingRestore) { game.restore(pendingRestore); pendingRestore = null; }
    window.__waterworld = {
      get game() { return game; },
      state: () => game.hudState(),
      pos: () => game.pos.toArray(),
      press: (k, down = true) => game.setKey(k, down),
      ping: () => game._doPing(),
      teleport: (x, y, z) => { game.pos.set(x, y, z); game.vel.set(0, 0, 0); },
      grabAll: () => game.salvage.filter(s => !s.collected && !s.hidden && !s.heavy)
        .slice(0, 3).forEach(s => game._collect(s)),
      bank: () => game._bank(),
      win: () => { game.hasChest = true; game.cargo.push({ type: 'captains_chest', value: 250 }); game._bank(); },
      lose: () => game._lose('Scuttled by the test harness.'),
    };
  }
  game.start();
  announce('Dive started. Steer with the pad, A to thrust, B for sonar.');
}

$('splash').addEventListener('pointerdown', startGame);
$('endcard').addEventListener('pointerdown', () => {
  if (!EMBED && game?.over) location.reload();
});
$('end-again').addEventListener('click', () => location.reload());

window.addEventListener('resize', () => game?.resize());

buildPad();

// canvas a11y: name it and keep a live description of the dive
const describe = () => {
  if (!game) return 'Splash screen. Press A or tap to dive.';
  const s = game.hudState();
  return `Submarine at ${s.depth} metres. Air ${Math.round(s.air * 100)} percent, hull ${s.hull} of ${s.hullMax}, score ${s.score}, carrying ${s.cargo} items.`;
};
window.__mgA11y?.describeCanvas?.($('scene'), describe);

// ---------------------------------------------------------------- SDK wiring
if (sdk) {
  sdk.onInit((config) => {
    applyControls(config?.controls);
    // the shell has its own splash; dive straight in
    if (EMBED) startGame();
  });
  sdk.onControls(applyControls);
  sdk.onAudio(({ level }) => audio.setLevel(level));
  sdk.onPause(() => { game?.pause(); $('paused').classList.add('show'); audio.setLevel(0); });
  sdk.onResume(() => { game?.resume(); $('paused').classList.remove('show'); audio.setLevel(sdk._audioState?.level ?? 1); });
  sdk.onTerminate(() => { game?.stop(); audio.stopMusic(); audio.fizz(false); });
  sdk.onSnapshot(() => game?.snapshot() ?? null);
  sdk.onRestore((snap) => {
    if (!snap) return;
    if (game) game.restore(snap);
    else pendingRestore = snap;
  });
}

// Standalone: show the splash and wait for a gesture.
if (!EMBED) $('splash').classList.add('show');
else {
  // If the host's init somehow never arrives, don't sit on a black
  // screen forever — the game is still worth playing.
  setTimeout(() => { if (!started) startGame(); }, 4000);
}
