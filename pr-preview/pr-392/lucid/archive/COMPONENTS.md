# Lucid SDF Web Components - Usage Guide

**Status:** Components currently defined in `lucid/index.html` (monolithic file)
**Future:** Will be extracted to `lucid/components/*.js` modules

---

## Available Components

### 1. `<debug-console-app>`

**Purpose:** Debug event logger with timestamps

**Usage:**
```html
<debug-console-app style="width:100%; height:400px;"></debug-console-app>
```

**Events:**
- Listens: `debug-log` (window level)
- Listens: `debug-clear` (window level)

**API:**
```javascript
// Trigger from anywhere:
window.dispatchEvent(new CustomEvent("debug-log", {
  detail: { message: "Test", type: "info", time: "1.23" }
}));
```

---

### 2. `<node-editor-app>`

**Purpose:** Placeholder for visual SDF node graph editor (stub)

**Usage:**
```html
<node-editor-app style="width:100%; height:600px;"></node-editor-app>
```

**State:**
- Currently displays design notes only
- Future: Canvas-based node editor
- Registers itself in `window.appContext.instances.nodeEditor`

---

### 3. `<glsl-preview-app>`

**Purpose:** DSL text editor with GLSL code generation

**Usage:**
```html
<glsl-preview-app style="width:100%; height:800px;"></glsl-preview-app>
```

**Features:**
- Editable DSL textarea
- Real-time GLSL output
- Example buttons (Two Spheres, Box Minus Sphere, Animated Blob, Wandering Box)
- Render/Reset/Clear buttons

**Events:**
- Emits: `dsl-args-usage` - Reports which arg_1-4 are used
- Updates: `window.appContext.sceneGraph` on parse

**API:**
```javascript
const preview = document.querySelector('glsl-preview-app');

// Programmatically set DSL
preview.shadowRoot.getElementById('dsl').value = 'sphere(r=2.0)';
preview.applyDsl();

// Get generated GLSL
const glsl = preview.shadowRoot.getElementById('glsl').value;
```

---

### 4. `<composite-editor-app>`

**Purpose:** Edit compositing expression for multi-layer rendering

**Usage:**
```html
<composite-editor-app style="width:100%; height:300px;"></composite-editor-app>
```

**Features:**
- Editable GLSL one-liner for combining layers
- Available variables: `colSurf`, `colVol`, `colUtil`, `depthSurf`, `depthVol`

**Events:**
- Emits: `composite-updated` with `{ expr: "..." }`

**Example:**
```glsl
finalColor = mix(colSurf, colVol, 0.4) + 0.2 * colUtil;
```

---

### 5. `<sdf-renderer-app>`

**Purpose:** WebGL raymarching renderer with controls

**Usage:**
```html
<sdf-renderer-app style="width:100%; height:100%;"></sdf-renderer-app>
```

**Features:**
- Real-time WebGL rendering
- Scene preset dropdown (DSL Graph, Jellies, Volume shapes, Ball)
- Raymarch parameters (steps, step size, max distance)
- Camera controls (orbit on/off)
- Edge rendering toggle
- Pause rendering checkbox
- DSL args sliders (arg_1 through arg_4)

**Events:**
- Listens: `dsl-args-usage` - Enables/disables arg sliders
- Listens: `composite-updated` - Updates compositing shader

**API:**
```javascript
const renderer = document.querySelector('sdf-renderer-app');

// Access parameters
renderer.params.maxSteps = 128;
renderer.params.stepSize = 0.05;
renderer.updateUniforms();

// Rebuild shader from scene graph
renderer.rebuildProgramFromSceneGraph();

// Pause/resume
renderer.stopAnimation();
renderer.startAnimation();
```

---

### 6. `<raymarcher-app>`

**Purpose:** Main tabbed container for all components

**Usage:**
```html
<raymarcher-app style="display:block; height:100vh;"></raymarcher-app>
```

**Tabs:**
1. **Render** - `<sdf-renderer-app>`
2. **DSL / GLSL** - `<glsl-preview-app>`
3. **Composite** - `<composite-editor-app>`
4. **Debug** - `<debug-console-app>`
5. **Editor (exp)** - `<node-editor-app>`

**API:**
```javascript
const app = document.querySelector('raymarcher-app');
app.switchTab('glsl'); // Switch to DSL/GLSL tab
```

---

## Global State: `window.appContext`

All components share a global application context:

```javascript
window.appContext = {
  debugLogger: GlobalDebugLogger,  // Central logging
  sceneGraph: [],                  // IR nodes (source of truth)
  sceneObjects: [],                // Currently unused
  instances: {                     // Component references
    nodeEditor: null,
    sdfRenderer: null,
    glslPreview: null,
    compositeEditor: null
  }
};
```

**Usage:**
```javascript
// Log debug message
window.appContext.debugLogger.logEvent("Test", "info");

// Access scene graph
console.log(window.appContext.sceneGraph);

// Access renderer instance
const renderer = window.appContext.instances.sdfRenderer;
if (renderer) {
  renderer.rebuildProgramFromSceneGraph();
}
```

---

## Using Components in Other HTML Files

**Public URL:** https://danbri.github.io/glitchcan-minigam/lucid/

### Method 1: Load from GitHub Pages (Current)

```html
<!DOCTYPE html>
<html>
<head>
  <title>SDF Example</title>
</head>
<body>
  <sdf-renderer-app style="width:100%; height:600px;"></sdf-renderer-app>

  <!-- Load index.html to register components -->
  <script src="https://danbri.github.io/glitchcan-minigam/lucid/index.html"></script>

  <!-- Use component helpers -->
  <script type="module">
    import { COMPONENTS, whenComponentDefined } from 'https://danbri.github.io/glitchcan-minigam/lucid/components.js';

    // Wait for renderer to be available
    await whenComponentDefined(COMPONENTS.SDF_RENDERER);

    // Access appContext
    const ctx = window.appContext;
    console.log('Scene graph:', ctx.sceneGraph);
  </script>
</body>
</html>
```

### Method 2: Iframe Embed

```html
<!DOCTYPE html>
<html>
<head>
  <title>Embedded Lucid SDF</title>
</head>
<body>
  <h1>Lucid SDF Playground</h1>

  <!-- Embed entire app -->
  <iframe
    src="https://danbri.github.io/glitchcan-minigam/lucid/"
    style="width:100%; height:800px; border:none;"
    title="Lucid SDF Playground">
  </iframe>
</body>
</html>
```

**Future Method (When Modularized):**

```html
<!DOCTYPE html>
<html>
<head>
  <title>SDF Example</title>
</head>
<body>
  <sdf-renderer-app style="width:100%; height:600px;"></sdf-renderer-app>

  <script type="module">
    // Import components
    import './lucid/components/sdf-renderer.js';
    import './lucid/components/core.js'; // appContext
  </script>
</body>
</html>
```

---

## Component Dependencies

### Dependency Graph

```
raymarcher-app (main container)
├── sdf-renderer-app
│   └── Requires: appContext.sceneGraph
├── glsl-preview-app
│   └── Updates: appContext.sceneGraph
├── composite-editor-app
│   └── Emits: composite-updated event
├── debug-console-app
│   └── Requires: appContext.debugLogger
└── node-editor-app
    └── Requires: appContext.instances
```

### Shared Dependencies

All components depend on:
- `window.appContext` (global state)
- `normalizeDslText()` (for glsl-preview-app)
- `parseDslToSceneGraph()` (for glsl-preview-app)
- `generateGlslFromSceneGraph()` (for sdf-renderer-app)

---

## Roadmap: Modularization

### Phase 1: Extract Core (No Breaking Changes)

Create `lucid/components/core.js`:
```javascript
export class GlobalDebugLogger { /* ... */ }
export class AppContext { /* ... */ }
export function normalizeDslText(text) { /* ... */ }
export function parseDslToSceneGraph(text) { /* ... */ }
export function generateGlslFromSceneGraph(graph) { /* ... */ }
```

### Phase 2: Extract Components

- `lucid/components/debug-console.js`
- `lucid/components/node-editor.js`
- `lucid/components/glsl-preview.js`
- `lucid/components/composite-editor.js`
- `lucid/components/sdf-renderer.js`
- `lucid/components/raymarcher-app.js`

### Phase 3: Create index.js Re-export

```javascript
// lucid/components/index.js
export * from './core.js';
export * from './debug-console.js';
export * from './node-editor.js';
export * from './glsl-preview.js';
export * from './composite-editor.js';
export * from './sdf-renderer.js';
export * from './raymarcher-app.js';
```

### Phase 4: Update index.html

```html
<script type="module">
  import './components/index.js';
  // Components auto-register on import
</script>
```

---

## Testing Components

### Unit Testing (Future)

```javascript
import { test, expect } from 'vitest';
import './lucid/components/debug-console.js';

test('debug-console-app registers', () => {
  const el = document.createElement('debug-console-app');
  expect(el).toBeInstanceOf(HTMLElement);
  expect(customElements.get('debug-console-app')).toBeDefined();
});
```

### Integration Testing (Playwright)

```javascript
import { test, expect } from '@playwright/test';

test('components load in index.html', async ({ page }) => {
  await page.goto('/lucid/index.html');

  // Check all components registered
  const hasDebugConsole = await page.evaluate(() => {
    return customElements.get('debug-console-app') !== undefined;
  });
  expect(hasDebugConsole).toBe(true);
});
```

---

## Example: Embedding in Documentation

```html
<!DOCTYPE html>
<html>
<head>
  <title>SDF DSL Examples</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .example { margin: 20px 0; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>SDF DSL Examples</h1>

  <h2>Example 1: Simple Sphere</h2>
  <div class="example">
    <glsl-preview-app style="width:100%; height:400px;"></glsl-preview-app>
  </div>

  <script>
    // Set initial DSL
    window.addEventListener('load', () => {
      const preview = document.querySelector('glsl-preview-app');
      const dsl = preview.shadowRoot.getElementById('dsl');
      dsl.value = 'sphere(r=1.0, color=[1.0, 0.5, 0.2])';
      preview.applyDsl();
    });
  </script>

  <!-- Load components from index.html -->
  <script src="../lucid/index.html"></script>
</body>
</html>
```

---

## Current Status

**✅ Working:** All components functional in `lucid/index.html`
**⏳ Todo:** Extract to ES6 modules (see Phase 1-4 above)
**📝 Documented:** This file describes current usage patterns

**Next Step:** Create `lucid/components/core.js` with shared utilities, keeping `index.html` as fallback.
