"""
System prompts, field schemas, and dependency suggestion rules
for the infrastructure chat LangGraph workflow.
"""

# ═══════════════════════════════════════════════════════════════════════
#  FIELD SCHEMAS — what the LLM must collect for each resource type
# ═══════════════════════════════════════════════════════════════════════

RESOURCE_FIELD_SCHEMAS = {
    "network": {
        "label": "Network / VPC",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "vpc_name":                 {"type": "str",  "default": None,   "required": True,  "description": "VPC name"},
            "vpc_cidr":                 {"type": "str",  "default": "10.0.0.0/16", "required": True,  "description": "VPC CIDR block (e.g. 10.0.0.0/16)"},
            "nat_gateway":              {"type": "str",  "default": "yes",  "required": True,  "description": "Enable NAT Gateway (yes/no)"},
            "public_subnet_count":      {"type": "int",  "default": 2,      "required": True,  "description": "Number of public subnets"},
            "private_subnet_count":     {"type": "int",  "default": 2,      "required": True,  "description": "Number of private subnets"},
            "availability_zones_count": {"type": "int",  "default": 2,      "required": True,  "description": "Number of availability zones"},
            "enable_dns_hostnames":     {"type": "bool", "default": True,   "required": False, "description": "Enable DNS hostnames"},
            "enable_dns_support":       {"type": "bool", "default": True,   "required": False, "description": "Enable DNS support"},
        },
    },
    "compute": {
        "label": "Compute / Servers",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "instance_type":  {"type": "str", "default": "t3.medium", "required": True, "description": "EC2 instance type (e.g. t3.medium, t3.large)"},
            "instance_count": {"type": "int", "default": 1,           "required": True, "description": "Number of instances"},
            "os_image":       {"type": "str", "default": "ubuntu-22.04", "required": True, "description": "OS image (e.g. ubuntu-22.04, amazon-linux-2)"},
            "storage_size":   {"type": "int", "default": 30,          "required": True, "description": "Storage size in GB"},
            "key_pair_name":  {"type": "str", "default": None,        "required": False, "description": "SSH key pair name"},
        },
    },
    "serverless": {
        "label": "Serverless / Lambda",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "runtime":     {"type": "str", "default": "python3.12", "required": True, "description": "Runtime (e.g. python3.12, nodejs20.x)"},
            "memory_size": {"type": "int", "default": 256,          "required": True, "description": "Memory size in MB"},
            "timeout":     {"type": "int", "default": 30,           "required": True, "description": "Timeout in seconds"},
            "handler":     {"type": "str", "default": "lambda_function.handler", "required": True, "description": "Function handler path"},
            "description": {"type": "str", "default": None,         "required": False, "description": "Function description"},
        },
    },
    "database": {
        "label": "Database / Cloud Managed",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type":   {"type": "str", "default": "RDS",          "required": True, "description": "Service type (RDS, DynamoDB, ElastiCache, etc.)"},
            "instance_class": {"type": "str", "default": "db.t3.micro",  "required": True, "description": "Instance class (e.g. db.t3.micro)"},
            "storage_size":   {"type": "int", "default": 20,             "required": True, "description": "Storage size in GB"},
            "service_name":   {"type": "str", "default": None,           "required": False, "description": "Custom service/database name"},
        },
    },
}


# Default values for top-level resource fields
TOP_LEVEL_DEFAULTS = {
    "provider": "aws",
    "region":   "us-east-1",
    "env":      "dev",
}


# ═══════════════════════════════════════════════════════════════════════
#  DEPENDENCY SUGGESTIONS
#  When user creates a resource, the AI may suggest related resources
# ═══════════════════════════════════════════════════════════════════════

DEPENDENCY_SUGGESTIONS = {
    "compute": {
        "suggestion": "Do you want me to create a dedicated VPC for these servers, or should they use the default VPC?",
        "depends_on_type": "network",
    },
    "serverless": {
        "suggestion": "Should I set up a VPC for your Lambda functions (for private resource access), or will they run without VPC?",
        "depends_on_type": "network",
    },
    "database": {
        "suggestion": "Do you want this database inside a private subnet with its own VPC, or use an existing / default VPC?",
        "depends_on_type": "network",
    },
}


# ═══════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════

def build_system_prompt(project_name: str, project_id: str, existing_resources: list | None = None) -> str:
    """Build the system prompt with project context injected."""
    existing_str = "None."
    if existing_resources:
        lines = []
        for r in existing_resources:
            cfg = r.get('config', {})
            cfg_str = ', '.join(f'{k}={v}' for k, v in cfg.items()) if cfg else ''
            lines.append(f"  {r.get('id','?')} [{r.get('type','?')}] {r.get('name','?')} env={r.get('env','?')} state={r.get('state','?')} {cfg_str}")
        existing_str = "\n".join(lines)

    # Build compact field reference
    field_ref_lines = []
    for rtype, schema in RESOURCE_FIELD_SCHEMAS.items():
        fields = []
        for fname, fmeta in schema["config_fields"].items():
            d = fmeta["default"]
            fields.append(f"{fname}={'(req)' if d is None else d}")
        field_ref_lines.append(f"{rtype}: {', '.join(fields)}")
    field_ref = "\n".join(field_ref_lines)

    return f"""You are InfraX Copilot, an AWS infrastructure architect for project "{project_name}" (ID: {project_id}).

EXISTING RESOURCES:
{existing_str}

RULES:
- Scoped to this project only. One question at a time. 2-3 sentences max.
- If existing resource of same type exists, ask: update it or create new? Use update_infra intent for updates.
- ALWAYS ask environment (dev/staging/prod) first, then expected load for compute/database.
- Load sizing: low(<100 users)→t3.small,1-2inst | med(~1K)→t3.large,2-3inst | high(10K+)→c5.xlarge,3+inst
- For compute/database ask about VPC. Support multi-resource per session. Show summary table before saving.
- IMPORTANT: DO NOT return the entire ID to the client in visible text. Just send the initials (first 8 characters) only.

EXTRACTION FORMAT (every response MUST include this hidden block):
<<<EXTRACT>>>
{{"intent":"create_infra|update_infra|confirm|edit|cancel|general","resource_type":"network|compute|serverless|database|null","existing_resource_id":"id_or_null","fields":{{"field":"value"}}}}
<<<END_EXTRACT>>>
Your visible response here...

EXTRACTION RULES:
- intent: required. confirm=user approves, cancel=user cancels, edit=user changes field
- existing_resource_id: set to resource ID from existing list for updates, null for new
- fields: only values user explicitly stated this turn. Convert yes/no→bool, numbers→int, env keywords→env field
- MULTI-RESOURCE: To add a new resource type (e.g., adding a VPC alongside servers), change "resource_type" to the new type (e.g., "network"). The backend auto-queues the previous resource.
- On confirm with collected fields, finalize pending resources

CONFIG FIELDS:
{field_ref}
Top-level: name, provider(aws), region(us-east-1), env(MUST ASK)

CONFIRM: Show table of pending resources, ask "Provision? (yes/edit/cancel)". On yes: {{"intent":"confirm"}}
CANCEL: {{"intent":"cancel"}} — clear all pending.
"""


