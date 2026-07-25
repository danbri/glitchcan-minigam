// FINK Minigames - Orchestrator for managing minigames
// Coordinates view switching and minigame lifecycle
// Supports both inline minigames (gems, chess) and iframe-sandboxed minigames (mudslider)

// The guest→host vocabulary (spec §5). Used to tell "a frame that is not
// a guest said something meaningful" from ordinary page chatter.
const GUEST_MESSAGE_TYPES = new Set([
    'ready', 'progress', 'set-variable', 'complete', 'error', 'log', 'log-batch',
    'announce', 'conformance',
]);

// How long a guest gets to answer the conformance probe before the shell
// concludes it has never heard of the contract. Generous: a guest that
// redirects (robbin) has to load a whole second document first.
const CONFORMANCE_GRACE_MS = 2500;

window.FinkMinigames = {
    // State
    active: false,
    currentType: null,
    currentMode: null,
    iframeMinigame: null,  // Current iframe element (window-mode game)
    windowInstance: null,  // its instance record — see `instances` below
    messageHandler: null,   // the single guest-message router (see _onGuestMessage)
    // Window state (pause, pin, minimize, maximize)
    windowState: {
        paused: false,
        pinned: false,
        minimized: false,
        maximized: false
    },

    // Known iframe-based minigames
    iframeMinigames: ['mudslider', 'battleboids', 'gridluck', 'chess', 'robbin'],

    // Minigame metadata for splash screens and controls
    // controls: 'dpad' (full d-pad + A/B), 'lite' (simplified), 'none' (tap only)
    // `silent: true` means "this guest makes no sound" and is the ONLY
    // way to stay out of the volume control's "cannot be turned down"
    // list without answering the audio probe. The default is deliberately
    // the pessimistic one — a guest we know nothing about is assumed to
    // make noise we cannot reach, because over-reporting what mute misses
    // is safer than promising a silence we cannot deliver. But a SILENT
    // game listed there is a lie in the other direction, and it dilutes
    // the honest entries until nobody reads them. Verified July 2026:
    // gridluck opens an AudioContext and never connects anything to it;
    // chess has no audio code at all.
    minigameInfo: {
        gems: { icon: '💎', title: 'Gem Hunt', subtitle: 'Collect sparkling gems!', controls: 'none', silent: true },
        mega: { icon: '👑', title: 'Mega Gems', subtitle: 'Legendary treasures await!', controls: 'none', silent: true },
        mudslider: { icon: '⛏️', title: 'Mudslider', subtitle: 'Boulder Dash-style puzzle', controls: 'lite' },
        battleboids: { icon: '🧙', title: 'BoidWars', subtitle: 'Command your wizard flock', controls: 'none' },
        gridluck: { icon: '👻', title: 'GridLuck', subtitle: 'Pac-Man style maze chase', controls: 'none', silent: true },
        chess: { icon: '♟️', title: 'Chess', subtitle: 'Classic strategy game', controls: 'none', silent: true },
        robbin: { icon: '🐦', title: 'Robbin', subtitle: 'Grow the flock across the Underground', controls: 'dpad' }
    },

    // Active inline minigames (keyed by container ID)
    inlineMinigames: {},
    _inlineSeq: 0,

    // ---- Guest instances -------------------------------------------------
    // Every running guest gets an id and is routed BY `event.source`.
    //
    // Before this, both message paths were bare `window.addEventListener(
    // 'message', …)` with no provenance check at all. Consequences, all
    // real: a second copy of the same widget answered for the first; two
    // inline widgets each ran BOTH handlers, so one gem counted twice;
    // and any frame on the page could post `set-variable` and have it
    // applied with whatever grants the focused guest happened to hold.
    //
    // Provenance is the whole basis of the capability model. A manifest
    // attached to a TYPE means nothing if the host cannot tell which
    // frame is speaking.
    instances: new Map(),
    _instanceSeq: 0,

    _registerInstance(rec) {
        const id = `mg${++this._instanceSeq}`;
        const inst = {
            id,
            grants: { read: [], write: [] },
            lastSync: { gameGems: 0, storyDiamonds: 0 },
            contracts: new Set(),   // OS services this guest has agreed to
            probeTimer: null,
            ...rec,
        };
        this.instances.set(id, inst);
        window.FoafOS?.bus.publish('minigame.instance', {
            summary: `${inst.type} instance ${id} opened (${this.instances.size} running)`,
            id, type: inst.type, kind: inst.kind, count: this.instances.size,
        });
        return inst;
    },

    _dropInstance(inst) {
        if (!inst || !this.instances.has(inst.id)) return;
        if (inst.probeTimer) clearTimeout(inst.probeTimer);
        window.FoafOS?.audio?.unregister(`guest:${inst.id}`);
        this.instances.delete(inst.id);
        window.FoafOS?.bus.publish('minigame.instance', {
            summary: `${inst.type} instance ${inst.id} closed (${this.instances.size} running)`,
            id: inst.id, type: inst.type, kind: inst.kind, count: this.instances.size, closed: true,
        });
    },

    // WindowProxy identity survives navigation within a browsing context,
    // so this still matches after a wrapper page redirects to the real
    // game (robbin does exactly that).
    _instanceForSource(source) {
        if (!source) return null;
        for (const inst of this.instances.values()) {
            if (inst.iframe?.contentWindow && inst.iframe.contentWindow === source) return inst;
        }
        return null;
    },

    // The single router. One listener for the whole module.
    _onGuestMessage(event) {
        const data = event.data;
        if (!data || typeof data.type !== 'string') return;

        const inst = this._instanceForSource(event.source);
        if (!inst) {
            // Unrouted SDK traffic. Often innocent — a nested wrapper
            // relaying its own chatter — but a spoof looks identical, and
            // silence would hide both. Never treat it as a guest.
            if (GUEST_MESSAGE_TYPES.has(data.type)) {
                this.log(`Ignored unrouted "${data.type}" from an unregistered frame`);
                window.FoafOS?.bus.publish('sys.guest.unrouted', {
                    summary: `ignored "${data.type}" from a frame that is not a running guest`,
                    msg: data.type,
                });
            }
            return;
        }
        if (inst.kind === 'inline') this._handleInlineMessage(inst, data);
        else this._handleIframeMessage(inst, data);
    },

    // ---- Debug clock (host side) ---------------------------------------
    // The shell can run any guest at a fraction of real speed, or freeze
    // it and step frame by frame. Headless drivers (and the Maker
    // window) use this to read a game that is otherwise a blur at
    // SwiftShader's ~2fps. Applies to guests that know nothing about it:
    // debug-clock.js virtualises their clocks. See spec §5.4.
    debug: {
        timeScale: 1,

        // 50 = the "50×" ask: run everything fifty times slower
        slow(factor = 50) { return FinkMinigames.debug.setTimeScale(1 / factor); },
        normal() { return FinkMinigames.debug.setTimeScale(1); },
        freeze() { return FinkMinigames.debug.setTimeScale(0); },

        setTimeScale(scale) {
            const s = Math.max(0, Math.min(50, Number(scale) || 0));
            this.timeScale = s;
            FinkMinigames._sendToIframe({ type: 'debug', timeScale: s });
            document.body.dataset.debugTimeScale = s === 1 ? '' : String(s);
            window.FoafOS?.bus.publish('sys.debug', {
                summary: s === 1 ? 'time scale: real time'
                    : s === 0 ? 'time scale: frozen'
                    : `time scale: ${(1 / s).toFixed(0)}× slow`,
                timeScale: s,
            }, { retain: true });
            FinkMinigames.log(`Debug time scale = ${s}`);
            return s;
        },

        step(frames = 1) {
            FinkMinigames._sendToIframe({ type: 'debug', stepFrames: frames });
            return frames;
        },

        // One call a headless driver can await: everything it needs to
        // know about the running guest.
        state() {
            return {
                timeScale: this.timeScale,
                active: FinkMinigames.active,
                type: FinkMinigames.currentType,
                mode: FinkMinigames.currentMode,
                window: { ...FinkMinigames.windowState },
                wm: window.FinkWM ? { mode: FinkWM.mode, collapsed: FinkWM.collapsed } : null,
                grants: FinkMinigames.currentGrants || null,
                vars: window.FoafOS?.vars ? {
                    depth: FoafOS.vars.depth,
                    denied: FoafOS.vars.log.filter(e => !e.ok).length,
                    written: FoafOS.vars.log.filter(e => e.ok).length,
                    scratch: Object.fromEntries(FoafOS.vars.scratch),
                    recent: FoafOS.vars.log.slice(-12),
                } : null,
            };
        },
    },

    // DOM elements
    elements: {
        narrativeView: null,
        minigameView: null,
        minigameContent: null,
        gameContainer: null,
        chessContainer: null,
        iframeContainer: null,
        returnBtn: null,
        // Control buttons
        pauseBtn: null,
        pinBtn: null,
        minimizeBtn: null,
        maximizeBtn: null,
        frostOverlay: null
    },

    // Initialize the minigame system
    init() {
        this.elements = {
            narrativeView: document.getElementById('narrative-view'),
            minigameView: document.getElementById('minigame-view'),
            minigameContent: document.getElementById('minigame-content'),
            gameContainer: document.getElementById('game-container'),
            chessContainer: document.getElementById('chess-container'),
            iframeContainer: document.getElementById('iframe-minigame-container'),
            returnBtn: document.getElementById('returnToStory'),
            // Control buttons
            pauseBtn: document.getElementById('minigame-pause'),
            pinBtn: document.getElementById('minigame-pin'),
            minimizeBtn: document.getElementById('minigame-minimize'),
            maximizeBtn: document.getElementById('minigame-maximize'),
            frostOverlay: document.getElementById('minigame-frost-overlay'),
            // D-Pad elements
            dpad: document.getElementById('game-dpad'),
            actionBtns: document.getElementById('game-action-btns')
        };

        // The devtools surface, in one place a headless driver can find:
        //   __finkDebug.slow(50); __finkDebug.freeze(); __finkDebug.step(3)
        //   await __finkDebug.state()
        window.__finkDebug = this.debug;
        try {
            const ts = new URLSearchParams(location.search).get('timescale');
            if (ts !== null) this.debug.setTimeScale(parseFloat(ts));
            if (new URLSearchParams(location.search).has('slow')) this.debug.slow(50);
        } catch { /* ignore */ }

        // Initialize inline minigame modules
        if (window.GemsMinigame && this.elements.gameContainer) {
            GemsMinigame.init(this.elements.gameContainer, null);
        }

        if (window.ChessMinigame && this.elements.chessContainer) {
            ChessMinigame.init(this.elements.chessContainer);
        }

        // Return button handler
        if (this.elements.returnBtn) {
            this.elements.returnBtn.addEventListener('click', () => this.endMinigame());
        }

        // Control button handlers
        this._initControlButtons();

        // Initialize d-pad controls
        this._initDPad();

        // Bind message handler for iframe communication
        // ONE listener for the whole module, installed once and never
        // removed. Per-guest listeners were the bug: they all fired for
        // every message on the page, and removing one on close tore down
        // routing for widgets that were still running.
        this.messageHandler = this._onGuestMessage.bind(this);
        window.addEventListener('message', this.messageHandler);

        this.log('Minigames system initialized');
    },

    // Initialize D-Pad touch controls
    _initDPad() {
        const dpad = this.elements.dpad;
        if (!dpad) return;

        // Key mappings for directions
        const dirMap = {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight'
        };

        // Get all d-pad buttons
        const buttons = dpad.querySelectorAll('.dpad-btn[data-dir]');
        buttons.forEach(btn => {
            const dir = btn.dataset.dir;
            const key = dirMap[dir];
            if (!key) return;

            // Track active state for continuous input
            let isPressed = false;
            let repeatInterval = null;

            const startPress = (e) => {
                e.preventDefault();
                if (isPressed) return;
                isPressed = true;
                btn.classList.add('pressed');

                // Send key down
                this._sendKeyToIframe(key, 'keydown');

                // For continuous movement, repeat keydown every 50ms
                repeatInterval = setInterval(() => {
                    if (isPressed) {
                        // repeat:true — a hold is not a stream of fresh
                        // taps, and guests read e.repeat to tell them apart
                        this._sendKeyToIframe(key, 'keydown', null, true);
                    }
                }, 50);
            };

            const endPress = (e) => {
                e.preventDefault();
                if (!isPressed) return;
                isPressed = false;
                btn.classList.remove('pressed');

                // Clear repeat interval
                if (repeatInterval) {
                    clearInterval(repeatInterval);
                    repeatInterval = null;
                }

                // Send key up
                this._sendKeyToIframe(key, 'keyup');
            };

            // Touch events
            btn.addEventListener('touchstart', startPress, { passive: false });
            btn.addEventListener('touchend', endPress, { passive: false });
            btn.addEventListener('touchcancel', endPress, { passive: false });

            // Mouse events for desktop testing
            btn.addEventListener('mousedown', startPress);
            btn.addEventListener('mouseup', endPress);
            btn.addEventListener('mouseleave', endPress);
        });

        // Initialize action buttons
        this._initActionButtons();

        this.log('D-Pad controls initialized');
    },

    // Initialize action buttons (A/B)
    _initActionButtons() {
        const actionA = document.getElementById('action-btn-a');
        const actionB = document.getElementById('action-btn-b');

        if (actionA) {
            this._setupActionButton(actionA, ' ', 'Space'); // Space/Action
        }
        if (actionB) {
            this._setupActionButton(actionB, 'Escape', 'Escape'); // Cancel/Back
        }
    },

    // Setup single action button
    _setupActionButton(btn, key, code) {
        let isPressed = false;

        const startPress = (e) => {
            e.preventDefault();
            if (isPressed) return;
            isPressed = true;
            btn.classList.add('pressed');
            this._sendKeyToIframe(key, 'keydown', code);
        };

        const endPress = (e) => {
            e.preventDefault();
            if (!isPressed) return;
            isPressed = false;
            btn.classList.remove('pressed');
            this._sendKeyToIframe(key, 'keyup', code);
        };

        btn.addEventListener('touchstart', startPress, { passive: false });
        btn.addEventListener('touchend', endPress, { passive: false });
        btn.addEventListener('touchcancel', endPress, { passive: false });
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('mouseleave', endPress);
    },

    // Send keyboard event to iframe minigame
    _sendKeyToIframe(key, eventType, code = null, repeat = false) {
        if (!this.iframeMinigame) return;

        // Send via postMessage to iframe
        this.iframeMinigame.contentWindow?.postMessage({
            type: 'key',
            event: eventType,
            key: key,
            code: code || key,
            repeat: repeat
        }, '*');
    },

    // Show/hide d-pad and action buttons based on control mode
    // 'dpad': show d-pad + A/B buttons
    // 'lite': show d-pad only (no A/B buttons)
    // 'none'/false: hide everything
    _showDPad(controlMode) {
        const showDpad = controlMode === 'dpad' || controlMode === 'lite' || controlMode === true;
        const showActionBtns = controlMode === 'dpad';  // Only full dpad mode gets A/B

        if (this.elements.dpad) {
            this.elements.dpad.style.display = showDpad ? 'block' : 'none';
        }
        if (this.elements.actionBtns) {
            this.elements.actionBtns.style.display = showActionBtns ? 'flex' : 'none';
        }
    },

    // Initialize control button event handlers
    _initControlButtons() {
        const { pauseBtn, pinBtn, minimizeBtn, maximizeBtn } = this.elements;

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
        if (pinBtn) {
            pinBtn.addEventListener('click', () => this.togglePin());
        }
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        }
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => this.toggleMaximize());
        }

        // Click frost overlay to unpause
        if (this.elements.frostOverlay) {
            this.elements.frostOverlay.addEventListener('click', () => {
                if (this.windowState.paused) {
                    this.togglePause();
                }
            });
        }

        // Double-click minimized pip to restore
        if (this.elements.minigameView) {
            this.elements.minigameView.addEventListener('dblclick', (e) => {
                if (this.windowState.minimized) {
                    e.preventDefault();
                    this.toggleMinimize(); // Restore from pip
                }
            });

            // Make pip draggable when minimized or pinned
            this._initDragging();
        }
    },

    // Dragging state
    _dragState: {
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startBottom: 0
    },

    // Initialize dragging for minimized/pinned states
    _initDragging() {
        const view = this.elements.minigameView;
        const controls = document.getElementById('minigame-controls');
        if (!view || !controls) return;

        const startDrag = (e) => {
            // Only drag when minimized or pinned
            if (!this.windowState.minimized && !this.windowState.pinned) return;
            // Don't drag when clicking buttons
            if (e.target.tagName === 'BUTTON') return;

            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;

            this._dragState.isDragging = true;
            this._dragState.startX = touch.clientX;
            this._dragState.startY = touch.clientY;

            // Get current position
            const rect = view.getBoundingClientRect();
            this._dragState.startLeft = rect.left;
            this._dragState.startBottom = window.innerHeight - rect.bottom;

            view.style.transition = 'none';
        };

        const doDrag = (e) => {
            if (!this._dragState.isDragging) return;

            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - this._dragState.startX;
            const deltaY = touch.clientY - this._dragState.startY;

            const newLeft = this._dragState.startLeft + deltaX;
            const newBottom = this._dragState.startBottom - deltaY;

            // Clamp to viewport
            const rect = view.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxBottom = window.innerHeight - rect.height;

            view.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
            view.style.bottom = Math.max(0, Math.min(maxBottom, newBottom)) + 'px';
            view.style.right = 'auto';
        };

        const endDrag = () => {
            if (this._dragState.isDragging) {
                this._dragState.isDragging = false;
                view.style.transition = '';
            }
        };

        // Mouse events
        controls.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        controls.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', doDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    },

    // Toggle pause state
    togglePause() {
        this.windowState.paused = !this.windowState.paused;
        this._updateWindowState();

        if (this.windowState.paused) {
            this.pauseMinigame();
            this.elements.pauseBtn?.classList.add('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '▶';
        } else {
            this.resumeMinigame();
            this.elements.pauseBtn?.classList.remove('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸';
        }
        this.elements.pauseBtn?.setAttribute('aria-pressed', String(this.windowState.paused));

        this.log(`Minigame ${this.windowState.paused ? 'paused' : 'resumed'}`);
    },

    // Toggle pin state (keep visible while reading story)
    togglePin() {
        // Pinning was "keep the pip on top while I read" — the WM's pip
        // already is. Nothing to do but stay addressable.
        window.FinkWM?.setMode('pip');
    },

    _legacyTogglePin() {
        // Can't pin if minimized
        if (this.windowState.minimized) {
            this.toggleMinimize();
        }

        this.windowState.pinned = !this.windowState.pinned;

        if (this.windowState.pinned) {
            // Show narrative view alongside pinned minigame
            this.elements.narrativeView?.classList.add('active');
            this.elements.pinBtn?.classList.add('active');
        } else {
            // Hide narrative view when unpinned (unless exiting)
            if (this.active) {
                this.elements.narrativeView?.classList.remove('active');
            }
            this.elements.pinBtn?.classList.remove('active');
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.pinned ? 'pinned' : 'unpinned'}`);
    },

    // Toggle minimize state (pip mode)
    toggleMinimize() {
        const wm = window.FinkWM;
        if (wm) { wm.setMode(wm.mode === 'pip' ? wm.lastNonPipMode : 'pip'); return; }
        this._legacyToggleMinimize();
    },

    _legacyToggleMinimize() {
        const view = this.elements.minigameView;

        // Add transition class for smooth animation
        view?.classList.add('transitioning');
        setTimeout(() => view?.classList.remove('transitioning'), 350);

        // If maximized, first restore then minimize
        if (this.windowState.maximized) {
            this.windowState.maximized = false;
            this.elements.maximizeBtn?.classList.remove('active');
        }

        this.windowState.minimized = !this.windowState.minimized;

        if (this.windowState.minimized) {
            // Reset position to default corner when minimizing
            if (view) {
                view.style.left = '';
                view.style.right = '20px';
                view.style.bottom = '80px';
            }

            // Show narrative view when minimized
            this.elements.narrativeView?.classList.add('active');
            this.elements.minimizeBtn?.classList.add('active');

            // Update button icon
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '▢'; // Restore icon
                this.elements.minimizeBtn.title = 'Restore';
            }
        } else {
            // Restore from pip
            if (view) {
                view.style.left = '';
                view.style.right = '';
                view.style.bottom = '';
            }

            // Hide narrative if not pinned
            if (!this.windowState.pinned) {
                this.elements.narrativeView?.classList.remove('active');
            }
            this.elements.minimizeBtn?.classList.remove('active');

            // Update button icon
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '−';
                this.elements.minimizeBtn.title = 'Minimize';
            }
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.minimized ? 'minimized to pip' : 'restored from pip'}`);
    },

    // Toggle maximize state (true fullscreen)
    // Kept as aliases so any surviving caller (the dblclick restore path,
    // a bookmarklet, a story) reaches the real window manager instead of
    // the dead geometry it used to drive.
    toggleMaximize() {
        window.FinkWM?.setMode(window.FinkWM.mode === 'full' ? 'split' : 'full');
    },

    _legacyToggleMaximize() {
        const view = this.elements.minigameView;

        // Add transition class for smooth animation
        view?.classList.add('transitioning');
        setTimeout(() => view?.classList.remove('transitioning'), 350);

        // If minimized, restore first
        if (this.windowState.minimized) {
            this.windowState.minimized = false;
            this.elements.minimizeBtn?.classList.remove('active');
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '−';
            }
        }

        this.windowState.maximized = !this.windowState.maximized;

        if (this.windowState.maximized) {
            // Reset any custom positioning
            if (view) {
                view.style.left = '';
                view.style.right = '';
                view.style.bottom = '';
            }

            // Hide pinned state when maximized
            if (this.windowState.pinned) {
                this.windowState.pinned = false;
                this.elements.pinBtn?.classList.remove('active');
            }

            this.elements.maximizeBtn?.classList.add('active');
            this.elements.narrativeView?.classList.remove('active');

            // Update button icon
            if (this.elements.maximizeBtn) {
                this.elements.maximizeBtn.textContent = '▢'; // Restore icon
                this.elements.maximizeBtn.title = 'Restore';
            }
        } else {
            this.elements.maximizeBtn?.classList.remove('active');

            // Update button icon
            if (this.elements.maximizeBtn) {
                this.elements.maximizeBtn.textContent = '□';
                this.elements.maximizeBtn.title = 'Maximize';
            }
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.maximized ? 'maximized' : 'restored'}`);
    },

    // Update CSS classes based on window state
    _updateWindowState() {
        const view = this.elements.minigameView;
        if (!view) return;

        // PAUSE ONLY. Geometry belongs to FinkWM and nothing else.
        //
        // This used to also toggle `.pinned`, `.minimized` and
        // `.maximized` — classes from the pause/pin/min/max bar FinkWM
        // replaced. Their CSS is still full-screen `position: fixed`,
        // `100vw/100vh !important`, `background: #000`, and this ran on
        // every pause, so any path that set one of those flags produced a
        // black overlay the window manager knew nothing about. The
        // buttons are long gone from the DOM, so it was latent rather
        // than live — but a second geometry owner is exactly what this
        // project's own rule forbids, and "latent" only means "not yet".
        view.classList.toggle('paused', this.windowState.paused && !this.guestVerbs?.has('pause'));
        view.classList.remove('pinned', 'minimized', 'maximized');
    },

    // Reset window state when minigame ends
    _resetWindowState() {
        const view = this.elements.minigameView;

        this.windowState = {
            paused: false,
            pinned: false,
            minimized: false,
            maximized: false
        };
        this._updateWindowState();

        // Reset any custom positioning
        if (view) {
            view.style.left = '';
            view.style.right = '';
            view.style.bottom = '';

            // CRITICAL: Remove window state classes that have z-index/position:fixed
            // Without this, state-full (z-index:2000, position:fixed) blocks clicks on narrative
            view.classList.remove('state-full', 'state-split', 'state-pip',
                'state-embed', 'state-mini-live', 'state-mini-paused');
            view.classList.remove('wm-transitioning', 'slider-transitioning');
        }

        // Reset button states and icons
        this.elements.pauseBtn?.classList.remove('active');
        if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸';

        this.elements.pinBtn?.classList.remove('active');

        this.elements.minimizeBtn?.classList.remove('active');
        if (this.elements.minimizeBtn) {
            this.elements.minimizeBtn.textContent = '−';
            this.elements.minimizeBtn.title = 'Minimize';
        }

        this.elements.maximizeBtn?.classList.remove('active');
        if (this.elements.maximizeBtn) {
            this.elements.maximizeBtn.textContent = '□';
            this.elements.maximizeBtn.title = 'Maximize';
        }
    },

    // Start a minigame by type
    // controls: 'dpad' (full), 'lite' (simple), 'none' (tap) - or null to use default
    startMinigame(type = 'gems', mode = 'normal', controls = null) {
        // Determine controls from parameter or default from minigameInfo
        const info = this.minigameInfo[type] || {};
        const effectiveControls = controls || info.controls || 'none';

        this.log(`Starting minigame: ${type} (mode: ${mode}, controls: ${effectiveControls})`);

        this.active = true;
        this.currentType = type;
        this.currentMode = mode;
        this.currentControls = effectiveControls;

        window.FoafOS?.bus.publish('minigame.start',
            { type, mode, summary: `${(this.minigameInfo[type] || {}).title || type} started (${mode})` });

        // Switch to minigame view
        this.switchView('minigame');

        // Open the game window (FinkWM owns geometry: full/split/pip)
        if (window.FinkWM) {
            FinkWM.open('full');
        }

        // Input surface is the shell's (FoafInput); legacy pad stays hidden
        this._showDPad(false);
        window.FoafOS?.refreshPad?.();

        // Check if this is an iframe-based minigame
        if (this.iframeMinigames.includes(type)) {
            this.startIframeMinigame(type, mode);
            return;
        }

        // Start appropriate inline minigame
        switch (type) {
            case 'chess':
                this.startChess();
                break;
            case 'gems':
            case 'mega':
            default:
                this.startGems(mode);
                break;
        }
    },

    // Start an iframe-sandboxed minigame
    startIframeMinigame(type, mode = 'full') {
        this.log(`Starting iframe minigame: ${type} (${mode})`);

        // Delta-based sync baseline; it lives on the instance record so
        // parallel widgets cannot measure their gems against each other's.
        const currentDiamonds = window.FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
        this.log(`Starting sync: diamonds=${currentDiamonds}`);

        // Hide other containers
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = 'none';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }

        // Show iframe container
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'flex';
            this.elements.iframeContainer.innerHTML = ''; // Clear previous

            // Create sandboxed iframe
            const iframe = document.createElement('iframe');
            iframe.title = `${(this.minigameInfo[type] || {}).title || type} minigame`;
            iframe.sandbox = 'allow-scripts';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            iframe.id = `minigame-iframe-${type}`;

            const inst = this._registerInstance({
                type, kind: 'window', iframe,
                lastSync: { gameGems: 0, storyDiamonds: currentDiamonds },
            });
            this.windowInstance = inst;
            // The story's ambience belongs to the story surface. A game
            // window is a different place, and `# FOLEY: water(...)` is a
            // LOOPING noise bed with a 60s tail — so without this it
            // played on underneath an unrelated game. Field report: played
            // riverbend muted, started gridluck, unmuted, and there was
            // riverbend's river. Mute is a level, not a stop, so it hid
            // the leak rather than causing it.
            //
            // fink-player.js already stops foley when the story CHANGES;
            // this is the same rule for the other way of leaving the
            // story. Window minigames only — an inline one is part of the
            // story surface and its ambience should carry on.
            if (window.FinkFoley) {
                window.FinkFoley.stop();
                window.FoafOS?.bus.publish('audio.foley.stop', {
                    summary: `story ambience stopped for ${type}`, reason: 'minigame-window',
                });
            }
            // Until it answers, assume we cannot reach its audio. Better
            // for the mute button to over-report what it misses than to
            // claim silence it cannot deliver — but not for a guest we
            // KNOW is silent, which would just be a different lie.
            const info = this.minigameInfo[type] || {};
            if (!info.silent) {
                window.FoafOS?.audio?.register(`guest:${inst.id}`, () => {}, {
                    label: info.title || type, kind: 'uncontrollable',
                });
            }

            // Until the manifest lands, the guest may write nothing. A
            // race that opened a hole would be worse than one that
            // briefly closed one.
            this.currentGrants = inst.grants;

            // Manifest 'features' become the iframe's permissions policy
            // (e.g. geolocation for teleport-home). Best-effort: no
            // manifest, no features. allow must be set BEFORE src.
            // 'variables' becomes the guest's write capability — see
            // _setStoryVariable; before this was wired the manifest was
            // decorative and any guest could set any story variable.
            fetch(`../minigames/${type}/manifest.json`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
                .then(manifest => {
                    const feats = manifest?.features || [];
                    if (feats.length) {
                        iframe.allow = feats.map(f => `${f} 'src'`).join('; ');
                        this.log(`Manifest features granted: ${feats.join(', ')}`);
                    }
                    inst.grants = this._normalizeGrants(manifest, type);
                    this.currentGrants = inst.grants;
                    iframe.src = `../minigames/${type}/index.html`;
                });

            this.elements.iframeContainer.appendChild(iframe);
            this.iframeMinigame = iframe;

            // Wait for iframe to load, then send init
            iframe.onload = () => {
                this.log('Iframe loaded, sending init');
                const config = {
                    mode,
                    // Input is an OS service: the host owns the on-screen
                    // pad (it alone sees the real viewport + safe areas).
                    // SAFETY RULE: only claim the input when we will
                    // actually render a pad — a guest told to hide its own
                    // controls by a host that then shows none leaves the
                    // player with no way to move.
                    controls: {
                        provider: (this.currentControls && this.currentControls !== 'none') ? 'host' : 'guest',
                        scheme: this.currentControls,
                    },
                    // The contracts we are offering. A guest that knows
                    // them answers with `conformance`; silence means it
                    // predates them and keeps doing its own thing.
                    contracts: ['controls', 'audio'],
                    // Current master level, so a guest starts at the right
                    // volume instead of blasting once and then ducking.
                    audio: window.FoafOS?.audio
                        ? { level: FoafOS.audio.level, volume: FoafOS.audio.volume, muted: FoafOS.audio.muted }
                        : null,
                };
                this._sendToIframe({
                    type: 'init',
                    config,
                    variables: this._getStoryVariables(this._guestActor(inst))
                });
                this._probeConformance(inst, config);
                // D-pad visibility is handled in startMinigame based on controls param
            };
        }
    },

    // Handle messages from a window-mode guest. `inst` came from
    // event.source — every piece of state this touches is that
    // instance's, never the module's.
    _handleIframeMessage(inst, data) {
        this.log(`[${inst.id}/${inst.type}] ${data.type}`);
        window.FoafOS?.bus.publish('sys.sdk.rx',
            { summary: `← ${data.type} (${inst.id})`, msg: data.type, from: inst.id, detail: data },
            { source: 'sdk' });

        switch (data.type) {
            case 'ready':
                this.log('Minigame ready, capabilities: ' + JSON.stringify(data.capabilities));
                // Verb protocol: the guest declares which shell verbs it
                // handles natively (its own dialogs/presentation). For those
                // the shell DELEGATES instead of imposing its generic
                // behavior. Undeclared verbs get the shell fallback.
                inst.verbs = new Set(data.capabilities?.verbs || []);
                this.guestVerbs = inst.verbs;
                // a guest that starts while the shell is slowed must be
                // slowed too, or debugging only works for the first game
                if (this.debug.timeScale !== 1) {
                    this._sendToIframe({ type: 'debug', timeScale: this.debug.timeScale }, inst);
                }
                break;

            case 'progress':
                // Delta-based sync: preserves changes from parallel activities
                if (data.data && data.data.gems !== undefined) {
                    this._applyGemDelta(inst, data.data.gems);
                }
                if (data.data?.score !== undefined) {
                    this._setStoryVariable('score', data.data.score, this._guestActor(inst));
                }
                break;

            case 'set-variable':
                this._setStoryVariable(data.name, data.value, this._guestActor(inst));
                break;

            case 'complete':
                this.log('Minigame complete: ' + JSON.stringify(data.result));
                this._handleIframeComplete(inst, data.result);
                break;

            case 'conformance':
                this._acceptConformance(inst, data.contracts);
                break;

            case 'announce':
                this._announce(inst, data.text);
                break;

            case 'error':
                this.log(`Minigame error: ${data.code} - ${data.message}`);
                break;

            case 'log':
                // Route minigame log to dev panel
                if (window.FinkDevPanel) {
                    FinkDevPanel.log(`[Minigame] ${data.message}`, data.level === 'error' ? 'error' : 'game');
                }
                break;

            case 'log-batch':
                // Route batched minigame logs to dev panel
                if (window.FinkDevPanel && data.logs) {
                    data.logs.forEach(log => {
                        FinkDevPanel.log(`[Minigame] ${log.message}`, log.level === 'error' ? 'error' : 'game');
                    });
                }
                break;
        }
    },

    // ---- Conformance probe -----------------------------------------------
    // The shell cannot inspect a guest: opaque origin, no DOM access. So
    // "does this widget know its duties?" can only be answered by asking
    // and seeing whether anyone answers.
    //
    // The rule is ADAPTATION, not compliance. A guest that answers gets
    // the OS service. A guest that stays silent has never heard of the
    // contract, so it is doing its own thing — and the shell RETRACTS the
    // equivalent service rather than stacking on top of it. Mudslider is
    // why: it drew its own arrows underneath the shell's joystick, and
    // the player got two overlapping control systems.
    //
    // Silence therefore costs a legacy widget nothing. It keeps working
    // exactly as it did standalone, which is the whole point.
    _probeConformance(inst, config) {
        if (inst.probeTimer) clearTimeout(inst.probeTimer);
        // Nothing to retract if we were never providing the service.
        if (config?.controls?.provider !== 'host') return;
        inst.probeTimer = setTimeout(() => {
            inst.probeTimer = null;
            if (inst.contracts.has('controls')) return;   // answered in time
            this._retractInputService(inst);
        }, CONFORMANCE_GRACE_MS);
    },

    // Hand input back to a guest that never agreed to give it up.
    _retractInputService(inst) {
        if (inst.inputRetracted) return;
        inst.inputRetracted = true;
        this.log(`[${inst.id}] no controls conformance — retracting the host pad`);
        // Tell it plainly, in case it is listening but wasn't built for
        // the handshake; a guest that hid its pad on 'host' will show it
        // again on 'guest'.
        this._sendToIframe({
            type: 'controls',
            controls: { provider: 'guest', scheme: this.currentControls },
        }, inst);
        if (inst === this.windowInstance) {
            this._showDPad('none');
            window.FoafOS?.refreshPad?.();   // the shell owns the real pad
        }
        window.FoafOS?.bus.publish('sys.guest.nonconforming', {
            summary: `${inst.type} does not speak the controls contract — it keeps its own`,
            id: inst.id, type: inst.type, contract: 'controls',
        });
    },

    // A guest that answers LATE still gets the service back: better a
    // brief flicker than a game with no controls at all.
    _acceptConformance(inst, contracts) {
        const hadAudio = inst.contracts.has('audio');
        for (const c of contracts || []) inst.contracts.add(c);
        // A guest that speaks `audio` becomes a sink of the master
        // volume; one that does not is registered as UNGOVERNABLE, so
        // the mute button can say what it cannot reach.
        if (!hadAudio && inst.contracts.has('audio')) this._registerAudioSink(inst);
        window.FoafOS?.bus.publish('sys.guest.conformance', {
            summary: `${inst.type} speaks: ${[...inst.contracts].join(', ') || '(nothing)'}`,
            id: inst.id, type: inst.type, contracts: [...inst.contracts],
        });
        if (!inst.contracts.has('controls')) return;
        if (inst.probeTimer) { clearTimeout(inst.probeTimer); inst.probeTimer = null; }
        if (inst.inputRetracted && this.currentControls && this.currentControls !== 'none') {
            inst.inputRetracted = false;
            this.log(`[${inst.id}] late controls conformance — restoring the host pad`);
            this._sendToIframe({
                type: 'controls',
                controls: { provider: 'host', scheme: this.currentControls },
            }, inst);
            if (inst === this.windowInstance) {
                this._showDPad(this.currentControls);
                window.FoafOS?.refreshPad?.();
            }
        }
    },

    // Make this guest obey the master volume. Only possible because it
    // answered the probe — there is no way to turn down an iframe from
    // outside.
    _registerAudioSink(inst) {
        const audio = window.FoafOS?.audio;
        if (!audio || inst.audioSink) return;
        const info = this.minigameInfo[inst.type] || {};
        audio.unregister(`guest:${inst.id}`);   // drop any 'uncontrollable' placeholder
        inst.audioSink = audio.register(`guest:${inst.id}`, (level) => {
            this._sendToIframe({ type: 'audio-level', level,
                volume: audio.volume, muted: audio.muted }, inst);
        }, { label: info.title || inst.type, kind: 'guest' });
    },

    // Pooled accessibility: a guest says something, the SHELL announces
    // it. A sandboxed iframe's own live region works, but the host
    // announcer is where the player's attention already is, it survives
    // the guest closing, and with several widgets running it is the only
    // place that can say WHICH one spoke.
    _announce(inst, text) {
        if (!text) return;
        const info = this.minigameInfo[inst.type] || {};
        const many = [...this.instances.values()].filter(i => i.type === inst.type).length > 1;
        const who = many ? `${info.title || inst.type} ${inst.id}` : (info.title || inst.type);
        window.FoafOS?.bus.publish('guest.announce', {
            summary: `${who}: ${String(text).slice(0, 300)}`,
            id: inst.id, type: inst.type, text,
        });
    },

    // Per-instance gem→diamond bridge. Two widgets reporting gems used
    // to share one `lastSync`, so each one's report was measured against
    // the other's last total and the story's diamonds walked randomly.
    _applyGemDelta(inst, currentGems) {
        const gameDelta = currentGems - inst.lastSync.gameGems;
        const storyDiamonds = FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
        const newDiamonds = storyDiamonds + gameDelta;
        // A 'progress' report is the guest asking for a write. It goes
        // through the broker like any other, so a game that never
        // declared `diamonds` cannot mint them.
        if (this._setStoryVariable('diamonds', newDiamonds, this._guestActor(inst))) {
            inst.lastSync = { gameGems: currentGems, storyDiamonds: newDiamonds };
            this.log(`[${inst.id}] progress: game=${currentGems} delta=+${gameDelta} diamonds=${newDiamonds}`);
        } else {
            // don't let a denied write accumulate as a debt the next
            // report would cash in
            inst.lastSync.gameGems = currentGems;
        }
    },

    // Send message to a guest. Defaults to the window-mode game; pass an
    // instance to address an inline widget.
    _sendToIframe(data, inst = null) {
        const target = inst ? inst.iframe : this.iframeMinigame;
        if (target && target.contentWindow) {
            target.contentWindow.postMessage(data, '*');
            // SDK tap: makers watch the protocol on sys.sdk.* (hidden
            // from the default feed, shown in the Maker window).
            // 'key' is excluded — d-pad repeat fires every 50ms and
            // tapping it would burn the frame budget on bus dispatch.
            if (data.type !== 'key') {
                window.FoafOS?.bus.publish('sys.sdk.tx',
                    { summary: `→ ${data.type}`, msg: data.type, detail: data }, { source: 'sdk' });
            }
        }
    },

    // Handle iframe minigame completion
    _handleIframeComplete(inst, result) {
        // Update story variables from result
        if (result.variables) {
            const actor = this._guestActor(inst);
            for (const [name, value] of Object.entries(result.variables)) {
                this._setStoryVariable(name, value, actor);
            }
        }

        // Clean up iframe
        this._cleanupIframe();

        // Complete the minigame
        this.handleMinigameComplete({
            type: this.currentType,
            success: result.success,
            score: result.score
        });
    },

    // Clean up iframe minigame
    _cleanupIframe() {
        this._dropInstance(this.windowInstance);
        this.windowInstance = null;

        if (this.iframeMinigame) {
            this.iframeMinigame.remove();
            this.iframeMinigame = null;
        }

        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
            this.elements.iframeContainer.innerHTML = '';
        }
    },

    // ---- Variable governance -------------------------------------------
    // A minigame is untrusted sandboxed code. Its manifest says which
    // story variables it may touch; FoafVars (packages/foafos) is what
    // makes that claim binding. Everything the guest can reach — init
    // variables, progress, set-variable, complete.variables — goes
    // through here, so "story2 messing with story1's innards" is a
    // denied, audited event rather than a silent success.

    // Manifest → capability. A guest with no manifest gets nothing but
    // the shared economy's read side; failing open here would make the
    // whole mechanism theatre.
    _normalizeGrants(manifest, type) {
        const v = manifest?.variables;
        if (!v) {
            this.log(`No manifest for "${type}" — guest granted no variable writes`);
            window.FoafOS?.bus.publish('vars.unmanifested', {
                summary: `${type} has no manifest: writes will be denied`, id: type,
            });
            return { read: [], write: [] };
        }
        return {
            read: Array.isArray(v.read) ? v.read.slice() : [],
            write: Array.isArray(v.write) ? v.write.slice() : [],
        };
    },

    // `inst` is required for anything a guest can trigger — the actor
    // must describe the frame that SPOKE, not whichever game happens to
    // be focused. The no-arg form is for host-initiated reads only.
    _guestActor(inst = null) {
        const src = inst || this.windowInstance;
        return {
            kind: 'guest',
            id: src?.type || this.currentType || 'guest',
            instance: src?.id || null,
            grants: src?.grants || this.currentGrants || { read: [], write: [] },
        };
    },

    // Get story variables for minigame. `actor` filters what a guest may
    // SEE — a chess game has no business reading a story's private state.
    _getStoryVariables(actor = null) {
        if (!window.FinkInkEngine || !FinkInkEngine.story) return {};

        const vars = {};
        const story = FinkInkEngine.story;

        // The shared economy plus the conventional host-provided context.
        // A guest additionally sees whatever its manifest declares.
        const names = new Set([
            'diamonds', 'mega_diamonds', 'keys', 'score', 'player_level', 'difficulty',
            ...(actor?.grants?.read || []), ...(actor?.grants?.write || []),
        ]);
        names.forEach(name => {
            if (story.variablesState[name] !== undefined) {
                vars[name] = story.variablesState[name];
            }
        });

        // The broker has the last word on what a guest may see.
        const broker = window.FoafOS?.vars;
        return broker ? broker.filterReadable(actor, vars) : vars;
    },

    // Set a story variable. Returns true when the write actually landed.
    // `actor` defaults to the host itself (story-driven writes, inline
    // widgets the shell renders directly); guests must pass _guestActor().
    _setStoryVariable(name, value, actor = null) {
        if (!window.FinkInkEngine || !FinkInkEngine.story) return false;

        const story = FinkInkEngine.story;
        const apply = (n, v) => {
            story.variablesState[n] = v;
            this.log(`Set variable ${n} = ${v}`);
            if (window.FinkUI && FinkUI.updateStatsDisplay) {
                FinkUI.updateStatsDisplay();
            }
        };

        const broker = window.FoafOS?.vars;
        try {
            if (!broker) {           // shell not present (bare/standalone use)
                apply(name, value);
                return true;
            }
            return broker.write(actor || { kind: 'host', id: 'shell' }, name, value, apply);
        } catch (e) {
            this.log(`Error setting variable ${name}: ${e.message}`);
            return false;
        }
    },

    // Start gems minigame
    startGems(mode = 'normal') {
        // Show gem elements, hide others
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = '';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Start the minigame
        if (window.GemsMinigame) {
            GemsMinigame.start(mode, (result) => {
                // Result will be passed when game ends via return button
            });
        }
    },

    // Start chess minigame
    startChess() {
        // Hide gem elements, show chess
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = 'none';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'flex';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Start the chess game
        if (window.ChessMinigame) {
            ChessMinigame.start((result) => {
                this.handleMinigameComplete(result);
            });
        }
    },

    // Pause current minigame (for iframe minigames)
    pauseMinigame() {
        if (this.iframeMinigame) {
            this._sendToIframe({ type: 'pause' });
        } else {
            window.GemsMinigame?.setPaused?.(true);   // builtin games
        }
    },

    // Resume current minigame
    resumeMinigame() {
        if (this.iframeMinigame) {
            this._sendToIframe({ type: 'resume' });
        } else {
            window.GemsMinigame?.setPaused?.(false);
        }
    },

    // End the current minigame
    endMinigame() {
        this.log('Ending minigame');

        // Handle iframe minigame
        if (this.iframeMinigame) {
            // Verb protocol: a guest that declared 'quit' owns the exit
            // flow (its own confirmation dialog; it completes via the SDK
            // when the player decides). Pressing exit again within 10s is
            // the escape hatch — hard terminate, never a stuck window.
            if (this.guestVerbs?.has('quit') && Date.now() - (this._quitSentAt || 0) > 10000) {
                this._quitSentAt = Date.now();
                this._sendToIframe({ type: 'quit' });
                this.log('Quit delegated to guest (exit again to force)');
                return;
            }
            this._sendToIframe({ type: 'terminate', reason: 'user_exit' });
            this._cleanupIframe();
            this.handleMinigameComplete({ type: this.currentType, success: false });
            return;
        }

        // Handle inline minigames
        let result = null;

        switch (this.currentType) {
            case 'chess':
                if (window.ChessMinigame) {
                    result = ChessMinigame.end();
                }
                break;
            case 'gems':
            default:
                if (window.GemsMinigame) {
                    result = GemsMinigame.end();
                }
                break;
        }

        this.handleMinigameComplete(result);
    },

    // Handle minigame completion
    handleMinigameComplete(result) {
        this.log(`Minigame complete: ${JSON.stringify(result)}`);
        this.guestVerbs = null;
        this._quitSentAt = 0;
        window.FoafOS?.bus.publish('minigame.complete', {
            type: this.currentType, success: result?.success ?? null, score: result?.score ?? null,
            summary: `${(this.minigameInfo[this.currentType] || {}).title || this.currentType} finished` +
                (result?.score != null ? ` · score ${result.score}` : ''),
        });
        this.log(`Window state before reset: ${JSON.stringify(this.windowState)}`);

        this.active = false;

        // Reset window state (paused, pinned, minimized, maximized)
        this._resetWindowState();
        this.log(`Window state after reset: ${JSON.stringify(this.windowState)}`);

        // Close the game window and hide the d-pad
        if (window.FinkWM) {
            FinkWM.close();
        }
        this._showDPad(false);

        // Reset UI
        if (this.elements.gameContainer) {
            this.elements.gameContainer.classList.remove('mega-mode');
            this.elements.gameContainer.style.display = '';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Update story variables if available
        this.updateStoryVariables(result);

        // Switch back to narrative view - removes 'active' class from minigame
        this.switchView('narrative');

        // CRITICAL: Force minigame view fully hidden
        // The .view class has display:none when not .active, but position:fixed
        // states (pinned, minimized) can override. Ensure ALL state classes removed.
        if (this.elements.minigameView) {
            // Remove ALL position-altering classes
            this.elements.minigameView.classList.remove(
                'active', 'paused', 'pinned', 'minimized', 'maximized',
                'transitioning', 'state-full', 'state-split', 'state-pip',
                'state-embed', 'state-mini-live', 'state-mini-paused',
                'wm-transitioning', 'slider-transitioning'
            );
            // Clear any inline styles that might override CSS
            this.elements.minigameView.style.cssText = '';
            this.log('Minigame view: all classes and styles cleared');
        }

        // Reset UI state to ensure choices work
        if (window.FinkUI) {
            FinkUI.animationInProgress = false;
            FinkUI.hideStatus();
            this.log(`FinkUI.animationInProgress set to false`);
        }

        // Continue story after a brief delay to ensure DOM updates
        setTimeout(() => {
            this.log('Timeout fired - calling continueStory');
            if (window.FinkInkEngine && FinkInkEngine.continueStory) {
                FinkInkEngine.continueStory();
            }
        }, 100);
    },

    // Update story variables based on minigame results
    updateStoryVariables(result) {
        if (!result || !window.FinkInkEngine || !FinkInkEngine.story) return;

        const story = FinkInkEngine.story;

        try {
            if (result.type === 'chess') {
                // Chess variables - support both 'won' (legacy) and 'success' (iframe SDK)
                const chessWon = result.won !== undefined ? result.won : result.success;
                if (story.variablesState['chess_won'] !== undefined) {
                    story.variablesState['chess_won'] = chessWon;
                }
                if (story.variablesState['chess_game_completed'] !== undefined) {
                    story.variablesState['chess_game_completed'] = true;
                }
                this.log(`Chess result: won=${chessWon}`);
            } else if (result.type === 'mudslider') {
                // Mudslider: add collected gems to diamonds (same pattern as gems minigame)
                if (result.score !== undefined && result.score > 0) {
                    const oldDiamonds = story.variablesState['diamonds'] || 0;
                    story.variablesState['diamonds'] = oldDiamonds + result.score;
                    this.log(`Updated diamonds: ${oldDiamonds} + ${result.score} = ${story.variablesState['diamonds']}`);
                }
                if (story.variablesState['minigame_played'] !== undefined) {
                    story.variablesState['minigame_played'] = true;
                }
            } else {
                // Gems variables
                if (result.isMega) {
                    const oldMega = story.variablesState['mega_diamonds'] || 0;
                    story.variablesState['mega_diamonds'] = oldMega + result.collected;
                    this.log(`Updated mega_diamonds: ${oldMega} -> ${story.variablesState['mega_diamonds']}`);
                } else if (result.collected !== undefined) {
                    const oldDiamonds = story.variablesState['diamonds'] || 0;
                    story.variablesState['diamonds'] = oldDiamonds + result.collected;
                    this.log(`Updated diamonds: ${oldDiamonds} -> ${story.variablesState['diamonds']}`);
                }

                if (story.variablesState['minigame_played'] !== undefined) {
                    story.variablesState['minigame_played'] = true;
                }
            }

            // Update stats display if available
            if (window.FinkUI && FinkUI.updateStatsDisplay) {
                FinkUI.updateStatsDisplay();
            }
        } catch (e) {
            this.log(`Error updating variables: ${e.message}`);
        }
    },

    // Switch between views
    switchView(viewName) {
        if (this.elements.narrativeView) {
            this.elements.narrativeView.classList.toggle('active', viewName === 'narrative');
        }
        if (this.elements.minigameView) {
            this.elements.minigameView.classList.toggle('active', viewName === 'minigame');
        }
        this.log(`Switched to ${viewName} view`);
    },

    // Check if any minigame is active
    isActive() {
        return this.active;
    },

    // Get current minigame type
    getCurrentType() {
        return this.currentType;
    },

    log(msg) {
        if (window.FinkDevPanel) {
            FinkDevPanel.log(`Minigames: ${msg}`, 'game');
        } else {
            console.log(`[FinkMinigames] ${msg}`);
        }
    },

    // ========== INLINE MINIGAME SYSTEM ==========

    /**
     * Create an inline minigame container that embeds in story flow
     * @param {string} type - Minigame type (gems, mudslider, etc.)
     * @param {string} display - Display mode: 'inline', 'medium', 'full'
     * @param {object} options - Additional options (preview image, etc.)
     * @returns {HTMLElement} The container element to insert into story
     */
    createInlineContainer(type, display = 'medium', options = {}) {
        // NOT Date.now(): two widgets opened in the same millisecond got
        // the same id, so the second overwrote the first's record and
        // closing either closed both. A counter is the only thing that
        // actually guarantees distinctness.
        const containerId = `inline-minigame-${++this._inlineSeq}`;
        const info = this.minigameInfo[type] || { icon: '🎮', title: type, subtitle: '' };

        this.log(`Creating inline container: ${type} (${display})`);

        // Create main container
        const container = document.createElement('div');
        container.className = `inline-minigame size-${display}`;
        container.id = containerId;
        container.dataset.type = type;
        container.dataset.display = display;

        // Content area
        const content = document.createElement('div');
        content.className = 'inline-minigame-content';
        container.appendChild(content);

        // Controls bar (minimize/expand/close)
        const controls = document.createElement('div');
        controls.className = 'inline-minigame-controls';
        controls.innerHTML = `
            <button class="inline-expand" title="Expand to fullscreen">⛶</button>
            <button class="inline-close" title="Close">✕</button>
        `;
        container.appendChild(controls);

        // For medium mode, show splash first
        if (display === 'medium') {
            const splash = this._createSplashOverlay(type, info, options);
            container.appendChild(splash);

            // Click splash to start
            splash.addEventListener('click', (e) => {
                if (e.target.classList.contains('inline-close')) return;
                splash.classList.add('hidden');
                this._startInlineMinigame(containerId, type, content);
            });
        } else if (display === 'inline') {
            // For inline mode, start immediately (no splash)
            setTimeout(() => {
                this._startInlineMinigame(containerId, type, content);
            }, 100);
        }

        // Wire up control buttons
        controls.querySelector('.inline-expand')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._expandInlineToFullscreen(containerId, type);
        });

        controls.querySelector('.inline-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._closeInlineMinigame(containerId);
        });

        // Store reference
        this.inlineMinigames[containerId] = {
            type,
            display,
            container,
            content,
            active: false
        };

        return container;
    },

    /**
     * Create splash overlay for medium mode
     */
    _createSplashOverlay(type, info, options) {
        const splash = document.createElement('div');
        splash.className = 'inline-minigame-splash';

        // Use preview image if provided, otherwise use icon
        const visual = options.previewImage
            ? `<img src="${options.previewImage}" style="max-width:80%;max-height:50%;object-fit:contain;border-radius:4px;" alt="${info.title}">`
            : `<div class="inline-minigame-splash-icon">${info.icon}</div>`;

        splash.innerHTML = `
            ${visual}
            <div class="inline-minigame-splash-title">${info.title}</div>
            <div class="inline-minigame-splash-subtitle">${info.subtitle}</div>
            <button class="inline-minigame-splash-play">▶ Play</button>
        `;

        return splash;
    },

    /**
     * Start a minigame inside an inline container
     */
    _startInlineMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        this.log(`Starting inline minigame: ${type} in ${containerId}`);
        entry.active = true;

        // Check if this is an iframe-based minigame
        if (this.iframeMinigames.includes(type)) {
            this._startInlineIframeMinigame(containerId, type, contentEl);
            return;
        }

        // For gems/inline games, create a mini game container
        if (type === 'gems' || type === 'mega') {
            this._startInlineGemsMinigame(containerId, type, contentEl);
            return;
        }

        // Fallback: show placeholder
        contentEl.innerHTML = `<div style="color:#888;text-align:center;padding:1em;">
            ${type} minigame (inline mode coming soon)
        </div>`;
    },

    /**
     * Start gems minigame in inline container
     */
    _startInlineGemsMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];

        // Create inline gem container
        const gemContainer = document.createElement('div');
        gemContainer.className = 'inline-gem-container';
        gemContainer.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';
        contentEl.appendChild(gemContainer);

        // Score display
        const scoreEl = document.createElement('div');
        scoreEl.style.cssText = 'position:absolute;top:4px;left:4px;color:var(--zx-yellow);font-size:0.9em;z-index:5;';
        scoreEl.innerHTML = '💎 <span class="gem-count">0</span>';
        gemContainer.appendChild(scoreEl);

        // Start mini gems game
        entry.gemsState = {
            collected: 0,
            container: gemContainer,
            scoreEl: scoreEl.querySelector('.gem-count'),
            mode: type === 'mega' ? 'mega' : 'normal'
        };

        this._spawnInlineGems(containerId);
    },

    /**
     * Spawn gems in inline container
     */
    _spawnInlineGems(containerId) {
        const entry = this.inlineMinigames[containerId];
        if (!entry || !entry.active || !entry.gemsState) return;

        const state = entry.gemsState;
        const cfg = {
            normal: { emojis: ['💎', '💠', '🔷'], count: 5, timeout: 4000 },
            mega: { emojis: ['👑', '💛', '🌟'], count: 3, timeout: 3000 }
        }[state.mode] || { emojis: ['💎'], count: 5, timeout: 4000 };

        // Spawn a few gems
        for (let i = 0; i < cfg.count; i++) {
            setTimeout(() => {
                if (!entry.active) return;
                this._createInlineGem(containerId, cfg);
            }, i * 300);
        }

        // Continue spawning
        setTimeout(() => {
            if (entry.active) this._spawnInlineGems(containerId);
        }, 3000);
    },

    /**
     * Create single gem in inline container
     */
    _createInlineGem(containerId, cfg) {
        const entry = this.inlineMinigames[containerId];
        if (!entry || !entry.gemsState) return;

        const state = entry.gemsState;
        const gem = document.createElement('div');
        gem.className = 'gem';
        gem.textContent = cfg.emojis[Math.floor(Math.random() * cfg.emojis.length)];
        gem.style.cssText = `
            position: absolute;
            font-size: 1.5em;
            cursor: pointer;
            left: ${10 + Math.random() * 70}%;
            top: ${10 + Math.random() * 70}%;
            transition: transform 0.2s;
        `;

        gem.addEventListener('click', () => {
            if (gem.classList.contains('collected')) return;
            gem.classList.add('collected');
            state.collected++;
            state.scoreEl.textContent = state.collected;

            // Update story diamonds
            this._setStoryVariable('diamonds', (FinkInkEngine?.story?.variablesState?.['diamonds'] || 0) + 1);

            // Play sound
            this._playGemSound();

            setTimeout(() => gem.remove(), 300);
        });

        state.container.appendChild(gem);

        // Auto-remove after timeout
        setTimeout(() => {
            if (gem.parentNode && !gem.classList.contains('collected')) {
                gem.style.opacity = '0';
                setTimeout(() => gem.remove(), 300);
            }
        }, cfg.timeout);
    },

    /**
     * Play gem collection sound
     */
    _playGemSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800 + Math.random() * 400;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { /* ignore */ }
    },

    /**
     * Start iframe-based minigame in inline container
     */
    _startInlineIframeMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        // Delta-based sync baseline (kept on the instance record)
        const currentDiamonds = window.FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;

        // Create sandboxed iframe
        const iframe = document.createElement('iframe');
        iframe.title = `${(this.minigameInfo[type] || {}).title || type} minigame`;
        iframe.sandbox = 'allow-scripts';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        contentEl.appendChild(iframe);

        entry.iframe = iframe;
        entry.type = type;

        // This is the surface where several widgets genuinely run at
        // once — two spreadsheets, two gem boards, the same story with a
        // widget in two knots. Each gets its OWN instance record, and
        // the router hands it only its own frame's messages.
        const inst = this._registerInstance({
            type, kind: 'inline', iframe, containerId,
            lastSync: { gameGems: 0, storyDiamonds: currentDiamonds },
        });
        entry.instance = inst;

        // Inline widgets are guests too, and get the same manifest
        // capability as full-window ones (src is set only once grants
        // are known, so a fast guest cannot beat the check).
        fetch(`../minigames/${type}/manifest.json`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(manifest => {
                inst.grants = this._normalizeGrants(manifest, type);
                entry.grants = inst.grants;
                iframe.src = `../minigames/${type}/index.html`;
            });

        // Send init when loaded
        iframe.onload = () => {
            this.log(`Inline iframe loaded for ${containerId} (${inst.id})`);
            iframe.contentWindow?.postMessage({
                type: 'init',
                config: { mode: 'inline', display: entry.display, instance: inst.id },
                variables: this._getStoryVariables(this._guestActor(inst))
            }, '*');
        };
    },

    /**
     * Handle messages from an inline widget. Routed by event.source, so
     * two copies of the same widget can never answer for each other.
     */
    _handleInlineMessage(inst, data) {
        const entry = this.inlineMinigames[inst.containerId];
        if (!entry) return;

        window.FoafOS?.bus.publish('sys.sdk.rx',
            { summary: `← ${data.type} (${inst.id} inline)`, msg: data.type, from: inst.id },
            { source: 'sdk' });

        switch (data.type) {
            case 'progress':
                if (data.data?.gems !== undefined) this._applyGemDelta(inst, data.data.gems);
                break;

            case 'set-variable':
                this._setStoryVariable(data.name, data.value, this._guestActor(inst));
                break;

            case 'conformance':
                this._acceptConformance(inst, data.contracts);
                break;

            case 'announce':
                this._announce(inst, data.text);
                break;

            case 'complete':
                this.log(`Inline minigame complete: ${inst.containerId} (${inst.id})`);
                if (data.result?.variables) {
                    const actor = this._guestActor(inst);
                    for (const [n, v] of Object.entries(data.result.variables)) {
                        this._setStoryVariable(n, v, actor);
                    }
                }
                break;
        }
    },

    /**
     * Expand inline minigame to fullscreen view
     */
    _expandInlineToFullscreen(containerId, type) {
        this.log(`Expanding ${containerId} to fullscreen`);

        // Close inline version
        this._closeInlineMinigame(containerId, false);

        // Start fullscreen version
        this.startMinigame(type, 'normal');
    },

    /**
     * Close an inline minigame
     */
    _closeInlineMinigame(containerId, continueStory = true) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        this.log(`Closing inline minigame: ${containerId}`);
        entry.active = false;
        this._dropInstance(entry.instance);

        // Remove container from DOM
        entry.container?.remove();

        // Remove from tracking
        delete this.inlineMinigames[containerId];

        // Continue story if requested
        if (continueStory && window.FinkInkEngine) {
            FinkInkEngine.continueStory();
        }
    }
};
