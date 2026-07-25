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
        };
        if (!this.elements.chrome || !this.elements.view) {
            this.log('chrome elements missing — window manager idle');
            return;
        }

        for (const [mode, btn] of Object.entries(this.elements.modeBtns)) {
            btn?.addEventListener('click', () => this.setMode(mode));
        }

        this._initChromeDrag();
        this._initPipGestures();
        this._applyDock(this._loadDock());
        window.addEventListener('resize', () => { this._applyDock(this._loadDock()); this._layoutSplit(); });

        this.log('window manager ready');
    },

    // ── lifecycle ────────────────────────────────────────────────────────

    open(mode = 'full') {
        this.active = true;
        this.elements.chrome.classList.remove('wm-hidden');
        // Open EXPANDED: a lone ▦ grip reads as "this game has no window
        // controls" (reported from the field). Show the toolbar, then let
        // the usual idle timer tuck it away.
        this._setCollapsed(false);
        this._scheduleCollapse();
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
        this.elements.handle.textContent = { full: '▣', split: '◫', pip: '◰' }[mode] || '▦';

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
            return;
        }
        const total = main.clientHeight;
        const gameH = Math.max(180, Math.round(total * 0.52));
        view.style.height = `${gameH}px`;
        narrative.style.height = `${Math.max(0, total - gameH)}px`;
    },

    // ── chrome: collapse + drag-dock ─────────────────────────────────────

    _setCollapsed(collapsed) {
        this.elements.chrome.classList.toggle('collapsed', collapsed);
        this.elements.handle.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) clearTimeout(this._collapseTimer);
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

        // 2. the chip
        if (target) target.textContent = twoPanes ? `${icon} ${name}` : '';
        chrome?.classList.toggle('wm-has-target', twoPanes);

        // 3. and say it to assistive tech, which cannot see an accent edge
        chrome?.setAttribute('aria-label',
            twoPanes ? `Controls for the ${name} pane (lower half)` : `${name} window controls`);
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
        this._collapseTimer = setTimeout(() => this._setCollapsed(true), 4500);
    },

    _initChromeDrag() {
        const { handle, chrome } = this.elements;
        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            const rect = chrome.getBoundingClientRect();
            this._drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
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
                // A tap on the grip toggles the toolbar.
                this._setCollapsed(!chrome.classList.contains('collapsed'));
                if (!chrome.classList.contains('collapsed')) this._scheduleCollapse();
            }
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', finish);
    },

    _applyDock(dock) {
        const { chrome } = this.elements;
        if (!chrome) return;
        const d = dock || { side: 'right', top: 8 };
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
        if (window.FinkDevPanel) {
            FinkDevPanel.log(`WM: ${msg}`, 'game');
        } else {
            console.log(`[FinkWM] ${msg}`);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    FinkWM.init();
});
