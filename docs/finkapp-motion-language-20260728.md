# finkapp motion & light language

2026-07-28. Owner direction: "every frame a painting" — compositor use,
colour and lighting, sculpted shapes, readable direction and speed, and
the classic animation principles. This file is the contract; the tokens
live in `fink-theme.css`, the treatments in `fink-player.css`, the
sampling in `fink-ui.js`.

## The system

- **Two curves, three durations.** `--ease-out-soft` for things that
  ARRIVE (slow-out); `--ease-settle` (small overshoot) for things that
  need follow-through. `--dur-fast/base/slow` = 140/300/480ms. Nothing
  invents its own timing.
- **Compositor rule.** Entrances animate `transform` and `opacity` only.
  The old blur() keyframes repainted every frame and smeared the type;
  they are gone.
- **One light source.** Upper-left, app-wide: every shadow is a soft
  drop down-right plus a hairline top-inset highlight. Agreeing shadows
  are most of what "solid" means for flat UI.
- **Ambient light from the artwork.** On decode, the scene image is
  averaged to one colour (`--scene-ambient`); the card's border and glow
  take the painting's own light. Golden scene, warm frame; night scene,
  cold frame. Tainted cross-origin images gracefully keep the skin line.
- **The painting breathes.** The live scene image drifts scale
  1→1.045 over 28s, alternating — beneath "animation", above "static".
  A radial matte softens the plate's edges into the card. The past
  stands still; only the present is alive.
- **Direction is information.** Paging back enters from the left,
  forward from the right; a new beat rises from below, and its choices
  rise to meet the reader's descending eye.

## Scope (owner correction, 2026-07-28)

The classic animation principles are for the MINIGAMES — things that
are alive and move, like Waterworld's fauna (`magpie/waterworld/js/
fauna.js`: arcs via bounded-rate headings, banking into turns,
speed-coupled squash & stretch, shark wind-up anticipation, breach-spray
secondary action, weight through tail tempo). The story player's
interface keeps only the restraint subset below — calm arrivals, one
light source, no exaggeration. UI is furniture; fauna is cast.

## The principles, mapped

| principle | where it lives |
|---|---|
| Squash & stretch | choice press: `translateY(1px) scale(.985)` — the button gives |
| Anticipation | choice stagger: content lands first, options deal in after |
| Staging | one entrance per beat (`sceneEnter`); text and choices play inside it |
| Follow-through | `--ease-settle`: choices rise 2px past, then settle |
| Slow in / slow out | `--ease-out-soft` on every arrival |
| Arcs | the ▾ more-hint's finite nudge; drift's ease-in-out breathing |
| Secondary action | the scene drift under the prose |
| Timing | 70ms choice stagger — one gesture, not a queue; 3 durations total |
| Exaggeration | deliberately almost none: restraint IS the taste here |
| Appeal / solid drawing | one light source; matte-edged plates; measure-width columns |

## Rules for future work

- New animation → use the tokens. A bespoke curve needs a reason
  written next to it.
- Respect `prefers-reduced-motion`: content appears, nothing travels,
  the drift and matte switch off.
- Never animate filter/box-shadow/layout properties on entrances.
- The evaluator loop: screenshot the frames headless, put them in front
  of a critic (agent or human) with this file as the rubric, fix the top
  findings, re-shoot. Taste is a loop, not a setting.
