// FINK Player Playability Test Script
// Uses Playwright to test interactive fiction game paths

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';

const SCREENSHOT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';
const BASE_URL = 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html';

// Ensure screenshot directory exists
if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const path = `${SCREENSHOT_DIR}/playability-${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`Screenshot saved: ${path}`);
    return path;
}

async function waitForContent(page, timeout = 5000) {
    try {
        await page.waitForSelector('#story-output:not(:empty)', { timeout });
        await sleep(500); // Let animations settle
    } catch (e) {
        console.log('Warning: content may not have loaded');
    }
}

async function getChoices(page) {
    return await page.$$eval('#choices button', buttons =>
        buttons.map((b, i) => ({ index: i, text: b.textContent.trim() }))
    );
}

async function clickChoice(page, indexOrText) {
    if (typeof indexOrText === 'number') {
        const buttons = await page.$$('#choices button');
        if (buttons[indexOrText]) {
            await buttons[indexOrText].click();
            await waitForContent(page);
            return true;
        }
    } else {
        const button = await page.$(`#choices button:has-text("${indexOrText}")`);
        if (button) {
            await button.click();
            await waitForContent(page);
            return true;
        }
    }
    return false;
}

async function getStoryText(page) {
    return await page.$eval('#story-output', el => el.textContent.trim()).catch(() => '');
}

async function getStats(page) {
    try {
        const diamonds = await page.$eval('#stat-diamonds', el => el.textContent).catch(() => '0');
        const mega = await page.$eval('#stat-mega', el => el.textContent).catch(() => '0');
        const score = await page.$eval('#stat-score', el => el.textContent).catch(() => '0');
        return { diamonds, mega, score };
    } catch (e) {
        return { diamonds: '0', mega: '0', score: '0' };
    }
}

async function isMinigameActive(page) {
    const view = await page.$('#minigame-view.active');
    return !!view;
}

async function exitMinigame(page) {
    const exitBtn = await page.$('#returnToStory');
    if (exitBtn) {
        await exitBtn.click();
        await sleep(500);
    }
}

// Test Results Storage
const testResults = {
    paths: [],
    issues: {
        blockers: [],
        confusion: [],
        polish: []
    },
    screenshots: []
};

function logResult(path, status, notes) {
    testResults.paths.push({ path, status, notes });
    console.log(`[${status}] ${path}: ${notes}`);
}

function logIssue(type, description, reproduction = '') {
    testResults.issues[type].push({ description, reproduction });
    console.log(`[ISSUE-${type.toUpperCase()}] ${description}`);
}

// =========== TEST SUITES ===========

async function testTOCLoad(page) {
    console.log('\n=== TEST: TOC Load ===');
    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    const text = await getStoryText(page);
    const choices = await getChoices(page);

    await takeScreenshot(page, '01-toc-main');

    if (text.includes('Finkiverse') || text.includes('Enter')) {
        logResult('TOC Load', 'PASS', 'Main menu loaded successfully');
        console.log(`Found ${choices.length} choices: ${choices.map(c => c.text).join(', ')}`);
        return true;
    } else {
        logResult('TOC Load', 'FAIL', 'Main menu did not load');
        logIssue('blockers', 'TOC main menu fails to load', 'Navigate to index.html');
        return false;
    }
}

async function testEpisodesMenu(page) {
    console.log('\n=== TEST: Episodes Menu ===');

    // Click Episodes
    if (await clickChoice(page, 'Episodes')) {
        await takeScreenshot(page, '02-episodes-menu');

        const choices = await getChoices(page);
        const text = await getStoryText(page);

        console.log(`Episodes menu has ${choices.length} choices`);

        if (choices.some(c => c.text.includes('Hampstead') || c.text.includes('Diamond'))) {
            logResult('Episodes Menu', 'PASS', 'Episodes menu accessible');
            return true;
        }
    }

    logResult('Episodes Menu', 'FAIL', 'Could not access episodes menu');
    return false;
}

async function testHampsteadPath(page) {
    console.log('\n=== TEST: Hampstead Story Path ===');

    // First navigate to episodes and select Hampstead
    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    await clickChoice(page, 'Episodes');
    await sleep(1000);
    await takeScreenshot(page, '03-hampstead-select');

    await clickChoice(page, 'Hampstead');
    await sleep(1000);
    await takeScreenshot(page, '04-hampstead-description');

    // Enter Hampstead
    const text = await getStoryText(page);
    if (text.includes('Hampstead')) {
        if (await clickChoice(page, 'enter Hampstead')) {
            await sleep(3000); // Wait for external story to load
            await takeScreenshot(page, '05-hampstead-start');

            const newText = await getStoryText(page);
            const choices = await getChoices(page);

            if (choices.length > 0 || newText.includes('Hampstead') || newText.includes('London')) {
                logResult('Hampstead Load', 'PASS', 'External story loaded');

                // Try a few choices
                for (let i = 0; i < 3; i++) {
                    const currentChoices = await getChoices(page);
                    if (currentChoices.length > 0) {
                        console.log(`  Turn ${i+1}: ${currentChoices.map(c => c.text).join(', ')}`);
                        await clickChoice(page, 0);
                        await takeScreenshot(page, `06-hampstead-turn${i+1}`);
                    } else {
                        break;
                    }
                }

                return true;
            } else {
                logIssue('blockers', 'Hampstead story content did not load', 'TOC > Episodes > Hampstead > enter');
            }
        }
    }

    logResult('Hampstead Load', 'FAIL', 'Could not enter Hampstead story');
    return false;
}

async function testDiamondCavePath(page) {
    console.log('\n=== TEST: Diamond Cave Story Path ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    await clickChoice(page, 'Episodes');
    await sleep(1000);

    await clickChoice(page, 'Diamond Cave');
    await sleep(1000);
    await takeScreenshot(page, '07-diamond-cave-select');

    // Enter Diamond Cave
    if (await clickChoice(page, 'enter Diamond Cave')) {
        await sleep(3000);
        await takeScreenshot(page, '08-diamond-cave-start');

        const text = await getStoryText(page);
        const choices = await getChoices(page);

        if (text.includes('awaken') || text.includes('cavern') || text.includes('underground')) {
            logResult('Diamond Cave Load', 'PASS', 'Story loaded successfully');

            // Test the Look around path
            if (await clickChoice(page, 'Look around')) {
                await takeScreenshot(page, '09-diamond-cave-look');

                // Navigate to gem alcove
                if (await clickChoice(page, 'Enter the gem alcove')) {
                    await takeScreenshot(page, '10-gem-alcove');
                    logResult('Diamond Cave Navigation', 'PASS', 'Reached gem alcove');
                    return true;
                }
            }
        }
    }

    logResult('Diamond Cave Load', 'FAIL', 'Could not enter Diamond Cave');
    return false;
}

async function testGemsMinigame(page) {
    console.log('\n=== TEST: Gems Minigame ===');

    // Continue from gem alcove or restart
    const text = await getStoryText(page);
    if (!text.includes('gem') && !text.includes('alcove')) {
        // Need to navigate there
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);
        await clickChoice(page, 'Episodes');
        await sleep(1000);
        await clickChoice(page, 'Diamond Cave');
        await sleep(1000);
        await clickChoice(page, 'enter Diamond Cave');
        await sleep(3000);
        await clickChoice(page, 'Look around');
        await sleep(1000);
        await clickChoice(page, 'Enter the gem alcove');
        await sleep(1000);
    }

    await takeScreenshot(page, '11-before-minigame');

    // Start minigame
    if (await clickChoice(page, 'Mine for gems')) {
        await sleep(1000);
        await takeScreenshot(page, '12-minigame-starting');

        // Check if minigame view is active
        const isActive = await isMinigameActive(page);
        console.log(`Minigame view active: ${isActive}`);

        if (isActive) {
            logResult('Gems Minigame Launch', 'PASS', 'Minigame view activated');

            // Wait a bit and take screenshot of game
            await sleep(2000);
            await takeScreenshot(page, '13-minigame-active');

            // Check for gems in the game container
            const gameContent = await page.$eval('#game-container', el => el.innerHTML).catch(() => '');
            console.log(`Game container has content: ${gameContent.length > 0}`);

            // Wait for gems to spawn and auto-complete or timeout
            await sleep(8000);
            await takeScreenshot(page, '14-minigame-mid');

            // Try to exit
            await exitMinigame(page);
            await sleep(1000);
            await takeScreenshot(page, '15-after-minigame');

            // Check stats
            const stats = await getStats(page);
            console.log(`Stats after minigame: diamonds=${stats.diamonds}, mega=${stats.mega}, score=${stats.score}`);

            logResult('Gems Minigame', 'PASS', `Completed - diamonds: ${stats.diamonds}`);
            return true;
        } else {
            logIssue('blockers', 'Gems minigame view did not activate', 'Diamond Cave > gem alcove > Mine for gems');
        }
    }

    logResult('Gems Minigame', 'FAIL', 'Could not start minigame');
    return false;
}

async function testChapter2Navigation(page) {
    console.log('\n=== TEST: Chapter 2 (Mugging Path) ===');

    // Need diamonds and escape first, then chapter 2
    // For testing, use dev skip or simulate having diamonds

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);
    await clickChoice(page, 'Episodes');
    await sleep(1000);
    await clickChoice(page, 'Diamond Cave');
    await sleep(1000);
    await clickChoice(page, 'enter Diamond Cave');
    await sleep(3000);

    // Look for dev/skip options
    const choices = await getChoices(page);
    console.log('Initial choices:', choices.map(c => c.text).join(', '));

    // Try Dev option if available
    if (await clickChoice(page, 'Dev: Skip to World Pools')) {
        await sleep(3000);
        await takeScreenshot(page, '16-dev-skip');
        logResult('Dev Skip', 'PASS', 'Dev navigation works');
    } else {
        // Play through normally - explore and collect gems
        await clickChoice(page, 'Look around');
        await sleep(1000);
        await takeScreenshot(page, '17-ch2-path');
    }

    return true;
}

async function testRestartButton(page) {
    console.log('\n=== TEST: Restart Button ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    // Navigate somewhere
    await clickChoice(page, 'Episodes');
    await sleep(1000);

    // Click restart button
    const restartBtn = await page.$('#restartBtn');
    if (restartBtn) {
        await restartBtn.click();
        await sleep(2000);
        await takeScreenshot(page, '18-after-restart');

        const text = await getStoryText(page);
        if (text.includes('Finkiverse') || text.includes('Enter')) {
            logResult('Restart Button', 'PASS', 'Returns to main menu');
            return true;
        }
    }

    logResult('Restart Button', 'FAIL', 'Restart did not work as expected');
    logIssue('polish', 'Restart button behavior unclear');
    return false;
}

async function testHomeButton(page) {
    console.log('\n=== TEST: Home Button ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    // Navigate deep
    await clickChoice(page, 'Episodes');
    await sleep(1000);
    await clickChoice(page, 'Hampstead');
    await sleep(1000);

    // Click home button
    const homeBtn = await page.$('#homeBtn');
    if (homeBtn) {
        await homeBtn.click();
        await sleep(2000);
        await takeScreenshot(page, '19-after-home');

        const text = await getStoryText(page);
        if (text.includes('Finkiverse') || text.includes('Enter')) {
            logResult('Home Button', 'PASS', 'Returns to TOC');
            return true;
        }
    }

    logResult('Home Button', 'FAIL', 'Home button did not return to TOC');
    logIssue('confusion', 'Home button does not clearly return to main menu');
    return false;
}

async function testMinigamesMenu(page) {
    console.log('\n=== TEST: Minigames Menu ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    await clickChoice(page, 'Minigames');
    await sleep(1000);
    await takeScreenshot(page, '20-minigames-menu');

    const choices = await getChoices(page);
    console.log('Minigames:', choices.map(c => c.text).join(', '));

    if (choices.some(c => c.text.includes('GridLuck') || c.text.includes('BoidWars'))) {
        logResult('Minigames Menu', 'PASS', 'Menu accessible');

        // Try GridLuck
        if (await clickChoice(page, 'GridLuck')) {
            await sleep(1000);
            await takeScreenshot(page, '21-gridluck-desc');

            if (await clickChoice(page, 'Play GridLuck')) {
                await sleep(3000);
                await takeScreenshot(page, '22-gridluck-game');
                logResult('GridLuck Launch', 'PASS', 'Game launched');
            }
        }
        return true;
    }

    logResult('Minigames Menu', 'FAIL', 'Could not access minigames');
    return false;
}

async function testBreadcrumb(page) {
    console.log('\n=== TEST: Breadcrumb Navigation ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    // Toggle breadcrumb
    const toggle = await page.$('#breadcrumb-toggle');
    if (toggle) {
        await toggle.click();
        await sleep(500);
        await takeScreenshot(page, '23-breadcrumb-open');

        // Navigate and check if it updates
        await clickChoice(page, 'Episodes');
        await sleep(1000);

        const breadcrumb = await page.$eval('#breadcrumb-knots', el => el.textContent).catch(() => '');
        console.log('Breadcrumb content:', breadcrumb);

        if (breadcrumb && breadcrumb.length > 0) {
            logResult('Breadcrumb', 'PASS', 'Shows navigation path');
            return true;
        }
    }

    logResult('Breadcrumb', 'PARTIAL', 'Breadcrumb exists but may need improvement');
    logIssue('polish', 'Breadcrumb navigation path not clearly visible');
    return true;
}

async function testDevPanel(page) {
    console.log('\n=== TEST: Dev Panel ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    // Open settings/dev panel
    const settingsBtn = await page.$('#settingsBtn');
    if (settingsBtn) {
        await settingsBtn.click();
        await sleep(500);
        await takeScreenshot(page, '24-dev-panel');

        const panel = await page.$('#dev-panel');
        const isVisible = await panel?.isVisible();

        if (isVisible) {
            logResult('Dev Panel', 'PASS', 'Opens correctly');

            // Close it
            const closeBtn = await page.$('#closeDevPanel');
            if (closeBtn) {
                await closeBtn.click();
                await sleep(500);
            }
            return true;
        }
    }

    logResult('Dev Panel', 'FAIL', 'Could not open dev panel');
    return false;
}

async function testVariablePersistence(page) {
    console.log('\n=== TEST: Variable Persistence ===');

    await page.goto(BASE_URL);
    await waitForContent(page, 10000);

    // Navigate to Diamond Cave and play minigame
    await clickChoice(page, 'Episodes');
    await sleep(1000);
    await clickChoice(page, 'Diamond Cave');
    await sleep(1000);
    await clickChoice(page, 'enter Diamond Cave');
    await sleep(3000);

    // Get initial stats
    const initialStats = await getStats(page);
    console.log('Initial stats:', initialStats);

    // Play through to collect gems
    await clickChoice(page, 'Look around');
    await sleep(1000);
    await clickChoice(page, 'Enter the gem alcove');
    await sleep(1000);
    await clickChoice(page, 'Mine for gems');
    await sleep(1000);

    // Wait for minigame
    await sleep(5000);
    await exitMinigame(page);
    await sleep(1000);

    // Check stats after
    const afterStats = await getStats(page);
    console.log('Stats after minigame:', afterStats);

    // Navigate away and back
    await clickChoice(page, 'Return to the main cavern');
    await sleep(1000);

    const finalStats = await getStats(page);
    console.log('Stats after navigation:', finalStats);

    if (parseInt(afterStats.diamonds) > 0 && afterStats.diamonds === finalStats.diamonds) {
        logResult('Variable Persistence', 'PASS', 'Diamonds persisted after navigation');
        return true;
    }

    logIssue('confusion', 'Variable persistence between scenes unclear');
    logResult('Variable Persistence', 'PARTIAL', 'Needs more testing');
    return true;
}

// =========== MAIN TEST RUNNER ===========

async function runAllTests() {
    console.log('Starting FINK Playability Tests...\n');
    console.log('Screenshots will be saved to:', SCREENSHOT_DIR);

    const browser = await chromium.launch({
        headless: true,
        executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        args: ['--headless=new', '--no-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    // Capture console messages
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
            logIssue('polish', `Console error: ${msg.text().substring(0, 100)}`);
        }
    });

    try {
        // Run test suites
        await testTOCLoad(page);
        await testEpisodesMenu(page);
        await testHampsteadPath(page);
        await testDiamondCavePath(page);
        await testGemsMinigame(page);
        await testChapter2Navigation(page);
        await testRestartButton(page);
        await testHomeButton(page);
        await testMinigamesMenu(page);
        await testBreadcrumb(page);
        await testDevPanel(page);
        await testVariablePersistence(page);

    } catch (error) {
        console.error('Test error:', error);
        logIssue('blockers', `Test crashed: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Print summary
    console.log('\n========== TEST SUMMARY ==========');
    console.log('\nPaths Tested:');
    testResults.paths.forEach(p => {
        console.log(`  [${p.status}] ${p.path}: ${p.notes}`);
    });

    console.log('\nIssues Found:');
    console.log('  Blockers:', testResults.issues.blockers.length);
    testResults.issues.blockers.forEach(i => console.log(`    - ${i.description}`));
    console.log('  Confusion:', testResults.issues.confusion.length);
    testResults.issues.confusion.forEach(i => console.log(`    - ${i.description}`));
    console.log('  Polish:', testResults.issues.polish.length);
    testResults.issues.polish.forEach(i => console.log(`    - ${i.description}`));

    return testResults;
}

// Run tests and export results
const results = await runAllTests();
console.log('\nTests complete. Results:', JSON.stringify(results, null, 2));
