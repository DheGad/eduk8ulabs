# RED TEAM SOURCE CODE AUDIT: StreetMP OS

This document outlines the findings of a localized Static Application Security Testing (SAST) sweep across the StreetMP OS frontend and backend architecture (`apps/web` and `apps/os-kernel`). 

---

## 1. Authentication Bypasses
**Vulnerability**: Unauthenticated M2M Proxy Routes  
**Severity**: **HIGH**  
**Location**: `apps/os-kernel/services/router-service/src/proxyRoutes.ts` (Lines 621-730)  
**Description**: The V41 Sovereign Handshake endpoints (`POST /m2m/handshake`, `GET /m2m/stats`, `GET /m2m/agents`) are mounted directly onto `proxyRouter` but do not actively enforce `x-api-key` validation or IAM clearance within the route logic like the `/v1/chat/completions` proxy handler does. This allows any external entity hitting the routed proxy boundary to query internal agent statistics and orchestrate rogue zero-knowledge handshakes.

## 2. Injection Flaws
**Vulnerability**: None Detected (SQL Injection Safe)  
**Severity**: **LOW**  
**Location**: `apps/os-kernel/services/auth-service/src/routes.ts`  
**Description**: All dynamic queries directed to PostgreSQL (via the `pg` pool) utilize strict parameterized inputs (e.g., `WHERE email = $1`). This neutralizes standard SQL injection vectors. The `packages/database/schema.sql` also strictly enforces UUID v4 schemas preventing ID enumeration.

## 3. Data Leaks
**Vulnerability**: None Detected (Identity Object Masking)  
**Severity**: **LOW**  
**Location**: `apps/os-kernel/services/auth-service/src/routes.ts` (Lines 221-226, 363-368)  
**Description**: While backend queries fetch `password_hash` from the schema to validate credentials via bcrypt, the DTO mapping strictly masks the password hash and returns only `{ id, email, tier, role }` to the frontend client. There is no bloat or inadvertent PII leakage in the session identity object.

## 4. API Key Storage
**Vulnerability**: None Detected (Cryptographically Sealed)  
**Severity**: **LOW**  
**Location**: `packages/database/schema.sql` (Lines 101-123) & `auth-service/src/routes.ts` (Line 433)  
**Description**: Enterprise OpenAI (BYOK) keys are fortified using AES-256-GCM encryption with mathematically distinct IVs and Authentication Tags. Standard user-generated S2S API keys are never stored; only their SHA-256 `api_key_hash` is retained in the datastore, making key-recovery mathematically impossible even in the event of a total database breach.

## 5. Rate Limiting Gaps
**Vulnerability**: Missing DDoS Protection on Public Endpoints  
**Severity**: **CRITICAL**  
**Location**: `apps/os-kernel/services/router-service/src/index.ts` (Lines 237-243)  
**Description**: The service declares an `authRateLimiter`, `proxyLimiter`, and `adminRateLimiter`. However, the public routes (`scannerRouter`, `verificationRouter`, `legalRouter`, and `webhookRouter`) are mounted securely at bottom but *without* any rate limiters applied. A targeted volumetric attack against `/api/v1/public/scan` or `/api/v1/verify` could trigger massive CPU pipeline workloads (running cryptographic validation or semantic scanning) and overwhelm the Node.js event loop.

---

## 🏴‍☠️ Hacker's Summary
If I were to exploit this system moving into production, I would ignore the hardened `/dashboard` and JWT gateways entirely, as the Edge Middleware and RBAC are sealed tight. Instead:

1. **Volume Exhaustion**: I would orchestrate a distributed botnet to slam the unprotected `/api/v1/public/scan` and `/api/v1/verify` endpoints. Because they lack the Redis-backed `proxyLimiter`, I could force the server into cryptographic exhaustion, skyrocketing the CPU workload and effectively achieving an application-layer DDoS.
2. **M2M Reconnaissance**: Since the V41 M2M endpoints are entirely uncredentialed inside `proxyRoutes.ts`, I would immediately start polling `/api/proxy/openai/m2m/agents` to map out internal enterprise AI swarms, and subsequently bombard `/m2m/handshake` to poison the internal handshake ledger.
