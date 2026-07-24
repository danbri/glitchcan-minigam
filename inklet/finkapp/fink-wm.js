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
        window.addEventListener('resize', () => this._applyDock(this._loadDock()));

        this.log('window manager ready');
    },

    // ── lifecycle ────────────────────────────────────────────────────────

    open(mode = 'full') {
        this.active = true;
        this.elements.chrome.classList.remove('wm-hidden');
        this._setCollapsed(true);
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

        // Leaving pip clears any dragged-to position.
        if (old === 'pip' && mode !== 'pip') {
            view.style.left = view.style.top = view.style.right = view.style.bottom = '';
        }

        // The story shares the screen in every mode but full.
        if (narrative) narrative.classList.toggle('active', mode !== 'full');

        for (const [m, btn] of Object.entries(this.elements.modeBtns)) {
            btn?.classList.toggle('active', m === mode);
        }
        this.elements.handle.textContent = { full: '▣', split: '◫', pip: '◰' }[mode] || '▦';

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

    // ── chrome: collapse + drag-dock ─────────────────────────────────────

    _setCollapsed(collapsed) {
        this.elements.chrome.classList.toggle('collapsed', collapsed);
        this.elements.handle.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) clearTimeout(this._collapseTimer);
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
