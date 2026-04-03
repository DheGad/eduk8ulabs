import { merkleLogger } from "../merkleLogger.js";
import { randomUUID } from "node:crypto";

export type StepType = "AI_PROMPT" | "DLP_SCAN" | "WEBHOOK";

export interface WorkflowStep {
  id: string;
  type: StepType;
  config: Record<string, any>;
}

export interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
  tenant_id: string;
}

export interface WorkflowExecutionResult {
  status: "completed" | "failed";
  executionId: string;
  steps: Array<{
    stepId: string;
    type: StepType;
    success: boolean;
    output?: any;
    error?: string;
  }>;
  merkleRootHash?: string;
  durationMs: number;
}

export class WorkflowRunner {
  public async runWorkflow(definition: WorkflowDefinition, traceId: string): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const executionId = randomUUID();
    const internalSecret = process.env.INTERNAL_ROUTER_SECRET || "";
    const results: WorkflowExecutionResult["steps"] = [];
    let currentInput: any = {};
    let status: "completed" | "failed" = "completed";

    for (const step of definition.steps) {
      let stepSuccess = true;
      let stepOutput: any;
      let stepError: string | undefined;

      try {
        switch (step.type) {
          case "AI_PROMPT":
            const aiRes = await fetch("http://localhost:4000/api/v1/execute", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${internalSecret}`,
                "X-Tenant-Id": definition.tenant_id,
                "X-Trace-Id": traceId
              },
              body: JSON.stringify({
                prompt: step.config.prompt,
                input: currentInput
              })
            });
            if (!aiRes.ok) throw new Error(`AI Step Failed: ${aiRes.status}`);
            stepOutput = await aiRes.json();
            break;

          case "DLP_SCAN":
            // Mocking for now, in prod this calls the V67 scrubber
            stepOutput = { ...currentInput, scrubbed: true };
            break;

          case "WEBHOOK":
            if (step.config.url) {
              const whRes = await fetch(step.config.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(currentInput)
              });
              stepOutput = { status: whRes.status };
            }
            break;
        }

        results.push({ stepId: step.id, type: step.type, success: true, output: stepOutput });
        currentInput = stepOutput;

        // Anchor to Merkle Ledger
        await merkleLogger.appendReceipt(definition.tenant_id, {
          signature: randomUUID(),
          timestamp: new Date().toISOString(),
          tenant_id: definition.tenant_id,
          status: "SUCCESS"
        });

      } catch (err: any) {
        stepSuccess = false;
        stepError = err.message;
        results.push({ stepId: step.id, type: step.type, success: false, error: stepError });
        status = "failed";

        await merkleLogger.appendReceipt(definition.tenant_id, {
          signature: randomUUID(),
          timestamp: new Date().toISOString(),
          tenant_id: definition.tenant_id,
          status: "FAILED"
        });
        break; // Stop execution on failure
      }
    }

    const lastRoot = merkleLogger.getDailyRootHash(definition.tenant_id);

    return {
      status,
      executionId,
      steps: results,
      merkleRootHash: lastRoot || undefined,
      durationMs: Date.now() - startTime
    };
  }
}
