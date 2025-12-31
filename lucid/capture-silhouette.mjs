// Multi-angle silhouette capture for blind evaluation
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// 3 angles: front, side, 3/4 view
const ANGLES = [
  { hash: 'creatures.subag1.silhouette-front', name: 'angle1' },
  { hash: 'creatures.subag1.silhouette-side', name: 'angle2' },
  { hash: 'creatures.subag1.silhouette-v1', name: 'angle3' }
];

async function captureAngle(browser, sceneHash, outputPath) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

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
  mkdirSync('lucid/screenshots/silhouette', { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--headless=new']
  });

  for (const angle of ANGLES) {
    await captureAngle(browser, angle.hash, `lucid/screenshots/silhouette/${angle.name}.png`);
  }

  await browser.close();
  console.log('\\nDone. Screenshots in lucid/screenshots/silhouette/');
  console.log('\\nFor blind eval, show these to evaluator WITHOUT mentioning the target subject.');
  console.log('Ask: "What does this 3D model look like to you?"');
}

main().catch(console.error);
