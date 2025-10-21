# Bot Bootstrap Guide - App2 Multi-Engine Player

**READ THIS FIRST when starting a new session on app2/**

This document provides essential context for understanding the Glitchcan App2 architecture, which supports multiple game engines in parallel with runtime discovery.

---

## 🚨 CRITICAL: Nuclear Rebuild (Oct 21, 2025)

**REGRESSION IDENTIFIED AND FIXED**

### What Happened:
App2 was originally created **from scratch** instead of being properly based on inklet/app/. This caused massive feature regression:

**Missing features from day 1:**
- ❌ IMAGE tag support
- ❌ BASEHREF tag support
- ❌ FINK tag support (external story loading)
- ❌ MENU tag support (dynamic dropdown)
- ❌ VIDEO tag support
- ❌ Choice emoji detection
- ❌ Touch gesture handling
- ❌ Layered media resolution
- ❌ Proper UI (title bar, menus, fullscreen)

### The Fix (Nuclear Rebuild):
**Completely rebuilt app2/index.html by:**
1. ✅ Copied ALL inklet/app/ modules (fink-*.js, fink-player.css)
2. ✅ Created new index.html that loads them (iOS compatible - no ES6 modules)
3. ✅ Added MINIGAME tag support on top
4. ✅ Now has FULL feature parity with inklet/app/ PLUS minigames

### Current Architecture (v3):
```
app2/index.html
├── fink-utils.js       ← All inklet/app/ features
├── fink-config.js      ← Configuration
├── fink-sandbox.js     ← FINK loading
├── fink-ink-engine.js  ← IMAGE, BASEHREF, FINK, MENU tags
├── fink-ui.js          ← Full UI with touch, emojis, fullscreen
├── fink-player.js      ← Main coordinator
└── fink-player.css     ← Complete styling
PLUS:
└── Minigame integration (inline script in index.html)
```

### What Works Now (v3):
✅ ALL inklet/app/ features:
- IMAGE tag support
- BASEHREF tag support
- FINK tag support (external story loading)
- MENU tag support (dynamic dropdown)
- VIDEO tag support
- Choice emoji detection
- Touch gesture handling (swipe between choices)
- Layered media resolution
- Story restart
- Bookmark functionality
- Fullscreen support
- Proper title bar with dropdown menu
- Debug console

✅ PLUS App2-specific:
- MINIGAME tag support
- Minigame overlay container
- State sharing (INK ↔ minigames)
- iOS compatible (no ES6 modules)

### Files:
- `index.html` - ✅ **NUCLEAR REBUILD - Use this!**
- `index.html.backup-before-nuke` - Old broken version
- `index-modules.html` - ES6 version (doesn't work on iOS)
- `index-standalone.html` - Old incomplete version

**ALWAYS use index.html - it's now the full-featured iOS-compatible version.**

---

## 📚 Required Reading Order

### 1. **Core Concepts** (Read these FIRST)
- **`/glitchcanary.md`** - Overall project vision, FINK architecture, dual game engine concept
- **`/CLAUDE.md`** - Critical rules (NO HACKPARSING!), development patterns, validation
- **`/app2/README_APP2.md`** - App2 specific architecture, state sharing, minigame integration

### 2. **Working Reference Implementations**
- **`/inklet/app/index.html`** - Production FINK player (modular, stable)
- **`/inklet/app/fink-player.js`** - Main coordination module
- **`/inklet/app/fink-sandbox.js`** - FINK file loading via sandbox
- **`/inklet/app/fink-ink-engine.js`** - Real INK compiler integration
- **`/inklet/gamgam-wc.html`** (lines 1-200) - Web components architecture for dual engines

### 3. **Technical Deep Dives**
- **`/app2/README.md`** - gcfink library structure and testing
- **`/inklet/hamfinkdemo.html`** - Reference for proper INK engine usage
- **INK tag system in gamgam-wc.html** - How MINIGAME tags work in practice

---

## 🎯 App2 Mission Statement

**Build a web player that presents TWO OR MORE game engines to the end user in parallel:**

1. **INK/FINK Narrative Engine** (hypertext, story-driven)
   - Uses ink-full.js compiler
   - Sandbox-based FINK loading
   - IMAGE, MENU, BASEHREF tags

2. **Web Components Game Engine(s)** (prototyped in gamgam-wc.html)
   - Canvas-based minigames (BoulderDash-style, etc.)
   - Runtime discovery via MINIGAME tags in FINK files
   - State sharing between narrative and gameplay

3. **Future: Runtime-Discoverable Engines**
   - Load game engine implementations over network
   - Register new engines at runtime
   - Peer architecture (see PEER_ARCHITECTURE_DESIGN.md if exists)

---

## 🚨 CRITICAL RULES (from CLAUDE.md)

### ABSOLUTELY FORBIDDEN
```
❌ Manual parsing of INK content (regex, string manipulation)
❌ ANY form of "hackparsing" INK syntax
❌ Modifying files outside app2/ without permission
❌ Breaking the real ink-full.js compiler integration
```

### ABSOLUTELY REQUIRED
```
✅ Use real ink-full.js compiler for all INK content
✅ Use sandbox iframe execution for FINK file loading
✅ Make only modest changes in app2/ folder
✅ Test after EVERY change
✅ Read existing code before modifying
```

---

## 🏗️ Architecture Overview

### Current State (app2/)

```
app2/
├── index.html              ← Single-file player (simple demo)
├── index-modules.html      ← Modular version using gcfink library
├── index-standalone.html   ← Standalone variant
├── toc.fink.js            ← Table of contents with MINIGAME demos
├── gcfink/                ← Core FINK/INK utilities library
│   ├── src/
│   │   ├── index.js           ← Main entry point
│   │   └── lib/
│   │       ├── finkExtract.js  ← Extract INK from .fink.js
│   │       ├── inkEngine.js    ← Compile & run INK
│   │       └── utils.js        ← Helper functions
│   └── test/              ← Node-based tests
└── gcui/                  ← UI library (skeleton only)
```

### Target Architecture (Multi-Engine)

```
┌─────────────────────────────────────────┐
│         App2 Entry Point                │
│         (index-modules.html)            │
└───────────┬─────────────────────────────┘
            │
    ┌───────┴────────┐
    │                │
┌───▼────┐      ┌────▼─────┐
│ INK    │      │ Minigame │
│ Engine │◄────►│ Engines  │
└────────┘      └──────────┘
    │                │
    └────────┬───────┘
             │
        State Sharing
     (Variables, Events)
```

---

## 📖 Key Concepts to Understand

### 1. FINK = "FOAFy Ink"

FINK files (.fink.js) are JavaScript wrappers around INK content:

```javascript
oooOO`
-> main_menu

=== main_menu ===
# IMAGE: peaceful_sunset.png
Welcome to the story!

+ [Start] -> beginning
`
```

**NOT text files!** They execute via sandbox iframe:
1. Create iframe with `oooOO` function
2. Inject script tag with FINK URL
3. `oooOO` captures template literal content
4. Return pure INK text to main page
5. Compile with real ink-full.js

### 2. INK Tags Are Legitimate Extensions

```ink
# IMAGE: manor.jpg         ← Display image
# BASEHREF: media/bagend/  ← Set base path
# FINK: other-story.fink.js ← Load external story
# MINIGAME: simple-score   ← Launch minigame
```

These are **official INK extensibility**, not hacks!

### 3. State Sharing Pattern

```ink
=== score_game ===
# MINIGAME: simple-score
# MINIGAME_PASS: player_name, level
# MINIGAME_RECEIVE: score, attempts

+ [Play Game] -> game_launched

=== game_complete ===
You scored: {minigame_score} points!

{minigame_score > 100:
    Excellent!
- else:
    Try again.
}
```

JavaScript side:
```javascript
// Detect MINIGAME tag
if (tags.includes('MINIGAME: simple-score')) {
    launchMinigame('simple-score');
}

// After minigame completes
story.variablesState.minigame_score = 200;
story.variablesState.minigame_attempts = 1;
continueStory();
```

### 4. Runtime Discovery Goal

FINK file loaded over network can specify:
```ink
# MINIGAME_ENGINE: https://example.com/engines/platformer.wc.js
# MINIGAME: custom-platformer
```

App2 would:
1. Detect unknown engine type
2. Fetch engine implementation
3. Register as web component
4. Launch when MINIGAME tag encountered

---

## 🔍 How inklet/app/ Works (Reference)

The production FINK player uses modular architecture:

**Entry:** `inklet/app/index.html`
- Loads CSS: `fink-player.css`
- Loads JS modules:
  - `fink-utils.js` - Helpers, logging
  - `fink-config.js` - Configuration
  - `fink-sandbox.js` - FINK file loading
  - `fink-ink-engine.js` - INK compilation
  - `fink-ui.js` - UI rendering
  - `fink-player.js` - Main coordinator

**Execution Flow:**
1. `FinkPlayer.init()` loads default story
2. `FinkSandbox.loadViaSandbox(url)` extracts FINK content
3. `FinkInkEngine.compileAndRunStory(content)` compiles INK
4. `FinkUI.renderChoices()` displays choices
5. User makes choice → `FinkInkEngine.makeChoice()`
6. Repeat until story ends

**Key Features:**
- Layered media path resolution
- IMAGE tag support
- FINK tag support (external story loading)
- Debug console
- Restart/bookmark (placeholders)

---

## 🎮 How gamgam-wc.html Works (Web Components)

The proof-of-concept for dual engines (44K+ lines):

**Structure:**
```html
<gc-gamgam>                    ← Main coordinator
  <gc-inkblot>                 ← Narrative view (INK engine)
  <gc-minigam-slovib>          ← Minigame view (Canvas game)
</gc-gamgam>
```

**Custom Elements:**
- `GCInkblot` - Story text, action buttons, INK integration
- `GCMinigamSlovib` - BoulderDash-style game (grid, physics, enemies)
- `GCGamgam` - Parent coordinator, event routing

**State Flow:**
1. INK story hits MINIGAME tag
2. `gc-inkblot` dispatches `play-minigame-requested` event
3. `gc-gamgam` switches view to `gc-minigam-slovib`
4. Player plays minigame
5. Minigame dispatches `game-complete` event with results
6. `gc-gamgam` updates INK variables
7. Switch back to `gc-inkblot`, continue story

**Architecture Insight:**
- Each component is self-contained with shadow DOM
- Communication via custom events (bubbling)
- No direct coupling between engines
- Parent coordinates view switching

---

## 🛠️ What App2 Needs to Achieve

### Phase 1: Match inklet/app/ Functionality ✅ (Mostly Done)
- [x] Load FINK files via sandbox
- [x] Compile with real ink-full.js
- [x] Render story text and choices
- [x] Basic MINIGAME tag detection
- [x] Debug console
- [ ] IMAGE tag support (needs testing)
- [ ] FINK tag support (external loading)
- [ ] BASEHREF resolution

### Phase 2: Add Minigame Integration (In Progress)
- [x] MINIGAME tag parsing
- [x] Demo minigames (button-based)
- [ ] Extract real Canvas game from gamgam-wc.html
- [ ] State sharing (INK ↔ Game)
- [ ] Event-based coordination

### Phase 3: Runtime Discovery (Future)
- [ ] Engine registry system
- [ ] Dynamic web component loading
- [ ] MINIGAME_ENGINE tag support
- [ ] Peer architecture implementation

---

## 🧪 Testing Requirements

**Before ANY changes:**
```bash
cd app2
node test-app2.mjs          # Test app2 functionality
node test-baseline.mjs      # Ensure inklet/app unchanged
```

**After changes:**
- Re-run tests
- Manual browser test (http://localhost:8080/app2/)
- Test MINIGAME tag detection
- Verify state sharing works

**Local Server:**
```bash
python -m http.server 8080
# or
npx serve -p 8080
```

---

## 📝 Common Tasks

### Task: Add Support for New MINIGAME Tag Feature

1. **Read relevant code:**
   - `app2/index-modules.html` (current implementation)
   - `inklet/gamgam-wc.html` (reference for tag handling)

2. **Make modest changes:**
   - Add tag detection in story continuation loop
   - Dispatch event or update UI
   - Test immediately

3. **Verify:**
   - Run tests
   - Manual browser check
   - Check debug console for errors

### Task: Extract Canvas Game from gamgam-wc.html

1. **Understand gamgam-wc.html structure:**
   - Read `GCMinigamSlovib` class (lines ~130-1000)
   - Identify dependencies (constants, state, rendering)
   - Note event dispatching pattern

2. **Create standalone web component:**
   - Extract to new file: `app2/components/gc-minigam-slovib.js`
   - Keep as ES6 module
   - Preserve shadow DOM architecture

3. **Integrate into app2:**
   - Import in index-modules.html
   - Register custom element
   - Wire up events (game-complete, etc.)
   - Update MINIGAME tag handler

4. **Test state sharing:**
   - Create FINK story with MINIGAME tag
   - Verify variables pass to game
   - Verify results return to INK

---

## ⚠️ Common Pitfalls

### Pitfall 1: Trying to Parse FINK with Regex
```javascript
// ❌ WRONG - Manual parsing
const inkContent = finkJs.match(/oooOO`(.*?)`/s)[1];

// ✅ RIGHT - Sandbox execution
const inkContent = await FinkSandbox.loadViaSandbox(url);
```

### Pitfall 2: Modifying Outside app2/
```javascript
// ❌ WRONG - Changing production code
// editing /inklet/app/fink-player.js

// ✅ RIGHT - Work in app2/ only
// editing /app2/index-modules.html
```

### Pitfall 3: Ignoring Tests
```bash
# ❌ WRONG - Making changes without testing
nano index-modules.html
git commit -m "added feature"

# ✅ RIGHT - Test first
nano index-modules.html
node test-app2.mjs
# [fix errors if any]
git commit -m "added feature (tests pass)"
```

---

## 🔗 Quick Reference Links

**Working Examples:**
- Production FINK player: http://localhost:8080/inklet/app/
- Dual engine prototype: http://localhost:8080/inklet/gamgam-wc.html
- App2 experimental: http://localhost:8080/app2/

**Key Files:**
- `/glitchcanary.md` - Project vision
- `/CLAUDE.md` - Development rules
- `/app2/README_APP2.md` - App2 architecture
- `/app2/README.md` - gcfink library docs
- `/inklet/app/fink-player.js` - Reference implementation

**External Docs:**
- INK language: https://github.com/inkle/ink/blob/master/Documentation/
- InkJS: https://github.com/y-lohse/inkjs
- Web Components: https://developer.mozilla.org/en-US/docs/Web/API/Web_components

---

## 💡 Tips for New Sessions

1. **Always read this file first** - It saves hours of confusion
2. **Check git status** - See what was being worked on
3. **Read test files** - They show expected behavior
4. **Run tests immediately** - Establish baseline
5. **Make ONE small change** - Test before proceeding
6. **Ask questions** - Don't assume, verify with user

---

## 🎓 Learning Path

**If you're new to this codebase:**

1. **Day 1:** Read glitchcanary.md, CLAUDE.md
2. **Day 2:** Run inklet/app/, understand modular architecture
3. **Day 3:** Run gamgam-wc.html, understand web components
4. **Day 4:** Study app2/index-modules.html, compare with inklet/app/
5. **Day 5:** Make small test change, run tests, verify
6. **Day 6:** Extract first game component from gamgam-wc
7. **Day 7:** Implement full state sharing

**You're ready to contribute when you can:**
- [ ] Explain FINK vs INK
- [ ] Describe sandbox loading process
- [ ] Explain why we DON'T use regex parsing
- [ ] Wire up a MINIGAME tag to launch a demo
- [ ] Update INK variables from minigame results

---

## 📞 Getting Help

**If stuck:**
1. Re-read relevant sections above
2. Check debug console in browser
3. Run tests to see specific failures
4. Read source code comments
5. Ask user for clarification

**Questions to ask user:**
- "Should I make changes in index.html or index-modules.html?"
- "Do you want me to extract the Canvas game now, or focus on X?"
- "I see three ways to approach this - which aligns with your vision?"

---

## 🏁 Current Status (as of last update)

**What Works:**
- ✅ Basic FINK loading and compilation
- ✅ Story rendering with choices
- ✅ MINIGAME tag detection
- ✅ Demo button-based minigames
- ✅ State variables initialized
- ✅ Debug console

**What Needs Work:**
- ⚠️ Real Canvas minigame extraction
- ⚠️ IMAGE tag support (may need testing)
- ⚠️ FINK tag support (external story loading)
- ⚠️ Event-based coordination architecture
- ⚠️ Runtime engine discovery

**Next Steps:**
1. Verify app2 works same as inklet/app for basic stories
2. Extract gc-minigam-slovib from gamgam-wc.html
3. Wire up full state sharing
4. Test end-to-end gameplay

---

**Last Updated:** 2025-10-21
**Version:** 1.0
**Maintainer:** Bot session initialization

**Remember: Read this FIRST, make MODEST changes, TEST constantly, stay in app2/!**
