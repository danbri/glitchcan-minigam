// Find easter eggs and special content in FINK
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8080';
const OUTPUT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('VIDEO') || text.includes('video')) {
      console.log('[VIDEO]', text);
    }
  });

  console.log('=== EASTER EGG HUNT ===\n');

  // Go to Hampstead and look for the giro fraud video
  console.log('>>> Looking for Giro Fraud Video in Hampstead <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  // Navigate: Episodes > Hampstead
  await page.click('.choice-btn:has-text("Episodes")');
  await page.waitForTimeout(1000);
  await page.click('.choice-btn:has-text("Hampstead")');
  await page.waitForTimeout(2000);

  // Click through to find the video
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => ({
      text: document.querySelector('#story-output')?.innerText || '',
      choices: Array.from(document.querySelectorAll('.choice-btn')).map(c => c.innerText),
      videoVisible: document.querySelector('#story-video')?.style.display !== 'none',
      videoSrc: document.querySelector('#story-video')?.src || ''
    }));

    console.log('Step ' + (i+1) + ': ' + state.text.slice(0, 80));
    console.log('  Choices:', state.choices.slice(0, 3).join(' | '));

    if (state.videoVisible) {
      console.log('\n*** VIDEO FOUND! ***', state.videoSrc);
      await page.screenshot({ path: OUTPUT_DIR + '/fun-easter-egg-giro.png' });
      break;
    }

    // Look for interesting choices (video, fraud, giro, TV, etc)
    const interestingChoice = state.choices.find(c =>
      c.toLowerCase().includes('tv') ||
      c.toLowerCase().includes('giro') ||
      c.toLowerCase().includes('watch') ||
      c.toLowerCase().includes('video')
    );

    if (interestingChoice) {
      console.log('  -> Clicking interesting choice:', interestingChoice);
      await page.click('.choice-btn:has-text("' + interestingChoice.slice(0, 20) + '")');
    } else {
      // Just click first choice
      const firstChoice = await page.$('.choice-btn');
      if (!firstChoice) break;
      await firstChoice.click();
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: OUTPUT_DIR + '/fun-hampstead-' + i + '.png' });
  }

  // Try Maple Hollow for video content
  console.log('\n>>> Exploring Maple Hollow (has YouTube videos) <<<\n');
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  await page.click('.choice-btn:has-text("Episodes")');
  await page.waitForTimeout(1000);
  await page.click('.choice-btn:has-text("Maple")');
  await page.waitForTimeout(2000);

  const mapleState = await page.evaluate(() => ({
    text: document.querySelector('#story-output')?.innerText || '',
    choices: Array.from(document.querySelectorAll('.choice-btn')).map(c => c.innerText)
  }));

  console.log('Maple Hollow intro:', mapleState.text.slice(0, 300));
  console.log('Choices:', mapleState.choices.join(' | '));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-maple-hollow.png' });

  // Click into Maple Hollow
  for (let i = 0; i < 5; i++) {
    const choice = await page.$('.choice-btn');
    if (!choice) break;
    await choice.click();
    await page.waitForTimeout(2000);

    const state = await page.evaluate(() => ({
      text: document.querySelector('#story-output')?.innerText || '',
      videoVisible: document.querySelector('#story-video')?.style.display !== 'none',
      iframe: document.querySelector('iframe')?.src || ''
    }));

    console.log('Step ' + (i+1) + ':', state.text.slice(0, 100));
    if (state.videoVisible || state.iframe) {
      console.log('*** VIDEO/IFRAME FOUND ***');
      await page.screenshot({ path: OUTPUT_DIR + '/fun-maple-video.png' });
    }
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
