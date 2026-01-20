#!/usr/bin/env node
/**
 * Blind Playtest for FINK stories
 *
 * Each persona plays through the story making decisions based on their personality.
 * Output is a transcript that the subagent can analyze.
 *
 * Usage: node blind-playtest.mjs --persona=<name> --story=<path> [--port=8080]
 *
 * Personas: casual, mystery-fan, ace-attorney, speedrunner, completionist
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : defaultVal;
};

const PERSONA = getArg('persona', 'casual');
const STORY_PATH = getArg('story', '_tmp_shane-manor.fink.js');
const PORT = getArg('port', '8080');
const MAX_TURNS = parseInt(getArg('max-turns', '50'));

// Persona decision strategies
const PERSONAS = {
    'casual': {
        name: 'Casual Carly',
        description: 'First-time player, tends to pick first option or most interesting sounding',
        decide: (choices, history) => {
            // Pick first option most of the time, occasionally random
            if (Math.random() < 0.7) return 0;
            return Math.floor(Math.random() * choices.length);
        }
    },
    'mystery-fan': {
        name: 'Mystery Margaret',
        description: 'Agatha Christie superfan, looks for evidence and clues',
        decide: (choices, history) => {
            // Prefer choices with "examine", "investigate", "evidence", "safe", "letter"
            const keywords = ['examine', 'investigate', 'evidence', 'safe', 'letter', 'photo', 'search', 'look'];
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                if (keywords.some(k => text.includes(k))) return i;
            }
            // Then prefer interview/question choices
            const talkKeywords = ['interview', 'question', 'ask', 'speak', 'talk'];
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                if (talkKeywords.some(k => text.includes(k))) return i;
            }
            return 0;
        }
    },
    'ace-attorney': {
        name: 'Ace Attorney Alex',
        description: 'Phoenix Wright player, wants to confront and present evidence',
        decide: (choices, history) => {
            // Prefer "confront", "present", "accuse", "press"
            const keywords = ['confront', 'present', 'accuse', 'press', 'harder', 'lying'];
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                if (keywords.some(k => text.includes(k))) return i;
            }
            // Otherwise pick evidence-gathering
            const evidenceKeywords = ['evidence', 'examine', 'photo', 'letter'];
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                if (evidenceKeywords.some(k => text.includes(k))) return i;
            }
            return Math.floor(Math.random() * choices.length);
        }
    },
    'speedrunner': {
        name: 'Speedrun Steve',
        description: 'Wants to finish fast, picks most direct options',
        decide: (choices, history) => {
            // Prefer "accuse", "make accusation", direct confrontation
            const fastKeywords = ['accuse', 'accusation', 'enough evidence', 'time to'];
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                if (fastKeywords.some(k => text.includes(k))) return i;
            }
            // Otherwise pick first option
            return 0;
        }
    },
    'completionist': {
        name: 'Completionist Connie',
        description: 'Wants to see everything, picks unexplored options',
        decide: (choices, history) => {
            // Track what we've seen and pick something new
            const seenChoices = history.map(h => h.chosenText?.toLowerCase() || '');
            for (let i = 0; i < choices.length; i++) {
                const text = choices[i].toLowerCase();
                // Skip if we've made a very similar choice before
                const seen = seenChoices.some(s =>
                    text.includes(s.slice(0, 20)) || s.includes(text.slice(0, 20))
                );
                if (!seen) return i;
            }
            // If all seen, pick randomly
            return Math.floor(Math.random() * choices.length);
        }
    }
};

async function runPlaytest() {
    const persona = PERSONAS[PERSONA] || PERSONAS['casual'];
    const transcript = [];
    const history = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  BLIND PLAYTEST: ${persona.name}`);
    console.log(`  ${persona.description}`);
    console.log(`  Story: ${STORY_PATH}`);
    console.log(`${'='.repeat(60)}\n`);

    transcript.push(`# Blind Playtest: ${persona.name}`);
    transcript.push(`Persona: ${persona.description}`);
    transcript.push(`Story: ${STORY_PATH}`);
    transcript.push(`---\n`);

    // Launch browser
    const browser = await chromium.launch({
        headless: true,
        executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        args: ['--headless=new', '--no-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    // Track console errors
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    // Navigate to dedicated playtest page
    const url = `http://localhost:${PORT}/inklet/playtest-shane.html`;
    console.log(`Loading: ${url}\n`);

    try {
        await page.goto(url);
        await page.waitForTimeout(3000); // Wait for story to load
    } catch (e) {
        console.error(`Failed to load page: ${e.message}`);
        await browser.close();
        return;
    }

    // Game loop
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
        // Get story text
        const storyText = await page.evaluate(() => {
            const output = document.querySelector('#story-output, .story-text, #output');
            return output ? output.innerText : '';
        });

        // Get choices
        const choices = await page.evaluate(() => {
            const buttons = document.querySelectorAll('#choices button, .choice-button, .choices button');
            return Array.from(buttons)
                .map(b => b.innerText.trim())
                .filter(t => t.length > 0);
        });

        // Clean and display story text
        const cleanText = storyText
            .replace(/Loading\.\.\./g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (cleanText) {
            console.log(`\n${'─'.repeat(50)}`);
            console.log(`TURN ${turn}:`);
            console.log(cleanText.slice(-500)); // Last 500 chars
            transcript.push(`\n## Turn ${turn}`);
            transcript.push(cleanText);
        }

        // Check for end
        if (choices.length === 0) {
            // Check if this is a loading state
            if (cleanText.includes('Loading')) {
                await page.waitForTimeout(2000);
                continue;
            }

            console.log(`\n${'═'.repeat(50)}`);
            console.log('  STORY ENDED');
            console.log(`  Turns: ${turn}`);
            console.log(`${'═'.repeat(50)}`);

            transcript.push(`\n---\n## STORY ENDED after ${turn} turns`);

            // Look for ending text
            const ending = cleanText.match(/ENDING: (.+)/);
            if (ending) {
                transcript.push(`**Ending: ${ending[1]}**`);
                console.log(`  Ending: ${ending[1]}`);
            }
            break;
        }

        // Display and log choices
        console.log(`\nCHOICES:`);
        choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
        transcript.push(`\n**Choices:**`);
        choices.forEach((c, i) => transcript.push(`${i + 1}. ${c}`));

        // Make decision using persona strategy
        const choiceIndex = persona.decide(choices, history);
        const chosenText = choices[choiceIndex];

        console.log(`\n> ${persona.name} chooses: ${choiceIndex + 1}. "${chosenText}"`);
        transcript.push(`\n> **Choice:** ${choiceIndex + 1}. ${chosenText}`);

        history.push({ turn, chosenText, choices });

        // Click the choice
        try {
            await page.locator('#choices button, .choice-button, .choices button').nth(choiceIndex).click();
            await page.waitForTimeout(1500);
        } catch (e) {
            console.error(`Click failed: ${e.message}`);
            transcript.push(`\n*Error: Click failed - ${e.message}*`);
            break;
        }
    }

    // Summary
    transcript.push(`\n---\n## Summary`);
    transcript.push(`- Turns taken: ${history.length}`);
    transcript.push(`- Console errors: ${errors.length}`);
    if (errors.length > 0) {
        transcript.push(`- Error samples: ${errors.slice(0, 3).join('; ')}`);
    }

    // Save transcript
    const outputFile = `/tmp/playtest-${PERSONA}-${Date.now()}.md`;
    writeFileSync(outputFile, transcript.join('\n'));
    console.log(`\nTranscript saved: ${outputFile}`);

    // Output for subagent analysis
    console.log(`\n${'='.repeat(60)}`);
    console.log('PLAYTEST COMPLETE - TRANSCRIPT FOR ANALYSIS:');
    console.log(`${'='.repeat(60)}`);
    console.log(transcript.join('\n'));

    await browser.close();
}

runPlaytest().catch(e => {
    console.error('Playtest failed:', e);
    process.exit(1);
});
