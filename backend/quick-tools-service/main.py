"""
InfraX Quick Tools Service (port 8007)
=======================================
AI-powered DevOps configuration generator for Quick Tools.
Generates Dockerfiles, Jenkinsfiles, K8s manifests, and Helm charts
using Gemini LLM with repository folder tree context.

Endpoints:
  GET  /api/tools/generate/stream  — SSE streaming generation
  GET  /                           — Health check
  GET  /api/health                 — Detailed health check
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
from prompts import get_system_prompt

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-28s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("quick-tools-service")

# ── LLM Setup ────────────────────────────────────────────────────────
llm = None
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    if settings.GEMINI_API_KEY:
        llm = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.4,
            max_output_tokens=4096,
        )
        logger.info(f"Gemini LLM initialized: {settings.LLM_MODEL}")
    else:
        logger.warning("GEMINI_API_KEY not set — LLM will be unavailable")
except ImportError:
    logger.warning("langchain-google-genai not installed — LLM unavailable")


# ── FastAPI App ──────────────────────────────────────────────────────
app = FastAPI(
    title="InfraX Quick Tools Service",
    description="AI-powered DevOps configuration generator",
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
MAX_HISTORY = 10


def get_or_create_session(session_id: str, tool_type: str) -> Dict[str, Any]:
    if session_id not in sessions:
        sessions[session_id] = {
            "tool_type": tool_type,
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
async def get_llm_response(
    user_message: str,
    tool_type: str,
    folder_tree: List[str],
    history: List[Dict],
) -> str:
    """Get a response from Gemini using the tool-specific system prompt."""
    if not llm:
        return "I'm currently unavailable because the AI model is not configured. Please ask your admin to set the `GEMINI_API_KEY` environment variable."

    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        system_prompt = get_system_prompt(tool_type, folder_tree)
        messages = [SystemMessage(content=system_prompt)]

        # Add conversation history
        for msg in history[-MAX_HISTORY:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        # Add current message
        messages.append(HumanMessage(content=user_message))

        # ── DEBUG: Log full LLM input ────────────────────────────
        logger.info("=" * 80)
        logger.info("🔍 FULL LLM INPUT (quick-tools)")
        logger.info("=" * 80)
        for i, m in enumerate(messages):
            role = type(m).__name__
            content_preview = m.content[:500] + ("..." if len(m.content) > 500 else "")
            logger.info(f"  [{i}] {role}: {content_preview}")
        logger.info("=" * 80)

        response = await llm.ainvoke(messages)
        return response.content

    except Exception as e:
        logger.error(f"LLM error: {e}", exc_info=True)
        return f"Sorry, I encountered an error processing your request. Please try again."


# ── SSE Streaming Generator ─────────────────────────────────────────
async def stream_generate_response(
    user_message: str,
    tool_type: str,
    folder_tree: List[str],
    session_id: str,
):
    """Stream the LLM response via SSE events."""
    try:
        session = get_or_create_session(session_id, tool_type)

        # Add user message to history
        session["messages"].append({"role": "user", "content": user_message})

        # Get LLM response
        response_text = await get_llm_response(
            user_message, tool_type, folder_tree, session["messages"]
        )

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
            "tool_type": tool_type,
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
        "service": "quick-tools-service",
        "status": "running",
        "llm": "ready" if llm else "unavailable",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy" if llm else "degraded",
        "service": "quick-tools-service",
        "llm": "ready" if llm else "unavailable (check GEMINI_API_KEY)",
    }


@app.get("/api/tools/generate/stream")
async def generate_stream(
    tool_type: str = Query(..., description="Tool type: dockerfile | jenkins | k8s-manifest | helm"),
    prompt: str = Query(..., description="User's generation prompt"),
    folder_tree: Optional[str] = Query("[]", description="JSON-encoded list of file paths from repo"),
    session_id: Optional[str] = Query(None, description="Session ID for conversation continuity"),
    token: Optional[str] = Query(None, description="JWT token (required — EventSource can't send headers)"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """SSE streaming endpoint — generates DevOps configuration using Gemini."""
    # Validate auth
    if not validate_jwt_token(token, authorization):
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    # Parse folder tree
    try:
        tree_list = json.loads(folder_tree) if folder_tree else []
    except json.JSONDecodeError:
        tree_list = []

    # Default session ID
    sid = session_id or f"qt-{tool_type}-{int(time.time())}"

    logger.info(f"[{sid}] tool={tool_type}, tree_size={len(tree_list)}, prompt={prompt[:80]}...")

    return StreamingResponse(
        stream_generate_response(prompt, tool_type, tree_list, sid),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8007, reload=True)
