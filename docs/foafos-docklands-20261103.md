# Docklands (moglob) as a foafos app, and where the moglob drone is (2026-11-03)

Status: done and tested as written below. The Docklands page is a foafos app on the stage. The moglob drone is not on
londat `main` and is not on the live page.

## 1. The requests

1. Does https://danbri.github.io/londat/docklands/ include the animated, moglob-branded vehicle from 2026-11-02?
2. Put the Docklands page into foafos as an app, modelled on Drift City. Load the live page by URL in the sandboxed
   frame.

## 2. Finding: the moglob drone is not on londat main and not deployed

"moglob" is the name of the Docklands 3D app since 2026-10-23 (`docklands/governor.js` `APP`, the `<title>`, the boot
screen). The vehicle is the **Moglob drone**: an art deco teardrop drone with one faceted glass eye and "moglob" in
brass letters on its sides. It comes in nineteen forms (heli, plane, sub, car, walker and others).

Where it is:

- **The Moglob Drone Kit**, a claude.ai artifact: https://claude.ai/artifact/GjgAmfq94KZSusJkkPx77s. It holds
  `moglob-drone.js` (v0.3.0, dated 2 Nov 2026, about 2,000 lines, three.js r160), `play.html`, `docs.html`,
  `charsheet.html`, `README.md`, the `moglob-transport-coding` integration skill and 118 published files in total.
- The `moglob-character-fx` skill (synced into `~/.claude/skills/synced/`, dated 2026-11-02 17:59) points at that kit.

Where it is not:

- **danbri/londat `main`** (tip `765bdcbc`, 2026-11-03T23:08Z). On 2026-11-02 and 2026-11-03 there are only two
  commits that are not cache commits: `75fcaefc` "Keep the city visible during flight and add explicit pose sweeps" and
  `5456c93e` "Add independent eye and gaze waypoints to pose sweeps". Neither touches a vehicle. `git grep` on
  `origin/main` finds no `moglob-drone`, `MoglobDrone`, `charsheet`, teardrop, dorsal or faceted-dome code.
  `docklands/drone.js` is the older first-person "virtual drone" camera (copter, plane, boat, tube, walk, under). It has
  no model and no branding, and its last change was `bca9a35b` on 2026-10-10.
- **Any branch.** The remote branches are `main`, `adsb-cache`, `live-cache`, `wip/agents-2026-10-11` and three
  `claude/*` branches (last commits 2026-10-07 to 2026-10-12). None mentions the drone.
- **Any PR.** `gh pr list -R danbri/londat --state all` gives one PR: #1, merged 2026-10-07.
- **The live page.** On 2026-11-03 `index.html` had `last-modified: Mon, 02 Nov 2026 08:03:01 GMT`. The live `main.js`,
  `api.js` and `drone.js` are byte-identical to `origin/main`. They contain no drone-kit code.
- **The local londat checkout** `/Users/danbri/working/sandbox/londat`. It has uncommitted work: `docklands/identity/`
  (the animated moglob *lettering* for the boot screen and icons, 2026-11-01; staged as a package in
  `/Users/danbri/working/moglob-pm/`), `docklands/shard-model.js` and edits to 15 tracked files. That is the visual
  identity, not the vehicle. It is not pushed. `/Users/danbri/working/moglob.md` records that the identity stayed local
  ("automatic approval review rejected remote publication").

So the drone is only in the claude.ai kit. Putting it into the page is new work in londat: import `moglob-drone.js`,
and match its three.js version (the kit uses r160, the page uses r186). No merge in londat was done.

## 3. What was done: the `docklands` app

- `inklet/finkapp/apps/docklands.jsonld`: new manifest, position 33. `surface: "stage"` and `family: "play"`, as for
  Drift City (`drift.jsonld`): a heavy full-screen world. `game: "docklands"` lets a story open it with
  `# APP: docklands`. `url` is the live page, https://danbri.github.io/londat/docklands/. `controls: "none"`, because
  the page has its own controls. `capabilities: []`, `external: true`, `persists: false`, as for Tellyclub, which is
  the other external app that does not use the SDK. The notes say that the page wants the whole screen.
- `inklet/finkapp/foafos-apps-data.js`: regenerated (`npm run apps:build`).
- Roots: no change to `foafos-root.js`. The default root, `glitchcanary` ("Finkiverse"), has `apps: null` (all apps),
  so it shows Docklands next to Drift City. The other roots (office, webtv, apps) are themed and do not get it.
- Icon: 🏙️.

Open it: https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?app=docklands

Why there are no capabilities: the page does not load `app-sdk.js`, so `storage` would give it nothing. Geolocation
(the page's Locate button) and WebXR (its headset mode) are not delegated to a third-party page. `audio` was left off
because the page does not obey the master volume.

## 4. Framing and cross-origin: checked

- Headers of https://danbri.github.io/londat/docklands/ (2026-11-03): no `X-Frame-Options`, no
  `Content-Security-Policy`, so no `frame-ancestors`. The page does not refuse framing. It has no CSP `<meta>` either.
- `Access-Control-Allow-Origin: *` on the page and on its scripts (`main.js`). That is necessary: the sandbox gives the
  frame an opaque origin (`self.origin` is `"null"`), so its module scripts and its data loads are cross-origin
  requests.
- Chrome (headless, `--enable-unsafe-webgpu`), shell at `?app=docklands`, 1280x800, full stage. The iframe had
  `sandbox="allow-scripts allow-forms allow-modals"` and no `allow`. After 25 s the page had booted (boot screen
  hidden, 4 canvases), drew with **WebGPU**, and answered its page API: `window.docklands.getView()` gave app
  `moglob`, API 1.9.1, the eye at 51.4953 N, 0.0070 W. The screenshot showed the lit Canary Wharf model, the labels,
  the time wheels and the live-data credits. Headless it ran at about 4 fps.
- Errors in the frame, both expected in an opaque origin: an uncaught `SecurityError` reading
  `navigator.serviceWorker` (the page's `sw.js` registration), and two Permissions-Policy violations for
  `xr-spatial-tracking` (`xr.js`). The page continued after both. Because `localStorage` is not available, view
  settings and the governor's crash record do not persist inside foafos.
- Not tested: split and picture-in-picture stage modes, phone width, WebKit/iOS. Expect a cramped HUD and a lower frame
  rate there. For the best view, open the page directly.
- A small improvement for londat (not made): put the `navigator.serviceWorker` access in a `try` so that a sandboxed
  frame gives no uncaught error.

## 5. Tests

Run in a clean worktree of `master` with only this change, because another session had uncommitted work in the shared
checkout (a `chat` app, `chat.jsonld` at position 32, the same as `podnotes.jsonld`). Chrome:
`PW_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.

| check | result |
|---|---|
| `npm run apps:check` | pass: 34 apps, JSON-LD and SHACL clean, data module up to date |
| `e2e-caps.mjs` | PASS, 66 checks. The first run failed "registry not uniform … noCaps: docklands"; fixed with `capabilities: []` |
| `e2e-powers.mjs` | PASS, 26 |
| `e2e-foafos.mjs` | PASS, 30 |
| `e2e-taskmanager.mjs` | PASS, 23 |
| `e2e-app-deeplink.mjs` | pass, 4 |
| `e2e-root.mjs` | FAIL, 25 passed. Two errors: "webtv root errors" and "logger errors", both `Uncaught SecurityError … serviceWorker`. **It fails the same way on `master` without this change** (Tellyclub's page in the webtv root), so this change did not cause it |
