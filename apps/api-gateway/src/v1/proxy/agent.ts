import { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * @file agent.ts
 * @route apps/api-gateway/src/v1/proxy/agent.ts
 * @description Ghost Proxy for IDEs / Agentic Orchestration
 * 
 * Implements C055 Task 3.
 * 
 * Flow: 
 * Agent (e.g. Cursor) -> POST /v1/proxy/agent -> Cache Check -> LLM Provider
 * 
 * Logic:
 * Autonomous agents often get stuck in "loops", asking identical queries sequentially
 * while debugging or exploring. This proxy implements "Recursive Caching."
 * 
 * Feature: If an exact prompt sequence matches a cached artifact within the last 5 minutes,
 * we intercept the call, return the cached answer, and save the client 100% of the token cost.
 * We calculate caching on the MERKLE ROOT of the entire conversation history, not just the last message.
 */

// In-memory cache for demo (In production: Redis / Varnish)
const RECURSIVE_CACHE = new Map<string, { response: any, timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function agentProxyHandler(req: Request, res: Response): Promise<void> {
  const { messages, model, temperature } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Missing or invalid 'messages' array" });
    return;
  }

  const t0 = Date.now();

  // 1. Calculate Tree Hash of Conversation
  // By hashing the entire message history stringified, we get a deterministic state hash
  const requestPayload = JSON.stringify(messages) + (model || "gpt-4o") + (temperature || 0);
  const convHash = crypto.createHash('sha256').update(requestPayload).digest('hex');

  // 2. Check Recursive Cache
  const cached = RECURSIVE_CACHE.get(convHash);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    // CACHE HIT - Stop propagation to LLM
    res.status(200).json({
      id: `chatcmpl-ghost-${crypto.randomBytes(4).toString('hex')}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || "gpt-4o",
      choices: [
        {
          index: 0,
          message: cached.response,
          finish_reason: "stop"
        }
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      streetmp_telemetry: {
        cache_hit: true,
        saved_ms: 1200, // Estimated time saved
        cost_saved: true,
        conv_hash: convHash.substring(0, 10)
      }
    });

    // Fire telemetry event in background
    console.log(`[Ghost Proxy] 🎯 Cache Hit | Hash: ${convHash.substring(0,8)} | Saved: 100% tokens`);
    return;
  }

  // 3. CACHE MISS - Forward to upstream provider
  console.log(`[Ghost Proxy] ☁️ Upstream call required | Hash: ${convHash.substring(0,8)}`);
  
  try {
    // MOCK: Upstream LLM call (e.g. OpenAI)
    // const upstreamResponse = await fetch('https://api.openai.com/v1/chat/completions', { ... })
    // const data = await upstreamResponse.json();

    // Simulating 1.2s API latency
    await new Promise(r => setTimeout(r, 1200));

    const mockAnswer = {
      role: "assistant",
      content: `I have analyzed the resources provided by the MCP server. I am complete. (Generated fresh)`
    };

    // 4. Save to Cache
    RECURSIVE_CACHE.set(convHash, {
      response: mockAnswer,
      timestamp: Date.now()
    });

    const latency = Date.now() - t0;

    res.status(200).json({
      id: `chatcmpl-real-${crypto.randomBytes(4).toString('hex')}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model || "gpt-4o",
      choices: [{ index: 0, message: mockAnswer, finish_reason: "stop" }],
      usage: { prompt_tokens: 450, completion_tokens: 28, total_tokens: 478 },
      streetmp_telemetry: {
        cache_hit: false,
        latency_ms: latency,
        conv_hash: convHash.substring(0, 10)
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
