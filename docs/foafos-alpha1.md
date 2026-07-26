# foafos alpha1

July 2026. What exists, what is verified, and what is not.

Start at **`inklet/foafos.html`** — four installations of one shell.

## What alpha1 is

A browser shell that runs mutually distrustful apps, where an
*installation* is a data file rather than a fork.

| root | boots | root capabilities |
|---|---|---|
| `?root=` *(default)* | the story TOC | storage · secrets · vars · audio · input · launch · navigate · chrome · shell · git:write · same-origin |
| `?root=office` | edot | storage · secrets · shell · git:write — **no escape hatch at all** |
| `?root=webtv` | Glitchcan Original Soundtrack | storage · audio · input |
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
- **Media** — the Glitchcan Original Soundtrack (the tape library as
  stations; app id still `channels`), ROBBAMP, and
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
- **Secrets** — a broker for credentials, separate from storage: an app may
  hand one over, list its own by name, and ask the shell to *use* one. There
  is no way to read one back, in the SDK or over postMessage. Measured
  first: edot's "stay signed in" had been writing a bearer token to the
  shell's disk in plaintext, because reading back what you wrote is what a
  storage broker is *for*. `docs/foafos-secrets-and-auth-20260726.md`.
  The drawer's passphrase now seals **secrets as well as the session** — one
  prompt, not two — and the status line distinguishes *you have no key* from
  *your key is sealed here and nobody has unlocked it*, because sending
  someone off to mint a token they already have is its own kind of bug.
  FORGET takes the credentials with it.
- **Brokered actions** — what "use a secret" actually means. `foaf.invoke(
  'git.commit', { path, content, message })`: the app names an outcome, the
  shell performs it with a credential the app cannot see. Note what the app
  does *not* send — a function (that would be `get` with extra steps) and a
  repo. **The scope supplies the destination, the app supplies the data**,
  because an op taking its host from the caller would be a
  signed-request-to-anywhere primitive with a live token attached. Three ops
  ship (`git.commit`, `s3.put`, `solid.put`); one has a caller
  (`BrokeredGitSource`, a repo mount with no token in it).
- **Publishing** (Apps → Make → 🔑) — where a verb is aimed and where its key
  is typed. Both belong to the shell, and that is the design rather than a
  convenience: a token the *app* collects is a token the app has held, however
  briefly. Here it never touches the guest at all, not even on the way in.
- **Logger** — the bus, filterable, refusals coloured.
- **Volume** — one master level, plus an honest list of what it *cannot* reach.
- **Input** — one d-pad for the whole shell; keyboard, touch and gamepad
  normalised. Konami verified on all four controllers.

## Verified

Run: `npm run test:fink:e2e`, `npm run test:fink:qa`,
`node --test packages/foafos/test/*.test.js`.

- **13 unit suites** in `packages/foafos` (bus, session crypto, widgets, vars,
  audio, input, cluster, guest scope, store, app tree, secrets, ops, SigV4 —
  the last against AWS's published test vector, because for signing code "it
  looks like the spec" is not a standard).
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
    all throw `SecurityError`. Also proves **secrets cannot be read back**
    from inside a real app — refused in the SDK and again by the shell —
    while the shell can still *use* the value, and the token appears in
    neither the store, nor on disk, nor in the audit. Then the verb side: a
    **sandboxed app commits a file it has no credential for**, and every one
    of the four real HTTP requests (intercepted, so the shell's own `fetch`
    runs) went to the *granted* repo on the *granted* branch — despite the app
    asking for `attacker/loot` on `gh-pages`. An unaimed verb is refused and
    not even listed; a saved destination does not resurrect a capability the
    tree denied. Drives **Calendar** through a real
    round-trip (calendar + event, Dates rehydrated) and **Files** through a
    write that lands in the listing and reaches the broker — both with no
    ambient authority at all.
  - `e2e-root` — office boots with **zero stories compiled**; attenuation
    refuses in the live page; close cascades to a real guest teardown.
  - `e2e-input` — Konami once per controller.
  - `qa-journey` — 21 steps × 3 viewports, invariants re-checked after every
    step, **0 findings**, with a self-test proving the audit can still see
    planted faults.
- `packages/foafos@0.2.0` packs clean; its own `npm test` runs all thirteen suites.

## Not verified, and why

- **Tellyclub's content.** This environment gives the headless browser no
  egress (`net::ERR_ABORTED`), so only the integration is proven: it
  registers, opens, gets the right sandbox, sits correctly in the tree.
- **WebGPU** anything. Unavailable headless.
- **Performance feel.** SwiftShader answers *does it work*, never *is it good*.

## Missing, plainly

1. **One app still holds `same-origin`** — ROBBAMP. Four are migrated,
   each hitting a different wall:
   - **Calendar** used IndexedDB, which an opaque origin refuses outright,
     so its store gained a brokered key/value fallback chosen only when IDB
     will not open. Standalone it keeps its indexes and cursor deletes.
   - **Files** stored nothing of its own — it held the hatch for **OPFS**,
     which needs an origin to hang a storage bucket on and is refused in a
     sandboxed frame. Its fallback is therefore a whole `ResourceSource`
     (`BrokeredResourceSource`), same list/read/write/remove/stat/mkdir
     interface over the shell's store. Migrating it also revealed the app
     had **never loaded inside the shell**: the registry pointed at a
     directory with no `index.html`.
   - **edot** itself needed nothing but somewhere to land. Its hatch was
     cargo cult: no iframes to reach into, every `localStorage` call
     already try-wrapped, and `Library.create()` already tried IndexedDB
     and fell back to a `localStorage` backend. Loading app-sdk first gave
     that fallback the broker, and the shell now holds the document
     library.
   - **Data** keeps a whole SQLite file, in IndexedDB, refused the same
     way Calendar's was. Its engine now picks a backend by trying and
     falls back to the same blob base64'd through the broker, reports
     which one is live, and *announces* a refused write instead of
     swallowing it — this is the app where a silent autosave failure costs
     the most. It is also why FoafStore grew **per-app quotas**: an
     almost-empty SQLite database is already ~43KB encoded against a 256KB
     default, and raising that default for everybody would dissolve the
     limit for exactly the apps it exists to bound.
   The drawer names whoever is left; the count should reach zero.
2. **Only two games speak `snapshot`.** The contract exists now (July
   2026): closing a game keeps its place, through a reload, because the
   shell writes it to FoafStore. Mudslider comes back in the same room
   with the same score and lives; chess with the same position and side
   to move; finishing a game clears its save so a fresh run is still
   possible. But GridLuck, boidwars and robbin do not implement it — they
   are reported honestly rather than adopted, and the count should rise.
3. **Solid is bearer-token only, not DPoP**, and `s3.put`/`solid.put` have
   no callers, so no app declares those capabilities. There is no
   `git.delete` verb either, so `BrokeredGitSource.remove` clears the local
   mirror and says the repo copy remains rather than looking like it worked.
4. **Stories outrank apps.** The runtime is the host page, so a story can
   launch, navigate and restyle. Its capability list describes rather than
   constrains — flagged `enforced: false` and disclosed in the drawer. Gating
   it matters because the Finkiverse links to documents we did not write.
5. **Composition lives in the shell**, not the library. `# FINK:` replaces
   everything because inkjs cannot compose two stories; that belongs in
   `gcfink.compose()`.
6. **The block manifest** (multi-block `.fink.js` with on-demand payload) is
   deliberately deferred — FINK stays one function, one argument for now.

Roadmap and reasoning: `docs/foafos-root-and-app-tree-20260726.md`.
