/* larkspur.fink.js — Larkspur Falls: The Snowglobe Affair
   A holiday romance pastiche with a light mystery, in six scenes. October 2026.
   Characters, places and the look of each: larkspur/bible/characters.json.
   Image and video prompts: larkspur/bible/prompts.json. Media: larkspur/media/.
   The genre surface is deliberate; the wrong notes (the man with the wreath, the clock, the snow) are the point
   (nocliches skill, rule F7). */

oooOO`
# BASEHREF: larkspur/media/
# STATUS: clues icon=🔎 label=clues max=3
VAR clues = 0
VAR has_case = false
VAR has_ledger = false
VAR has_board = false
VAR heard_tray = false
VAR saw_loafers = false
VAR names = 0
VAR warmth = 0
VAR accused = ""
VAR solved = false

-> title

=== title ===
# IMAGE: title.jpg
Larkspur Falls: The Snowglobe Affair

A holiday mystery in six scenes.

+ [Begin] -> arrival

=== arrival ===
# VIDEO: arrival.mp4 poster=arrival.jpg
Your flight to the Zurich audit is cancelled at 3:10. The storm has a name, Winter Storm Gwendolyn, and plans for the whole Midwest.

The only bus still running goes north. Four hours later it leaves you on Main Street in Larkspur Falls, the town you left at eighteen.

Nothing has moved. The bulbs strung across the street. The gazebo on the green. Snow falling as if someone up there is paid by the flake.

A man in a flat cap stands by the lamppost, holding a holly wreath. He nods to you as if you are late.

+ [Find Aunt Bea's bakery] -> bakery
+ [Ask him the way] -> arrival_extra

=== arrival_extra ===
~ names += 1
Before he can answer, a woman pulling a sled calls out, "Evening, Gary!"

"Gary," she tells you. "From the hardware store."

Gary says nothing. He lifts the wreath an inch, towards the cranberry awning across the street.

-> bakery

=== bakery ===
# IMAGE: rollingpin.jpg
The Rolling Pin smells of cardamom, the way it did when you were nine.

Aunt Bea comes round the counter with flour to the elbows and holds on to you for a long time.

"Nora. You came home."

"My flight was cancelled."

"That's how everybody comes home," she says. "Sit down. Eat a bun. Then help me with a crime."

The Founders' Snowglobe is gone. It has stood in the town hall since 1912. Tomorrow night it should be in the gazebo for the Lantern Festival, where the mayor shakes it and the whole town watches the snow go up.

"Up?"

"Up," says Bea, and puts a bun in front of you.

+ ["Why does it go up?"] -> bakery_up
+ [Go to the town hall] -> townhall

=== bakery_up ===
Bea thinks about it.

"Why does yours go down?"

You have no answer that is not physics. You eat the bun.

-> townhall

=== townhall ===
# IMAGE: townhall.jpg
The clock on the town hall says 4:52. It said 4:52 the night you left.

Inside, a glass case stands empty on a velvet plinth. Beside it waits Mayor Delphine Oakes with a clipboard, and beside her, in a fire-department jacket, Wes Calloway.

Sixteen years. He has a beard now. You had a speech ready for this, just in case, and it has gone.

"Nora Halvorsen," says the mayor. "Our accountant. Thank heaven."

"I'm not your accountant."

"Tonight you are."

"Hello, Wes."

"Is it?" he says.

At the back of the lobby, a man in a flat cap holds a holly wreath. "Pastor Gil," the mayor says, without turning round. "He blesses the lanterns."

~ names += 1
-> townhall_hub

=== townhall_hub ===
* [Look at the case]
    ~ clues += 1
    ~ has_case = true
    The lock is not broken. Someone opened it with a key.

    On the velvet, where the walnut base stood, there is a fine dust of sugar and cinnamon. You taste it, which no forensic accountant should do.
    -> townhall_hub
* [Read the festival ledger]
    ~ clues += 1
    ~ has_ledger = true
    # IMAGE: ledger.jpg
    The mayor hands you a green clothbound ledger. Column after column in Bea's round hand.

    Then one entry in a narrower, neater hand: Glass repair, $70, cash, Dec 11.

    The 7 has a bar through the middle. Last night was the eleventh.
    -> townhall_hub
* [Ask who has keys]
    "Three keys," says the mayor. "Mine. The fire chief's. And the cleaner's, who is in Florida."

    Wes holds up his key. "Do I look like a thief?"

    "You look like a fire chief."

    "Is that a no?"

    He adds, more quietly: "Somebody in city shoes walked round the back last night. No socks, by the prints. Who walks in snow with no socks?"
    ~ saw_loafers = true
    -> townhall_hub
+ [Go with Wes]
    "I need to check the tree farm before the storm," says Wes. "Coming?"
    -> treefarm

=== treefarm ===
# VIDEO: treefarm.mp4 poster=treefarm.jpg
Wes drives you out in the town plough. Rows of firs, a red barn, a lantern lit by the door.

In the shed a woodstove ticks. There are two mugs of cocoa on the bench. You did not see him make them.

-> treefarm_hub

=== treefarm_hub ===
* ["Why did you stay?"]
    ~ warmth += 1
    "Why did you go?"

    You wait. He gives in first.

    "Somebody had to know where the trees are."
    -> treefarm_hub
* [Ask about last year's festival]
    ~ heard_tray = true
    "Agatha Pruitt carried a tray of pecan pies through the gazebo," he says. "The band started, she turned round, and the tray caught the snowglobe. It rang like a bell."

    "Was it damaged?"

    "Nobody looked. Everybody was looking at the pies."
    -> treefarm_hub
* [Look out of the window]
    Between the firs, a man in a flat cap stands in the snow with a holly wreath.

    "Deputy Bram," says Wes. "He's off duty."
    ~ names += 1
    -> treefarm_hub
+ [Drink the cocoa]
    ~ warmth += 1
    It is too sweet. It is exactly how you remember it.

    He leans in. You lean in.

    His radio crackles. "Chief, the lanterns are here and they are the wrong lanterns."

    He closes his eyes. "Is there a right lantern?"
    -> mainstreet

=== mainstreet ===
# IMAGE: mainstreet.jpg
Main Street, the night before the festival. The Rolling Pin under its cranberry awning. Across the road, Pruitt's Pies under its navy one. For thirty years neither has crossed the street.

-> mainstreet_hub

=== mainstreet_hub ===
* [Go into Pruitt's Pies]
    ~ clues += 1
    ~ has_board = true
    # IMAGE: pruitts.jpg
    Agatha Pruitt is dusting a pie with cinnamon sugar.

    Her chalkboard: apple $7, pecan $9, cranberry $7.50. Every seven has a bar through it.

    "I trained in Lyon," she says. "We do not write our sevens like ones."

    There is a sticking plaster on her right index finger.

    "Glass?" you ask.

    "Pastry knife," she says, too fast.
    -> mainstreet_hub
* [Talk to the man in the camel coat]
    # IMAGE: trent.jpg
    Trent Whitlock, property developer, is photographing the town hall in loafers with no socks.

    "This town has great bones," he says. "I'd like to buy most of them."

    {saw_loafers: "Were you round the back of the town hall last night?" | "What brings you out in the snow?"}

    "I wanted a picture of the clock. It's stuck. Did you know it's stuck?"
    -> mainstreet_hub
* [Look up at the ladder]
    A man in a flat cap is up a ladder, fixing a string of bulbs with one hand. The other holds a holly wreath.

    "Mr Fenwick," says Bea, passing with a tray. "He does the lights."
    ~ names += 1
    {names >= 3: You count. That is {names} names for one moustache.}
    -> mainstreet_hub
+ [Go to the festival] -> festival

=== festival ===
# IMAGE: gazebo.jpg
The next night. Hundreds of paper lanterns hang in the gazebo. The whole town is here in hats and scarves.

Mayor Oakes taps the microphone. "Nora Halvorsen will now tell us who took the Founders' Snowglobe."

You did not agree to this.

You open your red notebook.

{has_case: The case was opened with a key, and there was cinnamon sugar on the velvet.}
{has_ledger: Someone paid $70 for glass repair the night it went, and wrote the 7 with a bar.}
{has_board: Agatha Pruitt writes her sevens with a bar and dusts her pies with cinnamon sugar.}
{heard_tray: Last year her tray hit the globe.}
{saw_loafers: Someone in city shoes went round the back.}
{clues == 0: The notebook is empty. You turn a page as if it were not.}

+ [Agatha Pruitt] -> accuse_pruitt
+ [Trent Whitlock] -> accuse_trent
+ [Wes Calloway] -> accuse_wes
+ [Ask for it back, no questions] -> accuse_none

=== accuse_pruitt ===
~ accused = "pruitt"
{has_ledger && has_board:
    ~ solved = true
    You go through it in order: the ledger, the barred seven, the cinnamon sugar, the plaster on her finger.

    "You didn't steal it," you say. "You took it to be mended."

    The green is very quiet.

    Agatha Pruitt walks to the gazebo with a bakery box. Inside is the Founders' Snowglobe, the glass whole again.

    "Last year my tray cracked it," she says. "Nobody looked at the globe. Everybody looked at my pies."

    "And the seventy dollars?"

    "I put it back in the jar this morning. Count it."

    You count it. It is there.
- else:
    "On what evidence?" says Agatha Pruitt.

    You look at your notebook. It does not help.

    She sighs, walks to the gazebo, and puts a bakery box on the rail. Inside is the snowglobe, mended. "Since you ask so poorly."
}
-> finale

=== accuse_trent ===
~ accused = "trent"
The town gasps. The town has waited years to gasp at Trent Whitlock.

"I was photographing the clock," says Trent.

"Oh, for heaven's sake," says Agatha Pruitt. She walks to the gazebo with a bakery box. Inside is the snowglobe, mended. "Last year my tray cracked it. I had it repaired. Leave the man his loafers."

-> finale

=== accuse_wes ===
~ accused = "wes"
~ warmth -= 1
Wes takes off his cap.

"Do you really think that?"

Before you can answer, Agatha Pruitt walks to the gazebo with a bakery box. Inside is the snowglobe, mended. "It was me. Last year my tray cracked it. I had it repaired. The fire chief is innocent, and so is his face."

-> finale

=== accuse_none ===
~ accused = "nobody"
"Whoever has it," you say into the microphone, "please put it on the bench by the gazebo. No questions."

The lanterns flicker. When they steady, the snowglobe is on the bench, mended, beside a pecan pie dusted with cinnamon sugar.

Everybody looks at Agatha Pruitt. Agatha Pruitt looks at the pie.

-> finale

=== finale ===
# VIDEO: finale.mp4 poster=finale.jpg
The mayor lifts the Founders' Snowglobe and shakes it. The town counts down from ten.

Inside the glass, the snow rises past the tiny town hall and gathers at the top.

Wes is next to you.
{accused == "wes": "You thought it was me." "For about a minute." "Was it a long minute?" He takes your hand anyway.}
{accused != "wes": He takes your hand.}

"Are you staying?" he asks.

+ ["Are you asking?"]
    ~ warmth += 1
    "Yes."

    He kisses you under the paper lanterns, and somebody's grandmother claps.
    -> wreath
+ [Look for the morning bus]
    "There's a bus at eight," you say.

    "There's a bus every year," says Wes. "Bring the cold weather back with you."
    -> wreath

=== wreath ===
# IMAGE: wreath.jpg
At the edge of the crowd, the man in the flat cap hangs his holly wreath on the gazebo rail.

{names >= 4:
    "Gary," you say. "Gil. Bram. Fenwick."

    "Pick one," he says. It is the first thing he has said.
- else:
    "Who are you?" you ask.

    "Same as last year," he says. It is the first thing he has said.
}

He looks past you, just over your shoulder, the way people look at a camera.

"See you next year, Nora. We'll all be here."

For three seconds, all round the gazebo, the snow falls upward. Nobody else looks up.

Then it comes down again.

-> credits

=== credits ===
# IMAGE: title.jpg
The End.

{solved: You solved the Snowglobe Affair, with {clues} of 3 clues. | The snowglobe came home without your help. You found {clues} of 3 clues.}

{names >= 4: You noticed all four of him.}

Larkspur Falls will return.

-> END
`
