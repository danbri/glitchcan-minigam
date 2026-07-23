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
VAR robbin_birds = 0
VAR giro_cashed = false
VAR tweed_taken = false
VAR penguin_taken = false
VAR playwright_card = false
VAR key_2cv = false
VAR mortgage_signed = false
VAR debug_message = ""
VAR diamond_disposed = false
VAR met_artist = false
VAR fraud_caught = false

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
+ Down into Hampstead tube -> hampstead_tube

=== hampstead_tube ===
#BG:#0d0d1f
#CLASS:info
The deepest station on the whole Underground. The lift drops fifty-eight and a half metres — the escalators never dared come out here.

Down on the platforms, something is singing. A robin, cut from paper, gathering a flock through the tunnels. # MINIGAME: robbin mode=hampstead controls=none
-> tube_return

=== tube_return ===
#BG:#001515
The lift hauls you back toward the surface, the song fading under the hum of the cables.
+ [Out into the rain]
    { robbin_birds > 0:
        You surface blinking into the neon rain. Somewhere far below, {robbin_birds} small birds are riding the trains together. #CLASS:success
    - else:
        You surface into the neon rain. The singing carries on below, unfinished.
    }
    -> street

=== jobcentre ===
Fluorescent lights buzz; forms flutter.

{ giro_collected == false:
    + Collect your GIRO cheque
        A grubby slip slides across. #CLASS:success
        ~ giro_collected = true
        -> postoffice
}

{ giro_collected:
    + Go to Post Office window -> postoffice
}

+ Return to street -> street

=== postoffice ===
#BG:#031
Queues coil like serpents.

{ giro_cashed == false and giro_collected:
    + Cash the giro
        You pocket £120 in crisp tens. #CLASS:success
        ~ giro_cashed = true
        ~ score += 1
        -> street
}

{ giro_cashed and giro_collected:
    + Cash the giro again
        -> giro_fraud_video
}

+ Leave → street -> street

=== giro_fraud_video ===
#BG:#200
# CLASS: danger
# VIDEO: media/d94a6357-1549-44a1-9173-ce2a9a51d556.mp4
The clerk's eyes narrow. "You've already cashed this one, haven't you?"

Before you can protest, a TV on the wall flickers to life...

ATTENTION: Benefits fraud is a serious offence. This interaction has been logged.

~ score -= 2
~ fraud_caught = true

+ [Shuffle away in shame] -> fraud_aftermath

=== fraud_aftermath ===
#BG:#111
# CLASS: gritty
You stumble out into the grey daylight, cheeks burning.

The queue behind you parts like you're contagious. A woman clutches her handbag tighter. A security guard watches you leave, speaking into his radio.

Your hands are shaking. The fluorescent lights have given you a headache that won't quit.

{ jeans_worn and tie_worn:
    That cheap tie suddenly feels like a noose. #CLASS:warning
}

+ [Keep walking, don't look back]
    You put your head down and march toward the door.
    -> street_shameful
+ [Mutter an excuse to no one]
    "Computer error... happens all the time..."
    Nobody believes you. Not even you.
    -> street_shameful

=== street_shameful ===
#BG:#001515
The neon rain feels colder now. People seem to stare.

{ fraud_caught:
    A police car crawls past. You freeze until it rounds the corner. #CLASS:danger
}

-> street

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

{ fraud_caught:
    You catch your reflection in the glass. You look... guilty. Is that guard watching you? #CLASS:warning
}

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

{ fraud_caught:
    #CLASS:danger
    The doorbell rings. Two plain-clothes officers. "Sorry to interrupt the party, but we need a word about some irregularities at the Post Office..."
    Pippa gasps. Tarquin backs away as if you've caught fire.
    -> fraud_ending
}

{ score >= 8:
    -> victory
- else:
    They sense imposture. #CLASS:warning
    -> street
}

=== fraud_ending ===
#BG:#300
#CLASS:danger
The mews house dream evaporates. The mortgage is void. The keys are confiscated.

You're escorted out past the champagne flutes and the horrified neighbours.

Six months community service. A criminal record. And absolutely, definitely, permanently banned from Hampstead.

*** FRAUD DETECTED — GAME OVER ***

Final Score: {score}/8 (invalidated)

-> END

=== victory ===
#BG:#041
#CLASS:success
*** HAMPSTEAD ACHIEVED ***

Final Score: {score}/8 — you truly embody Hampstead!

+ [Rest in your achievement] -> END
+ [Sense a strange shimmer in the air...] -> world_between_worlds

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

+ Dive through after them -> world_between_worlds

=== world_between_worlds ===
#BG:#020
#CLASS:info
*** THE WORLD BETWEEN WORLDS ***

You tumble through into a place of impossible stillness.

A vast, quiet wood stretches in all directions. The trees are ancient beyond measure, their leaves rustling with whispers from a thousand realities.

The ground is soft with moss. Scattered throughout the glade are pools — perfectly still, perfectly round, each reflecting a different sky.

The conceptual artist's footprints lead toward the largest pool... and vanish.

You have {mega_diamonds} mega diamonds. Your old life feels very far away now.

+ Approach the golden pool (warm light, distant hills) -> pool_bagend
+ Peer into the dark pool (flickering torches, stone walls) -> pool_mines
+ Examine the misty pool (manor silhouette, ravens) -> pool_manor
+ Study the gentle pool (autumn leaves, chimney smoke) -> pool_maple
+ Look into the rippling pool (flowing water, reeds) -> pool_riverbend
+ Rest here a while -> world_rest

=== pool_bagend ===
#BG:#141
The golden pool shows rolling green hills, round doors set into hillsides, and the distant glint of a river.

A sign half-buried in moss reads: "The Shire — Bag End — Second Breakfast Served Daily"

Somewhere down there, a hobbit is putting the kettle on.

+ Step into the pool
    # FINK: bagend.fink.js
    The warm light envelops you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_mines ===
#BG:#210
The dark pool shows torchlit tunnels, glittering ore veins, and the distant clang of pickaxes.

Minecarts rumble in the deep. There's treasure down there — and danger.

A weathered sign says: "Mudslide Mines — Hard Hats Required"

+ Descend into the pool
    # FINK: mudslidemines.fink.js
    The darkness swallows you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_manor ===
#BG:#203
The misty pool shows a grand but crumbling manor house. Ravens circle its chimneys. One window glows with candlelight.

Something happened there. Something that wants to be discovered.

A tarnished plaque reads: "Shane Manor — Visitors by Appointment Only"

+ Enter the pool
    # FINK: shane-manor.fink.js
    The mist closes around you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_maple ===
#BG:#320
The gentle pool shows a cozy village nestled in autumn woods. Smoke rises from cottages. A cat sleeps on a windowsill.

It looks peaceful. Safe. The kind of place where nothing terrible ever happens.

A wooden sign carved with care: "Maple Hollow — Population: Friendly"

+ Slip into the pool
    # FINK: ../cozyverse/maple-hollow.fink.js
    Warmth surrounds you...
    -> END
+ Return to the glade -> world_between_worlds

=== pool_riverbend ===
#BG:#024
The rippling pool shows a wide river winding through marshland. Herons stand motionless. A small boat is tied to a dock.

The water looks cool and inviting. Adventures await downstream.

A driftwood sign: "Riverbend — Go With The Flow"

+ Wade into the pool
    # FINK: riverbend.fink.js
    The current takes you...
    -> END
+ Return to the glade -> world_between_worlds

=== world_rest ===
#BG:#010
#CLASS:info
You sit on the soft moss between the pools.

The mega diamonds in your pocket pulse gently with otherworldly light. Each one contains a frozen moment from another reality.

The conceptual artist is out there somewhere, hopping between worlds, causing chaos. But that's a problem for another day.

For now, you rest in the space between all stories.

Mega Diamonds: {mega_diamonds}

+ Continue exploring -> world_between_worlds
+ Close your eyes and drift... -> world_end

=== world_end ===
#BG:#000
#CLASS:mega
You close your eyes in the World Between Worlds.

When you open them again, you could be anywhere. Anyone.

But that's the thing about the spaces between stories — they're always there, waiting.

Final tally from your travels:
- Hampstead Score: {score}/8
- Mega Diamonds: {mega_diamonds}
- Realities Glimpsed: Many
- Artist Apprehended: Not yet

*** THE END... FOR NOW ***

-> END
`
