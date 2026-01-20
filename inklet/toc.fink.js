oooOO`

# BASEHREF: /glitchcan-minigam/inklet/media/

-> main_menu

=== main_menu ===

Enter the Finkiverse. Everything isn't here yet.

// Nothing works properly yet. Episodes are Ink-based (and .fink.js distributed); Minigames are potential in-game widgets for the story-based chapters. This will only make sense to the curious.
// big file, # IMAGE: coverart/GLITCHCAN_IMG_1461.JPEG
# IMAGE: coverart/glitchcan-cover-medium.jpg



+ [Episodes] -> episodes_menu
+ [Minigames] -> minigames_menu
+ [Help] -> help_menu

=== episodes_menu ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Choose your adventure! Each episode is half-finished in a different way.

+ [Bagend] -> hobbit_selected
+ [Bagend v2 (enhanced)] -> bagend2_selected
+ [Diamond Cave] -> diamond_cave_selected
+ [Hampstead] -> hampstead_selected
+ [Maple Hollow] -> maple_hollow_selected
+ [Mudslide Mines] -> mudslidemines_selected
+ [Riverbend] -> riverbend_selected

=== minigames_menu ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Minigames and experiments, eventually for integration into story-based episodes.

+ [Ukrainian Language] -> ukrainian_selected


=== help_menu ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Get help with using the FINK system, understanding controls, and troubleshooting common issues.

FINK stories are JavaScript-based interactive fiction that can load external content and cross-reference each other. All media assets are served relative to the story's base path.

This is where things might be documented, eventually.

+ [Developer Guide] -> dev_guide_selected
+ [Shane Manor Mystery (testing)] -> shane_manor_selected
+ [Shane Manor ENRICHED (WIP)] -> shane_manor_enriched_selected
+ [Experiments] -> experiments_selected

=== hobbit_selected ===
# FINK: /glitchcan-minigam/inklet/bagend.fink.js

Bag End

A buggy and broken nod to the classic 1982 text adventure, The Hobbit. SVG images by Claude. Follow Bilbo Baggins as he encounters a mysterious wizard and is drawn into an unexpected adventure.

# IMAGE: coverart/bagend_splash_imag_9453.jpeg

+ [enter Bag End] -> external_story

=== bagend2_selected ===
# FINK: /glitchcan-minigam/inklet/bagend2.fink.js

Bag End v2 (Enhanced)

The improved Hobbit adventure with proper inventory tracking, conversation gating, and state management. Same story as the original, but with polished game mechanics.

# IMAGE: coverart/bagend_splash_imag_9453.jpeg

+ [enter Bag End v2] -> external_story

=== diamond_cave_selected ===
# FINK: /glitchcan-minigam/inklet/demos/diamond-cave.fink.js

Diamond Cave

Awaken in a shimmering underground cavern. Collect gems, solve puzzles, and escape! Features minigame integration and multi-chapter story progression.

# IMAGE: glitchcan-grey-portrait-web.jpg

+ [enter Diamond Cave] -> external_story

=== hampstead_selected ===
# FINK: /glitchcan-minigam/inklet/hampstead.fink.js

Hampstead

Navigate the challenging social dynamics of 1980s London. A few scenes inspired by the classic 80s game. No images.

# IMAGE: coverart/hamstead_img_9432.jpeg

+ [enter Hampstead] -> external_story

=== mudslidemines_selected ===
# FINK: /glitchcan-minigam/inklet/mudslidemines.fink.js

# IMAGE: glitchcan-grey-portrait-web.jpg

Mudslide Mines! Experimenting with alternate interface to a 2D pseudo-platformer. Test only.

+ [enter Mudslide Mines] -> external_story

=== riverbend_selected ===
# FINK: /glitchcan-minigam/inklet/riverbend.fink.js

# IMAGE: riverbend/village_overview.png

Riverbend - Village Mystery

Discover the secrets of a chocolate-box-perfect village where greed and jealousy bind neighbours together in a conspiracy of silence.

+ [Enter Riverbend] -> external_story

=== maple_hollow_selected ===
# FINK: ../../cozyverse/maple-hollow.fink.js

# IMAGE: glitchcan-grey-portrait-web.jpg

Maple Hollow: Aslan Rising

A cozy interactive romance with YouTube mood clips. Return to a snow-covered hometown, reconnect with old flames, and find your way home. Warmth points track your journey.

+ [Enter Maple Hollow] -> external_story

=== ukrainian_selected ===
# FINK: /glitchcan-minigam/inklet/tml-2025-langlearn.fink.js

# IMAGE: glitchcan-grey-portrait-web.jpg

Ukrainian Language Learning

Learn Ukrainian food vocabulary and basic grammar through interactive lessons and practice exercises. Proof of concept.

+ [Enter Language demo] -> external_story

=== dev_guide_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg

FINK Developer Guide

Does not exist.

=== shane_manor_selected ===
# FINK: /glitchcan-minigam/inklet/shane-manor.fink.js

# IMAGE: glitchcan-grey-portrait-web.jpg

Shane Manor Mystery

A test story for debugging and demonstrating FINK functionality. This is primarily for development testing.

+ [Enter Shane Manor] -> external_story

=== shane_manor_enriched_selected ===
# FINK: /glitchcan-minigam/inklet/_tmp_shane-manor.fink.js

# IMAGE: glitchcan-grey-portrait-web.jpg

Shane Manor Mystery ENRICHED

Work-in-progress deep revision with expanded Victoria path. Features evidence chains, contradiction mechanics, fair-play clue system, and multiple layered endings.

Design principles: Phoenix Wright confrontations, Agatha Christie layered secrets, evidence-gated accusations.

+ [Enter Enriched Manor] -> external_story

=== experiments_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Experiments & Prototypes

A collection of experimental games, prototypes, and technical demonstrations. These are works-in-progress showcasing different gameplay mechanics and visual styles.

**Games & Interactive Experiments:**

🎮 **FINK Integration Tests:**
- GamGam Web Components: https://danbri.github.io/glitchcan-minigam/inklet/gamgam-wc.html

🚀 **Action Games:**
- Thumbwar: https://danbri.github.io/glitchcan-minigam/thumbwar/thumbwar.html
- Battleboids: https://danbri.github.io/glitchcan-minigam/thumbwar/battleboids.html
- GridLuck: https://danbri.github.io/glitchcan-minigam/thumbwar/gridluck.html

🤖 **AI & Simulation:**
- Schemoids: https://danbri.github.io/glitchcan-minigam/schemoids/schemoids.html
- ED-209 Parking Bot: https://danbri.github.io/glitchcan-minigam/gencity/ed209-parkbot.html
- Dejanking Test: https://codepen.io/danbri/pen/ZYGQzpG

🌌 **Space & Strategy:**
- Rockall UI Tests: https://codepen.io/danbri/pen/JodGOOa
- Rockall Mocks: https://codepen.io/danbri/pen/bNdpbBx (Asteroids-inspired crafting game)
- Mamikon Mini-Chess: https://codepen.io/danbri/pen/azOvvGX (needs Queen sacrifice move)
- Tankoff: https://codepen.io/danbri/pen/raVaWBm

🎲 **Game Mechanics:**
- Rock Paper Boids: https://codepen.io/danbri/pen/YPPBjdw

🎬 **Video Integration Tests:**
- INK + Video Test A: https://codepen.io/danbri/pen/Byymzyd
- INK + Video Test B: https://codepen.io/danbri/pen/NPPwpjZ

**Sounds & Visuals:**

🎵 **Audio:**
- Grid-Alt Music Maker: https://danbri.github.io/glitchcan-minigam/blipblop/grid-alt.html

🌍 **Visual Effects:**
- Twin Earth Animation: https://danbri.github.io/glitchcan-minigam/twinearth/index.html
- Emoji Particles: https://codepen.io/danbri/pen/NPqGjLP
- Hobbit/Bagend SVG: https://codepen.io/danbri/pen/PwwEVMZ

**Infrastructure:**

🔐 **Authentication:**
- Mock Login (Steam/Discord/Mastodon): https://codepen.io/danbri/pen/QwbbaaY

Most experiments are hosted on CodePen for rapid prototyping and easy sharing. Local experiments are in the GitHub Pages deployment.

+ [Return to Help Menu] -> help_menu

=== external_story ===
Loading external story...

This feature will load the referenced FINK story file. For now, returning to the main menu.

+ [Return to Main Menu] -> main_menu
`
