oooOO`

# BASEHREF: media/
# IMPORT: diamonds, mega_diamonds

// --- Variables ---
VAR score = 0
VAR diamonds = 0
VAR mega_diamonds = 0
VAR jeans_worn = false
VAR tie_worn = false
VAR giro_collected = false
VAR giro_cashed = false
VAR tweed_taken = false
VAR penguin_taken = false
VAR playwright_card = false
VAR key_2cv = false
VAR mortgage_signed = false
VAR debug_message = ""
VAR diamond_disposed = false
VAR met_artist = false

-> splash

=== splash ===
#BG:#0050e0
#CLASS:info
ZX-Spectrum ready. 48 K RAM found.



+ Continue -> intro

=== intro ===


#BG:#000
You eye a cassette: Hampstead.

# IMAGE: coverart/hamstead_img_9433.jpeg

* Boot the Speccy
    Loading bars screech cheerfully. #CLASS:info
    -> bedsit
* Wander off to VR
    #BG:#400
    VR devours your soul. _GAME OVER_. #CLASS:danger
    -> END

=== bedsit ===
~ debug_message = "Hampstead: Entered bedsit knot" // <<<< NEW: Set debug message
#BG:#0a0a0a
Grotty bedsit. 3-2-1 blares on TV.

+ Open wardrobe -> wardrobe
+ Leave for Main Street
    You step into the neon drizzle. #CLASS:info
    -> street

=== wardrobe ===
#CLASS:gritty
Inside the wardrobe you see frayed jeans and a cheap tie.

{ jeans_worn == false:
    + Wear the jeans
        You feel marginally cleaner.
        ~ jeans_worn = true
        -> wardrobe
}

{ tie_worn == false:
    + Wear the tie
        The knot pinches—but you look "professional." #CLASS:warning
        ~ tie_worn = true
        ~ score += 1
        -> wardrobe
}

+ Close wardrobe -> bedsit

=== street ===
#BG:#001515
Neon rain slicks binbags and chip wrappers.

{ diamonds > 0 and diamond_disposed == false:
    The diamond in your pocket feels heavy with possibility... and danger. #CLASS:warning
}

+ East to Job Centre -> jobcentre
+ West to Oxfam -> oxfam
+ South to Duke Pub -> pub
+ North to Gallery District -> gallery_pass
{ diamonds > 0 and diamond_disposed == false:
    + Try to sell the diamond at a pawn shop -> diamond_pawn
}
+ Flag down a night-bus
    Nobody stops for riff-raff. #CLASS:danger
    -> street

=== jobcentre ===
Fluorescent lights buzz; forms flutter.

{ giro_collected == false:
    + Collect your GIRO cheque
        A grubby slip slides across. #CLASS:success
        ~ giro_collected = true
        -> postoffice
}

+ Return to street -> street

=== postoffice ===
#BG:#031
Queues coil like serpents.

{ giro_cashed == false and giro_collected:
    + Cash the giro
        You pocket £120 in crisp tens. #CLASS:info
        ~ giro_cashed = true
        ~ score += 1
        -> street
}

+ Leave → street -> street

=== oxfam ===
Musk and mothballs swirl.

{ tweed_taken == false:
    + Browse jacket rail
        Vintage tweed with elbow patches — perfect. #CLASS:success
        ~ tweed_taken = true
        ~ score += 1
        -> oxfam
}

{ penguin_taken == false:
    + Dig in bargain bin
        A tatty first-edition Penguin (hipster bait). #CLASS:info
        ~ penguin_taken = true
        ~ score += 1
        -> oxfam
}

{ diamonds > 0 and diamond_disposed == false:
    + Donate the diamond to Oxfam
        The volunteer's eyes widen. "Blimey! This'll fund clean water for a village!" #CLASS:success
        ~ diamond_disposed = true
        ~ diamonds = 0
        ~ score += 2
        You feel lighter, somehow. The universe notices acts of genuine kindness.
        -> oxfam
}

+ Return to street -> street

=== pub ===
#BG:#210
The Duke of Cumberland's ale-stench clings.

{ playwright_card == false:
    + Buy a round (£10)
        Camaraderie blossoms; a playwright drops his card. #CLASS:info
        ~ playwright_card = true
        ~ score += 1
        -> pub
}

{ diamonds > 0 and diamond_disposed == false:
    + Flash the diamond and offer to buy the pub
        -> diamond_pub_attempt
}

+ Nurse a half-pint
    Locals gripe about council cuts. #CLASS:gritty
    -> pub
+ Return to street -> street

=== gallery_pass ===
#BG:#021
The Avant-Garden Gallery casts long reflections in the rain.

{ key_2cv == false:
    + Bluff modern-art theory
        The curator nods. #CLASS:artsy
        ~ score += 1
        "Sir Lionel Thrumm seeks a cultured driver."
        -> mansion_tip
    + Admit ignorance
        "Come back when you've read some books." #CLASS:gritty
        -> gallery_pass
- else:
    + Stare at a sculpture of a urinal
        It winks at you metaphorically. #CLASS:artsy
        -> gallery_pass
}

{ diamonds > 0 and diamond_disposed == false:
    + Offer the diamond as an art exhibit
        -> diamond_gallery_exhibit
}

+ Return to street -> street

=== mansion_tip ===
#BG:#002
You spot a wrought-iron gate up the hill.

+ Visit Sir Lionel’s mansion -> mansion
+ Return to street -> street

=== mansion ===
Stained-glass windows glow; Afghan hounds slumber.

{ key_2cv == false and playwright_card:
    + Present playwright’s card
        Sir Lionel smiles and hands you a 2CV key. #CLASS:posh
        ~ key_2cv = true
        ~ score += 1
        -> car
}

+ Return to street -> street

=== car ===
#BG:#112233

You steer the 2CV toward greener postcodes.

{ key_2cv:
    + Proceed to estate agent -> estate
- else:
    Police flag you down. #CLASS:danger
    -> street
}

=== estate ===
Blueprints hang on walls.

{ mortgage_signed == false:
    + Sign the mortgage
        Keys to a Hampstead mews land in your palm. #CLASS:success
        ~ mortgage_signed = true
        ~ score += 1
        -> housewarming
}

+ Return to street -> street

=== housewarming ===
#BG:#041
Champagne corks pop; Pippa and Tarquin drift in. #CLASS:flash

{ score >= 8:
    -> victory
- else:
    They sense imposture. #CLASS:warning
    -> street
}

=== victory ===
#BG:#041
#CLASS:success
# HAMPSTEAD ACHIEVED #

Final Score: {score}/8 — you truly embody Hampstead!

-> END

// ========================================
// DIAMOND STORYLINES
// ========================================

=== diamond_pawn ===
#BG:#300
The pawnbroker examines your diamond with a loupe, then makes a phone call. #CLASS:danger

Within minutes, two plainclothes officers appear.

"That diamond was reported stolen from a interdimensional art heist. You're nicked."

~ diamond_disposed = true
~ diamonds = 0

-> jail

=== jail ===
#BG:#111
#CLASS:danger
Cold steel bars. A lumpy mattress. Time stretches like taffy.

Six months later, you're released with a criminal record and zero prospects.

GAME OVER — The diamond was never really yours.

-> END

=== diamond_pub_attempt ===
#BG:#300
You wave the diamond at the landlord. "I'll buy this whole establishment!"

The regulars exchange dark glances. Three large men stand up slowly.

"Flashing gemstones in our pub? You some kind of fence?" #CLASS:danger

They drag you into the alley. When you wake, the diamond is gone, along with your wallet and two teeth.

~ diamond_disposed = true
~ diamonds = 0
~ score = score - 2

Beaten and broke, you limp back to the street.

-> street

=== diamond_gallery_exhibit ===
#BG:#021
#CLASS:artsy
The curator's eyes light up. "Exquisite! The refraction, the provenance of mystery..."

She places your diamond on a velvet pedestal under soft spotlights. A small crowd gathers for the impromptu exhibition.

"We shall call it: 'Capitalism's Frozen Tear'" she announces.

+ Watch the opening night -> diamond_opening

=== diamond_opening ===
#BG:#025
Champagne flows. Critics murmur appreciatively.

Then a figure in a black turtleneck pushes through the crowd — wild eyes, paint-stained fingers.

"ART MUST BE EPHEMERAL!" they shriek.

Before anyone can react, they produce a laser pointer — no, an actual industrial cutting laser — and reduce your diamond to a puff of carbon vapor. #CLASS:danger

"I call this piece: 'Nothing'" they announce, bowing to scattered, confused applause.

Security escorts them out. The curator shrugs. "Conceptual artists. What can you do?"

~ diamond_disposed = true
~ diamonds = 0

Your diamond is gone. Vaporised. You trudge home, defeated.

+ Continue -> one_week_later

=== one_week_later ===
#BG:#0a0a0a
#CLASS:gritty
A week passes. The bills pile up. You find yourself back at the Job Centre, staring at the same flickering fluorescents.

But something catches your eye in the local paper:

"AVANT-GARDE ARTIST PURCHASES HISTORIC PUB"

It's them. The laser-wielding maniac. They've bought the Duke of Cumberland.

+ Visit the pub -> artist_confrontation

=== artist_confrontation ===
#BG:#210
~ met_artist = true

The pub has changed. Abstract paintings cover the walls. The regulars look uncomfortable.

And there they are — the "conceptual artiste" — behind the bar, polishing glasses with an enigmatic smile.

They see you and freeze.

"Ah. You." #CLASS:warning

+ "How did you afford this pub?"
    "Art has its rewards," they say evasively.
    -> artist_challenge
+ "You owe me a diamond."
    "I owe you nothing. The diamond was transformed into pure concept."
    -> artist_challenge

=== artist_challenge ===
#BG:#300
You study them more closely. Something is wrong. The way light bends around them. The slight shimmer at the edges.

"You're not from around here, are you?" you say slowly. "Not from around anywhere in this reality." #CLASS:warning

Their smile falters.

"Clever. Too clever." Their voice distorts, echoing strangely.

+ "What plane of reality are you from?"
    -> artist_reveal

=== artist_reveal ===
#BG:#400
#CLASS:danger
The "artist" drops all pretense. Their form flickers — human, then something else, then human again.

"The Woods Between Worlds. Where all realities intersect." Their voice sounds like multiple voices layered.

"And I'm afraid you've seen too much."

They reach into their turtleneck and pull out a handful of glittering stones — mega diamonds, pulsing with otherworldly light.

"A parting gift. Catch!"

They hurl the gems at your face. As you instinctively scramble to grab them, they trace a circle in the air. A shimmering portal opens behind them — glimpses of endless forest, impossible colors.

"Farewell, Hampstead dreamer. Perhaps we'll meet again in the spaces between."

They leap through and vanish. The portal begins to collapse.

~ mega_diamonds = 12

You clutch twelve mega diamonds. The portal flickers, unstable.

+ Dive through after them -> woods_between_worlds

=== woods_between_worlds ===
#BG:#030
#CLASS:info
# THE WOODS BETWEEN WORLDS #

You tumble through into endless twilight forest. Trees stretch impossibly tall, their bark shifting through colors that don't exist.

The artist is gone — fled deeper into the impossible wood.

But paths branch before you. Each one leads to a different reality, a different possibility.

You have 12 mega diamonds now. Whatever happens next, you're no longer playing by Hampstead's rules.

+ Enter the shimmering cave (seek treasure) -> woods_cave
+ Follow the crystal stream (find peace) -> woods_stream
+ Take the overgrown path (embrace mystery) -> woods_mystery

=== woods_cave ===
#BG:#210
The cave glitters with mineral deposits. A gem minigame perhaps awaits...

But that's a story for another FINK file.

-> woods_end

=== woods_stream ===
#BG:#024
The stream whispers secrets of a thousand realities. Fish made of pure light swim past.

Somewhere, in some world, there's a version of you who made it to Hampstead. And one who didn't.

-> woods_end

=== woods_mystery ===
#BG:#203
The path winds through spaces that shouldn't exist. You glimpse other travellers — some human, some decidedly not.

The conceptual artist is out there somewhere. You'll find them eventually.

-> woods_end

=== woods_end ===
#BG:#020
#CLASS:mega
You emerge from the Woods Between Worlds, diamonds heavy in your pocket, forever changed.

Final Score: {score}/8 (but what does score even mean between realities?)

Mega Diamonds: {mega_diamonds}

THE END... for now.

-> END
`
