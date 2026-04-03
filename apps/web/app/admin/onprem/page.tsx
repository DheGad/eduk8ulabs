"use client";

import React, { useState, useRef } from "react";

// ────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────

type Panel = "license" | "keys" | "export";

interface LicenseStatus {
  valid: boolean;
  tenant?: string;
  plan?: string;
  expiresAt?: string;
  hwid?: string;
  error?: string;
}

interface KeyRotationResult {
  success: boolean;
  newKeyFingerprint?: string;
  rotatedAt?: string;
  error?: string;
}

// ────────────────────────────────────────────────────────────────
// SKELETON
// ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded animate-pulse bg-white/5 ${className ?? ""}`}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// PANEL NAV ITEM
// ────────────────────────────────────────────────────────────────
function PanelTab({
  id, label, icon, description, active, onClick,
}: {
  id: Panel; label: string; icon: string; description: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      id={`onprem-tab-${id}`}
      onClick={onClick}
      className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${
        active
          ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_20px_rgba(0,229,153,0.06)]"
          : "bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{icon}</span>
        <div>
          <p className={`text-sm font-semibold ${active ? "text-emerald-300" : "text-white/70"}`}>
            {label}
          </p>
          <p className="text-xs text-white/30 mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────
export default function OnPremAdminPage() {
  const [activePanel, setActivePanel] = useState<Panel>("license");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [keyRotation, setKeyRotation] = useState<KeyRotationResult | null>(null);
  const [keyRotating, setKeyRotating] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── License Upload ─────────────────────────────────────────
  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".blob")) {
      setLicenseStatus({
        valid: false,
        error: "Invalid file type. Expected a .blob file from licensing@streetmp.com.",
      });
      return;
    }

    setLicenseLoading(true);
    setLicenseStatus(null);

    const formData = new FormData();
    formData.append("license", file);

    try {
      const res = await fetch("/api/admin/license/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as LicenseStatus & { success?: boolean };

      if (!res.ok || !data.success) {
        setLicenseStatus({ valid: false, error: data.error ?? "Server error during verification." });
      } else {
        setLicenseStatus({
          valid: true,
          tenant: data.tenant,
          plan: data.plan,
          expiresAt: data.expiresAt,
          hwid: data.hwid,
        });
      }
    } catch {
      setLicenseStatus({
        valid: false,
        error: "Network error: Could not reach the licensing verification service.",
      });
    } finally {
      setLicenseLoading(false);
    }
  };

  // ── Key Rotation ────────────────────────────────────────────
  const handleKeyRotation = async () => {
    setKeyRotating(true);
    setKeyRotation(null);

    try {
      const res = await fetch("/api/admin/keys/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "vault-master" }),
      });
      const data = await res.json() as KeyRotationResult;
      setKeyRotation(data);
    } catch {
      setKeyRotation({ success: false, error: "Network error: Could not reach the key rotation service." });
    } finally {
      setKeyRotating(false);
    }
  };

  // ── Audit Export ─────────────────────────────────────────────
  const handleAuditExport = async () => {
    setExportLoading(true);
    setExportError(null);

    try {
      const res = await fetch("/api/admin/audit/export", { method: "GET" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown export error" })) as { error?: string };
        throw new Error(err.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `streetmp-audit-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setExportError(`Export failed: ${message}. Ensure the audit vault is running and accessible.`);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#050505] text-white p-8"
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-orange-400 tracking-widest uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Offline Admin · Air-Gapped Mode
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Sovereign Datacenter<br />
              <span className="text-white/30">Admin Console</span>
            </h1>
            <p className="text-white/30 text-sm mt-3 max-w-md">
              Manage hardware licensing, rotate local encryption keys, and export Merkle Audit Logs
              for offline compliance review. No internet connection required.
            </p>
          </div>

          {/* SDC Status */}
          <div className="shrink-0 bg-black/40 border border-white/8 rounded-2xl p-5 min-w-[200px]">
            <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">SDC Status</p>
            <div className="space-y-2">
              {[
                { label: "K3s Cluster", status: "UP", color: "emerald" },
                { label: "Local LLM", status: "READY", color: "emerald" },
                { label: "Merkle Vault", status: "SEALED", color: "blue" },
                { label: "Network", status: "AIR-GAPPED", color: "orange" },
              ].map(({ label, status, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-white/40">{label}</span>
                  <span className={`text-${color}-400 font-mono font-bold`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
          {/* Panel navigation */}
          <div className="space-y-2">
            <PanelTab id="license" label="License Manager" icon="🔏"
              description="Upload & verify hardware-bound license"
              active={activePanel === "license"} onClick={() => setActivePanel("license")} />
            <PanelTab id="keys" label="Key Rotation" icon="🔄"
              description="Rotate local AES-256 vault keys"
              active={activePanel === "keys"} onClick={() => setActivePanel("keys")} />
            <PanelTab id="export" label="Audit Export" icon="📦"
              description="Download Merkle logs as encrypted .zip"
              active={activePanel === "export"} onClick={() => setActivePanel("export")} />
          </div>

          {/* Panel content */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-8 min-h-[400px]">

            {/* ── LICENSE PANEL ──────────────────────────────────── */}
            {activePanel === "license" && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Hardware License Verification</h2>
                <p className="text-white/40 text-sm mb-6">
                  Upload your <code className="text-emerald-400 text-xs">license.blob</code> issued
                  by StreetMP licensing. The OS verifies the BIOS UUID + MAC fingerprint against the
                  signed payload.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".blob"
                  className="hidden"
                  onChange={handleLicenseUpload}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-emerald-500/40 rounded-xl p-8 text-center cursor-pointer transition-all mb-6"
                >
                  <div className="text-4xl mb-3">🔏</div>
                  <p className="text-white/60 text-sm font-medium">
                    Click to upload <span className="text-emerald-400">license.blob</span>
                  </p>
                  <p className="text-white/25 text-xs mt-1">Issued by licensing@streetmp.com</p>
                </div>

                {licenseLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                )}

                {licenseStatus && !licenseLoading && (
                  <div className={`rounded-xl border p-5 ${
                    licenseStatus.valid
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : "bg-red-950/20 border-red-500/30"
                  }`}>
                    <p className={`text-sm font-bold mb-3 ${licenseStatus.valid ? "text-emerald-400" : "text-red-400"}`}>
                      {licenseStatus.valid ? "✓ LICENSE VERIFIED — HARDWARE MATCH CONFIRMED" : "✗ LICENSE VERIFICATION FAILED"}
                    </p>
                    {licenseStatus.valid ? (
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex gap-4">
                          <span className="text-white/30 w-24">Tenant</span>
                          <span className="text-white">{licenseStatus.tenant}</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-white/30 w-24">Plan</span>
                          <span className="text-emerald-400 uppercase">{licenseStatus.plan}</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-white/30 w-24">Expires</span>
                          <span className="text-white">{licenseStatus.expiresAt}</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-white/30 w-24">HWID</span>
                          <span className="text-white/60 truncate">{licenseStatus.hwid?.slice(0, 24)}...</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-300 text-xs font-mono">{licenseStatus.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── KEY ROTATION PANEL ────────────────────────────── */}
            {activePanel === "keys" && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Vault Key Rotation</h2>
                <p className="text-white/40 text-sm mb-6">
                  Rotate the AES-256 master key used by the V47 Vault. The system will re-seal all
                  tenant secrets under the new key. All services remain available during rotation.
                </p>

                <div className="bg-orange-950/15 border border-orange-500/20 rounded-xl p-4 mb-6">
                  <p className="text-orange-400 text-xs font-semibold mb-1">⚠ Before you proceed</p>
                  <p className="text-white/40 text-xs leading-relaxed">
                    Key rotation is irreversible. Ensure you have a recent backup of the Merkle Audit
                    Log before proceeding. All active API sessions will require re-authentication.
                  </p>
                </div>

                <button
                  id="onprem-rotate-keys"
                  onClick={handleKeyRotation}
                  disabled={keyRotating}
                  className="px-6 py-3 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-sm rounded-xl hover:bg-orange-500/20 hover:border-orange-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
                >
                  {keyRotating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                      Rotating keys...
                    </span>
                  ) : "🔄 Initiate Key Rotation"}
                </button>

                {keyRotating && (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}

                {keyRotation && !keyRotating && (
                  <div className={`rounded-xl border p-5 ${
                    keyRotation.success
                      ? "bg-emerald-950/15 border-emerald-500/30"
                      : "bg-red-950/15 border-red-500/30"
                  }`}>
                    <p className={`text-sm font-bold mb-3 ${keyRotation.success ? "text-emerald-400" : "text-red-400"}`}>
                      {keyRotation.success ? "✓ KEY ROTATION COMPLETE" : "✗ KEY ROTATION FAILED"}
                    </p>
                    {keyRotation.success ? (
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex gap-4">
                          <span className="text-white/30 w-28">New Fingerprint</span>
                          <span className="text-emerald-400">{keyRotation.newKeyFingerprint}</span>
                        </div>
                        <div className="flex gap-4">
                          <span className="text-white/30 w-28">Rotated At</span>
                          <span className="text-white">{keyRotation.rotatedAt}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-red-300 text-xs font-mono">{keyRotation.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIT EXPORT PANEL ─────────────────────────────── */}
            {activePanel === "export" && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Merkle Audit Log Export</h2>
                <p className="text-white/40 text-sm mb-6">
                  Download the complete V35 Merkle Audit Vault as an encrypted, compliance-ready
                  <code className="text-emerald-400 text-xs mx-1">.zip</code>
                  for offline regulatory review. Each log entry is cryptographically chained.
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: "Log Entries", value: "—", note: "Since last export" },
                    { label: "Merkle Root", value: "0x4a2f...", note: "Current chain tip" },
                    { label: "Integrity", value: "✓ Valid", note: "SHA-256 chain" },
                  ].map(({ label, value, note }) => (
                    <div key={label} className="bg-black/30 border border-white/8 rounded-xl p-4">
                      <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-base font-bold font-mono text-white">{value}</p>
                      <p className="text-xs text-white/20 mt-0.5">{note}</p>
                    </div>
                  ))}
                </div>

                <button
                  id="onprem-export-audit"
                  onClick={handleAuditExport}
                  disabled={exportLoading}
                  className="px-6 py-3 bg-blue-950/30 border border-blue-500/30 text-blue-400 font-bold text-sm rounded-xl hover:bg-blue-950/50 hover:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      Compiling audit export...
                    </span>
                  ) : "📦 Download Audit .zip"}
                </button>

                {exportError && !exportLoading && (
                  <div className="mt-4 bg-red-950/20 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 text-xs font-mono">{exportError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
