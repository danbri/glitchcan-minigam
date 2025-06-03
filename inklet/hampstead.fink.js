oooOO`

# BASEHREF: media/

// --- Variables ---
VAR score = 0
VAR jeans_worn = false
VAR tie_worn = false
VAR giro_collected = false
VAR giro_cashed = false
VAR tweed_taken = false
VAR penguin_taken = false
VAR playwright_card = false
VAR key_2cv = false
VAR mortgage_signed = false
VAR debug_message = "" // <<<< NEW: Debug variable

-> splash

=== splash ===
#BG:#0050e0
#CLASS:info
ZX-Spectrum ready. 48 K RAM found.

// <<<< FINISHED fINK CONTENT WILL ADD A CHOICE HERE >>>>

+ Continue -> intro

=== intro ===
#BG:#000
You eye a cassette: Hampstead.

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
Signposts glisten:
EAST → Job Centre WEST → Oxfam SOUTH → Duke Pub NORTH → Gallery District

+ East to Job Centre -> jobcentre
+ West to Oxfam -> oxfam
+ South to Duke Pub -> pub
+ North to Gallery District -> gallery_pass
+ Flag down a night-bus
    Nobody stops for riff-raff. #CLASS:danger
    -> street
+ Examine strange shimmering rift nearby
    It hums faintly. Seems inactive for now.
    // Previously linked to -> Portal_Chamber in remote ink.
    // Now just an observation unless fINK content adds a Portal_Chamber knot.
    ~ debug_message = "Hampstead: Examined inactive rift"
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

+ Return to street -> street

=== pub ===
#BG:#210
The Duke of Cumberland’s ale-stench clings.

{ playwright_card == false:
    + Buy a round (£10)
        Camaraderie blossoms; a playwright drops his card. #CLASS:info
        ~ playwright_card = true
        ~ score += 1
        -> pub
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
`
