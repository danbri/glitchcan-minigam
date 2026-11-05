# The Chat window, Moglob's tools, Files and the side-by-side view (2026-11-04)

Branch `claude/foafos-chat-moglob`. Owner, verbatim: "make a really nice polished usable professional feeling chat app that
works for all our XMPP and similar needs. The connection screens can be simple with advanced stuff behind some ui."

## Chat

`inklet/finkapp/foafos-chat-ui.js` and `foafos-chat.css`, over `FoafChat` (`packages/foafos/src/chat.mjs`).

- One connect screen: in this page, this computer, or another server. Everything else is under Advanced.
- Rooms and direct messages. `/join NAME`, or type a room or `name@server` under the list.
- The Activity room is the bus room. People's messages read as a conversation. Mirrored events are quiet lines beside them,
  and four or more in a row fold up. A checkbox hides them.
- Every colour and face comes from the skin.
- Login failures say why. `secrets.use()` hides failure messages, as they may hold the secret, so `chat.mjs` keeps only an
  `XmppError`, which cannot. A refused login now closes its socket. A lost connection retries with growing gaps.

Limits: no message history from the server, no roster, no file transfer, no presence for direct contacts, and the password
still lasts only until a reload unless secrets are sealed.

## Tools

`packages/foafos/src/tools.mjs` (`FoafTools`). An app whose manifest says `"tools": true` may offer tools over its frame with
the `webmcp.*` messages of londat `docklands/frame-bridge.js`. The shell finds the frame from the window that sent the message,
never from what the message says. Calls go through one place. A tool that is not read-only needs `allowWrite`. The bus hears who
called what, never the arguments.

Where the shell's page has `document.modelContext` (Chrome with `--enable-features=WebMCP`), the tools register there as
`moglob.go_to` and so on.

This is separate from the uncommitted chat-control work (`FoafControls`, in `/private/tmp/factoidal-foafos-chat-control`). That
has a stronger permission model, and a demo headless app. The two should be compared before either grows.

## Commands

`packages/foafos/src/chat-commands.mjs`: `/help /where /go /apps /tools /call /open /bus /join /leave /clear`.

From another account, send a direct message to the shell's account. It works only if that account is under Advanced, "Accounts
that may send commands". Nobody is on that list by default. A room message is never a command: rooms here are semi-anonymous,
so a nickname proves nothing, while a direct message's `from` is stamped by the server.

    /open moglob
    /go tower of london
    /where
    /call moglob go_to {"place":"Tower of London"}

Drift has tools too: docs/foafos-world-tools-20261104.md.

## Files

`inklet/apps/files/`, three panes from `inklet/apps/ui/panes.css`: folders, contents, preview and edit. It replaces the edot
component as the app called Files. Device storage came back on 2026-11-05 as locations: see [foafos-where-files-live-20261105.md](foafos-where-files-live-20261105.md). The pod verbs carry
text, so images and audio have no preview, and upload is not built.

## Side by side

The window menu's "Side by side": the game big, the story's history above the present moment, and the options pinned below. It
is the split mode laid out across the screen, on screens at least 900px wide. `wm.panes` tells the story runner.

## The menu

The ☰ was pinned bottom right by `!important` in `fink-minigames.css`, which beat its own drag code. It now starts there and
goes where you drag it, along a screen edge, and stays after a reload. The drawer's headings are in plain words and its most
used sections come first.

Fixed 2026-11-05: the white square behind the ☰ over Moglob and Drift. `#wm-chrome`, a positioning box the size of the handle, had the skin's page background, which only shows over something darker than the page.

Also fixed 2026-11-05: on a phone the ☰ covered Send in Chat, in all six skins, and touched the last story choice; and Spectrum's wide font wrapped the composer placeholder.

## Tests, 2026-11-05

To run the shell's browser suites on this Mac, set `PW_CHROME` and `CHROMIUM_PATH` to Chrome and `FACTOIDAL` to `$(npm root -g)/@factoidal/core`. `e2e-chat` needs the Factoidal path.

The sparse checkout needs `magpie`, `inklet/minigames`, `inklet/demos` and `third_party/sqljs`. Without them the suites fail in ways that look like code bugs: a missing game frame, a timeout, `Failed to load sql.js`.

- `e2e-drift` is flaky on base as well as on this branch, so it can't gate this work. "city pause" failed 1 run in 3 on each side: it needs neighbour rings on screen, which depends on where the pick lands.
- `skins-a11y` fails "visible focus ring" in all six skins, the same on base.

The whole chain was run live on 2026-11-05: "@ai please take me to Tower Bridge" in the room, the bot's direct message, the allow list, `go_to`, and Moglob's camera at Tower Bridge. Run this in windowed Chrome (`headless: false`). Headless software rendering manages about 1 fps, Moglob never announces its tools, and the shell says "No world is open", which looks like a bug and isn't.

`inklet/tools/chat-ai.py`: tested live against a local server. It first replayed old `/go` commands on later questions, because its own replies never reached its context; only the question marked "asks now" is live now.
