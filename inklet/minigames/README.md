# FINK Minigame Widget System

Secure, encapsulated minigame integration for FINK stories.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  FINK Player (finkapp)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MinigameHost                                         │  │
│  │  - Manages iframe lifecycle                           │  │
│  │  - Handles postMessage communication                  │  │
│  │  - Bridges INK variables ↔ minigame                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                    postMessage                               │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │  <iframe sandbox="allow-scripts">                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Minigame (e.g., gems/index.html)               │  │  │
│  │  │  - Isolated JavaScript execution                │  │  │
│  │  │  - No access to parent DOM                      │  │  │
│  │  │  - Communicates via MinigameSDK                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### Blast Zone Containment

1. **Iframe Sandbox**: Minigames run in `<iframe sandbox="allow-scripts">`:
   - ❌ No access to parent window
   - ❌ No access to cookies/localStorage of parent
   - ❌ No form submission
   - ❌ No popups
   - ✅ JavaScript execution only

2. **CSP Headers** (recommended): Host should set Content-Security-Policy

3. **Message Validation**: All postMessage data is validated by schema

4. **Variable Allowlist**: Minigames can only read/write declared variables

### What a Malicious Minigame CANNOT Do:

- Access the FINK story engine directly
- Read/write INK variables not in its allowlist
- Access user cookies or localStorage
- Navigate the parent window
- Access the parent DOM
- Make requests with parent's credentials (CORS)

### What a Malicious Minigame CAN Do (acceptable risk):

- Consume CPU/memory (mitigated by terminate capability)
- Display inappropriate content (mitigated by trust/review)
- Crash its own iframe (contained, parent unaffected)

## Package Structure

```
inklet/minigames/
├── README.md                 # This file
├── minigame-host.js          # Host-side manager (runs in finkapp)
├── minigame-sdk.js           # Guest-side SDK (included by minigames)
├── gems/
│   ├── manifest.json         # Package metadata
│   ├── index.html            # Entry point
│   ├── game.js               # Game logic
│   └── styles.css
├── chess/
│   ├── manifest.json
│   ├── index.html
│   └── ...
└── slovib/                   # Emoji jungle quest
    ├── manifest.json
    ├── index.html
    └── ...
```

## manifest.json Specification

```json
{
  "name": "gems",
  "title": "Gem Collector",
  "description": "Click gems to collect them!",
  "version": "1.0.0",
  "author": "FINK Team",
  "entry": "index.html",

  "sandbox": {
    "permissions": ["allow-scripts"],
    "timeout": 300000
  },

  "variables": {
    "read": ["player_level", "has_pickaxe", "difficulty"],
    "write": ["diamonds", "mega_diamonds", "minigame_played"]
  },

  "modes": {
    "normal": { "description": "Standard gem collection" },
    "mega": { "description": "Mega gems worth 1000x!" },
    "timed": { "description": "60 second challenge" }
  },

  "ui": {
    "width": "100%",
    "height": "400px",
    "background": "#1a1a2e"
  }
}
```

## Communication Protocol

### Host → Guest Messages

```typescript
// Initialize minigame with config and initial variables
{ type: "init",
  config: { mode: "normal", ... },
  variables: { player_level: 5, has_pickaxe: true } }

// Lifecycle control
{ type: "pause" }
{ type: "resume" }
{ type: "terminate" }

// Variable updates from story
{ type: "variable-changed", name: "difficulty", value: "hard" }
```

### Guest → Host Messages

```typescript
// Ready to start
{ type: "ready", capabilities: ["pause", "resume"] }

// Variable updates (only allowed variables)
{ type: "set-variable", name: "diamonds", value: 5 }

// Game completion
{ type: "complete",
  result: {
    success: true,
    score: 100,
    variables: { diamonds: 15, minigame_played: true }
  }}

// Errors
{ type: "error", code: "INVALID_STATE", message: "..." }

// Optional: Progress updates
{ type: "progress", data: { gems: 3, time: 45 } }
```

## Usage in FINK Stories

### INK Tag Syntax

```ink
=== gem_alcove ===
Time to collect some gems!

# MINIGAME: gems
# MINIGAME_MODE: mega
# MINIGAME_CONFIG: {"timeLimit": 60}
-> minigame_complete

=== minigame_complete ===
{diamonds >= 5:
    You collected enough gems to proceed!
    -> next_area
- else:
    You need more gems. Try again?
    + [Try again] -> gem_alcove
    + [Give up] -> give_up
}
```

### JavaScript API (Host)

```javascript
// Start minigame programmatically
await MinigameHost.start('gems', {
  mode: 'mega',
  variables: {
    player_level: FinkInkEngine.story.variablesState['level']
  },
  onComplete: (result) => {
    // Update story variables
    FinkInkEngine.story.variablesState['diamonds'] = result.variables.diamonds;
    FinkInkEngine.continueStory();
  },
  onError: (error) => {
    console.error('Minigame error:', error);
    MinigameHost.terminate();
  }
});

// Terminate if stuck
MinigameHost.terminate();
```

### JavaScript API (Guest/SDK)

```javascript
// In minigame's game.js
import { MinigameSDK } from '../minigame-sdk.js';

const sdk = new MinigameSDK();

// Wait for initialization
sdk.onInit((config, variables) => {
  console.log('Mode:', config.mode);
  console.log('Player level:', variables.player_level);
  startGame(config);
});

// Update variables during gameplay
sdk.setVariable('diamonds', collectedGems);

// Signal completion
sdk.complete({
  success: true,
  score: totalScore
});

// Handle pause/resume
sdk.onPause(() => pauseGame());
sdk.onResume(() => resumeGame());
```

## Integrating gamgam-wc.html

The existing `gamgam-wc.html` (Emoji Jungle Quest) can be packaged as:

```
inklet/minigames/slovib/
├── manifest.json
├── index.html          # Adapted from gamgam-wc.html
└── (extracted JS/CSS)
```

Key changes needed:
1. Replace standalone page with minigame-sdk integration
2. Use `sdk.complete()` instead of internal state
3. Map game results to INK variables

## Testing

```bash
# Validate manifest
node minigames/validate-manifest.js minigames/gems/manifest.json

# Run in isolation (no finkapp)
open minigames/gems/index.html?standalone=true

# Integration test with mock host
node tests/minigame-integration.spec.js
```

## Future Considerations

1. **Web Components**: Consider wrapping minigames in custom elements for better encapsulation
2. **Shared Assets**: CDN for common game assets (sounds, sprites)
3. **Marketplace**: Allow user-submitted minigames with review process
4. **Analytics**: Track minigame completion rates, scores
5. **Offline**: Service worker caching for minigame assets
