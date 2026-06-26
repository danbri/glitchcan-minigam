# UX Review — Mail
_First-time user, no prior knowledge. Headless Chromium, desktop (1280×800) + mobile (390×844, isMobile+hasTouch)._

## Top findings
- **[blocker]** Send crashes every time with a visible error: "Send failed: Cannot read properties of null (reading 'sendMessage')". The compose form works visually but sending is completely broken — reproduced on both desktop and mobile.
- **[major]** The inbox is permanently empty with no explanation. "Select a message to read." is the only text in the reading pane. There is no sample message, no onboarding hint, no "you have no mail" zero-state copy. A first-time user has no idea whether the empty inbox means the app is broken, they need to sign in, or they simply have no messages.
- **[major]** The demo/local nature of the mailbox is not communicated. The app does not say "this is a local demo mailbox" or "sign in to connect a real account." The "alpha" badge (tooltip: "Experimental — sign-in is in alpha") is the only signal, but it is tiny, unexplained, and easy to miss. A naive user has no mental model of what they are looking at.
- **[minor]** The compose form fields (To, Cc, Bcc, Subject) have no placeholder text. On desktop these are medium-sized inputs with nothing inside — no hint like "name@example.com". The body area is a blank white box below the fields with no label visible; there is nothing prompting the user to type there.
- **[minor]** The compose dialog is clipped on desktop: it appears anchored to the bottom half of the screen with the body area visible but barely usable (~150 px of height). There is no way to resize or expand it.
- **[minor]** Mobile search bar collapses to near-zero width (24 px measured) — it is present in the DOM but functionally invisible. The main mail header is crowded: ☰ logo Compose ? Sign-in alpha all in one row at 390 px width.

## Task 1 — Read inbox and compose a reply or new message (desktop)

**What I tried:** Clicked the ✉️ Mail button in the left sidebar (easily found, clearly labelled, highlighted when active). Looked for messages to read. Then clicked the "✏ Compose" button to start a new message, filled in To, Subject, and body, then pressed Send.

**What I observed:** Mail opens to a clean three-pane layout: narrow folder list pane (hidden behind a ☰ drawer button), a middle inbox list pane labelled "Inbox" but completely empty, and a right reading pane showing only "Select a message to read." The Compose button opens a modal anchored to the bottom of the screen titled "New message" with To / Cc / Bcc / Subject inputs and a blank body area. The form accepts input. Pressing "Send" shows an inline error in small grey text: "Send failed: Cannot read properties of null (reading 'sendMessage')". The modal stays open after the error; the user can try again but send will always fail.

**Friction:** The empty inbox with no zero-state copy is disorienting — nothing tells the user why it is empty. Compose opens smoothly but Send is broken. The error message is rendered in a small `<span role="status">` next to the Attach button — easy to miss, no colour contrast to indicate failure, no icon. The modal does not close on ESC by default when the error is present (it does close if you hit ESC before clicking Send). Folder structure behind ☰ opens but shows nothing in the tree — an empty white panel slides in.

**Severity:** blocker (Send), major (inbox zero-state)

**Suggestions:** Fix the `sendMessage` null reference before any user testing. Add a "You have no messages yet" zero-state with a brief explanation ("Sign in to load a real inbox, or mail is local only"). Add placeholder text to compose fields. Show a dismissible "alpha — sending not yet functional" banner instead of relying on the post-send error.

## Task 2 — On mobile (390×844): read inbox + compose

**What I tried:** Same flow as Task 1, on a simulated iPhone-class viewport with touch enabled. Navigated to Mail, observed the inbox, tapped Compose, filled fields, tapped Send.

**What I observed:** The mobile layout is single-column. The left navigation sidebar from the desktop (the icon rail) disappears entirely — the app switches to the edot topbar (edot logo + View + Help + Sign in). The mail-specific header below it shows: ☰ · "✉ edot mail" · [Compose button] · ? · "Sign in" · "alpha". This is a single dense row on a 390 px screen. The Inbox pane occupies the upper ~365 px; the reading pane sits directly below it (stacked, not side-by-side). Both panes appear simultaneously — there is no single-message-fills-screen navigation; scrolling down reveals "Select a message to read." below the inbox. Compose opens as a bottom sheet modal (~389 px tall), which fills nearly the full screen. Fields are wide (296 px for inputs, 390 px for body area). Send produces the same crash error, displayed in tiny text bottom-right: "Send failed: Cannot read properties of null (reading 'sendMessage')" — partially cut off by the screen edge on narrow viewports. The ☰ folders drawer opens as a white panel overlaying the left ~256 px of the screen, but it is completely empty.

**Friction:** Search bar collapses to 24 px on mobile — it exists in the DOM but is visually absent; users cannot search. The stacked inbox+reading-pane layout means a naive user sees both at once but neither has content; it looks like a broken screen rather than a deliberate two-panel design. There is no "back" navigation idiom — when a message would be open (if any existed), there is no obvious way back to the list. Compose modal is cramped at bottom but functional until Send. The error text on mobile is almost completely unreadable (partially clipped at screen edge, very small font, no colour). "Sign in" and "alpha" occupy meaningful header real estate on every screen — on mobile especially this crowds out useful controls.

**Severity:** blocker (Send), major (search invisible, inbox zero-state, no back-navigation idiom)

**Suggestions:** Fix Send. On mobile, hide the search form gracefully or replace it with a search icon that expands. Implement message-open → full-screen with a back arrow for mobile. Add zero-state copy to the empty inbox. Ensure error messages are readable on narrow screens (use a toast or coloured inline message, not tiny grey text that clips).

## Overall impression

The Mail module has a solid structural foundation: three-pane layout, compose dialog with To/Cc/Bcc/Subject/body/attach, folder drawer, keyboard shortcut button, mobile-responsive header. Navigation into Mail is instant and well-marked. However, the module is not usable as shipped: every send attempt crashes with a null reference error, the inbox has no zero-state copy, and there is no indication to a first-time user whether this is a demo, a local mailbox, or a real email client requiring sign-in. The mobile layout suppresses search to near-invisibility and lacks back-navigation for message reading. The "alpha" label is appropriate but needs to be paired with a more prominent explanation of what the user can and cannot do.
