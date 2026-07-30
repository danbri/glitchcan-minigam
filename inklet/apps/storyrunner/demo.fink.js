// A tiny self-contained .fink.js the boxed runner plays in its own frame.
// It tours the media roles (feature → hero → accent), a # BG: (which must
// colour the FRAME, not the host), and a # MINIGAME: tag (which must
// surface as a governed verb request). Media are bundled local SVGs.
oooOO`
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
