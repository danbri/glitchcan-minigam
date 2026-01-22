# Gems Minigame - Iframe Version (UNUSED)

**Status:** Currently NOT in use

## What's happening

The gems minigame currently runs via the **inline** implementation at:
- `inklet/finkapp/gems.minigam.js` (defines `window.GemsMinigame`)

This iframe-based version exists but is not active because `'gems'` is not in the `iframeMinigames` array in `fink-minigames.js`.

## Future migration

The plan is to eventually migrate all minigames to the iframe/SDK pattern for:
- Better sandboxing and security
- Consistent API via `MinigameSDK`
- Easier standalone testing (`index.html?standalone=true`)
- Cleaner separation of concerns

## To activate this version

1. Add `'gems'` to `iframeMinigames` array in `fink-minigames.js`
2. Remove or rename `finkapp/gems.minigam.js` to avoid conflicts
3. Test thoroughly

## Files in this folder

- `index.html` - Standalone game page
- `game.js` - Game logic using MinigameSDK
- `styles.css` - Game-specific styles
- `manifest.json` - Minigame configuration
