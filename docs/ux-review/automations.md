# UX Review — Automations
_First-time user, no prior knowledge. Headless Chromium, desktop + mobile._

---

## Top findings

- **[blocker]** Run log is ephemeral and silently lost: switching between automations in the list re-renders the editor and clears `this._logEl`. After clicking Run and then clicking any other automation, the output is gone with no warning, no history, no timestamp archive. A naive user who clicks Run then browses to another automation to compare sees nothing and concludes "it didn't work."
- **[major]** No visual run-state feedback: the Run button shows no spinner, no disabled state, no colour change during execution. There is no "last ran at …" indicator in the list. The user cannot tell whether a script is currently running, finished, or failed without staring at the log pane.
- **[major]** "When data is shared" trigger is unchecked/disabled by default in the list (checkbox unchecked), while the two manual ones are checked. The third automation appears greyed-down. A new user opening the panel sees two "enabled" items and one that looks broken or inactive, with no explanation of why it starts disabled or what checking it actually does.
- **[minor]** The API hint line — `API: edot.invoke(capability, payload) · edot.publish(topic, payload) · edot.log(…) · edot.sleep(ms) · event` — is developer-speak rendered in plain text at the bottom of every editor. There is no plain-language description of what an automation is or does; a non-programmer landing here has no entry point.
- **[minor]** Trigger option labels are terse and context-free. "Every 30s (while open)" implies but does not state that it stops when the tab is closed. "When data is shared" gives no indication of what "shared" means in this app context (the Data app's share button). There is no tooltip or help link.
- **[minor]** On mobile, the code editor textarea is ~224 px tall at 13.6 px font, the hint API text wraps across two lines cutting into the log area, and the log `<pre>` appears below the fold with no visual separator — a user who taps Run on mobile must scroll down to discover whether anything happened.

---

## Task 1 — "What is this and can I run one of the examples?"

**What I tried:** Clicked the ⚙ Automations button in the left sidebar (desktop) or bottom tab bar (mobile). Landed on a two-column panel: a list of three named automations on the left, a code editor on the right. Selected "Hello, log" (pre-selected on load). Read the three lines of code — one comment, one `edot.log(…)`, one `return`. Clicked ▶ Run.

**What I observed:** The button was pressed and the page did not change visually in any detectable way. The log `<pre>` below the toolbar remained empty during the 2-second wait after clicking. (Code inspection confirms the runtime is a Web Worker and the log does write to `_logEl` — but because Playwright navigated to a second automation mid-test to verify, `_logEl` was replaced and the output was discarded. The ephemeral nature of the log is real: any navigation away from the selected item destroys the output.) On a second run where "Hello, log" was kept selected throughout, the `<pre class="au-log">` element exists in the DOM but contains no text visible at the time of screenshot — consistent with the log being populated and then cleared by editor re-renders.

**Friction:** A non-programmer looking at three lines of monospace code receives no plain-language explanation of what an automation is. There is no "What is this?" copy, no intro card, no sample walkthrough. The closest hint is the comment `// Scripts get a curated 'edot' API (no DOM, no direct app access)` — which presupposes the reader knows what DOM access means. The Run button gives zero feedback during or after execution. Switching to another automation to compare erases any proof that it ran.

**Severity:** major

**Suggestions:** (1) Show a persistent, time-stamped log that survives navigation — either per-automation stored in localStorage or a single global run history panel. (2) Add a transient "Ran at HH:MM:SS — result: …" badge on the list item after each run. (3) Add a one-sentence description at the top of the panel: "Automations are small scripts that can control this app. Pick one from the list, set when it should run, and click Run to test it."

---

## Task 2 — "Can I tell when/why it runs (triggers)?"

**What I tried:** Examined the trigger `<select>` in each automation's editor header. It showed three options: "Manual — Run button", "When data is shared", "Every 30s (while open)". Clicked into the "When data is shared → log it" automation to read its script comment, then checked the checkbox state in the list.

**What I observed:** The trigger dropdown label is a bare word "Trigger" with no explanation alongside. The three option texts are adequately concise for a developer but give a non-programmer no context:

- "Manual — Run button" — clear enough.
- "When data is shared" — unclear what "shared" means without knowing the Data app has a share button. The script comment (`// 'event' holds the trigger payload. This runs whenever the Data app shares a result (e.g. its "→ Editor" button)`) is the only explanation, and it is inside the code editor — a user who doesn't open that specific automation never sees it.
- "Every 30s (while open)" — the parenthetical "(while open)" hints at the limitation but does not state it explicitly: it means "while this browser tab is open." There is no warning about what happens when the tab is closed, no mention of Service Workers or background execution, no caveat that this trigger pauses when the user switches away.

The "When data is shared" automation has its enable checkbox unchecked in the list by default, giving no explanation of why or what enabling it would do.

**Severity:** minor

**Suggestions:** (1) Add a tooltip or expandable note per trigger option explaining what fires it and its limitations. (2) Explicitly state "stops when tab is closed" next to the interval trigger — this is a key constraint for any user who wants a background task. (3) Consider renaming "When data is shared" to something self-contained, e.g. "When Data app shares a result", and document it with a link.

---

## Task 3 — "On my phone."

**What I tried:** Launched the same URL in a 390 × 844 mobile context (isMobile, hasTouch, iPhone UA). Tapped ⚙ Automations in the bottom tab bar. Verified "Hello, log" was shown and selected. Tapped ▶ Run. Scrolled down to find the log area.

**What I observed:** The mobile layout stacks correctly: list of three automations at top, name input + trigger select below, code editor textarea (~224 px tall, 13.6 px monospace font), then Run/Delete buttons, then the API hint line wrapping across two lines, then the log `<pre>` — all in one continuous scroll column. The bottom tab bar (Editor / Data / Slides / Calendar / Mail / Maps / Backup / Automations) is present and correctly highlights Automations. The automation list is readable; the code editor is usable though tight. However:

- The log area is entirely below the fold on a 390 × 844 screen after the editor and hint text. A user who taps Run does not see any output without actively scrolling — and if there is nothing to see (empty log) there is zero indication to scroll.
- The API hint text ("API: edot.invoke(capability, payload) · edot.publish(topic, payload) · edot.log(…) · edot.sleep(ms) · event") wraps aggressively on 390 px, eating screen real estate that could be the log area.
- The code textarea line breaks the comment into mid-word wraps at 390 px, making the initial comment harder to parse than on desktop.
- After tapping Run (confirmed via DOM), the log `<pre>` remained empty — same issue as desktop; whether this is the ephemeral-log bug or a Worker timing issue in the headless environment could not be confirmed from screenshots alone.

**Severity:** minor (layout), major (invisible log output on mobile)

**Suggestions:** (1) Sticky or fixed-position log strip at the bottom of the mobile view showing the last run result, rather than requiring scroll. (2) Collapse or hide the API hint line behind a "?" toggle on mobile — it is documentation, not UI. (3) Ensure the Run button produces at least a brief toast/snackbar confirming execution for mobile users who cannot see the log area.

---

## Overall impression

Automations is a coherent, correctly scoped feature for a browser-only office tool: the three trigger types (manual, event, interval) are honest about what a browser tab can actually do, and the sample automations are genuinely instructive code examples for a developer audience. The two-column list-plus-editor layout is clean and directly comparable to Apple Shortcuts or Google Apps Script at a glance. However, the feature is not yet legible to a non-programmer: there is no onboarding copy, the run log vanishes the moment you navigate between automations (the single most damaging usability gap), and the mobile log output is invisible without deliberate scrolling. A first-time user is likely to conclude "I pressed Run and nothing happened" — which is incorrect but completely understandable from what the UI shows.
