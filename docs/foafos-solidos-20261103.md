# foafos and SolidOS: comparison, LWS points, and SolidOS as foafos apps (design note, 2026-11-03)

Status: a comparison (sections 2 to 4, checked against the code) and a proposal (sections 5
to 7, nothing built). Read with: `docs/foafos-apps-20261022.md` (what an app is),
`docs/foafos-lws-20261021.md` (identity and storage through LWS),
`docs/foafos-secrets-and-auth-20260726.md`, `docs/foafos-story-layering-20260730.md`.

Repositories as read:
- glitchcan-minigam `master` at 2304542 (2026-10-22).
- SolidOS https://github.com/SolidOS/solidos at 296faf3 (2026-10-08), with its workspaces
  `mashlib`, `solid-panes`, `pane-registry`, `solid-ui`, `solid-logic`, `chat-pane`.

## 1. The owner's requests

Owner, 2026-11-02, verbatim: "study the Fink work and the sandboxing architecture of 'foafos'
multi-widget runner eg. as deployed here
https://danbri.github.io/glitchcan-minigam/inklet/finkapp/#5f4520f0-2620d57be How does it
compare to solidos? Apart from similarly grandious names"

Owner, 2026-11-03, verbatim: "I'd like to understand for discussion with Solid folks,
especially as I'm working on LWS WG."

Owner, 2026-11-03, verbatim: "Ok so we could bundle SolidOS as one or more widgets (or as a
class of app/doc like FINK INK is a class)"

## 2. What each one is

- **SolidOS** is an RDF data browser. A *pane* is a renderer for one subject:
  `{name, icon, label(subject, context) → string | null, render(subject, context)}`,
  registered in `pane-registry`. The browser asks each pane's `label` and shows the panes
  that answer; the RDF type of the subject usually decides.
- **foafos** is an app shell. An *app* is a window with a JSON-LD manifest and a list of
  capabilities (`inklet/finkapp/apps/*.jsonld`, generated into
  `inklet/finkapp/foafos-apps-data.js`). FINK stories launch apps with `# APP:`.

They are not built for the same job. But both run UI code, written by other people, on the
user's data. That is where they differ most.

## 3. Comparison

### 3.1 Isolation (the main difference)

- **SolidOS has no isolation between panes.** Every pane runs in the page's origin, with the
  shared rdflib store, the authenticated fetch and the DOM. Any pane can do anything the
  user can do.
- **foafos runs each app in an iframe at an opaque origin.**
  - `sandboxFor` gives `allow-scripts allow-forms allow-modals`
    (`inklet/finkapp/foafos-shell.js:2978`); the frame gets it at `:2844`.
  - An app gets no store handle and no host fetch. It has only `postMessage` verbs, which
    brokers check.
  - The capability tree refuses a child a capability that its parent does not hold
    (`packages/foafos/src/apptree.mjs:107`, reason `attenuation`).
  - Closing a node closes its whole subtree, deepest first (`apptree.mjs:192`).
  - `inklet/finkapp/test/e2e-caps.mjs` checks that no app holds ambient authority
    (`anyAmbient`, line 75).

### 3.2 The limits of the foafos sandbox (stated, not hidden)

- **No network egress control.** There is no Content Security Policy, so an app can `fetch`
  any address. `docs/fink-spec-v1.md` §5.5.6 (line 773) states this: on GitHub Pages foafos
  protects integrity and powers, not secrecy.
- **`postMessage` hygiene.** 59 calls in the repository send with target origin `'*'`.
  The message listener in `inklet/apps/app-sdk.js:367` does not check `e.source`.
- **An escape hatch exists.** The capability `same-origin` adds `allow-same-origin` and
  `allow-popups` (`foafos-shell.js:2979-2980`) and logs the app as having ambient authority.
  No manifest declares it today.

### 3.3 Manifests and permissions

- foafos: one JSON-LD manifest per app (inline `@vocab` only), validated with Factoidal
  SHACL (`npm run apps:check`). The capabilities in the manifest are what the app gets.
- SolidOS: no manifests and no permission model. The NLnet "user-selectable panes" work is
  close to what foafos has already.

### 3.4 Data and identity

- SolidOS is fully on Solid: WebID, Solid-OIDC, LDP containers and resources.
- foafos keeps data in the shell origin's `localStorage` (`FoafStore`). The LWS work is
  connected only in tests. There is no WebID or OIDC yet. Details in
  `docs/foafos-lws-20261021.md` §2.

### 3.5 Summary

SolidOS is far ahead on Solid data and identity. foafos is far ahead on isolation of
untrusted UI code. The two parts fit together.

## 4. Points for the LWS Working Group

These are observations from this comparison, not statements of the WG's position.

1. **A storage server can only tell clients apart by token and origin.** In SolidOS every
   pane shares one page, one origin and one session. A per-client or per-app limit that LWS
   defines therefore cannot separate one pane from another. The weak point is in the client
   architecture, not in the storage protocol.
2. **An isolating app host needs attenuated credentials.** A foafos-style broker can narrow
   what an app may do inside the page. For that to hold at the server, the host must be able
   to get, from the credential it holds, a credential that is limited to some resources and
   some methods, without a new login. Question for LWS: does the protocol give a client a
   way to derive such a narrower credential (delegation, a scoped token, a capability URL)?
3. **App manifests are a natural place to declare data needs.** A manifest that names the
   resource types, containers and methods an app needs can feed both the consent screen and
   the request for a narrower credential.
4. **What foafos shows in practice.** Opaque-origin frames with brokers work. Capability
   attenuation down a tree of nested apps works, and closing a subtree removes its powers.
   The remaining weak points are egress (no CSP) and `postMessage` hygiene. Both are
   client-side, not protocol, matters.

## 5. SolidOS inside foafos: three ways to cut it (proposal)

### A. All of SolidOS as one app

The whole `mashlib` data browser in one foafos window.

- Gain: isolates SolidOS from the other foafos apps.
- No gain inside: all panes still share one store and one session.
- What breaks: at an opaque origin there is no `localStorage`, `IndexedDB` or cookies, so the
  Solid-OIDC client library cannot keep its session, and the login redirect needs a top-level
  navigation. The shell must therefore own login and lend a fetch through a broker. That is
  the same work as in B, without B's gain.

Use: a spike to find what breaks, not a goal.

### B. Each pane as an app

The shell holds the Solid session and the RDF store. Each pane runs in its own opaque frame
and reaches data only through brokered verbs.

- Gain: per-pane capabilities. A contacts pane can read the address book and nothing else; a
  chat pane can append to one chat resource.
- Needed:
  - a store broker: verbs such as `rdf.load(doc)`, `rdf.match(s, p, o, doc)`,
    `rdf.patch(doc, ins, del)`, each checked against the pane's grant (documents,
    containers, methods);
  - in the frame, a local rdflib store that the broker fills with only the granted documents,
    so that pane code that calls `store.any(...)` synchronously still works;
  - `solid-ui` widgets that read the shared `store` and `authn` objects use the frame's local
    copies;
  - a manifest per pane: the RDF types it handles (the declarative form of `label`), and the
    capabilities it needs.

### C. A Solid resource as a document class

The owner's second form. foafos already has the pattern: a launcher row `opens` the story
runner on a `.fink.js` story (`"opens": "storyrunner"`, `foafos-apps-data.js:259`), and
`docs/foafos-apps-20261022.md` §1 names apps as "format handlers". In the same way:

- A Solid resource (a WebID, a container, a chat, an address book) is a document class.
- A `solidbrowser` runner app opens it, like the story runner opens a story.
- The runner chooses a pane app by RDF type (from the pane manifests in B), and spawns it as a
  child with an attenuated grant: only the documents that belong to that subject.

Recommendation: **C as the model, B as the mechanism, A only as a spike.** C keeps the SolidOS
idea (the subject chooses the view) and the foafos idea (apps are handlers with attenuated
grants). The capability tree enforces the grants that the runner passes down.

## 6. A first experiment (proposal)

The XMPP pane made on 2026-11-02 is a small first case. It is local only, not committed:
`/Users/danbri/working/solid/solidos/workspaces/xmpp-pane` (Strophe.js; reads `foaf:jabberID`
and `vcard:hasInstantMessage` from a profile).

- Data needed: one read of the subject's profile document.
- Network needed: one WebSocket to an XMPP server (RFC 7395). The Factoidal Lean server now
  speaks RFC 7395 directly (`xmpp-serve --ws-port`, https://github.com/danbri/factoidal-core/pull/311).
- Test: the pane in an opaque frame, given only `rdf.load` on the profile, still finds the
  JIDs and chats; and an `rdf.load` on any other document is refused.
- Note: the WebSocket is egress. Without CSP the frame could also open any other socket
  (section 3.2).

## 7. Open questions

1. Where does the Solid session live: in the shell (level 0), or in a dedicated auth app with
   a narrow broker? `docs/foafos-secrets-and-auth-20260726.md` is the starting point.
2. Is the store broker per-document (simple, coarse) or per-triple-pattern (fine, but must
   not leak by inference)?
3. Can the pane `label` functions run headless in their frames, so the runner can ask "who
   can show this?" without giving each pane the data first? Or must manifests declare types?
4. Section 4, point 2: what LWS gives for credential attenuation decides whether the server
   enforces the pane grants, or only the shell does.
