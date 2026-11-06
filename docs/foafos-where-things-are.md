# Foafos: where things are

The map for anyone working on Foafos, person or agent. Keep it current.

## The rule

Work belongs on each repo's default branch, on GitHub. A branch is only a short step towards that. Default branch names vary, so read it rather than guess:

```sh
gh repo view OWNER/REPO --json defaultBranchRef --jq .defaultBranchRef.name
```

`/tmp` and `/private/tmp` are wiped at reboot. Never keep work there.

## Code

| What | Where |
|---|---|
| Shell | `inklet/finkapp/` |
| Core library | `packages/foafos/src/` |
| Apps | `inklet/apps/`, listed in `inklet/finkapp/apps/*.jsonld` |
| Drift | `drift-city/` |
| Server tooling | `inklet/tools/`: `foafos-stack.mjs`, `serve-foafos.py`, `chat-ai.py` |
| XMPP and LWS servers | Factoidal, published as `@factoidal/core` |
| Moglob | The `danbri/londat` repo, served from GitHub Pages |

## Running it

| What | Where |
|---|---|
| One command for all the servers | `foafos-stack`. Guide: [foafos-local-setup-20261104.md](foafos-local-setup-20261104.md) |
| Local checkout | `~/working/solid/glitchcan-minigam`, on the default branch. Update it with `git pull --ff-only` |
| Logs and server records | `~/.foafos-stack/` |
| Published shell | GitHub Pages, from the default branch |

## Data and secrets

None of this is in GitHub, and none of it should be.

| What | Where |
|---|---|
| XMPP accounts | `~/foafos-xmpp/accounts` |
| XMPP state key | `~/foafos-xmpp.key` |
| Local LWS storage | `~/foafos-lws/` |
| Tool grants | `localStorage` in each browser, key `foafos.toolGrants` |
| Built-in pod | IndexedDB `foafos-pods` in each browser, while the session is sealed |

## Cloud

Apps are in the `contextris` Fly organisation: `fly apps list`.

| App | What |
|---|---|
| `danbri-foafpod` | Public read-only LWS replica. It also runs a private XMPP test, reachable only through `flyctl proxy` |
| `factoidal` | Factoidal SPARQL service |
| `foafos-xmpp` | The one XMPP server and pod on Fly: rooms `bus` and `coord`, and the pod at `https://foafos-xmpp.fly.dev:8443/`. See `deploy/foafos-xmpp` in danbri/factoidal-core. |
| `foafos-xmpp` | Public, unannounced test XMPP server, by invitation. Test data only. See [foafos-shared-xmpp-20261105.md](foafos-shared-xmpp-20261105.md) |

Accounts for `foafos-xmpp` are in `~/.config/foafos-xmpp-fly/accounts`. Rebuild it from
<https://github.com/danbri/factoidal-core/tree/main/deploy/foafos-xmpp>.

## Design documents

| Topic | Document |
|---|---|
| Who may use app tools | [foafos-caller-grants-20261105.md](foafos-caller-grants-20261105.md) |
| Chat | [foafos-chat-window-20261104.md](foafos-chat-window-20261104.md) |
| The app bus over XMPP | [foafos-bus-xmpp-20261105.md](foafos-bus-xmpp-20261105.md) |
| The shared test server | [foafos-shared-xmpp-20261105.md](foafos-shared-xmpp-20261105.md) |
| World tools for Moglob and Drift | [foafos-world-tools-20261104.md](foafos-world-tools-20261104.md) |
| Pods | [foafos-pods-20261103.md](foafos-pods-20261103.md) |
| Where a person's files live | [foafos-where-files-live-20261105.md](foafos-where-files-live-20261105.md) |
| Opening a file with another app (exploring) | [foafos-open-with-20261105.md](foafos-open-with-20261105.md) |
| The demo: every kind of pod, and the room | [foafos-demo-20261106.md](foafos-demo-20261106.md) |
| Lost Codex controls work | [archive/codex-controls-20261104/](archive/codex-controls-20261104/README.md) |
