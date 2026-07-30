// The DREAM fixture (spec §3.4 / #779). The demo links here with
// `# LINKREL: goDeeper`, so this story is one level DOWN: its END pops
// back to the outer story mid-breath rather than ending the session.
//
// Also the read-only-economy fixture: inside a dream the shared economy
// is read-only (FoafVars.strictDreams), so the spend below is REFUSED —
// a dream keeps its own counters but cannot spend the waking world.
oooOO`
VAR diamonds = 0

// These fixtures keep their art BESIDE the story file, so they must say
// so: the layered chain's story layer defaults to "media/" (the Bagend
// pattern), and without this the SVGs resolve into a folder that does
// not exist. The e2e's role assertion passed at ZERO height while that
// was true — geometry alone cannot tell a laid-out image from a broken
// one.
# BASEHREF: ./
# BG: rgb(6, 6, 26)
# IMAGE: media-accent.svg accent
The dock dissolves. You are somewhere older, and the light comes from under the floor.
+ [Look under the floor] -> under
+ [Wake up] -> waking

=== under ===
Coins, or scales. You cannot tell, and the counting does not hold: {diamonds}.
+ [Wake up] -> waking

=== waking ===
The older place lets you go.
-> END
`;
