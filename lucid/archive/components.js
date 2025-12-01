/**
 * Lucid SDF Web Components - Export Registry
 *
 * This module provides access to the web components defined in index.html
 * without duplicating code. Use this for documentation, testing, or
 * programmatic component access.
 *
 * Usage:
 *   import { getComponent, isComponentRegistered } from './lucid/components.js';
 *   import { appContext, parseDslToSceneGraph } from './lucid/core/index.js';
 *
 *   const DebugConsole = getComponent('debug-console-app');
 *   const renderer = document.createElement('sdf-renderer-app');
 */

// Re-export core utilities for convenience
export * from './core/index.js';

/**
 * Get a registered custom element constructor
 * @param {string} tagName - Component tag name (e.g., 'debug-console-app')
 * @returns {CustomElementConstructor | undefined}
 */
export function getComponent(tagName) {
  return customElements.get(tagName);
}

/**
 * Check if a component is registered
 * @param {string} tagName - Component tag name
 * @returns {boolean}
 */
export function isComponentRegistered(tagName) {
  return customElements.get(tagName) !== undefined;
}

/**
 * Wait for a component to be registered
 * @param {string} tagName - Component tag name
 * @returns {Promise<CustomElementConstructor>}
 */
export function whenComponentDefined(tagName) {
  return customElements.whenDefined(tagName);
}

/**
 * Get global application context (if index.html is loaded)
 * @returns {Object | undefined}
 */
export function getAppContext() {
  return window.appContext;
}

/**
 * Available component tag names
 */
export const COMPONENTS = {
  DEBUG_CONSOLE: 'debug-console-app',
  NODE_EDITOR: 'node-editor-app',
  GLSL_PREVIEW: 'glsl-preview-app',
  COMPOSITE_EDITOR: 'composite-editor-app',
  SDF_RENDERER: 'sdf-renderer-app',
  RAYMARCHER: 'raymarcher-app',
};

/**
 * Check if all Lucid components are registered
 * @returns {boolean}
 */
export function areAllComponentsReady() {
  return Object.values(COMPONENTS).every(isComponentRegistered);
}

/**
 * Wait for all Lucid components to be registered
 * @returns {Promise<void>}
 */
export async function waitForComponents() {
  await Promise.all(
    Object.values(COMPONENTS).map(tag => customElements.whenDefined(tag))
  );
}

// Re-export for convenience
export { COMPONENTS as ComponentTags };

/**
 * Example usage:
 *
 * // In your HTML:
 * <script type="module">
 *   import { COMPONENTS, whenComponentDefined, getAppContext } from './lucid/components.js';
 *
 *   // Wait for renderer to be available
 *   await whenComponentDefined(COMPONENTS.SDF_RENDERER);
 *
 *   // Create renderer element
 *   const renderer = document.createElement(COMPONENTS.SDF_RENDERER);
 *   document.body.appendChild(renderer);
 *
 *   // Access global context
 *   const ctx = getAppContext();
 *   console.log(ctx.sceneGraph);
 * </script>
 *
 * // In tests:
 * import { test, expect } from 'vitest';
 * import { COMPONENTS, isComponentRegistered } from './lucid/components.js';
 *
 * test('components are registered', async () => {
 *   // Assuming index.html loaded components
 *   expect(isComponentRegistered(COMPONENTS.DEBUG_CONSOLE)).toBe(true);
 * });
 */
