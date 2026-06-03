import logging
import json
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from chat.prompts import build_planner_prompt
from chat.schemas import ResourcePlan
from chat.tools import get_architecture_template, get_available_regions
from app.schemas.resource_schemas import ResourceType
from app.schemas.aws_schemas import AWS_CONFIG_REGISTRY, AWS_CONFIG_ALTERNATIVES

logger = logging.getLogger(__name__)


def _format_repo_context(state: dict) -> str:
    """Build a rich, structured repo context string for the planner LLM.
    
    Combines repo_tree (raw file list + dependency file contents) and
    repo_scan_memory (persisted analysis from a previous scan) into a 
    single context block the LLM can reason over.
    """
    parts = []
    
    # 1. Repo scan memory (previously analyzed summary)
    repo_scan_memory = state.get("repo_scan_memory")
    if repo_scan_memory:
        scan_content = repo_scan_memory.get("content", "")
        if scan_content:
            parts.append(f"=== PREVIOUS REPO ANALYSIS ===\n{scan_content}")
    
    # 2. Raw repo tree data
    repo_tree = state.get("repo_tree", {})
    if not repo_tree or (not repo_tree.get("tree") and not repo_tree.get("dependency_files")):
        if not parts:
            return "No repository data available. Generate a general-purpose architecture."
        return "\n\n".join(parts)
    
    # File tree (truncate to first 200 files for context window)
    tree_files = repo_tree.get("tree", [])
    if tree_files:
        display_files = tree_files[:200]
        tree_str = "\n".join(f"  {f}" for f in display_files)
        if len(tree_files) > 200:
            tree_str += f"\n  ... and {len(tree_files) - 200} more files"
        parts.append(f"=== REPOSITORY FILE TREE ({len(tree_files)} files) ===\n{tree_str}")
    
    # Dependency files (the actual contents of package.json, Dockerfile, etc.)
    dep_files = repo_tree.get("dependency_files", {})
    if dep_files:
        dep_parts = []
        for filepath, content in dep_files.items():
            # Truncate individual files to 3000 chars
            truncated = content[:3000] + "..." if len(content) > 3000 else content
            dep_parts.append(f"--- {filepath} ---\n{truncated}")
        parts.append(f"=== DEPENDENCY & CONFIG FILES ({len(dep_files)} files) ===\n" + "\n\n".join(dep_parts))
    
    return "\n\n".join(parts) if parts else "No repository data available."


async def generate_execution_plan(state: dict, llm) -> dict:
    """Node 2: Generate a deterministic infrastructure plan."""
    logger.info("Running generate_execution_plan node...")
    
    intent = state.get("intent")
    if intent not in ("plan", "create_infra", "update_infra", "edit"):
        return state # Skip if not planning
        
    try:
        # Build rich repo context
        repo_context = _format_repo_context(state)
        
        system_prompt = build_planner_prompt(
            project_name=state.get("project_name", "Unknown"),
            project_info=state.get("project_info", {}),
            repo_context=repo_context,
            existing_resources=state.get("existing_resources", []),
            validation_errors=state.get("validation_errors", []),
            previous_plan=state.get("generated_plan") or state.get("implementation_plan")
        )
        
        messages = [SystemMessage(content=system_prompt)]
        
        # Add the extracted resources as context
        extracted = state.get("extracted_resources", [])
        
        # Get last user message
        history = state.get("messages", [])
        last_user_msg = "Generate an optimal architecture plan for this project."
        for msg in reversed(history):
            if isinstance(msg, dict) and msg.get("role") == "user":
                last_user_msg = msg.get("content", "")
                break
            elif type(msg).__name__ == "HumanMessage":
                last_user_msg = getattr(msg, "content", "")
                break
                
        messages.append(HumanMessage(content=f"User Request: {last_user_msg}\nExtracted requirements: {extracted}"))
        
        # Force structured output directly (deterministic, simple)
        structured_llm = llm.bind(temperature=0.0).with_structured_output(ResourcePlan)
        
        logger.info(f"Invoking planner LLM with repo context ({len(repo_context)} chars)...")
        plan: ResourcePlan = await structured_llm.ainvoke(messages)
        
        logger.info(f"Generated plan with {len(plan.resources)} resources. Confidence: {plan.confidence}")

        # ── DEBUG: Print full LLM response to terminal ──
        import json as _json
        print("\n" + "=" * 70)
        print("🤖 [PLANNER] LLM RESPONSE")
        print("=" * 70)
        print(f"  Summary     : {plan.summary}")
        print(f"  Confidence  : {plan.confidence}")
        print(f"  Resources ({len(plan.resources)}):")
        for r in plan.resources:
            r_dump = r.model_dump() if hasattr(r, 'model_dump') else r
            print(f"    [{r_dump.get('order')}] {r_dump.get('name')} ({r_dump.get('type')})")
            print(f"        Rationale  : {r_dump.get('rationale', '')}")
            print(f"        Depends On : {r_dump.get('depends_on', [])}")
            print(f"        Config     : {_json.dumps(r_dump.get('config', {}), indent=6, default=str)}")
        print("=" * 70 + "\n")
        
        if plan.confidence < 0.8:
            logger.warning(f"Low planner confidence ({plan.confidence}).")

        # ── AWS schema validation & enrichment ──
        # Validate each resource config against AWS-specific schemas,
        # filling in defaults for any fields the LLM didn't populate.
        enriched_plan = plan.model_dump()
        for res in enriched_plan.get("resources", []):
            try:
                r_type = ResourceType(res.get("type", "").lower())
                config = res.get("config", {})

                # Detect sub-type alternatives (e.g., DynamoDB vs RDS)
                aws_cls = None
                alternatives = AWS_CONFIG_ALTERNATIVES.get(r_type)
                if alternatives:
                    # Check for service_type / orchestrator hints in config
                    service_hint = (
                        config.get("service_type", "")
                        or config.get("orchestrator", "")
                        or ""
                    )
                    for alt_key, alt_cls in alternatives.items():
                        if alt_key.lower() in service_hint.lower():
                            aws_cls = alt_cls
                            break

                if not aws_cls:
                    aws_cls = AWS_CONFIG_REGISTRY.get(r_type)

                if aws_cls:
                    # Dynamically populate required name fields if the LLM omitted them
                    for field_name, field_info in aws_cls.model_fields.items():
                        if field_info.is_required() and ("name" in field_name or "identifier" in field_name):
                            if field_name not in config:
                                config[field_name] = res.get("name", f"resource-{res.get('order', 0)}")

                    validated = aws_cls(**config)
                    res["config"] = validated.model_dump()
                    logger.info(f"  AWS schema enriched: {res.get('name')} ({aws_cls.__name__})")
            except Exception as e:
                logger.warning(f"  AWS schema validation for {res.get('name', '?')}: {e}")

        return {
            **state,
            "generated_plan": enriched_plan,
            "response_content": f"Generated a plan with {len(plan.resources)} resources. Validating...",
            "raw_response": f"Generated a plan with {len(plan.resources)} resources. Validating...",
            "response_type": "planned"
        }
        
    except Exception as e:
        logger.error(f"Error in generate_execution_plan: {e}", exc_info=True)
        return {
            **state,
            "response_content": f"I encountered an error while generating the infrastructure plan. Please try again.\n\nError: {str(e)[:200]}",
            "raw_response": f"I encountered an error while generating the infrastructure plan. Please try again.\n\nError: {str(e)[:200]}",
            "response_type": "text"
        }
