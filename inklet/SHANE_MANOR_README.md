# Shane Manor: Interactive Detective Mystery

## Overview

Shane Manor is an enhanced FINK (Fiction INK) interactive story that showcases advanced features including minigame integration, dynamic storytelling, and performance-based narrative branches. It serves as both an engaging detective mystery and a technical demonstration of FINK's capabilities.

## Story Features

### 🕵️ Detective Mystery
- **Setting**: Victorian Gothic manor house, November 1890s
- **Crime**: Locked-room murder mystery
- **Detective**: Inspector Shane André-Louis
- **Challenge**: Solve the murder using observation, deduction, and chess analysis

### 🎮 Interactive Elements
- **Minigame Integration**: Mamikon Mini-Chess at the crime scene
- **Dynamic Narratives**: Story changes based on player choices and performance
- **Multiple Investigation Paths**: Observational, procedural, or direct approaches
- **Variable Outcomes**: Different endings based on chess skill and investigation style

### 🧩 Technical Showcase
- **Real INK Compilation**: Uses ink-full.js engine, not regex parsing
- **FINK Extensions**: IMAGE, BASEHREF, and MINIGAME tags
- **Variable Tracking**: player_reputation, chess_skill, investigation_style, time_pressure
- **External Integration**: JavaScript minigame communicates back to story

## Direct Links for Testing

The story supports direct navigation to specific scenes for debugging and demonstration:

- `#start` - Story beginning with atmospheric opening
- `#crime_scene` - Examine the locked study  
- `#chess_minigame` - Interactive chess analysis scene
- `#deduction` - Final deduction phase
- `#resolution` - Story conclusion

## Chess Integration

### Mamikon Mini-Chess Component
- **Position**: Pre-configured tactical position from story context
- **Queen Sacrifice**: White has played an aggressive queen sacrifice
- **Performance Tracking**: Player moves analyzed for tactical understanding
- **Story Feedback**: Chess performance affects available deduction options

### Performance Levels
- **Brilliant (80+ points)**: Unlocks chess evidence theory, maximum reputation bonus
- **Good (50-79 points)**: Solid understanding, moderate reputation bonus  
- **Decent (25-49 points)**: Basic analysis, standard progression
- **Needs Improvement (<25 points)**: Limited chess insights

## Story Variables

| Variable | Purpose | Range |
|----------|---------|--------|
| `player_reputation` | Detective's professional standing | 50-85+ |
| `investigation_style` | Player's approach to detection | observational/procedural/direct/psychological |
| `time_pressure` | Urgency tracker, decreases with actions | 3 to 0 |
| `chess_skill` | Performance in minigame | 0-100 |
| `chess_insights` | Type of chess analysis achieved | brilliant_analysis/good_understanding/basic_analysis |

## Files

- **`shane-manor.fink.js`** - Main story file with INK content
- **`mamikon-minichess.js`** - Standalone chess minigame component
- **`test-minichess.html`** - Integration testing interface
- **Media assets** - Located in `media/shane/` directory

## Usage

### In FINK Player
1. Load story via Table of Contents → Games → Shane Manor
2. Follow investigation choices to reach chess scene
3. Play chess position to influence story outcome
4. Complete deduction based on gathered evidence

### Direct Testing
1. Open `test-minichess.html` to verify chess component
2. Use direct links to jump to specific story sections
3. Check CI validation with `fink-validation.yml` workflow

## Technical Notes

### FINK Integration
The story demonstrates proper FINK structure:
```ink
# MINIGAME: chess
# SCRIPT: mamikon-minichess.js  
# CONFIG: {"position": "shane_manor", "onComplete": "chess_analysis"}
```

### Chess Callback
The minigame updates story variables via callback:
```javascript
onGameEnd: function(performance, queenSacrifice, moveHistory) {
    // Updates chess_skill variable based on performance
    // Enables conditional story branches
}
```

### Image Assets
Story uses optimized images from `media/shane/` with BASEHREF path resolution:
```ink
# BASEHREF: media/shane/
# IMAGE: desktop/manor_with_taxi_desktop.jpg
```

## Development

### Testing
- **Local**: Run HTTP server and open `test-minichess.html`
- **CI**: Automated validation via GitHub Actions
- **Story**: Load in FINK Player v5/v6 for full integration test

### Validation
```bash
cd inklet/validation
node checkfink.mjs ../shane-manor.fink.js
```

### Extending
- Add new chess positions by modifying `getShaneManorPosition()`
- Create additional minigames by following the MamikonMiniChess pattern
- Enhance story with new variables and conditional branches

## Credits

- **Original Concept**: danbri/glitchcan-minigam repository
- **Chess Integration**: Based on Mamikon Mini-Chess CodePen
- **Story Enhancement**: Copilot implementation for issue #20
- **Technical Framework**: FINK Player v5/v6 architecture