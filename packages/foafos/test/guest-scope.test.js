import assert from 'node:assert/strict';
import { FoafBus } from '../src/bus.mjs';
import { scopeBus } from '../src/guest.mjs';

export async function run() {
  const bus = new FoafBus();
  const all = [];
  bus.subscribe('*', (e) => all.push(e));

  const scoped = scopeBus(bus, {
    name: 'w1',
    publish: ['widget.tally.a.*'],
    subscribe: ['widget.tally.*'],
  });

  // granted publish goes through, source forcibly stamped
  const ok = scoped.publish('widget.tally.a.changed', { count: 1 });
  assert.equal(ok.source, 'guest:w1');

  // denied publish is dropped AND announced
  const denied = scoped.publish('session.hijack', { evil: true });
  assert.equal(denied, null);
  assert.ok(!all.some(e => e.topic === 'session.hijack'));
  const denial = all.find(e => e.topic === 'sys.guest.denied');
  assert.equal(denial.data.guest, 'w1');
  assert.equal(denial.data.topic, 'session.hijack');

  // inbound: only granted topics reach the scoped subscriber
  const seen = [];
  scoped.subscribe('*', (e) => seen.push(e.topic));
  bus.publish('widget.tally.b.changed', { count: 9 });
  bus.publish('session.current', { name: 'secret' });
  assert.deepEqual(seen, ['widget.tally.b.changed']);

  // close() severs everything
  scoped.close();
  bus.publish('widget.tally.b.changed', { count: 10 });
  assert.equal(seen.length, 1);
}
