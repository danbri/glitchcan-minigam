# foafos alpha1

July 2026. What exists, what is verified, and what is not.

Start at **`inklet/foafos.html`** — four installations of one shell.

## What alpha1 is

A browser shell that runs mutually distrustful apps, where an
*installation* is a data file rather than a fork.

| root | boots | root capabilities |
|---|---|---|
| `?root=` *(default)* | the story TOC | storage · vars · audio · input · launch · navigate · chrome · same-origin |
| `?root=office` | edot | storage · same-origin |
| `?root=webtv` | Channels | storage · audio · input |
| `?root=tellyclub` | Tellyclub | audio |

Everything beneath a root is bounded by it: **`grant(child) ⊆ grant(parent)`**.
That single rule is what makes it safe to let an app open another app, and
what makes trimming a manifest a real lockdown rather than icon-hiding. The
webtv root holds no `same-origin`, so nothing it opens can be granted it —
verified in the running page, not just asserted in data.

## Demo content

- **Story** — Glitch Canary: Hampstead, Riverbend, the TOC, the dream stack.
- **Office** — edot: word processor, Data (spreadsheet/SQL/RDF), Calendar, Files.
- **Games** — robbin, gridluck, mudslider, boidwars, chess, gems. All seven
  respond to input under measurement, not just boot.
- **Media** — Channels (the tape library as stations), ROBBAMP, and
  **Tellyclub**, danbri's Archive.org TV browser from
  [isle_of_glitch](https://github.com/danbri/isle_of_glitch), referenced at
  its deployed URL.

Tellyclub is the most interesting integration precisely because it knows
nothing about foafos: no SDK, opaque origin, `localStorage` throws — and it
survives, because its author wrapped every storage call in try/catch.
Adaptation from the guest side.

## Shell surfaces

- **Picker** (`Alt+H`) — only what the installation offers.
- **Switcher** (`Alt+Tab`) — the app **tree**, indented. A game opened by a
  story sits beneath it; ⏸ and ✕ act on the subtree and name what they take
  ("and 1 beneath it").
- **Window manager** — full / split / pip, one geometry owner, pane labels
  that say which half the toolbar governs.
- **Suspension** — subtree-wide, and it actually reaches guests.
- **Logger** — the bus, filterable, refusals coloured.
- **Volume** — one master level, plus an honest list of what it *cannot* reach.
- **Input** — one d-pad for the whole shell; keyboard, touch and gamepad
  normalised. Konami verified on all four controllers.

## Verified

Run: `npm run test:fink:e2e`, `npm run test:fink:qa`,
`node --test packages/foafos/test/*.test.js`.

- 27 unit tests (bus, session crypto, widgets, vars, audio, input, store, app tree).
- 14 browser suites, including:
  - `e2e-caps` — the boundary tested **by trying to cross it**: inside a
    de-privileged app, `parent.document`, `parent.FoafOS` and `localStorage`
    all throw `SecurityError`. Also drives Calendar through a real
    round-trip (calendar + event, Dates rehydrated) with no ambient
    authority at all.
  - `e2e-root` — office boots with **zero stories compiled**; attenuation
    refuses in the live page; close cascades to a real guest teardown.
  - `e2e-input` — Konami once per controller.
  - `qa-journey` — 21 steps × 3 viewports, invariants re-checked after every
    step, **0 findings**, with a self-test proving the audit can still see
    planted faults.
- `packages/foafos@0.2.0` packs clean; its own `npm test` runs all ten suites.

## Not verified, and why

- **Tellyclub's content.** This environment gives the headless browser no
  egress (`net::ERR_ABORTED`), so only the integration is proven: it
  registers, opens, gets the right sandbox, sits correctly in the tree.
- **WebGPU** anything. Unavailable headless.
- **Performance feel.** SwiftShader answers *does it work*, never *is it good*.

## Missing, plainly

1. **Four apps still hold `same-origin`** — edot, Data, Files, ROBBAMP.
   **Calendar is migrated** (July 2026) and is the proof the path works on a
   storage-heavy app: it used IndexedDB, which an opaque origin refuses
   outright, so its store gained a brokered key/value fallback chosen only
   when IDB will not open. Standalone it keeps its indexes and cursor
   deletes; under foafos it runs de-privileged and the shell holds its
   bytes. The drawer names whoever is left; the count should reach zero.
2. **No snapshot/restore contract.** Close a game and it is gone. This also
   blocks moving the narrative runtime into a frame, because the dream stack
   works only *because* the story runs in the host page.
3. **Stories outrank apps.** The runtime is the host page, so a story can
   launch, navigate and restyle. Its capability list describes rather than
   constrains — flagged `enforced: false` and disclosed in the drawer. Gating
   it matters because the Finkiverse links to documents we did not write.
4. **Composition lives in the shell**, not the library. `# FINK:` replaces
   everything because inkjs cannot compose two stories; that belongs in
   `gcfink.compose()`.
5. **The block manifest** (multi-block `.fink.js` with on-demand payload) is
   deliberately deferred — FINK stays one function, one argument for now.

Roadmap and reasoning: `docs/foafos-root-and-app-tree-20260726.md`.
