#!/usr/bin/env node
/**
 * QA Monitor: Export Transcript
 *
 * Exports archived transcripts to various formats for review.
 *
 * Usage:
 *   node qa-monitor/export-transcript.mjs                    # Latest session
 *   node qa-monitor/export-transcript.mjs --date 2026-01-13  # Specific date
 *   node qa-monitor/export-transcript.mjs --session abc123   # Specific session
 *   node qa-monitor/export-transcript.mjs --format markdown  # Export as markdown
 *   node qa-monitor/export-transcript.mjs --format html      # Export as HTML
 *   node qa-monitor/export-transcript.mjs --search "lucid"   # Search transcripts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSCRIPT_BASE = path.join(__dirname, 'transcripts');

function parseArgs(args) {
  const options = {
    date: null,
    session: null,
    format: 'text',
    search: null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      options.date = args[++i];
    } else if (args[i] === '--session' && args[i + 1]) {
      options.session = args[++i];
    } else if (args[i] === '--format' && args[i + 1]) {
      options.format = args[++i];
    } else if (args[i] === '--search' && args[i + 1]) {
      options.search = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[++i];
    }
  }

  return options;
}

function findTranscripts(options) {
  const transcripts = [];

  if (!fs.existsSync(TRANSCRIPT_BASE)) {
    console.error('No transcripts directory found.');
    return transcripts;
  }

  // Get all date folders
  const dateFolders = fs.readdirSync(TRANSCRIPT_BASE, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map(d => d.name)
    .sort()
    .reverse();

  // Filter by date if specified
  const foldersToSearch = options.date
    ? dateFolders.filter(d => d === options.date)
    : dateFolders;

  for (const dateFolder of foldersToSearch) {
    const folderPath = path.join(TRANSCRIPT_BASE, dateFolder);
    const sessionFiles = fs.readdirSync(folderPath)
      .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'));

    for (const sessionFile of sessionFiles) {
      const sessionId = sessionFile.replace('session-', '').replace('.jsonl', '');

      // Filter by session if specified
      if (options.session && sessionId !== options.session) continue;

      transcripts.push({
        date: dateFolder,
        sessionId,
        path: path.join(folderPath, sessionFile)
      });
    }
  }

  return transcripts;
}

function loadTranscript(transcriptPath) {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function searchTranscripts(transcripts, searchTerm) {
  const results = [];
  const searchLower = searchTerm.toLowerCase();

  for (const transcript of transcripts) {
    const turns = loadTranscript(transcript.path);

    for (const turn of turns) {
      const turnJson = JSON.stringify(turn).toLowerCase();
      if (turnJson.includes(searchLower)) {
        results.push({
          ...transcript,
          turn,
          match: extractMatchContext(turn, searchTerm)
        });
      }
    }
  }

  return results;
}

function extractMatchContext(turn, searchTerm) {
  const turnStr = JSON.stringify(turn);
  const idx = turnStr.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) return '';

  const start = Math.max(0, idx - 50);
  const end = Math.min(turnStr.length, idx + searchTerm.length + 50);
  return '...' + turnStr.substring(start, end) + '...';
}

function formatAsText(transcript, turns) {
  let output = `\n=== Transcript: ${transcript.date} / Session ${transcript.sessionId} ===\n`;
  output += `Total turns: ${turns.length}\n\n`;

  for (const turn of turns) {
    output += `--- Turn ${turn.turnNumber} (${turn.timestamp}) ---\n`;
    output += `Type: ${turn.type || turn.hookType}\n`;

    if (turn.tool) {
      output += `Tool: ${turn.tool}\n`;
      if (turn.input) {
        output += `Input: ${JSON.stringify(turn.input, null, 2).substring(0, 500)}\n`;
      }
      if (turn.output) {
        const outputPreview = typeof turn.output === 'string'
          ? turn.output.substring(0, 500)
          : JSON.stringify(turn.output).substring(0, 500);
        output += `Output: ${outputPreview}...\n`;
      }
    }

    output += '\n';
  }

  return output;
}

function formatAsMarkdown(transcript, turns) {
  let output = `# Transcript: ${transcript.date}\n\n`;
  output += `**Session:** ${transcript.sessionId}\n`;
  output += `**Turns:** ${turns.length}\n\n`;

  for (const turn of turns) {
    output += `## Turn ${turn.turnNumber}\n`;
    output += `*${turn.timestamp}*\n\n`;

    if (turn.tool) {
      output += `**Tool:** \`${turn.tool}\`\n\n`;
      if (turn.input?.file_path) {
        output += `**File:** \`${turn.input.file_path}\`\n\n`;
      }
      if (turn.input?.command) {
        output += `**Command:**\n\`\`\`bash\n${turn.input.command}\n\`\`\`\n\n`;
      }
    }
  }

  return output;
}

function formatAsHtml(transcript, turns) {
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Transcript ${transcript.date} - ${transcript.sessionId}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .turn { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
    .turn-header { font-weight: bold; color: #333; margin-bottom: 10px; }
    .tool { background: #f0f7ff; padding: 5px 10px; border-radius: 4px; font-family: monospace; }
    .output { background: #f5f5f5; padding: 10px; overflow-x: auto; font-family: monospace; font-size: 12px; }
    pre { margin: 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Transcript: ${transcript.date}</h1>
  <p><strong>Session:</strong> ${transcript.sessionId}</p>
  <p><strong>Turns:</strong> ${turns.length}</p>
`;

  for (const turn of turns) {
    html += `
  <div class="turn">
    <div class="turn-header">Turn ${turn.turnNumber} - ${turn.timestamp}</div>
`;
    if (turn.tool) {
      html += `    <div class="tool">${turn.tool}</div>\n`;
    }
    if (turn.input) {
      const inputStr = JSON.stringify(turn.input, null, 2).substring(0, 1000);
      html += `    <div class="output"><pre>${escapeHtml(inputStr)}</pre></div>\n`;
    }
    html += `  </div>\n`;
  }

  html += `</body></html>`;
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Main
const options = parseArgs(process.argv.slice(2));
const transcripts = findTranscripts(options);

if (transcripts.length === 0) {
  console.log('No transcripts found matching criteria.');
  process.exit(0);
}

if (options.search) {
  const results = searchTranscripts(transcripts, options.search);
  console.log(`Found ${results.length} matches for "${options.search}":\n`);

  for (const result of results) {
    console.log(`[${result.date}/${result.sessionId}] Turn ${result.turn.turnNumber}`);
    console.log(`  ${result.match}\n`);
  }
} else {
  // Export latest or specified transcript
  const transcript = transcripts[0];
  const turns = loadTranscript(transcript.path);

  let output;
  switch (options.format) {
    case 'markdown':
    case 'md':
      output = formatAsMarkdown(transcript, turns);
      break;
    case 'html':
      output = formatAsHtml(transcript, turns);
      break;
    case 'json':
      output = JSON.stringify({ ...transcript, turns }, null, 2);
      break;
    default:
      output = formatAsText(transcript, turns);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`Exported to: ${options.output}`);
  } else {
    console.log(output);
  }
}
