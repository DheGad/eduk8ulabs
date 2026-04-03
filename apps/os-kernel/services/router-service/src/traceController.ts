/**
 * @file traceController.ts
 * @service router-service
 * @version V70
 * @description Trace Lookup API — GET /api/v1/admin/trace/:traceId
 *
 * Aggregates trace data from Redis (Active Trace buffer) to return
 * a structured timeline for a single request.
 *
 * Auth: Requires x-admin-secret header (same gate as analyticsController).
 */

import { Request, Response } from "express";
import { getTraceFromRedis } from "./middleware/traceProvider.js";

const ADMIN_SECRET = process.env.STREETMP_ADMIN_SECRET || "dev_admin_secret_key";

export const getTraceTimeline = async (req: Request, res: Response): Promise<void> => {
  // Hard gate
  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== ADMIN_SECRET) {
    res.status(401).json({ success: false, error: "Unauthorized", message: "Invalid or missing Admin Secret." });
    return;
  }

  const { traceId } = req.params;
  if (!traceId || traceId.trim().length < 10) {
    res.status(400).json({ success: false, error: "Invalid traceId." });
    return;
  }

  const trace = await getTraceFromRedis(traceId.trim());

  if (!trace) {
    res.status(404).json({
      success: false,
      error: "Trace not found.",
      message: `No active trace found for ID=${traceId}. Traces expire after 24h.`,
    });
    return;
  }

  res.status(200).json({
    success:  true,
    traceId,
    meta:     trace.meta,
    timeline: trace.events,
    total_events: trace.events.length,
  });
};
