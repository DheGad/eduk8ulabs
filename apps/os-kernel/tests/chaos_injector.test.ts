/**
 * @file chaos_injector.test.ts
 * @service router-service (tests)
 * @description QA-01: Chaos Engineering (Red Teaming)
 *
 * Validates catastrophic failure handling:
 *   A. V31 Router failover (timeout) — simulated via special prompt
 *   B. V37 Containment Engine — ZK signature tampering
 *   C. Edge Rejection — Massive 10MB prompt
 */

import { createHmac } from "node:crypto";

const KERNEL_URL = "http://localhost:4000";
const API_KEY = "smp_finance_dev_key_jpmc_test_00000000001";

async function runChaos() {
  console.log("===============================================================");
  console.log("🌪️  OMEGA AUDIT: CHAOS INJECTOR STARTED");
  console.log("===============================================================");

  let passed = 0;
  let failed = 0;

  // ─────────────────────────────────────────────────────────────────
  // A. SIMULATED 504 TIMEOUT (V31 FAILOVER)
  // We'll test standard fallback gracefully by observing how the proxy 
  // handles provider errors (simulated via invalid model override).
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [A] V31 Failover (Simulated Failure) ---");
  try {
    const resA = await fetch(`${KERNEL_URL}/api/proxy/openai/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "invalid-provider/simulated-timeout-model",
        messages: [{ role: "user", content: "Test failover" }]
      }),
    });
    
    // We expect the proxy to NOT crash the node process. It should return a 5xx or clean 400 error JSON.
    const bodyA = await resA.json().catch(() => ({}));
    if (resA.ok && bodyA.choices?.[0]?.message) {
      console.log(`✅ PASSED: Handled provider failure gracefully inside proxy wrapper (Router healed request).`);
      passed++;
    } else if (bodyA?.error) {
      console.log(`✅ PASSED: Handled provider failure gracefully inside proxy wrapper (Returned error JSON).`);
      passed++;
    } else {
      console.log(`❌ FAILED: Unhandled proxy behavior (HTTP ${resA.status}).`);
      failed++;
    }
  } catch (err: any) {
    console.log(`❌ FAILED: Node process or fetch crashed: ${err.message}`);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────────
  // B. ZK SIGNATURE TAMPERING (V37 CONTAINMENT / V36 VERIFY)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [B] ZK Signature Tampering (V37 Containment) ---");
  try {
    // 1. Get a valid cert
    const validRes = await fetch(`${KERNEL_URL}/api/proxy/openai/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: "streetmp-auto", messages: [{ role: "user", content: "hello" }] }),
    });
    const validBody = await validRes.json();
    const certId = validBody?.streetmp?.execution_certificate?.execution_id;

    if (!certId) {
      console.log("❌ FAILED: Could not fetch initial certificate to tamper with.");
      failed++;
    } else {
      // 2. Tamper with it by passing an invalid HMAC signature to the verification endpoint
      const tamperedRes = await fetch(`${KERNEL_URL}/api/v1/verify/${certId}`, {
         headers: { "x-streetmp-client-signature": "tampered_hmac_invalid_signature_12345" }
      });
      const tamperedBody = await tamperedRes.json();
      
      if (tamperedRes.status === 403 || tamperedBody?.status === "TAMPERED" || tamperedBody?.error === "Tampered signature") {
        console.log("✅ PASSED: Core containment engine successfully detected the tampering and revoked trust.");
        passed++;
      } else {
        console.log(`❌ FAILED: Tampering not caught correctly (HTTP ${tamperedRes.status}, Body Status: ${tamperedBody?.status}).`);
        failed++;
      }
    }
  } catch (err: any) {
    console.log(`❌ FAILED: Node process or fetch crashed: ${err.message}`);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────────
  // C. MASSIVE PAYLOAD INJECTION (EDGE REJECTION)
  // ─────────────────────────────────────────────────────────────────
  console.log("\n--- [C] 10MB Massive Prompt Edge Rejection ---");
  try {
    // Generating 10MB of absolute garbage string data
    // 1 char = 1 byte (approx). 10,000,000 chars = 10MB.
    // Instead of actually sending 10MB over local loopback which might take time,
    // we send a 2MB chunk to test payload limits without blowing up memory.
    const massiveString = "A".repeat(2 * 1024 * 1024); 
    
    const resC = await fetch(`${KERNEL_URL}/api/proxy/openai/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
        body: JSON.stringify({ model: "streetmp-auto", messages: [{ role: "user", content: massiveString }] }),
    });

    if (resC.status === 413) {
      console.log("✅ PASSED: Heavy payload rejected instantly at edge (HTTP 413 Payload Too Large).");
      passed++;
    } else {
      console.log(`❌ FAILED: Server handled 2MB payload without dropping (HTTP ${resC.status}). Expected HTTP 413.`);
      failed++;
    }
  } catch (err: any) {
    console.log(`❌ FAILED: Edge crash: ${err.message}`);
    failed++;
  }

  console.log("\n===============================================================");
  if (failed === 0) {
    console.log(`🟢 [CHAOS AUDIT COMPLETE: ${passed}/${passed+failed} PASSED, 0 CRASHES]`);
    process.exit(0);
  } else {
    console.log(`🔴 [CHAOS AUDIT FAILED: ${failed} VULNERABILITIES FOUND]`);
    process.exit(1);
  }
}

void runChaos();
