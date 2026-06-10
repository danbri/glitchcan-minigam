# Audit 04 — Infrastructure, CI/CD, and Testing

Infra is the healthiest layer of the repo: modern workflows, a real test suite, and
honest assessment docs. The notable gaps are one undeployed workflow and a stack of
design docs that never became code.

## 1. GitHub workflows (`.github/workflows/`)

| Workflow | Status | Notes |
|---|---|---|
| `pages.yml` | ✅ Active | GitHub Pages deploy on push to master; checkout@v4, configure-pages@v4, upload-pages-artifact@v3, deploy-pages@v4 — matches CLAUDE.md's "modern action versions" requirement exactly. Runs `thumbwar/update_index.py` before deploy. |
| `lucid-tests.yml` | ✅ Active | Tiered: Tier 1 Vitest unit tests → Tier 2 Playwright integration → PR quality gate. The one place where a documented testing plan (lucid/TESTING-STRATEGY.md) became real CI. |
| `llm-ci.yml` | ✅ Active | Heavy: builds llama.cpp, downloads CodeQwen 1.5 7B, reviews `**/*.fink.js` changes + autoexec bot. 30-min timeout, model caching. This is NOT the planned fink-audit pipeline. |
| `claude.yml` | ✅ Active | @claude mention handler (claude-code-action@beta), scoped permissions. |
| `claude-code-review.yml` | ✅ Active | Automated review triggers. |
| `pr-preview.yml.disabled` | ✅ Intentionally disabled | Preserved exactly as CLAUDE.md documents; rossjrw/pr-preview-action@v1; restricted to OWNER/MEMBER/COLLABORATOR. |
| **fink-audit action** | ❌ Missing | Planned in CLAUDE.md (daily schedule, dashboard generation); never created. |

## 2. The undeployed E2E workflow

`e2e-tests.yml.template` sits at repo root — a complete, modern (checkout@v4,
setup-node@v4/Node 20, upload-artifact@v4, github-script@v7) E2E workflow with
artifact upload and optional multi-OS matrix. It was left as a template because GitHub
Apps can't create workflow files without the `workflows` permission;
`WORKFLOW-SETUP.md` documents three installation options. **Net effect: the 150+
assertion test suite has never run in CI.** Activating it is a one-move fix.

## 3. Test suite (`tests/`, 13 files)

- Playwright specs: `fink-player.spec.js` (70+ assertions), `gridluck.spec.js` (50+),
  `minigames-smoke.spec.js` (30+ across 9 games), `lucid-sdf.spec.js`
- Vitest/unit: `lucid-core`, `dsl-parser`, `glsl-codegen`, `xpbd-physics`,
  `splat-physics`, `splat-demo-physics`, `sdf-physics-scene`, `webgpu-availability`
- `playwright.config.js` (125 lines): 4 device projects (desktop Chrome, Pixel 5,
  iPhone 12, iPad Pro), auto-started Python HTTP server on :8080, screenshots/video on
  failure, custom executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, CI retries
- `package.json`: 14+ test scripts (`test:fink`, `test:gridluck`, `test:smoke`,
  `test:tier1-3`, `test:precommit`, …); devDeps `@playwright/test` ^1.56.1,
  `playwright` ^1.57.0, `puppeteer-core` ^24.35.0, `inkjs` ^2.3.2

**Environment blocker, well documented:** in restricted sandboxes the Playwright CDN
returns 403, so browsers can't be installed locally. `ENVIRONMENT-ASSESSMENT.md` and
`CUSTOM-BINARY-ASSESSMENT.md` analyze this honestly; `setup-chrome.sh` (wired in as
`pretest`) is ready to pull a Chromium tarball from a GitHub Release — **but that
release/binary was never published**, so the workaround is also pending.

## 4. Root governance/assessment docs — implemented or not?

| Doc | Size | Verdict |
|---|---|---|
| `TESTING.md`, `POST-MERGE-TESTING.md`, `WORKFLOW-SETUP.md` | 12K/8.8K/3.1K | Accurate; match the implemented test framework. |
| `ENVIRONMENT-ASSESSMENT.md`, `CUSTOM-BINARY-ASSESSMENT.md` | 7.2K/6.4K | Accurate environment analyses; custom-binary path feasible but unexecuted. |
| `PEER_ARCHITECTURE_DESIGN.md` | 27K | **Design only.** Proposes service layer (Auth/Storage/Network/EventBus), peer components, multi-agent collaborative editing. A repo-wide grep finds no peer/socket/WebRTC code — the only "peers" are the House of Peers in palace's narrative. |
| `AGENTS.md`, `PR_DESCRIPTION.md`, `README.md` | small | Process/guideline docs; fine. |
| `MENU_RESCUE_ANALYSIS.md`, `INK_INTEGRATION_STATUS.md` | 6K/15K | FINK analyses (see Audit 01); INK_INTEGRATION_STATUS contradicts CLAUDE.md on which player is production. |

## 5. Landing page (`index.html`)

Static-only assumptions all hold (no SSR, relative links, favicons present). The duck
🐥 effects CLAUDE.md describes are implemented exactly: 2.5 s heartbeat keyframes and
a 10 s random-glitch animation with chromatic-aberration text shadows.

## 6. Repo hygiene & size

- **626 MB working tree, 504 MB .git.** Hotspots: `media/` 277 MB,
  `inklet/` 122 MB (of which `inklet/media/shane/` is 73 MB of unoptimized PNGs —
  a documented, unexecuted optimization plan), `magpie/` 61 MB, `twinearth/` 54 MB
  textures, `trees/` 29 MB, `lucid/` 25 MB (automodel captures accumulate by policy —
  "never delete captures").
- `.gitignore` is sound (node_modules, IDE, test artifacts, .env, OS junk); nothing
  improper tracked. Large media is tracked deliberately, not accidentally — but with
  no Git LFS, clone cost will keep growing.
- `tools/` = one file (`llm_check.py`, companion to llm-ci). `third_party/` = vendored
  ink (clean, but version unrecorded).

## 7. Summary

| Plan | Where documented | Outcome |
|---|---|---|
| Pages deploy, modern actions | CLAUDE.md | ✅ Done |
| PR previews disabled-but-preserved | CLAUDE.md | ✅ Done |
| Tiered Lucid CI | lucid/TESTING-STRATEGY.md | ✅ Done |
| E2E workflow | WORKFLOW-SETUP.md | ⚠️ Template only; never activated |
| Hosted Chromium binary for sandboxes | CUSTOM-BINARY-ASSESSMENT.md | ⚠️ Script ready; release never published |
| fink-audit dashboard action | CLAUDE.md | ❌ Never started |
| Peer architecture | PEER_ARCHITECTURE_DESIGN.md | ❌ Design only |
