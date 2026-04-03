import { db } from './db';
import { dispatchWebhook } from './dispatcher';

// Using native fetch for making requests to the Enforcer Service
async function enforceNode(node: any, statePayload: any) {
  try {
    // Basic substitution logic: Replace {{var}} in node.prompt with statePayload vals
    let hydratedPrompt = node.prompt;
    if (hydratedPrompt && typeof hydratedPrompt === 'string') {
      const keys = Object.keys(statePayload);
      for (const k of keys) {
        // Find if this specific node references state via json
        // In real DAGs state is structured, here we do a simple string replace
        if (typeof statePayload[k] === 'string' || typeof statePayload[k] === 'number') {
           hydratedPrompt = hydratedPrompt.replace(new RegExp(`{{${k}}}`, 'g'), statePayload[k]);
        } else {
           hydratedPrompt = hydratedPrompt.replace(new RegExp(`{{${k}}}`, 'g'), JSON.stringify(statePayload[k]));
        }
      }
    }

    // Call Enforcer via standard API
    // Note: User prompt instructed hitting Enforcer at http://localhost:4003/api/v1/enforce
    const res = await fetch('http://localhost:4003/api/v1/enforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: hydratedPrompt,
        required_schema: node.schema || {},
        model: node.model || "gpt-4o",
        user_id: node.user_id || "SYS_ORCHESTRATOR"
      })
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 502) {
        throw new Error(`Enforcer rejected prompt: HTTP ${res.status} Hard Failure`);
      }
      throw new Error(`Execution error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data; // Expected shape: { output: {...}, metadata: { tokens_used, cost } }
  } catch (error: any) {
    throw error;
  }
}

/**
 * executeWorkflow
 * @description The Agentic DAG Runner Engine
 * Iterates through nodes linearly (simplified DAG) injecting state and passing via Enforcer.
 */
export async function executeWorkflow(execution_id: string) {
  console.log(`[DAG ENGINE] Starting execution: ${execution_id}`);
  
  let statePayload: Record<string, any> = {};
  let cumulativeCost = 0.0;
  let totalTokensUsed = 0;
  
  try {
    // Fetch nodes (Pipeline definitions)
    const execWfRes = await db.query(`SELECT workflow_id FROM workflow_executions WHERE id = $1`, [execution_id]);
    if (execWfRes.rowCount === 0) throw new Error('Execution record not found.');
    
    const workflow_id = execWfRes.rows[0].workflow_id;
    const workflowRes = await db.query(`SELECT nodes, edges FROM autonomous_workflows WHERE id = $1`, [workflow_id]);
    if (workflowRes.rowCount === 0) throw new Error('Workflow not found.');
    
    let nodes = workflowRes.rows[0].nodes || [];
    const edges = workflowRes.rows[0].edges || [];

    // The Singularity Engine: Check for active Shadow Deployments
    const activeMutationsRes = await db.query(
      `SELECT * FROM workflow_mutations WHERE workflow_id = $1 AND status = 'testing'`,
      [workflow_id]
    );
    const activeMutations = activeMutationsRes.rows;

    for (let i = 0; i < nodes.length; i++) {
      let node = { ...nodes[i] }; // Clone to avoid directly mutating DB rows in memory
      let activeMutation = activeMutations.find(m => m.original_node_id === node.id);
      let isShadowTraffic = false;

      if (activeMutation) {
        const trafficThreshold = parseFloat(activeMutation.shadow_traffic_percentage) / 100.0;
        if (Math.random() < trafficThreshold) {
          isShadowTraffic = true;
          console.log(`[DAG ENGINE] 🧬 SINGULARITY ACTIVE: Routing node ${node.id} to shadow mutation ${activeMutation.id}`);
          node.prompt = activeMutation.mutated_prompt;
          node.model = activeMutation.mutated_model;
        }
      }

      console.log(`[DAG ENGINE] Running Node: ${node.id}`);
      
      // Move to the next node: Update DB with current node
      await db.query(
        `UPDATE workflow_executions SET current_node = $1 WHERE id = $2`,
        [node.id, execution_id]
      );

      // Trigger Enforcer
      let enforcerSuccess = false;
      let result: any = null;
      try {
         result = await enforceNode(node, statePayload);
         enforcerSuccess = true;
      } catch (enforceErr: any) {
         enforcerSuccess = false;
         // Note: we swallow this temporarily to record the shadow result, then re-throw
         if (!isShadowTraffic) throw enforceErr; 
      }

      // Singularity Post-Execution Analysis
      if (isShadowTraffic && activeMutation) {
         // Update track record
         const execs = parseInt(activeMutation.shadow_executions, 10) + 1;
         const successes = parseInt(activeMutation.shadow_successes, 10) + (enforcerSuccess ? 1 : 0);
         const hcq = (successes / execs) * 100.00;

         await db.query(`UPDATE workflow_mutations SET shadow_executions = $1, shadow_successes = $2, mutation_hcq_score = $3 WHERE id = $4`, [execs, successes, hcq, activeMutation.id]);

         // Promotion Logic: If we hit 50 executions, and it's beating the origin's implied <85% score.
         if (execs >= 50) {
            if (hcq >= 90.00) {
               // WIN: Auto-Promote
               console.log(`[DAG ENGINE] 🧬 SINGULARITY WIN: Mutation ${activeMutation.id} scored ${hcq.toFixed(2)}%. Promoting to Mainline.`);
               
               // Read actual current nodes again in case another runner modified them
               const liveWf = await db.query(`SELECT nodes FROM autonomous_workflows WHERE id = $1`, [workflow_id]);
               let liveNodes = liveWf.rows[0].nodes;
               const nodeIdx = liveNodes.findIndex((n: any) => n.id === node.id);
               if (nodeIdx > -1) {
                  liveNodes[nodeIdx].prompt = activeMutation.mutated_prompt;
                  liveNodes[nodeIdx].model = activeMutation.mutated_model;
                  
                  await db.query(`UPDATE autonomous_workflows SET nodes = $1 WHERE id = $2`, [JSON.stringify(liveNodes), workflow_id]);
                  await db.query(`UPDATE workflow_mutations SET status = 'promoted' WHERE id = $1`, [activeMutation.id]);
                  
                  // Log System Event per prompt requirement
                  console.log(`[SYSTEM LOG] Workflow auto-optimized to maximize shareholder yield. (Workflow: ${workflow_id})`);
               }
            } else {
               // LOSS: Reject Mutation
               console.log(`[DAG ENGINE] 🧬 SINGULARITY LOSS: Mutation ${activeMutation.id} only scored ${hcq.toFixed(2)}%. Rejecting.`);
               await db.query(`UPDATE workflow_mutations SET status = 'rejected' WHERE id = $1`, [activeMutation.id]);
            }
         }

         // Now that shadow logic is recorded, if Enforcer failed, we must abort the pipeline
         if (!enforcerSuccess) {
            throw new Error(`Execution error: Shadow Node failed JSON Enforcement`);
         }
      }

      // Merge verified JSON payload into state payload, scoped by node ID for data flow
      if (result.output) {
        statePayload[node.id] = result.output;
      }

      // Telemetry Summation
      if (result.metadata) {
        const cost = typeof result.metadata.cost === 'number' ? result.metadata.cost : 0;
        const tokens = typeof result.metadata.tokens_used === 'number' ? result.metadata.tokens_used : 0;
        cumulativeCost += cost;
        totalTokensUsed += tokens;
      }

      // Update state live periodically so users can track progress
      await db.query(
        `UPDATE workflow_executions SET state_payload = $1, cumulative_cost = $2 WHERE id = $3`,
        [JSON.stringify(statePayload), cumulativeCost, execution_id]
      );
    }

    // Completed all nodes successfully
    await db.query(
      `UPDATE workflow_executions SET status = 'completed', current_node = NULL, cumulative_cost = $1 WHERE id = $2`,
      [cumulativeCost, execution_id]
    );
    console.log(`[DAG ENGINE] Execution ${execution_id} COMPLETED. Total Tokens: ${totalTokensUsed}, Total Cost: ${cumulativeCost}`);

    // Command 064: Dispatch Webhook on Completion
    dispatchWebhook(workflow_id, execution_id, 'completed', statePayload);

  } catch (err: any) {
    console.error(`[DAG ENGINE] Execution ${execution_id} FAILED: ${err.message}`);
    // Halting workflow on failure (soft or hard 502/403)
    await db.query(
      `UPDATE workflow_executions SET status = 'failed' WHERE id = $1`,
      [execution_id]
    );

    // To dispatch the failure webhook we need the workflow_id.
    // Since workflow_id is defined inside the try block, we query it if we don't have it inside scope.
    db.query(`SELECT workflow_id FROM workflow_executions WHERE id = $1`, [execution_id])
      .then(res => {
         if (res?.rowCount && res.rowCount > 0) {
           dispatchWebhook(res.rows[0].workflow_id, execution_id, 'failed', { error: err.message });
         }
      })
      .catch(e => console.error("[Dispatcher Fallback Query Error]", e));
  }
}
