/**
 * Elliott 4130 Assembler (NEAT-style)
 * Two-pass assembler with labels, literals, and addressing modes
 */

class Asm {
    constructor() {
        // Instruction definitions
        // s: short-form opcode, l: long-form opcode
        // yMin: minimum Y value required
        // z: extra-code flag
        // n: fixed N value for register ops
        // jump: instruction is a jump (affects operand parsing)
        this.ops = {
            // Arithmetic - M operations
            'ADD':  { s: 0o00, l: 0o40 },
            'SUB':  { s: 0o01, l: 0o41 },
            'NADD': { s: 0o02, l: 0o42 },
            'LD':   { s: 0o03, l: 0o43 },

            // Arithmetic - R operations
            'LDR':  { s: 0o04, l: 0o44 },
            'ADDR': { s: 0o10, l: 0o50 },
            'SUBR': { s: 0o11, l: 0o51 },
            'NADR': { s: 0o12, l: 0o52 },

            // Logic
            'AND':  { s: 0o06, l: 0o46 },
            'ANDN': { s: 0o07, l: 0o47 },

            // Load K
            'LDK':  { s: 0o14, l: 0o54 },

            // Short-form only
            'JIR':  { s: 0o05 },

            // Store (require Y >= 1)
            'ST':   { l: 0o60, yMin: 1 },
            'STR':  { l: 0o61, yMin: 1 },

            // Jumps (absolute addressing)
            'J':    { l: 0o45, jump: 1 },
            'JFL':  { l: 0o53, jump: 1, relative: 1 },
            'JF':   { l: 0o56, jump: 1, relative: 1 },
            'JB':   { l: 0o57, jump: 1, relative: 1 },

            // Conditional jumps (relative addressing per E6X3 manual)
            'JN':   { l: 0o60, jump: 1, relative: 1 },  // Jump if negative
            'JNN':  { l: 0o61, jump: 1, relative: 1 },  // Jump if not negative
            'JZ':   { l: 0o62, jump: 1, relative: 1 },  // Jump if zero
            'JNZ':  { l: 0o63, jump: 1, relative: 1 },  // Jump if not zero
            'JST':  { l: 0o64, jump: 1, relative: 1 },  // Jump if standard
            'JOF':  { l: 0o65, jump: 1, relative: 1 },  // Jump if overflow
            'DKJN': { l: 0o67, jump: 1, relative: 1 },  // Decrement K, jump if negative

            // Compare
            'COMP': { l: 0o55 },

            // Memory operations (require Y >= 1)
            'NEGS': { l: 0o62, yMin: 1 },  // Negate store
            'SUBS': { l: 0o63, yMin: 1 },  // Subtract from store
            'ADDS': { l: 0o64, yMin: 1 },  // Add to store
            'CLS':  { l: 0o65, yMin: 1 },  // Clear store
            'INCS': { l: 0o66, yMin: 1 },  // Increment store
            'DECS': { l: 0o67, yMin: 1 },  // Decrement store

            // Block transfer
            'MVE':  { l: 0o74, yMin: 1 },
            'MVB':  { l: 0o75, yMin: 1 },

            // Exchange
            'EXC':  { l: 0o76, yMin: 1 },
            'EXCR': { l: 0o77, yMin: 1 },

            // Multiply/Divide
            'MULM': { l: 0o73, yMin: 1 },  // Double-length multiply
            'DIVM': { l: 0o72, yMin: 1 },  // Double-length divide
            'MULS': { l: 0o50, z: 1 },     // Single-length multiply (extracode)
            'DIV':  { l: 0o51, z: 1 },     // Single-length divide (extracode)

            // Register-to-register operations
            'MTOR': { l: 0o70, n: 0o00402 },  // M to R
            'RTOM': { l: 0o70, n: 0o01001 },  // R to M
            'KTOR': { l: 0o70, n: 0o00020 },  // K to R
            'STOR': { l: 0o70, n: 0o00404 },  // S to R
            'RTOS': { l: 0o70, n: 0o02001 },  // R to S
            'MTOS': { l: 0o70, n: 0o02002 },  // M to S
            'MTOK': { l: 0o70, n: 0o10002 },  // M to K
            'RTOK': { l: 0o70, n: 0o10001 },  // R to K
            'CTOM': { l: 0o70, n: 0o01010 },  // C to M
            'MTOC': { l: 0o70, n: 0o04002 },  // M to C
            'MORR': { l: 0o70, n: 0o01003 },  // M or R

            // Shift operations
            'SRL':  { s: 0o15, n: 0o00 },   // Shift R left
            'SRR':  { s: 0o15, n: 0o02 },   // Shift R right arithmetic
            'SML':  { s: 0o15, n: 0o04 },   // Shift M left
            'SMR':  { s: 0o15, n: 0o06 },   // Shift M right arithmetic
            'SRRL': { s: 0o15, n: 0o12 },   // Shift R right logical
            'SMRL': { s: 0o15, n: 0o16 },   // Shift M right logical

            // Output (extracode)
            'OUT':  { l: 0o77, z: 1 },
            'TR':   { l: 0o77, z: 1 },       // Display nth letter (y=0, n=letter)
            'CH':   { l: 0o77, z: 1, yMin: 1 }, // Display M in octal (y>=1)

            // Indirect jump (for subroutine returns)
            'JI':   { l: 0o45, yMin: 1, jump: 1 },  // Jump indirect via address

            // Character packing (extracode)
            'GET':  { l: 0o70, z: 1, yMin: 1 },  // Unpack char from Q to M
            'PUT':  { l: 0o71, z: 1, yMin: 1 },  // Pack char from M to Q

            // I/O channel instructions (extracode)
            'IDPR': { l: 0o74, z: 1 },          // Input data packed repetitive
            'ODPR': { l: 0o74, z: 1, yMin: 1 }, // Output data packed repetitive
            'IDUR': { l: 0o74, z: 1, yMin: 2 }, // Input data unpacked repetitive
            'ODUR': { l: 0o74, z: 1, yMin: 3 }, // Output data unpacked repetitive

            'ISPR': { l: 0o75, z: 1 },          // Input status packed
            'OCPR': { l: 0o75, z: 1, yMin: 1 }, // Output control packed
            'ISUR': { l: 0o75, z: 1, yMin: 2 }, // Input status unpacked
            'OCUR': { l: 0o75, z: 1, yMin: 3 }, // Output control unpacked

            'IDUM': { l: 0o76, z: 1, yMin: 2 }, // Input data unpacked single to M
            'ODUM': { l: 0o76, z: 1, yMin: 3 }, // Output data unpacked single from M
            'ISUM': { l: 0o77, z: 1, yMin: 2 }, // Input status single to M
            'OCUM': { l: 0o77, z: 1, yMin: 3 }, // Output control single from M

            // Interrupt handling (extracode)
            'ITOM': { l: 0o70, z: 1, n: 0o21000 }, // Interrupt word to M
            'ATOM': { l: 0o70, z: 1, n: 0o41000 }, // Attention word to M

            // Floating-point instructions (extracode)
            // Elliott 4130 had optional hardware FP unit
            'FADD': { l: 0o52, z: 1 },     // Floating add
            'FSUB': { l: 0o53, z: 1 },     // Floating subtract
            'FMUL': { l: 0o54, z: 1 },     // Floating multiply
            'FDIV': { l: 0o55, z: 1 },     // Floating divide
            'FLD':  { l: 0o56, z: 1 },     // Floating load
            'FST':  { l: 0o57, z: 1 },     // Floating store
            'FNEG': { l: 0o60, z: 1 },     // Floating negate
            'FABS': { l: 0o61, z: 1 },     // Floating absolute
            'FIX':  { l: 0o62, z: 1 },     // Convert float to integer
            'FLT':  { l: 0o63, z: 1 },     // Convert integer to float
            'FCMP': { l: 0o64, z: 1 },     // Floating compare
            'FSQRT':{ l: 0o65, z: 1 },     // Floating square root
        };

        this.errors = [];
    }

    /**
     * Assemble source code to machine code
     * Returns array of {addr, word} objects
     */
    asm(src) {
        this.errors = [];
        const labels = {};
        const out = [];
        let addr = 0;

        // Preprocess: remove comments, trim whitespace
        const lines = src.split('\n').map((line, lineNum) => {
            const commentIdx = line.indexOf(';');
            const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
            return { text: code.trim(), lineNum: lineNum + 1 };
        }).filter(l => l.text);

        // Pass 1: Collect labels and calculate addresses
        for (const line of lines) {
            const text = line.text;

            // Check for address label (e.g., "100:")
            const addrMatch = text.match(/^(\d+):/);
            if (addrMatch) {
                addr = parseInt(addrMatch[1]);
                labels[addrMatch[1]] = addr;
            }

            // Check for symbolic label (e.g., "LOOP:")
            const labelMatch = text.match(/^([A-Za-z_]\w*):/);
            if (labelMatch) {
                labels[labelMatch[1]] = addr;
            }

            // Get the rest of the line after any label
            const rest = text.replace(/^\d+:|^[A-Za-z_]\w*:/, '').trim();
            if (rest) addr++;
        }

        // Pass 2: Generate code
        addr = 0;
        for (const line of lines) {
            const text = line.text;

            // Handle address directive
            const addrMatch = text.match(/^(\d+):/);
            if (addrMatch) {
                addr = parseInt(addrMatch[1]);
            }

            // Get instruction part
            const rest = text.replace(/^\d+:|^[A-Za-z_]\w*:/, '').trim();
            if (!rest) continue;

            // Decimal literal (#n)
            if (rest.startsWith('#')) {
                const val = parseInt(rest.slice(1));
                if (isNaN(val)) {
                    this.errors.push({ line: line.lineNum, msg: `Invalid literal: ${rest}` });
                } else {
                    out.push({ addr, word: val & 0xFFFFFF });
                }
                addr++;
                continue;
            }

            // Octal literal ($n)
            if (rest.startsWith('$')) {
                const val = parseInt(rest.slice(1), 8);
                if (isNaN(val)) {
                    this.errors.push({ line: line.lineNum, msg: `Invalid octal: ${rest}` });
                } else {
                    out.push({ addr, word: val & 0xFFFFFF });
                }
                addr++;
                continue;
            }

            // Parse instruction
            const parts = rest.split(/\s+/);
            const mnem = parts[0].toUpperCase();
            const operand = parts.slice(1).join(' ');

            const info = this.ops[mnem];
            if (!info) {
                this.errors.push({ line: line.lineNum, msg: `Unknown mnemonic: ${mnem}` });
                addr++;
                continue;
            }

            // Parse operand
            let { value, y } = this.parseOp(operand, labels, !!info.jump);

            // Override N for fixed register operations
            if (info.n !== undefined) {
                value = info.n;
                y = 0;
            }

            // For relative jumps, convert absolute target to offset from next instruction
            // Offset = target - (current + 1) because S advances before jump executes
            if (info.relative && y === 0) {
                value = value - (addr + 1);
                if (value < 0) value = value & 0x7FFF;  // Handle negative offsets
            }

            // Determine if long form is needed
            // Short form can't do literal mode (y=0) - short form always reads from memory
            // Need long form for: no short form, requires y>0, z flag, large value, or literal mode with non-jump
            const isLiteral = operand && operand.trim().startsWith('#');
            const needsLong = !info.s || info.yMin || info.z || value > 63 || y > 0 || (y === 0 && isLiteral && !info.jump);

            let word;
            if (needsLong) {
                const f = info.l;
                const z = info.z || 0;

                // Ensure minimum Y value
                if (info.yMin && y < info.yMin) y = info.yMin;

                word = (f << 18) | (y << 16) | (z << 15) | (value & 0x7FFF);
            } else {
                const f = info.s;
                const n = (info.n !== undefined ? info.n : value) & 0x3F;
                word = ((f << 6) | n) << 12;
            }

            out.push({ addr, word });
            addr++;
        }

        return out;
    }

    /**
     * Parse operand string
     * Returns { value, y } where y is the addressing mode
     */
    parseOp(op, labels, isJump) {
        if (!op || !op.trim()) return { value: 0, y: 0 };

        op = op.trim();

        // Literal: #n (Y=0, N=value)
        if (op.startsWith('#')) {
            return { value: parseInt(op.slice(1)) || 0, y: 0 };
        }

        // Indirect: @n (Y=3)
        if (op.startsWith('@')) {
            return { value: this.resolve(op.slice(1), labels), y: 3 };
        }

        // Modified: n,R (Y=2)
        if (op.includes(',R')) {
            return { value: this.resolve(op.split(',')[0], labels), y: 2 };
        }

        // Direct addressing
        // For jumps: Y=0 (N is the target address)
        // For data ops: Y=1 (N is the address to fetch from)
        return { value: this.resolve(op, labels), y: isJump ? 0 : 1 };
    }

    /**
     * Resolve symbol or numeric address
     */
    resolve(s, labels) {
        s = s.trim();
        if (labels[s] !== undefined) return labels[s];
        return parseInt(s) || 0;
    }

    /**
     * Get assembly errors from last asm() call
     */
    getErrors() {
        return this.errors;
    }
}

/**
 * Disassemble a single word
 */
function disasm(w, verbose = false) {
    if (!w) return '';

    const f = (w >> 18) & 0x3F;

    if (f >= 0o40) {
        // Long instruction
        const y = (w >> 16) & 3;
        const z = (w >> 15) & 1;
        const n = w & 0x7FFF;

        const mnemonics = {
            0o40: 'ADD', 0o41: 'SUB', 0o42: 'NADD', 0o43: 'LD',
            0o44: 'LDR', 0o45: 'J', 0o46: 'AND', 0o47: 'ANDN',
            0o50: 'ADDR', 0o51: 'SUBR', 0o52: 'NADR', 0o53: 'JFL',
            0o54: 'LDK', 0o55: 'COMP', 0o56: 'JF', 0o57: 'JB',
            0o60: y ? 'ST' : 'JN',
            0o61: y ? 'STR' : 'JNN',
            0o62: y ? 'NEGS' : 'JZ',
            0o63: y ? 'SUBS' : 'JNZ',
            0o64: y ? 'ADDS' : 'JST',
            0o65: y ? 'CLS' : 'JOF',
            0o66: 'INCS',
            0o67: y ? 'DECS' : 'DKJN',
            0o70: 'REG',
            0o72: 'DIVM', 0o73: 'MULM',
            0o74: 'MVE', 0o75: 'MVB',
            0o76: 'EXC', 0o77: 'EXCR'
        };

        // Special handling for extracode
        if (z) {
            const extraMnemonics = {
                0o50: 'MULS',
                0o51: 'DIV',
                0o77: 'OUT'
            };
            const mnem = extraMnemonics[f] || '?';
            const yPrefix = ['#', '', ',R', '@'][y];
            return `${mnem}* ${yPrefix}${n}`;
        }

        // Special handling for register ops (f=70)
        if (f === 0o70) {
            const regOps = {
                0o00020: 'KTOR',
                0o00402: 'MTOR',
                0o00404: 'STOR',
                0o01001: 'RTOM',
                0o01003: 'MORR',
                0o01010: 'CTOM',
                0o02001: 'RTOS',
                0o02002: 'MTOS',
                0o04002: 'MTOC',
                0o10001: 'RTOK',
                0o10002: 'MTOK'
            };
            return regOps[n] || `REG ${n.toString(8)}`;
        }

        const mnem = mnemonics[f] || '?';
        const yPrefix = ['#', '', ',R', '@'][y];

        if (verbose) {
            return `${mnem} ${yPrefix}${n} (f=${f.toString(8)} y=${y} z=${z} n=${n})`;
        }
        return `${mnem} ${yPrefix}${n}`;
    } else {
        // Short instruction
        const n = (w >> 12) & 0x3F;

        const mnemonics = {
            0o00: 'ADD', 0o01: 'SUB', 0o02: 'NADD', 0o03: 'LD',
            0o04: 'LDR', 0o05: 'JIR', 0o06: 'AND', 0o07: 'ANDN',
            0o10: 'ADDR', 0o11: 'SUBR', 0o12: 'NADR',
            0o14: 'LDK', 0o15: 'SH',
            0o30: 'ST', 0o31: 'STR'
        };

        const mnem = mnemonics[f] || '?';

        if (verbose) {
            return `${mnem} ${n} (short f=${f.toString(8)} n=${n})`;
        }
        return `${mnem} ${n}`;
    }
}

/**
 * Format word as octal string
 */
function formatWord(w) {
    return (w & 0xFFFFFF).toString(8).padStart(8, '0');
}

/**
 * Format address as decimal
 */
function formatAddr(a) {
    return a.toString().padStart(5, ' ');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Asm, disasm, formatWord, formatAddr };
}
