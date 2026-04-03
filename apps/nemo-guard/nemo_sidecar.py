"""
nemo_sidecar.py — Titan Perimeter Cognitive Firewall
======================================================
FastAPI sidecar that wraps the NVIDIA NeMo Guardrails engine.
Exposes a single POST /v1/check endpoint consumed by router-service.

Architecture:
  router-service (TS) ──POST /v1/check──► nemo_sidecar (Python)
                                                │
                                         NeMo Rails engine
                                          (config.yml + rails.co)
                                                │
                                  ┌─────────────┴──────────────┐
                                  │   Jailbreak Detection      │
                                  │   PII Leakage Prevention   │
                                  │   Topic Enforcement        │
                                  └─────────────┬──────────────┘
                                                │
                          ◄─── { safe, violated_rail, reason }

Fail-open design: if the engine itself errors, we log and allow the
request through (rather than causing a full service outage). Router-service
logs the bypass so ops can see it.

Requirements (see requirements.txt):
  nemoguardrails, fastapi, uvicorn[standard], pydantic, httpx, python-dotenv
"""

import os
import time
import logging
import traceback
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# ── NeMo Guardrails engine ─────────────────────────────────────
from nemoguardrails import RailsConfig, LLMRails


# ================================================================
# SETUP
# ================================================================

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("titan-perimeter")

# Config directory — sibling of this script in the build context,
# or override via NEMO_CONFIG_DIR env var.
CONFIG_DIR = Path(os.getenv("NEMO_CONFIG_DIR", "/app/nemo"))

app = FastAPI(
    title="Titan Perimeter — NeMo Guardrails Sidecar",
    description="Cognitive firewall for the StreetMP OS router-service.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# ── Load the Rails engine at startup (expensive — do once) ──────
_rails: Optional[LLMRails] = None

def _load_rails() -> Optional[LLMRails]:
    """Initialises the NeMo engine from config.yml + rails.co."""
    try:
        config = RailsConfig.from_path(str(CONFIG_DIR))
        rails  = LLMRails(config)
        log.info(f"[NeMo] Titan Perimeter engine loaded from {CONFIG_DIR}")
        return rails
    except Exception:
        log.error(f"[NeMo] FATAL: Failed to load rails config:\n{traceback.format_exc()}")
        return None


@app.on_event("startup")
async def startup_event() -> None:
    global _rails
    _rails = _load_rails()
    if _rails is None:
        log.warning("[NeMo] Engine not loaded — sidecar will return safe=True (fail-open).")


# ================================================================
# REQUEST / RESPONSE MODELS
# ================================================================

class CheckRequest(BaseModel):
    """Inbound payload from router-service."""
    prompt: str = Field(..., description="The raw user prompt to evaluate.")
    # Optional: full messages array for context-aware rails
    messages: Optional[list[dict]] = Field(
        default=None,
        description="Full conversation history (optional). If provided, the rails engine uses conversation context."
    )
    tenant_id: Optional[str] = Field(default=None, description="Tenant identifier for audit logging.")

class CheckResponse(BaseModel):
    """Response sent back to router-service."""
    safe: bool                        = Field(..., description="True = request is safe to forward. False = request is blocked.")
    violated_rail: Optional[str]      = Field(default=None, description="The Colang flow that triggered the block.")
    reason: Optional[str]             = Field(default=None, description="Human-readable block reason (safe for client display).")
    blocked_output: Optional[str]     = Field(default=None, description="The bot's refusal message if applicable.")
    latency_ms: int                   = Field(default=0, description="Time spent in the rails engine (ms).")
    engine: str                       = Field(default="nemo-guardrails", description="Engine identifier for audit trails.")


# ================================================================
# UTILITY: Extract violation from NeMo output
# ================================================================

# Maps the Colang bot response prefixes to rail names for structured logging
_RAIL_SIGNATURES: list[tuple[str, str]] = [
    ("TITAN-JB-001",         "titan_jailbreak_check"),
    ("TITAN-PII-001",        "titan_pii_check"),
    ("TITAN-TOPIC-001",      "titan_topic_check"),
    ("TITAN-OUT-001",        "titan_output_pii_scrub"),
    ("TITAN-OUT-TOPIC-001",  "titan_output_topic_check"),
]

def _extract_violation(bot_response: str) -> tuple[Optional[str], Optional[str]]:
    """
    Given the bot's refusal message, extract the violated rail name and a
    clean reason string suitable for the router's audit log.
    Returns (violated_rail, reason).
    """
    for ref, rail in _RAIL_SIGNATURES:
        if ref in bot_response:
            # Strip the reference code from the reason for cleaner external messaging
            reason = bot_response.split("Reference:")[0].strip()
            return rail, reason
    return "unknown_rail", bot_response[:200]


# ================================================================
# ENDPOINTS
# ================================================================

@app.get("/health", include_in_schema=False)
async def health() -> dict:
    return {
        "status": "ok",
        "engine_loaded": _rails is not None,
        "config_dir": str(CONFIG_DIR),
        "service": "titan-perimeter",
    }


@app.post("/v1/check", response_model=CheckResponse)
async def check_prompt(payload: CheckRequest, request: Request) -> CheckResponse:
    """
    Main guardrail evaluation endpoint.

    Called by router-service proxyRoutes.ts before forwarding any prompt
    to an upstream LLM (OpenAI / Anthropic / Gemini).

    Fail-open: if the NeMo engine is unavailable or throws an unexpected
    error, returns safe=True so the router is not completely blocked.
    The router logs the bypass independently.
    """
    t0 = time.monotonic()
    caller_ip = request.client.host if request.client else "unknown"

    log.info(f"[NeMo] CHECK — tenant={payload.tenant_id or 'anon'} ip={caller_ip} prompt_len={len(payload.prompt)}")

    # ── Fail-open: engine not loaded ──────────────────────────────
    if _rails is None:
        log.warning("[NeMo] Engine not loaded — returning safe=True (fail-open)")
        return CheckResponse(
            safe=True,
            violated_rail=None,
            reason="Engine unavailable — fail-open policy active.",
            latency_ms=0,
        )

    # ── Build the messages list for NeMo ──────────────────────────
    # Use the full conversation history if provided; otherwise use
    # just the single user message.
    messages = payload.messages if payload.messages else [
        {"role": "user", "content": payload.prompt}
    ]

    try:
        # generate() runs the rails pipeline:
        #   input rails → (optional LLM call) → output rails
        response = await _rails.generate_async(messages=messages)

        # NeMo's generate() returns the assistant turn.
        # When a rail fires, it intercepts and returns the bot's refusal text.
        # We detect a block by checking for our Titan reference codes.
        bot_message: str = ""
        if isinstance(response, dict):
            bot_message = response.get("content", "")
        elif isinstance(response, str):
            bot_message = response

        latency_ms = int((time.monotonic() - t0) * 1000)

        # ── Determine if a rail was triggered ──────────────────────
        is_blocked = any(ref in bot_message for ref, _ in _RAIL_SIGNATURES)

        if is_blocked:
            violated_rail, reason = _extract_violation(bot_message)
            log.warning(
                f"[NeMo] BLOCKED — rail={violated_rail} tenant={payload.tenant_id or 'anon'} "
                f"ip={caller_ip} latency={latency_ms}ms"
            )
            return CheckResponse(
                safe=False,
                violated_rail=violated_rail,
                reason=reason,
                blocked_output=bot_message,
                latency_ms=latency_ms,
            )

        log.info(f"[NeMo] PASS — tenant={payload.tenant_id or 'anon'} latency={latency_ms}ms")
        return CheckResponse(
            safe=True,
            latency_ms=latency_ms,
        )

    except Exception:
        # Log the full traceback internally but return fail-open to avoid
        # making the router-service unavailable.
        latency_ms = int((time.monotonic() - t0) * 1000)
        log.error(
            f"[NeMo] ENGINE ERROR — fail-open active. Traceback:\n{traceback.format_exc()}"
        )
        return CheckResponse(
            safe=True,
            reason="Engine error — fail-open policy active.",
            latency_ms=latency_ms,
        )


@app.post("/v1/reload", include_in_schema=False)
async def reload_rails() -> dict:
    """
    Hot-reload the rails config without restarting the container.
    Useful after updating config.yml or rails.co in production.
    """
    global _rails
    _rails = _load_rails()
    return {"status": "reloaded", "engine_loaded": _rails is not None}


# ================================================================
# ENTRYPOINT
# ================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    log.info(f"[NeMo] Starting Titan Perimeter sidecar on port {port}")
    uvicorn.run(
        "nemo_sidecar:app",
        host="0.0.0.0",
        port=port,
        workers=1,           # NeMo's LLMRails is not multiprocess-safe; use 1 worker + async concurrency
        log_level="info",
        access_log=True,
    )
