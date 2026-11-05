# XMPP pane handoff: status on 2026-11-04

This document records the state of the Codex `xmpp-pane` work after a check against the repositories.
It is not committed work. No commit, push or merge was done.

## Owner request

Codex stopped at its usage limit on 2026-11-04 at 17:14 UTC. The owner asked Claude to compare the handoff with the
repositories. Then the owner asked Claude to start, with one limit: another session owns the Chat app and the Moglob
(Docklands) WebMCP wiring. This session did not change `openChat`, `packages/foafos/src/chat.mjs`,
`packages/foafos/src/xmpp-ws.mjs` or `/private/tmp/factoidal-foafos-chat-control`.

## Results

- **Built-in chat works on the live site.** At https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?player=none&root=office
  headless Chrome reached state `online` in `bus@rooms.foafos.local`, mode `builtin`, with no failed Factoidal request.
  `@factoidal/core` 0.30.0 is on npm and jsDelivr. The error "Failed to fetch dynamically imported module" is closed.
- **`docs/foafos-chat-20261103.md` is out of date.** It says that built-in mode fails until 0.30.0 is published.
  This session did not change it, because it describes the Chat app.
- **The Factoidal CLI is 0.30.0.** Another session or the owner updated it at about 21:43.
- **A local server and Profanity run.** `factoidal xmpp-serve /Users/danbri/foafos-xmpp` started at 21:43 and `profanity`
  at 21:51. This session did not start them and did not change them. The repository has no launcher command for them.

## Where the work is

| Work | Location | Backup |
|---|---|---|
| Chat, Moglob bridge, Devices, mixer (Codex) | `/private/tmp/foafos-chat-20261104` | `~/.claude/codex-handoffs/foafos-chat-staging-20261104.tgz` |
| Chat controls: broker, headless worker, WebMCP | `/private/tmp/factoidal-foafos-chat-control` | `~/.claude/codex-handoffs/foafos-chat-control-backup.tgz` and `foafos-chat-control-tracked.diff` (checked: identical to the tree) |
| Devices and mixer, cut out for separate review | not applied | `~/.claude/codex-handoffs/foafos-devices-mixer-20261104.patch` |

## Merge measurements (staged Codex work against master `97ccbd6f` and londat `64cfbad7`)

- 16 of 17 changed files merge with no conflict. The conflict is `inklet/apps/podnotes/podnotes.js`: keep the text
  in master (the Pods to PodStore rename).
- The merged foafos package suite passes 93 of 93. Master passes 83 of 83.
- `chat-live-smoke.mjs` passes on the staged tree: logins, direct chat, MUC, miniapp card, underscore channel.
- The Chat controls patch does not apply to master. On the merged chat copy, 4 of 8 `foafos-shell.js` hunks and the
  only `chat.mjs` hunk fail. It needs a manual port.
- Not tested: the staged Chat UI in a browser, and the merged londat code.

## The Devices and mixer patch

The patch adds the Devices panel, per-app volume and mute in `FoafAudio`, the App mixer in the audio panel, two device
capabilities in the roots and `shapes.ttl`, and the `devices` app in the office root. It does not touch `chat.mjs` or
`xmpp-ws.mjs`, and it adds lines to `foafos-shell.js` without changing `openChat`.

It leaves out the Chat rewrite, the Moglob manifest, the `?moglob=` frame code, and the routing of input and audio to
hosted windows. Moglob needs those for hosted mode.

Checks, on a copy overlaid on master:

- `app-manifests.mjs --check`: 36 apps, clean.
- foafos package suite: 87 of 87 pass (83 plus the 4 tests in `devices.test.js`).
- Chrome: the Devices window opens once only; the app is in the registry; the mixer shows 3 sliders; volume and mute
  change the source; an unknown source is refused.
- A defect found by looking at a screenshot: the panel text was `#eee` on a white window. The patch uses `color: inherit`.
  Measured contrast is 18.9 on the `office` and `glitchcanary` roots.

The patch is not applied because the shared checkout is in use and `foafos-shell.js` also holds `openChat`.

To apply it, run this in the repository root after the Chat session finishes:

    git apply ~/.claude/codex-handoffs/foafos-devices-mixer-20261104.patch

Before that, check that the Chat session did not already apply the same Devices code from the staging folder.

## Open points for the owner

1. Approve or refuse the Devices and mixer patch.
2. Tell the Chat session about the staged work and the Chat controls patch, so that the work is not done twice.
3. Decide whether to add a launcher command for `xmpp-serve` and Profanity. It is not built.
4. Review the Moglob bridge: `londat/docklands/foafos.js` uses `postMessage(data, '*')`.
