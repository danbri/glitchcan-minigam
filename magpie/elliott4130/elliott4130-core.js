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

    // Interrupt levels - Per E6X4: Hesitation (highest) > Attention (middle) > Normal (lowest)
    INT_HESITATION = 0;  // Hardware hesitation (highest priority)
    INT_ATTENTION = 1;   // Attention interrupt (middle priority)
    INT_NORMAL = 2;      // Normal interrupt (lowest priority)

    // Protected Mode constants - Per E6X4
    MODE_EXECUTIVE = 0;  // Executive Mode - full memory access
    MODE_PROTECTED = 1;  // Protected Mode - restricted to Base+Range

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

        // Protected Mode registers - Per E6X4
        // Base and Range are 10-bit registers giving permitted memory region
        this.baseReg = 0;        // Base address (10-bit, addresses 1024-word blocks)
        this.rangeReg = 0;       // Range (10-bit, number of 1024-word blocks permitted)
        this.executiveMode = true;  // Start in Executive Mode (full access)

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

        // Hardware FP mode - 4130 has hardware FP, 4120 would trap to software
        this.hardwareFPEnabled = true;

        // Two-word FP accumulator - Per E6X3: 48-bit mantissa, 12-bit exponent internal
        // Stored as JavaScript number for simplicity (has 53-bit mantissa, sufficient)
        // When stored to memory, rounded to 39-bit mantissa, 9-bit exponent
        this.fpAccum = 0;
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
     * Check if address is within Protected Mode bounds
     * Per E6X4: Base and Range are 10-bit, addressing 1024-word blocks
     * Permitted region: [baseReg * 1024, (baseReg + rangeReg) * 1024)
     */
    checkProtection(a) {
        if (this.executiveMode) return true;  // Executive Mode has full access

        const addr = a & 0xFFFF;
        const baseAddr = this.baseReg * 1024;
        const limitAddr = (this.baseReg + this.rangeReg) * 1024;

        if (addr >= baseAddr && addr < limitAddr) {
            return true;
        }

        // Protection violation - raise interrupt and return false
        this.raiseInterrupt(this.INT_ATTENTION, 1);  // Memory protection violation
        return false;
    }

    /**
     * Read memory at address
     */
    rd(a) {
        if (!this.checkProtection(a)) {
            return 0;  // Protection violation returns 0
        }
        return this.mem[a & 0xFFFF] & this.MASK24;
    }

    /**
     * Write memory at address
     */
    wr(a, v) {
        if (!this.checkProtection(a)) {
            return;  // Protection violation - write ignored
        }
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
     *
     * The Elliott 4130 packs TWO 12-bit short instructions in one 24-bit word.
     * The S register is a half-word address. S bit 0 indicates which half:
     *   S bit 0 = 0: Upper half (bits 23-12)
     *   S bit 0 = 1: Lower half (bits 11-0)
     */
    step() {
        if (this.halted) return false;

        const wa = this.S >> 1;        // Word address
        const halfWord = this.S & 1;   // 0=upper, 1=lower
        const w = this.rd(wa);         // Fetch instruction word

        // Extract function code and operand based on which half-word
        let f, n;
        if (halfWord === 0) {
            // Upper half: bits 23-12
            f = (w >> 18) & 0x3F;
            n = (w >> 12) & 0x3F;
        } else {
            // Lower half: bits 11-0
            f = (w >> 6) & 0x3F;
            n = w & 0x3F;
        }

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
            // Long instruction (24-bit) - must be at upper half (halfWord==0)
            // Uses full 24-bit word
            const y = (w >> 16) & 3;   // Addressing mode
            const z = (w >> 15) & 1;   // Extra-code flag
            const addr = w & 0x7FFF;   // Address/operand
            this.S = (this.S + 2) & this.MASK17;  // Advance by full word

            if (z) {
                this.extracode(f, y, addr);
            } else {
                this.execLong(f, y, addr);
            }
        } else {
            // Short instruction (12-bit) - advance by half-word only
            this.S = (this.S + 1) & this.MASK17;
            this.execShort(f, n);
        }

        this.iCount++;

        // Process any pending interrupts
        this.checkInterrupts();

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
            case 0o05: { // JIR - Jump indirect return (return from subroutine)
                // Per E6X3: link word = c24-18 + S, restore both C bits and S from link
                const link = this.rd(n);
                this.C = (this.C & 0x1FFFF) | (link & 0xFE0000);  // Restore c24-18
                this.S = link & this.MASK17;
                break;
            }
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
            case 0o53: { // JFL - Jump and link (relative)
                // Per E6X3: link word = c24-18 + S (upper 7 bits of C concatenated with 17-bit S)
                const link = ((this.C >> 17) & 0x7F) << 17 | (this.S & this.MASK17);
                this.wr(0, link);
                this.S = (y === 0 ? (this.S + this.sx15(n) * 2) : op * 2) & this.MASK17;
                break;
            }
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
            case 0o72: // DIVM - Double-length divide: m' = (r,m)/Q; r' = remainder
                if (y !== 0 && op) {
                    // Per E6X3: Treat (R,M) as 48-bit dividend, op as 24-bit divisor
                    // Use BigInt for 48-bit precision
                    const dividend = (BigInt(this.R) << 24n) | BigInt(this.M);
                    const divisor = BigInt(this.sx(op));
                    if (divisor !== 0n) {
                        const quotient = dividend / divisor;
                        const remainder = dividend % divisor;
                        this.M = Number(quotient & 0xFFFFFFn);
                        this.R = Number(remainder & 0xFFFFFFn);  // Per E6X3: r' = remainder
                    }
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
            case 0o76: // EXC (y>0) or IDUM/ODUM (y=0) - I/O data single
                if (y === 0) {
                    // Per E6X3: F=76, Y=0, N encodes operation and channel
                    // N = 0o2xxnn = IDUM (input data unpacked single to M)
                    // N = 0o3xxnn = ODUM (output data unpacked single from M)
                    // N is 15-bit: bits 14-12 = operation type, bits 5-0 = channel
                    const opType = (n >> 12) & 0o7;  // Operation type from bits 14-12
                    const channel = n & 0o77;        // Channel number from bits 5-0
                    if (opType === 0o2) {
                        // IDUM - Input data unpacked single to M
                        this.M = this.channelRead(channel) & this.MASK24;
                    } else if (opType === 0o3) {
                        // ODUM - Output data unpacked single from M
                        this.channelWrite(channel, this.M);
                    }
                } else {
                    // EXC - Exchange M with memory
                    const t = this.M;
                    this.M = op;
                    this.wr(addr, t);
                }
                break;
            case 0o77: // EXCR (y>0) or ISUM/OCUM (y=0) - I/O status/control single
                if (y === 0) {
                    // Per E6X3: F=77, Y=0, N encodes operation and channel
                    // N = 0o2xxnn = ISUM (input status unpacked single to M)
                    // N = 0o3xxnn = OCUM (output control unpacked single from M)
                    // N is 15-bit: bits 14-12 = operation type, bits 5-0 = channel
                    const opType = (n >> 12) & 0o7;  // Operation type from bits 14-12
                    const channel = n & 0o77;        // Channel number from bits 5-0
                    const ch = this.channels[channel];
                    if (ch) {
                        if (opType === 0o2) {
                            // ISUM - Input status to M
                            this.M = ch.status & this.MASK24;
                        } else if (opType === 0o3) {
                            // OCUM - Output control from M
                            ch.control = this.M;
                        }
                    }
                } else {
                    // EXCR - Exchange R with memory
                    const t = this.R;
                    this.R = op;
                    this.wr(addr, t);
                }
                break;
        }
    }

    /**
     * Execute shift operation
     * Per E6X3 manual: Full complement of 16 shift instructions
     */
    shift(n) {
        const k = this.K & 0x3F;  // Shift count from K register

        switch (n) {
            case 0o00: // SRL - Shift R left
                this.R = (this.R << k) & this.MASK24;
                break;
            case 0o01: // SRLA - Shift R left circularly
                if (k > 0) {
                    const kmod = k % 24;
                    this.R = ((this.R << kmod) | (this.R >>> (24 - kmod))) & this.MASK24;
                }
                break;
            case 0o02: // SRR - Shift R right arithmetic
                this.R = this.sx(this.R) >> k;
                this.R &= this.MASK24;
                break;
            case 0o03: // SRLC - Shift R by k characters left (k*6 bits)
                if (k > 0) {
                    const bits = (k * 6) % 24;
                    this.R = ((this.R << bits) | (this.R >>> (24 - bits))) & this.MASK24;
                }
                break;
            case 0o04: // SML - Shift M left
                this.M = (this.M << k) & this.MASK24;
                break;
            case 0o05: // SMLA - Shift M left circularly
                if (k > 0) {
                    const kmod = k % 24;
                    this.M = ((this.M << kmod) | (this.M >>> (24 - kmod))) & this.MASK24;
                }
                break;
            case 0o06: // SMR - Shift M right arithmetic
                this.M = this.sx(this.M) >> k;
                this.M &= this.MASK24;
                break;
            case 0o07: // SMLC - Shift M by k characters left (k*6 bits)
                if (k > 0) {
                    const bits = (k * 6) % 24;
                    this.M = ((this.M << bits) | (this.M >>> (24 - bits))) & this.MASK24;
                }
                break;
            case 0o12: // SRRL - Shift R right logical
                this.R = (this.R >>> k) & this.MASK24;
                break;
            case 0o16: // SMRL - Shift M right logical
                this.M = (this.M >>> k) & this.MASK24;
                break;
            case 0o20: // SRST - Shift R until standardized (critical for FP normalization)
                // Shift left until bits 22 and 23 differ, counting shifts in K
                {
                    let count = 0;
                    while (count < 24 && this.R !== 0) {
                        const b22 = (this.R >> 22) & 1;
                        const b23 = (this.R >> 23) & 1;
                        if (b22 !== b23) break;  // Standardized
                        this.R = (this.R << 1) & this.MASK24;
                        count++;
                    }
                    this.K = count & this.MASK12;
                }
                break;
            case 0o24: // SMST - Shift M until standardized (critical for FP normalization)
                // Shift left until bits 22 and 23 differ, counting shifts in K
                {
                    let count = 0;
                    while (count < 24 && this.M !== 0) {
                        const b22 = (this.M >> 22) & 1;
                        const b23 = (this.M >> 23) & 1;
                        if (b22 !== b23) break;  // Standardized
                        this.M = (this.M << 1) & this.MASK24;
                        count++;
                    }
                    this.K = count & this.MASK12;
                }
                break;
            case 0o40: // SBL - Shift both M and R left (48-bit shift)
                {
                    // Treat (R,M) as 48-bit register, shift left
                    const dbl = (BigInt(this.R) << 24n) | BigInt(this.M);
                    const shifted = (dbl << BigInt(k)) & 0xFFFFFFFFFFFFn;
                    this.R = Number((shifted >> 24n) & 0xFFFFFFn);
                    this.M = Number(shifted & 0xFFFFFFn);
                }
                break;
            case 0o42: // SBR - Shift both M and R right arithmetic (48-bit)
                {
                    // Treat (R,M) as 48-bit signed, shift right arithmetic
                    let dbl = (BigInt(this.R) << 24n) | BigInt(this.M);
                    // Sign extend if bit 47 is set
                    if (this.R & this.SIGN) {
                        dbl = dbl | (~0xFFFFFFFFFFFFn);
                    }
                    const shifted = dbl >> BigInt(k);
                    this.R = Number((shifted >> 24n) & 0xFFFFFFn);
                    this.M = Number(shifted & 0xFFFFFFn);
                }
                break;
            case 0o52: // SBRL - Shift both M and R right logical (48-bit)
                {
                    const dbl = (BigInt(this.R) << 24n) | BigInt(this.M);
                    const shifted = dbl >> BigInt(k);
                    this.R = Number((shifted >> 24n) & 0xFFFFFFn);
                    this.M = Number(shifted & 0xFFFFFFn);
                }
                break;
            case 0o62: // SBST - Shift both until standardized (48-bit normalization)
                {
                    let count = 0;
                    while (count < 48) {
                        // Check if bits 46 and 47 of combined (R,M) differ
                        const b46 = (this.R >> 22) & 1;
                        const b47 = (this.R >> 23) & 1;
                        if (b46 !== b47) break;  // Standardized
                        if (this.R === 0 && this.M === 0) break;  // Zero is standardized
                        // Shift (R,M) left by 1
                        const mTop = (this.M >> 23) & 1;
                        this.R = ((this.R << 1) | mTop) & this.MASK24;
                        this.M = (this.M << 1) & this.MASK24;
                        count++;
                    }
                    this.K = count & this.MASK12;
                }
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
                // Per E6X3: C register is 14 bits, but NON-CONTIGUOUS
                // c24-c17 (JS bits 23-16) = condition flags + interrupt permits
                // c6-c1 (JS bits 5-0) = manual console switches
                // c16-c7 (JS bits 15-6) = unallocated, forced to zero
                this.C = this.M & 0xFF003F;
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
     *
     * Per E6X3: Extracodes are SOFTWARE TRAPS, not inline execution.
     * The trap sequence is:
     *   (a) Place N in memory location 1
     *   (b) Place link (c24-18 + S) in memory location 2
     *   (c) Jump to 2*F (or 2*F+1 for Y>0)
     *
     * This allows the OS to intercept and handle operations.
     * The 4120 used this for software FP emulation.
     * The 4130 used it for supervisor calls.
     *
     * Exception: The 4130 had HARDWARE FP (F=0o52-0o65) which could execute
     * inline. This is configurable via hardwareFPEnabled flag.
     */
    extracode(f, y, n) {
        // Check if this is a hardware-accelerated extracode (4130 FP unit)
        // F=0o52-0o65 are FP instructions that the 4130 executed in hardware
        // These can optionally execute inline OR trap (configurable)
        const isHardwareFP = (f >= 0o52 && f <= 0o65);

        if (isHardwareFP && this.hardwareFPEnabled) {
            // Execute FP inline (4130 hardware FP mode)
            this.execHardwareFP(f, y, n);
        } else {
            // Per E6X3: Software trap for all other extracodes
            // (a) Place N in memory location 1
            // Direct write to mem[], bypassing checkProtection() - locations 1-2 are fixed OS locations
            this.mem[1] = n & this.MASK24;

            // (b) Place link (c24-18 + S) in memory location 2
            // Link word format: upper 7 bits of C (bits 23-17) + 17-bit S
            const link = ((this.C >> 17) & 0x7F) << 17 | (this.S & this.MASK17);
            this.mem[2] = link;

            // (c) Jump to 2*F (or 2*F+1 for Y>0)
            // S is a half-word address, so multiply by 2
            const trapAddr = (f * 2) + (y > 0 ? 1 : 0);
            this.S = (trapAddr * 2) & this.MASK17;
        }
    }

    /**
     * Execute hardware FP instruction inline (4130 mode)
     * These instructions execute in hardware on the 4130, but would trap
     * to software FP emulation on the 4120.
     *
     * Per E6X3: FP operands are two-word values at the effective address.
     * The FP instructions read two words from memory to get a full FP value.
     */
    execHardwareFP(f, y, n) {
        // Get effective address for memory operands (not the operand value itself)
        const addr = this.getAddr(y, n);

        switch (f) {
            case 0o52: // FADD - Floating add: fpAccum += [addr]
                this.fpAdd(addr);
                break;
            case 0o53: // FSUB - Floating subtract: fpAccum -= [addr]
                this.fpSub(addr);
                break;
            case 0o54: // FMUL - Floating multiply: fpAccum *= [addr]
                this.fpMul(addr);
                break;
            case 0o55: // FDIV - Floating divide: fpAccum /= [addr]
                this.fpDiv(addr);
                break;
            case 0o56: // FLD - Floating load: fpAccum := [addr]
                this.fpLoad(addr);
                break;
            case 0o57: // FST - Floating store: [addr] := fpAccum
                this.fpStore(y, n);
                break;
            case 0o60: // FNEG - Floating negate: fpAccum := -fpAccum
                this.fpNeg();
                break;
            case 0o61: // FABS - Floating absolute: fpAccum := |fpAccum|
                this.fpAbs();
                break;
            case 0o62: // FIX - Convert float to integer: M := int(fpAccum)
                this.fpFix();
                break;
            case 0o63: // FLT - Convert integer to float: fpAccum := float(M)
                this.fpFloat();
                break;
            case 0o64: // FCMP - Floating compare: set flags for fpAccum - [addr]
                this.fpCmp(addr);
                break;
            case 0o65: // FSQRT - Floating square root: fpAccum := sqrt(fpAccum)
                this.fpSqrt();
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
            // Protected Mode instructions - Per E6X4
            case 0o01000: // EXEN - Enter Executive Mode
                // Per E6X4: EXEN always enters Executive Mode, regardless of current mode
                // This allows Protected Mode programs to make supervisor calls
                this.executiveMode = true;
                break;
            case 0o02000: // PMEN - Enter Protected Mode
                // Sets Protected Mode with current Base and Range registers
                this.executiveMode = false;
                break;
            case 0o04000: // LDBR - Load Base Register from M
                if (this.executiveMode) {
                    this.baseReg = this.M & 0x3FF;  // 10-bit
                }
                break;
            case 0o10000: // LDRR - Load Range Register from M
                if (this.executiveMode) {
                    this.rangeReg = this.M & 0x3FF;  // 10-bit
                }
                break;
            case 0o00400: // BRTM - Base Register to M
                this.M = this.baseReg;
                break;
            case 0o00401: // RRTM - Range Register to M
                this.M = this.rangeReg;
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
     * Per E6X5: Channel 00=console, 01=tape reader, 02=tape punch
     */
    channelRead(channel) {
        const ch = this.channels[channel];
        if (!ch) return 0;

        // Channel 0 is console/keyboard
        if (channel === 0) {
            if (this.inputBuffer.length > 0) {
                return this.inputBuffer.shift();
            }
            // Signal waiting for input
            this.waitingForInput = true;
            return 0;
        }

        // Channel 1 is paper tape reader
        if (channel === 1) {
            if (this.tapeReader && this.tapeReader.position < this.tapeReader.data.length) {
                const byte = this.tapeReader.data[this.tapeReader.position++];
                ch.status |= ch.READY;
                return byte;
            } else {
                // End of tape
                ch.status |= ch.EOF;
                ch.status &= ~ch.READY;
                return 0;
            }
        }

        return ch.read();
    }

    /**
     * Write to I/O channel
     * Per E6X5: Channel 00=console, 01=tape reader, 02=tape punch
     */
    channelWrite(channel, data) {
        const ch = this.channels[channel];
        if (!ch) return;

        // Channel 0 is console output
        if (channel === 0) {
            // Convert to character and output
            const char = data & this.MASK6;
            this.output(this.sixBitToAscii(char));
            return;
        }

        // Channel 2 is paper tape punch
        if (channel === 2) {
            this.tapePunch.push(data & 0xFF);
            ch.status |= ch.READY;
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
     * Get tape reader status for UI
     */
    getTapeReaderStatus() {
        if (!this.tapeReader) {
            return { loaded: false, position: 0, length: 0 };
        }
        return {
            loaded: true,
            position: this.tapeReader.position,
            length: this.tapeReader.data.length,
            atEnd: this.tapeReader.position >= this.tapeReader.data.length
        };
    }

    /**
     * Rewind tape reader to beginning
     */
    rewindTape() {
        if (this.tapeReader) {
            this.tapeReader.position = 0;
            const ch = this.channels[1];
            if (ch) {
                ch.status &= ~ch.EOF;
                ch.status |= ch.READY;
            }
        }
    }

    /**
     * Clear tape punch output
     */
    clearTapePunch() {
        this.tapePunch = [];
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
     * Per E6X4: Interrupt handlers must run in Executive Mode with full memory access
     */
    checkInterrupts() {
        if (!this.interruptEnabled || this.pendingInterrupts.length === 0) {
            return false;
        }

        // Sort by priority (lower level = higher priority)
        this.pendingInterrupts.sort((a, b) => a.level - b.level);
        const int = this.pendingInterrupts.shift();

        // Save current execution context before interrupt (per E6X4)
        const savedMode = this.executiveMode;
        const savedBase = this.baseReg;
        const savedRange = this.rangeReg;

        // Save return address at location 0
        this.wr(0, this.S);

        // Save execution context at locations 3-5 for RTI restoration
        // Location 3: Mode flag (0 = Executive, 1 = Protected)
        // Location 4: Base register
        // Location 5: Range register
        this.mem[3] = savedMode ? 0 : 1;  // Store inverse: 0 if was Executive
        this.mem[4] = savedBase;
        this.mem[5] = savedRange;

        // Per E6X4: Switch to Executive Mode for interrupt handler
        // This gives the OS handler full memory access to service the interrupt
        this.executiveMode = true;

        // Jump to interrupt vector
        this.S = int.vector * 2;

        return true;
    }

    /**
     * Advance real-time clock by one tick (for unit testing)
     * Per E6X4: When alarm expires in Protected Mode, program is terminated
     * and execution returns to Executive Mode
     *
     * @returns {boolean} true if alarm fired
     */
    advanceRTC() {
        this.rtcCounter++;
        if (this.rtcDelay > 0 && this.rtcCounter >= this.rtcDelay) {
            // Raise RTC/alarm interrupt
            this.raiseInterrupt(this.INT_NORMAL, 0);

            // Per E6X4: Alarm Clock terminates Protected Mode program
            // "When Alarm Clock expires: Protected Mode program terminated"
            if (!this.executiveMode) {
                this.executiveMode = true;
            }

            this.rtcCounter = 0;
            return true;
        }
        return false;
    }

    /**
     * Start real-time clock
     */
    startRTC(intervalMs = 1000) {
        if (this.rtcInterval) clearInterval(this.rtcInterval);
        this.rtcInterval = setInterval(() => {
            this.advanceRTC();
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
    //
    // Per E6X3 manual p.6:
    // "On the 4130 where hardware is used, the mantissa occupies 48 bits within
    // CPU registers and the exponent 12 bits... When held in memory, floating-point
    // numbers are normally rounded and packed into two words containing 39 bits of
    // mantissa and 9 bits of exponent."
    //
    // Memory format (two 24-bit words):
    //   Word 1: [Sign(1)] [Exponent(9)] [Mantissa high(14)]
    //   Word 2: [Mantissa low(24)]
    //   Total: 39-bit mantissa (38 stored + 1 implicit), 9-bit exponent, 1-bit sign
    //
    // Internal format (during computation):
    //   48-bit mantissa held in (R, M) register pair
    //   12-bit exponent in fpExp
    //   This gives ~12 decimal digits precision
    // ========================================================================

    /**
     * Read two-word FP from memory and convert to JavaScript number
     * Per E6X3: Two words with 39-bit mantissa, 9-bit exponent, 1-bit sign
     */
    fpToFloat(addr) {
        const w1 = this.rd(addr);
        const w2 = this.rd(addr + 1);

        // Check for zero (both words zero)
        if (w1 === 0 && w2 === 0) return 0;

        // Extract fields from two-word format
        const sign = (w1 >> 23) & 1;
        const exp = ((w1 >> 14) & 0x1FF) - 256;  // 9-bit excess-256 bias
        const mantHigh = w1 & 0x3FFF;  // 14 bits
        const mantLow = w2 & 0xFFFFFF;  // 24 bits

        // Combine to 38-bit mantissa, add implicit leading 1 for 39 bits effective
        // mantissa = (1.mantHigh:mantLow) = 1 + (mantHigh * 2^24 + mantLow) / 2^38
        const mantissa = (mantHigh * 0x1000000 + mantLow) / 0x4000000000;  // Divide by 2^38
        const value = (1 + mantissa) * Math.pow(2, exp);

        return sign ? -value : value;
    }

    /**
     * Convert JavaScript number to two-word FP format and store at addr
     * Per E6X3: Two words with 39-bit mantissa, 9-bit exponent, 1-bit sign
     */
    floatToFp(value, addr) {
        if (value === 0) {
            this.wr(addr, 0);
            this.wr(addr + 1, 0);
            return;
        }

        const sign = value < 0 ? 1 : 0;
        value = Math.abs(value);

        // Normalize to 1.xxx form and find exponent
        let exp = 0;
        while (value >= 2) {
            value /= 2;
            exp++;
        }
        while (value < 1 && exp > -256) {
            value *= 2;
            exp--;
        }

        // Clamp exponent to 9-bit range (-256 to +255)
        if (exp < -256) exp = -256;
        if (exp > 255) exp = 255;

        // Extract 38-bit mantissa (without the implicit leading 1)
        // mantissa fraction = value - 1, scaled to 38 bits
        // 2^38 = 0x4000000000
        const mantissaFrac = value - 1;
        const mantissa = Math.floor(mantissaFrac * 0x4000000000);
        const mantHigh = Math.floor(mantissa / 0x1000000) & 0x3FFF;  // Upper 14 bits
        const mantLow = mantissa & 0xFFFFFF;  // Lower 24 bits

        // Pack into two words
        const w1 = (sign << 23) | ((exp + 256) << 14) | mantHigh;
        const w2 = mantLow;

        this.wr(addr, w1);
        this.wr(addr + 1, w2);
    }

    /**
     * Floating-point add: fpAccum := fpAccum + [addr]
     * Operand is read from two words at addr
     */
    fpAdd(addr) {
        const operand = this.fpToFloat(addr);
        this.fpAccum += operand;
    }

    /**
     * Floating-point subtract: fpAccum := fpAccum - [addr]
     * Operand is read from two words at addr
     */
    fpSub(addr) {
        const operand = this.fpToFloat(addr);
        this.fpAccum -= operand;
    }

    /**
     * Floating-point multiply: fpAccum := fpAccum * [addr]
     * Operand is read from two words at addr
     */
    fpMul(addr) {
        const operand = this.fpToFloat(addr);
        this.fpAccum *= operand;
    }

    /**
     * Floating-point divide: fpAccum := fpAccum / [addr]
     * Operand is read from two words at addr
     */
    fpDiv(addr) {
        const operand = this.fpToFloat(addr);
        if (operand !== 0) {
            this.fpAccum /= operand;
        } else {
            // Division by zero - set overflow flag
            this.C |= this.F_OF;
        }
    }

    /**
     * Floating-point load: fpAccum := [addr]
     * Loads two-word FP from memory into internal accumulator
     */
    fpLoad(addr) {
        this.fpAccum = this.fpToFloat(addr);
    }

    /**
     * Floating-point store: [addr] := fpAccum
     * Stores internal accumulator to two words in memory
     */
    fpStore(y, n) {
        const addr = this.getAddr(y, n);
        this.floatToFp(this.fpAccum, addr);
    }

    /**
     * Floating-point negate: fpAccum := -fpAccum
     */
    fpNeg() {
        this.fpAccum = -this.fpAccum;
    }

    /**
     * Floating-point absolute: fpAccum := |fpAccum|
     */
    fpAbs() {
        this.fpAccum = Math.abs(this.fpAccum);
    }

    /**
     * Convert float to integer: M := int(fpAccum)
     * Truncates FP accumulator to integer and stores in M register
     */
    fpFix() {
        const value = Math.trunc(this.fpAccum);
        this.M = value & this.MASK24;
        this.setC(this.M);
    }

    /**
     * Convert integer to float: fpAccum := float(M)
     * Converts signed integer in M to FP accumulator
     */
    fpFloat() {
        const value = this.sx(this.M);
        this.fpAccum = value;
    }

    /**
     * Floating-point compare: set flags based on fpAccum - [addr]
     * Operand is read from two words at addr
     */
    fpCmp(addr) {
        const operand = this.fpToFloat(addr);
        const diff = this.fpAccum - operand;

        this.C = 0;
        if (diff < 0) this.C |= this.F_NEG;
        if (diff !== 0) this.C |= this.F_NZ;
        if (diff === 0 || (diff > -1 && diff < 1)) this.C |= this.F_ST;
    }

    /**
     * Floating-point square root: fpAccum := sqrt(fpAccum)
     */
    fpSqrt() {
        if (this.fpAccum >= 0) {
            this.fpAccum = Math.sqrt(this.fpAccum);
        } else {
            // Negative - set overflow flag
            this.C |= this.F_OF;
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
