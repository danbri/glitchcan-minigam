oooOO`
// DEV SHORTCUT: Jump directly to World Between Worlds pools
// This bypasses the Hampstead adventure for testing FINK navigation

VAR mega_diamonds = 12

-> world_between_worlds

=== world_between_worlds ===
#BG:#020
#CLASS:info
*** THE WORLD BETWEEN WORLDS ***

[Dev shortcut - You have {mega_diamonds} mega diamonds]

A vast, quiet wood stretches in all directions. The trees are ancient beyond measure.

Scattered throughout the glade are pools - perfectly still, perfectly round, each reflecting a different sky.

+ Approach the golden pool (Bag End) -> pool_bagend
+ Peer into the dark pool (Mudslide Mines) -> pool_mines
+ Examine the misty pool (Shane Manor) -> pool_manor
+ Study the gentle pool (Maple Hollow) -> pool_maple
+ Look into the rippling pool (Riverbend) -> pool_riverbend

=== pool_bagend ===
#BG:#141
# IMAGE: ../media/bagend/adventure_path.svg
The golden pool shows rolling green hills and round doors set into hillsides.

+ Step into the pool
    # FINK: ../bagend.fink.js
    The warm light envelops you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_mines ===
#BG:#210
The dark pool shows torchlit tunnels and glittering ore veins.

+ Descend into the pool
    # FINK: ../mudslidemines.fink.js
    The darkness swallows you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_manor ===
#BG:#203
The misty pool shows a grand but crumbling manor house. Ravens circle its chimneys.

+ Enter the pool
    # FINK: ../shane-manor.fink.js
    The mist closes around you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_maple ===
#BG:#320
The gentle pool shows a cozy village nestled in autumn woods.

+ Slip into the pool
    # FINK: ../../cozyverse/maple-hollow.fink.js
    Warmth surrounds you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_riverbend ===
#BG:#024
The rippling pool shows a wide river winding through marshland.

+ Wade into the pool
    # FINK: ../riverbend.fink.js
    The current takes you...
    -> END
+ Return to the glade -> world_between_worlds
`
