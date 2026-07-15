"""
Qdrant Vector Service — Embeds repo analysis data into Qdrant for semantic search.

Uses fastembed (via qdrant-client) for lightweight local embeddings.
Collection: scm_repo_context — stores embedded chunks of repo analysis.
"""

import logging
from typing import List, Dict, Any, Optional

from qdrant_client import QdrantClient, models
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

COLLECTION_NAME = "scm_repo_context"
# fastembed default model: BAAI/bge-small-en-v1.5 (384 dimensions)
VECTOR_SIZE = 384

_client: Optional[QdrantClient] = None


def get_qdrant_client(url: str = "http://localhost:6333") -> QdrantClient:
    """Get or create the Qdrant client singleton."""
    global _client
    if _client is None:
        _client = QdrantClient(url=url)
        logger.info(f"Qdrant client initialized: {url}")
    return _client


async def ensure_collection(url: str = "http://localhost:6333"):
    """Create the Qdrant collection if it doesn't exist."""
    client = get_qdrant_client(url)
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]

        if COLLECTION_NAME not in collection_names:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=VECTOR_SIZE,
                    distance=Distance.COSINE,
                ),
            )
            # Create payload indexes for filtering
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="repo_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="user_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="project_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="content_type",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            logger.info(f"✅ Qdrant collection '{COLLECTION_NAME}' created with indexes")
        else:
            logger.info(f"✅ Qdrant collection '{COLLECTION_NAME}' already exists")
    except Exception as e:
        logger.error(f"❌ Failed to ensure Qdrant collection: {e}")
        raise


def _build_dependency_text(dep: Dict[str, Any]) -> str:
    """Build a descriptive text for a dependency to embed."""
    parts = [f"{dep['name']}"]
    if dep.get("version"):
        parts.append(f"version {dep['version']}")
    if dep.get("category") and dep["category"] != "other":
        parts.append(f"category: {dep['category']}")
    if dep.get("infra_relevant"):
        parts.append("(infrastructure-relevant: requires cloud resource)")
    if dep.get("source_file"):
        parts.append(f"from {dep['source_file']}")
    return " — ".join(parts)


def _build_infra_file_text(infra_file: Dict[str, Any]) -> str:
    """Build a descriptive text for an infra file to embed."""
    content = infra_file.get("content", "")
    # Truncate very large files for embedding (embedding models have token limits)
    if len(content) > 2000:
        content = content[:2000] + "..."
    return f"Infrastructure file: {infra_file['file_path']} (type: {infra_file['file_type']})\n{content}"


def _build_tech_summary_text(analysis: Dict[str, Any]) -> str:
    """Build a comprehensive tech stack summary for embedding."""
    parts = []
    languages = analysis.get("languages", {})
    tech_stack = analysis.get("tech_stack", {})
    infra_signals = analysis.get("infra_signals", {})

    parts.append(f"Repository: {analysis.get('repo_name', 'unknown')}")
    parts.append(f"Primary language: {languages.get('primary', 'unknown')}")
    if languages.get("frameworks"):
        parts.append(f"Frameworks: {', '.join(languages['frameworks'])}")
    if tech_stack.get("runtime"):
        parts.append(f"Runtime: {tech_stack['runtime']}")
    if tech_stack.get("package_manager"):
        parts.append(f"Package manager: {tech_stack['package_manager']}")
    parts.append(f"Architecture: {analysis.get('architecture_type', 'unknown')}")
    parts.append(f"Containerized: {'yes' if tech_stack.get('containerized') else 'no'}")

    signal_flags = []
    if infra_signals.get("has_dockerfile"):
        signal_flags.append("Dockerfile present")
    if infra_signals.get("has_docker_compose"):
        signal_flags.append("Docker Compose present")
    if infra_signals.get("has_terraform"):
        signal_flags.append("Terraform IaC present")
    if infra_signals.get("has_kubernetes"):
        signal_flags.append("Kubernetes manifests present")
    if infra_signals.get("has_ci_cd"):
        signal_flags.append(f"CI/CD: {infra_signals['ci_cd_type']}")
    if signal_flags:
        parts.append(f"Infrastructure signals: {', '.join(signal_flags)}")

    return ". ".join(parts)


def embed_repo_analysis(analysis: Dict[str, Any], qdrant_url: str = "http://localhost:6333"):
    """
    Embed a complete repo analysis into Qdrant.
    
    Creates points for:
    1. Each infra-relevant dependency
    2. Each infra file (Dockerfile, CI/CD, Terraform, etc.)
    3. The overall tech stack summary
    4. The directory structure summary
    
    Old points for the same repo_id are deleted first (full re-index).
    """
    client = get_qdrant_client(qdrant_url)
    repo_id = analysis.get("repo_id", "")
    user_id = analysis.get("user_id", "")
    project_id = analysis.get("project_id", "")

    print(f"🔄 [QDRANT] Embedding analysis for repo {analysis.get('repo_name', repo_id)}...")

    # 1. Delete old points for this repo
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]
                )
            ),
        )
        print(f"  🗑️  Deleted old embeddings for repo_id={repo_id}")
    except Exception as e:
        logger.warning(f"Could not delete old points (may not exist): {e}")

    # 2. Build documents and metadata for embedding
    documents: List[str] = []
    metadata: List[Dict[str, Any]] = []

    # 2a. Infra-relevant dependencies
    for dep in analysis.get("dependencies", []):
        if dep.get("infra_relevant"):
            doc_text = _build_dependency_text(dep)
            documents.append(doc_text)
            metadata.append({
                "repo_id": repo_id,
                "user_id": user_id,
                "project_id": project_id,
                "content_type": "dependency",
                "content": doc_text,
                "dep_name": dep.get("name", ""),
                "dep_category": dep.get("category", ""),
                "dep_version": dep.get("version", ""),
                "source_file": dep.get("source_file", ""),
            })

    # 2b. Infrastructure files
    for infra_file in analysis.get("infra_files", []):
        doc_text = _build_infra_file_text(infra_file)
        documents.append(doc_text)
        metadata.append({
            "repo_id": repo_id,
            "user_id": user_id,
            "project_id": project_id,
            "content_type": "infra_file",
            "content": doc_text,
            "file_path": infra_file.get("file_path", ""),
            "file_type": infra_file.get("file_type", ""),
        })

    # 2c. Tech stack summary
    tech_summary = _build_tech_summary_text(analysis)
    documents.append(tech_summary)
    metadata.append({
        "repo_id": repo_id,
        "user_id": user_id,
        "project_id": project_id,
        "content_type": "tech_summary",
        "content": tech_summary,
    })

    # 2d. Directory structure summary
    dir_summary = analysis.get("directory_summary", "")
    if dir_summary:
        documents.append(f"Repository directory structure: {dir_summary}")
        metadata.append({
            "repo_id": repo_id,
            "user_id": user_id,
            "project_id": project_id,
            "content_type": "dir_summary",
            "content": dir_summary,
        })

    if not documents:
        print("  ⚠️  No documents to embed")
        return

    # 3. Embed and upsert using fastembed integration
    try:
        client.add(
            collection_name=COLLECTION_NAME,
            documents=documents,
            metadata=metadata,
        )
        print(f"  ✅ Embedded {len(documents)} chunks into Qdrant "
              f"(deps: {sum(1 for m in metadata if m['content_type'] == 'dependency')}, "
              f"files: {sum(1 for m in metadata if m['content_type'] == 'infra_file')}, "
              f"summaries: {sum(1 for m in metadata if m['content_type'] in ('tech_summary', 'dir_summary'))})")
    except Exception as e:
        logger.error(f"❌ Failed to embed into Qdrant: {e}")
        raise


def search_repo_context(
    query: str,
    repo_id: str,
    qdrant_url: str = "http://localhost:6333",
    limit: int = 10,
    content_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Semantic search over repo context in Qdrant.

    Args:
        query: Natural language query (e.g., "database configuration").
        repo_id: Filter results to this repo.
        qdrant_url: Qdrant server URL.
        limit: Max results to return.
        content_type: Optional filter by content type (dependency/infra_file/tech_summary/dir_summary).

    Returns:
        List of dicts with 'content', 'content_type', 'score', and other metadata.
    """
    client = get_qdrant_client(qdrant_url)

    filter_conditions = [
        FieldCondition(key="repo_id", match=MatchValue(value=repo_id))
    ]
    if content_type:
        filter_conditions.append(
            FieldCondition(key="content_type", match=MatchValue(value=content_type))
        )

    try:
        results = client.query(
            collection_name=COLLECTION_NAME,
            query_text=query,
            query_filter=Filter(must=filter_conditions),
            limit=limit,
        )

        return [
            {
                "content": point.metadata.get("content", ""),
                "content_type": point.metadata.get("content_type", ""),
                "score": point.score,
                **{k: v for k, v in point.metadata.items() if k not in ("content",)},
            }
            for point in results
        ]
    except Exception as e:
        logger.error(f"Qdrant search failed: {e}")
        return []


def delete_repo_embeddings(repo_id: str, qdrant_url: str = "http://localhost:6333"):
    """Delete all embeddings for a specific repo."""
    client = get_qdrant_client(qdrant_url)
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]
                )
            ),
        )
        logger.info(f"Deleted all embeddings for repo_id={repo_id}")
    except Exception as e:
        logger.error(f"Failed to delete repo embeddings: {e}")
