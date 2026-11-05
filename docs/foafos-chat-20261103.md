# FoafOS Chat: the bus room over XMPP (2026-11-03)

**Update 2026-11-05:** `@factoidal/core` 0.30.0 is published, so built-in mode works. What sandboxed apps publish, redaction,
the loop marker and actions from accounts are in [foafos-bus-xmpp-20261105.md](foafos-bus-xmpp-20261105.md). That document
replaces item 5 of "How it works", the security note "Nothing from the room changes anything yet", and "Next" 1.

## Owner requests (2026-11-03, verbatim)

> "so for the foafos information bus, ... can we echo it into a local MUC? MIX or GC3 server? and
> connect to that via normal xmpp to see the chitchat of apps and control them? Can we wireup webmcp
> from a miniapp this way, e.g. we could try the music player, give it MP3Player like controls
> ("Buttons" protocol like remote control?)"

> "Ok so let's do it in the foafos environment, can you make a simple built-in MUC server that runs
> by default but you can configure within the foafos system / and then anyone can choose to run a
> localhost XMPP server / figure out bootstrapping accounts / auth / keys etc / Sure try it in MUC
> initially. You are wrong about MIX and GC3's relevance."

MUC first. MIX and GC3 come next, on the same seams (the room is a config value; the server already
serves all three).

## What there is

| Piece | Where |
|---|---|
| In-page XMPP server (the Factoidal Lean server, no network) | `@factoidal/core` `xmpp/inpage.mjs` (danbri/factoidal-core) |
| Message carrier ops (RFC 7395 messages with no HTTP and no WebSocket frames) | `xmppMsgOpen`, `xmppMsgFeed`, `xmppMsgDeliver`, `xmppMsgClose` in `formal/lean4/Wasm/Ops/XmppSession.lean` (factoidal-core) |
| WebSocket-shaped class over the in-page server, for Strophe.js and other RFC 7395 clients | `inPageWebSocket(server)` in `xmpp/inpage.mjs` |
| The shell's chat service | `packages/foafos/src/chat.mjs` (`FoafChat`, `FoafOS.chat`) |
| The Chat window | `openChat()` in `inklet/finkapp/foafos-shell.js`; manifest `inklet/finkapp/apps/chat.jsonld` (office root) |
| Client | `packages/foafos/src/xmpp-ws.mjs` (`XmppWs.connect({ WebSocket })` takes a WebSocket class) |

## How it works

1. When the shell is idle, `FoafChat.start()` runs (mode `builtin` by default).
2. Mode `builtin`: the shell loads `@factoidal/core` (`browser.js` and `xmpp/inpage.mjs`) and starts
   the Lean XMPP server in the page: domain `foafos.local`, MUC rooms at `rooms.foafos.local`, one
   account `shell` with a new random password. The password is made at every start and is kept in
   memory only. The shell connects to it with `XmppWs` through `inPageWebSocket` (SCRAM-SHA-256).
3. The shell joins the room `bus@rooms.foafos.local` with the nick `foafos`.
4. Bus events whose topic is on the mirror list go into the room as one groupchat message each:
   `<topic> <JSON of the event data>`, at most 2,000 characters and 20 events a second. The default
   list is `app.spawn app.close audio.* minigame.* wm.mode story.state pods.status chat.say`: what
   the apps do, not what they hold. Story variables, storage and secrets are not on it.
5. What other occupants say comes onto the bus as `net.xmpp.message` (source `net.xmpp`), and into
   the Chat window's log. **It is not acted on.** Control (play, pause, next) comes in a later step,
   through an app-tree node with its own grants, never as raw bus events.

The in-page server is not reachable from outside the page. To watch with an ordinary XMPP client,
run a server on your computer (below) and set the Chat window's mode to `server`.

## Where the engine comes from

The built-in server needs `@factoidal/core` with the message carrier, which is newer than the npm
release 0.29.0 (2026-11-01). The shell loads it from
`https://cdn.jsdelivr.net/npm/@factoidal/core@0.30.0/` (`FACTOIDAL_BASE` in `foafos-shell.js`).
**Until 0.30.0 is published, the built-in mode shows "chat error" and the shell is otherwise
unchanged.** For a local build, `?factoidal=/path/to/npm/factoidal/` names a same-origin copy;
another origin is refused, because that code runs in the shell itself.

The engine is a 31 MB WebAssembly download (cached by the browser after the first visit). The shell
starts it only when idle. Set mode `off` in the Chat window on a slow connection.

## A server on your computer (localhost)

Accounts, auth and keys:

```sh
mkdir -p ~/foafos-xmpp && cd ~/foafos-xmpp
# Two accounts: one for the foafos shell, one for you in an XMPP client.
printf 'foafos:%s\nme:%s\n' "$(openssl rand -base64 18)" "$(openssl rand -base64 18)" > accounts
chmod 600 accounts
# The key that seals the server's state at rest (keep it outside the state directory).
openssl rand -hex 32 > ../foafos-xmpp.key && chmod 600 ../foafos-xmpp.key
npx @factoidal/core@0.30.0 xmpp-serve ~/foafos-xmpp --domain localhost --muc rooms.localhost \
  --ws-port 5280 --ws-origin https://danbri.github.io --state-key ~/foafos-xmpp.key
```

- `accounts` holds `user:password` lines. The server checks passwords with SCRAM-SHA-256 (it also
  offers PLAIN). Without `--cert` and `--key` it binds loopback only and refuses other addresses.
- `--ws-origin https://danbri.github.io` lets the live site connect. A request from any other Origin
  is refused 403. Add `--ws-origin http://localhost:8080` for a local copy of the site.
- `--state-key` seals rosters and held messages at rest (ChaCha20-Poly1305). MUC rooms are
  temporary in this server: they are made by the first join and go with the last occupant.

Then, in the shell: **Chat** window, mode `server`, WebSocket `ws://127.0.0.1:5280/xmpp-websocket`,
domain `localhost`, account `foafos`, the password from `accounts`, then SAVE AND RECONNECT. The
password goes into FoafSecrets under `foafos.chat`. It is not kept in localStorage. With a session
passphrase it is sealed at rest; with no passphrase it is kept for this run only.

To watch: in Gajim, Dino or Profanity, add the account `me@localhost`, server `127.0.0.1`, port
5222, and join `bus@rooms.localhost`. Without `--cert` the TCP port has no TLS, so the client must
allow an unencrypted connection to localhost. With `--cert`/`--key --starttls` it does not.

A page at `https://danbri.github.io` may open `ws://127.0.0.1` in Chrome and Firefox (loopback is a
trustworthy origin there). Not yet tested in Safari.

## Security notes

- The built-in server has no network side. Any code in the shell page can reach it; apps in
  sandboxed frames cannot, because they never get the server object or the WebSocket class.
- The room sees only the topics on the mirror list. Change the list in the Chat window.
- Nothing from the room changes anything yet.
- The default engine comes from jsDelivr, pinned to one version. A dynamic `import()` cannot carry a
  Subresource Integrity hash, so this trusts jsDelivr and npm for that version.
- Any account on a localhost server can join any room. That is acceptable on a one-person loopback
  server; members-only rooms are not built yet (`L4Factoidal/XMPP/Muc.lean`).

## Next

1. Control: room commands from your JID only, as a "remote" app-tree node with granted verbs; media
   verbs for ROBBAMP (play, pause, next, previous, volume) on the Media Session API vocabulary.
2. XEP-0050 ad-hoc commands on the shell's JID, so Gajim and Psi show the buttons.
3. WebMCP tools from the same verb table, where the browser has `navigator.modelContext`.
4. The bus room as a MIX channel and as a GC3 group (persistent membership, held messages).
5. A SharedWorker, so all tabs of the shell share one in-page server.
