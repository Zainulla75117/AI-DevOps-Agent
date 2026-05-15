"""
Auto-migration: creates PostgreSQL tables on startup if they don't exist.

Tables:
  1. infra_summaries       — Legacy infrastructure summary persistence
  2. conversations         — Chat session metadata, titles, and status
  3. conversation_messages — Individual chat messages with structured metadata
  4. conversation_summaries— Rolling LLM-generated summaries (versioned per conversation)
  5. project_memory        — Cross-conversation project-level knowledge
"""

import logging
from postgres.connection import get_pool, is_pg_available

logger = logging.getLogger(__name__)


async def ensure_tables():
    """Create all required tables if they don't exist. Safe to call repeatedly."""
    if not is_pg_available():
        logger.warning("PostgreSQL not available — skipping table creation")
        return

    pool = get_pool()
    async with pool.acquire() as conn:
        # ── 1. Legacy infra_summaries (preserved for backward compatibility) ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS infra_summaries (
                id            SERIAL PRIMARY KEY,
                project_id    VARCHAR(64) NOT NULL,
                user_id       VARCHAR(64),
                session_id    VARCHAR(128),
                version       INTEGER NOT NULL DEFAULT 1,
                
                -- Structured summary fields
                plan_text     TEXT,
                decisions     JSONB DEFAULT '[]'::jsonb,
                resources     JSONB DEFAULT '[]'::jsonb,
                architecture  JSONB DEFAULT '{}'::jsonb,
                
                -- LLM-generated natural language summary
                llm_summary   TEXT,
                
                -- Metadata
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                -- Unique constraint for versioning
                CONSTRAINT uq_project_version UNIQUE (project_id, version)
            );
            
            CREATE INDEX IF NOT EXISTS idx_summary_project 
                ON infra_summaries(project_id);
            CREATE INDEX IF NOT EXISTS idx_summary_updated 
                ON infra_summaries(updated_at DESC);
        """)

        # ── 2. Conversations (session metadata + titles) ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id      VARCHAR(64) NOT NULL,
                user_id         VARCHAR(64),
                session_id      VARCHAR(128) NOT NULL UNIQUE,
                title           VARCHAR(256) NOT NULL DEFAULT 'Initial Chat',
                status          VARCHAR(16) NOT NULL DEFAULT 'active',
                message_count   INTEGER NOT NULL DEFAULT 0,
                
                -- LLM-generated summary of the conversation
                summary         TEXT,
                summary_version INTEGER NOT NULL DEFAULT 0,
                
                -- Infrastructure context snapshot at conversation end
                infra_snapshot  JSONB DEFAULT '{}'::jsonb,
                
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_conv_project ON conversations(project_id);
            CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id);
            CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_conv_status  ON conversations(status);
        """)

        # ── 3. Conversation messages ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id              BIGSERIAL PRIMARY KEY,
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role            VARCHAR(16) NOT NULL,
                content         TEXT NOT NULL,
                
                -- Structured metadata extracted from message
                metadata        JSONB DEFAULT '{}'::jsonb,
                
                -- For resource-related messages, track what was affected
                resources_affected JSONB DEFAULT '[]'::jsonb,
                
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_msg_conv    ON conversation_messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_msg_created ON conversation_messages(created_at);
        """)

        # ── 4. Conversation summaries (rolling, versioned per conversation) ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS conversation_summaries (
                id              SERIAL PRIMARY KEY,
                conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                project_id      VARCHAR(64) NOT NULL,
                version         INTEGER NOT NULL DEFAULT 1,
                
                -- What the LLM should remember
                summary_text    TEXT NOT NULL,
                
                -- Structured context for injection into system prompt
                key_decisions   JSONB DEFAULT '[]'::jsonb,
                resources_state JSONB DEFAULT '[]'::jsonb,
                action_history  JSONB DEFAULT '[]'::jsonb,
                
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                
                CONSTRAINT uq_conv_summary_version UNIQUE (conversation_id, version)
            );

            CREATE INDEX IF NOT EXISTS idx_csummary_conv    ON conversation_summaries(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_csummary_project ON conversation_summaries(project_id);
        """)

        # ── 5. Project memory (cross-conversation knowledge) ──
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS project_memory (
                id                      SERIAL PRIMARY KEY,
                project_id              VARCHAR(64) NOT NULL,
                memory_type             VARCHAR(32) NOT NULL,
                content                 TEXT NOT NULL,
                structured_data         JSONB DEFAULT '{}'::jsonb,
                source_conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
                
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_pmem_project ON project_memory(project_id);
            CREATE INDEX IF NOT EXISTS idx_pmem_type    ON project_memory(project_id, memory_type);
        """)

        logger.info("✅ PostgreSQL tables verified / created (5 tables)")


async def auto_prune_conversations(retention_days: int = 90):
    """
    Delete conversations older than retention_days.
    Before deletion, ensure the conversation summary is preserved in project_memory.
    """
    if not is_pg_available():
        return 0

    pool = get_pool()
    try:
        async with pool.acquire() as conn:
            # Find conversations to prune
            rows = await conn.fetch("""
                SELECT id, project_id, session_id, title, summary, message_count
                FROM conversations
                WHERE status = 'active'
                  AND updated_at < NOW() - INTERVAL '1 day' * $1
            """, retention_days)

            if not rows:
                return 0

            pruned_count = 0
            for row in rows:
                conv_id = row["id"]
                project_id = row["project_id"]
                summary = row["summary"] or f"Conversation '{row['title']}' ({row['message_count']} messages)"

                # Preserve summary in project_memory as a pruned record
                await conn.execute("""
                    INSERT INTO project_memory (project_id, memory_type, content, structured_data, source_conversation_id)
                    VALUES ($1, 'pruned_conversation', $2, $3::jsonb, $4)
                """,
                    project_id,
                    summary,
                    f'{{"title": "{row["title"]}", "session_id": "{row["session_id"]}", "message_count": {row["message_count"]}}}',
                    conv_id,
                )

                # Mark as archived (cascade will delete messages + summaries on actual delete)
                await conn.execute("""
                    UPDATE conversations SET status = 'archived' WHERE id = $1
                """, conv_id)

                pruned_count += 1

            if pruned_count > 0:
                logger.info(f"🧹 Auto-pruned {pruned_count} conversations older than {retention_days} days (summaries preserved)")

            return pruned_count

    except Exception as e:
        logger.warning(f"Auto-prune failed: {e}")
        return 0
