# 🐥 Minigames

A halfbaked [collection](https://danbri.github.io/glitchcan-minigam/) of very experimental browser-based minigames, sloppy by design. Investigating possibilities around player-generated sloppy AI minigames within a larger framework.

## Experiments

### Thumbwar
A fluid dynamics game where players use their thumbs to bend fluid streams and catch targets. Play on a touchscreen device for the best experience.

### Inklet
An interactive story game with emoji-based scenes and branching narratives. Choose your actions carefully to explore different storylines.

### Toki Toki Pona
A language learning game for Toki Pona that shows words and emoji symbols. Select the correct English meaning for the Toki Pona word.

### Schemoids
An Asteroids-style game where you shoot Schema.org type hierarchies that split into subtypes when hit.

### Bookshelf Lights
LED light strip simulators for bookshelves with various patterns and animations. Select from preset lighting patterns or create custom effects.

### Sandpit
A code sandbox for running Python and JavaScript snippets with a helpful chat interface.

## Ink Standard Compliance

- Inklet stories use the Ink language unmodified within FINK wrappers (see `inklet/`).
- Validation tools in `inklet/validation/` are standard-based and must not fork or reinterpret the language.
- When unsure, defer to the official Ink documentation and examples. See `inklet/validation/README.md` for the analyzer’s compliance notes.
