// foafos transports — the shell's ears (and sometimes mouth) to the wider
// event/notification ecosystem.
//
// Contract: a transport is  { name, connect(bus), close() }  and may offer
// send(topic, data). Inbound traffic is published under 'net.<name>.…' with
// source 'net.<name>' so widgets and filters can tell it from local events.
// Transport lifecycle is itself announced on the bus ('net.<name>.open',
// '.error', '.closed') — connectivity is feed content too.
//
// Shipped here: the ones a static host can honestly support today —
//   SseTransport        server push (EventSource)
//   WebSocketTransport  bidirectional JSON frames { topic, data }
//   FeedPoller          RSS/Atom by polling (CORS permitting)
// Cross-tab is not a transport — that's FoafBus.bridge().
//
// Designed to fit, not yet shipped (each is a thin adapter over this same
// contract): MQTT-over-WebSocket, XMPP, WebRTC data channels (needs a
// signalling rendezvous), ActivityPub/fedi inbox (needs a server-side
// component — the planned fly.io service).

export class SseTransport {
  constructor(name, url) { this.name = name; this.url = url; this._es = null; }
  connect(bus) {
    this.bus = bus;
    this._es = new EventSource(this.url);
    this._es.onopen = () => bus.publish(`net.${this.name}.open`, { url: this.url }, { source: `net.${this.name}` });
    this._es.onerror = () => bus.publish(`net.${this.name}.error`, { url: this.url }, { source: `net.${this.name}` });
    this._es.onmessage = (e) => {
      let data; try { data = JSON.parse(e.data); } catch { data = { text: e.data }; }
      bus.publish(`net.${this.name}.message`, data, { source: `net.${this.name}` });
    };
    return this;
  }
  close() {
    this._es?.close();
    this.bus?.publish(`net.${this.name}.closed`, {}, { source: `net.${this.name}` });
  }
}

export class WebSocketTransport {
  constructor(name, url) { this.name = name; this.url = url; this._ws = null; }
  connect(bus) {
    this.bus = bus;
    this._ws = new WebSocket(this.url);
    this._ws.onopen = () => bus.publish(`net.${this.name}.open`, { url: this.url }, { source: `net.${this.name}` });
    this._ws.onerror = () => bus.publish(`net.${this.name}.error`, { url: this.url }, { source: `net.${this.name}` });
    this._ws.onclose = () => bus.publish(`net.${this.name}.closed`, {}, { source: `net.${this.name}` });
    this._ws.onmessage = (e) => {
      let frame; try { frame = JSON.parse(e.data); } catch { frame = { topic: 'message', data: { text: e.data } }; }
      bus.publish(`net.${this.name}.${frame.topic || 'message'}`, frame.data ?? frame, { source: `net.${this.name}` });
    };
    return this;
  }
  send(topic, data) {
    if (this._ws?.readyState === 1) this._ws.send(JSON.stringify({ topic, data }));
  }
  close() { this._ws?.close(); }
}

// Polls an RSS/Atom feed; each new entry becomes 'net.<name>.entry'.
// Browser-only (DOMParser). Dedups on entry id/guid/link across polls.
export class FeedPoller {
  constructor(name, url, { intervalMs = 5 * 60 * 1000 } = {}) {
    this.name = name; this.url = url; this.intervalMs = intervalMs;
    this._seen = new Set(); this._timer = null;
  }
  connect(bus) {
    this.bus = bus;
    const poll = () => this._poll().catch(err =>
      bus.publish(`net.${this.name}.error`, { message: String(err).slice(0, 200) }, { source: `net.${this.name}` }));
    poll();
    this._timer = setInterval(poll, this.intervalMs);
    return this;
  }
  async _poll() {
    const res = await fetch(this.url);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const entries = [...doc.querySelectorAll('entry, item')];
    for (const entry of entries) {
      const get = (sel) => entry.querySelector(sel)?.textContent?.trim() ?? '';
      const link = entry.querySelector('link')?.getAttribute('href') ?? get('link');
      const id = get('id') || get('guid') || link || get('title');
      if (!id || this._seen.has(id)) continue;
      this._seen.add(id);
      this.bus.publish(`net.${this.name}.entry`, {
        title: get('title'), summary: get('summary') || get('description'),
        link, published: get('published') || get('pubDate'), id,
      }, { source: `net.${this.name}` });
    }
  }
  close() { clearInterval(this._timer); }
}
