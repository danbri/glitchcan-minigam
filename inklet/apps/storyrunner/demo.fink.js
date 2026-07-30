// A tiny self-contained .fink.js the boxed runner plays in its own frame.
// It tours the media roles (feature → hero → accent), a # BG: (which must
// colour the FRAME, not the host), and a # MINIGAME: tag (which must
// surface as a governed verb request). Media are bundled local SVGs.
oooOO`
// These fixtures keep their art BESIDE the story file, so they must say
// so: the layered chain's story layer defaults to "media/" (the Bagend
// pattern), and without this the SVGs resolve into a folder that does
// not exist. The e2e's role assertion passed at ZERO height while that
// was true — geometry alone cannot tell a laid-out image from a broken
// one.
# BASEHREF: ./
// Declared here so a MERGED chunk can read and write it. That is the point of
// merging rather than peering: annex.fink.js joins this engine and sees this
// variable live, where a peer — a separate session in a separate frame — could
// only reach the shared economy through the shell.
VAR diamonds = 0
# BG: rgb(10, 31, 20)
# IMAGE: media-feature.svg
# AUDIO: ambient.wav
You come to in a flooded lift shaft. Water to your knees, a torch on a hook.
A cracked screen glows on the far wall.
+ [Watch the drowned newsreel] -> newsreel

=== newsreel ===
# VIDEO: 0123456789a hero
The screen floods the shaft with light. For one long minute, the film is everything.
+ [Pocket the odd coin by the torch] -> coin

=== coin ===
# IMAGE: media-accent.svg accent
A small thing, easy to miss beside the torch. You keep it, and read the painted sign: DOCK 7.
# STATUS: torch in hand
// Choice 0 is the SPINE — the e2e walks it with choose(0) at every beat,
// so a new branch goes second or the suite's walk silently changes route.
+ [Step through the humming doorway] -> doorway
+ [Close your eyes for a moment] -> down
+ [Unroll the chart beside you] -> beside
+ [Open the door that was not there] -> annexdoor
+ [Try the door with the wrong key] -> clashdoor

=== annexdoor ===
// MERGE — composition with NO frame. annex.fink.js is appended to the ordered
// set this session has parsed, the union is recompiled, and the reader's place
// is carried across. ENTRY names the knot to walk into once it lands, and it is
// a tag rather than a URL fragment because "#" starts a tag in ink's own syntax:
// "annex.fink.js#annex" is two tags to the compiler. It is not a front door,
// because no reader can arrive at it.
# FINK: annex.fink.js
# LINKREL: merge
# ENTRY: annex
The door was not there a moment ago, and it is open.
-> annexrefused

=== annexrefused ===
// Only reached if the merge was REFUSED. On success the ENTRY tag has already
// taken the reader into the annex and this knot is never seen, because
// ChoosePathString resets the callstack and discards what was queued here.
// Either way the reader is still reading, which is the behaviour that matters.
The door is only a door after all. You stay where you are.
+ [Back to the sign] -> coin

=== clashdoor ===
// THE DELIBERATE COLLISION. annexclash.fink.js redeclares this story's own
// VAR and one of its knots, so the union does not compile — and the reader must
// end up here, reading, rather than looking at a broken story.
# FINK: annexclash.fink.js
# LINKREL: merge
# ENTRY: annex
The key turns and then stops, as if the lock had changed its mind.
-> clashrefused

=== clashrefused ===
The door stays shut. The shaft is still the shaft.
+ [Back to the sign] -> coin

=== beside ===
// peer STANDS BESIDE: both stories live, neither inside the other, and this
// one keeps its choices while the chart keeps its own. Tag first, lead-in
// second — a tag binds to the line that FOLLOWS it.
# FINK: beside.fink.js
# LINKREL: peer
You unroll the chart on the crate beside you, and leave it open.
-> chartopen

=== chartopen ===
The chart lies open beside you, and the shaft still waits.
+ [Step through the humming doorway] -> doorway
+ [Close your eyes for a moment] -> down
-> END

=== doorway ===
// A bare FINK link REPLACES — the back-compatible default.
// TAGS BIND TO THE LINE THAT FOLLOWS THEM, so the tag goes FIRST and the
// lead-in second. See the note in down/ below.
# FINK: peer.fink.js
The doorway hums with a light from somewhere else. You step through, into another story entirely.
-> END

=== down ===
// goDeeper DESCENDS and keeps the way back: dream.fink.js's END pops
// here, mid-breath, rather than ending the session.
//
// THE RULE, verified twice by dumping currentTags per Continue(): a tag
// binds to the line AFTER it. With these two tags placed below "You close
// your eyes." they bound to the line in the awake knot instead — so the beat
// emitted the post-dream line BEFORE descending, and the state saved for
// the way back was already past it. On surfacing there was nothing left
// to say and the reader got an empty beat. Tag first, lead-in second,
// after-content behind a divert.
# FINK: dream.fink.js
# LINKREL: goDeeper
You close your eyes.
-> awake

=== awake ===
You open them again, back at the shaft, with the taste of somewhere older.
+ [Step through the humming doorway] -> doorway
-> END
`;
// A .fink.js is executable JS. This benign line stands in for any code a
// story's file runs: if extraction happened in the RUNNER frame it would
// land on the runner's window; because it happens in a NESTED box, the
// runner never sees it. The e2e asserts the runner has no __stpr_canary.
try { window.__stpr_canary = 'ran-in-frame'; } catch (e) { /* boxed */ }
