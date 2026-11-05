# Foafos: who may use which app's tools (2026-11-05)

Every caller outside the Chat window is refused until it holds a grant. This replaces two weaker rules: a flat list of accounts that could then call any tool in any app, and a browser agent that could always do the same.

## For someone using Foafos

Open Chat, then Advanced, then "Who may use your apps", or type in Chat:

```
/grants                                 who may do what
/grant foafbot@localhost moglob go_to        look, and fly the camera
/grant foafbot@localhost moglob look         look only
/grant foafbot@localhost moglob all          everything in Moglob
/grant foafbot@localhost shell open          open apps
/grant agent moglob go_to               the same, for a browser agent
/revoke foafbot@localhost moglob             take one back
/revoke foafbot@localhost                    take everything back
```

These work only in the Chat window, never from a message. Each call, allowed or refused, shows in activity as `tools.called`, naming the caller. The arguments are not shown.

The room bot, `inklet/tools/chat-ai.py`, signs in as its own account, `foafbot`, so a grant to it is not a grant to you. Ask it with `@foafbot` in the room; it can do nothing until `/grant foafbot@localhost moglob go_to`.

## For developers

`packages/foafos/src/tool-grants.mjs`, enforced in `FoafTools.call`.

| Caller | Named by | Starts with |
|---|---|---|
| `PERSON` | the Chat window | everything, always |
| `accountCaller(jid)` | the `from` the XMPP server stamped on a direct message | nothing |
| `BROWSER_AGENT` | `FoafTools`, for calls through WebMCP | look, on a new shell |

- **`level: 'look'`:** tools marked `readOnly`. A tool is treated as changing something unless its app says otherwise.
- **`level: 'all'`:** every tool in that app.
- **`tools: [...]`:** those tools, as well as looking.
- **`app`:** an id, a name, `*`, or `shell`, which covers `/open` and `/bus`.

Rules the code keeps:

- `call()` takes a caller object from this module. A string, or an object that looks like one, is refused, because `allows` compares `PERSON` by identity.
- A room message never runs a command: members have nicknames, and anyone can take one.
- Taking a grant back settles the caller's running calls as `revoked`. The app may still finish what it started: nothing is rolled back.
- Grants hold no secrets. They are in `localStorage` under `foafos.toolGrants`, for the shell's origin, so each browser has its own.
- An old `commandJids` list is read once on start. Each account keeps `look` on every app, and the list is cleared.

## Why this design

The Codex work on 2026-11-04, `FoafControls`, had per-caller grants, but it was never committed and its clone in `/private/tmp` went in a reboot. This is a new build on `FoafTools`, not that code. It keeps what that work's independent review found to matter: authority comes from a verified source, never from fields the caller sends; it is checked on each call; and revoking reaches calls in flight. It does not include typed verbs for the app tree, the SPARQL worker, or the SDK reply check. A capture of `controls.mjs` from Codex's logs and the review are in `~/working/foafos-chat/recovered-codex-controls/`, outside the repo.

## Actions

`/tell APP ACTION` reaches an app's manifest `actions`. It is stricter than tools: the owner's `inbound` switch must be on, and
a grant for that app must name that action. `all` and `*` do not reach it. See
[foafos-bus-xmpp-20261105.md](foafos-bus-xmpp-20261105.md).

## Not done

A grant has no expiry and no limit on arguments, so `go_to` allows any place. Per-resource limits belong with pods.
