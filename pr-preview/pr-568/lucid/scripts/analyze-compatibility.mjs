#!/usr/bin/env node

/**
 * Analyze all Lucid scenes for stinkyfish WebGPU compatibility
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCENES_DIR = join(__dirname, '../scenes');

// Features implemented in wgsl-codegen.js
const IMPLEMENTED_PRIMITIVES = new Set([
  'sphere', 'box', 'torus', 'cylinder', 'capsule', 'ellipsoid',
  'cone', 'roundCone', 'plane'
]);

const IMPLEMENTED_CSG = new Set([
  'union', 'subtract', 'intersect',
  'smoothUnion', 'smoothIntersect', 'smoothSubtract'
]);

const IMPLEMENTED_MODIFIERS = new Set([
  'transform', 'group', 'material', 'ref',
  'mirror', 'radial', 'repeat', 'round', 'shell',
  'displace', 'customExpr'
]);

const PARTIAL_FEATURES = new Set([
  'select' // Has TODO in wgsl-codegen.js line 890-891
]);

const ALL_IMPLEMENTED = new Set([
  ...IMPLEMENTED_PRIMITIVES,
  ...IMPLEMENTED_CSG,
  ...IMPLEMENTED_MODIFIERS
]);

/**
 * Recursively find all JSON files
 */
function findJsonFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findJsonFiles(fullPath, files);
    } else if (entry.endsWith('.json') && entry !== 'toc.json') {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Recursively extract all node types from scene tree
 */
function extractNodeTypes(node, types = new Set()) {
  if (!node || typeof node !== 'object') return types;

  if (node.type) {
    types.add(node.type);
  }

  // Recurse into children
  if (node.child) extractNodeTypes(node.child, types);
  if (node.children) {
    for (const child of node.children) {
      extractNodeTypes(child, types);
    }
  }

  // Check defs
  if (node.defs) {
    for (const def of Object.values(node.defs)) {
      extractNodeTypes(def, types);
    }
  }

  // Check root
  if (node.root) extractNodeTypes(node.root, types);

  return types;
}

/**
 * Analyze a scene file
 */
function analyzeScene(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const scene = JSON.parse(content);
    const nodeTypes = extractNodeTypes(scene);

    const unimplemented = [];
    const partial = [];

    for (const type of nodeTypes) {
      if (PARTIAL_FEATURES.has(type)) {
        partial.push(type);
      } else if (!ALL_IMPLEMENTED.has(type)) {
        unimplemented.push(type);
      }
    }

    let status;
    if (unimplemented.length > 0) {
      status = 'broken';
    } else if (partial.length > 0) {
      status = 'partial';
    } else {
      status = 'working';
    }

    return {
      path: filePath.replace(SCENES_DIR + '/', ''),
      title: scene.title || 'Untitled',
      status,
      nodeTypes: Array.from(nodeTypes).sort(),
      unimplemented,
      partial,
      hasPhysics: !!scene.physics?.enabled
    };
  } catch (err) {
    return {
      path: filePath.replace(SCENES_DIR + '/', ''),
      status: 'error',
      error: err.message
    };
  }
}

/**
 * Main analysis
 */
function main() {
  console.log('Scanning scenes directory...\n');

  const sceneFiles = findJsonFiles(SCENES_DIR);
  const results = sceneFiles.map(analyzeScene);

  // Count by status
  const counts = {
    working: results.filter(r => r.status === 'working').length,
    partial: results.filter(r => r.status === 'partial').length,
    broken: results.filter(r => r.status === 'broken').length,
    error: results.filter(r => r.status === 'error').length
  };

  // Collect all unimplemented features
  const unimplementedFeatures = new Set();
  for (const result of results) {
    if (result.unimplemented) {
      result.unimplemented.forEach(f => unimplementedFeatures.add(f));
    }
  }

  // Output results
  console.log('='.repeat(80));
  console.log('LUCID SCENES - STINKYFISH WEBGPU COMPATIBILITY AUDIT');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total scenes: ${sceneFiles.length}`);
  console.log(`✅ Working:   ${counts.working} (${Math.round(counts.working/sceneFiles.length*100)}%)`);
  console.log(`⚠️  Partial:   ${counts.partial} (${Math.round(counts.partial/sceneFiles.length*100)}%)`);
  console.log(`❌ Broken:    ${counts.broken} (${Math.round(counts.broken/sceneFiles.length*100)}%)`);
  console.log(`🔥 Error:     ${counts.error} (${Math.round(counts.error/sceneFiles.length*100)}%)`);
  console.log();

  if (unimplementedFeatures.size > 0) {
    console.log('Unimplemented features found:');
    for (const feature of Array.from(unimplementedFeatures).sort()) {
      const sceneCount = results.filter(r => r.unimplemented?.includes(feature)).length;
      console.log(`  - ${feature} (blocks ${sceneCount} scenes)`);
    }
    console.log();
  }

  // Group by status
  console.log('='.repeat(80));
  console.log('WORKING SCENES (✅)');
  console.log('='.repeat(80));
  const working = results.filter(r => r.status === 'working').sort((a, b) => a.path.localeCompare(b.path));
  for (const scene of working) {
    console.log(`✅ ${scene.path}`);
    if (scene.hasPhysics) console.log(`   (has physics metadata - runtime only)`);
  }
  console.log();

  if (counts.partial > 0) {
    console.log('='.repeat(80));
    console.log('PARTIAL SCENES (⚠️ - uses select node with TODO)');
    console.log('='.repeat(80));
    const partial = results.filter(r => r.status === 'partial').sort((a, b) => a.path.localeCompare(b.path));
    for (const scene of partial) {
      console.log(`⚠️  ${scene.path}`);
      console.log(`   Partial features: ${scene.partial.join(', ')}`);
    }
    console.log();
  }

  if (counts.broken > 0) {
    console.log('='.repeat(80));
    console.log('BROKEN SCENES (❌ - missing features)');
    console.log('='.repeat(80));
    const broken = results.filter(r => r.status === 'broken').sort((a, b) => a.path.localeCompare(b.path));
    for (const scene of broken) {
      console.log(`❌ ${scene.path}`);
      console.log(`   Missing: ${scene.unimplemented.join(', ')}`);
    }
    console.log();
  }

  if (counts.error > 0) {
    console.log('='.repeat(80));
    console.log('PARSE ERRORS (🔥)');
    console.log('='.repeat(80));
    const errors = results.filter(r => r.status === 'error').sort((a, b) => a.path.localeCompare(b.path));
    for (const scene of errors) {
      console.log(`🔥 ${scene.path}`);
      console.log(`   Error: ${scene.error}`);
    }
    console.log();
  }

  // Export JSON for markdown report
  return {
    summary: counts,
    total: sceneFiles.length,
    unimplementedFeatures: Array.from(unimplementedFeatures).sort(),
    scenes: results
  };
}

const results = main();

// Export for potential markdown generation
export { results };
