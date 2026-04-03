"""
GitLab ZIP File Downloader
Downloads a repository as a ZIP file from GitLab using Personal Access Token (PAT)
"""

from dotenv import load_dotenv
import os
import sys
import requests
from pathlib import Path
import zipfile

load_dotenv()

# Configuration
GITLAB_URL = os.getenv("GITLAB_URL", "https://ideyalabs.gitlab.com")  # Default to gitlab.com
GITLAB_PAT = os.getenv("GITLAB_PAT") or os.getenv("GITLAB_TOKEN")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", ".")  # Default to current directory


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """
    Parse a GitLab repository URL to extract GitLab URL and project path.
    
    Args:
        repo_url: Repository URL (e.g., "https://ideyalabs.gitlab.com/username/repo.git" 
                 or "https://gitlab.com/username/repo")
    
    Returns:
        Tuple of (gitlab_url, project_path)
    
    Raises:
        ValueError: If URL format is invalid
    """
    import re
    from urllib.parse import urlparse
    
    # Remove .git suffix if present
    repo_url = repo_url.rstrip('/').rstrip('.git')
    
    # Parse the URL
    parsed = urlparse(repo_url)
    
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Invalid repository URL format: {repo_url}")
    
    # Extract GitLab URL (scheme + netloc)
    gitlab_url = f"{parsed.scheme}://{parsed.netloc}"
    
    # Extract project path (remove leading slash)
    project_path = parsed.path.lstrip('/')
    
    if not project_path:
        raise ValueError(f"Could not extract project path from URL: {repo_url}")
    
    return gitlab_url, project_path


def download_repository_zip(
    repo_url: str = None,
    project_id: str = None,
    branch: str = "main",
    output_filename: str = None,
    gitlab_url: str = None,
    pat: str = None
) -> str:
    """
    Download a GitLab repository as a ZIP file.
    
    Args:
        repo_url: Full repository URL (e.g., "https://ideyalabs.gitlab.com/username/repo.git")
                 (preferred method - if provided, project_id and gitlab_url are not needed)
        project_id: GitLab project ID or path (e.g., "username/repo" or "12345")
                   (only needed if repo_url is not provided)
        branch: Branch name to download (default: "main")
        output_filename: Output filename (default: auto-generated from project name)
        gitlab_url: GitLab instance URL (only needed if using project_id without repo_url)
        pat: Personal Access Token (default: from env)
    
    Returns:
        Path to the downloaded ZIP file
    
    Raises:
        ValueError: If required parameters are missing
        requests.RequestException: If download fails
    """
    # If repo_url is provided, parse it to extract gitlab_url and project_id
    # We don't need project_id if repo_url is provided
    if repo_url:
        gitlab_url, project_id = parse_repo_url(repo_url)
    elif not project_id:
        # If no repo_url, project_id is required
        raise ValueError(
            "Either 'repo_url' or 'project_id' must be provided. "
            "If using 'project_id', 'gitlab_url' is also required unless using default."
        )
    
    # Use provided values or fall back to environment/defaults
    gitlab_url = gitlab_url or GITLAB_URL
    pat = pat or GITLAB_PAT
    
    if not pat:
        raise ValueError(
            "GitLab Personal Access Token (PAT) is required. "
            "Set GITLAB_PAT or GITLAB_TOKEN in your .env file or pass as parameter."
        )
    
    # Normalize GitLab URL (remove trailing slash)
    gitlab_url = gitlab_url.rstrip('/')
    
    # Construct the API endpoint
    # GitLab API: GET /projects/:id/repository/archive
    # URL encode the project ID if it contains slashes
    if '/' in project_id:
        # URL encode the project path
        import urllib.parse
        project_id_encoded = urllib.parse.quote(project_id, safe='')
    else:
        project_id_encoded = project_id
    
    api_url = f"{gitlab_url}/api/v4/projects/{project_id_encoded}/repository/archive.zip"
    print(api_url)
    # Parameters
    params = {
        "sha": branch  # Branch or commit SHA
    }
    
    # Headers with PAT authentication
    headers = {
        "PRIVATE-TOKEN": pat,
        "User-Agent": "GitLab-ZIP-Downloader/1.0"
    }
    
    print(f"Downloading repository from GitLab...")
    print(f"  Project: {project_id}")
    print(f"  Branch: {branch}")
    print(f"  GitLab URL: {gitlab_url}")
    
    try:
        # Make the request
        response = requests.get(
            api_url,
            params=params,
            headers=headers,
            stream=True,  # Stream for large files
            timeout=300  # 5 minute timeout
        )
        
        # Check for errors
        response.raise_for_status()
        
        # Determine output filename
        if not output_filename:
            # Try to get filename from Content-Disposition header
            content_disposition = response.headers.get('Content-Disposition', '')
            if 'filename=' in content_disposition:
                output_filename = content_disposition.split('filename=')[1].strip('"\'')
            else:
                # Generate filename from project ID
                safe_project_name = project_id.replace('/', '-').replace(' ', '-')
                output_filename = f"{safe_project_name}-{branch}.zip"
        else:
            # Normalize the provided output_filename
            # Replace forward slashes with dashes (for path-like names)
            output_filename = output_filename.replace('/', '-').replace('\\', '-')
            # Remove any path separators and get just the filename
            output_filename = Path(output_filename).name
            # Ensure it has .zip extension
            if not output_filename.endswith('.zip'):
                output_filename = f"{output_filename}.zip"
        
        # Ensure output directory exists
        output_path = Path(OUTPUT_DIR)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Full path to output file
        output_file = output_path / output_filename
        
        # Download the file
        print(f"  Saving to: {output_file}")
        total_size = 0
        chunk_size = 8192  # 8KB chunks
        
        with open(output_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    total_size += len(chunk)
                    # Show progress
                    if total_size % (1024 * 1024) == 0:  # Every MB
                        print(f"  Downloaded: {total_size / (1024 * 1024):.1f} MB", end='\r')
        
        print(f"\n✓ Successfully downloaded {total_size / (1024 * 1024):.1f} MB")
        print(f"  File saved to: {output_file.absolute()}")
        
        # Verify it's a valid ZIP file
        try:
            with zipfile.ZipFile(output_file, 'r') as zip_ref:
                file_count = len(zip_ref.namelist())
                print(f"  ZIP file contains {file_count} files")
        except zipfile.BadZipFile:
            print("  Warning: Downloaded file may not be a valid ZIP file")
        
        return str(output_file.absolute())
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            raise ValueError(
                "Authentication failed. Please check your Personal Access Token (PAT).\n"
                "Make sure the token has 'read_repository' or 'read_api' scope."
            )
        elif e.response.status_code == 404:
            raise ValueError(
                f"Project not found: {project_id}\n"
                "Check that the project ID/path is correct and you have access to it."
            )
        else:
            raise requests.RequestException(
                f"GitLab API error ({e.response.status_code}): {e.response.text}"
            )
    except requests.exceptions.RequestException as e:
        raise requests.RequestException(f"Failed to download repository: {str(e)}")


def main():
    """Main function for command-line usage."""
    import argparse
    
    # Declare global at the top of the function
    global OUTPUT_DIR
    
    parser = argparse.ArgumentParser(
        description="Download a GitLab repository as a ZIP file using Personal Access Token"
    )
    parser.add_argument(
        "repo_url",
        nargs='?',
        help="Repository URL (e.g., 'https://ideyalabs.gitlab.com/username/repo.git') or project ID/path"
    )
    parser.add_argument(
        "-p", "--project-id",
        help="GitLab project ID or path (e.g., 'username/repo' or '12345') - use if not providing repo_url"
    )
    parser.add_argument(
        "-b", "--branch",
        default="main",
        help="Branch name to download (default: main)"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output filename (default: auto-generated)"
    )
    parser.add_argument(
        "-u", "--url",
        help=f"GitLab instance URL (default: {GITLAB_URL})"
    )
    parser.add_argument(
        "-t", "--token",
        help="Personal Access Token (overrides GITLAB_PAT env var)"
    )
    parser.add_argument(
        "-d", "--output-dir",
        default=OUTPUT_DIR,
        help=f"Output directory (default: {OUTPUT_DIR})"
    )
    
    args = parser.parse_args()
    
    # Update global OUTPUT_DIR if specified
    OUTPUT_DIR = args.output_dir
    
    # Determine if repo_url or project_id was provided
    if not args.repo_url and not args.project_id:
        parser.error("Either repo_url or --project-id must be provided")
    
    try:
        output_file = download_repository_zip(
            repo_url=args.repo_url,
            project_id=args.project_id,
            branch=args.branch,
            output_filename=args.output,
            gitlab_url=args.url,
            pat=args.token
        )
        print(f"\n✓ Download complete: {output_file}")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

