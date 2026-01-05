# Lucid Testing Strategy

**Last Updated:** 2026-01-04

## Test Tiers

Tests are organized into three tiers based on speed and scope:

### Tier 1 - Pre-commit (< 5 seconds)
**Trigger:** Automatically runs before every `git commit`
**Runner:** Vitest (no browser required)
**Command:** `npm run test:tier1` or `npm run test:core`

| Test File | Description | Tests |
|-----------|-------------|-------|
| `tests/lucid-core.test.js` | JSON loader, GLSL codegen | 36 |

**Purpose:** Catch regressions in core codegen logic immediately. Fast feedback loop.

### Tier 2 - Pre-push / Manual (< 30 seconds)
**Trigger:** Before push or manually
**Runner:** Playwright (headless browser)
**Command:** `npm run test:tier2` or `npm run test:lucid:unit`

| Test File | Description |
|-----------|-------------|
| `tests/dsl-parser.test.js` | DSL parsing integration |
| `tests/glsl-codegen.test.js` | Full GLSL generation |

**Purpose:** Verify browser integration and shader compilation.

### Tier 3 - CI / Scheduled (minutes)
**Trigger:** CI pipeline, nightly, or manual
**Runner:** Playwright (full E2E)
**Command:** `npm run test:tier3` or `npm run test:lucid`

| Test File | Description |
|-----------|-------------|
| `tests/lucid-sdf.spec.js` | Visual regression, scene loading |
| All Tier 2 tests | Included |

**Purpose:** Full end-to-end validation including visual checks.

---

## Git Hooks

### Pre-commit Hook
Located at `.git/hooks/pre-commit`

**Behavior:**
- Runs Tier 1 tests (Vitest unit tests)
- Blocks commit if tests fail
- Shows condensed output (last 10 lines)

**Skip hook:** `git commit --no-verify`

**Note:** Git hooks are not tracked in the repo. To install manually:
```bash
chmod +x .git/hooks/pre-commit
```

---

## npm Scripts Reference

| Script | Tier | Description |
|--------|------|-------------|
| `npm run test:core` | 1 | Fast Vitest unit tests |
| `npm run test:core:watch` | 1 | Watch mode for development |
| `npm run test:tier1` | 1 | Alias for test:core |
| `npm run test:tier2` | 2 | Playwright unit tests |
| `npm run test:tier3` | 3 | Full Lucid test suite |
| `npm run test:lucid` | 3 | Full Lucid tests (legacy alias) |
| `npm run test:precommit` | 1 | Pre-commit output format |

---

## Writing Tests

### For json-codegen.js changes:
Add tests to `tests/lucid-core.test.js`:
```javascript
it('should generate GLSL for myNewFeature', () => {
  const scene = {
    root: {
      type: 'myNewType',
      // ... scene structure
    }
  };
  const glsl = generateGlslFromJson(scene);
  expect(glsl).toContain('expectedOutput');
});
```

### For json-loader.js changes:
Add tests to the `loadJsonScene` describe block in `tests/lucid-core.test.js`.

### For visual/rendering changes:
Add tests to `tests/lucid-sdf.spec.js` (Playwright E2E).

---

## Test Coverage by Component

| Component | Test File | Coverage |
|-----------|-----------|----------|
| json-loader.js | lucid-core.test.js | Partial |
| json-codegen.js | lucid-core.test.js | Good |
| rig-evaluator.js | rig-evaluator.test.js | Good |
| index.html (UI) | lucid-sdf.spec.js | Basic |

---

## Known Test Issues

### Pre-existing Failures (5 tests)
These tests in `lucid-core.test.js` have stale expectations:
- `should load a box with transform` - expects raw arrays, gets structured objects
- `should resolve refs to defs` - ref resolution not returning expected type
- `should process Euler/quaternion/axis-angle rotation` - same structured object issue

**Status:** LCD-XXX (to be triaged)

---

## Continuous Testing Workflow

```
Developer makes changes
        │
        ▼
   git commit
        │
        ▼
┌───────────────────┐
│  Pre-commit Hook  │ ◄── Tier 1 (< 5s)
│  Vitest unit tests│
└───────────────────┘
        │ Pass?
        ▼
   Commit created
        │
        ▼
   git push
        │
        ▼
┌───────────────────┐
│   CI Pipeline     │ ◄── Tier 2+3 (< 2min)
│  Playwright tests │
└───────────────────┘
        │ Pass?
        ▼
   Push accepted
```
