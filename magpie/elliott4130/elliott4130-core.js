/**
 * Elliott 4130 Emulator Core
 * Based on E6X2/E6X3 specifications from Computer Conservation Society
 *
 * Architecture:
 * - 24-bit word, two's complement
 * - Registers: M (accumulator), R (reserve), S (PC half-word), K (count), C (conditions)
 * - 65536 word memory
 */

class E4130 {
    constructor(options = {}) {
        this.outputHandler = options.outputHandler || null;
        this.traceHandler = options.traceHandler || null;
        this.reset();
    }

    // Constants
    MASK24 = 0xFFFFFF;   // 24-bit mask
    MASK17 = 0x1FFFF;    // 17-bit mask for S register
    MASK12 = 0xFFF;      // 12-bit mask for K register
    SIGN = 0x800000;     // Sign bit position

    // Condition flags
    F_NEG = 32;  // Negative
    F_ST = 16;   // Standard (sign bits equal or zero)
    F_NZ = 8;    // Non-zero
    F_CA = 4;    // Carry
    F_OF = 2;    // Overflow

    reset() {
        this.M = 0;      // Main accumulator
        this.R = 0;      // Reserve accumulator
        this.S = 0;      // Sequence control (PC), half-word addressed
        this.K = 0;      // Count register
        this.C = 0;      // Condition register
        this.mem = new Int32Array(65536);
        this.halted = true;
        this.iCount = 0;
        this.breakpoints = new Set();
    }

    /**
     * Sign extend a 24-bit value to JavaScript signed integer
     */
    sx(v) {
        return (v & this.SIGN) ? (v | ~this.MASK24) : v;
    }

    /**
     * Set condition flags based on result
     */
    setC(r) {
        const v = r & this.MASK24;
        this.C = 0;

        // Negative flag - set if sign bit is 1
        if (v & this.SIGN) this.C |= this.F_NEG;

        // Non-zero flag - set if value is non-zero
        if (v) this.C |= this.F_NZ;

        // Standard flag - set if bits 22 and 23 are equal, or value is zero
        const b22 = (v >> 22) & 1;
        const b23 = (v >> 23) & 1;
        if (b22 === b23 || !v) this.C |= this.F_ST;

        // Overflow flag - set if result exceeded 24-bit signed range
        if (r > 0x7FFFFF || r < -0x800000) this.C |= this.F_OF;
    }

    /**
     * Read memory at address
     */
    rd(a) {
        return this.mem[a & 0xFFFF] & this.MASK24;
    }

    /**
     * Write memory at address
     */
    wr(a, v) {
        this.mem[a & 0xFFFF] = v & this.MASK24;
    }

    /**
     * Get operand based on Y field (addressing mode)
     * Y=0: Literal (N itself)
     * Y=1: Direct (contents of address N)
     * Y=2: Modified (contents of address N+R)
     * Y=3: Indirect (contents of address pointed to by N)
     */
    getOp(y, n) {
        switch (y) {
            case 0: return n;
            case 1: return this.rd(n);
            case 2: return this.rd((n + this.R) & 0x7FFF);
            case 3: return this.rd(this.rd(n) & 0x7FFF);
        }
        return n;
    }

    /**
     * Get effective address based on Y field
     */
    getAddr(y, n) {
        switch (y) {
            case 0: return n;
            case 1: return n;
            case 2: return (n + this.R) & 0x7FFF;
            case 3: return this.rd(n) & 0x7FFF;
        }
        return n;
    }

    /**
     * Execute one instruction
     * Returns true if execution should continue
     */
    step() {
        if (this.halted) return false;

        const wa = this.S >> 1;  // Word address
        const w = this.rd(wa);   // Fetch instruction
        const f = (w >> 18) & 0x3F;  // Function code

        // Trace if handler registered
        if (this.traceHandler) {
            this.traceHandler({
                addr: wa,
                word: w,
                M: this.M,
                R: this.R,
                S: this.S,
                K: this.K,
                C: this.C
            });
        }

        if (f >= 0o40) {
            // Long instruction (24-bit)
            const y = (w >> 16) & 3;   // Addressing mode
            const z = (w >> 15) & 1;   // Extra-code flag
            const n = w & 0x7FFF;      // Address/operand
            this.S = (this.S + 2) & this.MASK17;

            if (z) {
                this.extracode(f, y, n);
            } else {
                this.execLong(f, y, n);
            }
        } else {
            // Short instruction (12-bit)
            const n = (w >> 12) & 0x3F;
            this.S = (this.S + 1) & this.MASK17;
            this.execShort(f, n);
        }

        this.iCount++;

        // Check breakpoints
        if (this.breakpoints.has(this.S >> 1)) {
            this.halted = true;
            return false;
        }

        return true;
    }

    /**
     * Execute short-form instruction
     */
    execShort(f, n) {
        const op = this.rd(n);

        switch (f) {
            case 0o00: // ADD - M := M + [n]
                this.M = (this.sx(this.M) + this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o01: // SUB - M := M - [n]
                this.M = (this.sx(this.M) - this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o02: // NADD - M := [n] - M
                this.M = (this.sx(op) - this.sx(this.M)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o03: // LD - M := [n]
                this.M = op;
                this.setC(this.M);
                break;
            case 0o04: // LDR - R := [n]
                this.R = op;
                break;
            case 0o05: // JIR - Jump indirect via register
                this.S = n & this.MASK17;
                break;
            case 0o06: // AND - M := M & [n]
                this.M &= op;
                this.setC(this.M);
                break;
            case 0o07: // ANDN - M := M & ~[n]
                this.M &= ~op & this.MASK24;
                this.setC(this.M);
                break;
            case 0o10: // ADDR - R := R + [n]
                this.R = (this.sx(this.R) + this.sx(op)) & this.MASK24;
                break;
            case 0o11: // SUBR - R := R - [n]
                this.R = (this.sx(this.R) - this.sx(op)) & this.MASK24;
                break;
            case 0o12: // NADR - R := [n] - R
                this.R = (this.sx(op) - this.sx(this.R)) & this.MASK24;
                break;
            case 0o14: // LDK - K := [n]
                this.K = op & this.MASK12;
                break;
            case 0o15: // Shift operations
                this.shift(n);
                break;
            case 0o30: // ST - [n] := M
                this.wr(n, this.M);
                break;
            case 0o31: // STR - [n] := R
                this.wr(n, this.R);
                break;
        }
    }

    /**
     * Execute long-form instruction
     */
    execLong(f, y, n) {
        const op = this.getOp(y, n);
        const addr = this.getAddr(y, n);

        switch (f) {
            case 0o40: // ADD
                this.M = (this.sx(this.M) + this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o41: // SUB
                this.M = (this.sx(this.M) - this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o42: // NADD
                this.M = (this.sx(op) - this.sx(this.M)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o43: // LD
                this.M = op;
                this.setC(this.M);
                break;
            case 0o44: // LDR
                this.R = op;
                break;
            case 0o45: // J - Jump
                this.S = (y === 0 ? n : op) & this.MASK17;
                break;
            case 0o46: // AND
                this.M &= op;
                this.setC(this.M);
                break;
            case 0o47: // ANDN
                this.M &= ~op & this.MASK24;
                this.setC(this.M);
                break;
            case 0o50: // ADDR
                this.R = (this.sx(this.R) + this.sx(op)) & this.MASK24;
                break;
            case 0o51: // SUBR
                this.R = (this.sx(this.R) - this.sx(op)) & this.MASK24;
                break;
            case 0o52: // NADR
                this.R = (this.sx(op) - this.sx(this.R)) & this.MASK24;
                break;
            case 0o53: // JFL - Jump and link
                this.wr(0, this.S);
                this.S = (y === 0 ? (this.S + n) : op) & this.MASK17;
                break;
            case 0o54: // LDK
                this.K = op & this.MASK12;
                break;
            case 0o55: // COMP - Compare (set flags only)
                this.setC((this.sx(this.M) - this.sx(op)) & this.MASK24);
                break;
            case 0o56: // JF - Jump forward
                this.S = (this.S + (y === 0 ? n : op)) & this.MASK17;
                break;
            case 0o57: // JB - Jump backward
                this.S = (this.S - (y === 0 ? n : op)) & this.MASK17;
                break;
            case 0o60: // JN (y=0) or ST (y>0)
                if (y === 0) {
                    if (this.C & this.F_NEG) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, this.M);
                }
                break;
            case 0o61: // JNN (y=0) or STR (y>0)
                if (y === 0) {
                    if (!(this.C & this.F_NEG)) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, this.R);
                }
                break;
            case 0o62: // JZ (y=0) or NEGS (y>0)
                if (y === 0) {
                    if (!(this.C & this.F_NZ)) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, (-this.sx(op)) & this.MASK24);
                }
                break;
            case 0o63: // JNZ (y=0) or SUBS (y>0)
                if (y === 0) {
                    if (this.C & this.F_NZ) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, (this.sx(op) - this.sx(this.M)) & this.MASK24);
                }
                break;
            case 0o64: // JST (y=0) or ADDS (y>0)
                if (y === 0) {
                    if (this.C & this.F_ST) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, (this.sx(op) + this.sx(this.M)) & this.MASK24);
                }
                break;
            case 0o65: // JOF (y=0) or CLS (y>0)
                if (y === 0) {
                    if (this.C & this.F_OF) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, 0);
                }
                break;
            case 0o66: // INCS - Increment store
                if (y !== 0) this.wr(addr, (op + 1) & this.MASK24);
                break;
            case 0o67: // DKJN (y=0) or DECS (y>0)
                if (y === 0) {
                    this.K = (this.K - 1) & this.MASK12;
                    if (this.K & 0x800) this.S = (this.S + n) & this.MASK17;
                } else {
                    this.wr(addr, (op - 1) & this.MASK24);
                }
                break;
            case 0o70: // Register operations
                if (y === 0) this.regOp(n);
                break;
            case 0o72: // DIVM - Double-length divide
                if (y !== 0 && op) {
                    const dv = (this.R << 24) | this.M;
                    this.M = Math.floor(dv / this.sx(op)) & this.MASK24;
                }
                break;
            case 0o73: // MULM - Double-length multiply
                if (y !== 0) {
                    const p = BigInt(this.sx(this.M)) * BigInt(this.sx(op));
                    this.M = Number(p & 0xFFFFFFn);
                    this.R = Number((p >> 24n) & 0xFFFFFFn);
                }
                break;
            case 0o74: // MVE - Move entry
                if (y !== 0) {
                    this.M = op;
                    this.wr(this.R, this.M);
                    this.R = (this.R - 1) & this.MASK24;
                }
                break;
            case 0o75: // MVB - Move backward
                if (y !== 0) {
                    this.wr(addr, this.M);
                    this.M = this.rd(this.R);
                    this.R = (this.R + 1) & this.MASK24;
                }
                break;
            case 0o76: // EXC - Exchange M with memory
                if (y !== 0) {
                    const t = this.M;
                    this.M = op;
                    this.wr(addr, t);
                }
                break;
            case 0o77: // EXCR - Exchange R with memory
                if (y !== 0) {
                    const t = this.R;
                    this.R = op;
                    this.wr(addr, t);
                }
                break;
        }
    }

    /**
     * Execute shift operation
     */
    shift(n) {
        const k = this.K & 0x3F;  // Shift count from K register

        switch (n) {
            case 0o00: // SRL - Shift R left
                this.R = (this.R << k) & this.MASK24;
                break;
            case 0o02: // SRR - Shift R right arithmetic
                this.R = this.sx(this.R) >> k;
                this.R &= this.MASK24;
                break;
            case 0o04: // SML - Shift M left
                this.M = (this.M << k) & this.MASK24;
                break;
            case 0o06: // SMR - Shift M right arithmetic
                this.M = this.sx(this.M) >> k;
                this.M &= this.MASK24;
                break;
            case 0o12: // SRRL - Shift R right logical
                this.R = (this.R >>> k) & this.MASK24;
                break;
            case 0o16: // SMRL - Shift M right logical
                this.M = (this.M >>> k) & this.MASK24;
                break;
        }
        this.setC(this.M);
    }

    /**
     * Execute register-to-register operation
     */
    regOp(n) {
        switch (n) {
            case 0o00020: // KTOR - K to R
                this.R = this.K;
                break;
            case 0o00402: // MTOR - M to R
                this.R = this.M;
                break;
            case 0o00404: // STOR - S to R
                this.R = this.S;
                break;
            case 0o01001: // RTOM - R to M
                this.M = this.R;
                this.setC(this.M);
                break;
            case 0o01003: // MORR - M or R
                this.M |= this.R;
                this.setC(this.M);
                break;
            case 0o01010: // CTOM - C to M
                this.M = this.C;
                break;
            case 0o02001: // RTOS - R to S
                this.S = this.R & this.MASK17;
                break;
            case 0o02002: // MTOS - M to S
                this.S = this.M & this.MASK17;
                break;
            case 0o04002: // MTOC - M to C
                this.C = this.M & 0x3FFF;
                break;
            case 0o10001: // RTOK - R to K
                this.K = this.R & this.MASK12;
                break;
            case 0o10002: // MTOK - M to K
                this.K = this.M & this.MASK12;
                break;
        }
    }

    /**
     * Execute extra-code (Z=1) instruction
     */
    extracode(f, y, n) {
        const op = this.getOp(y, n);

        switch (f) {
            case 0o50: // MULS - Single-length multiply
                this.M = (this.sx(this.M) * this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;
            case 0o51: // DIV - Single-length divide
                if (op) {
                    const m = this.sx(this.M);
                    const d = this.sx(op);
                    this.M = Math.floor(m / d) & this.MASK24;
                    this.R = (m % d) & this.MASK24;
                }
                break;
            case 0o77: // Output
                if (y === 0) {
                    this.output(String.fromCharCode(65 + (n % 26)));
                } else {
                    this.output(this.M.toString(8).padStart(8, '0') + ' ');
                }
                break;
        }
    }

    /**
     * Output character/string
     */
    output(t) {
        if (this.outputHandler) {
            this.outputHandler(t);
        }
    }

    /**
     * Add breakpoint at address
     */
    addBreakpoint(addr) {
        this.breakpoints.add(addr);
    }

    /**
     * Remove breakpoint at address
     */
    removeBreakpoint(addr) {
        this.breakpoints.delete(addr);
    }

    /**
     * Clear all breakpoints
     */
    clearBreakpoints() {
        this.breakpoints.clear();
    }

    /**
     * Get snapshot of CPU state
     */
    getState() {
        return {
            M: this.M,
            R: this.R,
            S: this.S,
            K: this.K,
            C: this.C,
            halted: this.halted,
            iCount: this.iCount
        };
    }

    /**
     * Restore CPU state from snapshot
     */
    setState(state) {
        this.M = state.M;
        this.R = state.R;
        this.S = state.S;
        this.K = state.K;
        this.C = state.C;
        this.halted = state.halted;
        this.iCount = state.iCount;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E4130 };
}
