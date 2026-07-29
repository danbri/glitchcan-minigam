// foafos-menubar.js — the menubar: a chrome strip of small "dashboard"
// widgets, grouped by the app-tree HIERARCHY.
//
// The gap it fills: foafos runs several apps in parallel (a story, its
// minigame, sibling widgets) but their small readouts — scores, clocks,
// gauges — had nowhere shared to surface, and no nesting. This gathers
// them:
//
//   · a CLOCK, the one shell-level widget, always present
//   · whatever a running app PUBLISHES as `app.<id>.status` on the bus,
//     `{ items: [{ id, label, value, icon }] }`. Apps publish in their OWN
//     scoped namespace (the sandbox already allows that); the menubar,
//     trusted shell furniture, reads them all.
//
// Items are grouped and INDENTED by the app tree (FoafOS.apps): a story's
// readouts at one level, its running minigame's nested beneath — the
// hierarchy the parallel/tabbed view lacked. A group appears when its app
// starts publishing and disappears when the app closes.
//
// It is a chrome APP (surface:'chrome', mount 'foaf-menubar'): offered by
// the root → it renders; not offered → the element is parked (removed) and
// this stays dark, like the breadcrumb and load meter.
(function () {
  if (window.FoafMenubar) return;

  const byApp = new Map();          // appId → items[]
  let el = null, clockTimer = null, unsub = null;

  const appOf = (topic) => {
    const m = /^app\.([^.]+)\.status$/.exec(topic || '');
    return m ? m[1] : null;
  };

  function node(appId) {
    const apps = window.FoafOS?.apps;
    const root = window.FoafOS?.rootNode;
    if (!apps?.get || !root) return null;
    let found = null;
    const walk = (id) => {
      if (found) return;
      const n = apps.get(id);
      if (!n) return;
      if (n.appId === appId) { found = n; return; }
      for (const c of apps.children(id)) walk(c.id);
    };
    walk(root.id);
    return found;
  }

  function depthOf(appId) {
    const apps = window.FoafOS?.apps;
    let n = node(appId), d = 0;
    while (n && n.parentId && apps?.get) { d++; n = apps.get(n.parentId); }
    return d;
  }

  const labelFor = (appId) => node(appId)?.label || appId;

  function clockText() {
    // Browser time is fine here (only workflow scripts forbid Date()).
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `🕐 ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function render() {
    if (!el) return;
    el.textContent = '';

    const clock = document.createElement('span');
    clock.className = 'mb-clock';
    clock.setAttribute('role', 'timer');
    clock.textContent = clockText();
    el.appendChild(clock);

    const ids = [...byApp.keys()]
      .filter((id) => (byApp.get(id) || []).length)
      .sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b));

    for (const appId of ids) {
      const group = document.createElement('span');
      group.className = 'mb-group';
      group.dataset.app = appId;
      group.style.setProperty('--mb-depth', String(depthOf(appId)));

      const name = document.createElement('span');
      name.className = 'mb-app';
      name.textContent = labelFor(appId);
      group.appendChild(name);

      for (const it of byApp.get(appId)) {
        const w = document.createElement('span');
        w.className = 'mb-widget';
        w.dataset.id = it.id || '';
        w.textContent = `${it.icon ? it.icon + ' ' : ''}${it.label ? it.label + ' ' : ''}${it.value ?? ''}`.trim();
        group.appendChild(w);
      }
      el.appendChild(group);
    }
  }

  function mount(target) {
    el = target;
    const bus = window.FoafOS?.bus;
    if (bus?.subscribe && !unsub) {
      unsub = bus.subscribe('*', (e) => {
        const appId = appOf(e.topic);
        if (appId) { byApp.set(appId, Array.isArray(e.data?.items) ? e.data.items : []); render(); return; }
        if (e.topic === 'minigame.instance' && e.data?.closed) { byApp.delete(e.data.type); render(); }
        if (e.topic === 'story.state' && e.data?.phase === 'end') { render(); }
      });
    }
    if (!clockTimer) {
      clockTimer = setInterval(() => {
        const c = el?.querySelector('.mb-clock'); if (c) c.textContent = clockText();
      }, 1000);
    }
    render();
  }

  function unmount() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    if (unsub) { try { unsub(); } catch (e) { /* */ } unsub = null; }
    el = null;
  }

  // Supervisor: mount when the shell (FoafOS.bus) is up AND the menubar
  // element is present (i.e. the root OFFERS this chrome, so it was not
  // parked). Unmount if the element is later parked away. No coupling to
  // the shell's chrome internals — just the element's presence.
  const tick = setInterval(() => {
    const target = document.getElementById('foaf-menubar');
    const ready = !!window.FoafOS?.bus;
    if (ready && target && el !== target) mount(target);
    else if (el && !document.body.contains(el)) unmount();
  }, 250);

  window.FoafMenubar = {
    mount, unmount,
    _state: () => ({ apps: [...byApp.keys()], groups: [...byApp.keys()].filter((id) => (byApp.get(id) || []).length).length, clock: clockText(), mounted: !!el }),
    _stop: () => clearInterval(tick),
  };
})();
