// Usability test script for FINK Player
import { chromium } from 'playwright';
import { writeFile } from 'fs/promises';

const BASE_URL = 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/index.html';
const SCREENSHOT_DIR = '/home/user/glitchcan-minigam/worknotes/reviews';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runUsabilityTest() {
    const browser = await chromium.launch({
        headless: true,
        executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        args: ['--headless=new', '--no-sandbox']
    });

    const findings = {
        screenshots: [],
        consoleErrors: [],
        consoleWarnings: [],
        issues: { critical: [], major: [], minor: [] },
        metrics: {}
    };

    // Desktop viewport test
    console.log('=== Desktop Test (1280x720) ===');
    const desktopContext = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const desktopPage = await desktopContext.newPage();

    // Capture console messages
    desktopPage.on('console', msg => {
        if (msg.type() === 'error') findings.consoleErrors.push(msg.text());
        if (msg.type() === 'warning') findings.consoleWarnings.push(msg.text());
    });

    // 1. Initial Load State
    console.log('1. Testing initial load...');
    await desktopPage.goto(BASE_URL);
    await delay(1000);
    await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-01-initial-load-desktop.png` });
    findings.screenshots.push({ name: 'usability-01-initial-load-desktop.png', desc: 'Initial load state on desktop' });

    // 2. Wait for content to load
    console.log('2. Waiting for content...');
    await delay(3000);
    await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-02-content-loaded-desktop.png` });
    findings.screenshots.push({ name: 'usability-02-content-loaded-desktop.png', desc: 'Content loaded state on desktop' });

    // 3. Test radial menu
    console.log('3. Testing radial menu...');
    const radialTrigger = await desktopPage.$('#radial-menu-trigger');
    if (radialTrigger) {
        await radialTrigger.click();
        await delay(500);
        await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-03-radial-menu-open.png` });
        findings.screenshots.push({ name: 'usability-03-radial-menu-open.png', desc: 'Radial menu opened' });
        // Close it
        await radialTrigger.click();
        await delay(300);
    } else {
        findings.issues.major.push('Radial menu trigger not found');
    }

    // 4. Check choice buttons
    console.log('4. Looking for choice buttons...');
    const choices = await desktopPage.$$('.choice-btn');
    console.log(`Found ${choices.length} choices`);
    findings.metrics.choiceCount = choices.length;

    // 5. Test clicking a choice if available
    if (choices.length > 0) {
        console.log('5. Clicking first choice...');
        await choices[0].click();
        await delay(2000);
        await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-04-after-choice-desktop.png` });
        findings.screenshots.push({ name: 'usability-04-after-choice-desktop.png', desc: 'After selecting first choice' });
    }

    // 6. Check for developer panel
    console.log('6. Testing developer panel...');
    const settingsBtn = await desktopPage.$('#settingsBtn');
    const menuSettings = await desktopPage.$('#menu-settings');
    if (menuSettings) {
        // Open radial menu first
        await radialTrigger?.click();
        await delay(300);
        await menuSettings.click();
        await delay(500);
        await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-05-dev-panel.png` });
        findings.screenshots.push({ name: 'usability-05-dev-panel.png', desc: 'Developer panel opened' });
        // Close it
        const closeDevPanel = await desktopPage.$('#closeDevPanel');
        if (closeDevPanel) await closeDevPanel.click();
        await delay(300);
    }

    // 7. Check breadcrumb navigation
    console.log('7. Testing breadcrumb toggle...');
    const breadcrumbToggle = await desktopPage.$('#breadcrumb-toggle');
    if (breadcrumbToggle) {
        await breadcrumbToggle.click();
        await delay(500);
        await desktopPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-06-breadcrumb-expanded.png` });
        findings.screenshots.push({ name: 'usability-06-breadcrumb-expanded.png', desc: 'Breadcrumb navigation expanded' });
    }

    await desktopContext.close();

    // Mobile viewport test
    console.log('\n=== Mobile Test (375x667 - iPhone SE) ===');
    const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();

    mobilePage.on('console', msg => {
        if (msg.type() === 'error') findings.consoleErrors.push('[Mobile] ' + msg.text());
    });

    // 8. Mobile initial load
    console.log('8. Mobile initial load...');
    await mobilePage.goto(BASE_URL);
    await delay(3000);
    await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/usability-07-mobile-initial.png` });
    findings.screenshots.push({ name: 'usability-07-mobile-initial.png', desc: 'Mobile initial load (375x667)' });

    // 9. Mobile radial menu
    console.log('9. Mobile radial menu...');
    const mobileRadial = await mobilePage.$('#radial-menu-trigger');
    if (mobileRadial) {
        await mobileRadial.tap();
        await delay(500);
        await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/usability-08-mobile-menu.png` });
        findings.screenshots.push({ name: 'usability-08-mobile-menu.png', desc: 'Mobile radial menu open' });
    }

    // 10. Test scrolling
    console.log('10. Testing scroll behavior...');
    await mobilePage.evaluate(() => {
        const narrative = document.querySelector('#narrative-view');
        if (narrative) narrative.scrollTop = 200;
    });
    await delay(300);
    await mobilePage.screenshot({ path: `${SCREENSHOT_DIR}/usability-09-mobile-scrolled.png` });
    findings.screenshots.push({ name: 'usability-09-mobile-scrolled.png', desc: 'Mobile view after scroll' });

    await mobileContext.close();

    // Small mobile viewport test (320px width)
    console.log('\n=== Small Mobile Test (320x568) ===');
    const smallMobileContext = await browser.newContext({
        viewport: { width: 320, height: 568 },
        isMobile: true,
        hasTouch: true
    });
    const smallPage = await smallMobileContext.newPage();
    await smallPage.goto(BASE_URL);
    await delay(3000);
    await smallPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-10-small-mobile.png` });
    findings.screenshots.push({ name: 'usability-10-small-mobile.png', desc: 'Very small mobile (320x568)' });

    await smallMobileContext.close();

    // Tablet viewport test
    console.log('\n=== Tablet Test (768x1024 - iPad) ===');
    const tabletContext = await browser.newContext({
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true
    });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(BASE_URL);
    await delay(3000);
    await tabletPage.screenshot({ path: `${SCREENSHOT_DIR}/usability-11-tablet.png` });
    findings.screenshots.push({ name: 'usability-11-tablet.png', desc: 'Tablet view (768x1024)' });

    await tabletContext.close();

    await browser.close();

    // Write findings to JSON for further analysis
    await writeFile(`${SCREENSHOT_DIR}/usability-findings.json`, JSON.stringify(findings, null, 2));

    console.log('\n=== Test Complete ===');
    console.log(`Screenshots: ${findings.screenshots.length}`);
    console.log(`Console Errors: ${findings.consoleErrors.length}`);
    console.log(`Console Warnings: ${findings.consoleWarnings.length}`);

    return findings;
}

runUsabilityTest().catch(console.error);
