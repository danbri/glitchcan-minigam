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
//                    chrome  persistent shell furniture (breadcrumb, status
//                            line, load meter) — mounted at boot if the
//                            installation offers it, gone from the DOM if not
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
  { id: 'chrome', label: 'Chrome', icon: '🧩' },
];

export const APPS = [
  // ── Office ────────────────────────────────────────────────────────
  // These still hold `same-origin`: between them they use
  // localStorage/sessionStorage/indexedDB ~120 times and have not been
  // moved onto the store broker yet. Migrating them retires the hatch.
  // MIGRATED (July 2026). edot's own `same-origin` turned out to be
  // cargo cult: the page has no iframes to reach into, every localStorage
  // call was already try-wrapped, and `Library.create()` already tried
  // IndexedDB and fell back to a localStorage backend. All it needed was
  // for that fallback to land somewhere — app-sdk's shim over the broker.
  { id: 'edot', family: 'office', icon: '🗂️', name: 'edot', surface: 'window',
    url: '../../magpie/edot/edot.html', desc: 'The suite shell',
    capabilities: ['storage'], silent: true },
  // MIGRATED (July 2026). Data keeps one SQLite blob, and kept it in
  // IndexedDB — which an opaque origin refuses to open. Its engine now
  // picks a backend by trying, and falls back to the same blob base64'd
  // through the store broker. It reports which one is live, and a refused
  // write is announced rather than swallowed: this is the app where a
  // silent autosave failure costs the most.
  { id: 'sheets', family: 'office', icon: '📊', name: 'Data', surface: 'window',
    url: '../../magpie/edot/data/data.html', desc: 'Spreadsheet, SQL, RDF',
    capabilities: ['storage'], silent: true },
  // MIGRATED off the escape hatch (July 2026), and the first Office app to
  // manage it. It used IndexedDB, which an opaque origin refuses; its
  // store now falls back to the brokered key/value when IDB will not open,
  // so it keeps its indexes standalone and loses nothing but them here.
  { id: 'calendar', family: 'office', icon: '📅', name: 'Calendar', surface: 'window',
    url: '../../magpie/edot/calendar/calendar.html', desc: 'Days and plans',
    capabilities: ['storage'], silent: true },
  // MIGRATED (July 2026). Files stored nothing itself — its escape hatch
  // was bought for OPFS, which needs an origin to hang a storage bucket on
  // and so is refused outright in a sandboxed frame. It now probes the
  // device mount and falls back to BrokeredResourceSource: the same
  // list/read/write/remove/stat/mkdir interface over the shell's store.
  { id: 'files', family: 'office', icon: '📁', name: 'Files', surface: 'window',
    // files.html, not the directory: there is no index.html here, so the
    // bare path served a directory listing locally and would 404 on GitHub
    // Pages. The app had never actually loaded inside the shell.
    url: '../../magpie/edot/files/files.html', desc: 'Pod explorer',
    capabilities: ['storage'], silent: true },

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
  // Tellyclub — danbri's Archive.org TV browser, from the isle_of_glitch
  // repo, referenced at its deployed URL rather than vendored (it is
  // ~5.8MB, and it needs the network to stream from archive.org anyway).
  //
  // It is the best demonstration in this installation of the capability
  // model working on an app that knows nothing about foafos: it does NOT
  // load app-sdk.js, so it gets an opaque origin and its `localStorage`
  // throws — and it survives, because its author wrapped every storage
  // call in try/catch. Adaptation, not compliance, from the other side.
  //
  // NOT declaring `storage`: without app-sdk it cannot use the broker,
  // and claiming a capability nothing delivers is the exact lie this
  // registry keeps catching. The honest consequence is that its channel
  // and cast preferences do not persist between runs here. Adding one
  // script tag to a vendored copy would fix that.
  { id: 'tellyclub', family: 'media', icon: '📺', name: 'Tellyclub', surface: 'window',
    url: 'https://danbri.github.io/isle_of_glitch/tvp/app/',
    desc: 'Archive.org TV on a real broadcast schedule',
    capabilities: ['audio'], external: true, persists: false },

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
  { id: 'logger', family: 'make', icon: '📜', name: 'Logger', surface: 'panel', panel: 'logger',
    desc: 'The event bus, filterable — including everything refused',
    capabilities: ['shell'], silent: true },
  { id: 'universe', family: 'make', icon: '🗺️', name: 'Finkiverse', surface: 'window',
    url: '../../docs/fink-universe.html', desc: 'Stories and widgets, mapped',
    capabilities: [], silent: true },

  // ── Chrome ────────────────────────────────────────────────────────
  // The shell's own furniture, as apps.
  //
  // These were narrative decoration hardcoded into the page, and a
  // storyless installation dealt with them by CSS: a `:root[data-root-
  // storyless]` rule with `display: none !important`. That is the shape
  // of the mistake this whole exercise is about — the chrome still
  // existed, still had ids the story engine wrote into, and was merely
  // painted over. "Which parts of the UI exist" is exactly the kind of
  // question a root manifest should answer.
  //
  // So: `surface: 'chrome'`, `mount` names the element the shell adopts,
  // and an installation that does not list them simply does not have
  // them — out of the DOM, out of the tab order, out of the a11y tree.
  // They spawn into the app tree like everything else, appear in the
  // picker as toggles, and closing one from the switcher really removes
  // it. `capabilities: ['shell']` is honest: they are drawn by the shell
  // itself, so there is no frame and no boundary to enforce.
  { id: 'breadcrumb', family: 'chrome', icon: '🧭', name: 'Breadcrumb', surface: 'chrome',
    mount: 'breadcrumb-container', desc: 'The trail of knots you came through',
    capabilities: ['shell'], silent: true },
  { id: 'statusline', family: 'chrome', icon: '💎', name: 'Status line', surface: 'chrome',
    mount: 'stats-bar', desc: 'Whatever the story declared with # STATUS:',
    capabilities: ['shell', 'vars:read'], silent: true },
  { id: 'loadmeter', family: 'chrome', icon: '📜', name: 'Load meter', surface: 'chrome',
    mount: 'scroll-status-bar', desc: 'FINKs encountered, loaded, compiled',
    capabilities: ['shell'], silent: true },
];

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
