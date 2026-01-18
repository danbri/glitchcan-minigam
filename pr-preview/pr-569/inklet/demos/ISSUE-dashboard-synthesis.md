# FINK: minigame and fink-scene synthesis via dashboard

> **TODO: Create as GitHub issue**

## Problem Statement

When navigating between FINK scenes (chapters) and minigames, variable state is lost on return transitions. The current `# RESTART` tag triggers a full page reload, destroying all runtime state.

**Observed behavior:**
- Play minigames, collect diamonds
- Navigate to Chapter 2, play mega minigame
- Get mugged (diamonds reduced)
- Return to Chapter 1 → diamonds show as 0

## Root Cause Analysis

```
Chapter 1: diamonds=0
    ↓ play minigame
Chapter 1: diamonds=5 (in memory)
    ↓ FINK load Chapter 2
Chapter 2: diamonds=5 (injected via savedState)
    ↓ play mega minigame, get mugged
Chapter 2: diamonds=1, mega_diamonds=7
    ↓ RESTART tag
window.location.reload()
    ↓
Chapter 1: diamonds=0  ← ALL STATE LOST
```

The `savedState` injection only works **forward** (parent → child). There's no mechanism to propagate state **backward** (child → parent) on return.

## Design Requirements

### 1. State Persistence Layer
Variables need to persist beyond the Ink runtime memory:
- `localStorage` for session persistence?
- URL params for shareable state?
- IndexedDB for richer data?

### 2. Graceful POP (Return) Mechanism
Instead of RESTART (page reload), implement proper context stack:
- `# PUSH` - save current context, load new FINK
- `# POP` - restore previous context with updated EXPORT vars
- State flows: parent → child (INJECT) and child → parent (YOINK)

### 3. Minigame API Contract
Each minigame should honor an API that:
- Declares which variables it reads/writes
- Emits events when state changes
- Integrates with game-wide dashboard
- Could be a Web Component or a simple interface:

```javascript
// Minigame API (strawman)
interface MinigameContract {
  // Variables this minigame can modify
  exports: ['diamonds', 'score'];

  // Called when minigame ends
  onComplete(results: { diamonds: number, score: number }): void;

  // Event emitter for real-time updates
  onStateChange(callback: (varName, oldVal, newVal) => void): void;
}
```

### 4. Dashboard Widget
A persistent UI element showing:
- Current variable values across all contexts
- Which FINK scene is active
- Minigame status and results
- Could be a Web Component `<fink-dashboard>`

```html
<fink-dashboard>
  <!-- Auto-updates from FinkStateStore -->
  💎 5  ⭐ 7  🔑 2  📍 Chapter 2
</fink-dashboard>
```

## Proposed Architecture

```
┌─────────────────────────────────────────────┐
│  <fink-dashboard>                           │
│  💎 diamonds: 5  ⭐ mega: 7  🔑 keys: 2     │
└─────────────────────────────────────────────┘
         ↑ subscribes to state changes
         │
┌────────┴────────┐
│  FinkStateStore │ ← localStorage backed
│  (singleton)    │
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    ↓         ↓            ↓
[Chapter1] [Chapter2] [Minigame]
   FINK       FINK        JS
```

## Implementation Sketch

### FinkStateStore (singleton)

```javascript
class FinkStateStore {
  constructor() {
    this.state = this.load() || {};
    this.listeners = new Set();
  }

  get(key) { return this.state[key]; }

  set(key, value) {
    const old = this.state[key];
    this.state[key] = value;
    this.persist();
    this.notify(key, old, value);
  }

  persist() {
    localStorage.setItem('fink-state', JSON.stringify(this.state));
  }

  load() {
    const stored = localStorage.getItem('fink-state');
    return stored ? JSON.parse(stored) : null;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(key, oldVal, newVal) {
    this.listeners.forEach(cb => cb(key, oldVal, newVal));
  }
}

// Global singleton
window.finkState = window.finkState || new FinkStateStore();
```

### Integration with Ink Runtime

```javascript
// After story compilation, sync with persistent store
function syncStoryWithStore() {
  const globalVars = ['diamonds', 'mega_diamonds', 'keys', 'score'];

  // Load from store into story
  globalVars.forEach(v => {
    const stored = finkState.get(v);
    if (stored !== undefined) {
      story.variablesState[v] = stored;
    }
  });

  // Watch story changes, persist to store
  story.ObserveVariable('diamonds', (name, val) => {
    finkState.set(name, val);
  });
}
```

## Questions to Resolve

1. Should minigames be iframes (sandboxed) or inline JS (trusted)?
2. How do we handle untrusted FINK content modifying global state?
3. What's the serialization format for state snapshots?
4. How does ACCESS_TIER interact with state persistence?
5. Should the dashboard be opt-in per story or always present?

## Related Files

- `inklet/demos/FINK-CONTEXT-STACK.md` - ACCESS_TIER design
- `inklet/demos/fink-namespace-preprocessor.js` - Namespace isolation
- `inklet/demos/hamfink2026.html` - Current implementation

## Immediate Workaround

Until proper PUSH/POP is implemented, we could:
1. Save EXPORT vars to localStorage before RESTART
2. Load them back on page init
3. This is hacky but would preserve state across reloads
