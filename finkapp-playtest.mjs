import { chromium } from 'playwright';

async function playtest() {
  console.log('Starting Playwright playtest of finkapp on localhost:8080...\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => errors.push(err.message));

  try {
    // 1. Load finkapp
    console.log('1. Loading finkapp...');
    await page.goto('http://localhost:8080/inklet/finkapp/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/finkapp-01-load.png' });
    console.log('   Screenshot: /tmp/finkapp-01-load.png');

    // Check for errors
    if (errors.length > 0) {
      console.log('   Errors:', errors.slice(0, 3).join('; '));
    }

    // 2. Dismiss any overlay by clicking
    const overlay = page.locator('#status-overlay.active');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('2. Dismissing status overlay...');
      await page.click('#status-overlay', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 3. Look for story content or choices
    const storyText = await page.locator('#story-output').innerText().catch(() => '');
    console.log(`3. Story output: "${storyText.slice(0, 150).replace(/\n/g, ' ')}..."`);

    // 4. Find and click choices
    const choices = await page.locator('#choices button, #choices .choice').all();
    console.log(`4. Found ${choices.length} choices`);

    if (choices.length > 0) {
      for (let i = 0; i < Math.min(3, choices.length); i++) {
        const text = await choices[i].innerText().catch(() => '?');
        console.log(`   [${i}] "${text.slice(0, 40)}"`);
      }

      // Click first choice
      console.log('5. Clicking first choice...');
      await choices[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/finkapp-02-choice1.png' });
      console.log('   Screenshot: /tmp/finkapp-02-choice1.png');
    }

    // 5. Navigate through TOC to find Hampstead
    console.log('6. Looking for navigation to Hampstead...');

    // Try to find "Games" or similar menu
    const gamesBtn = page.locator('button:has-text("Games"), button:has-text("🎮")').first();
    if (await gamesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Found Games button, clicking...');
      await gamesBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/finkapp-03-games.png' });
    }

    // Look for Hampstead
    const hampsteadBtn = page.locator('button:has-text("Hampstead")').first();
    if (await hampsteadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Found Hampstead, clicking...');
      await hampsteadBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/finkapp-04-hampstead.png' });
      console.log('   Screenshot: /tmp/finkapp-04-hampstead.png');
    }

    // 6. Final state
    await page.screenshot({ path: '/tmp/finkapp-05-final.png' });
    console.log('\n7. Final screenshot: /tmp/finkapp-05-final.png');

    const finalText = await page.locator('#story-output').innerText().catch(() => '[empty]');
    console.log(`   Final story: "${finalText.slice(0, 200).replace(/\n/g, ' ')}..."`);

    console.log(`\nTotal JS errors: ${errors.length}`);
    if (errors.length > 0 && errors.length <= 5) {
      errors.forEach(e => console.log('  - ' + e.slice(0, 100)));
    }

  } catch (err) {
    console.error('Playtest error:', err.message);
    await page.screenshot({ path: '/tmp/finkapp-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('\nPlaytest complete.');
}

playtest().catch(console.error);
