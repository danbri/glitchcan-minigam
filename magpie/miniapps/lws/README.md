# LWS over XMPP: a home pod for foafos

Owner, 2026-10-21, verbatim: "Can we do this and wire up comms to the LWS over an xmpp
binding? Is that just wanky and needless? Could it be a pod at home?"

This folder answers those questions with a running prototype and a test. The plan it
belongs to is [docs/foafos-lws-20261021.md](../../../docs/foafos-lws-20261021.md).

```
browser (foafos, any origin)                 home machine (behind NAT)
  XmppWs  --wss, RFC 7395-->  XMPP server  <--c2s, outbound--  pod.mjs
  httpFetch(): LWS request                                      startXmpp(): <req/> -> storage.step()
  as XEP-0332 <req/> IQ                                         startHttp(): same storage over HTTP
                                                                Factoidal LWS engine (Lean -> wasm)
```

## The binding

- One LWS storage (`openLwsStorage` from `@factoidal/core/lws` 0.11.0) has two carriages:
  HTTP and XMPP. Both call the same `storage.step({method, target, headers, body})`.
- On XMPP, a request is an IQ `set` holding `<req xmlns="urn:xmpp:http" method resource version>`
  (XEP-0332). Headers go in a SHIM `<headers>` element; the body is base64. The answer is
  `<resp statusCode>` with the same headers and a text or base64 body.
- The LWS request is unchanged: the method, the target, `Authorization`, `If-Match`, the
  ETags, the status codes and the `problem+json` bodies are the same bytes as over HTTP.
  The binding adds no LWS semantics.
- Resource IRIs stay `https://` (the storage's own `baseIri`). The client keeps one mapping,
  storage base IRI → pod JID, and sends the path as `resource`. The provisional `httpx://`
  scheme of XEP-0332 is not used.
- The pod answers only bare JIDs on its allow list (403 for others). An offline pod gives
  the browser a 504 with `X-Xmpp-Error`, not a hang.

## Files

| File | What |
|---|---|
| `pod.mjs` | the home pod: storage, HTTP listener, XMPP binding (`@xmpp/client` 0.14.0, ISC) |
| `../src/xmpp-ws.mjs` | browser XMPP client: RFC 7395 framing, SCRAM-SHA-256/-1 with WebCrypto (server signature checked), bind, IQ; `httpFetch()` returns real `Response` objects |
| `../src/lws-store.mjs` | `lwsStore`: one JSON resource per FoafStore namespace, `If-Match`/`If-None-Match: *`; `cachedBackend`: the synchronous `{read, write}` that FoafStore takes, writes sent behind, 412 merged key by key (three-way) and retried |
| `test/run.mjs` | end-to-end test: Prosody, the pod, a static server, Chromium |
| `test/prosody.cfg.lua` | the local relay (plain `ws://` on 127.0.0.1, test only) |

Run it:

```
apt-get install -y prosody                 # the relay used by the test
cd magpie/miniapps/lws && npm install
node test/run.mjs                          # 15 pass, 0 fail (2026-10-21)
```

Run a pod:

```
POD_PASSWORD=... node pod.mjs --base https://pod.example/ --dir ./data \
  --xmpp xmpps://xmpp.example:5223 --domain xmpp.example --jid mypod --allow me@xmpp.example \
  [--http 8787] [--insecure-no-auth]
```

## Measured (2026-10-21, this container, local relay)

| Check | Result |
|---|---|
| Browser login over WebSocket | SCRAM-SHA-1, server signature verified |
| LWS `GET /`, `PUT`, `GET`, listing over XEP-0332 | 200 / 201 / 200, `application/lws+json` |
| HTTP and XMPP carriages on one storage | each reads what the other wrote |
| FoafStore → cachedBackend → LWS, after another device wrote | `412`, merged (`{"visits":"2","theme":"dark"}`), then synced |
| 4096 binary bytes | identical after the round trip |
| 50 sequential `HEAD` over the relay | 4.1 ms per request (local, no network) |
| Browser `fetch` straight to the pod's HTTP listener | blocked: the engine sends no `Access-Control-Allow-Origin` |
| JID not on the allow list / wrong password / pod offline | 403 / `not-authorized` / 504 |

## Answers

**Is it wanky and needless?** It depends on the use.

It is needed for a pod at home that has no public HTTPS. Over XMPP:
- The pod connects out, so there is no port forwarding, no public certificate, and it works
  behind carrier-grade NAT.
- The browser never calls the pod over HTTP, so CORS does not apply. The engine sends no CORS
  headers today, which blocks the direct HTTPS route from a Pages-hosted foafos (measured above).
- XMPP presence tells the browser whether the pod is online.
- An XMPP message is the obvious way to push LWS notifications to a browser. The engine's
  notifications are webhooks, which a browser cannot receive.

It is needless where the pod has an HTTPS address, for example through a tunnel that passes TLS
through to the pod. Then standard LWS over HTTPS works with any LWS client and with Touchstone.
That route needs the engine to send CORS headers, and it gives no push.

Costs of the XMPP route:
- It is not standard. LWS defines only HTTP; XEP-0332 is Deferred and its text says
  "not recommended for production". No other LWS client speaks it, and Touchstone cannot test it.
- The relay sees every request and body (TLS protects each hop, not the whole path). The relay
  also asserts the sender's JID, so the allow list trusts the relay. LWS bearer tokens, checked
  by the pod's engine, remove the identity trust, but the relay could still replay a token
  within its 300-second lifetime. Run the relay yourself, or encrypt bodies in the client.
- No chunking yet: bodies over 160 KB get 413 or 507 (Prosody's default stanza limit is 256 KB).
- One more server to run.

Recommendation:
- Keep HTTP as the normative binding.
- Use XMPP as an optional carriage for a home pod with no HTTPS, and as the notification
  channel to browsers.
- Put no LWS logic in the XMPP layer.

**Could it be a pod at home?** Yes. A Raspberry Pi, NAS or old laptop with Node 22.12 or later
runs `pod.mjs`. Limits today:
- The Factoidal LWS storage is in memory. The host rewrites the whole JSON snapshot after each
  change, so it suits app data (megabytes), not photos or video. Shardborough persistence has
  not started.
- The pod needs an XMPP account on a server that the browser can reach over `wss://`: a
  provider, or a relay you run on a small public machine.
- Back up `lws-state.json` off the machine.

## Next

1. LWS authorization on the pod (bearer tokens, issue discovery, WAC). The test used
   `--insecure-no-auth` and the XMPP allow list only.
2. Notifications as XMPP messages to subscribed JIDs.
3. XEP-0332 chunked bodies for large resources.
4. A foafos switch: `FoafStore` on `cachedBackend` when a pod is configured, with the shell
   holding the XMPP password through `FoafSecrets`.

Factoidal changes this would use (factoidal-core, not done here):
- CORS headers in the LWS HTTP binding, for the direct HTTPS route.
- RFC 7395 WebSocket in `l4xmpp-serve`, so the relay can be Factoidal's own Lean server. It
  has RFC 6120/6121 routing and SCRAM, but no WebSocket.
- A browser host for the engine.
