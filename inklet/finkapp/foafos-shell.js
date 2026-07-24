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
  FoafCluster,
} from '../../packages/foafos/src/index.mjs';

defineBaseCards();
defineFeed();

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
  dock.setAttribute('aria-label', 'Open foafos shell');
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
      <input id="foafos-name" type="text" placeholder="name (optional)" autocomplete="off">
      <input id="foafos-pass" type="password" placeholder="passphrase" autocomplete="off">
      <div class="foafos-row">
        <button type="button" id="foafos-save" title="Encrypt this session to this browser">SAVE</button>
        <button type="button" id="foafos-unlock" title="Decrypt the saved session">UNLOCK</button>
        <button type="button" id="foafos-forget" title="Delete the saved session">FORGET</button>
      </div>
    </section>
    <section id="foafos-shelf-wrap">
      <h4>WINDOWS</h4>
      <div id="foafos-shelf"></div>
    </section>
    <section id="foafos-feed-wrap">
      <h4>FEED</h4>
    </section>`;

  document.body.append(dock, drawer);

  const feed = document.createElement('foafos-feed');
  feed.bus = bus;
  feed.setAttribute('topics', '*');
  drawer.querySelector('#foafos-feed-wrap').appendChild(feed);

  dock.addEventListener('click', () => drawer.classList.toggle('open'));
  drawer.querySelector('#foafos-close').addEventListener('click', () => drawer.classList.remove('open'));

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

  // ── the shelf: open windows, live from bus events ──
  const shelf = $('#foafos-shelf');
  const renderShelf = () => {
    shelf.textContent = '';
    const mg = window.FinkMinigames;
    if (mg?.active && mg.currentType) {
      const info = mg.minigameInfo?.[mg.currentType] || {};
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'foafos-chip';
      const mode = window.FinkWM?.mode || '—';
      chip.textContent = `${info.icon || '🎮'} ${info.title || mg.currentType} · ${mode.toUpperCase()}`;
      chip.title = 'Bring this window forward';
      chip.addEventListener('click', () => {
        const wm = window.FinkWM;
        if (wm) wm.setMode(wm.mode === 'pip' ? wm.lastNonPipMode : 'full');
        drawer.classList.remove('open');
      });
      shelf.appendChild(chip);
    } else {
      const none = document.createElement('div');
      none.className = 'foafos-none';
      none.textContent = 'no game windows open';
      shelf.appendChild(none);
    }
  };
  bus.subscribe('wm.*', renderShelf);
  bus.subscribe('minigame.*', renderShelf);
  renderShelf();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildUI);
} else {
  buildUI();
}
