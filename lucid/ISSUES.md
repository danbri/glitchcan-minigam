# Lucid SDF-CSG Issue Tracker

**Last Updated:** 2026-01-04
**Version:** v0.7.x

---

## Issue ID Format
`LCD-XXX` where XXX is a 3-digit number

---

## Priority Legend
- **P0**: Critical - Broken core functionality, blocks usage
- **P1**: High - Significant bugs affecting user experience
- **P2**: Medium - Noticeable issues, workarounds exist
- **P3**: Low - Minor polish, nice-to-have improvements

---

## P0 - Critical Issues

### LCD-001: smoothIntersect operator not implemented [FIXED]
**Status:** Fixed (2026-01-04)
**Component:** core/json-codegen.js
**Description:** The `smoothIntersect` CSG operator was documented in README.html as TODO but not implemented in the codegen.

**Fix Applied:**
- Added `generateSmoothIntersect()` function using smooth maximum formula
- Formula: `h = clamp(0.5 - 0.5*(b-a)/k, 0, 1); d = mix(b,a,h) + k*h*(1-h)`
- Created test scene: `scenes/csg/smooth-intersect.json`
- Updated README.html to reflect implementation

---

### LCD-002: Parameter overrides in refs not implemented [FIXED]
**Status:** Fixed (2026-01-04)
**Component:** core/json-codegen.js
**Description:** Refs now support parameter overrides via `params` field. The loader stores overrides, and the codegen applies them when generating GLSL.

**Fix Applied:**
- Added `applyParamOverrides()` function to json-codegen.js
- Updated `generateRef()` to apply overrides before expanding definition
- Demo scene: `scenes/csg/ref-overrides.json`

**Usage:**
```json
{ "type": "ref", "id": "baseSphere", "params": { "r": 0.5, "color": [1, 0, 0] } }
```

---

### LCD-003: Mirror CSG bug - subtract cutters don't rotate with mirror
**Status:** Open
**Component:** core/json-codegen.js
**Description:** When using `mirror` with `subtract` operations, the cutter geometry doesn't rotate with the mirror axis. Noted in index-embedded.html as "REVEALS MIRROR BUG".

**Steps to Reproduce:**
1. Load cobra-mk3 scene
2. Observe asymmetric cutouts despite mirror operation

**Impact:** Complex mirrored CSG operations produce incorrect geometry.

---

## P1 - High Priority Issues

### LCD-004: Scenes missing parametric controls
**Status:** In Progress
**Component:** lucid/scenes/
**Description:** Many scenes still lack `params` definitions for interactive control. Priority scenes include:
- `dragon-imported.json`
- `test-a/b/c.json`
- `ablation/whale*.json` variants
- Many `creatures/subag1/` experimental models

**Impact:** Users cannot interactively adjust these scenes via the Params panel.

---

### LCD-005: Wiggler mode needs UX improvements
**Status:** Partially Fixed
**Component:** lucid/index.html
**Description:**
- [x] Wiggler icon was cluttered - simplified to `〰️` button
- [x] Made wiggler sticky across scene switches
- [ ] Speed indicator could be clearer (currently shows ⚡ for fast mode)
- [ ] No way to pause wiggler without stopping it

**Impact:** Param animation feature is usable but could be more intuitive.

---

### LCD-006: invaderScale param was not working
**Status:** Fixed (2026-01-04)
**Component:** core/json-codegen.js
**Description:** Variable references like `{"var": "invaderScale"}` in scale transforms weren't handled by `generateScaledNode`. Fixed by adding object handling in the scale branch.

**Fix Applied:**
```javascript
else if (typeof scale === 'object' && scale !== null) {
  const s = valueToGlsl(scale, ctx);
  scaleVec = [s, s, s];
}
```

---

### LCD-007: Version bump easily forgotten
**Status:** Open
**Component:** lucid/index.html (line ~909)
**Description:** Comment at top of file notes "VERSION BUMP REQUIRED: Update VERSION constant with every commit!" but this is manual and easily forgotten.

**Proposed Fix:** Add pre-commit hook or build script to auto-increment version.

---

### LCD-008: No scene validation on load
**Status:** Open
**Component:** core/json-loader.js
**Description:** Malformed scene JSON can cause cryptic errors. No validation for:
- Required fields (title, root)
- Valid node types
- Correct param structure
- Circular ref dependencies

**Impact:** Debug experience is poor when scenes have errors.

---

## P2 - Medium Priority Issues

### LCD-009: Mobile touch handling in param sliders
**Status:** Open
**Component:** lucid/index.html (setupParamsPanel)
**Description:** While touch events are handled on sliders, there are edge cases:
- Touch drag sometimes scrolls page instead of slider
- Multi-touch can cause erratic behavior
- No haptic feedback

**Impact:** Mobile experience is functional but not polished.

---

### LCD-010: Scene picker organization
**Status:** Open
**Component:** lucid/index.html (gallery/menu)
**Description:** As scene count grows (100+ files), the flat folder structure becomes unwieldy:
- No search/filter
- No favorites/recent
- Categories exist but aren't surfaced well
- No thumbnail previews

**Proposed Features:**
- Search box to filter by title/tags
- Favorites star toggle
- Category chips for quick filtering
- Optional thumbnail grid view

---

### LCD-011: Editor panel resizer behavior
**Status:** Open
**Component:** lucid/index.html (CSS/JS)
**Description:** The panel resizer for the JSON editor:
- Is only visible when editor is open
- Doesn't persist width preference
- Can be janky on touch devices

**Impact:** Editor workflow could be smoother.

---

### LCD-012: No undo/redo in JSON editor
**Status:** Open
**Component:** lucid/index.html
**Description:** The JSON textarea doesn't have undo/redo beyond browser default. Users can lose work with accidental overwrites.

**Proposed Fix:** Implement simple history stack or integrate CodeMirror/Monaco for proper editor features.

---

### LCD-013: Camera settings not persisted
**Status:** Open
**Component:** lucid/index.html
**Description:** User camera adjustments (zoom, pan, rotate) are lost when:
- Switching scenes
- Refreshing page
- Closing/reopening tab

Each scene has default camera, but user overrides aren't saved.

---

### LCD-014: Debug panel overlaps content on small screens
**Status:** Open
**Component:** lucid/index.html (CSS)
**Description:** On mobile devices, the debug/settings panel can cover too much of the render area. No way to resize or minimize to corner.

---

### LCD-015: Volume render mode performance
**Status:** Open
**Component:** ui/raymarcher.js
**Description:** Volume render mode is expensive:
- Accumulates density samples near surfaces
- No LOD or quality settings
- Can cause frame drops on mobile/older GPUs

**Proposed:** Add quality presets (low/medium/high) for volume rendering.

---

## P3 - Low Priority / Nice to Have

### LCD-016: Node editor UI is stub
**Status:** Open (Documented in ASSESSMENT.md)
**Component:** N/A
**Description:** The project originally envisioned a visual node editor for building scenes. This was descoped in favor of JSON + params. Could be revisited if demand exists.

---

### LCD-017: No GLSL optimization passes
**Status:** Open
**Component:** core/json-codegen.js
**Description:** Generated GLSL is readable but not optimized:
- Could inline small helper functions
- Could deduplicate common subexpressions
- Could use loop unrolling for radial/repeat

**Impact:** Shader compile times and performance could be improved for complex scenes.

---

### LCD-018: SDF picking not implemented
**Status:** Open (Documented in README.html)
**Component:** N/A
**Description:** "Click to select" picking for identifying primitives under cursor. Would require:
- Primitive ID encoding in shader
- Render-to-ID pass
- ID → tree path mapping

**Complexity:** High - requires significant codegen changes.

---

### LCD-019: Lighting presets
**Status:** Open
**Component:** lucid/index.html (lighting panel)
**Description:** Lighting panel has sliders but no presets for common setups:
- Studio lighting
- Outdoor/sun
- Dramatic rim light
- Soft ambient

---

### LCD-020: Export scene as PNG/video
**Status:** Open
**Component:** N/A
**Description:** No built-in way to capture:
- High-res screenshot
- Turntable animation video
- Param-sweep animation

Users must use browser tools or external capture.

---

### LCD-021: Keyboard shortcuts documentation
**Status:** Open
**Component:** Documentation
**Description:** Keyboard shortcuts exist but aren't well documented:
- `D` - Debug panel
- `L` - Lighting panel
- `P` - Params panel
- `E` - Editor toggle
- `←/→` - Next/prev scene
- `Space` - Play/pause animation

Should add help overlay or cheatsheet.

---

### LCD-022: Scene subtitle/notes not visible in UI
**Status:** Open
**Component:** lucid/index.html
**Description:** Scenes have `subtitle` and `notes` fields but these aren't surfaced in the main UI. Only visible in JSON editor.

---

### LCD-023: Gallery doesn't show scene complexity
**Status:** Open
**Component:** lucid/index.html
**Description:** No indication of:
- Scene poly count (estimated)
- Shader complexity
- Expected performance tier

Users may load complex scenes on weak devices without warning.

---

### LCD-024: Params panel - no reset to defaults
**Status:** Open
**Component:** lucid/index.html
**Description:** After adjusting params, no way to reset all to scene defaults without reloading. Should add "Reset All" button.

---

### LCD-025: Derived params not shown in UI
**Status:** Open
**Component:** lucid/index.html, rig-evaluator.js
**Description:** Scenes with `rig.derived` params calculate values but these aren't displayed. Users can't see computed values like `effectiveReach` in the constraints tutorial.

---

## Content Issues

### LCD-030: Some scenes have hardcoded magic numbers
**Status:** Open
**Component:** Various scene files
**Description:** Some scenes have unexplained numeric values that should be params or at least commented:
- Transform offsets
- Color values
- Blend factors

**Impact:** Harder to understand and modify scenes.

---

### LCD-031: Inconsistent scene versioning
**Status:** Open
**Component:** lucid/scenes/
**Description:** Some scenes have version "1.0", others "1.1", "2.0", etc. No consistent versioning scheme or changelog within scenes.

---

### LCD-032: Test/experimental scenes in main folders
**Status:** Open
**Component:** lucid/scenes/
**Description:** Files like `test-a.json`, `test-b.json`, experimental rounds in `subag1/` clutter the scene browser. Should be moved to `archive/` or hidden from gallery.

---

## Infrastructure Issues

### LCD-040: No automated testing [PARTIALLY FIXED]
**Status:** Partially Fixed (2026-01-04)
**Component:** tests/, package.json
**Description:** Previously had no test suite. Now implemented:
- ✅ JSON loader parsing tests
- ✅ GLSL codegen output tests
- ✅ Pre-commit hook (Tier 1 tests)
- ✅ Tiered test framework (Tier 1/2/3)
- ⏳ Renderer initialization (not tested)
- ⏳ Param slider binding (not tested)

**Fix Applied:**
- Added `npm run test:core` for fast Vitest tests
- Added `.git/hooks/pre-commit` for automatic testing
- Created `lucid/TESTING.md` documentation

---

### LCD-043: Stale test expectations in lucid-core.test.js
**Status:** Open
**Component:** tests/lucid-core.test.js
**Description:** 5 tests have stale expectations that don't match current loader behavior:
- `should load a box with transform` - expects raw arrays, gets `{type:'array', values:[...]}`
- `should resolve refs to defs` - ref not being resolved to underlying type
- `should process Euler rotation` - structured object mismatch
- `should process quaternion rotation` - structured object mismatch
- `should process axis-angle rotation` - structured object mismatch

**Root Cause:** json-loader.js changed to return structured expression objects for animatable values, but tests expect raw arrays.

**Impact:** These 5 tests fail, reducing test confidence. Core codegen tests (31) still pass.

---

### LCD-041: No CI/CD for Lucid
**Status:** Open
**Component:** GitHub Actions
**Description:** Parent repo has workflow but Lucid-specific validation not included:
- Scene JSON linting
- GLSL syntax checking
- Screenshot regression tests

---

### LCD-042: Documentation scattered
**Status:** Open
**Component:** lucid/*.md files
**Description:** Multiple docs with overlapping info:
- CLAUDE.md
- README.html
- REVIEW-2025-11-29.md
- ASSESSMENT.md
- TESTING-STRATEGY.md
- project-intro.md

Should consolidate into coherent structure.

---

## Recently Fixed

| ID | Description | Fixed Date |
|----|-------------|------------|
| LCD-001 | smoothIntersect operator implemented | 2026-01-04 |
| LCD-002 | Parameter overrides in refs | 2026-01-04 |
| LCD-006 | invaderScale param not working | 2026-01-04 |
| LCD-005 (partial) | Wiggler icon cluttered, not sticky | 2026-01-04 |
| LCD-040 (partial) | Added tiered test framework & pre-commit hook | 2026-01-04 |
| LCD-043 | Stale test expectations fixed | 2026-01-04 |

---

## Contributing

To add an issue:
1. Pick next available LCD-XXX number
2. Add under appropriate priority section
3. Include: Status, Component, Description, Steps to Reproduce (if bug), Impact
4. Commit with message: `docs: Add LCD-XXX issue`

To close an issue:
1. Add fix details and date
2. Move to "Recently Fixed" table
3. Remove from priority section or mark `[FIXED]`
