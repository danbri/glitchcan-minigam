#!/usr/bin/env node
/**
 * Claude Code Hook: Archive Transcript (Non-Lossy)
 *
 * Captures full conversation content before summarization.
 * Triggered on significant events to preserve complete history.
 *
 * Storage: qa-monitor/transcripts/YYYY-MM-DD/session-{id}.jsonl
 *
 * Each entry contains:
 * - Timestamp
 * - Turn type (user/assistant/tool)
 * - Full content (not summarized)
 * - Tool results
 * - Any metadata
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TRANSCRIPT_BASE = path.join(process.cwd(), 'qa-monitor', 'transcripts');

// Get today's date folder
function getDateFolder() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(TRANSCRIPT_BASE, today);
}

// Get or create session ID
function getSessionId() {
  const sessionFile = path.join(TRANSCRIPT_BASE, '.current-session');

  try {
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      // Session expires after 2 hours of inactivity
      if (Date.now() - data.lastActivity < 2 * 60 * 60 * 1000) {
        // Update last activity
        data.lastActivity = Date.now();
        fs.writeFileSync(sessionFile, JSON.stringify(data));
        return data.sessionId;
      }
    }
  } catch {
    // Ignore errors, create new session
  }

  // Create new session
  const sessionId = crypto.randomBytes(4).toString('hex');
  const sessionDir = path.dirname(sessionFile);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  fs.writeFileSync(sessionFile, JSON.stringify({
    sessionId,
    started: new Date().toISOString(),
    lastActivity: Date.now()
  }));

  return sessionId;
}

// Archive a conversation turn
function archiveTurn(turnData) {
  const dateFolder = getDateFolder();
  const sessionId = getSessionId();

  if (!fs.existsSync(dateFolder)) {
    fs.mkdirSync(dateFolder, { recursive: true });
  }

  const transcriptFile = path.join(dateFolder, `session-${sessionId}.jsonl`);

  const entry = {
    timestamp: new Date().toISOString(),
    turnNumber: getTurnNumber(transcriptFile),
    ...turnData
  };

  fs.appendFileSync(transcriptFile, JSON.stringify(entry) + '\n');

  return { transcriptFile, sessionId, turnNumber: entry.turnNumber };
}

// Get current turn number
function getTurnNumber(file) {
  if (!fs.existsSync(file)) return 1;

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.length + 1;
  } catch {
    return 1;
  }
}

// Read hook input
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookData = JSON.parse(input);

    // Determine what type of event this is
    let turnData = {
      hookType: hookData.hook_type || 'unknown'
    };

    // Capture tool usage details
    if (hookData.tool_name) {
      turnData.type = 'tool_use';
      turnData.tool = hookData.tool_name;

      // Capture full input (non-lossy!)
      turnData.input = hookData.tool_input;

      // Capture full output (non-lossy!)
      if (hookData.tool_result) {
        turnData.output = hookData.tool_result.output;
        turnData.success = hookData.tool_result.success !== false;
      }
    }

    // Capture notifications
    if (hookData.notification_type) {
      turnData.type = 'notification';
      turnData.notificationType = hookData.notification_type;
      turnData.title = hookData.title;
      turnData.message = hookData.message;
    }

    // Archive it
    const result = archiveTurn(turnData);

    // Output success
    console.log(JSON.stringify({
      continue: true,
      archived: true,
      file: result.transcriptFile,
      turn: result.turnNumber
    }));

  } catch (err) {
    // Silent fail - don't block Claude
    console.log(JSON.stringify({ continue: true, error: err.message }));
  }
});
