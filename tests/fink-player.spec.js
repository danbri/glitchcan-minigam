import { test, expect } from '@playwright/test';

/**
 * FINK Player (Interactive Fiction Engine) Tests
 *
 * Tests the modular FINK player which uses real ink-full.js compiler
 * to execute INK stories with custom extensions (IMAGE, MENU, BASEHREF tags)
 */

test.describe('FINK Player - Core Functionality', () => {

  test('should load FINK player without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/inklet/app/index.html');

    // Verify main container loads
    await expect(page.locator('#app-container')).toBeVisible();

    // Verify title bar
    await expect(page.locator('#story-title')).toBeVisible();

    // Check for console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('should have INK compiler loaded', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    // Wait for INK.js to load from CDN
    await page.waitForFunction(() => typeof window.inkjs !== 'undefined', {
      timeout: 10000
    });

    const inkJsLoaded = await page.evaluate(() => {
      return typeof window.inkjs !== 'undefined'
        && typeof window.inkjs.Compiler !== 'undefined'
        && typeof window.inkjs.Story !== 'undefined';
    });

    expect(inkJsLoaded).toBe(true);
  });

  test('should load modular JavaScript files', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForFunction(() => {
      return typeof window.FinkUtils !== 'undefined'
        && typeof window.FinkSandbox !== 'undefined'
        && typeof window.FinkInkEngine !== 'undefined'
        && typeof window.FinkUI !== 'undefined'
        && typeof window.FinkPlayer !== 'undefined';
    }, { timeout: 5000 });

    const modulesLoaded = await page.evaluate(() => ({
      utils: typeof window.FinkUtils !== 'undefined',
      sandbox: typeof window.FinkSandbox !== 'undefined',
      engine: typeof window.FinkInkEngine !== 'undefined',
      ui: typeof window.FinkUI !== 'undefined',
      player: typeof window.FinkPlayer !== 'undefined',
    }));

    expect(modulesLoaded.utils).toBe(true);
    expect(modulesLoaded.sandbox).toBe(true);
    expect(modulesLoaded.engine).toBe(true);
    expect(modulesLoaded.ui).toBe(true);
    expect(modulesLoaded.player).toBe(true);
  });

});

test.describe('FINK Player - Story Loading', () => {

  test('should load table of contents', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    // Wait for status overlay to disappear (story loaded)
    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Verify story content appears
    await expect(page.locator('#story')).toBeVisible();

    // TOC should have choices
    const choicesVisible = await page.locator('.choices-container').isVisible();
    expect(choicesVisible).toBe(true);
  });

  test('should display story choices', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Count choices
    const choiceCount = await page.locator('.choice').count();
    expect(choiceCount).toBeGreaterThan(0);

    // Verify choice has visible text (not just emoji)
    const firstChoiceText = await page.locator('.choice').first().textContent();
    expect(firstChoiceText).not.toBe('');
  });

  test('should navigate to external FINK story when choice clicked', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Click first choice
    await page.locator('.choice').first().click();

    // Wait for new story to load
    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Verify new story content loaded
    const storyContent = await page.locator('#story').textContent();
    expect(storyContent.length).toBeGreaterThan(0);
  });

});

test.describe('FINK Player - INK Features', () => {

  test('should handle INK variables', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Check if story has variables defined
    const hasVariables = await page.evaluate(() => {
      return window.FinkPlayer?.story?.variablesState !== undefined;
    });

    expect(hasVariables).toBe(true);
  });

  test('should process INK conditional markup', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Verify no raw conditional syntax visible (like {variable: text})
    const storyHTML = await page.locator('#story').innerHTML();

    // Raw conditionals should NOT appear in rendered output
    expect(storyHTML).not.toContain('{score:');
    expect(storyHTML).not.toContain('{visited:');
  });

});

test.describe('FINK Player - Custom Extensions', () => {

  test('should load images from IMAGE tags', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Navigate to story with images (Bagend or similar)
    // This test assumes TOC has a story with images
    await page.locator('.choice').first().click();
    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Check if story image container is present
    const imageContainer = page.locator('#image-container');
    await expect(imageContainer).toBeVisible();
  });

  test('should resolve BASEHREF paths correctly', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Check if BASEHREF resolution logic is loaded
    const hasLayeredResolution = await page.evaluate(() => {
      return typeof window.FinkUtils?.resolveLayeredMediaUrl === 'function';
    });

    expect(hasLayeredResolution).toBe(true);
  });

  test('should handle MENU tags for dynamic navigation', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Open dropdown menu
    await page.click('#menu-button');

    // Verify dropdown appears
    await expect(page.locator('#story-dropdown')).toBeVisible();
  });

});

test.describe('FINK Player - UI Controls', () => {

  test('should open debug console', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Click debug toggle button
    await page.click('#debug-toggle');

    // Verify debug console becomes visible
    await expect(page.locator('#debug-console')).toBeVisible();
  });

  test('should have restart story button', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Open menu
    await page.click('#menu-button');

    // Verify restart button exists
    await expect(page.locator('#story-restart')).toBeVisible();
  });

  test('should have return to main menu button', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Open menu
    await page.click('#menu-button');

    // Verify return button exists
    await expect(page.locator('#return-to-main')).toBeVisible();
  });

  test('should toggle fullscreen', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Verify fullscreen button exists
    await expect(page.locator('#fullscreen-button')).toBeVisible();
  });

});

test.describe('FINK Player - Mobile Responsiveness', () => {

  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Verify main elements visible
    await expect(page.locator('#app-container')).toBeVisible();
    await expect(page.locator('.choices-container')).toBeVisible();
  });

  test('should handle touch interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Get first choice position
    const choiceElement = page.locator('.choice').first();
    const box = await choiceElement.boundingBox();

    if (box) {
      // Simulate touch tap
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

      // Verify navigation occurred
      await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });
      const storyContent = await page.locator('#story').textContent();
      expect(storyContent.length).toBeGreaterThan(0);
    }
  });

});

test.describe('FINK Player - Error Handling', () => {

  test('should handle missing FINK file gracefully', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/inklet/app/index.html');

    await page.waitForSelector('#status-overlay', { state: 'hidden', timeout: 15000 });

    // Try to load non-existent story
    await page.evaluate(() => {
      if (window.FinkPlayer) {
        window.FinkPlayer.loadStory('nonexistent.fink.js');
      }
    });

    // Should show error message but not crash
    await page.waitForTimeout(2000);

    // App should still be functional
    const appVisible = await page.locator('#app-container').isVisible();
    expect(appVisible).toBe(true);
  });

});
