/**
 * @file stress-test.ts
 * @description Battle Simulator — 1,000 Parallel Requests to the OpenAI Proxy
 *
 * Implements C051 Task 1.
 * Fires 1,000 concurrent requests to the Enforcer, deliberately injecting
 * "Broken JSON" prompts to validate that the Repair Loop holds under pressure.
 *
 * Usage:
 *   npx ts-node scripts/stress-test.ts
 */

import axios from "axios";

// ================================================================
// CONFIG
// ================================================================
const TOTAL_REQUESTS = 1000;
const CONCURRENCY_BATCH = 50;   // Fire 50 in parallel at a time
const TARGET_URL = "http://localhost:4001/api/v1/execute"; // Enforcer Service
const AUTH_TOKEN = process.env.INTERNAL_ROUTER_SECRET || "dev_secret_token";
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

// ================================================================
// TRACKING STATE
// ================================================================
interface RequestResult {
  status: "success" | "repaired" | "error";
  latency_ms: number;
  attempts_taken?: number;
}

const results: RequestResult[] = [];
let passed = 0;
let repaired = 0;
let failed = 0;
let startTime: number;

// ================================================================
// BATTLE PAYLOAD — deliberately ambiguous prompt that LLMs often
// return as broken JSON (no quotes, trailing commas, etc.)
// ================================================================
function buildBrokenJsonPayload(i: number) {
  return {
    user_id: TEST_USER_ID,
    provider: "openai",
    model: "gpt-4o-mini",
    prompt: `Reply with this exact broken string as "output": {result: "stress_test_${i}", value: ${i}, tags: [broken, unquoted]}`,
    required_keys: ["output_summary", "confidence_score"],
    mode: "auto",
    debug: true,
    trace_id: `stress_test_trace_${i}_${Date.now()}`
  };
}

async function fireRequest(i: number): Promise<RequestResult> {
  const t0 = Date.now();
  try {
    const response = await axios.post(TARGET_URL, buildBrokenJsonPayload(i), {
      timeout: 10_000,
      headers: {
        "Content-Type": "application/json",
        "x-trace-id": `stress_${i}`
      }
    });

    const latency_ms = Date.now() - t0;
    const wasRepaired = response.data?.repair_used === true || (response.data?.attempts_taken ?? 1) > 1;
    
    return {
      status: wasRepaired ? "repaired" : "success",
      latency_ms,
      attempts_taken: response.data?.attempts_taken ?? 1
    };
  } catch (err: any) {
    return {
      status: "error",
      latency_ms: Date.now() - t0
    };
  }
}

async function runBatch(batchStart: number): Promise<void> {
  const promises = [];
  for (let i = batchStart; i < Math.min(batchStart + CONCURRENCY_BATCH, TOTAL_REQUESTS); i++) {
    promises.push(fireRequest(i));
  }
  const batchResults = await Promise.all(promises);
  batchResults.forEach(r => {
    results.push(r);
    if (r.status === "success") passed++;
    else if (r.status === "repaired") repaired++;
    else failed++;
  });
}

async function printReport() {
  const totalTime = Date.now() - startTime;
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const successRate = ((passed + repaired) / results.length) * 100;

  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║       STREETMP OS — BATTLE STRESS TEST RESULTS       ║");
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║  Total Requests: ${TOTAL_REQUESTS.toString().padEnd(37)}║`);
  console.log(`║  Total Time:     ${(totalTime / 1000).toFixed(2)}s ${" ".repeat(34)}║`);
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║  ✅ Passed (Clean):    ${passed.toString().padEnd(32)}║`);
  console.log(`║  🔧 Repaired (Auto):   ${repaired.toString().padEnd(32)}║`);
  console.log(`║  ❌ Failed (500):      ${failed.toString().padEnd(32)}║`);
  console.log(`║  📊 Success Rate:      ${successRate.toFixed(2)}% ${" ".repeat(29)}║`);
  console.log("╠═══════════════════════════════════════════════════════╣");
  console.log(`║  ⚡ Avg Latency:    ${Math.round(avgLatency)}ms ${" ".repeat(34)}║`);
  console.log(`║  📈 P95 Latency:    ${p95}ms ${" ".repeat(34)}║`);
  console.log(`║  📈 P99 Latency:    ${p99}ms ${" ".repeat(34)}║`);
  console.log("╚═══════════════════════════════════════════════════════╝");

  if (successRate >= 99.9 && avgLatency < 800) {
    console.log("\n🏆 VERDICT: ENTERPRISE READY — Pass all SLA thresholds.\n");
  } else {
    console.log("\n⚠️  VERDICT: SLA NOT MET — Investigation required.\n");
  }
}

async function main() {
  console.log(`\n🚀 StreetMP OS — Battle Stress Test`);
  console.log(`   Firing ${TOTAL_REQUESTS} requests at ${TARGET_URL}`);
  console.log(`   Concurrency: ${CONCURRENCY_BATCH}/batch\n`);

  startTime = Date.now();

  for (let batch = 0; batch < TOTAL_REQUESTS; batch += CONCURRENCY_BATCH) {
    process.stdout.write(`   Progress: ${batch}/${TOTAL_REQUESTS} (${Math.round((batch / TOTAL_REQUESTS) * 100)}%)...\r`);
    await runBatch(batch);
  }

  console.log(`\n   ✅ All ${TOTAL_REQUESTS} requests fired.\n`);
  await printReport();
}

main().catch(console.error);
