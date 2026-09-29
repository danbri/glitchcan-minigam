// FINK Window Manager (FinkWM)
// The game runner is the shell of a small web OS: the story is the desktop,
// a minigame is a window. One state machine owns window geometry:
//
//   mode ∈ { full, split, pip }        — where the window sits
//   pause                              — orthogonal to geometry (FinkMinigames)
//
// One chrome — a compact toolbar that is itself a first-class window citizen:
// draggable by its grip, docks to the left or right screen edge (persisted),
// and collapses to the grip alone. No mode is a one-way door: pip restores on
// tap, and the chrome is reachable in every mode.
//
// Replaces the fixed FULL/EMBED/MINI/⏸ slider panel (fink-slider.js, retired):
// its EMBED state rendered the game as a 4px sliver and its MINI state hid
// the only control that could restore it.

window.FinkWM = {
    mode: null,
    lastNonPipMode: 'full',
    active: false,

    elements: {},
    _collapseTimer: null,
    _drag: null,          // in-progress chrome drag
    _pipDrag: null,       // in-progress pip drag
    DOCK_KEY: 'fink.wm.dock',
    SPLIT_KEY: 'fink.wm.split',
    // split: the game's share of the column, and whether it sits above the
    // story. The reader's, set with the grip on the seam; kept per device.
    split: { ratio: 0.52, swap: false },

    init() {
        this.elements = {
            chrome: document.getElementById('wm-chrome'),
            handle: document.getElementById('wm-handle'),
            buttons: document.getElementById('wm-buttons'),
            target: document.getElementById('wm-target'),
            view: document.getElementById('minigame-view'),
            narrative: document.getElementById('narrative-view'),
            modeBtns: {
                full: document.getElementById('wm-full'),
                split: document.getElementById('wm-split'),
                pip: document.getElementById('wm-pip'),
            },
            swapRow: document.getElementById('wm-swap'),
            padSect: document.getElementById('wm-pad-sect'),
            appSect: document.getElementById('wm-app-sect'),
        };
        if (!this.elements.chrome || !this.elements.view) {
            this.log('chrome elements missing — window manager idle');
            return;
        }

        // A row that does something closes the menu; a row that sets
        // something (pause, the pad, an app's check) leaves it open.
        for (const [mode, btn] of Object.entries(this.elements.modeBtns)) {
            btn?.addEventListener('click', () => { this.setMode(mode); this._setCollapsed(true); });
        }
        this.elements.swapRow?.addEventListener('click', () => { this.swapPanes(); this._setCollapsed(true); });
        document.getElementById('returnToStory')?.addEventListener('click', () => this._setCollapsed(true));
        const sys = { 'wm-sys-apps': () => window.FoafOS?.openHome?.(),
                      'wm-sys-tasks': () => window.FoafOS?.openSwitcher?.(),
                      'wm-sys-windows': () => window.FoafOS?.enterOverview?.(),
                      'wm-sys-shell': () => window.FoafOS?.openDrawer?.(true) };
        for (const [id, go] of Object.entries(sys)) {
            document.getElementById(id)?.addEventListener('click', () => { this._setCollapsed(true); go(); });
        }
        this._initMenuDismiss();

        this._initChromeDrag();
        this._initPipGestures();
        this.split = { ...this.split, ...(this._loadSplit() || {}) };
        this._initSplitGrip();
        this._applyDock(this._loadDock());
        window.addEventListener('resize', () => { this._applyDock(this._loadDock()); this._layoutSplit(); });
        // THE VISIBLE HEIGHT, FROM THE ONLY THING THAT KNOWS IT.
        //
        // Field screenshots (iOS Chrome): a full-screen game ended ~15%
        // short of the bottom with the host's white page below it. The
        // view is `top:0; bottom:0` AND `height:100dvh !important` — an
        // over-constrained box, so height wins and `bottom` is ignored;
        // whenever the engine's dvh disagrees with what is actually on
        // screen (mobile toolbars mid-transition), the gap is real.
        // visualViewport reports the truth, so publish it as a custom
        // property and let the CSS prefer it. dvh stays the fallback.
        this._trackVisualViewport();

        this.log('window manager ready');
    },

    // ── lifecycle ────────────────────────────────────────────────────────

    open(mode = 'full') {
        this.active = true;
        this.elements.chrome.classList.remove('wm-hidden');
        // Opens CLOSED, as one ☰. The old toolbar opened expanded because a
        // lone ▦ grip read as "this game has no window controls"; ☰ reads
        // as a menu, so it can start closed and cover less of the game.
        this._setCollapsed(true);
        this.setAppActions(null);
        this.setAppStatus('');
        this._bindOwnershipCues();
        this.setMode(mode, { animate: false });
        window.FoafOS?.bus.publish('wm.open', { summary: 'game window opened' });
    },

    close() {
        this.active = false;
        this.mode = null;
        this.lastNonPipMode = 'full';
        const { chrome, view } = this.elements;
        chrome.classList.add('wm-hidden');
        this._setCollapsed(true);
        this.setAppActions(null);
        view.classList.remove('state-full', 'state-split', 'state-pip', 'wm-transitioning');
        view.style.left = view.style.top = view.style.right = view.style.bottom = '';
        view.style.height = '';
        if (this.elements.narrative) this.elements.narrative.style.height = '';
        delete document.body.dataset.wmMode;
        this.log('window closed');
        window.FoafOS?.bus.publish('wm.close', { summary: 'game window closed' });
    },

    // ── mode machine ─────────────────────────────────────────────────────

    setMode(mode, { animate = true } = {}) {
        if (!['full', 'split', 'pip'].includes(mode)) return;
        const old = this.mode;
        if (mode !== 'pip') this.lastNonPipMode = mode;
        this.mode = mode;

        const { view, narrative } = this.elements;

        if (animate) {
            view.classList.add('wm-transitioning');
            setTimeout(() => view.classList.remove('wm-transitioning'), 350);
        }

        view.classList.remove('state-full', 'state-split', 'state-pip');
        view.classList.add(`state-${mode}`);
        // the mode is layout information the whole page needs (split has
        // to size the narrative deterministically, not by content)
        document.body.dataset.wmMode = mode;

        // Leaving pip clears any dragged-to position.
        if (old === 'pip' && mode !== 'pip') {
            view.style.left = view.style.top = view.style.right = view.style.bottom = '';
        }

        // The story shares the screen in every mode but full.
        if (narrative) narrative.classList.toggle('active', mode !== 'full');

        for (const [m, btn] of Object.entries(this.elements.modeBtns)) {
            btn?.classList.toggle('active', m === mode);
            btn?.setAttribute('aria-pressed', String(m === mode));
        }
        if (this.elements.swapRow) this.elements.swapRow.hidden = mode !== 'split';

        this._paintOwnership();
        this._layoutSplit();
        this._scheduleSettle();
        this._haptic();
        this._scheduleCollapse();

        // Audio focus is window focus for the ears: a pip'd game keeps
        // running but yields the stage (spec §5.1 / §7).
        if (mode === 'pip' && old !== 'pip') {
            window.FinkMinigames?._sendToIframe?.({ type: 'audio-blur' });
            window.FoafOS?.bus.publish('audio.focus', { focused: false, summary: 'game yielded audio focus' }, { retain: true });
        } else if (old === 'pip' && mode !== 'pip') {
            window.FinkMinigames?._sendToIframe?.({ type: 'audio-focus' });
            window.FoafOS?.bus.publish('audio.focus', { focused: true, summary: 'game took audio focus' }, { retain: true });
        }

        if (old !== mode) {
            this.log(`mode: ${old || '—'} → ${mode}`);
            window.FoafOS?.bus.publish('wm.mode', { mode, prev: old, summary: `window → ${mode}` }, { retain: true });
        }
    },

    // Flipping modes quickly is a resize STORM: every change rewrites the
    // panes' inline heights, the guest iframe reflows, and a canvas game
    // reallocates its backing store. Ten flips in two seconds is ten
    // reallocations — cheap on a desktop, and on a phone the way you run
    // a browser out of canvas memory and get a black rectangle.
    //
    // So tell guests when the geometry has SETTLED, once per burst, and
    // let them do the expensive rebuild then instead of on every step.
    _trackVisualViewport() {
        const vv = window.visualViewport;
        if (!vv) return;                       // desktop/older: dvh is fine
        const push = () => {
            document.documentElement.style.setProperty('--fink-vvh', `${vv.height}px`);
        };
        push();
        vv.addEventListener('resize', push);
        vv.addEventListener('scroll', push);
    },

    _scheduleSettle() {
        clearTimeout(this._settleTimer);
        this._settleTimer = setTimeout(() => {
            this._layoutSplit();               // one authoritative measure
            window.FinkMinigames?._sendToIframe?.({ type: 'resized', mode: this.mode });
            window.FoafOS?.bus.publish('wm.settled', {
                summary: `window settled in ${this.mode}`, mode: this.mode,
            }, { retain: true });
        }, 220);
    },

    // Split geometry, in measured pixels. CSS could not hold the
    // narrative to its share (flex basis, grid rows and absolute insets
    // all let it size from its own content), which clipped the bottom of
    // the game. Two numbers that add up cannot do that.
    _layoutSplit() {
        const view = this.elements.view;
        const narrative = this.elements.narrative;
        const main = view?.parentElement;
        if (!view || !narrative || !main) return;
        if (this.mode !== 'split') {
            narrative.style.height = '';
            view.style.height = '';
            this._placeChrome(null);
            return;
        }
        const total = main.clientHeight;
        const gameH = Math.max(180, Math.round(total * this.split.ratio));
        const mainTop = main.getBoundingClientRect().top;
        this._placeChrome(this.split.swap ? mainTop : mainTop + total - gameH);
        view.style.height = `${gameH}px`;
        narrative.style.height = `${Math.max(0, total - gameH)}px`;
        view.classList.toggle('wm-swapped', !!this.split.swap);
        const grip = this.elements.grip;
        if (grip) {
            grip.setAttribute('aria-valuenow', String(Math.round(this.split.ratio * 100)));
            grip.setAttribute('aria-valuetext', `game ${Math.round(this.split.ratio * 100)}%, ${this.split.swap ? 'above' : 'below'} the story`);
        }
        // others that share the column (the foafos shell's story window)
        // follow the seam as it moves, not only when it settles
        window.dispatchEvent(new CustomEvent('fink-wm-layout', { detail: { mode: this.mode } }));
    },

    // ── split grip: resize the split, and swap the panes ────────────────
    // A seam you can drag, as in any tiling window manager. Holding it
    // (or focusing it) shows a Swap button: the story and the game change
    // panes, and the panes keep their sizes. Arrow keys resize, for readers
    // without a pointer.
    _initSplitGrip() {
        const view = this.elements.view;
        const grip = document.createElement('div');
        grip.className = 'wm-split-grip';
        grip.tabIndex = 0;
        grip.setAttribute('role', 'separator');
        grip.setAttribute('aria-orientation', 'horizontal');
        grip.setAttribute('aria-valuemin', '20');
        grip.setAttribute('aria-valuemax', '80');
        grip.setAttribute('aria-label', 'Split between the story and the game: drag, or use the arrow keys');
        grip.innerHTML = '<span class="wm-split-pill" aria-hidden="true"></span>';
        const swap = document.createElement('button');
        swap.type = 'button';
        swap.className = 'wm-split-swap';
        swap.textContent = '⇅ Swap';
        swap.setAttribute('aria-label', 'Swap the story and the game');
        swap.hidden = true;
        grip.appendChild(swap);
        view.appendChild(grip);
        this.elements.grip = grip;
        this.elements.swap = swap;

        let hideTimer = null;
        const showSwap = () => { clearTimeout(hideTimer); swap.hidden = false; };
        const hideSwapSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!grip.contains(document.activeElement)) swap.hidden = true; }, 3000); };
        const set = (ratio) => {
            this.split.ratio = Math.min(0.8, Math.max(0.2, ratio));
            this._layoutSplit();
        };
        swap.addEventListener('click', (e) => {
            e.stopPropagation();
            this.swapPanes();
            showSwap(); hideSwapSoon();
        });
        let drag = null;
        grip.addEventListener('pointerdown', (e) => {
            showSwap();
            if (e.target === swap) return;
            const main = view.parentElement;
            if (!main) return;
            // follow the finger's movement from where it touched, so the
            // seam does not jump to the finger on the first move
            drag = { id: e.pointerId, main, y0: e.clientY, ratio0: this.split.ratio };
            try { grip.setPointerCapture(e.pointerId); } catch { /* untracked pointer */ }
            this._framesAside(true);
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const total = drag.main.getBoundingClientRect().height || 1;
            const dy = (e.clientY - drag.y0) / total;
            set(drag.ratio0 + (this.split.swap ? dy : -dy));
        });
        const end = (e) => {
            if (!drag || e.pointerId !== drag.id) return;
            drag = null;
            this._framesAside(false);
            this._saveSplit();
            this._scheduleSettle();
            hideSwapSoon();
        };
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
        grip.addEventListener('focusin', showSwap);
        grip.addEventListener('focusout', hideSwapSoon);
        grip.addEventListener('keydown', (e) => {
            if (e.target === swap) return;
            // up moves the seam up: the lower pane grows
            const d = e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowDown' ? -0.05 : 0;
            if (!d) return;
            e.preventDefault();
            set(this.split.ratio + (this.split.swap ? -d : d));
            this._saveSplit();
            this._scheduleSettle();
        });
    },

    // Swap the CONTENTS, not the panes (owner, September 2026): the seam
    // stays where it is, so the top pane keeps its size and the story and
    // the game change places inside them. From the grip and from the menu.
    swapPanes() {
        this.split.swap = !this.split.swap;
        this.split.ratio = 1 - this.split.ratio;
        this._saveSplit();
        this._layoutSplit();
        this._paintOwnership();
        this._scheduleSettle();
    },

    // ── the menu: open, close, and the two sections that are not fixed ──

    // Escape, and a tap anywhere outside, close the menu. Keyboard users
    // open it with Enter or Space on ☰. The pointer path is pointerup (in
    // _initChromeDrag), and a tap ALSO fires a click afterwards — with
    // detail 0 on some touch paths, so detail cannot tell it from a key.
    // A click right after a pointer toggle is that same tap; skip it.
    _initMenuDismiss() {
        const { chrome, handle } = this.elements;
        handle.addEventListener('click', () => {
            if (performance.now() - (this._pointerToggledAt || 0) < 600) return;
            this._setCollapsed(!chrome.classList.contains('collapsed'));
        });
        chrome.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || chrome.classList.contains('collapsed')) return;
            e.stopPropagation();
            this._setCollapsed(true);
            handle.focus();
        });
        document.addEventListener('pointerdown', (e) => {
            if (!chrome.classList.contains('collapsed') && !chrome.contains(e.target)) this._setCollapsed(true);
        }, true);
        // a tap in a frame (the game, the story) never reaches this page as
        // a pointerdown; the page losing focus to it is the signal instead
        window.addEventListener('blur', () => {
            if (!chrome.classList.contains('collapsed')) this._setCollapsed(true);
        });
    },

    // The on-screen controls: shown, faint until touched, hidden until
    // touched, or off. The pad is the shell's (FoafOS.pad); the menu only
    // offers the choice while the pad applies to this game.
    PAD_MODES: [['show', 'Always shown'], ['faint', 'Faint until touched'],
                ['hidden', 'Hidden until touched'], ['off', 'Off']],
    _renderPadSection() {
        const sect = this.elements.padSect;
        const pad = window.FoafOS?.pad;
        if (!sect) return;
        const applies = !!pad?.applies?.();
        sect.hidden = !applies;
        if (!applies) return;
        const now = pad.mode();
        sect.textContent = '';
        const h = document.createElement('span');
        h.className = 'wm-sect-title';
        h.textContent = 'On-screen controls';
        h.setAttribute('aria-hidden', 'true');
        sect.appendChild(h);
        for (const [m, label] of this.PAD_MODES) {
            const b = this._row(m === now ? '●' : '○', label);
            b.dataset.padMode = m;
            b.setAttribute('aria-pressed', String(m === now));
            b.addEventListener('click', () => { pad.setMode(m); this._renderPadSection(); });
            sect.appendChild(b);
        }
    },

    // THE APP'S OWN ACTIONS (spec §5.9). The guest declares them as data
    // (id, label, checked, nested items); the shell draws them here, in
    // the one menu, and sends the chosen id back. A check leaves the menu
    // open; a plain action closes it; a group opens its items in place.
    // The app's readout (spec §5.10), under the menu's title.
    setAppStatus(text) {
        const el = document.getElementById('wm-status');
        if (!el) return;
        el.textContent = text || '';
        el.hidden = !text;
    },

    setAppActions(items, title = null) {
        this._appActions = Array.isArray(items) && items.length ? items : null;
        if (title !== null) this._appTitle = title;
        if (!this._appActions) this._appPath = [];
        this._renderAppSection();
    },
    _renderAppSection() {
        const sect = this.elements.appSect;
        if (!sect) return;
        sect.textContent = '';
        if (!this._appActions) { sect.hidden = true; return; }
        sect.hidden = false;
        // walk down the open groups; a group that vanished closes back up
        let list = this._appActions, titles = [];
        const path = [];
        for (const id of this._appPath || []) {
            const g = list.find((x) => x.id === id && Array.isArray(x.items));
            if (!g) break;
            path.push(id); titles.push(g.label); list = g.items;
        }
        this._appPath = path;
        const name = titles.length ? titles[titles.length - 1] : (this._appTitle || 'This game');
        sect.setAttribute('aria-label', name);
        const h = document.createElement('span');
        h.className = 'wm-sect-title';
        h.textContent = name;
        h.setAttribute('aria-hidden', 'true');
        sect.appendChild(h);
        if (path.length) {
            const back = this._row('‹', titles.length > 1 ? titles[titles.length - 2] : (this._appTitle || 'Back'));
            back.setAttribute('aria-label', `Back to ${back.textContent.slice(1)}`);
            back.classList.add('wm-back');
            back.addEventListener('click', () => { this._appPath.pop(); this._renderAppSection(); this._focusFirstApp(); });
            sect.appendChild(back);
        }
        for (const it of list) {
            const group = Array.isArray(it.items);
            const check = typeof it.checked === 'boolean';
            const b = this._row(group ? '›' : check ? (it.checked ? '✓' : '') : '•', it.label, it.detail);
            b.dataset.action = it.id;
            if (check) b.setAttribute('aria-pressed', String(it.checked));
            if (group) b.setAttribute('aria-expanded', 'false');
            if (it.disabled) b.disabled = true;
            b.addEventListener('click', () => {
                if (group) { this._appPath.push(it.id); this._renderAppSection(); this._focusFirstApp(); return; }
                window.FinkMinigames?.runAction?.(it.id);
                if (!check) this._setCollapsed(true);
            });
            sect.appendChild(b);
        }
    },
    _focusFirstApp() {
        this.elements.appSect?.querySelector('button')?.focus();
    },
    _row(icon, label, detail) {
        const b = document.createElement('button');
        b.type = 'button';
        const i = document.createElement('span');
        i.className = 'wm-ico';
        i.setAttribute('aria-hidden', 'true');
        i.textContent = icon;
        const l = document.createElement('span');
        l.className = 'wm-label';
        l.textContent = label;
        b.append(i, l);
        if (detail) {
            const d = document.createElement('span');
            d.className = 'wm-detail';
            d.textContent = detail;
            b.appendChild(d);
        }
        return b;
    },

    // While a drag of the toolbar or the seam is on, frames take no pointer
    // events. Pointer capture on the handle did not hold when the pointer
    // crossed a sandboxed frame (the story window, measured headless): the
    // moves went to the frame and the drag stopped under the finger.
    _framesAside(on) {
        document.body.classList.toggle('fink-wm-dragging', !!on);
    },

    _loadSplit() {
        try { return JSON.parse(localStorage.getItem(this.SPLIT_KEY)); } catch { return null; }
    },
    _saveSplit() {
        try { localStorage.setItem(this.SPLIT_KEY, JSON.stringify(this.split)); } catch { /* private mode */ }
    },

    // ── chrome: collapse + drag-dock ─────────────────────────────────────

    _setCollapsed(collapsed) {
        const { chrome, handle } = this.elements;
        // If the buttons are about to display:none while one of them holds
        // focus, the focus would silently land on <body>. Hand it to the
        // handle instead — the control that brings everything back.
        if (collapsed && chrome.contains(document.activeElement)
            && document.activeElement !== handle) {
            handle.focus();
        }
        chrome.classList.toggle('collapsed', collapsed);
        handle.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) clearTimeout(this._collapseTimer);
        else {
            // what the menu offers depends on now: the pad, the app's actions
            this._renderPadSection();
            this._renderAppSection();
            this._fitMenu();
        }
    },

    // In split, ☰ sits at the top of the GAME's pane: at the screen top it
    // was over the story window's own buttons, and it said nothing about
    // which pane it serves. A reader's drag-dock still wins.
    _placeChrome(paneTop) {
        const { chrome } = this.elements;
        if (!chrome || this._loadDock()) return;
        chrome.style.top = paneTop === null ? '' : `${Math.round(paneTop + 8)}px`;
    },

    // The panel never runs off the bottom of the visible screen: it
    // scrolls inside the space below its top edge.
    _fitMenu() {
        const { chrome, buttons } = this.elements;
        if (!buttons) return;
        const r = chrome.getBoundingClientRect();
        const vh = window.visualViewport?.height || window.innerHeight;
        const below = vh - r.bottom - 12, above = r.top - 12;
        const up = above > below * 1.3 && below < 360;
        chrome.classList.toggle('menu-up', up);
        buttons.style.maxHeight = `${Math.max(160, Math.round(up ? above : below))}px`;
    },

    // ── Who owns what ────────────────────────────────────────────────
    // Reported from the field: "when splitscreen it can be very confusing
    // which part of the screen the window manager controls". Correct — a
    // toolbar floating over two panes claims neither. Every tiling window
    // manager solved this the same way: name the panes, and mark the one
    // that has the controls.
    //
    // Three cues, cheapest first:
    //   1. each pane carries a small label (STORY / the game's name)
    //   2. the toolbar carries a chip naming its target
    //   3. touching the toolbar accents the edge of the pane it governs
    _paintOwnership() {
        const { view, narrative, chrome, target } = this.elements;
        if (!view) return;
        const mg = window.FinkMinigames;
        const info = mg?.minigameInfo?.[mg?.currentType] || {};
        const name = info.title || mg?.currentType || 'Game';
        const icon = info.icon || '🎮';

        // 1. pane labels. Positioned ABSOLUTELY inside each pane so they
        // never enter the flow — split geometry is measured in pixels and
        // a label in the box would reintroduce the clipping this layout
        // was rebuilt to fix.
        this._paneLabel(view, `${icon} ${name}`, 'game');
        if (narrative) this._paneLabel(narrative, '📖 Story', 'story');
        // Only worth showing when there is more than one pane to tell
        // apart — and then only for a moment. A permanent strip sits on
        // top of the guest's own readout (robbin's FLOCK/SCORE, gridluck's
        // level), which is the occlusion this was meant to relieve. So:
        // name the panes when the layout CHANGES, then get out of the way,
        // exactly like a TV naming its input. Touching the toolbar brings
        // them back, so "which pane?" stays answerable on demand.
        const twoPanes = this.mode === 'split';
        view.classList.toggle('wm-labelled', twoPanes);
        narrative?.classList.toggle('wm-labelled', twoPanes);
        if (twoPanes) this._flashLabels();

        // 2. the menu's title names the game, and in split its pane
        const where = this.split.swap ? 'upper' : 'lower';
        if (target) target.textContent = twoPanes ? `${icon} ${name} · ${where} pane` : `${icon} ${name}`;
        chrome?.classList.toggle('wm-has-target', twoPanes);

        // 3. and say it to assistive tech, which cannot see an accent edge
        chrome?.setAttribute('aria-label',
            twoPanes ? `Controls for the ${name} pane (${where} half)` : `${name} window controls`);
    },

    // Show the pane names for a beat. Reduced-motion users get the same
    // window — this is timing, not decoration.
    _flashLabels(ms = 2600) {
        const { view, narrative } = this.elements;
        clearTimeout(this._labelTimer);
        view?.classList.add('wm-naming');
        narrative?.classList.add('wm-naming');
        this._labelTimer = setTimeout(() => {
            view?.classList.remove('wm-naming');
            narrative?.classList.remove('wm-naming');
        }, ms);
    },

    _paneLabel(pane, text, kind) {
        let el = pane.querySelector(':scope > .wm-pane-label');
        if (!el) {
            el = document.createElement('span');
            el.className = 'wm-pane-label';
            el.dataset.kind = kind;
            // decorative: the pane's accessible name comes from its own
            // role/label, and a screen reader should not read this twice
            el.setAttribute('aria-hidden', 'true');
            pane.appendChild(el);
        }
        el.textContent = text;
    },

    // Accent the governed pane while the player is actually touching the
    // controls — a permanent glow round half the screen would be noise.
    _bindOwnershipCues() {
        const { chrome, view } = this.elements;
        if (!chrome || !view || this._cuesBound) return;
        this._cuesBound = true;   // open() runs per game; these listeners are per page
        const on = () => {
            if (this.mode !== 'split') return;
            view.classList.add('wm-governed');
            this._flashLabels();   // reaching for the controls asks "which pane?"
        };
        const off = () => view.classList.remove('wm-governed');
        for (const ev of ['pointerenter', 'focusin']) chrome.addEventListener(ev, on);
        for (const ev of ['pointerleave', 'focusout']) chrome.addEventListener(ev, off);
        // a tap on a touch screen never hovers: flash it instead
        chrome.addEventListener('pointerdown', () => {
            on();
            clearTimeout(this._governTimer);
            this._governTimer = setTimeout(off, 1400);
        });
    },

    _scheduleCollapse() {
        clearTimeout(this._collapseTimer);
        this._collapseTimer = setTimeout(() => {
            // MEASURED (July 2026, headless sweep after a field report of
            // "vanishing controls"): this timer fired unconditionally — with
            // the pointer sitting ON the toolbar, and with a button inside
            // holding keyboard focus, which then evaporated to <body>. An
            // auto-collapse is anti-clutter; collapsing mid-use is theft.
            // While the pointer is over the toolbar or focus is inside it,
            // punt and re-arm.
            //
            // `_hot` is an EVENT-tracked flag (pointerenter/leave below),
            // not `matches(':hover')`: the pseudo-class is unreliable under
            // automation — measured false with the pointer directly on an
            // element in one headless launcher and stuck true in another —
            // and a control's survival should not depend on which one is
            // watching.
            const c = this.elements.chrome;
            if (this._hot || c.contains(document.activeElement)) {
                this._scheduleCollapse();
                return;
            }
            this._setCollapsed(true);
        }, 4500);
    },

    _initChromeDrag() {
        const { handle, chrome } = this.elements;
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            const rect = chrome.getBoundingClientRect();
            this._drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
            this._framesAside(true);
        });
        handle.addEventListener('pointermove', (e) => {
            if (!this._drag) return;
            const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) this._drag.moved = true;
            if (!this._drag.moved) return;
            chrome.style.left = `${this._drag.left + dx}px`;
            chrome.style.top = `${this._drag.top + dy}px`;
            chrome.style.right = 'auto';
        });
        const finish = (e) => {
            if (!this._drag) return;
            const wasDrag = this._drag.moved;
            this._drag = null;
            this._framesAside(false);
            if (wasDrag) {
                // Dock: snap to the nearer screen edge, clamp vertically.
                const rect = chrome.getBoundingClientRect();
                const side = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
                const top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top));
                const dock = { side, top: Math.round(top) };
                this._applyDock(dock);
                this._saveDock(dock);
                this._haptic();
            } else {
                // A tap on ☰ opens or closes the menu.
                this._pointerToggledAt = performance.now();
                this._setCollapsed(!chrome.classList.contains('collapsed'));
                if (!chrome.classList.contains('collapsed')) this._scheduleCollapse();
            }
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);

        // The presence signals the collapse timer consults. Boundary events
        // rather than :hover (see _scheduleCollapse); leaving re-arms the
        // timer so the toolbar tidies itself once genuinely unattended.
        this._hot = false;
        chrome.addEventListener('pointerenter', () => { this._hot = true; });
        chrome.addEventListener('pointerleave', () => {
            this._hot = false;
            if (!chrome.classList.contains('collapsed')) this._scheduleCollapse();
        });
        // any interaction inside is activity — start the countdown afresh
        chrome.addEventListener('pointerdown', () => this._scheduleCollapse());
        chrome.addEventListener('focusin', () => clearTimeout(this._collapseTimer));
        chrome.addEventListener('focusout', () => {
            if (!chrome.contains(document.activeElement)
                && !chrome.classList.contains('collapsed')) this._scheduleCollapse();
        });
    },

    _applyDock(dock) {
        const { chrome } = this.elements;
        if (!chrome) return;
        if (!dock) {
            // Never dragged: the STYLESHEET owns the geometry. Writing the
            // default as inline pixels froze the grip at top:8px for every
            // mode, which beat the fullscreen-mode rule that drops it below
            // a game's own header band (it sat exactly on Robbin's QUIT
            // chip). Inline geometry is the record of a user's drag — no
            // drag, no inline.
            chrome.style.top = chrome.style.left = chrome.style.right = '';
            chrome.classList.remove('dock-left');
            return;
        }
        const d = dock;
        const maxTop = Math.max(8, window.innerHeight - 56);
        chrome.style.top = `${Math.min(d.top, maxTop)}px`;
        if (d.side === 'left') {
            chrome.style.left = '8px';
            chrome.style.right = 'auto';
        } else {
            chrome.style.left = 'auto';
            chrome.style.right = '8px';
        }
        chrome.classList.toggle('dock-left', d.side === 'left');
    },

    _loadDock() {
        try { return JSON.parse(localStorage.getItem(this.DOCK_KEY)); } catch { return null; }
    },
    _saveDock(dock) {
        try { localStorage.setItem(this.DOCK_KEY, JSON.stringify(dock)); } catch { /* private mode */ }
    },

    // ── pip: drag to move, tap to restore ────────────────────────────────

    _initPipGestures() {
        const { view } = this.elements;
        view.addEventListener('pointerdown', (e) => {
            if (this.mode !== 'pip') return;
            e.preventDefault();
            view.setPointerCapture(e.pointerId);
            const rect = view.getBoundingClientRect();
            this._pipDrag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
        });
        view.addEventListener('pointermove', (e) => {
            if (!this._pipDrag) return;
            const dx = e.clientX - this._pipDrag.x, dy = e.clientY - this._pipDrag.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) this._pipDrag.moved = true;
            if (!this._pipDrag.moved) return;
            const rect = view.getBoundingClientRect();
            const left = Math.max(0, Math.min(window.innerWidth - rect.width, this._pipDrag.left + dx));
            const top = Math.max(0, Math.min(window.innerHeight - rect.height, this._pipDrag.top + dy));
            view.style.left = `${left}px`;
            view.style.top = `${top}px`;
            view.style.right = 'auto';
            view.style.bottom = 'auto';
        });
        const finish = () => {
            if (!this._pipDrag) return;
            const wasDrag = this._pipDrag.moved;
            this._pipDrag = null;
            if (!wasDrag) this.setMode(this.lastNonPipMode);   // tap restores — never a one-way door
        };
        view.addEventListener('pointerup', finish);
        view.addEventListener('pointercancel', finish);
    },

    // ── feedback ─────────────────────────────────────────────────────────

    _haptic() {
        if (navigator.vibrate) navigator.vibrate([10]);
    },

    log(msg) {
        console.log(`[FinkWM] ${msg}`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    FinkWM.init();
});
