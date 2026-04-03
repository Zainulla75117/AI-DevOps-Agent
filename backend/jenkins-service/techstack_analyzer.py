from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import sys
import zipfile

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Initialize client (will be None if API key not found, but won't exit)
client = None
if api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Warning: Could not initialize Gemini client: {e}")

SYSTEM_PROMPT = """
You are a codebase analyzer. Analyze the provided codebase files and extract:
- languages
- frameworks
- build tools
- entry points
- env vars
- DB/queue dependencies
- build/run/test steps
"""

# Key files to look for in the codebase
KEY_FILES = [
    "package.json", "pom.xml", "build.gradle", "requirements.txt", "Pipfile",
    "setup.py", "pyproject.toml", "Cargo.toml", "go.mod", "composer.json",
    "pom.xml", "build.xml", "Makefile", "Dockerfile", ".env.example",
    "application.properties", "application.yml", "pom.xml", "build.gradle.kts"
]

def extract_key_files(zip_path, max_size=100000):
    """Extract and read key files from ZIP archive."""
    key_file_contents = {}
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Get list of all files
            file_list = zip_ref.namelist()
            
            # Look for key files
            for file_name in file_list:
                # Check if it's a key file (case-insensitive)
                file_lower = file_name.lower()
                file_basename = os.path.basename(file_lower)
                
                # Check if it matches any key file pattern
                is_key_file = any(key in file_basename for key in KEY_FILES)
                
                # Also include common config directories
                if any(dir_name in file_lower for dir_name in ['src/', 'config/', 'conf/']):
                    # Include source files and config files
                    if file_name.endswith(('.java', '.py', '.js', '.ts', '.go', '.rs', '.properties', '.yml', '.yaml', '.json', '.xml')):
                        is_key_file = True
                
                if is_key_file and not file_name.endswith('/'):
                    try:
                        # Read file content (limit size to avoid memory issues)
                        file_info = zip_ref.getinfo(file_name)
                        if file_info.file_size < max_size:
                            content = zip_ref.read(file_name)
                            # Try to decode as text
                            try:
                                text_content = content.decode('utf-8')
                                key_file_contents[file_name] = text_content
                            except UnicodeDecodeError:
                                # Skip binary files
                                pass
                    except Exception as e:
                        print(f"Warning: Could not read {file_name}: {e}")
                        continue
    except Exception as e:
        print(f"Error extracting ZIP file: {e}")
        return None
    
    return key_file_contents

def analyze_codebase(zip_file_path: str) -> str:
    """
    Analyze a codebase ZIP file and return the analysis results.
    
    Args:
        zip_file_path: Path to the ZIP file to analyze
    
    Returns:
        Analysis results as a string
    
    Raises:
        ValueError: If API key is not found or file doesn't exist
        Exception: If analysis fails
    """
    if not client:
        raise ValueError(
            "Gemini API key not found. Please set GEMINI_API_KEY or GOOGLE_API_KEY in your .env file."
        )
    
    if not os.path.exists(zip_file_path):
        raise ValueError(f"ZIP file not found: {zip_file_path}")
    
    try:
        # Extract key files
        key_files = extract_key_files(zip_file_path)
        
        if not key_files:
            # Fallback: try uploading ZIP directly
            uploaded = client.files.upload(
                file=zip_file_path,
                config=types.UploadFileConfig(display_name=os.path.basename(zip_file_path))
            )
            
            try:
                file_part = types.Part.from_uri(
                    file_uri=uploaded.uri,
                    mime_type="application/zip"
                )
            except:
                file_part = types.Part.from_uri(
                    file_uri=uploaded.uri,
                    mime_type=uploaded.mime_type or "application/zip"
                )
        else:
            # Build content from extracted files
            file_contents_text = "=== CODEBASE FILES ===\n\n"
            for file_path, content in list(key_files.items())[:50]:  # Limit to first 50 files
                file_contents_text += f"--- File: {file_path} ---\n{content}\n\n"
            
            file_part = types.Part.from_text(text=file_contents_text)
        
        # Run analysis
        result = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT
            ),
            contents=[
                "Analyze this codebase and return languages, framework, build/run steps, env vars, and dependencies.",
                file_part
            ]
        )
        
        return result.text
        
    except Exception as e:
        raise Exception(f"Failed to analyze codebase: {str(e)}")


# Main execution (only runs if script is executed directly)
if __name__ == "__main__":
    zip_file = "service-registry-develop-payments-3.0.zip"
    
    if not os.path.exists(zip_file):
        print(f"Error: File '{zip_file}' not found in the current directory.")
        sys.exit(1)
    
    try:
        analysis = analyze_codebase(zip_file)
        print("\n" + "="*80)
        print("ANALYSIS RESULTS:")
        print("="*80)
        print(analysis)
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
