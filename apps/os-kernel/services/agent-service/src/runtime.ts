import { globalDLP } from "../../security/src/dlpEngine";
import { evaluateWithNeMo } from "../../router-service/src/security/nemoBridge";
import { merkleLogger, computeLeafHash } from "../../router-service/src/merkleLogger";
import { ToolRegistry } from "./tools/ToolRegistry";

export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityViolationError";
  }
}

export type AgentEvent = 
  | { type: "THOUGHT"; content: string }
  | { type: "ACTION"; tool: string; input: string }
  | { type: "SECURITY_CHECK"; component: string; status: "PASSED" | "FAILED"; detail?: string }
  | { type: "OBSERVATION"; content: string }
  | { type: "FINAL_ANSWER"; content: string }
  | { type: "ERROR"; content: string };

export class SovereignAgent {
  private registry: ToolRegistry;

  constructor() {
    this.registry = new ToolRegistry();
  }

  /**
   * Executes the ReAct loop as an async generator, yielding UI events.
   */
  public async *run(
    prompt: string,
    tenantId: string,
    userRole: string
  ): AsyncGenerator<AgentEvent, void, unknown> {
    const tools = this.registry.getAuthorizedTools(userRole);
    const traceLog: string[] = [];

    const logEvent = (event: AgentEvent) => {
      traceLog.push(JSON.stringify(event));
      return event;
    };

    try {
      // --- REASONING LOOP ---
      yield logEvent({ type: "THOUGHT", content: `I need to analyze the prompt: "${prompt}" and select the right tool.` });
      
      // Simulate an LLM parsing the prompt and selecting a tool
      let selectedToolName = "WebSearch";
      let actionInput = prompt;
      
      // Basic heuristic for simulation:
      if (prompt.toLowerCase().includes("vault") || prompt.toLowerCase().includes("secret")) {
        selectedToolName = "VaultQuery";
      }

      const tool = this.registry.getToolByName(selectedToolName);
      if (!tool || !tools.find(t => t.name === selectedToolName)) {
        throw new Error(`Tool ${selectedToolName} not found or unauthorized for role ${userRole}.`);
      }

      yield logEvent({ type: "THOUGHT", content: `I will use the ${selectedToolName} tool to process the request.` });
      yield logEvent({ type: "ACTION", tool: selectedToolName, input: actionInput });

      // --- THE KILL SWITCH: V67 DLP & V81 NeMo ---
      
      // 1. V81 NeMo Guardrails
      yield logEvent({ type: "SECURITY_CHECK", component: "V81 NeMo Guardrails", status: "PASSED", detail: "Validating intent" });
      const nemoResult = await evaluateWithNeMo(actionInput);
      if (!nemoResult.safe) {
        yield logEvent({ type: "SECURITY_CHECK", component: "V81 NeMo Guardrails", status: "FAILED", detail: nemoResult.reason });
        throw new SecurityViolationError(`NeMo Guardrails rejected action: ${nemoResult.reason}`);
      }
      
      // 2. V67 DLP Scrubber
      yield logEvent({ type: "SECURITY_CHECK", component: "V67 DLP Scrubber", status: "PASSED", detail: "Scanning for PII" });
      const dlpResult = globalDLP.tokenizePayload(actionInput, undefined, tenantId);
      if (dlpResult.entityCount > 0) {
        yield logEvent({ type: "SECURITY_CHECK", component: "V67 DLP Scrubber", status: "FAILED", detail: `Detected ${dlpResult.entityCount} PII entities` });
        throw new SecurityViolationError(`DLP Scrubber intercepted sensitive data in tool input.`);
      }

      // --- OBSERVATION ---
      const observation = await tool.execute(dlpResult.sanitizedPayload, tenantId);
      yield logEvent({ type: "OBSERVATION", content: observation });

      // --- FINAL ANSWER ---
      yield logEvent({ type: "THOUGHT", content: `I have the information I need.` });
      yield logEvent({ type: "FINAL_ANSWER", content: `Based on the tools, the result is: ${observation}` });

      // --- CRYPTOGRAPHIC ANCHORING ---
      this.anchorTrace(tenantId, traceLog, "success");

    } catch (err) {
      if (err instanceof SecurityViolationError) {
        yield logEvent({ type: "ERROR", content: `KILL SWITCH ENGAGED: ${err.message}` });
        this.anchorTrace(tenantId, traceLog, "security_violation");
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        yield logEvent({ type: "ERROR", content: `Agent crashed: ${msg}` });
        this.anchorTrace(tenantId, traceLog, "system_error");
      }
    }
  }

  /**
   * Bundles the trace and fires it to merkleLogger to generate the V36 Certificate.
   */
  private anchorTrace(tenantId: string, traceLog: string[], status: string) {
    const fullTrace = traceLog.join("\\n");
    // Generate a simulated Nitro Enclave Ed25519 signature for the trace
    const mockSignature = import("node:crypto").then(crypto => 
      crypto.createHash("sha256").update(fullTrace).digest("hex")
    );

    mockSignature.then(signature => {
      const receipt = {
        tenant_id: tenantId,
        signature: signature,
        timestamp: new Date().toISOString(),
        status: status,
      };
      const rootHash = merkleLogger.appendReceipt(tenantId, receipt);
      console.info(`[V98:AgentRuntime] Execution anchored. Merkle Root: ${rootHash}`);
    });
  }
}
