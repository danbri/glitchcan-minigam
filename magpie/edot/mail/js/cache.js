// cache.js — a tiny IndexedDB message/metadata cache (data-engine.js pattern).
//
// Data ethics (CLAUDE.md): the user's mail is cached ONLY locally, in their own
// browser's IndexedDB, and is never shipped anywhere except back to the
// configured provider. This store exists so the inbox renders instantly offline
// and re-opening a message doesn't re-hit the API. Nothing here phones home.

const DB = 'edot-mail';
const VERSION = 1;
const STORES = ['summaries', 'messages', 'mailboxes'];

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  });
}

export const MailCache = {
  // account-scoped keys so two providers don't collide.
  _k(account, key) { return `${account || 'default'}::${key}`; },

  async putMailboxes(account, list) { return tx('mailboxes', 'readwrite', (os) => os.put(list, this._k(account, 'all'))); },
  async getMailboxes(account) { return tx('mailboxes', 'readonly', (os) => os.get(this._k(account, 'all'))); },

  async putSummaries(account, mailboxId, summaries) {
    return tx('summaries', 'readwrite', (os) => os.put(summaries, this._k(account, mailboxId)));
  },
  async getSummaries(account, mailboxId) {
    return tx('summaries', 'readonly', (os) => os.get(this._k(account, mailboxId)));
  },

  async putMessage(account, msg) { return tx('messages', 'readwrite', (os) => os.put(msg, this._k(account, msg.id))); },
  async getMessage(account, id) { return tx('messages', 'readonly', (os) => os.get(this._k(account, id))); },

  async clear() {
    const db = await open();
    return Promise.all(STORES.map((s) => new Promise((res, rej) => {
      const t = db.transaction(s, 'readwrite'); t.objectStore(s).clear();
      t.oncomplete = res; t.onerror = () => rej(t.error);
    })));
  },
};
