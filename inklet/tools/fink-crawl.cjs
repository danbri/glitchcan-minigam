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
 *   node fink-crawl.cjs --url https://...
 *
 * Output:
 *   docs/fink-crawl-report.json   - Full analysis
 *   docs/fink-crawl-report.md     - Human-readable report
 *   data/kgx/finkg.nq             - N-Quads knowledge graph
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

// Namespaces for N-Quads
const FINK = 'https://fink.ink/vocab#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';

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

const timestamp = new Date().toISOString();
const graphUri = `https://fink.ink/crawl/${timestamp.replace(/[:.]/g, '-')}`;

const results = {
  timestamp,
  source: 'local',
  startFile: '',
  files: [],
  summary: { total: 0, compiled: 0, failed: 0 },
  designDocs: [
    'docs/hampstead-story-graph-analysis.md',
    'docs/3dmap-idea.md'
  ]
};

const nquads = [];
const visited = new Set();
const fetchCache = new Map();

// N-Quads helpers
function nq(s, p, o, g = graphUri) {
  // Escape string literals
  if (typeof o === 'string' && !o.startsWith('<') && !o.startsWith('"')) {
    o = `"${o.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  nquads.push(`${s} ${p} ${o} <${g}> .`);
}

function uri(ns, local) {
  return `<${ns}${encodeURIComponent(local)}>`;
}

function literal(val, type = null) {
  const escaped = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  if (type) return `"${escaped}"^^<${type}>`;
  return `"${escaped}"`;
}

// Fetch URL content
function fetchUrl(url) {
  if (fetchCache.has(url)) return Promise.resolve(fetchCache.get(url));
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { fetchCache.set(url, data); resolve(data); });
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

// Extract choice metadata from INK source (marker type and tags)
// This is metadata extraction, not content parsing
function extractChoiceMetadata(ink) {
  const metadata = {};
  let currentKnot = null;

  for (const line of ink.split('\n')) {
    // Track current knot
    const knotMatch = line.match(/^===\s*(\w+)\s*===/);
    if (knotMatch) {
      currentKnot = knotMatch[1];
      metadata[currentKnot] = { tags: [], choices: [] };
      continue;
    }

    if (!currentKnot) continue;

    // Extract knot-level tags (IMAGE, VIDEO, MENU, etc.)
    const tagMatch = line.match(/^#\s*(IMAGE|VIDEO|MENU|BASEHREF|CLASS|BG):\s*(.+)/);
    if (tagMatch) {
      metadata[currentKnot].tags.push({ type: tagMatch[1], value: tagMatch[2].trim() });
    }

    // Extract choice type: + (regular) or * (sticky/once-only)
    // + choices can be taken multiple times, * choices disappear after selection
    const choiceMatch = line.match(/^\s*(\+|\*)\s*(?:\[([^\]]*)\]|([^->\n]+?))\s*(?:->|$)/);
    if (choiceMatch) {
      const isSticky = choiceMatch[1] === '*';
      const text = (choiceMatch[2] || choiceMatch[3] || '').trim();
      metadata[currentKnot].choices.push({
        text: text.substring(0, 50),
        repeatable: !isSticky,
        sticky: isSticky
      });
    }
  }

  return metadata;
}

function exploreStory(story, ink, fileUri) {
  const graph = {};
  const knots = [...story.mainContentContainer.namedContent.keys()].filter(k => k !== 'global decl');
  const choiceMetadata = extractChoiceMetadata(ink);

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
    const knotUri = uri(FINK, `${fileUri}#${knot}`);
    graph[knot] = { targets: new Set(), choices: 0, isIsland: true, tags: [], choiceDetails: [] };

    // Add knot to N-Quads
    nq(knotUri, `<${RDF}type>`, uri(FINK, 'Knot'));
    nq(knotUri, uri(FINK, 'name'), literal(knot));
    nq(knotUri, uri(FINK, 'inFile'), `<${fileUri}>`);

    // Add metadata from source
    const meta = choiceMetadata[knot];
    if (meta) {
      for (const tag of meta.tags) {
        nq(knotUri, uri(FINK, `tag${tag.type}`), literal(tag.value));
        graph[knot].tags.push(tag);
      }
      graph[knot].choiceDetails = meta.choices;
    }

    try {
      story.ResetState();
      story.ChoosePathString(knot);
      story.onError = () => {};

      while (story.canContinue) story.Continue();

      const choices = story.currentChoices;
      graph[knot].choices = choices.length;
      nq(knotUri, uri(FINK, 'choiceCount'), literal(choices.length, `${XSD}integer`));

      for (let i = 0; i < choices.length; i++) {
        const saved = story.state.toJson();
        const choiceText = choices[i].text.trim();

        // Get choice metadata if available
        const choiceMeta = meta?.choices[i] || { repeatable: true, sticky: false };

        try {
          story.ChooseChoiceIndex(i);
          let output = '';
          while (story.canContinue && output.length < 100) output += story.Continue();
          output = output.trim().substring(0, 50);

          for (const [targetKnot, sig] of Object.entries(knotSignatures)) {
            if (sig && output.includes(sig.substring(0, 20))) {
              graph[knot].targets.add(targetKnot);
              if (graph[targetKnot]) graph[targetKnot].isIsland = false;

              // Add edge to N-Quads
              const edgeUri = uri(FINK, `${fileUri}#${knot}->${targetKnot}`);
              const targetUri = uri(FINK, `${fileUri}#${targetKnot}`);
              nq(edgeUri, `<${RDF}type>`, uri(FINK, 'Edge'));
              nq(edgeUri, uri(FINK, 'from'), knotUri);
              nq(edgeUri, uri(FINK, 'to'), targetUri);
              nq(edgeUri, uri(FINK, 'choiceText'), literal(choiceText.substring(0, 100)));
              nq(edgeUri, uri(FINK, 'repeatable'), literal(choiceMeta.repeatable, `${XSD}boolean`));
              nq(edgeUri, uri(FINK, 'sticky'), literal(choiceMeta.sticky, `${XSD}boolean`));

              break;
            }
          }
        } catch(e) {}

        story.state.LoadJson(saved);
      }
    } catch(e) {}
  }

  // Mark islands
  const islands = Object.entries(graph)
    .filter(([k, v]) => v.isIsland && k !== 'splash' && k !== 'start' && k !== '0')
    .map(([k]) => k);

  for (const island of islands) {
    const knotUri = uri(FINK, `${fileUri}#${island}`);
    nq(knotUri, uri(FINK, 'isExternalEntry'), literal('true', `${XSD}boolean`));
  }

  const result = {};
  for (const [k, v] of Object.entries(graph)) {
    result[k] = { targets: [...v.targets], choices: v.choices, tags: v.tags, choiceDetails: v.choiceDetails };
  }
  return { graph: result, knotCount: knots.length, islands };
}

function resolveRef(ref, baseUrl, isRemote) {
  if (isRemote) {
    if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
    const base = new URL(baseUrl);
    return new URL(ref, base).href;
  } else {
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
  const fileUri = isRemote ? fileUrl : `file://${path.resolve(fileUrl)}`;

  const entry = { file: relPath, status: 'unknown', knots: 0, choices: 0, graph: {}, linkedFinks: [], islands: [] };
  results.summary.total++;

  // Add file to N-Quads
  nq(`<${fileUri}>`, `<${RDF}type>`, uri(FINK, 'FinkFile'));
  nq(`<${fileUri}>`, uri(FINK, 'crawledAt'), literal(timestamp, `${XSD}dateTime`));

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

  // Add FINK links to N-Quads
  for (const ref of entry.linkedFinks) {
    nq(`<${fileUri}>`, uri(FINK, 'linksTo'), literal(ref));
  }

  try {
    const compiler = new inkjs.Compiler(ink);
    const story = compiler.Compile();

    const { graph, knotCount, islands } = exploreStory(story, ink, fileUri);
    entry.graph = graph;
    entry.knots = knotCount;
    entry.choices = Object.values(graph).reduce((sum, k) => sum + k.choices, 0);
    entry.islands = islands;
    entry.status = 'OK';
    results.summary.compiled++;

    nq(`<${fileUri}>`, uri(FINK, 'knotCount'), literal(knotCount, `${XSD}integer`));
    nq(`<${fileUri}>`, uri(FINK, 'status'), literal('OK'));

    console.log('✅ ' + path.basename(relPath) + ' (' + entry.knots + ' knots' +
      (islands.length ? ', ' + islands.length + ' islands' : '') + ')');
  } catch (err) {
    entry.status = 'COMPILE_ERROR';
    entry.error = err.message.split('\n')[0];
    results.summary.failed++;
    nq(`<${fileUri}>`, uri(FINK, 'status'), literal('COMPILE_ERROR'));
    nq(`<${fileUri}>`, uri(FINK, 'error'), literal(entry.error));
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

  // Add crawl metadata to N-Quads
  nq(`<${graphUri}>`, `<${RDF}type>`, uri(FINK, 'CrawlReport'));
  nq(`<${graphUri}>`, uri(FINK, 'timestamp'), literal(timestamp, `${XSD}dateTime`));
  nq(`<${graphUri}>`, uri(FINK, 'source'), literal(results.source));
  nq(`<${graphUri}>`, uri(FINK, 'startFile'), literal(startFile));

  console.log('🔍 FINK Crawl (' + results.source + ')\n');
  console.log('Starting from: ' + startFile + '\n');

  await crawl(startFile, isRemote);

  console.log('\n=== SUMMARY: ' + results.summary.compiled + '/' + results.summary.total + ' OK ===\n');

  // Add summary to N-Quads
  nq(`<${graphUri}>`, uri(FINK, 'totalFiles'), literal(results.summary.total, `${XSD}integer`));
  nq(`<${graphUri}>`, uri(FINK, 'compiledFiles'), literal(results.summary.compiled, `${XSD}integer`));
  nq(`<${graphUri}>`, uri(FINK, 'failedFiles'), literal(results.summary.failed, `${XSD}integer`));

  // Save reports
  fs.mkdirSync('./docs', { recursive: true });
  fs.mkdirSync('./data/kgx', { recursive: true });

  fs.writeFileSync('./docs/fink-crawl-report.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('./data/kgx/finkg.nq', nquads.join('\n'));
  console.log('📄 N-Quads saved to data/kgx/finkg.nq (' + nquads.length + ' triples)');

  // Generate markdown
  let md = '# FINK Crawl Report\n\n';
  md += 'Generated: ' + results.timestamp + '\n\n';
  md += '**Source:** ' + results.source + '\n';
  md += '**Start:** `' + results.startFile + '`\n';
  md += '**Graph URI:** `' + graphUri + '`\n\n';

  md += '## Summary\n\n';
  md += '| Total | OK | Failed | N-Quads |\n|-------|----|---------|---------|\n';
  md += '| ' + results.summary.total + ' | ' + results.summary.compiled + ' | ' + results.summary.failed + ' | ' + nquads.length + ' |\n\n';

  md += '## Related Documentation\n\n';
  md += '- [Hampstead Story Graph Analysis](./hampstead-story-graph-analysis.md)\n';
  md += '- [3D Map Ideas](./3dmap-idea.md)\n';
  md += '- [Episode Ring Visualization](./fink-ring-viz.html)\n\n';

  for (const f of results.files) {
    const basename = path.basename(f.file);
    md += '## ' + basename + '\n\n';
    md += '**Knots:** ' + f.knots + ' | **Choices:** ' + f.choices;
    if (f.islands && f.islands.length) md += ' | **Islands:** ' + f.islands.length;
    md += '\n\n';

    if (f.islands && f.islands.length) {
      md += '### Islands (External Entry Points)\n\n';
      for (const island of f.islands) md += '- `' + island + '`\n';
      md += '\n';
    }

    if (Object.keys(f.graph).length) {
      md += '### Knot Connectivity\n\n```\n';
      for (const [knot, data] of Object.entries(f.graph)) {
        if (data.targets.length) {
          const repeatMarker = data.choiceDetails?.some(c => !c.repeatable) ? ' [has sticky]' : '';
          md += knot + ' -> ' + data.targets.join(', ') + repeatMarker + '\n';
        }
      }
      md += '```\n\n';
    }
  }

  fs.writeFileSync('./docs/fink-crawl-report.md', md);
  console.log('📄 Reports saved to docs/');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
