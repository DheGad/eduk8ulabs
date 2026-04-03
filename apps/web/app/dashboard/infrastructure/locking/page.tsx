"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * @file page.tsx
 * @route /dashboard/infrastructure/locking
 * @version V54
 * @description Distributed Mutex Locking — High-Concurrency Simulation Matrix
 *
 * Shows 5 concurrent threads attempting to write to Tenant_Alpha_Vault.
 * Thread 1 gets LOCK ACQUIRED (emerald), Threads 2-5 cycle through WAITING QUEUE (amber).
 * Obsidian & Emerald aesthetic. Tech Stack Lock: Next.js · TypeScript · Tailwind CSS
 */

// ================================================================
// TYPES
// ================================================================

type ThreadStatus = "ACQUIRED" | "WAITING" | "PROCESSING" | "RELEASED" | "IDLE";

interface Thread {
  id: number;
  name: string;
  status: ThreadStatus;
  lockId?: string;
  waitedMs?: number;
  heldMs?: number;
  operation: string;
  resource: string;
  queuePos?: number;
}

interface LockEvent {
  id: number;
  ts: string;
  type: "ACQUIRED" | "RELEASED" | "QUEUED" | "TIMEOUT" | "RACE_PREVENTED";
  resource: string;
  thread: string;
  lockId?: string;
  detail: string;
}

// ================================================================
// HELPERS
// ================================================================

function randomLockId(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("").toUpperCase();
}

function nowTime(): string {
  return new Date().toISOString().slice(11, 23);
}

const OPERATIONS = [
  "Write Vault Key",
  "Rotate AES-256",
  "Update DLP Context",
  "Mutate Tenant Config",
  "Seal Memory Partition",
];

const RESOURCES = [
  "tenant:alpha:vault",
  "tenant:alpha:dlp_ctx",
  "tenant:alpha:partition",
];

const THREAD_NAMES = [
  "Thread-1 (ingress-pod-a)",
  "Thread-2 (ingress-pod-b)",
  "Thread-3 (worker-node-7)",
  "Thread-4 (worker-node-12)",
  "Thread-5 (edge-proxy-us)",
];

const INITIAL_THREADS: Thread[] = THREAD_NAMES.map((name, i) => ({
  id:        i + 1,
  name,
  status:    "IDLE",
  operation: OPERATIONS[i % OPERATIONS.length]!,
  resource:  RESOURCES[0]!,
}));

const STATUS_CONFIG: Record<ThreadStatus, { label: string; color: string; bg: string; border: string; glow?: string }> = {
  ACQUIRED:   { label: "🔐 LOCK ACQUIRED",    color: "rgb(52,211,153)",  bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.4)",  glow: "rgba(16,185,129,0.5)" },
  WAITING:    { label: "⏳ WAITING IN QUEUE", color: "rgb(251,191,36)",  bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)" },
  PROCESSING: { label: "⚙️ PROCESSING",       color: "rgb(167,139,250)", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)"  },
  RELEASED:   { label: "✅ RELEASED",          color: "rgb(113,113,122)", bg: "rgba(255,255,255,0.03)",border: "rgba(255,255,255,0.06)" },
  IDLE:       { label: "● IDLE",              color: "rgb(63,63,70)",    bg: "rgba(255,255,255,0.02)",border: "rgba(255,255,255,0.04)" },
};

// ================================================================
// THREAD CARD
// ================================================================

function ThreadCard({ thread, isHolder }: { thread: Thread; isHolder: boolean }) {
  const cfg = STATUS_CONFIG[thread.status];
  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-500"
      style={{
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        boxShadow: isHolder ? `0 0 20px ${cfg.glow ?? "transparent"}` : "none",
      }}
    >
      {/* Thread header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: cfg.border, background: "rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: cfg.color,
              boxShadow: isHolder ? `0 0 6px ${cfg.glow ?? cfg.color}` : "none",
              animation: thread.status === "ACQUIRED" ? "pulse 1s infinite" : "none",
            }}
          />
          <span className="text-[9px] font-mono font-bold text-zinc-300">{thread.name}</span>
        </div>
        <span
          className="text-[8px] font-black px-2 py-0.5 rounded tracking-widest"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Thread body */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Resource</span>
          <span className="text-[9px] font-mono" style={{ color: cfg.color }}>{thread.resource}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Operation</span>
          <span className="text-[9px] text-zinc-400">{thread.operation}</span>
        </div>
        {thread.lockId && (
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Lock ID</span>
            <span className="text-[9px] font-mono text-emerald-400">{thread.lockId}…</span>
          </div>
        )}
        {thread.waitedMs !== undefined && thread.status !== "IDLE" && (
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">Waited</span>
            <span className="text-[9px] font-mono text-zinc-400">{thread.waitedMs}ms</span>
          </div>
        )}
        {thread.queuePos !== undefined && thread.status === "WAITING" && (
          <div
            className="rounded px-2 py-1 text-center"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <p className="text-[8px] text-yellow-400 font-black">Queue Position: #{thread.queuePos}</p>
          </div>
        )}
        {thread.status === "ACQUIRED" && thread.heldMs !== undefined && (
          <div
            className="rounded px-2 py-1 text-center"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <p className="text-[8px] text-emerald-400 font-black">Holding for {thread.heldMs}ms</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================
// MAIN PAGE
// ================================================================

export default function LockingPage() {
  const [mounted, setMounted]                   = useState(false);
  const [threads, setThreads]                   = useState<Thread[]>(INITIAL_THREADS);
  const [events, setEvents]                     = useState<LockEvent[]>([]);
  const [activeLocks, setActiveLocks]           = useState(14);
  const [racesPrevented, setRacesPrevented]     = useState(1402);
  const [avgAcquireMs, setAvgAcquireMs]         = useState(1.2);
  const [holderMs, setHolderMs]                 = useState(0);
  const [currentHolderId, setCurrentHolderId]   = useState<number>(1);
  const eventId   = useRef(0);
  const holderTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Increment held-time for the lock holder
  useEffect(() => {
    if (!mounted) return;
    holderTimer.current = setInterval(() => {
      setHolderMs((ms) => ms + 100);
    }, 100);
    return () => { if (holderTimer.current) clearInterval(holderTimer.current); };
  }, [mounted, currentHolderId]);

  // Main concurrency simulation loop
  useEffect(() => {
    if (!mounted) return;

    // Cycle lock through threads: thread i acquires while i+1..n wait
    let cycle = 0;
    const HOLD_DURATION = 2800; // ms per lock holder

    const runCycle = () => {
      const holderIdx    = cycle % 5;
      const holderId     = holderIdx + 1;
      const lockId       = randomLockId();
      const resource     = RESOURCES[0]!;

      setCurrentHolderId(holderId);
      setHolderMs(0);

      // Assign statuses
      setThreads((prev) =>
        prev.map((t, i) => {
          if (i === holderIdx) {
            return {
              ...t,
              status:   "ACQUIRED",
              lockId,
              waitedMs: Math.floor(Math.random() * 20 + 1),
              heldMs:   0,
              queuePos: undefined,
            };
          }
          // Queue positions
          const waitPos  = ((i - holderIdx - 1 + 5) % 5) + 1;
          const waitedMs = waitPos * Math.floor(Math.random() * 15 + 10);
          return {
            ...t,
            status:   "WAITING",
            lockId:   undefined,
            queuePos: waitPos,
            waitedMs,
          };
        })
      );

      // Emit ACQUIRED event
      setEvents((prev) => [{
        id:       eventId.current++,
        ts:       nowTime(),
        type:     "ACQUIRED",
        resource,
        thread:   THREAD_NAMES[holderIdx]!,
        lockId,
        detail:   `Mutex acquired. 4 threads queued.`,
      }, ...prev.slice(0, 11)]);

      // Emit RACE_PREVENTED events for each waiter
      for (let w = 1; w <= 4; w++) {
        setTimeout(() => {
          const waiterIdx = (holderIdx + w) % 5;
          setEvents((prev) => [{
            id:      eventId.current++,
            ts:      nowTime(),
            type:    "RACE_PREVENTED",
            resource,
            thread:  THREAD_NAMES[waiterIdx]!,
            detail:  `Write blocked — lock held by thread ${holderId}`,
          }, ...prev.slice(0, 11)]);
          setRacesPrevented((n) => n + 1);
          setActiveLocks((n) => Math.min(n + 1, 19));
          setAvgAcquireMs((ms) => parseFloat((ms * 0.95 + Math.random() * 0.2).toFixed(1)));
        }, w * 200);
      }

      // After hold duration: release
      setTimeout(() => {
        setThreads((prev) =>
          prev.map((t, i) => i === holderIdx ? { ...t, status: "RELEASED", lockId: undefined } : t)
        );
        setEvents((prev) => [{
          id:      eventId.current++,
          ts:      nowTime(),
          type:    "RELEASED",
          resource,
          thread:  THREAD_NAMES[holderIdx]!,
          lockId,
          detail:  `Lock released after ${HOLD_DURATION}ms. Next thread unblocked.`,
        }, ...prev.slice(0, 11)]);
        setActiveLocks((n) => Math.max(n - 1, 12));

        // Brief idle before next cycle
        setTimeout(() => {
          setThreads((prev) =>
            prev.map((t, i) => i === holderIdx ? { ...t, status: "IDLE" } : t)
          );
          cycle += 1;
          runCycle();
        }, 400);
      }, HOLD_DURATION);
    };

    // Start first cycle after 1s
    const startTimer = setTimeout(runCycle, 1000);
    return () => clearTimeout(startTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Update holderMs in thread state
  useEffect(() => {
    setThreads((prev) =>
      prev.map((t) => t.status === "ACQUIRED" ? { ...t, heldMs: holderMs } : t)
    );
  }, [holderMs]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-[10px] font-black tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "rgb(52,211,153)" }}
              >
                V54
              </span>
              <span className="text-[10px] font-bold text-zinc-600 tracking-widest uppercase">
                Distributed Mutex Locking
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              High-Concurrency <span className="text-emerald-400">Simulation Matrix</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Redis-backed distributed mutex (Redlock pattern). 5 concurrent threads compete
              for the same tenant vault write slot. Only one holds the lock at a time —
              others wait in queue with exponential backoff to prevent thundering-herd.
            </p>
          </div>

          {/* Top metrics */}
          <div className="flex flex-wrap items-center gap-8 border-l border-white/8 lg:pl-8">
            {[
              { label: "Active Locks",              value: String(activeLocks),          cls: "text-emerald-400" },
              { label: "Race Conditions Prevented", value: racesPrevented.toLocaleString(), cls: "text-emerald-400" },
              { label: "Avg Lock Acquisition",      value: `${avgAcquireMs}ms`,           cls: "text-emerald-400 font-mono" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-right">
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-black tracking-wide ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="p-8 space-y-6">

        {/* Resource being contested */}
        <div
          className="rounded-xl px-6 py-4 flex items-center gap-5"
          style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <span className="text-2xl">🗄️</span>
          <div className="flex-1">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-0.5">Contested Resource</p>
            <p className="text-sm font-black font-mono text-white">tenant:alpha:vault</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              V47 HYOK Vault Key Store · V52 Tenant Alpha Partition · V51 DLP Context Registry
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Mutex TTL</p>
            <p className="text-sm font-black text-emerald-400 font-mono">5 000ms</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Timeout</p>
            <p className="text-sm font-black text-zinc-400 font-mono">3 000ms</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Lock Algorithm</p>
            <p className="text-sm font-black text-zinc-300">Redlock</p>
          </div>
        </div>

        {/* ── THREAD GRID ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {threads.map((t) => (
            <ThreadCard key={t.id} thread={t} isHolder={t.status === "ACQUIRED"} />
          ))}
        </div>

        {/* ── BOTTOM SECTION ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Event log */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Mutex Event Stream
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-500 font-mono">LIVE</span>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {events.slice(0, 8).map((evt) => {
                const typeColor =
                  evt.type === "ACQUIRED"       ? "rgb(52,211,153)" :
                  evt.type === "RELEASED"       ? "rgb(113,113,122)" :
                  evt.type === "RACE_PREVENTED" ? "rgb(251,191,36)" :
                  evt.type === "TIMEOUT"        ? "rgb(248,113,113)" :
                                                  "rgb(167,139,250)";
                const typeLabel =
                  evt.type === "ACQUIRED"       ? "ACQUIRED" :
                  evt.type === "RELEASED"       ? "RELEASED" :
                  evt.type === "RACE_PREVENTED" ? "RACE PREVENTED" :
                  evt.type === "TIMEOUT"        ? "TIMEOUT" : "QUEUED";

                return (
                  <div key={evt.id} className="px-4 py-2.5 flex items-start gap-3">
                    <span className="text-[9px] font-mono text-zinc-700 flex-shrink-0 mt-0.5">{evt.ts}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[8px] font-black tracking-widest px-1 py-0.5 rounded"
                          style={{ color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}40` }}>
                          {typeLabel}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500 truncate">{evt.thread.split(" ")[0]}</span>
                      </div>
                      <p className="text-[9px] text-zinc-600">{evt.detail}</p>
                      {evt.lockId && (
                        <p className="text-[8px] font-mono text-emerald-600 mt-0.5">lock:{evt.lockId}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-700">Simulation starting…</p>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline + stats */}
          <div className="flex flex-col gap-4">

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Acquisitions", value: String(racesPrevented + 14),  color: "rgb(52,211,153)"  },
                { label: "Releases",     value: String(racesPrevented + 8),    color: "rgb(52,211,153)"  },
                { label: "Timeouts",     value: "0",                           color: "rgb(52,211,153)"  },
                { label: "Deadlocks",    value: "0",                           color: "rgb(52,211,153)"  },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-xl font-black font-mono" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Pipeline injection */}
            <div
              className="rounded-xl p-4 flex-1"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3">
                Proxy Pipeline — V54 Injection Point
              </p>
              <div className="flex flex-wrap items-center gap-y-2 text-[9px] font-mono">
                {[
                  { label: "V49 Attest",         hl: false },
                  { label: "→", arrow: true },
                  { label: "V52 Tenant",         hl: false },
                  { label: "→", arrow: true },
                  { label: "V54 acquireLock()",  hl: true  },
                  { label: "→", arrow: true },
                  { label: "V50 IAM",            hl: false },
                  { label: "→", arrow: true },
                  { label: "V51 DLP",            hl: false },
                  { label: "→", arrow: true },
                  { label: "V53 gRPC",           hl: false },
                  { label: "→", arrow: true },
                  { label: "V48 BFT",            hl: false },
                  { label: "→", arrow: true },
                  { label: "LLM",                hl: false },
                  { label: "→", arrow: true },
                  { label: "V54 releaseLock()",  hl: true  },
                ].map((s, i) =>
                  s.arrow ? (
                    <span key={i} className="text-zinc-700 mx-0.5">›</span>
                  ) : (
                    <span key={i} className="px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: s.hl ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                        border: s.hl ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                        color: s.hl ? "rgb(52,211,153)" : "rgb(113,113,122)",
                      }}>
                      {s.label}
                    </span>
                  )
                )}
              </div>
              <p className="text-[8px] text-zinc-700 mt-3">
                Lock wraps the sensitive vault/tenant mutation. A <code className="text-zinc-600">finally</code> block ensures the lock is
                always released — even if the LLM request throws — preventing deadlocks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
