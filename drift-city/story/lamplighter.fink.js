oooOO`
// The Lamplighter's Last Round: a cosy mystery in Drift city, on the night of the vote.
// Tags drive the world:
//   # scene: <knot>        re-entered when something is found, so the text and choices refresh
//   # place: <id>          move the view to one of the city's places
//   # time: day | dusk | night | snow      # weather: snow | clear
//   # prop: <kind> @ <bearing deg> @ <distance m> @ <facing deg> @ <hue 0..1> @ <parameter>
//          kinds: person (parameter > 0.5: a hat), stall, ladder, radio, lamp (1 lit, 0 cold), ferry, crates, nest, item
//   # hotspot: <var> @ <label> @ <bearing deg> @ <elevation deg>   something to notice by looking around
//   # fly: <destination id>
// Shared with the world: the page writes here, hour and snowing; the story may set want_time and want_weather.
VAR here = ""
VAR hour = ""
VAR snowing = false
VAR want_time = ""
VAR want_weather = ""
// The page sets in_world to true. Without the city (the FINK player, a screen reader, a device with no WebGL or WebGPU)
// it stays false, and each hotspot is also offered as a "Look around" choice.
VAR in_world = false

// things found by looking around
VAR ticket = false
VAR oilcan = false
VAR minutes = false
VAR scale = false
VAR card = false
VAR ledger = false
VAR stone = false
// what you have learned and decided
VAR favours = 0
VAR heard_bo = false
VAR know_castellane = false
VAR know_sato = false
VAR tuned = false
VAR bearing = false
VAR castellane_deal = false
VAR sato_deal = false
VAR ferried = false
VAR met_wren = false
VAR heart = ""

-> stall

=== function clues() ===
~ return ticket + oilcan + minutes + scale + card + ledger + stone

=== function evidence() ===
~ return ledger * 2 + card * 2 + minutes + oilcan

=== stall ===
# scene: stall
# place: market_3
# time: dusk
# weather: snow
# prop: stall @ 0 @ 6 @ 0 @ 0 @ 0
# prop: person @ -24 @ 8 @ 20 @ 0.08 @ 0
# prop: lamp @ 28 @ 7 @ 0 @ 0 @ 0
# prop: lamp @ -45 @ 10 @ 0 @ 0 @ 1
# hotspot: ticket @ a ferry ticket frozen in a puddle @ 38 @ -18
{stall == 1:
    Dusk. Methane snow hisses on the heat lamps over your tea stall. Auntie Bo ladles noodles next door. Everyone else stays home under headsets and sends drones to your counter.
    Half the street lamps are cold. Old Wren, the last flame-keeper, hasn't come for her ginger tea. At dawn the Assembly votes on Lumen's plan to put out the city's last open flames.
    You can't leave the stall. You wake Pip, your old delivery drone, and send it instead: its eye is yours, its speaker your voice.
- else:
    Your stall, the kettle ticking. {clues() > 0: Notebook: {ticket: a ferry ticket;} {oilcan: a Lumen oil can;} {minutes: torn minutes;} {scale: a glowing wing-scale;} {card: Dr Sato's recording;} {ledger: a Lumen ledger page;} {stone: a warm stone in Wren's knitting.}}
    {met_wren: The sky is paling. Time for the vote.}
}
{ticket and stall > 1: The ticket dries on the counter: river line, one way, punched at the last stop.}
+ {not in_world and not ticket} [Look around] -> look_ticket
* {not heard_bo} [Ask Auntie Bo what she saw] -> bo
+ {not tuned and (pagoda == 0 or tam == 0 or scale)} [Go to Wren's pagoda] -> pagoda
+ {heard_bo and not scale} [Watch the fliers from a rooftop] -> roof
* {not minutes or not know_castellane} [Go to the Assembly Hall] -> hall
+ {ticket and not ferried} [Take the ticket to the river] -> river
+ {know_castellane and not ledger} [Visit the Lumen pyramid] -> pyramid
+ {know_sato and not card} [Go to the radio dish] -> dish
+ {bearing or stone} [Follow the fliers north-east] -> stones
+ {met_wren} [Go to the vote] -> vote
+ [Think it over] -> think

=== think ===
You pour a cup. What would Wren do? Look around properly.
{not ticket: Something is frozen into the puddle by your counter.}
{not heard_bo: Auntie Bo sees everything on this street.}
{heard_bo and not scale: Low fliers shed scales on the rooftops.}
{scale and not tuned: Brother Tam's radio could listen to that scale.}
{ticket and not ferried: The ticket: the river's last stop.}
{know_castellane and not ledger: What is Lumen shipping at dawn?}
{know_sato and not card: Dr Sato has recorded the fliers all week.}
{not minutes: The Assembly's minutes say what is being voted on.}
{(bearing or stone) and not met_wren: North-east, where the fliers go.}
{met_wren: The sky is paling. The vote.}
+ [Back to work] -> stall

=== bo ===
# scene: bo
~ heard_bo = true
~ favours = favours + 1
"Wren came by at dusk with her pole and flask," Auntie Bo tells Pip. "The Org's log says she's home asleep. She wasn't lighting lamps. She was watching the fliers, with a bundle under her coat glowing like a coal."
She lowers her voice. "Castellane from Lumen was asking after her. Says she took something of theirs."
~ know_castellane = true
She nods at the sky. "The fliers came in low tonight. All heading the same way."
+ [Thank her] -> stall
+ [Watch the fliers from a rooftop] -> roof

=== pagoda ===
# scene: pagoda
# place: pagoda_3
# prop: ladder @ -14 @ 8 @ 0 @ 0 @ 0
# prop: radio @ 22 @ 6.5 @ 0 @ 0 @ 0
# prop: person @ 12 @ 6 @ 10 @ 0.09 @ 1
# hotspot: oilcan @ a Lumen oil can by the ladder @ -20 @ -30
{pagoda == 1:
    The pagoda of the Flame, one of the few places fire may burn in the open. Wren's ladder leans by the door; her lamp pole is gone. Brother Tam sits by his radio, a wardrobe-sized cabinet with an amber dial, listening to static.
- else:
    The pagoda. The radio hisses; Tam listens.
}
{oilcan: The oil can's serial carries a red D: decommissioned. Whatever Wren carried, Lumen had already scrapped it.}
+ {not in_world and not oilcan} [Look around] -> look_oilcan
* [Ask Tam about Wren] -> tam
+ {scale and not tuned} [Tune the radio to the wing-scale] -> tune
+ [Back to your stall] -> stall

=== tam ===
# scene: tam
"Wren borrowed the radio this afternoon," Tam says. "To listen. The fliers call below hearing, and this old thing hears them. She tuned it to one of their scales, then left in a hurry."
"Find a scale if you want to follow her. They shed them on the roofs."
{not know_sato: "And see Sato at the dish. She listens to them too, for science."}
~ know_sato = true
+ [Go up to the rooftops] -> roof
+ [Back to your stall] -> stall

=== tune ===
# scene: tune
Tam holds the humming scale to the speaker. "Turn the dial until the radio sings its note."
* [A low, steady drone] -> tune_wrong
* [A slow note, rising and falling like breathing] -> tune_right
* [A quick, bright chirping] -> tune_wrong

=== tune_wrong ===
Static and a whine. Tam winces. "Listen to the scale, not your hopes." -> tune_again

=== tune_again ===
* [Try the slow, breathing note] -> tune_right
* [Try the low drone] -> tune_right_late
+ [Leave it for now] -> pagoda

=== tune_right_late ===
The drone slides into the breathing note by itself. -> tune_right

=== tune_right ===
~ tuned = true
~ bearing = true
The static parts. Beneath it, hundreds of voices breathe together. Tam turns the aerial until they are loudest: north-east, past the city's edge, toward the stone circle and the forest.
"They're gathering," he says. "Something is hatching."
+ [Go north-east, to the stones] -> stones
+ [Back to your stall] -> stall

=== hall ===
# scene: hall
# place: hall_floor
# time: night
# prop: person @ 0 @ 9 @ 0 @ 0.6 @ 0
# prop: person @ -30 @ 16 @ 30 @ 0.3 @ 1
# prop: person @ 34 @ 18 @ -20 @ 0.95 @ 0
# hotspot: minutes @ a torn page of minutes under a bench @ 26 @ -30
{hall == 1:
    Under the dome the late session is thinning out. Clerk Obi gathers papers at the rostrum, exhausted.
- else:
    The Assembly Hall. Obi at the rostrum.
}
{minutes: The torn page is tonight's: "Lumen proposal: all lamps automated; the lamplighter's post to lapse." In the margin, in Wren's hand: "They will need warm lamps when the eggs come. Ask the fliers." Below it, fresh: Castellane's signature and a note about "off-world buyers".}
+ {not in_world and not minutes} [Look around] -> look_minutes
* [Ask Obi about the vote] -> obi
* {minutes} [Show Obi the margin note] -> obi_note
+ [Back to your stall] -> stall

=== obi ===
"The vote's at dawn," Obi says. "Lumen puts Chinatown on the Org's grid, puts out the last flames, retires the flame-keeper. The grid is two hundred years old and patched with tape, but it's cheaper on paper. It'll pass. Nobody argues in person any more."
He looks at Pip. "Unless someone does."
~ know_castellane = true
+ [Back to your stall] -> stall
+ {not ledger} [See what Lumen is up to] -> pyramid

=== obi_note ===
Obi reads it twice. "Off-world buyers. Lumen means to sell the lamp-hearts, not scrap them." He hands you the page. "Prove it by dawn and the vote fails."
~ know_castellane = true
+ [Go to the Lumen pyramid] -> pyramid
+ [Back to your stall] -> stall

=== pyramid ===
# scene: pyramid
# place: pyramid
# time: night
# prop: person @ 4 @ 7 @ 0 @ 0.58 @ 1
# prop: person @ -22 @ 9 @ 25 @ 0.0 @ 0
# prop: crates @ 30 @ 8 @ 20 @ 0 @ 0
# hotspot: ledger @ a ledger page on a shipping crate @ 30 @ -22
{pyramid == 1:
    The Lumen pyramid. Crates by the loading door. Mr Castellane waits outside in a good hat, as if expecting you.
    "Looking for the old flame-keeper?" he asks Pip. "So am I. She stole a lamp-heart: a pre-Org flame core that burns without the grid. Bring it to me and you'll have a heat allowance for life, and a stall in the financial district."
- else:
    The Lumen pyramid. Castellane, smiling.
}
{ledger: The page is a shipping manifest: forty "decommissioned" lamp-hearts on a freighter to the rings at dawn, bound for Earth, priced very high.}
+ {not in_world and not ledger} [Look around] -> look_ledger
* {not castellane_deal} [Accept his offer] -> deal
* {ledger} [Show him the manifest] -> confront
+ [Leave] -> stall

=== deal ===
~ castellane_deal = true
"Splendid." Castellane hands you a Lumen card. "Bring the heart to the Assembly at dawn." Walking away, you wonder: why the Assembly, not his works?
+ [Back to your stall] -> stall

=== confront ===
Castellane studies the manifest. The smile stays; the eyes change. "A clerical matter. Nobody at dawn cares about crates."
~ castellane_deal = false
"We'll see," you say.
+ [Back to your stall] -> stall

=== roof ===
# scene: roof
# place: roof_3
# time: night
# hotspot: scale @ a glowing wing-scale on a vent @ -40 @ -20
{roof == 1:
    Chinatown steams below. Pale fliers wheel over the market, wing-edges glowing, and each banks north-east as it passes.
- else:
    The rooftop. Fliers wheel north-east.
}
{scale: The scale is warm and hums: a slow note, rising and falling like breathing.}
+ {not in_world and not scale} [Look around] -> look_scale
+ {scale and not tuned} [Take the scale to Tam's radio] -> pagoda
+ [Climb down to your stall] -> stall

=== river ===
# scene: river
# place: riverbank
# time: night
# prop: ferry @ 12 @ 16 @ 90 @ 0.55 @ 0
# prop: person @ -8 @ 8 @ 0 @ 0.02 @ 0
# prop: lamp @ -30 @ 6 @ 0 @ 0 @ 1
{river == 1:
    The black river. The old ferry waits at the landing, cabin lamp lit; Mei the pilot stamps her feet by a heat lamp.
- else:
    The river. Mei and her ferry.
}
"Last stop," Mei says, reading your ticket. "Wren had the same one at dusk. Warm bundle under her coat. Asked me to take her across and tell no one."
* {favours > 0} [Tell her Auntie Bo sent you] -> mei_trust
* [Ask her to take you across] -> mei_ask
+ [Back to your stall] -> stall

=== mei_trust ===
Mei grins. "Bo's noodles got me through a winter. All right." -> mei_ask

=== mei_ask ===
~ ferried = true
~ know_sato = true
{mei_trust: "I'll take you, and tell you something else." |"Across, yes. Price of a ticket." }
"Dr Sato at the radio dish pays me to watch the fliers. She thinks there's a nest. If she's right, she'll tell the world."
+ [Cross, and follow the bank to the stones] -> stones
+ [Find Dr Sato] -> dish

=== dish ===
# scene: dish
# place: dish
# time: night
# prop: person @ 0 @ 7 @ 0 @ 0.15 @ 0
# prop: crates @ -25 @ 8 @ 30 @ 0 @ 0
# prop: radio @ 20 @ 6 @ -20 @ 0 @ 0
# hotspot: card @ a recording card in the snow @ -25 @ -24
{dish == 1:
    The great dish tilts into the haze. Dr Ines Sato works at her instruments beneath it, with a flask that isn't tea.
    "You've heard them too," she tells Pip. "The fliers are nesting north-east. The eggs need steady, tended warmth, like the old lamps gave. Nobody has ever recorded a hatching. I will."
- else:
    The dish. Dr Sato.
}
{card: The card holds a week of flier calls. On the last night they come from one place, and something smaller answers.}
+ {not in_world and not card} [Look around] -> look_card
* {not sato_deal} [Promise her the first look if she keeps quiet till dawn] -> sato_promise
* {card} [Ask what the recording proves] -> sato_proof
+ [Back to your stall] -> stall

=== sato_promise ===
~ sato_deal = true
"Done. Quiet till dawn. After that, the whole solar system." She means it kindly, which is worse.
+ [Back to your stall] -> stall
+ {bearing} [Go north-east] -> stones

=== sato_proof ===
"That the fliers need the city," Sato says. "Their eggs hatch in tended warmth. Take the lamps away and no new generation comes. Show your Assembly that."
~ bearing = true
+ [Go north-east] -> stones
+ [Back to your stall] -> stall

=== stones ===
# scene: stones
# place: stones
# time: night
# hotspot: stone @ a warm stone at the circle's edge @ 20 @ -20
{stones == 1:
    The stone circle on its rise. The snow is thin here, the air too warm. Dozens of fliers circle, then drift down to the forest.
- else:
    The stones, warm in the snow.
}
{stone: The stone is warm as a teacup, wrapped in knitting you'd know anywhere: Wren's. A thread trails toward the trees.}
+ {not in_world and not stone} [Look around] -> look_stone
+ {stone or bearing} [Follow the fliers into the forest] -> forest
+ [Back to the city] -> stall

=== forest ===
# scene: forest
# place: treehouse
# time: night
# prop: person @ -6 @ 9 @ 0 @ 0.45 @ 1
# prop: nest @ 8 @ 7 @ 0 @ 0 @ 0
# prop: lamp @ 18 @ 8 @ 0 @ 0 @ 1
{met_wren:
    The treehouse, the nest, the lamp, and Wren on watch.
- else:
    A treehouse in the dark forest, lit from within. Hundreds of fliers settle in the branches, wings glowing.
    At its foot sits Wren in three scarves. Beside her: a nest of lamp-wick and knitting holding five pale eggs, and a lamp on a pole with the lamp-heart glowing inside.
    She squints at Pip. "Is that you in there? Took you long enough. Set down. Quietly. They're close."
    ~ met_wren = true
}
* [Ask why she took the lamp-heart] -> wren_why
* {castellane_deal} [Tell her about Castellane's offer] -> wren_deal
* {sato_deal} [Tell her about Dr Sato] -> wren_sato
+ [Decide what to do with the lamp-heart] -> decide

=== wren_why ===
"Lumen is selling them, forty, off to the rings," Wren says. "This one was stamped for scrap. I took it out of a bin." She looks at the eggs. "Fliers have nested by the lamps as long as there have been lamps. No lamps, no fliers. Nobody asked the fliers."
-> forest

=== wren_deal ===
Wren laughs. "A stall in the financial district. That's what I'm worth to him, and them." She doesn't tell you what to do.
-> forest

=== wren_sato ===
"Sato's all right. Loud. Bring the whole solar system here and they'll never nest near the city again." She shrugs. "Or the solar system falls in love with them. People surprise you."
-> forest

=== decide ===
The eggs glow brighter. Decide now.
* {castellane_deal} [Take the lamp-heart to Castellane] -> ending_cold
* [Leave it with the eggs; argue at the Assembly] -> hatching_then_vote
* {sato_deal} [Signal Dr Sato to record the hatching] -> ending_spotlight

=== hatching_then_vote ===
# time: dusk
Pip hovers until the first egg cracks. A small, damp, glowing thing unfolds, blinks at the lamp, and tries its wings. Wren cries and pretends not to.
"Go on," she says. "Tell them what you saw."
-> vote

=== vote ===
# scene: vote
# place: hall_floor
# time: day
# weather: clear
# prop: person @ 0 @ 9 @ 0 @ 0.6 @ 0
# prop: person @ 5 @ 11 @ -15 @ 0.58 @ 1
# prop: person @ -28 @ 15 @ 30 @ 0.3 @ 1
# prop: person @ 30 @ 17 @ -25 @ 0.95 @ 0
# prop: person @ -40 @ 20 @ 30 @ 0.15 @ 0
Dawn. The Assembly is fuller than Obi has ever seen it. Castellane, at the rostrum, is explaining how much the city will save.
Obi catches your eye and gives you the floor.
* {ledger} [Lay the manifest on the rostrum] -> vote_ledger
* {card} [Play Sato's recording] -> vote_card
* {minutes} [Read Wren's margin note] -> vote_minutes
+ [Tell them what you saw in the forest] -> vote_tally

=== vote_ledger ===
The manifest passes along the front rows: forty lamp-hearts priced for the rings. The hall's murmur changes key. Castellane's smile holds, just.
-> vote_more

=== vote_card ===
Sato's recording fills the dome: the fliers' breathing call, and at the end, small new voices answering. Nobody moves.
-> vote_more

=== vote_minutes ===
You read Wren's note: "They will need warm lamps when the eggs come." Someone at the back asks, "Well, do they?" Heads turn to you.
-> vote_more

=== vote_more ===
* {ledger} [Lay the manifest on the rostrum] -> vote_ledger
* {card} [Play Sato's recording] -> vote_card
* {minutes} [Read Wren's margin note] -> vote_minutes
+ [Finish, and let them vote] -> vote_tally

=== vote_tally ===
{evidence() >= 3: -> ending_warm}
-> ending_quiet

=== ending_warm ===
# time: day
# weather: clear
The vote isn't close. The flames stay lit. The Lumen proposal goes back to committee to die, and the Assembly names Wren Keeper of the Warm Lamps. She isn't there to hear it; she's up a tree.
On the steps, Pip meets the new fliers circling the dome, small and bright and wobbling.
THE END: WARM LAMPS.
+ [Play again] -> restart

=== ending_quiet ===
# time: day
The vote passes. Next season the lamps run themselves.
But Wren keeps one lamp lit in the forest. Every evening you bring her ginger tea, and every spring the fliers nest by it.
THE END: THE QUIET KEEPING.
+ [Play again] -> restart

=== ending_cold ===
# time: day
# weather: clear
At dawn Pip carries the lamp-heart to the Assembly. Castellane takes it with a warm smile, the vote passes, and your new stall has a very good view.
In the forest the eggs go cold. Wren never speaks to you again.
THE END: COLD LAMPS.
+ [Play again] -> restart

=== ending_spotlight ===
# time: day
# fly: saturn
Sato comes before dawn, then her colleagues, then the newsfeeds from the rings. Eleven million people watch the hatching.
The fliers never nest near the city again. Sometimes, far past the dish, a pale wing turns in the haze.
THE END: THE SPOTLIGHT.
+ [Play again] -> restart

=== restart ===
# restart
-> END

// text route to the clues, when there is no city to look around (see in_world)
=== look_ticket ===
~ ticket = true
You find a ferry ticket frozen in a puddle.
-> stall

=== look_oilcan ===
~ oilcan = true
You find a Lumen oil can by the ladder.
-> pagoda

=== look_minutes ===
~ minutes = true
You find a torn page of minutes under a bench.
-> hall

=== look_ledger ===
~ ledger = true
You find a ledger page on a shipping crate.
-> pyramid

=== look_scale ===
~ scale = true
You find a glowing wing-scale on a vent.
-> roof

=== look_card ===
~ card = true
You find a recording card in the snow.
-> dish

=== look_stone ===
~ stone = true
You find a warm stone at the circle's edge.
-> stones

`;
