# Automations

The Automations app (`<edot-automations>`) is an Apps-Script / Shortcuts-style automation layer for the edot suite. Each automation pairs a **trigger** with a JavaScript script that drives the suite through kernel capabilities. Scripts run inside a sandboxed Web Worker with a curated `edot` API — they have no DOM access, no direct app object access, and (in this v1) no network.

Source: `magpie/edot/automations/js/automations-app.js`, `automation-runtime.js`, `automations-store.js`.  
Test: `magpie/edot/automations/test-automations.mjs` (10 assertions, Playwright/Chromium).

## Features

- **Web Worker sandbox isolation** [stable] — each script runs in a fresh `Worker` created from a Blob URL; the Worker is terminated on completion or timeout. The host bridges via `postMessage`; the script cannot reach the DOM, `window`, or any app object.
- **Network APIs stripped** [stable] — `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, `Worker`, `SharedWorker`, `caches`, `indexedDB`, `navigator.sendBeacon` are all neutered inside the Worker at startup (set to `undefined` on `self`). The `Function` constructor resolves to the same neutered globals, closing the indirect path.
- **Timeout kill** [stable] — `AutomationRuntime.run()` sets a `setTimeout` (default 8 000 ms, configurable as `timeoutMs`). On expiry the Worker is terminated and the promise rejects with `"Automation timed out after Xms"`.
- **Manual trigger** [stable] — the Run button calls `_run(a)` directly in `_renderEditor`.
- **`data-share` trigger** [stable] — `_wireTriggers` subscribes to kernel bus topic `data:share`; any enabled automation with `trigger === 'data-share'` fires with the share payload as `event`.
- **Interval trigger (every 30 s while open)** [partial] — wired with `setInterval(…, 30000)` in `_wireTriggers`, cleared in `disconnectedCallback`. Works while the tab is open; background / tab-closed delivery is not possible in a web context (noted in the source comment).
- **Run log** [stable] — each run appends timestamped lines to a `<pre class="au-log">` element; the log is created fresh per `_renderEditor` call and does not survive navigation or editor re-renders.
- **Persistence** [stable] — automations (id, name, trigger, enabled, code) are stored in `localStorage` under key `edot.automations.v1` via `automations-store.js`. A save is triggered on every name, trigger, code, or enabled-toggle change.
- **Seed automations** [stable] — on first load (empty store), `seeds()` creates three example automations: `Hello, log` (manual), `Push cities to Slides` (manual, calls `slides.addData`), and `When data is shared → log it` (data-share, disabled).
- **`edot.invoke(capability, payload)` API** [stable] — round-trips through `postMessage` to the host's `_api` bridge, which calls `kernel.capabilities.invoke(name, payload)`. Returns the capability's return value.
- **`edot.publish(topic, payload)` API** [stable] — round-trips to `_api`, which calls `kernel.bus.publish`. Returns `true`.
- **`edot.log(...args)` API** [stable] — fires a `postMessage` of type `log`; args are structurally cloned via `JSON.parse/stringify`; the host appends them to the run log.
- **`edot.sleep(ms)` API** [stable] — implemented inside the Worker as `setTimeout`; capped to 10 000 ms (`Math.min(ms, 10000)`).

## Side-effecting actions (command-registry inventory)

### Action table

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Run automation manually | User clicks Run button | Executes automation script in Worker sandbox | `automations.run` |
| Create new automation | User clicks "+ New" | Appends a default automation to the list; saves to localStorage | `automations.new` |
| Delete automation | User clicks Delete | Removes automation from list; saves to localStorage; selects next item | `automations.delete` |
| Toggle enabled state | User toggles checkbox | Flips `a.enabled`; saves to localStorage; no worker activity | `automations.setEnabled` |
| Fire `data-share` automations | Kernel bus event `data:share` | Runs all enabled `data-share` automations with share payload | (reactive, not a user command) |
| Fire interval automations | 30 s `setInterval` | Runs all enabled `interval` automations with `{ at: Date.now() }` | (reactive, not a user command) |

### Capability surface scripts can call

Scripts reach the outside world exclusively through `edot.invoke(name, payload)`. Today `name` is an unstructured string matched by whatever `kernel.capabilities` providers happen to be registered. The seed automation calls `slides.addData`; the test suite registers a throwaway `test.echo` capability. There is no enforced namespace, no schema, and no discovery mechanism.

**A command registry would formalize this surface:** instead of `edot.invoke('slides.addData', …)`, a script would call `edot.invoke('slides.addData', …)` against a typed, versioned registry entry — with a documented payload schema, permission annotation, and discoverability. This matters especially for automations because:

1. Scripts are user-authored and run headless; without a registry, there is no way to list what capabilities are available, and typos fail silently at runtime.
2. Automations are the only app that *calls* capabilities from user-written code rather than from trusted app internals — they are the primary consumer of whatever the registry exposes.
3. A registry would allow the sandbox to enforce per-capability permissions (e.g. block network-adjacent capabilities from untrusted scripts) rather than relying solely on the current network-stripping heuristic.

Known reachable capabilities (from seeds and tests): `slides.addData` (add a data table to the Slides deck), `test.echo` (test stub). The kernel bus is also reachable via `edot.publish(topic, payload)` — any bus subscriber in any app will receive it.

## User journeys

1. **Run a sample automation** — Open the Automations app. The "Hello, log" automation is pre-selected. Click "▶ Run". The run log shows a timestamped `▶ Hello, log · Manual — Run button` entry followed by `✓ ran at HH:MM:SS`.

2. **Edit a script** — Click "Push cities to Slides" in the left list. The script editor shows the `slides.addData` call. Edit the city list or the title string. Changes auto-save to localStorage on every keystroke (`input` event). Click "▶ Run" to test; the Slides app will show the updated slide.

3. **Set a trigger** — Select or create an automation. Use the "Trigger" dropdown to change from "Manual — Run button" to "When data is shared". Save is automatic. The automation will now fire whenever the Data app publishes on `data:share` (e.g. via its "→ Editor" button).

4. **Create and wire a new automation** — Click "+ New". A blank automation named "New automation" with `trigger: manual` appears. Rename it, write a script using the `edot` API (hint text is shown in the toolbar: `edot.invoke / edot.publish / edot.log / edot.sleep / event`), and run it to verify. Enable the checkbox to allow reactive triggers to fire it.

5. **Observe a reactive fire** — Enable the "When data is shared → log it" seed. Open the Data app, run a query, click its "→ Editor" (or equivalent share button). Switch back to Automations — the run log shows the event payload (title and row count) written by the script.

## Test coverage

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| Script result uses the event payload | `test-automations.mjs` :: `script result uses the event payload (1 + 5)` | Tested |
| `edot.log` reaches the host | `test-automations.mjs` :: `edot.log reaches the host` | Tested |
| `edot.invoke` round-trips to a kernel capability | `test-automations.mjs` :: `edot.invoke round-trips to a kernel capability` | Tested |
| Sandbox has no DOM | `test-automations.mjs` :: `sandbox has NO DOM (document & window undefined, self is the worker)` | Tested |
| Sandbox has no network | `test-automations.mjs` :: `sandbox has NO network (fetch/XHR/importScripts/WebSocket/Worker all undefined)` | Tested |
| Runaway script killed by timeout | `test-automations.mjs` :: `a runaway script is killed by the timeout` | Tested |
| Seed automations present on first load | `test-automations.mjs` :: `seed automations are present` | Tested |
| Automation drives `slides.addData` through the kernel | `test-automations.mjs` :: `an automation drives slides.addData through the kernel` | Tested |
| Run log shows automation output | `test-automations.mjs` :: `the run log shows the automation output` | Tested |
| No page errors | `test-automations.mjs` :: `no page errors` | Tested |

### Gaps (untested)

- **Interval trigger** — `setInterval(…, 30000)` is wired in `_wireTriggers` but no test fires it or advances a fake clock. Confirmed untested.
- **`data-share` trigger reactivity** — the bus subscription and `_fire('data-share', …)` path are not exercised by any assertion in the suite. The seed automation with this trigger is present but its reactive invocation is never tested.
- **Persistence / localStorage round-trip** — `loadAll` / `saveAll` are called in the app but no test clears and reloads the store to confirm automations survive navigation. The UX review flagged "run log survives navigation" as broken; this gap confirms neither log nor store state is regression-tested across page reloads.
- **Add / delete automation via UI** — `_newItem` and `_deleteItem` are untested.
- **`edot.publish` round-trip** — the `_api` bridge handles `op === 'publish'` but no test asserts that a bus subscriber receives a message published from a script.
- **`edot.sleep` cap enforcement** — the 10 000 ms ceiling is not tested; nor is a sleep that is within limits.
- **Enabled toggle** — the checkbox enable/disable path is untested.
- **Trigger change via dropdown** — selecting a different trigger is untested.
- **QuickJS-in-WASM backend** — mentioned in `automation-runtime.js` as a future stronger isolation backend; does not exist yet.

## Known issues

- **Run log is ephemeral** — `this._logEl` is created inside `_renderEditor`. Selecting a different automation and returning, or any re-render, creates a fresh `<pre>` and loses prior log output. There is no persistent log store.
- **Network not fully removed in v1** — the source comment in `automation-runtime.js` explicitly notes "Network is still reachable in this v1"; the stripping is best-effort (assigning `undefined` to `self[n]`). A QuickJS-in-WASM backend is mentioned as the path to full isolation.
- **`edot.invoke` capability name is opaque** — scripts must know capability names by convention; there is no listing or schema. Typos fail at runtime with whatever error the kernel throws (or silently if the capability is unregistered and the bus path returns `undefined`).
- **Interval trigger only fires while app is open** — background / tab-closed scheduling is not possible in a standard browser context. The source notes this explicitly.
- **`edot.sleep` is not async-cancellable on timeout** — if the Worker is killed by the 8 s outer timeout while a `sleep` is in progress, the Worker terminates without a clean rejection path inside the script.
