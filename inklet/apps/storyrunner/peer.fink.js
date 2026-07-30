// A second, SEPARATE story the demo links to via `# FINK: peer.fink.js`.
// Loading it proves the boxed runner can follow an authorized link and
// play another document in the same box.
//
// It is also the PARITY fixture for #779: it declares shared-economy VARs,
// pauses on `# MINIGAME:`, and then SPENDS what the game wrote. A runner
// that fires the launch and carries on would print the after-game line
// while the game was still on screen, with the old values — which is
// exactly the blocker this story exists to catch.
oooOO`
VAR diamonds = 0
VAR score = 0
VAR waterworld_won = false

// The story's own media layer. "./" means "beside this story file", which
// is where these fixtures keep their SVGs — the layered chain is
// global base → this → the path each beat names.
# BASEHREF: ./
// Declarative status items (spec §5.5.2): keyed by VAR, one tag each.
# STATUS: diamonds icon=💎 format=number
# STATUS: score icon=🏅 label=Score format=number
// Procedural sound: no file exists, the host's FinkFoley generates it.
# AUDIO: synth:water
# BG: rgb(20, 10, 28)
# IMAGE: media-feature.svg
Beyond the doorway: a different dock, a different tale.
// A TAG BINDS TO THE LINE THAT FOLLOWS IT, not the one before. Verified
// by dumping currentTags per Continue(): with the tag placed AFTER the
// lead-in it rides the POST-game line, so the beat that spends the
// winnings is the one that breaks the loop — and it prints the values
// from before the game. Hence the shipped convention, which
// mudslidemines.fink.js already follows: tag first, lead-in second,
// after-game content behind a divert.
# MINIGAME: waterworld
The arcade hums with old light. You climb down into the salvage rig.
-> surfacing

=== surfacing ===
You surface with {diamonds} diamond(s) and a score of {score}.
{waterworld_won: The dock keeper nods at the salvage. | The dock keeper says nothing.}
+ [Pocket them and go] -> ashore

=== ashore ===
The arcade dims behind you.
-> END
`;
