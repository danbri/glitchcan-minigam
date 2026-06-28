# edot — cross-app capability graph (complete)

Every app, every kernel capability, every bus topic, and every edge between them
— derived from the code (`capabilities.provide`/`invoke`, `bus.publish`/
`subscribe`, and each app's Connections registration). Nothing curated out.

A pre-rendered image is committed alongside this file:

![edot cross-app capability graph](./ui-command-graph.png)

**Node colours:** blue = apps · gold = kernel capabilities · purple = bus topics ·
green = identity & storage.
**Edge legend:** dashed = `provides` (app offers a capability) · solid = `invokes`
(app calls one) · `publish`/notify = bus · `reg…`/`connect` = registers a
Connections account · `feeds`/storage links = identity & storage backing.

```mermaid
flowchart LR
  classDef app fill:#1f2a44,stroke:#6c8fd6,color:#dfe7ff,font-weight:bold;
  classDef cap fill:#3a2e16,stroke:#d6b25b,color:#ffe9c2;
  classDef bus fill:#2e1f3a,stroke:#b58bd6,color:#f1e2ff;
  classDef ids fill:#16302a,stroke:#5bb98f,color:#cfeede;

  %% Apps
  WS([🧩 Workspace]):::app
  ED([✍️ Editor]):::app
  DA([▦ Data]):::app
  SL([▤ Slides]):::app
  CA([📅 Calendar]):::app
  MA([✉️ Mail]):::app
  MP([🗺️ Maps]):::app
  GR([💬 Groups]):::app
  FI([🗂 Files]):::app
  CX([🔌 Connections]):::app
  BK([⤓ Backup]):::app
  AU([⚙ Automations]):::app
  PR([📦 Projects]):::app

  %% Capabilities
  cRun[[command.run]]:::cap
  cList[[command.list]]:::cap
  cSnap[[project.snapshot]]:::cap
  capCL[[connections.list]]:::cap
  capCC[[connections.capability]]:::cap
  capCI[[connections.identities]]:::cap
  capCA[[connections.activeIdentity]]:::cap
  capSS[[storage.source]]:::cap
  capEA[[editor.addData]]:::cap
  capSA[[slides.addData]]:::cap
  capDA[[data.addTable]]:::cap
  capGS[[groups.share]]:::cap

  %% Bus
  bCC{{connections:changed}}:::bus
  bDS{{data:share}}:::bus
  bPO{{project:open}}:::bus

  %% Identity & storage
  AS[(AuthSession · OIDC)]:::ids
  CXR[(Connections registry)]:::ids
  mOPFS[/OPFS device/]:::ids
  mGH[/GitHub Contents API/]:::ids
  mLFS[/Local folder · FS-Access/]:::ids
  mBR[/backup-store bridge/]:::ids

  %% provides (dashed)
  ED -.-> capEA
  DA -.-> capDA
  SL -.-> capSA
  GR -.-> capGS
  CXR -.-> capCL
  CXR -.-> capCC
  CXR -.-> capCI
  CXR -.-> capCA
  CXR -.-> capSS
  WS -.shell.-> cRun
  WS -.shell.-> cList
  WS -.shell.-> cSnap

  %% invokes (solid)
  SL ==> capGS
  CA ==> capGS
  CA ==> capDA
  MP ==> capGS
  MP ==> capDA
  ED ==> capCL
  ED ==> capSS
  FI ==> capCL
  FI ==> capSS
  CX ==> capCL
  CX ==> capCI
  CX ==> capCC
  CX ==> capSS
  AU ==>|any| cRun
  AU ==> cList
  PR ==> cSnap

  %% bus
  DA -->|publish| bDS
  bDS -->|→shell| capSA
  bDS -->|→shell| capEA
  PR -->|publish| bPO
  bPO -->|hydrate| WS
  CXR -->|publish| bCC
  bCC --> CX
  bCC --> FI

  %% register into Connections
  CA -->|reg local-calendar| CXR
  MA -->|reg mail| CXR
  GR -->|reg xmpp| CXR
  ED -->|connect GitHub| CXR
  CX -->|Add| CXR
  BK -->|reg backend| CXR

  %% identity + storage backing
  AS -->|feeds| capCI
  capSS --> mOPFS
  capSS --> mGH
  capSS --> mLFS
  capSS --> mBR
  CXR --- mOPFS
```

## How to read it

- A **capability node** (gold) is a hub: dashed edges in = who provides it, solid
  edges in = who calls it. `groups.share` is provided by **Groups** and invoked by
  **Slides / Calendar / Maps**; `storage.source` is provided by the **Connections
  registry** and invoked by **Editor / Files / Connections**.
- **Bus topics** (purple) fan out: **Data** publishes `data:share`, the shell
  relays it into `slides.addData` + `editor.addData`; **Projects** publishes
  `project:open` to hydrate **Workspace**; the registry publishes
  `connections:changed` to **Connections** + **Files**.
- **Connections registry** (green) is the gravity well: Calendar/Mail/Groups/
  Backup register accounts into it, Editor/Connections connect GitHub into it, and
  it hands out the storage mounts (OPFS/GitHub/local/bridge) that `storage.source`
  returns. **AuthSession** feeds it the OIDC identities.
- **Automations** is the universal client — `command.run` lets a script invoke any
  command (hence any capability) by id.

> Regenerate the image: extract the ```mermaid``` block and run mermaid-cli
> (`@mermaid-js/mermaid-cli`) with a chromium `executablePath`.
