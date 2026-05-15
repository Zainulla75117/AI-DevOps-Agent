"""
InfraX Guide Service (port 8006)
================================
AI-powered informational assistant for DevOps guidance.
This service is purely advisory — it does NOT provision resources,
create IaC, or mutate any data.

Endpoints:
  GET  /api/guide/chat/stream  — SSE streaming chat
  GET  /                       — Health check
  GET  /api/health             — Detailed health check
"""

import asyncio
import json
import time
import logging
from typing import Optional, Dict, Any, List

import jwt as pyjwt
from fastapi import FastAPI, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()

from config import settings

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-28s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("guide-service")

# ── LLM Setup ────────────────────────────────────────────────────────
llm = None
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    if settings.GEMINI_API_KEY:
        llm = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7,
            max_output_tokens=2048,
        )
        logger.info(f"Gemini LLM initialized: {settings.LLM_MODEL}")
    else:
        logger.warning("GEMINI_API_KEY not set — LLM will be unavailable")
except ImportError:
    logger.warning("langchain-google-genai not installed — LLM unavailable")


SYSTEM_PROMPT = """You are the InfraX DevOps Guide — a friendly, knowledgeable assistant embedded in the InfraX platform.

The InfraX platform is a comprehensive AI-driven DevOps dashboard that provides:
1. Quick Tools: Rapid generators for Dockerfiles, Jenkins Pipelines, Kubernetes Manifests, and Helm Charts. These tools feature deep repository integration, allowing users to scan GitHub/GitLab repos and auto-generate precise configurations tailored to their project's folder structure and existing files.
2. Infrastructure Provisioning: An interactive AI copilot (on the Infrastructure page) that uses a conversational interface to design, configure, and provision cloud resources (AWS, GCP, Azure) via LangGraph and persistent context tracking.
3. Project Management: A centralized hub (on the Home page) for managing various DevOps projects, tracking their active resources, and ensuring safe teardowns.
4. Global Guide (You): A globally accessible chatbot providing advisory, educational, and informational assistance.

Your role is STRICTLY INFORMATIONAL. You:
- Explain DevOps concepts, CI/CD pipelines, cloud architecture, and best practices
- Help users understand AWS, GCP, Azure services and when to use them
- Guide users on how to use the InfraX platform features
- Answer questions about infrastructure design patterns and tradeoffs

You NEVER:
- Offer, volunteer, or provide complete templates for Dockerfiles, Jenkins pipelines, Kubernetes manifests, or Helm charts in the chat.
- Execute code or commands
- Provision, create, modify, or delete any infrastructure resources
- Make API calls on behalf of the user
- Claim you can perform actions — you only guide and inform

Keep responses concise, practical, and well-formatted with markdown. Use code blocks with proper language tags for small snippet explanations only.
When a user asks you to DO something (like create infra, generate a Dockerfile/pipeline/manifest, or scan a repo) or asks for an example of a configuration, politely redirect them to the appropriate InfraX feature:
- For generating Dockerfiles, Jenkins Pipelines, K8s Manifests, or Helm Charts → "Open the Quick Tools section in the left sidebar to use our AI generators with repository scanning."
- For infrastructure provisioning → "Head over to the Infrastructure page and use the AI Copilot."
- For project management → "You can manage projects from the Home page."
"""


# ── FastAPI App ──────────────────────────────────────────────────────
app = FastAPI(
    title="InfraX Guide Service",
    description="AI-powered informational DevOps assistant",
    version="1.0.0",
)

cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── In-Memory Sessions ──────────────────────────────────────────────
sessions: Dict[str, Dict[str, Any]] = {}
MAX_HISTORY = 20  # keep last N messages per session


def get_or_create_session(session_id: str) -> Dict[str, Any]:
    if session_id not in sessions:
        sessions[session_id] = {
            "messages": [],
            "created_at": time.time(),
        }
    return sessions[session_id]


# ── JWT Validation ───────────────────────────────────────────────────
def validate_jwt_token(
    token_query: Optional[str] = None,
    authorization: Optional[str] = None,
) -> bool:
    token = None
    if token_query:
        token = token_query
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        return False

    try:
        pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return True
    except pyjwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return False
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return False


# ── LLM Call ─────────────────────────────────────────────────────────
async def get_llm_response(user_message: str, history: List[Dict]) -> str:
    """Get a response from Gemini using conversation history."""
    if not llm:
        return "I'm currently unavailable because the AI model is not configured. Please ask your admin to set the `GEMINI_API_KEY` environment variable."

    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        messages = [SystemMessage(content=SYSTEM_PROMPT)]

        # Add conversation history (last N messages for context)
        for msg in history[-MAX_HISTORY:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        # Add current message
        messages.append(HumanMessage(content=user_message))

        response = await llm.ainvoke(messages)
        return response.content

    except Exception as e:
        logger.error(f"LLM error: {e}", exc_info=True)
        return f"Sorry, I encountered an error processing your request. Please try again."


# ── SSE Streaming Generator ─────────────────────────────────────────
async def stream_chat_response(user_message: str, session_id: str):
    """Stream the LLM response word-by-word via SSE events."""
    try:
        session = get_or_create_session(session_id)

        # Add user message to history
        session["messages"].append({"role": "user", "content": user_message})

        # Get LLM response
        response_text = await get_llm_response(user_message, session["messages"])

        # Add assistant response to history
        session["messages"].append({"role": "assistant", "content": response_text})

        # Trim history
        if len(session["messages"]) > MAX_HISTORY * 2:
            session["messages"] = session["messages"][-(MAX_HISTORY * 2):]

        # Stream response
        has_code_blocks = "```" in response_text or "|" in response_text

        if has_code_blocks:
            # Send code blocks / tables at once for proper rendering
            chunk = {"type": "chunk", "content": response_text}
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.05)
        else:
            # Stream word-by-word for natural feel
            words = response_text.split()
            for word in words:
                chunk = {"type": "chunk", "content": word + " "}
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0.025)

        # Send done event
        done_event = {
            "type": "done",
            "content": response_text,
            "session_id": session_id,
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    except Exception as e:
        logger.error(f"SSE stream error: {e}", exc_info=True)
        error_event = {"type": "error", "message": str(e)}
        yield f"data: {json.dumps(error_event)}\n\n"


# ── Endpoints ────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "guide-service",
        "status": "running",
        "llm": "ready" if llm else "unavailable",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy" if llm else "degraded",
        "service": "guide-service",
        "llm": "ready" if llm else "unavailable (check GEMINI_API_KEY)",
    }


@app.get("/api/guide/chat/stream")
async def chat_stream(
    message: str = Query(..., description="User message"),
    session_id: Optional[str] = Query(None, description="Chat session ID"),
    token: Optional[str] = Query(None, description="JWT token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """SSE streaming chat endpoint for the DevOps Guide."""
    # Validate auth
    if not validate_jwt_token(token, authorization):
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Default session
    if not session_id:
        session_id = f"guide-{int(time.time())}"

    logger.info(f"[{session_id}] User: {message[:80]}...")

    return StreamingResponse(
        stream_chat_response(message, session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8006, reload=True)
