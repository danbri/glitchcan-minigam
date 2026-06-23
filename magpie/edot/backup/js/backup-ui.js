// backup-ui.js — <edot-backup> web component: the Tier-1 encrypted backup UI.
//
// Light DOM (so the shared edot.css + backup.css apply), no globals, mobile-first
// and accessible. It wires together:
//   snapshot.js  (collect/restore IndexedDB)  →
//   crypto.js    (passphrase envelope encrypt/decrypt)  →
//   stores/*     (put/get/list/remove over an opaque blob).
//
// The feature is ALPHA: a visible badge + a one-line warning are rendered up
// front. Passphrase loss = data loss; there is no recovery in Tier 1.

import { encryptSnapshot, decryptSnapshot, readEnvelopeHeader } from './crypto.js';
import { createSnapshot, restoreSnapshot, readSnapshotManifest } from './snapshot.js';
import { getStore, listStores } from './stores/index.js';
import { BACKENDS, defaultFields } from './backup-config.js';

const FIELD_LABELS = {
  repo: 'Repo (owner/name)', token: 'Token', dir: 'Folder', branch: 'Branch (optional)',
  endpoint: 'Endpoint', bucket: 'Bucket', region: 'Region', prefix: 'Prefix', listUrl: 'List URL',
  baseUrl: 'Base URL', user: 'User', password: 'Password',
  container: 'Pod container URL',
};
const SECRET_FIELDS = new Set(['token', 'password']);

export class EdotBackup extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this.backend = 'github';
    this.cfg = defaultFields(this.backend);
    this.render();
  }

  render() {
    this.innerHTML = `
      <section class="bk" aria-labelledby="bk-h">
        <header class="bk-head">
          <h2 id="bk-h">🔐 Encrypted backup</h2>
          <span class="bk-badge" role="status">ALPHA</span>
        </header>
        <p class="bk-warn" role="note">
          Experimental — <strong>verify your backups</strong>. Encryption is end-to-end with your
          passphrase; <strong>passphrase loss = data loss</strong> (no recovery in Tier&nbsp;1).
        </p>

        <div class="bk-row">
          <label for="bk-backend">Storage backend</label>
          <select id="bk-backend" class="bk-input">
            ${listStores().map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}
          </select>
        </div>

        <fieldset class="bk-fields" id="bk-fields">
          <legend>Backend settings</legend>
        </fieldset>
        <p class="bk-cors" id="bk-cors"></p>

        <div class="bk-row">
          <label for="bk-pass">Passphrase</label>
          <input id="bk-pass" class="bk-input" type="password" autocomplete="new-password"
                 inputmode="text" placeholder="a strong passphrase you can remember">
        </div>

        <div class="bk-actions">
          <button id="bk-backup" class="bk-btn primary" type="button">Back up now</button>
          <button id="bk-refresh" class="bk-btn" type="button">Refresh list</button>
        </div>

        <p class="bk-status" id="bk-status" role="status" aria-live="polite"></p>
        <p class="bk-fp" id="bk-fp" hidden>SHA-256: <code id="bk-fp-hex"></code></p>

        <h3 class="bk-subh">Snapshots</h3>
        <ul class="bk-list" id="bk-list" aria-label="Existing snapshots"></ul>
      </section>`;

    this.$ = (s) => this.querySelector(s);
    this.$('#bk-backend').value = this.backend;
    this.$('#bk-backend').addEventListener('change', (e) => { this.backend = e.target.value; this.cfg = defaultFields(this.backend); this.renderFields(); });
    this.$('#bk-backup').addEventListener('click', () => this.doBackup());
    this.$('#bk-refresh').addEventListener('click', () => this.refreshList());
    this.renderFields();
  }

  renderFields() {
    const fs = this.$('#bk-fields');
    const meta = BACKENDS[this.backend];
    fs.innerHTML = '<legend>Backend settings</legend>' + Object.keys(meta.fields).map((k) => {
      const v = this.cfg[k] ?? '';
      const type = SECRET_FIELDS.has(k) ? 'password' : 'text';
      const ac = SECRET_FIELDS.has(k) ? 'off' : 'on';
      return `<div class="bk-row">
        <label for="bk-f-${k}">${esc(FIELD_LABELS[k] || k)}</label>
        <input id="bk-f-${k}" class="bk-input" data-field="${k}" type="${type}"
               autocomplete="${ac}" value="${esc(String(v))}">
      </div>`;
    }).join('');
    fs.querySelectorAll('input[data-field]').forEach((inp) => {
      inp.addEventListener('input', (e) => { this.cfg[e.target.dataset.field] = e.target.value; });
    });
    this.$('#bk-cors').textContent = 'CORS: ' + meta.cors;
  }

  // Build a store cfg from the form, plus a fetchImpl so callers (and tests) can
  // inject a mock without touching the adapters.
  storeCfg(extra = {}) {
    const cfg = { ...this.cfg, ...extra };
    if (this._fetchImpl) cfg.fetchImpl = this._fetchImpl;
    return cfg;
  }

  status(msg, kind = '') { const el = this.$('#bk-status'); el.textContent = msg; el.dataset.kind = kind; }

  async doBackup() {
    const pass = this.$('#bk-pass').value;
    if (!pass) return this.status('Enter a passphrase first.', 'error');
    try {
      this.status('Collecting data…');
      const { bytes, manifest } = await createSnapshot({ indexedDB: this._indexedDB });
      this.status(`Encrypting ${manifest.totalRecords} record(s)…`);
      const envelope = await encryptSnapshot(bytes, pass);
      const bid = `${stamp()}`;
      this.status('Uploading…');
      await getStore(this.backend).put(bid, envelope, this.storeCfg());
      const fpEl = this.$('#bk-fp'); fpEl.hidden = false; this.$('#bk-fp-hex').textContent = manifest.sha256;
      this.status(`Backed up as ${bid} (${manifest.totalRecords} records).`, 'ok');
      await this.refreshList();
    } catch (e) { this.status(`Backup failed: ${e.message}`, 'error'); }
  }

  async refreshList() {
    const ul = this.$('#bk-list');
    try {
      const items = await getStore(this.backend).list(this.storeCfg());
      if (!items.length) { ul.innerHTML = '<li class="bk-empty">No snapshots yet.</li>'; return; }
      ul.innerHTML = items.map((it) => `
        <li class="bk-item">
          <span class="bk-item-id">${esc(it.id)}</span>
          <span class="bk-item-meta">${it.size != null ? fmtSize(it.size) : ''}</span>
          <button class="bk-btn small" data-act="restore" data-id="${esc(it.id)}" type="button">Restore</button>
          <button class="bk-btn small danger" data-act="remove" data-id="${esc(it.id)}" type="button">Delete</button>
        </li>`).join('');
      ul.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', (e) => {
        const { act, id } = e.target.dataset;
        if (act === 'restore') this.doRestore(id); else this.doRemove(id);
      }));
    } catch (e) { ul.innerHTML = `<li class="bk-empty">Could not list: ${esc(e.message)}</li>`; }
  }

  async doRestore(bid) {
    const pass = this.$('#bk-pass').value;
    if (!pass) return this.status('Enter the passphrase used for this backup.', 'error');
    try {
      this.status(`Downloading ${bid}…`);
      const envelope = await getStore(this.backend).get(bid, this.storeCfg());
      this.status('Decrypting…');
      const plain = await decryptSnapshot(envelope, pass);
      const manifest = await readSnapshotManifest(plain);
      this.status(`Restoring ${manifest.totalRecords} record(s)…`);
      await restoreSnapshot(plain, { indexedDB: this._indexedDB });
      this.status(`Restored ${bid} (${manifest.totalRecords} records). Reload apps to see changes.`, 'ok');
    } catch (e) { this.status(`Restore failed: ${e.message}`, 'error'); }
  }

  async doRemove(bid) {
    try { await getStore(this.backend).remove(bid, this.storeCfg()); this.status(`Deleted ${bid}.`, 'ok'); await this.refreshList(); }
    catch (e) { this.status(`Delete failed: ${e.message}`, 'error'); }
  }
}

// ---- helpers ----
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19); }
function fmtSize(n) { if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`; return `${(n / 1048576).toFixed(1)} MB`; }

if (!customElements.get('edot-backup')) customElements.define('edot-backup', EdotBackup);
