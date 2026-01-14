#!/usr/bin/env node
/**
 * Update toc.json with animation metadata from scene-analyzer
 *
 * Usage: node lucid/scripts/update-toc-animation.mjs
 *
 * This adds `isAnimated: true/false` to each scene entry in toc.json
 * based on whether the scene uses time-based animation.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hasTimeAnimation } from '../core/scene-analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesDir = join(__dirname, '../scenes');
const tocPath = join(scenesDir, 'toc.json');

async function main() {
  console.log('Loading toc.json...');
  const toc = JSON.parse(readFileSync(tocPath, 'utf8'));

  let updated = 0;
  let errors = 0;

  for (const category of toc.categories || []) {
    for (const scene of category.scenes || []) {
      const scenePath = join(scenesDir, scene.path);

      try {
        const sceneJson = JSON.parse(readFileSync(scenePath, 'utf8'));
        const animated = hasTimeAnimation(sceneJson);

        if (scene.isAnimated !== animated) {
          scene.isAnimated = animated;
          updated++;
        }
      } catch (err) {
        // Scene file might not exist or be invalid
        console.warn(`  Warning: Could not analyze ${scene.path}: ${err.message}`);
        errors++;
      }
    }
  }

  // Write updated TOC
  writeFileSync(tocPath, JSON.stringify(toc, null, 2) + '\n');

  console.log(`\nDone. Updated ${updated} scenes, ${errors} errors.`);

  // Print summary
  const allScenes = toc.categories.flatMap(c => c.scenes);
  const animatedCount = allScenes.filter(s => s.isAnimated).length;
  const staticCount = allScenes.filter(s => s.isAnimated === false).length;
  console.log(`  Animated: ${animatedCount}`);
  console.log(`  Static: ${staticCount}`);
}

main().catch(console.error);
