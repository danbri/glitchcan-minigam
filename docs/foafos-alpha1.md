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
- **Chrome** — the breadcrumb, the story status line and the FINK load
  meter are apps (`surface: 'chrome'`), offered per root manifest. An
  office installation does not hide them, it does not *have* them: no
  element, no tab stop, nothing in the accessibility tree. On a story root
  they are toggles in the picker, and they sit in the switcher under
  "+ N chrome" so furniture is not counted as work.
- **Switcher** (`Alt+Tab`) — the app **tree**, indented. A game opened by a
  story sits beneath it; ⏸ and ✕ act on the subtree and name what they take
  ("and 1 beneath it").
- **Window manager** — full / split / pip, one geometry owner, pane labels
  that say which half the toolbar governs.
- **Suspension** — subtree-wide, and it actually reaches guests.
- **Closing** — the shell asks the guest for a snapshot on the way out,
  stores it, and hands it back next time, reload or no reload. It cannot
  serialise an opaque origin itself, so this only works for guests that
  agreed to the contract — and the switcher says which is which (*keeps its
  place* / *closing loses it*) **before** the ✕ is pressed.
- **Logger** — the bus, filterable, refusals coloured.
- **Volume** — one master level, plus an honest list of what it *cannot* reach.
- **Input** — one d-pad for the whole shell; keyboard, touch and gamepad
  normalised. Konami verified on all four controllers.

## Verified

Run: `npm run test:fink:e2e`, `npm run test:fink:qa`,
`node --test packages/foafos/test/*.test.js`.

- 27 unit tests (bus, session crypto, widgets, vars, audio, input, store, app tree).
- 16 browser suites, including:
  - `e2e-chrome` — chrome is absent on office (asserted on
    `getElementById`, never on computed style), toggles cleanly on a story
    root, and survives the round trip wired. It also pins the bug the work
    exposed: `shell` was a capability **no root held**, so Maker and Logger
    could never be launched from the picker — the drawer called
    `openLogger()` directly and hid it for as long as the tile existed.
  - `e2e-snapshot` — state compared *through* a close, in two unrelated
    games, plus the disclosure and the guarantee that a silent guest cannot
    hang the close. Written this way because the first cut of the feature
    had a working-looking code path that captured nothing: the frame was
    destroyed in the same tick the question was asked.
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
2. **Only two games speak `snapshot`.** The contract exists now (July
   2026): closing a game keeps its place, through a reload, because the
   shell writes it to FoafStore. Mudslider comes back in the same room
   with the same score and lives; chess with the same position and side
   to move; finishing a game clears its save so a fresh run is still
   possible. But GridLuck, boidwars and robbin do not implement it — they
   are reported honestly rather than adopted, and the count should rise.
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
