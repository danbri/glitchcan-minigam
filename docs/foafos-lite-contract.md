# The foafos-lite guest contract

Status: draft, version 1 (2026-11-12), revised the same day after the Lean model found eleven gaps
in the first text (listed at the end). Issue: https://github.com/danbri/glitchcan-minigam/issues/1038.
Lean model: `factoidal-core formal/lean4/L4Factoidal/Foafos/GuestContract.lean`, written from this text.

An app joins foafos by depending on this contract. It does not depend on foafos itself. The
contract is a small set of `postMessage` messages between the app (the **guest**, in a frame) and
whatever embeds it (the **host**): full foafos, `@foafos/host-lite`, or anyone else's host. An app
that finds no host keeps working (level 0).

The guest side ships as `@foafos/guest`, one ES module with no dependencies. The host side ships as
`@foafos/host-lite`, or as part of full foafos.

## What `@foafos/guest` may and may not do

It may:
- post messages to `window.parent` and listen to messages from it (and from no other window);
- use IndexedDB, under one database named `foafos-guest`, for level-0 storage only.

It may not:
- replace or wrap any global (`localStorage`, `fetch`, `console`, prototypes);
- name `fetch`, `XMLHttpRequest`, `WebSocket`, `WebTransport`, `RTCPeerConnection`,
  `EventSource`, `Worker`, `SharedWorker`, `navigator.serviceWorker`, `navigator.sendBeacon`,
  `import()`, `eval` or `Function` (CI fails the build if the source does);
- assume a URL, a port, an origin or `localhost`;
- run any code at import time beyond defining its exports and one `message` listener.

## Levels

An app declares the highest level it uses in its manifest (`"foafosLevel": 0..4`), and asks for
it in `hello`. A host grants a level at or below the one asked for, and never above it. Each level
includes everything below it.

| Level | Name | The guest gets | The guest may send |
|---|---|---|---|
| 0 | standalone | no host; local fallbacks | nothing |
| 1 | good neighbour | lifecycle, audio level, viewport, input map, action calls | `hello`, `ready`, `actions`, `paused` |
| 2 | storage | level 1, plus get, put, list and delete in its own folder | level 1, plus `store` |
| 3 | tools and bus | level 2, plus tool calls and bus events | level 2, plus `tools`, `tool-result`, `publish`, `subscribe` |
| 4 | full foafos | everything the person grants (outside this contract) | outside this contract |

**What can leave the guest, by level.**
- **Level 0:** nothing; except that an app that asked for level 1 or more has already sent `hello`
  (its level, name and actions) before it found there was no host.
- **Level 1:** only what the app declares about itself: its level, its name, its menu of actions
  (ids, labels, `checked`), and acknowledgements. This is a promise the *app* makes: the module
  cannot tell a label from data, so an app must not put storage content, anything the person
  typed, or anything computed from them into these values. A host shows them and does not store
  or forward them.
- **Level 2:** level 1, plus what the app chooses to save, to the folder the host gives it.
- **Level 3:** level 2, plus tool results and published events: what the app chooses to send.

**Who receives it.** The levels limit what leaves, not who receives it: any page that frames the app
can answer `welcome`. An app that cares names the hosts it trusts in its manifest
(`"foafosHosts": ["https://example.org"]`). The guest then sends nothing, not even `hello`, unless
`window.parent`'s origin, as the browser reports it, is in that list. Without the list, any framing
page is a host.

## Messages

Every message is an object `{ fl: 1, type, ... }`. `fl` is the protocol version. Requests carry
`rid`, a string, unique among the sender's requests; replies carry the same `rid`. A message is
ignored, and a side never acts on it, when:
- it lacks `fl: 1`, has an unknown `type`, or comes from a window other than the expected one;
- it is above the level granted;
- it is a reply to a `rid` with no request outstanding;
- it is an `action` whose id is not in the current menu;
- it is a second `hello`.

### Handshake (level 1 and up)

- **Guest to host,** `hello { level, name, actions? }`: the level asked for, the app's name, and,
  optionally, its first menu of actions.
- **Host to guest,** `welcome { level, viewport, audio, lifecycle, input? }`: the level granted
  (at most the level asked), then the current state of each. `welcome.lifecycle` is the first
  state of the order below. If it is `paused`, the guest answers `paused {}` as for any pause.
- The guest acts only on the first `welcome`, and only if it arrives within 500 ms of `hello`. A
  `welcome` granting more than was asked is ignored. If none arrives in time, or the guest is not
  in a frame, the guest is at level 0 for the rest of its life.

### Level 1: host to guest

- `lifecycle { state }`, where `state` is `running`, `paused` or `ending`. Starting from the
  state in `welcome`, the states alternate between `running` and `paused`, and `ending` comes at
  most once, last. The guest answers `paused` with `paused {}` once it has stopped its timers and
  sound. After `ending`, the host sends only the replies it owes. A request that arrives after
  `ending` (one can cross it on the wire) is answered `{ ok: false, reason: "offline" }`. On
  `ending`, the guest treats its outstanding requests as failed.
- `audio { level, muted }`: `level` is from 0 to 1. The guest scales its own output by it.
- `viewport { width, height, safe: { top, right, bottom, left }, mode }`: `mode` is `full`,
  `window`, `pip` or `split`.
- `input { map }`: on-screen or remapped controls, as a map from host control names to the app's
  own action ids (declared in `actions`).
- `action { id }`: the person chose an app action from the host's menu. `id` is one the app
  declared.

### Level 1: guest to host

- `ready {}`: the app has drawn its first frame.
- `actions { items: [{ id, label, checked? }] }`: replaces the app's menu of actions.
- `paused {}`: the acknowledgement of `lifecycle paused`.

### Level 2: guest to host, with a reply

- `store { rid, op, path, body?, etag?, contentType? }`, where `op` is `get`, `put`, `list` or
  `delete`. `path` is a list of segments inside the app's own folder (the guest never names the
  folder). Each segment matches `[A-Za-z0-9._~-]+` and is not `.` or `..`. So no `%` escapes and
  no backslashes, which URL resolution would otherwise turn into a way out (`%2e%2e/other-app/x`).
  The empty list is allowed only for `list`, meaning the folder itself. `body` is a string or
  bytes.
- Reply: `store-result { rid, ok, status?, reason?, body?, etag?, contentType?, items? }`. `reason`
  is `denied`, `not-found`, `conflict`, `too-large`, `quota` or `offline`.

The guest never learns where its folder is (the pod, the address, the backing store). How the
folder is backed is the host's business: LWS, OPFS, IndexedDB or a folder on disk.

### Level 3: both ways

- Guest to host: `tools { items }` declares tools (name, description, input schema). The host
  sends `call { rid, name, args }`, and the guest answers each `call` with exactly one
  `tool-result { rid, ok, result?, error? }`. A call to an undeclared tool gets `ok: false`.
- Guest to host: `subscribe { topics }`, which replaces the earlier list, and
  `publish { topic, data }`. The host sends `event { topic, data }` only for topics the guest
  subscribed to and was granted.

## What a host promises

- It grants at most the level asked for.
- It sends lifecycle states only in the order above, and nothing after `ending`.
- It answers every level-2 or level-3 request with exactly one reply carrying its `rid`, including
  requests that cross `ending` (answered `offline`).
- It confines `store` paths to the app's folder, and refuses any path that breaks the segment
  rule with `denied`.
- It shows the app's name, labels and ids, and does not store or forward them.
- It sends `event` only for topics that were both subscribed to and granted.

## What the guest module promises

- It sends nothing before checking `foafosHosts`, when the app gives one, and nothing at level 0
  beyond the `hello` already sent.
- At level 1 it sends only `hello`, `ready`, `actions` and `paused`.
- It sends a level-2 or level-3 message only once the granted level allows it, and only when the
  app calls for it.
- It sends nothing the app did not hand it: the module adds no data of its own beyond `fl`, `type`
  and `rid`.

## Not in this contract

The following belong to full foafos (level 4) and need the person's opt-in there:
- sign-in and identity;
- secrets (use without read);
- other apps' folders;
- shares;
- chat;
- the window manager;
- build handlers.

Snapshots (saving and restoring state across `paused`) are left out of version 1; see the issue's
open questions.

## Revisions from the Lean model

The first text of this contract (earlier the same day) had these gaps. Each was found by the Lean
model, with a trace, and is fixed above:
1. **`ending` contradicted "exactly one reply":** a request that crossed `ending` on the wire could
   not be answered without breaking one promise or the other (`ending_conflict`).
2. **"Level 0: nothing leaves" was false** after a timeout, since `hello` had already gone.
3. **A late or second `welcome`** was unspecified.
4. **A `welcome` above the level asked for**, read literally, let the module send at that level.
5. **The path rule (no `..`, no empty part) let `%2e%2e` and backslashes escape** through URL
   resolution, and gave no way to list the folder itself.
6. **Level 1 was stated as a promise of the module,** but labels and ids can carry data that the
   module cannot see. It is the app's promise, and the host's not to keep it.
7. **Rids were not required to be unique.**
8. **The guest's answer to `call`** was not promised.
9. **Where the lifecycle order starts** (`welcome.lifecycle`) was unclear.
10. **Smaller points:** whether `subscribe` replaces, what to do with messages above the level,
    with an `action` for a removed id, and with a second `hello`.
11. **The levels limited what leaves, not who receives it:** `foafosHosts` added.
