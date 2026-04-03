import { Role, RbacAction, isAuthorized } from "../security/rbacEngine.js";
import { appendTraceEvent } from "../middleware/traceProvider.js";

/**
 * Interface for all StreetMP Agentic Tools
 */
export interface StreetMPTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema format
  requiredPermission: RbacAction;
  /**
   * V78: Human-In-The-Loop gate.
   * If true, the worker MUST suspend execution and wait for admin
   * approval before this tool is executed. The job status transitions
   * to AWAITING_APPROVAL and the conversation state is serialized to Redis.
   */
  requiresApproval: boolean;
  execute: (args: Record<string, any>, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  tenantId: string;
  userId: string;
  role: Role | null;
  traceId?: string;
  traceStartedAt?: number;
}

// ----------------------------------------------------------------
// MOCK TOOLS
// ----------------------------------------------------------------

export const search_freelance_marketplace: StreetMPTool = {
  name: "search_freelance_marketplace",
  description: "Search the internal marketplace for freelancers with a specific skill.",
  parameters: {
    type: "object",
    properties: {
      skill: {
        type: "string",
        description: "The skill to search for, e.g., 'React', 'Rust', 'Penetration Testing'",
      },
    },
    required: ["skill"],
  },
  requiredPermission: "read:market",
  requiresApproval: false,
  execute: async (args: Record<string, any>, _ctx: ToolContext) => {
    const skill = args.skill || "unknown";
    return JSON.stringify({
      success: true,
      results: [
        { id: "freelancer_001", name: "Alice Security", skill: skill, rate: 150 },
        { id: "freelancer_002", name: "Bob WebDev", skill: skill, rate: 85 },
      ],
    });
  },
};

export const check_wallet_balance: StreetMPTool = {
  name: "check_wallet_balance",
  description: "Check the payment balance of a specific user wallet.",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "The ID of the user whose wallet balance is being checked.",
      },
    },
    required: ["userId"],
  },
  requiredPermission: "read/write:billing",
  requiresApproval: false,
  execute: async (args: Record<string, any>, _ctx: ToolContext) => {
    const id = args.userId;
    return JSON.stringify({
      success: true,
      balance: 14500.50,
      currency: "USD",
      userId: id,
    });
  },
};

/**
 * V78: HIGH-RISK TOOL — requiresApproval: true
 *
 * Deducting funds is an irreversible financial operation.
 * The HITL gate suspends the agent and requires an admin
 * to explicitly approve before this executes.
 */
export const deduct_wallet_funds: StreetMPTool = {
  name: "deduct_wallet_funds",
  description:
    "Deduct a specified amount from a user's wallet. " +
    "WARNING: This is an irreversible financial operation that requires admin approval.",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "The ID of the user whose wallet will be debited.",
      },
      amount: {
        type: "number",
        description: "The amount in USD to deduct from the wallet.",
      },
      reason: {
        type: "string",
        description: "Short human-readable reason for the deduction.",
      },
    },
    required: ["userId", "amount", "reason"],
  },
  requiredPermission: "read/write:billing",
  requiresApproval: true, // ← V78 HITL GATE
  execute: async (args: Record<string, any>, ctx: ToolContext) => {
    // Only executes after admin approval — never called directly by the loop
    const { userId, amount, reason } = args;
    console.info(
      `[V78:HITL] 💸 Deducting $${amount} from userId=${userId} ` +
      `reason="${reason}" tenant=${ctx.tenantId} — APPROVED by admin`
    );
    return JSON.stringify({
      success: true,
      transaction_id: `txn_${Date.now()}`,
      userId,
      deducted: amount,
      new_balance: 14500.50 - amount,
      currency: "USD",
      reason,
      approved_by: "HITL_ADMIN",
    });
  },
};
// ----------------------------------------------------------------
// V79 MEMORY TOOLS
// ----------------------------------------------------------------

export const core_save_memory: StreetMPTool = {
  name: "core_save_memory",
  description: "Save a fact into long-term memory for later recall across sessions.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "A short, descriptive key for this memory (e.g. 'freelancer_research_tuesday').",
      },
      summary: {
        type: "string",
        description: "The detailed fact or context to remember.",
      },
    },
    required: ["key", "summary"],
  },
  // Memory is considered safe for all authenticated users to manage their own scoped context
  requiredPermission: "execute:llm",
  requiresApproval: false,
  execute: async (args: Record<string, any>, ctx: ToolContext) => {
    // Dynamic import to prevent circular dependency
    const { saveMemory } = await import("./agentMemory.js");
    const { key, summary } = args;
    
    const success = await saveMemory(
      ctx.tenantId,
      ctx.userId,
      key,
      summary,
      { traceId: ctx.traceId || "", traceStartedAt: ctx.traceStartedAt || Date.now() }
    );
    
    return JSON.stringify({
      success,
      action: "Memory Saved",
      key,
    });
  },
};

export const core_recall_memory: StreetMPTool = {
  name: "core_recall_memory",
  description: "Retrieve past memories or facts for this user.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Optional specific memory key to look up. If omitted, returns all recent memories.",
      },
    },
  },
  requiredPermission: "execute:llm",
  requiresApproval: false,
  execute: async (args: Record<string, any>, ctx: ToolContext) => {
    const { retrieveMemories } = await import("./agentMemory.js");
    const { query } = args;
    
    const memories = await retrieveMemories(
      ctx.tenantId,
      ctx.userId,
      query,
      { traceId: ctx.traceId || "", traceStartedAt: ctx.traceStartedAt || Date.now() }
    );
    
    return JSON.stringify({
      success: true,
      action: "Memory Recalled",
      memories,
    });
  },
};

// Tool Registry Directory
export const ToolRegistry: Record<string, StreetMPTool> = {
  search_freelance_marketplace,
  check_wallet_balance,
  deduct_wallet_funds,
  core_save_memory,
  core_recall_memory,
};

// ----------------------------------------------------------------
// SECURE TOOL EXECUTION ENVELOPE
// ----------------------------------------------------------------

/**
 * Executes a tool ensuring the caller's role satisfies the tool's required permission.
 * Completely isolates the internal execution from hanging the proxy by wrapping in a Promise.
 */
export async function executeToolWithRbac(
  toolName: string,
  argsStr: string,
  ctx: ToolContext
): Promise<string> {
  const tool = ToolRegistry[toolName];
  if (!tool) {
    if (ctx.traceId) {
      appendTraceEvent(ctx.traceId, ctx.traceStartedAt ?? Date.now(), "TOOL_EXECUTION_DENIED", {
        toolName,
        reason: "Tool not found in registry.",
      });
    }
    return JSON.stringify({ error: `Tool ${toolName} not found.` });
  }

  // RBAC Evaluation Guard
  if (!isAuthorized(ctx.role, tool.requiredPermission)) {
    console.warn(`[V65:ToolRegistry] 🚫 DENY tool execution "${toolName}" — role="${ctx.role ?? "none"}" lacks action="${tool.requiredPermission}"`);
    
    if (ctx.traceId) {
      appendTraceEvent(ctx.traceId, ctx.traceStartedAt ?? Date.now(), "TOOL_EXECUTION_DENIED", {
        toolName,
        requiredAction: tool.requiredPermission,
        role: ctx.role ?? "none",
      });
    }

    return JSON.stringify({
      error: `Forbidden: your role (${ctx.role ?? "none"}) does not have the "${tool.requiredPermission}" permission required to run ${toolName}.`,
    });
  }

  // Try parsing args
  let parsedArgs: Record<string, any>;
  try {
    parsedArgs = JSON.parse(argsStr);
  } catch (err) {
    return JSON.stringify({ error: "Failed to parse tool arguments as valid JSON." });
  }

  const startMs = Date.now();
  console.info(`[ToolRegistry] ⚙️ EXECUTING "${toolName}" for tenant="${ctx.tenantId}" role="${ctx.role}"`);

  try {
    // Wrapping in a promise + timeout to prevent a slow backend script from hanging the event loop indefinitely
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("TOOL_TIMEOUT")), 10000)
    );

    const result = await Promise.race([
      tool.execute(parsedArgs, ctx),
      timeoutPromise
    ]);

    const latencyMs = Date.now() - startMs;

    // V70 Trace Propagation
    if (ctx.traceId) {
      appendTraceEvent(ctx.traceId, ctx.traceStartedAt ?? Date.now(), "TOOL_EXECUTED", {
        toolName,
        latencyMs,
        success: true,
      });
    }

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ToolRegistry] ❌ Error executing tool "${toolName}":`, errorMsg);
    
    const latencyMs = Date.now() - startMs;
    if (ctx.traceId) {
      appendTraceEvent(ctx.traceId, ctx.traceStartedAt ?? Date.now(), "TOOL_EXECUTED", {
        toolName,
        latencyMs,
        success: false,
        error: errorMsg,
      });
    }

    return JSON.stringify({
      error: `Tool execution failed: ${errorMsg}`
    });
  }
}
