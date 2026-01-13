# QA Monitor for Lucid

A monitoring and tracking system for Claude Code sessions working on the Lucid 3D SDF project.

## Purpose

1. **Non-lossy transcript archival** - Preserve full conversation history before any summarization
2. **Issue tracking** - Scan codebase for TODOs, FIXMEs, and track user-raised issues
3. **Plan drift detection** - Monitor when work diverges from documented plans
4. **Focus area enforcement** - Keep work concentrated on `lucid/*`

## Components

### Claude Code Hooks (`.claude/hooks/`)

These hooks run automatically during Claude Code sessions:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `log-tool-use.mjs` | PostToolUse | Log all tool usage to JSONL |
| `archive-transcript.mjs` | PostToolUse | Save full conversation turns |
| `check-todo-drift.mjs` | PreToolUse | Warn on focus area drift |
| `log-notification.mjs` | Notification | Capture notifications |

### Scripts (`qa-monitor/`)

| Script | Usage | Purpose |
|--------|-------|---------|
| `scan-issues.mjs` | `node qa-monitor/scan-issues.mjs` | Scan Lucid for TODOs/FIXMEs |
| `export-transcript.mjs` | `node qa-monitor/export-transcript.mjs` | Export archived transcripts |
| `track-plans.mjs` | `node qa-monitor/track-plans.mjs` | Monitor active plans |

## Usage

### Scan for Issues

```bash
# Show issue report
node qa-monitor/scan-issues.mjs

# Save to JSON
node qa-monitor/scan-issues.mjs --json > issues.json

# Save with timestamp
node qa-monitor/scan-issues.mjs --save
```

### Export Transcripts

```bash
# Export latest session as text
node qa-monitor/export-transcript.mjs

# Export as markdown
node qa-monitor/export-transcript.mjs --format markdown

# Export specific date
node qa-monitor/export-transcript.mjs --date 2026-01-13

# Search all transcripts
node qa-monitor/export-transcript.mjs --search "lucid"

# Export to file
node qa-monitor/export-transcript.mjs --format html --output session.html
```

### Track Plans

```bash
# Show current status
node qa-monitor/track-plans.mjs

# Sync TODOs from CLAUDE.md
node qa-monitor/track-plans.mjs --sync

# Check for drift warnings
node qa-monitor/track-plans.mjs --check-drift

# Extract issues from history
node qa-monitor/track-plans.mjs --extract-issues

# Full report
node qa-monitor/track-plans.mjs --report
```

## Directory Structure

```
qa-monitor/
├── README.md           # This file
├── active-plans.json   # Current plans and issues
├── scan-issues.mjs     # Issue scanner
├── export-transcript.mjs   # Transcript exporter
├── track-plans.mjs     # Plan tracker
├── logs/               # Runtime logs
│   ├── tool-usage.jsonl
│   ├── drift-warnings.jsonl
│   └── notifications.jsonl
├── issues/             # Issue scan results
│   └── latest.json
└── transcripts/        # Archived transcripts
    └── YYYY-MM-DD/
        └── session-{id}.jsonl
```

## Transcript Format

Each transcript entry (JSONL):

```json
{
  "timestamp": "2026-01-13T12:00:00.000Z",
  "turnNumber": 42,
  "hookType": "PostToolUse",
  "type": "tool_use",
  "tool": "Read",
  "input": { "file_path": "/path/to/file.js" },
  "output": "file contents...",
  "success": true
}
```

## Focus Area

Current focus: `lucid/*`

The system will log warnings when Claude works on files outside this area. These are informational only and don't block operations.

## Integration with GitHub

Issue scan results can inform GitHub Issues:

```bash
# Scan and create issues (future)
node qa-monitor/scan-issues.mjs --github
```

## Best Practices

1. **Run `--sync` regularly** to keep plans updated from CLAUDE.md
2. **Check `--report` at session start** to review outstanding issues
3. **Export transcripts** before closing long sessions
4. **Search history** when user mentions repeated issues

## Privacy Note

Transcripts contain full tool inputs/outputs. The logs directory is gitignored to prevent accidental commits of sensitive data.
