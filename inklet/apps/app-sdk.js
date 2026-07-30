// app-sdk.js — what an app loads to live inside foafos.
//
// ONE class of thing. A story widget, a maze, a spreadsheet and a channel
// player are all "apps": same sandbox, same protocol, same brokers. What
// differs is which capabilities each was granted and which surface it is
// drawn on — not how much of the shell it can reach.
//
// The problem this solves: an app in a sandboxed frame has an OPAQUE
// ORIGIN, where `localStorage` and `sessionStorage` throw SecurityError.
// (Verified, not assumed — that is exactly what the browser does, and it
// is the isolation working.) Existing apps use those APIs 70+ times and
// cannot all be rewritten at once, so this stands in for them:
//
//   · the shell sends the app's whole keyspace with `init`
//   · reads are synchronous, out of that snapshot — so existing
//     `localStorage.getItem()` code keeps working unchanged
//   · writes go to memory immediately AND post to the broker, which owns
//     persistence, the quota and the audit trail
//
// That preserves synchronous localStorage semantics for a single running
// instance, which is what these apps actually rely on. It is NOT a
// faithful multi-writer localStorage and does not pretend to be: two
// instances of one app will not see each other's writes live.
//
// An app WITHOUT the storage capability gets a shim that throws a named,
// explanatory error instead of a bare SecurityError, because "you were
// not granted storage" is a debuggable message and "SecurityError" is not.
(function () {
  if (window.foaf) return;

  const listeners = { init: [], grant: [], suspend: [], resume: [], terminate: [], audio: [] };
  // SNAPSHOT / RESTORE (spec §5.5.4), same shape as every other service:
  // REGISTERING the handler IS the answer to the shell's contract probe.
  // A window app that never registers keeps working exactly as before and
  // simply does not persist — the shell then says so out loud rather than
  // promising a save it cannot make.
  let snapshotFn = null;
  let restoreFn = null;
  let pendingRestore;      // the shell may restore before the app registers
  let appId = null;
  let capabilities = new Set();
  let lastAudio = null;   // retained so a late onAudio replays the level
  // app.init may land BEFORE a deferred module registers onInit (app-sdk is
  // a classic script; the app is type=module). Retain the config so a late
  // onInit replays instead of missing the boot signal.
  let lastInitConfig = null;
  let ready = false;

  const post = (msg) => {
    try { if (window.parent !== window) window.parent.postMessage(msg, '*'); }
    catch { /* standalone */ }
  };

  // Contracts this app speaks. REGISTERING a handler is the declaration —
  // there is no separate "I support X" call to forget. Sent on init and
  // again on any later registration, because a deferred module can register
  // after init has already gone out and the shell must hear about it (a
  // late answer restores the service, spec §5.1.2).
  const contracts = new Set(['app']);
  const declareContract = (name) => {
    if (contracts.has(name)) return;
    contracts.add(name);
    if (ready) post({ type: 'conformance', contracts: [...contracts] });
  };

  // ── storage ─────────────────────────────────────────────────────────
  const mem = new Map();
  let storageGranted = false;

  const denied = (op) => {
    const e = new Error(
      `foafos: this app was not granted the "storage" capability, so ${op} is unavailable. ` +
      `Add "storage" to its capabilities in foafos-apps.js.`);
    e.name = 'FoafCapabilityError';
    return e;
  };

  const makeShim = (persist) => {
    const shim = {
      getItem(k) {
        if (!storageGranted) throw denied('getItem');
        const key = String(k);
        return mem.has(key) ? mem.get(key) : null;
      },
      setItem(k, v) {
        if (!storageGranted) throw denied('setItem');
        const key = String(k), val = String(v);
        mem.set(key, val);                       // synchronous, as callers expect
        if (persist) post({ type: 'store.set', key, value: val });
      },
      removeItem(k) {
        if (!storageGranted) throw denied('removeItem');
        const key = String(k);
        mem.delete(key);
        if (persist) post({ type: 'store.remove', key });
      },
      clear() {
        if (!storageGranted) throw denied('clear');
        mem.clear();
        if (persist) post({ type: 'store.clear' });
      },
      key(i) {
        if (!storageGranted) throw denied('key');
        return Array.from(mem.keys())[i] ?? null;
      },
    };
    Object.defineProperty(shim, 'length', {
      get() { if (!storageGranted) throw denied('length'); return mem.size; },
    });
    return shim;
  };

  // Install before any app code runs. `localStorage` is a Window
  // prototype getter that THROWS in an opaque origin, so an own-property
  // override is the only way to stand in front of it.
  //
  // ONLY WHERE THE NATIVE ONE IS UNUSABLE. This used to install
  // unconditionally, and every page that loaded app-sdk for the sake of
  // running under foafos therefore lost its real localStorage when opened
  // STANDALONE — replaced by a shim that throws FoafCapabilityError,
  // because nothing had granted it anything. Apps whose storage calls are
  // try-wrapped (edot's are, all of them) just quietly stopped
  // remembering things. Caught by Data's own standalone suite, which is
  // the only reason it did not ship.
  //
  // So probe, do not feature-test: if the real API answers, leave it
  // completely alone. That covers standalone and same-origin framing
  // alike. If it throws, we are in an opaque origin and the shim is
  // strictly better than a bare SecurityError.
  const nativeWorks = (name) => {
    try {
      const s = window[name];
      s.getItem('__foaf_probe__');
      return true;
    } catch { return false; }
  };
  const install = (name, shim) => {
    if (nativeWorks(name)) return false;
    try {
      Object.defineProperty(window, name, { value: shim, configurable: true });
      return true;
    } catch { return false; }
  };
  const installed = {
    localStorage: install('localStorage', makeShim(true)),
    // session storage is per-run by definition: never persisted, so the
    // broker never hears about it and it costs no quota.
    sessionStorage: install('sessionStorage', makeShim(false)),
  };

  // ── secrets: request / reply over postMessage ───────────────────────
  // Unlike storage there is no local mirror to read from, so every call is
  // a real round trip and returns a promise. Bounded, because a shell that
  // never answers must not leave an app awaiting forever.
  let secretSeq = 0;
  const secretWaiters = new Map();
  const reqSecret = (msg) => new Promise((resolve) => {
    if (window.parent === window) {
      // standalone: there is no shell to hold anything, and pretending
      // otherwise would invite an app to believe a token was safe
      resolve({ ok: false, reason: 'no-shell' });
      return;
    }
    const rid = `s${++secretSeq}`;
    secretWaiters.set(rid, resolve);
    setTimeout(() => {
      if (secretWaiters.delete(rid)) resolve({ ok: false, reason: 'timeout' });
    }, 4000);
    post({ ...msg, rid });
  });

  // ── verbs: ask for the outcome, never the credential ────────────────
  // Same round trip as secrets, and deliberately the same bounded shape.
  // Longer timeout because a verb is a real network request on the shell's
  // side, not a lookup.
  let verbSeq = 0;
  const verbWaiters = new Map();
  const reqVerb = (msg, ms = 30000) => new Promise((resolve) => {
    if (window.parent === window) { resolve({ ok: false, reason: 'no-shell' }); return; }
    const rid = `v${++verbSeq}`;
    verbWaiters.set(rid, resolve);
    setTimeout(() => {
      if (verbWaiters.delete(rid)) resolve({ ok: false, reason: 'timeout' });
    }, ms);
    post({ ...msg, rid });
  });

  // ── story requests: shell-mediated narrative effects ────────────────
  // A boxed narrative runtime (FinkStoryRunner) has no host reach, so a
  // tag effect that must touch the shell — launch a minigame, follow a
  // peer FINK link, navigate — is a capability-checked REQUEST, not a
  // direct call. Same bounded shape as a verb; the shell governs it by
  // the app's capabilities and answers `{ ok, reason }`.
  let storySeq = 0;
  const storyWaiters = new Map();
  const reqStory = (msg, ms = 8000) => new Promise((resolve) => {
    if (window.parent === window) { resolve({ ok: false, reason: 'no-shell' }); return; }
    const rid = `s${++storySeq}`;
    storyWaiters.set(rid, resolve);
    setTimeout(() => {
      if (storyWaiters.delete(rid)) resolve({ ok: false, reason: 'timeout' });
    }, ms);
    post({ ...msg, rid });
  });

  // ── the scoped bus: an app is a bus citizen (spec §5.7) ─────────────
  // publish limited to the app's granted namespace; inbound limited to
  // the granted shell surfaces. The HOST enforces; a denied publish is
  // dropped and announced shell-side. Standalone, both are no-ops.
  const busSubs = [];
  const busMatch = (pattern, topic) =>
    pattern === '*' || pattern === topic
    || (pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -1)));

  // ── the public surface ──────────────────────────────────────────────
  const foaf = {
    get id() { return appId; },
    get ready() { return ready; },
    can: (cap) => capabilities.has(cap),
    capabilities: () => [...capabilities],

    onInit: (fn) => {
      listeners.init.push(fn);
      // already initialised? replay, so a late (module) listener still boots
      if (ready) { try { fn(lastInitConfig || {}, foaf); } catch (err) { console.error(err); } }
      return foaf;
    },
    /** Return the state to keep; `null` declines (mid-animation, say). */
    onSnapshot: (fn) => { snapshotFn = fn; declareContract('snapshot'); return foaf; },
    /** Receive whatever was kept last time, right after init. */
    onRestore: (fn) => {
      restoreFn = fn;
      declareContract('snapshot');
      // The shell sends `restore` immediately after `init`, which can beat a
      // deferred module's registration. Hold it and replay, or the save is
      // silently dropped and reads as "nothing was ever kept".
      if (pendingRestore !== undefined) {
        const held = pendingRestore; pendingRestore = undefined;
        try { fn(held); } catch (err) { console.error(err); }
      }
      return foaf;
    },
    onSuspend: (fn) => { listeners.suspend.push(fn); return foaf; },
    onResume: (fn) => { listeners.resume.push(fn); return foaf; },
    onTerminate: (fn) => { listeners.terminate.push(fn); return foaf; },

    /**
     * Ask the shell to do something on the app's behalf.
     *
     * This is the other half of "there is no secrets.get". The app names an
     * OUTCOME — `git.commit`, `s3.put`, `solid.put` — and the shell performs
     * it using a credential the app cannot see. Note what is not sent: no
     * function (that would be reading the secret with extra steps) and no
     * host or repo (the grant decides where a verb points, so an app cannot
     * aim a valid token at somewhere it was never given).
     *
     * Resolves `{ ok: true, … }` or `{ ok: false, reason }`, where reason is
     * one of `unknown-verb`, `denied`, `bad-scope`, `bad-params`,
     * `throttled`, `no-secret`, `http` (with a `status`), `failed`, or
     * `no-shell` when running standalone. A refusal is always a named
     * answer, never silence.
     */
    invoke: (verb, detail) => reqVerb({ type: 'verb', verb, detail }),

    /** Which verbs may this app actually call, and what each one needs. */
    verbs: () => reqVerb({ type: 'verbs.list' }, 4000).then(r => r.verbs || []),

    /**
     * Secrets: hand one over, list your own by name, forget one.
     *
     * THERE IS NO `get`. A token you cannot read back is a token you
     * cannot leak, log, put in a URL, or be tricked into posting
     * somewhere by injected script. Ask the shell to USE it instead —
     * `foaf.invoke('git.commit', …)` — so the value never enters this
     * frame at all.
     *
     * Storage and secrets are separate capabilities on purpose: an app
     * that may remember preferences should not thereby get to keep
     * credentials.
     */
    secrets: {
      put: (name, value) => reqSecret({ type: 'secrets.put', name, value }),
      forget: (name) => reqSecret({ type: 'secrets.forget', name }),
      names: () => reqSecret({ type: 'secrets.names' }).then(r => r.names || []),
      get() {
        const e = new Error(
          'foafos: secrets cannot be read back. Ask the shell to use the ' +
          'secret on your behalf (foaf.invoke) so the value never enters ' +
          'this frame.');
        e.name = 'FoafSecretsNotReadable';
        throw e;
      },
    },
    /**
     * Ask the shell to perform a narrative effect — `story.launch`,
     * `story.link`, `story.navigate`. Capability-checked shell-side;
     * resolves `{ ok, reason }`. The runtime supplies data (which game,
     * which url); the shell decides whether it is allowed and does it.
     */
    storyRequest: (verb, detail) => reqStory({ type: 'story.request', verb, detail }),

    /** The scoped bus (spec §5.7). publish/subscribe over the shell bus. */
    bus: {
      publish: (topic, data = {}) => post({ type: 'bus-publish', topic, data }),
      subscribe: (pattern, cb) => {
        const sub = { pattern, cb };
        busSubs.push(sub);
        return () => { const i = busSubs.indexOf(sub); if (i >= 0) busSubs.splice(i, 1); };
      },
    },

    /**
     * Audio is a host service. Register here to receive the master level
     * ({level, volume, muted}); apply it to your own gain/element so the
     * shell's mute and volume actually reach you. Registering also DECLARES
     * the audio contract (the shell can't turn down a guest that stays
     * silent). Replays the current level if one already arrived.
     */
    onAudio: (fn) => {
      listeners.audio.push(fn);
      if (lastAudio) { try { fn(lastAudio); } catch (err) { console.error(err); } }
      return foaf;
    },

    /** Say something the shell's announcer should read out. */
    announce: (text) => window.__mgA11y?.announce?.(text),
    /** Explicit async store API for new code that does not want the shim. */
    store: {
      get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
      set: (k, v) => { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
      remove: (k) => { try { window.localStorage.removeItem(k); return true; } catch { return false; } },
      keys: () => { try { return Array.from(mem.keys()); } catch { return []; } },
    },
    _installed: installed,
  };

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'secrets.result' || d.type === 'secrets.names.result'
        || d.type === 'secrets.refused') {
      const resolve = secretWaiters.get(d.rid);
      if (resolve) { secretWaiters.delete(d.rid); resolve(d); }
      return;
    }
    if (d.type === 'verb.result' || d.type === 'verbs.result') {
      const resolve = verbWaiters.get(d.rid);
      if (resolve) { verbWaiters.delete(d.rid); resolve(d); }
      return;
    }
    if (d.type === 'story.result') {
      const resolve = storyWaiters.get(d.rid);
      if (resolve) { storyWaiters.delete(d.rid); resolve(d); }
      return;
    }
    if (d.type === 'app.snapshot') {
      // Answer even when nothing is registered: silence would make the
      // shell wait out its timeout on every close.
      let stateOut = null;
      if (snapshotFn) { try { stateOut = snapshotFn(); } catch (err) { console.error(err); } }
      post({ type: 'app.snapshot-data', rid: d.rid, state: stateOut ?? null });
      return;
    }
    if (d.type === 'app.restore') {
      if (restoreFn) { try { restoreFn(d.state); } catch (err) { console.error(err); } }
      else pendingRestore = d.state;
      return;
    }
    if (d.type === 'audio-level') {
      lastAudio = { level: d.level, volume: d.volume, muted: d.muted };
      for (const fn of [...listeners.audio]) { try { fn(lastAudio); } catch (err) { console.error(err); } }
      return;
    }
    if (d.type === 'bus-event') {
      const ev = d.event;
      if (ev && typeof ev.topic === 'string') {
        for (const sub of [...busSubs]) {
          if (busMatch(sub.pattern, ev.topic)) {
            try { sub.cb(ev); } catch (err) { console.error(err); }
          }
        }
      }
      return;
    }
    switch (d.type) {
      case 'app.init': {
        appId = d.appId || null;
        capabilities = new Set(d.capabilities || []);
        lastInitConfig = d.config || {};
        storageGranted = capabilities.has('storage');
        // Seed the synchronous view BEFORE any app callback runs, so an
        // onInit handler that immediately reads a setting sees it.
        mem.clear();
        for (const [k, v] of Object.entries(d.store || {})) mem.set(String(k), String(v));
        ready = true;
        // Declare what we speak, so the shell can adapt rather than assume
        // (the conformance rule, spec §5.1.2).
        for (const c of (d.capabilities || [])) contracts.add(c);
        post({ type: 'conformance', contracts: [...contracts] });
        listeners.init.forEach(fn => { try { fn(d.config || {}, foaf); } catch (err) { console.error(err); } });
        break;
      }
      case 'app.grant':
        capabilities = new Set(d.capabilities || []);
        storageGranted = capabilities.has('storage');
        listeners.grant.forEach(fn => { try { fn([...capabilities]); } catch (err) { console.error(err); } });
        break;
      case 'app.suspend':
        listeners.suspend.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
        break;
      case 'app.resume':
        listeners.resume.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
        break;
      case 'app.terminate':
        listeners.terminate.forEach(fn => { try { fn(d.reason); } catch (err) { console.error(err); } });
        break;
    }
  });

  window.foaf = foaf;
  // Tell the shell we exist. Until this arrives it does not know whether
  // this frame speaks the protocol at all.
  post({ type: 'app.hello', href: location.pathname });
})();
