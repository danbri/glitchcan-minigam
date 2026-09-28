# Novel page media: the Lantern Cellar

| file | what | made by |
|---|---|---|
| cellar-arrival.jpg, cellar-singer-horn.jpg, street-snow.jpg | stills | tiles cut from an image the owner made with ChatGPT from a Drift city screenshot (September 2026), at their own size (about 365 px), JPEG quality 80, progressive |
| cellar-lantern-loop.webm / .mp4 | the moving panel, 540x540, 34.5 s loop, no sound: VP9 281 KB, H.264 465 KB | two Kling 3.0 Pro image-to-video takes (ElevenLabs connector) from another tile of that image, joined with ffmpeg |
| cellar-lantern-poster.jpg | the loop's first frame | ffmpeg |

- The loop: take 1 (start and end frame the same still; she barely moves), then take 2 (start frame only; she taps
  time, nods, sways) forward, back to its tapping part, forward again, then backward to the start. Every join meets
  at matching frames. A slow zoom and drift (7.5% at most) spans the whole loop and returns to its start. Cost:
  about 10,860 ElevenLabs credits for the two takes.
- The people in these images are generated, not real people.
- H.264 for Safari and most browsers; VP9 WebM as a second source for browsers without H.264 (open-source Chromium).
- Sized for phones (September 2026, owner: "compress it down for efficient mobile use"): the page weighs about
  370 KB with the WebM, 550 KB with the MP4 (it was 1.6 MB). 540 px is enough: the panel is about 230 CSS px wide
  zoomed out and 600 zoomed in. At 540 px, H.264 CRF 29 (veryslow, tune film) and VP9 CRF 44 looked the same as the
  720 px CRF 24 version in an enlarged side-by-side check. The stills had been scaled 2x, which added bytes and no
  detail; they are now at their own size.
