"use client";

import React from "react";

/**
 * @component SkeletonLoader
 * @description Animated pulse skeleton shapes for all major table/list views.
 *   Shows the shape of incoming data while async fetches resolve.
 *   Phase 2 — Professional UI States.
 *
 * Usage:
 *   <SkeletonTable rows={5} columns={4} />
 *   <SkeletonCard />
 *   <SkeletonRow />
 */

// ── Base pulse box ───────────────────────────────────────────────
function Pulse({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.05] ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ── Generic table skeleton ────────────────────────────────────────
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  /** Column width hints: 'wide' | 'medium' | 'narrow' | 'badge' */
  columnWidths?: Array<"wide" | "medium" | "narrow" | "badge">;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  columnWidths,
}: SkeletonTableProps) {
  const widthMap: Record<string, string> = {
    wide: "w-48",
    medium: "w-28",
    narrow: "w-16",
    badge: "w-20 rounded-full",
  };

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.01]"
      role="status"
      aria-label="Loading data…"
      aria-busy="true"
    >
      {/* Table header skeleton */}
      {showHeader && (
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.05]">
          {Array.from({ length: columns }).map((_, i) => (
            <Pulse
              key={i}
              className={`h-3 ${columnWidths ? (widthMap[columnWidths[i]!] ?? "w-24") : "w-24"}`}
            />
          ))}
        </div>
      )}

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.03] last:border-0"
          style={{ animationDelay: `${rowIdx * 80}ms` }}
        >
          {/* Leading icon placeholder */}
          <Pulse className="w-8 h-8 rounded-xl shrink-0" />

          {Array.from({ length: columns - 1 }).map((_, colIdx) => {
            const widthKey = columnWidths?.[colIdx + 1];
            const widthClass = widthKey ? (widthMap[widthKey] ?? "w-24") : ["w-40", "w-24", "w-16", "w-20"][colIdx % 4]!;
            return (
              <Pulse
                key={colIdx}
                className={`h-3.5 ${widthClass} ${widthKey === "badge" ? "rounded-full" : ""}`}
                style={{ animationDelay: `${rowIdx * 80 + colIdx * 40}ms` } as React.CSSProperties}
              />
            );
          })}

          {/* Action button placeholder */}
          <Pulse className="ml-auto w-16 h-7 rounded-lg" />
        </div>
      ))}

      {/* Screen-reader only status text */}
      <span className="sr-only">Loading table data, please wait…</span>
    </div>
  );
}

// ── Single card skeleton ──────────────────────────────────────────
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-3 ${className}`}
      role="status"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Pulse className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-32" />
          <Pulse className="h-3 w-20" />
        </div>
        <Pulse className="h-6 w-16 rounded-full" />
      </div>
      <Pulse className="h-3 w-full" />
      <Pulse className="h-3 w-4/5" />
      <Pulse className="h-3 w-2/3" />
      <div className="flex gap-2 pt-1">
        <Pulse className="h-8 w-24 rounded-lg" />
        <Pulse className="h-8 w-16 rounded-lg" />
      </div>
      <span className="sr-only">Loading card, please wait…</span>
    </div>
  );
}

// ── Single row skeleton (for inline lists) ────────────────────────
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 py-3 ${className}`}
      role="status"
      aria-busy="true"
    >
      <Pulse className="w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Pulse className="h-3.5 w-40" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="h-5 w-14 rounded-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ── Workspace skeleton (3-panel layout shape) ─────────────────────
export function SkeletonWorkspace() {
  return (
    <div className="flex h-full gap-5" role="status" aria-label="Loading workspace…" aria-busy="true">
      {/* Left sidebar skeleton */}
      <div className="w-64 shrink-0 space-y-3 pt-2">
        <Pulse className="h-8 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2">
            <Pulse className="w-5 h-5 rounded-md" />
            <Pulse className="h-3.5 flex-1" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 space-y-4 pt-2">
        {/* Top KPI bar */}
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="flex-1 p-4" />
          ))}
        </div>

        {/* Table */}
        <SkeletonTable rows={6} columns={5} />
      </div>

      <span className="sr-only">Loading workspace, please wait…</span>
    </div>
  );
}

// ── Audit log skeleton ────────────────────────────────────────────
export function SkeletonAuditLog({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="w-full space-y-0 rounded-2xl border border-white/[0.06] overflow-hidden"
      role="status"
      aria-label="Loading audit log…"
      aria-busy="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <Pulse className="h-4 w-28" />
        <div className="flex gap-2">
          <Pulse className="h-7 w-20 rounded-lg" />
          <Pulse className="h-7 w-16 rounded-lg" />
        </div>
      </div>

      {/* Log entries */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.03] last:border-0"
        >
          {/* Timestamp */}
          <Pulse className="h-3 w-24 shrink-0" />
          {/* Event type badge */}
          <Pulse className="h-5 w-20 rounded-full shrink-0" />
          {/* Description */}
          <Pulse className="h-3 flex-1" />
          {/* Tenant */}
          <Pulse className="h-3 w-16 shrink-0" />
          {/* Hash */}
          <Pulse className="h-3 w-20 font-mono shrink-0" />
        </div>
      ))}

      <span className="sr-only">Loading audit entries, please wait…</span>
    </div>
  );
}

// ── Marketplace card grid skeleton ────────────────────────────────
export function SkeletonMarketplace({ cards = 6 }: { cards?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      role="status"
      aria-label="Loading marketplace…"
      aria-busy="true"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <Pulse className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-3/4" />
              <Pulse className="h-3 w-1/2" />
            </div>
          </div>
          {/* Description */}
          <div className="space-y-2">
            <Pulse className="h-3 w-full" />
            <Pulse className="h-3 w-5/6" />
            <Pulse className="h-3 w-2/3" />
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <Pulse className="h-5 w-16 rounded-full" />
            <Pulse className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading marketplace items, please wait…</span>
    </div>
  );
}

// Re-export React for JSX reference
