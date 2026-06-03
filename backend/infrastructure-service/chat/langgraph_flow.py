"""
LangGraph-based infrastructure provisioning workflow.

Multi-LLM pipeline:
  extract → plan → validate → safety → END
                                      ↘ execute → END

The extract node classifies user intent. If it's a plan/create/update/edit
request, the planner generates a ResourcePlan. The validator runs
deterministic checks. The safety reviewer scans for security anti-patterns.
On approve_plan, the executor creates resources via the project-service API.
"""

import logging
from typing import TypedDict, Annotated, Dict, Any, Optional, List

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_aws import ChatBedrock
import boto3

from config import settings

# Import graph nodes
from chat.nodes.extractor import extract_request
from chat.nodes.planner import generate_execution_plan
from chat.nodes.validator import validate_request
from chat.nodes.safety import safety_review
from chat.nodes.executor import execute_dag_plan

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
#  LLM INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════

llm = None

if settings.LLM_PROVIDER == "bedrock":
    try:
        session_kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            session_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            session_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        boto3_session = boto3.Session(**session_kwargs)

        llm = ChatBedrock(
            client=boto3_session.client("bedrock-runtime"),
            model_id=settings.LLM_MODEL,
            model_kwargs={"temperature": 0.7},
        )
        logger.info(f"LLM initialized: {settings.LLM_MODEL} (AWS Bedrock)")
    except Exception as e:
        logger.warning(f"Could not initialize AWS Bedrock LLM: {e}")
elif settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7,
        )
        logger.info(f"LLM initialized: {settings.LLM_MODEL} (Google Gemini)")
    except Exception as e:
        logger.warning(f"Could not initialize Google Gemini LLM: {e}")
else:
    logger.warning("No valid LLM configuration found — LLM features disabled.")


def get_llm():
    """Return the shared LLM instance (used by title_generator, main.py summary tasks)."""
    return llm


# ═══════════════════════════════════════════════════════════════════════
#  STATE DEFINITION
# ═══════════════════════════════════════════════════════════════════════

class InfraChatState(TypedDict):
    """
    Full conversational state tracked across turns.

    Split into logical groups:
      - Session context: project, auth, repo data
      - Multi-LLM pipeline: extracted resources, generated plan, validation
      - Workflow tracking: workbook, approval, execution
      - Output: response content and type
    """
    # ── Session context ──
    messages: Annotated[list, add_messages]
    session_id: str
    project_id: str
    project_name: str
    project_info: Dict[str, Any]
    provisioning_context: Optional[Dict[str, Any]]
    repo_tree: Optional[Dict[str, Any]]
    repo_scan_memory: Optional[Dict[str, Any]]
    user_message: str
    auth_token: str
    infra_exists: bool

    # ── Intent classification ──
    intent: str                             # InfrastructureIntent enum value
    existing_resources: List[Dict[str, Any]]
    conversation_summary: Optional[Dict[str, Any]]

    # ── Multi-LLM pipeline outputs ──
    extracted_resources: List[Dict[str, Any]]
    generated_plan: Optional[Dict[str, Any]]
    validation_errors: List[str]
    validation_report: Optional[Dict[str, Any]]
    safety_warnings: List[str]

    # ── Plan & Workbook ──
    implementation_plan: Optional[Dict[str, Any]]
    plan_status: str                        # "none" | "draft" | "approved" | "executing" | "completed"
    workbook: List[Dict[str, Any]]
    approved_orders: List[int]

    # ── Legacy fields (kept for backward-compatible session state) ──
    pending_resources: List[Dict[str, Any]]
    saved_resources: List[Dict[str, Any]]
    current_resource_type: Optional[str]
    collected_fields: Dict[str, Any]
    missing_fields: List[str]
    dependency_asked: bool

    # ── Output ──
    response_content: str
    raw_response: str
    response_type: str                      # "text" | "plan" | "plan_executed" | "saved" | "validated" | "extracted"


# ═══════════════════════════════════════════════════════════════════════
#  GRAPH CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════

def build_infra_chat_graph() -> StateGraph:
    """
    Build and compile the LangGraph workflow.

    Pipeline:
      extract → (plan → validate → safety → END)
                                           ↘ execute → END
    """
    workflow = StateGraph(InfraChatState)

    # Wrap nodes to inject the LLM instance
    async def extract_node(state):
        return await extract_request(state, llm)

    async def plan_node(state):
        return await generate_execution_plan(state, llm)

    async def validate_node(state):
        return await validate_request(state)

    async def safety_node(state):
        return await safety_review(state, llm)

    async def execute_node(state):
        return await execute_dag_plan(state)

    # Add nodes
    workflow.add_node("extract", extract_node)
    workflow.add_node("plan", plan_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("safety", safety_node)
    workflow.add_node("execute", execute_node)

    # Entry point
    workflow.set_entry_point("extract")

    # ── Routing ──

    def route_after_extract(state: InfraChatState) -> str:
        intent = state.get("intent")
        if intent in ("plan", "edit", "create_infra", "update_infra"):
            return "plan"
        elif intent == "approve_plan":
            return "execute"
        return "end"

    def route_after_plan(state: InfraChatState) -> str:
        if state.get("generated_plan"):
            return "validate"
        return "end"

    def route_after_validate(state: InfraChatState) -> str:
        if state.get("response_type") == "invalid_plan":
            return "end"
        return "safety"

    workflow.add_conditional_edges(
        "extract",
        route_after_extract,
        {"plan": "plan", "execute": "execute", "end": END},
    )

    workflow.add_conditional_edges(
        "plan",
        route_after_plan,
        {"validate": "validate", "end": END},
    )

    workflow.add_conditional_edges(
        "validate",
        route_after_validate,
        {"safety": "safety", "end": END},
    )

    workflow.add_edge("safety", END)
    workflow.add_edge("execute", END)

    return workflow.compile()


# ═══════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ═══════════════════════════════════════════════════════════════════════

_chat_graph = None

try:
    if llm:
        _chat_graph = build_infra_chat_graph()
        logger.info("LangGraph infra-chat workflow compiled successfully.")
except Exception as e:
    logger.error(f"Failed to compile LangGraph workflow: {e}")


def is_available() -> bool:
    """Check if the chat engine is ready."""
    return _chat_graph is not None and llm is not None


async def run_turn(
    user_message: str,
    session_state: dict,
) -> dict:
    """
    Execute one conversation turn through the LangGraph workflow.

    Args:
        user_message: The user's message text.
        session_state: Full session state dict (persisted across turns).

    Returns:
        Updated session state with response_content populated.
    """
    if not _chat_graph:
        return {
            **session_state,
            "user_message": user_message,
            "response_content": "The AI engine is not available. Please check the GEMINI_API_KEY configuration.",
            "raw_response": "The AI engine is not available. Please check the GEMINI_API_KEY configuration.",
            "response_type": "text",
        }

    # Prepare input state
    input_state: InfraChatState = {
        # Session context
        "messages": session_state.get("messages", []),
        "session_id": session_state.get("session_id", ""),
        "project_id": session_state.get("project_id", ""),
        "project_name": session_state.get("project_name", "Unknown"),
        "project_info": session_state.get("project_info", {}),
        "provisioning_context": session_state.get("provisioning_context", {}),
        "repo_tree": session_state.get("repo_tree", {}),
        "repo_scan_memory": session_state.get("repo_scan_memory"),
        "user_message": user_message,
        "auth_token": session_state.get("auth_token", ""),
        "infra_exists": session_state.get("infra_exists", False),

        # Intent
        "intent": session_state.get("intent", "general"),
        "existing_resources": session_state.get("existing_resources", []),
        "conversation_summary": session_state.get("conversation_summary"),

        # Multi-LLM pipeline outputs
        "extracted_resources": session_state.get("extracted_resources", []),
        "generated_plan": session_state.get("generated_plan"),
        "validation_errors": session_state.get("validation_errors", []),
        "validation_report": session_state.get("validation_report"),
        "safety_warnings": session_state.get("safety_warnings", []),

        # Plan & Workbook
        "implementation_plan": session_state.get("implementation_plan"),
        "plan_status": session_state.get("plan_status", "none"),
        "workbook": session_state.get("workbook", []),
        "approved_orders": session_state.get("approved_orders", []),

        # Legacy fields (backward compat)
        "pending_resources": session_state.get("pending_resources", []),
        "saved_resources": session_state.get("saved_resources", []),
        "current_resource_type": session_state.get("current_resource_type"),
        "collected_fields": session_state.get("collected_fields", {}),
        "missing_fields": session_state.get("missing_fields", []),
        "dependency_asked": session_state.get("dependency_asked", False),

        # Output
        "response_content": "",
        "raw_response": "",
        "response_type": "text",
    }

    result = await _chat_graph.ainvoke(input_state)

    return result
