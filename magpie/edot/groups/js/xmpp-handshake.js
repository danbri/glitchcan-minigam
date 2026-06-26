// xmpp-handshake.js — the XMPP-over-WebSocket (RFC 7395) login state machine:
//   <open> → stream:features → SASL (SCRAM-SHA-1 / PLAIN) → restart → bind →
//   initial presence → ready.
//
// It is a pure reducer: feed it inbound stanza text via receive(), it returns the
// outbound stanza text to send plus any lifecycle event. No sockets here, so the
// whole login sequence is unit-testable against a scripted server (and the same
// code drives a real WebSocket in transport.js). Stream-framing detection uses
// targeted extraction on the few control elements (features/challenge/success/
// bind) — message stanzas are parsed properly (DOMParser) in the app layer.

import { ScramSha1, plainResponse, base64, base64decode } from './sasl.js';

const td = new TextDecoder();
const te = new TextEncoder();
const b64encStr = (s) => base64(te.encode(s));
const b64decStr = (s) => td.decode(base64decode(s));

const FRAMING = 'urn:ietf:params:xml:ns:xmpp-framing';

export class XmppHandshake {
  // nonceFn lets tests pin the SCRAM client nonce; the app passes a random one.
  constructor({ jid, password, domain, resource = 'edot', nonceFn } = {}) {
    this.jid = jid;
    this.local = (jid || '').split('@')[0];
    this.domain = domain || (jid || '').split('@')[1] || '';
    this.password = password;
    this.resource = resource;
    this.nonceFn = nonceFn || (() => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    this.state = 'init';
    this.boundJid = null;
  }

  // The opening frame(s) to send once the socket is up.
  start() {
    this.state = 'opening';
    return [`<open xmlns='${FRAMING}' to='${this.domain}' version='1.0'/>`];
  }

  // Process one inbound chunk; returns { out:[…], event?, jid?, error? }.
  receive(xml) {
    const s = String(xml);
    // SASL failure at any point.
    if (/<failure[^>]*xmlns=['"]urn:ietf:params:xml:ns:xmpp-sasl/.test(s) || /<stream:error/.test(s)) {
      this.state = 'error';
      return { out: [], event: 'failure', error: this._failureReason(s) };
    }

    if (this.state === 'opening' || this.state === 'reopening') {
      // Wait for stream:features. (The <open/> ack alone carries no features.)
      if (!/<(stream:)?features/.test(s)) return { out: [] };
      return this.state === 'opening' ? this._onPreAuthFeatures(s) : this._onPostAuthFeatures(s);
    }

    if (this.state === 'scram-first') {
      const ch = /<challenge[^>]*>([^<]*)<\/challenge>/.exec(s);
      if (!ch) return { out: [] };
      return this._scramChallenge(ch[1]);
    }

    if (this.state === 'authenticating' || this.state === 'scram-final') {
      if (/<success/.test(s)) return this._onSuccess(s);
      return { out: [] };
    }

    if (this.state === 'binding') {
      const jid = /<jid>([^<]+)<\/jid>/.exec(s);
      if (jid) {
        this.boundJid = jid[1];
        this.state = 'ready';
        // Initial presence; ready to join MIX channels.
        return { out: ["<presence/>"], event: 'ready', jid: this.boundJid };
      }
      return { out: [] };
    }
    return { out: [] };
  }

  _mechanisms(s) {
    const out = []; const re = /<mechanism>([^<]+)<\/mechanism>/g; let m;
    while ((m = re.exec(s))) out.push(m[1].toUpperCase());
    return out;
  }

  _onPreAuthFeatures(s) {
    const mechs = this._mechanisms(s);
    if (mechs.includes('SCRAM-SHA-1')) {
      this._scram = new ScramSha1(this.local, this.password, this.nonceFn());
      this.state = 'scram-first';
      return { out: [`<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='SCRAM-SHA-1'>${b64encStr(this._scram.clientFirstMessage())}</auth>`] };
    }
    if (mechs.includes('PLAIN')) {
      this.state = 'authenticating';
      return { out: [`<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>${plainResponse(this.local, this.password)}</auth>`] };
    }
    this.state = 'error';
    return { out: [], event: 'failure', error: 'no supported SASL mechanism' };
  }

  async _scramChallenge(challengeB64) {
    const serverFirst = b64decStr(challengeB64);
    let clientFinal;
    try { clientFinal = await this._scram.clientFinal(serverFirst); }
    catch (e) { this.state = 'error'; return { out: [], event: 'failure', error: e.message }; }
    this.state = 'scram-final';
    return { out: [`<response xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>${b64encStr(clientFinal)}</response>`] };
  }

  _onSuccess(s) {
    // SCRAM: verify the server signature carried in <success>v=…</success>.
    if (this._scram) {
      const v = /<success[^>]*>([^<]*)<\/success>/.exec(s);
      const serverFinal = v && v[1] ? b64decStr(v[1]) : '';
      if (serverFinal && !this._scram.verifyServerFinal(serverFinal)) {
        this.state = 'error';
        return { out: [], event: 'failure', error: 'SCRAM: server signature mismatch' };
      }
    }
    // Restart the stream after auth, then expect bind in the new features.
    this.state = 'reopening';
    return { out: [`<open xmlns='${FRAMING}' to='${this.domain}' version='1.0'/>`], event: 'authenticated' };
  }

  _onPostAuthFeatures(s) {
    if (!/<bind/.test(s)) return { out: [] };
    this.state = 'binding';
    return { out: [`<iq type='set' id='bind1'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>${this.resource}</resource></bind></iq>`] };
  }

  _failureReason(s) {
    const m = /<failure[^>]*><([a-z-]+)/i.exec(s) || /<stream:error><([a-z-]+)/i.exec(s);
    return m ? m[1] : 'authentication failed';
  }
}
