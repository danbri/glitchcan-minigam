# Audit 01 — FINK / Inklet Interactive Fiction System

The largest and best-documented endeavour in the repo: a custom interactive-fiction
format ("FINK" = INK wrapped in `oooOO` tagged template literals in `.fink.js` files),
loaded via a sandboxed iframe and compiled with the real ink-full.js compiler.

## 1. The production player: docs point at the wrong place

| Documented (CLAUDE.md) | Reality |
|---|---|
| `inklet/inklet5.html` — "Modular FINK Player (PRODUCTION)" | **Does not exist.** |
| GitHub Pages URL `…/inklet/inklet5.html` | Dead reference. |
| `inklet/toc-simple.fink.js` — "Working table of contents" | Does not exist (only `inklet/toc.fink.js`, 296 lines). |
| `inklet/hampstead1.fink.js` — "Full adventure tested" | Does not exist (only `inklet/hampstead.fink.js`, 627 lines). |
| 6 modular JS components | `finkapp/` has **15+ modules**, `app/` has 8. |
| — (not mentioned) | **`inklet/finkapp/index.html` is the actual production player.** |

`inklet/inklet6.html` exists but is a 118-byte redirect to `/glitchcan-minigam/inklet/app/`.
`INK_INTEGRATION_STATUS.md` claims inklet6 is production; CLAUDE.md claims inklet5;
neither matches the deployed reality (finkapp). The January 2026 review campaign in
`worknotes/` consistently tested `finkapp/`, confirming it as the live system.

## 2. Two parallel implementations (spinoff/duplication)

**`inklet/app/`** (older, ~1,873 lines): `fink-config.js`, `fink-utils.js`,
`fink-sandbox.js`, `fink-breadcrumb.js`, `fink-ink-engine.js`, `fink-player.js`,
`fink-ui.js`, plus `obsolete.html`.

**`inklet/finkapp/`** (current, ~8,342 lines): same seven modules (all larger — engine
+74%, breadcrumb +106%) **plus** `fink-audio.js`, `fink-devpanel.js`,
`fink-minigames.js` (1,391 lines), `fink-navigation.js` (1,186 lines), `fink-foley.js`
(procedural audio, 478 lines), `fink-slider.js`, and embedded minigames
(`chess.minigam.js`, `gems.minigam.js`); 5 CSS files.

Every change risks needing to be mirrored; no doc states which tree is canonical.
`worknotes/gamedev-review.md` flags this duplication explicitly.

## 3. Core engine principles: correctly implemented

The two CLAUDE.md "critical rules" hold up:

- **No hackparsing** — both implementations use the real ink-full.js Compiler/Story
  APIs (`third_party/ink/ink-full.js`, 241 KB, version unpinned/undocumented).
- **Sandbox loading** — `.fink.js` files execute via script injection into an isolated
  iframe; the `oooOO` tagged-template function captures content and returns it via
  postMessage. No regex parsing of INK anywhere in the active pipeline.
- The layered media path resolution described in CLAUDE.md (global base → story
  BASEHREF → file-relative fallback) is implemented in FinkUtils. ~~Step 5 (INK
  runtime error handler) was never done~~ **Corrected by falsification pass**: an
  `story.onError` handler IS wired in `finkapp/fink-ink-engine.js`; CLAUDE.md's TODO
  is stale in the other direction.

*Nuance from falsification pass:* "no regex parsing of INK anywhere" was too strong —
BASEHREF **tag extraction** uses regex fallbacks in `fink-ui.js`, `fink-navigation.js`
and `fink-ink-engine.js` (the documented CLAUDE.md "Fix 4" fallback). The accurate
claim: no regex parsing of INK *story structure*; story compilation is real ink-full.js.

## 4. Story files: 14 on disk + satellites

| File | Lines/size | In TOC? | Status |
|---|---|---|---|
| `toc.fink.js` | 296 | is the TOC | Working |
| `hampstead.fink.js` | 627 | Episodes | Working; full playthrough verified (worknotes) |
| `bagend.fink.js` | 285 | Episodes | Working per CLAUDE.md status table |
| `mudslidemines.fink.js` | 117 | Episodes | Minimal; working |
| `riverbend.fink.js` | 548 | Episodes | Unverified |
| `shane-manor.fink.js` | 1,141 | Help menu | **Compiles; gameplay never tested** (`shane_todo.md`) |
| `_tmp_shane-manor.fink.js` | 1,127 | Help menu ("ENRICHED") | WIP temp file committed |
| `tml-2025-langlearn.fink.js` (Ukrainian) | 265 | Minigames | **Known runtime error, open** |
| `world-between-worlds.fink.js` | 155 | Dev-guide hub | Working (connections-review verified) |
| `demos/diamond-cave.fink.js` | 10 KB | Episodes | Working per playability review |
| `demos/hamfink2026-ch2.fink.js`, `-ch3.fink.js` | 11/24 KB | not in TOC | Demo content |
| `demos/radio-foundation-quiz.fink.js` | 29 KB | Experiments | References external host |
| `validation/tests/test-variables.fink.js` | 60 | test only | Valid INK |
| `cozyverse/maple-hollow.fink.js` | 11 KB | Episodes | **404s at runtime** (fun-review.md) |

**Phantom files referenced in docs:** `bagend1.fink.js`, `hampstead1.fink.js`,
`jungle2.fink.js` (glitchcanary.md), `toc-simple.fink.js` (CLAUDE.md). None exist.
CLAUDE.md's "3 Broken Files" list (bagend1, test-variables, toc) is stale:
test-variables and toc exist and are valid; bagend1 never existed under that name.

## 5. Validation tooling: Phase 1 done, Phase 2 vapour

**Exists and works** (`inklet/validation/`): `checkfink.mjs` (unified .ink/.json/.fink.js
validator, Puppeteer-based, `--scan`, CI exit codes), `validate-fink-puppeteer.mjs`,
`validate-fink.html`, `unreachable_knots_tester.html`, debug tools
(`debug-ink-escape.mjs`, `debug-ink-tags*.mjs`), CLI player (`play-fink-cli.mjs`).
Root-level harnesses: `finkapp-playtest.mjs`, `finkapp-fraud-test.mjs`,
`playtest-log.json`.

**Promised but absent** (CLAUDE.md "Phase 2: IN PROGRESS"):
- `fink-audit/` dashboard folder (index.html, detailed.html, assets, data) — nothing
- `checkfink.mjs --report` rich-metrics flag — not implemented
- GitHub Action for daily audit/dashboard generation — none (only `llm-ci.yml`, which
  is a CodeQwen review bot, not the audit pipeline)
- Dashboard link from main site, README explanation — none

## 6. Known-open issues (documented, unfixed)

- Ukrainian story + Help menu runtime errors (CLAUDE.md TODO since ~June 2025)
- Maple Hollow resource 404 (fun-review.md, Jan 2026)
- FINK URL truncation bug: `https://` → `https:` because INK treats `//` as a comment
  even inside tags (`finkurls.md`; three solutions proposed, none implemented)
- ~~`inklet/media/shane/` is 73 MB of unoptimized PNGs; the optimization plan was
  never executed~~ **Corrected**: optimized JPGs DO exist in
  `inklet/media/shane/{mobile,tablet,desktop}/`. Whether the story tags reference
  them (vs the large originals) remains unverified.
- 12 UX issues from `usability-review.md` (breadcrumb visibility, loading progress,
  no CSP, `user-scalable=no`, missing ARIA) — no follow-up visible

## 7. Legacy/experimental accumulation

`finktest1–4.html`, `finknet-test.html`, `gamgam.html` (81 KB) and `gamgam-wc.html`
(139 KB, dual-engine web-component prototype), `blanked-playtest.mjs`,
`demos/hamfinkdemo.html` (the canonical reference implementation), `demos/hhg-test.html`,
`demos/thinkle.html`, `inklet/minigames/` (battleboids, mudslider, gems, gridluck,
chess variants). These chart the development history but blur which code is live.

## 8. Dependencies

- `third_party/ink/ink-full.js` (vendored, version not recorded anywhere)
- `inkjs` ^2.3.2 and `puppeteer-core` ^24.35.0 in root package.json (validation)
- iframe sandbox + postMessage (browser built-ins)
- GitHub Pages static hosting (no server-side anything)

## 9. Verdict

The engine-level claims are genuine: real compiler, real sandbox, no hackparsing. The
system outgrew its documentation — finkapp is a far richer product than any doc admits —
while the audit/dashboard plan and several content fixes were documented in detail and
then never started.
