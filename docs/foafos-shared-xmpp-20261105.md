# Foafos: the shared test XMPP server (2026-11-05)

Owner, verbatim: "public service we do not announce, containing only test data on ephemeral machines we don't use for
anything else". Do not announce it.

| | |
|---|---|
| Fly app | `foafos-xmpp`, organisation `contextris`, region `lhr`, 1 shared CPU, 512 MB, 1 GB volume |
| Domain | `foafos-xmpp.fly.dev` (no federation) |
| Bus room | `bus@rooms.foafos-xmpp.fly.dev` |
| Clients | STARTTLS on 5222 (required), direct TLS on 5223 |
| Browsers | `wss://foafos-xmpp.fly.dev/xmpp-websocket`, from `https://danbri.github.io` and `http://localhost:8080` only |
| Accounts | `me`, `foafos`, `foafbot`, `test1`, `test2`. Passwords: `~/.config/foafos-xmpp-fly/accounts` on the laptop |
| Source | <https://github.com/danbri/factoidal-core/tree/main/deploy/foafos-xmpp> |

## Connect a shell

1. Open Chat in a shell at <https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?root=apps>.
2. Choose "Shared test server". Enter an account and its password. Connect.

The shell joins `bus`. `mirrorApps` stays `topics` and `inbound` stays off. If the nickname is the default `foafos`, the
form makes it `foafos-` and four hex digits, because a room refuses a nickname in use, and each shell needs its own.

## Connect a person

Profanity:

```
/connect me@foafos-xmpp.fly.dev
/join bus@rooms.foafos-xmpp.fly.dev nick me
```

BeagleIM: add an account with JID `me@foafos-xmpp.fly.dev`, and the password. Leave the server and port empty. Join the
channel `bus@rooms.foafos-xmpp.fly.dev`.

Clients find no SRV record for this domain, so they use STARTTLS on 5222. For direct TLS set host
`foafos-xmpp.fly.dev`, port 5223. In Profanity: `/connect me@foafos-xmpp.fly.dev server foafos-xmpp.fly.dev port 5223 tls direct`.

## Limits that are real

- Every account can join every room until the machine runs an engine with members-only rooms. The account list is the
  only gate. See the Factoidal README in `deploy/foafos-xmpp`.
- The room gets nicknames, so a room member cannot send a command. `/tell` needs a direct message and a grant.
- Rooms are temporary and have no history. A restart ends them. Clients must join again.
- Factoidal's XMPP server is experimental and has had no independent review.

## Test

`node inklet/finkapp/test/e2e-chat-shared.mjs` with `foafos-stack start shell`. Two Chrome shells and one outside client
use the public server. With `SHELL_URL` it tests another copy of the shell.
