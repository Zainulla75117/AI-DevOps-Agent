"""
Conversation title generator for infrastructure chat sessions.

Uses a lightweight Gemini LLM call to extract a concise title from
the user's first message. Falls back to heuristic truncation if LLM
is unavailable.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Patterns that indicate a generic/greeting message (→ "Initial Chat")
GENERIC_PATTERNS = [
    r"^(hi|hello|hey|howdy|greetings?|good\s*(morning|afternoon|evening))[\s!.,?]*$",
    r"^(help|start|begin|go|ok|okay|sure|yes|yep|yeah)[\s!.,?]*$",
    r"^\[INIT_REPO_SCAN\]$",
    r"^(what can you do|what do you do)[\s?]*$",
]


def _is_generic_message(message: str) -> bool:
    """Check if the message is a generic greeting/command that doesn't warrant a specific title."""
    cleaned = message.strip().lower()
    for pattern in GENERIC_PATTERNS:
        if re.match(pattern, cleaned, re.IGNORECASE):
            return True
    return len(cleaned) < 5


def _heuristic_title(message: str, max_len: int = 50) -> str:
    """
    Generate a simple title by cleaning and truncating the message.
    Used as a fast fallback when LLM is unavailable.
    """
    # Remove common prefixes
    cleaned = re.sub(r"^(i\s+(want|need|would\s+like)\s+(to\s+)?)", "", message.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"^(please\s+|can\s+you\s+|could\s+you\s+)", "", cleaned, flags=re.IGNORECASE)
    
    # Capitalize first letter
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    
    # Truncate
    if len(cleaned) > max_len:
        # Try to break at a word boundary
        truncated = cleaned[:max_len]
        last_space = truncated.rfind(" ")
        if last_space > max_len // 2:
            truncated = truncated[:last_space]
        cleaned = truncated + "…"
    
    return cleaned or "Initial Chat"


async def generate_conversation_title(
    first_message: str,
    project_name: str,
    llm=None,
) -> str:
    """
    Analyze the user's first message to generate a concise conversation title.
    
    Strategy:
    1. If the message is a greeting/empty/generic → return "Initial Chat"
    2. Use a lightweight LLM call to extract a 3-6 word title
    3. Fallback: heuristic truncation of the first message
    
    Args:
        first_message: The user's first message in the conversation.
        project_name: The project name (for context).
        llm: Optional ChatGoogleGenerativeAI instance. If None, uses heuristic.
    
    Returns:
        A concise title string (max ~50 chars).
    """
    # Step 1: Check for generic messages
    if _is_generic_message(first_message):
        return "Initial Chat"
    
    # Step 2: Try LLM-based title generation
    if llm:
        try:
            from langchain_core.messages import HumanMessage
            
            prompt = (
                f"Generate a highly descriptive, meaningful, and action-oriented title (3-6 words) for this infrastructure DevOps chat. "
                f"The title should clearly indicate the specific goal, architecture, or issue being discussed for the project '{project_name}'. "
                f"Examples: 'API Gateway CI/CD Setup', 'Debugging PostgreSQL Connection', 'AWS ECS Cluster Architecture'. "
                f"Return ONLY the title, nothing else. No quotes, no punctuation at the end.\n\n"
                f"User message: {first_message[:300]}"
            )
            
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            raw_title = response.content if hasattr(response, "content") else str(response)
            
            # Handle list content (newer langchain versions)
            if isinstance(raw_title, list):
                raw_title = "".join(
                    part if isinstance(part, str) else part.get("text", str(part))
                    for part in raw_title
                )
            
            # Clean up LLM response
            title = raw_title.strip().strip('"\'').strip()
            
            # Ensure it's not too long or empty
            if title and 3 <= len(title) <= 60:
                logger.info(f"LLM-generated title: '{title}'")
                return title
            else:
                logger.warning(f"LLM title was invalid (len={len(title)}), falling back to heuristic")
                
        except Exception as e:
            logger.warning(f"LLM title generation failed: {e}, falling back to heuristic")
    
    # Step 3: Heuristic fallback
    return _heuristic_title(first_message)
