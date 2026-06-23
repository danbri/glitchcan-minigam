# UI Extensibility, Complexity & Modularity — a research deep-dive, applied to edot

*Research report (no code changes). Synthesised from five parallel primary-source
research passes — office suites, open substrates, OS/shell extensibility, component
architectures, and cross-cutting principles — then applied to the edot suite's UI
and architecture. Claims carry citations; contested points are flagged as such.*

---

## 0. Executive summary

Across forty years and five very different domains, the same handful of forces
recur. Extensible UIs all face one trade and one law:

- **The trade:** *in-process, imperative, deeply-coupled* extensions maximise
  power and minimise friction but share the host's trust and fate; *out-of-process /
  sandboxed / declarative* extensions with explicit contracts trade raw power for
  fault-isolation and a tractable security model. Every platform's history runs
  from the first toward the second — Windows shell extensions → out-of-process
  handlers; Office COM/VSTO → sandboxed Office.js; first-gen monolithic kernels →
  microkernel servers. ([MS shell guidance](https://learn.microsoft.com/en-us/windows/win32/shell/shell-and-managed-code), [MS Office add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/office-add-ins), [Microkernel](https://en.wikipedia.org/wiki/Microkernel))
- **The law:** **Tesler's conservation of complexity** — irreducible complexity
  doesn't vanish, it only moves between user, app developer, and platform
  developer. ([Tesler](https://www.nomodes.com/larry-tesler-consulting/complexity-law)) An extension *system* is a decision to *relocate* complexity onto an
  API surface and a third-party ecosystem; do it badly and you get OpenDoc.

**The OpenDoc lesson looms over all of it.** The "data-centric document, editors
as parts" vision collapsed under part-interoperability difficulty, performance
weight, an app-centric user mental model, Microsoft's bundled-OLE counter-position,
and Jobs's 1997 cancellation — and the failure analysis is *genuinely contested*,
no single cause. ([OpenDoc](https://en.wikipedia.org/wiki/OpenDoc), [instadeq](https://instadeq.com/blog/posts/why-opendoc-failed-and-then-failed-3-more-times/)) **edot already takes the post-OpenDoc shape that survived:** open
durable *data* at the centre, interchangeable *faces* (not embedded binary parts)
over it, message-passing between independently-loadable apps, light-DOM web
components, and no third-party extension surface *yet*. That last point is the
strategic question this report exists to inform.

**Bottom line for edot:** the architecture is well-aligned with the *durable*
principles (deep modules, open substrate, lossless round-trip, light-DOM,
progressive disclosure, late-bound message passing). The two real gaps are (1) no
**command/action registry** or **declarative contribution model** — the thing
every successful extensible editor (Eclipse, VS Code) converged on — and (2) no
**versioned contract** for the data formats or a future plugin API, where Hyrum's
Law and the Must-Ignore pattern will bite. Recommendation in §9.

---

## 1. Office suites & compound documents

- **OLE & OpenDoc shared the "compound document, editors-as-parts" vision** —
  one document amalgamating text/graphics/sheets, each region edited in-place by a
  different component. OpenDoc used *part editors/viewers*, the **Bento** container,
  and IBM **SOM/DSOM** for cross-language live linking. ([OpenDoc](https://en.wikipedia.org/wiki/OpenDoc), [Grokipedia](https://grokipedia.com/page/OpenDoc)) OLE 2.0 re-based on **COM** and gave us **in-place activation** —
  editing an embedded object while the container's menus/toolbars morph. ([OLE](https://en.wikipedia.org/wiki/Object_Linking_and_Embedding))
- **What survived was OLE-in-Office and COM/ActiveX, not OpenDoc.** "There were
  never many released OpenDoc components compared to Microsoft's ActiveX
  components." ([OpenDoc](https://en.wikipedia.org/wiki/OpenDoc))
- **Office's extensibility lineage is the in-process→sandboxed arc in miniature:**
  COM add-ins/VBA → **VSTO** (.NET, deep object-model, Windows-only, in-process) →
  **Office.js web add-ins** = a *manifest* (id, version, **permission level**, data
  requirements) + an externally-hosted web app loaded **in a sandboxed webview**,
  talking to the document only through the constrained Office.js API. Cross-platform
  and capability-scoped, at the cost of the full object model — and the bet has real
  friction (a developer "open letter" on Office.js stability/trust). ([Office add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/office-add-ins), [transition guide](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/learning-path-transition), [office-js#6513](https://github.com/OfficeDev/office-js/issues/6513))
- **The Ribbon is the canonical "command explosion" case study.** Word's toolbars
  grew 2 (1989) → 31 (2003) with ~20 Task Panes; menu items ~50 → ~300. Office 2000's
  adaptive **IntelliMenus/rafting** (hide rarely-used commands) *failed* —
  undiscoverable, unpredictable. The Ribbon unified menus/toolbars/panes into one
  contextual, results-oriented surface (**contextual tabs**, **galleries**, **Live
  Preview**). ([uxweek08 notes](https://www.jurecuhalev.com/blog/jensen-harris-the-story-of-the-ribbon-office-2007-uxweek08-notes/), [Ribbon](https://en.wikipedia.org/wiki/Ribbon_(computing)), [Designing the Ribbon](https://jensenharris.com/home/ribbon))
- *Contested / uncertain:* the exact command counts come from third-party
  conference notes, not Harris's primary text; the popular "Word had ~1,500 commands"
  figure was **not** verifiable. ([flag per research](https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-story-of-the-ribbon))

**For edot:** the Ribbon's lesson — *don't hide commands adaptively; make them
contextual and previewable* — directly validates edot's choices: contextual
"faces" switcher, long-press readable labels + a Labels mode (the icon-legibility
problem the Ribbon faced), and recents/merge appearing only when relevant. The
Office.js arc is the template if edot ever wants third-party add-ins (manifest +
sandbox + capability scope).

---

## 2. Open document substrates & declarative add-ons

- **LibreOffice UNO** is a language-neutral component model: services bundle
  interfaces, components are instantiated via a `ServiceManager` from a registry,
  and the **URP** wire protocol makes it distributed; **add-ons** layer declarative
  `Addon.xcu`/`ProtocolHandler.xcu` config (menu/toolbar injection) over imperative
  UNO components. ([UNO component model](http://www.openoffice.org/udk/common/man/componentmodel.html), [UNO](https://en.wikipedia.org/wiki/Universal_Network_Objects)) **ODF** is the open zipped-XML substrate (content/styles/meta
  streams; ISO/IEC 26300), with RDF metadata since 1.2 — a bridge between document
  and semantic-data worlds. Round-trip fidelity vs OOXML is imperfect in practice
  (tracked-changes under-specified). ([OpenDocument](https://en.wikipedia.org/wiki/OpenDocument))
- **Google Workspace add-ons invert the flexibility/safety dial:** **CardService**
  is *hosted & declarative* — you describe cards→sections→widgets; Google renders
  them ("no HTML or CSS needed"), auto-styles per surface, and you "define the
  interface once" for Gmail/Drive/Calendar/Docs. Flexibility is sacrificed for
  safety, consistency, and cross-surface portability; review + OAuth-scope
  verification gate publication. Contrast Office.js's *imperative* web UI. ([CardService](https://developers.google.com/workspace/add-ons/concepts/card-interfaces), [scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification))
- **The document/data-centric paradigm is having a revival.** *Local-first
  software* (Ink & Switch / Kleppmann) argues cloud apps make users "borrowers of
  our own data" and posits seven ideals (fast local, multi-device, offline,
  collaboration, **the Long Now**, privacy, **user ownership**); CRDTs/Automerge are
  the enabling tech. Open formats (zip-of-XML, sqlite-as-a-file, RDF) are the durable
  substrate over which editors are mere views. ([Local-first](https://www.inkandswitch.com/essay/local-first/))
- *Contested:* **"data ages like wine, software ages like fish"** is a rhetorical
  frame, not a law — practitioners counter that data goes stale/loses context
  ("data ages like *fish*"). ([counterpoint](https://infusedinnovations.com/blog/secure-intelligent-workplace/data-ages-like-fish-not-like-wine-a-fresh-take-on-data-management))

**For edot:** this is edot's exact thesis, already built — `OPENDOC.md`, the
SQLite/zip-of-CSVs/N-Quads durable exports, IndexedDB-local storage, the encrypted
backup. edot sits between UNO (maximal/imperative) and CardService (hosted/declarative):
its "faces" are *first-party declarative views* over one object — closer to the
*spirit* of CardService's safety than UNO's open-ended component soup. The honest
caveat: heed the "data ages like fish" critique — durability needs *context/metadata*
(the RDF face and the manifest/fingerprint help here).

---

## 3. OS / shell extensibility & security

- **Windows shell extensions are the in-process cautionary tale:** COM DLLs loaded
  into *any* process touching the shell namespace; a faulty one "brings down the
  entire Explorer process," conflicts are load-order-dependent and hard to
  reproduce, and Microsoft **recommends against** managed in-process extensions,
  steering to **out-of-process** handlers. Also a DLL-hijack persistence vector. ([MS shell + managed code](https://learn.microsoft.com/en-us/windows/win32/shell/shell-and-managed-code))
- **Browser MV2→MV3** is the live extensibility-vs-capability fight: service
  workers replace persistent background pages; **declarativeNetRequest** replaces
  blocking `webRequest` (rules evaluated *without the extension seeing content*),
  with a guaranteed **≥30,000** rules but **no body inspection / dynamic logic**;
  remote code banned. Chrome frames it as security/privacy/perf; **EFF/Ghostery
  contest** that it mainly harms blockers — genuinely disputed. ([MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [DNR](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [EFF](https://www.eff.org/deeplinks/2021/12/chrome-users-beware-manifest-v3-deceitful-and-threatening))
- **Inter-app composition = declarative contracts + late binding + capability
  boundaries:** Android **Intents** (implicit intents matched to manifest
  `intent-filter`s; explicit intents required for sensitive services);
  **iOS App Extensions** run in *separate sandboxed processes*, talk only to their
  host via system IPC, share data only through opt-in App Groups; **macOS Services**
  compose via a declared `NSServices` pasteboard contract. ([Android intents](https://developer.android.com/guide/components/intents-filters), [iOS extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionOverview.html), [macOS Services](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/SysServices/Articles/properties.html))
- **Foundations:** microkernel "mechanism, not policy" + message-passing IPC gives
  fault isolation; the performance penalty was an implementation artifact (L4 ~20×
  faster than Mach), not inherent. **Capabilities** (unforgeable tokens, no ambient
  authority) beat ACLs for sandboxing untrusted code (confused-deputy by design). ([Microkernel](https://en.wikipedia.org/wiki/Microkernel), [Capabilities](https://en.wikipedia.org/wiki/Capability-based_security))

**For edot:** edot's cross-app model is *already* the late-bound, contract-based
shape — suite apps are **separate pages**, composed by **message passing**
(`BroadcastChannel('edot')` for data→editor handoff, `BroadcastChannel('edot-auth')`
for shared session) and a `localStorage` handoff contract, opened by URL (a recently
fixed "open via anchor, don't navigate this tab" bug). That's macOS-Services /
Android-Intent thinking: components don't reference each other's internals, they
exchange typed payloads across a boundary. The capability lesson is the right north
star for the **encrypted-backup Tier-2** (a token-gated key service = capability
release by a trusted party) and for any future plugin sandbox (iframe + `postMessage`
+ scoped capabilities, *not* same-origin modules with full DOM access).

---

## 4. Component & module architectures

- **COM/CORBA/OSGi** teach the versioning/decoupling tax. COM's `IUnknown` folds
  *lifetime* (refcount) and *capability discovery* (`QueryInterface`) into the type
  system. **CORBA** is the design-by-committee cautionary tale — "union of all
  proposals with no regard to coherence," and **location transparency treated as a
  design flaw** (local code forced to carry remote complexity). **OSGi** delivered
  runtime-dynamic, *per-package* versioned modules + a service registry and was a
  long-time **SemVer** proponent — but traded "JAR hell" for "classloader/bundle
  hell." ([COM](https://en.wikipedia.org/wiki/Component_Object_Model), [CORBA](https://en.wikipedia.org/wiki/Common_Object_Request_Broker_Architecture), [OSGi](https://en.wikipedia.org/wiki/OSGi), [JAR hell](https://en.wikipedia.org/wiki/Java_Classloader))
- **Web Components / Shadow DOM** encapsulate, but the boundary is **leaky in
  documented ways** — inherited styles pierce it, and **forms/validation/ARIA don't
  cross by default**, hurting a11y. Consensus: **default to light DOM, opt into
  shadow only when isolation is worth it**; slots keep children stylable/submittable. ([MDN shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM), [shadow-DOM pros/cons](https://www.matuzo.at/blog/2023/pros-and-cons-of-shadow-dom/), [HTML web components](https://scottjehl.com/posts/html-web-components-shadow-dom/))
- **Micro-frontends / Module Federation** give independent deploy + runtime
  composition, with **version-skew** as the headline risk (shared-dependency
  negotiation, singletons, runtime rejection of incompatible remotes). **Islands**
  make modularity a *hydration boundary* (zero-JS default, per-island opt-in). ([Module Federation](https://webpack.js.org/concepts/module-federation/), [version skew](https://microfrontend.dev/architecture/webpack-module-federation/), [Islands](https://docs.astro.build/en/concepts/islands/))
- **Plugin patterns converged on declarative contribution:** Eclipse **extension
  points + `plugin.xml`** let a plug-in "contribute menus, actions, icons, editors…
  without ever being loaded" (lazy activation); **VS Code `contributes`** is the
  modern exemplar — JSON-declared commands/menus with `group`/`when` clauses, UI
  surface decoupled from runtime code. Underneath: **event bus/pub-sub** (decouple
  across time/type/number), **DI** (change behaviour) vs **events** (extend without
  modifying), and **ECS** (composition-over-inheritance, extend by adding a
  component/system pair). ([Eclipse plug-ins](https://www.eclipse.org/articles/Article-Plug-in-architecture/plugin_architecture.html), [VS Code contributes](https://code.visualstudio.com/api/references/contribution-points), [IoC via events](https://www.cshark.com/inversion-of-control-2-decoupling-through-events/), [ECS](https://en.wikipedia.org/wiki/Entity_component_system))

**For edot:** two strong validations and one clear gap. Validation: edot's
**light-DOM web components** are exactly the researched-recommended default
(avoids the shadow-DOM a11y/form traps — and edot is accessibility-first). Validation:
no bundler/Module-Federation = no version-skew/classloader-hell tax. **Gap:** edot's
toolbar/menu are **hand-wired** (`mi()` calls, static HTML, imperative `_btn`). There
is no **command/action registry** and no **declarative contribution point**. Every
successful extensible editor (Eclipse, VS Code) made that the spine. If edot wants
extensibility, this is the single most important architectural addition — and it can
be added *first-party* (internal command registry) long before any third-party plugin.

---

## 5. Cross-cutting principles (the "advanced thinking")

- **Decompose around change, hide secrets (Parnas, 1972).** Modularise by the
  decisions *likely to change*, each hidden behind an interface, so change doesn't
  propagate. ([Parnas](http://sunnyday.mit.edu/16.355/parnas-criteria.html))
- **Deep modules; complexity = dependencies + obscurity (Ousterhout).** Prefer a
  simple interface over substantial implementation; beware "classitis" (many shallow
  modules sum to system complexity). ([PoSD](https://milkov.tech/assets/psd.pdf), [deep modules](https://softengbook.org/articles/deep-modules))
- **Essential vs accidental complexity; conceptual integrity (Brooks).** Tooling
  only attacks accidental complexity; essential complexity is irreducible — keep the
  conceptual model small and coherent. ([No Silver Bullet](https://en.wikipedia.org/wiki/No_Silver_Bullet))
- **Hyrum's Law.** At scale, *every observable behaviour* becomes a depended-upon
  contract — "no such thing as a private implementation." SemVer is how you signal
  sanctioned breaks. ([Hyrum's Law](https://www.hyrumslaw.com/))
- **The robustness principle is now formally contested.** **RFC 9413** (2023)
  argues Postel's "be liberal in what you accept" *conceals problems* and entrenches
  bugs unless paired with **active maintenance + explicit extension rules**. The safe
  form of "liberal" is **lossless pass-through of unknown content** — the XML/HTML
  **"Must Ignore"** pattern, protobuf **unknown-field preservation** (binary-only,
  copy-fragile). ([RFC 9413](https://www.rfc-editor.org/rfc/rfc9413.html), [Must Ignore](https://www.xml.com/pub/a/2004/07/21/design.html), [protobuf](https://kmcd.dev/posts/protobuf-unknown-fields/))
- **Tesler's conservation of complexity.** Irreducible complexity lands on user,
  app-dev, or platform-dev — push it *off the user*. ([Tesler](https://www.nomodes.com/larry-tesler-consulting/complexity-law))
- **Hick's & Fitts's laws — useful, with caveats.** Choice time ∝ log(options);
  acquisition time ∝ log(distance/size). Both have real HCI limits (Hick's fails for
  familiar/automated/randomly-ordered choices; Fitts's degrades when distance and
  size both vary widely) — heuristics, not universals. ([Hick](https://en.wikipedia.org/wiki/Hick%27s_law), [Fitts](https://en.wikipedia.org/wiki/Fitts%27s_law))
- **Progressive disclosure (Nielsen).** Show the few important options first,
  specialised ones on request — but **>2 disclosure levels usually hurts usability.** ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/))
- **Permission prompts habituate.** Adherence *drops* over weeks as users tune out;
  **polymorphic (varying) warnings** resist habituation; sandboxing + signing/
  provenance are the structural complements. ([habituation](https://misq.umn.edu/misq/article/42/2/355/1716/Tuning-Out-Security-Warnings))

**For edot:** edot scores well here. **Deep modules:** the storage adapters
(GitHub/S3/WebDAV/Solid behind one `put/get/list/remove`), `DataEngine`, the ICS
engine, the OIDC client (injectable `fetch`) are simple interfaces over substantial
implementations. **Lossless pass-through:** `OPENDOC.md` is explicit that SQLite
round-trips losslessly while CSV/N-Quads are lossy — exactly the Must-Ignore honesty
RFC 9413 asks for (state what survives). **Tesler/progressive disclosure:** the
Save-to-GitHub redesign (cards + an "Options" disclosure, ≤2 levels), contextual
recents/merge, long-press labels — complexity pushed off the user. **Prompt
habituation:** relevant to the auth/permission and backup-passphrase flows — keep
prompts rare and meaningful. The gap is **versioning discipline**: no SemVer'd
contract for the data formats or a plugin API; Hyrum's Law says the moment anyone
builds on edot's exports or `BroadcastChannel` payloads, those become frozen
contracts.

---

## 6. Comparative table — extension models

| Model | Mechanism | Isolation | Versioning story | Capability scoping | Classic failure mode |
|---|---|---|---|---|---|
| **OLE/OpenDoc parts** | In-place binary parts (COM/SOM) over a container/Bento | In-process | None coherent | Coarse | Part-interop collapse; perf weight ([OpenDoc](https://en.wikipedia.org/wiki/OpenDoc)) |
| **Office COM/VSTO** | Native add-in into host object model | In-process, full trust | App-version coupled | None (full access) | Windows-only, fragile, blast radius ([transition](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/learning-path-transition)) |
| **Office.js add-in** | Manifest + hosted web app in webview | **Sandboxed iframe** | Manifest version + API requirement sets | **Permission levels** in manifest | Constrained API; stability friction ([office-js#6513](https://github.com/OfficeDev/office-js/issues/6513)) |
| **Google CardService** | Declarative cards, host-rendered | Hosted (no client code on surface) | Platform-managed | OAuth scopes + review | Limited expressiveness ([CardService](https://developers.google.com/workspace/add-ons/concepts/card-interfaces)) |
| **LibreOffice UNO** | Registered components + declarative add-on config | In-process | `.oxt` package versions | Coarse | Steep model; in-process ([UNO](http://www.openoffice.org/udk/common/man/componentmodel.html)) |
| **Browser WebExtension (MV3)** | Manifest + service worker + DNR rules | **Separate process, sandboxed** | Manifest v3; store review | **permissions + host permissions** | Capability loss (no blocking webRequest) ([MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)) |
| **Android Intent / iOS Extension** | Declarative filter / extension point; separate process | **Sandboxed process** | OS API levels | **System permissions / App Groups** | Implicit-intent hijack; limited host comms ([Android](https://developer.android.com/guide/components/intents-filters)) |
| **OSGi bundle** | Versioned bundles + service registry | In-JVM, per-bundle classloader | **SemVer, side-by-side versions** | Package import/export | Classloader/bundle hell ([OSGi](https://en.wikipedia.org/wiki/OSGi)) |
| **Eclipse / VS Code `contributes`** | **Declarative manifest contribution**, lazy activation | In-process (VS Code: ext host process) | Engine/API version in manifest | Declared activation/when | Contribution sprawl; perf of many exts ([VS Code](https://code.visualstudio.com/api/references/contribution-points)) |
| **edot today** | First-party web components; **BroadcastChannel/localStorage handoff**; URL-launched apps | **Separate pages**, message-passing; light-DOM in-page | **None formal** (SHA-256 fingerprint + build stamp only) | None (all first-party, same origin) | N/A yet — no 3rd-party surface |

The pattern: the models that *aged well* (Office.js, WebExtensions, VS Code,
Android) all pair **a declarative manifest** with **process/sandbox isolation** and
**explicit capability scoping**. edot's *internal* composition already matches the
late-bound message-passing row; what it lacks is a *contribution manifest* and (for
any third-party future) *sandbox + capabilities*.

---

## 7. The durable principles (vs the fashions)

**Durable (adopt):**
1. **Open, durable data substrate; editors are replaceable views.** (Local-first,
   ODF, OpenDoc's *surviving* idea.)
2. **Lossless pass-through of the unknown, stated honestly** — Must-Ignore +
   "here's what each format preserves." (RFC 9413, XML/protobuf.)
3. **Deep modules behind stable, narrow interfaces.** (Parnas/Ousterhout.)
4. **Declarative contribution + lazy activation** for UI surface. (Eclipse/VS Code.)
5. **Late binding via contracts/messages; capability-scoped isolation for untrusted
   code.** (Intents/Services/microkernel/capabilities.)
6. **Contextual, results-oriented, progressively-disclosed UI; don't adaptively
   hide.** (Ribbon; Tesler; Nielsen.)
7. **Light DOM by default; shadow only where isolation pays.** (web-components consensus.)

**Fashions / hazards (resist or time carefully):**
- *Compound binary parts* and *deep object-model add-ins* (interop collapse, blast
  radius). *Location transparency* (CORBA). *Runtime module federation across teams*
  before you have the version-skew discipline. *Adaptive menu hiding* (IntelliMenus).
  *Shadow DOM everywhere* (a11y/form leaks). *Permission-prompt spam* (habituation).
  Treating *"data ages like wine"* as automatic — it needs preserved context.

---

## 8. Applied to edot — scorecard

| Principle | edot today | Verdict |
|---|---|---|
| Open durable substrate | SQLite / zip-CSV / N-Quads exports, SHA-256, `OPENDOC.md`, IndexedDB-local | ✅ Strong |
| Editors-as-faces over one object | Datasheet / Spreadsheet / RDF faces | ✅ Strong (the OpenDoc idea, de-risked) |
| Lossless pass-through, stated | `OPENDOC.md` says what each format keeps | ✅ Good; extend to a "Must-Ignore" rule for unknown columns/quads |
| Deep modules / narrow interfaces | storage adapters, DataEngine, ICS, OIDC (injectable fetch) | ✅ Strong |
| Light DOM web components | Yes, throughout | ✅ Matches consensus |
| Late-bound message passing | BroadcastChannel + localStorage handoff; URL-launched apps | ✅ Good; needs a **documented payload contract** |
| Contextual / progressive-disclosure UI | GH dialog cards + Options; faces; long-press labels; recents/merge contextual | ✅ Good |
| Capability-scoped isolation | First-party only; auth tokens in web storage (XSS-reachable, flagged); JWKS deferred | ⚠️ Fine for first-party; **required** before any third-party plugin or Tier-2 backup |
| Command/action registry | **None** — hand-wired menus/toolbar | ❌ Gap |
| Declarative contribution point | **None** | ❌ Gap (the key extensibility enabler) |
| Versioned contract (formats / API) | Build stamp + content fingerprint only; no SemVer | ⚠️ Hyrum's-Law risk the moment anything depends on exports/handoff |

---

## 9. Decision: if/how edot should add extensibility

Three coherent options, in increasing ambition. **Recommended: A now, design B,
avoid C until there's a real third-party demand and a sandbox.**

- **A — Internal command/action registry + declarative contribution (do first).**
  Replace hand-wired `mi()`/`_btn` with a registry: each command = `{id, title,
  icon, when, run}`; toolbar/menu/face-switcher *render from the registry*, with
  `group`/`when` ordering (the VS Code/Eclipse model). This is pure first-party
  refactor — no security surface — and it (i) tidies the current UI, (ii) makes the
  Labels/long-press/contextual behaviour systematic, and (iii) is the *prerequisite*
  for any future plugin. Deep module, narrow interface. Aligns with §4, §5.
- **B — Same-origin, declarative *first-party-trusted* modules.** Let extra faces/
  panels register against the command registry and the data object via a small,
  **versioned** API (SemVer + a "Must-Ignore" rule so unknown contributions are
  preserved, not dropped). Keep it same-origin/trusted for now; document the payload
  + data-object contract (Hyrum's-Law insurance). This gets you OpenDoc's *good*
  part (pluggable faces) without its interop collapse, because the substrate is one
  SQLite/data object, not N binary parts negotiating formats.
- **C — Third-party untrusted plugins.** Only with **iframe sandbox + `postMessage`
  + explicit capability grants** (the Office.js / WebExtension / capability-security
  model), a manifest, and a permission model designed against *habituation*
  (rare, meaningful, ideally varying prompts; signing/provenance — edot already has
  the SHA-256 fingerprint gesture to build on). Do **not** expose same-origin DOM/
  data access to third-party code.

Why not jump to C: every domain's history says untrusted in-process extension =
blast radius (shell extensions) and trust friction (Office.js). Earn it with A and
B first.

---

## 10. Actionable checklist & complexity budget

**Extensibility checklist (apply to any new surface):**
- [ ] Is the new capability behind a **deep, narrow interface** (hides a likely-to-change secret)?
- [ ] Is UI contributed **declaratively** (registry/manifest) and rendered uniformly, or hand-wired again?
- [ ] Is the contribution **contextual** (`when`) rather than adaptively hidden?
- [ ] Is any cross-component link a **message/contract**, not an internal reference?
- [ ] For untrusted code: **isolated** (iframe/process) + **capability-scoped** (no ambient authority)?
- [ ] Is the data/API contract **versioned** (SemVer) and does it **pass unknown fields through unharmed**?
- [ ] Does the export **state what it preserves vs drops** (lossless honesty)?
- [ ] Are user-facing **prompts rare and meaningful** (anti-habituation)?
- [ ] ≤ **2 progressive-disclosure levels**; complexity pushed off the user?
- [ ] Light DOM unless isolation genuinely pays.

**Complexity budget (the Tesler ledger):** every feature relocates complexity.
Track *where it lands*. edot's current bet — absorb complexity into first-party deep
modules, keep the user surface contextual and shallow — is the right one. An
extension system *spends* budget by moving complexity onto an API contract and an
ecosystem; only spend it when the user value (third-party faces/connectors) exceeds
the permanent maintenance + Hyrum's-Law cost.

---

## 11. Open questions

1. **Does edot want third-party extensibility at all, or "maximal first-party
   coherence"?** (Conceptual integrity argues a curated suite may beat an open
   plugin bazaar for this product.)
2. **What is the canonical "data object" contract** that faces/plugins bind to —
   the SQLite schema? a normalized internal model? This is the OpenDoc
   "format-interop" question; answering it once, centrally, is what avoids the
   collapse.
3. **Versioning policy** for exports and `BroadcastChannel`/handoff payloads —
   adopt SemVer + a documented Must-Ignore rule *before* external dependence forms.
4. **Where does the Tier-2 capability service live** (the OIDC-gated key release) —
   the same backend would also unlock untrusted-plugin capability grants and the ICS
   CORS proxy. One small trusted service, three payoffs.
5. **Sandbox technology** if/when C: iframe + `postMessage` vs Web Workers vs the
   emerging `ShadowRealm` — each with different DOM/capability tradeoffs.

---

## 12. Consolidated sources

Office/compound docs: [OpenDoc](https://en.wikipedia.org/wiki/OpenDoc) · [OLE](https://en.wikipedia.org/wiki/Object_Linking_and_Embedding) · [instadeq OpenDoc postmortem](https://instadeq.com/blog/posts/why-opendoc-failed-and-then-failed-3-more-times/) · [Office add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/office-add-ins) · [VSTO→Office.js](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/learning-path-transition) · [office-js#6513](https://github.com/OfficeDev/office-js/issues/6513) · [Ribbon](https://en.wikipedia.org/wiki/Ribbon_(computing)) · [uxweek08 Ribbon notes](https://www.jurecuhalev.com/blog/jensen-harris-the-story-of-the-ribbon-office-2007-uxweek08-notes/) · [Designing the Ribbon](https://jensenharris.com/home/ribbon)

Substrates/declarative: [UNO component model](http://www.openoffice.org/udk/common/man/componentmodel.html) · [UNO](https://en.wikipedia.org/wiki/Universal_Network_Objects) · [OpenDocument](https://en.wikipedia.org/wiki/OpenDocument) · [CardService card interfaces](https://developers.google.com/workspace/add-ons/concepts/card-interfaces) · [Google restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [Local-first software](https://www.inkandswitch.com/essay/local-first/) · [Kleppmann local-first PDF](https://martin.kleppmann.com/papers/local-first.pdf) · ["ages like fish" counterpoint](https://infusedinnovations.com/blog/secure-intelligent-workplace/data-ages-like-fish-not-like-wine-a-fresh-take-on-data-management)

OS/shell/security: [MS shell + managed code](https://learn.microsoft.com/en-us/windows/win32/shell/shell-and-managed-code) · [Chrome MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) · [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) · [EFF on MV3](https://www.eff.org/deeplinks/2021/12/chrome-users-beware-manifest-v3-deceitful-and-threatening) · [Android intents/filters](https://developer.android.com/guide/components/intents-filters) · [iOS App Extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionOverview.html) · [macOS Services](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/SysServices/Articles/properties.html) · [Microkernel](https://en.wikipedia.org/wiki/Microkernel) · [Capability-based security](https://en.wikipedia.org/wiki/Capability-based_security)

Components/modules: [COM](https://en.wikipedia.org/wiki/Component_Object_Model) · [IUnknown](https://en.wikipedia.org/wiki/IUnknown) · [CORBA](https://en.wikipedia.org/wiki/Common_Object_Request_Broker_Architecture) · [OSGi](https://en.wikipedia.org/wiki/OSGi) · [JAR hell](https://en.wikipedia.org/wiki/Java_Classloader) · [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) · [Shadow DOM pros/cons](https://www.matuzo.at/blog/2023/pros-and-cons-of-shadow-dom/) · [HTML web components / light DOM](https://scottjehl.com/posts/html-web-components-shadow-dom/) · [Module Federation](https://webpack.js.org/concepts/module-federation/) · [MF version skew](https://microfrontend.dev/architecture/webpack-module-federation/) · [Islands](https://docs.astro.build/en/concepts/islands/) · [Eclipse plug-in architecture](https://www.eclipse.org/articles/Article-Plug-in-architecture/plugin_architecture.html) · [VS Code contributes](https://code.visualstudio.com/api/references/contribution-points) · [IoC via events](https://www.cshark.com/inversion-of-control-2-decoupling-through-events/) · [ECS](https://en.wikipedia.org/wiki/Entity_component_system)

Principles: [Parnas 1972 (MIT mirror)](http://sunnyday.mit.edu/16.355/parnas-criteria.html) · [Ousterhout PoSD](https://milkov.tech/assets/psd.pdf) · [Deep modules](https://softengbook.org/articles/deep-modules) · [No Silver Bullet](https://en.wikipedia.org/wiki/No_Silver_Bullet) · [Mythical Man-Month](https://en.wikipedia.org/wiki/The_Mythical_Man-Month) · [Hyrum's Law](https://www.hyrumslaw.com/) · [RFC 9413](https://www.rfc-editor.org/rfc/rfc9413.html) · [XML Must-Ignore](https://www.xml.com/pub/a/2004/07/21/design.html) · [Protobuf unknown fields](https://kmcd.dev/posts/protobuf-unknown-fields/) · [Tesler's Law](https://www.nomodes.com/larry-tesler-consulting/complexity-law) · [Hick's Law](https://en.wikipedia.org/wiki/Hick%27s_law) · [Fitts's Law](https://en.wikipedia.org/wiki/Fitts%27s_law) · [Progressive disclosure (NN/g)](https://www.nngroup.com/articles/progressive-disclosure/) · [Warning habituation (MISQ/BYU)](https://misq.umn.edu/misq/article/42/2/355/1716/Tuning-Out-Security-Warnings)

---

*Method note: five parallel research passes fetched primary sources (papers,
official docs, postmortems) and flagged contested claims; this synthesis preserves
those flags. Inaccessible primaries (Henning's "Rise and Fall of CORBA" 403; the
verbatim Parnas PDF; one EFF page 404) are noted where their claims are load-bearing.
The edot-applied analysis (§§ 1–11 "For edot" / scorecard / options / checklist) is
the report author's architectural assessment of the current codebase, not a cited
external claim.*
