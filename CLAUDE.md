# CLAUDE.md - Guide for 🐥 Minigames

## Project Overview
Browser-based minigames collection with WebGL fluid dynamics. Mobile/touch-focused interfaces.

## Development Commands
- **Run local server:** `python -m http.server 8000` (or `npx serve`)
- **Open game in browser:** http://localhost:8000/glitchcan-minigam/thumbwar/thumbwar.html
- **Hard reload (bust cache):** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- **Validate HTML:** `npx html-validate glitchcan-minigam/**/*.html`
- **JS Linting:** `npx eslint glitchcan-minigam/**/*.html --ext .html`
- **Spectro-specific commands:** `cd spectro && npm install && npm start` (runs http-server)

## Code Style
- **HTML:** Semantic elements, accessibility attributes, responsive viewport meta
- **CSS:** Mobile-first, clean transitions, em/rem units preferred 
- **JS:** ES6+, classes for encapsulation, no global variables
- **Shaders:** Well-commented GLSL with parameters clearly defined
- **Error handling:** Graceful fallbacks for unsupported features
- **Naming:** camelCase for variables/functions, descriptive names, consistent prefixes

## Project Structure
- Each minigame in its own subdirectory with self-contained assets
- Common assets/styles shared between games go in root directory

## GitHub Workflow
- Simplified workflow: no automatic file modifications
- All changes to index.html and game descriptions must be done manually
- Workflow only deploys to GitHub Pages without modifying content

## Adding New Games
- Create a new directory for your game (e.g., `newgame/`)
- Add your HTML file with game content (e.g., `newgame/newgame.html`)
- To add to the landing page, manually edit index.html:
  1. Copy an existing game container div structure
  2. Update title, description, device info, and play instructions
  3. Update href links to point to your new game
  4. Update GitHub source links to point to your new game files

## Special Effects
- Landing page has a duck emoji (🐥) with two animations:
  1. Continuous heartbeat pulse animation (2.5s cycle)
  2. Random glitch animation every 10s (brief visual distortion)
- These are controlled via CSS animations in the index.html header

## TokiTokiPona App Development Priorities
1. Identify appropriate emoji for all Toki Pona dictionary entries
2. Ensure dictionary integration works correctly for all words
3. Future enhancements (lower priority):
   - Add filtering by part of speech
   - Create different learning modes
   - Implement progress tracking
   - Add pronunciation guides
   - Create customizable study lists

## GitHub Workflow Requirements
- GitHub Actions workflow requires modern action versions
- Checkout action: v4 (not v3)
- Setup-node action: v4 with Node 20+ (not v3/Node 16)
- Configure-pages action: v4 (not v3)
- Upload-pages-artifact action: v3 (deprecated v1)
- Deploy-pages action: v4 (not v1)

## Spectro Development Notes
- Retro ZX Spectrum style platformer inspired by Jet Set Willy
- Currently has 4 rooms to explore
- **Known issues:**
  - Collision detection needs improvement for guardians
  - Jumping functionality not fully reliable
  - ESC key handling in menus requires fixing
- When debugging, check browser console for detailed output about:
  - Room transitions (`Player transition:...`)
  - Collision detection (`Deadly collision with:...`)
  - Player deaths (`PLAYER DEATH:...`)
  - Jumping state (`Jump key pressed:...`)

## GridLuck Development State (v1.3.0)
### Current Session Progress:
- **COMPLETED**: Treasure hunting system with rarity tiers and special effects
- **COMPLETED**: Key-lock system for unlocking special areas with colored keys
- **COMPLETED**: Collectible synergies that grant powerful temporary abilities
- **COMPLETED**: Progression system with levels, XP, achievements, persistent upgrades
- **COMPLETED**: Enhanced UI showing level, XP progress, active effects, synergies
- **COMPLETED**: 5x5 zone grid world system replacing infinite wraparound
- **COMPLETED**: TV zone with peaceful ghost behavior and expanded ghost house
- **COMPLETED**: Systematic zone exit system for proper navigation
- **COMPLETED**: Increased treasure spawn density (67% more treasures)

### Recent Fixes (v1.3.0):
- **FIXED**: Speed calculation bug (player moving too fast)
- **FIXED**: Zone boundary rendering - nothing displays outside 5x5 world grid
- **FIXED**: Zone navigation bugs (can't go west, broken north-south movement)
- **FIXED**: Black walls appearing in neighboring zones
- **FIXED**: Apple explosion effects added (matching cherry behavior)
- **FIXED**: TV zone ghost house made bigger for better visibility
- **FIXED**: Complete peaceful ghost behavior in TV zone (including frenzied ghosts)

### Remaining Tasks:
- **PENDING**: Create special zones requiring keys/items to access
- **PENDING**: Allow combining items for special effects

### Technical Notes:
- Game URL: http://localhost:8080/thumbwar/gridluck.html
- Version display: v1.3.0 in top-left UI
- 5x5 zone grid system with proper boundary enforcement
- TV zone (southwest corner) features peaceful ghosts and fruit trails
- Audio issues fixed: replaced 'noise' oscillator with 'sawtooth'
- Context binding fixed: gameLoop.bind(this) prevents undefined errors

## FINK Interactive Fiction System Status

### Current State (CRITICAL ISSUE)
- **PROBLEM**: Still using manual parsing instead of real INK engine despite promises
- **SYMPTOM**: Conditional INK markup (`{variable: text}`) appears as visible text in stories
- **IMPACT**: Stories display broken syntax instead of proper conditional content

### CRITICAL UNDERSTANDING: INK Tags Are LEGITIMATE Extensions
**INK was designed for extensibility via tags** - this is the official mechanism, not a hack:
- `MENU:`, `IMAGE:`, `BASEHREF:` are proper INK tags, similar to Unity/Unreal integrations
- Tags can be at story level or knot level to integrate with game engines
- See /glitchcanary.md for full explanation and /inklet/gamgam-wc.html for 2-engine prototype
- INK's extensibility via tags is used by Inkle Studios and the broader community

### What Needs to be Done (HIGH PRIORITY)
1. **Use real INK compiler**: Compile FINK content with all tags intact using ink-full.js
2. **Process conditional syntax**: Use INK runtime to handle `{variable: text}` properly
3. **Keep tag system**: MENU:, IMAGE:, BASEHREF: are legitimate INK extensions, not FINK hacks
4. **Enable INK engine**: Currently loads ink-full.js but ignores it in favor of manual parsing

### Files Affected
- `inklet3.html`: Lines 1509-1552 contain INK extraction logic but it's bypassed
- All .fink.js files contain proper INK syntax with extension tags
- Manual parser shows raw conditional syntax instead of processing it

### Technical Requirements
- ink-full.js CDN: https://cdn.jsdelivr.net/npm/inkjs@2.2.3/dist/ink-full.js (already loaded)
- Compile entire FINK content including tags: `new inkjs.Compiler(finkContent).Compile()`
- Use INK Story runtime: `new inkjs.Story(compiledStory)` for conditional processing
- Process tags separately after compilation for MENU:, IMAGE:, BASEHREF: integration

### Working Example for Reference
**PERFECT IMPLEMENTATION**: See [hamfinkdemo.html](inklet/hamfinkdemo.html) for working INK engine integration
- Uses real `inkjs.Compiler()` and `story.Continue()` properly  
- Handles conditional syntax like `{variable: text}` correctly
- Demonstrates proper FINK loading with sandbox pattern
- Shows how to merge external FINK content with local INK source

### Implementation Priority
**URGENT**: Users see broken syntax in stories. This breaks immersion completely.
**NEXT SESSION**: Must implement real INK compilation or disable conditional content entirely.