// Explore Diamond Cave minigame specifically
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
  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  console.log('=== DIAMOND CAVE EXPLORATION ===\n');

  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3000);

  // Go to Episodes > Diamond Cave
  await page.click('.choice-btn:has-text("Episodes")');
  await page.waitForTimeout(1500);

  await page.click('.choice-btn:has-text("Diamond")');
  await page.waitForTimeout(2000);

  let state = await page.evaluate(() => ({
    text: document.querySelector('#story-output')?.innerText || '',
    choices: Array.from(document.querySelectorAll('.choice-btn')).map(c => c.innerText),
    minigame: document.querySelector('#minigame-view')?.classList.contains('active')
  }));

  console.log('Diamond Cave intro:', state.text.slice(0, 400));
  console.log('Choices:', state.choices.join(' | '));
  await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-cave-intro.png' });

  // Click through to find the minigame
  for (let i = 0; i < 10; i++) {
    const choice = await page.$('.choice-btn');
    if (!choice) break;

    const text = await choice.innerText();
    console.log('\nClicking:', text);
    await choice.click();
    await page.waitForTimeout(2000);

    state = await page.evaluate(() => ({
      text: document.querySelector('#story-output')?.innerText || '',
      choices: Array.from(document.querySelectorAll('.choice-btn')).map(c => c.innerText),
      minigame: document.querySelector('#minigame-view')?.classList.contains('active'),
      diamonds: document.querySelector('#stat-diamonds')?.innerText || '0',
      mega: document.querySelector('#stat-mega')?.innerText || '0'
    }));

    console.log('Text:', state.text.slice(0, 150));
    console.log('Minigame active:', state.minigame);
    console.log('Diamonds:', state.diamonds, 'Mega:', state.mega);

    if (state.minigame) {
      console.log('\n*** MINIGAME FOUND! ***');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-minigame-found.png' });

      // Try interacting with the minigame
      const canvas = await page.$('#game-container canvas');
      if (canvas) {
        console.log('Canvas found - clicking around');
        const box = await canvas.boundingBox();
        if (box) {
          for (let j = 0; j < 10; j++) {
            await page.mouse.click(box.x + Math.random() * box.width, box.y + Math.random() * box.height);
            await page.waitForTimeout(300);
          }
          await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-minigame-interaction.png' });
        }
      }

      // Check stats after playing
      state = await page.evaluate(() => ({
        diamonds: document.querySelector('#stat-diamonds')?.innerText || '0',
        mega: document.querySelector('#stat-mega')?.innerText || '0',
        score: document.querySelector('#stat-score')?.innerText || '0'
      }));
      console.log('Stats after interaction:', state);
      break;
    }

    await page.screenshot({ path: OUTPUT_DIR + '/fun-diamond-step-' + i + '.png' });
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
