# UX Review — Backup
_First-time user, no prior knowledge. Headless Chromium, desktop (1280x800) + mobile (390x844 iPhone)._

## Top findings

- **[major]** No local/offline export option. The only backup path is a remote storage backend (GitHub, S3, WebDAV, Solid Pod) — a first-time user expecting "save a copy to my computer" finds nothing of the sort. There is no "Download backup file" or equivalent.
- **[major]** The backend is pre-defaulted to "GitHub repo" with no credentials filled in. Clicking "Back up now" with empty fields silently fires and only then surfaces "Enter a passphrase first." — the wrong first error. The repo field is also empty and broken, but the user is told about the passphrase, not the repo. Ordering of validation is confusing.
- **[major]** "Refresh list" with empty repo silently proceeds and surfaces a raw internal error string: `Could not list: GitHub: cfg.repo must be "owner/name".` — a developer-facing message exposed verbatim to the user, with no suggestion of what to do.
- **[minor]** No explanation of what data is included in the backup (which apps? all documents? settings?). The warning banner covers encryption risks but says nothing about scope. A user with a spreadsheet, some slides, and some mail has no idea if all three are bundled.
- **[minor]** "ALPHA" badge appears next to the heading with no tooltip or link. A user who doesn't know what "Alpha" means technically gets no help. The warning text is good but buried below the badge in a pink box that blends with the form.
- **[none]** The ⤓ icon in the left rail is recognisable as download/export. "Backup" label beneath it is clear. Navigation to the section is frictionless on both desktop and mobile.

---

## Task 1 — "I want to make sure my work is saved / can I export it?"

**What I tried:** Clicked "⤓ Backup" in the left sidebar. Observed the Encrypted backup panel. Looked at backend options. Tried clicking "Back up now" with no fields filled in. Then tried "Refresh list."

**What I observed:** The backup panel opens immediately and is well-laid-out. There is a prominent warning that encryption is end-to-end and that passphrase loss means data loss. The storage backend dropdown offers four options (GitHub repo, S3-compatible, WebDAV, Solid Pod) — all of them require setting up an external service. There is no "download to disk" option. The default selected backend is GitHub, and the form pre-populates "edot-backups" in the Folder field but leaves Repo and Token blank.

Clicking "Back up now" with all fields blank produced a red inline error: "Enter a passphrase first." — the passphrase field is the last field above the button, but the repo and token are also empty. The form didn't highlight the empty required fields; it just blamed the passphrase.

Clicking "Refresh list" with nothing filled in produced: "Could not list: GitHub: cfg.repo must be `owner/name`." — a raw internal error string visible to the user in the Snapshots area.

There is no local/offline export. The word "restore" or "import" does not appear in this panel. An "Import file…" button exists elsewhere in the app (visible in the Slides toolbar area from initial load) but is not connected to this Backup panel.

**Friction:** Very high for a first-time user who wants a simple "save a copy." The setup requires a GitHub account (or S3/WebDAV/Solid), credentials, and a passphrase — without any onboarding hint about which backend is easiest or what to do first. The first action available (Back up now) produces an error, and then an unhelpful error. No success path is achievable without external service credentials.

**Severity:** major

**Suggestions:**
1. Add a "Download encrypted backup" option (local download to disk) alongside the remote backends — this is the zero-configuration path most users expect first.
2. Validate all required fields before the user clicks "Back up now" — either disable the button until the form is complete, or highlight all empty required fields on submit, not just the last one the code reached.
3. Replace the raw `cfg.repo must be "owner/name"` string with human-readable copy: "Please enter a GitHub repo in the format `username/reponame`."
4. Add a brief one-liner below the heading stating what is included in a backup (e.g., "Backs up all documents, data tables, and slides stored in this session").

---

## Task 2 — "On my phone"

**What I tried:** Loaded on 390x844 (iPhone-sized), navigated to Backup via the bottom tab bar, tapped "Back up now" with no credentials.

**What I observed:** On mobile the app nav moves to the bottom of the screen as a horizontal strip. The ⤓ Backup button is at x=212, y=793 — near the bottom-right of the screen, reachable with a right-thumb tap. It is 39px wide and 46px tall, which meets the 44px minimum only on height — the 39px width is slightly narrow but functionally tappable.

The backup form renders vertically and fits the 390px width cleanly — all fields are full-width and well-sized (335px wide, 34px tall). The full form from "Storage backend" down to "Back up now" is visible within the 844px height without scrolling (all controls sit between y=193 and y=673). The layout is responsive and readable.

"Back up now" tap produced "Enter a passphrase first." in red — same as desktop. The error is visible without scrolling.

One layout issue: the "Workspace" nav button at the top of the left rail (desktop view) has zero size on mobile (w=0, h=0) — it appears the rail collapses into the bottom strip and the Workspace item is hidden or inaccessible. This is a minor inconsistency but not a blocker for the Backup task.

**Friction:** Low for navigation (the bottom bar is clear, Backup is findable). Medium for actual use (same credential-setup barrier as desktop applies; no local export). The form is usable on touch — fields are large enough, buttons are reachable. The error messages appear in the right place.

**Severity:** minor (for mobile-specific issues; the underlying backup UX problems are the same as desktop)

**Suggestions:**
1. Increase the Backup rail button width on mobile to at least 44px to meet touch target guidelines.
2. Consider whether a "Workspace" shortcut belongs in the mobile bottom bar or if the current omission is intentional — it is present on desktop but disappears on mobile.

---

## Overall impression

The Backup section has a clean, readable layout and the encryption warning is honest and appropriately prominent — this is better than average for an alpha feature. However, the first-time experience is a dead end: there is no local/offline export, the form requires external service credentials before anything works, and both primary actions produce unhelpful error messages when attempted cold. A user who just wants to "save my work and feel safe" has nowhere obvious to go. On mobile the layout holds up well and the form is touch-friendly, but the same fundamental usability gap applies. The section reads as developer-ready infrastructure that hasn't yet been wrapped in user-facing onboarding.
