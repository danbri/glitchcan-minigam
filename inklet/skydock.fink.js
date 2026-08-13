// SKYDOCK SCUTTLEBUTT — the gossip-economy frame around the
// Skydock minigame (magpie/dbdb/dbdb2.html, running as the FINK
// minigame "skydock"). Gems buy terminal minutes; terminals trade
// in lies; somewhere in the lies there may be a ticket home.
oooOO`

VAR skydock_gems = 0
VAR skydock_diamonds = 0

-> skydock

=== skydock ===
# PUBLIC:

Gossip is the true fuel of the post-terrestrial economy. That and gemstones.

Stock up on the shiny crystals and see if you can buy a few minutes at a half-decent terminal to audit the latest lies and whispers doing the rounds.

Maybe there's a ticket home in it somehow…?

+ [Clock on at the Skydock] -> shift
+ [Ask around first] -> whispers

=== whispers ===

The mess-hall veterans lean in, delighted to be asked.

"The candy terminals by THE JOVIAL NEWT? Jacked straight into somebody's dreams. Dreams of PLACES. Old places. Earth places."

"Bank three diamonds in there and the static owes you a favour. That's not a rumour, that's ECONOMICS."

"And the grown worlds — the maze, the jungle — they say the gems in those were never mined. They were STAMPED."

+ [Enough. Clock on] -> shift
+ [Back away slowly] -> skydock

=== shift ===

The dock lights dim to moonlight. Your shift begins.

Jack into the candy terminals for the dreams. When you have had enough, the car rank down by the bakery runs a shuttle back up here. # MINIGAME: skydock controls=none

-> debrief

=== debrief ===

The shuttle sets you down and the mess hall takes you back. The veterans look up from their tea.

+ [Report what you heard]
    {skydock_diamonds >= 3:
        You lay {skydock_diamonds} dream-cut diamonds on the table. The room goes quiet.
        "That," says the oldest veteran, "is ticket-shaped." She slides one back to you. "Keep auditing. The whispers are adding up to a route home."
    - else:
        {skydock_diamonds > 0:
            {skydock_diamonds} diamonds. The veterans nod politely. "A start. The terminals talk more when you bank three."
        - else:
            No diamonds yet. "The gossip's free," shrugs a veteran, "but the terminals want CRYSTAL. Jack into a candy PET and bank what the dreams give you."
        }
    }
    + + [Clock on again] -> shift
    + + [Call it a night] -> nightcap

=== nightcap ===

The skydock hums on without you. Somewhere below, a manor keeps its own hours; somewhere further, the whispers keep doing the rounds.

Maybe tomorrow the lies will add up to a ticket.

-> END
`
