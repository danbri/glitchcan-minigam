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

1. **londat: a frame bridge in `registerWebMCP()`.** If there is no `modelContext` and `window.parent !== window`, the
   page listens for `{type:'webmcp.list'}` and `{type:'webmcp.call', id, name, args}` and answers with
   `{type:'webmcp.tools', tools}` (name, description, inputSchema, readOnly) and `{type:'webmcp.result', id, ok,
   value|error}`. It sends `webmcp.tools` once at boot, because of the init race (fink skill). About 30 lines, no
   foafos code in londat.
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
