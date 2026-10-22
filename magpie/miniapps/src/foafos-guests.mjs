// The host side of the two foafos guest protocols, for pages of a MiniApp that are
// existing foafos apps rather than package files:
//
//   app-sdk     inklet/apps/app-sdk.js: app.hello -> app.init, store.*, story.request,
//               verb, secrets.*, bus-publish, app.suspend/resume/terminate.
//               Guests: the FINK story runner, edot, sheets, files.
//   minigame    packages/finkgame/src/minigame-sdk.js: init, pause, resume, terminate;
//               ready, complete, announce, error. Guests: inklet/minigames/*.
//
// This file decides what a guest may do; host.mjs owns frames and the page stack.
// The verb -> capability table is the shell's (inklet/finkapp/foafos-shell.js,
// story verbs), so a guest is refused here exactly where the shell would refuse it.

export const STORY_VERB_CAPS = Object.freeze({
  'story.launch': ['story:launch'],
  'story.world': ['story:launch'],
  'story.link': ['story:link'],
  'story.session': ['story:link'],
  'story.observe': ['story:observe'],
  'story.navigate': ['story:navigate'],
  'story.audio': ['audio'],
  'story.vars': ['vars:read', 'vars:write'],   // either one
});

const GAME_NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
const ARG_VALUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const MAX_LINK_DEPTH = 8;

/** Read the foafos-app block of a package page, or null when the page is an ordinary page. */
export function linkedAppOf(html) {
  const m = /<script[^>]*\bid=["']foafos-app["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  const spec = JSON.parse(m[1]);
  if (typeof spec.id !== 'string' || typeof spec.url !== 'string') throw new Error('foafos-app needs "id" and "url"');
  return {
    id: spec.id,
    url: spec.url,
    name: typeof spec.name === 'string' ? spec.name : spec.id,
    capabilities: Array.isArray(spec.capabilities) ? spec.capabilities.map(String) : [],
    story: typeof spec.story === 'string' ? spec.story : null,
    storyFromQuery: spec.storyFromQuery === true,
    titleFromQuery: spec.titleFromQuery === true,
    quotaBytes: Number.isInteger(spec.quotaBytes) ? spec.quotaBytes : null,
    textSize: spec.textSize === 'skin' ? 'skin' : 'zoom',
    colours: spec.colours === 'skin' ? 'skin' : 'filter',
    protocol: spec.protocol === 'minigame' ? 'minigame' : 'app-sdk',
    args: spec.args && typeof spec.args === 'object' ? Object.fromEntries(Object.entries(spec.args).map(([k, v]) => [k, String(v)])) : {},
  };
}

/** Same-origin check: the shell's policy v0 (no cross-origin guests). */
export function sameOriginUrl(url, base) {
  const u = new URL(url, base);
  if (u.origin !== new URL(base).origin) throw new Error(`${u.href} is not on this site; cross-origin guests are refused`);
  return u;
}

/** The skin tokens the story runner reads (--sk-*), from the runner's display preferences. */
export function skinTokensFor({ scale = 1, theme = 'system' }, dark, { size: withSize = true } = {}) {
  const size = withSize ? `${Math.round(16 * scale)}px` : undefined;
  if (theme === 'contrast') {
    return { skin: 'contrast', tokens: { '--sk-bg': '#000', '--sk-bg-figure': '#000', '--sk-ink': '#fff', '--sk-ink-dim': '#fff',
      '--sk-accent': '#ff0', '--sk-accent-ink': '#000', '--sk-line': '#fff', '--sk-choice-bg': '#000',
      '--sk-choice-ink': '#ff0', '--sk-choice-line': '#ff0', '--sk-shadow': 'none', ...(size ? { '--sk-size': size } : {}) } };
  }
  if (theme === 'dark' || (theme === 'system' && dark)) {
    return { skin: null, tokens: { '--sk-bg': '#121417', '--sk-bg-figure': '#1c2026', '--sk-ink': '#eceef0', '--sk-ink-dim': '#b3bcc5',
      '--sk-accent': '#8ab4ff', '--sk-accent-ink': '#0b1a33', '--sk-line': '#48505a', '--sk-choice-bg': '#1c2026',
      '--sk-choice-ink': '#eceef0', '--sk-choice-line': '#8ab4ff', '--sk-shadow': 'none', ...(size ? { '--sk-size': size } : {}) } };
  }
  return { skin: null, tokens: size ? { '--sk-size': size } : {} };
}

/**
 * Answer one story.request. `ctx` gives: can(cap), page (the story page entry),
 * openGame(game, args, recent) -> launched name or throws, siteOrigin, linkDepth.
 * Returns the fields of the story.result (without type and rid).
 */
export function answerStoryRequest(verb, detail = {}, ctx) {
  const need = STORY_VERB_CAPS[verb];
  if (!need) return { ok: false, reason: 'unknown-verb' };
  if (!need.some((c) => ctx.can(c))) return { ok: false, reason: 'denied', needs: need };
  switch (verb) {
    case 'story.session':
      if (detail.op === 'start') return { ok: true, id: `${ctx.page.node?.id || 'page'}-s${++ctx.page.sessions}`, label: ctx.page.title || '' };
      return { ok: true };
    case 'story.vars':
      // No variables are shared between stories in this runner yet: every name is private.
      if (detail.op === 'declares') return { ok: true, shared: [] };
      if (detail.op === 'read') return { ok: true, values: {} };
      if (detail.op === 'write') return { ok: false, name: detail.name, reason: 'not-shared' };
      return { ok: false, reason: 'unknown-op' };
    case 'story.navigate':
      if (detail.op === 'position') { ctx.onPosition?.(detail); return { ok: true, link: null }; }
      if (detail.op === 'resolve') return { ok: true, hash: '', parsed: null };
      return { ok: false, reason: 'unknown-op' };
    case 'story.link': {
      let u;
      try { u = sameOriginUrl(String(detail.url || ''), ctx.siteOrigin); } catch (e) { return { ok: false, reason: 'cross-origin-blocked' }; }
      const rel = String(detail.rel || '');
      const depth = rel === 'godeeper' ? ctx.page.linkDepth + 1 : rel === 'goshallower' ? Math.max(0, ctx.page.linkDepth - 1) : ctx.page.linkDepth;
      if (depth > MAX_LINK_DEPTH) return { ok: false, reason: 'too-deep' };
      ctx.page.linkDepth = depth;
      ctx.onStory?.(u.pathname);
      return { ok: true, url: u.href, depth, rel };
    }
    case 'story.launch': {
      const game = String(detail.game || '');
      if (!GAME_NAME.test(game)) return { ok: false, reason: 'bad-game-name' };
      const args = {};
      for (const [k, v] of Object.entries(detail.args || {})) {
        if (/^[a-z][a-z0-9_-]{0,30}$/i.test(k) && ARG_VALUE.test(String(v))) args[k] = String(v);
      }
      try { ctx.openGame(game, args, Array.isArray(detail.recent) ? detail.recent.slice(-8) : []); }
      catch (e) { return { ok: false, reason: e.message }; }
      return { ok: true, launched: game, awaiting: 'minigame.complete' };
    }
    case 'story.audio':
      return { ok: true };            // file audio plays inside the runner; foley layers are not mixed here
    case 'story.observe':
      return { ok: true, nodes: ctx.subtree ? ctx.subtree() : [] };
    case 'story.world':
      return { ok: false, reason: 'unsupported' };
  }
  return { ok: false, reason: 'unknown-verb' };
}

/** The init message a minigame expects (fink-minigames.js), from launch arguments. */
export function minigameInit({ args = {}, recent = [] }) {
  const { mode = null, controls = null, ...rest } = args;
  return {
    type: 'init',
    config: {
      mode,
      args: rest,
      controls: { provider: 'guest', scheme: controls || 'none' },
      contracts: ['controls', 'audio', 'snapshot'],
      audio: null,
      bus: null,
      story: { recent },
    },
    variables: {},
  };
}
