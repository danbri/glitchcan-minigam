# Foafos on this laptop: local servers, XMPP and debugging

Where everything else lives: [foafos-where-things-are.md](foafos-where-things-are.md).

Written 2026-11-04. Covers running the Foafos shell locally, the Factoidal
servers, joining the bus room from an XMPP client, what went wrong getting
there, and what is still open.

No passwords are stored here. They live in `~/foafos-xmpp/accounts`.

**Laptop only.** Everything binds to `127.0.0.1`. The Factoidal code is marked
experimental and unreviewed, and `--insecure-no-auth` means no authorization at
all. Do not expose any of this to a network.

## Quick start

One command runs everything:

```sh
foafos-stack start     # xmpp, lws, sparql and shell, then a full status
foafos-stack stop      # everything this tool started
```

Then open <http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all>.

The servers run detached from any terminal, so closing a tab cannot stop them. They do not come back after a reboot: run `foafos-stack start` again.

| Command | What it does |
|---|---|
| `foafos-stack start [service...]` | Starts everything, or those named, and waits until each passes its checks |
| `foafos-stack stop [service...]` | Stops them, and confirms their ports are free |
| `foafos-stack restart [service...]` | Stops, then starts. Restarting `xmpp` restarts `foafbot` too |
| `foafos-stack status [-v] [--json]` | What is really running. Exits 0 only if everything needed is healthy |
| `foafos-stack logs [service...] [-n N] [--no-follow]` | All logs, labelled. Ctrl-C to leave |
| `foafos-stack chat [local\|proto\|shared]` | A plain text XMPP client, already set up. Our own code: for daily use, not for showing interoperability |
| `foafos-stack backstage [local\|proto\|shared] [--watch] [--json]` | The bots: foafbot's process, model, `/tell` file and refusals on this laptop, then who is in the room and what each caller did. Read only. `foafos-stack backstage help` says what it cannot see. Design: [foafos-backstage-20261106.md](foafos-backstage-20261106.md) |
| `foafos-stack doctor` | Checks what the servers need, before or after starting |
| `foafos-stack urls`, `foafos-stack open` | The addresses, or opens Foafos |

Services are `xmpp`, `lws`, `webdav`, `sparql` and `shell`. Optional ones start only when named: `foafbot`, `proto` (both tunnels to `foafos-proto` on Fly) and `pod-laptop` (this laptop's pod, on the Fly XMPP server).

WebDAV is read only. In Finder: Go, Connect to Server, `http://127.0.0.1:8090/`, then Connect as Guest.

### What status means

Status asks each server to do its job. It does not rely on a pid file or an open port.

| State | Meaning | What to do |
|---|---|---|
| `healthy` | Running, on its own ports, on this computer only, and passing every check | Nothing |
| `starting` | Started in the last 20 seconds and not yet passing | Wait |
| `degraded` | Running, but a check fails. It may be frozen, or refusing the browser | Status names the check. Read the log, then restart |
| `crashed` | It stopped, and nobody asked it to. Status shows the log's last error | Read the log, then restart |
| `blocked` | Something this tool did not start holds its port. Status names the pid | Stop that program, then start |
| `stopped` | Not running, because it was stopped or never started | Start it |

The checks:

| Service | Checks |
|---|---|
| `xmpp` | Opens a real XMPP stream. Opens a WebSocket as the shell's origin, so a browser refusal shows here. Confirms another site is refused |
| `lws` | Storage answers, sends the CORS header the shell needs, and does not allow other sites or sandboxed pages |
| `sparql` | Runs a real `ASK` query |
| `shell` | The page and `foafos-shell.js` load, and the CORS header sandboxed apps need is there |
| `foafbot` | Holds a connection to the XMPP server. This does not prove it can reach Claude |

Status also says which folder, branch and commit the shell is serving, read from the running process. Under "Worth knowing" it lists anything running with older settings, or an older Factoidal than the one installed.

### Files and settings

| Path | What it is |
|---|---|
| `inklet/tools/foafos-stack.mjs` | This tool. Node 20 or later, no packages. Link it into your PATH as `foafos-stack` |
| `inklet/tools/test-foafos-stack.mjs` | Its tests, on spare ports: `node inklet/tools/test-foafos-stack.mjs` |
| `~/.foafos-stack/run/` | One record per server: pid, start time, command. A record with no live process is what `crashed` means |
| `~/.foafos-stack/logs/` | One log per server. A log over 20 MB moves to `.log.1` at the next start |

All settings are optional environment variables: `FOAFOS_STACK_HOME`, `FOAFOS_SHELL_ROOT` (the folder holding `glitchcan-minigam`; default `~/working/solid`, a full checkout of the default branch), `FOAFOS_SHELL_PORT`, `FOAFOS_XMPP_PORT`, `FOAFOS_XMPP_WS_PORT`, `FOAFOS_LWS_PORT`, `FOAFOS_SPARQL_PORT`, `FOAFOS_SPARQL_FILE`, `FOAFOS_XMPP_DIR`, `FOAFOS_XMPP_KEY`, `FOAFOS_LWS_DIR`, `FOAFOS_LWS_AUTH`, `FOAFOS_BOT_ACCOUNT` and `FOAFOS_START_WAIT`. Keep the same settings for `status` and `stop` as for `start`. `FOAFOS_LWS_AUTH` is split on spaces, and shows in `status`, so keep paths simple and put no secret in it.

It never touches a server it did not start. It tells you the pid instead.

### Running one by hand

These are the commands the tool runs, for debugging one server in a terminal. Stop it in the tool first.

```sh
# Once: upgrade the CLI (0.29.0 has no --muc or --ws-port)
npm i -g @factoidal/core@0.30.0

# XMPP: TCP 5222, WebSocket 5280, rooms at rooms.localhost
factoidal xmpp-serve ~/foafos-xmpp --domain localhost --muc rooms.localhost \
  --ws-port 5280 --ws-origin https://danbri.github.io \
  --ws-origin http://localhost:8080 --state-key ~/foafos-xmpp.key

# LWS storage on 3000
factoidal lws-serve ~/foafos-lws --insecure-no-auth --port 3000 --storage files \
  --cors-origin http://localhost:8080 --cors-origin https://danbri.github.io

# SPARQL on 3030 (data.ttl is your own RDF file; updates are lost on exit)
factoidal serve --file data.ttl /ds --port 3030

# The shell on 8080: run from ~/working/solid, NOT from inside the repo
cd ~/working/solid && python3 serve-foafos.py 8080
```

Open: <http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=all>

Use `localhost`, not `127.0.0.1`: the XMPP server only accepts the WebSocket
from the origins listed in `--ws-origin`. `?root=all` offers every app; other roots offer a chosen few.

### One-time XMPP setup (already done)

```sh
mkdir -p ~/foafos-xmpp ~/foafos-lws
printf 'foafos:%s\nme:%s\n' "$(openssl rand -base64 18)" "$(openssl rand -base64 18)" > ~/foafos-xmpp/accounts
openssl rand -hex 32 > ~/foafos-xmpp.key
chmod 600 ~/foafos-xmpp/accounts ~/foafos-xmpp.key
```

Two accounts: `foafos` for the shell, `me` for you in an XMPP client.

## Ports and files

| Port | Service |
|---|---|
| 5222 | XMPP over TCP, no TLS |
| 5223 | `xmpp-from-shim.py`, for Profanity only, when it is running |
| 5280 | XMPP over WebSocket, `ws://127.0.0.1:5280/xmpp-websocket` |
| 3000 | LWS storage |
| 3030 | SPARQL, `http://127.0.0.1:3030/ds/sparql` |
| 8080 | Foafos shell |

| Path | What it is |
|---|---|
| `~/foafos-xmpp/accounts` | XMPP accounts, `user:password` per line |
| `~/foafos-xmpp.key` | Seals XMPP state at rest |
| `~/foafos-lws` | LWS storage |
| `~/working/solid/serve-foafos.py` | Static server for the shell (sends CORS and `no-store`) |
| `~/working/solid/xmpp-from-shim.py` | Profanity workaround |
| `~/working/solid/glitchcan-minigam` | Shell source, `master` |
| `~/working/factoidal-core` | Server source; fix is on `claude/xmpp-iq-reply-from` |
| `~/.claude/codex-handoffs/` | Codex handoffs and the Foafos chat-control backup |

## Connect the shell to the server

1. Open the Chat window.
2. Set mode `server`, WebSocket `ws://127.0.0.1:5280/xmpp-websocket`, domain
   `localhost`.
3. **Type** `foafos` into account. It is blank by default, and the grey
   `foafos` is only a placeholder.
4. Copy the password, paste it into password:
   ```sh
   grep '^foafos:' ~/foafos-xmpp/accounts | cut -d: -f2- | tr -d '\n' | pbcopy
   ```
5. Leave `rooms at` blank, then click SAVE AND RECONNECT.

Success looks like:
`online (foafos@localhost/foafos in bus@rooms.localhost)`

**After a reload** the settings survive but the password does not (no session
passphrase is set), so the status shows `no password is set`. Enter it again.

## Join the room from an XMPP client

### BeagleIM (works, direct on 5222)

- Account `me@localhost`, server `127.0.0.1`, port 5222, allow unencrypted.
- Use **File → Join channel…** (⌘J), not **File → Chat with…**.
- Set **Component domain** to `rooms.localhost`. Automatic found nothing.
- Change the lower box to `bus` or clear it, select the **bus** row, then Join.
  Join stays greyed out until a row is selected.
- Use any nickname except `foafos`.

Other useful places: **Window → Contacts** (⌘2) is the roster, and
**Window → XML Console** shows raw stanzas.

### Profanity (needs the shim until a new release ships)

```sh
python3 ~/working/solid/xmpp-from-shim.py        # listens on 5223
grep '^me:' ~/foafos-xmpp/accounts | cut -d: -f2- | tr -d '\n' | pbcopy
```

```
/connect me@localhost server 127.0.0.1 port 5223 tls disable
/join bus@rooms.localhost
```

Use `127.0.0.1`, not `localhost`: the server is IPv4 only. "TLS connection not
established" is just what `tls disable` reports.

## What the room shows

- Each mirrored bus event is one message: `<topic> <JSON>`.
- Default mirror list: `app.spawn app.close audio.* minigame.* wm.mode
  story.state pods.status chat.say`.
- Using an app that is already open posts nothing. Starting or closing one does.
- Rooms are temporary: no history, and a room goes when its last occupant
  leaves. If the shell is the only member and it disconnects, the room is gone.
- What other occupants say appears in the Chat window's log. It does not control
  anything yet.

Example of a real event:

```
app.spawn {"summary":"Calendar started under Office","id":"app6","appId":"calendar","parentId":"app1","capabilities":["storage"]}
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Shell loads, app windows blank | `python -m http.server` sends no CORS header; sandboxed apps have an opaque origin | Use `serve-foafos.py` |
| `could not load story: HTTP 404 … /glitchcan-minigam/inklet/toc.fink.js` | Served from inside the repo | Run the server from `~/working/solid` |
| `could not connect: failed` | Login rejected. The shell hides the real error (see below) | Check account and password |
| `no password is set` | Page was reloaded | Enter the password again |
| Profanity segfaults just after login | Disco reply with no `from` | Use the shim on 5223 |
| `(bad-request)` in BeagleIM | Room opened as a one-to-one chat, so messages are not `groupchat` | Join channel instead |
| `not-acceptable` | `groupchat` sent by a non-member | Join the room first |
| Join greyed out in BeagleIM | Channel list empty or no row selected | Component domain `rooms.localhost`, select **bus** |
| In the room but nothing arrives | Nothing has happened since you joined | Start or close an app |
| `[DOM] Password field is not contained in a form` | Chrome hint only | Harmless |

### Finding the real login error

`secrets.use()` replaces every connection error with `failed`, so call the
client directly in the DevTools console of the Foafos tab. Type `allow pasting`
first if Chrome blocks it. The password here is entered by you, so paste it
between the quotes and do not save the result anywhere:

```js
const { XmppWs } = await import('/glitchcan-minigam/packages/foafos/src/xmpp-ws.mjs');
try {
  const x = await XmppWs.connect({ url: 'ws://127.0.0.1:5280/xmpp-websocket',
    domain: 'localhost', username: 'foafos', password: 'PASTE-HERE', resource: 'probe' });
  console.log('OK', x.jid); x.close();
} catch (e) { console.log('FAIL', e.message); }
console.log(FoafOS.chat.state, FoafOS.chat.detail, FoafOS.chat.config());
```

What the errors mean:

| Error | Meaning | Socket left open? |
|---|---|---|
| `SASL SCRAM-SHA-256 failed: not-authorized` | Wrong password | Yes |
| `SASL: not-authorized` | Unknown or blank account, or `foafos@localhost` used as the account | Yes |
| `expected <stream:features/>, got <error>` | Wrong domain | No |
| `cannot open ws://…` | Wrong port or path, or server down | No |

### Useful commands

```sh
# What is listening
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(5222|5223|5280|3000|3030|8080)'

# Who is connected to XMPP (each rejected browser login leaves a socket here)
lsof -nP -iTCP:5222 -iTCP:5280 | grep -v LISTEN

# Crash reports and Profanity's log
ls -lt ~/Library/Logs/DiagnosticReports | grep -i profanity
tail ~/.local/share/profanity/logs/profanity.log
```

## What we found

### The server omitted `from` on its own replies

Profanity 0.19.0 segfaulted right after a successful login. The crash report
showed a NULL read in `_disco_info_response_id_handler_onconnect` (`iq.c`).

- **Factoidal bug:** `iqResult` in `formal/lean4/L4Factoidal/XMPP/Server.lean`
  had no `from` parameter, so every local IQ reply lacked it, and so did roster
  pushes. RFC 6120 section 8.1.2.1 says a stanza the server generates for itself
  MUST carry the server's address.
- **Profanity bug:** it passes the missing `from` into a hash lookup and crashes.
  A reply with no `from` is legal for a query to your own bare JID, so this is
  worth reporting upstream. Not reported yet.
- BeagleIM did not crash, but the same bug may be why its automatic channel
  discovery found nothing. That is a guess, not confirmed.

### The fix and the theorems (not committed, not released)

Branch `claude/xmpp-iq-reply-from` in `~/working/factoidal-core`, from
`origin/main`, uncommitted:

- `from` is a required argument of `iqResult`. Replies come from the address
  queried, or the account's bare JID when the request had no `to`.
- `handleIq_send_has_from`: every stanza `handleIq` sends on the connection has
  a `from`.
- `handleIq_domain_from`: a reply to a request for the server's domain comes from
  that domain (roster requests excepted, since a push is for the account).
- Two `#guard` regression checks, a README note, and four JS test assertions
  updated.

Checked: `Server.lean` compiles with no `sorry` and only the standard axioms
(`propext`, `Classical.choice`, `Quot.sound`). Reintroducing the bug three ways
broke the build each time.

Not done: a full `lake build`, the JS tests, and an end-to-end run of the fixed
server. The theorems cover `handleIq` only, not the MUC, MIX or GC3 paths, and
are about the XML node rather than the final rendered bytes. Bind results still
have no `from`, which the RFC allows.

Proof note: `exact` trying `stanzaError` against goals it could not match made
unification diverge, and raising `maxHeartbeats` did not help. The fix was
`with_reducible exact`, with the `stanzaError` case last and explicit.

To check the file without rebuilding everything:

```sh
cd ~/working/factoidal-core/formal/lean4 && lake env lean L4Factoidal/XMPP/Server.lean
```

### Shell bugs in `glitchcan-minigam` (not fixed)

1. `secrets.use()` hides every connection error as `failed`. Its comment says the
   message may contain the secret, but XMPP errors do not.
2. `XmppWs.connect` does not close its socket when login fails.
3. The account field is blank but shows a `foafos` placeholder, so it looks filled.
4. The password box is not in a `<form>`, so password managers can misbehave.
5. The Chat window asks for far more than `server` mode needs.

Also: `python -m http.server 8080` in the repo's `CLAUDE.md` does not work for
the shell, for the two reasons in the troubleshooting table.

### Other things learned

- GitHub Pages was not stale at the time of checking: `foafos.html` and
  `foafos-shell.js` matched local `master` after the 21:29 deploy, and there is
  no service worker. An old load was probably an earlier deploy or browser cache.
- HTTPS: only `xmpp-serve` has TLS flags (`--cert`, `--key`, `--starttls`).
  LWS, Solid and SPARQL would need a reverse proxy such as Caddy, which is not
  installed and has not been tried.
- `solid-serve --insecure-no-auth` echoes any `Origin`, so any website can read
  it. Only run it when needed.
- The engine loads from jsDelivr pinned to `@factoidal/core@0.30.0`, a 31 MB
  download, so the shell needs internet the first time.
- Notes seems to save to the built-in `browser` pod rather than the LWS server,
  going by `pods.status`. Not confirmed, and it is unknown whether those notes
  survive clearing browser data.

## Session recovery after the Ghostty crash

Ghostty crashed around 17:35 on 2026-11-04. Codex is out of quota until
**2026-11-10 10:07 AM**, so its sessions moved to Claude using handoffs in
`~/.claude/codex-handoffs/` (Claude cannot load a Codex session directly).

| Session | Project | State |
|---|---|---|
| Claude `40cee846` | dpp | Running in Terminal, was open in two tabs |
| Claude `8ac93b73` | solid XMPP demo | Running in Terminal, was open in two tabs |
| Claude `dc848c6f` | moglob plan | Resumed in Terminal |
| Claude `b8ba1ee4` | web render | Resumed in Terminal |
| Codex `01a19c40` | depmap | Now `codex-depmap` in Claude |
| Codex `01a19c41` | lws-fuse | Now `codex-lws-fuse` in Claude |
| Codex `01a1a395` | xmpp-pane | Now `codex-xmpp-pane` in Claude |
| Codex `01a19c42` | toki | Now `codex-toki` in Claude |

The four `codex-*` sessions were told not to commit, push or publish until you
confirm. The full transcripts are under `~/.codex/sessions/`.

## New work, not merged (2026-11-04, overnight)

`~/working/foafos-chat/glitchcan-minigam`, branch `claude/foafos-chat-moglob`, uncommitted. New Chat window, Moglob tools over
XMPP and WebMCP, three-pane Files, side-by-side game view, movable menu. Read
`docs/foafos-chat-window-20261104.md` there. To try it, stop the shell on 8080, then:

```sh
cd ~/working/foafos-chat && python3 ~/working/solid/serve-foafos.py 8080
```

It is a sparse checkout, so apps outside `inklet`, `packages`, `drift-city` and `magpie/edot/files` will not load from it.

## Still to do

1. **Free disk space.** About 490 MB was free at last check. A Wasm rebuild needs
   more, and an earlier Profanity install failed for lack of space.
2. **Commit the Foafos chat-control work.** It is uncommitted in
   `/private/tmp/factoidal-foafos-chat-control` on `codex/foafos-chat-control`,
   which is not on origin. `/private/tmp` is volatile. Backups:
   `~/.claude/codex-handoffs/foafos-chat-control-tracked.diff` and
   `foafos-chat-control-backup.tgz`. Another session may be merging this already.
3. **Commit `codex/offline-release-install`.** It has uncommitted files in
   `depmap/source/factoidal-release-030`.
4. **Commit and PR `claude/xmpp-iq-reply-from`**, then release. Until then
   Profanity needs the shim.
5. **Fix the shell bugs** listed above.
6. **Close the duplicate Terminal tabs** for `40cee846` and `8ac93b73`, keeping one
   of each.
7. **Report the Profanity crash** upstream.
8. **Fix roster pushes in `xmpp-serve`.** A roster change is pushed only to the
   session that made it, addressed to its own full JID. RFC 6121 section 2.1.6
   says every interested resource gets it, so other clients on the account stay
   stale until they reconnect. Seen when the stray contact "foafos bus locally"
   was removed server-side: the server's roster emptied, but BeagleIM got no
   push. BeagleIM's own delete had not taken effect on the server either; why is
   not known.
