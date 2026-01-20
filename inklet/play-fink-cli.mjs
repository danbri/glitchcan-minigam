#!/usr/bin/env node
/**
 * CLI FINK Player - Blind playtest interface using Puppeteer
 * Usage: node play-fink-cli.mjs <story.fink.js> [--auto <choices>]
 *
 * Provides text-only interaction with FINK stories for blind playtesting.
 * No source code visibility - just story text and numbered choices.
 *
 * --auto mode: Pass comma-separated choices like "1,2,1,3" for automated play
 */

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract INK content from FINK .js file
function extractFinkContent(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/oooOO`([\s\S]*?)`\s*$/);
    if (!match) {
        throw new Error('Could not extract FINK content - no oooOO template literal found');
    }
    return match[1];
}

// Create a temporary HTML page for running the story
function createRunnerHtml(inkContent) {
    // Escape backticks and backslashes for embedding in JS
    const escapedContent = inkContent
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

    return `<!DOCTYPE html>
<html>
<head>
    <title>FINK CLI Runner</title>
    <script src="https://cdn.jsdelivr.net/npm/inkjs@2.2.3/dist/ink-full.js"></script>
</head>
<body>
<script>
const inkContent = \`${escapedContent}\`;

let story = null;
let storyReady = false;
let storyError = null;

// Compile the story
try {
    const compiler = new inkjs.Compiler(inkContent);
    const storyJson = compiler.Compile();
    story = new inkjs.Story(storyJson);
    storyReady = true;
} catch (e) {
    storyError = e.message;
    storyReady = true;
}

// API for Puppeteer
window.getStoryError = () => storyError;
window.isReady = () => storyReady;

window.getStoryState = () => {
    if (storyError) return { error: storyError };

    let text = '';
    while (story.canContinue) {
        text += story.Continue();
    }

    const choices = story.currentChoices.map((c, i) => ({
        index: i,
        text: c.text
    }));

    return {
        text: text,
        choices: choices,
        canContinue: story.canContinue,
        hasChoices: choices.length > 0,
        ended: !story.canContinue && choices.length === 0
    };
};

window.makeChoice = (index) => {
    if (story && index >= 0 && index < story.currentChoices.length) {
        story.ChooseChoiceIndex(index);
        return true;
    }
    return false;
};
</script>
</body>
</html>`;
}

// Main game loop
async function playStory(storyPath, autoChoices = null) {
    console.log('\n========================================');
    console.log('  FINK CLI Player - Blind Playtest Mode');
    console.log('========================================\n');
    console.log(`Loading: ${storyPath}\n`);

    // Extract INK content
    const inkContent = extractFinkContent(storyPath);

    // Create temporary HTML
    const runnerHtml = createRunnerHtml(inkContent);
    const tempHtmlPath = join(__dirname, '.temp-runner.html');
    writeFileSync(tempHtmlPath, runnerHtml);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Suppress console noise
    page.on('console', () => {});

    // Load the runner page
    await page.goto(pathToFileURL(tempHtmlPath).href);

    // Wait for story to be ready
    await page.waitForFunction(() => window.isReady(), { timeout: 15000 });

    // Check for compilation errors
    const storyError = await page.evaluate(() => window.getStoryError());
    if (storyError) {
        console.error('INK Compilation Error:', storyError);
        await browser.close();
        process.exit(1);
    }

    // Set up readline for input (if not in auto mode)
    let rl = null;
    let autoIndex = 0;
    const autoChoiceList = autoChoices ? autoChoices.split(',').map(c => parseInt(c.trim(), 10)) : null;

    if (!autoChoiceList) {
        rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    const askQuestion = (prompt) => new Promise(resolve => {
        if (autoChoiceList) {
            const choice = autoChoiceList[autoIndex++];
            console.log(`${prompt}${choice} (auto)`);
            resolve(String(choice));
        } else {
            rl.question(prompt, resolve);
        }
    });

    // Game loop
    let turnCount = 0;
    let transcript = '';

    while (true) {
        turnCount++;

        // Get current state
        const state = await page.evaluate(() => window.getStoryState());

        if (state.error) {
            console.error('Story Error:', state.error);
            break;
        }

        // Display story text
        if (state.text.trim()) {
            // Clean up text - remove IMAGE tags for CLI
            let displayText = state.text
                .replace(/^#\s*IMAGE:.*$/gm, '')
                .replace(/^#\s*BASEHREF:.*$/gm, '')
                .replace(/^#\s*CLASS:.*$/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            console.log('\n' + '─'.repeat(60));
            console.log(displayText);
            transcript += displayText + '\n';
        }

        // Check if story ended
        if (state.ended) {
            console.log('\n' + '═'.repeat(60));
            console.log('  STORY COMPLETE');
            console.log(`  Turns taken: ${turnCount}`);
            console.log('═'.repeat(60) + '\n');
            break;
        }

        // Show choices
        if (state.hasChoices) {
            console.log('\n' + '─'.repeat(60));
            console.log('CHOICES:');
            state.choices.forEach((choice, i) => {
                console.log(`  ${i + 1}. ${choice.text}`);
            });
            console.log('');
            transcript += '\nCHOICES:\n' + state.choices.map((c, i) => `  ${i+1}. ${c.text}`).join('\n') + '\n';

            // Get player input
            let validChoice = false;
            while (!validChoice) {
                const input = await askQuestion('Enter choice (number): ');
                const choiceNum = parseInt(input, 10);

                if (choiceNum >= 1 && choiceNum <= state.choices.length) {
                    await page.evaluate((idx) => window.makeChoice(idx), choiceNum - 1);
                    transcript += `> Choice: ${choiceNum}\n\n`;
                    validChoice = true;
                } else if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'q') {
                    console.log('\nExiting playtest.');
                    if (rl) rl.close();
                    await browser.close();
                    process.exit(0);
                } else if (autoChoiceList && autoIndex > autoChoiceList.length) {
                    // Auto mode ran out of choices - pick first available
                    await page.evaluate(() => window.makeChoice(0));
                    transcript += `> Choice: 1 (auto-fallback)\n\n`;
                    validChoice = true;
                } else {
                    console.log(`Invalid choice. Enter 1-${state.choices.length} or 'quit'.`);
                }
            }
        }
    }

    // Cleanup
    if (rl) rl.close();
    await browser.close();

    // Return transcript for automated testing
    return transcript;
}

// Main entry point
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node play-fink-cli.mjs <story.fink.js> [--auto <choices>]');
    console.log('');
    console.log('Examples:');
    console.log('  node play-fink-cli.mjs _tmp_shane-manor.fink.js');
    console.log('  node play-fink-cli.mjs _tmp_shane-manor.fink.js --auto "1,1,1,2,1"');
    process.exit(1);
}

let storyPath = args[0];
let autoChoices = null;

// Parse --auto flag
const autoIndex = args.indexOf('--auto');
if (autoIndex !== -1 && args[autoIndex + 1]) {
    autoChoices = args[autoIndex + 1];
}

storyPath = storyPath.startsWith('/') ? storyPath : join(process.cwd(), storyPath);

playStory(storyPath, autoChoices).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
