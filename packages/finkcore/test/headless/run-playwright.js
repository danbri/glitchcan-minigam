// Optional headless runner using Playwright (requires: npm i -D playwright)
// Loads the headless page and runs a FINK sample end-to-end in a real browser engine.

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  let playwright;
  try {
    // Dynamically import to avoid hard dependency in this repo
    playwright = await import('playwright');
  } catch (e) {
    console.error('Playwright not installed. Run: npm i -D playwright');
    process.exit(1);
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const runnerPath = resolve(__dirname, '../../headless/page.html');
  await page.goto(pathToFileURL(runnerPath).href);

  // Ensure inkjs is present
  const hasInk = await page.evaluate(() => !!(window.inkjs && window.inkjs.Compiler));
  if (!hasInk) {
    console.error('inkjs not available in the headless page (likely offline).');
    await browser.close();
    process.exit(2);
  }

  // Load a real FINK file from the repo to validate extraction/compilation
  const finkJsPath = resolve(__dirname, '../../../../inklet/bagend.fink.js');
  const jsSource = await readFile(finkJsPath, 'utf8');

  const result = await page.evaluate(async (src) => {
    return await window.gcfinkRunner.runFinkSource(src);
  }, jsSource);

  console.log('Lines:', result.lines.length);
  console.log('Choices at end:', result.choices.length);
  console.log('Ink length:', result.ink.length);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });

