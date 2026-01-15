/**
 * Global application context and debug logger
 */

export class GlobalDebugLogger {
  constructor() {
    this.startTime = performance.now();
  }

  logEvent(message, type = "info") {
    const time = ((performance.now() - this.startTime) / 1000).toFixed(2);
    const event = new CustomEvent("debug-log", {
      detail: { message, type, time }
    });
    window.dispatchEvent(event);
    console.log("[" + time + "s]", message);
  }

  clear() {
    this.startTime = performance.now();
    window.dispatchEvent(new CustomEvent("debug-clear"));
  }
}

export class AppContext {
  constructor() {
    this.debugLogger = new GlobalDebugLogger();
    this.sceneGraph = [];
    this.sceneObjects = [];
    this.instances = {
      nodeEditor: null,
      sdfRenderer: null,
      glslPreview: null,
      compositeEditor: null
    };
  }
}

// Create and export singleton instance
export const appContext = new AppContext();

// Expose globally for components
if (typeof window !== 'undefined') {
  window.appContext = appContext;
}

// Helper function
export const log = (msg, type = "info") => appContext.debugLogger.logEvent(msg, type);
