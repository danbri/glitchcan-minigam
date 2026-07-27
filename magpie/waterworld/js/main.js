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
// Nothing important is allowed to vanish: every toast and fact also lands
// in the ship's log (📜), where it stays for the whole dive.
const logEntries = [];
function addLog(text, cls = '') {
  logEntries.unshift({ text, cls, at: game ? Math.round(game.elapsed) : 0 });
  if (logEntries.length > 80) logEntries.pop();
  const badge = $('log-btn');
  if (!$('log-panel').classList.contains('show')) badge.classList.add('unread');
}
function renderLog() {
  const list = $('log-list');
  list.innerHTML = '';
  for (const e of logEntries) {
    const li = document.createElement('li');
    li.className = e.cls;
    const t = document.createElement('span');
    t.className = 'log-t';
    t.textContent = `${String(Math.floor(e.at / 60)).padStart(2, '0')}:${String(e.at % 60).padStart(2, '0')}`;
    li.appendChild(t);
    li.appendChild(document.createTextNode(' ' + e.text));
    list.appendChild(li);
  }
  if (!logEntries.length) list.innerHTML = '<li>Nothing logged yet — go find something!</li>';
}

function toast(text, cls = '') {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = text;
  box.appendChild(t);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  const life = cls === 'hint' ? 8000 : 6000;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, life);
  addLog(text, cls);
}

let factTimer = null;
function fact(title, text, icon) {
  const f = $('fact');
  $('fact-icon').textContent = icon || '📜';
  $('fact-title').textContent = title;
  $('fact-text').textContent = text;
  f.classList.add('show');
  if (factTimer) clearTimeout(factTimer);
  // stays a good long while — and it's tappable away, never lost (see log)
  factTimer = setTimeout(() => f.classList.remove('show'), 14000);
  addLog(`${icon || '📜'} ${title} — ${text}`, 'gold');
  announce(`${title}. ${text}`);
}

function hint(text) { toast('💡 ' + text, 'hint'); }

function flash(cls) {
  const el = $('flash');
  el.className = '';
  void el.offsetWidth;          // restart the animation
  el.className = cls;
}

function announce(text) { window.__mgA11y?.announce?.(text); }

let lastHull, lastScore, lastObjText;
function hud(s) {
  // the guide banner: what to do, which way, how far
  if (s.obj) {
    $('obj-text').textContent = `${s.obj.icon} ${s.obj.text}`;
    $('obj-arrow').style.transform = `rotate(${s.obj.deg}deg)`;
    $('obj-dist').textContent = s.obj.dist + 'm';
    if (s.obj.text !== lastObjText) {
      lastObjText = s.obj.text;
      announce(`New goal: ${s.obj.text}`);
      addLog(`${s.obj.icon} GOAL: ${s.obj.text}`, 'hint');
    }
  }
  // feel the moment: red flash on damage, gold shimmer on scoring
  if (lastHull !== undefined && s.hull < lastHull) flash('hurt');
  if (lastScore !== undefined && s.score > lastScore) flash('gain');
  lastHull = s.hull; lastScore = s.score;

  $('air-fill').style.width = Math.max(0, s.air * 100) + '%';
  $('air-fill').classList.toggle('low', s.air < 0.25);
  $('hull').textContent = '▮'.repeat(Math.max(0, s.hull)) + '▯'.repeat(Math.max(0, s.hullMax - s.hull));
  $('score').textContent = String(s.score).padStart(5, '0');
  $('depth').textContent = s.depth + 'm';
  $('cargo').textContent = s.cargo
    ? `⚓${s.cargo} ×${s.haulMult.toFixed(2)}${s.combo >= 2 ? ` 🔥${s.combo}` : ''}`
    : '⚓—';
  const bankBtn = $('bank-btn');
  bankBtn.hidden = !s.cargo || s.over;
  $('codex').textContent = `📖${s.codex}/${s.codexTotal}`;
  const held = [
    ...s.tools.map(t => ({ grapple: '🪝', arclamp: '💡', fizzlance: '🫧' }[t] || '🔧')),
    ...s.items.map(i => ({ magnet: '🧲', rope: '🪢', lamp: '🏮', battery: '🔋', soda: '📦', nozzle: '🔩' }[i] || '❓')),
  ];
  $('inv').textContent = held.join(' ') || '·';
  const irBtn = $('ir-btn');
  irBtn.classList.toggle('on', !!s.ir);
  irBtn.setAttribute('aria-pressed', String(!!s.ir));
  const autoBtn = $('auto-btn');
  autoBtn.classList.toggle('on', !!s.auto);
  autoBtn.setAttribute('aria-pressed', String(!!s.auto));
}

function complete(result) {
  const el = $('endcard');
  $('end-title').textContent = result.success ? '🎉 TREASURE RAISED! 🎉' : '💫 WHAT A DIVE!';
  $('end-body').textContent = result.success
    ? `The captain’s chest is aboard the bell! Score ${result.score}, with ${result.stats.codex} pieces of London history in your log. Marvellous.`
    : `Score ${result.score} and ${result.stats.codex} history entries logged — the dock will still be there tomorrow. Dive again!`;
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
  if ((e.key === 'i' || e.key === 'I') && !e.repeat) { game?.toggleIR(); return; }
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

// Captain's gestures: brush the water to set a course, tap to ping.
// Works with finger or mouse, standalone or inside the shell — the
// canvas is ours even when the host owns the pad.
{
  const sceneEl = $('scene');
  let gesture = null;
  sceneEl.addEventListener('pointerdown', (e) => {
    if (!started) return;
    gesture = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, last: 0 };
  });
  sceneEl.addEventListener('pointermove', (e) => {
    if (!gesture || !game) return;
    const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
    if (Math.hypot(dx, dy) > 24) {
      gesture.moved = true;
      const now = performance.now();
      if (now - gesture.last > 160) {
        gesture.last = now;
        audio.ensure();
        game.brush(dx / window.innerWidth, dy / window.innerHeight);
      }
    }
  });
  let lastTapAt = 0;
  const endGesture = (e) => {
    if (gesture && game && !gesture.moved && performance.now() - gesture.t0 < 400) {
      audio.ensure();
      const now = performance.now();
      if (now - lastTapAt < 320) game.dash();   // double-tap = DASH
      else game._doPing();                      // a tap is a ping
      lastTapAt = now;
    }
    gesture = null;
  };
  sceneEl.addEventListener('pointerup', endGesture);
  sceneEl.addEventListener('pointercancel', () => { gesture = null; });
}

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
  $('pad-toggle').style.display = hostOwns ? 'none' : '';
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
  announce('Dive started. Brush the water to steer, tap to ping the sonar.');
  setTimeout(() => {
    if (game && !game.over) hint('Brush the water to steer her, Captain — tap ？ for everything else');
  }, 2500);
}

$('splash').addEventListener('pointerdown', startGame);
$('ir-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); game?.toggleIR(); });
$('auto-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!game) return;
  game.autopilot = !game.autopilot;
  toast(game.autopilot
    ? '⚓ Autopilot on — brush the water to set a course!'
    : '🕹 Manual helm — you have the boat, Captain', 'hint');
  announce(game.autopilot ? 'Autopilot on' : 'Manual helm');
});
$('fact').addEventListener('pointerdown', () => $('fact').classList.remove('show'));
$('log-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const panel = $('log-panel');
  const opening = !panel.classList.contains('show');
  if (opening) renderLog();
  panel.classList.toggle('show', opening);
  $('log-btn').classList.remove('unread');
  $('log-btn').setAttribute('aria-expanded', String(opening));
});
$('log-close').addEventListener('click', () => {
  $('log-panel').classList.remove('show');
  $('log-btn').setAttribute('aria-expanded', 'false');
});
$('endcard').addEventListener('pointerdown', () => {
  if (!EMBED && game?.over) location.reload();
});
$('end-again').addEventListener('click', () => location.reload());

window.addEventListener('resize', () => game?.resize());

buildPad();
// Touch-first means GESTURES first: brush to steer, tap to ping. The
// d-pad is the last resort, parked behind the 🎮 chip until summoned.
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window ||
    navigator.maxTouchPoints > 0) {
  $('pad-toggle').dataset.touch = '1';
}
$('pad-toggle').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const open = !$('pad').classList.contains('open');
  $('pad').classList.toggle('open', open);
  $('pad-toggle').classList.toggle('on', open);
  $('pad-toggle').setAttribute('aria-pressed', String(open));
  if (open) toast('🎮 D-pad out — ▲▼◀▶ steer · A thrust · B sonar', 'hint');
});
$('help-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const panel = $('help-panel');
  const opening = !panel.classList.contains('show');
  panel.classList.toggle('show', opening);
  $('help-btn').setAttribute('aria-expanded', String(opening));
});
$('help-close').addEventListener('click', () => {
  $('help-panel').classList.remove('show');
  $('help-btn').setAttribute('aria-expanded', 'false');
});

// The captain's banking order — the ONE decision the helm never makes
$('bank-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!game) return;
  game._bankOrder = true;
  game.autopilot = true;
  game.manualUntil = 0;
  audio.ensure();
  toast('🔔 Aye aye — making for the bell!', 'gold');
  announce('Taking the haul to the bell.');
});

// The sonar chart: what the pings have taught us, drawn top-down
function drawMap() {
  if (!game) return;
  const cv = $('map-canvas');
  const g2 = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const X = (x) => ((x + 120) / 240) * (W - 30) + 15;
  const Z = (z) => ((z + 80) / 160) * (H - 30) + 15;
  // water: shallow west, deep east
  const grad = g2.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#0d3a5c'); grad.addColorStop(0.55, '#0a2748'); grad.addColorStop(1, '#050f26');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, W, H);
  g2.strokeStyle = '#7ef2ff'; g2.lineWidth = 2;
  g2.strokeRect(6, 6, W - 12, H - 12);
  const dot = (x, z, color, r = 5) => {
    g2.fillStyle = color;
    g2.beginPath(); g2.arc(X(x), Z(z), r, 0, Math.PI * 2); g2.fill();
  };
  // culvert mouths
  g2.fillStyle = '#1f8f4e';
  for (const m of game.dock.culverts) g2.fillRect(X(m.x) - 8, Z(-80) - 4, 16, 8);
  // hulls above
  g2.fillStyle = 'rgba(220,230,240,0.7)';
  for (const h of game.fauna.hulls) {
    g2.save();
    g2.translate(X(h.position.x), Z(h.position.z));
    g2.rotate(-h.rotation.y);
    g2.fillRect(-16, -5, 32, 10);
    g2.restore();
  }
  // what the sonar has charted
  for (const s of game.salvage) {
    if (s._known && !s.collected && !s.hidden) dot(s.mesh.position.x, s.mesh.position.z, '#ffd75e');
  }
  for (const q of game.quest) {
    if (q._known && !q.taken) dot(q.mesh.position.x, q.mesh.position.z, '#ff77a8', 6);
  }
  for (const m of game.mines) {
    if (m._known && m.live) {
      g2.strokeStyle = '#ff2244'; g2.lineWidth = 3;
      const mx = X(m.mesh.position.x), mz = Z(m.mesh.position.z);
      g2.beginPath();
      g2.moveTo(mx - 6, mz - 6); g2.lineTo(mx + 6, mz + 6);
      g2.moveTo(mx + 6, mz - 6); g2.lineTo(mx - 6, mz + 6);
      g2.stroke();
    }
  }
  for (const f of game.fatbergs) dot(f.mesh.position.x, f.mesh.position.z, '#e8b07a', f.r * 1.6);
  if (game.cache) {
    g2.strokeStyle = '#7ef2ff'; g2.lineWidth = 2;
    g2.beginPath(); g2.arc(X(game.cache.x), Z(game.cache.z),
      10 + 4 * Math.sin(performance.now() / 200), 0, Math.PI * 2);
    g2.stroke();
  }
  // the bell
  const b = game.dock.bell.position;
  dot(b.x, b.z, '#ffec27', 9);
  g2.fillStyle = '#442';
  g2.font = '14px sans-serif'; g2.textAlign = 'center';
  g2.fillText('🔔', X(b.x), Z(b.z) + 5);
  // whale, if she's up
  if (game.whaleActive) dot(game.whale.position.x, game.whale.position.z, 'rgba(200,240,255,0.8)', 8);
  // YOU: an arrow showing heading
  g2.save();
  g2.translate(X(game.pos.x), Z(game.pos.z));
  g2.rotate(-game.yaw + Math.PI / 2);
  g2.fillStyle = '#29adff';
  g2.beginPath();
  g2.moveTo(0, -11); g2.lineTo(7, 8); g2.lineTo(-7, 8);
  g2.closePath(); g2.fill();
  g2.restore();
}
let mapTimer = null;
$('map-btn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const panel = $('map-panel');
  const opening = !panel.classList.contains('show');
  panel.classList.toggle('show', opening);
  $('map-btn').setAttribute('aria-expanded', String(opening));
  if (opening) {
    drawMap();
    mapTimer = setInterval(drawMap, 300);
    announce('Sonar chart open.');
  } else if (mapTimer) { clearInterval(mapTimer); mapTimer = null; }
});
$('map-close').addEventListener('click', () => {
  $('map-panel').classList.remove('show');
  $('map-btn').setAttribute('aria-expanded', 'false');
  if (mapTimer) { clearInterval(mapTimer); mapTimer = null; }
});

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
