# Mail

`<edot-mail>` is a responsive three-pane webmail client built as a Web Component. It is **provider-agnostic**: the component only ever talks to a `MailAdapter` (defined in `js/adapters/base.js`), so the same UI works with Gmail REST, Microsoft Graph, JMAP, or IMAP-over-WebSocket without any component changes.

**No account is configured by default.** `mail-config.js` ships with all tokens and client IDs blank. The inbox is empty on first load because `load()` throws if `this.adapter` is null and nothing wires an adapter automatically. Compose and save-draft are guarded: if `adapter` is null when Send or Save Draft is clicked, the compose status field shows "Sign in to a mail account first to send." / "…to save drafts." instead of crashing. This guard was verified against code (`_send`, `_draft` in `edot-mail.js` lines 370, 380).

**Status: demo / alpha.** The alpha badge in the header is rendered unconditionally and is tested by the suite.

## Features

- **Three-pane layout** (folders drawer / message list / reading pane) `[stable]`
  - Layout is rendered in `_render()`. Keyboard navigation between panes and within the list (j/k) is wired.
  - On mobile the folder pane becomes a drawer toggled by the ☰ button and a scrim overlay.
- **Folders drawer** (mailbox list via `<edot-tree>`) `[stable]`
  - Populated by `adapter.listMailboxes()`. Shows role icons, unread badge counts. Folder selection calls `openMailbox(id)` and closes the drawer.
- **Message list** `[stable]`
  - Threaded summaries: from name/email, subject, snippet, date (smart relative formatting), unread bold, star toggle, attachment clip indicator.
  - List count shown; cursor-based pagination tracked (`_nextCursor`) but no "load more" trigger implemented in the UI.
- **Message reader** `[stable]`
  - Sanitized HTML body (via `sanitize.js`). Plain-text bodies auto-converted to safe HTML with autolinks.
  - Attachments listed with name, MIME type, and size.
  - Reply / Reply All / Forward / Archive / Delete / Mark Unread action buttons shown conditionally on `capabilities()`.
- **Remote-image blocking** `[stable]`
  - All remote `<img src>`, `srcset`, `background`, CSS `url()` resources blocked by default. Parked in `data-blocked-src`. A "Load remote content" banner button re-renders with `allowRemote:true`.
- **Compose dialog** (To / Cc / Bcc / Subject / body / attach) `[stable]`
  - Modal overlay with `contenteditable` body. File input for multiple attachments (name/mime/size gathered; actual upload depends on adapter).
  - In-Reply-To header threaded through reply/forward flows.
- **Send via adapter** `[stable]` (guarded: shows sign-in hint when no adapter)
- **Save draft via adapter** `[stable]` (guarded: same)
- **Reply / Reply All / Forward** `[stable]`
  - Reply pre-fills To (+ Cc for Reply All), quoted body, prefixes subject with "Re:".
  - Forward pre-fills subject with "Fwd:", embeds a forwarded-message header.
- **Search** `[stable]`
  - Form submit calls `adapter.search(query, { mailboxId })`. Empty query reloads the current mailbox. Result updates the message list title to "Search: <query>".
- **Keyboard shortcuts** `[stable]`
  - j/k (next/prev), Enter (open), r/a/f (reply/all/forward), e (archive), # (delete), u (mark unread), c (compose), / (focus search), ? (help dialog), Esc (close drawer/compose).
- **Adapters**
  - **Gmail** (`js/adapters/gmail.js`) `[stable, tested]` — CORS + OAuth bearer; threads, search, flags, move, send, draft. RFC822 built locally and sent as base64url raw.
  - **Graph** (`js/adapters/graph.js`) `[stable, tested]` — Microsoft 365; CORS + OAuth bearer; threads, search, flags, move, send, draft. Structured JSON bodies (no raw MIME parse).
  - **JMAP** (`js/adapters/jmap.js`) `[stable, tested]` — RFC 8620/8621; browser-direct when server sends CORS; threads, push (declared), search, flags, move, send (Email/set + EmailSubmission/set), draft.
  - **IMAP** (`js/adapters/imap.js`) `[partial]` — requires a WebSocket proxy (browsers cannot open raw TCP). Proxy-dependent; `isAvailable()` returns false without `proxyUrl`, shows an honest banner. Raw RFC822 fetched and parsed by `mime.js`. No threads.

## Side-effecting actions (command-registry inventory)

| Action | Trigger (toolbar / compose / API / adapter) | Effect | Proposed command id |
|---|---|---|---|
| Compose new message | Toolbar `✏ Compose` button; keyboard `c` | Opens compose overlay dialog | `mail.compose` |
| Reply | Reader `.act-reply` button; keyboard `r` | Opens compose pre-filled with To, quoted body, Re: subject | `mail.reply` |
| Reply All | Reader `.act-replyall` button; keyboard `a` | Opens compose pre-filled with To + Cc, Re: subject | `mail.replyAll` |
| Forward | Reader `.act-forward` button; keyboard `f` | Opens compose pre-filled with Fwd: subject and forwarded header | `mail.forward` |
| Send | Compose `.cf-send` button | Calls `adapter.sendMessage(draft)`; on success closes dialog after 600 ms | `mail.send` |
| Save draft | Compose `.cf-draft` button | Calls `adapter.saveDraft(draft)` | `mail.saveDraft` |
| Set adapter | JS API `setAdapter(adapter, { account })` | Wires a MailAdapter; no UI element | `mail.setAdapter` |
| Load account | JS API `load()` | Calls `adapter.listMailboxes()` then `openMailbox(inbox)` | `mail.load` |
| Open mailbox (folder) | Folder tree `onActivate`; indirectly from `load()` | Calls `adapter.listMessages(mailboxId, { limit:50 })`; updates list | `mail.openMailbox` |
| Open message (read) | Click on message row; keyboard `Enter` | Calls `adapter.getMessage(id)`; renders sanitized body; marks seen via `adapter.setFlags` | `mail.openMessage` |
| Load remote content | Reader `.load-remote` button in blocked-resource banner | Re-renders message body with `allowRemote:true` via `sanitizeHtml` | `mail.loadRemoteContent` |
| Star / unstar | Star button on each list row | Toggles `flags.flagged` optimistically; calls `adapter.setFlags(id, { flagged })` if `capabilities().flags` | `mail.toggleStar` |
| Mark unread | Reader `.act-unread` button; keyboard `u` | Sets `flags.seen=false`; calls `adapter.setFlags(id, { seen:false })` if flags capability present | `mail.markUnread` |
| Archive | Reader `.act-archive` button; keyboard `e` | Calls `adapter.archive(id)`; removes message from list | `mail.archive` |
| Delete | Reader `.act-delete` button; keyboard `#` | Calls `adapter.del(id)`; removes message from list | `mail.delete` |
| Search | Search form submit; keyboard `/` focuses input | Calls `adapter.search(query, { mailboxId })`; updates list title and rows | `mail.search` |

**Adapter-level side effects** (called by the above, not directly commanded):

| Adapter operation | Gmail | Graph | JMAP | IMAP |
|---|---|---|---|---|
| `listMailboxes` | GET /labels | GET /mailFolders | Mailbox/get | proxy `list` |
| `listMessages` | GET /messages + GET /messages/{id}?metadata | GET /messages | Email/query + Email/get | proxy `search` + `fetch` (headers) |
| `getMessage` | GET /messages/{id}?format=full | GET /messages/{id}?expand=attachments | Email/get | proxy `fetch` (full) + mime.js parse |
| `sendMessage` | POST /messages/send (base64url raw) | POST /me/sendMail | Email/set + EmailSubmission/set | proxy `send` (buildRfc822) |
| `saveDraft` | POST /drafts | POST /me/messages | Email/set (create in drafts) | proxy `append` (buildRfc822) |
| `setFlags` | POST /messages/{id}/modify (label add/remove) | PATCH /me/messages/{id} (isRead/flag) | Email/set (keywords patch) | proxy `store` (IMAP flags) |
| `archive` | POST /messages/{id}/modify (remove INBOX) | move to 'archive' folder | move to archive mailbox | move to archive mailbox |
| `del` | POST /messages/{id}/trash | DELETE /me/messages/{id} | Email/set destroy | proxy `expunge` |
| `move` | POST /messages/{id}/modify (swap labels) | POST /messages/{id}/move | Email/set (mailboxIds) | proxy `move` |

## User journeys

1. **Open a message (demo/mock adapter)**
   Configure a mock adapter via `window.__mail.component.setAdapter(adapter)` then call `.load()`. The folder tree populates, message list shows summaries, clicking a row calls `adapter.getMessage(id)`, renders sanitized HTML in the reading pane, and optimistically marks the message seen (if `capabilities().flags`).

2. **Compose with no account → sign-in hint**
   Click Compose (or press `c`). Fill in To and body. Click Send. Because `this.adapter` is null, `_send()` sets the status field to "Sign in to a mail account first to send." without throwing. The compose dialog remains open for the user to act on the hint.

3. **Send a message (account configured)**
   With a wired adapter, clicking Send calls `draftFrom(wrap)` to collect To/Cc/Bcc/Subject/html/inReplyTo/attachments, validates that `to.length > 0`, calls `adapter.sendMessage(draft)`, shows "Sent ✓", and closes the dialog after 600 ms. On error, shows "Send failed: <message>".

4. **Read a message with remote images blocked**
   Opening a message that has remote `<img>` tags shows them as blocked (sources parked in `data-blocked-src`, counts reported in a banner). Clicking "Load remote content" re-renders with `allowRemote:true`, restoring the live src attributes.

5. **Search the inbox**
   Focus the search input (click or press `/`). Type a query and press Enter. `adapter.search(query, { mailboxId: currentMailbox })` is called; the message list updates and the list title changes to "Search: <query>". Clearing the field and pressing Enter reloads the full mailbox.

6. **Navigate with the keyboard**
   Press `j`/`k` to move between messages (scrolls into view, updates active state). Press `Enter` to open. Once a message is open, `r`/`a`/`f` for reply variants, `e` to archive, `#` to delete, `u` to mark unread. Press `?` for the full help overlay.

## Test coverage

File: `magpie/edot/mail/test-mail.mjs` — 51 assertions total (from `docs/edot/test-coverage.json`).

### Coverage table

| Feature | Covered by (assertion label) | Status |
|---|---|---|
| Header sign-in chip present | `mail header shows the sign-in chip` | covered |
| Sign-in chip upgraded (custom element rendered) | `sign-in chip upgraded (custom element rendered)` | covered |
| Alpha badge | `chip is flagged alpha` | covered |
| MIME RFC2047 encoded-word subject | `MIME decodes RFC2047 encoded-word subject` | covered |
| MIME multipart/alternative HTML selection | `MIME picks the html alternative` | covered |
| MIME plain-text alternative | `MIME keeps the plain alternative too` | covered |
| MIME quoted-printable decoding | `MIME quoted-printable decodes (=C3=A9 → é)` | covered |
| MIME base64 decoding | `MIME base64 decodes` | covered |
| MIME attachment extraction | `MIME extracts the attachment with decoded content` | covered |
| Sanitizer removes `<script>` | `sanitizer removes <script>` | covered |
| Sanitizer strips onclick handler | `sanitizer strips onclick handler` | covered |
| Sanitizer blocks remote img by default | `sanitizer blocks remote <img> by default` | covered |
| Sanitizer seat-belts links | `sanitizer seat-belts links (new tab, no referrer)` | covered |
| Sanitizer neutralizes javascript: href | `sanitizer neutralizes javascript: href` | covered |
| Sanitizer allows remote img when allowRemote | `sanitizer loads remote img when allowRemote` | covered |
| Gmail listMailboxes normalization + roles | `gmail.listMailboxes normalizes roles` | covered |
| Gmail unread count | `gmail mailbox carries unread count` | covered |
| Gmail listMessages (summary + flags + cursor) | `gmail.listMessages normalizes summary + flags + cursor` | covered |
| Gmail getMessage (base64url decode) | `gmail.getMessage decodes base64url html body` | covered |
| Gmail sendMessage | `gmail.sendMessage POSTs messages/send with base64url raw` | covered |
| Graph listMailboxes normalization + roles | `graph.listMailboxes normalizes roles` | covered |
| Graph unread count | `graph mailbox carries unread count` | covered |
| Graph listMessages (from + hasAttachments) | `graph.listMessages normalizes from + hasAttachments` | covered |
| Graph getMessage (HTML body) | `graph.getMessage returns html body` | covered |
| Graph sendMessage | `graph.sendMessage POSTs /me/sendMail with message shape` | covered |
| Graph setFlags | `graph.setFlags PATCHes isRead` | covered |
| JMAP listMailboxes normalization | `jmap.listMailboxes normalizes roles (junk→spam etc.)` | covered |
| JMAP unread count | `jmap mailbox carries unread count` | covered |
| JMAP listMessages (from + keywords) | `jmap.listMessages normalizes from + flags via keywords` | covered |
| JMAP getMessage (bodyValues) | `jmap.getMessage resolves htmlBody via bodyValues` | covered |
| JMAP setFlags (keyword patch) | `jmap.setFlags uses keyword patch` | covered |
| JMAP sendMessage (EmailSubmission/set) | `jmap.sendMessage issues EmailSubmission/set` | covered |
| IMAP isAvailable (requires proxyUrl) | `imap.isAvailable true only with proxyUrl` | covered |
| IMAP proxy protocol (all ops) | `imap talks the proxy protocol (login/list/search/fetch/store/send)` | covered |
| IMAP mailbox normalization | `imap normalizes mailboxes via proxy list` | covered |
| IMAP raw RFC822 parse | `imap parses raw RFC822 via MIME (from/subject/body)` | covered |
| IMAP refuses honestly without proxyUrl | `imap without proxyUrl is unavailable and refuses honestly` | covered |
| Adapter registry createAdapter | `registry creates the right adapter` | covered |
| Adapter registry lists all four backends | `registry lists all four backends` | covered |
| UI: folder tree renders | `UI renders the mailbox tree` | covered |
| UI: message list renders | `UI renders the message list` | covered |
| UI: unread messages marked bold | `UI marks unread messages bold` | covered |
| UI: open message into reading pane | `UI opens a message into the reading pane` | covered |
| UI: reading pane blocks remote tracker | `UI reading pane blocks the remote tracker image` | covered |
| UI: load-remote-content affordance shown | `UI shows the load-remote-content affordance` | covered |
| UI: load remote content on demand | `UI loads remote content on demand` | covered |
| Compose draftFrom shape | `compose builds a draft with to/subject/html` | covered |
| Compose send calls adapter | `compose send calls adapter.sendMessage with the draft` | covered |
| Search filters message list | `search filters the message list` | covered |
| Send with no account shows sign-in hint | `send with no account shows a sign-in hint, not a crash` | covered |
| No page errors | `no page errors` | covered |

### Gaps (untested)

- **Reply / Reply All / Forward flows** — compose dialog pre-fill for quoted body and subject prefixes is not asserted by any test.
- **Gmail saveDraft** — `saveDraft` implemented in Gmail adapter; no test assertion for it (only sendMessage is covered). Same for Graph and JMAP saveDraft.
- **Gmail getThread / Graph getThread / JMAP getThread** — all three adapters implement `getThread()`; no test exercises it.
- **Archive and delete UI actions** — `archive()` and `del()` methods wired to reader buttons; no UI-level test exercises them.
- **Star toggle** — `toggleStar()` wired to list row star button; not asserted.
- **Mark unread UI action** — `markUnread()` wired to reader button; not asserted.
- **Move (all adapters)** — `adapter.move()` implemented in all four adapters; no test exercises the UI path.
- **IMAP saveDraft (proxy `append`)** — implemented; not tested.
- **IMAP archive** — requires a mailbox with `role=archive`; not tested.
- **Keyboard shortcuts** — `_bindKeys()` handler is present; no test exercises j/k/r/a/f/e/#/u/c keyboard paths.
- **Mobile drawer toggle** — scrim + drawer-open class toggle implemented; no mobile test for mail (unlike calendar which has dedicated mobile assertions).
- **Empty-inbox zero-state** — when a real adapter returns zero messages the list shows "No messages." but no test verifies this state or the UX around it.
- **Attachment rendering in reader** — attachment list is built in `_renderMessage()`; no test opens a message with real attachments and checks the rendered list.
- **Pagination / load-more** — `_nextCursor` is tracked and count shown with `+`; no test exercises pagination.
- **MIME sanitize CSS url() blocking** — `sanitizeStyle` in sanitize.js handles CSS `url()` remote resources; not covered by the sanitizer test assertions.
- **`textToSafeHtml` autolink** — plain-text body conversion with URL autolinking is implemented; not covered.
- **Help overlay (`?`)** — keyboard shortcut help dialog implemented; not tested.

## Known issues

- **Empty inbox on first load** — no demo/seed data is wired into `mail.html`. Without a configured account the inbox always shows "No messages." There is no guidance in the UI for how to connect an account beyond the alpha badge. The zero-state copy is minimal (`"No messages."` in `_renderList()`).
- **No "load more" trigger** — pagination state (`_nextCursor`) is tracked and the count shows `+`, but there is no scroll-to-bottom or "Load more" button to fetch the next page.
- **Attachment download not implemented** — the reader lists attachment names and sizes but provides no download link or blob-fetch path.
- **IMAP requires an external proxy** — the adapter refuses honestly but there is no in-app setup UI for configuring a proxy URL.
- **Gmail saveDraft posts to `/drafts`** — implemented and plausible but untested against real or mocked servers.
- **getThread not surfaced in UI** — all three thread-capable adapters implement `getThread()` but the component never calls it; threading is declared as `capabilities().threads = true` for Gmail/Graph/JMAP but the UI renders individual messages only.
