# foafos pods: LWS storages over HTTPS or XMPP, in the shell, the UI and the app API (design and log, 2026-11-03)

Status: design, then a log of what is built. A line says "built" only when a test shows it.
Read with: `docs/foafos-lws-20261021.md` (why LWS, the staged plan, and the 2026-10-21 update),
`magpie/miniapps/lws/README.md` (the prototype: a home pod over XEP-0332, 15 of 15 checks on
2026-10-21), `packages/foafos/src/ops.mjs` (the broker rule), `docs/foafos-solidos-20261103.md`.

## 1. The owner's request

Owner, 2026-11-03, verbatim: "Can we get LWS and XMPP pods into the main FOAFOS codebase and
surfaced in the finkapp endpoint UI and API?"

Owner, 2026-11-03, verbatim, on where the work goes: "I don't want things bured in claude/*
obscure branches, we will never see them again. USE /main ffs:) it is an experiment-friendly
repo." So each step below is committed to `master`.

## 2. What exists before this work

- `magpie/miniapps/src/xmpp-ws.mjs`: a browser XMPP client (RFC 7395, SCRAM-SHA-256 and
  SCRAM-SHA-1 with WebCrypto, server signature checked, bind, IQ). `httpFetch()` carries a
  `fetch` call as a XEP-0332 IQ and returns a real `Response`.
- `magpie/miniapps/src/lws-store.mjs`: `lwsStore` (one JSON resource per FoafStore namespace,
  `If-Match` and `If-None-Match: *`) and `cachedBackend` (the synchronous `{read, write}` that
  FoafStore takes, with a three-way merge on 412).
- `magpie/miniapps/lws/pod.mjs`: the home pod in Node. One Factoidal LWS storage
  (`@factoidal/core/lws` 0.11.0), served over HTTP and over XEP-0332 through an XMPP account.
- `magpie/miniapps/lws/test/run.mjs`: the end-to-end test. Its relay is Prosody.
- Nothing in `packages/foafos` or `inklet/finkapp` uses any of this.

## 3. Design

### 3.1 Where the code goes

| From | To | Why |
|---|---|---|
| `magpie/miniapps/src/xmpp-ws.mjs` | `packages/foafos/src/xmpp-ws.mjs` | the shell imports it |
| `magpie/miniapps/src/lws-store.mjs` | `packages/foafos/src/lws-store.mjs` | the shell imports it |
| (new) | `packages/foafos/src/pods.mjs` | `FoafPods`: the pod registry and the broker |
| `magpie/miniapps/lws/` | `packages/foafos/pod/` | the home pod and its end-to-end test |

The files are moved with `git mv`, so their history follows them.

### 3.2 Who holds what

The rule of `ops.mjs` applies: **the scope supplies the destination; the app supplies the data.**

- **The shell (level 0)** holds the pod list, the connections and the credentials.
  - A pod record: `{ id, label, base, carriage, relay?, podJid? }`, saved without secrets.
    `carriage` is `https` (the browser's `fetch` to `base`; the pod must send CORS headers) or
    `xmpp` (XEP-0332 through a relay; `relay` is `{ url, domain, username }`).
  - The XMPP password goes into `FoafSecrets` under the shell's own owner id (`foafos`), with
    the name `pod.<id>.password`. It is read only through `secrets.use` while the connection
    logs in. It is never given to an app.
- **An app** never sees a pod address, a JID or a credential. It gets brokered verbs:

  | Verb | Capability | What |
  |---|---|---|
  | `pod.get` | `pod:read` | GET one resource |
  | `pod.list` | `pod:read` | GET one container, `Accept: application/lws+json` |
  | `pod.put` | `pod:write` | PUT one resource, with `If-Match` when the app gives an ETag |
  | `pod.delete` | `pod:write` | DELETE one resource |

  The grant's scope is `{ pod, prefix }`. The default prefix is `apps/<appId>/`, so an app
  reaches only its own container. The app gives a path relative to that prefix. A path with
  `..` is refused, and nothing outside the prefix can be reached (the same `cleanPath` and
  `withinPrefix` that `ops.mjs` uses).
- Every call is audited on the bus (`pods.*` topics), with the verb, the path and the status,
  and never a credential. Calls are throttled per app and verb, as in `FoafOps`.

### 3.3 Storage backend

When the owner turns on "use for app storage" for one pod, FoafStore namespaces use
`cachedBackend(lwsStore({ fetch: podFetch, base }))`. Local reads stay synchronous; writes go
out behind; a 412 is merged key by key. With no pod, FoafStore stays on `localStorage`.

### 3.4 The UI

A **Pods** window in the shell (level 0), opened from the launcher and by `?app=pods`:

- the list of pods, each with a status (offline, connecting, online, error) and its carriage;
- a form to add a pod: label, storage base IRI, carriage; for XMPP, the relay WebSocket URL,
  the XMPP domain, the account, the password and the pod's JID;
- Connect and Disconnect;
- Browse: the container listing of the storage, with links into sub-containers, and the text of
  a resource;
- "Use for app storage" (section 3.3);
- the grants: which apps hold `pod:read` or `pod:write`, with their prefixes.

The window is shell chrome, not a sandboxed app, because it handles the password. Apps get
only the verbs in section 3.2.

### 3.5 The API

- In the shell: `FoafOS.pods`, the `FoafPods` instance (for tests and the developer console):
  `list()`, `add(rec)`, `remove(id)`, `connect(id)`, `disconnect(id)`, `status(id)`,
  `invoke(appId, verb, params)`.
- In an app: `foaf.pod.get(path)`, `foaf.pod.list(path)`, `foaf.pod.put(path, body, { etag,
  contentType })`, `foaf.pod.delete(path)`, through `inklet/apps/app-sdk.js`. Each one is a
  `postMessage` verb that the shell checks against the app's capabilities.

### 3.6 The relay

The pod and the browser both need an XMPP server that the browser can reach over `wss://`. Two
servers are tested:

- Prosody (the prototype's relay), when `prosody` is on `PATH`.
- Factoidal's own Lean XMPP server, `factoidal xmpp-serve --ws-port`. It speaks RFC 7395
  directly (https://github.com/danbri/factoidal-core/pull/311) and routes an IQ to another
  account by bare JID (RFC 6120 section 8.1.1). That support is not yet in an npm release.

### 3.7 Not in this work, stated

- LWS authorization on the pod: the pod still runs `--insecure-no-auth`, and the XMPP allow
  list is its only access check. The relay asserts the sender's JID, so the allow list trusts
  the relay (prototype README, "Costs").
- Notifications to the browser, XEP-0332 chunking (bodies over 160 KB are refused), and
  reconnection after a dropped connection.
- No Content Security Policy, so the egress limit of `docs/fink-spec-v1.md` §5.5.6 still holds:
  a sandboxed app cannot reach a pod without the broker, but it can reach any other address.

## 4. Steps (each one committed to `master`)

1. Move the three prototype parts into `packages/foafos` (section 3.1); the prototype test runs
   from its new place.
2. `FoafPods` in `packages/foafos/src/pods.mjs`, with a unit test that needs no network
   (scope, `..`, prefix, throttle, audit, and that no verb ever returns a credential).
3. The shell: `FoafOS.pods`, the Pods window, `?app=pods`, and the app verbs in `app-sdk.js`.
4. An end-to-end test: Chromium opens the finkapp shell, adds an XMPP pod, connects through the
   relay, and a sandboxed app writes and reads its container through `foaf.pod.*`.

## 5. Log

(Filled in as each step lands.)
