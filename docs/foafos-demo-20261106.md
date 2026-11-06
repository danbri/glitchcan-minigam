# Foafos demo: every kind of pod, and the room

What works, and how to show it. It uses a prototype on Fly, which is not a public service.

## Run the proof

```sh
foafos-stack start
foafos-stack start
python3 -m venv ~/.slix && ~/.slix/bin/pip install slixmpp
cd inklet/finkapp/test
SLIX_PYTHON=~/.slix/bin/python CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  FACTOIDAL="$(npm root -g)/@factoidal/core" node e2e-goal.mjs
```

It opens a Chrome window, because Moglob needs a GPU. It takes about two minutes.

## What it shows

A sandboxed app, Files, whose origin is opaque, writes, reads, lists and deletes through each of:

| Pod | Reached by |
|---|---|
| Ephemeral | The LWS engine in the page |
| Device | The browser's private storage (OPFS) |
| Laptop | HTTP to `lws-serve` on this computer |
| Fly, HTTPS | `https://foafos-xmpp.fly.dev:8443/`, with a bearer token the app never sees |
| Fly, XMPP | HTTP over XMPP (XEP-0332) to a pod on Fly |
| Laptop, XMPP | The same to a pod here: `packages/foafos/pod/test/e2e-shell.mjs`, or `foafos-stack start pod-laptop` and `POD_LAPTOP=1` for the pod on the Fly server |

Then, in the XMPP room `bus@rooms.foafos-xmpp.fly.dev`:

- **A client that is not ours.** `slixmpp` logs in with SCRAM-SHA-256, joins, sees app activity, and sends `/go Tower Bridge`. Moglob's camera moves, through its WebMCP tools, after the shell checks that account's grant.
- **An AI.** `foafbot` answers `@foafbot please go to Canary Wharf` and asks the shell, under its own grant.

`foafos-stack chat` is our own client, for convenience. To show that this is open, use an outside client: slixmpp, BeagleIM, or any XMPP client with direct TLS to `127.0.0.1:15223` through the tunnel.

## Limits to say out loud

- The Fly XMPP server is public but unannounced: `foafos-xmpp.fly.dev`. It holds test data only.
- Factoidal's XMPP server has had no independent review.
- Rooms keep ghosts: a client that left can hold its nickname until the server restarts, so demos should use fresh nicknames.
