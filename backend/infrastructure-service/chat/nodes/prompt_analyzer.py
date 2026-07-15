"""
Node 0: Prompt Analyzer (Human-in-the-Loop gate).

Runs BEFORE the extractor node. Evaluates the user's raw prompt for clarity and
completeness, then makes one of three decisions:

  proceed  -> prompt is specific enough; route to extract node normally
  clarify  -> prompt is ambiguous; return 2-3 counter-questions to user and stop this turn
  rephrase -> prompt is vague but guessable; return a precise rewrite for user to confirm

When decision is clarify or rephrase, the graph ends immediately (response_type is set to
"clarification" or "rephrased"). The session stores clarification_pending=True so the
NEXT turn's analyzer call fast-paths to "proceed" -- avoiding an infinite clarify loop.
"""

import logging
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from chat.prompts import build_prompt_analyzer_prompt
from app.schemas.intent_schemas import PromptAnalysis, PromptDecision

logger = logging.getLogger(__name__)


# =======================================================================
#  PASSTHROUGH SIGNALS
#  Messages that should NEVER be intercepted by the analyzer.
# =======================================================================

_SYSTEM_COMMANDS = {
    "[INIT_REPO_SCAN]", "/scan-repo", "/plan", "/cost-estimate", "/clear"
}

_CONFIRMATION_WORDS = {
    "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "confirmed",
    "approve", "approved", "looks good", "that's right", "correct",
    "go ahead", "proceed", "do it", "no", "cancel", "stop", "nope",
}

_GREETING_WORDS = {"hi", "hello", "hey", "thanks", "thank you", "thx", "ty"}


def _is_passthrough(user_message: str, state: dict) -> bool:
    """
    Return True if this message should bypass the prompt analyzer entirely.

    Bypasses for:
    - System commands (/scan-repo, [INIT_REPO_SCAN], etc.)
    - Single-word or very short confirmations / negations
    - Greetings
    - Any turn where the user is answering our previous clarification questions
      (signaled by clarification_pending=True in the session state)
    """
    msg_stripped = user_message.strip()
    msg_lower = msg_stripped.lower()

    # System commands always pass through
    for cmd in _SYSTEM_COMMANDS:
        if cmd in msg_stripped:
            return True

    # If we're waiting for the user's answer to clarification questions, pass through
    if state.get("clarification_pending", False):
        logger.info("Prompt analyzer: clarification_pending=True, fast-path to proceed")
        return True

    # Short messages that are confirmations, negations, or greetings
    words = msg_lower.split()
    if len(words) <= 4:
        word_set = set(words)
        if word_set & _CONFIRMATION_WORDS:
            return True
        if word_set & _GREETING_WORDS:
            return True

    return False


# =======================================================================
#  MAIN NODE
# =======================================================================

async def analyze_prompt(state: dict, llm) -> dict:
    """
    Node 0: Human-in-the-Loop prompt quality gate.

    Evaluates the user's message before the extractor runs. Returns one of:
      - prompt_decision="proceed"  -> route to extract (no user-visible effect)
      - prompt_decision="clarify"  -> return counter-questions, stop this turn
      - prompt_decision="rephrase" -> return suggested rewrite, stop this turn
    """
    logger.info("Running analyze_prompt node...")

    user_message = state.get("user_message", "")

    # -- No LLM available: always proceed --
    if not llm:
        return {**state, "prompt_decision": "proceed", "clarification_pending": False}

    # -- Fast-path: skip analysis for passthroughs --
    if _is_passthrough(user_message, state):
        logger.info(f"Prompt analyzer fast-path: '{user_message[:60]}'")
        return {
            **state,
            "prompt_decision": "proceed",
            "clarification_pending": False,
        }

    # -- Run LLM analysis --
    try:
        system_prompt = build_prompt_analyzer_prompt(
            project_name=state.get("project_name", "Unknown"),
            project_info=state.get("project_info"),
            existing_resources=state.get("existing_resources", []),
        )

        messages = [SystemMessage(content=system_prompt)]

        # Include recent conversation history so the LLM knows if the user
        # is answering a previous question (avoids false CLARIFY loops).
        history = state.get("messages", [])
        for msg in history[-6:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))
            elif isinstance(msg, (HumanMessage, AIMessage)):
                messages.append(msg)

        structured_llm = llm.bind(temperature=0.0).with_structured_output(PromptAnalysis)
        analysis: PromptAnalysis = await structured_llm.ainvoke(messages)

        logger.info(
            f"Prompt analysis complete: decision={analysis.decision}, "
            f"ambiguity={analysis.ambiguity_score:.2f}, "
            f"missing={analysis.missing_info}, "
            f"reasoning={analysis.reasoning[:80]}"
        )

        # ---- PROCEED ----
        if analysis.decision == PromptDecision.PROCEED:
            return {
                **state,
                "prompt_decision": "proceed",
                "clarification_pending": False,
            }

        # ---- CLARIFY ----
        elif analysis.decision == PromptDecision.CLARIFY:
            questions = analysis.counter_questions[:3]  # Hard cap at 3
            response = _format_clarification(questions)
            logger.info(f"Prompt analyzer: asking {len(questions)} counter-questions")
            return {
                **state,
                "prompt_decision": "clarify",
                "clarification_pending": True,
                "clarification_questions": questions,
                "response_content": response,
                "raw_response": response,
                "response_type": "clarification",
                "intent": "general",
            }

        # ---- REPHRASE ----
        elif analysis.decision == PromptDecision.REPHRASE:
            rephrased = analysis.rephrased_prompt or user_message
            response = _format_rephrase(
                original=user_message,
                rephrased=rephrased,
                reasoning=analysis.reasoning,
            )
            logger.info(f"Prompt analyzer: suggesting rephrase: '{rephrased}'")
            return {
                **state,
                "prompt_decision": "rephrase",
                "clarification_pending": True,
                "rephrased_prompt": rephrased,
                "response_content": response,
                "raw_response": response,
                "response_type": "rephrased",
                "intent": "general",
            }

        # Fallback: unknown decision value
        return {**state, "prompt_decision": "proceed", "clarification_pending": False}

    except Exception as e:
        # If analysis fails for any reason, proceed normally rather than
        # blocking the user with an error. The extractor handles ambiguity too.
        logger.warning(
            f"Prompt analyzer failed (falling back to proceed): {e}",
            exc_info=True,
        )
        return {**state, "prompt_decision": "proceed", "clarification_pending": False}


# =======================================================================
#  RESPONSE FORMATTERS
# =======================================================================

def _format_clarification(questions: list) -> str:
    """
    Format counter-questions as a friendly, scannable markdown message.

    Example:
        I'd love to help! To design the right infrastructure, I have a couple of questions:

        **1.** Is this a web app, REST API, or data pipeline?
        **2.** Should this run as containers (ECS) or virtual machines (EC2)?

        Feel free to answer all at once -- a single reply is fine.
    """
    if not questions:
        return (
            "Could you tell me a bit more about what you need? "
            "For example: what kind of application is this, and what environment "
            "(dev/staging/production) are you targeting?"
        )

    lines = [
        "I'd love to help! To design the right infrastructure, "
        "I have a couple of quick questions:\n"
    ]
    for i, q in enumerate(questions, 1):
        lines.append(f"**{i}.** {q}")

    lines.append(
        "\nFeel free to answer all at once -- a single reply works perfectly."
    )
    return "\n".join(lines)


def _format_rephrase(original: str, rephrased: str, reasoning: str) -> str:
    """
    Format the rephrase suggestion as a confirmation request.

    Example:
        Before I build the plan, let me make sure I understood you correctly.

        Here's how I interpreted your request:
        > **Deploy a containerised Node.js API on ECS Fargate with PostgreSQL in production**

        Does that match what you have in mind?
        - Reply **"yes"** or **"looks good"** to proceed
        - **Correct me** -- just tell me what's different
        - **Add more detail** -- e.g., region, expected traffic, environment
    """
    return (
        "Before I build the plan, let me make sure I understood you correctly.\n\n"
        "Here's how I interpreted your request:\n"
        f"> **{rephrased}**\n\n"
        "Does that match what you have in mind?\n"
        "- Reply **\"yes\"** or **\"looks good\"** to proceed with this\n"
        "- **Correct me** -- just tell me what's different\n"
        "- **Add more detail** -- e.g., region, expected traffic, environment"
    )
