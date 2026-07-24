import assert from 'node:assert/strict';
import { WidgetRegistry } from '../src/widgets.mjs';

export async function run() {
  const reg = new WidgetRegistry();

  // exact kind wins
  reg.register('minigame.complete', 'x-minigame-result');
  assert.equal(reg.resolve('minigame.complete'), 'x-minigame-result');

  // longest wildcard prefix wins over a shorter one
  reg.register('net.*', 'x-net-card');
  reg.register('net.atom.*', 'x-atom-card');
  assert.equal(reg.resolve('net.atom.entry'), 'x-atom-card');
  assert.equal(reg.resolve('net.ws.message'), 'x-net-card');

  // everything else falls back to the generic card — a feed can always render
  assert.equal(reg.resolve('story.beat'), 'foaf-card');
  assert.equal(reg.resolve(''), 'foaf-card');
}
