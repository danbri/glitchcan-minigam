// Tests for the LISP-on-Elliott subproject (lisp4130.asm + cli.mjs).
//
// These exercise the LISP image as deployed via cli.mjs - i.e. the same
// configuration a user would run. We do NOT modify the Elliott emulator
// (CPU core, assembler) to make these pass; if a test is failing we fix
// lisp4130.asm or cli.mjs only.
//
// Test sections:
//   1. Banner / sanity        - the image starts and prints LISP
//   2. Reader EOF             - tape running out cleanly terminates the REPL
//   3. Atom evaluation        - unbound atoms evaluate to NIL
//   4. Symbol printing        - PRINT renders a symbol atom as its letter
//   5. Built-in primitives    - QUOTE, CAR, CDR on small inputs

import { assemble, run } from '../cli.mjs';
import { E4130 } from '../elliott4130-core.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASM_PATH = resolve(HERE, '..', 'lisp4130.asm');

// Build a label -> word-address map by re-walking the asm with the same
// rules the assembler uses. Used by tests that need to inspect named
// state vars in CPU memory at a specific point in execution.
const labelTable = (() => {
    const src = readFileSync(ASM_PATH, 'utf8');
    const lines = src.split('\n');
    let addr = 0;
    const lbl = {};
    for (const line of lines) {
        const t = line.split(';')[0].trim();
        const m = t.match(/^([A-Za-z_]\w*):/);
        if (m) lbl[m[1]] = addr;
        const rest = t.replace(/^\d+:|^[A-Za-z_]\w*:/, '').trim();
        if (rest) addr++;
    }
    return lbl;
})();

function lookupLabel(name) {
    if (!(name in labelTable)) throw new Error(`unknown label ${name}`);
    return labelTable[name];
}

// Run the image until the CPU first reaches the word address of `label`,
// then invoke `check(cpu)` with the live CPU state. Stops at maxSteps
// otherwise. Used for tests that inspect intermediate state (e.g. heap
// cells right after RD_REV_DONE).
function runUntilLabelAndCheck(code, tape, label, check, maxSteps = 500_000) {
    const target = lookupLabel(label);
    const cpu = new E4130();
    cpu.reset();
    cpu.halted = false;
    for (const { addr, word } of code) cpu.mem[addr] = word;
    cpu.S = 0;
    if (tape) {
        const bytes = new Uint8Array(tape.length);
        for (let i = 0; i < tape.length; i++) bytes[i] = tape.charCodeAt(i) & 0xFF;
        cpu.loadTape(bytes);
    }
    let steps = 0;
    while (!cpu.halted && steps < maxSteps) {
        if ((cpu.S >> 1) === target) {
            check(cpu);
            return;
        }
        cpu.step();
        steps++;
        // Service TR/CH traps (silently) so the LISP doesn't hang on banner.
        if (cpu.S === 252 || cpu.S === 254) {
            const link = cpu.mem[2] & 0xFFFFFF;
            cpu.S = link & 0x1FFFF;
            cpu.C = (cpu.C & 0x01FFFF) | ((link >> 17 & 0x7F) << 17);
        }
    }
    throw new Error(`label ${label} not reached within ${maxSteps} steps`);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  ${e.message}`);
        failed++;
    }
}

function assertContains(haystack, needle, msg) {
    if (!haystack.includes(needle)) {
        throw new Error(`${msg}: expected output to contain ${JSON.stringify(needle)}, got ${JSON.stringify(haystack)}`);
    }
}

function assertNotContains(haystack, needle, msg) {
    if (haystack.includes(needle)) {
        throw new Error(`${msg}: did not expect output to contain ${JSON.stringify(needle)}, got ${JSON.stringify(haystack)}`);
    }
}

function assertTerminated(result, msg) {
    if (result.hitMaxSteps) {
        throw new Error(`${msg}: emulator hit max steps (still spinning), output=${JSON.stringify(result.output)}`);
    }
    if (result.error) {
        throw new Error(`${msg}: emulator errored: ${result.error}, output=${JSON.stringify(result.output)}`);
    }
}

// Strip the LISP banner so we can examine just the program output. PRINT
// emits each result followed by a newline; the banner is "LISP\n".
function programOutput(text) {
    const lines = text.split('\n');
    const banner = lines.indexOf('LISP');
    return banner >= 0 ? lines.slice(banner + 1).join('\n') : text;
}

const code = assemble(ASM_PATH);

// ---------------------------------------------------------------- 1. Sanity
console.log('\n--- 1. Banner / sanity ---');

test('lisp4130.asm assembles to ~1000+ words with no errors', () => {
    if (code.length < 1000) throw new Error(`expected >=1000 words, got ${code.length}`);
});

test('HEAP base is past the end of assembled code (no code/heap collision)', () => {
    // Bug-class regression test: the original LISP image set HEAP=1000.
    // As we added code (Bug D keyword recognition) the assembled image grew
    // past 1000 words, so the cons heap started overwriting the reader's
    // own instructions. Pin HEAP base above the highest assembled address.
    const maxAddr = code.reduce((m, c) => c.addr > m ? c.addr : m, 0);
    // Find the LD #N immediately before ST HEAP in the assembled stream
    // by re-reading the source - cheap and avoids exposing labels.
    const src = readFileSync(ASM_PATH, 'utf8');
    const m = src.match(/LD\s+#(\d+)\s*(?:;[^\n]*)?\s*\n\s*ST\s+HEAP/);
    if (!m) throw new Error('could not find HEAP initialiser in lisp4130.asm');
    const heapBase = parseInt(m[1], 10);
    if (heapBase <= maxAddr) {
        throw new Error(`HEAP base ${heapBase} <= max code addr ${maxAddr} - cons cells will corrupt instructions`);
    }
});

test('Banner: LISP appears on stdout', () => {
    const r = run(code, '\n', 200_000);
    assertContains(r.output, 'LISP', 'banner');
});

// --------------------------------------------------------------- 2. EOF
console.log('\n--- 2. Reader EOF ---');

test('Empty tape: REPL reads EOF and stops without spinning', () => {
    const r = run(code, '', 200_000);
    assertTerminated(r, 'empty tape should not spin');
});

test('Tape with only whitespace: REPL stops without spinning', () => {
    const r = run(code, '   \n', 200_000);
    assertTerminated(r, 'whitespace tape should not spin');
});

test('Tape ends mid-atom (no trailing newline): reader treats EOF as delimiter', () => {
    // The atom A is followed immediately by EOF. RD_ATOM_LOOP must accept
    // EOF as a token-ending condition or it spins forever.
    const r = run(code, 'A', 200_000);
    assertTerminated(r, 'mid-atom EOF');
    assertContains(r.output, 'LISP', 'banner');
});

// --------------------------------------------------------------- 3. Atoms
console.log('\n--- 3. Atom evaluation ---');

test('Unbound atom A evaluates to NIL', () => {
    const r = run(code, 'A\n', 200_000);
    assertTerminated(r, 'A evaluation');
    assertContains(r.output, 'NIL', 'unbound A');
});

test('Bare NIL evaluates to NIL (and prints NIL)', () => {
    const r = run(code, 'NIL\n', 200_000);
    assertTerminated(r, 'NIL evaluation');
    const out = programOutput(r.output);
    assertContains(out, 'NIL', 'NIL output');
});

test('Bare T self-evaluates to T (Bug B fix: reader maps "T" to atom 4094)', () => {
    const r = run(code, 'T\n', 200_000);
    assertTerminated(r, 'T evaluation');
    const out = programOutput(r.output);
    assertContains(out, 'T', 'T output');
    // If the reader still maps T to atom 3019, EVAL returns NIL via the
    // unbound-atom fallback - reject that outcome.
    assertNotContains(out, 'NIL', 'T must not collapse to NIL');
});

// -------------------------------------------------- 4. List reading
//
// Bug A is fixed at the asm level (RD_LIST_DONE now reverses the list
// in place using fresh state vars RD_REV_NEW/OLD/NEXT/TMP). We assert
// the reader's behaviour up to the cons-cell layout, but cannot yet
// assert end-to-end output of `(QUOTE A)` etc - see Bugs D and E below.
console.log('\n--- 4. List reading ---');

test('Reader builds (A) as a one-cell list (Bug A fix verified by direct memory read)', () => {
    // Run the LISP image and stop right after RD_LIST_DONE finishes its
    // reverse pass. Confirm the head cell is (A . NIL) at HEAP[0].
    // We do this rather than testing PRINT output because PRINT requires
    // EVAL to have run - and EVAL is currently unreachable (Bug E).
    //
    // We import the emulator directly here for fine-grained control.
    return runUntilLabelAndCheck(code, '(A)\n', 'RD_REV_DONE', cpu => {
        // RD_REV_NEW holds the reversed list head; HEAP base is set in
        // lisp4130.asm START. We accept whatever HEAP base the image uses
        // (currently 2000, was 1000) by reading the head pointer directly.
        const head = cpu.mem[lookupLabel('RD_REV_NEW')];
        const cell = cpu.mem[head];
        const car = (cell >> 12) & 0xFFF;
        const cdr = cell & 0xFFF;
        if (car !== 3000) throw new Error(`expected CAR=3000 (atom A), got ${car}`);
        if (cdr !== 4095) throw new Error(`expected CDR=4095 (NIL), got ${cdr}`);
    });
});

test('Reader builds (A B) in correct order (Bug A: A before B, not reversed)', () => {
    return runUntilLabelAndCheck(code, '(A B)\n', 'RD_REV_DONE', cpu => {
        const head = cpu.mem[lookupLabel('RD_REV_NEW')];
        const cell0 = cpu.mem[head];
        const car0 = (cell0 >> 12) & 0xFFF;
        const cdr0 = cell0 & 0xFFF;
        if (car0 !== 3000) throw new Error(`expected first CAR=A=3000, got ${car0}`);
        const cell1 = cpu.mem[cdr0];
        const car1 = (cell1 >> 12) & 0xFFF;
        const cdr1 = cell1 & 0xFFF;
        if (car1 !== 3001) throw new Error(`expected second CAR=B=3001, got ${car1}`);
        if (cdr1 !== 4095) throw new Error(`expected second CDR=NIL=4095, got ${cdr1}`);
    });
});

// ---------------- 4b. Keyword recognition (Bug D)
//
// The reader packs the first two characters of an atom name to recognise
// a small set of canonical keywords:
//   QUOTE -> 4000   CAR -> 4001   CDR -> 4002
// Single-letter atoms Q and C are still 3016 and 3002 respectively.
// We verify by running until RD_RET (when RESULT has been set by the
// keyword classifier) and reading RESULT directly.

const RESULT_ADDR = lookupLabel('RESULT');

function readsAsAtom(tape, expectedCode) {
    return runUntilLabelAndCheck(code, tape, 'RD_RET', cpu => {
        const got = cpu.mem[RESULT_ADDR];
        if (got !== expectedCode) {
            throw new Error(`reading ${JSON.stringify(tape)} expected RESULT=${expectedCode}, got ${got}`);
        }
    });
}

test('Bug D fix: QUOTE reads as keyword 4000 (not letter Q=3016)', () => readsAsAtom('QUOTE\n', 4000));
test('Bug D fix: CAR reads as keyword 4001 (not letter C=3002)', () => readsAsAtom('CAR\n', 4001));
test('Bug D fix: CDR reads as keyword 4002', () => readsAsAtom('CDR\n', 4002));
test('Bug D fix: single letter Q still reads as 3016 (atom Q)', () => readsAsAtom('Q\n', 3016));
test('Bug D fix: single letter C still reads as 3002 (atom C)', () => readsAsAtom('C\n', 3002));

// ---------------- 4b1. End-to-end EVAL over the QUOTE/CAR/CDR primitives
//
// These exercise the full READ → EVAL → PRINT pipeline. They were
// unreachable before the Bug E fixes (READ corrupted itself; EVAL and
// PRINT corrupted their caller links on recursion) and the cli.mjs
// trap-detection fix (which had been spuriously hijacking S=252 every
// time PR_LIST_LOOP fell through its NIL-check).
function evalsTo(tape, expected) {
    const r = run(code, tape + '\n', 500_000);
    assertTerminated(r, 'REPL on ' + JSON.stringify(tape) + ' should terminate');
    const out = programOutput(r.output).replace(/END\s*$/, '').trim();
    if (out !== expected) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(out)}`);
    }
}

test('EVAL: (QUOTE A) -> A', () => evalsTo('(QUOTE A)', 'A'));
test('EVAL: (QUOTE (A B C)) -> (A B C)', () => evalsTo('(QUOTE (A B C))', '(A B C)'));
test('EVAL: (CAR (QUOTE (A B))) -> A', () => evalsTo('(CAR (QUOTE (A B)))', 'A'));
test('EVAL: (CDR (QUOTE (A B C))) -> (B C)', () => evalsTo('(CDR (QUOTE (A B C)))', '(B C)'));
test('EVAL: (CAR (CDR (QUOTE (A B C)))) -> B', () => evalsTo('(CAR (CDR (QUOTE (A B C))))', 'B'));
test('EVAL: (CADR (QUOTE (A B C))) -> B', () => evalsTo('(CADR (QUOTE (A B C)))', 'B'));
test('EVAL: (CADDR (QUOTE (A B C D))) -> C', () => evalsTo('(CADDR (QUOTE (A B C D)))', 'C'));
test('EVAL: (ATOM (QUOTE A)) -> T', () => evalsTo('(ATOM (QUOTE A))', 'T'));
test('EVAL: (ATOM (QUOTE (A B))) -> NIL', () => evalsTo('(ATOM (QUOTE (A B)))', 'NIL'));
test('EVAL: (EQ (QUOTE A) (QUOTE A)) -> T', () => evalsTo('(EQ (QUOTE A) (QUOTE A))', 'T'));
test('EVAL: (EQ (QUOTE A) (QUOTE B)) -> NIL', () => evalsTo('(EQ (QUOTE A) (QUOTE B))', 'NIL'));
test('EVAL: (CONS (QUOTE A) (QUOTE (B C))) -> (A B C)', () => evalsTo('(CONS (QUOTE A) (QUOTE (B C)))', '(A B C)'));
test('EVAL: (NULL (QUOTE NIL)) -> T', () => evalsTo('(NULL (QUOTE NIL))', 'T'));
test('EVAL: (NULL (QUOTE A)) -> NIL', () => evalsTo('(NULL (QUOTE A))', 'NIL'));
test('Reader: lowercase input is folded to uppercase ((quote a) -> A)', () => evalsTo('(quote a)', 'A'));
test('Reader: digit-only input parses as number ("100" -> 100)', () => evalsTo('100', '100'));
test('Reader: 3-digit number ("999" -> 999)', () => evalsTo('999', '999'));
test('Reader: single digit ("7" -> 7)', () => evalsTo('7', '7'));

// ---------------- 4c. Re-entrant READ via SP stack (Bug E)
//
// READ recurses through RD_LIST_LOOP (each list element) and through
// RD_QUOTE. Before the fix, the caller link was kept in a single global
// RD_LINK, so the inner READ overwrote the outer caller's return
// address - the top-level READ returned not to REPL but to the inner
// caller, sending the program into an infinite loop. The fix pushes
// the JFL link onto the SP stack on entry and pops it on RD_RET.

test('Bug E fix: REPL terminates after reading (A B) (would spin pre-fix)', () => {
    const r = run(code, '(A B)\n', 500_000);
    assertTerminated(r, 'REPL on (A B) should terminate cleanly');
});

test('Bug E fix: nested list (QUOTE ((A) (B C))) round-trips through PRINT', () => {
    // The bare input ((A) (B C)) is a malformed program (tries to apply
    // (A) as a lambda) and EVAL has no error path for that, so wrapping
    // in QUOTE is what makes this a READ+PRINT correctness test rather
    // than an EVAL semantics test.
    const r = run(code, '(QUOTE ((A) (B C)))\n', 1_000_000);
    assertTerminated(r, 'REPL on (QUOTE ((A) (B C))) should terminate cleanly');
    const out = programOutput(r.output).replace(/END\s*$/, '').trim();
    if (out !== '((A) (B C))') {
        throw new Error(`expected "((A) (B C))", got ${JSON.stringify(out)}`);
    }
});

test('Bug E fix: SP returns to its initial value after a top-level READ', () => {
    // After REPL finishes reading and printing one expression, the
    // stack must have unwound completely. We probe by running long
    // enough for the REPL to halt, then comparing SP against its
    // initial value (5000). A leak (push without matching pop) would
    // leave SP > 5000.
    const SP_ADDR = lookupLabel('SP');
    const initialSP = 5000;
    return runUntilLabelAndCheck(code, '(A B)\n', 'REPL_DONE', cpu => {
        const sp = cpu.mem[SP_ADDR];
        if (sp !== initialSP) {
            throw new Error(`SP=${sp} after REPL, expected ${initialSP} (stack leak: push/pop unbalanced)`);
        }
    });
});

// -------------------------- 5. Plausibility / hardware-limit checks
//
// The Quake-on-ZX81 problem: an emulator that reports impossible
// successes is worse than one that reports honest failures. These tests
// feed the LISP-on-Elliott inputs that exceed the limits of the
// hardware it claims to run on, and assert the LISP fails *visibly* -
// it must NOT pretend to compute something the 4130 cannot.
//
// Hardware limits being probed:
//   - Cell pointers are 12-bit fields inside cons cells, so any cell at
//     an address > 4095 is unreachable through CAR/CDR. With HEAP at
//     2000, the heap holds at most ~2095 cons cells; allocating beyond
//     that silently truncates pointers.
//   - Numbers are encoded by the reader as atom code (5000 + value).
//     The atom code itself is a 12-bit field, so values > -905 already
//     break the encoding (5000 + N > 4095 for N >= 0).
//   - The LISP image has no error reporting; failure modes are: produce
//     no output, hit max steps, or emit garbage.
//
// Each test below sends a clearly-too-much input and pins that the
// LISP DOES NOT produce a clean, well-structured answer. If a future
// edit makes one of these tests start producing a clean parse of the
// oversized input, the system is claiming capability it cannot have.
console.log('\n--- 5. Plausibility / hardware-limit checks ---');

const RESULT_ADDR_PLAUS = lookupLabel('RESULT');
const HEAP_ADDR_PLAUS = lookupLabel('HEAP');

test('Number atom 5000 cannot round-trip (12-bit atom-code overflow)', () => {
    // Input "5000" should require atom code 10000 = 0x2710, which does
    // not fit in the 12-bit CAR/CDR slot of a cons cell. A correct
    // reader would either error or refuse the value. A naive reader
    // computes 5000 + 5000 = 10000 and stores that, silently corrupting
    // the atom code space. Pin: the LISP must NOT print "5000" back.
    const r = run(code, '5000\n', 200_000);
    const out = programOutput(r.output);
    if (out.includes('5000')) {
        throw new Error(`LISP claimed to round-trip 5000 (output=${JSON.stringify(out)}); ` +
                        `impossible on 12-bit atom codes (max 4095)`);
    }
});

test('5-digit number does not survive as a clean printable answer', () => {
    // 99999 is far beyond anything representable as an atom on a 4130
    // LISP image with this encoding. Pin that nothing recognisable
    // comes back. Note: the REPL ALWAYS prints "END" on its way out,
    // so we strip that before checking.
    const r = run(code, '99999\n', 200_000);
    const out = programOutput(r.output).replace(/END\s*$/, '').trim();
    if (out.includes('99999') || /^[A-Z]+$/.test(out)) {
        throw new Error(`5-digit number produced clean output ${JSON.stringify(out)} - implausible`);
    }
});

test('Flat list of 5000 atoms cannot be cons\'d into the 4095-cell heap', () => {
    // 5000 atoms => 5000 cons cells. With HEAP base 2000 and 12-bit
    // cell pointers (max addr 4095), the heap can hold at most 2095
    // referenceable cells. The LISP MUST NOT print a clean
    // "(A A A...)" of 5000 elements - that would mean it was claiming
    // to address cells past the 12-bit pointer ceiling.
    const tape = '(' + Array(5000).fill('A').join(' ') + ')\n';
    const r = run(code, tape, 20_000_000);
    const out = programOutput(r.output);
    // A "successful" parse-and-print would be a long string of A's
    // (with or without parens, since PRINT for lists currently emits
    // NIL anyway). What we forbid: any output that looks like even a
    // partial successful list-of-A's render with 100+ atoms.
    const aRun = out.match(/A(\s*A){99,}/);
    if (aRun) {
        throw new Error(`LISP rendered 100+ atoms from a 5000-atom list - exceeds 12-bit cell pointer limit`);
    }
});

test('Flat 5000-atom list either halts the LISP cleanly OR overruns HEAP', () => {
    // Direct state-level probe: run the LISP on a 5000-atom list and
    // confirm that EITHER it halted (acceptable - did not produce a
    // bogus answer) OR HEAP exceeded the 12-bit cell-pointer limit
    // (which is the silent-failure signature). What is forbidden: a
    // clean halt with HEAP <= 4095 AND an output containing a long
    // structured list - that combination would mean the LISP claimed
    // success at something it cannot represent.
    const tape = '(' + Array(5000).fill('A').join(' ') + ')\n';
    const cpu = new E4130({ outputHandler: () => {} });
    cpu.reset();
    cpu.halted = false;
    for (const { addr, word } of code) cpu.mem[addr] = word;
    cpu.S = 0;
    const bytes = new Uint8Array(tape.length);
    for (let i = 0; i < tape.length; i++) bytes[i] = tape.charCodeAt(i) & 0xFF;
    cpu.loadTape(bytes);
    let steps = 0;
    let maxHeap = 0;
    while (!cpu.halted && steps < 20_000_000) {
        cpu.step();
        steps++;
        if (cpu.S === 252 || cpu.S === 254) {
            const link = cpu.mem[2] & 0xFFFFFF;
            cpu.S = link & 0x1FFFF;
            cpu.C = (cpu.C & 0x01FFFF) | ((link >> 17 & 0x7F) << 17);
        }
        const h = cpu.mem[HEAP_ADDR_PLAUS] & 0xFFFFFF;
        if (h > maxHeap) maxHeap = h;
    }
    // HEAP must exceed 4095 (the silent-overrun signature) - otherwise
    // the LISP somehow handled 5000 atoms within a 2095-cell heap,
    // which is impossible without hardware-impossible compression.
    if (maxHeap <= 4095) {
        throw new Error(`5000-atom list parsed without HEAP exceeding 4095 (maxHEAP=${maxHeap}). ` +
                        `Either the LISP rejected the input cleanly (in which case relax this test) ` +
                        `or it is silently fitting 5000 cells into a 2095-cell heap (impossible).`);
    }
});

test('Random 8-bit binary tape does not produce a structured LISP value', () => {
    // 256 bytes of pseudo-random binary. A correct LISP cannot find
    // structure here. Output must not be a clean atom or list.
    const N = 256;
    const tape = Array.from({ length: N }, (_, i) => String.fromCharCode((i * 53 + 11) & 0xFF)).join('');
    const r = run(code, tape, 2_000_000);
    const out = programOutput(r.output);
    if (/^\s*[A-Z]\s*$/.test(out)) {
        throw new Error(`Random tape produced single-atom answer ${JSON.stringify(out)}`);
    }
    if (/^\s*\([A-Z]( [A-Z])*\)\s*$/.test(out)) {
        throw new Error(`Random tape produced structured list ${JSON.stringify(out)}`);
    }
    if (/^\s*[A-Z]( [A-Z]){4,}\s*$/.test(out)) {
        throw new Error(`Random tape produced clean atom-sequence ${JSON.stringify(out)}`);
    }
});

test('3000 nested parens overflow the cell heap (cannot be parsed cleanly)', () => {
    // ((((...)))) with 3000 levels needs 3000 cons cells in the heap.
    // HEAP starts at 2000, so this allocation would need to reach
    // 5000 - 905 cells past the 12-bit pointer limit. The LISP MUST
    // NOT produce a clean "(((...)))" parse: any output that looks
    // like a balanced-paren mirror of the input would mean the LISP
    // is claiming to address > 4095 in a 12-bit field.
    const N = 3000;
    const tape = '('.repeat(N) + ')'.repeat(N) + '\n';
    const r = run(code, tape, 20_000_000);
    const out = programOutput(r.output);
    // We forbid the LISP echoing back a deep paren structure.
    if (/\({10,}/.test(out)) {
        throw new Error(`Deep-nesting tape produced output with 10+ consecutive '(' - implausible`);
    }
});

// ------------------------------------------ 6. Out-of-scope LISP TODOs
console.log('\n--- 6. Out-of-scope LISP TODOs (not asserted) ---');
console.log('  Reader bugs 1, 2, A, B, C, D, E all fixed.');
console.log('  cli.mjs trap-detection bug fixed (was hijacking S=252');
console.log('  every time PR_LIST_LOOP fell through its NIL check).');
console.log('  QUOTE/CAR/CDR/CAR-CDR composition all evaluate correctly.');
console.log('  Still TODO: CONS, ATOM, EQ, COND, LAMBDA - those EVAL');
console.log('  paths exist but are not yet exercised end-to-end.');

console.log(`\n${'='.repeat(60)}`);
console.log(`LISP TESTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
process.exit(failed > 0 ? 1 : 0);
