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
//                 all of them. This includes the CHROME apps — the
//                 breadcrumb, the status line, the load meter — because
//                 "what furniture does this installation have" is the
//                 same question as "what apps does it have", and used to
//                 be answered by a CSS rule painting over them instead.
//
// Select at runtime with `?root=<id>`. Unknown ids fall back to the
// default rather than booting into nothing, and say so.

export const ROOTS = {
  // The installation as it has always been: a story player with a shell
  // around it. Default, so nothing changes for anyone not asking.
  glitchcanary: {
    id: 'glitchcanary',
    // The DISPLAY name is Finkiverse (owner's call, July 2026). The id
    // stays `glitchcanary`: it is in shared `?root=` links, the storage
    // namespace and the per-root capability ledger, so renaming it would
    // orphan saved data and break links that are already out there. A
    // label is what people read; an id is what things are keyed by.
    label: 'Finkiverse',
    // `shell` is what the shell-native apps — Maker, Logger, and the
    // chrome furniture — declare. A root that offers them must hold it,
    // or the tree refuses to spawn them. It did: pressing Logger in the
    // Apps picker was a no-op for as long as that tile existed, because
    // launchApp went through attenuation and the drawer's own button
    // called openLogger() directly and so never noticed.
    capabilities: ['storage', 'secrets', 'vars:read', 'vars:write', 'audio', 'input',
                   'launch', 'navigate', 'chrome', 'shell', 'git:write', 'same-origin',
                   'story:launch', 'story:link', 'story:navigate'],
    boot: { story: null },        // null = fall back to FinkConfig.DEFAULT_FINK_FILE
    // The DIRECTION is set: the boxed runner (inklet/apps/storyrunner) is
    // the default story surface, and the host-page player is pending
    // delete (see fink-player.js / issue #779). The declared default below
    // is honoured by on-demand story loads and `?player=`; the bundled-
    // story AUTO-BOOT still uses 'legacy' until #779's parity blockers
    // close (minigame pause/resume, variables, navigation) — flipping it
    // now would regress Hampstead. One line flips it when #779 is green.
    // PARITY IS REACHED — and the flip is still one line, deliberately not
    // taken yet. Measured 2026-07-30: with `autoBoot: 'boxed'` the whole
    // journey works (TOC → Episodes → Hampstead, no errors), but FIVE
    // suites go red — e2e-foafos, e2e-root, e2e-caps, e2e-vars and
    // e2e-storyrunner's own media/audio legs all use "the legacy player
    // compiled a story on boot" as their fixture, not as their subject.
    // Flipping without migrating them first would leave master red for a
    // parallel session to trip over, and a green suite is how everyone
    // else here knows the tree is sound.
    //
    // So: `?player=boxed` is fully live and proven, `?player=legacy` is
    // the way back, and this line flips once those five fixtures are
    // rewritten to state which player they mean. See #779.
    storyPlayer: { default: 'boxed', autoBoot: 'legacy', supersedes: 'legacy',
                   parityReached: '2026-07-30', flipBlockedBy: 'test-fixtures', issue: 779 },
    apps: null,                   // all of them
  },

  // The office wrapper alone. No story engine involvement at all: FINK is
  // simply unknown to this installation. This is the honest test of
  // whether apps are really apps — if the shell cannot boot without a
  // story, they are not.
  office: {
    id: 'office',
    label: 'Office',
    // NO `same-origin` (July 2026). Every app this installation offers —
    // edot, Data, Calendar, Files — has been migrated onto the storage
    // broker, so the escape hatch has nothing left to serve. Dropping it
    // from the ROOT is the stronger statement: by attenuation, nothing
    // this installation opens can be granted it either, whatever a
    // registry entry might say. The office desktop is now fully sandboxed.
    //
    // `shell` because it offers Maker; `secrets` because it offers edot,
    // whose GitHub-backed saving holds a token; `git:write` so that saving
    // can happen as a brokered ACTION rather than by handing edot the token
    // — and it still does nothing until someone names a repo, because a
    // verb with no destination is refused. No `chrome`, `launch` or
    // `navigate`, and no chrome apps.
    //
    // AND THIS IS THE SECOND TIME. `shell` was a capability no root held,
    // so Maker and Logger could never launch; adding `secrets` to an app
    // without adding it here would have killed edot outright — caught by
    // e2e-caps, which reported "edot frame never appeared". A capability
    // nothing grants is not a safe default, it is a dead app. When adding
    // one to an app, add it to every root that offers that app.
    capabilities: ['storage', 'secrets', 'shell', 'git:write'],
    boot: { story: false, apps: ['edot'] },
    // No chrome ids here, so an office installation has no breadcrumb,
    // no story status line and no FINK load meter — not hidden, absent.
    // `publishing` because an installation that grants `git:write` and offers
    // no way to aim it has a capability nobody can use — the same
    // dead-capability shape as the `shell` and `secrets` bugs above, just
    // arriving from the UI side instead of the manifest side.
    apps: ['edot', 'sheets', 'calendar', 'files', 'maker', 'publishing'],
  },

  // THE TV — one root (owner's call, July 2026: "should be one"; there
  // were briefly two, webtv + a tellyclub-only root, which multiplied
  // installations instead of composing apps). Tellyclub, its broken-out
  // sub-apps, the Soundtrack and ROBBAMP all live here. Deliberately NO
  // same-origin — and since ROBBAMP's migration nothing needs it: a
  // lean-back surface holds no escape hatch, and because root attenuates,
  // nothing it opens can hold one either.
  webtv: {
    id: 'webtv',
    label: 'Telly',
    capabilities: ['storage', 'audio', 'input'],
    boot: { story: false, apps: ['tellyclub'] },
    apps: ['tellyclub', 'telly-guide', 'channels', 'robbamp'],
  },
};

// `?root=tellyclub` was a second TV installation for a while; folding it in
// must not strand anyone's bookmark, so the id aliases to the one TV root.
ROOTS.tellyclub = ROOTS.webtv;

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
