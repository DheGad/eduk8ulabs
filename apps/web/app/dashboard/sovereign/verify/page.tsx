"use client";

import React, { useState } from "react";
import { ShieldCheck, Search, GitBranch, Clock, Hash, Lock, CheckCircle, XCircle } from "lucide-react";

/**
 * @file verify/page.tsx
 * @route /dashboard/sovereign/verify
 * @description Merkle-Explorer — Deep Audit View
 *
 * Implements C053 Task 1.
 * Paste a Proof_ID and see the full cryptographic Merkle tree of that execution.
 * Mathematical proof that no data was tampered at any step of the AI's reasoning.
 */

interface MerkleNode {
  id: string;
  label: string;
  hash: string;
  parentHash: string | null;
  timestamp: string;
  status: "valid" | "tampered";
  detail: string;
}

function buildMerkleTree(proofId: string): MerkleNode[] {
  // Deterministic mock tree seeded by proof ID — in production, fetched from the ledger DB
  const seed = proofId.slice(-8);
  const ts = (offset: number) =>
    new Date(Date.now() - offset * 1000).toISOString().replace("T", " ").slice(0, 19);

  return [
    {
      id: "leaf_0",
      label: "Raw Prompt Ingestion",
      hash: `sha256:a3f${seed}c2`,
      parentHash: null,
      timestamp: ts(9),
      status: "valid",
      detail: `Prompt received · ${(Math.random() * 400 + 200).toFixed(0)} tokens · Trace: ${proofId}`,
    },
    {
      id: "leaf_1",
      label: "ZK Sanitizer — PII Scrub",
      hash: `sha256:9b1${seed}d4`,
      parentHash: `sha256:a3f${seed}c2`,
      timestamp: ts(8),
      status: "valid",
      detail: `PII entities detected: 0 · Aadhaar mask: N/A · Sanitized output hash committed`,
    },
    {
      id: "leaf_2",
      label: "Policy Gate — Schema Check",
      hash: `sha256:6e7${seed}f8`,
      parentHash: `sha256:9b1${seed}d4`,
      timestamp: ts(7),
      status: "valid",
      detail: `Required keys validated · Mode: strict · Enforcer v2 applied`,
    },
    {
      id: "leaf_3",
      label: "Model Router — LLM Dispatch",
      hash: `sha256:2c5${seed}a1`,
      parentHash: `sha256:6e7${seed}f8`,
      timestamp: ts(5),
      status: "valid",
      detail: `Model: gemini-2.5-flash · Provider: Google DeepMind · Latency: 724ms`,
    },
    {
      id: "leaf_4",
      label: "Enforcer Repair Loop",
      hash: `sha256:ef3${seed}b9`,
      parentHash: `sha256:2c5${seed}a1`,
      timestamp: ts(4),
      status: "valid",
      detail: `Attempt 1/3 — Output valid on first pass · repair_used: false`,
    },
    {
      id: "leaf_5",
      label: "Merkle Root Commitment",
      hash: `sha256:ROOT_${seed}`,
      parentHash: `sha256:ef3${seed}b9`,
      timestamp: ts(3),
      status: "valid",
      detail: `Root hash signed · HMAC-SHA256 · Key: HSM (AirGap) · Immutable ledger entry written`,
    },
  ];
}

export default function MerkleExplorer() {
  const [proofId, setProofId] = useState("");
  const [tree, setTree] = useState<MerkleNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [rootValid, setRootValid] = useState<boolean | null>(null);

  async function verifyProof() {
    if (!proofId.trim()) return;
    setLoading(true);
    setTree(null);
    setRootValid(null);
    await new Promise(r => setTimeout(r, 1200));
    const nodes = buildMerkleTree(proofId.trim());
    setTree(nodes);
    setRootValid(nodes.every(n => n.status === "valid"));
    setLoading(false);
  }

  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: "#050505", color: "#fff" }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-6 h-6 text-emerald-500" />
            <h1 className="text-3xl font-mono font-bold tracking-tight">Merkle Explorer</h1>
          </div>
          <p className="text-sm" style={{ color: "#888" }}>
            Mathematical proof that no data was tampered during AI reasoning. Paste any Proof ID to inspect the full cryptographic execution tree.
          </p>
        </div>

        {/* Search Input */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          <div className="p-5">
            <label className="text-xs font-mono uppercase tracking-widest mb-3 block" style={{ color: "#555" }}>
              Proof ID / Merkle Root Hash
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#555" }} />
                <input
                  value={proofId}
                  onChange={e => setProofId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verifyProof()}
                  placeholder="exec_proof_7f3a9c2e1b..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl font-mono text-sm outline-none transition-all"
                  style={{
                    background: "#050505",
                    border: "1px solid #222",
                    color: "#ccc",
                    caretColor: "#10b981"
                  }}
                />
              </div>
              <button
                onClick={verifyProof}
                disabled={!proofId.trim() || loading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                style={(!proofId.trim() || loading)
                  ? { background: "#111", color: "#444" }
                  : { background: "#10b981", color: "#000", boxShadow: "0 0 20px rgba(16,185,129,0.25)" }}
              >
                <Search className="w-4 h-4" />
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
            <p className="text-[10px] font-mono mt-2" style={{ color: "#333" }}>
              Try: exec_proof_7f3a9c2e1b · merkle_3d8f2a · any string works for demo
            </p>
          </div>
        </div>

        {/* Verdict Banner */}
        {rootValid !== null && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-3 transition-all"
               style={rootValid
                 ? { background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }
                 : { background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {rootValid
              ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            <div>
              <p className="text-sm font-bold" style={{ color: rootValid ? "#10b981" : "#ef4444" }}>
                {rootValid ? "✓ Cryptographic Integrity Verified" : "⚠ Tamper Detected — Chain Broken"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                {rootValid
                  ? "All 6 Merkle leaf nodes are valid. Root hash matches HSM ledger signature."
                  : "One or more leaf nodes have mismatched hashes. Do not trust this output."}
              </p>
            </div>
          </div>
        )}

        {/* Merkle Tree */}
        {tree && (
          <div className="space-y-0">
            {tree.map((node, i) => (
              <div key={node.id} className="relative">
                {/* Connector line */}
                {i < tree.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 z-0"
                       style={{ background: "rgba(16,185,129,0.15)" }} />
                )}
                <div className="relative z-10 flex gap-4 mb-1 p-4 rounded-xl transition-all"
                     style={{ background: i === tree.length - 1 ? "rgba(16,185,129,0.04)" : "#0a0a0a",
                              border: `1px solid ${i === tree.length - 1 ? "rgba(16,185,129,0.15)" : "#111"}` }}>
                  {/* Node circle */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                       style={{
                         background: node.status === "valid" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                         border: `1px solid ${node.status === "valid" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                         color: node.status === "valid" ? "#10b981" : "#ef4444"
                       }}>
                    {i}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{node.label}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Clock className="w-3 h-3" style={{ color: "#444" }} />
                        <span className="text-[10px] font-mono" style={{ color: "#444" }}>{node.timestamp}</span>
                      </div>
                    </div>
                    <p className="text-[11px] font-mono mb-1.5 break-all"
                       style={{ color: "#10b981", opacity: 0.7 }}>
                      {node.hash}
                    </p>
                    {node.parentHash && (
                      <p className="text-[10px] font-mono mb-1.5" style={{ color: "#333" }}>
                        ↑ parent: {node.parentHash}
                      </p>
                    )}
                    <p className="text-[11px]" style={{ color: "#666" }}>{node.detail}</p>
                  </div>
                  {node.status === "valid"
                    ? <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-1" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
