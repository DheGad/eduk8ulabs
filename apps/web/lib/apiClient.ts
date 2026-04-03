/**
 * @file apiClient.ts
 * @layer Layer 1 (Next.js frontend)
 * @description Centralized API client for communicating with Layer 2
 *              OS Kernel microservices.
 *
 * ================================================================
 * TOKEN MANAGEMENT
 * ================================================================
 * JWTs are stored in localStorage under the key "streetmp_token".
 * getToken() is always called at request time — never cached at
 * module level — so token refreshes are reflected immediately.
 *
 * All authenticated requests automatically receive:
 *   Authorization: Bearer <token>
 *
 * For Phase 2, this will migrate to httpOnly cookies with a
 * /auth/refresh endpoint, eliminating XSS token exposure.
 * ================================================================
 */

"use client";

// ----------------------------------------------------------------
// SERVICE URLS — from environment variables
// ----------------------------------------------------------------
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
  "http://localhost:4001/api/v1/auth";

const VAULT_URL =
  process.env.NEXT_PUBLIC_VAULT_SERVICE_URL ??
  "http://localhost:4002/api/v1/vault";

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ??
  "http://localhost:4000/api/v1";

const ENFORCER_URL =
  process.env.NEXT_PUBLIC_ENFORCER_SERVICE_URL ??
  "http://localhost:4003/api/v1";

const TRUST_URL =
  process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ??
  "http://localhost:4005/api/v1/trust";

// Root URL for trust-service payout/escrow routes (not prefixed with /trust)
const PAYOUT_URL =
  process.env.NEXT_PUBLIC_TRUST_SERVICE_URL
    ? process.env.NEXT_PUBLIC_TRUST_SERVICE_URL.replace("/api/v1/trust", "/api/v1")
    : "http://localhost:4005/api/v1";

const USAGE_SERVICE_URL =
  process.env.NEXT_PUBLIC_USAGE_SERVICE_URL ??
  "http://localhost:4004";

// ----------------------------------------------------------------
// TOKEN UTILITIES
// ----------------------------------------------------------------

const TOKEN_KEY = "streetmp_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// ----------------------------------------------------------------
// BASE FETCH WRAPPER
// Automatically attaches the Bearer token and normalizes errors.
// ----------------------------------------------------------------

/**
 * Normalized API error shape — every rejection from `apiFetch`
 * throws an `ApiError`, making error handling consistent at
 * the call-site level.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RawApiResponse<T> {
  success: boolean;
  data?: T;
  token?: string;
  user?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  [key: string]: unknown;
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  authenticated = false
): Promise<RawApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let body: RawApiResponse<T>;
  try {
    body = await response.json() as RawApiResponse<T>;
  } catch {
    throw new ApiError(
      "PARSE_ERROR",
      "Server returned an invalid response.",
      response.status
    );
  }

  if (!response.ok) {
    const err = body.error;
    throw new ApiError(
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? `Request failed with status ${response.status}`,
      response.status,
      err?.details
    );
  }

  return body;
}

// ----------------------------------------------------------------
// AUTH HELPERS
// ----------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  tier: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/**
 * Registers a new account, stores the returned JWT, and returns
 * the user + token for immediate redirect.
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  role?: "client" | "engineer"
): Promise<AuthResponse> {
  const body = await apiFetch<AuthUser>(
    `${AUTH_URL}/register`,
    {
      method: "POST",
      body: JSON.stringify({ email, password, ...(name && { name }), ...(role && { role }) }),
    }
  );

  const response = { token: body.token as string, user: body.user as AuthUser };
  setToken(response.token);
  return response;
}


/**
 * Logs in an existing user, stores the JWT in both localStorage AND
 * a browser cookie (so the Next.js middleware redirects correctly),
 * and returns the user + token.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  let body: RawApiResponse<AuthUser>;
  try {
    body = await apiFetch<AuthUser>(
      `${AUTH_URL}/login`,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
  } catch (err) {
    // Surface the raw backend error to the browser console for debugging
    console.error("[StreetMP:loginUser] Auth request failed:", err);
    throw err;
  }

  const token = body.token as string;
  const user  = body.user as AuthUser;

  if (!token) {
    console.error("[StreetMP:loginUser] No token in response body:", body);
    throw new ApiError("NO_TOKEN", "Auth service returned no token.", 500);
  }

  // Store in localStorage (for Bearer token on API calls)
  setToken(token);

  // ALSO write as a plain cookie so Next.js middleware (`auth_token`)
  // can read it on the edge without running in Node context.
  if (typeof document !== "undefined") {
    const maxAge = 24 * 60 * 60; // 24 hours in seconds
    document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }

  return { token, user };
}

/**
 * Clears the local JWT. Call this on logout buttons.
 */
export function logoutUser(): void {
  clearToken();
}

/**
 * Initiates a password reset flow by sending a code/token to the user's email.
 */
export async function forgotPassword(email: string): Promise<void> {
  await apiFetch(`${AUTH_URL}/forgot-password`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Resets the password using a valid token.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiFetch(`${AUTH_URL}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

// ----------------------------------------------------------------
// VAULT HELPERS
// ----------------------------------------------------------------

export type ApiProvider = "openai" | "anthropic" | "google" | "streetmp" | "auto";

/**
 * Encrypts and vaults a BYOK API key via the Vault Service.
 * Requires an authenticated session (JWT in localStorage).
 */
export async function saveByokKey(
  userId: string,
  provider: ApiProvider,
  apiKey: string
): Promise<void> {
  await apiFetch(
    `${VAULT_URL}/keys`,
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, provider, api_key: apiKey }),
    },
    true // authenticated — sends Bearer token
  );
}

// ----------------------------------------------------------------
// EXECUTION HELPERS
// ----------------------------------------------------------------

export interface ExecuteOptions {
  userId: string;
  prompt: string;
  provider: ApiProvider;
  model: string;
  tenantId?: string;
  dataClassification?: string;
}

export interface ExecuteResponse {
  output: string;
  model_used: string;
  provider: string;
  zk_proof?: {
    proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[]; protocol: string; curve: string };
    public_signals: string[];
    circuit_version: string;
    signal_labels: string[];
    verified: boolean;
    proved_at: string;
  };
  consensus_report?: {
    total_nodes: number;
    votes: number;
    quorum_required: number;
    dissenting_count: number;
    latency_ms: number;
  };
}

/**
 * Sends a prompt to the Router Service for direct LLM execution.
 */
export async function executePrompt(
  opts: ExecuteOptions
): Promise<ExecuteResponse> {
  const body = await apiFetch<ExecuteResponse>(
    `${ROUTER_URL}/execute`,
    {
      method: "POST",
      headers: {
        ...(opts.tenantId ? { "x-tenant-id": opts.tenantId } : {}),
        ...(opts.dataClassification ? { "x-data-classification": opts.dataClassification } : {}),
      },
      body: JSON.stringify({
        user_id: opts.userId,
        prompt: opts.prompt,
        provider: opts.provider,
        model: opts.model,
      }),
    },
    true
  );

  return body as unknown as ExecuteResponse;
}

/**
 * The full result shape returned by the Enforcer Service after
 * a successful deterministic JSON execution.
 */
export interface EnforceResult {
  /** Parsed, validated JSON object from the LLM */
  data: Record<string, unknown>;
  /** Total attempts taken by the retry loop (1–3) */
  attempts_taken: number;
  /** Model that produced the output (echoed from Router response) */
  model_used?: string;
  /** UUID of the usage_log row — links to execution_traces */
  usage_log_id?: string | null;
  /** V14 ZK-SNARK Execution Proof */
  zk_proof?: any;
  /** V15 Byzantine Consensus Report */
  consensus_report?: any;
  /** V22 Auto-Routed model reason */
  routing_reason?: string;
}

/**
 * Sends a prompt through the Enforcer Service for deterministic
 * structured JSON output.
 *
 * The Enforcer wraps the prompt in strict JSON instructions and
 * retries up to 3 times if the LLM returns invalid/incomplete JSON.
 *
 * Returns the validated JSON data object and attempts_taken for
 * HCQ telemetry display.
 */
export async function enforcePrompt(
  userId: string,
  provider: string,
  model: string,
  prompt: string,
  requiredKeys: string[],
  tenantId?: string,
  dataClassification?: string
): Promise<EnforceResult> {
  const body = await apiFetch<Record<string, unknown>>(
    `${ENFORCER_URL}/enforce`,
    {
      method: "POST",
      headers: {
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
        ...(dataClassification ? { "x-data-classification": dataClassification } : {}),
      },
      body: JSON.stringify({
        user_id: userId,
        prompt,
        provider,
        model,
        required_keys: requiredKeys,
      }),
    },
    true // authenticated — sends Bearer token
  );

  return body as unknown as EnforceResult;
}

// ----------------------------------------------------------------
// CLIENT-SIDE COST CALCULATION
// Mirrors pricing.ts in usage-service for real-time cost display
// without requiring a round-trip to the Usage Service.
// ----------------------------------------------------------------

const PRICING_MAP: Record<string, { in: number; out: number }> = {
  "gpt-4o":                         { in: 5.00,   out: 15.00  },
  "gpt-4o-mini":                    { in: 0.15,   out: 0.60   },
  "gpt-4-turbo":                    { in: 10.00,  out: 30.00  },
  "gpt-3.5-turbo":                  { in: 0.50,   out: 1.50   },
  "o1":                             { in: 15.00,  out: 60.00  },
  "o1-mini":                        { in: 1.10,   out: 4.40   },
  "claude-3-5-sonnet-20241022":     { in: 3.00,   out: 15.00  },
  "claude-3-5-haiku-20241022":      { in: 0.80,   out: 4.00   },
  "claude-3-opus-20240229":         { in: 15.00,  out: 75.00  },
  "claude-3-sonnet-20240229":       { in: 3.00,   out: 15.00  },
  "claude-3-haiku-20240307":        { in: 0.25,   out: 1.25   },
  "gemini-1.5-pro":                 { in: 3.50,   out: 10.50  },
  "gemini-1.5-flash":               { in: 0.075,  out: 0.30   },
  "mistral-large-latest":           { in: 2.00,   out: 6.00   },
  "mistral-small-latest":           { in: 0.20,   out: 0.60   },
};

/**
 * Estimates the USD cost of an LLM call for real-time client display.
 * Falls back to gpt-4o rates for unknown models (conservative upper-bound).
 *
 * @returns Cost as a formatted string with 8 decimal places, e.g. "0.00001950"
 */
export function calculateClientCost(
  model: string,
  tokensPrompt: number,
  tokensCompletion: number
): string {
  const rates = PRICING_MAP[model.toLowerCase()] ?? { in: 5.00, out: 15.00 };
  const cost =
    (tokensPrompt / 1_000_000) * rates.in +
    (tokensCompletion / 1_000_000) * rates.out;
  return cost.toFixed(8);
}

// Legacy alias — kept for backwards compatibility
export { enforcePrompt as enforceStructuredOutput };

// ----------------------------------------------------------------
// TRUST / HCQ HELPERS
// ----------------------------------------------------------------

export interface HcqProfile {
  user_id: string;
  total_executions: number;
  successful_first_try: number;
  hallucination_faults: number;
  global_hcq_score: string;   // "98.50" — comes as string from pg NUMERIC
  updated_at: string | null;
  is_default: boolean;        // true for brand-new users with no executions
}

/**
 * Fetches the HCQ reputation profile for any user.
 * Public endpoint — no authentication required.
 * Returns a default 100.00 profile if the user has no executions yet.
 */
export async function getHcqScore(userId: string): Promise<HcqProfile> {
  const body = await apiFetch<HcqProfile>(
    `${TRUST_URL}/hcq/${userId}`
  );
  return body.data as HcqProfile;
}

export interface UsageLogEntry {
  id: string;
  prompt_id: string;
  model_used: string;
  tokens_prompt: number;
  tokens_completion: number;
  total_cost: string;          // NUMERIC as string from pg
  validation_status: "success" | "hallucinated_retry" | "failed";
  created_at: string;
  // Joined from execution_traces when available
  attempts_taken?: number;
  prompt_signature?: string;
  final_output_payload?: Record<string, unknown>;
}

/**
 * Fetches recent usage logs for a user from the Usage Service summary
 * endpoint. The Usage Service aggregates the last N records.
 *
 * NOTE: Phase 1 returns summary data only. Phase 3 will add a
 * paginated /internal/usage/history endpoint for full trace listing.
 * For now we stub with the summary endpoint shape and the Glass Box
 * data captured locally in the UI state after each execution.
 */
export async function getExecutionHistory(
  userId: string
): Promise<UsageLogEntry[]> {
  // Usage summary is an internal endpoint — call via auth token.
  // If the usage service is unreachable, return empty array gracefully.
  try {
    const body = await apiFetch<{ summary: Record<string, number> }>(
      `http://localhost:4004/internal/usage/summary/${userId}`,
      {},
      true
    );
    // The summary endpoint returns aggregates, not individual records.
    // For Phase 1 UI, we surface the aggregate as a single pseudo-row
    // so the history section renders something meaningful.
    const s = (body as unknown as { summary: Record<string, number> }).summary;
    if (!s || typeof s.total_requests !== "number" || s.total_requests === 0) {
      return [];
    }
    return []; // Full per-row history requires Phase 3 paginated endpoint
  } catch {
    return [];
  }
}

// ================================================================
// PHASE 3: ENTERPRISE ADMIN TELEMETRY
// ================================================================

export interface EnterpriseNodeRow {
  node_id: string;
  client_name: string;
  is_active: boolean;
  billing_tier: string;
  billing_period: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_executions: number | null;
  service_health_status: string | null;
  signature_verified: boolean | null;
  received_at: string | null;
}

/**
 * Fetches the list of all registered nodes from the Usage Service HQ.
 * Includes the latest billing ledger entry for each node.
 */
export async function getEnterpriseNodes(): Promise<EnterpriseNodeRow[]> {
  const body = await apiFetch<{ nodes: EnterpriseNodeRow[] }>(
    `${USAGE_SERVICE_URL}/api/v1/telemetry/nodes`, // <--- WE WILL PROXY THIS OR DIRECT HIT
    {},
    true
  );
  return body.data?.nodes ?? (body.nodes as EnterpriseNodeRow[]) ?? [];
}

/**
 * Fetches the detailed paginated billing history for a specific node.
 */
export async function getNodeStats(nodeId: string): Promise<unknown[]> {
  const body = await apiFetch<{ ledger: unknown[] }>(
    `${USAGE_SERVICE_URL}/api/v1/telemetry/nodes/${nodeId}/ledger`,
    {},
    true
  );
  return body.data?.ledger ?? (body.ledger as unknown[]) ?? [];
}

/**
 * Updates a node's active status (The Master Kill Switch).
 */
export async function updateNodeStatus(
  nodeId: string,
  status: "active" | "suspended"
): Promise<void> {
  await apiFetch(
    `${USAGE_SERVICE_URL}/api/v1/admin/nodes/${nodeId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
    true
  );
}

// ================================================================
// PHASE 4: PAYOUT ENGINE (Stripe Connect)
// ================================================================

export interface PayoutBalanceEntry {
  amount: number;  // Smallest currency unit (cents for USD)
  currency: string;
}

export interface PayoutBalanceResponse {
  payouts_enabled: boolean;
  stripe_account_id?: string;   // Partially masked, client-safe
  available: PayoutBalanceEntry[];
  pending: PayoutBalanceEntry[];
  message?: string;             // Present when no Connect account is linked
}

/**
 * Generates a Stripe Connect Express onboarding link.
 * Takes the user through Stripe's hosted ID + bank account verification flow.
 */
export async function getOnboardingLink(country = "US"): Promise<string> {
  const body = await apiFetch<{ onboarding_url: string }>(
    `${PAYOUT_URL}/payouts/onboard`,
    {
      method: "POST",
      body: JSON.stringify({ country }),
    },
    true
  );
  return (body.data?.onboarding_url ?? (body as unknown as { onboarding_url: string }).onboarding_url);
}

/**
 * Retrieves the freelancer's Stripe Connect balance via the Trust Service.
 * The Trust Service uses its server-side Stripe key to query on behalf of the user — 
 * the Connect account ID is never sent to the browser.
 */
export async function getPayoutBalance(): Promise<PayoutBalanceResponse> {
  const body = await apiFetch<PayoutBalanceResponse>(
    `${PAYOUT_URL}/payouts/balance`,
    {},
    true
  );
  return body.data as PayoutBalanceResponse ?? body as unknown as PayoutBalanceResponse;
}

// ================================================================
// PHASE 4: MARKETPLACE (Public Discovery)
// ================================================================

export interface MarketplaceProfile {
  user_id: string;
  display_name: string;
  account_tier: string;
  hcq_score: string;
  tier_badge: "Elite" | "Verified" | "Rising";
  total_executions: number;
  first_try_success_rate: number;
  expertise: string;
  bank_verified: boolean;
  hcq_updated_at: string | null;
}

export interface MarketplaceFilters {
  min_hcq?: number;
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Public marketplace endpoint — no Authorization header required.
 * Returns HCQ-sorted freelancer profiles filtered by payouts_enabled=true.
 */
export async function getMarketplaceProfiles(
  filters: MarketplaceFilters = {}
): Promise<{ profiles: MarketplaceProfile[]; count: number }> {
  const params = new URLSearchParams();
  if (filters.min_hcq !== undefined) params.set("min_hcq", String(filters.min_hcq));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  if (filters.search) params.set("search", filters.search);

  const qs = params.toString() ? `?${params.toString()}` : "";
  // Public endpoint — no authenticated = false (no Bearer token)
  const body = await apiFetch<{ profiles: MarketplaceProfile[]; count: number }>(
    `${TRUST_URL}/marketplace${qs}`,
    {},
    false  // NO auth header — public endpoint
  );
  return {
    profiles: body.data?.profiles ?? (body.profiles as MarketplaceProfile[]) ?? [],
    count: body.data?.count ?? (body.count as number) ?? 0,
  };
}

// ================================================================
// PHASE 5: ESCROW JOB CREATION
// ================================================================

export interface CreateEscrowPayload {
  engineerId: string;        // The freelancer's user UUID
  amount: number;            // In USD cents (e.g. $100 → 10000)
  requirements: Record<string, unknown>; // JSON schema the output must match
}

export interface CreateEscrowResponse {
  escrow_id: string;           // UUID from escrow_contracts table
  client_secret: string;        // Stripe PaymentIntent client secret
  payment_intent_id: string;
  amount: number;
  currency: string;
}

export async function rentWorkflow(workflowId: string): Promise<{ success: boolean; payment_required: boolean; client_secret?: string }> {
  const trustBaseUrl = process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ?? "http://localhost:4005";
  const body = await apiFetch<any>(
    `${trustBaseUrl}/api/v1/escrow/rent-workflow`,
    {
      method: "POST",
      body: JSON.stringify({ workflow_id: workflowId }),
    },
    true
  );
  return (body.data ?? body) as any;
}

/**
 * Creates a new Stripe escrow contract via the Trust Service.
 *
 * The `amount` must be in the smallest currency unit (cents for USD).
 * The `requirements` object is stored as the required_json_schema —
 * the freelancer's AI output must conform to it for funds to be released.
 *
 * Returns the client_secret needed to confirm the card payment on the client.
 */
export async function createEscrowJob(
  payload: CreateEscrowPayload
): Promise<CreateEscrowResponse> {
  const trustBaseUrl =
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ??
    "http://localhost:4005";

  const body = await apiFetch<CreateEscrowResponse>(
    `${trustBaseUrl}/api/v1/escrow/create`,
    {
      method: "POST",
      body: JSON.stringify({
        // Map our client-friendly names to the server's escrow schema
        client_id:            getCurrentUserId(),      // The logged-in client
        freelancer_id:        payload.engineerId,
        amount:               payload.amount,
        required_json_schema: payload.requirements,
      }),
    },
    true  // Requires authentication
  );

  // Handle both { data: { escrow_id, ... } } and flat { escrow_id, ... } shapes
  const result = (body.data ?? body) as unknown as CreateEscrowResponse;
  if (!result.client_secret) {
    throw new Error("Escrow creation succeeded but no client_secret was returned.");
  }
  return result;
}

/**
 * Gets the current user's ID from the JWT payload stored in the cookie/localStorage.
 * Used to populate client_id in the escrow contract.
 */
function getCurrentUserId(): string {
  if (typeof window === "undefined") return "";
  // Try cookie first (httpOnly-compatible check via document.cookie for non-httpOnly)
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("auth_token="));
  const token = cookie
    ? cookie.trim().slice("auth_token=".length)
    : localStorage.getItem("auth_token") ?? "";
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { sub?: string };
    return payload.sub ?? "";
  } catch {
    return "";
  }
}

// ================================================================
// V2: PROOF OF EXECUTION VERIFICATION (PUBLIC)
// ================================================================

export interface ExecutionProofReceipt {
  proof_id:                   string;
  usage_log_id:               string;
  prompt_hash:                string;   // SHA-256 of the raw prompt
  output_hash:                string;   // SHA-256 of the validated JSON output
  schema_hash:                string;   // SHA-256 of the required_keys schema
  model_used:                 string;
  created_at:                 string;   // ISO timestamp
  is_cryptographically_valid: boolean;  // HMAC revalidation result
  validation_note:            string;   // Human-readable validation message
}

/**
 * Fetches and cryptographically revalidates a Proof of Execution receipt.
 *
 * PUBLIC endpoint — no authentication required.
 * Anyone with a proof_id can verify the integrity of an AI execution
 * without ever seeing the raw prompt or output.
 */
export async function verifyExecutionProof(
  proofId: string
): Promise<ExecutionProofReceipt> {
  const trustBaseUrl =
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ?? "http://localhost:4005";

  const body = await apiFetch<ExecutionProofReceipt>(
    `${trustBaseUrl}/api/v1/trust/verify/${proofId}`,
    {},
    false  // Public endpoint — no auth header
  );

  // Handle both { data: { proof: {...} } } and flat { proof: {...} } shapes
  const inner = body.data ?? (body as unknown as { proof: ExecutionProofReceipt }).proof ?? body;
  return inner as unknown as ExecutionProofReceipt;
}

// ================================================================
// V2: ENTERPRISE POLICY MANAGEMENT
// ================================================================

export interface PolicyRules {
  allowed_models?:     string[];
  max_daily_spend?:    number;
  force_sanitization?: boolean;
  blocked_keywords?:   string[];
}

/**
 * Creates or updates the governance policy for an organization.
 * Admin-only: requires a valid JWT with appropriate permissions.
 */
export async function updateEnterprisePolicy(
  orgId: string,
  rules: PolicyRules
): Promise<{ success: boolean; policy: { id: string; organization_id: string; rules: PolicyRules } }> {
  const policyBaseUrl =
    process.env.NEXT_PUBLIC_POLICY_SERVICE_URL ?? "http://localhost:4008";

  const body = await apiFetch<{ policy: { id: string; organization_id: string; rules: PolicyRules } }>(
    `${policyBaseUrl}/api/v1/policies`,
    {
      method: "POST",
      body: JSON.stringify({ organization_id: orgId, rules }),
    },
    true  // Requires auth
  );

  return { success: true, policy: (body.data?.policy ?? (body as unknown as { policy: { id: string; organization_id: string; rules: PolicyRules } }).policy)! };
}

// ================================================================
// V2: WORKFLOW ENGINE
// ================================================================

export interface WorkflowSummary {
  id:          string;
  name:        string;
  description: string | null;
  step_count:  number;
  created_at:  string;
}

export interface WorkflowExecutionResponse {
  success:      boolean;
  execution_id: string;
  status:       "running" | "completed" | "failed";
  message:      string;
  status_url:   string;
}

export interface WorkflowExecutionStatus {
  id:            string;
  workflow_id:   string;
  status:        "running" | "completed" | "failed";
  current_step?: string;
  step_results?: Record<string, unknown>;
  error_message?: string;
  started_at:    string;
  completed_at?: string;
  duration_ms:   number;
}

/**
 * Lists all workflow definitions for the authenticated user.
 */
export async function getWorkflows(): Promise<WorkflowSummary[]> {
  const workflowBaseUrl =
    process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";

  const body = await apiFetch<{ workflows: WorkflowSummary[] }>(
    `${workflowBaseUrl}/api/v1/workflows`,
    {},
    true
  );

  return body.data?.workflows ?? (body as unknown as { workflows: WorkflowSummary[] }).workflows ?? [];
}

/**
 * Triggers a workflow execution with an optional initial input payload.
 * Returns immediately with execution_id (202 Accepted) — poll status_url for results.
 */
export async function executeWorkflow(
  workflowId: string,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResponse> {
  const workflowBaseUrl =
    process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";

  const body = await apiFetch<WorkflowExecutionResponse>(
    `${workflowBaseUrl}/api/v1/workflows/${workflowId}/execute`,
    {
      method: "POST",
      body: JSON.stringify({ initial_input: initialInput }),
    },
    true
  );

  return (body.data ?? body) as unknown as WorkflowExecutionResponse;
}

/**
 * Polls the status of a running or completed workflow execution.
 * Call on an interval until status is 'completed' or 'failed'.
 */
export async function getWorkflowExecutionStatus(
  workflowId: string,
  executionId: string
): Promise<WorkflowExecutionStatus> {
  const workflowBaseUrl =
    process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";

  const body = await apiFetch<{ execution: WorkflowExecutionStatus }>(
    `${workflowBaseUrl}/api/v1/workflows/${workflowId}/executions/${executionId}`,
    {},
    true
  );

  return (body.data?.execution ?? (body as unknown as { execution: WorkflowExecutionStatus }).execution) as WorkflowExecutionStatus;
}

// ================================================================
// V2: ENGINEER HUB — Dashboard Data & Stripe Payouts
// ================================================================

export interface ExecutionTrace {
  id:             string;
  proof_id?:      string;
  model_used:     string;
  status:         "success" | "failed";
  attempts_taken: number;
  tokens_used?:   number;
  created_at:     string;
}

export interface EngineerDashboardData {
  user: {
    id:    string;
    name:  string;
    email: string;
  };
  hcq_profile: {
    global_hcq_score:    number;
    account_tier:        "rising" | "verified" | "elite";
    total_executions:    number;
    success_rate:        number;   // 0–100
    first_try_rate:      number;   // 0–100 (passed on attempt 1)
    payouts_enabled:     boolean;
    stripe_connect_id?:  string;
    available_balance?:  number;   // USD cents
    pending_balance?:    number;
  };
  recent_executions: ExecutionTrace[];
}

// ── Dashboard cache (3-second TTL) — prevents DB hammering on rapid refreshes ──
let _dashboardCache: { data: EngineerDashboardData; ts: number } | null = null;
const DASHBOARD_CACHE_TTL_MS = 3_000;

/**
 * Fetches the authenticated engineer's full dashboard data.
 * Implements a 3-second client-side cache so rapid page refreshes
 * or re-renders never duplicate the database read.
 * Pass `bust = true` to force a fresh fetch (used after Stripe return).
 */
export async function getEngineerDashboard(bust = false): Promise<EngineerDashboardData> {
  const now = Date.now();
  if (!bust && _dashboardCache && now - _dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) {
    return _dashboardCache.data;
  }

  const trustBaseUrl =
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ??
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL_INTERNAL ??
    "http://localhost:4005/api/v1/trust";

  const body = await apiFetch<EngineerDashboardData>(
    `${trustBaseUrl}/engineer/dashboard`,
    {},
    true   // Requires auth
  );

  const result = (body.data ?? body) as unknown as EngineerDashboardData;
  _dashboardCache = { data: result, ts: Date.now() };
  return result;
}

/**
 * Initiates a Stripe Connect Express onboarding session.
 * Sends an Idempotency-Key (UUID v4) so even if the user double-clicks
 * before the redirect fires, the trust-service will return the same
 * Stripe account link and never create a duplicate Connect account.
 * Returns a redirect URL — navigate `window.location.href` to it.
 */
export async function createStripeOnboardingLink(): Promise<{ onboarding_url: string }> {
  const trustBaseUrl =
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ??
    "http://localhost:4005/api/v1/trust";

  // Generate a crypto-quality UUID v4 (browser-native, no deps needed)
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const body = await apiFetch<{ onboarding_url: string }>(
    `${trustBaseUrl}/payouts/onboard`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    },
    true   // Requires auth
  );

  return (body.data ?? body) as unknown as { onboarding_url: string };
}

// ================================================================
// V2: CLIENT DASHBOARD — Mission Control Data
// ================================================================

export type EscrowStatus =
  | "pending_payment"   // Stripe payment intent created but not captured
  | "locked"            // Funds captured — Enforcer working
  | "validating"        // Enforcer submitted result; awaiting Trust Service sign-off
  | "released"          // Escrow released to engineer
  | "disputed"          // Client raised a dispute
  | "refunded";         // Refunded to client

export interface ActiveJob {
  id:              string;
  engineer_id:     string;
  engineer_name?:  string;
  description:     string;
  escrow_amount:   number;   // USD cents (Stripe amount)
  escrow_status:   EscrowStatus;
  proof_id?:       string;   // Set when execution is complete
  workflow_id?:    string;   // Set if job uses a DAG pipeline
  execution_id?:   string;   // Live workflow execution ID for polling
  created_at:      string;
  completed_at?:   string;
}

export interface ClientDashboardData {
  user: {
    id:    string;
    name:  string;
    email: string;
  };
  summary: {
    total_locked_usd_cents:    number;
    active_jobs_count:         number;
    completed_jobs_count:      number;
    total_spent_usd_cents:     number;
  };
  active_jobs:    ActiveJob[];
  completed_jobs: ActiveJob[];
  live_workflows: WorkflowExecutionStatus[];
}

// ── Client dashboard cache (3-second TTL) ──────────────────────
let _clientDashboardCache: { data: ClientDashboardData; ts: number } | null = null;
const CLIENT_DASHBOARD_CACHE_TTL_MS = 3_000;

/**
 * Fetches the authenticated client's complete mission control data:
 * escrow contracts, job statuses, and live DAG workflow progress.
 * Implements a 3-second cache to prevent Postgres connection pool exhaustion.
 * Pass `bust = true` to force a fresh read (post-action updates).
 */
export async function getClientDashboard(bust = false): Promise<ClientDashboardData> {
  const now = Date.now();
  if (!bust && _clientDashboardCache && now - _clientDashboardCache.ts < CLIENT_DASHBOARD_CACHE_TTL_MS) {
    return _clientDashboardCache.data;
  }

  const trustBaseUrl =
    process.env.NEXT_PUBLIC_TRUST_SERVICE_URL ??
    "http://localhost:4005/api/v1/trust";

  const body = await apiFetch<ClientDashboardData>(
    `${trustBaseUrl}/client/dashboard`,
    {},
    true  // Requires auth
  );

  const result = (body.data ?? body) as unknown as ClientDashboardData;
  _clientDashboardCache = { data: result, ts: Date.now() };
  return result;
}

// ================================================================
// COMMAND 059: AUTONOMOUS WORKFLOW BUILDER
// ================================================================

export interface AutonomousWorkflowPayload {
  name: string;
  organization_id: string;
  nodes: any[];
  edges: any[];
}

export async function createAutonomousWorkflow(payload: AutonomousWorkflowPayload): Promise<{ success: boolean; workflow_id: string }> {
  const workflowBaseUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";
  const body = await apiFetch<{ success: boolean; workflow_id: string }>(
    `${workflowBaseUrl}/api/v1/workflows`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id: getCurrentUserId(),
        workflow_name: payload.name,
        organization_id: payload.organization_id,
        nodes: payload.nodes,
        edges: payload.edges,
      }),
    },
    true
  );
  return (body.data ?? body) as unknown as { success: boolean; workflow_id: string };
}

export async function executeAutonomousWorkflow(workflowId: string): Promise<{ success: boolean; execution_id: string }> {
  const workflowBaseUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";
  const body = await apiFetch<{ success: boolean; execution_id: string }>(
    `${workflowBaseUrl}/api/v1/workflows/${workflowId}/execute`,
    {
      method: "POST"
    },
    true
  );
  return (body.data ?? body) as unknown as { success: boolean; execution_id: string };
}

export async function getWorkflowStatus(executionId: string): Promise<{ status: string; current_node: string; state_payload: Record<string, any>; cumulative_cost: string }> {
  const workflowBaseUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";
  const body = await apiFetch<any>(
    `${workflowBaseUrl}/api/v1/executions/${executionId}`,
    { method: "GET" },
    true
  );
  return (body.data ?? body) as any;
}

export async function getWorkflow(workflowId: string): Promise<any> {
  const workflowBaseUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";
  const body = await apiFetch<any>(
    `${workflowBaseUrl}/api/v1/workflows/${workflowId}`,
    { method: "GET" },
    true
  );
  return (body.data?.workflow ?? body.workflow) as any;
}

export async function getWorkflowStore(): Promise<any[]> {
  const workflowBaseUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ?? "http://localhost:4009";
  const body = await apiFetch<any>(
    `${workflowBaseUrl}/api/v1/workflows/store`,
    { method: "GET" },
    false // PUBLIC
  );
  return (body.data?.workflows ?? body.workflows) as any[];
}
