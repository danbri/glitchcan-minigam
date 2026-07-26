# The core, named — and where everything else stands

July 2026. danbri: *"This repo has all kinds of cruft. Focus on the fink
game, minigames and their drafts/sketches, and the office suite … wrapped up
behind 'foafos' and a finkcore finkgame kernel."*

So: the venture is **one platform with three kernels and the content that
runs on them**. Everything else in the repo is either a sibling project with
its own life, or a sketch kept on purpose. **Nothing was deleted** — the
owner's rule — but the line is now drawn in `packages/` rather than implied.

## The three kernels (`packages/`)

| package | role | was |
|---|---|---|
| **`finkcore`** | the story/data kernel — `.fink.js` sigil extraction (`oooOO`), the format itself, corpus tests | `packages/gcfink`, renamed; a `packages/gcfink` **symlink remains**, so every historical path, doc reference, and the untouchable comment in `fink-sandbox.js` still resolve |
| **`finkgame`** | the guest kernel — the classic-script SDK a minigame loads to live inside the host: lifecycle, variable mirror, controls/audio/snapshot contracts, key relay. New home of `minigame-sdk.js`; now has its own 9-check Node suite pinning the protocol shapes offline | `inklet/minigames/minigame-sdk.js` (moved, git history intact; the six guest pages point at the package) |
| **`foafos`** | the shell kernel — bus, session crypto, widgets, vars/audio/input/store/secrets/ops brokers, app tree, SigV4 | already a package |

The pattern was already proven: the shell imports `packages/foafos` directly
and that ships on Pages, so `packages/` is a served runtime location, not
just a build convention. `finkgame` rides the same rail.

Candidate fourth resident, deliberately deferred: `inklet/apps/app-sdk.js`
(the foafos guest kernel — storage shim, secrets, verbs). It belongs beside
these, but it is loaded by four edot pages across `magpie/`, so moving it
means re-running the 53-suite edot harness too. One kernel move per commit.

## The platform and its content (the focus)

- **`inklet/finkapp/`** — the host: ink engine, sandbox, navigation, window
  manager, minigame host, foafos shell wiring, 18-suite e2e + 2 QA harnesses.
- **`inklet/minigames/`** — the guests: chess, gems, gridluck, mudslider,
  battleboids (+ `debug-clock.js`, host-driven). Their SDK now lives in
  `packages/finkgame`.
- **`inklet/apps/`** — foafos apps (tv/Soundtrack, tally, universe, app-sdk).
- **`inklet/*.fink.js`** — the stories. `inklet/demos/`, `inklet/media/` —
  content and prototypes, part of the focus ("drafts/sketches" included).
- **`magpie/edot/`** — the office suite, running behind foafos (`?root=office`,
  fully sandboxed). Has its own 53-suite harness and `edot-suite` skill.
- **`magpie/robbin/`** — the flagship game + tape library (feeds the
  Soundtrack app). Content side of the `glitchcanary` skill.

Known-legacy inside the focus, kept and labelled rather than removed:
`inklet/app/` (the older 8-module player; `finkapp/` is canonical),
`inklet/inklet6.html` (118-byte redirect), `_tmp_shane-manor.fink.js`.

## Siblings, not cruft — but not the focus

Self-contained projects with their own docs/skills, untouched by platform
work: `lucid/` (four skills), `trees/` (skill; data-ethics rules),
`magpie/elliott4130`, `spectro/`, `palace/`, `mudslide/`, `thumbwar/`,
`hat/`, `plenia/`, `furbacca/`, `follyfx/`, `codepen-backups/`.

When one of these needs a decision that trades off against platform work,
the platform wins by default now — that is what "focus" changes.

## Verified

- `packages/finkcore` tests pass post-rename; the old `packages/gcfink` path
  still resolves through the symlink (checked by importing through it).
- `packages/finkgame` — 9/9 Node checks; `npm run fink:check` all clean.
- The six guest pages load the SDK from the package path — full e2e + QA run
  on this change (see the commit).
- The one real `gcfink` import in the tree (`fink-check.mjs`) is updated.
  Comment-only references in `fink-sandbox.js` were left alone deliberately:
  that file is security-critical and a stale-but-resolving path in a comment
  is cheaper than a casual edit.
