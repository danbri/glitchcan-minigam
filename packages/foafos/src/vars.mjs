// FoafVars — who may change which variable, and what happens when two
// independent works both call something "score".
//
// The problem this solves: a minigame runs as untrusted sandboxed code,
// yet the only thing standing between it and every variable in the
// running story was a manifest nobody enforced. Equally, two unrelated
// .fink.js works both using `score` were silently sharing one slot
// through the platform's injected globals — fine when it is the same
// economy, a bug when it is not.
//
// The model:
//
//   SHARED   a small, explicitly listed economy every work may touch
//            (diamonds, keys, score…). Cross-work by design.
//   PRIVATE  everything else. Belongs to the work that declared it.
//            Independent works run as separate Story objects, so two
//            stories' `points` are never actually one slot — but a
//            guest granted that name writes into whichever story is
//            hosting it. `scopedName` offers `<workId>__<name>` for
//            callers that want hard separation; the enforcement path
//            does not apply it, because renaming at runtime would
//            break every story that declared the bare `VAR`.
//            `inklet/tools/fink-vars.mjs` reports the collisions.
//
// A guest may write ONLY what its manifest declares, and only within
// those rules. Everything else is denied, and denials are events, not
// silence — cheating and honest bugs look the same from here, so both
// get surfaced rather than swallowed.
//
// Depth rule: inside a dream (LINKREL goDeeper, spec §3.4) the shared
// economy is READ-ONLY by default. A dream may not spend the waking
// world's diamonds; things true above are true below, but not
// changeable from below.

// `minigame_played` is here for the same reason as `diamonds`: every
// guest sets it and several stories read it. It is a platform
// convention, not one author's private flag.
export const SHARED_DEFAULT = ['diamonds', 'mega_diamonds', 'keys', 'score', 'minigame_played'];

// Neutral, non-plot context the host offers every guest: difficulty
// settings and the like. Readable by all, writable by none of them
// (a guest that wants one must still declare it).
export const HOST_CONTEXT = ['player_level', 'difficulty'];

export class FoafVars {
  constructor({ bus = null, shared = SHARED_DEFAULT, limits = {} } = {}) {
    this.bus = bus;
    this.shared = new Set(shared);
    // sane bounds blunt the laziest cheating; a game that "earns"
    // 10^9 diamonds is reporting a bug, not a score
    this.limits = { max: 1e6, min: -1e6, ...limits };
    this.log = [];          // audit trail (bounded)
    this.depth = 0;         // dream depth, set by the host
    this.strictDreams = true;
    this.bound = null;      // names the running work actually declares (null = unknown)
    this.scratch = new Map(); // permitted writes nothing declared — kept, not lost
  }

  isShared(name) { return this.shared.has(name); }

  /**
   * Tell the broker which variables the currently-running work declares.
   * A permitted write to a name nothing declares is not an attack, but it
   * IS a bug — a manifest and a story drifting apart, or a typo — and it
   * would otherwise fail silently inside the host's try/catch.
   */
  setBound(names) { this.bound = names ? new Set(names) : null; }

  /**
   * The subset of `values` a guest is allowed to SEE. A guest reads the
   * shared economy and the neutral host context, plus whatever its
   * manifest declares — and nothing else, so a chess game cannot read a
   * story's private plot state.
   */
  filterReadable(actor, values) {
    if (actor?.kind !== 'guest') return { ...values };
    const grants = actor.grants || {};
    const allowed = new Set([
      ...this.shared, ...HOST_CONTEXT,
      ...(grants.read || []),
      // a guest cannot sensibly increment a counter it may not see
      ...(grants.write || []),
    ]);
    const out = {};
    for (const [k, v] of Object.entries(values || {})) if (allowed.has(k)) out[k] = v;
    return out;
  }

  /**
   * May `actor` write `name`?
   * actor = { kind: 'guest'|'story'|'maker', id, grants: {read:[], write:[]} }
   * Returns { ok:true } or { ok:false, reason }.
   */
  canWrite(actor, name, value) {
    if (typeof name !== 'string' || !name) return { ok: false, reason: 'nameless variable' };

    // the maker/devtools may do anything — it is the operator, not a guest
    if (actor?.kind === 'maker') return { ok: true };

    if (actor?.kind === 'guest') {
      const allowed = actor.grants?.write || [];
      if (!allowed.includes(name)) {
        return { ok: false, reason: `"${name}" is not in ${actor.id}'s manifest write list` };
      }
    }

    if (this.isShared(name)) {
      if (this.strictDreams && this.depth > 0) {
        return { ok: false, reason: `shared economy is read-only inside a dream (depth ${this.depth})` };
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return { ok: false, reason: 'non-finite value' };
        if (value > this.limits.max || value < this.limits.min) {
          return { ok: false, reason: `${name}=${value} outside platform limits` };
        }
      }
    }
    return { ok: true };
  }

  /**
   * Perform a write through `apply(name, value)` if permitted.
   * Returns true when written. Denials and writes are both recorded and
   * published, so the Maker window can show the whole traffic.
   */
  write(actor, name, value, apply) {
    const verdict = this.canWrite(actor, name, value);
    const entry = {
      t: Date.now(), actor: actor?.id || actor?.kind || 'unknown',
      name, value, ok: verdict.ok, reason: verdict.reason || null, depth: this.depth,
    };
    this.log.push(entry);
    if (this.log.length > 500) this.log.shift();

    if (!verdict.ok) {
      this.bus?.publish('vars.denied', {
        ...entry, summary: `denied ${actor?.id || 'guest'} → ${name}: ${verdict.reason}`,
      });
      return false;
    }
    if (this.bound && !this.bound.has(name)) {
      // Nothing declared this name, so the assignment below will throw
      // and be swallowed. Keep the value: a guest reporting its result
      // into a void is a bug worth SEEING (Maker window reads scratch),
      // and a story opts in to the value simply by declaring the VAR.
      this.scratch.set(name, value);
      this.bus?.publish('vars.unbound', {
        ...entry, summary: `${entry.actor} wrote "${name}", which no running work declares`,
      });
    }
    // The apply itself can fail (Ink refuses assignment to an undeclared
    // variable). That is a report, not an exception to propagate — the
    // guest asked legitimately and the platform could not oblige.
    try {
      apply(name, value);
    } catch (e) {
      entry.ok = false;
      entry.reason = `apply failed: ${e.message || e}`;
      this.bus?.publish('vars.failed', {
        ...entry, summary: `could not set ${name}: ${entry.reason}`,
      });
      return false;
    }
    this.bus?.publish('vars.write', {
      ...entry, summary: `${entry.actor} set ${name} = ${value}`,
    });
    return true;
  }

  // Private variables are namespaced per work so two unrelated stories
  // using `points` cannot reach each other's slot.
  scopedName(workId, name) {
    return this.isShared(name) ? name : `${workId}__${name}`;
  }

  setDepth(d) { this.depth = d | 0; }
}
