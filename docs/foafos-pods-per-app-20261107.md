# Foafos: one shared pod, and extra pods for one app (2026-11-07)

Owner, 2026-11-07, verbatim: "system has both their common shared pod and optional extra pod(s). Apps discouraged from
podding without coordination."

Page: https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?root=office&app=pods (System, Pods tab).
Code: `packages/foafos/src/pods.mjs`, `drawExtras()` and the `d.type === 'pod'` branch in `inklet/finkapp/foafos-shell.js`,
`foaf.pod` in `inklet/apps/app-sdk.js`. Earlier design: `docs/foafos-pods-20261103.md`, `docs/foafos-system-pods-20261107.md`.

## Rules

| Rule | How it holds |
|---|---|
| The common pod stays `appsPod()` and the default for every app. | A call with no `pod` parameter goes where it went before. `syncPodGrants()` did not change. |
| Saved state needs no migration. | Extra grants have their own key, `foafos.pods.extras`. The `foafos.pods` list is not changed, and it is not written when it loads. |
| The UI says "shared pod". | The chip is "Shared pod". The buttons are "Make this the shared pod" and "Stop sharing with apps". The code names (`appsPod`, `forApps`) stay. |
| A person gives one app an extra pod in System. | Pods tab, section "Extra pods for one app": App, Extra pod, "Give access". `FoafPods.grantExtra(appId, pod)`. "Remove access" is `revokeExtra`. |
| Each app reaches only its own prefix in each pod. | An extra scope is always `apps/<appId>/`. A custom prefix or a whole pod is not possible for an extra pod. |
| An app cannot list pods, or learn their names or addresses. | No verb gives them. Each miss has the same answer (see below). Refusals no longer carry the pod id (see "A fault this found"). |
| An app cannot choose or add a pod, or ask for one. | No app verb reaches `grantExtra`. There is no request verb: a person who wants this goes to System. |
| The app sees a neutral handle. | `foaf.pod.extras()` gives `[{ handle, read, write }]`. `handle` is `extra-` and 16 random hex digits. |
| The grant screen warns. | "An app with two pods can copy data between them. Give an extra pod only to an app you trust with both pods." |
| Removing a pod removes its grants. | `remove()` deletes its extra grants and saves. |
| Removing the common pod leaves apps with no pod. | See "No shared pod". |

## The app's view

```js
const { extras } = await foaf.pod.extras();             // [] for almost every app
await foaf.pod.put('a.txt', 'text', { pod: extras[0].handle });
await foaf.pod.list('', { pod: extras[0].handle });
await foaf.pod.put('b.txt', 'text');                    // no handle: the shared pod
```

The present API allowed a handle with no new carriage: `get`, `put` and `delete` already passed their options on as
`params`. `list` now takes options too. `pod.extras` is the one new verb. All of it goes through the existing `type: 'pod'`
message to the shell. The FINK sandbox and the story runner frame did not change.

A handle is random and per app. Two apps with the same extra pod have different handles, so they cannot find out that it is
the same pod. A new grant after "Remove access" gets a new handle, so an old handle does not start to work again.

`params.pod` is a handle and nothing else. A pod's real id, its address, its label, another app's handle, a non-string and
nonsense all get the same answer, `{ ok: false, reason: 'denied', capability }`, before any network call. So an app cannot
test whether a name exists.

An app does not get a label for an extra pod. With two extra pods, it cannot say which is which, except by what it finds in
its own folder there. This is on purpose: a label is the person's own word, and it can say much.

## No shared pod

An extra scope needs the same capability on the app's shared-pod grant (`scopeFor`). That one line does three things:

1. An extra pod gives no new verb. A reader stays a reader, and an app with no `pod:*` capability gets nothing.
2. With no shared pod there are no grants (`syncPodGrants` returns early), so extra pods sleep. The plain call says `no-pod`,
   a call with a handle says `denied`, and `pod.extras` gives `[]`. This follows "leaves apps with no pod" as written. No
   extra pod is made the shared pod.
3. The person's grants stay saved. When there is a shared pod again they work again, with the same handles. The tab says
   this: "There is no shared pod now, so no app can use an extra pod."

If the owner wants an extra pod to work with no shared pod, that is a change to `scopeFor` and to `syncPodGrants`.

## A fault this found

`_refuse()` returned `{ pod: <id> }` to the app for `offline`, `locked` and `needs-ok`. So an app could read the id of the
shared pod when the pod was offline. The id now goes only to the shell's log (`pods.refused`). No app read that field.

## What this does not cover

- **Files is an exception, as before.** Files has `wholePod: true`. It can use `pod.locations`, `pod.use` and `pod.addFolder`,
  so it sees every pod's label and address, and it chooses among them. It is the person's file manager. It is the only app
  with `wholePod`. It is not offered in the extra-pod list, because it does not need that. This is in conflict with "an app
  cannot list pods" if the rule has no exceptions: the owner decides.
- **Same-origin apps.** An app with the `same-origin` capability would be in the shell's origin and could read
  `FoafOS.pods`. No app in the registry has it now (`inklet/finkapp/apps/robbamp.jsonld` records the last one).
- **Bus.** `pods.*` events name pods. A framed app hears only the topics of its manifest's `bus.subscribe`. No manifest
  names `pods.*` today, but nothing in the code stops a manifest from doing so.
- **Stored content.** The shell does not read what is in a file. A file that holds an address gives that address to the app
  that reads it.
- **Read-only extra grants.** An extra grant gives what the app's manifest holds. There is no "read only" choice. Add one if
  the owner wants it: the warning about copying applies to it too.
- **A prompt from the app.** There is none. It would give an app a way to push a person to agree. If the owner wants one,
  it must be a shell prompt, and it must not tell the app which pods exist.
- **Grants are per app id,** not per window. They are in `localStorage`, in clear, like the pod list. They hold no secret.
- `Files`-style "open with" shares (`pod.shared`) did not change. A share is one file, and `params.pod` has no effect on it.

## Test result (2026-11-07, macOS, headless Chrome)

| Suite | Result |
|---|---|
| `packages/foafos` `npm test` | 184 of 184 |
| `packages/foafos/test/pods.test.js` | 40 of 40 (11 new, 4 of them named NEGATIVE) |
| `packages/foafos/pod/test/e2e-system.mjs` | 61 of 61 (34 new checks) |
| `packages/foafos/pod/test/e2e-shell.mjs` | 22 of 22 |
| `inklet/finkapp/test/e2e-files-locations.mjs` | 28 of 28 |

`e2e-system.mjs` has a second local pod, and it sends raw `postMessage` requests from the real Pod Notes frame, so the
negative checks go through the real shell handler and not only through `FoafPods`. It ran with a local relay and pod and no
live server. `e2e-goal.mjs` was not run. No live pod was used.
