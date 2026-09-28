# Novel page media: the Lantern Cellar

| file | what | made by |
|---|---|---|
| cellar-arrival.jpg (960x536), cellar-singer-horn.jpg (460x768) | stills, revision 2 of the woman in green | Gemini 3 Pro image edits (ElevenLabs connector, 2026-09-28) of the revision 1 tiles, with the revision 2 still as a second reference; 2,436 credits each. The model returned 16:9 and widened panel a's scene (more diners at the side tables); panel c is cropped around her from the 16:9 result |
| street-snow.jpg (1100x614) | still, revision 2: a Titan street | Gemini 3 Pro image edit (ElevenLabs connector, 2026-09-28; two variants, 3,654 credits) of the first tile, after the owner found it "too earthlike". Brief from the drift-city skill: methane ice and snow, orange-brown haze, a sealed glass traffic tube about 11 m up with a teardrop car, domes and round-window slabs, coat-cut pressure suits with bubble helmets, faces hard to place. Take B kept the original composition |
| cellar-lantern-loop.webm / .mp4 | the moving panel, revision 3: 540x540, 10.2 s forward loop, no sound: VP9 192 KB, H.264 229 KB | a 12 s Kling 3.0 Pro take from `../../bible/refs/woman-in-green-v3.jpg` (8,145 credits) plus a 3 s Kling 3.0 Pro bridge clip (2,036 credits); see below |
| cellar-lantern-poster.jpg | the loop's first frame | ffmpeg |

- Revision 3 (2026-09-28, owner: the revision 2 hand movement was "super creepy ... floaty (and i guess also run
  backwards) plus oversized and stretched so werewolfy"; "change a table into a minimalistic drumkit and have her
  efficiently effortlessly drumming"; everyone's appearance "hard to place"). The still is a Gemini 3 Pro edit of
  revision 2 (two variants, 3,654 credits): snare, hi-hat and floor tom instead of the table, brushes on the snare,
  a face that is hard to place. The loop plays forward only. Take frames 56 to 227 (2.3 s to 9.5 s, where her hands
  work the snare), then a 3 s bridge clip that Kling generated from take frame 228 (start) to take frame 52 (end), then
  back to the start. The last 4 frames of the bridge blend into frames 52 to 55. No frame pair inside the take matched
  well enough for a plain cut (best pair: worse than frames one second apart), which is why the bridge exists.
  Measured on the result: typical step between frames 0.76, largest 1.57 (at the take-to-bridge join), wrap 0.95.
- Revision 2 (in git history): one 8 s take, played forward then backward; the owner rejected it (above).
- Revision 1 (two takes joined, 34.5 s, about 10,860 credits) is in git history.
- Panels a and c still show revision 2 of her face, with a table and no drum kit.
- The people in these images are generated, not real people.
- H.264 for Safari and most browsers; VP9 WebM as a second source for browsers without H.264 (open-source Chromium).
- Sized for phones (September 2026, owner: "compress it down for efficient mobile use"): the page weighs about
  370 KB with the WebM, 550 KB with the MP4 (it was 1.6 MB). 540 px is enough: the panel is about 230 CSS px wide
  zoomed out and 600 zoomed in. At 540 px, H.264 CRF 29 (veryslow, tune film) and VP9 CRF 44 looked the same as the
  720 px CRF 24 version in an enlarged side-by-side check. The stills had been scaled 2x, which added bytes and no
  detail; they are now at their own size.
