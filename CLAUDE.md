# CLAUDE.md - Guide for Glitch Canary Minigames

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

## GitHub Workflow Requirements
- GitHub Actions workflow requires modern action versions
- Checkout action: v4 (not v3)
- Setup-node action: v4 with Node 20+ (not v3/Node 16)
- Configure-pages action: v4 (not v3)
- Upload-pages-artifact action: v3 (deprecated v1)
- Deploy-pages action: v4 (not v1)