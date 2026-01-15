#!/usr/bin/env node
/**
 * Timed multi-angle capture script for ABCD Parliament workflow
 *
 * Usage: node capture-timed.mjs <scene.model> [session-id]
 *
 * Outputs:
 *   - lucid/automodel/captures/<session-id>/*.png (12 viewpoints)
 *   - lucid/automodel/logs/<session-id>.json (timing + metadata)
 */

import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// 12 neutral viewpoints (doubled from 6)
const ANGLES = [
  { theta: 0.0,  phi: 0.3,  distance: 12, name: '01-front-side' },
  { theta: 0.5,  phi: 0.4,  distance: 12, name: '02-quarter-right' },
  { theta: 0.8,  phi: 0.6,  distance: 14, name: '03-above-right' },
  { theta: 1.57, phi: 0.35, distance: 12, name: '04-side-left' },
  { theta: 0.25, phi: 0.15, distance: 13, name: '05-low-front' },
  { theta: 1.2,  phi: 0.5,  distance: 13, name: '06-high-quarter' },
  { theta: 2.5,  phi: 0.35, distance: 12, name: '07-rear-quarter' },
  { theta: 3.14, phi: 0.4,  distance: 13, name: '08-rear' },
  { theta: 0.0,  phi: 0.0,  distance: 14, name: '09-top-down' },
  { theta: 0.0,  phi: 0.8,  distance: 12, name: '10-front-low' },
  { theta: 0.78, phi: 0.25, distance: 11, name: '11-close-quarter' },
  { theta: 1.8,  phi: 0.55, distance: 15, name: '12-wide-side' }
];

function isoTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const startTime = Date.now();
  const timings = { total: 0, browser_launch: 0, page_load: 0, captures: [] };

  const scenePath = process.argv[2];
  const sessionId = process.argv[3] || isoTimestamp();

  if (!scenePath) {
    console.error('Usage: node capture-timed.mjs <scene.model> [session-id]');
    process.exit(1);
  }

  const captureDir = path.join('lucid/automodel/captures', sessionId);
  const logPath = path.join('lucid/automodel/logs', `${sessionId}.json`);

  await mkdir(captureDir, { recursive: true });

  const log = {
    session_id: sessionId,
    scene: scenePath,
    timestamp_start: new Date().toISOString(),
    timestamp_end: null,
    viewpoint_count: ANGLES.length,
    captures: [],
    timings: {}
  };

  // Browser launch timing
  const browserStart = Date.now();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  timings.browser_launch = Date.now() - browserStart;

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 800 });

  const url = `http://localhost:8080/lucid/index.html#${scenePath}`;

  // Page load timing
  const loadStart = Date.now();
  console.log(`Loading: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForTimeout(2000);
  timings.page_load = Date.now() - loadStart;

  const canvas = await page.$('canvas');

  for (const angle of ANGLES) {
    const captureStart = Date.now();

    await page.evaluate(({ theta, phi, distance }) => {
      if (window.renderer && window.renderer.camera) {
        window.renderer.camera.theta = theta;
        window.renderer.camera.phi = phi;
        window.renderer.camera.distance = distance;
        if (window.renderer.render) {
          window.renderer.render();
        }
      }
    }, angle);

    await page.waitForTimeout(500);

    const filename = `${angle.name}.png`;
    const filepath = path.join(captureDir, filename);
    await canvas.screenshot({ path: filepath });

    const captureTime = Date.now() - captureStart;
    timings.captures.push({ name: angle.name, ms: captureTime });

    log.captures.push({
      filename,
      angle: { theta: angle.theta, phi: angle.phi, distance: angle.distance },
      capture_time_ms: captureTime
    });

    console.log(`Captured: ${filepath} (${captureTime}ms)`);
  }

  await browser.close();

  timings.total = Date.now() - startTime;
  log.timestamp_end = new Date().toISOString();
  log.timings = timings;

  await writeFile(logPath, JSON.stringify(log, null, 2));

  console.log(`\nDone. ${ANGLES.length} renders in ${captureDir}/`);
  console.log(`Log: ${logPath}`);
  console.log(`Total time: ${timings.total}ms`);
  console.log(`  Browser launch: ${timings.browser_launch}ms`);
  console.log(`  Page load: ${timings.page_load}ms`);
  console.log(`  Avg capture: ${Math.round(timings.captures.reduce((a,b) => a + b.ms, 0) / timings.captures.length)}ms`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
