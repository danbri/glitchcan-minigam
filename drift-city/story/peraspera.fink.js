oooOO`
// Per Aspera: a night crawl through Drift city's dive bars to the jazz club in the Warmhouse.
// The same tags as The Lamplighter's Last Round (see that file's header): scene, place, time, weather, prop,
// hotspot, fly, voice. Speakers: mags, dex, oskar, nuala, pell, ruth, you.
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

-> street

=== function clues() ===
~ return voucher + setlist + reed + patch + tape

=== street ===
# scene: street
# place: street_1
# time: night
# weather: snow
# prop: person @ -20 @ 7 @ 30 @ 0.6 @ 0
# prop: crates @ 25 @ 6 @ 0 @ 0 @ 0
# hotspot: voucher @ a torn voucher in the gutter @ 30 @ -25
{street == 1:
    Night on Ferry Street. Snow drifts through the neon, and your bass case bumps against your suit leg. You play upright bass: an old instrument with a spruce body, built for Titan air, where its body booms lower and louder than it ever did at home.
    At midnight you play the Warmhouse, the only room under the open sky where people take their helmets off and hear music with their own ears. Nuala Fenn leads the band. Nuala Fenn has not been seen since noon.
    The megatower screens run the emigration campaign: LEAVE TITAN. GO HOME. PASSAGE PAID. Under the screen, someone has sprayed three words in silver: AD ASTRA PER ASPERA.
- else:
    Ferry Street, the snow still falling. {clues() > 0: In your case pocket: {voucher: a torn passage voucher;} {setlist: a setlist on a napkin;} {reed: a cracked reed;} {patch: an Aster patch;} {tape: a tape from the Warmhouse.}}
    {found_nuala: Midnight is close. The Warmhouse hangs over the west edge of the city, lit from inside.}
}
{voucher and street > 1: The voucher is the Org's: one seat, Titan to Earth, passage paid. The name is torn off. The gate number is not: gate 3, boarding at dawn.}
+ {not in_world and not voucher} [Look around] -> look_voucher
* {not heard_mags} [Go into the Cold Tap and ask Mags] -> mags
+ [Take the tube to the Low Orbit, by the spaceport] -> low_orbit
+ [Go down to the Lantern Cellar, Chinatown] -> cellar
+ {heard_dex or patch} [Climb to the Asters' roof] -> roof
+ {(voucher or know_gate) and not found_nuala} [Go to the emigration gate] -> gate
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
+ [Back into the snow] -> street

=== mags ===
# scene: mags
~ heard_mags = true
The Cold Tap is a dive bar behind an airlock: nine stools, a heater that ticks, and a price list older than the dome. You crack your helmet seal. The air smells of hops and hot metal.
"Nuala was in at noon," Mags says, and wipes the bar. "Sat where you're sitting. Drank one whisky, very slow, and didnae say a word." # voice: mags
"Then an Org clerk came in with a tablet and she signed something. Folk are saying she's taken a seat home. Passage paid." # voice: mags
She puts a glass in front of you. "The set's still on. Midnight, in the bubble. Ruth says it goes ahead with or without her." # voice: mags
+ [Ask what the Asters will say] -> mags_asters
+ [Thank her and go] -> street

=== mags_asters ===
"The Asters?" Mags laughs. "Half of them think Nuala hung the stars. Ask at the Low Orbit. Dex will tell you the whole creed, whether you want it or no." # voice: mags
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
+ {heard_dex and not know_gate} [Ask Dex where Nuala is] -> dex_where
+ [Back to Ferry Street] -> street

=== dex ===
# scene: dex
~ heard_dex = true
"Ad astra per aspera," Dex says. "To the stars, through hardship. Old words. We took them." # voice: dex
"The Org wants everybody gone home. Posters on every tower, seats paid, Earth tax credit. Earth's the past, innit. We're not going back. We're going out: the long ships, the next moon, the next star. The hard way." # voice: dex
"Nuala played our first night, in the Warmhouse. She taught us the rooftop thing: every launch, lamps up on the roofs so the crews can see them go." # voice: dex
+ [Ask where Nuala is] -> dex_where
+ [Back to Ferry Street] -> street

=== dex_where ===
~ know_gate = true
"If she's taken the Org's seat," Dex says quietly, "she'll be at gate 3 by now, sitting with it. That's where you go to make your mind up." # voice: dex
"Tell her the roof's still up there. That's all." # voice: dex
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
"Your bass is loud in here," he says afterwards. "Out in Titan air it would be louder. Thick air moves easily. The same cone, the same string, and nine decibels more bass. That is physics." # voice: oskar
"Nuala built a horn for Titan air. A bellows that breathes the outside air and blows it through the pipe. Out there it plays nearly a seventh lower than in here. She was saving it for a tune." # voice: oskar
+ [Ask him to play the Warmhouse] -> oskar_ask
+ [Back to Ferry Street] -> street

=== oskar_ask ===
{nuala == "gone":
    "Without Nuala?" Oskar shakes his head. "No. I play the jam. The jam doesn't leave." # voice: oskar
- else:
    ~ oskar_in = true
    "Midnight," Oskar says, and packs his brushes. "I'll be there. If she comes, she comes." # voice: oskar
}
+ [Back to Ferry Street] -> street

=== roof ===
# scene: roof
# place: roof_1
# prop: lamp @ -15 @ 8 @ 0 @ 0 @ 1
# prop: lamp @ 20 @ 9 @ 0 @ 0 @ 1
# prop: person @ 5 @ 12 @ 180 @ 0.62 @ 0
# hotspot: patch @ a patch stitched to a blanket @ -25 @ -30
{roof == 1:
    The Asters' roof: a flat top over the neon quarter with a view down the harbour arm to the pads. Lamps stand along the parapet, ready for the next launch. Snow on everything.
- else:
    The roof. The lamps wait along the parapet.
}
{patch: An old Aster patch, the cracked star, and under it in thread: N.F., FIRST NIGHT. She left it up here.}
{tape and roof > 1: Ruth's tape plays in your helmet: a crowd, a saxophone, a bass line going down and down.}
+ {not in_world and not patch} [Look around] -> look_patch
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
"Clerk Pell says I can still change my mind until dawn," she says, without looking round. "He has a form for it." # voice: nuala
"Form 11-C," says Pell, behind the glass. "Cancellation of passage, voluntary. It needs to be signed off." # voice: pell
-> gate_talk

=== gate_talk ===
+ {voucher} [Hand her the other half of the voucher] -> show_voucher
+ {setlist} [Show her the setlist] -> show_setlist
+ {reed} [Give her the cracked reed] -> show_reed
+ {patch} [Give her the patch from the roof] -> show_patch
+ {tape} [Play her Ruth's tape] -> show_tape
* [Ask her why] -> nuala_why
+ [Tell her to go, if she wants to] -> nuala_go
+ [Ask her to play one last set first] -> nuala_decide

=== nuala_why ===
"Twenty years in a suit," Nuala says. "I want to stand in rain. I want to play in a room that isn't a bubble. My sister has a garden." # voice: nuala
"And the Asters want me to be a star on a ceiling. I'm tired, love." # voice: nuala
-> gate_talk

=== show_voucher ===
~ voucher = false
~ pull = pull + 1
She puts the two halves together. They fit. "Keep it," she says. "Whichever way I go, somebody should keep it." # voice: nuala
-> gate_talk

=== show_setlist ===
~ setlist = false
~ shown_setlist = true
~ pull = pull + 1
She reads the last line and laughs. "Outside. Down a seventh. I wrote that at three in the morning. Is it any good?" # voice: nuala
"It needs a bass to lead it," you say. # voice: you
-> gate_talk

=== show_reed ===
~ reed = false
~ pull = pull + 1
She turns the reed over. "Split. I threw that away." A long breath. "Oskar kept it, didn't he." # voice: nuala
-> gate_talk

=== show_patch ===
~ patch = false
~ pull = pull + 1
She holds the patch for a long time. "First night," she says. "Forty people and a heater that kept tripping. We played till the bubble fogged up." # voice: nuala
-> gate_talk

=== show_tape ===
~ tape = false
~ pull = pull + 1
The tape plays through both your helmets: the Warmhouse, years ago, a crowd singing along to a tune they didn't know yet. Nuala shuts her eyes. # voice: nuala
-> gate_talk

=== nuala_go ===
~ nuala = "gone"
"Thank you," she says, and she means it. "Play the set. Play it well." She walks to the glass, and Pell stamps something. # voice: nuala
-> street

=== nuala_decide ===
{pull >= 2:
    ~ nuala = "stays"
    Nuala stands and puts the voucher on Pell's desk. "Form 11-C," she says. "I'll sign it after the set." # voice: nuala
    "It needs a sign-off," says Pell. # voice: pell
    "Then sign it off." She picks up the horn case. # voice: nuala
- else:
    ~ nuala = "farewell"
    "One last set," Nuala says. "Then the ship." She picks up the horn case. "Don't make it sad." # voice: nuala
}
+ [Go up to the Warmhouse together] -> below

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
"Midnight," Ruth says. "Room's full. Who's playing?" # voice: ruth
{nuala == "stays" or nuala == "farewell": Nuala is on the stand with her horn. {oskar_in: Oskar is behind the kit.}}
{nuala == "" or nuala == "gone": The front of the stand is empty where Nuala should be. {oskar_in: Oskar sits behind the kit and waits for you.}}
+ {nuala == "stays"} [Play the set] -> set_stays
+ {nuala == "farewell"} [Play the set] -> ending_farewell
+ {nuala == "" or nuala == "gone"} [Play the set without her] -> ending_empty

=== set_stays ===
The first set goes like a first night. When it ends, Nuala looks at you and at the setlist in her head. "The last tune," she says. "Inside, or out?" # voice: nuala
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

=== look_tape ===
~ tape = true
You find a tape on the tether car's seat.
-> below

`;
