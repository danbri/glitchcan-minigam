// Screenshot comparison script for context-ablated evaluation
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const CANDIDATES = [
  'creatures.subag1.round3.r3-a',
  'creatures.subag1.round3.r3-b',
  'creatures.subag1.round3.r3-c'
];

async function captureCandidate(browser, sceneHash, outputPath) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

  // Use URL hash deep linking to load specific scene
  const url = `${BASE_URL}/lucid/index.html#${sceneHash}`;
  console.log(`Loading: ${url}`);
  await page.goto(url);

  // Wait for scene to render
  await page.waitForTimeout(4000);

  // Take screenshot
  await page.screenshot({ path: outputPath });
  console.log(`Captured: ${outputPath}`);

  await page.close();
}

async function main() {
  mkdirSync('lucid/screenshots', { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--headless=new']  // Use new headless mode
  });

  for (const sceneHash of CANDIDATES) {
    const name = sceneHash.split('.').pop();
    await captureCandidate(browser, sceneHash, `lucid/screenshots/${name}.png`);
  }

  await browser.close();
  console.log('Done. Screenshots in lucid/screenshots/');
}

main().catch(console.error);
