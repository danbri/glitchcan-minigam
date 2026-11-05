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

**Profanity 0.19.0 crashes after login today.** The server's disco results have no `from`, and Profanity has a NULL
dereference on that. The login itself works. The fix is on main of Factoidal
(<https://github.com/danbri/factoidal-core/commit/681e16da66aeb151c633387144fc6e2fd2ed85fc>) and needs a new engine build on
this machine. Until then use a shell or another client. A local test with a proxy that added `from` ran Profanity to the
end: it joined, sent and received in a room.

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

- Every account can join every room. The account list is the only gate. Members-only rooms are on main of Factoidal
  (`--muc-members`), and the machine does not run that engine yet.
- The machine runs the npm 0.31.1 engine with the host JavaScript of a later commit. So the limits on connections, login
  time and queued bytes are on, and the RFC 6120 restricted XML check (0.32.0) is not.
- The room gets nicknames, so a room member cannot send a command. `/tell` needs a direct message and a grant.
- Rooms are temporary and have no history. A restart ends them. Clients must join again.
- Factoidal's XMPP server is experimental and has had no independent review.

## Test

`node inklet/finkapp/test/e2e-chat-shared.mjs` with `foafos-stack start shell`. Two Chrome shells and one outside client
use the public server. With `SHELL_URL` it tests another copy of the shell.

## When a new engine is out

When npm has a version with commit `681e16da6` (or a later one), in `deploy/foafos-xmpp`: set `FACTOIDAL_VERSION`, remove
the `FACTOIDAL_HOST_COMMIT` lines from `Dockerfile` and `fly.toml`, add `--muc-members` to `entrypoint.sh` with
`bus: me@foafos-xmpp.fly.dev foafos@foafos-xmpp.fly.dev foafbot@foafos-xmpp.fly.dev`, deploy, and run `smoke.mjs`.
