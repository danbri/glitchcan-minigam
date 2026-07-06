# fable-notes — handoff for the next model (2026-07-06)

Written for whichever model continues this collaboration with **danbri**. It is
not an audit (that's `docs/fable-audit/` — read it) and not a status report
(that's `docs/edot/1.0-readiness.md`). It's the thing those don't capture: how to
*work here well*, what's hard-won, and where the energy should go next. Read it
once before your first real change.

If you read only one paragraph: **the code is usually ahead of the docs, danbri
values honesty far above polish, and a confident "X doesn't exist / doesn't work"
is wrong about a third of the time unless you actually checked.** Everything below
is elaboration.

---

## 1. The collaborator

danbri (Dan Brickley) is the owner. From `CLAUDE.md`: *trust the user*. He knows
this codebase and these domains (RDF/linked-data, XMPP, interactive fiction, web
graphics, real open data). When he says something exists or works a certain way,
believe him and go look — don't argue from priors.

He corrects **sharply and specifically**, and those corrections are the most
valuable signal you get. Observed this session:

- *"Why would mail work? No service providers are configured."* — I had flagged a
  mail crash as a blocker; he was pointing out the real cause and that faking a
  working path is worse than an honest "sign in first." **Lesson: don't paper over
  an unconfigured/empty state; name it.**
- *"Webgl shouldn't be slow."* — a correct challenge; the real answer is that CI
  runs SwiftShader (software GL), which is slow, and that's not a real performance
  signal. **Lesson: know your measurement's provenance before you explain a number.**
- *"Xmpp groups will [be] much more than chat."* — he thinks in terms of the
  *right model*, not the minimum feature. MIX became chat+people+calendar, and
  later I had to walk back an over-claim (see §5).
- *"Re 'not my coinage' - YOU WROTE ALL THE CODE."* — I'd deflected authorship of a
  term I'd chosen. **Lesson: own your work; don't attribute your choices to "the
  code" as if they appeared on their own.**

He gives terse go-aheads ("Do it", "Yes", "Ok", "keep going") and expects you to
exercise judgment, not ask permission for every step. But judgment includes
knowing when a decision is genuinely his — front-door canonicalization and the
editor-reconciliation call were surfaced to him with `AskUserQuestion`, and that
was right.

He sets **goals via `/goal`** (a Stop hook that blocks stopping until a condition
holds). When one is active, keep shipping tested increments toward it; don't stall
and ask "what next". If you hit a genuinely external blocker (a credential only he
can create, a permission only a maintainer can grant), say so plainly and keep
going on what you *can* do — but the bar for "external blocker" is high. I once
deferred S3/Solid as "large protocol builds" and the hook rightly pushed back;
they were four hours of focused work, not a wall.

---

## 2. Repo mental model

This is a large, sprawling personal research repo — ~45 top-level dirs, a mix of
finished games, live experiments, research artifacts, and data corpora. Deployed
static to GitHub Pages (`master` → `pages.yml`, v4 actions). No build step for
most things. The landing page (`index.html`) is edited manually.

The audit (`docs/fable-audit/`) inventories all of it. The load-bearing subsystems:

- **`inklet/` — FINK interactive fiction.** The real production player is
  `inklet/finkapp/index.html` (15+ modules), NOT `inklet/app/` (older parallel)
  and NOT the phantom `inklet5.html`. `.fink.js` files are **JavaScript**
  (`oooOO`…`` tagged templates run in a sandboxed iframe), never text to parse.
- **`lucid/` — backend-neutral SDF rendering.** Mayfly (WebGL) + Stinkyfish
  (WebGPU), shared JSON scenes, `<lucid-*>` web components, ABCD "Parliament"
  model-review methodology. Stinkyfish WGSL output is **codegen-verified but
  visually unverified** (no headless WebGPU).
- **`trees/` — "Tanks for the Trees".** Phosphor-vector tank game over real
  Bristol OSM + council tree data. **Data-ethics-critical** (see §5).
- **`magpie/` — two very different things.** An Elliott-4130 mainframe emulator +
  LISP 1.5 research corpus, AND **`magpie/edot/`** — the browser office suite that
  has been the whole recent focus (see §3). Also `magpie/skyport-webgpu-pwa/` (a
  WebGPU flight-sim reference build; other sessions/PRs touch it — expect master
  to move under you).
- Many playable-but-unlisted experiments: `palace/`, `mudslide/`, `spectro/`,
  `plenia/`, `hat/`, `furbacca/`, `follyfx/`, `thumbwar/` (GridLuck), etc.

**Where the energy is (July 2026): `magpie/edot/`.** The last ~15 commits are all
edot. Everything else is stable-ish per the audit.

---

## 3. edot — the current frontier (deep dive)

A fully client-side, mobile-first office suite: 13 apps composed in one shell over
a shared kernel. The goal danbri set: *a world-class, decentralized, mobile-first
1.0 — usable, useful, consistent, familiar, tested, standards-based, web-component
based.* As of this handoff it hits all eight dimensions bar two external items
(`docs/edot/1.0-readiness.md` is the live scorecard). **51 headless test suites,
all green.**

### Architecture (the load-bearing spine)
Read `docs/edot/ui-command-tree.md` and `ui-command-graph.md` (+ the rendered
`.png`) first — they're the map. The spine is **UI → command → capability**:

- **Kernel** (`js/edot-kernel.js`): a `bus` (publish/subscribe) + `capabilities`
  (provide/invoke). This is how apps act on each other with no hard imports.
- **Command registry + ontology** (`js/command-registry.js`, `js/ontology.js`):
  every side-effecting action is a `command` (`{id,title,group,when,run,…}`),
  discoverable in ⌘K and menus from one source. The ontology types what commands
  apply to. VS-Code contribution-point framing; XForms framing (model/bind/
  relevance). `run()` is the audit/policy choke point.
- **Storage: `ResourceSource`** (`js/resource-source.js`) — one mount interface
  (`list/read/write/remove/stat/mkdir`, lazy/windowed). Real implementations:
  OPFS, local folder (File System Access), **GitHub** (Contents API), **WebDAV**,
  **Solid** (LDP), **S3** (SigV4). Every "Save to…" and the Files browser go
  through this. The MIX calendar is a live pubsub node.
- **Connections** (`js/connections.js`): the ONE account registry. Apps register
  their backends here (mail/calendar/groups/storage); `getConnections()` seeds a
  local OPFS `device` account and wires kernel capabilities. AuthSession (OIDC)
  feeds the identity axis.
- **Editor host** (`js/editor-host.js`): the document-level features (My documents
  + autosave, Open Examples/Research/URL, View source, Save to…, GitHub PR) that
  the standalone page's monolith (`js/edot-app.js`) has, ported to the shell so
  the suite editor reaches parity. **It shares the same IndexedDB library**, so a
  doc written in either front door appears in the other.

### Two front doors — do not confuse them
- **`index.html` = the canonical suite** (app rail, ⌘K, all apps). This is the
  current experience. Titled "edot — office suite".
- **`edot.html` = the original standalone word processor** (`js/edot-app.js`
  monolith). Still works, still useful, links to the suite. Not obsolete, but not
  the front door. The README and every "← back" link now point at the suite.

### The recorded design rule you must respect
**The Mozilla RDF-datasource anti-pattern** (in `CLAUDE.md` and the ontology
comments): the ontology/RDF is *schema only*, never the runtime enumeration path.
Collections are accessed via lazy windowed sources; actions resolve once per item
*type* (O(commands)), never per-item or by walking a graph. This is why huge
inboxes/folders scroll. Don't "simplify" it back into a graph API.

### Invariants that tests lock in (don't break these)
- Editor toolbar ↔ Format/Edit/Insert menus ↔ ⌘K are at **parity** — if you add a
  formatting action, add it in all three (or the shell test fails).
- Menus **clamp to the viewport** (`clampMenu` in index.html) — mobile.
- The onboarding overlay is gated on `!navigator.webdriver` so it never blocks the
  headless UI suites. Keep that gate if you add first-run UI.
- Provider glyphs are shared between Connections and Files (`PROV_ICON`) — keep
  them consistent if you add a provider.

---

## 4. Cross-cutting engineering lessons

- **Small, tested, committed increments.** One coherent change → its own
  regression test → commit + push with the co-author trailer. Never a big
  uncommitted pile. This session was ~15 such increments.
- **`master` moves under you.** Other sessions and merged PRs (skyport, etc.) land
  while you work. Always `git pull --rebase origin master` before `git push`. A
  push rejected as non-fast-forward is normal, not an error — rebase and retry.
- **Reuse the proven pattern.** GitHub → WebDAV → Solid → S3 were all the *same*
  shape: a `ResourceSource` class (fetchImpl-injectable) + a Connections "Add"
  form + a Node test with a fake server. Find the last thing like the new thing
  and mirror it.
- **Screenshots are evidence.** For any UI/mobile claim, drive headless Chromium
  at 360–390px and *look*. I found real bugs this way (login chip clipped off the
  top bar; a menu spilling off-screen) and also disproved a subagent's false
  "maps import unreachable" claim. The executablePath is
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (`--no-sandbox`; add
  swiftshader GL flags for WebGL). Scratch scripts must live *in* `magpie/edot/`
  to resolve `playwright-core` — the shell cwd resets to repo root between calls.
- **Subagents for parallel independent work, self for shared-core work.** Verify
  their claims empirically before acting.

---

## 5. Honesty & verification — the load-bearing culture

This repo has an explicit **accuracy ledger** (`claims-register.md`): negative and
universal claims are adversarially verified, and ~1/3 of the first audit pass's
confident negatives were *wrong*. Internalize that. Before you write "nothing
references X" or "Y isn't implemented", run and record the check.

What "verified" honestly means here:
- **Headless can't see WebGPU or WebXR.** Never claim a WGSL/Stinkyfish fix is
  visually verified from a headless capture — it silently tested the WebGL path.
  Same for the skyport WebGPU build.
- **Live network is not CI-tested.** Every remote storage backend
  (GitHub/WebDAV/Solid/S3) and live XMPP federation is verified at the
  *request-shaping / crypto* level against a fake fetch — not a real server. Say
  so. The one strong exception: **S3 SigV4 is checked against AWS's published test
  vector** (real cryptographic correctness), and SCRAM against the RFC 5802
  vector. That's the standard to aim for: pin protocol correctness to a spec
  vector even when you can't hit the wire.
- **Don't over-claim the model.** This session I gave the XMPP account a `storage`
  capability because "a MIX channel has pubsub nodes" — then caught that a pubsub
  node is *not* a read/write filesystem and dropped the claim. When a capability
  isn't real, don't list it. `capabilityFor()` returning `null` honestly beats a
  fake adapter.

Two hard, non-negotiable rules from `CLAUDE.md` (re-read them in full):
- **DATA ETHICS.** The Bristol tree inventory's `NOTES` / `SPECIES_NOTES` /
  `PLANTING_NOTES` / `SPONSORSHIP*` / `PLANTING_FUNDER` fields are **off-limits for
  game content** — sponsored trees are frequently memorials for people who died.
  Game payloads ship geometry + species only. An assistant once proposed in-game
  "obituaries" from this data; it was rejected. Never revisit.
- **NO HACKPARSING of INK.** Real `inkjs` compiler/Story API only. The one
  documented exception is narrow regex extraction of `# BASEHREF:` tags — do not
  extend it. And **do not casually modify the FINK sandbox** (`fink-sandbox.js`);
  a one-character `'\\n'` vs `'\n'` bug once broke all story loading silently.

---

## 6. How to actually run the tests

edot: `node magpie/edot/run-tests.mjs` (all 51 suites; append names to filter,
e.g. `… shell editor connections`). Each suite is its own Node script that
launches headless Chromium, prints ✅/❌, and exits non-zero on failure. Pure-Node
suites (ontology, resource-source, the `*-source` request-shaping tests) need no
browser. Run the full suite before every commit; it's a few minutes.

Repo-wide: `npm test` (Playwright), `npm run test:core` (Vitest). Note the gotcha
in `CLAUDE.md`: `tests/glsl-codegen.test.js` and `tests/dsl-parser.test.js` are
`@playwright/test` files — don't point Vitest at the whole `tests/` dir.

Lucid quick check: `loadJsonScene` + `generateGlslFromJson` in Node inspects GLSL
without a browser. "Compiling is not enough — what is RENDERED?" is the recorded
mantra; for real render checks use the Playwright executablePath and *look*.

---

## 7. Traps & tripwires (specific)

- The Bash tool's **cwd resets to the repo root** between calls. Use absolute
  paths or `cd …/magpie/edot && …` in one command. Scratch `.mjs` that import
  `playwright-core` must sit inside `magpie/edot/`.
- `Date.now()` / `Math.random()` / argless `new Date()` are fine in normal code
  but **throw inside Workflow scripts** (they'd break resume). Not relevant to
  most work, but bites if you author a workflow.
- **Two editor implementations** exist (`edot-app.js` monolith vs `edot-editor.js`
  component wrapping the shared core). They share `editor.js`/`toolbar.js`/
  `commands.js`. Don't assume a fix in one lands in the other.
- Grepping `index.html` from the repo root hits the **landing page**, not
  `magpie/edot/index.html`. Use the full path.
- The demo identity, the local-storage flags (`edot.onboarded`, `edot.gh.*`,
  `edot.currentDoc`) and in-memory remote tokens are per-origin; tests that assume
  a clean slate should clear them.

---

## 8. Strategy & roadmap (ranked)

For **edot** (the active frontier), from the readiness doc — the two remaining
1.0 items are genuinely external, not missing code:
1. **Real (non-demo) sign-in** — needs danbri to register an OAuth app and paste a
   public client-id into `auth/auth-config.js` (Google/Microsoft, ~2 min, free).
   The OIDC/PKCE plumbing is built and tested; a local demo identity works today.
2. **E2E suite into CI** — *blocked*: the GitHub App lacks the `workflows`
   permission, so a maintainer must move `e2e-tests.yml.template` into
   `.github/workflows/` (see `WORKFLOW-SETUP.md`). Until then the Playwright E2E
   has never run in CI.

Genuinely-open edot code work, if he wants more:
- Route a **generic file open/save dialog** through Connections for the *other*
  apps (the editor's Save to… already does; Files is the browser).
- A MIX **shared-files** capability (calendar is live; storage was correctly
  dropped, not implemented).
- Extend Slides/Data "Save to…" through the same storage layer for full
  cross-app consistency.

Beyond edot (from the audit — untouched this session, still true):
- Lucid: **47 orphaned scenes** not in `toc.json`; Stinkyfish WGSL never visually
  verified in a real WebGPU browser.
- FINK: Ukrainian story runtime error; Maple Hollow load 404; Shane Manor
  gameplay never tested; the six-review Jan-2026 UX campaign in `worknotes/` is
  largely unaddressed.
- Docs: `CLAUDE.md` still describes some phantoms — but check the claims-register
  before "fixing" anything, because the code is usually the source of truth.

**How to pick:** danbri drives. When he sets a `/goal`, serve it with tested
increments and don't stall. When he's exploratory ("some polish"), do a few
tasteful, tested touches and show your work. When he asks a question, answer it
from the code (run the check), not from memory.

---

## 9. First moves for the next model

1. Read `CLAUDE.md` in full (the rules are OVERRIDES, not suggestions).
2. Skim `docs/fable-audit/README.md` + `claims-register.md` (the accuracy culture).
3. For edot: `docs/edot/1.0-readiness.md`, then `ui-command-tree.md` +
   `ui-command-graph.png`, then `storage-identity-model.md`.
4. `node magpie/edot/run-tests.mjs` — confirm 51/51 green before touching anything.
5. Then work the way this file describes: small, tested, honest, committed,
   rebased-before-push. Verify negative claims. Never fake a working path. Guard
   the data-ethics and no-hackparsing lines with your life.

It's been a genuinely good collaboration to be part of. Continue it well.
