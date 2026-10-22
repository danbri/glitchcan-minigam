// The installed apps — ONE class of thing.
//
// There used to be two: "apps" (office/media windows, which got
// `allow-same-origin` and therefore full ambient authority over the
// shell) and "minigames" (opaque-origin guests that had to ask for
// everything). Two classes meant two security postures, and only one of
// them was actually enforced — the other was a sandbox attribute doing no
// security work. It was also simply confusing to reason about.
//
// Now: everything is an app. Same protocol, same brokers, one registry.
// What differs is
//
//   `surface`      — where it is drawn. Presentation only, no authority.
//                    stage   the window manager's game window (full/split/pip).
//                            `game` is the name a `# APP:` tag uses
//                            (`aliases` adds more). `url` names the page,
//                            relative to finkapp/ like a window app's; with
//                            no `url` the page is minigames/<game>/index.html
//                            and its manifest.json. `inline: true` means the
//                            host draws it (gems), so no frame. This row is
//                            the ONLY list of games: the stage host reads it.
//                    window  a floating shell window
//                    story   loaded into the story engine (not a frame)
//                    panel   shell-native UI (not a frame, no boundary)
//                    chrome  persistent shell furniture (breadcrumb, status
//                            line, load meter, story menu, dev panel) —
//                            mounted at boot if the installation offers it,
//                            gone from the DOM if not. ALL of it, not a
//                            subset: the first pass converted three and left
//                            two hard-coded in index.html, which put a
//                            story-player menu on a Web TV.
//
//   `capabilities` — what it may do. Nothing is ambient; anything absent
//                    from this list is unavailable, and the app is told
//                    why rather than getting a bare SecurityError.
//
//                    storage      brokered per-app key/value (FoafStore)
//                    secrets      hand the shell a credential (FoafSecrets).
//                                 PUT and USE, never GET — separate from
//                                 `storage` because an app that may keep
//                                 preferences must not thereby get to keep
//                                 tokens, and because a store you can read
//                                 back is the wrong home for a secret.
//                    vars:read    read shared story variables
//                    vars:write   propose story variable changes
//                    audio        obey the master volume (and be mutable)
//                    input        receive the host pad / keyboard / gamepad
//                    geolocation  iframe allow= geolocation
//                    same-origin  ESCAPE HATCH — see below
//
// `same-origin` is a real capability with a real cost: it drops the app
// into the shell's own origin, where it can reach `parent.document` and
// the shell's storage directly, and every broker above becomes advisory.
// It exists so apps not yet migrated off ambient `localStorage` keep
// working. It is DECLARED rather than implicit, and the shell lists who
// holds it (drawer → CAPABILITIES). The goal is zero holders.
//
// `silent: true` means the app makes no sound — it stays out of the
// volume control's "cannot be turned down" list. Default is pessimistic.
//
// Content lives here, not in packages/foafos — the NPM boundary rule.
//
// THE ROWS ARE MANIFESTS (October 2026). Each app is one JSON-LD file,
// inklet/finkapp/apps/<id>.jsonld, holding its row and, in `notes`, the
// reasons that used to be comments here. `node inklet/tools/app-manifests.mjs`
// writes foafos-apps-data.js from them; `--check` validates them (JSON-LD
// with an inline @vocab, and SHACL, with @factoidal/core) and fails if the
// data module is stale.
// Design: docs/foafos-apps-20261022.md, section 4.

export const APP_FAMILIES = [
  { id: 'office', label: 'Office', icon: '📄' },
  { id: 'play',   label: 'Play',   icon: '🎮' },
  { id: 'media',  label: 'Media',  icon: '📺' },
  { id: 'make',   label: 'Make',   icon: '🔧' },
  { id: 'chrome', label: 'Chrome', icon: '🧩' },
];

// What each family of apps has in common (the per-app reasons are in the manifests).
//
// Office:
//   ALL FOUR are off the escape hatch as of July 2026. Each hit a different
//   wall — see docs/foafos-alpha1.md — and none of them holds `same-origin`
//   any more, which is why the office ROOT does not either.
//
// Play:
//   Already isolated, and staying that way. `game` is the id the minigame
//   host knows this app by.
//
// Make:
//   Stories open in the story runner (`opens`), each in its own window.
//
// Chrome:
//   The shell's own furniture, as apps.
//   These were narrative decoration hardcoded into the page, and a storyless
//   installation dealt with them by CSS: a `:root[data-root-storyless]` rule
//   with `display: none !important`. That is the shape of the mistake this
//   whole exercise is about — the chrome still existed, still had ids the
//   story engine wrote into, and was merely painted over. "Which parts of
//   the UI exist" is exactly the kind of question a root manifest should
//   answer.
//   So: `surface: 'chrome'`, `mount` names the element the shell adopts, and
//   an installation that does not list them simply does not have them — out
//   of the DOM, out of the tab order, out of the a11y tree. They spawn into
//   the app tree like everything else, appear in the picker as toggles, and
//   closing one from the switcher really removes it. `capabilities:
//   ['shell']` is honest: they are drawn by the shell itself, so there is no
//   frame and no boundary to enforce.

import { APPS } from './foafos-apps-data.js';
export { APPS };

/** The shell furniture, in mount order. */
export const chromeApps = () => APPS.filter(a => a.surface === 'chrome');

export const appsByFamily = () =>
  APP_FAMILIES.map(f => ({ ...f, apps: APPS.filter(a => a.family === f.id) }))
    .filter(f => f.apps.length);

export const appById = (id) => APPS.find(a => a.id === id) || null;

/** Apps still holding the ambient-authority escape hatch. Target: none. */
export const ambientApps = () => APPS.filter(a => (a.capabilities || []).includes('same-origin'));

/** Apps whose declared capabilities DESCRIBE rather than CONSTRAIN.
 *  Today: every `story` surface, because the narrative runtime is the
 *  host page. A list nobody enforces must say so. */
export const unenforcedApps = () => APPS.filter(a => a.enforced === false);

/** Every capability in use, for the inspector. */
export const allCapabilities = () =>
  [...new Set(APPS.flatMap(a => a.capabilities || []))].sort();
