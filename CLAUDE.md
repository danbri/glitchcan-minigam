# CLAUDE.md - Guide for 🐥 Minigames

## Project Overview
Browser-based minigames collection with WebGL fluid dynamics. Mobile/touch-focused interfaces.

## Development Commands
- **Run local server:** `python -m http.server 8000` (or `npx serve`)
- **Open game in browser:** http://localhost:8000/glitchcan-minigam/thumbwar/thumbwar.html
- **Validate HTML:** `npx html-validate glitchcan-minigam/**/*.html`
- **JS Linting:** `npx eslint glitchcan-minigam/**/*.html --ext .html`

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