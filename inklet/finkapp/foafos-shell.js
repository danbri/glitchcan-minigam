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
  FoafInput, ACTION_KEYS, FoafVars, FoafAudio, FoafStore, FoafSecrets, localBackend, AppTree,
  defaultOps, scopeBus,
} from '../../packages/foafos/src/index.mjs';
import { appsByFamily, appById, ambientApps, unenforcedApps, chromeApps, APPS } from './foafos-apps.js';
import { resolveRoot, rootOffers, ROOTS } from './foafos-root.js';
window.__foafAppRegistry = APPS;   // the service inventory counts holders from this

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

// ── variable governance ────────────────────────────────────────────────
// Guests are untrusted code. Without this their manifests were
// decorative: set-variable and complete.variables wrote ANY name into
// the running story. The broker enforces the manifest, keeps the shared
// economy bounded, and makes dreams read-only for it.
const vars = new FoafVars({ bus });
FoafOS.vars = vars;
bus.subscribe('story.state', (e) => vars.setDepth(e.data?.depth || 0));

// ── audio: volume and mute as an OS service ────────────────────────────
// Every sound source used to have its own idea of loudness and none of
// them could be turned down. Same-document sources obey directly; guests
// obey only if they answered the `audio` probe, and the control reports
// the ones it cannot reach rather than pretending.
let audioStore = null;
try { audioStore = window.localStorage; } catch (e) { /* sealed/blocked */ }
const audio = new FoafAudio({ bus, storage: audioStore });
FoafOS.audio = audio;

// FinkAudio and FinkFoley live in THIS document, so they always obey.
audio.register('story.music', (level) => {
  const a = window.FinkAudio;
  if (a?.currentGain) { try { a.currentGain.gain.value = level * (a.baseVolume ?? 1); } catch (e) { /* not started */ } }
  if (a) a.masterLevel = level;
}, { label: 'story music' });
audio.register('story.foley', (level) => {
  const f = window.FinkFoley;
  if (f?.setMasterLevel) f.setMasterLevel(level);
  else if (f?.masterGain) { try { f.masterGain.gain.value = level; } catch (e) { /* idem */ } }
  if (f) f.masterLevel = level;
}, { label: 'story foley' });

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

// ── state: storage as a brokered service ───────────────────────────────
// An app in a sandboxed frame has an opaque origin, where localStorage
// throws. Rather than hand the origin back (which is what
// `allow-same-origin` did, and it dissolved every other boundary too),
// the shell holds the bytes and the app holds a capability. Local
// backend today; a synced one drops in behind the same interface without
// any app knowing.
const store = new FoafStore({
  bus,
  backend: localBackend(audioStore || { getItem: () => null, setItem: () => {} }),
  // Named exceptions, not a raised default. Data keeps a whole SQLite
  // file, and an almost-empty one is already ~43KB once base64'd, so the
  // 256KB everyone else gets would run out on a modest spreadsheet.
  // Raising it for everybody would dissolve the limit for exactly the
  // apps it exists to bound; naming the app keeps the generosity as
  // auditable as the grant.
  quotas: { sheets: 4 * 1024 * 1024 },
});
FoafOS.store = store;

// ── secrets: the one thing the storage broker must NOT be asked to hold ──
// Measured (July 2026): edot's "stay signed in" moves its tokens from
// sessionStorage to localStorage, which under foafos is app-sdk's shim over
// FoafStore — so a bearer token landed in `foafos.store.edot`, in plaintext,
// on disk, in the SHELL's origin. Nothing was broken to cause that; reading
// back what you wrote is what a storage broker is FOR, which is precisely
// why a credential does not belong in one.
//
// FoafSecrets is the same shape with a deliberately worse interface: put,
// name, use — and no get at all. Sealed at rest only when the session has a
// passphrase; otherwise it holds them for the run and SAYS so, rather than
// quietly writing them out in the clear.
const secrets = new FoafSecrets({
  bus,
  storage: audioStore || null,
});
FoafOS.secrets = secrets;

// ── ops: what "use a secret" actually MEANS ─────────────────────────────
// Taking `get` away leaves an obvious hole. If "use it" means "run this
// function I'm handing you", the whole thing was theatre — a guest-supplied
// function receiving the value is reading the secret with extra steps. So
// the transport carries a VERB NAME and some data, and the shell decides
// what that verb does:
//
//   app:   foaf.invoke('git.commit', { path, content, message })
//   shell: ops.invoke('edot', 'git.commit', params)
//            → secrets.use('edot', 'git.token', (t) => fetch(…))
//
// The rule that makes it safe is THE SCOPE SUPPLIES THE DESTINATION, THE
// APP SUPPLIES THE DATA. An op taking its repo or host from the caller
// would be a signed-request-to-anywhere primitive with a credential
// attached. Where each verb points is configuration held HERE, and a verb
// with no scope configured is refused — a verb aimed nowhere must not act.
const ops = defaultOps({ secrets, bus });
FoafOS.ops = ops;

// Scopes are configuration, not code: which repo, which bucket, which pod.
// Persisted in the shell's own storage (never an app's), so a user sets it
// once. Nothing prompts for these yet — see `FoafOS.aimOp` below, which is
// the seam a settings UI would use.
//
// SCOPED PER ROOT (July 2026), and this one is worth explaining because the
// reasoning cuts against itself.
//
// A root is NOT a security boundary and cannot be made into one here. `?root=`
// is a query parameter on a single origin; anyone can type a different one.
// So scoping storage per root buys **no** security against a hostile user, and
// presenting it as though it did would be exactly the false-separation the
// rest of this shell exists to avoid.
//
// It is still right, for a narrower reason. MEASURED: a destination aimed
// under `?root=office` — an installation holding four capabilities and
// offering six apps — was live under `?root=` (glitchcanary), which holds
// `launch`, `navigate` and `same-origin`, offers EVERY app, and is where
// STORIES run with their capability list unenforced. So "commit to
// danbri/private-notes", configured in a locked-down office, came back armed
// in the installation where a document from the Finkiverse can call
// `launchApp`. The aim survives a root switch unconditionally; the credential
// does not (secrets are memory-only unless sealed), so the destination was
// the loose half.
//
// That is defence in depth against the shell's own carelessness, not a
// boundary — a decision made in one installation should not silently apply in
// another with a different capability set. Legacy unscoped blobs are DROPPED
// rather than migrated: re-aiming is one tap in Publishing, and inheriting an
// authority-adjacent decision into an installation that never made it is the
// thing being fixed.
const OP_SCOPE_KEY = 'foafos.op-scopes';
/** Does this blob already have the root layer, or is it the legacy shape? */
const ROOTS_SEEN = (all) => Object.keys(all).some(k => k in ROOTS);
function loadOpScopes() {
  try {
    const all = JSON.parse(audioStore?.getItem(OP_SCOPE_KEY) || '{}') || {};
    const mine = all[ROOT.id];
    // A legacy blob is `{appId: {cap: scope}}` with no root layer. Detect it
    // by the absence of our root key AND the presence of app-shaped keys, and
    // discard rather than guess which installation meant it.
    if (!mine && Object.keys(all).length && !ROOTS_SEEN(all)) return {};
    return mine || {};
  } catch (e) { return {}; }
}
function saveOpScopes(forRoot) {
  try {
    const all = JSON.parse(audioStore?.getItem(OP_SCOPE_KEY) || '{}') || {};
    const clean = ROOTS_SEEN(all) ? all : {};        // drop a legacy blob once
    clean[ROOT.id] = forRoot;
    audioStore?.setItem(OP_SCOPE_KEY, JSON.stringify(clean));
  } catch (e) { /* full */ }
}
/**
 * Point one of an app's verb capabilities at a destination.
 * Refuses a scope the op itself rejects, so a typo fails here and now
 * rather than at the first Save.
 */
FoafOS.aimOp = function aimOp(appId, capability, scope) {
  const all = loadOpScopes();
  const forApp = { ...(all[appId] || {}), [capability]: scope };
  try {
    ops.grant(appId, forApp);                 // validates every scope it is given
  } catch (e) {
    bus.publish('ops.refused', {
      summary: `${appId}'s ${capability} destination was refused: ${e.message}`,
      appId, capability, reason: 'bad-scope',
    });
    return { ok: false, reason: 'bad-scope', detail: e.message };
  }
  all[appId] = forApp;
  saveOpScopes(all);
  bus.publish('ops.aimed', {
    summary: `${appId}'s ${capability} now points at ` +
             `${scope.repo || scope.bucket || scope.base || '(somewhere)'}`,
    appId, capability,
  });
  return { ok: true };
};
/**
 * Install an app's saved verb scopes, intersected with what the app tree
 * actually granted it. Called on every launch, because a grant that
 * outlives the reason for it is how a boundary rots.
 */
function aimVerbsFor(appId, granted = []) {
  const saved = loadOpScopes()[appId] || {};
  const allowed = {};
  for (const [cap, scope] of Object.entries(saved)) {
    if (granted.includes(cap)) allowed[cap] = scope;
    else bus.publish('ops.refused', {
      summary: `${appId} has a saved ${cap} destination but was not granted ${cap}`,
      appId, capability: cap, reason: 'not-granted',
    });
  }
  ops.revoke(appId);
  if (Object.keys(allowed).length) {
    try { ops.grant(appId, allowed); }
    catch (e) {
      bus.publish('ops.refused', {
        summary: `${appId}'s saved verb destinations are invalid: ${e.message}`,
        appId, reason: 'bad-scope',
      });
    }
  }
}
FoafOS.aimVerbsFor = aimVerbsFor;

FoafOS.unaimOp = function unaimOp(appId) {
  const all = loadOpScopes();
  delete all[appId];
  saveOpScopes(all);
  ops.revoke(appId);
  bus.publish('ops.aimed', { summary: `${appId}'s verb destinations were cleared`, appId });
};

// ── the root, and the tree of apps beneath it ──────────────────────────
// An installation is a root manifest plus whatever it opens. The root
// holds a capability set and every app is bounded by it, because the
// tree attenuates — an app can never be granted what its parent lacks,
// and root is everyone's ancestor. Trimming the root's list is therefore
// the one blunt instrument for locking an installation down.
const { root: ROOT, requested: rootRequested, fellBack: rootFellBack } = resolveRoot();
const apps = new AppTree({ bus });
FoafOS.apps = apps;
FoafOS.root = ROOT;
const rootNode = apps.spawn({
  appId: `root:${ROOT.id}`, parentId: null,
  capabilities: ROOT.capabilities, label: ROOT.label, surface: 'root',
});
FoafOS.rootNode = rootNode;
// Game snapshots are the shell holding bytes on a guest's behalf, so
// they live in the store like everything else the shell holds — under a
// namespace of their own, not the guest's, because the guest may not
// read them back except through the restore it is handed.
//
// Bounded by the root, deliberately: an installation with no `storage`
// (tellyclub) does not quietly persist game state anyway. The store
// answers `null` to a namespace it never granted, and the minigame host
// treats that as "nothing saved" — which is exactly true.
FoafOS.snapshotNs = 'shell:game-snapshots';
if (ROOT.capabilities.includes('storage')) store.grant(FoafOS.snapshotNs, ['storage']);
// An installation with no stories should not wear story chrome. The flag
// stays because it is a true statement about the installation and skins
// may want it — but it is no longer what REMOVES the narrative
// furniture. See the chrome apps below: that is now a manifest decision,
// not a stylesheet one.
if (ROOT.boot && ROOT.boot.story === false) {
  document.documentElement.setAttribute('data-root-storyless', 'true');
}

// ── chrome: the shell's own furniture, as apps ─────────────────────────
// The breadcrumb, the story status line and the FINK load meter were
// markup in index.html that a storyless root dealt with by CSS:
// `display: none !important`. They still existed, still held ids the
// story engine wrote into, and still sat in the document — merely
// painted over. "Which parts of the UI exist" is a manifest question.
//
// So they are apps with `surface: 'chrome'`. Offered by the root → they
// spawn into the tree, bounded by it like everything else, and the
// element stays in the page. Not offered → the element is PARKED: taken
// out of the DOM, and therefore out of layout, tab order and the
// accessibility tree, which is what the CSS was pretending to do.
//
// Parked rather than destroyed because the elements are also the state:
// the breadcrumb caches its DOM and binds its own listeners at init, so
// re-appending the same node brings it back intact, while rebuilding it
// would need a teardown protocol nothing here has.
const chromeMounted = new Map();   // appId → { node }
const chromeParked = new Map();    // appId → { el, parent, next }

function parkChrome(app) {
  const el = document.getElementById(app.mount);
  if (!el || chromeParked.has(app.id)) return;
  // Remember where it came from at PARK time, not mount time — the
  // neighbours can have changed while it was on screen.
  chromeParked.set(app.id, { el, parent: el.parentNode, next: el.nextSibling });
  el.remove();
}

function mountChrome(app) {
  if (chromeMounted.has(app.id)) return chromeMounted.get(app.id).node;
  const parked = chromeParked.get(app.id);
  if (parked) {
    parked.parent.insertBefore(parked.el, parked.next);
    chromeParked.delete(app.id);
  }
  if (!document.getElementById(app.mount)) return null;   // no such furniture
  const node = apps.spawn({
    appId: app.id, parentId: rootNode.id,
    capabilities: app.capabilities || [], label: app.name, surface: 'chrome',
  });
  if (node.refused) { parkChrome(app); return null; }
  node.onClose = () => { chromeMounted.delete(app.id); parkChrome(app); };
  chromeMounted.set(app.id, { node });
  // The breadcrumb caches its elements at init and skips entirely if the
  // container is missing. If it initialised while we had it parked, give
  // it the one more chance it needs — guarded on the cache being empty so
  // this cannot double-bind its listeners.
  if (app.id === 'breadcrumb' && window.FinkBreadcrumb
      && !window.FinkBreadcrumb.elements?.container) {
    try { window.FinkBreadcrumb.init(); } catch (e) { /* older build */ }
  }
  bus.publish('chrome.mount', { summary: `${app.name} chrome mounted`, id: app.id });
  return node;
}

function unmountChrome(id) {
  const st = chromeMounted.get(id);
  if (!st) return false;
  apps.close(st.node.id);          // onClose parks the element
  bus.publish('chrome.unmount', { summary: `${appById(id)?.name || id} chrome removed`, id });
  return true;
}

/** Boot the furniture this installation asked for; park the rest. */
function initChrome() {
  for (const app of chromeApps()) {
    if (rootOffers(ROOT, app.id)) mountChrome(app);
    else parkChrome(app);
  }
}
FoafOS.chrome = {
  mount: (id) => { const a = appById(id); return a ? mountChrome(a) : null; },
  unmount: unmountChrome,
  isMounted: (id) => chromeMounted.has(id),
  offered: () => chromeApps().filter(a => rootOffers(ROOT, a.id)).map(a => a.id),
};
bus.publish('root.ready', {
  summary: rootFellBack
    ? `unknown root "${rootRequested}" — booted ${ROOT.label} instead`
    : `${ROOT.label} root: ${ROOT.capabilities.length} capabilities`,
  id: ROOT.id, capabilities: ROOT.capabilities, fellBack: rootFellBack,
}, { retain: true });

// ── the tree gets its branches ─────────────────────────────────────────
// A tree whose every node hangs off root is a list wearing a tree's
// clothes, and the grouping it was built for has nothing to group. So:
// the loaded story becomes a node under root, and the games it opens
// become children of THAT — which is what makes "close the story and
// everything it opened" mean something.
//
// Done by observing lifecycle events that already exist rather than
// teaching FinkMinigames about the tree. The engine and the minigame host
// stay unaware; if this were wrong, it would be wrong in one file.
//
// Note the capability list: a story's powers DESCRIBE rather than
// constrain (the narrative runtime is the host page — see foafos-apps.js),
// so the node carries the root's own set. When the runtime finally moves
// into a frame, this is the line that starts telling the truth.
let storyNode = null;
bus.subscribe('story.state', (e) => {
  if (e.source !== 'local') return;
  const phase = e.data?.phase;
  if (phase !== 'play' || storyNode) return;
  storyNode = apps.spawn({
    appId: 'story', parentId: FoafOS.rootNode?.id || null,
    capabilities: FoafOS.rootNode?.capabilities || [],
    label: 'Story', surface: 'story',
  });
  if (storyNode.refused) storyNode = null;
  FoafOS.storyNode = storyNode;
});

// Games open UNDER the story that opened them. The shell mirrors the
// minigame host's own instance events; onClose routes back through the
// host so closing a subtree really tears the guest down rather than
// just forgetting it.
//
// Stage guests are apps, full stop — managed by their superior app (the
// story) but first-class in the tree AND on the bus. Each instance gets
// a SCOPED bus view: publish limited to its own namespace, inbound
// limited to the shell surfaces that shape it. Policy (the grants) is
// decided here, next to the registry; FinkMinigames only routes frames.
const busGrantsFor = (type, app) => app?.bus || {
  publish: [`guest.${type}.*`],
  subscribe: ['wm.mode', 'audio.volume', 'story.state'],
};
const gameNodes = new Map();       // minigame instance id -> tree node id
bus.subscribe('minigame.instance', (e) => {
  if (e.source !== 'local') return;
  const { id, type, closed } = e.data || {};
  if (!id) return;
  if (closed) {
    const nodeId = gameNodes.get(id);
    gameNodes.delete(id);
    // The guest is already gone; drop the node without re-closing it.
    if (nodeId && apps.get(nodeId)) { apps.get(nodeId).onClose = null; apps.close(nodeId); }
    return;
  }
  const app = appById(type);
  const node = apps.spawn({
    appId: type, parentId: (storyNode || FoafOS.rootNode)?.id || null,
    capabilities: app?.capabilities || [],
    label: app?.name || type, surface: 'stage',
    // endMinigame() is the real teardown — `closeMinigame` does not
    // exist, and an onClose calling it would have been a silent no-op
    // that left the guest running while the tree said it was gone.
    onClose: () => { try { window.FinkMinigames?.endMinigame?.(); } catch (err) { /* already gone */ } },
  });
  if (!node.refused) {
    gameNodes.set(id, node.id);
    const grants = busGrantsFor(type, app);
    // name feeds scopeBus's source stamp: `guest:<type>#<instance>` —
    // two copies of one game are two distinct voices
    window.FinkMinigames?.attachBus?.(
      id, scopeBus(bus, { name: `${type}#${id}`, ...grants }), grants);
  }
});

// ── input: one d-pad for the whole shell (OS service) ───────────────────
// The pad lives in the HOST page, not inside a guest iframe: only the
// host sees the real visible viewport and the device's safe-area insets,
// which is why an in-iframe pad ends up under the browser chrome.
// Sources (touch pad, keyboard, gamepad) normalize to actions; the sink
// routes them to the focused window as legacy SDK key messages, so
// guests need no changes.

const input = new FoafInput({ bus });
FoafOS.input = input;

input.addSink((e) => {
  const mg = window.FinkMinigames;
  if (mg?.active && mg.iframeMinigame) {
    const map = ACTION_KEYS[e.action];
    if (map) {
      mg.iframeMinigame.contentWindow?.postMessage({
        type: 'key', event: e.phase === 'press' ? 'keydown' : 'keyup',
        // A held button autorepeats here, in the input service. Guests
        // use e.repeat to tell a fresh tap from a hold (robbin's jumpTap,
        // its Konami reader), so the flag has to survive the trip or
        // every repeat reads as a new press.
        key: map.key, code: map.code, repeat: !!e.repeat,
      }, '*');
    }
  }
  // widgets and any other listener can use the normalized form
  if (!e.repeat) bus.publish('input.action', { action: e.action, phase: e.phase, source: e.source });
});

function buildPad() {
  const pad = document.createElement('div');
  pad.id = 'foaf-pad';
  pad.hidden = true;
  pad.setAttribute('role', 'group');
  pad.setAttribute('aria-label', 'Game controls');
  // The directional area is ONE joystick surface (diagonals, drag-steer);
  // the arrows are painted affordances, not four separate buttons.
  pad.innerHTML = `
    <div class="foaf-pad-dir" role="application" aria-label="Direction pad — drag to steer">
      <span class="pd u">▲</span><span class="pd l">◀</span>
      <span class="pd r">▶</span><span class="pd d">▼</span>
      <span class="pd c">●</span>
    </div>
    <div class="foaf-pad-act">
      <button type="button" data-action="a" aria-label="Action">A</button>
      <button type="button" data-action="b" aria-label="Back">B</button>
    </div>`;
  document.body.appendChild(pad);
  input.bindSurface(pad)
    .bindJoystick(pad.querySelector('.foaf-pad-dir'))
    .attachKeyboard().attachGamepads();

  // A real gamepad retires the on-screen pad (and brings it back).
  bus.subscribe('input.gamepad', () => refreshPad());
  bus.subscribe('minigame.start', () => refreshPad());
  bus.subscribe('minigame.complete', () => refreshPad());
  bus.subscribe('wm.mode', () => refreshPad());
  bus.subscribe('wm.close', () => refreshPad());
  return pad;
}

function refreshPad() {
  const pad = document.getElementById('foaf-pad');
  if (!pad) return;
  const mg = window.FinkMinigames;
  // A guest that never answered the conformance probe (spec §5.1.2) has
  // had the input service retracted: it is doing its own thing, and a
  // second pad on top of its own is the bug we are avoiding.
  const retracted = !!mg?.windowInstance?.inputRetracted;
  const wantsPad = mg?.active && mg.currentControls && mg.currentControls !== 'none' && !retracted;
  const fullOrSplit = !window.FinkWM?.mode || window.FinkWM.mode !== 'pip';
  const hasGamepad = bus.retained('input.gamepad')[0]?.data?.connected === true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const show = !!(wantsPad && fullOrSplit && !hasGamepad && coarse);
  if (!show) input.releaseAll();
  pad.hidden = !show;
  pad.classList.toggle('act-hidden', mg?.currentControls === 'lite');
  // the dock lives in the same corner as the action buttons — get out
  // of the player's way while the pad is up
  document.body.classList.toggle('foaf-pad-on', show);
}
FoafOS.refreshPad = refreshPad;

// ── shell UI: dock + drawer ──────────────────────────────────────────────

// ── the announcer: platform EVENTS reach assistive tech ─────────────
// Windows changing mode, games starting and finishing, audio moving to
// another tab, the dream deepening, a guest being denied — all of it is
// visible on screen and, without this, silent to a screen reader. The
// bus already carries every one of those facts, so one polite live
// region subscribed to the right topics covers the platform.
function buildAnnouncer() {
  const el = document.createElement('div');
  el.id = 'foafos-announcer';
  el.className = 'sr-only';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);

  let last = '';
  const say = (text) => {
    if (!text || text === last) return;
    last = text;
    // clear first so identical-but-repeated messages still fire
    el.textContent = '';
    setTimeout(() => { el.textContent = text; }, 30);
  };

  const SPOKEN = {
    'minigame.start': (d) => `${d.summary || 'game started'}`,
    'minigame.complete': (d) => `${d.summary || 'game finished'}`,
    'wm.mode': (d) => `Game window ${d.mode}`,
    'wm.open': () => 'Game window opened',
    'wm.close': () => 'Game window closed',
    'audio.focus': (d) => d.focused ? 'Game audio resumed' : 'Game audio paused',
    'session.current': (d) => d.summary,
    'session.saved': () => 'Session saved, encrypted on this device',
    'ui.skin': (d) => `Skin ${d.skin}`,
    'sys.guest.denied': (d) => `Blocked: ${d.guest} tried to publish ${d.topic}`,
    'sys.guest.unrouted': (d) => d.summary,
    // A widget that never answered the probe keeps its own controls and
    // the shell steps back (spec §5.1.2). The player's controls just
    // changed, so say so.
    'sys.guest.nonconforming': (d) => d.summary,
    // Pooled from the guests themselves (guest-a11y.js). A canvas game
    // has nothing for a screen reader to read; this is how it speaks.
    'guest.announce': (d) => d.summary,
    'minigame.instance': (d) => d.summary,
    'story.state': (d) => d.phase === 'fault' ? 'Story error'
      : d.phase === 'loading' ? 'Loading' : d.depth ? `Dream depth ${d.depth}` : null,
  };
  for (const [topic, fmt] of Object.entries(SPOKEN)) {
    bus.subscribe(topic, (e) => { try { say(fmt(e.data || {})); } catch { /* never break on a message */ } });
  }
  FoafOS.announce = say;
  return el;
}

function buildUI() {
  buildAnnouncer();
  buildPad();
  // Furniture before anything else asks whether it is there.
  initChrome();
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
      <b>FOAFOS</b> <span class="foafos-sub">shell</span>
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
    <section id="foafos-audio-wrap">
      <h4>SOUND</h4>
      <div class="foafos-row">
        <button type="button" id="foafos-mute" aria-pressed="false"
                title="Mute everything the shell can reach (Alt+M)">🔊</button>
        <input type="range" id="foafos-vol" min="0" max="100" step="1" value="100"
               aria-label="Volume">
        <output id="foafos-vol-out" for="foafos-vol">100%</output>
      </div>
      <p id="foafos-audio-note" class="foafos-sub" role="status"></p>
    </section>
    <section id="foafos-skin-wrap">
      <h4>SKIN</h4>
      <div id="skin-picker" role="group" aria-label="Visual skin"></div>
    </section>
    <section id="foafos-apps-wrap">
      <h4>APPS</h4>
      <div class="foafos-row">
        <button type="button" id="foafos-home-btn" title="All apps (Alt+H)">⊞ Apps</button>
        <button type="button" id="foafos-switch-btn" title="Running apps (Alt+Tab)">⧉ Running</button>
      </div>
    </section>
    <section id="foafos-caps-wrap">
      <h4>CAPABILITIES</h4>
      <p id="foafos-caps-note" class="foafos-sub" role="status"></p>
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
    'story.*,minigame.*,wm.*,session.*,audio.*,widget.*,net.*,sys.guest.*,nav.*');
  drawer.querySelector('#foafos-feed-wrap').appendChild(feed);

  const setDrawer = (open) => {
    drawer.classList.toggle('open', open);
    dock.setAttribute('aria-expanded', String(open));
    // A closed drawer is hidden by `transform` alone, which moves it out
    // of SIGHT and nothing else: all 20 of its controls stayed in the tab
    // order, so tabbing through the story dropped focus into an invisible
    // panel off the right edge. `inert` withdraws it from focus, hit
    // testing and the accessibility tree in one go; aria-hidden covers
    // assistive tech that predates inert.
    drawer.inert = !open;
    drawer.setAttribute('aria-hidden', String(!open));
  };
  setDrawer(false);        // start withdrawn, not merely translated away
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
    status(`${who} · ${FoafOS.session.hasSealed()
      ? 'sealed session saved on this device'
      : 'ephemeral (dies with the tab unless saved)'}${secretsNote()}`);
  };
  // The passphrase field was already here, and until now it sealed only the
  // session. Secrets could be sealed the same way and nothing called it, so
  // in practice they were memory-only — the honest default, but a gap.
  //
  // Reporting the SEALED-BUT-LOCKED state is the load-bearing half. "You
  // have no key stored" and "your key is right there, sealed, and nobody
  // has unlocked it" are completely different situations, and a shell that
  // reports the first for the second sends someone off to mint a token they
  // already have.
  const secretsNote = () => {
    if (secrets.count()) return ` · ${secrets.count()} secret(s) ${secrets.sealed ? 'sealed' : 'held for this run'}`;
    if (secrets.hasSealed()) return ' · secrets sealed on this device — UNLOCK to use them';
    return '';
  };

  $('#foafos-name').addEventListener('change', () => {
    FoafOS.session.current.profile.name = $('#foafos-name').value.trim() || undefined;
    announceSession('renamed');
    refreshStatus();
  });
  $('#foafos-save').addEventListener('click', async () => {
    try {
      FoafOS.session.current.profile.name = $('#foafos-name').value.trim() || undefined;
      const pass = $('#foafos-pass').value;
      await FoafOS.session.seal(pass);
      // …and the secrets with it, under the same passphrase. One prompt, not
      // two: a user asked to remember a second password for their tokens
      // will reuse the first one anyway.
      const sec = await secrets.seal(pass).catch(() => ({ ok: false }));
      $('#foafos-pass').value = '';
      refreshStatus();
      status(sec.ok
        ? `saved — session and ${secrets.count()} secret(s) encrypted at rest`
        : 'saved — session encrypted at rest with your passphrase');
    } catch (e) { status(String(e.message || e), true); }
  });
  $('#foafos-unlock').addEventListener('click', async () => {
    try {
      const pass = $('#foafos-pass').value;
      const s = await FoafOS.session.unlock(pass);
      // Only after the session opened, so a wrong passphrase has already
      // failed once and this is not a second guess at the same secret.
      const sec = await secrets.unseal(pass);
      $('#foafos-pass').value = '';
      $('#foafos-name').value = s.profile.name || '';
      // A verb an app was granted may now have its key back, so re-apply
      // every saved destination — otherwise unlocking restores the
      // credential and leaves the thing that uses it still refused.
      // `apps.nodes` is a Map, so iterate its values — `?.find?.()` on it is
      // `undefined` and would have made this whole loop a silent no-op that
      // looked like working code.
      for (const node of apps.nodes.values()) {
        if (node.surface === 'root') continue;
        aimVerbsFor(node.appId, node.capabilities || []);
      }
      refreshStatus();
      if (sec.ok) status(`unlocked — ${secrets.count()} secret(s) available again`);
    } catch (e) { status(String(e.message || e), true); }
  });
  $('#foafos-forget').addEventListener('click', () => {
    FoafOS.session.forget();
    // Forgetting the session MUST take the credentials with it. Leaving a
    // sealed token behind after someone pressed FORGET would be the worst
    // possible reading of the word.
    const gone = secrets.clearSealed();
    $('#foafos-name').value = '';
    refreshStatus();
    if (gone.forgotten) status(`forgotten — including ${gone.forgotten} secret(s)`);
  });

  refreshStatus();
  announceSession('started');

  // ── skins: a system service, not a story decision ──
  // One DOM, several identities (fink-skins.css). Every skin is held to
  // the same AA contrast / focus / hit-target bar by test/skins-a11y.mjs.
  // Broadsheet leads and is labelled as the default — it IS the default
  // (index.html boot script), and the picker should say so rather than
  // presenting six equal strangers with Spectrum in the seat of honour.
  const SKINS = [
    ['broadsheet', 'Broadsheet · default'], ['spectrum', 'Spectrum'],
    ['paper', 'Paper'], ['terminal', 'Terminal'],
    ['aurora', 'Aurora'], ['calm', 'Calm'],
  ];
  const picker = $('#skin-picker');
  const applySkin = (id) => {
    document.documentElement.dataset.skin = id;
    try { localStorage.setItem('foafos.skin', id); } catch { /* private mode */ }
    for (const b of picker.children) b.setAttribute('aria-pressed', String(b.dataset.skin === id));
    bus.publish('ui.skin', { skin: id, summary: `skin → ${id}` }, { retain: true });
  };
  for (const [id, label] of SKINS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.skin = id;
    b.textContent = label;
    b.setAttribute('aria-pressed', String(document.documentElement.dataset.skin === id));
    b.addEventListener('click', () => applySkin(id));
    picker.appendChild(b);
  }
  FoafOS.skins = SKINS.map(s => s[0]);
  FoafOS.setSkin = applySkin;

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

    // Guests embedded in the story flow are windows too. They were
    // invisible here, which is what "multiply instantiated yet only show
    // up as one in the window list" actually meant: the list only ever
    // showed the ONE full-window game. Every running instance now has an
    // id, so every one of them can be named — two copies of the same
    // widget are two rows, not one.
    const embedded = [...(mg?.instances?.values?.() || [])].filter(i => i.kind === 'inline');
    if (embedded.length) {
      nodes.push({
        id: 'embedded', icon: '🪟', label: 'In the story', badge: String(embedded.length),
        children: embedded.map((inst) => {
          const info = mg.minigameInfo?.[inst.type] || {};
          return {
            id: `inst:${inst.id}`,
            icon: info.icon || '🎮',
            label: `${info.title || inst.type} · ${inst.id}`,
            actions: [{ id: 'close', icon: '✕', label: 'Close' }],
          };
        }),
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
    } else if (id.startsWith('inst:')) {
      // scroll the embedded guest into view and mark it — with two
      // copies of one widget on screen, "which one did I just pick" is
      // the whole question the list has to answer
      const inst = window.FinkMinigames?.instances?.get(id.slice(5));
      const el = inst && document.getElementById(inst.containerId);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('inline-minigame-located');
        setTimeout(() => el.classList.remove('inline-minigame-located'), 1600);
        setDrawer(false);
      }
    }
  });
  shelfTree.addEventListener('tree-action', (e) => {
    const { action, id } = e.detail;
    if (action !== 'close') return;
    if (id.startsWith('win:')) winById(id)?.remove();
    else if (id.startsWith('inst:')) {
      const inst = window.FinkMinigames?.instances?.get(id.slice(5));
      if (inst) window.FinkMinigames._closeInlineMinigame(inst.containerId, false);
    }
  });
  // ── sound + apps controls ────────────────────────────────────────
  const volEl = $('#foafos-vol');
  const volOut = $('#foafos-vol-out');
  const muteEl = $('#foafos-mute');
  const noteEl = $('#foafos-audio-note');
  const paintAudio = () => {
    const c = audio.coverage();
    volEl.value = String(Math.round(audio.volume * 100));
    volOut.textContent = audio.muted ? 'muted' : `${Math.round(audio.volume * 100)}%`;
    muteEl.textContent = audio.muted ? '🔇' : '🔊';
    muteEl.setAttribute('aria-pressed', String(audio.muted));
    // Say what we CANNOT reach. A mute button that silences three of four
    // sources and pretends otherwise is worse than one that admits it.
    noteEl.textContent = c.uncovered.length
      ? `${c.uncovered.join(', ')} ${c.uncovered.length === 1 ? 'has' : 'have'} its own sound — the shell cannot turn it down`
      : `${c.governed} source${c.governed === 1 ? '' : 's'} under control`;
  };
  volEl.addEventListener('input', () => audio.setVolume(volEl.value / 100));
  muteEl.addEventListener('click', () => audio.toggleMute());
  bus.subscribe('audio.volume', paintAudio);
  paintAudio();

  $('#foafos-home-btn').addEventListener('click', () => { openHome(); setDrawer(false); });
  $('#foafos-switch-btn').addEventListener('click', () => { openSwitcher(); setDrawer(false); });

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
    // Fit the screen, then cascade inside it. A fixed 380px window with a
    // cascade offset put its right edge 26-98px past a 390px phone, and
    // what lives on that edge is the close ✕ and, in Maker, the SET
    // button — unreachable, with no scroll to bring them back because the
    // window is position:fixed. Desktop is unchanged; the clamp only
    // bites when the window would not fit.
    const winW = Math.min(w, window.innerWidth - 16);
    const winH = Math.min(h, window.innerHeight - 80);
    const clamp = (v, max) => Math.max(8, Math.min(v, max));
    win.style.width = `${winW}px`;
    win.style.height = `${winH}px`;
    win.style.left = `${clamp(12 + (widgetSeq % 5) * 24, window.innerWidth - winW - 8)}px`;
    win.style.top = `${clamp(60 + (widgetSeq % 5) * 24, window.innerHeight - winH - 8)}px`;
    // Real window controls, uniform across every floated app — minimize
    // (collapse to the bar), maximize (fill the viewport, toggling back to
    // the saved geometry), close. Before this, an app window offered only
    // ✕: no way to get it out of the way without killing it, and no way to
    // give it the whole screen — the gap the field report named.
    win.innerHTML = `
      <div class="foafos-window-bar"><span>${title}</span>
        <span class="foafos-window-controls">
          <button type="button" class="foafos-window-btn foafos-window-min" aria-label="Minimize ${title}" aria-pressed="false" title="Minimize">–</button>
          <button type="button" class="foafos-window-btn foafos-window-max" aria-label="Maximize ${title}" aria-pressed="false" title="Maximize">▢</button>
          <button type="button" class="foafos-window-btn foafos-window-close" aria-label="Close ${title}" title="Close">✕</button>
        </span></div>`;

    win.querySelector('.foafos-window-close').addEventListener('click', () => win.remove());

    const minBtn = win.querySelector('.foafos-window-min');
    minBtn.addEventListener('click', () => {
      const min = win.classList.toggle('minimized');
      if (min) win.classList.remove('maximized');
      minBtn.setAttribute('aria-pressed', String(min));
    });

    const maxBtn = win.querySelector('.foafos-window-max');
    let restore = null;
    const setMax = (on) => {
      win.classList.toggle('maximized', on);
      if (on) {
        win.classList.remove('minimized');
        minBtn.setAttribute('aria-pressed', 'false');
      } else if (restore) {
        Object.assign(win.style, restore);
      }
      maxBtn.setAttribute('aria-pressed', String(on));
      maxBtn.textContent = on ? '❐' : '▢';
    };
    maxBtn.addEventListener('click', () => {
      if (!win.classList.contains('maximized')) {
        restore = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        setMax(true);
      } else {
        setMax(false);
      }
    });

    // A phone is not a desktop. Floating a 380px window over a 390px
    // screen leaves a dead frame of pixels around a cramped box — the
    // desktop metaphor at exactly the size where it stops paying rent.
    // Small viewports open maximized; the ❐ button restores the floating
    // geometry (kept in `restore`) for anyone who wants the cascade.
    if (window.innerWidth < 520) {
      restore = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
      setMax(true);
    }

    const bar = win.querySelector('.foafos-window-bar');
    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      if (win.classList.contains('maximized')) return;   // restore first to move
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

  // ── HOME: the app grid ────────────────────────────────────────────
  // The affordance every device has had for twenty years: a page of
  // labelled icons, grouped, that opens things. Office, games and media
  // in ONE grid, opened the same way, because the shell does not know
  // which is which — that is the whole claim being tested.
  function openHome() {
    const existing = document.getElementById('foafos-home');
    if (existing) { existing.remove(); return null; }
    const home = document.createElement('div');
    home.id = 'foafos-home';
    home.className = 'foafos-overlay';
    home.setAttribute('role', 'dialog');
    home.setAttribute('aria-modal', 'true');
    home.setAttribute('aria-label', 'All apps');
    home.innerHTML = `<div class="foafos-overlay-head">
        <h2>Apps</h2>
        <button type="button" class="foafos-overlay-close" aria-label="Close apps">✕</button>
      </div><div class="foafos-home-body"></div>`;
    const body = home.querySelector('.foafos-home-body');

    // Only what this INSTALLATION offers. The picker used to list every
    // app in the registry regardless of root, so an office installation
    // showed games it would then refuse to launch — an icon you can
    // press that does nothing is worse than no icon.
    for (const fam of appsByFamily()) {
      const offered = fam.apps.filter(a => rootOffers(ROOT, a.id));
      if (!offered.length) continue;
      const sec = document.createElement('section');
      sec.innerHTML = `<h3>${fam.icon} ${fam.label}</h3>`;
      const grid = document.createElement('div');
      grid.className = 'foafos-app-grid';
      grid.setAttribute('role', 'list');
      for (const app of offered) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'foafos-app';
        b.setAttribute('role', 'listitem');
        b.dataset.app = app.id;
        b.innerHTML = `<span class="ico" aria-hidden="true">${app.icon}</span><span class="nm"></span>`;
        b.querySelector('.nm').textContent = app.name;
        if (app.desc) b.title = app.desc;
        // Chrome is furniture, not a launch: there is one of it and the
        // press turns it off and on. A toggle that looks like a launcher
        // is a small lie, so it says which it is, and to a screen reader
        // as well as on screen.
        const isChrome = app.surface === 'chrome';
        const chromeOn = isChrome && FoafOS.chrome.isMounted(app.id);
        if (isChrome) {
          b.classList.add('chrome-toggle');
          b.setAttribute('aria-pressed', String(chromeOn));
          b.classList.toggle('on', chromeOn);
        }
        b.setAttribute('aria-label',
          `${app.name}${app.desc ? ` — ${app.desc}` : ''}${isChrome ? (chromeOn ? ', on' : ', off') : ''}`);
        b.addEventListener('click', () => {
          launchApp(app.id);
          // A toggle that closes the panel it lives in cannot be pressed
          // twice; a launcher that leaves it open buries the thing it
          // just opened.
          if (isChrome) { home.remove(); openHome(); } else { home.remove(); }
        });
        grid.appendChild(b);
      }
      sec.appendChild(grid);
      body.appendChild(sec);
    }
    home.querySelector('.foafos-overlay-close').addEventListener('click', () => home.remove());
    home.addEventListener('keydown', (e) => { if (e.key === 'Escape') home.remove(); });
    document.body.appendChild(home);
    home.querySelector('.foafos-app')?.focus();
    bus.publish('ui.home', { summary: 'Apps opened' });
    return home;
  }
  FoafOS.openHome = openHome;

  // ── the service inventory ─────────────────────────────────────────
  // Some capabilities are not a flag on an app but a SERVICE the shell
  // provides and mediates — the window manager, audio, input. Others are
  // device powers the browser guards (camera, microphone, location, GPU,
  // cast) that nothing here brokers yet.
  //
  // Listing both, with honest status, is the point. A capability
  // vocabulary that quietly contains names nothing implements is how you
  // end up believing a boundary exists. `state` is one of:
  //   brokered      a real broker mediates it, per app
  //   shell         the shell owns it; apps ask via verbs, never directly
  //   unimplemented named in the vocabulary, nothing behind it yet
  const SERVICES = [
    { id: 'storage', label: 'Storage', state: 'brokered',
      provider: 'FoafStore', note: 'per-app namespace, quota, audit; local backend today' },
    { id: 'secrets', label: 'Secrets', state: 'brokered',
      provider: 'FoafSecrets', note: 'put and use, never get; sealed only with a session passphrase' },
    { id: 'ops', label: 'Brokered actions', state: 'brokered',
      provider: 'FoafOps', note: 'git.commit, s3.put, solid.put — the app names the outcome, the grant names the destination' },
    { id: 'vars', label: 'Story variables', state: 'brokered',
      provider: 'FoafVars', note: 'shared economy vs private, dreams read-only' },
    { id: 'audio', label: 'Audio', state: 'brokered',
      provider: 'FoafAudio', note: 'master level; reports what it cannot reach' },
    { id: 'input', label: 'Input', state: 'brokered',
      provider: 'FoafInput', note: 'pad + keyboard + gamepad, normalized' },
    { id: 'wm', label: 'Window manager', state: 'shell',
      provider: 'FinkWM', note: 'geometry is the shell\'s alone; apps get resized' },
    { id: 'announce', label: 'Announcements', state: 'shell',
      provider: 'foafos-announcer', note: 'pooled live region' },
    { id: 'geolocation', label: 'Location', state: 'unimplemented',
      provider: null, note: 'iframe allow= only; no broker, no prompt of ours' },
    { id: 'capture', label: 'Camera / microphone', state: 'unimplemented',
      provider: null, note: 'nothing requests or mediates getUserMedia' },
    { id: 'gpu', label: 'GPU', state: 'unimplemented',
      provider: null, note: 'WebGL/WebGPU go straight to the browser, unmediated' },
    { id: 'cast', label: 'Cast / external display', state: 'unimplemented',
      provider: null, note: 'no Presentation or Remote Playback wiring' },
  ];
  FoafOS.services = () => SERVICES.map(s => ({
    ...s,
    holders: (window.__foafAppRegistry || []).filter(
      a => (a.capabilities || []).includes(s.id)).map(a => a.id),
  }));

  // Say out loud which apps still run with ambient authority. The whole
  // point of naming `same-origin` as a capability instead of hard-coding
  // it into the launcher is that it can be COUNTED — a boundary nobody
  // can see is a boundary nobody maintains. Same reasoning as the volume
  // control's "X cannot be turned down".
  function refreshCaps() {
    const el = document.getElementById('foafos-caps-note');
    if (!el) return;
    const ambient = ambientApps();
    const unimplemented = SERVICES.filter(s => s.state === 'unimplemented').map(s => s.label);
    el.textContent = ambient.length
      ? `${ambient.length} app(s) run with ambient authority: ${ambient.map(a => a.name).join(', ')} — ` +
        `they reach the shell's own origin, so the brokers are advisory for them.`
      : 'every app is sandboxed to an opaque origin; nothing has ambient authority.';
    // and be straight about the vocabulary that is only a vocabulary
    if (unimplemented.length) {
      el.textContent += ` Not brokered by us: ${unimplemented.join(', ')}.`;
    }
    // The narrative runtime is the host page, so a story's capability
    // list describes what it can do and constrains nothing. Saying so is
    // the difference between a known gap and a false sense of one.
    const unenforced = unenforcedApps();
    if (unenforced.length) {
      el.textContent += ` Stories run in the shell itself, so for ` +
        `${unenforced.map(a => a.name).join(', ')} the list below is a description, not a limit.`;
    }
    el.classList.toggle('error', ambient.length > 0);
  }
  FoafOS.refreshCaps = refreshCaps;
  refreshCaps();

  // ONE launch path, ONE class of thing. `surface` decides where an app is
  // drawn; `capabilities` decide what it may do. Those are independent —
  // being drawn in a window never granted authority, though it used to.
  function launchApp(id, opts = {}) {
    const app = appById(id);
    if (!app) return null;
    const caps = app.capabilities || [];
    // Chrome is furniture: there is only ever one of it, so launching it
    // TOGGLES rather than opening a second. (Everything below — the
    // attenuation check, the store grant — already happened for it at
    // boot, in mountChrome.)
    if (app.surface === 'chrome') {
      if (!rootOffers(ROOT, app.id)) {
        bus.publish('app.launch.refused', {
          summary: `${app.name} is not part of the ${ROOT.label} installation`,
          id, root: ROOT.id,
        });
        return null;
      }
      if (FoafOS.chrome.isMounted(id)) { unmountChrome(id); return null; }
      return mountChrome(app);
    }
    // Does this installation even offer it? A webtv root has no business
    // launching a spreadsheet, and the manifest is where that is said.
    if (!rootOffers(ROOT, app.id)) {
      bus.publish('app.launch.refused', {
        summary: `${app.name} is not part of the ${ROOT.label} installation`,
        id, root: ROOT.id,
      });
      return null;
    }
    // ATTENUATION. The node is created under its parent (root unless a
    // spawning app said otherwise), and the tree refuses any capability
    // the parent does not itself hold. This is what makes handing out
    // `launch` safe: an app cannot mint a more powerful app than itself.
    const parentId = opts.parentId || FoafOS.rootNode?.id || null;
    const node = apps.spawn({
      appId: app.id, parentId, capabilities: caps,
      label: app.name, surface: app.surface,
    });
    if (node.refused) {
      bus.publish('app.launch.refused', {
        summary: node.summary || `${app.name} refused: ${node.reason}`,
        id, reason: node.reason, excess: node.excess,
      });
      return null;
    }
    bus.publish('app.launch', {
      summary: `Opening ${app.name}`, id, surface: app.surface,
      capabilities: node.capabilities, instance: node.id, parentId,
    });
    // Every app gets a storage namespace it cannot name its way out of.
    // Granting is per-app and explicit: no capability, no snapshot.
    store.grant(app.id, caps);
    // …and a secrets namespace, on a SEPARATE capability, so an app that
    // may keep preferences does not thereby get to keep credentials.
    secrets.grant(app.id, caps);
    // Verb grants are TWO conditions, both required. The app tree must have
    // granted the capability (so attenuation still bounds it — a child
    // cannot be aimed at a repo its parent may not write), AND a scope must
    // have been configured saying where it points. Either alone is refused:
    // an unaimed verb must not act, and a configured scope for a capability
    // the tree denied must not resurrect it.
    aimVerbsFor(app.id, node.capabilities || caps);

    switch (app.surface) {
      case 'stage':
        window.FinkMinigames?.startMinigame(app.game, 'normal');
        return null;
      case 'story':
        window.FinkPlayer?.loadFinkStory?.(app.url);
        return null;
      case 'panel':
        // Shell-native: drawn by the shell, so there is no frame and no
        // boundary. Kept in one registry for discovery, not for security.
        if (app.panel === 'maker') return openMaker();
        if (app.panel === 'logger') return openLogger();
        if (app.panel === 'publishing') return openPublishing();
        return null;
      case 'window':
      default: {
        // Size to the screen, not to a constant. 380×460 was tuned for a
        // phone; on a 1280×800 desktop it floated a keyhole in a sea of
        // black — edot at postcard size in an installation whose point is
        // writing documents. Apps get ~55vw × ~72vh, bounded so a phone
        // still gets the compact float (which auto-maximizes anyway) and a
        // huge monitor is not wallpapered edge to edge.
        const appW = Math.min(720, Math.max(380, Math.round(window.innerWidth * 0.55)));
        const appH = Math.min(680, Math.max(460, Math.round(window.innerHeight * 0.72)));
        const win = makeWindow(`${app.icon} ${app.name}`, appW, appH);
        const frame = document.createElement('iframe');
        frame.title = app.name;
        frame.setAttribute('sandbox', sandboxFor(app));
        // Permissions-Policy delegation. A sandboxed frame has an opaque
        // origin, which is NOT `self`, so any feature default-scoped to self
        // — autoplay, geolocation — is DENIED inside it unless the parent
        // grants it here. A media app whose iframe lacks `autoplay` can
        // register a MediaSession and look like it is playing while the OS
        // (iOS especially) keeps it silent, so every `audio` app gets it.
        const allow = [];
        if (caps.includes('geolocation')) allow.push('geolocation');
        if (caps.includes('audio')) allow.push('autoplay');
        if (allow.length) frame.allow = allow.join('; ');
        frame.style.cssText = 'flex:1;width:100%;border:0;min-height:0;';
        // src AFTER sandbox/allow — a frame that starts loading before its
        // sandbox is set would run its first script under the wrong rules.
        frame.src = app.url;
        win.appendChild(frame);
        document.body.appendChild(win);
        governAppFrame(frame, app, win);
        // Closing the node takes the window with it — and because close
        // cascades, closing whatever spawned this closes it too.
        node.onClose = () => win.remove();
        win.dataset.instance = node.id;
        return win;
      }
    }
  }
  FoafOS.launchApp = launchApp;

  // The sandbox an app gets, derived from its declared capabilities.
  //
  // `allow-scripts` alone yields an OPAQUE ORIGIN: no parent.document, no
  // shared storage, no reaching another app. That is the default and the
  // goal for everything.
  //
  // `same-origin` is the declared escape hatch for apps not yet moved off
  // ambient localStorage/indexedDB. It is genuinely dangerous — it puts
  // the app in the shell's own origin, where every broker becomes
  // advisory — so it is named in the registry, announced on the bus, and
  // listed in the drawer. It should trend to zero.
  function sandboxFor(app) {
    const caps = app.capabilities || [];
    const tokens = ['allow-scripts', 'allow-forms', 'allow-modals'];
    if (caps.includes('same-origin')) {
      tokens.push('allow-same-origin', 'allow-popups');
      bus.publish('sys.app.ambient', {
        summary: `${app.name} runs with ambient authority (same-origin)`,
        id: app.id, capabilities: caps,
      });
    }
    return tokens.join(' ');
  }
  FoafOS.sandboxFor = sandboxFor;

  // An app window is not a minigame, so none of FinkMinigames' guest
  // plumbing reaches it — and the first version of this shipped a
  // channel player the master volume could not touch. The same probe
  // applies: offer, listen, and register the app as governed or as
  // ungovernable depending on whether it answers.
  function governAppFrame(frame, app, win) {
    const sinkId = `app:${app.id}:${win.dataset.wid}`;
    const caps = app.capabilities || [];
    // Only apps that make noise get a coverage placeholder. Listing
    // silent ones would drown the disclosure in spreadsheets.
    if (!app.silent) audio.register(sinkId, () => {}, { label: app.name, kind: 'uncontrollable' });

    // Window apps are bus citizens too — same scoped view, same wire
    // protocol as stage guests and <foafos-guest> widgets. A TV widget
    // is an app; it speaks in its own namespace and hears the shell
    // surfaces that shape it.
    const busGrants = app.bus || {
      publish: [`app.${app.id}.*`],
      subscribe: ['wm.mode', 'audio.volume', 'ui.skin'],
    };
    const busName = `${app.id}#${win.dataset.wid}`;
    const scoped = scopeBus(bus, { name: busName, ...busGrants });
    scoped.subscribe('*', (e) => {
      if (e.source === `guest:${busName}`) return;
      try { frame.contentWindow?.postMessage({ type: 'bus-event', event: e }, '*'); }
      catch (err) { /* closed */ }
    });

    const onMsg = (e) => {
      if (e.source !== frame.contentWindow) return;      // provenance, always
      const d = e.data;
      if (!d || typeof d.type !== 'string') return;

      // ── the app protocol ──────────────────────────────────────────
      // An app that loads app-sdk.js says hello; we answer with its id,
      // its capabilities and its whole stored keyspace, so its
      // synchronous localStorage shim is warm before its first line runs.
      if (d.type === 'app.hello') {
        const snapshot = store.snapshot(app.id);
        try {
          frame.contentWindow?.postMessage({
            type: 'app.init', appId: app.id, capabilities: caps,
            store: snapshot || {},
            config: { surface: app.surface, name: app.name },
          }, '*');
        } catch (err) { /* closed */ }
        bus.publish('sys.app.ready', {
          summary: `${app.name} speaks the app protocol`,
          id: app.id, capabilities: caps, storage: !!snapshot,
        });
        return;
      }
      // Writes are PROPOSALS. The broker checks the capability and the
      // quota, and refuses in the open — the app already applied it to
      // its own in-memory view, so a refusal is reported rather than
      // silently diverging.
      if (d.type === 'store.set' || d.type === 'store.remove' || d.type === 'store.clear') {
        const r = d.type === 'store.set' ? store.set(app.id, d.key, d.value)
                : d.type === 'store.remove' ? store.remove(app.id, d.key)
                : store.clear(app.id);
        if (!r.ok) {
          try {
            frame.contentWindow?.postMessage({ type: 'store.refused', op: d.type, key: d.key, reason: r.reason }, '*');
          } catch (err) { /* closed */ }
        }
        return;
      }

      // Secrets travel the same way — as PROPOSALS — but only one
      // direction. There is no `secrets.get`, and a guest that asks is
      // answered with the reason rather than ignored.
      if (d.type === 'secrets.put' || d.type === 'secrets.forget' || d.type === 'secrets.names') {
        const reply = (payload) => {
          try { frame.contentWindow?.postMessage(payload, '*'); } catch (err) { /* closed */ }
        };
        if (d.type === 'secrets.names') {
          reply({ type: 'secrets.names.result', rid: d.rid, names: secrets.names(app.id) });
          return;
        }
        const r = d.type === 'secrets.put'
          ? secrets.put(app.id, d.name, d.value)
          : secrets.forget(app.id, d.name);
        if (r.ok) secrets.flush();       // re-seal if we are sealed at all
        reply({ type: 'secrets.result', rid: d.rid, op: d.type, name: d.name,
                ok: r.ok, reason: r.reason, sealed: secrets.sealed });
        return;
      }
      // A VERB is the other half of secrets: the app names an outcome and
      // the shell performs it. Note what is NOT here — the app sends a verb
      // NAME and data, never a function and never a host. `ops` decides
      // what the name means and where it points; an unknown or unaimed verb
      // is refused with a reason.
      if (d.type === 'verb') {
        ops.invoke(app.id, d.verb, d.detail || {}).then((r) => {
          try {
            frame.contentWindow?.postMessage({ type: 'verb.result', rid: d.rid, verb: d.verb, ...r }, '*');
          } catch (err) { /* closed */ }
        });
        return;
      }
      if (d.type === 'verbs.list') {
        try {
          frame.contentWindow?.postMessage({
            type: 'verbs.result', rid: d.rid,
            // Only what this app may actually call, and its destination —
            // an app has no business enumerating another's grants.
            verbs: ops.list().filter(o => ops.can(app.id, o.verb)).map(o => ({
              verb: o.verb, capability: o.capability, secret: o.secret, note: o.note,
            })),
          }, '*');
        } catch (err) { /* closed */ }
        return;
      }
      if (d.type === 'secrets.get') {
        try {
          frame.contentWindow?.postMessage({
            type: 'secrets.refused', rid: d.rid, op: 'get', name: d.name,
            reason: 'not-readable',
            hint: 'secrets cannot be read back — ask the shell to use one instead',
          }, '*');
        } catch (err) { /* closed */ }
        bus.publish('secrets.denied', {
          summary: `${app.name} tried to READ a secret — refused by design`,
          appId: app.id, name: d.name, op: 'get',
        });
        return;
      }
      if (d.type === 'bus-publish') {
        scoped.publish(String(d.topic || ''), d.data);
        return;
      }

      if (d.type !== 'conformance') return;
      if (!(d.contracts || []).includes('audio')) return;
      audio.unregister(sinkId);
      audio.register(sinkId, (level) => {
        try {
          frame.contentWindow?.postMessage({ type: 'audio-level', level,
            volume: audio.volume, muted: audio.muted }, '*');
        } catch (err) { /* closed */ }
      }, { label: app.name, kind: 'app' });
      bus.publish('sys.guest.conformance', {
        summary: `${app.name} speaks: audio`, id: app.id, contracts: d.contracts,
      });
    };
    window.addEventListener('message', onMsg);

    // Offer the contract. An app using minigame-sdk.js answers as soon as
    // it calls onAudio; one that never does keeps its own sound and is
    // reported as such.
    const offer = () => {
      try {
        frame.contentWindow?.postMessage({ type: 'init', config: {
          mode: 'window', contracts: ['audio'],
          audio: { level: audio.level, volume: audio.volume, muted: audio.muted },
          bus: busGrants,
        }, variables: {} }, '*');
      } catch (err) { /* not ready */ }
    };
    frame.addEventListener('load', offer);
    setTimeout(offer, 400);

    // Clean up with the window, or a closed app keeps a sink registered
    // and the coverage count lies.
    new MutationObserver((_, obs) => {
      if (!win.isConnected) {
        window.removeEventListener('message', onMsg);
        audio.unregister(sinkId);
        scoped.close();
        obs.disconnect();
      }
    }).observe(document.body, { childList: true });
  }

  // ── SWITCHER: recents ─────────────────────────────────────────────
  // Alt-Tab on a desktop, the square button on Android, a double-tap of
  // Home on a phone, the source list on a TV. One list of what is
  // running, one keypress to move between them.
  function openSwitcher() {
    const old = document.getElementById('foafos-switcher');
    if (old) { old.remove(); return null; }
    const running = collectRunning();
    const sw = document.createElement('div');
    sw.id = 'foafos-switcher';
    sw.className = 'foafos-overlay';
    sw.setAttribute('role', 'dialog');
    sw.setAttribute('aria-modal', 'true');
    sw.setAttribute('aria-label', 'Running apps');
    // Count furniture separately. Chrome apps really are running apps and
    // belong in this list, but "Running 4" when the player has one story
    // open and three status bars is a true number that reads as a wrong
    // one.
    const chromeCount = running.filter(r => r.node?.surface === 'chrome').length;
    const tally = chromeCount
      ? `${running.length - chromeCount} + ${chromeCount} chrome`
      : String(running.length);
    sw.innerHTML = `<div class="foafos-overlay-head">
        <h2>Running <span class="hint">${tally}</span></h2>
        <button type="button" class="foafos-overlay-close" aria-label="Close switcher">✕</button>
      </div><div class="foafos-switch-cards" role="list"></div>`;
    const cards = sw.querySelector('.foafos-switch-cards');
    if (!running.length) {
      cards.innerHTML = '<p class="hint">Nothing else is running. Open something from Apps.</p>';
    }
    // Rows are the TREE, indented — because "5 running" meaning five
    // unrelated things is a different fact from five things where four
    // were opened by the first, and only one of those is true.
    for (const r of running) {
      const row = document.createElement('div');
      row.className = 'foafos-switch-row';
      row.setAttribute('role', 'listitem');
      row.style.setProperty('--depth', String(r.depth || 0));

      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'foafos-switch-card';
      c.innerHTML = `<span class="ico" aria-hidden="true">${r.icon}</span>
        <span class="ttl"></span><span class="sub"></span>`;
      c.querySelector('.ttl').textContent = r.label;
      c.querySelector('.sub').textContent = r.detail || '';
      c.setAttribute('aria-label',
        `${r.label}${r.detail ? `, ${r.detail}` : ''}${r.depth ? `, opened by ${r.parentLabel}` : ''}`);
      c.addEventListener('click', () => { r.focus(); sw.remove(); });
      row.appendChild(c);

      // Suspend and close act on the SUBTREE. The label says how many
      // go with it, because "close" taking three things by surprise is
      // the failure mode of every grouped-window UI ever shipped.
      if (r.node) {
        const kin = FoafOS.apps.descendants(r.node.id).length;
        const withKin = kin ? ` and ${kin} beneath it` : '';

        const sus = document.createElement('button');
        sus.type = 'button';
        sus.className = 'foafos-switch-act';
        sus.textContent = r.node.suspended ? '▶' : '⏸';
        sus.setAttribute('aria-label',
          `${r.node.suspended ? 'Resume' : 'Suspend'} ${r.label}${withKin}`);
        sus.addEventListener('click', (e) => {
          e.stopPropagation();
          setSubtreeSuspended(r.node.id, !r.node.suspended);
          sw.remove(); openSwitcher();
        });

        const kill = document.createElement('button');
        kill.type = 'button';
        kill.className = 'foafos-switch-act danger';
        kill.textContent = '✕';
        const loss = r.node.surface === 'stage'
          ? (snapshotNote() === 'keeps its place' ? ', its place is kept' : ', its state is lost')
          : '';
        kill.setAttribute('aria-label', `Close ${r.label}${withKin}${loss}`);
        kill.addEventListener('click', (e) => {
          e.stopPropagation();
          FoafOS.apps.close(r.node.id);
          sw.remove(); openSwitcher();
        });
        row.append(sus, kill);
      }
      cards.appendChild(row);
    }
    sw.querySelector('.foafos-overlay-close').addEventListener('click', () => sw.remove());
    sw.addEventListener('keydown', (e) => { if (e.key === 'Escape') sw.remove(); });
    document.body.appendChild(sw);
    cards.querySelector('button')?.focus();
    bus.publish('ui.switcher', { summary: `Switcher: ${running.length} running` });
    return sw;
  }
  FoafOS.openSwitcher = openSwitcher;

  // Everything running, AS THE TREE. This used to poll every subsystem
  // that had its own idea of a window — the story, the minigame host's
  // instance map, the DOM's floating windows — and flatten the answers
  // into a list. The tree is now the truth, so this reads it instead;
  // the per-surface knowledge that survives is only about how to FOCUS
  // a thing, which really is presentation.
  function collectRunning() {
    const out = [];
    const walk = (node, depth, parentLabel) => {
      // Furniture last. Chrome spawns at boot so it is oldest, and the
      // tree keeps spawn order — which would put three status bars above
      // the story the player is actually in. Ordering is presentation,
      // and this is the presentation layer.
      const kids = [...FoafOS.apps.children(node.id)].sort(
        (a, b) => (a.surface === 'chrome' ? 1 : 0) - (b.surface === 'chrome' ? 1 : 0));
      for (const child of kids) {
        const app = appById(child.appId);
        out.push({
          node: child, depth, parentLabel,
          icon: app?.icon || (child.surface === 'story' ? '📖' : '🪟'),
          label: child.label,
          detail: [
            child.surface,
            child.suspended ? 'suspended' : '',
            child.surface === 'stage' ? (window.FinkWM?.mode || '') : '',
            // Say, BEFORE the ✕ is pressed, whether pressing it throws
            // the game away. The shell cannot serialise an opaque
            // origin, so this is not a promise it can make on the
            // guest's behalf — only a report of whether the guest
            // agreed to the snapshot contract.
            child.surface === 'stage' ? snapshotNote() : '',
            child.surface === 'story' && window.FinkInkEngine?.storyStack?.length
              ? `dream depth ${FinkInkEngine.storyStack.length}` : '',
          ].filter(Boolean).join(' · '),
          focus: () => focusNode(child),
        });
        walk(child, depth + 1, child.label);
      }
    };
    if (FoafOS.rootNode) walk(FoafOS.rootNode, 0, FoafOS.root?.label || 'root');
    return out;
  }

  // Does the game currently on the stage speak `snapshot`? An inline
  // game has no guest frame to ask, so it answers no — accurately, since
  // nothing is asking it either.
  function snapshotNote() {
    const mg = window.FinkMinigames;
    if (!mg) return '';
    return mg.windowInstance?.contracts?.has('snapshot')
      ? 'keeps its place' : 'closing loses it';
  }

  // How to bring a node to the front, per surface. Presentation only.
  function focusNode(node) {
    if (node.surface === 'stage') { window.FinkWM?.setMode('full'); return; }
    // Furniture cannot be raised — it is already there, possibly in a
    // corner the player was not looking at. Point at it instead.
    if (node.surface === 'chrome') {
      const el = document.getElementById(appById(node.appId)?.mount || '');
      if (!el) return;
      el.classList.add('foafos-chrome-flash');
      setTimeout(() => el.classList.remove('foafos-chrome-flash'), 1400);
      return;
    }
    if (node.surface === 'story') {
      if (window.FinkWM?.active && window.FinkWM.mode === 'full') window.FinkWM.setMode('split');
      return;
    }
    const win = document.querySelector(`.foafos-window[data-instance="${node.id}"]`);
    if (win) {
      document.querySelectorAll('.foafos-window').forEach(w => { w.style.zIndex = 2620; });
      win.style.zIndex = 2630;
      win.scrollIntoView({ block: 'nearest' });
    }
  }

  // Suspending a subtree must actually reach the things in it: a flag
  // nobody acts on is the same bug as a capability nobody enforces.
  function setSubtreeSuspended(id, suspended) {
    const ids = FoafOS.apps.setSuspended(id, suspended);
    for (const nid of ids) {
      const node = FoafOS.apps.get(nid);
      if (!node) continue;
      if (node.surface === 'stage' && window.FinkMinigames) {
        // the guest's own pause verb if it declared one, else the shell's
        try { window.FinkMinigames.togglePause?.(suspended); } catch (e) { /* no game */ }
      }
      const win = document.querySelector(`.foafos-window[data-instance="${nid}"]`);
      const frame = win?.querySelector('iframe');
      if (frame) {
        try {
          frame.contentWindow?.postMessage({ type: suspended ? 'app.suspend' : 'app.resume' }, '*');
        } catch (e) { /* closed */ }
        win.classList.toggle('suspended', suspended);
      }
    }
    return ids;
  }
  FoafOS.setSubtreeSuspended = setSubtreeSuspended;

  // Keyboard: the two shortcuts every desktop already trains people on.
  // Not captured while typing — a text field must keep its keys.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.altKey && e.key === 'Tab') { e.preventDefault(); openSwitcher(); }
    else if (e.altKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); openHome(); }
    else if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); audio.toggleMute(); }
  });

  // ── the Maker window: the creator's x-ray of the delivery engine ──
  // Zoom out: the dream stack + story state. Zoom mid: every live story
  // variable, editable (the currency of story↔minigame linkage). Zoom
  // in: a live tap of the minigame SDK protocol. All from standard
  // widgets — foaf-table, foafos-feed — so it stays skinnable/pooled.
  const makerBtn = document.createElement('button');
  makerBtn.type = 'button';
  makerBtn.className = 'foafos-chip';
  makerBtn.textContent = '🔧 Maker';
  makerBtn.addEventListener('click', () => { openMaker(); setDrawer(false); });
  launcher.appendChild(makerBtn);

  function storyVarRows() {
    const vs = window.FinkInkEngine?.story?.variablesState;
    if (!vs) return [];
    let names = [];
    try { names = [...vs._globalVariables.keys()]; }
    catch { names = ['diamonds', 'mega_diamonds', 'keys', 'score']; }
    return names.map(n => [n, String(vs[n])]);
  }

  // The governance ledger: the guest's declared capability, then the
  // most recent attempts — allowed and refused. A denial nobody can see
  // looks exactly like a bug in the game.
  function govRows() {
    const v = FoafOS.vars;
    const rows = [];
    const g = window.FinkMinigames?.currentGrants;
    const who = window.FinkMinigames?.currentType;
    if (who && g) {
      rows.push([who, g.write.join(', ') || '(nothing)', 'may write']);
      if (g.read.length) rows.push([who, g.read.join(', '), 'may read']);
    }
    for (const e of v.log.slice(-14).reverse()) {
      rows.push([e.actor, `${e.name} = ${e.value}`,
        e.ok ? (e.depth ? `set · depth ${e.depth}` : 'set') : `DENIED · ${e.reason}`]);
    }
    for (const [n, val] of v.scratch) rows.push(['—', `${n} = ${val}`, 'unbound (no VAR)']);
    return rows;
  }

  // ── the logger ────────────────────────────────────────────────────
  // Everything this shell refuses, denies, attenuates or runs out of
  // quota for is published on the bus and then, until now, seen by
  // nobody. A capability system whose refusals are invisible teaches
  // people that nothing was refused.
  //
  // Deliberately NOT the drawer feed: that is a curated set of topics
  // rendered as friendly cards. This is the firehose, filterable, with
  // refusals coloured — a console, not a notification centre.
  const LOG_MAX = 400;
  const logBuffer = [];
  const isRefusal = (t) => /(refused|denied|quota|unrouted|failed|error|fault|ambient)/.test(t);
  // '*' is this bus's catch-all — '**' matches NOTHING (FoafBus.match
  // handles '*', an exact topic, or a 'prefix.*'), so subscribing with it
  // would have been a logger that silently logged nothing.
  bus.subscribe('*', (e) => {
    logBuffer.push({
      t: e.topic, s: e.data?.summary || '', ts: e.ts || 0,
      src: e.source || 'local', bad: isRefusal(e.topic),
    });
    if (logBuffer.length > LOG_MAX) logBuffer.shift();
    if (document.getElementById('foafos-logger')) renderLog();
  });

  let logFilter = '';
  let logPaused = false;
  function renderLog() {
    const list = document.getElementById('foafos-log-list');
    if (!list || logPaused) return;
    const rows = logBuffer.filter(r => !logFilter || (r.t + ' ' + r.s).includes(logFilter));
    list.textContent = '';
    for (const r of rows.slice(-160)) {
      const li = document.createElement('div');
      li.className = 'foafos-log-row' + (r.bad ? ' bad' : '');
      const topic = document.createElement('span');
      topic.className = 'lt';
      topic.textContent = r.t;
      const summary = document.createElement('span');
      summary.className = 'ls';
      summary.textContent = r.s;
      li.append(topic, summary);
      list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
    const count = document.getElementById('foafos-log-count');
    if (count) {
      const bad = logBuffer.filter(r => r.bad).length;
      count.textContent = `${rows.length}/${logBuffer.length}${bad ? ` · ${bad} refused` : ''}`;
    }
  }

  function openLogger() {
    if (document.getElementById('foafos-logger')) return null;
    const win = makeWindow('📜 Logger', 460, 420);
    win.id = 'foafos-logger';
    // Shell-native panels sit ABOVE app windows. An app's iframe is
    // composited into its own layer, which paints over same-z-index
    // content — so a panel opened on top of an app showed the app's
    // document straight through it. Seen in a screenshot, not in code.
    win.classList.add('foafos-panel');
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:8px;';
    body.innerHTML = `
      <div class="foafos-row">
        <input id="foafos-log-filter" placeholder="filter topics" aria-label="Filter log by topic or text">
        <button type="button" id="foafos-log-pause" aria-pressed="false" aria-label="Pause the log tail">⏸</button>
        <button type="button" id="foafos-log-clear" aria-label="Clear the log">CLEAR</button>
      </div>
      <p class="foafos-sub" id="foafos-log-count" role="status"></p>
      <div id="foafos-log-list" role="log" aria-label="Event log" tabindex="0"></div>`;
    win.appendChild(body);
    document.body.appendChild(win);
    body.querySelector('#foafos-log-filter').addEventListener('input', (e) => {
      logFilter = e.target.value.trim(); renderLog();
    });
    const pause = body.querySelector('#foafos-log-pause');
    pause.addEventListener('click', () => {
      logPaused = !logPaused;
      pause.textContent = logPaused ? '▶' : '⏸';
      pause.setAttribute('aria-pressed', String(logPaused));
      pause.setAttribute('aria-label', logPaused ? 'Resume the log tail' : 'Pause the log tail');
      if (!logPaused) renderLog();
    });
    body.querySelector('#foafos-log-clear').addEventListener('click', () => {
      logBuffer.length = 0; renderLog();
    });
    renderLog();
    bus.publish('ui.logger', { summary: 'Logger opened' });
    return win;
  }
  FoafOS.openLogger = openLogger;

  function openMaker() {
    if (document.getElementById('foafos-maker')) return;
    const win = makeWindow('🔧 Maker', 380, 520);
    win.id = 'foafos-maker';
    win.classList.add('foafos-panel');

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;font:11px monospace;color:#eee;';
    body.innerHTML = `
      <div id="maker-state"></div>
      <div id="maker-clock" role="group" aria-label="Debug clock">
        <button type="button" data-scale="1" aria-label="Run at real time">▶ 1×</button>
        <button type="button" data-scale="0.2" aria-label="Run five times slower">5× slow</button>
        <button type="button" data-scale="0.02" aria-label="Run fifty times slower">50× slow</button>
        <button type="button" data-scale="0" aria-label="Freeze the game">⏸ freeze</button>
        <button type="button" id="maker-step" aria-label="Advance one frame">⏭ step</button>
      </div>
      <div>
        <input id="maker-var" placeholder="variable" aria-label="Variable name" style="width:38%">
        <input id="maker-val" placeholder="value" aria-label="Variable value" style="width:30%">
        <button type="button" id="maker-set">SET</button>
      </div>`;
    win.appendChild(body);

    const vars = document.createElement('foaf-table');
    body.insertBefore(vars, body.querySelector('#maker-clock'));
    // Who is allowed to change what, and every attempt that was refused.
    // Governance you cannot see is governance nobody trusts.
    const gov = document.createElement('foaf-table');
    body.insertBefore(gov, body.querySelector('#maker-clock'));
    const sdk = document.createElement('foafos-feed');
    sdk.bus = bus;
    sdk.setAttribute('topics', 'sys.sdk.*,sys.guest.*,story.state,vars.*,sys.debug');
    body.appendChild(sdk);

    const refresh = () => {
      if (!win.isConnected) return;
      const st = bus.retained('story.state')[0]?.data;
      const stack = window.FinkInkEngine?.storyStack || [];
      const scale = window.FinkMinigames?.debug?.timeScale ?? 1;
      win.querySelector('#maker-state').textContent =
        `story: ${st?.phase || '—'} · depth ${st?.depth ?? 0}` +
        (scale !== 1 ? ` · clock ${scale === 0 ? 'frozen' : `${(1 / scale).toFixed(0)}× slow`}` : '') +
        (stack.length ? ` · stack: ${stack.map(f => f.url.split('/').pop()).join(' ▸ ')}` : '');
      vars.data = { title: 'story variables', columns: ['name', 'value'], rows: storyVarRows() };
      gov.data = { title: 'variable governance', columns: ['actor', 'variable', 'verdict'], rows: govRows() };
    };
    const unsubs = ['story.state', 'story.beat', 'minigame.*', 'vars.*', 'sys.debug']
      .map(t => bus.subscribe(t, refresh));
    new MutationObserver(() => { if (!win.isConnected) unsubs.forEach(u => u()); })
      .observe(document.body, { childList: true });

    win.querySelector('#maker-set').addEventListener('click', () => {
      const name = win.querySelector('#maker-var').value.trim();
      const raw = win.querySelector('#maker-val').value.trim();
      if (!name || !window.FinkInkEngine?.story) return;
      const num = Number(raw);
      window.FinkInkEngine.story.variablesState[name] = Number.isNaN(num) ? raw : num;
      bus.publish('sys.sdk.tx', { summary: `maker set ${name}=${raw}`, msg: 'maker-set' }, { source: 'maker' });
      refresh();
    });

    win.querySelector('#maker-clock').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'maker-step') { window.FinkMinigames?.debug.step(1); return; }
      window.FinkMinigames?.debug.setTimeScale(parseFloat(btn.dataset.scale));
      refresh();
    });

    document.body.appendChild(win);
    refresh();
    return win;
  }
  FoafOS.openMaker = openMaker;

  // ── Publishing: aim an app's verbs, and hold its key ──────────────────
  // Both halves belong to the SHELL, and that is the point of the panel
  // rather than a convenience of it:
  //
  //   · the destination, because an app that could choose its own repo
  //     could aim a working token at any repo that token reaches
  //   · the credential, because a token an app collects is a token an app
  //     has HELD, however briefly, and this way it never touches the guest
  //     at all — not even on the way in
  //
  // Before this existed, `git:write` was a granted, brokered, tested
  // capability that pointed nowhere and had no way for a person to point
  // it. Tested-but-unreachable is worth saying out loud, so the docs did;
  // this is the fix rather than a footnote.
  function openPublishing() {
    if (document.getElementById('foafos-publishing')) return;
    const win = makeWindow('🔑 Publishing', 420, 480);
    win.id = 'foafos-publishing';
    win.classList.add('foafos-panel');

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;'
      + 'flex-direction:column;gap:10px;font:11px monospace;color:#eee;';
    win.appendChild(body);

    // Only apps this installation offers AND that declare a verb capability.
    // An empty list is a real answer, not a broken panel, so it says so.
    const verbCaps = (ops.list() || []).map(o => o.capability);
    const candidates = APPS.filter(a =>
      rootOffers(ROOT, a.id)
      && (a.capabilities || []).some(c => verbCaps.includes(c) && ROOT.capabilities.includes(c)));

    const draw = () => {
      if (!win.isConnected) return;
      body.textContent = '';
      const note = document.createElement('p');
      note.style.cssText = 'margin:0;color:#9ad;line-height:1.5;';
      note.textContent = candidates.length
        ? 'The app asks for an outcome; this is where the outcome goes, and where '
          + 'the key lives. The app never sees either.'
        : `No app in the ${ROOT.label} installation asks for a brokered action.`;
      body.appendChild(note);

      for (const app of candidates) {
        for (const op of ops.list()) {
          if (!(app.capabilities || []).includes(op.capability)) continue;
          const scope = ops.scopeFor(app.id, op.capability);
          const held = (secrets.names(app.id) || []).includes(op.secret);

          const card = document.createElement('section');
          card.style.cssText = 'border:1px solid #345;padding:8px;display:flex;'
            + 'flex-direction:column;gap:6px;';
          const h = document.createElement('h3');
          h.style.cssText = 'margin:0;font:bold 11px monospace;color:#fff;';
          h.textContent = `${app.icon} ${app.name} — ${op.verb}`;
          card.appendChild(h);

          const state = document.createElement('p');
          state.style.cssText = 'margin:0;color:' + (scope && held ? '#8f8' : '#fa6') + ';';
          state.textContent = scope
            ? (held ? `ready — ${scope.repo || scope.bucket || scope.base}`
                    : `aimed at ${scope.repo || scope.bucket || scope.base}, but no key yet`)
            : 'not aimed anywhere, so it is refused';
          card.appendChild(state);

          // git.commit is the only op with a caller, so it is the only one
          // given a form. Inventing forms for s3/solid would put fields on
          // screen that nothing reads — see the note in ops.mjs about a
          // vocabulary that starts lying.
          if (op.verb === 'git.commit') {
            const row = (labelText, id, placeholder, value, type = 'text') => {
              const wrap = document.createElement('label');
              wrap.style.cssText = 'display:flex;gap:6px;align-items:center;';
              wrap.textContent = labelText;
              const input = document.createElement('input');
              input.type = type;
              input.id = `pub-${app.id}-${id}`;
              input.placeholder = placeholder;
              input.value = value || '';
              input.style.cssText = 'flex:1;min-width:0;background:#111;color:#eee;'
                + 'border:1px solid #456;padding:3px;font:11px monospace;';
              if (type === 'password') input.autocomplete = 'off';
              wrap.appendChild(input);
              card.appendChild(wrap);
              return input;
            };
            const repo = row('repo', 'repo', 'owner/name', scope?.repo);
            const branch = row('branch', 'branch', 'main', scope?.branch || 'main');
            const prefix = row('prefix', 'prefix', 'edot/ (optional)', scope?.pathPrefix);
            const key = row('token', 'token', held ? '•••• stored' : 'ghp_…', '', 'password');

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
            const mk = (label, fn) => {
              const b = document.createElement('button');
              b.type = 'button';
              b.textContent = label;
              b.addEventListener('click', fn);
              buttons.appendChild(b);
              return b;
            };
            mk('AIM', () => {
              const r = FoafOS.aimOp(app.id, op.capability, {
                repo: repo.value.trim(), branch: branch.value.trim() || 'main',
                pathPrefix: prefix.value.trim(),
              });
              if (!r.ok) state.textContent = `refused: ${r.detail || r.reason}`;
              else draw();
            });
            mk('HOLD KEY', () => {
              const v = key.value;
              if (!v) return;
              // Straight into the broker. Not stored here, not echoed back,
              // and the field is cleared so it does not sit in the DOM.
              secrets.grant(app.id, app.capabilities || []);
              const r = secrets.put(app.id, op.secret, v);
              key.value = '';
              if (r.ok) secrets.flush();
              draw();
            });
            if (held) mk('FORGET KEY', () => { secrets.forget(app.id, op.secret); draw(); });
            if (scope) mk('UNAIM', () => { FoafOS.unaimOp(app.id); draw(); });
            card.appendChild(buttons);

            const warn = document.createElement('p');
            warn.style.cssText = 'margin:0;color:#888;line-height:1.5;';
            warn.textContent = secrets.sealed
              ? 'Sealed at rest with your session passphrase.'
              : 'No session passphrase, so the key is held for this run only — '
                + 'it is not written to disk in the clear.';
            card.appendChild(warn);
          }
          body.appendChild(card);
        }
      }
    };

    const feed = document.createElement('foafos-feed');
    feed.bus = bus;
    feed.setAttribute('topics', 'ops.*,secrets.*');
    const unsubs = ['ops.*', 'secrets.*'].map(t => bus.subscribe(t, () => draw()));
    new MutationObserver(() => { if (!win.isConnected) unsubs.forEach(u => u()); })
      .observe(document.body, { childList: true });

    document.body.appendChild(win);
    draw();
    body.appendChild(feed);
    return win;
  }
  FoafOS.openPublishing = openPublishing;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildUI);
} else {
  buildUI();
}
