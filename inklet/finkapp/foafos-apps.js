// The installed apps — one registry, three families.
//
// This is the "is it really an OS?" test made concrete: an office suite,
// a game platform and a TV surface in ONE installation, launched the same
// way, listed the same way, switched between the same way.
//
// Everything here is a URL to something that already runs standalone.
// Nothing is a special case of anything else: the story engine is an app,
// the spreadsheet is an app, the channel player is an app. The shell's
// job is to host them, not to know what they are.
//
// Content lives here, not in packages/foafos — the NPM boundary rule.
// A shell shipped to someone else installs their apps, not danbri's.

export const APP_FAMILIES = [
  { id: 'office', label: 'Office', icon: '📄' },
  { id: 'play',   label: 'Play',   icon: '🎮' },
  { id: 'media',  label: 'Media',  icon: '📺' },
  { id: 'make',   label: 'Make',   icon: '🔧' },
];

// `audio: true` means "this app makes noise". Only those get a mute-
// coverage placeholder — otherwise the volume control's honest note
// ("X cannot be turned down") fills up with silent spreadsheets and
// stops being worth reading. The installer knows; the shell cannot.
//
// `kind` decides how the shell opens it:
//   window  — a shell window with an iframe (its own sandboxed process)
//   game    — hand to FinkMinigames (the WM owns game geometry)
//   story   — load into the story engine
//   panel   — a shell-native panel (Maker, settings…)
export const APPS = [
  // ── Office ────────────────────────────────────────────────────────
  { id: 'edot',      family: 'office', icon: '🗂️', name: 'edot',        kind: 'window',
    url: '../../magpie/edot/edot.html',            desc: 'The suite shell' },
  { id: 'sheets',    family: 'office', icon: '📊', name: 'Data',        kind: 'window',
    url: '../../magpie/edot/data/data.html',       desc: 'Spreadsheet, SQL, RDF' },
  { id: 'calendar',  family: 'office', icon: '📅', name: 'Calendar',    kind: 'window',
    url: '../../magpie/edot/calendar/calendar.html', desc: 'Days and plans' },
  { id: 'files',     family: 'office', icon: '📁', name: 'Files',       kind: 'window',
    url: '../../magpie/edot/files/',               desc: 'Pod explorer' },

  // ── Play ──────────────────────────────────────────────────────────
  // Games are declared by the minigame registry; these are the entries a
  // person would expect to see on a home screen.
  { id: 'robbin',      family: 'play', icon: '🐦', name: 'Robbin',     kind: 'game', game: 'robbin' },
  { id: 'gridluck',    family: 'play', icon: '👻', name: 'GridLuck',   kind: 'game', game: 'gridluck' },
  { id: 'mudslider',   family: 'play', icon: '⛏️', name: 'Mudslider',  kind: 'game', game: 'mudslider' },
  { id: 'battleboids', family: 'play', icon: '🧙', name: 'Boidwars',   kind: 'game', game: 'battleboids' },
  { id: 'chess',       family: 'play', icon: '♟️', name: 'Chess',      kind: 'game', game: 'chess' },
  { id: 'gems',        family: 'play', icon: '💎', name: 'Gem Hunt',   kind: 'game', game: 'gems' },

  // ── Media ─────────────────────────────────────────────────────────
  { id: 'channels', family: 'media', icon: '📻', name: 'Channels', kind: 'window', audio: true,
    url: '../apps/tv/index.html', desc: 'The tape library, as stations' },
  { id: 'robbamp',  family: 'media', icon: '🎛️', name: 'ROBBAMP', kind: 'window', audio: true,
    url: '../../magpie/robbin/robbin.html#robbamp', desc: 'The player' },

  // ── Make ──────────────────────────────────────────────────────────
  { id: 'toc',    family: 'make', icon: '📖', name: 'Stories', kind: 'story',
    url: '/glitchcan-minigam/inklet/toc.fink.js', desc: 'The table of contents' },
  { id: 'audiodemo', family: 'make', icon: '🔊', name: 'Audio demo', kind: 'story', audio: true,
    url: '/glitchcan-minigam/inklet/demos/audio-demo.fink.js', desc: 'mp3 beds + foley' },
  { id: 'maker',  family: 'make', icon: '🔧', name: 'Maker', kind: 'panel', panel: 'maker',
    desc: 'Variables, governance, debug clock' },
  { id: 'universe', family: 'make', icon: '🗺️', name: 'Finkiverse', kind: 'window',
    url: '../../docs/fink-universe.html', desc: 'Stories and widgets, mapped' },
];

export const appsByFamily = () =>
  APP_FAMILIES.map(f => ({ ...f, apps: APPS.filter(a => a.family === f.id) }))
    .filter(f => f.apps.length);

export const appById = (id) => APPS.find(a => a.id === id) || null;
