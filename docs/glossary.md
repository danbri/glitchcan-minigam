# FINK System Glossary

A reference guide to key concepts in the FINK interactive fiction system.

## Core Concepts

### FINK
**FOAFy INK** - A JavaScript wrapper format for INK content that enables modular, cross-site story distribution. (The authoritative expansion is "FOAFy Ink" per [`glitchcanary.md`](../glitchcanary.md); an earlier "Fun INK" gloss here was informal.)

- **File format:** `.fink.js` files containing `oooOO` template literals
- **Example:** [`inklet/bagend.fink.js`](../inklet/bagend.fink.js)
- **Documentation:** [`docs/fink-spec-v1.md`](fink-spec-v1.md) (normative v1.0 platform spec); [`glitchcanary.md`](../glitchcanary.md) (background & format history)

A FINK file looks like:
```javascript
oooOO`
=== knot_name ===
Story content here...
`
```

### INK
The narrative scripting language created by Inkle Studios for interactive fiction.

- **Runtime:** inkjs (JavaScript port), **vendored in-repo** at `third_party/ink/ink-full.js` and loaded locally by `inklet/finkapp/index.html` (NOT from a CDN — an earlier jsdelivr reference here was stale; some engine error strings still mention "jsdelivr" vestigially). Tooling pins `inkjs ^2.3.2` in `package.json`.
- **Key objects:** `inkjs.Compiler`, `inkjs.Story`
- **Documentation:** [`inklet/ink-language-details.md`](../inklet/ink-language-details.md)

### Knot
A named section/scene in an INK story. The fundamental unit of INK navigation.

- **Syntax:** `=== knot_name ===`
- **Path format:** `"Knot_Name.stitch.line_number"` (e.g., `"Kitchen.0"`)
- **Private knots:** Start with `_` (e.g., `_helper_function`)
- **Detection code:** [`fink-ink-engine.js:176-206`](../inklet/finkapp/fink-ink-engine.js)

### Stitch
A sub-section within a knot (optional nesting level).

- **Syntax:** `= stitch_name`
- **Path example:** `"Kitchen.prepare_food.3"`

---

## FINK Tags (INK Extensions)

FINK extends INK with custom tags for multimedia and navigation. These are legitimate INK extensions,
not hacks - INK was designed for extensibility via tags.

### `# IMAGE: <path>`
Display an image. Path resolved relative to BASEHREF.

- **Handler:** [`fink-ink-engine.js:220-230`](../inklet/finkapp/fink-ink-engine.js)
- **Example:** `# IMAGE: manor_with_taxi.jpg`

### `# BASEHREF: <path>`
Set the base path for resolving IMAGE and other media paths.

- **Handler:** [`fink-utils.js` resolveLayeredMediaUrl()](../inklet/finkapp/fink-utils.js)
- **Example:** `# BASEHREF: media/shane/`

### `# FINK: <path>`
Navigate to another FINK story file. Creates nested story hierarchy.

- **Handler:** [`fink-ink-engine.js:325-395`](../inklet/finkapp/fink-ink-engine.js) (`handleExternalFinkLoading`)
- **Example:** `# FINK: bagend.fink.js`

### `# MENU: <type>`
Display a special menu interface.

- **Handler:** [`fink-ink-engine.js`](../inklet/finkapp/fink-ink-engine.js)
- **Example:** `# MENU: main_toc`

### `# MINIGAME: <type>`
Launch an embedded minigame, optionally with parameters.

- **Handler:** [`fink-minigames.js`](../inklet/finkapp/fink-minigames.js)
- **Example:** `# MINIGAME: crystals count=5`

### `# BG: <color>`
Set background color for the current section.

- **Example:** `# BG: #1a1a2e`

### `# AUDIO: <path>` / `# FOLEY: <path>`
Play background audio or sound effects.

- **Handlers:** [`fink-audio.js`](../inklet/finkapp/fink-audio.js), [`fink-foley.js`](../inklet/finkapp/fink-foley.js)

### `# PUBLIC: <knot_list>`
Declare knots as valid deep-link entry points (respawn-safe).

- **Handler:** [`fink-navigation.js:327-336`](../inklet/finkapp/fink-navigation.js)
- **Example:** `# PUBLIC: main_menu settings`

### `# RESTART`
Trigger full page reload (return to initial state).

- **Handler:** [`fink-ink-engine.js`](../inklet/finkapp/fink-ink-engine.js)

---

## Navigation System

### FINK Link ID
A two-part hash for deep linking into FINK stories.

- **Format:** `#<urlHash>-<knotHash>` (8 chars + hyphen + 9 chars = 18 total)
- **urlHash:** SHA-256 of FINK file URL, truncated to 8 hex chars
- **knotHash:** SHA-256 of knot name (with `#` prefix), truncated to 9 hex chars
- **Spec:** [`fink-navigation.js:1-20`](../inklet/finkapp/fink-navigation.js)
- **Example:** `#a1b2c3d4-e5f6g7h8i`

### FINK Stack
The breadcrumb's hierarchical tracking of nested FINK files.

- **Data structure:** Array of `{url, knots[], timestamp}` objects
- **Implementation:** [`fink-breadcrumb.js:17`](../inklet/finkapp/fink-breadcrumb.js)
- **Example:** `[{url: 'toc.fink.js', knots: [...]}, {url: 'bagend.fink.js', knots: [...]}]`

### Breadcrumb Display Modes
Tristate UI for navigation display.

- **Modes:** `minimal` (icon only) → `compact` (single line) → `expanded` (full tree)
- **Implementation:** [`fink-breadcrumb.js:19-103`](../inklet/finkapp/fink-breadcrumb.js)
- **CSS:** [`fink-breadcrumb.css`](../inklet/finkapp/fink-breadcrumb.css)

### Path String
INK runtime's representation of current story position.

- **Property:** `story.state.currentPathString`
- **Format:** `"KnotName.stitch.lineNumber"` or `"KnotName.lineNumber"`
- **Used for:** Knot detection, breadcrumb tracking, URL hash updates
- **Bug:** Sometimes null/empty - see [BUG-009](../inklet/BUGS.md)

---

## Sandbox System

### oooOO
Tagged template literal function that captures FINK content.

- **NOT a regular function** - it's a JavaScript tagged template
- **Execution:** Via script injection into sandbox iframe
- **Implementation:** [`fink-sandbox.js`](../inklet/finkapp/fink-sandbox.js)
- **WARNING:** Never parse with regex - see [`CLAUDE.md`](../CLAUDE.md) NO HACKPARSING rule

### FinkSandbox
Secure iframe-based loader for .fink.js files.

- **Purpose:** Execute JavaScript safely, extract INK content via postMessage
- **Implementation:** [`fink-sandbox.js`](../inklet/finkapp/fink-sandbox.js)
- **Key methods:**
  - `loadViaSandbox(url)` - Fetch and execute FINK file
  - `clearLoadRecord(url)` - Allow re-loading a previously loaded URL

### Duplicate Detection
Prevents re-loading the same FINK URL within a session.

- **Purpose:** Avoid infinite loops, improve performance
- **Clearing:** `FinkSandbox.clearLoadRecord(url)` before intentional reloads
- **Potential bug source:** URL normalization issues (trailing slashes, encoding)

---

## Key Files Reference

### Player & Engine
| File | Purpose |
|------|---------|
| [`fink-player.js`](../inklet/finkapp/fink-player.js) | Main coordinator, init, story loading |
| [`fink-ink-engine.js`](../inklet/finkapp/fink-ink-engine.js) | INK compilation, story flow, tag processing |
| [`fink-sandbox.js`](../inklet/finkapp/fink-sandbox.js) | Secure FINK file loading |

### UI & Navigation
| File | Purpose |
|------|---------|
| [`fink-ui.js`](../inklet/finkapp/fink-ui.js) | DOM manipulation, display |
| [`fink-breadcrumb.js`](../inklet/finkapp/fink-breadcrumb.js) | Navigation history tracking |
| [`fink-navigation.js`](../inklet/finkapp/fink-navigation.js) | Deep linking, URL hashes |

### Utilities
| File | Purpose |
|------|---------|
| [`fink-utils.js`](../inklet/finkapp/fink-utils.js) | URL resolution, helpers |
| [`fink-config.js`](../inklet/finkapp/fink-config.js) | Default paths, settings |

### Content
| File | Purpose |
|------|---------|
| [`toc.fink.js`](../inklet/toc.fink.js) | Table of contents / main menu |
| [`bagend.fink.js`](../inklet/bagend.fink.js) | Hobbit adventure story (with inventory tracking, state management) |
| [`shane-manor.fink.js`](../inklet/shane-manor.fink.js) | Murder mystery story |

---

## Related Documentation

- [`CLAUDE.md`](../CLAUDE.md) - Development rules and project context
- [`docs/fink-spec-v1.md`](fink-spec-v1.md) - Normative FINK platform specification (v1.0)
- [`glitchcanary.md`](../glitchcanary.md) - FINK format background
- [`inklet/BUGS.md`](../inklet/BUGS.md) - Bug tracker
- [`docs/fink_link_cache_nav.md`](fink_link_cache_nav.md) - Navigation cache design
- [`docs/finkapp-ideas.md`](finkapp-ideas.md) - Feature ideas
- [`inklet/finkapp/README.md`](../inklet/finkapp/README.md) - Finkapp architecture
