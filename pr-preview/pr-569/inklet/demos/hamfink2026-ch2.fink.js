// FINK Chapter 2: The Mega Diamond Dimension
// Loaded via # FINK: tag from hamfink2026.html
// Demonstrates cross-file story loading with state preservation
// Uses STRAWMAN namespace preprocessor for variable scoping

oooOO`
// Chapter 2: Mega Diamond Dimension
// IMPORT/EXPORT tags declare variable contracts with parent chapter

# IMPORT: diamonds, mega_diamonds, keys, score
# EXPORT: mega_diamonds, was_mugged

// Imported vars need VAR declarations for Ink compiler,
// but values are injected by loader (overwriting defaults)
VAR diamonds = 0
VAR mega_diamonds = 0
VAR keys = 0
VAR score = 0

// Chapter-local vars (will be auto-namespaced by preprocessor)
VAR portal_stable = false
VAR collected_shard = false
VAR was_mugged = false

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
--- CHAPTER 2 COMPLETE! ---

Your adventure statistics:

Regular Diamonds: {diamonds}
MEGA Diamonds: {mega_diamonds}
Keys remaining: {keys}

{mega_diamonds > 0:
    # CLASS: mega
    MEGA BONUS: {mega_diamonds} x 1000 = {mega_diamonds * 1000} points!
}

TOTAL SCORE: {score} points

// Check if too wealthy - triggers mugging!
{mega_diamonds >= 5:
    -> too_wealthy_warning
}

{collected_shard:
    # CLASS: info
    You secured the Crystal Shard - portals will always be stable for you now!
}

+ [Enter the Wood Between the Worlds] -> wood_between_worlds
+ [🎓 Chapter 3: The Auto-Icon Incident] -> load_chapter3
+ [View source code info] -> source_info
+ [Return to Chapter 1] -> back_to_chapter1

=== too_wealthy_warning ===
# CLASS: danger
But wait... your pockets bulge with {mega_diamonds} Mega Diamonds!

The glint of your wealth has attracted attention. Shadowy figures emerge from the treeline.

"That's quite a haul you've got there, friend..."

+ [Try to run!] -> mugging_attempt
+ [Offer to share] -> mugging_attempt

=== mugging_attempt ===
~was_mugged = true

# CLASS: danger
The bandits are too fast! They surround you in moments.

"We'll be taking those Mega Diamonds. ALL of them."

They rifle through your pockets, taking everything...

~mega_diamonds = 0
~diamonds = 1
~keys = 0
~score = 0

...except a single ordinary diamond that slipped through a hole in your pocket.

# CLASS: info
You're left with exactly 1 diamond.

One of the bandits laughs. "Try your luck in Hampstead, maybe? I hear there's opportunities there for the... resourceful."

A shimmering portal opens behind them - it leads to a grimy London street.

+ [Step through to Hampstead...] -> portal_to_hampstead

=== portal_to_hampstead ===
# FINK: ../hampstead.fink.js
# CLASS: info
You step through the portal into the neon-lit drizzle of 1980s London...

With nothing but a single diamond and your wits, you'll have to start over.

-> END

=== wood_between_worlds ===
# CLASS: info
--- THE WOOD BETWEEN THE WORLDS ---

You find yourself in a quiet forest. The trees are enormous, their leaves filtering golden light. The air is warm and still.

Scattered across the mossy ground are pools of water - each one perfectly circular, perfectly still, reflecting different skies.

You remember reading about this place... in a book, long ago. Each pool leads to a different world.

You can see your reflection in several pools nearby:

+ [A pool showing a cozy hobbit-hole] -> pool_bagend
+ [A pool showing dark underground mines] -> pool_mines
+ [A pool showing a chocolate-box village] -> pool_riverbend
+ [A misty pool with strange symbols] -> pool_mystery
+ [Return the way you came] -> leave_wood

=== pool_bagend ===
# CLASS: info
The pool shows a round green door set into a hillside. Smoke rises from a chimney. A wizard in grey robes approaches the door...

"Bag End," you whisper. The words feel familiar.

This pool leads to the Shire - to a hobbit's comfortable home, just before an unexpected adventure begins.

+ [Step into the pool...] -> enter_bagend
+ [Look at other pools] -> wood_between_worlds

=== enter_bagend ===
# FINK: ../bagend.fink.js
# CLASS: success
You step into the pool. The water is warm, like a bath. You sink through it...

...and emerge, somehow dry, standing before a round green door.

A sign reads: "Bag End"

-> END

=== pool_mines ===
# CLASS: danger
This pool is darker than the others. You can barely make out the reflection - torchlight flickering off wet stone walls, the glint of gems in the darkness...

"The Mudslide Mines," you sense somehow. A place of danger and treasure.

Rocks tumble. Something moves in the shadows.

+ [Brave the mines...] -> enter_mines
+ [Look at other pools] -> wood_between_worlds

=== enter_mines ===
# FINK: ../mudslidemines.fink.js
# CLASS: danger
You take a breath and plunge into the dark pool...

The cold hits you first. Then the smell of damp earth and old stone.

You're underground. The mineshaft stretches ahead.

-> END

=== pool_riverbend ===
# CLASS: success
This pool shows a picture-perfect English village. Thatched cottages, a village green, a pub with hanging baskets of flowers...

But something feels wrong. The villagers' smiles seem fixed. Curtains twitch.

"Riverbend," the name comes to you. "Where everyone has secrets."

+ [Enter the village...] -> enter_riverbend
+ [Look at other pools] -> wood_between_worlds

=== enter_riverbend ===
# FINK: ../riverbend.fink.js
# CLASS: info
You step into the peaceful pool...

...and emerge on a village green. Birds sing. A church bell chimes.

Everything seems perfect. Perhaps too perfect.

-> END

=== pool_mystery ===
# CLASS: info
This pool ripples strangely, even though there's no wind. The reflection shows... text? Symbols?

Ukrainian letters swim across the surface: Привіт...

A language lesson? In a magic pool?

The multiverse is strange indeed.

+ [Dive into learning...] -> enter_language
+ [Look at other pools] -> wood_between_worlds

=== enter_language ===
# FINK: ../tml-2025-langlearn.fink.js
# CLASS: info
You touch the surface and words flow into your mind...

Привіт means hello. Дякую means thank you.

The pool pulls you in, and suddenly you're learning Ukrainian.

-> END

=== leave_wood ===
The way back seems to have closed. The pool you came through has gone still and dark.

You'll need to choose another world... or stay here forever, in this peaceful in-between place.

+ [Look at the pools again] -> wood_between_worlds

=== source_info ===
# CLASS: code
This Chapter 2 story was loaded from:

hamfink2026-ch2.fink.js

It uses the oooOO template literal format and was loaded via the # FINK: tag in Chapter 1.

State (diamonds, score, etc.) was preserved across the chapter transition!

Key code patterns:
- oooOO\`...\` wraps the entire Ink content
- # MINIGAME: mega triggers the mega gem minigame
- # FINK: loads external stories
- Variables sync between JavaScript and Ink

The Wood Between the Worlds connects to:
- ../bagend.fink.js (Hobbit adventure)
- ../mudslidemines.fink.js (Underground mines)
- ../riverbend.fink.js (Village mystery)
- ../tml-2025-langlearn.fink.js (Language learning)
- ../hampstead.fink.js (80s London - via mugging!)

+ [Back to ending] -> chapter2_end

=== load_chapter3 ===
# CLASS: info
Loading Chapter 3: The Auto-Icon Incident...

A strange portal opens, leading to UCL's engineering basement at 2:47 AM...

# FINK: hamfink2026-ch3.fink.js
-> END

=== back_to_chapter1 ===
# RESTART
Returning to the beginning...

-> END
`
