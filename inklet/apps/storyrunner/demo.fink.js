// A tiny self-contained .fink.js the boxed runner plays in its own frame.
// It exercises: prose, a # BG: (which must colour the FRAME, not the host),
// a choice tree, and a # MINIGAME: tag (which must surface as a governed
// verb request, not a direct launch). No external assets.
oooOO`
# BG: rgb(10, 31, 20)
You come to in a flooded lift shaft. Water to your knees, a torch on a hook.

* [Take the torch]
    The beam cuts the murk. A hatch, and a painted sign: DOCK 7.
    # STATUS: torch in hand
    -> hatch
* [Leave it and feel along the wall]
    Your fingers find a ladder instead.
    -> ladder

=== hatch ===
The hatch gives. Beyond it, a flooded arcade hums with old light.
# MINIGAME: waterworld
-> ending

=== ladder ===
You climb into a dry maintenance loft. A different way in.
-> ending

=== ending ===
Either way, the dock is waiting.
-> END
`;
