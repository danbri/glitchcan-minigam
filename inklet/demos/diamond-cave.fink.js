oooOO`
// FINK 2-Engine Demo Story
// Demonstrates Ink variables updated by minigame

VAR diamonds = 0
VAR mega_diamonds = 0
VAR keys = 0
VAR score = 0
VAR minigame_played = false
VAR cavern_explored = false
VAR tried_passage = false

-> intro

=== intro ===
You awaken in a shimmering underground cavern. Crystals gleam in the darkness, casting prismatic light across damp stone walls.

Your pockets are empty. No gems, no keys, nothing.

The only way out is through the locked passage ahead. You'll need to collect gems to escape.

+ [Look around carefully] -> look_around
+ [Call out into the darkness] -> call_out
+ [Dev: How it works / Tours] -> how_it_works
+ [Dev: Skip to World Pools] -> dev_pools

=== look_around ===
{cavern_explored:
    You've already surveyed the cavern. The gem-studded alcove beckons - your only hope of escape.
    -> cavern_choices
}

~cavern_explored = true
Your eyes adjust to the gloom. You spot:
- A narrow passage with a heavy iron door - LOCKED
- An alcove filled with glittering gems
- Strange symbols carved into the floor

-> cavern_choices

=== cavern_choices ===
+ [Enter the gem alcove] -> gem_alcove
+ [Examine the symbols] -> examine_symbols
+ [Try the narrow passage] -> narrow_passage

=== call_out ===
"Hello?" Your voice echoes endlessly.

Something stirs in the darkness. Perhaps silence would have been wiser.

+ [Hide behind a boulder] -> hide
+ [Stand your ground] -> stand_ground

=== hide ===
You duck behind a large boulder, heart pounding.

The stirring fades. Whatever it was has moved on... for now.

-> look_around

=== stand_ground ===
You plant your feet firmly. A bat swoops past your head and disappears into the darkness.

Just a bat. You exhale with relief.

-> look_around

=== gem_alcove ===
The alcove sparkles with countless gems embedded in the walls!

{diamonds > 0:
    Your pouch holds {diamonds} diamond{diamonds > 1:s}.
}
{diamonds < 5:
    You need at least 5 diamonds to unlock the crystal door.
}

+ [Mine for gems!] -> start_minigame
+ {diamonds >= 5} [Use 5 diamonds to unlock the crystal door] -> crystal_door
+ [Return to the main cavern] -> cavern_choices

=== start_minigame ===
# MINIGAME: gems
You focus your attention on the gem-studded walls...

[The minigame will start - collect as many gems as you can!]

-> gem_alcove_return

=== gem_alcove_return ===
{minigame_played:
    {diamonds > 0:
        # CLASS: success
        Excellent work! You now have {diamonds} diamond{diamonds > 1:s} in your pouch.
        ~score = score + diamonds
    - else:
        # CLASS: danger
        You didn't manage to collect any gems. Try again - you NEED them to escape!
    }
}

-> gem_alcove

=== crystal_door ===
{diamonds < 5:
    # CLASS: danger
    The crystal door requires 5 diamonds to open. You only have {diamonds}.
    -> gem_alcove
}

You press 5 diamonds into the door's receptacles. They glow brilliantly!

~diamonds = diamonds - 5
~keys = keys + 1

# CLASS: success
The door slides open, revealing a golden key floating in mid-air!

You take the key. It feels warm in your hand.

+ [Take the key and head for the exit!] -> narrow_passage

=== examine_symbols ===
The symbols appear to be an ancient counting system.

{diamonds > 0:
    Curiously, the number {diamonds} seems highlighted.
}

The inscription reads: "Five gems open the crystal gate. Beyond lies the key to freedom."

{diamonds < 5:
    # CLASS: info
    You definitely need to collect more gems from the alcove.
}

+ [Understood.] -> cavern_choices

=== narrow_passage ===
{keys < 1:
    ~tried_passage = true
    The passage ends at a locked iron door. The lock looks complex.

    # CLASS: danger
    You need a key! The crystal door in the gem alcove might hold one...

    + [Return to the cavern] -> cavern_choices
}

Your golden key fits the lock perfectly!

~keys = keys - 1
~score = score + 100

# CLASS: success
The door swings open to reveal daylight streaming in from above!

-> victory

=== victory ===
# CLASS: success
You climb toward the light and emerge onto a hillside overlooking a peaceful valley.

ESCAPED! Final Score: {score} points

{mega_diamonds > 0:
    # CLASS: mega
    MEGA DIAMOND BONUS: {mega_diamonds * 1000} points!
    ~score = score + (mega_diamonds * 1000)
}

But wait... in the distance, you see a shimmering portal leading to deeper caverns. Legends speak of MEGA DIAMONDS worth 1000x more!

+ [Enter the Mega Diamond Dimension!] -> load_chapter2
+ [View how this demo works] -> how_it_works
+ [Play again?] -> restart

=== load_chapter2 ===
# FINK: hamfink2026-ch2.fink.js
# CLASS: mega
You step through the portal into a realm of pure crystalline energy...

-> external_loading

=== external_loading ===
Loading next chapter...

-> victory

=== how_it_works ===
# CLASS: info
# BASEHREF: ../../media/
# VIDEO: 9C2A6066-A174-4C64-A0B2-D0BE87B23792_2025-03-07T09-02-01_upscaled.mp4

This is a 2-engine demo: Ink storytelling + JavaScript minigames.

+ [🎵 FOLEY Sound Tour] -> foley_tour
+ [🎮 Minigame Tour] -> minigame_tour
+ [🎬 Video Tour] -> video_tour
+ [🗺️ Adventures Tour] -> adventures_tour
+ [🌀 World Between Worlds] -> wbw_portal
+ [🔧 Dev Tools / Godmode] -> dev_tools
+ [View source on GitHub] -> github_links
+ [Return to start] -> intro
+ [Return to ending] -> victory

=== video_tour ===
# CLASS: info
Videos can be embedded in stories via the VIDEO tag.

Available video scenes:
- 🐤 Glitch Canary (used in Hampstead fraud warning)
- 🔥 Burning Mill (Riverbend dramatic scene)
- 🤖 Robot Mech animations

+ [🐤 Glitch Canary (fraud warning)] -> test_glitch_canary
+ [🔥 Burning Mill] -> test_burning_mill
+ [📺 Jump to Hampstead Giro Fraud] -> load_hampstead_fraud
+ [Back] -> how_it_works

=== test_glitch_canary ===
#BG:#113
# CLASS: warning
# BASEHREF: ../../media/
A TV on the wall flickers to life...

# VIDEO: 9C2A6066-A174-4C64-A0B2-D0BE87B23792_2025-03-07T09-02-01_upscaled.mp4

The surreal glitch effect disorients you.

+ [Back to tour] -> video_tour

=== test_burning_mill ===
#BG:#200
# CLASS: danger
# BASEHREF: ../../media/
Flames consume the old mill...

# VIDEO: 5437e4f1_e62e_4211_a301_9306d1ca3c9c.mp4

The heat is unbearable.

+ [Back to tour] -> video_tour

=== load_hampstead_fraud ===
# CLASS: info
Loading Hampstead adventure at giro fraud scene...

# FINK: ../hampstead.fink.js

-> END

=== minigame_tour ===
# CLASS: info
Minigames can be embedded in stories via tags or links.

Available minigames:
- 💎 Gem Collector (this demo's built-in)
- ♕ Mamikon Mini-Chess (queen vs king puzzle)

+ [♕ Play Mini-Chess (new tab)] -> minichess_link
+ [💎 Play Gem Collector] -> gems_demo
+ [Back] -> how_it_works

=== minichess_link ===
# CLASS: info
Mamikon Mini-Chess: Force the black king onto the skull square (💀).

Queen moves first. The king tries to escape or capture. There's a forced win!

<a href="../../thumbwar/minichess.html" target="_blank">♕ Open Mini-Chess</a>

+ [Back to tour] -> minigame_tour

=== gems_demo ===
# CLASS: info
Collect gems before they fade! 💎

# MINIGAME: normal

-> minigame_tour

=== foley_tour ===
# CLASS: info
# FOLEY: stop
The FOLEY tag system creates layered procedural ambient audio.

Syntax: \# FOLEY: type(param:value, ...)

Sound types: wind, water, fire, machinery, rumble

+ [🌊 Riverbend (water + wind)] -> load_riverbend
+ [🔥 Test Fire + Machinery] -> test_fire_machinery
+ [🌬️ Test Wind + Rumble] -> test_wind_rumble
+ [⏹️ Stop All Sounds] -> stop_all_foley
+ [Back] -> how_it_works

=== load_riverbend ===
# CLASS: info
Loading Riverbend with atmospheric foley...
# FINK: ../riverbend.fink.js
-> END

=== test_fire_machinery ===
# FOLEY: fire(vol:0.7, crackle:0.8, pan:-0.3)
# FOLEY: machinery(vol:0.4, throb:1.5, pan:0.4)
Fire crackling to your left... machinery throbbing to your right.
+ [Stop and try another] -> foley_tour

=== test_wind_rumble ===
# FOLEY: wind(vol:0.6, gust:0.7)
# FOLEY: rumble(vol:0.3, pitch:0.6)
Howling wind with deep ominous rumble beneath.
+ [Stop and try another] -> foley_tour

=== stop_all_foley ===
# FOLEY: stop
Silence.
+ [Back to FOLEY tour] -> foley_tour

=== adventures_tour ===
# CLASS: info
External FINK adventures demonstrate variables, conditionals, and branching stories.

+ [🏚️ Shane Manor Mystery (chess + detective)] -> load_shane_manor
+ [🚇 Hampstead Adventure (fraud storyline)] -> load_hampstead_full
+ [⛏️ Mudslide Mines (exploration)] -> load_mudslide
+ [🏠 Bagend (Tolkien tribute)] -> load_bagend
+ [🌊 Riverbend (atmospheric)] -> load_riverbend_adventure
+ [Back] -> how_it_works

=== load_shane_manor ===
# CLASS: info
Loading Shane Manor Mystery...
# FINK: ../shane-manor.fink.js
-> END

=== load_hampstead_full ===
# CLASS: info
Loading Hampstead Adventure...
# FINK: ../hampstead.fink.js
-> END

=== load_mudslide ===
# CLASS: info
Loading Mudslide Mines...
# FINK: ../mudslidemines.fink.js
-> END

=== load_bagend ===
# CLASS: info
Loading Bagend...
# FINK: ../bagend.fink.js
-> END

=== load_riverbend_adventure ===
# CLASS: info
Loading Riverbend...
# FINK: ../riverbend.fink.js
-> END

=== dev_tools ===
# CLASS: code
# GODMODE: show
Developer tools for testing and debugging.

Godmode panel appears above. Click variable values to edit them.

+ [🌌 World Between Worlds] -> dev_pools
+ [Back] -> how_it_works

=== dev_pools ===
# CLASS: info
Teleporting to the World Between Worlds...
# FINK: dev-worldpools.fink.js
-> END

=== github_links ===
# CLASS: code
Source files in the inklet/demos folder:
- Main demo (HTML with embedded Ink)
- Chapter 2 (external FINK file)

View all source: https://github.com/danbri/glitchcan-minigam/tree/main/inklet/demos

+ [Back to ending] -> victory
+ [Play again?] -> restart

=== wbw_portal ===
#BG:#203
# CLASS: info
The World Between Worlds serves as a hub connecting all FINK adventures. It demonstrates cross-story navigation, minigame integration, and the pool metaphor for story transitions.
# FINK: ../world-between-worlds.fink.js
+ [Enter the World Between Worlds] -> END

=== restart ===
~diamonds = 0
~mega_diamonds = 0
~keys = 0
~score = 0
~minigame_played = false
~cavern_explored = false
~tried_passage = false

-> intro
`;
