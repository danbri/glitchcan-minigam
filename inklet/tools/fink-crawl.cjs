#!/usr/bin/env node
/**
 * FINK Crawl Tool
 *
 * Crawls FINK story files starting from a TOC, using inkjs runtime
 * to explore knot connectivity (no regex parsing of INK content).
 *
 * Usage:
 *   node fink-crawl.cjs                           # Local: inklet/toc.fink.js
 *   node fink-crawl.cjs inklet/hampstead.fink.js  # Local: specific file
 *   node fink-crawl.cjs --github                  # GitHub: default repo TOC
 *   node fink-crawl.cjs --url https://raw.githubusercontent.com/user/repo/main/toc.fink.js
 *
 * Output: docs/fink-crawl-report.json and docs/fink-crawl-report.md
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');
const http = require('http');

// Config
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/danbri/glitchcan-minigam/main';
const DEFAULT_LOCAL_START = 'inklet/toc.fink.js';
const DEFAULT_GITHUB_START = `${GITHUB_RAW_BASE}/inklet/toc.fink.js`;

// Parse args
const args = process.argv.slice(2);
const useGithub = args.includes('--github');
const urlArg = args.find(a => a.startsWith('--url='));
const startUrl = urlArg ? urlArg.split('=')[1] : null;
const localFile = args.find(a => !a.startsWith('--'));

// Load inkjs
const sandbox = { exports: {}, console };
const inkCode = fs.readFileSync(path.join(__dirname, '../../third_party/ink/ink-full.js'), 'utf8');
vm.runInNewContext(inkCode, sandbox);
const inkjs = sandbox.inkjs;

const results = {
  timestamp: new Date().toISOString(),
  source: 'local',
  startFile: '',
  files: [],
  summary: { total: 0, compiled: 0, failed: 0 },
  designDocs: [
    'docs/hampstead-story-graph-analysis.md',
    'docs/3dmap-idea.md'
  ]
};

const visited = new Set();
const fetchCache = new Map();

// Fetch URL content
function fetchUrl(url) {
  if (fetchCache.has(url)) return Promise.resolve(fetchCache.get(url));

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fetchCache.set(url, data);
        resolve(data);
      });
    }).on('error', reject);
  });
}

function extractInk(content) {
  const match = content.match(/oooOO\s*`([\s\S]*?)`/);
  return match ? match[1] : null;
}

function extractFinkRefs(ink) {
  const refs = [];
  for (const line of ink.split('\n')) {
    const m = line.match(/^#\s*FINK:\s*(.+)/);
    if (m) refs.push(m[1].trim());
  }
  return refs;
}

function exploreStory(story) {
  const graph = {};
  const knots = [...story.mainContentContainer.namedContent.keys()].filter(k => k !== 'global decl');

  // Build signature map
  const knotSignatures = {};
  for (const knot of knots) {
    try {
      story.ResetState();
      story.ChoosePathString(knot);
      let text = '';
      while (story.canContinue && text.length < 100) text += story.Continue();
      knotSignatures[knot] = text.trim().substring(0, 50);
    } catch(e) {}
  }

  // Explore each knot
  for (const knot of knots) {
    graph[knot] = { targets: new Set(), choices: 0, isIsland: true };

    try {
      story.ResetState();
      story.ChoosePathString(knot);
      story.onError = () => {};

      while (story.canContinue) story.Continue();

      const choices = story.currentChoices;
      graph[knot].choices = choices.length;

      for (let i = 0; i < choices.length; i++) {
        const saved = story.state.toJson();

        try {
          story.ChooseChoiceIndex(i);
          let output = '';
          while (story.canContinue && output.length < 100) output += story.Continue();
          output = output.trim().substring(0, 50);

          for (const [targetKnot, sig] of Object.entries(knotSignatures)) {
            if (sig && output.includes(sig.substring(0, 20))) {
              graph[knot].targets.add(targetKnot);
              if (graph[targetKnot]) graph[targetKnot].isIsland = false;
              break;
            }
          }
        } catch(e) {}

        story.state.LoadJson(saved);
      }
    } catch(e) {}
  }

  // Mark islands (knots with no incoming edges)
  const islands = Object.entries(graph)
    .filter(([k, v]) => v.isIsland && k !== 'splash' && k !== 'start' && k !== '0')
    .map(([k]) => k);

  // Convert to plain object
  const result = {};
  for (const [k, v] of Object.entries(graph)) {
    result[k] = { targets: [...v.targets], choices: v.choices };
  }
  return { graph: result, knotCount: knots.length, islands };
}

function resolveRef(ref, baseUrl, isRemote) {
  if (isRemote) {
    // Resolve relative URL
    if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
    const base = new URL(baseUrl);
    return new URL(ref, base).href;
  } else {
    // Local filesystem resolution
    const baseDir = path.dirname(baseUrl);
    let absPath = path.resolve(baseDir, ref);
    if (fs.existsSync(absPath)) return absPath;
    if (ref.startsWith('../')) {
      absPath = path.resolve(baseDir, ref.replace(/^\.\.\//, ''));
      if (fs.existsSync(absPath)) return absPath;
    }
    absPath = path.resolve('./inklet', path.basename(ref));
    if (fs.existsSync(absPath)) return absPath;
    return path.resolve(baseDir, ref);
  }
}

async function crawl(fileUrl, isRemote) {
  if (visited.has(fileUrl)) return;
  visited.add(fileUrl);

  const relPath = isRemote ? fileUrl : path.relative('.', fileUrl);
  const entry = { file: relPath, status: 'unknown', knots: 0, choices: 0, graph: {}, linkedFinks: [], islands: [] };
  results.summary.total++;

  let content;
  try {
    if (isRemote) {
      content = await fetchUrl(fileUrl);
    } else {
      if (!fs.existsSync(fileUrl)) {
        entry.status = 'NOT_FOUND';
        results.summary.failed++;
        results.files.push(entry);
        console.log('❌ NOT FOUND: ' + relPath);
        return;
      }
      content = fs.readFileSync(fileUrl, 'utf8');
    }
  } catch (err) {
    entry.status = 'FETCH_ERROR';
    entry.error = err.message;
    results.summary.failed++;
    results.files.push(entry);
    console.log('❌ FETCH: ' + relPath);
    return;
  }

  const ink = extractInk(content);
  if (!ink) {
    entry.status = 'NO_INK';
    results.summary.failed++;
    results.files.push(entry);
    return;
  }

  entry.linkedFinks = extractFinkRefs(ink);

  try {
    const compiler = new inkjs.Compiler(ink);
    const story = compiler.Compile();

    const { graph, knotCount, islands } = exploreStory(story);
    entry.graph = graph;
    entry.knots = knotCount;
    entry.choices = Object.values(graph).reduce((sum, k) => sum + k.choices, 0);
    entry.islands = islands;
    entry.status = 'OK';
    results.summary.compiled++;
    console.log('✅ ' + path.basename(relPath) + ' (' + entry.knots + ' knots' +
      (islands.length ? ', ' + islands.length + ' islands' : '') + ')');
  } catch (err) {
    entry.status = 'COMPILE_ERROR';
    entry.error = err.message.split('\n')[0];
    results.summary.failed++;
    console.log('❌ COMPILE: ' + path.basename(relPath));
  }

  results.files.push(entry);

  for (const ref of entry.linkedFinks) {
    const resolved = resolveRef(ref, fileUrl, isRemote);
    await crawl(resolved, isRemote);
  }
}

async function main() {
  let startFile, isRemote;

  if (startUrl) {
    startFile = startUrl;
    isRemote = true;
    results.source = 'url';
  } else if (useGithub) {
    startFile = DEFAULT_GITHUB_START;
    isRemote = true;
    results.source = 'github';
  } else {
    startFile = localFile || DEFAULT_LOCAL_START;
    isRemote = false;
    results.source = 'local';
  }

  results.startFile = startFile;

  console.log('🔍 FINK Crawl (' + results.source + ')\n');
  console.log('Starting from: ' + startFile + '\n');

  await crawl(startFile, isRemote);

  console.log('\n=== SUMMARY: ' + results.summary.compiled + '/' + results.summary.total + ' OK ===\n');

  // Save reports
  fs.mkdirSync('./docs', { recursive: true });
  fs.writeFileSync('./docs/fink-crawl-report.json', JSON.stringify(results, null, 2));

  // Generate markdown
  let md = '# FINK Crawl Report\n\n';
  md += 'Generated: ' + results.timestamp + '\n\n';
  md += '**Source:** ' + results.source + '\n';
  md += '**Start:** `' + results.startFile + '`\n\n';

  md += '## Summary\n\n';
  md += '| Total | OK | Failed |\n|-------|----|---------|\n';
  md += '| ' + results.summary.total + ' | ' + results.summary.compiled + ' | ' + results.summary.failed + ' |\n\n';

  md += '## Related Documentation\n\n';
  md += '- [Hampstead Story Graph Analysis](./hampstead-story-graph-analysis.md) - Design analysis of hub structure and cross-episode links\n';
  md += '- [3D Map Ideas](./3dmap-idea.md) - Visual/spatial representation concepts\n\n';

  for (const f of results.files) {
    const basename = path.basename(f.file);
    md += '## ' + basename + '\n\n';
    md += '**Knots:** ' + f.knots + ' | **Choices:** ' + f.choices;
    if (f.islands && f.islands.length) {
      md += ' | **Islands:** ' + f.islands.length;
    }
    md += '\n\n';

    if (f.islands && f.islands.length) {
      md += '### Islands (External Entry Points)\n\n';
      md += 'These knots have no incoming edges - likely cross-episode links:\n\n';
      for (const island of f.islands) {
        md += '- `' + island + '`\n';
      }
      md += '\n';
    }

    if (Object.keys(f.graph).length) {
      md += '### Knot Connectivity\n\n```\n';
      for (const [knot, data] of Object.entries(f.graph)) {
        if (data.targets.length) {
          md += knot + ' -> ' + data.targets.join(', ') + '\n';
        }
      }
      md += '```\n\n';
    }

    if (f.error) md += '**Error:** ' + f.error + '\n\n';
  }

  fs.writeFileSync('./docs/fink-crawl-report.md', md);
  console.log('📄 Reports saved to docs/');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
