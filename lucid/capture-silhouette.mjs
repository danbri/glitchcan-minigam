// Multi-angle silhouette capture for blind evaluation
// Uses single model, rotates camera via JavaScript
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const SCENE = 'creatures.subag1.silhouette-v1';

// Camera angles: [theta, phi, distance, name]
const ANGLES = [
  { theta: 0,    phi: 0.2, distance: 10, name: 'side' },
  { theta: 1.57, phi: 0.15, distance: 10, name: 'front' },
  { theta: 0.4,  phi: 0.3, distance: 10, name: 'three-quarter' }
];

async function main() {
  mkdirSync('lucid/screenshots/silhouette', { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--headless=new']
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

  // Load the scene once
  const url = `${BASE_URL}/lucid/index.html#${SCENE}`;
  console.log(`Loading: ${url}`);
  await page.goto(url);
  await page.waitForTimeout(3000); // Wait for initial render

  // Capture from each angle
  for (const angle of ANGLES) {
    console.log(`Setting camera: theta=${angle.theta}, phi=${angle.phi}`);

    // Set camera via JavaScript
    await page.evaluate(({ theta, phi, distance }) => {
      if (window.renderer && window.renderer.camera) {
        window.renderer.camera.theta = theta;
        window.renderer.camera.phi = phi;
        window.renderer.camera.distance = distance;
      }
    }, angle);

    // Wait for re-render
    await page.waitForTimeout(500);

    // Screenshot
    const path = `lucid/screenshots/silhouette/${angle.name}.png`;
    await page.screenshot({ path });
    console.log(`Captured: ${path}`);
  }

  await browser.close();
  console.log('\nDone. Screenshots in lucid/screenshots/silhouette/');
  console.log('\nFor blind eval, show these WITHOUT mentioning target subject.');
  console.log('Ask: "What does this 3D model look like to you?"');
}

main().catch(console.error);
