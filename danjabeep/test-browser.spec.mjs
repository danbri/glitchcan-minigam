/**
 * Playwright Browser Tests for DanjaBeep (WebBeep Port)
 *
 * Run with:
 *   npx playwright test danjabeep/test-browser.spec.mjs
 */

import { test, expect } from '@playwright/test';

test.describe('DanjaBeep - WebBeep Port', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/danjabeep/test-browser.html');
    });

    test('page loads correctly', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('DanjaBeep');
    });

    test('all modules are loaded', async ({ page }) => {
        const loaded = await page.evaluate(() => {
            return {
                Constants: typeof window.Constants !== 'undefined',
                Maps: typeof window.Maps !== 'undefined',
                WaveMaker: typeof window.WaveMaker !== 'undefined',
                Goertzel: typeof window.Goertzel !== 'undefined',
                Encoder: typeof window.Encoder !== 'undefined',
                Decoder: typeof window.Decoder !== 'undefined'
            };
        });
        expect(loaded.Constants).toBe(true);
        expect(loaded.Maps).toBe(true);
        expect(loaded.WaveMaker).toBe(true);
        expect(loaded.Goertzel).toBe(true);
        expect(loaded.Encoder).toBe(true);
        expect(loaded.Decoder).toBe(true);
    });

    test('Constants has correct values', async ({ page }) => {
        const constants = await page.evaluate(() => ({
            sampleRate: window.Constants.SAMPLE_RATE,
            amplitude: window.Constants.AMPLITUDE,
            toneDuration: window.Constants.TONE_DURATION
        }));
        expect(constants.sampleRate).toBe(22050);
        expect(constants.amplitude).toBeCloseTo(0.49, 2);
        expect(constants.toneDuration).toBeGreaterThan(0);
    });

    test('Maps has pentatonic frequencies', async ({ page }) => {
        const maps = await page.evaluate(() => ({
            lowFreqLength: window.Maps.LOW_FREQ.length,
            highFreqLength: window.Maps.HIGH_FREQ.length,
            lowFirst: window.Maps.LOW_FREQ[0],
            highFirst: window.Maps.HIGH_FREQ[0]
        }));
        expect(maps.lowFreqLength).toBe(8);
        expect(maps.highFreqLength).toBe(16);
        expect(maps.lowFirst).toBeCloseTo(261.63, 1);  // C4
        expect(maps.highFirst).toBeCloseTo(523.25, 1); // C5
    });

    test('WaveMaker creates dual tones', async ({ page }) => {
        const result = await page.evaluate(() => {
            const tone = window.WaveMaker.makeDualTone(0, 0);
            return {
                isFloat32: tone instanceof Float32Array,
                length: tone.length,
                hasSignal: Math.max(...Array.from(tone).map(Math.abs)) > 0.1
            };
        });
        expect(result.isFloat32).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.hasSignal).toBe(true);
    });

    test('Goertzel detects frequencies accurately', async ({ page }) => {
        const result = await page.evaluate(() => {
            const samples = new Float32Array(2048);
            for (let i = 0; i < samples.length; i++) {
                samples[i] = Math.sin(2 * Math.PI * 440 * i / 22050);
            }
            const result = window.Goertzel.findPeak(samples, [220, 440, 880], 22050);
            return { detectedFreq: result.frequency };
        });
        expect(result.detectedFreq).toBe(440);
    });

    test('Encoder produces valid samples', async ({ page }) => {
        const result = await page.evaluate(() => {
            const samples = window.Encoder.encode('test');
            return {
                isFloat32: samples instanceof Float32Array,
                length: samples.length,
                maxAbs: Math.max(...Array.from(samples).map(Math.abs))
            };
        });
        expect(result.isFloat32).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.maxAbs).toBeLessThanOrEqual(1.0);
    });

    test('Encoder checksum is verifiable', async ({ page }) => {
        const result = await page.evaluate(() => {
            const data = new Uint8Array([72, 101, 108, 108, 111]);
            const cs = window.Encoder.calculateChecksum(data);
            const withCs = new Uint8Array([...data, cs]);
            return window.Encoder.verifyChecksum(withCs);
        });
        expect(result).toBe(true);
    });

    test('Encoder generates WAV blob', async ({ page }) => {
        const result = await page.evaluate(() => {
            const blob = window.Encoder.generateWav('test');
            return {
                isBlob: blob instanceof Blob,
                type: blob.type,
                size: blob.size
            };
        });
        expect(result.isBlob).toBe(true);
        expect(result.type).toBe('audio/wav');
        expect(result.size).toBeGreaterThan(44);
    });

    test('Encoder getStats provides metrics', async ({ page }) => {
        const stats = await page.evaluate(() => {
            return window.Encoder.getStats('Hello');
        });
        expect(stats.inputLength).toBe(5);
        expect(stats.byteLength).toBe(5);
        expect(stats.totalBytes).toBe(6); // +1 checksum
        expect(stats.estimatedDurationMs).toBeGreaterThan(0);
    });

    test('Single byte encode/decode roundtrip', async ({ page }) => {
        const result = await page.evaluate(() => {
            const tone = window.Encoder.byteToDualTone(65); // 'A'
            const decoded = window.Decoder.decodeChunk(tone, 22050);
            return { decodedByte: decoded.byte };
        });
        expect(result.decodedByte).toBe(65);
    });

    test('Encoder handles URLs', async ({ page }) => {
        const result = await page.evaluate(() => {
            const samples = window.Encoder.encode('https://example.com/path?q=1');
            return { length: samples.length };
        });
        expect(result.length).toBeGreaterThan(0);
    });

    test('run embedded test suite', async ({ page }) => {
        await page.evaluate(() => window.runTests());
        await page.waitForFunction(() => window.testResults !== undefined);

        const results = await page.evaluate(() => window.testResults);
        expect(results.failed).toBe(0);
        expect(results.passed).toBeGreaterThan(15);
    });

});
