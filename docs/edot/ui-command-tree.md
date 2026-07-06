# edot — UI & action/command structure (whole suite)

Derived from the code (June 2026): the shell (`magpie/edot/index.html`), each
app's command-registry contributions (`getRegistry().registerAll`), the per-app
menu builders, and the kernel capability surface (`capabilities.provide`). Three
layers stack: **UI surfaces** (what you see/click) → **commands** (named,
discoverable actions, one per app, gated by `when`) → **kernel capabilities**
(the programmatic action backbone apps call across each other).

```
edot
├── FRONT DOORS
│   ├── index.html  ……………………………… the suite (CANONICAL)
│   └── edot.html  ………………………………… standalone word processor
│         └── own CommandRegistry: doc.* (new/open/mydocs/close/find/replace/
│             viewsource/github), insert.* (link/semantic-RDFa), app.* (launch
│             data/slides/workspace/mail/calendar/maps/backup/login)
│
├── SHELL CHROME (index.html)
│   ├── App rail (left)  …… one button per app → go(id) / #hash
│   ├── Menu bar (per-app, adaptive)  …… TOP_ORDER: File · Edit · Insert · View · Actions · Help
│   │     └── "Actions" menu = auto-built from the active app's registry commands
│   ├── ⌘K Command palette  …… registry.search(app) over ALL commands (combobox/listbox ARIA)
│   ├── Status / loading region · doc-name
│   └── nav.<app> commands  …… "Go to <App>" for every app (group 0nav)
│
├── APPS  (rail entry → primary component → menus → commands → capabilities)
│   │
│   ├── 🧩 Workspace  (composite: Data + Slides + Editor panes over one kernel)
│   │     ├── menus: View(Open app) · Help
│   │     └── bridges data:share → slides.addData + editor.addData
│   │
│   ├── ✍️ Editor  (<edot-editor> + EditorHost)
│   │     ├── Title bar (document title)  ·  Formatting toolbar (WAI-ARIA)
│   │     │     └── toolbar groups: Bold/Italic/Underline/Strikethrough ·
│   │     │         Align L/C/R/Justify · Bullet/Number/Outdent/Indent ·
│   │     │         Quote/Code/Link/Image/RDFa · Undo/Redo/Clear · block-format ▾
│   │     ├── menus  (toolbar-parity)
│   │     │     ├── File: New document · Open… · My documents… · Save to… ·
│   │     │     │         View source… · Export ▸(docx/pdf/html/md/css/txt) · Close
│   │     │     ├── Edit: Undo · Redo · Find & replace… · Clear formatting
│   │     │     ├── Insert: Link · Image · RDFa tag · Bullet/Number list · Quote · Code
│   │     │     ├── Format: Bold/Italic/Underline/Strikethrough · Body/H1/H2/H3 ·
│   │     │     │           Align L/C/R/Justify · Increase/Decrease indent
│   │     │     └── View: Open app
│   │     ├── commands (all in ⌘K + Actions): editor.bold/italic/underline/strike/
│   │     │             clearFormat · h1/h2/h3/body · bulletList/numberList/blockquote/
│   │     │             code/indent/outdent · alignLeft/Center/Right/Justify ·
│   │     │             insertImage/insertLink/tagSemantic · undo/redo
│   │     ├── host dialogs: My documents (library+autosave) · Open(Examples/
│   │     │             Research/file/URL) · View source · Save to…(storage) · GitHub PR
│   │     ├── provides: editor.addData
│   │     └── consumes: connections.list · storage.source  (Save to… any mount)
│   │
│   ├── ▦ Data  (<edot-data>, MS-Access-style)
│   │     ├── menus: File(Import · Export SQLite/CSVs/N-Quads) · View(SQL workbench ·
│   │     │         New spreadsheet · New table · Load sample) · Help
│   │     ├── commands: data.openFile · loadSample · newFolder · newSheet ·
│   │     │             newTable · writeSQL · exportSqlite/exportCsvs/exportNquads
│   │     ├── provides: data.addTable
│   │     └── publishes: data:share
│   │
│   ├── ▤ Slides  (<edot-slides>)
│   │     ├── menus: File(New deck · Open · Samples · Import · Export ▸
│   │     │         edeck/pptx/odp/pdf/html/png) · View · Help
│   │     ├── commands: slides.addSlide · present · shareToGroup ·
│   │     │             insertRect/insertEllipse/insertImage ·
│   │     │             rotate · bringToFront/sendToBack · deleteElement
│   │     ├── provides: slides.addData
│   │     └── consumes: groups.share  (Share deck to group)
│   │
│   ├── 📅 Calendar  (<edot-calendar>)
│   │     ├── menus: View(Open app) · Help + Actions(from registry)
│   │     ├── commands: calendar.newEvent · today · viewMonth/Week/Day/Agenda ·
│   │     │             newCalendar · browse · import(.ics) · subscribe(ICS URL)
│   │     ├── registers: local-calendar account → Connections (calendar capability)
│   │     └── consumes: groups.share (share calendar) · data.addTable (events→table)
│   │
│   ├── ✉️ Mail  (<edot-mail>)
│   │     ├── menus: View · Help + Actions
│   │     ├── commands: mail.compose
│   │     └── registers: mail:<account> → Connections (mail capability) on setAdapter
│   │
│   ├── 🗺️ Maps  (<edot-maps>, MapLibre)
│   │     ├── menus: View · Help + Actions
│   │     ├── commands: maps.toggle3d · toggleBuildings · togglePins ·
│   │     │             directions · enterXr · shareToGroup · placesToTable
│   │     └── consumes: groups.share (share places) · data.addTable (places→table)
│   │
│   ├── 💬 Groups  (<edot-groups>, XMPP/MIX)
│   │     ├── menus: View · Help + Actions
│   │     ├── commands: groups.joinChannel · connect(server)
│   │     ├── provides: groups.share
│   │     └── registers: xmpp account → Connections (chat+people+calendar+storage)
│   │
│   ├── 🗂 Files  (<edot-files>)
│   │     ├── menus: View · Help
│   │     └── consumes: connections.list({storage}) · storage.source  (browse any mount)
│   │
│   ├── 🔌 Connections  (<edot-connections>)
│   │     ├── menus: View · Help
│   │     ├── UI: Signed-in identities · accounts (local/platform) · Add connection
│   │     │       (OPFS + GitHub connect for real; S3/WebDAV/Solid = honest TODO)
│   │     └── consumes: connections.list · connections.identities · storage.source
│   │
│   ├── ⤓ Backup  (<edot-backup>)
│   │     ├── menus: View · Help + Actions
│   │     └── commands: backup.backupNow · refresh
│   │
│   ├── ⚙ Automations  (<edot-automations>)
│   │     ├── menus: View · Help + Actions
│   │     ├── commands: automations.new · runSelected
│   │     └── consumes: command.run / invoke ANY capability (scripting bridge)
│   │
│   └── 📦 Projects  (<edot-projects>)
│         ├── menus: View · Help + Actions
│         ├── commands: projects.open(.zip) · save(.zip)
│         ├── consumes: project.snapshot
│         └── publishes: project:open  → shell hydrates Workspace (doc+data+deck)
│
├── KERNEL — action backbone (getKernel())
│   ├── capabilities (provide/invoke)
│   │     ├── command.run · command.list  ……………… run/list any command by id
│   │     ├── project.snapshot  …………………………………… capture live workspace → bundle
│   │     ├── connections.list · connections.capability ……… accounts + their adapters
│   │     ├── connections.identities · connections.activeIdentity … OIDC sign-ins
│   │     ├── storage.source  ………………………………………… a ResourceSource mount by id
│   │     ├── editor.addData · slides.addData · data.addTable … cross-pane data handoff
│   │     └── groups.share  ……………………………………………… post into the active MIX channel
│   └── bus (publish/subscribe)
│         ├── connections:changed  …… Connections/Files/UI re-render
│         ├── data:share  ………………………… Data → Editor + Slides panes
│         └── project:open  ……………………… Projects → Workspace hydration
│
├── IDENTITY / AUTH  (auth/)
│   ├── login.html  …… PKCE flow + OAuth callback handler
│   ├── AuthSession  …… multi-account OIDC store → feeds connections.identities
│   └── status: machinery complete + tested; NO provider client-id configured yet
│
└── STORAGE MODEL  (resource-source.js · connections.js)
    ├── ResourceSource mounts: OPFS(device) · LocalFs(File System Access) ·
    │     GitHub(Contents API, real) · backup-store bridge · Memory(test)
    └── Account = Identity × Provider × Capability(storage/mail/calendar/chat/
          people/vcs) × Resources(lazy/windowed)
```

## Reading guide

- **UI → command → capability** is the consistent spine. A toolbar button or menu
  item runs a **command** (discoverable in ⌘K and the Actions menu); a command's
  `run()` may invoke a **kernel capability**; capabilities are how apps act on
  one another without hard imports.
- **Commands** are per-app and `when`-gated (only the active app's show). Groups
  (the `group:` prefix like `1file`, `2view`) order them within menus/palette.
- **Bespoke File menus** (Editor/Data/Slides) override the generic
  View+Help+Actions; every other app gets an **Actions** menu generated from its
  registry commands — one source feeds both the menu and the palette.
- **Cross-app edges** worth noting: Data→(Editor,Slides) via `data:share`;
  Calendar/Maps/Slides→Groups via `groups.share`; Calendar/Maps→Data via
  `data.addTable`; Editor/Files→any storage via `storage.source`;
  Projects↔Workspace via `project.snapshot`/`project:open`; Automations→anything
  via `command.run`.
