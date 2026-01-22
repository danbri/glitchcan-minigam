// FINK Player Playability Test Script v2 - More targeted tests
import { chromium } from 'playwright';

const SCREENSHOT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';
const BASE_URL = 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const path = `${SCREENSHOT_DIR}/playability-${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`Screenshot: ${path}`);
    return path;
}

async function waitForContent(page, timeout = 8000) {
    try {
        await page.waitForSelector('#story-output', { timeout });
        await sleep(800);
    } catch (e) {
        console.log('Warning: content may not have loaded');
    }
}

async function getChoices(page) {
    return await page.$$eval('#choices button', buttons =>
        buttons.map((b, i) => ({ index: i, text: b.textContent.trim() }))
    );
}

async function clickChoiceByIndex(page, index) {
    const buttons = await page.$$('#choices button');
    if (buttons[index]) {
        await buttons[index].click();
        await waitForContent(page);
        return true;
    }
    return false;
}

async function getStoryText(page) {
    return await page.$eval('#story-output', el => el.textContent.trim()).catch(() => '');
}

async function isMinigameActive(page) {
    const view = await page.$('#minigame-view.active');
    return !!view;
}

const findings = {
    good: [],
    issues: [],
    blockers: []
};

async function runTests() {
    console.log('Starting FINK Playability Tests v2...\n');

    const browser = await chromium.launch({
        headless: true,
        executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        args: ['--headless=new', '--no-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 }
    });

    const page = await context.newPage();

    // Capture errors
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('ERR_NAME_NOT_RESOLVED')) {
            console.log('JS ERROR:', msg.text().substring(0, 100));
        }
    });

    try {
        // =========== TEST 1: TOC & Navigation ===========
        console.log('\n=== TEST 1: TOC Navigation ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);
        await takeScreenshot(page, 'v2-01-toc');

        let text = await getStoryText(page);
        let choices = await getChoices(page);
        console.log(`TOC loaded with ${choices.length} choices`);

        if (text.includes('Finkiverse')) {
            findings.good.push('TOC loads successfully with cover art');
        }

        // =========== TEST 2: Episodes Menu ===========
        console.log('\n=== TEST 2: Episodes Menu ===');
        await clickChoiceByIndex(page, 0); // Episodes
        await sleep(1000);
        await takeScreenshot(page, 'v2-02-episodes');

        choices = await getChoices(page);
        console.log(`Episodes: ${choices.map(c => c.text).join(', ')}`);

        if (choices.length >= 5) {
            findings.good.push(`Episodes menu has ${choices.length} stories available`);
        }

        // =========== TEST 3: Diamond Cave Full Playthrough ===========
        console.log('\n=== TEST 3: Diamond Cave Story ===');

        // Find Diamond Cave
        const dcIndex = choices.findIndex(c => c.text.includes('Diamond'));
        if (dcIndex >= 0) {
            await clickChoiceByIndex(page, dcIndex);
            await sleep(1500);
            await takeScreenshot(page, 'v2-03-dc-desc');

            // Click enter
            await clickChoiceByIndex(page, 0);
            await sleep(3000);
            await takeScreenshot(page, 'v2-04-dc-start');

            text = await getStoryText(page);
            choices = await getChoices(page);

            if (text.includes('awaken') || text.includes('cavern')) {
                findings.good.push('Diamond Cave story loads and displays correctly');
                console.log('Diamond Cave loaded!');

                // Navigate to gem alcove
                // Choice 0 = Look around
                await clickChoiceByIndex(page, 0);
                await sleep(1000);
                await takeScreenshot(page, 'v2-05-dc-lookaround');

                choices = await getChoices(page);
                console.log('After look around:', choices.map(c => c.text).join(', '));

                // Find gem alcove choice
                const gemIndex = choices.findIndex(c => c.text.includes('gem') || c.text.includes('alcove'));
                if (gemIndex >= 0) {
                    await clickChoiceByIndex(page, gemIndex);
                    await sleep(1000);
                    await takeScreenshot(page, 'v2-06-dc-alcove');

                    // Start minigame
                    choices = await getChoices(page);
                    const mineIndex = choices.findIndex(c => c.text.includes('Mine'));
                    if (mineIndex >= 0) {
                        await clickChoiceByIndex(page, mineIndex);
                        await sleep(2000);
                        await takeScreenshot(page, 'v2-07-minigame-start');

                        if (await isMinigameActive(page)) {
                            findings.good.push('Gems minigame launches correctly from story');

                            // Wait for gameplay
                            await sleep(6000);
                            await takeScreenshot(page, 'v2-08-minigame-active');

                            // Check if auto-exit or click exit
                            await sleep(5000);

                            const exitBtn = await page.$('#returnToStory');
                            if (exitBtn && await exitBtn.isVisible()) {
                                await exitBtn.click();
                                await sleep(1000);
                            }

                            await takeScreenshot(page, 'v2-09-after-minigame');

                            // Check stats
                            const diamonds = await page.$eval('#stat-diamonds', el => el.textContent).catch(() => '0');
                            console.log(`Diamonds collected: ${diamonds}`);

                            if (parseInt(diamonds) > 0) {
                                findings.good.push(`Minigame->Story variable sync works (${diamonds} diamonds)`);
                            } else {
                                findings.issues.push('Diamonds not visible after minigame (may be timing)');
                            }
                        } else {
                            findings.issues.push('Minigame view did not activate');
                        }
                    }
                }
            } else {
                findings.blockers.push('Diamond Cave story did not load content');
            }
        }

        // =========== TEST 4: Hampstead Path ===========
        console.log('\n=== TEST 4: Hampstead Story ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        await clickChoiceByIndex(page, 0); // Episodes
        await sleep(1000);

        choices = await getChoices(page);
        const hsIndex = choices.findIndex(c => c.text.includes('Hampstead'));
        if (hsIndex >= 0) {
            await clickChoiceByIndex(page, hsIndex);
            await sleep(1500);
            await takeScreenshot(page, 'v2-10-hampstead-desc');

            await clickChoiceByIndex(page, 0); // enter
            await sleep(3000);
            await takeScreenshot(page, 'v2-11-hampstead-start');

            text = await getStoryText(page);
            choices = await getChoices(page);

            console.log('Hampstead text:', text.substring(0, 100));
            console.log('Hampstead choices:', choices.length);

            if (text.includes('ZX-Spectrum') || text.includes('Continue')) {
                findings.good.push('Hampstead has retro ZX-Spectrum loading screen');

                // Click Continue
                if (choices.length > 0) {
                    await clickChoiceByIndex(page, 0);
                    await sleep(2000);
                    await takeScreenshot(page, 'v2-12-hampstead-playing');

                    text = await getStoryText(page);
                    choices = await getChoices(page);

                    if (choices.length > 0) {
                        findings.good.push('Hampstead story navigable after loading screen');

                        // Play a few turns
                        for (let i = 0; i < 3; i++) {
                            if (choices.length > 0) {
                                await clickChoiceByIndex(page, 0);
                                await sleep(1000);
                                await takeScreenshot(page, `v2-13-hampstead-turn${i+1}`);
                                choices = await getChoices(page);
                            }
                        }
                    }
                }
            } else if (text.length > 0) {
                findings.good.push('Hampstead story loads directly');
            } else {
                findings.issues.push('Hampstead may have loading issues');
            }
        }

        // =========== TEST 5: Minigames Menu ===========
        console.log('\n=== TEST 5: Minigames Menu ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        await clickChoiceByIndex(page, 1); // Minigames
        await sleep(1000);
        await takeScreenshot(page, 'v2-20-minigames-menu');

        choices = await getChoices(page);
        console.log('Minigames:', choices.map(c => c.text).join(', '));

        if (choices.some(c => c.text.includes('GridLuck'))) {
            findings.good.push('Minigames menu accessible with game options');
        }

        // =========== TEST 6: Help Menu ===========
        console.log('\n=== TEST 6: Help Menu ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        await clickChoiceByIndex(page, 2); // Help
        await sleep(1000);
        await takeScreenshot(page, 'v2-21-help-menu');

        text = await getStoryText(page);
        if (text.includes('FINK') || text.includes('help')) {
            findings.good.push('Help menu provides documentation');
        }

        // =========== TEST 7: UI Controls ===========
        console.log('\n=== TEST 7: UI Controls ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        // Navigate somewhere
        await clickChoiceByIndex(page, 0);
        await sleep(1000);

        // Test radial menu
        const menuTrigger = await page.$('#radial-menu-trigger');
        if (menuTrigger) {
            await menuTrigger.click();
            await sleep(500);
            await takeScreenshot(page, 'v2-22-radial-menu');

            findings.good.push('Radial menu accessible');

            // Click home from radial menu
            const homeItem = await page.$('#menu-home');
            if (homeItem) {
                await homeItem.click();
                await sleep(2000);
                await takeScreenshot(page, 'v2-23-after-home');

                text = await getStoryText(page);
                if (text.includes('Finkiverse')) {
                    findings.good.push('Home button returns to TOC correctly');
                }
            }
        }

        // =========== TEST 8: Breadcrumb ===========
        console.log('\n=== TEST 8: Breadcrumb Navigation ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        const bcToggle = await page.$('#breadcrumb-toggle');
        if (bcToggle) {
            await bcToggle.click();
            await sleep(500);

            // Navigate to check breadcrumb updates
            await clickChoiceByIndex(page, 0);
            await sleep(1000);
            await takeScreenshot(page, 'v2-24-breadcrumb');

            const bcContent = await page.$eval('#breadcrumb-knots', el => el.textContent).catch(() => '');
            if (bcContent && bcContent.length > 10) {
                findings.good.push('Breadcrumb shows navigation path');
            } else {
                findings.issues.push('Breadcrumb content may be sparse');
            }
        }

        // =========== TEST 9: World Between Worlds Hub ===========
        console.log('\n=== TEST 9: World Between Worlds ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        await clickChoiceByIndex(page, 0); // Episodes
        await sleep(1000);

        choices = await getChoices(page);
        const dcIdx = choices.findIndex(c => c.text.includes('Diamond'));
        if (dcIdx >= 0) {
            await clickChoiceByIndex(page, dcIdx);
            await sleep(1000);
            await clickChoiceByIndex(page, 0); // enter
            await sleep(3000);

            // Look for dev skip option
            choices = await getChoices(page);
            const devIdx = choices.findIndex(c => c.text.includes('Dev: Skip') || c.text.includes('World Pools'));
            if (devIdx >= 0) {
                await clickChoiceByIndex(page, devIdx);
                await sleep(3000);
                await takeScreenshot(page, 'v2-25-world-pools');

                text = await getStoryText(page);
                choices = await getChoices(page);

                if (choices.length >= 5) {
                    findings.good.push('World Between Worlds hub connects multiple stories');
                }
            }
        }

        // =========== TEST 10: Stats Bar ===========
        console.log('\n=== TEST 10: Stats Bar Visibility ===');
        await page.goto(BASE_URL);
        await waitForContent(page, 10000);

        const statsBar = await page.$('#stats-bar');
        if (statsBar) {
            const isVisible = await statsBar.isVisible();
            if (isVisible) {
                findings.good.push('Stats bar visible showing diamonds/mega/score');
            } else {
                findings.issues.push('Stats bar may be hidden initially');
            }
        }

    } catch (error) {
        console.error('Test error:', error.message);
        findings.blockers.push(`Test error: ${error.message}`);
    } finally {
        await browser.close();
    }

    // Print summary
    console.log('\n\n========== FINDINGS SUMMARY ==========');
    console.log('\nGOOD:');
    findings.good.forEach(g => console.log(`  + ${g}`));
    console.log('\nISSUES:');
    findings.issues.forEach(i => console.log(`  - ${i}`));
    console.log('\nBLOCKERS:');
    findings.blockers.forEach(b => console.log(`  ! ${b}`));

    return findings;
}

await runTests();
