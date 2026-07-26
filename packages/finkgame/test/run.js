// The guest kernel, exercised in Node with a stubbed window.
//
// The SDK is a classic browser script with a CommonJS export guard, so it can
// be require()d here — the browser truth (inside a real sandboxed frame) is
// held by inklet/finkapp/test/e2e-snapshot.mjs and qa-games; THIS suite pins
// the protocol shapes offline, where a regression is cheap to catch.
//
// The stub is deliberately minimal: if the SDK grows a dependency on more of
// `window` than an event listener and a parent to post to, that is a real
// finding about what a guest frame must provide, and this suite should fail.
'use strict';
const assert = require('node:assert/strict');

let fail = 0;
const ok = (name, fn) => {
  try { fn(); console.log(`✔ ${name}`); }
  catch (e) { console.error(`✖ ${name}: ${e.message}`); fail++; }
};

function freshWindow() {
  const listeners = [];
  const sent = [];
  const win = {
    addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); },
    parent: { postMessage: (data) => sent.push(data) },
  };
  win.parent.window = win;               // parent !== window, so posts go out
  win.deliver = (data) => listeners.forEach((fn) => fn({ data }));
  win.sent = sent;
  return win;
}

function boot() {
  const win = freshWindow();
  global.window = win;
  delete require.cache[require.resolve('../src/minigame-sdk.js')];
  const { MinigameSDK } = require('../src/minigame-sdk.js');
  const sdk = new MinigameSDK();
  return { win, sdk };
}
const quiet = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('[MinigameSDK]')) quiet(...a); };

// ── lifecycle ──────────────────────────────────────────────────────────
ok('init delivers config and variables, and only then is the sdk ready', () => {
  const { win, sdk } = boot();
  let got = null;
  sdk.onInit((config, vars) => { got = { config, vars }; });
  assert.equal(sdk.isReady?.() ?? sdk._ready, false);
  win.deliver({ type: 'init', config: { surface: 'stage' }, variables: { diamonds: 3 } });
  assert.deepEqual(got.config, { surface: 'stage' });
  assert.deepEqual(got.vars, { diamonds: 3 });
  assert.equal(sdk._ready, true);
});

ok('a malformed message is ignored, not a crash', () => {
  const { win } = boot();
  win.deliver(null);
  win.deliver({});
  win.deliver({ type: 42 });
});

ok('pause and resume reach their callbacks', () => {
  const { win, sdk } = boot();
  const seen = [];
  sdk.onPause(() => seen.push('pause'));
  sdk.onResume(() => seen.push('resume'));
  win.deliver({ type: 'pause' });
  win.deliver({ type: 'resume' });
  assert.deepEqual(seen, ['pause', 'resume']);
});

// ── the snapshot contract (spec §5.5.4) ────────────────────────────────
ok('registering onSnapshot DECLARES the contract — registration is the reply', () => {
  const { win, sdk } = boot();
  sdk.onSnapshot(() => ({}));
  const declared = win.sent.find((m) => m.type === 'conformance' || m.contract === 'snapshot'
    || (Array.isArray(m.contracts) && m.contracts.includes('snapshot')));
  assert.ok(declared, `nothing declared snapshot: ${JSON.stringify(win.sent)}`);
});

ok('a snapshot request is answered with snapshot-data, null when declining', () => {
  const { win, sdk } = boot();
  sdk.onSnapshot(() => ({ kingPos: 'e1' }));
  win.deliver({ type: 'snapshot' });
  const reply = win.sent.filter((m) => m.type === 'snapshot-data').pop();
  assert.deepEqual(reply.state, { kingPos: 'e1' });

  const b = boot();                        // no handler registered at all
  b.win.deliver({ type: 'snapshot' });
  const decline = b.win.sent.filter((m) => m.type === 'snapshot-data').pop();
  assert.equal(decline.state, null, 'no handler answers null, never silence');
});

ok('a restore arriving BEFORE onRestore is held and replayed, not dropped', () => {
  const { win, sdk } = boot();
  win.deliver({ type: 'restore', state: { score: 9 } });
  let got = null;
  sdk.onRestore((s) => { got = s; });
  // the SDK holds it in _pendingRestore; registration must replay it
  assert.deepEqual(got ?? sdk._pendingRestore, { score: 9 });
});

ok('a throwing restore handler is contained', () => {
  const { win, sdk } = boot();
  sdk.onRestore(() => { throw new Error('bad save'); });
  win.deliver({ type: 'restore', state: {} });   // must not throw out of deliver
});

// ── outbound guards ────────────────────────────────────────────────────
ok('complete() posts a completion the host can route', () => {
  const { win, sdk } = boot();
  win.deliver({ type: 'init', config: {}, variables: {} });
  sdk.complete({ success: true, score: 12 });
  const done = win.sent.filter((m) => /complete/.test(m.type)).pop();
  assert.ok(done, `no completion posted: ${JSON.stringify(win.sent.map(m => m.type))}`);
});

ok('setVariable mirrors locally and proposes to the host', () => {
  const { win, sdk } = boot();
  win.deliver({ type: 'init', config: {}, variables: { diamonds: 1 } });
  sdk.setVariable('diamonds', 2);
  assert.equal(sdk.getVariable('diamonds'), 2, 'synchronous local mirror');
  assert.ok(win.sent.some((m) => /variable/i.test(m.type)), 'and a proposal went out');
});

console.log(fail ? `\n${fail} failure(s)` : '\nAll finkgame kernel checks passed');
process.exit(fail ? 1 : 0);
