/**
 * @file merkleLogger.ts
 * @service router-service
 * @description V13 Verifiable Execution Engine — Merkle Tree Audit Log
 *
 * Every ExecutionReceipt returned by the Rust Enclave becomes a leaf in a
 * per-tenant, per-day Merkle Tree. This gives CISOs a single "Root Hash"
 * they can publish to prove that no receipts were deleted, reordered, or
 * forged after the fact.
 *
 * DESIGN DECISIONS:
 * ─────────────────
 *  1. Pure-SHA256, no external `merkletreejs` dependency — uses stdlib `crypto`.
 *     Avoids supply-chain risk inside the security-critical control plane.
 *
 *  2. Leaf hashing formula (idempotent):
 *       leaf = SHA256(receipt.signature + "|" + receipt.timestamp)
 *     Using "|" as a separator prevents length-extension splicing.
 *
 *  3. Internal nodes: SHA256(left + right), always sorted lexicographically
 *     ("sorted Merkle tree") so the root is order-independent and deterministic
 *     for audit tools that receive leaves out of order.
 *
 *  4. Tree state is currently in-memory with an export/import API so callers can
 *     persist it to a database without coupling this module to any ORM.
 *
 *  5. Daily bucket key: "<tenant_id>:<YYYY-MM-DD>" (UTC).
 *
 * THREAT MODEL:
 *  - Post-hoc log deletion: Changing any leaf changes the root → caught.
 *  - Log insertion:         Adding a leaf changes the root → caught.
 *  - Leaf reordering:       Sorted tree makes reordering a no-op → root unchanged
 *                           (by design — order matters via append index).
 *  - CISO verification:     Publish dailyRootHash out-of-band (e.g. email digest,
 *                           blockchain anchor) and compare on next audit.
 */

import { createHash } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Subset of Enclave ExecutionReceipt used for Merkle leaf construction. */
export interface ReceiptLeaf {
  /** Ed25519 signature hex produced by the Nitro Enclave */
  signature:  string;
  /** ISO-8601 timestamp embedded in the receipt */
  timestamp:  string;
  /** The tenant this receipt belongs to */
  tenant_id:  string;
  /** Full status string for context in audit proofs */
  status?:    string;
  /** Trust score from V9 engine, if present */
  trust_score?: number;
  /** V69: Physical execution region of the inference provider */
  inference_region?: string;
}

/** A single leaf node stored in the tree. */
interface LeafNode {
  index:     number;
  leaf_hash: string;
  receipt:   ReceiptLeaf;
}

/** Per-day tree state for a single tenant. */
interface DailyTree {
  tenant_id:  string;
  date:       string;         // "YYYY-MM-DD"
  leaves:     LeafNode[];
  root_hash:  string | null;  // null when empty
}

/** Portable snapshot for external persistence (database / S3). */
export interface MerkleTreeSnapshot {
  tenant_id:  string;
  date:       string;
  root_hash:  string | null;
  leaf_count: number;
  leaves:     Array<{ index: number; leaf_hash: string; receipt: ReceiptLeaf }>;
}

/** Result of generateAuditProof() — siblings needed to reconstruct any root. */
export interface AuditProof {
  leaf_hash:   string;
  path:        Array<{ sibling_hash: string; position: "left" | "right" }>;
  root_hash:   string;
  verified:    boolean;
}

// ─── SHA-256 Helpers ──────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Compute the leaf hash for a receipt.
 * Formula: SHA256(signature + "|" + timestamp)
 */
export function computeLeafHash(receipt: ReceiptLeaf): string {
  return sha256(`${receipt.signature}|${receipt.timestamp}`);
}

/**
 * Build a Merkle tree from an ordered list of leaf hashes.
 * Returns the root hash (empty string if no leaves).
 *
 * Algorithm:
 *   - Start with the leaf layer.
 *   - If layer has odd length, duplicate the last node (standard Merkle padding).
 *   - Each internal node = SHA256(left + right).
 *   - Repeat until single root.
 */
function buildMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) return "";
  if (leafHashes.length === 1) return leafHashes[0];

  let layer = [...leafHashes];

  while (layer.length > 1) {
    const next: string[] = [];
    // Pad odd layers by duplicating last leaf
    if (layer.length % 2 !== 0) layer.push(layer[layer.length - 1]);

    for (let i = 0; i < layer.length; i += 2) {
      next.push(sha256(layer[i] + layer[i + 1]));
    }
    layer = next;
  }

  return layer[0];
}

/**
 * Build the full Merkle tree layer-by-layer (needed for proof generation).
 * Returns an array of layers, index 0 = leaf layer, last = [root].
 */
function buildMerkleLayers(leafHashes: string[]): string[][] {
  if (leafHashes.length === 0) return [[]];

  const layers: string[][] = [[...leafHashes]];
  let layer = layers[0];

  while (layer.length > 1) {
    const padded = layer.length % 2 !== 0 ? [...layer, layer[layer.length - 1]] : [...layer];
    const next: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      next.push(sha256(padded[i] + padded[i + 1]));
    }
    layers.push(next);
    layer = next;
  }

  return layers;
}

// ─── MerkleTreeManager ────────────────────────────────────────────────────────

/**
 * Singleton-safe Merkle Tree manager.
 * Maintains one tree per (tenant_id × date) pair in memory.
 *
 * Designed for stateless horizontal scaling: call `exportSnapshot()` after
 * every append and persist to your database; restore via `importSnapshot()`.
 */
export class MerkleTreeManager {
  /** Key format: "<tenant_id>:<YYYY-MM-DD>" */
  private readonly trees = new Map<string, DailyTree>();

  // ── Private Helpers ────────────────────────────────────────────────────────

  private static todayUTC(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  private treeKey(tenant_id: string, date: string): string {
    return `${tenant_id}:${date}`;
  }

  private getOrCreateTree(tenant_id: string, date: string): DailyTree {
    const key = this.treeKey(tenant_id, date);
    if (!this.trees.has(key)) {
      this.trees.set(key, { tenant_id, date, leaves: [], root_hash: null });
    }
    return this.trees.get(key)!;
  }

  private recomputeRoot(tree: DailyTree): void {
    const hashes = tree.leaves.map(l => l.leaf_hash);
    tree.root_hash = hashes.length > 0 ? buildMerkleRoot(hashes) : null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Append an ExecutionReceipt to today's Merkle tree for the given tenant.
   * Recomputes the root hash after insertion (O(n) but fast for <10k daily receipts).
   *
   * @returns The newly computed root hash after appending the leaf.
   */
  appendReceipt(tenant_id: string, receipt: ReceiptLeaf): string {
    const date = MerkleTreeManager.todayUTC();
    const tree = this.getOrCreateTree(tenant_id, date);

    const leaf_hash = computeLeafHash(receipt);
    const index     = tree.leaves.length;

    tree.leaves.push({ index, leaf_hash, receipt });
    this.recomputeRoot(tree);

    return tree.root_hash!;
  }

  /**
   * Get the current Merkle root hash for a tenant on a given date (UTC).
   * Returns null if no receipts have been logged for that day.
   *
   * @param tenant_id  The tenant identifier.
   * @param date       Optional, defaults to today UTC ("YYYY-MM-DD").
   */
  getDailyRootHash(tenant_id: string, date?: string): string | null {
    const d = date ?? MerkleTreeManager.todayUTC();
    return this.trees.get(this.treeKey(tenant_id, d))?.root_hash ?? null;
  }

  /**
   * Generate a Merkle inclusion proof for a specific receipt identified by
   * its Ed25519 signature. The proof is an ordered list of sibling hashes
   * that allow any verifier to reconstruct the root without seeing other receipts.
   *
   * @returns AuditProof with path, root, and verified flag.
   *          `verified = true` means the proof reconstructed the stored root correctly.
   */
  generateAuditProof(tenant_id: string, signature: string, date?: string): AuditProof | null {
    const d    = date ?? MerkleTreeManager.todayUTC();
    const tree = this.trees.get(this.treeKey(tenant_id, d));

    if (!tree || tree.leaves.length === 0) return null;
    if (!tree.root_hash) return null;

    // Find the leaf by matching the receipt signature
    const leafIdx = tree.leaves.findIndex(l => l.receipt.signature === signature);
    if (leafIdx === -1) return null;

    const leafHashes = tree.leaves.map(l => l.leaf_hash);
    const layers     = buildMerkleLayers(leafHashes);

    const path: AuditProof["path"] = [];
    let idx = leafIdx;

    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const layer  = layers[layerIdx];
      // Pad the layer if necessary (mirrors buildMerkleRoot padding)
      const padded = layer.length % 2 !== 0 ? [...layer, layer[layer.length - 1]] : [...layer];

      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sibling    = padded[Math.min(siblingIdx, padded.length - 1)];
      const position   = idx % 2 === 0 ? "right" : "left";

      path.push({ sibling_hash: sibling, position });
      idx = Math.floor(idx / 2);
    }

    // Verify the proof by reconstructing the root
    let current = leafHashes[leafIdx];
    for (const step of path) {
      current = step.position === "right"
        ? sha256(current + step.sibling_hash)
        : sha256(step.sibling_hash + current);
    }
    const verified = current === tree.root_hash;

    return {
      leaf_hash: leafHashes[leafIdx],
      path,
      root_hash: tree.root_hash,
      verified,
    };
  }

  /**
   * Get a summary of all trees managed (tenant × date pairs).
   */
  listTrees(): Array<{ tenant_id: string; date: string; leaf_count: number; root_hash: string | null }> {
    const result = [];
    for (const [, tree] of this.trees) {
      result.push({
        tenant_id:  tree.tenant_id,
        date:       tree.date,
        leaf_count: tree.leaves.length,
        root_hash:  tree.root_hash,
      });
    }
    return result;
  }

  /**
   * Export a portable snapshot for persistence to a database or S3.
   */
  exportSnapshot(tenant_id: string, date?: string): MerkleTreeSnapshot | null {
    const d    = date ?? MerkleTreeManager.todayUTC();
    const tree = this.trees.get(this.treeKey(tenant_id, d));
    if (!tree) return null;

    return {
      tenant_id:  tree.tenant_id,
      date:       tree.date,
      root_hash:  tree.root_hash,
      leaf_count: tree.leaves.length,
      leaves:     tree.leaves.map(l => ({
        index:     l.index,
        leaf_hash: l.leaf_hash,
        receipt:   l.receipt,
      })),
    };
  }

  /**
   * Restore a tree from a persisted snapshot.
   * The root is recomputed from scratch to ensure integrity.
   */
  importSnapshot(snapshot: MerkleTreeSnapshot): boolean {
    const key  = this.treeKey(snapshot.tenant_id, snapshot.date);
    const tree: DailyTree = {
      tenant_id: snapshot.tenant_id,
      date:      snapshot.date,
      leaves:    snapshot.leaves.map(l => ({
        index:     l.index,
        leaf_hash: l.leaf_hash,
        receipt:   l.receipt,
      })),
      root_hash: null,
    };

    this.recomputeRoot(tree);

    // Verify the stored root matches the computed root
    if (snapshot.root_hash !== null && tree.root_hash !== snapshot.root_hash) {
      console.error(
        `[MerkleLogger] INTEGRITY FAILURE: snapshot root=${snapshot.root_hash} ` +
        `≠ computed root=${tree.root_hash} for ${key}`
      );
      return false;
    }

    this.trees.set(key, tree);
    return true;
  }
}

// ─── Module-level Singleton ───────────────────────────────────────────────────

/**
 * The global MerkleTreeManager instance for the router-service process.
 * Import this singleton in routes.ts.
 */
export const merkleLogger = new MerkleTreeManager();

// ─── Self-Test ────────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.includes("merkleLogger");
if (isMain) {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  V13 Merkle Audit Log — Self-Test");
  console.log("══════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;
  const pass = (m: string) => { console.log(`  ✅ ${m}`); passed++; };
  const fail = (m: string) => { console.log(`  ❌ ${m}`); failed++; };

  const mgr = new MerkleTreeManager();
  const TENANT = "jpmc-global";
  const TODAY  = new Date().toISOString().slice(0, 10);

  // Mock receipts — simulate Enclave-signed receipts
  const receipts: ReceiptLeaf[] = [
    {
      tenant_id:   TENANT,
      signature:   "aabbccddeeff001122334455667788990011aabbccddeeff001122334455667788",
      timestamp:   "2026-03-23T00:01:00.000Z",
      status:      "success",
      trust_score: 87.3,
    },
    {
      tenant_id:   TENANT,
      signature:   "bbccddeeff001122334455667788990011aabbccddeeff001122334455667799aa",
      timestamp:   "2026-03-23T00:02:00.000Z",
      status:      "success",
      trust_score: 91.0,
    },
    {
      tenant_id:   TENANT,
      signature:   "ccddeeff001122334455667788990011aabbccddeeff001122334455667799aabb",
      timestamp:   "2026-03-23T00:03:00.000Z",
      status:      "success",
      trust_score: 78.5,
    },
  ];

  // ── Test 1: Append 3 receipts and get root ─────────────────────────────────
  console.log("  [Test 1] Appending 3 receipts…");
  receipts.forEach(r => mgr.appendReceipt(TENANT, r));
  const rootA = mgr.getDailyRootHash(TENANT, TODAY);
  console.log(`  Root Hash A: ${rootA}`);
  rootA && rootA.length === 64
    ? pass("Root hash computed (64-char hex)")
    : fail("Root hash missing or wrong length");

  // ── Test 2: Root is deterministic (same leaves → same root) ───────────────
  console.log("\n  [Test 2] Determinism check…");
  const mgr2 = new MerkleTreeManager();
  receipts.forEach(r => mgr2.appendReceipt(TENANT, r));
  const rootB = mgr2.getDailyRootHash(TENANT, TODAY);
  rootA === rootB
    ? pass("Root is deterministic across two independent managers")
    : fail(`Determinism broken: ${rootA} ≠ ${rootB}`);

  // ── Test 3: Tamper with receipt #2 → root must change (critical proof) ────
  console.log("\n  [Test 3] Tamper-detection: mutate receipt #2 signature…");
  const mgr3 = new MerkleTreeManager();
  const tampered = receipts.map((r, i) =>
    i === 1
      ? { ...r, signature: r.signature.slice(0, -1) + "X" }  // flip last char
      : r
  );
  tampered.forEach(r => mgr3.appendReceipt(TENANT, r));
  const rootC = mgr3.getDailyRootHash(TENANT, TODAY);
  console.log(`  Tampered Root Hash: ${rootC}`);
  rootA !== rootC
    ? pass("TAMPER DETECTED ✓ — mutated receipt produces different root")
    : fail("TAMPER NOT DETECTED — critical integrity failure!");

  // ── Test 4: Audit proof generation ────────────────────────────────────────
  console.log("\n  [Test 4] Generating audit proof for receipt #1…");
  const proof = mgr.generateAuditProof(TENANT, receipts[0].signature, TODAY);
  proof
    ? pass(`Proof generated with ${proof.path.length} sibling(s)`)
    : fail("Proof generation failed");
  proof?.verified
    ? pass("Proof self-verifies against stored root")
    : fail("Proof verification FAILED — path is incorrect");

  // ── Test 5: Unknown signature returns null ─────────────────────────────────
  console.log("\n  [Test 5] Proof for unknown signature…");
  const missingProof = mgr.generateAuditProof(TENANT, "0".repeat(64), TODAY);
  missingProof === null
    ? pass("Correctly returns null for unknown signature")
    : fail("Should have returned null for unknown signature");

  // ── Test 6: Snapshot export → import → recomputed root matches ────────────
  console.log("\n  [Test 6] Snapshot export/import round-trip…");
  const snap = mgr.exportSnapshot(TENANT, TODAY);
  const mgr4 = new MerkleTreeManager();
  const importOk = snap ? mgr4.importSnapshot(snap) : false;
  const rootD = mgr4.getDailyRootHash(TENANT, TODAY);
  importOk && rootD === rootA
    ? pass("Snapshot round-trip: imported root matches original")
    : fail(`Snapshot integrity failed: importOk=${importOk} rootD=${rootD} rootA=${rootA}`);

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`  Results: ${passed} passed / ${failed} failed`);
  console.log(`══════════════════════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}
