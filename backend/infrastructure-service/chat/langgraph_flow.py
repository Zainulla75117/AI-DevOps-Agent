"""
LangGraph-based conversation workflow for infrastructure provisioning.

State machine: classify_intent → collect_fields → suggest_dependencies
→ validate_and_summarize → save_to_db

Handles multi-resource creation in a single conversation.
"""

import json
import re
import logging
from typing import TypedDict, Annotated, Dict, Any, Optional, List, Literal

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from config import settings
from chat.prompts import (
    RESOURCE_FIELD_SCHEMAS,
    TOP_LEVEL_DEFAULTS,
    DEPENDENCY_SUGGESTIONS,
    build_system_prompt,
)
from chat.project_client import project_client

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
#  LLM INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════

llm: Optional[ChatGoogleGenerativeAI] = None

if settings.GEMINI_API_KEY:
    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.LLM_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.7,
        )
        logger.info(f"LLM initialized: {settings.LLM_MODEL}")
    except Exception as e:
        logger.warning(f"Could not initialize LLM: {e}")
else:
    logger.warning("GEMINI_API_KEY not set — LLM features disabled.")


# ═══════════════════════════════════════════════════════════════════════
#  STATE DEFINITION
# ═══════════════════════════════════════════════════════════════════════

class InfraChatState(TypedDict):
    """Full conversational state tracked across turns."""
    messages: Annotated[list, add_messages]
    session_id: str
    project_id: str
    project_name: str
    project_info: Dict[str, Any]
    user_message: str
    auth_token: str

    # Current extraction progress
    intent: str                              # "create_infra" | "update_infra" | "general" | "confirm" | "edit" | "cancel"
    current_resource_type: Optional[str]     # "network" | "compute" | "serverless" | "database"
    collected_fields: Dict[str, Any]         # Fields gathered for current resource
    missing_fields: List[str]                # Fields still needed

    # Multi-resource tracking
    pending_resources: List[Dict[str, Any]]  # Fully collected, awaiting confirmation
    saved_resources: List[Dict[str, Any]]    # Successfully saved to DB
    existing_resources: List[Dict[str, Any]] # Resources already in DB (fetched at session start)
    dependency_asked: bool                   # Whether we asked about dependencies

    # Output
    response_content: str
    raw_response: str
    response_type: str                       # "text" | "summary" | "saved"


# ═══════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def parse_extraction(text: str) -> dict | None:
    """
    Parse the hidden <<<EXTRACT>>> JSON block from LLM output.
    Returns the parsed dict, or None if not found.
    """
    match = re.search(r"<<<EXTRACT>>>\s*(\{.*?\})\s*<<<END_EXTRACT>>>", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse extraction JSON: {e}")
    return None


def strip_extraction(text: str) -> str:
    """Remove the hidden extraction block from the response shown to the user."""
    # 1. Remove the extract block if it's perfectly wrapped in its own code block
    cleaned = re.sub(r"```(?:json|)\s*<<<EXTRACT>>>.*?<<<END_EXTRACT>>>\s*```", "", text, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. Remove the extract block normally
    cleaned = re.sub(r"<<<EXTRACT>>>.*?<<<END_EXTRACT>>>", "", cleaned, flags=re.DOTALL)
    
    # 3. Un-wrap if the LLM wrapped the ENTIRE response (Text included) in a single ```json or ``` block
    cleaned = cleaned.strip()
    if cleaned.startswith("```json") or cleaned.startswith("```markdown"):
        cleaned = re.sub(r"^```(?:json|markdown)\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    elif cleaned.startswith("```") and cleaned.count("```") == 2 and cleaned.endswith("```"):
        # If it's a completely generic ``` wrapper with no language, and only 1 pair exists
        cleaned = re.sub(r"^```\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        
    return cleaned.strip()


def get_required_fields(resource_type: str) -> list[str]:
    """Get list of all required fields (top-level + config) for a resource type."""
    schema = RESOURCE_FIELD_SCHEMAS.get(resource_type)
    if not schema:
        return []

    fields = ["name"]  # name is always required
    for fname, fmeta in schema["config_fields"].items():
        if fmeta.get("required", False):
            fields.append(fname)
    return fields


def compute_missing_fields(resource_type: str, collected: dict) -> list[str]:
    """Determine which required fields are still missing."""
    required = get_required_fields(resource_type)
    return [f for f in required if f not in collected or collected[f] is None]


def build_resource_payload(
    project_id: str,
    resource_type: str,
    collected: dict,
    depends_on: list[str] | None = None,
) -> dict:
    """
    Convert collected fields into InfraResourceCreate-compatible dict
    for the project-service API.
    """
    # Separate top-level from config fields
    top_level = {
        "project_id": project_id,
        "type": resource_type,
        "name": collected.get("name", f"{resource_type}-resource"),
        "provider": collected.get("provider", TOP_LEVEL_DEFAULTS["provider"]),
        "region": collected.get("region", TOP_LEVEL_DEFAULTS["region"]),
        "env": collected.get("env", TOP_LEVEL_DEFAULTS["env"]),
        "state": "planned",
        "depends_on": depends_on or [],
    }

    # Build config dict from schema fields
    schema = RESOURCE_FIELD_SCHEMAS.get(resource_type, {})
    config = {}
    for fname, fmeta in schema.get("config_fields", {}).items():
        value = collected.get(fname, fmeta.get("default"))
        if value is not None:
            # Type coercion
            if fmeta["type"] == "int":
                try:
                    value = int(value)
                except (ValueError, TypeError):
                    pass
            elif fmeta["type"] == "bool":
                if isinstance(value, str):
                    value = value.lower() in ("true", "yes", "1")
            config[fname] = value

    top_level["config"] = config
    return top_level


# ═══════════════════════════════════════════════════════════════════════
#  LANGGRAPH NODES
# ═══════════════════════════════════════════════════════════════════════

async def process_message(state: InfraChatState) -> InfraChatState:
    """
    Central node: sends the user message + conversation history to the LLM,
    parses the structured extraction, and updates the state accordingly.
    """
    if not llm:
        return {
            **state,
            "response_content": "LLM service is not available. Please configure GEMINI_API_KEY.",
            "response_type": "text",
        }

    try:
        # Build conversation history for LLM
        history = state.get("messages", [])
        existing_resources = state.get("existing_resources", [])
        project_info = state.get("project_info", {})
        system_prompt = build_system_prompt(
            project_name=state.get("project_name", "Unknown"),
            project_id=state.get("project_id", ""),
            existing_resources=existing_resources or state.get("saved_resources", []),
            project_info=project_info,
        )

        llm_messages = [SystemMessage(content=system_prompt)]

        # Add conversation history (last 20 messages)
        for msg in history[-20:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    llm_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    llm_messages.append(AIMessage(content=content))
            elif isinstance(msg, (HumanMessage, AIMessage)):
                llm_messages.append(msg)

        # Current user message is already appended to history before process_message is called.

        # Invoke LLM
        response = await llm.ainvoke(llm_messages)
        raw_content = response.content if hasattr(response, "content") else str(response)

        # Handle content being a list of parts (newer langchain-google-genai versions)
        if isinstance(raw_content, list):
            raw_text = "".join(
                part if isinstance(part, str) else part.get("text", str(part))
                for part in raw_content
            )
        else:
            raw_text = str(raw_content)

        # Parse extraction block
        extraction = parse_extraction(raw_text)
        visible_text = strip_extraction(raw_text)

        # Update state based on extraction
        intent = state.get("intent", "general")
        current_type = state.get("current_resource_type")
        collected = dict(state.get("collected_fields", {}))
        pending = list(state.get("pending_resources", []))
        missing = list(state.get("missing_fields", []))
        dependency_asked = state.get("dependency_asked", False)

        if extraction:
            extracted_intent = extraction.get("intent", "general")
            intent = extracted_intent

            # Capture existing_resource_id for updates
            existing_resource_id = extraction.get("existing_resource_id")

            extracted_type = extraction.get("resource_type")
            if extracted_type and extracted_type in RESOURCE_FIELD_SCHEMAS:
                if current_type and current_type != extracted_type and collected:
                    # Switching resource type — finalize current one into pending
                    pending_item = {
                        "type": current_type,
                        "fields": dict(collected),
                    }
                    if existing_resource_id:
                        pending_item["existing_id"] = existing_resource_id
                    pending.append(pending_item)
                    collected = {}
                    dependency_asked = False
                current_type = extracted_type

            # Merge extracted fields
            extracted_fields = extraction.get("fields", {})
            for k, v in extracted_fields.items():
                if v is not None:
                    collected[k] = v

            # Handle confirmation
            if intent == "confirm":
                # Finalize current resource if it has collected fields
                resource_name = collected.get("name")
                # For updates: auto-resolve name from existing resource if not provided
                if not resource_name and (collected.get("__existing_id") or existing_resource_id):
                    eid = existing_resource_id or collected.get("__existing_id")
                    for ex in state.get("existing_resources", []):
                        if ex.get("id") == eid:
                            resource_name = ex.get("name", "existing-resource")
                            collected["name"] = resource_name
                            break
                
                if current_type and collected:
                    if not resource_name:
                        resource_name = f"{current_type}-resource"
                        collected["name"] = resource_name
                        
                    pending_item = {
                        "type": current_type,
                        "fields": {k: v for k, v in collected.items() if not k.startswith("__")},
                    }
                    if existing_resource_id:
                        pending_item["existing_id"] = existing_resource_id
                    elif collected.get("__existing_id"):
                        pending_item["existing_id"] = collected["__existing_id"]
                    pending.append(pending_item)
                    collected = {}

            # Handle update_infra — store the existing_resource_id and auto-resolve name
            if intent == "update_infra":
                if existing_resource_id:
                    collected["__existing_id"] = existing_resource_id
                # Auto-resolve name from existing resource for updates
                if not collected.get("name") and collected.get("__existing_id"):
                    for ex in state.get("existing_resources", []):
                        if ex.get("id") == collected["__existing_id"]:
                            collected["name"] = ex.get("name", "existing-resource")
                            break

            # Handle cancel
            if intent == "cancel":
                pending = []
                collected = {}
                current_type = None
                missing = []
                dependency_asked = False

        # Recompute missing fields — SKIP for updates (only changed fields needed)
        if current_type and intent not in ("confirm", "cancel", "update_infra"):
            missing = compute_missing_fields(current_type, collected)
        elif intent == "update_infra":
            missing = []  # Updates don't require all fields

        # Determine response type
        response_type = "text"
        if intent == "confirm" and pending:
            response_type = "saving"
        elif intent == "update_infra" and current_type:
            # Updates are ready to confirm as soon as we have fields to change
            has_changes = any(k for k in collected if not k.startswith("__") and k != "name")
            if has_changes:
                response_type = "ready_to_confirm"
        elif not missing and current_type and intent == "create_infra":
            response_type = "ready_to_confirm"

        return {
            **state,
            "intent": intent,
            "current_resource_type": current_type,
            "collected_fields": collected,
            "missing_fields": missing,
            "pending_resources": pending,
            "dependency_asked": dependency_asked,
            "response_content": visible_text,
            "raw_response": raw_text,
            "response_type": response_type,
        }

    except Exception as e:
        logger.error(f"Error in process_message: {e}", exc_info=True)
        return {
            **state,
            "response_content": f"I encountered an error processing your request. Please try again.",
            "raw_response": f"I encountered an error processing your request. Please try again.",
            "response_type": "text",
        }


async def save_resources(state: InfraChatState) -> InfraChatState:
    """
    Save all pending resources to DB via project-service API.
    Distinguishes between CREATE (new) and UPDATE (existing) based on
    whether the resource has an 'existing_id' field.
    """
    pending = state.get("pending_resources", [])
    saved = list(state.get("saved_resources", []))
    existing = list(state.get("existing_resources", []))
    project_id = state.get("project_id", "")
    auth_token = state.get("auth_token", "")

    if not pending:
        return {
            **state,
            "response_content": "No resources to save.",
            "raw_response": "No resources to save.",
            "response_type": "text",
        }

    results = []
    errors = []

    for resource in pending:
        existing_id = resource.get("existing_id")  # May be set by LLM extraction
        resource_type = resource["type"]
        fields = resource["fields"]

        # ── Auto-detect: match against existing_resources by name+type ──
        if not existing_id and existing:
            resource_name = fields.get("name", "").lower().strip()
            for ex in existing:
                ex_name = (ex.get("name") or "").lower().strip()
                ex_type = ex.get("type", "")
                # Match by exact name+type, or same type when only one exists
                if ex_type == resource_type:
                    if ex_name and resource_name and ex_name == resource_name:
                        existing_id = ex.get("id")
                        logger.info(f"Auto-matched existing resource by name+type: {existing_id}")
                        break
            # If only one resource of this type exists and no name match, use it
            if not existing_id:
                same_type = [ex for ex in existing if ex.get("type") == resource_type]
                if len(same_type) == 1:
                    existing_id = same_type[0].get("id")
                    logger.info(f"Auto-matched single existing {resource_type}: {existing_id}")

        if existing_id:
            # ── UPDATE existing resource ──────────────────────────
            schema = RESOURCE_FIELD_SCHEMAS.get(resource_type, {})
            config = {}
            for fname, fmeta in schema.get("config_fields", {}).items():
                value = fields.get(fname)
                if value is not None:
                    if fmeta["type"] == "int":
                        try: value = int(value)
                        except (ValueError, TypeError): pass
                    elif fmeta["type"] == "bool":
                        if isinstance(value, str):
                            value = value.lower() in ("true", "yes", "1")
                    config[fname] = value

            update_data = {
                "config": config,
                "change_reason": "Updated via AI chat",
                "changed_by": "infra-copilot",
            }
            if fields.get("name"):
                update_data["name"] = fields["name"]

            logger.info(f"Updating resource {existing_id}: {resource_type} / {fields.get('name', '?')}")
            result = await project_client.update_resource(existing_id, update_data, auth_token)

            if result.get("error"):
                errors.append(f"Failed to update {resource_type} '{fields.get('name', '?')}': {result.get('detail', 'Unknown error')}")
            else:
                resource_id = result.get("id", existing_id)
                saved.append({
                    "id": resource_id,
                    "type": resource_type,
                    "name": fields.get("name", result.get("name", "?")),
                    "state": "planned",
                    "action": "updated",
                })
                for i, ex in enumerate(existing):
                    if ex.get("id") == existing_id:
                        existing[i] = {**ex, **result}
                        break
                results.append(f"✅ {resource_type.capitalize()} **'{fields.get('name', '?')}'** updated (ID: `{resource_id}`)")

        else:
            # ── CREATE new resource ───────────────────────────────
            payload = build_resource_payload(
                project_id=project_id,
                resource_type=resource_type,
                collected=fields,
                depends_on=[],
            )

            logger.info(f"Creating resource: {payload.get('type')} / {payload.get('name')}")
            result = await project_client.create_resource(payload, auth_token)

            if result.get("error"):
                errors.append(f"Failed to create {resource_type} '{fields.get('name', '?')}': {result.get('detail', 'Unknown error')}")
            else:
                resource_id = result.get("id", "?")
                saved.append({
                    "id": resource_id,
                    "type": resource_type,
                    "name": fields.get("name", "?"),
                    "state": "planned",
                    "action": "created",
                })
                results.append(f"✅ {resource_type.capitalize()} **'{fields.get('name', '?')}'** created (ID: `{resource_id}`)")

    # Build response
    if results and not errors:
        response = f"{''.join(chr(10) + r for r in results)}\n\n{'All' if len(results) > 1 else 'Your'} {'resources have' if len(results) > 1 else 'resource has'} been saved successfully! Need anything else for this project?"
    elif results and errors:
        response = "\n".join(results) + "\n\nHowever, some resources failed:\n" + "\n".join(f"❌ {e}" for e in errors)
    else:
        response = "❌ Failed to save resources:\n" + "\n".join(f"- {e}" for e in errors)

    return {
        **state,
        "pending_resources": [],
        "saved_resources": saved,
        "existing_resources": existing,
        "collected_fields": {},
        "current_resource_type": None,
        "missing_fields": [],
        "dependency_asked": False,
        "intent": "general",
        "response_content": response,
        "raw_response": response,
        "response_type": "saved",
    }


# ═══════════════════════════════════════════════════════════════════════
#  GRAPH CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════

def build_infra_chat_graph() -> StateGraph:
    """Build and compile the LangGraph workflow."""
    workflow = StateGraph(InfraChatState)

    # Add nodes
    workflow.add_node("process_message", process_message)
    workflow.add_node("save_resources", save_resources)

    # Entry point
    workflow.set_entry_point("process_message")

    # Conditional edge: after processing, either save or end
    def route_after_processing(state: InfraChatState) -> str:
        if state.get("response_type") == "saving" and state.get("pending_resources"):
            return "save_resources"
        return "end"

    workflow.add_conditional_edges(
        "process_message",
        route_after_processing,
        {
            "save_resources": "save_resources",
            "end": END,
        },
    )

    workflow.add_edge("save_resources", END)

    return workflow.compile()


# ═══════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ═══════════════════════════════════════════════════════════════════════

# Compiled graph instance (created once at import time)
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
        "messages": session_state.get("messages", []),
        "session_id": session_state.get("session_id", ""),
        "project_id": session_state.get("project_id", ""),
        "project_name": session_state.get("project_name", "Unknown"),
        "project_info": session_state.get("project_info", {}),
        "user_message": user_message,
        "auth_token": session_state.get("auth_token", ""),
        "intent": session_state.get("intent", "general"),
        "current_resource_type": session_state.get("current_resource_type"),
        "collected_fields": session_state.get("collected_fields", {}),
        "missing_fields": session_state.get("missing_fields", []),
        "pending_resources": session_state.get("pending_resources", []),
        "saved_resources": session_state.get("saved_resources", []),
        "existing_resources": session_state.get("existing_resources", []),
        "dependency_asked": session_state.get("dependency_asked", False),
        "response_content": "",
        "response_type": "text",
    }

    # Run the graph
    result = await _chat_graph.ainvoke(input_state)

    # Return the full updated state
    return result
