import { pool } from "../db.js";
import { MerkleTreeSnapshot } from "../merkleLogger.js";

/**
 * Persist the Merkle Tree snapshot to the immutable Vault ledger.
 * This represents the daily root hash for a tenant.
 */
export async function persistMerkleSnapshot(snapshot: MerkleTreeSnapshot): Promise<void> {
  const query = `
    INSERT INTO audit_vault_ledger (tenant_id, target_date, root_hash, leaf_count, snapshot_data)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (tenant_id, target_date)
    DO UPDATE SET
      root_hash = EXCLUDED.root_hash,
      leaf_count = EXCLUDED.leaf_count,
      snapshot_data = EXCLUDED.snapshot_data,
      updated_at = NOW()
  `;
  await pool.query(query, [
    snapshot.tenant_id,
    snapshot.date,
    snapshot.root_hash,
    snapshot.leaf_count,
    JSON.stringify(snapshot),
  ]);
}

/**
 * Fetch a previously stored Merkle Tree snapshot for verification.
 */
export async function getMerkleSnapshot(tenant_id: string, date: string): Promise<MerkleTreeSnapshot | null> {
  const query = `
    SELECT snapshot_data FROM audit_vault_ledger
    WHERE tenant_id = $1 AND target_date = $2
  `;
  const result = await pool.query(query, [tenant_id, date]);
  if (result.rows.length === 0) return null;
  return result.rows[0].snapshot_data as MerkleTreeSnapshot;
}
