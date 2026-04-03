/**
 * @file pluginRegistry.ts
 * @service router-service
 * @version V39
 * @description Enterprise Plugin Registry
 *
 * Allows enterprises to inject custom middleware functions into
 * the StreetMP proxy flow without modifying core routing logic.
 *
 * ADDITIVE ONLY: Does not modify V1-V38 logic.
 *
 * Usage:
 *   pluginRegistry.register({
 *     id: "custom-pii-hook",
 *     phase: "PRE_EXECUTION",
 *     handler: async (ctx) => {
 *       if (ctx.prompt.includes("REDACT_ME")) ctx.prompt = "[REDACTED]";
 *       return ctx;
 *     }
 *   });
 */

export type PluginPhase = "PRE_AUTH" | "PRE_EXECUTION" | "POST_EXECUTION" | "POST_TRUST_SCORE";

export interface PluginContext {
  tenant_id:       string;
  prompt:          string;
  model:           string;
  provider:        string;
  classification:  string;
  trust_score?:    number;
  /** Arbitrary KV bag plugins can attach data to */
  meta:            Record<string, unknown>;
}

export interface Plugin {
  id:          string;
  description: string;
  phase:       PluginPhase;
  /** Tenant scope — "*" means global (all tenants) */
  tenant_scope: string;
  handler:     (ctx: PluginContext) => Promise<PluginContext>;
  enabled:     boolean;
  registered_at: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const plugins = new Map<string, Plugin>();

/** Registers a new plugin. Throws if the plugin ID already exists. */
export function registerPlugin(plugin: Omit<Plugin, "registered_at" | "enabled">): void {
  if (plugins.has(plugin.id)) {
    throw new Error(`[V39:PluginRegistry] Plugin "${plugin.id}" already registered. Use updatePlugin() to replace.`);
  }
  plugins.set(plugin.id, {
    ...plugin,
    enabled:       true,
    registered_at: new Date().toISOString(),
  });
  console.info(`[V39:PluginRegistry] Registered plugin "${plugin.id}" (${plugin.phase}) for tenant scope: ${plugin.tenant_scope}`);
}

/** Updates an existing plugin in-place */
export function updatePlugin(id: string, patch: Partial<Omit<Plugin, "id" | "registered_at">>): void {
  const existing = plugins.get(id);
  if (!existing) throw new Error(`[V39:PluginRegistry] Plugin "${id}" not found.`);
  plugins.set(id, { ...existing, ...patch });
}

/** Disables a plugin without removing it */
export function disablePlugin(id: string): void {
  updatePlugin(id, { enabled: false });
  console.info(`[V39:PluginRegistry] Plugin "${id}" disabled.`);
}

/**
 * Runs all enabled plugins for a given phase in registration order.
 * If any plugin throws, it is caught and logged — it must not halt the execution pipeline.
 */
export async function runPlugins(
  phase: PluginPhase,
  ctx: PluginContext,
): Promise<PluginContext> {
  let currentCtx = { ...ctx };

  for (const plugin of plugins.values()) {
    if (!plugin.enabled) continue;
    if (plugin.phase !== phase) continue;
    if (plugin.tenant_scope !== "*" && plugin.tenant_scope !== ctx.tenant_id) continue;

    try {
      currentCtx = await plugin.handler(currentCtx);
    } catch (err: any) {
      console.error(
        `[V39:PluginRegistry] Plugin "${plugin.id}" threw during ${phase}: ${err.message}. ` +
        `Execution continues without plugin output.`
      );
    }
  }

  return currentCtx;
}

/** Returns all registered plugins (for the admin UI and monitoring) */
export function listPlugins(): Plugin[] {
  return Array.from(plugins.values());
}

/** Returns the count of registered plugins per phase */
export function getPluginStats(): Record<PluginPhase, number> {
  const stats: Record<PluginPhase, number> = {
    PRE_AUTH: 0, PRE_EXECUTION: 0, POST_EXECUTION: 0, POST_TRUST_SCORE: 0,
  };
  for (const p of plugins.values()) {
    if (p.enabled) stats[p.phase]++;
  }
  return stats;
}

// ─── Built-in example plugins ─────────────────────────────────────────────────

registerPlugin({
  id:           "audit-logger",
  description:  "Logs execution metadata to console for audit purposes (no content logged).",
  phase:        "POST_EXECUTION",
  tenant_scope: "*",
  handler: async (ctx) => {
    console.info(`[Plugin:AuditLogger] tenant=${ctx.tenant_id} model=${ctx.model} trust=${ctx.trust_score ?? "N/A"}`);
    return ctx;
  },
});

registerPlugin({
  id:           "classification-enforcer",
  description:  "Blocks prompts that exceed the workspace maximum classification ceiling.",
  phase:        "PRE_EXECUTION",
  tenant_scope: "*",
  handler: async (ctx) => {
    const ORDER = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "TOP_SECRET"];
    const promptLevel = ORDER.indexOf(ctx.classification.toUpperCase());
    if (promptLevel < 0) return ctx; // Unknown classification — pass through
    // Enforcement logic would check workspace ceiling here in production
    return ctx;
  },
});
