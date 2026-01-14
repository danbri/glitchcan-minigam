/**
 * Scene Analyzer - Engine-agnostic utilities for analyzing Lucid SDF scenes
 *
 * Provides APIs to detect animation, analyze complexity, and categorize scenes
 * without depending on any specific rendering backend.
 */

/**
 * Check if a scene has explicit time-based animation.
 *
 * Recursively walks the scene JSON looking for references to the `time` variable
 * in expressions, params, transforms, or any nested structure.
 *
 * @param {Object} sceneJson - Raw scene JSON (not loaded/processed)
 * @returns {boolean} - true if scene uses time variable
 *
 * @example
 * import { hasTimeAnimation } from './scene-analyzer.js';
 * const json = JSON.parse(fs.readFileSync('scene.json'));
 * if (hasTimeAnimation(json)) {
 *   console.log('Scene is animated');
 * }
 */
export function hasTimeAnimation(sceneJson) {
  return findTimeReferences(sceneJson).length > 0;
}

/**
 * Find all references to the time variable in a scene.
 *
 * @param {Object} sceneJson - Raw scene JSON
 * @returns {string[]} - Array of JSON paths where time is referenced
 */
export function findTimeReferences(sceneJson) {
  const refs = [];
  walkJson(sceneJson, '', (value, path) => {
    if (isTimeReference(value)) {
      refs.push(path);
    }
  });
  return refs;
}

/**
 * Get scene metadata for filtering/categorization.
 *
 * @param {Object} sceneJson - Raw scene JSON
 * @returns {Object} - Scene metadata
 */
export function getSceneMetadata(sceneJson) {
  const timeRefs = findTimeReferences(sceneJson);
  const paramNames = sceneJson.params ? Object.keys(sceneJson.params) : [];

  return {
    title: sceneJson.title || 'Untitled',
    subtitle: sceneJson.subtitle || '',
    version: sceneJson.version || '1.0',

    // Animation detection
    isAnimated: timeRefs.length > 0,
    timeReferences: timeRefs,

    // Param info
    paramCount: paramNames.length,
    paramNames: paramNames,

    // Scene structure
    hasRoot: !!sceneJson.root,
    hasDefs: !!sceneJson.defs && Object.keys(sceneJson.defs).length > 0,
    hasCamera: !!sceneJson.camera,

    // Categories (from TOC if present, otherwise inferred)
    categories: sceneJson.categories || [],
  };
}

/**
 * Analyze a batch of scenes and return categorized results.
 *
 * @param {Object[]} scenes - Array of {path, json} objects
 * @returns {Object} - Categorized scenes: {animated: [], static: [], byCategory: {}}
 */
export function categorizeScenes(scenes) {
  const result = {
    animated: [],
    static: [],
    byCategory: {},
    all: []
  };

  for (const { path, json } of scenes) {
    const meta = getSceneMetadata(json);
    const entry = { path, ...meta };

    result.all.push(entry);

    if (meta.isAnimated) {
      result.animated.push(entry);
    } else {
      result.static.push(entry);
    }

    for (const cat of meta.categories) {
      if (!result.byCategory[cat]) {
        result.byCategory[cat] = [];
      }
      result.byCategory[cat].push(entry);
    }
  }

  return result;
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Check if a value is a reference to the time variable.
 */
function isTimeReference(value) {
  if (!value || typeof value !== 'object') return false;

  // Direct var reference: {"var": "time"}
  if (value.var === 'time') return true;

  // IR format: {"type": "var", "name": "time"}
  if (value.type === 'var' && value.name === 'time') return true;

  return false;
}

/**
 * Recursively walk JSON structure, calling visitor for each value.
 */
function walkJson(obj, path, visitor) {
  visitor(obj, path);

  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      walkJson(item, `${path}[${i}]`, visitor);
    });
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      walkJson(value, newPath, visitor);
    }
  }
}

// ============================================================
// CLI usage when run directly
// ============================================================

// Check if running as main module
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  import('fs').then(fs => {
    import('path').then(pathModule => {
      const args = process.argv.slice(2);

      if (args.length === 0) {
        console.log('Usage: node scene-analyzer.js <scene.json> [--verbose]');
        console.log('       node scene-analyzer.js --scan <directory>');
        process.exit(1);
      }

      if (args[0] === '--scan') {
        // Scan directory for scenes
        const dir = args[1] || 'lucid/scenes';
        const files = findJsonFiles(dir, fs.default, pathModule.default);

        const scenes = files.map(f => ({
          path: f,
          json: JSON.parse(fs.default.readFileSync(f, 'utf8'))
        }));

        const result = categorizeScenes(scenes);

        console.log(`\nScanned ${result.all.length} scenes:`);
        console.log(`  Static:   ${result.static.length}`);
        console.log(`  Animated: ${result.animated.length}`);

        if (args.includes('--verbose')) {
          console.log('\nAnimated scenes:');
          result.animated.forEach(s => console.log(`  ${s.path}: ${s.timeReferences.length} time refs`));
        }
      } else {
        // Analyze single scene
        const scenePath = args[0];
        const json = JSON.parse(fs.default.readFileSync(scenePath, 'utf8'));
        const meta = getSceneMetadata(json);

        console.log(`Scene: ${meta.title}`);
        console.log(`Animated: ${meta.isAnimated}`);

        if (meta.isAnimated && args.includes('--verbose')) {
          console.log('Time references:');
          meta.timeReferences.forEach(r => console.log(`  ${r}`));
        }

        console.log(`Params: ${meta.paramNames.join(', ') || '(none)'}`);
      }
    });
  });
}

function findJsonFiles(dir, fs, path) {
  const results = [];

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json') && !entry.name.includes('toc')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}
