import assert from 'node:assert/strict';
import { FoafBus } from '../src/bus.mjs';

export async function run() {
  // pub/sub, exact topic
  {
    const bus = new FoafBus();
    const got = [];
    bus.subscribe('wm.mode', (e) => got.push(e));
    bus.publish('wm.mode', { mode: 'pip' });
    bus.publish('wm.other', {});
    assert.equal(got.length, 1);
    assert.equal(got[0].data.mode, 'pip');
    assert.ok(got[0].id && got[0].ts);
  }

  // wildcard patterns
  {
    const bus = new FoafBus();
    const got = [];
    bus.subscribe('minigame.*', (e) => got.push(e.topic));
    bus.subscribe('*', (e) => got.push('all:' + e.topic));
    bus.publish('minigame.start', {});
    bus.publish('minigame.complete.deep', {});
    bus.publish('story.beat', {});
    assert.deepEqual(got, [
      'minigame.start', 'all:minigame.start',
      'minigame.complete.deep', 'all:minigame.complete.deep',
      'all:story.beat',
    ]);
    // 'minigame.*' must NOT match the bare prefix 'minigame'
    assert.equal(FoafBus.match('minigame.*', 'minigame'), false);
  }

  // retained events + replay on subscribe
  {
    const bus = new FoafBus();
    bus.publish('session.current', { name: 'robin' }, { retain: true });
    bus.publish('session.current', { name: 'wren' }, { retain: true });
    const got = [];
    bus.subscribe('session.*', (e) => got.push(e.data.name), { replay: true });
    assert.deepEqual(got, ['wren']); // last retained wins
    assert.equal(bus.retained('session.*').length, 1);
  }

  // unsubscribe stops delivery; a throwing handler doesn't break others
  {
    const bus = new FoafBus();
    const got = [];
    const un = bus.subscribe('t', () => { throw new Error('boom'); });
    bus.subscribe('t', (e) => got.push(e));
    bus.publish('t', {});
    assert.equal(got.length, 1);
    un();
    bus.publish('t', {});
    assert.equal(got.length, 2); // second handler still alive
  }

  // cross-tab bridge (BroadcastChannel exists in Node)
  {
    const a = new FoafBus(); a.bridge('foafos-test');
    const b = new FoafBus(); b.bridge('foafos-test');
    const got = [];
    b.subscribe('x.*', (e) => got.push(e));
    a.publish('x.ping', { n: 1 });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(got.length, 1);
    assert.equal(got[0].source, 'tab');   // remote origin is visible
    a.close(); b.close();
  }
}
