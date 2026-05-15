"""
FastAPI Application for GitLab Repository Downloader and Jenkins Chat Backend
Main entry point for the API server with SSE support
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Query, Header, status
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import json
import time
import asyncio
from pathlib import Path
import logging
import jwt
from datetime import datetime

from gitlab_downloader import download_repository_zip
from techstack_analyzer import analyze_codebase
from jenkinsfile_generator import generate_jenkinsfile, is_jenkinsfile_generator_available
from project_client import project_client

# Import RAG module
try:
    from jenkinsfile_rag import (
        load_jenkinsfiles_to_chromadb,
        is_rag_available,
        get_rag_status
    )
    RAG_MODULE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"RAG module not available: {e}")
    RAG_MODULE_AVAILABLE = False
    load_jenkinsfiles_to_chromadb = None
    is_rag_available = lambda: False
    get_rag_status = lambda: {"available": False}
from llm_chat import (
    generate_llm_response,
    get_llm_response,
    stream_llm_response,
    update_session_history,
    is_llm_available
)
from langgraph_chat import (
    process_chat_message,
    stream_chat_message,
    is_langgraph_available
)
import zipfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Jenkins Code Generator API",
    description="API for GitLab repository download and Jenkins pipeline generation with chat interface",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure with specific origins in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Provide detailed validation error messages."""
    errors = exc.errors()
    error_details = []
    for error in errors:
        field = " -> ".join(str(loc) for loc in error["loc"])
        error_details.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.error(f"Validation error for {request.url.path}: {error_details}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "message": "Request body validation failed",
            "details": error_details,
            "example": {
                "token": "your_login_jwt_token"
            }
        }
    )

# Session Management
sessions: Dict[str, Dict[str, Any]] = {}

# JWT Configuration (load from env)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


# ==================== Request/Response Models ====================

class DownloadRequest(BaseModel):
    """Request model for downloading a repository."""
    repo_url: str = Field(..., description="Full repository URL")
    branch: str = Field(default="main", description="Branch name to download")
    output_filename: Optional[str] = Field(None, description="Output filename")


class DownloadResponse(BaseModel):
    """Response model for download operation."""
    success: bool
    message: str
    file_path: Optional[str] = None
    file_size_mb: Optional[float] = None
    file_count: Optional[int] = None


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    service: str
    version: str


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: Optional[str] = Field(None, description="User message")
    query: Optional[str] = Field(None, description="Query string for form submissions (alternative to message)")
    session_id: Optional[str] = Field(None, description="Chat session ID")
    project_id: Optional[str] = Field(None, description="Project ID to fetch metadata")
    repo_id: Optional[str] = Field(None, description="SCM Repository ID to fetch file tree")
    has_form_data: bool = Field(default=False, description="Whether form data is included")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Form submission data")
    is_form_submission: bool = Field(default=False, description="Whether this is a form submission")
    
    def get_message(self) -> str:
        """Get the message content, preferring query over message."""
        return self.query if self.query else (self.message or "")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    session_id: str
    type: str = Field(..., description="Response type: text, form, or options")
    response: Optional[str] = None
    message: Optional[str] = None
    content: Optional[str] = None
    form: Optional[Dict[str, Any]] = None
    options: Optional[List[Dict[str, str]]] = None
    requires_form: bool = False
    requires_options: bool = False


class FormField(BaseModel):
    """Form field definition."""
    name: str
    label: str
    type: str = Field(..., description="Field type: text, textarea, or select")
    required: bool = False
    placeholder: Optional[str] = None
    show_if: Optional[Dict[str, str]] = None


class TokenExchangeRequest(BaseModel):
    """Request model for token exchange."""
    token: str = Field(..., description="Login JWT token to exchange for chat token")


class TokenExchangeResponse(BaseModel):
    """Response model for token exchange."""
    chat_token: str = Field(..., description="Chat JWT token for LLM chat API")
    expires_in: int = Field(..., description="Token expiration time in seconds")


# ==================== Helper Functions ====================

def generate_session_id() -> str:
    """Generate a new session ID."""
    return f"jenkins-chat-{int(time.time() * 1000)}"


def extract_form_data(form_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract and validate form data from the frontend payload.
    
    For SCM type: Extracts repo_url, branch, output_filename from selected_repo
    For Manual type: Validates stack_details is provided
    
    Args:
        form_data: Form data dictionary from frontend
    
    Returns:
        Dictionary with extracted data: {
            "repo_url": str or None,
            "branch": str,
            "output_filename": str or None,
            "source_type": str,
            "stack_details": str or None
        }
    
    Raises:
        ValueError: If required fields are missing
    """
    logger.info("=" * 80)
    logger.info("extract_form_data() CALLED")
    logger.info(f"Input form_data keys: {list(form_data.keys()) if form_data else 'None'}")
    logger.info(f"Input form_data: {form_data}")
    
    source_type = form_data.get("source_type", "").strip()
    logger.info(f"Source type: '{source_type}'")
    
    if source_type == "SCM":
        # Extract from selected_repo object
        selected_repo = form_data.get("selected_repo")
        logger.info(f"selected_repo: {selected_repo}")
        logger.info(f"selected_repo type: {type(selected_repo)}")
        
        if not selected_repo:
            logger.error("Repository object not found in form data")
            raise ValueError("Repository object not found in form data")
        
        if not isinstance(selected_repo, dict):
            logger.error(f"selected_repo must be a dict, got {type(selected_repo)}")
            raise ValueError("selected_repo must be a valid object")
        
        logger.info(f"selected_repo keys: {list(selected_repo.keys())}")
        
        # Extract repo_url from selected_repo.http_url_to_repo
        repo_url = selected_repo.get("http_url_to_repo")
        logger.info(f"http_url_to_repo: '{repo_url}' (type: {type(repo_url)})")
        if not repo_url or not str(repo_url).strip():
            logger.error(f"Repository URL (http_url_to_repo) not found or empty. Value: '{repo_url}'")
            raise ValueError("Repository URL (http_url_to_repo) not found")
        
        # Extract output_filename from selected_repo.path_with_namespace
        output_filename = selected_repo.get("path_with_namespace")
        logger.info(f"path_with_namespace: '{output_filename}' (type: {type(output_filename)})")
        if not output_filename or not str(output_filename).strip():
            logger.error(f"Output filename (path_with_namespace) not found or empty. Value: '{output_filename}'")
            raise ValueError("Output filename (path_with_namespace) not found")
        
        # Get branch from form_data, default to "master/main"
        branch = form_data.get("branch", "master/main")
        if not branch or not str(branch).strip():
            branch = "master/main"
        logger.info(f"branch: '{branch}'")
        
        extracted = {
            "repo_url": str(repo_url).strip(),
            "branch": str(branch).strip(),
            "output_filename": str(output_filename).strip(),
            "source_type": "SCM",
            "stack_details": None
        }
        logger.info(f"✓ Extracted SCM data: {extracted}")
        logger.info("=" * 80)
        return extracted
    
    elif source_type == "Manual":
        # Validate stack_details
        stack_details = form_data.get("stack_details")
        logger.info(f"stack_details: '{stack_details}' (type: {type(stack_details)})")
        if not stack_details or not str(stack_details).strip():
            logger.error(f"Stack details not provided or empty. Value: '{stack_details}'")
            raise ValueError("Stack details not provided")
        
        extracted = {
            "repo_url": None,
            "branch": None,
            "output_filename": None,
            "source_type": "Manual",
            "stack_details": str(stack_details).strip()
        }
        logger.info(f"✓ Extracted Manual data: {extracted}")
        logger.info("=" * 80)
        return extracted
    
    else:
        logger.error(f"Invalid source_type: '{source_type}'. Must be 'SCM' or 'Manual'")
        raise ValueError(f"Invalid source_type: {source_type}. Must be 'SCM' or 'Manual'")


def construct_repo_identifier(form_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    """
    Construct repo_url or project_id from form data.
    
    Args:
        form_data: Form data dictionary containing repo_namespace, repo_name, etc.
    
    Returns:
        Tuple of (repo_url, project_id). One will be None.
        - If repo_url is provided directly, return (repo_url, None)
        - If repo_namespace and repo_name are provided, construct project_id and return (None, project_id)
        - If neither, return (None, None)
    """
    logger.info("-" * 80)
    logger.info("construct_repo_identifier() CALLED")
    logger.info(f"Input form_data: {form_data}")
    logger.info(f"Form data keys: {list(form_data.keys()) if form_data else 'None'}")
    logger.info(f"Form data type: {type(form_data)}")
    
    if not form_data:
        logger.warning("construct_repo_identifier: form_data is None or empty")
        logger.info("-" * 80)
        return None, None
    
    # Check if repo_url is already provided (and not empty)
    repo_url_value = form_data.get("repo_url")
    logger.info(f"Checking repo_url: '{repo_url_value}' (type: {type(repo_url_value)}, truthy: {bool(repo_url_value)}, stripped: '{str(repo_url_value).strip() if repo_url_value else None}')")
    
    if repo_url_value and str(repo_url_value).strip():
        logger.info(f"✓ Using provided repo_url: '{repo_url_value}'")
        logger.info("-" * 80)
        return str(repo_url_value).strip(), None
    
    # Check if we have repo_namespace and repo_name to construct project_id
    repo_namespace = form_data.get("repo_namespace")
    repo_name = form_data.get("repo_name")
    
    logger.info(f"Checking repo_namespace: '{repo_namespace}' (type: {type(repo_namespace)}, truthy: {bool(repo_namespace)})")
    logger.info(f"Checking repo_name: '{repo_name}' (type: {type(repo_name)}, truthy: {bool(repo_name)})")
    
    # Check if both are provided and not empty
    if repo_namespace and repo_name:
        repo_namespace = str(repo_namespace).strip()
        repo_name = str(repo_name).strip()
        
        logger.info(f"After stripping - repo_namespace: '{repo_namespace}', repo_name: '{repo_name}'")
        
        if repo_namespace and repo_name:
            # Construct project_id from namespace and name
            project_id = f"{repo_namespace}/{repo_name}"
            logger.info(f"✓ Constructed project_id from form data: '{project_id}'")
            logger.info("-" * 80)
            return None, project_id
        else:
            logger.warning(f"After stripping, one or both values are empty - repo_namespace: '{repo_namespace}', repo_name: '{repo_name}'")
    else:
        logger.warning(f"Missing required fields - repo_namespace: '{repo_namespace}', repo_name: '{repo_name}'")
    
    logger.warning(f"✗ Could not construct repo_url or project_id from form_data")
    logger.warning(f"Full form_data dump: {form_data}")
    logger.info("-" * 80)
    return None, None


def generate_chat_token(login_token: str, expires_in: int = 3600) -> str:
    """
    Generate a chat token from a validated login token.
    
    Args:
        login_token: Valid login JWT token
        expires_in: Token expiration time in seconds (default: 3600 = 1 hour)
    
    Returns:
        New chat JWT token
    
    Raises:
        ValueError: If login token is invalid
    """
    try:
        # Decode and validate the login token
        decoded = jwt.decode(login_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Create chat token with same user info but different expiration
        # Chat tokens are specifically for LLM chat API conversations
        payload = {
            "sub": decoded.get("sub", "user"),  # User identifier
            "type": "chat",  # Token type - must be "chat" for chat API
            "iat": int(time.time()),  # Issued at
            "exp": int(time.time()) + expires_in  # Expiration
        }
        
        # Generate new chat token
        chat_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return chat_token
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Login token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid login token: {str(e)}")


def validate_jwt_token(token: Optional[str] = None, authorization: Optional[str] = None, token_type: Optional[str] = "chat") -> bool:
    """
    Validate JWT token from query parameter or Authorization header.
    For SSE requests, query parameter is prioritized (EventSource can't send headers).
    For regular requests, Authorization header is preferred.
    
    Args:
        token: Token from query parameter (prioritized for SSE)
        authorization: Authorization header value
        token_type: Type of token to validate ("chat" for chat tokens, "login" for login tokens, None to accept any valid token)
    
    Returns:
        True if valid, False otherwise
    """
    # Priority: query parameter first (for SSE), then Authorization header
    extracted_token = None
    
    # First, try query parameter (for SSE requests)
    if token:
        extracted_token = token
    # Fallback to Authorization header if query param not available
    elif authorization and authorization.startswith("Bearer "):
        extracted_token = authorization[7:]
    
    if not extracted_token:
        logger.warning("No token provided in query parameter or Authorization header")
        return False
    
    try:
        decoded = jwt.decode(extracted_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Validate token type if specified
        if token_type == "chat":
            # For chat tokens, check if it's a chat token (type="chat" or no type specified for backward compatibility)
            token_type_in_payload = decoded.get("type", "chat")
            if token_type_in_payload != "chat":
                logger.warning(f"Token type mismatch: expected 'chat', got '{token_type_in_payload}'")
                return False
        elif token_type == "login":
            # For login tokens, accept tokens that are NOT chat tokens (or have type="login" or no type)
            token_type_in_payload = decoded.get("type", None)
            if token_type_in_payload == "chat":
                logger.warning("Login token expected, but received chat token")
                return False
        
        logger.debug(f"Token validated successfully (type: {decoded.get('type', 'unknown')})")
        return True
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return False
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error validating token: {str(e)}")
        return False


async def generate_chat_response(message: str, session_id: str, form_data: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Generate chat response based on user message.
    Handles pipeline generation from stored analysis if available.
    """
    message_lower = message.lower()
    
    # Check if user wants to generate Jenkinsfile from existing analysis
    pipeline_keywords = [
        "another pipeline", "create pipeline", "build pipeline", "generate pipeline", 
        "jenkins pipeline", "create jenkinsfile", "generate jenkinsfile", 
        "setup pipeline", "pipeline configuration", "make pipeline", 
        "new pipeline", "pipeline for", "ci/cd pipeline"
    ]
    
    wants_pipeline = any(keyword in message_lower for keyword in pipeline_keywords)
    
    # Check if analysis exists in session
    has_analysis = (
        session_id in sessions and 
        "last_analysis" in sessions[session_id] and
        sessions[session_id]["last_analysis"] is not None
    )
    
    # If user wants pipeline and analysis exists, generate Jenkinsfile
    if wants_pipeline and has_analysis:
        try:
            analysis_data = sessions[session_id]["last_analysis"]
            analysis_result = analysis_data.get("analysis_result")
            repo_url = analysis_data.get("repo_url")
            branch = analysis_data.get("branch", "main")
            
            logger.info(f"Generating Jenkinsfile for session: {session_id}, repo: {repo_url}")
            
            # Get conversation history for context
            conversation_history = sessions[session_id].get("messages", []) if session_id in sessions else []
            
            # Generate Jenkinsfile with conversation context
            jenkinsfile_content = generate_jenkinsfile(
                analysis_result=analysis_result,
                repo_url=repo_url,
                branch=branch,
                conversation_history=conversation_history
            )
            
            # CRITICAL: jenkinsfile_content from generator is ALREADY in markdown format
            # The frontend processes markdown, so we send markdown format directly
            formatted_content = jenkinsfile_content.strip()
            
            # Final safety check: ensure markdown format
            if not formatted_content.startswith('```groovy'):
                logger.warning("Jenkinsfile not in markdown format, forcing markdown wrapper")
                formatted_content = f"```groovy\n{formatted_content}\n```"
            if not formatted_content.rstrip().endswith('```'):
                formatted_content = formatted_content.rstrip() + '\n```'
            
            # Extract raw code (without markdown) ONLY for download/jenkinsfile field
            # The content field MUST be markdown format for frontend
            raw_code = formatted_content
            if formatted_content.startswith('```groovy'):
                lines = formatted_content.split('\n')
                if lines[0].strip().startswith('```'):
                    lines = lines[1:]
                if lines and lines[-1].strip() == '```':
                    lines = lines[:-1]
                raw_code = '\n'.join(lines).strip()
            
            logger.info(f"Jenkinsfile ready - SENDING MARKDOWN FORMAT to frontend")
            logger.info(f"  Markdown length: {len(formatted_content)} characters")
            logger.info(f"  Raw code length (for download): {len(raw_code)} characters")
            logger.info(f"  Format validation: starts with ```groovy={formatted_content.startswith('```groovy')}, ends with ```={formatted_content.rstrip().endswith('```')}")
            
            # Add to session history
            if session_id in sessions:
                sessions[session_id]["messages"].append({
                    "role": "assistant",
                    "content": formatted_content
                })
                if len(sessions[session_id]["messages"]) > 20:
                    sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
            
            return {
                "type": "text",
                "content": formatted_content,
                "response": formatted_content,
                "message": formatted_content,
                "jenkinsfile": raw_code  # Include raw Jenkinsfile code (without markdown) for download
            }
        except Exception as e:
            logger.error(f"Error generating Jenkinsfile: {str(e)}")
            return {
                "type": "text",
                "content": f"Error generating Jenkinsfile: {str(e)}",
                "response": f"Error: {str(e)}",
                "message": f"Error: {str(e)}"
            }
    
    # Check if form submission
    # Check if we have repo_url OR (repo_namespace AND repo_name) - all must be non-empty
    has_repo_url = form_data and form_data.get("repo_url") and str(form_data.get("repo_url")).strip()
    has_namespace_and_name = (
        form_data and 
        form_data.get("repo_namespace") and str(form_data.get("repo_namespace")).strip() and
        form_data.get("repo_name") and str(form_data.get("repo_name")).strip()
    )
    
    if form_data and (has_repo_url or has_namespace_and_name):
        # Construct repo_url or project_id from form data
        repo_url, project_id = construct_repo_identifier(form_data)
        
        if not repo_url and not project_id:
            return {
                "type": "text",
                "content": "Error: Either repo_url or project_id must be provided. Please select a repository and try again.",
                "response": "Error: Either repo_url or project_id must be provided. Please select a repository and try again.",
                "message": "Error: Either repo_url or project_id must be provided. Please select a repository and try again."
            }
        
        branch = form_data.get("branch", "main")
        output_filename = form_data.get("output_filename")
        
        try:
            # Download repository
            output_file = download_repository_zip(
                repo_url=repo_url,
                project_id=project_id,
                branch=branch,
                output_filename=output_filename
            )
            
            # Analyze codebase (placeholder - integrate with techstack_analyzer)
            # For now, just confirm download
            analysis = "Repository downloaded successfully."
            
            return {
                "type": "text",
                "content": f"{analysis}\n\nRepository: {repo_url}\nBranch: {branch}\nDownloaded to: {output_file}",
                "response": analysis,
                "message": analysis
            }
        except Exception as e:
            return {
                "type": "text",
                "content": f"Error processing repository: {str(e)}",
                "response": f"Error: {str(e)}",
                "message": f"Error: {str(e)}"
            }
    
    # Check for keywords to determine response type
    # Only show form if user wants pipeline but NO analysis exists
    if wants_pipeline and not has_analysis:
        # Return form for repository information
        return {
            "type": "form",
            "content": "I'll help you generate a Jenkins pipeline. Please provide the repository details.",
            "response": "I'll help you generate a Jenkins pipeline. Please provide the repository details.",
            "message": "I'll help you generate a Jenkins pipeline. Please provide the repository details.",
            "form": {
                "fields": [
                    {
                        "name": "source_type",
                        "label": "Source Type",
                        "type": "select",
                        "required": True,
                        "show_if": None
                    },
                    {
                        "name": "scm_cred_id",
                        "label": "SCM Credentials",
                        "type": "select",
                        "required": False,
                        "show_if": {
                            "field": "source_type",
                            "value": "SCM"
                        }
                    },
                    {
                        "name": "repo_namespace",
                        "label": "Repository Namespace",
                        "type": "select",
                        "required": False,
                        "show_if": {
                            "field": "source_type",
                            "value": "SCM"
                        }
                    },
                    {
                        "name": "repo_name",
                        "label": "Repository Name",
                        "type": "text",
                        "required": False,
                        "placeholder": "Search repositories...",
                        "show_if": {
                            "field": "source_type",
                            "value": "SCM"
                        }
                    },
                    {
                        "name": "branch",
                        "label": "Branch",
                        "type": "text",
                        "required": False,
                        "placeholder": "master/main",
                        "show_if": {
                            "field": "source_type",
                            "value": "SCM"
                        }
                    },
                    {
                        "name": "stack_details",
                        "label": "Stack Details",
                        "type": "textarea",
                        "required": False,
                        "placeholder": "Enter stack details (e.g., Node.js, Python, Java, etc.)",
                        "show_if": {
                            "field": "source_type",
                            "value": "Manual"
                        }
                    }
                ],
                "submit_button_text": "Generate Pipeline"
            },
            "requires_form": True
        }
    elif any(keyword in message_lower for keyword in ["option", "choose", "select"]):
        # Return options
        return {
            "type": "options",
            "content": "Please select an option:",
            "response": "Please select an option:",
            "message": "Please select an option:",
            "options": [
                {"label": "Option 1", "value": "option1"},
                {"label": "Option 2", "value": "option2"}
            ],
            "requires_options": True
        }
    else:
        # Regular text response - use LangGraph if available, otherwise LLM
        if is_langgraph_available():
            try:
                result = await process_chat_message(message, session_id, sessions, form_data)
                return {
                    "type": result.get("type", "text"),
                    "content": result.get("content", ""),
                    "response": result.get("response", ""),
                    "message": result.get("message", ""),
                    "form": result.get("form"),
                    "requires_form": result.get("requires_form", False)
                }
            except Exception as e:
                logger.error(f"LangGraph error: {str(e)}")
                # Fallback to LLM
                if is_llm_available():
                    try:
                        llm_response = await get_llm_response(message, session_id, sessions)
                    except Exception as llm_error:
                        logger.error(f"LLM fallback error: {str(llm_error)}")
                        return {
                            "type": "text",
                            "content": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                            "response": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                            "message": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?"
                        }
        elif is_llm_available():
            try:
                llm_response = await get_llm_response(message, session_id, sessions)
                
                # Check if LLM response indicates form request
                requires_form = False
                form_structure = None
                response_message = llm_response
                
                # Check for form request marker or pipeline creation intent
                response_lower = llm_response.lower()
                has_form_marker = "__FORM_REQUEST__" in llm_response
                is_pipeline_request = any(keyword in response_lower for keyword in [
                    "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline",
                    "create jenkinsfile", "generate jenkinsfile", "setup pipeline", "pipeline configuration",
                    "fill out the form", "fill out form", "please fill", "form below"
                ])
                
                # Also check the original user message for pipeline intent
                message_lower = message.lower()
                user_wants_pipeline = any(keyword in message_lower for keyword in [
                    "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline",
                    "create jenkinsfile", "generate jenkinsfile", "setup pipeline", "pipeline configuration",
                    "make pipeline", "new pipeline", "pipeline for", "ci/cd pipeline"
                ])
                
                # Check if form was already submitted/processed - don't show form again
                has_analysis = (
                    session_id in sessions and 
                    "last_analysis" in sessions[session_id] and
                    sessions[session_id]["last_analysis"] is not None
                )
                
                # If form marker found or pipeline request detected, return form
                # But only if form hasn't been submitted/processed yet
                if (has_form_marker or (is_pipeline_request and user_wants_pipeline)) and not has_analysis:
                    requires_form = True
                    form_structure = {
                        "title": "Pipeline Configuration",
                        "fields": [
                            {
                                "name": "source_type",
                                "label": "Source Type",
                                "type": "select",
                                "required": True,
                                "options": [
                                    {"value": "SCM", "label": "SCM (Source Control Management)"},
                                    {"value": "Manual", "label": "Manual Entry"}
                                ]
                            },
                            {
                                "name": "scm_cred_id",
                                "label": "SCM Credentials",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "repo_namespace",
                                "label": "Repository Namespace",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "repo_name",
                                "label": "Repository Name",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "branch",
                                "label": "Branch",
                                "type": "text",
                                "required": False,
                                "placeholder": "master/main",
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "stack_details",
                                "label": "Stack Details",
                                "type": "textarea",
                                "required": False,
                                "placeholder": "Enter stack details (e.g., Node.js, Python, Java, etc.)",
                                "show_if": {
                                    "field": "source_type",
                                    "value": "Manual"
                                }
                            }
                        ],
                        "submit_button_text": "Generate Pipeline"
                    }
                    
                    # Extract message text (remove form marker if present)
                    response_message = llm_response.replace("__FORM_REQUEST__", "").strip()
                    if not response_message or len(response_message) < 10:
                        response_message = "I'll help you create a Jenkins pipeline! To generate the perfect pipeline for your project, I need some information. Please fill out the form below with your project details."
                
                update_session_history(session_id, sessions, message, llm_response)
                
                if requires_form:
                    return {
                        "type": "form",
                        "content": response_message,
                        "response": response_message,
                        "message": response_message,
                        "form": form_structure,
                        "requires_form": True
                    }
                else:
                    return {
                        "type": "text",
                        "content": llm_response,
                        "response": llm_response,
                        "message": llm_response
                    }
            except Exception as e:
                logger.error(f"LLM error: {str(e)}")
                # Fallback to default response
                return {
                    "type": "text",
                    "content": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                    "response": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                    "message": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?"
                }
        else:
            # Fallback response when LLM is not available
            return {
                "type": "text",
                "content": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                "response": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?",
                "message": f"I understand you said: {message}. How can I help you with Jenkins pipeline generation?"
            }


async def stream_chat_response(message: str, session_id: str, form_data: Optional[Dict] = None):
    """
    Generator function for streaming chat responses via SSE.
    Handles the full conversation flow:
    1. Receives user message
    2. Passes to LLM with conversation history
    3. Streams LLM response back to user
    4. Updates session history
    """
    try:
        # Check if this is a form submission
        if form_data:
            try:
                # Extract and validate form data
                extracted_data = extract_form_data(form_data)
                source_type = extracted_data.get("source_type")
                
                # Handle SCM type - download and analyze repository
                if source_type == "SCM":
                    # Extract http_url_to_repo directly from selected_repo
                    repo_url = extracted_data.get("repo_url")  # This is http_url_to_repo from selected_repo
                    branch = extracted_data.get("branch", "master/main")
                    output_filename = extracted_data.get("output_filename")
                    
                    logger.info(f"Processing SCM form submission - repo_url (http_url_to_repo): {repo_url}, branch: {branch}, output_filename: {output_filename}")
                    
                    # Pass http_url_to_repo directly to download_repository_zip
                    # It will parse the URL and use credentials from environment variables
                    
                elif source_type == "Manual":
                    # Handle Manual type - use stack_details for pipeline generation
                    stack_details = extracted_data.get("stack_details")
                    logger.info(f"Processing Manual form submission - stack_details: {stack_details}")
                    
                    # For Manual type, we don't download a repository
                    # Store stack_details in session for later pipeline generation
                    if session_id in sessions:
                        sessions[session_id]["last_analysis"] = {
                            "analysis_result": f"Manual entry - Stack details: {stack_details}",
                            "repo_url": None,
                            "branch": None,
                            "stack_details": stack_details,
                            "source_type": "Manual",
                            "timestamp": time.time()
                        }
                    
                    # Return success message
                    done_event = {
                        "type": "done",
                        "content": f"Stack details received: {stack_details}. You can now generate a pipeline based on these details.",
                        "response_type": "text",
                        "session_id": session_id,
                        "requires_form": False
                    }
                    yield f"data: {json.dumps(done_event)}\n\n"
                    return
                
                else:
                    error_event = {
                        "type": "error",
                        "message": f"Invalid source_type: {source_type}"
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
                    return
                    
            except ValueError as e:
                error_event = {
                    "type": "error",
                    "message": str(e)
                }
                yield f"data: {json.dumps(error_event)}\n\n"
                return
            except Exception as e:
                logger.error(f"Error extracting form data: {str(e)}")
                error_event = {
                    "type": "error",
                    "message": f"Error processing form data: {str(e)}"
                }
                yield f"data: {json.dumps(error_event)}\n\n"
                return
            
            # Continue with SCM repository download and analysis
            if source_type == "SCM":
                # Stream initial message
                initial_chunk = {
                    "type": "chunk",
                    "content": "Downloading repository... "
                }
                yield f"data: {json.dumps(initial_chunk)}\n\n"
                await asyncio.sleep(0.1)
                
                try:
                    # Step 1: Download repository (saves locally)
                    # Pass http_url_to_repo directly - download_repository_zip will parse it and use credentials from env
                    logger.info(f"Step 1: Downloading repository using http_url_to_repo: {repo_url}, branch: {branch}")
                    output_file = download_repository_zip(
                        repo_url=repo_url,  # This is the http_url_to_repo from selected_repo
                        branch=branch,
                        output_filename=output_filename
                    )
                    logger.info(f"Repository downloaded and saved to: {output_file}")
                    
                    # Stream download confirmation
                    download_chunk = {
                        "type": "chunk",
                        "content": f"Repository downloaded successfully. Analyzing tech stack... "
                    }
                    yield f"data: {json.dumps(download_chunk)}\n\n"
                    await asyncio.sleep(0.1)
                    
                    # Step 2: Analyze codebase using techstack_analyzer
                    logger.info(f"Step 2: Analyzing codebase from {output_file}")
                    analysis_result = analyze_codebase(output_file)
                    logger.info(f"Analysis completed - result length: {len(analysis_result)} characters")
                    
                    # Check if analysis result contains code blocks
                    # If it contains markdown code blocks, send at once for proper rendering
                    has_code_blocks = '```' in analysis_result
                    
                    if has_code_blocks:
                        # Send complete response at once if it contains code blocks
                        chunk = {
                            "type": "chunk",
                            "content": analysis_result
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                        await asyncio.sleep(0.1)
                    else:
                        # Stream text responses word by word
                        words = analysis_result.split()
                        accumulated = ""
                        for word in words:
                            accumulated += word + " "
                            chunk = {
                                "type": "chunk",
                                "content": word + " "
                            }
                            yield f"data: {json.dumps(chunk)}\n\n"
                            await asyncio.sleep(0.03)  # Small delay for streaming effect
                    
                    # Store analysis result in session for later pipeline generation
                    if session_id in sessions:
                        sessions[session_id]["messages"].append({
                            "role": "assistant",
                            "content": analysis_result
                        })
                        # Store analysis data for pipeline generation
                        sessions[session_id]["last_analysis"] = {
                            "analysis_result": analysis_result,
                            "repo_url": repo_url,  # This is the http_url_to_repo from selected_repo
                            "branch": branch,
                            "output_file": output_file,
                            "output_filename": output_filename,
                            "source_type": "SCM",
                            "timestamp": time.time()
                        }
                        # Keep only last 20 messages
                        if len(sessions[session_id]["messages"]) > 20:
                            sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
                    
                    # Send final done event with complete analysis
                    done_event = {
                        "type": "done",
                        "content": analysis_result,
                        "response_type": "text",
                        "session_id": session_id,
                        "requires_form": False
                    }
                    yield f"data: {json.dumps(done_event)}\n\n"
                    
                except Exception as e:
                    logger.error(f"Error processing repository: {str(e)}")
                    error_event = {
                        "type": "error",
                        "message": f"Error processing repository: {str(e)}"
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
        else:
            # Check if user wants to generate Jenkinsfile from existing analysis
            message_lower = message.lower()
            pipeline_keywords = [
                "another pipeline", "create pipeline", "build pipeline", "generate pipeline", 
                "jenkins pipeline", "create jenkinsfile", "generate jenkinsfile", 
                "setup pipeline", "pipeline configuration", "make pipeline", 
                "new pipeline", "pipeline for", "ci/cd pipeline"
            ]
            
            wants_pipeline = any(keyword in message_lower for keyword in pipeline_keywords)
            
            # Check if analysis exists in session
            has_analysis = (
                session_id in sessions and 
                "last_analysis" in sessions[session_id] and
                sessions[session_id]["last_analysis"] is not None
            )
            
            # If user wants pipeline and analysis exists, generate Jenkinsfile
            if wants_pipeline and has_analysis:
                analysis_data = sessions[session_id]["last_analysis"]
                analysis_result = analysis_data.get("analysis_result")
                repo_url = analysis_data.get("repo_url")
                branch = analysis_data.get("branch", "main")
                
                logger.info(f"Generating Jenkinsfile for session: {session_id}, repo: {repo_url}")
                
                # Stream initial message
                initial_chunk = {
                    "type": "chunk",
                    "content": "Generating Jenkinsfile based on your codebase analysis... "
                }
                yield f"data: {json.dumps(initial_chunk)}\n\n"
                await asyncio.sleep(0.1)
                
                try:
                    # Get conversation history for context
                    conversation_history = sessions[session_id].get("messages", []) if session_id in sessions else []
                    
                    # Generate Jenkinsfile with conversation context
                    jenkinsfile_content = generate_jenkinsfile(
                        analysis_result=analysis_result,
                        repo_url=repo_url,
                        branch=branch,
                        conversation_history=conversation_history
                    )
                    
                    logger.info(f"Jenkinsfile generated successfully - length: {len(jenkinsfile_content)} characters")
                    
                    # Stream Jenkinsfile content
                    # CRITICAL: jenkinsfile_content from generator is ALREADY in markdown format
                    # The frontend processes markdown, so we send markdown format directly
                    formatted_content = jenkinsfile_content.strip()
                    
                    # Final safety check: ensure markdown format
                    if not formatted_content.startswith('```groovy'):
                        logger.warning("Jenkinsfile not in markdown format, forcing markdown wrapper")
                        formatted_content = f"```groovy\n{formatted_content}\n```"
                    if not formatted_content.rstrip().endswith('```'):
                        formatted_content = formatted_content.rstrip() + '\n```'
                    
                    # Extract raw code (without markdown) ONLY for download/jenkinsfile field
                    # The content field MUST be markdown format for frontend
                    raw_code = formatted_content
                    if formatted_content.startswith('```groovy'):
                        lines = formatted_content.split('\n')
                        if lines[0].strip().startswith('```'):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == '```':
                            lines = lines[:-1]
                        raw_code = '\n'.join(lines).strip()
                    
                    logger.info(f"Jenkinsfile ready - SENDING COMPLETE MARKDOWN FORMAT to frontend at once")
                    logger.info(f"  Markdown length: {len(formatted_content)} characters")
                    logger.info(f"  Raw code length (for download): {len(raw_code)} characters")
                    logger.info(f"  Format validation: starts with ```groovy={formatted_content.startswith('```groovy')}, ends with ```={formatted_content.rstrip().endswith('```')}")
                    
                    # Send complete code response at once (not in chunks)
                    # Code blocks need to be complete for proper markdown rendering
                    chunk = {
                        "type": "chunk",
                        "content": formatted_content  # Send complete markdown code block at once
                    }
                    yield f"data: {json.dumps(chunk)}\n\n"
                    await asyncio.sleep(0.1)  # Small delay to ensure chunk is sent
                    
                    # Add assistant response to session history
                    if session_id in sessions:
                        sessions[session_id]["messages"].append({
                            "role": "assistant",
                            "content": formatted_content
                        })
                        if len(sessions[session_id]["messages"]) > 20:
                            sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
                    
                    # Send final done event
                    done_event = {
                        "type": "done",
                        "content": formatted_content,
                        "response_type": "text",
                        "session_id": session_id,
                        "requires_form": False,
                        "jenkinsfile": raw_code  # Include raw Jenkinsfile code (without markdown) for download
                    }
                    yield f"data: {json.dumps(done_event)}\n\n"
                    
                except Exception as e:
                    logger.error(f"Error generating Jenkinsfile: {str(e)}")
                    error_event = {
                        "type": "error",
                        "message": f"Error generating Jenkinsfile: {str(e)}"
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
            
            # Regular chat response - use LangGraph if available, otherwise LLM streaming
            elif is_langgraph_available() and not form_data:
                # Use LangGraph workflow for conversation flow
                # Process the message through the workflow first to get the full response
                try:
                    result = await process_chat_message(message, session_id, sessions, form_data)
                    requires_form = result.get("requires_form", False)
                    form_structure = result.get("form")
                    full_response = result.get("content", "")
                    
                    # If we have a form, send initial message then form
                    if requires_form:
                        # Send initial message as a chunk for better UX
                        if full_response:
                            initial_chunk = {
                                "type": "chunk",
                                "content": full_response
                            }
                            yield f"data: {json.dumps(initial_chunk)}\n\n"
                            await asyncio.sleep(0.1)
                        
                        # Send done event with form structure
                        done_event = {
                            "type": "done",
                            "content": full_response,
                            "response_type": "form",
                            "session_id": session_id,
                            "requires_form": True,
                            "form": form_structure
                        }
                        yield f"data: {json.dumps(done_event)}\n\n"
                        # Keep connection alive briefly to ensure event is sent
                        await asyncio.sleep(0.1)
                    else:
                        # Check if response contains code blocks
                        # If it contains markdown code blocks, send at once for proper rendering
                        has_code_blocks = '```' in full_response
                        
                        if has_code_blocks:
                            # Send complete response at once if it contains code blocks
                            chunk = {
                                "type": "chunk",
                                "content": full_response
                            }
                            yield f"data: {json.dumps(chunk)}\n\n"
                            await asyncio.sleep(0.1)
                        else:
                            # Stream text responses word by word for better UX
                            words = full_response.split()
                            accumulated_response = ""
                            for word in words:
                                accumulated_response += word + " "
                                chunk = {
                                    "type": "chunk",
                                    "content": word + " "
                                }
                                yield f"data: {json.dumps(chunk)}\n\n"
                                await asyncio.sleep(0.02)  # Small delay for streaming effect
                        
                        # Add assistant response to session history (already added in process_chat_message)
                        logger.info(f"LangGraph response completed for session: {session_id}, length: {len(full_response)}, requires_form: {requires_form}")
                        
                        # Send final done event
                        done_event = {
                            "type": "done",
                            "content": full_response,
                            "response_type": "text",
                            "session_id": session_id,
                            "requires_form": False
                        }
                        yield f"data: {json.dumps(done_event)}\n\n"
                        
                except Exception as e:
                    logger.error(f"Error processing LangGraph result: {e}")
                    error_event = {
                        "type": "error",
                        "message": f"Error processing message: {str(e)}"
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
            elif is_llm_available() and not form_data:
                # Use LLM streaming for normal conversations
                # The user message is already added to session in the endpoint
                # Now stream the LLM response with conversation history
                accumulated_response = ""
                
                logger.info(f"Streaming LLM response for session: {session_id}, message: {message[:50]}...")
                
                # Stream LLM response chunk by chunk
                # Accumulate all chunks first to check if it contains code blocks
                accumulated_response = ""
                chunks_list = []
                async for chunk_text in stream_llm_response(message, session_id, sessions):
                    accumulated_response += chunk_text
                    chunks_list.append(chunk_text)
                
                # Check if accumulated response contains code blocks
                has_code_blocks = '```' in accumulated_response
                
                if has_code_blocks:
                    # Send complete response at once if it contains code blocks
                    chunk = {
                        "type": "chunk",
                        "content": accumulated_response
                    }
                    yield f"data: {json.dumps(chunk)}\n\n"
                    await asyncio.sleep(0.1)
                else:
                    # Stream text responses chunk by chunk
                    for chunk_text in chunks_list:
                        chunk = {
                            "type": "chunk",
                            "content": chunk_text
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                        # No artificial delay - stream as fast as LLM provides
                
                # Check if LLM response indicates form request
                # Look for the form request marker or pipeline-related keywords
                requires_form = False
                form_structure = None
                
                # Check for form request marker or pipeline creation intent
                response_lower = accumulated_response.lower()
                has_form_marker = "__FORM_REQUEST__" in accumulated_response
                is_pipeline_request = any(keyword in response_lower for keyword in [
                    "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline",
                    "create jenkinsfile", "generate jenkinsfile", "setup pipeline", "pipeline configuration",
                    "fill out the form", "fill out form", "please fill", "form below"
                ])
                
                # Also check the original user message for pipeline intent
                message_lower = message.lower()
                user_wants_pipeline = any(keyword in message_lower for keyword in [
                    "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline",
                    "create jenkinsfile", "generate jenkinsfile", "setup pipeline", "pipeline configuration",
                    "make pipeline", "new pipeline", "pipeline for", "ci/cd pipeline"
                ])
                
                # Check if form was already submitted/processed - don't show form again
                has_analysis = (
                    session_id in sessions and 
                    "last_analysis" in sessions[session_id] and
                    sessions[session_id]["last_analysis"] is not None
                )
                
                # If form marker found or pipeline request detected, return form
                # But only if form hasn't been submitted/processed yet
                if (has_form_marker or (is_pipeline_request and user_wants_pipeline)) and not has_analysis:
                    requires_form = True
                    form_structure = {
                        "title": "Pipeline Configuration",
                        "fields": [
                            {
                                "name": "source_type",
                                "label": "Source Type",
                                "type": "select",
                                "required": True,
                                "options": [
                                    {"value": "SCM", "label": "SCM (Source Control Management)"},
                                    {"value": "Manual", "label": "Manual Entry"}
                                ]
                            },
                            {
                                "name": "scm_cred_id",
                                "label": "SCM Credentials",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "repo_namespace",
                                "label": "Repository Namespace",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "repo_name",
                                "label": "Repository Name",
                                "type": "select",
                                "required": False,
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "branch",
                                "label": "Branch",
                                "type": "text",
                                "required": False,
                                "placeholder": "master/main",
                                "show_if": {
                                    "field": "source_type",
                                    "value": "SCM"
                                }
                            },
                            {
                                "name": "stack_details",
                                "label": "Stack Details",
                                "type": "textarea",
                                "required": False,
                                "placeholder": "Enter stack details (e.g., Node.js, Python, Java, etc.)",
                                "show_if": {
                                    "field": "source_type",
                                    "value": "Manual"
                                }
                            }
                        ],
                        "submit_button_text": "Generate Pipeline"
                    }
                    
                    # Extract message text (remove form marker if present)
                    form_message = accumulated_response.replace("__FORM_REQUEST__", "").strip()
                    if not form_message or len(form_message) < 10:
                        form_message = "I'll help you create a Jenkins pipeline! To generate the perfect pipeline for your project, I need some information. Please fill out the form below with your project details."
                
                # Add assistant response to session history
                # Note: user message was already added in the endpoint
                if session_id in sessions:
                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": accumulated_response
                    })
                    # Keep only last 20 messages
                    if len(sessions[session_id]["messages"]) > 20:
                        sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
                
                logger.info(f"LLM response completed for session: {session_id}, length: {len(accumulated_response)}, requires_form: {requires_form}")
                
                # If form is required, send initial message first
                if requires_form and form_message:
                    initial_chunk = {
                        "type": "chunk",
                        "content": form_message
                    }
                    yield f"data: {json.dumps(initial_chunk)}\n\n"
                    await asyncio.sleep(0.1)
                
                # Send final done event
                done_event = {
                    "type": "done",
                    "content": form_message if requires_form else accumulated_response,
                    "response_type": "form" if requires_form else "text",
                    "session_id": session_id,
                    "requires_form": requires_form,
                    "form": form_structure if requires_form else None
                }
                yield f"data: {json.dumps(done_event)}\n\n"
                # Keep connection alive briefly to ensure event is sent
                await asyncio.sleep(0.1)
            else:
                # Fallback to regular response generation
                response_data = await generate_chat_response(message, session_id, form_data)
                
                # Get content
                content = response_data.get("content", response_data.get("response", ""))
                
                # Check if content contains code blocks
                # If it contains markdown code blocks, send at once for proper rendering
                has_code_blocks = '```' in content
                
                if has_code_blocks:
                    # Send complete response at once if it contains code blocks
                    chunk = {
                        "type": "chunk",
                        "content": content
                    }
                    yield f"data: {json.dumps(chunk)}\n\n"
                    await asyncio.sleep(0.1)
                else:
                    # Stream text responses word by word
                    words = content.split()
                    for word in words:
                        chunk = {
                            "type": "chunk",
                            "content": word + " "
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                        await asyncio.sleep(0.05)  # Small delay to simulate streaming
                
                # Add assistant response to session history
                # Note: user message was already added in the endpoint
                if session_id in sessions:
                    sessions[session_id]["messages"].append({
                        "role": "assistant",
                        "content": content
                    })
                    # Keep only last 20 messages
                    if len(sessions[session_id]["messages"]) > 20:
                        sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
                
                # Send final done event
                done_event = {
                    "type": "done",
                    "content": content,
                    "response_type": response_data.get("type", "text"),
                    "session_id": session_id,
                    "form": response_data.get("form"),
                    "options": response_data.get("options"),
                    "requires_form": response_data.get("requires_form", False)
                }
                yield f"data: {json.dumps(done_event)}\n\n"
                # Keep connection alive briefly to ensure event is sent
                await asyncio.sleep(0.1)
        
    except Exception as e:
        error_event = {
            "type": "error",
            "message": str(e)
        }
        yield f"data: {json.dumps(error_event)}\n\n"


# ==================== Endpoints ====================

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check."""
    return HealthResponse(
        status="healthy",
        service="Jenkins Code Generator API",
        version="1.0.0"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="Jenkins Code Generator API",
        version="1.0.0"
    )


@app.post("/api/jenkins/auth/token", response_model=TokenExchangeResponse)
async def exchange_token(
    request: Optional[TokenExchangeRequest] = None,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Exchange login token for chat token.
    POST /api/jenkins/auth/token
    
    This endpoint validates a login JWT token and returns a chat token
    specifically for the LLM chat API. The chat token has a default
    expiration of 1 hour (3600 seconds).
    
    Token can be provided in:
    1. Request Body (preferred):
       {
           "token": "login_jwt_token"
       }
    2. Authorization Header (alternative):
       Authorization: Bearer {login_jwt_token}
    
    Response:
    {
        "chat_token": "llm_chat_jwt_token",
        "expires_in": 3600
    }
    """
    try:
        # Extract token from body or Authorization header
        login_token = None
        
        if request and request.token:
            login_token = request.token
            logger.info("Token exchange request received - token from body")
        elif authorization and authorization.startswith("Bearer "):
            login_token = authorization[7:]
            logger.info("Token exchange request received - token from Authorization header")
        else:
            logger.warning("Token exchange failed: No token provided in body or Authorization header")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Token required",
                    "message": "Token must be provided in request body as 'token' field or in Authorization header as 'Bearer {token}'",
                    "example_body": {"token": "your_login_jwt_token"},
                    "example_header": "Authorization: Bearer your_login_jwt_token"
                }
            )
        
        # Validate that token is not empty
        if not login_token or not login_token.strip():
            logger.warning("Token exchange failed: Empty token provided")
            raise HTTPException(status_code=400, detail="Token is required and cannot be empty")
        
        # Validate the login token first (accept login tokens for exchange)
        if not validate_jwt_token(token=login_token, token_type="login"):
            logger.warning("Token exchange failed: Invalid login token")
            raise HTTPException(status_code=401, detail="Invalid or expired login token")
        
        # Generate chat token (default 1 hour expiration)
        expires_in = 3600  # 1 hour
        chat_token = generate_chat_token(login_token, expires_in)
        
        logger.info(f"Token exchange successful - expires in {expires_in} seconds")
        
        return TokenExchangeResponse(
            chat_token=chat_token,
            expires_in=expires_in
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 401) without modification
        raise
    except ValueError as e:
        logger.error(f"Token exchange error: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during token exchange: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during token exchange")


@app.post("/api/jenkins/chat/stream")
async def chat_stream_post(
    request: ChatRequest,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    SSE streaming endpoint for chat responses (POST method).
    POST /api/jenkins/chat/stream
    
    Accepts form submissions with form_data in request body:
    {
        "query": "submit",
        "session_id": "jenkins-chat-{timestamp}",
        "is_form_submission": true,
        "form_data": {
            "repo_url": "http_url_to_repo",
            "branch": "master/main",
            "output_filename": "path_with_namespace"
        }
    }
    
    For regular chat:
    {
        "message": "user message",
        "session_id": "jenkins-chat-{timestamp}"
    }
    
    Authentication via Authorization header: Bearer {token}
    """
    # Log authentication attempt
    has_auth_header = authorization is not None
    logger.info(f"POST SSE request - has_auth_header: {has_auth_header}, session_id: {request.session_id}")
    
    # Validate authentication - for POST, use Authorization header
    # For POST chat, we only accept chat tokens (not login tokens)
    if not validate_jwt_token(None, authorization, token_type="chat"):
        logger.warning(f"POST SSE authentication failed - auth header: {has_auth_header}")
        async def error_stream():
            error_event = {"type": "error", "message": "Unauthorized"}
            yield f"data: {json.dumps(error_event)}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    logger.info(f"POST SSE authentication successful for session: {request.session_id}")
    
    # Generate or use session ID
    session_id = request.session_id or generate_session_id()
    
    # Initialize session if needed
    if session_id not in sessions:
        sessions[session_id] = {"messages": []}
        
        # Fetch project_info if project_id is provided
        auth_token = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
        if request.project_id:
            try:
                if auth_token:
                    project_info = await project_client.get_project(request.project_id, auth_token)
                    if project_info:
                        sessions[session_id]["project_info"] = project_info
                        logger.info(f"Loaded project metadata for project {request.project_id}")
            except Exception as e:
                logger.warning(f"Could not fetch project metadata: {e}")
                
            try:
                if auth_token:
                    existing_resources = await project_client.get_project_resources(request.project_id, auth_token)
                    if existing_resources:
                        sessions[session_id]["existing_resources"] = existing_resources
                        logger.info(f"Loaded {len(existing_resources)} existing resources for project {request.project_id}")
            except Exception as e:
                logger.warning(f"Could not fetch existing resources: {e}")

        # Fetch repo_tree if repo_id is provided
        if request.repo_id and auth_token:
            try:
                import httpx
                scm_url = f"{os.getenv('SCM_SERVICE_URL', 'http://localhost:8006')}/api/scm/repos/{request.repo_id}/tree"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(scm_url, headers={"Authorization": f"Bearer {auth_token}"})
                    if resp.status_code == 200:
                        sessions[session_id]["repo_tree"] = resp.json()
                        logger.info(f"Loaded repo tree for repo {request.repo_id}")
                    else:
                        logger.warning(f"Failed to fetch repo tree: {resp.text}")
            except Exception as e:
                logger.warning(f"Could not fetch repo tree: {e}")
    
    # Determine message content - use query if provided, otherwise message
    user_message = request.get_message()
    
    if not user_message:
        async def error_stream():
            error_event = {"type": "error", "message": "Either 'message' or 'query' field is required"}
            yield f"data: {json.dumps(error_event)}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    # Prepare form_data if this is a form submission
    form_data = None
    if request.is_form_submission and request.form_data:
        form_data = request.form_data
        logger.info("=" * 80)
        logger.info("FORM SUBMISSION RECEIVED (POST SSE - is_form_submission)")
        logger.info(f"Full request payload: {request.dict()}")
        logger.info(f"Form data keys: {list(form_data.keys())}")
        logger.info(f"Form data values: {form_data}")
        logger.info(f"Form data type: {type(form_data)}")
        logger.info(f"repo_url: '{form_data.get('repo_url')}' (type: {type(form_data.get('repo_url'))})")
        logger.info(f"repo_namespace: '{form_data.get('repo_namespace')}' (type: {type(form_data.get('repo_namespace'))})")
        logger.info(f"repo_name: '{form_data.get('repo_name')}' (type: {type(form_data.get('repo_name'))})")
        logger.info(f"branch: '{form_data.get('branch')}'")
        logger.info(f"output_filename: '{form_data.get('output_filename')}'")
        logger.info(f"source_type: '{form_data.get('source_type')}'")
        logger.info("=" * 80)
    elif request.has_form_data and request.form_data:
        form_data = request.form_data
        logger.info("=" * 80)
        logger.info("FORM SUBMISSION RECEIVED (POST SSE - has_form_data)")
        logger.info(f"Full request payload: {request.dict()}")
        logger.info(f"Form data keys: {list(form_data.keys())}")
        logger.info(f"Form data values: {form_data}")
        logger.info(f"Form data type: {type(form_data)}")
        logger.info(f"repo_url: '{form_data.get('repo_url')}' (type: {type(form_data.get('repo_url'))})")
        logger.info(f"repo_namespace: '{form_data.get('repo_namespace')}' (type: {type(form_data.get('repo_namespace'))})")
        logger.info(f"repo_name: '{form_data.get('repo_name')}' (type: {type(form_data.get('repo_name'))})")
        logger.info(f"branch: '{form_data.get('branch')}'")
        logger.info(f"output_filename: '{form_data.get('output_filename')}'")
        logger.info(f"source_type: '{form_data.get('source_type')}'")
        logger.info("=" * 80)
    
    # Log what we're checking for
    if form_data:
        logger.info(f"Form data validation check - repo_url: {form_data.get('repo_url')}, repo_namespace: {form_data.get('repo_namespace')}, repo_name: {form_data.get('repo_name')}")
    
    # Add user message to session
    sessions[session_id]["messages"].append({"role": "user", "content": user_message})
    
    # Return SSE stream
    return StreamingResponse(
        stream_chat_response(user_message, session_id, form_data),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/jenkins/chat/stream")
async def chat_stream_get(
    message: str = Query(..., description="User message"),
    session_id: Optional[str] = Query(None, description="Chat session ID"),
    project_id: Optional[str] = Query(None, description="Project ID for contextual metadata"),
    repo_id: Optional[str] = Query(None, description="SCM Repository ID to fetch file tree"),
    token: Optional[str] = Query(None, description="JWT token (required for SSE - EventSource can't send headers)"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    is_form_submission: Optional[bool] = Query(False, description="Whether this is a form submission"),
    repo_url: Optional[str] = Query(None, description="Repository URL from form data"),
    repo_namespace: Optional[str] = Query(None, description="Repository namespace from form data"),
    repo_name: Optional[str] = Query(None, description="Repository name from form data"),
    branch: Optional[str] = Query(None, description="Branch from form data"),
    output_filename: Optional[str] = Query(None, description="Output filename from form data")
):
    """
    SSE streaming endpoint for chat responses (GET method - for EventSource compatibility).
    GET /api/jenkins/chat/stream?message={message}&session_id={session_id}&token={token}
    For form submissions: ?message=submit&is_form_submission=true&repo_url=...&branch=...&output_filename=...
    
    Note: For SSE requests, token must be in query parameter (EventSource API limitation).
    Falls back to Authorization header if query parameter not provided.
    """
    # Log token presence for debugging (without exposing the actual token)
    has_token = token is not None
    has_auth_header = authorization is not None
    logger.info(f"GET SSE request - has_token_query: {has_token}, has_auth_header: {has_auth_header}")
    
    # Validate authentication - prioritize query parameter for SSE
    # For SSE, we only accept chat tokens (not login tokens)
    if not validate_jwt_token(token, authorization, token_type="chat"):
        logger.warning(f"GET SSE authentication failed - token in query: {has_token}, auth header: {has_auth_header}")
        async def error_stream():
            error_event = {"type": "error", "message": "Unauthorized"}
            yield f"data: {json.dumps(error_event)}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    logger.info(f"GET SSE authentication successful for session: {session_id}")
    
    # Generate or use session ID
    if not session_id:
        session_id = generate_session_id()
    
    # Initialize session if needed
    if session_id not in sessions:
        sessions[session_id] = {"messages": []}
        
        # Fetch project_info if project_id is provided
        auth_token = token or (authorization[7:] if authorization and authorization.startswith("Bearer ") else "")
        if project_id:
            try:
                if auth_token:
                    project_info = await project_client.get_project(project_id, auth_token)
                    if project_info:
                        sessions[session_id]["project_info"] = project_info
                        logger.info(f"Loaded project metadata for project {project_id}")
            except Exception as e:
                logger.warning(f"Could not fetch project metadata: {e}")
                
            try:
                if auth_token:
                    existing_resources = await project_client.get_project_resources(project_id, auth_token)
                    if existing_resources:
                        sessions[session_id]["existing_resources"] = existing_resources
                        logger.info(f"Loaded {len(existing_resources)} existing resources for project {project_id}")
            except Exception as e:
                logger.warning(f"Could not fetch existing resources: {e}")

        # Fetch repo_tree if repo_id is provided
        if repo_id and auth_token:
            try:
                import httpx
                scm_url = f"{os.getenv('SCM_SERVICE_URL', 'http://localhost:8006')}/api/scm/repos/{repo_id}/tree"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(scm_url, headers={"Authorization": f"Bearer {auth_token}"})
                    if resp.status_code == 200:
                        sessions[session_id]["repo_tree"] = resp.json()
                        logger.info(f"Loaded repo tree for repo {repo_id}")
                    else:
                        logger.warning(f"Failed to fetch repo tree: {resp.text}")
            except Exception as e:
                logger.warning(f"Could not fetch repo tree: {e}")
    
    # Prepare form_data if this is a form submission
    form_data = None
    if is_form_submission:
        logger.info("=" * 80)
        logger.info("FORM SUBMISSION RECEIVED (GET SSE)")
        logger.info(f"Query parameters - repo_url: '{repo_url}', repo_namespace: '{repo_namespace}', repo_name: '{repo_name}', branch: '{branch}', output_filename: '{output_filename}'")
        
        if repo_url:
            form_data = {
                "repo_url": repo_url,
                "branch": branch or "master/main",
                "output_filename": output_filename
            }
        elif repo_namespace and repo_name:
            form_data = {
                "repo_namespace": repo_namespace,
                "repo_name": repo_name,
                "branch": branch or "master/main",
                "output_filename": output_filename
            }
        
        if form_data:
            logger.info(f"Constructed form_data: {form_data}")
            logger.info(f"Form data keys: {list(form_data.keys())}")
            logger.info(f"repo_url: '{form_data.get('repo_url')}' (type: {type(form_data.get('repo_url'))})")
            logger.info(f"repo_namespace: '{form_data.get('repo_namespace')}' (type: {type(form_data.get('repo_namespace'))})")
            logger.info(f"repo_name: '{form_data.get('repo_name')}' (type: {type(form_data.get('repo_name'))})")
        else:
            logger.warning("Form submission detected but form_data is None - missing repo_url or (repo_namespace AND repo_name)")
        logger.info("=" * 80)
    
    # Add user message to session
    sessions[session_id]["messages"].append({"role": "user", "content": message})
    
    # Return SSE stream
    return StreamingResponse(
        stream_chat_response(message, session_id, form_data),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/jenkins/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Regular chat endpoint (non-streaming fallback).
    POST /api/jenkins/chat
    
    Note: For POST requests, token should be in Authorization header: Bearer {token}
    """
    # Log authentication attempt
    has_auth_header = authorization is not None
    logger.info(f"POST chat request - has_auth_header: {has_auth_header}, session_id: {request.session_id}")
    
    # Validate authentication - for POST, use Authorization header
    # For POST chat, we only accept chat tokens (not login tokens)
    if not validate_jwt_token(None, authorization, token_type="chat"):
        logger.warning(f"POST authentication failed - auth header: {has_auth_header}")
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    logger.info(f"POST authentication successful for session: {request.session_id}")
    
    # Generate or use session ID
    session_id = request.session_id or generate_session_id()
    
    # Initialize session if needed
    if session_id not in sessions:
        sessions[session_id] = {"messages": []}
    
    # Get message content
    user_message = request.get_message()
    if not user_message:
        raise HTTPException(status_code=400, detail="Either 'message' or 'query' field is required")
    
    # Add user message to session
    sessions[session_id]["messages"].append({"role": "user", "content": user_message})
    
    # Determine if this is a form submission
    form_data = None
    if request.is_form_submission and request.form_data:
        form_data = request.form_data
        logger.info("=" * 80)
        logger.info("FORM SUBMISSION RECEIVED (POST /api/jenkins/chat - is_form_submission)")
        logger.info(f"Full request payload: {request.dict()}")
        logger.info(f"Form data keys: {list(form_data.keys())}")
        logger.info(f"Form data values: {form_data}")
        logger.info(f"Form data type: {type(form_data)}")
        logger.info(f"repo_url: '{form_data.get('repo_url')}' (type: {type(form_data.get('repo_url'))})")
        logger.info(f"repo_namespace: '{form_data.get('repo_namespace')}' (type: {type(form_data.get('repo_namespace'))})")
        logger.info(f"repo_name: '{form_data.get('repo_name')}' (type: {type(form_data.get('repo_name'))})")
        logger.info(f"branch: '{form_data.get('branch')}'")
        logger.info(f"output_filename: '{form_data.get('output_filename')}'")
        logger.info(f"source_type: '{form_data.get('source_type')}'")
        logger.info("=" * 80)
    elif request.has_form_data and request.form_data:
        form_data = request.form_data
        logger.info("=" * 80)
        logger.info("FORM SUBMISSION RECEIVED (POST /api/jenkins/chat - has_form_data)")
        logger.info(f"Full request payload: {request.dict()}")
        logger.info(f"Form data keys: {list(form_data.keys())}")
        logger.info(f"Form data values: {form_data}")
        logger.info(f"Form data type: {type(form_data)}")
        logger.info(f"repo_url: '{form_data.get('repo_url')}' (type: {type(form_data.get('repo_url'))})")
        logger.info(f"repo_namespace: '{form_data.get('repo_namespace')}' (type: {type(form_data.get('repo_namespace'))})")
        logger.info(f"repo_name: '{form_data.get('repo_name')}' (type: {type(form_data.get('repo_name'))})")
        logger.info(f"branch: '{form_data.get('branch')}'")
        logger.info(f"output_filename: '{form_data.get('output_filename')}'")
        logger.info(f"source_type: '{form_data.get('source_type')}'")
        logger.info("=" * 80)
    
    # Handle form submission
    if form_data:
        try:
            # Extract and validate form data
            extracted_data = extract_form_data(form_data)
            source_type = extracted_data.get("source_type")
            
            # Handle SCM type - download and analyze repository
            if source_type == "SCM":
                # Extract http_url_to_repo directly from selected_repo
                repo_url = extracted_data.get("repo_url")  # This is http_url_to_repo from selected_repo
                branch = extracted_data.get("branch", "master/main")
                output_filename = extracted_data.get("output_filename")
                
                logger.info(f"Processing SCM form submission - repo_url (http_url_to_repo): {repo_url}, branch: {branch}, output_filename: {output_filename}")
                
                try:
                    # Download repository
                    # Pass http_url_to_repo directly - download_repository_zip will parse it and use credentials
                    logger.info(f"Downloading repository using http_url_to_repo: {repo_url}")
                    output_file = download_repository_zip(
                        repo_url=repo_url,  # This is the http_url_to_repo from selected_repo
                        branch=branch,
                        output_filename=output_filename
                    )
                    
                    # Analyze codebase
                    analysis_result = analyze_codebase(output_file)
                    
                    response_data = {
                        "type": "text",
                        "content": analysis_result,
                        "response": analysis_result,
                        "message": analysis_result
                    }
                except Exception as e:
                    response_data = {
                        "type": "text",
                        "content": f"Error processing repository: {str(e)}",
                        "response": f"Error: {str(e)}",
                        "message": f"Error: {str(e)}"
                    }
            
            elif source_type == "Manual":
                # Handle Manual type - store stack_details for pipeline generation
                stack_details = extracted_data.get("stack_details")
                
                # Store in session for later pipeline generation
                if session_id in sessions:
                    sessions[session_id]["last_analysis"] = {
                        "analysis_result": f"Manual entry - Stack details: {stack_details}",
                        "repo_url": None,
                        "branch": None,
                        "stack_details": stack_details,
                        "source_type": "Manual",
                        "timestamp": time.time()
                    }
                
                response_data = {
                    "type": "text",
                    "content": f"Stack details received: {stack_details}. You can now generate a pipeline based on these details.",
                    "response": f"Stack details received: {stack_details}",
                    "message": f"Stack details received: {stack_details}"
                }
            
            else:
                response_data = {
                    "type": "text",
                    "content": f"Error: Invalid source_type: {source_type}",
                    "response": f"Error: Invalid source_type: {source_type}",
                    "message": f"Error: Invalid source_type: {source_type}"
                }
                
        except ValueError as e:
            response_data = {
                "type": "text",
                "content": f"Error: {str(e)}",
                "response": f"Error: {str(e)}",
                "message": f"Error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error processing form data: {str(e)}")
            response_data = {
                "type": "text",
                "content": f"Error processing form data: {str(e)}",
                "response": f"Error: {str(e)}",
                "message": f"Error: {str(e)}"
            }
    else:
        # Generate regular response
        response_data = await generate_chat_response(user_message, session_id, form_data)
    
    # Add assistant response to session
    sessions[session_id]["messages"].append({"role": "assistant", "content": response_data.get("content", "")})
    
    # Build response
    response = ChatResponse(
        session_id=session_id,
        type=response_data.get("type", "text"),
        response=response_data.get("response"),
        message=response_data.get("message"),
        content=response_data.get("content"),
        form=response_data.get("form"),
        options=response_data.get("options"),
        requires_form=response_data.get("requires_form", False),
        requires_options=response_data.get("requires_options", False)
    )
    
    return response


@app.post("/download", response_model=DownloadResponse)
async def download_repository(
    request: DownloadRequest,
    background_tasks: BackgroundTasks
):
    """Download a GitLab repository as a ZIP file."""
    try:
        logger.info(f"Download request received: repo_url={request.repo_url}, branch={request.branch}")
        
        output_file = download_repository_zip(
            repo_url=request.repo_url,
            branch=request.branch,
            output_filename=request.output_filename
        )
        
        file_path = Path(output_file)
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        
        file_count = None
        try:
            import zipfile
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                file_count = len(zip_ref.namelist())
        except Exception as e:
            logger.warning(f"Could not count files in ZIP: {e}")
        
        logger.info(f"Download completed successfully: {output_file}")
        
        return DownloadResponse(
            success=True,
            message=f"Repository downloaded successfully",
            file_path=output_file,
            file_size_mb=round(file_size_mb, 2),
            file_count=file_count
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download repository: {str(e)}")


@app.get("/download")
async def download_repository_get(
    repo_url: str,
    branch: str = "main",
    output_filename: Optional[str] = None
):
    """Download a GitLab repository as a ZIP file (GET endpoint)."""
    try:
        logger.info(f"Download request (GET): repo_url={repo_url}, branch={branch}")
        
        output_file = download_repository_zip(
            repo_url=repo_url,
            branch=branch,
            output_filename=output_filename
        )
        
        file_path = Path(output_file)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Downloaded file not found")
        
        logger.info(f"Download completed, returning file: {output_file}")
        
        return FileResponse(
            path=output_file,
            filename=file_path.name,
            media_type="application/zip"
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download repository: {str(e)}")


@app.get("/files/{filename:path}")
async def get_downloaded_file(filename: str):
    """Retrieve a previously downloaded ZIP file."""
    try:
        from gitlab_downloader import OUTPUT_DIR
        
        file_path = Path(OUTPUT_DIR) / filename
        file_path = file_path.resolve()
        output_dir = Path(OUTPUT_DIR).resolve()
        
        if not str(file_path).startswith(str(output_dir)):
            raise HTTPException(status_code=403, detail="Access denied: file outside output directory")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/zip"
        )
        
    except Exception as e:
        logger.error(f"Error retrieving file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")


@app.get("/list-files")
async def list_downloaded_files():
    """List all downloaded ZIP files in the output directory."""
    try:
        from gitlab_downloader import OUTPUT_DIR
        
        output_path = Path(OUTPUT_DIR)
        
        if not output_path.exists():
            return JSONResponse(content={"files": [], "count": 0})
        
        zip_files = []
        for file_path in output_path.glob("*.zip"):
            file_info = {
                "filename": file_path.name,
                "size_mb": round(file_path.stat().st_size / (1024 * 1024), 2),
                "path": str(file_path.absolute())
            }
            zip_files.append(file_info)
        
        return JSONResponse(content={
            "files": zip_files,
            "count": len(zip_files),
            "output_directory": str(output_path.absolute())
        })
        
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


# ==================== RAG Endpoints ====================

class LoadRAGRequest(BaseModel):
    """Request model for loading RAG data"""
    zip_path: Optional[str] = Field(None, description="Path to zip file containing Jenkinsfiles")
    clear_existing: bool = Field(default=False, description="Clear existing data before loading")


class RAGStatusResponse(BaseModel):
    """Response model for RAG status"""
    available: bool
    collection_name: Optional[str] = None
    document_count: Optional[int] = None
    db_path: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/rag/load")
async def load_rag_data(
    request: Optional[LoadRAGRequest] = None,
    zip_path: Optional[str] = Query(None, description="Path to zip file (alternative to request body)"),
    clear_existing: Optional[bool] = Query(None, description="Clear existing data before loading (alternative to request body)")
):
    """
    Load Jenkinsfiles from a zip file into ChromaDB for RAG.
    
    The zip file should contain Jenkinsfile examples (simple to advanced).
    Files will be processed, chunked, and stored in ChromaDB for retrieval.
    
    Accepts request in JSON format:
    {
        "zip_path": "/path/to/jenkinsfiles.zip",
        "clear_existing": false
    }
    
    Or as query parameters:
    ?zip_path=/path/to/jenkinsfiles.zip&clear_existing=false
    
    NOTE: This endpoint does NOT require JWT authentication (for local development).
    """
    if not RAG_MODULE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="RAG module is not available. Please ensure chromadb is installed."
        )
    
    if not load_jenkinsfiles_to_chromadb:
        raise HTTPException(
            status_code=503,
            detail="RAG loading function is not available."
        )
    
    try:
        # Get zip_path from request body or query parameter
        final_zip_path = None
        final_clear_existing = False
        
        if request and request.zip_path:
            final_zip_path = request.zip_path
            final_clear_existing = request.clear_existing
        elif zip_path:
            final_zip_path = zip_path
            final_clear_existing = clear_existing if clear_existing is not None else False
        else:
            raise HTTPException(
                status_code=400,
                detail="zip_path is required. Provide it in request body as JSON or as query parameter."
            )
        
        # Validate zip file exists
        zip_path_obj = Path(final_zip_path)
        if not zip_path_obj.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Zip file not found: {final_zip_path}"
            )
        
        if not zip_path_obj.suffix.lower() == '.zip':
            raise HTTPException(
                status_code=400,
                detail="File must be a zip file (.zip)"
            )
        
        logger.info(f"Loading RAG data from: {final_zip_path}")
        
        # Load Jenkinsfiles into ChromaDB
        success = load_jenkinsfiles_to_chromadb(
            zip_path=str(zip_path_obj),
            clear_existing=final_clear_existing
        )
        
        if success:
            # Get updated status
            status = get_rag_status()
            return JSONResponse(content={
                "success": True,
                "message": f"Successfully loaded Jenkinsfiles from {final_zip_path}",
                "status": status
            })
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to load Jenkinsfiles into ChromaDB. Check logs for details."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading RAG data: {str(e)}")
        logger.exception(e)  # Log full traceback for debugging
        raise HTTPException(status_code=500, detail=f"Failed to load RAG data: {str(e)}")


@app.get("/api/rag/status", response_model=RAGStatusResponse)
async def get_rag_status_endpoint():
    """
    Get the current status of the RAG system.
    
    NOTE: This endpoint does NOT require JWT authentication (for local development).
    """
    try:
        status = get_rag_status()
        return JSONResponse(content=status)
    except Exception as e:
        logger.error(f"Error getting RAG status: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "available": False,
                "error": str(e)
            }
        )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8081))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting FastAPI server on {host}:{port}")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
