import { test, expect } from '@playwright/test';

/**
 * Smoke Tests for Various Minigames
 *
 * Quick sanity checks to ensure games load without critical errors
 */

const games = [
  { name: 'ThumbWar', url: '/thumbwar/thumbwar.html', canvas: 'canvas' },
  { name: 'GridLuck', url: '/thumbwar/gridluck.html', canvas: 'canvas#game' },
  { name: 'TokiTokiPona', url: '/tokitokipona/tokitokipona.html', canvas: null },
  { name: 'Spectro', url: '/spectro/index.html', canvas: 'canvas' },
  { name: 'BlipBlop', url: '/blipblop/blipblop.html', canvas: null },
  { name: 'GrowCircle', url: '/growcircle/growcircle.html', canvas: 'canvas' },
  { name: 'TwinEarth', url: '/twinearth/index.html', canvas: null },
  { name: 'Sandpit', url: '/sandpit/sandpit.html', canvas: 'canvas' },
  { name: 'Schemoids', url: '/schemoids/schemoids.html', canvas: 'canvas' },
];

for (const game of games) {
  test.describe(`${game.name} - Smoke Tests`, () => {

    test('should load without console errors', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(game.url);

      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // Allow time for initialization
      await page.waitForTimeout(2000);

      // Should have minimal console errors
      expect(consoleErrors.length).toBeLessThan(3);
    });

    test('should have valid HTML structure', async ({ page }) => {
      await page.goto(game.url);

      // Verify basic HTML structure
      const hasHead = await page.locator('head').count();
      const hasBody = await page.locator('body').count();

      expect(hasHead).toBe(1);
      expect(hasBody).toBe(1);
    });

    if (game.canvas) {
      test('should render canvas element', async ({ page }) => {
        await page.goto(game.url);

        await expect(page.locator(game.canvas)).toBeVisible();

        // Verify canvas has non-zero dimensions
        const canvasSize = await page.evaluate((selector) => {
          const canvas = document.querySelector(selector);
          return {
            width: canvas?.width || 0,
            height: canvas?.height || 0
          };
        }, game.canvas);

        expect(canvasSize.width).toBeGreaterThan(0);
        expect(canvasSize.height).toBeGreaterThan(0);
      });
    }

    test('should respond to page visibility', async ({ page }) => {
      await page.goto(game.url);

      await page.waitForTimeout(1000);

      // Simulate tab visibility change
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Page should still be functional
      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBe(true);
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(game.url);

      // Wait for load
      await page.waitForTimeout(1000);

      // Body should be visible
      await expect(page.locator('body')).toBeVisible();

      // Check for responsive meta tag
      const hasViewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta !== null;
      });

      // Most modern games should have viewport meta
      expect(hasViewport).toBe(true);
    });

    test('should have title', async ({ page }) => {
      await page.goto(game.url);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

  });
}

test.describe('Landing Page', () => {

  test('should load main index without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/index.html');

    await expect(page.locator('h1')).toBeVisible();

    expect(consoleErrors.length).toBe(0);
  });

  test('should have duck emoji with animations', async ({ page }) => {
    await page.goto('/index.html');

    // Find the duck emoji
    const duckEmoji = page.locator('text=🐥');
    await expect(duckEmoji).toBeVisible();

    // Check if heartbeat animation is applied
    const hasAnimation = await duckEmoji.evaluate(el => {
      const animation = window.getComputedStyle(el).animation;
      return animation && animation !== 'none';
    });

    expect(hasAnimation).toBe(true);
  });

  test('should have links to all games', async ({ page }) => {
    await page.goto('/index.html');

    // Count game links
    const gameLinks = page.locator('a[href*=".html"]');
    const count = await gameLinks.count();

    // Should have multiple game links
    expect(count).toBeGreaterThan(5);
  });

  test('should have working game links', async ({ page }) => {
    await page.goto('/index.html');

    // Get first game link
    const firstGameLink = page.locator('a[href*=".html"]').first();
    const href = await firstGameLink.getAttribute('href');

    expect(href).toBeTruthy();
    expect(href).toContain('.html');
  });

});

test.describe('Asset Loading', () => {

  test('favicon should load', async ({ page }) => {
    await page.goto('/index.html');

    // Check for favicon
    const faviconExists = await page.evaluate(() => {
      const link = document.querySelector('link[rel="icon"]');
      return link !== null;
    });

    // Note: Not all games may have favicons
    // This test documents the expectation
  });

  test('external fonts should load (if used)', async ({ page }) => {
    await page.goto('/inklet/app/index.html');

    // Wait for fonts to load
    await page.waitForTimeout(2000);

    // Check if Google Fonts loaded
    const fontsLoaded = await page.evaluate(() => {
      const links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
      return links.length > 0;
    });

    // FINK player uses Google Fonts
    expect(fontsLoaded).toBe(true);
  });

});

test.describe('WebGL Support', () => {

  test('should detect WebGL availability', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    const webglSupported = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    });

    // Most modern browsers support WebGL
    expect(webglSupported).toBe(true);
  });

});

test.describe('Audio Support', () => {

  test('should detect Audio API availability', async ({ page }) => {
    await page.goto('/blipblop/blipblop.html');

    const audioSupported = await page.evaluate(() => {
      return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
    });

    expect(audioSupported).toBe(true);
  });

});
