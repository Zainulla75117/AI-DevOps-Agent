"""
Conversation endpoints.
"""
from typing import Optional
from fastapi import APIRouter, Header, Query, HTTPException

from app.auth import require_auth
from app.schemas.response_schemas import ConversationListResponse, ConversationMessagesResponse, TitleUpdate
from app.services.session_manager import session_manager
from postgres import conversation_store

router = APIRouter(prefix="/api/infra")

@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    project_id: str = Query(..., description="Project ID"),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)
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

@router.get("/conversations/{session_id}/messages", response_model=ConversationMessagesResponse)
async def get_conversation_messages(
    session_id: str,
    limit: int = Query(50, description="Max messages to return"),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)
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

@router.delete("/conversations/{session_id}")
async def delete_conversation_endpoint(
    session_id: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)
    deleted = await conversation_store.delete_conversation(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if session_id in session_manager.sessions:
        del session_manager.sessions[session_id]

    return {"status": "deleted", "session_id": session_id}

@router.put("/conversations/{session_id}/title")
async def update_conversation_title_endpoint(
    session_id: str,
    body: TitleUpdate,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    require_auth(token, authorization)
    await conversation_store.update_conversation_title(session_id, body.title)
    return {"status": "updated", "session_id": session_id, "title": body.title}
