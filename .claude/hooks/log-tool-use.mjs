#!/usr/bin/env node
/**
 * Claude Code Hook: Log Tool Use
 *
 * Records all tool usage to a session log for QA monitoring.
 * Enables full conversation history preservation and audit trails.
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'qa-monitor', 'logs');
const TOOL_LOG = path.join(LOG_DIR, 'tool-usage.jsonl');

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
      sessionId: hookData.session_id || process.env.CLAUDE_SESSION_ID || 'unknown',
      tool: hookData.tool_name || 'unknown',
      success: hookData.tool_result?.success !== false,
      // Summarize rather than log full content for privacy/size
      inputSummary: summarizeInput(hookData.tool_input),
      outputLength: hookData.tool_result?.output?.length || 0
    };

    // Append to JSONL log
    fs.appendFileSync(TOOL_LOG, JSON.stringify(logEntry) + '\n');

    // Output success for hook
    console.log(JSON.stringify({ continue: true }));
  } catch (err) {
    // Silent fail - don't block Claude
    console.log(JSON.stringify({ continue: true }));
  }
});

function summarizeInput(input) {
  if (!input) return null;

  // Extract key identifiers without full content
  if (input.file_path) return { type: 'file', path: input.file_path };
  if (input.command) return { type: 'bash', cmd: input.command.substring(0, 100) };
  if (input.pattern) return { type: 'search', pattern: input.pattern };
  if (input.prompt) return { type: 'task', prompt: input.prompt.substring(0, 100) };
  if (input.todos) return { type: 'todo', count: input.todos.length };

  return { type: 'other', keys: Object.keys(input).slice(0, 5) };
}
