"""
Jenkinsfile Generator
Generates Jenkinsfile content based on tech stack analysis
"""

from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Import RAG module
try:
    from jenkinsfile_rag import (
        retrieve_relevant_jenkinsfiles,
        is_rag_available,
        get_rag_status
    )
    RAG_AVAILABLE = True
except ImportError as e:
    logger.warning(f"RAG module not available: {e}")
    RAG_AVAILABLE = False
    retrieve_relevant_jenkinsfiles = None
    is_rag_available = lambda: False
    get_rag_status = lambda: {"available": False}

# Initialize Gemini client
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
client = None

if api_key:
    try:
        client = genai.Client(api_key=api_key)
        logger.info("Jenkinsfile generator client initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize Gemini client for Jenkinsfile generation: {e}")
else:
    logger.warning("GEMINI_API_KEY not found. Jenkinsfile generation will be disabled.")

# System instruction for consistent Jenkinsfile generation
JENKINSFILE_SYSTEM_INSTRUCTION = """You are an expert Jenkins pipeline engineer with deep knowledge of CI/CD best practices, declarative pipeline syntax, and various technology stacks.

Your role is to generate production-ready, well-structured Jenkinsfiles that follow industry best practices.

CORE PRINCIPLES:
1. Always use declarative pipeline syntax (pipeline { ... })
2. Generate complete, executable pipelines that work out-of-the-box
3. Follow Jenkins best practices: proper error handling, parallelization where appropriate, and clear stage names
4. Adapt pipeline stages and tools based on the detected technology stack
5. Include appropriate agents, tools, and environment configurations
6. Ensure pipelines are maintainable, readable, and follow DRY principles

OUTPUT FORMAT REQUIREMENTS:
- Your response MUST be wrapped in markdown code blocks
- Format: ```groovy (newline) {code} (newline) ```
- NO explanations, comments, or text outside the code block
- The Groovy code must start with 'pipeline {' and end with '}'
- Code must be valid, syntactically correct Groovy that can be directly used as a Jenkinsfile

TECH STACK ADAPTATION:
- Node.js/JavaScript: Use npm/yarn, include node_modules caching, run tests with npm test
- Python: Use pip/poetry, manage virtual environments, run pytest/unittest
- Java/Maven: Use Maven wrapper, run mvn clean install, handle Maven dependencies
- Java/Gradle: Use Gradle wrapper, run gradle build, handle Gradle cache
- Docker: Build and push images, use Dockerfile, handle registry authentication
- Multi-language: Combine appropriate tools for each language detected

PIPELINE STRUCTURE:
- agent: Choose appropriate (any, docker, kubernetes) based on requirements
- options: Include timeout, buildDiscarder, timestamps
- environment: Set necessary environment variables
  * Include REPO_URL if repository URL is provided
  * Include GIT_BRANCH if branch is provided
- stages: 
  * Checkout stage: MUST include the repository URL and branch if provided
    - Use: checkout([$class: 'GitSCM', branches: [[name: 'ACTUAL_BRANCH']], userRemoteConfigs: [[url: 'ACTUAL_REPO_URL']]])
    - Or: git url: 'ACTUAL_REPO_URL', branch: 'ACTUAL_BRANCH'
    - Include the actual repository URL and branch from the input, not placeholders
  * Build stage with correct build commands
  * Test stage with appropriate test runners
  * Deploy stage (if applicable)
- post: Include always, success, failure, cleanup actions with notifications

CRITICAL: 
- If a repository URL is provided in the input, you MUST include it in the checkout stage. Use the actual URL, not placeholders.
- If a branch is provided in the input, you MUST include it in the checkout stage. Use the actual branch name, not placeholders.
- If knowledge base examples (from ChromaDB) are provided, USE THEM AS PRIMARY SOURCE - adapt them rather than generating from scratch
- Prioritize adapting existing examples from the knowledge base over creating new code
- Only generate new code if examples truly don't match the requirements
- Always prioritize the user's specific requirements when adapting examples

Remember: Generate ONLY the markdown-wrapped Jenkinsfile code. No additional text."""


def generate_jenkinsfile(analysis_result: str, repo_url: str = None, branch: str = None, conversation_history: list = None) -> str:
    """
    Generate Jenkinsfile content based on tech stack analysis and conversation context.
    
    Args:
        analysis_result: Tech stack analysis result from analyze_codebase
        repo_url: Repository URL (optional, for context)
        branch: Branch name (optional, for context)
        conversation_history: List of message dicts with 'role' and 'content' keys (optional)
    
    Returns:
        Jenkinsfile content as string
    
    Raises:
        ValueError: If API key is not found
        Exception: If generation fails
    """
    if not client:
        raise ValueError(
            "Gemini API key not found. Please set GEMINI_API_KEY or GOOGLE_API_KEY in your .env file."
        )
    
    try:
        # Summarize conversation and detect complexity
        conversation_summary = ""
        complexity_level = "mid-level"
        
        if conversation_history:
            conversation_summary, complexity_level = summarize_conversation_and_detect_complexity(conversation_history)
            logger.info(f"Pipeline complexity level detected: {complexity_level}")
        
        # Retrieve relevant Jenkinsfile examples from RAG
        rag_examples = []
        if RAG_AVAILABLE and is_rag_available():
            try:
                # Build query from analysis and conversation
                query_parts = [analysis_result]
                if conversation_summary:
                    query_parts.append(conversation_summary)
                query = " ".join(query_parts)
                
                # Extract tech stack keywords from analysis
                tech_stack_keywords = []
                analysis_lower = analysis_result.lower()
                if any(word in analysis_lower for word in ['node', 'npm', 'yarn', 'javascript', 'typescript']):
                    tech_stack_keywords.append('nodejs')
                if any(word in analysis_lower for word in ['python', 'pip', 'poetry', 'django', 'flask']):
                    tech_stack_keywords.append('python')
                if any(word in analysis_lower for word in ['maven', 'mvn', 'java']):
                    tech_stack_keywords.append('java-maven')
                if any(word in analysis_lower for word in ['gradle', 'java']):
                    tech_stack_keywords.append('java-gradle')
                if any(word in analysis_lower for word in ['docker', 'container']):
                    tech_stack_keywords.append('docker')
                
                # Retrieve relevant examples from ChromaDB
                # Increase to 5 examples for better coverage
                rag_examples = retrieve_relevant_jenkinsfiles(
                    query=query,
                    tech_stack=tech_stack_keywords if tech_stack_keywords else None,
                    complexity=complexity_level,
                    n_results=5
                )
                
                if rag_examples:
                    logger.info(f"✅ RAG: Retrieved {len(rag_examples)} relevant Jenkinsfile examples from ChromaDB")
                    logger.info(f"   Tech stack keywords: {tech_stack_keywords}")
                    logger.info(f"   Complexity level: {complexity_level}")
                    for idx, ex in enumerate(rag_examples, 1):
                        ex_meta = ex.get('metadata', {})
                        logger.info(f"   Example {idx}: {ex_meta.get('filename', 'unknown')} (complexity: {ex_meta.get('complexity', 'unknown')}, tech: {ex_meta.get('tech_stack', [])})")
                else:
                    logger.warning("⚠️ RAG: No relevant examples found in ChromaDB, will generate from scratch")
            except Exception as e:
                logger.warning(f"Failed to retrieve RAG examples: {e}, continuing without RAG")
                rag_examples = []
        
        # Build the human prompt with detailed context
        prompt = f"""Generate a production-ready Jenkinsfile based on the following codebase analysis.
"""
        
        # CRITICAL: Add repository URL and branch at the very beginning for maximum visibility
        if repo_url or branch:
            prompt += f"""
=== CRITICAL: REPOSITORY INFORMATION (MUST BE INCLUDED IN PIPELINE) ===
"""
            if repo_url:
                prompt += f"Repository URL (git_url): {repo_url}\n"
            if branch:
                prompt += f"Branch: {branch}\n"
            else:
                prompt += f"Branch: main (default)\n"
            prompt += f"""
IMPORTANT: You MUST include these exact values in the checkout stage of the Jenkinsfile.
Do NOT use placeholders like 'your-repo-url' or 'REPO_URL' - use the actual values above.

"""
        
        # Add conversation summary if available
        if conversation_summary:
            prompt += f"""
=== CONVERSATION SUMMARY ===
{conversation_summary}

"""
        
        # Add RAG examples if available - PRIORITIZE THESE AS PRIMARY SOURCE
        if rag_examples:
            prompt += f"""
=== PRIMARY SOURCE: JENKINSFILE EXAMPLES FROM KNOWLEDGE BASE (ChromaDB) ===
CRITICAL: These examples are from a curated knowledge base. USE THESE AS YOUR PRIMARY REFERENCE.

You MUST prioritize using and adapting these examples over generating completely new code.
These examples have been tested and follow best practices.

"""
            for idx, example in enumerate(rag_examples, 1):
                metadata = example.get('metadata', {})
                filename = metadata.get('filename', 'example')
                example_complexity = metadata.get('complexity', 'unknown')
                example_tech = metadata.get('tech_stack', [])
                tech_stack_str = ', '.join(example_tech) if isinstance(example_tech, list) else str(example_tech)
                
                prompt += f"""
EXAMPLE {idx} from Knowledge Base:
- Source: {filename}
- Complexity: {example_complexity}
- Tech Stack: {tech_stack_str if tech_stack_str else 'N/A'}
- Content:
```groovy
{example.get('content', '')}
```

"""
            
            prompt += """
CRITICAL INSTRUCTIONS FOR USING KNOWLEDGE BASE EXAMPLES:
1. PRIMARY APPROACH: Select the most relevant example(s) from above that match the user's requirements
2. ADAPTATION: Modify the selected example(s) to match:
   - The exact repository URL provided by the user
   - The exact branch name provided by the user
   - The specific tech stack detected in the analysis
   - The complexity level requested by the user
3. COMBINATION: If multiple examples are relevant, combine the best parts from each
4. ENHANCEMENT: Only add new features if the examples don't cover the user's needs
5. SIMPLIFICATION: If examples are too complex, simplify them to match user's requirements
6. VALIDATION: Ensure the final code includes:
   - The actual repository URL (not placeholders)
   - The actual branch name (not placeholders)
   - All necessary stages for the detected tech stack
   - Appropriate complexity level

REMEMBER: These examples are proven patterns. Use them as the foundation and adapt, don't reinvent.

"""
        else:
            prompt += """
=== NOTE: No examples found in knowledge base ===
You will need to generate the Jenkinsfile from scratch based on the analysis below.
Follow best practices and ensure all requirements are met.

"""
        
        prompt += f"""=== TECH STACK ANALYSIS ===
{analysis_result}

"""
        
        # Re-emphasize repository URL and branch after analysis
        if repo_url or branch:
            prompt += f"""
=== REMINDER: REPOSITORY INFORMATION ===
"""
            if repo_url:
                prompt += f"Repository URL (git_url): {repo_url}\n"
            if branch:
                prompt += f"Branch: {branch}\n"
            else:
                prompt += f"Branch: main (default)\n"
            prompt += f"""
CRITICAL: These values MUST be included in the checkout stage. Use the exact values, not placeholders.

"""
        
        # Build complexity-specific requirements
        complexity_requirements = ""
        if complexity_level == "simple":
            complexity_requirements = """
PIPELINE COMPLEXITY: SIMPLE
- Generate a basic, straightforward pipeline
- Include only essential stages: Checkout, Build, Test
- Minimal configuration: basic agent, simple timeout
- No advanced features: no parallel stages, no matrix builds, minimal caching
- Basic error handling only
- Keep it simple and easy to understand"""
        elif complexity_level == "advanced":
            complexity_requirements = """
PIPELINE COMPLEXITY: ADVANCED
- Generate an enterprise-grade, production-ready pipeline
- Include all stages: Checkout, Build, Test, Deploy (if applicable)
- Advanced features: parallel stages where beneficial, matrix builds if needed, comprehensive caching
- Robust error handling: try-catch blocks, retry logic, detailed error messages
- Advanced options: buildDiscarder, timestamps, timeout, retry mechanisms
- Comprehensive post-build actions: notifications, cleanup, artifact archiving
- Environment-specific configurations if applicable
- Security best practices: credential management, secret handling
- Performance optimizations: parallel execution, efficient caching strategies"""
        else:  # mid-level (default)
            complexity_requirements = """
PIPELINE COMPLEXITY: MID-LEVEL
- Generate a standard, well-structured pipeline
- Include essential stages: Checkout, Build, Test, Deploy (if applicable)
- Standard configuration: appropriate agent, timeout, buildDiscarder, timestamps
- Good error handling: proper stage failure handling, notifications
- Standard caching: dependency caching (node_modules, .m2, .gradle, etc.)
- Post-build actions: success/failure notifications, cleanup
- Follow Jenkins best practices without over-engineering"""
        
        # Build requirements section with repository URL emphasis
        requirements_section = f"""
=== REQUIREMENTS ===
{complexity_requirements}

1. Analyze the tech stack information above and identify:
   - Programming languages (JavaScript, Python, Java, etc.)
   - Build tools (npm, Maven, Gradle, pip, etc.)
   - Testing frameworks (Jest, pytest, JUnit, etc.)
   - Deployment requirements (Docker, static files, etc.)

2. Generate a complete Jenkinsfile that includes:
   - Appropriate agent configuration
   - Checkout stage that MUST include the repository URL provided above"""
        
        if repo_url:
            branch_name = branch or "main"
            requirements_section += f"""
     * ⚠️ CRITICAL: The repository URL (git_url) is: {repo_url}
     * ⚠️ CRITICAL: The branch is: {branch_name}
     * ⚠️ YOU MUST INCLUDE BOTH THE EXACT URL AND BRANCH IN THE CHECKOUT STAGE
     * Use them in the checkout step, for example:
       - checkout([$class: 'GitSCM', branches: [[name: '{branch_name}']], userRemoteConfigs: [[url: '{repo_url}']]])
       - Or: git url: '{repo_url}', branch: '{branch_name}'
     * Do NOT use placeholders like 'your-repo-url', 'REPO_URL', 'BRANCH', or any variables
     * Use the ACTUAL values provided:
       - Repository URL (git_url): {repo_url}
       - Branch: {branch_name}
     * This makes it easier for users - they won't need to configure the repository or branch manually
     * When adapting knowledge base examples, REPLACE any placeholder URLs/branches with these actual values"""
        else:
            if branch:
                branch_name = branch
                requirements_section += f"""
     * Branch provided: {branch_name}
     * Include this branch in the checkout stage if using standard checkout scm"""
            else:
                requirements_section += """
     * Use standard checkout scm (will use Jenkins job configuration)"""
        
        requirements_section += """
   - Build stage with correct build commands for the detected stack
   - Test stage with appropriate test runners
   - Deploy stage (if deployment info is available)
   - Error handling and notifications
   - Environment variables if needed"""
        
        if repo_url:
            requirements_section += f"\n   - Include REPO_URL environment variable set to: {repo_url}"
        if branch:
            requirements_section += f"\n   - Include GIT_BRANCH environment variable set to: {branch}"
        
        requirements_section += """
   - Caching strategies for dependencies (node_modules, .m2, etc.)

3. Use the correct tools and commands:
   - If Node.js detected: Use npm/yarn, cache node_modules
   - If Python detected: Use pip/poetry, manage virtualenv
   - If Java/Maven detected: Use Maven commands, cache .m2
   - If Java/Gradle detected: Use Gradle commands, cache .gradle
   - If Docker detected: Build and optionally push images
   - Combine tools if multiple languages detected

4. Follow best practices based on complexity level:
   - Use declarative pipeline syntax
   - Include appropriate timeout settings (based on complexity)
   - Add build retention policies (for mid-level and advanced)
   - Include post-build actions (notifications, cleanup) - more comprehensive for advanced
   - Use parallel stages where beneficial (for advanced complexity)
   - Add proper error handling (more robust for advanced)

=== OUTPUT FORMAT ===
Your response must be EXACTLY in this format:
```groovy
pipeline {
    // Complete Jenkinsfile code here
}
```

CRITICAL: 
- Start your response with ```groovy
- End your response with ```
- Include ONLY the Jenkinsfile code wrapped in markdown
- NO explanations, NO comments outside the code block
- The code must be production-ready and executable"""
        
        if repo_url:
            branch_name = branch or "main"
            requirements_section += f"""
- ⚠️ CRITICAL: The repository URL (git_url) '{repo_url}' MUST be included in the checkout stage. Use the actual URL, not a placeholder.
- ⚠️ CRITICAL: The branch '{branch_name}' MUST be included in the checkout stage. Use the actual branch name, not a placeholder.
- When using knowledge base examples, you MUST replace any placeholder repository URLs or branches with these actual values.
- The final Jenkinsfile MUST contain the exact repository URL and branch provided above."""
        elif branch:
            requirements_section += f"""
- IMPORTANT: The branch '{branch}' MUST be included in the checkout stage. Use the actual branch name, not a placeholder."""
        
        prompt += requirements_section
        
        # Generate Jenkinsfile with improved prompts
        result = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=JENKINSFILE_SYSTEM_INSTRUCTION,
                temperature=0.3,  # Lower temperature for more consistent outputs
                top_p=0.95,
                top_k=40
            ),
            contents=[prompt]
        )
        
        jenkinsfile_content = result.text.strip()
        
        # CRITICAL: Always return markdown format (```groovy ... ```)
        # The frontend expects markdown format for code responses
        # Clean up and ensure proper markdown format
        # Remove any text before the first ```groovy or ```
        if '```groovy' in jenkinsfile_content:
            # Extract from ```groovy to ```
            start_idx = jenkinsfile_content.find('```groovy')
            end_idx = jenkinsfile_content.rfind('```')
            if end_idx > start_idx:
                jenkinsfile_content = jenkinsfile_content[start_idx:end_idx + 3]
        elif '```' in jenkinsfile_content:
            # If no language specified, assume groovy and add it
            start_idx = jenkinsfile_content.find('```')
            end_idx = jenkinsfile_content.rfind('```')
            if end_idx > start_idx:
                # Replace first ``` with ```groovy
                jenkinsfile_content = jenkinsfile_content[start_idx:end_idx + 3]
                if not jenkinsfile_content.startswith('```groovy'):
                    jenkinsfile_content = jenkinsfile_content.replace('```', '```groovy', 1)
        else:
            # If no markdown blocks found, wrap the content in markdown
            logger.warning("No markdown code blocks found in LLM response, wrapping in markdown format")
            jenkinsfile_content = f"```groovy\n{jenkinsfile_content}\n```"
        
        # Ensure proper format: ```groovy\n{code}\n```
        if not jenkinsfile_content.startswith('```groovy'):
            # Check if it starts with just ```
            if jenkinsfile_content.startswith('```'):
                jenkinsfile_content = jenkinsfile_content.replace('```', '```groovy', 1)
            else:
                # Wrap in markdown if not already wrapped - THIS IS CRITICAL
                logger.info("Wrapping raw code in markdown format for frontend")
                jenkinsfile_content = f"```groovy\n{jenkinsfile_content}\n```"
        
        # Ensure it ends with ```
        if not jenkinsfile_content.rstrip().endswith('```'):
            jenkinsfile_content = jenkinsfile_content.rstrip() + '\n```'
        
        # Final validation: Must be in markdown format
        if not jenkinsfile_content.startswith('```groovy') or not jenkinsfile_content.rstrip().endswith('```'):
            logger.error("CRITICAL: Jenkinsfile not in proper markdown format after processing!")
            # Force markdown format
            if not jenkinsfile_content.startswith('```groovy'):
                jenkinsfile_content = f"```groovy\n{jenkinsfile_content}\n```"
            if not jenkinsfile_content.rstrip().endswith('```'):
                jenkinsfile_content = jenkinsfile_content.rstrip() + '\n```'
        
        logger.info(f"Jenkinsfile formatted - markdown length: {len(jenkinsfile_content)} characters")
        logger.info(f"Markdown format validation - starts with ```groovy: {jenkinsfile_content.startswith('```groovy')}, ends with ```: {jenkinsfile_content.rstrip().endswith('```')}")
        
        # ALWAYS return markdown format for frontend - this is what the frontend expects
        return jenkinsfile_content
        
    except Exception as e:
        logger.error(f"Error generating Jenkinsfile: {str(e)}")
        raise Exception(f"Failed to generate Jenkinsfile: {str(e)}")


def summarize_conversation_and_detect_complexity(conversation_history: list = None) -> tuple[str, str]:
    """
    Summarize conversation history and detect pipeline complexity level.
    
    Args:
        conversation_history: List of message dicts with 'role' and 'content' keys
    
    Returns:
        Tuple of (summary, complexity_level) where complexity_level is 'simple', 'mid-level', or 'advanced'
    """
    if not conversation_history or len(conversation_history) == 0:
        return "", "mid-level"  # Default to mid-level if no conversation
    
    if not client:
        # Fallback: simple keyword detection if client not available
        all_text = " ".join([msg.get("content", "") for msg in conversation_history])
        all_text_lower = all_text.lower()
        
        if any(word in all_text_lower for word in ["simple", "basic", "minimal", "straightforward"]):
            return all_text[:500], "simple"
        elif any(word in all_text_lower for word in ["advanced", "complex", "sophisticated", "enterprise", "production"]):
            return all_text[:500], "advanced"
        else:
            return all_text[:500], "mid-level"
    
    try:
        # Build conversation context
        conversation_text = "\n".join([
            f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
            for msg in conversation_history[-10:]  # Last 10 messages for context
        ])
        
        summary_prompt = f"""Analyze the following conversation about Jenkins pipeline generation and:
1. Summarize the key requirements and user preferences in 2-3 sentences
2. Determine the complexity level the user wants:
   - "simple": Basic pipeline with minimal stages (checkout, build, test), no advanced features
   - "mid-level": Standard pipeline with proper error handling, caching, notifications, post-build actions
   - "advanced": Enterprise-grade pipeline with parallel stages, matrix builds, advanced caching, deployment stages, comprehensive error handling

CONVERSATION:
{conversation_text}

Respond in this exact format:
SUMMARY: [your summary here]
COMPLEXITY: [simple|mid-level|advanced]"""
        
        result = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.9,
                top_k=40
            ),
            contents=[summary_prompt]
        )
        
        response = result.text.strip()
        
        # Parse response
        summary = ""
        complexity = "mid-level"  # Default
        
        if "SUMMARY:" in response:
            summary_part = response.split("SUMMARY:")[1]
            if "COMPLEXITY:" in summary_part:
                summary = summary_part.split("COMPLEXITY:")[0].strip()
                complexity_part = summary_part.split("COMPLEXITY:")[1].strip().lower()
                if "simple" in complexity_part:
                    complexity = "simple"
                elif "advanced" in complexity_part:
                    complexity = "advanced"
                else:
                    complexity = "mid-level"
            else:
                summary = summary_part.strip()
        else:
            # Fallback: extract summary from response
            summary = response[:300]
        
        # Keyword-based fallback if parsing fails
        response_lower = response.lower()
        if "simple" in response_lower or "basic" in response_lower:
            complexity = "simple"
        elif "advanced" in response_lower or "complex" in response_lower or "enterprise" in response_lower:
            complexity = "advanced"
        
        logger.info(f"Conversation summary generated - Complexity: {complexity}")
        return summary, complexity
        
    except Exception as e:
        logger.warning(f"Error summarizing conversation: {e}, using fallback")
        # Fallback: simple keyword detection
        all_text = " ".join([msg.get("content", "") for msg in conversation_history])
        all_text_lower = all_text.lower()
        
        if any(word in all_text_lower for word in ["simple", "basic", "minimal"]):
            return all_text[:500], "simple"
        elif any(word in all_text_lower for word in ["advanced", "complex", "enterprise"]):
            return all_text[:500], "advanced"
        else:
            return all_text[:500], "mid-level"


def is_jenkinsfile_generator_available() -> bool:
    """Check if Jenkinsfile generator is available"""
    return client is not None


