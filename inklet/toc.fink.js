oooOO`
// Table of Contents - FINK Story Collection
// Main menu for navigating between different FINK stories

-> main_menu

=== main_menu ===
IMAGE: peaceful_sunset.png
Welcome to the FINK Story Collection! Choose your adventure from the stories available below. Each offers a unique interactive experience with rich storytelling and meaningful choices.

+ [The Hobbit - Bag End Adventure]
    A tribute to the classic 1982 adventure game. Begin your journey as Bilbo Baggins in the comfort of Bag End, where Gandalf arrives with an unexpected proposal for adventure.
    -> hobbit_selected

+ [Hampstead - Urban Adventure]  
    Navigate the gritty streets of 1980s London in this text adventure. From a grotty bedsit to the heights of Hampstead, can you climb the social ladder?
    -> hampstead_selected

+ [Jungle Mystery - Coming Soon]
    Deep in the Amazon rainforest, ancient secrets await discovery. This adventure is still being crafted...
    -> jungle_selected

=== hobbit_selected ===
IMAGE: elara_cottage.png
FINK: bagend1.fink.js
You have selected The Hobbit - Bag End Adventure.

This story follows Bilbo Baggins as he encounters Gandalf and is drawn into an unexpected adventure. Explore the hobbit-hole, meet the dwarves, and begin a journey that will take you far from the comfortable Shire.

+ [Begin the Adventure]
    -> EXTERNAL_STORY
+ [Return to Menu] -> main_menu
+ [Learn More About This Story]
    Based on the classic 1982 text adventure, this adaptation captures the whimsical spirit of Tolkien's world while adding modern interactive storytelling elements.
    -> hobbit_selected

=== hampstead_selected ===
IMAGE: village_overview.png
FINK: hampstead1.fink.js
You have selected Hampstead - Urban Adventure.

A gritty social climbing simulator set in 1980s London. Start in a bedsit and work your way up through wit, charm, and careful networking to reach the prestigious heights of Hampstead.

+ [Begin the Adventure] 
    -> EXTERNAL_STORY
+ [Return to Menu] -> main_menu
+ [Learn More About This Story]
    This story explores themes of class, ambition, and social mobility in Thatcher's Britain. Multiple paths and endings based on your choices and social connections.
    -> hampstead_selected

=== jungle_selected ===
IMAGE: old_mill.png
You have selected Jungle Mystery.

This adventure is still under development. Check back soon for a thrilling journey into the heart of the Amazon rainforest, where ancient civilizations left behind mysterious artifacts and dangerous guardians.

+ [Return to Menu] -> main_menu
+ [Preview Coming Soon]
    The jungle holds secrets that have remained hidden for centuries. Will you be brave enough to uncover them when this story is complete?
    -> jungle_selected
+ [Check Other Stories] -> main_menu
`