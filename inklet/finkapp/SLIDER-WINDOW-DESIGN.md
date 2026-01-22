# Slider Window System Design

## Overview
Replace traditional minimize/maximize buttons with a **slider-based window controller** that provides smooth, tactile transitions between 4 snap states.

## The 4 Snap States

### 1. FULL (100%)
- Minigame fills entire viewport
- Controls auto-hide after 2s inactivity, reveal on touch/hover
- Narrative completely hidden
- Best for focused gameplay

### 2. EMBEDDED (60-70%)
- Minigame embedded in main scroll area
- Social-media timeline style - scroll past the game
- Narrative text flows above/below
- Game stays live while scrolling
- Good for casual play while reading

### 3. MINI-LIVE (15-20%)
- Tiny floating window, corner positioned
- Game continues running (live preview)
- Draggable to any corner
- Tap to expand back
- Good for multitasking

### 4. MINI-PAUSED (15-20%)
- Same size as MINI-LIVE but frozen
- Shows last frame with "PAUSED" overlay
- Lower CPU/battery usage
- Tap to resume

## The Slider Control

```
┌─────────────────────────────────────┐
│  FULL ─────●──── EMBED ──── MINI    │
│   ◉         ◉         ◉      ◉      │
│  100%      70%       40%    15%     │
└─────────────────────────────────────┘
```

### Interaction:
- **Drag** the slider thumb for continuous resize
- **Tap** snap points for instant transition
- **Snap physics**: releases near a point → animates to it
- **Velocity-aware**: fast swipe overshoots then bounces back

## Audio & Haptics

### State Change Sounds (via FinkFoley):
```javascript
const stateChangeSounds = {
    toFull: { type: 'snap', pitch: 'high', duration: 80 },
    toEmbed: { type: 'snap', pitch: 'mid', duration: 60 },
    toMiniLive: { type: 'snap', pitch: 'low', duration: 50 },
    toMiniPaused: { type: 'click', pitch: 'low', duration: 40 }
};
```

### Haptic Patterns (navigator.vibrate):
```javascript
const hapticPatterns = {
    snapToState: [10],           // Quick tap
    dragTick: [5],               // Every 10% change
    overshot: [5, 20, 10],       // Bounce feedback
    pauseConfirm: [10, 30, 10]   // Double tap for pause
};
```

## Bottom Dock (Minimized Games)

When games are minimized, they appear in a **dock at bottom**:

```
┌──────────────────────────────────────────┐
│                                          │
│              STORY CONTENT               │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐                    │
│ │ 🎮 │ │ ⏸ │ │ 🎯 │     ← Mini games   │
│ └────┘ └────┘ └────┘                    │
└──────────────────────────────────────────┘
```

### Dock Behavior:
- Appears when scrolling down (like iOS home indicator)
- Fades when scrolling up
- Each thumbnail shows live game or paused frame
- Tap thumbnail → expand to EMBED mode
- Long-press → context menu (close, restart, settings)

## CSS Architecture

```css
/* Slider control */
.game-slider {
    position: fixed;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    max-width: 300px;
    z-index: 1500;
}

.game-slider-track {
    height: 4px;
    background: rgba(255,255,255,0.2);
    border-radius: 2px;
}

.game-slider-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--zx-cyan);
    cursor: grab;
    touch-action: none;
}

/* Snap points */
.game-slider-snap {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255,255,255,0.4);
}

/* Smooth interpolation */
#minigame-view {
    transition:
        width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        top 0.3s ease-out,
        left 0.3s ease-out,
        border-radius 0.2s ease;
}

/* State classes */
#minigame-view.state-full { /* 100% viewport */ }
#minigame-view.state-embed { /* 70% in scroll flow */ }
#minigame-view.state-mini-live { /* 15% corner pip */ }
#minigame-view.state-mini-paused { /* 15% frozen */ }
```

## JavaScript API

```javascript
window.FinkWindowSlider = {
    // Current state
    state: 'full', // 'full' | 'embed' | 'mini-live' | 'mini-paused'

    // Interpolation value (0-100)
    value: 100,

    // Snap points
    snapPoints: [100, 70, 40, 15],

    // Methods
    setState(newState, animate = true) { },
    setValue(newValue, animate = true) { },

    // Events
    onStateChange: (from, to) => { },
    onValueChange: (value) => { },

    // Audio/Haptics
    playStateSound(state) { },
    triggerHaptic(pattern) { }
};
```

## Implementation Phases

### Phase 1: Core Slider
- [ ] Create slider HTML/CSS
- [ ] Implement drag-to-resize
- [ ] Add snap points with physics
- [ ] Wire up state classes

### Phase 2: Audio/Haptics
- [ ] Create snap sounds via FinkFoley
- [ ] Add haptic feedback
- [ ] Ensure music continues during transitions

### Phase 3: Bottom Dock
- [ ] Create dock container
- [ ] Render mini thumbnails
- [ ] Implement scroll-reveal behavior
- [ ] Add tap-to-expand

### Phase 4: Polish
- [ ] Smooth interpolation curves
- [ ] Gesture shortcuts (double-tap = toggle full)
- [ ] Keyboard shortcuts (Esc = minimize)
- [ ] State persistence across sessions

## Open Questions

1. Should EMBED mode pause the game or keep it running?
2. Multiple games in dock - how many max?
3. Should slider be visible always or only when game active?
4. Accessibility: keyboard-only control of slider?
