# Pentulpa Capulet — ElevenLabs voice lines

25 audio clips (5 personas × 5 Toki Pona lines each), generated
September 2026 from the script at
`magpie/splatweb/lib/pentulpa-voice-lines.js`. **Not wired into
`demo-lam-pentagram.html`** — this is asset production only; integration
is separate follow-up work.

Files: `<persona-id>/<01..05>.mp3`, one file per line in script order.

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

| persona | gender | accent chosen | voice_id | why this accent |
|---|---|---|---|---|
| The Architect | female | Scottish (Edinburgh) | `0c9A9k7uKvPu5ugLdfZe` | cold, precise, unshowy — a flatter, controlled cadence reads as strategic rather than performative |
| The Executioner | male | Yorkshire (Northern England) | `2dfo5fQCgWY69lVots4f` | blunt, thickset, plain-spoken — matches "pure impulse," not a mannered villain accent |
| The Corruptor | female | Welsh (the Valleys) | `hxzH26Qlf6Fdq84amqsF` | warm, musical, coaxing — lends itself to sweetness with a cruel undertow |
| The Mourner | male | West Country (South-West England) | `dPyI4HRWWEPjB0DhyNGC` | soft, unhurried, gently mournful — avoids anything clipped or brisk |
| The Prophet | female | Irish | `xsfZ7ocXo03RqHrZb4Qt` | lilting, sing-song rhythm gives the erratic/chaotic delivery somewhere to go without sounding like shouting |

Deliberately varied across five different regional flavours (Scottish,
Northern English, Welsh, West Country, Irish) rather than repeating one,
per the brief. None is cut-glass RP.

## Model and per-persona settings

- Model: `eleven_multilingual_v2` for every one of the 25 final lines.
- `voice_settings` were tuned per persona (`stability`/`style` trade calm
  control against volatility; `speed` slows the more mournful/seductive
  deliveries and quickens the more impulsive ones):

| persona | stability | style | speed |
|---|---|---|---|
| architect | 0.70 | 0.10 | 0.95 |
| executioner | 0.30 | 0.60 | 1.05 |
| corruptor | 0.50 | 0.40 | 0.92 |
| mourner | 0.60 | 0.30 | 0.85 |
| prophet | 0.20 | 0.80 | 1.00 |

`similarity_boost: 0.75` and `use_speaker_boost: true` for all five
(ElevenLabs defaults for a generated voice).

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
