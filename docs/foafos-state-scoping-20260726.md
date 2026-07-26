# What should be shared between installations, and what should not

July 2026. Written in response to: *"I notice some app state, and some foafos
state (skin choice) appear to be shared across windows. Possibly between app
choices and roots. Should these be more isolated for UX and security reasons?"*

Short answer: **one of the five things sharing was wrong, and it is fixed. The
other four are sharing correctly, and per-root isolation would not have bought
security anyway — because a root is not a security boundary.**

## First, the thing that disqualifies "for security reasons"

`?root=office` is a **query parameter on one origin**. Anyone can type a
different one. Scoping storage per root therefore buys **nothing** against a
hostile user or a hostile page — they change the URL and read the other
root's keys. Anything sold as "isolated per installation, for security" would
be a false impression of separation, which is worse than visible sharing.

The boundaries that are real here:

| boundary | real? | why |
|---|---|---|
| the **origin** | yes | one origin for the whole shell; all roots share it |
| the **app sandbox** (opaque origin per frame) | yes | enforced by the browser; the thing e2e-caps tests by trying to cross it |
| the **app tree** (capability attenuation) | yes, *within a run* | `grant(child) ⊆ grant(parent)`, enforced at spawn |
| a **root** | **no** | a URL parameter; a presentation and offering choice |

So the question is really a UX question, plus one narrow "defence against our
own carelessness" case. Taking the five persisted things one at a time.

## 1. `foafos.op-scopes` — WAS WRONG, now scoped per root

**Measured before the fix:** aim edot's `git:write` at `danbri/private-notes`
under `?root=office` — an installation with four capabilities offering six
apps — then load `?root=` and launch edot. `ops.scopeFor('edot','git:write')`
returned the office destination, armed.

Why that matters more than the others: the story root holds `launch`,
`navigate` and `same-origin`, offers **every** app, and is where documents
from the Finkiverse run with their capability list *unenforced* (they run in
the host page; the list describes rather than constrains — see
`docs/foafos-alpha1.md`). So a decision made in a deliberately narrow
installation came back live in the broadest one.

A destination is not data, it is half of an authority: "commit to **this**
repo". The credential half was already better protected — secrets are
memory-only unless sealed, so a token does not survive the page load a root
switch requires. The aim survived unconditionally. Now:

```
foafos.op-scopes = { "<rootId>": { "<appId>": { "<capability>": scope } } }
```

Legacy unscoped blobs are **dropped, not migrated** — re-aiming is one tap in
Publishing, and silently inheriting an authority-adjacent decision into an
installation that never made it is the bug. Asserted in `e2e-caps`.

This is defence in depth, not a wall, and the code comment says so.

## 2. `foafos.skin` — sharing is right, but it is a taste call

One skin for the device, like an OS theme. A user who picks Paper because
they find Aurora hard to read means it everywhere, and a TV that reverted to
Spectrum because it is "a different installation" would read as a bug.

**The argument the other way is real** and it is danbri's to make: if an
installation is meant to feel like a separate appliance, the Web TV *should*
be allowed to look unlike the office. That is one line
(`foafos.skin:<rootId>`) whenever wanted. Not done unilaterally, because
"shared preference" and "per-appliance identity" are both coherent and only
one of them is what the owner means.

## 3. `foafos.store.<appId>` — sharing is right

The Soundtrack's last-tuned station lives under `foafos.store.channels`,
shared between `?root=webtv` and `?root=`. Same app, same device, same
person. Per-root would mean your station resets depending on which installation
you opened it from, which is surprising in the bad way. Note also that the app
id is the namespace — which is why renaming Channels to "Glitchcan Original
Soundtrack" deliberately did **not** rename the id.

## 4. `foafos.session.v1` + `foafos.secrets` — sharing is right, and guarded

An identity is a person, not an installation; asking someone to re-seal their
session per root would be user-hostile. And the guard that matters is already
stronger than root scoping: **without a passphrase, secrets are memory-only
and say so**. A token cannot cross a root switch — a navigation — unless the
user has sealed it *and* unlocks it again. That is a real gate, unlike a URL
parameter.

## 5. `shell:game-snapshots` — sharing is right

Closing Mudslider on one root and reopening it on another should find your
room, score and lives. The namespace is shell-owned and no guest can read it;
it is handed back as a `restore` message.

## And the visible defect in the same screenshots

The drawer was translucent over an app window — both unreadable through each
other. Measured `rgba(0, 20, 0, 0.6)`, `backdrop-filter: none`, z-index 2700
over the window's 2620: correctly on top and see-through, which is the worst
of the two.

This is the **same** bug as the shell panels, and I fixed the panels a few
hours earlier and did not check the drawer. Translucency is defensible for
chrome floating over prose you are reading; it is not defensible for a surface
carrying a passphrase field, a volume slider and six skin buttons.
`#foafos-drawer.open` is now opaque, asserted on the computed **alpha** in
`e2e-foafos` — because "it looks fine" is exactly what the panel fix claimed
while leaving this element behind.

## Summary

| state | scope | verdict |
|---|---|---|
| `foafos.op-scopes` | **per root** (changed) | was wrong: an aim from a narrow installation went live in the broad one |
| `foafos.skin` | device | right; per-root is a coherent alternative and danbri's call |
| `foafos.store.<appId>` | per app | right — the app is the unit, not the installation |
| `foafos.session.v1` / `foafos.secrets` | device | right; the passphrase is the real gate |
| `shell:game-snapshots` | device | right |

**Do not add per-root scoping to the rest as a security measure.** If it is
wanted, it is wanted for UX, and it should be described that way in whatever
UI exposes it.
