/**
 * Default scene DSL and initialization
 */

import { appContext, log } from './app-context.js';
import { parseDslToSceneGraph } from './dsl-parser.js';

export const DEFAULT_DSL = [
  "# Default DSL: animated blob with wobble",
  "",
  "s0 = sphere(",
  "      r = 1.0 + 0.3*sin(time),",
  "      color = [0.4 + 0.4*sin(time), 0.6, 1.0],",
  "      offset = [0.0, 0.3*sin(time*0.7), 0.0]",
  ")",
  "",
  "out = s0"
].join("\n");

export function initDefaultSceneGraph() {
  const parsed = parseDslToSceneGraph(DEFAULT_DSL);
  if (parsed.errors.length) {
    log("Default DSL parse errors: " + parsed.errors.join("; "), "error");
    appContext.sceneGraph = [];
  } else {
    appContext.sceneGraph = parsed.nodes;
    log("Default DSL sceneGraph initialized with " +
        parsed.nodes.length + " node(s)", "success");
  }
}
