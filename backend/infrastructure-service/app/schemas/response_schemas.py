"""
Typed response models for all infrastructure-service API endpoints.

Ensures every API response has a predictable, documented structure.
These are used as FastAPI response_model parameters.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════
#  CHAT MODELS
# ═══════════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    """Input model for chat endpoints (POST /api/infra/chat)."""
    message: Optional[str] = None
    query: Optional[str] = None
    session_id: Optional[str] = None
    project_id: str = Field(..., min_length=1)
    project_name: str = Field(default="Unknown Project")
    repo_id: Optional[str] = None

    def get_message(self) -> str:
        """Return the user message, preferring 'message' over 'query'."""
        return (self.message or self.query or "").strip()


class ChatResponse(BaseModel):
    """Response model for non-streaming chat endpoint."""
    type: str = "text"
    content: str = ""
    response: str = ""
    session_id: str = ""
    saved_resources: list[dict[str, Any]] = Field(default_factory=list)


class ChatStreamEvent(BaseModel):
    """
    A single SSE event in the chat stream.

    Event types:
      - chunk: Partial text being streamed word-by-word
      - plan: Infrastructure plan generated
      - workbook_update: Provisioning progress update
      - done: Stream complete, final response
      - error: Error occurred
    """
    type: str = Field(..., description="Event type: chunk/plan/workbook_update/done/error")
    content: Optional[str] = Field(None, description="Text content")
    plan: Optional[dict[str, Any]] = Field(None, description="Implementation plan data")
    plan_status: Optional[str] = Field(None, description="Plan status (draft/approved/executing/completed)")
    workbook: Optional[list[dict[str, Any]]] = Field(None, description="Workbook progress entries")
    response_type: Optional[str] = Field(None, description="Response classification")
    session_id: Optional[str] = Field(None, description="Session identifier")
    saved_resources: Optional[list[dict[str, Any]]] = Field(None, description="Saved resource summaries")
    message: Optional[str] = Field(None, description="Error message (for error events)")


# ═══════════════════════════════════════════════════════════════════════
#  CONVERSATION MODELS
# ═══════════════════════════════════════════════════════════════════════

class ConversationSummary(BaseModel):
    """A single conversation in the list response."""
    id: str
    session_id: str
    title: str
    message_count: int
    summary: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ConversationListResponse(BaseModel):
    """Response for GET /api/infra/conversations."""
    conversations: list[ConversationSummary] = Field(default_factory=list)


class MessageItem(BaseModel):
    """A single message in a conversation."""
    id: int
    role: str
    content: str
    created_at: Optional[str] = None


class ConversationMessagesResponse(BaseModel):
    """Response for GET /api/infra/conversations/{session_id}/messages."""
    session_id: str
    title: str
    messages: list[MessageItem] = Field(default_factory=list)


class TitleUpdate(BaseModel):
    """Request body for PUT /api/infra/conversations/{session_id}/title."""
    title: str = Field(..., min_length=1, max_length=256)


# ═══════════════════════════════════════════════════════════════════════
#  HEALTH & CLEANUP MODELS
# ═══════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    """Response for GET /api/health."""
    status: str = Field(..., description="Overall health status (healthy/degraded)")
    service: str = "infrastructure-service"
    chat_engine: str = Field(..., description="Chat engine status")
    project_service: str = Field(..., description="Project service connectivity")


class CleanupResponse(BaseModel):
    """Response for DELETE /api/infra/cleanup endpoints."""
    status: str = "cleaned"
    project_id: Optional[str] = None
    resource_id: Optional[str] = None
    summaries_deleted: int = 0
    memory_cleaned: list[str] = Field(default_factory=list)
    sessions_purged: int = 0
    infra_state_invalidated: bool = False


class DeletedHistoryResponse(BaseModel):
    """Response for GET /api/infra/deleted-history/{project_id}."""
    has_history: bool
    history: Optional[dict[str, Any]] = None


class PlanConfigUpdateRequest(BaseModel):
    """Request body for PATCH /api/infra/plan/config — updates resource configs in the active plan."""
    session_id: str = Field(..., min_length=1)
    project_id: str = Field(..., min_length=1)
    resource_updates: list[dict[str, Any]] = Field(
        ...,
        description="List of {order: int, config: {key: value}} dicts with updated config fields",
    )
