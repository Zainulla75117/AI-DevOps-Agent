"""
Chat and streaming endpoints.
"""
import json
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Header, Query, Request, HTTPException
from fastapi.responses import StreamingResponse

from app.auth import require_auth
from app.schemas.response_schemas import ChatRequest, ChatResponse
from app.services.session_manager import session_manager
from postgres import conversation_store
from chat.langgraph_flow import run_turn, is_available

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/infra")

async def _generate_rolling_summary(conversation_id: str, project_id: str, session_id: str):
    """Background task: generate a rolling conversation summary using Gemini."""
    try:
        messages = await conversation_store.get_all_messages_for_summary(conversation_id)
        if not messages:
            return

        transcript = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content'][:500]}"
            for m in messages[-20:]
        )

        from chat.langgraph_flow import get_llm
        from langchain_core.messages import HumanMessage

        llm = get_llm()
        if not llm:
            return
            
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

        await conversation_store.save_conversation_summary(
            conversation_id=conversation_id,
            project_id=project_id,
            summary_text=summary_text.strip(),
            key_decisions=[],
            resources_state=[],
            action_history=[],
        )
    except Exception as e:
        logger.warning(f"Failed to generate rolling summary: {e}")

async def stream_chat_response(
    user_message: str,
    session_id: str,
    project_id: str,
    project_name: str,
    auth_token: str,
    repo_id: Optional[str] = None,
):
    try:
        session = await session_manager.get_or_create(session_id, project_id, project_name, auth_token, repo_id=repo_id)
        conversation_id = session.get("conversation_id")

        session["messages"].append({"role": "user", "content": user_message})

        is_hidden = user_message == "[INIT_REPO_SCAN]"
        if conversation_id and not is_hidden:
            await conversation_store.save_message(conversation_id, "user", user_message)
            await conversation_store.touch_conversation(session_id, increment_messages=1)

        result = await run_turn(user_message, session)

        response_text = result.get("response_content", "")
        response_type = result.get("response_type", "text")
        saved_resources = result.get("saved_resources", [])

        if not response_text or not response_text.strip():
            response_text = "I processed your request but couldn't generate a response. Please try again."
            result["response_content"] = response_text
            if not result.get("raw_response"):
                result["raw_response"] = response_text

        for key in (
            "intent", "current_resource_type", "collected_fields",
            "missing_fields", "pending_resources", "saved_resources",
            "existing_resources", "dependency_asked",
            "implementation_plan", "plan_status", "workbook", "approved_orders",
            "generated_plan", "extracted_resources", "validation_errors",
            "validation_report", "safety_warnings",
        ):
            if key in result:
                session[key] = result[key]

        raw_response = result.get("raw_response", response_text)
        session["messages"].append({"role": "assistant", "content": raw_response})

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

        if session.get("_is_first_message") and not is_hidden and conversation_id:
            session["_is_first_message"] = False
            # Simplify title logic to avoid external circular deps, rely on store default
            pass

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
                except Exception as e:
                    pass

        if conversation_id:
            msg_count = await conversation_store.get_message_count(conversation_id)
            if msg_count > 0 and msg_count % 10 == 0:
                asyncio.create_task(_generate_rolling_summary(conversation_id, project_id, session_id))

        if len(session["messages"]) > 30:
            session["messages"] = session["messages"][-30:]

        if response_type == "plan" and result.get("implementation_plan"):
            plan_event = {
                "type": "plan",
                "plan": result["implementation_plan"],
                "plan_status": result.get("plan_status", "draft"),
            }
            yield f"data: {json.dumps(plan_event)}\n\n"
            await asyncio.sleep(0.05)

        if response_type in ("plan_executing", "plan_completed") and result.get("workbook"):
            workbook_event = {
                "type": "workbook_update",
                "workbook": result["workbook"],
                "plan_status": result.get("plan_status", "executing"),
            }
            yield f"data: {json.dumps(workbook_event)}\n\n"
            await asyncio.sleep(0.05)

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

        done_event = {
            "type": "done",
            "content": response_text,
            "response_type": response_type,
            "session_id": session_id,
            "saved_resources": [
                {"id": r.get("id"), "type": r.get("type"), "name": r.get("name")}
                for r in saved_resources
            ] if response_type in ("saved", "plan_completed") else [],
        }
        
        if result.get("implementation_plan"):
            done_event["plan"] = result["implementation_plan"]
            done_event["plan_status"] = result.get("plan_status", "none")
        if result.get("workbook"):
            done_event["workbook"] = result["workbook"]

        yield f"data: {json.dumps(done_event)}\n\n"

    except Exception as e:
        logger.error(f"SSE stream error: {e}", exc_info=True)
        error_event = {"type": "error", "message": str(e)}
        yield f"data: {json.dumps(error_event)}\n\n"

@router.get("/chat/stream")
async def chat_stream_get(
    request: Request,
    message: str = Query(...),
    session_id: str = Query(...),
    project_id: str = Query(...),
    project_name: str = Query("Unknown Project"),
    repo_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    auth_token = require_auth(token, authorization)
    if not is_available():
        raise HTTPException(status_code=503, detail="AI Engine not ready")
        
    return StreamingResponse(
        stream_chat_response(
            message, session_id, project_id, project_name, auth_token, repo_id=repo_id
        ),
        media_type="text/event-stream"
    )

@router.post("/chat/stream")
async def chat_stream_post(
    request: Request,
    body: ChatRequest,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    auth_token = require_auth(token, authorization)
    if not is_available():
        raise HTTPException(status_code=503, detail="AI Engine not ready")

    message = body.get_message()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    return StreamingResponse(
        stream_chat_response(
            message,
            body.session_id,
            body.project_id,
            body.project_name,
            auth_token,
            repo_id=body.repo_id,
        ),
        media_type="text/event-stream"
    )

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    auth_token = require_auth(token, authorization)
    if not is_available():
        raise HTTPException(status_code=503, detail="AI Engine not ready")

    message = body.get_message()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    session = await session_manager.get_or_create(
        body.session_id, body.project_id, body.project_name, auth_token, repo_id=body.repo_id
    )

    result = await run_turn(message, session)
    return ChatResponse(
        type=result.get("response_type", "text"),
        content=result.get("response_content", ""),
        response=result.get("response_content", ""),
        session_id=body.session_id,
        saved_resources=result.get("saved_resources", [])
    )


@router.patch("/plan/config")
async def update_plan_config(
    request: Request,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Update resource configs in the active plan before approval.
    
    Accepts a JSON body with session_id, project_id, and resource_updates
    (list of {order, config} dicts). Merges the updated config fields into
    the in-memory session's generated_plan so the executor uses the
    user-modified values.
    """
    auth_token = require_auth(token, authorization)

    body = await request.json()
    session_id = body.get("session_id")
    resource_updates = body.get("resource_updates", [])

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session = session_manager.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    plan = session.get("generated_plan")
    if not plan or not plan.get("resources"):
        raise HTTPException(status_code=404, detail="No active plan in session")

    # Build lookup by order for fast merge
    resources_by_order = {r["order"]: r for r in plan["resources"]}
    updated_count = 0

    for update in resource_updates:
        order = update.get("order")
        new_config = update.get("config", {})
        if order in resources_by_order and new_config:
            existing_config = resources_by_order[order].get("config", {})
            existing_config.update(new_config)
            resources_by_order[order]["config"] = existing_config
            updated_count += 1
            logger.info(f"Updated config for resource order={order}: {list(new_config.keys())}")

    return {
        "status": "ok",
        "updated_resources": updated_count,
        "session_id": session_id,
    }

