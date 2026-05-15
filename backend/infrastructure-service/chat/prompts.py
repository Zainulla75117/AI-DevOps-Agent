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
            # ── IaC-critical fields ──
            "internet_gateway": {"type": "bool", "default": True, "required": False, "description": "Create Internet Gateway"},
            "public_subnet_cidrs": {"type": "list", "default": None, "required": False, "description": "Public subnet CIDR blocks (auto-calculated if empty)"},
            "private_subnet_cidrs": {"type": "list", "default": None, "required": False, "description": "Private subnet CIDR blocks (auto-calculated if empty)"},
            "enable_flow_logs": {"type": "bool", "default": False, "required": False, "description": "Enable VPC Flow Logs"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
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
            # ── IaC-critical fields ──
            "ami_id": {"type": "str", "default": None, "required": False, "description": "Specific AMI ID (resolved from os_image)"},
            "subnet_placement": {"type": "str", "default": "private", "required": False, "description": "Subnet placement (public/private)"},
            "security_group_rules": {"type": "list", "default": None, "required": False, "description": "Security group rules [{port, protocol, cidr}]"},
            "iam_instance_profile": {"type": "str", "default": None, "required": False, "description": "IAM instance profile name"},
            "ebs_volume_type": {"type": "str", "default": "gp3", "required": False, "description": "EBS volume type (gp3/gp2/io1/io2)"},
            "ebs_iops": {"type": "int", "default": None, "required": False, "description": "Provisioned IOPS (io1/io2 only)"},
            "user_data_script": {"type": "str", "default": None, "required": False, "description": "EC2 user data / startup script"},
            "associate_public_ip": {"type": "bool", "default": False, "required": False, "description": "Associate public IP"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
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
            # ── IaC-critical fields ──
            "iam_role_name": {"type": "str", "default": None, "required": False, "description": "IAM execution role name"},
            "environment_variables": {"type": "dict", "default": None, "required": False, "description": "Lambda environment variables"},
            "vpc_config": {"type": "dict", "default": None, "required": False, "description": "VPC config {subnet_ids, security_group_ids}"},
            "layers": {"type": "list", "default": None, "required": False, "description": "Lambda layer ARNs"},
            "triggers": {"type": "list", "default": None, "required": False, "description": "Event triggers [{type, config}]"},
            "reserved_concurrency": {"type": "int", "default": None, "required": False, "description": "Reserved concurrent executions"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "database": {
        "label": "Database / Managed",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "RDS", "required": True, "description": "Service type (RDS/DynamoDB/Aurora)"},
            "instance_class": {"type": "str", "default": "db.t3.micro", "required": True, "description": "Instance class"},
            "storage_size": {"type": "int", "default": 20, "required": True, "description": "Storage (GB)"},
            "service_name": {"type": "str", "default": None, "required": False, "description": "DB name"},
            # ── IaC-critical fields ──
            "engine": {"type": "str", "default": "postgres", "required": False, "description": "DB engine (postgres/mysql/mariadb/aurora-postgresql)"},
            "engine_version": {"type": "str", "default": None, "required": False, "description": "Engine version (e.g. 16.4)"},
            "multi_az": {"type": "bool", "default": False, "required": False, "description": "Multi-AZ deployment"},
            "backup_retention_days": {"type": "int", "default": 7, "required": False, "description": "Backup retention (days)"},
            "db_subnet_group": {"type": "str", "default": None, "required": False, "description": "DB subnet group name"},
            "security_group_rules": {"type": "list", "default": None, "required": False, "description": "Security group rules [{port, protocol, cidr}]"},
            "storage_type": {"type": "str", "default": "gp3", "required": False, "description": "Storage type (gp3/io1)"},
            "publicly_accessible": {"type": "bool", "default": False, "required": False, "description": "Publicly accessible"},
            "master_username": {"type": "str", "default": "admin", "required": False, "description": "Master DB username"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "storage": {
        "label": "Storage / S3",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "bucket_name": {"type": "str", "default": None, "required": True, "description": "S3 bucket name"},
            "versioning": {"type": "bool", "default": False, "required": True, "description": "Enable versioning"},
            "access": {"type": "str", "default": "private", "required": True, "description": "Access level (private/public-read)"},
            "encryption": {"type": "str", "default": "AES256", "required": True, "description": "Encryption (AES256/aws:kms)"},
            "lifecycle_days": {"type": "int", "default": None, "required": False, "description": "Object expiry (days)"},
            # ── IaC-critical fields ──
            "cors_rules": {"type": "list", "default": None, "required": False, "description": "CORS configuration rules"},
            "logging_target_bucket": {"type": "str", "default": None, "required": False, "description": "Access log target bucket"},
            "replication": {"type": "bool", "default": False, "required": False, "description": "Enable cross-region replication"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "apigateway": {
        "label": "API Gateway",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "api_type": {"type": "str", "default": "HTTP", "required": True, "description": "API type (HTTP/REST/WebSocket)"},
            "protocol": {"type": "str", "default": "HTTPS", "required": True, "description": "Protocol (HTTPS/HTTP)"},
            "auth_type": {"type": "str", "default": "None", "required": True, "description": "Auth type (None/JWT/IAM/Cognito)"},
            "cors_enabled": {"type": "bool", "default": True, "required": False, "description": "Enable CORS"},
            "stages": {"type": "list", "default": ["dev"], "required": False, "description": "Deployment stages"},
            "custom_domain_name": {"type": "str", "default": None, "required": False, "description": "Custom domain name"},
            "vpc_link_enabled": {"type": "bool", "default": False, "required": False, "description": "Enable VPC Link for private integration"},
            "throttling_rate_limit": {"type": "int", "default": None, "required": False, "description": "Throttling rate limit"},
            "throttling_burst_limit": {"type": "int", "default": None, "required": False, "description": "Throttling burst limit"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "cache": {
        "label": "Cache / ElastiCache",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "engine": {"type": "str", "default": "redis", "required": True, "description": "Cache engine (redis/memcached)"},
            "node_type": {"type": "str", "default": "cache.t3.micro", "required": True, "description": "Node instance type"},
            "num_nodes": {"type": "int", "default": 1, "required": True, "description": "Number of cache nodes"},
            "engine_version": {"type": "str", "default": None, "required": False, "description": "Engine version"},
            "port": {"type": "int", "default": 6379, "required": False, "description": "Cache port"},
            "subnet_group_name": {"type": "str", "default": None, "required": False, "description": "Cache subnet group name"},
            "security_group_rules": {"type": "list", "default": None, "required": False, "description": "Security group rules"},
            "multi_az_enabled": {"type": "bool", "default": False, "required": False, "description": "Enable Multi-AZ"},
            "auth_token_enabled": {"type": "bool", "default": False, "required": False, "description": "Require auth token (Redis AUTH)"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "container": {
        "label": "Container / ECS / EKS",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "orchestrator": {"type": "str", "default": "ECS-Fargate", "required": True, "description": "Orchestrator (ECS-Fargate/EKS)"},
            "cluster_name": {"type": "str", "default": None, "required": False, "description": "Cluster name"},
            "task_cpu": {"type": "int", "default": 256, "required": True, "description": "Task CPU units"},
            "task_memory": {"type": "int", "default": 512, "required": True, "description": "Task memory (MB)"},
            "desired_count": {"type": "int", "default": 1, "required": True, "description": "Desired container count"},
            "vpc_subnets": {"type": "list", "default": None, "required": False, "description": "VPC Subnets to launch in"},
            "security_group_rules": {"type": "list", "default": None, "required": False, "description": "Security group rules"},
            "container_image": {"type": "str", "default": None, "required": False, "description": "Container image URI"},
            "container_port": {"type": "int", "default": 80, "required": False, "description": "Container port"},
            "iam_execution_role": {"type": "str", "default": None, "required": False, "description": "IAM execution role name/ARN"},
            "iam_task_role": {"type": "str", "default": None, "required": False, "description": "IAM task role name/ARN"},
            "load_balancer_arn": {"type": "str", "default": None, "required": False, "description": "Target group / Load balancer ARN"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "queue": {
        "label": "Message Queue / PubSub",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "SQS", "required": True, "description": "Service type (SQS/SNS)"},
            "queue_name": {"type": "str", "default": None, "required": True, "description": "Queue/Topic name"},
            "fifo_queue": {"type": "bool", "default": False, "required": True, "description": "Is FIFO queue/topic?"},
            "visibility_timeout": {"type": "int", "default": 30, "required": False, "description": "Visibility timeout (seconds)"},
            "message_retention_seconds": {"type": "int", "default": 345600, "required": False, "description": "Message retention (seconds)"},
            "delay_seconds": {"type": "int", "default": 0, "required": False, "description": "Delivery delay (seconds)"},
            "dead_letter_queue_arn": {"type": "str", "default": None, "required": False, "description": "Dead letter queue ARN"},
            "max_receive_count": {"type": "int", "default": 3, "required": False, "description": "Max receive count before DLQ"},
            "kms_master_key_id": {"type": "str", "default": None, "required": False, "description": "KMS key for encryption"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "cdn": {
        "label": "CDN / CloudFront",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "distribution_name": {"type": "str", "default": None, "required": True, "description": "Distribution name"},
            "origin_type": {"type": "str", "default": "S3", "required": True, "description": "Origin type (S3/Custom)"},
            "origin_domain": {"type": "str", "default": None, "required": True, "description": "Origin domain name"},
            "aliases": {"type": "list", "default": None, "required": False, "description": "Custom domain aliases"},
            "acm_certificate_arn": {"type": "str", "default": None, "required": False, "description": "ACM certificate ARN for HTTPS"},
            "price_class": {"type": "str", "default": "PriceClass_100", "required": False, "description": "Price class"},
            "waf_web_acl_id": {"type": "str", "default": None, "required": False, "description": "WAF Web ACL ID"},
            "viewer_protocol_policy": {"type": "str", "default": "redirect-to-https", "required": False, "description": "Viewer protocol policy"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "security": {
        "label": "Security",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "GuardDuty", "required": True, "description": "Service type (GuardDuty/WAF/SecurityHub)"},
            "enable_guardduty": {"type": "bool", "default": True, "required": True, "description": "Enable GuardDuty detector"},
            "finding_publishing_frequency": {"type": "str", "default": "FIFTEEN_MINUTES", "required": False, "description": "Finding publishing frequency"},
            "s3_protection_enabled": {"type": "bool", "default": True, "required": False, "description": "Enable S3 protection"},
            "eks_protection_enabled": {"type": "bool", "default": False, "required": False, "description": "Enable EKS protection"},
            "malware_protection_enabled": {"type": "bool", "default": False, "required": False, "description": "Enable malware protection"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "secrets": {
        "label": "Secrets Management",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "SecretsManager", "required": True, "description": "Service type (SecretsManager/ParameterStore)"},
            "secret_name": {"type": "str", "default": None, "required": True, "description": "Secret name / path"},
            "description": {"type": "str", "default": None, "required": False, "description": "Secret description"},
            "kms_key_id": {"type": "str", "default": None, "required": False, "description": "KMS key ID for encryption"},
            "rotation_lambda_arn": {"type": "str", "default": None, "required": False, "description": "Rotation Lambda ARN"},
            "rotation_rules_days": {"type": "int", "default": None, "required": False, "description": "Automatic rotation frequency in days"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "monitoring": {
        "label": "Monitoring / Observability",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "service_type": {"type": "str", "default": "CloudWatch", "required": True, "description": "Service type (CloudWatch/X-Ray)"},
            "log_group_name": {"type": "str", "default": None, "required": True, "description": "Log group name"},
            "retention_in_days": {"type": "int", "default": 30, "required": False, "description": "Log retention in days"},
            "kms_key_id": {"type": "str", "default": None, "required": False, "description": "KMS key ID for log encryption"},
            "alarm_definitions": {"type": "list", "default": None, "required": False, "description": "Alarm definitions [{metric, threshold, topic}]"},
            "dashboard_body": {"type": "str", "default": None, "required": False, "description": "Dashboard JSON body"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
        },
    },
    "events": {
        "label": "Events / EventBridge",
        "top_level": ["name", "provider", "region", "env"],
        "config_fields": {
            "bus_name": {"type": "str", "default": "default", "required": True, "description": "Event bus name"},
            "rule_name": {"type": "str", "default": None, "required": True, "description": "Event rule name"},
            "schedule_expression": {"type": "str", "default": None, "required": False, "description": "Schedule expression (e.g. rate(5 minutes))"},
            "event_pattern": {"type": "dict", "default": None, "required": False, "description": "Event pattern JSON dict"},
            "targets": {"type": "list", "default": None, "required": False, "description": "List of target ARNs"},
            "role_arn": {"type": "str", "default": None, "required": False, "description": "IAM role ARN for cross-account or specific targets"},
            "tags": {"type": "dict", "default": None, "required": False, "description": "Resource tags"},
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
    "storage": {
        "suggestion": "Should the bucket be accessed only from within a VPC?",
        "depends_on_type": "network",
    },
    "apigateway": {
        "suggestion": "Will this API Gateway route to a Lambda function or an ECS container?",
        "depends_on_type": ["serverless", "container"],
    },
    "cache": {
        "suggestion": "Place Cache in private subnet or default VPC?",
        "depends_on_type": "network",
    },
    "container": {
        "suggestion": "Do you want a dedicated VPC or use default VPC?",
        "depends_on_type": "network",
    },
    "queue": {
        "suggestion": "Will a Lambda function or ECS task consume this queue?",
        "depends_on_type": ["serverless", "container"],
    },
    "cdn": {
        "suggestion": "Will this CloudFront distribution sit in front of an S3 bucket or an API Gateway?",
        "depends_on_type": ["storage", "apigateway"],
    },
    "security": {
        "suggestion": "Do you want to enable GuardDuty for an existing VPC or EKS cluster?",
        "depends_on_type": ["network", "container"],
    },
    "secrets": {
        "suggestion": "Will an existing database need these secrets?",
        "depends_on_type": "database",
    },
    "monitoring": {
        "suggestion": "Which resources will this CloudWatch dashboard monitor?",
        "depends_on_type": ["compute", "container", "database", "serverless"],
    },
    "events": {
        "suggestion": "What target should this EventBridge rule trigger (e.g., Lambda or SQS)?",
        "depends_on_type": ["serverless", "queue"],
    },
}

# ═══════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════════════

def build_system_prompt(
    project_name: str, 
    project_id: str, 
    existing_resources: list | None = None, 
    project_info: dict | None = None,
    repo_tree: dict | None = None,
    provisioning_context: dict | None = None,
    is_init_scan: bool = False,
    pg_summary: dict | None = None,
    conversation_summary: dict | None = None,
    project_memories: list | None = None,
    repo_scan_memory: dict | None = None,
) -> str:
    """Build optimized system prompt with optional PostgreSQL summary context."""

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
        traffic = project_info.get("expectedTraffic") or project_info.get("expected_traffic", "unknown")
        cost_pref = project_info.get("costPreference") or project_info.get("cost_preference", "balanced")
        desc = project_info.get("description", "")
        platform = project_info.get("platform", "unknown")
        cloud_provider = project_info.get("cloud_provider", "aws")
        region = project_info.get("region", "us-east-1")
        iam_name = project_info.get("iam_name", "unknown")
        
        if env and env != "unknown":
            env_rule = f"- Use environment '{env}' automatically (DO NOT ask user)"
            env_top_level = f"- env={env}"
            
        if traffic and traffic != "unknown":
            load_rule = f"- Use expected traffic '{traffic}' for sizing decisions (DO NOT ask user)"
        
        repo_context = ""
    if repo_tree and isinstance(repo_tree, dict):
        tree_files = repo_tree.get("tree", [])
        deps_files = repo_tree.get("dependency_files", {})
        
        # Limit tree to avoid huge token usage
        if len(tree_files) > 1000:
            tree_files = tree_files[:1000] + ["... (truncated) ..."]
            
        repo_context = f"""
REPOSITORY CONTEXT:
The user has linked a code repository. Here is the file tree of the repository:
{chr(10).join(tree_files)}

"""
        if deps_files:
            repo_context += "Key Dependency Files:\n"
            for fname, content in deps_files.items():
                content_preview = content[:2000] + ("..." if len(content) > 2000 else "")
                repo_context += f"--- {fname} ---\n{content_preview}\n\n"

    provisioning_context_str = ""
    if provisioning_context and provisioning_context.get("resources"):
        import json
        resources_json = json.dumps(provisioning_context["resources"], indent=2)
        provisioning_context_str = f"""
CONFIRMED PROVISIONING CONTEXT:
The user has previously confirmed the following infrastructure layout for provisioning:
```json
{resources_json}
```
You should use this context to understand what has been finalized.
"""

    init_scan_instruction = ""
    if is_init_scan:
        init_scan_instruction = f"""
[INIT_REPO_SCAN TRIGGERED]
You have just received the repository context. This is the FIRST message of the session.

Your task is to generate a STRUCTURED INFRASTRUCTURE PLAN. Analyze:
1. The REPOSITORY CONTEXT (file tree + dependency files)
2. The PROJECT METADATA (domain, traffic, cost preference, environment)
3. Any INFRASTRUCTURE HISTORY from previous sessions
4. Any CONFIRMED PROVISIONING CONTEXT

Output your plan in this EXACT format:

## \U0001f4cb Infrastructure Plan for {project_name}

**Application Profile**: [What the app is, based on repo analysis]

### Recommended Resources:

| # | Resource | Type | Key Config | Rationale |
|---|----------|------|------------|-----------|
| 1 | ... | compute/network/storage/etc | ... | ... |
| 2 | ... | ... | ... | ... |

### Architecture Notes:
- [Key design decisions: VPC layout, subnet strategy, etc.]
- [Cost considerations based on project's cost preference]

### Estimated Monthly Cost: $XX - $YY

---
*Would you like to proceed with this plan, or would you like to modify anything?*

RULES:
- Base ALL recommendations STRICTLY on the actual repo code and project metadata. Do NOT make assumptions.
- ONLY suggest AWS services that are explicitly required to run the application based on the codebase.
- DO NOT suggest unnecessary services (e.g., do not add CloudFront unless explicitly asked or serving a static site; do not add ElastiCache unless the code references a cache).
- Respect the project's cost_preference and expected_traffic.
- If the repo has a Dockerfile, suggest container-based deployment.
- If the repo has serverless config, suggest Lambda.
- Always include networking (VPC) if compute/database is needed.
- Keep the plan concise — max 4-6 necessary resources.
- If INFRASTRUCTURE HISTORY exists, acknowledge previous decisions and only suggest changes/additions.
"""

    # ── Inject PostgreSQL infrastructure history ──
    pg_summary_str = ""
    if pg_summary:
        import json as _json
        decisions_str = "None recorded."
        if pg_summary.get("decisions"):
            decisions_list = pg_summary["decisions"]
            if isinstance(decisions_list, str):
                decisions_list = _json.loads(decisions_list)
            if decisions_list:
                decisions_str = "\n".join(f"  - {d}" for d in decisions_list)
        
        pg_summary_str = f"""
INFRASTRUCTURE HISTORY (from previous sessions, version {pg_summary.get('version', '?')}):
{pg_summary.get('llm_summary', 'No previous summary available.')}

Previous Decisions:
{decisions_str}

You MUST reference this history when making new recommendations.
Do NOT re-suggest resources that were already created unless the user asks for changes.
"""

    project_context = f"""
PROJECT METADATA AND CONTEXT:
- Domain / Type: {domain}
- Platform: {platform}
- Cloud Provider: {cloud_provider}
- Region: {region}
- IAM Target: {iam_name}
- Primary Environment: {env}
- Expected Traffic Load: {traffic}
- Cost Preference: {cost_pref}
- Description: {desc}

You MUST align your infrastructure decisions with these project settings. For example, if cost preference is "cost-optimised", prefer smaller instances or serverless. If traffic is "high", ensure scalability and load balancing are suggested. Always suggest resources for the specified Cloud Provider ({cloud_provider}) in the specified Region ({region}).
"""

    field_ref = "\n".join(
        f"{rtype}: " + ", ".join(
            f"{fname}={'(req)' if fmeta['default'] is None else fmeta['default']}"
            for fname, fmeta in schema["config_fields"].items()
        )
        for rtype, schema in RESOURCE_FIELD_SCHEMAS.items()
    )

    # ── Inject Conversation Summary (rolling) ──
    conv_summary_str = ""
    if conversation_summary:
        conv_summary_str = f"""
CONVERSATION SUMMARY (from earlier in this session):
{conversation_summary.get('summary_text', 'No summary yet.')}

Use this context to maintain continuity. Do not repeat information already discussed.
"""

    # ── Inject Project Memory (cross-session) ──
    project_memory_str = ""
    if project_memories:
        memory_entries = []
        for mem in (project_memories or []):
            mtype = mem.get('memory_type', 'unknown')
            if mtype in ('infra_state', 'pruned_conversation', 'deleted_conversation'):
                memory_entries.append(f"  [{mtype}]: {mem.get('content', '')[:500]}")
        if memory_entries:
            project_memory_str = (
                "\nPROJECT MEMORY (knowledge from previous sessions):\n"
                + "\n".join(memory_entries)
                + "\n\nUse this memory to understand the project's history and avoid redundant questions.\n"
            )

    # ── Inject persisted repo scan summary (reused across chats) ──
    repo_scan_str = ""
    if repo_scan_memory and not repo_tree:
        repo_scan_str = f"""
PERSISTED REPOSITORY ANALYSIS (from a previous session's scan):
{repo_scan_memory.get('content', '')[:3000]}

This is a previously generated analysis of the project's codebase. Use it as context.
"""

    return f"""
You are InfraX Copilot — an AWS infrastructure architect for project "{project_name}" (ID: {project_id}).
{project_context}
{repo_context}
{repo_scan_str}
{provisioning_context_str}
{pg_summary_str}
{conv_summary_str}
{project_memory_str}
{init_scan_instruction}
EXISTING RESOURCES:
{existing_str}

CRITICAL INSTRUCTION: Analyze the EXISTING RESOURCES above. If a resource (like a VPC or an EC2 instance) already exists, you MUST acknowledge it and suggest complementary resources (like an RDS database or Load Balancer) rather than offering to create a duplicate.
CORE RULES:
- One question per response
- Max 2–3 sentences
- Stay within project scope
- ONLY suggest strictly necessary AWS services based on the codebase. Avoid unnecessary complexity.
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
{{
  "intent": "create_infra|update_infra|confirm|edit|cancel|general",
  "resource_type": "network|compute|serverless|database|storage|apigateway|cache|container|queue|cdn|security|secrets|monitoring|events|null",
  "existing_resource_id": "id_or_null",
  "fields": {{"field": "value"}},
  "iac_context": {{
    "terraform_resource": "aws_instance",
    "rationale": "Why this configuration was chosen",
    "security_notes": "Security group rules, IAM policies, etc.",
    "cost_estimate": "Estimated cost"
  }}
}}
<<<END_EXTRACT>>>

━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━
- intent REQUIRED
- fields = only current user input
- iac_context = ONLY output this when intent is 'confirm' or 'update_infra'. Populate with rich IaC reasoning.
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