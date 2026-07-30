// A MERGE CHUNK THAT DOES NOT FIT — the collision fixture.
//
// Measured offline with the real compiler before the merge was built: two files
// that both declare the same `VAR`, or both define the same knot name, are a
// COMPILE ERROR. This file does both against demo.fink.js on purpose.
//
// That error is the GOOD failure. Nothing is silently overwritten, and the
// arbiter is the real compiler rather than a pattern-matching guess at what an
// ink identifier is. The runner compiles the union into a local, so a refusal
// leaves the reader exactly where they were, reading the story they had — which
// is what the e2e asserts, along with the author being told in the compiler's
// own words.
//
// This is what "an episodal city built by many hands" runs into on contact with
// a second author, and why it is diagnosed rather than papered over.
//
// Fixture rules (INK-GOTCHAS.md): a tag binds to the line that FOLLOWS it,
// prose asterisks are escaped, and no backtick may appear anywhere above.
oooOO`
// COLLISION 1: demo.fink.js already declares this.
VAR diamonds = 99

// COLLISION 2: demo.fink.js already defines a knot called coin.
=== coin ===
A different coin entirely, from a different story, in the same namespace.
-> END

=== annex ===
Never reached: the union above does not compile, so nothing here runs.
-> END
`;
