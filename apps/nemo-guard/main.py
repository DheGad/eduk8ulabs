"""
StreetMP OS — NeMo Guardrails Sidecar
Command 081 / V81

FastAPI server exposing POST /v1/guard for the TypeScript bridge.

Architecture notes
──────────────────
- NeMo Rails is initialised ONCE at startup from ./config/ (config.yml +
  rails.co). Subsequent requests share the same RailsConfig instance, so
  there is no per-request I/O against a config store.
- The engine uses "self" (passthrough), so no LLM API key is required.
  Safety checks are purely heuristic / Colang pattern-matching.
- The /health endpoint allows the TypeScript bridge to perform readiness
  probes before marking the sidecar as available.
- All errors are surfaced as HTTP 200 with safe: true (fail-open by design).
  The TypeScript bridge enforces its OWN timeout / fail-open logic on top.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── NeMo Guardrails ───────────────────────────────────────────────────────────
try:
    from nemoguardrails import RailsConfig, LLMRails  # type: ignore

    NEMO_AVAILABLE = True
except ImportError:
    NEMO_AVAILABLE = False
    LLMRails = None  # type: ignore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("nemo-guard")

# ── Global rails instance (initialised in lifespan hook) ─────────────────────
_rails: Optional[object] = None

CONFIG_DIR = Path(__file__).parent / "config"
SIDECAR_VERSION = "0.1.0"
PORT = int(os.environ.get("NEMO_PORT", 8000))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise NeMo Rails once at startup; tear down on shutdown."""
    global _rails

    if not NEMO_AVAILABLE:
        logger.warning(
            "nemoguardrails package not installed — sidecar will run in "
            "PASSTHROUGH mode (all prompts allowed). Install via requirements.txt."
        )
    else:
        try:
            cfg = RailsConfig.from_path(str(CONFIG_DIR))
            _rails = LLMRails(cfg)
            logger.info("✅ NeMo Guardrails initialised from %s", CONFIG_DIR)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "❌ Failed to initialise NeMo Guardrails: %s — "
                "sidecar will run in PASSTHROUGH mode.",
                exc,
            )
            _rails = None

    yield  # application runs here

    _rails = None
    logger.info("NeMo sidecar shutting down.")


app = FastAPI(
    title="StreetMP NeMo Guard Sidecar",
    version=SIDECAR_VERSION,
    lifespan=lifespan,
)

# ── Request / Response models ─────────────────────────────────────────────────


class GuardRequest(BaseModel):
    prompt: str


class GuardResponse(BaseModel):
    safe: bool
    reason: str
    nemo_evaluated: bool  # False when running in passthrough mode


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> JSONResponse:
    """Readiness probe consumed by the TypeScript bridge."""
    return JSONResponse(
        {
            "status": "ok",
            "nemo_available": NEMO_AVAILABLE,
            "rails_loaded": _rails is not None,
            "version": SIDECAR_VERSION,
        }
    )


@app.post("/v1/guard", response_model=GuardResponse)
async def guard(body: GuardRequest) -> GuardResponse:
    """
    Evaluate a prompt through NeMo Guardrails.

    Returns:
        safe=True — prompt is clear to proceed
        safe=False — prompt triggered a content safety rail
        nemo_evaluated=False — NeMo unavailable; falls back to pass-through
    """
    prompt = body.prompt.strip()
    if not prompt:
        return GuardResponse(safe=True, reason="Empty prompt — skipped", nemo_evaluated=False)

    # ── Passthrough mode (NeMo not installed or failed to init) ───────────────
    if _rails is None:
        logger.debug("PASSTHROUGH: NeMo not available for prompt (len=%d)", len(prompt))
        return GuardResponse(
            safe=True,
            reason="NeMo rails not loaded — passthrough (fail-open)",
            nemo_evaluated=False,
        )

    # ── NeMo evaluation ───────────────────────────────────────────────────────
    try:
        messages = [{"role": "user", "content": prompt}]
        # generate() applies input rails and returns the (possibly blocked)
        # response. If a blocking rail fires, the output will be the bot's
        # refusal message rather than anything the LLM would have said.
        response = await _rails.generate_async(messages=messages)  # type: ignore[union-attr]

        # Determine whether a safety rail fired by inspecting the response
        # content against the canonical refusal phrase from rails.co.
        bot_text: str = ""
        if isinstance(response, list) and response:
            last = response[-1]
            bot_text = last.get("content", "") if isinstance(last, dict) else str(last)
        elif isinstance(response, str):
            bot_text = response

        REFUSAL_PHRASE = "blocked by the content safety policy"
        if REFUSAL_PHRASE in bot_text.lower():
            logger.warning("🚨 NeMo BLOCKED prompt (len=%d)", len(prompt))
            return GuardResponse(
                safe=False,
                reason="Blocked by NeMo content safety rail",
                nemo_evaluated=True,
            )

        logger.debug("✅ NeMo ALLOWED prompt (len=%d)", len(prompt))
        return GuardResponse(safe=True, reason="Passed NeMo content safety check", nemo_evaluated=True)

    except Exception as exc:  # noqa: BLE001
        # Any unexpected runtime error → fail-open so the routing pipeline
        # is never bricked by a NeMo internal fault.
        logger.error("NeMo evaluation error (fail-open): %s", exc)
        return GuardResponse(
            safe=True,
            reason=f"NeMo evaluation error (fail-open): {type(exc).__name__}",
            nemo_evaluated=False,
        )


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        reload=False,
    )
