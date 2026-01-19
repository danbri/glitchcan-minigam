// Automatic modeling workflow: capture renders for blind evaluation
// Usage: node capture-silhouette.mjs [scene-hash] [output-dir] [--backend=mayfly|stinkyfish]
// Example: node capture-silhouette.mjs creatures.wolf ./eval-shots --backend=stinkyfish
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const SCENE = process.argv[2] || 'creatures.subag1.silhouette-v5';
const OUTPUT_DIR = process.argv[3] || 'lucid/screenshots/eval';

// Parse --backend flag
const backendArg = process.argv.find(a => a.startsWith('--backend='));
const BACKEND = backendArg ? backendArg.split('=')[1] : null;

// Check for --webgpu flag (enables WebGPU-specific browser args)
const ENABLE_WEBGPU = process.argv.includes('--webgpu') || BACKEND === 'stinkyfish';

// Camera angles: 6 neutral viewpoints for comprehensive evaluation
const ANGLES = [
  { theta: 0.0,  phi: 0.3, distance: 12, name: '1' },   // front-side
  { theta: 0.5,  phi: 0.4, distance: 12, name: '2' },   // 3/4 view
  { theta: 0.8,  phi: 0.6, distance: 14, name: '3' },   // above-side
  { theta: 1.57, phi: 0.35, distance: 12, name: '4' },  // opposite side
  { theta: 0.25, phi: 0.15, distance: 13, name: '5' },  // low angle
  { theta: 1.2,  phi: 0.5, distance: 13, name: '6' }    // high 3/4
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Browser launch args - include WebGPU flags if requested
  const baseArgs = ['--headless=new', '--no-sandbox'];
  const webgpuArgs = [
    '--enable-unsafe-webgpu',             // Mandatory for WebGPU in headless
    '--use-angle=vulkan',                 // Directs ANGLE to use Vulkan
    '--use-vulkan=swiftshader',           // Forces the software Vulkan driver
    '--disable-vulkan-surface',           // Required for Linux/Headless stability
    '--disable-vulkan-fallback-to-gl-for-testing',
    '--ignore-gpu-blocklist',             // Bypasses "unsupported" hardware warnings
  ];

  const launchArgs = ENABLE_WEBGPU ? [...baseArgs, ...webgpuArgs] : baseArgs;

  if (ENABLE_WEBGPU) {
    console.log('WebGPU mode enabled with Vulkan/SwiftShader flags');
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: launchArgs
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

  // Add backend parameter to URL if specified
  const backendParam = BACKEND ? `?backend=${BACKEND}` : '';
  const url = `${BASE_URL}/lucid/index.html${backendParam}#${SCENE}`;
  console.log(`Loading: ${url}`);

  // Capture console messages to detect WebGPU availability
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebGPU') || text.includes('backend') || text.includes('GPU')) {
      console.log(`[browser] ${text}`);
    }
  });

  await page.goto(url);
  await page.waitForTimeout(3000);

  // Check which backend is actually being used
  const actualBackend = await page.evaluate(() => {
    if (window.renderer) {
      return window.renderer.backendName || window.renderer.constructor?.name || 'unknown';
    }
    return 'no renderer';
  });
  console.log(`Active backend: ${actualBackend}`);

  // Find the canvas element for cropped screenshots (no UI)
  const canvas = await page.$('canvas');

  for (const angle of ANGLES) {
    await page.evaluate(({ theta, phi, distance }) => {
      if (window.renderer && window.renderer.camera) {
        window.renderer.camera.theta = theta;
        window.renderer.camera.phi = phi;
        window.renderer.camera.distance = distance;
        // Force re-render after camera change
        if (window.renderer.render) {
          window.renderer.render();
        }
      }
    }, angle);

    await page.waitForTimeout(500);

    // Screenshot ONLY the canvas - no UI, no title, truly blind
    const path = `${OUTPUT_DIR}/${angle.name}.png`;
    if (canvas) {
      await canvas.screenshot({ path });
    } else {
      await page.screenshot({ path });
    }
    console.log(`Captured: ${path}`);
  }

  await browser.close();
  console.log(`\nDone. ${ANGLES.length} renders in ${OUTPUT_DIR}/`);
  console.log('For blind eval: "What creature/object is this?"');
}

main().catch(console.error);
