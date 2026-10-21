# miniapps: a W3C MiniApp package runner for foafos

Live runner: https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html

This folder tests one question. Can the W3C MiniApp specifications supply the app
model that the foafos shell lacks: a declared manifest, a package, a lifecycle and an
address? The code is JavaScript for now. If the model holds, it will be written again in
Lean 4, as part of Factoidal or beside it.

## 1. The W3C MiniApps work

### Status (checked 2026-10-21)

No MiniApp specification became a W3C Recommendation. The MiniApps Working Group closed
on 26 August 2026. On 11 August 2026 it published its documents for the last time, with
these statuses:

| Document | Final status (2026-08-11) | URL |
|---|---|---|
| MiniApp Manifest | Discontinued Draft | https://www.w3.org/TR/miniapp-manifest/ |
| MiniApp Packaging | Discontinued Draft | https://www.w3.org/TR/miniapp-packaging/ |
| MiniApp Lifecycle | Discontinued Draft | https://www.w3.org/TR/miniapp-lifecycle/ |
| MiniApp Addressing | Group Note (retired from the Note track) | https://www.w3.org/TR/miniapp-addressing/ |
| MiniApp Standardization White Paper v2 | Group Note (retired) | https://www.w3.org/TR/mini-app-white-paper/ |
| MiniApp Widget Requirements | Retired | https://www.w3.org/TR/miniapp-widget-req/ |

A Discontinued Draft "is no longer intended to advance or to be maintained". The group's
repositories (for example https://github.com/w3c/miniapp-packaging) are archived. They
send further discussion to the WebView Community Group
(https://www.w3.org/community/webview/). The group page
(https://www.w3.org/groups/wg/miniapps/) gives no reason for the closure. The last charter
(https://www.w3.org/2023/10/miniapps-wg-charter.html) planned Recommendations for
Manifest, Packaging, Lifecycle and Addressing in Q4 2024. None of them reached Candidate
Recommendation. The publication histories (https://www.w3.org/standards/history/miniapp-manifest/
and the same path for `miniapp-packaging` and `miniapp-lifecycle`) list only Working Drafts. The last
Working Drafts are Manifest and Packaging on 28 January 2025, and Lifecycle on 29 May 2023.

So this folder implements abandoned drafts, not Recommendations. Each draft is a
complete, citable description of one layer, and nothing else in W3C covers the same
ground. For a runner that we will rewrite in Lean, a frozen text is a stable target.

### Where it came from

MiniApps ("mini programs", 小程序) are small apps that run inside a host "super app" and
need no install. The White Paper (https://www.w3.org/TR/mini-app-white-paper/) gives these
platforms as its examples:

- Alipay Mini Programs: more than 1 million mini programs, 230 million daily active users.
- Baidu Smart Mini Programs: more than 150,000 programs, 270 million monthly active users
  (July 2019).
- Quick Apps: from the Quick App Alliance of 12 phone makers, including Xiaomi and Huawei,
  with more than 200 million monthly active users. Quick Apps run from the operating
  system, not from a super app.

WeChat Mini Programs (launched January 2017) started the format. The vendors built
similar but incompatible platforms: each had its own manifest, file layout, template
language and API object (`wx.*`, `my.*`, `swan.*`). The W3C work started in the W3C
Chinese Web Interest Group, which published the first MiniApp Standardization White Paper
in September 2019. The MiniApps Ecosystem Community Group started the same month
(https://www.w3.org/community/miniapps/2019/09/19/call-for-participation-in-miniapps-ecosystem-community-group),
and the work became a Working Group in January 2021
(https://www.w3.org/blog/2021/01/w3c-launches-the-miniapps-working-group). The chairs came
from Huawei, Alibaba and Baidu. The aim was a common base layer (manifest, package,
lifecycle, URI) that every vendor could read, so a developer could ship one package to
many hosts. UI components and vendor APIs stayed out of scope.

### The architecture the drafts assume

- A package is a ZIP file (`application/miniapp-pkg+zip`, usually `.ma`). It holds
  `manifest.json`, `app.js`, `app.css`, `pages/`, and optionally `common/` and `i18n/`.
- The logic layer (app.js; "JavaScript Workers" in the White Paper) is separate from the
  view layer (the rendered pages). Messages pass between the two layers through a bridge,
  and native capabilities are reached through the same bridge.
- The app lifecycle is `launched → shown ↔ hidden → unloaded`, plus `error`. Each page has
  a lifecycle `loaded → ready → shown ↔ hidden → unloaded`.
- An app is addressed as `platform://miniapp/<id>;version=<v>/<page path>?<query>#<fragment>`
  or `https://<host>/miniapp/<id>…`. The user agent finds the package locally or asks a
  package server for it with `id` and `version`.
- `req_permissions` in the manifest lists what the app asks for. The host decides what it
  grants.

PWAs and this model differ in one major way. A PWA is a set of URLs, and its powers come
from its web origin. A MiniApp is a closed package, and its powers come from its host.
The second model is the foafos model.

## 2. foafos today, compared with the drafts

foafos is the shell around the FINK story runner. Its parts are in `packages/foafos/` and
`inklet/finkapp/`, and its design is in `docs/foafos-story-layering-20260730.md`. This
table compares it with the drafts:

| Concern | foafos today | MiniApp drafts | This runner |
|---|---|---|---|
| App description | A JS row in `APPS` ([foafos-apps.js](../../inklet/finkapp/foafos-apps.js)): `id`, `name`, `icon` (emoji), `url`, `surface`, `capabilities`, `bus`, `variables`, `args`. Stage games also have `inklet/minigames/<game>/manifest.json`. | `manifest.json` with `app_id`, `name`, `version{code,name}`, `icons`, `pages`, `window`, `req_permissions`, `platform_version`, `lang`, `dir`, `color_scheme`, `device_type`, `widgets` | [src/manifest.mjs](src/manifest.mjs) |
| Package | None: an app is a URL. No integrity check. Cross-origin is refused under "policy v0". | ZIP with constraints, an optional signing block | [src/zip.mjs](src/zip.mjs), [src/package.mjs](src/package.mjs) |
| Isolation | `sandbox="allow-scripts allow-forms allow-modals"`, so the origin is opaque. Handshake: `app.hello` → `app.init`. | Logic and view layers, a JS bridge (not specified in detail) | A hidden logic frame and one view frame per page, both `sandbox="allow-scripts"` |
| Lifecycle | `launchApp`, `app.suspend`/`app.resume`, snapshot on close. No event on minimise or focus. `app.grant` and `app.terminate` exist in app-sdk.js but nothing sends them. | Global: launched, shown, hidden, error, unloaded. Page: loaded, ready, shown, hidden, unloaded. | [src/lifecycle.mjs](src/lifecycle.mjs), driven by [src/host.mjs](src/host.mjs) |
| Pages | None: one URL per app | `pages` list, the first is the entry, a page stack | A page stack (at most 10), navigateTo, redirectTo, navigateBack |
| Permissions | Static grants in the registry row. `AppTree.spawn` enforces grant(child) ⊆ grant(parent). Brokers check at the time of use. | `req_permissions` is a request. The draft names no permission vocabulary. | `req_permissions` is mapped to foafos capabilities and spawned under the same `AppTree` |
| Addressing | `?story=`, `?app=`, FinkLinks hash `#<8hex>-<9hex>` | MiniApp URI with id, version, path, query, fragment | [src/addressing.mjs](src/addressing.mjs), scheme `foafos://`, carried in `?uri=` |
| Storage | `FoafStore`, namespace `foafos.store.<appId>`, 256 KB quota | Not specified | The same `FoafStore`, namespace `miniapp.<app_id>` |
| Localisation | Not per app | `lang`, `dir`, `i18n/<BCP47>.json` | Locale negotiation and `miniapp.t(key)` |

The drafts fill the gaps in foafos: a manifest, a package, a page model, and lifecycle
events for hide and show. foafos fills the gaps in the drafts: capability attenuation, a
permission broker at the time of use, the bus, and a stated security model. The runner
uses both.

## 3. What is built

```
index.html, runner.mjs   the runner page: URI → registry → package → host
registry.json            the static "package server" (id → versions → .ma file)
src/addressing.mjs       MiniApp URI parse and format (Addressing §4)
src/manifest.mjs         manifest processing (Manifest §1.7), defaults, warnings
src/zip.mjs              ZIP read and write with the Packaging §3 constraints; signing-block detection
src/package.mjs          the seven processing steps (Packaging §5)
src/lifecycle.mjs        Global and Page state machines (Lifecycle)
src/host.mjs             MiniAppHost: frames, page stack, lifecycle, APIs, AppTree/FoafStore/FoafBus
src/guest.js             the bootstrap that the host puts into each frame (the `miniapp` object)
samples/hello/           a sample package source (en-US and zh-CN)
dist/*.ma                packed packages (committed, because Pages has no build step)
tools/pack.mjs           pack a folder, check it with openPackage, update registry.json
test/unit.mjs            Node tests (13)
test/browser.mjs         headless Chromium test of the runner (25 checks)
```

### Deep links

- https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html opens the sample app.
- https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html?lang=zh-CN opens it in Chinese.
- https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html?uri=foafos%3A%2F%2Fminiapp%2Forg.glitchcan.hello%3Bversion%3D1.0.0%2Fpages%2Fdetail%2Fdetail%3Fn%3D7 opens the detail page with `n=7`.
- https://danbri.github.io/glitchcan-minigam/magpie/miniapps/index.html?deny=geolocation opens it with a root that has no geolocation. The LOCATION request is then refused by attenuation.

The runner writes the current page back into `?uri=`, so the address bar is always a deep
link.

### Host protocol (frame ↔ host, postMessage)

The protocol follows the foafos handshake (`app.hello` → `app.init`), so a later merge
into `foafos-shell.js` needs no second protocol.

| Direction | type | Fields |
|---|---|---|
| guest → host | `app.hello` | `layer` (`logic`/`view`), sent after the frame's scripts have run |
| host → guest | `app.init` | `appId`, `capabilities`, `manifest` (id, name, version), `messages` (i18n), `inputObject` (logic) or `pageInputObject` (view) |
| host → guest | `miniapp.lifecycle` | `state`, `detail` |
| view → host | `miniapp.rendered` | the first render is done (moves the page to `ready`) |
| view → host | `miniapp.navigate` | `op` (`navigateTo`, `redirectTo`, `navigateBack`), `route`, `query` |
| guest → host | `miniapp.invoke` | `rid`, `api`, `args`; the reply is `miniapp.result {rid, ok, value | error}` |
| either way | `miniapp.message` | `data`; the bridge between the logic layer and the top page |
| guest → host | `miniapp.error` | `message`, `stack`; moves the app to `error`, then back to its previous state |

APIs and the capability each needs (checked on each call with `AppTree.can`):
`system.getInfo` (none), `ui.toast` (none), `storage.get|set|remove|keys` (`storage`),
`location.get` (`geolocation`).

Permission map: `system.permission.STORAGE` → `storage`, `system.permission.LOCATION` →
`geolocation`, `system.permission.AUDIO` → `audio`. Any other name is refused with the
reason "no foafos capability for this permission".

### Where the drafts disagree with themselves, and what this runner does

| Point | Draft text | Choice here |
|---|---|---|
| Signing-block position | Packaging §5.2.1 adds 16 to the EOCD pointer, then subtracts 16. That returns to the EOCD, but the prose says the magic sits immediately before the central directory. | Read the 16 bytes before the central-directory offset. |
| Widget `min_code` type | The example has a string (`"2"`); the member table has a number. | Accept both, store a number. |
| `window.fullscreen` and `navigation_bar_title_text` defaults | §1.6.9 gives `"false"` and `"default"`; §6 gives `false` and nothing. | §6. |
| Fatal members | The processing model throws only for `app_id`, `version` and `platform_version`. The member table also marks `name`, `icons` and `pages` as required. | All six are fatal. |
| Exit from `error` | Not specified. | Report `error`, then go back to the state before it. |
| Page `ready` and `shown` order | Not specified. | `loaded → ready → shown`. |
| Lifecycle event names | The IDL has `onglobalshown`; the examples use `addEventListener('globalshown')`. | Both: the handler attribute is called, then the event is dispatched. |
| Where page scripts run | Packaging puts JS in `pages/`; the White Paper puts logic in workers. | `app.js` runs in the logic frame; page scripts run in their view frame. |
| Background unload | "should" unload after some time; the example is 5 minutes. | 5 minutes, set by `backgroundUnloadMs`. |

## 4. Test results (2026-10-21)

```
node --test magpie/miniapps/test/unit.mjs              # 13 pass, 0 fail (out of 13)
python3 -m http.server 8765 &                          # from the repo root
node magpie/miniapps/test/browser.mjs                  # 25 pass, 0 fail (out of 25)
```

The unit tests parse every example URI in the Addressing Note and process the Manifest
draft's own example with no error and no warning. They also check that each ZIP
constraint violation is refused (encryption, compression method, version, CRC, spanned
archive), that an RPK signing block is found, and that each processing step fails at the
point the draft names. `unzip -t` (Info-ZIP) accepts the packed `.ma` file.

The browser test runs the sample in Chromium 1194 (headless), with Playwright. It checks:
- the lifecycle order (launched, shown, loaded, ready, shown)
- that both frames have an opaque origin and that the view cannot reach the host DOM
- the logic → view bridge and storage through FoafStore
- package images as `data:` URLs
- the zh-CN locale and the grant table
- navigation with a query, back, and a deep link
- home and return, a logic-layer error, close, and closure of the tree node
- the attenuation refusal, and an API call denied at the time of use

### Two defects that the browser test found

1. The "App unloaded" overlay had `hidden`, but its CSS `display: grid` overrode the
   attribute, so the overlay took every tap. Fix: `[hidden] { display: none !important; }`.
2. Pages stopped at `loaded` and never reached `ready`. The log used `scrollIntoView`,
   which scrolled the whole page and put the app frame offscreen. Chromium does not run
   `requestAnimationFrame` in an offscreen cross-origin frame, so the "first render"
   signal was never sent. Fix: the log now scrolls only itself, and `guest.js` sends the
   signal after 250 ms if two animation frames have not come by then. A host that waits
   only on rAF from a sandboxed frame can stall.

## 5. Not done yet

- Signature checking. A signing block is found and reported but not verified, so a signed
  package is treated as unsigned. The RPK and PKCS#7 schemes are examples in the draft,
  not requirements.
- No widgets runtime (manifest `widgets` is parsed and checked only).
- No `window` options except the navigation bar (colour, text style, title, hidden when
  `fullscreen` or `navigation_style: custom`). `orientation`, `design_width` and
  pull-down refresh are not applied.
- The logic layer is a hidden frame, not a Worker. A Worker made from a blob in the host
  would get the host's origin. A Worker made inside the sandboxed logic frame would keep
  the opaque origin, but this is not tried yet.
- The runner is not yet in `foafos-shell.js`. The next step is a `surface: 'miniapp'` row
  type (`package: 'magpie/miniapps/dist/…ma'`), so that `launchApp` spawns a MiniAppHost
  inside a shell window. This also needs the window-manager events the shell does not
  send yet (minimise and focus → `hidden` and `shown`).
- Security is the same as in foafos: open egress, no CSP on the frames (GitHub Pages cannot
  send `Allow-CSP-From`), and `data:` URLs that make large media expensive. See the `fink`
  skill, sections on exfiltration.

## 6. Next steps: Rust/WASM, then Lean

The parts that are pure functions over bytes or JSON are these: URI parsing, ZIP reading
with its constraints, manifest processing, the seven package steps, the two lifecycle
machines, and the permission → capability grant. They have no DOM, and the tests above
fix their behaviour.

1. Port the pure layer to Rust compiled to wasm (or AssemblyScript), behind the same
   function signatures. Run `test/unit.mjs` against both, so that the JS becomes the
   reference and the differential oracle.
2. Port the same layer to Lean 4, beside Factoidal, and compile it to wasm by the
   Factoidal route (`lean4-wasm-export` skill in danbri/factoidal-core). These theorems
   can be stated there:
   - the lifecycle machines accept only the listed transitions, and `unloaded` is terminal;
   - grant(child) ⊆ grant(parent) ∩ map(req_permissions);
   - `readZip` accepts only containers that meet the Packaging §3 constraints;
   - parse ∘ format = id for MiniApp URIs.
3. Keep the host (frames, postMessage, the page stack) in JS. It is DOM work, and its
   tests are the browser test.

The manifest could also be described in RDF (it is close to Web App Manifest), so that
foafos app rows, MiniApp manifests and FINK story metadata use one vocabulary. Factoidal
could then check them with SHACL. This is an idea only.
