# Pre-Enterprise foundations — the decided architecture

*Companion to `ui-architecture-deepdive.md`. That report surveyed the field; this
note **decides** the foundations to put in place **before** the big Enterprise
pushes (full OIDC, email, groups/groupware, governance). The rule for this phase:
**consolidate, don't expand.** Lay the three things those pushes depend on, and
harden what exists. No new apps until these land.*

Status legend: ✅ done · 🟡 partial · ⬜ todo.

---

## 0. Why "before"

Groupware, governance, and full identity are not features bolted onto the side —
they are **properties of the data model and the operation model**. If the suite's
objects aren't addressable and its mutations aren't a serializable stream, then
co-editing, sharing, audit, and policy each become a rewrite. The cheap insurance
is to shape three foundations now, while it's still first-party and local.

The three foundations, and the Enterprise capability each unblocks:

| Foundation | Unblocks |
|---|---|
| **1. Command/action registry** (operations as data) | co-editing op-stream, undo/redo, audit log, macros/plugins |
| **2. Unified data-object + identity model** | sharing/ACLs, sync, versioning, DLP/retention, search |
| **3. Decided collaboration model + thin backend** | real-time groupware, live OIDC/mail, the key service, presence |

---

## 1. Command / action registry — *operations as data*

**Decision: build a `CommandRegistry` and make every user-meaningful mutation a
registered command.** A command is data:

```
{ id: 'doc.format.bold', title: 'Bold', icon: '𝐁', group: 'format', order: 10,
  shortcut: 'Mod+B', when: (ctx) => ctx.surface === 'editor',
  run: (ctx, args) => … }
```

Surfaces (toolbar, menu, command palette, context menu) **render from
contributions** (`registry.contributions(surface)` filtered by `when`, sorted by
`group`/`order`) — the Eclipse/VS Code model from the deep-dive, not hand-wiring.

**Why it's a groupware prerequisite, not just UI hygiene:** a co-editing session
is a *replayed stream of operations*. If every mutation already flows through
`registry.run(id, args)`, that call site is the natural place to: capture the op
for **CRDT/OT sync**, push it to the **undo stack**, and emit an **audit event**.
Build the spine before you must serialize it.

- ✅ `js/command-registry.js` — the registry (register/get/run/contributions, `when`, shortcuts) with no-op `onAudit`/`onPolicy` seams at `run()`.
- ✅ **Command palette** (`Mod+K`) — additive surface that lists+runs all commands. Did this first: low-risk, a real Enterprise-grade UX feature, and authoring it forced enumerating the suite's **operation vocabulary** — exactly the alphabet collaboration will sync.
- ✅ Migrate existing actions: the **File menu and suite-launcher items now run through `commands.run(id)`** (the audit/policy choke point), and **export commands are generated from the io format table** so the registry is the single source of truth for every export. ⬜ Formatting toolbar still renders independently (commands exist; rendering-*from-contributions* is the remaining, most test-heavy migration — do it last, carefully).

---

## 2. Unified data-object + identity model

**Decision: every persisted thing is a `DataObject` with a storage-independent
identity** — your own "storage ≠ format" point, made structural.

```
{ id,                // stable, opaque (uuid); survives moves/renames
  type,              // 'doc' | 'sheet'/'data' | 'deck' | 'calendar' | …
  schemaVersion,     // SemVer of the body schema
  meta: { title, createdAt, modifiedAt, owner?, labels? },
  body,              // the canonical core (lossless, self-contained)
  fingerprint }      // SHA-256(canonical-serialization(body))
```

- **Identity is content + id, never location.** IndexedDB is one cache; a file, a
  GitHub commit, an S3/WebDAV/Solid object, or a sync server are equal venues.
  (The durable data forms already fingerprint; generalize it.)
- **Canonical serialization must be deterministic** (stable key order, no embedded
  timestamps) so fingerprints are stable — we already learned this with zip
  mod-times; apply suite-wide.
- **Lossless self-contained body** (images inline, no external handles) so the
  object round-trips byte-identically anywhere.

State:
- ✅ A shared `js/data-object.js` (id/type/schemaVersion/meta/body + deterministic
  canonicalization + SHA-256 content fingerprint), unit-tested pure-Node.
- ✅ Adopted across the flagships: **editor → `.edoc`** (canonical envelope around
  the doc HTML, carrying the live doc's stable id, deterministic bytes, embedded
  fingerprint; every other export — pdf/docx/md/html/txt — is now an explicit view
  *derived from* it); **slides → `.edeck`** (the template) + media type +
  fingerprint; **data** durable forms (SQLite/CSV-zip/N-Quads) route through the
  **same shared `fingerprint()`** so there is one SHA-256 implementation suite-wide.
- ✅ Calendar keeps **iCalendar (RFC 5545)** as its canonical/interop form (per-event
  UIDs already self-identify); a JSON `.ecal` envelope would *reduce* interop, so
  it's intentionally not wrapped.
- ⬜ A tiny **object/metadata index** (id → type, title, version, fingerprint,
  timestamps) separate from each app's body store. This is the table ACLs, sync
  state, search, and retention will hang off. Local now; server-mirrored later.
  **This is the next foundations build.**

---

## 3. Collaboration model + thin backend — *decide on paper, first*

**Decision: local-first + CRDT, with a thin sync/services backend.** Rationale
(from the local-first research): preserve offline/ownership/open-format strengths;
CRDTs converge without a central authority and degrade gracefully when the network
is absent. OT was rejected (needs a central transform authority and is harder to
get right); pure server-authoritative was rejected (kills the local-first thesis).

CRDTs are **not uniform across data types** — plan per body:

| Body | Merge strategy |
|---|---|
| **Rich text (doc)** | sequence CRDT (RGA/Yjs/Automerge-text); the hard one |
| **Spreadsheet/grid** | per-cell LWW or a map-CRDT keyed by stable cell id; **formulas recompute from merged values** (the DAG is deterministic) |
| **Structured records (calendar, places, deck slides, settings)** | map/list CRDT with stable element ids (slides already have per-element ids — keep that) |
| **Mail** | *not* CRDT — provider is the source of truth; sync = cache reconciliation |

**Shape the data now to be merge-friendly:** stable ids on every element (slides
✅), avoid array-index identity, avoid structures whose meaning depends on
position. We don't implement CRDTs in this phase — we **stop making choices that
preclude them.**

**The thin backend** (one small trusted service) is the convergence point. It
unblocks, in priority order:
1. **Auth token-exchange proxy** → live OIDC for providers without browser-CORS token endpoints (the deep-dive's Tier-B providers).
2. **Tier-2 key service** → OIDC-gated encrypted-backup unlock (`ENCRYPTED-BACKUP.md`).
3. **CORS/relay proxies** → ICS calendar subscribe, the **IMAP/SMTP WebSocket proxy**, generic fetch relay.
4. **Sync + presence** → the groupware engine (CRDT doc sync, awareness).
5. **Search, audit, admin** → governance.

⬜ Decide host (Cloudflare Worker / small container / self-host) and stub the
**capability-scoped** API (the deep-dive's capability-security model: the service
hands out unforgeable, narrowly-scoped grants, never ambient authority).

---

## 4. Identity, ACL & governance *seams* (leave the hooks, not the features)

Don't build governance now — but leave the seams so it isn't a retrofit:

- **Identity:** the OIDC `sub` is the principal. Objects carry `owner` (a `sub`);
  the metadata index can later carry an ACL `{ principal → role }`. Groups come
  later (a group is just a principal that expands to members).
- **Audit:** the command registry's `run()` is the single choke point — every
  governable action passes through it. Leave a no-op `audit(event)` hook there now.
- **Policy/DLP/retention:** these are predicates over `{ object.meta, command, principal }`.
  Leave a no-op `policy.check(command, object, principal)` gate at `run()` and at
  export/share boundaries. Implement later; the call sites exist now.
- **Sensitivity labels:** reserve `meta.labels` / `meta.classification`.

This is the "extension islands pass through unharmed" discipline applied to
governance: reserve the slots, ignore them losslessly until they're implemented.

---

## 5. Hygiene to clear in this phase (cheap; prevents carrying debt)

- 🟡 **Consistency pass** — ✅ one export+fingerprint convention (shared
  `data-object.js`/`fingerprint()` across editor/slides/data), ✅ slides `.edeck` /
  editor `.edoc`, ✅ the alpha sign-in chip now on **every** app (mail/data/backup
  added). Still ⬜: full shared-widget reuse (tree/longpress/toolbar). The apps
  drifted because parallel agents built them.
- 🟡 **CI** — `run-tests.mjs` now runs all 12 suites with one command.
  Still ⬜: a CI **workflow** to run it on push — blocked by the App's missing
  `workflows` permission (per CLAUDE.md the E2E template needs a manual move into
  `.github/workflows/`). Hand-off item for danbri.
- ⬜ **Security** — suite-wide **CSP** (worknotes flagged its absence; test per app
  — sql.js/MapLibre workers and the FINK sandbox need care), the auth
  tokens-in-web-storage XSS caveat (documented; mitigate via the backend session
  later), SBOM of the vendored libs.
- ⬜ **A11y/i18n** — a WCAG-AA + screen-reader pass; **RTL chrome** (the new decks
  test bidi *content*; verify the *UI* mirrors), locale formats.
- 🟡 **Determinism** — the codecs embed no dates/random and zip mod-times are
  zeroed; re-export byte-equality is now a **regression guard** for `.edoc`/`.docx`/
  `.pdf` (editor e2e) and `.pptx` (slides). ⬜ Still extend the guard to `.odp`/PDF
  metadata edge cases and the data N-Quads/CSV forms.

---

## 6. Sequencing (this phase)

1. **`run-tests.mjs`** ✅ (green baseline; 12 suites).
2. **Command registry + command palette** ✅, with the File menu + exports now routed through `run()`.
3. **`data-object.js` + slides `.edeck`/editor `.edoc`/unified fingerprint** ✅ — object model adopted across the flagships.
4. **Object/metadata index** ⬜ (next) + the remaining toolbar-from-contributions migration.
5. **Consistency + CSP + a11y/i18n** hygiene, in parallel (consistency: fingerprint convention ✅; CSP/a11y ⬜).
6. **Backend stub + capability API design** (no live services yet) — the bridge to the Enterprise phase. *Designed* in `backend-and-capabilities.md`.

When these hold, "full OIDC, email, groups, groupware, governance" become
*additions to a sound architecture* rather than rewrites. That is "pre-Enterprise-ready."
