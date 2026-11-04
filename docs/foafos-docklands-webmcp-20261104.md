# Docklands (moglob) in foafos: WebMCP, the bus, SPARQL, LWS and XMPP (2026-11-04)

Owner, 2026-11-04, verbatim: "If we have moglob open showing Docklands London in an App, can we use its WEBMCP API
over our foafos bus? From SPARQL? Can we see it wired up for LWS storage? Can we SPARQL it over XMPP?"

Status: a survey. Nothing below is built yet, except where it says "exists".

## 1. What exists

| Part | Where | State |
|---|---|---|
| Docklands tools | londat `docklands/api.js` (`TOOLS`, `callTool`), page API 1.9.1 | Exists: 31 tools with JSON schemas (`go_to`, `get_view`, `describe_view`, `features_at`, `find_places`, `set_time`, `set_layer`, autopilot and sweep tools). The same list is `window.docklands.tools`, WebMCP and the londat MCP server's `page_call`. |
| Docklands WebMCP | `registerWebMCP()` in `api.js` | Exists: it registers every tool on `document.modelContext` (or `navigator.modelContext`) if the browser has one. Else it does nothing. |
| Docklands in foafos | `inklet/finkapp/apps/docklands.jsonld` | Exists: the live page in a sandboxed frame (opaque origin), `capabilities: []`. It does not load `app-sdk.js` and does not speak the guest protocol. See `docs/foafos-docklands-20261103.md`. |
| Bus over XMPP | `docs/foafos-chat-20261103.md` | Exists: the shell's in-page Lean XMPP server mirrors listed bus topics to a room. An outside client sees them (e2e-chat). Nothing from the room changes anything yet. |
| Built-in LWS pod | `packages/foafos/src/pods.mjs`, `@factoidal/core@0.30.0` `lws/inpage` | Exists: Pod Notes uses it through `foaf.pod.*`. |
| RDF dataset over LWS | `@factoidal/core/lws/dataset`, `openLwsDataset(...).query()` | Exists in 0.30.0: SPARQL over an LWS storage, from the client side. |
| HTTP over XMPP (XEP-0332) | factoidal-core `L4Factoidal/XMPP/HttpOverXmpp.lean`, `HttpRequester.lean`, `npm/factoidal/xmpp/proxy.mjs` | Exists in Lean and in the Node CLI (`xmpp-http-proxy`, `webdav-serve --xmpp`). Not wired into the in-page server or the shell. |

## 2. The answers

1. **WebMCP over the foafos bus: not yet.** The Docklands page is cross-origin in its frame, so the shell cannot reach
   `window.docklands`. No browser gives `document.modelContext` to a sandboxed frame. The page sends nothing to the
   shell. Its tools are there, but nothing carries them out of the frame.
2. **From SPARQL: not yet.** Docklands has no RDF and no Factoidal code. Its tool answers are JSON.
3. **LWS storage: not yet.** Docklands has no pod capability and no SDK. The built-in pod works for apps that use
   `foaf.pod.*`.
4. **SPARQL over XMPP: the parts exist, the connection does not.** XEP-0332 is in Lean and in the Node CLI. The shell's
   in-page server does not serve XEP-0332, and nothing sends a SPARQL request to `openLwsDataset`.

## 3. The plan, in order

1. **londat: the frame path. DONE 2026-11-04,** https://github.com/danbri/londat/commit/f5b4af67 (page API 1.10.0).
   `docklands/frame-bridge.js` answers the parent frame only: `webmcp.tools` at start and on `webmcp.list`, and
   `webmcp.call` gives `webmcp.result`. WebMCP registration is unchanged. Both run, with no condition on
   `modelContext` (owner, 2026-11-04: "if model context is in-browser agents etc., it shouldn't stop other things using
   same info, no?"). Test: `docklands/test/api-check.mjs --only 4`: 7 checks pass (25 tools; get_view and go_to through
   the frame; an unknown tool is an error answer; a call from another frame is not answered). Parts 1, 2 and 3 pass;
   two old checks there expected version 1.7.0 and 18 tools and now compare with `api.js`.
2. **foafos: a `tools` capability.** The shell keeps each frame's tool list as a node in the app tree, and publishes
   `app.tools` on the bus. A call is a brokered action: `tools.call {app, name, args}`. The shell sends it only if the
   caller holds the grant. A tool that is not `readOnly` needs a write grant. The manifest declares `tools`, and the
   Powers window shows it.
3. **foafos: WebMCP at the top.** Where the shell's own page has `document.modelContext`, the shell registers the
   granted tools there as `docklands.go_to` and so on. An agent in the browser then drives the frame through the shell.
4. **XMPP: commands from the owner's JID only.** This is "Next" 1 and 2 of the chat doc: room commands and XEP-0050
   ad-hoc commands map to `tools.call`, through a "remote" app-tree node that holds only the verbs the owner grants.
5. **Docklands to the pod.** The shell saves `share_link` and `get_view` answers (and sweep plans) as Turtle in the
   built-in pod, under `apps/docklands/`, with GeoSPARQL `geo:asWKT` for the eye and target. Docklands needs no change.
6. **SPARQL.** `openLwsDataset` over the built-in pod gives a SPARQL query over the saved views, through the shell's
   `fetch`. A Pod SPARQL app can show it.
7. **SPARQL over XMPP.** The shell serves XEP-0332 on its JID with the Lean `HttpOverXmpp` step. A
   `POST /sparql` (`application/sparql-query`) from an allowed JID runs on the dataset from step 6. Every other path
   goes to the built-in pod's `fetch`, so WAC still decides. This needs the XEP-0332 ops in the wasm dispatch and an
   in-page host. That is factoidal-core work (a PR, then 0.31.0).

Security: every path from outside the shell (WebMCP at the top, XMPP) reaches a frame only through a granted node in
the app tree. No path gives a frame's tools to another frame without a grant, and the pod is reached only through WAC.

## 4. Ask the shell what is going on (owner, 2026-11-04)

Owner, verbatim: "we ought to be able to talk to the foafos outer shell to understand what is going on, eg. without AI,
by simple chat commands or SPARQL; with AI, in more sophisticated (tool use / mcp / rag) sorts of ways."

So the shell keeps one description of its state, and every way in reads that one description. The state is:
- the app tree (nodes, apps, parents, capabilities, grants);
- the windows and their modes;
- the pods and their status;
- the bus (topics, the last messages of each, mirrored or not);
- each app's tools (step 2).

The ways in:

| Way in | Who | What it gives |
|---|---|---|
| Chat commands | a person, no AI: the Chat window, or an XMPP client from the owner's JID | `/help`, `/apps`, `/tree`, `/caps <app>`, `/tools <app>`, `/call <app> <tool> {json}`, `/bus [topic] [n]`, `/pods`, `/sparql <query>`. Plain text answers. `/call` needs a grant. |
| SPARQL | a person or a program, no AI | The state as RDF, made on each query with Factoidal (`@factoidal/core`), plus the built-in pod as a dataset (`openLwsDataset`). In the Chat window (`/sparql`), and later over XMPP (XEP-0332 `POST /sparql`, step 7). |
| Tools | an AI | WebMCP at the top (step 3), and the project MCP server (`tools/game-mcp`), which drives the same shell in a test browser. Each chat command is also a tool, with the same name and a JSON schema. |
| RAG | an AI | Search over this description, the app manifests (`inklet/finkapp/apps/*.jsonld`, already RDF), the skills and `docs/`. Later. |

Rules:
- A read (`/apps`, `/tree`, `/bus`, `/sparql`) shows what the shell shows its owner. A secret value (a pod key, a
  passphrase) is never in the state.
- Anything that changes something (`/call` with a tool that is not `readOnly`, a grant) goes through the same broker
  and grants as a button press.
- From XMPP, only the owner's JID gets commands (chat "Next" 1). Any other JID gets nothing.

Order: the chat commands and the state description come first, in the Chat window with no network. They are the base
for SPARQL, XMPP and the tools.

## 5. Open points, 2026-11-04 (owner questions, later the same evening)

1. **Names (done, d71aab25):** Pods is **PodStore** (a foafos term, `docs/glossary.md`); Pod Notes is **Notes**. App ids
   are unchanged.
2. **The PodStore as a service, not shell code.** The shell keeps the gate (which app asks, which folder it may reach,
   locked or not). The storage engine, its snapshot and its key move to a service that always runs.
3. **One session / window manager, not four surfaces** (owner: "shouldn't it be one thing, foafos-session or
   -windowmanager or whatever. Which then might have panels or windows or headless or buttons ... but those things can
   avoid being baked deep into infra"). The app tree knows only apps, capabilities and lifecycles. `surface`
   (`window`, `panel`, `stage`, `chrome`) becomes a presentation hint that one session module reads. A service is an
   app with no presentation. Nothing below the session module reads the hint.
4. **Files.** Checked in the shell (headless Chrome, `?app=files`): New folder and Upload both work. But Files shows the
   shell's device storage, not the PodStore. It has no "New file" and no edit. An LWS store reaches it only as an edot
   Connections mount (`SolidResourceSource`, the LDP form). Against a Factoidal LWS storage (Node, `lws/inpage`) that
   backend makes folders, uploads, lists and reads; `stat` of a folder without its final `/` gives 404. To do: the
   PodStore as a Files mount (through the shell), and "New file".
5. **The CLI.** The built-in PodStore is in the browser (IndexedDB `foafos-pods`, sealed), not in a directory. On
   2026-11-04 no Factoidal server ran on the Mac. A store to inspect from the CLI is `factoidal lws-serve DIR` (then
   `curl` or `factoidal lws-client`), the home pod `packages/foafos/pod/pod.mjs --dir`, or `factoidal webdav-serve` to
   mount it in Finder. PodStore can add any of them.
6. **Normal XMPP clients.** The in-page server has no network side. `factoidal xmpp-serve` (setup in
   `docs/foafos-chat-20261103.md`) takes Profanity, Gajim, Dino, and on macOS and iOS Monal, Beagle IM and Siskin. A
   phone needs `--cert`/`--key` on a LAN address, because it cannot reach the Mac's 127.0.0.1. Not yet tested with a
   third-party client.
7. **An LLM over XMPP.** Recommended: an LLM is one more XMPP account (`claude@…`), run by a small bot process that
   holds the API key. It joins a room or gets direct messages, and it uses the shell's chat commands as its tools
   (section 4). The other way, the REST API tunnelled over XEP-0332, needs a forwarder to an outside HTTPS host. That is
   new egress (factoidal issue 1126) and is not recommended first.
