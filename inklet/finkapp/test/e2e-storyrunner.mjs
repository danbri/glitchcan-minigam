#!/usr/bin/env node
// FinkStoryRunner — the narrative runtime, BOXED. Sandboxed all the way UP.
//
// Proves the story+runtime containment the live host-side player lacks:
//   · the runner compiles and PLAYS a real ink story entirely inside its
//     own opaque-origin frame (prose + a choice tree)
//   · it has NO host reach: parent.FoafOS / parent.FinkInkEngine throw
//     (opaque origin — the SecurityError IS the boundary working)
//   · a story's # BG: colours the RUNNER's frame, never the host body
//   · a # MINIGAME: tag does NOT launch anything directly — it surfaces as
//     a capability-checked story.launch REQUEST the shell governs, and the
//     launched guest is itself boxed (up AND down)
//   · story:launch is refused when the capability is withheld
//
//   node inklet/finkapp/test/e2e-storyrunner.mjs

import { spawn } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const repoName = basename(repoRoot);
const PORT = 8184;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Sandboxed app frames have opaque origins: their module imports and story
// fetch need CORS locally (GitHub Pages sends ACAO:* in production).
const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', ${PORT}),
    functools.partial(H, directory='${serveRoot}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

let failures = 0;
const fail = (m) => { console.error('✖', m); failures++; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({
    headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

  // `?player=none` — this suite LAUNCHES the runner itself and reads its
  // frame, so the page must start with no story surface of its own. Without
  // it, the installation's own boxed boot puts a second runner in the page
  // (playing the installation's story, not the runner's demo) and every probe
  // below reads whichever frame it finds first.
  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=none`);
  await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // record governed story.requests on the shell bus before we launch
  await page.evaluate(() => {
    window.__srLog = [];
    FoafOS.bus.subscribe('story.request', (e) => window.__srLog.push(e.data));
  });

  // launch the boxed runner
  await page.evaluate(() => FoafOS.launchApp('storyrunner'));
  let frame = null;
  for (let i = 0; i < 40 && !frame; i++) {
    frame = page.frames().find((f) => f.url().includes('apps/storyrunner'));
    if (!frame) await page.waitForTimeout(400);
  }
  if (!frame) throw new Error('storyrunner frame never appeared');
  await frame.waitForFunction(() => window.__storyrunner?.ready?.(), null, { timeout: 20000 });
  pass('boxed runner compiled and started a story in its own frame');

  // ── 1. it PLAYED: prose + a choice tree rendered in-frame ────────────
  const played = await frame.evaluate(() => {
    const s = window.__storyrunner.state;
    return { prose: s.prose.length, choices: s.choices.length, bg: s.bg };
  });
  if (played.prose >= 1 && played.choices >= 1) {
    pass(`story played in-frame (${played.prose} prose, ${played.choices} choices)`);
  } else fail('runner did not render a playable beat: ' + JSON.stringify(played));

  // ── 1b. THE BOOT ECONOMY READ succeeded. seedEconomy() runs on every
  // story load and does story.vars op:'read'; the shell must answer it, not
  // throw. A method-name slip (vars.visibleTo, which never existed — the
  // method is filterReadable) made every read reply "refused: failed" and
  // painted it at the foot of the demo. state.economy is only set when the
  // read comes back ok, so a non-null object is proof the path works.
  const econ = await frame.evaluate(() => ({
    economy: window.__storyrunner.state.economy,
    status: document.getElementById('status')?.textContent || '',
  }));
  if (econ.economy && typeof econ.economy === 'object' && !/refused/.test(econ.status)) {
    pass(`boot story.vars read succeeded (economy seeded: ${JSON.stringify(econ.economy)})`);
  } else fail(`boot story.vars read failed: ${JSON.stringify(econ)}`);

  // ── 2. # BG: coloured the RUNNER's frame, never the host ─────────────
  const bg = await frame.evaluate(() => document.body.style.background);
  const hostBg = await page.evaluate(() => document.body.style.background);
  if (/10, 31, 20/.test(bg)) {
    pass(`# BG: styled the runner frame (${bg})`);
  } else fail('BG not applied in frame: ' + JSON.stringify({ bg, recorded: played.bg }));
  if (!/10, 31, 20/.test(hostBg)) pass('host body was NOT restyled by the story');
  else fail('story reached the HOST background: ' + hostBg);

  // ── 3. NO host reach: parent globals are unreachable (opaque origin) ──
  const reach = await frame.evaluate(() => {
    const probe = (fn) => { try { return fn() ? 'reached' : 'absent'; } catch (e) { return 'blocked:' + e.name; } };
    return {
      foafos: probe(() => window.parent.FoafOS),
      engine: probe(() => window.parent.FinkInkEngine),
      doc: probe(() => window.parent.document.body),
    };
  });
  const contained = Object.values(reach).every((v) => v !== 'reached');
  if (contained) pass(`no host reach from the box (${JSON.stringify(reach)})`);
  else fail('BOX LEAKS to host: ' + JSON.stringify(reach));

  // ── 3b. boxes within boxes: the story's JS ran in a NESTED sandbox, ──
  // not in the runner frame. The demo's file-level JS sets __stpr_canary;
  // if it had run in the runner frame, the runner window would carry it.
  const inner = await frame.evaluate(() => ({
    boxed: !!window.__storyrunner.state.boxedCompile,
    canaryInRunner: typeof window.__stpr_canary,     // 'undefined' when boxed
  }));
  if (inner.boxed && inner.canaryInRunner === 'undefined') {
    pass('compile step nested in its own box — story JS never touched the runner');
  } else fail('inner box leaked: ' + JSON.stringify(inner));

  // ── 4. MEDIA ROLES: a per-beat spectrum, each sized differently ──────
  const mediaAt = () => frame.evaluate(() => {
    const stage = document.getElementById('stage');
    const el = document.querySelector('#media .media-el');
    const mb = document.getElementById('media').getBoundingClientRect();
    return {
      role: stage.getAttribute('data-media-role'),
      spec: window.__storyrunner.state.mediaSpec,
      tag: el && el.tagName, src: el && (el.getAttribute('src') || ''),
      // DID IT LOAD? An <img> with a bad src still lays out (0px tall) and
      // still reports role + tag, so geometry alone cannot tell a pinned
      // image from a broken one — a layered-resolution regression sailed
      // past this check reporting "0/809px" as a pass. naturalWidth is the
      // only honest answer for an image.
      loaded: !el ? false
        : el.tagName === 'IMG' ? el.naturalWidth > 0
        : el.tagName === 'IFRAME' ? !!el.src
        : el.readyState !== undefined ? el.readyState > 0 || !!el.src : !!el.src,
      mediaH: Math.round(mb.height), stageH: Math.round(stage.getBoundingClientRect().height),
    };
  });
  await page.waitForTimeout(300);
  const feat = await mediaAt();
  if (feat.role === 'feature' && feat.spec === 'X-MEDIA-FEATURE' && feat.tag === 'IMG'
      && feat.loaded && feat.mediaH > 20) {
    pass(`feature: pinned image LOADED, prose below (${feat.mediaH}/${feat.stageH}px)`);
  } else fail('feature media wrong: ' + JSON.stringify(feat));

  // ── 4b. AUDIO plays IN THE RUNNER'S OWN FRAME (the iOS fix). The bed is
  // an <audio> element in the boxed document, so the choice tap that ends a
  // beat is a gesture in the SAME document iOS wants for playback — a
  // host-brokered story.audio verb cannot carry that user-activation across
  // the frame border. So: # AUDIO: is NOT brokered, and it is playing.
  const audio0 = await frame.evaluate(() => ({
    src: window.__storyrunner.state.audio,
    playing: window.__storyrunner.state.audioPlaying,
    brokered: window.__storyrunner.state.requests.some(
      (r) => r.verb === 'story.audio' && r.detail?.action === 'play'),
  }));
  if (audio0.src && /ambient\.wav/.test(audio0.src) && audio0.playing && !audio0.brokered) {
    pass('# AUDIO: played in the runner frame (gesture-unlockable on iOS), not brokered');
  } else fail('audio not played in-frame: ' + JSON.stringify(audio0));
  await page.evaluate(() => FoafOS.audio.setVolume(0.25));
  await page.waitForTimeout(300);
  const lvl = await frame.evaluate(() => window.__storyrunner.state.audioLevel);
  if (lvl <= 0.26) pass(`shell master volume reaches the runner (level ${lvl})`);
  else fail('master volume did not reach the runner: ' + lvl);
  await page.evaluate(() => FoafOS.audio.setVolume(1));

  // → hero: the media owns the screen; a YouTube id becomes a nocookie embed
  await frame.evaluate(() => window.__storyrunner.choose(0));
  await page.waitForTimeout(400);
  const hero = await mediaAt();
  if (hero.role === 'hero' && hero.spec === 'X-MEDIA-HERO' && hero.tag === 'IFRAME'
      && /youtube-nocookie\.com\/embed\/0123456789a/.test(hero.src) && hero.mediaH >= hero.stageH * 0.8) {
    pass(`hero: video owns the screen (${hero.mediaH}/${hero.stageH}px), nocookie embed`);
  } else fail('hero media wrong: ' + JSON.stringify(hero));

  // → accent: text leads; media is a small thumbnail
  await frame.evaluate(() => window.__storyrunner.choose(0));
  await page.waitForTimeout(400);
  const acc = await mediaAt();
  if (acc.role === 'accent' && acc.spec === 'X-MEDIA-ACCENT' && acc.mediaH < acc.stageH * 0.5) {
    pass(`accent: small thumbnail, text leads (${acc.mediaH}/${acc.stageH}px)`);
  } else fail('accent media wrong: ' + JSON.stringify(acc));

  // ── 4c. MENUBAR: the story's # STATUS: (fired at the accent beat) surfaces
  // as a dashboard widget in the shell menubar, GROUPED under the app in the
  // tree; a clock is always present. This is the hierarchy the parallel
  // view lacked — a story's readout at its own level, a minigame's nested.
  await page.waitForTimeout(400);
  const menubar = await page.evaluate(() => {
    const el = document.getElementById('foaf-menubar');
    const grp = el?.querySelector('.mb-group[data-app="storyrunner"]');
    return {
      mounted: !!(window.FoafMenubar && window.FoafMenubar._state().mounted),
      clock: !!el?.querySelector('.mb-clock'),
      group: !!grp,
      text: grp?.textContent || '',
    };
  });
  if (menubar.mounted && menubar.clock && menubar.group && /torch/.test(menubar.text)) {
    pass(`menubar: clock + storyrunner group with the story's readout ("${menubar.text.trim()}")`);
  } else fail('menubar wrong: ' + JSON.stringify(menubar));

  // ── 5. # FINK: LINK — the shell authorizes, the runner loads the peer
  // story IN ITS BOX, and the peer's own # MINIGAME: becomes a governed
  // launch. One flow proves link-following AND cross-story containment.
  await frame.evaluate(() => window.__storyrunner.choose(0));   // doorway → # FINK
  await frame.waitForFunction(
    () => /peer\.fink\.js/.test(window.__storyrunner.state.linkedTo || '')
      && window.__storyrunner.state.prose.some((p) => /different dock/.test(p.text)),
    null, { timeout: 8000 });
  pass('# FINK: followed an authorized link — peer story loaded in the box');

  const linkReq = await frame.evaluate(() =>
    window.__storyrunner.state.requests.find((r) => r.verb === 'story.link'));
  if (linkReq) pass('the link went through story.link (shell-authorized), not a raw fetch');
  else fail('no story.link request recorded');

  const launchReq = await frame.evaluate(() =>
    window.__storyrunner.state.requests.find((r) => r.verb === 'story.launch'));
  if (launchReq && launchReq.detail?.game === 'waterworld') {
    pass("peer story's # MINIGAME: surfaced as a governed story.launch");
  } else fail('minigame tag did not become a governed request: ' + JSON.stringify(launchReq));

  // the Running ⓘ "utilized" ledger counts BOTH narrative effects
  const use = await page.evaluate(() => FoafOS.capUse('storyrunner') || {});
  if ((use['story:link'] || 0) >= 1 && (use['story:launch'] || 0) >= 1) {
    pass(`capUse tallied story:link (${use['story:link']}) and story:launch (${use['story:launch']})`);
  } else fail('capUse ledger missing a story:* use: ' + JSON.stringify(use));

  // ── 5b. THE BORDERS ARE REAL, AND THERE ARE THREE OF THEM ───────────
  // The layer model (docs/foafos-story-layering-20260730.md) says a launched
  // game is a child of the SESSION that launched it, the session is a child
  // of the StoryRunner, and the runner is a child of the root:
  //
  //     root (0) → Finkosphere (1) → story session (2) → game (3)
  //
  // This leg used to assert the game was a direct child of the RUNNER, which
  // was true and one level too coarse: with one node for the runner there was
  // nowhere to say WHICH playthrough opened the game, so two stories in one
  // runner would have hung their games off the same parent.
  await page.waitForTimeout(400);
  const tree = await page.evaluate(() => {
    const apps = FoafOS.apps;
    const all = [...apps.nodes.values()];
    const runner = all.find((n) => n.appId === 'storyrunner');
    const session = all.find((n) => n.appId === 'story-session');
    const game = all.find((n) => n.appId === 'waterworld');
    return {
      runner: !!runner, session: !!session, game: !!game,
      sessionLabel: session?.label || null,
      sessionUnderRunner: !!(runner && session && session.parentId === runner.id),
      gameUnderSession: !!(session && game && game.parentId === session.id),
      sessionDepth: session ? apps.depth(session.id) : null,
      gameDepth: game ? apps.depth(game.id) : null,
      sessionCapsBounded: !!(runner && session
        && session.capabilities.every((c) => runner.capabilities.includes(c))),
      gameCapsBounded: !!(session && game
        && game.capabilities.every((c) => session.capabilities.includes(c))),
    };
  });
  if (tree.sessionUnderRunner && tree.gameUnderSession
      && tree.sessionDepth === 2 && tree.gameDepth === 3
      && tree.sessionCapsBounded && tree.gameCapsBounded) {
    pass(`three borders real: root → runner → session "${tree.sessionLabel}" (depth 2) → game (depth 3), caps attenuating at each step`);
  } else fail('layer tree wrong: ' + JSON.stringify(tree));

  // Cascade is NOT asserted here on purpose: closing the session would kill
  // the game that legs 5a/5c/8 still need. Section 8 presses the window ✕ and
  // proves the whole runner subtree — which now contains the session — comes
  // down together.

  // ── 5e. OBSERVABILITY IS SCOPED TO THE SUBTREE ──────────────────────
  // The runner is the observability point for the story subtree (level 1),
  // and the whole value of that claim is the WORD "its own". So: open an app
  // that is NOT beneath the runner, and prove the runner never hears it. The
  // filter lives in the shell because a guest cannot be trusted to discard
  // what it should not see — by then it has already seen it.
  const watched = await frame.evaluate(() => ({
    observing: window.__storyrunner.observing(),
    lines: window.__storyrunner.observed(),
  }));
  watched.observing
    ? pass('the runner is watching its own subtree (story:observe granted)')
    : fail('the runner never started observing');
  watched.lines.some((l) => /session began/.test(l))
    ? pass(`it read its own session start as a story event ("${watched.lines.find((l) => /session began/.test(l))}")`)
    : fail(`session start not observed: ${JSON.stringify(watched.lines)}`);
  watched.lines.some((l) => /Waterworld/i.test(l))
    ? pass('and the game it launched, by name')
    : fail(`launched game not observed: ${JSON.stringify(watched.lines)}`);

  // A sibling app, outside the subtree. Logger is a shell app under root.
  const before = watched.lines.length;
  await page.evaluate(() => FoafOS.launchApp('logger'));
  await page.waitForTimeout(1500);
  const after = await frame.evaluate(() => window.__storyrunner.observed());
  const leaked = after.slice(before).filter((l) => /logger/i.test(l));
  leaked.length === 0
    ? pass(`a sibling app outside the subtree stayed invisible to the runner (${after.length - before} new line(s), none of them Logger)`)
    : fail(`observation leaked outside the subtree: ${JSON.stringify(leaked)}`);

  // And the person can see that watching is happening — observation is a
  // power, so it is announced rather than silent.
  const disclosed = await page.evaluate(() =>
    (FoafOS.bus.retained('story.observe')[0] || {}).data || null);
  disclosed && disclosed.watching === true && /watching its own subtree/.test(disclosed.summary || '')
    ? pass(`the shell disclosed the watch ("${disclosed.summary}")`)
    : fail(`watching was not disclosed on the bus: ${JSON.stringify(disclosed)}`);
  const useLedger = await page.evaluate(() => FoafOS.capUse('storyrunner') || {});
  (useLedger['story:observe'] || 0) >= 1
    ? pass(`and tallied it in the ledger (story:observe ${useLedger['story:observe']})`)
    : fail(`story:observe not in the capability ledger: ${JSON.stringify(useLedger)}`);

  // ── 5a. PARITY (#779 blockers 1+2): pause, writeback, economy ───────
  // The runner used to fire story.launch and carry straight on, so a
  // story that says "play, then use what you won" ran the "then" while
  // the game was still on screen, with the pre-game values — every
  // chess/gems/waterworld ending was unreachable. peer.fink.js is the
  // fixture: it declares shared VARs, pauses on # MINIGAME:, and spends
  // what the game wrote.
  {
    const paused = await frame.evaluate(() => ({
      paused: window.__storyrunner.paused(),
      pausedFor: window.__storyrunner.state.pausedFor,
      choices: document.querySelectorAll('#choices button').length,
    }));
    paused.paused && paused.pausedFor === 'waterworld' && paused.choices === 0
      ? pass('the story PAUSED on # MINIGAME: — no choices while the game plays')
      : fail(`story did not pause for its game: ${JSON.stringify(paused)}`);

    // The guest earns treasure the way a guest does: from inside its own
    // frame, over the real protocol, so the manifest check is real.
    const guest = page.frames().find((f) => /waterworld/.test(f.url()));
    if (!guest) fail('no waterworld guest frame to earn anything');
    else {
      await guest.evaluate(() => {
        parent.postMessage({ type: 'set-variable', name: 'diamonds', value: 7 }, '*');
        parent.postMessage({ type: 'set-variable', name: 'score', value: 240 }, '*');
        parent.postMessage({ type: 'set-variable', name: 'keys', value: 99 }, '*');  // NOT in its manifest
      });
      await page.waitForTimeout(700);
      const economy = await page.evaluate(() => ({
        mirror: FoafOS.storyVars.all(),
        denied: FoafOS.vars.log.filter((l) => !l.ok).map((l) => l.name),
      }));
      economy.mirror.diamonds === 7 && economy.mirror.score === 240
        ? pass(`a boxed story's economy is brokered shell-side (${JSON.stringify(economy.mirror)})`)
        : fail(`guest writes lost under the boxed runner: ${JSON.stringify(economy)}`);
      economy.mirror.keys === undefined && economy.denied.includes('keys')
        ? pass('a write outside the guest manifest is DENIED, not silently applied')
        : fail(`variable governance not enforced: ${JSON.stringify(economy)}`);
    }

    // End the game through the host's own completion entry point.
    await page.evaluate(() => FinkMinigames.handleMinigameComplete(
      { type: 'waterworld', success: true, score: 240 }));
    await page.waitForTimeout(1400);
    const resumed = await frame.evaluate(() => ({
      paused: window.__storyrunner.paused(),
      diamonds: window.__storyrunner.varOf('diamonds'),
      score: window.__storyrunner.varOf('score'),
      choices: document.querySelectorAll('#choices button').length,
      prose: document.getElementById('prose')?.textContent || '',
    }));
    !resumed.paused && resumed.choices > 0
      ? pass('the story RESUMED where the tag broke the beat')
      : fail(`story did not resume: ${JSON.stringify(resumed)}`);
    resumed.diamonds === 7 && resumed.score === 240
      ? pass('completion wrote back into the boxed story\'s own ink')
      : fail(`writeback failed: diamonds=${resumed.diamonds} score=${resumed.score}`);
    // The assertion that matters: the beat SPENDS the winnings. A tag
    // binds to the line that FOLLOWS it, so a fixture with the tag after
    // its lead-in breaks on the post-game line and prints stale values —
    // this catches that whole class.
    /7 diamond/.test(resumed.prose) && /240/.test(resumed.prose)
      ? pass('the after-game beat printed the values the game produced')
      : fail(`beat used stale values: "${resumed.prose.slice(-120)}"`);

    const spend = await frame.evaluate(() => window.__storyrunner.spend('diamonds', 3));
    const left = await page.evaluate(() => FoafOS.storyVars.all().diamonds);
    spend.ok && left === 3
      ? pass('a story SPENDS through the broker (7 → 3), never by reaching in')
      : fail(`brokered spend failed: ${JSON.stringify({ spend, left })}`);
    const priv = await frame.evaluate(() => window.__storyrunner.spend('secret_plot_flag', 1));
    priv.ok === false && priv.reason === 'not-shared'
      ? pass('a private variable is refused BY NAME — the boundary is the shared set')
      : fail(`a private variable was brokered: ${JSON.stringify(priv)}`);
  }

  // ── 5d. media / status / synth parity (#779) ────────────────────────
  // The peer story declares `# BASEHREF: ./`, two `# STATUS:` items and
  // `# AUDIO: synth:water`. All three used to be missing or refused.
  {
    const parity = await frame.evaluate(() => ({
      basehref: window.__storyrunner.state.basehref,
      // The shell hands over the installation-wide layer; a boxed story
      // cannot read fink-config.js for itself.
      mediaBase: window.__storyrunner.state.mediaBase,
      resolved: window.__storyrunner.state.media?.resolved || null,
      status: window.__storyrunner.state.status,
      bar: [...document.querySelectorAll('#statusbar .sb-item')].map((s) => s.textContent),
      barHidden: document.getElementById('statusbar')?.hidden,
      foley: window.__storyrunner.state.foley,
      audioReq: window.__storyrunner.state.requests
        .filter((r) => r.verb === 'story.audio').map((r) => r.detail?.action),
    }));
    parity.basehref === './'
      ? pass('# BASEHREF: read — the story\'s own media layer')
      : fail(`BASEHREF ignored: ${JSON.stringify(parity.basehref)}`);
    // Resolution must go through the chain, not straight off the story URL:
    // with BASEHREF "./" the two agree here, so assert the mechanism ran by
    // checking the src is absolute and inside the runner's own folder.
    /\/apps\/storyrunner\/media-feature\.svg$/.test(parity.resolved || '')
      ? pass(`media resolved through the layered chain (${parity.resolved.split('/').slice(-2).join('/')})`)
      : fail(`layered media resolution wrong: ${parity.resolved}`);
    parity.bar.length === 2 && /💎/.test(parity.bar[0]) && /Score/.test(parity.bar[1])
      ? pass(`# STATUS: built the real status bar, keyed by var (${parity.bar.join(' · ')})`)
      : fail(`status widget wrong: ${JSON.stringify(parity)}`);
    parity.foley === 'water' && parity.audioReq.includes('foley')
      ? pass('# AUDIO: synth: routed to the host FinkFoley over the governed verb')
      : fail(`synth audio not routed: ${JSON.stringify(parity)}`);
  }

  // ── 5c. DREAM STACK (#779): goDeeper descends, END pops mid-breath ──
  // The depth is the SHELL's count, not the story's claim — a story that
  // could report its own depth could claim 0 from inside a dream and
  // switch off the read-only rule on the shared economy.
  {
    const dive = await page.evaluate(async () => {
      const f = document.querySelector('iframe[src*="storyrunner"]');
      // Ask through the governed verb, exactly as a # LINKREL: goDeeper does.
      const before = FoafOS.storyDepth('storyrunner');
      f.contentWindow.postMessage({ type: 'noop' }, '*');   // keep the frame live
      return { before };
    });
    void dive;
    // Drive the real path: the runner asks, the shell decides.
    const asked = await frame.evaluate(() => window.foaf.storyRequest('story.link',
      { url: new URL('./dream.fink.js', location.href).href, rel: 'goDeeper' }));
    await page.waitForTimeout(300);
    const deep = await page.evaluate(() => ({
      shell: FoafOS.storyDepth('storyrunner'),
      vars: FoafOS.vars.depth,
    }));
    asked.ok && asked.depth === 1 && deep.shell === 1 && deep.vars === 1
      ? pass('goDeeper: the shell counts the depth and the broker knows it')
      : fail(`depth not tracked shell-side: ${JSON.stringify({ asked, deep })}`);

    // Inside a dream the shared economy is READ-ONLY (spec + FoafVars).
    const dreamSpend = await frame.evaluate(() => window.__storyrunner.spend('diamonds', 999));
    dreamSpend.ok === false
      ? pass('a dream cannot spend the waking world — shared economy read-only at depth')
      : fail(`a dream spent the shared economy: ${JSON.stringify(dreamSpend)}`);

    // The cap is real, and refusing is a story-visible outcome.
    let capped = null;
    for (let i = 0; i < 9; i++) {
      capped = await frame.evaluate(() => window.foaf.storyRequest('story.link',
        { url: new URL('./dream.fink.js', location.href).href, rel: 'goDeeper' }));
      if (!capped.ok) break;
    }
    capped && capped.ok === false && capped.reason === 'depth-cap'
      ? pass(`the dream refuses past the cap (depth ${capped.depth})`)
      : fail(`no depth cap: ${JSON.stringify(capped)}`);

    // Surface all the way back so later sections start from the waking world.
    for (let i = 0; i < 12; i++) {
      const up = await frame.evaluate(() => window.foaf.storyRequest('story.link',
        { url: new URL('./demo.fink.js', location.href).href, rel: 'surface' }));
      if (up.depth === 0) break;
    }
    const back = await page.evaluate(() => ({ shell: FoafOS.storyDepth('storyrunner'), vars: FoafOS.vars.depth }));
    back.shell === 0 && back.vars === 0
      ? pass('surfacing returns the shell and the broker to depth 0')
      : fail(`depth stuck after surfacing: ${JSON.stringify(back)}`);
  }

  // ── 5b. attenuation ENFORCES — it does not merely announce ──────────
  // The check above passes trivially: waterworld's declared caps happen
  // to sit inside the runner's. The question that matters is what an
  // OVER-privileged game does. Until 2026-07-29 the answer was: the
  // shell published a refusal, skipped the node — and the guest played
  // on regardless, invisible to the Running panel and impossible to
  // pause or close. Refusing authority has to mean the thing stops.
  {
    // close the running game, then make waterworld ask for more than the
    // runner holds
    await page.evaluate(async () => {
      const { appById } = await import('./foafos-apps.js');
      window.FinkMinigames?.endMinigame?.();
      await new Promise((r) => setTimeout(r, 400));
      const ww = appById('waterworld');
      window.__attnSaved = ww.capabilities;
      ww.capabilities = [...ww.capabilities, 'git:write'];   // runner holds no git:write
    });
    const reply = await frame.evaluate(() =>
      window.foaf.storyRequest('story.launch', { game: 'waterworld' }));
    await page.waitForTimeout(1200);
    const outcome = await page.evaluate(() => ({
      node: [...FoafOS.apps.nodes.values()].some((n) => n.appId === 'waterworld'),
      guestActive: !!window.FinkMinigames?.active,
    }));
    if (reply && reply.ok === false && reply.reason === 'attenuation'
        && !outcome.node && !outcome.guestActive) {
      pass('attenuation ENFORCES: an over-privileged game is refused and never runs');
    } else {
      fail('attenuation only announced: ' + JSON.stringify({ reply, ...outcome }));
    }
    // put the registry back and restore the child the control section needs
    await page.evaluate(async () => {
      const { appById } = await import('./foafos-apps.js');
      appById('waterworld').capabilities = window.__attnSaved;
    });
    await frame.evaluate(() => window.foaf.storyRequest('story.launch', { game: 'waterworld' }));
    await page.waitForTimeout(2000);
  }

  // ── 6. POLICY: a cross-origin link is refused; unknown verbs too ─────
  const xorigin = await frame.evaluate(() =>
    window.foaf.storyRequest('story.link', { url: 'https://evil.example/x.fink.js' }));
  if (xorigin && xorigin.ok === false && xorigin.reason === 'cross-origin-blocked') {
    pass('a cross-origin link is refused (policy v0: same-origin only)');
  } else fail('cross-origin link not blocked: ' + JSON.stringify(xorigin));
  const refusal = await frame.evaluate(() =>
    window.foaf.storyRequest('story.smuggle', { anywhere: 'evil.example' }));
  if (refusal && refusal.ok === false && refusal.reason === 'unknown-verb') {
    pass('an unknown narrative verb is refused with a named reason');
  } else fail('deny path wrong: ' + JSON.stringify(refusal));

  // ── 7. the DEFAULT is switched to boxed; the host player is flagged ──
  const direction = await page.evaluate(() => ({
    declaredDefault: FoafOS.root?.storyPlayer?.default,
    autoBoot: FoafOS.root?.storyPlayer?.autoBoot,
    legacyPending: window.FinkPlayer?.PENDING_DELETE === true,
    legacyIssue: window.FinkPlayer?.trackingIssue,
  }));
  if (direction.declaredDefault === 'boxed' && direction.legacyPending && direction.legacyIssue === 779) {
    pass(`default surface = boxed; host player flagged pending-delete (auto-boot ${direction.autoBoot} until #${direction.legacyIssue})`);
  } else fail('default switch / pending-delete flag wrong: ' + JSON.stringify(direction));

  // ── 8. CONTROL border (LAST — it detaches the runner frame): closing the
  // runner subtree tears down its child game. Real control, real cascade.
  const cascade = await page.evaluate(async () => {
    const apps = FoafOS.apps;
    const before = [...apps.nodes.values()].some((n) => n.appId === 'waterworld');
    // Press the button a PERSON presses. This used to call win.remove()
    // alone: the box vanished while the node and every app it had
    // launched stayed alive, so closing a story left its game running
    // under a parent nobody could see (field report, 2026-07-29). The
    // API-level apps.close() was already correct — testing only that
    // missed the whole defect, because closing is revoking authority and
    // the affordance is where a person does it.
    const win = document.querySelector('.foafos-window iframe[src*="storyrunner"]')?.closest('.foafos-window');
    if (!win) return { before, noWindow: true };
    win.querySelector('.foafos-window-close').click();
    await new Promise((r) => setTimeout(r, 600));
    const ids = [...apps.nodes.values()].map((n) => n.appId);
    return { before, after: ids.includes('waterworld'), runnerGone: !ids.includes('storyrunner'),
             windowGone: !document.querySelector('.foafos-window iframe[src*="storyrunner"]') };
  });
  if (cascade.before && !cascade.after && cascade.runnerGone && cascade.windowGone)
    pass('control border real: the window ✕ closed the runner AND its child game');
  else fail('the window close button did not cascade: ' + JSON.stringify(cascade));

  // ── 9. SAVE / RESTORE the playthrough (#779, spec §5.5.4) ───────────
  // Runs LAST because section 8 closed the runner — reopening is exactly
  // the case under test. Closing used to lose the whole reading: the
  // runner holds no `storage` and the shell cannot reach into its ink, so
  // the state travels by the snapshot contract, now offered to WINDOW apps
  // and not only stage games. The bytes sit in the SHELL's namespace, so
  // no app can read another's save, and a root without `storage` never
  // gets the grant and never persists.
  {
    const kept = await page.evaluate(() =>
      Object.keys(FoafOS.store.snapshot(FoafOS.snapshotNs) || {}));
    kept.includes('app:storyrunner')
      ? pass("closing the runner kept its playthrough in the shell's namespace")
      : fail(`nothing kept on close: ${JSON.stringify(kept)}`);

    await page.evaluate(() => FoafOS.launchApp('storyrunner'));
    let re = null;
    for (let i = 0; i < 40 && !re; i++) {
      re = page.frames().find((f) => f.url().includes('apps/storyrunner'));
      if (!re) await page.waitForTimeout(300);
    }
    if (!re) fail('runner did not reopen');
    else {
      await re.waitForFunction(() => window.__storyrunner?.ready?.(), null, { timeout: 20000 });
      await page.waitForTimeout(700);
      const back = await re.evaluate(() => ({
        resumed: window.__storyrunner.state.resumedFromSave,
        url: (window.__storyrunner.state.storyUrl || '').split('/').pop(),
      }));
      // peer.fink.js was the last thing being read, so a resume lands
      // there; a restart would land on demo.fink.js's opening beat.
      back.resumed && back.url === 'peer.fink.js'
        ? pass(`reopening RESUMED the reading (${back.url}), it did not restart`)
        : fail(`did not resume the playthrough: ${JSON.stringify(back)}`);
    }
  }

  // ── 10. PARITY ON A BUNDLED STORY (#779) ────────────────────────────
  // The fixtures prove mechanisms; a bundled story is the bar. Hampstead is
  // the mandatory journey, and it must play IN THE BOX with its real art,
  // real knots, a deep link that names the knot, and the shell's skin.
  {
    const url = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`
      + `?player=boxed&story=/${repoName}/inklet/hampstead.fink.js`;
    await page.goto(url);
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    let hf = null;
    for (let i = 0; i < 50 && !hf; i++) {
      hf = page.frames().find((f) => f.url().includes('apps/storyrunner'));
      if (!hf) await page.waitForTimeout(300);
    }
    if (!hf) fail('the box never opened for a bundled story');
    else {
      // Wait for a PLAYABLE beat, not merely for the url — `storyUrl` is
      // set at the START of loadStory, so matching on it alone measured the
      // runner mid-compile and reported 0 knots, 0 prose, 0 choices.
      await hf.waitForFunction(() => window.__storyrunner?.ready?.()
        && /hampstead/.test(window.__storyrunner.state.storyUrl || '')
        && window.__storyrunner.state.prose.length > 0
        && window.__storyrunner.state.choices.length > 0, null, { timeout: 25000 });
      const h = await hf.evaluate(() => ({
        url: (window.__storyrunner.state.storyUrl || '').split('/').pop(),
        knots: window.__storyrunner.state.knots,
        prose: window.__storyrunner.state.prose.length,
        choices: window.__storyrunner.state.choices.length,
        skin: window.__storyrunner.state.skin,
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      h.url === 'hampstead.fink.js' && h.knots > 30 && h.prose >= 1 && h.choices >= 1
        ? pass(`a BUNDLED story plays in the box (${h.url}, ${h.knots} knots, ${h.choices} choice)`)
        : fail(`bundled story did not play boxed: ${JSON.stringify(h)}`);
      // `?story=` used to force the legacy player; asking for the box now
      // means the box, for any story.
      const legacy = await page.evaluate(() => !!window.FinkInkEngine?.story);
      !legacy
        ? pass('?story= went to the BOX, not the host-page player')
        : fail('the host player compiled the story instead of the box');
      h.skin
        ? pass(`the box wears the shell's skin from first paint (${h.skin}, ${h.bg})`)
        : fail(`skin tokens never reached the box: ${JSON.stringify(h)}`);

      // Walk two beats, and the address bar must name the knot.
      await hf.evaluate(() => window.__storyrunner.choose(0));
      await page.waitForTimeout(1200);
      await hf.evaluate(() => window.__storyrunner.choose(0));
      await page.waitForTimeout(1400);
      const link = await page.evaluate(() => location.hash);
      const at = await hf.evaluate(() => window.__storyrunner.state.knot);
      /^#[0-9a-f]{8}-[0-9a-f]{9}$/.test(link) && at
        ? pass(`the deep link names the beat (${link}, knot "${at}")`)
        : fail(`no two-part deep link while reading: "${link}" knot=${at}`);

      // And the shell's own generator agrees, so the link is shareable
      // into the host player — same salt, same lengths, same string.
      const same = await page.evaluate(async (knot) => {
        const f = document.querySelector('iframe[src*="storyrunner"]');
        const storyUrl = await f.contentWindow ? null : null;
        return FinkNavigation.generateKnotHash(knot);
      }, at);
      link.endsWith(same)
        ? pass('the boxed link is byte-identical to a host-player link')
        : fail(`hash disagreement: link=${link} shell=${same}`);
    }
  }

  // ── 11. THE MANDATORY JOURNEY, BOXED (CLAUDE.md) ────────────────────
  // TOC loads → Episodes → Hampstead plays, choice labels visible, no
  // console errors. That journey is the project's standing gate for ANY
  // player change; a boxed engine that cannot walk it is not at parity
  // whatever the feature list says. It exercises two `# FINK:` hops
  // (toc → episodes list is in-story, then a real cross-file link).
  {
    const url = `http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/`
      + `?player=boxed&story=/${repoName}/inklet/toc.fink.js`;
    await page.goto(url);
    await page.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    let tf = null;
    for (let i = 0; i < 50 && !tf; i++) {
      tf = page.frames().find((f) => f.url().includes('apps/storyrunner'));
      if (!tf) await page.waitForTimeout(300);
    }
    if (!tf) fail('the box never opened for the TOC');
    else {
      const playable = () => tf.waitForFunction(
        () => window.__storyrunner?.ready?.() && window.__storyrunner.state.choices.length > 0,
        null, { timeout: 25000 });
      await playable();
      // WAIT FOR THE CHANGE, not for a duration. A fixed 2.6s was enough on a
      // quiet machine and not enough on a busy one: the journey leg failed
      // once with the TOC's own choices still on screen, which reads exactly
      // like "Hampstead is missing" and is not.
      const pick = async (frag) => {
        const cs = await tf.evaluate(() => window.__storyrunner.state.choices);
        const i = cs.findIndex((c) => c.toLowerCase().includes(frag));
        if (i < 0) return { ok: false, cs };
        await tf.evaluate((n) => window.__storyrunner.choose(n), i);
        await tf.waitForFunction((before) => {
          const s = window.__storyrunner?.state;
          if (!s || !s.choices.length) return false;
          return JSON.stringify(s.choices) !== before;
        }, JSON.stringify(cs), { timeout: 25000 }).catch(() => {});
        return { ok: true, label: cs[i] };
      };
      const toc = await tf.evaluate(() => window.__storyrunner.state.choices);
      toc.length >= 2
        ? pass(`TOC loaded in the box with labelled choices (${toc.slice(0, 3).join(' · ')})`)
        : fail(`TOC did not present choices: ${JSON.stringify(toc)}`);
      const ep = await pick('episode');
      const hp = ep.ok ? await pick('hampstead') : { ok: false };
      const landed = await tf.evaluate(() => ({
        url: (window.__storyrunner.state.storyUrl || '').split('/').pop(),
        choices: window.__storyrunner.state.choices.length,
      }));
      ep.ok && hp.ok && landed.url === 'hampstead.fink.js' && landed.choices > 0
        ? pass('MANDATORY JOURNEY boxed: TOC → Episodes → Hampstead plays')
        : fail(`journey broke: ep=${JSON.stringify(ep)} hp=${JSON.stringify(hp)} at=${JSON.stringify(landed)}`);
    }
  }

  // ── 12. PEERING: two sibling sessions, both live ────────────────────
  // Its own page, because reaching the peer branch means leaving the spine
  // walk that every leg above rides on.
  {
    const pp = await browser.newPage({ viewport: { width: 430, height: 900 } });
    const perr = [];
    pp.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
    await pp.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=none`);
    await pp.waitForFunction(() => !!window.FoafOS?.launchApp, null, { timeout: 25000 });
    await pp.evaluate(() => {
      window.__peerLog = [];
      FoafOS.bus.subscribe('story.request', (e) => window.__peerLog.push(e.data));
    });
    await pp.evaluate(() => FoafOS.launchApp('storyrunner'));
    // The OUTER runner is the frame with no `peer=1`; the peer is the one with
    // it. Both share a pathname, so the query is what tells them apart — and
    // the outer frame must be identified before the peer exists, or "the first
    // storyrunner frame" is a race.
    const outerOf = () => pp.frames().find((f) => {
      try {
        const u = new URL(f.url());
        return u.pathname.includes('/apps/storyrunner/') && !u.searchParams.get('peer');
      } catch { return false; }
    });
    let outer = null;
    for (let i = 0; i < 40 && !outer; i++) { outer = outerOf(); if (!outer) await pp.waitForTimeout(400); }
    if (!outer) fail('peering: the runner frame never appeared');
    else {
      await outer.waitForFunction(() => window.__storyrunner?.ready?.(), null, { timeout: 20000 });
      // Walk the spine to the coin beat, then take the CHART, by label.
      const tap = async (label) => {
        for (const b of await outer.$$('#choices button')) {
          if ((await b.textContent()).toLowerCase().includes(label)) { await b.click(); return true; }
        }
        return false;
      };
      // Two beats to the coin, THEN the chart: the peer branch hangs off the
      // coin knot, not off the newsreel.
      await tap('drowned newsreel');
      await pp.waitForTimeout(1100);
      await tap('odd coin');
      await pp.waitForTimeout(1100);
      const took = await tap('chart beside you');
      took ? pass('the demo offers a peer link (# LINKREL: peer)')
           : fail('no peer choice found at the coin beat');
      await pp.waitForTimeout(4000);

      // 12a. TWO SESSIONS, SIDE BY SIDE, in the shell's tree.
      const shape = await pp.evaluate(() => {
        const all = [...FoafOS.apps.nodes.values()];
        const runner = all.find((n) => n.appId === 'storyrunner');
        const sessions = all.filter((n) => n.appId === 'story-session');
        return {
          runner: !!runner,
          count: sessions.length,
          allUnderRunner: sessions.every((s) => s.parentId === runner?.id),
          depths: sessions.map((s) => FoafOS.apps.depth(s.id)),
          labels: sessions.map((s) => s.label),
          peerOf: sessions.filter((s) => s.peerOf).length,
          dreamOf: sessions.filter((s) => s.dreamOf).length,
        };
      });
      shape.count === 2 && shape.allUnderRunner && shape.depths.every((d) => d === 2)
        && shape.peerOf === 1 && shape.dreamOf === 0
        ? pass(`two sessions stand BESIDE each other under the runner (${shape.labels.join(' | ')}), one marked peerOf`)
        : fail(`peer session shape wrong: ${JSON.stringify(shape)}`);

      // 12b. The peer is a REAL runner in its own frame, and it plays.
      const peer = pp.frames().find((f) => {
        try { return new URL(f.url()).searchParams.get('peer') === '1'; } catch { return false; }
      });
      if (!peer) fail('the peer frame never appeared');
      else {
        await peer.waitForFunction(() => window.__storyrunner?.ready?.(), null, { timeout: 20000 });
        const played = await peer.evaluate(() => ({
          url: (window.__storyrunner.state.storyUrl || '').split('/').pop(),
          prose: window.__storyrunner.state.prose.length,
          choices: window.__storyrunner.state.choices.length,
          watching: window.__storyrunner.observing(),
        }));
        played.url === 'beside.fink.js' && played.prose >= 1 && played.choices >= 1
          ? pass(`the peer plays its own story in its own frame (${played.url}, ${played.prose} prose, ${played.choices} choices)`)
          : fail(`the peer did not play: ${JSON.stringify(played)}`);
        // A session is not the observability point — level 1 is.
        played.watching === false
          ? pass('and it does NOT watch the subtree: that authority stayed at level 1')
          : fail('a level-2 session started observing');

        // 12c. CONTAINMENT between peers. Two Story objects in one frame would
        // be separated by our good behaviour; two frames are separated by the
        // browser, and this is the assertion that says which one we built.
        const reach = await peer.evaluate(() => {
          const probe = (fn) => { try { return fn() ? 'reachable' : 'empty'; } catch { return 'blocked'; } };
          return {
            doc: probe(() => window.parent.document.body),
            runner: probe(() => window.parent.__storyrunner),
          };
        });
        reach.doc === 'blocked' && reach.runner === 'blocked'
          ? pass('the peer cannot reach the story it stands beside (opaque origin, both ways blocked)')
          : fail(`peer containment leaked: ${JSON.stringify(reach)}`);

        // 12d. The reader's own story is STILL LIVE — that is the whole claim.
        const primary = await outer.evaluate(() => ({
          choices: window.__storyrunner.state.choices.length,
          url: (window.__storyrunner.state.storyUrl || '').split('/').pop(),
        }));
        primary.choices >= 1 && primary.url === 'demo.fink.js'
          ? pass(`the first story kept its own choices while the peer played (${primary.choices})`)
          : fail(`the primary story stopped being playable: ${JSON.stringify(primary)}`);

        // 12e. The peer's verbs went up TAGGED with its own session, which is
        // how the shell parents what a peer opens under the peer.
        const tagged = await pp.evaluate(() => {
          const all = [...FoafOS.apps.nodes.values()];
          const peerNode = all.find((n) => n.appId === 'story-session' && n.peerOf);
          return (window.__peerLog || []).filter((r) => r.detail?.session
            && r.detail.session === peerNode?.id).map((r) => r.verb);
        });
        tagged.length >= 1
          ? pass(`the peer's verbs arrive tagged with its own session (${[...new Set(tagged)].join(', ')})`)
          : fail('no forwarded verb carried the peer session id');
      }

      // 12f. Closing the peer ends THAT session and leaves the other reading.
      // Gated on a peer EXISTING: with no peer open, "one session left and no
      // peers" is true of a runner that never opened one, so this leg would
      // pass while proving nothing. It did, on the first run.
      const shut = await pp.evaluate(() =>
        [...FoafOS.apps.nodes.values()].some((n) => n.peerOf));
      if (!shut) fail('no peer to close — 12f proved nothing');
      else {
        await outer.evaluate(() => window.__storyrunner.closePeer());
        await pp.waitForTimeout(1200);
        const after = await pp.evaluate(() => {
          const all = [...FoafOS.apps.nodes.values()];
          return {
            sessions: all.filter((n) => n.appId === 'story-session').length,
            peers: all.filter((n) => n.peerOf).length,
            runnerAlive: all.some((n) => n.appId === 'storyrunner'),
          };
        });
        const stillReading = await outer.evaluate(() => window.__storyrunner.state.choices.length);
        after.sessions === 1 && after.peers === 0 && after.runnerAlive && stillReading >= 1
          ? pass('closing the peer ended one session and left the other reading')
          : fail(`peer close wrong: ${JSON.stringify({ ...after, stillReading })}`);
      }
      perr.length === 0 ? pass('peering: no page errors') : fail(`peering errors: ${perr[0]}`);
    }
    await pp.close();
  }

  if (pageErrors.length) fail('page errors: ' + pageErrors.join(' | '));
  else pass('zero page errors');
} catch (e) {
  fail('e2e crashed: ' + e.message);
} finally {
  await browser?.close();
  server.kill();
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
