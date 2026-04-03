/**
 * @file Popup.tsx
 * @module StreetMP Extension — Browser Action Popup
 * @command COMMAND_094 — THE ZERO-TRUST BROWSER EXTENSION
 * @version V94.0.0
 *
 * ================================================================
 * THE SOVEREIGN SHIELD POPUP
 * ================================================================
 *
 * A premium, minimal React UI that appears when the user clicks
 * the extension icon. Displays:
 *
 *   • Real-time kernel connection status (green/red pulsing dot)
 *   • Active compliance frameworks (V85 APAC / SOC2 / GDPR)
 *   • Today's block and warn counters
 *   • Quick toggle to enable/disable PII blocking
 *   • CTA to open the Sovereign Workspace
 *
 * Design: 100% #0A0A0A glassmorphism, emerald (#00E599) accent,
 *         system-ui font, no external style dependencies.
 *
 * ================================================================
 */

import React, { useEffect, useState, useCallback } from "react";
import type { StatusResponseMessage } from "../shared/messages";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PopupState {
  connected:            boolean;
  kernelUrl:            string;
  complianceFrameworks: string[];
  blockedToday:         number;
  warnedToday:          number;
  lastSyncAt:           string | null;
  extensionVersion:     string;
  blockingEnabled:      boolean;
  loading:              boolean;
  extensionApiKey?:     string;
}

// ─── Inline Styles (no external CSS dependency in the popup) ──────────────────
const S = {
  root: {
    width:          "320px",
    minHeight:      "420px",
    background:     "#0A0A0A",
    fontFamily:     "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    color:          "#FFFFFF",
    padding:        "0",
    overflow:       "hidden",
  } as React.CSSProperties,

  header: {
    background:    "linear-gradient(135deg,rgba(0,229,153,0.08),rgba(0,229,153,0.03))",
    borderBottom:  "1px solid rgba(0,229,153,0.15)",
    padding:       "16px 18px 14px",
    display:       "flex",
    alignItems:    "center",
    gap:           "10px",
  } as React.CSSProperties,

  body: {
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  } as React.CSSProperties,

  card: (highlight = false): React.CSSProperties => ({
    background:    highlight ? "rgba(0,229,153,0.06)" : "rgba(255,255,255,0.03)",
    border:        `1px solid ${highlight ? "rgba(0,229,153,0.2)" : "rgba(255,255,255,0.06)"}`,
    borderRadius:  "10px",
    padding:       "10px 12px",
  }),

  label: {
    fontSize:    "10px",
    fontWeight:  "600",
    letterSpacing: "0.08em",
    color:       "rgba(255,255,255,0.35)",
    textTransform: "uppercase" as const,
    marginBottom: "4px",
  } as React.CSSProperties,

  statRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    gap:            "8px",
  } as React.CSSProperties,

  badge: (color: string): React.CSSProperties => ({
    background:   `rgba(${color},0.12)`,
    border:       `1px solid rgba(${color},0.25)`,
    borderRadius: "20px",
    padding:      "2px 9px",
    fontSize:     "11px",
    fontWeight:   "700",
    color:        `rgb(${color})`,
  }),

  toggle: (on: boolean): React.CSSProperties => ({
    width:        "38px",
    height:       "22px",
    borderRadius: "11px",
    background:   on ? "linear-gradient(135deg,#00E599,#00b077)" : "rgba(255,255,255,0.1)",
    border:       "none",
    cursor:       "pointer",
    position:     "relative",
    transition:   "background 0.2s",
    flexShrink:   0,
  }),

  toggleKnob: (on: boolean): React.CSSProperties => ({
    position:   "absolute",
    top:        "3px",
    left:       on ? "19px" : "3px",
    width:      "16px",
    height:     "16px",
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    boxShadow:  "0 1px 4px rgba(0,0,0,0.4)",
  }),

  ctaButton: {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             "6px",
    width:           "100%",
    padding:         "10px 0",
    background:      "linear-gradient(135deg,#00E599,#00b077)",
    border:          "none",
    borderRadius:    "10px",
    color:           "#000",
    fontSize:        "13px",
    fontWeight:      "700",
    cursor:          "pointer",
    textDecoration:  "none",
    marginTop:       "4px",
    boxShadow:       "0 0 20px rgba(0,229,153,0.25)",
    transition:      "box-shadow 0.2s, transform 0.15s",
  } as React.CSSProperties,

  dot: (on: boolean): React.CSSProperties => ({
    width:        "8px",
    height:       "8px",
    borderRadius: "50%",
    background:   on ? "#00E599" : "#FF4444",
    boxShadow:    on ? "0 0 8px rgba(0,229,153,0.8)" : "0 0 8px rgba(255,68,68,0.6)",
    flexShrink:   0,
    animation:    "pulse 2s infinite",
  }),

  footer: {
    borderTop:  "1px solid rgba(255,255,255,0.05)",
    padding:    "8px 18px",
    fontSize:   "10px",
    color:      "rgba(255,255,255,0.2)",
    display:    "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  authContainer: {
    padding: "24px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  authInput: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(0,229,153,0.3)",
    color: "#fff",
    fontFamily: "monospace",
    fontSize: "12px",
    outline: "none",
  } as React.CSSProperties,
} as const;

// ─── Popup Component ──────────────────────────────────────────────────────────
export default function Popup(): React.ReactElement {
  const [state, setState] = useState<PopupState>({
    connected:            false,
    kernelUrl:            "https://os.streetmp.com",
    complianceFrameworks: ["PDPA", "SOC2"],
    blockedToday:         0,
    warnedToday:          0,
    lastSyncAt:           null,
    extensionVersion:     "94.0.0",
    blockingEnabled:      true,
    loading:              true,
  });

  // ─── Load status from background service worker ──────────────────────────
  const refresh = useCallback(async () => {
    try {
      // Get blocking preference and API key from storage
      const stored = await chrome.storage.sync.get(["blockingEnabled", "extensionApiKey"]);
      const blockingEnabled = stored.blockingEnabled !== false;
      const extensionApiKey = stored.extensionApiKey || "";

      // Request status from service worker
      const response = await chrome.runtime.sendMessage<
        { type: "STATUS_REQUEST" },
        StatusResponseMessage
      >({ type: "STATUS_REQUEST" });

      if (response?.type === "STATUS_RESPONSE") {
        setState((prev) => ({
          ...prev,
          ...response.payload,
          blockingEnabled,
          extensionApiKey,
          loading: false,
        }));
      }
    } catch {
      // Even if background is asleep, we can still load auth state
      const stored = await chrome.storage.sync.get("extensionApiKey");
      setState((prev) => ({ ...prev, extensionApiKey: stored.extensionApiKey || "", loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 15s while popup is open
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // ─── Toggle blocking ─────────────────────────────────────────────────────
  const toggleBlocking = useCallback(async () => {
    const newValue = !state.blockingEnabled;
    setState((prev) => ({ ...prev, blockingEnabled: newValue }));
    await chrome.storage.sync.set({ blockingEnabled: newValue });

    // Notify all content scripts
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type:    "SETTINGS_UPDATE",
          payload: { blockingEnabled: newValue },
        }).catch(() => undefined);
      }
    }
  }, [state.blockingEnabled]);

  const formatTime = (iso: string | null): string => {
    if (!iso) return "Never";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  };

  if (state.loading) {
    return (
      <div style={{ ...S.root, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
        <div style={{ color: "#00E599", fontSize: "12px" }}>Loading…</div>
      </div>
    );
  }

  const handleSaveToken = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = new FormData(e.currentTarget).get("token") as string;
    if (!token) return;
    await chrome.storage.sync.set({ extensionApiKey: token });
    setState((prev) => ({ ...prev, extensionApiKey: token }));
    refresh();
  };

  return (
    <div style={S.root}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={S.header}>
        {/* Shield Icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 1.5L3 5.25V11.25C3 16.35 6.975 21.105 12 22.5C17.025 21.105 21 16.35 21 11.25V5.25L12 1.5Z"
            fill="rgba(0,229,153,0.15)" stroke="#00E599" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 12L11 14L15 10" stroke="#00E599" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "0.01em" }}>
            StreetMP Security Shield
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "1px" }}>
            Zero-Trust AI Governance · V94
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {!state.extensionApiKey ? (
        <form style={S.authContainer} onSubmit={handleSaveToken}>
          <div style={{ marginBottom: "8px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "12px" }}>
              <path d="M12 1.5L3 5.25V11.25C3 16.35 6.975 21.105 12 22.5C17.025 21.105 21 16.35 21 11.25V5.25L12 1.5Z"
                fill="rgba(0,229,153,0.15)" stroke="#00E599" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 8V12M12 16H12.01" stroke="#00E599" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: "16px", fontWeight: "700" }}>Authentication Required</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>
              You are not registered with a StreetMP OS tenant.
            </div>
          </div>
          <input 
            name="token" 
            type="password" 
            placeholder="Paste your Tenant Key (sk-...)" 
            style={S.authInput} 
            autoFocus 
          />
          <button type="submit" style={S.ctaButton}>Connect Shield</button>
        </form>
      ) : (
        <div style={S.body}>
          {/* Connection Status */}
        <div style={S.card(state.connected)}>
          <div style={S.label}>Kernel Connection</div>
          <div style={S.statRow}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={S.dot(state.connected)} />
              <span style={{ fontSize: "13px", fontWeight: "600" }}>
                {state.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {state.kernelUrl.replace("https://", "")}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "5px" }}>
            Last sync: {formatTime(state.lastSyncAt)}
          </div>
        </div>

        {/* Compliance Frameworks */}
        <div style={S.card(false)}>
          <div style={S.label}>Active Compliance Frameworks</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
            {state.complianceFrameworks.map((fw) => (
              <span key={fw} style={S.badge("0,229,153")}>
                {fw}
              </span>
            ))}
          </div>
        </div>

        {/* Daily Stats */}
        <div style={S.card(false)}>
          <div style={S.label}>Today's Activity</div>
          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.15)", borderRadius: "8px", padding: "8px 4px" }}>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#FF4444", lineHeight: 1 }}>
                {state.blockedToday}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>
                BLOCKED
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.15)", borderRadius: "8px", padding: "8px 4px" }}>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#FFA500", lineHeight: 1 }}>
                {state.warnedToday}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>
                WARNED
              </div>
            </div>
          </div>
        </div>

        {/* Blocking Toggle */}
        <div style={{ ...S.card(false), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "600" }}>PII Interception</div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
              {state.blockingEnabled ? "Actively blocking sensitive prompts" : "Monitoring only"}
            </div>
          </div>
          <button
            id="streetmp-blocking-toggle"
            onClick={toggleBlocking}
            style={S.toggle(state.blockingEnabled)}
            aria-label={state.blockingEnabled ? "Disable PII blocking" : "Enable PII blocking"}
          >
            <div style={S.toggleKnob(state.blockingEnabled)} />
          </button>
        </div>

        {/* CTA */}
        <a
          id="streetmp-open-workspace"
          href="https://os.streetmp.com/dashboard/workspace"
          target="_blank"
          rel="noopener noreferrer"
          style={S.ctaButton}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 1.5L3 5.25V11.25C3 16.35 6.975 21.105 12 22.5C17.025 21.105 21 16.35 21 11.25V5.25L12 1.5Z"
              stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          Open Sovereign Workspace
        </a>
      </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={S.footer}>
        <span>© 2026 StreetMP, Inc.</span>
        <span>v{state.extensionVersion}</span>
      </div>
    </div>
  );
}
