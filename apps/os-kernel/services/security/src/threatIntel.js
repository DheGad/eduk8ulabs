"use strict";
/**
 * @file threatIntel.ts
 * @service os-kernel/services/security
 * @version V61
 * @description Dark Web Identity Threat Intelligence Engine — StreetMP OS
 *
 * Monitors authenticated user identities against simulated dark-web breach
 * databases (Collection #1, LinkedIn Dump, etc.). When a user's email is
 * found in a breach dataset, the engine flags them IDENTITY_COMPROMISED and
 * immediately revokes their session — blocking the AI route before any
 * sensitive data is processed.
 *
 * Tech Stack Lock : TypeScript · Node.js · Zero Python
 * Compliance      : NIST CSF · MITRE ATT&CK · Zero-Trust Identity Hygiene
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalThreatIntel = void 0;
const crypto_1 = __importDefault(require("crypto"));
const BREACH_DATABASES = [
    {
        name: "Collection #1 (2019)",
        recordCount: 772_904_991,
        discoveredYear: 2019,
        severity: "CRITICAL",
        compromisedPrefixes: ["a9", "b1", "c2", "d3", "e4"],
    },
    {
        name: "2024 LinkedIn Data Dump",
        recordCount: 700_000_000,
        discoveredYear: 2024,
        severity: "HIGH",
        compromisedPrefixes: ["f5", "a1", "b2", "9c", "8d"],
    },
    {
        name: "2025 Fintech Credential Leak",
        recordCount: 12_400_000,
        discoveredYear: 2025,
        severity: "CRITICAL",
        compromisedPrefixes: ["7e", "6f", "5a", "4b", "3c"],
    },
    {
        name: "RockYou2024 Password Corpus",
        recordCount: 9_948_575_739,
        discoveredYear: 2024,
        severity: "HIGH",
        compromisedPrefixes: ["2d", "1e", "0f", "aa", "bb"],
    },
    {
        name: "2023 MOVEit Supply Chain Breach",
        recordCount: 40_000_000,
        discoveredYear: 2023,
        severity: "CRITICAL",
        compromisedPrefixes: ["cc", "dd", "ee", "ff", "a0"],
    },
];
// Simulated known-compromised full emails (for demo determinism)
const KNOWN_COMPROMISED_EMAILS = new Set([
    "user04@acme.corp",
    "test@example.com",
    "admin@legacy-system.io",
    "breached@company.com",
]);
class IdentityThreatEngine {
    revokedSessions = new Set();
    threatLog = [];
    blockedCount = 14; // Seed from spec
    monitoredCount = 1402; // Seed from spec
    feedLatencyMs = 42;
    // ── Core Methods ─────────────────────────────────────────────
    /**
     * Checks whether an email has appeared in any known breach database.
     * Uses a k-anonymity prefix model (SHA-256) for privacy-preserving lookups.
     * No full email hash is transmitted to external services in production.
     */
    checkCredentialBreach(email) {
        const normalised = email.toLowerCase().trim();
        const emailHash = crypto_1.default.createHash("sha256").update(normalised).digest("hex");
        const prefix = emailHash.slice(0, 2); // First byte (2 hex chars)
        const breaches = [];
        // Known compromised set (deterministic for demo)
        const isKnownCompromised = KNOWN_COMPROMISED_EMAILS.has(normalised);
        // Check prefix against each breach database
        for (const db of BREACH_DATABASES) {
            if (isKnownCompromised || db.compromisedPrefixes.includes(prefix)) {
                breaches.push({
                    email: normalised,
                    breachSource: db.name,
                    exposedFields: this.inferExposedFields(db.severity),
                    discoveredAt: new Date(`${db.discoveredYear}-06-01`).getTime(),
                    severity: db.severity,
                });
                // Only match the first two most severe for demo clarity
                if (breaches.length >= 2 && !isKnownCompromised)
                    break;
            }
        }
        const riskScore = this.calculateRiskScore(breaches);
        const status = breaches.length > 0 ? "IDENTITY_COMPROMISED" : "CLEAR";
        const result = {
            email: normalised,
            status,
            breaches,
            blockedAt: status === "IDENTITY_COMPROMISED" ? Date.now() : null,
            riskScore,
            recommendation: status === "IDENTITY_COMPROMISED"
                ? "Force password reset. Revoke all active sessions. Notify user via secondary channel."
                : "Identity CLEAR. Continue authentication flow.",
        };
        this.threatLog.unshift(result);
        if (this.threatLog.length > 100)
            this.threatLog.pop();
        if (status === "IDENTITY_COMPROMISED") {
            this.revokedSessions.add(normalised);
            this.blockedCount++;
            console.error(`[V61:ThreatIntel] 🚨 IDENTITY_COMPROMISED | ${normalised} | ` +
                `${breaches.length} breach(es) | risk:${riskScore} | SESSION REVOKED`);
        }
        else {
            console.info(`[V61:ThreatIntel] ✅ CLEAR | ${normalised} | risk:${riskScore}`);
        }
        return result;
    }
    /**
     * Called before allowing IAM session continuation.
     * Throws SecurityExposureError if compromised; returns void if clear.
     */
    enforceIdentityHygiene(email) {
        if (!email)
            return; // Unknown email — pass through to IAM for further checks
        const result = this.checkCredentialBreach(email);
        if (result.status === "IDENTITY_COMPROMISED") {
            const topBreach = result.breaches[0];
            const err = {
                code: "SECURITY_EXPOSURE_DETECTED",
                email,
                breachSource: topBreach.breachSource,
                riskScore: result.riskScore,
                message: `SECURITY_EXPOSURE_DETECTED: ${email} found in "${topBreach.breachSource}". ` +
                    `Risk score: ${result.riskScore}/100. Session revoked. Force password reset required.`,
            };
            throw err;
        }
    }
    // ── Telemetry ─────────────────────────────────────────────────
    getBlockedCount() { return this.blockedCount; }
    getMonitoredCount() { return this.monitoredCount; }
    getFeedLatencyMs() { return this.feedLatencyMs; }
    getThreatLog() { return [...this.threatLog]; }
    isRevoked(email) { return this.revokedSessions.has(email.toLowerCase()); }
    getBreachDatabases() { return BREACH_DATABASES; }
    // ── Private Helpers ────────────────────────────────────────────
    inferExposedFields(severity) {
        const base = ["email", "password_hash"];
        if (severity === "MEDIUM" || severity === "HIGH" || severity === "CRITICAL")
            base.push("username", "ip_address");
        if (severity === "HIGH" || severity === "CRITICAL")
            base.push("phone", "dob");
        if (severity === "CRITICAL")
            base.push("SSN_partial", "credit_card_last4");
        return base;
    }
    calculateRiskScore(breaches) {
        if (breaches.length === 0)
            return 0;
        const severityWeights = {
            LOW: 20, MEDIUM: 40, HIGH: 70, CRITICAL: 95,
        };
        const maxScore = Math.max(...breaches.map(b => severityWeights[b.severity] ?? 0));
        const multiBreachBonus = breaches.length > 1 ? 5 : 0;
        return Math.min(100, maxScore + multiBreachBonus);
    }
}
// Singleton export
exports.globalThreatIntel = new IdentityThreatEngine();
