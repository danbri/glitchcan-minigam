# Self-Playtest Browser Skill

Automated browser testing for FINK interactive fiction using Playwright.

## Prerequisites

- Node.js with Playwright installed (`npm install playwright`)
- Chromium browser available (Playwright manages this)
- HTTP server running with correct path structure

## Server Setup

**Critical**: Server must be started from parent directory so `/glitchcan-minigam/` paths work:

```bash
# From /home/user (parent of repo)
cd /home/user && python3 -m http.server 8080 &

# Verify paths work
curl -I http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html
```

This matches GitHub Pages structure where repo is served at `/glitchcan-minigam/`.

## Basic Playwright Script Structure

```javascript
import { chromium } from 'playwright';

async function playtest() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--headless=new', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Collect console logs for debugging
  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.text().includes('VIDEO') || msg.text().includes('ERROR')) {
      console.log('LOG:', msg.text());
    }
  });

  try {
    await page.goto('http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // ... test logic here ...

  } catch (err) {
    console.error('Test error:', err.message);
    await page.screenshot({ path: '/tmp/error.png' });
  }

  await browser.close();
}

playtest().catch(console.error);
```

## Choice Navigation Helper

```javascript
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
  console.log(`  MISS: No choice matching "${textMatch}"`);
  const allChoices = await page.locator('#choices button').allInnerTexts();
  console.log(`        Available: ${allChoices.join(' | ')}`);
  return false;
};
```

## Example: Testing Fraud Scene VIDEO Tag

```javascript
// Navigate TOC -> Episodes -> Hampstead
await clickAndWait('episodes', 'TOC Episodes');
await clickAndWait('hampstead', 'Select Hampstead');
await clickAndWait('continue', 'Enter story');

// Play through to fraud scene
await clickAndWait('boot', 'Boot the Speccy');
await clickAndWait('leave', 'Leave for Main Street');
await clickAndWait('east', 'East to Job Centre');
await clickAndWait('collect', 'Collect giro');
await clickAndWait('cash', 'Cash the giro');

// Return to post office
await clickAndWait('east', 'Back to Job Centre');
await clickAndWait('post office', 'Go to Post Office');

// Trigger fraud
await clickAndWait('again', 'Cash giro AGAIN');
await page.waitForTimeout(3000);

// Verify VIDEO element
const videoSrc = await page.locator('#video-container video')
  .getAttribute('src').catch(() => null);
console.log('Video src:', videoSrc || '(none)');
```

## Debugging Tips

1. **Console log filtering**: Filter logs for specific tags like `VIDEO`, `FINK`, `ERROR`

2. **Screenshot checkpoints**: Take screenshots at each step to visualize state:
   ```javascript
   await page.screenshot({ path: '/tmp/step-01.png' });
   ```

3. **View screenshots**: Use the Read tool to view PNG files directly

4. **Check DOM elements**:
   ```javascript
   const visible = await page.locator('#video-container').isVisible();
   const html = await page.locator('#video-container').innerHTML();
   ```

5. **Network requests**: Check if resources are loading:
   ```javascript
   page.on('response', resp => {
     if (resp.status() >= 400) {
       console.log(`HTTP ${resp.status()}: ${resp.url()}`);
     }
   });
   ```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ERR_NAME_NOT_RESOLVED` | CDN blocked in sandbox | Use local copies of libraries |
| 404 on FINK files | Wrong path prefix | Ensure server runs from parent dir |
| `inkjs not found` | CDN blocked | Use `/glitchcan-minigam/third_party/ink/ink-full.js` |
| Video not showing | DOM insertion failed | Check `this.elements.imageContainer` exists |
| Choices not clickable | Overlay blocking | Dismiss `#status-overlay` first |

## File Locations

- Test scripts: `/home/user/glitchcan-minigam/*.mjs`
- Screenshots: `/tmp/fraud-*.png`
- Server logs: Check background task output

## Running Tests

```bash
# Ensure server is running from correct directory
cd /home/user && python3 -m http.server 8080 &

# Run test script from project directory (for node_modules access)
cd /home/user/glitchcan-minigam
node finkapp-fraud-test.mjs
```

## Notes

- WebGPU (Stinkyfish) is NOT available in headless Chromium - only WebGL (Mayfly) is tested
- Headless browsers have different timing - add generous `waitForTimeout` calls
- Mobile viewport (390x844) simulates phone experience
