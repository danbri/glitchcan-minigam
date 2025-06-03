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

+ [The Hobbit] -> hobbit_selected
+ [Hampstead] -> hampstead_selected
+ [Jungle Mystery] -> jungle_selected

=== learn_menu ===
# IMAGE: glitchcan-grey-portrait-web.jpg


Educational interactive content designed to teach through engaging, story-driven experiences.

+ [Ukrainian Language] -> ukrainian_selected
+ [Developer Guide] -> dev_guide_selected

=== help_menu ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Get help with using the FINK system, understanding controls, and troubleshooting common issues.

This system supports rich multimedia experiences with branching narratives and meaningful consequences. Use browser back and forward buttons to navigate history.

Controls: Eye button hides choices for immersive viewing. Fullscreen button enters maximum immersion mode. Settings loads different stories and adjusts media paths.

FINK stories are JavaScript-based interactive fiction that can load external content and cross-reference each other. All media assets are served relative to the story's base path.

=== hobbit_selected ===
# IMAGE: hobbit/bag_end_exterior.png
# FINK: bagend1.fink.js

The Hobbit - Bag End Adventure

A buggy and broken nod to the classic 1982 text adventure. SVG images by Claude. Follow Bilbo Baggins as he encounters Gandalf and is drawn into an unexpected adventure. Explore the hobbit-hole, meet the dwarves, and begin a journey that will take you far from the comfortable Shire.

Features rich descriptions, character interactions, and puzzle-solving elements faithful to the original game while adding modern storytelling techniques.

+ [Start Adventure] -> external_story

=== hampstead_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: hampstead1.fink.js

Hampstead - Urban Adventure

Navigate the challenging social dynamics of 1980s London. A few scenes inspired by the classic 80s game. No imagery.

+ [Enter Hampstead] -> external_story

=== jungle_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: jungle2.fink.js

Jungle game. A map from a 2D game fed to GPT4o to make 3D. Just a test, nothing to do.

+ [Enter the Jungle] -> external_story

=== ukrainian_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg
# FINK: tml-2025-langlearn.fink.js

Ukrainian Language Learning

Learn Ukrainian food vocabulary and basic grammar through interactive lessons and practice exercises. Proof of concept.

+ [Enter Language demo] -> external_story

=== fiction_primer_selected ===

# IMAGE: glitchcan-grey-portrait-web.jpg

Interactive Fiction Writing Primer

Learn the fundamentals of interactive storytelling, narrative design, and FINK authoring. Explore branching narratives, character development, and world-building techniques used in modern interactive fiction.

This comprehensive guide covers everything from basic choice architecture to advanced narrative techniques, with practical exercises and examples from successful interactive fiction works.

+ [Start Learning] -> help_menu
+ [Back to Learning Menu] -> learn_menu

=== dev_guide_selected ===
# IMAGE: glitchcan-grey-portrait-web.jpg

FINK Developer Guide

Does not exist.

=== external_story ===
Loading external story...

This feature will load the referenced FINK story file. For now, returning to the main menu.

+ [Return to Main Menu] -> main_menu
`
