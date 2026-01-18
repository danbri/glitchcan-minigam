# Lucid Zero-Annoyances Architecture Plan

**Goal**: Drive all glitchy, buggy, frustrating UI annoyances to zero while building a modular, mobile-first, accessible system.

## Core Principles

1. **Mobile-first != dumbed down** - Full functionality, smart touch gestures, appropriate tap targets (44px+), no cramped text
2. **Graceful degradation** - Never crash on bad data; show clear, helpful errors
3. **Backend neutral** - Every rendering surface supports both Mayfly (WebGL) and Stinkyfish (WebGPU)
4. **Web Components** - Modular, composable, reusable pieces
5. **One source of truth** - Scene catalog from `toc.json`, validation status from audit system

---

## Phase 1: Foundation Web Components

### `<lucid-renderer>` (EXISTS - needs polish)
Current: Works but init can fail on hidden elements
**Improvements needed:**
- [x] Robust init with dimension checking (just fixed)
- [ ] Expose camera drag/touch gestures in component
- [ ] Add `paused` attribute to stop render loop when hidden
- [ ] Fire events for shader compile errors with helpful messages
- [ ] Support `loading="lazy"` attribute for deferred init

### `<lucid-scene-picker>` (NEW)
**Purpose:** Unified scene browser used by both /lucid/ and node-editor

```html
<lucid-scene-picker
  filter="validated"     <!-- "all" | "validated" | "broken" | "recent" -->
  layout="grid"          <!-- "grid" | "list" | "compact" -->
  show-status="true"     <!-- show validation badges -->
  on-select="loadScene"
></lucid-scene-picker>
```

**Features:**
- Loads from `scenes/toc.json`
- Categories expandable/collapsible
- Search/filter by name
- Validation status badges from fink-audit (green=compiles, yellow=warnings, red=broken)
- Lazy-load thumbnails only when visible (IntersectionObserver)
- Touch-friendly: large tap targets, swipe to navigate categories
- Keyboard accessible: arrow keys, type-to-search
- **Critical:** Catches errors loading broken scenes, shows helpful message, doesn't crash

### `<lucid-param-editor>` (NEW)
**Purpose:** Edit scene parameters with appropriate input types

```html
<lucid-param-editor params="{...}" rig="{...}"></lucid-param-editor>
```

**Features:**
- Auto-generates inputs based on param types (slider for scalar, color picker for color3, etc.)
- Shows rig constraints and current values
- Touch-friendly sliders (wide, easy to grab)
- Keyboard: tab between params, arrow keys to adjust
- Live update as you drag (debounced for performance)

### `<lucid-timeline>` (NEW)
**Purpose:** Animation control, scrubbing, wiggler integration

```html
<lucid-timeline
  duration="10"
  params="{...}"
  show-wigglers="true"
></lucid-timeline>
```

**Features:**
- Play/pause/rewind/loop controls
- Scrubber with touch-friendly handle
- Speed control (0.1x - 3x)
- Wiggler presets (sin, bounce, spring, etc.)
- Mini sparkline graphs for animated params
- Keyboard: space=play/pause, arrow keys=scrub

### `<lucid-node-graph>` (REFACTOR from node-editor.html)
**Purpose:** Visual node-based SDF composition

```html
<lucid-node-graph></lucid-node-graph>
```

**Features:**
- Full-screen canvas mode
- Drag nodes from palette
- Connect with bezier curves
- Touch: pinch to zoom, two-finger pan
- Keyboard: delete=remove node, ctrl+c/v=copy/paste
- Export to JSON
- **Import from scene picker** - load existing scene as node graph

---

## Phase 2: Unified Entry Points

### `/lucid/index.html` (Main Viewer)
**Refactor to use components:**

```html
<lucid-app>
  <lucid-scene-picker slot="sidebar"></lucid-scene-picker>
  <lucid-renderer slot="main"></lucid-renderer>
  <lucid-param-editor slot="panel"></lucid-param-editor>
  <lucid-timeline slot="footer"></lucid-timeline>
</lucid-app>
```

**Current issues to fix:**
- Backend selector added but switching is fragile
- Scene picker is custom code, not reusable
- Param editing mixed with other concerns
- Timeline/animation scattered

### `/lucid/node-editor.html` (Visual Editor)
**Refactor:**

```html
<lucid-app mode="editor">
  <lucid-scene-picker slot="sidebar"></lucid-scene-picker>
  <lucid-node-graph slot="main"></lucid-node-graph>
  <lucid-renderer slot="preview"></lucid-renderer>
  <lucid-timeline slot="footer"></lucid-timeline>
</lucid-app>
```

**New capability:** Load scene from picker into node graph for editing

### `/lucid/scene-catalog.html` (Comparison View)
**Refactor:**

```html
<lucid-catalog>
  <!-- Auto-generates grid of lucid-renderer pairs (Mayfly vs Stinkyfish) -->
</lucid-catalog>
```

---

## Phase 3: Error Resilience

### Scene Loading Safety

Every scene load must:
1. Wrap in try/catch
2. Validate JSON structure before rendering
3. Timeout shader compilation (5s max)
4. Show specific error: "Shader compile failed at line X" not just "error"
5. Offer "skip" and "report" options
6. Never freeze the UI

### Validation Integration

```javascript
// Before loading scene
const status = await getSceneValidationStatus(scenePath);
if (status === 'broken') {
  showWarning('This scene has known issues. Load anyway?');
}
```

### Filter Options in Scene Picker

```html
<lucid-scene-picker>
  <!-- Filter bar -->
  <div class="filter-bar">
    <button data-filter="all">All (117)</button>
    <button data-filter="validated" class="active">Working (98)</button>
    <button data-filter="recent">Recent (8)</button>
    <button data-filter="broken">Needs Fix (19)</button>
  </div>
</lucid-scene-picker>
```

---

## Phase 4: Mobile-First Design Guidelines

### Touch Targets
- **Minimum 44x44px** for all interactive elements
- Generous padding, not cramped layouts
- Visible focus states for accessibility

### Gestures
- **Single tap:** Select
- **Double tap:** Edit / zoom to fit
- **Drag:** Pan canvas / move nodes
- **Pinch:** Zoom
- **Two-finger drag:** Pan while zooming
- **Long press:** Context menu

### Typography
- **Body text: 16px minimum** on mobile
- **Labels: 14px minimum**
- Never shrink fonts to fit more; reflow layout instead
- High contrast (4.5:1 ratio minimum)

### Layout Patterns
- Collapsible panels that **expand** when opened, not shrink content
- Bottom sheets for mobile (slide up from bottom)
- Full-screen modals for complex interactions
- Floating action buttons for primary actions

---

## Phase 5: Accessibility Checklist

- [ ] All images have alt text
- [ ] Color is not the only indicator (icons + color for status)
- [ ] Keyboard navigation for all features
- [ ] Screen reader announcements for state changes
- [ ] Reduced motion option respects `prefers-reduced-motion`
- [ ] Focus visible on all interactive elements
- [ ] ARIA labels on icon-only buttons
- [ ] Skip links for main content
- [ ] No time limits (or pauseable)

---

## Implementation Order

### Week 1: Foundation
1. Polish `<lucid-renderer>` - paused attribute, better errors
2. Create `<lucid-scene-picker>` with filter support
3. Integrate scene picker into both /lucid/ and node-editor

### Week 2: Editing Components
4. Create `<lucid-param-editor>`
5. Refactor node-editor to use `<lucid-node-graph>` component
6. Create `<lucid-timeline>`

### Week 3: Integration
7. Wire up components in index.html
8. Add scene-to-node-graph import
9. Validation status integration

### Week 4: Polish
10. Touch gesture refinement
11. Accessibility audit and fixes
12. Performance optimization (lazy loading, virtualization)

---

## Success Metrics

- **Zero crashes** when browsing scenes (even broken ones)
- **<3s** time to interactive on mobile
- **100%** keyboard navigable
- **WCAG 2.1 AA** accessibility compliance
- **Both backends** selectable on every render surface
- **Same features** on mobile and desktop (layout adapts, features don't disappear)

---

## Anti-Patterns to Avoid

1. **Font shrinking** - Never make text smaller to fit more
2. **Hidden features** - Mobile gets same features, different layout
3. **Silent failures** - Always show what went wrong
4. **Blocking errors** - Errors in one scene don't block others
5. **Desktop-first adaptation** - Start mobile, enhance for desktop
6. **Disconnected tools** - Components should work together seamlessly
