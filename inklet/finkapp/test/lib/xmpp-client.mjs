// An outside XMPP client for the e2e tests: plain TCP, as chat-ai.py and any desktop
// client use. Accounts come from ~/foafos-xmpp/accounts.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { connect } from 'node:net';
import { join } from 'node:path';

export const accounts = Object.fromEntries(readFileSync(join(homedir(), 'foafos-xmpp/accounts'), 'utf8').split('\n')
  .filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]));

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class Client {
  /** Sign in. With `room`, join it as `nick`. */
  static async open(account, { room = null, nick = account, resource = 'e2e-bus' } = {}) {
    const c = new Client();
    c.room = room;
    c.got = '';
    c.s = connect(5222, '127.0.0.1');
    c.s.on('data', (d) => { c.got += d; });
    const stream = `<?xml version='1.0'?><stream:stream to='localhost' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams' version='1.0'>`;
    c.s.write(stream); await c.until(/<\/stream:features>/);
    c.s.write(`<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>${Buffer.from(`\0${account}\0${accounts[account]}`).toString('base64')}</auth>`);
    await c.until(/<success/);
    c.s.write(stream); await c.until(/<\/stream:features>/);
    c.s.write(`<iq type='set' id='b'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>${resource}</resource></bind></iq>`);
    await c.until(/<\/iq>/);
    c.s.write(`<presence/>`);
    if (room) {
      c.s.write(`<presence to='${room}/${nick}'><x xmlns='http://jabber.org/protocol/muc'/></presence>`);
      await c.until(/code=.110./);
    }
    return c;
  }

  async until(re, ms = 15000) {
    const t0 = Date.now();
    for (;;) {
      const m = re.exec(this.got);
      if (m) { const hit = this.got.slice(0, m.index + m[0].length); this.got = this.got.slice(m.index + m[0].length); return hit; }
      if (Date.now() - t0 > ms) throw new Error(`timed out on ${re}; have ${this.got.slice(-400)}`);
      await wait(25);
    }
  }

  /** The next whole <message> from the server that passes `pred`. */
  async message(pred, ms = 15000) {
    const t0 = Date.now();
    for (;;) {
      for (;;) {
        const m = /<message[\s\S]*?<\/message>/.exec(this.got);
        if (!m) break;
        this.got = this.got.slice(m.index + m[0].length);
        const text = unescape(m[0]);
        if (pred(text, m[0])) return text;
      }
      if (Date.now() - t0 > ms) return null;
      await wait(25);
    }
  }

  say(text) { this.s.write(`<message to='${this.room}' type='groupchat'><body>${esc(text)}</body></message>`); }
  dm(to, text) { this.s.write(`<message to='${to}' type='chat'><body>${esc(text)}</body></message>`); }
  raw(xml) { this.s.write(xml); }
  close() { try { this.s.destroy(); } catch { /* gone */ } }
}
