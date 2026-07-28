// A tiny self-contained .fink.js the boxed runner plays in its own frame.
// It tours the media roles (feature → hero → accent), a # BG: (which must
// colour the FRAME, not the host), and a # MINIGAME: tag (which must
// surface as a governed verb request). Media are bundled local SVGs.
oooOO`
# BG: rgb(10, 31, 20)
# IMAGE: media-feature.svg
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
+ [Open the hatch] -> hatch

=== hatch ===
# IMAGE: media-feature.svg
The hatch gives. Beyond it, a flooded arcade hums with old light.
# MINIGAME: waterworld
-> ending

=== ending ===
The dock is waiting.
-> END
`;
// A .fink.js is executable JS. This benign line stands in for any code a
// story's file runs: if extraction happened in the RUNNER frame it would
// land on the runner's window; because it happens in a NESTED box, the
// runner never sees it. The e2e asserts the runner has no __stpr_canary.
try { window.__stpr_canary = 'ran-in-frame'; } catch (e) { /* boxed */ }
