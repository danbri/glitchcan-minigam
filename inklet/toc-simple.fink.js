oooOO`
# MENU: 🏠 Main Menu -> main_menu
# MENU: 🎮 Game Selection -> games_menu
# MENU: 📚 Learning Hub -> learn_menu

-> main_menu

=== main_menu ===
# IMAGE: peaceful_sunset.png
Welcome to the FINK Collection! Choose your path to discover interactive stories, educational experiences, and helpful resources.

+ [Games] -> games_menu
+ [Learn] -> learn_menu  
+ [Help] -> help_menu

=== games_menu ===
# IMAGE: adventure_path.png
Games

Choose your adventure! Each game offers a unique interactive experience with rich storytelling and meaningful choices.

+ [The Hobbit] -> hobbit_selected
+ [Hampstead] -> hampstead_selected
+ [Jungle Mystery] -> jungle_selected
+ [Back to Main Menu] -> main_menu

=== learn_menu ===
# IMAGE: village_overview.png
Learn

Educational interactive content designed to teach through engaging, story-driven experiences.

+ [Ukrainian Language] -> ukrainian_selected
+ [Fiction Writing Primer] -> fiction_primer_selected
+ [Developer Guide] -> dev_guide_selected
+ [Back to Main Menu] -> main_menu

=== help_menu ===
# IMAGE: village_overview.png
Get help with using the FINK system, understanding controls, and troubleshooting common issues.

This system supports rich multimedia experiences with branching narratives and meaningful consequences. Use browser back and forward buttons to navigate history.

Controls: Eye button hides choices for immersive viewing. Fullscreen button enters maximum immersion mode. Settings loads different stories and adjusts media paths.

FINK stories are JavaScript-based interactive fiction that can load external content and cross-reference each other. All media assets are served relative to the story's base path.

+ [Back to Main Menu] -> main_menu

=== hobbit_selected ===
# IMAGE: bag_end_exterior.png
# FINK: bagend1.fink.js

The Hobbit - Bag End Adventure

A tribute to the classic 1982 text adventure. Follow Bilbo Baggins as he encounters Gandalf and is drawn into an unexpected adventure. Explore the hobbit-hole, meet the dwarves, and begin a journey that will take you far from the comfortable Shire.

Features rich descriptions, character interactions, and puzzle-solving elements faithful to the original game while adding modern storytelling techniques.

+ [Start Adventure] -> external_story
+ [Back to Games Menu] -> games_menu

=== hampstead_selected ===
# IMAGE: village_overview.png  
# FINK: hampstead1.fink.js

Hampstead - Urban Adventure

Navigate the challenging social dynamics of 1980s London. Start with nothing but ambition in a grotty bedsit and work your way up through wit, charm, and strategic choices. Can you climb the social ladder to reach the prestigious heights of Hampstead?

This story explores themes of class, ambition, and social mobility through an interactive narrative filled with memorable characters and consequential decisions.

+ [Begin Urban Adventure] -> external_story
+ [Back to Games Menu] -> games_menu

=== jungle_selected ===
# IMAGE: village_overview.png
# FINK: jungle2.fink.js

Jungle Mystery - Amazon Adventure

Journey deep into the Amazon rainforest where ancient civilizations left behind mysterious artifacts and deadly secrets. Navigate treacherous terrain, decode ancient puzzles, and uncover the truth behind a lost civilization.

Featuring survival elements, environmental storytelling, and choices that affect both your character's fate and the preservation of ancient knowledge.

+ [Enter the Jungle] -> external_story
+ [Back to Games Menu] -> games_menu

=== ukrainian_selected ===
# IMAGE: village_overview.png
# FINK: tml-2025-langlearn.fink.js

Ukrainian Language Learning

Learn Ukrainian food vocabulary and basic grammar through interactive lessons and practice exercises. Master essential words like хліб (bread), сир (cheese), and practice nominative and accusative cases through engaging story-driven exercises.

This educational experience combines language learning with cultural context, helping you understand both the language and Ukrainian traditions around food and hospitality.

+ [Start Learning] -> external_story
+ [Back to Learning Menu] -> learn_menu

=== fiction_primer_selected ===
# IMAGE: village_overview.png

Interactive Fiction Writing Primer

Learn the fundamentals of interactive storytelling, narrative design, and FINK authoring. Explore branching narratives, character development, and world-building techniques used in modern interactive fiction.

This comprehensive guide covers everything from basic choice architecture to advanced narrative techniques, with practical exercises and examples from successful interactive fiction works.

+ [Start Learning] -> help_menu
+ [Back to Learning Menu] -> learn_menu

=== dev_guide_selected ===
# IMAGE: village_overview.png

FINK Developer Guide

Technical documentation for authoring FINK stories, integrating multimedia assets, and implementing advanced interactive features. Learn about the FINK syntax, asset management, cross-story linking, and best practices for creating polished interactive experiences.

Covers everything from basic story structure to advanced features like conditional text, variable systems, and external content integration.

+ [View Documentation] -> help_menu
+ [Asset Integration] -> help_menu
+ [Story Structure Guide] -> help_menu
+ [Back to Learning Menu] -> learn_menu

=== external_story ===
Loading external story...

This feature will load the referenced FINK story file. For now, returning to the main menu.

+ [Return to Main Menu] -> main_menu
`