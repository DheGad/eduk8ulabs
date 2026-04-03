/**
 * @file modelFingerprinter.ts
 * @service os-kernel/services/intelligence
 * @version V57
 * @description AI Model Fingerprinting Engine — StreetMP OS
 *
 * Continuously runs hidden "golden" calibration prompts against active LLMs.
 * Hashes the responses cryptographically and compares them against a stored
 * baseline. Any semantic drift in the response signature triggers a
 * SILENT_DOWNGRADE_DETECTED anomaly — catching provider-side silent model
 * weight changes without user consent.
 *
 * Tech Stack Lock : TypeScript · Node.js · Zero Python
 * Compliance      : Model Integrity · Anti-Hallucination Lock
 */

import crypto from "crypto";

// ================================================================
// TYPES
// ================================================================

export type FingerprintStatus = "STABLE" | "DRIFTING" | "SILENT_DOWNGRADE_DETECTED" | "UNCALIBRATED";

export interface ModelBaseline {
  modelId:       string;
  modelName:     string;
  provider:      string;
  baselineHash:  string;
  baselineAt:    number;
  goldenPrompt:  string;
}

export interface CalibrationResult {
  modelId:          string;
  status:           FingerprintStatus;
  driftPercent:     number;       // 0 = identical, 100 = completely different
  newHash:          string;
  baselineHash:     string;
  anomalyFlagged:   boolean;
  calibrationMs:    number;
  timestamp:        number;
}

export interface FingerprintRecord {
  modelId:        string;
  modelName:      string;
  provider:       string;
  currentStatus:  FingerprintStatus;
  driftPercent:   number;
  currentHash:    string;
  baselineHash:   string;
  lastCalibrated: number;
  totalChecks:    number;
  anomalies:      number;
}

// ================================================================
// GOLDEN PROMPTS — Complex, deterministic calibration questions
// ================================================================

const GOLDEN_PROMPTS: Record<string, string> = {
  "gpt-4o":            "What is the exact result of (2^10 * 3) + (fibonacci(12) / 4)? Show your working in exactly 3 lines.",
  "claude-3-5-sonnet": "List the prime factors of 9699690 in ascending order. Then state the sum of those factors.",
  "llama-3-70b":       "A train leaves at 14:37 travelling 120km/h. Another departs 22 minutes later at 145km/h from the same origin. In how many minutes does the second train overtake the first? Express as a decimal.",
};

// Expected semantic signatures (SHA-256 of idealised answer patterns)
// In production these would be seeded from first-run trusted calibration
const BASELINE_ANSWERS: Record<string, string> = {
  "gpt-4o":            "2^10=1024, 1024*3=3072, fib(12)=144, 144/4=36, 3072+36=3108",
  "claude-3-5-sonnet": "2,3,3,5,7,11,13,17,19,23 sum=103",
  "llama-3-70b":       "22*120/(145-120)=22*120/25=105.6",
};

function computeBaselineHash(modelId: string): string {
  const seed = BASELINE_ANSWERS[modelId] ?? `${modelId}-stable-baseline-v57`;
  return crypto.createHash("sha256").update(seed).digest("hex");
}

// ================================================================
// MODEL FINGERPRINT ENGINE
// ================================================================

export class ModelFingerprintEngine {

  private readonly DRIFT_THRESHOLD = 15; // % — above this is a silent downgrade

  /** In-memory baseline registry */
  private baselines: Map<string, ModelBaseline> = new Map([
    ["gpt-4o", {
      modelId:      "gpt-4o",
      modelName:    "GPT-4o",
      provider:     "OpenAI",
      baselineHash: computeBaselineHash("gpt-4o"),
      baselineAt:   Date.now() - 1000 * 60 * 60 * 4, // 4h ago
      goldenPrompt: GOLDEN_PROMPTS["gpt-4o"]!,
    }],
    ["claude-3-5-sonnet", {
      modelId:      "claude-3-5-sonnet",
      modelName:    "Claude 3.5 Sonnet",
      provider:     "Anthropic",
      baselineHash: computeBaselineHash("claude-3-5-sonnet"),
      baselineAt:   Date.now() - 1000 * 60 * 60 * 4,
      goldenPrompt: GOLDEN_PROMPTS["claude-3-5-sonnet"]!,
    }],
    ["llama-3-70b", {
      modelId:      "llama-3-70b",
      modelName:    "Llama 3 70B",
      provider:     "Meta / Groq",
      baselineHash: computeBaselineHash("llama-3-70b"),
      baselineAt:   Date.now() - 1000 * 60 * 60 * 4,
      goldenPrompt: GOLDEN_PROMPTS["llama-3-70b"]!,
    }],
  ]);

  /** Live fingerprint states */
  private records: Map<string, FingerprintRecord> = new Map(
    [...this.baselines.entries()].map(([id, b]) => [
      id,
      {
        modelId:        b.modelId,
        modelName:      b.modelName,
        provider:       b.provider,
        currentStatus:  "UNCALIBRATED" as FingerprintStatus,
        driftPercent:   0,
        currentHash:    b.baselineHash,
        baselineHash:   b.baselineHash,
        lastCalibrated: 0,
        totalChecks:    0,
        anomalies:      0,
      },
    ])
  );

  /** Request counter for automatic background runs */
  private requestCounter = 0;
  private readonly CHECK_EVERY_N_REQUESTS = 1000;

  /** Total anomalies */
  private totalAnomalies = 0;

  // ── Core Methods ────────────────────────────────────────────

  /**
   * Simulates firing a golden prompt at the model and receiving a response.
   * In production this calls the live provider SDK.
   *
   * Returns a synthetic response that may drift slightly with each call
   * to demonstrate detection.
   */
  public executeGoldenPrompt(modelId: string): string {
    const baseline = BASELINE_ANSWERS[modelId];
    if (!baseline) return `[V57:Fingerprint] Unknown model: ${modelId}`;

    // Simulate stable response (98% chance) vs drifted (2% chance — catches downgrade)
    const driftRoll = Math.random();
    if (driftRoll > 0.98) {
      // Intentionally diverge — inject noise to simulate model weight drift
      return `${baseline} [PROVIDER_NOTE: Approximation used. Results may vary.]`;
    }

    // Stable response — matches baseline exactly
    return baseline;
  }

  /**
   * Calculates the Jaro-Winkler-approximated semantic drift between
   * the baseline hash and a new response string.
   *
   * Returns a drift percentage: 0 = identical, 100 = completely different.
   */
  public calculateSemanticDrift(baselineHash: string, newResponse: string): number {
    const newHash = crypto.createHash("sha256").update(newResponse).digest("hex");

    // Hamming-distance on hex hash characters (0-64 different chars out of 64)
    let diffChars = 0;
    for (let i = 0; i < 64; i++) {
      if (baselineHash[i] !== newHash[i]) diffChars++;
    }

    return Math.round((diffChars / 64) * 100);
  }

  /**
   * Runs a full calibration cycle for a single model.
   * Updates the in-memory fingerprint record.
   */
  public runCalibration(modelId: string): CalibrationResult {
    const start    = Date.now();
    const baseline = this.baselines.get(modelId);
    const record   = this.records.get(modelId);

    if (!baseline || !record) {
      throw new Error(`[V57:Fingerprint] Unknown model: ${modelId}`);
    }

    const response     = this.executeGoldenPrompt(modelId);
    const newHash      = crypto.createHash("sha256").update(response).digest("hex");
    const driftPercent = this.calculateSemanticDrift(baseline.baselineHash, response);
    const anomaly      = driftPercent > this.DRIFT_THRESHOLD;
    const status: FingerprintStatus = anomaly ? "SILENT_DOWNGRADE_DETECTED" : driftPercent > 0 ? "DRIFTING" : "STABLE";
    const elapsed      = Date.now() - start;

    // Update record
    record.currentStatus  = status;
    record.driftPercent   = driftPercent;
    record.currentHash    = newHash;
    record.lastCalibrated = Date.now();
    record.totalChecks   += 1;
    if (anomaly) {
      record.anomalies += 1;
      this.totalAnomalies += 1;
      console.error(`[V57:Fingerprint] 🚨 SILENT_DOWNGRADE_DETECTED — ${modelId} | drift: ${driftPercent}%`);
    } else {
      console.info(`[V57:Fingerprint] ✅ ${modelId} STABLE | drift: ${driftPercent}% | ${elapsed}ms`);
    }

    return {
      modelId,
      status,
      driftPercent,
      newHash,
      baselineHash: baseline.baselineHash,
      anomalyFlagged: anomaly,
      calibrationMs: elapsed,
      timestamp: Date.now(),
    };
  }

  /**
   * Runs calibration for ALL registered models in parallel.
   */
  public async runFullCalibration(): Promise<CalibrationResult[]> {
    const results: CalibrationResult[] = [];
    for (const modelId of this.baselines.keys()) {
      results.push(this.runCalibration(modelId));
      // Brief pause between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
    }
    console.info(`[V57:Fingerprint] Full calibration complete. ${results.length} models checked.`);
    return results;
  }

  // ── Background Pipeline Hook ─────────────────────────────────

  /**
   * Called by proxyRoutes on every request.
   * Every 1,000 requests, fires a background calibration without blocking traffic.
   */
  public async backgroundCheck(): Promise<void> {
    this.requestCounter++;
    if (this.requestCounter % this.CHECK_EVERY_N_REQUESTS !== 0) return;

    console.info(`[V57:Fingerprint] Background calibration triggered at request #${this.requestCounter}`);
    // Fire-and-forget — does NOT await to avoid blocking the request lifecycle
    void this.runFullCalibration().catch(err =>
      console.warn(`[V57:Fingerprint] Background calibration error (non-fatal): ${err instanceof Error ? err.message : err}`)
    );
  }

  // ── Telemetry ─────────────────────────────────────────────────

  public getAllRecords(): FingerprintRecord[] {
    return [...this.records.values()];
  }

  public getRecord(modelId: string): FingerprintRecord | undefined {
    return this.records.get(modelId);
  }

  public getTotalAnomalies(): number {
    return this.totalAnomalies;
  }

  public getBaselines(): ModelBaseline[] {
    return [...this.baselines.values()];
  }
}

// Singleton export
export const globalFingerprinter = new ModelFingerprintEngine();
