import { db } from './db';
import { triggerAutoTuner } from './autoTuner';

export function startAnomalyDetector() {
  console.log("[AnomalyDetector] Singularity Engine monitoring activated.");

  // Run every 60 seconds (Simulated cron)
  setInterval(async () => {
    try {
      // Find all published workflows
      const wfRes = await db.query(`SELECT id FROM autonomous_workflows WHERE is_published = true`);
      
      for (const wf of wfRes.rows) {
        // Fetch up to the last 100 executions for this workflow
        const execsRes = await db.query(
          `SELECT status, current_node 
           FROM workflow_executions 
           WHERE workflow_id = $1 
           ORDER BY id DESC 
           LIMIT 100`, /* Assuming sequential IDs or we can order by created_at */
           [wf.id]
        );
        
        if (execsRes.rowCount === 0) continue;
        
        const execs = execsRes.rows;
        const totalSample = execs.length;
        let nodeFailures: Record<string, number> = {};
        
        for (const ex of execs) {
          if (ex.status === 'failed' && ex.current_node) {
             nodeFailures[ex.current_node] = (nodeFailures[ex.current_node] || 0) + 1;
          }
        }
        
        const failureThreshold = Math.ceil(totalSample * 0.15); // > 15% failure rate
        
        for (const [nodeId, failCount] of Object.entries(nodeFailures)) {
          if (failCount > failureThreshold) {
             // Check if an active mutation is already testing for this node to avoid duplicate tuner runs
             const activeMutation = await db.query(
                `SELECT id FROM workflow_mutations 
                 WHERE workflow_id = $1 AND original_node_id = $2 AND status = 'testing'`,
                [wf.id, nodeId]
             );

             if (activeMutation.rowCount === 0) {
                console.log(`[AnomalyDetector] ⚠️ Node ${nodeId} in Workflow ${wf.id} reached a ${Math.round((failCount / totalSample) * 100)}% failure rate. Triggering Auto-Tuner.`);
                // Fire and forget
                triggerAutoTuner(wf.id, nodeId).catch(e => console.error("[AnomalyDetector] Auto-Tuner failed:", e.message));
             }
          }
        }
      }
    } catch (err) {
      console.error("[AnomalyDetector] Cron error:", err);
    }
  }, 60000); 
}
