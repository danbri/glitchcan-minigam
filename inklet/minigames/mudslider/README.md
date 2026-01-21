# Mudslider Mines - Puzzle Minigame

Boulder Dash-style puzzle game with emoji graphics. Collect gems, find keys, unlock doors, avoid snakes!

## Integration

This minigame provides MinigameSDK integration for use within finkapp.

### INK Variables

**Read from story:**
- `player_level` - Affects difficulty
- `difficulty` - Game difficulty setting
- `has_visited_cave` - Whether player has been to cave before

**Write to story:**
- `gems_collected` - Total gems collected
- `has_red_key` / `has_blue_key` / `has_yellow_key` / `has_green_key` - Key status
- `snakes_defeated` - Number of snakes avoided/defeated
- `rooms_explored` - Count of unique rooms visited
- `minigame_won` - Boolean: did player reach the vault?

### Game Modes

- `full` - Start at crash site, explore entire mine
- `cave` - Start in dark cave area
- `river` - River crossing challenge

### Usage in FINK

```ink
=== Enter_Cave ===
# IMAGE: dark_cave.png
The cave mouth yawns before you, promising treasures within...

+ [Enter the cave]
  # MINIGAME: mudslider mode=cave
  -> Cave_Complete

=== Cave_Complete ===
{minigame_won:
  You emerge victorious with {gems_collected} gems!
  -> Treasure_Room
- else:
  The cave defeated you this time...
  -> Enter_Cave
}
```

## Architecture

```
mudslider/
├── manifest.json   # Package metadata, variable declarations
├── index.html      # Entry point with SDK bridge
├── game.js         # Full game component (gc-minigam-slovib)
└── README.md       # This file
```

Game events are bridged to MinigameSDK:
```
minigame-won  →  sdk.complete({ success: true, ... })
minigame-lost →  sdk.complete({ success: false, ... })
```

## Standalone Testing

Open `index.html` directly in browser to test the game standalone (without finkapp).
