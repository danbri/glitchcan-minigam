# FINK App Design Ideas Archive

This document captures UI/UX design concepts from the original `inklet/app/` implementation that were not reimplemented in the newer `inklet/finkapp/` version. These ideas may be worth revisiting in future iterations.

---

## 1. Three-Choice Swipe UI (Social App-Inspired)

The original design featured a Tinder/social-app-inspired interface where choices were presented as three horizontal columns at the bottom of the screen.

### Layout Concept
```
┌─────────────────────────────────────────┐
│                                         │
│           [STORY IMAGE]                 │
│             78vh tall                   │
│                                         │
├─────────────────────────────────────────┤
│  Story text with gradient overlay       │
│  positioned over bottom of image        │
├─────────┬─────────────┬─────────────────┤
│  PINK   │   GREEN     │    BLUE         │
│   🏃    │     🗣️      │      🔍         │
│  "Run"  │   "Talk"    │   "Search"      │
│  (25vh) │   (25vh)    │    (25vh)       │
└─────────┴─────────────┴─────────────────┘
```

### Color Scheme
```css
--choice-left: #f1c2c7;    /* Soft pink - typically negative/retreat */
--choice-middle: #c7e6d6;  /* Soft green - typically neutral/dialogue */
--choice-right: #c7dff7;   /* Soft blue - typically explore/investigate */
```

### Interaction Pattern
- **Touch/swipe up** on a column to select that choice
- **Tap** on a column as alternative selection method
- Each column represents approximately 1/3 of the bottom screen area
- Large touch targets for mobile-first interaction

### Visual Elements
- **Large emoji** (2.5rem) centered in each column
- **Short label text** below emoji using SVG for crisp stroke/fill rendering
- **Grayscale filter** on non-hovered choices (30% desaturated)
- **Scale animation** on hover/focus (1.1x)

### CSS Reference (from original)
```css
.choice {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 6px;
    min-height: 25vh;
}

.choice-emoji {
    font-size: 2.5rem;
    filter: grayscale(30%) opacity(0.8);
}

.choice:hover .choice-emoji {
    filter: grayscale(0%) opacity(1);
    transform: scale(1.1);
}

.choice-label-svg {
    max-width: 100%;
    height: 32px;
}
```

### When This Works Best
- Stories with consistently 2-3 choices per decision point
- Mobile-first experiences
- Quick-paced narrative games
- Situations where choices can be summarized in emoji + single word

### Limitations
- Doesn't scale well beyond 3 choices
- Requires careful choice text curation (must be short)
- Emoji selection is critical for conveying meaning

---

## 2. Expanding Choice Animation

When a choice was selected, the colored column would expand to fill the entire screen, creating a dramatic transition effect.

### Animation Sequence
1. User taps/swipes a choice column
2. A clone element is created at the column's position
3. Clone animates to fill the viewport (width: 100%, height: 100%)
4. Story text fades out during expansion
5. Background color fades to transparent
6. New content appears
7. Clone element is removed

### CSS Reference
```css
.expanding-choice {
    position: fixed;
    bottom: 0;
    z-index: 50;
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Timing
- **0-500ms**: Choice expands, other choices fade
- **500-1000ms**: Background color fades, story transitions
- **1000ms+**: Cleanup and new content display

---

## 3. Image-Dominant Layout

The original prioritized visual storytelling with images taking most of the screen.

### Proportions
```css
.image-container {
    height: 78vh;  /* Most of viewport for image */
}

.story-content {
    position: absolute;
    bottom: 22vh;  /* Floats above choice area */
    max-height: 40vh;
    background: linear-gradient(to top,
        rgba(15, 23, 42, 0.95),
        rgba(15, 23, 42, 0.85),
        transparent);
}
```

### Features
- **Image container takes 78vh** of viewport
- **Story text floats over image** with gradient fade
- **Gradient overlay** ensures text readability over any image
- **Image zoom effect** (`transform: scale(1.1)`) for subtle movement

---

## 4. Choice Visibility Toggle

A floating button allowed users to hide/show the choices area.

### Purpose
- Maximize image viewing area
- Allow readers to focus on story text
- Accommodate different reading preferences

### Implementation
```html
<button class="choice-toggle" id="choice-toggle" title="Toggle choices">
    👁️  <!-- or 🙈 when hidden -->
</button>
```

```css
.choice-toggle {
    position: absolute;
    top: 15px;
    right: 15px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    backdrop-filter: blur(5px);
}
```

---

## 5. Hidden Top Menu (Hover/Touch Reveal)

The menu bar was hidden by default and revealed on interaction.

### Behavior
- **Desktop**: Menu slides down when mouse enters top 15px of viewport
- **Mobile**: Touch the top area to toggle menu visibility
- **Auto-hide**: Menu slides away when mouse leaves

### Implementation
```css
.menu-trigger {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 15px;  /* Invisible trigger zone */
    z-index: 5;
}

.title-bar {
    transform: translateY(-100%);  /* Hidden by default */
    transition: transform 0.3s ease;
}

.title-bar.visible,
.app-container.show-menu .title-bar {
    transform: translateY(0);
}
```

---

## 6. Elegant Typography

The original used carefully selected web fonts for a polished reading experience.

### Font Stack
```css
/* Story text - elegant serif for readability */
font-family: 'Literata', serif;
font-size: 1.4rem;
line-height: 1.8;

/* UI elements - modern sans-serif */
font-family: 'Montserrat', sans-serif;
font-weight: 800;
text-transform: uppercase;
letter-spacing: 1px;
```

### Title Treatment
```css
.story-title {
    background: linear-gradient(45deg, #f43f5e, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
```

---

## 7. Image Fullscreen Mode

Dedicated button to view the current story image in fullscreen.

### Features
- Expands image container to 100vh
- Hides story text and choices
- Exit by tapping the close button
- Useful for appreciating artwork

---

## Comparison: Old vs New Approach

| Feature | Old (app/) | New (finkapp/) |
|---------|-----------|----------------|
| Choice layout | 3-column horizontal | Vertical list |
| Theme | Elegant/modern | ZX Spectrum retro |
| Typography | Literata + Montserrat | Press Start 2P |
| Animations | Expanding choice | Word-by-word reveal |
| Image priority | 78vh dominant | Inline with content |
| Minigames | None | Gems, Chess |
| Audio | None | WebAudio foley |
| Dev tools | Simple debug | Tabbed panel + swimlanes |

---

## Future Considerations

If revisiting the 3-choice swipe UI:

1. **Hybrid approach**: Use swipe UI for stories with 2-3 choices, fall back to vertical list for more
2. **Dynamic emoji**: Better emoji extraction/generation from choice text
3. **Gesture library**: Consider Hammer.js or similar for robust swipe detection
4. **Theme switching**: Allow users to choose between "elegant" and "retro" modes
5. **A/B testing**: Measure engagement between UI styles

---

*Archived from inklet/app/ - January 2026*
