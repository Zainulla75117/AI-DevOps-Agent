"""
PostgreSQL connection pool for infrastructure summary persistence.
Uses asyncpg for high-performance async access.
"""

import asyncpg
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def init_pg_pool(dsn: str):
    """Create a connection pool on app startup."""
    global _pool
    try:
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10,
        )
        logger.info("✅ PostgreSQL connection pool created")
    except Exception as e:
        logger.warning(f"⚠️ Could not connect to PostgreSQL: {e}")
        logger.warning("   Infrastructure summaries will NOT be persisted this session.")
        _pool = None


async def close_pg_pool():
    """Close the pool on app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


def get_pool() -> Optional[asyncpg.Pool]:
    """Get the active connection pool. Returns None if PG is unavailable."""
    return _pool


def is_pg_available() -> bool:
    """Check if PostgreSQL is connected."""
    return _pool is not None
