# Novel page media: the Lantern Cellar

| file | what | made by |
|---|---|---|
| cellar-arrival.jpg (960x536), cellar-singer-horn.jpg (460x768) | stills, revision 2 of the woman in green | Gemini 3 Pro image edits (ElevenLabs connector, 2026-09-28) of the revision 1 tiles, with the revision 2 still as a second reference; 2,436 credits each. The model returned 16:9 and widened panel a's scene (more diners at the side tables); panel c is cropped around her from the 16:9 result |
| street-snow.jpg | still | a tile cut from an image the owner made with ChatGPT from a Drift city screenshot (September 2026), at their own size (about 365 px), JPEG quality 80, progressive |
| cellar-lantern-loop.webm / .mp4 | the moving panel, 540x540, 16.1 s loop, no sound: VP9 154 KB, H.264 256 KB | one Kling 3.0 Pro image-to-video take (ElevenLabs connector) from `../../bible/refs/woman-in-green-v2.jpg`, looped with ffmpeg |
| cellar-lantern-poster.jpg | the loop's first frame | ffmpeg |

- Revision 2 (2026-09-28, owner: "make her 15% heavier, dressed for somewhat colder climate while still elegant").
  The start still is a Gemini 3 Pro image edit of the old tile (about 3,654 credits for two variants), cropped square;
  it is the reference image on her character sheet. The video is one 8 s take from that still (5,430 credits). The
  loop is the first 193 frames forward, then the same frames backward, so it ends where it starts. A slow zoom
  (5% to 8.5%) and drift follow a cosine over the whole loop and return to the start.
- Revision 1 (two takes joined, 34.5 s, about 10,860 credits) is in git history.
- Panels a, b and c now all show revision 2 of the figure.
- The people in these images are generated, not real people.
- H.264 for Safari and most browsers; VP9 WebM as a second source for browsers without H.264 (open-source Chromium).
- Sized for phones (September 2026, owner: "compress it down for efficient mobile use"): the page weighs about
  370 KB with the WebM, 550 KB with the MP4 (it was 1.6 MB). 540 px is enough: the panel is about 230 CSS px wide
  zoomed out and 600 zoomed in. At 540 px, H.264 CRF 29 (veryslow, tune film) and VP9 CRF 44 looked the same as the
  720 px CRF 24 version in an enlarged side-by-side check. The stills had been scaled 2x, which added bytes and no
  detail; they are now at their own size.
