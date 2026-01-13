#!/usr/bin/env node
/**
 * Claude Code Hook: Log Notifications
 *
 * Captures all notifications and important events for audit trail.
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'qa-monitor', 'logs');
const NOTIFICATION_LOG = path.join(LOG_DIR, 'notifications.jsonl');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Read hook input from stdin
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: hookData.notification_type || 'unknown',
      title: hookData.title || '',
      message: hookData.message?.substring(0, 500) || ''
    };

    fs.appendFileSync(NOTIFICATION_LOG, JSON.stringify(logEntry) + '\n');

    console.log(JSON.stringify({ continue: true }));
  } catch (err) {
    console.log(JSON.stringify({ continue: true }));
  }
});
