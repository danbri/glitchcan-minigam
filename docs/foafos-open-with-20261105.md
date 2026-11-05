# Foafos: opening a file with another app

**Status: exploring.** This is a first slice, to learn from. The shape of `handles`, the verbs and the words may all change. It is steps 5 and 6 of [foafos-apps-20261022.md](foafos-apps-20261022.md): format handlers, and delegated capabilities.

## The problem

Solid and similar work set out to free data from apps. Keeping data in a pod is the easy part. The hard questions come when a second app opens it:

- **Which app can open this?** A media type says little: `.ttl` could be a contact, a map or a calendar.
- **How much may it reach?** An app often ends up with far more of a pod than the one file.
- **What survives a save?** An app can silently drop what it does not understand.
- **Who decides?** With no party between the apps, nobody does.

The Foafos shell sits between apps, so it can answer the last question, and help with the others.

## What exists

In a manifest (`inklet/finkapp/apps/*.jsonld`):

```json
"handles": [{
  "types": ["text/plain", "text/markdown"],
  "extensions": ["txt", "md"],
  "actions": ["view", "edit"],
  "comment": "A plain text editor. Markdown opens as its source, with no preview."
}]
```

`comment` is free text, written for people and agents choosing an app. It holds what a schema cannot say well, such as "slow with files over 100 MB", or "shows GIFs, but saving removes the animation". Show it whole. It is advice, never permission. An agent can weigh it, or raise it with the person.

`packages/foafos/src/handlers.mjs` matches a file to apps. The installation decides which apps are offered: an app must be in the root, and must hold `pod:read`.

## How a file is shared

1. Files calls `foaf.pod.handlers(path, type)`, and shows each app with its comment.
2. The person chooses. Files calls `foaf.pod.openWith(app, path, type)`.
3. The shell checks that the app handles that file, makes a share, and opens a new window.
4. That window calls `foaf.pod.shared()`, and receives `{ token, name, write }`.
5. It uses `foaf.pod.get('', { share })` and `foaf.pod.put('', body, { share })`.

Rules of a share:

- It reaches one file. The path an app sends is ignored.
- It belongs to one window, not to the app. It ends when that window closes.
- It allows reading and writing only: no listing, no deleting.
- It allows writing only if the handler says `edit` and the opener may write.
- It is apart from the app's own grants, which stay as they were.
- Saves use the same conflict check as any pod write.

`handlers` and `openWith` are for apps with `wholePod`. Any app may call `shared`.

An app needs its own pod grant before a share works: with no pod chosen for apps, it is refused. The share's write permission is fixed when it is made, so taking the opener's grant away later does not end it.

## Not solved yet

- Choosing by more than type and extension, for example by the shape of RDF data.
- Knowing what an app would lose on saving. `comment` can warn, and nothing enforces it.
- A remembered default app, and "always ask".
- Handing a file to an app that is already open.
- Sharing a folder, or several files.
- Binary files: pod verbs carry text.
- An app giving a share up before its window closes.
- An offer to a single-instance app, which has no new window to bind to.
