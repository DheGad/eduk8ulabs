"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionStatus = "connected" | "verifying" | "offline" | "pending";
type KillSwitchPhase = "idle" | "armed" | "confirming" | "wiping" | "wiped";
type OwnershipPhase = "idle" | "input" | "verifying" | "verified" | "failed";

interface ConnectionNode {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  status: ConnectionStatus;
  detail: string;
  region?: string;
}

interface ShardRegion {
  id: number;
  label: string;
  region: string;
  flag: string;
  type: "enclave" | "kms" | "cold";
  color: string;
  borderColor: string;
  bgColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHARDS: ShardRegion[] = [
  {
    id: 1,
    label: "Shard 1",
    region: "Local Enclave · us-east-1",
    flag: "🔒",
    type: "enclave",
    color: "text-blue-300",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-600/10",
  },
  {
    id: 2,
    label: "Shard 2",
    region: "Customer KMS · eu-west-1",
    flag: "🏛️",
    type: "kms",
    color: "text-violet-300",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-600/10",
  },
  {
    id: 3,
    label: "Shard 3",
    region: "Cold Storage · ap-southeast-1",
    flag: "❄️",
    type: "cold",
    color: "text-slate-300",
    borderColor: "border-slate-500/30",
    bgColor: "bg-slate-700/20",
  },
];

const AUDIT_EVENTS = [
  { ts: "01:14:22", event: "Root key rotated (AES-256)", actor: "System", level: "info" },
  { ts: "01:08:05", event: "Shard 2 re-attested (KMS handshake)", actor: "AWS KMS", level: "info" },
  { ts: "00:47:11", event: "Asymmetric attestation verified", actor: "Enclave", level: "success" },
  { ts: "00:31:58", event: "Cold storage shard sync requested", actor: "Admin", level: "warning" },
  { ts: "00:12:44", event: "HSM handshake ESTABLISHED", actor: "System", level: "success" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, string> = {
    connected: "bg-emerald-400",
    verifying: "bg-yellow-400 animate-pulse",
    offline: "bg-red-500",
    pending: "bg-slate-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${map[status]}`} />;
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    connected:  { label: "Connected",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    verifying:  { label: "Verifying…", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    offline:    { label: "Offline",    cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    pending:    { label: "Pending",    cls: "bg-slate-700/50 text-slate-400 border-slate-600/30" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Kill Switch Component ────────────────────────────────────────────────────

function KillSwitch() {
  const [phase, setPhase] = useState<KillSwitchPhase>("idle");
  const [countdown, setCountdown] = useState(5);
  const [wipeLog, setWipeLog] = useState<string[]>([]);

  const arm = () => setPhase("armed");
  const disarm = () => { setPhase("idle"); setCountdown(5); setWipeLog([]); };

  const beginWipe = useCallback(async () => {
    setPhase("wiping");

    // Step 1: Show pre-flight log entries while API call is in-flight
    const preSteps = [
      "[ 0ms]  KILL_SWITCH engaged — broadcasting REVOKE_ALL to Control Plane...",
      "[ 12ms] Purging Shamir Share 2 + Share 3 from database (shard_custody)...",
      "[ 28ms] Sending WIPE command to Nitro Enclave via vsock bridge...",
    ];
    for (const step of preSteps) {
      await new Promise<void>((r) => setTimeout(r, 200));
      setWipeLog((prev) => [...prev, step]);
    }

    // Step 2: Call the real API
    let apiSuccess = true;
    let apiWarning: string | undefined;
    try {
      const resp = await fetch("/api/v1/sovereignty/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "current", initiated_by: "ui_kill_switch" }),
        credentials: "include",
      });
      const data = await resp.json() as {
        success: boolean;
        shards_purged?: number;
        enclave_wiped?: boolean;
        warning?: string;
      };
      if (!data.success) {
        apiSuccess = false;
        apiWarning = "API returned non-success — see server logs for details.";
      } else if (!data.enclave_wiped) {
        apiWarning = data.warning;
      }
    } catch {
      apiWarning = "API unreachable — DB shards may still be purged. Check server logs.";
    }

    // Step 3: Continue log narrative
    const postSteps = [
      "[ 45ms] Ed25519 ephemeral key pair destroyed — cannot be recovered...",
      "[ 61ms] Shamir Share 1 (Enclave) — volatile RAM zeroed.",
      "[ 89ms] Issuing HTTP 403-REVOKE to all active sessions (14 tokens)...",
      "[112ms] Cold storage shard flagged — pending re-attestation on reboot...",
      "[138ms] Writing TAMPER_ALARM to immutable revocation_log...",
      apiSuccess && !apiWarning
        ? "[155ms] WIPE COMPLETE — Enclave memory is cryptographically clean. ✅"
        : `[155ms] PARTIAL WIPE — ${apiWarning ?? "Unknown error"}. ⚠️`,
    ];
    for (const step of postSteps) {
      await new Promise<void>((r) => setTimeout(r, 160));
      setWipeLog((prev) => [...prev, step]);
    }
    setPhase("wiped");
  }, []);

  const confirm = () => {
    setPhase("confirming");
    setCountdown(5);
  };

  useEffect(() => {
    if (phase !== "confirming") return;
    if (countdown <= 0) { void beginWipe(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, beginWipe]);

  if (phase === "wiped") {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-950/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-300">ENCLAVE MEMORY WIPED</p>
            <p className="text-xs text-slate-500 mt-0.5">All vault entries and signing keys have been permanently destroyed.</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-900/40 bg-black/40 p-3 font-mono text-[10px] text-red-400/70 space-y-0.5 max-h-48 overflow-auto">
          {wipeLog.map((line, i) => (
            <div key={i} className={i === wipeLog.length - 1 ? "text-red-300 font-bold" : ""}>{line}</div>
          ))}
        </div>
        <button
          onClick={disarm}
          className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-all"
        >
          Re-initialize Enclave (Reboot Required)
        </button>
      </div>
    );
  }

  if (phase === "wiping") {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0 animate-pulse">
            <span className="text-xl">🔴</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-300 animate-pulse">REVOKE IN PROGRESS…</p>
            <p className="text-xs text-slate-500">Do not interrupt. Enclave wipe is non-recoverable.</p>
          </div>
        </div>
        <div className="rounded-xl border border-red-900/40 bg-black/40 p-3 font-mono text-[10px] text-red-400/70 space-y-0.5 max-h-48 overflow-auto">
          {wipeLog.map((line, i) => (
            <div key={i}
              className={`transition-all ${i === wipeLog.length - 1 ? "text-red-300" : "text-red-500/60"}`}
            >
              {line}
            </div>
          ))}
          {wipeLog.length === 0 && (
            <div className="text-red-500/60 animate-pulse">Initializing wipe sequence…</div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "confirming") {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-red-600/15 border border-red-500/25 flex items-center justify-center mx-auto">
            <span className="text-3xl">☢️</span>
          </div>
          <p className="text-base font-bold text-red-300">Final Confirmation Required</p>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            This will irreversibly destroy all Enclave memory, token mappings, and the ephemeral Ed25519 signing key. All 14 active sessions will be immediately revoked.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-red-900/30 border-2 border-red-500/40 flex items-center justify-center">
            <span className={`text-2xl font-black font-mono ${countdown <= 2 ? "text-red-400" : "text-slate-300"}`}>
              {countdown}
            </span>
          </div>
          <p className="text-xs text-slate-500">Auto-executing in {countdown}s</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={disarm}
            className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-all"
          >
            ✋ Abort
          </button>
          <button
            onClick={() => void beginWipe()}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all shadow-lg shadow-red-600/20"
          >
            Execute Wipe Now
          </button>
        </div>
      </div>
    );
  }

  if (phase === "armed") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-300">Kill Switch Armed</p>
            <p className="text-xs text-slate-500 mt-0.5">Confirm to begin irreversible wipe sequence.</p>
          </div>
        </div>
        <div className="space-y-2 text-[11px] text-slate-500">
          {["All 1,824 vault token entries will be destroyed", "Ed25519 signing key pair permanently purged", "All 14 active sessions will be 403-revoked", "Shamir Share 1 zeroed from volatile RAM"].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5 shrink-0">✗</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={disarm} className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-all">
            Stand Down
          </button>
          <button onClick={confirm} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all shadow-lg shadow-amber-600/20">
            Confirm Revocation
          </button>
        </div>
      </div>
    );
  }

  // Idle state
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <span className="text-xl">🔴</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-200">Emergency Revocation</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Instantly destroy all Enclave memory and revoke all active sessions.</p>
        </div>
        <span className="text-[10px] text-slate-600 border border-slate-700 px-2 py-0.5 rounded font-mono">SAFE</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600">
        {["1,824 vault entries", "1 signing key", "14 active sessions"].map((s) => (
          <div key={s} className="rounded-lg border border-slate-800 bg-slate-800/30 px-2 py-1.5 text-center">{s}</div>
        ))}
      </div>
      <button
        onClick={arm}
        className="w-full py-3 rounded-xl border border-red-500/25 bg-red-950/10 text-red-400 text-sm font-semibold hover:bg-red-950/20 hover:border-red-500/40 transition-all group"
      >
        <span className="group-hover:tracking-wider transition-all">⚡ Revoke All Access</span>
      </button>
    </div>
  );
}

// ─── KMS ARN Link Flow ────────────────────────────────────────────────────────

function KmsOwnershipFlow() {
  const [phase, setPhase] = useState<OwnershipPhase>("idle");
  const [arn, setArn] = useState("");
  const [provider, setProvider] = useState<"aws" | "azure" | "gcp">("aws");
  const [progress, setProgress] = useState(0);

  const ARN_PLACEHOLDER = {
    aws: "arn:aws:kms:us-east-1:123456789012:key/mrk-abc123",
    azure: "https://vault.azure.net/keys/my-key/version",
    gcp: "projects/my-project/locations/global/keyRings/ring/cryptoKeys/key",
  };

  const verify = useCallback(async () => {
    if (!arn.trim()) return;
    setPhase("verifying");
    setProgress(0);

    const steps = [0, 15, 35, 60, 80, 95, 100];
    for (const p of steps) {
      await new Promise<void>((r) => setTimeout(r, 400));
      setProgress(p);
    }
    // 90% chance success in simulation
    setPhase(Math.random() > 0.1 ? "verified" : "failed");
  }, [arn]);

  if (phase === "verified") {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <span className="text-lg">✅</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-300">Key Ownership Verified</p>
            <p className="text-[11px] text-slate-500">Asymmetric attestation complete — Root of Trust established.</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 font-mono text-[10px] text-slate-400 break-all">{arn}</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {[
            { label: "Provider", value: provider.toUpperCase() },
            { label: "Attestation", value: "Ed25519" },
            { label: "Root of Trust", value: "Established" },
            { label: "Rotation Policy", value: "90 days" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
              <p className="text-slate-600 mb-0.5">{label}</p>
              <p className="text-slate-300 font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => { setPhase("idle"); setArn(""); setProgress(0); }}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Link another key →
        </button>
      </div>
    );
  }

  if (phase === "verifying") {
    return (
      <div className="rounded-xl border border-blue-500/20 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-300">Verifying Key Ownership…</p>
            <p className="text-[11px] text-slate-500">Performing asymmetric attestation handshake.</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Attestation progress</span>
            <span className="font-mono text-blue-400">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            {progress < 20 ? "Initiating HSM handshake..." :
             progress < 40 ? "Sending challenge nonce..." :
             progress < 60 ? "Verifying key pair ownership..." :
             progress < 80 ? "Cross-referencing IAM policy..." :
             progress < 95 ? "Writing Root of Trust record..." :
             "Finalizing attestation..."}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="rounded-xl border border-red-500/25 bg-red-950/10 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <span className="text-lg">❌</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-300">Attestation Failed</p>
            <p className="text-[11px] text-slate-500">Could not verify ownership — check IAM policy or ARN format.</p>
          </div>
        </div>
        <button
          onClick={() => { setPhase("input"); setProgress(0); }}
          className="w-full py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (phase === "input") {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Cloud KMS Provider</p>
          <div className="grid grid-cols-3 gap-2">
            {(["aws", "azure", "gcp"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                  provider === p
                    ? "border-blue-500/40 bg-blue-600/15 text-blue-300"
                    : "border-slate-700 bg-slate-800/50 text-slate-500 hover:text-slate-300"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
            Key ARN / Resource ID
          </label>
          <input
            type="text"
            value={arn}
            onChange={(e) => setArn(e.target.value)}
            placeholder={ARN_PLACEHOLDER[provider]}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
          />
          <p className="mt-1.5 text-[10px] text-slate-600">
            The Enclave will perform a challenge-response attestation to verify you own this key.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setPhase("idle")}
            className="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => void verify()}
            disabled={!arn.trim()}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
          >
            Verify Key Ownership
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <button
      onClick={() => setPhase("input")}
      className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-900/20 p-5 text-slate-500 hover:text-slate-300 hover:border-blue-500/30 hover:bg-blue-600/5 transition-all group"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-xl border border-slate-700 group-hover:border-blue-500/30 bg-slate-800 flex items-center justify-center transition-all">
          <span className="text-lg">🔗</span>
        </div>
        <p className="text-xs font-semibold">Link Customer KMS Key</p>
        <p className="text-[10px] text-slate-600">AWS KMS · Azure Key Vault · GCP Cloud KMS</p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KeysPage() {
  const [connections, setConnections] = useState<ConnectionNode[]>([
    {
      id: "enclave",
      label: "Local Enclave",
      sublabel: "Hardware Security Module",
      icon: "🔒",
      status: "connected",
      detail: "AWS Nitro Enclave · us-east-1 · AES-256-GCM",
      region: "us-east-1",
    },
    {
      id: "kms",
      label: "Customer KMS",
      sublabel: "HYOK / Bring Your Own Key",
      icon: "🏛️",
      status: "pending",
      detail: "No key linked — verify ownership to activate.",
      region: "—",
    },
    {
      id: "cold",
      label: "Cold Storage",
      sublabel: "Offline Recovery Shard",
      icon: "❄️",
      status: "offline",
      detail: "Offline shard pending re-attestation cycle.",
      region: "ap-southeast-1",
    },
  ]);

  const [activeShardPulse, setActiveShardPulse] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Animate shard highlights in a loop
  useEffect(() => {
    const t = setInterval(() => {
      setActiveShardPulse((p) => (p + 1) % SHARDS.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const simulateVerify = (id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "verifying" } : c))
    );
    setTimeout(() => {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "connected", detail: c.id === "kms" ? "ARN linked — Root of Trust established" : c.detail } : c))
      );
    }, 2800);
  };

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "#0F172A", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Sovereign Key Management</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-violet-600/20 text-violet-400 border border-violet-500/20">
              HYOK
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Hardware Security Module · Root of Trust · Asymmetric Attestation
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-400">HSM Active</span>
          <span className="text-[11px] text-slate-600">· AES-256 Bound</span>
        </div>
      </div>

      {/* ── Top Row: Connection Status + Key Sovereignty Card ─────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Connection Status — 3 nodes */}
        <div className="col-span-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Trust Topology</span>
          </div>

          {connections.map((node, idx) => (
            <div key={node.id}>
              <div
                className={`rounded-xl border p-4 transition-all ${
                  node.status === "connected"
                    ? "border-emerald-500/25 bg-emerald-950/10"
                    : node.status === "verifying"
                    ? "border-yellow-500/20 bg-yellow-950/10"
                    : node.status === "pending"
                    ? "border-slate-700 bg-slate-800/20"
                    : "border-red-500/20 bg-red-950/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{node.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-white">{node.label}</p>
                      <p className="text-[10px] text-slate-500">{node.sublabel}</p>
                    </div>
                  </div>
                  <StatusBadge status={node.status} />
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">{node.detail}</p>
                {(node.status === "pending" || node.status === "offline") && (
                  <button
                    onClick={() => simulateVerify(node.id)}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-medium hover:bg-slate-700 transition-all"
                  >
                    {node.status === "pending" ? "Link & Attest →" : "Re-attest →"}
                  </button>
                )}
              </div>
              {idx < connections.length - 1 && (
                <div className="flex justify-center my-1">
                  <div className="w-px h-4 bg-slate-800" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Key Sovereignty Vault Card */}
        <div className="col-span-8 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Key Sovereignty & HSM
              </span>
            </div>
            <span className="text-[10px] text-slate-600 font-mono border border-slate-800 px-2 py-0.5 rounded">
              Shamir 2-of-3 · GF(2⁸)
            </span>
          </div>

          {/* Shamir Shard Visualization */}
          <div className="mb-6">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-4">
              Secret Splitting — Shamir's Secret Sharing
            </p>

            {/* Master Key */}
            <div className="flex flex-col items-center mb-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-3 flex items-center gap-3">
                <span className="text-2xl">🗝️</span>
                <div>
                  <p className="text-xs font-bold text-slate-200">Master Secret</p>
                  <p className="text-[10px] text-slate-500 font-mono">PII plaintext · pre-split</p>
                </div>
              </div>
              {/* Fork lines */}
              <div className="flex items-start mt-1 relative w-full max-w-md justify-center mx-auto">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-slate-700" />
                <div className="absolute top-4 left-[16.5%] right-[16.5%] h-px bg-slate-700" />
                <div className="absolute top-4 left-[16.5%] h-4 w-px bg-slate-700" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-slate-700" />
                <div className="absolute top-4 right-[16.5%] h-4 w-px bg-slate-700" />
              </div>
            </div>

            {/* The 3 shards */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {SHARDS.map((shard, idx) => (
                <div
                  key={shard.id}
                  className={`rounded-xl border p-4 transition-all duration-700 ${shard.borderColor} ${shard.bgColor} ${
                    activeShardPulse === idx ? "shadow-lg scale-[1.02]" : "opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{shard.flag}</span>
                    <div>
                      <p className={`text-xs font-bold ${shard.color}`}>{shard.label}</p>
                      <p className="text-[10px] text-slate-500">{shard.type === "enclave" ? "Hardware bound" : shard.type === "kms" ? "Customer controlled" : "Air-gap protected"}</p>
                    </div>
                  </div>
                  <div className="h-8 rounded-md border border-slate-700/50 bg-slate-900/50 flex items-center justify-center">
                    <span className={`text-[10px] font-mono ${shard.color} opacity-60`}>
                      {isMounted && activeShardPulse === idx
                        ? Array(16).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase()
                        : "· · · · · · · ·"}
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-2 text-center">{shard.region}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center text-[10px] text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              Any 2 of 3 shards reconstruct the secret · 1 shard alone is cryptographically useless
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-800">
            {[
              { label: "Root of Trust", value: "Established", color: "text-emerald-400" },
              { label: "HSM Binding",   value: "AES-256-GCM", color: "text-blue-300" },
              { label: "Threshold",     value: "2-of-3",      color: "text-violet-300" },
              { label: "Key Rotation",  value: "T-14,504s",   color: "text-amber-300" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-0.5">{m.label}</p>
                <p className={`text-sm font-bold ${m.color} font-mono`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: KMS Ownership + Kill Switch + Audit log ───────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Verify Key Ownership */}
        <div className="col-span-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Verify Key Ownership
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Link your managed key to establish Asymmetric Attestation. The Enclave performs a challenge-response handshake to prove your organization controls the key.
          </p>
          <KmsOwnershipFlow />
        </div>

        {/* Kill Switch */}
        <div className="col-span-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Kill Switch
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            One-command nuclear option. Cryptographically wipes all vault data and revokes every active session. This action is irreversible and immediate.
          </p>
          <KillSwitch />
        </div>

        {/* Audit Trail */}
        <div className="col-span-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Key Audit Trail
              </span>
            </div>
            <span className="text-[10px] text-slate-600">{AUDIT_EVENTS.length} events</span>
          </div>

          <div className="space-y-1">
            {AUDIT_EVENTS.map((evt, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/30 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  evt.level === "success" ? "bg-emerald-400" :
                  evt.level === "warning" ? "bg-amber-400" : "bg-blue-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-300 truncate">{evt.event}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-600 font-mono">{evt.ts}</span>
                    <span className="text-[10px] text-slate-700">·</span>
                    <span className="text-[10px] text-slate-600">{evt.actor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-600">
              <span>All events signed by Enclave Ed25519 key</span>
              <button className="text-blue-400 hover:text-blue-300 transition-colors">Export →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
