"""
InfraX Infrastructure Service (port 8004)
==========================================
AI-driven infrastructure provisioning via conversational chat.

Endpoints:
  GET  /api/infra/chat/stream   — SSE streaming (primary, for EventSource)
  POST /api/infra/chat/stream   — SSE streaming with rich payload
  POST /api/infra/chat          — Non-streaming fallback
  GET  /api/infra/conversations — List conversations for a project
  GET  /api/infra/conversations/{session_id}/messages — Load messages
  DELETE /api/infra/conversations/{session_id} — Delete conversation
  PUT  /api/infra/conversations/{session_id}/title — Rename conversation
  GET  /                        — Health check
  GET  /api/health              — Detailed health check
"""

import asyncio
import json
import time
import logging
from typing import Optional, Dict, Any, List

import jwt as pyjwt
from fastapi import FastAPI, Query, Header, HTTPException, Body
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
#  LIFECYCLE — PostgreSQL pool
# ═══════════════════════════════════════════════════════════════════════

from postgres.connection import init_pg_pool, close_pg_pool
from postgres.models import ensure_tables, auto_prune_conversations
from postgres import conversation_store
from postgres.title_generator import generate_conversation_title

@app.on_event("startup")
async def startup_event():
    """Initialize PostgreSQL connection pool, ensure tables, and auto-prune old conversations."""
    await init_pg_pool(settings.POSTGRES_DSN)
    await ensure_tables()
    # Auto-prune conversations older than 90 days (preserves summaries)
    await auto_prune_conversations(retention_days=90)

@app.on_event("shutdown")
async def shutdown_event():
    """Close PostgreSQL connection pool."""
    await close_pg_pool()


# ═══════════════════════════════════════════════════════════════════════
#  JWT USER ID EXTRACTION
# ═══════════════════════════════════════════════════════════════════════

def extract_user_id(token: str) -> Optional[str]:
    """Decode user_id from JWT payload without full validation (already validated upstream)."""
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub") or payload.get("user_id") or payload.get("id")
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════
#  SESSION STORAGE (in-memory, same pattern as Jenkins service)
# ═══════════════════════════════════════════════════════════════════════

sessions: Dict[str, Dict[str, Any]] = {}


async def get_or_create_session(
    session_id: str,
    project_id: str,
    project_name: str,
    auth_token: str,
    **kwargs
) -> Dict[str, Any]:
    """Get an existing session or create a new one. Integrates with PostgreSQL for persistence."""
    if session_id not in sessions:
        # Extract user_id from JWT
        user_id = extract_user_id(auth_token)

        # Create or load conversation record in PostgreSQL
        conv_record = await conversation_store.get_conversation(session_id)
        if not conv_record:
            conv_record = await conversation_store.create_conversation(
                project_id=project_id,
                session_id=session_id,
                user_id=user_id,
                title="Initial Chat",
            )
            logger.info(f"Created new conversation record for session {session_id}")
        else:
            logger.info(f"Loaded existing conversation '{conv_record.get('title')}' for session {session_id}")

        # Load project memory (cross-session context)
        project_memories = await conversation_store.get_project_memory(project_id)
        
        # Check if repo scan already exists in project memory
        repo_scan_memory = None
        for mem in project_memories:
            if mem.get("memory_type") == "repo_scan":
                repo_scan_memory = mem
                break

        # Fetch existing resources from project-service
        existing_resources = []
        try:
            existing_resources = await project_client.get_project_resources(project_id, auth_token)
            logger.info(f"Loaded {len(existing_resources)} existing resources for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not fetch existing resources: {e}")

        # Fetch full project metadata for LLM context
        project_info = {}
        try:
            res = await project_client.get_project(project_id, auth_token)
            if res:
                project_info = res
                logger.info(f"Loaded project metadata for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not fetch project metadata: {e}")

        # Fetch provisioning context
        provisioning_context = None
        try:
            res = await project_client.get_latest_provisioning_context(project_id, auth_token)
            if res:
                provisioning_context = res
                logger.info(f"Loaded provisioning context for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not fetch provisioning context: {e}")

        # Fetch infrastructure summary from PostgreSQL
        pg_summary = None
        try:
            from postgres.summary_store import get_latest_summary
            pg_summary = await get_latest_summary(project_id)
            if pg_summary:
                logger.info(f"Loaded PostgreSQL infrastructure summary v{pg_summary.get('version')} for project {project_id}")
        except Exception as e:
            logger.warning(f"Could not fetch PostgreSQL summary: {e}")

        # Load latest conversation summary (rolling)
        conv_summary = None
        if conv_record:
            conv_summary = await conversation_store.get_latest_conversation_summary(str(conv_record["id"]))

        sessions[session_id] = {
            "session_id": session_id,
            "project_id": project_id,
            "project_name": project_name,
            "project_info": project_info,
            "provisioning_context": provisioning_context,
            "pg_summary": pg_summary,
            "auth_token": auth_token,
            "user_id": user_id,
            "conversation_id": str(conv_record["id"]) if conv_record else None,
            "conversation_summary": conv_summary,
            "project_memories": project_memories,
            "repo_scan_memory": repo_scan_memory,
            "messages": [],
            # LangGraph state fields
            "intent": "general",
            "current_resource_type": None,
            "collected_fields": {},
            "missing_fields": [],
            "pending_resources": [],
            "saved_resources": [],
            "existing_resources": existing_resources,
            "dependency_asked": False,
            "created_at": time.time(),
            "_is_first_message": True,  # Track if first message for title generation
        }
        
        # Only fetch repo tree if no persisted repo_scan exists in project_memory
        repo_id = kwargs.get("repo_id")
        if repo_id and not repo_scan_memory:
            try:
                import httpx
                scm_url = f"{settings.SCM_SERVICE_URL}/api/scm/repos/{repo_id}/tree"
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(scm_url, headers={"Authorization": f"Bearer {auth_token}"})
                    if resp.status_code == 200:
                        sessions[session_id]["repo_tree"] = resp.json()
                        logger.info(f"Loaded repo tree for repo {repo_id} (first scan)")
                    else:
                        logger.warning(f"Failed to fetch repo tree: {resp.status_code} - {resp.text[:200]}")
            except Exception as e:
                logger.warning(f"Could not fetch repo tree: {e}")
        elif repo_scan_memory:
            logger.info(f"Reusing persisted repo scan from project_memory for project {project_id}")

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
    repo_id: Optional[str] = None

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
    repo_id: Optional[str] = None,
):
    """
    SSE generator that processes one conversation turn and streams
    the response word-by-word, then sends a final 'done' event.
    Persists messages to PostgreSQL and triggers title/summary generation.
    """
    try:
        # Get or create session
        session = await get_or_create_session(session_id, project_id, project_name, auth_token, repo_id=repo_id)
        conversation_id = session.get("conversation_id")

        # Add user message to history
        session["messages"].append({"role": "user", "content": user_message})

        # Persist user message to PostgreSQL (non-blocking, best-effort)
        is_hidden = user_message == "[INIT_REPO_SCAN]"
        if conversation_id and not is_hidden:
            await conversation_store.save_message(conversation_id, "user", user_message)
            await conversation_store.touch_conversation(session_id, increment_messages=1)

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

        # Persist assistant message to PostgreSQL
        if conversation_id:
            resources_affected = [
                {"id": r.get("id"), "type": r.get("type"), "name": r.get("name")}
                for r in saved_resources
            ] if saved_resources else None
            await conversation_store.save_message(
                conversation_id, "assistant", raw_response,
                resources_affected=resources_affected,
            )
            await conversation_store.touch_conversation(session_id, increment_messages=1)

        # ── Title generation (first user message only) ──
        if session.get("_is_first_message") and not is_hidden and conversation_id:
            session["_is_first_message"] = False
            try:
                from chat.langgraph_flow import get_llm
                llm = get_llm()
                title = await generate_conversation_title(user_message, project_name, llm=llm)
                await conversation_store.update_conversation_title(session_id, title)
                logger.info(f"Auto-generated conversation title: '{title}'")
            except Exception as e:
                logger.warning(f"Title generation failed: {e}")

        # ── Repo scan persistence (save to project_memory on first scan) ──
        if is_hidden and response_text and conversation_id:
            if not session.get("repo_scan_memory"):
                try:
                    await conversation_store.upsert_project_memory(
                        project_id=project_id,
                        memory_type="repo_scan",
                        content=raw_response,
                        structured_data={"repo_id": repo_id, "session_id": session_id},
                        source_conversation_id=conversation_id,
                    )
                    session["repo_scan_memory"] = {"content": raw_response}
                    logger.info(f"Persisted repo scan summary to project_memory for {project_id}")
                except Exception as e:
                    logger.warning(f"Failed to persist repo scan: {e}")

        # ── Rolling summary trigger (every 10 messages) ──
        if conversation_id:
            msg_count = await conversation_store.get_message_count(conversation_id)
            if msg_count > 0 and msg_count % 10 == 0:
                asyncio.create_task(_generate_rolling_summary(conversation_id, project_id, session_id))

        # Trim in-memory history to last 30 messages
        if len(session["messages"]) > 30:
            session["messages"] = session["messages"][-30:]

        # Stream response
        has_code_blocks = "```" in response_text or "|" in response_text

        if has_code_blocks:
            chunk = {"type": "chunk", "content": response_text}
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.05)
        else:
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


async def _generate_rolling_summary(conversation_id: str, project_id: str, session_id: str):
    """Background task: generate a rolling conversation summary using Gemini."""
    try:
        messages = await conversation_store.get_all_messages_for_summary(conversation_id)
        if not messages:
            return

        # Build conversation transcript for the LLM
        transcript = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content'][:500]}"
            for m in messages[-20:]  # Last 20 messages max
        )

        from chat.langgraph_flow import get_llm
        from langchain_core.messages import HumanMessage

        llm = get_llm()
        prompt = (
            "Summarize this infrastructure provisioning conversation concisely. Include:\n"
            "1. Key decisions made\n"
            "2. Resources provisioned or discussed\n"
            "3. Current state / next steps\n"
            "Return a structured summary in 3-5 sentences.\n\n"
            f"Conversation:\n{transcript}"
        )

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        summary_text = response.content if hasattr(response, "content") else str(response)
        if isinstance(summary_text, list):
            summary_text = "".join(
                part if isinstance(part, str) else part.get("text", str(part))
                for part in summary_text
            )

        await conversation_store.save_conversation_summary(
            conversation_id=conversation_id,
            project_id=project_id,
            summary_text=summary_text.strip(),
            key_decisions=[],
            resources_state=[],
            action_history=[],
        )

        # Also update project memory with latest infra state
        await conversation_store.upsert_project_memory(
            project_id=project_id,
            memory_type="infra_state",
            content=summary_text.strip(),
            source_conversation_id=conversation_id,
        )

        logger.info(f"✅ Rolling summary generated for conversation {conversation_id}")

    except Exception as e:
        logger.warning(f"Rolling summary generation failed: {e}")


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
    repo_id: Optional[str] = Query(None, description="SCM Repository ID"),
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
        stream_chat_response(message, sid, project_id, project_name, auth_token, repo_id=repo_id),
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
        stream_chat_response(user_message, sid, request.project_id, request.project_name, auth_token, repo_id=request.repo_id),
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
    session = await get_or_create_session(sid, request.project_id, request.project_name, auth_token, repo_id=request.repo_id)
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
#  CONVERSATION MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@app.get("/api/infra/conversations")
async def list_conversations(
    project_id: str = Query(..., description="Project ID"),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """List all active conversations for a project."""
    if not validate_jwt_token(token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    conversations = await conversation_store.get_conversations_by_project(project_id)
    return {
        "conversations": [
            {
                "id": str(c["id"]),
                "session_id": c["session_id"],
                "title": c["title"],
                "message_count": c["message_count"],
                "summary": c.get("summary"),
                "created_at": c["created_at"].isoformat() if c.get("created_at") else None,
                "updated_at": c["updated_at"].isoformat() if c.get("updated_at") else None,
            }
            for c in conversations
        ]
    }


@app.get("/api/infra/conversations/{session_id}/messages")
async def get_conversation_messages(
    session_id: str,
    limit: int = Query(50, description="Max messages to return"),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Load messages for a specific conversation."""
    if not validate_jwt_token(token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    conv = await conversation_store.get_conversation(session_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = await conversation_store.get_messages(str(conv["id"]), limit=limit)
    return {
        "session_id": session_id,
        "title": conv["title"],
        "messages": [
            {
                "id": m["id"],
                "role": m["role"],
                "content": m["content"],
                "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
            }
            for m in messages
        ],
    }


@app.delete("/api/infra/conversations/{session_id}")
async def delete_conversation_endpoint(
    session_id: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Delete a conversation (preserves summary in project_memory)."""
    if not validate_jwt_token(token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    deleted = await conversation_store.delete_conversation(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Also remove from in-memory sessions if present
    sessions.pop(session_id, None)

    return {"status": "deleted", "session_id": session_id}


class TitleUpdate(BaseModel):
    title: str


@app.put("/api/infra/conversations/{session_id}/title")
async def rename_conversation(
    session_id: str,
    body: TitleUpdate,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Rename a conversation."""
    if not validate_jwt_token(token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    await conversation_store.update_conversation_title(session_id, body.title)
    return {"status": "updated", "session_id": session_id, "title": body.title}


# ═══════════════════════════════════════════════════════════════════════
#  ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)
