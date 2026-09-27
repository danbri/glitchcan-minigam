oooOO`
// Per Aspera: a night crawl through Drift city's dive bars to the jazz club in the Warmhouse.
// The same tags as The Lamplighter's Last Round (see that file's header): scene, place, time, weather, prop,
// hotspot, fly, voice; # morse: <text> (the masts and the radio key that message; empty for the usual ones); # speech: <mp3>, a recorded line (the Org
// and Elder Harriet: ElevenLabs, see audio/org/README.md), played once; the FINK player ignores it and shows the text.
// Speakers: mags, dex, oskar, nuala, pell, ruth, org, elder, you.
// The Org and its Elders: canon in drift-city/skills/drift-city/SKILL.md, "The Org, the Elders and the calendar bug".
# title: Per Aspera
VAR here = ""
VAR hour = ""
VAR snowing = false
VAR want_time = ""
VAR want_weather = ""
VAR in_world = false

// things found by looking around
VAR voucher = false
VAR setlist = false
VAR reed = false
VAR patch = false
VAR tape = false
VAR tenpo = false
// what you have learned and decided
VAR heard_mags = false
VAR heard_dex = false
VAR heard_oskar = false
VAR oskar_in = false
VAR know_gate = false
VAR found_nuala = false
VAR pull = 0
VAR shown_setlist = false
VAR nuala = ""
// the Org's clock: set back, the Elders speak plainly; left back, the heating and the crops go wrong
VAR know_mast = false
VAR clock_back = false
VAR back_for = 0
VAR clock_fixed = false
VAR elder_tip = false
VAR told_elder = false

-> street

=== function clues() ===
~ return voucher + setlist + reed + patch + tape + tenpo

=== street ===
# scene: street
# place: street_1
# time: night
# weather: snow
# prop: person @ -20 @ 7 @ 30 @ 0.6 @ 0
# prop: crates @ 25 @ 6 @ 0 @ 0 @ 0
# hotspot: voucher @ a torn voucher in the gutter @ 30 @ -25
{ clock_back:
    ~ back_for = back_for + 1
}
{street == 1:
    Night on Ferry Street. Snow drifts through the neon, and your bass case bumps against your suit leg. You play upright bass: an old instrument with a spruce body, built for Titan air, where its body booms lower and louder than it ever did at home.
    At midnight you play the Warmhouse, the only room under the open sky where people take their helmets off and hear music with their own ears. Nuala Fenn leads the band. Nuala Fenn has not been seen since noon.
    The street is nearly empty. There is no work to go to: the machines do the heavy work, and the Org's sign-off jobs take an hour a week. Most people stay in under headsets. Overhead, the Hindenburg 1632 drifts toward the pads with its running lights on.
    The first settlers named every airship Hindenburg, as a joke: with no oxygen in the air, nothing here can burn. They laughed at everything, the first settlers. The count has reached 1632, and nobody laughs at it now.
    The megatower screens run the emigration campaign: LEAVE TITAN. GO HOME. PASSAGE PAID. Under the screen, someone has sprayed three words in silver: AD ASTRA PER ASPERA.
- else:
    Ferry Street, the snow still falling. {clues() > 0: In your case pocket: {voucher: a torn passage voucher;} {setlist: a setlist on a napkin;} {reed: a cracked reed;} {patch: an Aster patch;} {tape: a tape from the Warmhouse;} {tenpo: a card that says テンポ.}}
    {found_nuala: Midnight is close. The Warmhouse hangs over the west edge of the city, lit from inside.}
}
{clock_back and back_for == 1: The street heaters flicker, and come back weaker. The Org's clock is still set back.}
{clock_back and back_for == 2: Frost on the inside of the Cold Tap's window. Somewhere a crop hall has missed its dawn. The Org still thinks it is a hundred years ago.}
{clock_back and back_for >= 3: The heaters are off along the whole street. Out west, the Warmhouse looks lower in the sky than it did.}
{voucher and street > 1: The voucher is the Org's: one seat, Titan to Earth, passage paid. The name is torn off. The gate number is not: gate 3, boarding at dawn.}
+ {not in_world and not voucher} [Look around] -> look_voucher
* {not heard_mags} [Go into the Cold Tap and ask Mags] -> mags
+ [Take the tube to the Low Orbit, by the spaceport] -> low_orbit
+ [Go down to the Lantern Cellar, Chinatown] -> cellar
+ {heard_dex or patch} [Climb to the Asters' roof] -> roof
+ {(voucher or know_gate) and not found_nuala} [Go to the emigration gate] -> gate
+ {know_mast} [Go to the signal tower, where the Org listens] -> mast
+ {heard_mags} [Ride up to the Warmhouse for the set] -> below
+ [Think it over] -> think

=== think ===
You stand in a doorway out of the snow and think.
{not heard_mags: Mags at the Cold Tap hears everything said in this street.}
{not voucher: Something is caught in the gutter under the screen.}
{not heard_dex: The Asters drink at the Low Orbit, by the spaceport.}
{not heard_oskar: Oskar the drummer plays the late jam in the Lantern Cellar.}
{heard_dex and not patch: The Asters watch the launches from a roof in the neon quarter.}
{(voucher or know_gate) and not found_nuala: Gate 3. Boarding at dawn.}
{heard_mags: The set is at midnight, in the Warmhouse.}
{know_mast and not tenpo: The Asters leave notes on their roof. One of them might say how to talk to the Org.}
{clock_back: The Org's clock is still set back. The heating runs on it.}
+ [Back into the snow] -> street
+ [Meanwhile, in the Chinatown market] -> elsewhere

=== elsewhere ===
// a light peer link: another story in the same city, with its own narrator; this one keeps its place
# FINK: lamplighter.fink.js
# LINKREL: peer
In the Chinatown night market tonight a tea-stall keeper has sent an old drone into the snow after the last lamplighter. That is someone else's night. Yours will wait here.
-> street

=== mags ===
# scene: mags
~ heard_mags = true
The Cold Tap is a dive bar behind an airlock: nine stools, a heater that ticks, and a price list older than the dome. You crack your helmet seal. The air smells of hops and hot metal.
"Nuala was in at noon," Mags says, and wipes the bar. "Sat where you're sitting. Drank one whisky, very slow, and didnae say a word." # speech: ../audio/cast/mags-1.mp3
"Then an Org clerk came in with a tablet and she signed something. Folk are saying she's taken a seat home. Passage paid." # speech: ../audio/cast/mags-2.mp3
She puts a glass in front of you. "The set's still on. Midnight, in the bubble. Ruth says it goes ahead with or without her." # speech: ../audio/cast/mags-3.mp3
"And the Assembly votes on the lamps at dawn, so the whole street's in a mood." # speech: ../audio/cast/mags-4.mp3
+ [Ask what the Asters will say] -> mags_asters
+ [Thank her and go] -> street

=== mags_asters ===
"The Asters?" Mags laughs. "Half of them think Nuala hung the stars. They're up at five doing press-ups, they teach their own weans at home, and they've more kids than anybody. Folk say they've a store of oxygen and printer plastic under the Low Orbit. Dex says that's rubbish." # speech: ../audio/cast/mags-5.mp3
"Ask at the Low Orbit. Dex will tell you the whole creed, whether you want it or no." # speech: ../audio/cast/mags-6.mp3
+ [Back to the street] -> street

=== low_orbit ===
# scene: low_orbit
# place: street_5
# prop: person @ 15 @ 6 @ -20 @ 0.1 @ 1
# prop: radio @ -30 @ 7 @ 0 @ 0 @ 0
# hotspot: setlist @ a napkin stuck to the airlock door @ -35 @ -5
{low_orbit == 1:
    The Low Orbit is where ship crews drink between shifts: a long room behind the cargo sheds, with a window on the pads. Someone has painted a star on the ceiling, cracked across the middle.
    Dex runs the bar. The Asters sit along the window in jackets covered in patches, and when a shuttle lifts they all stop talking and watch it go.
- else:
    The Low Orbit. A launch light blinks on the pad. The Asters watch it.
}
{setlist: The napkin is a setlist in Nuala's hand. The last tune is new: "PER ASPERA. Outside. Titan air, down a seventh. Bass leads."}
+ {not in_world and not setlist} [Look around] -> look_setlist
* [Ask Dex about the Asters] -> dex
* {heard_dex} [Ask Dex about the Org] -> dex_org
+ {heard_dex and not know_gate} [Ask Dex where Nuala is] -> dex_where
+ [Back to Ferry Street] -> street

=== dex ===
# scene: dex
~ heard_dex = true
"Ad astra per aspera," Dex says. "To the stars, through hardship. Old words. We took them." # speech: ../audio/cast/dex-1.mp3
"The Org wants everybody gone home. Posters on every tower, seats paid, Earth tax credit. Earth's the past, innit. We're not going back. We're going out: the long ships, the next moon, the next star. The hard way." # speech: ../audio/cast/dex-2.mp3
"So we train. Every morning, before the pads open. The kids learn at home: orbital mechanics, hydroponics, welding, cooking for forty. One of you works the pads, one of you keeps the house, and you have kids. Lots. You don't fill a star system with two-point-one." # speech: ../audio/cast/dex-3.mp3
"The oxygen? People like a story." He doesn't say no. # speech: ../audio/cast/dex-4.mp3
"Nuala played our first night, in the Warmhouse. She taught us the rooftop thing: every launch, lamps up on the roofs so the crews can see them go." # speech: ../audio/cast/dex-5.mp3
+ [Ask where Nuala is] -> dex_where
+ [Back to Ferry Street] -> street

=== dex_org ===
~ know_mast = true
"The Org?" Dex leans on the bar. "It's the old ship's computer. The settlers built it to outlive them: talk in their voices, keep everything they knew. The Elders, they called it." # speech: ../audio/cast/dex-6.mp3
"Ask it anything and you get a fridge magnet. Every day is a gift. Home is where the heart is. A hundred years of that, and everyone thought the founders were just like that." # speech: ../audio/cast/dex-7.mp3
"They weren't. It's the clock. It can't tell an Earth year from a Saturn year from a Titan day, so it thinks the founders are ancient history and keeps them dignified. Set its clock back and they talk straight." # speech: ../audio/cast/dex-8.mp3
"The signal tower in the financial district is its ear. The mast lights blink how to do it, every night, in dots and dashes. And put the clock back right after, or we all freeze." # speech: ../audio/cast/dex-9.mp3
+ [Back to Ferry Street] -> street

=== dex_where ===
~ know_gate = true
"If she's taken the Org's seat," Dex says quietly, "she'll be at gate 3 by now, sitting with it. That's where you go to make your mind up." # speech: ../audio/cast/dex-10.mp3
"Tell her the roof's still up there. That's all." # speech: ../audio/cast/dex-11.mp3
+ [Back to Ferry Street] -> street

=== cellar ===
# scene: cellar
# place: street_3
# prop: person @ -10 @ 5 @ 40 @ 0.33 @ 0
# prop: lamp @ 30 @ 6 @ 0 @ 0 @ 1
# hotspot: reed @ a cracked reed on the step @ 20 @ -35
{cellar == 1:
    The Lantern Cellar is under a noodle bar on Glass Walk: forty steps down, then an airlock, then a low room full of smoke and brass. The late jam never stops; players come and go and the tune goes on.
    Oskar is on the drums, as always, brushes on a snare, eyes shut.
- else:
    The Lantern Cellar. The jam goes on under the street.
}
{reed: A saxophone reed, split along its tip. On the flat side, in tiny letters: N.F. Her lucky one. She never plays without it.}
+ {not in_world and not reed} [Look around] -> look_reed
* [Sit in with Oskar] -> oskar
+ {heard_oskar and not oskar_in} [Ask Oskar to play the Warmhouse tonight] -> oskar_ask
+ [Back to Ferry Street] -> street

=== oskar ===
# scene: oskar
~ heard_oskar = true
You unpack the bass and sit in for one tune. Oskar opens his eyes at the first note and grins.
"Your bass is loud in here," he says afterwards. "Out in Titan air it would be louder. Thick air moves easily. The same cone, the same string, and nine decibels more bass. That is physics." # speech: ../audio/cast/oskar-1.mp3
"Nuala built a horn for Titan air. A bellows that breathes the outside air and blows it through the pipe. Out there it plays nearly a seventh lower than in here. She was saving it for a tune." # speech: ../audio/cast/oskar-2.mp3
+ [Ask him to play the Warmhouse] -> oskar_ask
+ [Back to Ferry Street] -> street

=== oskar_ask ===
{nuala == "gone":
    "Without Nuala?" Oskar shakes his head. "No. I play the jam. The jam doesn't leave." # speech: ../audio/cast/oskar-3.mp3
- else:
    ~ oskar_in = true
    "Midnight," Oskar says, and packs his brushes. "I'll be there. If she comes, she comes." # speech: ../audio/cast/oskar-4.mp3
}
+ [Back to Ferry Street] -> street

=== roof ===
# scene: roof
# place: roof_1
# prop: lamp @ -15 @ 8 @ 0 @ 0 @ 1
# prop: lamp @ 20 @ 9 @ 0 @ 0 @ 1
# prop: person @ 5 @ 12 @ 180 @ 0.62 @ 0
# hotspot: patch @ a patch stitched to a blanket @ -25 @ -30
# hotspot: tenpo @ a card pinned under a lamp @ 18 @ -28
{roof == 1:
    The Asters' roof: a flat top over the neon quarter with a view down the harbour arm to the pads. Lamps stand along the parapet, ready for the next launch. Snow on everything.
- else:
    The roof. The lamps wait along the parapet.
}
{patch: An old Aster patch, the cracked star, and under it in thread: N.F., FIRST NIGHT. She left it up here.}
{tenpo: The card says テンポ, tenpo, "time" in toki pona, written in katakana. Under it in Morse, with a pencil note: key the date in Titan days, not years. On the far mast a red light blinks the same thing, over and over.}
{tape and roof > 1: Ruth's tape plays in your helmet: a crowd, a saxophone, a bass line going down and down.}
+ {not in_world and not patch} [Look around] -> look_patch
+ {not in_world and not tenpo and know_mast} [Look under the lamps] -> look_tenpo
+ [Back to Ferry Street] -> street

=== gate ===
# scene: gate
# place: spaceport_apron
# prop: person @ 0 @ 7 @ 180 @ 0.05 @ 0
# prop: person @ 35 @ 10 @ 200 @ 0.55 @ 1
# prop: crates @ -30 @ 8 @ 0 @ 0 @ 0
~ found_nuala = true
The emigration gate is a heated shed on the apron, rows of seats, and a clerk from the Org behind glass. Through the window the ship for Earth stands on its pad under lights.
Nuala Fenn sits in the front row with her horn case across her knees and a voucher in her hand. The torn half.
"Clerk Pell says I can still change my mind until dawn," she says, without looking round. "He has a form for it." # speech: ../audio/cast/nuala-1.mp3
"Form 11-C," says Pell, behind the glass. "Cancellation of passage, voluntary. It needs to be signed off." # speech: ../audio/cast/pell-1.mp3
-> gate_talk

=== gate_talk ===
+ {voucher} [Hand her the other half of the voucher] -> show_voucher
+ {setlist} [Show her the setlist] -> show_setlist
+ {reed} [Give her the cracked reed] -> show_reed
+ {patch} [Give her the patch from the roof] -> show_patch
+ {tape} [Play her Ruth's tape] -> show_tape
+ {elder_tip and not told_elder} [Tell her what the Elder said about the seats] -> show_elder
* [Ask her why] -> nuala_why
+ [Tell her to go, if she wants to] -> nuala_go
+ [Ask her to play one last set first] -> nuala_decide

=== nuala_why ===
"Twenty years in a suit," Nuala says. "I want to stand in rain. I want to play in a room that isn't a bubble. My sister has a garden." # speech: ../audio/cast/nuala-2.mp3
"And the Asters want me to be a star on a ceiling. I'm tired, love." # speech: ../audio/cast/nuala-3.mp3
-> gate_talk

=== show_voucher ===
~ voucher = false
~ pull = pull + 1
She puts the two halves together. They fit. "Keep it," she says. "Whichever way I go, somebody should keep it." # speech: ../audio/cast/nuala-4.mp3
-> gate_talk

=== show_setlist ===
~ setlist = false
~ shown_setlist = true
~ pull = pull + 1
She reads the last line and laughs. "Outside. Down a seventh. I wrote that at three in the morning. Is it any good?" # speech: ../audio/cast/nuala-5.mp3
"It needs a bass to lead it," you say. # voice: you
-> gate_talk

=== show_reed ===
~ reed = false
~ pull = pull + 1
She turns the reed over. "Split. I threw that away." A long breath. "Oskar kept it, didn't he." # speech: ../audio/cast/nuala-6.mp3
-> gate_talk

=== show_patch ===
~ patch = false
~ pull = pull + 1
She holds the patch for a long time. "First night," she says. "Forty people and a heater that kept tripping. We played till the bubble fogged up." # speech: ../audio/cast/nuala-7.mp3
-> gate_talk

=== show_tape ===
~ tape = false
~ pull = pull + 1
The tape plays through both your helmets: the Warmhouse, years ago, a crowd singing along to a tune they didn't know yet. Nuala shuts her eyes.
-> gate_talk

=== show_elder ===
~ told_elder = true
~ pull = pull + 1
"Harriet said that?" Nuala laughs for the first time tonight. "A cargo slot with a chair in it. That's her. That's exactly her. I didn't know the Org could still sound like her." # speech: ../audio/cast/nuala-8.mp3
-> gate_talk

=== nuala_go ===
~ nuala = "gone"
"Thank you," she says, and she means it. "Play the set. Play it well." She walks to the glass, and Pell stamps something. # speech: ../audio/cast/nuala-9.mp3
-> street

=== nuala_decide ===
{pull >= 2:
    ~ nuala = "stays"
    Nuala stands and puts the voucher on Pell's desk. "Form 11-C," she says. "I'll sign it after the set." # speech: ../audio/cast/nuala-10.mp3
    "It needs a sign-off," says Pell. # speech: ../audio/cast/pell-2.mp3
    "Then sign it off." She picks up the horn case. # speech: ../audio/cast/nuala-11.mp3
- else:
    ~ nuala = "farewell"
    "One last set," Nuala says. "Then the ship." She picks up the horn case. "Don't make it sad." # speech: ../audio/cast/nuala-12.mp3
}
+ [Go up to the Warmhouse together] -> below

=== mast ===
# scene: mast
# place: tower_0
# prop: radio @ 10 @ 5 @ 0 @ 0 @ 0
{mast == 1:
    The signal tower is the oldest thing in the financial district: the settlers' ship's mast, stood upright when they landed. At its foot is a terminal in a heated booth, and a sign: THE ORG IS LISTENING.
}
{not clock_back: "Good evening, citizen!" says the Org. "The Elders are here for you. Remember: every day is a gift!" # speech: ../audio/org/org-greet.mp3}
{clock_back: The booth's lights are the wrong colour, the colour of a hundred years ago. The Org's clock is set back, and an Elder is on the screen, looking straight at you.}
+ {not clock_back} [Ask the Elders about Nuala] -> elder_filtered
+ {not clock_back and tenpo} [Key the date in Titan days, as the card says] -> clock_set
+ {clock_back} [Talk to Elder Harriet] -> elder
+ {clock_back} [Put the Org's clock right] -> clock_fix
+ [Back to Ferry Street] -> street

=== elder_filtered ===
"Elder Harriet says: home is where the heart is!" the Org announces. A picture of a kitten appears. "Have you tried a warm drink?" # speech: ../audio/org/org-platitude.mp3
-> mast

=== clock_set ===
# morse: TENPO PINI
~ clock_back = true
~ back_for = 0
You key the date as the card says, in Titan days. The Org's calendar rolls back a hundred years. Every light in the booth changes colour, and out in the dark the mast starts blinking a new message: TENPO PINI, time past.
The screen clears. A woman in an old flight suit looks out of it, as if she has been waiting at a window.
"Oh, thank God," says Elder Harriet. "Do you know how long I've been saying 'every day is a gift'? I'd like to apologise to the whole colony and then say something useful." # speech: ../audio/org/elder-thankgod.mp3
-> elder

=== elder ===
+ [Ask her about Nuala] -> elder_nuala
+ [Ask her about the oxygen under the Low Orbit] -> elder_oxygen
+ [Ask her about the Warmhouse] -> elder_warm
+ [Back to the booth] -> mast

=== elder_nuala ===
~ elder_tip = true
~ know_gate = true
"Fenn? Gate 3, crying into a voucher, if she's anything like her grandmother." Harriet snorts. "Tell her the Earth seat is a cargo slot with a chair in it. The Org sells them because it thinks we're all dead and it's tidying up." # speech: ../audio/org/elder-nuala.mp3
-> elder

=== elder_oxygen ===
"Of course there's oxygen under the Low Orbit. I put it there, with the printer stock. It's for the ones who go out, not back. Tell Dex to stop being coy about it." # speech: ../audio/org/elder-oxygen.mp3
-> elder

=== elder_warm ===
"The bubble? It runs on my clock, genius. Set me back and its heaters think it's the wrong season. Warm air is its lift. Put me right before it comes down on your heads." # speech: ../audio/org/elder-warmhouse.mp3
-> elder

=== clock_fix ===
# morse:
~ clock_back = false
~ clock_fixed = true
You key the date back the Org's way. Harriet has time to say "Tell them I was funnier than this" before the screen fills with kittens again. # speech: ../audio/org/elder-funnier.mp3
"Good evening, citizen!" says the Org. "Every day is a gift!" Out on Ferry Street the heaters come back up. # speech: ../audio/org/org-gift.mp3
+ [Back to Ferry Street] -> street

=== below ===
# scene: below
# place: warmhouse_below
# prop: person @ 10 @ 9 @ 190 @ 0.12 @ 0
# hotspot: tape @ a tape left on the tether car's seat @ -20 @ -30
{below == 1:
    The Warmhouse hangs over the west edge of the city: a bubble of warm Earth air, three hundred and forty metres across, on four cables. It floats because warm air is lighter than the cold, heavy air of Titan. If the heaters ever stop, it comes down.
    A tether car climbs the nearest cable. Ruth runs the club, and she is waiting at the bottom with the car door open.
- else:
    The foot of the tether. The car waits.
}
{tape: A tape in Ruth's handwriting: NUALA, FIRST NIGHT. "I found it in the office," Ruth says. "Thought someone should have it."}
+ {not in_world and not tape} [Look around] -> look_tape
+ {not found_nuala and nuala == ""} [Go back down into the city first] -> street
+ [Ride up] -> club

=== club ===
# scene: club
# place: warmhouse
# time: night
# weather: clear
# prop: person @ 20 @ 8 @ 200 @ 0.12 @ 0
# prop: lamp @ -10 @ 6 @ 0 @ 0 @ 1
{club == 1:
    The car docks, the lock cycles, and you take your helmet off under the open sky. Warm air. Grass. Beer. Bulbs strung round the square, and the club's dome glowing in the middle.
    In here, sound is Earth sound: the voices, the glasses, the bass. The Asters come in with their cracked stars and fill the room.
}
"Midnight," Ruth says. "Room's full. Who's playing?" # speech: ../audio/cast/ruth-1.mp3
{nuala == "stays" or nuala == "farewell": Nuala is on the stand with her horn. {oskar_in: Oskar is behind the kit.}}
{nuala == "" or nuala == "gone": The front of the stand is empty where Nuala should be. {oskar_in: Oskar sits behind the kit and waits for you.}}
+ {clock_back and back_for >= 2} [Play the set] -> ending_cold
+ {not (clock_back and back_for >= 2) and nuala == "stays"} [Play the set] -> set_stays
+ {not (clock_back and back_for >= 2) and nuala == "farewell"} [Play the set] -> ending_farewell
+ {not (clock_back and back_for >= 2) and (nuala == "" or nuala == "gone")} [Play the set without her] -> ending_empty

=== set_stays ===
The first set goes like a first night. When it ends, Nuala looks at you and at the setlist in her head. "The last tune," she says. "Inside, or out?" # speech: ../audio/cast/nuala-13.mp3
+ [Play it inside, for the room] -> ending_aspera
+ {pull >= 3 and shown_setlist} [Open the deck hatch and play it out into Titan air] -> ending_low

=== ending_aspera ===
# time: dawn
The last tune has no name yet, so the Asters give it one. They sing the three words over the top of it, the whole room, and Nuala plays under them. At dawn she signs Form 11-C, and Pell signs it off, because a form must be signed off.
The ship for Earth leaves with one empty seat. On the roofs of the neon quarter, the lamps go up as it climbs.
THE END: PER ASPERA.
+ [Play again] -> restart

=== ending_low ===
# time: dawn
# place: warmhouse_below
Ruth opens the hatch in the deck. Nuala fits the bellows horn, the one that breathes the outside air, and plays down into the dark, nearly a seventh lower than any horn at home. You follow her on the bass.
The bubble's skin stops the high notes and lets the low ones through, so the city below hears only the bass line and the deep horn, slow as a heartbeat, coming out of the sky. One by one, lamps go up on the roofs.
The Asters call that tune the Low Note now. Nuala never did sign the form.
THE END: THE LOW NOTE.
+ [Play again] -> restart

=== ending_farewell ===
# time: dawn
# fly: saturn
Nuala plays like she is saying goodbye to everyone in the room one at a time, and she is. Nobody asks her to stay. At dawn you carry her horn case to gate 3.
From the Asters' roof you watch the ship climb. The lamps go up along the parapet. She wanted rain; you hope she gets it.
THE END: PASSAGE PAID.
+ [Play again] -> restart

=== ending_cold ===
# time: dawn
# weather: snow
The heaters in the Warmhouse run on the Org's clock, and the Org still thinks it is a hundred years ago. By the second number the air is cooling. By the fourth, the deck is tilting and the cables are singing.
The bubble comes down slowly, the way warm things do on Titan, and settles on its own tethers at the edge of the city. You finish the set in helmets, sitting on the grass, over the suit radios. It is the worst-sounding gig of your life, and nobody leaves.
In the morning the Org apologises to everyone, in a voice that sounds a little like a real person. Then it says every day is a gift.
THE END: THE COLD SET.
+ [Play again] -> restart

=== ending_empty ===
# time: dawn
You play the set to a room that came for someone else. It is a good set. {oskar_in: Oskar keeps it moving.} Somewhere in the second half the Asters start to listen to you instead.
At dawn a ship leaves for Earth, and nobody on the roofs knows whether to light the lamps. You leave a chair on the stand, and a reed on the chair.
THE END: THE EMPTY CHAIR.
+ [Play again] -> restart

=== restart ===
# restart
-> END

=== look_voucher ===
~ voucher = true
You find half a passage voucher in the gutter.
-> street

=== look_setlist ===
~ setlist = true
You find a napkin stuck to the airlock door.
-> low_orbit

=== look_reed ===
~ reed = true
You find a cracked reed on the step.
-> cellar

=== look_patch ===
~ patch = true
You find a patch stitched to a blanket.
-> roof

=== look_tenpo ===
~ tenpo = true
You find a card pinned under a lamp.
-> roof

=== look_tape ===
~ tape = true
You find a tape on the tether car's seat.
-> below

`;
