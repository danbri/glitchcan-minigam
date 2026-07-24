import assert from 'node:assert/strict';
import { FoafBus } from '../src/bus.mjs';
import { FoafCluster } from '../src/cluster.mjs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function run() {
  // Two shells in two "windows" (bridged buses) elect exactly one
  // coordinator, arbitrate a shared resource last-claim-wins with a yield
  // to the previous holder, and survive coordinator death.
  const chan = `foafos-cluster-${Math.random().toString(36).slice(2)}`;
  const busA = new FoafBus(); busA.bridge(chan);
  const busB = new FoafBus(); busB.bridge(chan);

  const a = new FoafCluster(busA, { id: 'aa', heartbeatMs: 60 }); a.seniority = 100; a.start();
  await sleep(30);
  const b = new FoafCluster(busB, { id: 'bb', heartbeatMs: 60 }); b.seniority = 200; b.start();
  await sleep(200);

  // one coordinator, seen identically from both sides
  assert.equal(a.coordinator, 'aa');
  assert.equal(b.coordinator, 'aa');
  assert.ok(a.isCoordinator && !b.isCoordinator);
  assert.equal(b.members.size, 2);

  // A claims audio and holds it
  assert.equal(await a.claim('audio', { label: 'jukebox A' }), true);
  assert.ok(a.holds('audio'));

  // B claims: last claim wins; A is told to yield
  let aYielded = null;
  a.onYield('audio', (state) => { aYielded = state.holder; });
  assert.equal(await b.claim('audio', { label: 'jukebox B' }), true);
  await sleep(100);
  assert.equal(aYielded, 'bb');
  assert.ok(!a.holds('audio') && b.holds('audio'));

  // release clears the book
  b.release('audio');
  await sleep(100);
  assert.equal(a.holders.get('audio'), undefined);

  // coordinator dies → the survivor takes over and claims still work
  a.stop();
  await sleep(400);
  assert.equal(b.coordinator, 'bb');
  assert.ok(b.isCoordinator);
  assert.equal(await b.claim('fullscreen', {}), true);

  b.stop(); busA.close(); busB.close();
}
