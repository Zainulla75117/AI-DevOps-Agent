"""
CRUD operations for infrastructure summaries in PostgreSQL.
All operations are no-ops if PostgreSQL is unavailable (graceful degradation).
"""

import json
import logging
from typing import Optional
from postgres.connection import get_pool, is_pg_available

logger = logging.getLogger(__name__)


async def save_summary(
    project_id: str,
    user_id: Optional[str],
    session_id: str,
    plan_text: str,
    decisions: list,
    resources: list,
    architecture: dict,
    llm_summary: str,
) -> Optional[int]:
    """
    Save an infrastructure summary. Creates a new version each time.
    Returns the new version number, or None if PG is unavailable.
    """
    if not is_pg_available():
        logger.warning("PostgreSQL not available — skipping summary save")
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            # Get current max version for this project
            row = await conn.fetchrow(
                "SELECT COALESCE(MAX(version), 0) AS max_v FROM infra_summaries WHERE project_id = $1",
                project_id,
            )
            new_version = row["max_v"] + 1

            await conn.execute(
                """
                INSERT INTO infra_summaries 
                    (project_id, user_id, session_id, version, plan_text, 
                     decisions, resources, architecture, llm_summary)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
                """,
                project_id,
                user_id,
                session_id,
                new_version,
                plan_text,
                json.dumps(decisions),
                json.dumps(resources),
                json.dumps(architecture),
                llm_summary,
            )
            logger.info(f"✅ Saved infrastructure summary v{new_version} for project {project_id}")
            return new_version

    except Exception as e:
        logger.error(f"Failed to save infrastructure summary: {e}")
        return None


async def get_latest_summary(project_id: str) -> Optional[dict]:
    """
    Get the most recent summary for a project.
    Returns a dict with all fields, or None if not found or PG unavailable.
    """
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT id, project_id, user_id, session_id, version,
                          plan_text, decisions, resources, architecture,
                          llm_summary, created_at, updated_at
                   FROM infra_summaries
                   WHERE project_id = $1
                   ORDER BY version DESC
                   LIMIT 1""",
                project_id,
            )
            if row:
                result = dict(row)
                # asyncpg returns JSONB as Python objects already
                logger.info(f"Loaded infrastructure summary v{result['version']} for project {project_id}")
                return result
            return None

    except Exception as e:
        logger.warning(f"Could not fetch infrastructure summary: {e}")
        return None


async def get_all_summaries(project_id: str) -> list:
    """Get all summary versions for a project (newest first)."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, version, llm_summary, created_at
                   FROM infra_summaries
                   WHERE project_id = $1
                   ORDER BY version DESC""",
                project_id,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch summary history: {e}")
        return []


async def delete_summaries_by_project(project_id: str) -> int:
    """
    Delete ALL infra_summaries for a project.
    Called during full infrastructure wipe to clean up PostgreSQL.
    Returns the number of rows deleted, or 0 if PG is unavailable.
    """
    if not is_pg_available():
        return 0

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM infra_summaries WHERE project_id = $1",
                project_id,
            )
            # result is like "DELETE 3"
            count = int(result.split()[-1]) if result else 0
            if count > 0:
                logger.info(f"🗑️ Deleted {count} infra_summaries for project {project_id}")
            return count
    except Exception as e:
        logger.warning(f"Could not delete infra summaries: {e}")
        return 0
