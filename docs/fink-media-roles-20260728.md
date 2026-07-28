# FINK media roles — short authoring form ↔ render-hint spec

A story beat may have one **central media item**. Its *role* sets how much
of the screen it gets — a spectrum from "the media IS the beat" to "a
decorative accent." Owner direction (2026-07-28): *"Sometimes… we want the
whole experience very media. Other times the media is decorative, less
core."*

## The three roles

| role | screen | prose | for |
|---|---|---|---|
| `hero` | media owns the frame | a caption overlaid at the bottom | full-media beats — e.g. the parody videos |
| `feature` **(default)** | media pinned across the top (~62vh) | scrolls below the media | normal illustrated beats |
| `accent` | small thumbnail, top-right corner | text leads, full width | decorative media |

`accent` media is tappable — a tap blows it up to `hero`, a second tap
restores it.

## Authoring: the SHORT form

The role is an optional keyword after the existing media tag. Nothing
changes for stories that don't use it (they get `feature`):

    # IMAGE: dock.jpg              → feature (default)
    # VIDEO: <11-char-id> hero     → hero (YouTube id → nocookie embed)
    # IMAGE: coin.svg accent       → accent

A bare 11-character `# VIDEO:` value is treated as a YouTube id and embedded
via `youtube-nocookie.com`; anything else is a local `<video>`/`<img>`
source, resolved inside the runner's frame.

## The MAPPING (kept in sync with the render-hint scheme)

The short form is the author's surface; internally each role maps to a
render-hint spec token, so the media-role scheme and the paged-beats
render-hint scheme (`# FINK RENDERHINT X-PAGED-BEATS`, parked-work thread)
share one namespace and do not drift:

| short form | render-hint spec |
|---|---|
| `hero` | `X-MEDIA-HERO` |
| `feature` | `X-MEDIA-FEATURE` |
| `accent` | `X-MEDIA-ACCENT` |

The boxed runner exposes the resolved spec at
`window.__storyrunner.state.mediaSpec` (and the short role at `.mediaRole`).
`MEDIA_ROLES` in `inklet/apps/storyrunner/storyrunner.js` is the one place
the mapping lives; the CSS keys off the short role
(`#stage[data-media-role="hero"]` …). Locked by `e2e-storyrunner.mjs`,
which asserts each role's layout AND its spec token.

## Where this runs

Only the **boxed** runner (`inklet/apps/storyrunner/`, spec §5.7 / the
sandbox threat model). Media renders in the runner's own opaque-origin
frame — contained, like everything else it does. The live host-side player
has its own, older media path and is untouched.
