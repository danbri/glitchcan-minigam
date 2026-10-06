// Re-test the known @factoidal/core faults and behaviours this project works around. Prints each one as STILL or
// FIXED, so after a Factoidal upgrade you know which workarounds can go. No network, no files written.
//   node magpie/cwplans/tools/check-factoidal.mjs
// Skill: cwplans-web-harvest, "Factoidal notes"; issue text: skills/cwplans-web-harvest/factoidal-issue-2026-10-06.md.
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, query, serialize, Dataset, dataFactory as F } from '@factoidal/core';
import { TOOLS } from './lib.mjs';

const pkg = JSON.parse(readFileSync(join(TOOLS, '..', '..', '..', 'node_modules', '@factoidal', 'core', 'package.json'), 'utf8'));
console.log('@factoidal/core', pkg.version);
const lines = s => s.trim().split('\n').filter(Boolean).length;
const ds = await parse('<http://ex/a> <http://ex/p> "x" .\n', { format: 'nquads' });
const c = await query(ds, 'CONSTRUCT { ?s <http://ex/q> ?n . ?s <http://ex/r> "plain" } WHERE { ?s <http://ex/p> ?o BIND(BNODE() AS ?n) }');
const qs = c.toArray(), bn = qs.find(q => q.object.termType === 'BlankNode')?.object;
const checks = [];
checks.push(['BNODE() label is not a valid N-Quads label (has a colon)', /:/.test(bn?.value || '')]);
checks.push(['serialize() drops quads with a BNODE() blank node', lines(await serialize(new Dataset(qs), { format: 'nquads' })) < qs.length]);
let reparsed = null; try { reparsed = (await parse(c.toNQuads(), { format: 'nquads' })).toArray().length; } catch { reparsed = -1; }
checks.push(['parse() of toNQuads() output drops lines without an error', reparsed !== qs.length]);
const sel = await query(ds, 'SELECT ?n WHERE { ?s <http://ex/p> ?o BIND(BNODE() AS ?n) }');
checks.push(['a SELECT BNODE() term value starts with "_:"', String(sel[0]?.get('n')?.value).startsWith('_:')]);
// behaviour, not a fault: the data's own blank nodes get a new name in each query result
const d2 = new Dataset([F.quad(F.namedNode('http://ex/a'), F.namedNode('http://ex/h'), F.blankNode('b1'), F.defaultGraph()), F.quad(F.blankNode('b1'), F.namedNode('http://ex/v'), F.literal('1'), F.defaultGraph())]);
const r1 = (await query(d2, 'CONSTRUCT { ?a <http://ex/h> ?b } WHERE { ?a <http://ex/h> ?b }')).toArray()[0]?.object.value;
const r2 = (await query(d2, 'CONSTRUCT { ?b <http://ex/v> ?v } WHERE { ?b <http://ex/v> ?v }')).toArray()[0]?.subject.value;
checks.push(['blank nodes from the data are renamed per query (two CONSTRUCT outputs do not share nodes; skolemize first)', r1 !== r2]);
checks.push(['a query without GRAPH matches only the default graph', (await query(await parse('<http://ex/a> <http://ex/p> "x" <http://ex/g> .\n', { format: 'nquads' }), 'SELECT * WHERE { ?s ?p ?o }')).length === 0]);
for (const [what, still] of checks) console.log(still ? 'STILL ' : 'FIXED ', what);
