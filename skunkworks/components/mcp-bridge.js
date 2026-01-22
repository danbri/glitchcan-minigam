/**
 * MCP Bridge - AI Tool Bus
 *
 * Mediates tool calls from sandboxed apps to AI backends.
 * Implements capability-based security: apps request capabilities,
 * bridge grants/denies based on policy.
 *
 * AI-first means AI is a participant, not a feature.
 */

class MCPBridge extends EventTarget {
  constructor() {
    super();

    // Registered tool providers (MCP servers, local functions)
    this._providers = new Map();

    // Capability grants per app
    this._grants = new Map();

    // Request queue for rate limiting
    this._queue = [];
    this._processing = false;

    // Default tools always available
    this._registerDefaultTools();
  }

  _registerDefaultTools() {
    // Echo tool for testing
    this.registerTool('echo', {
      description: 'Echo back the input',
      params: { message: 'string' },
      handler: async ({ message }) => ({ echo: message })
    });

    // Time tool
    this.registerTool('time', {
      description: 'Get current time',
      params: {},
      handler: async () => ({ iso: new Date().toISOString(), unix: Date.now() })
    });

    // Random tool
    this.registerTool('random', {
      description: 'Generate random number',
      params: { min: 'number', max: 'number' },
      handler: async ({ min = 0, max = 1 }) => ({
        value: Math.random() * (max - min) + min
      })
    });
  }

  /**
   * Register a tool provider
   */
  registerTool(name, config) {
    this._providers.set(name, {
      name,
      description: config.description || '',
      params: config.params || {},
      handler: config.handler,
      requiresCapability: config.requiresCapability || `tool:${name}`
    });

    this.dispatchEvent(new CustomEvent('tool-registered', {
      detail: { name, description: config.description }
    }));
  }

  /**
   * Register an MCP server connection
   */
  async registerMCPServer(serverUrl, options = {}) {
    // In real impl, this would connect to MCP server via stdio or HTTP
    // For now, mock the connection
    console.log(`[MCP] Would connect to server: ${serverUrl}`);

    // Mock: register tools that server would provide
    if (options.mockTools) {
      for (const tool of options.mockTools) {
        this.registerTool(tool.name, {
          description: tool.description,
          params: tool.params,
          handler: async (params) => {
            // Would call server here
            return { mock: true, tool: tool.name, params };
          },
          requiresCapability: `mcp:${tool.name}`
        });
      }
    }

    return { connected: true, serverUrl };
  }

  /**
   * Grant capability to an app
   */
  grantCapability(appId, capability, options = {}) {
    if (!this._grants.has(appId)) {
      this._grants.set(appId, new Map());
    }

    const grant = {
      capability,
      grantedAt: Date.now(),
      expiresAt: options.expiresAt || null,
      constraints: options.constraints || {},
      audit: options.audit !== false
    };

    this._grants.get(appId).set(capability, grant);

    this.dispatchEvent(new CustomEvent('capability-granted', {
      detail: { appId, capability, grant }
    }));

    return grant;
  }

  /**
   * Revoke capability from an app
   */
  revokeCapability(appId, capability) {
    const appGrants = this._grants.get(appId);
    if (appGrants) {
      appGrants.delete(capability);
    }

    this.dispatchEvent(new CustomEvent('capability-revoked', {
      detail: { appId, capability }
    }));
  }

  /**
   * Check if app has capability
   */
  hasCapability(appId, capability) {
    const appGrants = this._grants.get(appId);
    if (!appGrants) return false;

    const grant = appGrants.get(capability);
    if (!grant) return false;

    // Check expiration
    if (grant.expiresAt && Date.now() > grant.expiresAt) {
      appGrants.delete(capability);
      return false;
    }

    return true;
  }

  /**
   * Call a tool (main entry point for apps)
   */
  async callTool(appId, toolName, params = {}) {
    const tool = this._providers.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        code: 'UNKNOWN_TOOL'
      };
    }

    // Check capability
    if (!this.hasCapability(appId, tool.requiresCapability)) {
      this.dispatchEvent(new CustomEvent('capability-denied', {
        detail: { appId, toolName, required: tool.requiresCapability }
      }));

      return {
        success: false,
        error: `Missing capability: ${tool.requiresCapability}`,
        code: 'CAPABILITY_DENIED'
      };
    }

    // Queue and process
    return new Promise((resolve) => {
      this._queue.push({
        appId,
        toolName,
        params,
        resolve,
        queuedAt: Date.now()
      });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const request = this._queue.shift();
      const tool = this._providers.get(request.toolName);

      const startTime = Date.now();

      try {
        const result = await tool.handler(request.params);

        const response = {
          success: true,
          result,
          timing: {
            queued: request.queuedAt,
            started: startTime,
            completed: Date.now()
          }
        };

        // Emit for activity stream / timeline
        this.dispatchEvent(new CustomEvent('tool-called', {
          detail: {
            appId: request.appId,
            toolName: request.toolName,
            params: request.params,
            result,
            timing: response.timing
          }
        }));

        request.resolve(response);

      } catch (err) {
        request.resolve({
          success: false,
          error: err.message,
          code: 'HANDLER_ERROR'
        });

        this.dispatchEvent(new CustomEvent('tool-error', {
          detail: {
            appId: request.appId,
            toolName: request.toolName,
            error: err.message
          }
        }));
      }
    }

    this._processing = false;
  }

  /**
   * List available tools (for app discovery)
   */
  listTools(appId) {
    const tools = [];

    for (const [name, tool] of this._providers) {
      const hasAccess = this.hasCapability(appId, tool.requiresCapability);

      tools.push({
        name,
        description: tool.description,
        params: tool.params,
        accessible: hasAccess,
        requiredCapability: tool.requiresCapability
      });
    }

    return tools;
  }

  /**
   * Request capability (app asks shell for access)
   */
  requestCapability(appId, capability, reason = '') {
    this.dispatchEvent(new CustomEvent('capability-requested', {
      detail: { appId, capability, reason }
    }));

    // In real impl, this would prompt user or check policy
    // For now, auto-grant basic tools
    const autoGrant = [
      'tool:echo',
      'tool:time',
      'tool:random'
    ];

    if (autoGrant.includes(capability)) {
      return this.grantCapability(appId, capability, {
        expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
      });
    }

    // Return pending status for capabilities that need approval
    return {
      status: 'pending',
      capability,
      message: 'Awaiting user approval'
    };
  }
}

// Singleton for shell
const mcpBridge = new MCPBridge();

export { MCPBridge, mcpBridge };
