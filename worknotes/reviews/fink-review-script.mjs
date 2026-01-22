// FINK Game Fun & Engagement Review Script
// Captures screenshots while playing through the interactive fiction game
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:8080';
const OUTPUT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 400, height: 800 } });

  const logs = [];
  const findings = [];
  page.on('console', msg => logs.push('[' + msg.type() + '] ' + msg.text()));

  console.log('=== FINK FUN & ENGAGEMENT REVIEW ===\n');

  // Navigate to game
  await page.goto(BASE_URL + '/glitchcan-minigam/inklet/finkapp/index.html');
  await page.waitForTimeout(3500);

  // Screenshot 1: First impression
  await page.screenshot({ path: OUTPUT_DIR + '/fun-01-first-impression.png' });
  console.log('Screenshot 1: First impression captured');

  // Get initial content
  let content = await page.evaluate(() => {
    const output = document.querySelector('#story-output');
    const choices = document.querySelector('#choices');
    return {
      text: output?.innerText || 'No story output',
      choices: Array.from(choices?.querySelectorAll('.choice-btn') || []).map(c => c.innerText),
      imageVisible: document.querySelector('#story-image') && !document.querySelector('#story-image').classList.contains('hidden'),
      imageSrc: document.querySelector('#story-image')?.src || ''
    };
  });

  console.log('\n=== FIRST IMPRESSION ===');
  console.log('Story text:', content.text.slice(0, 300));
  console.log('Choices available:', content.choices.length);
  console.log('Choice texts:', content.choices.join(' | '));
  console.log('Image visible:', content.imageVisible);
  findings.push({ stage: 'first-impression', text: content.text, choices: content.choices, hasImage: content.imageVisible });

  // Navigate through the game
  let stepNum = 2;
  for (let i = 0; i < 15; i++) {
    // Try clicking first choice
    const choiceBtn = await page.$('.choice-btn');
    if (!choiceBtn) {
      console.log('\nNo more choices - end of path reached');
      break;
    }

    const choiceText = await choiceBtn.innerText();
    console.log('\n--- Step ' + (i+1) + ': Clicking "' + choiceText + '" ---');
    await choiceBtn.click();
    await page.waitForTimeout(2000);

    // Get new state
    content = await page.evaluate(() => {
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

    console.log('Text preview:', content.text.slice(0, 200));
    console.log('Choices:', content.choices.length, '-', content.choices.join(' | '));
    console.log('Stats: D=' + content.diamonds + ' M=' + content.mega + ' S=' + content.score);
    console.log('Image:', content.imageVisible, 'Video:', content.videoVisible, 'Minigame:', content.minigameActive);

    // Screenshot interesting moments
    let screenshotName = 'fun-' + String(stepNum).padStart(2, '0');
    if (content.videoVisible) {
      screenshotName += '-video';
      console.log('*** VIDEO DETECTED! ***');
    }
    if (content.minigameActive) {
      screenshotName += '-minigame';
      console.log('*** MINIGAME ACTIVE! ***');
      // Wait longer for minigame to render
      await page.waitForTimeout(2000);
    }
    if (parseInt(content.diamonds) > 0 || parseInt(content.score) > 0) {
      screenshotName += '-rewards';
    }

    await page.screenshot({ path: OUTPUT_DIR + '/' + screenshotName + '.png' });
    console.log('Screenshot: ' + screenshotName + '.png');
    stepNum++;

    findings.push({
      stage: 'step-' + (i+1),
      clicked: choiceText,
      text: content.text.slice(0, 300),
      choices: content.choices,
      stats: { diamonds: content.diamonds, mega: content.mega, score: content.score },
      hasImage: content.imageVisible,
      hasVideo: content.videoVisible,
      hasMinigame: content.minigameActive
    });

    // If minigame active, try to interact and take more screenshots
    if (content.minigameActive) {
      console.log('\n=== MINIGAME INTERACTION ===');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: OUTPUT_DIR + '/fun-minigame-gameplay.png' });

      // Try clicking in game area
      const gameContainer = await page.$('#game-container');
      if (gameContainer) {
        const box = await gameContainer.boundingBox();
        if (box) {
          // Click around in the game area
          for (let click = 0; click < 5; click++) {
            const x = box.x + Math.random() * box.width;
            const y = box.y + Math.random() * box.height;
            await page.mouse.click(x, y);
            await page.waitForTimeout(500);
          }
          await page.screenshot({ path: OUTPUT_DIR + '/fun-minigame-interaction.png' });
        }
      }

      // Look for exit button
      const exitBtn = await page.$('#returnToStory');
      if (exitBtn) {
        console.log('Found exit button - clicking to return to story');
        await exitBtn.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  // Final screenshot
  await page.screenshot({ path: OUTPUT_DIR + '/fun-final-state.png' });
  console.log('\nFinal screenshot captured');

  // Save structured findings
  writeFileSync(OUTPUT_DIR + '/fink-findings.json', JSON.stringify(findings, null, 2));
  writeFileSync(OUTPUT_DIR + '/fink-browser-logs.txt', logs.join('\n'));

  // Count interesting things
  const errorLogs = logs.filter(l => l.toLowerCase().includes('error'));
  console.log('\n=== SUMMARY ===');
  console.log('Total steps explored:', findings.length);
  console.log('Browser errors:', errorLogs.length);
  if (errorLogs.length > 0) {
    console.log('Sample errors:', errorLogs.slice(0, 3).join('\n'));
  }

  await browser.close();
  console.log('\nReview playthrough complete!');
}

main().catch(console.error);
