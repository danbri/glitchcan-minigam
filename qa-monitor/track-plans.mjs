#!/usr/bin/env node
/**
 * QA Monitor: Plan Tracker
 *
 * Monitors active plans and prevents drift.
 * Scans conversation history to ensure nothing is forgotten.
 *
 * Usage:
 *   node qa-monitor/track-plans.mjs                    # Show current status
 *   node qa-monitor/track-plans.mjs --sync             # Sync from CLAUDE.md
 *   node qa-monitor/track-plans.mjs --check-drift      # Check for plan drift
 *   node qa-monitor/track-plans.mjs --extract-issues   # Extract issues from history
 *   node qa-monitor/track-plans.mjs --report           # Generate full report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLANS_FILE = path.join(__dirname, 'active-plans.json');
const CLAUDE_MD = path.join(PROJECT_ROOT, 'CLAUDE.md');
const TRANSCRIPTS_DIR = path.join(__dirname, 'transcripts');

function loadPlans() {
  if (!fs.existsSync(PLANS_FILE)) {
    return {
      lastUpdated: new Date().toISOString(),
      focusArea: 'lucid/*',
      activePlans: [],
      pendingIssues: [],
      userRaisedIssues: [],
      driftWarnings: []
    };
  }
  return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8'));
}

function savePlans(plans) {
  plans.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2));
}

function syncFromClaudeMd() {
  if (!fs.existsSync(CLAUDE_MD)) {
    console.log('CLAUDE.md not found');
    return;
  }

  const content = fs.readFileSync(CLAUDE_MD, 'utf8');
  const plans = loadPlans();

  // Extract TODO items from CLAUDE.md
  const todoPattern = /###?\s*TODO[^#]*?((?:^-\s*.+$\n?)+)/gim;
  const pendingPattern = /\[?\s*\]|pending|in progress|todo/i;

  let match;
  const extractedTodos = [];

  while ((match = todoPattern.exec(content)) !== null) {
    const todoBlock = match[1];
    const items = todoBlock.match(/^-\s*(.+)$/gm) || [];

    for (const item of items) {
      const text = item.replace(/^-\s*/, '').trim();
      if (pendingPattern.test(text) || !text.includes('')) {
        extractedTodos.push({
          source: 'CLAUDE.md',
          text,
          extracted: new Date().toISOString()
        });
      }
    }
  }

  // Extract section headers that mention TODO or need work
  const sectionPattern = /^#{2,3}\s*(.*(TODO|IN PROGRESS|PENDING|NEEDED).*)$/gim;
  while ((match = sectionPattern.exec(content)) !== null) {
    extractedTodos.push({
      source: 'CLAUDE.md',
      text: match[1],
      extracted: new Date().toISOString()
    });
  }

  console.log(`Extracted ${extractedTodos.length} potential TODOs from CLAUDE.md`);

  // Merge with existing issues (avoid duplicates)
  const existingTexts = new Set(plans.pendingIssues.map(i => i.text || i.issue));

  for (const todo of extractedTodos) {
    if (!existingTexts.has(todo.text)) {
      plans.pendingIssues.push({
        source: todo.source,
        issue: todo.text,
        priority: 'medium',
        extracted: todo.extracted
      });
    }
  }

  savePlans(plans);
  console.log(`Total pending issues: ${plans.pendingIssues.length}`);
}

function checkDrift() {
  const plans = loadPlans();
  const driftLog = path.join(__dirname, 'logs', 'drift-warnings.jsonl');

  if (!fs.existsSync(driftLog)) {
    console.log('No drift warnings logged yet.');
    return;
  }

  const warnings = fs.readFileSync(driftLog, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

  console.log(`\n=== Drift Analysis ===\n`);
  console.log(`Total drift warnings: ${warnings.length}`);
  console.log(`Focus area: ${plans.focusArea}\n`);

  // Group by type
  const byType = {};
  for (const w of warnings) {
    for (const warning of w.warnings || []) {
      const type = warning.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push({ ...warning, timestamp: w.timestamp });
    }
  }

  for (const [type, typeWarnings] of Object.entries(byType)) {
    console.log(`${type}: ${typeWarnings.length} occurrences`);
    // Show last 3
    const recent = typeWarnings.slice(-3);
    for (const w of recent) {
      console.log(`  - ${w.timestamp}: ${w.message}`);
    }
  }
}

function extractIssuesFromHistory() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.log('No transcripts directory found.');
    return;
  }

  const plans = loadPlans();
  const issuePatterns = [
    /user\s*(?:raised|mentioned|asked|reported|noted):\s*(.+)/gi,
    /issue:\s*(.+)/gi,
    /bug:\s*(.+)/gi,
    /problem:\s*(.+)/gi,
    /fix(?:ed)?\s+(?:needed|required):\s*(.+)/gi,
  ];

  const dateFolders = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let extractedCount = 0;

  for (const dateFolder of dateFolders) {
    const folderPath = path.join(TRANSCRIPTS_DIR, dateFolder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const turn = JSON.parse(line);
          const turnStr = JSON.stringify(turn);

          for (const pattern of issuePatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(turnStr)) !== null) {
              const issueText = match[1].substring(0, 200);
              const existing = plans.userRaisedIssues.find(i => i.issue === issueText);

              if (!existing) {
                plans.userRaisedIssues.push({
                  issue: issueText,
                  source: `${dateFolder}/${file}`,
                  timestamp: turn.timestamp,
                  status: 'open'
                });
                extractedCount++;
              }
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  savePlans(plans);
  console.log(`Extracted ${extractedCount} new issues from conversation history.`);
  console.log(`Total user-raised issues: ${plans.userRaisedIssues.length}`);
}

function generateReport() {
  const plans = loadPlans();

  console.log('\n' + '='.repeat(60));
  console.log('QA MONITOR - STATUS REPORT');
  console.log('='.repeat(60));
  console.log(`\nGenerated: ${new Date().toISOString()}`);
  console.log(`Focus Area: ${plans.focusArea}`);
  console.log(`Last Updated: ${plans.lastUpdated}`);

  // Active Plans
  console.log('\n--- ACTIVE PLANS ---\n');
  for (const plan of plans.activePlans || []) {
    console.log(`[${plan.status}] ${plan.title}`);
    if (plan.tasks) {
      for (const task of plan.tasks) {
        const icon = task.status === 'completed' ? '' : task.status === 'in_progress' ? '' : '';
        console.log(`  ${icon} ${task.title}`);
      }
    }
  }

  // Pending Issues
  console.log('\n--- PENDING ISSUES ---\n');
  const byPriority = { critical: [], high: [], medium: [], low: [] };
  for (const issue of plans.pendingIssues || []) {
    const p = issue.priority || 'medium';
    if (!byPriority[p]) byPriority[p] = [];
    byPriority[p].push(issue);
  }

  for (const [priority, issues] of Object.entries(byPriority)) {
    if (issues.length === 0) continue;
    console.log(`${priority.toUpperCase()} (${issues.length}):`);
    for (const issue of issues.slice(0, 5)) {
      console.log(`  - ${(issue.issue || '').substring(0, 80)}`);
    }
    if (issues.length > 5) {
      console.log(`  ... and ${issues.length - 5} more`);
    }
  }

  // User-Raised Issues
  if (plans.userRaisedIssues && plans.userRaisedIssues.length > 0) {
    console.log('\n--- USER-RAISED ISSUES ---\n');
    const open = plans.userRaisedIssues.filter(i => i.status === 'open');
    console.log(`Open issues: ${open.length}`);
    for (const issue of open.slice(0, 5)) {
      console.log(`  - ${issue.issue.substring(0, 80)}`);
    }
  }

  // Summary
  console.log('\n--- SUMMARY ---\n');
  console.log(`Active plans: ${(plans.activePlans || []).length}`);
  console.log(`Pending issues: ${(plans.pendingIssues || []).length}`);
  console.log(`User-raised issues: ${(plans.userRaisedIssues || []).filter(i => i.status === 'open').length} open`);
  console.log(`Drift warnings: ${(plans.driftWarnings || []).length}`);

  console.log('\n' + '='.repeat(60) + '\n');
}

function showStatus() {
  const plans = loadPlans();

  console.log('\n=== Current Plan Status ===\n');
  console.log(`Focus: ${plans.focusArea}`);
  console.log(`Last updated: ${plans.lastUpdated}\n`);

  if (plans.currentSession) {
    console.log(`Current session goal: ${plans.currentSession.goal}`);
    console.log(`Started: ${plans.currentSession.started}\n`);
  }

  const activePlan = (plans.activePlans || []).find(p => p.status === 'in_progress');
  if (activePlan) {
    console.log(`Active plan: ${activePlan.title}`);
    const completed = (activePlan.tasks || []).filter(t => t.status === 'completed').length;
    const total = (activePlan.tasks || []).length;
    console.log(`Progress: ${completed}/${total} tasks complete\n`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.includes('--sync')) {
  syncFromClaudeMd();
} else if (args.includes('--check-drift')) {
  checkDrift();
} else if (args.includes('--extract-issues')) {
  extractIssuesFromHistory();
} else if (args.includes('--report')) {
  generateReport();
} else {
  showStatus();
}
