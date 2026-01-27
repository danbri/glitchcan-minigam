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
        `, cpu => cpu.mem[5] === 2);

        this.runTest('ADD 5+3=8', `
            LD A
            ADD B
            ST R
            J #0
            A: #5
            B: #3
            R: #0
        `, cpu => cpu.mem[5] === 8);

        this.runTest('ADD 0+0=0', `
            LD A
            ADD B
            ST R
            J #0
            A: #0
            B: #0
            R: #0
        `, cpu => cpu.mem[5] === 0);

        this.runTest('ADD with literal #n', `
            LD A
            ADD #10
            ST R
            J #0
            A: #5
            R: #0
        `, cpu => cpu.mem[4] === 15);

        this.runTest('ADD negative numbers', `
            LD A
            ADD B
            ST R
            J #0
            A: $77777777
            B: $77777777
            R: #0
        `, cpu => cpu.mem[5] === (0xFFFFFE & 0xFFFFFF));

        this.runTest('ADD pos + neg = pos', `
            LD A
            ADD B
            ST R
            J #0
            A: #10
            B: $77777777
            R: #0
        `, cpu => cpu.mem[5] === 9);

        // SUB - Subtraction
        this.runTest('SUB 5-3=2', `
            LD A
            SUB B
            ST R
            J #0
            A: #5
            B: #3
            R: #0
        `, cpu => cpu.mem[5] === 2);

        this.runTest('SUB 10-3=7', `
            LD A
            SUB B
            ST R
            J #0
            A: #10
            B: #3
            R: #0
        `, cpu => cpu.mem[5] === 7);

        this.runTest('SUB 3-5=-2', `
            LD A
            SUB B
            ST R
            J #0
            A: #3
            B: #5
            R: #0
        `, cpu => cpu.sx(cpu.mem[5]) === -2);

        this.runTest('SUB 0-1=-1', `
            LD A
            SUB B
            ST R
            J #0
            A: #0
            B: #1
            R: #0
        `, cpu => cpu.sx(cpu.mem[5]) === -1);

        // NADD - Negative add (operand - M)
        this.runTest('NADD 10-3=7', `
            LD A
            NADD B
            ST R
            J #0
            A: #3
            B: #10
            R: #0
        `, cpu => cpu.mem[5] === 7);

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
        `, cpu => cpu.mem[5] === 15);

        this.runTest('SUBR R-[n]', `
            LDR A
            SUBR B
            STR R
            J #0
            A: #10
            B: #3
            R: #0
        `, cpu => cpu.mem[5] === 7);
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
        `, cpu => cpu.mem[10] === 1);

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
        this.runTest('DKJN loop 3 iterations', `
            LD ZERO
            LDK CNT
            LOOP: ADD ONE
            DKJN LOOP
            ST RES
            J #0
            ZERO: #0
            CNT: #3
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[9] === 3);

        this.runTest('DKJN loop 5 iterations', `
            LD ZERO
            LDK CNT
            LOOP: ADD ONE
            DKJN LOOP
            ST RES
            J #0
            ZERO: #0
            CNT: #5
            ONE: #1
            RES: #0
        `, cpu => cpu.mem[9] === 5);
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
        `, cpu => cpu.mem[5] === 0o17);

        this.runTest('AND all bits', `
            LD A
            AND B
            ST RES
            J #0
            A: $77777777
            B: $77777777
            RES: #0
        `, cpu => cpu.mem[5] === 0xFFFFFF);

        this.runTest('AND clear all', `
            LD A
            AND B
            ST RES
            J #0
            A: $77777777
            B: #0
            RES: #99
        `, cpu => cpu.mem[5] === 0);

        this.runTest('ANDN complement mask', `
            LD A
            ANDN B
            ST RES
            J #0
            A: $77
            B: $70
            RES: #0
        `, cpu => cpu.mem[5] === 0o07);
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
        `, cpu => cpu.mem[5] === 2);

        this.runTest('SML shift M left by 4', `
            LD VAL
            LDK CNT
            SML
            ST RES
            J #0
            VAL: #1
            CNT: #4
            RES: #0
        `, cpu => cpu.mem[5] === 16);

        this.runTest('SMR shift M right by 1', `
            LD VAL
            LDK CNT
            SMR
            ST RES
            J #0
            VAL: #16
            CNT: #1
            RES: #0
        `, cpu => cpu.mem[5] === 8);

        this.runTest('SMR sign extends', `
            LD VAL
            LDK CNT
            SMR
            ST RES
            J #0
            VAL: $77777777
            CNT: #4
            RES: #0
        `, cpu => cpu.sx(cpu.mem[5]) === -1);

        this.runTest('SMRL logical shift right', `
            LD VAL
            LDK CNT
            SMRL
            ST RES
            J #0
            VAL: $77777777
            CNT: #4
            RES: #0
        `, cpu => cpu.mem[5] === 0x0FFFFF);

        this.runTest('SRL shift R left', `
            LDR VAL
            LDK CNT
            SRL
            STR RES
            J #0
            VAL: #3
            CNT: #2
            RES: #0
        `, cpu => cpu.mem[5] === 12);
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
            LD VAL
            MTOK
            LD ZERO
            LDK CNT
            LOOP: ADD ONE
            DKJN LOOP
            ST RES
            J #0
            VAL: #4
            ZERO: #0
            ONE: #1
            CNT: #0
            RES: #0
        `, cpu => cpu.mem[10] === 4);
    },

    // =========================================================================
    // Category 9: Memory Operations
    // =========================================================================
    testMemoryOps() {
        this.currentCategory = '9. Memory Operations';

        this.runTest('INCS increment memory', `
            INCS A
            LD A
            ST RES
            J #0
            A: #10
            RES: #0
        `, cpu => cpu.mem[4] === 11);

        this.runTest('DECS decrement memory', `
            DECS A
            LD A
            ST RES
            J #0
            A: #10
            RES: #0
        `, cpu => cpu.mem[4] === 9);

        this.runTest('ADDS add to memory', `
            LD VAL
            ADDS A
            LD A
            ST RES
            J #0
            VAL: #5
            A: #10
            RES: #0
        `, cpu => cpu.mem[5] === 15);

        this.runTest('SUBS subtract from memory', `
            LD VAL
            SUBS A
            LD A
            ST RES
            J #0
            VAL: #3
            A: #10
            RES: #0
        `, cpu => cpu.mem[5] === 7);

        this.runTest('CLS clear memory', `
            CLS A
            LD A
            ST RES
            J #0
            A: #999
            RES: #1
        `, cpu => cpu.mem[4] === 0);

        this.runTest('NEGS negate memory', `
            NEGS A
            LD A
            ST RES
            J #0
            A: #5
            RES: #0
        `, cpu => cpu.sx(cpu.mem[4]) === -5);

        this.runTest('EXC exchange M with memory', `
            LD MVAL
            EXC A
            ST OLDM
            LD A
            ST NEWA
            J #0
            MVAL: #42
            A: #99
            OLDM: #0
            NEWA: #0
        `, cpu => cpu.mem[6] === 99 && cpu.mem[7] === 42);
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
        `, cpu => cpu.mem[5] === 42);

        this.runTest('MULS 10*10=100', `
            LD A
            MULS B
            ST RES
            J #0
            A: #10
            B: #10
            RES: #0
        `, cpu => cpu.mem[5] === 100);

        this.runTest('MULS negative result', `
            LD A
            MULS B
            ST RES
            J #0
            A: #5
            B: $77777777
            RES: #0
        `, cpu => cpu.sx(cpu.mem[5]) === -5);

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
        `, cpu => cpu.mem[5] === 3 && cpu.mem[6] === 2);

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
        `, cpu => cpu.mem[5] === 10 && cpu.mem[6] === 0);

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
        `, cpu => cpu.mem[5] === 2 && cpu.mem[6] === 1);
    },

    // =========================================================================
    // Category 11: Integration Tests
    // =========================================================================
    testIntegration() {
        this.currentCategory = '11. Integration Tests';

        // Sum 1 to 10
        this.runTest('Sum 1 to 10 = 55', `
            LD ZERO
            LDK CNT
            LOOP: ADD ONE
            ADDS SUM
            DKJN LOOP
            LD SUM
            ST RES
            J #0
            ZERO: #0
            CNT: #10
            ONE: #1
            SUM: #0
            RES: #0
        `, cpu => cpu.mem[10] === 55);

        // Factorial 5
        this.runTest('Factorial 5 = 120', `
            LD ONE
            ST RES
            LDK N
            LOOP: LD RES
            MULS CTR
            ST RES
            DECS CTR
            DKJN LOOP
            J #0
            ONE: #1
            N: #4
            CTR: #5
            RES: #0
        `, cpu => cpu.mem[9] === 120);

        // Fibonacci sequence (8th number)
        this.runTest('Fibonacci 8 = 21', `
            LD ONE
            ST A
            ST B
            LDK CNT
            LOOP: LD A
            ADD B
            EXC A
            EXC B
            DKJN LOOP
            LD A
            ST RES
            J #0
            ONE: #1
            CNT: #6
            A: #0
            B: #0
            RES: #0
        `, cpu => cpu.mem[10] === 21);

        // Memory copy using modified addressing
        this.runTest('Memory copy with R index', `
            LDR ZERO
            LDK CNT
            LOOP: LD SRC,R
            ST DST,R
            ADDR ONE
            DKJN LOOP
            LD 20
            ST RES
            J #0
            ZERO: #0
            ONE: #1
            CNT: #3
            10: #111
            11: #222
            12: #333
            SRC: #10
            DST: #20
            RES: #0
        `, cpu => cpu.mem[20] === 111 && cpu.mem[21] === 222 && cpu.mem[22] === 333);
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
