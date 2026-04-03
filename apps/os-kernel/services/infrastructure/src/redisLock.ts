/**
 * @file redisLock.ts
 * @service os-kernel/services/infrastructure
 * @version V54
 * @description Distributed Mutex Locking Engine — StreetMP OS
 *
 * Simulates a Redis-backed distributed lock (mutex / Redlock pattern) to prevent
 * race conditions when thousands of concurrent requests attempt to access or mutate
 * the same tenant partition or cryptographic vault key.
 *
 * Design:
 *   - acquireLock()  → spin-poll with exponential backoff until lock granted or timeout
 *   - releaseLock()  → validates lock ID before releasing (prevents foreign unlocks)
 *   - TTL expiry     → auto-releases stale locks to prevent deadlocks
 *   - Lock IDs       → cryptographically random 128-bit tokens
 *
 * Tech Stack Lock : TypeScript · Node.js · No Python
 * Compliance      : SOC 2 · Concurrency Safety · Deadlock Prevention
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export type LockStatus = "ACQUIRED" | "WAITING" | "EXPIRED" | "RELEASED" | "TIMEOUT";

export interface LockRecord {
  /** Unique 128-bit lock token — must be returned to release */
  lockId:       string;
  /** Resource key being protected (e.g. "tenant:alpha:vault") */
  resourceKey:  string;
  /** TTL in milliseconds from acquisition time */
  ttlMs:        number;
  /** UNIX ms timestamp when the lock was acquired */
  acquiredAt:   number;
  /** UNIX ms timestamp when the lock expires */
  expiresAt:    number;
  /** Caller identifier for telemetry (optional) */
  caller?:      string;
}

export interface AcquireResult {
  success:      boolean;
  lockId?:      string;
  resourceKey:  string;
  waitedMs:     number;
  status:       LockStatus;
  reason?:      string;
}

export interface ReleaseResult {
  success:     boolean;
  resourceKey: string;
  reason:      string;
}

// ================================================================
// DISTRIBUTED LOCK ENGINE
// ================================================================

export class DistributedLockEngine {
  /** In-memory lock registry — in production this is backed by Redis SET NX PX */
  private readonly registry = new Map<string, LockRecord>();

  /** Telemetry counters */
  private acquisitions      = 0;
  private releases          = 0;
  private timeouts          = 0;
  private racesPrevented    = 0;
  private totalWaitMs       = 0;
  private totalAcquireOps   = 0;

  // ── Private Helpers ─────────────────────────────────────────────

  /** Generate a cryptographically random 128-bit lock token */
  private generateLockId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /** Evict any locks whose TTL has expired — simulates Redis key expiry */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.registry.entries()) {
      if (record.expiresAt <= now) {
        this.registry.delete(key);
        console.warn(
          `[V54:DistLock] TTL expired — lock evicted for resource: ${key} (lock: ${record.lockId.slice(0, 8)}…)`
        );
      }
    }
  }

  /** Async sleep helper */
  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Attempts to acquire an exclusive mutex lock on `resourceKey`.
   *
   * Uses a spin-poll with 50ms base interval + jitter (exponential backoff)
   * to avoid thundering-herd on contested keys.
   *
   * @param resourceKey  The resource to lock (e.g. "tenant:alpha:vault").
   * @param ttlMs        Time-to-live for the lock in ms (default 5 000ms).
   * @param timeoutMs    Max time to wait for acquisition in ms (default 3 000ms).
   * @param caller       Optional caller tag for telemetry.
   * @returns `AcquireResult` with lock ID if successful, or timeout/failure info.
   */
  public async acquireLock(
    resourceKey: string,
    ttlMs       = 5_000,
    timeoutMs   = 3_000,
    caller?:    string,
  ): Promise<AcquireResult> {
    const start        = Date.now();
    let pollInterval   = 50;
    this.totalAcquireOps += 1;

    while (true) {
      this.evictExpired();

      const existing = this.registry.get(resourceKey);

      if (!existing) {
        // Lock is free — acquire atomically
        const lockId    = this.generateLockId();
        const now       = Date.now();
        const waitedMs  = now - start;

        const record: LockRecord = {
          lockId,
          resourceKey,
          ttlMs,
          acquiredAt: now,
          expiresAt:  now + ttlMs,
          caller,
        };

        this.registry.set(resourceKey, record);
        this.acquisitions += 1;

        if (waitedMs > 0) this.racesPrevented += 1;
        this.totalWaitMs += waitedMs;

        console.info(
          `[V54:DistLock] ACQUIRED — resource: ${resourceKey} | lock: ${lockId.slice(0, 8)}… | waited: ${waitedMs}ms | ttl: ${ttlMs}ms`
        );

        return { success: true, lockId, resourceKey, waitedMs, status: "ACQUIRED" };
      }

      // Lock is held — check timeout
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        this.timeouts += 1;
        console.error(
          `[V54:DistLock] TIMEOUT — resource: ${resourceKey} | waited: ${elapsed}ms | held by: ${existing.lockId.slice(0, 8)}…`
        );
        return {
          success:    false,
          resourceKey,
          waitedMs:   elapsed,
          status:     "TIMEOUT",
          reason:     `Lock held by ${existing.lockId.slice(0, 8)}… expires in ${Math.max(0, existing.expiresAt - Date.now())}ms`,
        };
      }

      // Back-off with jitter before next poll
      const jitter    = Math.floor(Math.random() * 30);
      pollInterval    = Math.min(pollInterval * 1.5, 500);
      await this.sleep(pollInterval + jitter);
    }
  }

  /**
   * Releases a previously acquired lock.
   *
   * Validates the provided `lockId` against the stored record to prevent
   * a different thread from accidentally releasing another's lock.
   *
   * @param resourceKey  The resource key that was locked.
   * @param lockId       The lock ID returned by `acquireLock`.
   */
  public releaseLock(resourceKey: string, lockId: string): ReleaseResult {
    this.evictExpired();
    const record = this.registry.get(resourceKey);

    if (!record) {
      return { success: false, resourceKey, reason: "Lock not found (already released or TTL expired)" };
    }

    if (record.lockId !== lockId) {
      console.error(
        `[V54:DistLock] FOREIGN UNLOCK BLOCKED — resource: ${resourceKey} | presented: ${lockId.slice(0, 8)}… | actual: ${record.lockId.slice(0, 8)}…`
      );
      return { success: false, resourceKey, reason: "Lock ID mismatch — foreign unlock blocked" };
    }

    this.registry.delete(resourceKey);
    this.releases += 1;

    console.info(
      `[V54:DistLock] RELEASED — resource: ${resourceKey} | lock: ${lockId.slice(0, 8)}… | held for: ${Date.now() - record.acquiredAt}ms`
    );
    return { success: true, resourceKey, reason: "Lock released successfully" };
  }

  // ── Telemetry ─────────────────────────────────────────────────

  public getActiveLocks(): LockRecord[] {
    this.evictExpired();
    return [...this.registry.values()];
  }

  public getActiveLockCount(): number {
    this.evictExpired();
    return this.registry.size;
  }

  public getTelemetry() {
    const avgWaitMs = this.totalAcquireOps > 0
      ? this.totalWaitMs / this.totalAcquireOps
      : 0;
    return {
      acquisitions:    this.acquisitions,
      releases:        this.releases,
      timeouts:        this.timeouts,
      racesPrevented:  this.racesPrevented,
      activeLocks:     this.getActiveLockCount(),
      avgWaitMs,
    };
  }
}

// ================================================================
// SINGLETON EXPORT — consumed by the proxy pipeline
// ================================================================
export const globalDistLock = new DistributedLockEngine();
