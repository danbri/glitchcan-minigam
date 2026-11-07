# LWS over XMPP: a home pod for foafos

Owner, 2026-10-21, verbatim: "Can we do this and wire up comms to the LWS over an xmpp
binding? Is that just wanky and needless? Could it be a pod at home?"

This folder answers those questions with a running prototype and a test. The plan it
belongs to is [docs/foafos-lws-20261021.md](../../../docs/foafos-lws-20261021.md) and [docs/foafos-pods-20261103.md](../../../docs/foafos-pods-20261103.md).

```
browser (foafos, any origin)                 home machine (behind NAT)
  XmppWs  --wss, RFC 7395-->  XMPP server  <--c2s, outbound--  pod.mjs
  httpFetch(): LWS request                                      startXmpp(): <req/> -> storage.step()
  as XEP-0332 <req/> IQ                                         startHttp(): same storage over HTTP
                                                                Factoidal LWS engine (Lean -> wasm)
```

## Who, and what

HTTP over XMPP is deny by default. `--allow` says who may ask, and `--route` says what they may ask for. A request must match both, so with no `--route` the pod answers nothing over XMPP. Example: `--route 'GET,HEAD /public/'`. A target that is not a plain path, or that climbs with `..`, is refused whatever the routes say.

`--http PORT` listens on 127.0.0.1 only, and `--cors-origin ORIGIN` names a page that may read it. Both carriages serve one store.

## The binding

- One LWS storage (`openLwsStorage` from `@factoidal/core/lws` 0.33.0) has two carriages:
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
| `pod-read.mjs` | reads a pod directory with no lock and no write: index, journal replay, body scan. Shared by the two tools below |
| `pod-summary.mjs` | CLI: the tree, sizes, content types, dates, grant count and orphan bodies of a pod directory |
| `pod-davmount.mjs` | CLI: shows a pod as a read-only WebDAV server on 127.0.0.1, for Finder. Holds the pod backend |
| `pod-dav.mjs` | the WebDAV side of `pod-davmount`: knows the backend interface, and nothing about pods |
| `test/tools.mjs` | tests of the two CLIs on fixture pods in a temp directory (`npm run test:tools`; no relay, no browser) |
| `test/run.mjs` | end-to-end test: Prosody, the pod, a static server, Chromium |
| `test/prosody.cfg.lua` | the local relay (plain `ws://` on 127.0.0.1, test only) |
| `test/relay.mjs` | starts the test relay: Prosody, or Factoidal's Lean server with TLS (`RELAY`, `FACTOIDAL_BIN`) |
| `test/e2e-shell.mjs` | the whole path through the real foafos shell: the Pods tab of System, the relay, this pod, and the sandboxed Pod Notes app (`npm run test:shell`) |

`npm test` runs `test/tools.mjs` and then `test/run.mjs`, which needs a relay. `npm run test:tools` runs only the tools tests: 131 pass, 0 fail (2026-11-07, macOS, Factoidal 0.33.0; also on 0.30.0).

Run it (moved here from `magpie/miniapps/lws/` on 2026-11-03):

```
cd packages/foafos/pod && npm install

# relay: Prosody
apt-get install -y prosody
node test/run.mjs                          # 15 pass, 0 fail (2026-10-21, Linux container)

# relay: Factoidal's Lean XMPP server (needs a build with `xmpp-serve --ws-port`,
# https://github.com/danbri/factoidal-core/pull/311; not yet on npm)
RELAY=factoidal FACTOIDAL_BIN=<factoidal-core>/npm/factoidal/bin/factoidal.mjs node test/run.mjs
                                           # 15 pass, 0 fail (2026-11-03, macOS, Google Chrome)
```

With the Factoidal relay, the test runs both listeners over TLS (XEP-0368 direct TLS and
`wss:`) with a throwaway certificate. `@xmpp/client` (the pod's library) has SCRAM-SHA-1 and
PLAIN and uses PLAIN only over TLS; Factoidal offers SCRAM-SHA-256 and PLAIN. The browser
client logs in with SCRAM-SHA-256.

Relay difference, measured 2026-11-03: when the pod is offline, Prosody answers the browser's
IQ with `service-unavailable` (RFC 6121 section 8.5.2.2); Factoidal holds the IQ and does not
answer (https://github.com/danbri/factoidal/issues/1234). `httpFetch` gives HTTP 504 in both
cases: `X-Xmpp-Error` is the error condition, or `timeout`.

Run a pod:

```
POD_PASSWORD=... node pod.mjs --base https://pod.example/ --dir ./data \
  --xmpp xmpps://xmpp.example:5223 --domain xmpp.example --jid mypod --allow me@xmpp.example \
  [--http 8787] [--insecure-no-auth]
```

## pod-summary

```
node pod-summary.mjs ~/foafos-lws-xmpp [--json]
```

A home pod is one directory, and names do not show on disk (`bodies/` holds numbered files). This tool prints what is in it: the tree, sizes, content types, dates, the grant count, and orphan bodies. It works offline.

- **Read-only.** It opens files for reading, takes no lock, and runs while a pod holds `lws.lock`. `test/tools.mjs` compares a hash of the directory (paths, modes, sizes, mtimes, ctimes, bytes) before and after, on a closed pod and on a running `pod.mjs`. A read can change a file's access time, depending on the volume; the hash leaves access time out.
- **Why not the Factoidal API.** `openLwsStorage` has no read-only mode in 0.33.0: it takes the lock, refuses a directory that a pod holds, and its start compacts the journal. So `pod-read.mjs` reads the files, in the format of Factoidal's `L4Factoidal/LWS/FileLayout.lean`. A test compares its journal replay with a real compaction by the engine, so a format change in Factoidal shows as a test failure.
- **The index alone is out of date.** A running pod adds records to `lws-journal`, and folds them into `lws-files.json` only at a start or when the journal is large. The tool replays the journal. It also reads the index twice around the journal, and reads again if a compaction came between.
- **No secrets.** The index and the journal hold the notification signing key, subscription inbox URLs (which can hold tokens) and grants. `pod-read.mjs` keeps only the counts. The lock's process token is dropped, a bad index gives a message that quotes no text (Node's `JSON.parse` error does quote it), and no body file is read. Paths are printed: a pod owner who puts a secret in a resource name sees it here.
- **Sealed pods** (`FACTOIDAL_LWS_KEY`): the tool holds no key, so it says that the pod is sealed and gives only the body file count and size. It cannot show the tree, the grant count or orphans.
- A snapshot storage (`lws-state.json`) is refused with exit 2.

Each orphan has a reason: `unused`, `pending-remove` (a journal record marked it dead), `not-yet-recorded` (a number at or past `nextBody`) or `temporary` (a `.tmp` file). With a running pod, a body file exists for a moment before its journal record, so read `not-yet-recorded` as transient while the lock line says `running`. The report also lists body problems: an entry whose body file is missing, or differs in size. `lock` shows the pid and whether that process is alive, so a stale lock shows too.

Exit: 0 a summary, 2 a usage fault or a directory it cannot read.

## pod-davmount

```
node pod-davmount.mjs ~/foafos-lws-xmpp [--port N]
http://127.0.0.1:PORT/          <- standard output: the mount line
```

In Finder: Go > Connect to Server, then that line, as Guest. From a shell: `mkdir /tmp/pod && mount_webdav -S http://127.0.0.1:PORT/ /tmp/pod`, then `umount /tmp/pod`.

Stage 1 is a local directory, read-only, on 127.0.0.1 only: WebDAV class 1 with `PROPFIND` (Depth 0 and 1), `GET` (with `Range` and conditional requests), `HEAD` and `OPTIONS`. Every other method gets 405. It takes no lock, writes nothing, runs beside a running pod, and reads the index again when the index or the journal changes.

**Not yet proved in Finder.** The tests use real HTTP clients (Node `http`, `fetch`, curl), and send the `PROPFIND` that Finder sends. No test has mounted a volume, because a mount shows on the owner's desktop.

**What it exposes.** It reads files directly, so the pod's access control does not apply. Any process on this machine that reaches the port reads the whole pod, `.acl` files too. Pages in a browser cannot: a foreign `Host` gets 421 (DNS rebinding), a foreign `Origin` or a `Sec-Fetch-Site: cross-site` request gets 403, there are no CORS headers, and stored content is served with `Content-Security-Policy: sandbox` and `nosniff`. A request path never becomes a file name: it finds an index entry, and the entry's body number names the file. The pod's own files (`lws-files.json`, `bodies/...`) have no URL. A sealed pod is refused at start. Metadata and linkset resources are not shown.

**Why not `factoidal webdav-serve`.** In 0.33.0 it has no way to add a backend: `openWebdav` (`webdav/server.mjs`) holds the mount kinds in the engine and in one `storages` map. It cannot do stage 1: every `kind: local` mount is refused at start (issue 1147, "emergency mode"), and a local mount would take `lws.lock` anyway. So `pod-dav.mjs` is a small read-only server here. It has no dependencies.

### The backend interface

`pod-dav.mjs` calls three functions, and says so at the top of the file: `stat(path)`, `list(path)`, `read(path, {start, end, etag})`. A path is a percent-encoded URL path, which is also what an LWS target is. `test/tools.mjs` runs the WebDAV side over an in-memory backend, and checks that `pod-dav.mjs` imports only `node:` modules.

### Later stages (not built)

Each one is a new backend in `pod-davmount.mjs`, with no change to `pod-dav.mjs`.

| Stage | Source | Backend | Open points |
|---|---|---|---|
| 2 | remote LWS over HTTPS | `stat` = `HEAD`, `list` = `GET` of the container (`application/lws+json`, following `next` pages), `read` = `GET` with `Range` and `If-Match` | Access: a token or a did-key, kept out of logs. Check first whether a `webdav-serve` `kind: lws` mount with `--guest` does this job: it is read-only in 0.33.0, and needs a key, not a server here. |
| 3 | LWS over XMPP | the stage 2 backend on a different `fetch`: XEP-0332 through `@factoidal/core/xmpp`, or `factoidal xmpp-http-proxy` on 127.0.0.1 in front of stage 2 | `pod.mjs` refuses bodies over 160 KB (no chunking), so a large `read` needs `Range` requests, or chunking. Not checked: that the proxy speaks to `pod.mjs`'s binding. The pod's `--allow` and `--route` must admit the reader. |
| Later | writes; sealed pods | a write needs the engine, through the pod's HTTP or XMPP carriage, never the files; a sealed pod needs the key and the engine | Both change the read-only promise, so each needs the owner's agreement. |

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
