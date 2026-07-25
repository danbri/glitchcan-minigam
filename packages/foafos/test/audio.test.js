import assert from 'node:assert/strict';
import { FoafAudio, AUDIO_KEY } from '../src/audio.mjs';

const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m };
};

export async function run() {
  // volume reaches every registered sink, immediately and on change
  {
    const a = new FoafAudio();
    const seen = { x: [], y: [] };
    a.register('x', l => seen.x.push(l));
    a.register('y', l => seen.y.push(l));
    assert.deepEqual(seen.x, [1], 'a sink is levelled the moment it registers');
    a.setVolume(0.4);
    assert.deepEqual(seen.x, [1, 0.4]);
    assert.deepEqual(seen.y, [1, 0.4]);
  }

  // mute is SEPARATE from volume: unmuting returns you where you were,
  // which is what every hardware volume control does
  {
    const a = new FoafAudio();
    const heard = [];
    a.register('s', l => heard.push(l));
    a.setVolume(0.6);
    a.toggleMute();
    assert.equal(a.level, 0);
    assert.equal(a.volume, 0.6, 'mute must not destroy the level');
    a.toggleMute();
    assert.equal(a.level, 0.6);
    assert.deepEqual(heard, [1, 0.6, 0, 0.6]);
  }

  // nudging the slider up from silence is an unmute — anything else
  // makes the control feel broken
  {
    const a = new FoafAudio();
    a.setMuted(true);
    a.setVolume(0.3);
    assert.equal(a.muted, false);
    assert.equal(a.level, 0.3);
  }

  // COVERAGE IS THE HONEST PART: a guest we cannot reach into keeps
  // playing through a mute, and the control has to admit it
  {
    const a = new FoafAudio();
    a.register('story', () => {}, { label: 'story music' });
    a.register('legacy', () => {}, { label: 'boidwars', kind: 'uncontrollable' });
    const c = a.coverage();
    assert.equal(c.total, 2);
    assert.equal(c.governed, 1);
    assert.deepEqual(c.uncovered, ['boidwars']);
  }

  // the announcement carries the honest summary
  {
    const events = [];
    const a = new FoafAudio({ bus: { publish: (t, d) => events.push([t, d]) } });
    a.register('g', () => {}, { label: 'chess', kind: 'uncontrollable' });
    a.setMuted(true);
    const last = events[events.length - 1];
    assert.equal(last[0], 'audio.volume');
    assert.match(last[1].summary, /Muted/);
    assert.equal(last[1].coverage.uncovered[0], 'chess');
  }

  // a sink that throws must not stop the others being turned down
  {
    const a = new FoafAudio({ bus: { publish: () => {} } });
    let good = null;
    a.register('bad', () => { throw new Error('nope'); });
    a.register('good', l => { good = l; });
    a.setVolume(0.2);
    assert.equal(good, 0.2);
  }

  // the level survives a reload
  {
    const store = memStore();
    const a = new FoafAudio({ storage: store });
    a.setVolume(0.25);
    a.setMuted(true);
    assert.ok(store.getItem(AUDIO_KEY));
    const b = new FoafAudio({ storage: store });
    assert.equal(b.volume, 0.25);
    assert.equal(b.muted, true);
  }

  // a corrupt entry must not boot the shell silent
  {
    const store = memStore();
    store.setItem(AUDIO_KEY, '{{{not json');
    const a = new FoafAudio({ storage: store });
    assert.equal(a.volume, 1);
    assert.equal(a.muted, false);
  }
}
