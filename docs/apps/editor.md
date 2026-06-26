# Editor

The Editor is a browser-native rich-text document app built on a `contenteditable` surface (`editor.js`) wrapped by a WAI-ARIA formatting toolbar (`toolbar.js`), a local document library (IndexedDB via `library.js`), and the `<edot-editor>` custom element (`edot-editor.js`) that packages the whole thing for embedding. The app-level host (`edot-app.js`) adds the File menu, GitHub save-back (branch + pull-request flow), find/replace, command palette, drag-and-drop import, and a `BroadcastChannel` data-handoff path from the Data workspace. Documents are stored in sanitized HTML (the canonical format), round-tripped through `document-model.js`'s allowlist sanitizer, and exported to PDF, DOCX, Markdown, HTML, edot-native `.edoc`, plain text, CSS, and optionally ODT/RTF via LibreOffice WASM. RDFa Lite attributes (`property`, `typeof`, `vocab`, `resource`, `about`, `prefix`) survive all sanitization passes and HTML export, making the editor RDF-aware at the document level.

## Features

- **`contenteditable` editing surface** — `role=textbox`, `aria-multiline=true`, `dir=auto`, bidi per-paragraph (`unicode-bidi: plaintext`). [stable]
- **Formatting toolbar** — WAI-ARIA toolbar pattern: roving tabindex, Arrow/Home/End navigation, `aria-pressed` state for toggles. 21 controls (block select + 19 buttons + labels toggle). [stable]
- **Bold / Italic / Underline / Strikethrough** — execCommand-based toggles with keyboard shortcuts. Tag-based output (`<b>/<i>/<u>/<s>`), not CSS spans. [stable]
- **Paragraph alignment** — left / center / right / justify applied directly to block elements as `style="text-align:…"` (sanitizer-clean; survives DOCX and PDF). [stable]
- **Block format select** — Body text / Heading 1–3 via a `<select>` dropdown. [stable]
- **Bullet and numbered lists** — execCommand `insertUnorderedList` / `insertOrderedList` with toggle state. [stable]
- **Blockquote and Code block** — `formatBlock` toggle to `<blockquote>` / `<pre>`; auto-revert to `<p>` if already that block. [stable]
- **Indent / Outdent** — execCommand, no state indicator. [stable]
- **Undo / Redo** — browser-native via execCommand; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z. [stable]
- **Remove format** — `removeFormat` then `formatBlock('p')` to clear all inline and block styling. [stable]
- **Link insertion** (`createLink`) — prompts for URL via `window.prompt`; selection required; auto-adds `rel="noopener noreferrer"` and `target="_blank"` for http(s) links. [stable; requires selection — correctly shows error toast if nothing selected]
- **Image insertion** — file picker (`input[type=file]`, accept `image/*,.svg`); SVG kept as vector data URL, bitmaps downscaled to 1600px longest edge at 0.85 JPEG quality; inserted as `<img>` with `width` attribute. Max width capped to 640px in DOCX (not the bitmap itself). [stable]
- **RDFa semantic tagging** — `createSemantic` wraps selection in `<span property="…" typeof="…">`; prompts via `window.prompt`; requires non-collapsed selection. [stable]
- **Toolbar label toggle ("Aa")** — shows text labels under icons; persists preference to `localStorage['edot.toolbarLabels']`. [stable]
- **Long-press label bubble** — 500ms hold shows large readable tip bubble, clamped to viewport; clears on release. [stable]
- **Find & Replace** — `FindReplace` class; CSS Custom Highlight API for markers; match count (`n/N`), prev/next, replace-one, replace-all; Ctrl+F (find only) / Ctrl+H (with replace row); Esc closes. [stable]
- **Document library** — IndexedDB via `Library.create()`, listing/open/rename/duplicate/delete; autosave on 500ms debounce; word/char count status bar. [stable]
- **New / Close document** — always leaves an editing surface (creates a fresh doc if closing the last). [stable]
- **Import files** — drag-and-drop or file picker; formats: `.edoc`, `.txt`, `.md`, `.html`, `.docx`, `.odt`/`.doc`/`.rtf` (LibreOffice WASM when configured). [stable (native); partial (WASM — backend not configured by default)]
- **Export / download** — edoc, PDF, DOCX, Markdown, HTML, plain text, CSS (native); ODT, RTF (WASM-only, currently broken without backend). Exports are deterministic (sorted keys, zeroed zip timestamps). [stable (native formats); broken (WASM formats — NO_BACKEND)]
- **Open from URL** — smart-rewrites GitHub blob → raw, gist → raw, GitLab → raw; corsRisk flag; validation error shown inline. [stable]
- **Open examples / research** — tree dialog with Examples (expanded) and Research (collapsed) folders loaded from `docs/research/index.json`. [stable]
- **Save to GitHub** — branch + PR flow via `GitHubRemote`; diff preview; merge button; clipboard token harvest; recent locations (zappable); binary path rejected. [stable]
- **View source** — format picker (HTML / Markdown / plain text); copy to clipboard; line/char counts; RDFa warning when switching away from HTML. [stable]
- **Command palette** (Mod+K) — searches all registered commands by title/keywords/id; keyboard navigation; runs through `CommandRegistry.run()` audit choke point. [stable]
- **Paste sanitization** — strips scripts/styles/handlers; keeps safe HTML; converts plain text to `<p>` blocks; preserves RDFa; allows only `text-align` from style attributes. [stable]
- **Autosave / dirty state** — 500ms debounce; clean/dirty indicator; persists last-open doc id in localStorage. [stable]
- **Data workspace handoff** — receives `{type:'insert', title, html}` via `BroadcastChannel('edot')` or `localStorage['edot.handoff']` on cold start; inserts as `<h3>` + table. [stable]
- **`<edot-editor>` custom element** — embeddable multi-instance component; kernel capability `editor.addData` routes to focused instance; `edot-ready/edot-change/edot-selectionchange` events. [stable]
- **Keyboard shortcuts** — Ctrl+B/I/U (bold/italic/underline), Ctrl+Z/Y/Shift+Z (undo/redo), Ctrl+F/H/K/S/O/W/Shift+O (find/replace/palette/save/open/close/library). [stable]
- **Mobile shell** — locked app chrome (no body/html scroll); tap-on-margin focuses editor; toolbar min 36px tall. [stable]
- **RTL / bidi support** — `dir=auto` on surface; `unicode-bidi: plaintext` per block; all-RTL document sets surface direction to `rtl`. [stable]
- **Attention nudge** — swaps favicon and prefixes tab title when the GitHub dialog is open and the tab loses focus; restores on return. [stable]
- **Object index integration** — saved docs are indexed (id/type/title, no body) via kernel's object index for suite-wide search. [stable]
- **LibreOffice WASM bridge** — `libreoffice-bridge.js`; unconfigured by default (reports `NO_BACKEND`). [broken/untested in production — backend never configured]

## Side-effecting actions (command-registry inventory)

### Toolbar buttons (`toolbar.js` LAYOUT, `ICONS` map)

| Action | Trigger | Glyph | Effect | Proposed command id |
|---|---|---|---|---|
| Block format select | Toolbar `<select>` | — | Calls `setBlockFormat(value)` on selected block; announces style name | `format.block` |
| Bold | Toolbar button `data-cmd="bold"` | `B` | `execCommand('bold')` toggle; Ctrl+B | `format.bold` |
| Italic | Toolbar button `data-cmd="italic"` | `I` | `execCommand('italic')` toggle; Ctrl+I | `format.italic` |
| Underline | Toolbar button `data-cmd="underline"` | `U` | `execCommand('underline')` toggle; Ctrl+U | `format.underline` |
| Strikethrough | Toolbar button `data-cmd="strike"` | `S` | `execCommand('strikeThrough')` toggle | `format.strike` |
| Align left | Toolbar button `data-cmd="alignLeft"` | `≡` | `setAlign('left')` — removes `text-align` style | `format.alignLeft` |
| Align center | Toolbar button `data-cmd="alignCenter"` | `☰` | `setAlign('center')` | `format.alignCenter` |
| Align right | Toolbar button `data-cmd="alignRight"` | `≣` | `setAlign('right')` | `format.alignRight` |
| Justify | Toolbar button `data-cmd="alignJustify"` | `▤` | `setAlign('justify')` | `format.alignJustify` |
| Bulleted list | Toolbar button `data-cmd="bulletList"` | `•—` | `execCommand('insertUnorderedList')` toggle | `format.bulletList` |
| Numbered list | Toolbar button `data-cmd="numberList"` | `1.` | `execCommand('insertOrderedList')` toggle | `format.numberList` |
| Outdent | Toolbar button `data-cmd="outdent"` | `⇤` | `execCommand('outdent')` | `format.outdent` |
| Indent | Toolbar button `data-cmd="indent"` | `⇥` | `execCommand('indent')` | `format.indent` |
| Blockquote | Toolbar button `data-cmd="blockquote"` | `❝` | `formatBlock('blockquote')` toggle | `format.blockquote` |
| Code block | Toolbar button `data-cmd="code"` | `</>` | `formatBlock('pre')` toggle | `format.code` |
| Insert link | Toolbar button `data-cmd="link"` | `🔗` | `createLink(announce)` — prompts URL, wraps selection in `<a>`; requires non-collapsed selection | `insert.link` |
| Insert image | Toolbar button `data-cmd="image"` | `🖼` | Dispatches `edot-pick-image` event → triggers `<input type=file>` → `insertImageFile(file)` | `insert.image` |
| RDFa semantic tag | Toolbar button `data-cmd="semantic"` | `🏷️` | `createSemantic(announce)` — prompts property + typeof, wraps selection in `<span property="…">` | `insert.semantic` |
| Undo | Toolbar button `data-cmd="undo"` | `↶` | `execCommand('undo')`; Ctrl+Z | `format.undo` |
| Redo | Toolbar button `data-cmd="redo"` | `↷` | `execCommand('redo')`; Ctrl+Y / Ctrl+Shift+Z | `format.redo` |
| Remove format | Toolbar button `data-cmd="removeFormat"` | `⌫×` | `execCommand('removeFormat')` then `formatBlock('p')` | `format.removeFormat` |
| Labels toggle | Toolbar button `.labels-toggle` | `Aa` | Toggles `.labels` class on toolbar root; persists to `localStorage['edot.toolbarLabels']` | `view.toolbarLabels` |

### File menu items (`edot-app.js` `_wireMenu`, `mi-*` ids)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| New document | `#mi-new` → `doc.new` | `library.createDoc('Untitled document', …)` then `_loadDoc` | `doc.new` |
| Open… | `#mi-open` → `doc.open` | Opens tree dialog with Examples + Research folders | `doc.open` |
| My documents | `#mi-docs` → `doc.mydocs` | Opens `<dialog id="docs-dialog">` with library listing | `doc.mydocs` |
| Find & replace | `#mi-find` → `doc.replace` | `findReplace.open(true)` | `doc.replace` |
| View source | `#mi-source` → `doc.viewsource` | Opens source dialog with format picker | `doc.viewsource` |
| Save to GitHub | `#mi-github` → `doc.github` | Opens GitHub dialog with token harvest, diff preview, PR flow | `doc.github` |
| Close document | `#mi-close` → `doc.close` | Saves current doc, creates fresh blank | `doc.close` |
| Export formats (dynamic) | `#export-list` buttons | `exportAs(ext)` → download Blob | `export.edoc`, `export.pdf`, `export.docx`, `export.md`, `export.html`, `export.txt`, `export.css`, `export.odt`\*, `export.rtf`\* |
| Open Data | `#mi-data` → `app.data` | `_launchApp('data/data.html')` in new tab | `app.data` |
| Open Slides | `#mi-slides` → `app.slides` | `_launchApp('slides/slides.html')` in new tab | `app.slides` |
| Open Workspace | `#mi-workspace` → `app.workspace` | `_launchApp('workspace.html')` in new tab | `app.workspace` |
| Open Mail | `#mi-mail` → `app.mail` | `_launchApp('mail/mail.html')` in new tab | `app.mail` |
| Open Calendar | `#mi-calendar` → `app.calendar` | `_launchApp('calendar/calendar.html')` in new tab | `app.calendar` |
| Open Maps | `#mi-maps` → `app.maps` | `_launchApp('maps/maps.html')` in new tab | `app.maps` |
| Sign in (OIDC) | `#mi-login` → `app.login` | `_launchApp('auth/login.html')` in new tab | `app.login` |
| Encrypted backup | `#mi-backup` → `app.backup` | `_launchApp('backup/backup.html')` in new tab | `app.backup` |

\* ODT/RTF require LibreOffice WASM backend (currently unconfigured).

### Library dialog actions (`_docRow` in `edot-app.js`)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Open document | `.doc-open` button click | `library.getDoc(id)` then `_loadDoc(doc)` | `doc.open.id` |
| Rename document | `✏️` icon button | `window.prompt` → `library.saveDoc` | `doc.rename` |
| Duplicate document | `⧉` icon button | `library.createDoc(title + ' (copy)', html)` | `doc.duplicate` |
| Delete document | `🗑️` icon button | `window.confirm` → `library.deleteDoc(id)` | `doc.delete` |
| New document (from dialog) | `#docs-new` button | `newDocument()` | `doc.new` |

### GitHub dialog actions (`_wireGithubDialog`, `edot-app.js`)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| Preview diff | `#gh-preview` | Fetches remote file, diffs, renders diff rows | `github.preview` |
| Commit (PR) | `#gh-commit` | `commitViaPullRequest` → branch + PUT + PR | `github.commit` |
| Merge PR | `#gh-merge` | `remote.mergePull` (squash); shown only after PR | `github.merge` |
| Connect (save token) | `#gh-connect` | `remote.me()` → stores login in localStorage/sessionStorage | `github.connect` |
| Disconnect | `.gh-link` (Disconnect button) | Clears `edot.gh.token` and `edot.gh.login` from storage | `github.disconnect` |
| Delete recent location | `.gh-recent-del` | Removes one entry from `localStorage['edot.gh.recents']` | `github.recent.delete` |
| Clear recent history | "Clear history" button | Empties `localStorage['edot.gh.recents']` | `github.recents.clear` |
| Use recent location | `.gh-recent-use` | Fills repo/branch/path fields | `github.recent.use` |

### Public API methods on `<edot-editor>` (`edot-editor.js`)

| Action | Trigger | Effect | Proposed command id |
|---|---|---|---|
| `setContent(html)` | API / `.content=` setter | Sanitizes + normalizes HTML, sets `_dirty=false` | `editor.setContent` |
| `insertHtml(html)` | API | Sanitizes + inserts at caret or appends; fires `edot-change` | `editor.insertHtml` |
| `insertData(columns, rows, title)` | API / kernel capability `editor.addData` | Builds `<table>` (+ `<h3>` if title) and calls `insertHtml` | `editor.insertData` |
| `insertImageFile(file)` | API / file input change / `edot-pick-image` event | `prepareImage` → downscale/SVG → `insertHtml('<img>')`, fires `edot-change` | `editor.insertImage` |
| `exec(commandId)` | API / host menus | Focuses editor, runs `COMMANDS[id].exec()`, calls `onChange`, refreshes toolbar | `editor.exec` |
| `setBlock(tag)` | API / host menus | `setBlockFormat(tag)` then `onChange` + toolbar refresh | `editor.setBlock` |
| `align(value)` | API / host menus | `setAlign(value)` then `onChange` + toolbar refresh | `editor.align` |
| `createLink()` | API | Focuses editor, calls `cmdCreateLink(announce)`, then `onChange` | `editor.createLink` |
| `focus()` | API | `editor.el.focus()` | `editor.focus` |
| `focusEnd()` | API | Moves caret to end of content | `editor.focusEnd` |
| `markClean()` | API | Sets `_dirty = false` | `editor.markClean` |
| `pickImage()` | API | Clicks `_imgInput` to trigger file picker | `editor.pickImage` |

### Kernel capability

| Capability | Provider | Consumer | Effect |
|---|---|---|---|
| `editor.addData` | `edot-editor.js` `wireCapabilityOnce()` (registered once, routes to focused instance) | Data workspace / other suite apps | Calls `target.insertData(columns, rows, title)` on the most-recently-focused `<edot-editor>` |

### Global keyboard shortcuts (not toolbar-triggered)

| Shortcut | Effect |
|---|---|
| Ctrl+K / Ctrl+Shift+P | Opens command palette |
| Ctrl+S | `exportAs(lastExportExt)` |
| Ctrl+O | Triggers file input |
| Ctrl+Shift+O | Opens library dialog |
| Ctrl+W | `closeDocument()` |
| Ctrl+F | `findReplace.open(false)` |
| Ctrl+H | `findReplace.open(true)` |

## User journeys

1. **Write a formatted note and save locally**
   1. App loads; editor focused on the last-open document (or a welcome doc).
   2. User clicks the title field (`#doc-title`) and types a name (e.g. "Meeting notes"). Autosave begins 500ms later.
   3. User clicks in the editor body and types. Word/char counts update on each `input` event.
   4. User selects a heading from the block-format `<select>` ("Heading 2"); the current block becomes `<h2>`.
   5. User selects text and clicks `B` (bold); toolbar `aria-pressed` flips to `true`; the selection wraps in `<b>`.
   6. 500ms after the last keystroke autosave runs silently; "Editing…" indicator clears.

2. **Export the document as a Word file**
   1. User clicks the File menu button (`#menu-button`); menu panel opens.
   2. User clicks "Save as Word (.docx)"; `_runCmd('export.docx')` fires through `CommandRegistry.run()`.
   3. `exportAs('docx')` calls `IO.exportDocument(html, title, 'docx')` → `htmlToDocx` → Blob.
   4. `IO.downloadBlob(blob, 'meeting-notes.docx')` triggers browser download dialog.
   5. File is byte-deterministic (zeroed zip timestamps, sorted JSON keys).

3. **Insert an image from a local file**
   1. User clicks the `🖼` (image) toolbar button.
   2. Toolbar dispatches `edot-pick-image` event; `<edot-editor>` (or `edot-app.js`) triggers `_imgInput.click()`.
   3. User picks `photo.jpg` from the file picker.
   4. `insertImageFile(file)` calls `prepareImage(file)` — if the image is wider than 1600px, it is downscaled on a `<canvas>` to JPEG at 0.85 quality.
   5. `editor.insertHtml('<img src="data:image/jpeg;base64,…" alt="photo.jpg" width="640">')` is called; image appears inline in the document flow.

4. **Find and replace text**
   1. User presses Ctrl+H (or File ▸ Find & replace).
   2. `findReplace.open(true)` makes `.find-bar` visible with the replace row shown.
   3. User types "foo" in the find input; `search()` builds DOM Ranges, highlights via CSS Custom Highlight API, count shows "1/3".
   4. User presses Enter to step to next match; types "bar" in replace input.
   5. User clicks "All"; `replaceAll()` iterates ranges last-to-first, inserts text nodes, calls `editor.onChange()`. Count resets to "0/0".
   6. User presses Escape; bar hides, editor refocused.

5. **Save to GitHub via pull request**
   1. User clicks File ▸ "Save to GitHub…"; `openGithubDialog()` opens.
   2. `_harvestToken()` auto-fills a GitHub PAT from the clipboard if found.
   3. User fills "owner/repo" in `#gh-repo`; on `blur`, `_ghDetectBranch()` fetches the repo's default branch and fills `#gh-branch`.
   4. User clicks "Preview"; `_githubPreview()` fetches the remote file, diffs it with `diffLines`, renders rows in `#gh-diff` and a `+N −M` stat.
   5. User clicks "Commit"; `commitViaPullRequest` creates a branch, PUTs the file, opens a PR; PR link appears in `#gh-result`.
   6. "Merge" button appears; user clicks it; `_githubMerge()` polls `mergeable`, merges with squash, shows "Merged ✓ #N".

6. **Receive shared data from the Data app**
   1. User works in the Data app and clicks "Send to Editor"; Data app posts `{type:'insert', title:'Query result', html:'<table>…</table>'}` to `BroadcastChannel('edot')` and writes the same to `localStorage['edot.handoff']`.
   2. Live Editor tab receives the `message` event; `_insertHandoff({title, html})` calls `editor.insertHtml('<h3>Query result</h3><table>…</table>')`.
   3. Cold-start path: on next Editor load, `_consumeHandoff()` reads and clears `localStorage['edot.handoff']`, then calls `_insertHandoff`.
   4. The inserted table appears at the caret position (or end of document). Toast announces "Inserted from the data workspace".
   5. `edot-change` fires; autosave schedules.

## Test coverage

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| App boots / toolbar present | `test-edot.mjs::"app boots"`, `"toolbar has buttons"`, `"roving tabindex: one tab stop"`, `"editor is contenteditable textbox"` | covered |
| Bold formatting + tag output | `test-e2e.mjs::"bold button pressed"`, `"bold uses a tag, not a styled span"` | covered |
| Alignment | `test-e2e.mjs::"align-center button pressed"`, `"editor block is centered"` | covered |
| Find & replace | `test-edot.mjs::"find locates all matches"`, `"replace all replaces every match"`, `test-e2e.mjs::"find bar is visible"`, `"find shows 1/2 count"`, `"find bar closes on Escape"` | covered |
| DOCX round-trip (import/export) | `test-edot.mjs::"docx blob is non-trivial"`, `"docx -> html keeps heading"`, … (7 assertions), `"docx import renders a table"`, `"docx export+import preserves a table"` | covered |
| Markdown round-trip | `test-edot.mjs::"markdown -> html has h1"`, `"markdown -> html has strong/em/code"`, `"html -> markdown preserves heading"`, `"html -> markdown preserves bold"`, `"markdown export emits a GFM table"` | covered |
| PDF export | `test-edot.mjs::"pdf starts with %PDF-"`, `"pdf ends with EOF"`, `"pdf has xref + multiple pages"`, `"pdf is substantial"` | covered |
| edoc export + round-trip | `test-e2e.mjs::"edoc download filename ends .edoc"`, `"edoc envelope is a doc with body.html"`, `"edoc carries a 64-hex content fingerprint"`, `"edoc id matches the live document id"`, `"edoc bytes are deterministic (sorted keys)"`, `"reimported .edoc restores the document text"` | covered |
| Export determinism | `test-e2e.mjs::"${label} export is deterministic (byte-identical re-export)"` (edoc/docx/pdf) | covered |
| Document library / autosave | `test-edot.mjs::"library persists docs across reload"`, `"library reports a backend kind"`, `test-e2e.mjs::"library lists >=2 docs"`, `"reopened doc restores text"`, `"reopened doc kept bold tag"`, `"title field shows reopened name"` | covered |
| New / close document | `test-e2e.mjs::"new doc resets word count"`, `"close yields an empty document"`, `"close titles it Untitled"` | covered |
| Open from URL + validation | `test-e2e.mjs::"url dialog opens"`, `"url dialog shows a validation error"` | covered |
| Open examples tree | `test-e2e.mjs::"Open dialog lists the Morton example under Examples"`, `"Open dialog has a Research folder"`, `"Research folder is collapsed initially"`, `"Research folder expands to the deep-dive report"`, `"research markdown loads into the editor"`, `"GFM tables render as real tables"` | covered |
| GitHub save-back flow | `test-e2e.mjs::"github dialog opens"`, `"token auto-harvested from clipboard"`, `"default path is folder-encapsulated"`, `"default branch auto-detected from repo"`, `"bare filename wrapped into a folder"`, `"github preview renders a diff"`, `"github diffstat shows counts"`, `"github commit opens a PR link"`, `"merge button appears after PR"`, `"PR merges when conflict-free"` | covered |
| GitHub token persistence + disconnect | `test-e2e.mjs::"connected identity shows @login"`, `"File menu shows the attached account"`, `"token saved on device"`, `"disconnect clears the saved token"`, `"disconnect resets the menu hint"`, `"github rejects binary save-back"` | covered |
| Recent save locations | `test-e2e.mjs::"save location cached"`, `"recents render in the dialog"`, `"a cached location can be zapped"` | covered |
| View source dialog | `test-e2e.mjs::"source dialog opens"`, `"HTML source keeps RDFa + link"`, `"Markdown source keeps the link but drops RDFa"`, `"Plain text strips markup and links"` | covered |
| Sanitizer | `test-edot.mjs::"sanitizer removes scripts"`, `"sanitizer keeps content"`, `"sanitize keeps text-align only"`, `"sanitizer keeps table + colspan"`, `"sanitizer keeps data:image but drops handlers + data:text/html"`, `"rdfa property survives sanitize"`, `"rdfa sanitize still drops handlers"` | covered |
| RDFa / HTML export semantics | `test-edot.mjs::"rdfa property survives sanitize"`, `"html export declares vocab + prefixes"` | covered |
| Command palette | `test-e2e.mjs::"palette opens on Mod+K"`, `"palette lists commands"`, `"palette filters to a match"`, `"palette runs the command (new doc)"`, `"palette closed after running"`, `"palette closes on Escape"` | covered |
| Registry owns all export formats | `test-e2e.mjs::"registry owns every export format"` | covered |
| Audit choke point (run()) | `test-e2e.mjs::"File-menu action flows through run() (audit fired)"` | covered |
| Object index integration | `test-e2e.mjs::"saved doc is recorded in the object index"`, `"index search finds the doc by title"`, `"index never stores the document body"` | covered |
| Toolbar long-press labels | `test-e2e.mjs::"long-press shows a readable label bubble"`, `"held control grows (holding class)"`, `"label bubble stays on-screen"`, `"grow clears on release"`, `"Labels mode shows text under icons"`, `"Labels preference persists"` | covered |
| Data handoff (BroadcastChannel/localStorage) | `test-e2e.mjs::"data handoff inserts a table into the doc"`, `"handoff is consumed (cleared)"`, `test-workspace.mjs::"data share lands in the editor pane as one titled table"` | covered |
| Multi-instance `<edot-editor>` | `test-editor-component.mjs::"two editors, no duplicate element ids across instances"`, `"each editor has its own toolbar and a unique page id"` | covered |
| `content` property get/set | `test-editor-component.mjs::"content property get/set round-trips"` | covered |
| `stats()` | `test-editor-component.mjs::"stats() reflects content"` | covered |
| `readOnly` attribute | `test-editor-component.mjs::"readonly config disables editing on A only"` | covered |
| `exec/setBlock/align` host API | `test-editor-component.mjs::"host menu setBlock(h1) applied to A"`, `"host menu align(center) applied to A"`, `"editor B was NOT affected by commands run on A"` | covered |
| `edot-change` event | `test-editor-component.mjs::"edot-change event fired the host dirty dot"` | covered |
| Kernel routing (`editor.addData`) | `test-editor-component.mjs::"data share routed to the focused editor (B)"`, `"the unfocused editor (A) did not receive the share"`, `"after focusing A, the next share routes to A"` | covered |
| Image import (bitmap downscale + SVG) | `test-editor-component.mjs::"editor inserts an image as a data URL (survives the sanitizer)"`, `"editor downscales a large bitmap on import"`, `"editor keeps an imported SVG as vector"` | covered |
| Mobile: toolbar height + tap-to-focus | `test-mobile.mjs::"toolbar has its buttons"`, `"toolbar is not crushed (>=36px tall)"`, `"tap on page focuses the editor"`, `"tap on margin focuses the editor"`, `"typing after tap reaches the editor"` | covered |
| Mobile: File menu + app shell scroll lock | `test-mobile.mjs::"File menu opens on tap"`, `"menu button reports expanded"`, `"a Save-as item is visible"`, `"menu item action fired"`, `"html overflow hidden"`, `"body overflow hidden"`, `"document overscroll is none"`, `"scroll region contains overscroll"`, `"body itself does not scroll"` | covered |
| RTL / bidi | `test-e2e.mjs::"editor blocks use per-paragraph bidi (unicode-bidi: plaintext)"`, `"an all-RTL document resolves the surface to rtl"` | covered |
| Alignment in DOCX / PDF | `test-edot.mjs::"docx emits w:jc center+right+both"`, `"docx import restores alignment"`, `"pdf with alignment renders"` | covered |
| Word count | `test-edot.mjs::"word count reflects content"`, `test-e2e.mjs::"typed text shows word count"` | covered |
| Destroy + reinstantiate (no DOM leak) | `test-edot.mjs::"destroy()+reinstantiate does not leak DOM"` | covered |
| Attention nudge | `test-edot.mjs::"attention swaps favicon while away"`, `"attention nudges the title while away"`, `"attention restores title + disarms on return (once)"` | covered |
| LibreOffice bridge (unconfigured) | `test-edot.mjs::"LibreOffice reports unconfigured"` | covered |
| URL resolution (git hosting rewrites) | `test-edot.mjs::"github blob -> raw.githubusercontent"`, `"gist -> gist raw"`, `"gitlab blob -> raw"`, `"bitbucket src -> raw"`, `"plain cross-origin url flagged corsRisk"`, `"invalid url throws"` | covered |
| Git remote + PR API calls | `test-edot.mjs::"git base64 round-trips unicode (incl. astral)"`, `"git PUT commits decoded content"`, `"git PUT uses existing sha + new branch"`, `"git creates branch ref off base"`, `"git PR head=branch, base=main"`, `"git authorizes with bearer token"`, `"git returns the PR number"` | covered |
| Symbol-font DOCX import (∀∃ etc.) | `test-edot.mjs::"docx Symbol-font run imports ∀ (not a square)"`, `"symbol PUA decodes to logic glyphs"`, `"symbol-font byte range decodes ∀∃⊃"` | covered |
| Diff engine | `test-edot.mjs::"diff counts edits + additions"`, `"diff collapses unchanged runs into gaps"` | covered |
| exportText / text format check | `test-edot.mjs::"exportText returns source-format markdown"`, `"exportText blocks binary formats"` | covered |
| Shell integration (Editor menu) | `test-shell.mjs::"Editor shows File / Edit / Insert / View / Help"`, `"Editor menu action works (View → Heading 1)"` | covered |
| Workspace pane (editor in multi-pane) | `test-workspace.mjs::"editor pane built its formatting toolbar"`, `"editor.getContent() returns the inserted document"` | covered |

### Gaps (untested)

The following features have no corresponding assertion in `test-coverage.json` for any of the four editor test suites:

- **Link insertion (create/edit)**: `createLink` is listed in the toolbar and command registry but no test asserts that clicking the link button actually creates an `<a>` element in the DOM, that the error toast fires on a collapsed selection, or that `rel="noopener noreferrer"` is added. (`test-e2e.mjs` uses a link in view-source setup but does not test the insertion action itself.)
- **Outdent / Indent toolbar buttons**: No test asserts these buttons change list indentation or DOM structure.
- **Strikethrough toolbar button**: No test clicks `data-cmd="strike"` or checks for `<s>` / `<strike>` output.
- **Blockquote toolbar button**: No test clicks the `❝` button (DOCX blockquote tests work through the module API, not the toolbar).
- **Code block toolbar button**: No test clicks `</>` and checks for `<pre>`.
- **RDFa semantic tagging via toolbar**: No test clicks the `🏷️` button, provides a property, and verifies the resulting `<span property="…">`.
- **Remove format toolbar button**: No test clicks `⌫×` and verifies that inline formatting is stripped and block is reverted to `<p>`.
- **Block format select → Heading 3**: `BLOCK_FORMATS` includes h3; no test sets it via the toolbar select.
- **File import via file picker**: `openFile()` and the `fileInput` change handler are exercised indirectly (`.edoc` re-import in e2e and drag-drop path), but no test clicks `#open-from-file` in the Open dialog or uses `fileInput.click()` directly.
- **Drag-and-drop file import**: `_wireDragDrop` wires a `drop` listener; no test simulates a file drop.
- **`edot-ready` event**: Dispatched by `<edot-editor>` on `connectedCallback`; no test asserts it fires.
- **`edot-selectionchange` event**: Dispatched on selection change; no test asserts it fires.
- **`focusEnd()` API**: Called by margin-tap handler; no test calls it directly through the component API.
- **`markClean()` API**: Exposed on the component; no test asserts it resets the dirty flag.
- **`commandState(commandId)` API**: Exported by `<edot-editor>`; no test calls it.
- **`currentBlock()` / `currentAlign()` APIs**: Exposed on `<edot-editor>`; no test calls them.
- **`notoolbar` attribute**: Suppresses toolbar rendering; no test uses it.
- **`spellcheck` attribute**: Wired to `editorEl.spellcheck`; no test toggles it via attribute.
- **`placeholder` attribute**: Wired to `data-placeholder`; no test reads the placeholder text.
- **Library dialog: rename document**: No test exercises the `✏️` rename button.
- **Library dialog: duplicate document**: No test exercises the `⧉` duplicate button.
- **Library dialog: delete document**: No test exercises the `🗑️` delete button.
- **GitHub "Clear history"**: No test clicks the "Clear history" button in the recents list.
- **GitHub "Use recent location"**: No test clicks `.gh-recent-use`.
- **GitHub attention nudge (arm/disarm on dialog open/close)**: Attention-on-return is tested in `test-edot.mjs` at the module level but not through the GitHub dialog UI path.
- **View source "Copy" button**: `#src-copy` calls `navigator.clipboard.writeText`; no test clicks it.
- **LibreOffice WASM export (ODT/RTF)**: Registered in the export menu and registry (`export.odt`, `export.rtf`) but no test exercises them (backend never configured; `LO.isConfigured()` is always false in tests).
- **`createLink()` component API method**: Exposed on `<edot-editor>`; no test calls it through the component.
- **`insertHtml()` component API method**: No test calls this directly (handoff test goes through `insertData`).

## Known issues

- **Link insertion via toolbar**: The `createLink` function (`commands.js:126`) uses `window.prompt` for URL input. `window.prompt` is blocked in many sandboxed environments (CSP `sandbox` attribute, cross-origin iframes) and cannot be tested reliably in Playwright without mocking. No test verifies the actual DOM outcome of clicking the link button. The UX review note that "link insertion was reported broken" is not directly reflected in a code defect, but the reliance on `window.prompt` is fragile.
- **RDFa semantic tagging**: Also uses `window.prompt` for both the property name and `typeof` inputs (`commands.js:107–109`), with the same testability and sandbox limitations as link insertion.
- **LibreOffice WASM formats (ODT, RTF)**: `LO.isConfigured()` returns false in all tests (`test-edot.mjs::"LibreOffice reports unconfigured"`). The `export.odt` and `export.rtf` commands exist in the registry and appear in the File menu but produce an error toast in any environment without the backend. These are effectively broken for end users.
- **Find & Replace — CSS Custom Highlight API fallback**: `HAS_HIGHLIGHT` (`find-replace.js:9`) uses the CSS Custom Highlight API; when unavailable, the fallback selects the range via `window.getSelection()` which moves the editing caret. No test exercises this fallback path.
- **`SPAN` attribute stripping in sanitizer**: `ALLOWED_ATTR.SPAN = []` (`document-model.js:23`) strips all attributes from `<span>` elements, but RDFa attributes on `<span>` are preserved because `RDFA_ATTR` is checked first in the loop (`document-model.js:73`). This interaction is correct but subtle and the only surviving attributes on `<span>` are the RDFa ones.
- **`block.p` / `block.h1` / `block.h2` / `block.h3` commands in registry**: These are registered via `BLOCK_FORMATS` loop (`edot-app.js:865–867`) but call `setBlockFormat(value)` without checking whether the selection is inside a contenteditable — if the palette runs these with no editor focus, they silently no-op.
- **`format.*` commands in registry**: The loop at `edot-app.js:862–864` registers `format.bold`, `format.italic`, etc. as calling `c.exec()` directly (not through the component's `exec()` method), so toolbar refresh does not happen when these are run from the palette.
- **Source-code file references**: `magpie/edot/js/edot-editor.js` (EdotEditor component), `magpie/edot/js/editor.js` (core surface), `magpie/edot/js/toolbar.js` (toolbar + LAYOUT), `magpie/edot/js/commands.js` (COMMANDS registry), `magpie/edot/js/document-model.js` (sanitizer + normalize + stats), `magpie/edot/js/a11y.js` (Announcer), `magpie/edot/js/edot-app.js` (App host + command registry), `magpie/edot/js/find-replace.js` (FindReplace), `magpie/edot/js/io.js` (format registry), `magpie/edot/js/command-registry.js` (CommandRegistry).
