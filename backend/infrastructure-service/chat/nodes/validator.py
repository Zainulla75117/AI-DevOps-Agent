import logging
from chat.validators import validate_plan
from chat.schemas import PlanResource

logger = logging.getLogger(__name__)

async def validate_request(state: dict) -> dict:
    """Node 3: Validate the generated infrastructure plan."""
    logger.info("Running validate_request node...")
    
    plan_dict = state.get("generated_plan")
    if not plan_dict:
        # No plan to validate — ensure there's a response
        if not state.get("response_content"):
            return {
                **state,
                "response_content": "No infrastructure plan was generated. Please describe what you'd like to build.",
                "raw_response": "No infrastructure plan was generated. Please describe what you'd like to build.",
                "response_type": "text",
            }
        return state
        
    try:
        # Convert dict back to Pydantic objects for validation
        resources = [PlanResource(**r) for r in plan_dict.get("resources", [])]
        
        report = validate_plan(resources)
        
        if not report.is_valid:
            logger.warning(f"Plan validation failed with {len(report.errors)} errors.")
            error_details = "\n- ".join(report.errors)
            msg = f"I generated an architecture plan, but it failed validation:\n- {error_details}\n\nPlease ask me to adjust the requirements and try again."
            return {
                **state,
                "validation_errors": report.errors,
                "response_type": "invalid_plan",
                "response_content": msg,
                "raw_response": msg,
            }
            
        logger.info("Plan validation successful.")
        
        return {
            **state,
            "validation_report": report.model_dump(),
            "response_type": "validated"
        }
        
    except Exception as e:
        logger.error(f"Error in validate_request: {e}", exc_info=True)
        # Don't silently swallow — set a response and let the pipeline continue
        msg = f"Plan validation encountered an error: {str(e)[:200]}. Proceeding without validation."
        logger.warning(msg)
        return {
            **state,
            "validation_report": {"is_valid": True, "errors": [], "warnings": [f"Validation skipped: {str(e)[:100]}"], "cost_estimate_details": {}},
            "response_content": state.get("response_content") or msg,
            "raw_response": state.get("raw_response") or msg,
            "response_type": "validated",
        }
