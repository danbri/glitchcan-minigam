# The thin backend & capability model — the Enterprise bridge

*Decision spec. Companion to `pre-enterprise-foundations.md` §3. The suite is
local-first and static today; full OIDC, email, groups/groupware and governance
all need **one small trusted service**. This note fixes its shape so the
Enterprise phase is additive, not a rewrite. Keep it thin: it brokers and
relays, it is **not** the source of truth — the user's local-first data objects
are.*

## Principle: capability tokens, not ambient authority

From the deep-dive's capability-security finding: the backend never grants broad,
ambient access. It issues **capabilities** — unforgeable, **narrowly-scoped,
short-lived** grants for one action on one resource — minted only after verifying
an OIDC `id_token`. This dodges the confused-deputy problem by construction and
keeps the blast radius of any one token tiny.

```
Capability = { aud: <service>, sub: <principal>, scope: <one verb on one resource>,
               exp: <minutes>, nonce }            // signed by the service
```

The client presents its OIDC `id_token`; the service checks `aud`/`iss`/`exp`,
applies policy (RBAC/DLP — later), and returns a capability the client spends at
exactly one endpoint. No long-lived, broadly-scoped secrets in the browser.

## The five jobs (priority order) — and what each unblocks

| # | Endpoint (capability-gated) | Unblocks |
|---|---|---|
| 1 | **`/auth/token`** — OIDC token-exchange proxy (server holds client secret) | live sign-in for the deep-dive's Tier-B providers (Apple, LinkedIn, Discord…) whose token endpoints lack browser CORS |
| 2 | **`/keys/unwrap`** — release a per-user wrap secret on a valid token | **Tier-2 OIDC-gated encrypted-backup unlock** (`ENCRYPTED-BACKUP.md`) |
| 3 | **`/relay/*`** — capability-scoped fetch/WS relays | ICS calendar subscribe, the **IMAP/SMTP WebSocket proxy** (`mail/`), generic CORS relay |
| 4 | **`/sync/*`** — CRDT document sync + presence/awareness | **groupware**: real-time co-edit, sharing |
| 5 | **`/index/*`** — object metadata index, full-text search, **audit log** | governance: search, audit, retention, eDiscovery |

Jobs 1–3 are **stateless brokers** (cheapest; ship first). 4–5 are **stateful**
(sync state, search corpus, audit trail) and define the Enterprise tier proper.

## Data model it touches (already shaped for it)

- **Principal** = OIDC `sub`. **Group** = a principal that expands to members (later).
- **Object** = the `DataObject` (`js/data-object.js`): stable id, type, schema
  version, **content fingerprint**. The backend stores *metadata + sync state +
  ACL* keyed by object id — never (necessarily) the plaintext body; encrypted
  bodies and CRDT deltas suffice.
- **ACL** = `{ objectId → { principal → role } }` in the index (job 5).
- **Operation** = a `CommandRegistry.run()` event (`js/command-registry.js`). The
  registry's `run()` is the choke point that already carries no-op `audit` and
  `policy` seams — wire job 1's identity + job 5's audit/policy here.

## Sync (job 4) — the groupware core

- **CRDT, local-first** (decided in foundations §3). The server is a **relay +
  durability** for CRDT deltas and an **awareness** channel (cursors/presence) —
  not an authority. Clients converge offline and reconcile on reconnect.
- Per-body merge strategy is in foundations §3 (sequence-CRDT text; map/LWW grid;
  keyed-list records; mail = provider-of-record, not CRDT).
- Transport: WebSocket for deltas + awareness; capability per document.

## Host options (pick one)

| Option | Fit |
|---|---|
| **Cloudflare Workers + Durable Objects** | best fit: edge, cheap, DO gives per-document sync coordination + storage; WS native. **Recommended.** |
| Small container (Fly/Render/self-host) | full control; more ops |
| Serverless functions (Lambda/Cloud Run) | fine for 1–3 (stateless); awkward for 4 (stateful sockets) |

Whatever the host: it must be **auditable, minimal-dependency, and the user must
be able to self-host it** — that's the suite's open/ownable positioning. Publish
the protocol so the backend is replaceable (no lock-in to *our* server either).

## What stays client-side (do not move to the server)

Editing, rendering, the data engine (sql.js), format codecs, local cache, and the
**plaintext** of E2E-encrypted backups. The backend sees ciphertext, metadata,
CRDT deltas, and tokens — never more than it must. Local-first remains the
default; the backend is the *opt-in* connective tissue.

## Build order (Enterprise phase, after foundations land)

1. **`/auth/token` + `/keys/unwrap`** — stateless; flips mail/auth and backup
   Tier-2 from "configured but inert" to live. Smallest surface, biggest unlock.
2. **`/relay`** (IMAP/SMTP WS proxy + ICS) — makes the mail client and calendar
   subscribe real.
3. **`/index` + `/sync`** — the Enterprise tier: metadata/ACL/search/audit, then
   CRDT sync + presence = groupware.

When this service exists and the foundations (command registry, data objects,
identity seams) are in place, "full OIDC, email, groups, groupware, governance"
are **integration work against a decided architecture** — which is the definition
of pre-Enterprise-ready.
