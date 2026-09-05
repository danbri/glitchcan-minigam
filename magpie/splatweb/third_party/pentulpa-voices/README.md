# Pentulpa Capulet — ElevenLabs voice lines

25 audio clips (5 personas × 5 Toki Pona lines each), generated
September 2026 from the script at
`magpie/splatweb/lib/pentulpa-voice-lines.js`. **Not wired into
`demo-lam-pentagram.html`** — this is asset production only; integration
is separate follow-up work.

Files: `<persona-id>/<01..05>.mp3`, one file per line in script order.

## Fix pass (5 Sept 2026): owner feedback after a first listen

The owner listened to all 25 clips and gave persona-by-persona feedback.
Four personas were regenerated; **Executioner was left untouched** ("is
good" — no API spend on a persona that already works). Summary:

| persona | feedback | what changed |
|---|---|---|
| Architect | "bored accountant leaving a voice message… slower, more dramatic, not absurdly so" | same voice (`0c9A9k7uKvPu5ugLdfZe`), `voice_settings` only: `speed` 0.95→0.85, `style` 0.10→0.35, `stability` 0.70→0.55 |
| Executioner | "is good" | **untouched** — not regenerated |
| Corruptor | "too similar to architect and same issues" | **redesigned voice**: new voice-design description (French-accented, low/husky, warm, seductive), new saved voice `6HgqSNigJDQ753nrKyCI`, replacing the old Welsh-accented `hxzH26Qlf6Fdq84amqsF`; settings `speed` 0.92→0.87, `style` 0.40→0.45, `stability` 0.50→0.45 |
| Mourner | "goodish, bit nasal" | **redesigned voice**: new voice-design description explicitly steering away from nasal placement toward a deep, open-throated chest voice, same West Country/male/mournful character; new saved voice `pa69TITcDkb0KAmlDsFE`, replacing `dPyI4HRWWEPjB0DhyNGC`; settings after 3 tuning rounds: `speed` 0.85→0.70 (the apparent API floor), `stability` 0.60→0.85, `style` 0.30→0.10, `similarity_boost` 0.75→0.60 |
| Prophet | "is great, bit fast" | same voice (`xsfZ7ocXo03RqHrZb4Qt`), `voice_settings` only: `speed` 1.00→0.90, everything else unchanged |

### Method: objective duration/pacing proxy (still no ears in this pipeline)

Nobody in this pipeline can listen, so pacing changes were verified the
only way available: characters-per-second (`text length / ffprobe
duration`) computed for every old clip vs its replacement, same text
each time, so a genuine slowdown must show up as a lower
characters/second figure.

- **Architect**: all 5 lines measurably slower (chars/sec dropped
  ~15–28% per line, e.g. line 1: 12.92→10.07 chars/sec). Consistent
  across all 5 — the `speed`+`stability`+`style` combination reliably
  produced a slower, less flat delivery by this proxy.
- **Corruptor**: 4 of 5 lines slower (chars/sec down 3–11%), 1 of 5
  (line 4) measurably faster by ~4%. Net direction is correct but not
  perfectly uniform — expected, since this used a freshly designed
  voice rather than a settings-only tweak on the same voice, so
  per-line variance is higher.
- **Prophet**: 4 of 5 lines slower (chars/sec down 10–47%), 1 of 5
  (line 3) faster by ~16%. Net direction correct; same caveat about
  per-line TTS variance.
- **Mourner**: this one did NOT go as planned. The freshly designed
  voice reads inherently faster than the original `dPyI4HRWWEPjB0DhyNGC`
  voice at matched settings — the first attempt at `speed: 0.85` (same
  as before) came back **faster** on all 5 lines (up to ~48% on one
  line), the opposite of intended, purely because it's a different
  underlying voice with a different natural cadence, not because
  `speed` didn't work. Two more tuning rounds (`speed` down to what
  appears to be the API's floor, 0.70; then `stability` up to 0.85 and
  `style` down to 0.10 to try to steady the delivery further) narrowed
  the gap but did not eliminate it — the final clips are still faster
  than the originals on all 5 lines (chars/sec up roughly 3–48%
  depending on the line, better than the ~24–48% range of the first
  attempt but not fully closed). **The owner didn't ask for a pacing
  change on Mourner** (only "bit nasal"), so this is an unintended
  side effect of the voice redesign, not a fix — flagging it honestly
  rather than papering over it. Stopped after 3 rounds per the
  "don't over-iterate" instruction; if the pacing shift reads as a
  character change on listen, the next move would likely be trying yet
  another voice-design take rather than more settings tweaks, since
  `speed` is already at its apparent floor.

### What this verification can and cannot tell you

Can verify: pacing direction (via chars/sec), that a clip isn't dead
air or garbled to near-silence (`ffmpeg -af volumedetect` mean_volume,
all 20 new clips landed in a normal -17 to -22 dB band, no outliers).

Cannot verify, at all, without listening: whether Architect/Corruptor
actually sound "dramatic" rather than just slower; whether Corruptor's
new French-accented voice is actually distinct-sounding from
Architect's Scottish voice (the *settings* are more different than
before, and it's a different underlying voice-design call entirely, but
"distinct enough" is a perceptual judgment); whether Mourner's nasal
quality is actually reduced (the design prompt explicitly asked for
"no nasal quality" and a lower median F0 was chosen among the 3 preview
takes as an imperfect proxy for "deeper/less nasal," but nasality is a
formant/timbre property, not something a pitch tracker measures); or
whether Toki Pona pronunciation held up in any of the 4 redone voices.
**The owner should listen to all 20 replaced clips before treating this
pass as done**, especially Mourner given the pacing caveat above.

## Approach: voice design, not the shared library

The task brief asked to search ElevenLabs' shared voice library first and
only fall back to voice design (text-to-voice) if no good library match
existed. **The library search step was not possible with the API key
available in this environment**: the key returns
`missing_permissions` for `voices_read` on both `GET /v1/voices` and
`GET /v1/shared-voices` (and also for `user_read`, `models_read`, and
`voices_write` — confirmed by direct API calls, not assumed). The key
does have permission for text-to-speech, and for the voice-design
endpoints (`/v1/text-to-voice/create-previews` and
`/v1/text-to-voice/create-voice-from-preview`), so all 5 personas use
**voice design** (a synthetic voice generated from a text description),
per the brief's explicit fallback path.

One consequence: because `voices_write` (delete) is also blocked, a
throwaway voice named `TEST-DELETE-ME` created while probing the save
endpoint could not be cleaned up via the API. It's harmless (never used
for any of the 25 lines) but the owner may want to delete it by hand from
the ElevenLabs dashboard.

## Method, per persona

For each persona: one `create-previews` call with a detailed
`voice_description` (gender, regional British accent, age, temperament,
explicitly "ordinary, non-theatrical, old-fashioned, clearly enunciated")
plus a short English demo line in that register. Each call returns 3
takes. Since nobody in this pipeline can literally listen, the 3 takes
were screened algorithmically: each was decoded with `ffmpeg`, and a
simple autocorrelation pitch tracker (`numpy`/`scipy`, no external ASR)
estimated the median fundamental frequency over voiced frames. This is a
real, objective check of the one spec requirement that's acoustically
verifiable without ears — gender — and every persona's **take 0** already
matched its required gender bucket, so take 0 was used for all five (no
cherry-picking across takes was needed). Subtler qualities (seductive,
despondent, erratic, etc.) were steered through the description prompt
and cannot be verified the same way — see "honest quality assessment"
below.

The selected take was saved permanently via `create-voice-from-preview`,
then used for the actual 5 Toki Pona lines via
`POST /v1/text-to-speech/{voice_id}` with `model_id: eleven_multilingual_v2`
per the brief (better handling of phoneme sequences the model wasn't
trained on than the English-only model).

| persona | gender | accent chosen | voice_id (original, Sept 2026) | voice_id (current, after 5 Sept fix pass) | why this accent |
|---|---|---|---|---|---|
| The Architect | female | Scottish (Edinburgh) | `0c9A9k7uKvPu5ugLdfZe` | same — `0c9A9k7uKvPu5ugLdfZe` | cold, precise, unshowy — a flatter, controlled cadence reads as strategic rather than performative |
| The Executioner | male | Yorkshire (Northern England) | `2dfo5fQCgWY69lVots4f` | same — untouched by the fix pass | blunt, thickset, plain-spoken — matches "pure impulse," not a mannered villain accent |
| The Corruptor | female | ~~Welsh (the Valleys)~~ → **French-accented** | `hxzH26Qlf6Fdq84amqsF` (superseded) | **`6HgqSNigJDQ753nrKyCI`** | owner found the Welsh voice too similar to Architect; redesigned as low, husky, French-accented to give it a genuinely different regional colour and lower register |
| The Mourner | male | West Country (South-West England) | `dPyI4HRWWEPjB0DhyNGC` (superseded) | **`pa69TITcDkb0KAmlDsFE`** | same character/accent, redesigned only to steer the voice-design prompt away from a nasal placement toward a deep, open-throated chest voice |
| The Prophet | female | Irish | `xsfZ7ocXo03RqHrZb4Qt` | same — `xsfZ7ocXo03RqHrZb4Qt` | lilting, sing-song rhythm gives the erratic/chaotic delivery somewhere to go without sounding like shouting |

Deliberately varied across five different regional flavours (Scottish,
Northern English, Welsh→French, West Country, Irish) rather than
repeating one, per the brief. None is cut-glass RP. The two superseded
voice IDs above are still live in the ElevenLabs account (can't be
deleted — see the `voices_write` permission note above) but are no
longer used by any file in this directory.

## Model and per-persona settings

- Model: `eleven_multilingual_v2` for every one of the 25 final lines.
- `voice_settings` were tuned per persona (`stability`/`style` trade calm
  control against volatility; `speed` slows the more mournful/seductive
  deliveries and quickens the more impulsive ones). **Current values**,
  after the 5 Sept 2026 fix pass (see that section above for what
  changed and why on the four touched personas):

| persona | stability | style | speed | similarity_boost | changed 5 Sept? |
|---|---|---|---|---|---|
| architect | 0.55 | 0.35 | 0.85 | 0.75 | yes — slower, more style |
| executioner | 0.30 | 0.60 | 1.05 | 0.75 | no — untouched |
| corruptor | 0.45 | 0.45 | 0.87 | 0.75 | yes — new voice + slower, more style |
| mourner | 0.85 | 0.10 | 0.70 | 0.60 | yes — new voice, settings re-tuned across 3 rounds trying (imperfectly) to hold the original pace — see fix-pass section |
| prophet | 0.20 | 0.80 | 0.90 | 0.75 | yes — slower only, voice/character unchanged |

`use_speaker_boost: true` for all five, unchanged. (Original Sept 2026
values, before the fix pass: `similarity_boost: 0.75` flat across all
five, `stability`/`style`/`speed` per the earlier table further up.)

## Honest quality assessment: Toki Pona pronunciation

Nobody on this pipeline has ears, so this is based on duration/energy
sanity-checking (via `ffmpeg` decode + RMS/duration measurement across
all 25 clips), not actual listening — **the owner should spot-check a
few clips before treating this as final.** With that caveat:

- All 25 clips decode cleanly as valid, non-silent MPEG audio (RMS
  0.08–0.16 throughout — no dead air, no clipping to silence).
- Duration scaled sensibly with text length across 24 of the 25 clips
  (~0.08–0.17 seconds per character, consistent with normal speech
  pacing at each persona's `speed` setting) — no signs of the model
  skipping or garbling syllables in bulk.
- One clip, `executioner/03.mp3` ("ilo utala mi li pakala e lawa
  sina!"), came back at 1.67s on the first take — under half the
  expected duration for its length, a strong signal of rushed/garbled
  output — and was regenerated once; the retake came back at a normal
  3.07s and was kept.
- Toki Pona's phonotactics (open CV/CVN syllables, no consonant
  clusters, only 14 phonemes) are about as friendly as an unfamiliar
  language gets for a TTS model with no training data on it, and
  nothing in the duration/energy profile suggests the model choked on
  the input. But duration/RMS sanity-checking cannot confirm the
  *phonemes themselves* came out correctly (e.g. whether "j" was read
  as English /dʒ/ instead of Toki Pona /j/, or whether vowel quality
  drifted toward the nearest English vowel) — that requires an actual
  listen. Treat this as "did not obviously break," not "verified
  correct pronunciation."

## Cost

877 characters of Toki Pona text billed across the 25 final
`text-to-speech` calls (one retake of `executioner/03` included), plus 5
`create-previews` calls (~250–450 characters of English description +
demo text each) and 5 `create-voice-from-preview` saves. The API key in
use lacks `user_read`, so subscription/usage-credit totals could not be
read back from ElevenLabs directly — the character counts above are
computed from the request payloads sent, not from ElevenLabs' own
billing report.

**5 Sept 2026 fix pass, additional cost:** ~1,047 characters of Toki
Pona `text-to-speech` billing (Architect 173 + Corruptor 187 + Prophet
198 = 558 in a single pass each; Mourner's 163-character line set was
billed **3 times**, 489 total, across the three tuning rounds needed to
chase the pacing issue described above), plus 2 `create-previews` calls
(Corruptor ~567 chars, Mourner ~553 chars of description+demo text) and
2 `create-voice-from-preview` saves. Same `user_read` gap as before —
character counts are computed from request payloads, not ElevenLabs'
own billing report. Executioner: zero additional spend, as instructed.
