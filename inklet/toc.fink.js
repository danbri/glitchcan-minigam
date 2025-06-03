oooOO`

# MENU: 🏠 Main Menu -> main_menu
# MENU: 🎮 Game Selection -> games_menu
# MENU: 📚 Learning Hub -> learn_menu

# BASEHREF: media/

-> main_menu

=== main_menu ===
# IMAGE: villaged/peaceful_sunset.png
Welcome to the FINK Collection! Choose your path to discover interactive stories, educational experiences, and helpful resources.

+ [Games] -> games_menu
+ [Learn] -> learn_menu  
+ [Help] -> help_menu

=== games_menu ===
# IMAGE: glitchcan-grey-portrait-web.jpg
Games

Choose your adventure! Each game offers a unique interactive experience with rich storytelling and meaningful choices.

+ [Bagend] -> hobbit_selected
+ [Hampstead] -> hampstead_selected
+ [Mudslide Mines] -> jungle_selected
+ [Riverbend] -> riverbend_selected

=== learn_menu ===
# IMAGE: glitchcan-grey-portrait-web.jpg


Educational interactive content designed to teach through engaging, story-driven experiences.

+ [Ukrainian Language] -> ukrainian_selected
+ [Developer Guide] -> dev_guide_selected

=== help_menu ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Get help with using the FINK system, understanding controls, and troubleshooting common issues.

FINK stories are JavaScript-based interactive fiction that can load external content and cross-reference each other. All media assets are served relative to the story's base path.

This is where things might be documented, eventually.

=== hobbit_selected ===

# IMAGE: hobbit/bag_end_exterior.png
# FINK: bagend.fink.js

Bag End

A buggy and broken nod to the classic 1982 text adventure, The Hobbit. SVG images by Claude. Follow Bilbo Baggins as he encounters Gandalf and is drawn into an unexpected adventure. Explore the hobbit-hole, meet the dwarves, and begin a journey that will take you far from the comfortable Shire.


+ [enter Bag End] -> external_story

=== hampstead_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: hampstead.fink.js

Hampstead

Navigate the challenging social dynamics of 1980s London. A few scenes inspired by the classic 80s game. No images.

+ [enter Hampstead] -> external_story

=== jungle_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: jungle.fink.js

Mudslide Mines! Experimenting with alternate interface to a 2D pseudo-platformer. Test only.

+ [enter Mudslide Mines] -> external_story

=== riverbend_selected ===

# IMAGE: riverbend/village_overview.png
# FINK: riverbend.fink.js

Riverbend - Village Mystery

Discover the secrets of a chocolate-box-perfect village where greed and jealousy bind neighbours together in a conspiracy of silence.

+ [Enter Riverbend] -> external_story

=== ukrainian_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: tml-2025-langlearn.fink.js

Ukrainian Language Learning

Learn Ukrainian food vocabulary and basic grammar through interactive lessons and practice exercises. Proof of concept.

+ [Enter Language demo] -> external_story

=== dev_guide_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg

FINK Developer Guide

Does not exist.

=== external_story ===
Loading external story...

This feature will load the referenced FINK story file. For now, returning to the main menu.

+ [Return to Main Menu] -> main_menu
`
