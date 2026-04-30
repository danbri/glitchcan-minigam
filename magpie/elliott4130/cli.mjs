#!/usr/bin/env node
// Elliott 4130 CLI runner.
//
// Loads a NEAT assembly file, optionally a tape, runs the CPU,
// and prints captured console output. Provides minimal host trap
// handlers for TR (letter display) and CH (octal display), which
// per E6X3 are software extracodes - i.e. the OS supplies them.
// This script plays the role of that OS at runtime, in JS.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { E4130 } from './elliott4130-core.js';
import { Asm } from './elliott4130-asm.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// TR trap is at word 126 (F=0o77, Y=0). After trap, S = 126*2 = 252 (half-word).
// CH trap is at word 127 (F=0o77, Y>0). After trap, S = 127*2 = 254 (half-word).
const TR_TRAP_S = 252;
const CH_TRAP_S = 254;

function parseArgs(argv) {
    const args = { asm: 'lisp4130.asm', tape: null, maxSteps: 1_000_000, quiet: false, repl: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--asm') args.asm = argv[++i];
        else if (a === '--tape') args.tape = argv[++i];
        else if (a === '--max-steps') args.maxSteps = parseInt(argv[++i], 10);
        else if (a === '--quiet') args.quiet = true;
        else if (a === '--repl' || a === '-i') args.repl = true;
        else if (a === '-h' || a === '--help') {
            console.log('Usage: cli.mjs [--asm FILE] [--tape FILE] [--max-steps N] [--quiet]');
            console.log('       cli.mjs --repl   (interactive console)');
            process.exit(0);
        }
    }
    return args;
}

// Run a CPU loaded with `code`, supplying TR/CH trap handlers in JS.
// Returns { output, steps, halted, hitMaxSteps }.
export function run(code, tapeText, maxSteps = 1_000_000) {
    let output = '';
    const cpu = new E4130({ outputHandler: c => { output += c; } });
    cpu.reset();
    cpu.halted = false;
    for (const { addr, word } of code) cpu.mem[addr] = word;
    cpu.S = 0;
    if (tapeText !== null && tapeText !== undefined) {
        // Encode string as bytes - cpu.loadTape expects an array/Uint8Array
        const bytes = new Uint8Array(tapeText.length);
        for (let i = 0; i < tapeText.length; i++) bytes[i] = tapeText.charCodeAt(i) & 0xFF;
        cpu.loadTape(bytes);
    }

    // Restore caller context from the link word stashed at mem[2] by the trap.
    // Link word format per E6X3: (C[24:18] << 17) | S
    const returnFromTrap = () => {
        const link = cpu.mem[2] & 0xFFFFFF;
        cpu.S = link & 0x1FFFF;
        cpu.C = (cpu.C & 0x01FFFF) | ((link >> 17 & 0x7F) << 17);
    };

    // TR: per E6X3, "Display nth letter of alphabet on console".
    // The LISP image's startup uses TR 0 for newline and TR 1..26 for A..Z
    // (e.g. TR 12 ; L, TR 19 ; S). We follow that convention.
    const handleTR = () => {
        const n = cpu.mem[1] & 0xFFF;
        if (n === 0) output += '\n';
        else if (n >= 1 && n <= 26) output += String.fromCharCode(64 + n);
        else output += '?';
    };

    // CH: per E6X3, "Display Q in octal on console" - 8 octal digits + space.
    const handleCH = () => {
        const v = cpu.M & 0xFFFFFF;
        output += v.toString(8).padStart(8, '0') + ' ';
    };

    let steps = 0;
    let prevS = -1;
    let sameSCount = 0;
    let haltedAtSelfJump = false;
    while (!cpu.halted && steps < maxSteps) {
        const sBeforeStep = cpu.S;
        // Decode the instruction we are about to run so we can recognise a
        // genuine TR/CH extracode trap vs natural fall-through to S=252/254.
        // The LISP code overlaps those addresses (PR_LIST_LOOP runs through
        // word 126 = S=252), so checking only `cpu.S === TR_TRAP_S` after
        // the step misfires on every loop iteration that flows through
        // those words. Only treat it as a trap if the just-executed
        // instruction was a software extracode (long form, F=0o77, Z=1).
        const wBefore = cpu.mem[sBeforeStep >> 1] & 0xFFFFFF;
        const fBefore = (wBefore >> 18) & 0o77;
        const zBefore = (wBefore >> 15) & 1;
        const yBefore = (wBefore >> 16) & 3;
        const wasExtracode = (sBeforeStep & 1) === 0 && fBefore === 0o77 && zBefore === 1;
        try {
            cpu.step();
        } catch (e) {
            return { output, steps, halted: false, hitMaxSteps: false, error: e.message };
        }
        steps++;
        if (wasExtracode && cpu.S === TR_TRAP_S) { handleTR(); returnFromTrap(); }
        else if (wasExtracode && cpu.S === CH_TRAP_S) { handleCH(); returnFromTrap(); }
        // Quiet the unused-variable warning - yBefore reserved for future
        // CH (Y>0) discrimination if needed.
        void yBefore;
        // Detect self-jump halt (e.g. `HALT: J HALT`). If S before the step
        // equals S after the step, the instruction just jumped to itself,
        // which is the standard Elliott halt idiom. Two consecutive
        // identical Ss seal it.
        if (cpu.S === sBeforeStep) {
            sameSCount++;
            if (sameSCount >= 2) { haltedAtSelfJump = true; break; }
        } else {
            sameSCount = 0;
        }
        prevS = sBeforeStep;
    }

    return {
        output,
        steps,
        halted: cpu.halted || haltedAtSelfJump,
        hitMaxSteps: !haltedAtSelfJump && !cpu.halted && steps >= maxSteps,
    };
}

// Interactive REPL: read a line from the user, feed it as a tape to a fresh
// LISP image, print the output, repeat. Each prompt is a fresh image - the
// 4130 LISP has no persistent environment across REPL turns yet, so we lose
// no state by restarting (and keep the reader/EVAL/PRINT machinery clean).
async function repl(code, maxSteps) {
    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const prompt = '4130> ';
    process.stdout.write('Elliott 4130 LISP interactive console.\n');
    process.stdout.write('Type a complete S-expression on one line; Ctrl-D or "(QUIT)" to exit.\n');
    process.stdout.write('Supported so far: NIL, T, atoms, lists, QUOTE, CAR, CDR (and their composition).\n\n');
    rl.setPrompt(prompt);
    rl.prompt();
    for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) { rl.prompt(); continue; }
        if (trimmed.toUpperCase() === '(QUIT)' || trimmed.toUpperCase() === 'QUIT') break;
        const result = run(code, trimmed + '\n', maxSteps);
        // Strip the leading "LISP\n" banner and trailing "END" terminator.
        let out = result.output;
        if (out.startsWith('LISP\n')) out = out.slice(5);
        out = out.replace(/END\s*$/, '').replace(/\s+$/, '');
        if (result.error) {
            process.stdout.write(`error: ${result.error}\n`);
        } else if (result.hitMaxSteps) {
            process.stdout.write(`(hit ${maxSteps} step limit; LISP did not terminate - input may exceed hardware capacity or hit an unimplemented EVAL path)\n`);
        } else {
            process.stdout.write(out + '\n');
        }
        rl.prompt();
    }
    process.stdout.write('\nbye.\n');
}

export function assemble(asmPath) {
    const src = readFileSync(asmPath, 'utf8');
    const asm = new Asm();
    const code = asm.asm(src);
    const errors = asm.getErrors();
    if (errors.length) {
        const msg = errors.map(e => `  line ${e.line}: ${e.msg}`).join('\n');
        throw new Error(`Assembly errors:\n${msg}`);
    }
    return code;
}

async function main() {
    const args = parseArgs(process.argv);
    const asmPath = resolve(HERE, args.asm);
    const code = assemble(asmPath);

    if (args.repl) {
        if (!args.quiet) process.stderr.write(`Loaded ${code.length} words from ${args.asm}\n`);
        await repl(code, args.maxSteps);
        return;
    }

    const tapeText = args.tape ? readFileSync(resolve(HERE, args.tape), 'utf8') : null;

    if (!args.quiet) {
        process.stderr.write(`Loaded ${code.length} words from ${args.asm}\n`);
        if (tapeText) process.stderr.write(`Tape: ${args.tape} (${tapeText.length} chars)\n`);
    }

    const result = run(code, tapeText, args.maxSteps);
    process.stdout.write(result.output);

    if (!args.quiet) {
        process.stderr.write(`\n--- ${result.steps} steps`);
        if (result.error) process.stderr.write(`, error: ${result.error}`);
        if (result.hitMaxSteps) process.stderr.write(`, HIT MAX STEPS`);
        if (result.halted) process.stderr.write(`, halted`);
        process.stderr.write(' ---\n');
    }

    process.exit(result.error || result.hitMaxSteps ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
