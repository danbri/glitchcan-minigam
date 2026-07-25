import assert from 'node:assert/strict';
import { FoafVars, SHARED_DEFAULT } from '../src/vars.mjs';

export async function run() {
  const guest = (id, write = []) => ({ kind: 'guest', id, grants: { write } });

  // a guest may write ONLY what its manifest declares
  {
    const v = new FoafVars();
    const written = {};
    const apply = (n, x) => { written[n] = x; };
    assert.equal(v.write(guest('robbin', ['robbin_birds']), 'robbin_birds', 3, apply), true);
    assert.equal(written.robbin_birds, 3);
    // the classic attack: an undeclared write to the shared economy
    assert.equal(v.write(guest('robbin', ['robbin_birds']), 'diamonds', 999999, apply), false);
    assert.equal(written.diamonds, undefined);
    // and to another work's private state
    assert.equal(v.write(guest('robbin', ['robbin_birds']), 'hampstead_secret', 1, apply), false);
  }

  // declared shared writes are allowed, but bounded
  {
    const v = new FoafVars();
    const w = {};
    const apply = (n, x) => { w[n] = x; };
    const g = guest('gems', ['diamonds']);
    assert.equal(v.write(g, 'diamonds', 12, apply), true);
    assert.equal(v.write(g, 'diamonds', 1e12, apply), false, 'absurd values rejected');
    assert.equal(v.write(g, 'diamonds', Infinity, apply), false);
    assert.equal(w.diamonds, 12);
  }

  // DREAMS ARE STRICT: inside a dream the shared economy is read-only
  {
    const v = new FoafVars();
    const w = {};
    const apply = (n, x) => { w[n] = x; };
    const g = guest('gems', ['diamonds', 'gem_streak']);
    v.setDepth(1);
    assert.equal(v.write(g, 'diamonds', 5, apply), false, 'no spending the waking world from a dream');
    // …but a dream may still keep its own private counters
    assert.equal(v.write(g, 'gem_streak', 5, apply), true);
    v.setDepth(0);
    assert.equal(v.write(g, 'diamonds', 5, apply), true);
  }

  // private names are namespaced per work; shared names are not
  {
    const v = new FoafVars();
    assert.equal(v.scopedName('hampstead', 'points'), 'hampstead__points');
    assert.equal(v.scopedName('riverbend', 'points'), 'riverbend__points');
    assert.notEqual(v.scopedName('hampstead', 'points'), v.scopedName('riverbend', 'points'));
    assert.equal(v.scopedName('hampstead', 'diamonds'), 'diamonds');
  }

  // every attempt is auditable, allowed or not
  {
    const events = [];
    const v = new FoafVars({ bus: { publish: (topic, data) => events.push([topic, data]) } });
    const apply = () => {};
    v.write(guest('x', ['ok_var']), 'ok_var', 1, apply);
    v.write(guest('x', ['ok_var']), 'diamonds', 1, apply);
    assert.deepEqual(events.map(e => e[0]), ['vars.write', 'vars.denied']);
    assert.match(events[1][1].summary, /denied/);
    assert.equal(v.log.length, 2);
  }

  // the operator (maker/devtools) is not a guest and may do anything
  {
    const v = new FoafVars();
    const w = {};
    v.setDepth(2);
    assert.equal(v.write({ kind: 'maker', id: 'maker' }, 'diamonds', 42, (n, x) => { w[n] = x; }), true);
    assert.equal(w.diamonds, 42);
  }

  // a guest READS the shared economy and its own declarations, nothing else
  {
    const v = new FoafVars();
    const g = { kind: 'guest', id: 'chess', grants: { read: ['difficulty'], write: ['chess_won'] } };
    const seen = v.filterReadable(g, {
      diamonds: 7, difficulty: 2, chess_won: false,
      murderer_is_victoria: true,        // another work's plot state
      hampstead_visited_tube: true,
    });
    assert.deepEqual(Object.keys(seen).sort(), ['chess_won', 'diamonds', 'difficulty']);
    assert.equal(seen.murderer_is_victoria, undefined, 'a chess game must not read the whodunnit');
    // the host itself sees everything
    assert.equal(Object.keys(v.filterReadable({ kind: 'host' }, { a: 1, b: 2 })).length, 2);
  }

  // a permitted write to a name nothing declares is kept and reported,
  // not lost in the assignment's try/catch
  {
    const events = [];
    const v = new FoafVars({ bus: { publish: (t, d) => events.push([t, d]) } });
    v.setBound(['diamonds', 'score']);          // what the running story declares
    const g = { kind: 'guest', id: 'chess', grants: { write: ['chess_won'] } };
    v.write(g, 'chess_won', true, () => { throw new Error('ink: variable not declared'); });
    assert.equal(v.scratch.get('chess_won'), true);
    assert.ok(events.some(e => e[0] === 'vars.unbound'), 'unbound write must be announced');
    // a bound write says nothing
    events.length = 0;
    v.write({ kind: 'maker', id: 'm' }, 'score', 3, () => {});
    assert.equal(events.filter(e => e[0] === 'vars.unbound').length, 0);
  }

  // the platform convention every guest sets is part of the shared
  // economy, not one story's private flag (fink-vars.mjs reported it as
  // a cross-work collision until it moved here)
  {
    assert.ok(SHARED_DEFAULT.includes('minigame_played'));
  }
}
