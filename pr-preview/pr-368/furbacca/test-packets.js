#!/usr/bin/env node
/**
 * Furby Packet Test Utility
 *
 * Verifies packet encoding/decoding matches Hacksby Perl Packet.pm
 * Run with: node test-packets.js
 */

// Import the packet module (ESM)
import { FurbyPacket } from './furby-packet.js';

console.log('=== Furby Packet Test Utility ===\n');
console.log('Testing Hacksby two-packet protocol:\n');
console.log('  Each command (0-1023) is encoded as TWO packets:');
console.log('  - Packet 1: high 5 bits (0-31)');
console.log('  - Packet 2: low 5 bits + 32 (32-63)');
console.log('  - Each packet: DATA(4) + CHECKSUM(4) + "1032" identifier\n');

// Test 1: Verify encoding for known commands
console.log('TEST 1: Packet Encoding');
console.log('-'.repeat(60));

const testCommands = [
    { cmd: 867, name: 'CMD_SNEEZE' },
    { cmd: 864, name: 'CMD_BURP' },
    { cmd: 865, name: 'CMD_FART' },
    { cmd: 868, name: 'CMD_SING' },
    { cmd: 869, name: 'CMD_TALK' },
    { cmd: 820, name: 'HYPNOTIZE' },
    { cmd: 350, name: 'FOOD_TASTY' },
    { cmd: 0, name: 'Zero' },
    { cmd: 1023, name: 'Max' },
];

testCommands.forEach(({ cmd, name }) => {
    const packet = FurbyPacket.make(cmd);
    const [pkt1, pkt2] = packet.split(' ');

    const highBits = cmd >> 5;
    const lowBits = cmd & 31;

    console.log(`Command ${cmd} (${name}):`);
    console.log(`  High bits: ${highBits}, Low bits: ${lowBits}`);
    console.log(`  Packet 1: ${pkt1}`);
    console.log(`  Packet 2: ${pkt2}`);
    console.log();
});

// Test 2: Verify checksum lookup table
console.log('\nTEST 2: Checksum Table Verification');
console.log('-'.repeat(60));

let checksumPass = true;
for (let i = 0; i < 64; i++) {
    const checksum = FurbyPacket.CHECKSUMS[i];
    if (!checksum || checksum.length !== 4) {
        console.log(`FAIL: Checksum[${i}] = ${checksum} (invalid)`);
        checksumPass = false;
    }
}
console.log(`Checksum table: ${checksumPass ? '✓ All 64 entries valid' : '✗ Some entries invalid'}`);

// Test 3: Round-trip encoding/decoding
console.log('\nTEST 3: Round-trip Encoding/Decoding');
console.log('-'.repeat(60));

let passed = 0;
let failed = 0;
const failures = [];

for (let cmd = 0; cmd <= 1023; cmd++) {
    const packet = FurbyPacket.make(cmd);
    const [pkt1, pkt2] = packet.split(' ');

    // Remove dashes for parsing
    const parsed1 = FurbyPacket.parsePacket(pkt1.replace(/-/g, ''));
    const parsed2 = FurbyPacket.parsePacket(pkt2.replace(/-/g, ''));

    // Decode full command
    const decoded = FurbyPacket.decodeCommand(parsed1, parsed2);

    if (decoded.command === cmd && parsed1.checksumValid && parsed2.checksumValid && !decoded.error) {
        passed++;
    } else {
        failed++;
        if (failures.length < 5) {
            failures.push({
                cmd,
                decoded: decoded.command,
                error: decoded.error,
                p1Valid: parsed1.checksumValid,
                p2Valid: parsed2.checksumValid
            });
        }
    }
}

console.log(`Round-trip: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.log('First failures:');
    failures.forEach(f => {
        console.log(`  cmd=${f.cmd}: decoded=${f.decoded}, p1=${f.p1Valid}, p2=${f.p2Valid}, error=${f.error}`);
    });
}

// Test 4: Verify packet structure
console.log('\nTEST 4: Packet Structure Verification');
console.log('-'.repeat(60));

const structTests = [0, 100, 500, 867, 1023];
structTests.forEach(cmd => {
    const packet = FurbyPacket.make(cmd);
    const [pkt1, pkt2] = packet.split(' ');
    const [data1, checksum1, id1] = pkt1.split('-');
    const [data2, checksum2, id2] = pkt2.split('-');

    console.log(`Command ${cmd}:`);
    console.log(`  Packet 1: data=${data1} checksum=${checksum1} id=${id1}`);
    console.log(`  Packet 2: data=${data2} checksum=${checksum2} id=${id2}`);

    // Verify identifier
    const idOk = id1 === '1032' && id2 === '1032';
    console.log(`  Identifiers: ${idOk ? '✓' : '✗'}`);
    console.log();
});

// Test 5: Symbol stream simulation
console.log('\nTEST 5: Symbol Stream Simulation');
console.log('-'.repeat(60));

function simulateTransmission(cmd) {
    const packet = FurbyPacket.make(cmd);
    const [pkt1, pkt2] = packet.split(' ');

    // Remove dashes to get 12 digits
    const digits1 = pkt1.replace(/-/g, '');
    const digits2 = pkt2.replace(/-/g, '');

    // Build interleaved stream (what gets transmitted)
    const interleaved1 = 'X' + digits1.split('').join('X') + 'X';
    const interleaved2 = 'X' + digits2.split('').join('X') + 'X';

    console.log(`Command ${cmd}:`);
    console.log(`  Packet 1 digits: ${digits1} (${digits1.length} digits)`);
    console.log(`  Packet 1 transmitted: ${interleaved1}`);
    console.log(`  Packet 1 symbols: ${interleaved1.length} total`);
    console.log(`  Packet 2 digits: ${digits2} (${digits2.length} digits)`);
    console.log(`  Packet 2 transmitted: ${interleaved2}`);
    console.log(`  Packet 2 symbols: ${interleaved2.length} total`);
    console.log();

    return digits1.length === 12 && digits2.length === 12 &&
           interleaved1.length === 25 && interleaved2.length === 25;
}

const simTests = [867, 864, 0, 1023];
const simResults = simTests.map(cmd => simulateTransmission(cmd));
console.log(`Simulation: ${simResults.every(r => r) ? 'ALL PASSED' : 'SOME FAILED'}`);

// Test 6: Timing analysis
console.log('\nTEST 6: Timing Analysis');
console.log('-'.repeat(60));

const timingParams = {
    baseFreqLength: 16,      // ms per symbol
    xfadeLength: 4,          // ms crossfade
    leadLength: 5,           // ms lead in/out
    silenceGap: 490,         // ms between packets
};

const symbolsPerPacket = 25; // 13 X + 12 data
const symbolTime = timingParams.baseFreqLength + timingParams.xfadeLength;
const packetTime = (symbolsPerPacket * symbolTime) + (2 * timingParams.leadLength);
const totalTime = (2 * packetTime) + timingParams.silenceGap;

console.log('Timing parameters:');
console.log(`  Symbol duration: ${timingParams.baseFreqLength}ms + ${timingParams.xfadeLength}ms crossfade = ${symbolTime}ms`);
console.log(`  Packet duration: ${symbolsPerPacket} symbols × ${symbolTime}ms + ${2 * timingParams.leadLength}ms leads = ${packetTime}ms`);
console.log(`  Total transmission: 2 packets × ${packetTime}ms + ${timingParams.silenceGap}ms gap = ${totalTime}ms`);

console.log('\n=== Tests Complete ===\n');

// Final summary
const allPassed = checksumPass && failed === 0 && simResults.every(r => r);
console.log(allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
process.exit(allPassed ? 0 : 1);
