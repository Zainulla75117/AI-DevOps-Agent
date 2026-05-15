"""
LangGraph-based chat workflow for Jenkins pipeline generation
Handles conversation flow, form detection, and state management
"""

from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from dotenv import load_dotenv
import os
import logging
from typing import Dict, Any, Optional, AsyncGenerator

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize LLM
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
llm = None

if api_key:
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0.7,
        )
        logger.info("LangGraph LLM client initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize LangGraph LLM client: {e}")
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

Be concise, helpful, and professional in your responses.
Give answers in short and concise manner.
"""


class ChatState(TypedDict):
    """State for the chat workflow"""
    messages: Annotated[list, add_messages]
    session_id: str
    project_info: Dict[str, Any]
    repo_tree: Optional[Dict[str, Any]]
    user_message: str
    form_data: Optional[Dict[str, Any]]
    requires_form: bool
    response_type: Literal["text", "form", "options"]
    response_content: str
    form_structure: Optional[Dict[str, Any]]


def detect_pipeline_intent(state: ChatState, sessions: Optional[Dict[str, Dict[str, Any]]] = None) -> Literal["form_request", "normal_chat"]:
    """
    Detect if user wants to create a pipeline.
    Routes to form request or normal chat.
    Only shows form if it hasn't been submitted/processed yet.
    """
    user_message = state.get("user_message", "").lower()
    
    # Check if form_data already exists (form was already submitted)
    form_data = state.get("form_data")
    if form_data:
        logger.info(f"Form already submitted for session: {state.get('session_id')}, skipping form request")
        return "normal_chat"
    
    # Check if there's already an analysis in the session (form was processed)
    session_id = state.get("session_id")
    if sessions and session_id and session_id in sessions:
        session = sessions[session_id]
        if "last_analysis" in session and session["last_analysis"] is not None:
            logger.info(f"Analysis already exists for session: {session_id}, skipping form request")
            return "normal_chat"
    
    pipeline_keywords = [
        "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline",
        "create jenkinsfile", "generate jenkinsfile", "setup pipeline", "pipeline configuration",
        "make pipeline", "new pipeline", "pipeline for", "ci/cd pipeline"
    ]
    
    if any(keyword in user_message for keyword in pipeline_keywords):
        logger.info(f"Pipeline intent detected for session: {state.get('session_id')}")
        return "form_request"
    
    return "normal_chat"


def request_form(state: ChatState) -> ChatState:
    """
    Return form structure for pipeline creation.
    """
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
    
    response_message = "I'll help you create a Jenkins pipeline! To generate the perfect pipeline for your project, I need some information. Please fill out the form below with your project details."
    
    return {
        **state,
        "requires_form": True,
        "response_type": "form",
        "response_content": response_message,
        "form_structure": form_structure
    }


async def generate_llm_response(state: ChatState) -> ChatState:
    """
    Generate LLM response using conversation history.
    """
    if not llm:
        return {
            **state,
            "response_type": "text",
            "response_content": "LLM service is not available. Please configure GEMINI_API_KEY in your .env file.",
            "requires_form": False
        }
    
    try:
        # Get conversation history
        messages = state.get("messages", [])
        
        # Prepare dynamic system prompt with project context
        project_info = state.get("project_info", {})
        dynamic_system_prompt = SYSTEM_PROMPT
        
        if project_info:
            domain = project_info.get("domain", "general")
            env = project_info.get("environment", "development")
            traffic = project_info.get("expectedTraffic", "unknown")
            cost_pref = project_info.get("costPreference", "balanced")
            desc = project_info.get("description", "")
            
            project_context = f"""
PROJECT METADATA AND CONTEXT:
- Domain / Type: {domain}
- Primary Environment: {env}
- Expected Traffic Load: {traffic}
- Cost Preference: {cost_pref}
- Description: {desc}

You MUST align your CI/CD pipeline decisions with these project settings. For example, if environment is 'production', suggest manual approval steps. If traffic is 'high', suggest load testing steps.
"""
            dynamic_system_prompt += "\n" + project_context
            
        # Add Repository Context
        repo_tree = state.get("repo_tree", {})
        if repo_tree and isinstance(repo_tree, dict):
            tree_files = repo_tree.get("tree", [])
            deps_files = repo_tree.get("dependency_files", {})
            
            if len(tree_files) > 1000:
                tree_files = tree_files[:1000] + ["... (truncated) ..."]
                
            repo_context = f"""
REPOSITORY CONTEXT:
The user has linked a code repository. Here is the file tree of the repository:
{chr(10).join(tree_files)}

"""
            if deps_files:
                repo_context += "Key Dependency Files:\n"
                for fname, content in deps_files.items():
                    content_preview = content[:2000] + ("..." if len(content) > 2000 else "")
                    repo_context += f"--- {fname} ---\n{content_preview}\n\n"
            
            dynamic_system_prompt += "\n" + repo_context
            
        user_message = state.get("user_message", "")
        if user_message == "[INIT_REPO_SCAN]":
            init_scan_instruction = """
[INIT_REPO_SCAN TRIGGERED]
You have just received the repository context. This is the FIRST message of the session.
Your immediate task:
1. Scan the REPOSITORY CONTEXT to detect the tech stack (e.g., package.json for Node, requirements.txt for Python, pom.xml for Java).
2. Provide a brief summary of what the repository contains regarding CI/CD.
3. Suggest a customized Jenkins pipeline based on the tech stack you found (e.g. "I see this is a React app. Would you like me to generate a Jenkinsfile that runs npm test and npm run build?").
4. Keep it conversational and concise. Do NOT output a pipeline yet, just suggest one.
"""
            dynamic_system_prompt += "\n" + init_scan_instruction
            # Remove the hidden message
            user_message = ""
            if messages and messages[-1].get("content") == "[INIT_REPO_SCAN]":
                messages.pop()
            
        llm_messages = [SystemMessage(content=dynamic_system_prompt)]
        
        # Add conversation history (last 20 messages)
        for msg in messages[-20:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    llm_messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    llm_messages.append(AIMessage(content=content))
            else:
                llm_messages.append(msg)
        
        # Add current user message only if it's not the hidden trigger
        if user_message:
            llm_messages.append(HumanMessage(content=user_message))
        
        # Generate response
        response = await llm.ainvoke(llm_messages)
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # Check if response indicates form request
        requires_form = False
        form_structure = None
        response_lower = response_text.lower()
        has_form_marker = "__FORM_REQUEST__" in response_text
        
        if has_form_marker:
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
            
            # Clean response text
            response_text = response_text.replace("__FORM_REQUEST__", "").strip()
            if not response_text or len(response_text) < 10:
                response_text = "I'll help you create a Jenkins pipeline! To generate the perfect pipeline for your project, I need some information. Please fill out the form below with your project details."
        
        return {
            **state,
            "response_type": "form" if requires_form else "text",
            "response_content": response_text,
            "requires_form": requires_form,
            "form_structure": form_structure if requires_form else None
        }
        
    except Exception as e:
        logger.error(f"Error generating LLM response: {str(e)}")
        return {
            **state,
            "response_type": "text",
            "response_content": f"I encountered an error: {str(e)}. Please try again.",
            "requires_form": False
        }


# Build the workflow graph
def create_chat_workflow():
    """Create the LangGraph workflow for chat"""
    workflow = StateGraph(ChatState)
    
    # Add a routing node that decides the path
    def route_based_on_intent(state: ChatState) -> ChatState:
        """Route based on pipeline intent detection"""
        # Check if we should skip form (form already submitted/processed)
        if state.get("_skip_form", False):
            logger.info(f"Skipping form request for session: {state.get('session_id')} - form already processed")
            return state
        
        # Check form_data - if it exists, form was already submitted
        if state.get("form_data"):
            logger.info(f"Form data exists for session: {state.get('session_id')} - skipping form request")
            return state
        
        intent = detect_pipeline_intent(state, None)  # Sessions checked in process_chat_message
        if intent == "form_request":
            # Route to form request
            return request_form(state)
        # Continue to LLM generation
        return state
    
    # Add nodes
    workflow.add_node("route", route_based_on_intent)
    workflow.add_node("generate_response", generate_llm_response)
    
    # Set entry point
    workflow.set_entry_point("route")
    
    # Add conditional routing
    def should_use_llm(state: ChatState) -> str:
        """Check if we need to generate LLM response or return form"""
        if state.get("requires_form"):
            return "end"
        return "generate_response"
    
    workflow.add_conditional_edges(
        "route",
        should_use_llm,
        {
            "end": END,
            "generate_response": "generate_response"
        }
    )
    
    # Add edge to end from generate_response
    workflow.add_edge("generate_response", END)
    
    # Compile the graph
    app = workflow.compile()
    
    return app


# Create the workflow instance
chat_workflow = None
if llm:
    try:
        chat_workflow = create_chat_workflow()
        logger.info("LangGraph workflow created successfully")
    except Exception as e:
        logger.error(f"Error creating LangGraph workflow: {e}")


async def process_chat_message(
    message: str,
    session_id: str,
    sessions: Dict[str, Dict[str, Any]],
    form_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Process a chat message using LangGraph workflow.
    
    Args:
        message: User message
        session_id: Session identifier
        sessions: Session storage
        form_data: Optional form submission data
    
    Returns:
        Response dictionary with type, content, form, etc.
    """
    if not chat_workflow:
        # Fallback to direct LLM if LangGraph not available
        from llm_chat import get_llm_response, update_session_history
        if form_data and form_data.get("repo_url"):
            # Handle form submission separately
            return {
                "type": "text",
                "content": "Form submission processing...",
                "requires_form": False
            }
        
        llm_response = await get_llm_response(message, session_id, sessions)
        update_session_history(session_id, sessions, message, llm_response)
        
        return {
            "type": "text",
            "content": llm_response,
            "requires_form": False
        }
    
    try:
        # Get conversation history
        history = sessions.get(session_id, {}).get("messages", [])
        
        # Check if form was already submitted/processed
        # If there's already a last_analysis, don't show form again
        session = sessions.get(session_id, {})
        has_analysis = "last_analysis" in session and session["last_analysis"] is not None
        
        # If form_data exists or analysis already exists, skip form request
        skip_form = form_data is not None or has_analysis
        
        # Convert history to LangChain messages
        messages = []
        for msg in history[-20:]:  # Keep last 20 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
        
        # Prepare initial state
        # Store session info in state for detect_pipeline_intent to use
        initial_state = {
            "messages": messages,
            "session_id": session_id,
            "project_info": session.get("project_info", {}),
            "repo_tree": session.get("repo_tree", {}),
            "user_message": message,
            "form_data": form_data,
            "requires_form": False,
            "response_type": "text",
            "response_content": "",
            "form_structure": None,
            "_skip_form": skip_form  # Internal flag to skip form
        }
        
        # Run the workflow
        # The _skip_form flag in state will prevent form from showing if already processed
        final_state = await chat_workflow.ainvoke(initial_state)
        
        # Update session history
        if session_id not in sessions:
            sessions[session_id] = {"messages": []}
        
        # Add user message
        sessions[session_id]["messages"].append({
            "role": "user",
            "content": message
        })
        
        # Add assistant response
        sessions[session_id]["messages"].append({
            "role": "assistant",
            "content": final_state.get("response_content", "")
        })
        
        # Keep only last 20 messages
        if len(sessions[session_id]["messages"]) > 20:
            sessions[session_id]["messages"] = sessions[session_id]["messages"][-20:]
        
        # Return response
        return {
            "type": final_state.get("response_type", "text"),
            "content": final_state.get("response_content", ""),
            "response": final_state.get("response_content", ""),
            "message": final_state.get("response_content", ""),
            "requires_form": final_state.get("requires_form", False),
            "form": final_state.get("form_structure")
        }
        
    except Exception as e:
        logger.error(f"Error processing chat message with LangGraph: {str(e)}")
        # Fallback
        return {
            "type": "text",
            "content": f"I encountered an error: {str(e)}. Please try again.",
            "requires_form": False
        }


async def stream_chat_message(
    message: str,
    session_id: str,
    sessions: Dict[str, Dict[str, Any]],
    form_data: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """
    Stream chat response using LangGraph workflow.
    
    Args:
        message: User message
        session_id: Session identifier
        sessions: Session storage
        form_data: Optional form submission data
    
    Yields:
        Response chunks for SSE streaming
    """
    if not chat_workflow:
        # Fallback to direct LLM streaming
        from llm_chat import stream_llm_response
        async for chunk in stream_llm_response(message, session_id, sessions):
            yield chunk
        return
    
    try:
        # For streaming, we'll use the workflow but stream the LLM response
        # This is a simplified version - full streaming support would require
        # LangGraph streaming capabilities
        
        # Get conversation history
        history = sessions.get(session_id, {}).get("messages", [])
        
        # Convert history to LangChain messages
        messages = []
        for msg in history[-20:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            # Skip hidden initialization messages
            if content == "[INIT_REPO_SCAN]":
                continue
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
        
        # Prepare dynamic system prompt with project context
        session = sessions.get(session_id, {})
        project_info = session.get("project_info", {})
        dynamic_system_prompt = SYSTEM_PROMPT
        
        if project_info:
            domain = project_info.get("domain", "general")
            env = project_info.get("environment", "development")
            traffic = project_info.get("expectedTraffic") or project_info.get("expected_traffic", "unknown")
            cost_pref = project_info.get("costPreference") or project_info.get("cost_preference", "balanced")
            desc = project_info.get("description", "")
            platform = project_info.get("platform", "unknown")
            cloud_provider = project_info.get("cloud_provider", "aws")
            region = project_info.get("region", "us-east-1")
            iam_name = project_info.get("iam_name", "unknown")
            
            project_context = f"""
PROJECT METADATA AND CONTEXT:
- Domain / Type: {domain}
- Platform: {platform}
- Cloud Provider: {cloud_provider}
- Region: {region}
- IAM Target: {iam_name}
- Primary Environment: {env}
- Expected Traffic Load: {traffic}
- Cost Preference: {cost_pref}
- Description: {desc}

You MUST align your CI/CD pipeline decisions with these project settings. For example, if environment is 'production', suggest manual approval steps. If traffic is 'high', suggest load testing steps. Always suggest deployment steps that target the specified Cloud Provider ({cloud_provider}) in the specified Region ({region}).
"""
            dynamic_system_prompt += "\n" + project_context
            
        # Add Existing Infrastructure Context
        existing_resources = session.get("existing_resources", [])
        if existing_resources:
            lines = []
            for r in existing_resources:
                cfg = r.get("config", {})
                cfg_str = ", ".join(f"{k}={v}" for k, v in cfg.items()) if cfg else ""
                lines.append(f"- [{r.get('type','?')}] {r.get('name','?')} (env={r.get('env','?')}) {cfg_str}")
            
            existing_str = "\n".join(lines)
            infra_context = f"""
EXISTING INFRASTRUCTURE:
The following infrastructure resources have already been provisioned for this project:
{existing_str}

CRITICAL INSTRUCTION: Use this infrastructure context to accurately plan CI/CD deployment steps. For example, if an EKS cluster exists, suggest a Kubernetes deployment step. If an EC2 instance exists, suggest SSH/SCP steps or CodeDeploy.
"""
            dynamic_system_prompt += "\n" + infra_context
            
        # Add Repository Context
        repo_tree = session.get("repo_tree", {})
        if repo_tree and isinstance(repo_tree, dict):
            tree_files = repo_tree.get("tree", [])
            deps_files = repo_tree.get("dependency_files", {})
            
            if len(tree_files) > 1000:
                tree_files = tree_files[:1000] + ["... (truncated) ..."]
                
            repo_context = f"""
REPOSITORY CONTEXT:
The user has linked a code repository. Here is the file tree of the repository:
{chr(10).join(tree_files)}

"""
            if deps_files:
                repo_context += "Key Dependency Files:\n"
                for fname, content in deps_files.items():
                    content_preview = content[:2000] + ("..." if len(content) > 2000 else "")
                    repo_context += f"--- {fname} ---\n{content_preview}\n\n"
            
            dynamic_system_prompt += "\n" + repo_context
            
        if message == "[INIT_REPO_SCAN]":
            init_scan_instruction = """
[INIT_REPO_SCAN TRIGGERED]
You have just received the repository context. This is the FIRST message of the session.
Your immediate task:
1. Scan the REPOSITORY CONTEXT to detect the tech stack (e.g., package.json for Node, requirements.txt for Python, pom.xml for Java).
2. Provide a brief summary of what the repository contains regarding CI/CD.
3. Suggest a customized Jenkins pipeline based on the tech stack you found (e.g. "I see this is a React app. Would you like me to generate a Jenkinsfile that runs npm test and npm run build?").
4. Keep it conversational and concise. Do NOT output a pipeline yet, just suggest one.
"""
            dynamic_system_prompt += "\n" + init_scan_instruction
            # Don't add the hidden message to llm_messages, but Gemini requires at least one HumanMessage
            llm_messages = [SystemMessage(content=dynamic_system_prompt)] + messages + [HumanMessage(content="Please scan the repository context provided and give a summary as instructed.")]
        else:
            # Prepare messages for streaming
            llm_messages = [SystemMessage(content=dynamic_system_prompt)] + messages + [HumanMessage(content=message)]
        
        # Stream response
        accumulated = ""
        async for chunk in llm.astream(llm_messages):
            chunk_text = chunk.content if hasattr(chunk, 'content') else str(chunk)
            accumulated += chunk_text
            yield chunk_text
        
        # Check for form request after streaming
        if "__FORM_REQUEST__" in accumulated or any(keyword in message.lower() for keyword in [
            "create pipeline", "build pipeline", "generate pipeline", "jenkins pipeline"
        ]):
            # Form will be handled in the done event
            pass
        
    except Exception as e:
        logger.error(f"Error streaming chat message: {str(e)}")
        yield f"I encountered an error: {str(e)}. Please try again."


def is_langgraph_available() -> bool:
    """Check if LangGraph workflow is available"""
    return chat_workflow is not None

