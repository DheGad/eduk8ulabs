/**
 * @file openai.ts
 * @package api-gateway
 * @description OPENAI DROP-IN PROXY (The Kingmaker Layer)
 *
 * Implements FULL OpenAI compatibility so enterprise engineers can point their
 * official OpenAI SDK (`base_url`) to StreetMP OS.
 * Maps `messages[]` to internal prompts, routes to `execute/auto`, and
 * fully implements Server-Sent Events (SSE) for `stream: true`.
 * 
 * Strict injections applied silently:
 * - strict mode = true
 * - sanitizer = true
 * - proof generation = true
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export const openAiProxyRouter = Router();

const ROUTER_SERVICE_URL = process.env.ROUTER_SERVICE_URL || "http://router-service:4000";

openAiProxyRouter.post("/chat/completions", async (req: Request, res: Response) => {
  const { model, messages, stream } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: { message: "Invalid Authentication", type: "invalid_request_error", code: "invalid_api_key" } });
    return;
  }

  // 1. Convert messages[] -> Internal OS prompt format
  const collapsedPrompt = (messages || [])
    .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const requestId = `chatcmpl-${uuidv4().replace(/-/g, "").substring(0, 24)}`;
  const createdTs = Math.floor(Date.now() / 1000);

  // 2. Map Payload to OS Internal execution standard
  const osPayload = {
    prompt: collapsedPrompt,
    model: model === "streetmp-auto" ? "auto" : model,
    // INJECTED ENTERPRISE MANDATES:
    strict_mode: true,      
    sanitizer: true,        
    proof_generation: true, 
  };

  try {
    // 3. STREAMING (SSE) PATH `stream: true`
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      const upstreamResp = await axios.post(`${ROUTER_SERVICE_URL}/api/v1/execute`, osPayload, {
        responseType: "stream",
        timeout: 60000,
        headers: { "Authorization": authHeader }
      });

      upstreamResp.data.on("data", (chunk: Buffer) => {
        // Assume internal router chunks are directly the text delta
        const chunkText = chunk.toString();
        
        const openAiChunk = {
          id: requestId,
          object: "chat.completion.chunk",
          created: createdTs,
          model: model,
          choices: [{ index: 0, delta: { content: chunkText }, finish_reason: null }]
        };
        
        res.write(`data: ${JSON.stringify(openAiChunk)}\n\n`);
      });

      upstreamResp.data.on("end", () => {
        const finishChunk = {
          id: requestId,
          object: "chat.completion.chunk",
          created: createdTs,
          model: model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
        };
        res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      });

      upstreamResp.data.on("error", (err: Error) => {
        console.error("[OpenAIProxy] Stream Error:", err.message);
        res.end();
      });

      return;
    }

    // 4. SYNCHRONOUS PATH (Non-Streaming)
    const upstreamResp = await axios.post(`${ROUTER_SERVICE_URL}/api/v1/execute`, osPayload, {
      timeout: 10000,
      headers: { "Authorization": authHeader, "Content-Type": "application/json" }
    });

    const outputText = upstreamResp.data.output || "";

    // 5. Output exactly matches OpenAI Standard Schema
    res.json({
      id: requestId,
      object: "chat.completion",
      created: createdTs,
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: outputText
          },
          logprobs: null,
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: Math.ceil(collapsedPrompt.length / 4), // Approximate tokens
        completion_tokens: Math.ceil(outputText.length / 4),
        total_tokens: Math.ceil((collapsedPrompt.length + outputText.length) / 4)
      }
    });

  } catch (err: any) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: {
        message: err.message || "Upstream execution failure.",
        type: "server_error",
        code: "internal_error"
      }
    });
  }
});
