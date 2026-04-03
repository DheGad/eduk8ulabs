import { Router, Request, Response } from 'express';
import { db } from './db';
import { executeWorkflow } from './runner';
import crypto from 'crypto';

export const publicApiRouter = Router();

// Middleware to authenticate B2B S2S API Key
async function requireS2SKey(req: Request, res: Response, next: import("express").NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer streetmp_s2s_")) {
    res.status(401).json({ success: false, error: "Invalid or missing S2S API Key. Format: Bearer streetmp_s2s_..." });
    return;
  }
  
  const apiKey = authHeader.slice(7);
  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

  try {
    const result = await db.query(
      `SELECT u.id, u.email 
       FROM s2s_api_keys k
       JOIN users u ON k.user_id = u.id
       WHERE k.api_key_hash = $1`,
      [apiKeyHash]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ success: false, error: "Invalid S2S API Key." });
      return;
    }

    (req as any).apiUser = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ success: false, error: "Authentication failed." });
  }
}

// POST /api/v1/external/workflows/:id/trigger
// Accepts { input_payload: object }
publicApiRouter.post('/api/v1/external/workflows/:id/trigger', requireS2SKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { input_payload } = req.body;
    const callerUser = (req as any).apiUser;

    // 1. Fetch Workflow
    const wfRes = await db.query(
      `SELECT id, price_per_execution, user_id FROM autonomous_workflows 
       WHERE id = $1 AND is_published = true`,
      [id]
    );

    if (wfRes.rowCount === 0) {
      res.status(404).json({ success: false, error: "Target workflow not found or not published." });
      return;
    }

    const workflow = wfRes.rows[0];
    const priceCents = Math.round(parseFloat(workflow.price_per_execution) * 100);

    // 2. Billing: Deduct execution cost + platform fee from Organization's Managed Account
    // Architectural Simulation: The Enterprise has a corporate wallet on file
    if (priceCents > 0) {
       console.log(`[PublicAPI] Deducting base cost of ${priceCents} cents from Enterprise User Wallet: ${callerUser.id} via Stripe Metered Billing.`);
       
       // Deduct simulated balance
       // Update metrics
       await db.query(`UPDATE autonomous_workflows SET total_rentals = total_rentals + 1 WHERE id = $1`, [workflow.id]);
    }

    // 3. Trigger DAG Runner
    const execResult = await db.query(
      `INSERT INTO workflow_executions (workflow_id, status, state_payload) 
       VALUES ($1, 'running', $2) RETURNING id`,
       [workflow.id, JSON.stringify(input_payload || {})]
    );
    
    const execution_id = execResult.rows[0].id;

    // Asynchronously dispatch the runner
    executeWorkflow(execution_id).catch(e => console.error("[PublicAPI Runner Error]", e.message));

    // 4. Return 202 Accepted tracking ID
    res.status(202).json({
      success: true,
      execution_id,
      status: "running",
      message: 'Workflow execution successfully dispatched to the Universal API.',
    });

  } catch (err: any) {
    console.error('[PublicAPI Execute API Error]:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});
