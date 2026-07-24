// foafos shell (working name — terminology is the owner's to settle).
//
// This module makes the finkapp page a foafos shell instance: it owns the
// local event bus, the session (ephemeral unless sealed with a passphrase),
// the dock + drawer UI, the window shelf, and the activity feed. Platform
// modules (FinkWM, FinkMinigames, the ink engine) publish onto the bus with
// guarded one-liners; everything rendered in the feed is a web component
// satisfying the foafos widget contract.

import {
  FoafBus,
  createSession, sealSession, openSession,
  saveSealed, loadSealed, clearSealed,
  widgets, defineBaseCards, defineFeed,
  SseTransport, WebSocketTransport, FeedPoller,
  FoafCluster, defineGuest, defineTable, defineTree,
} from '../../packages/foafos/src/index.mjs';

defineBaseCards();
defineFeed();
defineGuest();
defineTable();
defineTree();

// Launchable guest widgets (sandboxed processes). Paths resolve under
// the deploy root; grants are per-instance.
const WIDGET_CATALOG = [
  { key: 'tally', title: '🔢 Tally', src: '../../packages/foafos/demo/tally/index.html',
    w: 240, h: 200, grants: (n) => ({ publish: [`widget.tally.${n}.*`], subscribe: ['widget.tally.*'] }) },
  { key: 'data', title: '▦ Data (SQLite)', src: '../../magpie/edot/data/guest.html',
    w: 520, h: 400, grants: (n) => ({ publish: [`widget.data.${n}.*`], subscribe: ['widget.data.*'] }) },
  // The full standalone game (menu, episodes, map jukebox, ROBBAMP) as a
  // window — it speaks no guest protocol, which is also the demo: an
  // undeclared guest simply gets no bus access at all.
  { key: 'robbin', title: '🐦 Robbin (full game)', src: '../../magpie/robbin/robbin.html',
    w: 390, h: 560, grants: () => ({ publish: [], subscribe: [] }) },
];

const bus = new FoafBus();
bus.bridge('foafos');   // two tabs of the shell share one nervous system

const FoafOS = {
  version: '0.1.0',
  bus,
  widgets,
  transports: { SseTransport, WebSocketTransport, FeedPoller, active: [] },
  session: {
    current: null,
    hasSealed: () => !!localStorage.getItem('foafos.session.v1'),
    async seal(passphrase) {
      const sealed = await sealSession(FoafOS.session.current, passphrase);
      saveSealed(sealed, localStorage);
      bus.publish('session.saved', { id: FoafOS.session.current.id });
      return sealed;
    },
    async unlock(passphrase) {
      const sealed = loadSealed(localStorage);
      if (!sealed) throw new Error('no saved session on this device');
      FoafOS.session.current = await openSession(sealed, passphrase);
      announceSession('unlocked');
      return FoafOS.session.current;
    },
    forget() {
      clearSealed(localStorage);
      FoafOS.session.current = createSession();
      announceSession('cleared');
    },
  },
  connect(transport) {
    FoafOS.transports.active.push(transport.connect(bus));
    return transport;
  },
};

function announceSession(what) {
  const s = FoafOS.session.current;
  bus.publish('session.current', {
    summary: `${s.profile.name || 'anonymous'} · ${what}`,
    id: s.id, name: s.profile.name || null, ephemeral: what !== 'unlocked',
  }, { retain: true });
}

FoafOS.session.current = createSession();
window.FoafOS = FoafOS;

// ── cluster: sibling shell windows, lightly coordinated ─────────────────
// The bus is bridged across tabs; the cluster elects a coordinator that
// arbitrates shared resources. First concrete resource: AUDIO — start a
// game in a second window and the first window's game is told to yield
// (audio-blur), so one machine never plays two soundtracks at once.

const cluster = new FoafCluster(bus);
cluster.start();
FoafOS.cluster = cluster;

bus.subscribe('minigame.start', (e) => {
  if (e.source === 'local') cluster.claim('audio', { label: e.data.type });
});
bus.subscribe('audio.focus', (e) => {
  if (e.source !== 'local') return;
  if (e.data.focused) cluster.claim('audio', { label: 'game window' });
  else if (!e.data.yielded) cluster.release('audio');
});
cluster.onYield('audio', () => {
  window.FinkMinigames?._sendToIframe?.({ type: 'audio-blur' });
  bus.publish('audio.focus',
    { focused: false, yielded: true, summary: 'audio yielded to another window' }, { retain: true });
});

// ── shell UI: dock + drawer ──────────────────────────────────────────────

function buildUI() {
  const dock = document.createElement('button');
  dock.id = 'foafos-dock';
  dock.type = 'button';
  dock.setAttribute('aria-label', 'foafos shell');
  dock.setAttribute('aria-expanded', 'false');
  dock.setAttribute('aria-controls', 'foafos-drawer');
  dock.textContent = '⊞';

  const drawer = document.createElement('aside');
  drawer.id = 'foafos-drawer';
  drawer.setAttribute('aria-label', 'foafos shell');
  drawer.innerHTML = `
    <header>
      <b>FOAFOS</b> <span class="foafos-sub">shell · working title</span>
      <button type="button" id="foafos-close" aria-label="Close shell">✕</button>
    </header>
    <section id="foafos-session">
      <div id="foafos-session-status" role="status"></div>
      <input id="foafos-name" type="text" placeholder="name (optional)" aria-label="Session name" autocomplete="off">
      <input id="foafos-pass" type="password" placeholder="passphrase" aria-label="Session passphrase" autocomplete="off">
      <div class="foafos-row">
        <button type="button" id="foafos-save" title="Encrypt this session to this browser">SAVE</button>
        <button type="button" id="foafos-unlock" title="Decrypt the saved session">UNLOCK</button>
        <button type="button" id="foafos-forget" title="Delete the saved session">FORGET</button>
      </div>
    </section>
    <section id="foafos-shelf-wrap">
      <h4>WINDOWS</h4>
      <div id="foafos-shelf"></div>
      <h4>WIDGETS</h4>
      <div id="foafos-launcher"></div>
    </section>
    <section id="foafos-feed-wrap">
      <h4>FEED</h4>
    </section>`;

  document.body.append(dock, drawer);

  const feed = document.createElement('foafos-feed');
  feed.bus = bus;
  // Named topics, not '*': the cluster heartbeats every second on
  // sys.cluster.* and would flood the feed with plumbing. sys.guest.*
  // stays visible (denials are security-relevant).
  feed.setAttribute('topics',
    'story.*,minigame.*,wm.*,session.*,audio.*,widget.*,net.*,sys.guest.*');
  drawer.querySelector('#foafos-feed-wrap').appendChild(feed);

  const setDrawer = (open) => {
    drawer.classList.toggle('open', open);
    dock.setAttribute('aria-expanded', String(open));
  };
  dock.addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  drawer.querySelector('#foafos-close').addEventListener('click', () => setDrawer(false));
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setDrawer(false); dock.focus(); } });

  // session controls
  const $ = (id) => drawer.querySelector(id);
  const status = (msg, isError = false) => {
    const el = $('#foafos-session-status');
    el.textContent = msg;
    el.classList.toggle('error', isError);
  };
  const refreshStatus = () => {
    const s = FoafOS.session.current;
    const who = s.profile.name ? `“${s.profile.name}”` : 'anonymous';
    status(FoafOS.session.hasSealed()
      ? `${who} · sealed session saved on this device`
      : `${who} · ephemeral (dies with the tab unless saved)`);
  };

  $('#foafos-name').addEventListener('change', () => {
    FoafOS.session.current.profile.name = $('#foafos-name').value.trim() || undefined;
    announceSession('renamed');
    refreshStatus();
  });
  $('#foafos-save').addEventListener('click', async () => {
    try {
      FoafOS.session.current.profile.name = $('#foafos-name').value.trim() || undefined;
      await FoafOS.session.seal($('#foafos-pass').value);
      $('#foafos-pass').value = '';
      refreshStatus();
      status('saved — encrypted at rest with your passphrase');
    } catch (e) { status(String(e.message || e), true); }
  });
  $('#foafos-unlock').addEventListener('click', async () => {
    try {
      const s = await FoafOS.session.unlock($('#foafos-pass').value);
      $('#foafos-pass').value = '';
      $('#foafos-name').value = s.profile.name || '';
      refreshStatus();
    } catch (e) { status(String(e.message || e), true); }
  });
  $('#foafos-forget').addEventListener('click', () => {
    FoafOS.session.forget();
    $('#foafos-name').value = '';
    refreshStatus();
  });

  refreshStatus();
  announceSession('started');

  // ── the shelf: EVERY window, as a standard tree (not chip soup) ──
  // The story is a window too (it predates the WM — listed, not magic);
  // widget windows are grouped per instance under one collapsible node.
  const shelf = $('#foafos-shelf');
  const shelfTree = document.createElement('foaf-tree');
  shelfTree.setAttribute('label', 'Open windows');
  shelf.appendChild(shelfTree);

  const renderShelf = () => {
    const depth = window.FinkInkEngine?.storyStack?.length || 0;
    const nodes = [{ id: 'story', icon: '📖', label: 'Story',
      badge: depth ? `DREAM ${depth}` : undefined }];

    const mg = window.FinkMinigames;
    if (mg?.active && mg.currentType) {
      const info = mg.minigameInfo?.[mg.currentType] || {};
      nodes.push({
        id: 'game', icon: info.icon || '🎮', label: info.title || mg.currentType,
        badge: (window.FinkWM?.mode || '—').toUpperCase() + (mg.windowState?.paused ? ' ⏸' : ''),
      });
    }

    const wins = [...document.querySelectorAll('.foafos-window')];
    if (wins.length) {
      nodes.push({
        id: 'widgets', icon: '🧩', label: 'Widgets', badge: String(wins.length),
        children: wins.map((win) => ({
          id: `win:${win.dataset.wid}`,
          label: win.querySelector('.foafos-window-bar span')?.textContent || 'widget',
          actions: [{ id: 'close', icon: '✕', label: 'Close' }],
        })),
      });
    }
    shelfTree.data = nodes;
  };

  const winById = (id) => document.querySelector(`.foafos-window[data-wid="${id.slice(4)}"]`);
  shelfTree.addEventListener('tree-select', (e) => {
    const id = e.detail.id;
    if (id === 'story') {
      const wm = window.FinkWM;
      if (wm?.active && wm.mode === 'full') wm.setMode('split');
      setDrawer(false);
      document.getElementById('narrative-view')?.focus?.();
    } else if (id === 'game') {
      const wm = window.FinkWM;
      if (wm) wm.setMode(wm.mode === 'pip' ? wm.lastNonPipMode : 'full');
      setDrawer(false);
    } else if (id.startsWith('win:')) {
      const win = winById(id);
      if (win) {
        document.querySelectorAll('.foafos-window').forEach(w => { w.style.zIndex = 2620; });
        win.style.zIndex = 2630;
        setDrawer(false);
      }
    }
  });
  shelfTree.addEventListener('tree-action', (e) => {
    if (e.detail.action === 'close' && e.detail.id.startsWith('win:')) winById(e.detail.id)?.remove();
  });
  bus.subscribe('wm.*', renderShelf);
  bus.subscribe('minigame.*', renderShelf);
  bus.subscribe('story.state', renderShelf);
  // widget windows announce open/close on wm.widget.*; removals by any
  // path (bar ✕, script) are caught by observing the DOM
  new MutationObserver(renderShelf).observe(document.body, { childList: true });
  renderShelf();

  // ── standard widgets: data shares open in the shell's table explorer ──
  // The guest computed it; the trusted, uniformly-skinned, a11y-pooled
  // <foaf-table> presents it.
  bus.subscribe('widget.data.*', (e) => {
    if (!e.topic.endsWith('.share') || !e.data?.columns) return;
    const win = makeWindow(`▤ ${e.data.title || 'shared table'} · from ${e.source}`, 460, 320);
    const table = document.createElement('foaf-table');
    table.data = { title: e.data.title, columns: e.data.columns, rows: e.data.rows || [] };
    win.appendChild(table);
    document.body.appendChild(win);
  });

  // ── widget launcher: sandboxed guests as floating windows ──
  let widgetSeq = 0;
  const launcher = $('#foafos-launcher');
  for (const spec of WIDGET_CATALOG) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'foafos-chip';
    btn.textContent = spec.title;
    btn.addEventListener('click', () => {
      openWidgetWindow(spec);
      setDrawer(false);
    });
    launcher.appendChild(btn);
  }

  // One standard window frame for everything the shell floats: titlebar
  // (drag handle), close button, raise-on-interact. Content varies;
  // chrome does not — that uniformity IS the skin.
  function makeWindow(title, w, h) {
    widgetSeq++;
    const win = document.createElement('div');
    win.className = 'foafos-window';
    win.dataset.wid = `w${widgetSeq}`;
    win.setAttribute('role', 'group');
    win.setAttribute('aria-label', title);
    win.style.width = `${w}px`;
    win.style.height = `${h}px`;
    win.style.left = `${12 + (widgetSeq % 5) * 24}px`;
    win.style.top = `${60 + (widgetSeq % 5) * 24}px`;
    win.innerHTML = `
      <div class="foafos-window-bar"><span>${title}</span>
        <button type="button" class="foafos-window-close" aria-label="Close ${title}">✕</button></div>`;

    win.querySelector('.foafos-window-close').addEventListener('click', () => win.remove());

    const bar = win.querySelector('.foafos-window-bar');
    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      const r = win.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      document.querySelectorAll('.foafos-window').forEach(x => { x.style.zIndex = 2620; });
      win.style.zIndex = 2630;
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      win.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, drag.left + e.clientX - drag.x))}px`;
      win.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, drag.top + e.clientY - drag.y))}px`;
    });
    bar.addEventListener('pointerup', () => { drag = null; });
    return win;
  }

  function openWidgetWindow(spec) {
    const name = `${spec.key}${widgetSeq + 1}`;
    const win = makeWindow(`${spec.title} · ${name}`, spec.w, spec.h);

    const guest = document.createElement('foafos-guest');
    guest.setAttribute('src', spec.src);
    guest.setAttribute('name', name);
    guest.setAttribute('label', `${spec.title} ${name}`);
    guest.bus = bus;
    guest.grants = spec.grants(name);
    guest.config = { label: name };
    win.appendChild(guest);
    document.body.appendChild(win);
    return win;
  }
  FoafOS.openWidget = (key) => {
    const spec = WIDGET_CATALOG.find(s => s.key === key);
    return spec ? openWidgetWindow(spec) : null;
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildUI);
} else {
  buildUI();
}
