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

  const listeners = { init: [], grant: [], suspend: [], resume: [], terminate: [] };
  let appId = null;
  let capabilities = new Set();
  let ready = false;

  const post = (msg) => {
    try { if (window.parent !== window) window.parent.postMessage(msg, '*'); }
    catch { /* standalone */ }
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

  // ── the public surface ──────────────────────────────────────────────
  const foaf = {
    get id() { return appId; },
    get ready() { return ready; },
    can: (cap) => capabilities.has(cap),
    capabilities: () => [...capabilities],

    onInit: (fn) => { listeners.init.push(fn); return foaf; },
    onSuspend: (fn) => { listeners.suspend.push(fn); return foaf; },
    onResume: (fn) => { listeners.resume.push(fn); return foaf; },
    onTerminate: (fn) => { listeners.terminate.push(fn); return foaf; },

    /** Ask the shell to do something on the app's behalf (a verb). */
    invoke: (verb, detail) => post({ type: 'verb', verb, detail }),

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
    switch (d.type) {
      case 'app.init': {
        appId = d.appId || null;
        capabilities = new Set(d.capabilities || []);
        storageGranted = capabilities.has('storage');
        // Seed the synchronous view BEFORE any app callback runs, so an
        // onInit handler that immediately reads a setting sees it.
        mem.clear();
        for (const [k, v] of Object.entries(d.store || {})) mem.set(String(k), String(v));
        ready = true;
        // Declare what we speak, so the shell can adapt rather than assume
        // (the conformance rule, spec §5.1.2).
        post({ type: 'conformance', contracts: ['app', ...(d.capabilities || [])] });
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
