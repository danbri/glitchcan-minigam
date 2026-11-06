# foafos-proto: a prototype on Fly

**RETIRED on 2026-11-06. Do not deploy this.** The pods moved to `foafos-xmpp`, the one XMPP server and box on Fly: see `deploy/foafos-xmpp` in danbri/factoidal-core. The `bus` room is `bus@rooms.foafos-xmpp.fly.dev`, and the HTTPS pod is `https://foafos-xmpp.fly.dev:8443/`.

**A prototype, not a public service.** Everything here may change or be wiped. It runs our own code: Factoidal XMPP, Factoidal LWS, and `pod.mjs`.

| Part | Reached by | Notes |
|---|---|---|
| LWS pod over HTTPS | `https://foafos-proto.fly.dev/` with a bearer token | Caddy holds the token. Files are not encrypted at rest beyond Fly's volume |
| XMPP | `fly proxy` only | No public port, but private to the Fly organisation network, not to this app: other `contextris` apps can reach it. Run `fly proxy 15280:8081 -a foafos-proto` and `fly proxy 15223:5223 -a foafos-proto`, or `foafos-stack start fly` |
| LWS pod over XMPP | `pod@foafos-proto.fly.dev/lws`, through XMPP | Dials out to XMPP inside the machine |

Credentials are in `~/.config/foafos-proto/` on the laptop, and in Fly secrets: `accounts`, `token`. Data is on the `proto_data` volume, so it survives restarts and deploys.

The XMPP server has open security findings, which is why it has no public port. Do not add a Fly service for it until they are fixed.

Deploy from `packages/foafos/pod`:

```sh
fly deploy --config fly/fly.toml --dockerfile fly/Dockerfile --remote-only --ha=false --build-arg FACTOIDAL_VERSION=x.y.z
```
