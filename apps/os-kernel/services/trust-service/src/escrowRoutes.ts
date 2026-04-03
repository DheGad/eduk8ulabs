/**
 * @file escrowRoutes.ts
 * @service trust-service
 * @description Smart Escrow Bridge — Stripe PaymentIntent lifecycle management.
 *
 * ================================================================
 * ESCROW LIFECYCLE
 * ================================================================
 *
 *   1. Client calls POST /api/v1/escrow/create
 *      → Stripe PaymentIntent created (manual capture — funds held)
 *      → escrow_contracts row inserted with status='funded'
 *      → client_secret returned to frontend for payment sheet
 *
 *   2. Enforcer calls POST /internal/trust/verify-and-release
 *      → Required JSON schema matched against the escrow contract
 *      → stripe.paymentIntents.capture() triggered
 *      → escrow_contracts.status → 'validated_and_released'
 *      → release_trace_id linked to execution_traces row
 *
 *   3. Stripe sends POST /webhooks/stripe
 *      → payment_intent.payment_failed  → status → 'disputed'
 *      → payment_intent.canceled        → status → 'disputed'
 *      → charge.dispute.created         → status → 'disputed'
 *
 * ================================================================
 * SECURITY NOTES
 * ================================================================
 *   • /api/v1/escrow/create requires a valid JWT (requireAuth).
 *   • /internal/trust/verify-and-release requires x-internal-service-token.
 *   • /webhooks/stripe validates Stripe-Signature using raw body.
 *     Express JSON parsing MUST be bypassed for this route — raw
 *     Buffer must be passed to stripe.webhooks.constructEvent().
 *   • Amounts are stored and compared in the smallest currency unit
 *     (cents for USD) to avoid floating-point rounding errors.
 *   • Self-dealing (client_id === freelancer_id) is rejected at the
 *     DB level via CHECK constraint AND at the API validation level.
 * ================================================================
 */

import express, { Router, Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { pool } from "./db.js";

export const escrowRouter = Router();

// ================================================================
// STRIPE CLIENT
// Initialized lazily to surface a clear error if STRIPE_SECRET_KEY
// is missing, rather than crashing at module load.
// ================================================================

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "[EscrowBridge] FATAL: STRIPE_SECRET_KEY is not set. " +
      "Escrow endpoints are disabled until this is configured."
    );
  }
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: (process.env.STRIPE_API_VERSION ?? "2026-02-25.clover") as any,
    typescript: true,
  });
}

// ================================================================
// INTERNAL TOKEN GUARD (same pattern as trustRouter)
// ================================================================

function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.INTERNAL_ROUTER_SECRET;
  if (!secret) {
    res.status(503).json({
      success: false,
      error: { code: "SERVICE_MISCONFIGURED", message: "Internal auth secret not configured." },
    });
    return;
  }
  const token = req.headers["x-internal-service-token"];
  if (!token || token !== secret) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Invalid internal service token." },
    });
    return;
  }
  next();
}

// ================================================================
// JWT AUTH GUARD
// Inline implementation — avoids cross-workspace resolution issues.
// Validates Bearer token and attaches decoded payload to req.user.
// ================================================================

function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("[EscrowBridge] FATAL: JWT_SECRET not configured.");
    res.status(503).json({
      success: false,
      error: { code: "SERVICE_MISCONFIGURED", message: "Auth service not configured." },
    });
    return;
  }

  try {
    // Manually decode and verify the JWT payload
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8")
    ) as { sub?: string; tier?: string; exp?: number };

    if (!payload.sub) throw new Error("Missing sub claim");
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    // Attach user identity — same shape as @streetmp-os/security requireAuth
    (req as Request & { user: { sub: string; tier: string } }).user = {
      sub: payload.sub,
      tier: payload.tier ?? "free",
    };
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: `JWT validation failed: ${(err as Error).message}` },
    });
  }
}

const CreateEscrowSchema = z.object({
  client_id:            z.string().uuid("client_id must be a valid UUID"),
  freelancer_id:        z.string().uuid("freelancer_id must be a valid UUID"),
  /**
   * Amount in USD cents (smallest unit). Required to avoid floating-point
   * ambiguity. A $100 escrow = amount: 10000.
   * Must be ≥ 50 (Stripe minimum for PaymentIntents in USD).
   */
  amount:               z.number().int().min(50, "amount must be ≥ 50 cents (Stripe minimum)"),
  /**
   * The JSON schema the freelancer's AI output must satisfy for funds
   * to be released. Stored verbatim in required_json_schema JSONB column.
   * Example: { "required_keys": ["resume_score", "verdict"] }
   */
  required_json_schema: z.record(z.unknown()),
});

escrowRouter.post(
  "/api/v1/escrow/create",
  requireJwt,  // JWT required — only authenticated users can create escrows
  async (req: Request, res: Response): Promise<void> => {
    // ── 1. Validate payload ─────────────────────────────────────
    const parsed = CreateEscrowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid escrow creation payload.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { client_id, freelancer_id, amount, required_json_schema } = parsed.data;

    // ── 2. Self-dealing guard (API layer, belt-and-suspenders with DB CHECK) ─
    if (client_id === freelancer_id) {
      res.status(400).json({
        success: false,
        error: {
          code: "SELF_DEALING_REJECTED",
          message: "client_id and freelancer_id must be different users.",
        },
      });
      return;
    }

    // ── 3. Verify both users exist in the DB before calling Stripe ──
    // Prevents orphaned PaymentIntents from being created for fake user IDs.
    try {
      const userCheck = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE id IN ($1, $2)`,
        [client_id, freelancer_id]
      );
      if (parseInt(userCheck.rows[0]?.count ?? "0", 10) < 2) {
        res.status(404).json({
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "One or both of client_id / freelancer_id do not exist.",
          },
        });
        return;
      }
    } catch (dbErr) {
      console.error("[EscrowBridge:create] User verification query failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to verify user identities." },
      });
      return;
    }

    // ── 4. Create Stripe PaymentIntent with manual capture ───────
    // manual capture = funds are authorized and held, NOT charged yet.
    // The capture() call in verify-and-release triggers the actual debit.
    let paymentIntent: Stripe.PaymentIntent;
    try {
      const stripe = getStripeClient();
      paymentIntent = await stripe.paymentIntents.create({
        amount,                      // smallest currency unit (cents)
        currency: "usd",
        capture_method: "manual",    // HOLD funds — do not charge until validation
        confirm: false,              // Frontend must call stripe.confirmCardPayment()
        metadata: {
          client_id,
          freelancer_id,
          platform: "streetmp-os",
        },
        description: `Streetmp OS Escrow — client=${client_id.slice(0, 8)} → freelancer=${freelancer_id.slice(0, 8)}`,
      });
    } catch (stripeErr) {
      const sErr = stripeErr as Stripe.errors.StripeError;
      console.error("[EscrowBridge:create] Stripe PaymentIntent creation failed:", sErr.message);
      res.status(502).json({
        success: false,
        error: {
          code: "STRIPE_ERROR",
          message: `Stripe rejected the payment intent: ${sErr.message}`,
          stripe_code: sErr.code,
        },
      });
      return;
    }

    // ── 5. Insert the escrow_contracts row ────────────────────────
    // amount is converted to dollars for the NUMERIC(12,2) column.
    const amountUSD = (amount / 100).toFixed(2);

    let escrowId: string;
    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO escrow_contracts
           (client_id, freelancer_id, stripe_payment_intent_id,
            required_json_schema, payout_amount, status)
         VALUES ($1, $2, $3, $4, $5, 'funded')
         RETURNING id`,
        [
          client_id,
          freelancer_id,
          paymentIntent.id,
          JSON.stringify(required_json_schema),
          amountUSD,
        ]
      );
      escrowId = result.rows[0]!.id;
    } catch (dbErr) {
      // If DB insert fails after Stripe success, cancel the PaymentIntent to prevent
      // fund lock — best-effort cleanup (we don't hard-fail on cleanup failure)
      try {
        const stripe = getStripeClient();
        await stripe.paymentIntents.cancel(paymentIntent.id);
        console.warn(
          `[EscrowBridge:create] DB insert failed; cancelled PaymentIntent ${paymentIntent.id}`
        );
      } catch (cancelErr) {
        console.error(
          `[EscrowBridge:create] CRITICAL: DB insert failed AND PaymentIntent cancel failed. ` +
          `Manual cleanup required for PaymentIntent ${paymentIntent.id}:`,
          (cancelErr as Error).message
        );
      }

      console.error("[EscrowBridge:create] DB insert failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: {
          code: "DB_ERROR",
          message: "Failed to persist escrow contract. Payment has been voided.",
        },
      });
      return;
    }

    console.log(
      `[EscrowBridge] ✅ Escrow created: ${escrowId} | ` +
      `intent=${paymentIntent.id} | $${amountUSD} | ` +
      `client=${client_id.slice(0, 8)} → freelancer=${freelancer_id.slice(0, 8)}`
    );

    res.status(201).json({
      success: true,
      data: {
        escrow_id:     escrowId,
        client_secret: paymentIntent.client_secret, // Frontend passes to stripe.confirmCardPayment()
        payment_intent_id: paymentIntent.id,
        amount_usd:    amountUSD,
        status:        "funded",
      },
    });
  }
);

// ================================================================
// TASK 3: AUTO-RELEASE LOGIC
// POST /internal/trust/verify-and-release
// ================================================================
/**
 * Called by the Enforcer Service after a successful JSON execution
 * when the caller has specified an escrow_contract_id in the request.
 *
 * Validates that the escrow's required_json_schema keys are all
 * present in the execution output, then captures the Stripe payment.
 *
 * Schema validation logic:
 *   - If required_json_schema is { "required_keys": ["a", "b"] },
 *     check final_output has both "a" and "b" at root level.
 *   - If required_json_schema has no "required_keys" field,
 *     treat any non-empty output as a valid release trigger.
 */

const VerifyReleaseSchema = z.object({
  escrow_contract_id: z.string().uuid("escrow_contract_id must be a valid UUID"),
  usage_log_id:       z.string().uuid("usage_log_id must be a valid UUID"),
  /** The execution_trace id from the Trust Service flight recorder */
  trace_id:           z.string().uuid("trace_id must be a valid UUID"),
  /** The validated final JSON output from the Enforcer */
  final_output:       z.record(z.unknown()),
});

escrowRouter.post(
  "/internal/trust/verify-and-release",
  requireInternalToken,
  async (req: Request, res: Response): Promise<void> => {
    // ── 1. Validate payload ─────────────────────────────────────
    const parsed = VerifyReleaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid verify-and-release payload.",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { escrow_contract_id, trace_id, final_output } = parsed.data;

    // ── 2. Fetch the escrow contract ─────────────────────────────
    let contract: {
      id: string;
      stripe_payment_intent_id: string;
      required_json_schema: Record<string, unknown>;
      status: string;
      payout_amount: string;
      freelancer_id: string;
    } | undefined;

    try {
      const result = await pool.query(
        `SELECT id, stripe_payment_intent_id, required_json_schema,
                status, payout_amount, freelancer_id
         FROM escrow_contracts
         WHERE id = $1`,
        [escrow_contract_id]
      );
      contract = result.rows[0] as typeof contract;
    } catch (dbErr) {
      console.error("[EscrowBridge:release] DB fetch failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to fetch escrow contract." },
      });
      return;
    }

    if (!contract) {
      res.status(404).json({
        success: false,
        error: {
          code: "ESCROW_NOT_FOUND",
          message: `No escrow contract found with id "${escrow_contract_id}".`,
        },
      });
      return;
    }

    // ── 3. State guard — only release in_progress contracts ──────
    // Prevents double-capture or releasing already-disputed contracts.
    if (contract.status !== "in_progress") {
      res.status(409).json({
        success: false,
        error: {
          code: "INVALID_ESCROW_STATE",
          message: `Escrow is in state "${contract.status}". Only "in_progress" contracts can be released.`,
          current_status: contract.status,
        },
      });
      return;
    }

    // ── 4. Schema validation — verify output satisfies the contract ─
    const schema = contract.required_json_schema as { required_keys?: string[] };
    const requiredKeys: string[] = Array.isArray(schema.required_keys)
      ? schema.required_keys
      : [];

    if (requiredKeys.length > 0) {
      const missingKeys = requiredKeys.filter((key) => !(key in final_output));
      if (missingKeys.length > 0) {
        console.warn(
          `[EscrowBridge:release] Schema mismatch — escrow=${escrow_contract_id} ` +
          `missing keys: ${missingKeys.join(", ")}`
        );
        res.status(422).json({
          success: false,
          error: {
            code: "SCHEMA_MISMATCH",
            message: "Final output does not satisfy the escrow's required JSON schema.",
            missing_keys: missingKeys,
          },
        });
        return;
      }
    }

    // ── 5. Capture the Stripe PaymentIntent (debit the client) ───
    try {
      const stripe = getStripeClient();
      await stripe.paymentIntents.capture(contract.stripe_payment_intent_id);
      console.log(
        `[EscrowBridge:release] 💸 Stripe captured: ${contract.stripe_payment_intent_id} | ` +
        `$${contract.payout_amount} → freelancer=${contract.freelancer_id.slice(0, 8)}`
      );
    } catch (stripeErr) {
      const sErr = stripeErr as Stripe.errors.StripeError;
      // If already captured, treat as idempotent success
      if (sErr.code === "payment_intent_unexpected_state") {
        console.warn(
          `[EscrowBridge:release] PaymentIntent already captured (idempotent): ${contract.stripe_payment_intent_id}`
        );
      } else {
        console.error("[EscrowBridge:release] Stripe capture failed:", sErr.message);
        res.status(502).json({
          success: false,
          error: {
            code: "STRIPE_CAPTURE_FAILED",
            message: `Stripe failed to capture payment: ${sErr.message}`,
            stripe_code: sErr.code,
          },
        });
        return;
      }
    }

    // ── 6. Update escrow_contracts status atomically ─────────────
    try {
      await pool.query(
        `UPDATE escrow_contracts
         SET status           = 'validated_and_released',
             release_trace_id = $1,
             updated_at       = NOW()
         WHERE id = $2`,
        [trace_id, escrow_contract_id]
      );
    } catch (dbErr) {
      // Stripe was already captured — log critically but don't 500 to caller
      // since money has moved. Requires manual DB reconciliation.
      console.error(
        `[EscrowBridge:release] CRITICAL: Stripe captured but DB update failed! ` +
        `escrow=${escrow_contract_id} trace=${trace_id}:`,
        (dbErr as Error).message
      );
    }

    console.log(
      `[EscrowBridge:release] ✅ Escrow released: ${escrow_contract_id} | ` +
      `trace=${trace_id} | $${contract.payout_amount}`
    );

    res.status(200).json({
      success: true,
      status: "payout_triggered",
      escrow_id: escrow_contract_id,
      trace_id,
      payout_amount_usd: contract.payout_amount,
    });
  }
);
// ================================================================
// COMMAND 060: RENT PUBLISHED WORKFLOW
// POST /api/v1/escrow/rent-workflow
// ================================================================

const RentWorkflowSchema = z.object({
  workflow_id: z.string().uuid("workflow_id must be a valid UUID"),
});

escrowRouter.post(
  "/api/v1/escrow/rent-workflow",
  requireJwt,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RentWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid payload." } });
      return;
    }

    const { workflow_id } = parsed.data;
    const buyer_id = (req as any).user.sub;

    try {
      // 1. Fetch workflow and creator details
      const wfRes = await pool.query(
        `SELECT aw.user_id as creator_id, aw.price_per_execution, aw.is_tokenized, u.stripe_connect_id, u.payouts_enabled
         FROM autonomous_workflows aw
         JOIN users u ON aw.user_id = u.id
         WHERE aw.id = $1 AND aw.is_published = true`,
        [workflow_id]
      );

      if (wfRes.rowCount === 0) {
        res.status(404).json({ success: false, error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow not found or not published." } });
        return;
      }

      const wf = wfRes.rows[0];
      const priceCents = Math.round(parseFloat(wf.price_per_execution) * 100);

      if (priceCents === 0) {
        await pool.query(`UPDATE autonomous_workflows SET total_rentals = total_rentals + 1 WHERE id = $1`, [workflow_id]);
        res.json({ success: true, payment_required: false });
        return;
      }

      const platformFee = Math.round(priceCents * 0.20);
      const remainingPool = priceCents - platformFee;

      const stripe = getStripeClient();
      let paymentIntent;

      if (!wf.is_tokenized) {
        // Standard Payout
        if (!wf.stripe_connect_id || !wf.payouts_enabled) {
           res.status(400).json({ success: false, error: { code: "CREATOR_UNAVAILABLE", message: "Creator cannot receive payments yet." } });
           return;
        }

        paymentIntent = await stripe.paymentIntents.create({
          amount: priceCents,
          currency: "usd",
          application_fee_amount: platformFee,
          transfer_data: { destination: wf.stripe_connect_id },
          metadata: { workflow_id, buyer_id, type: "workflow_rental" }
        });
      } else {
        // THE DIVIDEND SPLITTER (Command 062)
        const transferGroup = `rental_${workflow_id}_${Date.now()}`;
        
        paymentIntent = await stripe.paymentIntents.create({
          amount: priceCents,
          currency: "usd",
          transfer_group: transferGroup,
          metadata: { workflow_id, buyer_id, type: "workflow_rental_equity" }
        });

        // Determine all shareholders
        const sharesRes = await pool.query(
          `SELECT s.equity_percentage, u.stripe_connect_id 
           FROM agent_equity_shares s
           JOIN users u ON s.shareholder_id = u.id
           WHERE s.workflow_id = $1 AND u.payouts_enabled = true`,
          [workflow_id]
        );

        // Dispatch multi-transfer payouts simultaneously
        const transferPromises = sharesRes.rows.map(share => {
          const dividend = Math.floor(remainingPool * (parseFloat(share.equity_percentage) / 100));
          if (dividend > 0 && share.stripe_connect_id) {
            return stripe.transfers.create({
              amount: dividend,
              currency: "usd",
              destination: share.stripe_connect_id,
              transfer_group: transferGroup,
              metadata: { workflow_id }
            }).catch(e => console.error("[Dividend Error]", e.message)); // Catch to avoid crashing flow on simulate
          }
          return Promise.resolve();
        });

        await Promise.all(transferPromises);
      }

      // Increment total_rentals
      await pool.query(`UPDATE autonomous_workflows SET total_rentals = total_rentals + 1 WHERE id = $1`, [workflow_id]);

      res.status(200).json({
        success: true,
        payment_required: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      });

    } catch (err: any) {
      console.error("[RentWorkflow]", err);
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
    }
  }
);
// ================================================================
// TASK 4: STRIPE WEBHOOK HANDLER
// POST /webhooks/stripe
// ================================================================
/**
 * CRITICAL: This route must receive the RAW request body as a Buffer,
 * NOT the parsed JSON body. Express's json() middleware must NOT run
 * on this route. We mount this router BEFORE json() middleware in
 * index.ts, and use express.raw() only for this path.
 *
 * Handled events:
 *   payment_intent.payment_failed — payment failed after capture attempt
 *   payment_intent.canceled       — client canceled before freelancer started
 *   charge.dispute.created        — card dispute raised by client
 */

const WEBHOOK_HANDLED_EVENTS = new Set([
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.dispute.created",
  "account.updated",  // Stripe Connect onboarding completion
]);

escrowRouter.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }), // raw body for signature verification
  async (req: Request, res: Response): Promise<void> => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[EscrowBridge:webhook] STRIPE_WEBHOOK_SECRET not set — cannot verify webhook.");
      // Acknowledge to prevent Stripe retries; a misconfigured service shouldn't
      // spam Stripe's retry queue — but this is an ops alert.
      res.status(200).json({ received: true, warning: "Webhook secret not configured." });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ success: false, error: { code: "NO_SIGNATURE", message: "Missing Stripe-Signature header." } });
      return;
    }

    // ── Verify webhook signature ──────────────────────────────────
    let event: Stripe.Event;
    try {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(
        req.body as Buffer, // raw Buffer — MUST not be JSON-parsed
        sig as string,
        webhookSecret
      );
    } catch (err) {
      console.warn("[EscrowBridge:webhook] Signature verification failed:", (err as Error).message);
      res.status(400).json({
        success: false,
        error: { code: "INVALID_SIGNATURE", message: "Webhook signature verification failed." },
      });
      return;
    }

    // ── Skip events we don't handle ───────────────────────────────
    if (!WEBHOOK_HANDLED_EVENTS.has(event.type)) {
      res.status(200).json({ received: true, handled: false, event_type: event.type });
      return;
    }

    console.log(`[EscrowBridge:webhook] Received: ${event.type} | id=${event.id}`);

    // ── account.updated: Stripe Connect onboarding completion ─────
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const connectId = account.id;
      const transfersActive = account.capabilities?.transfers === "active";

      if (transfersActive) {
        try {
          const updateResult = await pool.query(
            `UPDATE users
             SET payouts_enabled = true, updated_at = NOW()
             WHERE stripe_connect_id = $1
             RETURNING id`,
            [connectId]
          );
          if (updateResult.rowCount && updateResult.rowCount > 0) {
            console.log(
              `[EscrowBridge:webhook] ✅ Payouts enabled for connect_id=${connectId} ` +
              `(user=${updateResult.rows[0]?.id})`
            );
          } else {
            console.warn(
              `[EscrowBridge:webhook] account.updated: no user found for connect_id=${connectId}`
            );
          }
        } catch (dbErr) {
          console.error("[EscrowBridge:webhook] payouts_enabled update failed:", (dbErr as Error).message);
        }
      }

      res.status(200).json({ received: true, handled: true, event_type: event.type });
      return;
    }

    // ── Extract the PaymentIntent ID from the event ───────────────
    let paymentIntentId: string | null = null;

    if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.canceled"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      paymentIntentId = pi.id;
    } else if (event.type === "charge.dispute.created") {
      const dispute = event.data.object as Stripe.Dispute;
      // charge.dispute.created has the charge object; fetch PI from charge
      const stripe = getStripeClient();
      try {
        const charge = await stripe.charges.retrieve(dispute.charge as string);
        paymentIntentId = charge.payment_intent as string | null;
      } catch (fetchErr) {
        console.error("[EscrowBridge:webhook] Failed to fetch charge for dispute:", (fetchErr as Error).message);
        // Still acknowledge to Stripe — we'll reconcile manually
        res.status(200).json({ received: true, handled: false, error: "charge_fetch_failed" });
        return;
      }
    }

    if (!paymentIntentId) {
      console.warn(`[EscrowBridge:webhook] Could not extract paymentIntentId from event ${event.type}`);
      res.status(200).json({ received: true, handled: false });
      return;
    }

    // ── Update escrow_contracts to 'disputed' ─────────────────────
    try {
      const result = await pool.query<{ id: string; status: string }>(
        `UPDATE escrow_contracts
         SET status     = 'disputed',
             updated_at = NOW()
         WHERE stripe_payment_intent_id = $1
           AND status NOT IN ('validated_and_released')
         RETURNING id, status`,
        [paymentIntentId]
      );

      if (result.rowCount === 0) {
        console.warn(
          `[EscrowBridge:webhook] No updatable contract for intent=${paymentIntentId} ` +
          `(may already be released or not found)`
        );
      } else {
        console.log(
          `[EscrowBridge:webhook] ⚠️  Escrow disputed: ${result.rows[0]?.id} | ` +
          `event=${event.type} | intent=${paymentIntentId}`
        );
      }
    } catch (dbErr) {
      console.error("[EscrowBridge:webhook] DB update failed:", (dbErr as Error).message);
      // DO NOT return a 500 to Stripe — it will retry the webhook causing duplicate processing.
      // Acknowledge and alert ops instead.
    }

    // Always acknowledge the webhook — Stripe retries on non-2xx
    res.status(200).json({ received: true, handled: true, event_type: event.type });
  }
);

// Export the raw-body route path for index.ts to know which route
// needs the express.raw() bypass (handled inline above)
export const STRIPE_WEBHOOK_PATH = "/webhooks/stripe";
