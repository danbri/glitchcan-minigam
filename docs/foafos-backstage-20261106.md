# Foafos: Backstage, the bots in the bus room (2026-11-06)

Owner, 2026-11-06, verbatim: "Can we see its backstage bot net", then "*yet" (it did not exist), then, to the question of
where it runs, "All 3 and it should offer /help that documents this". The three were a foafos app, a page on the live site,
and a `foafos-stack` command.

Backstage shows who is in the bus room, which members are bots or shells, and what each caller did. It only reads. It cannot
grant, revoke, start or stop anything.

## The three views

| View | Where | Reads from | `/help` |
|---|---|---|---|
| Panel in the shell | `?app=backstage`, in the roots `office`, `apps`, `all` and the default | This shell's own Chat connection (`FoafChat`) and the grants in this browser (`ToolGrants`). It does not join the room again | The `/help` button |
| Page | <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/backstage.html> | An outside XMPP client over WebSocket (RFC 7395). It joins the room with the nickname `backstage-` and four hex digits | The `/help` button, or `#help`, or `?help` |
| Command | `foafos-stack backstage [local\|proto\|shared] [--as ACCOUNT] [--room NAME] [--wait SECONDS] [--watch] [--json]` | The laptop side (foafbot's process, model, `/tell` file, refusal log), then the room through `xmpp-chat.py --jsonl` | `foafos-stack backstage help` |

All three use one model and one help text: `packages/foafos/src/backstage.mjs`. The panel and the page use one renderer:
`inklet/finkapp/foafos-backstage-ui.js`.

Page links that open it set up:

- Shared test server: <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/backstage.html?server=shared&as=me>
- This computer: <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/backstage.html?server=local&as=me>
- The help: <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/backstage.html#help>
- The panel: <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?app=backstage>

The page asks for the password each time and keeps it nowhere. The shared server accepts the WebSocket only from the origins
`https://danbri.github.io` and `http://localhost:8080`.

## What it shows

- **Members.** Everyone in the room now (●) and earlier (○), with role, messages said and events sent. The kind is a guess:
  `shell` sent a stanza with the bus marker or has the nickname `foafos` or `foafos-` and four hex digits; `bot` has a bot
  nickname (`foafbot`); `viewer` is another Backstage; the rest are `member`.
- **Who acted.** For each caller, the count of allowed and refused actions and the last one. From four topics, all on the
  shell's default mirror list (a unit test checks this): `app.action`, `app.action.refused`, `tools.called`, `chat.refused`.
  The caller is the account that the server stamped on the direct message, as the shell recorded it, not a nickname.
- **Last actions**, newest first, with the topic and the member that sent it.
- **Grants** (panel only): `describeGrant` for each grant in this browser.
- **The laptop** (command only): is foafbot running, its model and where that came from (its command line or the default
  in `chat-ai.py`), the `/tell` owners and allow list or why it is off, and the last five `tell refused` lines of
  `~/.foafos-stack/logs/foafbot.log`.

## What it cannot see

- Rooms keep no history. A view sees only what happens after it joins. The panel sees what this shell kept (500 messages).
- A shell whose mirror list leaves out the four topics shows no actions.
- Bot refusals are only in the bot's log, so only the command shows them.
- The page cannot see any shell's grants: they are in that shell's browser.
- Anyone can add the bus marker to a room message, so an event in Backstage can be forged. A forged event changes nothing in
  any shell, because no shell acts on room text. A message with no marker is counted as talk, never as an action (tested).
- A member that left can stay listed until the server restarts (rooms keep ghosts; `docs/foafos-demo-20261106.md`).
- The page and the command are seen by the room: they are members.

## Where the bot runs (asked on 2026-11-06)

foafbot is `inklet/tools/chat-ai.py`. It calls `claude -p --tools '' --model claude-haiku-5-5` as a subprocess on the computer
that runs `foafos-stack`, with that computer's Claude Code login. Neither Fly machine runs a bot or a model. `foafos-stack`
connects it to the laptop's server only (loopback, port 5222). The Haiku default is still not decided by the owner;
`foafos-stack backstage` now prints the model on every run.

## Changes outside the new files

- `packages/foafos/src/chat.mjs`: `parseEvent` is exported, so the model parses events as the shell does.
- `inklet/tools/xmpp-chat.py`: `--jsonl` prints one JSON object per room stanza (presence with role, groupchat with
  `marked`, errors). Without it, nothing changes.
- `inklet/tools/foafos-stack.mjs`: the `backstage` command, its help line, and a Backstage line in `urls`. It imports
  `backstage.mjs` from the repository.
- `inklet/finkapp/apps/backstage.jsonld` and the regenerated `foafos-apps-data.js` (36 apps); `foafos-root.js` offers it in
  `office` and `apps` beside Chat; `foafos-shell.js` opens it (`openBackstage`); `index.html` loads `foafos-backstage.css`.
- No sandbox or frame code changed.

## Tests, 2026-11-06

- `node --test packages/foafos/test/backstage.test.js`: 7 of 7 pass. `node packages/foafos/test/run.js`: all pass.
- `node inklet/finkapp/test/e2e-backstage.mjs`: 16 of 16 pass. A real shell in Chromium joins a new room on `factoidal
  xmpp-serve` (npm 0.30.0); an account with no grant sends it `/where`; the panel, the page and `foafos-stack backstage
  --json` each name that account and the reason `no-grant`; each `/help` opens; no page errors. Run in a cloud container with
  `SHELL_URL` and `CHROMIUM_PATH` set and a temporary `HOME`.
- `inklet/tools/test-foafos-stack.mjs`: the new case (backstage help with no server) passes. In the cloud container, 11 older
  cases fail on master as well (no global `factoidal`, no laptop layout); they were not run on the laptop for this change.
- `python3 -B inklet/tools/test-foafbot-tell.py`: 14 of 14 pass. `node inklet/tools/app-manifests.mjs --check`: clean.
  `npx html-validate inklet/finkapp/backstage.html`: clean.
- Not tested: the page against the shared Fly server (this container cannot sign in there: no account password).

## Not built

- Controls (grant, revoke, start, stop). The first version only reads, as proposed on 2026-11-06; the owner did not ask for controls.
- Bot refusals in the room, so the panel and the page could show them.
- Discovery of the WebSocket address by XEP-0156 (`/.well-known/host-meta`); the page has the two addresses built in.
