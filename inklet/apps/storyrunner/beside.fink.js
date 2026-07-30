// A story that plays BESIDE another one — the peering fixture (level 2 of
// docs/foafos-story-layering-20260730.md).
//
// This runs in its own nested runner at its own opaque origin, alongside the
// story that opened it. Neither contains the other: the reader keeps their
// choices in the first story while this one keeps its own. That is what makes
// it a peer rather than a dream.
//
// It reads the SHARED ECONOMY, which is the point of a peer being a real
// session: the diamonds it names are the same diamonds, brokered by the shell
// through the runner that mediates for this frame.
//
// Fixture rules (INK-GOTCHAS.md): a tag binds to the line that FOLLOWS it,
// prose asterisks are escaped, and no backtick may appear anywhere above —
// one would close this template and extract as empty ink.
oooOO`
# BASEHREF: ./
VAR diamonds = 0
VAR score = 0

# STATUS: diamonds icon=💎
# IMAGE: media-accent.svg accent
A chart of the dock, drawn from beside you. It moves when you do.

+ [Read the soundings] -> soundings
+ [Fold the chart] -> folded
+ [Follow the margin note down] -> intothemargin

=== intothemargin ===
// A DREAM INSIDE A PEER. Depth belongs to a playthrough, so descending here
// must move THIS session's depth and leave the story beside it at zero — which
// is what the e2e checks, because a shared counter made a peer's dream turn
// the reader's own economy read-only.
# FINK: dream.fink.js
# LINKREL: goDeeper
The margin note keeps going, down the fold, into somewhere the chart does not admit to.
-> soundings

=== soundings ===
Seven fathoms at the mouth, three at the steps. Someone has written a number in the margin and circled it twice.
The margin says {diamonds}.
+ [Fold the chart] -> folded

=== folded ===
The chart folds along creases that were already there.
-> END
`;
