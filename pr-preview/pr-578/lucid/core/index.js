/**
 * Lucid SDF Core - Main exports
 *
 * This module re-exports all core functionality for easy importing:
 *
 * import { appContext, log, parseDslToSceneGraph, generateGlslFromSceneGraph }
 *   from './lucid/core/index.js';
 */

// Application context and logging
export {
  GlobalDebugLogger,
  AppContext,
  appContext,
  log
} from './app-context.js';

// DSL parser
export {
  normalizeDslText,
  splitArgs,
  parseDslToSceneGraph,
  shadowParseDsl
} from './dsl-parser.js';

// GLSL code generation
export {
  generateGlslFromSceneGraph
} from './glsl-codegen.js';

// Default scene
export {
  DEFAULT_DSL,
  initDefaultSceneGraph
} from './default-scene.js';
