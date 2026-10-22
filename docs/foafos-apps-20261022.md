# foafos apps: what an app is, and the `# APP:` tag (design, 2026-10-22)

Status: design for review. Nothing in this note is built unless a line says so.
Read with: `docs/foafos-story-layering-20260730.md` (the layer model, and the owner
statement of 2026-10-22 on instances, singletons and haptics), `magpie/miniapps/README.md`
(what the W3C MiniApp drafts gave us), `docs/foafos-lws-20261021.md` (storage and identity).

## 1. The owner's direction

Owner, 2026-10-22, verbatim:

> "Ok stop and think time.
>
> We have found enough places where miniapps (an incomplete abandonware project) fails to
> meet foafos and fink needs.
>
> Let's reconceptualize: we need full Apps, safely sandboxed and interoperating, and with
> modern storage, accessibility, scripting etc capabilities. We should continue trying to
> use the bits of miniapps that fit but also allow foafos design ethic and requirements to
> freely overrule or change, eg for apps to have delegated capabilities, bus and rdf/sparql
> comms, headless modes etc as we see fit.
>
> But yes lets phase out MINIGAME: f)INK tag and just use "# APP: " as our preferred
> version. We may need the singleton mode for eg as media player. For jpegs, svgs, audio,
> or even those that come with their own app/player or format handler. In a way we are
> making something like a browser or desktop app but with the ui constraints from mobile
> and mobile web."

Decided by the owner: the target is full apps; MiniApp parts are used where they fit, and
the foafos design overrules them where it needs to; `# APP:` replaces `# MINIGAME:`; there is
a singleton mode. Everything else below is a proposal.

## 2. What a foafos app must be

Requirements, each with where it comes from.

| # | Requirement | Source |
|---|---|---|
| R1 | Sandboxed: an opaque origin, no ambient authority; every effect through a foafos broker | layer model, mediation invariant |
| R2 | Capabilities granted by attenuation (`grant(child) ⊆ grant(parent)`) and checked at the time of use | `packages/foafos/src/apptree.mjs` |
| R3 | Delegated capabilities: an app can pass a narrower capability to an app it opens or to a service it uses, and the delegation ends when it ends | owner, 2026-10-22 |
| R4 | Many instances of one app, each with its own state (three spreadsheets) | owner, 2026-10-22 |
| R5 | Singleton apps: one instance, shared by every app that needs it (a media player or playlist), reached through the bus | owner, 2026-10-22 |
| R6 | Format handlers: an app can declare the media types it opens (JPEG, SVG, audio, a playlist), and a resource that comes with its own player can name it | owner, 2026-10-22 |
| R7 | Bus communication, and RDF/SPARQL communication | owner, 2026-10-22 |
| R8 | Headless mode: an app that runs with no user interface, for services, agents, voice and tests | owner, 2026-10-22; layer model "The browser surface is an API" |
| R9 | Modern storage: per instance or per document, with LWS as the remote store and OIDC identity | owner, 2026-10-21; `docs/foafos-lws-20261021.md` |
| R10 | Accessibility as a contract: the accessibility tree is the one API for screen readers, voice and agents | layer model, "The browser surface is an API" |
| R11 | Mobile UI constraints: one app in view on a phone, back as history, touch targets, text size, reduced motion | owner, 2026-10-22; MiniApp runner UX work |
| R12 | Scripting: apps can be driven by scripts and agents through declared actions | owner, 2026-10-22 ("scripting etc capabilities") |

## 3. What we keep from the W3C MiniApp drafts, and what foafos overrules

| MiniApp part | Keep? | foafos change |
|---|---|---|
| Manifest: `app_id`, `name`, `short_name`, `version {code,name}`, `icons`, `lang`, `dir`, `description`, `color_scheme` | Keep | — |
| `req_permissions` with a `reason` | Keep the reason | The names are foafos capabilities, not `system.permission.*`; R2 and R3 decide the grant |
| `pages` and the page stack | Keep as optional | Many apps are one page; a page stack is for apps that need one |
| Package: a ZIP with the Packaging constraints | Keep as optional | A URL on the same site stays the default; the package is for offline use, installation and integrity |
| Signing block | Keep the slot | Signatures and integrity hashes are the trust work (`# INTEGRITY:` in the layer model) |
| Lifecycle: launched, shown, hidden, error, unloaded; page loaded, ready, shown, hidden, unloaded | Keep | Add `headless` (running with no view) and map the shell's suspend and resume to hidden and shown |
| Addressing: `scheme://miniapp/<id>;version=<v>/<path>` | Keep the parser | Use `foafos://app/<id>/<path>`; resource IRIs stay `https://` |
| Logic layer and view layer as two frames | Overrule | One frame by default; a separate logic layer is the headless mode (R8) |
| No bus, no inter-app protocol | Overrule | The foafos bus, verbs, and RDF messages (R7) |
| One instance per app | Overrule | `instances: many | single` (R4, R5) |
| No format handlers | Overrule | `handles` (R6) |

The Web App Manifest (W3C Working Draft, 2026-10-16, https://www.w3.org/TR/appmanifest/) is
the nearer standard for several of these. Two incubations that Chromium ships, and that are
not in that draft, describe R5 and R6:
- `launch_handler` with `client_mode: "focus-existing"`: a new launch goes to the open
  instance. MDN marks it experimental (https://developer.mozilla.org/docs/Web/Manifest/launch_handler).
- `file_handlers`: the media types and file extensions an app opens.

Proposal: the foafos app manifest uses the Web App Manifest member names where one exists,
the MiniApp names where only MiniApp has one, and foafos names for the rest.

## 4. The app manifest (proposal)

A JSON-LD document, so that the manifests themselves are RDF (R7) and Factoidal can check
them with SHACL. Owner rule, 2026-10-22: JSON-LD with an inline `@vocab` only, never a context
document ("they require a successful network fetch before parsing can suceed"). So each
manifest says `"@context": {"@vocab": "https://danbri.github.io/glitchcan-minigam/inklet/finkapp/apps/vocab#"}`,
and every member is an IRI in that vocabulary. The rows of `inklet/finkapp/foafos-apps.js` are the manifests in practice
today. The first step generates those rows from manifest files, so there is one source.

| Member | Meaning | From |
|---|---|---|
| `id`, `name`, `short_name`, `icons`, `version`, `lang`, `dir`, `description` | identity and labels | Web App Manifest / MiniApp |
| `start_url` or `package` | a same-site URL, or a ZIP package | Web App Manifest / MiniApp Packaging |
| `pages` | optional page routes | MiniApp |
| `surface` | `window`, `stage`, `panel`, `chrome`, or `none` (headless) | foafos registry |
| `instances` | `many` (the default) or `single` | foafos; `launch_handler` for the behaviour |
| `shows` | the presentations the app supports inside a story, most wanted first: `full`, `inline`, `icon` (section 10). The JSON keeps the order; the RDF view does not, because an inline `@vocab` context cannot declare a list container | foafos; the shape of `display_override` |
| `handles` | `[{ "accept": ["audio/mpeg", ".mp3"], "action": "play" }]` | `file_handlers`, extended with an action |
| `capabilities` | requested foafos capabilities, each with a `reason` | foafos + MiniApp `reason` |
| `delegates` | the capabilities this app may pass on, and to which roles | foafos (R3) |
| `bus` | topics published and subscribed, each with a JSON-LD type for the payload | foafos registry + R7 |
| `actions` | named operations for scripts, agents and voice: `play`, `queue`, `open`, `export` | R12; the edot command registry is the existing model |
| `storage` | `instance`, `document` or `app`: what the app's store is keyed by | R4, R9 |
| `headless` | the entry to run with no view, and which actions work there | R8 |
| `args` | launch keys a story may pass (today's registry `args`) | foafos registry |

## 5. Instances, singletons and format handlers

**Many instances (R4).** This already works for window apps: every `launchApp` spawns a new
node. What does not work is storage: every instance of an app shares one `FoafStore`
namespace. Proposal: a store key `<appId>/<instanceId>` for `storage: "instance"`, and
`<appId>/<documentIRI>` for `storage: "document"`. A document is then something the user
opens; three spreadsheets are three documents, possibly on an LWS storage.

**Singletons (R5).** For `instances: "single"`:
- A second launch does not start a second instance. foafos gives the launch to the open
  instance as an intent (`focus-existing`), and focuses it only if the launch came from the
  user.
- The singleton's lifetime is its own. A story that uses the media player does not own it,
  and closing the story does not close the player.
- It offers its service on the bus under its own topics: `media.queue`, `media.play`,
  `media.state`.
- Who may control it is a delegated capability (R3). A story may add to the queue for its
  own session; it may not clear the whole queue unless the reader allows that.
- Sound still goes through the foafos audio broker, so master volume and ducking stay in one
  place.

The owner's example: three spreadsheets and two stories are open. Both stories send
`media.queue` with a playlist (`application/vnd.fink.playlist+json`, already named in
`docs/fink-spec-v1.md`). The one player plays them in turn, and the bus reports
`media.state` to every app that subscribes.

**Format handlers (R6).** foafos keeps a table from media type to handler apps, built from
`handles` in the manifests. To open a resource:
1. A resource that names its own player (a package, or a typed block that names an app)
   uses that player, if the user allows it.
2. Otherwise the user's chosen default handler for the media type.
3. Otherwise the only handler, or a choice among several.
4. Otherwise the resource is downloaded.

Inline story media (`# IMAGE:`, `# AUDIO:`, `# VIDEO:`) stays inline. A handler is used when
the story or the reader asks for one, for example by opening an image full screen.

## 6. The `# APP:` tag (replaces `# MINIGAME:`)

Grammar, the same as `# MINIGAME:` today, so that the runner's existing `gameTag()` split
works unchanged:

    # APP: <app-id or resource> [key=value ...]

What the story does while the app runs comes from the app's manifest, and the tag can
override it with `then=`:

| Manifest | Default `then` | Story behaviour | Today's tag |
|---|---|---|---|
| the app returns a result (a game) | `wait` | the story pauses and resumes with the result (`game_success`, `game_score`, written VARs) | `# MINIGAME:` |
| the app shows the story's world | `beside` | the story goes on; tags and VARs flow as `# WORLD:` does now | `# WORLD:` |
| `instances: "single"` (a service) | `go` | the story sends the intent (for example `play`) and goes on | — |

Examples:

    # APP: gridluck                           (waits, as # MINIGAME: gridluck did)
    # APP: robbin mode=hampstead controls=dpad
    # APP: player then=go play=/glitchcan-minigam/media/bed.mp3
    # APP: drift then=beside tale=peraspera

Proposal for `# WORLD:`: keep it as an alias of `# APP: <app> then=beside`, because the
word says what it does. This is a question for the owner (section 9).

Phasing out `# MINIGAME:`:
1. The story runner accepts `APP` wherever it accepts `MINIGAME` (`storyrunner.js:218`, and
   `RUNNER_TAGS` at :793). The shell verb `story.launch` stays; `then` decides how the
   runner waits.
2. The tools that read the tag learn `APP`: `inklet/tools/fink-graph.mjs`,
   `fink-minigame-map.mjs` and `fink-universe.mjs`, and `inklet/finkapp/fink-config.js`.
   `npm run fink:check` (`inklet/tools/fink-check.mjs`) does not read the tag today; it gets
   a deprecation warning for `# MINIGAME:`.
3. The 14 story files that use `# MINIGAME:` move to `# APP:` by hand edits, one file at a
   time, each checked with `npm run fink:check`. They are not rewritten by a script: a regex
   over ink source is the hackparsing that CLAUDE.md forbids. The files (2026-10-22):
   `inklet/`: toc, hampstead, mudslidemines, shane-manor, skydock, world-between-worlds;
   `inklet/demos/`: diamond-cave, foafos-tour, hamfink2026-ch2;
   `inklet/apps/storyrunner/`: demo, peer (test fixtures);
   `drift-city/`: foafos-entry, novel/cellar-entry, story/peraspera.
4. The `glitchcanary` and `fink` skills and `docs/fink-spec-v1.md` say `# APP:`, and keep
   one line on `# MINIGAME:` as the old name.
5. When no file uses `# MINIGAME:`, the validator reports it as an error. The runner keeps
   reading it for old stories on other sites.

## 7. Delegated capabilities, communication, headless mode

**Delegation (R3).** Today a capability moves only down the tree, at spawn. Proposal: an app
may also hand a narrower capability to another node, through foafos, for example "this
story may add to the media queue". foafos records it in the app tree (who gave what to whom),
and it ends when the giver closes or takes it back. Only capabilities listed in the giver's
`delegates` can be passed on. This is the object-capability model the app tree already
follows, extended from parent→child to app→service.

**Communication (R7).** Three levels:
1. The bus, as now: JSON events on topics, scoped per app (`bus: {publish, subscribe}`).
2. Typed payloads: each topic names a JSON-LD type, so an event is also RDF. A playlist on
   the bus is the same `application/vnd.fink.playlist+json` that a FINK typed block carries.
3. A shared graph: foafos keeps an RDF graph of the installation (the app tree, the open
   documents, the declared actions and handlers). An app with `graph:read` can ask it a
   SPARQL query through Factoidal (`@factoidal/core`, per CLAUDE.md "Factoidal first").
   Writes go through verbs, never straight into the graph.

**Headless mode (R8).** An app with a `headless` entry runs with `surface: "none"`, with no
frame in view. It serves its `actions` to scripts, agents and voice, and the same actions
are what its view calls. A singleton media player is the first case: the player runs
headless, and its view is opened only when the reader asks for it. Tests and the project MCP
server (`tools/game-mcp/`) drive apps the same way.

## 8. The user interface on phones (R10, R11)

- A phone shows one app at a time, as a stack with history; Back is the browser's Back. A
  tablet may show two side by side; a desktop has windows. foafos chooses; apps do not.
- The MiniApp runner's work carries over to the shell: titles, breadcrumbs, announcements,
  focus rules, text size, colours, reduced motion, the permission sheet with the app's own
  reasons, plain messages for failures, and 44×44 px targets (`magpie/miniapps/README.md`,
  "Usability and accessibility beyond the standards"; `test/ux.mjs` checks each).
- A singleton player has a small persistent control (the "now playing" bar), named and
  reachable by keyboard and voice. It is a chrome surface of the player, not part of any
  story.

## 9. Order of work, and the questions for the owner

State, 2026-10-22 (owner: "Step 1 then 2"):
- Step 1 is built. The story runner reads `# APP:` with `then=wait|beside|go` (`go` is
  refused until service apps exist); `fink:check`, `fink-minigame-map` and `fink-universe`
  read it; 13 story files moved by hand; `inklet/finkapp/test/e2e-app-tag.mjs` tests it.
  `inklet/tools/fink-graph.mjs` is not changed: it reads tags with regexes over ink source,
  which CLAUDE.md forbids, so it needs rebuilding on the compiler rather than extending.
- Step 2 is built. `inklet/finkapp/apps/<id>.jsonld` (30 apps, inline `@vocab`, no
  context file), `shapes.ttl`; `npm run apps:build` writes `foafos-apps-data.js`; `npm run apps:check`
  validates with @factoidal/core. The generated `APPS` equals the old hand-written one, row
  for row and in order. Only the members the registry already had are filled in; the new
  members of section 4 (`instances`, `handles`, `actions`, `storage`, `headless`,
  `delegates`) are accepted by the check (and `instances`, `storage` by the shapes), and no
  manifest uses them yet. @factoidal/core is 0.11.0 since 2026-10-22.

Proposed order:
1. `# APP:` in the story runner and the tools, with `then=wait` (what `# MINIGAME:` does
   today). The 14 stories move by hand afterwards.
2. The manifest as JSON-LD files, with the registry rows generated from them.
3. Per-instance and per-document storage keys.
4. `instances: "single"`, intents to the open instance, and a headless media player on the
   bus that two stories can use at the same time.
5. Format handlers (`handles`) and "open with".
6. Delegated capabilities.
7. The installation graph and SPARQL access.
8. Packages (ZIP, integrity), when offline use or installation is needed.

Questions:
1. Does `# WORLD:` stay as a name, or become `# APP: <app> then=beside` only?
2. Should the manifest be JSON-LD from the start, or plain JSON first with a JSON-LD
   context added later?
3. For a singleton launched by a story (not by the reader): does it come into view, or only
   start headless?
4. Where does the MiniApp code go? Proposal: the spec modules stay in `magpie/miniapps/src/`
   as a library; the host and UX parts move into `packages/foafos/` when the shell takes them
   over.

## 10. Documents first: embedded objects, helper apps, and stories inside stories

Owner, 2026-10-22, verbatim:

> "This gets me thinking about doc-first architectures like OpenDoc. If I open a Fink Story do
> we distinguish embedded objects from "helper apps"? Same with .docx etc, I don't know how
> those aspects of MS's COM etc object models show up in the relevant xml based standards.
>
> Having two independent stories open makes sense
>
> Having one story spawn another (and original goes into suspended mode at OS level, maybe
> "dreaming" in its own narrative terms?) also seems appealing. Would those be different
> "Windows" or a bit more like the embed. I suspect latter; one story literally embedded in
> the other. We could do it as a rectangle as if a photo or panorama or interactive map or
> genuinely mini-game were embedded, but the embedded story area would need to be usually
> maximized, even if it had a symbolic eg thick rectangle drawn round it, indicating a
> possibly long nested stack of calling stories."

### How the office formats keep OLE's two cases

Both XML office formats keep the distinction that OLE/COM made between an object shown in
the document and an object opened in its own application:

- **OOXML (.docx, .xlsx, .pptx; ECMA-376).** An embedded object in WordprocessingML is a VML
  `o:OLEObject` element with `ProgID` (the class of the application that owns the object,
  for example an Excel sheet), `DrawAspect` (`Content`: draw the object in the page; `Icon`:
  draw an icon that opens it), `ShapeID`, `ObjectID`, and `r:id`, a package relationship to
  the object's bytes inside the ZIP. Office also writes a `Type` (`Embed` or `Link`: inside
  the package or in a file outside it), which ISO/IEC 29500 does not define
  ([MS-OI29500 note](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/19190ae3-5734-48eb-a919-b89d0b3ce114);
  [VML OLEObject reference](https://webapp.docx4java.org/OnlineDemo/ecma376/VML/OLEObject.html)).
  The shape that holds the object also carries a picture of it, so a reader without the
  owning application still sees the last rendering.
- **ODF (.odt, .ods, .odp; OASIS).** `draw:object` holds an object that has an ODF form, as a
  sub-document in a folder of the package. `draw:object-ole` holds one that has not (an OLE
  binary). A replacement picture is kept beside it (`ObjectReplacements/` in the package) for a
  reader with no service for the object, and `draw:ole-draw-aspect` chooses between drawing
  the content and drawing an icon
  ([OASIS ODF list, 2007](https://lists.oasis-open.org/archives/office/200702/msg00048.html);
  [OpenOffice issue 111488](https://bz.apache.org/ooo/show_bug.cgi?id=111488)).

So both formats answer the owner's question the same way: an embedded object names its
application, stores its own bytes (or a link), carries a picture of itself, and says whether
it is drawn in place (content) or offered as an icon that opens a helper application.

### The same distinction in a FINK story, today and proposed

| In a story | Shown | Today | Office analogue |
|---|---|---|---|
| `# IMAGE:`, `# VIDEO:`, `# AUDIO:` | in the reading, inline | built | a picture |
| a typed block, `OO('application/vnd.fink.playlist+json')` | handed to the app that handles its media type | format only (spec §1.1); no handler table yet | an embedded object with content aspect |
| `# APP: <app>` (then=wait) | the app takes the reading surface; the story waits | built (stage) | in-place activation, full window |
| `# APP: <app> then=beside` | the app beside the story; the story goes on | built (`# WORLD:` path) | — |
| a link to open an app in its own window | a separate app instance | not built | icon aspect: opens the helper app |

Proposal: `# APP:` gets a second word for presentation, kept apart from `then=` (what the
story does): `show=full` (today's default: the app takes the reading surface), `show=inline`
(drawn in the prose like an image, with a picture of itself when it is not running, as both
office formats keep), and `show=icon` (an item in the prose that opens the app as its own
instance, a helper application). Questions for the owner at the end of this section.

### Stories inside stories

- **Two independent stories** are two story runner instances (two windows). That works today:
  each `launchApp` makes a new instance.
- **A story that opens another and waits** is the dream (`# LINKREL: godeeper`, spec §3.4). It is
  built: the outer story's ink state goes on a stack in the runner (`_frames`), the inner story
  plays in the same frame and on the same reading surface, and its END returns the reader to
  the outer story where it was (`inklet/apps/storyrunner/storyrunner.js`, "the dream stack").
  The shell holds the depth and refuses past 8. So it is already "one story embedded in the
  other", maximized, as the owner suspects it should be, and not a second window.

What the owner's description adds:

1. **The frame as the sign of depth.** Today the depth shows as a colour filter that grows
   stronger, and at depth 2 and more a slow wobble animation
   (`storyrunner.css`, `body[data-depth]`). Proposal: one ruled border per level round the
   reading surface (thick, then thinner inside it, like nested picture frames), with a number
   when there are more than three; no controls on it, so it stays a sign and not a window
   to manage (the presentation invariant of the layer model). It does not move, so it suits
   reduced motion; it is named for screen readers ("inside 2 stories"); and voice says the
   same words.
2. **The outer story suspended at OS level.** Today the outer story is suspended only inside the
   runner (its saved state on the stack); the app tree does not show it. Proposal: each story
   in the stack is a session node in the app tree; entering a dream marks the outer node
   suspended (`AppTree.setSuspended`) and the inner one a child of it; surfacing closes the
   inner node and resumes the outer. The shell's switcher and the Subtree panel then show the
   stack, and anything the outer story opened (a playlist it queued, a world) is told it is
   suspended, through the same lifecycle the shell already sends.
3. **"Dreaming" in narrative terms.** A story may say what its own suspension means: proposal,
   an optional `# DREAMING: <line>` tag on the outer story, shown or spoken while it waits
   (default: nothing). This is a question for the owner, because it adds a tag.

Questions for the owner:
1. `show=full|inline|icon` on `# APP:`: yes, or other words?
2. The depth frame (nested borders, a number past three) in place of the colour filter and the
   wobble: yes?
3. Session nodes in the app tree, with the outer story suspended, for each dream: yes?
4. A tag for what a suspended story says while it waits: wanted?

### Decisions (owner, 2026-10-22)

Owner, 2026-10-22, verbatim: "1. Sure for now, or borrow from web manifests. Consider input
focus. 2 yes, but styling can be an option too 3. Probably yes. 4. Eventually"

1. **`show=full|inline|icon`: accepted for now. Not built.** The input focus model is below.
   From the Web App Manifest we borrow the shape of `display_override`
   ([Web App Manifest](https://www.w3.org/TR/appmanifest/), W3C WD 2026-10-16):
   a manifest member `shows`, an ordered list of the presentations the app supports, most
   wanted first. When a story asks for a presentation the app does not list, the runner uses
   the first one in `shows` that it can give, and says so in the status line. We do not reuse
   the `display` words (`fullscreen`, `standalone`, `minimal-ui`, `browser`): they say how
   much browser chrome a top-level window keeps, and our three say where an app is drawn
   relative to a story.
2. **Depth frames: built, with the style as a skin option.** One ruled frame round the reading
   surface for each story that holds this one, three at most; a line at the top of the
   reading surface says the number and names the outer stories, outermost first ("Inside 2
   stories: toc › hampstead"). The names come from the frame URLs, never from story text. No
   motion. The skin token `--sk-depth` chooses the look: `frames` (the default, set on
   `:root` in `inklet/finkapp/fink-skins.css`), `filter` (the old colour filter and wobble;
   the Aurora skin uses it) or `none`. The words show for every style, so the depth never
   rests on colour or on counting lines. Code: `inklet/apps/storyrunner/storyrunner.css`
   ("DREAM DEPTH"), `showDepth()` in `inklet/apps/storyrunner/storyrunner.js`; the shell
   hands the token over with the other skin tokens (`SKIN_TOKENS` in
   `inklet/finkapp/foafos-shell.js`).
3. **The outer story suspended in the app tree: built.** Each story in the stack was already a
   session node (`story-session`, made by the shell's `story.session` verb). Now, when a dream
   starts, the shell suspends the outer session node and its subtree (the apps that story
   opened get `app.suspend`), and resumes them when the dream ends (surface, or `end` of the
   innermost session). The shell resumes only what it suspended for a dream: a session the
   reader paused by hand stays paused. One change from the proposal above: the dream node
   stays a child of the runner, with `dreamOf` naming the outer session, not a child of the
   outer session. A child of a suspended node is suspended with it
   (`AppTree.setSuspended` acts on the subtree), and the dream must stay awake.
   Test: `inklet/finkapp/test/e2e-dream.mjs` (outer suspended and dream awake in the dream;
   both resumed and the dream node gone after surfacing; the frame, the words, the filter
   option and the skin token).
4. **`# DREAMING:`: later.** Not built, and not in the tag list.

### Input focus for `show=` (design, not built)

The model is OLE's in-place activation, which both office formats inherit: an embedded object
is drawn in the document but does not take input until the reader activates it, and it gives
input back when it is deactivated. The rules:

| Presentation | Input before activation | How to activate | While active | How to leave |
|---|---|---|---|---|
| `show=full` (then=wait) | none: the app opens active | opening is activation | focus moves into the app frame; the story waits and is `inert` | the app sends `complete`, or the reader closes it; focus returns to the story's new prose |
| `show=inline` | none: the object is one tab stop, a control named "<app name>, embedded app: activate"; pointer and keys go to the story, so a swipe across it scrolls the story | Enter, Space, or one tap on it | a visible focus ring (the skin's `--sk-accent`, 3px, not colour alone: a "Done" control shows beside it); keys and pointer go to the app; the rest of the story is not `inert` | Escape, the "Done" control, or Tab past the last control in the app; focus returns to the object's tab stop |
| `show=icon` | none: the item is a link-like control in the prose | Enter, Space, or a tap | the app opens as its own instance (or, for a single-instance app, the existing window is shown, as `launch_handler` `focus-existing` does) and that window gets focus | closing the window returns focus to the item in the story |
| `then=beside` (a world) | none: focus stays in the story | the reader moves to it (F6, or the window switcher) | the world takes input; the story goes on | F6 or the switcher back |

Further rules:
- One inline object is active at a time; activating another deactivates the first.
- An inactive inline frame has `inert` and `pointer-events: none`, so it cannot take focus or
  pointer events however its content is written. The frame gets `app.activate` and
  `app.deactivate` (new lifecycle messages, beside `app.suspend` and `app.resume`), so an app
  can show its own idle state.
- Escape always deactivates an inline app. An app that needs the Escape key asks for
  `show=full`. The shell's own keys (window switcher, menu) always reach the shell, in every
  presentation, so no app can hold the reader.
- Screen readers: the inline object is a `role="group"` with the app's name and the state
  ("not active", "active"); activating it moves focus to the first control in the app;
  deactivating it says "back in the story".
- Voice and switch access use the same control: "activate" and "done" are visible words, not
  icons alone.

