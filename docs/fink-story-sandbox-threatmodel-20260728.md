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

So the order is: (1) this document; (2) the runtime/document split — the
level playing field; (3) trust tiers as policy on top of it. This doc
designs all three so the build is designed, not improvised.

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
| C9 | Ink variables | `variablesState[x] = y` ungoverned | write shared economy or another story's flags | `FoafVars`-style governance already exists for guests; extend to the story boundary |
| C10 | Ink external functions | `BindExternalFunction` — **grep: none bound today** | if ever added, host code the story calls directly | Forbidden across the boundary; the runtime binds none on a story's behalf |
| C11 | Dream stack | pushes `story.state.ToJson()` + descends | a child story rides the parent's frame/authority | Each dream frame is its own app instance; depth is the runtime's, state is the child's |
| C12 | Navigation / links | two-part hash links, `# LINKREL` | drive the shell's navigation | Verb `story.navigate`, gated |
| C13 | Direct globals | `window.FinkInkEngine`, `FinkPlayer`, `FinkUI`, `FoafOS` all reachable from story-run code | total, today | **Gone by construction**: opaque origin has no `parent.*` |
| C14 | The compile step | `.fink.js` via `new Function` | ALREADY isolated in an opaque iframe (`fink-sandbox.js`) | Unchanged — this boundary already holds |

Rows C2, C3, C4, C13 are the sharp edges: unmediated host-DOM and
host-global reach. C13 is the one the frame split closes for free — an
opaque origin simply has no handle to `parent`.

## 4. The target architecture: runtime is a service, document is an app

Split the two things that today are one:

- **The narrative RUNTIME** — inkjs, the Continue loop, the dream stack,
  tag dispatch, media resolution — is a **shell service** (trusted,
  host-side or in a trusted worker). It owns no story data as authority;
  it is a machine that runs whatever document is handed to it.
- **The story DOCUMENT** — the `.fink.js` and its compiled Ink — is an
  **app**: it runs in an opaque-origin frame (`surface: 'story'`, like any
  other app in the tree), and reaches the runtime ONLY through the same
  bus + verb protocol every other app uses.

Concretely, mapping onto machinery that already exists:

- The story app frame speaks the **guest wire protocol** we just built
  (spec §5.7): `bus-publish` / `bus-event`, scoped, provenance-stamped.
- Tag effects become **verbs** (spec §5.5.5 / brokered actions): the story
  frame requests `chrome.bg`, `story.link`, `story.minigame`, `audio.play`,
  `story.navigate`; the shell's `ops` dictionary decides what each means,
  validates, and performs it. The story supplies data, never a
  destination or a function.
- Variable writes go through **`FoafVars`** at the story boundary — the
  governance that today only guards *guests writing into a story* now also
  guards *the story itself*.
- Prose renders in the **story frame's own document**. The host never
  `innerHTML`s story-authored text again. C1's markdown pass moves inside
  the frame, where an XSS is contained to the frame's opaque origin.

What the story frame is granted is the **trust tier** (§5). What it can do
with a grant is bounded by the frame. That is the level playing field.

### Why this is safe even if the policy is wrong

If we mis-grant — say we let an untrusted story call `chrome.bg` — the
damage is: it restyles **its own frame**. If we mis-grant `story.navigate`,
the shell mediates the target and can refuse cross-origin. The credential
half is already gated: secrets are memory-only unless sealed, and there is
no `secrets.get`. So a policy bug is an app-level bug, not a host
compromise. That is the whole point of doing the frame first.

## 5. Trust tiers (policy, on top of the boundary)

Three tiers, coarse on purpose. The tier sets the frame's capability grant.

- **`bundled`** — shipped in this repo / this root's manifest. Full
  narrative capability: chrome, link, minigame, audio, navigate, shared
  economy read/write. This is Hampstead, Bagend, world-between-worlds.
- **`linked`** — reached by `# FINK:` from a bundled story, same origin
  or an allowlisted origin. Narrative capability MINUS: no shared-economy
  WRITE (read-only, like a dream), no `story.navigate` outside the
  installation, no `story.minigame` beyond a safe set. Can tell its own
  tale, cannot spend the waking world or drive the shell.
- **`untrusted`** — anything else (arbitrary origin, unknown author).
  Prose + choices + its own media only. No chrome, no economy, no launch,
  no navigate. It renders, it offers choices, it ends. Nothing it does
  escapes its frame.

Tiers are assigned by the runtime at load time from provenance (where did
this URL come from, is the origin allowlisted), never self-declared by the
story. Attenuation still applies: a `linked` child of an `untrusted`
parent cannot exceed `untrusted` (grant(child) ⊆ grant(parent), the
app-tree rule).

**A root is not a security boundary** (existing rule): `?root=` is a query
param. Tiers must not rely on it for containment — the frame origin and the
verb gates are the real boundary; the tier only tunes the grant within
that boundary.

## 6. Phased implementation

Each phase is shippable and testable on its own. The boundary (Phase 2) is
the one that changes the security posture; everything after tunes policy.

- **Phase 1 — this document.** ✅ Enumerate channels, attacker model,
  target contract, tiers.
- **Phase 2 — the frame boundary (the level playing field).**
  1. A `story-host` service in the shell: owns the runtime, exposes it as
     verbs + bus, renders nothing itself.
  2. A `story-app` frame (opaque origin) that runs the Continue loop and
     renders prose/choices/media in ITS OWN document.
  3. Route every channel in §3 through the boundary; delete every
     `parent.*`/host-global reach from story-run code.
  4. Gate: an assertion suite that, from inside the story frame, TRIES each
     C-row breakout and proves it is refused or contained — the e2e-vars /
     e2e-caps pattern, posted from inside the frame.
- **Phase 3 — trust tiers.** Provenance → tier → grant. The `untrusted`
  tier proven to render a hostile fixture story with no escape.
- **Phase 4 — hardening + disclosure.** Bus-flood throttle, storage quota,
  a visible tier indicator (the user should SEE that an encountered story
  is running restricted), the service inventory telling the truth about
  what the running story may do.

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
- Not a cryptographic author-identity / signing scheme (a later tier
  refinement, noted not built).

---

**Next step after this doc:** Phase 2, the frame boundary. It is
security-critical infrastructure (CLAUDE.md: do not casually modify the
sandbox; test loading after every change). It will be built behind the
mandatory Hampstead journey and the breakout suite, not by eye.
