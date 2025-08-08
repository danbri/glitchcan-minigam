# Repository Guidelines

## Project Structure & Module Organization
- Root: `index.html` links to experiments. Each minigame lives in its own folder (e.g., `thumbwar/`, `inklet/`, `tokitokipona/`).
- Inklet: Narrative content uses FINK (`*.fink.js`) — a JS-wrapped Ink format described in `glitchcanary.md`.
- Assets: Game-specific assets live beside their HTML/JS; shared media under `media/`, third-party under `vendor/`.
- Automation: GitHub Pages deploy in `.github/workflows/pages.yml`; optional LLM checks in `.github/workflows/llm-ci.yml`.
- Utilities: `thumbwar/update_index.py` regenerates the Thumbwar index; `tools/llm_check.py` is an optional local helper.

## Build, Test, and Development Commands
- Serve locally: `python3 -m http.server 8000` then open `http://localhost:8000/`.
- Thumbwar index: `python3 thumbwar/update_index.py` (refreshes `thumbwar/index.html` game list).
- Ink compile demo: open `inklet/hamfinkdemo.html` (uses `inkjs.Compiler()`; avoid regex “parsing” of Ink).
- Deploy: Push to `master` to trigger Pages build and deploy.

## Coding Style & Naming Conventions
- HTML/CSS/JS: 2-space indentation; modern JS (`const`/`let`, arrow functions); browser-only, no bundlers.
- Filenames: Kebab-case for HTML/JS (`gridluck-game.js`, `thumbwar.html`). Narrative files: `*.fink.js` in `inklet/`.
- FINK tags: Prefer Ink tags for metadata (e.g., `# IMAGE:`, `# BASEHREF:`). Keep remote content CORS-friendly.
- Lint/format: No enforced linters; follow local style and keep lines readable.

## Testing Guidelines
- Manual smoke test on desktop and a touch device; check input, media, and navigation.
- Cross-page links: Verify `index.html` plus section indexes still work.
- Inklet: Ensure choices and conditionals render correctly in `hamfinkdemo.html` or `gamgam*.html`.
- Thumbwar: After adding a new `*.html`, run the index updater.

## Commit & Pull Request Guidelines
- Commits: Concise, present-tense summaries (e.g., "add inklet TOC link"). Group related edits.
- PRs: Explain the change, link issues, and include short screenshots or clips for UI changes.
- Scope: One feature/fix per PR when possible; call out follow-ups.

## Content & Safety Notes
- Tone: See `glitchcanary.md` for project ethos. Avoid reserved names/topics for the core arc.
- AI usage: Optional. Do not commit secrets or private model files. Large-model CI steps are optional.
