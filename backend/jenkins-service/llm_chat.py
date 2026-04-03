"""
LLM Chat Handler
Handles normal LLM conversations with streaming support
"""

from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import asyncio
from typing import Optional, Dict, Any, AsyncGenerator
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Gemini client
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
client = None

if api_key:
    try:
        client = genai.Client(api_key=api_key)
        logger.info("Gemini LLM client initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize Gemini client: {e}")
else:
    logger.warning("GEMINI_API_KEY not found. LLM features will be disabled.")


SYSTEM_PROMPT = """You are a helpful AI assistant for Jenkins pipeline generation and codebase analysis. 
You help users:
- Generate Jenkins pipelines
- Analyze codebases and tech stacks
- Answer questions about CI/CD, DevOps, and software development
- Provide guidance on best practices

IMPORTANT INSTRUCTIONS FOR PIPELINE CREATION:

When a user wants to create, build, generate, or set up a Jenkins pipeline (or any variation like "create pipeline", "build pipeline", "generate jenkinsfile", "setup CI/CD", etc.), you MUST respond with a special format to request form data.

RESPONSE FORMAT FOR PIPELINE REQUESTS:
When you detect a pipeline creation request, respond EXACTLY with this format:

__FORM_REQUEST__

I'll help you create a Jenkins pipeline! To generate the perfect pipeline for your project, I need some information. Please fill out the form below with your project details.

The form will collect:
- Source type (SCM repository or Manual entry)
- Repository information (if SCM)
- Branch name
- Tech stack details

After you fill out the form, I'll analyze your codebase and generate a customized Jenkins pipeline configuration.

END OF FORMAT

For all other questions (not pipeline creation), respond normally with helpful information.

Be concise, helpful, and professional in your responses."""


def get_conversation_history(session_id: str, sessions: Dict[str, Dict[str, Any]], exclude_last_user: bool = False) -> list:
    """
    Get conversation history for a session.
    
    Args:
        session_id: Session identifier
        sessions: Session storage dictionary
        exclude_last_user: If True, exclude the last user message (useful when current message is already in session)
    
    Returns:
        List of conversation messages in format expected by Gemini
    """
    if session_id not in sessions:
        return []
    
    history = []
    messages = sessions[session_id].get("messages", [])
    
    # If exclude_last_user, skip the last message if it's a user message
    messages_to_process = messages
    if exclude_last_user and messages and messages[-1].get("role") == "user":
        messages_to_process = messages[:-1]
    
    # Keep last 10 message pairs (20 messages) for context
    for msg in messages_to_process[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        
        if role == "user":
            history.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=content)]
            ))
        elif role == "assistant":
            history.append(types.Content(
                role="model",
                parts=[types.Part.from_text(text=content)]
            ))
    
    return history


async def generate_llm_response(
    message: str,
    session_id: str,
    sessions: Dict[str, Dict[str, Any]],
    stream: bool = False
) -> AsyncGenerator[str, None]:
    """
    Generate LLM response with optional streaming.
    Uses conversation history from the session to maintain context.
    
    Args:
        message: User message
        session_id: Session identifier
        sessions: Session storage dictionary
        stream: Whether to stream the response
    
    Yields:
        Response chunks (if streaming) or complete response
    """
    if not client:
        yield "LLM service is not available. Please configure GEMINI_API_KEY in your .env file."
        return
    
    try:
        # Get conversation history (excludes current message - we'll add it separately)
        # The history includes previous user/assistant messages
        # Exclude last user message if it's the current one (already in session)
        history = get_conversation_history(session_id, sessions, exclude_last_user=True)
        
        # Prepare contents: history + current user message
        contents = history + [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=message)]
            )
        ]
        
        logger.debug(f"LLM request - session: {session_id}, history_length: {len(history)}, message_length: {len(message)}")
        
        if stream:
            # Stream response from LLM
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT
                ),
                contents=contents
            )
            
            # Yield each chunk as it arrives from LLM
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        else:
            # Generate complete response
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT
                ),
                contents=contents
            )
            
            if response.text:
                yield response.text
            else:
                yield "I apologize, but I couldn't generate a response. Please try again."
                
    except Exception as e:
        logger.error(f"Error generating LLM response: {str(e)}")
        yield f"I encountered an error: {str(e)}. Please try again."


async def get_llm_response(
    message: str,
    session_id: str,
    sessions: Dict[str, Dict[str, Any]]
) -> str:
    """
    Get complete LLM response (non-streaming).
    
    Args:
        message: User message
        session_id: Session identifier
        sessions: Session storage dictionary
    
    Returns:
        Complete response text
    """
    response_text = ""
    async for chunk in generate_llm_response(message, session_id, sessions, stream=False):
        response_text += chunk
    return response_text


async def stream_llm_response(
    message: str,
    session_id: str,
    sessions: Dict[str, Dict[str, Any]]
) -> AsyncGenerator[str, None]:
    """
    Stream LLM response chunk by chunk.
    
    Args:
        message: User message
        session_id: Session identifier
        sessions: Session storage dictionary
    
    Yields:
        Response text chunks
    """
    async for chunk in generate_llm_response(message, session_id, sessions, stream=True):
        yield chunk


def update_session_history(
    session_id: str,
    sessions: Dict[str, Dict[str, Any]],
    user_message: str,
    assistant_response: str
):
    """
    Update session history with user message and assistant response.
    
    Args:
        session_id: Session identifier
        sessions: Session storage dictionary
        user_message: User's message
        assistant_response: Assistant's response
    """
    if session_id not in sessions:
        sessions[session_id] = {"messages": []}
    
    sessions[session_id]["messages"].append({
        "role": "user",
        "content": user_message
    })
    
    sessions[session_id]["messages"].append({
        "role": "assistant",
        "content": assistant_response
    })
    
    # Keep only last 20 messages to prevent memory issues
    if len(sessions[session_id]["messages"]) > 20:
        sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]


def is_llm_available() -> bool:
    """
    Check if LLM service is available.
    
    Returns:
        True if LLM client is initialized, False otherwise
    """
    return client is not None

