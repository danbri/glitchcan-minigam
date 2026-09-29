// Boot: start the shell's host services, then open what this installation
// boots. Stories run only in the story runner (inklet/apps/storyrunner), in
// a sandboxed frame; this page compiles no ink.
//
// What opens, first match wins:
//   the root manifest says boot.story === false   its boot apps, no story
//   ?player=none                                  nothing (tests, a bare shell)
//   ?app=<id> and no story named                  that app alone (the shell opens it)
//   otherwise                                     the runner, on the story the
//                                                 address names (?story=, #story=,
//                                                 #path.fink.js), else the root's
//                                                 boot story, else FinkConfig's

window.addEventListener('DOMContentLoaded', () => {
    window.FinkMinigames?.init?.();
    window.FinkBreadcrumb?.init?.();
    window.FinkAudio?.init?.();
    window.FinkFoley?.init?.();

    const params = new URLSearchParams(window.location.search);
    const story = window.FinkLinks?.storyFromLocation() || null;
    // REDIRECT to the one canonical address: `?story=<path>` (plus the knot
    // link in the hash, once the reader moves). `#story=…` and `#x.fink.js`
    // are old forms; after this the address always says what is being read.
    if (story && !params.get('story')) {
        params.set('story', story);
        const qs = params.toString().replace(/%2F/gi, '/');
        history.replaceState(history.state, '', `${location.pathname}?${qs}`);
    }
    const rootBoot = window.FoafOS?.root?.boot;
    if (!story && rootBoot && rootBoot.story === false) {
        setTimeout(() => { for (const id of (rootBoot.apps || [])) window.FoafOS.launchApp(id); }, 100);
        return;
    }
    if (params.get('player') === 'none') return;
    if (!story && params.get('app')) return;
    const bootStory = story || (rootBoot && rootBoot.story) || window.FinkConfig?.DEFAULT_FINK_FILE || null;
    setTimeout(() => {
        window.FoafOS?.setBootStory?.(bootStory);
        window.FoafOS?.launchApp?.('storyrunner');
    }, 150);
});
