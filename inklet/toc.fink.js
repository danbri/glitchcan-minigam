oooOO`
// Table of Contents - FINK Story Collection
// Main menu for navigating between different FINK stories

MENU: 🏠 Main Menu -> main_menu
MENU: 🎮 Game Selection -> games_menu
MENU: 📚 Learning Hub -> learn_menu

-> main_menu

=== main_menu ===
IMAGE: peaceful_sunset.png
Welcome to the FINK Collection! Choose your path to discover interactive stories, educational experiences, and helpful resources.

+ [🎮 GAMES]
    Immersive interactive fiction experiences with rich storytelling and meaningful choices. Adventure awaits!
    -> games_menu

+ [📚 LEARN]
    Educational interactive content designed to teach languages, skills, and knowledge through engaging gameplay.
    -> learn_menu

+ [❓ HELP]
    Information about the FINK system, controls, and troubleshooting guidance.
    -> help_menu

=== games_menu ===
IMAGE: adventure_path.png
Choose your adventure! Each game offers a unique interactive experience with rich storytelling and meaningful choices.

+ [🧙‍♂️ The Hobbit - Bag End Adventure]
    A tribute to the classic 1982 adventure game. Begin your journey as Bilbo Baggins in the comfort of Bag End.
    -> hobbit_selected

+ [🏙️ Hampstead - Urban Adventure]
    Navigate the gritty streets of 1980s London. Can you climb from a grotty bedsit to the heights of Hampstead?
    -> hampstead_selected

+ [🌿 Jungle Mystery - Amazon Adventure]
    Journey deep into the Amazon rainforest where ancient civilizations left behind mysterious artifacts.
    -> jungle_selected


=== learn_menu ===
IMAGE: village_overview.png
Educational interactive content designed to teach through engaging, story-driven experiences.

+ [🇺🇦 Ukrainian Language Learning]
    Learn Ukrainian food vocabulary and basic grammar through interactive lessons and practice exercises.
    -> ukrainian_selected

+ [📖 More Learning Content Coming Soon]
    Additional educational experiences are being developed. Check back for language lessons, history, and skills training.
    -> learn_menu

+ [🎮 Return to Games] -> games_menu


=== help_menu ===
IMAGE: hobbit_pantry.png
Welcome to the FINK Interactive Fiction System! Here's everything you need to know.

**Navigation:**
- 👁️ **Eye button** - Hide/show choices for immersive viewing
- ⛶ **Fullscreen button** - Enter fullscreen mode for maximum immersion
- ⚙️ **Settings** - Load different stories and adjust media paths

**Story Features:**
- Stories support both images and videos
- Tap choices to navigate through the story
- Use browser back/forward buttons to navigate history
- Stories automatically save your progress

**Technical Notes:**
- FINK stories are JavaScript-based interactive fiction
- Media assets load from configurable directories
- Debug console available for troubleshooting

+ [📱 Mobile Tips]
    Touch the top of the screen to access the menu. Use the eye button to hide choices when enjoying images or videos.
    -> help_menu

+ [🔧 System Info]
    FINK Interactive Fiction System v3.0. Supports images, videos, Unicode text, and dynamic story navigation. Built for immersive storytelling experiences.
    -> help_menu

+ [🎮 Return to Games] -> games_menu


=== hobbit_selected ===
IMAGE: bag_end_exterior.png
FINK: bagend1.fink.js
The Hobbit - Bag End Adventure

A tribute to the classic 1982 text adventure. Follow Bilbo Baggins as he encounters Gandalf and is drawn into an unexpected adventure. Explore the hobbit-hole, meet the dwarves, and begin a journey that will take you far from the comfortable Shire.

+ [🚀 Begin the Adventure]
    -> EXTERNAL_STORY
+ [📖 More Details]
    Based on the classic Melbourne House adventure game, this adaptation captures the whimsical spirit of Tolkien's world while adding modern interactive storytelling elements. Features the original's charm with enhanced narrative depth.
    -> hobbit_selected

=== hampstead_selected ===
IMAGE: village_overview.png
FINK: hampstead1.fink.js
Hampstead - Urban Adventure

A gritty social climbing simulator set in 1980s London. Start in a bedsit and work your way up through wit, charm, and careful networking to reach the prestigious heights of Hampstead. Navigate the complex social hierarchy of Thatcher's Britain.

+ [🚀 Begin the Adventure] 
    -> EXTERNAL_STORY
+ [📖 More Details]
    This story explores themes of class, ambition, and social mobility in 1980s Britain. Multiple paths and endings based on your choices and social connections. Features authentic period atmosphere and challenging moral decisions.
    -> hampstead_selected

=== jungle_selected ===
IMAGE: old_mill.png
FINK: jungle2.fink.js
Jungle Mystery - Amazon Adventure

Journey deep into the Amazon rainforest where ancient civilizations left behind mysterious artifacts and dangerous guardians. Navigate through overgrown paths, discover hidden shrines, and uncover treasure in forgotten vaults.

+ [🚀 Begin the Adventure]
    -> EXTERNAL_STORY
+ [📖 More Details]
    Based on isometric jungle exploration. Navigate through dangerous snake pits, solve ancient puzzles, and discover treasure vaults guarded by mysterious forces. Features atmospheric environments and challenging exploration.
    -> jungle_selected

=== ukrainian_selected ===
IMAGE: village_overview.png
FINK: tml-2025-langlearn.fink.js
Ukrainian Language Learning

Learn Ukrainian food vocabulary and basic grammar through interactive lessons. Master essential words like хліб (bread), сир (cheese), and practice nominative and accusative cases through engaging story-driven exercises.

+ [🚀 Begin Learning]
    -> EXTERNAL_STORY
+ [📖 More Details]
    An educational interactive story focusing on Ukrainian language fundamentals. Perfect for beginners learning food vocabulary and case grammar. Features practical examples and immediate feedback.
    -> ukrainian_selected
`