// WebGPU Headless Availability Test
// Usage: node lucid/test-webgpu-headless.mjs
//
// This script tests whether WebGPU is available in headless Chromium.
// As of Jan 2026, WebGPU is NOT available in Playwright's headless mode
// even with SwiftShader flags. This test documents that limitation.

import { chromium } from 'playwright';

export async function testWebGPUAvailability() {
  console.log("🚀 Launching Chromium with WebGPU Emulation...");

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: [
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader', // Force software backend
      '--use-angle=vulkan',                // WebGPU on Linux needs Vulkan
      '--use-vulkan=swiftshader',          // Direct Vulkan to use software
      '--disable-vulkan-surface',          // Required for headless/no-display
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();

  // Visit a blank page and check the GPU adapter
  const gpuStatus = await page.evaluate(async () => {
    if (!navigator.gpu) {
      return { error: "WebGPU (navigator.gpu) is not defined." };
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        forceFallbackAdapter: true // Explicitly ask for software if available
      });

      if (!adapter) {
        return { error: "No WebGPU adapter found (even with fallback)." };
      }

      const info = await adapter.requestAdapterInfo();
      return {
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

  console.log("--- WebGPU Status Report ---");
  console.table(gpuStatus);

  await browser.close();

  if (gpuStatus.error) {
    console.error("❌ WebGPU failed to initialize.");
    return { available: false, error: gpuStatus.error };
  } else {
    console.log("✅ WebGPU is successfully emulated via SwiftShader!");
    return { available: true, info: gpuStatus };
  }
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  testWebGPUAvailability()
    .then(result => {
      process.exit(result.available ? 0 : 1);
    })
    .catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}
