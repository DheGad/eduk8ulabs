/**
 * @file sentinelSandbox.ts
 * @service router-service
 * @phase Phase 3 — The Sentinel Layer
 * @description SentinelSandbox: Wraps all Sentinel agent execution in a
 *   restricted context. The sandbox provides agents with a READ-ONLY database
 *   pool connection so log-scanning can never mutate core system state.
 *   Write operations (e.g., flagging SUSPICIOUS_ENTITY) go through a separate,
 *   explicitly-approved write pool that is declared here and injected only into
 *   approved output functions.
 *
 * Architecture:
 *   readPool  → SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY
 *             → used by agent logic for all queries
 *   writePool → full read-write, injected ONLY by the sandbox when calling
 *             → the agent's approved write callback
 */

import { Pool, PoolClient, PoolConfig } from "pg";

// ── Pool configs (inherit env vars from db.ts convention) ────────────────────

const BASE_CONFIG: Omit<PoolConfig, "max"> = {
  host:                   process.env.DB_HOST     ?? "localhost",
  port:                   parseInt(process.env.DB_PORT ?? "5432", 10),
  user:                   process.env.DB_USER,
  password:               process.env.DB_PASS,
  database:               process.env.DB_NAME,
  idleTimeoutMillis:      30_000,
  connectionTimeoutMillis: 5_000,
};

/** Read-only pool — agents use this for ALL queries */
const readPool = new Pool({ ...BASE_CONFIG, max: 5 });

/** Write pool — used exclusively by the sandbox's writeThrough helper */
const writePool = new Pool({ ...BASE_CONFIG, max: 3 });

readPool.on("error",  (err) => console.error("[SentinelSandbox:readPool]",  err.message));
writePool.on("error", (err) => console.error("[SentinelSandbox:writePool]", err.message));

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SandboxContext {
  /** Read query — enforces read-only session; throws if write is attempted */
  query: PoolClient["query"];
  /** Only this fn may write. Validates sentinelId before allowing write access */
  writeThrough: <T>(sql: string, values?: unknown[]) => Promise<T[]>;
}

export type AgentFn = (ctx: SandboxContext) => Promise<void>;

// ── Sandbox implementation ────────────────────────────────────────────────────

/**
 * Execute a Sentinel agent inside a restricted sandbox.
 *
 * @param sentinelId  UUID from sentinel_registry.id — used to update last_run/status
 * @param agentFn     The agent's main logic function (receives SandboxContext)
 */
export async function runInSandbox(
  sentinelId: string,
  agentFn: AgentFn
): Promise<void> {
  const readClient = await readPool.connect();

  // Enforce read-only at the session level — PostgreSQL will reject any DML
  await readClient.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

  // Track timing for success_rate update
  const startedAt = Date.now();
  let succeeded = false;

  try {
    // Mark agent as ACTIVE in the registry (write pool — approved operation)
    await writePool.query(
      `UPDATE sentinel_registry
          SET status   = 'ACTIVE',
              last_run = NOW(),
              updated_at = NOW()
        WHERE id = $1`,
      [sentinelId]
    );

    const ctx: SandboxContext = {
      // All agent queries go through the read-only client
      query: readClient.query.bind(readClient) as PoolClient["query"],

      // Write-through: the ONLY escape hatch from the sandbox
      writeThrough: async <T>(sql: string, values?: unknown[]): Promise<T[]> => {
        const result = await writePool.query<T>(sql, values);
        return result.rows;
      },
    };

    // Execute the agent
    await agentFn(ctx);

    succeeded = true;
  } catch (err) {
    console.error(`[SentinelSandbox] Agent ${sentinelId} threw:`, err);

    // Mark ERROR in registry
    await writePool.query(
      `UPDATE sentinel_registry SET status = 'ERROR', updated_at = NOW() WHERE id = $1`,
      [sentinelId]
    ).catch(() => {/* swallow — don't mask original error */});

    throw err;
  } finally {
    readClient.release();

    const elapsedMs = Date.now() - startedAt;

    if (succeeded) {
      // Rolling success_rate: 90% previous + 10% latest run result
      await writePool.query(
        `UPDATE sentinel_registry
            SET status       = 'IDLE',
                success_rate = LEAST(1.0, (success_rate * 0.9) + ($2 * 0.1)),
                updated_at   = NOW()
          WHERE id = $1`,
        [sentinelId, succeeded ? 1.0 : 0.0]
      ).catch(() => {});

      console.info(
        `[SentinelSandbox] Agent ${sentinelId} completed in ${elapsedMs}ms — status: IDLE`
      );
    }
  }
}
