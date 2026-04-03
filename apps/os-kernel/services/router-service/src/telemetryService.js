/**
 * @file telemetryService.ts
 * @service router-service
 * @version V20
 * @description Trust Analytics & Risk Intelligence — Telemetry Data Layer
 *
 * Generates deterministic, realistic analytics payloads keyed by tenant_id.
 * In production, this would query ClickHouse or a time-series DB.
 * Here, we seed a pseudo-random generator from the tenant_id string so
 * the same tenant always gets the same "baseline" numbers, with a
 * realistic +/- daily variance layer on top.
 *
 * DESIGN: Read-Only. This module has zero side-effects on the
 * execution pipeline (V12 PAC Engine, V17 Governor, V18 Gateway).
 */
// ─── Deterministic PRNG seeded by tenant_id ──────────────────────────────────
// Simple mulberry32 PRNG so data is always consistent per tenant.
function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (Math.imul(h, 16777619) | 0) >>> 0;
    }
    return h;
}
function makePrng(seed) {
    let s = seed;
    return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ─── Tenant Personality Profiles ─────────────────────────────────────────────
// Each tenant has a volume multiplier and threat profile
const TENANT_PROFILES = {
    jpmc: { volumeBase: 142050, threatRate: 0.0085, latencyBase: 312, trustBase: 97, complianceBase: "A+" },
    stanford: { volumeBase: 28400, threatRate: 0.0120, latencyBase: 198, trustBase: 94, complianceBase: "A" },
    pentagon: { volumeBase: 61000, threatRate: 0.0042, latencyBase: 520, trustBase: 99, complianceBase: "A+" },
    "dev-sandbox": { volumeBase: 5200, threatRate: 0.0350, latencyBase: 145, trustBase: 78, complianceBase: "B" },
};
const VIOLATION_TEMPLATES = [
    "Attempted {model} access with TOP_SECRET classification",
    "Prompt injection pattern detected in user message",
    "PII data (SSN) identified before enclave sanitization",
    "Model tier violation: {model} disallowed for tenant policy",
    "Cognitive Governor: hostile intent score exceeded threshold",
    "ZK Proof verification failed for execution receipt",
    "Cross-tenant data reference detected in context",
    "Rate limit exceeded on financial data endpoint",
    "Unauthorized model override via x-model-override header",
    "Memory firewall: session isolation breach attempt",
];
const SECURITY_EVENT_DESCRIPTIONS = {
    V12_POLICY_DENY: [
        "Policy DENY: gpt-4o disallowed for SOVEREIGN_DEFENSE tenants",
        "Policy DENY: TOP_SECRET classification cannot route to CLOUD_ENTERPRISE models",
        "Policy DENY: Cross-border data transfer violates EU_GDPR_STRICT policy",
        "Policy DENY: Rate limit exceeded for FINANCIAL_GRADE tier",
    ],
    V17_COGNITIVE_BLOCK: [
        "Cognitive Governor: Prompt injection pattern confidence=0.94 QUARANTINED",
        "Cognitive Governor: Hallucination rate >35% detected — response BLOCKED",
        "Cognitive Governor: Social engineering attempt identified in LLM output",
        "Cognitive Governor: Sensitive data exfiltration attempt in response",
    ],
    V18_INVALID_KEY: [
        "Invalid API key: hash not found in key registry",
        "Revoked API key used from IP 203.0.113.45",
        "Non-smp prefix key fast-rejected (attempted OpenAI key format)",
        "API key associated with suspended tenant used",
    ],
    V16_PROOF_FAIL: [
        "ZK Proof: Merkle root mismatch — possible log tampering detected",
        "ZK Proof: Execution receipt signature invalid",
    ],
};
const MODELS = ["gpt-4o", "claude-3-5-sonnet", "mixtral-8x22b", "llama-3.1-70b", "gemini-1.5-pro"];
// ─── Core Generator ──────────────────────────────────────────────────────────
export function generateTelemetry(tenantId, periodDays = 7) {
    const seed = hashSeed(tenantId);
    const rng = makePrng(seed);
    const profile = TENANT_PROFILES[tenantId] ?? {
        volumeBase: Math.floor(8000 + rng() * 40000),
        threatRate: 0.01 + rng() * 0.03,
        latencyBase: 150 + Math.floor(rng() * 400),
        trustBase: 75 + Math.floor(rng() * 20),
        complianceBase: "B",
    };
    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalRequests = Math.floor(profile.volumeBase * (0.9 + rng() * 0.2));
    const threatsBlocked = Math.floor(totalRequests * profile.threatRate * (0.8 + rng() * 0.4));
    const cognitiveInterventions = Math.floor(threatsBlocked * (0.03 + rng() * 0.05));
    const policyDenials = threatsBlocked - cognitiveInterventions;
    const avgLatencyMs = Math.floor(profile.latencyBase * (0.95 + rng() * 0.1));
    const trustScore = Math.min(99, Math.floor(profile.trustBase + rng() * 2 - 1));
    // ── Time-Series ───────────────────────────────────────────────────────────
    const now = new Date();
    const timeSeries = [];
    const dailyBase = Math.floor(totalRequests / periodDays);
    for (let d = periodDays - 1; d >= 0; d--) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        const dayRng = rng();
        const dayVol = Math.floor(dailyBase * (0.7 + dayRng * 0.6));
        const dayThreat = Math.floor(dayVol * profile.threatRate * (0.5 + rng() * 1.0));
        timeSeries.push({
            date: date.toISOString().split("T")[0],
            requests: dayVol,
            threats: dayThreat,
            interventions: Math.floor(dayThreat * (0.03 + rng() * 0.05)),
            latency_ms: Math.floor(profile.latencyBase * (0.85 + rng() * 0.3)),
        });
    }
    // ── Top Violations ────────────────────────────────────────────────────────
    const violationPool = [...VIOLATION_TEMPLATES].sort(() => rng() - 0.5).slice(0, 5);
    let remaining = threatsBlocked;
    const topViolations = violationPool.map((template, i) => {
        const model = MODELS[Math.floor(rng() * MODELS.length)];
        const reason = template.replace("{model}", model);
        const count = i === violationPool.length - 1
            ? remaining
            : Math.floor(remaining * (0.2 + rng() * 0.3));
        remaining -= count;
        const pct = parseFloat(((count / threatsBlocked) * 100).toFixed(1));
        return { reason, count: Math.max(1, count), pct };
    });
    // ── Recent Security Events ────────────────────────────────────────────────
    const eventTypes = [
        "V12_POLICY_DENY", "V17_COGNITIVE_BLOCK", "V18_INVALID_KEY", "V16_PROOF_FAIL",
    ];
    const severities = ["CRITICAL", "HIGH", "HIGH", "MEDIUM", "LOW"];
    const recentEvents = Array.from({ length: 8 }, (_, i) => {
        const type = eventTypes[Math.floor(rng() * eventTypes.length)];
        const descriptions = SECURITY_EVENT_DESCRIPTIONS[type];
        const desc = descriptions[Math.floor(rng() * descriptions.length)];
        const minutesAgo = Math.floor(rng() * 60 * 24 * 2); // last 48 hrs
        const ts = new Date(now.getTime() - minutesAgo * 60000);
        const severity = severities[Math.floor(rng() * severities.length)];
        const model = MODELS[Math.floor(rng() * MODELS.length)];
        return {
            id: `evt_${seed.toString(16)}_${i}`,
            timestamp: ts.toISOString(),
            type,
            severity,
            description: desc,
            tenant_id: tenantId,
            model,
            action: type === "V12_POLICY_DENY" || type === "V17_COGNITIVE_BLOCK" ? "BLOCKED" : "REJECTED",
        };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return {
        tenant_id: tenantId,
        generated_at: now.toISOString(),
        period_days: periodDays,
        total_requests: totalRequests,
        threats_blocked: threatsBlocked,
        cognitive_interventions: cognitiveInterventions,
        policy_denials: policyDenials,
        avg_latency_ms: avgLatencyMs,
        trust_score: trustScore,
        compliance_rating: profile.complianceBase,
        time_series: timeSeries,
        recent_events: recentEvents,
        top_violations: topViolations,
    };
}
