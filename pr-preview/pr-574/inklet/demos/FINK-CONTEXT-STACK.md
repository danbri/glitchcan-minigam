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

## ACCESS_TIER: Content Trust Levels

For communally assembled narratives, different content sources have different trust levels. Higher-tier content (core team) shouldn't be corrupted by less-policed userspace contributions.

### Tier Definitions (2026 Initial Structure)

| Tier | Who | YOINK Rights | Can Modify Parent | Notes |
|------|-----|--------------|-------------------|-------|
| 0 | teamgc only | Full | Yes - defines global scope | Core mechanics, TOC, trust anchors |
| 1 | insiders, sponsors, early adopters | Limited EXPORT | Via declared contract only | Vetted content, minigame integration |
| 2 | userspace (less policed) | None | No | Fully sandboxed, dream-within-dream |

### Usage

```ink
// From a Tier 0 story, loading userspace content safely:
# FINK: user-contributed-adventure.fink.js
# PUSH
# ACCESS_TIER: 2
# INJECT: player_name           // Read-only for the loaded content
# YOINK: none                   // Nothing flows back up
```

```ink
// From Tier 0, loading vetted Tier 1 content:
# FINK: sponsor-episode.fink.js
# PUSH
# ACCESS_TIER: 1
# INJECT: player_name, base_score
# YOINK: episode_score, unlocked_badge    // Declared exports only
```

### Protection Model

When Tier 0 content loads Tier 2 content:
- The loaded content runs in an isolated "dream" context
- It can receive INJECTed values but cannot modify them in parent
- When it POPs, no state flows back (YOINK: none enforced)
- Parent "reality" remains uncorrupted regardless of what happens in the dream

This allows open contribution without risking the integrity of core narrative state.

### Enforcement

- Tier checks happen at FINK load time
- Lower-tier content cannot escalate its own tier
- YOINK declarations are validated against ACCESS_TIER
- Tier 2 attempting YOINK results in silent no-op (logged, not error)

### Future Considerations

As infrastructure stabilizes, more granular tiers may emerge:
- Content moderation workflows
- Reputation-based tier assignment
- Per-variable trust levels
- Audit trails for state changes across tier boundaries

## Open Questions

1. **What happens on POP with no parent?** → Return to TOC? End session?

2. **Circular FINK references?** → A loads B loads A → Stack overflow protection needed

3. **YOINK timing** → Captured at POP time, or continuously synced?

4. **Minigame integration** → Does `# MINIGAME:` implicitly PUSH?

5. **Error recovery** → If child FINK fails to compile, how to recover?

6. **ACCESS_TIER inheritance** → Does a Tier 1 loading another file inherit Tier 1, or drop to Tier 2?

7. **Cross-domain trust** → How to handle FINK URLs from different origins?

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
