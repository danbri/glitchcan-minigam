# Gamedev Technical Review - FINK Engine
Date: 2026-01-22

## Architecture Summary

```
+------------------+     +-------------------+     +------------------+
|   FINK Story     |     |   FinkInkEngine   |     |   FinkMinigames  |
|   (.fink.js)     |---->|   (INK Runtime)   |<--->|   (Orchestrator) |
+------------------+     +-------------------+     +------------------+
        |                       |                         |
        v                       v                         v
+------------------+     +-------------------+     +------------------+
|   FinkSandbox    |     |   FinkNavigation  |     | Inline/IFrame    |
|   (Secure Load)  |     |   (Deep Links)    |     | Minigames        |
+------------------+     +-------------------+     +------------------+
        |                       |                         |
        v                       v                         v
+------------------+     +-------------------+     +------------------+
|   oooOO Parser   |     |   FinkBreadcrumb  |     | postMessage IPC  |
|   (JSONP-like)   |     |   (Nav History)   |     | (State Sync)     |
+------------------+     +-------------------+     +------------------+
```

**Core Components:**
- `fink-ink-engine.js` - INK compilation & story execution with tag processing
- `fink-minigames.js` - Minigame lifecycle orchestrator with window state management
- `fink-sandbox.js` - Secure FINK loading via iframe sandbox (JSONP-like pattern)
- `fink-navigation.js` - Two-part hash-based deep linking with localStorage cache
- `fink-foley.js` - WebAudio procedural sound synthesis
- `fink-breadcrumb.js` - Hierarchical navigation state tracking

## Strengths

### 1. Well-Designed Minigame Integration Pattern
The orchestrator pattern in `FinkMinigames` is solid:
```javascript
// Clean metadata for minigames with control modes
minigameInfo: {
    gems: { icon: '...', title: '...', controls: 'none' },
    mudslider: { icon: '...', title: '...', controls: 'lite' },
    gridluck: { icon: '...', title: '...', controls: 'none' }
}
```
- **Dual-mode support**: Inline minigames (direct DOM) and iframe-sandboxed games
- **Control abstraction**: 'dpad', 'lite', 'none' modes for touch interface adaptation
- **Window state machine**: pause/pin/minimize/maximize with proper CSS class management
- **IPC protocol**: Clean postMessage interface for iframe games with ready/progress/complete lifecycle

### 2. Delta-Based State Synchronization
The minigame system preserves parallel activity changes elegantly:
```javascript
// Delta sync: preserves changes from parallel activities
const gameDelta = currentGems - this.lastSync.gameGems;
const newDiamonds = currentStoryDiamonds + gameDelta;
this._setStoryVariable('diamonds', newDiamonds);
```
This prevents the classic "last write wins" problem when multiple systems modify shared state.

### 3. Procedural Audio System (FinkFoley)
Professional-grade ambient sound synthesis:
- Perlin noise modulation for organic variation
- FBM (Fractal Brownian Motion) for multi-octave noise
- Named layer system for concurrent sound mixing
- Tag-based triggering: `# FOLEY: water(drip:0.8, vol:0.5)`
- Five implemented sound types: water, wind, fire, machinery, rumble

### 4. Auto-Injected Private Variables
The engine automatically augments stories with common game state:
```javascript
getPrivateInventoryInk(storyContent) {
    // Check which variables the story already declares
    const hasDiamonds = /VAR\s+diamonds\s*=/.test(storyContent);
    // Only inject if not present
    if (!hasDiamonds) varDeclarations += 'VAR diamonds = 0\n';
}
```
This allows stories to work standalone or integrate with the broader game world.

### 5. Cache-Aware Deep Linking
The navigation system implements a sophisticated two-part hash scheme:
- `urlHash` (8 chars): Identifies the FINK file
- `knotHash` (9 chars): Identifies the position within the file
- LocalStorage persistence for cross-session deep links
- Graph-based resolution for discovering related FINK files

## Technical Debt

### 1. IMPORT/EXPORT Contract Not Enforced at Runtime
The tag convention exists in FINK content:
```ink
# IMPORT: diamonds, mega_diamonds, keys, score
# EXPORT: mega_diamonds, was_mugged
```
But the main engine does not:
- Validate imported variables exist before story execution
- Copy exported variables back to parent context
- Warn when contracts are violated

The `fink-namespace-preprocessor.js` demo exists but isn't integrated into the main pipeline.

### 2. Duplicate Module Implementations
Two versions of several modules exist:
```
inklet/app/fink-sandbox.js     vs    inklet/finkapp/fink-sandbox.js
inklet/app/fink-breadcrumb.js  vs    inklet/finkapp/fink-breadcrumb.js
```
This creates maintenance burden and potential divergence.

### 3. Magic Timeout Values
Hardcoded delays without clear justification:
```javascript
// 500ms delay before loading (matches working hamfink2026 timing)
// NOTE: This delay was added to match hamfink2026 behavior during initial port.
// It may be vestigial - investigate if removal causes issues.
setTimeout(() => { ... }, 500);
```
These timing dependencies are fragile and race-condition-prone.

### 4. Inline Gems Minigame Duplicated Logic
`gems.minigam.js` and the inline version in `fink-minigames.js._createInlineGem()` duplicate gem spawning logic with slight variations. Should be consolidated.

### 5. Error Recovery Generates INK at Runtime
`showLinkNotFoundError()` dynamically generates INK content and compiles it:
```javascript
const recoveryInk = `=== link_not_found ===
**Bookmark Not Found**
...`;
const compiler = new inkjs.Compiler(recoveryInk);
const story = compiler.Compile();
```
This is clever but brittle - the recovery flow could be a pre-compiled FINK file instead.

## Missing Features

### 1. No Save/Load System
Players cannot:
- Save progress to named slots
- Auto-save on chapter transitions
- Restore from checkpoints
- Cloud sync saves across devices

### 2. No Achievement System
No infrastructure for:
- Defining achievements in stories
- Tracking unlock conditions
- Persisting achievement state
- Displaying achievement notifications

### 3. No Proper Inventory UI
The `_inventory` knot is auto-injected but:
- Only accessible via special navigation
- No hotkey/gesture to view inventory
- No item descriptions or stacking
- No drag-drop or use/combine mechanics

### 4. No Localization Framework
Stories are hardcoded in one language with no:
- String table extraction
- Language selection UI
- RTL text support
- Translated content loading

### 5. No Analytics/Telemetry Hooks
No way to track:
- Player progression through stories
- Choice distributions
- Minigame completion rates
- Session duration

### 6. No Animation Timeline System
The FINK player can display images but lacks:
- Sprite animation support
- Tween/easing for UI transitions
- Cutscene scripting
- Camera control (pan, zoom)

### 7. No Input Rebinding
Controls are hardcoded with no:
- Key remapping UI
- Gamepad support
- Touch gesture customization
- Accessibility options

## Recommendations

### Priority 1: Implement Runtime IMPORT/EXPORT Enforcement
```javascript
// Proposed: In fink-ink-engine.js
async handleChapterTransition(finkUrl, exportVars = []) {
    // 1. Extract EXPORT values from current story
    const exports = {};
    exportVars.forEach(v => exports[v] = this.story.variablesState[v]);

    // 2. Load new chapter
    const content = await FinkSandbox.loadViaSandbox(finkUrl);
    await this.compileAndRunStory(content);

    // 3. Inject IMPORT values from saved exports
    const importTags = content.match(/# IMPORT:\s*(.+)/);
    if (importTags) {
        importTags[1].split(',').map(s => s.trim()).forEach(varName => {
            if (exports[varName] !== undefined) {
                this.story.variablesState[varName] = exports[varName];
            }
        });
    }
}
```

### Priority 2: Add Save/Load System
Use localStorage with versioned save format:
```javascript
// Proposed: FinkSaveSystem
{
    version: 2,
    slot: 'auto',
    timestamp: Date.now(),
    finkUrl: currentFinkUrl,
    knotPath: currentKnotName,
    variables: { diamonds: 5, mega_diamonds: 2, ... },
    breadcrumb: FinkBreadcrumb.finkStack
}
```

### Priority 3: Consolidate Duplicate Modules
Pick `inklet/finkapp/` as canonical and remove or symlink `inklet/app/` duplicates.

### Priority 4: Add Minigame Registry Pattern
Replace hardcoded switch statements with registration:
```javascript
// Instead of: switch(type) { case 'gems': case 'chess': ... }
FinkMinigames.register('gems', GemsMinigame);
FinkMinigames.register('chess', ChessMinigame);
FinkMinigames.register('mudslider', { iframe: true, path: '../minigames/mudslider/' });
```

### Priority 5: Add Session Recording for Debugging
Record player inputs and story state transitions to replay bugs:
```javascript
FinkSession.record({
    event: 'choice',
    choiceIndex: 2,
    timestamp: Date.now(),
    variables: this.story.variablesState,
    knotPath: currentKnot
});
```

## Performance Observations

**Good:**
- Duplicate load detection prevents redundant FINK fetches
- Debug log rotation prevents memory growth
- Breadcrumb stack depth limit (10 levels)
- Sandbox cleanup on load completion

**Needs Attention:**
- No asset preloading strategy
- Images loaded synchronously on tag encounter
- No audio sprite support (each sound is separate buffer)
- No object pooling for gem spawning

## Conclusion

The FINK engine has a solid foundation for interactive fiction with minigame integration. The tag-based extension system (FOLEY, MINIGAME, IMAGE, etc.) follows established INK patterns and enables rich content without engine modifications.

The main gaps are in traditional game engine features: persistence, progression systems, and content localization. The minigame integration pattern is well-designed and could serve as a template for the missing features.

**Immediate wins:**
1. Hook up the namespace preprocessor for IMPORT/EXPORT enforcement
2. Add a simple save/load system using existing breadcrumb state
3. Consolidate duplicate module implementations

**Longer term:**
1. Achievement/progression tracking
2. Asset preloading pipeline
3. Animation timeline for cutscenes
