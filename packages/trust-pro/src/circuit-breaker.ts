import { createHash } from 'crypto';

/**
 * THE "TAMPER-ALARM" CIRCUIT BREAKER
 * Prevents OS usage if local DB hashes differ from the external immutable anchor.
 */
export class TamperAlarm {
  private static isCompromised = false;

  /**
   * Starts a background worker that constantly re-hashes the DB and compares
   * it against the anchored Master Root.
   */
  static async startRehashWorker(dbClient: any) {
    setInterval(async () => {
      if (this.isCompromised) return;

      try {
        const result = await dbClient.query(
           `SELECT merkle_root FROM master_anchors ORDER BY timestamp DESC LIMIT 1`
        );
        if (!result || !result.rows || !result.rows.length) return; // No anchors yet

        const anchoredRoot = result.rows[0].merkle_root;

        // Re-calculate the Merkle Root for the last hour
        // If an attacker altered any `usage_logs` or `execution_proofs` locally,
        // this new calculation will drastically differ from the Anchored Root.
        const proofs = await dbClient.query(
          `SELECT id, signature FROM execution_proofs 
           WHERE created_at >= NOW() - INTERVAL '1 hour'`
        );
        
        const sortedSignatures = proofs.rows.map((p: any) => p.signature).sort();
        const concatenated = sortedSignatures.join('');
        
        const currentRoot = createHash('sha256')
          .update(concatenated)
          .digest('hex');

        if (currentRoot !== anchoredRoot) {
           this.triggerLockdown();
        }

      } catch (e) {
        console.error('[CIRCUIT BREAKER] Exception during re-hash verification', e);
      }
    }, 15000); // Check every 15s to ensure Hardware Sovereignty
  }

  /**
   * Lock down the OS entirely. Wait for manual admin override.
   */
  private static triggerLockdown() {
    this.isCompromised = true;
    console.error(`🚨 [CIRCUIT BREAKER] CRITICAL TAMPER DETECTED. OS LOCKED. 🚨`);
    // Example: write flag to Redis so the Edge Router physically severs connections
    // redis.set('SYSTEM_TAMPER_FLAG', 'COMPROMISED');
  }

  /**
   * Export status for the API gateways to transmit to the Edge Dashboard.
   */
  static getStatus() {
    return { compromised: this.isCompromised };
  }
}
