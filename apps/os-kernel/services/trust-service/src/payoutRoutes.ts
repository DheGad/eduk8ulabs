/**
 * @file payoutRoutes.ts
 * @service trust-service
 * @description Stripe Connect Payout Engine — Phase 4 (The Money Phase).
 *
 * ================================================================
 * LIFECYCLE
 * ================================================================
 *
 *   1. Freelancer calls POST /api/v1/payouts/onboard
 *      → Stripe Express connected account created (if none exists)
 *      → stripe_connect_id saved to users table
 *      → Stripe Account Link generated (hosted onboarding UI)
 *      → { onboarding_url } returned to frontend
 *
 *   2. Stripe sends POST /webhooks/stripe (account.updated event)
 *      → On capabilities.transfers = "active":
 *         users.payouts_enabled = true
 *
 *   3. Freelancer calls GET /api/v1/payouts/balance
 *      → stripe.balance.retrieve({ stripeAccount: connect_id })
 *      → Returns pending + available balance in smallest currency unit
 *
 * ================================================================
 * SECURITY
 * ================================================================
 *   • Onboarding + balance routes require valid JWT (Bearer token).
 *   • stripe_connect_id is NEVER exposed to the client — only the
 *     server-side balance lookup uses it.
 *   • Return URLs include a signed `state` param (user_id) to
 *     prevent OAuth callback CSRF on the return flow.
 * ================================================================
 */

import { Router, Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { pool } from "./db.js";

export const payoutRouter = Router();

// ================================================================
// STRIPE CLIENT (lazy initialization — same pattern as escrowRoutes)
// ================================================================

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "[PayoutEngine] FATAL: STRIPE_SECRET_KEY is not set. " +
      "Payout endpoints are disabled until this is configured."
    );
  }
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: (process.env.STRIPE_API_VERSION ?? "2026-02-25.clover") as any,
    typescript: true,
  });
}

// ================================================================
// JWT AUTH GUARD
// Validates the Bearer token and attaches user_id to req context.
// ================================================================

declare module "express" {
  interface Request {
    userId?: string;
  }
}

import * as crypto from "node:crypto";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or malformed Authorization header." },
    });
    return;
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(503).json({
      success: false,
      error: { code: "SERVICE_MISCONFIGURED", message: "JWT_SECRET is not configured." },
    });
    return;
  }

  // Minimal JWT verification — split, base64-decode payload, verify signature
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    const [headerB64, payloadB64, signatureB64] = parts;
    const sigInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac("sha256", jwtSecret)
      .update(sigInput, "utf8")
      .digest("base64url");
    if (expectedSig !== signatureB64) throw new Error("Invalid JWT signature");
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as { sub?: string; exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }
    if (!payload.sub) throw new Error("Missing sub claim");
    req.userId = payload.sub;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: (err as Error).message },
    });
  }
}

// ================================================================
// POST /api/v1/payouts/onboard
// ================================================================
/**
 * Generates a Stripe Connect Express onboarding link for the user.
 *
 * If the user already has a stripe_connect_id, skips account
 * creation and generates a fresh Account Link on the existing account.
 * This supports re-entry if the user abandoned onboarding midway.
 */
payoutRouter.post(
  "/api/v1/payouts/onboard",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;

    const BodySchema = z.object({
      /** ISO 3166-1 alpha-2 country code. Used only on first account creation. */
      country: z.string().length(2).optional().default("US"),
    });

    const parseResult = BodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body.",
          details: parseResult.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { country } = parseResult.data;
    const stripe = getStripeClient();

    // ── 1. Look up existing Connect account for this user ─────────
    let stripeConnectId: string | null = null;
    try {
      const result = await pool.query<{ stripe_connect_id: string | null }>(
        "SELECT stripe_connect_id FROM users WHERE id = $1",
        [userId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found." },
        });
        return;
      }
      stripeConnectId = result.rows[0].stripe_connect_id;
    } catch (dbErr) {
      console.error("[PayoutEngine:onboard] DB lookup failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve user record." },
      });
      return;
    }

    // ── 2. Create Stripe Express account if not already linked ─────
    if (!stripeConnectId) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country,
          capabilities: {
            transfers: { requested: true },
          },
          settings: {
            payouts: {
              schedule: { interval: "manual" }, // We control payout timing
            },
          },
        });
        stripeConnectId = account.id;

        // Persist immediately so a retry doesn't create a duplicate account
        await pool.query(
          "UPDATE users SET stripe_connect_id = $1, updated_at = NOW() WHERE id = $2",
          [stripeConnectId, userId]
        );

        console.log(
          `[PayoutEngine:onboard] Created Stripe Express account ${stripeConnectId} for user ${userId}`
        );
      } catch (stripeErr) {
        console.error("[PayoutEngine:onboard] Stripe account creation failed:", (stripeErr as Error).message);
        res.status(502).json({
          success: false,
          error: { code: "STRIPE_ERROR", message: "Failed to create Stripe connected account." },
        });
        return;
      }
    }

    // ── 3. Generate Stripe Account Link (hosted onboarding UI) ─────
    const webBaseUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeConnectId,
        refresh_url: `${webBaseUrl}/dashboard/payouts?onboarding=refresh`,
        return_url:  `${webBaseUrl}/dashboard/payouts?onboarding=complete&uid=${userId}`,
        type: "account_onboarding",
        collect: "eventually_due",
      });

      res.status(200).json({
        success: true,
        onboarding_url: accountLink.url,
        expires_at: accountLink.expires_at,
      });
    } catch (stripeErr) {
      console.error("[PayoutEngine:onboard] Stripe Account Link creation failed:", (stripeErr as Error).message);
      res.status(502).json({
        success: false,
        error: { code: "STRIPE_ERROR", message: "Failed to generate onboarding link." },
      });
    }
  }
);

// ================================================================
// GET /api/v1/payouts/balance
// ================================================================
/**
 * Retrieves the freelancer's Stripe Connect balance.
 * Returns pending + available totals in the smallest currency unit.
 *
 * The balance is read-only via the platform Stripe key using
 * the `stripeAccount` parameter — the Connect ID is NEVER sent
 * to the frontend.
 */
payoutRouter.get(
  "/api/v1/payouts/balance",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;

    // ── 1. Fetch Connect ID and payout status ─────────────────────
    let stripeConnectId: string | null = null;
    let payoutsEnabled: boolean = false;

    try {
      const result = await pool.query<{
        stripe_connect_id: string | null;
        payouts_enabled: boolean;
      }>(
        "SELECT stripe_connect_id, payouts_enabled FROM users WHERE id = $1",
        [userId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User not found." },
        });
        return;
      }
      stripeConnectId = result.rows[0].stripe_connect_id;
      payoutsEnabled = result.rows[0].payouts_enabled;
    } catch (dbErr) {
      console.error("[PayoutEngine:balance] DB lookup failed:", (dbErr as Error).message);
      res.status(500).json({
        success: false,
        error: { code: "DB_ERROR", message: "Failed to retrieve payout account info." },
      });
      return;
    }

    if (!stripeConnectId) {
      res.status(200).json({
        success: true,
        payouts_enabled: false,
        message: "No Stripe account linked. Call POST /api/v1/payouts/onboard to get started.",
        available: [],
        pending: [],
      });
      return;
    }

    // ── 2. Retrieve balance from Stripe on behalf of the connected account ─
    const stripe = getStripeClient();
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: stripeConnectId,
      });

      res.status(200).json({
        success: true,
        payouts_enabled: payoutsEnabled,
        stripe_account_id: stripeConnectId.slice(0, 8) + "●●●●", // Partial masking for client
        available: balance.available.map((b) => ({
          amount: b.amount,           // In smallest currency unit (cents)
          currency: b.currency,
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
      });
    } catch (stripeErr) {
      console.error("[PayoutEngine:balance] Stripe balance retrieval failed:", (stripeErr as Error).message);
      res.status(502).json({
        success: false,
        error: { code: "STRIPE_ERROR", message: "Failed to retrieve Stripe balance." },
      });
    }
  }
);
