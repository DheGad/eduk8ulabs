import { Router, Request, Response } from 'express';
import { db } from './db';

export const equityRouter = Router();

// Minimal JWT verification inline for this microservice component
function requireJwt(req: Request, res: Response, next: import("express").NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
    if (!payload.sub) throw new Error("Missing sub claim");
    (req as any).user = { sub: payload.sub };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: "JWT validation failed" });
  }
}

// POST /api/v1/workflows/:id/tokenize
equityRouter.post('/api/v1/workflows/:id/tokenize', requireJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.sub;

    // 1. Verify workflow exists and belongs to the user
    const wfRes = await db.query(
      `SELECT user_id, is_tokenized FROM autonomous_workflows WHERE id = $1`,
      [id]
    );

    if (wfRes.rowCount === 0) {
      res.status(404).json({ success: false, error: "Workflow not found." });
      return;
    }

    const wf = wfRes.rows[0];

    if (wf.user_id !== userId) {
      res.status(403).json({ success: false, error: "Only the workflow creator can tokenize this asset." });
      return;
    }

    if (wf.is_tokenized) {
      res.status(409).json({ success: false, error: "Workflow is already tokenized." });
      return;
    }

    // 2. Transaction to set is_tokenized and issue 100% equity
    await db.query('BEGIN');

    await db.query(
      `UPDATE autonomous_workflows SET is_tokenized = true WHERE id = $1`,
      [id]
    );

    const equityRes = await db.query(
      `INSERT INTO agent_equity_shares (workflow_id, shareholder_id, equity_percentage)
       VALUES ($1, $2, 100.00) RETURNING id, equity_percentage`,
      [id, userId]
    );

    await db.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Agent Successfully IPO'd. 100.00% equity minted to creator.",
      equity: equityRes.rows[0]
    });

  } catch (err: any) {
    await db.query('ROLLBACK');
    console.error('[EquityRouter]', err);
    res.status(500).json({ success: false, error: 'Internal server error during tokenization.' });
  }
});
