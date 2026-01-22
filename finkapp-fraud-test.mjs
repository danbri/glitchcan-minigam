import { chromium } from 'playwright';

async function testFraudScene() {
  console.log('=== Testing giro fraud VIDEO tag ===\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('VIDEO')) {
      console.log('  [VIDEO]', text);
    }
  });

  // Helper to click a choice and wait for story update
  const clickAndWait = async (textMatch, description) => {
    const choices = await page.locator('#choices button').all();
    for (const choice of choices) {
      const text = await choice.innerText().catch(() => '');
      if (text.toLowerCase().includes(textMatch.toLowerCase())) {
        console.log(`  CLICK: "${text.slice(0, 50)}" (${description})`);
        await choice.click();
        await page.waitForTimeout(2000);
        return true;
      }
    }
    console.log(`  MISS: No choice matching "${textMatch}" (${description})`);
    const allChoices = await page.locator('#choices button').allInnerTexts();
    console.log(`        Available: ${allChoices.join(' | ')}`);
    return false;
  };

  try {
    // Step 1: Load finkapp
    console.log('STEP 1: Loading finkapp...');
    await page.goto('http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html', {
      waitUntil: 'networkidle', timeout: 30000
    });
    await page.waitForTimeout(3000);
    console.log('  Loaded. Taking screenshot...');
    await page.screenshot({ path: '/tmp/fraud-01.png' });

    // Step 2: Navigate to Hampstead through TOC
    console.log('\nSTEP 2: TOC -> Hampstead...');
    await clickAndWait('episodes', 'TOC Episodes');
    await clickAndWait('hampstead', 'Select Hampstead');
    await clickAndWait('enter', 'Enter Hampstead');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/fraud-02.png' });

    // Step 3: Hampstead intro
    console.log('\nSTEP 3: Hampstead intro...');
    await clickAndWait('continue', 'Splash continue');
    await clickAndWait('boot', 'Boot the Speccy');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/fraud-03.png' });

    // Step 4: Navigate to Job Centre and collect giro
    console.log('\nSTEP 4: Get giro...');
    await clickAndWait('leave', 'Leave for Main Street');
    await clickAndWait('east', 'East to Job Centre');
    await clickAndWait('collect', 'Collect giro');
    await page.screenshot({ path: '/tmp/fraud-04.png' });

    // Step 5: Cash the giro (first time - legitimate)
    console.log('\nSTEP 5: Cash giro (legitimate)...');
    await clickAndWait('cash', 'Cash the giro');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/fraud-05.png' });

    // Step 6: Return to post office
    console.log('\nSTEP 6: Return to post office...');
    // After cashing, we're on the street
    await clickAndWait('east', 'Back to Job Centre');
    await clickAndWait('post office', 'Go to Post Office');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/fraud-06.png' });

    // Step 7: Try to cash again (FRAUD!)
    console.log('\nSTEP 7: TRIGGER FRAUD...');
    const choices = await page.locator('#choices button').allInnerTexts();
    console.log('  Available choices:', choices.join(' | '));

    const fraudTriggered = await clickAndWait('again', 'Cash giro AGAIN');
    if (fraudTriggered) {
      console.log('\n=== FRAUD SCENE TRIGGERED! ===');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/fraud-07-video.png' });

      // Check for video element
      const videoSrc = await page.locator('#video-container video').getAttribute('src').catch(() => null);
      const videoVisible = await page.locator('#video-container video').isVisible().catch(() => false);

      console.log('\nVIDEO CHECK:');
      console.log('  Video visible:', videoVisible);
      console.log('  Video src:', videoSrc || '(none)');

      // Check story text
      const storyText = await page.locator('#story-output').innerText().catch(() => '');
      console.log('  Story contains "ATTENTION":', storyText.includes('ATTENTION'));
      console.log('  Story text:', storyText.slice(0, 200).replace(/\n/g, ' '));

      // Collect VIDEO-related debug logs
      const videoLogs = logs.filter(l => l.includes('VIDEO'));
      if (videoLogs.length > 0) {
        console.log('\nVIDEO debug logs:');
        videoLogs.forEach(l => console.log('  ', l));
      }

      if (videoSrc) {
        console.log('\n✓ VIDEO TAG FIX VERIFIED - Video element has src');
      } else {
        console.log('\n✗ VIDEO NOT SHOWING - May need further debugging');
      }
    }

  } catch (err) {
    console.error('\nERROR:', err.message);
    await page.screenshot({ path: '/tmp/fraud-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('\n=== Test complete ===');
}

testFraudScene().catch(console.error);
