// A MERGE CHUNK — the fixture for frameless composition (level 2 of
// docs/foafos-story-layering-20260730.md).
//
// This file HAS NO FRONT DOOR. Arriving at it alone would be meaningless: it
// opens on no knot of its own devising, it declares no variables, and its only
// exit leads back into the story that pulled it in. That is the test the owner
// set — "could a reader have arrived here instead?" — and the answer is no.
// So it gets no frame, no origin and no session: it joins the engine already
// running, is appended to the ordered set that session has parsed, and the
// union is recompiled with the reader's place carried across.
//
// It reads and WRITES the live state (`diamonds`, declared by the story it
// merges into), which is the thing an episode of one work needs and a peer
// must never have. Measured offline before any of this was built: a merged-in
// knot sees the restored value and can increment it.
//
// Fixture rules (INK-GOTCHAS.md): a tag binds to the line that FOLLOWS it,
// prose asterisks are escaped, and no backtick may appear anywhere above —
// one would close this template and extract as empty ink.
oooOO`
=== annex ===
The annex was not here a moment ago. It smells of cold water and old paper, and
it is plainly part of the same building.
~ diamonds = diamonds + 1
Something small and bright is on the sill. You take it.
+ [Count what you are carrying] -> annexcount
+ [Go back through the door you came by] -> dockside

=== annexcount ===
You are carrying {diamonds}.
+ [Go back through the door you came by] -> dockside

=== dockside ===
// A DIVERT INTO THE STORY THIS CHUNK WAS MERGED INTO. It compiles only as part
// of the union, which is the clearest possible statement that this file is not
// a work on its own — and the reason the e2e drives it rather than trusting it.
The door gives onto the dock, exactly where it should.
-> coin
`;
