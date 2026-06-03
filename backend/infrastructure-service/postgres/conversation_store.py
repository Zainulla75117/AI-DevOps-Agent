"""
CRUD operations for conversation history, messages, summaries, and project memory.
All operations are no-ops if PostgreSQL is unavailable (graceful degradation).
"""

import json
import logging
from typing import Optional
from postgres.connection import get_pool, is_pg_available

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
#  CONVERSATION CRUD
# ═══════════════════════════════════════════════════════════════════════

async def create_conversation(
    project_id: str,
    session_id: str,
    user_id: Optional[str] = None,
    title: str = "Initial Chat",
) -> Optional[dict]:
    """Create a new conversation record. Returns the created row as dict, or None."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO conversations (project_id, user_id, session_id, title)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (session_id) DO UPDATE SET updated_at = NOW()
                RETURNING id, project_id, user_id, session_id, title, status,
                          message_count, summary, created_at, updated_at
            """, project_id, user_id, session_id, title)
            return dict(row) if row else None
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        return None


async def get_conversation(session_id: str) -> Optional[dict]:
    """Get a conversation by session_id."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, project_id, user_id, session_id, title, status,
                       message_count, summary, summary_version, infra_snapshot,
                       created_at, updated_at
                FROM conversations
                WHERE session_id = $1 AND status = 'active'
            """, session_id)
            return dict(row) if row else None
    except Exception as e:
        logger.warning(f"Could not fetch conversation: {e}")
        return None


async def get_conversations_by_project(project_id: str, limit: int = 50) -> list:
    """Get all active conversations for a project, newest first."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, project_id, user_id, session_id, title, status,
                       message_count, summary, created_at, updated_at
                FROM conversations
                WHERE project_id = $1 AND status = 'active'
                ORDER BY updated_at DESC
                LIMIT $2
            """, project_id, limit)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch conversations: {e}")
        return []


async def update_conversation_title(session_id: str, title: str) -> None:
    """Update a conversation's title."""
    if not is_pg_available():
        return

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE conversations SET title = $1, updated_at = NOW()
                WHERE session_id = $2
            """, title, session_id)
    except Exception as e:
        logger.warning(f"Could not update conversation title: {e}")


async def update_conversation_summary(
    session_id: str,
    summary: str,
    infra_snapshot: Optional[dict] = None,
) -> None:
    """Update a conversation's summary and optionally its infra snapshot."""
    if not is_pg_available():
        return

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            if infra_snapshot is not None:
                await conn.execute("""
                    UPDATE conversations 
                    SET summary = $1, summary_version = summary_version + 1,
                        infra_snapshot = $2::jsonb, updated_at = NOW()
                    WHERE session_id = $3
                """, summary, json.dumps(infra_snapshot), session_id)
            else:
                await conn.execute("""
                    UPDATE conversations 
                    SET summary = $1, summary_version = summary_version + 1, updated_at = NOW()
                    WHERE session_id = $2
                """, summary, session_id)
    except Exception as e:
        logger.warning(f"Could not update conversation summary: {e}")


async def delete_conversation(session_id: str) -> bool:
    """Delete a conversation and all its messages (cascade). Returns True on success."""
    if not is_pg_available():
        return False

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            # First, save summary to project_memory before deletion
            row = await conn.fetchrow("""
                SELECT id, project_id, title, summary, message_count
                FROM conversations WHERE session_id = $1
            """, session_id)

            if row and row["summary"]:
                await conn.execute("""
                    INSERT INTO project_memory (project_id, memory_type, content, structured_data, source_conversation_id)
                    VALUES ($1, 'deleted_conversation', $2, $3::jsonb, $4)
                """,
                    row["project_id"],
                    row["summary"],
                    json.dumps({"title": row["title"], "session_id": session_id, "message_count": row["message_count"]}),
                    row["id"],
                )

            result = await conn.execute("""
                DELETE FROM conversations WHERE session_id = $1
            """, session_id)
            return "DELETE 1" in result
    except Exception as e:
        logger.warning(f"Could not delete conversation: {e}")
        return False


async def touch_conversation(session_id: str, increment_messages: int = 0) -> None:
    """Update the conversation's updated_at timestamp and optionally increment message count."""
    if not is_pg_available():
        return

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE conversations 
                SET updated_at = NOW(), message_count = message_count + $1
                WHERE session_id = $2
            """, increment_messages, session_id)
    except Exception as e:
        logger.warning(f"Could not touch conversation: {e}")


# ═══════════════════════════════════════════════════════════════════════
#  MESSAGE CRUD
# ═══════════════════════════════════════════════════════════════════════

async def save_message(
    conversation_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
    resources_affected: Optional[list] = None,
) -> Optional[int]:
    """Save a chat message. Returns the message id, or None."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO conversation_messages (conversation_id, role, content, metadata, resources_affected)
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
                RETURNING id
            """,
                conversation_id,
                role,
                content,
                json.dumps(metadata or {}),
                json.dumps(resources_affected or []),
            )
            return row["id"] if row else None
    except Exception as e:
        logger.warning(f"Could not save message: {e}")
        return None


async def get_messages(conversation_id: str, limit: int = 30) -> list:
    """Get the most recent messages for a conversation."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, role, content, metadata, resources_affected, created_at
                FROM conversation_messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC
                LIMIT $2
            """, conversation_id, limit)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch messages: {e}")
        return []


async def get_all_messages_for_summary(conversation_id: str) -> list:
    """Get all messages for generating a summary (no limit)."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT role, content FROM conversation_messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC
            """, conversation_id)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch messages for summary: {e}")
        return []


async def get_message_count(conversation_id: str) -> int:
    """Get the total message count for a conversation."""
    if not is_pg_available():
        return 0

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT COUNT(*) AS cnt FROM conversation_messages
                WHERE conversation_id = $1
            """, conversation_id)
            return row["cnt"] if row else 0
    except Exception as e:
        return 0


# ═══════════════════════════════════════════════════════════════════════
#  CONVERSATION SUMMARY CRUD
# ═══════════════════════════════════════════════════════════════════════

async def save_conversation_summary(
    conversation_id: str,
    project_id: str,
    summary_text: str,
    key_decisions: list,
    resources_state: list,
    action_history: list,
) -> Optional[int]:
    """Save a rolling conversation summary. Returns the new version number."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            # Get current max version
            row = await conn.fetchrow("""
                SELECT COALESCE(MAX(version), 0) AS max_v 
                FROM conversation_summaries 
                WHERE conversation_id = $1
            """, conversation_id)
            new_version = row["max_v"] + 1

            await conn.execute("""
                INSERT INTO conversation_summaries 
                    (conversation_id, project_id, version, summary_text, 
                     key_decisions, resources_state, action_history)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
            """,
                conversation_id,
                project_id,
                new_version,
                summary_text,
                json.dumps(key_decisions),
                json.dumps(resources_state),
                json.dumps(action_history),
            )

            # Also update the conversation's summary field
            await conn.execute("""
                UPDATE conversations 
                SET summary = $1, summary_version = $2, updated_at = NOW()
                WHERE id = $3
            """, summary_text, new_version, conversation_id)

            logger.info(f"✅ Conversation summary v{new_version} saved for {conversation_id}")
            return new_version

    except Exception as e:
        logger.error(f"Failed to save conversation summary: {e}")
        return None


async def get_latest_conversation_summary(conversation_id: str) -> Optional[dict]:
    """Get the most recent rolling summary for a conversation."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, version, summary_text, key_decisions, resources_state, 
                       action_history, created_at
                FROM conversation_summaries
                WHERE conversation_id = $1
                ORDER BY version DESC
                LIMIT 1
            """, conversation_id)
            return dict(row) if row else None
    except Exception as e:
        logger.warning(f"Could not fetch conversation summary: {e}")
        return None


async def get_project_summaries(project_id: str, limit: int = 5) -> list:
    """Get recent conversation summaries for a project across all conversations."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT cs.id, cs.version, cs.summary_text, cs.key_decisions,
                       cs.resources_state, cs.created_at, c.title, c.session_id
                FROM conversation_summaries cs
                JOIN conversations c ON c.id = cs.conversation_id
                WHERE cs.project_id = $1
                ORDER BY cs.created_at DESC
                LIMIT $2
            """, project_id, limit)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch project summaries: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
#  PROJECT MEMORY CRUD
# ═══════════════════════════════════════════════════════════════════════

async def upsert_project_memory(
    project_id: str,
    memory_type: str,
    content: str,
    structured_data: Optional[dict] = None,
    source_conversation_id: Optional[str] = None,
) -> None:
    """
    Upsert a project memory record. For 'infra_state' and 'repo_scan' types,
    this replaces the existing record. For other types (like 'pruned_conversation'),
    a new row is inserted.
    """
    if not is_pg_available():
        return

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            if memory_type in ("infra_state", "repo_scan"):
                # Upsert: replace if exists
                existing = await conn.fetchrow("""
                    SELECT id FROM project_memory
                    WHERE project_id = $1 AND memory_type = $2
                """, project_id, memory_type)

                if existing:
                    await conn.execute("""
                        UPDATE project_memory 
                        SET content = $1, structured_data = $2::jsonb, 
                            source_conversation_id = $3, updated_at = NOW()
                        WHERE project_id = $4 AND memory_type = $5
                    """,
                        content,
                        json.dumps(structured_data or {}),
                        source_conversation_id,
                        project_id,
                        memory_type,
                    )
                else:
                    await conn.execute("""
                        INSERT INTO project_memory 
                            (project_id, memory_type, content, structured_data, source_conversation_id)
                        VALUES ($1, $2, $3, $4::jsonb, $5)
                    """,
                        project_id,
                        memory_type,
                        content,
                        json.dumps(structured_data or {}),
                        source_conversation_id,
                    )
            else:
                # Append: always insert new row (for pruned_conversation, etc.)
                await conn.execute("""
                    INSERT INTO project_memory 
                        (project_id, memory_type, content, structured_data, source_conversation_id)
                    VALUES ($1, $2, $3, $4::jsonb, $5)
                """,
                    project_id,
                    memory_type,
                    content,
                    json.dumps(structured_data or {}),
                    source_conversation_id,
                )

            logger.info(f"✅ Project memory [{memory_type}] saved for project {project_id}")

    except Exception as e:
        logger.warning(f"Could not upsert project memory: {e}")


async def get_project_memory(project_id: str) -> list:
    """Get all project memory records for a project."""
    if not is_pg_available():
        return []

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT id, memory_type, content, structured_data, 
                       source_conversation_id, created_at, updated_at
                FROM project_memory
                WHERE project_id = $1
                ORDER BY updated_at DESC
            """, project_id)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Could not fetch project memory: {e}")
        return []


async def get_project_memory_by_type(project_id: str, memory_type: str) -> Optional[dict]:
    """Get a specific project memory record by type."""
    if not is_pg_available():
        return None

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, memory_type, content, structured_data, 
                       source_conversation_id, created_at, updated_at
                FROM project_memory
                WHERE project_id = $1 AND memory_type = $2
                ORDER BY updated_at DESC
                LIMIT 1
            """, project_id, memory_type)
            return dict(row) if row else None
    except Exception as e:
        logger.warning(f"Could not fetch project memory by type: {e}")
        return None


async def delete_project_memory_by_type(project_id: str, memory_type: str) -> int:
    """
    Delete all project_memory rows matching project_id + memory_type.
    Returns number of rows deleted.
    """
    if not is_pg_available():
        return 0

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            result = await conn.execute("""
                DELETE FROM project_memory
                WHERE project_id = $1 AND memory_type = $2
            """, project_id, memory_type)
            count = int(result.split()[-1]) if result else 0
            if count > 0:
                logger.info(f"🗑️ Deleted {count} project_memory[{memory_type}] rows for project {project_id}")
            return count
    except Exception as e:
        logger.warning(f"Could not delete project memory [{memory_type}]: {e}")
        return 0


async def archive_infra_and_cleanup(project_id: str) -> dict:
    """
    Full infrastructure wipe cleanup for PostgreSQL.
    Deletes ALL project memory and summaries that could cause the LLM
    to hallucinate about resources that no longer exist.

    Returns { summaries_deleted: int, memory_cleaned: list[str] }
    """
    result = {"summaries_deleted": 0, "memory_cleaned": []}

    if not is_pg_available():
        return result

    # Delete all project_memory types that could carry stale infra data
    for mem_type in [
        "infra_state",
        "repo_scan",
        "iac_blueprint",
        "deleted_infra_history",
        "deleted_conversation",
        "pruned_conversation",
    ]:
        count = await delete_project_memory_by_type(project_id, mem_type)
        if count > 0:
            result["memory_cleaned"].append(mem_type)

    # Delete all infra_summaries
    from postgres.summary_store import delete_summaries_by_project
    result["summaries_deleted"] = await delete_summaries_by_project(project_id)

    # Delete all conversation_summaries for this project
    # These rolling summaries may reference resources that no longer exist
    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            res = await conn.execute(
                "DELETE FROM conversation_summaries WHERE project_id = $1",
                project_id,
            )
            conv_summary_count = int(res.split()[-1]) if res else 0
            if conv_summary_count > 0:
                result["memory_cleaned"].append(f"conversation_summaries({conv_summary_count})")
                logger.info(f"🗑️ Deleted {conv_summary_count} conversation_summaries for project {project_id}")
    except Exception as e:
        logger.warning(f"Could not delete conversation_summaries: {e}")

    logger.info(f"✅ Infra cleanup complete for project {project_id}: {result}")
    return result
