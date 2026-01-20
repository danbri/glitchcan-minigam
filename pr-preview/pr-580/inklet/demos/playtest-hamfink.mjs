#!/usr/bin/env node
/**
 * Automated playtest for FINK 2-Engine Demo
 *
 * Explores the game via headless browser, collecting:
 * - Console logs (errors, warnings, debug info)
 * - Game state at each step
 * - Choice paths taken
 * - UX observations
 *
 * Usage: node playtest-hamfink.mjs [--url=...] [--max-steps=N] [--screenshots]
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://danbri.github.io/glitchcan-minigam';
const DEMO_PATH = '/inklet/demos/hamfink2026.html';
const MAX_STEPS = parseInt(process.argv.find(a => a.startsWith('--max-steps='))?.split('=')[1] || '30');
const TAKE_SCREENSHOTS = process.argv.includes('--screenshots');
const OUTPUT_DIR = './playtest-output';

// Game state tracking
const gameLog = {
  startTime: new Date().toISOString(),
  url: BASE_URL + DEMO_PATH,
  steps: [],
  consoleMessages: [],
  errors: [],
  uniqueTexts: new Set(),
  choicesMade: [],
  uxObservations: []
};

// UX issue patterns to watch for
const UX_PATTERNS = {
  slowLoad: { threshold: 3000, message: 'Slow content load detected' },
  emptyChoices: { pattern: /^\s*$/, message: 'Empty choice text' },
  brokenImage: { pattern: /failed to load|404|error/i, message: 'Image load failure' },
  scriptError: { pattern: /error|exception|undefined/i, message: 'JavaScript error' }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎮 FINK Playtest Starting...');
  console.log(`   URL: ${BASE_URL}${DEMO_PATH}`);
  console.log(`   Max steps: ${MAX_STEPS}`);
  console.log(`   Screenshots: ${TAKE_SCREENSHOTS ? 'enabled' : 'disabled'}`);

  if (TAKE_SCREENSHOTS) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Use system proxy if available (but skip for localhost)
  const proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy;
  const isLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
  const launchOptions = {
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--single-process'
    ]
  };

  const browser = await chromium.launch(launchOptions);

  // Create context with proxy if available (skip for localhost)
  const contextOptions = { };
  if (proxyUrl && !isLocalhost) {
    console.log(`   Using proxy: ${proxyUrl.slice(0, 50)}...`);
    contextOptions.proxy = { server: proxyUrl };
  } else if (isLocalhost) {
    console.log(`   Localhost detected - skipping proxy`);
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.setViewportSize({ width: 414, height: 896 }); // iPhone 11 Pro Max

  // Capture all console messages
  page.on('console', msg => {
    const entry = {
      time: new Date().toISOString(),
      type: msg.type(),
      text: msg.text()
    };
    gameLog.consoleMessages.push(entry);

    // Check for errors
    if (msg.type() === 'error') {
      gameLog.errors.push(entry);
      console.log(`  ❌ Console error: ${msg.text().slice(0, 100)}`);
    }

    // Log interesting messages
    if (msg.text().includes('FINK') || msg.text().includes('INK') ||
        msg.text().includes('Audio') || msg.text().includes('Error')) {
      console.log(`  📋 ${msg.type()}: ${msg.text().slice(0, 80)}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    gameLog.errors.push({
      time: new Date().toISOString(),
      type: 'pageerror',
      text: error.message
    });
    console.log(`  💥 Page error: ${error.message.slice(0, 100)}`);
  });

  // Navigate to demo
  console.log('\n📍 Loading demo page...');
  const loadStart = Date.now();
  await page.goto(BASE_URL + DEMO_PATH);
  const loadTime = Date.now() - loadStart;
  console.log(`   Loaded in ${loadTime}ms`);

  if (loadTime > UX_PATTERNS.slowLoad.threshold) {
    gameLog.uxObservations.push({
      step: 0,
      issue: 'Initial load slow',
      details: `${loadTime}ms to load`
    });
  }

  // Wait for initial story to render
  await delay(2000);

  // Take initial screenshot
  if (TAKE_SCREENSHOTS) {
    await page.screenshot({ path: `${OUTPUT_DIR}/step-00-initial.png` });
  }

  // Main playtest loop
  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`\n--- Step ${step} ---`);

    // Get current story text
    const storyText = await page.evaluate(() => {
      const output = document.getElementById('story-output');
      return output ? output.innerText : '';
    });

    // Get visible choices
    const choices = await page.evaluate(() => {
      const buttons = document.querySelectorAll('#choices button');
      return Array.from(buttons).map((btn, i) => ({
        index: i,
        text: btn.innerText.trim(),
        visible: btn.offsetParent !== null
      })).filter(c => c.visible);
    });

    // Log current state
    const stepData = {
      step,
      timestamp: new Date().toISOString(),
      storyPreview: storyText.slice(-200),
      choiceCount: choices.length,
      choices: choices.map(c => c.text.slice(0, 50))
    };
    gameLog.steps.push(stepData);

    console.log(`   Story: "${storyText.slice(-100).replace(/\n/g, ' ')}..."`);
    console.log(`   Choices (${choices.length}): ${choices.map(c => c.text.slice(0, 30)).join(' | ')}`);

    // Check for UX issues
    if (choices.some(c => !c.text || c.text.match(/^\s*$/))) {
      gameLog.uxObservations.push({
        step,
        issue: 'Empty choice text',
        details: choices.map(c => c.text)
      });
      console.log('   ⚠️ UX: Empty choice text detected');
    }

    // No choices = end of path or waiting
    if (choices.length === 0) {
      console.log('   🏁 No choices available - end of path or loading');

      // Check if this is a loading state
      const isLoading = await page.evaluate(() => {
        const status = document.querySelector('.status, #status');
        return status && status.innerText.includes('Loading');
      });

      if (isLoading) {
        console.log('   ⏳ Waiting for content to load...');
        await delay(3000);
        continue;
      }

      // Take screenshot of endpoint
      if (TAKE_SCREENSHOTS) {
        await page.screenshot({ path: `${OUTPUT_DIR}/step-${String(step).padStart(2,'0')}-endpoint.png` });
      }
      break;
    }

    // Choose action - prefer unexplored paths, or random
    const choiceIndex = Math.floor(Math.random() * choices.length);
    const chosenText = choices[choiceIndex].text;

    console.log(`   ➡️ Choosing: "${chosenText.slice(0, 40)}..."`);
    gameLog.choicesMade.push({ step, choice: chosenText });

    // Click the choice
    try {
      await page.locator('#choices button').nth(choiceIndex).click();
      await delay(1500); // Wait for story to progress
    } catch (e) {
      console.log(`   ⚠️ Click failed: ${e.message}`);
      gameLog.errors.push({
        time: new Date().toISOString(),
        type: 'click_failed',
        text: e.message
      });
    }

    // Take screenshot
    if (TAKE_SCREENSHOTS && step % 5 === 0) {
      await page.screenshot({ path: `${OUTPUT_DIR}/step-${String(step).padStart(2,'0')}.png` });
    }
  }

  // Final state capture
  console.log('\n📊 Playtest Complete');

  // Get final game state
  const finalState = await page.evaluate(() => {
    // Try to access INK variables if available
    let inkState = {};
    try {
      if (window.story && window.story.variablesState) {
        inkState = {
          diamonds: window.story.variablesState['diamonds'],
          mega_diamonds: window.story.variablesState['mega_diamonds'],
          keys: window.story.variablesState['keys'],
          score: window.story.variablesState['score']
        };
      }
    } catch (e) {}
    return inkState;
  });

  gameLog.finalState = finalState;
  gameLog.endTime = new Date().toISOString();

  // Summary
  console.log('\n📈 Summary:');
  console.log(`   Steps taken: ${gameLog.steps.length}`);
  console.log(`   Choices made: ${gameLog.choicesMade.length}`);
  console.log(`   Console errors: ${gameLog.errors.length}`);
  console.log(`   UX observations: ${gameLog.uxObservations.length}`);
  console.log(`   Final state: ${JSON.stringify(finalState)}`);

  // Save full log
  const logPath = TAKE_SCREENSHOTS
    ? `${OUTPUT_DIR}/playtest-log.json`
    : './playtest-log.json';
  writeFileSync(logPath, JSON.stringify(gameLog, (k, v) => v instanceof Set ? [...v] : v, 2));
  console.log(`\n📁 Full log saved to: ${logPath}`);

  // Print UX observations
  if (gameLog.uxObservations.length > 0) {
    console.log('\n🔍 UX Observations:');
    gameLog.uxObservations.forEach(obs => {
      console.log(`   Step ${obs.step}: ${obs.issue}`);
    });
  }

  // Print errors
  if (gameLog.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    gameLog.errors.slice(0, 5).forEach(err => {
      console.log(`   ${err.type}: ${err.text.slice(0, 100)}`);
    });
  }

  await browser.close();
  console.log('\n✅ Playtest finished');
}

main().catch(err => {
  console.error('Playtest failed:', err);
  process.exit(1);
});
