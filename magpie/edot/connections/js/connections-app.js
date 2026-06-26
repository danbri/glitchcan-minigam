// connections-app.js — <edot-connections>: the ONE surface that shows every
// account/provider across the suite — where your data lives and how you reach it.
//
// Reads the live Connections registry over the kernel (capabilities.invoke
// 'connections.list') and lets you ADD a connection from the PROVIDERS catalogue
// (ontology.js). It is HONEST: the local OPFS "device" account is real and
// always present; wiring real REMOTE auth (oauth/keys/password/webid) is a TODO,
// so adding a remote provider shows its credential fields and a clear note
// instead of faking a successful connection.
//
// Light-DOM custom element (house style), mobile-first, accessible. Subscribes
// to the kernel bus topic 'connections:changed' so it re-renders when accounts
// are added/removed elsewhere (e.g. Backup registering a backend).
import { getKernel } from '../../js/edot-kernel.js';
import { getConnections } from '../../js/connections.js';
import { PROVIDERS, CAPABILITIES } from '../../js/ontology.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Human labels for capabilities + a glyph (text always present for a11y).
const CAP_LABEL = { storage: 'Storage', mail: 'Mail', calendar: 'Calendar', chat: 'Chat', people: 'People', vcs: 'Version control' };
const CAP_ICON = { storage: '🗄', mail: '✉', calendar: '📅', chat: '💬', people: '👥', vcs: '⎇' };
const capLabel = (c) => CAP_LABEL[c] || c;

// What each auth kind needs, so we can render honest credential fields.
const AUTH = {
  none: { label: 'No login', fields: [], note: '' },
  grant: { label: 'Device permission', fields: [], note: 'Granted by your browser/OS when you pick a folder.' },
  oauth: { label: 'Sign in (OAuth)', fields: [], note: 'Opens the provider’s sign-in. Not wired up yet.' },
  keys: { label: 'Access keys', fields: [{ name: 'endpoint', label: 'Endpoint', type: 'text' }, { name: 'accessKey', label: 'Access key ID', type: 'text' }, { name: 'secretKey', label: 'Secret access key', type: 'password' }] },
  password: { label: 'Username & password', fields: [{ name: 'url', label: 'Server URL', type: 'text' }, { name: 'username', label: 'Username', type: 'text' }, { name: 'password', label: 'Password', type: 'password' }] },
  webid: { label: 'WebID / pod', fields: [{ name: 'webid', label: 'WebID or pod URL', type: 'text' }] },
};
const authLabel = (a) => (AUTH[a] && AUTH[a].label) || a;
const requiresAuthKind = (a) => a !== 'none' && a !== 'grant';

class EdotConnections extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return; this._mounted = true;
    // Ensure the registry exists (seeds the local OPFS "device" account + wires kernel).
    try { getConnections(); } catch (_) {}
    this.kernel = getKernel();
    this._picked = null;       // currently selected provider id in the Add panel
    this.render();
    this.refresh();
    // Re-render when accounts change anywhere in the suite.
    try { this._unsub = this.kernel.bus.subscribe('connections:changed', () => this.refresh()); } catch (_) {}
  }
  disconnectedCallback() { if (this._unsub) { try { this._unsub(); } catch (_) {} this._unsub = null; } }

  // Pull the live account view over the kernel capability.
  _accounts() {
    try { const r = this.kernel.capabilities.invoke('connections.list', {}); return Array.isArray(r) ? r : []; } catch (_) { return []; }
  }
  // The Identity axis: signed-in OIDC identities (from AuthSession via Connections).
  _identities() {
    try { const r = this.kernel.capabilities.invoke('connections.identities', {}); return Array.isArray(r) ? r : []; } catch (_) { return []; }
  }

  refresh() {
    const accts = this._accounts();
    const idents = this._identities();
    const list = this.querySelector('.cx-list'); if (!list) return;
    list.innerHTML = '';
    if (idents.length) list.appendChild(this._identitySection(idents));
    const local = accts.filter((a) => a.isLocal);
    const remote = accts.filter((a) => !a.isLocal);
    if (local.length) list.appendChild(this._section('On this device', local));
    if (remote.length) list.appendChild(this._section('Platforms', remote));
    if (!accts.length) {
      const e = document.createElement('li'); e.className = 'cx-empty'; e.textContent = 'No connections yet.';
      list.appendChild(e);
    }
    const who = idents.length ? ` — signed in as ${idents.find((i) => i.active)?.name || idents[0].name}` : '';
    this._setStatus(`${accts.length} connection${accts.length === 1 ? '' : 's'} — ${local.length} on this device, ${remote.length} platform${remote.length === 1 ? '' : 's'}${who}.`);
  }

  // Who is signed in (OIDC). These identities BACK platform accounts; they are
  // shown distinctly because an identity is not itself a capability provider.
  _identitySection(idents) {
    const li = document.createElement('li'); li.className = 'cx-group cx-group-identity'; li.setAttribute('role', 'presentation');
    const h = document.createElement('h2'); h.className = 'cx-group-h'; h.textContent = 'Signed in';
    const ul = document.createElement('ul'); ul.className = 'cx-group-list'; ul.setAttribute('role', 'list'); ul.setAttribute('aria-label', 'Signed-in identities');
    for (const id of idents) {
      const row = document.createElement('li'); row.className = 'cx-identity' + (id.active ? ' cx-identity-active' : ''); row.setAttribute('role', 'listitem');
      const pic = id.picture ? `<img class="cx-id-pic" src="${esc(id.picture)}" alt="" width="28" height="28">` : '<span class="cx-id-pic cx-id-pic-ph" aria-hidden="true">👤</span>';
      row.innerHTML = `
        ${pic}
        <span class="cx-id-main">
          <span class="cx-id-name">${esc(id.name || id.sub)}</span>
          <span class="cx-id-meta">${esc(id.email || id.sub || '')}${id.providerName ? ' · ' + esc(id.providerName) : ''}</span>
        </span>
        ${id.active ? '<span class="cx-badge cx-badge-local">CURRENT</span>' : ''}`;
      ul.appendChild(row);
    }
    li.appendChild(h); li.appendChild(ul);
    return li;
  }

  _section(title, accts) {
    const li = document.createElement('li'); li.className = 'cx-group'; li.setAttribute('role', 'presentation');
    const h = document.createElement('h2'); h.className = 'cx-group-h'; h.textContent = title;
    const ul = document.createElement('ul'); ul.className = 'cx-group-list'; ul.setAttribute('role', 'list'); ul.setAttribute('aria-label', title);
    for (const a of accts) ul.appendChild(this._accountRow(a));
    li.appendChild(h); li.appendChild(ul);
    return li;
  }

  _accountRow(a) {
    const li = document.createElement('li');
    li.className = 'cx-acct' + (a.id === 'device' ? ' cx-device' : '');
    li.setAttribute('role', 'listitem');
    li.dataset.id = a.id;
    const provLabel = (PROVIDERS[a.provider] && PROVIDERS[a.provider].label) || a.provider;
    const localBadge = a.isLocal
      ? '<span class="cx-badge cx-badge-local">LOCAL</span>'
      : '<span class="cx-badge cx-badge-remote">PLATFORM</span>';
    const authBadge = a.requiresAuth
      ? '<span class="cx-auth cx-auth-needed">🔑 sign-in needed</span>'
      : '<span class="cx-auth cx-auth-open">no login</span>';
    const chips = (a.offers || []).map((c) =>
      `<li class="cx-chip" role="listitem"><span class="cx-chip-ic" aria-hidden="true">${CAP_ICON[c] || '•'}</span>${esc(capLabel(c))}</li>`).join('');
    li.innerHTML = `
      <div class="cx-acct-top">
        <span class="cx-acct-label">${esc(a.label || a.id)}</span>
        ${localBadge}
      </div>
      <div class="cx-acct-meta">
        <span class="cx-prov">${esc(provLabel)}</span>
        ${authBadge}
      </div>
      <ul class="cx-chips" role="list" aria-label="Offers">${chips}</ul>`;
    return li;
  }

  _setStatus(msg) { const s = this.querySelector('.cx-status'); if (s) s.textContent = msg || ''; }

  // ---- UI shell ----
  render() {
    this.innerHTML = `
      <div class="cx-app">
        <header class="cx-head">
          <h1 class="cx-title">Connections</h1>
          <button class="cx-add-btn" type="button" aria-expanded="false">＋ Add connection</button>
        </header>
        <div class="cx-status" role="status" aria-live="polite"></div>
        <ul class="cx-list" role="list" aria-label="Your connections"></ul>
        <section class="cx-add" hidden aria-label="Add a connection"></section>
      </div>`;
    this._addBtn = this.querySelector('.cx-add-btn');
    this._addBtn.addEventListener('click', () => this._toggleAdd());
  }

  _toggleAdd() {
    const panel = this.querySelector('.cx-add');
    if (!panel.hidden) { panel.hidden = true; this._addBtn.setAttribute('aria-expanded', 'false'); return; }
    this._picked = null;
    panel.hidden = false; this._addBtn.setAttribute('aria-expanded', 'true');
    this._renderPicker();
  }

  // The provider picker, grouped by kind: "On this device" (os) vs "Platforms".
  _renderPicker() {
    const panel = this.querySelector('.cx-add');
    const groups = { os: [], platform: [] };
    for (const [id, p] of Object.entries(PROVIDERS)) (groups[p.kind] || (groups[p.kind] = [])).push([id, p]);
    const optGroup = (label, items) => items.length ? `
      <fieldset class="cx-picker-group">
        <legend>${esc(label)}</legend>
        <div class="cx-picker-grid">
          ${items.map(([id, p]) => `
            <button class="cx-prov-pick" type="button" data-provider="${esc(id)}" aria-pressed="false">
              <span class="cx-prov-pick-label">${esc(p.label)}</span>
              <span class="cx-prov-pick-offers">${(p.offers || []).map((c) => esc(capLabel(c))).join(' · ')}</span>
              <span class="cx-prov-pick-auth">${esc(authLabel(p.auth))}</span>
            </button>`).join('')}
        </div>
      </fieldset>` : '';
    panel.innerHTML = `
      <div class="cx-add-h">
        <h2>Add a connection</h2>
        <button class="cx-add-close" type="button" aria-label="Close">✕</button>
      </div>
      <p class="cx-add-intro">Pick a provider — where your data lives and how you reach it.</p>
      ${optGroup('On this device', groups.os)}
      ${optGroup('Platforms', groups.platform)}
      <div class="cx-detail" role="region" aria-live="polite"></div>`;
    panel.querySelector('.cx-add-close').addEventListener('click', () => this._toggleAdd());
    panel.querySelectorAll('.cx-prov-pick').forEach((b) =>
      b.addEventListener('click', () => this._pickProvider(b.dataset.provider)));
  }

  _pickProvider(providerId) {
    this._picked = providerId;
    const p = PROVIDERS[providerId]; if (!p) return;
    const panel = this.querySelector('.cx-add');
    panel.querySelectorAll('.cx-prov-pick').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.provider === providerId)));
    const detail = panel.querySelector('.cx-detail');
    const auth = AUTH[p.auth] || { label: p.auth, fields: [], note: '' };
    const chips = (p.offers || []).map((c) =>
      `<span class="cx-chip cx-chip-static"><span class="cx-chip-ic" aria-hidden="true">${CAP_ICON[c] || '•'}</span>${esc(capLabel(c))}</span>`).join('');
    const fields = auth.fields.map((f) => `
      <label class="cx-field">${esc(f.label)}
        <input class="cx-input" type="${esc(f.type)}" name="${esc(f.name)}" autocomplete="off">
      </label>`).join('');

    // Honesty: only the local OPFS provider can actually connect here. Everything
    // else is a real provider whose remote auth is a documented TODO.
    const canConnectLocally = (providerId === 'opfs');
    let actionHtml;
    if (canConnectLocally) {
      actionHtml = `<button class="cx-connect" type="button" data-provider="${esc(providerId)}">Add this device’s storage</button>`;
    } else {
      actionHtml = `
        <p class="cx-todo" role="note">⚠ Real ${esc(authLabel(p.auth))} for ${esc(p.label)} isn’t wired up yet — this is a known TODO.
        These fields show what a real connection would need; submitting won’t create a working remote account.</p>
        <button class="cx-connect cx-connect-disabled" type="button" disabled aria-disabled="true">Connect (not available yet)</button>`;
    }

    detail.innerHTML = `
      <div class="cx-detail-card">
        <h3 class="cx-detail-title">${esc(p.label)}</h3>
        <p class="cx-detail-line"><span class="cx-badge ${p.locality === 'local' ? 'cx-badge-local' : 'cx-badge-remote'}">${p.locality === 'local' ? 'LOCAL' : 'PLATFORM'}</span>
          <span class="cx-detail-auth">${esc(authLabel(p.auth))}${requiresAuthKind(p.auth) ? ' · sign-in needed' : ' · no login'}</span></p>
        <div class="cx-detail-offers"><span class="cx-detail-offers-h">Offers</span> ${chips}</div>
        ${auth.note ? `<p class="cx-detail-note">${esc(auth.note)}</p>` : ''}
        ${fields ? `<div class="cx-fields">${fields}</div>` : ''}
        ${actionHtml}
      </div>`;
    const connectBtn = detail.querySelector('.cx-connect:not([disabled])');
    if (connectBtn) connectBtn.addEventListener('click', () => this._connectLocal(providerId));
  }

  // Only honest local connect: add another OPFS-backed device storage account.
  async _connectLocal(providerId) {
    if (providerId !== 'opfs') return;
    try {
      const { OpfsResourceSource } = await import('../../js/resource-source.js');
      const conn = getConnections();
      const id = 'device-' + Date.now().toString(36);
      conn.add({ id, provider: 'opfs', label: 'App private storage', sources: { storage: new OpfsResourceSource({ id }) } });
      // conn.add publishes 'connections:changed', which triggers refresh().
      this._toggleAdd();
      this._setStatus('Added local app-private storage.');
    } catch (e) { this._setStatus('Could not add local storage: ' + e.message); }
  }
}

// Expose the catalogue surface for tests/inspection.
EdotConnections.CAPABILITIES = CAPABILITIES;

if (!customElements.get('edot-connections')) customElements.define('edot-connections', EdotConnections);
export { EdotConnections };
