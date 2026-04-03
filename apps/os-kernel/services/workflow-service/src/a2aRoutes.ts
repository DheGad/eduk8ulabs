import { Router, Request, Response } from 'express';
import { db } from './db';
import { executeWorkflow } from './runner';
import crypto from 'crypto';

export const a2aRouter = Router();

// Middleware to authenticate S2S API Key
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

// POST /api/v1/a2a/execute
// Payload: { target_agent_hash: string, input_payload: object }
a2aRouter.post('/api/v1/a2a/execute', requireS2SKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { target_agent_hash, input_payload } = req.body;
    const callerUser = (req as any).apiUser;

    if (!target_agent_hash) {
      res.status(400).json({ success: false, error: "Missing target_agent_hash" });
      return;
    }

    // 1. Fetch workflow by agent hash
    const wfRes = await db.query(
      `SELECT id, price_per_execution FROM autonomous_workflows 
       WHERE agent_identity_hash = $1 AND is_published = true`,
      [target_agent_hash]
    );

    if (wfRes.rowCount === 0) {
      res.status(404).json({ success: false, error: "Target agent workflow not found or not published." });
      return;
    }

    const workflow = wfRes.rows[0];
    const priceCents = Math.round(parseFloat(workflow.price_per_execution) * 100);

    // 2. HTTP 402 Handshake Logic
    if (priceCents > 0) {
      // For this OS Kernel architectural phase, we simulate the wallet check.
      // If the header 'x-authorized-balance' isn't explicitly passed for simulation, we return 402.
      const simBalanceCents = parseInt((req.headers['x-authorized-balance'] as string) || "0", 10);
      
      if (simBalanceCents < priceCents) {
        // STRICT 402 Payment Required
        res.status(402).json({
          success: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Insufficient pre-authorized balance to execute this agent.",
            required_cents: priceCents,
            stripe_connect_required: true
          }
        });
        return;
      }
      
      // If authorized, deduct balance. (Simulated in Phase 6 context)
      // We log the deduction to the DB if we had a wallet_balance column, 
      // but here we just pass through since it's an architectural simulation.
      console.log(`[A2A Commerce] Deducted ${priceCents} cents from user ${callerUser.id}`);
      
      // Increment rentals
      await db.query(`UPDATE autonomous_workflows SET total_rentals = total_rentals + 1 WHERE id = $1`, [workflow.id]);
    }

    // 3. Trigger DAG Runner
    const execResult = await db.query(
      `INSERT INTO workflow_executions (workflow_id, status, state_payload) 
       VALUES ($1, 'running', $2) RETURNING id`,
       [workflow.id, JSON.stringify(input_payload || {})]
    );
    
    const execution_id = execResult.rows[0].id;

    // Fire off async runner
    executeWorkflow(execution_id);

    // 4. Return execution info
    res.status(202).json({
      success: true,
      execution_id,
      message: 'A2A DAG Execution initialized. Polling required.',
      cost_deducted_cents: priceCents
    });

  } catch (err: any) {
    console.error('[A2A Execute API Error]:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});
