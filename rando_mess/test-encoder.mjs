/**
 * Node.js Unit Tests for String Audio Encoder/Decoder
 *
 * Run with: node --experimental-vm-modules test-encoder.mjs
 * Or: node test-encoder.mjs (with proper ESM setup)
 */

// Polyfill TextEncoder/TextDecoder for Node
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Import the encoder
import { StringAudioEncoder } from './string-audio-encoder.js';

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('\n=== DanjaBeep Audio Encoder Tests ===\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                console.log(`  ✓ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`  ✗ ${name}`);
                console.log(`    Error: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\n  ${this.passed} passed, ${this.failed} failed\n`);
        return this.failed === 0;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertArrayEquals(actual, expected, message) {
    if (actual.length !== expected.length) {
        throw new Error(message || `Length mismatch: ${actual.length} vs ${expected.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new Error(message || `Mismatch at index ${i}: ${actual[i]} vs ${expected[i]}`);
        }
    }
}

// ============ Tests ============

const runner = new TestRunner();

// CRC16 Tests
runner.test('CRC16 should calculate correct checksum', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const crc = StringAudioEncoder.crc16(data);
    assert(typeof crc === 'number', 'CRC should be a number');
    assert(crc >= 0 && crc <= 0xFFFF, 'CRC should be 16-bit');
});

runner.test('CRC16 should be consistent', () => {
    const data = new Uint8Array([0xAE, 0x05, 0x68, 0x65, 0x6C, 0x6C, 0x6F]);
    const crc1 = StringAudioEncoder.crc16(data);
    const crc2 = StringAudioEncoder.crc16(data);
    assertEquals(crc1, crc2, 'CRC should be consistent');
});

runner.test('CRC16 should differ for different data', () => {
    const data1 = new Uint8Array([0x01, 0x02, 0x03]);
    const data2 = new Uint8Array([0x01, 0x02, 0x04]);
    const crc1 = StringAudioEncoder.crc16(data1);
    const crc2 = StringAudioEncoder.crc16(data2);
    assert(crc1 !== crc2, 'CRC should differ for different data');
});

// Quaternary Conversion Tests
runner.test('bytesToQuaternary should convert correctly', () => {
    // 0xFF = 11111111 = 3333 in quaternary
    const bytes = new Uint8Array([0xFF]);
    const quad = StringAudioEncoder.bytesToQuaternary(bytes);
    assertEquals(quad, '3333', '0xFF should become 3333');
});

runner.test('bytesToQuaternary should handle zero', () => {
    const bytes = new Uint8Array([0x00]);
    const quad = StringAudioEncoder.bytesToQuaternary(bytes);
    assertEquals(quad, '0000', '0x00 should become 0000');
});

runner.test('bytesToQuaternary should handle multiple bytes', () => {
    const bytes = new Uint8Array([0x00, 0xFF]);
    const quad = StringAudioEncoder.bytesToQuaternary(bytes);
    assertEquals(quad, '00003333', 'Two bytes should produce 8 quaternary digits');
});

runner.test('quaternaryToBytes should reverse bytesToQuaternary', () => {
    const original = new Uint8Array([0xAB, 0xCD, 0x12]);
    const quad = StringAudioEncoder.bytesToQuaternary(original);
    const restored = StringAudioEncoder.quaternaryToBytes(quad);
    assertArrayEquals([...restored], [...original], 'Round-trip should preserve data');
});

// Packet Building Tests
runner.test('buildPacket should include magic header', () => {
    const data = new Uint8Array([0x01, 0x02]);
    const packet = StringAudioEncoder.buildPacket(data);
    assertEquals(packet[0], StringAudioEncoder.MAGIC_HEADER, 'First byte should be magic header');
});

runner.test('buildPacket should include length', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
    const packet = StringAudioEncoder.buildPacket(data);
    assertEquals(packet[1], 5, 'Second byte should be data length');
});

runner.test('buildPacket should include CRC', () => {
    const data = new Uint8Array([0x41]); // 'A'
    const packet = StringAudioEncoder.buildPacket(data);
    assertEquals(packet.length, 2 + 1 + 2, 'Packet should be header + data + CRC');
});

// Interleaving Tests
runner.test('interleaveWithCarrier should add X between symbols', () => {
    const symbols = '0123';
    const interleaved = StringAudioEncoder.interleaveWithCarrier(symbols);
    assertEquals(interleaved, 'X0X1X2X3X', 'Should interleave with X carrier');
});

runner.test('interleaveWithCarrier should handle single symbol', () => {
    const symbols = '0';
    const interleaved = StringAudioEncoder.interleaveWithCarrier(symbols);
    assertEquals(interleaved, 'X0X', 'Single symbol should be surrounded by X');
});

// Audio Generation Tests
runner.test('encode should produce Float32Array', () => {
    const samples = StringAudioEncoder.encode('Hi');
    assert(samples instanceof Float32Array, 'Should return Float32Array');
    assert(samples.length > 0, 'Should have samples');
});

runner.test('encode should produce valid sample values', () => {
    const samples = StringAudioEncoder.encode('test');
    let maxAbs = 0;
    for (const s of samples) {
        maxAbs = Math.max(maxAbs, Math.abs(s));
    }
    assert(maxAbs <= 1.0, 'Samples should be in range [-1, 1]');
    assert(maxAbs > 0.5, 'Should have some signal amplitude');
});

runner.test('encode should produce different lengths for different strings', () => {
    const short = StringAudioEncoder.encode('Hi');
    const long = StringAudioEncoder.encode('Hello World');
    assert(long.length > short.length, 'Longer string should produce more samples');
});

runner.test('encode should reject strings that are too long', () => {
    const longString = 'x'.repeat(300);
    let threw = false;
    try {
        StringAudioEncoder.encode(longString);
    } catch (e) {
        threw = true;
        assert(e.message.includes('too long'), 'Should mention string too long');
    }
    assert(threw, 'Should throw for strings > 255 bytes');
});

// Statistics Tests
runner.test('getStats should return expected fields', () => {
    const stats = StringAudioEncoder.getStats('test');
    assert('inputLength' in stats, 'Should have inputLength');
    assert('byteLength' in stats, 'Should have byteLength');
    assert('symbolCount' in stats, 'Should have symbolCount');
    assert('durationMs' in stats, 'Should have durationMs');
    assert('crc16' in stats, 'Should have crc16');
});

runner.test('getStats should calculate correct byte length', () => {
    const stats = StringAudioEncoder.getStats('Hello');
    assertEquals(stats.inputLength, 5, 'Input length should be 5');
    assertEquals(stats.byteLength, 5, 'Byte length should be 5 for ASCII');
});

runner.test('getStats should handle UTF-8 correctly', () => {
    const stats = StringAudioEncoder.getStats('日本語'); // 3 chars, 9 bytes in UTF-8
    assertEquals(stats.inputLength, 3, 'Input length should be 3 chars');
    assertEquals(stats.byteLength, 9, 'Byte length should be 9 for Japanese');
});

// WAV Generation Tests
runner.test('generateWav should produce a Blob', () => {
    // Node.js doesn't have Blob, so we skip in Node
    if (typeof Blob === 'undefined') {
        console.log('    (Skipped in Node - Blob not available)');
        return;
    }
    const wav = StringAudioEncoder.generateWav('test');
    assert(wav instanceof Blob, 'Should return Blob');
    assert(wav.size > 44, 'Should have more than just WAV header');
});

// Frequency Tests
runner.test('frequencies should be in ultrasonic range', () => {
    for (const [symbol, freq] of Object.entries(StringAudioEncoder.FREQUENCIES)) {
        assert(freq >= 16000, `${symbol} frequency should be >= 16kHz`);
        assert(freq <= 20000, `${symbol} frequency should be <= 20kHz`);
    }
});

runner.test('frequencies should be properly spaced', () => {
    const freqs = Object.values(StringAudioEncoder.FREQUENCIES).sort((a, b) => a - b);
    for (let i = 1; i < freqs.length; i++) {
        const spacing = freqs[i] - freqs[i - 1];
        assert(spacing >= 400, `Frequency spacing should be >= 400Hz (got ${spacing})`);
    }
});

// URI Encoding Tests
runner.test('encode should handle URL', () => {
    const samples = StringAudioEncoder.encode('https://example.com/path?query=1');
    assert(samples.length > 0, 'Should encode URL');
});

runner.test('encode should handle special characters', () => {
    const samples = StringAudioEncoder.encode('user@example.com');
    assert(samples.length > 0, 'Should encode email');
});

runner.test('encode should handle emoji', () => {
    const samples = StringAudioEncoder.encode('Hello 👋');
    assert(samples.length > 0, 'Should encode emoji');
});

// Run tests
runner.run().then(success => {
    process.exit(success ? 0 : 1);
});
