/**
 * Elliott 4130 Debug and Logging System
 * Provides execution tracing, breakpoints, memory inspection, and logging
 */

class E4130Debug {
    constructor(cpu, asm) {
        this.cpu = cpu;
        this.asm = asm;

        // Settings
        this.settings = {
            traceEnabled: false,
            breakOnError: false,
            verboseDisasm: false,
            logMemWrites: false,
            logRegChanges: false,
            maxLogEntries: 1000
        };

        // Log buffer
        this.logs = [];
        this.traceHistory = [];
        this.maxTraceHistory = 100;

        // Watched addresses
        this.watchedAddresses = new Set();

        // Performance tracking
        this.perfStats = {
            totalCycles: 0,
            startTime: null,
            instructionCounts: {}
        };

        // Bind trace handler
        this.cpu.traceHandler = this.handleTrace.bind(this);
    }

    /**
     * Log levels
     */
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        TRACE: 4
    };

    /**
     * Add log entry
     */
    log(level, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            cpuState: this.getCpuSnapshot()
        };

        this.logs.push(entry);

        // Trim if too many entries
        if (this.logs.length > this.settings.maxLogEntries) {
            this.logs = this.logs.slice(-this.settings.maxLogEntries);
        }

        // Notify listeners
        if (this.onLog) {
            this.onLog(entry);
        }

        return entry;
    }

    debug(msg, data) { return this.log('DEBUG', msg, data); }
    info(msg, data) { return this.log('INFO', msg, data); }
    warn(msg, data) { return this.log('WARN', msg, data); }
    error(msg, data) { return this.log('ERROR', msg, data); }

    /**
     * Handle trace callback from CPU
     */
    handleTrace(state) {
        if (!this.settings.traceEnabled) return;

        const entry = {
            addr: state.addr,
            word: state.word,
            disasm: disasm(state.word, this.settings.verboseDisasm),
            M: state.M,
            R: state.R,
            S: state.S,
            K: state.K,
            C: state.C,
            cycle: this.cpu.iCount
        };

        this.traceHistory.push(entry);
        if (this.traceHistory.length > this.maxTraceHistory) {
            this.traceHistory.shift();
        }

        // Track instruction frequency
        const f = (state.word >> 18) & 0x3F;
        const key = f >= 0o40 ? `L${f.toString(8)}` : `S${f.toString(8)}`;
        this.perfStats.instructionCounts[key] = (this.perfStats.instructionCounts[key] || 0) + 1;

        // Log trace if enabled
        if (this.onTrace) {
            this.onTrace(entry);
        }
    }

    /**
     * Get current CPU state snapshot
     */
    getCpuSnapshot() {
        return {
            M: this.cpu.M,
            R: this.cpu.R,
            S: this.cpu.S,
            K: this.cpu.K,
            C: this.cpu.C,
            halted: this.cpu.halted,
            iCount: this.cpu.iCount
        };
    }

    /**
     * Format CPU state as string
     */
    formatState(state = null) {
        state = state || this.getCpuSnapshot();
        const flags = [];
        if (state.C & 32) flags.push('N');
        if (state.C & 16) flags.push('ST');
        if (state.C & 8) flags.push('NZ');
        if (state.C & 4) flags.push('CA');
        if (state.C & 2) flags.push('OF');

        return [
            `M=${formatWord(state.M)}`,
            `R=${formatWord(state.R)}`,
            `S=${state.S.toString(8).padStart(6, '0')}`,
            `K=${state.K.toString(8).padStart(4, '0')}`,
            `C=[${flags.join(',')}]`,
            `I=${state.iCount}`
        ].join(' ');
    }

    /**
     * Dump memory range
     */
    dumpMemory(startAddr, count = 16) {
        const lines = [];
        for (let i = 0; i < count; i++) {
            const addr = startAddr + i;
            const word = this.cpu.rd(addr);
            const dis = disasm(word, this.settings.verboseDisasm);
            lines.push(`${formatAddr(addr)}: ${formatWord(word)}  ${dis}`);
        }
        return lines.join('\n');
    }

    /**
     * Dump memory around current PC
     */
    dumpContext(before = 3, after = 10) {
        const pc = this.cpu.S >> 1;
        const start = Math.max(0, pc - before);
        const count = before + after + 1;
        return this.dumpMemory(start, count);
    }

    /**
     * Watch memory address for changes
     */
    watch(addr) {
        this.watchedAddresses.add(addr);
        this.info(`Watching address ${addr}`, { addr });
    }

    /**
     * Remove memory watch
     */
    unwatch(addr) {
        this.watchedAddresses.delete(addr);
        this.info(`Unwatched address ${addr}`, { addr });
    }

    /**
     * Clear all watches
     */
    clearWatches() {
        this.watchedAddresses.clear();
        this.info('Cleared all watches');
    }

    /**
     * Start performance tracking
     */
    startPerfTracking() {
        this.perfStats = {
            totalCycles: 0,
            startTime: performance.now(),
            instructionCounts: {}
        };
        this.info('Started performance tracking');
    }

    /**
     * Stop performance tracking and get report
     */
    stopPerfTracking() {
        const endTime = performance.now();
        const elapsed = endTime - this.perfStats.startTime;
        const cycles = this.cpu.iCount - this.perfStats.totalCycles;
        const cps = (cycles / elapsed) * 1000;

        const report = {
            elapsed: elapsed.toFixed(2) + 'ms',
            cycles,
            cyclesPerSecond: cps.toFixed(0),
            instructionCounts: this.perfStats.instructionCounts
        };

        this.info('Performance report', report);
        return report;
    }

    /**
     * Get instruction frequency report
     */
    getInstructionFrequency() {
        const counts = this.perfStats.instructionCounts;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => ({
                opcode: key,
                count,
                percent: ((count / total) * 100).toFixed(1) + '%'
            }));
    }

    /**
     * Get trace history
     */
    getTraceHistory(count = 20) {
        return this.traceHistory.slice(-count);
    }

    /**
     * Format trace entry
     */
    formatTraceEntry(entry) {
        return [
            `[${entry.cycle}]`,
            `@${formatAddr(entry.addr)}:`,
            formatWord(entry.word),
            entry.disasm.padEnd(20),
            `M=${formatWord(entry.M)}`,
            `R=${formatWord(entry.R)}`
        ].join(' ');
    }

    /**
     * Get formatted trace history
     */
    formatTraceHistory(count = 20) {
        return this.getTraceHistory(count)
            .map(e => this.formatTraceEntry(e))
            .join('\n');
    }

    /**
     * Clear logs
     */
    clearLogs() {
        this.logs = [];
        this.info('Logs cleared');
    }

    /**
     * Clear trace history
     */
    clearTrace() {
        this.traceHistory = [];
        this.info('Trace history cleared');
    }

    /**
     * Get logs filtered by level
     */
    getLogsByLevel(level) {
        return this.logs.filter(l => l.level === level);
    }

    /**
     * Get all logs as formatted text
     */
    formatLogs(count = 50) {
        return this.logs.slice(-count).map(entry => {
            const ts = entry.timestamp.split('T')[1].slice(0, 12);
            const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
            return `[${ts}] ${entry.level.padEnd(5)} ${entry.message}${dataStr}`;
        }).join('\n');
    }

    /**
     * Export debug state as JSON
     */
    exportState() {
        return JSON.stringify({
            cpuState: this.getCpuSnapshot(),
            settings: this.settings,
            logs: this.logs.slice(-100),
            traceHistory: this.traceHistory,
            perfStats: this.perfStats,
            watchedAddresses: Array.from(this.watchedAddresses),
            memoryDump: this.dumpContext(5, 20)
        }, null, 2);
    }

    /**
     * Run diagnostics
     */
    runDiagnostics() {
        const results = [];

        // Check CPU state
        results.push({
            name: 'CPU Initialized',
            pass: this.cpu !== null,
            detail: this.cpu ? 'OK' : 'CPU not set'
        });

        // Check memory
        results.push({
            name: 'Memory Array',
            pass: this.cpu.mem && this.cpu.mem.length === 65536,
            detail: this.cpu.mem ? `Length: ${this.cpu.mem.length}` : 'Not initialized'
        });

        // Check assembler
        results.push({
            name: 'Assembler',
            pass: this.asm !== null,
            detail: this.asm ? 'OK' : 'Assembler not set'
        });

        // Test basic assembly
        try {
            const code = this.asm.asm('LD #42');
            results.push({
                name: 'Basic Assembly',
                pass: code.length > 0,
                detail: `Generated ${code.length} words`
            });
        } catch (e) {
            results.push({
                name: 'Basic Assembly',
                pass: false,
                detail: e.message
            });
        }

        // Test basic execution
        try {
            const savedState = this.cpu.getState();
            this.cpu.reset();
            this.cpu.mem[0] = 0o4300042; // LD #42
            this.cpu.halted = false;
            this.cpu.step();
            const passed = this.cpu.M === 42;
            this.cpu.setState(savedState);
            results.push({
                name: 'Basic Execution',
                pass: passed,
                detail: passed ? 'OK' : 'Execution failed'
            });
        } catch (e) {
            results.push({
                name: 'Basic Execution',
                pass: false,
                detail: e.message
            });
        }

        this.info('Diagnostics complete', { results });
        return results;
    }

    /**
     * Interactive console commands
     */
    executeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (command) {
            case 'help':
                return this.helpText();

            case 'state':
            case 's':
                return this.formatState();

            case 'dump':
            case 'd':
                const addr = parseInt(args[0]) || 0;
                const count = parseInt(args[1]) || 16;
                return this.dumpMemory(addr, count);

            case 'context':
            case 'ctx':
                return this.dumpContext();

            case 'trace':
            case 't':
                const n = parseInt(args[0]) || 20;
                return this.formatTraceHistory(n);

            case 'watch':
            case 'w':
                if (args[0]) {
                    this.watch(parseInt(args[0]));
                    return `Watching ${args[0]}`;
                }
                return `Watched: ${Array.from(this.watchedAddresses).join(', ')}`;

            case 'unwatch':
                if (args[0]) {
                    this.unwatch(parseInt(args[0]));
                    return `Unwatched ${args[0]}`;
                }
                return 'Usage: unwatch <addr>';

            case 'break':
            case 'b':
                if (args[0]) {
                    this.cpu.addBreakpoint(parseInt(args[0]));
                    return `Breakpoint at ${args[0]}`;
                }
                return `Breakpoints: ${Array.from(this.cpu.breakpoints).join(', ')}`;

            case 'clear':
                this.cpu.clearBreakpoints();
                return 'Breakpoints cleared';

            case 'perf':
                return JSON.stringify(this.stopPerfTracking(), null, 2);

            case 'freq':
                return this.getInstructionFrequency()
                    .map(f => `${f.opcode}: ${f.count} (${f.percent})`)
                    .join('\n');

            case 'diag':
                return this.runDiagnostics()
                    .map(r => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`)
                    .join('\n');

            case 'export':
                return this.exportState();

            case 'logs':
            case 'l':
                const logCount = parseInt(args[0]) || 20;
                return this.formatLogs(logCount);

            case 'set':
                if (args[0] && args[1] !== undefined) {
                    const key = args[0];
                    const val = args[1] === 'true' ? true :
                               args[1] === 'false' ? false :
                               parseInt(args[1]) || args[1];
                    if (key in this.settings) {
                        this.settings[key] = val;
                        return `${key} = ${val}`;
                    }
                    return `Unknown setting: ${key}`;
                }
                return Object.entries(this.settings)
                    .map(([k, v]) => `${k} = ${v}`)
                    .join('\n');

            default:
                return `Unknown command: ${command}. Type 'help' for commands.`;
        }
    }

    /**
     * Help text for console
     */
    helpText() {
        return `Elliott 4130 Debug Console Commands:
  state, s          - Show CPU state
  dump, d [addr] [n]- Dump memory (default: 0, 16)
  context, ctx      - Dump memory around PC
  trace, t [n]      - Show trace history (default: 20)
  watch, w [addr]   - Watch memory address
  unwatch [addr]    - Remove watch
  break, b [addr]   - Set/list breakpoints
  clear             - Clear breakpoints
  perf              - Performance report
  freq              - Instruction frequency
  diag              - Run diagnostics
  export            - Export debug state as JSON
  logs, l [n]       - Show logs (default: 20)
  set [key] [val]   - Get/set settings
  help              - This help text

Settings: traceEnabled, breakOnError, verboseDisasm,
          logMemWrites, logRegChanges, maxLogEntries`;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E4130Debug };
}
