// FINK Game Deep Exploration Script
// Explores multiple paths to find interesting content
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:8080';
const OUTPUT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';

async function getState(page) {
  return await page.evaluate(() => {
    const output = document.querySelector('#story-output');
    const choices = document.querySelector('#choices');
    const video = document.querySelector('#story-video');
    const minigameView = document.querySelector('#minigame-view');
    return {
      text: output?.innerText || '',
      choices: Array.from(choices?.querySelectorAll('.choice-btn') || []).map(c => c.innerText),
      imageVisible: document.querySelector('#story-image') && !document.querySelector('#story-image').classList.contains('hidden'),
      imageSrc: document.querySelector('#story-image')?.src || '',
      videoVisible: video && video.style.display !== 'none',
      videoSrc: video?.src || '',
      diamonds: document.querySelector('#stat-diamonds')?.innerText || '0',
      mega: document.querySelector('#stat-mega')?.innerText || '0',
      score: document.querySelector('#stat-score')?.innerText || '0',
      minigameActive: minigameView?.classList.contains('active') || false
    };
  });
}

async function clickChoice(page, text) {
  const choices = await page.$$('.choice-btn');
  for (const choice of choices) {
    const choiceText = await choice.innerText();
    if (choiceText.includes(text)) {
      await choice.click();
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function clickFirstChoice(page) {
  const choice = await page.$('.choice-btn');
  if (choice) {
    const text = await choice.innerText();
    await choice.click();
    await page.waitForTimeout(1500);
    return text;
  }
  return null;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  const logs = [];
  page.on('console', msg => logs.push('[' + msg.type() + '] ' + msg.text()));

  console.log('=== FINK DEEP EXPLORATION ===\n');

  // EXPLORATION 1: Minigames
  console.log('\n>>> EXPLORING MINIGAMES <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  await clickChoice(page, 'Minigames');
  let state = await getState(page);
  console.log('Minigames menu:', state.choices.join(' | '));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-minigames-menu.png' });

  // Try Diamond Cave
  if (await clickChoice(page, 'Diamond')) {
    state = await getState(page);
    console.log('Diamond Cave text:', state.text.slice(0, 200));
    console.log('Choices:', state.choices.join(' | '));
    await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-cave.png' });

    // Look for the actual game
    await clickFirstChoice(page);
    await page.waitForTimeout(2000);
    state = await getState(page);
    console.log('After first choice - Minigame active:', state.minigameActive);
    console.log('Text:', state.text.slice(0, 150));
    await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-cave-2.png' });

    if (state.minigameActive) {
      console.log('*** MINIGAME ACTIVE ***');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-minigame.png' });
    }
  }

  // EXPLORATION 2: Hampstead (known good story)
  console.log('\n>>> EXPLORING HAMPSTEAD <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  await clickChoice(page, 'Episodes');
  await page.waitForTimeout(1000);
  await clickChoice(page, 'Hampstead');
  state = await getState(page);
  console.log('Hampstead intro:', state.text.slice(0, 300));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-hampstead-intro.png' });

  // Play through a bit
  for (let i = 0; i < 8; i++) {
    const clicked = await clickFirstChoice(page);
    if (!clicked) break;
    state = await getState(page);
    console.log('Step ' + (i+1) + ': Clicked "' + clicked + '"');
    console.log('  Score:', state.score, 'Text:', state.text.slice(0, 100));
    if (parseInt(state.score) > 0) {
      console.log('*** SCORE INCREASED! ***');
      await page.screenshot({ path: OUTPUT_DIR + '/fun-hampstead-score.png' });
    }
  }
  await page.screenshot({ path: OUTPUT_DIR + '/fun-hampstead-progress.png' });

  // EXPLORATION 3: Check for video/easter eggs
  console.log('\n>>> LOOKING FOR EASTER EGGS <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  await clickChoice(page, 'Help');
  state = await getState(page);
  console.log('Help menu:', state.choices.join(' | '));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-help-menu.png' });

  // Check each help item
  for (const helpChoice of state.choices) {
    console.log('\nTrying help choice:', helpChoice);
    await clickChoice(page, helpChoice.replace(/[^a-zA-Z ]/g, '').trim());
    await page.waitForTimeout(1500);
    const helpState = await getState(page);
    console.log('Content:', helpState.text.slice(0, 200));
    if (helpState.videoVisible) {
      console.log('*** VIDEO FOUND! ***', helpState.videoSrc);
      await page.screenshot({ path: OUTPUT_DIR + '/fun-easter-egg-video.png' });
    }
    // Go back
    await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
    await page.waitForTimeout(2000);
    await clickChoice(page, 'Help');
  }

  // EXPLORATION 4: Mudslide Mines (another adventure)
  console.log('\n>>> EXPLORING MUDSLIDE MINES <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  await clickChoice(page, 'Episodes');
  await page.waitForTimeout(1000);
  await clickChoice(page, 'Mudslide');
  state = await getState(page);
  console.log('Mudslide intro:', state.text.slice(0, 300));
  console.log('Choices:', state.choices.join(' | '));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-mudslide-intro.png' });

  // Play through
  for (let i = 0; i < 6; i++) {
    const clicked = await clickFirstChoice(page);
    if (!clicked) break;
    state = await getState(page);
    console.log('Step ' + (i+1) + ':', state.text.slice(0, 100));
    if (state.imageVisible) {
      console.log('*** IMAGE VISIBLE ***');
      await page.screenshot({ path: OUTPUT_DIR + '/fun-mudslide-image.png' });
    }
    if (state.minigameActive) {
      console.log('*** MINIGAME ACTIVE ***');
      await page.screenshot({ path: OUTPUT_DIR + '/fun-mudslide-minigame.png' });
    }
  }

  // Save logs
  writeFileSync(OUTPUT_DIR + '/fink-exploration-logs.txt', logs.join('\n'));
  console.log('\n=== EXPLORATION COMPLETE ===');
  console.log('Browser errors:', logs.filter(l => l.includes('[error]')).length);

  await browser.close();
}

main().catch(console.error);
