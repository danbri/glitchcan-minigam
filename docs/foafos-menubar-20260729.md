# foafos menubar — dashboard widgets, grouped by the app tree

**v1, 2026-07-29.** Answers: *"foafos speaks of Chrome and we have several
parallel miniapps shown in a tabbed view but no hierarchy. Shouldn't there
be a menubar UI within which smaller dashboardy things (scores, clocks) can
emerge?"* — yes, and here it is.

## The gap
foafos runs apps in parallel (a story, its minigame, sibling widgets) with a
real **app tree** underneath (`FoafOS.apps`, parent/child), but their small
readouts — scores, clocks, gauges — had nowhere shared to surface and no
nesting. The `# STATUS:` line was story-only and flat.

## The menubar
A **chrome app** (`surface: 'chrome'`, mount `foaf-menubar`,
`inklet/finkapp/foafos-menubar.js`) — offered by the root → it renders; not
offered → the element is parked, like the breadcrumb and load meter. It
shows:

- a **clock**, the one shell-level widget, always present;
- whatever a running app **publishes** as `app.<id>.status` on the bus,
  `{ items: [{ id, label, value, icon }] }`.

Apps publish in their **own scoped namespace** — the sandbox already allows
`app.<id>.*`, so a boxed guest needs no new grant. The menubar, being
trusted shell furniture (host-side), reads them all.

## The hierarchy
Groups are ordered and **indented by app-tree depth** (`FoafOS.apps`): a
story's readouts at one level, its running minigame's nested beneath. A
group appears when its app starts publishing and disappears when the app
closes (`minigame.instance {closed}`). This is the nesting the flat
parallel/tabbed view lacked — one story owning the frame, its guests'
dashboards tucked under it.

## Contributing (any app)
```js
foaf.bus.publish('app.myapp.status', { items: [
  { icon: '⭐', label: 'score', value: 1200 },
  { icon: '⏱', value: '01:04' },
]});
```
The boxed story runner does this from `# STATUS:` today. A minigame that
publishes `app.<game>.status` gets its gauges nested under the story that
launched it — no extra wiring.

## v1 scope / next
- v1 renders text widgets; no interaction (a click-to-open menu, a
  drop-down of app controls) yet — the "menu" half of "menubar" is a
  natural next step, and the app tree already gives it the structure.
- The story runner's `# STATUS:` is published as one text item; parsing the
  structured `# STATUS: <var> icon= label= format=` form into typed widgets
  (bars, gauges) is the same shape and belongs next.
- Live-updating values (a ticking game clock, a rising score) already work
  — an app just republishes `app.<id>.status`; the menubar re-renders.

Tests: `e2e-storyrunner.mjs` asserts the clock + the runner's group with its
readout; `e2e-chrome`/`e2e-root` cover mount-when-offered / park-when-not.
