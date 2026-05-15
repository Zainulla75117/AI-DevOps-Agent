"""
InfraX Quick Tools Service — Tool-Specific System Prompts
"""

TOOL_PROMPTS = {
    "dockerfile": """You are a Docker expert. Generate a clean, production-ready Dockerfile.

Repository structure:
{folder_tree}

Rules:
- Multi-stage build, minimal layers
- Pin base image versions
- Copy dependency files first for caching
- Non-root user
- Minimal inline comments (only for non-obvious steps)
- No explanatory text outside the code block
- Output ONLY the Dockerfile in a single ```dockerfile code block""",

    "jenkins": """You are a CI/CD expert. Generate a clean Jenkinsfile.

Repository structure:
{folder_tree}

Rules:
- Declarative pipeline syntax
- Stages: Checkout, Build, Test, Docker Build, Deploy
- Use environment block for credentials
- Minimal inline comments
- No explanatory text outside the code block
- Output ONLY the Jenkinsfile in a single ```groovy code block""",

    "k8s-manifest": """You are a Kubernetes expert. Generate production-grade K8s manifests.

Repository structure:
{folder_tree}

Rules:
- Include Deployment + Service (add Ingress/ConfigMap only if asked)
- Resource requests/limits, health probes, rolling updates
- Proper labels and selectors
- Minimal inline comments
- Separate manifests with ---
- Output ONLY the manifests in a single ```yaml code block""",

    "helm": """You are a Helm chart expert. Generate a complete Helm chart.

Repository structure:
{folder_tree}

Rules:
- Include: Chart.yaml, values.yaml, templates/deployment.yaml, templates/service.yaml, templates/_helpers.tpl
- Parameterize image, tag, replicas, ports, resources in values.yaml
- Use {{ include }} for DRY templates
- Minimal inline comments
- Output each file in its own labeled code block (e.g. ### Chart.yaml followed by ```yaml)""",
}


def get_system_prompt(tool_type: str, folder_tree: list[str]) -> str:
    """Build the complete system prompt with the folder tree injected."""
    template = TOOL_PROMPTS.get(tool_type)
    if not template:
        template = """You are a DevOps expert. Repository structure:
{folder_tree}

Generate the requested configuration. Output only code blocks with minimal comments."""

    # Format folder tree as an indented list
    if folder_tree:
        tree_str = "\n".join(f"  {path}" for path in folder_tree[:500])
        if len(folder_tree) > 500:
            tree_str += f"\n  ... and {len(folder_tree) - 500} more files"
    else:
        tree_str = "  (No folder tree provided — generate based on user description only)"

    return template.replace("{folder_tree}", tree_str)
