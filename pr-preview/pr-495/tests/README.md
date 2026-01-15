# Headless Browser Testing for Glitchcan Minigames

## Overview

This directory contains end-to-end tests for the Glitchcan minigames collection using Playwright for headless browser automation.

## Current Status: Browser Download Blocked

**Issue**: The current environment has network restrictions (403 Forbidden errors) preventing Chromium browser downloads from:
- `cdn.playwright.dev`
- `playwright.download.prss.microsoft.com`
- Puppeteer Chrome CDN

**Workarounds**:
1. **Run tests in unrestricted environment** (recommended for CI/CD)
2. **Use MCP Chrome DevTools** if available
3. **Manual browser testing** using provided test URLs

## Installation (Unrestricted Environment)

```bash
# In project root
npm install

# Install Playwright browsers
npx playwright install chromium

# Or install all browsers
npx playwright install
```

## Running Tests

### Full Test Suite
```bash
npm test
```

### Specific Test Files
```bash
npx playwright test tests/fink-player.spec.js
npx playwright test tests/gridluck.spec.js
```

### With UI Mode (Debug)
```bash
npx playwright test --ui
```

### Generate Test Report
```bash
npx playwright show-report
```

## Test Structure

```
tests/
├── README.md                 # This file
├── fink-player.spec.js       # FINK interactive fiction tests
├── gridluck.spec.js          # GridLuck game tests
├── minigames.spec.js         # General minigame smoke tests
├── visual-regression.spec.js # Screenshot comparison tests
└── fixtures/
    └── screenshots/          # Baseline screenshots for regression
```

## Writing Tests

### Basic Test Example

```javascript
import { test, expect } from '@playwright/test';

test('game loads without errors', async ({ page }) => {
  await page.goto('http://localhost:8080/thumbwar/gridluck.html');

  // Wait for canvas to load
  await expect(page.locator('canvas#game')).toBeVisible();

  // Check for JavaScript errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser error:', msg.text());
    }
  });
});
```

### Mobile Testing Example

```javascript
test('touch controls work on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto('http://localhost:8080/thumbwar/thumbwar.html');

  // Simulate touch tap
  await page.touchscreen.tap(100, 200);

  // Verify game state changed
  const gameState = await page.evaluate(() => window.game?.state);
  expect(gameState).toBe('playing');
});
```

### Visual Regression Example

```javascript
test('game renders correctly', async ({ page }) => {
  await page.goto('http://localhost:8080/tokitokipona/tokitokipona.html');

  // Take screenshot and compare
  await expect(page).toHaveScreenshot('tokitoki-main.png', {
    maxDiffPixels: 100
  });
});
```

## Test Categories

### 1. Smoke Tests
- Game loads without errors
- Required assets load (images, audio, scripts)
- Canvas/WebGL initializes
- No console errors

### 2. Functional Tests
- User interactions work (click, touch, keyboard)
- Game state changes correctly
- Navigation works
- Forms submit properly

### 3. FINK Story Tests
- Stories compile without errors
- Choices display correctly
- Story navigation works
- Images load from BASEHREF paths
- Variables and conditionals work

### 4. Visual Regression Tests
- Screenshot comparisons
- Layout consistency
- Responsive design verification

### 5. Performance Tests
- Page load time
- FPS monitoring
- Memory usage
- Asset loading time

## FINK-Specific Testing

The FINK Player has special requirements due to its INK story compilation:

```javascript
test('FINK story loads and compiles', async ({ page }) => {
  await page.goto('http://localhost:8080/inklet/app/index.html');

  // Wait for story to load
  await page.waitForSelector('.story-container');

  // Verify story compiled
  const storyLoaded = await page.evaluate(() => {
    return window.FinkPlayer?.story !== null;
  });
  expect(storyLoaded).toBe(true);

  // Verify choices rendered
  await expect(page.locator('.choices-container')).toBeVisible();
  const choiceCount = await page.locator('.choice').count();
  expect(choiceCount).toBeGreaterThan(0);
});
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run tests
        run: npm test

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Playwright Configuration

See `playwright.config.js` in project root for:
- Base URL configuration
- Timeout settings
- Retry logic
- Screenshot/video settings
- Browser options

## Troubleshooting

### Browser Download Fails
- Check network connectivity
- Verify CDN access not blocked by firewall
- Try manual browser installation
- Use system-installed browser with `channel: 'chrome'`

### Tests Timeout
- Increase timeout in `playwright.config.js`
- Check if local server is running
- Verify game assets load quickly

### Screenshots Don't Match
- Update baseline: `npx playwright test --update-snapshots`
- Check for timing issues (animations, loading)
- Consider increased threshold: `maxDiffPixels: 200`

### Console Errors in Tests
- Review browser console output
- Check for missing assets
- Verify API endpoints if applicable

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Next Steps

1. **Immediate**: Document manual testing procedures
2. **Short-term**: Set up CI/CD with unrestricted browser access
3. **Long-term**: Expand test coverage to all 20+ minigames
