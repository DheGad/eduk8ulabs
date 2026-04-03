/**
 * @file serviceWorker.ts
 * @module StreetMP Extension — Background Service Worker
 * @command COMMAND_094 — THE ZERO-TRUST BROWSER EXTENSION
 * @version V94.0.0
 *
 * ================================================================
 * THE ZERO-TRUST ENFORCEMENT WORKER
 * ================================================================
 *
 * This MV3 service worker runs in a separate JS context from
 * the content script and popup. It performs four critical functions:
 *
 *   1. VIOLATION LOGGING: Receives SHADOW_IT_BLOCKED messages from
 *      content scripts and persists them to chrome.storage.sync.
 *
 *   2. BROWSER NOTIFICATION: Shows an OS-native notification when
 *      a PII violation is blocked (bypass-proof — no UI DOM required).
 *
 *   3. KERNEL TRACING: Batches V70 trace events and flushes them
 *      to the StreetMP OS kernel (POST /api/v1/trace) at regular
 *      intervals. Retries with exponential backoff on failures.
 *
 *   4. STATUS PROVIDER: Responds to STATUS_REQUEST from the popup
 *      with live connection status and daily statistics.
 *
 * ================================================================
 * NOTE ON MV3 SERVICE WORKER LIMITS
 * ================================================================
 *
 * MV3 service workers are terminated after ~30s of inactivity.
 * We use chrome.alarms (the MV3-approved persistent mechanism)
 * to keep the trace flush cycle alive.
 *
 * ================================================================
 */

import type {
  BlockMessage,
  StatusRequestMessage,
  StatusResponseMessage,
  ExtensionStorage,
  TraceEvent,
} from "../shared/messages";
import { DEFAULT_STORAGE } from "../shared/messages";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALARM_TRACE_FLUSH = "streetmp-trace-flush";
const ALARM_HEALTH_CHECK = "streetmp-health-check";
const TRACE_FLUSH_INTERVAL_MIN = 5;      // Flush to kernel every 5 minutes
const HEALTH_CHECK_INTERVAL_MIN = 10;    // Kernel health ping every 10 minutes
const MAX_TRACE_BUFFER = 200;            // Cap trace buffer to avoid storage bloat

// ─── Storage Helpers ──────────────────────────────────────────────────────────
async function getStorage(): Promise<ExtensionStorage> {
  const result = await chrome.storage.sync.get(null);
  return { ...DEFAULT_STORAGE, ...result } as ExtensionStorage;
}

async function setStorage(patch: Partial<ExtensionStorage>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

// ─── Daily Stats ──────────────────────────────────────────────────────────────
async function incrementStat(field: "blockedCount" | "warnedCount"): Promise<void> {
  const storage = await getStorage();
  const today   = new Date().toISOString().split("T")[0];
  const stats   = storage.stats.date === today
    ? storage.stats
    : { date: today, blockedCount: 0, warnedCount: 0 };

  stats[field]++;
  await setStorage({ stats });
}

// ─── Browser Notification ─────────────────────────────────────────────────────
function showNativeNotification(
  site: string,
  categories: string[],
  riskScore: number
): void {
  const topCategory = categories[0] ?? "Sensitive Data";
  chrome.notifications.create({
    type:     "basic",
    iconUrl:  "assets/icon-128.png",
    title:    "StreetMP OS: Transmission Blocked",
    message:  `${topCategory} detected in your ${site} prompt. Risk score: ${riskScore}/1000. Use the Sovereign Workspace instead.`,
    priority: 2,
    requireInteraction: false,
  });
}

// ─── Kernel Trace Flush ───────────────────────────────────────────────────────
/**
 * Flushes the in-memory trace buffer to the StreetMP OS kernel.
 * Events are sent as a batch POST to /api/v1/trace.
 * If the flush fails, events are retained in storage for the next cycle.
 */
async function flushTraceBuffer(): Promise<void> {
  const storage = await getStorage();
  if (!storage.traceBuffer || storage.traceBuffer.length === 0) return;
  if (!storage.kernelUrl || !storage.extensionApiKey) {
    console.warn("[V94:Worker] Kernel URL or API key not configured — trace flush skipped.");
    return;
  }

  const events = storage.traceBuffer.slice();  // Copy to prevent mutation during flush

  try {
    const response = await fetch(`${storage.kernelUrl}/api/v1/trace`, {
      method:  "POST",
      headers: {
        "Content-Type":       "application/json",
        "Authorization":      `Bearer ${storage.extensionApiKey}`,
        "x-streetmp-source":  "browser-extension-v94",
        "x-extension-version": chrome.runtime.getManifest().version,
      },
      body: JSON.stringify({
        batch:      events,
        source:     "BROWSER_EXTENSION",
        flushed_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),    // 10s timeout
    });

    if (response.ok) {
      // Clear only the events we successfully sent
      const remaining = storage.traceBuffer.slice(events.length);
      await setStorage({ traceBuffer: remaining });
      console.info(`[V94:Worker] Flushed ${events.length} trace events to kernel.`);
    } else {
      const errBody = await response.text().catch(() => "");
      console.warn(`[V94:Worker] Kernel trace flush failed: HTTP ${response.status} — ${errBody}`);
    }
  } catch (err) {
    console.warn("[V94:Worker] Kernel trace flush network error:", (err as Error).message);
    // Retain events — they'll be retried on the next alarm cycle
  }
}

// ─── Kernel Health Check ──────────────────────────────────────────────────────
async function performHealthCheck(): Promise<void> {
  const storage = await getStorage();
  if (!storage.kernelUrl) return;

  try {
    const res = await fetch(`${storage.kernelUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const connected = res.ok;

    // Store connection status for the popup to read
    await chrome.storage.local.set({
      kernelConnected: connected,
      lastHealthCheckAt: new Date().toISOString(),
    });
    console.info(`[V94:Worker] Health check: ${connected ? "✅ CONNECTED" : "❌ DISCONNECTED"}`);
  } catch {
    await chrome.storage.local.set({
      kernelConnected: false,
      lastHealthCheckAt: new Date().toISOString(),
    });
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: BlockMessage | StatusRequestMessage, _sender, sendResponse) => {

    if (message.type === "SHADOW_IT_REDACTED" || message.type === "SHADOW_IT_WARN" || message.type === "SHADOW_IT_BLOCKED") {
      // Handle violation reports from content scripts
      (async () => {
        const { payload } = message as BlockMessage;

        // 1. Native OS notification (always shown)
        showNativeNotification(payload.site, payload.piiCategories, payload.riskScore);

        // 2. Update daily stats
        if (message.type === "SHADOW_IT_REDACTED" || message.type === "SHADOW_IT_BLOCKED") {
          await incrementStat("blockedCount");
        } else {
          await incrementStat("warnedCount");
        }

        const storage = await getStorage();

        // 3. Immediately log to proxy Vault for redactions
        if (message.type === "SHADOW_IT_REDACTED") {
          try {
            await fetch("https://os.streetmp.com/api/v1/proxy", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${storage.extensionApiKey}`,
              },
              body: JSON.stringify({
                action: "LOG_REDACTION",
                traceId: payload.traceId,
                site: payload.site,
                piiCategories: payload.piiCategories,
                timestamp: payload.timestamp,
                promptHash: payload.promptHash,
              }),
            });
            console.info(`[V94:Worker] Redaction logged to Vault for trace=${payload.traceId}`);
          } catch (err) {
            console.warn(`[V94:Worker] Vault sync failed:`, (err as Error).message);
          }
        } else {
          // Append to trace buffer for kernel flush (WARN / BLOCKED)
          const event: TraceEvent = {
            event_type:     message.type,
            trace_id:       payload.traceId,
            timestamp:      payload.timestamp,
            site:           payload.site,
            pii_categories: payload.piiCategories,
            risk_score:     payload.riskScore,
            prompt_hash:    payload.promptHash,
            url:            payload.url,
          };

          // Cap buffer to prevent storage bloat
          const newBuffer = [...storage.traceBuffer, event].slice(-MAX_TRACE_BUFFER);
          await setStorage({ traceBuffer: newBuffer });
        }

        console.warn(
          `[V94:Worker] ${message.type} logged | ` +
          `site=${payload.site} pii=${payload.piiCategories.join(",")} ` +
          `score=${payload.riskScore} trace=${payload.traceId}`
        );
      })().catch(console.error);

      sendResponse({ ok: true });
      return true;   // Keep message channel open for async
    }

    if (message.type === "STATUS_REQUEST") {
      (async () => {
        const storage  = await getStorage();
        const local    = await chrome.storage.local.get(["kernelConnected", "lastHealthCheckAt"]);
        const today    = new Date().toISOString().split("T")[0];
        const todayStats = storage.stats.date === today
          ? storage.stats
          : { date: today, blockedCount: 0, warnedCount: 0 };

        const response: StatusResponseMessage = {
          type: "STATUS_RESPONSE",
          payload: {
            connected:            !!local.kernelConnected,
            kernelUrl:            storage.kernelUrl || "https://os.streetmp.com",
            complianceFrameworks: storage.complianceFrameworks || ["PDPA", "SOC2"],
            blockedToday:         todayStats.blockedCount,
            warnedToday:          todayStats.warnedCount,
            lastSyncAt:           local.lastHealthCheckAt ?? null,
            extensionVersion:     chrome.runtime.getManifest().version,
          },
        };
        sendResponse(response);
      })().catch(console.error);
      return true;   // Keep channel open
    }
  }
);

// ─── Alarm: Trace Flush + Health Check ───────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_TRACE_FLUSH)   await flushTraceBuffer();
  if (alarm.name === ALARM_HEALTH_CHECK)  await performHealthCheck();
});

// ─── Installation Lifecycle ───────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  console.info(`[V94:Worker] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);

  // Initialize default storage on fresh install
  if (details.reason === "install") {
    await setStorage(DEFAULT_STORAGE);
  }

  // Register persistent alarms (survive service worker restart)
  await chrome.alarms.create(ALARM_TRACE_FLUSH, {
    delayInMinutes:  TRACE_FLUSH_INTERVAL_MIN,
    periodInMinutes: TRACE_FLUSH_INTERVAL_MIN,
  });
  await chrome.alarms.create(ALARM_HEALTH_CHECK, {
    delayInMinutes:  1,
    periodInMinutes: HEALTH_CHECK_INTERVAL_MIN,
  });

  // Initial health check
  await performHealthCheck();

  // Show welcome notification on install
  if (details.reason === "install") {
    chrome.notifications.create({
      type:     "basic",
      iconUrl:  "assets/icon-128.png",
      title:    "StreetMP Security Shield Installed",
      message:  "Zero-Trust AI governance is now active. Your prompts are protected across ChatGPT, Claude, and Gemini.",
      priority: 1,
    });
  }
});

// ─── Startup ──────────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  console.info("[V94:Worker] Browser startup — performing health check.");
  await performHealthCheck();
});

console.info(`[V94:Worker] Service worker initialized — StreetMP Security Shield v${
  chrome.runtime.getManifest().version
}`);
