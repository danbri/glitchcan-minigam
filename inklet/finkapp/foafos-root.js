// Root manifests — what this installation IS on boot.
//
// The shell used to boot a story or nothing: `fink-config.js` named a
// DEFAULT_FINK_FILE and `fink-player.js` auto-loaded it, so the entry
// point was a story-player URL that had grown a shell around it. That
// made "foafos with only an office wrapper at root" impossible without a
// fork, which is a poor showing for something claiming apps are apps.
//
// A manifest says three things:
//
//   capabilities  what the ROOT holds. Every app is bounded by this,
//                 because the app tree attenuates: an app can never be
//                 granted what its parent does not hold, and root is
//                 everyone's ancestor. Trimming this list is the single
//                 blunt instrument for locking an installation down.
//   boot          what happens on start: a story to load, apps to open,
//                 or nothing at all.
//   apps          which app ids this installation offers. `null` means
//                 all of them.
//
// Select at runtime with `?root=<id>`. Unknown ids fall back to the
// default rather than booting into nothing, and say so.

export const ROOTS = {
  // The installation as it has always been: a story player with a shell
  // around it. Default, so nothing changes for anyone not asking.
  glitchcanary: {
    id: 'glitchcanary',
    label: 'Glitch Canary',
    capabilities: ['storage', 'vars:read', 'vars:write', 'audio', 'input',
                   'launch', 'navigate', 'chrome', 'same-origin'],
    boot: { story: null },        // null = fall back to FinkConfig.DEFAULT_FINK_FILE
    apps: null,                   // all of them
  },

  // The office wrapper alone. No story engine involvement at all: FINK is
  // simply unknown to this installation. This is the honest test of
  // whether apps are really apps — if the shell cannot boot without a
  // story, they are not.
  office: {
    id: 'office',
    label: 'Office',
    capabilities: ['storage', 'same-origin'],
    boot: { story: false, apps: ['edot'] },
    apps: ['edot', 'sheets', 'calendar', 'files', 'maker'],
  },

  // A TV. One media app, no story, no games, and deliberately NO
  // same-origin: a lean-back surface has no business holding the escape
  // hatch, and because root attenuates, nothing it opens can hold it
  // either. That is the capability tree doing real work in one line.
  webtv: {
    id: 'webtv',
    label: 'Web TV',
    capabilities: ['storage', 'audio', 'input'],
    boot: { story: false, apps: ['channels'] },
    apps: ['channels', 'robbamp', 'tellyclub'],
  },

  // Tellyclub as the whole installation: one lean-back app, nothing else.
  // The narrowest root here, and the point of it is that narrowness is
  // expressed as DATA — no code knows this configuration exists.
  tellyclub: {
    id: 'tellyclub',
    label: 'Tellyclub',
    capabilities: ['audio'],
    boot: { story: false, apps: ['tellyclub'] },
    apps: ['tellyclub'],
  },
};

export const DEFAULT_ROOT = 'glitchcanary';

/** Resolve the manifest for this run. Never returns null. */
export function resolveRoot(search = (typeof location !== 'undefined' ? location.search : '')) {
  let want = null;
  try { want = new URLSearchParams(search).get('root'); } catch (e) { /* no URL */ }
  if (want && ROOTS[want]) return { root: ROOTS[want], requested: want, fellBack: false };
  return { root: ROOTS[DEFAULT_ROOT], requested: want, fellBack: !!want };
}

/** Does this installation offer this app at all? */
export const rootOffers = (root, appId) => !root.apps || root.apps.includes(appId);
