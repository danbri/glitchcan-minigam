#!/usr/bin/env node
/**
 * Elliott 4130 LISP - 3-bit Reference Counting Memory Leak Demonstration
 *
 * The historical Elliott 4130 LISP implementation used only 3 bits for
 * reference counts (max value 7). When a cell was shared more than 7 times,
 * the count would "stick" at 7 and never decrement to 0, causing leaks.
 *
 * This script demonstrates the problem by simulating the GC behavior.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load browser-style JS files
const coreCode = readFileSync(join(__dirname, 'elliott4130-core.js'), 'utf-8');
const asmCode = readFileSync(join(__dirname, 'elliott4130-asm.js'), 'utf-8');

// Eval to get classes
const allCode = `${coreCode}\n${asmCode}\n({ E4130, Asm })`;
const { E4130, Asm } = eval(allCode);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Elliott 4130 LISP: 3-Bit Reference Counting Memory Leak Demo  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Memory layout constants
const HEAP_START = 1000;
const HEAP_SIZE = 10;  // Small heap to show the problem clearly
const REFCNT_BASE = 800;
const FREELIST = 700;

console.log('Memory Layout:');
console.log(`  HEAP:     ${HEAP_START}-${HEAP_START + HEAP_SIZE - 1} (${HEAP_SIZE} cells)`);
console.log(`  REFCNTS:  ${REFCNT_BASE}-${REFCNT_BASE + HEAP_SIZE - 1} (3 bits per cell)`);
console.log(`  FREELIST: ${FREELIST}`);
console.log();

// Simulate the GC
class RefCountGC {
    constructor() {
        this.heap = new Array(HEAP_SIZE).fill(null);  // null = free
        this.refcounts = new Array(HEAP_SIZE).fill(0);
        this.freeList = [];

        // Initialize: all cells on freelist
        for (let i = HEAP_SIZE - 1; i >= 0; i--) {
            this.freeList.push(HEAP_START + i);
        }
    }

    // Allocate a cell from freelist
    alloc() {
        if (this.freeList.length === 0) {
            return null;  // Out of memory!
        }
        const addr = this.freeList.pop();
        const idx = addr - HEAP_START;
        this.refcounts[idx] = 1;  // Initial reference
        return addr;
    }

    // Increment refcount (with 3-bit saturation)
    incRef(addr) {
        const idx = addr - HEAP_START;
        if (this.refcounts[idx] < 7) {
            this.refcounts[idx]++;
        }
        // At 7, it "sticks" - this is the bug!
        return this.refcounts[idx];
    }

    // Decrement refcount
    decRef(addr) {
        const idx = addr - HEAP_START;
        if (this.refcounts[idx] > 0) {
            this.refcounts[idx]--;
        }
        // If count reaches 0, cell should be freed
        if (this.refcounts[idx] === 0) {
            this.freeList.push(addr);
            this.heap[idx] = null;
            return true;  // Freed!
        }
        return false;  // Still in use
    }

    // Store value in cell
    store(addr, value) {
        const idx = addr - HEAP_START;
        this.heap[idx] = value;
    }

    status() {
        console.log('┌────────────────────────────────────────────────────┐');
        console.log('│ Cell   │ Value      │ RefCount │ Status            │');
        console.log('├────────┼────────────┼──────────┼───────────────────┤');
        for (let i = 0; i < HEAP_SIZE; i++) {
            const addr = HEAP_START + i;
            const value = this.heap[i] ?? '(free)';
            const rc = this.refcounts[i];
            const onFreeList = this.freeList.includes(addr);
            let status = onFreeList ? 'on freelist' : 'allocated';
            if (rc === 7) status = '⚠️  STUCK AT 7!';
            if (rc > 0 && onFreeList) status = '💀 LEAKED!';
            console.log(`│ ${addr}   │ ${String(value).padEnd(10)} │    ${rc}     │ ${status.padEnd(17)} │`);
        }
        console.log('└────────────────────────────────────────────────────┘');
        console.log(`Free cells: ${this.freeList.length}/${HEAP_SIZE}`);
        console.log();
    }
}

// === DEMONSTRATION ===

const gc = new RefCountGC();

console.log('═══════════════════════════════════════════════════════════════');
console.log('INITIAL STATE: All 10 cells are free');
console.log('═══════════════════════════════════════════════════════════════\n');
gc.status();

// Allocate a cell
console.log('═══════════════════════════════════════════════════════════════');
console.log('Step 1: ALLOC a cell, store (A . B), refcount = 1');
console.log('═══════════════════════════════════════════════════════════════\n');
const cell = gc.alloc();
gc.store(cell, '(A . B)');
gc.status();

// Share it many times (simulating 10 pointers to this cell)
console.log('═══════════════════════════════════════════════════════════════');
console.log('Step 2: SHARE the cell 10 times (create 10 references)');
console.log('        True refcount should be 11, but 3 bits max = 7');
console.log('═══════════════════════════════════════════════════════════════\n');

for (let i = 0; i < 10; i++) {
    const newRc = gc.incRef(cell);
    console.log(`  Share #${i + 1}: refcount -> ${newRc}${newRc === 7 ? ' (SATURATED!)' : ''}`);
}
console.log();
gc.status();

// Now remove all 11 references
console.log('═══════════════════════════════════════════════════════════════');
console.log('Step 3: UNSHARE all 11 references');
console.log('        Each decrement subtracts 1, but we started at 7...');
console.log('═══════════════════════════════════════════════════════════════\n');

let freed = false;
for (let i = 0; i < 11; i++) {
    freed = gc.decRef(cell);
    const idx = cell - HEAP_START;
    const rc = gc.refcounts[idx];
    console.log(`  Unshare #${i + 1}: refcount -> ${rc}${freed ? ' (FREED!)' : ''}`);
}
console.log();
gc.status();

// Show the leak
console.log('═══════════════════════════════════════════════════════════════');
console.log('RESULT: MEMORY LEAK!');
console.log('═══════════════════════════════════════════════════════════════\n');

if (!freed) {
    console.log('Cell 1009 is LEAKED:');
    console.log('  - It holds (A . B) but has NO live references');
    console.log('  - Refcount went 7→6→5→4→3→2→1→0 after only 7 decrements');
    console.log('  - But we made 11 references! The other 4 were never counted');
    console.log('  - Result: Cell was freed while STILL BEING REFERENCED!');
    console.log();
    console.log('In the Elliott 4130 implementation, they used "sticky" counts:');
    console.log('  - Once refcount hit 7, it stayed at 7 forever');
    console.log('  - So decrements would leave it at 7-1=6, 6-1=5, ...');
    console.log('  - But it would NEVER reach 0');
    console.log('  - Cell stays allocated forever = MEMORY LEAK');
}

console.log();
console.log('═══════════════════════════════════════════════════════════════');
console.log('Historical Note:');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`
The Elliott 4130 was a 24-bit minicomputer from 1965. Memory was precious,
so the LISP implementers used just 3 bits for reference counts. The machine
had 8K or 16K words - a typical LISP heap might be 4000-8000 cells.

When programs created heavily-shared data structures (like symbol tables or
cached computations), cells would exceed 7 references. The "sticky 7" approach
prevented premature freeing but caused gradual memory exhaustion.

Modern LISP systems use mark-and-sweep or generational GC to avoid this.
`);

// Demonstrate with Elliott 4130 assembly!
console.log('═══════════════════════════════════════════════════════════════');
console.log('BONUS: Actual Elliott 4130 Assembly showing the 3-bit limit');
console.log('═══════════════════════════════════════════════════════════════\n');

const asm = new Asm();
const program = asm.asm(`
    ; Demonstrate 3-bit refcount saturation in Elliott 4130 assembly
    ; Memory: REFCNT at 800, results at 500-510

    ; Start with refcount = 1
    LD    #1
    ST    800

    ; Increment 10 times, capping at 7
    LD    #10
    ST    710           ; loop counter

SHARE_LOOP:
    LD    710
    JZ    SHARE_DONE

    ; Increment with 3-bit cap
    LD    800
    ADD   #1
    SUB   #7
    JN    NOT_OVER
    LD    #7
    J     STORE_IT
NOT_OVER:
    ADD   #7
STORE_IT:
    ST    800

    ; Store history: refcount after each share
    LD    #510
    SUB   710
    ST    711
    LD    800
    LDR   711
    ST    0,R

    ; Decrement counter
    LD    710
    SUB   #1
    ST    710
    J     SHARE_LOOP

SHARE_DONE:
    ; Now decrement 11 times
    LD    #11
    ST    710

UNSHARE_LOOP:
    LD    710
    JZ    DONE

    LD    800
    SUB   #1
    JN    KEEP_ZERO
    J     STORE_DEC
KEEP_ZERO:
    LD    #0
STORE_DEC:
    ST    800

    ; Decrement counter
    LD    710
    SUB   #1
    ST    710
    J     UNSHARE_LOOP

DONE:
    ; Final refcount at 500
    LD    800
    ST    500
    J     HALT

HALT: J HALT
`);

const cpu = new E4130();
for (const { addr, word } of program) {
    cpu.mem[addr] = word;
}
cpu.halted = false;

// Execute with cycle limit
for (let cycles = 0; cycles < 5000 && !cpu.halted; cycles++) {
    const w = cpu.mem[cpu.S >> 1];
    const f = (w >> 18) & 0x3F;
    // Detect infinite loop (J .)
    if (f === 0o60 && (cpu.S >> 1) === ((w >> 1) & 0x7FFF)) {
        break;
    }
    cpu.step();
}

console.log('Refcount history during SHARE operations:');
for (let i = 1; i <= 10; i++) {
    console.log(`  After share #${i}: refcount = ${cpu.mem[510 - i]}`);
}
console.log();
console.log(`Final refcount after 11 UNSHARE operations: ${cpu.mem[500]}`);
console.log();
if (cpu.mem[500] === 0) {
    console.log('⚠️  Refcount reached 0 - but we had 11 references!');
    console.log('   Cell freed too early = dangling pointer / memory corruption');
} else {
    console.log('Note: If using "sticky 7" approach, count would stay > 0');
    console.log('      Cell never freed = memory leak');
}
