/**
 * @file outputScrubber.ts
 * @service router-service
 * @version V73
 * @description COMMAND 073 - REVERSE DLP (OUTPUT LEAK GUARD)
 */

import { appendTraceEvent } from "../middleware/traceProvider.js";
import { resolveDlpRules } from "../tenantConfig.js";

// Hallucinated CC
const CC_PATTERN = /\b((?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g;
// Hallucinated SSN
const SSN_PATTERN = /\b(\d{3}-\d{2}-\d{4}|\d{9})\b/g;

// Pre-compiled competitor patterns for jpmc-global
const COMPETITOR_PATTERN = /Goldman\s*Sachs|Morgan\s*Stanley/gi;

export interface ScrubResult {
  scrubbedOutput: string;
  redactionCount: number;
}

export function scrubOutput(llmResponse: string, tenantId: string, traceId?: string, traceStartedAt?: number): ScrubResult {
  let scrubbedOutput = llmResponse;
  let redactionCount = 0;

  // 1. V67 Tenant Custom DLP Rules (Reverse)
  const tenantRules = resolveDlpRules(tenantId);
  for (const rule of tenantRules) {
    try {
      if (rule.pattern && rule.pattern.length <= 512) {
        const regex = new RegExp(rule.pattern, "gi");
        scrubbedOutput = scrubbedOutput.replace(regex, () => {
          redactionCount++;
          return rule.replacement;
        });
      }
    } catch (err) {
      // fail-open on invalid regex
    }
  }

  // 2. Hallucinated PII (CC and SSN)
  scrubbedOutput = scrubbedOutput.replace(CC_PATTERN, () => {
    redactionCount++;
    return "[REDACTED_CC]";
  });
  
  scrubbedOutput = scrubbedOutput.replace(SSN_PATTERN, () => {
    redactionCount++;
    return "[REDACTED_SSN]";
  });

  // 3. Competitor Block (jpmc-global)
  if (tenantId === "jpmc-global") {
    scrubbedOutput = scrubbedOutput.replace(COMPETITOR_PATTERN, () => {
      redactionCount++;
      return "[REDACTED_COMPETITOR]";
    });
  }

  // 4. V70 Trace Propagation
  if (redactionCount > 0 && traceId && traceStartedAt) {
    appendTraceEvent(traceId, traceStartedAt, "OUTPUT_LEAK_PREVENTED", {
      redactionCount,
      tenantId
    });
  }

  return { scrubbedOutput, redactionCount };
}
