"use client";

/**
 * @file global-error.tsx
 * @description Self-healing Next.js global error boundary.
 *
 * ChunkLoadError (stale JS bundles after deploy) → silent auto-reload.
 * All other errors → branded fallback UI with Try Again button.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    error.message.includes("Loading chunk") ||
    error.message.includes("dynamically imported module") ||
    error.message.includes("Failed to fetch dynamically")
  );
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // ── ChunkLoadError: silent self-heal ──────────────────────────────
    if (isChunkLoadError(error)) {
      // Avoid infinite reload loops: only reload once per session key
      const RELOAD_KEY = "chunk_reload_v1";
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);

      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return;
      }
      // If we already reloaded and still crashing → fall through to UI
    }

    // ── All other errors: report to Sentry ───────────────────────────
    Sentry.captureException(error, {
      tags: { boundary: "global-root", layer: "layout" },
      extra: { digest: error.digest },
    });
  }, [error]);

  // While reload is in-flight, render nothing (user sees current page)
  if (isChunkLoadError(error) && typeof sessionStorage !== "undefined") {
    const alreadyReloaded = sessionStorage.getItem("chunk_reload_v1");
    if (!alreadyReloaded) {
      return (
        <html lang="en">
          <head><title>StreetMP OS</title></head>
          <body style={{ margin: 0, background: "#050507" }} />
        </html>
      );
    }
  }

  // ── Fallback error UI ─────────────────────────────────────────────
  return (
    <html lang="en">
      <head>
        <title>System Error — StreetMP OS</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#050507",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#e8e8e8",
        }}
      >
        <div style={{ maxWidth: 480, width: "100%", padding: "0 24px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid rgba(16,185,129,0.25)",
                background: "rgba(16,185,129,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  background: "rgba(16,185,129,0.7)",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.02em",
              }}
            >
              StreetMP OS
            </span>
          </div>

          {/* Error card */}
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "#0d0d10",
              padding: "28px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                ⚠
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(239,68,68,0.6)",
                    marginBottom: 2,
                  }}
                >
                  System Error
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
                  The application encountered a critical error
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {error.message || "An unexpected error caused the application shell to crash."}
              {error.digest && (
                <span
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.2)",
                  }}
                >
                  Digest: {error.digest}
                </span>
              )}
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  sessionStorage.removeItem("chunk_reload_v1");
                  reset();
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid rgba(16,185,129,0.3)",
                  background: "rgba(16,185,129,0.1)",
                  color: "rgb(52,211,153)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Try Again
              </button>
              <a
                href="/dashboard"
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  fontFamily: "inherit",
                }}
              >
                ← Return to Workspace
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
