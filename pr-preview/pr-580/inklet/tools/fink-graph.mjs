#!/usr/bin/env node
/**
 * fink-graph.mjs - Extract graph structure from FINK/Ink files
 *
 * Uses official inkjs compiler (no manual Ink parsing).
 * Extracts FINK content using Node's vm module (no regex hackparsing).
 *
 * Usage:
 *   node fink-graph.mjs <file.fink.js|file.ink> [--json]
 *   node fink-graph.mjs --scan [--json]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Load inkjs from third_party using CommonJS require (it's a UMD bundle)
const require = createRequire(import.meta.url);
const inkjsPath = path.join(projectRoot, 'third_party/ink/ink-full.js');
const inkjs = require(inkjsPath);
const { Compiler, Story } = inkjs;

/**
 * Extract Ink content from a .fink.js file using vm module.
 * This avoids regex hackparsing by actually executing the JS.
 */
function extractFinkContent(jsSource, filename) {
  let capturedContent = null;

  // Create a sandbox with oooOO function that captures the template literal
  const sandbox = {
    oooOO: (strings, ...values) => {
      // Tagged template literal - strings array contains the literal parts
      // For our use case, there are no interpolations, so strings[0] is the full content
      capturedContent = strings[0];
      return capturedContent;
    }
  };

  try {
    // Execute the FINK JS in the sandbox
    vm.createContext(sandbox);
    vm.runInContext(jsSource, sandbox, { filename });

    if (capturedContent === null) {
      throw new Error('No oooOO template literal found in file');
    }

    return capturedContent;
  } catch (e) {
    throw new Error(`Failed to extract FINK content: ${e.message}`);
  }
}

/**
 * Compile Ink source and extract graph structure.
 * Uses official inkjs - no manual parsing.
 */
function compileAndExtractGraph(inkSource, filename) {
  const compiler = new Compiler(inkSource);
  let story;

  try {
    story = compiler.Compile();
  } catch (e) {
    const errors = compiler.errors || [];
    throw new Error(`Compilation failed: ${errors.join('; ') || e.message}`);
  }

  if (compiler.errors && compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join('; ')}`);
  }

  // Extract graph structure from compiled story
  const graph = {
    filename,
    knots: [],
    tags: [],
    warnings: compiler.warnings || []
  };

  // Get global tags
  if (story.globalTags) {
    graph.tags = story.globalTags;
  }

  // Extract knots from the main container
  const mainContainer = story.mainContentContainer;
  if (mainContainer && mainContainer.namedContent) {
    for (const [name, content] of mainContainer.namedContent) {
      const knotInfo = {
        name,
        hasContent: true
      };

      // Try to get tags for this knot by navigating to it
      try {
        story.ResetState();
        story.ChoosePathString(name);
        if (story.currentTags) {
          knotInfo.tags = [...story.currentTags];
        }
      } catch (e) {
        // Some knots may not be directly navigable
      }

      graph.knots.push(knotInfo);
    }
  }

  // Extract FINK-specific tags from source (these are legitimate Ink tags)
  const finkTags = [];
  const tagPatterns = [
    /^#\s*FINK:\s*(.+)$/gm,
    /^#\s*LINKREL:\s*(.+)$/gm,
    /^#\s*BASEHREF:\s*(.+)$/gm,
    /^#\s*IMAGE:\s*(.+)$/gm,
    /^#\s*VIDEO:\s*(.+)$/gm,
    /^#\s*FOLEY:\s*(.+)$/gm,
    /^#\s*MINIGAME:\s*(.+)$/gm,
    /^#\s*IMPORT:\s*(.+)$/gm,
    /^#\s*EXPORT:\s*(.+)$/gm,
  ];

  for (const pattern of tagPatterns) {
    let match;
    while ((match = pattern.exec(inkSource)) !== null) {
      const tagName = pattern.source.match(/(\w+):/)[1];
      finkTags.push({ type: tagName, value: match[1].trim() });
    }
  }
  graph.finkTags = finkTags;

  // Count choices by running through the story
  let choiceCount = 0;
  try {
    story.ResetState();
    const visited = new Set();
    const queue = [''];

    while (queue.length > 0 && visited.size < 100) { // Safety limit
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        story.ResetState();
        if (current) story.ChoosePathString(current);

        while (story.canContinue) {
          story.Continue();
        }

        if (story.currentChoices) {
          choiceCount += story.currentChoices.length;
        }
      } catch (e) {
        // Skip paths that fail
      }
    }
  } catch (e) {
    // Ignore traversal errors
  }
  graph.choiceCount = choiceCount;

  return graph;
}

/**
 * Process a single file (either .ink or .fink.js)
 */
async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);

  let inkSource;

  if (filePath.endsWith('.fink.js')) {
    // Extract from FINK wrapper using vm
    inkSource = extractFinkContent(content, basename);
  } else if (ext === '.ink') {
    // Direct Ink file
    inkSource = content;
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return compileAndExtractGraph(inkSource, basename);
}

/**
 * Scan repository for all FINK/Ink files
 */
async function scanRepo() {
  const files = [];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip common ignore patterns
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'vendor' ||
            entry.name === 'third_party') {
          continue;
        }

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name.endsWith('.fink.js') || entry.name.endsWith('.ink')) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  await scan(projectRoot);
  return files.sort();
}

/**
 * Print graph in human-readable format
 */
function printGraph(graph) {
  console.log(`\n📄 ${graph.filename}`);
  console.log(`   Knots: ${graph.knots.length}`);
  console.log(`   Choices: ${graph.choiceCount}`);

  if (graph.tags.length > 0) {
    console.log(`   Global tags: ${graph.tags.join(', ')}`);
  }

  if (graph.finkTags.length > 0) {
    console.log(`   FINK tags:`);
    for (const tag of graph.finkTags) {
      console.log(`     ${tag.type}: ${tag.value}`);
    }
  }

  if (graph.knots.length > 0) {
    console.log(`   Knot names: ${graph.knots.map(k => k.name).join(', ')}`);
  }

  if (graph.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${graph.warnings.length}`);
  }
}

// --- Main ---
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const filteredArgs = args.filter(a => !a.startsWith('--'));

// Helper: log to stderr when JSON output mode (keeps stdout clean for JSON)
const log = jsonOutput ? console.error.bind(console) : console.log.bind(console);

try {
  if (args.includes('--scan')) {
    log('🔍 Scanning for FINK/Ink files...\n');
    const files = await scanRepo();
    log(`Found ${files.length} files\n`);

    const results = [];
    let passed = 0, failed = 0;

    for (const file of files) {
      try {
        const graph = await processFile(file);
        results.push(graph);
        passed++;
        if (!jsonOutput) printGraph(graph);
      } catch (e) {
        failed++;
        if (!jsonOutput) {
          log(`\n❌ ${path.relative(projectRoot, file)}`);
          log(`   Error: ${e.message}`);
        } else {
          results.push({ filename: path.basename(file), error: e.message });
        }
      }
    }

    if (jsonOutput) {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
      log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
    }

    process.exit(failed > 0 ? 1 : 0);

  } else if (filteredArgs.length > 0) {
    const results = [];

    for (const file of filteredArgs) {
      try {
        const graph = await processFile(file);
        results.push(graph);
        if (!jsonOutput) printGraph(graph);
      } catch (e) {
        if (!jsonOutput) {
          console.error(`❌ ${file}: ${e.message}`);
        } else {
          results.push({ filename: path.basename(file), error: e.message });
        }
        process.exit(1);
      }
    }

    if (jsonOutput) {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    }

  } else {
    log(`Usage:
  node fink-graph.mjs <file.fink.js|file.ink> [--json]
  node fink-graph.mjs --scan [--json]

Options:
  --json    Output results as JSON
  --scan    Find and process all FINK/Ink files in repository

Examples:
  node fink-graph.mjs ../hampstead.fink.js
  node fink-graph.mjs --scan --json > universe.json
`);
  }
} catch (e) {
  console.error(`Fatal error: ${e.message}`);
  process.exit(1);
}
