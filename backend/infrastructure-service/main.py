"""
InfraX Infrastructure Service (port 8004)
==========================================
AI-driven infrastructure provisioning via conversational chat.

Endpoints:
  GET  /api/infra/chat/stream   — SSE streaming (primary, for EventSource)
  POST /api/infra/chat/stream   — SSE streaming with rich payload
  POST /api/infra/chat          — Non-streaming fallback
  GET  /                        — Health check
  GET  /api/health              — Detailed health check
"""

import asyncio
import json
import time
import logging
from typing import Optional, Dict, Any

import jwt as pyjwt
from fastapi import FastAPI, Query, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from config import settings
from chat.langgraph_flow import run_turn, is_available as is_chat_available
from chat.project_client import project_client

# ═══════════════════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-28s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("infra-service")


# ═══════════════════════════════════════════════════════════════════════
#  FASTAPI APP
# ═══════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="InfraX Infrastructure Service",
    description="AI-driven infrastructure provisioning via chat",
    version="1.0.0",
)

# CORS — allow frontend direct access (SSE bypasses the gateway)
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════
#  SESSION STORAGE (in-memory, same pattern as Jenkins service)
# ═══════════════════════════════════════════════════════════════════════

sessions: Dict[str, Dict[str, Any]] = {}


async def get_or_create_session(
    session_id: str,
    project_id: str,
    project_name: str,
    auth_token: str,
) -> Dict[str, Any]:
    """Get an existing session or create a new one. Fetches existing resources on first call."""
    if session_id not in sessions:
        # Fetch existing resources from project-service so the LLM knows what already exists
        existing_resources = []
        try:
            existing_resources = await project_client.get_project_resources(project_id, auth_token)
            logger.info(f"Loaded {len(existing_resources)} existing resources for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not fetch existing resources: {e}")

        sessions[session_id] = {
            "session_id": session_id,
            "project_id": project_id,
            "project_name": project_name,
            "auth_token": auth_token,
            "messages": [],
            # LangGraph state fields
            "intent": "general",
            "current_resource_type": None,
            "collected_fields": {},
            "missing_fields": [],
            "pending_resources": [],
            "saved_resources": [],
            "existing_resources": existing_resources,  # Resources already in DB
            "dependency_asked": False,
            "created_at": time.time(),
        }
    else:
        # Update auth token in case it was refreshed
        sessions[session_id]["auth_token"] = auth_token

    return sessions[session_id]


# ═══════════════════════════════════════════════════════════════════════
#  JWT VALIDATION
# ═══════════════════════════════════════════════════════════════════════

def validate_jwt_token(
    token_query: Optional[str] = None,
    authorization: Optional[str] = None,
) -> bool:
    """
    Validate a JWT token from query param or Authorization header.
    Returns True if valid, False otherwise.
    """
    token = None

    # Priority: query param (for SSE/EventSource) > Authorization header
    if token_query:
        token = token_query
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        return False

    try:
        pyjwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return True
    except pyjwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return False
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return False


def extract_token(
    token_query: Optional[str] = None,
    authorization: Optional[str] = None,
) -> str:
    """Extract the raw token string from query or header."""
    if token_query:
        return token_query
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return ""


# ═══════════════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    session_id: Optional[str] = None
    project_id: str
    project_name: str = "Unknown Project"

    def get_message(self) -> str:
        return (self.message or self.query or "").strip()


class ChatResponse(BaseModel):
    type: str = "text"
    content: str = ""
    response: str = ""
    session_id: str = ""
    saved_resources: list = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════
#  SSE STREAMING GENERATOR
# ═══════════════════════════════════════════════════════════════════════

async def stream_chat_response(
    user_message: str,
    session_id: str,
    project_id: str,
    project_name: str,
    auth_token: str,
):
    """
    SSE generator that processes one conversation turn and streams
    the response word-by-word, then sends a final 'done' event.
    """
    try:
        # Get or create session
        session = await get_or_create_session(session_id, project_id, project_name, auth_token)

        # Add user message to history
        session["messages"].append({"role": "user", "content": user_message})

        # Run one turn through LangGraph
        result = await run_turn(user_message, session)

        # Extract response
        response_text = result.get("response_content", "")
        response_type = result.get("response_type", "text")
        saved_resources = result.get("saved_resources", [])

        # Update session state from LangGraph result
        for key in (
            "intent", "current_resource_type", "collected_fields",
            "missing_fields", "pending_resources", "saved_resources",
            "existing_resources", "dependency_asked",
        ):
            if key in result:
                session[key] = result[key]

        # Add assistant response to history
        raw_response = result.get("raw_response", response_text)
        session["messages"].append({"role": "assistant", "content": raw_response})

        # Trim history to last 30 messages
        if len(session["messages"]) > 30:
            session["messages"] = session["messages"][-30:]

        # Stream response
        has_code_blocks = "```" in response_text or "|" in response_text

        if has_code_blocks:
            # Send tables / code blocks at once for proper rendering
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
            "response_type": response_type,
            "session_id": session_id,
            "saved_resources": [
                {"id": r.get("id"), "type": r.get("type"), "name": r.get("name")}
                for r in saved_resources
            ] if response_type == "saved" else [],
        }
        yield f"data: {json.dumps(done_event)}\n\n"

    except Exception as e:
        logger.error(f"SSE stream error: {e}", exc_info=True)
        error_event = {"type": "error", "message": str(e)}
        yield f"data: {json.dumps(error_event)}\n\n"


# ═══════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "service": "infrastructure-service",
        "status": "running",
        "chat_engine": "ready" if is_chat_available() else "unavailable",
    }


@app.get("/api/health")
async def health():
    project_service_ok = await project_client.check_health()
    chat_ok = is_chat_available()

    status = "healthy" if (project_service_ok and chat_ok) else "degraded"
    return {
        "status": status,
        "service": "infrastructure-service",
        "chat_engine": "ready" if chat_ok else "unavailable (check GEMINI_API_KEY)",
        "project_service": "connected" if project_service_ok else "unreachable",
    }


# ── SSE GET (primary — for EventSource) ──────────────────────────────

@app.get("/api/infra/chat/stream")
async def chat_stream_get(
    message: str = Query(..., description="User message"),
    project_id: str = Query(..., description="Target project ID"),
    project_name: str = Query("Unknown Project", description="Project name"),
    session_id: Optional[str] = Query(None, description="Chat session ID"),
    token: Optional[str] = Query(None, description="JWT token (required — EventSource can't send headers)"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    SSE streaming chat endpoint (GET — for EventSource compatibility).
    Token MUST be in the `token` query parameter (EventSource API limitation).
    """
    # Validate auth
    if not validate_jwt_token(token, authorization):
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    auth_token = extract_token(token, authorization)
    sid = session_id or f"infra-chat-{int(time.time() * 1000)}"

    logger.info(f"GET SSE — session={sid}, project={project_id}, message={message[:60]}...")

    return StreamingResponse(
        stream_chat_response(message, sid, project_id, project_name, auth_token),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ── SSE POST (with rich payload) ────────────────────────────────────

@app.post("/api/infra/chat/stream")
async def chat_stream_post(
    request: ChatRequest,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    SSE streaming chat endpoint (POST — for richer payloads).
    Token in Authorization header: Bearer {jwt}.
    """
    if not validate_jwt_token(None, authorization):
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    user_message = request.get_message()
    if not user_message:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Message is required'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    auth_token = extract_token(None, authorization)
    sid = request.session_id or f"infra-chat-{int(time.time() * 1000)}"

    logger.info(f"POST SSE — session={sid}, project={request.project_id}, message={user_message[:60]}...")

    return StreamingResponse(
        stream_chat_response(user_message, sid, request.project_id, request.project_name, auth_token),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ── REST POST (non-streaming fallback) ──────────────────────────────

@app.post("/api/infra/chat", response_model=ChatResponse)
async def chat_rest(
    request: ChatRequest,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Non-streaming chat endpoint (fallback if SSE fails).
    """
    if not validate_jwt_token(None, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_message = request.get_message()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    auth_token = extract_token(None, authorization)
    sid = request.session_id or f"infra-chat-{int(time.time() * 1000)}"

    # Get or create session
    session = await get_or_create_session(sid, request.project_id, request.project_name, auth_token)
    session["messages"].append({"role": "user", "content": user_message})

    # Run turn
    result = await run_turn(user_message, session)

    response_text = result.get("response_content", "")
    response_type = result.get("response_type", "text")

    # Update session
    for key in (
        "intent", "current_resource_type", "collected_fields",
        "missing_fields", "pending_resources", "saved_resources",
        "existing_resources", "dependency_asked",
    ):
        if key in result:
            session[key] = result[key]

    raw_response = result.get("raw_response", response_text)
    session["messages"].append({"role": "assistant", "content": raw_response})
    if len(session["messages"]) > 30:
        session["messages"] = session["messages"][-30:]

    return ChatResponse(
        type=response_type,
        content=response_text,
        response=response_text,
        session_id=sid,
        saved_resources=result.get("saved_resources", []),
    )


# ═══════════════════════════════════════════════════════════════════════
#  ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)
