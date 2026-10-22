---
name: miniapps-runner
description: Work on magpie/miniapps, the runner for W3C MiniApp packages (.ma ZIP files with manifest.json, app.js, app.css, pages/) under the foafos capability tree. Covers the status of the W3C drafts (Discontinued Drafts and retired Notes since August 2026, never Recommendations), the module map (addressing, manifest, zip, package, lifecycle, host, guest), the frame protocol (app.hello/app.init plus miniapp.* messages), how req_permissions map to foafos capabilities through AppTree attenuation, how to pack a package and update registry.json, the two test commands, and two traps found by the browser test (rAF does not run in an offscreen cross-origin frame; CSS display overrides the hidden attribute). Use when changing anything in magpie/miniapps, adding a MiniApp package or host API, wiring MiniApps into foafos-shell.js, or porting the pure layer to Rust/wasm or Lean.
---

# miniapps-runner

The design record is `magpie/miniapps/README.md`. Read it first: it has the W3C
status table, the foafos comparison, the protocol, and the list of choices made
where the drafts contradict themselves. This file holds only the working rules.

## Where MiniApps belong (owner correction, 2026-10-22)

foafos is the app and widget platform and the only mediator. The FINK story runner is one
foafos app; it contains MiniApps (as FINK add-ons) and sub-stories, and those add-ons are
nodes in the foafos app tree. A MiniApp never contains foafos apps. The `samples/suite`
experiment did exactly that and is kept only as a record (README, "Correction"). Before
designing anything here, read `docs/foafos-story-layering-20260730.md`, sections "The
layers" and "Owner statement, 2026-10-22" (instances, singleton service apps, haptics).

## Status of the source documents

The MiniApp Manifest, Packaging and Lifecycle documents are W3C Discontinued Drafts
(2026-08-11). MiniApp Addressing is a retired Group Note. The MiniApps WG closed on
2026-08-26. Do not call them Recommendations. Cite the TR URLs in the README.

## Commands

    node magpie/miniapps/tools/pack.mjs magpie/miniapps/samples/hello   # writes dist/<id>-<ver>.ma, updates registry.json
    cd magpie/miniapps && npm install                                    # axe-core
    node --test test/unit.mjs                                            # 13 tests, no browser
    node test/serve.mjs 8765 &                                           # like Pages: CORS, /glitchcan-minigam/ prefix
    node test/browser.mjs                                                # 24 checks, hello package
    node test/ux.mjs                                                     # 70 checks, the suite; own server
    RUNNER=https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html node test/ux.mjs   # live site

Re-pack after you change a sample, and commit the `.ma` file: GitHub Pages has no
build step. `pack.mjs` runs `openPackage` on its own output, so a package that it
writes is one the runner opens.

## Rules

- `src/addressing.mjs`, `manifest.mjs`, `zip.mjs`, `package.mjs` and `lifecycle.mjs`
  have no DOM. Keep them that way: they are the layer to port to Rust/wasm and Lean.
- Every host API is in `API_CAPS` in `src/host.mjs` with the capability it needs. The
  check runs on each call (`AppTree.can`), not only at launch.
- A new permission name needs a row in `PERMISSION_MAP`. An unmapped name is refused.
  It is not granted silently.
- Both frames are `sandbox="allow-scripts"`, so their origin is opaque. Do not add
  `allow-same-origin`. Do not run app code in a Worker made from a blob in the host:
  it would get the host's origin.

## Pages that are foafos apps

A package page with a `<script type="application/json" id="foafos-app">` block is an
existing foafos app (story runner, edot, Sheets, Files) or, with `"protocol": "minigame"`,
a FINK minigame. `src/foafos-guests.mjs` answers their protocols as `foafos-shell.js` and
`fink-minigames.js` do; `src/host.mjs` gives each one a child node in the AppTree. The
README section "Pages that are foafos apps" has the fields; the usability and
accessibility table is beside it. Rules:

- A new usability claim needs a check in `test/ux.mjs`, and the axe scans stay at 0
  violations for the chrome and the package pages.
- Do not use `python3 -m http.server` for these tests: it sends no CORS header, so module
  scripts in the opaque-origin frames do not run and the guest shows only static HTML. It
  also serves the repo at `/`, while stories use absolute `/glitchcan-minigam/...` paths.
  Use `test/serve.mjs`.
- foafos apps share `FoafStore` namespaces (`edot`, `files`, `sheets`) with the shell on
  the same origin. That is on purpose: the same documents in both.

## LWS over XMPP (magpie/miniapps/lws/)

The home pod (`lws/pod.mjs`) serves one Factoidal LWS storage over HTTP and over
XEP-0332. The browser side is `src/xmpp-ws.mjs` (RFC 7395) and `src/lws-store.mjs`
(the FoafStore backend). The answers and measurements are in `lws/README.md`.

    apt-get install -y prosody
    cd magpie/miniapps/lws && npm install && node test/run.mjs     # 15 checks

Rules: keep LWS semantics out of the XMPP layer (the request and answer are the
same bytes as over HTTP), and keep resource IRIs `https://`.

## Traps (each one cost a failed test run on 2026-10-21)

1. Chromium does not run `requestAnimationFrame` in a cross-origin frame that is
   offscreen. The runner log used `scrollIntoView`, which scrolled the page, and every
   page then stayed at `loaded`. `guest.js` now sends `miniapp.rendered` from a 250 ms
   timer if two animation frames have not come. Do not scroll the host page from code.
2. Author CSS `display: grid` overrides the `hidden` attribute. The "App unloaded"
   overlay took every tap while hidden. `index.html` has `[hidden] { display: none !important; }`.
3. `python3 -m http.server` serves `.ma` as `application/mathematica`, and GitHub
   Pages does not serve `application/miniapp-pkg+zip`. The runner opens packages with
   `strictMediaType: false` and shows the media type as a warning.
4. `@xmpp/client` 0.13.2 sends an EMPTY SCRAM-SHA-1 `<response/>` under Node 22, and
   Prosody answers `malformed-request`. Use 0.14.0 (pinned in `lws/package.json`).
5. Over RFC 7395 each WebSocket frame is a standalone document: every stanza the
   browser sends needs `xmlns="jabber:client"`. Without it Prosody closes the stream
   with `unsupported-stanza-type` straight after SASL succeeds.
6. A crashed test leaves Prosody holding ports 15222/15280. The next run's Prosody
   cannot bind, and the browser talks to the stale one. `test/run.mjs` kills its
   Prosody on exit and on any uncaught error; if a run still dies, `pgrep -af prosody`.
7. A page that takes the focus when it is first shown breaks keyboard order: the first Tab
   moves inside the app and Enter activates its first link (2026-10-22, the launcher
   opened a story). Only pages after a navigation take the focus (`detail.focus`).
8. After a modal `<dialog>` closes, Chromium leaves the sequential-focus start point in the
   dialog, so Tab does not go to the top of the page. Move the focus yourself.
9. The story runner ignores `--sk-size` (its prose is `clamp(15px, 4vw, 19px)`). Text size
   reaches it only through zoom on its frame.
10. `test/browser.mjs` has 24 checks; the README said 25 for a day. Count `check(` in the
   file, not lines of output by eye.
