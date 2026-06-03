import logging
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from chat.prompts import build_extractor_prompt
from chat.schemas import ExtractionResult

logger = logging.getLogger(__name__)

async def extract_request(state: dict, llm) -> dict:
    """Node 1: Extract intent and fields from user message."""
    logger.info("Running extract_request node...")
    
    if not llm:
        return {
            **state,
            "response_content": "LLM service is not available.",
            "response_type": "text"
        }
        
    try:
        # Intercept system triggers
        history = state.get("messages", [])
        if history:
            last_msg = history[-1]
            content = ""
            if isinstance(last_msg, dict):
                content = last_msg.get("content", "")
            else:
                content = getattr(last_msg, "content", "")
                
            if "[INIT_REPO_SCAN]" in content or "/scan-repo" in content or "/plan" in content:
                logger.info(f"Intercepted plan trigger. Content: {content}")
                return {
                    **state,
                    "intent": "plan",
                    "response_content": "Analyzing repository to generate a plan...",
                    "response_type": "text"
                }

        # Build prompt
        system_prompt = build_extractor_prompt(
            project_name=state.get("project_name", "Unknown"),
            existing_resources=state.get("existing_resources", []),
            conversation_summary=state.get("conversation_summary", {}),
            previous_plan=state.get("generated_plan") or state.get("implementation_plan")
        )
        
        messages = [SystemMessage(content=system_prompt)]
        
        # Add history
        history = state.get("messages", [])
        for msg in history[-10:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))
            elif isinstance(msg, (HumanMessage, AIMessage)):
                messages.append(msg)
                
        # Force structured output using Pydantic
        # temperature = 0.0 for deterministic extraction
        structured_llm = llm.bind(temperature=0.0).with_structured_output(ExtractionResult)
        
        logger.info(f"Invoking extractor LLM with {len(messages)} messages...")
        try:
            extraction: ExtractionResult = await structured_llm.ainvoke(messages)
            logger.info(f"Extraction result: intent={extraction.intent}, confidence={extraction.confidence}")

            # ── DEBUG: Print full LLM response to terminal ──
            print("\n" + "=" * 70)
            print("🤖 [EXTRACTOR] LLM RESPONSE")
            print("=" * 70)
            print(f"  Intent      : {extraction.intent}")
            print(f"  Confidence  : {extraction.confidence}")
            print(f"  Message     : {extraction.message_to_user}")
            print(f"  Resources   : {extraction.resources}")
            print(f"  Approved    : {extraction.approved_orders}")
            print("=" * 70 + "\n")
        except Exception as e:
            logger.warning(f"Error extracting request (LLM schema violation): {e}")
            
            # Fallback heuristic for common plan triggers when LLM fails parsing
            content_lower = content.lower() if 'content' in locals() else ""
            if "scan" in content_lower or "plan" in content_lower or "architecture" in content_lower or "build" in content_lower:
                logger.info("Heuristic fallback: routing to plan intent")
                return {
                    **state,
                    "intent": "plan",
                    "response_content": "Analyzing your requirements and generating an infrastructure plan...",
                    "response_type": "text"
                }
                
            return {
                **state,
                "intent": "general",
                "response_content": "I couldn't fully parse your request. Could you please rephrase or simplify it?",
                "response_type": "text"
            }
        
        # Handle low confidence
        if extraction.confidence < 0.7:
            logger.warning(f"Low extraction confidence ({extraction.confidence}). Requesting clarification.")
            return {
                **state,
                "intent": "general",
                "response_content": extraction.message_to_user or "I'm not entirely sure what you want to do. Could you please clarify your request?",
                "response_type": "text"
            }
            
        # Update state based on extraction
        intent = extraction.intent
        
        # For "plan" intent, ensure there's always a response_content
        # (the planner will overwrite it, but if it crashes the user still sees something)
        response_content = extraction.message_to_user or ""
        if intent == "plan" and not response_content:
            response_content = "Analyzing your requirements and generating an infrastructure plan..."
        elif intent == "general":
            response_content = extraction.message_to_user or "How can I help with your infrastructure?"
        
        return {
            **state,
            "intent": intent,
            "extracted_resources": [r.model_dump() for r in extraction.resources],
            "approved_orders": extraction.approved_orders,
            "response_content": response_content,
            "response_type": "text" if intent == "general" else "extracted"
        }
        
    except Exception as e:
        logger.error(f"Error in extract_request: {e}", exc_info=True)
        return {
            **state,
            "response_content": "I had trouble understanding your request. Could you please rephrase it?",
            "response_type": "text"
        }
