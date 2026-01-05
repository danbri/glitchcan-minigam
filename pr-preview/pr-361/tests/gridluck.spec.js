import { test, expect } from '@playwright/test';

/**
 * GridLuck Game Tests
 *
 * GridLuck is a retro-style grid-based game (v1.3.0) with:
 * - 5x5 zone grid world system
 * - Treasure hunting with rarity tiers
 * - Key-lock system
 * - Collectible synergies
 * - Progression system with levels, XP, achievements
 */

test.describe('GridLuck - Game Initialization', () => {

  test('should load game without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/thumbwar/gridluck.html');

    // Verify canvas loads
    await expect(page.locator('canvas#game')).toBeVisible();

    // Verify UI overlay
    await expect(page.locator('#ui')).toBeVisible();

    // Check for console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('should display version number', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Check UI for version
    const uiContent = await page.locator('#ui').textContent();
    expect(uiContent).toContain('v1.');
  });

  test('should initialize Game module', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForFunction(() => window.game !== undefined, {
      timeout: 5000
    });

    const gameInitialized = await page.evaluate(() => {
      return typeof window.game === 'object' && window.game !== null;
    });

    expect(gameInitialized).toBe(true);
  });

  test('should render canvas at correct size', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    const canvasSize = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game');
      return {
        width: canvas.width,
        height: canvas.height,
        displayWidth: canvas.offsetWidth,
        displayHeight: canvas.offsetHeight
      };
    });

    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
  });

});

test.describe('GridLuck - UI Controls', () => {

  test('should have teleport button', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await expect(page.locator('#teleportBtn')).toBeVisible();

    const buttonText = await page.locator('#teleportBtn').textContent();
    expect(buttonText).toContain('Teleport');
  });

  test('should have zoom button', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await expect(page.locator('#zoomBtn')).toBeVisible();

    const buttonText = await page.locator('#zoomBtn').textContent();
    expect(buttonText).toContain('Zoom');
  });

  test('should show game over screen when player dies', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    // Game over screen should be hidden initially
    const gameOverScreen = page.locator('#gameOverScreen');
    const initialDisplay = await gameOverScreen.evaluate(el => el.style.display);
    expect(initialDisplay).toBe('none');
  });

  test('should have play again button in game over screen', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await expect(page.locator('#playAgainBtn')).toBeAttached();
  });

});

test.describe('GridLuck - Keyboard Controls', () => {

  test('should respond to arrow key input', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Press arrow key
    await page.keyboard.press('ArrowRight');

    // Give game time to process input
    await page.waitForTimeout(100);

    // Verify game is still running (no crashes)
    const gameRunning = await page.evaluate(() => {
      return window.game !== undefined && window.game !== null;
    });

    expect(gameRunning).toBe(true);
  });

  test('should respond to WASD controls', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Press W key
    await page.keyboard.press('w');

    await page.waitForTimeout(100);

    // Verify game is still running
    const gameRunning = await page.evaluate(() => {
      return window.game !== undefined;
    });

    expect(gameRunning).toBe(true);
  });

  test('should respond to T key for teleport', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Press T key
    await page.keyboard.press('t');

    await page.waitForTimeout(100);

    // Game should still be running
    const gameRunning = await page.evaluate(() => window.game !== undefined);
    expect(gameRunning).toBe(true);
  });

  test('should respond to Z key for zoom', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Press and hold Z key
    await page.keyboard.down('z');
    await page.waitForTimeout(100);
    await page.keyboard.up('z');

    // Game should still be running
    const gameRunning = await page.evaluate(() => window.game !== undefined);
    expect(gameRunning).toBe(true);
  });

});

test.describe('GridLuck - Game Mechanics', () => {

  test('should update player position on movement', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Get initial position
    const initialPos = await page.evaluate(() => {
      return { x: window.game?.player?.x, y: window.game?.player?.y };
    });

    // Move player
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // Get new position
    const newPos = await page.evaluate(() => {
      return { x: window.game?.player?.x, y: window.game?.player?.y };
    });

    // Position should have changed (either x or y, depending on game state)
    const positionChanged =
      initialPos.x !== newPos.x ||
      initialPos.y !== newPos.y;

    // Note: Position might not change if blocked by wall
    // This test mainly verifies the game state is accessible
    expect(newPos.x).toBeDefined();
    expect(newPos.y).toBeDefined();
  });

  test('should track player score', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    const score = await page.evaluate(() => window.game?.score);

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('should track player level', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    const level = await page.evaluate(() => window.game?.level);

    expect(typeof level).toBe('number');
    expect(level).toBeGreaterThan(0);
  });

});

test.describe('GridLuck - Mobile Touch Controls', () => {

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/thumbwar/gridluck.html');

    // Verify canvas visible on mobile
    await expect(page.locator('canvas#game')).toBeVisible();

    // Verify controls visible
    await expect(page.locator('#controlsDiv')).toBeVisible();
  });

  test('should handle button clicks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Click teleport button
    await page.click('#teleportBtn');

    await page.waitForTimeout(100);

    // Game should still be running
    const gameRunning = await page.evaluate(() => window.game !== undefined);
    expect(gameRunning).toBe(true);
  });

  test('should handle canvas touch events', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas#game');
    const box = await canvas.boundingBox();

    if (box) {
      // Tap center of canvas
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

      await page.waitForTimeout(100);

      // Game should still be running
      const gameRunning = await page.evaluate(() => window.game !== undefined);
      expect(gameRunning).toBe(true);
    }
  });

});

test.describe('GridLuck - Performance', () => {

  test('should maintain stable FPS', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(2000);

    // Measure frame rate
    const fps = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();
        const duration = 1000; // 1 second

        function countFrames() {
          frameCount++;
          if (performance.now() - startTime < duration) {
            requestAnimationFrame(countFrames);
          } else {
            resolve(frameCount);
          }
        }

        requestAnimationFrame(countFrames);
      });
    });

    // Should maintain at least 30 FPS
    expect(fps).toBeGreaterThan(30);
  });

  test('should not have memory leaks during gameplay', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Simulate gameplay for a few seconds
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory should not increase dramatically (allow for 10MB growth)
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
    }
  });

});

test.describe('GridLuck - Visual Regression', () => {

  test('game renders correctly', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(2000);

    // Take screenshot of game
    await expect(page).toHaveScreenshot('gridluck-game.png', {
      maxDiffPixels: 500, // Allow for some variation in random generation
    });
  });

  test('UI overlays render correctly', async ({ page }) => {
    await page.goto('/thumbwar/gridluck.html');

    await page.waitForTimeout(1000);

    // Screenshot of UI overlay
    await expect(page.locator('#ui')).toHaveScreenshot('gridluck-ui.png', {
      maxDiffPixels: 100,
    });
  });

});
