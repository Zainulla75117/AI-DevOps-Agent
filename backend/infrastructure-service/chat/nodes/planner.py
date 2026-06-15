import logging
import json
import re
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


# ═══════════════════════════════════════════════════════════════════════
#  EVIDENCE-BASED RESOURCE FILTERING
#  Deterministic code filter — scans repo dependency files for known
#  technology keywords and strips LLM-generated resources that lack
#  supporting evidence.
# ═══════════════════════════════════════════════════════════════════════

# Resource types that are always included regardless of evidence
_WHITELISTED_TYPES = {"network", "compute", "container", "monitoring", "loadbalancer"}

# Map of resource type → keywords to search for in dependency file contents.
# If ANY keyword matches (case-insensitive word boundary), the resource is evidenced.
_EVIDENCE_MAP: dict[str, list[str]] = {
    "database": [
        "pg", "postgres", "mysql", "mysql2", "mongoose", "mongodb", "mongo",
        "prisma", "sequelize", "typeorm", "sqlalchemy", "psycopg2", "psycopg",
        "pymongo", "django.db", "knex", "drizzle", "mikro-orm", "mariadb",
        "sqlite3", "better-sqlite3", "peewee", "tortoise-orm", "databases",
        "asyncpg", "aiomysql", "motor",
    ],
    "cache": [
        "redis", "ioredis", "memcached", "pymemcache", "django-redis",
        "bull", "bullmq", "aioredis", "redis-py",
    ],
    "queue": [
        "amqplib", "amqp", "sqs-consumer", "@aws-sdk/client-sqs",
        "celery", "rabbitmq", "pika", "kafka", "kafkajs", "confluent-kafka",
        "@aws-sdk/client-sns", "kombu",
    ],
    "storage": [
        "@aws-sdk/client-s3", "multer-s3", "boto3",
        "s3", "minio", "@google-cloud/storage",
    ],
    "cdn": [
        "react", "react-dom", "vue", "@angular/core", "next", "nuxt",
        "svelte", "gatsby", "vite", "@vue/cli",
    ],
    "serverless": [
        "serverless", "@aws-sdk/client-lambda", "aws-cdk", "aws-sam",
        "chalice", "zappa",
    ],
    "apigateway": [
        "@aws-sdk/client-apigateway", "@aws-sdk/client-apigatewayv2",
    ],
    "events": [
        "@aws-sdk/client-eventbridge", "@aws-sdk/client-scheduler",
    ],
    "secrets": [
        "@aws-sdk/client-secrets-manager", "@aws-sdk/client-ssm",
    ],
    "security": [],  # User-explicit only
    "dns": [],        # User-explicit only
}


def _detect_repo_evidence(state: dict) -> set[str]:
    """Scan repo dependency files and return a set of evidenced resource types.

    Checks both the raw dependency file contents (package.json, requirements.txt,
    etc.) and the repo scan memory for keyword matches.
    """
    evidence: set[str] = set()
    
    # Collect all searchable text from repo data
    searchable_texts: list[str] = []
    
    # 1. Dependency file contents
    repo_tree = state.get("repo_tree", {})
    if repo_tree:
        dep_files = repo_tree.get("dependency_files", {})
        for filepath, content in dep_files.items():
            searchable_texts.append(content.lower())
        # Also check file tree for structural evidence (e.g., Dockerfile)
        tree_files = repo_tree.get("tree", [])
        if tree_files:
            searchable_texts.append(" ".join(tree_files).lower())
    
    # 2. Repo scan memory
    repo_scan_memory = state.get("repo_scan_memory")
    if repo_scan_memory:
        scan_content = repo_scan_memory.get("content", "")
        if scan_content:
            searchable_texts.append(scan_content.lower())
    
    if not searchable_texts:
        return evidence
    
    combined_text = "\n".join(searchable_texts)
    
    for resource_type, keywords in _EVIDENCE_MAP.items():
        for keyword in keywords:
            # Use word boundary matching to avoid false positives
            # e.g., "pg" should match '"pg"' but not "page"
            pattern = r'(?:^|[\s"\',;:{}\[\]()/\\])' + re.escape(keyword.lower()) + r'(?:$|[\s"\',;:{}\[\]()/\\@])'
            if re.search(pattern, combined_text):
                evidence.add(resource_type)
                logger.info(f"  Evidence found: '{keyword}' → resource type '{resource_type}'")
                break  # One match is enough for this resource type
    
    return evidence


def _filter_unevidenced_resources(
    plan_dict: dict,
    evidence: set[str],
    state: dict,
) -> tuple[dict, list[str]]:
    """Filter out LLM-generated resources that lack repo evidence.

    Args:
        plan_dict: The LLM-generated plan as a dict (from model_dump()).
        evidence: Set of resource types with evidence from _detect_repo_evidence().
        state: The full workflow state (to check user-requested resources).

    Returns:
        Tuple of (filtered_plan_dict, list_of_removal_warnings).
    """
    resources = plan_dict.get("resources", [])
    if not resources:
        return plan_dict, []
    
    # Build set of user-explicitly-requested resource types (from extractor)
    user_requested_types: set[str] = set()
    extracted = state.get("extracted_resources", [])
    for ext_res in extracted:
        r_type = ext_res.get("type", "").lower()
        if r_type:
            user_requested_types.add(r_type)
    
    kept: list[dict] = []
    removed_warnings: list[str] = []
    
    for res in resources:
        r_type = res.get("type", "").lower()
        r_name = res.get("name", "unknown")
        
        # Always keep whitelisted types
        if r_type in _WHITELISTED_TYPES:
            kept.append(res)
            continue
        
        # Keep if user explicitly requested this resource type
        if r_type in user_requested_types:
            kept.append(res)
            logger.info(f"  Keeping '{r_name}' ({r_type}) — user explicitly requested.")
            continue
        
        # Keep if evidence found in repo
        if r_type in evidence:
            kept.append(res)
            continue
        
        # No evidence — filter it out
        warning = f"Removed '{r_name}' ({r_type}) — no supporting evidence found in repository dependencies."
        removed_warnings.append(warning)
        logger.warning(f"  FILTERED: {warning}")
    
    # Re-sequence orders if resources were removed
    if len(kept) < len(resources):
        # Build a mapping from old order → resource for dependency fixup
        old_to_new_order: dict[int, int] = {}
        for new_idx, res in enumerate(kept, start=1):
            old_to_new_order[res["order"]] = new_idx
        
        for res in kept:
            old_order = res["order"]
            res["order"] = old_to_new_order[old_order]
            # Fix depends_on references
            res["depends_on"] = [
                old_to_new_order[dep]
                for dep in res.get("depends_on", [])
                if dep in old_to_new_order
            ]
    
    plan_dict["resources"] = kept
    return plan_dict, removed_warnings


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

        # ── Evidence-based resource filtering ──
        # Deterministic filter: strip resources the LLM hallucinated
        # that have no supporting evidence in the repo.
        evidence_set = _detect_repo_evidence(state)
        logger.info(f"Repo evidence detected for resource types: {evidence_set or '{none}'}")
        
        raw_plan = plan.model_dump()
        raw_count = len(raw_plan.get("resources", []))
        
        filtered_plan, removal_warnings = _filter_unevidenced_resources(raw_plan, evidence_set, state)
        filtered_count = len(filtered_plan.get("resources", []))
        
        if removal_warnings:
            logger.info(f"Evidence filter: {raw_count} → {filtered_count} resources ({raw_count - filtered_count} removed)")
            for w in removal_warnings:
                print(f"  ⚠️  {w}")
        
        # ── AWS schema validation & enrichment ──
        # Validate each resource config against AWS-specific schemas,
        # filling in defaults for any fields the LLM didn't populate.
        enriched_plan = filtered_plan
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

        # Merge removal warnings into validation_errors for transparency
        existing_val_errors = state.get("validation_errors", []) or []
        all_val_warnings = existing_val_errors + removal_warnings
        
        final_count = len(enriched_plan.get("resources", []))
        response_msg = f"Generated a plan with {final_count} resources."
        if removal_warnings:
            response_msg += f" ({len(removal_warnings)} resource(s) removed — no evidence in repo.)"
        response_msg += " Validating..."
        
        return {
            **state,
            "generated_plan": enriched_plan,
            "validation_errors": all_val_warnings,
            "response_content": response_msg,
            "raw_response": response_msg,
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
