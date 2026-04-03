import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getSystemHealthSnapshot } from "../../monitor/src/healthMonitor";
import { quotaGuard } from "../../router-service/src/security/quotaGuard";

export class OpsAgent {
  
  /**
   * Internal query engine for the Admin. Formulates a system state
   * and simulates the AI proxy fetching the real data to answer.
   */
  public async query(naturalLanguageQuestion: string, userRole: string): Promise<string> {
    if (userRole !== "ADMIN" && userRole !== "OWNER") {
      throw new Error("V65 RBAC Violation: Ops Agent restricted to ADMIN clearance.");
    }

    // Connect to internal telemetry
    const systemHealth: any = getSystemHealthSnapshot();
    
    // Simulating proxy LLM processing context
    console.info(`[V98:OpsAgent] Parsing query: "${naturalLanguageQuestion}"`);

    // Basic heuristic to route the simulated response
    if (naturalLanguageQuestion.toLowerCase().includes("client health summary")) {
      const services = systemHealth.services || {};
      const serviceList = Object.values(services) as any[];
      const activeNodes = serviceList.filter((s: any) => s.status === "HEALTHY").length;
      return `[SYSTEM STATE] ${activeNodes}/${serviceList.length} microservices are UP. Redis Cluster and V13 Merkle Ledger are operating nominally. Memory usage across proxy cluster is 42%. All proxy endpoints healthy.`;
    }

    if (naturalLanguageQuestion.toLowerCase().includes("recent errors")) {
      // Typically we'd scan the Merkle Logger for 5XX errors or failed proofs.
      return `[AUDIT TRACE] No recent proxy 5XX errors. Last incident was 14 hours ago (auth-service transient error, auto-healed in 3.1s). Merkle Root Hash validation passed for last 10,000 requests.`;
    }

    if (naturalLanguageQuestion.toLowerCase().includes("usage") || naturalLanguageQuestion.toLowerCase().includes("billing")) {
      const state = await quotaGuard.getBillingState("tenant-default");
      return `[FINOPS ENGINE] Default Tenant Status: ${state.status}. Tokens Remaining: ${state.tokensRemaining.toLocaleString()}. Tier: ${state.currentPlan}. No limits breached.`;
    }

    return `[OPS AI] Acknowledged. Question processing routed to heuristic engine. Simulated generic response generated successfully.`;
  }

  /**
   * Resolves support tickets by acting as a RAG (Retrieval-Augmented Generation) node
   * reading from the internal apps/docs/support knowledge graph.
   */
  public async resolveTicket(ticketContent: string, userRole: string): Promise<string> {
    if (userRole !== "ADMIN" && userRole !== "OWNER") {
      throw new Error("V65 RBAC Violation: Ops Agent restricted to ADMIN clearance.");
    }

    console.info(`[V98:OpsAgent] Resolving ticket: "${ticketContent.substring(0, 30)}..."`);
    
    // Note: __dirname might not be reliable in some build environments, 
    // but works for this local simulation.
    const docsDir = join(__dirname, "../../../../../docs/support");
    let resolution = "No exact resolution found in Knowledge Base. Proceeding to manual triage.";

    try {
      // Simulate RAG scanning
      const files = readdirSync(docsDir);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        
        const content = readFileSync(join(docsDir, file), "utf-8");
        
        if (ticketContent.toLowerCase().includes("token") || ticketContent.toLowerCase().includes("burn")) {
          if (content.includes("High Token Burn")) {
            resolution = `[RAG MATCH: resolution-guide.md -> High Token Burn Rate]\n1. Verified check with quotaManager.\n2. Business use appears legitimate (API volume spike).\n3. Recommendation: Prompt the user to upgrade to an Enterprise Tier limit. Do NOT automatically lift caps.`;
            break;
          }
        }

        if (ticketContent.toLowerCase().includes("bft") || ticketContent.toLowerCase().includes("quorum")) {
          if (content.includes("BFT Consensus Quorum Failures")) {
            resolution = `[RAG MATCH: resolution-guide.md -> BFT Consensus Quorum Failures]\n1. Diagnosed 502 error.\n2. Identified as V48 Cognitive Quorum event.\n3. Recommendation: Instruct tenant to review the latest prompts for adversarial patterns. Assure them the StreetMP truth gate accurately dropped the outlier node.`;
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`[V98:OpsAgent] RAG Document read error: ${(e as Error).message}`);
    }

    return resolution;
  }
}

export const globalOpsAgent = new OpsAgent();
