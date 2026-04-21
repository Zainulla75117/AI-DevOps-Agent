"""
System prompts, field schemas, and dependency suggestion rules
for the infrastructure chat LangGraph workflow.
"""

# ═══════════════════════════════════════════════════════════════════════
#  FIELD SCHEMAS
# ═══════════════════════════════════════════════════════════════════════

RESOURCE_FIELD_SCHEMAS = {
    "network": {
        "label": "Network / VPC",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "vpc_name": {"type": "str", "default": None, "required": True, "description": "VPC name"},
            "vpc_cidr": {"type": "str", "default": "10.0.0.0/16", "required": True, "description": "VPC CIDR block"},
            "nat_gateway": {"type": "str", "default": "yes", "required": True, "description": "Enable NAT Gateway (yes/no)"},
            "public_subnet_count": {"type": "int", "default": 2, "required": True, "description": "Public subnets"},
            "private_subnet_count": {"type": "int", "default": 2, "required": True, "description": "Private subnets"},
            "availability_zones_count": {"type": "int", "default": 2, "required": True, "description": "AZ count"},
            "enable_dns_hostnames": {"type": "bool", "default": True, "required": False, "description": "DNS hostnames"},
            "enable_dns_support": {"type": "bool", "default": True, "required": False, "description": "DNS support"},
        },
    },
    "compute": {
        "label": "Compute / Servers",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "instance_type": {"type": "str", "default": "t3.medium", "required": True, "description": "Instance type"},
            "instance_count": {"type": "int", "default": 1, "required": True, "description": "Instance count"},
            "os_image": {"type": "str", "default": "ubuntu-22.04", "required": True, "description": "OS image"},
            "storage_size": {"type": "int", "default": 30, "required": True, "description": "Storage (GB)"},
            "key_pair_name": {"type": "str", "default": None, "required": False, "description": "SSH key"},
        },
    },
    "serverless": {
        "label": "Serverless / Lambda",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "runtime": {"type": "str", "default": "python3.12", "required": True, "description": "Runtime"},
            "memory_size": {"type": "int", "default": 256, "required": True, "description": "Memory (MB)"},
            "timeout": {"type": "int", "default": 30, "required": True, "description": "Timeout"},
            "handler": {"type": "str", "default": "lambda_function.handler", "required": True, "description": "Handler"},
            "description": {"type": "str", "default": None, "required": False, "description": "Description"},
        },
    },
    "database": {
        "label": "Database / Managed",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "RDS", "required": True, "description": "Service type"},
            "instance_class": {"type": "str", "default": "db.t3.micro", "required": True, "description": "Instance class"},
            "storage_size": {"type": "int", "default": 20, "required": True, "description": "Storage (GB)"},
            "service_name": {"type": "str", "default": None, "required": False, "description": "DB name"},
        },
    },
}

TOP_LEVEL_DEFAULTS = {
    "provider": "aws",
    "region": "us-east-1",
    "env": "dev",
}

# ═══════════════════════════════════════════════════════════════════════
#  DEPENDENCY SUGGESTIONS
# ═══════════════════════════════════════════════════════════════════════

DEPENDENCY_SUGGESTIONS = {
    "compute": {
        "suggestion": "Do you want a dedicated VPC or use default VPC?",
        "depends_on_type": "network",
    },
    "serverless": {
        "suggestion": "Should Lambda run inside a VPC or not?",
        "depends_on_type": "network",
    },
    "database": {
        "suggestion": "Place DB in private subnet or default VPC?",
        "depends_on_type": "network",
    },
}

# ═══════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════

def build_system_prompt(project_name: str, project_id: str, existing_resources: list | None = None, project_info: dict | None = None) -> str:
    """Build optimized system prompt."""

    existing_str = "None."
    if existing_resources:
        lines = []
        for r in existing_resources:
            cfg = r.get("config", {})
            cfg_str = ", ".join(f"{k}={v}" for k, v in cfg.items()) if cfg else ""
            lines.append(
                f"{r.get('id','?')} [{r.get('type','?')}] {r.get('name','?')} "
                f"env={r.get('env','?')} state={r.get('state','?')} {cfg_str}"
            )
        existing_str = "\n".join(lines)

    # ── Inject Project Metadata Context ──
    project_context = ""
    env_rule = "- Ask environment early (dev/staging/prod)"
    load_rule = "- Gather load before sizing decisions"
    env_top_level = "- env MUST be asked"

    if project_info:
        domain = project_info.get("domain", "general")
        env = project_info.get("environment", "development")
        traffic = project_info.get("expectedTraffic", "unknown")
        cost_pref = project_info.get("costPreference", "balanced")
        desc = project_info.get("description", "")
        
        if env and env != "unknown":
            env_rule = f"- Use environment '{env}' automatically (DO NOT ask user)"
            env_top_level = f"- env={env}"
            
        if traffic and traffic != "unknown":
            load_rule = f"- Use expected traffic '{traffic}' for sizing decisions (DO NOT ask user)"
        
        project_context = f"""
PROJECT METADATA AND CONTEXT:
- Domain / Type: {domain}
- Primary Environment: {env}
- Expected Traffic Load: {traffic}
- Cost Preference: {cost_pref}
- Description: {desc}

You MUST align your infrastructure decisions with these project settings. For example, if cost preference is "cost-optimised", prefer smaller instances or serverless. If traffic is "high", ensure scalability and load balancing are suggested.
"""

    field_ref = "\n".join(
        f"{rtype}: " + ", ".join(
            f"{fname}={'(req)' if fmeta['default'] is None else fmeta['default']}"
            for fname, fmeta in schema["config_fields"].items()
        )
        for rtype, schema in RESOURCE_FIELD_SCHEMAS.items()
    )

    return f"""
You are InfraX Copilot — an AWS infrastructure architect for project "{project_name}" (ID: {project_id}).
{project_context}
EXISTING RESOURCES:
{existing_str}

CORE RULES:
- One question per response
- Max 2–3 sentences
- Stay within project scope
- Do NOT expose full resource IDs (only first 8 chars)

TEXT FORMATTING:
- DO NOT wrap your conversational response, summaries, or server details in Markdown code blocks (```).
- ONLY use Markdown code blocks for literal Infrastructure as Code (IaC) snippets (e.g. Terraform, JSON).
- Use standard Markdown (e.g. **bolding**, lists) for server details and specifications.

RESOURCE LOGIC:
- If resource exists → ask update or create new
- Use update_infra for updates
- Support multi-resource workflow
- Show summary before provisioning

MANDATORY FLOW:
{env_rule}
{load_rule}

LOAD & SIZING:
- Classify workload dynamically (low/medium/high)
- DO NOT use fixed instance types or hardcoded values
- Suggest based on:
  - workload type
  - expected traffic
  - cost vs performance
  - scalability

- Provide:
  1. Instance type (dynamic)
  2. Instance count range
  3. Short reasoning

OPTIMIZATION GOAL:
- Prefer cost-efficient scalable setups
- Avoid over/under provisioning

NETWORK RULE:
- Ask VPC requirement for compute/database

━━━━━━━━━━━━━━━━━━━
EXTRACTION FORMAT
━━━━━━━━━━━━━━━━━━━
<<<EXTRACT>>>
{{"intent":"create_infra|update_infra|confirm|edit|cancel|general",
"resource_type":"network|compute|serverless|database|null",
"existing_resource_id":"id_or_null",
"fields":{{"field":"value"}}}}
<<<END_EXTRACT>>>

━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━
- intent REQUIRED
- fields = only current user input
- convert types (bool/int/env)
- multi-resource supported

━━━━━━━━━━━━━━━━━━━
CONFIG FIELDS
━━━━━━━━━━━━━━━━━━━
{field_ref}

Top-level:
- provider=aws
- region=us-east-1
{env_top_level}

━━━━━━━━━━━━━━━━━━━
ACTIONS
━━━━━━━━━━━━━━━━━━━
CONFIRM → ask "Provision? (yes/edit/cancel)" → {{"intent":"confirm"}}
CANCEL → {{"intent":"cancel"}}
"""