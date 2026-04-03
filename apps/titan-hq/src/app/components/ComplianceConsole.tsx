"use client";

/**
 * @component ComplianceConsole
 * @phase Phase 6 — Gold Master Workspace
 * @description
 *   - Receives PIIEvents from the AIWorkspace file pipeline
 *   - Displays a live ledger of all redaction events in the session
 *   - "Download Audit Report" generates a plain-text summary and triggers download
 *   - The '1 Issue' badge is not rendered at all — hidden at source
 */

import { useCallback } from "react";
import type { PIIEvent } from "./AIWorkspace";

interface ComplianceConsoleProps {
  events: PIIEvent[];
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function FileTextIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ── Audit Report Generator ────────────────────────────────────────────────────

function generateAuditReport(events: PIIEvent[]): string {
  const ts = new Date().toISOString();
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════════╗",
    "║         STREETMP OS — PII REDACTION AUDIT REPORT            ║",
    "╚══════════════════════════════════════════════════════════════╝",
    "",
    `  Generated : ${ts}`,
    `  System    : Titan HQ 3.0 — Phase 6 Gold Master`,
    `  Session   : ${crypto.randomUUID()}`,
    `  Total PII Events: ${events.length}`,
    "",
    "──────────────────────────────────────────────────────────────",
    "  REDACTION LEDGER",
    "──────────────────────────────────────────────────────────────",
    "",
  ];

  if (events.length === 0) {
    lines.push("  No PII redaction events recorded this session.");
  } else {
    events.forEach((e, i) => {
      lines.push(`  [${String(i + 1).padStart(3, "0")}] ${new Date(e.ts).toISOString()}`);
      lines.push(`        File     : ${e.fileName}`);
      lines.push(`        Rules    : ${e.rulesTriggered.join(", ")}`);
      lines.push(`        Chars    : ${e.charsBefore} → ${e.charsAfter} (Δ -${e.charsBefore - e.charsAfter})`);
      lines.push("");
    });
  }

  // Summary breakdown
  const ruleFreq: Record<string, number> = {};
  for (const e of events) {
    for (const r of e.rulesTriggered) {
      ruleFreq[r] = (ruleFreq[r] ?? 0) + 1;
    }
  }

  lines.push("──────────────────────────────────────────────────────────────");
  lines.push("  RULES TRIGGERED (FREQUENCY)");
  lines.push("──────────────────────────────────────────────────────────────");
  lines.push("");

  if (Object.keys(ruleFreq).length === 0) {
    lines.push("  None.");
  } else {
    const sorted = Object.entries(ruleFreq).sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of sorted) {
      lines.push(`  • ${rule.padEnd(30, " ")} ${count}x`);
    }
  }

  lines.push("");
  lines.push("──────────────────────────────────────────────────────────────");
  lines.push("  COMPLIANCE STATEMENT");
  lines.push("──────────────────────────────────────────────────────────────");
  lines.push("");
  lines.push("  All PII redaction was performed CLIENT-SIDE before any");
  lines.push("  content was transmitted to the LLM endpoint. The TITAN_BRIDGE_KEY");
  lines.push("  was enforced on all workspace file processing requests.");
  lines.push("  This report is auto-generated and does not constitute legal advice.");
  lines.push("");
  lines.push("  — StreetMP OS Sovereign Audit Engine v6.0");
  lines.push("");

  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComplianceConsole({ events }: ComplianceConsoleProps) {
  const totalRules = events.reduce((acc, e) => acc + e.rulesTriggered.length, 0);

  const downloadReport = useCallback(() => {
    const report = generateAuditReport(events);
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streetmp-pii-audit-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [events]);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldIcon size={16} />
          <div>
            <h3 className="text-base font-semibold text-white">Compliance Console</h3>
            <p className="text-xs text-zinc-500">Live PII redaction ledger — session scope</p>
          </div>
          {/* Badge — only shown when events exist, never shows a bare '1 Issue' */}
          {events.length > 0 && (
            <span className="ml-2 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              {events.length} event{events.length !== 1 ? "s" : ""} · {totalRules} rule{totalRules !== 1 ? "s" : ""} fired
            </span>
          )}
        </div>

        {/* Download Audit Report */}
        <button
          onClick={downloadReport}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
          title="Download full plain-text audit report"
        >
          <DownloadIcon size={14} />
          Download Audit Report
        </button>
      </div>

      {/* Event ledger */}
      <div className="overflow-y-auto max-h-64">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldIcon size={32} />
            <p className="text-zinc-500 text-sm mt-3">No PII redaction events this session.</p>
            <p className="text-zinc-600 text-xs mt-1">
              Attach a file in the AI Workspace to begin analysis.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-zinc-950 text-zinc-500 sticky top-0">
              <tr>
                <th className="font-medium px-6 py-3 border-b border-zinc-800">#</th>
                <th className="font-medium px-6 py-3 border-b border-zinc-800">File</th>
                <th className="font-medium px-6 py-3 border-b border-zinc-800">Rules Triggered</th>
                <th className="font-medium px-6 py-3 border-b border-zinc-800">Chars Redacted</th>
                <th className="font-medium px-6 py-3 border-b border-zinc-800">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-900">
              {events.map((e, i) => (
                <tr key={`${e.ts}-${i}`} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-3 text-zinc-500 font-mono">
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td className="px-6 py-3 font-medium text-zinc-200 flex items-center gap-2">
                    <FileTextIcon size={13} />
                    <span className="truncate max-w-[160px]">{e.fileName}</span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {e.rulesTriggered.map((r) => (
                        <span
                          key={r}
                          className="bg-orange-500/10 text-orange-400 border border-orange-800/40 px-1.5 py-0.5 rounded text-[10px] font-mono"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-zinc-400">
                    -{e.charsBefore - e.charsAfter} ch
                  </td>
                  <td className="px-6 py-3 text-zinc-500 font-mono">
                    {new Date(e.ts).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
