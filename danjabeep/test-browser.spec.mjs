/**
 * Playwright Browser Tests for DanjaBeep
 *
 * Run with:
 *   npx playwright test danjabeep/test-browser.spec.mjs
 *
 * Or install and run:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test
 */

import { test, expect } from '@playwright/test';

// Start a local server for testing
test.describe('DanjaBeep Audio Encoder/Decoder', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to test page - assumes server running on port 8080
        await page.goto('/danjabeep/test-browser.html');
    });

    test('page loads correctly', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('DanjaBeep');
    });

    test('StringAudioEncoder is available', async ({ page }) => {
        const isDefined = await page.evaluate(() => {
            return typeof window.StringAudioEncoder !== 'undefined';
        });
        expect(isDefined).toBe(true);
    });

    test('StringAudioDecoder is available', async ({ page }) => {
        const isDefined = await page.evaluate(() => {
            return typeof window.StringAudioDecoder !== 'undefined';
        });
        expect(isDefined).toBe(true);
    });

    test('encode produces valid audio samples', async ({ page }) => {
        const result = await page.evaluate(() => {
            const samples = window.StringAudioEncoder.encode('test');
            return {
                isFloat32Array: samples instanceof Float32Array,
                length: samples.length,
                hasSignal: Math.max(...samples.map(Math.abs)) > 0.5
            };
        });
        expect(result.isFloat32Array).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.hasSignal).toBe(true);
    });

    test('encode handles different string lengths', async ({ page }) => {
        const result = await page.evaluate(() => {
            const short = window.StringAudioEncoder.encode('Hi');
            const long = window.StringAudioEncoder.encode('Hello World!');
            return {
                shortLength: short.length,
                longLength: long.length
            };
        });
        expect(result.longLength).toBeGreaterThan(result.shortLength);
    });

    test('CRC16 is deterministic', async ({ page }) => {
        const result = await page.evaluate(() => {
            const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
            const crc1 = window.StringAudioEncoder.crc16(data);
            const crc2 = window.StringAudioEncoder.crc16(data);
            return { crc1, crc2, match: crc1 === crc2 };
        });
        expect(result.match).toBe(true);
    });

    test('bytesToQuaternary roundtrip preserves data', async ({ page }) => {
        const result = await page.evaluate(() => {
            const original = new Uint8Array([0x12, 0x34, 0xAB, 0xCD]);
            const quad = window.StringAudioEncoder.bytesToQuaternary(original);
            const restored = window.StringAudioEncoder.quaternaryToBytes(quad);
            return {
                original: Array.from(original),
                restored: Array.from(restored),
                match: original.every((v, i) => v === restored[i])
            };
        });
        expect(result.match).toBe(true);
    });

    test('generateWav produces valid WAV blob', async ({ page }) => {
        const result = await page.evaluate(() => {
            const wav = window.StringAudioEncoder.generateWav('test');
            return {
                isBlob: wav instanceof Blob,
                size: wav.size,
                type: wav.type
            };
        });
        expect(result.isBlob).toBe(true);
        expect(result.size).toBeGreaterThan(44); // WAV header is 44 bytes
        expect(result.type).toBe('audio/wav');
    });

    test('getStats provides encoding metrics', async ({ page }) => {
        const result = await page.evaluate(() => {
            const stats = window.StringAudioEncoder.getStats('hello');
            return {
                hasInputLength: 'inputLength' in stats,
                hasByteLength: 'byteLength' in stats,
                hasSymbolCount: 'symbolCount' in stats,
                hasDuration: 'durationMs' in stats,
                hasCrc: 'crc16' in stats,
                inputLength: stats.inputLength,
                byteLength: stats.byteLength
            };
        });
        expect(result.hasInputLength).toBe(true);
        expect(result.hasByteLength).toBe(true);
        expect(result.hasSymbolCount).toBe(true);
        expect(result.hasDuration).toBe(true);
        expect(result.hasCrc).toBe(true);
        expect(result.inputLength).toBe(5);
        expect(result.byteLength).toBe(5);
    });

    test('handles UTF-8 encoding correctly', async ({ page }) => {
        const result = await page.evaluate(() => {
            const stats = window.StringAudioEncoder.getStats('日本');
            return {
                inputLength: stats.inputLength,
                byteLength: stats.byteLength
            };
        });
        expect(result.inputLength).toBe(2);      // 2 characters
        expect(result.byteLength).toBe(6);       // 6 bytes in UTF-8
    });

    test('handles URL strings', async ({ page }) => {
        const result = await page.evaluate(() => {
            const url = 'https://example.com/path?query=1&foo=bar';
            const samples = window.StringAudioEncoder.encode(url);
            const stats = window.StringAudioEncoder.getStats(url);
            return {
                samplesLength: samples.length,
                inputLength: stats.inputLength,
                durationMs: stats.durationMs
            };
        });
        expect(result.samplesLength).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThan(0);
    });

    test('handles special characters', async ({ page }) => {
        const result = await page.evaluate(() => {
            const text = 'user@example.com!#$%';
            const samples = window.StringAudioEncoder.encode(text);
            return {
                success: samples.length > 0,
                sampleCount: samples.length
            };
        });
        expect(result.success).toBe(true);
    });

    test('decoder frequencyToSymbol maps frequencies correctly', async ({ page }) => {
        const result = await page.evaluate(() => {
            const D = window.StringAudioDecoder;
            return {
                sym0: D.frequencyToSymbol(16400),
                sym1: D.frequencyToSymbol(17000),
                symX: D.frequencyToSymbol(17500),
                sym3: D.frequencyToSymbol(18000),
                sym2: D.frequencyToSymbol(18600)
            };
        });
        expect(result.sym0).toBe('0');
        expect(result.sym1).toBe('1');
        expect(result.symX).toBe('X');
        expect(result.sym3).toBe('3');
        expect(result.sym2).toBe('2');
    });

    test('run all embedded browser tests', async ({ page }) => {
        // Run the test suite embedded in the HTML
        await page.evaluate(() => window.runTests());

        // Wait for tests to complete
        await page.waitForFunction(() => window.testResults !== undefined);

        const results = await page.evaluate(() => window.testResults);
        expect(results.failed).toBe(0);
        expect(results.passed).toBeGreaterThan(0);
    });

    test('frequencies are in ultrasonic range', async ({ page }) => {
        const result = await page.evaluate(() => {
            const freqs = Object.values(window.StringAudioEncoder.FREQUENCIES);
            return {
                min: Math.min(...freqs),
                max: Math.max(...freqs),
                allInRange: freqs.every(f => f >= 16000 && f <= 20000)
            };
        });
        expect(result.allInRange).toBe(true);
        expect(result.min).toBeGreaterThanOrEqual(16000);
        expect(result.max).toBeLessThanOrEqual(20000);
    });

    test('interleaveWithCarrier produces correct pattern', async ({ page }) => {
        const result = await page.evaluate(() => {
            const interleaved = window.StringAudioEncoder.interleaveWithCarrier('0123');
            return {
                pattern: interleaved,
                startsWithX: interleaved.startsWith('X'),
                endsWithX: interleaved.endsWith('X')
            };
        });
        expect(result.pattern).toBe('X0X1X2X3X');
        expect(result.startsWithX).toBe(true);
        expect(result.endsWithX).toBe(true);
    });

});
