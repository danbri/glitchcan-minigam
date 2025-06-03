# CLAUDE.md - Guide for 🐥 Minigames

## 🚨 CRITICAL RULE: NO HACKPARSING 🚨
**ABSOLUTELY FORBIDDEN:** Manual parsing, regex parsing, or any string manipulation of INK content
**ONLY ALLOWED:** Real ink-full.js compiler and Story API
**VIOLATION COST:** Real money wasted, development time lost, 2am debugging sessions
**ENFORCEMENT:** Any hackparsing implementation must be immediately deleted and rebuilt with real INK engine
**EXCEPTION:** Only if User explicitly demands hackparsing for specific use case
**REMINDER:** We spent an entire evening until 2am purging hackparsing - NEVER AGAIN

## Project Overview
Browser-based minigames collection with WebGL fluid dynamics. Mobile/touch-focused interfaces.

## FINK Player v5 - MAJOR MILESTONE ACHIEVED ✅
**Status: Production Ready with Real INK Engine**

### What Was Accomplished (June 2025):
- ✅ **Replaced manual INK parsing with real ink-full.js compiler** 
- ✅ **Working external FINK story loading via secure iframe sandbox**
- ✅ **Modular JavaScript architecture** (6 separate modules for maintainability)
- ✅ **Successful Hampstead adventure playthrough** with score tracking & variables
- ✅ **Table of contents navigation system** working end-to-end
- ✅ **Choice text labels visible and functional** (no more emoji-only choices)
- ✅ **GitHub Pages deployment** at https://danbri.github.io/glitchcan-minigam/inklet/inklet5.html

### Critical Files:
- `inklet/inklet5.html` - Modular FINK Player (PRODUCTION)
- `inklet/fink-*.js` - Modular JavaScript components
- `inklet/toc-simple.fink.js` - Working table of contents
- `inklet/hampstead1.fink.js` - Full adventure tested with real INK engine

### LESSON LEARNED - UI vs Engine Trade-off:
While achieving perfect INK engine functionality, we lost visual polish from inklet2.html:
- **Lost**: Vibrant colors, larger emojis, smooth animations, floating restart button
- **Gained**: Real INK parsing, external loading, modular architecture, debug tools

### Next Steps - UI Enhancement Plan:
1. **PRIORITY**: Restore visual polish WITHOUT breaking INK engine
2. **APPROACH**: Incremental changes, test after each modification
3. **SAFETY**: Keep inklet5.html as backup, create inklet6.html for experiments

## CRITICAL ADMONISHMENTS FOR FUTURE DEVELOPMENT

### ⚠️ NEVER AGAIN:
1. **DO NOT break the real INK engine** - inklet5.html uses ink-full.js compiler, NOT manual parsing
2. **DO NOT use regex to parse INK syntax** - let the real compiler handle it
3. **DO NOT modify the modular JavaScript architecture** without extreme care
4. **DO NOT change external FINK loading system** - it works via secure iframe sandbox
5. **DO NOT assume UI changes are "safe"** - test Hampstead playthrough after EVERY change

### ✅ SAFE UI RESTORATION STRATEGY:
**Phase 1: Colors & Sizes (Low Risk)**
- Copy vibrant color scheme from inklet2.html: `--choice-left: #f43f5e` etc.
- Increase emoji size: `font-size: 4rem` (from 2.5rem)
- Increase choice height: `--choice-height: 25vh` (from 18vh)
- **Test**: Full Hampstead playthrough after each change

**Phase 2: Animations (Medium Risk)**  
- Add floating restart button with `@keyframes float`
- Enhance loading animation with bouncing dots
- Improve expanding choice animation
- **Test**: Choice clicking and navigation after each change

**Phase 3: Polish (Higher Risk)**
- Add fullscreen CSS support
- Enhance touch gesture handling
- Mobile-specific improvements
- **Test**: Cross-device compatibility

### 🛡️ MANDATORY TESTING PROTOCOL:
After ANY UI change, verify:
1. TOC loads and displays properly
2. "Games" → "Hampstead" → "Begin Urban Adventure" works
3. Hampstead adventure plays through completion (8/8 score)
4. Choice text labels are visible (not just emojis)
5. External FINK loading triggers correctly
6. Debug console shows no JavaScript errors

### 📋 REGRESSION PREVENTION:
- **Keep inklet5.html untouched** as known-good baseline
- **Work incrementally** on inklet6.html
- **Commit frequently** with detailed descriptions
- **Test on both local and GitHub Pages** before proceeding

## FINK Validation Strategy

### Command-line Validation Tool
**Usage:** `node validate-fink.js my-episode.fink.js`

**Features:**
- Extracts INK content from current version and last committed git version
- Compiles both versions using real ink-full.js to catch syntax errors
- Reports diff on key metrics (knot count, choice count, tag usage)
- Identifies regressions where compilation breaks
- For new files: reports basic stats only
- Validates proper FINK structure and INK tag syntax

### Legacy Pseudo-Ink Problem
**Issue:** Many FINK files contain AI-generated "Pseudo-Ink" that looks like INK but doesn't compile with real ink-full.js

**Solution Path:**
1. Use validation tool to identify problematic files
2. Gradually rebuild legacy files with proper INK syntax
3. Follow "commit if it looks ok" validation workflow
4. Maintain compatibility with real INK engine throughout

**Priority:** Focus on actively used FINK files first (TOC, Hampstead, Jungle)

## FINK Validation & Audit System - COMPLETE IMPLEMENTATION

### ✅ Phase 1: COMPLETED - Basic Validation
**Tools:** `checkfink.mjs`, `validate-fink-puppeteer.mjs`, `validate-fink.html`
- ✅ Unified validator supporting .ink, .json, .fink.js files
- ✅ Puppeteer-based browser execution (no regex hackery)
- ✅ Repository scanning with --scan flag
- ✅ Real ink-full.js compilation and validation
- ✅ Exit codes for CI/CD integration

### 🚧 Phase 2: IN PROGRESS - Rich Audit Dashboard
**Mission:** Create non-technical HTML dashboard at https://danbri.github.io/glitchcan-minigam/fink-audit/

#### Step 1: Enhance checkfink.mjs with Rich Metrics
Add `--report` flag to generate detailed analysis:
- **Story Structure**: knot count, choice count, external flow references
- **Content Metrics**: word count, character count, estimated reading time
- **INK Features**: variables used, tags present, conditional logic complexity
- **FINK Extensions**: IMAGE tags, MENU tags, BASEHREF usage
- **Quality Metrics**: unreachable knots, dead ends, branching factor
- **Output**: Structured JSON data for dashboard consumption

#### Step 2: Create fink-audit/ Folder Structure
```
fink-audit/
├── index.html          ← Main dashboard with summary cards
├── detailed.html       ← Per-file detailed breakdowns
├── assets/
│   ├── dashboard.css   ← Mobile-friendly styling
│   └── charts.js       ← Visualization library integration
└── data/
    └── audit-data.json ← Generated metrics from checkfink.mjs
```

#### Step 3: HTML Dashboard Features
- **Summary Cards**: Total files, pass/fail counts, overall health score
- **File Status Grid**: Visual indicators for each FINK file (✅❌⚠️)
- **Metrics Tables**: Sortable data with knot counts, word counts, complexity
- **Trend Tracking**: Historical data comparison if implemented
- **Mobile-Responsive**: Non-technical audience accessibility
- **Direct Links**: Jump to problematic files for debugging

#### Step 4: GitHub Action Automation
```yaml
name: FINK Audit Dashboard
on: [push, pull_request, schedule: daily]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - checkout code
      - run FINK audit with rich metrics
      - generate HTML dashboard from JSON
      - commit dashboard to fink-audit/ folder
      - deploy via GitHub Pages
```

#### Step 5: Integration & Documentation
- Add link from main site index.html to audit dashboard
- Update README with audit system explanation
- Add CLAUDE.md section on dashboard maintenance

### Known Issues to Address
- **3 Broken Files Identified**: bagend1.fink.js, test-variables.fink.js, toc.fink.js
- **Status**: TO BE DISCUSSED (separate from dashboard implementation)

### Technical Requirements (Maintained)
- **MUST use real ink-full.js** compiler (no regex parsing)
- **MUST use Puppeteer browser execution** for FINK files
- **MUST generate mobile-friendly HTML** for non-technical users
- **MUST integrate with existing GitHub Pages** setup without disruption
- **MUST provide actionable insights** for content creators

### Success Criteria
1. Dashboard accessible at https://danbri.github.io/glitchcan-minigam/fink-audit/
2. Automatic updates via GitHub Actions on repo changes
3. Clear visual indicators of FINK file health and metrics
4. Non-technical users can assess content quality at a glance
5. Zero disruption to existing GitHub Pages site

## FINK Player v6 TODO List

### High Priority Issues
- **Top menus don't work yet** - Navigation items in story dropdown need implementation
- **Reset story functionality** - Should provide way back to top-level TOC menus
- **Default image needs updating** - Replace placeholder village image with appropriate default
- **Hobbit adventure needs fixing/validating** - Currently fails to load, requires INK syntax fixes
- **Ukrainian tutorial needs fixing/validating** - Verify proper INK compilation and functionality

### Content Issues
- **Writing course mention in menus** - Remove or implement actual content (currently vapourware)
- **Other vapourware in menus** - Audit all menu items and remove non-functional placeholders
- **Content validation pass** - Use FINK validator on all menu items to identify broken stories

### UI/UX Improvements
- **Choices section eats vertical space needlessly** - Optimize layout to reclaim screen real estate
- **Debug button needs redesign** - Should be real tab interface with copy-pastable output
- **Better responsive design** - Ensure optimal use of available screen space

### Major Features
- **In-app history system** - Implement navigation history so back/forward buttons work without destructive page reload
- **State preservation** - Maintain story progress and position across navigation
- **Deep linking** - Allow URLs to reference specific story positions

### Testing Requirements
- **Cross-device compatibility** - Test on mobile, tablet, desktop
- **Performance optimization** - Ensure smooth operation on lower-end devices
- **Accessibility improvements** - Screen reader support, keyboard navigation

## Development Commands (Suggested)
These are suggestions - you may prefer to run servers in your own tab/process:
- **Run local server:** `python -m http.server 8080` (or `npx serve -p 8080`)
- **Open game in browser:** http://localhost:8080/thumbwar/thumbwar.html
- **Hard reload (bust cache):** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- **Validate HTML:** `npx html-validate **/*.html`
- **JS Linting:** `npx eslint **/*.html --ext .html`
- **Spectro-specific commands:** `cd spectro && npm install && npm start` (runs http-server)
- maybe useful?: imagemagick libimage-exiftool-perl webp ffmpeg

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

## FINK Interactive Fiction System - CRITICAL IMPLEMENTATION NOTES

### STOP TRYING TO PARSE oooOO TEMPLATE LITERALS MANUALLY! 
- **oooOO is a JAVASCRIPT FUNCTION** (tagged template literal)
- **NEVER parse it with regex** - that breaks the entire JavaScript execution
- **USE THE SANDBOX APPROACH** - inject script tags into safe iframe to execute the .fink.js files

### FINK Script Injection Technique (JSONP-like with Template Literals)
- **FINK uses script tags injected into iframe** to fetch content - JSONP-like technique with tagged template literal syntax
- **DO NOT wrap oooOO in function calls** - script injection makes function wrapping pointless
- **Direct template literal execution** - oooOO`` calls execute directly when script loads
- **Content extraction via callback** - sandbox iframe provides oooOO function to capture content

### Working Implementation Reference
- **hamfinkdemo.html** (or similar in inklet/ folder) shows the CORRECT approach
- Uses iframe sandbox with script injection to safely execute .fink.js files
- The oooOO function captures content via JavaScript execution, not text parsing
- This is the ONLY way to properly extract FINK content from .fink.js files

### CRITICAL UNDERSTANDING: INK Tags Are LEGITIMATE Extensions
**INK was designed for extensibility via tags** - this is the official mechanism, not a hack:
- `MENU:`, `IMAGE:`, `BASEHREF:` are proper INK tags, similar to Unity/Unreal integrations
- Tags can be at story level or knot level to integrate with game engines
- See /glitchcanary.md for full explanation and /inklet/gamgam-wc.html for 2-engine prototype
- INK's extensibility via tags is used by Inkle Studios and the broader community

### What Needs to be Done (HIGH PRIORITY)
1. **Use sandbox execution**: Load .fink.js files via iframe script injection (NOT regex parsing)
2. **Use real INK compiler**: Compile extracted FINK content with ink-full.js
3. **Process conditional syntax**: Use INK runtime to handle `{variable: text}` properly
4. **Keep tag system**: MENU:, IMAGE:, BASEHREF: are legitimate INK extensions, not FINK hacks

### Files Affected
- Current State: Manual parsing still used despite having working sandbox examples
- **SYMPTOM**: Conditional INK markup (`{variable: text}`) appears as visible text
- **IMPACT**: Stories display broken syntax instead of proper conditional content

### Technical Requirements
- ink-full.js CDN: https://cdn.jsdelivr.net/npm/inkjs@2.2.3/dist/ink-full.js (already loaded)
- Sandbox iframe execution to extract content from .fink.js files
- Compile entire FINK content: `new inkjs.Compiler(finkContent).Compile()`
- Use INK Story runtime: `new inkjs.Story(compiledStory)` for conditional processing

### STOP TRYING TO START HTTP SERVERS
- User always arranges their own HTTP server setup
- Don't run `python -m http.server` or similar commands
- Focus on the code implementation, not server management

## FINK JavaScript Structure - READ glitchcanary.md FOR DETAILS

**CRITICAL**: FINK .js files are NOT standard JavaScript modules!

- **Read glitchcanary.md** for full explanation of FINK architecture and syntax
- .fink.js files contain `oooOO`...`` template literal calls (not wrapped in functions)
- Sandbox iframe provides the `oooOO` function and executes the .js via script injection
- Content extraction works via JavaScript execution, NOT text parsing
- INK tags like `# IMAGE:`, `# FINK:`, `# BASEHREF:` are legitimate extensions
