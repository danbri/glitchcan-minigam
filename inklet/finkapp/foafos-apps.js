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
//                            `game` is the name a `# MINIGAME:` tag uses
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

export const APP_FAMILIES = [
  { id: 'office', label: 'Office', icon: '📄' },
  { id: 'play',   label: 'Play',   icon: '🎮' },
  { id: 'media',  label: 'Media',  icon: '📺' },
  { id: 'make',   label: 'Make',   icon: '🔧' },
  { id: 'chrome', label: 'Chrome', icon: '🧩' },
];

// Drift City's clues: the VARs its stories name in `# hotspot:` tags
// (drift-city/story/*.fink.js). A new clue in a story needs its name here, or
// the city cannot report finding it (the broker refuses an unlisted write).
const DRIFT_CLUES = ['card', 'ledger', 'minutes', 'oilcan', 'patch', 'reed', 'scale',
  'setlist', 'stone', 'tape', 'tenpo', 'ticket', 'voucher'];

export const APPS = [
  // ── Office ────────────────────────────────────────────────────────
  // ALL FOUR are off the escape hatch as of July 2026. Each hit a
  // different wall — see docs/foafos-alpha1.md — and none of them holds
  // `same-origin` any more, which is why the office ROOT does not either.
  //
  // MIGRATED (July 2026). edot's own `same-origin` turned out to be
  // cargo cult: the page has no iframes to reach into, every localStorage
  // call was already try-wrapped, and `Library.create()` already tried
  // IndexedDB and fell back to a localStorage backend. All it needed was
  // for that fallback to land somewhere — app-sdk's shim over the broker.
  // `secrets` because it really does hold a credential: its GitHub-backed
  // saving takes a token. Declared SEPARATELY from `storage` on purpose —
  // measured (July 2026), that token was landing in the storage broker in
  // plaintext on the shell's disk, because reading back what you wrote is
  // what a storage broker is for. See docs/foafos-secrets-and-auth-20260726.md
  { id: 'edot', family: 'office', icon: '🗂️', name: 'edot', surface: 'window',
    url: '../../magpie/edot/edot.html', desc: 'The suite shell',
    // `git:write` is a VERB capability, not a data one: it does not let edot
    // read a token, it lets it ask the shell to commit a file — and only to
    // wherever `FoafOS.aimOp` was pointed. With no destination configured,
    // holding it does nothing at all, which is the correct default for
    // something that writes to someone's repo. s3/solid ride the same rail
    // and are deliberately NOT declared until a caller exists for them:
    // declaring a capability no code uses is how a vocabulary starts lying.
    capabilities: ['storage', 'secrets', 'git:write'], silent: true },
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
    desc: 'Grow the flock across the Underground', controls: 'dpad',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'] },
  { id: 'gridluck', family: 'play', icon: '👻', name: 'GridLuck', surface: 'stage', game: 'gridluck',
    desc: 'Pac-Man style maze chase', controls: 'none',
    capabilities: ['vars:read', 'vars:write'], silent: true },
  { id: 'mudslider', family: 'play', icon: '⛏️', name: 'Mudslider', surface: 'stage', game: 'mudslider',
    desc: 'Boulder Dash-style puzzle', controls: 'lite',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'] },
  { id: 'battleboids', family: 'play', icon: '🧙', name: 'Boidwars', surface: 'stage', game: 'battleboids',
    desc: 'Command your wizard flock', controls: 'none',
    capabilities: ['vars:read', 'vars:write', 'audio'] },
  { id: 'chess', family: 'play', icon: '♟️', name: 'Chess', surface: 'stage', game: 'chess',
    desc: 'Classic strategy game', controls: 'none',
    capabilities: ['vars:read', 'vars:write'], silent: true },
  // Drawn by the host, not a frame: `inline`. `mega` is its gems mode.
  { id: 'gems', family: 'play', icon: '💎', name: 'Gem Hunt', surface: 'stage', game: 'gems',
    desc: 'Collect sparkling gems!', controls: 'none', inline: true, aliases: ['mega'],
    capabilities: ['vars:read', 'vars:write'], silent: true },
  // Skydock ran unregistered: the switcher showed it as a bare lowercase
  // "skydock" with a window glyph and CAPABILITIES none, because
  // appById() had nothing to answer with. It still WORKED — the legacy
  // FinkMinigames path is not capability-gated — which is exactly the
  // shape the tree exists to make visible rather than convenient.
  { id: 'skydock', family: 'play', icon: '🛰️', name: 'Skydock Scuttlebutt',
    surface: 'stage', game: 'skydock',
    desc: 'Gemstones and gossip on the night shift', controls: 'none',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'] },
  // The table of contents links it (`# MINIGAME: canarywharf`), but it was in
  // neither of the stage host's lists, so that link played Gem Hunt. Its
  // page (magpie/dbdb) writes the wharf variables and makes sound, and it
  // answers neither the audio nor the controls probe, so it holds neither.
  { id: 'canarywharf', family: 'play', icon: '🐤', name: 'Canary Wharf',
    surface: 'stage', game: 'canarywharf',
    desc: 'One small bird, one big skyline', controls: 'none',
    capabilities: ['vars:read', 'vars:write'] },
  // Drift city's graphic-novel page, played as a stage app: a sandboxed
  // guest with its own ink, launched by `# MINIGAME: cellar`. It lives
  // beside its content, so it names its page with `url`. It reads and
  // writes no story variable and its video is muted, so it holds nothing.
  // `exits=oskar` (Per Aspera's cellar) adds that story's "Sit in with Oskar"
  // as a way out; the way the reader left comes back as the result's score.
  { id: 'cellar', family: 'play', icon: '🏮', name: 'The Lantern Cellar',
    surface: 'stage', game: 'cellar', url: '../../drift-city/novel/cellar.html',
    desc: 'A graphic-novel page from Drift City', controls: 'none',
    args: ['exits'], capabilities: [], silent: true },
  // Drift City itself: the raymarched city on Titan (WebGPU, with a WebGL
  // fallback) and its stories. `# MINIGAME: drift tale=peraspera` opens it on
  // that story; `args` lists the only keys a story may pass. It obeys pause
  // and the master volume (audio), keeps its story saves as a snapshot, and
  // at a story's end offers the way back (drift-city/src/host.js). Its own
  // controls, so no host pad.
  // As a WORLD (`# WORLD: drift`, the story in the runner) it reads the
  // story's want_time and want_weather, and writes where you are, the hour
  // and the snow back to it. The clues are the story's VARs named by its
  // `# hotspot:` tags: read so a found one is not offered again, written
  // when the city finds one, and then the city re-enters the reader's scene
  // (story:steer). Autoplay: the reader taps the story, not the city, so the
  // city's sound must start without a tap in its own frame.
  { id: 'drift', family: 'play', icon: '🪐', name: 'Drift City',
    surface: 'stage', game: 'drift', url: '../../drift-city/dist/city.html',
    desc: 'The city on Titan and its stories', controls: 'sticks',
    args: ['tale'], capabilities: ['audio', 'vars:read', 'vars:write', 'story:steer'],
    variables: {
      read: ['want_time', 'want_weather', ...DRIFT_CLUES],
      write: ['here', 'hour', 'snowing', ...DRIFT_CLUES],
    },
    features: ['autoplay'],
    // From the launcher it opens the story runner on the Drift hub, whose
    // stories open the city as their world (`# WORLD: drift`): the story is
    // foafos's, not the city's own ink client.
    opens: 'storyrunner', story: '/glitchcan-minigam/drift-city/foafos-entry.fink.js' },
  // One Drift City cast member on the helmet comms feed, speaking a recorded
  // line: `# MINIGAME: talkinghead line=mags-3 [mood=wry]`. A rigged
  // Gaussian-splat head (LAM, synthetic faces only), mouth moved by the clip.
  // It plays without a tap in its frame, so it needs autoplay; it hands
  // control back when the line ends (drift-city/feed/index.html).
  { id: 'talkinghead', family: 'play', icon: '🗣️', name: 'Talking head',
    surface: 'stage', game: 'talkinghead', url: '../../drift-city/feed/index.html',
    desc: 'A Drift City face speaking a recorded line', controls: 'none',
    args: ['line', 'mood'], capabilities: ['audio'], features: ['autoplay'] },
  { id: 'waterworld', family: 'play', icon: '🫧', name: 'Waterworld', surface: 'stage', game: 'waterworld',
    desc: 'Submarine salvage in the drowned dock', controls: 'dpad',
    capabilities: ['input', 'vars:read', 'vars:write', 'audio'],
    // its scoped bus view: speak in its own namespace, hear the shell
    // surfaces that shape it (this is also the stage default, spelled out)
    bus: { publish: ['guest.waterworld.*'], subscribe: ['wm.mode', 'audio.volume', 'story.state'] } },

  // ── Media ─────────────────────────────────────────────────────────
  // The id stays `channels` after the July 2026 rename: it is the store
  // namespace (`foafos.store.channels` — changing it silently orphans
  // someone's last-tuned station), the name three root manifests list, and
  // what a dozen assertions launch. A display name is a display name.
  { id: 'channels', family: 'media', icon: '📻', name: 'Glitchcan Original Soundtrack',
    surface: 'window', url: '../apps/tv/index.html',
    desc: 'The tape library, as stations',
    capabilities: ['storage', 'audio'] },
  // The narrative runtime, BOXED — a story compiled and played entirely in
  // an opaque-origin frame, reaching the shell only through story:* verbs
  // (spec §5.7, threat model 2026-07-28). It is the only story engine.
  // NO same-origin: it is a real box. story:launch lets a # MINIGAME: tag
  // ask the shell to open a (separately boxed) guest — up AND down.
  // FINKOSPHERE — the boxed story engine (owner's name, July 2026). The id
  // stays `storyrunner`: it is in `?app=` links, the snapshot key
  // (`app:storyrunner`), the capUse ledger and the e2e suites. A label is
  // what people read; an id is what things are keyed by.
  { id: 'storyrunner', family: 'play', icon: '📖', name: 'Finkosphere',
    surface: 'window', url: '../apps/storyrunner/index.html',
    desc: 'A FINK story, sandboxed all the way up', featured: true,
    // no `story` override: the runner defaults to its own ./demo.fink.js,
    // resolved relative to the RUNNER frame (a finkapp-relative path would
    // resolve against the wrong base once fetched inside the box)
    // It holds what it CONFERS: a minigame it launches becomes its child,
    // and attenuation requires the child's caps ⊆ the runner's. So the
    // runner carries input + vars:read/write on behalf of the games it
    // instantiates — the capability border is real, not cosmetic.
    // `story:observe` is the LEVEL-1 job from the layer model: this app is the
    // observability point for the story subtree beneath it. It is a separate
    // capability from playing, so a runner that should only play can be handed
    // a list without it and the shell will refuse the verb.
    // `story:steer` it holds only to confer: a world it opens (`# WORLD:`) may
    // ask the story to re-enter the reader's scene (spec §5.8).
    capabilities: ['story:launch', 'story:link', 'story:navigate', 'story:observe',
                   'story:steer', 'audio', 'input', 'vars:read', 'vars:write'],
    bus: { publish: ['app.storyrunner.*'], subscribe: ['wm.mode', 'audio.volume', 'ui.skin'] } },
  // MIGRATED (July 2026) — and it was the LAST `same-origin` holder, so the
  // whole registry is now sandboxed. Found because the ROBBAMP tile was DEAD
  // on the TV root: the root (correctly) holds no escape hatch, attenuation
  // refused the spawn, and 27 winampesque visualizer modes were unreachable
  // from the surface built for lean-back listening. danbri asked where the
  // visualizations went; this line is where. app-sdk now fronts robbin's 24
  // bare localStorage calls (probe: standalone keeps native storage).
  { id: 'robbamp', family: 'media', icon: '🎛️', name: 'ROBBAMP', surface: 'window',
    url: '../../magpie/robbin/robbin.html#robbamp', desc: 'The player',
    capabilities: ['storage', 'audio'] },
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
  // Tellyclub's widgets, broken OUT as sub-apps (owner's direction, July
  // 2026) rather than reachable only from inside the running TV. The
  // channel guide is the first: tvp's hash router gained `#guide`, so this
  // is the same app booted straight into its EPG. More of tellyclub's
  // internal widgets (controller, venues) can follow the same pattern —
  // each is one hash route in tvp plus one line here.
  { id: 'telly-guide', family: 'media', icon: '📋', name: 'Channel Guide', surface: 'window',
    url: 'https://danbri.github.io/isle_of_glitch/tvp/app/#guide',
    desc: "What's on, across every Tellyclub channel",
    capabilities: ['audio'], external: true, persists: false },

  // ── Make ──────────────────────────────────────────────────────────
  // Stories open in the story runner (`opens`), each in its own window.
  { id: 'toc', family: 'make', icon: '📖', name: 'Stories', surface: 'window', opens: 'storyrunner',
    story: '/glitchcan-minigam/inklet/toc.fink.js', desc: 'The table of contents',
    capabilities: [], silent: true },
  { id: 'audiodemo', family: 'make', icon: '🔊', name: 'Audio demo', surface: 'window', opens: 'storyrunner',
    story: '/glitchcan-minigam/inklet/demos/audio-demo.fink.js', desc: 'mp3 beds + foley',
    capabilities: [] },
  // Shell-native: drawn by the shell itself, so there is no frame and no
  // capability boundary. Listed here so there is ONE registry — but do
  // not read this row as "sandboxed with no capabilities".
  { id: 'maker', family: 'make', icon: '🔧', name: 'Maker', surface: 'panel', panel: 'maker',
    desc: 'Variables, governance, capabilities', capabilities: ['shell'], silent: true },
  // Who said or did what in every app (spec §5.10): the talking heads' live card and the history, in a window the
  // shell manages, not over an app's pane
  { id: 'activity', family: 'make', icon: '💬', name: 'Activity', surface: 'panel', panel: 'activity',
    desc: 'Who said or did what, in every app', capabilities: ['shell'], silent: true },
  { id: 'logger', family: 'make', icon: '📜', name: 'Logger', surface: 'panel', panel: 'logger',
    desc: 'The event bus, filterable — including everything refused',
    capabilities: ['shell'], silent: true },
  // Where an app's brokered actions POINT, and where its credential is
  // typed in. Both belong to the shell: a token an app collects is a token
  // an app has held, however briefly, and a destination an app can choose
  // is not a boundary. This panel is the reason `git:write` is reachable by
  // a person rather than only by a test.
  { id: 'publishing', family: 'make', icon: '🔑', name: 'Publishing', surface: 'panel',
    panel: 'publishing', desc: 'Aim an app\'s brokered actions, and hold its key',
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
  { id: 'menubar', family: 'chrome', icon: '📊', name: 'Menubar', surface: 'chrome',
    mount: 'foaf-menubar', desc: 'A clock and app dashboard widgets, grouped by the app tree',
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
