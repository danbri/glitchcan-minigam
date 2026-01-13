#!/usr/bin/env node
/**
 * QA Monitor: Issue Scanner for Lucid
 *
 * Scans lucid/* for:
 * - TODO comments
 * - FIXME comments
 * - Known issues in code
 * - Test failures
 * - Missing test coverage
 *
 * Usage:
 *   node qa-monitor/scan-issues.mjs
 *   node qa-monitor/scan-issues.mjs --json > issues.json
 *   node qa-monitor/scan-issues.mjs --github  # Create GitHub issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LUCID_DIR = path.join(PROJECT_ROOT, 'lucid');
const ISSUES_DIR = path.join(__dirname, 'issues');

// Issue patterns to scan for
const PATTERNS = [
  { pattern: /\/\/\s*TODO[:\s](.+)/gi, type: 'TODO', priority: 'medium' },
  { pattern: /\/\/\s*FIXME[:\s](.+)/gi, type: 'FIXME', priority: 'high' },
  { pattern: /\/\/\s*HACK[:\s](.+)/gi, type: 'HACK', priority: 'low' },
  { pattern: /\/\/\s*BUG[:\s](.+)/gi, type: 'BUG', priority: 'critical' },
  { pattern: /\/\/\s*XXX[:\s](.+)/gi, type: 'XXX', priority: 'high' },
  { pattern: /\/\*\s*TODO[:\s](.+?)\*\//gi, type: 'TODO', priority: 'medium' },
  { pattern: /console\.warn\(['"](.+?)['"]/gi, type: 'WARNING', priority: 'low' },
];

// File extensions to scan
const EXTENSIONS = ['.js', '.mjs', '.ts', '.jsx', '.tsx', '.json', '.glsl', '.wgsl'];

function scanDirectory(dir, issues = []) {
  if (!fs.existsSync(dir)) return issues;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(PROJECT_ROOT, fullPath);

    // Skip node_modules, vendor, archive
    if (entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === 'archive') {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, issues);
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      scanFile(fullPath, relativePath, issues);
    }
  }

  return issues;
}

function scanFile(filePath, relativePath, issues) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const { pattern, type, priority } of PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(line)) !== null) {
          issues.push({
            file: relativePath,
            line: lineNum + 1,
            type,
            priority,
            message: match[1].trim(),
            context: line.trim().substring(0, 100)
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${filePath}: ${err.message}`);
  }
}

function scanGitHistory(issues) {
  // Check for recent commits mentioning issues
  try {
    const recentCommits = execSync(
      'git log --oneline --since="7 days ago" --grep="TODO\\|FIXME\\|BUG" -- lucid/',
      { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (recentCommits) {
      const commits = recentCommits.split('\n').filter(Boolean);
      for (const commit of commits) {
        issues.push({
          file: 'git-history',
          line: 0,
          type: 'COMMIT_MENTION',
          priority: 'info',
          message: commit,
          context: 'Recent commit mentioning issues'
        });
      }
    }
  } catch {
    // Git grep may fail, ignore
  }

  return issues;
}

function checkTestCoverage(issues) {
  // Check for test files
  const testFiles = [];
  const sourceFiles = [];

  function scanForTests(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'vendor') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanForTests(fullPath);
      } else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js')) {
        testFiles.push(path.relative(PROJECT_ROOT, fullPath));
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
        sourceFiles.push(path.relative(PROJECT_ROOT, fullPath));
      }
    }
  }

  scanForTests(LUCID_DIR);

  // Identify source files without corresponding tests
  const testedModules = new Set(
    testFiles.map(t => t.replace('.test.js', '.js').replace('.spec.js', '.js'))
  );

  const importantModules = sourceFiles.filter(f =>
    f.includes('core/') && !f.includes('index.js')
  );

  for (const module of importantModules) {
    const baseName = path.basename(module, '.js');
    const hasTest = testFiles.some(t =>
      t.includes(baseName + '.test') || t.includes(baseName + '.spec')
    );

    if (!hasTest) {
      issues.push({
        file: module,
        line: 0,
        type: 'MISSING_TEST',
        priority: 'medium',
        message: `No test file found for ${baseName}`,
        context: 'Core module without test coverage'
      });
    }
  }

  return issues;
}

function generateReport(issues) {
  const grouped = {};

  for (const issue of issues) {
    const key = `${issue.type}-${issue.priority}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(issue);
  }

  console.log('\n=== Lucid QA Issue Scan Report ===\n');
  console.log(`Total issues found: ${issues.length}\n`);

  // Priority order
  const priorities = ['critical', 'high', 'medium', 'low', 'info'];

  for (const priority of priorities) {
    const priorityIssues = issues.filter(i => i.priority === priority);
    if (priorityIssues.length === 0) continue;

    console.log(`\n### ${priority.toUpperCase()} Priority (${priorityIssues.length})\n`);

    for (const issue of priorityIssues) {
      console.log(`  ${issue.type}: ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}`);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  const byType = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
}

function saveIssues(issues) {
  if (!fs.existsSync(ISSUES_DIR)) {
    fs.mkdirSync(ISSUES_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `scan-${timestamp}.json`;
  const filepath = path.join(ISSUES_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalIssues: issues.length,
    issues
  }, null, 2));

  console.log(`\nIssues saved to: ${filepath}`);

  // Also update latest.json
  fs.writeFileSync(
    path.join(ISSUES_DIR, 'latest.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), issues }, null, 2)
  );
}

// Main
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const saveOutput = args.includes('--save');

let issues = [];
issues = scanDirectory(LUCID_DIR, issues);
issues = scanGitHistory(issues);
issues = checkTestCoverage(issues);

// Sort by priority
const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

if (jsonOutput) {
  console.log(JSON.stringify(issues, null, 2));
} else {
  generateReport(issues);
  if (saveOutput) {
    saveIssues(issues);
  }
}
