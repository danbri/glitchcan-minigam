# Does foafos earn the "OS"? — two use cases beyond the game platform

*July 2026. Companion to `docs/foafos-notes.md`. Grounded in three live
codebases: the FINK game platform (this repo, `inklet/finkapp`), the
edot office suite (this repo, `magpie/edot`), and the foaf.tv / tvp
corpus browser (danbri/isle_of_glitch, `tvp/app` — surveyed via its
public deployment).*

An OS, minimally, provides: **process isolation**, **IPC**, a
**capability model** for shared resources, **identity/sessions**,
**window management**, and **scheduling of contended devices** (audio
out, fullscreen, cast targets…). The question is which of these foafos
actually has, which the web platform gives us for free, and which are
still vapour. Scorecard at the end.

## Case 1 — the office suite (edot)

`magpie/edot` is eleven apps in one shell: Documents, Data
(sql/spreadsheet/rdf/viz), Slides, Calendar, Mail, Maps, Files/Backup,
Groups, Projects, Automations. It already has three things foafos also
has. Not convergent evolution — same designer, same instincts (a
formative exposure to CORBA, XMPP, and web browsers is legible in all
three organs: object brokerage → string-id capabilities, presence and
federated messaging → the bus and transports, the browser → the shell
substrate itself). The design recurring across projects and years is
evidence it is load-bearing:

| edot has | foafos has | verdict |
|---|---|---|
| `Bus` (typed pub/sub, injectable BroadcastChannel transport, no-echo) | `FoafBus` (topics + wildcards + retained + bridge) | Same organ. Converge. |
| `Capabilities` (`provide`/`invoke` by string id, cross-tab via bus) | verb protocol (§5.2) + cluster resource claims | Same idea at different grain. Converge. |
| command registry + ontology (`appliesTo: EntityType`) | widget registry (kind → element) | Complementary: commands are verbs, widgets are nouns. |
| storage-identity model (OS-grant vs platform-auth, providers/accounts) | sealed ephemeral sessions | edot's model is the roadmap for foafos `profile`. |

**What edot lacks that the OS label demands: isolation.** The edot
shell mounts every app in ONE realm — custom elements in one DOM, CSS
"isolation" via a selector-rewriting scoper, shared globals, shared
IndexedDB keys. Any app can touch any other app's DOM and storage. Two
instances of the same app (the "two spreadsheets" test) share module
state by construction. That's a cooperative desktop, not an OS.

The FINK minigame path is ahead here, and it generalizes: a **hosted
widget is an `<iframe sandbox>` guest speaking postMessage** — opaque
origin, no shared globals, no ambient storage (localStorage throws!),
assets only via CORS. Two spreadsheet instances become two guest
frames: same code, two processes, zero shared state unless the shell
pipes it. The isolation boundary the browser already enforces for our
games IS the process model; the SDK (init/ready/verbs/complete +
manifest allowlists) is the syscall surface. The cost is real
(serialization, no shared DOM, per-frame memory) — which is why the
shell should offer BOTH tiers: trusted co-located components (edot
today, cheap, cooperating) and sandboxed guests (untrusted or
duplicated widgets), with the same bus/verb contracts either side of
the boundary so a widget can move between tiers without rewriting.

**Widgets-in-documents** (the MS-Doc/OLE case): the polyglot `.fink.js`
container already does typed blocks — `OO('application/vnd.foafos.widget+json')`
can carry a widget manifest (code URL + capability requests) inside a
document. The reader shell materializes it as a sandboxed guest with a
capability prompt. Same sigil machinery, no new format.

## Case 2 — foaf.tv (tvp corpus browser)

The tvp app is *already* widget-shaped: pinnable floating panels —
player, clock/time-machine, watch-buddy, channel guide, subjects,
timeline, ratings, channel chat, subtitles, quality/preload — over
Internet Archive collections. Externalizing them onto foafos is mostly
a re-labelling of what they already are:

- Each panel becomes a **web component satisfying the widget contract**
  (`set item`, emit `foaf-action`). The corpus itself is a **transport**
  (an adapter publishing `net.tvp.item` / `net.tvp.nowplaying`);
  annotations and ratings are **bus events** (`media.annotation`,
  `media.rating`) — which makes the activity feed a watch-party log for
  free, and makes annotations shareable over any future transport
  (fedi, XMPP MUC ≈ channel chat).
- The player is a **window** under FinkWM with the same verbs
  (pause/quit/audio) — a film pips exactly like Robbin does.
- The interesting new resources are **playback-shaped**: `audio` (one
  soundtrack per machine — shipped), `fullscreen` (one at a time),
  `cast` (exactly one Chromecast session per target device), `now`
  (the shared broadcast clock several windows should agree on).

"Sibling or descendant" components: both, deliberately. A tvp widget
should run (a) standalone in its own page (standalone-first rule,
§5.2), (b) co-located in a tvp shell, (c) sandboxed inside ANY foafos
shell. Same element, three mounts.

## The cluster — several shells, one flexible monolith

Shipped this commit (`packages/foafos/src/cluster.mjs`, E2E-locked):
same-origin shell windows bridge their buses, elect a **coordinator**
("the runner above"), and arbitrate named shared resources —
one holder per resource, last claim wins, previous holder is told to
yield, coordinator death re-elects and claims re-assert. First real
resource: **audio** — start a game in a second window and the first
window's game is blurred. `fullscreen`, `cast`, `fs-write` are the same
five lines each; the policy knob (last-wins vs priority vs ask-the-user)
lives in exactly one place, the coordinator.

Honest limits: BroadcastChannel is same-origin, same-browser — cross-
origin or cross-device clusters need a server rendezvous (the fly.io
arc) or WebRTC. And the cluster is a **courtesy protocol between
cooperating windows, not a security boundary** — a malicious page in
the cluster can lie. Which is the cue for:

## Zero trust, privacy first

What this must mean here, concretely:

1. **No ambient authority for guests.** Sandboxed iframes start with
   nothing: no storage, no network beyond CORS, no parent DOM. Every
   power arrives as an explicit grant — manifest allowlists (variables
   read/write, already enforced-by-design in `minigames/manifest.json`),
   verb declarations, resource claims. Widen this, never narrow it.
2. **Grants are visible and revocable.** The drawer is the natural
   surface: what this widget can see/do, shown as feed-able facts.
3. **Data at rest is sealed** (shipped: AES-GCM sessions, no plaintext
   path) and **data in flight is topic-scoped** — a guest's bus access
   should be a *filtered* bus view (its own namespace + granted
   topics), not the raw spine. This is the main unbuilt piece of the
   zero-trust story; the bus API shape (subscribe patterns) makes the
   filter easy to add.
4. **Identity is local-first** — nothing phones home; transports are
   opt-in per-source; the shell works fully offline (static hosting is
   the deployment story already).

## Scorecard — is "OS" deserved yet?

| OS ingredient | status |
|---|---|
| IPC / event spine | ✅ FoafBus (+ cross-tab), edot Bus to converge |
| Window management | ✅ FinkWM (modes, chrome, verbs) — single-window per shell so far |
| Process isolation | ◐ real for minigames (iframe guests); office widgets still co-located; two-same-kind-widgets needs the guest tier |
| Capability model | ◐ verbs + manifests + resource claims exist; filtered bus views + grant UI unbuilt |
| Sessions/identity | ◐ sealed local sessions; federation unbuilt (edot's provider model is the map) |
| Device scheduling | ◐ audio shipped incl. cross-window; fullscreen/cast/fs named but unwired |
| Multi-instance coordination | ✅ cluster (same-origin); cross-origin/device needs a rendezvous |
| Package/app model | ◐ manifests + registries; no install/update story |

Verdict: **"shell" is earned today; "OS" is earned when a widget you
don't trust can run twice, side by side, with visible grants** — the
edot two-spreadsheets test. That's the next concrete milestone:
`<foafos-guest>` — a generic sandboxed widget host (the minigame host,
de-game-ified) with a filtered bus view and a manifest prompt.

*(Terminology throughout remains the owner's: "foafOS", "shell
instance", "coordinator", "cluster" are all working names.)*
