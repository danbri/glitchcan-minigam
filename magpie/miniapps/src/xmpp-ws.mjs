// Minimal XMPP client over WebSocket (RFC 7395) for the browser, and a
// fetch()-shaped function that carries HTTP requests as XEP-0332 IQs.
//
//   const x = await XmppWs.connect({ url: 'wss://relay.example/xmpp-websocket',
//                                    domain: 'relay.example', username, password });
//   const podFetch = x.httpFetch({ jid: 'pod@relay.example/lws', base: 'https://pod.example/' });
//   const res = await podFetch('https://pod.example/apps/', { headers: { Accept: 'application/lws+json' } });
//
// Covers: framing, SASL SCRAM-SHA-256 / SCRAM-SHA-1 (WebCrypto, server signature
// checked), resource binding, presence, IQ request/response. Not covered: stream
// management, reconnection, XEP-0332 chunked bodies. Browser only (DOMParser).
// Design and limits: magpie/miniapps/lws/README.md.

const NS_FRAMING = 'urn:ietf:params:xml:ns:xmpp-framing';
const NS_SASL = 'urn:ietf:params:xml:ns:xmpp-sasl';
const NS_BIND = 'urn:ietf:params:xml:ns:xmpp-bind';
const NS_HTTP = 'urn:xmpp:http';
const NS_SHIM = 'http://jabber.org/protocol/shim';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = new TextEncoder();
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0));

async function scram(hash, password, saltB64, iterations, authMessage) {
  const bits = hash === 'SHA-256' ? 256 : 160;
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salted = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash, salt: unb64(saltB64), iterations }, pwKey, bits));
  const hmac = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
  };
  const clientKey = await hmac(salted, 'Client Key');
  const storedKey = new Uint8Array(await crypto.subtle.digest(hash, clientKey));
  const clientSig = await hmac(storedKey, authMessage);
  const proof = clientKey.map((b, i) => b ^ clientSig[i]);
  const serverSig = await hmac(await hmac(salted, 'Server Key'), authMessage);
  return { proof: b64(proof), serverSignature: b64(serverSig) };
}

export class XmppError extends Error {}

export class XmppWs {
  #ws; #queue = []; #waiters = []; #pending = new Map(); #seq = 0;
  jid = null;
  onstanza = null;   // (element) => void, for presence and messages after login

  static async connect({ url, domain, username, password, resource = 'foafos', timeoutMs = 10000, onwire = null }) {
    const x = new XmppWs();
    x.onwire = onwire;   // (direction, text) => void, for debugging
    await x.#open(url);
    await x.#negotiate({ domain, username, password, resource, timeoutMs });
    return x;
  }

  #open(url) {
    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(url, 'xmpp');
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = () => reject(new XmppError(`cannot open ${url}`));
      this.#ws.onclose = (e) => {
        this.onwire?.('close', `${e.code} ${e.reason}`);
        for (const [, p] of this.#pending) p.reject(new XmppError('connection closed'));
        this.#pending.clear();
        for (const w of this.#waiters.splice(0)) w.reject(new XmppError('connection closed'));
      };
      this.#ws.onmessage = (e) => { this.onwire?.('in', e.data); this.#frame(e.data); };
    });
  }

  #frame(text) {
    const el = new DOMParser().parseFromString(text, 'application/xml').documentElement;
    if (!el || el.nodeName === 'parsererror') return;
    if (el.localName === 'iq' && (el.getAttribute('type') === 'result' || el.getAttribute('type') === 'error')) {
      const p = this.#pending.get(el.getAttribute('id'));
      if (p) { this.#pending.delete(el.getAttribute('id')); p.resolve(el); return; }
    }
    if (el.localName === 'iq' && (el.getAttribute('type') === 'get' || el.getAttribute('type') === 'set')) {
      // We serve nothing: answer every request with service-unavailable.
      this.send(`<iq xmlns="jabber:client" type="error" id="${esc(el.getAttribute('id'))}" to="${esc(el.getAttribute('from') || '')}"><error type="cancel"><service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error></iq>`);
      return;
    }
    if (this.jid) { this.onstanza?.(el); return; }   // after negotiation: presence and messages
    const w = this.#waiters.shift();
    if (w) w.resolve(el); else this.#queue.push(el);
  }

  #next(timeoutMs) {
    if (this.#queue.length) return Promise.resolve(this.#queue.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new XmppError('timed out waiting for the server')), timeoutMs);
      this.#waiters.push({ resolve: (v) => { clearTimeout(t); resolve(v); }, reject });
    });
  }

  send(xmlText) { this.onwire?.('out', xmlText); this.#ws.send(xmlText); }

  async #restart(domain, timeoutMs) {
    this.send(`<open xmlns="${NS_FRAMING}" to="${esc(domain)}" version="1.0"/>`);
    const open = await this.#next(timeoutMs);
    if (open.localName !== 'open') throw new XmppError(`expected <open/>, got <${open.localName}>`);
    const features = await this.#next(timeoutMs);
    if (features.localName !== 'features') throw new XmppError(`expected <stream:features/>, got <${features.localName}>`);
    return features;
  }

  async #negotiate({ domain, username, password, resource, timeoutMs }) {
    let features = await this.#restart(domain, timeoutMs);
    const offered = [...features.getElementsByTagNameNS(NS_SASL, 'mechanism')].map((m) => m.textContent);
    const mech = ['SCRAM-SHA-256', 'SCRAM-SHA-1'].find((m) => offered.includes(m));
    if (!mech) throw new XmppError(`no SCRAM mechanism offered (server offers ${offered.join(', ') || 'none'})`);
    const hash = mech === 'SCRAM-SHA-256' ? 'SHA-256' : 'SHA-1';
    const nonce = b64(crypto.getRandomValues(new Uint8Array(18)));
    const user = username.replace(/=/g, '=3D').replace(/,/g, '=2C');
    const clientFirstBare = `n=${user},r=${nonce}`;
    this.send(`<auth xmlns="${NS_SASL}" mechanism="${mech}">${btoa('n,,' + clientFirstBare)}</auth>`);
    const challenge = await this.#next(timeoutMs);
    if (challenge.localName !== 'challenge') throw new XmppError(`SASL: ${challenge.firstElementChild?.localName || challenge.localName}`);
    const serverFirst = atob(challenge.textContent);
    const attrs = Object.fromEntries(serverFirst.split(',').map((kv) => [kv[0], kv.slice(2)]));
    if (!attrs.r?.startsWith(nonce)) throw new XmppError('SASL: server nonce does not extend ours');
    const withoutProof = `c=biws,r=${attrs.r}`;
    const authMessage = `${clientFirstBare},${serverFirst},${withoutProof}`;
    const { proof, serverSignature } = await scram(hash, password, attrs.s, Number(attrs.i), authMessage);
    this.send(`<response xmlns="${NS_SASL}">${btoa(`${withoutProof},p=${proof}`)}</response>`);
    const outcome = await this.#next(timeoutMs);
    if (outcome.localName !== 'success') throw new XmppError(`SASL ${mech} failed: ${outcome.firstElementChild?.localName || outcome.localName}`);
    if (atob(outcome.textContent || '') !== `v=${serverSignature}`) throw new XmppError('SASL: the server signature does not verify');
    this.mechanism = mech;

    features = await this.#restart(domain, timeoutMs);
    if (!features.getElementsByTagNameNS(NS_BIND, 'bind').length) throw new XmppError('server offers no resource binding');
    const bound = await this.iq(`<iq xmlns="jabber:client" type="set" id="${this.#id()}"><bind xmlns="${NS_BIND}"><resource>${esc(resource)}</resource></bind></iq>`, timeoutMs);
    this.jid = bound.getElementsByTagNameNS(NS_BIND, 'jid')[0]?.textContent || null;
    if (!this.jid) throw new XmppError('resource binding returned no JID');
    this.send(`<presence xmlns="jabber:client"/>`);
  }

  #id() { return `f${(++this.#seq).toString(36)}`; }

  /** Send an IQ (its id must be set) and resolve with the result or error <iq>. */
  iq(xmlText, timeoutMs = 15000) {
    const id = /\bid="([^"]+)"/.exec(xmlText)[1];
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.#pending.delete(id); reject(new XmppError(`IQ ${id} timed out`)); }, timeoutMs);
      this.#pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.send(xmlText);
    });
  }

  close() {
    try { this.send(`<close xmlns="${NS_FRAMING}"/>`); } catch { /* already closed */ }
    this.#ws.close();
  }

  /**
   * A fetch() for one LWS storage reached through XEP-0332. URLs must start
   * with `base` (the storage's own IRI); the rest becomes the request target.
   * The returned Response has the pod's status, headers and body unchanged.
   */
  httpFetch({ jid, base, timeoutMs = 15000 }) {
    return async (input, init = {}) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.startsWith(base)) throw new TypeError(`${url} is not in the storage ${base}`);
      const target = '/' + url.slice(base.length).replace(/^\/+/, '');
      const method = (init.method || 'GET').toUpperCase();
      const headers = [...new Headers(init.headers || {}).entries()]
        .map(([k, v]) => `<header name="${esc(k)}">${esc(v)}</header>`).join('');
      let data = '';
      if (init.body != null) {
        const bytes = typeof init.body === 'string' ? enc.encode(init.body)
          : init.body instanceof ArrayBuffer ? new Uint8Array(init.body) : new Uint8Array(init.body.buffer ?? init.body);
        data = `<data><base64>${b64(bytes)}</base64></data>`;
      }
      const id = this.#id();
      const reply = await this.iq(`<iq xmlns="jabber:client" type="set" to="${esc(jid)}" id="${id}"><req xmlns="${NS_HTTP}" method="${esc(method)}" resource="${esc(target)}" version="1.1"><headers xmlns="${NS_SHIM}">${headers}</headers>${data}</req></iq>`, timeoutMs);
      if (reply.getAttribute('type') === 'error') {
        const cond = reply.getElementsByTagName('error')[0]?.firstElementChild?.localName || 'error';
        // The pod is offline or unreachable: say so in HTTP terms.
        return new Response(JSON.stringify({ status: 504, detail: `XMPP ${cond} from ${jid}` }),
          { status: 504, headers: { 'Content-Type': 'application/problem+json', 'X-Xmpp-Error': cond } });
      }
      const resp = reply.getElementsByTagNameNS(NS_HTTP, 'resp')[0];
      const status = Number(resp.getAttribute('statusCode'));
      const outHeaders = new Headers();
      for (const h of resp.getElementsByTagNameNS(NS_SHIM, 'header')) outHeaders.append(h.getAttribute('name'), h.textContent);
      const d = resp.getElementsByTagName('data')[0];
      let body = null;
      if (d) {
        const t = d.getElementsByTagName('text')[0];
        const b = d.getElementsByTagName('base64')[0];
        body = t ? t.textContent : b ? unb64(b.textContent) : null;
      }
      if ([101, 204, 205, 304].includes(status) || method === 'HEAD') body = null;
      return new Response(body, { status, headers: outHeaders });
    };
  }
}
