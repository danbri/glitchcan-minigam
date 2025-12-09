/**
 * WebBeep Port - Node.js Unit Tests
 *
 * Run with: node test.mjs
 */

// Polyfill TextEncoder/TextDecoder for Node
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import { Constants } from './constants.js';
import { Maps } from './maps.js';
import { WaveMaker } from './wavemaker.js';
import { Goertzel } from './goertzel.js';
import { Encoder } from './encoder.js';
import { Decoder } from './decoder.js';

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
        console.log('\n=== WebBeep (DanjaBeep) Port Tests ===\n');

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
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(message || `Expected ${expected} ± ${tolerance}, got ${actual}`);
    }
}

const runner = new TestRunner();

// ============ Constants Tests ============

runner.test('Constants should have valid sample rate', () => {
    assertEquals(Constants.SAMPLE_RATE, 22050);
});

runner.test('Constants should have valid amplitude', () => {
    assertClose(Constants.AMPLITUDE, 0.49, 0.01);
});

runner.test('Constants should have valid timing values', () => {
    assert(Constants.TONE_DURATION > 0, 'Tone duration should be positive');
    assert(Constants.ATTACK_PROPORTION >= 0 && Constants.ATTACK_PROPORTION <= 1);
    assert(Constants.DECAY_PROPORTION >= 0 && Constants.DECAY_PROPORTION <= 1);
});

// ============ Maps Tests ============

runner.test('Maps should have 8 low frequencies', () => {
    assertEquals(Maps.LOW_FREQ.length, 8);
});

runner.test('Maps should have 16 high frequencies', () => {
    assertEquals(Maps.HIGH_FREQ.length, 16);
});

runner.test('Maps frequencies should be in audible range', () => {
    for (const f of Maps.LOW_FREQ) {
        assert(f >= 200 && f <= 1000, `Low freq ${f} out of range`);
    }
    for (const f of Maps.HIGH_FREQ) {
        assert(f >= 400 && f <= 2000, `High freq ${f} out of range`);
    }
});

runner.test('Maps findNearestNote should find exact match', () => {
    const index = Maps.findNearestNote(261.63, Maps.LOW_FREQ);
    assertEquals(index, 0);
});

runner.test('Maps findNearestNote should find closest', () => {
    const index = Maps.findNearestNote(265, Maps.LOW_FREQ);
    assertEquals(index, 0); // Should be closest to 261.63
});

// ============ WaveMaker Tests ============

runner.test('WaveMaker should make silence', () => {
    const silence = WaveMaker.makeSilence(0.1, Constants.SAMPLE_RATE);
    assertEquals(silence.length, Math.floor(0.1 * Constants.SAMPLE_RATE));
    for (const s of silence) {
        assertEquals(s, 0);
    }
});

runner.test('WaveMaker should make tone', () => {
    const tone = WaveMaker.makeTone(440, 0.1, Constants.SAMPLE_RATE);
    assert(tone.length > 0, 'Should produce samples');
    assert(tone instanceof Float32Array, 'Should be Float32Array');
});

runner.test('WaveMaker tone should have correct amplitude', () => {
    const tone = WaveMaker.makeTone(440, 0.1, Constants.SAMPLE_RATE);
    let maxAbs = 0;
    for (const s of tone) {
        maxAbs = Math.max(maxAbs, Math.abs(s));
    }
    assert(maxAbs <= Constants.AMPLITUDE, 'Should not exceed amplitude');
    assert(maxAbs > 0.1, 'Should have some signal');
});

runner.test('WaveMaker should make dual tone', () => {
    const dualTone = WaveMaker.makeDualTone(0, 0, Constants.SAMPLE_RATE);
    assert(dualTone.length > 0, 'Should produce samples');
});

runner.test('WaveMaker should apply envelope', () => {
    const samples = new Float32Array(1000).fill(1);
    const shaped = WaveMaker.applyEnvelope(samples, Constants.SAMPLE_RATE);

    // First sample should be near zero (attack)
    assert(shaped[0] < 0.1, 'Start should be faded in');
    // Last sample should be near zero (decay)
    assert(shaped[shaped.length - 1] < 0.1, 'End should be faded out');
    // Middle should be near 1
    assert(shaped[500] > 0.8, 'Middle should be near full amplitude');
});

runner.test('WaveMaker should merge chunks', () => {
    const chunk1 = new Float32Array([1, 2, 3]);
    const chunk2 = new Float32Array([4, 5]);
    const merged = WaveMaker.mergeChunks([chunk1, chunk2]);

    assertEquals(merged.length, 5);
    assertEquals(merged[0], 1);
    assertEquals(merged[3], 4);
});

// ============ Goertzel Tests ============

runner.test('Goertzel should detect pure tone', () => {
    // Generate 440 Hz tone
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 440 * i / Constants.SAMPLE_RATE);
    }

    const mag440 = Goertzel.getMagnitude(samples, 440, Constants.SAMPLE_RATE);
    const mag500 = Goertzel.getMagnitude(samples, 500, Constants.SAMPLE_RATE);

    assert(mag440 > mag500 * 2, 'Should detect 440 Hz stronger than 500 Hz');
});

runner.test('Goertzel findPeak should find strongest', () => {
    // Generate 880 Hz tone
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 880 * i / Constants.SAMPLE_RATE);
    }

    const result = Goertzel.findPeak(samples, [440, 660, 880, 1000], Constants.SAMPLE_RATE);
    assertEquals(result.frequency, 880);
});

runner.test('Goertzel detect should work', () => {
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 440 * i / Constants.SAMPLE_RATE);
    }

    const detected = Goertzel.detect(samples, 440, Constants.SAMPLE_RATE, 0.01);
    assert(detected, 'Should detect 440 Hz');
});

// ============ Encoder Tests ============

runner.test('Encoder should calculate checksum', () => {
    const bytes = new Uint8Array([65, 66, 67]); // ABC
    const checksum = Encoder.calculateChecksum(bytes);
    assert(checksum >= 0 && checksum <= 255, 'Checksum should be byte');
});

runner.test('Encoder checksum should be verifiable', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // Hello
    const checksum = Encoder.calculateChecksum(data);
    const withChecksum = new Uint8Array([...data, checksum]);

    assert(Encoder.verifyChecksum(withChecksum), 'Checksum should verify');
});

runner.test('Encoder should detect bad checksum', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111, 99]); // Hello + wrong
    assert(!Encoder.verifyChecksum(data), 'Should detect bad checksum');
});

runner.test('Encoder should encode string to samples', () => {
    const samples = Encoder.encode('Hi');
    assert(samples instanceof Float32Array, 'Should return Float32Array');
    assert(samples.length > 0, 'Should have samples');
});

runner.test('Encoder samples should be normalized', () => {
    const samples = Encoder.encode('test');
    let maxAbs = 0;
    for (const s of samples) {
        maxAbs = Math.max(maxAbs, Math.abs(s));
    }
    assert(maxAbs <= 1.0, 'Should be normalized to [-1, 1]');
    assert(maxAbs > 0.5, 'Should have signal');
});

runner.test('Encoder should produce longer output for longer strings', () => {
    const short = Encoder.encode('Hi');
    const long = Encoder.encode('Hello World');
    assert(long.length > short.length, 'Longer string = more samples');
});

runner.test('Encoder getStats should return metrics', () => {
    const stats = Encoder.getStats('test');
    assertEquals(stats.inputLength, 4);
    assertEquals(stats.byteLength, 4);
    assertEquals(stats.totalBytes, 5); // +1 for checksum
    assert(stats.estimatedDurationMs > 0, 'Should have duration');
});

// ============ Decoder Tests ============

runner.test('Decoder normalize should work', () => {
    const samples = new Float32Array([0.5, -0.5, 0.25]);
    const normalized = Decoder.normalize(samples);
    assertEquals(normalized[0], 1.0);
    assertEquals(normalized[1], -1.0);
    assertEquals(normalized[2], 0.5);
});

runner.test('Decoder cropSilence should remove silence', () => {
    const samples = new Float32Array(1000);
    // Add signal in middle
    for (let i = 400; i < 600; i++) {
        samples[i] = 0.5;
    }
    const cropped = Decoder.cropSilence(samples);
    assert(cropped.length < samples.length, 'Should be shorter');
    assert(cropped.length > 100, 'Should have signal');
});

runner.test('Decoder should decode chunk', () => {
    // Create a chunk with known frequencies
    const lowFreq = Maps.LOW_FREQ[0];
    const highFreq = Maps.HIGH_FREQ[0];
    const chunk = new Float32Array(1024);
    for (let i = 0; i < chunk.length; i++) {
        const t = i / Constants.SAMPLE_RATE;
        chunk[i] = (Math.sin(2 * Math.PI * lowFreq * t) +
                    Math.sin(2 * Math.PI * highFreq * t)) * 0.5;
    }

    const result = Decoder.decodeChunk(chunk, Constants.SAMPLE_RATE);
    assert(result.byte !== null, 'Should decode a byte');
});

// ============ Roundtrip Tests ============

runner.test('Encode then decode should roundtrip single byte', () => {
    // Encode 'A' (65)
    const dualTone = Encoder.byteToDualTone(65, Constants.SAMPLE_RATE);
    const result = Decoder.decodeChunk(dualTone, Constants.SAMPLE_RATE);

    assertEquals(result.byte, 65, 'Should decode to 65');
});

runner.test('Encode then decode should decode something', () => {
    const original = 'Hi';
    const encoded = Encoder.encode(original, Constants.SAMPLE_RATE);
    const decoded = Decoder.decode(encoded, Constants.SAMPLE_RATE);

    // Note: Full string roundtrip requires precise chunk alignment
    // This test verifies the decoder runs without error
    assert(decoded.chunks.length > 0, 'Should have decoded chunks');
    // Roundtrip precision depends on proper chunk boundaries
    // which requires signal analysis or markers in the audio
});

// ============ URL/Identifier Tests ============

runner.test('Encoder should handle URL', () => {
    const samples = Encoder.encode('https://example.com');
    assert(samples.length > 0, 'Should encode URL');
});

runner.test('Encoder should handle special characters', () => {
    const samples = Encoder.encode('user@example.com');
    assert(samples.length > 0, 'Should encode email');
});

runner.test('Encoder should handle identifier', () => {
    const samples = Encoder.encode('ID:12345');
    assert(samples.length > 0, 'Should encode identifier');
});

// Run tests
runner.run().then(success => {
    process.exit(success ? 0 : 1);
});
