/**
 * WebGPU Headless Availability Test
 *
 * This test checks if WebGPU is available in headless Chromium.
 * It's marked as `.fails` because as of Jan 2026, WebGPU is NOT available
 * in Playwright's headless mode even with SwiftShader flags.
 *
 * IMPORTANT: If this test starts PASSING, it means WebGPU headless is now
 * available and we can enable WGSL visual verification tests!
 *
 * The `webgpuAvailable` export can be imported by other tests to conditionally
 * skip WGSL-specific tests when WebGPU is unavailable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { chromium } from 'playwright';

// Shared state - other tests can import this to decide whether to skip
export let webgpuAvailable = false;
export let webgpuError = null;

describe('WebGPU Headless Availability', () => {
  // This test is expected to FAIL in current headless environments
  // Using .fails means: if it fails, the suite passes; if it passes, suite fails
  // This alerts us when WebGPU becomes available!
  it.fails('should have WebGPU available in headless Chromium', { timeout: 30000 }, async () => {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--enable-unsafe-webgpu',
        '--use-webgpu-adapter=swiftshader',
        '--use-angle=vulkan',
        '--use-vulkan=swiftshader',
        '--disable-vulkan-surface',
        '--no-sandbox'
      ]
    });

    const page = await browser.newPage();

    const gpuStatus = await page.evaluate(async () => {
      if (!navigator.gpu) {
        return { error: "WebGPU (navigator.gpu) is not defined." };
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({
          forceFallbackAdapter: true
        });

        if (!adapter) {
          return { error: "No WebGPU adapter found (even with fallback)." };
        }

        const info = await adapter.requestAdapterInfo();
        return {
          available: true,
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
          isFallback: adapter.isFallbackAdapter || false
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    await browser.close();

    // Update shared state for other tests
    if (gpuStatus.error) {
      webgpuError = gpuStatus.error;
      webgpuAvailable = false;
    } else {
      webgpuAvailable = true;
    }

    // This assertion is expected to FAIL (hence .fails above)
    // When it starts passing, we'll know WebGPU headless works!
    expect(gpuStatus.error).toBeUndefined();
    expect(gpuStatus.available).toBe(true);
  });
});

/**
 * Helper for other test files to skip WGSL tests when WebGPU unavailable.
 *
 * Usage in other test files:
 *
 * ```js
 * import { skipIfNoWebGPU } from './webgpu-availability.test.js';
 *
 * describe('WGSL Rendering Tests', () => {
 *   beforeAll(() => skipIfNoWebGPU());
 *
 *   it('should render correctly in Stinkyfish', async () => {
 *     // This test will be skipped if WebGPU unavailable
 *   });
 * });
 * ```
 */
export function skipIfNoWebGPU() {
  if (!webgpuAvailable) {
    console.log('⏭️  Skipping: WebGPU not available in headless environment');
    // In Vitest, we can't dynamically skip from beforeAll
    // Tests should use it.skipIf(!webgpuAvailable) instead
  }
}

/**
 * Vitest skipIf helper - use in test definitions
 *
 * Usage:
 * ```js
 * import { webgpuAvailable } from './webgpu-availability.test.js';
 *
 * it.skipIf(!webgpuAvailable)('WGSL rendering test', async () => {
 *   // Only runs if WebGPU is available
 * });
 * ```
 */
