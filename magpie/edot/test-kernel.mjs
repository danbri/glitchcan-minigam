// test-kernel.mjs — pure-Node unit test for the shared kernel (bus, capabilities,
// index). Transport-injectable, so no browser/BroadcastChannel needed.
import { Bus, Capabilities, Kernel } from './js/edot-kernel.js';
import { memoryStore } from './js/object-index.js';

let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// A synchronous BroadcastChannel-shaped pair: postMessage on one delivers to the
// other's onmessage. Mirrors how two tabs share a channel.
function makePair() {
  const a = { onmessage: null, close() {} };
  const b = { onmessage: null, close() {} };
  a.postMessage = (data) => { if (b.onmessage) b.onmessage({ data }); };
  b.postMessage = (data) => { if (a.onmessage) a.onmessage({ data }); };
  return [a, b];
}

// ---- Bus: local pub/sub ----
{
  const bus = new Bus();
  let got = null, calls = 0;
  const off = bus.subscribe('hello', (p) => { got = p; calls++; });
  bus.publish('hello', { x: 1 });
  ok('bus delivers to a local subscriber', got && got.x === 1 && calls === 1);

  bus.publish('other', { y: 2 });
  ok('bus does not deliver across types', calls === 1);

  off();
  bus.publish('hello', { x: 9 });
  ok('unsubscribe stops delivery', calls === 1);
}

// ---- Bus: wildcard ----
{
  const bus = new Bus();
  const seen = [];
  bus.subscribe('*', (p, msg) => seen.push(msg.type));
  bus.publish('a', {}); bus.publish('b', {});
  ok('wildcard subscriber sees every type', seen.join(',') === 'a,b');
}

// ---- Bus: cross-tab via transport, with no echo ----
{
  const [t1, t2] = makePair();
  const busA = new Bus(t1);
  const busB = new Bus(t2);
  let aCalls = 0, bGot = null;
  busA.subscribe('ping', () => { aCalls++; });        // publisher's own subscriber
  busB.subscribe('ping', (p) => { bGot = p; });        // sibling tab
  busA.publish('ping', { n: 5 });
  ok('cross-tab: sibling receives the message', bGot && bGot.n === 5);
  ok('no echo: publisher delivers to itself exactly once', aCalls === 1);

  // local-only publish stays local
  let bCount = 0; busB.subscribe('local', () => { bCount++; });
  busA.publish('local', {}, { crossTab: false });
  ok('crossTab:false does not cross the transport', bCount === 0);
}

// ---- Capabilities: local provide/invoke ----
{
  const caps = new Capabilities();
  let received = null;
  const un = caps.provide('editor.insert', (p) => { received = p; return `inserted:${p.title}`; }, { title: 'Insert' });
  ok('has() reports a provided capability', caps.has('editor.insert'));
  ok('list() includes meta', caps.list()[0].id === 'editor.insert' && caps.list()[0].title === 'Insert');

  const result = caps.invoke('editor.insert', { title: 'T' });
  ok('local invoke calls the provider directly', received && received.title === 'T');
  ok('local invoke returns the provider result', result === 'inserted:T');

  un();
  ok('unprovide removes the capability', !caps.has('editor.insert'));

  let threw = false; try { caps.invoke('nope', {}); } catch { threw = true; }
  ok('invoke with no provider and no bus throws', threw);
}

// ---- Capabilities: remote invoke over the bus ----
{
  const [t1, t2] = makePair();
  const busA = new Bus(t1), busB = new Bus(t2);
  const capsA = new Capabilities(busA);   // no providers
  const capsB = new Capabilities(busB);   // provides slides.fromTable
  let ranOnB = null;
  capsB.provide('slides.fromTable', (p) => { ranOnB = p; });
  const ret = capsA.invoke('slides.fromTable', { rows: 3 });
  ok('remote invoke runs the provider on the sibling tab', ranOnB && ranOnB.rows === 3);
  ok('remote invoke returns undefined (fire-and-forget)', ret === undefined);
}

// ---- Kernel: bundles bus + index + capabilities over an injected store ----
{
  const kernel = new Kernel({ storage: memoryStore() });
  kernel.index.upsert({ id: 'k1', type: 'doc', title: 'Kdoc', modifiedAt: 1 });
  ok('kernel.index works', kernel.index.get('k1')?.title === 'Kdoc');
  let busOk = false; kernel.bus.subscribe('t', () => { busOk = true; }); kernel.bus.publish('t', {});
  ok('kernel.bus works', busOk);
  kernel.capabilities.provide('c', () => 42);
  ok('kernel.capabilities works', kernel.capabilities.invoke('c') === 42);
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nKERNEL OK');
process.exit(fail ? 1 : 0);
