import assert from 'node:assert/strict';
import test from 'node:test';
import { AppTree } from '../src/apptree.mjs';

const mkBus = () => { const seen = []; return { seen, publish: (t, d) => seen.push({ t, ...d }) }; };
const root = (tree, caps) => tree.spawn({ appId: 'shell', parentId: null, capabilities: caps, label: 'root' });

test('a child may hold a subset of its parent', () => {
  const tree = new AppTree();
  const r = root(tree, ['storage', 'audio', 'input']);
  const child = tree.spawn({ appId: 'robbin', parentId: r.id, capabilities: ['audio', 'input'] });
  assert.equal(child.refused, undefined);
  assert.deepEqual(child.capabilities, ['audio', 'input']);
  assert.equal(tree.depth(child.id), 1);
});

test('a child may NOT exceed its parent — spawn is not an escalation primitive', () => {
  const bus = mkBus();
  const tree = new AppTree({ bus });
  const r = root(tree, ['audio']);
  const child = tree.spawn({ appId: 'greedy', parentId: r.id, capabilities: ['audio', 'storage', 'same-origin'] });
  assert.equal(child.refused, true);
  assert.equal(child.reason, 'attenuation');
  assert.deepEqual(child.excess, ['storage', 'same-origin']);
  assert.equal(tree.nodes.size, 1, 'the refused node must not exist');
  const said = bus.seen.find(e => e.t === 'app.spawn.refused');
  assert.match(said.summary, /may not grant/);
});

test('attenuation compounds down the tree', () => {
  const tree = new AppTree();
  const r = root(tree, ['a', 'b', 'c']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['a', 'b'] });
  // the grandchild is bounded by its PARENT, not by the root
  const bad = tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: ['c'] });
  assert.equal(bad.refused, true);
  assert.deepEqual(bad.excess, ['c']);
  const good = tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: ['a'] });
  assert.equal(good.refused, undefined);
});

test('close cascades, deepest first, and runs each onClose', () => {
  const tree = new AppTree();
  const order = [];
  const r = root(tree, ['a']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['a'], onClose: n => order.push(n.appId) });
  const kid = tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: ['a'], onClose: n => order.push(n.appId) });
  const grandkid = tree.spawn({ appId: 'grandkid', parentId: kid.id, capabilities: [], onClose: n => order.push(n.appId) });
  assert.equal(tree.nodes.size, 4);
  const closed = tree.close(mid.id);
  assert.equal(closed.length, 3);
  assert.deepEqual(order, ['grandkid', 'kid', 'mid'], 'deepest first');
  assert.equal(tree.nodes.size, 1, 'only the root survives');
  assert.equal(tree.get(grandkid.id), null);
});

test('an onClose that throws does not strand the rest of the subtree', () => {
  const bus = mkBus();
  const tree = new AppTree({ bus });
  const r = root(tree, []);
  const a = tree.spawn({ appId: 'a', parentId: r.id, capabilities: [], onClose: () => { throw new Error('boom'); } });
  tree.spawn({ appId: 'b', parentId: a.id, capabilities: [] });
  const closed = tree.close(a.id);
  assert.equal(closed.length, 2);
  assert.equal(tree.nodes.size, 1);
  assert.ok(bus.seen.some(e => e.t === 'app.close.error'));
});

test('suspend and resume take the whole subtree', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['a'] });
  const kid = tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: ['a'] });
  const ids = tree.setSuspended(mid.id, true);
  assert.equal(ids.length, 2);
  assert.equal(tree.get(kid.id).suspended, true);
  assert.equal(tree.get(r.id).suspended, false, 'suspending a child must not touch the parent');
  tree.setSuspended(mid.id, false);
  assert.equal(tree.get(kid.id).suspended, false);
});

test('spawning under a dead parent is refused, not silently reparented', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['a'] });
  tree.close(mid.id);
  const orphan = tree.spawn({ appId: 'late', parentId: mid.id, capabilities: [] });
  assert.equal(orphan.refused, true);
  assert.equal(orphan.reason, 'no-such-parent');
});

test('report gives roots with their subtrees', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['a'] });
  tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: [] });
  const rep = tree.report();
  assert.equal(rep.roots.length, 1);
  assert.equal(rep.total, 3);
  assert.equal(rep.roots[0].children[0].children[0].appId, 'kid');
});

// ── the tree is the one source of truth, so nothing it hands out can change it ──

test('a node view cannot be written, and neither can its capabilities', () => {
  const tree = new AppTree();
  const r = root(tree, ['storage']);
  const kid = tree.spawn({ appId: 'kid', parentId: r.id, capabilities: ['storage'] });
  assert.throws(() => { kid.capabilities.push('secrets'); }, TypeError);
  assert.throws(() => { kid.suspended = true; }, TypeError);
  assert.throws(() => { kid.parentId = null; }, TypeError);
  assert.equal(tree.can(kid.id, 'secrets'), false);
  assert.equal(tree.get(kid.id).parentId, r.id);
});

test('nodes is a read-only Map view: it reads like a Map and cannot be edited', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const kid = tree.spawn({ appId: 'kid', parentId: r.id, capabilities: ['a'] });
  assert.equal(tree.nodes.size, 2);
  assert.equal(tree.nodes.get(kid.id), kid, 'same view as spawn returned');
  assert.deepEqual([...tree.nodes.values()].map(n => n.appId), ['shell', 'kid']);
  assert.equal(typeof tree.nodes.set, 'undefined');
  assert.equal(typeof tree.nodes.delete, 'undefined');
  assert.equal(typeof tree.nodes.clear, 'undefined');
  assert.throws(() => { tree.nodes = new Map(); }, TypeError);
});

test('a view has a stable identity and reads live state', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const kid = tree.spawn({ appId: 'kid', parentId: r.id, capabilities: ['a'] });
  assert.equal(tree.get(kid.id), kid);
  assert.equal(tree.children(r.id)[0], kid);
  tree.setSuspended(kid.id, true);
  assert.equal(kid.suspended, true, 'the view held since spawn sees the change');
});

test('can() answers for LIVE nodes only: closing a node revokes everything it held', () => {
  const tree = new AppTree();
  const r = root(tree, ['storage', 'audio']);
  const mid = tree.spawn({ appId: 'mid', parentId: r.id, capabilities: ['storage'] });
  const kid = tree.spawn({ appId: 'kid', parentId: mid.id, capabilities: ['storage'] });
  assert.equal(tree.can(kid.id, 'storage'), true);
  assert.equal(tree.can(kid.id, 'audio'), false, 'not held, even though the root holds it');
  assert.deepEqual(tree.holders('storage').map(n => n.appId), ['shell', 'mid', 'kid']);
  tree.close(mid.id);
  assert.equal(tree.can(kid.id, 'storage'), false, 'the cascade revoked the child too');
  assert.equal(tree.can('app999', 'storage'), false);
  assert.deepEqual(tree.holders('storage').map(n => n.appId), ['shell']);
});

test('setOnClose replaces the closer, and null means close takes nothing down', () => {
  const tree = new AppTree();
  const r = root(tree, []);
  let ran = 0;
  const kid = tree.spawn({ appId: 'kid', parentId: r.id, capabilities: [], onClose: () => { ran++; } });
  assert.equal(tree.setOnClose(kid.id, null), true);
  tree.close(kid.id);
  assert.equal(ran, 0);
  assert.equal(tree.setOnClose(kid.id, () => {}), false, 'a closed node has nothing to set');
});

test('scopes are frozen copies, shown on the view and in the report', () => {
  const bus = mkBus();
  const tree = new AppTree({ bus });
  const r = root(tree, ['a']);
  const kid = tree.spawn({ appId: 'kid', parentId: r.id, capabilities: ['a'] });
  const grants = { publish: ['guest.kid.*'], subscribe: ['wm.mode'] };
  const held = tree.setScope(kid.id, 'bus', grants);
  grants.publish.push('*');
  assert.deepEqual(held.publish, ['guest.kid.*'], 'a later edit of the input changes nothing');
  assert.equal(kid.scopes.bus, held);
  assert.throws(() => { kid.scopes.bus.publish.push('*'); }, TypeError);
  assert.deepEqual(tree.report().roots[0].children[0].scopes.bus.publish, ['guest.kid.*']);
  assert.ok(bus.seen.some(e => e.t === 'app.scope' && e.name === 'bus'));
  assert.equal(tree.setScope('app999', 'bus', {}), null);
});

test('dreamOf and peerOf are set at spawn, not written afterwards', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const outer = tree.spawn({ appId: 'story-session', parentId: r.id, capabilities: ['a'] });
  const dream = tree.spawn({ appId: 'story-session', parentId: r.id, capabilities: ['a'], dreamOf: outer.id });
  const peer = tree.spawn({ appId: 'story-session', parentId: r.id, capabilities: ['a'], peerOf: outer.id });
  assert.equal(dream.dreamOf, outer.id);
  assert.equal(peer.peerOf, outer.id);
  assert.equal(outer.dreamOf, null);
});

test('the report is a plain copy: editing it changes nothing', () => {
  const tree = new AppTree();
  const r = root(tree, ['a']);
  const rep = tree.report();
  rep.roots[0].capabilities.push('same-origin');
  assert.equal(tree.can(r.id, 'same-origin'), false);
});
