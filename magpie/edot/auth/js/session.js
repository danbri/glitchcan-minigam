// session.js — the shared, multi-account auth session store for the edot suite
// (office editor + calendar + maps). Holds the set of currently signed-in
// identities, persists them, and broadcasts changes so every open tab/app
// reflects the same login state.
//
// Storage model (mirrors how edot stores its GitHub token, js/edot-app.js):
//   - DEFAULT: sessionStorage — tokens die when the tab closes (smaller XSS
//     blast radius; nothing lingers on a shared machine).
//   - OPT-IN "stay signed in": localStorage — survives restarts. Honestly note
//     (SECURITY.md) that any token in web storage is reachable by XSS.
//   We keep ONE active store at a time: flipping "stay signed in" migrates the
//   data and clears the other store so a token never sits in both.
//
// Cross-app sync: a BroadcastChannel('edot-auth') posts {type:'changed'} on
// every mutation; listeners reload from storage and re-render. Tabs without
// BroadcastChannel still pick up changes via the 'storage' event fallback.

const STORAGE_KEY = 'edot.auth.accounts';   // the account list
const PERSIST_KEY = 'edot.auth.persist';    // '1' => use localStorage
const ACTIVE_KEY = 'edot.auth.active';      // sub of the active account
const CHANNEL = 'edot-auth';

export class AuthSession extends EventTarget {
  constructor({ storageKey = STORAGE_KEY } = {}) {
    super();
    this._key = storageKey;
    this._channel = null;
    this.accounts = [];   // [{ sub, provider, name, email, picture, claims,
                          //    accessToken, idToken, expiresAt, ... }]
    this.activeSub = null;
    this._boot();
  }

  // ---- which Storage are we using? ----
  _persisted() { try { return localStorage.getItem(PERSIST_KEY) === '1'; } catch { return false; } }
  _store() { return this._persisted() ? localStorage : sessionStorage; }
  _otherStore() { return this._persisted() ? sessionStorage : localStorage; }

  _boot() {
    this._load();
    // BroadcastChannel keeps sibling apps/tabs in lock-step.
    try {
      this._channel = new BroadcastChannel(CHANNEL);
      this._channel.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'changed') { this._load(); this._emit(false); }
      };
    } catch { this._channel = null; }
    // Fallback for environments without BroadcastChannel.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === this._key || e.key === ACTIVE_KEY || e.key === PERSIST_KEY) {
          this._load(); this._emit(false);
        }
      });
    }
  }

  _load() {
    try {
      const raw = this._store().getItem(this._key);
      this.accounts = raw ? JSON.parse(raw) : [];
    } catch { this.accounts = []; }
    try { this.activeSub = this._store().getItem(ACTIVE_KEY) || null; } catch { this.activeSub = null; }
    // Keep `active` pointing at something real.
    if (this.activeSub && !this.accounts.find((a) => a.key === this.activeSub)) {
      this.activeSub = this.accounts.length ? this.accounts[0].key : null;
    }
  }

  _save() {
    try { this._store().setItem(this._key, JSON.stringify(this.accounts)); } catch { /* quota */ }
    try {
      if (this.activeSub) this._store().setItem(ACTIVE_KEY, this.activeSub);
      else this._store().removeItem(ACTIVE_KEY);
    } catch { /* */ }
  }

  // Notify in-page listeners (and optionally other tabs).
  _emit(broadcast = true) {
    this.dispatchEvent(new Event('change'));
    if (broadcast && this._channel) { try { this._channel.postMessage({ type: 'changed' }); } catch { /* */ } }
  }

  // A stable per-identity key: provider + sub uniquely identifies an account,
  // so the same person on two providers stays two accounts.
  static accountKey(providerId, sub) { return `${providerId}:${sub}`; }

  // ---- queries ----
  list() { return this.accounts.slice(); }
  isSignedIn() { return this.accounts.length > 0; }
  active() { return this.accounts.find((a) => a.key === this.activeSub) || this.accounts[0] || null; }
  get(key) { return this.accounts.find((a) => a.key === key) || null; }

  // ---- mutations ----
  // Add or update an identity from a completed token exchange. `claims` is the
  // validated id_token payload (or userinfo for OAuth2-only providers).
  upsertAccount({ providerId, providerName, claims = {}, tokens = {}, userinfo = {} }) {
    const sub = claims.sub || userinfo.sub || userinfo.id || claims.email || userinfo.email;
    if (!sub) throw new Error('Cannot create an account without a subject (sub)');
    const key = AuthSession.accountKey(providerId, sub);
    const profile = { ...userinfo, ...claims }; // claims win for OIDC
    const expiresAt = tokens.expires_in
      ? Date.now() + Number(tokens.expires_in) * 1000
      : (claims.exp ? claims.exp * 1000 : null);
    const account = {
      key, sub: String(sub), provider: providerId, providerName: providerName || providerId,
      name: profile.name || profile.preferred_username || profile.login || profile.email || String(sub),
      email: profile.email || null,
      picture: profile.picture || profile.avatar_url || null,
      claims, accessToken: tokens.access_token || null, idToken: tokens.id_token || null,
      tokenType: tokens.token_type || 'Bearer', scope: tokens.scope || null,
      expiresAt, addedAt: Date.now(),
    };
    const i = this.accounts.findIndex((a) => a.key === key);
    if (i >= 0) this.accounts[i] = { ...this.accounts[i], ...account, addedAt: this.accounts[i].addedAt };
    else this.accounts.push(account);
    this.activeSub = key; // newly added becomes active
    this._save(); this._emit();
    return account;
  }

  // Switch the active identity (used by the account switcher UI).
  setActive(key) {
    if (!this.accounts.find((a) => a.key === key)) return false;
    this.activeSub = key; this._save(); this._emit(); return true;
  }

  // Remove one identity. If it was active, the next one (if any) takes over.
  signOut(key) {
    const before = this.accounts.length;
    this.accounts = this.accounts.filter((a) => a.key !== key);
    if (this.activeSub === key) this.activeSub = this.accounts.length ? this.accounts[0].key : null;
    if (this.accounts.length !== before) { this._save(); this._emit(); return true; }
    return false;
  }

  // Remove every identity (full sign-out across the suite).
  signOutAll() {
    this.accounts = []; this.activeSub = null;
    this._save(); this._emit(); return true;
  }

  // True when the active (or given) account's access token has lapsed.
  isExpired(key) {
    const a = key ? this.get(key) : this.active();
    return !!(a && a.expiresAt && Date.now() >= a.expiresAt);
  }

  // Toggle "stay signed in": migrate the current data to the chosen store and
  // wipe the other, so a token is never duplicated across stores.
  setPersistent(on) {
    const data = JSON.stringify(this.accounts);
    const active = this.activeSub;
    try {
      this._otherStore().removeItem(this._key);
      this._otherStore().removeItem(ACTIVE_KEY);
    } catch { /* */ }
    try { localStorage.setItem(PERSIST_KEY, on ? '1' : '0'); } catch { /* */ }
    // _store() now reflects the new choice; write there.
    try {
      this._store().setItem(this._key, data);
      if (active) this._store().setItem(ACTIVE_KEY, active); else this._store().removeItem(ACTIVE_KEY);
    } catch { /* */ }
    this._emit();
  }
  isPersistent() { return this._persisted(); }

  // Tear down the channel (mainly for tests).
  close() { if (this._channel) { try { this._channel.close(); } catch { /* */ } this._channel = null; } }
}

// One shared instance for the whole suite (apps import this, not new AuthSession()).
let _singleton = null;
export function getAuthSession() {
  if (!_singleton) _singleton = new AuthSession();
  return _singleton;
}
