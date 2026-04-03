/**
 * @file repair.ts
 * @package enforcer-service
 * @description Always-Valid Auto-Repair Loop (The Inevitability Layer)
 *
 * Guarantees 100% JSON validity using strict AJV validation.
 * If the primary LLM fails the schema, this triggers a high-speed (<300ms)
 * repair model to fix the syntax or missing keys without hallucinating.
 * Max 2 repair attempts.
 */

import Ajv from "ajv";
import axios from "axios";

const ROUTER_SERVICE_URL = process.env.ROUTER_SERVICE_URL || "http://router-service:4000";

const ajv = new Ajv({ allErrors: true });

export interface RepairResult {
  success: boolean;
  data: any;
  attempts_used: number;
  error?: "STRICT_VALIDATION_FAILED";
  charge: boolean;
}

export class AlwaysValidRepairEngine {
  
  /**
   * Validates a JSON string against a JSON Schema.
   * If invalid, automatically loops up to 2 times to repair it via a fast LLM.
   */
  public async guaranteeValidity(
    rawOutput: string,
    schema: Record<string, any>,
    traceId: string
  ): Promise<RepairResult> {
    
    const validate = ajv.compile(schema);
    let currentPayloadStr = rawOutput;
    let attempts = 0;
    const MAX_REPAIRS = 2;

    while (attempts <= MAX_REPAIRS) {
      try {
        // Step 1: Clean basic markdown wrappers
        currentPayloadStr = currentPayloadStr.replace(/```json/g, "").replace(/```/g, "").trim();
        
        // Step 2: Attempt standard parse
        const parsed = JSON.parse(currentPayloadStr);
        
        // Step 3: Strict AJV Validation
        const isValid = validate(parsed);
        
        if (isValid) {
          if (attempts > 0) {
            console.log(`[Enforcer:Repair] 🔧 Payload repaired successfully after ${attempts} attempts [Trace: ${traceId}]`);
          }
          return { success: true, data: parsed, attempts_used: attempts, charge: true };
        }
        
        // If we reach here, JSON parsed but failed AJV structural typing
        const errors = ajv.errorsText(validate.errors);
        console.warn(`[Enforcer:Repair] ⚠️ AJV Validation failed (Attempt ${attempts}): ${errors}`);
        
      } catch (parseErr) {
        console.warn(`[Enforcer:Repair] ⚠️ JSON Parse failed (Attempt ${attempts}): ${(parseErr as Error).message}`);
      }

      // If we hit the max repair limit, we fail deterministically
      if (attempts >= MAX_REPAIRS) {
        console.error(`[Enforcer:Repair] ❌ Max repair attempts (${MAX_REPAIRS}) exhausted. Failing request.`);
        return { 
          success: false, 
          data: null, 
          attempts_used: attempts, 
          error: "STRICT_VALIDATION_FAILED", 
          charge: false 
        };
      }

      // ---- REPAIR LOOP ----
      // Dispatch to a fast, low-cost model (e.g., GPT-4o-mini) to fix the JSON
      attempts++;
      console.log(`[Enforcer:Repair] 🩹 Triggering Structural Repair Model (Attempt ${attempts})...`);
      
      const repairPrompt = `[SYSTEM OVERRIDE: JSON STRUCTURAL REPAIR]
You are an uncompromising data serialization engine. The following payload failed JSON Schema validation.
Your ONLY job is to output perfectly valid JSON matching the schema. 
Do NOT alter the semantic meaning of the values. Do NOT hallucinate new fields. 
Return ONLY raw JSON, no markdown.

--- TARGET SCHEMA ---
${JSON.stringify(schema, null, 2)}

--- BROKEN PAYLOAD ---
${currentPayloadStr}
`;

      try {
        const fixResp = await axios.post<{ success: boolean; output: string }>(
          `${ROUTER_SERVICE_URL}/api/v1/execute`,
          { 
            user_id: "system-repair", 
            prompt: repairPrompt, 
            provider: "openai", 
            model: "gpt-4o-mini" // High speed, low cost
          },
          { timeout: 300 } // Aggressive 300ms timeout to enforce latency constraints
        );
        
        if (fixResp.data.success && fixResp.data.output) {
          currentPayloadStr = fixResp.data.output;
        } else {
          throw new Error("Repair model returned empty.");
        }
      } catch (networkErr) {
        console.error(`[Enforcer:Repair] Repair model network failure: ${(networkErr as Error).message}`);
        // If the repair model times out or fails (e.g., >300ms), we immediately abort and don't charge the user
        break; 
      }
    }

    return { 
      success: false, 
      data: null, 
      attempts_used: attempts, 
      error: "STRICT_VALIDATION_FAILED", 
      charge: false 
    };
  }
}

export const repairEngine = new AlwaysValidRepairEngine();
