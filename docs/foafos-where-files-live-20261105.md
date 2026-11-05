# Foafos: where your files live

Files lists every location and says, for the one in use, where it is, what it needs, and what could lose it. A person should never have to guess. The words come from `packages/foafos/src/locations.mjs`, so change them there.

## For someone using Foafos

| Location | Where the files are | Can Finder see them? | What it needs | What could lose them |
|---|---|---|---|---|
| A folder you added | That folder on your computer | Yes | Your OK once per visit, in Chrome or Edge | Moving or renaming it breaks the link. The files stay, and you add it again |
| This device | The browser's private storage | No | This browser on this computer | Clearing this site's data. The browser may also remove it if the disk runs low or the site goes unused, though Foafos asks it not to |
| This browser, with a sealed session | The browser, encrypted | No | Your session passphrase | Clearing site data, or forgetting the passphrase |
| This browser, without one | The tab's memory | No | Nothing | **Closing or reloading the tab** |
| A pod on this computer | A storage server's folder | Only that folder | The server running: `foafos-stack start lws` | As safe as that folder |
| A pod elsewhere | That server | No | A connection, and its password if it uses a relay | As safe as that server |

To keep something you can always find, add a folder.

## For developers

A location is a pod. Each has a `carriage`, which says how it is reached:

| Carriage | Reached through | Kept in |
|---|---|---|
| `device`, `device: 'folder'` | `deviceFetch` over a directory handle from `showDirectoryPicker` | The folder. Its handle is in IndexedDB `foafos-device` |
| `device`, `device: 'opfs'` | `deviceFetch` over OPFS | OPFS, under `foafos/` |
| `builtin` | The in-page LWS engine | IndexedDB `foafos-pods` while sealed, else memory |
| `https` | The browser's `fetch` | The server. It must send CORS headers |
| `xmpp` | XEP-0332 through a relay | The pod |

- `packages/foafos/src/device-fetch.mjs` answers in the HTTP that `FoafPods` already speaks, so the pod verbs, grants and `If-Match` conflict checks are the same everywhere. It refuses any path that leaves its root.
- Sandboxed apps have no origin, so they cannot use OPFS or a folder themselves. The shell holds the handles, and apps use `foaf.pod.*`.
- `foaf.pod.locations()`, `use(id)` and `addFolder()` are for apps with `wholePod: true` in their manifest. Others are refused, because a location names addresses. The choice is kept per app, under `foafos.location.APP`.
- Permission for a folder lasts a visit. The status is then `needs-ok`, and `pod.use` asks, because the person has just clicked. The click is in a sandboxed frame; browsers count activation in a child frame for its parents.

Tests: `packages/foafos/test/device-fetch.test.js`, and `inklet/finkapp/test/e2e-files-locations.mjs` in real Chrome with real OPFS. The browser's folder dialog cannot be automated, so that test stubs that one call. The native dialog and the permission prompt need trying by hand.

## Not done

Files carries text only: no image or audio preview, and no upload. There is no way yet to copy between locations, or to remove a folder from the list except in PodStore.

Removing a folder in PodStore leaves its handle in IndexedDB. Two tabs can both pass the conflict check on a device location, because the check and the write are separate steps, and two same-size edits in one file-system tick share an etag. These are low risk for one person.
