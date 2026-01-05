// Browser-based test for app2 using Playwright
// Can run in Claude Code web environment

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple static file server
function startServer(port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let filePath = join(__dirname, '..', req.url === '/' ? '/app2/index.html' : req.url);

        // Set content type
        const ext = filePath.split('.').pop();
        const contentTypes = {
          'html': 'text/html',
          'js': 'application/javascript',
          'css': 'text/css',
          'json': 'application/json'
        };
        res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');

        const content = await readFile(filePath);
        res.writeHead(200);
        res.end(content);
      } catch (error) {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      console.log(`Test server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function testApp2Browser() {
  console.log('🌐 Testing app2 in headless browser...\n');

  const port = 3456;
  const server = await startServer(port);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const tests = [];

  try {
    // Test 1: Page loads
    tests.push({
      name: 'Page loads without errors',
      run: async () => {
        const response = await page.goto(`http://localhost:${port}/app2/`);
        return response.status() === 200;
      }
    });

    // Test 2: Title correct
    tests.push({
      name: 'Page title is correct',
      run: async () => {
        const title = await page.title();
        return title.includes('App2');
      }
    });

    // Test 3: Experimental badge present
    tests.push({
      name: 'Experimental badge visible',
      run: async () => {
        const badge = await page.locator('.app2-badge').textContent();
        return badge.includes('EXPERIMENTAL');
      }
    });

    // Test 4: Story container exists
    tests.push({
      name: 'Story container exists',
      run: async () => {
        const story = await page.locator('#story').isVisible();
        return story;
      }
    });

    // Test 5: Minigame container exists (hidden initially)
    tests.push({
      name: 'Minigame container exists but hidden',
      run: async () => {
        const container = await page.locator('#minigame-container');
        const isHidden = !(await container.isVisible());
        return isHidden;
      }
    });

    // Test 6: TOC loads
    tests.push({
      name: 'TOC story loads',
      run: async () => {
        await page.waitForTimeout(1000); // Wait for FINK load
        const content = await page.locator('#story').textContent();
        return content.includes('app2') || content.includes('Minigame');
      }
    });

    // Test 7: Choices render
    tests.push({
      name: 'Choices render on page',
      run: async () => {
        await page.waitForTimeout(1000);
        const choices = await page.locator('.choice-button').count();
        return choices > 0;
      }
    });

    // Test 8: Click first choice
    tests.push({
      name: 'Clicking choice updates story',
      run: async () => {
        const initialContent = await page.locator('#story').textContent();
        const firstChoice = page.locator('.choice-button').first();
        await firstChoice.click();
        await page.waitForTimeout(500);
        const newContent = await page.locator('#story').textContent();
        return newContent !== initialContent && newContent.length > initialContent.length;
      }
    });

    // Test 9: Debug console toggle
    tests.push({
      name: 'Debug console can be toggled',
      run: async () => {
        const debugToggle = page.locator('#debug-toggle');
        await debugToggle.click();
        await page.waitForTimeout(200);
        const debugConsole = await page.locator('#debug-console').isVisible();
        return debugConsole;
      }
    });

    // Test 10: Menu dropdown works
    tests.push({
      name: 'Menu dropdown works',
      run: async () => {
        const menuButton = page.locator('#menu-button');
        await menuButton.click();
        await page.waitForTimeout(200);
        const dropdown = page.locator('#story-dropdown');
        const hasClass = await dropdown.evaluate(el => el.classList.contains('active'));
        return hasClass;
      }
    });

    // Run all tests
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test.run();
        if (result) {
          console.log(`✅ ${test.name}`);
          passed++;
        } else {
          console.log(`❌ ${test.name} - returned false`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ ${test.name} - ${error.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    // Screenshot for visual verification
    await page.screenshot({ path: join(__dirname, 'app2-screenshot.png'), fullPage: true });
    console.log('\n📸 Screenshot saved to app2/app2-screenshot.png');

  } finally {
    await browser.close();
    server.close();
    console.log('\n🔌 Test server stopped');
  }

  return tests.every(async t => {
    try {
      return await t.run();
    } catch {
      return false;
    }
  });
}

// Run tests
testApp2Browser().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
