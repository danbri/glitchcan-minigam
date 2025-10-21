# App2 - FINK + Minigame Integration (Experimental)

**Status:** Bleeding Edge / Experimental
**Entry Point:** `/app2/index.html`
**TOC:** `/app2/toc.fink.js`

---

## What is App2?

App2 is an experimental entry point that extends the FINK player with **state-sharing capabilities between INK narrative and JavaScript minigames**, building toward the peer architecture proposed in `PEER_ARCHITECTURE_DESIGN.md`.

This completes the work started in `gamgam-wc.html` by creating a modular, testable implementation using the `gcfink` library.

---

## Key Features

### 1. Minigame State Sharing
- **INK variables → Minigame:** Games receive INK state as initial configuration
- **Minigame → INK variables:** Game results update INK story variables
- **Two-way flow:** Enables narrative branches based on gameplay outcomes

### 2. Event-Based Architecture
- Custom events for component coordination
- Decoupled minigame components
- Easy to add new minigames without modifying core code

### 3. Built on gcfink Library
- Uses `extractFinkFromJsSource()` for FINK content extraction
- Uses `compileInk()` with real inkjs compiler
- Modular, testable architecture

---

## Architecture

```
app2/index.html (Entry Point)
│
├── Uses: gcfink/src/index.js
│   ├── extractFinkFromJsSource() - Extract INK from .fink.js
│   ├── compileInk() - Compile INK with inkjs
│   └── utils - Utility functions
│
├── Loads: app2/toc.fink.js (Content)
│   ├── Main menu
│   ├── Minigame demos
│   ├── Classic episodes
│   └── Help documentation
│
└── Coordinates: Minigame Components
    ├── simple-score (demo)
    ├── inventory-game (demo)
    └── Future: Canvas-based games
```

---

## State Sharing Flow

### Example: Score Game

**1. INK Story Defines Variables:**
```ink
=== simple_score_demo ===
Your current score: {minigame_score}

# MINIGAME: simple-score
# MINIGAME_PASS: player_name
# MINIGAME_RECEIVE: score, attempts

+ [Play Game] -> launch_score_game
```

**2. App Detects MINIGAME Tag:**
```javascript
const minigameTag = tags.find(t => t.startsWith('MINIGAME:'));
if (minigameTag) {
    const gameName = minigameTag.split(':')[1].trim();
    launchMinigame(gameName);
}
```

**3. Minigame Executes:**
```javascript
function launchMinigame(gameName) {
    // Show minigame UI
    minigameContainer.classList.add('active');

    // Player plays...
    // On completion:
    completeMinigame({ score: 150, attempts: 1 });
}
```

**4. Results Update INK:**
```javascript
function completeMinigame(results) {
    // Update INK variables
    currentStory.variablesState.minigame_score = results.score;
    currentStory.variablesState.minigame_attempts = results.attempts;

    // Hide minigame, continue story
    minigameContainer.classList.remove('active');
    continueStory();
}
```

**5. Story Continues with New State:**
```ink
=== score_game_complete ===
You scored: {minigame_score} points!

{minigame_score > 100:
    Excellent! You unlocked a bonus path.
    + [Bonus Area] -> bonus_path
- else:
    Try again for a higher score.
    + [Retry] -> launch_score_game
}
```

---

## Differences from inklet/app

| Feature | inklet/app | app2 |
|---------|-----------|------|
| **Purpose** | Production FINK player | Experimental minigame integration |
| **Architecture** | Standalone modular JS | gcfink library + modules |
| **Minigames** | None | State-sharing demos |
| **Entry Point** | inklet/app/index.html | app2/index.html |
| **TOC** | ../inklet/toc.fink.js | app2/toc.fink.js |
| **Status** | Stable | Bleeding edge |

**Key Insight:** app2 does NOT replace inklet/app. They coexist independently.

---

## Testing

### Run Tests
```bash
cd app2

# Test app2 functionality
node test-app2.mjs

# Verify existing app unchanged
node test-baseline.mjs
```

### Test Coverage
- FINK extraction from app2/toc.fink.js ✅
- INK compilation with gcfink ✅
- MINIGAME tag detection ✅
- State variable handling ✅
- Minigame container rendering ✅
- Existing inklet/app unchanged ✅

---

## Usage

### Local Development
```bash
# From project root
python -m http.server 8080

# Open in browser
http://localhost:8080/app2/
```

### GitHub Pages (when deployed)
```
https://danbri.github.io/glitchcan-minigam/app2/
```

---

## Demo Content (app2/toc.fink.js)

### Minigame Demos
1. **Simple Score Game** - Demonstrates score passing
2. **Inventory Game** - Demonstrates list/boolean state
3. **GamGam Integration** - Links to full gamgam-wc.html

### Classic Episodes
- Hampstead (from main app)
- Bagend (from main app)

Demonstrates that app2 can load existing FINK content without breaking it.

---

## Future Enhancements (Toward Peer Architecture)

### Phase 1: Current State ✅
- [x] gcfink library for FINK/INK utilities
- [x] Basic minigame state sharing (demo)
- [x] Event-based coordination
- [x] Separate entry point (app2/index.html)

### Phase 2: Canvas Minigames (Next)
- [ ] Extract minigame from gamgam-wc.html
- [ ] Create reusable Canvas component
- [ ] Real gameplay with state sharing
- [ ] Multiple minigame types

### Phase 3: Service Layer
- [ ] AuthService (login, identity)
- [ ] StorageService (save games, cloud sync)
- [ ] NetworkService (multiplayer, leaderboards)
- [ ] EventBusService (enhanced pub/sub)

### Phase 4: Peer Architecture
- [ ] Component registry
- [ ] Minimal app shell coordinator
- [ ] Peer components (INK, Pacman, Space Invaders)
- [ ] Shared infrastructure
- [ ] Two-way navigation (INK ↔ Games)

---

## File Structure

```
app2/
├── index.html              # Entry point with minigame integration
├── toc.fink.js             # Content TOC with minigame demos
├── README_APP2.md          # This file
├── test-app2.mjs           # App2 functionality tests
├── test-baseline.mjs       # Verify existing app unchanged
├── gcfink/                 # Core library
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   └── lib/
│   │       ├── finkExtract.js
│   │       ├── inkEngine.js
│   │       └── utils.js
│   └── test/
│       ├── run.js
│       ├── finkExtract.test.js
│       └── inkEngine.test.js
└── gcui/                   # UI skeleton (future)
    ├── package.json
    └── src/
        └── index.js
```

---

## Known Limitations

### Current Limitations
1. **Demo minigames only** - Button-based simulations, not real Canvas games
2. **No persistence** - State not saved between sessions
3. **No multiplayer** - NetworkService not implemented
4. **Limited testing** - Browser testing needed (only Node tests currently)

### Not Yet Implemented
- Canvas-based retro games (planned)
- Achievement system (designed in PEER_ARCHITECTURE_DESIGN.md)
- Cloud save sync (designed in PEER_ARCHITECTURE_DESIGN.md)
- Leaderboards (designed in PEER_ARCHITECTURE_DESIGN.md)
- Multiplayer rooms (designed in PEER_ARCHITECTURE_DESIGN.md)

---

## Relationship to Other Work

### gamgam-wc.html
- **Status:** Proof of concept (44,739 lines monolithic file)
- **Achievement:** Proved state sharing works
- **Problem:** Hard to test, hard to extend
- **Solution:** app2 extracts patterns into modular architecture

### inklet/app
- **Status:** Production stable
- **Achievement:** Clean FINK player with modular JS
- **Limitation:** No minigame integration
- **Solution:** app2 extends without breaking

### PEER_ARCHITECTURE_DESIGN.md
- **Status:** Architectural proposal
- **Achievement:** Designed service layer, peer components
- **Limitation:** Not implemented
- **Solution:** app2 is first step toward implementation

---

## Contributing

### Adding a New Minigame

**1. Create FINK content with MINIGAME tag:**
```ink
=== my_game_demo ===
# MINIGAME: my-game
# MINIGAME_PASS: player_level
# MINIGAME_RECEIVE: score, items_collected

+ [Play My Game] -> launch_my_game
```

**2. Add minigame handler in index.html:**
```javascript
if (gameName === 'my-game') {
    minigameInstructions.textContent = 'Play my game!';

    const playButton = createMinigameButton('Start', () => {
        // Game logic here
        completeMinigame({ score: 100, items_collected: 5 });
    });

    minigameControls.appendChild(playButton);
}
```

**3. Test:**
```bash
node test-app2.mjs
```

---

## Debugging

### Enable Debug Console
Click the **DEBUG** button in the bottom-right corner or:
```javascript
CONFIG.DEBUG_ENABLED = true
```

### Debug Output Shows:
- FINK file loading progress
- INK extraction details
- Story compilation results
- Choice selections
- MINIGAME tag detection
- Variable state changes

---

## Comparison with Production App

### When to Use inklet/app
- Stable, production-ready FINK player
- No minigame integration needed
- Classic interactive fiction
- Deployed to https://danbri.github.io/glitchcan-minigam/inklet/app/

### When to Use app2
- Experimenting with minigame integration
- Testing state-sharing patterns
- Developing toward peer architecture
- Bleeding-edge features
- Local development only (not yet deployed)

---

## Success Criteria

### ✅ Completed
- [x] Separate entry point (app2/index.html)
- [x] Uses gcfink library for extraction/compilation
- [x] Minigame state-sharing demo (button-based)
- [x] Existing inklet/app unchanged
- [x] Tests pass (Node environment)
- [x] Event-based minigame coordination
- [x] Clear documentation

### 🚧 In Progress
- [ ] Browser-based testing (Playwright)
- [ ] Canvas minigame extraction from gamgam-wc.html
- [ ] Real gameplay with state sharing

### 📝 Planned
- [ ] Service layer implementation
- [ ] Peer architecture transition
- [ ] GitHub Pages deployment
- [ ] Cross-device testing

---

## Links

- **Current Production:** https://danbri.github.io/glitchcan-minigam/inklet/app/
- **GameGam Proof of Concept:** https://danbri.github.io/glitchcan-minigam/inklet/gamgam-wc.html
- **Peer Architecture Design:** /PEER_ARCHITECTURE_DESIGN.md
- **INK Integration Status:** /INK_INTEGRATION_STATUS.md
- **Main README:** /README.md

---

## Credits

Built on:
- **InkJS** (https://github.com/y-lohse/inkjs) - INK compiler and runtime
- **Inkle's INK** (https://www.inklestudios.com/ink/) - Narrative scripting language
- **gcfink library** - FINK extraction and INK compilation utilities
- **gamgam-wc.html** - Proof of concept for state sharing

---

**Last Updated:** 2025-10-20
**Status:** Experimental / Ready for Testing
**Next Milestone:** Canvas minigame extraction and integration
