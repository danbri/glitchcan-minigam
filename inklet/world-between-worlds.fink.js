oooOO`
// The World Between Worlds - A hub connecting all adventures
// Inspired by the Wood Between the Worlds from The Magician's Nephew

-> world_between_worlds

=== world_between_worlds ===
#BG:#020
# AUDIO: synth:wind
*** THE WORLD BETWEEN WORLDS ***

A vast, quiet wood stretches in all directions. The trees are ancient beyond measure, their leaves whispering secrets in a language older than words.

Scattered throughout the glade are pools - perfectly still, perfectly round, each reflecting a different sky.

+ Approach the golden pool (warm light, distant hills) -> pool_bagend
+ Peer into the dark pool (flickering torches, stone walls) -> pool_mines
+ Examine the misty pool (manor silhouette, ravens) -> pool_manor
+ Study the gentle pool (autumn leaves, chimney smoke) -> pool_maple
+ Look into the rippling pool (flowing water, reeds) -> pool_riverbend
+ Approach the shimmering pool (arcade lights, pixel glow) -> pool_arcade
+ Sit quietly among the pools -> rest_here

=== pool_bagend ===
#BG:#141
# IMAGE: media/bagend/adventure_path.svg
The golden pool shows rolling green hills and round doors set into hillsides. Smoke rises from a chimney. A wizard in grey robes approaches a door...

+ Step into the pool
    The warm light envelops you...
    # FINK: bagend.fink.js
    -> END
+ Return to the glade -> world_between_worlds

=== pool_mines ===
#BG:#210
# IMAGE: media/mudslidemines/cave_entrance.svg
The dark pool shows torchlit tunnels and glittering ore veins. The distant clang of pickaxes echoes from somewhere deep below.

+ Descend into the pool
    The darkness swallows you...
    # FINK: mudslidemines.fink.js
    -> END
+ Return to the glade -> world_between_worlds

=== pool_manor ===
#BG:#203
# IMAGE: media/shane/manor_exterior.jpg
The misty pool shows a grand but crumbling manor house. Ravens circle its chimneys. One window glows with candlelight.

+ Enter the pool
    The mist closes around you...
    # FINK: shane-manor.fink.js
    -> END
+ Return to the glade -> world_between_worlds

=== pool_maple ===
#BG:#320
The gentle pool shows a cozy village nestled in autumn woods. Smoke rises from cottages. A cat sleeps on a windowsill.

+ Slip into the pool
    Warmth surrounds you...
    # FINK: ../cozyverse/maple-hollow.fink.js
    -> END
+ Return to the glade -> world_between_worlds

=== pool_riverbend ===
#BG:#024
The rippling pool shows a wide river winding through marshland. Herons stand motionless. A small boat is tied to a dock.

+ Wade into the pool
    The current takes you...
    # FINK: riverbend.fink.js
    -> END
+ Return to the glade -> world_between_worlds

=== pool_arcade ===
#BG:#202
The shimmering pool pulses with neon light. Pixelated shapes dance across its surface - ghosts, gems, strange creatures battling in formations.

+ Step into the arcade
    The pixels swirl around you...
    -> arcade_hangout
+ Return to the glade -> world_between_worlds

=== arcade_hangout ===
#BG:#101
*** PIXEL ARCADE ***

You stand in a glowing space filled with floating game cabinets. Each one hums with potential adventure.

+ [Gem Hunt] Collect sparkling gems -> play_gems
+ [Mudslider] Boulder Dash-style puzzle -> play_mudslider
+ [BoidWars] Command your wizard flock -> play_battleboids
+ [GridLuck] Pac-Man style maze chase -> play_gridluck
+ Return to the World Between Worlds -> world_between_worlds

=== play_gems ===
# MINIGAME: gems
Gems scatter before you, waiting to be collected...
-> arcade_return

=== play_mudslider ===
# MINIGAME: mudslider
The cave entrance yawns before you...
-> arcade_return

=== play_battleboids ===
# MINIGAME: battleboids
Flocks of strange creatures await your command...
-> arcade_return

=== play_gridluck ===
# MINIGAME: gridluck
The maze materializes around you...
-> arcade_return

=== arcade_return ===
You return to the arcade, the glow of games surrounding you.

+ Play another game -> arcade_hangout
+ Return to the World Between Worlds -> world_between_worlds

=== rest_here ===
#BG:#020
You sit on the soft moss between the pools. The quiet is absolute. Time moves differently here - or perhaps not at all.

In the stillness, you sense that each pool connects to a different world, a different story. You could spend eternity exploring them all.

+ Rise and look at the pools again -> world_between_worlds
+ Close your eyes and drift... -> drift_away

=== drift_away ===
#BG:#000
You close your eyes in the World Between Worlds.

When you open them again, where will you be?

+ [Open your eyes] -> world_between_worlds
`
