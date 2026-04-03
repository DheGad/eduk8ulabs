import { globalDLP } from "../../security/src/dlpEngine";

export interface Plugin {
  id:          string;
  name:        string;
  description: string;
  version:     string;
  price:       number;
  author:      string;
  category:    string;
  execute:     (payload: string) => Promise<string>;
}

export class PluginRegistry {
  private availablePlugins: Map<string, Plugin> = new Map();
  // Maps tenantId to Set of installed plugin IDs
  private tenantWorkspace: Map<string, Set<string>> = new Map();

  constructor() {
    this.seedMockPlugins();
  }

  private seedMockPlugins() {
    this.registerPlugin({
      id: "plugin-legal-01",
      name: "Legal Contract Analyzer",
      description: "Detects liability exposure and compliance gaps in legal prose.",
      version: "1.0.0",
      price: 15.00,
      author: "LegalAI Corp",
      category: "Legal",
      execute: async (payload: string) => `[LegalAI] Analyzed contract block. Simulated finding: Clause 4.2 missing standard arbitration language. (Payload: ${payload})`,
    });

    this.registerPlugin({
      id: "plugin-health-02",
      name: "Healthcare PII Detector",
      description: "Deep scanner for HIPAA violations in clinical notes.",
      version: "2.1.0",
      price: 25.00,
      author: "HealthShield",
      category: "Healthcare",
      execute: async (payload: string) => `[HealthShield] Scan complete. Found 0 unmasked MRNs in block. (Payload: ${payload})`,
    });

    this.registerPlugin({
      id: "plugin-compliant-03",
      name: "Bahasa Malaysia Compliance",
      description: "Validates local language regulatory alignment for SEA operations.",
      version: "1.0.5",
      price: 10.00,
      author: "RegionalGov Solutions",
      category: "Compliance",
      execute: async (payload: string) => `[RegionalGov] Verified. Content aligns with BM compliance standards. (Payload: ${payload})`,
    });
  }

  public registerPlugin(plugin: Plugin): void {
    if (this.availablePlugins.has(plugin.id)) {
      throw new Error(`Plugin ID ${plugin.id} already exists in registry.`);
    }
    this.availablePlugins.set(plugin.id, plugin);
  }

  public getAvailablePlugins(): Plugin[] {
    return Array.from(this.availablePlugins.values());
  }

  /**
   * Installs and activates a plugin for a specific tenant workspace.
   */
  public installPlugin(pluginId: string, tenantId: string): void {
    if (!this.availablePlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} not found in marketplace.`);
    }

    if (!this.tenantWorkspace.has(tenantId)) {
      this.tenantWorkspace.set(tenantId, new Set());
    }

    const activePlugins = this.tenantWorkspace.get(tenantId)!;
    activePlugins.add(pluginId);

    console.info(`[V97:Registry] Plugin ${pluginId} successfully installed for tenant ${tenantId}.`);
  }

  /**
   * Returns all active plugins installed for a specified tenant workspace.
   */
  public getInstalledPlugins(tenantId: string): Plugin[] {
    const installedIds = this.tenantWorkspace.get(tenantId);
    if (!installedIds) return [];

    return Array.from(installedIds)
      .map(id => this.availablePlugins.get(id))
      .filter((p): p is Plugin => p !== undefined);
  }

  /**
   * Secure Sandbox Execution
   * Enforces that plugins NEVER receive raw/unmasked inputs.
   */
  public async executePlugin(pluginId: string, payload: string, tenantId: string): Promise<string> {
    const plugin = this.availablePlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not available.`);
    }

    const installed = this.tenantWorkspace.get(tenantId);
    if (!installed || !installed.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not installed for tenant ${tenantId}.`);
    }

    // [SECURITY ABSOLUTE]
    // The Sandbox Barrier: Scrubber processes input BEFORE passing to plugin.
    console.info(`[V97:Registry] Sandboxing execution for plugin ${pluginId}. Sanitizing input...`);
    const dlpResult = globalDLP.tokenizePayload(payload, undefined, tenantId);
    
    // Execute plugin with PII replaced by secure token flags only
    const result = await plugin.execute(dlpResult.sanitizedPayload);
    
    return result;
  }
}

export const globalPluginRegistry = new PluginRegistry();
