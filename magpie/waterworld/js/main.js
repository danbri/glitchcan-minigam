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
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window ||
  navigator.maxTouchPoints > 0;

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

// ONE toast at a time. Stacked translucent text was unreadable soup on a
// phone; everything still lands in the log, so nothing is lost by being
// brief. A visible fact card outranks routine toasts entirely.
const toastQueue = [];
let toastActive = false;
function _nextToast() {
  if (toastActive || !toastQueue.length) return;
  const { text, cls, onTap } = toastQueue.shift();
  toastActive = true;
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = text;
  if (onTap) {
    t.classList.add('tappable');
    t.addEventListener('pointerdown', (e) => { e.stopPropagation(); onTap(); });
  }
  box.appendChild(t);
  const life = cls.includes('factoid') ? 6000
    : (cls === 'bad' || cls === 'gold') ? 4200 : cls === 'hint' ? 4800 : 3200;
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => { t.remove(); toastActive = false; _nextToast(); }, 450);
  }, life);
}
function toast(text, cls = '', onTap = null) {
  addLog(text, cls);
  toastQueue.push({ text, cls, onTap });
  while (toastQueue.length > 3) toastQueue.shift();
  _nextToast();
}

// A fact is ONE slim gold line now — never a panel over the action. The
// full text lives in the ship's log (tap the line to open it) and is
// read in full by the announcer.
function openLogPanel() {
  const panel = $('log-panel');
  if (!panel.classList.contains('show')) {
    renderLog();
    panel.classList.add('show');
    $('log-btn').classList.remove('unread');
    $('log-btn').setAttribute('aria-expanded', 'true');
  }
}
function fact(title, text, icon) {
  addLog(`${icon || '📜'} ${title} — ${text}`, 'gold');
  toastQueue.unshift({ text: `${icon || '📜'} ${title} — tap for the tale 📜`,
    cls: 'gold factoid', onTap: openLogPanel });
  while (toastQueue.length > 3) toastQueue.pop();
  _nextToast();
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

let lastHull, lastScore, lastObjText, lastDepth;
function hud(s) {
  // the guide banner: what to do, which way, how far
  $('objective').style.display = s.obj && !s.over ? '' : 'none';
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
  // depth with a live climb/dive marker — swipe feedback you can read
  const dTrend = lastDepth === undefined ? '' : s.depth < lastDepth - 0.4 ? '▲' : s.depth > lastDepth + 0.4 ? '▼' : '';
  lastDepth = s.depth;
  $('depth').textContent = s.depth + 'm' + dTrend;
  $('cargo').textContent = s.cargo
    ? `⚓${s.cargo} ×${s.haulMult.toFixed(2)}${s.combo >= 2 ? ` 🔥${s.combo}` : ''}`
    : '⚓—';
  const bankBtn = $('bank-btn');
  bankBtn.hidden = !s.cargo || s.over;
  $('codex').textContent = `📖${s.codex}/${s.codexTotal}`;
  const held = [
    ...s.tools.map(t => ({ grapple: '🪝', arclamp: '💡', fizzlance: '🫧', loudspeaker: '🔊' }[t] || '🔧')),
    ...s.items.map(i => ({ magnet: '🧲', rope: '🪢', hook: '🪝', coil: '🌀', lamp: '🏮', battery: '🔋', soda: '📦', nozzle: '🔩' }[i] || '❓')),
  ];
  $('inv').textContent = held.join(' ') || '·';
  $('seats').textContent = s.seats ? `🤝${s.seats}` : '';
  const irBtn = $('ir-btn');
  irBtn.classList.toggle('on', !!s.ir);
  irBtn.setAttribute('aria-pressed', String(!!s.ir));
  const autoBtn = $('auto-btn');
  autoBtn.classList.toggle('on', !!s.auto);
  autoBtn.setAttribute('aria-pressed', String(!!s.auto));
}

function complete(result) {
  document.body.classList.add('game-over');   // live UI stands down
  const el = $('endcard');
  if (result.storyWon) {
    $('end-title').textContent = '🎆 THE BERGS ARE BEATEN! 🎆';
    $('end-body').textContent = `Methane, whale-song and one unified spark — Blight Corner goes up like a second Great Fire, backwards. Democracy is saved, and somewhere in City Hall a stinky wet wipe lands in the Mayor's lunch. Score ${result.score}, ${result.stats.codex} codex entries. The end.`;
  } else {
    $('end-title').textContent = result.success ? '🎉 A FINE DIVE! 🎉' : '💫 WHAT A DIVE!';
    $('end-body').textContent = result.success
      ? `Score ${result.score}, with ${result.stats.codex} pieces of London history in your log. Marvellous.`
      : `Score ${result.score} and ${result.stats.codex} history entries logged — the dock will still be there tomorrow. Dive again!`;
  }
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

function choice(prompt, options) {
  return new Promise((resolve) => {
    const panel = $('choice-panel');
    $('choice-prompt').textContent = prompt;
    const box = $('choice-options');
    box.replaceChildren();
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.addEventListener('click', () => {
        panel.classList.remove('show');
        resolve(o.value);
      });
      box.appendChild(b);
    }
    panel.classList.add('show');
    box.firstChild?.focus();
  });
}

const ui = { hud, toast, fact, hint, announce, complete, audio, choice };

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
const PANELS = ['help-panel', 'log-panel', 'map-panel', 'choice-panel', 'board-panel'];
function closeTopPanel() {
  for (const id of PANELS) {
    const p = $(id);
    if (p && p.classList.contains('show')) { p.classList.remove('show'); return true; }
  }
  return false;
}
document.addEventListener('keydown', (e) => {
  if (!started && (e.key === ' ' || e.key === 'Enter')) { startGame(); return; }
  if (e.key === 'Escape' && closeTopPanel()) return;   // close beats sonar
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
  const dragArrow = $('drag-arrow');
  let gesture = null;
  let brakeTimer = null;
  sceneEl.addEventListener('pointerdown', (e) => {
    if (!started) return;
    gesture = { x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY,
      t0: performance.now(), moved: false, braking: false };
    // press and HOLD without moving = hold station (the brake)
    brakeTimer = setTimeout(() => {
      if (gesture && !gesture.moved && game) {
        gesture.braking = true;
        audio.ensure();
        game.setBrake(true);
      }
    }, 380);
  });
  sceneEl.addEventListener('pointermove', (e) => {
    if (!gesture || !game) return;
    const total = Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0);
    if (!gesture.moved && total > 14) {
      gesture.moved = true;
      clearTimeout(brakeTimer);
      if (gesture.braking) { gesture.braking = false; game.setBrake(false); }
      audio.ensure();
    }
    if (gesture.moved) {
      // incremental: each move nudges the nose by the step since last
      game.steerDrag(
        (e.clientX - gesture.lastX) / window.innerWidth,
        (e.clientY - gesture.lastY) / window.innerHeight);
      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
      // show the command: an arrow from where the drag began
      const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
      dragArrow.style.display = 'block';
      dragArrow.style.left = gesture.x0 + 'px';
      dragArrow.style.top = gesture.y0 + 'px';
      dragArrow.style.transform =
        `translate(-50%,-50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
      dragArrow.style.width = Math.min(120, Math.hypot(dx, dy)) + 'px';
    }
  });
  let lastTapAt = 0;
  const endGesture = () => {
    clearTimeout(brakeTimer);
    dragArrow.style.display = 'none';
    if (!gesture) return;
    if (gesture.braking && game) game.setBrake(false);
    else if (game && !gesture.moved && performance.now() - gesture.t0 < 380) {
      audio.ensure();
      const now = performance.now();
      if (now - lastTapAt < 300) game.dash();   // double-tap = DASH
      else game._doPing();                      // a tap is a ping
      lastTapAt = now;
    }
    gesture = null;
  };
  sceneEl.addEventListener('pointerup', endGesture);
  sceneEl.addEventListener('pointercancel', endGesture);
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
    game = new WaterworldGame($('scene'), ui, { lite: LITE, touch: IS_TOUCH });
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
      win: () => game._testWin(),
      lose: () => game._lose('Scuttled by the test harness.'),
    };
  }
  game.start();
  announce('Dive started. Brush the water to steer, tap to ping the sonar.');
  setTimeout(() => {
    if (game && !game.over) hint('Drag to steer · hold still to brake · tap ？ for help');
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

// keyboard operability: Enter/Space on any chip fires its pointer handler
for (const el of document.querySelectorAll('.chip, #bank-btn, #pad-toggle, #objective')) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
  });
}

buildPad();
// Touch-first means GESTURES first: brush to steer, tap to ping. The
// d-pad is the last resort, parked behind the 🎮 chip until summoned.
if (IS_TOUCH) $('pad-toggle').dataset.touch = '1';
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

// Fullscreen: real where the platform allows it; on iPhone Safari the
// only honest route is Add to Home Screen, so say so.
$('fs-btn').addEventListener('pointerdown', async (e) => {
  e.stopPropagation();
  if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
  const el = document.documentElement;
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq) {
    try { await rq.call(el); } catch (err) { /* denied — fine */ }
  } else if (navigator.standalone) {
    toast('Already fullscreen, Captain!', 'hint');
  } else {
    toast('📲 Share → Add to Home Screen = true fullscreen', 'hint');
  }
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

// The Coalition board: tap the goal banner and the story lays itself
// out — every arc, its current step, the seats filled. Discovery
// without a walkthrough.
function renderBoard() {
  if (!game) return;
  const b = game.boardState();
  $('board-title').textContent = `🤝 ${b.title}${b.seats ? ' — ' + b.seats : ''}`;
  const list = $('board-list');
  list.replaceChildren();
  for (const r of b.rows) {
    const li = document.createElement('li');
    li.textContent = `${r.icon} ${r.text}`;
    if (/JOINED|The end/.test(r.text)) li.className = 'done';
    list.appendChild(li);
  }
}
let boardTimer = null;
$('objective').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const panel = $('board-panel');
  const opening = !panel.classList.contains('show');
  panel.classList.toggle('show', opening);
  if (opening) {
    renderBoard();
    boardTimer = setInterval(renderBoard, 500);
    announce('Coalition board open.');
  } else if (boardTimer) { clearInterval(boardTimer); boardTimer = null; }
});
$('board-close').addEventListener('click', () => {
  $('board-panel').classList.remove('show');
  if (boardTimer) { clearInterval(boardTimer); boardTimer = null; }
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
