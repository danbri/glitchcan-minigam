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
        this.inputHandler = options.inputHandler || null;  // For keyboard input
        this.reset();
    }

    // Constants
    MASK24 = 0xFFFFFF;   // 24-bit mask
    MASK17 = 0x1FFFF;    // 17-bit mask for S register
    MASK12 = 0xFFF;      // 12-bit mask for K register
    MASK6 = 0x3F;        // 6-bit mask for characters
    SIGN = 0x800000;     // Sign bit position

    // Condition flags - Per E6X3: c24-c20 are bits 23-19 (0-indexed)
    // Elliott numbering: bit 24 is MSB (0x800000), bit 1 is LSB (0x000001)
    F_NEG = 0x800000;  // c24 - Negative (result sign bit)
    F_ST  = 0x400000;  // c23 - Standardized (bits 22,23 equal or zero)
    F_NZ  = 0x200000;  // c22 - Non-zero
    F_CA  = 0x100000;  // c21 - Carry-out
    F_OF  = 0x080000;  // c20 - Arithmetic overflow

    // Interrupt levels
    INT_HESITATION = 0;  // Hardware hesitation (highest)
    INT_NORMAL = 1;      // Normal interrupt
    INT_ATTENTION = 2;   // Attention interrupt

    reset() {
        this.M = 0;      // Main accumulator
        this.R = 0;      // Reserve accumulator
        this.S = 0;      // Sequence control (PC), half-word addressed
        this.K = 0;      // Count register
        this.C = 0;      // Condition register
        this.Q = 0;      // Q register for character packing
        this.mem = new Int32Array(65536);
        this.halted = true;
        this.iCount = 0;
        this.breakpoints = new Set();

        // I/O system
        this.inputBuffer = [];      // Keyboard input queue
        this.waitingForInput = false;
        this.channels = new Array(14).fill(null).map((_, i) => new IOChannel(i));

        // Interrupt system
        this.interruptWord = 0;
        this.attentionWord = 0;
        this.interruptEnabled = true;
        this.pendingInterrupts = [];

        // Paper tape
        this.tapeReader = null;
        this.tapePunch = [];

        // Real-time clock
        this.rtcCounter = 0;
        this.rtcDelay = 0;
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
     * Sign-extend a 15-bit value to JavaScript signed integer
     */
    sx15(n) {
        return (n & 0x4000) ? (n | ~0x7FFF) : n;
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
            // Short instruction (12-bit) - each instruction occupies a full word
            const n = (w >> 12) & 0x3F;
            this.S = (this.S + 2) & this.MASK17;
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
            case 0o45: // J - Jump (n is word address, S is byte address)
                this.S = ((y === 0 ? n : op) * 2) & this.MASK17;
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
            case 0o53: // JFL - Jump and link (relative)
                this.wr(0, this.S);
                this.S = (y === 0 ? (this.S + this.sx15(n) * 2) : op * 2) & this.MASK17;
                break;
            case 0o54: // LDK
                this.K = op & this.MASK12;
                break;
            case 0o55: // COMP - Compare (set flags only)
                this.setC((this.sx(this.M) - this.sx(op)) & this.MASK24);
                break;
            case 0o56: // JF - Jump forward (relative)
                this.S = (this.S + (y === 0 ? this.sx15(n) * 2 : op * 2)) & this.MASK17;
                break;
            case 0o57: // JB - Jump backward (relative)
                this.S = (this.S - (y === 0 ? this.sx15(n) * 2 : op * 2)) & this.MASK17;
                break;
            case 0o60: // JN (y=0) or ST (y>0)
                if (y === 0) {
                    if (this.C & this.F_NEG) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, this.M);
                }
                break;
            case 0o61: // JNN (y=0) or STR (y>0)
                if (y === 0) {
                    if (!(this.C & this.F_NEG)) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, this.R);
                }
                break;
            case 0o62: // JZ (y=0) or NEGS (y>0)
                if (y === 0) {
                    if (!(this.C & this.F_NZ)) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, (-this.sx(op)) & this.MASK24);
                }
                break;
            case 0o63: // JNZ (y=0) or SUBS (y>0)
                if (y === 0) {
                    if (this.C & this.F_NZ) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, (this.sx(op) - this.sx(this.M)) & this.MASK24);
                }
                break;
            case 0o64: // JST (y=0) or ADDS (y>0)
                if (y === 0) {
                    if (this.C & this.F_ST) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, (this.sx(op) + this.sx(this.M)) & this.MASK24);
                }
                break;
            case 0o65: // JOF (y=0) or CLS (y>0)
                if (y === 0) {
                    if (this.C & this.F_OF) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
                } else {
                    this.wr(addr, 0);
                }
                break;
            case 0o66: // INCS - Increment store
                if (y !== 0) this.wr(addr, (op + 1) & this.MASK24);
                break;
            case 0o67: // DKJN (y=0) or DECS (y>0) - Decrement K, Jump if Negative
                if (y === 0) {
                    this.K = (this.K - 1) & this.MASK12;
                    // Per E6X3 manual: if k12 = 1 (negative) then jump
                    if (this.K & 0x800) this.S = (this.S + this.sx15(n) * 2) & this.MASK17;
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
        const channel = n & 0x0F;  // Channel number for I/O instructions

        switch (f) {
            case 0o50: // MULS - Single-length multiply
                this.M = (this.sx(this.M) * this.sx(op)) & this.MASK24;
                this.setC(this.M);
                break;

            case 0o51: // DIV - Single-length divide (unsigned for bit manipulation)
                if (op) {
                    const m = this.M & this.MASK24;
                    const d = op & this.MASK24;
                    this.R = (m % d) & this.MASK24;
                    this.M = Math.floor(m / d) & this.MASK24;
                }
                break;

            // Floating-point instructions (optional hardware FP unit)
            case 0o52: // FADD - Floating add
                this.fpAdd(op);
                break;
            case 0o53: // FSUB - Floating subtract
                this.fpSub(op);
                break;
            case 0o54: // FMUL - Floating multiply
                this.fpMul(op);
                break;
            case 0o55: // FDIV - Floating divide
                this.fpDiv(op);
                break;
            case 0o56: // FLD - Floating load
                this.fpLoad(op);
                break;
            case 0o57: // FST - Floating store
                this.fpStore(y, n);
                break;
            case 0o60: // FNEG - Floating negate (extracode)
                if (y === 0) {
                    // Could be JN conditional - check z flag was set
                    this.fpNeg();
                }
                break;
            case 0o61: // FABS - Floating absolute
                this.fpAbs();
                break;
            case 0o62: // FIX - Convert float to integer
                this.fpFix();
                break;
            case 0o63: // FLT - Convert integer to float
                this.fpFloat();
                break;
            case 0o64: // FCMP - Floating compare
                this.fpCmp(op);
                break;
            case 0o65: // FSQRT - Floating square root
                this.fpSqrt();
                break;

            // Character packing instructions
            case 0o70: // GET - Unpack character from Q
                if (y === 1 || y === 3) {
                    // Q' = Q rotated left 6 bits, M gets top 6 bits
                    const char = (this.Q >> 18) & this.MASK6;
                    this.Q = ((this.Q << 6) | char) & this.MASK24;
                    this.M = char;
                } else if (y === 0) {
                    // Special register operations
                    this.regOpExtra(n);
                }
                break;

            case 0o71: // PUT - Pack character into Q
                if (y === 1 || y === 3) {
                    // Q' = Q shifted left 6 bits, M low 6 bits inserted
                    const char = this.M & this.MASK6;
                    this.Q = ((this.Q << 6) | char) & this.MASK24;
                }
                break;

            // I/O Channel instructions
            case 0o74: // Data transfer
                this.ioDataTransfer(y, channel);
                break;

            case 0o75: // Status/Control
                this.ioStatusControl(y, channel);
                break;

            case 0o76: // Single word input
                if (y === 2) {
                    // IDUM - Input data unpacked single to M
                    this.M = this.channelRead(channel) & this.MASK24;
                } else if (y === 3) {
                    // ODUM - Output data unpacked single from M
                    this.channelWrite(channel, this.M);
                }
                break;

            case 0o77: // Output / Single word status
                if (y === 0) {
                    // TR - Display letter (n = letter number, 1-based)
                    if (n >= 1 && n <= 26) {
                        this.output(String.fromCharCode(64 + n));
                    } else {
                        this.output(String.fromCharCode(65 + (n % 26)));
                    }
                } else if (y === 1) {
                    // CH - Display M in octal
                    this.output(this.M.toString(8).padStart(8, '0') + ' ');
                } else if (y === 2) {
                    // ISUM - Input status single to M
                    this.M = this.channels[channel]?.status || 0;
                } else if (y === 3) {
                    // OCUM - Output control single from M
                    if (this.channels[channel]) {
                        this.channels[channel].control = this.M;
                    }
                }
                break;
        }
    }

    /**
     * Special register operations (extracode F=70, y=0)
     */
    regOpExtra(n) {
        switch (n) {
            case 0o21000: // ITOM - Interrupt word to M
                this.M = this.interruptWord;
                break;
            case 0o41000: // ATOM - Attention word to M
                this.M = this.attentionWord;
                break;
        }
    }

    /**
     * I/O data transfer operations
     */
    ioDataTransfer(y, channel) {
        switch (y) {
            case 0: // IDPR - Input data packed repetitive
                // Read packed data from channel into memory
                this.channelPackedRead(channel);
                break;
            case 1: // ODPR - Output data packed repetitive
                // Write packed data to channel from memory
                this.channelPackedWrite(channel);
                break;
            case 2: // IDUR - Input data unpacked repetitive
                // Read unpacked data from channel
                this.M = this.channelRead(channel) & this.MASK24;
                break;
            case 3: // ODUR - Output data unpacked repetitive
                // Write unpacked data to channel
                this.channelWrite(channel, this.M);
                break;
        }
    }

    /**
     * I/O status/control operations
     */
    ioStatusControl(y, channel) {
        const ch = this.channels[channel];
        if (!ch) return;

        switch (y) {
            case 0: // ISPR - Input status packed
                this.M = ch.status;
                break;
            case 1: // OCPR - Output control packed
                ch.control = this.M;
                break;
            case 2: // ISUR - Input status unpacked
                this.M = ch.status;
                break;
            case 3: // OCUR - Output control unpacked
                ch.control = this.M;
                break;
        }
    }

    /**
     * Read from I/O channel
     */
    channelRead(channel) {
        const ch = this.channels[channel];
        if (!ch) return 0;

        // Channel 0 is typically console/keyboard
        if (channel === 0) {
            if (this.inputBuffer.length > 0) {
                return this.inputBuffer.shift();
            }
            // Signal waiting for input
            this.waitingForInput = true;
            return 0;
        }

        return ch.read();
    }

    /**
     * Write to I/O channel
     */
    channelWrite(channel, data) {
        const ch = this.channels[channel];
        if (!ch) return;

        // Channel 0 is typically console output
        if (channel === 0) {
            // Convert to character and output
            const char = data & this.MASK6;
            this.output(this.sixBitToAscii(char));
            return;
        }

        ch.write(data);
    }

    /**
     * Packed read from channel (4 chars per word)
     */
    channelPackedRead(channel) {
        // Read 4 characters and pack into Q
        let word = 0;
        for (let i = 0; i < 4; i++) {
            const char = this.channelRead(channel) & this.MASK6;
            word = (word << 6) | char;
        }
        this.Q = word;
    }

    /**
     * Packed write to channel (4 chars per word)
     */
    channelPackedWrite(channel) {
        // Unpack Q and write 4 characters
        for (let i = 3; i >= 0; i--) {
            const char = (this.Q >> (i * 6)) & this.MASK6;
            this.channelWrite(channel, char);
        }
    }

    /**
     * Convert 6-bit Elliott character to ASCII
     */
    sixBitToAscii(c) {
        if (c === 0) return ' ';
        if (c >= 1 && c <= 26) return String.fromCharCode(64 + c);  // A-Z
        if (c >= 27 && c <= 36) return String.fromCharCode(21 + c); // 0-9 (27->48)
        // Special characters
        const special = ' !"#$%&\'()*+,-./:;<=>?@';
        if (c >= 37 && c < 37 + special.length) return special[c - 37];
        return '?';
    }

    /**
     * Convert ASCII to 6-bit Elliott character
     */
    asciiToSixBit(c) {
        const code = c.charCodeAt(0);
        if (code === 32) return 0;  // Space
        if (code >= 65 && code <= 90) return code - 64;   // A-Z
        if (code >= 97 && code <= 122) return code - 96;  // a-z -> A-Z
        if (code >= 48 && code <= 57) return code - 21;   // 0-9
        return 0;
    }

    /**
     * Queue keyboard input
     */
    keyboardInput(char) {
        this.inputBuffer.push(this.asciiToSixBit(char));
        this.waitingForInput = false;
    }

    /**
     * Queue string input
     */
    stringInput(str) {
        for (const char of str) {
            this.keyboardInput(char);
        }
    }

    /**
     * Load paper tape data
     */
    loadTape(data) {
        this.tapeReader = {
            data: data instanceof Uint8Array ? data : new Uint8Array(data),
            position: 0
        };
        // Connect tape reader to channel 1
        this.channels[1].device = this.tapeReader;
    }

    /**
     * Read from paper tape
     */
    tapeRead() {
        if (!this.tapeReader || this.tapeReader.position >= this.tapeReader.data.length) {
            return -1;  // End of tape
        }
        return this.tapeReader.data[this.tapeReader.position++];
    }

    /**
     * Punch to paper tape
     */
    tapePunchByte(byte) {
        this.tapePunch.push(byte & 0xFF);
    }

    /**
     * Get punched tape data
     */
    getTapePunch() {
        return new Uint8Array(this.tapePunch);
    }

    /**
     * Raise interrupt
     */
    raiseInterrupt(level, vector) {
        this.pendingInterrupts.push({ level, vector });
        if (level === this.INT_NORMAL) {
            this.interruptWord |= (1 << vector);
        } else if (level === this.INT_ATTENTION) {
            this.attentionWord |= (1 << vector);
        }
    }

    /**
     * Check and handle pending interrupts
     */
    checkInterrupts() {
        if (!this.interruptEnabled || this.pendingInterrupts.length === 0) {
            return false;
        }

        // Sort by priority (lower level = higher priority)
        this.pendingInterrupts.sort((a, b) => a.level - b.level);
        const int = this.pendingInterrupts.shift();

        // Save return address at location 0
        this.wr(0, this.S);

        // Jump to interrupt vector
        this.S = int.vector * 2;

        return true;
    }

    /**
     * Start real-time clock
     */
    startRTC(intervalMs = 1000) {
        if (this.rtcInterval) clearInterval(this.rtcInterval);
        this.rtcInterval = setInterval(() => {
            this.rtcCounter++;
            if (this.rtcDelay > 0 && this.rtcCounter >= this.rtcDelay) {
                this.raiseInterrupt(this.INT_NORMAL, 0);  // RTC interrupt vector 0
                this.rtcCounter = 0;
            }
        }, intervalMs);
    }

    /**
     * Stop real-time clock
     */
    stopRTC() {
        if (this.rtcInterval) {
            clearInterval(this.rtcInterval);
            this.rtcInterval = null;
        }
    }

    // ========================================================================
    // Floating-Point Unit
    // Elliott 4130 used 24-bit floating point:
    //   Bit 23: Sign (0=positive, 1=negative)
    //   Bits 17-22: Exponent (6 bits, excess-32 bias)
    //   Bits 0-16: Mantissa (17 bits, normalized with implicit 1)
    // ========================================================================

    /**
     * Convert 24-bit Elliott float to JavaScript number
     */
    fpToFloat(word) {
        if (word === 0) return 0;

        const sign = (word >> 23) & 1;
        const exp = ((word >> 17) & 0x3F) - 32;  // Excess-32 bias
        const mant = (word & 0x1FFFF) | 0x20000; // Add implicit bit

        let value = mant / 0x20000;  // Normalize to 1.xxx
        value *= Math.pow(2, exp);

        return sign ? -value : value;
    }

    /**
     * Convert JavaScript number to 24-bit Elliott float
     */
    floatToFp(value) {
        if (value === 0) return 0;

        const sign = value < 0 ? 1 : 0;
        value = Math.abs(value);

        // Find exponent
        let exp = 0;
        while (value >= 2) {
            value /= 2;
            exp++;
        }
        while (value < 1 && exp > -32) {
            value *= 2;
            exp--;
        }

        // Convert mantissa (remove implicit 1)
        const mant = Math.floor((value - 1) * 0x20000) & 0x1FFFF;

        // Pack into 24-bit word
        return (sign << 23) | ((exp + 32) << 17) | mant;
    }

    /**
     * Floating-point add: M := M + [op]
     */
    fpAdd(op) {
        const a = this.fpToFloat(this.M);
        const b = this.fpToFloat(op);
        this.M = this.floatToFp(a + b);
        this.setC(this.M);
    }

    /**
     * Floating-point subtract: M := M - [op]
     */
    fpSub(op) {
        const a = this.fpToFloat(this.M);
        const b = this.fpToFloat(op);
        this.M = this.floatToFp(a - b);
        this.setC(this.M);
    }

    /**
     * Floating-point multiply: M := M * [op]
     */
    fpMul(op) {
        const a = this.fpToFloat(this.M);
        const b = this.fpToFloat(op);
        this.M = this.floatToFp(a * b);
        this.setC(this.M);
    }

    /**
     * Floating-point divide: M := M / [op]
     */
    fpDiv(op) {
        const a = this.fpToFloat(this.M);
        const b = this.fpToFloat(op);
        if (b !== 0) {
            this.M = this.floatToFp(a / b);
        } else {
            // Overflow - set flags
            this.C |= this.F_OF;
        }
        this.setC(this.M);
    }

    /**
     * Floating-point load: M := [op] as float
     */
    fpLoad(op) {
        this.M = op & this.MASK24;
        this.setC(this.M);
    }

    /**
     * Floating-point store: [addr] := M
     */
    fpStore(y, n) {
        const addr = this.getAddr(y, n);
        this.wr(addr, this.M);
    }

    /**
     * Floating-point negate: M := -M
     */
    fpNeg() {
        this.M ^= 0x800000;  // Flip sign bit
        this.setC(this.M);
    }

    /**
     * Floating-point absolute: M := |M|
     */
    fpAbs() {
        this.M &= 0x7FFFFF;  // Clear sign bit
        this.setC(this.M);
    }

    /**
     * Convert float to integer: M := int(M)
     */
    fpFix() {
        const value = this.fpToFloat(this.M);
        this.M = Math.floor(value) & this.MASK24;
        this.setC(this.M);
    }

    /**
     * Convert integer to float: M := float(M)
     */
    fpFloat() {
        const value = this.sx(this.M);
        this.M = this.floatToFp(value);
        this.setC(this.M);
    }

    /**
     * Floating-point compare: set flags based on M - [op]
     */
    fpCmp(op) {
        const a = this.fpToFloat(this.M);
        const b = this.fpToFloat(op);
        const diff = a - b;

        this.C = 0;
        if (diff < 0) this.C |= this.F_NEG;
        if (diff !== 0) this.C |= this.F_NZ;
        if (diff === 0 || (diff > -1 && diff < 1)) this.C |= this.F_ST;
    }

    /**
     * Floating-point square root: M := sqrt(M)
     */
    fpSqrt() {
        const value = this.fpToFloat(this.M);
        if (value >= 0) {
            this.M = this.floatToFp(Math.sqrt(value));
        } else {
            // Negative - set error flag
            this.C |= this.F_OF;
        }
        this.setC(this.M);
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

/**
 * I/O Channel class for Elliott 4130
 * Represents a single I/O channel with buffer and device attachment
 */
class IOChannel {
    constructor(id) {
        this.id = id;
        this.status = 0;      // Status word
        this.control = 0;     // Control word
        this.buffer = [];     // Data buffer
        this.device = null;   // Attached device (tape, etc.)

        // Status bits
        this.READY = 0x001;
        this.BUSY = 0x002;
        this.ERROR = 0x004;
        this.EOF = 0x008;
    }

    /**
     * Read from channel
     */
    read() {
        if (this.device && typeof this.device.read === 'function') {
            return this.device.read();
        }
        if (this.buffer.length > 0) {
            return this.buffer.shift();
        }
        return 0;
    }

    /**
     * Write to channel
     */
    write(data) {
        if (this.device && typeof this.device.write === 'function') {
            this.device.write(data);
        } else {
            this.buffer.push(data);
        }
    }

    /**
     * Check if data is available
     */
    hasData() {
        if (this.device && typeof this.device.hasData === 'function') {
            return this.device.hasData();
        }
        return this.buffer.length > 0;
    }

    /**
     * Reset channel
     */
    reset() {
        this.status = 0;
        this.control = 0;
        this.buffer = [];
    }
}

/**
 * Paper Tape Reader device
 */
class TapeReader {
    constructor(data) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data || []);
        this.position = 0;
    }

    read() {
        if (this.position >= this.data.length) {
            return -1;  // EOF
        }
        return this.data[this.position++];
    }

    hasData() {
        return this.position < this.data.length;
    }

    rewind() {
        this.position = 0;
    }
}

/**
 * Paper Tape Punch device
 */
class TapePunch {
    constructor() {
        this.buffer = [];
    }

    write(data) {
        this.buffer.push(data & 0xFF);
    }

    getData() {
        return new Uint8Array(this.buffer);
    }

    clear() {
        this.buffer = [];
    }
}

/**
 * Teleprinter device
 */
class Teleprinter {
    constructor(outputCallback) {
        this.outputCallback = outputCallback;
        this.column = 0;
        this.lineWidth = 72;
    }

    write(data) {
        const char = String.fromCharCode(data);
        if (this.outputCallback) {
            this.outputCallback(char);
        }
        if (char === '\n' || char === '\r') {
            this.column = 0;
        } else {
            this.column++;
            if (this.column >= this.lineWidth) {
                if (this.outputCallback) {
                    this.outputCallback('\n');
                }
                this.column = 0;
            }
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E4130, IOChannel, TapeReader, TapePunch, Teleprinter };
}
