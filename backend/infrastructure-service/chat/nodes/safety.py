import logging
import json
from langchain_core.messages import HumanMessage, SystemMessage
from chat.prompts import build_safety_prompt
from chat.schemas import SafetyReview

logger = logging.getLogger(__name__)

def _format_config_value(value) -> str:
    """Format a config value for markdown display."""
    if isinstance(value, bool):
        return "✅ Yes" if value else "❌ No"
    if isinstance(value, list):
        if not value:
            return "—"
        if all(isinstance(v, str) for v in value):
            return ", ".join(value)
        return f"{len(value)} items"
    if isinstance(value, dict):
        if not value:
            return "—"
        return f"{len(value)} entries"
    if value is None:
        return "—"
    return str(value)


# Keys to skip in the detailed config display (noise / internal)
_SKIP_CONFIG_KEYS = {"tags", "tags_all", "arn", "id"}


def _build_plan_response(state: dict, plan_dict: dict) -> dict:
    """Build the final plan response with markdown, workbook, etc.
    
    Extracted so both the happy path AND the fallback (safety LLM crash) 
    can produce a valid response instead of returning an empty string.
    """
    val_report = state.get("validation_report")
    cost_report = val_report.get("cost_estimate_details", {}) if isinstance(val_report, dict) else {}
    cost_str = f"${cost_report.get('total_monthly_usd', 0)}/mo"
    cost_breakdown = cost_report.get("breakdown", {})

    markdown_plan = f"## Infrastructure Plan\n\n**Summary**: {plan_dict.get('summary', '')}\n\n"
    markdown_plan += "| Order | Resource | Type | Rationale |\n|---|---|---|---|\n"
    for r in plan_dict.get("resources", []):
        markdown_plan += f"| {r.get('order')} | {r.get('name')} | {r.get('type')} | {r.get('rationale')} |\n"

    markdown_plan += f"\n**Estimated Cost**: {cost_str}\n\n"

    # ── Detailed per-resource config section ──
    markdown_plan += "---\n\n### Resource Configuration Details\n\n"
    for r in plan_dict.get("resources", []):
        r_name = r.get("name", "?")
        r_type = r.get("type", "?")
        r_cost = cost_breakdown.get(r_name, "")
        cost_label = f" — ~${r_cost}/mo" if r_cost else ""

        markdown_plan += f"**{r.get('order')}. {r_name}** (`{r_type}`){cost_label}\n\n"

        config = r.get("config", {})
        if config:
            markdown_plan += "| Parameter | Value |\n|---|---|\n"
            for k, v in config.items():
                if k.lower() in _SKIP_CONFIG_KEYS:
                    continue
                if v is None or v == "" or v == []:
                    continue
                display_key = k.replace("_", " ").title()
                markdown_plan += f"| {display_key} | {_format_config_value(v)} |\n"
            markdown_plan += "\n"
        else:
            markdown_plan += "*Default configuration*\n\n"

    markdown_plan += "*Review the details above and click **Approve & Provision** on the plan card, or ask me to modify specific resources.*"

    workbook = [
        {
            "order": r.get("order", i + 1),
            "type": r.get("type", "unknown"),
            "name": r.get("name", f"resource-{i+1}"),
            "status": "pending",
            "resource_id": None,
            "error": None,
        }
        for i, r in enumerate(plan_dict.get("resources", []))
    ]

    return {
        **state,
        "response_content": markdown_plan,
        "raw_response": markdown_plan,
        "response_type": "plan",
        "implementation_plan": plan_dict,
        "plan_status": "draft",
        "workbook": workbook,
        "approved_orders": [],
    }


async def safety_review(state: dict, llm) -> dict:
    """Node 4: Perform a safety and security review of the plan."""
    logger.info("Running safety_review node...")
    
    plan_dict = state.get("generated_plan")
    if not plan_dict or state.get("response_type") == "invalid_plan":
        # If there's no plan or it was invalid, ensure we have a response_content
        if not state.get("response_content"):
            return {
                **state,
                "response_content": "Could not generate an infrastructure plan. Please try again with more details.",
                "response_type": "text",
            }
        return state
        
    try:
        plan_summary = json.dumps(plan_dict.get("resources", []), indent=2)
        system_prompt = build_safety_prompt(plan_summary)
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content="Please review this infrastructure plan for safety and security.")
        ]
        
        structured_llm = llm.bind(temperature=0.1).with_structured_output(SafetyReview)
        
        logger.info("Invoking safety reviewer LLM...")
        review: SafetyReview = await structured_llm.ainvoke(messages)
        
        logger.info(f"Safety review result: is_safe={review.is_safe}")

        # ── DEBUG: Print full LLM response to terminal ──
        print("\n" + "=" * 70)
        print("🤖 [SAFETY REVIEWER] LLM RESPONSE")
        print("=" * 70)
        print(f"  Is Safe     : {review.is_safe}")
        print(f"  Warnings    : {review.security_warnings}")
        if hasattr(review, 'suggestions'):
            print(f"  Suggestions : {review.suggestions}")
        print("=" * 70 + "\n")
        
        if not review.is_safe:
            logger.warning(f"Safety review flagged warnings: {review.security_warnings}")
            # Still show the plan, but prepend security warnings so the user can decide
            result = _build_plan_response(state, plan_dict)
            warnings_text = "\n".join(f"- {w}" for w in review.security_warnings) if review.security_warnings else "- Unspecified security concerns"
            result["safety_warnings"] = review.security_warnings
            result["response_content"] = (
                f"⚠️ **Security Warnings**\n\n{warnings_text}\n\n"
                "---\n\n"
                + result["response_content"]
            )
            result["raw_response"] = result["response_content"]
            return result
            
        # Build and return the full plan response
        return _build_plan_response(state, plan_dict)
        
    except Exception as e:
        logger.error(f"Error in safety_review: {e}", exc_info=True)
        # CRITICAL: Do NOT return bare `state` — it has response_content=""
        # Instead, skip safety review and return the plan anyway with a warning
        logger.warning("Safety review failed, returning plan without safety check.")
        result = _build_plan_response(state, plan_dict)
        result["response_content"] = "⚠️ *Safety review was skipped due to an internal error.*\n\n" + result["response_content"]
        result["raw_response"] = result["response_content"]
        return result
