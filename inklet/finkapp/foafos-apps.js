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
//                    stage   the window manager's game window (full/split/pip)
//                    window  a floating shell window
//                    story   loaded into the story engine (not a frame)
//                    panel   shell-native UI (not a frame, no boundary)
//
//   `capabilities` — what it may do. Nothing is ambient; anything absent
//                    from this list is unavailable, and the app is told
//                    why rather than getting a bare SecurityError.
//
//                    storage      brokered per-app key/value (FoafStore)
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

export const APP_FAMILIES = [
  { id: 'office', label: 'Office', icon: '📄' },
  { id: 'play',   label: 'Play',   icon: '🎮' },
  { id: 'media',  label: 'Media',  icon: '📺' },
  { id: 'make',   label: 'Make',   icon: '🔧' },
];

export const APPS = [
  // ── Office ────────────────────────────────────────────────────────
  // These still hold `same-origin`: between them they use
  // localStorage/sessionStorage/indexedDB ~120 times and have not been
  // moved onto the store broker yet. Migrating them retires the hatch.
  { id: 'edot', family: 'office', icon: '🗂️', name: 'edot', surface: 'window',
    url: '../../magpie/edot/edot.html', desc: 'The suite shell',
    capabilities: ['storage', 'same-origin'], silent: true },
  { id: 'sheets', family: 'office', icon: '📊', name: 'Data', surface: 'window',
    url: '../../magpie/edot/data/data.html', desc: 'Spreadsheet, SQL, RDF',
    capabilities: ['storage', 'same-origin'], silent: true },
  { id: 'calendar', family: 'office', icon: '📅', name: 'Calendar', surface: 'window',
    url: '../../magpie/edot/calendar/calendar.html', desc: 'Days and plans',
    capabilities: ['storage', 'same-origin'], silent: true },
  { id: 'files', family: 'office', icon: '📁', name: 'Files', surface: 'window',
    url: '../../magpie/edot/files/', desc: 'Pod explorer',
    capabilities: ['storage', 'same-origin'], silent: true },

  // ── Play ──────────────────────────────────────────────────────────
  // Already isolated, and staying that way. `game` is the id the
  // minigame host knows this app by.
  { id: 'robbin', family: 'play', icon: '🐦', name: 'Robbin', surface: 'stage', game: 'robbin',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'] },
  { id: 'gridluck', family: 'play', icon: '👻', name: 'GridLuck', surface: 'stage', game: 'gridluck',
    capabilities: ['vars:read', 'vars:write'], silent: true },
  { id: 'mudslider', family: 'play', icon: '⛏️', name: 'Mudslider', surface: 'stage', game: 'mudslider',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'] },
  { id: 'battleboids', family: 'play', icon: '🧙', name: 'Boidwars', surface: 'stage', game: 'battleboids',
    capabilities: ['vars:read', 'vars:write', 'audio'] },
  { id: 'chess', family: 'play', icon: '♟️', name: 'Chess', surface: 'stage', game: 'chess',
    capabilities: ['vars:read', 'vars:write'], silent: true },
  { id: 'gems', family: 'play', icon: '💎', name: 'Gem Hunt', surface: 'stage', game: 'gems',
    capabilities: ['vars:read', 'vars:write'], silent: true },

  // ── Media ─────────────────────────────────────────────────────────
  { id: 'channels', family: 'media', icon: '📻', name: 'Channels', surface: 'window',
    url: '../apps/tv/index.html', desc: 'The tape library, as stations',
    capabilities: ['storage', 'audio'] },
  { id: 'robbamp', family: 'media', icon: '🎛️', name: 'ROBBAMP', surface: 'window',
    url: '../../magpie/robbin/robbin.html#robbamp', desc: 'The player',
    capabilities: ['storage', 'audio', 'same-origin'] },

  // ── Make ──────────────────────────────────────────────────────────
  // HONESTY NOTE, and it is not a small one. `surface: 'story'` is NOT
  // sandboxed. The narrative runtime (FinkInkEngine / FinkPlayer /
  // FinkUI) are host-page globals, so a story runs IN the shell's own
  // document, and its tags reach FinkAudio, FinkFoley, FinkMinigames,
  // FinkNavigation, FinkBreadcrumb and FoafOS directly. Nothing checks
  // these capability lists for stories — grep the engine for
  // "capabilit" and you get nothing.
  //
  // These lists therefore DESCRIBE what a story can do; they do not
  // constrain it. They previously said `[]`, which read as "less
  // privileged than a spreadsheet" when the truth is the opposite: a
  // story can launch apps, navigate the whole shell, restyle the host
  // document and be snapshotted, none of which any app can do.
  //
  // This matters beyond tidiness because the Finkiverse links out to
  // FINK documents we did not write. Gating these tags — so an untrusted
  // story can be denied `launch` and `navigate` — is the open work.
  { id: 'toc', family: 'make', icon: '📖', name: 'Stories', surface: 'story',
    url: '/glitchcan-minigam/inklet/toc.fink.js', desc: 'The table of contents',
    capabilities: ['audio', 'launch', 'navigate', 'chrome', 'vars:read', 'vars:write'],
    enforced: false, silent: true },
  { id: 'audiodemo', family: 'make', icon: '🔊', name: 'Audio demo', surface: 'story',
    url: '/glitchcan-minigam/inklet/demos/audio-demo.fink.js', desc: 'mp3 beds + foley',
    capabilities: ['audio', 'launch', 'navigate', 'chrome', 'vars:read', 'vars:write'],
    enforced: false },
  // Shell-native: drawn by the shell itself, so there is no frame and no
  // capability boundary. Listed here so there is ONE registry — but do
  // not read this row as "sandboxed with no capabilities".
  { id: 'maker', family: 'make', icon: '🔧', name: 'Maker', surface: 'panel', panel: 'maker',
    desc: 'Variables, governance, capabilities', capabilities: ['shell'], silent: true },
  { id: 'universe', family: 'make', icon: '🗺️', name: 'Finkiverse', surface: 'window',
    url: '../../docs/fink-universe.html', desc: 'Stories and widgets, mapped',
    capabilities: [], silent: true },
];

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
