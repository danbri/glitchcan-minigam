// index.js — the adapter registry. Maps a backend id to its class so the UI can
// instantiate the right one from config without importing each adapter by hand.
// Every adapter shares the MailAdapter interface (base.js), so callers stay
// provider-agnostic.

import { GmailAdapter } from './gmail.js';
import { GraphAdapter } from './graph.js';
import { JmapAdapter } from './jmap.js';
import { ImapAdapter } from './imap.js';

export const ADAPTERS = {
  gmail: GmailAdapter,
  graph: GraphAdapter,
  jmap: JmapAdapter,
  imap: ImapAdapter,
};

// A short, honest description of each backend's transport posture, for the UI.
export const BACKEND_INFO = {
  gmail: { name: 'Gmail', transport: 'Browser-direct (CORS + OAuth bearer)', needs: 'Google client ID + gmail.modify scope' },
  graph: { name: 'Microsoft 365 / Outlook', transport: 'Browser-direct (CORS + OAuth bearer)', needs: 'Azure client ID + Mail.Read/Mail.Send scopes' },
  jmap: { name: 'JMAP (Fastmail / Stalwart / James)', transport: 'Browser-direct when server sends CORS', needs: 'Session URL + API token' },
  imap: { name: 'IMAP / SMTP', transport: 'Requires a WebSocket proxy (browsers cannot open raw TCP)', needs: 'Proxy URL + IMAP/SMTP credentials' },
};

/**
 * createAdapter(id, config, { fetchImpl }) → a MailAdapter instance.
 * `config` carries tokens/URLs; `fetchImpl` is injectable for tests.
 */
export function createAdapter(id, config = {}, opts = {}) {
  const Cls = ADAPTERS[id];
  if (!Cls) throw new Error(`Unknown mail backend: ${id}`);
  return new Cls(config, opts);
}

export function listBackends() {
  return Object.keys(ADAPTERS).map((id) => ({ id, ...BACKEND_INFO[id] }));
}
