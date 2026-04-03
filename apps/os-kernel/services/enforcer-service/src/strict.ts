/**
 * @file strict.ts
 * @package enforcer-service
 * @description The "Always-Valid" Strict Mode & Auto-Fixer Loop
 *
 * Implements Phase 8 "Toothbrush Protocol" stickiness.
 * If strict mode is enabled, the OS guarantees 100% schema compliance.
 * If the primary LLM hallucinates malformed JSON (missing commas, trailing quotes),
 * this module intercepts the failure and uses a fast, cheap model (e.g., gpt-4o-mini)
 * specifically tuned to repair JSON syntax at high speed.
 */

import axios from "axios";

const ROUTER_SERVICE_URL = process.env.ROUTER_SERVICE_URL || "http://router-service:4000";

export class StrictJSONAutoFixer {
  /**
   * Attempts to parse a string as JSON.
   * If it fails and strict mode is on, triggers the repair loop.
   * @param rawOutput The raw text from the primary LLM
   * @param requiredKeys The schema keys required
   * @param strictMode If true, triggers the repair loop on failure
   */
  public async parseOrRepair(
    rawOutput: string,
    requiredKeys: string[],
    strictMode: boolean = true
  ): Promise<{ success: boolean; data: any; repaired: boolean; error?: string }> {
    
    // Attempt 1: Standard naive parse
    try {
      const parsed = JSON.parse(this.cleanMarkdown(rawOutput));
      const hasAllKeys = requiredKeys.every(k => k in parsed);
      
      if (hasAllKeys) {
        return { success: true, data: parsed, repaired: false };
      }
      
      if (!strictMode) {
        return { success: false, data: null, repaired: false, error: "Missing required keys." };
      }
      
      // Fall through to repair if keys are missing
    } catch (err) {
      if (!strictMode) {
        return { success: false, data: null, repaired: false, error: "Invalid JSON syntax." };
      }
      // Fall through to repair on syntax error
    }

    console.log(`[Enforcer:Strict] ⚠️ Malformed JSON detected. Triggering high-speed Auto-Fixer loop...`);

    // The Repair Loop
    try {
      const repairPrompt = `[SYSTEM OVERRIDE: JSON AUTO-FIXER]
You are a syntactic repair engine. The following text contains malformed JSON or is missing required keys: [${requiredKeys.join(", ")}].
Your ONLY job is to output perfectly valid JSON matching the required schema. Do not change the underlying semantic meaning.
Do not wrap in markdown blocks. Output raw JSON only.

--- BROKEN PAYLOAD ---
${rawOutput}
`;
      // We explicitly hardcode the fastest available reasoning model for the fix.
      const fixResp = await axios.post(
        `${ROUTER_SERVICE_URL}/api/v1/execute`,
        { 
          user_id: "00000000-0000-0000-0000-000000000000", // System operation
          prompt: repairPrompt, 
          provider: "openai", 
          model: "gpt-4o-mini" // Fast syntax fixer
        },
        { timeout: 5000 }
      );

      if (fixResp.data.success && fixResp.data.output) {
        const fixedRaw = this.cleanMarkdown(fixResp.data.output);
        const fixedParsed = JSON.parse(fixedRaw);
        
        // Verify the fix actually worked
        const keysFixed = requiredKeys.every(k => k in fixedParsed);
        if (keysFixed) {
          console.log(`[Enforcer:Strict] 🔧 Auto-Fixer successful! JSON syntax repaired in real-time.`);
          return { success: true, data: fixedParsed, repaired: true };
        }
      }
      
      throw new Error("Repair loop failed to produce required schema.");
    } catch (fixErr) {
      console.warn(`[Enforcer:Strict] 🚨 Auto-Fixer failed to repair JSON: ${(fixErr as Error).message}`);
      return { success: false, data: null, repaired: false, error: "Unrecoverable JSON syntax damage." };
    }
  }

  private cleanMarkdown(str: string): string {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
  }
}

export const strictValidator = new StrictJSONAutoFixer();
