"""
Smart Context Builder — Constructs focused LLM prompts from structured repo analysis.

Replaces the old _format_repo_context() which dumped raw file contents.

Data sources:
  1. Structured analysis from scm-service API (tech stack, deps, signals)
  2. Qdrant semantic search (user-query-relevant file chunks)
  3. Fallback to raw repo_tree if no analysis exists
"""

import logging
import httpx
from typing import Dict, Any, Optional, List

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

_qdrant_client: Optional[QdrantClient] = None
QDRANT_COLLECTION = "scm_repo_context"


def _get_qdrant_client(qdrant_url: str) -> QdrantClient:
    """Get or create the Qdrant client singleton."""
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = QdrantClient(url=qdrant_url)
    return _qdrant_client


async def fetch_structured_analysis(
    scm_service_url: str,
    repo_id: str,
    auth_token: str,
) -> Optional[Dict[str, Any]]:
    """Fetch the structured repo analysis from scm-service."""
    url = f"{scm_service_url}/api/scm/repos/{repo_id}/analysis"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {auth_token}"})
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.warning(f"No analysis found for repo {repo_id}: {resp.status_code}")
                return None
    except Exception as e:
        logger.error(f"Failed to fetch repo analysis: {e}")
        return None


def _search_qdrant_context(
    qdrant_url: str,
    query: str,
    repo_id: str,
    limit: int = 8,
) -> List[Dict[str, Any]]:
    """Semantic search over repo context in Qdrant."""
    try:
        client = _get_qdrant_client(qdrant_url)
        results = client.query(
            collection_name=QDRANT_COLLECTION,
            query_text=query,
            query_filter=Filter(
                must=[FieldCondition(key="repo_id", match=MatchValue(value=str(repo_id)))]
            ),
            limit=limit,
        )
        return [
            {
                "content": point.metadata.get("content", ""),
                "content_type": point.metadata.get("content_type", ""),
                "score": point.score,
            }
            for point in results
        ]
    except Exception as e:
        logger.warning(f"Qdrant search failed (non-fatal): {e}")
        return []


def _format_structured_context(analysis: Dict[str, Any]) -> str:
    """Format the structured analysis into a clean, focused LLM context block."""
    parts = []

    # ── Header ──
    repo_name = analysis.get("repo_name", "unknown")
    provider = analysis.get("scm_provider", "unknown")
    branch = analysis.get("default_branch", "main")
    arch = analysis.get("architecture_type", "unknown")
    languages = analysis.get("languages", {})
    tech_stack = analysis.get("tech_stack", {})
    infra_signals = analysis.get("infra_signals", {})

    parts.append(f"=== REPOSITORY ANALYSIS ===")
    parts.append(f"Repository: {repo_name} ({provider})")
    parts.append(f"Branch: {branch} | Architecture: {arch}")
    parts.append("")

    # ── Tech Stack ──
    primary_lang = languages.get("primary", "unknown")
    frameworks = languages.get("frameworks", [])
    runtime = tech_stack.get("runtime", primary_lang)
    runtime_version = tech_stack.get("runtime_version", "")
    pkg_mgr = tech_stack.get("package_manager", "unknown")
    containerized = tech_stack.get("containerized", False)

    parts.append("Tech Stack:")
    lang_str = primary_lang.capitalize()
    if frameworks:
        lang_str += f" ({', '.join(frameworks)})"
    parts.append(f"  - Language: {lang_str}")
    if runtime and runtime != primary_lang:
        parts.append(f"  - Runtime: {runtime}" + (f" {runtime_version}" if runtime_version else ""))
    parts.append(f"  - Package Manager: {pkg_mgr}")
    parts.append(f"  - Containerized: {'Yes' if containerized else 'No'}")
    parts.append("")

    # ── Infrastructure-Relevant Dependencies ──
    dependencies = analysis.get("dependencies", [])
    infra_deps = [d for d in dependencies if d.get("infra_relevant")]
    if infra_deps:
        parts.append("Infrastructure-Relevant Dependencies:")
        # Group by category
        by_category: Dict[str, List[Dict]] = {}
        for dep in infra_deps:
            cat = dep.get("category", "other")
            by_category.setdefault(cat, []).append(dep)

        category_to_resource = {
            "database": "DATABASE",
            "cache": "CACHE",
            "queue": "MESSAGE QUEUE",
            "storage": "OBJECT STORAGE",
            "monitoring": "MONITORING",
            "serverless": "SERVERLESS FUNCTION",
        }
        for cat, cat_deps in by_category.items():
            resource_hint = category_to_resource.get(cat, cat.upper())
            for dep in cat_deps:
                version_str = f" ({dep.get('version', '')})" if dep.get("version") else ""
                source = f" [from {dep.get('source_file', '')}]" if dep.get("source_file") else ""
                parts.append(f"  - {dep['name']}{version_str} → {resource_hint} needed{source}")
        parts.append("")

    # ── Infrastructure Signals ──
    parts.append("Infrastructure Signals:")
    signal_items = [
        ("has_dockerfile", "✓ Dockerfile found → Container deployment (ECS/EKS)", "✗ No Dockerfile → VM or serverless deployment"),
        ("has_docker_compose", "✓ Docker Compose found → Multi-service local stack", None),
        ("has_terraform", "✓ Terraform files found → IaC already configured", "✗ No Terraform → IaC not set up yet"),
        ("has_kubernetes", "✓ Kubernetes manifests found → K8s deployment", None),
        ("has_serverless", "✓ Serverless config found → Lambda/serverless deployment", None),
    ]
    for key, yes_msg, no_msg in signal_items:
        if infra_signals.get(key):
            parts.append(f"  {yes_msg}")
        elif no_msg:
            parts.append(f"  {no_msg}")

    if infra_signals.get("has_ci_cd"):
        parts.append(f"  ✓ CI/CD configured: {infra_signals.get('ci_cd_type', 'unknown')}")
    else:
        parts.append(f"  ✗ No CI/CD configuration detected")

    if infra_signals.get("has_env_file"):
        env_count = infra_signals.get("env_var_count", 0)
        parts.append(f"  ✓ .env template found ({env_count} environment variables)")

    if infra_signals.get("has_makefile"):
        parts.append(f"  ✓ Makefile found")

    parts.append("")

    # ── Directory Summary ──
    dir_summary = analysis.get("directory_summary", "")
    if dir_summary:
        parts.append(dir_summary)
        parts.append("")

    # ── Key Infrastructure File Contents ──
    infra_files = analysis.get("infra_files", [])
    if infra_files:
        parts.append("=== KEY INFRASTRUCTURE FILE CONTENTS ===")
        for f in infra_files:
            content = f.get("content", "")
            # Full content for infra files (no truncation — these are critical)
            parts.append(f"--- {f['file_path']} ({f['file_type']}) ---")
            parts.append(content)
            parts.append("")

    return "\n".join(parts)


def _format_fallback_context(state: dict) -> str:
    """
    Fallback: format raw repo_tree data (old approach).
    Used when no structured analysis exists.
    """
    parts = []

    # Repo scan memory (previously analyzed summary)
    repo_scan_memory = state.get("repo_scan_memory")
    if repo_scan_memory:
        scan_content = repo_scan_memory.get("content", "")
        if scan_content:
            parts.append(f"=== PREVIOUS REPO ANALYSIS ===\n{scan_content}")

    # Raw repo tree data
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

    # Dependency files
    dep_files = repo_tree.get("dependency_files", {})
    if dep_files:
        dep_parts = []
        for filepath, content in dep_files.items():
            truncated = content[:3000] + "..." if len(content) > 3000 else content
            dep_parts.append(f"--- {filepath} ---\n{truncated}")
        parts.append(
            f"=== DEPENDENCY & CONFIG FILES ({len(dep_files)} files) ===\n" + "\n\n".join(dep_parts)
        )

    return "\n\n".join(parts) if parts else "No repository data available."


async def build_repo_context(
    state: dict,
    scm_service_url: str = "http://localhost:8005",
    qdrant_url: str = "http://localhost:6333",
) -> str:
    """
    Build the best possible repo context for the LLM.

    Strategy:
    1. Try to get structured analysis from scm-service API
    2. Enrich with Qdrant semantic search based on user's query
    3. Fall back to raw repo_tree if no analysis exists

    Args:
        state: LangGraph state dict (contains repo_tree, user_message, auth_token, etc.)
        scm_service_url: Base URL of scm-service.
        qdrant_url: Qdrant server URL.

    Returns:
        Formatted context string for the LLM system prompt.
    """
    repo_id = state.get("repo_id") or ""
    auth_token = state.get("auth_token", "")
    user_message = state.get("user_message", "")

    # ── Step 1: Try structured analysis ──
    analysis = None

    # First check if analysis is already in session state (cached from session_manager)
    cached_analysis = state.get("repo_analysis")
    if cached_analysis and cached_analysis.get("status") == "ready":
        analysis = cached_analysis
        logger.info("Using cached structured analysis from session state")
    elif repo_id and auth_token:
        analysis = await fetch_structured_analysis(scm_service_url, repo_id, auth_token)
        if analysis:
            logger.info(f"Fetched structured analysis for repo {repo_id}")

    if not analysis:
        logger.info("No structured analysis available — falling back to raw repo_tree")
        return _format_fallback_context(state)

    # ── Step 2: Build structured context ──
    context = _format_structured_context(analysis)

    # ── Step 3: Enrich with Qdrant semantic search ──
    if user_message and repo_id:
        try:
            semantic_results = _search_qdrant_context(
                qdrant_url=qdrant_url,
                query=user_message,
                repo_id=str(repo_id),
                limit=5,
            )
            if semantic_results:
                relevant_chunks = [
                    r["content"] for r in semantic_results
                    if r.get("score", 0) > 0.5  # Only include reasonably relevant results
                ]
                if relevant_chunks:
                    context += "\n\n=== RELEVANT CONTEXT (semantic search) ===\n"
                    context += "\n---\n".join(relevant_chunks[:3])  # Top 3 most relevant
        except Exception as e:
            logger.warning(f"Qdrant enrichment failed (non-fatal): {e}")

    return context


def get_infra_evidence_from_analysis(analysis: Optional[Dict[str, Any]]) -> set:
    """
    Extract the set of evidenced resource types from a structured analysis.
    
    Replaces the old _detect_repo_evidence() that regex-scanned raw text.
    """
    if not analysis:
        return set()

    evidence: set = set()

    # From infra-relevant dependencies
    for dep in analysis.get("dependencies", []):
        if dep.get("infra_relevant") and dep.get("category"):
            evidence.add(dep["category"])

    # From infra signals
    signals = analysis.get("infra_signals", {})
    if signals.get("has_dockerfile") or signals.get("has_docker_compose"):
        evidence.add("container")
    if signals.get("has_serverless"):
        evidence.add("serverless")

    return evidence
