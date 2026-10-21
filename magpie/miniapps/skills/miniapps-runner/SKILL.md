---
name: miniapps-runner
description: Work on magpie/miniapps, the runner for W3C MiniApp packages (.ma ZIP files with manifest.json, app.js, app.css, pages/) under the foafos capability tree. Covers the status of the W3C drafts (Discontinued Drafts and retired Notes since August 2026, never Recommendations), the module map (addressing, manifest, zip, package, lifecycle, host, guest), the frame protocol (app.hello/app.init plus miniapp.* messages), how req_permissions map to foafos capabilities through AppTree attenuation, how to pack a package and update registry.json, the two test commands, and two traps found by the browser test (rAF does not run in an offscreen cross-origin frame; CSS display overrides the hidden attribute). Use when changing anything in magpie/miniapps, adding a MiniApp package or host API, wiring MiniApps into foafos-shell.js, or porting the pure layer to Rust/wasm or Lean.
---

# miniapps-runner

The design record is `magpie/miniapps/README.md`. Read it first: it has the W3C
status table, the foafos comparison, the protocol, and the list of choices made
where the drafts contradict themselves. This file holds only the working rules.

## Status of the source documents

The MiniApp Manifest, Packaging and Lifecycle documents are W3C Discontinued Drafts
(2026-08-11). MiniApp Addressing is a retired Group Note. The MiniApps WG closed on
2026-08-26. Do not call them Recommendations. Cite the TR URLs in the README.

## Commands

    node magpie/miniapps/tools/pack.mjs magpie/miniapps/samples/hello   # writes dist/<id>-<ver>.ma, updates registry.json
    node --test magpie/miniapps/test/unit.mjs                            # 13 tests, no browser
    python3 -m http.server 8765 &                                        # repo root
    node magpie/miniapps/test/browser.mjs                                # 25 checks, headless Chromium

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
