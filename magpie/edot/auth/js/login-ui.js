// login-ui.js — the auth web components for the edot suite.
//
//   <edot-login>          full sign-in panel: configured providers (icon/初),
//                         account switcher for current identities, sign-out.
//   <edot-login-button>   compact header status chip: "Sign in" or the active
//                         identity ("Signed in as Ada ▾") with a sign-out menu.
//
// Conventions (per repo CLAUDE.md + the existing edot components):
//   - vanilla ES module, class-based Web Components, NO global variables.
//   - LIGHT DOM (not shadow) so the shared auth.css / edot.css cascade applies,
//     matching how edot's data components style themselves.
//   - mobile-first, keyboard accessible, ARIA-labelled, graceful fallbacks.
//
// The components are presentation only. They delegate flow to OidcClient and
// state to the shared AuthSession, so they work the same in every suite app.

import { getProvider, listProviders, hasUnresolvedPlaceholders } from './providers.js';
import { OidcClient } from './oidc.js';
import { createPkcePair } from './pkce.js';
import { getAuthSession } from './session.js';
import { AUTH_CONFIG, resolveRedirectUri, configuredProviderIds } from '../auth-config.js';

// Merge a preset with its deployer overrides from auth-config.js.
export function resolveProvider(id) {
  const base = getProvider(id);
  if (!base) return null;
  const over = (AUTH_CONFIG.providers && AUTH_CONFIG.providers[id]) || {};
  const merged = { ...base, ...over };
  if (over.scopes) merged.scopes = [...over.scopes];
  return merged;
}

// Begin a login: build the authorize URL and navigate. Kept exported so apps
// can trigger sign-in without the UI (e.g. from a custom button).
export async function beginLogin(providerId, { navigate = true } = {}) {
  const provider = resolveProvider(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  if (hasUnresolvedPlaceholders(provider)) {
    throw new Error(`Provider "${providerId}" has unresolved {placeholders} — set its issuer/endpoints in auth-config.js`);
  }
  const client = new OidcClient(provider);
  const pkce = await createPkcePair();
  const url = await client.startLogin({
    clientId: provider.clientId,
    redirectUri: resolveRedirectUri(),
    scopes: provider.scopes,
    pkce,
  });
  if (navigate && typeof location !== 'undefined') location.assign(url);
  return url;
}

// A small SVG-free avatar: provider initials in a coloured chip, or the
// account picture when present.
function avatarHTML(account, provider) {
  if (account && account.picture) {
    return `<img class="auth-avatar" alt="" src="${escapeAttr(account.picture)}">`;
  }
  const initials = (account && initialsFor(account.name))
    || (provider && provider.initials) || '?';
  const color = (provider && provider.color) || '#555';
  return `<span class="auth-avatar auth-avatar--initials" aria-hidden="true"
    style="background:${escapeAttr(color)}">${escapeHtml(initials)}</span>`;
}

function initialsFor(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ? p[0].toUpperCase() : '').join('');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------------------------------------------------------------------------
// <edot-login> — the full panel.
// ---------------------------------------------------------------------------
export class EdotLogin extends HTMLElement {
  connectedCallback() {
    this.session = getAuthSession();
    this._onChange = () => this.render();
    this.session.addEventListener('change', this._onChange);
    this.addEventListener('click', (e) => this._onClick(e));
    this.render();
  }
  disconnectedCallback() {
    if (this.session) this.session.removeEventListener('change', this._onChange);
  }

  // Which providers to offer: those configured in auth-config.js, else (for a
  // demo with nothing configured yet) the full preset list, visibly disabled.
  _providerList() {
    const configured = configuredProviderIds();
    if (configured.length) return configured.map((id) => resolveProvider(id)).filter(Boolean);
    return listProviders(); // demo mode: show all, mark as unconfigured
  }

  render() {
    const accounts = this.session.list();
    const active = this.session.active();
    const providers = this._providerList();
    const anyConfigured = configuredProviderIds().length > 0;

    this.innerHTML = `
      <section class="auth-panel" aria-label="Account sign-in">
        ${accounts.length ? `
          <h2 class="auth-h">Signed in</h2>
          <ul class="auth-accounts" role="list">
            ${accounts.map((a) => this._accountRow(a, active)).join('')}
          </ul>
          <button type="button" class="auth-btn auth-btn--ghost" data-act="signout-all">Sign out of all accounts</button>
          <h2 class="auth-h auth-h--add">Add another account</h2>
        ` : `
          <h2 class="auth-h">Sign in</h2>
          <p class="auth-sub">Choose a provider to continue.</p>
        `}
        <ul class="auth-providers" role="list">
          ${providers.map((p) => this._providerRow(p, anyConfigured)).join('')}
        </ul>
        ${anyConfigured ? '' : `
          <p class="auth-note" role="note">
            No real providers configured yet. Set a client ID in
            <code>auth/auth-config.js</code> (e.g. Google/Microsoft) to enable real sign-in.
          </p>`}
        <div class="auth-demo">
          <button type="button" class="auth-btn auth-btn--ghost" data-act="demo">Try a demo identity (local only)</button>
          <p class="auth-note auth-note--demo" role="note">Creates a fake, on-device identity so you can explore the suite and watch it flow into <strong>Connections</strong>. Not a real sign-in — nothing leaves your device.</p>
        </div>
      </section>`;
  }

  _accountRow(a, active) {
    const provider = getProvider(a.provider);
    const isActive = active && active.key === a.key;
    const expired = this.session.isExpired(a.key);
    return `
      <li class="auth-account ${isActive ? 'is-active' : ''}" role="listitem">
        <button type="button" class="auth-account-main" data-act="switch" data-key="${escapeAttr(a.key)}"
          aria-pressed="${isActive ? 'true' : 'false'}">
          ${avatarHTML(a, provider)}
          <span class="auth-account-text">
            <span class="auth-account-name">${escapeHtml(a.name)}</span>
            <span class="auth-account-meta">${escapeHtml(a.email || a.providerName)}${expired ? ' · session expired' : ''}</span>
          </span>
          ${isActive ? '<span class="auth-active-dot" aria-label="active account">●</span>' : ''}
        </button>
        <button type="button" class="auth-icon-btn" data-act="signout" data-key="${escapeAttr(a.key)}"
          aria-label="Sign out of ${escapeAttr(a.name)}">✕</button>
      </li>`;
  }

  _providerRow(p, anyConfigured) {
    const unconfigured = anyConfigured ? false : true;
    const blocked = hasUnresolvedPlaceholders(p);
    const disabled = unconfigured || blocked;
    const warn = p.corsTokenEndpoint === false
      ? ' <span class="auth-warn" title="This provider may need a token-exchange proxy in a browser">⚠</span>' : '';
    return `
      <li role="listitem">
        <button type="button" class="auth-provider" data-act="login" data-provider="${escapeAttr(p.id)}"
          ${disabled ? 'disabled aria-disabled="true"' : ''}
          title="${blocked ? 'Set issuer/endpoints in auth-config.js' : `Sign in with ${escapeAttr(p.name)}`}">
          ${avatarHTML(null, p)}
          <span class="auth-provider-name">${escapeHtml(p.name)}${warn}</span>
          <span class="auth-provider-go" aria-hidden="true">→</span>
        </button>
      </li>`;
  }

  async _onClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    try {
      if (act === 'login') {
        btn.disabled = true;
        await beginLogin(btn.dataset.provider);
      } else if (act === 'switch') {
        this.session.setActive(btn.dataset.key);
      } else if (act === 'signout') {
        this.session.signOut(btn.dataset.key);
      } else if (act === 'signout-all') {
        this.session.signOutAll();
      } else if (act === 'demo') {
        // A clearly-labelled, on-device only identity: no network, no real IdP.
        // Lets the identity → Connections story work before a client-id is set.
        this.session.upsertAccount({
          providerId: 'demo', providerName: 'Demo (local only)',
          claims: { sub: 'demo-user', name: 'You (demo)', email: 'demo@edot.local' },
        });
        this._toast('Demo identity created — signed in locally (not a real account).');
      }
    } catch (err) {
      this._toast(err.message || String(err));
      btn.disabled = false;
    }
  }

  _toast(msg) {
    let el = this.querySelector('.auth-toast');
    if (!el) { el = document.createElement('div'); el.className = 'auth-toast'; el.setAttribute('role', 'alert'); this.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 5000);
  }
}

// ---------------------------------------------------------------------------
// <edot-login-button> — compact header status chip + dropdown.
// ---------------------------------------------------------------------------
export class EdotLoginButton extends HTMLElement {
  connectedCallback() {
    this.session = getAuthSession();
    this._onChange = () => this.render();
    this.session.addEventListener('change', this._onChange);
    this.addEventListener('click', (e) => this._onClick(e));
    document.addEventListener('click', this._docClose = (e) => {
      if (!this.contains(e.target)) this._setOpen(false);
    });
    this.render();
  }
  disconnectedCallback() {
    if (this.session) this.session.removeEventListener('change', this._onChange);
    document.removeEventListener('click', this._docClose);
  }

  _setOpen(open) {
    this._open = open;
    const menu = this.querySelector('.auth-chip-menu');
    if (menu) menu.hidden = !open;
    const chip = this.querySelector('.auth-chip');
    if (chip) chip.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  render() {
    const active = this.session.active();
    const accounts = this.session.list();
    if (!active) {
      // The "where do I send people to sign in" link is configurable; default
      // to login.html beside the module so the chip works standalone.
      const loginHref = this.getAttribute('login-href') || new URL('../login.html', import.meta.url).href;
      this.innerHTML = `
        <a class="auth-chip auth-chip--signin" href="${escapeAttr(loginHref)}">
          <span class="auth-chip-label">Sign in</span>
        </a>`;
      return;
    }
    const provider = getProvider(active.provider);
    this.innerHTML = `
      <button type="button" class="auth-chip" aria-haspopup="menu" aria-expanded="false"
        aria-label="Account menu for ${escapeAttr(active.name)}">
        ${avatarHTML(active, provider)}
        <span class="auth-chip-label">${escapeHtml(active.name)}</span>
        <span class="auth-chip-caret" aria-hidden="true">▾</span>
      </button>
      <div class="auth-chip-menu" role="menu" hidden>
        ${accounts.length > 1 ? `
          <div class="auth-chip-section" role="group" aria-label="Switch account">
            ${accounts.map((a) => `
              <button type="button" role="menuitemradio" aria-checked="${a.key === active.key}"
                class="auth-chip-item ${a.key === active.key ? 'is-active' : ''}"
                data-act="switch" data-key="${escapeAttr(a.key)}">
                ${avatarHTML(a, getProvider(a.provider))}
                <span class="auth-chip-item-text">${escapeHtml(a.name)}</span>
              </button>`).join('')}
          </div>` : ''}
        <button type="button" role="menuitem" class="auth-chip-item" data-act="signout" data-key="${escapeAttr(active.key)}">Sign out</button>
        ${accounts.length > 1 ? '<button type="button" role="menuitem" class="auth-chip-item" data-act="signout-all">Sign out of all</button>' : ''}
      </div>`;
  }

  _onClick(e) {
    const chip = e.target.closest('.auth-chip');
    if (chip && chip.tagName === 'BUTTON') { this._setOpen(!this._open); return; }
    const item = e.target.closest('button[data-act]');
    if (!item) return;
    const act = item.dataset.act;
    if (act === 'switch') this.session.setActive(item.dataset.key);
    else if (act === 'signout') this.session.signOut(item.dataset.key);
    else if (act === 'signout-all') this.session.signOutAll();
    this._setOpen(false);
  }
}

// Register once (idempotent — multiple apps may import this module).
if (typeof customElements !== 'undefined') {
  if (!customElements.get('edot-login')) customElements.define('edot-login', EdotLogin);
  if (!customElements.get('edot-login-button')) customElements.define('edot-login-button', EdotLoginButton);
}
