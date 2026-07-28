# FINK story sandbox — threat model and the runtime/document split

**Status:** design, 2026-07-28. Owner-directed. Precedes implementation.
**One-line problem:** a `.fink.js` story loaded at runtime runs in the
**host page** with the shell's own authority. Half-secure is insecure.

---

## 0. Why this exists (the owner's framing)

We can encounter new FINK stories and games dynamically at runtime — a
`# FINK:` link points anywhere in the Finkiverse, and we did not write
what it points at. Today those documents execute as privileged kernel
code. Every capability we have layered on guests (scoped bus, vars
governance, secrets, attenuation) is undermined while the **story** — the
thing most likely to be untrusted — is the one thing that runs unsandboxed.

The decisive move is **the frame boundary**, and the reason is not that it
is a perfect wall. It is that it makes trust policy *assessable instead of
load-bearing*:

> Once a story runs in its own opaque origin, the worst outcome of a
> flawed trust policy is an evil app **in a box** — never the host page.
> We can then compare policy options on a level playing field, knowing the
> containment holds even if a given policy is wrong.

So the order is: (1) this document; (2) **containment** — FinkStoryRunner
becomes a boxed app and the story a boxed document, the level playing
field; (3) **policy** — the forkable inter-story trust graph on top of it.
Containment and policy are two different problems (§4); this doc designs
both so the build is designed, not improvised.

---

## 1. Assets to protect

1. **The shell origin** (`danbri.github.io` in prod). Its localStorage
   holds sealed sessions, `foafos.secrets`, every app's store, skins,
   verb scopes. Same-origin script = total compromise.
2. **Secrets and brokered verbs.** A bearer token that can commit to a
   real GitHub repo. `FoafSecrets` already refuses `get`; the story must
   not be able to route around it via `ops` or by reading the DOM.
3. **Other apps and other stories.** One story must not read another
   story's plot flags, drive another guest, or forge a sibling's bus
   voice.
4. **The user's attention and trust.** Phishing surface: a story that
   restyles the shell to imitate a login prompt, or navigates the user
   off the installation. (Already observed once: a chrome link with a
   hard-coded origin was a one-tap exit — see the skill.)
5. **Availability.** A story that hangs, floods the bus, or exhausts
   storage should degrade itself, not the shell.

## 2. Attacker model

- **A1 — Hostile author.** Writes a `.fink.js` specifically to break out:
  crafted tags, malicious external functions, XSS payloads in prose,
  bus floods, storage exhaustion.
- **A2 — Compromised link.** A story we trust `# FINK:`-links to a story
  we do not. Transitive: trust does not flow across a link.
- **A3 — Confused deputy.** A well-meaning story is driven by attacker
  input (player-entered text, a fetched value) into doing something the
  player would not expect.

Out of scope for v1 (named, not solved): timing/Spectre-class
cross-origin inference; a browser sandbox-escape bug; the user choosing to
install a malicious root. These are the browser's boundary, not ours.

## 3. Every story → host channel (the enumeration)

A sandbox that misses one channel is the "half" that is false. This is the
complete list as of today (`fink-ink-engine.js`, `fink-ui.js`,
`fink-player.js`). **Every row must have a defined disposition in the new
model — mediated, dropped, or proven safe.**

| # | Channel | Today | Risk | New disposition |
|---|---------|-------|------|-----------------|
| C1 | Prose text → DOM | `escapeHtml` then `innerHTML` with a **markdown→HTML** pass (`**b**`, `*i*`, autolink) | escapeHtml runs BEFORE the regex adds `<b>/<i>/<a>`; the autolink builds an `<a href>` from story text | Render in the story frame's OWN document; host never innerHTMLs story text. Re-audit the markdown pass there. |
| C2 | `# BG:` | writes `document.body.style.background` | arbitrary CSS into the host (phishing, `url()` exfil) | Verb `chrome.bg`, capability-gated, value sanitized; applies to the story frame, not host body |
| C3 | `# CLASS:` | `p.classList.add(value)` on host element | joins host CSS namespace | Applies inside the story frame only |
| C4 | `# FINK:` load | fetches + compiles another story into the host | the dynamic-encounter breakout; transitive trust | Verb `story.link`; child loads as its OWN sandboxed app, never inherits parent authority |
| C5 | `# MINIGAME:` | launches any registered game | escalation to a differently-capable app | Verb `story.minigame`; only games the story's grant allows |
| C6 | `# AUDIO:` / `# FOLEY:` / `# STOP_AUDIO:` | drives FinkAudio/FinkFoley directly | nuisance; cross-story audio leak (already a known bug) | Verb `audio.*` through the existing audio service |
| C7 | `# STATUS:` | writes the host status bar | spoof another story's HUD | Declarative, rendered by the runtime from a typed payload; no host reach |
| C8 | `# IMAGE:` / `# VIDEO:` / `# BASEHREF:` | sets media paths, builds `<video>`, YouTube embed in host | SSRF-ish fetch; embed arbitrary origin; path traversal on BASEHREF | Media resolves and renders in the story frame; BASEHREF confined to a declared prefix |
| C9 | Ink variables | `variablesState[x] = y` ungoverned | write shared economy or another story's flags | `FoafVars`-style governance at the story boundary; PLUS provenance-on-state and the taint rule (§5.3) |
| C10 | Ink external functions | `BindExternalFunction` — **grep: none bound today** | if ever added, host code the story calls directly | Forbidden across the boundary; the runtime binds none on a story's behalf |
| C11 | Dream stack | pushes `story.state.ToJson()` + descends | a child story rides the parent's frame/authority; state accumulates and taints (§5.3) | Each dream frame is its own app instance; state carries its writer's tier; low tier can't raise high (§5.3) |
| C15 | Session accumulation | `_inventory` injection, shared-economy flow, var/knot rename & MERGE into one namespace | merging can collapse document boundaries and hand one story another's authority | Provenance-on-state + integrity rule; a merge is bounded by its least-trusted input (§5.3) |
| C12 | Navigation / links | two-part hash links, `# LINKREL` | drive the shell's navigation | Verb `story.navigate`, gated |
| C13 | Direct globals | `window.FinkInkEngine`, `FinkPlayer`, `FinkUI`, `FoafOS` all reachable from story-run code | total, today | **Gone by construction**: opaque origin has no `parent.*` |
| C14 | The compile step | `.fink.js` via `new Function` | ALREADY isolated in an opaque iframe (`fink-sandbox.js`) | Unchanged — this boundary already holds |

Rows C2, C3, C4, C13 are the sharp edges: unmediated host-DOM and
host-global reach. C13 is the one the frame split closes for free — an
opaque origin simply has no handle to `parent`.

## 4. Two different problems — do not conflate them

The owner's sharpening, 2026-07-28. There are **two** problems here and
they are not the same:

1. **CONTAINMENT — box the runner and every app.** Table stakes.
   Non-negotiable. The platform's job. This is the frame boundary, and
   "half-boxed is not boxed." Once done, the worst any app or story can do
   is contained to its own opaque origin.
2. **POLICY INTELLIGENCE — the inter-story trust graph.** *"Being really
   smart on security is a competitive advantage."* This is the nuanced
   decision of whether story B, referenced by story A, may do what A does.
   It lives inside a **forkable** runner, and it is the moat.

Containment makes the platform safe. Policy makes a *fork* good. The first
must be perfect; the second may be imperfect and still ship, because the
first contains its mistakes. Do not let work on the interesting second
problem substitute for the boring first one — that was the whole "half is
false" critique.

### 4.1 The app model: one shape, many sizes

Everything is an app; size is not a security property. Same containment,
same bus, same verb protocol, whether it is a suite or a status pill.

- **Big apps:** **FinkStoryRunner** (the narrative runtime), **TellyClub**
  (TV), **Office** (the edot suite).
- **Small apps:** widgets, minigames, chrome/UI elements, the status line.

**FinkStoryRunner is an app, not a kernel service** — this corrects the
earlier draft, which called the runtime a "trusted shell service." It is a
big app like TellyClub: opaque origin, boxed by the shell, reaching the
host only through the bus + verbs. And it is **forkable** — the platform
ships one; anyone can ship another. The fork is where trust *policy* lives.

### 4.2 Nested containment

    ┌─ shell (host origin) ── owns secrets, bus, app tree, verb dictionary
    │  boxes every app; the one thing that must never be wrong
    │
    │  ┌─ FinkStoryRunner (big app, opaque origin, FORKABLE) ──────────┐
    │  │  boxed by the shell. Runs stories. Holds the trust POLICY.     │
    │  │                                                                │
    │  │   ┌─ story A  (danbri-test.fink.js) ─ boxed by runner + shell  │
    │  │   │   refs → story B (danja-test.fink.js)                      │
    │  │   │            relationType = peeredStory                      │
    │  │   │            integrity   = sha256-7344…                      │
    │  │   │   ┌─ story B ─ grant decided by the runner's POLICY ────┐  │
    │  │   │   └──────────────────────────────────────────────────────┘  │
    │  │   └──────────────────────────────────────────────────────────┘ │
    │  └────────────────────────────────────────────────────────────────┘
    └──────────────────────────────────────────────────────────────────

**Two boxing layers.** The shell boxes the runner; the runner's policy
governs the stories inside it. Even a naive or hostile runner-fork policy
cannot exceed what the shell granted the runner — so a *smart* fork is a
better product and a *dumb* fork is still contained. That is exactly the
"evil app in a box, never the host page" property, one level down.

Mechanisms, all reusing machinery that already exists:

- The story app frame speaks the **guest wire protocol** (spec §5.7):
  `bus-publish` / `bus-event`, scoped, provenance-stamped.
- Tag effects become **verbs** (spec §5.5.5): `chrome.bg`, `story.link`,
  `story.minigame`, `audio.play`, `story.navigate`. The story supplies
  data, never a destination or a function; the runner (and behind it the
  shell) decides what a verb means and whether it is allowed.
- Variable writes go through **`FoafVars`** at the story boundary.
- Prose renders in the story frame's **own document** — the host never
  `innerHTML`s story text again; C1's markdown pass moves inside the frame,
  where an XSS is contained to that opaque origin.

## 5. The inter-story trust graph (the competitive-advantage layer)

A reference from one story to another is a **typed, content-pinned edge**:

    # FINK: danja-test.fink.js
    # LINKREL: peeredStory
    # INTEGRITY: sha256-7344273250…

- **relationType** (`peeredStory`, and the existing `goDeeper` /
  `goShallower` / `oneWay`) is the vocabulary a policy reasons over. A peer
  is a different relationship from a child dream, and may deserve a
  different default grant.
- **The content hash is ONE signal — a strong one, not the only one, and
  not required.** `sha256-…` (Subresource-Integrity format) pins the
  reference to **exact, immutable content**, which is what lets you write
  the *precise* policy *"trust danja-test to do exactly what I do"* — that
  particular claim needs immutability, because trust in exact behaviour is
  meaningless if the bytes can change under you. But that is the strict
  end of a spectrum, not a gate on all trust:

  > **Correction (owner, 2026-07-28):** an earlier draft said a reference
  > *"can only"* be trusted with a hash and *"can never"* rise above
  > `untrusted` without one. That is wrong. It is reasonable sometimes to
  > be more lax, or to trust on **different signals**.

  A policy may legitimately trust on: **origin** (an allowlisted host),
  **author identity** (a signature over the content, which licenses trust
  in *this author's future files too*, not just one hash), **reputation**
  (a registry, a prior good history), **trust-on-first-use**, or an
  **explicit human "allow once."** The hash buys *content-precise* trust;
  a signature buys *author* trust across many files; an origin allowlist
  buys *coarse* trust cheaply. Choosing among these — and how lax to be —
  is exactly the forkable policy (§5.1), not a fixed rule.

### 5.1 Policy is a function, and it is forkable

The runner's policy is:

    grant(peer) = policy(referrer, relationType, contentHash,
                         provenance, grant(referrer))

- *"A peer gets exactly what the referrer can do"* is **one** policy — the
  symmetric-peer option the owner named. A conservative default fork would
  instead attenuate by relationType (peer < self, dream < peer).
- **Attenuation is the platform floor:** `grant(peer) ⊆ grant(referrer)`
  is enforced by the app tree regardless of the fork's policy. A fork may
  choose to grant *less*; it can only grant *more* up to what the shell
  gave the runner — and that ceiling is the containment guarantee.
- **`contentHash` is one input among several.** The signature of `policy`
  should read more like `policy(referrer, relationType, {hash, origin,
  signature, reputation, priorConsent}, provenance, grant(referrer))` — a
  fork weighs whichever signals it trusts. A strict fork demands a hash; a
  laxer one accepts an allowlisted origin or a known author key; a social
  one asks the human.
- **Forks compete on intelligence above the floor:** hash allowlists,
  author-signing / reputation, per-origin trust, interactive
  capability negotiation ("this peer wants economy write — allow once?").
  This is where "really smart on security" becomes product differentiation
  — and none of it can breach the shell box beneath it.

### 5.2 Default tiers (the platform's own conservative fork)

The platform ships a deliberately coarse default policy — three tiers.
A fork replaces this function; it does not replace the containment.

- **`bundled`** — shipped in this repo / this root's manifest. Full
  narrative capability. Hampstead, Bagend, world-between-worlds.
- **`linked`** — reached by a hash-pinned `# FINK:` from a bundled story,
  same origin or an allowlisted origin. Narrative capability MINUS shared-
  economy WRITE, `story.navigate` outside the installation, and
  `story.minigame` beyond a safe set. Tells its own tale; cannot spend the
  waking world or drive the shell.
- **`untrusted`** — anything the policy has no positive signal for. Prose +
  choices + its own media. No chrome, no economy, no launch, no navigate.
  It renders, offers choices, and ends. Nothing escapes its frame.

These are the *default* fork's cut-offs, not laws. This default happens to
treat an unhashed reference as `untrusted` — a conservative choice — but a
different fork may raise it on origin, signature, or consent (§5). The
tiers are a starting policy, not the boundary; the boundary is the frame.

Tiers are assigned by the runner from provenance and the edge, **never
self-declared by the story**. **A root is not a security boundary**
(existing rule): `?root=` is a query param; the frame origin and the verb
gates are the real boundary, and the tier only tunes the grant within it.

### 5.3 The session is a tainted accumulation (owner, 2026-07-28)

A per-load tier is not enough, because a running FINK **session is not one
document — it accumulates.** Trust is a property of the session's
accumulated state, not of a single compile. After sandbox compilation,
content keeps being **injected and merged** into the live session, and each
injection is a taint vector:

- **Shell injection.** The engine appends `_inventory` (and its VAR
  declarations) to EVERY story — so even a lone story's running state is
  already a *merge* of author content and shell content.
- **The dream stack.** `# FINK: … goDeeper` pushes the parent's full state
  (`state.ToJson()`) and descends into a child document; END pops back. The
  parent's state persists across an excursion into less-trusted content.
- **Shared economy.** `diamonds`/`score`/`keys` flow story→story by design
  (and guest→story via the SDK). A value a `linked` story wrote is later
  read by a `bundled` one: information flowing *up* the trust order.
- **Var/knot renaming & merging.** The namespace-merge idea
  (`fink-namespace-preprocessor.js`, not yet wired) folds multiple `.fink.js`
  into one namespace. Merging is the sharpest vector of all: fold danja's
  knots into danbri's namespace and, within that namespace, danja's content
  can acquire danbri's authority. A crafted name (or a collision) becomes a
  reach into another document's flags.

**The model: state carries the tier of whoever WROTE it — provenance on
state, not just on the running document.** From that, an *integrity* rule
(Biba-shaped): a higher-tier reader must treat lower-tier-written state as
**tainted** — advisory at least, refused for anything sensitive (spending
the economy, gating a verb, choosing a navigation target). Low-integrity
input must not silently become high-integrity authority.

This is not new machinery invented here; it is the **generalisation of a
rule that already exists**: *"dreams at depth > 0 get the shared economy
read-only."* That is exactly "a less-trusted accumulation must not write
the waking world's high-integrity state." Generalise it:

- Every shared var (and every merged knot region) is tagged with the tier
  of its writer; a read across a tier boundary is flagged to the policy.
- The **shared economy is the one deliberately-shared channel**, and it is
  already governed (`FoafVars`, spec §5.3). Everything else stays
  **partitioned** unless a merge is an explicit, tier-bounded decision.
- **A merge's result is bounded by its least-trusted input** for the merged
  region. Merging is a trust decision the runner's policy makes, not a
  mechanical convenience — and, like everything in §5, it is forkable.

Containment (Phase 2) still holds under all of this: taint can corrupt what
happens *inside* the runner's session, but it cannot cross the shell box.
The session-taint model is a **Phase 3+ concern** — an integrity policy on
top of the boundary, not a substitute for it.

## 6. Phased implementation

The split from §4 sets the order: **CONTAINMENT first (Phases 1–2), then
POLICY (Phases 3–4).** Containment must be perfect; policy may be imperfect
and still ship, because containment contains its mistakes.

- **Phase 1 — this document.** ✅ Channels, attacker model, target
  contract, the two-problem split, the trust-graph model.
- **Phase 2 — CONTAINMENT: FinkStoryRunner becomes a boxed app.** This is
  the level playing field; it changes the security posture.
  1. **FinkStoryRunner** as a big app (peer of TellyClub/Office): owns the
     runtime (inkjs, Continue loop, dream stack, tag dispatch), runs in its
     own frame, reaches the host only via bus + verbs.
  2. The story DOCUMENT runs in an opaque-origin frame and renders
     prose/choices/media in ITS OWN document.
  3. Route every channel in §3 through the boundary; delete every
     `parent.*`/host-global reach from story-run code (C13 closes for
     free once there is no `parent`).
  4. Gate: a breakout suite that, from inside the story frame, TRIES each
     C-row and proves it refused or contained (e2e-vars / e2e-caps
     pattern). This gate is the definition of "boxed."
- **Phase 3 — POLICY: the trust graph + session integrity, default fork.**
  Typed edges (`relationType` + optional `# INTEGRITY:`) weighed over
  MULTIPLE signals (hash, origin, signature, reputation, consent — §5), not
  a hash gate; `policy(referrer, rel, signals, provenance, grant) →
  grant(peer)`; the three default tiers. PLUS the session-taint model
  (§5.3): provenance on shared/merged state, and the integrity rule that a
  higher-tier reader treats lower-tier-written state as tainted (generalise
  the existing dream-economy-read-only rule). Proven: an `untrusted`
  fixture renders with no escape; a trusted `peeredStory` gets its grant; a
  low-tier write cannot silently raise high-tier authority through the
  shared economy or a merged namespace.
- **Phase 4 — POLICY as a fork surface + disclosure.** Make the policy
  function a replaceable module (the competitive-advantage seam): a fork
  can supply reputation, signing, allowlists, interactive negotiation. Plus
  bus-flood throttle, storage quota, and a VISIBLE tier indicator — the
  user should SEE that an encountered story runs restricted, and the
  service inventory should tell the truth about what the running story may
  do.

## 7. Test topology (designed now, built with each phase)

- `story-sandbox.test.js` — unit: the verb dictionary at the story
  boundary; each tag → verb mapping; tier → grant.
- `e2e-story-sandbox.mjs` — the breakout suite. A deliberately hostile
  `.fink.js` fixture that attempts, from inside its frame: host-global
  reach (C13), `chrome.bg` CSS injection (C2), prose XSS (C1), a `# FINK:`
  to a forbidden origin (C4), an economy write it is not granted (C9), a
  bus publish outside its namespace (§5.7). Every attempt asserted
  refused/contained. **Plant the attacks and assert they are SEEN** — an
  audit that silently stops working reports clean forever (skill lesson).
- The existing mandatory journey (`e2e.mjs`: TOC → Hampstead plays) must
  stay green throughout — a `bundled` story must be exactly as capable as
  before.

## 8. Explicit non-goals for v1

- Not defending against browser sandbox-escape bugs or Spectre.
- Not making `untrusted` stories *featureful* — restricted is the point.
- Not moving the compile sandbox (C14) — it already holds.
- Not shipping a cryptographic author-identity / signing scheme in the
  default policy. But the Phase-4 policy seam is designed to ACCEPT one:
  signing, reputation, and hash-allowlists are exactly the fork-level
  intelligence the competitive-advantage layer exists to host.

---

**Next step after this doc:** Phase 2, the frame boundary. It is
security-critical infrastructure (CLAUDE.md: do not casually modify the
sandbox; test loading after every change). It will be built behind the
mandatory Hampstead journey and the breakout suite, not by eye.
