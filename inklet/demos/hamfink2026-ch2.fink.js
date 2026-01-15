// FINK Chapter 2: The Mega Diamond Dimension
// Loaded via # FINK: tag from hamfink2026.html
// Demonstrates cross-file story loading with state preservation

oooOO`
// Chapter 2: Mega Diamond Dimension
// Variables are preserved from Chapter 1!

VAR diamonds = 0
VAR mega_diamonds = 0
VAR keys = 0
VAR score = 0
VAR portal_stable = false
VAR collected_shard = false

-> mega_dimension_intro

=== mega_dimension_intro ===
# CLASS: mega
CHAPTER 2: THE MEGA DIAMOND DIMENSION

You step through the shimmering portal and emerge in a realm of pure crystalline energy!

{diamonds > 0:
    Your {diamonds} regular diamond{diamonds > 1:s} seem to hum in resonance with this place.
}

The air itself sparkles. Massive gems float overhead, each pulsing with golden light.

A sign carved from pure crystal reads:
"MEGA DIAMONDS - Each worth 1000x a normal gem!"

+ [Explore this dimension] -> explore_mega
+ [Return through the portal] -> return_warning

=== return_warning ===
# CLASS: danger
The portal flickers dangerously. It won't stay stable forever!

You should collect some Mega Diamonds before the portal closes.

+ [Stay and explore] -> explore_mega
+ [Risk the unstable portal anyway] -> early_return

=== early_return ===
You leap back through the flickering portal...

# CLASS: info
You made it! But you missed out on the legendary Mega Diamonds.

{mega_diamonds > 0:
    At least you collected {mega_diamonds} Mega Diamond{mega_diamonds > 1:s} worth {mega_diamonds * 1000} points!
- else:
    You collected nothing from this dimension. A missed opportunity!
}

-> chapter2_end

=== explore_mega ===
The dimension stretches infinitely in all directions. Crystalline structures tower around you.

{mega_diamonds > 0:
    # CLASS: success
    You've collected {mega_diamonds} Mega Diamond{mega_diamonds > 1:s} so far!
}

You see:
- A field of floating Mega Gems to the north
- An ancient Crystal Shrine to the east
- The flickering portal behind you

+ [Enter the Mega Gem field] -> mega_gem_field
+ [Visit the Crystal Shrine] -> crystal_shrine
+ {mega_diamonds >= 3} [Return through the portal (recommended: 3+ Mega Gems)] -> portal_return

=== mega_gem_field ===
# CLASS: mega
You enter a vast field where MEGA DIAMONDS float at eye level!

Each one pulses with incredible power. These are worth 1000x normal diamonds!

+ [Play the MEGA GEM minigame!] -> start_mega_minigame
+ [Return to the main area] -> explore_mega

=== start_mega_minigame ===
# MINIGAME: mega
# CLASS: mega
You reach out toward the floating Mega Diamonds...

[MEGA MINIGAME! These gems are worth 1000x each!]

-> mega_minigame_return

=== mega_minigame_return ===
{mega_diamonds > 0:
    # CLASS: mega
    INCREDIBLE! You captured {mega_diamonds} Mega Diamond{mega_diamonds > 1:s}!

    That's worth {mega_diamonds * 1000} points!
    ~score = score + (mega_diamonds * 1000)
- else:
    # CLASS: danger
    The Mega Diamonds were too fast! Try again!
}

-> explore_mega

=== crystal_shrine ===
An ancient shrine made of pure diamond stands before you. Inside, a single perfect crystal shard floats.

{collected_shard:
    The shrine is now empty - you already took the Crystal Shard.
    -> explore_mega
}

Inscriptions cover the walls:
"The Crystal Shard stabilizes all portals. Take it, traveler."

+ [Take the Crystal Shard] -> take_shard
+ [Leave it alone] -> explore_mega

=== take_shard ===
~collected_shard = true
~portal_stable = true
~score = score + 500

# CLASS: success
You take the Crystal Shard! It dissolves into your essence.

The portal behind you stops flickering - it's now permanently stable!

BONUS: +500 points for securing your escape route!

+ [Continue exploring] -> explore_mega

=== portal_return ===
{portal_stable:
    # CLASS: success
    Thanks to the Crystal Shard, the portal is completely stable!
- else:
    # CLASS: danger
    The portal flickers wildly! You dive through just in time!
}

You emerge back in the hillside overlooking the peaceful valley.

-> chapter2_end

=== chapter2_end ===
# CLASS: success
=== CHAPTER 2 COMPLETE! ===

Your adventure statistics:

Regular Diamonds: {diamonds}
MEGA Diamonds: {mega_diamonds}
Keys remaining: {keys}

{mega_diamonds > 0:
    # CLASS: mega
    MEGA BONUS: {mega_diamonds} x 1000 = {mega_diamonds * 1000} points!
}

TOTAL SCORE: {score} points

{collected_shard:
    # CLASS: info
    You secured the Crystal Shard - portals will always be stable for you now!
}

+ [View source code info] -> source_info
+ [Return to Chapter 1] -> back_to_chapter1

=== source_info ===
# CLASS: code
This Chapter 2 story was loaded from:

hamfink2026-ch2.fink.js

It uses the oooOO template literal format and was loaded via the # FINK: tag in Chapter 1.

State (diamonds, score, etc.) was preserved across the chapter transition!

Key code patterns:
- oooOO\`...\` wraps the entire Ink content
- # MINIGAME: mega triggers the mega gem minigame
- Variables sync between JavaScript and Ink

+ [Back to ending] -> chapter2_end

=== back_to_chapter1 ===
# FINK: hamfink2026.html
Returning to the main story...

-> chapter2_end
`
