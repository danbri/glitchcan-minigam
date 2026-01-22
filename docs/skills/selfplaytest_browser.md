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

## VIDEO Tag Testing in Headless Browsers

### Critical Limitation: Headless Chromium Cannot Play Videos

**Headless browsers do not have video codecs.** When testing VIDEO tags:
- The video element IS created in the DOM (code works!)
- The src attribute IS set correctly (URL works!)
- But video playback FAILS because no decoder exists
- The error handler fires, showing "Video failed to load"

### How to Verify VIDEO Tags Work Despite Playback Failure

Check these trace logs to confirm the VIDEO implementation is correct:

```
[VIDEO-TRACE] updateVideo CALLED, path: ../media/video.mp4     # 1. Function was called
[VIDEO-TRACE] isLocalFile=true, isYouTube=false                # 2. Type detected
[VIDEO-TRACE] inserted before imageContainer                    # 3. Container created
[VIDEO-TRACE] actualVideoPath: http://localhost:8080/.../video.mp4  # 4. URL resolved
[VIDEO-TRACE] video element appended, src: ...                  # 5. Element added
[VIDEO-TRACE] video error event                                 # 6. Expected in headless!
```

**If you see steps 1-5, the VIDEO code is WORKING.** Step 6 (error) is expected in headless.

### Verification Code Pattern

```javascript
// Analyze VIDEO trace logs to verify fix
const videoLogs = logs.filter(l => l.includes('VIDEO-TRACE'));
const wasCreated = videoLogs.some(l => l.includes('video element appended'));
const hadError = videoLogs.some(l => l.includes('video error'));
const urlLog = videoLogs.find(l => l.includes('actualVideoPath:'));
const url = urlLog ? urlLog.split('actualVideoPath:')[1]?.trim() : null;

console.log('VIDEO FIX VERIFICATION:');
console.log('  1. VIDEO tag collected:', logs.some(l => l.includes('Collected VIDEO tag')));
console.log('  2. updateVideo() called:', logs.some(l => l.includes('updateVideo CALLED')));
console.log('  3. Video element created:', wasCreated);
console.log('  4. URL generated:', url);
console.log('  5. Headless playback error:', hadError, '(expected)');

if (wasCreated && url) {
  console.log('\n VIDEO TAG FIX VERIFIED');
  console.log('  The video element was created with correct URL.');
  console.log('  Headless browser cannot decode video (expected limitation).');
}
```

## Example: Testing Fraud Scene VIDEO Tag

Full working example in `finkapp-fraud-test.mjs`:

```javascript
// Navigate TOC -> Episodes -> Hampstead
await clickAndWait('episodes', 'TOC Episodes');
await clickAndWait('hampstead', 'Select Hampstead');
await clickAndWait('continue', 'Splash continue');

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

// Check container (video element may show error in headless)
const containerHtml = await page.locator('#video-container').innerHTML().catch(() => 'N/A');
console.log('Container:', containerHtml.slice(0, 100));

// Verify VIDEO via trace logs (see verification pattern above)
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

6. **Verify file exists**: Before blaming code, check the video file:
   ```bash
   ls -la /home/user/glitchcan-minigam/media/d94a6357-*.mp4
   ```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ERR_NAME_NOT_RESOLVED` | CDN blocked in sandbox | Use local copies of libraries |
| 404 on FINK files | Wrong path prefix | Ensure server runs from parent dir |
| `inkjs not found` | CDN blocked | Use `/glitchcan-minigam/third_party/ink/ink-full.js` |
| "Video failed to load" in headless | Expected! No codec | Check trace logs instead - if element created, code works |
| Video not showing (no trace logs) | DOM insertion failed | Check `this.elements.imageContainer` exists |
| Choices not clickable | Overlay blocking | Dismiss `#status-overlay` first |
| Wrong video URL | BASEHREF issue | Check `storyBase` in trace logs |

## File Locations

- Test scripts: `/home/user/glitchcan-minigam/*.mjs`
- Screenshots: `/tmp/fraud-*.png`
- Server logs: Check background task output
- FINK UI code: `inklet/finkapp/fink-ui.js` (updateVideo function ~line 520)

## Running Tests

```bash
# Ensure server is running from correct directory
cd /home/user && python3 -m http.server 8080 &

# Run test script from project directory (for node_modules access)
cd /home/user/glitchcan-minigam
node finkapp-fraud-test.mjs
```

## Key Insight: Trace Logs Are Your Friend

The FINK VIDEO implementation includes detailed `[VIDEO-TRACE]` logging. When debugging:

1. **Run the test** - even if video doesn't appear
2. **Check trace logs** - they tell you exactly what happened
3. **Don't trust the visual** - headless can't render video
4. **Trust the logs** - if "video element appended" appears, code works

## Notes

- WebGPU (Stinkyfish) is NOT available in headless Chromium - only WebGL (Mayfly) is tested
- Headless browsers have different timing - add generous `waitForTimeout` calls
- Mobile viewport (390x844) simulates phone experience
- **VIDEO playback requires real browser** - headless testing can only verify DOM creation
