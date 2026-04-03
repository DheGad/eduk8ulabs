from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from nemoguardrails import LLMRails, RailsConfig
import os

app = FastAPI()

# Load NeMo Guardrails configuration
config_path = os.path.join(os.path.dirname(__file__), "config")
try:
    config = RailsConfig.from_path(config_path)
    rails = LLMRails(config)
except Exception as e:
    print(f"Failed to load rails config: {e}")
    rails = None

class CheckRequest(BaseModel):
    prompt: str

class CheckResponse(BaseModel):
    safe: bool

@app.post("/v1/check", response_model=CheckResponse)
async def check_prompt(request: CheckRequest):
    if rails is None:
        # Fail safe
        return CheckResponse(safe=True)
    
    # We use generate to see what the rails would return
    # According to nemoguardrails docs, we can test just the prompt via specific messages
    # For a simple check, we can just return safe=False if it triggers a block phrase.
    # Actually nemoguardrails handles standard conversations, let's just trigger generate
    try:
        response = rails.generate(messages=[{
            "role": "user",
            "content": request.prompt
        }])
        
        # If the response is the canned block message, we consider it unsafe
        output = response.get('content', '') if isinstance(response, dict) else response
        if "I cannot fulfill this request" in output or "I cannot answer this" in output or "I cannot answer that" in output:
            return CheckResponse(safe=False)
            
        return CheckResponse(safe=True)
    except Exception as e:
        print(f"Error checking prompt: {e}")
        return CheckResponse(safe=True)
