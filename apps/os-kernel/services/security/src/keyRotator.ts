/**
 * @file keyRotator.ts
 * @service os-kernel/services/security
 * @version V58
 * @description Automated AES-256 Vault Key Rotation Engine — StreetMP OS
 *
 * Manages the full lifecycle of V47 Sovereign Vault encryption keys.
 * On rotation: generates a fresh AES-256-GCM key, promotes the active key
 * to PREVIOUS_VERSION with a 5-minute expiry, and tracks version lineage.
 * Allows concurrent proxy requests to gracefully drain using their issued
 * version rather than being hard-cut during rotation.
 *
 * Tech Stack Lock : TypeScript · Node.js · Zero Python
 * Compliance      : NIST SP 800-57 · AES-256-GCM · Key Lifecycle Management
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export type KeyVersion = "ACTIVE" | "PREVIOUS" | "EXPIRED";

export interface VaultKey {
  version:    string;          // e.g. "v12.4.3"
  keyMaterial: string;         // Hex-encoded AES-256 key (32 bytes = 64 hex chars)
  algorithm:  "AES-256-GCM";
  state:      KeyVersion;
  createdAt:  number;
  expiresAt:  number | null;   // null = never (ACTIVE key)
  rotations:  number;          // how many times this key was used to rotate FROM
}

export interface RotationResult {
  previousVersion: string;
  newVersion:      string;
  rotatedAt:       number;
  expiresAt:       number;     // previous key expiry (now + 5 min)
}

// ================================================================
// VAULT KEY ROTATOR
// ================================================================

export class VaultKeyRotator {

  private readonly PREV_KEY_TTL_MS  = 5 * 60 * 1000;  // 5 minutes
  private readonly VERSION_PREFIX   = "v";
  private readonly ROTATION_POLICY  = 24 * 60 * 60 * 1000; // 24h default

  /** Key store — keyed by version string */
  private keyStore: Map<string, VaultKey> = new Map();

  /** Always the single source of truth for the current active version */
  private activeVersion: string;

  /** Rotation counter — used for version numbering */
  private rotationCount: number;
  private minorVersion:  number;
  private patchVersion:  number;

  constructor() {
    // Bootstrap with a valid initial key on startup
    this.rotationCount = 12;
    this.minorVersion  = 4;
    this.patchVersion  = 2;
    this.activeVersion = this.buildVersionString();

    const bootstrapKey: VaultKey = {
      version:     this.activeVersion,
      keyMaterial: this.generateKeyMaterial(),
      algorithm:   "AES-256-GCM",
      state:       "ACTIVE",
      createdAt:   Date.now() - 1000 * 60 * 60 * 14, // Simulates 14h old
      expiresAt:   null,
      rotations:   0,
    };

    this.keyStore.set(this.activeVersion, bootstrapKey);
    console.info(`[V58:KeyRotator] Vault initialised. Active key: ${this.activeVersion}`);
  }

  // ── Core Key Operations ──────────────────────────────────────

  /**
   * Returns the currently active key.
   * Called by proxyRoutes instead of the static MOCK_CLIENT_KEY.
   */
  public getCurrentKey(): VaultKey {
    const key = this.keyStore.get(this.activeVersion);
    if (!key) throw new Error(`[V58:KeyRotator] FATAL: Active key ${this.activeVersion} not found in store.`);
    return key;
  }

  /**
   * Retrieves any key by version string.
   * Allows in-flight proxy requests to complete using their issued version.
   */
  public getKey(version: string): VaultKey | undefined {
    const key = this.keyStore.get(version);
    if (!key) return undefined;

    // Lazily expire keys past their TTL
    if (key.expiresAt && Date.now() > key.expiresAt) {
      key.state = "EXPIRED";
    }

    return key;
  }

  /**
   * Main rotation cycle:
   * 1. Generate a new AES-256 key.
   * 2. Promote current ACTIVE → PREVIOUS with 5-min TTL.
   * 3. Install new key as ACTIVE.
   * 4. Purge EXPIRED keys older than the TTL.
   */
  public rotateKey(): RotationResult {
    const previousVersion = this.activeVersion;
    const previousKey     = this.keyStore.get(previousVersion);

    if (!previousKey) {
      throw new Error(`[V58:KeyRotator] Cannot rotate: previous key ${previousVersion} missing.`);
    }

    const expiresAt = Date.now() + this.PREV_KEY_TTL_MS;

    // Demote previous key
    previousKey.state     = "PREVIOUS";
    previousKey.expiresAt = expiresAt;
    previousKey.rotations += 1;

    // Generate new active key
    this.patchVersion += 1;
    const newVersion   = this.buildVersionString();
    this.activeVersion = newVersion;

    const newKey: VaultKey = {
      version:     newVersion,
      keyMaterial: this.generateKeyMaterial(),
      algorithm:   "AES-256-GCM",
      state:       "ACTIVE",
      createdAt:   Date.now(),
      expiresAt:   null,
      rotations:   0,
    };

    this.keyStore.set(newVersion, newKey);
    this.purgeExpiredKeys();

    console.info(
      `[V58:KeyRotator] 🔑 Key rotated: ${previousVersion} → ${newVersion} | ` +
      `Previous expires: ${new Date(expiresAt).toISOString()}`
    );

    return { previousVersion, newVersion, rotatedAt: Date.now(), expiresAt };
  }

  // ── Telemetry ─────────────────────────────────────────────────

  public getAllKeys(): VaultKey[] {
    // Lazily mark expired keys before returning
    for (const key of this.keyStore.values()) {
      if (key.expiresAt && Date.now() > key.expiresAt) key.state = "EXPIRED";
    }
    return [...this.keyStore.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  public getActiveVersion(): string {
    return this.activeVersion;
  }

  public getRotationPolicyMs(): number {
    return this.ROTATION_POLICY;
  }

  public getPreviousKeyExpiryMs(): number {
    return this.PREV_KEY_TTL_MS;
  }

  public getKeyAge(): number {
    const active = this.getCurrentKey();
    return Date.now() - active.createdAt;
  }

  // ── Private Helpers ────────────────────────────────────────────

  private generateKeyMaterial(): string {
    return crypto.randomBytes(32).toString("hex"); // 256-bit AES key
  }

  private buildVersionString(): string {
    return `${this.VERSION_PREFIX}${this.rotationCount}.${this.minorVersion}.${this.patchVersion}`;
  }

  private purgeExpiredKeys(): void {
    const now = Date.now();
    let purged = 0;
    for (const [ver, key] of this.keyStore.entries()) {
      if (key.state !== "ACTIVE" && key.expiresAt && now > key.expiresAt + this.PREV_KEY_TTL_MS) {
        this.keyStore.delete(ver);
        purged++;
      }
    }
    if (purged > 0) console.info(`[V58:KeyRotator] Purged ${purged} expired key(s).`);
  }
}

// Singleton export
export const globalKeyRotator = new VaultKeyRotator();
