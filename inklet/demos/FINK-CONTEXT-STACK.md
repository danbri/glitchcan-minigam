# FINK Context Stack - STRAWMAN Design
> STATUS: Experimental design doc - will be revisited

## The Problem

Writers create nested narrative structures:
- A story contains a dream sequence
- The dream contains a play-within-a-play
- The play contains a minigame
- Each layer has its own variables
- Some state needs to flow between layers

Without namespacing, variable collisions are inevitable:
```
story.fink.js:      VAR gold = 100
  └─ dream.fink.js: VAR gold = 0    // Oops, clobbered!
```

## The Solution: Context Stack

### Core Concepts

**PUSH** - Enter a nested FINK context
```ink
// In story.fink.js
You fall asleep...
# FINK: dream.fink.js
# PUSH
```

**POP** - Return to parent context
```ink
// In dream.fink.js
You wake up gasping!
# POP
-> END
```

**INJECT** - Pass vars down to child context
```ink
// Parent explicitly shares state with child
# FINK: dream.fink.js
# INJECT: gold, health, player_name
```

**YOINK** - Pull vars up from child after it POPs
```ink
// Parent receives state back from child
# FINK: dream.fink.js
# INJECT: gold
# YOINK: dream_gold, had_nightmare
```

### Example: Story → Dream → Minigame

```
┌─────────────────────────────────────────────────────────┐
│ story.fink.js (namespace: story_)                       │
│   VAR gold = 100                                        │
│   VAR health = 50                                       │
│                                                         │
│   # FINK: dream.fink.js                                 │
│   # PUSH                                                │
│   # INJECT: gold AS dream_gold                          │
│   # YOINK: nightmare_severity                           │
│   │                                                     │
│   │  ┌────────────────────────────────────────────┐     │
│   │  │ dream.fink.js (namespace: dream_)          │     │
│   │  │   # IMPORT: dream_gold                     │     │
│   │  │   # EXPORT: nightmare_severity             │     │
│   │  │   VAR weirdness = 0                        │     │
│   │  │                                            │     │
│   │  │   # FINK: gem-minigame.fink.js             │     │
│   │  │   # PUSH                                   │     │
│   │  │   │                                        │     │
│   │  │   │  ┌──────────────────────────────┐      │     │
│   │  │   │  │ gem-minigame.fink.js         │      │     │
│   │  │   │  │   VAR gems = 0               │      │     │
│   │  │   │  │   # MINIGAME: gems           │      │     │
│   │  │   │  │   # POP                      │      │     │
│   │  │   │  └──────────────────────────────┘      │     │
│   │  │   │                                        │     │
│   │  │   # POP                                    │     │
│   │  └────────────────────────────────────────────┘     │
│   │                                                     │
│   (nightmare_severity now available in story!)          │
└─────────────────────────────────────────────────────────┘
```

### Namespace Auto-Derivation

Each FINK file gets automatic namespace from filename:
- `story.fink.js` → `story_`
- `dragon-adventure.fink.js` → `dragon_adventure_`
- `ch2-castle.fink.js` → `ch2_castle_`

Writers can override:
```ink
# NAMESPACE: my_custom_ns
```

### Variable Visibility

| Directive | Direction | Renamed? | Example |
|-----------|-----------|----------|---------|
| `IMPORT`  | parent→child | No (canonical) | `# IMPORT: gold` |
| `EXPORT`  | child→parent | Creates alias | `# EXPORT: nightmare_severity` |
| `INJECT`  | parent→child | Optional AS | `# INJECT: gold AS dream_gold` |
| `YOINK`   | child→parent | Uses EXPORT | `# YOINK: nightmare_severity` |

### Runtime Context Stack

```javascript
const contextStack = [];

function pushContext(story, namespace, exports) {
    contextStack.push({
        story,
        namespace,
        exports,
        state: captureState(story)
    });
}

function popContext() {
    const child = contextStack.pop();
    const parent = contextStack[contextStack.length - 1];

    // Apply YOINKed values
    for (const [canonical, prefixed] of Object.entries(child.exports)) {
        if (parent.yoinks?.includes(canonical)) {
            parent.story.variablesState[canonical] = child.story.variablesState[prefixed];
        }
    }

    return parent;
}
```

## Open Questions

1. **What happens on POP with no parent?** → Return to TOC? End session?

2. **Circular FINK references?** → A loads B loads A → Stack overflow protection needed

3. **YOINK timing** → Captured at POP time, or continuously synced?

4. **Minigame integration** → Does `# MINIGAME:` implicitly PUSH?

5. **Error recovery** → If child FINK fails to compile, how to recover?

## Implementation Status

- [x] Namespace preprocessor (STRAWMAN)
- [ ] IMPORT/EXPORT tag parsing
- [ ] Context stack runtime
- [ ] PUSH/POP handlers
- [ ] INJECT/YOINK mappings
- [ ] Integration with hamfink2026.html

## Related Files

- `fink-namespace-preprocessor.js` - Variable namespacing transform
- `hamfink2026.html` - 2-engine demo with FINK loading
- `hamfink2026-ch2.fink.js` - Chapter 2 test content
- `../app/finkflow-notes.txt` - Earlier design notes
