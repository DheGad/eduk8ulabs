/**
 * @file services/agentSwarm.ts
 * @service router-service
 * @version V77
 * @description Multi-Agent Orchestration Engine — The Swarm
 *
 * ================================================================
 * DESIGN CONTRACT
 * ================================================================
 *
 * Implements a sequential multi-agent "swarm" where specialized
 * AI agents pass work products to each other to solve a complex job.
 *
 * Agent Roster:
 * ─────────────
 *   COORDINATOR  — Breaks down the request and produces a structured
 *                  research brief for the downstream agents.
 *
 *   RESEARCHER   — Has access to ALL registered tools (subject to the
 *                  caller's RBAC role). Gathers raw data, invokes tools,
 *                  and produces an unformatted data dump.
 *
 *   SYNTHESIZER  — NO TOOLS. Receives the RESEARCHER's raw output as
 *                  context and transforms it into a professional report.
 *
 * Handoff Protocol:
 * ─────────────────
 *   1. COORDINATOR analyzes the user prompt → research brief
 *   2. RESEARCHER uses tools + brief → raw data payload
 *   3. SYNTHESIZER formats raw data → final polished report
 *   4. Final output persisted as the job result
 *
 * V70 Trace Timeline:
 * ───────────────────
 *   SWARM_COORDINATOR_DONE      — after step 1
 *   SWARM_RESEARCH_STARTED      — before step 2
 *   SWARM_RESEARCH_COMPLETE     — after step 2
 *   SWARM_HANDOFF_TO_SYNTHESIZER— before step 3
 *   SWARM_SYNTHESIS_COMPLETE    — after step 3
 *
 * RBAC:
 * ─────
 *   The original caller's role is carried through every stage.
 *   If the caller lacks read:market, executeToolWithRbac() in the
 *   RESEARCHER stage will return a DENIED error payload — blocked
 *   identically to the synchronous /execute path.
 *
 * ================================================================
 */

import OpenAI from "openai";
import { appendTraceEvent } from "../middleware/traceProvider.js";
import { ToolRegistry, executeToolWithRbac, type ToolContext } from "./toolRegistry.js";
import type { AgentJobPayload } from "./agentQueue.js";

// ----------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------

const LLM_REQUEST_TIMEOUT = 120_000; // 2 min per agent stage
const MAX_TOOL_ITERATIONS = 5;        // Per agent — not per job
const DEFAULT_MODEL       = "gpt-4o";

// ----------------------------------------------------------------
// AGENT PROFILES
// ----------------------------------------------------------------

/**
 * Represents a specialized agent configuration.
 * The system_prompt fully governs the agent's behavior and persona.
 */
export interface SwarmAgentProfile {
  /** Machine-readable identifier: COORDINATOR | RESEARCHER | SYNTHESIZER */
  id:            "COORDINATOR" | "RESEARCHER" | "SYNTHESIZER";
  /** Human-readable name for logging */
  displayName:   string;
  /** System prompt injected as the first message to this agent */
  systemPrompt:  string;
  /** If true, the full ToolRegistry is available to this agent */
  toolsEnabled:  boolean;
}

export const AGENT_ROSTER: Record<SwarmAgentProfile["id"], SwarmAgentProfile> = {

  COORDINATOR: {
    id:           "COORDINATOR",
    displayName:  "🧠 Coordinator",
    toolsEnabled: false,
    systemPrompt:
      `You are the Coordinator agent in a multi-agent StreetMP OS system.
Your ONLY job is to analyze the user's request and produce a structured
research brief that will be handed off to a specialized Researcher agent.

Output a concise research brief in this exact format:
---
RESEARCH_OBJECTIVE: [one sentence describing what must be researched]
KEY_PARAMETERS: [bullet list of specific data points needed]
CONTEXT: [any relevant context from the user's original request]
---

Do NOT attempt to answer the user's request yourself.
Do NOT output anything other than the research brief.`,
  },

  RESEARCHER: {
    id:           "RESEARCHER",
    displayName:  "🔍 Researcher",
    toolsEnabled: true,
    systemPrompt:
      `You are the Researcher agent in a multi-agent StreetMP OS system.
You will receive a research brief from the Coordinator. Your ONLY job is
to gather raw data by using the available tools.

Rules:
- Use tools aggressively to gather all requested data.
- Output raw data facts — do NOT format or beautify the output.
- If a tool call is denied due to permissions, note it as TOOL_DENIED.
- Do NOT write a final report. The Synthesizer will do that.
- End your output with the literal text: RESEARCH_COMPLETE`,
  },

  SYNTHESIZER: {
    id:           "SYNTHESIZER",
    displayName:  "📝 Synthesizer",
    toolsEnabled: false,
    systemPrompt:
      `You are the Synthesizer agent in a multi-agent StreetMP OS system.
You will receive raw research data gathered by the Researcher agent.
Your ONLY job is to transform this raw data into a polished, professional report.

Report requirements:
- Use clear headings (##) to organize sections.
- Write in professional, concise language.
- Highlight key findings with bold text (**).
- If any tools were TOOL_DENIED, note the limitation transparently.
- End with a ## Summary section of 3-5 bullet points.

Do NOT call any tools. Do NOT gather new data.`,
  },
};

// ----------------------------------------------------------------
// SINGLE AGENT EXECUTION (used per stage)
// ----------------------------------------------------------------

/**
 * Runs one agent stage with the given system prompt, user message,
 * and optional tools. Returns the final text output.
 *
 * @param client      - OpenAI client (shared across stages)
 * @param profile     - The agent profile driving this stage
 * @param userMessage - Input message from the previous stage (or original prompt)
 * @param toolCtx     - RBAC context — tools are gated here even if profile.toolsEnabled=true
 * @param model       - LLM model name
 * @param traceId     - V70 trace ID
 * @param traceStartAt- V70 trace start timestamp
 */
async function runAgentStage(
  client:       OpenAI,
  profile:      SwarmAgentProfile,
  userMessage:  string,
  toolCtx:      ToolContext,
  model:        string,
  traceId:      string,
  traceStartAt: number
): Promise<string> {

  // Build tool list — only if this agent profile allows tools
  const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
    profile.toolsEnabled
      ? Object.values(ToolRegistry).map((t) => ({
          type: "function" as const,
          function: {
            name:        t.name,
            description: t.description,
            parameters:  t.parameters,
          },
        }))
      : [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: profile.systemPrompt },
    { role: "user",   content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    appendTraceEvent(traceId, traceStartAt, `SWARM_${profile.id}_LLM_CALL`, {
      iteration: iterations,
      model,
    });

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 4096,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      throw new Error(`[V77] ${profile.displayName} returned empty response on iteration ${iterations}.`);
    }

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Agent wants to call tools — execute with RBAC enforcement
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const result = await executeToolWithRbac(
          toolCall.function.name,
          toolCall.function.arguments,
          toolCtx
        );
        messages.push({
          role:         "tool",
          tool_call_id: toolCall.id,
          content:      result,
        });
      }
    } else {
      // No tool calls — this is the final output for this stage
      return responseMessage.content ?? "";
    }
  }

  throw new Error(
    `[V77] ${profile.displayName} exceeded max tool iterations (${MAX_TOOL_ITERATIONS}).`
  );
}

// ----------------------------------------------------------------
// SWARM ORCHESTRATION LOOP
// ----------------------------------------------------------------

/**
 * Executes the full three-stage swarm pipeline:
 *   COORDINATOR → RESEARCHER → SYNTHESIZER
 *
 * Inherits the original caller's RBAC role through all stages.
 * Emits detailed V70 trace events for each handoff.
 *
 * Returns the final synthesized report string.
 */
export async function runSwarmLoop(payload: AgentJobPayload): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set — cannot execute swarm job.");
  }

  const { traceId, traceStartedAt } = payload;
  const model  = payload.model || DEFAULT_MODEL;

  // Shared client across all agent stages — one connection, multiple calls
  const client = new OpenAI({ apiKey, timeout: LLM_REQUEST_TIMEOUT });

  // Build the shared RBAC tool context — inherited by all agents
  const { parseRole } = await import("../security/rbacEngine.js");
  const toolCtx: ToolContext = {
    tenantId:      payload.tenantId,
    userId:        payload.userId,
    role:          parseRole(payload.rbacRole ?? null),
    traceId,
    traceStartedAt,
  };

  // ──────────────────────────────────────────────────────────────
  // STAGE 1: COORDINATOR
  // ──────────────────────────────────────────────────────────────
  console.info(`[V77:Swarm] 🧠 Stage 1 — COORDINATOR starting...`);

  appendTraceEvent(traceId, traceStartedAt, "SWARM_COORDINATOR_STARTED", {
    job_id:    payload.traceId,
    prompt_len: payload.prompt.length,
  });

  // V79 Memory Injection: tell the coordinator what memories exist
  // so it can instruct the researcher to retrieve them.
  const { getMemoryKeys } = await import("./agentMemory.js");
  const memoryKeys = await getMemoryKeys(payload.tenantId, payload.userId);
  
  const coordinatorProfile = { ...AGENT_ROSTER.COORDINATOR };
  if (memoryKeys.length > 0) {
    coordinatorProfile.systemPrompt += `\n\n[SYSTEM MEMORY INJECTION]
The user has long-term memories available. Known memory keys: [${memoryKeys.join(", ")}]
If these seem relevant to the user's request, instruct the RESEARCHER to fetch them using the 'core_recall_memory' tool.`;
  }

  const coordinatorOutput = await runAgentStage(
    client,
    coordinatorProfile,
    payload.prompt,
    toolCtx,
    model,
    traceId,
    traceStartedAt
  );

  appendTraceEvent(traceId, traceStartedAt, "SWARM_COORDINATOR_DONE", {
    brief_length: coordinatorOutput.length,
  });

  console.info(`[V77:Swarm] ✅ COORDINATOR done — brief length: ${coordinatorOutput.length} chars`);

  // ──────────────────────────────────────────────────────────────
  // STAGE 2: RESEARCHER
  // ──────────────────────────────────────────────────────────────
  console.info(`[V77:Swarm] 🔍 Stage 2 — RESEARCHER starting...`);

  appendTraceEvent(traceId, traceStartedAt, "SWARM_RESEARCH_STARTED", {
    research_brief_preview: coordinatorOutput.slice(0, 200),
  });

  // The researcher receives the coordinator's brief as the prompt
  const researchInput = `
You have been given the following research brief by the Coordinator:

${coordinatorOutput}

Original user request for context:
"${payload.prompt}"

Now gather all required data using your available tools.
`.trim();

  const researcherOutput = await runAgentStage(
    client,
    AGENT_ROSTER.RESEARCHER,
    researchInput,
    toolCtx,
    model,
    traceId,
    traceStartedAt
  );

  appendTraceEvent(traceId, traceStartedAt, "SWARM_RESEARCH_COMPLETE", {
    raw_data_length: researcherOutput.length,
  });

  console.info(`[V77:Swarm] ✅ RESEARCHER done — raw data: ${researcherOutput.length} chars`);

  // ──────────────────────────────────────────────────────────────
  // STAGE 3: SYNTHESIZER
  // ──────────────────────────────────────────────────────────────
  console.info(`[V77:Swarm] 📝 Stage 3 — SYNTHESIZER starting...`);

  appendTraceEvent(traceId, traceStartedAt, "SWARM_HANDOFF_TO_SYNTHESIZER", {
    raw_data_length:  researcherOutput.length,
  });

  const synthesizerInput = `
The Researcher agent has gathered the following raw data:

${researcherOutput}

The original user request was:
"${payload.prompt}"

Now synthesize this into a professional report.
`.trim();

  const finalReport = await runAgentStage(
    client,
    AGENT_ROSTER.SYNTHESIZER,
    synthesizerInput,
    toolCtx,
    model,
    traceId,
    traceStartedAt
  );

  appendTraceEvent(traceId, traceStartedAt, "SWARM_SYNTHESIS_COMPLETE", {
    report_length: finalReport.length,
  });

  console.info(`[V77:Swarm] ✅ SYNTHESIZER done — final report: ${finalReport.length} chars`);

  return finalReport;
}
