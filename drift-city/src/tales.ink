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
# hotspot: ticket @ a ferry ticket frozen into a puddle @ 38 @ -18
{stall == 1:
    Dusk, and methane snow over Chinatown: fat, slow flakes that hiss on the heat lamps. Your tea stall steams under its striped awning. Auntie Bo is ladling noodles beside it, the way she has every night for twenty years. Nobody else on the street has come out in person; they are all at home under their headsets, and their drones queue at your counter.
    The heat tariff went up again this quarter. Up on the megatower screens the Org's posters cycle between the notices about heat and breath and the emigration campaign: A NEW LIFE IN THE MOTHER OF ALL COLONIES. DREAMING OF THAT GOOD OLD LIFE?
    Half the lamps on the street are cold. Old Wren, the last of the flame-keepers, who has tended their real fire for forty years, has not come by for her ginger tea. At dawn the Assembly votes on Lumen's plan to cut Chinatown over to the Org's automated grid, and with it, the last open flames in the city.
    You can't leave the stall on a night like this. So you wake Pip, your old licensed delivery drone, and send it out instead. You see through its eye and speak through its little speaker. Pip costs more than the stall, and anything it breaks is on your licence. Everyone on this street knows Pip.
- else:
    Your stall, the kettle ticking under the awning. {clues() > 0: In your notebook: {ticket: a ferry ticket;} {oilcan: a Lumen oil can;} {minutes: torn minutes;} {scale: a glowing wing-scale;} {card: Dr Sato's recording;} {ledger: a Lumen ledger page;} {stone: a warm stone in Wren's knitting.}}
    {met_wren: The sky is paling. It is nearly time for the vote.}
}
{ticket and stall > 1: The ticket dries on your counter: tonight, the river line, one way, punched at the last stop.}
* {not heard_bo} [Ask Auntie Bo what she saw] -> bo
+ {not tuned and (pagoda == 0 or tam == 0 or scale)} [Walk up to the pagoda, where Wren keeps her ladder] -> pagoda
+ {heard_bo and not scale} [Climb to a rooftop to watch the fliers] -> roof
* {not minutes or not know_castellane} [Go to the Assembly Hall before the session ends] -> hall
+ {ticket and not ferried} [Take the ticket down to the river] -> river
+ {know_castellane and not ledger} [Visit the Lumen pyramid] -> pyramid
+ {know_sato and not card} [Go out to the radio dish] -> dish
+ {bearing or stone} [Follow the fliers' bearing out of the city] -> stones
+ {met_wren} [Go to the Assembly for the vote] -> vote
+ [Pour a cup of tea and think it over] -> think

=== think ===
You pour yourself a cup and let the steam fog your glasses. What would Wren do? She would look around properly, for a start.
{not ticket: You never did look properly around your own stall. Something is frozen into the puddle by the counter.}
{not heard_bo: Auntie Bo sees everything that happens on this street.}
{heard_bo and not scale: The fliers shed their scales on the rooftops when they fly low.}
{scale and not tuned: Brother Tam's old radio could listen to that scale.}
{ticket and not ferried: That ferry ticket: the river's last stop.}
{know_castellane and not ledger: What exactly is Lumen shipping at dawn? Their loading door might say.}
{know_sato and not card: Dr Sato has been recording the fliers all week.}
{not minutes: The Assembly's minutes would say what's being voted on, and whoever tears pages out of minutes.}
{(bearing or stone) and not met_wren: North-east, where the fliers go.}
{met_wren: The sky is paling. The vote.}
+ [Back to work] -> stall

=== bo ===
# scene: bo
~ heard_bo = true
~ favours = favours + 1
"Wren? Came through at dusk with her pole and her flask," Auntie Bo tells Pip's lens, ladling noodles into a bowl you'll have to fetch yourself later. "Funny thing: the Org's street log says she's at home, asleep. My grandson says any kid can make the Org think you're home. I didn't ask how." "Only she wasn't lighting. She was looking up at the fliers. And she had a bundle under her coat, glowing like a coal."
She lowers her voice. "The Lumen man was here an hour ago asking after her. Castellane. Smiling too much. Said she'd taken something of theirs."
~ know_castellane = true
She nods at the sky. "The fliers came in low tonight. They're all heading the same way, if you ask me. Nobody asks me."
+ [Thank her, and owe her one] -> stall
+ [Climb to a rooftop to watch the fliers] -> roof

=== pagoda ===
# scene: pagoda
# place: pagoda_3
# prop: ladder @ -14 @ 8 @ 0 @ 0 @ 0
# prop: radio @ 22 @ 6.5 @ 0 @ 0 @ 0
# prop: person @ 12 @ 6 @ 10 @ 0.09 @ 1
# hotspot: oilcan @ a battered oil can by the ladder, stamped with a Lumen serial number @ -20 @ -30
{pagoda == 1:
    The pagoda is a shrine of the Flame, one of the few places in the city where fire is allowed to burn in the open, oxygen permit and all. Its eaves are furred with frost. Wren's ladder leans where it always leans; her lamp pole is not with it. Beside the door stands Brother Tam's radio, a wooden cabinet the size of a wardrobe, its dial glowing amber. Tam himself sits beside it in his hat, listening to the static as if it were someone speaking very slowly.
- else:
    The pagoda, the ladder, the radio's patient hiss, and Brother Tam, listening.
}
{oilcan: The oil can's serial is stamped with a red D: decommissioned. Whatever Wren carried, the Lumen works had already thrown it away.}
* [Ask Tam about Wren] -> tam
+ {scale and not tuned} [Hold the wing-scale to the radio and tune it] -> tune
+ [Back to your stall] -> stall

=== tam ===
# scene: tam
"She borrowed the radio this afternoon," Tam says. "Not to talk. To listen. The fliers call below the edge of hearing, and this old thing hears it." He pats the cabinet. "She found one of their scales and tuned the radio to it. Then she went very quiet, and very quick."
"If you want to follow her," he says, "find a scale. They shed them on the roofs when they fly low."
{not know_sato: "And talk to the dish woman, Sato. She listens to them too, for science. Science listens louder than I do."}
~ know_sato = true
+ [Go up to the rooftops] -> roof
+ [Back to your stall] -> stall

=== tune ===
# scene: tune
Tam lifts the scale to the speaker. It is warm and it hums, very faintly. "Match its note," he says. "Turn the dial until the radio sings the same."
* [A low, steady drone] -> tune_wrong
* [A slow note, rising and falling like breathing] -> tune_right
* [A quick, bright chirping] -> tune_wrong

=== tune_wrong ===
Static, then a whine. Tam winces. "Not that. Listen to the scale, not to your hopes." -> tune_again

=== tune_again ===
* [Try the slow, breathing note] -> tune_right
* [Try the low drone] -> tune_right_late
+ [Leave it for now] -> pagoda

=== tune_right_late ===
The drone dissolves into the breathing note on its own, as if the radio had given up waiting for you. -> tune_right

=== tune_right ===
~ tuned = true
~ bearing = true
The static parts like a curtain. Under it: a slow, rising, falling sound, hundreds of voices breathing together. Tam turns the aerial, slowly, until the sound is loudest. North-east. Out past the edge of the city, toward the old stone circle and the forest beyond it.
"They're gathering," he says. "Something is hatching."
+ [Go north-east, to the stones] -> stones
+ [Back to your stall first] -> stall

=== hall ===
# scene: hall
# place: hall_floor
# time: night
# prop: person @ 0 @ 9 @ 0 @ 0.6 @ 0
# prop: person @ -30 @ 16 @ 30 @ 0.3 @ 1
# prop: person @ 34 @ 18 @ -20 @ 0.95 @ 0
# hotspot: minutes @ a torn page of the evening's minutes under a bench @ 26 @ -30
{hall == 1:
    Under the great dome the late session is thinning out: tier on tier of empty seats, a few delegates arguing in their coats. Clerk Obi stands at the rostrum gathering papers, looking as tired as a man can look.
- else:
    The Assembly Hall. Clerk Obi at the rostrum, the dome dark above.
}
{minutes: The torn page is tonight's: "Lumen proposal: all lamps automated from next season; the lamplighter's post to lapse." In the margin, in lamp oil, in Wren's hand: "They will need warm lamps when the eggs come. Ask the fliers." And below it a second signature, crisp and new: Castellane, and a note about "off-world buyers".}
* [Ask Obi about the vote] -> obi
* {minutes} [Show Obi the note in the margin] -> obi_note
+ [Back to your stall] -> stall

=== obi ===
"The vote is at dawn," Obi says. "Lumen's proposal: cut Chinatown over to the Org's grid, put out the last flames, retire the flame-keeper. Cheaper on paper. The grid's two hundred years old and patched with tape, but it's cheaper on paper." He rubs his eyes. "It'll pass. It always passes. Nobody comes to argue in person any more."
He looks at you. "Unless someone does."
~ know_castellane = true
+ [Back to your stall] -> stall
+ {not ledger} [Go and see what Lumen is up to] -> pyramid

=== obi_note ===
Obi reads the margin twice. "Off-world buyers," he says. "Lumen means to sell the lamp-hearts, not recycle them." He folds the page into your hand. "If you can prove that by dawn, the vote won't pass. The Assembly hates being made a fool of."
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
# hotspot: ledger @ a ledger page fluttering from a shipping crate @ 30 @ -22
{pyramid == 1:
    The Lumen pyramid, glass and stone stepping up into the haze. Crates are stacked by the loading door. Mr Castellane is waiting outside it as if he expected you, in a good hat, with a doorman at his shoulder.
    "You're looking for the old flame-keeper," he says pleasantly, to Pip's lens. "So am I. She took a lamp-heart from our works: a pre-Org flame core, burns without the grid, company property, and a fire risk in the wrong hands. Bring it to me and there's a reward. A heat allowance for life, say, and a stall in the financial district."
- else:
    The Lumen pyramid. Castellane, smiling.
}
{ledger: The ledger page is a shipping manifest: forty lamp-hearts, "decommissioned", booked on a freighter to the rings at dawn, bound for Earth. Priced very high. Somebody in Lumen means to take the emigration posters at their word.}
* {not castellane_deal} [Accept his offer] -> deal
* {ledger} [Show him the manifest] -> confront
+ [Leave] -> stall

=== deal ===
~ castellane_deal = true
"Splendid," Castellane says, and gives you a card with the Lumen sun on it. "Bring the heart to the Assembly at dawn. I'll be there." It is only as you walk away that you wonder why the Assembly, and not his works.
+ [Back to your stall] -> stall

=== confront ===
Castellane looks at the manifest for a long moment. The smile stays; the eyes change. "A clerical matter," he says. "You'll find nobody at dawn cares about crates."
~ castellane_deal = false
"We'll see," you say.
+ [Back to your stall] -> stall

=== roof ===
# scene: roof
# place: roof_3
# time: night
# hotspot: scale @ a flier's wing-scale caught on a vent, glowing faintly @ -40 @ -20
{roof == 1:
    From the roof, Chinatown steams under the snow, and the fliers are everywhere: slow, pale wings turning over the market, their edges glowing. They all bank the same way as they pass, north-east.
- else:
    The rooftop, the fliers wheeling north-east.
}
{scale: The scale is warm in your glove and hums, very faintly: a slow note, rising and falling like breathing.}
+ {scale and not tuned} [Take the scale to Brother Tam's radio] -> pagoda
+ [Climb back down to your stall] -> stall

=== river ===
# scene: river
# place: riverbank
# time: night
# prop: ferry @ 12 @ 16 @ 90 @ 0.55 @ 0
# prop: person @ -8 @ 8 @ 0 @ 0.02 @ 0
# prop: lamp @ -30 @ 6 @ 0 @ 0 @ 1
{river == 1:
    The river runs black and silent between frosted banks. The old ferry is tied up at the landing, its cabin lamp lit, and Mei the pilot is stamping her feet beside a heat lamp.
- else:
    The river, the ferry, Mei.
}
"Last stop," Mei says, looking at your ticket. "Wren came through with that same ticket at dusk. Warm bundle under her coat. Asked me to take her across and not to tell anyone."
* {favours > 0} [Tell her Auntie Bo sent you] -> mei_trust
* [Ask her to take you across too] -> mei_ask
+ [Back to your stall] -> stall

=== mei_trust ===
Mei grins. "Bo's noodles saved my life one winter. All right." -> mei_ask

=== mei_ask ===
~ ferried = true
~ know_sato = true
{mei_trust: "I'll take you across and I'll tell you something else." |"Across, yes. For the price of a ticket." }
"There's a woman at the radio dish, Sato, who's been paying me to watch the fliers. She thinks there's a nest. If she's right, she'll want everyone to know."
+ [Cross, and follow the bank toward the stones] -> stones
+ [Go and find this Dr Sato] -> dish

=== dish ===
# scene: dish
# place: dish
# time: night
# prop: person @ 0 @ 7 @ 0 @ 0.15 @ 0
# prop: crates @ -25 @ 8 @ 30 @ 0 @ 0
# prop: radio @ 20 @ 6 @ -20 @ 0 @ 0
# hotspot: card @ a recording card dropped in the snow @ -25 @ -24
{dish == 1:
    The great dish tilts toward the haze, listening. Dr Ines Sato is at her instruments under it, gloved and scarved, with a flask of something that isn't tea.
    "You've heard them too," she says to Pip, without looking up from her feelers' feed. "The fliers. They're nesting, somewhere north-east. The eggs need warmth: steady, tended warmth, like the old lamps gave, not the grid's. Nobody has ever recorded a hatching. I intend to. The star-talk crowd will lose their minds."
- else:
    The dish, the instruments, Dr Sato.
}
{card: The recording card holds a week of flier calls. On the last night the calls change: they come from one place, and they are answered by something smaller.}
* {not sato_deal} [Promise her the first look, if she keeps quiet till dawn] -> sato_promise
* {card} [Ask her what the recording proves] -> sato_proof
+ [Back to your stall] -> stall

=== sato_promise ===
~ sato_deal = true
"Done," Sato says. "Quiet till dawn. After that, the whole solar system." She means it kindly, which is worse.
+ [Back to your stall] -> stall
+ {bearing} [Go north-east] -> stones

=== sato_proof ===
"That the fliers need the city," Sato says. "Their eggs hatch in warmth that someone tends. Take the lamps away and the next generation doesn't come." She taps the card. "Show that to your Assembly."
~ bearing = true
+ [Go north-east, where the calls came from] -> stones
+ [Back to your stall] -> stall

=== stones ===
# scene: stones
# place: stones
# time: night
# hotspot: stone @ a small stone at the circle's edge, warm enough to melt the snow around it @ 20 @ -20
{stones == 1:
    The stone circle on its rise. The snow is thinner here and the air warmer than it has any right to be. Fliers circle overhead, dozens of them, then drift down toward the forest below.
- else:
    The stones, warm in the snow.
}
{stone: The small stone is warm as a teacup, wrapped in knitting you would know anywhere: Wren's. A thread trails off toward the trees.}
+ {stone or bearing} [Follow the fliers down into the forest] -> forest
+ [Back to the city] -> stall

=== forest ===
# scene: forest
# place: treehouse
# time: night
# prop: person @ -6 @ 9 @ 0 @ 0.45 @ 1
# prop: nest @ 8 @ 7 @ 0 @ 0 @ 0
# prop: lamp @ 18 @ 8 @ 0 @ 0 @ 1
{met_wren:
    The treehouse, the nest, the lamp, and Wren, keeping watch.
- else:
    The treehouse in the dark forest, lit from within. The fliers are settling in the branches, hundreds of them, wings folded and glowing.
    At the foot of the tree, in three scarves and her old hat, sits Wren. Beside her is a nest of lamp-wick and knitting, and in it five pale eggs. Beside the nest stands a lamp on a pole, and in the lamp, glowing like a coal, is the lamp-heart.
    She squints at the drone. "Is that you in there? Took you long enough," she says. "Set that thing down. Quietly. They're close."
    ~ met_wren = true
}
* [Ask her why she took the lamp-heart] -> wren_why
* {castellane_deal} [Tell her about Castellane's offer] -> wren_deal
* {sato_deal} [Tell her about Dr Sato] -> wren_sato
+ [Decide what to do with the lamp-heart] -> decide

=== wren_why ===
"They were going to sell it," Wren says. "Forty of them, off to the rings. This one was stamped for scrap and I took it out of the bin. Stealing from a bin." She looks at the eggs. "Fliers have nested by the lamps for as long as there have been lamps. No lamps, no fliers. The Assembly doesn't know that. Nobody asked the fliers."
-> forest

=== wren_deal ===
Wren laughs, not unkindly. "A stall in the financial district. That's what I'm worth, and them, to him." She doesn't tell you what to do.
-> forest

=== wren_sato ===
"Sato's all right," Wren says. "Loud. If she brings the whole solar system here, they'll never nest by the city again." She shrugs. "Or maybe the whole solar system will fall in love with them. People do surprise you."
-> forest

=== decide ===
The eggs are glowing brighter. Whatever you decide, it has to be now.
* {castellane_deal} [Take the lamp-heart to Castellane, as you agreed] -> ending_cold
* [Leave it with the eggs, and go to the Assembly to argue at dawn] -> hatching_then_vote
* {sato_deal} [Signal Dr Sato to come and record the hatching] -> ending_spotlight

=== hatching_then_vote ===
# time: dusk
Pip stays, hovering low, until the first egg cracks. A small, damp, glowing thing unfolds, blinks at the lamp, and tries its wings. Wren is crying and pretending she isn't.
"Go on," she says. "Tell them. Tell them what you've seen."
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
Dawn in the Assembly Hall. The tiers are fuller than Obi has ever seen them: word gets around. Castellane is at the rostrum in his good hat, halfway through explaining how much the city will save.
Obi catches your eye and gives you the floor.
* {ledger} [Lay the shipping manifest on the rostrum] -> vote_ledger
* {card} [Play Dr Sato's recording to the hall] -> vote_card
* {minutes} [Read Wren's note from the margin of the minutes] -> vote_minutes
+ [Tell them, as simply as you can, what you saw in the forest] -> vote_tally

=== vote_ledger ===
The manifest goes round the front row, then the second. Forty lamp-hearts, "decommissioned", priced for the rings. The hall's murmur changes key. Castellane's smile holds, but only just.
-> vote_more

=== vote_card ===
Sato's recording fills the dome: the fliers' breathing call, and under it, at the end, the small new voices answering. For a moment nobody in the hall moves at all.
-> vote_more

=== vote_minutes ===
You read Wren's note aloud. "They will need warm lamps when the eggs come." Someone at the back says, "Well, do they?" and a lot of people turn to look at you.
-> vote_more

=== vote_more ===
* {ledger} [Lay the shipping manifest on the rostrum] -> vote_ledger
* {card} [Play Dr Sato's recording to the hall] -> vote_card
* {minutes} [Read Wren's note from the margin of the minutes] -> vote_minutes
+ [Finish, and let them vote] -> vote_tally

=== vote_tally ===
{evidence() >= 3: -> ending_warm}
-> ending_quiet

=== ending_warm ===
# time: day
# weather: clear
The vote is not close. The lamps stay tended and the flames stay lit; the Lumen proposal goes back to committee, which is where proposals go to die; and the Assembly, delighted to have somebody to thank, creates the post of Keeper of the Warm Lamps and gives it to Wren, who is not there to hear it because she is up a tree. The Org records the decision in a format nobody has read since the founding.
When Pip drifts out onto the steps, the new fliers are circling the dome, small and bright and wobbling, as if they had come to see.
THE END: WARM LAMPS.
+ [Play again] -> restart

=== ending_quiet ===
# time: day
The vote passes. Next season the lamps will run themselves.
But Wren keeps one lamp lit in the forest, and every evening you carry her a flask of ginger tea, and every spring the fliers come down to nest by it, and nobody at the Assembly ever asks why.
THE END: THE QUIET KEEPING.
+ [Play again] -> restart

=== ending_cold ===
# time: day
# weather: clear
Pip carries the lamp-heart to the Assembly at dawn in its cargo clamp, and Castellane takes it with both hands and a warm smile, and the vote passes, and your new stall in the financial district has a very good view.
Up in the forest the eggs go cold. Wren never speaks to you again, though she still, sometimes, takes her ginger tea at Auntie Bo's.
THE END: COLD LAMPS.
+ [Play again] -> restart

=== ending_spotlight ===
# time: day
# fly: saturn
Sato comes before dawn with her instruments, and then her colleagues come, and then the newsfeeds from the rings. The hatching is watched by eleven million people. The fliers are famous.
They never nest near the city again. But every so often, far out past the dish, you see a pale wing turning in the haze, and you like to think it remembers you.
THE END: THE SPOTLIGHT.
+ [Play again] -> restart

=== restart ===
# restart
-> END
