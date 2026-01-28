/**
 * Elliott 4130 Comprehensive Test Suite
 * Tests organized from basic to advanced, building up coverage systematically
 *
 * Test categories:
 * 1. Core primitives (reset, memory, registers)
 * 2. Basic arithmetic (ADD, SUB, LD)
 * 3. Condition flags
 * 4. Addressing modes
 * 5. Jumps and branches
 * 6. Logic operations
 * 7. Shift operations
 * 8. Register transfers
 * 9. Memory operations
 * 10. Multiply/Divide
 * 11. Integration tests
 */

const E4130Tests = {
    // Test runner state
    results: [],
    currentCategory: '',

    /**
     * Run a single test
     * @param {string} name - Test name
     * @param {string} code - Assembly code
     * @param {function} check - Function(cpu) returning true if test passes
     * @param {object} options - Optional settings (maxCycles, setup)
     */
    runTest(name, code, check, options = {}) {
        const cpu = new E4130();
        const asm = new Asm();

        try {
            // Setup if provided
            if (options.setup) {
                options.setup(cpu);
            }

            // Assemble and load
            const program = asm.asm(code);
            for (const { addr, word } of program) {
                cpu.mem[addr] = word;
            }

            cpu.halted = false;
            const maxCycles = options.maxCycles || 1000;

            // Execute
            for (let i = 0; i < maxCycles && !cpu.halted; i++) {
                const w = cpu.mem[cpu.S >> 1];
                const f = (w >> 18) & 0x3F;
                const y = (w >> 16) & 3;
                const n = w & 0x7FFF;

                // Detect infinite loop (J #S)
                if (f === 0o45 && y === 0 && n === cpu.S) break;

                cpu.step();
            }

            // Check result
            const passed = check(cpu);
            this.results.push({
                category: this.currentCategory,
                name,
                passed,
                error: null
            });
            return passed;
        } catch (e) {
            this.results.push({
                category: this.currentCategory,
                name,
                passed: false,
                error: e.message
            });
            return false;
        }
    },

    /**
     * Run a direct CPU test (no assembly)
     */
    runDirectTest(name, testFn) {
        try {
            const cpu = new E4130();
            const passed = testFn(cpu);
            this.results.push({
                category: this.currentCategory,
                name,
                passed,
                error: null
            });
            return passed;
        } catch (e) {
            this.results.push({
                category: this.currentCategory,
                name,
                passed: false,
                error: e.message
            });
            return false;
        }
    },

    // =========================================================================
    // Category 1: Core Primitives
    // =========================================================================
    testCorePrimitives() {
        this.currentCategory = '1. Core Primitives';

        // Test reset
        this.runDirectTest('reset clears M', cpu => {
            cpu.M = 12345;
            cpu.reset();
            return cpu.M === 0;
        });

        this.runDirectTest('reset clears R', cpu => {
            cpu.R = 12345;
            cpu.reset();
            return cpu.R === 0;
        });

        this.runDirectTest('reset clears S', cpu => {
            cpu.S = 12345;
            cpu.reset();
            return cpu.S === 0;
        });

        this.runDirectTest('reset clears K', cpu => {
            cpu.K = 123;
            cpu.reset();
            return cpu.K === 0;
        });

        this.runDirectTest('reset clears C', cpu => {
            cpu.C = 63;
            cpu.reset();
            return cpu.C === 0;
        });

        this.runDirectTest('reset sets halted', cpu => {
            cpu.halted = false;
            cpu.reset();
            return cpu.halted === true;
        });

        // Test memory read/write
        this.runDirectTest('mem write/read basic', cpu => {
            cpu.wr(100, 0x123456);
            return cpu.rd(100) === 0x123456;
        });

        this.runDirectTest('mem 24-bit mask on write', cpu => {
            cpu.wr(100, 0xFFFFFFFF);
            return cpu.rd(100) === 0xFFFFFF;
        });

        this.runDirectTest('mem address wraparound', cpu => {
            cpu.wr(65536, 42);  // Should wrap to 0
            return cpu.rd(0) === 42;
        });

        // Test sign extension
        this.runDirectTest('sx positive value', cpu => {
            return cpu.sx(0x7FFFFF) === 0x7FFFFF;
        });

        this.runDirectTest('sx negative value', cpu => {
            return cpu.sx(0x800000) === -8388608;
        });

        this.runDirectTest('sx -1', cpu => {
            return cpu.sx(0xFFFFFF) === -1;
        });
    },

    // =========================================================================
    // Category 2: Basic Arithmetic
    // =========================================================================
    testBasicArithmetic() {
        this.currentCategory = '2. Basic Arithmetic';

        // LD - Load
        this.runTest('LD loads value to M', `
            LD A
            ST R
            J #0
            A: #42
            R: #0
        `, cpu => cpu.mem[4] === 42);

        this.runTest('LD loads zero', `
            LD A
            ST R
            J #0
            A: #0
            R: #99
        `, cpu => cpu.mem[4] === 0);

        this.runTest('LD loads max positive', `
            LD A
            ST R
            J #0
            A: $37777777
            R: #0
        `, cpu => cpu.mem[4] === 0x7FFFFF);

        // ADD - Addition
        this.runTest('ADD 1+1=2', `
            LD A
            ADD B
            ST R
            J #0
            A: #1
            B: #1
            R: #0
        `, cpu => cpu.mem[6] === 2);

        this.runTest('ADD 5+3=8', `
            LD A
            ADD B
            ST R
            J #0
            A: #5
            B: #3
            R: #0
        `, cpu => cpu.mem[6] === 8);

        this.runTest('ADD 0+0=0', `
            LD A
            ADD B
            ST R
            J #0
            A: #0
            B: #0
            R: #0
        `, cpu => cpu.mem[6] === 0);

        this.runTest('ADD with literal #n', `
            LD A
            ADD #10
            ST R
            J #0
            A: #5
            R: #0
        `, cpu => cpu.mem[5] === 15);

        this.runTest('ADD negative numbers', `
            LD A
            ADD B
            ST R
            J #0
            A: $77777777
            B: $77777777
            R: #0
        `, cpu => cpu.mem[6] === (0xFFFFFE & 0xFFFFFF));

        this.runTest('ADD pos + neg = pos', `
            LD A
            ADD B
            ST R
            J #0
            A: #10
            B: $77777777
            R: #0
        `, cpu => cpu.mem[6] === 9);

        // SUB - Subtraction
        this.runTest('SUB 5-3=2', `
            LD A
            SUB B
            ST R
            J #0
            A: #5
            B: #3
            R: #0
        `, cpu => cpu.mem[6] === 2);

        this.runTest('SUB 10-3=7', `
            LD A
            SUB B
            ST R
            J #0
            A: #10
            B: #3
            R: #0
        `, cpu => cpu.mem[6] === 7);

        this.runTest('SUB 3-5=-2', `
            LD A
            SUB B
            ST R
            J #0
            A: #3
            B: #5
            R: #0
        `, cpu => cpu.sx(cpu.mem[6]) === -2);

        this.runTest('SUB 0-1=-1', `
            LD A
            SUB B
            ST R
            J #0
            A: #0
            B: #1
            R: #0
        `, cpu => cpu.sx(cpu.mem[6]) === -1);

        // NADD - Negative add (operand - M)
        this.runTest('NADD 10-3=7', `
            LD A
            NADD B
            ST R
            J #0
            A: #3
            B: #10
            R: #0
        `, cpu => cpu.mem[6] === 7);

        // LDR - Load to R
        this.runTest('LDR loads to R', `
            LDR A
            STR R
            J #0
            A: #99
            R: #0
        `, cpu => cpu.mem[4] === 99);

        // ADDR/SUBR - R arithmetic
        this.runTest('ADDR R+[n]', `
            LDR A
            ADDR B
            STR R
            J #0
            A: #10
            B: #5
            R: #0
        `, cpu => cpu.mem[6] === 15);

        this.runTest('SUBR R-[n]', `
            LDR A
            SUBR B
            STR R
            J #0
            A: #10
            B: #3
            R: #0
        `, cpu => cpu.mem[6] === 7);
    },

    // =========================================================================
    // Category 3: Condition Flags
    // =========================================================================
    testConditionFlags() {
        this.currentCategory = '3. Condition Flags';

        // Negative flag
        this.runTest('NEG flag set on negative', `
            LD A
            JN OK
            LD ZERO
            ST R
            J #0
            OK: LD ONE
            ST R
            J #0
            A: $77777777
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[11] === 1);

        this.runTest('NEG flag clear on positive', `
            LD A
            JN BAD
            LD ONE
            ST R
            J #0
            BAD: LD ZERO
            ST R
            J #0
            A: #5
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[11] === 1);

        // Zero flag (NZ)
        this.runTest('NZ flag clear on zero', `
            LD A
            JZ OK
            LD ZERO
            ST R
            J #0
            OK: LD ONE
            ST R
            J #0
            A: #0
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[11] === 1);

        this.runTest('NZ flag set on non-zero', `
            LD A
            JNZ OK
            LD ZERO
            ST R
            J #0
            OK: LD ONE
            ST R
            J #0
            A: #42
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[11] === 1);

        // COMP instruction
        this.runTest('COMP sets NEG when M < op', `
            LD A
            COMP B
            JN OK
            LD ZERO
            ST R
            J #0
            OK: LD ONE
            ST R
            J #0
            A: #3
            B: #10
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[12] === 1);

        this.runTest('COMP clears NEG when M > op', `
            LD A
            COMP B
            JN BAD
            LD ONE
            ST R
            J #0
            BAD: LD ZERO
            ST R
            J #0
            A: #10
            B: #3
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[12] === 1);

        this.runTest('COMP sets Z when M == op', `
            LD A
            COMP B
            JZ OK
            LD ZERO
            ST R
            J #0
            OK: LD ONE
            ST R
            J #0
            A: #5
            B: #5
            ZERO: #0
            ONE: #1
            R: #0
        `, cpu => cpu.mem[12] === 1);
    },

    // =========================================================================
    // Category 4: Addressing Modes
    // =========================================================================
    testAddressingModes() {
        this.currentCategory = '4. Addressing Modes';

        // Y=0: Literal
        this.runTest('Literal mode #n', `
            LD #42
            ST R
            J #0
            R: #0
        `, cpu => cpu.mem[3] === 42);

        // Y=1: Direct
        this.runTest('Direct mode', `
            LD A
            ST R
            J #0
            A: #99
            R: #0
        `, cpu => cpu.mem[4] === 99);

        // Y=2: Modified (base + R)
        this.runTest('Modified mode n,R', `
            LDR BASE
            LD 0,R
            ST RES
            J #0
            BASE: #5
            RES: #0
            5: #777
        `, cpu => cpu.mem[5] === 777);

        // Y=3: Indirect
        this.runTest('Indirect mode @n', `
            LD @PTR
            ST RES
            J #0
            PTR: #5
            RES: #0
            5: #888
        `, cpu => cpu.mem[4] === 888);
    },

    // =========================================================================
    // Category 5: Jumps and Branches
    // =========================================================================
    testJumps() {
        this.currentCategory = '5. Jumps and Branches';

        // Unconditional jump
        this.runTest('J unconditional', `
            J TARGET
            LD BAD
            ST RES
            J #0
            TARGET: LD GOOD
            ST RES
            J #0
            BAD: #0
            GOOD: #1
            RES: #0
        `, cpu => cpu.mem[9] === 1);

        // JN - Jump if negative
        this.runTest('JN taken when negative', `
            LD NEG
            JN OK
            LD ZERO
            ST RES
            J #0
            OK: LD ONE
            ST RES
            J #0
            NEG: $77777777
            ZERO: #0
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[11] === 1);

        this.runTest('JN not taken when positive', `
            LD POS
            JN BAD
            LD ONE
            ST RES
            J #0
            BAD: LD ZERO
            ST RES
            J #0
            POS: #5
            ZERO: #0
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[11] === 1);

        // JNN - Jump if not negative
        this.runTest('JNN taken when positive', `
            LD POS
            JNN OK
            LD ZERO
            ST RES
            J #0
            OK: LD ONE
            ST RES
            J #0
            POS: #5
            ZERO: #0
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[11] === 1);

        // JZ - Jump if zero
        this.runTest('JZ taken when zero', `
            LD ZERO
            JZ OK
            LD BAD
            ST RES
            J #0
            OK: LD GOOD
            ST RES
            J #0
            ZERO: #0
            BAD: #0
            GOOD: #1
            RES: #0
        `, cpu => cpu.mem[11] === 1);

        // JNZ - Jump if not zero
        this.runTest('JNZ taken when non-zero', `
            LD VAL
            JNZ OK
            LD ZERO
            ST RES
            J #0
            OK: LD ONE
            ST RES
            J #0
            VAL: #42
            ZERO: #0
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[11] === 1);

        // DKJN - Decrement K and jump if negative
        // DKJN: Decrement K, Jump if Negative (forward to exit)
        // Proper loop: DKJN at start to exit when K < 0, JF at end to continue
        this.runTest('DKJN loop 3 iterations', `
            LD ZERO
            LDK CNT
            LOOP: DKJN DONE
            ADD ONE
            JF LOOP
            DONE: ST RES
            J #0
            ZERO: #0
            CNT: #3
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[10] === 3);

        this.runTest('DKJN loop 5 iterations', `
            LD ZERO
            LDK CNT
            LOOP: DKJN DONE
            ADD ONE
            JF LOOP
            DONE: ST RES
            J #0
            ZERO: #0
            CNT: #5
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[10] === 5);
    },

    // =========================================================================
    // Category 6: Logic Operations
    // =========================================================================
    testLogic() {
        this.currentCategory = '6. Logic Operations';

        this.runTest('AND basic', `
            LD A
            AND B
            ST RES
            J #0
            A: $77
            B: $17
            RES: #0
        `, cpu => cpu.mem[6] === 0o17);

        this.runTest('AND all bits', `
            LD A
            AND B
            ST RES
            J #0
            A: $77777777
            B: $77777777
            RES: #0
        `, cpu => cpu.mem[6] === 0xFFFFFF);

        this.runTest('AND clear all', `
            LD A
            AND B
            ST RES
            J #0
            A: $77777777
            B: #0
            RES: #99
        `, cpu => cpu.mem[6] === 0);

        this.runTest('ANDN complement mask', `
            LD A
            ANDN B
            ST RES
            J #0
            A: $77
            B: $70
            RES: #0
        `, cpu => cpu.mem[6] === 0o07);
    },

    // =========================================================================
    // Category 7: Shift Operations
    // =========================================================================
    testShifts() {
        this.currentCategory = '7. Shift Operations';

        this.runTest('SML shift M left by 1', `
            LD VAL
            LDK CNT
            SML
            ST RES
            J #0
            VAL: #1
            CNT: #1
            RES: #0
        `, cpu => cpu.mem[7] === 2);

        this.runTest('SML shift M left by 4', `
            LD VAL
            LDK CNT
            SML
            ST RES
            J #0
            VAL: #1
            CNT: #4
            RES: #0
        `, cpu => cpu.mem[7] === 16);

        this.runTest('SMR shift M right by 1', `
            LD VAL
            LDK CNT
            SMR
            ST RES
            J #0
            VAL: #16
            CNT: #1
            RES: #0
        `, cpu => cpu.mem[7] === 8);

        this.runTest('SMR sign extends', `
            LD VAL
            LDK CNT
            SMR
            ST RES
            J #0
            VAL: $77777777
            CNT: #4
            RES: #0
        `, cpu => cpu.sx(cpu.mem[7]) === -1);

        this.runTest('SMRL logical shift right', `
            LD VAL
            LDK CNT
            SMRL
            ST RES
            J #0
            VAL: $77777777
            CNT: #4
            RES: #0
        `, cpu => cpu.mem[7] === 0x0FFFFF);

        this.runTest('SRL shift R left', `
            LDR VAL
            LDK CNT
            SRL
            STR RES
            J #0
            VAL: #3
            CNT: #2
            RES: #0
        `, cpu => cpu.mem[7] === 12);
    },

    // =========================================================================
    // Category 8: Register Transfers
    // =========================================================================
    testRegisterTransfers() {
        this.currentCategory = '8. Register Transfers';

        this.runTest('MTOR M to R', `
            LD VAL
            MTOR
            STR RES
            J #0
            VAL: #42
            RES: #0
        `, cpu => cpu.mem[4] === 42);

        this.runTest('RTOM R to M', `
            LDR VAL
            RTOM
            ST RES
            J #0
            VAL: #99
            RES: #0
        `, cpu => cpu.mem[4] === 99);

        this.runTest('MTOK M to K', `
            LD #498
            MTOK
            J #0
        `, cpu => cpu.K === 498);
    },

    // =========================================================================
    // Category 9: Memory Operations
    // =========================================================================
    testMemoryOps() {
        this.currentCategory = '9. Memory Operations';

        // Memory-modifying tests use HALT at addr 0 and start execution at addr 1
        // to avoid infinite increment/decrement loops
        this.runTest('INCS increment memory', `
            HALT: J HALT
            INCS A
            LD A
            ST RES
            J HALT
            A: #10
            RES: #0
        `, cpu => cpu.mem[6] === 11, { setup: cpu => { cpu.S = 2; } });

        this.runTest('DECS decrement memory', `
            HALT: J HALT
            DECS A
            LD A
            ST RES
            J HALT
            A: #10
            RES: #0
        `, cpu => cpu.mem[6] === 9, { setup: cpu => { cpu.S = 2; } });

        this.runTest('ADDS add to memory', `
            HALT: J HALT
            LD VAL
            ADDS A
            LD A
            ST RES
            J HALT
            VAL: #5
            A: #10
            RES: #0
        `, cpu => cpu.mem[8] === 15, { setup: cpu => { cpu.S = 2; } });

        this.runTest('SUBS subtract from memory', `
            HALT: J HALT
            LD VAL
            SUBS A
            LD A
            ST RES
            J HALT
            VAL: #3
            A: #10
            RES: #0
        `, cpu => cpu.mem[8] === 7, { setup: cpu => { cpu.S = 2; } });

        this.runTest('CLS clear memory', `
            CLS A
            LD A
            ST RES
            J #0
            A: #999
            RES: #1
        `, cpu => cpu.mem[4] === 0);

        this.runTest('NEGS negate memory', `
            HALT: J HALT
            NEGS A
            LD A
            ST RES
            J HALT
            A: #5
            RES: #0
        `, cpu => cpu.sx(cpu.mem[6]) === -5, { setup: cpu => { cpu.S = 2; } });

        this.runTest('EXC exchange M with memory', `
            HALT: J HALT
            LD MVAL
            EXC A
            ST OLDM
            LD A
            ST NEWA
            J HALT
            MVAL: #42
            A: #99
            OLDM: #0
            NEWA: #0
        `, cpu => cpu.mem[8] === 42 && cpu.mem[9] === 99, { setup: cpu => { cpu.S = 2; } });
    },

    // =========================================================================
    // Category 10: Multiply/Divide
    // =========================================================================
    testMulDiv() {
        this.currentCategory = '10. Multiply/Divide';

        this.runTest('MULS 6*7=42', `
            LD A
            MULS B
            ST RES
            J #0
            A: #6
            B: #7
            RES: #0
        `, cpu => cpu.mem[6] === 42);

        this.runTest('MULS 10*10=100', `
            LD A
            MULS B
            ST RES
            J #0
            A: #10
            B: #10
            RES: #0
        `, cpu => cpu.mem[6] === 100);

        this.runTest('MULS negative result', `
            LD A
            MULS B
            ST RES
            J #0
            A: #5
            B: $77777777
            RES: #0
        `, cpu => cpu.sx(cpu.mem[6]) === -5);

        this.runTest('DIV 17/5=3 rem 2', `
            LD A
            DIV B
            ST Q
            STR REM
            J #0
            A: #17
            B: #5
            Q: #0
            REM: #0
        `, cpu => cpu.mem[7] === 3 && cpu.mem[8] === 2);

        this.runTest('DIV 100/10=10 rem 0', `
            LD A
            DIV B
            ST Q
            STR REM
            J #0
            A: #100
            B: #10
            Q: #0
            REM: #0
        `, cpu => cpu.mem[7] === 10 && cpu.mem[8] === 0);

        this.runTest('DIV 7/3=2 rem 1', `
            LD A
            DIV B
            ST Q
            STR REM
            J #0
            A: #7
            B: #3
            Q: #0
            REM: #0
        `, cpu => cpu.mem[7] === 2 && cpu.mem[8] === 1);
    },

    // =========================================================================
    // Category 11: Integration Tests
    // =========================================================================
    testIntegration() {
        this.currentCategory = '11. Integration Tests';

        // Sum 1 to 10 - DKJN exits forward when K < 0
        // Use HALT at address 0 to properly terminate
        this.runTest('Sum 1 to 10 = 55', `
            HALT: J HALT
            LD ZERO
            LDK CNT
            LOOP: DKJN DONE
            ADD ONE
            ADDS SUM
            JF LOOP
            DONE: LD SUM
            ST RES
            J HALT
            ZERO: #0
            CNT: #10
            ONE: #1
            SUM: #0
            RES: #0
        `, cpu => cpu.mem[14] === 55, { setup: cpu => { cpu.S = 2; } });

        // Factorial 5 - DKJN exits forward when K < 0
        this.runTest('Factorial 5 = 120', `
            HALT: J HALT
            LD ONE
            ST RES
            LDK N
            LOOP: DKJN DONE
            LD RES
            MULS CTR
            ST RES
            DECS CTR
            JF LOOP
            DONE: J HALT
            ONE: #1
            N: #5
            CTR: #5
            RES: #0
        `, cpu => cpu.mem[14] === 120, { setup: cpu => { cpu.S = 2; } });

        // Fibonacci sequence (8th number) - DKJN exits forward when K < 0
        this.runTest('Fibonacci 8 = 21', `
            HALT: J HALT
            LD ONE
            ST A
            ST B
            LDK CNT
            LOOP: DKJN DONE
            LD A
            ADD B
            EXC A
            EXC B
            JF LOOP
            DONE: LD A
            ST RES
            J HALT
            ONE: #1
            CNT: #6
            A: #0
            B: #0
            RES: #0
        `, cpu => cpu.mem[18] === 21, { setup: cpu => { cpu.S = 2; } });

        // Memory copy using modified addressing - DKJN exits forward when K < 0
        // Use hard-coded addresses since ,R mode adds R to the address field, not to memory contents
        this.runTest('Memory copy with R index', `
            HALT: J HALT
            LDR ZERO
            LDK CNT
            LOOP: DKJN DONE
            LD SRC,R
            ST DST,R
            ADDR ONE
            JF LOOP
            DONE: LD DST
            ST RES
            J HALT
            ZERO: #0
            ONE: #1
            CNT: #3
            RES: #0
            SRC: #111
            SRCB: #222
            SRCC: #333
            DST: #0
            DSTB: #0
            DSTC: #0
        `, cpu => cpu.mem[18] === 111 && cpu.mem[19] === 222 && cpu.mem[20] === 333, { setup: cpu => { cpu.S = 2; } });
    },

    // =========================================================================
    // Category 12: Lisp Interpreter
    // =========================================================================
    testLisp() {
        this.currentCategory = '12. Lisp Interpreter';

        // Test: (CAR (QUOTE (A B C))) -> A
        // Cell format: [CAR:12bits | CDR:12bits]
        // A=3072, B=3073, C=3074, QUOTE=3080, CAR=3076, NIL=4095
        this.runTest('Lisp: (CAR (QUOTE (A B C))) = A', `
            J     MAIN

            MAIN:
            ; Build (C . NIL) at 1000
            LD    #3074
            MULS  #4096
            ADD   #4095
            ST    1000

            ; Build (B . 1000) at 1001
            LD    #3073
            MULS  #4096
            ADD   #1000
            ST    1001

            ; Build (A . 1001) at 1002 = (A B C)
            LD    #3072
            MULS  #4096
            ADD   #1001
            ST    1002

            ; Build ((A B C) . NIL) at 1003
            LD    #1002
            MULS  #4096
            ADD   #4095
            ST    1003

            ; Build (QUOTE . 1003) at 1004 = (QUOTE (A B C))
            LD    #3080
            MULS  #4096
            ADD   #1003
            ST    1004

            ; Build ((QUOTE (A B C)) . NIL) at 1005
            LD    #1004
            MULS  #4096
            ADD   #4095
            ST    1005

            ; Build (CAR . 1005) at 1006 = (CAR (QUOTE (A B C)))
            LD    #3076
            MULS  #4096
            ADD   #1005
            ST    1006

            ; EVAL: expr at 1006
            ; operator = CAR (3076)
            ; args = ((QUOTE (A B C)))
            ; Get quoted value, then take CAR

            ; Load expr cell
            LD    1006
            DIV   #4096
            ST    700         ; operator = 3076 (CAR)

            ; Get args (CDR of expr)
            LD    1006
            ST    701
            DIV   #4096
            MULS  #4096
            ST    702
            LD    701
            SUB   702
            ST    703         ; args = 1005

            ; Get first arg (CAR of args)
            LD    1005
            DIV   #4096
            ST    704         ; first arg = 1004 (QUOTE expr)

            ; Eval first arg: it's (QUOTE (A B C))
            ; CDR of QUOTE expr is args-of-quote
            LD    1004
            ST    705
            DIV   #4096
            MULS  #4096
            ST    706
            LD    705
            SUB   706
            ST    707         ; args-of-quote = 1003

            ; CAR of args-of-quote is the quoted value
            LD    1003
            DIV   #4096
            ST    708         ; quoted value = 1002 = (A B C)

            ; Now take CAR of (A B C)
            LD    1002
            DIV   #4096
            ST    620         ; RESULT = 3072 = atom A

            J     HALT
            HALT: J HALT

            620: #0
            700: #0
            701: #0
            702: #0
            703: #0
            704: #0
            705: #0
            706: #0
            707: #0
            708: #0
        `, cpu => cpu.mem[620] === 3072);  // Result should be atom A = 3072

        // Test: CONS cell packing
        // CONS(3072, 3073) = 3072*4096 + 3073 = 12,585,985
        this.runTest('Lisp: CONS packs CAR|CDR correctly', `
            LD    #3072
            MULS  #4096
            ADD   #3073
            ST    100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === (3072 * 4096 + 3073));  // 12585985

        // Test: CAR extracts high 12 bits
        // Build cell first, then extract CAR
        this.runTest('Lisp: CAR extracts high bits', `
            LD    #3072
            MULS  #4096
            ADD   #3073
            ST    101           ; cell = (3072 . 3073)
            LD    101
            DIV   #4096
            ST    100           ; CAR
            J     #0
            100: #0
            101: #0
        `, cpu => cpu.mem[100] === 3072);

        // Test: CDR extracts low 12 bits
        this.runTest('Lisp: CDR extracts low bits', `
            LD    #3072
            MULS  #4096
            ADD   #3073
            ST    100           ; cell = (3072 . 3073)
            ; CDR = cell - (CAR << 12)
            LD    100
            DIV   #4096
            MULS  #4096
            ST    101           ; CAR << 12
            LD    100
            SUB   101
            ST    102           ; CDR
            J     #0
            100: #0
            101: #0
            102: #0
        `, cpu => cpu.mem[102] === 3073);

        // Test: ATOM? returns T for atoms, NIL for lists
        // atom >= 3072 returns T (4094), list < 3072 returns NIL (4095)
        this.runTest('Lisp: ATOM? returns T for atom', `
            ; Check if 3072 (atom A) is an atom
            LD    #3072
            SUB   #3072         ; x - 3072
            JNN   IS_ATOM       ; if >= 0, it's an atom
            LD    #4095         ; NIL
            J     DONE
            IS_ATOM: LD #4094   ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4094);  // T

        this.runTest('Lisp: ATOM? returns NIL for list', `
            ; Check if 1000 (heap address, a list) is an atom
            LD    #1000
            SUB   #3072         ; x - 3072
            JNN   IS_ATOM       ; if >= 0, it's an atom
            LD    #4095         ; NIL
            J     DONE
            IS_ATOM: LD #4094   ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4095);  // NIL

        // Test: EQ? checks if two atoms are equal
        this.runTest('Lisp: EQ? returns T for equal atoms', `
            LD    #3072
            SUB   #3072         ; A - A = 0
            JZ    EQ_TRUE
            LD    #4095         ; NIL
            J     DONE
            EQ_TRUE: LD #4094   ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4094);  // T

        this.runTest('Lisp: EQ? returns NIL for different atoms', `
            LD    #3072
            SUB   #3073         ; A - B != 0
            JZ    EQ_TRUE
            LD    #4095         ; NIL
            J     DONE
            EQ_TRUE: LD #4094   ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4095);  // NIL

        // Test: NULL? checks if value is NIL
        this.runTest('Lisp: NULL? returns T for NIL', `
            LD    #4095         ; NIL
            SUB   #4095         ; NIL - NIL = 0
            JZ    IS_NIL
            LD    #4095
            J     DONE
            IS_NIL: LD #4094    ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4094);  // T

        this.runTest('Lisp: NULL? returns NIL for non-NIL', `
            LD    #3072         ; atom A
            SUB   #4095         ; A - NIL != 0
            JZ    IS_NIL
            LD    #4095         ; NIL (not null)
            J     DONE
            IS_NIL: LD #4094    ; T
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 4095);  // NIL

        // Test: Simple IF - (IF T A B) -> A
        this.runTest('Lisp: IF with T returns then-branch', `
            ; IF condition is T (4094)
            LD    #4094         ; T (true)
            SUB   #4095         ; cond - NIL
            JZ    ELSE          ; if cond == NIL, go to else
            LD    #3072         ; then-value: A
            J     DONE
            ELSE: LD #3073      ; else-value: B
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 3072);  // A (then-branch)

        this.runTest('Lisp: IF with NIL returns else-branch', `
            ; IF condition is NIL (4095)
            LD    #4095         ; NIL (false)
            SUB   #4095         ; cond - NIL
            JZ    ELSE          ; if cond == NIL, go to else
            LD    #3072         ; then-value: A
            J     DONE
            ELSE: LD #3073      ; else-value: B
            DONE: ST 100
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 3073);  // B (else-branch)

        // Test: CONS allocates and builds cell correctly
        this.runTest('Lisp: CONS with freelist allocator', `
            ; Simple allocator: FREE points to next available address
            ; CONS(A, B) -> allocate cell, store (A . B), return address
            LD    #3072         ; A (CAR)
            MULS  #4096
            ADD   #3073         ; B (CDR)
            ST    1000          ; Store at heap[0]
            LD    #1000         ; Return address of new cell
            ST    100           ; Result = 1000
            J     #0
            100: #0
        `, cpu => cpu.mem[100] === 1000 && cpu.mem[1000] === (3072 * 4096 + 3073));

        // Test: Freelist allocator - multiple CONS operations
        this.runTest('Lisp: Freelist allocator tracks free pointer', `
            ; FREE at 500 points to next available heap cell
            ; Initial: FREE = 1000
            ; After 3 CONS: FREE = 1003

            ; Initialize free pointer
            LD    #1000
            ST    500           ; FREE = 1000

            ; CONS(A, NIL) = (A)
            LD    500           ; Get free pointer
            ST    510           ; Save cell address
            LD    #3072         ; A
            MULS  #4096
            ADD   #4095         ; NIL
            LDR   510
            ST    0,R           ; Store cell at FREE
            LD    500
            ADD   #1
            ST    500           ; FREE++

            ; CONS(B, NIL) = (B)
            LD    500
            ST    511
            LD    #3073         ; B
            MULS  #4096
            ADD   #4095
            LDR   511
            ST    0,R
            LD    500
            ADD   #1
            ST    500           ; FREE++

            ; CONS(C, NIL) = (C)
            LD    500
            ST    512
            LD    #3074         ; C
            MULS  #4096
            ADD   #4095
            LDR   512
            ST    0,R
            LD    500
            ADD   #1
            ST    500           ; FREE++

            ; Store final FREE value
            LD    500
            ST    100
            J     #0
            100: #0
            500: #0
            510: #0
            511: #0
            512: #0
        `, cpu => cpu.mem[100] === 1003);  // FREE incremented 3 times

        // Test: Build and traverse (A B C) list
        this.runTest('Lisp: Build and traverse list (A B C)', `
            ; Build (A B C) = (A . (B . (C . NIL)))
            ; Then traverse and collect CAR values

            ; Build (C . NIL) at 1000
            LD    #3074
            MULS  #4096
            ADD   #4095
            ST    1000

            ; Build (B . 1000) at 1001
            LD    #3073
            MULS  #4096
            ADD   #1000
            ST    1001

            ; Build (A . 1001) at 1002
            LD    #3072
            MULS  #4096
            ADD   #1001
            ST    1002

            ; Traverse: get CAR of each cell
            ; ptr = 1002
            LD    #1002
            ST    600           ; ptr

            ; First element (CAR of 1002) -> A
            LDR   600
            LD    0,R           ; Load cell at ptr
            DIV   #4096         ; CAR
            ST    610           ; first = A

            ; Advance: CDR
            LDR   600
            LD    0,R
            ST    601
            DIV   #4096
            MULS  #4096
            ST    602
            LD    601
            SUB   602
            ST    600           ; ptr = CDR = 1001

            ; Second element (CAR of 1001) -> B
            LDR   600
            LD    0,R
            DIV   #4096
            ST    611           ; second = B

            ; Advance: CDR
            LDR   600
            LD    0,R
            ST    601
            DIV   #4096
            MULS  #4096
            ST    602
            LD    601
            SUB   602
            ST    600           ; ptr = CDR = 1000

            ; Third element (CAR of 1000) -> C
            LDR   600
            LD    0,R
            DIV   #4096
            ST    612           ; third = C

            J     HALT
            HALT: J HALT
            600: #0
            601: #0
            602: #0
            610: #0
            611: #0
            612: #0
        `, cpu => cpu.mem[610] === 3072 && cpu.mem[611] === 3073 && cpu.mem[612] === 3074);

        // Test: Reference counting basics (3-bit count as in historical implementation)
        // Cell format: [CAR:12bits | CDR:12bits] - no room for refcount in 24-bit word
        // Alternative: store refcount in separate table or use first 3 bits of CAR
        // Here we test the concept with a separate refcount array
        this.runTest('Lisp: Reference counting increment/decrement', `
            ; REFCNT table at 800, heap at 1000
            ; When CONS creates cell at addr N, set REFCNT[N-1000] = 1
            ; When ref removed, decrement; when 0, add to freelist

            ; Create cell at 1000 with refcount = 1
            LD    #3072
            MULS  #4096
            ADD   #3073
            ST    1000          ; Cell at 1000

            LD    #1
            ST    800           ; REFCNT[0] = 1

            ; Increment reference (another pointer to this cell)
            LD    800
            ADD   #1
            ST    800           ; REFCNT[0] = 2

            ; Decrement reference (pointer removed)
            LD    800
            SUB   #1
            ST    800           ; REFCNT[0] = 1

            ; Store results
            LD    800
            ST    100           ; Final refcount
            J     #0
            100: #0
            800: #0
        `, cpu => cpu.mem[100] === 1);  // Refcount = 1

        // Test: 3-bit refcount overflow detection (historical limitation)
        // Max count = 7 (3 bits), any value >= 7 stays at 7
        // Demonstrates the "sticky" refcount that caused memory leaks
        this.runTest('Lisp: 3-bit refcount capped at 7', `
            ; Simple test: just check that we can cap a value at 7
            ; Load 10, if >= 7, return 7, else return value
            LD    #10           ; Test value (> 7)
            SUB   #7            ; value - 7
            JN    UNDER         ; If negative (< 7), use original
            LD    #7            ; Saturate at 7
            J     DONE
            UNDER: LD #10       ; Original value
            DONE: ST 100
            J     HALT
            HALT: J HALT
            100: #0
        `, cpu => cpu.mem[100] === 7);  // 10 > 7, so result = 7

        // Additional test showing value under threshold passes through
        this.runTest('Lisp: 3-bit refcount passes under-7 values', `
            LD    #5            ; Test value (< 7)
            SUB   #7            ; value - 7 = -2 (negative)
            JN    UNDER         ; Negative, so go to UNDER
            LD    #7
            J     DONE
            UNDER: LD #5        ; Return original value
            DONE: ST 100
            J     HALT
            HALT: J HALT
            100: #0
        `, cpu => cpu.mem[100] === 5);  // 5 < 7, so result = 5

        // Test: Environment lookup - binding a variable
        // ENV format: ((name . value) . rest)
        // ASSOC(name, env) finds value for name
        this.runTest('Lisp: ASSOC finds variable in environment', `
            ; Build environment: ((A . 42))
            ; A = 3072, 42 is just a value

            ; First build the pair (A . 42)
            LD    #3072         ; A
            MULS  #4096
            ADD   #42           ; value
            ST    1000          ; Cell 1000 = (A . 42)

            ; Build env: ((A . 42) . NIL)
            LD    #1000         ; ptr to (A . 42)
            MULS  #4096
            ADD   #4095         ; NIL
            ST    1001          ; Cell 1001 = env

            ; ASSOC(A, env):
            ; Loop through env, compare CAR of each pair with target

            ; Get first pair from env
            LD    1001          ; env cell
            DIV   #4096         ; CAR = first pair (1000)
            ST    700           ; pair ptr

            ; Get key from pair (CAR of pair)
            LDR   700
            LD    0,R           ; Load pair cell
            DIV   #4096         ; CAR = key
            ST    701           ; key = A (3072)

            ; Compare with target
            LD    701
            SUB   #3072         ; key - target
            JNZ   NOT_FOUND     ; If not equal, key not found

            ; Found! Get value (CDR of pair)
            LDR   700
            LD    0,R           ; Load pair cell
            ST    702
            DIV   #4096
            MULS  #4096
            ST    703
            LD    702
            SUB   703
            ST    100           ; Result = value (42)
            J     DONE

            NOT_FOUND: LD #4095 ; NIL
            ST    100
            DONE: J HALT
            HALT: J HALT
            100: #0
            700: #0
            701: #0
            702: #0
            703: #0
        `, cpu => cpu.mem[100] === 42);

        // Test: Simple function representation
        // (LAMBDA (X) X) represented as (LAMBDA . ((X) . X))
        // LAMBDA = 3081, X = 3100
        this.runTest('Lisp: LAMBDA cell structure', `
            ; Build (LAMBDA (X) X)
            ; LAMBDA = 3081, X = 3100

            ; Build param list (X) = (X . NIL)
            LD    #3100         ; X
            MULS  #4096
            ADD   #4095         ; NIL
            ST    1000          ; Cell 1000 = (X)

            ; Build body X (just the atom)
            ; Body is just X (atom 3100)

            ; Build ((X) . X) = params . body
            LD    #1000         ; ptr to (X)
            MULS  #4096
            ADD   #3100         ; body X
            ST    1001          ; Cell 1001 = ((X) . X)

            ; Build (LAMBDA . ((X) . X))
            LD    #3081         ; LAMBDA
            MULS  #4096
            ADD   #1001         ; ptr to ((X) . X)
            ST    1002          ; Cell 1002 = (LAMBDA (X) X)

            ; Verify structure: CAR of cell 1002 = LAMBDA (3081)
            LD    1002
            DIV   #4096
            ST    100           ; Should be 3081

            ; CDR of cell 1002 = ptr to params/body
            LD    1002
            ST    700
            DIV   #4096
            MULS  #4096
            ST    701
            LD    700
            SUB   701
            ST    101           ; Should be 1001

            ; CAR of cell 1001 = params = 1000
            LD    1001
            DIV   #4096
            ST    102           ; Should be 1000

            J     HALT
            HALT: J HALT
            100: #0
            101: #0
            102: #0
            700: #0
            701: #0
        `, cpu => cpu.mem[100] === 3081 && cpu.mem[101] === 1001 && cpu.mem[102] === 1000);

        // Test: Apply identity function ((LAMBDA (X) X) A) -> A
        // This is the core of function application:
        // 1. Get function (LAMBDA (X) X)
        // 2. Get argument A
        // 3. Bind X to A in environment
        // 4. Evaluate body X in that environment
        this.runTest('Lisp: Apply identity function', `
            ; Build and apply ((LAMBDA (X) X) A)
            ; Expected result: A (3072)

            ; Build (X) param list
            LD    #3100         ; X
            MULS  #4096
            ADD   #4095         ; NIL
            ST    1000          ; (X)

            ; Build ((X) . X) params/body
            LD    #1000
            MULS  #4096
            ADD   #3100         ; body X
            ST    1001          ; ((X) . X)

            ; Build (LAMBDA . ((X) . X))
            LD    #3081         ; LAMBDA
            MULS  #4096
            ADD   #1001
            ST    1002          ; fn = (LAMBDA (X) X)

            ; Argument is A (3072)
            ; Build environment: ((X . A))
            LD    #3100         ; X
            MULS  #4096
            ADD   #3072         ; A
            ST    1003          ; (X . A)

            ; Build env list
            LD    #1003
            MULS  #4096
            ADD   #4095
            ST    1004          ; env = ((X . A))

            ; Now evaluate body X in env
            ; Body = X (atom 3100)
            ; Look up X in env

            ; Get first binding from env
            LD    1004          ; env
            DIV   #4096         ; CAR = first binding (1003)
            ST    700           ; binding ptr

            ; Get key from binding
            LDR   700
            LD    0,R
            DIV   #4096
            ST    701           ; key = X (3100)

            ; Compare with body (X = 3100)
            LD    701
            SUB   #3100         ; key - X
            JNZ   NOT_FOUND     ; Not found (shouldn't happen)

            ; Found! Get value (CDR of binding)
            LDR   700
            LD    0,R
            ST    702
            DIV   #4096
            MULS  #4096
            ST    703
            LD    702
            SUB   703
            ST    100           ; Result = A (3072)
            J     DONE

            NOT_FOUND: LD #4095
            ST    100
            DONE: J HALT
            HALT: J HALT
            100: #0
            700: #0
            701: #0
            702: #0
            703: #0
        `, cpu => cpu.mem[100] === 3072);  // Result = A

        // Test: Apply function with arithmetic ((LAMBDA (X) (CAR X)) (QUOTE (A B)))
        // Shows that function bodies can be complex expressions
        // We simplify: just test binding works with list value
        this.runTest('Lisp: Function binding with list argument', `
            ; Apply function that returns its argument unchanged
            ; Build (A B) first
            LD    #3073         ; B
            MULS  #4096
            ADD   #4095         ; NIL
            ST    1000          ; (B)

            LD    #3072         ; A
            MULS  #4096
            ADD   #1000
            ST    1001          ; (A B)

            ; Bind X to (A B) in environment
            ; Build (X . 1001) where 1001 is ptr to (A B)
            LD    #3100         ; X
            MULS  #4096
            ADD   #1001         ; ptr to (A B)
            ST    1002          ; (X . (A B))

            ; Build env
            LD    #1002
            MULS  #4096
            ADD   #4095
            ST    1003          ; env = ((X . (A B)))

            ; Look up X, should get 1001 (ptr to (A B))
            LD    1003
            DIV   #4096         ; first binding
            ST    700

            LDR   700
            LD    0,R
            DIV   #4096
            ST    701           ; key = X

            LD    701
            SUB   #3100
            JNZ   ERROR

            ; Get value
            LDR   700
            LD    0,R
            ST    702
            DIV   #4096
            MULS  #4096
            ST    703
            LD    702
            SUB   703
            ST    100           ; Should be 1001 (ptr to (A B))

            ; Now verify we can CAR this to get A
            LDR   100
            LD    0,R
            DIV   #4096
            ST    101           ; CAR of (A B) = A

            J     DONE
            ERROR: LD #4095
            ST    100
            LD    #4095
            ST    101
            DONE: J HALT
            HALT: J HALT
            100: #0
            101: #0
            700: #0
            701: #0
            702: #0
            703: #0
        `, cpu => cpu.mem[100] === 1001 && cpu.mem[101] === 3072);  // Ptr to list, and CAR = A
    },

    // =========================================================================
    // Run All Tests
    // =========================================================================
    runAll() {
        this.results = [];

        this.testCorePrimitives();
        this.testBasicArithmetic();
        this.testConditionFlags();
        this.testAddressingModes();
        this.testJumps();
        this.testLogic();
        this.testShifts();
        this.testRegisterTransfers();
        this.testMemoryOps();
        this.testMulDiv();
        this.testIntegration();
        this.testLisp();

        return this.results;
    },

    /**
     * Get summary statistics
     */
    getSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        const categories = {};

        for (const r of this.results) {
            if (!categories[r.category]) {
                categories[r.category] = { total: 0, passed: 0 };
            }
            categories[r.category].total++;
            if (r.passed) categories[r.category].passed++;
        }

        return { total, passed, failed, categories };
    },

    /**
     * Get failed tests only
     */
    getFailures() {
        return this.results.filter(r => !r.passed);
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E4130Tests };
}
