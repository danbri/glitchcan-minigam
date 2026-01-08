#!/usr/bin/env node
/**
 * Update toc.json with Recent Changes section from git history
 *
 * Parses recent commits for scene file changes and adds them to a
 * "Recent Changes" category at the top of toc.json, with commit notes.
 *
 * Usage: node lucid/scripts/update-recent-changes.mjs [--days=7] [--max=10]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const TOC_PATH = join(ROOT, 'lucid/scenes/toc.json');
const SCENES_DIR = join(ROOT, 'lucid/scenes');

// Parse command line args
const args = process.argv.slice(2);
const daysBack = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '7');
const maxEntries = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '10');

/**
 * Get recent commits that touched scene files
 */
function getRecentSceneCommits(days) {
  const since = `${days} days ago`;
  try {
    // Get commits with their changed files
    const log = execSync(
      `git log --since="${since}" --name-only --pretty=format:"COMMIT:%H|%s|%ai" -- "lucid/scenes/**/*.json"`,
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const commits = [];
    let currentCommit = null;

    for (const line of log.split('\n')) {
      if (line.startsWith('COMMIT:')) {
        if (currentCommit && currentCommit.files.length > 0) {
          commits.push(currentCommit);
        }
        const [hash, message, date] = line.substring(7).split('|');
        currentCommit = { hash, message, date, files: [] };
      } else if (line.trim() && currentCommit && line.includes('lucid/scenes/')) {
        // Extract relative path from lucid/scenes/
        const match = line.match(/lucid\/scenes\/(.+\.json)/);
        if (match) {
          currentCommit.files.push(match[1]);
        }
      }
    }

    if (currentCommit && currentCommit.files.length > 0) {
      commits.push(currentCommit);
    }

    return commits;
  } catch (err) {
    console.error('Error getting git log:', err.message);
    return [];
  }
}

/**
 * Get scene metadata from JSON file
 */
function getSceneMetadata(scenePath) {
  const fullPath = join(SCENES_DIR, scenePath);
  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const json = JSON.parse(readFileSync(fullPath, 'utf8'));
    return {
      title: json.title || scenePath,
      subtitle: json.subtitle || json.description || ''
    };
  } catch (err) {
    return { title: scenePath, subtitle: '' };
  }
}

/**
 * Build recent changes entries from commits
 */
function buildRecentChanges(commits, maxEntries) {
  const seenPaths = new Set();
  const entries = [];

  for (const commit of commits) {
    for (const file of commit.files) {
      // Skip toc.json itself
      if (file === 'toc.json') continue;

      // Only add each scene once (most recent commit wins)
      if (seenPaths.has(file)) continue;
      seenPaths.add(file);

      const meta = getSceneMetadata(file);
      if (!meta) continue;

      // Extract key info from commit message
      let changeNote = commit.message;
      // Clean up conventional commit prefixes
      changeNote = changeNote.replace(/^(feat|fix|refactor|docs|style|test|chore)\([^)]+\):\s*/i, '');
      changeNote = changeNote.replace(/^(feat|fix|refactor|docs|style|test|chore):\s*/i, '');

      // Truncate long messages
      if (changeNote.length > 60) {
        changeNote = changeNote.substring(0, 57) + '...';
      }

      entries.push({
        path: file,
        title: meta.title,
        subtitle: `${meta.subtitle} [${changeNote}]`.trim(),
        _date: commit.date,
        _hash: commit.hash.substring(0, 7)
      });

      if (entries.length >= maxEntries) break;
    }
    if (entries.length >= maxEntries) break;
  }

  return entries;
}

/**
 * Update toc.json with recent changes
 */
function updateToc(entries) {
  const toc = JSON.parse(readFileSync(TOC_PATH, 'utf8'));

  // Find or create Recent Changes category
  let recentIdx = toc.categories.findIndex(c => c.id === 'recent');

  const recentCategory = {
    id: 'recent',
    title: '🆕 Recent Changes',
    description: `Recently modified scenes (auto-updated from git)`,
    scenes: entries.map(e => ({
      path: e.path,
      title: e.title,
      subtitle: e.subtitle
    }))
  };

  if (recentIdx >= 0) {
    toc.categories[recentIdx] = recentCategory;
  } else {
    // Insert at the beginning
    toc.categories.unshift(recentCategory);
  }

  // Update timestamp in description
  const now = new Date().toISOString().split('T')[0];
  recentCategory.description = `Recently modified scenes (updated ${now})`;

  writeFileSync(TOC_PATH, JSON.stringify(toc, null, 2) + '\n');
  console.log(`Updated toc.json with ${entries.length} recent changes`);
}

// Main
console.log(`Scanning last ${daysBack} days of commits...`);
const commits = getRecentSceneCommits(daysBack);
console.log(`Found ${commits.length} commits touching scene files`);

const entries = buildRecentChanges(commits, maxEntries);
console.log(`Built ${entries.length} recent change entries`);

if (entries.length > 0) {
  updateToc(entries);
} else {
  console.log('No recent scene changes found');
}
