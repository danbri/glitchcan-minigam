#!/usr/bin/env node
/**
 * Claude Code Hook: Check TODO Drift
 *
 * Monitors for drift between planned tasks and actual work.
 * Warns if work appears to diverge from documented plans.
 */

import fs from 'fs';
import path from 'path';

const PLANS_FILE = path.join(process.cwd(), 'qa-monitor', 'active-plans.json');
const DRIFT_LOG = path.join(process.cwd(), 'qa-monitor', 'logs', 'drift-warnings.jsonl');

// Read hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);

    // Check for potential drift indicators
    const warnings = [];

    // Load active plans if they exist
    let activePlans = { tasks: [], focusArea: 'lucid/*' };
    if (fs.existsSync(PLANS_FILE)) {
      activePlans = JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8'));
    }

    // Check if work is outside focus area
    if (hookData.tool_name === 'Read' || hookData.tool_name === 'Edit' || hookData.tool_name === 'Write') {
      const filePath = hookData.tool_input?.file_path || '';
      if (activePlans.focusArea && !filePath.includes('lucid') && !filePath.includes('.claude') && !filePath.includes('qa-monitor')) {
        // Allow infrastructure files, warn about others
        if (!filePath.includes('test') && !filePath.includes('.github')) {
          warnings.push({
            type: 'focus_drift',
            message: `Working on ${filePath} - outside current focus area (${activePlans.focusArea})`,
            severity: 'info'
          });
        }
      }
    }

    // Log any drift warnings
    if (warnings.length > 0) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        tool: hookData.tool_name,
        warnings
      };

      const logDir = path.dirname(DRIFT_LOG);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.appendFileSync(DRIFT_LOG, JSON.stringify(logEntry) + '\n');
    }

    // Always continue - this is just monitoring
    console.log(JSON.stringify({ continue: true }));
  } catch (err) {
    // Silent fail
    console.log(JSON.stringify({ continue: true }));
  }
});
