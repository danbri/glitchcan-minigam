# GitHub Copilot Instructions for 🐥 Minigames

**ALWAYS follow these instructions first and only search for additional context if the information here is incomplete or found to be in error.**

## Project Overview
This is a collection of experimental browser-based minigames and interactive fiction served via GitHub Pages. No complex build processes - all games run directly in the browser using vanilla HTML, CSS, and JavaScript.

## Working Effectively

### Quick Start Development
- **Start local server**: `python3 -m http.server 8080` (starts instantly, <1 second)
- **Open main page**: http://localhost:8080/
- **Test changes**: Hard reload with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

### Core Validation Commands (All Fast <1 second)
- **Update thumbwar game index**: `python3 thumbwar/update_index.py` (takes 0.022s)
- **Run core FINK tests**: `cd app2 && node gcfink/test/run.js` (takes 0.057s)
- **Validate HTML**: `npx html-validate **/*.html` (works but shows style warnings)

### Project Dependencies Installation
- **Spectro game dependencies**: `cd spectro && npm install` (takes ~2 minutes, NEVER CANCEL)
- **App2 workspace**: `cd app2 && npm install` (takes ~1 minute, NEVER CANCEL)
- **FINK validation tools**: `cd inklet/validation && npm install` (may fail due to network restrictions - this is expected)

## Validation & Testing

### Manual Testing Protocol (CRITICAL)
After ANY code changes, ALWAYS test these scenarios:

1. **Main index loads properly**: Visit http://localhost:8080/ and verify all game links work
2. **GridLuck game functions**: Open http://localhost:8080/thumbwar/gridluck.html and verify:
   - Game canvas renders properly
   - Player movement responds to arrow keys
   - UI shows version, score, and controls
3. **TokiTokiPona flashcards work**: Open http://localhost:8080/tokitokipona/tokitokipona.html and verify:
   - Dictionary loads (120 words)
   - Quiz interface presents choices
   - Clicking answers works correctly

### FINK Story Player Testing
**Note**: FINK system requires external CDN access which may be blocked in testing environments.

When testing FINK stories at http://localhost:8080/inklet/app/:
- Check browser console for "INK library not available" errors
- This is expected when CDN access is blocked
- Test basic story loading even if INK compilation fails
- Verify UI elements render correctly

### Known Testing Limitations
- **Spectro tests fail**: Missing `jest-environment-jsdom` dependency - this is known and acceptable
- **FINK validation tools may fail**: Puppeteer installation often blocked by network restrictions
- **INK library loading blocked**: CDN access blocked in testing environments - stories will show "compilation failed"

## Development Commands

### File Updates & Automation
- **Regenerate thumbwar index**: `python3 thumbwar/update_index.py` after adding new HTML files to thumbwar/
- **No build step required**: All games are standalone HTML files
- **No bundlers used**: Direct browser execution only

### Optional Tools (May Not Work in All Environments)
- **HTML validation**: `npx html-validate **/*.html` 
- **FINK story validation**: `cd inklet/validation && node checkfink.mjs <file>` (requires puppeteer)
- **Spectro development server**: `cd spectro && npm start` (after npm install)

## Project Structure Navigation

### Key Game Directories
- **thumbwar/**: Touch-based games (GridLuck, Battleboids, Thumbwar)
- **inklet/**: Interactive fiction stories using FINK format
- **tokitokipona/**: Toki Pona language learning flashcards
- **spectro/**: ZX Spectrum-style platformer
- **schemoids/**: Asteroids variant game

### Important Files
- **index.html**: Main landing page linking to all experiments
- **thumbwar/index.html**: Generated automatically by update_index.py
- **app2/**: Core FINK utilities and tests (Node.js modules)
- **.github/workflows/pages.yml**: GitHub Pages deployment pipeline

### Configuration Files
- **spectro/package.json**: Spectro game dependencies and test scripts
- **app2/package.json**: FINK workspace configuration
- **inklet/validation/package.json**: Story validation tools

## GitHub Pages Deployment

### Automatic Deployment
- **Trigger**: Push to `master` branch automatically deploys to GitHub Pages
- **Build time**: ~1-2 minutes (GitHub Actions handles this)
- **URL**: https://danbri.github.io/glitchcan-minigam/

### Manual Deployment Testing
- **Always test locally first**: Use `python3 -m http.server 8080`
- **Validate all links work**: Check main index and individual games
- **Verify asset loading**: Ensure images, audio, and scripts load correctly

## Code Style & Standards

### HTML/CSS/JS Guidelines
- **Indentation**: 2 spaces consistently
- **Modern JavaScript**: Use `const`/`let`, arrow functions, ES6+ features
- **No bundlers**: Browser-only code, no build step required
- **Mobile-first**: Touch interfaces prioritized

### File Naming
- **Game files**: kebab-case (e.g., `gridluck-game.js`, `thumbwar.html`)
- **FINK stories**: `*.fink.js` format in inklet/ directory
- **Media assets**: Store in game-specific folders or shared media/

## Common Issues & Solutions

### "Games don't load" or "Blank pages"
- **Solution**: Check browser console for errors, ensure HTTP server is running
- **Common cause**: Missing HTTP server or incorrect relative paths

### "Tests fail" or "npm install fails"
- **Spectro tests**: Missing jsdom dependency - this is expected, ignore
- **FINK validation**: Network restrictions blocking puppeteer - this is expected
- **Solution**: Focus on manual testing instead of automated tests

### "FINK stories show compilation errors"
- **Cause**: CDN access blocked, INK library unavailable
- **Solution**: This is expected in restricted environments, test UI functionality instead
- **Local testing**: Stories should still load content even without INK compilation

## Critical Reminders

### NEVER CANCEL long-running operations
- **npm install commands**: May take 2+ minutes - ALWAYS wait for completion
- **Set timeouts**: Use 180+ seconds for npm installs, 60+ seconds for other operations
- **Be patient**: Network operations can be slow in testing environments

### ALWAYS validate changes manually
- **Don't rely only on automated tests**: Many are broken due to environment restrictions
- **Test real user scenarios**: Click through games, verify functionality works
- **Check multiple browsers**: Test on both desktop and mobile if possible

### Repository-specific notes
- **No main package.json**: This is intentional - each game is self-contained
- **GitHub Pages deployment**: Automated via workflow, no manual deployment needed
- **FINK is experimental**: Interactive fiction system may have compatibility issues