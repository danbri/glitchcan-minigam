import assert from 'node:assert/strict';
import { FoafInput, ACTION_KEYS, ACTIONS } from '../src/input.mjs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function run() {
  // press → immediate event; autorepeat is the service's policy
  {
    const input = new FoafInput({ repeatMs: 30 });
    const seen = [];
    input.addSink(e => seen.push(e));
    input.press('up', 'touch');
    assert.deepEqual(seen[0], { action: 'up', phase: 'press', source: 'touch', repeat: false });
    await sleep(100);
    const repeats = seen.filter(e => e.repeat);
    assert.ok(repeats.length >= 2, `expected autorepeat, got ${repeats.length}`);
    input.release('up', 'touch');
    const n = seen.length;
    assert.equal(seen.at(-1).phase, 'release');
    await sleep(80);
    assert.equal(seen.length, n, 'repeats must stop on release');
    input.destroy();
  }

  // a second press while held is idempotent (no double timers)
  {
    const input = new FoafInput({ repeatMs: 1000 });
    const seen = [];
    input.addSink(e => seen.push(e));
    input.press('left'); input.press('left');
    assert.equal(seen.filter(e => e.phase === 'press').length, 1);
    input.release('left');
    input.release('left');   // releasing twice must not double-fire
    assert.equal(seen.filter(e => e.phase === 'release').length, 1);
    input.destroy();
  }

  // releaseAll clears every held action (focus loss must not stick keys)
  {
    const input = new FoafInput({ repeatMs: 1000 });
    const released = [];
    input.addSink(e => { if (e.phase === 'release') released.push(e.action); });
    input.press('up'); input.press('a');
    input.releaseAll();
    assert.deepEqual(released.sort(), ['a', 'up']);
    assert.equal(input.held.size, 0);
    input.destroy();
  }

  // unknown actions are ignored; the vocabulary is closed
  {
    const input = new FoafInput();
    const seen = [];
    input.addSink(e => seen.push(e));
    input.press('fly');
    assert.equal(seen.length, 0);
    input.destroy();
  }

  // every action maps to a legacy SDK key pair (guests need no changes)
  for (const a of ACTIONS) {
    assert.ok(ACTION_KEYS[a]?.key && ACTION_KEYS[a]?.code, `no key mapping for ${a}`);
  }

  // sink errors are contained
  {
    const input = new FoafInput({ repeatMs: 1000 });
    const ok = [];
    input.addSink(() => { throw new Error('bad sink'); });
    input.addSink(e => ok.push(e));
    input.press('down');
    assert.equal(ok.length, 1);
    input.destroy();
  }
}
