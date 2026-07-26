import assert from 'node:assert';
import { extractBlocks, blocksOfType, inkOf } from '../src/lib/sigils.js';
import { extractFinkFromJsSource } from '../src/lib/finkExtract.js';
import { lintTagUrls } from '../src/lib/lint.js';
// 1. a polyglot file: ink + turtle + an ad-hoc JSON block, in order

export async function run() {

  const poly = [
    'oooOO`-> start`;',
    'OO("text/turtle")`@prefix foaf: <http://xmlns.com/foaf/0.1/> .`;',
    'OO("application/vnd.fink.playlist+json")`{"tracks":[]}`;',
    'oooOO`=== start ===\n' + 'Hello.\n' + '-> END`;',
  ].join('\n');
  const { blocks } = extractBlocks(poly);
  assert.equal(blocks.length, 4);
  assert.deepEqual(blocks.map(b => b.mediaType), [
    'text/x-ink', 'text/turtle', 'application/vnd.fink.playlist+json', 'text/x-ink']);
  assert.equal(blocks[1].raw.includes('foaf:'), true);
  assert.equal(blocksOfType(blocks, 'text/x-ink').length, 2);

  // 2. raw capture preserves tag-URL escaping (\\/ must survive)
  const escaped = 'oooOO`# FINK: https:\\\\/\\\\/example.com\\\\/x.fink.js`;';
  const eb = extractBlocks(escaped).blocks;
  assert.equal(eb[0].raw.includes('\\\\/'), true, 'backslash-escapes must survive raw capture');

  // 3. legacy facade identical semantics: unique ink blocks newline-joined
  const legacy = extractFinkFromJsSource(poly);
  assert.equal(legacy, '-> start\n=== start ===\nHello.\n-> END');
  assert.equal(inkOf(blocks), legacy);

  // 4. window-touching sources still yield their blocks
  const throwy = 'oooOO`-> a`; window.document.title = "boom";';
  assert.equal(extractFinkFromJsSource(throwy), '-> a');

  // 5. the // lint bites on unescaped, stays quiet on escaped and plain text
  const bad = 'Hello # FINK: https://example.com/x.fink.js';
  const good = 'Hello # FINK: https:\\/\\/example.com\\/x.fink.js';
  assert.equal(lintTagUrls(bad).length, 1);
  assert.equal(lintTagUrls(good).length, 0);
  assert.equal(lintTagUrls('no tags, no https here').length, 0);

  console.log('sigils.test.js ok');

}
