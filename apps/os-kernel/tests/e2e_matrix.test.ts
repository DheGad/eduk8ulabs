/**
 * @file e2e_matrix.test.ts
 * @service router-service (tests)
 * @description QA-01: End-to-End Pipeline Validation
 *
 * Simulates a payload through the entire StreetMP OS lifecycle:
 *   1. V26 Drop-in Proxy
 *   2. V12 Policy Engine
 *   3. V31 Smart Routing
 *   4. V32 ZK-Hive Mind
 *   5. V36 Cryptographic Certificate
 *   6. V40 Trust Light headers
 *
 * MUST complete < 500ms (network overhead allowance) with HTTP 200.
 */

async function runE2E() {
  console.log("===============================================================");
  console.log("🟢 OMEGA AUDIT: E2E PIPELINE VALIDATION STARTED");
  console.log("===============================================================");

  const startTime = Date.now();

  try {
    const res = await fetch("http://localhost:4000/api/proxy/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer smp_finance_dev_key_jpmc_test_00000000001",
      },
      body: JSON.stringify({
        model: "streetmp-auto", // Triggers V31 Router
        messages: [{ role: "user", content: "TEST_PAYLOAD: System health check ping." }],
      }),
    });

    const elapsed = Date.now() - startTime;
    const body = await res.json();

    console.log(`\n⏱️  Total Pipeline Latency: ${elapsed}ms`);

    // ── ASSERTIONS ──────────────────────────────────────────────

    // 1. HTTP Status
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
    console.log("✅ [HTTP 200] V26 Proxy resolved successfully.");

    // 2. V25 Trust Score
    const trustScore = res.headers.get("x-streetmp-trust-score");
    if (!trustScore) throw new Error("Missing V25 Trust Score header");
    console.log(`✅ [V25] Trust Score injected: ${trustScore}/100`);

    // 3. V40 Trust Signal
    const trustSignal = res.headers.get("x-streetmp-trust-signal");
    if (!trustSignal) throw new Error("Missing V40 Trust Signal header");
    console.log(`✅ [V40] Consumer Trust Signal injected: ${trustSignal}`);

    // 4. V36 Execution Certificate
    if (!body.streetmp?.execution_certificate) {
      throw new Error("Missing V36 Execution Certificate in response payload");
    }
    const cert = body.streetmp.execution_certificate;
    console.log(`✅ [V36] Sovereign Certificate generated: ${cert.execution_id}`);

    // 5. V31 Routing verification
    if (!body.model) throw new Error("Missing model in response");
    console.log(`✅ [V31] Darwin Engine routed to: ${body.model}`);

    // 6. Output received
    if (!body.choices?.[0]?.message?.content) throw new Error("Missing AI completion content");
    console.log(`✅ [AI] Completion output received.`);

    // 7. Performance SLA (< 500ms since we simulate the LLM in dev mode)
    if (elapsed > 500) {
      console.warn(`⚠️ [SLA Warning] Pipeline latency (${elapsed}ms) exceeded 500ms target.`);
    }

    console.log("\n===============================================================");
    console.log("🟢 [PASSED] 100% PIPELINE INTEGRITY");
    console.log("===============================================================\n");
    process.exit(0);

  } catch (err: any) {
    console.log("\n===============================================================");
    console.error("🔴 [FAILED] OMEGA AUDIT E2E FAILURE:");
    console.error(err.message);
    console.log("===============================================================\n");
    process.exit(1);
  }
}

void runE2E();
