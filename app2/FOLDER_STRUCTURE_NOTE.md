# Folder Structure - IMPORTANT

## Active Development Folders

### `/app2/` - PRIMARY FRONTEND (Active Development)
This is the **renewed frontend** where all current work should happen.

**Status**: ✅ ACTIVE - Make changes here
**Contains**: Full FINK player with all features including:
- Real INK engine integration
- Knot navigation / hash ID deep linking (ALREADY IMPLEMENTED)
- Modular JavaScript architecture
- Mobile debugging (Eruda)
- All latest features and bug fixes

### `/inklet/app/` - HISTORICAL REFERENCE ONLY
This folder should be **left untouched** for historical purposes.

**Status**: 🔒 FROZEN - Do not modify
**Purpose**: Historical reference, documentation of previous implementation

## Other Folders

- `/inklet/` - Contains FINK story files (.fink.js), media, and historical demos
- `/app2/gcfink/` - Game content (FINK stories) for app2
- `/app2/gcui/` - Game UI components for app2
- `/thumbwar/`, `/spectro/`, etc. - Individual minigame folders

## For AI Assistants / Future Developers

**CRITICAL**: When asked to modify the FINK player frontend:
1. ✅ Make changes in `/app2/`
2. ❌ DO NOT modify `/inklet/app/` (historical reference only)
3. Test using: `http://localhost:8080/app2/`

## Current Hash ID Implementation Status

Hash ID URL deep linking for public knots is **ALREADY FULLY FUNCTIONAL** in `/app2/`:
- ✅ Automatic URL fragment updates
- ✅ Deep linking to specific knots
- ✅ Browser back/forward integration
- ✅ Public/private knot convention (underscore prefix)

See `/inklet/KNOT_NAVIGATION_README.md` for feature documentation.

Testing guide available at `/inklet/HASH_ID_TESTING.md`
