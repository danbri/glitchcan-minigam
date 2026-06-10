#!/usr/bin/env node
// Compact Trees.csv (29 MB, 53,904 rows) into a small game payload:
// living trees inside the game bbox, with species table and crown dimensions.
//
//   node trees/tools/build-tree-data.mjs
//   → trees/data/trees-bristol.json (+ commit the .gz alongside)

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const BBOX = { eMin: 354000, eMax: 363000, nMin: 169000, nMax: 178000 }; // BNG, matches elevation grid

const csv = readFileSync(join(DIR, 'Trees.csv'), 'utf8');

// Minimal state-machine CSV parser (NOTES fields contain quoted commas/newlines)
function* rows(text) {
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') yield row;
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); yield row; }
}

const it = rows(csv);
const header = it.next().value.map(h => h.replace(/^﻿/, ''));
const col = name => header.indexOf(name);
const iX = col('X'), iY = col('Y'), iName = col('COMMON_NAME'),
      iCW = col('CROWN_WIDTH'), iCH = col('CROWN_HEIGHT'), iDead = col('DEAD_FLAG');

const speciesIdx = new Map();
const trees = [];
let skipped = 0;
for (const r of it) {
  const e = parseFloat(r[iX]), n = parseFloat(r[iY]);
  if (!isFinite(e) || !isFinite(n) || e < BBOX.eMin || e > BBOX.eMax || n < BBOX.nMin || n > BBOX.nMax) { skipped++; continue; }
  if ((r[iDead] || '').trim().toUpperCase() === 'Y') { skipped++; continue; }
  const name = (r[iName] || 'Tree').trim() || 'Tree';
  if (!speciesIdx.has(name)) speciesIdx.set(name, speciesIdx.size);
  const cw = Math.max(1, Math.min(30, parseFloat(r[iCW]) || 5));
  const ch = Math.max(2, Math.min(40, parseFloat(r[iCH]) || 8));
  trees.push([Math.round(e), Math.round(n), speciesIdx.get(name), Math.round(cw * 10) / 10, Math.round(ch * 10) / 10]);
}

mkdirSync(join(DIR, 'data'), { recursive: true });
const out = {
  source: 'Bristol City Council tree inventory (opendata.bristol.gov.uk), Trees.csv 12/2024',
  bbox: BBOX, crs: 'EPSG:27700 (British National Grid)',
  fields: ['easting', 'northing', 'speciesIndex', 'crownWidth_m', 'crownHeight_m'],
  species: [...speciesIdx.keys()],
  trees,
};
writeFileSync(join(DIR, 'data', 'trees-bristol.json'), JSON.stringify(out));
console.log(`wrote trees-bristol.json: ${trees.length} trees, ${speciesIdx.size} species (${skipped} outside bbox/dead)`);
