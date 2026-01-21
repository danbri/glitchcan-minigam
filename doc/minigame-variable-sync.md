# Minigame Variable Sync Design

## Current Implementation (v2 - Delta-Based)

When an iframe minigame starts, we initialize tracking state. On each progress update, we compute the **delta** (change) and apply it to the current story value, preserving any external changes.

## The Parallel Activity Problem

If other activities modify `diamonds` while the minigame is running:

1. Start: `diamonds = 10`, `startingDiamonds = 10`
2. Progress: game has 5 gems, we set `diamonds = 15`
3. **External event adds 3 diamonds**: `diamonds = 18`
4. Progress: game has 7 gems, we set `diamonds = 10 + 7 = 17`

Result: We **lost** the 3 diamonds from the external event.

## How It Works: Delta-Based Sync

Track the last update state, not just the starting state:

```javascript
lastSync: {
    gameGems: 0,       // gems reported by game at last sync
    storyDiamonds: 0   // diamonds we set in story at last sync
}
```

On each progress update:

```javascript
// Detect external changes since our last update
const externalDelta = currentStoryDiamonds - lastSync.storyDiamonds;

// Detect game progress since last update
const gameDelta = currentGameGems - lastSync.gameGems;

// Apply our delta to current value (preserves external changes)
const newDiamonds = currentStoryDiamonds + gameDelta;

// Update tracking
lastSync.gameGems = currentGameGems;
lastSync.storyDiamonds = newDiamonds;

// Set the variable
story.variablesState['diamonds'] = newDiamonds;
```

### Example with Fix

1. Start: `diamonds = 10`, `lastSync = { gameGems: 0, storyDiamonds: 10 }`
2. Progress (5 gems): `newDiamonds = 10 + (5-0) = 15`, `lastSync = { 5, 15 }`
3. External +3: `diamonds = 18`
4. Progress (7 gems): `newDiamonds = 18 + (7-5) = 20`, `lastSync = { 7, 20 }`

Result: External 3 diamonds preserved, game's 7 gems added correctly.

## Use Cases for Parallel Activities

- Multiple minigames running in different tabs/panels
- Story events awarding diamonds mid-game
- Time-based rewards or achievements
- Multiplayer sync from server

## Implementation Status

- [x] v2: Delta-based sync for parallel safety (implemented Jan 2026)
