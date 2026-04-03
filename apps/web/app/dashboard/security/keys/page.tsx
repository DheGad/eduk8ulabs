"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/security/keys
 * @version V58
 * @description Automated Key Rotation — Vault Key Lifecycle Management
 *
 * Shows AES-256-GCM key rotation timeline with live countdown,
 * FORCE ROTATION button, and version history log.
 * Tech Stack Lock: Next.js App Router · TypeScript · Tailwind CSS · Obsidian & Emerald
 */

// ================================================================
// TYPES
// ================================================================

type KeyState = "ACTIVE" | "PREVIOUS" | "EXPIRED";

interface VaultKey {
  version:     string;
  keyMaterial: string;  // truncated for display
  algorithm:   "AES-256-GCM";
  state:       KeyState;
  createdAt:   number;
  expiresAt:   number | null;
  rotations:   number;
}

interface RotationEvent {
  id: number;
  ts: string;
  prev: string;
  next: string;
}

// ================================================================
// HELPERS
// ================================================================

function randomHex(bytes: number): string {
  return Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function formatAge(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "EXPIRED";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const CREATE_TS = Date.now() - 1000 * 60 * 60 * 14; // 14h ago

function makeKey(version: string, state: KeyState, createdAt: number, expiresAt: number | null): VaultKey {
  return { version, keyMaterial: randomHex(16), algorithm: "AES-256-GCM", state, createdAt, expiresAt, rotations: 0 };
}

const INIT_PATCH = 2;

// ================================================================
// MAIN PAGE
// ================================================================

export default function KeyRotationPage() {
  const [mounted, setMounted]     = useState(false);
  const [patch, setPatch]         = useState(INIT_PATCH);
  const [keys, setKeys]           = useState<VaultKey[]>([
    makeKey(`v12.4.${INIT_PATCH}`, "ACTIVE", CREATE_TS, null),
  ]);
  const [now, setNow]             = useState(Date.now());
  const [rotating, setRotating]   = useState(false);
  const [events, setEvents]       = useState<RotationEvent[]>([]);
  const eventId                   = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Live ticker — updates every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Lazily expire previous key in UI
  useEffect(() => {
    setKeys(prev => prev.map(k => {
      if (k.state === "PREVIOUS" && k.expiresAt && Date.now() > k.expiresAt) {
        return { ...k, state: "EXPIRED" };
      }
      return k;
    }));
  }, [now]);

  const forceRotation = useCallback(async () => {
    if (rotating) return;
    setRotating(true);

    await new Promise(res => setTimeout(res, 600));

    const prevKey = keys.find(k => k.state === "ACTIVE");
    if (!prevKey) { setRotating(false); return; }

    const newPatch   = patch + 1;
    const newVersion = `v12.4.${newPatch}`;
    const expiresAt  = Date.now() + 5 * 60 * 1000; // 5 min

    setPatch(newPatch);
    setKeys(prev => [
      makeKey(newVersion, "ACTIVE", Date.now(), null),
      ...prev.map(k => k.state === "ACTIVE" ? { ...k, state: "PREVIOUS" as KeyState, expiresAt } : k),
    ]);

    eventId.current += 1;
    setEvents(prev => [
      { id: eventId.current, ts: new Date().toISOString().slice(11, 23), prev: prevKey.version, next: newVersion },
      ...prev,
    ].slice(0, 6));

    setRotating(false);
  }, [rotating, keys, patch]);

  if (!mounted) return null;

  const active   = keys.find(k => k.state === "ACTIVE");
  const previous = keys.find(k => k.state === "PREVIOUS");
  const expired  = keys.filter(k => k.state === "EXPIRED");
  const activeAge = active ? now - active.createdAt : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">V58</span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">Automated Key Rotation</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Vault Key <span className="text-emerald-400">Lifecycle Manager</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              AES-256-GCM key rotation with zero-drop grace periods. Previous keys remain valid for 5 minutes post-rotation to drain in-flight proxy requests before expiry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Key Age",             value: formatAge(activeAge),    cls: activeAge > 82_800_000 ? "text-amber-400" : "text-emerald-400" },
              { label: "Rotation Policy",     value: "24h",                   cls: "text-zinc-400" },
              { label: "Active Key Version",  value: active?.version ?? "—",  cls: "text-emerald-400 font-mono" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black tracking-wide ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────── */}
      <div className="p-8 space-y-6">

        {/* Force Rotation Button */}
        <button
          onClick={forceRotation}
          disabled={rotating}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-sm transition-all duration-300 ${
            rotating
              ? "bg-amber-950/20 text-amber-600 border border-amber-900/40 cursor-wait animate-pulse"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
          }`}
        >
          {rotating ? "⏳ Generating New AES-256 Key…" : "🔑 Force Rotation — Generate New Vault Key"}
        </button>

        {/* Key Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Active Key */}
          <div className="rounded-2xl p-5 border border-emerald-500/30 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Current Key</p>
                <p className="text-lg font-black text-emerald-400 font-mono">{active?.version}</p>
              </div>
              <span className="px-2 py-0.5 text-[8px] font-black rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">ACTIVE</span>
            </div>
            <div className="space-y-2 text-[9px]">
              <div className="flex justify-between"><span className="text-zinc-600">Algorithm</span><span className="font-mono text-zinc-400">{active?.algorithm}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Key (truncated)</span><span className="font-mono text-zinc-500">{active?.keyMaterial.slice(0, 12)}…</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Age</span><span className="font-mono text-emerald-400">{formatAge(activeAge)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Expires</span><span className="font-mono text-zinc-600">On rotation</span></div>
            </div>
            {/* Age bar */}
            <div className="mt-4">
              <div className="flex justify-between text-[8px] text-zinc-600 mb-1">
                <span>0h</span><span>12h</span><span>24h</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${activeAge > 72_000_000 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min((activeAge / 86_400_000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Previous Key */}
          <div className={`rounded-2xl p-5 border transition-all duration-700 ${
            previous
              ? "border-amber-500/30 bg-amber-950/10"
              : "border-white/5 bg-zinc-900/20"
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Previous Key</p>
                <p className={`text-lg font-black font-mono ${previous ? "text-amber-400" : "text-zinc-700"}`}>
                  {previous?.version ?? "—"}
                </p>
              </div>
              <span className={`px-2 py-0.5 text-[8px] font-black rounded border ${
                previous
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-zinc-800 bg-zinc-900 text-zinc-600"
              }`}>
                {previous ? "PREVIOUS" : "NONE"}
              </span>
            </div>
            {previous ? (
              <div className="space-y-2 text-[9px]">
                <div className="flex justify-between"><span className="text-zinc-600">Algorithm</span><span className="font-mono text-zinc-400">{previous.algorithm}</span></div>
                <div className="flex justify-between"><span className="text-zinc-600">Key (truncated)</span><span className="font-mono text-zinc-500">{previous.keyMaterial.slice(0, 12)}…</span></div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Expires In</span>
                  <span className={`font-mono font-black ${previous.expiresAt! - now < 60_000 ? "text-red-400" : "text-amber-400"}`}>
                    {formatCountdown(previous.expiresAt! - now)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-zinc-700 mt-4">No previous key. Rotation has not occurred yet.</p>
            )}
            {previous && (
              <div className="mt-4">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                    style={{ width: `${Math.max(((previous.expiresAt! - now) / (5 * 60 * 1000)) * 100, 0)}%` }}
                  />
                </div>
                <p className="text-[8px] text-zinc-700 mt-1">5-minute drain window for in-flight proxy requests</p>
              </div>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl p-5 border border-white/8 bg-[#0a0a0a]">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Rotation History</p>
            {events.length === 0 ? (
              <p className="text-[9px] text-zinc-700">No rotations performed this session.</p>
            ) : (
              <div className="space-y-3">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                    <div>
                      <p className="text-[9px] font-mono text-zinc-400">
                        <span className="text-amber-400">{ev.prev}</span>
                        <span className="text-zinc-600"> → </span>
                        <span className="text-emerald-400">{ev.next}</span>
                      </p>
                      <p className="text-[8px] text-zinc-700">{ev.ts}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expired.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-2">Expired Keys</p>
                {expired.map(k => (
                  <p key={k.version} className="text-[8px] font-mono text-zinc-800">{k.version} — PURGED</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Integration Note */}
        <div className="rounded-xl border border-white/8 bg-[#0a0a0a] p-6">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Pipeline Injection (V58)</p>
          <code className="text-[10px] text-zinc-400 block whitespace-pre bg-black p-4 rounded border border-white/5 font-mono">
{`// Previously (V47 Static Key):
const sealedData = globalVault.sealData(cert, MOCK_CLIENT_KEY);

// Now (V58 Dynamic Key):
const activeKey = globalKeyRotator.getCurrentKey();
const sealedData = globalVault.sealData(cert, activeKey.keyMaterial);

// In-flight requests use their issued version:
const key = globalKeyRotator.getKey(req.issuedKeyVersion);
// → PREVIOUS key valid for 5 min post-rotation
// → EXPIRED key returns undefined → 401 Re-authenticate`}
          </code>
        </div>

      </div>
    </div>
  );
}
