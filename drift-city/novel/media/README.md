# Novel page media: the Lantern Cellar

| file | what | made by |
|---|---|---|
| cellar-arrival.jpg, cellar-singer-horn.jpg, street-snow.jpg | stills | tiles cut from an image the owner made with ChatGPT from a Drift city screenshot (September 2026), at their own size (about 365 px), JPEG quality 80, progressive |
| cellar-lantern-loop.webm / .mp4 | the moving panel, 540x540, 16.1 s loop, no sound: VP9 154 KB, H.264 256 KB | one Kling 3.0 Pro image-to-video take (ElevenLabs connector) from `../../bible/refs/woman-in-green-v2.jpg`, looped with ffmpeg |
| cellar-lantern-poster.jpg | the loop's first frame | ffmpeg |

- Revision 2 (2026-09-28, owner: "make her 15% heavier, dressed for somewhat colder climate while still elegant").
  The start still is a Gemini 3 Pro image edit of the old tile (about 3,654 credits for two variants), cropped square;
  it is the reference image on her character sheet. The video is one 8 s take from that still (5,430 credits). The
  loop is the first 193 frames forward, then the same frames backward, so it ends where it starts. A slow zoom
  (5% to 8.5%) and drift follow a cosine over the whole loop and return to the start.
- Revision 1 (two takes joined, 34.5 s, about 10,860 credits) is in git history.
- Panels a and c are still revision 1 of the figure. They need the same edit before this page is consistent.
- The people in these images are generated, not real people.
- H.264 for Safari and most browsers; VP9 WebM as a second source for browsers without H.264 (open-source Chromium).
- Sized for phones (September 2026, owner: "compress it down for efficient mobile use"): the page weighs about
  370 KB with the WebM, 550 KB with the MP4 (it was 1.6 MB). 540 px is enough: the panel is about 230 CSS px wide
  zoomed out and 600 zoomed in. At 540 px, H.264 CRF 29 (veryslow, tune film) and VP9 CRF 44 looked the same as the
  720 px CRF 24 version in an enlarged side-by-side check. The stills had been scaled 2x, which added bytes and no
  detail; they are now at their own size.
