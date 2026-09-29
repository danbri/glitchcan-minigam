// Drive a story in the boxed runner from a Playwright test.
//
// Stories run only in the runner's sandboxed frame; there is no story
// engine on the shell page. A test reaches the story through the runner's
// test hooks (window.__storyrunner: goto, setVar, varOf, choose, state).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The runner frame on this page, once it exists.
export async function runnerFrame(page, ms = 60000) {
  for (let t = 0; t < ms; t += 250) {
    const f = page.frames().find((x) => /apps\/storyrunner\//.test(x.url()));
    if (f) return f;
    await wait(250);
  }
  throw new Error('the story runner never opened');
}

// Open the shell on a story and wait until the runner has played its first
// step. `base` is http://host:port (no repo); `story` a path from the repo root.
export async function openStory(page, base, repoName, story, extra = '') {
  await page.goto(`${base}/${repoName}/inklet/finkapp/?story=/${repoName}/${story}${extra}`);
  const r = await runnerFrame(page);
  await r.waitForFunction(() => window.__storyrunner?.ready?.()
    && (window.__storyrunner.state.choices.length > 0 || window.__storyrunner.state.ended), null, { timeout: 60000 });
  return r;
}

// Divert the story to a knot, as ChoosePathString did on the old engine.
export const goto = (r, knot) => r.evaluate((k) => window.__storyrunner.goto(k), knot);
export const setVar = (r, name, value) => r.evaluate(([n, v]) => window.__storyrunner.setVar(n, v), [name, value]);
export const varOf = (r, name) => r.evaluate((n) => window.__storyrunner.varOf(n), name);
// Poll a story VAR until it matches.
export async function waitVar(r, name, pred, ms = 15000) {
  for (let t = 0; t < ms; t += 200) {
    const v = await varOf(r, name);
    if (pred(v)) return v;
    await wait(200);
  }
  return varOf(r, name);
}
