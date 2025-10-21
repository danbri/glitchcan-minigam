oooOO`

VAR minigame_score = 0
VAR minigame_attempts = 0
VAR collected_items = 0
VAR has_red_key = false
VAR has_blue_key = false

# MENU: 🏠 Main Menu -> main_menu
# MENU: 🎮 Minigame Demos -> minigame_demos

# BASEHREF: ../inklet/media/

-> main_menu

=== main_menu ===

Welcome to app2 - bleeding edge FINK + Minigame Integration

This experimental entry point demonstrates state sharing between INK narrative and embedded JavaScript minigames.

# IMAGE: coverart/glitchcan-cover-medium.jpg

+ [Minigame Demos] -> minigame_demos
+ [Classic Episodes] -> classic_episodes
+ [Help] -> help

=== minigame_demos ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Experimental minigame integrations showing state sharing between INK and JavaScript games.

**State Sharing Demos:**

+ [Simple Score Game] -> simple_score_demo
+ [Inventory Game] -> inventory_demo
+ [Advanced: GamGam Integration] -> gamgam_integration

=== simple_score_demo ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Simple Score Game Demo

This demo shows how a JavaScript minigame can update INK variables. Your current score: {minigame_score}

Try playing the minigame to see your score update!

# MINIGAME: simple-score
# MINIGAME_PASS: player_name
# MINIGAME_RECEIVE: score, attempts

+ [Play Simple Score Game] -> launch_score_game
+ [Back to Demos] -> minigame_demos

=== launch_score_game ===

Launching minigame...

(In production, this would switch to a canvas-based game component)

Simulating game completion with score: 100

~ minigame_score = 100
~ minigame_attempts = 1

-> score_game_complete

=== score_game_complete ===

Game complete! You scored: {minigame_score}

This demonstrates how minigame results flow back into INK variables.

+ [Play Again] -> launch_score_game
+ [Back to Demos] -> minigame_demos

=== inventory_demo ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Inventory Game Demo

Collected items: {collected_items}
Has red key: {has_red_key}
Has blue key: {has_blue_key}

This demo shows how minigames can modify complex game state (lists, booleans, etc.)

+ [Play Inventory Game] -> launch_inventory_game
+ [Back to Demos] -> minigame_demos

=== launch_inventory_game ===

Launching inventory collection game...

(In production: Canvas game where you collect keys)

Simulating collection...

~ collected_items = 2
~ has_red_key = true
~ has_blue_key = false

-> inventory_game_complete

=== inventory_game_complete ===

Collected {collected_items} items!

{has_red_key:
    You found the red key! This unlocks new story paths.
    + [Use Red Key Path] -> red_key_path
}

{has_blue_key:
    You found the blue key!
}

+ [Play Again] -> launch_inventory_game
+ [Back to Demos] -> minigame_demos

=== red_key_path ===

Using the red key, you unlock a secret passage...

(This demonstrates how minigame results enable new narrative branches)

+ [Continue] -> minigame_demos

=== gamgam_integration ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Advanced: GamGam Web Components Integration

This links to the full gamgam-wc.html implementation showing:
- Canvas-based retro games (Boulder Dash style)
- Full state synchronization
- Multiple minigame types

**External Link:**
https://danbri.github.io/glitchcan-minigam/inklet/gamgam-wc.html

+ [Back to Demos] -> minigame_demos

=== classic_episodes ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Classic FINK Episodes

Interactive fiction stories powered by real INK engine:

+ [🏙️ Hampstead Heath Adventure] -> load_hampstead
+ [🏡 Bagend: Bilbo's Home] -> load_bagend
+ [🏰 Shane Manor Mystery] -> load_shane_manor
+ [⛰️ Mudslidemines Depths] -> load_mudslidemines
+ [🌊 Riverbend Tales] -> load_riverbend
+ [🇺🇦 Ukrainian Language Learning] -> load_ukrainian
+ [🏠 Back to Main] -> main_menu

=== load_hampstead ===
# FINK: ../inklet/hampstead.fink.js
-> external_story

=== load_bagend ===
# FINK: ../inklet/bagend.fink.js
-> external_story

=== load_shane_manor ===
# FINK: ../inklet/shane-manor.fink.js
-> external_story

=== load_mudslidemines ===
# FINK: ../inklet/mudslidemines.fink.js
-> external_story

=== load_riverbend ===
# FINK: ../inklet/riverbend.fink.js
-> external_story

=== load_ukrainian ===
# FINK: ../inklet/tml-2025-langlearn.fink.js
-> external_story

=== help ===

# IMAGE: glitchcan-grey-portrait-web.jpg

App2 - Experimental Integration Help

**What is app2?**

app2 is an experimental entry point for the FINK system that adds:
- Minigame state sharing (INK variables ↔ JavaScript games)
- Event-based component communication
- Modular architecture using gcfink library

**How does state sharing work?**

1. INK story defines variables (score, items, etc.)
2. MINIGAME tag triggers JavaScript component
3. Component receives INK variables as initial state
4. Player plays minigame
5. Results update INK variables
6. Story continues with updated state

**Architecture:**

- Built on gcfink library (FINK extraction + INK compilation)
- Uses Custom Events for component coordination
- Modular design inspired by peer architecture proposal

+ [Back to Main] -> main_menu

=== external_story ===

Loading external story...

(This would be handled by the FINK loader in production)

+ [Return to Main Menu] -> main_menu

`
