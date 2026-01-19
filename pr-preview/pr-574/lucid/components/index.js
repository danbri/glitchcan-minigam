/**
 * Lucid Web Components Index
 *
 * Import this file to register all Lucid web components.
 *
 * Usage:
 *   import './lucid/components/index.js';
 *
 * Or import specific components:
 *   import { LucidRenderer } from './lucid/components/lucid-renderer.js';
 */

export { LucidRenderer } from './lucid-renderer.js';
export { LucidScenePicker } from './lucid-scene-picker.js';
export { LucidComparison } from './lucid-comparison.js';

/**
 * Component tag names for reference
 */
export const COMPONENTS = {
  RENDERER: 'lucid-renderer',
  SCENE_PICKER: 'lucid-scene-picker',
  COMPARISON: 'lucid-comparison',
};

/**
 * Check if all components are registered
 */
export function areComponentsReady() {
  return Object.values(COMPONENTS).every(tag => customElements.get(tag));
}

/**
 * Wait for all components to be defined
 */
export async function waitForComponents() {
  await Promise.all(
    Object.values(COMPONENTS).map(tag => customElements.whenDefined(tag))
  );
}
