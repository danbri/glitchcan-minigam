#!/usr/bin/env node
/**
 * Furby Packet Test Utility
 *
 * Verifies packet encoding/decoding without audio.
 * Run with: node test-packets.js
 */

// Import the packet module (ESM)
import { FurbyPacket } from './furby-packet.js';

console.log('=== Furby Packet Test Utility ===\n');

// Test 1: Verify encoding for known commands
console.log('TEST 1: Packet Encoding');
console.log('-'.repeat(50));

const testCommands = [868, 869, 863, 820, 350]; // SING, TALK, LAUGH, HYPNOTIZE, FOOD_TASTY

testCommands.forEach(cmd => {
    const packet = FurbyPacket.make(cmd);
    const [pkt1, pkt2] = packet.split(' ');
    const parsed = FurbyPacket.parsePacket(pkt1);

    console.log(`Command: ${cmd} (${parsed.commandName || 'unnamed'})`);
    console.log(`  Quaternary: ${pkt1}`);
    console.log(`  Checksum:   ${parsed.checksum} (${parsed.checksumValid ? 'VALID' : 'INVALID'})`);
    console.log(`  Interleaved: X${pkt1.split('').join('X')}X`);
    console.log();
});

// Test 2: Verify checksum algorithm
console.log('\nTEST 2: Checksum Verification');
console.log('-'.repeat(50));

for (let cmd = 0; cmd <= 1023; cmd += 100) {
    const chk = FurbyPacket.checksum(cmd);
    const reconstructed = cmd ^ chk;
    const valid = reconstructed === 0x3FF;
    console.log(`cmd=${cmd.toString().padStart(4)}: chk=${chk.toString().padStart(4)} | cmd^chk=${reconstructed} (should be 1023) ${valid ? '✓' : '✗'}`);
}

// Test 3: Round-trip encoding/decoding
console.log('\nTEST 3: Round-trip Encoding/Decoding');
console.log('-'.repeat(50));

let passed = 0;
let failed = 0;

for (let cmd = 0; cmd <= 1023; cmd++) {
    const packet = FurbyPacket.make(cmd);
    const [pkt1] = packet.split(' ');
    const parsed = FurbyPacket.parsePacket(pkt1);

    if (parsed.command === cmd && parsed.checksumValid) {
        passed++;
    } else {
        failed++;
        console.log(`FAIL: cmd=${cmd}, decoded=${parsed.command}, valid=${parsed.checksumValid}`);
    }
}

console.log(`\nRound-trip: ${passed} passed, ${failed} failed`);

// Test 4: Simulate received symbol stream
console.log('\nTEST 4: Symbol Stream Simulation');
console.log('-'.repeat(50));

// Simulate what the receiver sees
function simulateReceive(cmd) {
    const packet = FurbyPacket.make(cmd);
    const [pkt1] = packet.split(' ');

    // Build interleaved stream (what gets transmitted)
    const interleaved = 'X' + pkt1.split('').join('X') + 'X';

    console.log(`Command ${cmd}:`);
    console.log(`  Raw packet: ${pkt1}`);
    console.log(`  Transmitted: ${interleaved}`);
    console.log(`  Symbols: ${interleaved.length} total (${pkt1.length} data + ${interleaved.length - pkt1.length} carriers)`);

    // Simulate receiver stripping X's
    const dataSymbols = interleaved.split('').filter(s => s !== 'X');
    console.log(`  After stripping X: ${dataSymbols.join('')}`);
    console.log(`  Data symbols count: ${dataSymbols.length} (need 10 for valid packet)`);

    // Try to decode
    const decoded = FurbyPacket.parsePacket(dataSymbols.join(''));
    console.log(`  Decoded: cmd=${decoded.command}, valid=${decoded.checksumValid}`);
    console.log();

    return dataSymbols.length === 10 && decoded.command === cmd && decoded.checksumValid;
}

const simTests = [868, 862, 350, 820, 0, 1023];
let simPassed = simTests.every(simulateReceive);
console.log(`Simulation: ${simPassed ? 'ALL PASSED' : 'SOME FAILED'}`);

// Test 5: Analyze user's received sequence
console.log('\nTEST 5: Analyze Received Sequence');
console.log('-'.repeat(50));

// From user's log: X, 1, 0, X, 1, X, 0, X (partial sequence)
const userSequence = ['X', '1', '0', 'X', '1', 'X', '0', 'X'];
console.log('User received sequence:', userSequence.join(', '));

// Strip X's
const userData = userSequence.filter(s => s !== 'X');
console.log('After stripping X:', userData.join(''));
console.log(`Data symbols: ${userData.length} (need 10 for complete packet)`);

// Check expected pattern
console.log('\nExpected pattern for a packet:');
console.log('  Transmitted: X d X d X d X d X d X d X d X d X d X d X');
console.log('  Where d = data digit (0, 1, 2, or 3)');
console.log('  Total: 21 symbols (11 X carriers + 10 data digits)');
console.log('  Duration: ~21 * 16ms = 336ms per packet transmission');

// Test 6: Timing analysis
console.log('\nTEST 6: Timing Analysis');
console.log('-'.repeat(50));

const timingParams = {
    baseFreqLength: 16,      // ms per symbol
    xfadeLength: 4,          // ms crossfade
    leadLength: 5,           // ms lead in/out
    silenceGap: 490,         // ms between packet repeats
};

const symbolsPerPacket = 21; // 11 X + 10 data
const symbolTime = timingParams.baseFreqLength + timingParams.xfadeLength;
const packetTime = (symbolsPerPacket * symbolTime) + (2 * timingParams.leadLength);
const totalTime = (2 * packetTime) + timingParams.silenceGap;

console.log('Timing parameters:');
console.log(`  Symbol duration: ${timingParams.baseFreqLength}ms + ${timingParams.xfadeLength}ms crossfade = ${symbolTime}ms`);
console.log(`  Packet duration: ${symbolsPerPacket} symbols × ${symbolTime}ms + ${2 * timingParams.leadLength}ms leads = ${packetTime}ms`);
console.log(`  Total transmission: 2 packets × ${packetTime}ms + ${timingParams.silenceGap}ms gap = ${totalTime}ms`);

console.log('\n=== Tests Complete ===');
