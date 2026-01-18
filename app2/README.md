# App2 - Frozen Exploration

**Status:** Frozen - Do Not Actively Develop

This folder contains exploratory code from earlier development phases.

## Purpose
- Archive of experimental approaches
- May contain reusable code snippets
- Reference for architectural decisions

## Warning
Do not add new features here. Check `/inklet/finkapp/` for active development.

---

## Historical Notes

This folder contains two packages:

- gcfink: Core FINK/INK utilities (extraction, engine glue, utils) with basic tests.
- gcui: Glitchcanary UI package skeleton (no implementation here).

### Running tests (if needed for reference)
- Node-only tests (no browser): `node gcfink/test/run.js`
- Headless browser (optional):
  1. `npm i -D playwright`
  2. `node gcfink/test/headless/run-playwright.js`
