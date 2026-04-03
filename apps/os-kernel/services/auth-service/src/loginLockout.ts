/**
 * @file loginLockout.ts
 * @service auth-service
 * @version Phase3-AUTH-02
 * @description Account Lockout — Brute-Force Protection
 *
 * ================================================================
 * ALGORITHM
 * ================================================================
 *
 *  Tracks failed login attempts per email address using an
 *  in-process LRU-style Map (Redis-upgradeable).
 *
 *  Rules:
 *    • Each failed attempt increments `failCount`
 *    • After MAX_ATTEMPTS (10) failures, `lockedUntil` is set
 *      to now + LOCKOUT_WINDOW_MS (15 minutes)
 *    • Any login attempt while locked returns 429 immediately
 *      (before bcrypt runs — saves CPU from DoS amplification)
 *    • A SUCCESSFUL login clears the counter for that email
 *
 * ================================================================
 * SECURITY PROPERTIES
 * ================================================================
 *
 *  1. Lockout check runs BEFORE password hashing — prevents
 *     bcrypt amplification DoS during lockout window.
 *
 *  2. Rate-limiting is per-email (not per-IP) — prevents
 *     circumvention by rotating IPs.
 *
 *  3. Counter is cleared on successful login — prevents
 *     permanent accounts from being DoS-locked by attackers.
 *
 *  4. In-process Map => works with zero infra.
 *     Redis backend (see getSharedRedisClient) is the
 *     production upgrade path for multi-instance deployments.
 *
 * ================================================================
 * RESPONSE CODES
 * ================================================================
 *
 *   429 Too Many Requests — account is locked, retry-after header set
 *   403 Forbidden         — returned when email unknown but lockout
 *                           would be triggered (prevents enumeration)
 *
 * ================================================================
 */

// ── Constants ─────────────────────────────────────────────────────
const MAX_ATTEMPTS       = 10;
const LOCKOUT_WINDOW_MS  = 15 * 60 * 1000; // 15 minutes

// ── In-process store ──────────────────────────────────────────────
interface LockoutEntry {
  failCount:    number;
  lockedUntil:  number | null; // epoch ms, or null if not locked
  lastAttemptAt: number;        // for GC: drop stale entries
}

// Bounded map — max 50,000 entries (~5MB). Oldest entries evicted
// when full to prevent memory exhaustion from enumeration attacks.
const MAX_STORE_SIZE = 50_000;
const store          = new Map<string, LockoutEntry>();

// ── Helpers ───────────────────────────────────────────────────────

/** Returns the key used to track a given email address. */
function key(email: string): string {
  return `lockout:${email.trim().toLowerCase()}`;
}

/**
 * Evicts the oldest 10% of entries when the store reaches capacity.
 * Called lazily — only when a new entry would exceed MAX_STORE_SIZE.
 */
function evictOldest(): void {
  if (store.size < MAX_STORE_SIZE) return;
  const evictCount = Math.floor(MAX_STORE_SIZE * 0.1);
  let evicted = 0;
  for (const k of store.keys()) {
    store.delete(k);
    evicted++;
    if (evicted >= evictCount) break;
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Checks whether the email is currently locked.
 *
 * @returns { locked: true, retryAfterMs: number } if locked
 * @returns { locked: false } if not locked
 */
export function checkLockout(email: string): { locked: boolean; retryAfterMs?: number } {
  const entry = store.get(key(email));
  if (!entry) return { locked: false };

  if (entry.lockedUntil !== null) {
    const now = Date.now();
    if (now < entry.lockedUntil) {
      // Still locked
      return { locked: true, retryAfterMs: entry.lockedUntil - now };
    } else {
      // Lock has expired — reset the entry
      store.delete(key(email));
      return { locked: false };
    }
  }

  return { locked: false };
}

/**
 * Records a failed login attempt for the given email.
 * Activates the lockout if MAX_ATTEMPTS is exceeded.
 *
 * @returns the updated fail count after this attempt
 */
export function recordFailedAttempt(email: string): number {
  const k   = key(email);
  const now = Date.now();

  // Evict memory if near the limit before inserting
  evictOldest();

  const existing = store.get(k) ?? {
    failCount:     0,
    lockedUntil:   null,
    lastAttemptAt: now,
  };

  const updated: LockoutEntry = {
    failCount:     existing.failCount + 1,
    lockedUntil:   null,
    lastAttemptAt: now,
  };

  // Trigger lockout on exceeding the threshold
  if (updated.failCount >= MAX_ATTEMPTS) {
    updated.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(
      `[Phase3:Lockout] 🔒 Account locked: email="${email}" ` +
      `after ${updated.failCount} failed attempts. ` +
      `Locked until ${new Date(updated.lockedUntil).toISOString()}`
    );
  }

  store.set(k, updated);
  return updated.failCount;
}

/**
 * Clears the lockout counter for the given email.
 * Must be called on SUCCESSFUL login — prevents indefinite locks.
 */
export function clearLockout(email: string): void {
  store.delete(key(email));
}

/**
 * Returns human-readable lockout info — used for logging.
 * Returns null if the email is not in the store.
 */
export function getLockoutInfo(email: string): {
  failCount:   number;
  lockedUntil: number | null;
  isLocked:    boolean;
} | null {
  const entry = store.get(key(email));
  if (!entry) return null;
  const now      = Date.now();
  const isLocked = entry.lockedUntil !== null && now < entry.lockedUntil;
  return {
    failCount:   entry.failCount,
    lockedUntil: entry.lockedUntil,
    isLocked,
  };
}
