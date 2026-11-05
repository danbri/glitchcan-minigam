# foafos-proto: a prototype on Fly

**A prototype, not a public service.** Everything here may change or be wiped. It runs our own code: Factoidal XMPP, Factoidal LWS, and `pod.mjs`.

| Part | Reached by | Notes |
|---|---|---|
| LWS pod over HTTPS | `https://foafos-proto.fly.dev/` with a bearer token | Caddy holds the token. Files are not encrypted at rest beyond Fly's volume |
| XMPP | `fly proxy` only | No public port. `fly proxy 15280:8081 15223:5223 -a foafos-proto` |
| LWS pod over XMPP | `pod@foafos-proto.fly.dev/lws`, through XMPP | Dials out to XMPP inside the machine |

Credentials are in `~/.config/foafos-proto/` on the laptop, and in Fly secrets: `accounts`, `token`. Data is on the `proto_data` volume, so it survives restarts and deploys.

The XMPP server has open security findings, which is why it has no public port. Do not add a Fly service for it until they are fixed.

Deploy from `packages/foafos/pod`:

```sh
fly deploy --config fly/fly.toml --dockerfile fly/Dockerfile --remote-only --ha=false --build-arg FACTOIDAL_VERSION=x.y.z
```
