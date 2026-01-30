/**
 * Elliott 4130 UI Controller
 * Handles all DOM interactions and UI updates
 */

class E4130UI {
    constructor() {
        this.cpu = null;
        this.asm = null;
        this.debug = null;
        this.timer = null;
        this.selectedTape = null;

        // Bind methods
        this.update = this.update.bind(this);
        this.load = this.load.bind(this);
        this.run = this.run.bind(this);
        this.step = this.step.bind(this);
        this.stop = this.stop.bind(this);
        this.reset = this.reset.bind(this);
    }

    /**
     * Initialize the UI
     */
    init() {
        // Create core components
        this.cpu = new E4130({
            outputHandler: (text) => this.appendOutput(text),
            inputHandler: () => this.requestInput()
        });
        this.asm = new Asm();
        this.debug = new E4130Debug(this.cpu, this.asm);

        // Setup keyboard input
        this.setupKeyboardInput();

        // Setup debug logging
        this.debug.onLog = (entry) => this.appendLog(entry);
        this.debug.onTrace = (entry) => {
            if (this.debug.settings.traceEnabled) {
                this.appendLog({
                    level: 'TRACE',
                    message: this.debug.formatTraceEntry(entry)
                });
            }
        };

        // Initialize UI
        this.setupTabs();
        this.setupControls();
        this.setupDebugConsole();
        this.loadTapes();
        this.initTests();
        this.update();

        this.debug.info('Elliott 4130 Emulator initialized');
    }

    /**
     * Setup tab switching
     */
    setupTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            };
        });
    }

    /**
     * Setup control buttons
     */
    setupControls() {
        // Main controls
        const controls = {
            'bLoad': this.load,
            'bRun': this.run,
            'bStep': this.step,
            'bStop': this.stop,
            'bReset': this.reset,
            'bSave': () => this.saveTape(),
            'bDel': () => this.deleteTape()
        };

        for (const [id, handler] of Object.entries(controls)) {
            const el = document.getElementById(id);
            if (el) el.onclick = handler;
        }

        // Test controls
        const runTestsBtn = document.getElementById('runTests');
        if (runTestsBtn) runTestsBtn.onclick = () => this.runAllTests();

        const clearLogBtn = document.getElementById('clearLog');
        if (clearLogBtn) clearLogBtn.onclick = () => this.clearLog();

        // Debug options
        this.setupDebugOptions();
    }

    /**
     * Setup debug options checkboxes
     */
    setupDebugOptions() {
        const options = {
            'dbgTrace': 'traceEnabled',
            'dbgBreak': 'breakOnError',
            'dbgVerbose': 'verboseDisasm'
        };

        for (const [id, setting] of Object.entries(options)) {
            const el = document.getElementById(id);
            if (el) {
                el.checked = this.debug.settings[setting];
                el.onchange = () => {
                    this.debug.settings[setting] = el.checked;
                    this.debug.info(`${setting} = ${el.checked}`);
                };
            }
        }
    }

    /**
     * Setup debug console
     */
    setupDebugConsole() {
        const consoleInput = document.getElementById('debugConsole');
        if (consoleInput) {
            consoleInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const cmd = consoleInput.value.trim();
                    if (cmd) {
                        this.appendLog({ level: 'CMD', message: `> ${cmd}` });
                        const result = this.debug.executeCommand(cmd);
                        this.appendLog({ level: 'RESULT', message: result });
                        consoleInput.value = '';
                    }
                }
            };
        }
    }

    /**
     * Update UI to reflect CPU state
     */
    update() {
        // Registers
        const setEl = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setEl('rM', this.cpu.M.toString(8).padStart(8, '0'));
        setEl('rR', this.cpu.R.toString(8).padStart(8, '0'));
        setEl('rS', this.cpu.S.toString(8).padStart(6, '0'));
        setEl('rK', this.cpu.K.toString(8).padStart(4, '0'));

        // Header registers (compact display)
        setEl('hM', this.cpu.M.toString(8).padStart(8, '0'));
        setEl('hR', this.cpu.R.toString(8).padStart(8, '0'));
        setEl('hS', this.cpu.S.toString(8).padStart(4, '0'));
        setEl('hK', this.cpu.K.toString(8).padStart(4, '0'));

        // Condition flags (c24-c20: Neg St Nz Ca Of)
        const setFlag = (id, on) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('on', on);
        };

        setFlag('cN', this.cpu.C & this.cpu.F_NEG);    // c24
        setFlag('cSt', this.cpu.C & this.cpu.F_ST);    // c23
        setFlag('cZ', this.cpu.C & this.cpu.F_NZ);     // c22
        setFlag('cCa', this.cpu.C & this.cpu.F_CA);    // c21
        setFlag('cO', this.cpu.C & this.cpu.F_OF);     // c20

        // Header condition LEDs (all 5 flags)
        setFlag('hN', this.cpu.C & this.cpu.F_NEG);
        setFlag('hSt', this.cpu.C & this.cpu.F_ST);
        setFlag('hZ', this.cpu.C & this.cpu.F_NZ);
        setFlag('hCa', this.cpu.C & this.cpu.F_CA);
        setFlag('hOf', this.cpu.C & this.cpu.F_OF);

        // Protected Mode registers (Base, Range, RTC)
        setEl('rBase', this.cpu.baseReg.toString(8).padStart(3, '0'));
        setEl('rRange', this.cpu.rangeReg.toString(8).padStart(3, '0'));
        setEl('rRTC', this.cpu.rtcCounter.toString());

        // Mode indicator (Executive/Protected)
        const modeEl = document.getElementById('rMode');
        const hModeEl = document.getElementById('hMode');
        if (modeEl) {
            modeEl.textContent = this.cpu.executiveMode ? 'EXEC' : 'PROT';
            modeEl.classList.toggle('exec', this.cpu.executiveMode);
            modeEl.classList.toggle('prot', !this.cpu.executiveMode);
        }
        if (hModeEl) {
            hModeEl.textContent = this.cpu.executiveMode ? 'EXEC' : 'PROT';
            hModeEl.classList.toggle('prot', !this.cpu.executiveMode);
        }

        // Status
        setEl('iCnt', this.cpu.iCount);
        setEl('statTxt', this.cpu.halted ? 'Halted' : 'Running');

        const runLed = document.getElementById('runLed');
        if (runLed) runLed.classList.toggle('on', !this.cpu.halted);

        // Memory view
        this.updateMemoryView();

        // Input status and Q register
        this.updateInputStatus();
    }

    /**
     * Update memory view around PC
     */
    updateMemoryView() {
        const el = document.getElementById('mem');
        if (!el) return;

        const pc = this.cpu.S >> 1;
        let html = '';

        for (let a = Math.max(0, pc - 2); a <= Math.min(65535, pc + 12); a++) {
            const w = this.cpu.mem[a];
            const isCurrent = a === pc;
            const dis = disasm(w, this.debug.settings.verboseDisasm);

            html += `<div class="mem-line${isCurrent ? ' current' : ''}">`;
            html += `<span class="mem-addr">${a}</span>`;
            html += `<span class="mem-hex">${w.toString(8).padStart(8, '0')}</span>`;
            html += `<span class="mem-asm">${dis}</span>`;
            html += '</div>';
        }

        el.innerHTML = html;
    }

    /**
     * Load and assemble program
     */
    load() {
        const srcEl = document.getElementById('src');
        if (!srcEl) return;

        const source = srcEl.value;
        const program = this.asm.asm(source);

        // Check for assembly errors
        const errors = this.asm.getErrors();
        if (errors.length > 0) {
            for (const err of errors) {
                this.debug.error(`Line ${err.line}: ${err.msg}`);
            }
            return;
        }

        // Reset and load
        this.cpu.reset();
        for (const { addr, word } of program) {
            this.cpu.mem[addr] = word;
        }

        this.cpu.halted = false;
        this.clearOutput();
        this.update();

        this.debug.info(`Loaded ${program.length} words`);
    }

    /**
     * Run program continuously
     */
    run() {
        if (this.cpu.halted) this.cpu.halted = false;

        const speedEl = document.getElementById('speed');
        const delay = speedEl ? Math.max(1, 101 - speedEl.value) : 50;

        if (this.timer) clearInterval(this.timer);

        this.debug.startPerfTracking();

        this.timer = setInterval(() => {
            // Check for infinite loop
            const w = this.cpu.mem[this.cpu.S >> 1];
            const f = (w >> 18) & 0x3F;
            const y = (w >> 16) & 3;
            const n = w & 0x7FFF;

            if (f === 0o45 && y === 0 && n === this.cpu.S) {
                this.stop();
                this.debug.info('Stopped at infinite loop');
                return;
            }

            if (!this.cpu.step()) {
                this.stop();
                return;
            }

            this.update();

            // Safety limit
            if (this.cpu.iCount > 100000) {
                this.stop();
                this.debug.warn('Execution limit reached (100000 cycles)');
                this.appendOutput('\n[Limit]');
            }
        }, delay);
    }

    /**
     * Single step execution
     */
    step() {
        if (this.cpu.halted) this.cpu.halted = false;
        this.cpu.step();
        this.update();
    }

    /**
     * Stop execution
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.cpu.halted = true;
        this.update();

        if (this.debug.perfStats.startTime) {
            this.debug.stopPerfTracking();
        }
    }

    /**
     * Reset CPU and clear output
     */
    reset() {
        this.stop();
        this.cpu.reset();
        this.clearOutput();
        this.update();
        this.debug.info('CPU reset');
    }

    /**
     * Append text to teleprinter output
     */
    appendOutput(text) {
        const el = document.getElementById('tty');
        if (el) {
            el.textContent += text;
            el.scrollTop = el.scrollHeight;
        }
    }

    /**
     * Clear teleprinter output
     */
    clearOutput() {
        const el = document.getElementById('tty');
        if (el) el.textContent = '';
    }

    /**
     * Setup keyboard input handling
     */
    setupKeyboardInput() {
        const inputEl = document.getElementById('ttyInput');
        if (!inputEl) return;

        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Send entire line plus newline
                const text = inputEl.value + '\n';
                this.cpu.stringInput(text);
                this.appendOutput(text);  // Echo input
                inputEl.value = '';
                this.updateInputStatus();
            }
        });

        inputEl.addEventListener('keydown', (e) => {
            // Handle special keys
            if (e.key === 'Escape') {
                // Clear input buffer
                this.cpu.inputBuffer = [];
                inputEl.value = '';
                this.updateInputStatus();
            }
        });
    }

    /**
     * Request input from user
     */
    requestInput() {
        const inputEl = document.getElementById('ttyInput');
        const statusEl = document.getElementById('inputStatus');
        const containerEl = document.getElementById('ttyStatus');

        if (inputEl) {
            inputEl.classList.add('waiting');
            inputEl.focus();
        }
        if (statusEl) statusEl.textContent = 'WAITING FOR INPUT';
        if (containerEl) containerEl.classList.add('waiting');
    }

    /**
     * Update input status display
     */
    updateInputStatus() {
        const inputEl = document.getElementById('ttyInput');
        const statusEl = document.getElementById('inputStatus');
        const containerEl = document.getElementById('ttyStatus');
        const qEl = document.getElementById('qReg');

        if (this.cpu.waitingForInput) {
            if (inputEl) inputEl.classList.add('waiting');
            if (statusEl) statusEl.textContent = 'WAITING FOR INPUT';
            if (containerEl) containerEl.classList.add('waiting');
        } else {
            if (inputEl) inputEl.classList.remove('waiting');
            if (statusEl) statusEl.textContent = this.cpu.inputBuffer.length > 0 ?
                `Buffer: ${this.cpu.inputBuffer.length}` : 'Ready';
            if (containerEl) containerEl.classList.remove('waiting');
        }

        // Update Q register display
        if (qEl && this.cpu.Q !== undefined) {
            qEl.textContent = this.cpu.Q.toString(8).padStart(8, '0');
        }
    }

    /**
     * Append entry to debug log
     */
    appendLog(entry) {
        const el = document.getElementById('logArea');
        if (!el) return;

        const levelColors = {
            DEBUG: '#666',
            INFO: '#0f0',
            WARN: '#ff0',
            ERROR: '#f00',
            TRACE: '#0af',
            CMD: '#f80',
            RESULT: '#888'
        };

        const color = levelColors[entry.level] || '#0f0';
        const ts = new Date().toISOString().split('T')[1].slice(0, 12);
        const line = `[${ts}] ${entry.level}: ${entry.message}\n`;

        el.textContent += line;
        el.scrollTop = el.scrollHeight;
    }

    /**
     * Clear debug log
     */
    clearLog() {
        const el = document.getElementById('logArea');
        if (el) el.textContent = '';
        this.debug.clearLogs();
    }

    /**
     * Load saved tapes from localStorage
     */
    loadTapes() {
        const tapes = JSON.parse(localStorage.getItem('e4130_tapes') || '{}');
        const el = document.getElementById('tapes');
        if (!el) return;

        el.innerHTML = '';
        for (const name of Object.keys(tapes)) {
            const div = document.createElement('div');
            div.className = 'tape-item' + (name === this.selectedTape ? ' selected' : '');
            div.textContent = name;
            div.onclick = () => {
                this.selectedTape = name;
                const srcEl = document.getElementById('src');
                if (srcEl) srcEl.value = tapes[name];
                this.loadTapes();
            };
            el.appendChild(div);
        }
    }

    /**
     * Save current program as tape
     */
    saveTape() {
        const name = prompt('Tape name:');
        if (!name) return;

        const srcEl = document.getElementById('src');
        if (!srcEl) return;

        const tapes = JSON.parse(localStorage.getItem('e4130_tapes') || '{}');
        tapes[name] = srcEl.value;
        localStorage.setItem('e4130_tapes', JSON.stringify(tapes));

        this.selectedTape = name;
        this.loadTapes();
        this.debug.info(`Saved tape: ${name}`);
    }

    /**
     * Delete selected tape
     */
    deleteTape() {
        if (!this.selectedTape || !confirm(`Delete "${this.selectedTape}"?`)) return;

        const tapes = JSON.parse(localStorage.getItem('e4130_tapes') || '{}');
        delete tapes[this.selectedTape];
        localStorage.setItem('e4130_tapes', JSON.stringify(tapes));

        this.debug.info(`Deleted tape: ${this.selectedTape}`);
        this.selectedTape = null;
        this.loadTapes();
    }

    /**
     * Initialize test list
     */
    initTests() {
        const el = document.getElementById('testList');
        if (!el) return;

        // Run tests to get the list
        const results = E4130Tests.runAll();

        el.innerHTML = '';
        for (const test of results) {
            const div = document.createElement('div');
            div.className = 'test-item';
            div.innerHTML = `
                <span class="test-cat">${test.category.split('.')[0]}</span>
                <span class="test-name">${test.name}</span>
                <span class="test-status wait">--</span>
            `;
            el.appendChild(div);
        }
    }

    /**
     * Run all tests and update UI
     */
    runAllTests() {
        const el = document.getElementById('testList');
        const summaryEl = document.getElementById('testSummary');
        if (!el) return;

        this.debug.info('Running test suite...');

        const results = E4130Tests.runAll();
        const summary = E4130Tests.getSummary();

        el.innerHTML = '';

        // Group by category
        let currentCat = '';
        for (const test of results) {
            // Add category header if new
            if (test.category !== currentCat) {
                currentCat = test.category;
                const catDiv = document.createElement('div');
                catDiv.className = 'test-category';
                catDiv.textContent = currentCat;

                const catStats = summary.categories[currentCat];
                const catSpan = document.createElement('span');
                catSpan.className = 'test-cat-stats';
                catSpan.textContent = ` (${catStats.passed}/${catStats.total})`;
                catSpan.style.color = catStats.passed === catStats.total ? '#0f0' : '#f80';
                catDiv.appendChild(catSpan);

                el.appendChild(catDiv);
            }

            const div = document.createElement('div');
            div.className = 'test-item';

            const statusClass = test.passed ? 'pass' : 'fail';
            const statusText = test.passed ? 'PASS' : 'FAIL';

            div.innerHTML = `
                <span class="test-name">${test.name}</span>
                <span class="test-status ${statusClass}">${statusText}</span>
            `;

            if (test.error) {
                div.title = test.error;
            }

            el.appendChild(div);
        }

        // Update summary
        if (summaryEl) {
            summaryEl.textContent = `${summary.passed}/${summary.total} passed`;
            summaryEl.style.color = summary.failed ? '#f00' : '#0f0';
        }

        this.debug.info(`Tests complete: ${summary.passed}/${summary.total} passed`);
    }
}

// Global UI instance
let ui;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    ui = new E4130UI();
    ui.init();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E4130UI };
}
